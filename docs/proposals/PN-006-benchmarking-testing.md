# Proposal: Benchmarking & Testing Framework

Created: 2026-04-13
Baseline Commit: `aa1ffd1` (`client-next`)
GitHub Issue: #6

## Status: 🟡 DESIGN
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Establish a testing and benchmarking framework that verifies system correctness,
measures performance, and catches regressions — covering both the C++ plugin
(with ARGoS) and the client-next UI (with the mock server).

## Scope Boundary

**In scope:**
- Client-next UI functional tests (controls, recording, panels)
- Client-next rendering performance benchmarks (FPS at various entity counts)
- Protocol benchmarks (bandwidth, latency, message size)
- Recording benchmarks (file size, load time — current format only)
- Mock server test harness for reproducible client testing
- Seeded RNG in mock server for deterministic, reproducible benchmarks
- C++ plugin unit tests (extending existing GTest suite)
- CI-friendly test runner (GitHub Actions, migrating from Travis CI)

**Out of scope:**
- ❌ ARGoS simulation correctness (that's ARGoS's job)
- ❌ Visual regression testing / screenshot comparison (complex, future work)
- ❌ Load testing with hundreds of concurrent browser clients
- ❌ Cross-browser testing (Chrome-only for v1)

## Current State

**What exists:**

C++ side:
- GTest suite in `src/tests/` — 5 utility tests (timer, base64, experiment state,
  logstream, port check)
- `lcov` coverage target in CMake
- `ctest -V` runner

Client-next side:
- Mock WebSocket server (`src/mock/server.ts`) with 6 scenes: empty, single,
  swarm (20 robots), mixed (multi-type), stress (100 robots), corridor (6 robots
  with sync user_data)
- No test framework installed (no vitest, jest, playwright, or cypress in package.json)
- No automated tests of any kind
- FPS counter exists in UI (`FPSCounter.tsx`) but doesn't log or report

**What's missing:**
- No client-next test framework
- No automated UI interaction tests (play/pause/step/reset)
- No performance benchmarks with defined thresholds
- No protocol bandwidth measurement
- No recording size benchmarks
- No regression detection between commits
- Mock server runs manually — not integrated into a test harness

## Affected Components

- [x] Next client (`client-next/`) — test framework, benchmark scripts
- [x] C++ plugin (`src/`) — extended GTest suite, protocol benchmarks
- [ ] Legacy client (`client/`)
- [x] Protocol / message format — bandwidth measurement
- [x] Build system / CMake — test targets
- [x] Documentation — benchmark results, test guide

## Design

### Test Categories

```
tests/
├── unit/           Client-next unit tests (stores, protocol, viz engine)
├── integration/    UI interaction tests (controls, recording, panels)
├── benchmark/      Performance measurement (FPS, bandwidth, file size)
└── e2e/            End-to-end with mock server (connect → interact → verify)
```

### A. Client-Next Unit Tests

Framework: **Vitest** (native Vite integration, fast, TypeScript-first).

| Test Suite | What It Covers |
|---|---|
| `experimentStore.test.ts` | `applyBroadcast`, `applySchema`, `applyDelta` — correct entity state after each message type |
| `connectionStore.test.ts` | Connection state machine (disconnected → connecting → connected), auto-reconnect |
| `recordingStore.test.ts` | Record frames, export JSON, import JSON, replay frame sequencing |
| `protocol.test.ts` | Message parsing, validation, malformed message handling |
| `vizEngine.test.ts` | Field discovery, type classification |

> **Note:** Tests for PN-005 features (computed fields, WEBVIZ_EXPOSE) will be added when PN-005 is implemented.

### B. UI Integration Tests

Framework: **Playwright** (headless browser, real DOM, real WebSocket).

Test flow: start mock server → launch client in headless Chrome → interact → assert.

**Core tests** (required for Done When):

| Test | Steps | Assertion |
|---|---|---|
| **Play/Pause** | Connect → click Play → wait 1s → click Pause | Step counter increases then stops |
| **Step** | Connect → click Step 3 times | Step counter = 3 |
| **Reset** | Play → wait → Reset | Step counter = 0, entities at initial positions |
| **Fast Forward** | Play → click FF → wait | Step counter advances faster than real-time |
| **Recording Start/Stop** | Click Record → wait → Stop → check download | `.json` file downloaded with frames |
| **Recording Replay** | Load recording → Play → scrub | Entities move, scrubber updates |

**Extended tests** (stretch goals):

