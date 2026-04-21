# Proposal: Timeline Scrubber / Replay Seek

Created: 2026-04-21
GitHub Issue: N/A

## Status: 🟣 VERIFICATION

## Goal

Replace the minimal replay slider with a full-featured timeline scrubber that
makes navigating recorded simulations fast and intuitive — especially for long
recordings (100k+ frames) where the current seek implementation is too slow.

## Scope Boundary

**In scope:**
- Full-width timeline scrubber UI (replacing the 160px slider)
- Keyframe caching for O(1)-ish seek performance on delta recordings
- Frame-step controls (forward/back one frame)
- Keyboard shortcuts for replay navigation
- Step/time display during replay
- Extended speed options (8x, 16x)
- Hover tooltip showing frame/step on timeline

**Out of scope:**
- ❌ Modifying the C++ recorder (no periodic keyframe insertion server-side)
- ❌ Annotations or markers on the timeline
- ❌ Multi-track timeline (per-entity tracks)
- ❌ Waveform/sparkline visualization on the timeline
- ❌ Thumbnail preview on hover (too expensive for 3D)

## Current State

### What exists

| Component | State |
|-----------|-------|
| `recordingStore.seekTo(idx)` | Works but O(N) — replays from frame 0 for delta recordings |
| `RecordingControls.tsx` | Has a `<Slider>` (160px wide), play/pause, stop, speed (0.5–4x) |
| `argosrecParser.ts` | Loads entire file into `ArgosrecFrame[]` array in memory |
| `useKeyboardShortcuts` | Only controls live connection (Space, ArrowRight, R) — not replay |
| Toolbar step counter | Shows live step count, not recording frame position |

### Recording format constraints

The `.argosrec` delta format stores only changed fields per frame. The file
has exactly **one schema frame** (frame 0) — all subsequent frames are deltas.
This means:

- **seekTo(N)** must replay frames 0→N sequentially to build correct state
- For a 144k-frame recording, seeking to the end = 144k `applyDelta()` calls
- Each call is cheap (~microseconds per entity), but 144k × 6 entities ≈ 50–200ms
- For 1000-entity recordings: 144k × 1000 ≈ 1–5 seconds (unacceptable)

### Mock server vs real recorder

The mock server inserts keyframes every 100 frames (`KEYFRAME_INTERVAL=100`),
but the C++ `CWebvizRecorder` does **not**. Real `.argosrec` files from the
recorder have only one schema. This proposal must solve seek performance
client-side.

## Problem Analysis

### P1: Seek is O(N) — unusable for long recordings

A researcher loads a 144k-frame recording and drags the slider to 75%.
The client must replay 108k frames to render that position. This blocks
the main thread for 100ms–5s depending on entity count.

### P2: Timeline UI is inadequate

The current slider is 160px wide (`w-40`), crammed between buttons. For a
144k-frame recording, each pixel represents ~900 frames — no precision.
There's no time/step readout, no frame-step buttons, no keyboard control.

### P3: No keyboard shortcuts for replay

Researchers expect Space=play/pause, Left/Right=step, but these only work
for the live connection. During replay, the keyboard does nothing.

### P4: Speed range too limited

4x max is insufficient for skimming long recordings. Researchers want 8x
and 16x to quickly find interesting moments.

## Proposed Solution (High-Level)

### Keyframe Cache (solves P1)

On file load, build an in-memory cache of full entity state snapshots at
regular intervals (e.g., every 200 frames). Seeking then becomes:

1. Find the nearest cached snapshot ≤ target index
2. Restore that snapshot to experimentStore
3. Replay forward from snapshot → target (at most 199 frames)

**Cost**: Memory — one snapshot per interval. For 6 entities × 200 bytes ×
720 snapshots (144k/200) ≈ 860KB. For 1000 entities ≈ 140MB. The interval
should be configurable or adaptive based on entity count.

### Full-Width Timeline (solves P2)

Replace the 160px slider with a full-width bar that spans the recording
controls area. Show:
- Current position / total frames
- Simulation step (frame × every_n_steps)
- Elapsed / remaining (if timing info available)
- Hover tooltip with frame number

### Keyboard Shortcuts (solves P3)

When in replay mode, intercept:
- Space → togglePlayPause
- ArrowLeft → seekTo(idx - 1)
- ArrowRight → seekTo(idx + 1)
- Shift+ArrowLeft → seekTo(idx - 10)
- Shift+ArrowRight → seekTo(idx + 10)

### Extended Speed (solves P4)

Add 8x and 16x to the replay speed selector.

## Assumptions

