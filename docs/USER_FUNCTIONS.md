# Implementing Webviz User Functions

Complete guide to creating webviz user functions in an external project. Covers sending experiment data, per-entity data, draw commands, floor painting, UI controls, and the full CMake/XML setup.

## Overview

Webviz user functions are C++ classes that run inside the ARGoS simulator and send custom data to the web client over WebSocket. They let you:

- Send **experiment-level data** (global stats, weights, status)
- Send **per-entity data** (robot-specific metrics, controller state)
- Draw **shapes in the 3D scene** (circles, rays, text labels, cylinders)
- Paint the **floor** with dynamic colors
- Declare **UI controls** (buttons, sliders, toggles) that appear in the browser
- Handle **commands from the client** (custom interactions)

## Project Structure

A typical external project that uses webviz user functions:

```
my-experiment/
├── src/
│   ├── CMakeLists.txt
│   ├── controllers/
│   │   └── my_controller.cpp/.h
│   ├── loop_functions/
│   │   ├── CMakeLists.txt
│   │   ├── MyLoopFunctions.cpp/.h      # ARGoS loop functions (data collection)
│   │   └── MyWebviz.cpp/.h             # Webviz user functions (visualization)
│   ├── libs/
│   │   └── viz_state.h                 # Shared data between controller and viz
│   └── experiments/
│       └── my_experiment.argos
├── build/
└── argos3-webviz/                      # webviz repo (submodule or sibling)
```

## Step 1: Shared Data Between Controller and Viz

The controller runs per-robot. The webviz user functions run once per tick for the whole experiment. To bridge them, use a shared registry:

```cpp
// libs/viz_state.h
#pragma once
#include <unordered_map>
#include <string>

namespace myproject {

struct VizState {
    int item_count = 0;
    float health = 1.0f;
    std::string status = "idle";
};

// Global registry: robot_id → viz state
inline std::unordered_map<int, VizState>& viz_registry() {
    static std::unordered_map<int, VizState> reg;
    return reg;
}

} // namespace myproject
```

In your controller, write to the registry each tick:

```cpp
// controllers/my_controller.cpp
#include "../libs/viz_state.h"

void CMyController::ControlStep() {
    // ... controller logic ...

    // Update viz state for this robot
    auto& state = myproject::viz_registry()[m_nRobotId];
    state.item_count = m_nItems;
    state.health = m_fHealth;
    state.status = m_bForaging ? "foraging" : "exploring";
}
```

## Step 2: Create the Webviz User Functions Class

### Header

```cpp
// loop_functions/MyWebviz.h
#ifndef MY_WEBVIZ_H
#define MY_WEBVIZ_H

#include <argos3/plugins/simulator/visualizations/webviz/webviz_user_functions.h>
#include <argos3/plugins/robots/foot-bot/simulator/footbot_entity.h>

using namespace argos;

class CMyWebviz : public CWebvizUserFunctions {
public:
    CMyWebviz();
    virtual ~CMyWebviz() {}

    void Init(TConfigurationNode& t_tree) override;

    // Global experiment data (sent every tick)
    const nlohmann::json sendUserData() override;

    // Per-entity data (called for each foot-bot)
    const nlohmann::json EntityData(CFootBotEntity& c_entity);

    // Handle commands from the web client
    void HandleCommandFromClient(
        const std::string& str_ip, nlohmann::json c_command) override;

private:
    Real m_fCommRange = 3.0;
};

#endif
```

### Implementation

