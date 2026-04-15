# Proposals

## Naming Convention

Proposals use the `PN-xxx` format: `PN-001`, `PN-002`, etc.

## Source of Truth

**Proposals live as GitHub issues.** Use the Proposal issue template. The issue body IS the proposal — it tracks the plan, design, status, and changelog. Local files in `docs/proposals/` are working drafts.

To edit a proposal locally:
```bash
gh issue view <N> --json body -q .body > /tmp/PN-xxx.md
# edit, then:
gh issue edit <N> --body-file /tmp/PN-xxx.md
```

## Template

See [TEMPLATE.md](TEMPLATE.md) for the standard proposal format.

## Lifecycle

```
📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED
```

| Phase | Gate | What Happens |
|-------|------|-------------|
| 📋 INVESTIGATION | — | Problem analysis, current state audit, scope definition |
| 🔍 CRITIQUE | Scope + assumptions validated | Review investigation for gaps, missing context, wrong assumptions |
| 🟡 DESIGN | Critique passed | Technical approach, key decisions, pseudocode, file references |
| 🔍 CRITIQUE | Design reviewed | Review design for feasibility, edge cases, missing pieces |
| 🔵 IMPLEMENTATION | Critique passed | Code written, tests added |
| 🟣 VERIFICATION | Implementation complete | Done-when criteria checked, regression tests pass |
| ✅ COMPLETE | Verification passed | Proposal closed |

Critique phases are explicit gates — they prevent premature implementation and catch design issues early. An agent running a proposal workflow must pass through critique before advancing.

## Active Proposals

| PN | Title | Status | Effort | Requires | GitHub Issue |
|----|-------|--------|--------|----------|-------------|
| PN-001 | [Client-Next CMake Build & Install](PN-001-client-next-default.md) | 🔵 IMPLEMENTATION | ~2h | None | [#1](https://github.com/dcat52/argos3-webviz/issues/1) |
| PN-002 | [Delta Encoding Protocol](PN-002-delta-protocol.md) | 🔵 IMPLEMENTATION | ~2h | PN-006 | [#2](https://github.com/dcat52/argos3-webviz/issues/2) |
| PN-003 | [Seamless Record → Replay](PN-003-recorder-replay.md) | 🔵 IMPLEMENTATION | ~4h | None | [#3](https://github.com/dcat52/argos3-webviz/issues/3) |
| PN-004 | [Generic Data Visualization System](PN-004-viz-system.md) | 📋 INVESTIGATION | ~5.5h | None | [#4](https://github.com/dcat52/argos3-webviz/issues/4) |
| PN-005 | [Dynamic Computed Fields & State Exposure](PN-005-computed-fields.md) | 🔵 IMPLEMENTATION |
| PN-008 | [QT-OpenGL Drawing Primitives](PN-008-draw-primitives.md) | 🔵 IMPLEMENTATION | ~9h | None | [#5](https://github.com/dcat52/argos3-webviz/issues/5) |
| PN-006 | [Benchmarking & Testing Framework](PN-006-benchmarking-testing.md) | 🔵 IMPLEMENTATION | ~12h | None | [#6](https://github.com/dcat52/argos3-webviz/issues/6) |
| PN-007 | [Leo Entity Renderer](PN-007-leo-renderer.md) | 🔵 IMPLEMENTATION | ~20min | None | [#7](https://github.com/dcat52/argos3-webviz/issues/7) |

## Suggested Implementation Order

```
PN-007 (Leo renderer, 20min)
  → PN-001 (CMake build, 2h)
    → PN-006 (Benchmarking, 12h)
      → PN-002 (Delta protocol, 2h)
    → PN-003 (Recorder/replay, 4h)
  → PN-005-Part3 (Extended serializers, 1.5h)
    → PN-004 (Viz system, 5.5h)
      → PN-005-Parts1,2,4 (Computed fields + WEBVIZ_EXPOSE, 7.5h)
```

## Parity Tracking

[PARITY.md](PARITY.md) tracks QT-OpenGL features that don't yet have proposals.

## Design Docs

For code-heavy proposals, detailed specs go in `docs/designs/PN-xxx-<name>.md` and are linked from the proposal. The proposal captures intent; the design doc captures specifics.
