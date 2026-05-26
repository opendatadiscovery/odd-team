## STRENGTHENS — Batch ZG (DataQualityRunsController controller-class sidecar reconfirms the namespaceIds OR widening at the controller layer)

**New surfaced_by entry**:

- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**`namespaceIds`/`deNamespaceIds` filter silently widens the match: 'Namespace X' includes entities whose own NAMESPACE_ID is null/different but whose DATA_SOURCE.NAMESPACE_ID = X.** The SQL: `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`). Operator-visible consequence: filtering by namespace X yields a wider set than 'entities in namespace X' — every entity whose datasource is in namespace X is also included."

**Cross-batch refinement**:

REFACTOR-594 was originally surfaced at the UI-filters sidecar. This batch adds the backend-layer's confirmation at the controller-class surface; the OR-widening is now anchored at BOTH the dashboard's tests-side AND tables-side namespace filters (`namespaceIds` + `deNamespaceIds`).

The widening pattern: `NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID))` matches the entity's OWN namespace OR its datasource's namespace. An entity with `NAMESPACE_ID=NULL` but whose datasource is in namespace X is INCLUDED. For deployments where datasources are organised by namespace but entities are scattered, the effective filter semantic is "datasource's namespace, not entity's namespace."

The remedy options are unchanged: drop the OR clause for strict-match semantic, OR document the widening on the live dashboard page. The doc-side gap is anchored at `doc_drift_findings.[2]` of the DataQualityRunsController sidecar — the live page names the filter but doesn't state the widening.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-424 (the analogous `namespace_name` propagation gap on the ingestion-datasources POST endpoint — same namespace-handling axis).
- SUPERSEDES: none.
- CONFLICTS: none.

---
