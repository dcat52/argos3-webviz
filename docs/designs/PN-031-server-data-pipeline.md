# PN-031: Server-Side Data Pipeline — Design Doc

## Format Negotiation

### Topic-Based Approach

uWS uses topic-based publish — all subscribers to a topic get identical bytes. Per-client format selection requires separate topics:

- `broadcasts` — JSON text (legacy, backwards compatible)
- `broadcasts.bin` — MessagePack binary

Clients subscribe to one based on query param:
```
ws://host:3000?broadcasts.bin,events,logs     # msgpack (new default for client-next)
ws://host:3000?broadcasts,events,logs         # JSON (debug / legacy)
ws://host:3000                                # no query = subscribe all including both formats
```

For the "no query" default case (backwards compat), subscribe to `broadcasts` + `events` + `logs` as today.

### Serialization in Broadcast()

```cpp
void CWebServer::Broadcast(nlohmann::json cMyJson) {
  std::lock_guard<std::mutex> guard(m_mutex4BroadcastString);
  // Always build JSON string (cheap if no JSON subscribers, but needed for legacy)
  m_strBroadcastString = cMyJson.dump();
  // Build msgpack bytes
  m_vecBroadcastMsgpack = nlohmann::json::to_msgpack(cMyJson);
}
```

Broadcaster thread publishes both:
```cpp
if (!strBroadcastString.empty()) {
  wsStruct.m_pcWS->publish("broadcasts", strBroadcastString,
                           uWS::OpCode::TEXT, true);
}
if (!vecBroadcastMsgpack.empty()) {
  wsStruct.m_pcWS->publish("broadcasts.bin",
    std::string_view(reinterpret_cast<const char*>(vecBroadcastMsgpack.data()),
                     vecBroadcastMsgpack.size()),
    uWS::OpCode::BINARY, true);
}
```

Cost: one extra serialization call per broadcast. `to_msgpack()` is faster than `dump()`, so total cost is ~1.5× one serialization rather than 2×. If no clients subscribe to a format, we can skip it — track subscriber counts per topic.

### Data Structures

```cpp
// webviz_webserver.h
struct m_sPerSocketData {
  // empty — format is determined by topic subscription, not per-socket state
};

// New members on CWebServer:
std::vector<uint8_t> m_vecBroadcastMsgpack;
std::mutex m_mutex4BroadcastMsgpack;  // or reuse m_mutex4BroadcastString
std::atomic<int> m_nMsgpackSubscribers{0};
std::atomic<int> m_nJsonSubscribers{0};
```

## Dirty-Flag Entity Tracking

### Hash Structure

```cpp
// webviz.h — new member
struct SEntitySnapshot {
  float pos[3];
  float orient[4];
  // 28 bytes, memcmp-able
};
std::unordered_map<std::string, SEntitySnapshot> m_mapEntitySnapshots;
```

### Integration with BroadcastExperimentState()

In delta mode, before building entity JSON:

```cpp
for (auto* pEntity : vecEntities) {
  auto cEntityJSON = CallEntityOperation<...>(*this, *pEntity);
  if (cEntityJSON == nullptr) continue;

  const std::string& strId = cEntityJSON["id"].get<std::string>();

  if (m_bDeltaMode && m_bSchemaSent) {
    // Extract position/orientation from the JSON we just built
    SEntitySnapshot snap;
    snap.pos[0] = cEntityJSON["position"]["x"].get<float>();
    snap.pos[1] = cEntityJSON["position"]["y"].get<float>();
    snap.pos[2] = cEntityJSON["position"]["z"].get<float>();
    snap.orient[0] = cEntityJSON["orientation"]["x"].get<float>();
    snap.orient[1] = cEntityJSON["orientation"]["y"].get<float>();
    snap.orient[2] = cEntityJSON["orientation"]["z"].get<float>();
    snap.orient[3] = cEntityJSON["orientation"]["w"].get<float>();

    auto it = m_mapEntitySnapshots.find(strId);
    if (it != m_mapEntitySnapshots.end() &&
        memcmp(&snap, &it->second, sizeof(SEntitySnapshot)) == 0) {
      // Check user_data too — if unchanged, skip entirely
      // For now, skip position-only entities; entities with user_data always included
      if (!cEntityJSON.contains("user_data")) {
        continue;  // Skip this entity in delta
      }
    }
    m_mapEntitySnapshots[strId] = snap;
  }

  cCurrentEntities.push_back(cEntityJSON);
}
```

Note: This still builds the JSON for each entity (needed to extract position). A deeper optimization would read position directly from the ARGoS entity before building JSON — but that requires changing the entity operation pattern. The current approach still saves the delta diff work and the JSON inclusion for unchanged entities.

### Phase 2 optimization (future)

Read position/orientation directly from `CEmbodiedEntity::GetOriginAnchor()` before calling the entity operation. Skip the entire JSON build for unchanged entities. This requires a way to get the entity ID without building JSON — possible via `GetId()` on the entity directly.

