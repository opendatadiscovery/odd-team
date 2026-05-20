## REFACTOR-222 — `EXCLUDE_FROM_SEARCH` flag is NOT applied to `listPopular` — internal / hidden entities surface on the platform's home page

**Severity**: MEDIUM
**Category**: missing-filter
**Surfaced by**:
- `getPopular.md:bugs_limitations_corner_cases[1]`
- `getPopular.md:concepts.invariants[3]`
- `getPopular.md:security.known_security_gaps[1]`

**STRENGTHENED 2026-05-19H (PRIMARY SOURCE — exhaustive call-site enumeration)**: `odd-platform__java__repository_reactive__repository__ReactiveDataEntityRepositoryImpl.md:bugs_limitations_corner_cases[1]` + `concepts.invariants[2]` + `security.known_security_gaps[2]`. The repository-layer evidence is the canonical primary source and ENUMERATES the affected call sites comprehensively. `cteDataEntitySelect` (`ReactiveDataEntityRepositoryImpl.java:909-939`) is consumed by **9 list-shape methods**: `listPopular`, `listByOwner`, `listByTerm`, `getDEGExperimentRuns`, `getDimensions(id|oddrns|ids)`, `getDetails(id)`, `getQuerySuggestions`, and `findByState` (which re-adds the predicate via `JooqFTSHelper.resultFacetStateConditions` at line 149, so it IS filtered). The inconsistency means entities marked `exclude_from_search=true` ARE included in:
- the popular list,
- the by-owner list,
- the by-term list,
- the DEG-children list,
- the single-entity details view,
- the FTS query suggestions endpoint.

They are NOT included in: `countByState`, `countByDatasourceAndType`, `getDataSourceEntityTypeIds`, `getCountByDataSources`, `getDataEntityDomainsInfo`, `getDataEntityWithOwnership`, `findByState` (which re-adds). The asymmetry is platform-wide and goes beyond the `listPopular` finding originally surfaced.

**Description**: Every other list-shaped surface in the codebase respects `EXCLUDE_FROM_SEARCH` — verified at NINE distinct locations: `ReactiveSearchEntrypointRepositoryImpl.java:91, 117, 149, 181, 555`, `ReactiveSearchFacetRepositoryImpl.java:167, 461, 575`, `JooqFTSHelper.java:149`, plus `ReactiveDataEntityRepositoryImpl.java:448` (countByState) and `:974` (getDataEntityDefaultConditions). The `cteDataEntitySelect` used by `listPopular` (`ReactiveDataEntityRepositoryImpl.java:909-939`) applies `HOLLOW.isFalse()` (line 918) and `addSoftDeleteFilter` (line 916) — but NOT `EXCLUDE_FROM_SEARCH`. An operator who marks an entity `exclude_from_search=true` (typically to hide internal artefacts: ingestion-test fixtures, deprecated migrations, scratch tables) has a published expectation that the entity is hidden from list-shaped surfaces — Popular silently violates that expectation. If the entity has a high `view_count` (which can happen because internal entities get heavy view-traffic from the operator team itself, or via inflation per REFACTOR-220), it surfaces to all users on the home page.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:909-939` (cteDataEntitySelect — no EXCLUDE_FROM_SEARCH predicate)
- `ReactiveDataEntityRepositoryImpl.java:970-976` (`getDataEntityDefaultConditions` shows the project's pattern of applying all three filters together: HOLLOW + STATUS + EXCLUDE_FROM_SEARCH)
- `ReactiveSearchEntrypointRepositoryImpl.java:91`, `JooqFTSHelper.java:149` (the widely-applied pattern at 9 sibling locations)
- (NEW 2026-05-19H) `ReactiveDataEntityRepositoryImpl.java:448` (countByState includes the predicate) vs `:974` (getDataEntityDefaultConditions includes the predicate) vs `:909-939` (cteDataEntitySelect omits) — the in-file asymmetry is the strongest signal that the omission is unintentional.

**Existing-ADR-or-implied-prescription**: implicit — the project consistently applies EXCLUDE_FROM_SEARCH at all list-shaped surfaces. Popular is the sole exception; the batch-H repository-layer enumeration confirms 5+ other affected surfaces (listByOwner / listByTerm / getDEGExperimentRuns / getDimensions / getDetails / getQuerySuggestions). The exception is unexplained; no comment defends it.

**Proposed remedy**: Add `.and(DATA_ENTITY.EXCLUDE_FROM_SEARCH.isFalse())` to the `cteDataEntitySelect` line 909-939 — OR refactor the three filters (HOLLOW + STATUS + EXCLUDE_FROM_SEARCH) into a single helper method that ALL list-shaped surfaces use uniformly. The refactor is preferable because it prevents the inconsistency from recurring AND closes ALL 6+ affected surfaces at once.

**Severity rationale**: MEDIUM — inconsistency that exposes internal artefacts on a public-facing surface; severity depends on what operators put in EXCLUDE_FROM_SEARCH entities (for regulated-data deployments, this is a potential disclosure path). The 2026-05-19H batch widens the blast radius from Popular-only to 6+ list-shape surfaces.

**Suggested backlog grouping**: SEC-NNN or PERF-NNN consistency sweep. Pair with REFACTOR-220 (Popular hardening sprint).

---
