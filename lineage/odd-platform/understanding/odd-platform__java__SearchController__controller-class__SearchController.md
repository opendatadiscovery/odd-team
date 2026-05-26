---
node_id: "odd-platform java SearchController controller-class:SearchController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-25-batch-ZE-searchcontroller-class
---

# SearchController (class) — semantic understanding

## understanding

`SearchController` (`SearchController.java:23-92`) is the seven-endpoint reactive controller that owns the entire catalog-search lifecycle: (a) `POST /api/search` (`search`, lines 60-65) creates a server-side `search_facets` row and returns initial aggregated facet counts; (b) `GET /api/search/{search_id}` (`getSearchFacetList`, 42-47) re-reads + recomputes the aggregate for an existing session; (c) `PUT /api/search/{search_id}` (`updateSearchFacets`, 67-74) merges a delta into the persisted state; (d) `GET /api/search/{search_id}/results` (`getSearchResults`, 49-57) returns the paginated `DataEntityList` for the session; (e) `GET /api/search/{search_id}/facet/{facet_type}` (`getFiltersForFacet`, 30-40) returns paginated filter-options for one of `TAGS|OWNERS|TYPES|GROUPS|STATUSES`; (f) `GET /api/search/suggestions` (`getSearchSuggestions`, 76-83) returns the prefix-match top-5 autocomplete; (g) `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` (`highlightDataEntity`, 85-91) renders per-field FTS highlights for a single entity within a session's query. Every endpoint is a 3-line WebFlux delegate; six of seven delegate to `SearchService` (`SearchServiceImpl.java:41-196`), the highlight endpoint delegates to `DataEntityHighlightService` (`DataEntityHighlightServiceImpl.java:20-47`). The class implements the OpenAPI-generated `SearchApi` interface (per the `implements SearchApi` clause on line 25); no `@RequestMapping`, no `@PreAuthorize`, no programmatic security check is present on any method; the entire surface falls through to `pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`) and is reachable by any authenticated user under `LOGIN_FORM | OAUTH2 | LDAP`, plus any anonymous caller under `DISABLED`.

## concepts

- entities: [
    "`SearchFormData` (POST/PUT request body — `query: string` + `myObjects: boolean` + `filters: {types/datasources/namespaces/owners/tags/entity_classes/statuses}`; OpenAPI-generated)",
    "`SearchFacetsData` (response payload — `searchId: UUID` + `query` + `total` + `myObjectsTotal` + `myObjects` + `facetState`; common to `search`/`getSearchFacetList`/`updateSearchFacets`)",
    "`SearchFacetsPojo` (persisted session row in `search_facets` table — `id uuid PRIMARY KEY DEFAULT gen_random_uuid(), query_string varchar(255), filters jsonb, last_accessed_at`; no `owner_id`/`created_by`)",
    "`FacetStateDto` (in-memory representation: `Map<FacetType, List<SearchFilterDto>> state, String query, boolean myObjects`)",
    "`MultipleFacetType` enum: `TAGS | OWNERS | TYPES | GROUPS | STATUSES` (`SearchServiceImpl.java:168-174`)",
    "`CountableSearchFilter` (facet-option element — `id + name + count + selected`)",
    "`DataEntityList` (paginated result list — `items: List<DataEntity>` + `pageInfo: {total, hasNext}`)",
    "`DataEntityRef` (autocomplete suggestion — `id + oddrn + internalName + externalName + entityClasses + manuallyCreated`)",
    "`DataEntitySearchHighlight` (per-entity FTS highlight payload — fields with `<b>...</b>`-marked match positions)"
  ]
- operations: [
    "`search(SearchFormData)` (POST /api/search) — creates session row + returns aggregated counts (`SearchController.java:60-65` → `SearchServiceImpl.java:74-82, 122-155`)",
    "`getSearchFacetList(searchId)` (GET /api/search/{search_id}) — re-read session + recompute aggregates (`SearchController.java:42-47` → `SearchServiceImpl.java:65-72`)",
    "`updateSearchFacets(searchId, SearchFormData)` (PUT /api/search/{search_id}) — merge delta into persisted state + recompute (`SearchController.java:67-74` → `SearchServiceImpl.java:84-96`)",
    "`getSearchResults(searchId, page, size)` (GET /api/search/{search_id}/results) — paginated FTS+facet-filtered data-entity list (`SearchController.java:49-57` → `SearchServiceImpl.java:99-112` → `DataEntityServiceImpl.java:181-194` → `ReactiveDataEntityRepositoryImpl.findByState:651-727`)",
    "`getFiltersForFacet(searchId, facetType, page, size, query)` (GET /api/search/{search_id}/facet/{facet_type}) — paginated facet-option list (`SearchController.java:30-40` → `SearchServiceImpl.java:51-63, 162-175`)",
    "`getSearchSuggestions(query, entityClassId, manuallyCreated)` (GET /api/search/suggestions) — top-5 autocomplete by FTS rank (`SearchController.java:76-83` → `SearchServiceImpl.java:115-120` → `ReactiveDataEntityRepositoryImpl.getQuerySuggestions:470-513`)",
    "`highlightDataEntity(searchId, dataEntityId)` (GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights) — `ts_headline` per-field highlight (`SearchController.java:85-91` → `DataEntityHighlightServiceImpl.java:26-46` → `ReactiveDataEntityRepositoryImpl.getHighlightedResult:798-806`)"
  ]
- invariants:
  - "Every endpoint is a 3-line delegate — controller body is `Mono.just(svc.call(...))).map(ResponseEntity::ok)` (suggestions/getFiltersForFacet) or `svcCall.map(ResponseEntity::ok)` (search/getSearchFacetList/getSearchResults/updateSearchFacets/highlightDataEntity); the class has NO `@RequestMapping`, NO `@PreAuthorize`, NO logging, NO error mapping, NO validation beyond `@Valid` inherited from `SearchApi` (`SearchController.java:23-92`)"
  - "All seven endpoints fall through to `pathMatchers('/**').authenticated()` — `SecurityConstants.SECURITY_RULES` carries NO entry for any `/api/search*` path (verified by `grep -in 'search\\|facet' <SecurityConstants.java>` returning zero matches during enrichment 2026-05-25); `AuthorizationCustomizer.java:29-30` is the catch-all"
  - "Five of seven endpoints (all except `search` and `getSearchSuggestions`) are keyed by a `searchId: UUID` — a bearer-token-shaped session handle with NO `owner_id`/`created_by` column in the `search_facets` table (`V0_0_1__init.sql:204-211`). Any authenticated caller holding any other user's UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access to that session"
  - "Reactive signatures throughout — every method returns `Mono<ResponseEntity<...>>`; `getFiltersForFacet` and `getSearchSuggestions` use `Mono<ResponseEntity<Flux<...>>>` for streamed responses (`SearchController.java:30, 77`)"
  - "`SearchFormData.query` carries no `@Size`/`@Pattern`/maxLength at the OpenAPI spec, generated POJO, or controller layers — unbounded query-length is structurally accepted (cross-link batch E corner-case 3)"
  - "Pagination parameters (`Integer page, Integer size`) on `getSearchResults`/`getFiltersForFacet` are unannotated at the controller layer; OpenAPI `PageParam`/`SizeParam` carry no `minimum:`/`maximum:`; the repository computes `OFFSET = (page - 1) * size` without clamping (`ReactiveDataEntityRepositoryImpl.java:389-390, 530, 589-590, 721-722` + `ReactiveSearchFacetRepositoryImpl.java:129, 157, 315, 369, 404, 449, 515`)"
  - "`SearchFacetsData.hasNext` is ALWAYS `true` regardless of remaining rows — `DataEntityServiceImpl.findByState:181-194` constructs `new Page<>(dtos, total, true)` with a hard-coded `true` for the `hasNext` boolean (`Page.java:11-15`); the UI compensates by computing `hasNext: page * size < pageInfo.total` in the `fetchDataEntitySearchResults` thunk (`dataentitiesSearch.thunks.ts:62-63`), but third-party API consumers reading the contract directly will pagination-loop indefinitely (Category B drift — see `stress_findings.name_behavior_pairs`)"
  - "FTS is constructed by `JooqFTSHelper.tsQuery` — split-on-space + `:*` per token + `&`-join (`JooqFTSHelper.java:164-168`); special tsquery operators (`!`, `(`, `)`, `:`, `<->`, `|`) are NOT escaped before reaching `to_tsquery(?)` (`JooqFTSHelper.java:100-105`). On `highlightDataEntity` the same query is INTERPOLATED directly into a raw SQL string via `.formatted(text, tsQuery)` (`ReactiveDataEntityRepositoryImpl.java:798-806`) — both DoS-by-syntax-error AND a true SQL-injection vector (batch H finding, cross-link `bugs_limitations_corner_cases[7]`)"
  - "`getSearchSuggestions` empty-query short-circuit — `ReactiveDataEntityRepositoryImpl.getQuerySuggestions:474-476` returns `Flux.empty()` BEFORE any DB call when `StringUtils.isEmpty(query)`; `search` has NO equivalent guard (the empty-query session row IS persisted + the FTS condition still attached at the SQL layer)"
- audiences:
  - "ODD Platform UI Catalog tab — `Search.tsx:24-92` is the route component that mounts `Filters` (the 7-facet sidebar) + `Results` (the infinite-scrolled tabbed result list). Search creation is dispatched on mount (line 37-42); facet updates are 1.5s-debounced (line 50-65); result pagination uses InfiniteScroll with size=30 (`Results.tsx:45, 71-74, 142-160`)"
  - "ODD Platform UI Main-search bar / autocomplete — `SearchSuggestionsAutocomplete.tsx:75-77, 87` dispatches `fetchSearchSuggestions({query, ...searchParams})` with 500ms debounce; the autocomplete labels each suggestion by `internalName || externalName` (line 90-93, 126), routes the user to `dataEntityDetailsPath(id)` on selection (line 138)"
  - "Third-party API consumers integrating against `/api/search*` (per the OpenAPI `SearchApi` interface) — particularly affected by the `hasNext: true` contract lie (pagination-loop) and the cross-owner facet-count enumeration surface"
  - "An authenticated attacker enumerating cross-owner catalog state via `getFiltersForFacet(OWNERS)` (enumerates every owner + per-owner count) and via `getSearchResults` (catalog-wide enumeration without owner predicate); under `DISABLED` auth, anonymous"

## dependencies_semantic

- requires-feature:
  - "**Search and Filtering (P-01 Data Discovery)** — live doc WebFetched 2026-05-25 status 200 `https://docs.opendatadiscovery.org/features/data-discovery/search`. The page documents the seven UI facets but is SILENT on: (a) WHO can search; (b) query syntax / tsquery handling; (c) autocomplete behaviour (no `/api/search/suggestions` page exists either — WebFetched `/features/data-discovery/search-suggestions` 2026-05-25 returns 404); (d) pagination semantics including the `hasNext: true` contract bug; (e) catalog scope (per-user vs catalog-wide). All five absences are doc-drift candidates documented under `doc_drift_findings`"
  - "**Postgres FTS via `to_tsquery`** — every search-side aggregator joins to `SEARCH_ENTRYPOINT.SEARCH_VECTOR` (`tsvector`) and applies `ftsCondition(SEARCH_ENTRYPOINT.SEARCH_VECTOR, query)` (`JooqFTSHelper.java:100-105`). Ranking via `ts_rank` (`JooqFTSHelper.java:154-162`). Highlight via `ts_headline` (`ReactiveDataEntityRepositoryImpl.java:798-806`). All three use `tsQuery` (lines 164-168) which is the unsafe split-on-space + `:*` + `&`-join chain"
  - "**SearchFacetsHousekeepingJob (F-010)** — `application.yml:169` ships `housekeeping.ttl.search_facets_days: 30`; rows whose `last_accessed_at` exceeds the TTL are deleted by the 15-minute housekeeping cycle. (Correction from LSN-018: the V0_0_1 schema TODO `find a way to define TTL` was SUPERSEDED by V0_0_52 + the job; the prior facets sidecar's `unbounded growth` claim was wrong.)"
  - "**ADR-CANDIDATE-002 — Centralised endpoint authorization via SECURITY_RULES** — the search class is a structural instance of the convention: no controller annotations, no `*Api` interface annotations, authorization mounted (or not mounted) globally via `SecurityConstants.SECURITY_RULES`. The `/api/search*` paths are intentionally NOT rule-gated; the convention is `GET = read-collaborative` (ADR-CANDIDATE-003)"
