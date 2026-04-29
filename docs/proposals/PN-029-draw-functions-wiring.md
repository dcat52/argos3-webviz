# Proposal: Draw Functions Auto-Wiring

Created: 2026-04-26
Baseline Commit: `5cc38ae` (`master`)
GitHub Issue: #58

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Close the plumbing gap between `CWebvizDrawFunctions` (C++ draw primitives + floor painting) and the broadcast loop. Currently, draw commands and floor data are generated but never injected into the WebSocket messages — users subclassing `CWebvizDrawFunctions` get no output unless they manually wire `sendUserData()`. This should work automatically.

## Scope Boundary

**In scope:**
- Auto-inject `_draw` and `_floor` into global `user_data` when user functions extend `CWebvizDrawFunctions`
- Call `PreBroadcast()` from the broadcast loop so `DrawInWorld()` and `SampleFloor()` run each tick
- Floor dirty tracking to avoid re-sampling every tick

**Out of scope:**
- ❌ New draw primitive types (current set: circle, cylinder, ray, text)
- ❌ Client-side rendering changes (DynamicFloor.tsx and DrawOverlays.tsx already work)
- ❌ Per-entity draw commands (current design is world-space only)

## Current State

**What exists:**
- `CWebvizDrawFunctions` (`webviz_draw_functions.h/.cpp`) — full implementation of `DrawCircle`, `DrawCylinder`, `DrawRay`, `DrawText`, `GetFloorColor`, `SampleFloor`, `PreBroadcast`, `GetDrawCommands`, `GetFloorData`
- Client-side `DrawOverlays.tsx` renders `_draw` commands from `user_data._draw`
- Client-side `DynamicFloor.tsx` renders floor grid from `user_data._floor`
- `experimentStore.ts` extracts `_draw` and `_floor` from global `user_data`
- Broadcast loop in `webviz.cpp` calls `m_pcUserFunctions->sendUserData()` and attaches result as `user_data`

**What's missing:**
- `CWebvizDrawFunctions` does NOT override `sendUserData()` — draw commands and floor data are generated but never sent
- `PreBroadcast()` is never called from the broadcast loop — `DrawInWorld()` never fires
- No floor dirty tracking — `SampleFloor()` runs unconditionally in `PreBroadcast()`
- No integration test with an actual draw-functions user function

## Affected Components

- [x] C++ plugin (`src/`)
- [ ] Legacy client (`client/`)
- [ ] Next client (`client-next/`)
- [ ] Protocol / message format
- [ ] Build system / CMake
- [ ] Documentation

## Design

### Approach

Two changes needed:

1. **Override `sendUserData()` in `CWebvizDrawFunctions`** to call `PreBroadcast()`, then merge `GetDrawCommands()` and `GetFloorData()` into the JSON returned by the user's own `sendUserData()` override (via a base call pattern).

2. **Add floor dirty tracking** — only re-sample when `m_bFloorDirty` is true. Expose `SetFloorChanged()` for users to mark dirty. Default: sample once on first call.

### Key Decisions

1. **Override sendUserData(), not modify webviz.cpp** — keeps the broadcast loop generic; draw functions are a user-functions concern
2. **Merge, don't replace** — if a subclass also returns user_data from sendUserData(), the draw/floor keys get merged in, not clobbered
3. **Floor dirty flag** — default dirty on first tick, clean after. User calls `SetFloorChanged()` to re-sample. Matches QT-OpenGL's `SetChanged()` pattern.

### Pseudocode / Steps

```
CWebvizDrawFunctions::sendUserData():
  // Let subclass provide its own data first
  json result = /* subclass data or null */
  
  // Run draw hooks
  PreBroadcast(arena_size, arena_center)  // calls DrawInWorld() + SampleFloor()
  
  // Inject draw commands
  auto draws = GetDrawCommands()
  if (!draws.empty()) result["_draw"] = draws
  
  // Inject floor data (only if sampled)
  auto floor = GetFloorData()
  if (!floor.is_null()) result["_floor"] = floor
  
  return result
```

### Open Design Question — RESOLVED

How does `CWebvizDrawFunctions` get arena info for `PreBroadcast()`?

**Answer: Option (c)** — `webviz.cpp` calls `PreBroadcast()` directly via `dynamic_cast` before calling `sendUserData()`. This is cleanest because:
- `webviz.cpp` already has arena size/center
- Avoids caching arena info in user functions
- `sendUserData()` stays simple — just inject the already-computed data

### Design Doc

`docs/designs/PN-029-draw-functions-wiring.md` — detailed implementation spec

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/.../webviz/webviz_draw_functions.h` | No sendUserData override, no dirty flag | Add sendUserData override, SetFloorChanged(), m_bFloorDirty |
| `src/.../webviz/webviz_draw_functions.cpp` | PreBroadcast never called externally | Implement sendUserData with auto-injection |
| `src/.../webviz/webviz.cpp` | Calls m_pcUserFunctions->sendUserData() | Add PreBroadcast call via dynamic_cast before sendUserData |

## Assumptions

- [x] `CWebvizDrawFunctions` inherits from `CWebvizUserFunctions`
- [x] Client already handles `_draw` and `_floor` in user_data
- [ ] dynamic_cast to `CWebvizDrawFunctions*` is acceptable in the broadcast loop
- [ ] Arena size/center are available in the broadcast loop (confirmed: `m_cSpace.GetArenaSize()`)

## Dependencies

- **Requires**: None
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] Subclassing `CWebvizDrawFunctions` and calling `DrawCircle()` in `DrawInWorld()` produces visible circles in the web client without manual wiring
- [ ] `GetFloorColor()` override produces a visible floor texture in the web client
- [ ] Floor only re-samples when dirty (first tick + after `SetFloorChanged()`)
- [ ] Existing `CWebvizUserFunctions` subclasses (non-draw) are unaffected
- [ ] C++ build passes

## Verification Strategy

### Success Criteria
- A test user function extending `CWebvizDrawFunctions` with `DrawCircle()` in `DrawInWorld()` shows circles in the browser

### Regression Checks
- `CTestUserFunctions` (extends `CWebvizUserFunctions` directly) still works unchanged
- user_data filtering (PN-026) still works

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Draw commands | Functional | DrawCircle in DrawInWorld | Circle visible in client |
| Floor paint | Functional | Override GetFloorColor | Floor texture visible |
| No-draw fallback | Functional | Use CWebvizUserFunctions (not draw) | No _draw/_floor in user_data |
| Dirty tracking | Functional | Don't call SetFloorChanged after init | Floor sampled once, not every tick |
| Build | Automated | cmake build | Clean compile |

### Acceptance Threshold
- All functional tests pass, build clean

## Effort Estimate

**Time:** 1-2 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | 3 |
| Lines added/changed | ~40 |
| Complexity | Low — wiring existing pieces together |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| Web Loop Function UI | PN-028 discussion | Proposal PN-030 |
| Per-entity draw commands | Investigation | FUTURE.md candidate |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
| 2026-04-26 | Design resolved: option (c) — webviz.cpp calls PreBroadcast via dynamic_cast | 🟡 DESIGN |
| 2026-04-28 | Closed out — PR #60 merged, GitHub issue #58 closed | ✅ COMPLETE |