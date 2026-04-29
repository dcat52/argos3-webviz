# Proposal: Client Rendering Pipeline Optimization

Created: 2026-04-28
Baseline Commit: `2a9c90b` (`master`)
GitHub Issue: #64

## Status: 🟡 DESIGN
<!-- 📋 INVESTIGATION → 🟡 DESIGN → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Make the client-next viewer handle 500+ entity swarms at 60fps by eliminating unnecessary per-frame work. Currently, every broadcast triggers O(N²) computed field calculations, full Map recreation, and React reconciliation even when most data hasn't changed. This is pure viewer optimization — no sim impact.

## Scope Boundary

**In scope:**
- Lazy computed fields — only compute fields actively used by a viz config
- Spatial hash index for O(N) neighbor/distance queries
- Avoid Map recreation per frame — mutate in place with generation counter
- MessagePack decoder on client side (paired with PN-031)
- Benchmark framework to measure before/after

**Out of scope:**
- ❌ Server-side changes (PN-031)
- ❌ Adaptive delivery / tiered rates (PN-033)
- ❌ WebGL shader-level optimizations
- ❌ Changes to Three.js or React Three Fiber internals

## Current State

**What exists:**
- `experimentStore.ts` (238 lines): `applyBroadcast()` creates new `Map<string, AnyEntity>` every frame, stores `prevEntities`, and calls `computeFields()` on every apply
- `computedFields.ts` (147 lines): 7 built-in fields computed for ALL entities every frame, including `_distance_to_nearest` (O(N²)) and `_neighbor_count` (O(N²))
- `InstancedEntities.tsx` (153 lines): instanced rendering for foot-bot/kheperaiv above 30 entities — good, but `useFrame` iterates all entities every render frame even if positions unchanged
- `connection.ts` (113 lines): `JSON.parse()` on every message — works but slower than msgpack decode
- Zustand stores trigger React re-renders on every `set()` call

**What's missing:**
- No way to know which computed fields are actually in use
- No spatial index — every neighbor query scans all entities
- No dirty detection on client — every broadcast triggers full store update + re-render
- No msgpack support on client

## Design

### Approach

Four independent client-side improvements:

1. **Lazy computed fields**: The viz config store already tracks which field is selected for color-by, heatmap, etc. Computed fields should only run when referenced. Change `computeFields()` to accept a set of requested field names and skip the rest. The O(N²) fields (`_distance_to_nearest`, `_neighbor_count`) become free when not visualized.

2. **Spatial hash**: For the O(N²) fields that ARE used, replace brute-force iteration with a grid-based spatial hash. Partition the arena into cells (e.g., 1m²), assign entities to cells, only check neighboring cells for distance queries. Drops from O(N²) to O(N×k) where k is average neighbors per cell.

3. **In-place entity updates**: Instead of creating a new Map every frame, mutate the existing Map and bump a generation counter. Use Zustand's `shallow` equality or a custom equality function so React only re-renders components whose specific entity changed. For delta messages, only touch the entries that changed.

4. **MessagePack client decoder**: Add `@msgpack/msgpack` to decode binary WebSocket messages. The connection class checks `ev.data` type — if `ArrayBuffer`, decode as msgpack; if string, parse as JSON. This pairs with PN-031's server-side msgpack output.

### Key Decisions

1. Lazy fields use a "pull" model — the viz config declares what it needs, computeFields only computes those. This is simpler than a reactive/subscription model and matches how the viz config already works.
2. Spatial hash cell size = 1m (matches `_neighbor_count` radius). Configurable if needed later.
3. Generation counter approach over immutable Maps — avoids GC pressure from creating 10+ Maps/second with thousands of entries each.
4. `@msgpack/msgpack` over `msgpack-lite` — actively maintained, TypeScript types, smaller bundle.

### Pseudocode / Steps

**Lazy computed fields:**
```
// vizConfigStore already has: colorByField, heatmapField, etc.
function getActiveFields(vizConfig): Set<string> {
  fields = new Set()
  if (vizConfig.colorByEnabled) fields.add(vizConfig.colorByField)
  if (vizConfig.heatmapEnabled) fields.add(vizConfig.heatmapField)
  // ... etc
  return fields
}

function computeFields(entities, prev, arena, activeFields):
  if activeFields.size === 0: return empty map
  for each entity:
    for each field in activeFields:  // not ALL fields
      compute field
```

**Spatial hash:**
```
class SpatialHash {
  cellSize: number
  cells: Map<string, Set<string>>  // "x,y" -> entity IDs

  rebuild(entities):
    cells.clear()
    for each entity with position:
      key = floor(pos.x/cellSize) + "," + floor(pos.y/cellSize)
      cells.get(key).add(entity.id)

  queryRadius(pos, radius):
    // check cells within radius
    results = []
    for cx in range(floor((pos.x-r)/cell), floor((pos.x+r)/cell)):
      for cy in range(...):
        results.push(...cells.get(cx+","+cy))
    return results
}
```

