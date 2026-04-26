# Proposal: Generic Data Visualization System

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: #4

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Evolve the visualization layer into a composable, config-driven system with
presets grounded in real experiments — so researchers get useful defaults out
of the box and can export/share configurations.

## Scope Boundary

**In scope:**
- Exportable/importable viz config files (`.vizconfig.json`)
- Preset library derived from real Canopy and webviz-examples experiments
- Multi-metric support (color by one field, label by another)
- Formalized `_viz_hints` schema
- Temporal 2D line charts for aggregate metrics

**Out of scope:**
- ❌ Custom shader-based visualizations
- ❌ 3D volume rendering or isosurface plots
- ❌ Python/notebook integration
- ❌ Protocol changes beyond `_viz_hints` formalization

## Current State

**What exists:**
- `vizEngine.ts` — auto-discovers `user_data` fields, classifies types,
  skips `_`-prefixed fields
- `vizConfigStore.ts` — Zustand + localStorage persistence, supports:
  colorBy (linear/categorical), links (neighbor ID array), labels, trails, heatmap
- `VizConfigPanel.tsx` — collapsible sidebar with shadcn controls
- `_viz_hints` support: `applyHints()` reads `colorBy` and `links` from broadcast
- Entity renderers accept `overrideColor` prop
- Scene components: `EntityLinks`, `TrailRenderer`, `HeatmapOverlay`, `FloatingLabels`

**What's missing:**
- Config is localStorage-only — can't share or embed in recordings
- No presets — every experiment starts from scratch
- Only one color-by metric, no size-by
- No temporal plots
- `_viz_hints` schema is informal
- Fields that appear/disappear mid-experiment may cause stale config

## Affected Components

- [x] Next client (`client-next/`) — viz stores, config panel, chart components
- [x] C++ plugin (`src/`) — `_viz_hints` documentation
- [ ] Legacy client (`client/`)
- [ ] Protocol / message format
- [ ] Build system / CMake
- [x] Documentation — viz config schema, hints schema

## Design

### Mapping QT-OpenGL Drawing Primitives to Client-Next

ARGoS3 QT-OpenGL provides 10 drawing primitives across three hooks. Here's
how each maps to client-next capabilities:

| QT-OpenGL Primitive | Signature | Client-Next Equivalent | Status |
|---|---|---|---|
| `DrawCircle` | `(pos, orient, radius, color, fill, vertices)` | `EntityLinks` range circles or new `CircleOverlay` | ⚠️ Partial — links exist, range circles need work |
| `DrawRay` | `(ray, color, width)` | `EntityLinks` lines + sensor `rays` already rendered | ✅ Exists |
| `DrawText` | `(pos, text, color, font)` | `FloatingLabels` component | ✅ Exists |
| `DrawCylinder` | `(pos, orient, radius, height, color)` | Three.js cylinder mesh | ❌ Need generic overlay mesh system |
| `DrawBox` | `(pos, orient, size, color)` | Three.js box mesh | ❌ Need generic overlay mesh system |
| `DrawTriangle` | `(pos, orient, base, height, color, fill)` | Three.js triangle mesh | ❌ Need generic overlay mesh system |
| `DrawPolygon` | `(pos, orient, points, color, fill)` | Three.js shape geometry | ❌ Need generic overlay mesh system |
| `DrawPoint` | `(pos, color, diameter)` | Three.js point sprite | ❌ Need generic overlay mesh system |
| `SetColor` | `(color)` | `overrideColor` prop on entity renderers | ✅ Exists |
| `Draw(CFloorEntity&)` | Floor hook | `FloorRenderer` | ✅ Exists |

**Three QT-OpenGL hooks → Client-Next equivalents:**

| QT Hook | Coordinates | Client-Next Equivalent |
|---|---|---|
| Per-entity `Draw()` | Entity-relative | Entity renderer components (already per-entity) |
| `DrawInWorld()` | World-absolute | Scene-level overlay components (`EntityLinks`, `TrailRenderer`, `HeatmapOverlay`, `FloatingLabels`) |
| `DrawOverlay(QPainter&)` | 2D screen-space | HTML overlay or `drei` Html component |

The key gap is **arbitrary 3D geometry overlays** (circles, cylinders, boxes)
drawn in world coordinates. The existing viz components handle the most common
cases (links=rays, labels=text, trails=position history, heatmap=density), but
experiments that draw comm range circles or food cylinders need a generic
overlay system.

### Viz Presets Grounded in Real Experiments

