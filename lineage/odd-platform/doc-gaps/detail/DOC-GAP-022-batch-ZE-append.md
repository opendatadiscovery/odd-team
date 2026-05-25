## STRENGTHENS — Three NEW unbounded-`size` instances (batch ZE: SearchController + TitleController + RelationshipController)

Batch ZE supplies THREE new controller-class instances of the platform-wide unbounded-`size` pagination pattern DOC-GAP-022 catalogs.

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[4]` (MEDIUM — "Pagination unbounded on every paginated endpoint — `getSearchResults`, `getFiltersForFacet`"; OpenAPI `PageParam`/`SizeParam` have no `minimum:`/`maximum:`; `OFFSET = (page - 1) * size` without clamping)
  - `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar — "No server-side cap on `size` — caller-controlled pagination amplification"; `size` flows verbatim from `Integer size` parameter to `paginate(...).limit(size)`)
  - `odd-platform__java__TitleController__controller-class__TitleController.md:performance.known_performance_gaps.[0]` (MEDIUM — same finding from the performance lens)
  - `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:performance.known_performance_gaps.[0]` (MEDIUM — "no maximum-size guard at the controller — a caller supplying size=10000 can pull 10000 RelationshipDto objects in one response. The OpenAPI SizeParam does not declare a `maximum` constraint")
  - `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:concepts.invariants.[3]` ("Pagination uses `(page - 1) * size` arithmetic without bounds check")

- **NEW evidence (batch ZE)**:
  - **SearchController** (7 endpoints; 2 paginated): `getSearchResults` and `getFiltersForFacet` both accept unannotated `Integer page, Integer size`; the repository computes `OFFSET = (page - 1) * size` without clamping at `ReactiveDataEntityRepositoryImpl.java:389-390, 530, 589-590, 721-722` + `ReactiveSearchFacetRepositoryImpl.java:129, 157, 315, 369, 404, 449, 515`. The `getSearchSuggestions` endpoint is DIFFERENT — it caps at `SUGGESTION_LIMIT = 5` hard-coded (per DOC-GAP-288), so the autocomplete is NOT an instance of this pattern.
  - **TitleController** (1 endpoint): `getTitleList(page, size, query)` — `Integer size` flows verbatim to `paginate(...).limit(size)` via `ReactiveAbstractCRUDRepository.java:84-91`. No `Math.min(size, MAX)`, no `@Max`, no controller-level validator. OpenAPI `components.yaml:4222-4229` (SizeParam) declares no `maximum`.
  - **RelationshipController** (3 endpoints; 1 paginated): `getRelationships(page, size, type, query, exchange)` — `Integer size` → JOOQ LIMIT at `ReactiveDataEntityRelationshipRepositoryImpl.java:79`. Same shape as the Title and Search pattern. The two detail endpoints (`getERDRelationshipById`, `getGraphRelationshipById`) take no size param.
  - The cross-cutting pattern is now confirmed across NINE controllers (the prior DOC-GAP-022 + DOC-GAP-022-batch-ZB-append + this batch's three additions). The shared shape is: (a) OpenAPI `SizeParam` declares no `maximum`; (b) controller accepts the raw `Integer size`; (c) the value flows verbatim to JOOQ LIMIT through the platform's CRUD scaffolding (`ReactiveAbstractCRUDRepository` or the platform's individual repository implementations). The fix-class is one cross-cutting decision: either annotate `SizeParam` with `maximum: 1000` (or similar) at the spec level + add an `@Max` annotation at the platform's CRUD scaffolding layer, OR enforce a clamp at `JooqQueryHelper.paginate`.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The three new instances are additive (same polarity) — consistent with the platform-wide unbounded-`size` pattern. No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM** at the doc-gap level. The DOC-GAP-022 proposed "Pagination" section in `developer-guides/api-reference.md` should be extended to enumerate the three new endpoint families:
  - **Search**: `GET /api/search/{search_id}/results`, `GET /api/search/{search_id}/facet/{facet_type}`
  - **Titles**: `GET /api/titles`
  - **Relationships**: `GET /api/relationships`
  Together with the prior unbounded-`size` instances (Alerts, DataEntity, ActivityFeed, DataSources, etc.), the platform-wide MEDIUM-severity unbounded-size class is now 9+ controllers; the doc-side fix is a single Pagination section + a code-side cross-cutting fix at the spec or scaffolding tier.
