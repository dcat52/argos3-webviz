# Proposal: Floating Panel System

Created: 2026-04-15
Baseline Commit: `c55a30a` (`client-next`)
GitHub Issue: N/A

## Status: ✅ COMPLETE

## Goal

A reusable draggable panel component that serves as the foundation for HUD,
experiment data, entity inspector, and event log — all using the same
underlying system.

## Scope Boundary

**In scope:**
- `<FloatingPanel>` component: draggable, collapsible, pinnable to corners
- Panel store: manage open panels, positions, pinned state
- Sim HUD panel (default, always available): step, entity count, sim state
- Experiment Data panel: auto-discover and display `user_data` keys
- Entity Inspector panel: show selected entity's `user_data` on click
- Event Log panel: render `user_data._events` as accumulated milestones
- Global toggle to show/hide all entity widgets

**Out of scope:**
- ❌ Entity-attached 3D widgets (separate PN-015 — different rendering concerns)
- ❌ Charts / graphs inside panels (future enhancement)
- ❌ Panel persistence across sessions (localStorage — future)

## Design

### FloatingPanel Component

```tsx
<FloatingPanel
  id="sim-hud"
  title="Simulation"
  defaultPosition={{ pin: 'bottom-right' }}  // or { x, y }
  collapsible
  closable={false}  // HUD can't be closed
>
  <PanelKeyValue data={entries} />
</FloatingPanel>
```

Behavior:
- Drag by title bar → free-floating at pixel position
- Snap zones at corners (8px from edge) → pins to that corner
- Collapse button → shrinks to title bar only
- Close button (optional) → removes from viewport
- Z-order: last-clicked panel comes to front

### Panel Store (Zustand)

```ts
interface PanelState {
  id: string
  open: boolean
  collapsed: boolean
  position: { x: number; y: number } | { pin: Corner }
  zIndex: number
}
```

Store manages all panel instances. Panels register on mount, unregister
on unmount. Position updates are local state (no re-render of other panels).

### Panel Types

**1. Sim HUD** (built-in, always available)
- Source: `experimentStore` — step, entity count, sim state
- Default: pinned bottom-right, collapsed by default
- Cannot be closed

**2. Experiment Data** (auto-populated)
- Source: `experimentStore.userData` — top-level keys excluding `_draw`, `_events`, `_viz_hints`
- Auto-discovers fields, renders as key-value pairs
- Numbers get formatted, objects get JSON-collapsed
- Default: pinned top-right

**3. Entity Inspector** (on selection)
- Source: selected entity's position, orientation, `user_data`
- Opens when an entity is selected, closes on deselect
- Default: pinned right, vertically centered

**4. Event Log** (milestone feed)
- Source: `user_data._events` array
- Each event: `{ step, label, type: 'info'|'success'|'warning' }`
- Events accumulate silently in the log panel
- Toast/banner only shown if event includes `"toast": true`
- Default: pinned bottom-left (above scale bar)

### Data Flow

```
ARGoS C++ (user_data)
  → WebSocket broadcast
    → experimentStore.userData
      → Experiment Data panel (auto-discover keys)
      → Event Log panel (_events array)

experimentStore (step, entities, state)
  → Sim HUD panel

selectedEntity.user_data
  → Entity Inspector panel
```

### Toolbar Integration

Add a "Panels" dropdown to the toolbar:
- ☑ Simulation HUD
- ☑ Experiment Data
- ☐ Entity Inspector (auto-opens on select)
- ☑ Event Log

Toggle visibility per panel.

## Key File References

| File | Change |
|------|--------|
| `src/ui/FloatingPanel.tsx` | New — core draggable panel component |
| `src/stores/panelStore.ts` | New — panel state management |
| `src/ui/panels/SimHudPanel.tsx` | New — step, count, state |
| `src/ui/panels/ExperimentDataPanel.tsx` | New — auto-discover user_data |
| `src/ui/panels/EntityInspectorPanel.tsx` | New — selected entity details |
| `src/ui/panels/EventLogPanel.tsx` | New — milestone feed |
| `src/ui/Toolbar.tsx` | Add panels dropdown |
| `src/scene/Scene.tsx` | Mount panel layer |

## C++ Side (Experiment Authors)

No changes required to the webviz plugin. Experiment authors just populate
`user_data` in their `sendUserData()` override:

```cpp
const nlohmann::json sendUserData() override {
    nlohmann::json data;

    // Auto-displayed in Experiment Data panel
    data["avg_health"] = computeAvgHealth();
    data["converged"] = allHashesMatch();
    data["messages_sent"] = totalMessages;

    // Rendered in Event Log panel
    if (justConverged) {
        data["_events"] = {{
            {"step", currentStep},
            {"label", "All robots converged"},
            {"type", "success"}
        }};
    }

    // Draw commands (existing)
    data["_draw"] = draws;

    return data;
}
```

## Done When

- [ ] FloatingPanel supports drag, collapse, pin-to-corner, close
- [ ] Sim HUD shows step/count/state, pinned bottom-right
- [ ] Experiment Data auto-discovers user_data keys
- [ ] Entity Inspector opens on entity select
- [ ] Event Log renders _events, toast only when `toast: true`
- [ ] Panels dropdown in toolbar to toggle visibility
- [ ] Panels don't interfere with 3D interaction (pointer-events passthrough)

## Effort Estimate

**Time:** ~3 FTE-hours

| Metric | Estimate |
|--------|----------|
| Files created | 6 |
| Files modified | 2 |
| Lines added/changed | ~400 |
| Complexity | Medium — drag logic, z-ordering, auto-discovery |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-15 | Initial design from Canopy integration discussion |
