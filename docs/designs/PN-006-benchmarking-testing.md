# PN-006 Design: Benchmarking & Testing Framework

Detailed implementation spec for [PN-006](../proposals/PN-006-benchmarking-testing.md).

## Merge Order (5 independent chunks)

Each MO is independently mergeable and testable.

| MO | Title | Depends On | Effort |
|----|-------|-----------|--------|
| MO-1 | Seeded RNG + new mock scenes | None | 1.5h |
| MO-2 | Vitest setup + unit tests | None | 2h |
| MO-3 | FPS history exposure + benchmark scripts | MO-1 | 2.5h |
| MO-4 | Playwright setup + core integration tests | MO-1 | 3h |
| MO-5 | CI pipeline (GitHub Actions) | MO-2, MO-4 | 45min |

C++ GTest extensions (delta_encoding, recorder_output) are a separate MO
that can be done anytime — they don't depend on the client-next work.

| MO-6 | C++ GTest extensions | None | 45min |

---

## MO-1: Seeded RNG + New Mock Scenes

### Seeded RNG

Replace `Math.random()` with a seeded PRNG. Use a simple mulberry32
(32-bit state, passes BigCrush):

```typescript
// src/mock/rng.ts
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
```

Inject into scenes via a `random` function on the `Scene` interface:

```typescript
// In server.ts startup:
const rng = mulberry32(42)  // fixed seed
// Pass rng to scene generators instead of Math.random
```

Changes:
- `src/mock/rng.ts` — new file, ~10 lines
- `src/mock/helpers.ts` — `randomWalk` and `makeProximityRays` accept `rng: () => number` parameter
- `src/mock/scenes.ts` — initial positions use seeded RNG, pass rng through `generate(step, rng)`
- `src/mock/server.ts` — create RNG at startup, pass to scene

### New Scenes

```typescript
// Add to scenes.ts:

// 500 robots — scalability ceiling
const stress_500: Scene = { /* same pattern as stress, 500 entities, arena(40,40) */ }

// 20 robots, all stationary — delta efficiency baseline
const delta_stationary: Scene = {
  description: '20 KheperaIVs, no movement',
  arena: arena(10, 10),
  generate: (step, rng) => {
    // Positions computed once from seed, never change
    return [...walls(10, 10), ...staticRobots(20, rng)]
  },
}

// 20 robots, 2 moving — partial delta
const delta_partial: Scene = { /* 18 static + 2 randomWalk */ }

// 20 robots, auto-runs 1000 steps — recording benchmark
const recording_1k: Scene = { maxSteps: 1000, /* swarm-like */ }

// Sends malformed messages — error handling
const malformed: Scene = { /* injects bad JSON periodically */ }
```

---

## MO-2: Vitest Setup + Unit Tests

### Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',  // stores are plain JS, no DOM needed
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

### package.json additions

```json
{
  "devDependencies": {
    "vitest": "^3.1.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Test Suites (5)

#### `tests/unit/experimentStore.test.ts`

Tests the three apply methods with known inputs:

```typescript
import { useExperimentStore } from '@/stores/experimentStore'

beforeEach(() => useExperimentStore.setState(useExperimentStore.getInitialState()))

test('applyBroadcast sets entities from array', () => {
  const msg = makeBroadcast([entity('r0', 1, 2)])
  useExperimentStore.getState().applyBroadcast(msg)
  expect(useExperimentStore.getState().entities.get('r0')?.position.x).toBe(1)
})

test('applyDelta merges changed fields only', () => {
  // Apply schema first, then delta with only position change
  // Assert: position changed, leds unchanged
})

test('applyDelta adds new entity', () => { /* ... */ })
test('applyBroadcast replaces all entities', () => { /* ... */ })
```

Helper: `makeBroadcast(entities)` builds a valid `BroadcastMessage`.

#### `tests/unit/connectionStore.test.ts`

Tests the state machine without a real WebSocket:

```typescript
test('initial state is disconnected', () => {
  expect(useConnectionStore.getState().status).toBe('disconnected')
})

test('send methods produce correct command objects', () => {
  // Mock the send function, call play(), verify { command: 'play' }
})
```

Note: Can't test actual WebSocket connection in Vitest (no browser).
Connection lifecycle is tested in Playwright integration tests.

#### `tests/unit/recordingStore.test.ts`

```typescript
test('captureFrame only records when state is recording', () => {
  const store = useRecordingStore.getState()
  store.captureFrame(makeBroadcast([]))
  expect(store.frames.length).toBe(0)  // not recording

  store.startRecording()
  store.captureFrame(makeBroadcast([]))
  expect(useRecordingStore.getState().frames.length).toBe(1)
})

