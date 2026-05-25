## REFACTOR-601 — Per-category panels render in alphabetical order, not severity / failure-count order — the operator opening `/data-quality` to find "which category of tests is failing worst" must scan all panels; the panel order conveys nothing about quality

**Severity**: MEDIUM
**Category**: ux-bug / ordering-not-meaningful
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityContent.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — |-
    "**Category panel ordering is alphabetical by label, not by severity or failure count — the worst-failing category is not surfaced first.** `DataQualityContent.tsx:76` sorts `testResults` by `category.localeCompare`. An operator opening `/data-quality` to find 'which category of tests is failing worst' must scan all panels; the panel order conveys nothing about quality. With the six current categories the order is fixed (Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, Unknown category, Volume Anomalies). The live `dashboard` doc lists categories in this same alphabetical order but does not state the ordering is alphabetical, so a reader cannot tell the order is not meaningful."

**Description**: `DataQualityContent.tsx:75-77` sorts the test-category panels with `data.testResults.toSorted((a, b) => a.category.localeCompare(b.category))`. The backend (`DataQualityRunsServiceImpl.java:36-42`) imposes no order on `testResults`; the alphabetical sort is purely a UI choice. With the current six categories the panel order is fixed: Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, Unknown category, Volume Anomalies.

The user-experience implication: an operator landing on `/data-quality` to answer "which test category is failing worst right now?" has no signal in panel position. They must scan every panel, sum FAILED + BROKEN counts in their head, and pick the maximum manually. The dashboard's purpose — at-a-glance triage of catalog-wide quality posture — is partly defeated by the ordering decision.

The alphabetical order optimises "find a NAMED category" (operator looking for the Freshness panel goes straight to position 3); it does NOT optimise "find the WORST category" (the central operator query for a triage dashboard).

The parallel decision for the TILE order WITHIN each category panel is ADR-shaped (ADR-CANDIDATE-208 — fixed enum-order tiles for cross-panel column comparability). The CATEGORY-ROW order is gap-shaped because (a) there is no stated rationale for the alphabetical choice; (b) a reasonable change-request would make it severity-descending; (c) the live doc lists the categories in alphabetical order without stating the ordering is alphabetical, so a reader expects the order to be MEANINGFUL.

**Wisdom-test classification**: GAP. (1) Intentional? Mixed — the choice to sort IS deliberate (the developer wrote the `toSorted` call); the choice of ALPHABETICAL over SEVERITY is undefended. (2) Structural impact? NO — swapping the comparator is a one-line change. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `DataQualityContent.tsx:75-77` (the `toSorted(localeCompare)` choice)
- `DataQualityRunsServiceImpl.java:36-42` (the backend imposes no order; the choice is UI's to make)
- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 — confirms doc lists categories in alphabetical order without stating the ordering

**Existing-ADR-or-implied-prescription**: composes with ADR-CANDIDATE-208 (the tile-order-by-enum decision). The sibling decision — category-row order — is the unresolved twin: tile order is deliberate-for-comparability, category-row order is deliberate-for-namelookup (probably). The right design likely surfaces TWO sort modes (alphabetical for name-lookup, severity-descending for triage) with a toggle.

**Proposed remedy**:

1. **Smallest** — change the comparator to severity-descending: sum FAILED + BROKEN + ABORTED counts per category, sort descending; alphabetical secondary tiebreak. One-line change at `DataQualityContent.tsx:76`.
2. **Better** — surface a sort toggle in the dashboard UI: "Sort by: [Name | Severity]". Defaults to Severity; the operator can switch. Adds a small UI control + an atom (or URL param) for the choice.
3. **Pair with REFACTOR-600** — the doc fix should explain whichever choice ships (the current doc is silent on ordering meaning, so any change is a doc opportunity).

**Severity rationale**: MEDIUM — operator-workflow-degradation, not data loss. The dashboard works; it is suboptimally ordered for its primary triage use-case. Severity MEDIUM because operators using the dashboard daily encounter this on every visit; an at-a-glance triage tool whose ordering is incidentally-meaningless burns operator cognition each load.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint`. Pair with REFACTOR-600 (doc-side: explain the ordering ships). If the toggle (Option 2) is adopted, it composes with ADR-CANDIDATE-208 (tile-order-by-enum) as the dashboard's full "ordering decisions" set.

---
