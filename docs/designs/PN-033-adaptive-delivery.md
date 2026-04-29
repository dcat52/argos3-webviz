# PN-033: Adaptive Delivery & Memory Scaling — Design Doc

## Tiered Broadcast Channels

### Channel Definitions

| Channel | Content | Default Rate | Size Estimate (20 bots) |
|---------|---------|-------------|------------------------|
| `broadcast.core` | type, state, steps, timestamp, entity positions + orientations + IDs | broadcast_frequency Hz | ~2KB |
| `broadcast.visual` | LEDs, rays, points, body colors per entity | broadcast_frequency Hz | ~4KB |
| `broadcast.data` | user_data (per-entity + global), _draw, _floor, _ui | broadcast_frequency Hz | variable, 0-50KB |
| `broadcasts` | All of the above combined (legacy) | broadcast_frequency Hz | ~6-56KB |

### Server-Side Split

In `BroadcastExperimentState()`, build three separate JSON objects from the same entity iteration:

```cpp
nlohmann::json cCoreJson, cVisualJson, cDataJson;

// Core: always built
cCoreJson["type"] = m_bDeltaMode ? (m_bSchemaSent ? "delta" : "schema") : "broadcast";
cCoreJson["state"] = EExperimentStateToStr(m_eExperimentState);
cCoreJson["steps"] = m_cSpace.GetSimulationClock();
cCoreJson["timestamp"] = /* epoch ms */;
cCoreJson["real_time_ratio"] = /* ... */;

// Per-entity split
nlohmann::json cCoreEntities, cVisualEntities, cDataEntities;

for (auto& entity : vecEntities) {
  auto cFull = CallEntityOperation<...>(*this, entity);
  
  // Core: id, type, position, orientation
  nlohmann::json cCore;
  cCore["id"] = cFull["id"];
  cCore["type"] = cFull["type"];
  if (cFull.contains("position")) cCore["position"] = cFull["position"];
  if (cFull.contains("orientation")) cCore["orientation"] = cFull["orientation"];
  // Also include scale/height/radius for geometry (static, but needed for rendering)
  for (auto& key : {"scale", "height", "radius", "is_movable"}) {
    if (cFull.contains(key)) cCore[key] = cFull[key];
  }
  cCoreEntities.push_back(cCore);

  // Visual: LEDs, rays, points
  nlohmann::json cVisual;
  cVisual["id"] = cFull["id"];
  if (cFull.contains("leds")) cVisual["leds"] = cFull["leds"];
  if (cFull.contains("rays")) cVisual["rays"] = cFull["rays"];
  if (cFull.contains("points")) cVisual["points"] = cFull["points"];
  if (cFull.contains("color")) cVisual["color"] = cFull["color"];
  cVisualEntities.push_back(cVisual);

  // Data: user_data
  if (cFull.contains("user_data")) {
    nlohmann::json cData;
    cData["id"] = cFull["id"];
    cData["user_data"] = cFull["user_data"];
    cDataEntities.push_back(cData);
  }
}

cCoreJson["entities"] = cCoreEntities;
// Arena in core (needed for rendering)
cCoreJson["arena"] = /* arena json */;

cVisualJson["type"] = "visual";
cVisualJson["steps"] = m_cSpace.GetSimulationClock();
cVisualJson["entities"] = cVisualEntities;

cDataJson["type"] = "data";
cDataJson["steps"] = m_cSpace.GetSimulationClock();
cDataJson["entities"] = cDataEntities;
if (!user_data.is_null()) cDataJson["user_data"] = user_data;
if (!cUIControls.is_null()) cDataJson["_ui"] = cUIControls;
```

### Publishing

```cpp
// Publish to tiered channels
m_cWebServer->BroadcastChannel("broadcast.core", cCoreJson);
m_cWebServer->BroadcastChannel("broadcast.visual", cVisualJson);
m_cWebServer->BroadcastChannel("broadcast.data", cDataJson);

// Legacy: publish combined to "broadcasts"
nlohmann::json cCombined = /* merge all three */;
m_cWebServer->BroadcastChannel("broadcasts", cCombined);
```

### Client Subscription

WebSocket URL query params:
```
ws://host:3000?broadcast.core,broadcast.visual,broadcast.data,events,logs  # full (explicit)
ws://host:3000                                                              # legacy (all)
ws://host:3000?broadcast.core,events                                        # lightweight monitor
```

### Client Message Handling

```typescript
// connectionStore.ts — handle tiered messages
conn.onMessage = (msg) => {
  switch (msg.type) {
    case 'broadcast':
    case 'schema':
    case 'delta':
      // Full or core message — apply to experiment store
      useExperimentStore.getState().applyMessage(msg)
      break
    case 'visual':
      // Visual-only update — merge LEDs/rays into existing entities
      useExperimentStore.getState().applyVisual(msg)
      break
    case 'data':
      // Data-only update — merge user_data into existing entities
      useExperimentStore.getState().applyData(msg)
      break
    // ... existing event/log handling
  }
}
```

