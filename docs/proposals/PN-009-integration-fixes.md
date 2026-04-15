# Proposal: Webviz Integration Fixes & Simulation Speed Control

Created: 2026-04-15
Baseline Commit: `e4a285f` (`client-next`)
GitHub Issue: #18

## Status: 🔵 IMPLEMENTATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Fix all issues discovered during the Canopy E_sync integration test and add
simulation speed control so researchers can run experiments at full speed
through webviz.

## Scope Boundary

**In scope:**
- Fix DrawOverlays circle rotation (Z-up coordinate mismatch)
- Fix DynamicFloor orientation and position mapping
- Add simulation speed control to webviz C++ plugin (`real_time_factor`)
- Fix fast-forward to actually skip the real-time sleep
- Client-next speed control UI (fast-forward button, speed selector)
- Canopy SyncWebviz integration (commit the working user functions)

**Out of scope:**
- ❌ Decoupling `ticks_per_second` from physics engine iterations (ARGoS core change)
- ❌ New drawing primitives beyond PN-008
- ❌ Modifying Canopy controllers

## Issues Found During Integration

### 1. Circle rotation wrong (client-next)
**Symptom**: Circles rendered 90° rotated — standing up instead of flat on ground.
**Root cause**: `DrawOverlays.tsx` applied `rotation={[-Math.PI/2, 0, 0]}` assuming
Y-up, but scene uses Z-up (`Object3D.DEFAULT_UP.set(0, 0, 1)`).
**Fix**: Remove the rotation. Circles in XY plane are already correct.

### 2. DynamicFloor orientation and position wrong (client-next)
**Symptom**: Floor texture would render vertically and at wrong position.
**Root cause**: Same Z-up assumption. Also `position` uses `arena.center.y` for
Three.js Z axis, but with Z-up they should map directly.
**Fix**: Remove rotation, fix position to `[center.x, center.y, 0.001]`.

### 3. Fast-forward doesn't skip real-time sleep (C++ plugin)
**Symptom**: Fast-forward runs N steps per broadcast but still sleeps to match
`ticks_per_second` real-time. No way to run at full speed.
**Root cause**: `SimulationThreadFunction` always sleeps after stepping:
```cpp
if (m_cTimer.Elapsed() < m_cSimulatorTickMillis) {
    std::this_thread::sleep_for(m_cSimulatorTickMillis - m_cTimer.Elapsed());
}
```
**Fix**: Skip sleep when `m_bFastForwarding`:
```cpp
if (!m_bFastForwarding && m_cTimer.Elapsed() < m_cSimulatorTickMillis) {
```

### 4. No speed control in webviz XML config (C++ plugin)
**Symptom**: Only way to control speed is `ticks_per_second` which also changes
time resolution (dt). These should be independent.
**Root cause**: No `real_time_factor` parameter.
**Fix**: Add `real_time_factor` attribute to `<webviz>`:
- `1.0` = real-time (default, backwards compatible)
- `2.0` = 2x speed
- `0` = unlimited (no sleep, run as fast as possible)

Scale the sleep: `sleep_ms = tick_ms / real_time_factor`

### 5. No fast-forward / speed UI in client-next toolbar
**Symptom**: User must send raw WebSocket commands to fast-forward.
**Fix**: Add speed controls to the experiment toolbar.

## Design

### C++ Changes (`webviz.cpp`, `webviz.h`)

```cpp
// webviz.h — new member
Real m_fRealTimeFactor = 1.0;

// webviz.cpp Init() — parse XML
GetNodeAttributeOrDefault(t_tree, "real_time_factor", m_fRealTimeFactor, Real(1.0));

// webviz.cpp SimulationThreadFunction() — fix sleep
if (!m_bFastForwarding && m_fRealTimeFactor > 0) {
    auto targetMs = m_cSimulatorTickMillis / m_fRealTimeFactor;
    if (m_cTimer.Elapsed() < targetMs) {
        std::this_thread::sleep_for(targetMs - m_cTimer.Elapsed());
    }
}
// When m_fRealTimeFactor == 0 or fast-forwarding: no sleep
```

### Client-Next Changes

**DrawOverlays.tsx**: Remove circle rotation.

**DynamicFloor.tsx**: Fix position to `[center.x, center.y, 0.001]`, remove rotation.

**Toolbar speed controls**: Add fast-forward button and speed display to
experiment controls. Send `fastforward` command with configurable step count.

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/src/scene/DrawOverlays.tsx` | Circle has wrong rotation | Remove rotation |
| `client-next/src/scene/DynamicFloor.tsx` | Wrong orientation + position | Fix for Z-up |
| `src/.../webviz.h` | No real_time_factor | Add `m_fRealTimeFactor` member |
| `src/.../webviz.cpp` | Always sleeps, FF doesn't skip | Add real_time_factor, skip sleep on FF |

## Assumptions

- [x] Scene uses Z-up (`Object3D.DEFAULT_UP.set(0, 0, 1)`) — confirmed in Scene.tsx
- [x] Entities map position directly as `[x, y, z]` — confirmed in DefaultEntity.tsx
- [ ] Skipping sleep in fast-forward won't cause WebSocket backpressure issues (broadcast still happens once per FF batch)

## Dependencies

- **Requires**: PN-008 (draw primitives)
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] Circles render flat on ground plane (Z-up correct)
- [ ] DynamicFloor renders correctly in Z-up scene
- [ ] Fast-forward runs at full speed (no real-time sleep)
- [ ] `real_time_factor="0"` in XML runs unlimited speed
- [ ] `real_time_factor="2"` runs at 2x real-time
- [ ] Default behavior unchanged (`real_time_factor="1"`)
- [ ] Canopy E_sync renders correctly end-to-end with webviz

## Effort Estimate

**Time:** ~1.5 FTE-hours

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | 4 |
| Lines added/changed | ~30 |
| Complexity | Low — targeted fixes |

## Changelog

| Date | Change | Workflow |
|------|--------|---------|
| 2026-04-15 | Created from Canopy integration test findings | proposal-create |
