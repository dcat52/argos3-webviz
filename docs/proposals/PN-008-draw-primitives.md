# Proposal: QT-OpenGL Drawing Primitives for Client-Next

Created: 2026-04-15
Baseline Commit: `b51123c` (`client-next`)
GitHub Issue: #16

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Implement the missing QT-OpenGL drawing primitives (DrawCircle, DrawCylinder,
dynamic floor painting) so that existing ARGoS experiments render identically
in client-next without requiring experiment code changes.

## Scope Boundary

**In scope:**
- `DrawCircle` equivalent — filled/outline circles at world positions (comm range, selection rings)
- `DrawCylinder` equivalent — entity-relative 3D cylinders (food-on-carrier indicator)
- Dynamic floor painting — `GetFloorColor()` equivalent for food zones, nest areas
- Protocol additions to transmit draw commands and floor color data from C++ to client
- Webviz user_functions that mirror the QT drawing API

**Out of scope:**
- ❌ `DrawBox`, `DrawTriangle`, `DrawPolygon`, `DrawPoint` — unused in any known experiment across argos3-examples, argos3-webviz-examples, and Canopy-Experiments
- ❌ `DrawOverlay(QPainter&)` — 2D screen-space HUD, no protocol equivalent
- ❌ Manual control / keyboard forwarding to controllers
- ❌ Modifying existing experiment controllers or loop functions

## Current State

**What exists:**
- `EntityLinks` — draws lines between entities (covers `DrawRay` for links)
- `FloatingLabels` — draws text at entity positions (covers `DrawText`)
- `TrailRenderer` — draws position history (covers trajectory `DrawRay` waypoints)
- `HeatmapOverlay` — density visualization on ground plane
- `FloorRenderer` — renders `CFloorEntity` but only static (no dynamic color data from server)
- Entity renderers accept `overrideColor` (covers `SetColor`)
- Sensor rays already rendered per-entity (covers `DrawRay` for sensors)
- `CWebvizUserFunctions` has `Call(CEntity&)` for per-entity JSON and `sendUserData()` for global JSON

**What's missing:**
- No circle rendering component — blocks Canopy sync and diffusion experiments
- No entity-relative cylinder overlay — blocks foraging food-on-carrier indicator
- No dynamic floor color data in protocol — blocks foraging floor painting
- No webviz equivalent of `DrawInWorld()` or per-entity `Draw()` hooks that produce shape commands
- `user_data` can carry arbitrary JSON but no convention for shape commands

**Audit of actual usage across all three repos:**

| Example | Repo | Hook | Primitives | Status |
|---------|------|------|-----------|--------|
| foraging | argos3-examples | `Draw(CFootBotEntity&)` | `DrawCylinder` (entity-relative) | ❌ Missing |
| foraging | argos3-examples | `GetFloorColor()` | Floor painting (food zones, nest) | ❌ Missing |
| trajectory | argos3-examples | `DrawInWorld()` | `DrawRay` (waypoint paths) | ✅ Covered by TrailRenderer |
| id | argos3-examples | `Draw(CFootBotEntity&)` | `DrawText` (robot ID) | ✅ Covered by FloatingLabels |
| manualcontrol | argos3-examples | `KeyPressed/Released` | No drawing | N/A |
| E_sync | Canopy | `DrawInWorld()` | `DrawCircle`, `DrawRay`, `DrawText` | ⚠️ Ray+Text covered, Circle missing |
| E_diffusion | Canopy | `DrawInWorld()` | `DrawCircle`, `DrawRay`, `DrawText` | ⚠️ Ray+Text covered, Circle missing |

**Primitives never used in any known experiment:**
`DrawBox`, `DrawTriangle`, `DrawPolygon`, `DrawPoint`, `DrawOverlay(QPainter&)`

## Design

### Approach

Transmit draw commands as JSON arrays in `user_data._draw` (world-space) and
per-entity `_draw` (entity-relative). Client-next reads these arrays and
renders the shapes using Three.js. Floor color data is sent as a low-resolution
color grid in `user_data._floor`.

This approach requires a webviz user_functions class that mirrors the QT
drawing API — researchers call the same methods (`DrawCircle`, `DrawCylinder`,
`DrawRay`, `DrawText`) and the class serializes them as JSON instead of
OpenGL calls.

### Key Decisions

1. **Shape commands via `user_data._draw`** — no protocol changes needed, uses
   existing `user_data` mechanism. World-space shapes go in global `user_data._draw`,
   entity-relative shapes go in per-entity `user_data._draw`.

2. **Mirror the QT API** — `CWebvizDrawFunctions` provides the same method
   signatures as `CQTOpenGLUserFunctions` drawing methods. Researchers port
   experiments by changing the base class and recompiling, not rewriting logic.

