# Proposal: Multi-Experiment Dashboard

Created: 2026-04-19
GitHub Issue: N/A

## Status: 🟣 VERIFICATION

## Goal

View multiple running ARGoS experiments simultaneously from a single browser
tab. Browse a cluster of experiments (e.g., 100 running on a cluster),
selectively tune into 1–8 at a time, in a read-only viewer mode.

## Scope Boundary

**In scope:**
- Multi-viewport layout (1, 2, 4, 8 panes)
- Each pane connects to a different experiment URL
- Read-only viewer mode (no play/pause/step controls)
- Experiment browser: list available experiments, click to tune in
- Pane-level connection management (connect/disconnect/swap)

**Out of scope:**
- ❌ Controlling experiments (play/pause/step/reset) from the dashboard
- ❌ Launching experiments from the browser
- ❌ Aggregated statistics across experiments
- ❌ Synchronized playback across experiments

## Critique Results

### Validated

- ✅ All stores are global Zustand singletons (confirmed 11 stores)
- ✅ `connectionStore.onMessage` writes directly to global `experimentStore`
- ✅ No routing exists (no react-router dependency, no URL param parsing)
- ✅ Component tree matches the proposal's description
- ✅ Option C (iframe) is the fastest path for Phase 1
- ✅ `settingsStore` and `sceneSettingsStore` can remain shared

### Issues Found

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| C1 | WebGL context limit: 8 panes = 8 contexts. Chrome limit ~16 per domain, shared across same-origin iframes. Feasible but tight. | ⚠️ Medium | Add context-lost handler; document max-pane guidance |
| C2 | Same-origin iframes share localStorage. `settingsStore` (key: `argos-settings`) and `vizConfigStore` (key: `viz-config`) use `persist` middleware — all panes would read/write the same keys. | 🔴 High | Viewer mode must disable persist OR use per-pane storage keys |
| C3 | App auto-connects on mount (`App.tsx` useEffect). For viewer mode, the ws URL must be parameterized *before* mount, not after. | 🔴 High | Read `?ws=` param in `connect()` before falling back to default |
| C4 | `videoRecordingStore` and `canvasRefStore` not listed in coupling table | 🟢 Low | Added to table below |
| C5 | 8 iframes = 8× JS bundle (~1-2MB each). Acceptable for desktop. | 🟢 Low | Document; consider lazy loading |
| C6 | No mention of how dashboard page gets served — needs route or separate entry point | ⚠️ Medium | Use URL param `?mode=dashboard` (no router needed) |
| C7 | `react-resizable-panels` in Layout.tsx conflicts with iframe approach | 🟢 Low | Dashboard uses its own grid layout, not the existing Layout |
| C8 | No URL param parsing exists anywhere — prerequisite for both viewer and dashboard modes | 🔴 High | Add minimal URL param utility as first implementation step |

### Amended Assumptions

- [~] Browser can handle 4–8 WebGL contexts simultaneously
  - Validated: Chrome ~16 per domain (shared across same-origin iframes), Firefox/Safari ~16 per page
  - 8 panes is feasible but leaves no headroom; recommend 4 as default, 8 as max
- [ ] Network can handle 4–8 WebSocket streams at 10–30 fps
- [ ] Experiments expose WebSocket on accessible URLs from viewer machine

## Current Architecture Assessment

### Coupling Analysis (Updated)

| Store | Singleton? | Multi-instance ready? | Persisted? |
|-------|-----------|----------------------|-----------|
| `connectionStore` | ✅ Global | ❌ One connection | No |
| `experimentStore` | ✅ Global | ❌ One experiment | No |
| `logStore` | ✅ Global | ❌ One log stream | No |
| `recordingStore` | ✅ Global | ❌ One recording | No |
| `settingsStore` | ✅ Global | ✅ Shared is fine | **Yes** (`argos-settings`) |
| `sceneSettingsStore` | ✅ Global | ✅ Shared is fine | No |
| `cameraStore` | ✅ Global | ❌ One camera | No |
| `panelStore` | ✅ Global | ⚠️ Could share | No |
| `vizConfigStore` | ✅ Global | ⚠️ Could share | **Yes** (`viz-config`) |
| `videoRecordingStore` | ✅ Global | ❌ One recorder | No |
| `canvasRefStore` | ✅ Global | ❌ One canvas ref | No |

### Component Coupling

```
App (auto-connects on mount via useEffect)
 └─ Layout (react-resizable-panels)
     ├─ Toolbar        → connectionStore, experimentStore, settingsStore, panelStore
     ├─ RecordingControls → recordingStore, videoRecordingStore
     ├─ Scene           → experimentStore, settingsStore, sceneSettingsStore, cameraStore, vizConfigStore, canvasRefStore
     │   ├─ CameraController → cameraStore, experimentStore, settingsStore
     │   ├─ SceneEntities    → experimentStore, cameraStore, vizConfigStore
     │   └─ DrawOverlays     → experimentStore
     ├─ Sidebar         → experimentStore (entity list, selection), vizConfigStore
     └─ LogPanel        → logStore
```

