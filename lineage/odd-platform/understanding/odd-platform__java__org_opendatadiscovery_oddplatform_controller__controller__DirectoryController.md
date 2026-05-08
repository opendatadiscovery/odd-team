---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:DirectoryController"
node_kind: controller
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-01
---

# DirectoryController — semantic understanding

## understanding

`DirectoryController` is the REST entry-point for the catalogue's Directory feature: a four-level hierarchical browse (data source type → data source → entity type → entity) that complements Search's flat full-text result list. The controller is a thin adapter — it implements the OpenAPI-generated `DirectoryApi` interface and forwards each of its four endpoints to either `DirectoryService` (levels 1, 2, 3) or `DataEntityService.getDataEntitiesByDatasourceAndType` (level 4). All four endpoints return reactive types (`Mono`/`Flux`) and are read-only `GET` operations under `/api/directory`. The Directory's grouping key is the ODDRN prefix (e.g. `postgresql`, `snowflake`), with `Other` (unknown prefix) bucketed via `OddrnUtils.UNKNOWN_DATASOURCE_TYPE`.

## concepts

- entities: ["Data Source Type", "Data Source", "Data Entity Type", "Data Entity", "ODDRN"]
- operations:
  - "list-data-source-types-with-counts"
  - "list-data-sources-by-prefix"
  - "list-data-entity-types-within-datasource"
  - "list-data-entities-by-datasource-and-type-paged"
- invariants:
  - "Routes are GET-only and live under /api/directory; the Directory is read-only navigation, not mutation"
  - "Level 1 (types) groups by ODDRN prefix; level 2 (sources) requires a prefix; level 4 (entities) requires both data_source_id (path) and page+size (query, mandatory) with optional type_id"
  - "DataSourceTypeList items include 'Other' for sources whose ODDRN cannot be parsed (UNKNOWN_DATASOURCE_TYPE)"
  - "All four endpoints are reactive (Mono/Flux) and integrate via Spring WebFlux ServerWebExchange"
- audiences: ["Platform UI users browsing the catalogue", "API clients (UI generated-sources/apis/DirectoryApi.ts) integrating directory navigation"]

## dependencies_semantic

- requires-feature:
  - "ODDRN parsing (org.opendatadiscovery.oddrn.Generator) — the prefix-based grouping at levels 1 and 2 depends on a parseable ODDRN; failure falls back to UNKNOWN_DATASOURCE_TYPE"
  - "Data-entity ingestion — counts (entities_count) come from ReactiveDataEntityRepository.getCountByDataSources; an empty platform returns 0-count types/sources"
  - "Data-source registration — DataSourceTypeList is derived from ReactiveDataSourceRepository.list() grouped by ODDRN prefix"
- requires-config: []
- requires-runtime:
  - "Spring WebFlux runtime (Mono/Flux/ServerWebExchange)"
  - "PostgreSQL via reactive JOOQ repositories (transitive through DirectoryService and DataEntityService)"
- couplings:
  - "Splits ownership across two services: DirectoryService for type/source/entity-type listings, DataEntityService for the paged entity list — the controller is the only place this two-service composition is expressed"

## tests_coverage_semantic

- covered_behaviours:
  - "GET /api/directory returns DataSourceTypeList grouped by ODDRN prefix (Postgres + Other) with correct entitiesCount totals (DirectoryTest.directoriesTest:57-67)"
  - "GET /api/directory/datasources?prefix={prefix} returns DataSourceDirectoryList for known prefix (postgresql) with per-source ODDRN-derived properties host/database (DirectoryTest:70-77, 141-149)"
  - "GET /api/directory/datasources?prefix=other returns sources whose ODDRN cannot be parsed, with properties={oddrn: <raw>} (DirectoryTest:79-85, 151-158)"
