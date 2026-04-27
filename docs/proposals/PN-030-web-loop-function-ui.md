# Proposal: Web Loop Function UI Controls

Created: 2026-04-26
Baseline Commit: `5cc38ae` (`master`)
GitHub Issue: #59

## Status: 🔵 IMPLEMENTATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Let C++ loop functions declare custom UI controls (buttons, sliders, toggles, dropdowns) that render in the web client. Users interact with these controls and the actions route back to C++ callbacks via the existing `HandleCommandFromClient` mechanism. This is the web-native equivalent of QT-OpenGL's ability to add Qt widgets from loop functions.

## Scope Boundary

**In scope:**
- C++ API for declaring UI controls: button, slider, toggle, dropdown
- JSON schema for control declarations sent via `user_data._ui`
- Client-side panel that dynamically renders declared controls
- Client sends interactions back via WebSocket commands
- C++ dispatch of incoming UI commands to registered callbacks

**Out of scope:**
- ❌ Arbitrary HTML/CSS from C++ (too complex, security concerns)
- ❌ Two-way data binding (controls are fire-and-forget; state lives in C++)
- ❌ Layout customization (controls render in a standard panel, no custom positioning)
- ❌ Per-entity UI (this is experiment-level controls only)
- ❌ Replacing HandleCommandFromClient — we extend it, not replace it

## Current State

**What exists:**
- `CWebvizUserFunctions::HandleCommandFromClient(str_ip, json)` — receives arbitrary JSON commands from the client
- `CWebvizUserFunctions::sendUserData()` — sends arbitrary JSON to the client each tick
- Client WebSocket `send()` can send arbitrary JSON commands
- `ExperimentDataPanel` shows global user_data — could host or neighbor the controls panel
- QT-OpenGL has `CQTOpenGLUserFunctions` with `AddButton()`, `AddSlider()` etc. — we mirror this API style

**What's missing:**
- No C++ API for declaring UI controls
- No protocol for control schemas
- No client-side dynamic control renderer
- No command routing from UI interactions back to specific callbacks

## Affected Components

- [x] C++ plugin (`src/`)
- [ ] Legacy client (`client/`)
- [x] Next client (`client-next/`)
- [x] Protocol / message format
- [ ] Build system / CMake
- [x] Documentation

## Design

### Approach

**C++ side:** Extend `CWebvizUserFunctions` (or `CWebvizDrawFunctions`) with methods like `AddButton("Reset", callback)`. These register control descriptors. On each tick, `sendUserData()` includes a `_ui` key with the control schema. When a command arrives with `type: "ui_action"`, dispatch to the registered callback.

**Protocol:** Controls are declared as a JSON array in `user_data._ui`:
```json
{
  "_ui": [
    {"type": "button", "id": "reset", "label": "Reset Swarm"},
    {"type": "slider", "id": "speed", "label": "Speed", "min": 0, "max": 100, "value": 50},
    {"type": "toggle", "id": "trails", "label": "Show Trails", "value": false},
    {"type": "dropdown", "id": "mode", "label": "Mode", "options": ["explore", "forage"], "value": "explore"}
  ]
}
```

Client sends back:
```json
{"command": "ui_action", "control_id": "reset"}
{"command": "ui_action", "control_id": "speed", "value": 75}
```

**Client side:** A new `LoopFunctionPanel` reads `_ui` from user_data and renders controls dynamically. Interactions send commands via the existing WebSocket.

### Key Decisions

1. **Declarative, not imperative** — C++ declares what controls exist; client renders them. No C++ code runs in the browser.
2. **Schema via user_data._ui** — reuses existing user_data channel, no new WebSocket message types
3. **Callbacks via HandleCommandFromClient** — reuses existing command infrastructure with a `ui_action` command type
4. **Control state lives in C++** — the `value` field in the schema reflects C++ state. Client renders it but doesn't own it. This avoids sync issues.
5. **Four control types initially** — button, slider, toggle, dropdown. Covers most research UI needs. Extensible later.

### Pseudocode / Steps

