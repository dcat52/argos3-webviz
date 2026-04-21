# PN-018 Timeline Scrubber — Design

Created: 2026-04-21
Phase: 🟡 DESIGN

## Overview

Add keyframe-cached seeking and a full-width timeline to make replay
navigation instant and precise, even for 100k+ frame delta recordings.

## Architecture

### 1. Keyframe Cache (recordingStore.ts)

On `loadArgosrecFile`, after parsing, build a cache of full entity-state
snapshots at regular intervals. The cache is an array of `KeyframeSnapshot`
objects stored in the recording store.

```ts
interface KeyframeSnapshot {
  frameIndex: number
  entities: Map<string, AnyEntity>
  arena: ArenaInfo | null
  userData: unknown
}
```

**Adaptive interval**: `interval = Math.max(200, entityCount * 2)`.
This caps memory at ~50MB for 1000-entity recordings.

**Skip for full-mode**: If all frames are type `'full'` or `'schema'`,
no cache is needed — each frame is self-contained.

**Build process** (in `buildKeyframeCache`):
1. Start from frame 0 (schema). Apply to a local Map (not the store).
2. Every `interval` frames, deep-clone the Map into the cache.
3. Track `userData` (last seen) and `arena` (last seen) alongside entities.

### 2. Optimized Seek (recordingStore.ts)

Replace the current `seekTo` with a fast path:

1. Find nearest cached snapshot ≤ target index
2. Clone that snapshot's entities into a working Map
3. Replay forward from snapshot to target, applying deltas to the
   working Map directly (no computeFields, no setState)
4. At frame `target - 1`, save the Map as `prevEntities`
5. At frame `target`, call `experimentStore.setState()` once with
   the final entities, prevEntities, computeFields, drawCommands, etc.

This reduces seek from O(N × N²) to O(interval × N) for the replay
loop, plus one O(N²) computeFields call at the end.

### 3. Full-Width Timeline (RecordingControls.tsx)

Replace `className="w-40"` on the Slider with `flex-1` so it fills
available space. Add a relative wrapper for the hover tooltip.

### 4. Frame-Step Buttons (RecordingControls.tsx)

Add `ChevronLeft` / `ChevronRight` icon buttons that call
`seekTo(frameIndex ± 1)`. Place them flanking the play/pause button.

### 5. Step Display (RecordingControls.tsx)

Show `Frame {idx+1}/{total}` and, if `argosrecHeader.every_n_steps`
is available, also show `Step {idx * every_n_steps}`.

### 6. Keyboard Shortcuts (useKeyboardShortcuts.ts)

When `recordingStore.state === 'replaying'`, intercept:
- `Space` → `togglePlayPause()`
- `ArrowLeft` → `seekTo(frameIndex - 1)`
- `ArrowRight` → `seekTo(frameIndex + 1)`
- `Shift+ArrowLeft` → `seekTo(frameIndex - 10)`
- `Shift+ArrowRight` → `seekTo(frameIndex + 10)`

Fall through to existing live-connection shortcuts when not replaying.

### 7. Extended Speed (RecordingControls.tsx)

Add `8` and `16` to the speed options array.

### 8. Hover Tooltip (RecordingControls.tsx)

Wrap the Slider in a relative container. On `mousemove`, compute
the hovered frame index from mouse X position relative to the slider.
Show an absolute-positioned tooltip above the cursor with the frame number.

## Implementation Order

1. `recordingStore.ts` — keyframe cache + optimized seek
2. `RecordingControls.tsx` — full-width slider, frame-step buttons,
   step display, extended speeds, hover tooltip
3. `useKeyboardShortcuts.ts` — replay-mode shortcuts
4. Tests

## Key Decisions

- **No Web Worker**: Cache build is O(frames/interval × N) — fast enough
  on main thread for typical recordings.
- **Clone via structured clone**: `structuredClone(map)` for snapshots.
  Maps are supported by structuredClone.
- **Seek pauses playback**: Dragging the slider pauses. User can resume
  with Space or play button. This matches video player conventions.
- **Primary label is frame index**: Step number shown as secondary info
  when `every_n_steps` is available.
