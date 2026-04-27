# Proposal: User Data Field Pinning / Watch List

Created: 2026-04-26
Baseline Commit: `5cc38ae` (`master`)
GitHub Issue: #57

## Status: 🔵 IMPLEMENTATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Let users pin specific `user_data` fields to a persistent watch list that stays visible regardless of which entity is selected. Currently, user_data is only visible in the entity debug panel for the selected entity — switching entities loses sight of the previous one's data.

## Scope Boundary

**In scope:**
- Pin/unpin individual user_data fields from the entity debug panel
- A "Watch List" panel showing pinned fields across entities, updating live
- Persist pinned fields in local storage across sessions

**Out of scope:**
- ❌ Per-entity-type filtering (server-side, PN-026 territory)
- ❌ Editing user_data values from the client
- ❌ Charting or graphing pinned values over time
- ❌ C++ changes — this is client-only

## Current State

**What exists:**
- `EntityDebugPanel` (`client-next/src/ui/panels/EntityDebugPanel.tsx`) shows user_data for the selected entity via `UserDataView`
- `ExperimentDataPanel` shows global (experiment-level) user_data
- Entity store tracks `selectedEntityId` and `entities` map with all entity data including `user_data`
- `debugPinnedIds` set exists in the store for pinning entity IDs (debug panel feature)

**What's missing:**
- No way to pin individual user_data *fields* (e.g., "always show `counter` for `fb_0`")
- No watch list panel that persists across entity selection changes
- No local storage persistence for pinned fields

## Affected Components

- [ ] C++ plugin (`src/`)
- [ ] Legacy client (`client/`)
- [x] Next client (`client-next/`)
- [ ] Protocol / message format
- [ ] Build system / CMake
- [ ] Documentation

## Design

### Approach

Add a "pin" button next to each user_data field in the entity debug panel. Pinned fields are stored as `{entityId, fieldPath}` tuples. A new "Watch List" floating panel renders all pinned fields by reading from the entities map each tick.

### Key Decisions

1. **Pin at field level, not entity level** — pinning an entity's `counter` field is more useful than pinning all of an entity's data
2. **Watch list is a separate panel** — keeps the debug panel focused on the selected entity
3. **Local storage persistence** — pinned fields survive page reload
4. **Top-level keys only** — consistent with PN-026's filtering approach

### Pseudocode / Steps

```
User clicks pin icon next to "counter" field on entity "fb_0":
  → store adds {entityId: "fb_0", field: "counter"} to pinnedFields set
  → localStorage updated

Watch List panel renders:
  for each {entityId, field} in pinnedFields:
    value = entities.get(entityId)?.user_data?.[field]
    render row: "fb_0.counter = 42"

User clicks unpin:
  → remove from pinnedFields set
  → localStorage updated
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/ui/panels/EntityDebugPanel.tsx` | Shows user_data via UserDataView | Add pin button per field |
| `client-next/src/ui/UserDataView.tsx` | Renders user_data key/value rows | Add pin icon per row |
| `client-next/src/stores/experimentStore.ts` | Has entities map, selectedEntityId | Add pinnedFields state |
| `client-next/src/ui/panels/WatchListPanel.tsx` | Does not exist | New panel for pinned fields |

## Assumptions

- [x] user_data fields are top-level JSON keys (nested pinning not needed initially)
- [ ] UserDataView component renders individual rows that can accept an action button
- [ ] FloatingPanel infrastructure supports adding new panels without layout changes

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-025 (Smart User Data Display)
- **Blocks**: None

## Done When

- [ ] Pin icon appears next to each user_data field in entity debug panel
- [ ] Clicking pin adds field to watch list
- [ ] Watch List panel shows all pinned fields with live values
- [ ] Pinned fields persist across page reload via localStorage
- [ ] Unpinning removes from watch list
- [ ] Pinning a field from a non-existent entity shows "—" gracefully

## Verification Strategy

### Success Criteria
- Pin `counter` on `fb_0`, select `fb_1`, watch list still shows `fb_0.counter` updating

### Regression Checks
- Entity debug panel still works normally without any pins
- ExperimentDataPanel unaffected

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Pin field | Functional | Click pin on user_data field | Appears in watch list |
| Unpin field | Functional | Click unpin | Removed from watch list |
| Persist | Functional | Pin field, reload page | Pin restored |
| Missing entity | Functional | Pin field, entity removed | Shows "—" |
| Build | Automated | npm run build | Clean compile |

### Acceptance Threshold
- All functional tests pass, build clean

## Effort Estimate

**Time:** 2-3 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 1 |
| Files modified | 3 |
| Lines added/changed | ~120 |
| Complexity | Low — client-only state + UI |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| Per-entity-type filtering | PN-026 | FUTURE.md |
| Chart pinned values over time | PN-028 investigation | FUTURE.md candidate |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