| Test | Steps | Assertion |
|---|---|---|
| **Entity Selection** | Click entity in sidebar | Inspector shows entity data, selection ring visible |
| **Keyboard Shortcuts** | Press Space, Right, R, F | Same as button equivalents |
| **Settings Panel** | Open settings → change WS URL | Connection attempts new URL |
| **Camera Presets** | Click Isometric, Top-down, Side, Follow | Camera position changes (verify via canvas state) |
| **Environment Switch** | Select Grid, Grass, Desert | Scene background changes |
| **Log Panel** | Trigger LOG and LOGERR messages | Messages appear in correct tabs, error badge updates |
| **Fullscreen** | Click fullscreen toggle | Viewport expands |
| **Screenshot** | Click screenshot button | PNG file downloaded |

### C. Performance Benchmarks

Run against mock server scenes with known entity counts. Report metrics to
stdout in a parseable format for CI comparison.

#### FPS Benchmarks

| Scene | Entity Count | Target FPS | Measures |
|---|---|---|---|
| empty | 4 walls | ≥60 | Baseline rendering overhead |
| single | 1 robot | ≥60 | Single entity rendering |
| swarm | 20 robots | ≥60 | Typical experiment |
| stress | 100 robots | ≥30 | Instanced rendering effectiveness |
| stress_500 | 500 robots (new scene) | ≥15 | Scalability ceiling |

Measurement: run for 300 frames, report p50/p95/min FPS.

```typescript
// benchmark/fps.ts
const results = await page.evaluate(() => {
  return (window as any).__fpsHistory  // FPSCounter already tracks this
})
```

#### Protocol Bandwidth Benchmarks

| Metric | How | Target |
|---|---|---|
| Bytes/frame (full broadcast) | Measure WebSocket message size | Baseline |
| Bytes/frame (delta, 0% change) | All entities stationary | <5% of full |
| Bytes/frame (delta, 10% change) | 10% of entities moving | <20% of full |
| Bytes/frame (delta, 100% change) | All entities moving | ~100% of full |
| Messages/second | Count over 10s window | Match broadcast Hz |
| Round-trip latency | Send command, measure time to state change | <50ms |

Measurement: WebSocket interceptor in Playwright, or instrumented mock server.

#### Recording Benchmarks

| Metric | Scenario | Target |
|---|---|---|
| File size (uncompressed JSON) | 1000 steps × 20 entities | Baseline |
| Load time (browser) | 10MB file | <2s |
| Export time | 1000 frames from recordingStore | <1s |

> **Note:** Compression benchmarks (gzip, delta+gzip) will be added with PN-003.

Measurement: mock server generates known data, client records, measure output.

### D. Mock Server Test Harness

Extend the mock server to support programmatic control:

```typescript
// mock/testHarness.ts
interface TestServer {
  start(scene: string, options?: { hz?: number; delta?: boolean }): Promise<void>
  stop(): Promise<void>
  getStats(): { messagesSent: number; bytesSent: number; connections: number }
  injectMessage(msg: ServerMessage): void  // send arbitrary message
  waitForCommand(type: string): Promise<ClientCommand>  // wait for client command
}
```

New test scenes:

| Scene | Purpose |
|---|---|
| `stress_500` | 500 robots for scalability benchmarks |
| `delta_stationary` | 20 robots, none moving — measures delta efficiency |
| `delta_partial` | 20 robots, 2 moving — measures partial delta |
| `recording_1k` | 20 robots, auto-runs 1000 steps then stops — recording benchmark |
| `malformed` | Sends invalid messages — tests error handling |

### E. C++ Plugin Tests (Extended)

Add to existing GTest suite:

| Test | What It Covers |
|---|---|
| `delta_encoding.cpp` | `ComputeDelta()` correctness — unchanged fields omitted, changed fields present |
| `recorder_output.cpp` | `.argosrec` file format — header line valid JSON, schema line has all entities, delta lines have only changes |

> **Note:** `entity_serialization.cpp` and `webviz_expose.cpp` tests depend on PN-005 and will be added when that proposal is implemented.

### F. CI Integration

```yaml
# .github/workflows/test.yml
jobs:
  cpp-tests:
    - cmake -DCMAKE_BUILD_TYPE=Debug ../src
    - make
    - GTEST_COLOR=1 ctest -V

  client-unit:
    - cd client-next && npm ci
    - npx vitest run

  client-integration:
    - cd client-next && npm ci
    - npx tsx src/mock/server.ts swarm &
    - npx playwright test

  benchmarks:
    - cd client-next && npm ci
    - npx tsx benchmark/run.ts
    - # Compare against baseline, fail if >20% regression
```

## Key File References

