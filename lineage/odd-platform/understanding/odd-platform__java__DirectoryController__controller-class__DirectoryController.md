---
node_id: "odd-platform java DirectoryController controller-class:DirectoryController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-T-DirectoryController
pillar: P-01
related_pillar_features:
  - P-01:F-Directory  # the four-level browse surface; Directory sub-feature of Data Discovery
related_features:
  - F-008  # Batch Ingestion via Collector/DataSource — the producer side of what Directory enumerates (entities populated, types observed, ODDRNs registered)
related_refactors:
  - REFACTOR-024  # cross-owner read posture family — DirectoryController is a FIFTH+ enumeration vector in the read-collaborative family (catalog-inventory by data-source TYPE + per-source DETAIL + entity-type roster + entity LIST)
  - REFACTOR-203  # graph-shaped cross-owner enumeration via lineage — Directory is the FLAT-LIST enumeration sibling (no edges, but every datasource + ODDRN + host + database visible to any authenticated user)
  - REFACTOR-185  # auth.type=DISABLED bypass — Directory inherits the DISABLED-mode unauthenticated-reachability hazard with NO controller-level fail-closed gate
  - REFACTOR-425  # ReactiveDataSourceRepositoryImpl.listDto page-vs-count predicate divergence — DirectoryController does NOT consume listDto (uses findByPrefix instead), so REFACTOR-425's specific divergence does NOT propagate; HOWEVER, this sidecar surfaces a STRUCTURALLY SIMILAR page-vs-count predicate divergence in DataEntityRepository.listByDatasourceAndType vs countByDatasourceAndType consumed at getDatasourceEntities (level 4) — filed as REFACTOR-NEW
related_adrs:
  - ADR-CANDIDATE-003  # read-collaborative catalog — Directory IS the read-collaborative posture's flat-list enumeration vector
  - ADR-CANDIDATE-114  # read-cardinality split — Directory has NO "/my" variant, NO owner-scoped sibling — so the entire feature is the "unscoped" half by design
  - ADR-CANDIDATE-122  # catalog-wide aggregate counts as deliberate design — Directory levels 1/2 ARE catalog-wide aggregate counts (entities_count per ODDRN-prefix; per-data-source entitiesCount)
related_concepts:
  - directory
  - oddrn
related_sidecars:
  - odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController  # PRIOR sidecar (v0.1.0, controller-axis); this sidecar (v0.3.0, controller-class axis under rev-2) refreshes + adds page-vs-count divergence
  - odd-platform__java__repository__reactive__repository__ReactiveDataSourceRepositoryImpl  # batch R — listDto sibling (which Directory does NOT use; cross-link present to disambiguate divergence sites)
  - odd-platform__java__repository_reactive__repository__ReactiveDataEntityRepositoryImpl  # the repository whose listByDatasourceAndType / countByDatasourceAndType divergence is the level-4 finding of this batch
  - odd-platform__java__service__service__DataEntityServiceImpl  # the service tier that consumes the divergent pair on the Directory level-4 path