## Static Metadata Separation

### Current: metadata in every broadcast

```json
{
  "type": "broadcast",
  "entity_types": ["box", "cylinder", "foot-bot", "kheperaiv"],
  "controllers": ["my_controller"],
  "arena": { "size": {...}, "center": {...} },
  "entities": [...],
  ...
}
```

### New: metadata sent once on connect

On WebSocket open, send a metadata message:
```json
{
  "type": "metadata",
  "entity_types": ["box", "cylinder", "foot-bot", "kheperaiv"],
  "controllers": ["my_controller"],
  "arena": { "size": {...}, "center": {...} }
}
```

Remove `entity_types` and `controllers` from broadcast messages. Keep `arena` in broadcast only for schema/keyframe messages (it could theoretically change on reset).

Client already handles `metadata` message type — `metadataStore.ts` exists and `connectionStore.ts` dispatches it.

### Implementation

In the `.open` handler, after subscribing:
```cpp
// Send metadata immediately on connect
nlohmann::json cMeta;
cMeta["type"] = "metadata";
cMeta["entity_types"] = {"box", "cylinder", "foot-bot", "kheperaiv"};
// ... build controllers list ...
cMeta["controllers"] = cControllers;
// Arena
cMeta["arena"] = ...; // current arena state
pc_ws->send(cMeta.dump(), uWS::OpCode::TEXT);
```

In `BroadcastExperimentState()`, remove the entity_types and controllers blocks.

## Step Unification

### Problem

`StepExperiment()` runs on the uWS event loop thread:
- Calls `UpdateSpace()` (physics) — blocks uWS
- Calls `BroadcastExperimentState()` (serialization) — blocks uWS
- Total blocking time = physics tick + serialization

### Solution

Enqueue step as a command, but add a wake-up mechanism to avoid the 250ms sleep latency.

```cpp
// New: condition variable for sim thread wake-up
std::condition_variable m_cvCommandReady;

void CWebviz::StepExperiment() {
  // Validate state (still on uWS thread — fast, no blocking)
  if (m_eExperimentState == Webviz::EExperimentState::EXPERIMENT_PLAYING ||
      m_eExperimentState == Webviz::EExperimentState::EXPERIMENT_FAST_FORWARDING) {
    m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_PAUSED;
    return;
  }

  // Enqueue the actual step work
  EnqueueCommand([this]() {
    if (!m_cSimulator.IsExperimentFinished()) {
      m_cSimulator.UpdateSpace();
      m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_PAUSED;
      m_cWebServer->EmitEvent("step_complete", m_eExperimentState);
    } else {
      m_cSimulator.GetLoopFunctions().PostExperiment();
      m_eExperimentState = Webviz::EExperimentState::EXPERIMENT_DONE;
      m_cWebServer->EmitEvent("Experiment done", m_eExperimentState);
    }
  });

  // Wake up sim thread immediately
  m_cvCommandReady.notify_one();
}
```

Sim thread paused loop changes from:
```cpp
// OLD
DrainCommandQueue();
BroadcastExperimentState();
std::this_thread::sleep_for(std::chrono::milliseconds(250));
```
to:
```cpp
// NEW
DrainCommandQueue();
BroadcastExperimentState();
{
  std::unique_lock<std::mutex> lock(m_mtxCommandQueue);
  m_cvCommandReady.wait_for(lock, std::chrono::milliseconds(250));
}
```

This way, step commands wake the sim thread immediately instead of waiting up to 250ms.

### EnqueueCommand update

```cpp
void CWebviz::EnqueueCommand(std::function<void()> fn) {
  {
    std::lock_guard<std::mutex> lock(m_mtxCommandQueue);
    m_vecCommandQueue.push_back(std::move(fn));
  }
  m_cvCommandReady.notify_one();  // Wake sim thread
}
```

## Client-Side Changes (minimal, for PN-031 compat)

Client-next connection.ts needs to:
1. Subscribe to `broadcasts.bin` instead of `broadcasts` in the URL
2. Handle `ArrayBuffer` messages (msgpack) in addition to string (JSON)

This is minimal — the full client optimization is PN-032. For PN-031, we just need the decode path to work:

```typescript
// connection.ts onmessage handler
this.ws.onmessage = (ev: MessageEvent) => {
  if (!this.onMessage) return
  try {
    let data: unknown
    if (ev.data instanceof ArrayBuffer) {
      data = decode(new Uint8Array(ev.data))  // @msgpack/msgpack
    } else {
      data = JSON.parse(String(ev.data))
    }
    if (isServerMessage(data)) this.onMessage(data)
  } catch { /* ignore malformed */ }
}
```

And the WebSocket URL construction:
```typescript
private buildUrl(): string {
  const base = this.config.url
  const format = this.config.binary !== false ? 'broadcasts.bin' : 'broadcasts'
  const channels = [format, 'events', 'logs'].join(',')
  return `${base}?${channels}`
}
```