## Design

### Approach: Iframe Isolation with URL-Parameterized Viewer Mode

The design uses two modes, selected by URL parameters (no router dependency needed):

1. **Normal mode** (default, `index.html`): Current app, unchanged behavior
2. **Viewer mode** (`?mode=viewer&ws=<url>`): Stripped-down read-only viewport
3. **Dashboard mode** (`?mode=dashboard`): Grid of iframe panes, each loading viewer mode

```
Dashboard (?mode=dashboard)
 ├─ DashboardToolbar (grid size selector, experiment picker)
 └─ PaneGrid (CSS Grid)
     ├─ iframe src="?mode=viewer&ws=ws://host1:3000"
     ├─ iframe src="?mode=viewer&ws=ws://host2:3000"
     ├─ iframe src="?mode=viewer&ws=ws://host3:3000"
     └─ iframe src="?mode=viewer&ws=ws://host4:3000"
```

### Key Decisions

1. **No router dependency** — use `URLSearchParams` to switch modes. Keeps the
   bundle small and avoids a new dependency for 3 modes.

2. **Viewer mode disables localStorage persistence** — resolves C2 (shared
   localStorage collision). When `?mode=viewer`, `settingsStore` and
   `vizConfigStore` skip the `persist` middleware. Settings are inherited from
   defaults only.

3. **`?ws=` param read at connect time** — resolves C3. The `connect()` function
   in `connectionStore` already accepts an optional URL. The App.tsx useEffect
   will read `?ws=` and pass it to `connect(url)`.

4. **Dashboard is a separate component tree** — when `?mode=dashboard`, render
   `<Dashboard />` instead of `<Layout />`. No shared state needed between
   dashboard and panes (iframes are fully isolated).

5. **Default 4 panes, max 8** — conservative default respects WebGL context
   limits while allowing power users to push to 8.

6. **Context-lost handling** — add a `webglcontextlost` event listener in Scene
   that shows a "connection lost" overlay on the affected pane rather than
   crashing silently.

### Implementation Steps

#### Step 1: URL Parameter Utility

Create `src/lib/params.ts`:
```typescript
const params = new URLSearchParams(window.location.search)
export const APP_MODE = params.get('mode') ?? 'normal'  // 'normal' | 'viewer' | 'dashboard'
export const WS_URL = params.get('ws')  // null or ws://...
```

#### Step 2: Viewer Mode

Modify `App.tsx` to conditionally render based on `APP_MODE`:
- `normal`: Current behavior (full app)
- `viewer`: Render `<ViewerLayout />` — Scene + minimal status bar, no controls
- `dashboard`: Render `<Dashboard />`

`ViewerLayout` is a simplified layout:
- Full-viewport Scene (no sidebar, no log panel, no resizable panels)
- Thin status bar: connection status, step count, entity count, real-time ratio
- No play/pause/step/reset buttons
- No recording controls

Modify `connectionStore.connect()`:
- If `WS_URL` is set, use it instead of the default/settings URL

Modify persisted stores:
- If `APP_MODE === 'viewer'`, skip persist middleware (use plain `create()`)

#### Step 3: Dashboard Shell

Create `src/dashboard/Dashboard.tsx`:
- CSS Grid layout with configurable columns/rows
- Each cell is an `<iframe>` pointing to `?mode=viewer&ws=<url>`
- Toolbar with: grid size selector (1×1, 2×1, 2×2, 2×4), URL input per pane
- Pane state stored in dashboard's own local state (not Zustand)

#### Step 4: Context-Lost Handling

In `Scene.tsx`, add canvas event listener:
```typescript
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()
  // Show overlay: "WebGL context lost — too many viewports?"
})
```

### Phase 2: Experiment Discovery (Future)

