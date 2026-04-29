# Proposal: Server-Side Data Pipeline Optimization

Created: 2026-04-28
Baseline Commit: `2a9c90b` (`master`)
GitHub Issue: #63

## Status: 🔵 IMPLEMENTATION
<!-- 📋 INVESTIGATION → 🟡 DESIGN → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Reduce the CPU cost of `BroadcastExperimentState()` on the sim thread and fix the step-command architecture so that serialization work doesn't block the simulation or the uWS event loop. The sim is the bottleneck — webviz is a viewer, but its serialization runs on the sim thread and directly competes with `UpdateSpace()`.

## Scope Boundary

**In scope:**
- MessagePack binary serialization with `?format=json` query-param fallback
- Dirty-flag entity tracking — skip serialization for unchanged entities in delta mode
- Static metadata (entity_types, controllers, arena) sent once on connect, not every frame
- Unify `StepExperiment()` onto the sim thread via command queue (step = "run 1 tick + pause")
- Step acknowledgment on event channel for responsive UI

**Out of scope:**
- ❌ Client-side rendering changes (PN-032)
- ❌ Adaptive delivery / tiered broadcast rates (PN-033)
- ❌ Changes to the ARGoS core simulator
- ❌ UDP transport (WebSocket/TCP is correct for a viewer)

## Current State

**What exists:**
- `BroadcastExperimentState()` in `webviz.cpp` (line ~490) serializes ALL entities to JSON every broadcast tick, even in delta mode — it builds full JSON, then diffs
- Delta mode computes diffs by comparing nlohmann::json objects (string-level equality)
- `StepExperiment()` runs synchronously on the uWS event loop thread, blocking all WebSocket I/O during physics + serialization
- Metadata (entity_types, controllers) is embedded in every broadcast message
- Arena size/center is sent every frame despite never changing mid-experiment
- nlohmann/json `dump()` is used for serialization — text JSON over WebSocket with uWS DEDICATED_COMPRESSOR_8KB
- Broadcast frequency defaults to 10Hz, configurable via XML

**What's missing:**
- No dirty tracking per entity — every entity is serialized every frame
- No binary serialization option
- Step runs on wrong thread, causing uWS event loop blocking
- No step acknowledgment — client guesses when step completed
- No separation of static vs dynamic data

## Design

### Approach

Four independent improvements to the server-side broadcast pipeline, all in C++:

1. **MessagePack serialization**: Use `nlohmann::json::to_msgpack()` for binary output. Client negotiates format via WebSocket query param (`?format=msgpack` default, `?format=json` for debug). The nlohmann library already supports this — zero new dependencies.

2. **Dirty-flag entity tracking**: Track entity position/orientation hashes between frames. In delta mode, skip serialization entirely for entities that haven't changed — don't build JSON just to diff it. Store a lightweight hash (position + orientation as raw bytes) per entity ID.

3. **Static metadata separation**: On WebSocket connect, send a one-time `metadata` message with entity_types, controllers, and arena. Remove these fields from broadcast messages. Arena only re-sent if it actually changes (rare).

4. **Step unification**: Change `StepExperiment()` to enqueue a lambda on the command queue (like moveEntity already does) instead of running synchronously. The lambda runs 1 tick + sets state to PAUSED + emits an event. This means step goes through the same sim-thread path as play mode.

### Key Decisions

1. MessagePack over CBOR/Protobuf — nlohmann has native support, no schema files needed, and the client can use `@msgpack/msgpack` (well-maintained, 15KB)
2. Dirty tracking uses raw byte comparison of position+orientation (7 floats = 28 bytes) rather than JSON string comparison — O(1) per entity instead of O(fields)
3. Step unification is the highest-risk change — it changes the threading model for step. But it aligns step with the existing play/command pattern, which is already proven.
4. `?format=json` fallback preserves debuggability with websocat/browser devtools

### Pseudocode / Steps

**MessagePack:**
```
on WebSocket connect:
  check query param for format preference
  store format flag per-client in SWebSocketClient

BroadcastExperimentState():
  build nlohmann::json as today
  if any client wants msgpack:
    msgpack_bytes = json::to_msgpack(state_json)
  if any client wants json:
    json_string = state_json.dump()
  publish appropriate format per client
```

**Dirty tracking:**
```
struct EntityHash { float pos[3]; float orient[4]; }
unordered_map<string, EntityHash> prev_hashes;

BroadcastExperimentState() in delta mode:
  for each entity:
    compute hash from position + orientation
    if hash == prev_hashes[id]:
      skip entirely (don't even build JSON)
    else:
      serialize entity, add to delta
      prev_hashes[id] = hash
```

**Step unification:**
```
StepExperiment():
  // OLD: directly call UpdateSpace() on uWS thread
  // NEW: enqueue on sim thread
  EnqueueCommand([this]() {
    if (!m_cSimulator.IsExperimentFinished()) {
      m_cSimulator.UpdateSpace();
      m_eExperimentState = EXPERIMENT_PAUSED;
      BroadcastExperimentState();
      m_cWebServer->EmitEvent("step_complete", m_eExperimentState);
    }
  });
```

