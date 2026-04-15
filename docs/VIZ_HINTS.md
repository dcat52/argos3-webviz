# `_viz_hints` Schema

Visualization hints sent by the C++ server in `user_data._viz_hints` to
configure client-next's visualization layer automatically.

## Location

Hints are sent as part of the global `user_data` in broadcast/schema messages:

```json
{
  "type": "broadcast",
  "user_data": {
    "_viz_hints": { ... }
  }
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset ID to load (e.g. `"sync_progress"`, `"foraging"`). Takes precedence over individual fields. |
| `colorBy` | `string` | Field name for color-by-metric (linear scale) |
| `normalizeBy` | `string` | Field name to normalize colorBy values (e.g. `"total_keys"`) |
| `links` | `string` | Field name containing neighbor ID arrays |
| `labels` | `string[]` | Field names to display as floating labels |

## Behavior

- Hints are applied **once** on the first broadcast received
- If `preset` is specified, the matching preset config is loaded
- Individual field overrides are applied on top of the preset
- If a referenced field doesn't exist in `user_data`, the hint is ignored
- Hints do not override user-modified config (only applied if no config exists)

## Available Presets

| ID | Name | Required Fields |
|----|------|----------------|
| `sync_progress` | Sync Progress | `key_count`, `total_keys`, `neighbors` |
| `beacon_diffusion` | Beacon Diffusion | `has_beacon`, `neighbors` |
| `foraging` | Foraging | `has_food` |
| `trajectory` | Trajectory | (none) |
| `communication_graph` | Communication Graph | `neighbors` |
| `density` | Density Map | (none) |
| `none` | None | (none) |

## Example: C++ User Functions

```cpp
nlohmann::json CMyUserFunctions::sendUserData() {
  nlohmann::json data;
  data["_viz_hints"]["preset"] = "sync_progress";
  data["_viz_hints"]["colorBy"] = "key_count";
  data["_viz_hints"]["normalizeBy"] = "total_keys";
  data["_viz_hints"]["links"] = "neighbors";
  return data;
}
```

## Viz Config File (`.vizconfig.json`)

Configs can be exported/imported via the UI:

```json
{
  "version": 1,
  "colorBy": { "enabled": true, "field": "key_count", "scale": "linear", "colorA": "#ff0000", "colorB": "#0000ff" },
  "links": { "enabled": true, "field": "neighbors", "color": "#44aaff", "opacity": 0.4 },
  "labels": [{ "enabled": true, "field": "key_count" }],
  "trails": { "enabled": false, "length": 50, "opacity": 0.6 },
  "heatmap": { "enabled": false, "resolution": 64, "decay": 0.98, "colorA": "#000000", "colorB": "#ff4400" }
}
```
