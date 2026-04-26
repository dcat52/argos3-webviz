# Proposal: Feature Registry

Created: 2026-04-26
Baseline Commit: `0ce264b` (`feat/pn-019-entity-manipulation`)
GitHub Issue: N/A

## Status: ✅ COMPLETE

## Goal

Provide a feature flag system that lets experimental features be toggled on/off without code changes, so the UI only shows polished features by default while keeping experimental work accessible for development.

## Scope Boundary

**In scope:**
- Feature registry store with registerFeature/useFeature API
- Master "Experimental Features" toggle
- Per-feature individual toggles
- Feature gate component for conditional rendering
- Settings panel UI for feature management
- localStorage persistence
- Gating existing experimental features

**Out of scope:**
- ❌ Per-experiment feature overrides from .argos XML
- ❌ Dynamic plugin loading / code splitting
- ❌ Server-side feature flags
- ❌ Workspace presets (broader concept — future proposal)

## Affected Components

- [x] Next client (`client-next/`)

## Design

### Approach

A zustand store holds a registry of feature definitions and their enabled state. Features register at module scope via `registerFeature()`. UI components gate rendering with `useFeature(id)` or `<Feature id="...">`. A master toggle flips all experimental features at once; individual toggles allow per-feature disable.

### Key Decisions

1. **Module-scope registration** — features register on import, no central manifest file needed
2. **Experimental defaults ON** — during development, everything is visible; flip master off for demos
3. **Master + individual** — master toggle for quick all-on/all-off, individual toggles for fine-grained control
4. **localStorage persistence** — survives refresh, no server dependency

## Key File References

| File | Purpose |
|------|---------|
| `src/stores/featureStore.ts` | Registry store, registerFeature, useFeature, toggleFeature, master toggle |
| `src/stores/features.ts` | Feature definitions (6 experimental features registered) |
| `src/ui/Feature.tsx` | Gate component — renders children only when feature enabled |
| `src/ui/SettingsPanel.tsx` | Features section with master + individual toggles |
| `src/ui/InteractionToolbar.tsx` | Distribute mode gated |
| `src/ui/VizConfigPanel.tsx` | Color-by, trails, heatmap, presets sections gated |
| `src/ui/SpawnPalette.tsx` | Batch spawn section gated |
| `src/scene/Scene.tsx` | TrailRenderer, HeatmapOverlay gated |

## Done When

- [x] Feature registry store with register/toggle/persist
- [x] Master experimental toggle enables/disables all experimental features
- [x] Individual per-feature toggles when master is ON
- [x] Settings panel shows features with experimental badge
- [x] 6 features gated: distribute, color-by, heatmap, trails, batch-spawn, viz-presets
- [x] Preferences persist across refresh via localStorage
- [x] No regressions — 87 tests pass, tsc clean

## Effort Estimate

**Time:** ~1.5 hours

| Metric | Actual |
|--------|--------|
| Files created | 3 |
| Files modified | 5 |
| Lines added/changed | ~140 |
| Complexity | Low |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Implemented: store, gate component, 6 features registered, settings UI, master toggle | ✅ COMPLETE |