3. **Floor as color grid** — send a low-resolution grid (e.g. 64×64) of RGB
   values in `user_data._floor`. Client samples `GetFloorColor()` at grid
   points each tick. Much cheaper than a full texture.

4. **Only implement used primitives** — `DrawCircle`, `DrawCylinder`, floor
   painting. Skip `DrawBox`/`DrawTriangle`/`DrawPolygon`/`DrawPoint` until
   an experiment needs them.

### Shape Command Format

```typescript
// World-space: user_data._draw[]
// Entity-relative: entity.user_data._draw[]

type DrawCommand =
  | { shape: 'circle'; pos: [x,y,z]; radius: number; color: [r,g,b,a]; fill: boolean }
  | { shape: 'cylinder'; pos: [x,y,z]; radius: number; height: number; color: [r,g,b,a] }
  | { shape: 'ray'; start: [x,y,z]; end: [x,y,z]; color: [r,g,b,a]; width: number }
  | { shape: 'text'; pos: [x,y,z]; text: string; color: [r,g,b,a] }
```

### Floor Color Grid Format

```typescript
// user_data._floor
{
  resolution: 64,           // grid cells per axis
  origin: [x, y],           // bottom-left corner (arena min)
  size: [w, h],             // arena dimensions
  colors: string            // base64-encoded RGB bytes (64*64*3)
}
```

### C++ API — `CWebvizDrawFunctions`

```cpp
class CWebvizDrawFunctions : public CWebvizUserFunctions {
public:
  // Mirror QT API — same signatures
  void DrawCircle(const CVector3& pos, const CQuaternion& orient,
                  Real radius, const CColor& color, bool fill, UInt32 vertices);
  void DrawCylinder(const CVector3& pos, const CQuaternion& orient,
                    Real radius, Real height, const CColor& color);
  void DrawRay(const CRay3& ray, const CColor& color, Real width);
  void DrawText(const CVector3& pos, const std::string& text, const CColor& color);

  // Floor painting
  void SetFloorResolution(UInt32 res);  // default 64
  void SampleFloor();                    // calls GetFloorColor() on grid points

  // Per-entity draw context
  void BeginEntityDraw(const std::string& entityId);
  void EndEntityDraw();

protected:
  // Override in subclass for floor painting
  virtual CColor GetFloorColor(Real x, Real y) { return CColor::WHITE; }

  // Serialization — called by framework
  nlohmann::json GetDrawCommands();       // world-space _draw array
  nlohmann::json GetEntityDrawCommands(const std::string& id);
  nlohmann::json GetFloorData();          // _floor grid

private:
  std::vector<nlohmann::json> m_vecWorldDraws;
  std::map<std::string, std::vector<nlohmann::json>> m_mapEntityDraws;
  std::string m_strCurrentEntity;
  UInt32 m_unFloorResolution = 64;
  std::vector<UInt8> m_vecFloorColors;    // RGB bytes
};
```

### Client-Next Components

```typescript
// src/scene/DrawOverlays.tsx
// Reads user_data._draw[] and renders Three.js shapes
interface DrawOverlaysProps {
  drawCommands: DrawCommand[]    // from experimentStore
}

// src/scene/EntityDrawOverlays.tsx
// Reads per-entity user_data._draw[] — rendered inside entity group
interface EntityDrawOverlaysProps {
  commands: DrawCommand[]
}

// src/scene/DynamicFloor.tsx
// Reads user_data._floor and renders as a textured plane
interface DynamicFloorProps {
  floorData: FloorColorGrid      // from experimentStore
  arena: ArenaInfo
}
```

### Integration Points

