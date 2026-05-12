---
node_id: "odd-platform java SearchController controller-method:search"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-E01
---

# SearchController#search — semantic understanding

## understanding

`SearchController#search` is the reactive `POST /api/search` handler — three lines of WebFlux delegation that flat-maps the inbound `Mono<SearchFormData>` into `searchService.search(formData)` and lifts the result into `200 OK`. It is the platform's primary catalog-search entrypoint: the UI calls this from the global search bar / Catalog page to create a new search session (a `search_facets` row keyed by a server-generated UUID) and to receive the initial faceted aggregation. The method itself performs no validation, no authorisation, no owner-scoping, no query-syntax sanitisation, and no rate-limiting; everything routes through `SearchServiceImpl.search` which (a) maps the inbound `SearchFormData` to a `FacetStateDto` via `FacetStateDto.removeUnselected`, (b) persists it as a `SearchFacetsPojo` via `ReactiveSearchFacetRepository::create`, and (c) returns aggregated facet counts via `getFacetsData`. The search **does not return result rows** — it returns counts + a `searchId` UUID; the UI then calls the sibling `GET /api/search/{search_id}/results` (operationId `getSearchResults`) to fetch paginated `DataEntityList` rows for that search session.

## concepts

- entities: [
    `SearchFormData` (request body — `query: string` + `my_objects: boolean` + `filters: {types/datasources/namespaces/owners/tags/entity_classes/statuses}`),
    `SearchFacetsData` (response payload — `search_id: UUID` + aggregated facet counts + `total` + `my_objects_total`),
    `SearchFacetsPojo` (persisted search-session row in `search_facets` table, keyed by UUID),
    `FacetStateDto` (in-memory representation: `Map<FacetType, List<SearchFilterDto>>` + query string + myObjects boolean),
    `DataEntity` (the catalog entity searched against — full row returned by the sibling `getSearchResults` endpoint, not by this `search` call)
  ]
- operations: [
    `create-search-session` (POST /api/search) — accepts `SearchFormData`, persists a `FacetStateDto` row, returns aggregated facet counts + a `search_id` UUID for subsequent pagination,
    `delegate-to-service` (controller-layer pass-through — `searchFormData.flatMap(searchService::search).map(ResponseEntity::ok)`)
  ]
- invariants: [
    "Reactive signature — returns `Mono<ResponseEntity<SearchFacetsData>>`; success always emits `200 OK` (SearchController.java:60-65)",
    "Pass-through method — the controller method body is two flat-map calls; no controller-side validation beyond `@Valid` on the generated interface (SearchController.java:60, 62-64)",
    "Session-create semantics — every POST writes a new `search_facets` row; the response's `search_id` is the only handle to retrieve results, mutate facets, or list filter options for that session (SearchServiceImpl.java:74-82 + getFacetsData at SearchServiceImpl.java:122-155)",
    "No request body validation beyond `@Valid` on the `Mono<SearchFormData>` parameter — the generated `SearchApi.search` carries `@Valid @RequestBody`; the `SearchFormData` schema declares `query: string` with no `@Size`, no `@Pattern`, no max-length (components.yaml SearchFormData block; SearchFormData.java:25)",
    "`getQuerySuggestions` (operationId `getSearchSuggestions`, GET /api/search/suggestions) short-circuits when `query` is empty: `reactiveDataEntityRepository.getQuerySuggestions` returns `Flux.empty()` before any DB call (ReactiveDataEntityRepositoryImpl.java:474-476) — `search` itself has NO equivalent guard, so an empty query persists a `search_facets` row + runs the aggregation queries"
  ]
- audiences: [
    "ODD Platform UI — the global search bar + Catalog page consume this endpoint to materialise a faceted catalog view (see live doc fetched_excerpts under docs_link_semantic)",
    "API consumers integrating against `/api/search*` (per the generated `SearchApi` interface)"
  ]

## dependencies_semantic

- requires-feature: [
    "data-discovery / Search and Filtering feature — canonical live doc: `https://docs.opendatadiscovery.org/features/data-discovery/search`",
    "Postgres full-text-search — `to_tsquery(?)` + `@@` operator construction in `JooqFTSHelper.ftsCondition` (JooqFTSHelper.java:100-105) and `ts_rank(?, to_tsquery(?))` in `JooqFTSHelper.ftsRankField` (JooqFTSHelper.java:154-162); requires per-data-entity `search_entrypoint.search_vector` tsvector column maintained via FTS-process migration `V0_0_14__normalize_fts_process.sql` (referenced at JooqFTSHelper.java:191)"
  ]
