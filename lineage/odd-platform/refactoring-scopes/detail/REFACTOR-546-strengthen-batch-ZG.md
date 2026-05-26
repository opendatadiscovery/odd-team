## STRENGTHENS — Batch ZG (Data Quality Dashboard's "count of test runs" doc vs "count of tests keyed on latest run" code is the LSN-019 family's most operator-visible instance)

The LSN-019 family (name-vs-behaviour drift at count-shaped metrics) extends to the Data Quality Dashboard surface. Batch ZG adds this as REFACTOR-653 NEW (the standalone tracker); this strengthen records the cluster-level relationship.

**Family roster** (as of batch ZG):
- **REFACTOR-490** — Popular Tags ordering drift (`listMostPopular` not popularity-ordered): the directory surface where `paginate`-inside-CTE selects oldest-by-id then re-sorts intra-page.
- **REFACTOR-546** — Tag `listMostPopular` paginate-inside-CTE drift (the SMOKING GUN class instance): endpoint NAME promises popularity-ordered; SQL DELIVERS oldest-by-id with intra-page count-DESC re-sort.
- **REFACTOR-653 NEW (this batch)** — Data Quality Dashboard "Test Results Breakdown" ring counts TESTS keyed on latest-run-status, NOT test runs: the doc says "count of test runs"; the code computes tests-by-latest-run-status.

**Cross-batch refinement**:

The DQ dashboard instance is the FAMILY'S MOST OPERATOR-VISIBLE — the dashboard is a load-bearing P-04 surface; the metric is the catalog-wide quality posture; the doc-vs-code divergence affects every operator's triage decision (high-frequency operator surface). The Popular Tags drifts (REFACTOR-490/546) are directory-side; the operator sees them on a less-load-bearing surface.

ADR-CANDIDATE-220 NEW (the denormalised `DATA_ENTITY_TASK_LAST_RUN` table is the architectural choice) captures the WHY of the DQ dashboard's count semantic. The family's prescription (Option A — doc-side fix; rename the operation to match the implementation) is the maintainer's preferred resolution at the platform's other LSN-019 instances; the same prescription applies at the DQ dashboard.

The cluster's structural primitive: name-vs-behaviour drift at metrics where the IMPLEMENTATION evolved (e.g., denormalisation, CTE-paginate refactor) but the NAME (operation summary, response field, doc page wording) did not. The systemic fix would be a CI check that the OpenAPI operation summary + the implementation's SQL pattern + the live doc's verbatim definition all triangulate to the same semantic. Currently each layer evolves independently.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-490 + REFACTOR-546 (the LSN-019 family); ADR-CANDIDATE-220 NEW (the architectural intent behind the dashboard's denormalised count); REFACTOR-653 NEW (the dashboard-specific tracker).
- SUPERSEDES: none.
- CONFLICTS: none.

---
