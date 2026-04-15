# .argosrec File Format

JSON-lines format produced by `CWebvizRecorder` and consumed by client-next.

## Extensions

- `.argosrec` — uncompressed JSON-lines
- `.argosrec.gz` — gzip-compressed JSON-lines

## Structure

Each line is a self-contained JSON object. Lines are separated by `\n`.

### Line 1: Header (v2+)

```json
{
  "type": "header",
  "version": 2,
  "every_n_steps": 1,
  "delta": true
}
```

Optional fields: `created`, `total_steps`, `arena`, `entity_types`, `_viz_hints`.

v1 files have no header — the first line is the schema.

### Line 2: Schema

Full entity state + arena configuration.

```json
{
  "type": "schema",
  "step": 0,
  "arena": { "size": {"x":10,"y":10,"z":1}, "center": {"x":0,"y":0,"z":0.5} },
  "entities": [ ... ]
}
```

### Lines 3+: Delta or Full

**Delta mode** (`delta: true`): only changed entities/fields.

```json
{
  "type": "delta",
  "step": 1,
  "entities": { "r0": { "position": {"x":1,"y":2,"z":0} } }
}
```

**Full mode** (`delta: false`): complete entity state every frame.

```json
{
  "type": "full",
  "step": 1,
  "state": "EXPERIMENT_PLAYING",
  "entities": [ ... ]
}
```

## Client Loading

1. Detect `.gz` extension → decompress with pako/zlib
2. Split into lines, parse each as JSON
3. Line 1: if `type === "header"`, extract metadata; otherwise treat as schema
4. First schema: configure arena, set initial entity state
5. Subsequent frames: store for replay

## XML Configuration

```xml
<webviz_recorder output="experiment.argosrec.gz"
                 every_n_steps="1"
                 autostart="true"
                 delta="true" />
```