### Design Doc

`docs/designs/PN-031-server-data-pipeline.md` — detailed implementation spec to be created during Design phase.

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/plugins/simulator/visualizations/webviz/webviz.cpp` | 1163 lines, BroadcastExperimentState serializes all entities, StepExperiment runs on uWS thread | Add dirty tracking, msgpack output, unify step onto sim thread |
| `src/plugins/simulator/visualizations/webviz/webviz.h` | 247 lines | Add EntityHash map, per-client format flag |
| `src/plugins/simulator/visualizations/webviz/webviz_webserver.cpp` | 458 lines, broadcasts string to all clients | Support binary (msgpack) publish, per-client format negotiation |
| `src/plugins/simulator/visualizations/webviz/webviz_webserver.h` | 151 lines | Add format flag to SWebSocketClient, binary broadcast method |
| `src/plugins/simulator/visualizations/webviz/entity/webviz_footbot.cpp` | 146 lines | No change (serialization format stays nlohmann::json internally) |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| Default format | msgpack | Negotiated per-client via query param |
| Dirty hash size | 28 bytes/entity | 7 floats: pos xyz + orient xyzw |
| Metadata send frequency | Once on connect + on reset | Not every frame |

## Assumptions

- [x] nlohmann/json supports `to_msgpack()` — confirmed, v3.7.3 has 11 references
- [x] uWebSockets can publish BINARY opcode — confirmed, `publish()` accepts `OpCode::BINARY`
- [ ] Step unification doesn't break experiment state machine — design uses condition_variable wake-up to avoid 250ms latency; needs testing
- [x] Topic-based publish means per-client format requires separate topics — confirmed, using `broadcasts` (JSON) and `broadcasts.bin` (msgpack)
- [ ] `@msgpack/msgpack` npm package decodes nlohmann msgpack output — standard MessagePack, high confidence

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-032 (client-side msgpack decode)
- **Blocks**: None (PN-032 can use JSON fallback until this lands)

## Done When

- [ ] `BroadcastExperimentState()` outputs MessagePack by default, JSON via `?format=json`
- [ ] In delta mode, entities with unchanged position+orientation are not serialized
- [ ] Metadata (entity_types, controllers) sent once on connect, not in every broadcast
- [ ] Arena sent only when changed (or in schema/keyframe messages)
- [ ] `StepExperiment()` runs on sim thread via command queue
- [ ] Step emits `step_complete` event before broadcast
- [ ] Existing client-next works with `?format=json` (backwards compatible)
- [ ] Build passes, existing tests pass

## Verification Strategy

### Success Criteria
- Broadcast message size reduced ≥30% (msgpack vs JSON, measured with spike_ws_measure.js)
- Sim thread time in BroadcastExperimentState reduced ≥40% for stationary swarms (dirty tracking)
- Step command no longer blocks uWS event loop

### Regression Checks
- Play/pause/step/reset/fastforward all work correctly
- Delta mode produces correct state on client
- Multiple clients can connect with different format preferences
- Recording/replay still works (uses client-side data, not wire format)

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| msgpack output | Functional | Connect with default params, capture raw WS frame | Binary msgpack data, decodable |
| json fallback | Functional | Connect with `?format=json`, capture frame | Valid JSON, same content |
| dirty tracking | Functional | Run 20 stationary bots, measure serialization time | Only changed entities in delta |
| step on sim thread | Functional | Send step command, verify no uWS blocking | Step completes, event emitted |
| step acknowledgment | Functional | Send step, listen for step_complete event | Event arrives before/with broadcast |
| multi-client format | Functional | Two clients, one json one msgpack | Each gets correct format |

### Acceptance Threshold
- All tests pass, no regression in existing functionality

## Effort Estimate

**Time:** 12-16 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 1 (design doc) |
| Files modified | 4 (webviz.cpp, webviz.h, webviz_webserver.cpp, webviz_webserver.h) |
| Lines added/changed | ~250 |
| Complexity | Medium — threading change for step is the riskiest part |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| Client msgpack decoder + rendering opts | Investigation | PN-032 |
| Adaptive delivery / tiered rates | Investigation | PN-033 |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-28 | Initial draft | 📋 INVESTIGATION |
| 2026-04-28 | Investigation complete, design doc created. Resolved: topic-based format (broadcasts vs broadcasts.bin), condition_variable for step wake-up, dirty tracking via SEntitySnapshot memcmp | 🟡 DESIGN |
| 2026-04-29 | Implementation: client msgpack decode, C++ step unification (condition_variable), msgpack broadcast, metadata removed from broadcast. C++ untested (no ARGoS build env). | 🔵 IMPLEMENTATION |