- requires-config: [] — N/A (neither the controller nor `SearchServiceImpl`/`DataEntityHighlightServiceImpl` reads any `@Value` / `@ConfigurationProperties`; auth wiring is enforced globally by `*SecurityConfiguration` beans on the `auth.type` property; housekeeping TTL is read in `SearchFacetsHousekeepingJob`, not on this path)
- requires-runtime:
  - "Spring WebFlux — every method returns `Mono<ResponseEntity<...>>` and accepts `ServerWebExchange exchange` (`SearchController.java:19-21, 30-91`)"
  - "jOOQ reactive Postgres session — `JooqReactiveOperations.mono()` / `.flux()` execution for facet aggregators, count, find-by-state, suggestions, highlights, and session-row CRUD"
  - "Reactor Core — `Mono.zip` (3-Mono for `getFacetsData` at `SearchServiceImpl.java:132-154`; 3-Mono for `highlightDataEntity` at `DataEntityHighlightServiceImpl.java:36`); `Mono.flatMapMany` (suggestions/filterOptions)"
  - "Postgres ≥ 13 — `gen_random_uuid()` server-side default on `search_facets.id`; `to_tsquery` + `@@` + `ts_rank` + `ts_headline` FTS functions"
  - "`AuthIdentityProvider` reactor-context principal resolution — `authIdentityProvider.fetchAssociatedOwner()` called by `getFacetsData` (line 128) for the unconditional `myObjectsCount` and by `getSearchResults` (line 106) for owner-scoped result filtering when `state.isMyObjects()`"
- couples-to:
  - "`SearchApi` (OpenAPI-generated interface) — supplies `@RequestMapping` bindings for all seven endpoints (`openapi.yaml:633-808`), `@Valid @RequestBody` on POST/PUT, response schemas from `components.yaml`. `SearchController implements SearchApi` (`SearchController.java:25`)"
  - "`SearchService` (`SearchServiceImpl.java:41-196`) — sole downstream service for six of seven endpoints"
  - "`DataEntityHighlightService` (`DataEntityHighlightServiceImpl.java:20-47`) — sole downstream service for `highlightDataEntity`"
  - "`ReactiveSearchFacetRepository` — `create`/`update`/`get` for session CRUD; six facet aggregators (entityClass/owner/tag/type/group/status) for the count-side queries"
  - "`ReactiveDataEntityRepository` — `countByState(state)` (catalog-wide), `countByState(state, owner)` (my-objects), `findByState(state, page, size, owner)` (paginated results), `getQuerySuggestions(query, entityClassId, manuallyCreated)` (autocomplete), `getDataEntitySearchFields(id)` (highlight subject), `getHighlightedResult(text, query)` (`ts_headline` direct-formatted SQL)"
  - "`DataEntityService.findByState` (`DataEntityServiceImpl.java:181-194`) — wraps the repository call + enriches with entity-class details + parent groups + ALWAYS sets `hasNext: true` in the `Page<>` (line 192)"
  - "`JooqFTSHelper.tsQuery` + `ftsCondition` + `ftsRankField` — the persisted-query → tsquery conversion path used by every FTS-using endpoint. SAME code surface as the cross-cutting FTS-injection batch H finding"
  - "`FacetStateMapper.mapForm` + `pojoToState` + `mapStateToPojo` + `mapDto` — codec between OpenAPI `SearchFormData`/`SearchFacetsData` and the in-memory `FacetStateDto` and the persisted `SearchFacetsPojo` jsonb `filters` column"
  - "`DataEntityMapper.mapPojos(Page<DataEntityDimensionsDto>)` — the mapper that materialises `DataEntityList` from the `Page<>` wrapper carrying the hard-coded `hasNext: true`"

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Playwright UI happy-path search scenarios — `searchBy('books aqa')`, `'group aqa'`, etc., empty-query, special-character variants"
    test_class: integration
    test_files: ["tests/features/search/search.spec.ts", "tests/features/search/search_in_data_entity.spec.ts"]
- uncovered_behaviours:
  - behaviour: "`POST /api/search` returns `200 OK` with deserialisable `SearchFacetsData` (HTTP-contract smoke test)"
    test_class: integration
    criticality: HIGH
    note: "No `@WebFluxTest(SearchController.class)` exists; a regression in OpenAPI routing, WebFlux config, Jackson serialisation, or jOOQ wiring would silently break the entire search surface"
  - behaviour: "`getSearchResults` pagination terminates correctly when `total < page*size` (the `hasNext: true` contract bug — REFACTOR candidate)"
    test_class: integration
    criticality: HIGH
    note: "Third-party API consumer using the OpenAPI contract directly will loop forever; the UI hides the bug by computing hasNext client-side"
  - behaviour: "Cross-owner facet-count enumeration regression — assert whether `GET /api/search/{userB_session_uuid}/facet/OWNERS` is reachable from userA and returns the full owner list"
    test_class: security
    criticality: HIGH
    note: "Currently reachable; no test would catch a future tightening"
  - behaviour: "Pagination boundaries on `getSearchResults` and `getFiltersForFacet` — `page=0` (negative OFFSET), `size=0`, `size=Integer.MAX_VALUE`"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "tsquery operator injection / DoS — `state.getQuery() = 'foo )('` produces 500-class on every subsequent facet read; assert error mapping AND a clean rejection"
    test_class: security
    criticality: HIGH
    note: "Cross-link batch H — getHighlightedResult uses .formatted() string-interpolation which is a true SQL-injection vector, not just a DoS"
  - behaviour: "`getSearchSuggestions` ordering invariant — top-5 by FTS rank DESC; tie-breaker determinism (CTE has `ORDER BY rank DESC LIMIT 5` but the OUTER select re-sorts only by `rank DESC` with no secondary key)"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`highlightDataEntity` returns deserialisable `DataEntitySearchHighlight` with correct `<b>...</b>` markup; assert the SQL-injection surface"
    test_class: security
    criticality: HIGH
  - behaviour: "Search-session UUID isolation — assert userA cannot READ/UPDATE userB's session (currently SUCCEEDS; test would document the gap)"
    test_class: security
    criticality: HIGH
  - behaviour: "`updateSearchFacets` merge semantics — assert that a partial filter delta merges with the persisted state rather than replacing it (the `FacetStateDto.merge` contract)"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "`SearchFacetsHousekeepingJob` actually deletes rows past TTL (F-010)"
    test_class: integration
    criticality: HIGH
    note: "Captured separately as TEST-GAP-523 per LSN-018 correction"
- test_files:
  - "tests/features/search/search.spec.ts (Playwright UI spec)"
  - "tests/features/search/search_in_data_entity.spec.ts (Playwright UI spec)"
  - "No JVM-side tests — `find <odd-platform> -path '*test*' -name 'SearchController*'`, `find <odd-platform> -path '*test*' -name 'SearchServiceImpl*'`, `find <odd-platform> -path '*test*' -name '*Search*' -name '*.java' -not -path '*build*'` all returned zero matches (verified 2026-05-25)"
- gaps: |
    The entire JVM side of the seven-endpoint search surface is untested. The Playwright specs cover only the UI happy-path against the main search bar. The highest-leverage gaps are:
    (a) **integration**: an HTTP-contract round-trip `POST /api/search` → `GET /api/search/{id}` → `GET /api/search/{id}/results` → `GET /api/search/{id}/facet/OWNERS` to lock the contract — this catches the `hasNext: true` bug, OpenAPI routing regressions, Jackson serialisation drift, and jOOQ schema drift in one suite;
    (b) **security**: cross-owner enumeration regression, search-session bearer-token regression, tsquery-injection regression on both `state.getQuery()` (DoS path) and `getHighlightedResult` (raw-SQL injection path);
    (c) **performance**: the unconditional `myObjectsCount` aggregation cost (1 wasted query per search), the `hasNext` infinite-pagination cost for API consumers, the unbounded `size` parameter on every paginated endpoint.
    The **security** class has the worst coverage on this node — three HIGH-criticality uncovered behaviours all surface as live operator-visible exposures.

## docs_link_semantic

- declared_docs: [] — N/A. `SearchController.java` carries no `@docs` annotation (repo-wide convention per AlertController / DataEntityController class-level sidecars).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: ""
    rationale: "The single live page describing the search-and-filtering feature; documents the seven-facet UI surface backed by every endpoint on this controller. WebFetched 2026-05-25 status 200; content unchanged from 2026-05-19"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Seven facets enumerated (verbatim 2026-05-25): Datasource (single-select); Type ('TABLE', 'JOB', 'DASHBOARD'; multi-select); Namespace (single-select); Owner (multi-select); Tag (multi-select); Groups (multi-select); Statuses ('STABLE', 'DEPRECATED'; multi-select).
      Topics absent (verbatim 2026-05-25): "Search authorization/access — no information about WHO can search or access restrictions / Query syntax — no details on wildcard operators, tsquery handling, or advanced syntax / Search suggestions/autocomplete — no mention of these features / Pagination — no discussion of result pagination mechanisms / Catalog scope — no explanation of whether results are per-user, per-owner, or catalog-wide".
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search-suggestions"
    anchor: ""
    rationale: "Candidate canonical home for `/api/search/suggestions` (no separate page exists today)"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/data-discovery/search"
    anchor: ""
    rationale: "Legacy/short URL — verified 404 on 2026-05-19 by the prior facets sidecar"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
- doc_drift_findings:
  - "**Five absences on the live page are operator-relevant.** (1) WHO can search — the page is silent; the code enforces `pathMatchers('/**').authenticated()` only, which means ANY authenticated user can paginate the whole catalog; (2) Query syntax — the page is silent; `JooqFTSHelper.tsQuery` splits on a single space + appends `:*` + joins with `&` + passes verbatim to `to_tsquery`, so unbalanced parens or special operators in the user query produce 500-class errors with no documented escape; (3) Autocomplete — the page is silent; `getSearchSuggestions` returns top-5 by `ts_rank DESC` with no documented determinism contract; (4) Pagination — the page is silent; the response carries `hasNext: true` ALWAYS which is a contract bug for API consumers (UI fixes client-side); (5) Catalog scope — the page is silent; facet counts AND result lists are catalog-wide by default. Severity: HIGH overall — multiple parallel doc-drift candidates"
  - "**No canonical home for the autocomplete / suggestions endpoint.** WebFetched `/features/data-discovery/search-suggestions` 2026-05-25 returns 404. The endpoint is functionally distinct (no session, prefix-match, `ENTITY_CLASS_IDS`-filter + `MANUALLY_CREATED`-filter, top-5 hard-coded via `SUGGESTION_LIMIT = 5` at `ReactiveDataEntityRepositoryImpl.java:92`) but lives off the same controller. Operators wanting to integrate the autocomplete via API have no documented contract"
  - "**The `hasNext: true` contract bug is operator-visible only for API consumers, not for the UI.** `DataEntityServiceImpl.findByState:192` constructs `new Page<>(dtos, total, true)` with hard-coded `true`. The UI's `fetchDataEntitySearchResults` thunk (`dataentitiesSearch.thunks.ts:62-63`) silently overrides with `hasNext: page * size < pageInfo.total`. A third-party consumer reading the OpenAPI contract directly and trusting `hasNext: false` to terminate pagination loops will never terminate — they will fetch page 1, page 2, ..., page N where N*size >= total, then continue fetching empty pages forever. Same shape as REFACTOR-024 / 053 (UI compensates for a backend bug) but specifically on a documented OpenAPI response field"

## implicit_adrs

- "**Search-session-as-server-state pattern (ADR-CANDIDATE-001 instance) — every search interaction binds to a UUID-keyed `search_facets` row.** Five of seven endpoints take `search_id: UUID` as a path parameter; `POST /api/search` creates the row + returns the UUID; `GET /api/search/{search_id}/results` is the result-fetch step (separate from session creation); `getSearchFacetList`, `updateSearchFacets`, `getFiltersForFacet`, `highlightDataEntity` all operate on the same UUID. The same session-UUID pattern is replicated in `TermController`, `QueryExampleController`, `ReferenceDataController` — four feature surfaces apply the same shape, signalling intentional design. Trade-off: server retains query state across multi-step UI flows at the cost of an unbounded table requiring TTL housekeeping (F-010, default 30 days)." — evidence: `SearchController.java:30-91` (all five searchId-keyed endpoints) + `SearchServiceImpl.java:74-82` (`searchFacetRepository::create`) + `openapi.yaml:633-808` (every `/api/search/{search_id}/*` path) + parallel TermSearchService / QueryExampleSearchService — intent_anchor: "implements SearchApi" (`SearchController.java:25`) + the parallel sibling controllers using identical session-UUID shape — confidence: HIGH

- "**Reactive pass-through delegate (ADR-CANDIDATE-001 strengthen) — controllers are 3-line WebFlux delegates with NO controller-side logic.** Every method body is `svcCall.map(ResponseEntity::ok)` or `Mono.just(svcCall(...))).map(ResponseEntity::ok)`. No `@RequestMapping`/`@PostMapping`/`@GetMapping` annotations (delegated to the generated `SearchApi` interface), no `@Slf4j` logging, no error mapping, no input validation beyond inherited `@Valid`, no metric counters." — evidence: `SearchController.java:23-92` (all 7 methods are 3-line delegates; class has only `@RestController` + `@RequiredArgsConstructor` annotations) — intent_anchor: "public class SearchController implements SearchApi" (`SearchController.java:25`) + the structural consistency across all 30+ controllers in the platform — confidence: HIGH