- `experimentStore` — extract `_draw` and `_floor` from `user_data` on each broadcast
- `Scene.tsx` — add `<DrawOverlays>` and `<DynamicFloor>` components
- `EntityRenderer.tsx` — pass per-entity `_draw` to `<EntityDrawOverlays>`
- Mock server — add `--draw` flag that generates sample draw commands

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/scene/DrawOverlays.tsx` | Does not exist | Create — renders world-space circles, cylinders, rays, text |
| `client-next/src/scene/EntityDrawOverlays.tsx` | Does not exist | Create — renders entity-relative draw commands |
| `client-next/src/scene/DynamicFloor.tsx` | Does not exist | Create — renders floor color grid as texture |
| `client-next/src/scene/Scene.tsx` | Has EntityLinks, TrailRenderer, etc. | Add DrawOverlays, DynamicFloor |
| `client-next/src/entities/EntityRenderer.tsx` | Passes overrideColor | Pass per-entity _draw commands |
| `client-next/src/stores/experimentStore.ts` | Stores userData | Extract _draw and _floor from userData |
| `client-next/src/types/protocol.ts` | Message types | Add DrawCommand, FloorColorGrid types |
| `client-next/src/mock/server.ts` | Mock server | Add --draw flag with sample shapes |
| `src/.../webviz_draw_functions.h` | Does not exist | Create — CWebvizDrawFunctions class |
| `src/.../webviz_draw_functions.cpp` | Does not exist | Create — implementation |
| `docs/DRAW_FUNCTIONS.md` | Does not exist | Create — porting guide from QT to webviz |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| Floor grid resolution | 64×64 | 12KB per frame (64*64*3 bytes base64) |
| Max draw commands per frame | 10000 | Safety limit to prevent browser freeze |
| Circle segments | 32 | Three.js RingGeometry/CircleGeometry |

## Assumptions

- [x] `user_data` can carry arrays of draw commands without exceeding WebSocket frame limits (validated: 10K commands × ~100 bytes = ~1MB, within 100MB backpressure limit)
- [x] Three.js can render 1000+ translucent circles at 60fps (validated: instanced rendering handles this)
- [ ] Base64-encoded floor grid (12KB) adds negligible bandwidth overhead
- [ ] `CWebvizDrawFunctions` can inherit from `CWebvizUserFunctions` without breaking existing user_functions
- [ ] Researchers will accept recompiling with a different base class to get webviz drawing

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-005 (WEBVIZ_EXPOSE can expose draw-relevant state), PN-002 (delta encoding reduces draw command bandwidth)
- **Blocks**: None

## Done When

- [ ] Canopy E_sync renders correctly: comm range circles, key count labels, neighbor links, color gradient
- [ ] Canopy E_diffusion renders correctly: comm range circles, beacon color, neighbor links
- [ ] argos3-examples foraging: food cylinder on carrier, floor zones painted
- [ ] `CWebvizDrawFunctions` provides `DrawCircle`, `DrawCylinder`, `DrawRay`, `DrawText` with same signatures as QT
- [ ] Dynamic floor painting works via `GetFloorColor()` override
- [ ] Mock server `--draw` flag generates sample shapes for testing
- [ ] Draw commands work in both live and replay modes
- [ ] Documentation: porting guide from QT to webviz draw functions

## Verification Strategy

### Success Criteria
- Canopy sync experiment renders identically to QT-OpenGL (circles, links, labels, gradient)
- Floor painting matches QT-OpenGL foraging output at 64×64 resolution
- 1000 circles + 500 links render at ≥30fps

### Regression Checks
- Existing viz features (EntityLinks, FloatingLabels, TrailRenderer, HeatmapOverlay) unchanged
- Experiments without draw commands render identically to before
- Delta encoding still works (draw commands in user_data participate in delta)

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Circle rendering | Unit | Pass circle DrawCommand to DrawOverlays | Circle mesh at correct position/radius |
| Cylinder rendering | Unit | Pass cylinder DrawCommand | Cylinder mesh at correct position |
| Floor grid decode | Unit | Base64 decode 4×4 grid | Correct RGB values |
| Empty draw commands | Unit | Pass empty _draw array | No shapes rendered, no errors |
| Mock server --draw | Integration | Connect to mock with --draw | Circles visible in viewport |
| Performance | Manual | 1000 circles, measure FPS | ≥30fps |
| Malformed commands | Unit | Pass invalid shape type in _draw | Skipped gracefully, no crash |

### Acceptance Threshold
- All unit tests pass
- Canopy sync visual parity confirmed by manual comparison

## Effort Estimate

**Time:** ~4 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 6 |
| Files modified | 5 |
| Lines added/changed | ~600 |
| Complexity | Medium — Three.js shape rendering is straightforward, floor texture requires DataTexture |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| DrawBox/Triangle/Polygon/Point | Investigation | Deferred — no known usage |
| DrawOverlay (2D HUD) | Investigation | Deferred — no protocol equivalent |
| Binary draw command encoding | Investigation | Captured — if JSON overhead is too high |

## Changelog

| Date | Change | Workflow |
|------|--------|---------|
| 2026-04-15 | Initial draft — investigation complete | proposal-create |
| 2026-04-15 | Post-investigation critique — confirmed, proceed | proposal-critique |
| 2026-04-15 | Design complete — shape commands, floor grid, C++ API | proposal-lifecycle |
| 2026-04-15 | Post-design critique — confirmed with 2 improvements (command clearing semantics, malformed command test) | proposal-critique |
| 2026-04-15 | Advanced to IMPLEMENTATION | proposal-lifecycle |
| 2026-04-26 | Status updated to ✅ COMPLETE (housekeeping sync) | Housekeeping |
