# Proposal: User Data Filtering in .argos Config

Created: 2026-04-26
Baseline Commit: `7ca9086` (`master`)
GitHub Issue: #53

## Status: 📋 INVESTIGATION

## Goal

Allow users to control what `user_data` gets sent over the WebSocket from the `.argos` experiment file. Options: disable entirely, or whitelist specific fields. Reduces bandwidth for experiments with large user_data payloads.

## Scope Boundary

**In scope:**
- `send_user_data="false"` attribute to disable all user_data
- `user_data_fields="field1,field2"` attribute to whitelist specific per-entity fields
- `global_user_data="false"` to disable global (experiment-level) user_data
- Backwards compatible — no attribute = send everything (current behavior)

**Out of scope:**
- ❌ Per-entity-type filtering (e.g., only send for foot-bots)
- ❌ Client-side filtering (already handled by PN-025)
- ❌ Changing the user functions API

## Current State

**What exists:**
- `CWebvizUserFunctions::Call(entity)` returns per-entity JSON — all of it gets attached
- `CWebvizUserFunctions::sendUserData()` returns global JSON — all of it gets attached
- No filtering mechanism — whatever the function returns, gets sent
- Delta encoding skips unchanged user_data but doesn't sub-field diff

**What's missing:**
- No way to disable user_data without removing the user_functions library
- No way to send only specific fields
- Large user_data payloads waste bandwidth even when not needed

## Design

### Approach

Add config attributes to the `<webviz>` XML element. Parse them in `CWebviz::Init()`. Apply filtering after `Call()` and `sendUserData()` return.

### Config Syntax

```xml
<!-- Send everything (default, backwards compatible) -->
<webviz />

<!-- Disable all per-entity user_data -->
<webviz send_entity_data="false" />

<!-- Disable global user_data -->
<webviz send_global_data="false" />

<!-- Whitelist specific per-entity fields -->
<webviz entity_data_fields="counter,has_food,state" />

<!-- Combine: only send specific fields, disable global -->
<webviz entity_data_fields="counter" send_global_data="false" />
```

### Key Decisions

1. **Filter after Call(), not before** — user functions still run (they may have side effects), we just strip the JSON before sending
2. **Comma-separated field list** — simple, matches ARGoS config style
3. **Top-level keys only** — filter on `user_data.counter`, not `user_data.nested.deep.field`
4. **Empty field list = send nothing** — `entity_data_fields=""` is equivalent to `send_entity_data="false"`

### Pseudocode / Steps

```
Init():
  parse send_entity_data (bool, default true)
  parse send_global_data (bool, default true)
  parse entity_data_fields (string, default "")
  if entity_data_fields not empty, build set<string> of allowed keys

Broadcast loop:
  user_data = m_pcUserFunctions->Call(entity)
  if !send_entity_data → skip
  if field whitelist exists → filter user_data to only whitelisted keys
  attach to entity JSON

  global_data = m_pcUserFunctions->sendUserData()
  if !send_global_data → skip
  attach to state JSON
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/.../webviz/webviz.h` | No filtering members | Add bool + set<string> members |
| `src/.../webviz/webviz.cpp` | Attaches all user_data | Parse config, filter before attach |

## Assumptions

- [x] User functions may have side effects — must still call them even if filtering
- [x] ARGoS XML supports `GetNodeAttributeOrDefault` for optional attributes
- [ ] `nlohmann::json` supports erasing keys efficiently

## Dependencies

- **Requires**: None
- **Enhanced by**: PN-025 (Smart User Data Display)
- **Blocks**: None

## Done When

- [ ] `send_entity_data="false"` disables per-entity user_data
- [ ] `send_global_data="false"` disables global user_data
- [ ] `entity_data_fields="a,b"` sends only fields a and b
- [ ] No attributes = send everything (backwards compatible)
- [ ] C++ build passes
- [ ] Tested with test experiment

## Verification Strategy

### Success Criteria
- With `send_entity_data="false"`, no `user_data` key on entities in WebSocket messages

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Default | Functional | No attributes | All user_data sent (unchanged) |
| Disable entity | Functional | `send_entity_data="false"` | No entity user_data |
| Disable global | Functional | `send_global_data="false"` | No global user_data |
| Whitelist | Functional | `entity_data_fields="counter"` | Only counter field sent |
| Build | Automated | cmake build | Clean compile |

## Effort Estimate

**Time:** 1-2 FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | 2 |
| Lines added/changed | ~30 |
| Complexity | Low — config parsing + JSON key filtering |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-26 | Initial draft | 📋 INVESTIGATION |
