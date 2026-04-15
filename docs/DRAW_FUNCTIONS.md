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

1. Your `DrawInWorld()` is called before each broadcast
2. Each `DrawCircle`/`DrawCylinder`/etc. call serializes the shape as JSON
3. Shapes are sent in `user_data._draw` array
4. Client-next renders them as Three.js meshes
5. Draw buffer is cleared after each broadcast

## Floor Painting

Override `GetFloorColor()` — same as the QT-OpenGL loop functions hook:

```cpp
CColor CMyViz::GetFloorColor(Real f_x, Real f_y) {
    // Return color at world position (f_x, f_y)
    if (IsInNest(f_x, f_y)) return CColor::GRAY;
    if (IsFood(f_x, f_y)) return CColor::BLACK;
    return CColor::WHITE;
}
```

The floor is sampled on a 64×64 grid (configurable via `SetFloorResolution()`).

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