**In-place updates:**
```
applyDelta(msg):
  // OLD: const next = new Map(prev); ... set({ entities: next })
  // NEW: mutate in place, bump generation
  for [id, changes] of msg.entities:
    existing = this.entities.get(id)
    Object.assign(existing, changes)  // mutate
  this.generation++
  // Zustand set with same Map reference but new generation triggers re-render
```

### Design Doc

`docs/designs/PN-032-client-rendering-pipeline.md` — detailed implementation spec to be created during Design phase.

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/lib/computedFields.ts` | 147 lines, computes all 7 fields for all entities every frame | Accept activeFields set, skip unused fields |
| `client-next/src/stores/experimentStore.ts` | 238 lines, creates new Maps per frame, calls computeFields unconditionally | In-place mutation, generation counter, lazy field computation |
| `client-next/src/protocol/connection.ts` | 113 lines, JSON.parse only | Add msgpack decode path for ArrayBuffer messages |
| `client-next/src/stores/vizConfigStore.ts` | Tracks viz config selections | Export getActiveFields() helper |
| `client-next/src/scene/InstancedEntities.tsx` | 153 lines, iterates all entities in useFrame | Skip update when generation unchanged |
| `client-next/src/lib/spatialHash.ts` | Does not exist | New file: spatial hash implementation |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| Spatial hash cell size | 1.0m | Matches _neighbor_count radius |
| Individual→instanced threshold | 30 entities | Existing, unchanged |
| msgpack package | `@msgpack/msgpack` | ~15KB gzipped |

## Assumptions

- [ ] `@msgpack/msgpack` can decode nlohmann's msgpack output — standard MessagePack, high confidence
- [x] Zustand generation counter pattern triggers re-renders correctly — confirmed: primitive value change in `set()` triggers selectors
- [x] Spatial hash rebuild per frame is cheaper than O(N²) brute force — O(N) rebuild + O(N×k) queries, true for N>50
- [x] vizConfigStore already tracks which fields are selected — confirmed, VizConfig has colorBy.field, labels[].field etc.
- [x] prevEntities can be reduced to prevPositions — only _speed, _heading, _led_changed need prev data

## Dependencies

- **Requires**: None (works with JSON; msgpack decode is additive)
- **Enhanced by**: PN-031 (server-side msgpack output)
- **Blocks**: None

## Done When

- [ ] Computed fields only run for fields actively used by viz config
- [ ] `_distance_to_nearest` and `_neighbor_count` use spatial hash when computed
- [ ] `applyDelta()` does not create new Map objects
- [ ] Client decodes MessagePack binary frames when received
- [ ] FPS benchmark shows ≥30% improvement at 200 entities with color-by disabled
- [ ] FPS benchmark shows ≥50% improvement at 500 entities with color-by disabled
- [ ] No visual regression — rendering output identical before/after

## Verification Strategy

### Success Criteria
- 200 entities: ≥60fps with no viz features active (currently drops below on some hardware)
- 500 entities: ≥30fps with instanced rendering
- Computed field CPU time near zero when no viz features enabled

### Regression Checks
- Color-by, heatmap, trails all still work when enabled
- Entity selection, inspection panel, user data display unchanged
- Delta mode state reconstruction is correct
- Recording/replay unaffected

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| lazy fields off | Functional | Disable all viz features, check computeFields time | Near zero CPU |
| lazy fields on | Functional | Enable color-by _speed, check computeFields | Only _speed computed |
| spatial hash | Unit | 500 random positions, query radius 1m | Same results as brute force, faster |
| in-place delta | Unit | Apply delta, verify entity state | Correct merge, no new Map |
| msgpack decode | Unit | Encode with nlohmann, decode with @msgpack/msgpack | Round-trip matches |
| FPS benchmark | Performance | stress_500 scene, measure p50 FPS | ≥30fps |

### Acceptance Threshold
- All functional tests pass, FPS targets met on reference hardware

## Effort Estimate

**Time:** 10-14 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 2 (spatialHash.ts, design doc) |
| Files modified | 5 (computedFields.ts, experimentStore.ts, connection.ts, vizConfigStore.ts, InstancedEntities.tsx) |
| Lines added/changed | ~300 |
| Complexity | Medium — generation counter pattern needs careful Zustand integration |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| Server-side msgpack + dirty tracking | Investigation | PN-031 |
| Adaptive delivery | Investigation | PN-033 |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-28 | Initial draft | 📋 INVESTIGATION |
| 2026-04-28 | Investigation complete, design doc created. Resolved: lazy field pull model via VizConfig, spatial hash with 1m cells, generation counter for Zustand, prevEntities reduced to prevPositions | 🟡 DESIGN |