test('loadRecording parses JSON and sets frames', () => { /* ... */ })
test('seekTo applies correct frame', () => { /* ... */ })
```

#### `tests/unit/protocol.test.ts`

Tests the `isServerMessage` guard and message parsing:

```typescript
test('valid broadcast is recognized', () => {
  expect(isServerMessage({ type: 'broadcast', state: 'EXPERIMENT_PLAYING', ... })).toBe(true)
})

test('malformed message is rejected', () => {
  expect(isServerMessage({ foo: 'bar' })).toBe(false)
  expect(isServerMessage(null)).toBe(false)
  expect(isServerMessage('string')).toBe(false)
})
```

Note: `isServerMessage` is currently not exported from `connection.ts`.
Need to extract it to a shared location or export it.

#### `tests/unit/vizEngine.test.ts`

```typescript
test('discoverFields finds user_data fields', () => {
  const entities = new Map([['r0', { ...baseEntity, user_data: { battery: 0.8, state: 'idle' } }]])
  const fields = discoverFields(entities)
  expect(fields).toContainEqual(expect.objectContaining({ fieldName: 'battery', type: 'number' }))
  expect(fields).toContainEqual(expect.objectContaining({ fieldName: 'state', type: 'string' }))
})

test('skips _prefixed fields', () => {
  const entities = new Map([['r0', { ...baseEntity, user_data: { _internal: 1, visible: 2 } }]])
  const fields = discoverFields(entities)
  expect(fields.find(f => f.fieldName === '_internal')).toBeUndefined()
})
```

### Shared Test Helpers

```typescript
// tests/helpers.ts
import { ExperimentState, type BroadcastMessage, type AnyEntity } from '@/types/protocol'