Not part of this design. Would add an optional registry endpoint that the
dashboard queries to populate a picker UI.

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/App.tsx` | Renders `<Layout />`, auto-connects | Mode switch, pass `WS_URL` to connect |
| `src/ui/Layout.tsx` | Full app layout | Unchanged (normal mode only) |
| `src/stores/connectionStore.ts` | `connect()` uses settings URL | Read `WS_URL` param as override |
| `src/stores/settingsStore.ts` | Always persists to localStorage | Conditional persist (skip in viewer mode) |
| `src/stores/vizConfigStore.ts` | Always persists to localStorage | Conditional persist (skip in viewer mode) |
| `src/lib/params.ts` | Does not exist | **New**: URL parameter parsing |
| `src/ui/ViewerLayout.tsx` | Does not exist | **New**: Minimal viewer chrome |
| `src/dashboard/Dashboard.tsx` | Does not exist | **New**: Grid + iframe manager |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| Max simultaneous panes | 8 | WebGL context limit |
| Default panes | 4 (2×2) | Conservative default |
| Grid layouts | 1×1, 2×1, 2×2, 2×4 | Configurable |
| Default pane size | Equal split | CSS Grid `1fr` |
| Viewer status bar height | 24px | Minimal chrome |

## Dependencies

- **Requires**: None (builds on existing app)
- **Enhanced by**: PN-015 (health icons would be visible in viewer)

## Done When

- [x] `?mode=viewer&ws=<url>` renders read-only viewport connected to specified URL
- [x] `?mode=viewer` hides all controls (play/pause/step/reset/recording/sidebar)
- [x] Viewer mode does not write to localStorage (no cross-pane collisions)
- [x] `?mode=dashboard` renders configurable grid of iframe panes
- [x] Dashboard grid supports 1×1, 2×1, 2×2, 2×4 layouts
- [x] Can assign/change experiment URLs per pane without page reload
- [x] WebGL context-lost shows user-friendly overlay (not silent failure)
- [x] Works with 4 simultaneous experiments without performance degradation
- [x] Normal mode (`index.html` with no params) is completely unchanged

## Verification Strategy

### Success Criteria
- 4 panes simultaneously showing different mock experiments at 10fps
- No localStorage collisions between panes (verify with devtools)
- Normal mode regression: all existing features work unchanged

### Regression Checks
- Normal app (no URL params) behaves identically to before
- Settings persist correctly in normal mode
- Recording/replay still works in normal mode

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Viewer mode renders | Unit | Load `?mode=viewer&ws=ws://localhost:3000` | Scene visible, no controls |
| Viewer no-persist | Unit | Load viewer mode, check localStorage | No `argos-settings` writes |
| Dashboard grid | Integration | Load `?mode=dashboard`, select 2×2 | 4 iframes rendered |
| Multi-connect | Integration | 4 panes with mock servers | All 4 show entities |
| Normal unchanged | Regression | Load with no params | Full app, all features |
| Context lost | Manual | Open 9+ panes | Overlay shown on lost pane |

### Acceptance Threshold
- All unit/integration tests pass
- 4-pane dashboard runs for 60s without context loss on Chrome

## Effort Estimate

**Phase 1 (Viewer + Dashboard):** ~3 FTE-hours

| Metric | Estimate |
|--------|----------|
| Files created | 3 (`params.ts`, `ViewerLayout.tsx`, `Dashboard.tsx`) |
| Files modified | 4 (`App.tsx`, `connectionStore.ts`, `settingsStore.ts`, `vizConfigStore.ts`) |
| Lines added/changed | ~250 |
| Complexity | Low (iframe isolation, no store refactoring) |

## Open Questions

- Should the dashboard URL list be persisted (localStorage for dashboard mode)?
- Should viewer mode show a minimal entity count or just the viewport?
- Is there value in a "compact viewer" (no status bar at all) for maximum viewport space?

## Design Critique

**Reviewer:** Kiro (automated)
**Date:** 2026-04-21

### Verdict: ✅ PASS — Ready for implementation with minor amendments

The design is sound. The iframe isolation approach correctly sidesteps the global-singleton problem without requiring a store refactoring. The critique below identifies minor gaps and one medium-risk item, but none block implementation.

### Validated Design Decisions

| # | Decision | Validation |
|---|----------|-----------|
| D1 | URL params via `URLSearchParams` (no router) | ✅ Confirmed: no router exists, no routing patterns anywhere. Clean approach. |
| D2 | `connect(url?)` already accepts optional URL | ✅ Confirmed: `connectionStore.connect()` does `const target = url ?? useSettingsStore.getState().wsUrl ?? get().url`. Passing `WS_URL` works directly. |
| D3 | Viewer mode disables persist | ✅ Feasible: both `settingsStore` and `vizConfigStore` use `persist()` wrapper. Conditional creation is straightforward. |
| D4 | Dashboard renders separate component tree | ✅ `App.tsx` is trivial (15 lines). Mode switch is a clean conditional. |
| D5 | `react-three-fiber` Canvas has no context-lost handler | ✅ Confirmed: no `onCreated` or `webglcontextlost` listener exists. Adding one is low-risk. |
| D6 | Iframe isolation means no shared Zustand state | ✅ Each iframe gets its own JS context. No cross-frame store leakage. |

### Issues Found

