# WEBVIZ_EXPOSE

One-line macro for exposing controller internal state to the webviz client.

## Quick Start

```cpp
#include <webviz/webviz_expose.h>

void CMyController::Init(TConfigurationNode& t_node) {
    // ... existing init ...
    WEBVIZ_EXPOSE(m_unCounter, "counter");
    WEBVIZ_EXPOSE(m_bHasFood, "has_food");
    WEBVIZ_EXPOSE(m_fBattery, "battery");
}
```

In your `.argos` XML:

```xml
<webviz port="3000">
  <user_functions label="webviz_auto_expose"
                  library="libwebviz_auto_expose" />
</webviz>
```

That's it. `counter`, `has_food`, and `battery` will appear as per-entity
fields in the client-next visualization panel.

## How It Works

1. `WEBVIZ_EXPOSE(member, name)` registers a lambda that reads the member
   variable, keyed by the entity's ID
2. The generic `webviz_auto_expose` user_functions class reads the registry
   on each `Call()` and serializes all exposed fields as `user_data`
3. Client-next auto-discovers the fields via `vizEngine.discoverFields()`

## Supported Types

Any type that `nlohmann::json` can serialize:
- `int`, `unsigned int`, `float`, `double`
- `bool`
- `std::string`
- `std::vector<T>` (becomes JSON array)

## Extended State (No Controller Changes)

For entity component state (wheel speeds, battery, gripper), use the
`extended_state` XML attribute instead:

```xml
<webviz port="3000" extended_state="true" />
```

This adds fields like `wheel_speeds`, `battery`, `gripper_lock` to the
broadcast automatically — no controller changes needed.

## Reset Handling

Call `webviz::clearRegistry()` in your controller's `Reset()` if you
re-register fields in `Init()`. The auto_expose user_functions handles
this automatically.