- requires-config: [] — N/A. This method reads no config keys; the SearchController class reads no `@Value` and has no `@ConfigurationProperties` import. Pagination, ranking, and FTS dictionary defaults are not externalised.
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<SearchFacetsData>>` return + `ServerWebExchange exchange` parameter (SearchController.java:19, 60-61)",
    "jOOQ reactive Postgres session — `searchFacetRepository.create(pojo)` writes to `search_facets` and `reactiveDataEntityRepository.countByState(state)` runs the aggregation joins (SearchServiceImpl.java:80, 126)",
    "`AuthIdentityProvider` reactor-context principal resolution — `authIdentityProvider.fetchAssociatedOwner()` is called inside `getFacetsData` to compute `myObjectsTotalCount`, even when the caller did NOT request `my_objects = true` (SearchServiceImpl.java:128-130); this is a per-request principal lookup on every search"
  ]
- couples-to: [
    "`SearchApi.search` (generated interface) — supplies `@RequestMapping(method = POST, value = '/api/search', produces = 'application/json', consumes = 'application/json')`, `@Valid @RequestBody Mono<SearchFormData>` constraint, the `200 OK → SearchFacetsData` response schema, and the operation summary 'Creates a new search of all the matching dataEntities in active data sources to given query and calculates the aggregation data for correspondent data slice' (SearchApi.java:280-309)",
    "`SearchService.search(SearchFormData)` — sole downstream call; implementation maps the form to a `FacetStateDto`, persists it, and runs the facet aggregation (SearchServiceImpl.java:74-82)",
    "`FacetStateMapper.mapForm` + `FacetStateDto.removeUnselected` — strip non-selected filter entries before persistence (SearchServiceImpl.java:76 + FacetStateDto.java:30-39)",
    "`ReactiveSearchFacetRepository.create` — persists a new `search_facets` row with the materialised `FacetStateDto` and a server-generated UUID (SearchServiceImpl.java:80)",
    "`ReactiveDataEntityRepository.countByState` — runs the catalog-wide `COUNT(*)` query that powers the `total` field in the response; built via `JooqFTSHelper.facetStateConditions` + `to_tsquery(?)` (SearchServiceImpl.java:126, JooqFTSHelper.java:100-105)",
    "`AuthIdentityProvider.fetchAssociatedOwner` — invoked unconditionally inside `getFacetsData` to compute `myObjectsTotalCount`, regardless of whether the search is `my_objects=true` (SearchServiceImpl.java:128-130)"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "Playwright UI end-to-end search scenarios — `tests/features/search/search.spec.ts` exercises happy-path search via the UI (`pages.catalog.searchBy('books aqa')`, `'group aqa'`, `'737boeing aqa'`, `'book ticket'`, `'train ticket'`, `'ticket'`), empty-query (`searchBy('')`), and special-character / alphabetic / numeric variants. These hit the UI's search bar, which presumably calls `POST /api/search` underneath, but the assertions are on rendered DOM rather than the HTTP contract or the FTS query construction.",
    "`tests/features/search/search_in_data_entity.spec.ts` — second Playwright spec for entity-detail search context"
  ]
- uncovered_behaviours: [
    "HTTP-contract integration test — no `@WebFluxTest(SearchController.class)` or `WebTestClient` test asserts `POST /api/search` returns `200 OK` with a deserialisable `SearchFacetsData`",
    "FTS query-syntax robustness — no test exercises queries containing Postgres `tsquery` metacharacters (`!`, `|`, `&`, `(`, `)`, `<->`, `:*`) packed without spaces; `JooqFTSHelper.tsQuery` splits on `' '` and joins with `&`, so a single-token query like `bad!query` becomes the literal `to_tsquery('bad!query:*')` — Postgres may throw a syntax error per call and surface as 500, with no test asserting either the syntax-error 500 or a sanitised 400",
    "Empty-query persistence — no test asserts whether `query = ''` creates a real `search_facets` row and runs the full count aggregation (the suggestions endpoint short-circuits empty queries at the repository, but `search` does NOT)",
    "Pagination boundary for the sibling `getSearchResults` — no test exercises `page=0`, `size=0`, `size=Integer.MAX_VALUE`",
    "Authorisation regression — no test asserts whether an authenticated non-admin user can search the entire platform catalog without owner-scoping (current code permits it; any future tightening would have no test to break)",
    "Cross-user search-session isolation — no test asserts that user A cannot retrieve the `search_facets` row created by user B by guessing the UUID (UUIDs are server-generated, but there is no owner column on `search_facets`)"
  ]
- test_files: [
    "tests/features/search/search.spec.ts (Playwright UI spec)",
    "tests/features/search/search_in_data_entity.spec.ts (Playwright UI spec)",
    "no JVM-side controller / service / repository tests for the search surface — `find <odd-platform> -path '*test*' -name '*Search*' -name '*.java' -not -path '*build*'` returned zero results during enrichment session 2026-05-12-E01"
  ]
- gaps: |
    The whole JVM side of the search surface is untested. The Playwright specs cover the UI happy-path but cannot catch (a) FTS query-syntax failures (`to_tsquery` rejects unbalanced parentheses, stray operators, empty tokens), (b) the empty-query session-create asymmetry vs `getSearchSuggestions`, (c) cross-session UUID guessing, (d) authorisation regressions, (e) jOOQ schema drift that would silently break the `search_entrypoint` join. A regression in OpenAPI routing, WebFlux config, Jackson serialisation, jOOQ FTS query construction, or the per-FacetType condition map would not surface in the test suite. Smallest reproducer for the JVM side: `@WebFluxTest(SearchController.class)` + `WebTestClient.post().uri('/api/search').bodyValue(new SearchFormData().query('foo')).exchange().expectStatus().isOk()`.

## docs_link_semantic

- declared_docs: [] — N/A. SearchController.java carries no `@docs` Javadoc annotation; consistent with the repo-wide convention that `@docs` annotations are not bootstrapped (per the AlertController + DataEntityController class-level sidecars).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: ""
    rationale: "Canonical live doc page for the Search and Filtering feature; explicitly describes the Catalog-page seven-facet filter panel (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses) and the result presentation; matches the surface exposed by `POST /api/search` + `GET /api/search/{search_id}/results`."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Filter panel enumeration (paraphrased from live page WebFetched 2026-05-12 status 200): "The Filters panel on the Catalog page exposes seven facets: Datasource — restrict results to entities ingested from a specific datasource (single-select). Type — restrict results to one or more data entity types... multi-select... Only shown after an entity-class tab is selected... Namespace... Owner... Tag... Groups... Statuses."
      Result-display reference (verbatim): "Each entity in the search results is accompanied by an information and a question icon, offering additional clarity and insight."
      Ranking reference (verbatim): "ODD ranks these matching metadata entries based on a specific criteria."
      WHO-can-search statement (verbatim absence): the page does NOT specify user roles, access levels, or visibility scoping. No mention of "any authenticated user", "admin-only", "owner-scoped", or Permission/Role gating.
      Query-syntax statement (verbatim absence): the page does NOT describe query syntax, wildcards, Postgres tsquery semantics, operator handling, special-character behaviour, or maximum query length.
      Pagination / rate-limit / telemetry statement (verbatim absence): no mention of page-size limits, per-call latency expectations, query-text telemetry, or PII-redaction posture for search-query logging.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/search"
    anchor: ""
    rationale: "Candidate alternative URL under the active-platform-features pillar — verified as 404 during WebFetch (the page does not exist at this path). Recording the negative result so a future doc-gap-finder pass does not retry it."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Authorization-vocabulary canonical page (Policy / Permission / Role / Owner / User-owner association) — verified live (200) that NO permission gate is named for the search surface, consistent with the absence of any `SecurityRule` entry for `/api/search*` in `SecurityConstants.SECURITY_RULES`."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Permission-gate absence (verbatim from live page WebFetched 2026-05-12 status 200): the page lists five subsections (Policies, Permissions, Roles, Owners, User-owner association) and "does not provide detailed content about specific permissions, roles, or search-related access controls"; explicitly NOT MENTIONED for (a) search-endpoint Permission/Role gating, (b) "read-collaborative" / "any authenticated user" semantics for catalog reads, (c) a canonical Permission for searching or browsing the catalog.
- doc_drift_findings:
  - "The live Search and Filtering doc page (`features/data-discovery/search`, WebFetched 2026-05-12 status 200) is silent on WHO can search — there is no role/admin/owner-scoping statement. The code enforces 'any authenticated user' (no `SecurityRule` entry in `SecurityConstants.SECURITY_RULES` for `/api/search*`; falls through to `pathMatchers('/**').authenticated()` per AuthorizationCustomizer.java:29-30). For ADR-CANDIDATE-003 (read-collaborative borderline), search is a third corroborating surface alongside `getDataEntityDetails`, `getAllAlerts`, and `getActivity` — but with sharper consequences because search is the catalog's primary enumeration vector. A user can paginate `POST /api/search` + `GET /api/search/{search_id}/results` to enumerate every non-`EXCLUDE_FROM_SEARCH` data entity in the platform — its name, ODDRN, descriptions, ownership, tags, and metadata. Severity: doc-drift; the live page's silence makes the read-collaborative posture invisible to operators evaluating the platform's security model."
  - "The live doc says nothing about query-syntax handling. `JooqFTSHelper.tsQuery` (JooqFTSHelper.java:164-168) splits the user query on a single space character and appends `:*` to each token, joining with `&`, then passes the joined string verbatim to `to_tsquery(?)`. A user query containing `tsquery`-meaningful metacharacters not separated by a space (e.g. `foo!bar`, `foo|bar`, `(foo)`, `foo<->bar`) becomes a malformed `to_tsquery` input and Postgres throws `syntax error in tsquery`; a user query that happens to contain a balanced `tsquery` expression silently re-interprets as that expression. The doc does not warn operators about this; users have no way to escape special characters. (Per the e2e Playwright suite, `searchBy(entityNameWithSpecialChars)` is one of the tested inputs — what 'special chars' covers is opaque.)"
  - "The live doc enumerates seven facets (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses) but the `FacetType` enum in code carries an additional `ENTITY_CLASSES` facet (the entity-class tab itself: DataSet / DataInput / DataTransformer / DataConsumer / DataQualityTest / DataEntityGroup) plus a `my_objects` boolean flag at top level on `SearchFormData`. The doc treats entity-class as a tab structure rather than a facet — consistent with `state.selectedDataEntityClass()` being one slot rather than a multi-select — but the omission of `my_objects` from the doc's filter description means operators don't see that 'My objects' is a distinct toggle changing both the result query and the per-call cost (it triggers `authIdentityProvider.fetchAssociatedOwner()` + an additional `countByState(state, owner)` aggregation)."

## implicit_adrs

- "Search-session-as-server-state pattern — `POST /api/search` does NOT return results directly; it creates a server-side `search_facets` row keyed by a server-generated UUID, returns aggregated facet counts + the UUID, and requires the caller to call `GET /api/search/{search_id}/results` for paginated rows. The same UUID is used by `getSearchFacetList`, `updateSearchFacets`, `getFiltersForFacet`, and `highlightDataEntity` — every search interaction is bound to a persistent session row. The trade-off accepted: server retains query state across multi-step UI interactions (facet drill-down, pagination, highlighting) at the cost of an unbounded `search_facets` table that requires housekeeping (handled by `SearchFacetsHousekeepingJob` with `housekeeping.ttl.search_facets_days` TTL per REFACTOR-141 / DOC-GAP-059). Sibling features (`/api/terms/search`, `/api/queryexample/search`, `/api/referencedata/search`) replicate the same session-UUID pattern." — evidence: SearchController.java:60-65 (search creates session) + SearchController.java:42-57 (sibling endpoints all keyed by `searchId`) + SearchServiceImpl.java:74-82 (`searchFacetRepository::create`) + edges.jsonl (every `/api/search/*` endpoint exposes a `searchId` parameter) — intent_anchor: "the entire `SearchApi` interface plus the parallel `TermController` / `QueryExampleController` / `ReferenceDataController` controllers all use the same `searchId` UUID handle — a session-on-server pattern is applied consistently across four feature surfaces, signalling intentional design rather than accident." — confidence: HIGH

- "Centralised endpoint authorisation via `SecurityConstants.SECURITY_RULES` — search endpoints carry NO `@PreAuthorize`; no entry exists in `SECURITY_RULES` for `/api/search*` paths. The catch-all `pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30) is the explicit decision: any authenticated user may search the catalog. This is the third surface corroborating ADR-CANDIDATE-002 (centralised SECURITY_RULES) and ADR-CANDIDATE-003 (read-collaborative GET catalog) alongside AlertController#getAllAlerts and ActivityController#getActivity." — evidence: SearchController.java:23-92 (no annotations beyond `@RestController` + `@RequiredArgsConstructor`) + SecurityConstants.java:98 (the `SECURITY_RULES` list begins; grep for `search` returns zero matches in this file) + AuthorizationCustomizer.java:24-30 (catch-all .authenticated()) — intent_anchor: "spec.pathMatchers(\"/**\").authenticated();" (AuthorizationCustomizer.java:29-30) — confidence: HIGH

- "Reactive proxy controller — the controller is a pass-through delegate; every method is a one-line `searchFormData.flatMap(searchService::method).map(ResponseEntity::ok)`; the class implements the OpenAPI-generated `SearchApi` interface; no controller-side validation, no logging, no error mapping, no transformation. This is ADR-CANDIDATE-001 (controllers-as-delegates) applied uniformly across the search surface." — evidence: SearchController.java:23-92 (every method is `@Override` + flat-map delegate; no `@RequestMapping`, `@PostMapping`, etc.) + SearchApi.java:280-309 (the generated interface carries the `@RequestMapping(method = POST, value = '/api/search', produces = 'application/json', consumes = 'application/json')` block + the OpenAPI `@Operation`) — intent_anchor: "public class SearchController implements SearchApi" (SearchController.java:25) — confidence: HIGH

## bugs_limitations_corner_cases

- "`POST /api/search` returns the catalog-wide aggregation to any authenticated user — no Permission gate, no Role check, no admin restriction, no owner-scoping. A user toggling `my_objects=false` (the default) gets `countByState(state)` over the ENTIRE catalog. Combined with `GET /api/search/{search_id}/results` (which only owner-filters when `state.isMyObjects()` per SearchServiceImpl.java:104-110), an authenticated user can paginate through every non-`EXCLUDE_FROM_SEARCH` data entity in the platform — name, ODDRN, descriptions, ownership, tags, custom metadata. The live `features/data-discovery/search` doc says nothing about WHO can search. This is the SAME shape as REFACTOR-024 (getAllAlerts cross-owner exposure) and REFACTOR-053 (Activity feed cross-owner exposure) but with a wider blast radius — search is the catalog's primary discovery surface." — evidence: SearchController.java:60-65 (no annotations) + SecurityConstants.java:98-355 (no `/api/search*` rule) + AuthorizationCustomizer.java:29-30 (catch-all .authenticated()) + SearchServiceImpl.java:74-82 (no owner predicate in `search()`) + SearchServiceImpl.java:122-155 (`getFacetsData` runs `countByState(state)` without owner predicate) + SearchServiceImpl.java:99-111 (`getSearchResults` ONLY owner-filters when `state.isMyObjects()`; otherwise calls `dataEntityService.findByState(state, page, size)` with no owner) — severity: HIGH

- "Postgres `to_tsquery` syntax-error vector — `JooqFTSHelper.tsQuery` (JooqFTSHelper.java:164-168) splits the inbound query string on a single space character (`plainQuery.split(\" \")`), appends `:*` to each non-empty token, and joins with `&`. The joined string is then passed verbatim into `to_tsquery(?)` (JooqFTSHelper.java:103, 158). A user query containing `tsquery`-meaningful metacharacters not separated by a space — `foo!bar`, `foo|bar`, `(foo)`, `a<->b`, `foo:`, `:`, an unbalanced `(`, etc. — yields a malformed `to_tsquery` argument and Postgres raises `syntax error in tsquery: ...`, surfacing as a 500-class response. Conversely, a user query that happens to contain a balanced `tsquery` expression silently re-interprets as that expression (operator chaining, prefix-globbing via `:*` is also user-controllable). No input sanitisation, no escape of `tsquery` metacharacters, no error mapping. The `SearchFormData.query` field carries no `@Size`/`@Pattern`/max-length constraint at the OpenAPI spec, generated POJO, or controller layers (components.yaml SearchFormData block; SearchFormData.java:25). This is a low-severity DoS vector (a misformatted query throws but is non-destructive) and a robustness gap (the doc does not document the syntax, so users cannot escape)." — evidence: JooqFTSHelper.java:164-168 (`tsQuery` implementation) + JooqFTSHelper.java:100-105 (`ftsCondition` passes joined string to `to_tsquery`) + JooqFTSHelper.java:154-162 (`ftsRankField` same pattern) + SearchFormData.java:25 (no size/pattern constraints on `query`) — severity: MEDIUM

- "Unbounded query length — `SearchFormData.query` is declared `String` with no maximum length at the OpenAPI spec (components.yaml SearchFormData block: `query: type: string`), no `@Size` at the generated POJO (SearchFormData.java:23-67), and no validation at the controller. A caller can POST a query with megabytes of text; `tsQuery` then splits on space and produces a correspondingly large `to_tsquery` argument, which Postgres will attempt to parse before throwing. Combined with the absence of rate-limiting at any layer this method touches, an unauthenticated client (when `auth.type=DISABLED`) or any authenticated client can burn DB-CPU by issuing large queries." — evidence: components.yaml SearchFormData block (`query: type: string` only) + SearchFormData.java:25 + SearchController.java:60-65 (no validation hook) + SearchServiceImpl.java:74-82 (no length guard before `searchFacetRepository.create`) — severity: MEDIUM

- "Unbounded `search_facets` table writes — every `POST /api/search` persists a NEW `search_facets` row keyed by a UUID (SearchServiceImpl.java:80). The row carries the user's full `FacetStateDto` (filter selections + raw query string). There is no per-user / per-IP rate limit; an automated client can fill the `search_facets` table indefinitely. `SearchFacetsHousekeepingJob` deletes rows whose `LAST_ACCESSED_AT` is older than `housekeeping.ttl.search_facets_days` (REFACTOR-141 / DOC-GAP-059 — default 30 days at YAML floor, 0 days if `application.yml` is overridden without the housekeeping block, which would hard-DELETE all search-session rows on the next 15-minute housekeeping cycle). The table also persists the user's raw query text — a potential PII risk if users search for sensitive terms (employee names, customer IDs, etc.); no field-level encryption, no redaction, no audit log of who created which `search_facets` row." — evidence: SearchServiceImpl.java:80 (per-request `create`) + REFACTOR-141 (Housekeeping TTL default-leak) — severity: MEDIUM

- "Search-session UUID has no owner column / no per-user binding — `search_facets` rows are keyed solely by a server-generated UUID. A user who guesses or observes another user's `search_id` UUID can call `GET /api/search/{search_id}/results`, `GET /api/search/{search_id}/facet/{facet_type}`, `PUT /api/search/{search_id}` (updateSearchFacets), or `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` against it. UUIDs are server-generated (presumably v4-random) so the practical attack surface is small, but the principle of per-user session isolation is violated by absence: there is no `created_by_owner_id` filter at `searchFacetRepository.get(searchId)` (SearchServiceImpl.java:158). Note: under read-collaborative posture (ADR-CANDIDATE-003) this asymmetry has limited practical impact — the returned data is the same any-authenticated-user-can-read catalog rows. Severity adjusts accordingly." — evidence: SearchServiceImpl.java:157-160 (`fetchFacetState` does only `searchFacetRepository.get(searchId)` with no owner predicate) — severity: LOW (read-collaborative posture makes the breach impact-minimal; would be HIGH under a hypothetical owner-scoped search posture)

- "`my_objects` filter triggers double aggregation — every `POST /api/search` (and every facet refresh under `getFacetsData`) calls `authIdentityProvider.fetchAssociatedOwner()` AND runs `reactiveDataEntityRepository.countByState(state, owner)` UNCONDITIONALLY, even when the user did not toggle `my_objects=true` (SearchServiceImpl.java:128-130). The result populates `myObjectsTotalCount` on the response payload — the UI shows a count badge on the 'My objects' toggle. Each search therefore costs at least: 1× principal lookup + 1× catalog-wide `countByState` + 1× owner-filtered `countByState` + 1× entity-class facet aggregation + 1× insert-into `search_facets`. There is no caching layer in front of this path (no `@Cacheable`, no Redis/in-memory cache visible at SearchServiceImpl.java)." — evidence: SearchServiceImpl.java:122-155 (`getFacetsData` orchestrates `Mono.zip(entityClassFacet, allCount, myObjectsCount)` — three concurrent queries per call, with the third always running) — severity: MEDIUM (latency concern under high search QPS)

- "No HTTP-level JVM test exists for `POST /api/search` — the only existing search tests are two Playwright UI specs (`tests/features/search/search.spec.ts` and `search_in_data_entity.spec.ts`). A regression in OpenAPI routing, WebFlux configuration, Jackson serialisation, `FacetStateMapper`, `to_tsquery` construction, or jOOQ FTS join generation would not be caught at the JVM-test layer. Smallest reproducer: `@WebFluxTest(SearchController.class)` + `WebTestClient.post().uri('/api/search').bodyValue(new SearchFormData().query('foo')).exchange().expectStatus().isOk()`." — evidence: `find <odd-platform> -path '*test*' -name '*Search*' -name '*.java' -not -path '*build*'` returned zero matches during enrichment session 2026-05-12-E01 + `find <odd-platform>/tests/features/search` lists only `.spec.ts` files — severity: MEDIUM

- "No request-rate limit and no per-search timeout — `SearchController#search` has no `@RateLimiter`, no Bucket4j wrapper, no programmatic throttle; the downstream `SearchServiceImpl.search` has none either. An attacker (or buggy client) can issue search requests as fast as the network allows; each triggers the multi-aggregation cost in the previous corner-case + a row write. Combined with the unbounded query-length issue, this is a non-trivial DoS amplification surface." — evidence: SearchController.java:23-92 (no rate-limiter annotations) + SearchServiceImpl.java:38-196 (no rate-limiter, no timeout) — severity: MEDIUM

- "Query telemetry / logging posture is undocumented — `SearchServiceImpl` is `@Slf4j` but contains no `log.info(...)` / `log.debug(...)` for inbound queries. The query string is persisted in `search_facets.query` (a real DB column), making it queryable by anyone with database access. There is no log-redaction policy, no documented PII statement; users searching for sensitive terms (employee names, customer IDs, GDPR-protected identifiers) leave a persistent DB trail. The doc page is silent on this." — evidence: SearchServiceImpl.java:40 (`@Slf4j`) + grep for `log.info\\|log.debug` inside SearchServiceImpl returns zero hits + SearchServiceImpl.java:80 (`searchFacetRepository.create(pojo)` persists the FacetStateDto containing `getQuery()`) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these are the three modes that protect the UI/API surface; `POST /api/search` traverses the `AuthorizationCustomizer` chain under each (the customizer is wired in OAuthSecurityConfiguration.java:98 and LDAPSecurityConfiguration.java:145 per ADR-CANDIDATE-002 evidence; LoginFormSecurityConfiguration.java:55-57 does NOT wire the customizer per REFACTOR-099, meaning LOGIN_FORM authenticated users bypass even the catch-all `.authenticated()` framework registration — but the global Spring Security `.anyExchange().authenticated()` configured elsewhere still requires authentication; the bypass is of the SECURITY_RULES Permission framework, not of authentication). Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` skips authentication entirely and `POST /api/search` is anonymously reachable from any network caller. S2S applies only to `/ingestion/entities` — not to `/api/search*`.
- **ingestion_filter_relevance**: NO — `/api/search*` is a UI/API surface, not an ingestion path. `IngestionDataEntitiesFilter` registers only on `POST /ingestion/entities` (per the IngestionDataEntitiesFilter sidecar).
- **authorization_assertions**: [] — N/A. The controller class carries no `@PreAuthorize`/`@Secured`/programmatic permission check (SearchController.java:23-92); the generated `SearchApi` interface carries no `@SecurityRequirement` for the search operation (SearchApi.java:280-298); `SecurityConstants.SECURITY_RULES` contains no entry whose matcher matches `/api/search*` (SecurityConstants.java:98 — the list begins; grep for `search` returns zero matches in the file). The endpoint falls through to `pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30).
- **owner_scoping**: `BYPASSES — returns data across owners` for the default `my_objects=false` path (SearchServiceImpl.java:74-82 + SearchServiceImpl.java:122-130 `countByState(state)` runs over the whole catalog); `RESPECTS — filters by current user's owners` ONLY when the caller explicitly toggles `my_objects=true` on `SearchFormData` (SearchServiceImpl.java:104-108 — the conditional `if (state.isMyObjects())` branch in `getSearchResults`). The default is owner-bypass.
- **data_exposure**: [
    "`SearchFacetsData` (search_id UUID, query string echoed back, total catalog count, my-objects count, entity-class facet counts, current filter state) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP; any caller under auth.type=DISABLED",
    "`DataEntityList` items via the sibling `GET /api/search/{search_id}/results` — each item is a full `DataEntity` payload (id, oddrn, name, internal_name, description, entity_classes, owners, tags, namespace, datasource, status, custom-metadata-field values, term linkages) → any authenticated user; same catalog enumeration vector as `getDataEntityDetails` (per DataEntityController sidecar) but accessed by paginated catalog traversal rather than per-id lookup",
    "`SearchFormData.query` string PERSISTED in `search_facets` table → any caller with database read access; no redaction, no encryption, no TTL shorter than `housekeeping.ttl.search_facets_days` (default 30 days at YAML floor; 0 days if YAML floor is overridden without re-supplying the block per REFACTOR-141 / DOC-GAP-059 — in which case search-session rows are hard-deleted on the next 15-minute housekeeping cycle, which is data-loss-shaped rather than data-exposure-shaped)",
    "`DataEntityRef` items via `GET /api/search/suggestions` (sibling `getQuerySuggestions` method) — top-N data-entity refs for a given query prefix → any authenticated user; no owner predicate (ReactiveDataEntityRepositoryImpl.java:471-476 returns Flux.empty for empty query but applies no owner filter when query is present)",
    "`DataEntitySearchHighlight` via `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` (sibling `highlightDataEntity` method) — per-entity match highlights → any authenticated user holding the `search_id` UUID, regardless of whether that user created the search session"
  ]
- **known_security_gaps**: [
    "`POST /api/search` has NO entry in `SecurityConstants.SECURITY_RULES`; the catch-all `pathMatchers('/**').authenticated()` is the only gate. Under read-collaborative posture (ADR-CANDIDATE-003 BORDERLINE) this is the established codebase convention, but for the search surface specifically the consequence is that any authenticated user can enumerate the entire catalog — its names, descriptions, ownership, tags, terms, and custom-metadata. This is the platform's largest catalog-enumeration vector. The live doc page does not warn operators." — evidence: SearchController.java:60-65 + SecurityConstants.java:98-355 (no `/api/search*` rule) + AuthorizationCustomizer.java:29-30 + SearchServiceImpl.java:74-82 + SearchServiceImpl.java:122-130 — severity: HIGH",
    "Under `auth.type=DISABLED`, `POST /api/search` becomes anonymously reachable — `DisabledAuthSecurityConfiguration` skips authentication entirely; combined with the missing SECURITY_RULES entry, any unauthenticated client on the network can search the platform's catalog. DISABLED is documented as dev-only, but operators misusing it expose the whole catalog." — evidence: SearchController.java:60-65 + SecurityConstants.java:98-355 (no `/api/search*` rule) — severity: MEDIUM
    "Search-session UUIDs have no per-user owner-binding — `search_facets.get(searchId)` (SearchServiceImpl.java:158) returns the session row regardless of who created it. A user who learns another user's `search_id` UUID can read, update, and fetch results for that session. Practical attack surface is small (server-generated v4 UUIDs are unguessable in O(2^60) attempts), but the principle of per-user session isolation is violated. Under read-collaborative posture the actual data leaked is the same the second user could already see; under any future owner-scoped tightening this becomes a HIGH gap." — evidence: SearchServiceImpl.java:157-160 — severity: LOW",
    "Persistent query text — `SearchFormData.query` is stored verbatim in `search_facets.query` with no redaction, no encryption, no per-row owner column. Users searching for sensitive terms (employee names, customer IDs, GDPR identifiers) leave a 30-day DB trail readable by any operator with DB access. The doc does not warn." — evidence: SearchServiceImpl.java:80 (create persists the FacetStateDto including `getQuery()`) + REFACTOR-141 (TTL is operator-tuneable, defaults to 30 days at YAML floor) — severity: LOW (depends on the operator's threat model for DB-read access)
  ]

## performance

- **hot_paths**: [
    "`POST /api/search` runs three concurrent queries per call inside `getFacetsData` via `Mono.zip` (SearchServiceImpl.java:122-155): (a) entity-class facet aggregation `searchFacetRepository.getEntityClassFacetForDataEntity(state)`, (b) catalog-wide `reactiveDataEntityRepository.countByState(state)` — full `WHERE ... @@ to_tsquery(...)` plus all facet conditions, (c) owner-scoped `countByState(state, owner)` — same query plus an owner-id predicate. The third always runs even when `my_objects=false`. Plus the synchronous `searchFacetRepository.create(pojo)` row insert. The endpoint is the catalog's primary discovery path; it runs on every keystroke / facet click in the UI's search bar (the Playwright suite exercises 7+ distinct `searchBy` calls in one session)." — evidence: SearchServiceImpl.java:122-155 + SearchServiceImpl.java:80
  ]
- **throughput_characteristics**: [
    "Single-request POST per search session — no batch endpoint, no streaming.",
    "Reactive non-blocking signature (`Mono<ResponseEntity<SearchFacetsData>>`) — does not consume a thread per call, but each call holds an active Postgres connection for the duration of the four-query fan-out.",
    "Triple-aggregation fan-out per call (entity-class facet + all-count + my-objects-count) is fixed cost regardless of `my_objects` toggle — the my-objects count cannot be skipped."
  ]
- **resource_allocation**: [
    "Each search persists one `search_facets` row carrying the full `FacetStateDto` (filter selections + query string). No row-size limit — a user with a large `filters.tags` selection produces a wide row.",
    "Per-call principal lookup — `authIdentityProvider.fetchAssociatedOwner()` is invoked unconditionally inside `getFacetsData` (SearchServiceImpl.java:128); under OAuth/LDAP this is a DB lookup against `user_owner_mapping` (per the `UserOwnerMappingService` per concept catalog).",
    "Postgres `to_tsquery(?)` and `ts_rank(?, to_tsquery(?))` invocations per result-page fetch (downstream `getSearchResults` reuses `JooqFTSHelper.ftsRankField` per ReactiveDataEntityRepositoryImpl.java:652-657 + JooqFTSHelper.java:154-162) — ranking is non-trivial CPU on the DB."
  ]
- **scaling_characteristics**: [
    "Stateless controller — instances scale horizontally.",
    "`search_facets` table grows monotonically until housekeeping — `SearchFacetsHousekeepingJob` runs at the 15-minute cadence to delete rows older than `housekeeping.ttl.search_facets_days` (default 30 days at YAML floor; 0 days under the REFACTOR-141 misconfiguration shape).",
    "No pagination on the `search` endpoint itself — only the sibling `getSearchResults` (GET /api/search/{search_id}/results) accepts `page` + `size`; those are `@NotNull` on the generated SearchApi interface but carry no `@Min`/`@Max`, so an unbounded `size` is structurally accepted (same shape as REFACTOR-024 pagination concern on `getAllAlerts`).",
    "No client-side or server-side caching of search results — every call hits Postgres for the full aggregation."
  ]
- **known_performance_gaps**: [
    "Unconditional `my_objects` aggregation cost — `getFacetsData` always runs the owner-scoped `countByState(state, owner)` query even when the caller's `SearchFormData.my_objects=false`. The result populates the UI's 'My objects' badge count, but at the cost of one additional aggregation per search. A `my_objects=false` short-circuit would halve the per-call DB work in the common case." — evidence: SearchServiceImpl.java:128-130 (the `myObjectsCount` Mono runs unconditionally inside the `Mono.zip`) — severity: MEDIUM
    "No max-size on `SearchFormData.query` and no max-size on `getSearchResults` pagination — components.yaml SearchFormData block declares `query: type: string` with no maxLength; `getSearchResults` `size` carries `@NotNull` on the generated `SearchApi.getSearchResults` (line 167 of SearchApi.java) but no `@Min`/`@Max`. A caller passing `size=1_000_000` triggers a single jOOQ query bounded only by Postgres / network buffers." — evidence: components.yaml SearchFormData + SearchApi.java:164-181 (no `@Max` on size) + SearchController.java:50-57 (controller passes through to service unchanged) — severity: MEDIUM
    "`to_tsquery(?)` reconstruction per request — `JooqFTSHelper.tsQuery` re-tokenises and re-builds the `to_tsquery` argument on every search call; for hot search-bar use (UI calls on every keystroke after a debounce), this is a Postgres-side parse on every request. A prepared-statement plan cache helps but does not eliminate parsing cost." — evidence: JooqFTSHelper.java:164-168 + JooqFTSHelper.java:100-105 — severity: LOW
    "No HTTP-level caching — the catalog is read-heavy and the search endpoint returns aggregate counts that change slowly. No `@Cacheable`, no ETag, no `Cache-Control` policy is visible at the controller, service, or repository layers." — evidence: SearchController.java + SearchServiceImpl.java + ReactiveSearchFacetRepositoryImpl.java (no caching annotations or facade) — severity: LOW
  ]

## sources

- understanding ← SearchController.java:60-65 + SearchServiceImpl.java:74-82 + SearchServiceImpl.java:122-155 + SearchApi.java:280-298
- concepts.entities.SearchFormData ← components.yaml SearchFormData block + SearchFormData.java:23-67
- concepts.entities.SearchFacetsData ← SearchApi.java:280-298 + SearchServiceImpl.java:147-154
- concepts.entities.SearchFacetsPojo ← SearchServiceImpl.java:79-80 + V0_0_14__normalize_fts_process.sql (referenced at JooqFTSHelper.java:191)
- concepts.entities.FacetStateDto ← FacetStateDto.java:21-90
- concepts.operations.create-search-session ← SearchController.java:60-65 + SearchServiceImpl.java:74-82
- concepts.invariants.[2] ← SearchServiceImpl.java:74-82 + SearchServiceImpl.java:122-155
- concepts.invariants.[4] ← ReactiveDataEntityRepositoryImpl.java:471-476 (`getQuerySuggestions` empty-query short-circuit) vs SearchServiceImpl.java:74-82 (no equivalent guard in `search`)
- dependencies_semantic.requires-feature.[0] ← live doc `https://docs.opendatadiscovery.org/features/data-discovery/search` WebFetched 2026-05-12 status 200
- dependencies_semantic.requires-feature.[1] ← JooqFTSHelper.java:100-105, 154-162, 191
- dependencies_semantic.requires-runtime.[2] ← SearchServiceImpl.java:128-130
- dependencies_semantic.couples-to.SearchApi.search ← SearchApi.java:280-309 + SearchController.java:60-65 (the `@Override` block)
- dependencies_semantic.couples-to.SearchService.search ← SearchServiceImpl.java:74-82
- dependencies_semantic.couples-to.FacetStateMapper.mapForm ← SearchServiceImpl.java:76 + FacetStateDto.java:30-39
- dependencies_semantic.couples-to.AuthIdentityProvider.fetchAssociatedOwner ← SearchServiceImpl.java:128-130
- tests_coverage_semantic.test_files.[0] ← tests/features/search/search.spec.ts
- tests_coverage_semantic.test_files.[1] ← tests/features/search/search_in_data_entity.spec.ts
- tests_coverage_semantic.test_files.[2] ← `find <odd-platform-repo> -path '*test*' -name '*Search*' -name '*.java' -not -path '*build*'` returned zero matches (enrichment session 2026-05-12-E01)
- docs_link_semantic.inferred_docs.[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` (2026-05-12, status 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/search` (2026-05-12, status 404)
- docs_link_semantic.inferred_docs.[2] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` (2026-05-12, status 200)
- docs_link_semantic.doc_drift_findings.[0] ← SearchController.java:60-65 + SecurityConstants.java:98-355 (no `/api/search*` rule) + AuthorizationCustomizer.java:29-30 + WebFetch (2026-05-12) of the data-discovery/search page
- docs_link_semantic.doc_drift_findings.[1] ← JooqFTSHelper.java:164-168 + WebFetch (2026-05-12) of the data-discovery/search page (no query-syntax description)
- docs_link_semantic.doc_drift_findings.[2] ← FacetType enum + SearchFormData.my_objects field at components.yaml + SearchServiceImpl.java:128-130 + WebFetch (2026-05-12) seven-facet enumeration
- implicit_adrs.[0] ← SearchController.java:42-92 + SearchServiceImpl.java:74-82 + edges.jsonl
- implicit_adrs.[1] ← SearchController.java:23-92 + SecurityConstants.java:98 + AuthorizationCustomizer.java:24-30
- implicit_adrs.[2] ← SearchController.java:23-92 + SearchApi.java:280-309
- bugs_limitations_corner_cases.[0] ← SearchController.java:60-65 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30 + SearchServiceImpl.java:74-82, 99-111, 122-155
- bugs_limitations_corner_cases.[1] ← JooqFTSHelper.java:164-168, 100-105, 154-162 + SearchFormData.java:25 + components.yaml SearchFormData
- bugs_limitations_corner_cases.[2] ← components.yaml SearchFormData + SearchFormData.java:25 + SearchController.java:60-65 + SearchServiceImpl.java:74-82
- bugs_limitations_corner_cases.[3] ← SearchServiceImpl.java:80 + REFACTOR-141 (refactoring-scopes.md)
- bugs_limitations_corner_cases.[4] ← SearchServiceImpl.java:157-160
- bugs_limitations_corner_cases.[5] ← SearchServiceImpl.java:122-155 (Mono.zip with unconditional myObjects branch)
- bugs_limitations_corner_cases.[6] ← `find <odd-platform-repo> -path '*test*' -name '*Search*' -name '*.java' -not -path '*build*'` returned zero matches
- bugs_limitations_corner_cases.[7] ← SearchController.java + SearchServiceImpl.java (no rate-limiter / timeout annotations)
- bugs_limitations_corner_cases.[8] ← SearchServiceImpl.java:40, 80 + grep `log.info` returns zero hits inside SearchServiceImpl
- security.auth_mode_relevance ← AuthorizationCustomizer.java:24-30 + DisabledAuthSecurityConfiguration.auth.type@L10 + OAuthSecurityConfiguration.auth.type@L71 + LDAPSecurityConfiguration.auth.type@L51 sidecars (referenced via REFACTOR-099 / ADR-CANDIDATE-002 evidence)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.auth_ingestion_filter_enabled@L20 sidecar (path matcher = `/ingestion/entities` only)
- security.authorization_assertions ← SearchController.java:23-92 + SearchApi.java:280-309 + SecurityConstants.java:98 (grep `search` zero hits) + AuthorizationCustomizer.java:29-30
- security.owner_scoping ← SearchServiceImpl.java:74-82, 99-111, 122-130
- security.data_exposure ← SearchApi.java:280-309 + DataEntityList schema (components.yaml:1223-1230) + DataEntityRef schema (components.yaml:894-902) + DataEntitySearchHighlight schema (referenced via SearchController.java:11, 86-91) + SearchServiceImpl.java:80 + ReactiveDataEntityRepositoryImpl.java:471-476
- security.known_security_gaps.[0] ← SearchController.java:60-65 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30 + SearchServiceImpl.java:74-82, 122-130
- security.known_security_gaps.[1] ← SearchController.java:60-65 + SecurityConstants.java:98-355 + DisabledAuthSecurityConfiguration.auth.type@L10 sidecar
- security.known_security_gaps.[2] ← SearchServiceImpl.java:157-160
- security.known_security_gaps.[3] ← SearchServiceImpl.java:80 + REFACTOR-141 (refactoring-scopes.md)
- performance.hot_paths.[0] ← SearchServiceImpl.java:122-155 + SearchServiceImpl.java:80
- performance.throughput_characteristics ← SearchController.java:60-65 + SearchServiceImpl.java:74-82, 122-155
- performance.resource_allocation ← SearchServiceImpl.java:80, 122-155, 128 + ReactiveDataEntityRepositoryImpl.java:652-657 + JooqFTSHelper.java:154-162
- performance.scaling_characteristics ← SearchController.java:23 (stateless `@RestController`) + REFACTOR-141 + SearchApi.java:164-181 (no `@Max` on getSearchResults size)
- performance.known_performance_gaps.[0] ← SearchServiceImpl.java:128-130
- performance.known_performance_gaps.[1] ← components.yaml SearchFormData + SearchApi.java:164-181 + SearchController.java:50-57
- performance.known_performance_gaps.[2] ← JooqFTSHelper.java:164-168, 100-105
- performance.known_performance_gaps.[3] ← SearchController.java + SearchServiceImpl.java + ReactiveSearchFacetRepositoryImpl.java (absence of `@Cacheable` / ETag annotations across the chain)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (live-page WebFetch results captured verbatim; per-page status recorded)
- implicit_adrs: HIGH (three implicit ADRs all corroborated by 5+ sibling sidecars in this repo)
- bugs_limitations_corner_cases: HIGH (each gap traces to a file:line; severity calibrated against existing REFACTOR catalog and read-collaborative posture)
- security: HIGH (auth-mode relevance, owner-scoping bypass, and data-exposure assessments all traced to explicit file:line; auth.type=DISABLED reachability follows from DisabledAuthSecurityConfiguration class-level posture)
- performance: HIGH (hot-path triple-aggregation is directly observable in SearchServiceImpl.java:122-155; unconditional `my_objects` cost confirmed at SearchServiceImpl.java:128-130)

## Maintainer notes