These presets are derived from actual experiments across three repos:
`Canopy-Experiments/`, `argos3-webviz-examples/`, and `argos3-examples/` (the
standard ARGoS QT-OpenGL examples).

| Preset | Source | colorBy | links | labels | trails | heatmap | Notes |
|---|---|---|---|---|---|---|---|
| **Sync Progress** | Canopy E_sync | `key_count/total_keys` → red→blue | Robots in comm range | `"3/6"` key count | — | — | Matches SyncViz.cpp gradient + hash match ring |
| **Beacon Diffusion** | Canopy E_diffusion | `has_beacon` → blue/red categorical | Robots in comm range | robot ID | ✅ | — | Matches DiffusionViz.cpp |
| **Foraging** | argos3-examples + webviz-examples | `has_food` → categorical | — | — | ✅ | ✅ (food density) | QT draws cylinder on carrier; webviz LF sends `walking_fb`, `collected_food`, `energy` |
| **Health Monitor** | Canopy E_health | `measurement` → gradient | — | `alpha` value | ✅ | — | Poisson-driven writes with Kalman filtering |
| **Trajectory** | argos3-examples trajectory | — | — | robot ID | ✅ (primary) | — | QT draws waypoint rays per robot; our trails feature is the direct equivalent |
| **Flocking** | argos3-examples flocking | `flocking_vector` magnitude → gradient | — | — | ✅ | ✅ (density) | Lennard-Jones interaction; LED color (RED=beacon) is per-entity state |
| **Synchronization** | argos3-examples synchronization | `counter` → gradient | — | — | — | — | Strogatz firefly sync; LED flashes RED at counter overflow — color-by counter value shows wave propagation |
| **Communication Graph** | Any RAB experiment | — | `neighbors` array | — | — | — | Generic: works with any experiment exposing neighbor lists |

### How Presets Map to Experiment Data

The key insight from reading the actual experiments across all three repos:

**Canopy E_sync** — `viz_state.h` exposes `key_count`, `total_keys`, `root_hash`
per robot. SyncViz.cpp draws comm range circles colored by `key_count/total_keys`
(red→blue lerp), white outline when root hash matches robot 0, and rays between
robots in range. The preset should replicate this in client-next.

**Canopy E_diffusion** — `viz_state.h` exposes `has_beacon` per robot.
DiffusionViz.cpp draws comm range circles (blue=no beacon, red=has beacon)
and white rays between robots with different beacon states. Trails would show
the random walk paths.

**argos3-examples trajectory** — `trajectory_loop_functions.cpp` accumulates
per-robot waypoint vectors (position history with MIN_DISTANCE=0.05m filtering).
`trajectory_qtuser_functions.cpp` draws rays between consecutive waypoints.
This is exactly what our `TrailRenderer` already does — the Trajectory preset
just enables trails with appropriate length/opacity defaults.

**argos3-examples foraging** — QT user function draws a black cylinder on
robots carrying food (`sFoodData.HasFoodItem`). The loop function tracks
`walking_fb`, `resting_fb`, `collected_food`, `energy` as aggregate metrics.
The webviz version sends these as JSON via `sendExtraData()`. Per-entity:
color by carrying state. Aggregate: temporal chart for food/energy curves.

**argos3-examples flocking** — Lennard-Jones potential-based flocking toward
a light source. Robots use camera to detect red LED beacons on neighbors.
The interesting viz is the flocking vector magnitude (how strongly each robot
is being pulled) and density heatmap showing flock cohesion.

**argos3-examples synchronization** — Strogatz firefly algorithm. Each robot
has a counter (0-100); when it overflows, LEDs flash RED and counter resets.
Neighbors seeing a flash accelerate their counter. Color-by-counter shows the
synchronization wave propagating through the swarm. This is a great test case
for the categorical/gradient color system.

**Canopy E_health** — Per-robot Poisson-driven writes with alpha/measurement
values. The interesting viz is the measurement convergence over time.

**webviz-examples foraging** — Loop function sends JSON via `sendExtraData()`:
`{step, walking_fb, resting_fb, collected_food, energy}`. This is global data,
not per-entity. The temporal chart is the natural visualization here.

### Viz Config File Format

```json
{
  "version": 1,
  "name": "Sync Progress",
  "colorBy": {
    "enabled": true,
    "field": "key_count",
    "scale": "linear",
    "colorA": "#ff0000",
    "colorB": "#0000ff",
    "normalize": { "field": "total_keys" }
  },
  "links": { "enabled": true, "field": "neighbors", "color": "#44aaff", "opacity": 0.4 },
  "labels": [{ "enabled": true, "field": "key_count", "format": "{key_count}/{total_keys}" }],
  "trails": { "enabled": false, "length": 50, "opacity": 0.6 },
  "heatmap": { "enabled": false }
}
```

