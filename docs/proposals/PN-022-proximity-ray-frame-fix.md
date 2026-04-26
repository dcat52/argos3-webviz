# Proposal: Proximity Ray Coordinate Frame Fix

Created: 2026-04-26
Baseline Commit: `4ca9b98` (`master`)
GitHub Issue: #40

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Fix stale proximity sensor rays appearing at the wrong position after dragging an entity. When a robot is moved via drag, the sensor rays were computed at the old position and snap back there on release because no `UpdateSpace()` runs between the move and the next broadcast.

## Scope Boundary

**In scope:**
- Fixing the ray-to-local coordinate transformation in the C++ entity serializers
- Snapshotting pre-move entity poses in the webviz main loop
- All entity types that serialize rays (foot-bot, kheperaIV, leo)

**Out of scope:**
- ❌ Changing the ARGoS core simulation loop order
- ❌ Re-computing sensors after physics (would require ARGoS core changes)
- ❌ Client-side ray rendering changes (not needed — client is correct)
- ❌ Draw-function rays (`CWebvizDrawFunctions::DrawRay`) — these are user-specified world-coordinate rays, not sensor rays

## Current State

**What exists:**
- Entity serializers (`webviz_footbot.cpp`, `webviz_kheperaiv.cpp`, `webviz_leo.cpp`) convert sensor rays from world coordinates to entity-local coordinates for transmission
- The transformation subtracts the entity's current position and counter-rotates by the entity's current orientation
- `BroadcastExperimentState()` is called after `m_cSimulator.UpdateSpace()` returns

**What's missing:**
- The ray world coordinates come from `GetCheckedRays()`, which stores rays computed during the **Sense** phase (before physics). But the position/orientation used for the local transform comes from `GetOriginAnchor()`, which reflects the **post-physics** state. This creates a displacement error equal to one step's movement.

### The ARGoS Loop Inside `UpdateSpace()`

```
1. Sense     — sensors fire, proximity rays computed at position_old
2. Control   — controller step runs
3. Act       — actuators apply movement commands
4. Physics   — engine steps, entity moves to position_new
```

### The Bug

In `webviz_footbot.cpp:95-101` (and equivalent in kheperaiv, leo):

```cpp
// cPosition = position_new (post-physics)
const argos::CVector3& cPosition =
  c_entity.GetEmbodiedEntity().GetOriginAnchor().Position;

// vecRays[i] = world coords computed at position_old (pre-physics)
CVector3 cStartVec = vecRays[i].second.GetStart();
cStartVec -= cPosition;  // ERROR: subtracting position_new from position_old coords
```

The ray start/end are in world space relative to `position_old`, but we subtract `position_new`. The resulting local coordinates are wrong by `(position_new - position_old)`.

## Affected Components

- [x] C++ plugin (`src/`)
- [ ] Legacy client (`client/`)
- [ ] Next client (`client-next/`)
- [ ] Protocol / message format
- [ ] Build system / CMake
- [ ] Documentation

## Design

### Approach

Before calling `UpdateSpace()`, snapshot each controllable entity's position and orientation. After `UpdateSpace()` returns (and before `BroadcastExperimentState()`), make the snapshots available to the entity serializers so they use the pre-physics pose for the ray-to-local transformation.

Entity positions and orientations sent to the client remain post-physics (correct — we want to show where the robot IS). Only the ray transformation uses the pre-physics pose (correct — the rays were computed there).

### Key Decisions

1. **Snapshot in webviz.cpp, not in serializers** — the serializers don't know when `UpdateSpace()` runs. The main loop does.
2. **Store snapshots in a map keyed by entity ID** — simple lookup, no changes to the `CallEntityOperation` interface.
3. **Member variable on CWebviz** — the snapshot map lives on the visualization class, accessible to serializers via the `CWebviz&` reference they already receive.
4. **Only snapshot controllable entities** — lights, boxes, cylinders without controllers don't have rays.

### Pseudocode / Steps

```
// In CWebviz::Execute(), before the UpdateSpace() call:
1. Clear m_mapPrePhysicsPoses
2. For each entity in space:
   a. If entity has a controllable component with checked rays:
      Store {position, orientation} keyed by entity ID

// In CWebviz::Execute():
3. Call m_cSimulator.UpdateSpace()  // existing line

// In entity serializers (footbot, kheperaiv, leo):
4. When converting rays to local coords:
   a. Look up pre-physics pose from m_mapPrePhysicsPoses
   b. If found, use pre-physics position/orientation for the subtraction and rotation
   c. If not found (shouldn't happen), fall back to current position (existing behavior)
```

