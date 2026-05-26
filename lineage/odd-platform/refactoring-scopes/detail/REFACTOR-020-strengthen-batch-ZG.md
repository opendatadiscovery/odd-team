## STRENGTHENS — Batch ZG (DataEntityRunController adds the 19th paginated endpoint surface to the platform-wide PageParam/SizeParam unbounded family)

**New surfaced_by entry**:

- `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "**Page-size unbounded** — `OpenAPI SizeParam` has no min/max constraint (components.yaml:4222-4229); the controller's `Integer size` parameter is passed through verbatim to the SQL `LIMIT`. A request with size=1000000 will attempt to materialise a million rows in memory through the JOOQ paginate window-function plan + jOOQ result mapping + MapStruct + Jackson serialisation. No bounds-check anywhere in the chain."

The DataEntityRunController surface (`GET /api/dataentities/{id}/runs`) adds the runs-history endpoint to the platform-wide cluster. The repository test (`DataEntityRunRepositoryImplTest`) covers in-range page sizes (size=5, 10); size=1M is not tested and the SQL path has no clamp.

**Cross-batch refinement** (batch ZG's contribution): the pattern is now confirmed at **19+ paginated endpoint surfaces** spanning every controller in the platform. The two adjacent surfaces in the runs-history context (REFACTOR-650 NULL end_time NULLS-FIRST + REFACTOR-651 display-vs-sort-key drift) are independent ordering bugs at the SAME repository call; combined, the runs-history endpoint has THREE pagination-shaped gaps. The platform-wide fix (add `minimum: 1, maximum: 1000` to OpenAPI PageParam/SizeParam) closes the size-unbounded gap; the ordering gaps require a separate fix path.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-498 (page/size sibling on TagController), REFACTOR-552 (Tag size cap), REFACTOR-341 (DataEntityController alerts pagination), REFACTOR-623 (TitleController page=0 + unbounded-size).
- SUPERSEDES: none.
- CONFLICTS: none.

---
