## REFACTOR-711 — LookupTables InfiniteScroll `scrollableTarget='directory-entities-list'` is a copy-paste from the Directory feature; the actual container id is `lookup-tables-list`. Mismatch → `fetchNextPage` likely never fires from container scroll; any tenant with >30 lookup tables sees only the first 30 in the UI with NO signal that more pages exist

**Severity**: HIGH
**Category**: copy-paste-bug / pagination-broken / UI-visible-cap
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-03 Master Data Management]

**Surfaced by**:
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases[1]` (HIGH) — "InfiniteScroll mis-targeting: `LookupTablesList.tsx:51-53` mounts `<ScrollableContainer id='lookup-tables-list'>` around `<InfiniteScroll scrollableTarget='directory-entities-list'>`. The `scrollableTarget` is a copy-paste from the Directory feature — it references a DOM id that does NOT exist on this page. Per react-infinite-scroll-component docs, an unresolvable `scrollableTarget` falls back to window scroll; but `ScrollableContainer` declares `$offsetY={165}` and likely sets `overflow:auto`, so window scroll never fires for content inside the container. Likely effect: `fetchNextPage` never gets triggered by scrolling within the table; any tenant with >30 lookup tables sees only 30 rows in the UI." — evidence: LookupTablesList.tsx:51-53 — severity: HIGH
- `odd-platform__ts__react-component__component__LookupTables.md:tests_coverage_semantic.uncovered_behaviours[3]` (HIGH) — "InfiniteScroll fires `fetchNextPage` correctly when scrolling within the ScrollableContainer (the `scrollableTarget='directory-entities-list'` references the wrong DOM id) ... Copy-paste bug in `LookupTablesList.tsx:51-53` — the container id is `lookup-tables-list` but InfiniteScroll points to `directory-entities-list`. PROBE-NEEDED — see P-192."
- `odd-platform__ts__react-component__component__LookupTables.md:stress_findings.name_behavior_pairs[2]` (PROBE-NEEDED) — "InfiniteScroll: Uses react-infinite-scroll-component with scrollableTarget='directory-entities-list' — a DOM id that does NOT exist on this page. The actual container id is `lookup-tables-list`. Mismatch → fetchNextPage may never fire from container scroll. Operator-visible: any tenant with >30 lookup tables sees only the first 30 in the UI. The list APPEARS to be the full set; no skeleton appears at the bottom to indicate more pages exist."

**Statement**: `LookupTablesList.tsx:51-53` mounts:
```tsx
<ScrollableContainer id='lookup-tables-list' $offsetY={165}>
  <InfiniteScroll
    scrollableTarget='directory-entities-list'   // <-- WRONG; should be 'lookup-tables-list'
    ...
```

The `scrollableTarget` prop tells `react-infinite-scroll-component` which DOM element to watch for scroll events. `'directory-entities-list'` is the id used by the Directory feature's ScrollableContainer — copy-paste leakage. On the LookupTables page, that DOM id does NOT exist.

Per `react-infinite-scroll-component` documentation:
- If `scrollableTarget` references a non-existent element, the component falls back to window scroll.
- `ScrollableContainer` declares `$offsetY={165}` which (likely) sets `overflow: auto` on its element, creating a separate scrolling viewport.
- The browser's window scroll never fires when the user scrolls inside the ScrollableContainer (the container intercepts the scroll event).
- Result: `fetchNextPage` is never triggered; the InfiniteScroll component sits idle.

**Operator-visible impact** (graduated by lookup-table population):
- 0-30 lookup tables: no impact (first page covers everything)
- 31+ lookup tables: ONLY THE FIRST 30 are visible in the UI
  - The list shows 30 rows without any "loading more" skeleton at the bottom
  - The +Add new button works (creates a new table)
  - But the operator CANNOT see existing tables 31-N
  - No error message; no UI signal that the list is truncated
  - The counter "X lookup tables overall" shows the FULL count (e.g. "50 lookup tables overall") but only 30 rows are visible

A tenant with 100 lookup tables sees a counter "100 lookup tables overall" + 30 visible rows. The operator may assume the platform is broken, or that the database is corrupted, or that they need to scroll harder. No documentation, no UX affordance, no error.

This is the most operator-visible defect in the Master Data Management pillar at scale.

**Evidence**:
- `LookupTablesList.tsx:51-53` — the JSX with the mismatch
- `ScrollableContainer.tsx` (or sibling) — the `$offsetY` styled-component primitive
- `react-infinite-scroll-component` documentation — fallback to window scroll on unresolvable target
- contrast: Activity / Directory / Alerts use InfiniteScroll with correctly-resolvable `scrollableTarget` matching their respective ScrollableContainer ids

**Existing-ADR-or-implied-prescription**: This is a straightforward implementation defect — copy-paste leakage during a refactor. No architectural decision is involved; the fix is to change one string from `'directory-entities-list'` to `'lookup-tables-list'`.

**Proposed remedy**:

```tsx
// LookupTablesList.tsx:53
- scrollableTarget='directory-entities-list'
+ scrollableTarget='lookup-tables-list'
```

Effort: trivial. Single-line change.

After fix:
- Verify pagination fires on scroll within the container (manual test or integration test)
- Add a regression test (the LookupTables tree currently has zero direct test files per the sidecar's tests_coverage_semantic.gaps; this fix should land alongside a smoke test)

**Severity rationale**: HIGH — operator-visible cap at 30 rows for any tenant with >30 lookup tables. The defect:
- Has no UI signal (no error, no truncation indicator, no "load more" affordance)
- Has no workaround for the operator (they can't see existing tables 31-N)
- Has no recovery path (refresh doesn't help; navigation doesn't help; the bug is in the JSX)
- Affects the core feature (the LookupTables list IS the Master Data Management UI — if it shows 30/N tables, the pillar is broken at scale)

The fix is trivial. Severity is HIGH because the OPERATOR-VISIBLE consequence is severe (incomplete data presentation) for any non-trivial tenant.

**Suggested backlog grouping**: `DOC-NNN Master Data Management pillar fix sprint` — pair with REFACTOR-712 (namespace_name silent discard on edit), REFACTOR-713 (counter leak), REFACTOR-714 (per-keystroke PUT). The four together close the LookupTables-tree defects identified in batch ZL.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-486 (updateLookupTableField discards lookupTableId — sibling LookupTables-tree defect family); the broader "LookupTables tree has zero test coverage" gap (LookupTables tests_coverage_semantic).
- SUPERSEDES: none.
- CONFLICTS: none.

---