```
C++ user function Init():
  AddButton("reset", "Reset Swarm", &MyFunctions::OnReset)
  AddSlider("speed", "Speed", 0, 100, 50, &MyFunctions::OnSpeedChange)
  AddToggle("trails", "Show Trails", false, &MyFunctions::OnTrailsToggle)

sendUserData():
  json result = /* existing user data */
  result["_ui"] = SerializeControls()  // builds the _ui array from registered controls
  return result

HandleCommandFromClient(ip, cmd):
  if cmd["command"] == "ui_action":
    id = cmd["control_id"]
    dispatch to registered callback for id
    update control's stored value

Client LoopFunctionPanel:
  controls = userData._ui
  for each control:
    render appropriate widget
    on interaction: ws.send({command: "ui_action", control_id, value})
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/.../webviz/webviz_user_functions.h` | HandleCommandFromClient, sendUserData | Add AddButton/AddSlider/AddToggle/AddDropdown, control registry, dispatch |
| `src/.../webviz/webviz_user_functions.cpp` | Basic Call/thunk infrastructure | Add control serialization, command dispatch |
| `client-next/src/ui/panels/LoopFunctionPanel.tsx` | Does not exist | New panel rendering _ui controls |
| `client-next/src/types/protocol.ts` | DrawCommand types | Add UIControl types |
| `client-next/src/stores/experimentStore.ts` | Extracts _draw, _floor | Extract _ui |

## Assumptions

- [x] `HandleCommandFromClient` receives all unknown commands — no filtering
- [x] `sendUserData()` can return arbitrary JSON including `_ui`
- [ ] std::function callbacks work for the control dispatch (C++11 compatible)
- [ ] Four control types are sufficient for initial release

## Dependencies

- **Requires**: None (but PN-029 draw wiring would make the sendUserData pattern cleaner)
- **Enhanced by**: PN-029 (Draw Functions Auto-Wiring)
- **Blocks**: None

## Done When

- [ ] `AddButton("id", "label", callback)` registers a button that appears in the web client
- [ ] `AddSlider("id", "label", min, max, value, callback)` renders a working slider
- [ ] `AddToggle("id", "label", value, callback)` renders a working toggle
- [ ] `AddDropdown("id", "label", options, value, callback)` renders a working dropdown
- [ ] Clicking/changing a control sends `ui_action` command and C++ callback fires
- [ ] Control values update in the UI when C++ changes them (next tick)
- [ ] No controls declared = no panel shown (backwards compatible)
- [ ] C++ build passes, client build passes

## Verification Strategy

### Success Criteria
- A test user function declares a button and slider; both appear in the web client; clicking the button triggers the C++ callback; moving the slider sends the value back

### Regression Checks
- Existing user functions without UI controls see no change
- HandleCommandFromClient still works for non-UI commands
- user_data filtering (PN-026) doesn't strip `_ui`

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Button | Functional | AddButton, click in browser | C++ callback fires |
| Slider | Functional | AddSlider, drag in browser | C++ callback receives value |
| Toggle | Functional | AddToggle, click in browser | C++ callback receives bool |
| Dropdown | Functional | AddDropdown, select option | C++ callback receives string |
| No controls | Functional | Don't call Add* | No panel shown |
| Backwards compat | Functional | Existing test_user_functions | Works unchanged |
| Build | Automated | cmake + npm run build | Clean compile |

### Acceptance Threshold
- All functional tests pass, both builds clean

## Open Questions

- Should controls support grouping/sections (e.g., "Swarm Controls", "Visualization")?
- Should slider support step size?
- Should there be a `AddLabel()` for read-only display values (alternative to user_data)?
- How to handle rapid slider changes — debounce on client or throttle on server?

## Effort Estimate

**Time:** 4-6 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 2 |
| Files modified | 4 |
| Lines added/changed | ~300 |
| Complexity | Medium — new C++ API + new client panel + protocol contract |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| Draw Functions Auto-Wiring | PN-028 discussion | Proposal PN-029 |
| User Data Field Pinning | PN-025 | Proposal PN-028 |
| Control grouping/sections | PN-030 investigation | Open question |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
| 2026-04-26 | Implementation complete — C++ API + client panel + command routing | 🔵 IMPLEMENTATION |
