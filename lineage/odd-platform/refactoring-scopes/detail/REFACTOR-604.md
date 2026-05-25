## REFACTOR-604 — Entire `components/DataQuality/` subtree has ZERO test files (21 source files, 0 test files) — no unit, integration, or render coverage; the dashboard's behavioural surface ships with the build green regardless of regression

**Severity**: MEDIUM
**Category**: missing-test
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**: ALL FOUR per-component sidecars converge on the same observation; consolidated here.

- `odd-platform__ts__react-component__component__DataQualityContent.md:bugs_limitations_corner_cases.[6]` (MEDIUM) — |-
    "**No coverage and no observability — the entire `components/DataQuality/` subtree has zero test files.** Glob `**/components/DataQuality/**` (2026-05-22) returned 21 source files and zero test files. A regression in the category ordering, the status-colour crash, the fetch multiplicity, or the empty-state render would ship with the build green."
- `odd-platform__ts__react-component__component__DataQualityFilters.md:tests_coverage_semantic.gaps` — confirms; lists 5 high-leverage missing behaviours (URL ↔ formFilters sync; clear-tables-vs-tests isolation; filterKey wiring; autocomplete options-loading; Title-filter scope).
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:tests_coverage_semantic.gaps` — confirms; lists 3 missing behaviours (filtersAtom drops empty keys; clear atom isolation; per-mount reset).
- `odd-platform__ts__react-component__component__TestCategoryResults.md:tests_coverage_semantic.gaps` — confirms; lists the enum-ordering and en-dash zero-state regressions.

**Description**: A Glob of `**/components/DataQuality/**` under `odd-platform-ui` on 2026-05-22 returned 21 source files (`.ts` / `.tsx`) and **zero** test files (`.test.ts*` / `.spec.ts*` / `__tests__` / `.stories.*`). The dashboard ships with no automated regression coverage at any test_class:

| Test class | Missing high-leverage coverage |
|---|---|
| unit | `calcTestResultsBreakdown` (the reduce-over-statuses); `filtersAtom` projection (drops empty keys, maps to id[]); `clearTableFiltersAtom` / `clearTestFiltersAtom` isolation; `sortedResults` enum-ordering (the ADR-208 contract); `filterKey` wiring (the 10 prop-to-key assignments — a copy-paste swap would type-check) |
| integration | URL ↔ formFilters bidirectional sync; the line-48 status-colour crash on out-of-enum status; empty-state render (no DQ tests); fetch multiplicity on plain open vs deeplinked open (P-101); per-mount reset behaviour (P-120); Title-filter scope (P-110) |
| render | DonutChart zero-total path; per-status tile colour mapping; legend pairing with tile order (ADR-208 cross-component contract) |

The dashboard is feature F-032 (P-04:F-002 Quality Dashboard) — the catalog-wide aggregate view used by Data Quality Engineers as their primary triage tool. A regression in any of the above silently ships and is detected only on operator complaint.

**Wisdom-test classification**: GAP. (1) Intentional? NO — no comment defends "the dashboard is excluded from testing"; the absence is one of several SPA-side test-coverage gaps the codebase ships with. (2) Structural impact? NO — adding a test suite is purely additive. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- Glob `**/components/DataQuality/**` over `<odd-platform-repo>/odd-platform-ui` 2026-05-22 (21 source / 0 test)
- 4 per-component sidecars' `tests_coverage_semantic.gaps` blocks

**Existing-ADR-or-implied-prescription**: the project's test pyramid (described elsewhere in the codebase, redux slices typically have some unit coverage, controllers have some integration coverage) — the dashboard is an outlier with zero coverage across all three classes. ADR-CANDIDATE-207 (jotai per-feature-store) and ADR-CANDIDATE-208 (enum-order tiles) and the ADR-CANDIDATE-003 STRENGTHENS (ungated dashboard route) all introduce architectural commitments the codebase has no way to enforce as regressions land.

**Proposed remedy**: A 3-tier test bootstrap.

1. **Unit (smallest)** — start with the pure derivations: `filtersAtom` (jotai-test-utils provides a test store), `calcTestResultsBreakdown` (hand-built `DataQualityResults`), `sortedResults` (hand-built `results` arrays of partial / shuffled statuses). 5-8 unit tests cover the dashboard's pure-logic surface.
2. **Integration (medium)** — React Testing Library tests that mount the full `<DataQuality>` subtree with a mocked `useGetDataQualityDashboard` hook + a mocked `MemoryRouter`. Cover: URL→filter hydration, filter→URL sync, clear-tables-vs-tests isolation, line-48 crash regression (the highest-leverage test in the file — pin REFACTOR-592), empty-state render.
3. **Larger — Playwright e2e** — one happy-path test that opens `/data-quality` against a seeded database, asserts three donuts + at least one category panel render, applies a filter, asserts the dashboard re-fetches. Composes with the project's existing e2e infrastructure if any.

Pair with REFACTOR-592 (the line-48 crash) — the smallest meaningful integration test pins the crash regression directly. Pair with ADR-CANDIDATE-208 — a tile-order test cements the cross-panel comparability contract.

**Severity rationale**: MEDIUM — the absence of coverage is not itself an operator-facing defect, but it is the multiplier for every other gap in this batch (any of REFACTOR-592..603 / 605..617 lands silently as a regression). For a feature surface used by an operator persona daily, zero coverage is a structural risk worth dedicated catch-up effort.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` (the test bootstrap is the natural companion to the per-bug fixes in 592-603). May warrant its own SPRINT-NN entry alongside the bugfix sprint.

---
