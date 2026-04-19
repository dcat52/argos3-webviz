# Proposal: Viewport Polish — Camera, Scale Bar, Fog, Environments

Created: 2026-04-15
Baseline Commit: `c55a30a` (`client-next`)
GitHub Issue: N/A

## Status: ✅ COMPLETE

## Goal

Improve the viewport experience with better camera defaults, a metric scale
bar, fog control, and real-world environment presets (soccer/football fields).

## Scope Boundary

**In scope:**
- Camera: dynamic maxDistance based on arena, better default zoom
- Scale bar: fixed-position metric ruler in bottom-left corner
- Fog: off by default, toggle in toolbar
- Environment presets: soccer (105×68m) and American football (109.7×48.8m)

**Out of scope:**
- ❌ Keyboard shortcuts (separate PN)
- ❌ HUD overlay beyond scale bar (separate PN)

## Changes (already implemented)

| File | Change |
|------|--------|
| `CameraController.tsx` | `maxDistance` scales with arena (3×), default zoom 1.5× |
| `EnvironmentPreset.tsx` | Fog conditional on `showFog`, `SoccerEnv`, `FootballEnv` |
| `ScaleBar.tsx` | New — metric ruler, zustand store, fixed DOM overlay |
| `Scene.tsx` | Wire `ScaleBarUpdater` + `ScaleBarOverlay` |
| `sceneSettingsStore.ts` | `showFog` / `toggleFog` (default: off) |
| `Toolbar.tsx` | Fog toggle button, soccer/football in env selector |

## Done When

- [x] Camera zoom limit scales with arena size
- [x] Default view shows all agents
- [x] Scale bar fixed 16px from bottom-left corner
- [x] Scale bar shows correct metric units at all zoom levels
- [x] Fog off by default, toggleable
- [x] Soccer field with regulation markings
- [x] American football field with yard lines and numbers

## Effort Estimate

**Time:** ~1 FTE-hour (already done)

| Metric | Estimate |
|--------|----------|
| Files created | 1 |
| Files modified | 5 |
| Lines added/changed | ~240 |
| Complexity | Low |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-15 | Implemented during Canopy integration session |
