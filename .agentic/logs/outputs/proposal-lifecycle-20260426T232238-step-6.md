

This step says "After merge: Run workflow: proposal-close". Let me first identify which proposals have been merged but not yet formally closed (i.e., their local artifacts haven't been finalized). From my earlier analysis, PN-025 and PN-026 have uncommitted status sync changes. Let me investigate thoroughly.Now let me read the proposal-close workflow to understand what it requires.Good, now I understand the proposal-close workflow. Let me now execute it for the proposals that need closing. The two candidates are **PN-025** and **PN-026** — both have PRs merged and GitHub issues closed, but their local artifacts have uncommitted status updates. Let me verify their close readiness thoroughly.Now let me check the full state of both proposals — their changelogs and related proposals sections:Now let me check the FUTURE.md to see if either proposal surfaced related ideas that should be captured:Now I have a complete picture. Let me check if PN-025 or PN-026 have any "Related Proposals" section that might need updating:Neither has a Related Proposals section. Let me check the full tail of both files to see what sections they end with:Now I have the full picture. Let me execute the proposal-close workflow steps for both PN-025 and PN-026.

**Step 1 — Determine close type:** Both are **Complete** (all Done When criteria checked, PRs merged, issues closed).

**Step 2 — If Complete:** Verify all criteria met:

For **PN-025** (Smart User Data Display, Issue #51, PR #52):
- All 7 Done When items: ✅ checked
- PR #52: MERGED (2026-04-26)
- Issue #51: CLOSED
- Status in artifact: ✅ COMPLETE
- Changelog: has merge entry

For **PN-026** (User Data Filtering, Issue #53, PR #54):
- All 6 Done When items: ✅ checked
- PR #54: MERGED (2026-04-26)
- Issue #53: CLOSED
- Status in artifact: ✅ COMPLETE
- Changelog: has merge entry

**Step 3 — If Abandon:** N/A — both are Complete.

**Step 4 — Append final changelog entry:** Both already have a final changelog entry noting the merge and completion. I'll add a formal close entry to each.**Step 5 — Check Related Proposals:** Let me assess whether PN-025 or PN-026 surfaced any ideas that should be captured.

- **PN-025** (Smart User Data Display) — the "Out of scope" section mentions "Field pinning / watch list" and "Time series / charting of values". The field pinning idea is not in FUTURE.md. However, these are minor UI enhancements and the charting idea overlaps with the existing "Color-by" experimental feature graduation item.
- **PN-026** (User Data Filtering) — the "Out of scope" section mentions "Per-entity-type filtering" and "Client-side filtering (already handled by PN-025)". Per-entity-type filtering is a natural extension but not currently in FUTURE.md.

Both are minor ideas. Let me check if they're worth adding to FUTURE.md:Now let me also check for stale remote branches that should be cleaned up:I'll flag the stale branches but not delete them — that's a destructive action that needs user confirmation.

---

✅ STEP COMPLETE

**Executed the proposal-close workflow for PN-025 and PN-026:**

**Close type:** Both are ✅ COMPLETE (not abandoned).

**Verification summary:**

| Proposal | Issue | PR | Done When | Status | Changelog |
|----------|-------|----|-----------|--------|-----------|
| PN-025: Smart User Data Display | #51 CLOSED | #52 MERGED | 7/7 ✅ | ✅ COMPLETE | Updated |
| PN-026: User Data Filtering | #53 CLOSED | #54 MERGED | 6/6 ✅ | ✅ COMPLETE | Updated |

**Actions taken:**
1. Confirmed both proposals are Complete (all Done When criteria met, PRs merged, issues closed)
2. Added formal close changelog entries to both `PN-025-smart-user-data-display.md` and `PN-026-user-data-filtering.md`
3. Captured two discovered ideas in `docs/proposals/FUTURE.md`:
   - **User Data Field Pinning / Watch List** (from PN-025 out-of-scope)
   - **Per-Entity-Type User Data Filtering** (from PN-026 out-of-scope)

**Pending housekeeping (flagged, not acted on):**
- 2 modified proposal files + FUTURE.md need to be committed to `master`
- 4 stale remote branches could be deleted: `PN-023/AI/fit-arena-viewport`, `PN-024/AI/entity-inspection-panel`, `PN-025/AI/smart-user-data-display`, `PN-026/AI/user-data-filtering`