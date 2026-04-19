# Proposal: Configurable Defaults & Settings Consolidation

Created: 2026-04-19
GitHub Issue: N/A

## Status: 🟡 DESIGN

## Goal

Eliminate magic numbers and hardcoded values across the codebase by
centralizing them into a typed defaults/config system. Expose user-facing
values in the Settings panel. Make the app fully configurable without
code changes.

## Scope Boundary

**In scope:**
- Audit and extract all magic values into named constants or config
- Extend Settings panel with new sections
- Persist settings via localStorage (zustand/persist)

**Out of scope:**
- ❌ Server-side XML config changes (those are already configurable)
- ❌ Theme/color scheme customization (CSS variables, separate concern)
- ❌ Per-experiment config profiles (future)

## Audit Results

### 1. Speed Control (Toolbar)

| Value | Location | Current |
|-------|----------|---------|
| Speed options | `Toolbar.tsx` | `[0.5, 1, 2, 5, 10, 50, 1000]` |
| Infinity threshold | `connectionStore.ts` | `1000` |
| Pause→play delay | `connectionStore.ts` | `50ms` |

### 2. Entity Colors (Renderers + ARGoS C++)

| Value | Location | Current |
|-------|----------|---------|
| Box movable color | `BoxRenderer.tsx`, `box_entity.cpp` | `#4488cc` / `CColor(68,136,204)` |
| Box non-movable color | `BoxRenderer.tsx`, `box_entity.cpp` | `#555566` / `CColor(55,100,155)` |
| Cylinder movable color | `CylinderRenderer.tsx`, `cylinder_entity.cpp` | `#44aa88` / `CColor(68,170,136)` |
| Cylinder non-movable color | `CylinderRenderer.tsx`, `cylinder_entity.cpp` | `#555566` / `CColor(55,120,100)` |
| Box selected color | `BoxRenderer.tsx` | `#8899aa` |
| Cylinder selected color | `CylinderRenderer.tsx` | `#8899aa` |
| FootBot body color | `FootBot.tsx` | `#2a2a3a` |
| FootBot selected color | `FootBot.tsx` | `#5577aa` |
| KheperaIV body color | `KheperaIV.tsx` | `#2a3a4a` |
| KheperaIV selected color | `KheperaIV.tsx` | `#5577aa` |
| KheperaIV cap color | `KheperaIV.tsx` | `#334455` |
| Leo body color | `LeoRenderer.tsx` | `#5a6e5a` |
| Leo selected color | `LeoRenderer.tsx` | `#6e8e6e` |
| Floor fallback color | `FloorRenderer.tsx` | `#333333` |
| Ray hit color | `FootBot.tsx`, `KheperaIV.tsx`, `LeoRenderer.tsx` | `#44ff44` |
| Ray miss color | `FootBot.tsx`, `KheperaIV.tsx`, `LeoRenderer.tsx` | `#ff4444` |
| Selection ring color | `SelectionRing.tsx` | `#44aaff` |
| Selection ring opacity | `SelectionRing.tsx` | `0.8` |
| Trail color | `TrailRenderer.tsx` | `#44aaff` |

### 3. Instanced Entity Defaults

| Value | Location | Current |
|-------|----------|---------|
| KheperaIV radius | `InstancedEntities.tsx` | `0.07` |
| KheperaIV height | `InstancedEntities.tsx` | `0.054` |
| FootBot radius | `InstancedEntities.tsx` | `0.085` |
| FootBot height | `InstancedEntities.tsx` | `0.146` |

### 4. Visualization Defaults (VizConfig)

| Value | Location | Current |
|-------|----------|---------|
| Trail length | `vizConfigStore.ts` | `50` |
| Trail opacity | `vizConfigStore.ts` | `0.6` |
| Heatmap resolution | `vizConfigStore.ts` | `64` |
| Heatmap decay | `vizConfigStore.ts` | `0.98` |
| Heatmap color A | `vizConfigStore.ts` | `#000000` |
| Heatmap color B | `vizConfigStore.ts` | `#ff4400` |
| ColorBy default A | `vizConfigStore.ts` | `#0000ff` |
| ColorBy default B | `vizConfigStore.ts` | `#ff0000` |
| Links default color | `vizConfigStore.ts` | `#44aaff` |
| Links default opacity | `vizConfigStore.ts` | `0.6` |
| Heatmap accumulation rate | `useHeatmapData.ts` | `0.1` |
| Categorical color palette | `colorScales.ts` | 8-color array |

### 5. Camera & Scene

| Value | Location | Current |
|-------|----------|---------|
| Default FOV | `Scene.tsx` | `50` |
| Default camera position | `Scene.tsx` | `[0, -12, 10]` |
| Camera min distance | `CameraController.tsx` | `0.5` |
| Camera max distance multiplier | `CameraController.tsx` | `3× arena` |
| Camera smooth time | `CameraController.tsx` | `0.25` |
| Max polar angle | `CameraController.tsx` | `π/2.05` |
| Arena distance multiplier | `CameraController.tsx` | `1.5` |
| Perspective angle factors | `CameraController.tsx` | `0.8, 0.5, 0.7` |
| Entity follow offset | `CameraController.tsx` | `[1, -1, 1.5]` |

