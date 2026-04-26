# Proposal: Render Tiers

Created: 2026-04-26
Baseline Commit: `4d45882` (`master`)
GitHub Issue: N/A

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Introduce a 3-tier rendering system for robot entities so users can control the level of visual detail based on what they need to see — swarm-level overview, individual robot anatomy, or per-robot sensor debug visualization.

## Scope Boundary

**In scope:**
- Three render tiers: Overview, Standard, Debug
- Global default tier setting
- Selected entity auto-promotes to at least Standard
- Per-entity debug pin (Tier 3 for specific robots)
- FootBot renderer conditionally renders geometry per tier
- KheperaIV renderer same pattern
- Instanced rendering = Overview tier by definition
- Settings UI for global tier

**Out of scope:**
- ❌ Camera FOV cone rendering (needs server-side camera params — future)
- ❌ RAB communication range visualization (needs server-side RAB config)
- ❌ Hover-to-inspect sensor readings
- ❌ Per-entity tier override UI beyond debug pin

## Current State

**What exists:**
- `InstancedEntities.tsx` — instanced cylinders for >30 robots (Tier 1 equivalent)
- `FootBot.tsx` — enhanced procedural model with turret, gripper, wheels, scanner ring, LEDs, proximity rays (mix of Tier 2 and 3)
- `KheperaIV.tsx` — simple cylinder with LEDs and rays (same mix)
- Individual rendering path in `SceneEntities` for ≤30 robots with full click handlers
- Instanced path with invisible hit mesh for >30 robots
- No concept of render tier — rays always render, no way to toggle

**What's missing:**
- Tier concept / store
- Conditional geometry in renderers based on tier
- Global tier setting in UI
- Per-entity debug pin
- Transition logic: when does instanced vs individual kick in?

## Affected Components

- [x] Next client (`client-next/`)

## Design

### Approach

A `renderTier` setting in the settings store controls the global default. Each entity renderer receives an effective tier computed from: global default, selection state, and debug pin list. Renderers conditionally include geometry based on tier.

### Tier Definitions

| Tier | Name | Geometry | When |
|------|------|----------|------|
| 1 | Overview | Body shape + LEDs | Global default = Overview, or instanced (>threshold) |
| 2 | Standard | + turret, gripper, wheels, scanner ring | Global default = Standard, or selected entity |
| 3 | Debug | + proximity rays, velocity vector, state label | Explicitly pinned, or global default = Debug |

### Key Decisions

1. **Tiers are a view mode, not a performance optimization.** A user with 5 robots may want Overview; a user with 100 may want Debug on one robot. The threshold for instanced vs individual rendering is separate from the tier.

2. **Selected entity auto-promotes.** If global is Overview, clicking a robot shows it at Standard. If global is Standard, clicking shows Debug. This gives progressive disclosure without manual toggling.

3. **Debug is per-entity pinnable.** A "debug" toggle in the inspector sidebar pins a robot to Tier 3 regardless of global setting. Multiple robots can be pinned.

4. **Instanced rendering is always Tier 1.** You can't instance complex multi-mesh geometry. When global is Standard or Debug, the instanced threshold drops (or instancing is disabled) so robots render individually.

5. **Tier prop flows through EntityRenderer.** `EntityRenderer` computes the effective tier and passes it to the specific renderer. No store subscription inside renderers.

### Pseudocode / Steps

```
1. Add to settingsStore: renderTier: 'overview' | 'standard' | 'debug'
2. Add to experimentStore: debugPinnedIds: Set<string>
3. In SceneEntities, compute effectiveTier per entity:
   - If debugPinnedIds.has(id) → 3
   - If selectedEntityId === id → min(globalTier + 1, 3)
   - Else → globalTier
4. If globalTier >= 2, disable instanced rendering (all individual)
   If globalTier === 1, use instanced for groups > threshold
5. Pass tier to EntityRenderer → renderer
6. In FootBot/KheperaIV:
   tier >= 1: body + LEDs
   tier >= 2: + turret, gripper, wheels, scanner ring
   tier >= 3: + rays, debug overlays
7. Add tier selector to settings or floating toolbar
8. Add "Debug" toggle to entity inspector sidebar
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/stores/settingsStore.ts` | General settings | Add `renderTier` |
| `src/stores/experimentStore.ts` | Entity state, selection | Add `debugPinnedIds` |
| `src/scene/Scene.tsx` | SceneEntities with individual/instanced split | Compute effective tier, pass to renderers |
| `src/scene/InstancedEntities.tsx` | Instanced rendering for robots | Conditional on global tier |
| `src/entities/renderers/FootBot.tsx` | Full model + rays always | Conditional geometry per tier |
| `src/entities/renderers/KheperaIV.tsx` | Simple model + rays always | Same |
| `src/entities/EntityRenderer.tsx` | Dispatches to type-specific renderer | Pass tier prop |
| `src/ui/SettingsPanel.tsx` | Settings UI | Add tier selector |
| `src/ui/Sidebar.tsx` | Entity inspector | Add debug pin toggle |

## Assumptions

- [x] FootBot and KheperaIV are the only robot types needing tiered rendering
- [x] Leo renderer can follow the same pattern later
- [ ] Proximity rays are the primary Tier 3 content (camera FOV and RAB range need server data)

## Dependencies

- **Requires**: None
- **Enhanced by**: Entity inspection panel (future), camera FOV server data
- **Blocks**: None

## Done When

- [x] Global render tier setting (Overview / Standard / Debug) in settings
- [x] FootBot renders conditionally: body+LEDs (T1), +model detail (T2), +rays (T3)
- [x] KheperaIV same pattern
- [x] Selected entity auto-promotes one tier
- [x] Debug pin toggle in entity inspector
- [x] Instanced rendering disabled when global tier ≥ Standard
- [x] No regressions — tests pass, tsc clean

## Verification Strategy

### Success Criteria
- Switch to Overview → all robots are simple cylinders, no rays
- Switch to Standard → all robots show detailed model, no rays
- Click a robot in Overview → it shows detailed model
- Pin a robot to Debug → it shows rays, others don't
- Switch to Debug → all robots show rays
- 100+ robots in Overview → smooth 60fps (instanced)

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Tier switching | Functional | Toggle global tier in settings | All robots change detail level |
| Auto-promote | Functional | In Overview, click a robot | Selected robot shows Standard detail |
| Debug pin | Functional | Pin robot in inspector, switch to Overview | Pinned robot shows rays, others don't |
| Performance | Visual | 100 robots in Overview vs Standard | Overview uses instancing, Standard is individual |

## Effort Estimate

**Time:** ~4 FTE-hours

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | ~8 |
| Lines added/changed | ~150 |
| Complexity | Medium — conditional rendering logic, tier computation, settings wiring |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial investigation — tier concept, design, file references | 📋 INVESTIGATION |
| 2026-04-26 | Implemented: tier setting, conditional renderers, auto-promote, debug pin, settings UI | ✅ COMPLETE |
