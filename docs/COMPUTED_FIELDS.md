# Computed Fields

Client-side derived fields computed from broadcast data. These appear in
viz config field selectors alongside server-provided fields.

## Built-in Fields

All computed field names start with `_`.

| Field | Type | Description | Input |
|-------|------|-------------|-------|
| `_speed` | number | Movement speed (units/tick) | position (current + previous) |
| `_heading` | number | Movement heading (radians) | position (current + previous) |
| `_distance_to_center` | number | Distance to arena center | position, arena |
| `_distance_to_nearest` | number | Distance to nearest entity | all positions |
| `_neighbor_count` | number | Entities within 1m radius | all positions |
| `_led_state` | string | Dominant LED color | leds[] |
| `_led_changed` | boolean | LED color changed since last frame | leds[] (current + previous) |

## Usage

Computed fields are automatically available in the VizConfigPanel dropdowns.
Select them like any other field:

- **Color by** `_speed` → see movement patterns
- **Color by** `_led_state` → see LED-encoded state (synchronization, foraging)
- **Color by** `_distance_to_center` → see spatial distribution
- **Color by** `_neighbor_count` → see clustering density

## How It Works

After each broadcast/schema/delta, the experiment store:
1. Saves the previous entity state
2. Runs all computed field definitions against each entity
3. Stores results in `computedFields` map
4. `vizEngine.discoverFields()` includes computed fields in discovery

No C++ changes needed — computed fields derive from data already in the broadcast.

## Performance

- Fields are computed per-entity per-frame
- `_distance_to_nearest` and `_neighbor_count` are O(n²) — may be slow with 1000+ entities
- Other fields are O(1) per entity
