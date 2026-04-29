# Controlling the Experiment

The server accepts JSON commands over the WebSocket connection.

Every command has the format:

```json
{ "command": "<name>", ... }
```

## Simulation Control

### play

Start or resume the experiment.

```json
{ "command": "play" }
```

Only works from `INITIALIZED` or `PAUSED` state.

### pause

Pause the experiment.

```json
{ "command": "pause" }
```

Only works from `PLAYING` or `FAST_FORWARDING` state.

### step

Execute one simulation step, then pause.

```json
{ "command": "step" }
```

### fastforward

Run in fast-forward mode, skipping rendering frames.

```json
{ "command": "fastforward", "steps": 10 }
```

`steps` is optional (default: value of `ff_draw_frames_every` in XML config). Range: [1, 1000].

### speed

Set the real-time speed multiplier.

```json
{ "command": "speed", "factor": 2.0 }
```

`factor` range: (0, 1000]. 1.0 = real-time, 2.0 = 2× speed.

### reset

Reset the experiment to its initial state.

```json
{ "command": "reset" }
```

### terminate

End the experiment.

```json
{ "command": "terminate" }
```

## Entity Manipulation

### moveEntity

Move an entity to a new position and orientation.

```json
{
  "command": "moveEntity",
  "entity_id": "fb0",
  "position": { "x": 1.0, "y": 2.0, "z": 0.0 },
  "orientation": { "x": 0, "y": 0, "z": 0, "w": 1 }
}
```

### addEntity

Spawn a new entity.

```json
{
  "command": "addEntity",
  "type": "foot-bot",
  "id_prefix": "fb",
  "position": { "x": 0, "y": 0, "z": 0 },
  "orientation": { "x": 0, "y": 0, "z": 0, "w": 1 },
  "controller": "my_controller"
}
```

Supported types: `box`, `cylinder`, `foot-bot`, `kheperaiv`.

Additional fields by type:

| Type | Fields |
|------|--------|
| `box` | `size` ({x,y,z}), `movable` (bool), `mass` (float) |
| `cylinder` | `radius`, `height`, `movable`, `mass` |
| `foot-bot` | `controller` (required) |
| `kheperaiv` | `controller` (required) |

### removeEntity

Remove an entity from the simulation.

```json
{
  "command": "removeEntity",
  "entity_id": "fb0"
}
```

### distribute

Spawn multiple entities with randomized placement.

```json
{
  "command": "distribute",
  "type": "foot-bot",
  "id_prefix": "fb",
  "quantity": 20,
  "max_trials": 100,
  "position_method": "uniform",
  "position_params": {
    "min": { "x": -2, "y": -2, "z": 0 },
    "max": { "x": 2, "y": 2, "z": 0 }
  },
  "controller": "my_controller"
}
```

Position methods: `uniform`, `gaussian`, `grid`, `constant`.

## UI Actions

### ui_action

Trigger a UI control registered by user functions.

```json
{
  "command": "ui_action",
  "id": "my_button",
  "type": "button"
}
```

See [UI Controls](UI_CONTROLS.md) for details.

## Custom Commands

Any JSON with an unrecognized `command` value (or no `command` key) is forwarded to the user functions' `HandleCommandFromClient` method.

```json
{
  "command": "my_custom_command",
  "data": [1, 2, 3]
}
```

See [Sending data from client](sending_data_from_client.md).
