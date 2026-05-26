## REFACTOR-651 — DataEntityRunController's UI sort key (`start_time`, leftmost rendered column) ≠ backend sort key (`end_time`); the two are correlated for typical fast runs but diverge for long-running tests (a run STARTED yesterday but ENDED today may appear ABOVE a run STARTED + ENDED earlier today)

**Severity**: LOW
**Category**: display-vs-sort-key-drift
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality]

**Surfaced by**:
- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[4]` (LOW) — "**UI sort key (start_time) ≠ backend sort key (end_time)** — the operator looking at the runs list sees `startTime` rendered in the leftmost column (TestRunsHistory.tsx:75-77, TestRunItem.tsx:30) and naturally expects ordering by that column. Backend orders by end_time. For typical completed runs the two are correlated (end ~ start + duration); for long-running tests the divergence is operator-visible (a slow run started yesterday may appear ABOVE a fast run started today)."

**Statement**: The UI's runs-history list displays `startTime` in the leftmost (most-prominent) column (`TestRunsHistory.tsx:75-77`, `TestRunItem.tsx:30`); the backend SQL orders rows by `end_time` (`ReactiveDataEntityTaskRunRepositoryImpl.java:178`). The two timestamps are correlated for typical completed runs (end ≈ start + duration), so the visible order tends to match operator expectation. The divergence is operator-visible for tests with non-uniform durations:
- Test A: started 2026-05-25T08:00, ended 2026-05-25T18:00 (10-hour run)
- Test B: started 2026-05-25T12:00, ended 2026-05-25T12:05 (5-minute run)
- UI shows B above A (B's startTime is later) — but backend returns A above B (A's endTime is later)

The operator sees a list ordered by startTime (the visible column) but actually ordered by endTime (the SQL key). Long-running tests appear in confusing positions.

**Evidence**:
- SQL ordering: `ReactiveDataEntityTaskRunRepositoryImpl.java:178` (`ORDER BY end_time DESC`)
- UI rendering: `TestRunsHistory.tsx:74-87` (column layout: startTime leftmost), `TestRunItem.tsx:25-32` (the per-row render — startTime rendered first)

**Existing-ADR-or-implied-prescription**: no governing ADR. The choice between start_time and end_time as the sort key was not anchored to a decision.

**Proposed remedy**: either (a) align the UI column with the SQL — rename the leftmost column to "End Time" and add a "Started" column on the right; or (b) align the SQL with the UI — change the paginate call to `ORDER BY start_time DESC`. Option (a) preserves the "most-recently-completed first" semantic (the operationally useful order for triage); option (b) aligns with the leftmost-column-is-sort-key UI convention. Option (a) is the smaller change and preserves the dashboard semantic.

**Severity rationale**: LOW — minor UI-display drift; not a correctness bug; only visible for tests with non-uniform durations.

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (LOW-priority polish; consolidates with REFACTOR-605 cluster).

**Coherence check** (LSN-018):
- STRENGTHENS: none directly. The display-vs-sort-key drift is a UI-design issue specific to this surface.
- SUPERSEDES: none.
- CONFLICTS: none.

---