export function makeEntity(id: string, x = 0, y = 0): AnyEntity {
  return {
    type: 'kheperaiv', id,
    position: { x, y, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    leds: ['0x000000'], rays: [], points: [],
  } as AnyEntity
}

export function makeBroadcast(entities: AnyEntity[]): BroadcastMessage {
  return {
    type: 'broadcast',
    state: ExperimentState.EXPERIMENT_PLAYING,
    steps: 1, timestamp: Date.now(),
    arena: { size: { x: 10, y: 10, z: 1 }, center: { x: 0, y: 0, z: 0.5 } },
    entities,
  }
}
```

### Code Change Required

Extract `isServerMessage` from `src/protocol/connection.ts` to
`src/protocol/guards.ts` so it can be imported in tests:

```typescript
// src/protocol/guards.ts
import type { ServerMessage } from '../types/protocol'

export function isServerMessage(data: unknown): data is ServerMessage {
  if (typeof data !== 'object' || data === null) return false
  const t = (data as Record<string, unknown>)['type']
  return t === 'broadcast' || t === 'schema' || t === 'delta' || t === 'event' || t === 'log'
}
```

Then import it in `connection.ts`.

---

## MO-3: FPS History Exposure + Benchmark Scripts

### FPSCounter Changes

Add a per-frame history ring buffer exposed on `window`:

```typescript
// In FPSCounter.tsx, add to the component:
const history = useRef<number[]>([])

useFrame(() => {
  const now = performance.now()
  const delta = now - lastFrame.current
  lastFrame.current = now
  if (delta > 0) history.current.push(1000 / delta)
  if (history.current.length > 600) history.current.shift()  // 10s at 60fps

  // Expose for benchmarks
  ;(window as any).__fpsHistory = history.current

  // Existing 1-second display logic unchanged
})
```

### Benchmark Runner

```typescript
// benchmark/run.ts
// Orchestrates: start mock server → launch Playwright → collect metrics → report

import { chromium } from 'playwright'
import { spawn } from 'child_process'

const SCENES = ['empty', 'single', 'swarm', 'stress', 'stress_500']
const WARMUP_FRAMES = 60
const MEASURE_FRAMES = 300

async function benchmarkFPS() {
  const results: Record<string, { p50: number; p95: number; min: number }> = {}

  for (const scene of SCENES) {
    const server = spawn('npx', ['tsx', 'src/mock/server.ts', scene], { stdio: 'pipe' })
    await sleep(2000)  // wait for server

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('http://localhost:5173')
    await page.waitForTimeout(1000)

    // Play and wait for frames
    // The mock server auto-broadcasts at 10Hz, client renders at rAF rate
    await page.waitForTimeout((WARMUP_FRAMES + MEASURE_FRAMES) / 60 * 1000 + 2000)

    const fps: number[] = await page.evaluate(() => (window as any).__fpsHistory ?? [])
    const measured = fps.slice(-MEASURE_FRAMES)

    const sorted = [...measured].sort((a, b) => a - b)
    results[scene] = {
      p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      min: sorted[0] ?? 0,
    }

    await browser.close()
    server.kill()
  }

  return results
}
```

### Bandwidth Benchmark

```typescript
// benchmark/bandwidth.ts
async function benchmarkBandwidth() {
  // Use Playwright's WebSocket interception
  const page = await browser.newPage()

  const messages: { size: number; type: string }[] = []
  page.on('websocket', ws => {
    ws.on('framereceived', frame => {
      messages.push({ size: frame.payload.length, type: 'received' })
    })
  })

  await page.goto('http://localhost:5173')
  await page.waitForTimeout(10000)  // collect 10s of data

  const totalBytes = messages.reduce((s, m) => s + m.size, 0)
  const bytesPerFrame = totalBytes / messages.length
  const messagesPerSecond = messages.length / 10

  return { totalBytes, bytesPerFrame, messagesPerSecond, frameCount: messages.length }
}
```

### Output Format

```
=== FPS Benchmark ===
Scene          | Entities | p50 FPS | p95 FPS | Min FPS
empty          |        4 |      60 |      60 |      58
single         |        5 |      60 |      60 |      57
swarm          |       24 |      60 |      59 |      52
stress         |      104 |      45 |      38 |      31
stress_500     |      504 |      22 |      18 |      14

=== Bandwidth Benchmark ===
Mode           | Bytes/Frame | Msgs/sec | Total (10s)
full_broadcast |       12847 |       10 |     128470
delta_static   |         142 |       10 |       1420
delta_partial  |        1893 |       10 |      18930

=== Recording Benchmark ===
Scenario              | File Size | Export Time
1000 steps × 20 bots  |    4.2 MB |       340ms
```

Also write to `benchmark/results.json` for programmatic comparison.

### package.json

```json
{
  "scripts": {
    "benchmark": "tsx benchmark/run.ts",
    "benchmark:fps": "tsx benchmark/fps.ts",
    "benchmark:bandwidth": "tsx benchmark/bandwidth.ts"
  }
}
```

---

## MO-4: Playwright Setup + Core Integration Tests

### Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/integration',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'npx tsx src/mock/server.ts swarm',
      port: 3000,
      reuseExistingServer: true,
    },
    {
      command: 'npx vite --port 5173',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
})
```

Key decision: Playwright's `webServer` config auto-starts both the mock
server and the Vite dev server before tests, and kills them after. No
manual server management needed.

### Shared Fixture

```typescript
// tests/integration/fixtures.ts
import { test as base, expect } from '@playwright/test'

export const test = base.extend<{ connected: void }>({
  connected: [async ({ page }, use) => {
    await page.goto('/')
    // Wait for WebSocket connection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', { timeout: 5000 })
    await use()
  }, { auto: true }],
})

export { expect }
```

This requires a `data-testid="connection-status"` attribute on the
connection indicator in the UI. If it doesn't exist, add it.

### Core Tests (6)

```typescript
// tests/integration/controls.test.ts
import { test, expect } from './fixtures'

test('play increases step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1500)
  const steps = await page.locator('[data-testid="step-counter"]').textContent()
  expect(Number(steps)).toBeGreaterThan(0)
})

test('pause stops step counter', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1000)
  await page.click('[data-testid="pause-btn"]')
  const stepsA = await page.locator('[data-testid="step-counter"]').textContent()
  await page.waitForTimeout(1000)
  const stepsB = await page.locator('[data-testid="step-counter"]').textContent()
  expect(stepsA).toBe(stepsB)
})

test('step increments by 1', async ({ page }) => {
  await page.click('[data-testid="step-btn"]')
  await page.click('[data-testid="step-btn"]')
  await page.click('[data-testid="step-btn"]')
  await page.waitForTimeout(500)
  const steps = await page.locator('[data-testid="step-counter"]').textContent()
  expect(Number(steps)).toBe(3)
})

test('reset returns to step 0', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1000)
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  const steps = await page.locator('[data-testid="step-counter"]').textContent()
  expect(Number(steps)).toBe(0)
})

test('fast forward advances faster', async ({ page }) => {
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(1000)
  const normalSteps = Number(await page.locator('[data-testid="step-counter"]').textContent())
  await page.click('[data-testid="reset-btn"]')
  await page.waitForTimeout(500)
  await page.click('[data-testid="ff-btn"]')
  await page.waitForTimeout(1000)
  const ffSteps = Number(await page.locator('[data-testid="step-counter"]').textContent())
  expect(ffSteps).toBeGreaterThan(normalSteps)
})
```

```typescript
// tests/integration/recording.test.ts
import { test, expect } from './fixtures'

test('record and replay cycle', async ({ page }) => {
  // Start recording
  await page.click('[data-testid="record-btn"]')
  await page.click('[data-testid="play-btn"]')
  await page.waitForTimeout(2000)
  await page.click('[data-testid="pause-btn"]')
  await page.click('[data-testid="stop-record-btn"]')

  // Verify frames were captured (recording controls should show frame count)
  const frameCount = await page.locator('[data-testid="frame-count"]').textContent()
  expect(Number(frameCount)).toBeGreaterThan(0)
})
```

### UI data-testid Requirements

The tests depend on `data-testid` attributes on toolbar buttons and
status indicators. These need to be added to:

| Component | Element | data-testid |
|-----------|---------|-------------|
| `Toolbar.tsx` | Play button | `play-btn` |
| `Toolbar.tsx` | Pause button | `pause-btn` |
| `Toolbar.tsx` | Step button | `step-btn` |
| `Toolbar.tsx` | Reset button | `reset-btn` |
| `Toolbar.tsx` | Fast-forward button | `ff-btn` |
| `Toolbar.tsx` | Step counter display | `step-counter` |
| `Toolbar.tsx` | Connection indicator | `connection-status` |
| `RecordingControls.tsx` | Record button | `record-btn` |
| `RecordingControls.tsx` | Stop record button | `stop-record-btn` |
| `RecordingControls.tsx` | Frame count | `frame-count` |

This is a prerequisite code change — add `data-testid` props to the
existing components. No behavioral changes.

The `ToolbarButton` wrapper component needs to forward extra props
(or accept a `testId` prop) since it currently doesn't spread them:

```typescript
function ToolbarButton({ icon: Icon, label, active, onClick, testId }: {
  icon: React.ElementType; label: string; active?: boolean; onClick: () => void; testId?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ... data-testid={testId}>
```

Then in usage: `<ToolbarButton icon={Play} label="Play" ... testId="play-btn" />`

The step counter is a plain `<span>` — just add `data-testid="step-counter"`.
The connection status indicator is a `<span>` — add `data-testid="connection-status"`.

---

## MO-5: CI Pipeline (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [client-next]
  pull_request:
    branches: [client-next]

jobs:
  client-unit:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client-next
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: client-next/package-lock.json
      - run: npm ci
      - run: npm test

  client-integration:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client-next
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: client-next/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test

  # C++ tests require ARGoS — run only if src/ changed
  cpp-tests:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.message, '[cpp]') || github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - name: Install ARGoS
        run: |
          sudo apt-get update
          sudo apt-get install -y cmake g++ zlib1g-dev libssl-dev
          # ARGoS install steps TBD — depends on available packages
      - name: Build and test
        run: |
          mkdir -p build && cd build
          cmake -DCMAKE_BUILD_TYPE=Debug ../src
          cmake --build . --parallel
          GTEST_COLOR=1 ctest -V