- uncovered_behaviours:
  - "GET /api/directory/datasources/{data_source_id} (paged entities) — no DirectoryTest assertion exists for getDatasourceEntities; pagination semantics (page/size mandatory, type_id optional) are untested at the directory layer"
  - "GET /api/directory/datasources/{data_source_id}/types — no DirectoryTest assertion exists for getDatasourceEntityTypes; the DataEntityTypeDto.findById NotFoundException path is unverified end-to-end"
  - "Authorization behaviour — DirectoryController carries no @PreAuthorize annotation; no test asserts whether anonymous or low-privilege users can browse the directory"
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DirectoryTest.java:30-159 (integration test extending BaseIngestionTest)"
- gaps: |
    A regression in pagination (page/size off-by-one or type_id filter being ignored)
    would not be caught — the integration test only walks the type and datasource-list
    endpoints, not the per-datasource entity list. A regression where a malformed
    ODDRN crashes the response (rather than falling back to UNKNOWN_DATASOURCE_TYPE)
    would also slip past: getDataSourcePrefix swallows exceptions via try/catch but
    the test fixture only uses well-formed ODDRNs (PostgreSqlPath builder + a
    deliberately-prefixed unknown ODDRN). Authorization regressions (e.g. a future
    @PreAuthorize being added or removed) have no coverage at all.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/directory"
    anchor: ""
    rationale: "Resolved via 404 redirect-suggestion from the originally-noted /data-discovery/directory URL; live page describes the four-level hierarchy and the Search-vs-Directory contrast that this controller's four endpoints implement."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "Where Search is query-driven (you know what you're looking for and type a term),
       the Directory is hierarchy-driven" — meaning you explore through known
       structural categories rather than searching by keywords.

      Four-level navigation:
      1. Data source types — Cards grouped by ODDRN prefix showing entity counts per type
      2. Data sources — Registered instances of the selected type with ODDRN-derived properties
      3. Entity types — Distinct Data Entity classes present in the chosen source
      4. Entities — Paged list matching both (data source, entity type) filters
  - url: "https://docs.opendatadiscovery.org/data-discovery/directory"
    anchor: ""
    rationale: "URL noted in the enrichment task input as the likely doc URL; verified to be a 404 at this commit despite F-039 resolution claim — the page now lives under /features/data-discovery/directory."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      404 Not Found page; the page suggests the canonical URL
      "https://docs.opendatadiscovery.org/features/data-discovery/directory" instead.
- doc_drift_findings:
  - "The doc page documents 'Entity types — Distinct Data Entity classes present in the chosen source' (level 3), but the controller's getDatasourceEntityTypes returns DataEntityType (a TYPE, e.g. TABLE/FILE/...), not DataEntityClass — the docs' wording 'classes' may mislead operators familiar with ODD's DataEntityClass concept (which is a separate dimension). Recommend clarifying in the doc page that level 3 is data ENTITY TYPE (TABLE/FILE/STREAM/...), not data ENTITY CLASS."
  - "The 2026-05-08 originally-recorded doc URL (/data-discovery/directory) is a 404 at this commit, despite F-039's claimed resolution; the canonical URL is /features/data-discovery/directory. Any internal cross-link or maintenance state pointing at the old URL needs updating."
  - "The Directory feature doc page (200 at /features/data-discovery/directory, WebFetched 2026-05-08) contains NO mention of authorization, owner-scoping, pagination semantics, or scaling behaviour — yet the endpoint exposes the full registered-data-source inventory and is unscoped by ownership at the controller layer. Operators reading the docs are not warned that the Directory is a non-owner-scoped view of every registered data source."

## implicit_adrs

