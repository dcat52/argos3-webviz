# Proposal: README & Documentation Refresh

Created: 2026-04-26
Baseline Commit: `33009b2` (`master`)
GitHub Issue: #55

## Status: 🟣 VERIFICATION
<!-- 📋 INVESTIGATION → 🟡 DESIGN → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

Modernize the root README.md and client-next/README.md to reflect the current state of the project — the client-next React client is the primary UI, 26 proposals have shipped, and the old Travis CI / upstream-fork framing is stale. Also clean up minor doc inconsistencies.

## Scope Boundary

**In scope:**
- Rewrite root `README.md` to reflect client-next as the primary client, current feature set, and updated build/install instructions
- Replace `client-next/README.md` boilerplate (Vite template) with project-specific content
- Remove stale Travis CI badge table; replace with current CI or remove entirely
- Update the Features list to reflect shipped work (inspection panel, entity manipulation, render tiers, etc.)
- Update Limitations section based on current `PARITY.md`

**Out of scope:**
- ❌ Changes to `docs/CONTRIBUTING.md` (already comprehensive and up to date)
- ❌ Changes to `docs/proposals/README.md` or other proposal docs
- ❌ New screenshots or screencasts (would require a running ARGoS instance)
- ❌ Changes to any code, config, or build files
- ❌ Docs under `docs/` other than what's listed above

## Current State

**What exists:**
- Root `README.md` — references upstream NESTLab repo, Travis CI badges (likely broken), old feature list, old screencast GIF, fork notice. Build instructions reference only the C++ plugin. No mention of client-next.
- `client-next/README.md` — default Vite "React + TypeScript + Vite" template boilerplate. Not useful.
- `docs/CONTRIBUTING.md` — already updated with client-next stack, proposal workflow, branch naming. Good shape.
- `docs/README.md` — docs index, already links proposals and designs. Good shape.

**What's missing:**
- Root README doesn't mention: React client, entity inspection, manipulation/spawning, render tiers, user data display, timeline scrubber, floating panels, speed control, delta protocol, recording/replay, computed fields, or any of the 26 shipped proposals
- No quick-start for client-next in root README
- client-next/README.md has zero project-specific content

## Design

### Approach

Straightforward doc rewrite. No code changes. Two files modified, no new files.

### Key Decisions

1. Keep the fork notice but make it less prominent (move below the main description)
2. Feature list organized by category (3D visualization, interaction, data, protocol)
3. Add a "Quick Start" section for client-next development (npm install, mock server, dev server)
4. Keep C++ build instructions but add client-next build alongside
5. Remove Travis CI badges — replace with a simple note about CI or remove badge section entirely if no current CI
6. Link to `docs/CONTRIBUTING.md` for detailed contribution info rather than duplicating

### Pseudocode / Steps

1. Rewrite root `README.md`:
   - Keep banner image
   - Update project description to mention both C++ plugin and React client
   - Replace Travis badges (check if GitHub Actions CI exists first)
   - New feature list reflecting current capabilities
   - Quick Start section: C++ plugin build + client-next dev setup
   - Updated Limitations from PARITY.md
   - Move fork notice to bottom or make it a smaller note
2. Rewrite `client-next/README.md`:
   - Project-specific overview
   - Dev setup (npm install, mock server, dev)
   - Stack summary
   - Link to CONTRIBUTING.md for details

## Key File References

| File | Current State | Change |
|---|---|---|
| `README.md` | Stale — references upstream, Travis CI, old features only | Full rewrite reflecting current project |
| `client-next/README.md` | Vite boilerplate | Rewrite with project-specific dev guide |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| Files modified | 2 | README.md, client-next/README.md |
| Files created | 0 | |

## Assumptions

- [x] `docs/CONTRIBUTING.md` is up to date and doesn't need changes
- [x] GitHub Actions CI exists (`.github/workflows/test.yml`) — can add badge
- [x] Banner image at `client/images/banner_light.png` exists (7KB PNG, 1141x536)

## Dependencies

- **Requires**: None
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] Root `README.md` describes client-next as the primary web client
- [ ] Root `README.md` feature list reflects shipped proposals (entity manipulation, inspection panel, render tiers, user data, timeline, etc.)
- [ ] Root `README.md` includes quick-start for both C++ build and client-next dev
- [ ] Root `README.md` has no broken/stale CI badges
- [ ] `client-next/README.md` has project-specific content (not Vite boilerplate)
- [ ] All links in both READMEs resolve correctly

## Verification Strategy

### Success Criteria
- Both READMEs accurately describe the current project state
- No broken links or references to nonexistent files

### Regression Checks
- No code, config, or build files changed

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| Link check | Manual | Verify all markdown links resolve | No 404s |
| Accuracy check | Manual | Compare feature list against PARITY.md and completed proposals | All major features mentioned |
| No code changes | Automated | `git diff --stat` shows only .md files | Only README.md and client-next/README.md changed |

### Acceptance Threshold
- Human review confirms READMEs are accurate and readable

## Effort Estimate

**Time:** 1 FTE-hour

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | 0 |
| Files modified | 2 |
| Lines added/changed | ~150 |
| Complexity | Low — documentation only, no code |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| — | — | — |

## Changelog

| Date | Change | Workflow |
|------|--------|---------|
| 2026-04-26 | Initial draft | proposal-lifecycle |
| 2026-04-26 | Investigation → Design → Implementation → Verification | proposal-lifecycle |