### 6. Lighting

| Value | Location | Current |
|-------|----------|---------|
| Directional light position | `Scene.tsx` | `[-5, 8, 4]` |
| Directional light intensity | `Scene.tsx` | `0.3` |
| Directional light color | `Scene.tsx` | `#aaccff` |
| Hemisphere sky color | `Scene.tsx` | `#ddeeff` |
| Hemisphere ground color | `Scene.tsx` | `#f0eeee` |
| Hemisphere intensity | `Scene.tsx` | `0.4` |
| Shadow camera far | `Scene.tsx` | `50` |

### 7. Connection & Protocol

| Value | Location | Current |
|-------|----------|---------|
| Default WS port | `connectionStore.ts`, `settingsStore.ts` | `3000` |
| Reconnect interval | `connection.ts` | `1000ms` |
| Default channels | `connectionStore.ts` | `['broadcasts','events','logs']` |

### 8. UI Limits

| Value | Location | Current |
|-------|----------|---------|
| Max log entries | `logStore.ts` | `1000` |
| Max event log entries | `EventLogPanel.tsx` | `200` |
| Scale bar update throttle | `ScaleBar.tsx` | `250ms` |
| Tooltip delay | `App.tsx` | `300ms` |
| Panel starting z-index | `panelStore.ts` | `100` |
| Panel snap distance | `FloatingPanel.tsx` | `8px` |
| Panel max height | `FloatingPanel.tsx` | `300px` |
| Panel min/max width | `FloatingPanel.tsx` | `180px / 320px` |

### 9. Video Recording

| Value | Location | Current |
|-------|----------|---------|
| Capture FPS | `videoRecordingStore.ts` | `30` |
| Video bitrate | `videoRecordingStore.ts` | `5,000,000` |

### 10. Fog Distances (per environment)

| Value | Location | Current |
|-------|----------|---------|
| Grid fog | `EnvironmentPreset.tsx` | `near: 50, far: 150` |
| Grass fog | `EnvironmentPreset.tsx` | `near: 30, far: 80` |
| Desert fog | `EnvironmentPreset.tsx` | `near: 40, far: 120` |
| Soccer fog | `EnvironmentPreset.tsx` | `near: 80, far: 200` |
| Football fog | `EnvironmentPreset.tsx` | `near: 80, far: 200` |

### 11. Server-Side Defaults (C++ — XML configurable)

| Value | Location | Current |
|-------|----------|---------|
| Default port | `webviz.cpp` | `3000` |
| Broadcast frequency | `webviz.cpp` | `10 Hz` |
| FF draw frames every | `webviz.cpp` | `2` |
| Keyframe interval | `webviz.cpp` | `100` |
| Real-time factor | `webviz.cpp` | `1.0` |
| Max FF steps | `webviz.cpp` | `1000` |
| Max speed factor | `webviz.cpp` | `1000` |
| Paused sleep | `webviz.cpp` | `250ms` |

## Design

### Approach

1. Create `src/lib/defaults.ts` — single file with all named constants
2. Group by category (colors, timing, camera, limits, etc.)
3. Extend `settingsStore` with user-overridable values (persisted)
4. Extend `SettingsPanel` with sections for each category
5. All components read from defaults or settings store instead of inline values

### Settings Panel Sections

| Section | Settings |
|---------|----------|
| **Connection** | WS URL, reconnect interval (existing) |
| **Rendering** | Shadows, pixel ratio, FOV (existing + new) |
| **Camera** | Min/max distance, smooth time, follow offset |
| **Speed** | Available speed options (editable list) |
| **Entity Colors** | Selected, ray hit/miss, selection ring |
| **Visualization** | Default trail/heatmap/link values |
| **Limits** | Max log entries, max event entries |
| **Recording** | Capture FPS, video bitrate |

### What stays hardcoded

- Environment preset colors (artistic, not configurable)
- Instanced entity dimensions (must match ARGoS physics)
- Protocol field names
- UI layout dimensions (CSS concern)

## Done When

- [ ] `defaults.ts` contains all extracted constants
- [ ] Settings panel has sections for each configurable category
- [ ] All components read from defaults/settings instead of inline values
- [ ] Settings persist across sessions (localStorage)
- [ ] No behavioral change — same defaults as before

## Effort Estimate

**Time:** ~2 FTE-hours

| Metric | Estimate |
|--------|----------|
| Files created | 1 (`defaults.ts`) |
| Files modified | ~20 |
| Lines added/changed | ~300 |
| Complexity | Low — mechanical extraction, no logic changes |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-19 | Initial audit and design |