- "The Directory and Search are separate browse interfaces; Directory is hierarchy-driven, Search is query-driven — there is no shared controller, no shared DTO, and no shared route prefix between them." — evidence: DirectoryController.java:17-52 (separate @RestController, separate /api/directory route prefix via DirectoryApi.java:64); contrast with Search's flat result list (separate SearchController). — confidence: HIGH
- "Directory navigation is on-demand at each level rather than fetching the full tree at once: four endpoints, each returning one level, with the next level fetched only when the user drills in." — evidence: DirectoryApi.java:62-209 (four separate GET routes for types, sources-by-prefix, entity-types-by-source, entities-by-source-and-type). — confidence: HIGH
- "ODDRN prefix is the canonical grouping key for data-source-type aggregation; sources whose ODDRN cannot be parsed are bucketed under a single 'Other' (UNKNOWN_DATASOURCE_TYPE) sentinel rather than being hidden or erroring." — evidence: DirectoryServiceImpl.java:33 (UNKNOWN_DATASOURCE_TYPE static import) + DirectoryServiceImpl.java:101-110 (getDataSourcePrefix catches all exceptions and returns UNKNOWN_DATASOURCE_TYPE) + DirectoryTest.java:42-43,79-85 (test asserts both 'unknown' and 'oddplatform/host' prefixes are bucketed under 'other'). — confidence: HIGH
- "Pagination at the entity-list level is mandatory (page and size are @NotNull required query params), but the type filter is optional — the Directory always pages, never streams, the entity list." — evidence: DirectoryApi.java:112-114 (@NotNull on page/size, @RequestParam(required = false) on type_id). — confidence: HIGH
- "Directory endpoints carry no controller-level authorization annotations (no @PreAuthorize, no @Secured); access control, if any, is enforced at the framework / global-security-config level rather than per-route." — evidence: DirectoryController.java:1-52 (only @RestController + @RequiredArgsConstructor; no Spring Security annotations on class or methods). — confidence: HIGH
- "GET endpoints are intentionally outside SecurityConstants.SECURITY_RULES — only mutating routes (POST/PUT/DELETE/PATCH) carry per-route Permission gates; reads are uniformly authenticated-only across the platform." — evidence: SecurityConstants.java:98-355 (no `/api/directory*` rules; the SECURITY_RULES list contains only mutating-method matchers). — confidence: HIGH

## bugs_limitations_corner_cases

