# Contributing to ARGoS3-WebViz

We welcome contributions across both the C++ plugin and the web client. This guide covers workflows for each.

## Getting Started

1. Fork the repo and create your branch from `master`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Issue a pull request.

All contributions are licensed under the [MIT License](http://choosealicense.com/licenses/mit/).

## Repository Layout

```
src/          C++ ARGoS visualization plugin (WebSocket server, entity serializers, recorder)
client/       Legacy HTML/JS/CSS web client
client-next/  Modern React + R3F + Vite client (active development)
docs/         Documentation and proposals
```

## C++ Plugin (`src/`)

### Build

```console
$ mkdir build && cd build
$ cmake -DCMAKE_BUILD_TYPE=Debug ../src
$ make
$ sudo make install
```

Extra dev packages: `cppcheck`, `lcov`.

### Run Tests

```console
$ GTEST_COLOR=1 ctest -V
```

### Style

- Hungarian Notation to match ARGoS conventions.
- 2-space indentation, 80-char line length.
- Match the patterns in existing files (e.g. `webviz.cpp`, `webviz_recorder.cpp`).

## Web Client (`client-next/`)

### Setup

```console
$ cd client-next
$ npm install
$ npm run dev          # Vite dev server
$ npm run mock         # Mock WebSocket server (no ARGoS needed)
```

### Stack

- Vite 5, React 19, TypeScript (strict)
- React Three Fiber + Drei for 3D
- Zustand for state management
- Tailwind v4 + shadcn/ui components

### Style

- TypeScript strict — no `any` unless unavoidable.
- Zustand stores in `src/stores/`, one per concern.
- Entity renderers in `src/entities/renderers/` — register via `registry.ts`.
- UI components in `src/ui/`, reusable primitives in `src/components/ui/`.

### Adding an Entity Renderer

1. Create `src/entities/renderers/YourEntity.tsx`.
2. Register it in `src/entities/renderers/index.ts`.
3. The renderer receives entity data as props including an optional `overrideColor`.

## Protocol Changes

The WebSocket protocol is shared between C++ and client-next. If you change message formats:

1. Update C++ serialization in `src/`.
2. Update TypeScript types in `client-next/src/types/protocol.ts`.
3. Update stores that consume messages (`experimentStore.ts`, `connectionStore.ts`).
4. Ensure backwards compatibility — new fields should be optional.

## Proposals

For larger changes, write a proposal before coding:

1. Copy `docs/proposals/TEMPLATE.md` to `docs/proposals/000-your-title.md`.
2. Fill in motivation, design, and implementation plan.
3. Open a PR with just the proposal for discussion.

## Reporting Bugs

Open a [GitHub issue](https://github.com/NESTLab/argos3-webviz/issues) with:

- Summary and steps to reproduce.
- Expected vs actual behavior.
- Sample code or ARGoS config if applicable.
- Which component is affected (C++ plugin, client, client-next).
