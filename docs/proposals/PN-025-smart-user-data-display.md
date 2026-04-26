# Proposal: Smart User Data Display

Created: 2026-04-26
Baseline Commit: `7d8eb56` (`master`)
GitHub Issue: #51

## Status: 🟣 VERIFICATION

## Goal

Replace raw JSON dumps of per-entity `user_data` with auto-discovered, formatted key/value rows in the sidebar inspector and debug panel. Make controller data immediately readable without requiring users to parse JSON visually.

## Scope Boundary

**In scope:**
- Auto-discover user_data field names from entity data
- Render scalar fields (number, string, boolean) as formatted rows
- Render arrays/objects as collapsed summaries with expand-on-click
- Replace raw JSON dump in sidebar inspector
- Replace raw JSON dump in debug panel's User Data section
- Handle missing/changing fields gracefully

**Out of scope:**
- ❌ C++ side changes — no changes to how data is sent
- ❌ Global user_data (ExperimentData panel) — already has its own display
- ❌ Field pinning / watch list (future enhancement)
- ❌ Time series / charting of values

## Current State

**What exists:**
- Sidebar inspector: raw `JSON.stringify(entity.user_data, null, 2)` in a `<pre>` block
- Debug panel: same raw JSON dump in User Data section
- ExperimentData panel: auto-formats global user_data as key/value rows (good pattern to follow)
- VizEngine: already discovers user_data field names for color-by selectors

**What's missing:**
- Per-entity user_data shown as readable rows
- Collapsed summaries for complex values (arrays, nested objects)
- No JSON.stringify on every render frame

## Design

### Approach

Create a `UserDataView` component that recursively renders user_data as key/value rows. Use it in both the sidebar inspector and debug panel, replacing the raw JSON `<pre>` blocks.

### Key Decisions

1. **Scalars inline, complex values collapsed** — numbers/strings/booleans show the value directly. Arrays show `[N items]`, objects show `{N keys}`, expandable on click.
2. **Reuse ExperimentDataPanel's `formatValue`** — same formatting logic for consistency.
3. **No memoization needed** — only renders for the one selected entity, not all entities.
4. **Depth limit** — nested expansion capped at 3 levels to prevent runaway rendering.

### Pseudocode / Steps

```
UserDataView({ data }):
  if data is null/undefined → show "—"
  if data is not object → show formatValue(data)
  for each [key, value] in Object.entries(data):
    if value is scalar → Row(key, formatValue(value))
    if value is array → CollapsibleRow(key, `[${value.length} items]`, expanded: UserDataView(value))
    if value is object → CollapsibleRow(key, `{${Object.keys(value).length} keys}`, expanded: UserDataView(value))
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/ui/UserDataView.tsx` | Does not exist | Create — recursive user_data renderer |
| `client-next/src/ui/Sidebar.tsx` | Raw JSON dump | Use UserDataView |
| `client-next/src/ui/panels/EntityDebugPanel.tsx` | Raw JSON dump | Use UserDataView |

## Assumptions

- [x] user_data is always a JSON object or undefined
- [x] Only one entity's user_data rendered at a time (selected entity)
- [x] Field names are stable across ticks (same controller sends same fields)

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-024 (Entity Inspection Panel)
- **Blocks**: None

## Done When

- [ ] Scalar user_data fields shown as formatted key/value rows
- [ ] Arrays shown as collapsed `[N items]` with expand
- [ ] Nested objects shown as collapsed `{N keys}` with expand
- [ ] Depth limited to 3 levels
- [ ] Sidebar inspector uses UserDataView instead of raw JSON
- [ ] Debug panel uses UserDataView instead of raw JSON
- [ ] Build passes

## Verification Strategy

### Success Criteria
- Select entity with user_data → see readable rows, not JSON blob

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Scalar fields | Visual | Select entity with user_data | Numbers, strings shown as rows |
| Array field | Visual | Entity with array in user_data | Shows `[N items]`, expands on click |
| Nested object | Visual | Entity with nested object | Shows `{N keys}`, expands on click |
| No user_data | Visual | Select box entity | No user data section shown |
| Build | Automated | `npx vite build` | Clean build |

## Effort Estimate

**Time:** 1-2 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 1 |
| Files modified | 2 |
| Lines added/changed | ~80 |
| Complexity | Low — recursive component, simple logic |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