| # | Issue | Severity | Recommendation |
|---|-------|----------|----------------|
| DC1 | **Conditional persist pattern unclear.** The design says "skip persist middleware" in viewer mode, but doesn't specify *how*. Zustand's `persist()` wraps the store at module load time — you can't conditionally apply it at runtime without restructuring the export. | ⚠️ Medium | Use a factory pattern: `createSettingsStore(persist: boolean)`. Or simpler: in viewer mode, just clear the storage key on mount and let persist write to a throwaway key like `argos-settings-viewer`. The simplest fix: since iframes are same-origin, use `sessionStorage` instead of `localStorage` for viewer mode (each iframe gets its own sessionStorage is **false** — sessionStorage is shared per-origin too). **Recommended**: use `persist({ name: 'argos-settings', storage: createJSONStorage(() => APP_MODE === 'viewer' ? memoryStorage : localStorage) })` where `memoryStorage` is a no-op Map-backed storage. This is a documented Zustand pattern. |
| DC2 | **`useKeyboardShortcuts()` in viewer mode.** App.tsx calls `useKeyboardShortcuts()` unconditionally. In viewer mode, keyboard shortcuts for play/pause/step/reset should be disabled (read-only). | 🟢 Low | Skip the hook when `APP_MODE === 'viewer'`. One-line guard. |
| DC3 | **`useDefaultLayout` hook in Layout.** The design correctly says Dashboard uses its own grid, but doesn't mention that `react-resizable-panels`' `useDefaultLayout` persists layout to localStorage (key `main-horiz`, `main-vert`). This is fine since viewer mode doesn't use Layout, but worth noting for completeness. | 🟢 Low | No action needed — viewer uses ViewerLayout, not Layout. |
| DC4 | **No error state for iframe load failure.** If a pane's `?ws=` URL is unreachable, the iframe will show the viewer with a "disconnected" status, but the dashboard has no visibility into pane health. | 🟢 Low | Acceptable for Phase 1. Could use `postMessage` from iframe→parent for status in Phase 2. |
| DC5 | **`EffectComposer` (Bloom + SMAA) per pane.** Each iframe runs post-processing. With 8 panes this is 8× the GPU post-processing cost. | ⚠️ Medium | Consider disabling post-processing in viewer mode (`EffectComposer` removed or effects disabled). This would significantly reduce GPU load for multi-pane scenarios. Add a `?effects=false` param or auto-disable in viewer mode. |
| DC6 | **`preserveDrawingBuffer: true` in Canvas gl props.** This is needed for video recording but hurts performance. Viewer mode doesn't need recording. | 🟢 Low | Set `preserveDrawingBuffer: false` in viewer mode for a small perf win. |
| DC7 | **Dashboard pane URL assignment UX.** Design says "URL input per pane" but doesn't specify whether URLs are entered manually or from a list. For a cluster of 100 experiments, manual entry is impractical. | 🟢 Low | Phase 1 can use manual input. The "Experiment Discovery" future section covers this. Acceptable deferral. |

### Feasibility Assessment

| Aspect | Assessment |
|--------|-----------|
| Implementation complexity | Low — 3 new files, 4 modifications, ~250 LOC |
| Risk of regression | Low — mode switch is at the top level; normal mode path is unchanged |
| Performance (4 panes) | Good — 4 WebGL contexts + 4 WS streams is well within limits |
| Performance (8 panes) | Marginal — recommend disabling post-processing in viewer (DC5) |
| Testing | Straightforward — unit tests for mode switching, integration for multi-pane |

### Recommended Amendments Before Implementation

1. **DC1 (Medium):** Specify the conditional persist pattern. Recommend Zustand's `createJSONStorage` with a no-op memory storage for viewer mode. Add this to Step 2 implementation details.

2. **DC5 (Medium):** Disable `EffectComposer` in viewer mode. Add a `VIEWER_MODE` check in `Scene.tsx` that skips Bloom/SMAA. This is ~3 lines and meaningfully improves 4+ pane performance.

3. **DC2 (Low):** Guard `useKeyboardShortcuts()` with mode check.

### Summary

The design is well-structured and the iframe approach is the right call for Phase 1. The three amendments above are minor additions (total ~10 lines of code) that should be folded into the implementation steps. No architectural changes needed.

**Recommendation:** Advance to 🔵 IMPLEMENTATION with the amendments incorporated.

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-19 | Initial investigation and architecture analysis | 📋 INVESTIGATION |
| 2026-04-21 | Critique completed, advanced to DESIGN | 🟡 DESIGN |
| 2026-04-21 | Design critique completed | 🔍 CRITIQUE |
| 2026-04-21 | Implementation complete: params.ts, memoryStorage.ts, ViewerLayout.tsx, Dashboard.tsx, App.tsx mode switch, Scene.tsx context-lost + perf | 🔵 IMPLEMENTATION |
| 2026-04-21 | Verification passed: all done-when criteria met, 53/53 tests pass, no regressions. Awaiting PR merge for COMPLETE. | 🟣 VERIFICATION |
