# Contributing to ARGoS3-WebViz

We welcome contributions across both the C++ plugin and the web client. This repo is maintained by both humans and AI agents — the conventions below are designed to work for both.

## Proposals

All non-trivial changes go through a proposal. This is the primary planning mechanism.

**Proposals live as GitHub issues** using the Proposal issue template. The issue body IS the proposal — it tracks the plan, design, status, and changelog. No local file needed (though `docs/proposals/` holds working drafts).

To create a proposal: New Issue → Proposal template → fill in, title as `PN-xxx: Title`.

To edit a proposal locally:
```bash
gh issue view <N> --json body -q .body > /tmp/PN-xxx.md  # pull to edit locally
gh issue edit <N> --body-file /tmp/PN-xxx.md              # push edits back
```

**Template:** `docs/proposals/TEMPLATE.md` (reference copy — the GitHub issue template embeds it)

**Index:** `docs/proposals/README.md` (status table, dependency graph, implementation order)

### Lifecycle

```
📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED
```

| Phase | What Happens | Gate to Next |
|-------|-------------|-------------|
| 📋 INVESTIGATION | Problem analysis, current state audit, scope definition | Scope + assumptions validated |
| 🔍 CRITIQUE | Review for gaps, wrong assumptions, missing context | Critique issues resolved |
| 🟡 DESIGN | Technical approach, key decisions, pseudocode, file references | Design reviewed |
| 🔍 CRITIQUE | Review for feasibility, edge cases, missing pieces | Critique issues resolved |
| 🔵 IMPLEMENTATION | Code written, tests added | Done-when criteria met |
| 🟣 VERIFICATION | Regression tests pass, success criteria checked | All checks pass |
| ✅ COMPLETE | Proposal closed, PR merged | — |

Critique phases are explicit gates. An agent running a proposal workflow must pass through critique before advancing — no skipping to implementation.

### Design Docs

For code-heavy proposals, put detailed specs in `docs/designs/PN-xxx-<name>.md` and link from the proposal. The proposal captures intent; the design doc captures specifics (function signatures, data structures, config files).

## Branch Naming

```
PN-xxx/<author>/<descriptive-name>
```

| Segment | Purpose | Examples |
|---------|---------|---------|
| `PN-xxx` | Which proposal | `PN-003`, `PN-007` |
| Author | Who created it | `AI`, `davis` |
| Name | What it does | `cmake-targets`, `leo-renderer` |

Examples:
```
PN-001/davis/cmake-targets        # Human implementation work
PN-007/AI/leo-renderer            # AI-created implementation
PN-006/AI/vitest-setup            # AI-created test infrastructure
```

For non-proposal work (quick fixes, typos), use `fix/` or `feature/` prefixes.

## Pull Requests

One PR per proposal. Multiple commits are fine.

1. Open a PR targeting `client-next` (or `master` for upstream-ready changes)
2. Title: `PN-xxx: <proposal title>`
3. Link the proposal issue in the body: `Closes #N`
4. Merge after review — closes the proposal issue automatically

## GitHub Issues

Two templates:

| Template | Use For |
|----------|---------|
| **Proposal** | Planning a body of work (PN-xxx) |
| **Issue / Bug / Task** | Something found or broken that doesn't need a full proposal |

Implementation tasks that come out of proposals are titled: `PN-xxx: Descriptive title`

## Labels

| Label | Purpose |
|-------|---------|
| `proposal` | Proposal documents (the PN-xxx issues) |
| `PN-xxx` | Links any issue to its parent proposal |
| `c++` | C++ plugin changes |
| `client-next` | Web client changes |
| `protocol` | Message format changes |

## Repository Layout

```
src/              C++ ARGoS visualization plugin (WebSocket server, entity serializers, recorder)
client/           Legacy HTML/JS/CSS web client
client-next/      Modern React + R3F + Vite client (active development)
docs/             Documentation
docs/proposals/   Proposal documents, template, and index
docs/designs/     Detailed design docs for code-heavy proposals
.github/          Issue templates, PR template, CI workflows
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

## Reporting Bugs

Open a [GitHub issue](https://github.com/NESTLab/argos3-webviz/issues) with:

- Summary and steps to reproduce.
- Expected vs actual behavior.
- Sample code or ARGoS config if applicable.
- Which component is affected (C++ plugin, client, client-next).

All contributions are licensed under the [MIT License](http://choosealicense.com/licenses/mit/).
