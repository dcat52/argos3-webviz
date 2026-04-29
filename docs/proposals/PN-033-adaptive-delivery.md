# Proposal: Adaptive Delivery & Memory Scaling

Created: 2026-04-28
Baseline Commit: `2a9c90b` (`master`)
GitHub Issue: #65

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🟡 DESIGN → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Enable long-running experiments with large swarms (500+ entities) without unbounded memory growth on the client, and reduce unnecessary data transfer by letting the client declare what data it actually needs. Currently every client gets everything at full rate regardless of what it's displaying.

## Scope Boundary

**In scope:**
- Tiered broadcast: positions at full rate, heavy data (rays, user_data, LEDs) at reduced rate
- Client-requested detail level via WebSocket subscribe params
- Ring buffer for trail history (bounded memory)
- Bounded event log and recording buffers
- Populate the benchmarks framework (docs/BENCHMARKS.md) with real measurements

**Out of scope:**
- ❌ Server-side serialization changes (PN-031)
- ❌ Client rendering pipeline changes (PN-032)
- ❌ Typed arrays / GPU buffer packing (future proposal if needed)
- ❌ Changes to .argosrec file format

## Current State

**What exists:**
- Server broadcasts ALL data at `broadcast_frequency` Hz (default 10) to all clients
- Every broadcast includes: positions, orientations, LEDs (12 per robot), rays (variable, can be 24+ per robot), user_data, points, arena, metadata
- Client trail history (`useTrailHistory.ts`) stores position arrays per entity — no visible cap
- Log store caps at 1000 entries (`LIMITS.maxLogEntries`), event log at 200
- Recording store captures every broadcast frame as a full JSON object in memory
- WebSocket subscribe channels exist: `broadcasts`, `events`, `logs` — but no granularity within broadcasts
- `spike_ws_measure.js` exists but BENCHMARKS.md has no data

**What's missing:**
- No way for client to say "I only need positions" or "send rays at 2Hz"
- No tiered data separation on server
- Trail history grows unbounded for long experiments
- Recording buffer grows unbounded (entire experiment in memory)
- No baseline benchmark data to measure improvements against

## Design

### Approach

Three areas: server-side data tiering, client-side memory bounds, and benchmarking.

1. **Tiered broadcast channels**: Split the broadcast into layers that clients can subscribe to independently:
   - `broadcast.core` — positions, orientations, state, steps, timestamp (small, every tick)
   - `broadcast.visual` — LEDs, rays, points, body colors (medium, every tick or reduced)
   - `broadcast.data` — user_data, _draw, _floor, _ui (can be large, configurable rate)
   
   Clients subscribe via query params: `?channels=broadcast.core,broadcast.visual,events`. Default subscribes to all (backwards compatible). Server publishes to each channel independently using uWS topic system which already exists.

2. **Client memory bounds**:
   - Trail history: ring buffer with configurable max length (default from `VIZ_DEFAULTS.trailLength` = 50, already exists as a setting but needs enforcement as a hard cap)
   - Recording: cap in-memory frames, flush to IndexedDB or warn user when approaching limit
   - Entity store: don't store `prevEntities` as a full Map — only store prev positions for entities that need computed fields (driven by PN-032's lazy fields)

3. **Benchmark baseline**: Run `spike_ws_measure.js` and the speed-bench tool against reference scenarios, populate BENCHMARKS.md with real numbers. This gives us before/after data for all three proposals.

### Key Decisions

1. Use uWS's existing topic/subscribe system for tiering — no new transport mechanism needed. The server already uses `pc_ws->subscribe("broadcasts")` and `pc_ws->publish("broadcasts", ...)`. Adding `broadcast.core` etc. is the same pattern.
2. Tiering is server-side publish granularity, not separate WebSocket connections — one connection, multiple topic subscriptions.
3. Ring buffer for trails is the simplest bounded structure. The existing `trailLength` setting becomes the ring buffer capacity.
4. Recording memory cap with user warning rather than silent data loss — the user should know when they're running out of memory.

### Pseudocode / Steps

**Server tiered publish:**
```
BroadcastExperimentState():
  // Build core (always)
  core = { type, state, steps, timestamp, entities: positions_only }
  
  // Build visual (LEDs, rays, points) — same rate or reduced
  visual = { leds, rays, points for each entity }
  
  // Build data (user_data, _draw, _floor, _ui) — possibly reduced rate
  if steps % data_every_n == 0:
    data = { user_data, _draw, _floor, _ui }
  
  publish("broadcast.core", core)
  publish("broadcast.visual", visual)
  publish("broadcast.data", data)
  // Legacy: also publish combined to "broadcasts" for old clients
  publish("broadcasts", combined)
```

**Client subscribe:**
```
// WebSocket URL: ws://localhost:3000?channels=broadcast.core,broadcast.visual,events,logs
// Or for a lightweight monitoring dashboard:
// ws://localhost:3000?channels=broadcast.core,events
```