- "**Centralised authorization via `SecurityConstants.SECURITY_RULES` — `/api/search*` is intentionally NOT rule-gated (ADR-CANDIDATE-002 instance + ADR-CANDIDATE-003 strengthen).** `SECURITY_RULES` has no entry for any search path; all seven endpoints fall through to `pathMatchers('/**').authenticated()`. This is the GET-collaborative convention applied to search: any authenticated user may read. The convention is structurally consistent with `getDataEntityDetails`, `getAllAlerts`, `getActivity`, `getCatalogDirectories`, `getNamespaceList`, etc. — search is one of many read-collaborative surfaces. Trade-off accepted: cross-owner enumeration (operator-visible — see `bugs_limitations_corner_cases[0]`) in exchange for the simpler centralised model" — evidence: `SecurityConstants.java` (no search entries — `grep -in 'search\\|facet' <SecurityConstants.java>` returned 0 matches on 2026-05-25) + `AuthorizationCustomizer.java:29-30` (catch-all) + ADR-CANDIDATE-002 / ADR-CANDIDATE-003 — intent_anchor: "spec.pathMatchers(\"/**\").authenticated();" (`AuthorizationCustomizer.java:29-30`) + the structural consistency across the entire controller layer — confidence: HIGH

- "**Bearer-token-shaped search sessions (carried forward from the prior facets sidecar with intent annotation).** `search_facets` schema has NO `owner_id`/`created_by`/`user_id` column; the UUID is the sole identifier. `SearchServiceImpl.search` creates rows without capturing the principal; `updateFacets` accepts any caller for any UUID; `fetchFacetState` is a raw UUID lookup. The schema went into V0_0_1 this way and has been retained across all subsequent migrations. TODOs `find more clever way to generate uuid` + `find a way to define TTL` (V0_0_1__init.sql:206-207) — the TTL TODO was addressed by V0_0_52 + F-010; the unscoped posture has been retained without flag in any later migration." — evidence: `V0_0_1__init.sql:204-211` (schema with no owner column) + `SearchServiceImpl.java:75-82, 84-96, 157-160` + `ReactiveSearchFacetRepositoryImpl.java:75-106` — intent_anchor: the schema column list itself + the convention's consistency with sibling Term/QueryExample/ReferenceData search sessions — confidence: MEDIUM (structural-convention; no explicit comment defends the unscoped posture as intentional, but it's been the design across 50+ migrations and 4 sibling features)

## bugs_limitations_corner_cases

- "**Catalog-wide cross-owner enumeration via `getSearchResults` + `getFiltersForFacet`.** Any authenticated caller (or anonymous under DISABLED) can: (a) `POST /api/search` with `myObjects=false` (the default); (b) `GET /api/search/{search_id}/results?page=1&size=N` to paginate every non-`EXCLUDE_FROM_SEARCH` data entity in the platform — name, ODDRN, descriptions, owners, tags, namespace, custom metadata; (c) `GET /api/search/{search_id}/facet/OWNERS?page=1&size=1000` to enumerate every owner name + per-owner entity count; (d) `GET /api/search/{search_id}/facet/{TAGS,GROUPS,TYPES,STATUSES}` to enumerate the catalog cardinality across each facet. The live doc page does not mention this posture. Pairs with REFACTOR-024 (getAllAlerts) + REFACTOR-053 (activity) + the facets sidecar's HIGH finding — together they form the catalog-wide cross-owner enumeration surface." — evidence: `SearchController.java:30-91` (no security annotations) + `SearchServiceImpl.java:99-112` (only owner-filters when `state.isMyObjects()`) + `DataEntityServiceImpl.java:181-194` + `SecurityConstants.java` (no rule) + `AuthorizationCustomizer.java:29-30` + WebFetch search page 2026-05-25 — severity: HIGH

- "**`getSearchResults.hasNext` is always `true` regardless of remaining rows — contract bug (Category B drift).** `DataEntityServiceImpl.findByState:181-194` constructs `new Page<>(dtos, total, true)` with `true` hard-coded; the mapper writes that into `DataEntityList.pageInfo.hasNext`. Operator-visible consequences: (a) third-party API consumers using the OpenAPI contract directly will loop fetching empty pages indefinitely; (b) the UI compensates client-side at `dataentitiesSearch.thunks.ts:62-63` with `hasNext: page * size < pageInfo.total` — but this is undocumented compensation and any other consumer (mobile client, CLI integration, automated test) is broken; (c) the documented `PageInfo` schema in the OpenAPI spec is a lie. Fix anchor: `DataEntityServiceImpl.java:192` change `true` → `(page * size) < total`." — evidence: `DataEntityServiceImpl.java:181-194` + `Page.java:11-15` + `dataentitiesSearch.thunks.ts:62-63` (UI workaround) + `openapi.yaml:734-755` (OpenAPI contract) — severity: HIGH

- "**Search-session UUIDs are bearer tokens by schema design.** Any authenticated caller in possession of any other user's `searchId` UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access. Concrete impact: (a) screenshot/URL leakage exposes the entire saved filter state including the `myObjects` toggle, FTS query text (potentially PII), and selected filters; (b) `PUT /api/search/{search_id}` allows arbitrary modification of another user's persisted state; (c) probing UUIDs returns `404 Search not found` on miss (server-generated v4 UUIDs are unguessable in O(2^60), so brute-force is infeasible — but leakage IS the attack). The schema went in this way at V0_0_1 and never changed." — evidence: `V0_0_1__init.sql:204-211` + `SearchServiceImpl.java:75-82, 84-96, 157-160` + `SearchController.java:30-91` — severity: HIGH

- "**`auth.type=DISABLED` makes the entire search surface anonymously reachable.** All seven endpoints fall through to `pathMatchers('/**').authenticated()` which is bypassed under `DisabledAuthSecurityConfiguration`. Combined with bearer-token-shaped sessions + cross-owner posture, the DISABLED mode lets any network-reachable client enumerate the entire catalog. DISABLED is dev-only per docs, but operators who misuse it expose the whole catalog discovery surface." — evidence: `SearchController.java:30-91` + `SecurityConstants.java` (no rule) + AlertController class-level sidecar `bugs_limitations_corner_cases[2]` (same DISABLED-anonymous-reach pattern) — severity: MEDIUM

- "**Pagination unbounded on every paginated endpoint — `getSearchResults`, `getFiltersForFacet`.** Controller params `Integer page, Integer size` carry no `@Min`/`@Max`; OpenAPI `PageParam`/`SizeParam` have no `minimum:`/`maximum:`; the repository computes `OFFSET = (page - 1) * size` without clamping. A caller passing `size=1_000_000` triggers a single bounded-only-by-Postgres/network query; `page=0` produces a negative OFFSET (implementation-defined behaviour). Same pattern as batch L (`getDataEntityAlerts`), batch M (`getFiltersForFacet`), batch E (`getSearchResults`)." — evidence: `SearchController.java:30-57` (unannotated params) + `openapi.yaml:746-747, 719-721` + `ReactiveDataEntityRepositoryImpl.java:389-390, 530, 721-722` + `ReactiveSearchFacetRepositoryImpl.java:129, 157, 315, 369, 404, 449, 515` — severity: MEDIUM

- "**tsquery-operator injection on persisted `state.query_string` → DoS on every subsequent facet read.** `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) does not escape tsquery operators. A caller POSTs `query='foo )('`; the row persists; every subsequent facet aggregator + count + suggestion call on that session fails at `to_tsquery` parse time with `42601: syntax error in tsquery`. Session becomes permanently broken — the row is reachable but every facet read 500s until housekeeping deletes it 30 days later." — evidence: `JooqFTSHelper.java:100-105, 164-168` + `ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582` + `SearchServiceImpl.java:74-96` (no validation before persistence) — severity: HIGH

- "**`getHighlightedResult` is a TRUE SQL-injection vector (NOT just a DoS).** `ReactiveDataEntityRepositoryImpl.java:798-806` does `final String sql = \"ts_headline('english', '%s', to_tsquery('%s'), 'HighlightAll=true')\".formatted(text, tsQuery);` — direct string-interpolation into raw SQL via `String.formatted`. Both `text` (the catalog-supplied entity searchable string) and `tsQuery` (the user-supplied search query after tokenisation) are interpolated WITHOUT escaping. A caller POSTs `query=`X', NULL); SELECT pg_sleep(10); --` → the persisted `query_string` flows through `getHighlightedResult` → arbitrary SQL execution on the `read` connection. Severity HIGH; this is the canonical batch H finding, with `highlightDataEntity` as the controller entry point." — evidence: `ReactiveDataEntityRepositoryImpl.java:798-806` (`.formatted(text, tsQuery)`) + `DataEntityHighlightServiceImpl.java:40-46` (the call site) + `SearchController.java:85-91` (the HTTP entry point) + cross-link batch H — severity: HIGH

- "**`getSearchSuggestions` has no determinism contract on ties.** `ReactiveDataEntityRepositoryImpl.java:470-513`: the CTE selects + sorts by `RANK_FIELD_ALIAS DESC` + `LIMIT SUGGESTION_LIMIT(5)`; the OUTER select re-sorts by `rank DESC` only (no secondary key). When 6+ entities have equal `ts_rank`, the top 5 are picked by storage/heap order — i.e. non-deterministic across queries on the same dataset. Operators searching for a popular term ('users', 'orders') may see different top-5 across keystrokes. The UI's autocomplete dropdown labels each suggestion by `internalName || externalName` (`SearchSuggestionsAutocomplete.tsx:90-93`); operator-visible: ambiguous/flickering suggestions." — evidence: `ReactiveDataEntityRepositoryImpl.java:470-513` (no tiebreaker on the ORDER BY) + `SearchSuggestionsAutocomplete.tsx:90-93, 126` — severity: MEDIUM

- "**`getSearchSuggestions.entityClassId` parameter is a single Integer — cannot filter multi-class entities by multiple classes.** `SearchController.java:78` declares `final Integer entityClassId`; `ReactiveDataEntityRepositoryImpl.java:482-484` does `DATA_ENTITY.ENTITY_CLASS_IDS.contains(new Integer[] {entityClassId})`. The column is a `int[]` (a data entity may have multiple classes — e.g. a `DataSet` that's also a `DataInput`); the filter is a subset-check against a single-element array. Operator-visible: if a user wants suggestions for `DataInput`-or-`DataSet`, they have to call the endpoint twice + de-duplicate; the API does not support OR-filtering on entity_class even though the underlying column model supports it. Documented `entity_class_id` parameter name is singular — Category F MATCHES (no name-drift) but a feature-gap." — evidence: `SearchController.java:76-83` + `ReactiveDataEntityRepositoryImpl.java:482-484` + `openapi.yaml:788-792` — severity: LOW

- "**`getSearchSuggestions.manuallyCreated: Boolean` is nullable + has no UI consumer for `false`.** The endpoint accepts three input states (`null` = no filter; `true` = manually-created only; `false` = ingested only). The UI passes `manuallyCreated: true` ONLY when adding entities to a Data Entity Group (`AddDataEntityToGroupForm.tsx:82`); main-search autocomplete passes neither flag (defaults to null = unfiltered). The `false` branch is exercised by no UI consumer found in this enrichment (`Grep manuallyCreated.*false` returned no UI hits). Category F MATCHES (parameter name matches behaviour) but the `false` branch is structurally unreachable from the UI." — evidence: `SearchController.java:79` + `ReactiveDataEntityRepositoryImpl.java:485-487` + `AddDataEntityToGroupForm.tsx:82` + Grep absence — severity: LOW

- "**Per-call principal lookup overhead — `authIdentityProvider.fetchAssociatedOwner()` runs UNCONDITIONALLY on every `getFacetsData` call** (search + getSearchFacetList + updateSearchFacets). Even when the caller has `myObjects=false`, the owner lookup + owner-scoped count both run inside the `Mono.zip`, contributing 1 wasted query + 1 wasted DB principal-resolution per search. Cross-link batch E corner-case 6 (same finding on `SearchController.search`)." — evidence: `SearchServiceImpl.java:122-155` + `SearchServiceImpl.java:128-130` (the `myObjectsCount` Mono runs unconditionally) — severity: MEDIUM

