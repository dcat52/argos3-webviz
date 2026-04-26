# Proposal: Fit Arena to Viewport on Load

Created: 2026-04-26
Baseline Commit: `8d3a75d` (`master`)
GitHub Issue: #46

## Status: 🔵 IMPLEMENTATION

## Goal

When the viewer loads, position the camera so the entire arena plane just barely fits in the viewport. Currently uses a fixed `arenaDistanceMultiplier: 1.5` heuristic that doesn't account for FOV or viewport aspect ratio, resulting in either too much empty space or the arena being clipped.

## Scope Boundary

**In scope:**
- Computing camera distance from arena dimensions, FOV, and aspect ratio
- Applying to all camera presets (isometric, top, side)
- Working for both perspective and orthographic cameras

**Out of scope:**
- ❌ Changing camera presets or adding new ones
- ❌ Responsive resize handling (re-fitting on window resize)
- ❌ Fitting entities rather than the arena plane

## Current State

**What exists:**
- `CameraController.tsx` positions camera using `arenaDistanceMultiplier: 1.5` from `defaults.ts`
- Distance = `max(arena.size.x, arena.size.y) * 1.5`
- Isometric preset uses `dist * 0.8` and offsets at an angle
- FOV defaults to 50° but is user-configurable
- Arena size comes from the server as `{size: {x, y, z}, center: {x, y, z}}`

**What's missing:**
- No relationship between FOV, aspect ratio, and camera distance
- The multiplier is a guess that works for some arena sizes but not all

## Design

### Approach

Replace the fixed `arenaDistanceMultiplier` with a computed distance based on trigonometry:

For a perspective camera looking down at the arena plane:
- The camera needs to be far enough that the arena width fits the horizontal FOV and the arena depth fits the vertical FOV
- `distance = (arenaExtent / 2) / tan(fov / 2)` for each axis
- Take the max of horizontal and vertical to ensure both fit
- For angled views (isometric, side), account for the viewing angle

For orthographic: set the frustum size to match the arena.

### Key Decisions

1. **Compute in CameraController, not defaults** — the distance depends on runtime values (FOV, aspect ratio, arena size)
2. **Use `gl.domElement` for aspect ratio** — available via `useThree`
3. **Small padding factor** (~5%) to avoid the arena touching viewport edges exactly
4. **Remove `arenaDistanceMultiplier` from defaults** — replaced by computation

### Pseudocode / Steps

```
1. When arena data arrives and camera initializes:
   a. Get arena width (size.x) and depth (size.y)
   b. Get camera FOV (vertical) and viewport aspect ratio
   c. Compute horizontal FOV from vertical: hFov = 2 * atan(aspect * tan(vFov/2))
   d. Compute distance needed for width: dw = (width/2) / tan(hFov/2)
   e. Compute distance needed for depth: dd = (depth/2) / tan(vFov/2)
   f. distance = max(dw, dd) * padding
2. For angled presets (isometric, side), adjust distance by viewing angle
3. Pass computed distance to setLookAt
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/scene/CameraController.tsx` | Uses `arenaDistanceMultiplier` for distance | Compute distance from FOV + aspect + arena |
| `client-next/src/lib/defaults.ts` | `arenaDistanceMultiplier: 1.5` | Remove or keep as fallback |

## Assumptions

- [x] Arena size is available when camera initializes (comes with first state message)
- [ ] `useThree` provides access to viewport aspect ratio
- [ ] CameraControls `setLookAt` works with computed distances

## Dependencies

- **Requires**: None
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] Camera initially frames the arena plane with minimal padding in all presets
- [ ] Works for different arena sizes (small 2x2, large 20x20)
- [ ] Works with different FOV settings
- [ ] Works with different viewport aspect ratios (wide, narrow)
- [ ] Orthographic mode also fits the arena
- [ ] Build passes with no warnings

## Verification Strategy

### Success Criteria
- Arena plane fills ~90-95% of the viewport on load for any arena size

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Default arena | Visual | Load default experiment | Arena fills viewport with small margin |
| Large arena | Visual | Load experiment with 20x20 arena | Same framing |
| Narrow viewport | Visual | Resize browser window narrow | Arena still fits |
| Orthographic | Visual | Toggle orthographic mode | Arena fits |

## Effort Estimate

**Time:** 1-2 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | 2 |
| Lines added/changed | ~20 |
| Complexity | Low — trigonometry, single function |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