- [ ] Keyframe cache memory is acceptable (adaptive interval keeps it under ~50MB)
- [ ] 200-frame replay-forward is fast enough to feel instant (<16ms for typical recordings)
- [ ] Researchers primarily use delta-mode recordings (full-mode doesn't need caching)
- [ ] The existing `<Slider>` component from shadcn/ui supports full-width styling
- [ ] No need for Web Worker — cache building is fast enough on main thread for typical file sizes

## Key File References

| File | Current State | Proposed Change |
|------|---------------|-----------------|
| `src/stores/recordingStore.ts` | seekTo replays from last schema | Add keyframe cache, use cached snapshots for seek |
| `src/ui/RecordingControls.tsx` | 160px slider, minimal controls | Full-width timeline, frame-step buttons, step display |
| `src/hooks/useKeyboardShortcuts.ts` | Only live controls | Add replay-mode shortcuts |
| `src/protocol/argosrecParser.ts` | Parses file into frames | Unchanged (cache built post-parse) |

## Dependencies

- **Requires**: PN-003 (Recorder/Replay) — ✅ Complete
- **Enhanced by**: None
- **Blocks**: None

## Open Questions

- What's the right cache interval? Fixed (200) or adaptive (based on entity count)?
- Should the timeline show simulation step or frame index as primary label?
- Should seeking while playing pause playback, or continue from the new position?
- Is a "scrubbing" mode needed (live preview while dragging, without committing)?

## Effort Estimate

| Component | Time |
|-----------|------|
| Keyframe cache in recordingStore | 1 hour |
| Full-width timeline UI | 45 min |
| Frame-step buttons + step display | 20 min |
| Keyboard shortcuts for replay | 20 min |
| Extended speed options | 5 min |
| Hover tooltip on timeline | 30 min |
| Testing | 30 min |
| **Total** | **~3.5 hours** |

## Critique Results

**Reviewer:** Kiro (automated)
**Date:** 2026-04-21

### Verdict: ✅ PASS — Ready for DESIGN with amendments

The investigation correctly identifies the core problems and proposes a sound
solution. The critique found one critical performance issue (C2) that must be
addressed in the design, and several clarifications needed.

### Issues Found

| # | Issue | Severity | Resolution |
|---|-------|----------|------------|
| C1 | **Adaptive cache interval needed.** Fixed interval=200 uses 360MB for 1000 entities. Must scale with entity count. | 🔴 High | Use `interval = max(200, entityCount × 2)`. Caps memory at ~50MB. |
| C2 | **computeFields is O(N²) per frame.** `_distance_to_nearest` and `_neighbor_count` iterate all entities for each entity. Replaying 200 frames through `applyDelta` = 200 × N² operations. For 1000 entities = 200M ops (~1-2s). | 🔴 High | Seek must bypass computeFields for intermediate frames. Only compute on final frame. |
| C3 | **prevEntities needed for final frame.** computeFields uses prevEntities for `_speed` and `_led_changed`. The optimized seek must track entity state at frame idx-1 to pass as prevEntities. | ⚠️ Medium | During replay-forward loop, keep reference to Map at idx-1. |
| C4 | **user_data accumulation.** Delta frames may include user_data (draw commands, floor data). The seek loop must carry forward the last user_data seen. | ⚠️ Medium | Track last user_data during replay-forward, pass to final setState. |
| C5 | **Full-mode recordings don't need cache.** When `header.delta === false`, every frame is complete. Seek is already O(1). Cache building is wasted work. | 🟢 Low | Skip cache for non-delta recordings. |
| C6 | **Live recordings (non-argosrec) unaffected.** Each frame is a full BroadcastMessage. Seek is O(1). No change needed. | 🟢 Low | No action — existing path is correct. |
| C7 | **Slider component is sufficient.** Native `<input type="range">` with `flex-1` fills available space. No custom component needed for MVP. | 🟢 Low | Use existing Slider, change `w-40` to `flex-1`. |

### Validated Assumptions

| Assumption | Status | Notes |
|-----------|--------|-------|
| Keyframe cache memory acceptable | ✅ With adaptive interval | Fixed=200 fails at 1000 entities; adaptive formula solves it |
| 200-frame replay-forward < 16ms | ✅ With optimized path | Must skip computeFields for intermediate frames |
| Researchers use delta-mode recordings | ✅ | Default in recorder XML; full-mode is opt-in |
| Slider supports full-width | ✅ | Just CSS change |
| No Web Worker needed | ✅ | Cache build is O(N×frames/interval) — fast enough on main thread |

### Amended Scope

The following must be added to the design phase:

1. **Optimized seek path** — new function that applies deltas without
   computeFields/setState, only triggering a single React update at the end
2. **Adaptive cache interval** — formula based on entity count from first schema
3. **Skip cache for full-mode** — detect `header.delta === false` or all-full frames
4. **prevEntities tracking** — maintain frame idx-1 state during seek loop
5. **user_data accumulation** — carry forward last user_data through seek

### Summary

The investigation is solid. The key insight (keyframe cache) is correct but
needs the optimized seek path (C2) to actually deliver <16ms performance.
Without it, the cache only reduces the problem from O(N) to O(N/interval)
frames, but each frame is still O(N²) — defeating the purpose for large swarms.

**Recommendation:** Advance to 🟡 DESIGN with C1–C4 incorporated.

## Done When

- [ ] Seeking to any frame in a 144k-frame delta recording completes in <50ms
- [ ] Timeline scrubber spans full width of the recording controls bar
- [ ] Frame index and simulation step displayed during replay
- [ ] Frame-step buttons (back/forward) work
- [ ] Keyboard shortcuts (Space, Left, Right, Shift+Left, Shift+Right) work during replay
- [ ] Speed selector includes 8x and 16x options
- [ ] Hover over timeline shows frame number tooltip
- [ ] No regression in normal playback or live connection behavior

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-21 | Initial investigation: problem analysis, current state audit, scope | 📋 INVESTIGATION |
| 2026-04-21 | Critique: validated assumptions, found O(N²) computeFields issue, adaptive cache needed | 🔍 CRITIQUE |
| 2026-04-21 | Design doc: keyframe cache, optimized seek, full-width timeline, keyboard shortcuts | 🟡 DESIGN |
| 2026-04-21 | Implementation: all features, 17 new tests, build + 70 tests green | 🔵 IMPLEMENTATION |
| 2026-04-21 | PR opened, ready for review | 🟣 VERIFICATION |
