# Sending Data from Server

To send custom data from the simulation to the web client, create a user functions class.

## Setup

In your `.argos` file:

```xml
<visualization>
    <webviz>
        <user_functions library="build/libMyFunctions"
                        label="my_functions" />
    </webviz>
</visualization>
```

Subclass `CWebvizUserFunctions` from `argos3/plugins/simulator/visualizations/webviz/webviz_user_functions.h`.

> **Note:** Your library must link against `nlohmann_json` in CMake:
> ```cmake
> target_link_libraries(my_functions nlohmann_json::nlohmann_json)
> ```

## Global data

Override `sendUserData()` to attach data to every broadcast:

```cpp
nlohmann::json sendUserData() override {
    nlohmann::json data;
    data["score"] = m_nScore;
    data["phase"] = m_strPhase;
    return data;
}
```

This appears as `user_data` at the top level of the broadcast message.

## Per-entity data

Register a function for a specific entity type:

```cpp
CMyFunctions::CMyFunctions() {
    RegisterWebvizUserFunction<CMyFunctions, CFootBotEntity>(
        &CMyFunctions::sendRobotData);
}

const nlohmann::json CMyFunctions::sendRobotData(CFootBotEntity& robot) {
    nlohmann::json data;
    data["battery"] = GetBattery(robot);
    data["state"] = GetState(robot);
    return data;
}
```

This appears as `user_data` on each matching entity in the broadcast.

## Filtering

Control what data is sent via XML config:

```xml
<webviz send_entity_data="true"
        send_global_data="true"
        entity_data_fields="battery,state" />
```

| Attribute | Default | Description |
|-----------|---------|-------------|
| `send_entity_data` | true | Include per-entity user_data |
| `send_global_data` | true | Include global user_data |
| `entity_data_fields` | "" (all) | Comma-separated whitelist of per-entity fields |

## Special user_data keys

The client recognizes these reserved keys in global `user_data`:

| Key | Purpose | Documentation |
|-----|---------|---------------|
| `_draw` | Draw primitives (circles, rays, text, cylinders) | [Draw Functions](DRAW_FUNCTIONS.md) |
| `_floor` | Floor color grid | [Draw Functions](DRAW_FUNCTIONS.md) |
| `_ui` | UI controls (buttons, sliders, toggles) | [UI Controls](UI_CONTROLS.md) |

## Example

See [src/testing/loop_functions/user_loop_functions.cpp](../src/testing/loop_functions/user_loop_functions.cpp) for a working example.

For the complete user functions API, see [User Functions](USER_FUNCTIONS.md).
