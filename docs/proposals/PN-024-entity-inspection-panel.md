# Proposal: Entity Inspection Panel

Created: 2026-04-26
Baseline Commit: `37dc671` (`master`)
GitHub Issue: #48

## Status: 🟣 VERIFICATION

## Goal

Two-tier entity inspection: an enhanced compact inspector in the sidebar for quick-glance info, and a full debug floating panel with all entity data for deep inspection. Matches the progressive disclosure philosophy of the render tiers system.

## Scope Boundary

**In scope:**
- Enhancing the sidebar Inspector with computed fields summary (speed, heading)
- A "Debug Panel" floating panel showing all entity data in organized sections
- Button in sidebar inspector to open the debug panel
- Live-updating values in both tiers

**Out of scope:**
- ❌ Hover tooltips in the 3D viewport
- ❌ Editing entity properties from the panel
- ❌ Adding new computed fields (use existing ones)
- ❌ Changes to the floating panel system itself

## Current State

**What exists:**
- Sidebar `Inspector` component: ID, type, position, orientation, LED count, user_data JSON dump
- Debug pin button (toggles floating label in 3D)
- FloatingLabels: shows computed fields as bars/badges above entities
- FloatingPanel system: draggable, collapsible, pinnable panels
- Computed fields: _speed, _heading, _distance_to_center, _distance_to_nearest, _neighbor_count, _led_state, _led_changed
- Entity data: position, orientation, LEDs, rays, points, user_data, type-specific fields

**What's missing:**
- Computed fields not shown in sidebar inspector
- No way to see all entity data in one organized view
- Sensor rays/points not inspectable
- LED colors not visualized in inspector

## Design

### Approach

**Tier 1 — Enhanced Sidebar Inspector:**
- Add computed fields row: speed + heading (most useful at a glance)
- Keep existing: ID, type, position, orientation, LED count, user_data
- Add "Open Debug Panel" button

**Tier 2 — Debug Floating Panel:**
- Opens as a FloatingPanel when button clicked (or debug pin toggled)
- Sections (all collapsible):
  - **Identity**: ID, type
  - **Transform**: position, orientation (formatted)
  - **Computed Fields**: all 7 fields with live values
  - **LEDs**: color swatches for each LED
  - **Sensors**: ray count, hit/miss summary
  - **User Data**: formatted JSON tree
  - **Raw State**: full entity JSON dump

### Key Decisions

1. **Reuse FloatingPanel** — don't build a new panel system
2. **Panel follows selection** — when you select a different entity, the debug panel updates to show that entity
3. **One debug panel instance** — not one per entity (keeps UI clean)
4. **Sidebar inspector stays minimal** — just add speed/heading, don't bloat it

### Pseudocode / Steps

```
1. Create EntityDebugPanel component using FloatingPanel
   - Reads selectedEntityId from experimentStore
   - Reads entity data + computed fields
   - Renders collapsible sections for each data category

2. Enhance sidebar Inspector
   - Add speed/heading from computed fields
   - Add "Open Debug Panel" button that opens the panel via panelStore

3. Register the panel in Layout.tsx alongside existing panels
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/ui/panels/EntityDebugPanel.tsx` | Does not exist | Create — full debug floating panel |
| `client-next/src/ui/Sidebar.tsx` | Basic inspector | Add computed fields summary + debug panel button |
| `client-next/src/ui/Layout.tsx` | Renders existing panels | Add EntityDebugPanel |

## Assumptions

- [x] FloatingPanel system supports dynamic content updates
- [x] Computed fields are available per entity via experimentStore
- [ ] Panel can be opened/closed via panelStore.setOpen()

## Dependencies

- **Requires**: None
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] Sidebar inspector shows speed and heading for selected entity
- [ ] "Open Debug Panel" button in sidebar opens a floating panel
- [ ] Debug panel shows all entity data in organized collapsible sections
- [ ] Debug panel updates when selecting a different entity
- [ ] LED colors shown as swatches in debug panel
- [ ] Computed fields shown with live-updating values
- [ ] User data shown as formatted JSON
- [ ] Build passes

## Verification Strategy

### Success Criteria
- Select an entity → sidebar shows enhanced info + debug button
- Click debug button → floating panel opens with full entity data
- Select different entity → panel updates

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Sidebar enhancement | Visual | Select a robot | Speed/heading shown |
| Debug panel open | Visual | Click debug button | Panel opens with sections |
| Panel follows selection | Visual | Select different entity | Panel content updates |
| Non-robot entity | Visual | Select a box | Shows relevant fields only |
| Build | Automated | `npx vite build` | Clean build |

## Effort Estimate

**Time:** 2-3 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 1 |
| Files modified | 2 |
| Lines added/changed | ~150 |
| Complexity | Low — UI component using existing data and panel system |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
| 2026-04-26 | Implementation complete, build verified | 🔵 IMPLEMENTATION |
