---
name: Proposal
about: Plan a new body of work (PN-xxx)
title: "PN-xxx: "
labels: proposal
assignees: ''
---

<!-- Replace xxx with the next available number -->

# Proposal: <Title>

Created: YYYY-MM-DD
Baseline Commit: `<hash>` (`<branch>`)

## Status: 📋 INVESTIGATION
<!-- 📋 INVESTIGATION → 🔍 CRITIQUE → 🟡 DESIGN → 🔍 CRITIQUE → 🔵 IMPLEMENTATION → 🟣 VERIFICATION → ✅ COMPLETE / 🔴 ABANDONED -->

## Goal

One to three sentences. What does this accomplish and why does it matter?

## Scope Boundary

**In scope:**
- ...

**Out of scope:**
- ❌ ...

## Current State

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

High-level approach, key decisions, pseudocode. Keep scannable.
For code-heavy proposals, link to `docs/designs/PN-xxx-<name>.md` for detailed specs.

### Approach

### Key Decisions

### Pseudocode / Steps

### Design Doc

`docs/designs/PN-xxx-<name>.md` — detailed implementation spec (if needed)

## Key File References

| File | Current State | Change |
|---|---|---|
| `path/to/file` | ... | ... |

## Parameters

| Parameter | Value | Notes |
|---|---|---|
| ... | ... | ... |

## Assumptions

- [ ] ...

## Dependencies

- **Requires**: None
- **Enhanced by**: None
- **Blocks**: None

## Done When

- [ ] ...

## Verification Strategy

### Success Criteria
- ...

### Regression Checks
- ...

### Test Plan
| Test | Type | Procedure | Expected Result |
|------|------|-----------|-----------------|
| ... | Functional | ... | ... |

### Acceptance Threshold
- ...

## Open Questions

- ...

## Effort Estimate

**Time:** N FTE-hours

**Change Footprint:**

| Metric | Estimate |
|--------|----------|
| Files created | N |
| Files modified | N |
| Lines added/changed | ~N |
| Complexity | Low / Medium / High |

## Related Proposals

| Idea | Discovered During | Status |
|------|------------------|--------|
| ... | ... | Captured |

## Changelog

| Date | Change | Phase |
|------|--------|-------|
| YYYY-MM-DD | Initial draft | 📋 INVESTIGATION |