| File | Current State | Change |
|---|---|---|
| `client-next/package.json` | No test deps | Add vitest, playwright, @playwright/test |
| `client-next/vitest.config.ts` | Does not exist | Create — Vitest config |
| `client-next/playwright.config.ts` | Does not exist | Create — Playwright config |
| `client-next/tests/unit/` | Does not exist | Create — unit test suites |
| `client-next/tests/integration/` | Does not exist | Create — Playwright UI tests |
| `client-next/benchmark/` | Does not exist | Create — FPS, bandwidth, recording benchmarks |
| `client-next/src/mock/server.ts` | 6 scenes, manual start | Add test harness, new scenes |
| `client-next/src/mock/scenes.ts` | 6 scenes | Add stress_500, delta_*, recording_1k, malformed |
| `client-next/src/scene/FPSCounter.tsx` | Displays FPS in UI (1-second bucket, no history) | Expose `window.__fpsHistory` array for benchmark collection |
| `client-next/src/mock/scenes.ts` | 6 scenes, non-deterministic | Add stress_500, delta_*, recording_1k, malformed scenes; add seeded RNG |
| `client-next/src/mock/server.ts` | 6 scenes, manual start | Add test harness, new scenes |
| `src/tests/modules/` | 5 utility tests | Add delta encoding and recorder output tests |
| `.github/workflows/test.yml` | Does not exist | Create — CI pipeline (replaces `.travis.yml`) |

## Assumptions

- [x] Playwright can intercept WebSocket messages for bandwidth measurement — confirmed via `page.on('websocket')` API
- [ ] Headless Chrome FPS measurement via `requestAnimationFrame` timing is reliable — partially valid; headless Chrome throttles rAF differently; FPSCounter needs `__fpsHistory` exposure (added to scope)
- [ ] Mock server is deterministic enough for reproducible benchmarks — currently invalid (`Math.random()` everywhere); seeded RNG added to scope
- [x] GTest is sufficient for C++ delta/recorder tests (no need for integration with ARGoS simulator)
- [x] CI runners have Node.js and Chrome available — confirmed for GitHub Actions ubuntu-latest

## Dependencies

- **Requires**: None
- **Enhanced by**: All other proposals (each adds testable surface area)
- **Blocks**: PN-002 (needs baseline measurements before optimization)

## Open Questions (Resolved)

- **Benchmarks on every PR or nightly?** → Tests on every push; FPS benchmarks nightly. FPS numbers are too variable on CI runners for per-PR gating.
- **Regression threshold?** → Don't gate CI on FPS. Track trends in `docs/BENCHMARKS.md`. Gate on test pass/fail only.
- **Specific hardware profile?** → No. Track relative changes. Document hardware in benchmark output.
- **Playwright vs Vitest+happy-dom?** → Playwright for integration tests (WebSocket + canvas require real browser). Vitest for unit tests (stores are plain functions).

## Done When

- [ ] `npm test` runs unit tests via Vitest, all pass
- [ ] `npm run test:integration` runs 6 core Playwright UI tests against mock server, all pass
- [ ] `npm run benchmark` reports FPS (p50/p95/min) for all scenes
- [ ] `npm run benchmark` reports bandwidth per frame for full and delta modes
- [ ] `npm run benchmark` reports recording file sizes (current uncompressed format)
- [ ] Play/pause/step/reset/ff verified by automated tests
- [ ] Recording start/stop/replay verified by automated tests
- [ ] C++ GTest suite includes delta encoding and recorder output tests
- [ ] CI pipeline (GitHub Actions) runs all tests on push to `client-next`
- [ ] Baseline benchmark numbers documented in `docs/BENCHMARKS.md`
- [ ] Mock server uses seeded RNG for reproducible benchmarks

## Effort Estimate

| Component | Time |
|---|---|
| Vitest setup + 5 unit test suites | 2 hours |
| Playwright setup + 6 core integration tests | 3 hours |
| Extended integration tests (8, stretch) | 3 hours |
| Mock server seeded RNG + test harness | 1.5 hours |
| FPSCounter `__fpsHistory` exposure | 15 min |
| FPS benchmark script + new scenes | 1.5 hours |
| Protocol bandwidth benchmark | 1 hour |
| Recording size benchmark | 30 min |
| C++ GTest extensions (2 test files) | 45 min |
| CI workflow (GitHub Actions, replacing Travis) | 45 min |
| Documentation (`docs/BENCHMARKS.md`) | 30 min |
| **Total (core)** | **~12 hours** |
| **Total (with extended tests)** | **~15 hours** |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| 2026-04-13 | Initial draft | 📋 INVESTIGATION |
| 2026-04-13 | Post-investigation critique: removed PN-005 dependencies (computedFields.test.ts, webviz_expose.cpp, entity_serialization.cpp), scoped recording benchmarks to current format only, added seeded RNG to scope, added FPSCounter __fpsHistory exposure, split Playwright tests into core/extended, resolved open questions, updated effort estimate to 12-15h, validated assumptions | 🔍 CRITIQUE |
| 2026-04-13 | Advanced to DESIGN | 🟡 DESIGN |