- "DirectoryServiceImpl.getDataSourceTypes loads ALL data sources via dataSourceRepository.list() (no pagination), then groups them in memory by ODDRN prefix. For a platform with tens of thousands of registered data sources this becomes an O(n) memory + parsing cost on every Directory landing-page hit." — evidence: DirectoryServiceImpl.java:48-50 (.list().collectMultimap(...)) — severity: MEDIUM
- "getDataSourcePrefix and getDataSourceName swallow ALL exceptions (catch Exception) and return UNKNOWN_DATASOURCE_TYPE; a transient ODDRN parser bug or a malformed ODDRN would silently land in the 'Other' bucket rather than surfacing as a parse error. Operators investigating 'why is my postgres source under Other?' have only the error log to go on." — evidence: DirectoryServiceImpl.java:101-110, 112-122 — severity: MEDIUM
- "getDataSourceTypes assumes every prefix-group has at least one data source (getFirstDataSource throws IllegalArgumentException on empty); the assumption is true today because the multimap only contains keys with values, but a future refactor that introduces empty groups would surface as a 500 from /api/directory rather than an empty type entry." — evidence: DirectoryServiceImpl.java:173-178 (getFirstDataSource throws on empty) + DirectoryServiceImpl.java:51-62 (calls it without an empty-check) — severity: LOW
- "getOddrnPathProperties uses Java reflection (getDeclaredFields + getMethod 'get'+capitalised-name + invoke) on every data-source row in /api/directory/datasources; the cost compounds with prefix-list size and is unmemoised." — evidence: DirectoryServiceImpl.java:153-171 — severity: LOW
- "getDatasourceEntityTypes throws NotFoundException when DataEntityTypeDto.findById fails for an id returned by the repository — i.e. the repository returns an entity-type-id the in-memory DTO catalog does not know about. This is a server-side data-integrity error masquerading as a client-facing 404 ('Data entity type'); the error message is the same as if the user requested a missing resource." — evidence: DirectoryServiceImpl.java:124-127 — severity: LOW
- "DirectoryController carries no authorization annotation on any endpoint, while the Directory exposes the full registered-data-source inventory (names, ODDRNs, host/database properties) and entity counts. Whether this is acceptable depends on the platform's global Spring Security configuration; the controller alone does not enforce visibility-by-permission." — evidence: DirectoryController.java:17-52 (no @PreAuthorize / @Secured anywhere) — severity: MEDIUM

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the Directory's `/api/directory*` paths are part of the UI/API surface and are protected by whichever of the three authenticated modes is active (per `auth.type`). `DISABLED` skips authentication entirely (dev-only per the live `enable-security` doc, WebFetched 2026-05-08, status 200), in which case Directory is open to any caller. `S2S` does not apply — Directory is not an `/ingestion/**` path. — evidence: DirectoryController.java:17-52 (no `@ConditionalOnProperty(value="auth.type", ...)` — all four authenticated modes route here) + SecurityConstants.java:95-96 (`/ingestion/**` is whitelisted from UI/API auth, `/api/directory*` is not on the WHITELIST_PATHS list, so it is gated by the active auth mode).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The Directory endpoints are read-only `GET /api/directory*` routes; the `IngestionDataEntitiesFilter` and `IngestionDataSourceFilter` operate on `POST /ingestion/datasources` and `POST /ingestion/entities` per the live `enable-security` doc (WebFetched 2026-05-08, status 200). — evidence: DirectoryApi.java:62-209 (all four routes are GETs under `/api/directory`) + SecurityConstants.java:95-96 (the WHITELIST_PATHS line that exempts `/ingestion/**` from UI/API auth, confirming the ingestion path is the separate surface).
- **authorization_assertions**: `[]` — there are NO `@PreAuthorize` annotations on the controller class or any of its four methods, NO programmatic `permissionService.hasPermission(...)` calls, and NO entry in `SecurityConstants.SECURITY_RULES` matching `/api/directory*` (the rule list gates only mutating routes — POST/PUT/DELETE/PATCH — across the entire platform; all four Directory endpoints are GETs, so they fall through to the global `authenticated()` gate that comes from the WebFlux SecurityFilterChain configuration). — evidence: DirectoryController.java:1-52 (no Spring Security annotations) + SecurityConstants.java:98-355 (no path matcher mentions `/api/directory`; rule list is mutating-method-only).
- **owner_scoping**: `BYPASSES — returns data across owners (no owner filter)`. All four Directory endpoints return platform-wide aggregates with no filtering by the current user's owner identity: `getDataSourceTypes` lists every registered data source via `dataSourceRepository.list()`, `getDirectoryDatasourceList(prefix)` returns every data source matching the prefix, `getDatasourceEntities` pages every entity in a data source regardless of ownership, and `getDatasourceEntityTypes` returns every entity-type-id present in the data source. The Directory is a **non-owner-scoped view of the whole catalogue** — any authenticated user (in LOGIN_FORM/OAUTH2/LDAP) can enumerate every registered data source's name, ODDRN, host, database, and entity counts. — evidence: DirectoryServiceImpl.java:48 (unfiltered `dataSourceRepository.list()`), 91-99 (unfiltered `findByPrefix(prefix)`), 86 (`dataEntityRepository.getDataSourceEntityTypeIds(dataSourceId)` — no owner-scope arg), DirectoryController.java:42 (`dataEntityService.getDataEntitiesByDatasourceAndType` called without an owner identity).
- **data_exposure**:
  - "Data source inventory (count by ODDRN-prefix, prefix display name, total entitiesCount per type) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP, no owner filter applied" — evidence: DirectoryServiceImpl.java:46-63 (getDataSourceTypes) + DirectoryController.java:24-27 (no auth annotation).
  - "Per-data-source detail (name, ODDRN, ODDRN-derived properties such as host/database/cluster, per-source entitiesCount) → any authenticated user, no owner filter" — evidence: DirectoryServiceImpl.java:65-82 (getDirectoryDatasourceList) + DirectoryServiceImpl.java:138-171 (getOddrnProperties reflects ALL @PathField ODDRN attributes — host, database, schema, cluster, etc.).
  - "Per-data-source entity-type list (TABLE/FILE/STREAM/...) → any authenticated user, no owner filter" — evidence: DirectoryServiceImpl.java:84-89 (getDatasourceEntityTypes).
  - "Per-data-source entity list paged (DataEntity payloads with names, types, descriptions, oddrns, ownerships) → any authenticated user, no owner filter at the Directory layer; whatever filtering DataEntityService.getDataEntitiesByDatasourceAndType applies is the only gate" — evidence: DirectoryController.java:36-44 (delegates to DataEntityService without an owner-context argument).
  - "When auth.type=DISABLED, every above payload is exposed unauthenticated to any caller able to reach `/api/directory*` (the Directory is not on WHITELIST_PATHS but DISABLED skips auth entirely)" — evidence: SecurityConstants.java:95-96 + the live `enable-security` doc note that DISABLED is dev-only (WebFetched 2026-05-08).