New store methods:
```typescript
applyVisual: (msg) => {
  const { entities, entityGeneration } = get()
  for (const update of msg.entities) {
    const existing = entities.get(update.id)
    if (existing) {
      entities.set(update.id, { ...existing, ...update } as AnyEntity)
    }
  }
  set({ entities, entityGeneration: entityGeneration + 1 })
}

applyData: (msg) => {
  const { entities, entityGeneration } = get()
  for (const update of msg.entities) {
    const existing = entities.get(update.id)
    if (existing) {
      entities.set(update.id, { ...existing, user_data: update.user_data } as AnyEntity)
    }
  }
  set({
    entities,
    entityGeneration: entityGeneration + 1,
    userData: msg.user_data ?? get().userData,
    drawCommands: extractDraw(msg.user_data ?? get().userData),
    floorData: extractFloor(msg.user_data ?? get().userData),
    uiControls: extractUI(msg),
  })
}
```

## Ring Buffer for Trails

### Implementation

```typescript
// lib/ringBuffer.ts — new file
export class RingBuffer<T> {
  private buf: (T | undefined)[]
  private head = 0
  private count = 0

  constructor(private capacity: number) {
    this.buf = new Array(capacity)
  }

  push(item: T): void {
    this.buf[this.head % this.capacity] = item
    this.head++
    if (this.count < this.capacity) this.count++
  }

  get length(): number { return this.count }

  /** Iterate oldest → newest */
  *[Symbol.iterator](): Iterator<T> {
    const start = this.count < this.capacity ? 0 : this.head
    for (let i = 0; i < this.count; i++) {
      yield this.buf[(start + i) % this.capacity] as T
    }
  }

  toArray(): T[] { return [...this] }

  clear(): void { this.head = 0; this.count = 0 }
}
```

### Integration with useTrailHistory

```typescript
// hooks/useTrailHistory.ts — modified
import { RingBuffer } from '@/lib/ringBuffer'

export type TrailMap = Map<string, RingBuffer<[number, number, number]>>

export function useTrailHistory(maxLength: number): TrailMap {
  const entities = useExperimentStore((s) => s.entities)
  const trails = useRef<TrailMap>(new Map())

  for (const entity of entities.values()) {
    if (!('position' in entity)) continue
    const { x, y, z } = entity.position
    let buf = trails.current.get(entity.id)
    if (!buf) {
      buf = new RingBuffer(maxLength)
      trails.current.set(entity.id, buf)
    }
    // RingBuffer.push is O(1) — no shift() needed
    buf.push([x, y, z])
  }
  // Clean up removed entities
  for (const id of trails.current.keys()) {
    if (!entities.has(id)) trails.current.delete(id)
  }

  return trails.current
}
```

The `TrailRenderer` component needs to adapt to iterate the ring buffer instead of an array. Since `RingBuffer` implements `Symbol.iterator`, spread/for-of works directly.

## Recording Memory Bounds

### Cap Strategy

```typescript
const MAX_RECORDING_FRAMES = 10_000
const MAX_RECORDING_BYTES = 100 * 1024 * 1024  // 100MB estimate

interface RecordingStore {
  // ... existing ...
  estimatedBytes: number
  memoryWarning: boolean
}

captureFrame: (msg) => {
  if (get().state !== 'recording') return
  const { frames, estimatedBytes } = get()

  // Estimate frame size (rough: JSON.stringify length as proxy)
  const frameSize = JSON.stringify(msg).length

  if (frames.length >= MAX_RECORDING_FRAMES || estimatedBytes + frameSize > MAX_RECORDING_BYTES) {
    if (!get().memoryWarning) {
      set({ memoryWarning: true })
      console.warn('[Recording] Memory cap reached, recording stopped')
    }
    get().stopRecording()
    return
  }

  set((s) => ({
    frames: [...s.frames, { timestamp: performance.now(), message: msg }],
    totalFrames: s.frames.length + 1,
    estimatedBytes: s.estimatedBytes + frameSize,
  }))
}
```

## Benchmark Population

### Procedure

1. Run existing test scenarios with `spike_ws_measure.js` to get baseline bandwidth numbers
2. Run `client-next/tools/speed-bench.cjs` for FPS baselines
3. Record results in `docs/BENCHMARKS.md`

### Scenarios

| Scenario | Entities | Description |
|----------|----------|-------------|
| empty | 4 | Arena + floor only |
| single | 5 | 1 robot + arena |
| swarm | 24 | 20 robots |
| stress | 104 | 100 robots |
| stress_500 | 504 | 500 robots |

### Metrics

- FPS: p50, p95, min (from speed-bench)
- Bandwidth: bytes/frame, msgs/sec (from spike_ws_measure)
- Per-channel breakdown: core vs visual vs data bytes
- Memory: heap size after 1000 frames

These baselines let us measure the impact of all three proposals.