```

Note: C++ tests are gated because ARGoS installation on CI is non-trivial
(the Travis config downloads a .deb from Google Drive). This needs a
proper solution — either a Docker image with ARGoS pre-installed, or
publishing ARGoS packages to a PPA. For now, C++ tests run on-demand
via commit message tag `[cpp]`.

---

## MO-6: C++ GTest Extensions

### `delta_encoding.cpp`

Tests `ComputeDelta` logic. Since `ComputeDelta` is a private method of
`CWebvizRecorder`, we can't test it directly. Two options:

**Option A (preferred):** Extract delta logic to a free function:

```cpp
// utility/delta.h
namespace webviz {
  nlohmann::json ComputeDelta(
    const nlohmann::json& cCurrent,
    const nlohmann::json& cPrevious);
}
```

Then test the free function:

```cpp
TEST(DeltaEncoding, UnchangedFieldsOmitted) {
  json prev = json::array({{ {"id","r0"}, {"type","kheperaiv"}, {"position",{{"x",1},{"y",2},{"z",0}}} }});
  json curr = prev;  // identical
  json delta = webviz::ComputeDelta(curr, prev);
  EXPECT_TRUE(delta.empty());
}

TEST(DeltaEncoding, ChangedFieldIncluded) {
  json prev = json::array({{ {"id","r0"}, {"type","kheperaiv"}, {"position",{{"x",1},{"y",2},{"z",0}}} }});
  json curr = json::array({{ {"id","r0"}, {"type","kheperaiv"}, {"position",{{"x",3},{"y",2},{"z",0}}} }});
  json delta = webviz::ComputeDelta(curr, prev);
  EXPECT_TRUE(delta.contains("r0"));
  EXPECT_EQ(delta["r0"]["position"]["x"], 3);
  EXPECT_FALSE(delta["r0"].contains("type"));  // type/id never in delta
}