```cpp
// loop_functions/MyWebviz.cpp
#include "MyWebviz.h"

#include <argos3/core/simulator/simulator.h>
#include <argos3/core/simulator/space/space.h>
#include <argos3/core/utility/configuration/argos_configuration.h>
#include "../libs/viz_state.h"

/****************************************/

CMyWebviz::CMyWebviz() {
    // Register per-entity function for foot-bots
    RegisterWebvizUserFunction<CMyWebviz, CFootBotEntity>(
        &CMyWebviz::EntityData);
}

/****************************************/

void CMyWebviz::Init(TConfigurationNode& t_tree) {
    // Read config from <user_functions> XML attributes
    GetNodeAttributeOrDefault(t_tree, "comm_range", m_fCommRange, m_fCommRange);
}

/****************************************/

const nlohmann::json CMyWebviz::sendUserData() {
    // This runs once per tick. Return experiment-level data.
    auto& reg = myproject::viz_registry();

    int nTotal = 0;
    float fAvgHealth = 0;
    for (auto& [id, state] : reg) {
        nTotal += state.item_count;
        fAvgHealth += state.health;
    }
    if (!reg.empty()) fAvgHealth /= reg.size();

    nlohmann::json data;
    data["total_items"] = nTotal;
    data["avg_health"] = fAvgHealth;
    data["num_robots"] = reg.size();

    // Draw commands (optional — see "Drawing Shapes" section)
    nlohmann::json draws = nlohmann::json::array();
    // ... add draw commands ...
    if (!draws.empty()) data["_draw"] = draws;

    return data;
}

/****************************************/

const nlohmann::json CMyWebviz::EntityData(CFootBotEntity& c_entity) {
    // This runs for each foot-bot. Return per-robot data.
    int rid = 0;
    for (char c : c_entity.GetId())
        if (c >= '0' && c <= '9') rid = rid * 10 + (c - '0');

    auto& reg = myproject::viz_registry();
    if (!reg.count(rid)) return nullptr;

    auto& state = reg[rid];
    return {
        {"items", state.item_count},
        {"health", state.health},
        {"status", state.status}
    };
}

/****************************************/

void CMyWebviz::HandleCommandFromClient(
    const std::string& str_ip, nlohmann::json c_command) {
    // Handle custom commands from the web client
    std::string cmd = c_command.value("action", "");
    if (cmd == "reset_items") {
        for (auto& [id, state] : myproject::viz_registry())
            state.item_count = 0;
    }
}

/****************************************/

// This macro registers the class with ARGoS's plugin system.
// The label must match the "label" attribute in the .argos XML.
REGISTER_WEBVIZ_USER_FUNCTIONS(CMyWebviz, "MyWebviz")
```

## Step 3: Drawing Shapes

Add draw commands to the `_draw` array in `sendUserData()`:

```cpp
nlohmann::json draws = nlohmann::json::array();

// Communication range circle around each robot
for (auto& [id, entity] : tEntities) {
    CVector3 pos = GetPosition(entity);
    draws.push_back({
        {"shape", "circle"},
        {"pos", {pos.GetX(), pos.GetY(), 0.01}},
        {"radius", m_fCommRange},
        {"color", {100, 150, 255, 40}},  // RGBA 0-255
        {"fill", true}
    });
}

// Line between two robots
draws.push_back({
    {"shape", "ray"},
    {"start", {x1, y1, 0.02}},
    {"end",   {x2, y2, 0.02}},
    {"color", {255, 255, 255, 255}},
    {"width", 2.0}
});

// Text label
draws.push_back({
    {"shape", "text"},
    {"pos", {x, y, 0.15}},
    {"text", "42 keys"},
    {"color", {0, 0, 0, 255}}
});

data["_draw"] = draws;
```

Available shapes: `circle`, `cylinder`, `ray`, `text`. See [DRAW_FUNCTIONS.md](DRAW_FUNCTIONS.md) for the full reference.

### Alternative: CWebvizDrawFunctions

For a cleaner API (matching QT-OpenGL), subclass `CWebvizDrawFunctions` instead:

```cpp
#include <argos3/plugins/simulator/visualizations/webviz/webviz_draw_functions.h>

class CMyViz : public argos::Webviz::CWebvizDrawFunctions {
    void DrawInWorld() override {
        DrawCircle(pos, orient, radius, CColor::RED, true);
        DrawRay(ray, CColor::WHITE, 2.0);
        DrawText(pos, "label", CColor::BLACK);
    }
};
```

This auto-injects `_draw` and `_floor` — no manual JSON needed.

## Step 4: UI Controls

Declare interactive controls that appear in the browser:

```cpp
CMyWebviz::CMyWebviz() {
    RegisterWebvizUserFunction<CMyWebviz, CFootBotEntity>(
        &CMyWebviz::EntityData);

    // These appear as a "Controls" panel in the web client
    AddButton("reset", "Reset Items", [this]() {
        for (auto& [id, state] : myproject::viz_registry())
            state.item_count = 0;
    });

    AddSlider("comm_range", "Comm Range", 1.0, 20.0, 3.0,
        [this](Real v) { m_fCommRange = v; });

    AddToggle("show_links", "Show Links", true,
        [this](bool v) { m_bShowLinks = v; });
}
```

See [UI_CONTROLS.md](UI_CONTROLS.md) for the full API reference.

## Step 5: CMake Setup

```cmake
# loop_functions/CMakeLists.txt

# Find the webviz library (installed by argos3-webviz)
find_library(WEBVIZ_LIB argos3plugin_simulator_webviz
    PATHS /usr/local/lib/argos3)

if(WEBVIZ_LIB)
    add_library(MyWebviz MODULE MyWebviz.cpp)

    # Find nlohmann_json headers
    # Option A: installed system-wide
    # Option B: from the webviz build tree
    find_path(NLOHMANN_INCLUDE_DIR nlohmann/json.hpp
        PATHS /usr/local/include
              ${CMAKE_SOURCE_DIR}/../argos3-webviz/build/nlohmann_json-src/single_include)
    if(NLOHMANN_INCLUDE_DIR)
        target_include_directories(MyWebviz PRIVATE ${NLOHMANN_INCLUDE_DIR})
    endif()

    target_link_libraries(MyWebviz
        argos3core_simulator
        argos3plugin_simulator_entities
        argos3plugin_simulator_genericrobot
        argos3plugin_simulator_footbot        # or _kheperaiv
        argos3plugin_simulator_webviz)

    message(STATUS "Webviz found: MyWebviz enabled")
else()
    message(STATUS "Webviz not found: MyWebviz will not build")
endif()
```

Key points:
- Link against `argos3plugin_simulator_webviz` (provides `CWebvizUserFunctions`)
- Link against the robot plugin for your entity type (`_footbot`, `_kheperaiv`, etc.)
- Include `nlohmann/json.hpp` headers (bundled with webviz or installed separately)
- Build as `MODULE` (shared library loaded at runtime by ARGoS)

## Step 6: XML Configuration

```xml
<argos-configuration>
  <!-- ... controllers, arena, physics ... -->

  <visualization>
    <webviz port="3000" broadcast_frequency="10" real_time_factor="0">
      <user_functions
          library="build/loop_functions/libMyWebviz"
          label="MyWebviz"
          comm_range="5.0" />
    </webviz>
  </visualization>
</argos-configuration>
```

- `library` — path to the `.so` file (without extension)
- `label` — must match the string in `REGISTER_WEBVIZ_USER_FUNCTIONS`
- Additional attributes (like `comm_range`) are passed to `Init()`

## Step 7: Build and Run

```bash
# Build (inside apptainer if using a container)
mkdir -p build && cd build
cmake ../src -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)

# Run with webviz
ARGOS_PLUGIN_PATH=build argos3 -c src/experiments/my_experiment.argos

# Open browser to http://localhost:3000
```

Or with the `launch_viz.sh` helper:

```bash
./launch_viz.sh my_experiment --webviz --numrobots 20 --envwidth 10
```

## Data Flow Summary

```
Controller (per robot, per tick)
  → writes to viz_registry()

Webviz User Functions (once per tick)
  → reads viz_registry()
  → sendUserData() returns JSON with:
      - experiment stats (shown in Experiment Data panel)
      - _draw commands (rendered as 3D shapes)
      - _ui controls (rendered as interactive widgets)
  → EntityData() returns per-robot JSON (shown in entity inspector)

WebSocket broadcast
  → client receives and renders everything
```

## Tips

- **Keep sendUserData() fast** — it runs on the simulation thread every tick. Avoid heavy computation.
- **Use _draw sparingly** — hundreds of draw commands per tick is fine; thousands may impact performance.
- **Separate viz from logic** — the webviz class should only read state, never modify simulation behavior. Keep mutation in loop functions or controllers.
- **Test without webviz** — your experiment should work with `<qt-opengl />` or headless. The webviz user functions are an optional visualization layer.
- **Config via XML** — use `GetNodeAttributeOrDefault` in `Init()` for parameters like comm range, so you can tune without recompiling.