- **known_security_gaps**:
  - "The Directory is a reconnaissance surface: an authenticated user with no Permissions and no Owner association can still enumerate every registered data source's ODDRN, host, database, and per-type entity count via `GET /api/directory` and `GET /api/directory/datasources?prefix={...}`. Whether this is intentional (catalogue is by-design world-readable for any authenticated principal) or a finding (per-data-source visibility should be owner-gated) is an unresolved policy question; the live `data-discovery/directory` doc page does NOT warn operators that Directory is platform-wide and unscoped by ownership." — evidence: DirectoryController.java:17-52 (no controller-level gate) + DirectoryServiceImpl.java:46-99 (no owner-scope filter) + WebFetch of /features/data-discovery/directory 2026-05-08 (no mention of authorization, ownership, or visibility) — severity: MEDIUM
  - "DirectoryController has no `@PreAuthorize` and no entry in `SecurityConstants.SECURITY_RULES`; authorization is delegated entirely to the global SecurityFilterChain's blanket `authenticated()` rule. A regression that loosens the global filter (e.g. accidentally permits-all on a path matcher) would silently make `/api/directory*` open. There is no fail-closed per-route gate as a second line of defence." — evidence: DirectoryController.java:1-52 + SecurityConstants.java:95-355 (rule list is mutating-method-only) — severity: LOW
  - "ODDRN-derived properties exposed via `getOddrnProperties` include the `host` and `database` of every data source (a Postgres source's hostname and database name are emitted as `host: pg-prod.internal`, `database: orders`). For deployments where the data-source registration intentionally avoids exposing internal hostnames in the UI, the Directory leaks them. The reflection-based extractor walks every `@PathField` annotation on the OddrnPath subclass — there is no allow-list or redaction step." — evidence: DirectoryServiceImpl.java:153-171 (reflection over all @PathField fields) + DirectoryTest.java:141-149 (test asserts `host` and `database` in the response) — severity: LOW
  - "When `auth.type=DISABLED` (per `enable-security` live doc, dev-only), the Directory becomes an unauthenticated read of the entire data-source inventory. Any operator running DISABLED in a non-localhost reachable environment ships an open reconnaissance endpoint." — evidence: SecurityConstants.java:95-96 (no whitelist for `/api/directory*`, but DISABLED skips auth entirely) + DirectoryController.java:1-52 — severity: LOW (DISABLED is dev-only per docs)

## performance

- **hot_paths**:
  - "GET /api/directory (getDataSourceTypes) fires on every navigation to the /directory UI route — the landing page of the Directory feature. The handler runs `dataSourceRepository.list()` (full scan, no pagination) AND `dataEntityRepository.getCountByDataSources()` (aggregate count across all sources) on every hit; both cross-DB round-trips run in parallel via `Mono.zip` but the in-memory grouping/parsing cost grows linearly with data-source count." — evidence: DirectoryServiceImpl.java:46-63
  - "GET /api/directory/datasources?prefix={prefix} (getDirectoryDatasourceList) fires on every type-card click in the UI. The handler runs `findByPrefix(prefix)` then `getCountByDataSources(ids)` (per-source-id count), then runs reflection-based ODDRN-property extraction on every returned source." — evidence: DirectoryServiceImpl.java:65-82, 138-171
  - "GET /api/directory/datasources/{id} (getDatasourceEntities) fires on every entity-type drill-down click; delegates to `dataEntityService.getDataEntitiesByDatasourceAndType` which paginates at the DB level (page/size are mandatory @NotNull params)." — evidence: DirectoryController.java:36-44 + DirectoryApi.java:112-114