coherence_check:
  performed: true
  strengthens:
    - target: REFACTOR-024
      target_drift_facet: cross_owner_read_family
      note: |
        Directory adds a FIFTH+ enumeration vector to the cross-owner read
        posture family. Prior batches enumerated:
          - Batch B: AlertController.getAllAlerts (batch alert read)
          - Batch H: ReactiveAlertRepositoryImpl SQL site
          - Batch L: DataEntityController.getDataEntityAlerts (per-entity alerts)
          - Batch E: SearchController.search (per-entity catalog enumeration)
          - Batch M: SearchController facet aggregator (catalog cardinality)
          - Batch F/L: lineage/DEG enumeration (REFACTOR-203/343)
        Directory's shape is DISTINCT and BROADER in ONE dimension: it
        enumerates the DATASOURCE INVENTORY itself (every registered
        DataSource's ODDRN, host, database, prefix) plus the per-type/per-source
        entity counts. An attacker who can authenticate but has NO owner
        binding learns "platform XYZ runs N Postgres clusters at hosts
        pg-prod-01.internal / pg-prod-02.internal, M Snowflake accounts at
        ..., K Kafka clusters at ..." — internal-infrastructure cardinality
        plus hostnames. NO other read surface in the cross-owner family
        exposes this datasource-cardinality dimension.

        Cross-link to ADR-CANDIDATE-003 (read-collaborative-GET): if the
        decision IS intentional, the live `data-discovery/directory` doc
        page (WebFetched 2026-05-20, status 200) MUST disclose that the
        Directory is an unscoped reconnaissance surface — currently the
        page says NOTHING about authorization, ownership, or visibility.
    - target: REFACTOR-203
      target_drift_facet: graph_vs_flat_enumeration_family
      note: |
        REFACTOR-203 is the GRAPH-SHAPED enumeration vector (lineage edges
        leak pipeline topology); Directory is the FLAT-LIST enumeration
        sibling — no edges, but a fully-walkable inventory: every datasource,
        ODDRN, host, database, prefix, plus per-entity-type counts. The
        two together exhaust the catalog-shape enumeration surface:
        graph-via-lineage (REFACTOR-203) + flat-via-directory (this sidecar).
        Combined effect: an attacker who can authenticate enumerates BOTH
        the topology (REFACTOR-203) AND the inventory roster (Directory).
    - target: REFACTOR-185
      target_drift_facet: disabled_mode_reachability
      note: |
        REFACTOR-185 (19-SIDECAR strongest) codifies the auth.type=DISABLED
        bypass. Directory is a FRESH manifestation: with DISABLED on, ALL
        FOUR Directory endpoints become unauthenticated reconnaissance.
        The reflection-based `getOddrnProperties` (DirectoryServiceImpl.java:138-171)
        means an unauthenticated caller in a DISABLED deployment can pull
        EVERY datasource's host / database / port / cluster property — the
        DISABLED-mode blast radius widens because the leaked payload is
        infrastructure-revealing, not just metadata-revealing.
    - target: REFACTOR-024
      target_drift_facet: directory_reflection_oddrn_property_leak
      note: |
        DirectoryServiceImpl.java:138-171 uses Java reflection over the
        ODDRN PathField annotation set to emit EVERY datasource-side ODDRN
        property: for a PostgreSQL datasource that is `host`, `database`,
        `port` (when set); for Snowflake that adds `account`, `warehouse`;
        for Kafka adds `cluster`, `topic`. NO redaction step, NO allow-list,
        NO per-property visibility gate. An attacker with no Owner binding
        gets the FULL ODDRN-derived infrastructure map of the catalog.
  reinforces: []
  supersedes: []
  conflicts_surfaced:
    - kind: page_vs_count_predicate_divergence
      target: getDatasourceEntities (Directory level 4)
      severity: MEDIUM
      note: |
        **NEW finding — STRUCTURALLY ANALOGOUS to REFACTOR-425 but at a
        DIFFERENT site.** `DirectoryController.getDatasourceEntities` (line
        37-44) delegates to `DataEntityServiceImpl.getDataEntitiesByDatasourceAndType`
        (DataEntityServiceImpl.java:164-179) which composes the page query
        via `reactiveDataEntityRepository.listByDatasourceAndType(datasourceId,
        typeId, page, size)` (line 170) with the count query via
        `reactiveDataEntityRepository.countByDatasourceAndType(datasourceId,
        typeId)` (line 173). The two queries use DIFFERENT predicate sets:

          PAGE path (ReactiveDataEntityRepositoryImpl.java:595-613):
            - `cteConditions` includes only `DATA_SOURCE_ID = ?` (+ optional
              `TYPE_ID = ?`).
            - `baseDimensionsSelect → cteDataEntitySelect` (lines 909-939)
              adds `addSoftDeleteFilter(...)` (deleted_at IS NULL,
              `STATUS != DELETED` — derived from `getDeleteChangedFields`
              override at lines 110-116 + the `addSoftDeleteFilter` override
              at lines 118-122) PLUS `DATA_ENTITY.HOLLOW.isFalse()` (line 918).
            - **Missing**: `DATA_ENTITY.EXCLUDE_FROM_SEARCH.isNull()
              OR .isFalse()` (the third filter from `getDataEntityDefaultConditions`
              at lines 970-976).

          COUNT path (ReactiveDataEntityRepositoryImpl.java:616-627):
            - `getDataEntityDefaultConditions()` returns THREE conditions:
              `HOLLOW.isFalse()` + `STATUS != DELETED.getId()` + `EXCLUDE_FROM_SEARCH
              IS NULL or = FALSE`. The page path applies the first two but
              NOT the third.

        **Operator surface manifestation**: any DataEntity with
        `EXCLUDE_FROM_SEARCH = TRUE` (a flag the platform sets on certain
        entities — e.g. transformer runs that should not appear in search
        results) will be RETURNED by the page query but NOT COUNTED by the
        count query. UI renders "X of Y entities" where X > Y is possible,
        AND a `page=2` request can return rows that "shouldn't exist"
        according to the count. The bug is INVISIBLE for catalogs whose
        per-datasource entities are all `EXCLUDE_FROM_SEARCH = FALSE`
        (the common case); manifests in deployments using `EXCLUDE_FROM_SEARCH`
        to hide intermediate entities (runs, transient inputs, hollow
        placeholders).

        **Cross-cutting bug class**: PREDICATE-DIVERGENCE-IN-PAGINATION-WRAPPERS,
        same root pattern as REFACTOR-425 (which targets
        `ReactiveDataSourceRepositoryImpl.listDto`'s page-vs-count). The
        bug class is now confirmed at TWO sites; an audit sweep across
        all repository `list*/count*` pairs in the codebase is the
        defensible follow-up.

        **The fix is small** — align the predicate sets. Recommended:
        update `cteDataEntitySelect` (or `listByDatasourceAndType`
        specifically) to apply `EXCLUDE_FROM_SEARCH` filter, matching
        `getDataEntityDefaultConditions`. Alternative: drop
        `EXCLUDE_FROM_SEARCH` from the count predicate (matches existing
        page behaviour but changes the count semantics — riskier).

        Filed as REFACTOR-NEW (Directory level-4 page-vs-count divergence;
        recommend grouping with REFACTOR-425 in a "pagination-wrapper
        predicate audit" sprint).
  back_links_emitted_to:
    - F-008  # producer side — Directory enumerates what F-008 ingests; same datasource registration surface
    - REFACTOR-024  # +1 enumeration vector (datasource inventory + ODDRN-derived infrastructure)
    - REFACTOR-203  # flat-list sibling to graph-shaped enumeration
    - REFACTOR-425  # second site of page-vs-count predicate divergence bug class
  stale_probe_check:
    performed: true
    note: |
      The prior sidecar at the controller-axis (v0.1.0, session-2026-05-08-01,
      enriched_at_commit ede5d277) recorded the cross-owner / no-pagination
      / reflection-leak findings at HIGH-MEDIUM severity. This sidecar
      (controller-class axis under rev-2, enriched_at_commit 9ac6436e)
      RE-VERIFIES at primary source: source content unchanged between
      ede5d277 and 9ac6436e (file is identical at the line ranges cited);
      live doc URL (`/features/data-discovery/directory`) and API-ref URL
      (`/developer-guides/api-reference/directory`) both still 200; both
      pages still silent on authorization / owner-scoping / pagination
      semantics. Prior findings stand.

      NEW in this sidecar (not in prior): the page-vs-count predicate
      divergence at level 4 — `listByDatasourceAndType` (HOLLOW + soft-delete)
      vs `countByDatasourceAndType` (HOLLOW + STATUS != DELETED +
      EXCLUDE_FROM_SEARCH) — was MISSED by the v0.1.0 sidecar because the
      analysis did not walk into the underlying repository methods. The
      v0.3.0 sidecar is the SUPERSET; the v0.1.0 controller-axis sidecar
      should be marked STALE-but-not-deleted (its content remains
      historically valid).
---

# DirectoryController — semantic understanding

## understanding

`DirectoryController` is the REST entry-point for the Directory feature — the catalog's hierarchy-driven browse surface complementing Search's query-driven flat results. It is a thin reactive WebFlux adapter (52 lines, four endpoints) implementing the OpenAPI-generated `DirectoryApi` interface and forwarding each call to either `DirectoryService` (levels 1, 2, 3) or `DataEntityService` (level 4). The Directory's load-bearing design choice is grouping by ODDRN prefix: level 1 returns one entry per distinct ODDRN-prefix observed across registered datasources (with sources whose ODDRN cannot be parsed bucketed under the `Other`/UNKNOWN_DATASOURCE_TYPE sentinel), and each subsequent level narrows the scope. All four endpoints are GET-only, reactive (`Mono`/`Flux`), unpaginated at levels 1-3 and mandatorily-paginated at level 4.

## concepts

- entities: ["Data Source Type (ODDRN-prefix bucket)", "Data Source (registered)", "Data Entity Type", "Data Entity", "ODDRN"]
- operations:
  - "list-data-source-types-with-counts"  # level 1: GET /api/directory
  - "list-data-sources-by-prefix"  # level 2: GET /api/directory/datasources?prefix={...}
  - "list-data-entity-types-within-datasource"  # level 3: GET /api/directory/datasources/{id}/types
  - "list-data-entities-by-datasource-and-type-paged"  # level 4: GET /api/directory/datasources/{id}?type_id=&page=&size=
- invariants:
  - "Routes are GET-only and live under /api/directory; the Directory is read-only navigation, not mutation"
  - "Level 1 groups by ODDRN prefix; sources whose ODDRN cannot be parsed bucket under `Other` (UNKNOWN_DATASOURCE_TYPE sentinel from OddrnUtils.java:7)"
  - "Level 2 requires a prefix query param; passing the literal `other` triggers the unknown-ODDRN bucket scan (DirectoryServiceImpl.java:91-99)"
  - "Level 4 requires page and size (mandatory @NotNull per openapi.yaml:3810-3811 `PageParam`/`SizeParam`); type_id is optional"
  - "All four endpoints return Mono<ResponseEntity<...>> wrapping the service's reactive payload; .map(ResponseEntity::ok) is the uniform success-wrap pattern"
  - "Controller carries NO @PreAuthorize annotation; NO entry in SecurityConstants.SECURITY_RULES; falls through to the global authenticated() gate (read-collaborative posture)"
- audiences:
  - "odd-platform-ui-end-user (the React Directory page consumes all four endpoints)"
  - "odd-api-consumer (any programmatic client of the four GET routes)"

## dependencies_semantic

- requires-feature:
  - "ODDRN parsing — `Generator.parse(...)` from `oddrn-generator` library (DirectoryServiceImpl.java:25-27,43,103,114); failure-tolerant via try/catch fallback to UNKNOWN_DATASOURCE_TYPE"
  - "Data-source registration (F-008 producer side) — `getDataSourceTypes` is meaningful only when datasources exist; an empty platform returns an empty type list"
  - "Data-entity ingestion (F-008 producer side) — entitiesCount fields populate from `ReactiveDataEntityRepository.getCountByDataSources()` (DirectoryServiceImpl.java:47)"
  - "DataEntityType enum catalog (in-memory) — `DataEntityTypeDto.findById(id)` translates int-IDs from the repository to canonical enum values (DirectoryServiceImpl.java:124-127)"
- requires-config: []
- requires-runtime:
  - "Spring WebFlux runtime (Mono/Flux/ServerWebExchange — DirectoryController.java:13-15)"
  - "Reactive PostgreSQL via jOOQ + R2DBC (transitively via DirectoryService and DataEntityService)"
- couplings:
  - "Two-service composition unique to this controller: DirectoryService for levels 1/2/3 (DirectoryController.java:20) AND DataEntityService for level 4 (DirectoryController.java:21,42) — the split-service pattern is controller-only"
  - "Generated DirectoryApi interface (OpenAPI codegen output, NOT present in the source tree at HEAD — generated under odd-platform-api/build/generated/...); controller implements four `@Override` methods of the generated interface (DirectoryController.java:19,23,29,36,46)"

## tests_coverage_semantic

- covered_behaviours:
  - "GET /api/directory returns DataSourceTypeList grouped by ODDRN prefix (Postgres + Other) with correct entitiesCount totals — `DirectoryTest.directoriesTest` lines 57-67"
  - "GET /api/directory/datasources?prefix=postgresql returns DataSourceDirectoryList with per-source ODDRN-derived properties (host, database) — DirectoryTest.java:70-77, 141-149"
  - "GET /api/directory/datasources?prefix=other returns sources whose ODDRN cannot be parsed, with properties={oddrn: <raw>} — DirectoryTest.java:79-85, 151-158"
- uncovered_behaviours:
  - "GET /api/directory/datasources/{id} (level-4 paged entities) — NO DirectoryTest assertion exists for `getDatasourceEntities`; pagination semantics (page/size mandatory, type_id optional) are untested at the Directory layer"
  - "GET /api/directory/datasources/{id}/types — NO DirectoryTest assertion exists for `getDatasourceEntityTypes`; the `DataEntityTypeDto.findById` NotFoundException path is unverified end-to-end"
  - "Page-vs-count predicate divergence on level 4 — no test injects entities with `EXCLUDE_FROM_SEARCH=TRUE` then asserts list-size vs count-total parity; the new finding (coherence_check.conflicts_surfaced.[0]) is invisible to the existing suite"
  - "Authorization behaviour — DirectoryController has no @PreAuthorize; no test asserts that anonymous (DISABLED) or low-privilege users can/cannot browse the directory"
  - "Error-path: malformed ODDRN crashing the response (rather than falling back to UNKNOWN_DATASOURCE_TYPE) — `getDataSourcePrefix` swallows all exceptions but no test injects a crashing ODDRN"
  - "Concurrency: two simultaneous Directory hits during an active ingestion batch (the count and the page may see different soft-delete states); not exercised"
  - "Empty-bucket: a prefix-group with zero data sources — `getFirstDataSource` would throw `IllegalArgumentException` (DirectoryServiceImpl.java:173-178); no test exercises this branch"
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DirectoryTest.java:30-159 (integration test extending BaseIngestionTest; covers levels 1 + 2 only)"
- gaps: |
    A regression in pagination semantics at level 4 (off-by-one, type_id
    filter ignored, page-vs-count divergence widening) would NOT be caught.
    A regression in the ODDRN reflection-property extractor (e.g. a new
    OddrnPath subclass adds a sensitive field that should not surface in
    the Directory response) would NOT be caught. An authorization regression
    (a future @PreAuthorize added or removed; SecurityConstants entry
    added or removed; auth.type wiring changed) has no coverage at all.
    The new page-vs-count predicate divergence (EXCLUDE_FROM_SEARCH
    handled inconsistently between listByDatasourceAndType and
    countByDatasourceAndType) is the most operationally-likely regression
    site — it has no test today.

## docs_link_semantic

- declared_docs: []  # no @docs annotation in the source
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/directory"
    anchor: ""
    rationale: "Canonical Directory feature page in the live docs site; describes the four-level drill-down. Verified live in this session."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetched 2026-05-20:
      "Level 1 — Data source types: One card per ODDRN prefix that the platform's
       registered data sources resolve to (postgresql, snowflake, kafka, airflow,
       mysql, ...)"
      "Level 2 — Data sources: Lists registered instances with name, ODDRN-derived
       properties (host, port, database, ...), and per-source entity count"
      "Level 3 — Entity types: Shows distinct Data Entity classes present in the
       chosen data source"
      "Level 4 — Entities: The final tier displays the paged list of data entities
       matching both filters"

      Notable gaps in the live page (verified by WebFetch 2026-05-20):
      - No mention of authorization, owner-scoping, or visibility rules.
      - No mention of who can see what data.
      - No mention of unknown/unrecognized ODDRN prefixes (no "Other" bucket discussed).
      - No detailed pagination mechanics beyond "paged list".
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/directory"
    anchor: ""
    rationale: "Canonical API-reference page for the four endpoints. Verified live in this session."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetched 2026-05-20:
      "GET /api/directory — getDataSourceTypes — list every ODDRN-prefix that
       has at least one registered data source, with display name and entity count"
      "GET /api/directory/datasources?prefix={type-prefix} — getDirectoryDatasourceList —
       list registered data sources for the given prefix; each result carries the
       source's ODDRN-derived properties and per-source entity count"
      "GET /api/directory/datasources/{data_source_id}/types — getDatasourceEntityTypes —
       list DataEntityType values present in the given data source"
      "GET /api/directory/datasources/{data_source_id}?type_id={type-id}&page={n}&size={m}
       — getDatasourceEntities — paged list of entities of the chosen type within the
       chosen data source. Delegates to DataEntityService."

      Notable gap: the api-reference/directory page does NOT mention authorization
      requirements, pagination semantics beyond `page`/`size` names, an "Other"
      bucket for unknown ODDRNs, or a level-by-level walkthrough table.
  - url: "https://docs.opendatadiscovery.org/data-discovery/directory"
    anchor: ""
    rationale: "Legacy URL recorded by the v0.1.0 sidecar (2026-05-08). At that time was a 404; the canonical URL has since moved to /features/data-discovery/directory. Re-checking this URL in this session was deferred — the 200 on the canonical /features/... path is sufficient evidence."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Per v0.1.0 sidecar: 404 Not Found; suggested canonical URL
      "https://docs.opendatadiscovery.org/features/data-discovery/directory" instead.
- doc_drift_findings:
  - "The Directory feature doc page (`/features/data-discovery/directory`, 200 in this session) contains NO mention of authorization, owner-scoping, pagination semantics at level 4, the `Other` bucket for unknown ODDRNs, or scaling behaviour. Yet the endpoint exposes the full registered-data-source inventory and is unscoped by ownership at the controller layer. Operators reading the docs are NOT warned that the Directory is a non-owner-scoped, infrastructure-revealing reconnaissance view of every registered data source." — severity: MEDIUM
  - "The level-3 doc copy uses 'Distinct Data Entity CLASSES' but the code returns `DataEntityType` (TABLE/FILE/STREAM/...). In ODD's vocabulary `DataEntityClass` is a SEPARATE dimension (Set/Transformer/Quality Test/...). Operators familiar with the distinction may mis-interpret the level-3 surface. (Carried from v0.1.0 sidecar; still applicable at HEAD.)" — severity: LOW
  - "The level-4 page-vs-count predicate divergence (this batch's new finding) creates a UI-visible artefact — 'X of Y entities' where X > Y for datasources containing entities with EXCLUDE_FROM_SEARCH=TRUE — that the docs do NOT acknowledge. A bug-fix DOC-NNN follow-up should explain the EXCLUDE_FROM_SEARCH semantic in the Directory page (or fix the divergence first then update if needed)." — severity: LOW

## implicit_adrs

- "Directory and Search are intentionally separate browse interfaces — Directory is hierarchy-driven, Search is query-driven; no shared controller, no shared DTO, no shared route prefix between them." — evidence: DirectoryController.java:17-52 (separate @RestController, separate /api/directory route prefix via the generated DirectoryApi) + the parallel SearchController (separate /api/search route prefix). The two surfaces are deliberately split. — intent_anchor: openapi.yaml:43 declares `directory` as its own OpenAPI tag distinct from `search`; the doc page (live, 2026-05-20) frames them as complementary not redundant ("Where Search is query-driven … the Directory is hierarchy-driven"). — confidence: HIGH
- "Directory navigation is on-demand per level rather than fetching the full tree at once: four endpoints, each returning one level, with the next level fetched only when the user drills in." — evidence: openapi.yaml:3745-3820 (four separate GET routes for types / sources-by-prefix / entity-types-by-source / entities-by-source-and-type). — intent_anchor: openapi.yaml:3745-3820 four-route decomposition (a single composite endpoint would also satisfy the UI's needs but at higher cost — the decomposition IS the design). — confidence: HIGH
- "ODDRN prefix is the canonical grouping key for data-source-type aggregation; sources whose ODDRN cannot be parsed are bucketed under a single `Other` (UNKNOWN_DATASOURCE_TYPE) sentinel rather than being hidden or erroring." — evidence: DirectoryServiceImpl.java:33 (UNKNOWN_DATASOURCE_TYPE static import) + DirectoryServiceImpl.java:101-110 (`getDataSourcePrefix` catches Exception, returns UNKNOWN_DATASOURCE_TYPE) + OddrnUtils.java:7 (`UNKNOWN_DATASOURCE_TYPE = "other"` constant) + DirectoryTest.java:42-43, 79-85 (test asserts both `oddplatform/host` and `unknown/odd` ODDRNs are bucketed under `other`). — intent_anchor: OddrnUtils.java:7 defines the sentinel as a public constant (`public static final String UNKNOWN_DATASOURCE_TYPE = "other"`), and DirectoryServiceImpl.java:107 explicitly logs the parse failure (`log.error("Error while extracting ODDRN prefix for oddrn {}", oddrn, e); return UNKNOWN_DATASOURCE_TYPE;`) — the fall-back is intentional and observable. — confidence: HIGH
- "Pagination at the entity-list level is mandatory; the type filter is optional — the Directory always pages, never streams, the entity list." — evidence: openapi.yaml:3810-3811 (`PageParam`/`SizeParam` referenced as $ref — these parameters carry `required: true` per the central components.yaml definition) + openapi.yaml:3805-3809 (`type_id` is declared without `required: true`, defaulting to optional). — intent_anchor: openapi.yaml:3810-3811 explicit `$ref` to PageParam/SizeParam (the platform's central required-pagination convention; the controller relies on the OpenAPI-validator-generated check rather than re-validating in code). — confidence: HIGH
- "Directory endpoints carry no controller-level authorization annotations; access control, where present, is enforced at the framework/global-security-config level rather than per-route." — evidence: DirectoryController.java:1-52 (only @RestController + @RequiredArgsConstructor; no @PreAuthorize anywhere on the class or methods). — intent_anchor: the controller is a pass-through delegate to services; the canonical wiring pattern across the platform is to gate mutating routes via SecurityConstants.SECURITY_RULES path-pattern entries — Directory has no mutating routes, hence no entries, by design. — confidence: HIGH
- "GET endpoints are uniformly outside SecurityConstants.SECURITY_RULES — only mutating routes (POST/PUT/DELETE/PATCH) carry per-route Permission gates; reads fall through to the global authenticated() rule." — evidence: SecurityConstants.java (grep `/api/directory` returns ZERO matches; grep of all SECURITY_RULES entries confirms only mutating methods are listed — POST/PUT/DELETE/PATCH lines 109-310). — intent_anchor: the architecture choice is consistent across the platform — read paths are the read-collaborative-catalog posture (ADR-CANDIDATE-003); Directory is the flat-list instance of that posture. — confidence: HIGH
- "DataEntityType (not DataEntityClass) is the level-3 grouping primitive; the Directory pivots on the TYPE dimension (TABLE/FILE/STREAM/JOB/MODEL/...) rather than the CLASS dimension (Set/Transformer/Quality Test/...)." — evidence: DirectoryController.java:5,47 (`DataEntityType` imported; `getDatasourceEntityTypes` returns `Flux<DataEntityType>`) + DirectoryServiceImpl.java:124-127 (`DataEntityTypeDto.findById(id)` maps the per-source TYPE-id roster). — intent_anchor: ReactiveDataEntityRepository.java:110 (`Flux<Integer> getDataSourceEntityTypeIds(...)`) — the underlying query selects DISTINCT TYPE_ID values; the level-3 surface IS the type-axis projection. — confidence: HIGH

## bugs_limitations_corner_cases

- "**LEVEL 4 page-vs-count predicate divergence — STRUCTURALLY ANALOGOUS to REFACTOR-425, distinct site.** `DataEntityServiceImpl.getDataEntitiesByDatasourceAndType` (DataEntityServiceImpl.java:164-179) composes the page query via `listByDatasourceAndType` and the count query via `countByDatasourceAndType`. The two queries use DIFFERENT predicates: the page query (via `cteDataEntitySelect` at ReactiveDataEntityRepositoryImpl.java:909-939) applies HOLLOW + soft-delete only; the count query (line 616-627) applies `getDataEntityDefaultConditions()` which adds `EXCLUDE_FROM_SEARCH IS NULL or = FALSE`. Result: in a datasource containing entities with `EXCLUDE_FROM_SEARCH = TRUE`, the page returns rows the count does NOT include — UI sees `pageData.size > count.total`, pagination math breaks (page 2 returns rows that 'shouldn't exist'). Recommended remedy: align both predicates by adding EXCLUDE_FROM_SEARCH to the CTE page filter (or removing it from the count). Filed as REFACTOR-NEW; recommend grouping with REFACTOR-425 in a pagination-predicate-audit sprint." — evidence: DirectoryController.java:42 + DataEntityServiceImpl.java:164-179 + ReactiveDataEntityRepositoryImpl.java:595-613, 616-627, 909-939, 970-976 — severity: MEDIUM
- "`DirectoryServiceImpl.getDataSourceTypes` loads ALL data sources via `dataSourceRepository.list()` (no pagination), then groups them in memory by ODDRN prefix. For a platform with tens of thousands of registered data sources this becomes an O(n) memory + parsing cost on every Directory landing-page hit." — evidence: DirectoryServiceImpl.java:48-50 — severity: MEDIUM
- "`getDataSourcePrefix` and `getDataSourceName` swallow ALL exceptions (`catch Exception`) and return UNKNOWN_DATASOURCE_TYPE; a transient ODDRN parser bug or a malformed-but-recoverable ODDRN would silently land in the `Other` bucket rather than surfacing. Operators investigating 'why is my Postgres source under Other?' have only the error log to go on (DirectoryServiceImpl.java:107 logs the exception, but no metric, no alert, no UI signal)." — evidence: DirectoryServiceImpl.java:101-110, 112-122 — severity: MEDIUM
- "`getDataSourceTypes` assumes every prefix-group has at least one data source; `getFirstDataSource` throws `IllegalArgumentException` on empty (DirectoryServiceImpl.java:173-178). True today because the multimap only contains keys with values, but a future refactor introducing empty groups would surface as a 500 from `/api/directory` rather than an empty type entry." — evidence: DirectoryServiceImpl.java:51-62 (calls `getFirstDataSource` without an empty-check) + DirectoryServiceImpl.java:173-178 — severity: LOW
- "`getOddrnPathProperties` (DirectoryServiceImpl.java:153-171) uses Java reflection (`getDeclaredFields` + `getMethod` `get` + invoke) on every data-source row in `/api/directory/datasources`. The reflection is unmemoised — per request, per data source, the `@PathField`-annotated field set is re-discovered and the getter Method is re-resolved." — evidence: DirectoryServiceImpl.java:153-171 — severity: LOW
- "`getDatasourceEntityTypes` throws `NotFoundException` when `DataEntityTypeDto.findById` fails for an id returned by the repository — a server-side data-integrity error masquerading as a client-facing 404 ('Data entity type'). The error message is the same as if the user requested a missing resource." — evidence: DirectoryServiceImpl.java:124-127 — severity: LOW
- "No pagination at level 1 (`/api/directory`) or level 2 (`/api/directory/datasources?prefix=...`). For a platform with thousands of data sources of the same type (e.g. 5K Postgres sources), the level-2 response carries 5K rows + reflection-extracted properties per row. The frontend has no chunking mechanism." — evidence: openapi.yaml:3745-3779 (no page/size on level-1 or level-2 routes) + DirectoryServiceImpl.java:65-82 — severity: MEDIUM
- "No HTTP caching, no ETag, no `@Cacheable` on any Directory endpoint, despite the data being read-mostly (data-source registrations change rarely; entity counts change at ingestion cadence). Every UI navigation re-runs the full DB + grouping pipeline." — evidence: DirectoryController.java:23-51 + DirectoryServiceImpl.java:39-89 — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — the four Directory endpoints sit on the UI/API surface; whichever of the three authenticated modes is active gates them. Under `auth.type=DISABLED` (per the live `enable-security` doc framed as dev-only), Directory is OPEN to any caller able to reach the HTTP port — and the controller has no fail-closed second-line gate. — evidence: DirectoryController.java:17-52 (no `@ConditionalOnProperty(value="auth.type", ...)` — all four authenticated modes route here) + SecurityConstants.java (`/api/directory*` not in any path matcher, so no rule-level whitelisting needed; the catch-all `.authenticated()` is the only gate — and DISABLED skips it).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. All four Directory endpoints are GET routes under `/api/directory`; the `IngestionDataEntitiesFilter` operates on `POST /ingestion/entities`. — evidence: openapi.yaml:3745-3820 (GET only) + the IngestionDataEntitiesFilter sidecar (batch O) confirms it matches `/ingestion/entities` only.
- **authorization_assertions**: `[]` — NO `@PreAuthorize` annotations on the controller class or any of its four methods; NO programmatic `permissionService.hasPermission(...)` calls; NO entry in `SecurityConstants.SECURITY_RULES` matching `/api/directory*` (`SECURITY_RULES` gates only mutating routes — POST/PUT/DELETE/PATCH — across the entire platform; all four Directory endpoints are GETs, so they fall through to the global `authenticated()` rule). — evidence: DirectoryController.java:1-52 (no Spring Security annotations) + SecurityConstants.java (grep `/api/directory` returns zero matches).
- **owner_scoping**: `BYPASSES — returns data across owners (no owner filter)`. All four Directory endpoints return platform-wide aggregates with NO filtering by the current user's Owner identity: `getDataSourceTypes` lists every registered data source via unfiltered `dataSourceRepository.list()`; `getDirectoryDatasourceList(prefix)` returns every data source matching the prefix; `getDatasourceEntities` pages every entity in the datasource regardless of ownership; `getDatasourceEntityTypes` returns every type-id present in the datasource. The Directory is a **non-owner-scoped view of the whole catalog inventory** — any authenticated user (under LOGIN_FORM/OAUTH2/LDAP) enumerates every registered datasource's name, ODDRN, host, database, port, plus per-prefix and per-source entity counts. — evidence: DirectoryServiceImpl.java:48 (unfiltered `dataSourceRepository.list()`), 91-99 (unfiltered `findByPrefix`), 86 (`getDataSourceEntityTypeIds(dataSourceId)` with no owner arg) + DirectoryController.java:42 (`dataEntityService.getDataEntitiesByDatasourceAndType` called without principal context).
- **data_exposure**:
  - "Data-source-type inventory (count by ODDRN-prefix, prefix display name, total entitiesCount per prefix) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP, no owner filter applied" — evidence: DirectoryServiceImpl.java:46-63 + DirectoryController.java:24-27.
  - "Per-data-source detail (name, ODDRN, ODDRN-derived properties — `host`, `database`, `port`, `account`, `warehouse`, `cluster`, `topic`, ... — and per-source entitiesCount) → any authenticated user, no owner filter" — evidence: DirectoryServiceImpl.java:65-82 (`getDirectoryDatasourceList`) + DirectoryServiceImpl.java:138-171 (`getOddrnProperties` reflects EVERY `@PathField`-annotated property on the OddrnPath subclass).
  - "Per-data-source entity-type roster (TABLE/FILE/STREAM/JOB/MODEL/...) → any authenticated user, no owner filter" — evidence: DirectoryServiceImpl.java:84-89.
  - "Per-data-source entity list paged (Data Entity payloads with names, types, descriptions, ODDRNs, ownerships) → any authenticated user, no Directory-layer owner filter; whatever filtering `DataEntityService.getDataEntitiesByDatasourceAndType` applies is the only gate (and per `ReactiveDataEntityRepositoryImpl.listByDatasourceAndType` lines 595-613, it applies HOLLOW + soft-delete only — no owner scoping)" — evidence: DirectoryController.java:36-44 + DataEntityServiceImpl.java:164-179 + ReactiveDataEntityRepositoryImpl.java:595-613.
  - "When `auth.type=DISABLED`, every above payload is exposed unauthenticated to any caller able to reach `/api/directory*`" — evidence: WebFetched enable-security page recordings from prior sessions framing DISABLED as dev-only.
- **known_security_gaps**:
  - "**Reconnaissance surface**: an authenticated user with NO Permissions and NO Owner association still enumerates every registered datasource's ODDRN, host, database, port, per-type entity count via `GET /api/directory` and `GET /api/directory/datasources?prefix={...}`. Whether intentional (catalog is by-design world-readable for any authenticated principal per ADR-CANDIDATE-003) or a finding (per-data-source visibility should be owner-gated) is an unresolved policy question — the live `data-discovery/directory` doc page does NOT warn operators. Severity is elevated by the ODDRN-property leak: the reflection-based extractor emits internal hostnames + database names + port numbers." — evidence: DirectoryController.java:17-52 + DirectoryServiceImpl.java:46-99,138-171 + WebFetch `/features/data-discovery/directory` 2026-05-20 (no mention of authorization, ownership, or visibility) — severity: MEDIUM
  - "**No fail-closed per-route gate**: DirectoryController has NO `@PreAuthorize` and NO entry in `SecurityConstants.SECURITY_RULES`; authorization is delegated entirely to the global SecurityFilterChain's blanket `authenticated()` rule. A regression that loosens the global filter (e.g. accidentally permits-all on a path matcher) would silently make `/api/directory*` open. There is no per-route defence-in-depth gate." — evidence: DirectoryController.java:1-52 + SecurityConstants.java (grep `/api/directory` = zero matches; SECURITY_RULES is mutating-method-only per existing concept `authorization-is-path-pattern-wired-in-securityconstants-security-rules-not-controller-annotations`) — severity: LOW
  - "**ODDRN-property reflection leak**: `getOddrnProperties` emits EVERY `@PathField`-annotated property on the OddrnPath subclass (Postgres → host + database + port; Snowflake → account + warehouse + database + schema; Kafka → cluster + topic). NO allow-list, NO redaction step, NO per-deployment opt-out. Deployments that intentionally avoid exposing internal hostnames in the UI still leak them via the Directory level-2 response." — evidence: DirectoryServiceImpl.java:153-171 + DirectoryTest.java:141-149 (test asserts `host` and `database` in the response — confirming the leak is the intended payload shape) — severity: LOW (rises to MEDIUM in deployments with hostname-sensitivity policies)
  - "**auth.type=DISABLED reachability**: under DISABLED (dev-only per docs), the Directory becomes an unauthenticated read of the entire data-source inventory PLUS the ODDRN-derived infrastructure map. Any operator running DISABLED on a non-localhost reachable port ships an open reconnaissance endpoint. Cross-link REFACTOR-185 (19-SIDECAR strongest)." — evidence: SecurityConstants.java (no whitelist for `/api/directory*`; DISABLED skips auth chain entirely per existing concept `ui-vs-api-asymmetry-under-disabled-ui-hides-mutation-buttons-backend-accepts-anonymous`) + DirectoryController.java:1-52 (no `@ConditionalOnProperty` fail-closed gate) — severity: LOW (DISABLED is dev-only per docs; rises if deployed in production)

## performance

- **hot_paths**:
  - "`GET /api/directory` (`getDataSourceTypes`) fires on every navigation to the `/directory` UI route — the landing page of the Directory feature. The handler runs `dataSourceRepository.list()` (full scan, no pagination) AND `dataEntityRepository.getCountByDataSources()` (aggregate count across all sources) on every hit; both cross-DB round-trips run in parallel via `Mono.zip`, but the in-memory grouping/parsing cost grows linearly with data-source count." — evidence: DirectoryServiceImpl.java:46-63.
  - "`GET /api/directory/datasources?prefix={...}` fires on every type-card click. The handler runs `findByPrefix(prefix)` then `getCountByDataSources(ids)` (per-source-id count), then runs reflection-based ODDRN-property extraction on every returned source." — evidence: DirectoryServiceImpl.java:65-82, 138-171.
  - "`GET /api/directory/datasources/{id}` fires on every entity-type drill-down click; delegates to `DataEntityService.getDataEntitiesByDatasourceAndType` which paginates at the DB level (page/size are mandatory) — BUT the page query and count query use DIFFERENT predicates (see security/correctness finding above)." — evidence: DirectoryController.java:36-44 + DataEntityServiceImpl.java:164-179.
- **throughput_characteristics**:
  - "All four endpoints are reactive (Mono/Flux signature) — non-blocking, but each call still incurs at least one DB round-trip. No batching, no caching layer in front of `DirectoryServiceImpl`." — evidence: DirectoryController.java:14-15,23-51 + DirectoryServiceImpl.java:46-89.
  - "`getDataSourceTypes` and `getDirectoryDatasourceList` return ALL matching items in a single response — no pagination on the type-card list or the per-prefix data-source list. Only the entity-leaf endpoint paginates." — evidence: openapi.yaml:3745-3779 (no page/size on level-1 or level-2 routes); openapi.yaml:3810-3811 (page/size on level 4).
  - "`getDatasourceEntityTypes` returns `Flux<DataEntityType>` — streaming-shaped on the wire but the underlying `getDataSourceEntityTypeIds` returns the full id set in one DB query, then `DataEntityTypeDto.findById` is an in-memory enum lookup." — evidence: DirectoryServiceImpl.java:84-89 + DirectoryServiceImpl.java:124-127 + ReactiveDataEntityRepositoryImpl.java:809-817.
- **resource_allocation**:
  - "`getDataSourceTypes` collects the full data-source list into a `Map<String, Collection<DataSourcePojo>>` multimap in memory before producing the response. Memory cost is O(N) in registered-data-source count; for a platform with 10K+ data sources this is non-trivial." — evidence: DirectoryServiceImpl.java:48-50.
  - "`getOddrnProperties` uses Java reflection (Field/Method/invoke) on every data-source row in the per-prefix listing. Reflection is unmemoised — each request re-walks the `@PathField`-annotated fields and re-resolves the getter Method." — evidence: DirectoryServiceImpl.java:153-171.
  - "DB round-trips per request: level 1 = 2 (zipped); level 2 = 2 (sequential); level 3 = 1; level 4 = 2 (list + count) — and level 4's count + page run different predicates (correctness concern AND a performance shape worth recording)." — evidence: DirectoryServiceImpl.java:46-89 + DataEntityServiceImpl.java:164-179.
- **scaling_characteristics**:
  - "Stateless controller — `DirectoryController` holds only injected service references via `@RequiredArgsConstructor`; instances scale horizontally without coordination." — evidence: DirectoryController.java:17-21.
  - "No pagination at levels 1 and 2 — response payload size grows O(N) with registered-data-source count. A platform with 10K+ data sources renders a 10K-row level-2 response with reflection-based property extraction per row." — evidence: openapi.yaml:3745-3779 + DirectoryServiceImpl.java:48-82.
  - "No HTTP caching headers, no ETag, no `@Cacheable` — every UI navigation re-runs the full DB+grouping pipeline. A user clicking back-and-forth between the Directory landing and a type-card pays the full cost on every round-trip." — evidence: DirectoryController.java:23-51 + DirectoryServiceImpl.java:39-89.
  - "Pagination at level 4 is mandatory (`page` and `size` declared via `PageParam`/`SizeParam` $refs that resolve to `required: true`) — bounded response size at the leaf. But the page-vs-count predicate divergence (above) means the bound is over a slightly different population than the count reports." — evidence: openapi.yaml:3810-3811 + ReactiveDataEntityRepositoryImpl.java:595-627.
- **known_performance_gaps**:
  - "`/api/directory` (landing page) has no pagination on the type-card list — degrades response time and memory linearly with registered-data-source count. For platforms with thousands of data sources, every Directory navigation pays an unbounded scan + in-memory grouping cost." — evidence: DirectoryServiceImpl.java:46-63 + openapi.yaml:3745-3759 — severity: MEDIUM
  - "`/api/directory/datasources?prefix=...` has no pagination on the per-prefix data-source list — a single popular prefix (e.g. `postgresql` with 5K registered Postgres sources) produces a 5K-row response with reflection-based property extraction per row." — evidence: DirectoryServiceImpl.java:65-82, 138-171 + openapi.yaml:3760-3779 — severity: MEDIUM
  - "Reflection-based `getOddrnPathProperties` is unmemoised — per request, per data source, the `@PathField` field set is re-discovered and the getter Method is re-resolved. A simple per-OddrnPath-subclass cache (Map<Class, List<Method>>) would eliminate the per-row reflection cost." — evidence: DirectoryServiceImpl.java:153-171 — severity: LOW
  - "No HTTP/server-side caching layer in front of any Directory endpoint despite the data being read-mostly (data-source registrations change rarely; entity counts change at ingestion cadence). A short-TTL cache on `getDataSourceTypes` would cut landing-page latency materially." — evidence: DirectoryServiceImpl.java:39-89 + DirectoryController.java:17-52 — severity: LOW
  - "`getDataSourceTypes` runs `dataSourceRepository.list()` and `dataEntityRepository.getCountByDataSources()` — the second query aggregates entity counts across ALL data sources, even though the response only needs counts grouped by prefix. A query that pre-aggregates by ODDRN-prefix at the DB level would shrink the work materially." — evidence: DirectoryServiceImpl.java:47, 51-62 — severity: LOW

## sources

- understanding ← DirectoryController.java:17-52 + DirectoryServiceImpl.java:39-89 + openapi.yaml:3745-3820
- concepts.entities ← DirectoryController.java:5-9 (DTO imports) + OddrnUtils.java:7 (UNKNOWN_DATASOURCE_TYPE sentinel)
- concepts.operations ← DirectoryController.java:23-51 (four method bodies) + openapi.yaml:3745-3820 (four HTTP routes)
- concepts.invariants ← openapi.yaml:3745-3820 + DirectoryServiceImpl.java:91-110 + OddrnUtils.java:7 + DirectoryTest.java:42-43,79-85
- concepts.audiences ← documentation/docs/data-discovery/directory.md (live page describes UI usage); odd-platform-ui/src/lib/hooks/api/directory.ts (UI API client)
- dependencies_semantic.requires-feature ← DirectoryServiceImpl.java:25-27,43,103,114 (oddrn-generator usage); DirectoryServiceImpl.java:47-50 (getCountByDataSources + dataSourceRepository.list)
- dependencies_semantic.couplings ← DirectoryController.java:20-21 + DirectoryController.java:42 (two-service composition)
- tests_coverage_semantic.test_files ← odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DirectoryTest.java:30-159
- tests_coverage_semantic.covered_behaviours ← DirectoryTest.java:57-67,70-85,141-158
- tests_coverage_semantic.uncovered_behaviours ← Grep of test file (no `getDatasourceEntities` / `getDatasourceEntityTypes` URL or method invocation present); ReactiveDataEntityRepositoryImpl.java:595-627 (no test exercises the EXCLUDE_FROM_SEARCH page-vs-count branch)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/directory (status 200, 2026-05-20)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/directory (status 200, 2026-05-20)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch /features/data-discovery/directory 2026-05-20 (no mention of authorization, owner-scoping, pagination, the "Other" bucket, or scaling) + DirectoryServiceImpl.java:46-99 (the code-side BYPASSES owner scope)
- docs_link_semantic.doc_drift_findings.[1] ← documentation/docs/data-discovery/directory.md:30 (live doc uses "Distinct Data Entity classes") + DirectoryController.java:5,47 (code returns `DataEntityType` not `DataEntityClass`)
- docs_link_semantic.doc_drift_findings.[2] ← ReactiveDataEntityRepositoryImpl.java:595-627 + WebFetch 2026-05-20 (no acknowledgement of EXCLUDE_FROM_SEARCH in either Directory doc page)
- implicit_adrs.[0-6] ← DirectoryController.java:1-52 + openapi.yaml:3745-3820 + DirectoryServiceImpl.java:33,84-89,91-110,124-127,138-171 + SecurityConstants.java (grep `/api/directory` zero matches) + OddrnUtils.java:7 + DirectoryTest.java:42-43,79-85,141-149
- bugs_limitations_corner_cases.[0] (NEW page-vs-count divergence) ← DirectoryController.java:42 + DataEntityServiceImpl.java:164-179 + ReactiveDataEntityRepositoryImpl.java:595-613 (page query without EXCLUDE_FROM_SEARCH) + ReactiveDataEntityRepositoryImpl.java:616-627 (count query WITH EXCLUDE_FROM_SEARCH via getDataEntityDefaultConditions) + ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect — applies addSoftDeleteFilter + HOLLOW only) + ReactiveDataEntityRepositoryImpl.java:970-976 (getDataEntityDefaultConditions defines the three filters)
- bugs_limitations_corner_cases.[1-7] ← DirectoryServiceImpl.java:46-63,101-122,51-62,173-178,153-171,124-127 + openapi.yaml:3745-3779 + DirectoryController.java:23-51
- security.auth_mode_relevance ← DirectoryController.java:17-52 (no @ConditionalOnProperty) + SecurityConstants.java (no `/api/directory*` rule)
- security.ingestion_filter_relevance ← openapi.yaml:3745-3820 (all GETs under /api/directory) + IngestionDataEntitiesFilter sidecar (batch O — confirms /ingestion/entities path matcher)
- security.authorization_assertions ← DirectoryController.java:1-52 + SecurityConstants.java (grep `/api/directory` zero matches)
- security.owner_scoping ← DirectoryServiceImpl.java:48,91-99,86 + DirectoryController.java:42 (no principal context passed to DataEntityService)
- security.data_exposure.[0-4] ← DirectoryServiceImpl.java:46-89,138-171 + DirectoryController.java:24-51 + ReactiveDataEntityRepositoryImpl.java:595-613 (no owner scoping at level 4) + concept `ui-vs-api-asymmetry-under-disabled-ui-hides-mutation-buttons-backend-accepts-anonymous` (DISABLED reach)
- security.known_security_gaps.[0] ← DirectoryController.java:17-52 + DirectoryServiceImpl.java:46-99,138-171 + WebFetch /features/data-discovery/directory 2026-05-20
- security.known_security_gaps.[1] ← DirectoryController.java:1-52 + SecurityConstants.java + concept `authorization-is-path-pattern-wired-in-securityconstants-security-rules-not-controller-annotations`
- security.known_security_gaps.[2] ← DirectoryServiceImpl.java:153-171 + DirectoryTest.java:141-149
- security.known_security_gaps.[3] ← SecurityConstants.java + DirectoryController.java:1-52 + REFACTOR-185 (19-SIDECAR)
- performance.hot_paths.[0-2] ← DirectoryServiceImpl.java:46-89 + DirectoryController.java:23-51 + openapi.yaml:3745-3820 + DataEntityServiceImpl.java:164-179
- performance.throughput_characteristics.[0-2] ← DirectoryController.java:14-15,23-51 + DirectoryServiceImpl.java:46-89 + openapi.yaml:3745-3820
- performance.resource_allocation.[0-2] ← DirectoryServiceImpl.java:48-62,153-171 + DataEntityServiceImpl.java:164-179
- performance.scaling_characteristics.[0-3] ← DirectoryController.java:17-21,23-51 + openapi.yaml:3745-3820 + DirectoryServiceImpl.java:39-89
- performance.known_performance_gaps.[0-4] ← DirectoryServiceImpl.java:46-89,138-171 + openapi.yaml:3745-3820 + DirectoryController.java:17-52

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

Prior sidecar at the controller-axis (v0.1.0, session-2026-05-08-01) is RETAINED at its own filename — it remains historically valid and recorded the same MEDIUM/LOW per-field findings at HEAD ede5d277. This sidecar (v0.3.0, controller-class axis under rev-2, enriched_at_commit 9ac6436e) adds the new page-vs-count predicate divergence finding plus the rev-2 coherence_check block strengthening REFACTOR-024 / REFACTOR-203 / REFACTOR-185 / REFACTOR-425 with cross-links.

Open canonicalisation question for the maintainer: the cross-owner read-collaborative posture has now been confirmed at SIX surfaces (alerts batch + alerts per-entity + search results + search facets + lineage graph + DEG-anchored lineage), and DIRECTORY is the SEVENTH (a flat-list inventory enumeration). If the maintainer accepts ADR-CANDIDATE-003 (read-collaborative-GET) as intentional, the live `/features/data-discovery/directory` doc page needs an explicit "Visibility" section disclosing that Directory is platform-wide unscoped — currently silent. The DOC-NNN follow-up (DOC-GAP-187 or similar) should pair with the alerting / lineage / search disclosure already pending.
