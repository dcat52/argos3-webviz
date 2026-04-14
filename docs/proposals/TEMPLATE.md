# Proposal: <Title>

Created: YYYY-MM-DD
Baseline Commit: `<hash>` (`<branch>`)
GitHub Issue: N/A <!-- #N once published -->

## Status: 📋 INVESTIGATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

One to three sentences. What does this accomplish and why does it matter?

## Scope Boundary

What this proposal covers and — critically — what it does NOT.

**In scope:**
- ...

**Out of scope:**
- ❌ ...
- ❌ ...

## Current State

What exists today that this proposal builds on. Be specific about files,
data, and working functionality.

**What exists:**
- ...

**What's missing:**
- ...

## Affected Components

- [ ] C++ plugin (`src/`)
- [ ] Legacy client (`client/`)
- [ ] Next client (`client-next/`)
- [ ] Protocol / message format
- [ ] Build system / CMake
- [ ] Documentation

## Design

High-level technical approach: architecture, key decisions, and step-by-step
pseudocode of how the system works.

Keep this section scannable — focus on WHAT and WHY, not exact implementation.
If the design involves detailed code (function signatures, dataclasses, config
file contents, prompt templates), put that in a separate design doc and
reference it here.

### Approach

<High-level description of the architecture and how it works>

### Key Decisions

<Numbered list of the important design choices and why>

### Pseudocode / Steps

<Step-by-step description of what the code does, in plain language or pseudocode>

### Design Doc

For proposals involving code, link to the detailed design document:

`docs/designs/PN-xxx-<name>.md` — detailed implementation spec
(function signatures, data structures, config files, prompt templates, etc.)

The design doc is a working document that evolves during Implementation.
The proposal's Design section captures the intent; the design doc captures
the specifics.

## Key File References

| File | Current State | Change |
|---|---|---|
| `path/to/file` | Description of what exists | What gets added/modified |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| ... | ... | ... |

## Assumptions

Verify these before starting. If any are false, revisit the design.

- [ ] ...
- [ ] ...

## Dependencies

- **Requires**: None | <other proposal>
- **Enhanced by**: None | <other proposal>
- **Blocks**: None | <other proposal>

## Done When

Concrete, checkable criteria. The proposal is complete when ALL are true.

- [ ] ...
- [ ] ...
- [ ] ...

## Verification Strategy

### Success Criteria
- <observable outcome that proves correctness>

### Regression Checks
- <existing behavior that must be preserved>

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| ... | Functional | ... | ... |

### Acceptance Threshold
- <pass/fail criteria>

## Open Questions

- ...

## Effort Estimate

**Time:** <N> FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | <N> |
| Files modified | <N> |
| Lines added/changed | ~<N> |
| Complexity | Low / Medium / High — <brief justification> |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| <description> | <phase> | Captured / Proposal PN-xxx created |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| YYYY-MM-DD | Initial draft | 📋 INVESTIGATION |