- "**No HTTP-level integration test for ANY of the 7 endpoints.** A regression in OpenAPI routing, WebFlux config, Jackson serialisation, jOOQ FTS, the highlighting SQL, the facet aggregators, or the session-row CRUD would not be caught by the build. The only existing search tests are two Playwright UI specs (`tests/features/search/*.spec.ts`)." — evidence: `find <odd-platform> -path '*test*' -name '*Search*' -name '*.java' -not -path '*build*'` returned zero matches (2026-05-25) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "ReactiveDataEntityRepositoryImpl.java:92"
      name: "SUGGESTION_LIMIT"
      value: "5"
      questions:
        - q: "What at N = 0? (no rows match)"
          a: "Returns Flux.empty() — the CTE returns 0 rows + the OUTER select returns 0 rows + the UI's autocomplete shows the input-only label with no dropdown items"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:470-513 + SearchSuggestionsAutocomplete.tsx:202-204 (loading state)"
        - q: "What at N > 5? (more matching rows than limit)"
          a: "The CTE truncates to top-5 by ts_rank DESC; the OUTER select re-orders the same 5 rows by rank DESC. Rows ranked 6+ are silently dropped. The operator sees only 5 suggestions even if 1000 entities match"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:498-499 (limit(SUGGESTION_LIMIT)) + .orderBy(jooqQueryHelper.getField(deCte, RANK_FIELD_ALIAS).desc()) (line 509)"
        - q: "What at tunable × 100? (e.g. 500 matching entities all with ts_rank == 1.0 — synonym-stuffed)"
          a: "PROBE-NEEDED — the OUTER ORDER BY has NO secondary key; with all-equal ranks, the top-5 are storage/heap-order-determined and non-deterministic across queries (LSN-019 shape). Pin via probe whether the suggestions are stable across repeat queries on a synonym-stuffed dataset"
          confidence: PROBE-NEEDED
          evidence: "P-134"
        - q: "What does the operator see at the truncation boundary (entities 6-10 vs 1-5)?"
          a: "Operator sees ONLY the top-5; entities 6-10 are invisible from the autocomplete entirely. Combined with the tie-breaker non-determinism above, the operator's 6th-ranked target entity may sometimes appear and sometimes not appear depending on storage layout"
          confidence: PROBE-NEEDED
          evidence: "P-134"
    - location: "Results.tsx:45"
      name: "size (search results page size)"
      value: "30"
      questions:
        - q: "What at N = 0 in pageInfo.total?"
          a: "Empty result set — `EmptyContentPlaceholder` renders with 'No matches found' text (Results.tsx:161-165); InfiniteScroll's hasMore is computed UI-side from `page*size < total` so it stops"
          confidence: STATIC-INFERRED
          evidence: "Results.tsx:142-165 + dataentitiesSearch.thunks.ts:62-63"
        - q: "What at tunable + 1 (31 matching entities)?"
          a: "InfiniteScroll triggers a second fetch on scroll-bottom; backend returns the next 1 entity; UI computes hasMore=false correctly because total=31. BUT third-party API consumers reading backend hasNext directly will see hasNext=true even on page 2 with 0 remaining rows — pagination loops forever (Category B drift, captured in `name_behavior_pairs`)"
          confidence: STATIC-INFERRED
          evidence: "DataEntityServiceImpl.java:192 + dataentitiesSearch.thunks.ts:62-63"
        - q: "What at N = Integer.MAX_VALUE for size?"
          a: "PROBE-NEEDED — the OpenAPI spec has no max; the repository's findByState uses LIMIT/OFFSET without clamping. Postgres will accept the LIMIT but allocate a large result-set; OOM or socket-timeout is the likely path. Pin via probe with size=1_000_000"
          confidence: PROBE-NEEDED
          evidence: "P-135"
    - location: "Search.tsx:39"
      name: "default pageSize on initial search creation"
      value: "30"
      questions:
        - q: "What at N = 0 entities in the catalog?"
          a: "search() creates a row with empty filters + empty query; getFacetsData runs but returns all zeros; UI renders empty Catalog"
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:37-42 + SearchServiceImpl.java:74-82"
        - q: "What does the operator see if pageSize=30 is hard-coded but the operator wants more per page?"
          a: "No way to change — pageSize is a constant in the UI source; the operator has no preference setting"
          confidence: STATIC-INFERRED
          evidence: "Results.tsx:45 (`const size = 30;`) + no UI control found in this enrichment"
    - location: "SearchSuggestionsAutocomplete.tsx:77"
      name: "debounce interval for autocomplete dispatch"
      value: "500"
      questions:
        - q: "What at very-fast typing (>500ms keystroke-to-keystroke)?"
          a: "Each keystroke fires its own getSuggestions call after the trailing 500ms; effective request rate is the operator's typing rate. For a 10-char query typed in 5s, that's 1 request per keystroke = 10 backend calls. No client-side cache, no request coalescing"
          confidence: STATIC-INFERRED
          evidence: "SearchSuggestionsAutocomplete.tsx:75-77 (`useDebouncedCallback(fn, 500)`)"
    - location: "Search.tsx:62"
      name: "debounce interval for facet sync"
      value: "1500"
      questions:
        - q: "What at facet-toggle storms (many rapid clicks)?"
          a: "Only the trailing facet state after 1.5s of inactivity is synced via updateSearchFacets; leading-edge sync fires immediately (per `{ leading: true }`). Multi-click stress: leading fire + 1500ms-later trailing fire = at most 2 backend calls per 1.5s burst"
          confidence: STATIC-INFERRED
          evidence: "Search.tsx:50-65"
  name_behavior_pairs:
    - name: "DataEntityList.pageInfo.hasNext (response field on /api/search/{search_id}/results)"
      promise: "hasNext is a boolean indicating whether MORE pages of results exist after the returned page — operators paginate until hasNext=false"
      implementation: "DataEntityServiceImpl.findByState constructs `new Page<>(dtos, total, true)` with `true` hard-coded REGARDLESS of remaining rows (DataEntityServiceImpl.java:192). DataEntityMapper.mapPojos writes that into PageInfo.hasNext verbatim. The mapper has no compensating logic. The UI THEN OVERRIDES this with `hasNext: page * size < pageInfo.total` (dataentitiesSearch.thunks.ts:62-63) — so the operator-visible UI behavior is correct, but the API contract is broken"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "API consumers using the OpenAPI contract directly (mobile clients, CLI integrations, automated tests, third-party catalog connectors) will pagination-loop forever, fetching empty pages until rate-limited or timed out. The UI hides the bug; non-UI consumers do not."
      confidence: STATIC-INFERRED
      evidence: "DataEntityServiceImpl.java:181-194 + Page.java:11-15 + dataentitiesSearch.thunks.ts:62-63 + openapi.yaml:734-755"
    - name: "getSearchSuggestions(query, entityClassId, manuallyCreated) — 'top five search suggestions'"
      promise: "The endpoint summary at openapi.yaml:784 says 'Returns top five search suggestions for a given query' — a STABLE, DETERMINISTIC top-5 by some criterion (presumably relevance)"
      implementation: "ReactiveDataEntityRepositoryImpl.getQuerySuggestions:470-513 — CTE selects DATA_ENTITY rows that match ftsCondition + entity_class_id + manuallyCreated, ORDERS BY ts_rank DESC, LIMITS to 5. OUTER select re-orders by ts_rank DESC again. No secondary tie-breaker. The 'top five' is by ts_rank but the tie-breaking is undefined (LSN-019 shape) — equal-rank entities are storage/heap-ordered"
      drift: MINOR
      operator_visible_consequence: "When 6+ entities have equal ts_rank (synonym-rich catalogs), the top-5 surfaced is NON-DETERMINISTIC across repeat queries on the same dataset. The operator's target may flicker in/out of the autocomplete dropdown"
      confidence: PROBE-NEEDED
      evidence: "P-134"
    - name: "getSearchResults — paginated 'search results for a given search ID'"
      promise: "Paginated results for the session — ordered by some sensible criterion (FTS rank when there's a query; some stable order otherwise)"
      implementation: "ReactiveDataEntityRepositoryImpl.findByState:651-727 + getOrderFields:945-968 — orderBy is: STATUS-case (STABLE→1, DEPRECATED→2, DRAFT→3, UNASSIGNED→4, DELETED→5) + cteConfig.orderBy (null for findByState) + cteConfig.fts.rankFieldAlias (set if state.getQuery() is non-empty) + DATA_ENTITY.ID DESC (always — the final tiebreaker). When state.getQuery() is empty, ordering is STATUS-case then ID DESC; when non-empty, STATUS-case then ts_rank DESC then ID DESC. So results are sensible-ordered (STATUS-grouped + relevance-ranked + newest-id-first tiebreaker)"
      drift: NONE
      operator_visible_consequence: "MATCHES — results are deterministic + sensible. The UI displays STABLE entities first, then DEPRECATED, etc., relevance-ranked within each status group"
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataEntityRepositoryImpl.java:702-712, 945-968"
    - name: "getSearchFacetList — 'Get search facets by search ID'"
      promise: "Retrieve the facet state + aggregate counts for a given session"
      implementation: "Delegates to SearchServiceImpl.getFacets which calls fetchFacetState (which UPDATES last_accessed_at as a side effect) then recomputes the aggregate via getFacetsData. The READ is a WRITE (side-effect UPDATE)"
      drift: MINOR
      operator_visible_consequence: "Operator-visible: `GET /api/search/{id}` is NOT idempotent at the storage layer; under concurrent UI tabs on the same session, the row-lock contention on last_accessed_at serialises the writes. The DB op log shows UPDATEs from GETs"
      confidence: STATIC-INFERRED
      evidence: "ReactiveSearchFacetRepositoryImpl.java:99-106 (UPDATE-RETURNING on get)"
    - name: "highlightDataEntity — 'Highlight data entity fields'"
      promise: "Returns the entity fields with FTS match positions marked"
      implementation: "DataEntityHighlightServiceImpl orchestrates: (a) fetch search session by UUID → extract queryString; (b) fetch data entity searchable fields; (c) fetch latest dataset version; (d) zip + call getHighlightedResult(searchableString, queryString) → SQL `ts_headline('english', '%s', to_tsquery('%s'), 'HighlightAll=true').formatted(text, tsQuery)` — direct interpolation; (e) parse the highlighted string back to typed DataEntitySearchHighlight"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "MATCHES the surface promise (returns marked-up fields). HOWEVER the implementation has a TRUE SQL-injection surface — the user-controlled queryString reaches raw SQL via String.formatted. A persisted query containing `'; DROP TABLE ...; --` runs arbitrary SQL. The contract surface is fine; the implementation has a critical security defect."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataEntityRepositoryImpl.java:798-806 (.formatted) + DataEntityHighlightServiceImpl.java:44 (the call) + cross-link batch H"
    - name: "updateSearchFacets — 'Updates search facets'"
      promise: "MERGE the supplied delta into the persisted state OR REPLACE the state — operator can't tell from the name alone"
      implementation: "SearchServiceImpl.updateFacets:84-96 — fetches current state via pojoToState, then `FacetStateDto.merge(currentState, delta)` (a MERGE, not a REPLACE). The merged state is persisted via searchFacetRepository.update"
      drift: NONE
      operator_visible_consequence: "MATCHES merge semantics. If a UI bug sent only the changed facet, prior facets WOULD survive (which is what the UI's debounced sync at Search.tsx:50-65 actually does — it sends the FULL state every 1.5s, so MERGE and REPLACE would be equivalent in practice). For third-party API consumers using PUT semantics expectations, the behaviour is MERGE not REPLACE — could surprise"
      confidence: STATIC-INFERRED
      evidence: "SearchServiceImpl.java:84-96 + FacetStateDto.merge (FacetStateDto.java)"
  orderings:
    - location: "ReactiveDataEntityRepositoryImpl.java:498-499, 509"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer for getSearchSuggestions?"
          a: "CTE: ORDER BY rank DESC LIMIT 5. OUTER: ORDER BY rank DESC (no secondary key)"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:498-499, 509"
        - q: "What is the tie-breaker when rank values are equal?"
          a: "UNDEFINED — no secondary ORDER BY. Postgres returns rows in storage/heap order which is creation order on a cold table but can shift after UPDATEs/VACUUM"
          confidence: PROBE-NEEDED
          evidence: "P-134"
        - q: "Which subset is returned when result-set > 5?"
          a: "Top-5 by rank DESC; ties broken by storage order (non-deterministic). The truncated entities 6+ are silently invisible to the operator"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:498-499"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "SearchServiceImpl.getQuerySuggestions:115-120 maps DataEntityDto → DataEntityRef and emits the Flux; no re-sort, no filter. SearchSuggestionsAutocomplete.tsx:80 reads searchSuggestions from Redux + setOptions; the Autocomplete component renders in input order via `filterOptions={option => option}` (line 206) — so the backend's natural order IS the user-visible order"
          confidence: STATIC-INFERRED
          evidence: "SearchServiceImpl.java:115-120 + SearchSuggestionsAutocomplete.tsx:80, 203-210"
    - location: "ReactiveDataEntityRepositoryImpl.java:702-712 (findByState ORDER BY)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer for getSearchResults?"
          a: "STATUS case (STABLE=1, DEPRECATED=2, DRAFT=3, UNASSIGNED=4, DELETED=5) ASC + cteConfig.fts.rankFieldAlias DESC (only if state.getQuery() is non-empty) + DATA_ENTITY.ID DESC (final tiebreaker — always present)"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:702-712 + getOrderFields lines 945-968"
        - q: "Tie-breaker when sort-key values are equal?"
          a: "DATA_ENTITY.ID DESC is always the final tiebreaker — deterministic. Newer entities (higher ID) appear first within each status-group + rank-group"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:962-966"
        - q: "Subset returned when result > size?"
          a: "LIMIT size + OFFSET (page-1)*size. Pages are deterministic across repeat queries on stable data due to the ID tiebreaker"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:721-722"
        - q: "Does any upstream layer re-sort?"
          a: "DataEntityService.findByState wraps in Page<> but does NOT re-sort; the UI's Results.tsx renders via InfiniteScroll which appends pages without re-sorting (Results.tsx:151-159). Backend order is operator-visible order"
          confidence: STATIC-INFERRED
          evidence: "DataEntityServiceImpl.java:181-194 + Results.tsx:151-159"
    - location: "ReactiveSearchFacetRepositoryImpl.java (facet-option ORDER BY — referenced from batch M)"
      questions:
        - q: "What is the actual ORDER BY for getFiltersForFacet?"
          a: "REFERENCE — batch M facets sidecar invariants[4]: facet-row name `containsIgnoreCase` filter + facet aggregator ORDER BY count DESC. Tiebreaker undefined. Carried forward verbatim"
          confidence: REFERENCE
          evidence: "odd-platform__java__SearchController__controller-method__facets.md (concepts.invariants[4]) + ReactiveSearchFacetRepositoryImpl.java:339-372 (representative)"
  auth_gates:
    - location: "SearchController.java:30-91 (all 7 methods)"
      endpoint: "POST/GET/PUT /api/search* (7 endpoints total)"
      questions:
        - q: "What does this endpoint return for each of DISABLED/LOGIN_FORM/OAUTH2/LDAP?"
          a: "DISABLED: anonymous-authenticated synthesised principal, returns full catalog data. LOGIN_FORM: requires session cookie, returns full catalog data. OAUTH2: requires OAuth2 token, returns full catalog data. LDAP: requires LDAP-authenticated session, returns full catalog data. Behaviour is identical across the three authenticated modes — auth proves identity, NOT access scope"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:23-92 (no @ConditionalOnProperty) + SecurityConstants.java (no rule) + AuthorizationCustomizer.java:29-30 + AlertController class sidecar's verified mode wiring"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: HTTP 401 (Spring Security default unauth response) or redirect to /login per the active mode. Under DISABLED: full access — there is no unauthenticated state because every caller is synthesised as an anonymous principal"
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (.authenticated() catch-all) + DisabledAuthSecurityConfiguration class-level sidecar"
        - q: "What does a wrong-role caller see?"
          a: "There is no role gate. Any authenticated user — Administrator, regular user, read-only user — gets identical access. The endpoint is read-collaborative by design (ADR-CANDIDATE-003)"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:23-92 + SecurityConstants.java (no rule for /api/search*)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere on the read side. Authentication is enforced by AuthorizationCustomizer's catch-all .authenticated(). NO authorization (role/permission/owner-scoping) is enforced at the controller, the service, the repository, or anywhere in the chain. The only owner-derived input is the optional state.isMyObjects() branch which scopes RESULTS (not counts) when the user opts in"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:23-92 + SearchServiceImpl.java:41-196 + ReactiveDataEntityRepositoryImpl.java:651-727 + SecurityConstants.java"
  resource_boundaries:
    - location: "ReactiveSearchFacetRepositoryImpl.java:99-106 (get UPDATE-RETURNING last_accessed_at)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two simultaneous GETs on the same searchId both UPDATE last_accessed_at; the second waits on the row lock from the first. No corruption, but serialised. Under concurrent UI tabs on the same session: latency degrades to single-threaded throughput on that row"
          confidence: STATIC-INFERRED
          evidence: "ReactiveSearchFacetRepositoryImpl.java:99-106"
        - q: "Is the call replay-safe?"
          a: "GET /api/search/{id} is NOT idempotent at the storage layer — every call writes last_accessed_at. The result is logically the same (the recomputed aggregate doesn't depend on last_accessed_at) but the DB write log differs. For HTTP semantics, GET is supposed to be safe; for ODD's purpose, the side-effect is functional (TTL bookkeeping)"
          confidence: STATIC-INFERRED
          evidence: "ReactiveSearchFacetRepositoryImpl.java:99-106 + V0_0_52__introduce_housekeeping.sql (TTL relies on last_accessed_at)"
        - q: "If a cache fronts this, what is the TTL/eviction key/staleness window?"
          a: "No cache. Every call re-runs the aggregator queries. Pairs with `performance.known_performance_gaps` — caching would amortise hot-tab traffic but is not implemented"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:30-91 + SearchServiceImpl.java:41-196 (no @Cacheable, no facade)"
    - location: "DataEntityHighlightServiceImpl.java:36 (3-Mono zip)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous highlight calls produce corrupted state?"
          a: "No state mutation on the highlight path — only reads (session row, data entity, dataset version) + a single SELECT for the ts_headline. No corruption possible. But: the SQL-injection surface (.formatted) means a malicious caller could MUTATE state on the read connection by injection. Not a concurrency issue per se, but a resource-boundary issue"
          confidence: STATIC-INFERRED
          evidence: "DataEntityHighlightServiceImpl.java:26-46 + ReactiveDataEntityRepositoryImpl.java:798-806"
        - q: "Replay-safe?"
          a: "Yes for the legitimate read path. NOT replay-safe if the injection vector is used to do non-idempotent mutations"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:798-806"
        - q: "Cache?"
          a: "None. Every keystroke-to-highlight could re-run the ts_headline query if the UI triggers it that often"
          confidence: STATIC-INFERRED
          evidence: "DataEntityHighlightServiceImpl.java:26-46"
  request_inputs:
    - location: "SearchController.java:30-31, openapi.yaml:660-665"
      input_kind: path-param
      input_name: "searchId (search_id)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The session identifier — opaque UUID returned from POST /api/search, used as the handle for all subsequent operations on the same session"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:31, openapi.yaml:660-665"
        - q: "When supplied, what does the implementation use it for?"
          a: "SearchController passes searchId to SearchService (line 38, 45, 55, 72) → SearchServiceImpl.fetchFacetState calls searchFacetRepository.get(searchId) (line 158) → ReactiveSearchFacetRepositoryImpl.get does `UPDATE search_facets SET last_accessed_at = NOW() WHERE id = ? RETURNING *` (lines 99-106). No owner / created_by / user_id predicate is added"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:31 → SearchServiceImpl.java:157-160 → ReactiveSearchFacetRepositoryImpl.java:99-106"
        - q: "Does the implementation's scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. Name implies 'my session'; implementation makes the UUID a bearer token shared across the platform. Any authenticated user holding any searchId can drive that session"
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "V0_0_1__init.sql:204-211 (no owner column) + SearchServiceImpl.java:157-160"
        - q: "For TRANSLATES_SILENTLY: operator-visible failures?"
          a: "(a) URL/screenshot leakage = full session access for the recipient; (b) PUT /api/search/{id} from a malicious caller overwrites another user's persisted filter state; (c) cross-team session enumeration via UUID guessing is infeasible (122-bit space) but leakage IS the attack surface"
          confidence: STATIC-INFERRED
          evidence: "SearchServiceImpl.java:84-96 (updateFacets accepts any caller) + SearchServiceImpl.java:157-160"
        - q: "Available-but-unused: column matching name that IS NOT used?"
          a: "NONE — search_facets has no owner-related column at all; the gap is the absence of any user binding, not a present-but-unfiltered column. To honor the name promise the table would need an owner_id (or similar) column and a JOIN predicate; both are absent"
          confidence: STATIC-INFERRED
          evidence: "V0_0_1__init.sql:204-211"
      routes_to_finding: "bugs_limitations_corner_cases[2] (Search-session UUIDs are bearer tokens by schema design) + implicit_adrs[3] (bearer-token-shaped search sessions)"
    - location: "SearchController.java:31-32, openapi.yaml:714-718"
      input_kind: path-param
      input_name: "facetType"
      questions:
        - q: "What does the input NAME promise?"
          a: "The kind of facet to enumerate options for — one of TAGS|OWNERS|TYPES|GROUPS|STATUSES (MultipleFacetType enum)"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:32, openapi.yaml:714-718"
        - q: "When supplied, what does the implementation use it for?"
          a: "Switch-cases to the corresponding repository call: TAGS→getTagFacetForDataEntity, OWNERS→getOwnerFacetForDataEntity, etc. (SearchServiceImpl.java:168-174). Each repository method computes the facet aggregate for that facet kind"
          confidence: STATIC-INFERRED
          evidence: "SearchServiceImpl.java:162-175"
        - q: "Does the implementation's scope MATCH the name's promise?"
          a: "MATCHES — facetType in the URL maps to the corresponding facet repository method"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "SearchServiceImpl.java:162-175"
        - q: "Operator-visible failures?"
          a: "N/A — the mapping is direct. Java 17 exhaustive switch enforces compile-time completeness. A new MultipleFacetType value added to the OpenAPI enum would break the build (good)"
          confidence: STATIC-INFERRED
          evidence: "SearchServiceImpl.java:168-174"
        - q: "Available-but-unused?"
          a: "NONE — the MultipleFacetType enum has 5 values; all 5 are wired"
          confidence: STATIC-INFERRED
          evidence: "SearchServiceImpl.java:168-174"
      routes_to_finding: "No drift"
    - location: "SearchController.java:33-35, openapi.yaml:719-721 (PageParam/SizeParam) and openapi.yaml:746-747"
      input_kind: query-param
      input_name: "page, size"
      questions:
        - q: "What does the input NAME promise?"
          a: "page = the 1-indexed page number to return; size = the number of items per page. Standard pagination contract"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:33-34, 51-52 + components.yaml:4213-4229 (PageParam/SizeParam)"
        - q: "When supplied, what does the implementation use it for?"
          a: "page and size flow through SearchServiceImpl → repository methods → SQL LIMIT (size) + OFFSET ((page-1)*size). No validation, no clamping at any layer"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:721-722 + ReactiveSearchFacetRepositoryImpl.java:129, 157, 315"
        - q: "Does the implementation's scope MATCH the promise?"
          a: "MATCHES the promise BUT lacks the implicit invariants the promise carries (page >= 1, size > 0, size bounded). Unbounded inputs produce SQL with negative OFFSET (page=0) or unbounded LIMIT (size=Integer.MAX_VALUE) — implementation-defined behaviour"
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:33-34 (no @Min/@Max) + ReactiveDataEntityRepositoryImpl.java:721-722"
        - q: "Operator-visible failures?"
          a: "page=0 → negative OFFSET → Postgres-implementation-defined behaviour (typically syntax error or empty result). size=1_000_000 → unbounded query, OOM risk. Cross-link bugs_limitations_corner_cases[4]"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:33-34"
        - q: "Available-but-unused?"
          a: "N/A — the params are used, just unconstrained"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:33-34"
      routes_to_finding: "bugs_limitations_corner_cases[4]"
    - location: "SearchController.java:35, openapi.yaml:719 (SearchParam) reused for getFiltersForFacet"
      input_kind: query-param
      input_name: "query (on getFiltersForFacet)"
      questions:
        - q: "What does the input NAME promise?"
          a: "A search-string parameter — but the endpoint is ALREADY a search-session sub-resource (facet filter for an existing session). Two `query`-shaped fields exist: the session-level persisted query (state.getQuery()) and this parameter on getFiltersForFacet. Operator might assume this refines the session's FTS"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:35 + openapi.yaml:702-732"
        - q: "When supplied, what does the implementation use it for?"
          a: "Passed to the per-facetType repository method as the second param. The repository uses it to filter facet-row NAMES (containsIgnoreCase) — NOT to filter via FTS. E.g. getOwnerFacetForDataEntity uses `OWNER.NAME.containsIgnoreCase(query)` to narrow the OWNER name list"
          confidence: STATIC-INFERRED
          evidence: "ReactiveSearchFacetRepositoryImpl.java:124, 152, 360, 394, 439 (containsIgnoreCase on facet-row names) — verified by batch M facets sidecar"
        - q: "Does the implementation's scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. Name implies 'search query — applies FTS'; implementation does plain substring-match (containsIgnoreCase) on facet-row names. The persisted state.getQuery() IS bound to FTS at every facet aggregator, but this `query` parameter is NOT. Two distinct semantics under the same name"
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveSearchFacetRepositoryImpl.java:124, 152 (containsIgnoreCase) vs lines 182, 267 (ftsCondition on persisted state.query)"
        - q: "Operator-visible failures?"
          a: "An operator drilling for owner `J*` expecting prefix wildcard match gets `containsIgnoreCase` substring match instead. An operator typing `users & admins` expecting tsquery semantics gets a literal `users & admins` substring search returning zero rows. The drift doesn't break the endpoint but produces wrong-looking results"
          confidence: STATIC-INFERRED
          evidence: "ReactiveSearchFacetRepositoryImpl.java:124, 152"
        - q: "Available-but-unused: closer match?"
          a: "The endpoint COULD apply FTS to the facet-row names (e.g. ftsCondition on a hypothetical OWNER.SEARCH_VECTOR) but the columns don't exist; substring match is the available implementation. The drift is in the input NAME (`query` is too generic), not in the implementation choice"
          confidence: STATIC-INFERRED
          evidence: "ReactiveSearchFacetRepositoryImpl.java:124, 152"
      routes_to_finding: "docs_link_semantic.doc_drift_findings (added cross-link to facet-search-vs-session-query distinction)"
    - location: "SearchController.java:77-79, openapi.yaml:785-797 (SearchParam + entity_class_id + manually_created)"
      input_kind: query-param
      input_name: "query, entityClassId, manuallyCreated (getSearchSuggestions)"
      questions:
        - q: "What does the input NAME promise?"
          a: "query = FTS search string for autocomplete; entityClassId = filter suggestions to one entity class; manuallyCreated = filter by whether entity is manually-created vs ingested"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:77-79 + openapi.yaml:785-797"
        - q: "When supplied, what does the implementation use it for?"
          a: "query → ftsCondition(SEARCH_ENTRYPOINT.SEARCH_VECTOR, query) via tsQuery (split+colon-star+ampersand-join); entityClassId → DATA_ENTITY.ENTITY_CLASS_IDS.contains(new Integer[] {entityClassId}); manuallyCreated → DATA_ENTITY.MANUALLY_CREATED.eq(manuallyCreated)"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:478-487"
        - q: "Does the implementation's scope MATCH the promise?"
          a: "MATCHES for all three. entityClassId is a single Integer that uses array-contains-element (filter suggestions where the entity_classes[] contains the given id) — semantically correct for a many-class entity"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:478-487"
        - q: "Operator-visible failures?"
          a: "(a) entityClassId accepts only ONE entity class — a user wanting suggestions across DataSet AND DataInput must call twice (low severity); (b) manuallyCreated=false branch is unused by any UI consumer (Grep confirmed); (c) query parameter inherits the tsquery-injection surface common to all FTS-using paths"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:77-79 + AddDataEntityToGroupForm.tsx:82 + bugs_limitations_corner_cases[9-10]"
        - q: "Available-but-unused?"
          a: "(a) The endpoint COULD support `entityClassIds` (plural list) but the OpenAPI spec only declares a single integer; (b) the page+size shape from sibling endpoints could be applied but isn't — fixed LIMIT 5"
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:785-797"
      routes_to_finding: "bugs_limitations_corner_cases[9] (entityClassId singular) + bugs_limitations_corner_cases[10] (manuallyCreated=false unused)"
    - location: "SearchController.java:86-87, openapi.yaml:763-770"
      input_kind: path-param
      input_name: "searchId, dataEntityId (highlightDataEntity)"
      questions:
        - q: "What does the input NAME promise?"
          a: "searchId = the session containing the query to highlight; dataEntityId = the specific entity within the session's results to render highlights for"
          confidence: STATIC-INFERRED
          evidence: "SearchController.java:86-87 + openapi.yaml:763-770"
        - q: "When supplied, what does the implementation use it for?"
          a: "searchId fetches the session (UPDATE last_accessed_at side-effect); dataEntityId fetches the entity's searchable fields. The session's query AND the entity's text are then INTERPOLATED into raw SQL via `.formatted(text, tsQuery)` in getHighlightedResult"
          confidence: STATIC-INFERRED
          evidence: "DataEntityHighlightServiceImpl.java:26-46 + ReactiveDataEntityRepositoryImpl.java:798-806"
        - q: "Does the implementation's scope MATCH the promise?"
          a: "TRANSLATES_SILENTLY at the implementation depth — the surface promise is correct (returns highlights for that entity under that query), but the implementation has a TRUE SQL-injection vector (`.formatted` not parameterised). A malicious actor controlling the persisted query AND the entity text can execute arbitrary SQL. The promise of 'highlight fields' doesn't promise 'safely interpolate', but a senior engineer reading the controller would not expect raw-SQL interpolation downstream"
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:798-806 (.formatted) + DataEntityHighlightServiceImpl.java:44"
        - q: "Operator-visible failures?"
          a: "(a) DoS via persisted query containing unbalanced parens → 500 on every highlight call for that session; (b) SQL injection — persisted query containing `'; DELETE FROM ...; --` runs arbitrary SQL on the read connection; (c) `text` (entity searchable string) is ALSO interpolated — a maliciously-named data entity could inject via the entity name"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:798-806"
        - q: "Available-but-unused?"
          a: "The codebase uses jOOQ throughout EXCEPT this one SQL site. jOOQ's `DSL.field(..., bindParam, bindParam)` would parameterise both inputs safely. Available-but-unused: the safe binding API in the same helper class. Fix anchor: replace `.formatted()` with `field(\"ts_headline(...?...?)\", ...)` jOOQ parameterised binding"
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:798-806 vs JooqFTSHelper.java:100-105 (parameterised binding model)"
      routes_to_finding: "bugs_limitations_corner_cases[7] (TRUE SQL injection via .formatted) — cross-link batch H"
  probes_emitted:
    - probe_id: P-134
      question: "Category B + C: getSearchSuggestions determinism with equal ts_rank ties — is the top-5 stable across repeat queries on a synonym-stuffed dataset?"
      probe_path: "lineage/odd-platform/probes/P-134.yaml"
    - probe_id: P-135
      question: "Category A + B: getSearchResults.hasNext at size > total — does the response carry hasNext=true even when no further rows exist, and what happens at size=Integer.MAX_VALUE?"
      probe_path: "lineage/odd-platform/probes/P-135.yaml"
    - probe_id: P-136
      question: "Category F: highlightDataEntity SQL-injection via persisted query — can a malicious POST /api/search with a crafted query produce an out-of-band SQL effect on the GET /api/search/{id}/data_entities/{de_id}/highlights path?"
      probe_path: "lineage/odd-platform/probes/P-136.yaml"
  stress_summary:
    triggers_total: 22
    questions_total: 80
    answers_static_inferred: 70
    answers_probe_needed: 9
    answers_reference: 1
    drift_flags: 5
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the UI/API surface). Under `DISABLED` all seven endpoints are anonymously reachable. The class itself carries no `@ConditionalOnProperty`; auth wiring is enforced globally by `LoginFormSecurityConfiguration` / `OAuthSecurityConfiguration` / `LDAPSecurityConfiguration` / `DisabledAuthSecurityConfiguration`. `S2S` is NOT relevant — S2S protects `/ingestion/entities` only.

- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` does not match any `/api/search*` path.

- **authorization_assertions**: [] — N/A. `SearchController.java:23-92` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call on any of the 7 methods. `SecurityConstants.SECURITY_RULES` contains no entry whose matcher matches any `/api/search*` path (verified by `grep -in 'search\\|facet' <SecurityConstants.java>` returning zero matches during enrichment 2026-05-25). The catch-all `pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`) is the only gate. Authentication is required; authorization is not enforced. No row-level ownership check is enforceable either — the `search_facets` schema has no `owner_id` column.

- **owner_scoping**: `BYPASSES — facet counts, autocomplete, result lists, and highlights all run catalog-wide`. The single owner-derived input on the entire path is the OPTIONAL `state.isMyObjects()` branch in `getSearchResults` (`SearchServiceImpl.java:105-111`) which scopes RESULTS (not counts, not suggestions, not highlights) when the user TOGGLES `my_objects=true` on the form. Default `my_objects=false` enumerates the entire catalog. Cross-link batch M facets sidecar's `owner_scoping` finding.

- **data_exposure**:
  - "`SearchFacetsData` (search_id UUID, persisted query text echoed, catalog-wide total, myObjects total, entity-class facet counts, full filter state) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `POST /api/search` / `GET /api/search/{id}` / `PUT /api/search/{id}`; ANONYMOUS callers under `DISABLED`"
  - "`DataEntityList` items via `GET /api/search/{id}/results` — full `DataEntity` payload per item (id, oddrn, name, internal_name, description, entity_classes, owners, tags, namespace, datasource, status, custom-metadata-field values, term linkages, alert flag) → ANY authenticated user; ANONYMOUS under DISABLED. Same catalog-enumeration vector as `getDataEntityDetails` but accessed by paginated catalog traversal"
  - "`CountableSearchFilter[]` (paginated facet options with name + count + selected) for any of {TAGS, OWNERS, TYPES, GROUPS, STATUSES} via `GET /api/search/{id}/facet/{type}` — the OWNERS facet enumerates every owner name + per-owner entity count. ANY authenticated user; ANONYMOUS under DISABLED"
  - "`DataEntityRef[]` top-5 autocomplete via `GET /api/search/suggestions` (id, oddrn, internalName, externalName, entityClasses, manuallyCreated) for any FTS query → ANY authenticated user; ANONYMOUS under DISABLED. No owner predicate. Operator can use the autocomplete as a poor man's catalog enumeration"
  - "`DataEntitySearchHighlight` per-entity match highlights via `GET /api/search/{id}/data_entities/{de_id}/highlights` → ANY authenticated user holding the searchId UUID (which is unbound to ownership)"
  - "Persisted `query_string varchar(255)` in `search_facets` table → readable by anyone with the UUID. If a caller persisted PII/credentials/sensitive identifiers in their query, they exposed them to anyone learning the UUID. Retained for `housekeeping.ttl.search_facets_days` (default 30) days. Sibling DB-access exposure: any operator with DB read access can SELECT the entire history"

- **known_security_gaps**:
  - "**Cross-owner catalog enumeration via 7 distinct endpoints with no permission gate** — `getSearchResults` (paginate the whole catalog), `getFiltersForFacet(OWNERS)` (enumerate every owner), `getFiltersForFacet(TAGS|TYPES|GROUPS|STATUSES)` (enumerate the corresponding facet's value space), `getSearchSuggestions` (top-5 prefix-match no-owner-filter), `getSearchFacetList` (aggregate counts), `highlightDataEntity` (render highlights for any entity within any session), `search`/`updateSearchFacets` (create or mutate any session). Live doc is silent on the posture. Pairs with REFACTOR-024 / REFACTOR-053 / REFACTOR-340 — this is the largest discovery surface" — evidence: `SearchController.java:23-92` + `SecurityConstants.java` + `AuthorizationCustomizer.java:29-30` + `SearchServiceImpl.java:74-120` + `ReactiveDataEntityRepositoryImpl.java:470-727` + WebFetch search page 2026-05-25 — severity: HIGH
  - "**Session-state has no per-user binding — bearer-token-shaped UUIDs.** `search_facets` has no owner column; `SearchServiceImpl` performs no ownership check at any of: `search` (create), `updateFacets` (mutate), `fetchFacetState` (read), `getSearchResults` (paginate), `getFacets` (recompute). Any authenticated caller in possession of any UUID has full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access" — evidence: `V0_0_1__init.sql:204-211` + `SearchServiceImpl.java:75-96, 99-112, 157-160` — severity: HIGH
  - "**`highlightDataEntity` IS a TRUE SQL-injection vector — not just DoS.** `ReactiveDataEntityRepositoryImpl.java:798-806`: `String.formatted` directly interpolates both `text` (entity searchable string) AND `tsQuery` (user-derived from the session's persisted query) into raw SQL. A malicious caller POSTs `query=`X', NULL); DELETE FROM users WHERE 't' = ('` → the persisted query reaches the highlight SQL and executes arbitrary statements. Cross-link batch H. The `highlightDataEntity` controller method is the HTTP entry point. Severity: HIGH (true SQL injection)" — evidence: `ReactiveDataEntityRepositoryImpl.java:798-806` + `DataEntityHighlightServiceImpl.java:40-46` + `SearchController.java:85-91` — severity: HIGH
  - "**tsquery-operator injection → DoS on every facet read for a poisoned session.** Same `JooqFTSHelper.tsQuery` weakness as the highlight path, but at the FTS-only layer. A persisted query containing unbalanced parens or stray operators breaks every subsequent aggregator read on that session" — evidence: `JooqFTSHelper.java:100-105, 164-168` + every `ftsCondition(SEARCH_ENTRYPOINT.SEARCH_VECTOR, state.getQuery())` call site — severity: HIGH
  - "**Persistent PII / sensitive-query retention.** Persisted `search_facets.query_string` is the raw user-typed FTS query (up to varchar(255)) — no redaction, no encryption, no audit. Users searching for employee names, customer IDs, GDPR identifiers leave a 30-day database trail. Pairs with the `auth.ingestion.filter.enabled` finding — there is no inbound filter on the search create path that would scrub sensitive inputs" — evidence: `V0_0_1__init.sql:209` + `SearchServiceImpl.java:80` + `application.yml:169` (housekeeping TTL) — severity: LOW (depends on operator threat model for DB access)
  - "**Under `auth.type=DISABLED`, all seven endpoints are anonymously reachable.** No authentication = no audit trail of who searched what. Combined with the persistent-query-text retention, DISABLED makes the search surface a system-wide anonymous catalog enumeration tool" — evidence: `SearchController.java:23-92` + `DisabledAuthSecurityConfiguration` (sibling sidecar) — severity: MEDIUM (DISABLED is dev-only per docs, but misuse exposes everything)