- **throughput_characteristics**:
  - "All four endpoints are reactive (Mono/Flux signature) — non-blocking, but each call still incurs at least one DB round-trip. No batching, no caching layer in front of DirectoryServiceImpl." — evidence: DirectoryController.java:14-15,23-51 (Mono/Flux returns) + DirectoryServiceImpl.java:46-89 (no @Cacheable, no Caffeine, no in-memory store)
  - "`getDataSourceTypes` and `getDirectoryDatasourceList` return ALL matching items in a single response — no pagination on the type list or the per-prefix data-source list. Only the entity-leaf endpoint (`getDatasourceEntities`) paginates." — evidence: DirectoryApi.java:62-66 (no page/size on the types route), 190-197 (no page/size on the prefix route), 105-115 (page/size mandatory on the entities route)
  - "`getDatasourceEntityTypes` returns a `Flux<DataEntityType>` — streaming-shaped on the wire but the underlying `getDataSourceEntityTypeIds` returns the full id set in one DB query, then `DataEntityTypeDto.findById` is an in-memory enum lookup; the reactive Flux does not lazy-load from the DB on consumer demand." — evidence: DirectoryServiceImpl.java:84-89 + DirectoryServiceImpl.java:124-127
- **resource_allocation**:
  - "`getDataSourceTypes` collects the full data-source list into a `Map<String, Collection<DataSourcePojo>>` multimap in memory before producing the response. Memory cost is O(N) in registered-data-source count; for a platform with 10K+ data sources this is non-trivial." — evidence: DirectoryServiceImpl.java:48-50 (.collectMultimap), 51-62 (in-memory stream over the multimap)
  - "`getOddrnProperties` uses Java reflection (Field/Method/invoke) on every data-source row in the per-prefix listing. Reflection is unmemoised — each request re-walks the `@PathField`-annotated fields of the OddrnPath subclass and re-resolves the getter Method via `pathClass.getMethod(...)`." — evidence: DirectoryServiceImpl.java:153-171
  - "DB round-trips per request: getDataSourceTypes = 2 (zipped), getDirectoryDatasourceList = 2 (sequential), getDatasourceEntities = whatever DataEntityService consumes, getDatasourceEntityTypes = 1." — evidence: DirectoryServiceImpl.java:46-89
- **scaling_characteristics**:
  - "Stateless controller — `DirectoryController` holds only injected service references via `@RequiredArgsConstructor`; instances scale horizontally without coordination." — evidence: DirectoryController.java:17-21
  - "No pagination on the type-list (`/api/directory`) or the per-prefix data-source list (`/api/directory/datasources?prefix=`) — response payload size grows O(N) with registered-data-source count. A platform with 10K+ data sources renders a 10K-item type-card landing page (after grouping, fewer cards but each carries the per-prefix count over all 10K rows)." — evidence: DirectoryApi.java:62-66, 190-197 (no page/size params) + DirectoryServiceImpl.java:48-50
  - "No HTTP caching headers, no ETag, no `@Cacheable` — every UI navigation re-runs the full DB+grouping pipeline. A user clicking back-and-forth between the Directory landing and a type-card pays the full cost on every round-trip." — evidence: DirectoryController.java:23-51 (no cache annotations) + DirectoryServiceImpl.java:39-89 (no cache annotations on the service either)
  - "Pagination at the entity-leaf endpoint is mandatory (`page` and `size` are `@NotNull`) — bounded response size at level 4. Optional `type_id` further narrows the result." — evidence: DirectoryApi.java:112-114
- **known_performance_gaps**:
  - "`/api/directory` (the Directory landing page) has no pagination on the type-card list — degrades response time and memory linearly with registered-data-source count. For platforms with thousands of data sources, every Directory navigation pays an unbounded scan + in-memory grouping cost." — evidence: DirectoryServiceImpl.java:46-63 + DirectoryApi.java:62-66 (no page/size params on this route) — severity: MEDIUM
  - "`/api/directory/datasources?prefix=...` has no pagination on the per-prefix data-source list — a single popular prefix (e.g. `postgresql` with 5K registered Postgres sources) produces a 5K-item response with reflection-based property extraction per row." — evidence: DirectoryServiceImpl.java:65-82, 138-171 + DirectoryApi.java:190-197 (no page/size params) — severity: MEDIUM
  - "Reflection-based `getOddrnPathProperties` is unmemoised — per request, per data source, the `@PathField` field set is re-discovered and the getter Method is re-resolved via `pathClass.getMethod(...)`. A simple per-OddrnPath-subclass cache (Map<Class, List<Method>>) would eliminate the per-row reflection cost." — evidence: DirectoryServiceImpl.java:153-171 — severity: LOW
  - "No HTTP/server-side caching layer in front of any Directory endpoint, despite the data being read-mostly (data-source registrations change rarely, entity counts change at ingestion cadence). A short-TTL cache on `getDataSourceTypes` would cut landing-page latency materially without sacrificing correctness." — evidence: DirectoryServiceImpl.java:39-89 (no @Cacheable / no Caffeine / no Redis client) + DirectoryController.java:17-52 (no cache headers) — severity: LOW
  - "`getDataSourceTypes` runs `dataSourceRepository.list()` and `dataEntityRepository.getCountByDataSources()` — the second query aggregates entity counts across ALL data sources, even though the response only needs counts grouped by prefix. A query that pre-aggregates by ODDRN-prefix at the DB level would shrink the work materially for platforms with high entity volume." — evidence: DirectoryServiceImpl.java:47, 51-62 (in-memory re-aggregation of per-source counts into per-prefix counts) — severity: LOW