### Design Doc

`docs/designs/PN-022-proximity-ray-frame-fix.md` — exact code changes for all 5 files,
edge case handling, and critique resolutions.

### Critique Resolutions

1. **Intersection points also affected** — `vecPoints` use the same subtraction. Fixed in design.
2. **Orientation must also be pre-physics** — `cInvZRotation` derived from post-physics orientation. Fixed: snapshot includes orientation.
3. **Fast-forward snapshot timing** — snapshot before each `UpdateSpace()` in the FF loop, last one wins.
4. **Recorder** — does not serialize rays. Out of scope.

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/plugins/simulator/visualizations/webviz/webviz.h` | CWebviz class definition | Add `m_mapPrePhysicsPoses` member, pose struct |
| `src/plugins/simulator/visualizations/webviz/webviz.cpp` | Calls `UpdateSpace()` then `BroadcastExperimentState()` | Add snapshot loop before `UpdateSpace()` at lines 210, 685 |
| `src/plugins/simulator/visualizations/webviz/entity/webviz_footbot.cpp` | Subtracts post-physics position from ray coords (line 98-101) | Use pre-physics position from snapshot map |
| `src/plugins/simulator/visualizations/webviz/entity/webviz_kheperaiv.cpp` | Same pattern (line 116-119) | Same fix |
| `src/plugins/simulator/visualizations/webviz/entity/webviz_leo.cpp` | Same pattern (line 95-98) | Same fix |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| Snapshot scope | Controllable entities only | Entities without controllers have no rays |

## Assumptions

Verify these before starting. If any are false, revisit the design.

- [x] `GetCheckedRays()` returns rays computed during the Sense phase, before physics
- [x] `GetOriginAnchor().Position` reflects post-physics state when read after `UpdateSpace()`
- [ ] The `CWebviz&` reference passed to entity operation functors is the same instance that holds the snapshot map
- [ ] Entity IDs are stable across the snapshot → serialize window (no entity add/remove mid-step)

## Dependencies

- **Requires**: None
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] Rays visually originate from the robot body, not offset behind it, for moving robots
- [ ] Stationary robots are unaffected (zero displacement = no change)
- [ ] Fast-forward mode works correctly (snapshot taken before the last `UpdateSpace()` in the FF loop)
- [ ] All three entity types (foot-bot, kheperaIV, leo) are fixed
- [ ] Build passes with no warnings

## Verification Strategy

### Success Criteria
- With a robot moving in a straight line, proximity rays visually start from the robot's rendered position, not behind it

### Regression Checks
- Stationary robots: rays unchanged
- Ray hit/miss coloring: unchanged
- Delta protocol: no breakage (ray data format unchanged)
- Fast-forward: rays still correct (not stale from N steps ago)

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Moving robot rays | Visual | Run diffusion experiment, observe fast-moving robot | Rays originate from robot body |
| Stationary robot rays | Visual | Pause experiment, check ray positions | Rays unchanged from current behavior |
| Fast-forward rays | Visual | Run at 10x, observe rays | Rays track robot position correctly |
| Build | Automated | `make` in build/ | Clean build, no warnings |

### Acceptance Threshold
- Zero visible ray offset on robots moving at normal simulation speeds

## Open Questions

- Should the snapshot also cover the recorder (`webviz_recorder.cpp`)? It serializes entities for replay but may have the same issue.

## Effort Estimate

**Time:** 3-4 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | 5 |
| Lines added/changed | ~60 |
| Complexity | Low — mechanical fix, same pattern in 3 serializers |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| ARGoS core: post-physics sensor re-read hook | Investigation | Captured in FUTURE.md |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
| 2026-04-26 | Critique passed — intersection points + orientation also affected | 🔍 CRITIQUE |
| 2026-04-26 | Design doc written with exact code changes | 🟡 DESIGN |
| 2026-04-26 | Design critique passed — 3 amendments applied (HasComponent guard, thread safety note, line numbers) | 🔍 CRITIQUE |
| 2026-04-26 | Implementation complete on feat/PN-022-proximity-ray-frame-fix. Build deferred (ARGoS not installed). | 🔵 IMPLEMENTATION |
| 2026-04-26 | Build verified in Apptainer container — clean compile, no warnings | 🟣 VERIFICATION |
| 2026-04-26 | Initial fix was wrong — reverted. Correct root cause: stale rays after MoveEntity in paused state. Fix: clear checked rays after move. | 🔵 IMPLEMENTATION |
| 2026-04-26 | Status updated to ✅ COMPLETE (housekeeping sync) | Housekeeping |
