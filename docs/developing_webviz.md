# Developing Webviz

## Project Structure

```
argos3-webviz/
├── src/                          # C++ plugin source
│   ├── plugins/simulator/visualizations/webviz/
│   │   ├── webviz.cpp/h          # Main visualization class, sim loop, broadcast
│   │   ├── webviz_webserver.cpp/h # uWebSockets server, topic publish
│   │   ├── webviz_user_functions.cpp/h  # User function base class
│   │   ├── webviz_draw_functions.cpp/h  # Draw primitives (circles, rays, text)
│   │   ├── webviz_recorder.cpp/h  # .argosrec recording
│   │   └── entity/               # Per-entity JSON serializers
│   ├── testing/                  # Test experiment configs and controllers
│   └── CMakeLists.txt
├── client-next/                  # React/TypeScript web client
│   ├── src/
│   │   ├── protocol/            # WebSocket connection, message guards
│   │   ├── stores/              # Zustand state stores
│   │   ├── entities/            # Entity renderers (Three.js)
│   │   ├── scene/               # 3D scene components
│   │   ├── ui/                  # UI panels and controls
│   │   ├── hooks/               # React hooks
│   │   ├── lib/                 # Utilities (computed fields, spatial hash, etc.)
│   │   └── types/               # TypeScript type definitions
│   └── tests/                   # Vitest unit tests
├── client/                      # Legacy Three.js client (deprecated)
└── docs/                        # Documentation
```

## C++ Plugin

### Prerequisites

- ARGoS3 installed
- CMake ≥ 3.16
- zlib, OpenSSL (optional, for SSL)

### Build

```console
$ mkdir build && cd build
$ cmake -DCMAKE_BUILD_TYPE=Debug ../src
$ make -j$(nproc)
```

Debug mode enables `-Wfatal-errors` and cppcheck integration if available.

### Run tests

```console
$ argos3 -c src/testing/testexperiment.argos
```

### Architecture

The plugin runs three threads:

1. **Sim thread** — runs `UpdateSpace()`, calls `BroadcastExperimentState()`, drains command queue
2. **uWS event loop** — handles WebSocket connections, receives client commands, enqueues them
3. **Broadcaster thread** — copies the latest broadcast string/bytes and publishes to subscribed clients at `broadcast_frequency` Hz

Commands from clients are enqueued via `EnqueueCommand()` and drained on the sim thread before each step. A condition variable wakes the sim thread immediately when commands arrive (no 250ms polling delay).

## Web Client (client-next)

### Prerequisites

- Node.js ≥ 18

### Development

```console
$ cd client-next
$ npm install
$ npm run dev          # Vite dev server → http://localhost:5173
$ npm run mock         # Mock WebSocket server (no ARGoS needed)
$ npm test             # Run vitest unit tests
$ npx tsc --noEmit     # Type check
```

### Stack

- **React 19** + TypeScript
- **Three.js** via React Three Fiber — 3D rendering
- **Zustand** — state management
- **Tailwind CSS** + shadcn/ui — UI components
- **Vite** — build tool
- **Vitest** — unit tests
- **Playwright** — integration tests

### Key stores

| Store | Purpose |
|-------|---------|
| `experimentStore` | Entity state, computed fields, draw commands |
| `connectionStore` | WebSocket connection, command dispatch |
| `vizConfigStore` | Visualization settings (color-by, trails, heatmap) |
| `recordingStore` | Recording/replay, .argosrec loading |
| `settingsStore` | User preferences |

### Adding a new entity renderer

1. Create `src/entities/renderers/MyEntity.tsx`
2. Register in `src/entities/renderers/index.ts`
3. See [Custom entity: client side](custom_entity_clientside.md)