Export/import buttons in `VizConfigPanel`. Config can also be embedded in
`.argosrec` headers (see PN-003).

### `_viz_hints` Schema

Formalize what the C++ server can send in `user_data._viz_hints`:

```json
{
  "_viz_hints": {
    "preset": "sync_progress",
    "colorBy": "key_count",
    "normalizeBy": "total_keys",
    "links": "neighbors",
    "labels": ["key_count"]
  }
}
```

If `preset` is specified, it takes precedence. Individual field overrides
are applied on top. Client applies hints once on first broadcast (current
behavior), validates against known field names.

### Multi-Metric Support

Extend `VizConfig`:

```typescript
interface VizConfig {
  colorBy: ColorByConfig | null       // existing
  sizeBy: SizeByConfig | null         // NEW — scale entities by numeric field
  labels: LabelConfig[]               // existing (already supports multiple)
  // ... rest unchanged
}
```

### Temporal Line Charts

New `TimeSeriesPanel` for aggregate metrics (like the foraging example's
`walking_fb`, `collected_food`, `energy`):

- Canvas-based line chart below the 3D viewport
- Ring buffer of last N steps
- Configurable: select fields to plot from discovered `user_data`
- Especially useful for global loop function data that isn't per-entity

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/stores/vizConfigStore.ts` | localStorage persist, single colorBy | Add sizeBy, normalize, export/import, preset loading |
| `client-next/src/lib/vizPresets.ts` | Does not exist | Create — 5 presets based on real experiments |
| `client-next/src/lib/vizEngine.ts` | Field discovery + classification | Add aggregate computation for time series |
| `client-next/src/ui/VizConfigPanel.tsx` | Collapsible config sections | Add preset selector, export/import buttons |
| `client-next/src/ui/TimeSeriesPanel.tsx` | Does not exist | Create — canvas line chart |
| `client-next/src/entities/EntityRenderer.tsx` | Passes `overrideColor` | Add `scale` prop passthrough |
| `docs/VIZ_HINTS.md` | Does not exist | Create — _viz_hints schema reference |

## Assumptions

- [ ] Canopy experiments expose `key_count`, `total_keys`, `has_beacon` via user_data when running with webviz (currently only via `viz_registry` for qt-opengl)
- [ ] argos3-examples experiments (flocking, synchronization, trajectory, foraging) would need webviz user_functions to expose their per-entity state (counter, has_food, flocking_vector) as user_data
- [ ] Canvas-based charting is sufficient (no Recharts/D3 dependency needed)
- [ ] Ring buffer of ~1000 steps is enough for temporal plots
- [ ] Preset fields are discoverable at runtime (presets gracefully degrade if fields missing)
- [ ] `sizeBy` scaling works with instanced rendering

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-003 (viz config embedded in .argosrec header), PN-005 (computed fields appear in presets)
- **Blocks**: None

## Open Questions

- Canopy experiments currently use `viz_registry` (a C++ global) for qt-opengl
  visualization. To work with webviz, this data needs to be sent as `user_data`
  in the WebSocket broadcast. Should this be a webviz user_functions implementation,
  or should the controllers write to user_data directly?
- Should temporal plots support both per-entity and global (loop function) data?
- Performance ceiling for trails + heatmap with 1000+ entities?
- Should presets be loadable from URL parameters (for sharing links)?

## Done When

- [ ] At least 5 presets selectable from dropdown, based on real experiment data
- [ ] Viz config exportable as `.vizconfig.json` and importable via file picker
- [ ] `sizeBy` scales entities by a numeric field
- [ ] Temporal line chart shows aggregate metrics over time
- [ ] `_viz_hints` schema documented in `docs/VIZ_HINTS.md`
- [ ] Presets gracefully degrade when required fields are missing
- [ ] Existing viz features still work unchanged

## Effort Estimate

| Component | Time |
|---|---|
| Preset library (8 presets from real experiments) | 1.5 hours |
| Export/import config | 30 min |
| sizeBy support (store + renderers) | 45 min |
| TimeSeriesPanel (canvas chart) | 1.5 hours |
| _viz_hints documentation | 20 min |
| Testing with mock server + Canopy data | 45 min |
| **Total** | **~5.5 hours** |
| 2026-04-26 | Status updated to ✅ COMPLETE (housekeeping sync) | Housekeeping |
