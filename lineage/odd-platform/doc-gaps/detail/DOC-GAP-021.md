- **DOC-GAP-021**: Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat
  - **Category**: drift
  - **Surfaced by**: `DataEntityController.md:doc_drift_findings.[1]`; `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses`.
  - **Evidence**: WebFetch `/features/data-lineage` 2026-05-08 — depth caveat absent. api-ref `/lineage` 200 covers contract.
  - **Proposed doc action**: Add "Depth and bounds" admonition to `features/data-lineage.md`.
  - **Cross-references**: DataEntity performance_aggregate.
  - **Severity rationale**: MEDIUM.

#### Batch 2026-05-19-H STRENGTHENS

- Sidecar `odd-platform__java__repository_reactive__repository__ReactiveLineageRepositoryImpl.md` adds the SQL primary-source confirmation of the unbounded-depth + cycle-handling-absent + owner-unaware-CTE invariants. The finding has been promoted to a 4-angle triangulation: (i) feature page silent (batch A), (ii) api-ref claims `lineage_depth: "Unset returns the platform's default depth"` which is unimplementable per controller-layer NPE (batch F — DOC-GAP-089), (iii) controller-method silence on `expanded_entity_ids` narrower-in-doc-than-code (batch F — DOC-GAP-090), (iv) **NEW batch H** repository-layer SQL confirms NO default, NO upper bound, NO cycle guard, NO owner JOIN at the `WITH RECURSIVE` body (`ReactiveLineageRepositoryImpl.java:163-175` + `:174` + `:122-176` + `V0_0_2__add_lineage.sql:1-7` — no owner column in the schema).
- The promoted finding is consolidated at **DOC-GAP-105** which supersedes DOC-GAP-021 with the primary-source SQL + REFACTOR-202/203 + DOC-GAP-099 cross-references. DOC-GAP-021 remains for cross-reference history.