TEST(DeltaEncoding, NewEntityIncludedFull) {
  json prev = json::array();
  json curr = json::array({{ {"id","r0"}, {"type","kheperaiv"}, {"position",{{"x",1},{"y",2},{"z",0}}} }});
  json delta = webviz::ComputeDelta(curr, prev);
  EXPECT_TRUE(delta.contains("r0"));
  EXPECT_TRUE(delta["r0"].contains("type"));  // full entity for new
}
```

**Option B:** Test via file output — write a .argosrec, parse lines,
verify delta structure. This requires ARGoS running, so it's an
integration test, not a unit test. Defer to Option A.

### `recorder_output.cpp`

This is harder to unit test because `CWebvizRecorder::Execute()` needs
the full ARGoS simulator. Instead, test the `SerializeEntity` function
and the `WriteFrame` output format:

```cpp
TEST(RecorderOutput, WriteFrameProducesValidJSON) {
  // Write to a stringstream, parse back
  std::stringstream ss;
  json frame = {{"type", "schema"}, {"step", 0}, {"entities", json::array()}};
  ss << frame.dump(-1) << '\n';
  
  std::string line;
  std::getline(ss, line);
  json parsed = json::parse(line);
  EXPECT_EQ(parsed["type"], "schema");
}
```

The `SerializeEntity` function is `static` in `webviz_recorder.cpp` —
it would need to be moved to a header or made non-static to be testable.
This is a small refactor.

---

## `docs/BENCHMARKS.md` Format

```markdown
# Benchmark Results

Last updated: YYYY-MM-DD
Hardware: <CPU>, <RAM>, <GPU>
Node: <version>, Chrome: <version>

## FPS

| Scene | Entities | p50 | p95 | Min |
|-------|----------|-----|-----|-----|
| empty | 4 | — | — | — |
| ...   | ... | ... | ... | ... |

## Bandwidth

| Mode | Bytes/Frame | Msgs/sec |
|------|-------------|----------|
| full_broadcast | — | — |
| delta_stationary | — | — |
| delta_partial | — | — |

## Recording

| Scenario | File Size | Export Time |
|----------|-----------|-------------|
| 1000 steps × 20 bots | — | — |

## History

| Date | Change | Notable Deltas |
|------|--------|---------------|
| YYYY-MM-DD | Baseline | — |
```

---

## Key Decisions

1. **Vitest over Jest** — native Vite integration, same alias resolution, faster. No config duplication.

2. **Playwright over Cypress** — better WebSocket support (`page.on('websocket')`), native ESM, lighter. Cypress has no WebSocket interception.

3. **Seeded mulberry32 over seedrandom library** — zero dependencies, 5 lines, sufficient quality for mock data. No npm package needed.

4. **`data-testid` over CSS selectors** — resilient to styling changes, explicit test contract, standard practice.

5. **Extract `ComputeDelta` to free function** — makes it unit-testable without ARGoS. Small refactor, big testability win.

6. **Don't gate CI on FPS numbers** — CI runners have variable performance. Track trends, don't fail builds.

7. **Playwright `webServer` config** — auto-manages mock server and Vite dev server lifecycle. No manual process management in tests.

8. **C++ tests gated on `[cpp]` tag** — ARGoS installation on CI is non-trivial. Defer proper CI ARGoS setup to a follow-up.
