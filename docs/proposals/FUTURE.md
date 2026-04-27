# Future Ideas

Ideas discovered during development that don't yet have proposals.

---

## Polish / Improvements

### Distribute Spawn UX
The distribute spawn mode works but needs UX polish — click-to-set-center, visual bounds indicator, better parameter layout.

### Entity Rotation
Post-spawn rotation handle or angle slider in the inspector. Drag-to-aim works for spawn, but no way to rotate an already-placed entity without re-spawning.

### Workspace Presets
Broader preset concept: bundle camera position, viz settings, panel layout, feature flags into named configurations. Current viz-only presets are a narrow first version.

## Experimental Feature Graduation
These are behind feature flags and need polish before becoming stable:
- **Color-by** — works for agents now, needs better UX for field selection
- **Heatmap** — decent, needs performance tuning for large swarms
- **Trails** — decent, works as-is
- **Distribute** — functional but UX needs work
- **Viz Presets** — depends on other experimental features

### User Data Field Pinning / Watch List
~~Pin specific user_data fields to always show in the inspector, even when switching entities. Discovered during PN-025.~~
→ **Proposal PN-028 created** (#57)

### Per-Entity-Type User Data Filtering
Filter user_data by entity type in the `.argos` config (e.g., only send for foot-bots). Discovered during PN-026.

## External / Out of Scope
- **Spiri entity** — external plugin, not in this repo
- **glTF foot-bot model** — upgrade from procedural to loaded model (nice-to-have, current procedural model is functional)
- **ARGoS core: post-physics sensor re-read** — a hook in the ARGoS simulator to let visualizations request sensor data recomputed after physics steps. Would give "true" post-physics rays but requires changes to the ARGoS core repo. The local webviz fix (PN-022) handles the visual mismatch without this. Discovered during PN-022 investigation.
