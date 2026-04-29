# Writing a Custom Client

ARGoS3-Webviz streams simulation state over WebSockets. You can build a client in any language that supports WebSockets.

## Connecting

Connect to `ws://<host>:<port>` (default: `ws://localhost:3000`).

### Topic Subscription

By default, clients subscribe to all topics. To subscribe selectively, pass topic names as the query string:

```
ws://localhost:3000?broadcasts,events,logs     # all (same as default)
ws://localhost:3000?broadcasts                 # state only, no events/logs
ws://localhost:3000?broadcasts.bin,events      # msgpack binary + events
```

Available topics:

| Topic | Format | Content |
|-------|--------|---------|
| `broadcasts` | JSON text | Simulation state (entities, arena, user_data) |
| `broadcasts.bin` | MessagePack binary | Same content as `broadcasts`, binary encoded |
| `events` | JSON text | State change events (play, pause, done) |
| `logs` | JSON text | LOG and LOGERR messages |

**Note:** `broadcasts` and `broadcasts.bin` carry the same data in different formats. Subscribe to one, not both.

## Message Types

Every message has a `type` field.

### broadcast (non-delta mode)

Full simulation state. Sent at `broadcast_frequency` Hz.

```json
{
  "type": "broadcast",
  "state": "EXPERIMENT_PLAYING",
  "steps": 1234,
  "timestamp": 1584200000000,
  "real_time_ratio": 1.0,
  "arena": {
    "size": { "x": 5, "y": 5, "z": 1 },
    "center": { "x": 0, "y": 0, "z": 0.5 }
  },
  "entities": [
    {
      "type": "foot-bot",
      "id": "fb0",
      "position": { "x": 1.0, "y": 0.5, "z": 0.0 },
      "orientation": { "x": 0, "y": 0, "z": -0.98, "w": 0.17 },
      "leds": ["0x000000", "0xff0000", ...],
      "rays": ["false:0.08,0.01,0.06:0.18,0.02,0.06", ...],
      "points": [],
      "user_data": { ... }
    },
    {
      "type": "box",
      "id": "wall_north",
      "position": { "x": 0, "y": 2, "z": 0 },
      "orientation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "scale": { "x": 4, "y": 0.1, "z": 0.5 },
      "is_movable": false
    }
  ],
  "user_data": { ... }
}
```

### schema (delta mode)

Full entity state. Sent on first frame and every `keyframe_interval` steps.

```json
{
  "type": "schema",
  "state": "EXPERIMENT_PLAYING",
  "steps": 0,
  "timestamp": 1584200000000,
  "arena": { ... },
  "entities": [ ... ]
}
```

Same structure as `broadcast` — the full entity array.

### delta (delta mode)

Only changed fields since last frame. Entities keyed by ID.

```json
{
  "type": "delta",
  "state": "EXPERIMENT_PLAYING",
  "steps": 1235,
  "timestamp": 1584200000001,
  "entities": {
    "fb0": { "position": { "x": 1.1, "y": 0.6, "z": 0.0 } },
    "fb3": { "position": { "x": -0.5, "y": 1.2, "z": 0.0 }, "leds": ["0xff0000", ...] }
  },
  "removed": ["fb7"]
}
```

To reconstruct state: start from the last `schema`, then merge each `delta` on top. The `removed` array lists entity IDs that no longer exist.

### event

State change notifications.

```json
{
  "type": "event",
  "event": "Experiment paused",
  "state": "EXPERIMENT_PAUSED"
}
```

States: `EXPERIMENT_INITIALIZED`, `EXPERIMENT_PLAYING`, `EXPERIMENT_PAUSED`, `EXPERIMENT_FAST_FORWARDING`, `EXPERIMENT_DONE`.

### log

Accumulated log messages.

```json
{
  "type": "log",
  "timestamp": 1584640119430,
  "messages": [
    { "log_type": "LOG", "log_message": "Entity added: fb_0", "step": 100 },
    { "log_type": "LOGERR", "log_message": "Collision detected", "step": 100 }
  ]
}
```

## Sending Commands

Send JSON messages to control the simulation. See [Controlling the Experiment](controlling_experiment.md) for the full command reference.

```json
{ "command": "play" }
{ "command": "step" }
{ "command": "moveEntity", "entity_id": "fb0", "position": { "x": 1, "y": 2, "z": 0 }, "orientation": { "x": 0, "y": 0, "z": 0, "w": 1 } }
```

## Entity Types

Each entity type has specific fields beyond the common `type`, `id`, `position`, `orientation`:

| Type | Extra Fields |
|------|-------------|
| `foot-bot` | `leds` (12 hex colors), `rays`, `points` |
| `kheperaiv` | `leds`, `rays`, `points` |
| `Leo` | `rays`, `points` |
| `box` | `scale` ({x,y,z}), `is_movable`, `leds` (optional) |
| `cylinder` | `height`, `radius`, `is_movable`, `leds` (optional) |
| `light` | `color` (hex) |
| `floor` | `floor_image` (base64, optional) |

## MessagePack

Subscribe to `broadcasts.bin` for binary MessagePack encoding. The message structure is identical to JSON — just binary-encoded. Use any MessagePack decoder library.

Size reduction is typically 25-50% compared to JSON.
