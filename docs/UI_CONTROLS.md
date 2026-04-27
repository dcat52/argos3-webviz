# UI Controls — Custom Loop Function Widgets

Declare buttons, sliders, toggles, and dropdowns from C++ that render in the web client. The web-native equivalent of QT-OpenGL's ability to add Qt widgets from loop functions.

## Quick Start

```cpp
#include <webviz/webviz_user_functions.h>

class CMyFunctions : public CWebvizUserFunctions {
 public:
  CMyFunctions() {
    AddButton("reset", "Reset Swarm", [this]() { OnReset(); });

    AddSlider("speed", "Max Speed", 0, 100, 50,
              [this](Real v) { m_fSpeed = v; });

    AddToggle("trails", "Show Trails", false,
              [this](bool v) { m_bTrails = v; });

    AddDropdown("mode", "Behavior", {"explore", "forage", "cluster"}, "explore",
                [this](const std::string& v) { m_strMode = v; });
  }

 private:
  void OnReset() { /* reset logic */ }
  Real m_fSpeed = 50;
  bool m_bTrails = false;
  std::string m_strMode = "explore";
};
```

A "Controls" panel appears automatically in the web client when any controls are registered. No panel is shown if no controls are declared.

## API Reference

### AddButton

```cpp
void AddButton(const std::string& id, const std::string& label,
               std::function<void()> callback);
```

Renders a clickable button. Callback fires on click.

### AddSlider

```cpp
void AddSlider(const std::string& id, const std::string& label,
               Real min, Real max, Real value,
               std::function<void(Real)> callback);
```

Renders a range slider. Callback receives the new value on change.

### AddToggle

```cpp
void AddToggle(const std::string& id, const std::string& label,
               bool value, std::function<void(bool)> callback);
```

Renders a checkbox toggle. Callback receives the new boolean state.

### AddDropdown

```cpp
void AddDropdown(const std::string& id, const std::string& label,
                 const std::vector<std::string>& options,
                 const std::string& value,
                 std::function<void(const std::string&)> callback);
```

Renders a dropdown select. Callback receives the selected option string.

### SetControlValue

```cpp
void SetControlValue(const std::string& id, const nlohmann::json& value);
```

Update a control's displayed value from C++. The change is reflected in the client on the next broadcast tick.

```cpp
// Example: update slider after internal logic changes the value
m_fSpeed = ComputeNewSpeed();
SetControlValue("speed", m_fSpeed);
```

## How It Works

1. Call `Add*()` methods in your constructor (or `Init()`) to register controls
2. Each broadcast tick, registered controls are serialized as `user_data._ui`
3. The client renders them in a floating "Controls" panel
4. User interactions send `{"command": "ui_action", "control_id": "...", "value": ...}` via WebSocket
5. The framework dispatches to the registered callback on the simulation thread

## Protocol

Controls are sent as a JSON array in `user_data._ui`:

```json
{
  "user_data": {
    "_ui": [
      {"type": "button", "id": "reset", "label": "Reset Swarm"},
      {"type": "slider", "id": "speed", "label": "Max Speed", "min": 0, "max": 100, "value": 50},
      {"type": "toggle", "id": "trails", "label": "Show Trails", "value": false},
      {"type": "dropdown", "id": "mode", "label": "Behavior", "options": ["explore", "forage"], "value": "explore"}
    ]
  }
}
```

Client sends back:

```json
{"command": "ui_action", "control_id": "reset"}
{"command": "ui_action", "control_id": "speed", "value": 75}
{"command": "ui_action", "control_id": "trails", "value": true}
{"command": "ui_action", "control_id": "mode", "value": "forage"}
```

## XML Configuration

No special XML needed — controls are declared in C++ code. Use the standard user functions setup:

```xml
<webviz port="3000">
  <user_functions label="my_functions" library="libmy_functions" />
</webviz>
```

## Combining with Draw Functions

UI controls work with both `CWebvizUserFunctions` and `CWebvizDrawFunctions`. If you need both drawing primitives and UI controls, subclass `CWebvizDrawFunctions` and call `Add*()` in your constructor — both features compose naturally.
