# Proposal: Proportional Speed Control

Created: 2026-04-19
GitHub Issue: N/A

## Status: ✅ COMPLETE

## Goal

Replace the binary play/fast-forward with true proportional speed control
(0.5×–50×) and an unlimited mode (∞), with accurate real-time ratio reporting.

## Scope Boundary

**In scope:**
- Server-side `speed` command to set `m_fRealTimeFactor` at runtime
- Unified play/pause button with speed selector
- Accurate RTF reporting (factor-based for play, measured for FF)
- Speed benchmark tooling
- Configurable speed options in Settings panel

**Out of scope:**
- ❌ Frame-rate-based speed control (server architecture doesn't support it)
- ❌ Per-speed frame skip configuration (not needed — see benchmarks)

## Current State

**What existed:**
- Binary play (1× real-time with sleep) or fast-forward (no sleep, frame skip)
- `m_fRealTimeFactor` existed in C++ but was XML-only, not runtime-settable
- RTF reported incorrectly (measured sim+broadcast time, excluded sleep)

**What was added:**
- `speed` command in webviz.cpp to set `m_fRealTimeFactor` at runtime
- `playAtSpeed()` in connectionStore: pause → speed → play (or FF for ∞)
- Unified play/pause toggle + speed dropdown in toolbar
- Speed options configurable in Settings panel (persisted to localStorage)
- `speed-bench.cjs` benchmark tool

## Design

### How the server works

The main loop per cycle:
1. Run N sim steps (1 for play, `m_unDrawFrameEvery` for FF)
2. Broadcast state to all clients
3. Sleep to match target tick duration (play only, no sleep in FF)

Sleep duration = `tick_ms / m_fRealTimeFactor`

### Benchmark results (10 tps, 20 foot-bots)

| Speed | Steps/s | Actual× | Mechanism |
|-------|---------|---------|-----------|
| 0.5× | 5 | 0.50× | Sleep 200ms/tick |
| 1× | 10 | 1.00× | Sleep 100ms/tick |
| 2× | 20 | 1.98× | Sleep 50ms/tick |
| 5× | 48 | 4.84× | Sleep 20ms/tick |
| 10× | 92 | 9.20× | Sleep 10ms/tick |
| 50× | ~500 | ~50× | Sleep 2ms/tick |
| ∞ | 8,602 | ~860× | No sleep, skip 1000 frames |

### Key insight

Broadcast overhead is ~50ms/frame. At finite speeds, sleep dominates so
broadcast cost is free. At ∞, broadcast is the bottleneck — frame skipping
(FF steps parameter) is the only way to go faster.

### RTF fix

- Play mode: report `m_fRealTimeFactor` directly (sleep enforces it)
- FF mode: measure `sim_time_ms / elapsed_ms` (actual throughput)

## Key File References

| File | Change |
|---|---|
| `webviz.cpp` | Added `speed` command, fixed RTF calculation |
| `connectionStore.ts` | Added `playAtSpeed()` |
| `Toolbar.tsx` | Unified play/pause + speed dropdown |
| `settingsStore.ts` | `speedOptions` array (persisted) |
| `SettingsPanel.tsx` | Speed options editor |
| `defaults.ts` | `SPEED_OPTIONS`, `SPEED_INFINITY_THRESHOLD` |
| `tools/speed-bench.cjs` | Benchmark tool |

## Done When

- [x] Server accepts `speed` command to set real-time factor
- [x] Speeds 0.5×–50× scale linearly (verified by benchmark)
- [x] ∞ runs at max throughput with frame skipping
- [x] RTF badge shows accurate ratio at all speeds
- [x] Speed options configurable in Settings
- [x] Switching speed mid-run works seamlessly

## Changelog

| Date | Change |
|------|--------|
| 2026-04-19 | Implemented and merged (PR #26) |
| 2026-04-19 | Retroactive proposal created |