## sources

- understanding ← DirectoryController.java:17-52 + DirectoryApi.java:42-212 + DirectoryServiceImpl.java:39-89
- concepts.entities ← DirectoryController.java:5-9 (DataEntityType / DataSourceDirectoryList / DataSourceEntityList / DataSourceTypeList imports) + DirectoryServiceImpl.java:24 (OddrnUtils import) + main-concepts canonical capitalisation per task notes
- concepts.operations ← DirectoryController.java:23-51 (four method bodies) + DirectoryApi.java:62-209 (HTTP routes)
- concepts.invariants ← DirectoryApi.java:62-66 (GET /api/directory) + DirectoryApi.java:105-115 (GET /api/directory/datasources/{id}, @NotNull page/size, optional type_id) + DirectoryApi.java:190-197 (GET /api/directory/datasources, @NotNull prefix) + DirectoryServiceImpl.java:101-110 (UNKNOWN_DATASOURCE_TYPE fallback) + DirectoryTest.java:79-85 (Other bucket asserted)
- concepts.audiences ← odd-platform-ui/src/generated-sources/apis/DirectoryApi.ts (generated UI client)
- dependencies_semantic.requires-feature ← DirectoryServiceImpl.java:25-27,43,103,114 (Generator usage) + DirectoryServiceImpl.java:47-50 (getCountByDataSources + dataSourceRepository.list)
- dependencies_semantic.requires-runtime ← DirectoryController.java:13-15 (ServerWebExchange + Mono/Flux imports) + DirectoryServiceImpl.java:22-23 (Reactive*Repository)
- dependencies_semantic.couplings ← DirectoryController.java:20-21 + DirectoryController.java:42 (DataEntityService.getDataEntitiesByDatasourceAndType) — split-service composition is controller-only
- tests_coverage_semantic.test_files ← /home/rdamayeu/work/odd/odd-platform/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DirectoryTest.java:30-159
- tests_coverage_semantic.covered_behaviours ← DirectoryTest.java:57-67,70-85,141-158
- tests_coverage_semantic.uncovered_behaviours ← Grep of the test (no `getDatasourceEntities` / `getDatasourceEntityTypes` URL or method invocation present)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/directory (status 200, 2026-05-08)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/data-discovery/directory (status 404, 2026-05-08)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch excerpt "Distinct Data Entity classes" + DirectoryApi.java:145 (DataEntityType, not DataEntityClass)
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch results above (URL mismatch)
- docs_link_semantic.doc_drift_findings.[2] ← WebFetch /features/data-discovery/directory 2026-05-08 (no mention of authz/ownership/scaling) + DirectoryServiceImpl.java:46-99 (no owner scope)
- implicit_adrs.[0] ← DirectoryController.java:17-52 + DirectoryApi.java:62-209
- implicit_adrs.[1] ← DirectoryApi.java:62-209 (four routes)
- implicit_adrs.[2] ← DirectoryServiceImpl.java:33,92-110 + DirectoryTest.java:42-43,79-85
- implicit_adrs.[3] ← DirectoryApi.java:112-114
- implicit_adrs.[4] ← DirectoryController.java:1-52 (no Spring Security annotations)
- implicit_adrs.[5] ← SecurityConstants.java:98-355 (only mutating-method matchers in SECURITY_RULES; no GET rules; no `/api/directory` matcher)
- bugs_limitations_corner_cases.[0] ← DirectoryServiceImpl.java:46-63
- bugs_limitations_corner_cases.[1] ← DirectoryServiceImpl.java:101-122
- bugs_limitations_corner_cases.[2] ← DirectoryServiceImpl.java:51-62,173-178
- bugs_limitations_corner_cases.[3] ← DirectoryServiceImpl.java:138-171
- bugs_limitations_corner_cases.[4] ← DirectoryServiceImpl.java:124-127
- bugs_limitations_corner_cases.[5] ← DirectoryController.java:17-52
- security.auth_mode_relevance ← DirectoryController.java:17-52 (no @ConditionalOnProperty) + SecurityConstants.java:95-96 (WHITELIST_PATHS shows `/api/directory*` is NOT whitelisted) + WebFetch /configuration-and-deployment/enable-security 2026-05-08 status 200 (DISABLED/LOGIN_FORM/OAUTH2/LDAP modes)
- security.ingestion_filter_relevance ← DirectoryApi.java:62-209 (all GETs under /api/directory) + SecurityConstants.java:95-96 (`/ingestion/**` is the separate whitelisted surface) + WebFetch /configuration-and-deployment/enable-security 2026-05-08 (filter applies on /ingestion/datasources and /ingestion/entities)
- security.authorization_assertions ← DirectoryController.java:1-52 (no @PreAuthorize anywhere) + SecurityConstants.java:98-355 (no `/api/directory*` rule; SECURITY_RULES is mutating-method-only)
- security.owner_scoping ← DirectoryServiceImpl.java:48 (unfiltered .list()) + DirectoryServiceImpl.java:91-99 (unfiltered findByPrefix) + DirectoryServiceImpl.java:84-89 + DirectoryController.java:36-44 (no owner identity passed to DataEntityService)
- security.data_exposure.[0-4] ← DirectoryServiceImpl.java:46-89,138-171 + DirectoryController.java:24-51 + SecurityConstants.java:95-96 + WebFetch /configuration-and-deployment/enable-security 2026-05-08
- security.known_security_gaps.[0] ← DirectoryController.java:17-52 + DirectoryServiceImpl.java:46-99 + WebFetch /features/data-discovery/directory 2026-05-08
- security.known_security_gaps.[1] ← DirectoryController.java:1-52 + SecurityConstants.java:95-355
- security.known_security_gaps.[2] ← DirectoryServiceImpl.java:153-171 + DirectoryTest.java:141-149
- security.known_security_gaps.[3] ← SecurityConstants.java:95-96 + DirectoryController.java:1-52 + WebFetch /configuration-and-deployment/enable-security 2026-05-08
- performance.hot_paths.[0-2] ← DirectoryServiceImpl.java:46-89 + DirectoryController.java:23-51 + DirectoryApi.java:62-209
- performance.throughput_characteristics.[0-2] ← DirectoryController.java:14-15,23-51 + DirectoryServiceImpl.java:46-89 + DirectoryApi.java:62-66,105-115,190-197
- performance.resource_allocation.[0-2] ← DirectoryServiceImpl.java:48-62,153-171 + DirectoryServiceImpl.java:46-89
- performance.scaling_characteristics.[0-3] ← DirectoryController.java:17-21,23-51 + DirectoryApi.java:62-66,105-115,190-197 + DirectoryServiceImpl.java:39-89
- performance.known_performance_gaps.[0] ← DirectoryServiceImpl.java:46-63 + DirectoryApi.java:62-66
- performance.known_performance_gaps.[1] ← DirectoryServiceImpl.java:65-82,138-171 + DirectoryApi.java:190-197
- performance.known_performance_gaps.[2] ← DirectoryServiceImpl.java:153-171
- performance.known_performance_gaps.[3] ← DirectoryServiceImpl.java:39-89 + DirectoryController.java:17-52
- performance.known_performance_gaps.[4] ← DirectoryServiceImpl.java:47,51-62

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes
