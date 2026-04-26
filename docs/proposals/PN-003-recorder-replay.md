# Proposal: Seamless Record → Replay Experience

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: #3

## Status: ✅ COMPLETE
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Make the record-to-replay workflow seamless: a researcher runs a headless
experiment on a cluster, gets a file, opens it in client-next, and sees the
full simulation with all visualization features — no extra steps, no format
conversion, no lost data.

## Scope Boundary

**In scope:**
- UX requirements for the end-to-end workflow
- File format improvements (compression, metadata, selective recording)
- Client-next file loading (drag-and-drop, file picker)
- Replay that supports all viz features (color-by, trails, links, heatmap)
- Error handling and user feedback for edge cases

**Out of scope:**
- ❌ Random-access scrubbing (sequential replay is sufficient for v1)
- ❌ Export to analysis formats (CSV, HDF5) — separate tooling
- ❌ Streaming replay over network
- ❌ Editing or annotating recordings

## UX Requirements

These are the concrete user experience goals this proposal must satisfy:

### R1: Zero-friction file loading
- Drag-and-drop a `.argosrec` or `.argosrec.gz` file onto the client-next window
- Or click a file-open button in the toolbar
- File loads, arena configures itself, replay starts automatically
- No manual URL entry, no format selection, no config needed

### R2: Full context preserved
- Recording contains everything needed to replay: arena size, entity types,
  positions, orientations, LEDs, user_data
- Metadata visible in UI: experiment name, timestamp, total steps, duration
- Researcher can tell which experiment produced this file

### R3: All viz features work on recorded data
- Color-by-metric, trails, links, heatmap, labels all work identically on
  recorded data as they do on live data
- `_viz_hints` from the recording are applied as defaults
- Viz config can be changed during replay (not baked in)

### R4: Practical file sizes
- Compression reduces file size enough for cluster → laptop transfer
- A 144k-step, 6-robot experiment should be < 50MB compressed
- A 1000-robot, 10k-step experiment should be < 500MB compressed

### R5: Graceful degradation
- Corrupted or truncated files: load what's available, show warning
- Missing entity types: render with DefaultEntity fallback
- Version mismatch: warn but attempt to load

### R6: Live recording still works
- Existing browser-based record/replay (recordingStore) is unchanged
- User can record a live session and replay it without disconnecting
- Can export a live recording as `.argosrec` format

## Current State

**What exists:**
- `CWebvizRecorder` — headless C++ plugin, writes JSON-lines `.argosrec`,
  supports delta mode, configurable via XML (`output`, `every_n_steps`,
  `autostart`, `delta`)
- File format: line 1 = schema (full state + arena), lines 2+ = delta or full
- `recordingStore.ts` — records live `BroadcastMessage` frames, exports/imports
  JSON, replay with play/pause/speed/scrubber
- `RecordingControls.tsx` — UI for record/replay
- `experimentStore.ts` — already handles `applySchema()` and `applyDelta()`

**What's missing:**
- No compression (long runs = huge files) → violates R4
- No metadata header (can't identify experiment) → violates R2
- No selective recording → unnecessary data bloat
- Client can't load `.argosrec` files → violates R1
- `recordingStore` only handles `BroadcastMessage`, not schema/delta → violates R3
- No drag-and-drop → violates R1
- No error handling for bad files → violates R5
- No export from live recording to `.argosrec` → violates R6

## Affected Components

- [x] C++ plugin (`src/`) — recorder enhancements
- [x] Next client (`client-next/`) — file loader, parser, replay integration
- [ ] Legacy client (`client/`)
- [x] Protocol / message format — file format spec
- [ ] Build system / CMake
- [x] Documentation — file format reference, user guide

## Design

### File Format v2

```
Line 1 (header):
{
  "type": "header",
  "version": 2,
  "created": "2026-04-13T12:00:00Z",
  "argos_config_hash": "a1b2c3d4",
  "total_steps": 144000,
  "every_n_steps": 1,
  "delta": true,
  "arena": { "size": {...}, "center": {...} },
  "entity_types": ["kheperaiv"],
  "_viz_hints": { "colorBy": "battery", "links": "neighbors" }
}

Line 2+: same as current (schema then deltas)
```

### Gzip Compression

Use zlib (already a dependency) — detect `.gz` extension in `Init()`:

```cpp
if (m_strOutputFile.ends_with(".gz")) {
    m_gzFile = gzopen(m_strOutputFile.c_str(), "wb");
} else {
    m_cOutStream.open(m_strOutputFile);
}
```

### Selective Recording

```xml
<webviz_recorder output="exp.argosrec.gz"
                 entity_types="kheperaiv,foot-bot" />
```

### Client-Next File Loader

```
User drops file → FileLoader component
  → detect .gz → decompress with pako
  → parse line-by-line
  → line 1 (header) → configure arena, show metadata, apply viz hints
  → line 2 (schema) → applySchema() → full entity state
  → lines 3+ → store as frame array
  → enter replay mode with existing controls
```

Integration point: extend `recordingStore` to accept schema/delta frames
and route through `experimentStore.applyMessage()`.

### Error Handling

| Condition | Behavior |
|---|---|
| File too large (>1GB) | Warning dialog before loading |
| Truncated file | Load available frames, show "N of M frames loaded" |
| Unknown entity type | Render with DefaultEntity, log warning |
| Missing header | Treat as v1 format, infer arena from first schema |
| Decompression failure | "File appears corrupted" error |

## Key File References

| File | Current State | Change |
|---|---|---|
| `src/.../webviz_recorder.h` | `std::ofstream`, no compression | Add gzFile, entity filter, metadata header |
| `src/.../webviz_recorder.cpp` | Writes JSON-lines | Add gzip path, header, entity_types filter |
| `client-next/src/stores/recordingStore.ts` | Records `BroadcastMessage` only | Accept schema/delta, add `loadArgosrec()` |
| `client-next/src/ui/RecordingControls.tsx` | Record/replay live frames | Add file load button, metadata display |
| `client-next/src/ui/Toolbar.tsx` | Has recording controls | Add file open / drag-drop zone |
| `docs/FILE_FORMAT.md` | Does not exist | Create — .argosrec v2 spec |

## Assumptions

- [ ] zlib is available on all target platforms (already a build dependency)
- [ ] `pako` can decompress `.argosrec.gz` in the browser without blocking the UI
- [ ] JSON-lines is sufficient — binary format not needed for v1
- [ ] Sequential replay is acceptable (no random access)
- [ ] Files under 1GB are practical for browser loading

## Dependencies

- **Requires**: None (recorder already works standalone)
- **Enhanced by**: PN-002 (better deltas = smaller files)
- **Blocks**: None

## Open Questions

- Should the header embed the full `.argos` XML config, or just a hash?
- Web Worker for parsing large files to avoid UI freeze?
- Should live recordings be exportable as `.argosrec` (bridging R6)?

## Done When

- [ ] R1: Drag-and-drop `.argosrec.gz` → replay starts automatically
- [ ] R2: Metadata (timestamp, steps, arena) displayed in UI
- [ ] R3: Color-by, trails, links, heatmap all work during replay
- [ ] R4: 144k-step × 6-robot file is < 50MB compressed
- [ ] R5: Truncated file loads partially with warning
- [ ] R6: Live recording export to `.argosrec` works
- [ ] File format documented in `docs/FILE_FORMAT.md`

## Effort Estimate

| Component | Time |
|---|---|
| Gzip compression in recorder | 45 min |
| Header metadata + entity filter | 30 min |
| Client file loader + drag-and-drop | 1 hour |
| recordingStore schema/delta support | 30 min |
| Error handling + edge cases | 30 min |
| File format documentation | 20 min |
| End-to-end test (record → transfer → load → replay) | 30 min |
| **Total** | **~4 hours** |
| 2026-04-26 | Status updated to ✅ COMPLETE (housekeeping sync) | Housekeeping |