**Ring buffer trails:**
```
class RingBuffer<T> {
  buffer: T[]
  head: number = 0
  size: number = 0
  
  push(item: T):
    buffer[head % capacity] = item
    head++
    size = min(size + 1, capacity)
  
  toArray(): T[]  // ordered oldest→newest
}
```

### Design Doc

`docs/designs/PN-033-adaptive-delivery.md` — detailed implementation spec to be created during Design phase.

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/plugins/simulator/visualizations/webviz/webviz.cpp` | BroadcastExperimentState publishes single combined message | Split into tiered channel publishes |
| `src/plugins/simulator/visualizations/webviz/webviz_webserver.cpp` | Subscribes all clients to "broadcasts" | Parse channel query params, subscribe to requested topics |
| `client-next/src/protocol/connection.ts` | Subscribes to broadcasts,events,logs | Support granular channel subscription |
| `client-next/src/hooks/useTrailHistory.ts` | Stores trail positions, length from settings | Enforce ring buffer with hard cap |
| `client-next/src/stores/recordingStore.ts` | Captures every frame in memory array | Add memory cap with user warning |
| `client-next/src/stores/experimentStore.ts` | Stores full prevEntities Map | Reduce to only what lazy fields need |
| `docs/BENCHMARKS.md` | Empty template | Populate with real measurements |
| `spike_ws_measure.js` | Measures total message sizes | Extend to measure per-channel sizes |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| broadcast.core rate | broadcast_frequency Hz | Always full rate |
| broadcast.visual rate | broadcast_frequency Hz | Same rate initially, configurable later |
| broadcast.data rate | broadcast_frequency Hz | Same rate initially, configurable later |
| Trail ring buffer cap | 200 frames | Configurable via settings |
| Recording memory cap | 100MB or 10000 frames | Whichever comes first |

## Assumptions

- [x] uWS topic publish supports multiple topics per message cycle — confirmed, just multiple `publish()` calls
- [x] Splitting broadcast into channels doesn't significantly increase server CPU — entity JSON is built once, split into three objects by field selection
- [x] Client already has trail length setting — confirmed in VIZ_DEFAULTS.trailLength = 50
- [x] IndexedDB is available for recording overflow — standard in modern browsers, but recording cap + stop is simpler and sufficient

## Dependencies

- **Requires**: None (can be done independently)
- **Enhanced by**: PN-031 (msgpack makes core channel even smaller), PN-032 (lazy fields reduce prevEntities need)
- **Blocks**: None

## Done When

- [ ] Server publishes to `broadcast.core`, `broadcast.visual`, `broadcast.data` channels
- [ ] Legacy `broadcasts` channel still works (combined, backwards compatible)
- [ ] Client can subscribe to specific channels via query params
- [ ] Trail history uses ring buffer, bounded at configurable max
- [ ] Recording store warns user when approaching memory cap
- [ ] BENCHMARKS.md populated with baseline measurements for: FPS at 20/100/500 entities, bandwidth per channel, message sizes
- [ ] A lightweight client subscribing only to `broadcast.core` receives ≥50% less data than full subscribe

## Verification Strategy

### Success Criteria
- Core-only subscription: ≥50% bandwidth reduction vs full broadcast
- Trail memory bounded: 500 entities × 200 frames = predictable memory ceiling
- Benchmark data populated and reproducible

### Regression Checks
- Full-subscribe clients see identical behavior to current
- Recording/replay works with tiered data
- All viz features work when subscribed to all channels

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| tiered subscribe | Functional | Connect with broadcast.core only | Only position data received |
| legacy compat | Functional | Connect with no channel params | All data received (backwards compat) |
| ring buffer | Unit | Push 300 items into capacity-200 buffer | Buffer has 200 items, oldest dropped |
| recording cap | Functional | Record 15000 frames | Warning shown, recording continues or stops gracefully |
| bandwidth measurement | Performance | spike_ws_measure.js with channel breakdown | Per-channel sizes reported |
| benchmark population | Documentation | Run all benchmark scenarios | BENCHMARKS.md has real numbers |

### Acceptance Threshold
- All tests pass, benchmark data populated, no regression

## Effort Estimate

**Time:** 10-14 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 2 (ring buffer util, design doc) |
| Files modified | 7 (webviz.cpp, webviz_webserver.cpp, connection.ts, useTrailHistory.ts, recordingStore.ts, experimentStore.ts, BENCHMARKS.md) |
| Lines added/changed | ~350 |
| Complexity | Medium — tiered publish is straightforward with uWS topics; memory bounds are simple |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| Server-side msgpack + dirty tracking | Investigation | PN-031 |
| Client rendering pipeline | Investigation | PN-032 |
| Typed arrays for GPU buffer packing | Investigation | Future — only if PN-032 isn't enough |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-28 | Initial draft | 📋 INVESTIGATION |
| 2026-04-28 | Investigation complete, design doc created. Resolved: 3-channel split (core/visual/data), ring buffer with Symbol.iterator, recording cap at 10K frames/100MB | 🟡 DESIGN |
| 2026-04-28 | Client-side implementation complete. PR #67 merged. Server-side tiered channels designed but needs C++ build env. | ✅ COMPLETE |
