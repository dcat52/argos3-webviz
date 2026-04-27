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

| Phase | Entry Gate | What Happens | Exit Artifact |
|-------|-----------|-------------|---------------|
| 📋 INVESTIGATION | — | Problem analysis, current state audit, scope definition | Scope + assumptions documented |
| 🔍 CRITIQUE | Investigation written | Review for gaps, missing context, wrong assumptions | Issues list + resolutions |
| 🟡 DESIGN | Critique passed | Technical approach, key decisions, pseudocode, file references | Design doc with implementation steps |
| 🔍 CRITIQUE | Design written | Review for feasibility, edge cases, missing pieces | Amendments list |
| 🔵 IMPLEMENTATION | Critique passed | Code written, tests added, build passes | Branch with passing CI |
| 🟣 VERIFICATION | Implementation complete | PR opened, done-when criteria checked, ready for human review | PR link in proposal |
| ✅ COMPLETE | PR merged | Issue closed, local .md archived or deleted | — |

### Phase Rules

- **Critique phases are explicit gates.** An agent must pass through critique before advancing. No skipping.
- **🟣 VERIFICATION means "ready for review."** The code is on a branch, tests pass, PR is open. The human decides when to merge.
- **✅ COMPLETE is a pseudo-state triggered by PR merge**, not by the agent. The agent cannot self-promote to COMPLETE.
- **🔴 ABANDONED** can be set at any phase if the proposal is no longer relevant.

### Local File Management

- **Active proposals** (📋 through 🟣): local `.md` file in `docs/proposals/` is the working draft.
- **On merge (✅ COMPLETE)**: delete the local `.md` file. The GitHub issue body is the permanent record.
- The `FUTURE.md` file tracks ideas that don't yet have their own proposal.

## Active Proposals

| PN | Title | Phase | Issue |
|----|-------|-------|-------|
| PN-028 | User Data Field Pinning / Watch List | 📋 INVESTIGATION | #57 |
| PN-029 | Draw Functions Auto-Wiring | 📋 INVESTIGATION | #58 |
| PN-030 | Web Loop Function UI Controls | 📋 INVESTIGATION | #59 |

## Completed Proposals

| PN | Title | Completed |
|----|-------|-----------|
| PN-024 | Entity Inspection Panel | 2026-04-26 |
| PN-023 | Fit Arena to Viewport | 2026-04-26 |
| PN-022 | Proximity Ray Frame Fix | 2026-04-26 |
| PN-021 | Render Tiers | 2026-04-26 |
| PN-020 | Feature Registry | 2026-04-26 |
| PN-019 | Entity Manipulation & Spawning | 2026-04-26 |
| PN-018 | Timeline Scrubber | 2026-04-21 |
| PN-017 | Multi-Experiment Dashboard | 2026-04-21 |
| PN-014 | Speed Control | 2026-04-19 |
| PN-013 | Floating Panels | 2026-04-19 |
| PN-012 | Configurable Defaults | 2026-04-19 |
| PN-011 | Entity Body Color | 2026-04-19 |
| PN-010 | Viewport Polish | 2026-04-19 |
| PN-009 | Integration Fixes | 2026-04-15 |
| PN-008 | Draw Primitives | 2026-04-15 |
| PN-007 | Leo Renderer | 2026-04-14 |
| PN-006 | Benchmarking & Testing | 2026-04-14 |
| PN-005 | Computed Fields | 2026-04-14 |
| PN-004 | Viz System | 2026-04-14 |
| PN-003 | Recorder / Replay | 2026-04-13 |
| PN-002 | Delta Protocol | 2026-04-13 |
| PN-001 | Client-Next Default | 2026-04-13 |

## Future Proposals
See [FUTURE.md](FUTURE.md) for ideas not yet started.

## Parity Tracking

[PARITY.md](PARITY.md) tracks QT-OpenGL features that don't yet have proposals.

## Design Docs

For code-heavy proposals, detailed specs go in `docs/designs/PN-xxx-<name>.md` and are linked from the proposal. The proposal captures intent; the design doc captures specifics.
