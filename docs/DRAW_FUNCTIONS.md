# Draw Functions — Porting from QT-OpenGL to Webviz

## Quick Start

Replace your QT-OpenGL user functions base class:

```cpp
// Before (QT-OpenGL)
#include <argos3/plugins/simulator/visualizations/qt-opengl/qtopengl_user_functions.h>
class CMyViz : public CQTOpenGLUserFunctions {

// After (Webviz)
#include <webviz/webviz_draw_functions.h>
class CMyViz : public argos::Webviz::CWebvizDrawFunctions {
```

The drawing methods have **identical signatures**:

| Method | Parameters |
|--------|-----------|
| `DrawCircle` | `(pos, orient, radius, color, fill, vertices)` |
| `DrawCylinder` | `(pos, orient, radius, height, color)` |
| `DrawRay` | `(ray, color, width)` |
| `DrawText` | `(pos, text, color)` |

## How It Works

1. Override `DrawInWorld()` to draw world-space shapes each tick
2. Each `DrawCircle`/`DrawCylinder`/etc. call buffers the shape as JSON
3. The framework calls `PreBroadcast()` automatically before each WebSocket broadcast
4. Shapes are injected into `user_data._draw`, floor data into `user_data._floor`
5. Client-next renders them as Three.js meshes
6. Draw buffer is cleared after each broadcast

No manual wiring needed — just subclass `CWebvizDrawFunctions` and override `DrawInWorld()`.

## Floor Painting

Override `GetFloorColor()` — same as the QT-OpenGL loop functions hook:

```cpp
CColor CMyViz::GetFloorColor(Real f_x, Real f_y) {
    if (IsInNest(f_x, f_y)) return CColor::GRAY;
    if (IsFood(f_x, f_y)) return CColor::BLACK;
    return CColor::WHITE;
}
```

The floor is sampled on a 64×64 grid (configurable via `SetFloorResolution()`).
It samples once on startup, then only when you call `SetFloorChanged()`:

```cpp
void CMyViz::PostStep() {
    // Call when the floor colors need to be re-sampled
    SetFloorChanged();
}
```

## Per-Entity Drawing

For entity-relative shapes (like the foraging food cylinder), use the
per-entity `Call()` hook and include shapes in the entity's `user_data`:

```cpp
const nlohmann::json CMyViz::EntityData(CFootBotEntity& c_entity) {
    nlohmann::json j;
    if (HasFood(c_entity)) {
        j["_draw"] = {{
            {"shape", "cylinder"},
            {"pos", {0.0, 0.0, 0.3}},  // entity-relative
            {"radius", 0.1},
            {"height", 0.05},
            {"color", {0, 0, 0, 255}}
        }};
    }
    return j;
}
```

## Shape Command Format

```json
{ "shape": "circle", "pos": [x,y,z], "radius": r, "color": [r,g,b,a], "fill": true }
{ "shape": "cylinder", "pos": [x,y,z], "radius": r, "height": h, "color": [r,g,b,a] }
{ "shape": "ray", "start": [x,y,z], "end": [x,y,z], "color": [r,g,b,a], "width": w }
{ "shape": "text", "pos": [x,y,z], "text": "label", "color": [r,g,b,a] }
```

Colors are `[red, green, blue, alpha]` with values 0-255.

## XML Configuration

```xml
<webviz port="3000">
  <user_functions label="my_viz" library="libmy_viz" />
</webviz>
```
