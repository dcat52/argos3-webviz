# Future Proposals — Discovered During Canopy Integration

Baseline: `c55a30a` (`client-next`) — post PN-009
Created: 2026-04-15, updated 2026-04-15

---

## Active Design

### PN-013: Floating Panel System

**Goal**: Reusable draggable panel component for HUD, experiment data,
entity inspector, and event log.

Subsumes old PN-013 (HUD), PN-014 (screenshot — already exists),
PN-016 (convergence — now generic events inside panels).

See: `docs/proposals/PN-013-floating-panels.md`

**Effort**: ~3 hrs | Medium complexity

---

## Needs Discussion

### PN-015: HealthWebviz + Per-Robot Status Icons

**Goal**: Webviz user functions for E_health, with battery-style health
icons floating above each robot.

**Open questions**:
- Battery icon vs colored circle vs health bar?
- Show other robots' estimates of health (dimmer/outline)?
- How does this generalize to other per-robot indicators?

**Effort**: TBD

---

## Low Priority

### PN-011: Keyboard Shortcuts

**Goal**: Play/pause/step via keyboard.

**Effort**: ~1 hr | Low complexity | Low value — most interaction is browser-based

---

## Future

### PN-017: Multi-Experiment Dashboard

**Goal**: Side-by-side viewports for comparing experiments.

**Effort**: ~4 hrs | Medium complexity

---

### PN-018: Timeline Scrubber / Replay Seek

**Goal**: Scrub through recorded simulation history.

**Effort**: ~4 hrs | Medium complexity
**Dependencies**: PN-003

---

## Summary

| PN | Title | Status | Effort |
|----|-------|--------|--------|
| PN-013 | Floating Panel System | 🟡 Design | 3 hr |
| PN-015 | HealthWebviz + Status Icons | 📋 Needs discussion | TBD |
| PN-011 | Keyboard Shortcuts | 📋 Low priority | 1 hr |
| PN-017 | Multi-Experiment Dashboard | 📋 Future | 4 hr |
| PN-018 | Timeline Scrubber | 📋 Future | 4 hr |