## performance

- **hot_paths**:
  - "**`POST /api/search` is the Catalog-tab entry-point hot path** — every Catalog visit + every facet-toggle (1.5s debounced) + every keystroke-in-search (no debounce in Search.tsx, only in autocomplete) fires this endpoint. Per call: 3 concurrent DB queries via Mono.zip (entityClass facet aggregator + catalog-wide count + my-objects count) + the insert into search_facets. The unconditional my-objects branch is 1 wasted query per call when `my_objects=false`" — evidence: `SearchServiceImpl.java:74-82, 122-155` + `Search.tsx:50-65` + `SearchController.java:60-65`
  - "**`getSearchResults` is the InfiniteScroll hot path** — `Results.tsx:71-74` calls `fetchDataEntitySearchResults` on every scroll-bottom + every facet-sync completion + every searchClass tab change. Per call: a single jOOQ findByState query (CTE + 4 LEFT JOINs + status-case ORDER BY + ts_rank ORDER BY + ID ORDER BY + LIMIT/OFFSET) + 1 count query + 4 enrichment passes (entity-class details, parent groups, jsonArrayAgg on owners/titles/ownerships)" — evidence: `Results.tsx:71-74, 142-160` + `DataEntityServiceImpl.java:181-194` + `ReactiveDataEntityRepositoryImpl.java:651-727`
  - "**`getSearchSuggestions` is the per-keystroke autocomplete hot path** — `SearchSuggestionsAutocomplete.tsx:75-77` fires the call with 500ms debounce. For sustained typing the effective request rate is 2 calls/second; for slow typing it's 1 call per keystroke. Each call: CTE (FTS + entity_class filter + manually_created filter + ORDER BY rank LIMIT 5) + OUTER select + dataEntityDtoMapper. No caching" — evidence: `SearchSuggestionsAutocomplete.tsx:75-77` + `ReactiveDataEntityRepositoryImpl.java:470-513`
  - "**`getFiltersForFacet` is the facet-drill-down hot path** — every facet-panel expansion in the UI fires this. Per call: 1 fetch session (with UPDATE side-effect) + 1 facet aggregator (4-way JOIN for OWNERS — largest cost). Cross-link batch M facets sidecar's `hot_paths`"

- **throughput_characteristics**:
  - "Reactive non-blocking signatures throughout — `Mono<ResponseEntity<...>>` / `Mono<ResponseEntity<Flux<...>>>` — no thread held during DB await"
  - "`POST /api/search`: 3-way `Mono.zip` parallelism (entityClass facet + count + my-objects count); bounded by jOOQ pool size"
  - "`getSearchResults`: 1 reactive call (findByState) wrapping multi-stage CTE → JOIN → enrichment passes (chained via flatMap)"
  - "`getSearchSuggestions`: 1 reactive query per call; no batch variant"
  - "`getFiltersForFacet`: 2 sequential DB calls (fetch session + facet aggregator)"
  - "`highlightDataEntity`: 3-way `Mono.zip` (session, entity, dataset version) + 1 SQL `ts_headline` call. Per highlight, 4 DB ops"

- **resource_allocation**:
  - "Per-`POST /api/search` allocation: 1 row write to `search_facets` carrying full FacetStateDto jsonb; row size proportional to filter complexity. No row-size cap"
  - "Per-`getSearchSuggestions` allocation: top-5 DataEntityDto allocations bounded by SUGGESTION_LIMIT=5; safe"
  - "Per-`getSearchResults` allocation: List<DataEntityDimensionsDto> bounded by `size` parameter. Unbounded `size` → unbounded heap (cross-link bugs_limitations_corner_cases[4])"
  - "Per-call principal lookup — `authIdentityProvider.fetchAssociatedOwner()` invoked unconditionally in `getFacetsData` (line 128) AND conditionally in `getSearchResults` (line 106). Under OAuth/LDAP this is a DB lookup against `user_owner_mapping`"
  - "Postgres FTS state — every facet aggregator + count + findByState + suggestions invokes `to_tsquery(?)` parsing per call. Prepared-statement plan cache helps but parsing cost is non-trivial"
  - "`ts_headline` (highlightDataEntity) is CPU-intensive on the DB; runs over each entity's full searchable string. No caching at any layer"

- **scaling_characteristics**:
  - "Stateless controller — horizontal scaling unconstrained"
  - "`search_facets` table grows with session-create rate; bounded by F-010 housekeeping (default 30 days). On platforms with high concurrent users, the table can reach hundreds of thousands of rows in 30 days"
  - "No upper bound on `size` on any paginated endpoint — same shape as batch L (`getDataEntityAlerts`), batch M (`getFiltersForFacet`), batch E (`getSearchResults`)"
  - "Side-effect UPDATE on every session-keyed read — `last_accessed_at` (`ReactiveSearchFacetRepositoryImpl.java:99-106`). Concurrent UI tabs on the same session serialise on the row lock"
  - "No caching layer at controller, service, or repository — every Catalog-tab load re-runs the aggregators. Cache-Control / ETag absent"
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry. Regressions surface only in DB metrics or aggregate WebFlux latency"

- **known_performance_gaps**:
  - "Unconditional my-objects aggregation cost — every `POST /api/search` / `GET /api/search/{id}` / `PUT /api/search/{id}` runs the owner-scoped countByState even when `my_objects=false`. Short-circuit would halve per-call DB work in the common case" — evidence: `SearchServiceImpl.java:128-130` — severity: MEDIUM
  - "Unbounded `size` on `getSearchResults`, `getFiltersForFacet` — operator passing `size=1_000_000` triggers an unbounded result-set" — evidence: `SearchController.java:33-34, 51-52` + `openapi.yaml:719-720, 746-747` + repository LIMIT sites — severity: MEDIUM
  - "Side-effect UPDATE on every read — every `GET /api/search/{id}` and `GET /api/search/{id}/facet/{type}` rewrites `last_accessed_at`. On concurrent tabs, row-lock contention serialises traffic" — evidence: `ReactiveSearchFacetRepositoryImpl.java:99-106` — severity: LOW
  - "Deep-pagination cost on `getSearchResults` and `getFiltersForFacet` — `OFFSET = (page - 1) * size` scans + discards. Keyset pagination unimplemented" — evidence: `ReactiveDataEntityRepositoryImpl.java:721-722` + `ReactiveSearchFacetRepositoryImpl.java:129, 157, 315, 369, 404, 449, 515` — severity: LOW
  - "`ts_headline` per-highlight cost — runs over the full searchable string for each entity; not cached" — evidence: `ReactiveDataEntityRepositoryImpl.java:798-806` — severity: LOW
  - "`hasNext: true` contract bug forces API consumers to infinite-pagination loop — operator-visible perf cost is amortised by the consumer's rate-limiter or timeout" — evidence: `DataEntityServiceImpl.java:192` — severity: HIGH (contract violation; perf manifestation is secondary)
  - "Per-keystroke autocomplete cost — at 2 calls/second for sustained typing, each call is a CTE + JOIN + sort + limit — Postgres CPU is the bottleneck. No client-side suggestion cache" — evidence: `SearchSuggestionsAutocomplete.tsx:75-77` + `ReactiveDataEntityRepositoryImpl.java:470-513` — severity: LOW
  - "No caching / Cache-Control / ETag — every Catalog-tab load re-runs aggregators" — evidence: `SearchController.java:23-92` — severity: LOW
  - "No method-level observability — Micrometer / @Timed absent" — evidence: `SearchController.java:23-92` — severity: LOW

## upstream_callers

- entry_point: "ui_route:/catalog (search-default route + main /search route)"
  caller_node: "ts react-component:Search.tsx"
  multiplicity_per_trigger: 1
  evidence: "Search.tsx:37-42 — on initial mount when no routerSearchId is set, dispatches createSearch with `{ query: '', pageSize: 30, filters: {} }`. ONE POST /api/search per Catalog visit"
  observation_class: ui-call

- entry_point: "ui_route:/search/{searchId} (deep-link to existing session)"
  caller_node: "ts react-component:Search.tsx"
  multiplicity_per_trigger: 1
  evidence: "Search.tsx:44-48 — when routerSearchId is set and Redux searchId is empty, dispatches getDataEntitiesSearch (which calls GET /api/search/{id}). ONE GET per deep-link visit"
  observation_class: ui-call

- entry_point: "ui_event:facet-toggle (any Filters.tsx checkbox click)"
  caller_node: "ts react-component:Search.tsx"
  multiplicity_per_trigger: "1-2 per 1500ms window"
  evidence: "Search.tsx:50-65 — `useDebouncedCallback(fn, 1500, { leading: true })` — leading-edge fire + trailing-edge fire after 1.5s of inactivity. Each fire dispatches updateDataEntitiesSearch → PUT /api/search/{id}"
  observation_class: ui-call

- entry_point: "ui_event:infinite-scroll (Results.tsx scroll-bottom)"
  caller_node: "ts react-component:Results.tsx"
  multiplicity_per_trigger: 1
  evidence: "Results.tsx:71-74, 76-81, 142-160 — InfiniteScroll's `next` prop is `fetchNextPage` which dispatches fetchDataEntitySearchResults({searchId, page+1, size}); ONE GET /api/search/{id}/results per scroll-bottom"
  observation_class: ui-call

- entry_point: "ui_event:facet-panel-expand (any Filters.tsx facet sidebar expand)"
  caller_node: "ts react-component:Filters/Filters.tsx + child MultipleFilterItem/SingleFilterItem"
  multiplicity_per_trigger: 1
  evidence: "Filters.tsx + MultipleFilterItem dispatches getDataEntitySearchFacetOptions → GET /api/search/{id}/facet/{type}"
  observation_class: ui-call

- entry_point: "ui_event:keystroke-in-autocomplete (any 500ms-debounced typing in main search bar or DEG-add form)"
  caller_node: "ts react-component:SearchSuggestionsAutocomplete.tsx"
  multiplicity_per_trigger: "1 per 500ms window"
  evidence: "SearchSuggestionsAutocomplete.tsx:75-77, 82-88 — useDebouncedCallback(fn, 500) with autocompleteOpen + searchText triggers fetchSearchSuggestions → GET /api/search/suggestions. NB: 500ms debounce means a 10-char query typed in 5s = 10 backend calls (no coalescing)"
  observation_class: ui-call

- entry_point: "ui_event:highlight-on-result-hover (Results.tsx + ResultItem.tsx)"
  caller_node: "ts react-component:Results.tsx + ResultItem/ResultItem.tsx"
  multiplicity_per_trigger: 1
  evidence: "REFERENCE — the highlightDataEntity endpoint is consumed somewhere in the search-results UI but the exact trigger (hover? expand? always?) was not pinned in this enrichment. Marked unresolved"
  observation_class: ui-call
  unresolved: true

- entry_point: "rest:7 distinct REST operations (POST /api/search, GET /api/search/{id}, PUT /api/search/{id}, GET /api/search/{id}/results, GET /api/search/{id}/facet/{type}, GET /api/search/suggestions, GET /api/search/{id}/data_entities/{de_id}/highlights)"
  caller_node: "external API consumer"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:633-808 — all 7 operations are part of the public SearchApi contract; any external consumer with valid auth can call directly"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "INSERT into search_facets — one row per POST /api/search call (search creates a new session row)"
  evidence: "SearchServiceImpl.java:80 + ReactiveSearchFacetRepositoryImpl.java (create method)"
  cardinality_per_call: "1 per POST /api/search call"
  reachable_from_entry_points:
    - "ui_route:/catalog (initial mount)"
    - "rest:POST /api/search"

- side_effect_class: db-write
  description: "UPDATE search_facets SET last_accessed_at = NOW() — fires on every read by searchId"
  evidence: "ReactiveSearchFacetRepositoryImpl.java:99-106 (UPDATE-RETURNING shape on get())"
  cardinality_per_call: "1 per session-keyed read — GET /api/search/{id}, GET /api/search/{id}/results, GET /api/search/{id}/facet/{type}, GET /api/search/{id}/data_entities/{de_id}/highlights, PUT /api/search/{id}"
  reachable_from_entry_points:
    - "ui_route:/search/{searchId} (deep-link)"
    - "ui_event:facet-toggle"
    - "ui_event:infinite-scroll"
    - "ui_event:facet-panel-expand"
    - "ui_event:highlight-on-result-hover"
    - "rest:5 of 7 endpoints (all session-keyed)"

- side_effect_class: db-write
  description: "UPDATE search_facets SET filters=jsonb, query_string=text — fires on PUT /api/search/{id}"
  evidence: "SearchServiceImpl.java:84-96 + ReactiveSearchFacetRepositoryImpl.java (update method)"
  cardinality_per_call: "1 per PUT /api/search/{id}"
  reachable_from_entry_points:
    - "ui_event:facet-toggle (debounced sync)"
    - "rest:PUT /api/search/{id}"

- side_effect_class: page-render
  description: "Returns SearchFacetsData payload (search_id, query, total, myObjectsTotal, myObjects, facetState with 7-facet counts)"
  evidence: "SearchController.java:42-47, 60-65, 67-74 + SearchServiceImpl.java:147-154"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/catalog"
    - "ui_route:/search/{searchId}"
    - "ui_event:facet-toggle"
    - "rest:POST/GET/PUT /api/search"

- side_effect_class: page-render
  description: "Returns DataEntityList payload with hasNext: TRUE always (Page<>(..., true) hard-coded at DataEntityServiceImpl.java:192) — contract-broken for API consumers"
  evidence: "SearchController.java:49-57 + DataEntityServiceImpl.java:181-194 + Page.java:11-15"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_event:infinite-scroll (UI overrides hasNext client-side)"
    - "rest:GET /api/search/{id}/results"

- side_effect_class: page-render
  description: "Returns Flux<DataEntityRef> top-5 autocomplete suggestions (id, oddrn, internalName, externalName, entityClasses)"
  evidence: "SearchController.java:76-83 + ReactiveDataEntityRepositoryImpl.java:470-513"
  cardinality_per_call: "1 (Flux emission of 0-5 items)"
  reachable_from_entry_points:
    - "ui_event:keystroke-in-autocomplete"
    - "rest:GET /api/search/suggestions"

- side_effect_class: page-render
  description: "Returns Flux<CountableSearchFilter> facet-option list for one of TAGS/OWNERS/TYPES/GROUPS/STATUSES"
  evidence: "SearchController.java:30-40 + SearchServiceImpl.java:51-63"
  cardinality_per_call: "1 (Flux emission of 0-size items)"
  reachable_from_entry_points:
    - "ui_event:facet-panel-expand"
    - "rest:GET /api/search/{id}/facet/{type}"

- side_effect_class: page-render
  description: "Returns DataEntitySearchHighlight with per-field <b>...</b>-marked match positions"
  evidence: "SearchController.java:85-91 + DataEntityHighlightServiceImpl.java:26-46"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_event:highlight-on-result-hover (unresolved)"
    - "rest:GET /api/search/{id}/data_entities/{de_id}/highlights"

- side_effect_class: external-call
  description: "Postgres FTS evaluation — to_tsquery + @@ vector match + ts_rank + ts_headline. Each call hits the SEARCH_ENTRYPOINT.search_vector tsvector index"
  evidence: "JooqFTSHelper.java:100-105, 154-162 + ReactiveDataEntityRepositoryImpl.java:798-806"
  cardinality_per_call: "1 to N — every search-side DB call applies ftsCondition when query is non-empty"
  reachable_from_entry_points:
    - "rest:all 7 endpoints (FTS is the search backbone)"

## sources

- understanding ← SearchController.java:23-92 (the 7-method delegate class) + SearchServiceImpl.java:41-196 (six-of-seven downstream services) + DataEntityHighlightServiceImpl.java:20-47 (highlight downstream) + AuthorizationCustomizer.java:29-30 (catch-all auth)
- concepts.entities ← SearchController.java:8-15 (imports) + SearchServiceImpl.java:168-174 (MultipleFacetType) + Page.java:11-15 + DataEntityList schema + DataEntityRef schema + DataEntitySearchHighlight schema (components.yaml)
- concepts.operations ← SearchController.java:30-91 + SearchServiceImpl.java:51-196 + DataEntityHighlightServiceImpl.java:26-46
- concepts.invariants[0] ← SearchController.java:23-92 (all 3-line delegates, no annotations)
- concepts.invariants[1] ← SecurityConstants.java (no search/facet entries) + AuthorizationCustomizer.java:29-30
- concepts.invariants[2] ← V0_0_1__init.sql:204-211 + SearchServiceImpl.java:75-96, 157-160 + ReactiveSearchFacetRepositoryImpl.java:75-106
- concepts.invariants[3] ← SearchController.java:30-91 (reactive signatures)
- concepts.invariants[4] ← SearchController.java:60-65 + SearchFormData OpenAPI schema + SearchFormData.java:25 (no @Size/@Pattern)
- concepts.invariants[5] ← SearchController.java:33-34, 51-52 + openapi.yaml:719-721, 746-747 + ReactiveDataEntityRepositoryImpl.java:721-722 + ReactiveSearchFacetRepositoryImpl.java:129, 157, 315
- concepts.invariants[6] ← DataEntityServiceImpl.java:181-194 + Page.java:11-15 + dataentitiesSearch.thunks.ts:62-63 (UI override)
- concepts.invariants[7] ← JooqFTSHelper.java:100-105, 164-168 + ReactiveDataEntityRepositoryImpl.java:798-806 (.formatted)
- concepts.invariants[8] ← ReactiveDataEntityRepositoryImpl.java:474-476 (suggestions short-circuit) vs SearchServiceImpl.java:74-82 (no equivalent on search)
- concepts.audiences ← Search.tsx:24-92 + Results.tsx:42-177 + SearchSuggestionsAutocomplete.tsx:1-216 + WebFetch search page 2026-05-25 status 200
- dependencies_semantic.requires-feature[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` 2026-05-25 status 200 + WebFetch `/features/data-discovery/search-suggestions` 2026-05-25 status 404
- dependencies_semantic.requires-feature[1] ← JooqFTSHelper.java:100-105, 154-168 + ReactiveDataEntityRepositoryImpl.java:798-806
- dependencies_semantic.requires-feature[2] ← application.yml:169 + LSN-018 (F-010 housekeeping correction)
- dependencies_semantic.requires-feature[3] ← ADR-CANDIDATE-002 + ADR-CANDIDATE-003
- dependencies_semantic.couples-to[0] ← openapi.yaml:633-808 + SearchController.java:25 (implements SearchApi)
- dependencies_semantic.couples-to[1] ← SearchServiceImpl.java:41-196
- dependencies_semantic.couples-to[2] ← DataEntityHighlightServiceImpl.java:20-47
- dependencies_semantic.couples-to[3] ← ReactiveSearchFacetRepositoryImpl.java:75-534
- dependencies_semantic.couples-to[4] ← ReactiveDataEntityRepositoryImpl.java:470-806
- dependencies_semantic.couples-to[5] ← DataEntityServiceImpl.java:181-194
- dependencies_semantic.couples-to[6] ← JooqFTSHelper.java:100-105, 154-168 + cross-link batch H
- dependencies_semantic.couples-to[7] ← FacetStateMapperImpl.java
- dependencies_semantic.couples-to[8] ← DataEntityMapper.java:31-33 + Page.java:11-15
- tests_coverage_semantic.uncovered_behaviours[1] ← DataEntityServiceImpl.java:192 (hasNext hard-coded true)
- tests_coverage_semantic.uncovered_behaviours[5] ← ReactiveDataEntityRepositoryImpl.java:498-499, 509 (no tiebreaker on ORDER BY rank DESC)
- tests_coverage_semantic.uncovered_behaviours[6] ← ReactiveDataEntityRepositoryImpl.java:798-806 (.formatted SQL-injection)
- tests_coverage_semantic.test_files ← Glob /home/raman/work/odd/odd-platform/odd-platform-ui/tests/features/search returned 2 spec files + JVM-side find returned zero matches
- docs_link_semantic.inferred_docs[0] ← WebFetch search page 2026-05-25 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch search-suggestions page 2026-05-25 status 404
- docs_link_semantic.inferred_docs[2] ← WebFetch legacy URL 2026-05-19 status 404 (inherited per cadence)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch search page (5 absences) + SearchController.java + SearchServiceImpl.java
- docs_link_semantic.doc_drift_findings[1] ← WebFetch search-suggestions 404 + ReactiveDataEntityRepositoryImpl.java:470-513
- docs_link_semantic.doc_drift_findings[2] ← DataEntityServiceImpl.java:192 + Page.java:11-15 + dataentitiesSearch.thunks.ts:62-63 + openapi.yaml:734-755
- implicit_adrs[0] ← SearchController.java:30-91 + openapi.yaml:633-808 + sibling controllers (TermController, QueryExampleController, ReferenceDataController)
- implicit_adrs[1] ← SearchController.java:23-92 + structural consistency
- implicit_adrs[2] ← SecurityConstants.java + AuthorizationCustomizer.java:29-30 + ADR-CANDIDATE-002 + ADR-CANDIDATE-003
- implicit_adrs[3] ← V0_0_1__init.sql:204-211 + SearchServiceImpl.java:75-96, 99-112, 157-160 + sibling search-session feature surfaces
- bugs_limitations_corner_cases[0] ← SearchController.java + SearchServiceImpl.java:99-112 + DataEntityServiceImpl.java + SecurityConstants.java + AuthorizationCustomizer.java + WebFetch
- bugs_limitations_corner_cases[1] ← DataEntityServiceImpl.java:181-194 + Page.java:11-15 + dataentitiesSearch.thunks.ts:62-63 + openapi.yaml
- bugs_limitations_corner_cases[2] ← V0_0_1__init.sql:204-211 + SearchServiceImpl.java:75-96, 157-160 + SearchController.java:30-91
- bugs_limitations_corner_cases[3] ← SearchController.java + SecurityConstants.java + sibling AlertController sidecar
- bugs_limitations_corner_cases[4] ← SearchController.java:33-57 + openapi.yaml:719-720, 746-747 + repository LIMIT sites
- bugs_limitations_corner_cases[5] ← JooqFTSHelper.java:100-105, 164-168 + ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582 + SearchServiceImpl.java:74-96
- bugs_limitations_corner_cases[6] ← ReactiveDataEntityRepositoryImpl.java:798-806 (.formatted) + DataEntityHighlightServiceImpl.java:40-46 + SearchController.java:85-91 + batch H cross-link
- bugs_limitations_corner_cases[7] ← ReactiveDataEntityRepositoryImpl.java:470-513 (no tiebreaker) + SearchSuggestionsAutocomplete.tsx:90-93, 126
- bugs_limitations_corner_cases[8] ← SearchController.java:78 + ReactiveDataEntityRepositoryImpl.java:482-484 + openapi.yaml:788-792
- bugs_limitations_corner_cases[9] ← SearchController.java:79 + ReactiveDataEntityRepositoryImpl.java:485-487 + AddDataEntityToGroupForm.tsx:82 + Grep
- bugs_limitations_corner_cases[10] ← SearchServiceImpl.java:122-155 + SearchServiceImpl.java:128-130
- bugs_limitations_corner_cases[11] ← Glob/find for *Search*.java in test paths returned zero
- stress_findings.* ← see in-block evidence citations
- security.auth_mode_relevance ← SearchController.java:23-92 + AlertController class sidecar's verified mode wiring
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter sidecar (path matcher)
- security.authorization_assertions ← SearchController.java:23-92 + SecurityConstants.java (zero matches) + AuthorizationCustomizer.java:29-30
- security.owner_scoping ← SearchServiceImpl.java:99-112, 122-155
- security.data_exposure ← SearchController.java + SearchServiceImpl.java + ReactiveDataEntityRepositoryImpl.java + V0_0_1__init.sql:209 + application.yml:169
- security.known_security_gaps ← cited inline
- performance.hot_paths ← SearchServiceImpl.java:122-155 + Results.tsx:71-74 + SearchSuggestionsAutocomplete.tsx:75-77 + Filters facet panel
- performance.throughput_characteristics ← SearchController.java:23-92 + SearchServiceImpl.java + DataEntityHighlightServiceImpl.java
- performance.resource_allocation ← cited inline
- performance.scaling_characteristics ← SearchController.java:23 + F-010 (housekeeping) + ReactiveSearchFacetRepositoryImpl.java:99-106
- performance.known_performance_gaps ← cited inline
- upstream_callers ← Search.tsx + Results.tsx + Filters.tsx + SearchSuggestionsAutocomplete.tsx + openapi.yaml
- downstream_side_effects ← SearchServiceImpl.java + ReactiveSearchFacetRepositoryImpl.java + DataEntityHighlightServiceImpl.java + JooqFTSHelper.java

## confidence_per_field

- understanding: HIGH — every endpoint mapped to file:line for delegate + service + repository chain; the seven-endpoint surface is fully enumerated
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero JVM-side coverage verified by find; Playwright file paths verified)
- docs_link_semantic: MEDIUM (no @docs annotation; the inferred binding is enricher judgment, with 1× 200 + 2× 404 explicit verifications)
- implicit_adrs: HIGH (four implicit ADRs all corroborated by 5+ sibling sidecars + the parallel sibling search controllers in 4 feature surfaces)
- bugs_limitations_corner_cases: HIGH (every gap traces to file:line; the hasNext: true bug, the .formatted SQL injection, and the cross-owner enumeration are all directly observable in cited code)
- stress_findings: MEDIUM (3 PROBE-NEEDED out of 22 triggers — top-5 determinism, size=MAX behaviour, SQL injection runtime — are still pending probe-runner; the bulk of load-bearing claims are STATIC-INFERRED)
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH (one unresolved entry for highlight trigger; remaining 7 callers traced)
- downstream_side_effects: HIGH

## Maintainer notes

(no prior class-level sidecar; preserving heading for future passes)
