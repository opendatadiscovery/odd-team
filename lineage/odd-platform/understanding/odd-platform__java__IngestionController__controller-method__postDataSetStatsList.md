---
node_id: "odd-platform java IngestionController controller-method:postDataSetStatsList"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Z
---

# IngestionController.postDataSetStatsList — semantic understanding

## understanding

`postDataSetStatsList` is the `POST /ingestion/entities/datasets/stats` endpoint: collectors / DQ tooling push a `DatasetStatisticsList` payload (a list of `DataSetStatistics` items, each a `dataset_oddrn` + a `fields: Map<datasetFieldOddrn, DataSetFieldStat>` map of per-column statistical profiles) and the controller hands the deserialised payload to `IngestionServiceImpl.ingestStats(...)` — which is a one-line delegate to `DatasetFieldService.updateStatistics(...)`. The service WRITES per-field statistics as a JSONB blob into `dataset_field.stats`, side-effects EXTERNAL_STATISTICS-origin tags on the field rows (creating tag relations from `stat.tags`), and recalculates dataset-level FTS structure vectors. Unlike `postDataEntityList`, this path has NO datasource resolution, NO datasource row lock, NO IngestionDataEntitiesFilter coverage (the filter's path matcher is exact-literal `/ingestion/entities` POST), and returns `201 Created`. The controller is a 4-line thin proxy with NO `@PreAuthorize`, NO programmatic auth check, NO empty-payload guard (unlike the sibling `postDataEntityList` line 41-42), NO validation on the numeric statistics fields, and NO idempotency key.

## concepts

- entities:
  - "`DatasetStatisticsList` (request body — `items: List<DataSetStatistics>`; OpenAPI-generated from the external `org.opendatadiscovery:ingestion-contract-server:0.1.40` artifact per gradle/libs.versions.toml:6)"
  - "`DataSetStatistics` (per-dataset record — `dataset_oddrn: String` + `fields: Map<String, DataSetFieldStat>` keyed by dataset-field ODDRN)"
  - "`DataSetFieldStat` (per-column statistic — discriminated union of 7 type-specific stats: `complex_stats`, `boolean_stats` (true_count/false_count/nulls_count), `number_stats` (low/high/mean/median/nulls/unique), `integer_stats` (same shape as number_stats but int64), `string_stats` (max_length/avg_length/nulls/unique), `binary_stats` (same as string), `datetime_stats` (low/high/mean/median/nulls/unique); plus optional `name` and `tags: List<Tag>`)"
  - "`IngestionService.ingestStats(...)` (interface — IngestionService.java:10) — service-layer worker"
  - "`DatasetFieldService.updateStatistics(...)` (the ACTUAL writer — DatasetFieldService.java:28, impl DatasetFieldServiceImpl.java:158-181) — wraps an `@ReactiveTransactional` boundary"
  - "`Mono<ResponseEntity<Void>>` (reactive response shape)"
  - "`dataset_field.stats` (JSONB column — the persistence destination, populated via `field.setStats(JSONB.jsonb(JSONSerDeUtils.serializeJson(stat)))` DatasetFieldServiceImpl.java:246)"
  - "`TagOrigin.EXTERNAL_STATISTICS` (TagOrigin.java:6 — the tag-origin enum value used for any tag delivered via this endpoint)"
- operations:
  - accept-dataset-statistics-list
  - delegate-to-ingestion-service-ingestStats
  - resolve-dataset-fields-by-field-oddrn
  - serialize-per-field-stat-to-jsonb
  - bulkUpdate-dataset-field-stats-column
  - reconcile-EXTERNAL_STATISTICS-tags-relations
  - update-FTS-structure-vector-for-dataset-oddrns
  - return-201-Created
- invariants:
  - "Controller has no authorization at the method level — neither `@PreAuthorize` on `postDataSetStatsList` nor on the `IngestionApi` interface it implements (the interface is OpenAPI-generated from `org.opendatadiscovery:ingestion-contract-server:0.1.40` and contains no security annotations). Unlike the sibling `postDataEntityList`, this path is ALSO not covered by any `AbstractIngestionFilter` subclass: `IngestionDataEntitiesFilter` binds exactly to `/ingestion/entities` POST (IngestionDataEntitiesFilter.java:28 — `PathPatternParserServerWebExchangeMatcher(\"/ingestion/entities\", HttpMethod.POST)`), and the path matcher is exact-literal — it does NOT match the sub-path `/ingestion/entities/datasets/stats`. The path is `permitAll()` under all UI auth modes via `/ingestion/**` in `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96). Result: `POST /ingestion/entities/datasets/stats` is unauthenticated under EVERY combination of `auth.type` ∈ {DISABLED, OAUTH2, LDAP} AND `auth.ingestion.filter.enabled` ∈ {true, false}."
  - "Empty payload is NOT short-circuited at the controller (unlike sibling `postDataEntityList` line 41-42 which short-circuits on `CollectionUtils.isNotEmpty(items)`). A `DatasetStatisticsList` with `items: []` or `items: null` flows into `DatasetFieldServiceImpl.updateStatistics`, where `datasetStatisticsList.getItems().stream()` on null throws NullPointerException (line 161, 168); on empty-list the reduce returns an empty map, the lookup returns no fields, the transaction commits a no-op. NPE-on-null is unhandled in this controller."
  - "Response is `201 Created` (IngestionController.java:86 — `ResponseEntity.status(HttpStatus.CREATED).build()`) — matches the sibling `ingestMetrics` (line 94) AND differs from `postDataEntityList` (line 44 — returns 200 OK). Per the IngestionController.postDataEntityList sibling sidecar (concepts.invariants[2]), the OpenAPI specification declares 201 for all three methods; this method aligns with the spec, postDataEntityList is the lone drifter."
  - "Idempotency: re-POST OVERWRITES (does NOT accumulate). `DatasetFieldServiceImpl.updateStatistics` (line 233-251) calls `field.setStats(JSONB.jsonb(JSONSerDeUtils.serializeJson(stat)))` — the entire JSONB blob is REPLACED per re-ingest. Statistics that exist in the platform but NOT in the new payload remain UNTOUCHED (the bulkUpdate only touches the fields whose ODDRNs appear in the payload's keys). Tags are reconciled additively-then-removing: `relationsToDelete` (line 221-223) deletes existing EXTERNAL_STATISTICS-origin tag relations not present in the new payload; `relationsToCreate` re-creates the desired set. A re-POST with a smaller tag set SILENTLY REMOVES the absent tags."
  - "Dataset scoping is **payload-driven, NOT principal-driven**. `DatasetFieldServiceImpl.updateStatistics` (line 172-174) keys fields by `getLastVersionDatasetFieldsByOddrns(statistics.keySet())` — the field ODDRNs come from the payload. There is NO check that the caller (if authenticated) has any relationship to the targeted dataset's parent datasource, owner, or namespace. The endpoint has NO datasource resolution at all (no `dataSourceRepository.getIdByOddrnForUpdate(...)` call — contrast IngestionServiceImpl.java:68 for the entity-list path)."
  - "Body parsing is REACTIVE — `Mono<DatasetStatisticsList>` (line 82) defers deserialisation until the inner subscriber pulls; `flatMap(ingestionService::ingestStats)` triggers the parse. Body is buffered to JSON via `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) — exceeding the cap throws `DataBufferLimitException` → 500 (not 413)."
- audiences:
  - odd-collector-profiler (the statistical-profiling collector — `documentation/docs/data-quality.md` line 9 anchors "ODD covers Data Quality fully as an aggregator")
  - custom data-quality push frameworks per the live data-quality doc page (WebFetched 2026-05-20: "the POST /ingestion/entities/datasets/stats endpoint for custom frameworks")
  - any HTTP client able to reach the platform's port — the endpoint is unauthenticated in every default deployment per the security invariant above
  - odd-platform operators standing up DQ-statistics pipelines
  - security reviewers auditing the S2S ingestion surface

## dependencies_semantic

- requires-feature:
  - "`IngestionApi` (OpenAPI-generated interface from `org.opendatadiscovery:ingestion-contract-server:0.1.40` — gradle/libs.versions.toml:6,65,142) — declares the method signature `Mono<ResponseEntity<Void>> postDataSetStatsList(Mono<DatasetStatisticsList>, ServerWebExchange)`. The path mapping `/ingestion/entities/datasets/stats` lives in the EXTERNAL spec repository (`opendatadiscovery/opendatadiscovery-specification`); the path is referenced verbatim in tests (BaseIngestionTest.java:84 — `.uri(\"/ingestion/entities/datasets/stats\")`). The generated interface is the artefact that wires the path."
  - "`IngestionService.ingestStats(DatasetStatisticsList)` — service-layer interface (IngestionService.java:10). The implementation is one line: `return datasetFieldService.updateStatistics(datasetStatisticsList);` (IngestionServiceImpl.java:78). The IngestionService layer is a passthrough; there is NO datasource resolution, NO row lock, NO processor chain (unlike `ingest(DataEntityList)`), NO OTLP metric export, NO `@ReactiveTransactional` annotation at the IngestionServiceImpl tier (verified: IngestionServiceImpl.java:76-79 has no annotation, the `@ReactiveTransactional` lives downstream on `DatasetFieldServiceImpl.updateStatistics` line 159)."
  - "`DatasetFieldService.updateStatistics(DatasetStatisticsList)` — the ACTUAL persistence worker. Wrapped in `@ReactiveTransactional` (DatasetFieldServiceImpl.java:159). Two parallel sub-flows via `Mono.zipDelayError`: (1) `updateFieldsStatistics(...)` (lines 233-251) — serialises each `DataSetFieldStat` to JSON, writes to `dataset_field.stats` JSONB column via `bulkUpdate(fieldsToUpdate)`. (2) `updateFieldsTags(...)` (lines 191-231) — extracts tag names from `stat.getTags()` across all fields, ensures `tag` rows exist via `tagService.getOrCreateTagsByName(...)`, computes the `EXTERNAL_STATISTICS`-origin tag-to-field relations to create/delete, applies via `reactiveTagRepository.deleteDatasetFieldRelations(...)` + `createDatasetFieldRelations(...)`. Then `.then(reactiveSearchEntrypointRepository.updateStructureVectorForDataEntitiesByOddrns(datasetOddrns))` recalculates FTS vectors for the dataset entities."
  - "`reactiveSearchEntrypointRepository.updateStructureVectorForDataEntitiesByOddrns(...)` — terminal step (DatasetFieldServiceImpl.java:179). Rebuilds the Postgres FTS tsvector index entries for the affected dataset entities so the new tags become searchable. Sibling write to `search_entrypoint` table."
  - "`TagOrigin.EXTERNAL_STATISTICS` (TagOrigin.java:6) — the origin enum value stamped on every tag relation written by this path. Distinguishes statistics-delivered tags from `INTERNAL` (UI-curated) tags and from other external origins."
- requires-config:
  - "`spring.codec.max-in-memory-size: 20MB` (application.yml:14-15 per the postDataEntityList sibling sidecar) — the WebFlux body-buffer cap that applies to the reactive deserialisation of `Mono<DatasetStatisticsList>`. Over-cap payloads throw `DataBufferLimitException` → HTTP 500 (no `@ExceptionHandler` for 413)."
  - "(NOTHING ELSE) — `auth.ingestion.filter.enabled` (the property that gates `IngestionDataEntitiesFilter`) is IRRELEVANT to this path because the filter's `PathPatternParserServerWebExchangeMatcher` is exact-literal `/ingestion/entities` (IngestionDataEntitiesFilter.java:28). Setting `auth.ingestion.filter.enabled=true` does NOT protect this endpoint. The property name reads as 'protect the ingestion namespace'; the property's actual scope is one sibling endpoint."
- requires-runtime:
  - "Spring WebFlux + Reactor Core (`Mono<ResponseEntity<Void>>` return, `Mono<DatasetStatisticsList>` body)."
  - "Jackson `ObjectMapper` (WebFlux reactive codec deserialises the JSON body into `DatasetStatisticsList`)."
  - "`@ReactiveTransactional` on `DatasetFieldServiceImpl.updateStatistics` (line 159) — bulkUpdate of `dataset_field` rows + EXTERNAL_STATISTICS tag reconciliation + FTS vector recalc run in one Postgres transaction. Slow or large payloads hold the transaction open for the duration."
  - "Postgres `dataset_field.stats` JSONB column — the persistence destination."
- coupling:
  - "Path is OpenAPI-driven — `/ingestion/entities/datasets/stats` POST is declared in the external `opendatadiscovery-specification` repository (loaded as the `ingestion-contract-server:0.1.40` gradle dep per libs.versions.toml:6,65,142). Changing the path requires bumping the dep AND regenerating. No `@PostMapping` annotation on `IngestionController` (consistent with the package convention — every method is an `@Override` of an `IngestionApi` interface method)."
  - "NO empty-payload guard at the controller (in contrast to sibling `postDataEntityList` line 40-42 which has `CollectionUtils.isNotEmpty(del.getItems())`). The asymmetry is silent — there is no comment explaining why the stats path is unguarded."
  - "NO `auth.ingestion.filter.enabled` coverage (in contrast to sibling `postDataEntityList`). The matcher in `IngestionDataEntitiesFilter` is exact-literal `/ingestion/entities`, NOT the wildcard `/ingestion/entities/**` — and the sibling sub-path `/ingestion/entities/datasets/stats` is consequently uncovered. This is the same class of finding as the `/ingestion/alert/alertmanager` AlertManager-webhook drift documented in batch P and at `concepts/detail/invariants/two-ingestion-filters-asymmetric-auth.yaml` lines 53-57 — that invariant explicitly lists `/ingestion/entities/datasets/stats` as a sibling-path the filter does not cover."
  - "NO `@ReactiveTransactional` at the controller layer or the IngestionServiceImpl layer for this path. The transaction boundary lives THREE call frames downstream at `DatasetFieldServiceImpl.updateStatistics` (line 159). In contrast, `postDataEntityList` has `@ReactiveTransactional` on `IngestionServiceImpl.ingest` (IngestionServiceImpl.java:66). The split is undocumented — there is no comment in IngestionServiceImpl explaining why one path is annotated and the sibling is not."
  - "Sibling `ingestMetrics` (line 89-95) ALSO returns `201 Created` and ALSO has no `IngestionDataEntitiesFilter` coverage (the filter only covers `/ingestion/entities` exact). Three sibling methods on this controller: `postDataEntityList` (200 OK, filter-conditional), `postDataSetStatsList` (201, filter-uncovered), `ingestMetrics` (201, filter-uncovered) — three different security postures, three controller methods."
  - "EXTERNAL_STATISTICS tag flow: statistics ingestion has a SIDE EFFECT on the catalog's tag taxonomy. A POST that includes `tags` on a `DataSetFieldStat` causes `tagService.getOrCreateTagsByName(...)` (DatasetFieldServiceImpl.java:202) to CREATE the tag rows if they don't already exist. This is a privileged operation (Tags tab in Management UI is RBAC-gated by `TAG_CREATE` permission) — but here it's reachable via unauthenticated POST. An attacker can POPULATE the catalog's tag namespace with arbitrary tag names by sending `DatasetStatisticsList` payloads."

## tests_coverage_semantic

- covered_behaviours:
  - "Happy-path 201 Created on `POST /ingestion/entities/datasets/stats` with a valid `DatasetStatisticsList` — `BaseIngestionTest.ingestStatistics(...)` (BaseIngestionTest.java:82-88) calls the endpoint and asserts `.expectStatus().isCreated()`. The scaffold is invoked only from `DatasetFieldIngestionTest` (verified: `grep -rn 'ingestStatistics' <odd-platform-repo>/odd-platform-api/src/test` returns BaseIngestionTest.java + DatasetFieldIngestionTest.java only)."
  - "Service-layer outcome: tags from stats are applied to dataset fields, structure vectors are updated, downstream `DataSetStructure` reflects the new `stats` and `tags`. The `DatasetFieldIngestionTest` (line 256-291 excerpt seen) generates randomized `DataSetFieldStat` via `EasyRandom`, posts via `ingestStatistics(...)`, then asserts the resulting `DataSetStructure` matches expectations via `assertDatasetStructuresEqual(...)`."
- uncovered_behaviours:
  - "401/403 path: NO test asserts that this endpoint is reachable WITHOUT credentials. The test profile inherits the default `auth.ingestion.filter.enabled: false` (irrelevant here anyway — the filter does not match this path) AND default `auth.type: DISABLED` from the test config — so the test setup masks the production reality: under `auth.type=OAUTH2/LDAP/LOGIN_FORM` (all production-recommended modes), this endpoint REMAINS unauthenticated because of `/ingestion/**` in WHITELIST_PATHS (SecurityConstants.java:95-96). No test exercises a UI-authenticated user being able to ALSO post anonymous stats."
  - "Empty/null payload: NO test asserts behaviour with `items: []` (no-op, transaction commits empty) or `items: null` (NPE at DatasetFieldServiceImpl.java:161). The lack of empty-payload guard at the controller (in contrast to sibling `postDataEntityList`) is a silent inconsistency."
  - "Idempotency / replay path: NO test asserts that re-POSTing the SAME stats payload is a no-op (the second POST UPDATEs the field's `stats` JSONB to the same value; tag reconciliation diff is empty). NO test asserts that re-POSTing with FEWER tags than before causes the absent tags to be REMOVED via EXTERNAL_STATISTICS relation cleanup (DatasetFieldServiceImpl.java:221-223)."
  - "Cross-owner / cross-datasource path: NO test asserts that a payload containing `dataset_oddrn` belonging to dataset A and `field_oddrn` belonging to a field of dataset B (mismatched parent-child) is handled correctly. The code's behaviour: `getLastVersionDatasetFieldsByOddrns(statistics.keySet())` (line 173) resolves fields by their OWN ODDRN — the dataset_oddrn from `DataSetStatistics.datasetOddrn` is NOT cross-checked against the resolved fields' parent. This means an attacker can write `stats` to ANY dataset field's row by knowing its ODDRN, even if the payload's `dataset_oddrn` parent is mismatched. The dataset_oddrn is consumed ONLY in line 168-170 to compute the set of dataset ODDRNs whose FTS vectors to recalc."
  - "Numeric overflow / negative-value path: NO test asserts behaviour with `IntegerFieldStat.low_value = Long.MIN_VALUE`, `high_value < low_value` (inverted), `nulls_count < 0`, `unique_count > row_count`, NaN/Infinity in `NumberFieldStat.mean_value`. The OpenAPI schema's integer fields are `format: int64` (no `minimum`/`maximum` constraint per the local opendatadiscovery-specification clone at `components.yaml:1596-1621`) — invalid values are accepted and serialized verbatim into the JSONB blob, where downstream consumers (Quality Dashboard, BI tools reading `dataset_field.stats`) may render nonsense."
  - "Filter-uncovered path: NO test exists to assert that `POST /ingestion/entities/datasets/stats` succeeds with NO `Authorization` header AND `auth.ingestion.filter.enabled=true`. A test confirming this would document the gap explicitly and protect against a later refactor that widens the filter's path matcher (which would change observable behaviour and SHOULD break a test)."
  - "Tag-creation-as-side-effect: NO test asserts that an unauthenticated POST with `tags: [{name: 'arbitrary-attacker-tag'}]` populates the catalog's tag taxonomy with that tag name. The TagOrigin.EXTERNAL_STATISTICS bypass of `TAG_CREATE` permission is an undocumented side-channel into the Tags management surface."
  - "Mixed-existing-and-unknown field ODDRNs: a payload with some `field_oddrn` keys that exist and some that don't — the `getLastVersionDatasetFieldsByOddrns` lookup returns ONLY the existing rows; the unknown ones are silently dropped at `for (final DatasetFieldPojo field : existingFields)` (line 237). NO log-line warns about dropped keys; NO `BadUserRequestException` is thrown. The `log.error('Unexpected behaviour while building an update object for datasetField {}', field.getOddrn())` (line 240-241) only fires when an existing field's ODDRN is NOT in the input statistics map — i.e. the inverse direction — which cannot actually happen because the lookup uses the statistics map's keys as input."
- test_files:
  - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:82-88 — the only test scaffold that hits `POST /ingestion/entities/datasets/stats`."
  - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetFieldIngestionTest.java — the only consumer of `ingestStatistics(...)` (one happy-path test exercising stats + tag side-effects)."
  - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/utils/IngestionModelGenerator.java:70-90 — generates randomized `DataSetFieldStat` via EasyRandom + builds a `DatasetStatisticsList`. The generator does NOT constrain numeric ranges, so the test exercises 'random valid' but never 'pathological valid' (negative counts, inverted low/high, etc)."
- gaps: |
    The endpoint has one happy-path service-layer test but ZERO controller-boundary
    tests for: authentication posture (the endpoint is unauthenticated under EVERY
    auth mode), payload validation (empty / null / mismatched field-vs-dataset
    ODDRN / numeric overflow), idempotency contracts (replay-removes-tags is
    silent), tag-as-side-effect (unauthenticated callers can populate the tag
    taxonomy), and cross-dataset write (attacker writes stats to a field they
    don't own). A regression most likely lands where the EXTERNAL_STATISTICS tag
    reconciliation is "optimized" (e.g. switching from delete-then-recreate to a
    pure upsert) and silently changes the tag-removal semantics that the
    existing test doesn't lock in. A second likely regression: someone tightens
    `IngestionDataEntitiesFilter`'s path matcher to `/ingestion/entities/**`
    (intuiting that the property name "ingestion filter" should protect the
    namespace) — that fixes the security gap but breaks the test profile's
    default-DISABLED happy-path test, surfacing the drift.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "The data-quality landing doc is the closest live doc page that references this endpoint. WebFetched 2026-05-20 (status 200) — quotes verbatim: 'the POST /ingestion/entities/datasets/stats endpoint for custom frameworks'. The page does NOT describe the payload shape (DatasetStatisticsList / DataSetStatistics / DataSetFieldStat), does NOT describe idempotency (replay overwrites + removes-tags-on-absence), does NOT describe authentication (the endpoint is unauthenticated under all modes), does NOT describe validation (numeric range, negative values, overflow), does NOT describe the tag-as-side-effect contract (EXTERNAL_STATISTICS-origin tags created unauthenticatedly)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim (WebFetched 2026-05-20 from https://docs.opendatadiscovery.org/features/data-quality):
      - "the `POST /ingestion/entities/datasets/stats` endpoint for custom frameworks" — mentioned as one method for test results ingestion.
      - (2) DatasetStatisticsList payload: No mention in the provided content.
      - (3) How dataset statistics/field stats are pushed: The page references this endpoint as an option but provides no implementation details on the pushing mechanism itself.
      - (4) Idempotency/upsert behaviour: No mention.
      - (5) Statistics fields accepted (row count, freshness, size, etc.): No mention.
      - (6) Authentication/auth filter: No mention.
      - (7) Tags from statistics ingestion: No mention.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Security configuration landing — WebFetched 2026-05-20 (status 200). EXPLICITLY documents the filter-coverage gap that affects this endpoint. Quote verbatim: 'All other /ingestion/* paths (e.g. /ingestion/alert/alertmanager, /ingestion/entities/degs/children, /ingestion/entities/datasets/stats) ... remain outside the ingestion filter's coverage.' AND: 'Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP — even when the ingestion filter is enabled.' This is the canonical documented evidence that the filter is NARROW; the docs SURFACE the gap (good) but the operator-facing surface that they SURFACE it is the Security page, NOT the Data Quality page where an operator first encounters the endpoint."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim (WebFetched 2026-05-20 from https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security):
      - "All other /ingestion/* paths (e.g. /ingestion/alert/alertmanager, /ingestion/entities/degs/children, /ingestion/entities/datasets/stats) — listed as examples of paths outside the ingestion filter's protection."
      - "The filter applies narrowly. It 'uses an exact path matcher (/ingestion/entities, POST)' and does not gate all /ingestion paths. The flag only activates protection for the specific /ingestion/entities endpoint."
      - "The /ingestion/** namespace is whitelisted in Spring Security (SecurityConstants.WHITELIST_PATHS), so it never traverses the UI authentication chain. This whitelist carries sibling paths through permitAll under non-LOGIN_FORM modes."
      - "The stats endpoint falls under 'All other /ingestion/* paths' which remain 'Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP' — even when the ingestion filter is enabled."
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/data-quality/test-results-import"
    anchor: ""
    rationale: "Plausible URL for a deep dive on Test Results Import. WebFetched 2026-05-20 returned a 404 page from docs.opendatadiscovery.org (per the WebFetch response: 'The current page is a 404 error page for OpenDataDiscovery documentation'). No dedicated Test Results Import page exists at this URL — the data-quality landing is the only place this endpoint is mentioned."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
- doc_drift_findings:
  - "NO live ODD docs page describes the `POST /ingestion/entities/datasets/stats` payload shape — the `DatasetStatisticsList → DataSetStatistics → DataSetFieldStat` discriminated union of 7 type-specific stats (`complex_stats / boolean_stats / number_stats / integer_stats / string_stats / binary_stats / datetime_stats`), the required fields per variant, the implicit `int64` ranges. The data-quality landing page mentions the endpoint by name (one verbatim quote) but provides no implementation details (WebFetched 2026-05-20). Operators authoring custom DQ-push integrations have only the OpenAPI spec in the external `opendatadiscovery/opendatadiscovery-specification` repo, with no operator-facing narrative."
  - "NO live ODD docs page documents the endpoint's security posture explicitly at the point an operator encounters it. The data-quality landing page (where the endpoint is named) does NOT mention that the endpoint is unauthenticated under all auth modes. The Security page (WebFetched 2026-05-20) DOES surface this — quote: '/ingestion/entities/datasets/stats ... remain outside the ingestion filter's coverage' AND 'Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP — even when the ingestion filter is enabled' — but an operator reading the DQ docs and following the endpoint reference would not encounter the security caveat without a second hop to the Security page. The cross-link is missing."
  - "NO live ODD docs page describes the SILENT TAG-AS-SIDE-EFFECT contract: statistics ingestion can create catalog tags via `tagService.getOrCreateTagsByName(...)` (DatasetFieldServiceImpl.java:202) stamped `EXTERNAL_STATISTICS` origin. This is reachable without authentication. The Tags management UI is RBAC-gated by `TAG_CREATE` permission in normal flows; the stats path is the side-channel. No live doc surfaces this side-channel."
  - "NO live ODD docs page describes the REPLACE-NOT-ACCUMULATE idempotency contract for stats. Re-POST overwrites the `dataset_field.stats` JSONB blob and reconciles EXTERNAL_STATISTICS tags (removing tags absent from the new payload). A collector that fails to re-emit a tag SILENTLY REMOVES it. This is the same class of replace-not-merge contract documented at F-008 `silent_destruction_replace_not_merge` for the entity-list path, applied here to the stats path. The doc gap is the same shape."

## implicit_adrs

- "Statistics path is intentionally a thin proxy chain `controller → IngestionService → DatasetFieldService` — only the deepest layer carries the `@ReactiveTransactional` boundary" — evidence: IngestionController.java:82-87 (4-line method, no business logic) + IngestionServiceImpl.java:76-79 (`return datasetFieldService.updateStatistics(datasetStatisticsList);` — no annotation, no row lock) + DatasetFieldServiceImpl.java:158-181 (the actual transactional + bulkUpdate worker) — intent_anchor: the controller and service are deliberately stateless proxies; the persistence concern is concentrated in `DatasetFieldServiceImpl.updateStatistics`. The convention is consistent with the controller-package's other thin-proxy methods (every method on IngestionController is 4-7 lines). — confidence: HIGH

- "Statistics ingestion produces `201 Created` (not `200 OK`) because every POST creates a new versioned JSONB stats blob on the targeted field rows — the response code matches OpenAPI spec semantics for resource creation" — evidence: IngestionController.java:86 (`ResponseEntity.status(HttpStatus.CREATED).build()`) + sibling `ingestMetrics` IngestionController.java:94 (same — also 201) vs `postDataEntityList` IngestionController.java:44 (200, the lone divergence per the postDataEntityList sibling sidecar) — intent_anchor: the controller intentionally distinguishes 'resource was created (insert-only side-effect)' from 'operation completed (potentially upsert)'. Stats and metrics ingestion are insert-into-blob-store semantics (201); data-entity ingestion is upsert (200). The choice aligns with the OpenAPI spec — verifiable against the published `opendatadiscovery-specification` repo. — confidence: HIGH

- "Tag-creation-as-statistics-side-effect uses the `TagOrigin.EXTERNAL_STATISTICS` origin tag to distinguish from `INTERNAL` (UI) tags AND from other external origins" — evidence: DatasetFieldServiceImpl.java:273-278 (`createExternalStatisticsRelation(...)` explicitly sets `origin = TagOrigin.EXTERNAL_STATISTICS.toString()`) + TagOrigin.java:6 (the enum value exists alongside `INTERNAL`) + `reactiveTagRepository.listTagsRelations(datasetFieldIds, TagOrigin.EXTERNAL_STATISTICS)` (line 218) only operates on this origin during reconciliation — intent_anchor: the origin tag is deliberately load-bearing — reconciliation (delete-relations-absent-from-payload) operates ONLY on EXTERNAL_STATISTICS-origin relations, leaving INTERNAL (UI-curated) tags intact. A UI user's manual tag assignment SURVIVES a re-ingest. — confidence: HIGH

## bugs_limitations_corner_cases

- "Endpoint is UNAUTHENTICATED under EVERY combination of `auth.type` AND `auth.ingestion.filter.enabled`. `IngestionDataEntitiesFilter` (the only `AbstractIngestionFilter` subclass on the entity path) uses exact-literal path matcher `/ingestion/entities` POST (IngestionDataEntitiesFilter.java:28) — the sub-path `/ingestion/entities/datasets/stats` is NOT matched. The path is in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**` — SecurityConstants.java:95-96), so UI auth (OAUTH2/LDAP) bypasses it. The controller has NO `@PreAuthorize`. Result: any caller able to reach the platform's HTTP port can POST `DatasetStatisticsList` payloads, regardless of auth configuration. The Security docs page (WebFetched 2026-05-20) EXPLICITLY lists this endpoint as one that 'remains outside the ingestion filter's coverage'." — evidence: IngestionController.java:82-87 (no auth annotations) + IngestionDataEntitiesFilter.java:28 (exact-literal path matcher) + SecurityConstants.java:95-96 (`/ingestion/**` whitelist) + WebFetch of enable-security page (2026-05-20, status 200) — severity: HIGH

- "Cross-dataset stats-write: a payload's `dataset_oddrn` is used ONLY to compute the FTS-recalc set (DatasetFieldServiceImpl.java:168-170, 179); the actual writes target `dataset_field` rows resolved BY FIELD ODDRN from the payload's `fields` map (line 172-174). An attacker who knows a target field's ODDRN can write arbitrary statistics to that field's `stats` JSONB column AND create EXTERNAL_STATISTICS tag relations on it — REGARDLESS of which dataset's ODDRN they declare in the parent `DataSetStatistics.datasetOddrn`. There is no parent-child consistency check. ODDRNs are deterministic strings often discoverable from a dataset's public catalog page; the field ODDRN format is `{datasource}/datasets/{dataset}/fields/{field}` or similar." — evidence: DatasetFieldServiceImpl.java:158-181 + IngestionController.java:82-87 (no validation hook) — severity: HIGH

- "Cross-owner stats-write: combines with the unauthenticated posture — collector A can post stats payloads targeting fields owned by team B (or no team / unowned). There is NO owner-scoping check. The `Owner` entity model exists for catalog-side identity but is not consulted on this ingestion path." — evidence: IngestionController.java:82-87 + DatasetFieldServiceImpl.java:158-181 (no Owner consult) + system-mission.md REFACTOR-024 cross-owner enumeration (read-collaborative posture extends to write on this path) — severity: HIGH

- "Empty/null payload mishandling. The controller does NOT guard against `items: []` (no-op transaction commits) or `items: null` (NPE at DatasetFieldServiceImpl.java:161 — `datasetStatisticsList.getItems().stream()` on null). The asymmetry with sibling `postDataEntityList` (which DOES guard via `CollectionUtils.isNotEmpty(items)` line 41) is silent — no comment defends it. An attacker submitting `{}` causes NPE → reactive default error handler → 500." — evidence: IngestionController.java:82-87 (no payload validation) + DatasetFieldServiceImpl.java:161,168 (null-unsafe `.getItems().stream()`) + sibling IngestionController.java:40-42 (the guard that this method lacks) — severity: MEDIUM

- "NO validation on numeric statistics fields. The OpenAPI schema declares fields like `IntegerFieldStat.nulls_count` as `format: int64` with NO `minimum` or `maximum` constraint (per the local `opendatadiscovery-specification` clone at `components.yaml:1596-1621` — required fields `low_value`, `high_value`, `nulls_count`, `unique_count`, no numeric bounds). Negative values, inverted ranges (`high_value < low_value`), NaN/Infinity in NumberFieldStat doubles, `unique_count > row_count` — all accepted, serialised verbatim into JSONB, and surface in downstream consumers (Quality Dashboard rings, BI tools reading `dataset_field.stats`). No application-layer validation in `DatasetFieldServiceImpl.updateFieldsStatistics` (line 233-251)." — evidence: opendatadiscovery-specification (local clone) `components.yaml:1596-1621` (no bounds) + DatasetFieldServiceImpl.java:233-251 (verbatim serialize-and-write) — severity: MEDIUM

- "Tag-creation-as-side-effect is reachable WITHOUT authentication AND WITHOUT TAG_CREATE permission. `tagService.getOrCreateTagsByName(...)` (DatasetFieldServiceImpl.java:202) is called inside `updateStatistics` and creates any tag name in the payload. The normal Tags-management UI surface is RBAC-gated; the stats path is the side-channel. An attacker can populate the catalog's tag taxonomy with arbitrary tag names by submitting `DatasetStatisticsList` payloads. The tags will be discoverable by all authenticated users via the catalog's tag search and tag-filter facet." — evidence: DatasetFieldServiceImpl.java:191-231 (`updateFieldsTags` → `tagService.getOrCreateTagsByName`) + IngestionController.java:82-87 (no auth) — severity: MEDIUM

- "Replay-removes-tags: a re-POST with FEWER tags than the previous POST silently REMOVES the absent EXTERNAL_STATISTICS-origin tags from the affected fields (DatasetFieldServiceImpl.java:221-223 — `relationsToDelete = existingRelations.filter(r -> !relationsToCreate.contains(r))`). A collector that briefly stops emitting a tag (e.g. due to a sampling bug) silently loses that tag. Same shape as the F-008 `silent_destruction_replace_not_merge` class on the entity-list path." — evidence: DatasetFieldServiceImpl.java:201-228 — severity: MEDIUM

- "No request size validation BEFORE deserialisation. Body is read into memory up to `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15); over-cap throws `DataBufferLimitException` → HTTP 500, not 413. An attacker can force the platform to buffer 20 MB per concurrent request with garbage stats payloads. No streaming JSON parser, no rate limit, no per-IP throttle." — evidence: IngestionController.java:82-87 (full-body reactive deserialise) + application.yml:14-15 (per sibling sidecar) + grep for `DataBufferLimitException` returns no `@ExceptionHandler` in `<odd-platform-repo>/odd-platform-api/src/main/java` — severity: MEDIUM

- "Unknown field ODDRNs are SILENTLY DROPPED with no log, no warning, no error response. `getLastVersionDatasetFieldsByOddrns(statistics.keySet())` (line 172-173) returns only the existing rows; field ODDRNs in the payload that don't match any platform row are simply absent from `existingFields`. The for-loop `for (final DatasetFieldPojo field : existingFields)` (line 237) iterates only over the resolved set. The `log.error('Unexpected behaviour while building an update object for datasetField {}', field.getOddrn())` (line 240-241) fires in the inverse case (a resolved field has no matching stat in the map — impossible by construction since the map's keys are the lookup input). A collector with a typo in field ODDRNs gets HTTP 201 Created but ZERO data is written." — evidence: DatasetFieldServiceImpl.java:172-181, 237-244 — severity: MEDIUM

- "FTS structure-vector recalc runs on EVERY ingest, even if no fields actually matched (`reactiveSearchEntrypointRepository.updateStructureVectorForDataEntitiesByOddrns(datasetOddrns)` — line 179). The `datasetOddrns` set is computed from the payload's `DataSetStatistics.datasetOddrn` field, NOT from the actually-resolved field rows. A payload with bogus field ODDRNs but a real `dataset_oddrn` still triggers an FTS recalc on the named dataset entity — a cheap DoS amplifier when combined with the unauthenticated posture." — evidence: DatasetFieldServiceImpl.java:168-170,179 — severity: LOW

- "201 response body is empty (`ResponseEntity.status(HttpStatus.CREATED).build()` — no body). The caller has no programmatic way to learn how many fields were actually updated, how many were silently dropped (unknown ODDRN), or which tags were created vs reconciled. Operator visibility into 'did my custom DQ-push integration actually work?' depends on subsequent UI checks." — evidence: IngestionController.java:86 (empty body) + DatasetFieldServiceImpl.java:158-181 (no return shape carrying counts) — severity: LOW

- "Idempotency at the data layer but NO idempotency key. Replaying the same `DatasetStatisticsList` produces the same final state (overwrite-by-field-ODDRN). Two concurrent POSTs against the SAME fields race inside the `@ReactiveTransactional` boundary; Postgres MVCC handles the row-level concurrency but the EXTERNAL_STATISTICS tag-reconciliation diff is computed independently per request — last-writer-wins on tags. No request-level lock; no idempotency-key header. The `updateFieldsTags` path's read-modify-write of relations (DatasetFieldServiceImpl.java:217-228) is not atomic across concurrent stats POSTs." — evidence: DatasetFieldServiceImpl.java:158-181 + IngestionController.java:82-87 (no key) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY — controller endpoint is permitAll() under all UI auth modes via SecurityConstants.WHITELIST_PATHS (/ingestion/** entry at SecurityConstants.java:95-96) AND is uncovered by any AbstractIngestionFilter subclass (IngestionDataEntitiesFilter binds exact-literal /ingestion/entities — sub-path /ingestion/entities/datasets/stats is unmatched). Effectively: this endpoint is UNAUTHENTICATED under DISABLED / OAUTH2 / LDAP / LOGIN_FORM, regardless of auth.ingestion.filter.enabled.` Per the Security docs page (WebFetched 2026-05-20, status 200): "/ingestion/entities/datasets/stats ... remain outside the ingestion filter's coverage" and "Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP — even when the ingestion filter is enabled."
- **ingestion_filter_relevance**: `NO — sibling path NOT covered by IngestionDataEntitiesFilter`. The filter's `PathPatternParserServerWebExchangeMatcher` is exact-literal `/ingestion/entities` (IngestionDataEntitiesFilter.java:28). `/ingestion/entities/datasets/stats` is a sub-path; Spring's `PathPatternParserServerWebExchangeMatcher` does NOT match it. The property name `auth.ingestion.filter.enabled` reads as namespace-scoped but the matcher is endpoint-scoped — this is the same trap as the sibling `/ingestion/alert/alertmanager` AlertManager webhook (documented at `concepts/detail/invariants/two-ingestion-filters-asymmetric-auth.yaml` lines 53-57, which explicitly lists `/ingestion/entities/datasets/stats` as a co-victim).
- **authorization_assertions**: `[]` — none at the controller-method layer. There is no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`, no inline auth check on `postDataSetStatsList` (verified: IngestionController.java:81-87). The `IngestionApi` interface this method overrides is OpenAPI-generated from `org.opendatadiscovery:ingestion-contract-server:0.1.40` and carries no security annotations either. The downstream `DatasetFieldServiceImpl.updateStatistics` (line 158-181) also has no authorization check. No layer in the chain enforces ownership, datasource-binding, or principal identity.
- **owner_scoping**: `BYPASSES — endpoint writes to any field by ODDRN, no owner consult`. The `Owner` model exists for catalog-side identity but is NOT consulted on this path. A `DataSetFieldStat` write at DatasetFieldServiceImpl.java:233-251 targets `dataset_field` rows resolved purely by field ODDRN from the payload. No `currentUser`, no `currentOwner`, no `dataset.owner` cross-check. Cross-owner write is the default behaviour, not a defensible exception.
- **data_exposure**:
  - "WRITE (unauthenticated): any caller able to reach the platform's HTTP port can write arbitrary stats payloads. The submitted statistics overwrite `dataset_field.stats` JSONB for any field whose ODDRN is in the payload. The fields' stats display on UI screens (Dataset Structure tab) for every authenticated viewer." — evidence: IngestionController.java:82-87 + DatasetFieldServiceImpl.java:233-251
  - "WRITE-side-effect on tag taxonomy: stats payload's per-field `tags` array CREATES catalog tags via `tagService.getOrCreateTagsByName(...)` (DatasetFieldServiceImpl.java:202). Tags persist in the catalog tag namespace and become searchable/filterable. An attacker can populate the catalog with arbitrary tag names (no TAG_CREATE permission required because no auth is required)." — evidence: DatasetFieldServiceImpl.java:191-231
  - "WRITE-side-effect on FTS vectors: the dataset entities named in the payload have their `search_entrypoint` tsvector index recomputed. Cheap-per-request but unbounded in aggregate." — evidence: DatasetFieldServiceImpl.java:179
- **known_security_gaps**:
  - "Controller has NO `@PreAuthorize` and the path is NOT covered by `IngestionDataEntitiesFilter` (exact-literal `/ingestion/entities` matcher — IngestionDataEntitiesFilter.java:28). `/ingestion/**` is in `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96) so UI auth modes don't protect it either. Result: `POST /ingestion/entities/datasets/stats` is UNAUTHENTICATED under every combination of `auth.type` and `auth.ingestion.filter.enabled`. Live docs (Security page, WebFetched 2026-05-20) DO surface this — but at the Security page, not at the Data Quality page where the endpoint is referenced." — evidence: IngestionController.java:81-87 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:95-96 + WebFetch of enable-security (2026-05-20, status 200) — severity: HIGH

  - "Cross-owner stats-write is the DEFAULT behaviour: an attacker (or a misconfigured collector A) can write arbitrary statistics to any dataset field owned by team B by knowing the field's ODDRN. Field ODDRNs follow a deterministic naming convention (`{datasource_oddrn}/datasets/{dataset_name}/fields/{field_name}` shape per the SDK conventions); they are visible in the platform's UI to all authenticated users. Combined with the unauthenticated posture, this is enumerable + writable by any HTTP caller." — evidence: DatasetFieldServiceImpl.java:172-174 (lookup by field ODDRN only) + IngestionController.java:82-87 (no auth) + REFACTOR-024 cross-owner enumeration context (system-mission.md) — severity: HIGH

  - "Tag-creation-as-side-effect bypasses `TAG_CREATE` permission. Statistics payloads with `DataSetFieldStat.tags = [{name: 'attacker-controlled'}]` create new catalog tags unauthenticatedly. The Tags management UI is RBAC-gated; the stats path is the bypass. Tags persist in the global tag namespace and are discoverable by all authenticated users via tag search and tag-filter facets." — evidence: DatasetFieldServiceImpl.java:191-231 (`tagService.getOrCreateTagsByName(...)` + `createDatasetFieldRelations`) + TagOrigin.java:6 — severity: MEDIUM

  - "Cross-dataset stats-write: payload `dataset_oddrn` is NOT validated against field ODDRNs' parent-dataset relationship. A malicious payload `{dataset_oddrn: A, fields: {odd:datasource:B:dataset:b:field:b1: <stats>}}` writes stats to field `b1` of dataset B while triggering FTS recalc on dataset A. Useful for cross-dataset audit confusion." — evidence: DatasetFieldServiceImpl.java:158-181 (no parent-child cross-check) — severity: MEDIUM

  - "Body-buffered-before-validation: 20 MB body is read into memory before deserialisation completes; over-cap throws DataBufferLimitException → 500 (not 413). Combined with unauthenticated posture, an attacker can force 20 MB per concurrent request — heap-pressure DoS surface. No rate limit, no per-IP throttle, no streaming parser." — evidence: IngestionController.java:82-87 + application.yml:14-15 (per sibling sidecar) — severity: MEDIUM

  - "No diagnostic logging on the controller path. No `log.info('stats ingested for {} fields')`, no `log.warn('unknown field oddrn {}')`. A security incident review of 'who wrote stats to which fields' is unanswerable from application logs. Activity log does NOT record stats writes — there is no `@ActivityLog(event = ...)` on `DatasetFieldServiceImpl.updateStatistics` (line 158-181), unlike the sibling `updateInternalName` and `updateDatasetFieldTags` methods (lines 99, 119) which ARE audited." — evidence: IngestionController.java:30 (@Slf4j present but unused on this method) + DatasetFieldServiceImpl.java:158-181 (no @ActivityLog, no log.info/warn calls) — severity: MEDIUM (audit-trail gap on a write surface)

  - "No `@PreAuthorize` and no `@PostAuthorize` on the downstream `DatasetFieldService.updateStatistics` interface method (DatasetFieldService.java:28) either. The four other DatasetFieldService methods (`updateDescription`, `updateInternalName`, `updateDatasetFieldTags`, `listByTerm`) do NOT carry method-level auth in the interface, but their UI-facing controller wrappers carry `@PreAuthorize` checks; for stats ingestion, there is NO UI-facing wrapper — the only caller is the unauthenticated `IngestionController.postDataSetStatsList`." — evidence: DatasetFieldService.java:16-31 + IngestionController.java:82-87 — severity: LOW (composition, not bug)

## performance

- **hot_paths**:
  - "Every `POST /ingestion/entities/datasets/stats` request incurs: 1 reactive body-collect (up to 20 MB), 1 Jackson deserialise to `DatasetStatisticsList`, 1 IngestionService passthrough, 1 reactive transaction begin on `DatasetFieldServiceImpl.updateStatistics`, 1 `getLastVersionDatasetFieldsByOddrns` lookup (`SELECT ... WHERE oddrn IN (?)` — `IN` clause expands with payload field count), 1 bulkUpdate of `dataset_field.stats` JSONB column, parallel tag-reconciliation sub-flow (1 `getOrCreateTagsByName` round-trip + 1 `listTagsRelations` lookup + N deletes + M creates), 1 `updateStructureVectorForDataEntitiesByOddrns` for FTS recalc on the affected dataset entities, transaction commit." — evidence: IngestionController.java:82-87 + IngestionServiceImpl.java:76-79 + DatasetFieldServiceImpl.java:158-181
- **throughput_characteristics**:
  - "Per-request batch semantics — one `DatasetStatisticsList` per HTTP call. The payload aggregates per-dataset stats records (one `DataSetStatistics` per dataset) with per-field stats (one entry per dataset field). A profiler collector typically batches all-fields-of-one-dataset per call; one POST per dataset per profiling tick."
  - "Synchronous response — controller does NOT return 202 Accepted + background processing. Connection held open for body parse + transaction execution. Slow Postgres / R2DBC saturation surfaces as HTTP timeouts on the collector side, prompting retries — which compound load."
  - "Reactive `Mono` signature — non-blocking from WebFlux. `Mono.zipDelayError` (DatasetFieldServiceImpl.java:175) runs the stats-update and tag-reconciliation in parallel WITHIN the request reactor context."
- **resource_allocation**:
  - "Full request body buffered up to `spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) during deserialisation. Per-request heap allocation: ~20 MB cap + Jackson POJO graph for the parsed `DatasetStatisticsList`. NO filter-side body re-parse on this path (the filter doesn't apply), so the body is parsed only once — better than `postDataEntityList` under filter-on which parses twice."
  - "Transaction lifetime spans the entire `DatasetFieldServiceImpl.updateStatistics` (line 159) call. No row-level lock acquired on a parent datasource (unlike `postDataEntityList` which holds `SELECT ... FOR UPDATE` on `data_source`). Per-field `dataset_field` row UPDATEs acquire short-lived row locks at MVCC; concurrent ingests of the same field race on the row lock but don't block on a parent."
  - "FTS structure-vector recalc inside the request flow (DatasetFieldServiceImpl.java:179) — recomputes Postgres tsvector for the affected dataset entities. O(N) per dataset where N is the field count; cheap per-call but unbounded under concurrent ingest."
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally without coordination."
  - "Per-field `dataset_field` row writes serialise concurrent ingests of the SAME field on MVCC row lock. Cross-field, cross-dataset ingests proceed in parallel."
  - "No pagination on input — a single payload can contain thousands of `DataSetStatistics` items each with thousands of fields. Field-count is bounded only by the 20 MB body cap. The `IN` clause expansion in `getLastVersionDatasetFieldsByOddrns` grows linearly with field count; Postgres plan-cache may be invalidated by varying IN-clause cardinality."
- **known_performance_gaps**:
  - "Synchronous-blocking-on-pipeline: NO 202+queue mode. A profiler collector ingesting stats for 10K-field datasets holds the HTTP connection open + transaction open for the duration. Cost of an async mode: persistence-layer complexity + back-channel for failure reporting. Same shape as the sibling postDataEntityList gap." — evidence: IngestionController.java:82-87 + DatasetFieldServiceImpl.java:158-181 — severity: LOW

  - "FTS recalc on every ingest, including no-op ingests. If payload's field ODDRNs all fail to resolve (no matching `dataset_field` rows), `existingFields` is empty, `fieldsToUpdate` is empty, NO `dataset_field.stats` write happens — BUT `updateStructureVectorForDataEntitiesByOddrns(datasetOddrns)` STILL runs (line 179) for every dataset_oddrn in the payload. An attacker submitting payloads with bogus field ODDRNs + a list of real dataset ODDRNs triggers FTS recalc work for each named dataset. Combined with the unauthenticated posture, this is a cheap DoS amplifier — the FTS recalc work is bounded but unbounded-in-aggregate per concurrent attacker." — evidence: DatasetFieldServiceImpl.java:158-181 (no early-exit on empty fieldsToUpdate before FTS recalc) — severity: MEDIUM

  - "`getOrCreateTagsByName` (DatasetFieldServiceImpl.java:202) issues a SELECT + INSERT per unseen tag name. A payload with 10K unique tag names triggers 10K round-trips inside the transaction (the operation is not batched at this call-site — verify in `TagService.getOrCreateTagsByName` impl; the verb suggests one-at-a-time semantics). NO test exercises high-cardinality tags." — evidence: DatasetFieldServiceImpl.java:201-204 — severity: LOW

## sources

- understanding ← IngestionController.java:81-87 + IngestionServiceImpl.java:76-79 + DatasetFieldServiceImpl.java:158-181 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:95-96
- concepts.entities.DatasetStatisticsList ← IngestionController.java:14 (import) + IngestionController.java:82 (signature) + gradle/libs.versions.toml:6,65,142 (`ingestion-contract-server:0.1.40` as the artefact that ships the generated model)
- concepts.entities.DataSetStatistics ← DatasetFieldServiceImpl.java:33 (import) + DatasetFieldServiceImpl.java:161-169 (consumer code revealing the `getFields()` + `getDatasetOddrn()` API)
- concepts.entities.DataSetFieldStat ← DatasetFieldServiceImpl.java:32 (import) + DatasetFieldServiceImpl.java:233-251 (consumer code) + opendatadiscovery-specification/components.yaml:1523-1541 (local clone of the external schema definition — DataSetFieldStat is a discriminated union of 7 stats variants)
- concepts.entities.IngestionService.ingestStats ← IngestionService.java:10 + IngestionServiceImpl.java:76-79
- concepts.entities.DatasetFieldService.updateStatistics ← DatasetFieldService.java:28 + DatasetFieldServiceImpl.java:158-181
- concepts.entities.dataset_field.stats_jsonb ← DatasetFieldServiceImpl.java:246 (`field.setStats(JSONB.jsonb(JSONSerDeUtils.serializeJson(stat)))`)
- concepts.entities.TagOrigin.EXTERNAL_STATISTICS ← TagOrigin.java:6 + DatasetFieldServiceImpl.java:273-278
- concepts.invariants[0] ← IngestionController.java:81-87 (no annotations) + IngestionDataEntitiesFilter.java:28 (exact-literal matcher) + SecurityConstants.java:95-96 + WebFetch of enable-security page (2026-05-20)
- concepts.invariants[1] ← IngestionController.java:82-87 (no `CollectionUtils.isNotEmpty` guard) + DatasetFieldServiceImpl.java:161,168 (null-unsafe `.getItems().stream()`) + sibling IngestionController.java:40-42 (the guard this method lacks)
- concepts.invariants[2] ← IngestionController.java:86 (`HttpStatus.CREATED`) + sibling IngestionController.java:94 (also 201) + postDataEntityList sibling sidecar concepts.invariants[2] (the spec-vs-impl drift on the entity path)
- concepts.invariants[3] ← DatasetFieldServiceImpl.java:233-251 (overwrite-by-bulkUpdate) + DatasetFieldServiceImpl.java:201-228 (tag delete-and-recreate reconciliation)
- concepts.invariants[4] ← DatasetFieldServiceImpl.java:172-174 (field-ODDRN lookup) + IngestionController.java:82-87 (no principal consult) + IngestionServiceImpl.java:76-79 (no row lock, no datasource resolution)
- concepts.invariants[5] ← IngestionController.java:82 (`Mono<DatasetStatisticsList>` signature) + sibling IngestionController.java:38 + application.yml:14-15 (per sibling sidecar)
- dependencies_semantic.requires-feature.IngestionApi ← IngestionController.java:10 (import) + IngestionController.java:31 (`implements IngestionApi`) + gradle/libs.versions.toml:6 (ingestion-contract-server version) + BaseIngestionTest.java:84 (path string `/ingestion/entities/datasets/stats`)
- dependencies_semantic.requires-feature.IngestionService.ingestStats ← IngestionController.java:18 + IngestionService.java:10 + IngestionServiceImpl.java:76-79
- dependencies_semantic.requires-feature.DatasetFieldService.updateStatistics ← DatasetFieldService.java:28 + DatasetFieldServiceImpl.java:158-181
- dependencies_semantic.requires-feature.updateStructureVectorForDataEntitiesByOddrns ← DatasetFieldServiceImpl.java:179
- dependencies_semantic.requires-feature.TagOrigin.EXTERNAL_STATISTICS ← TagOrigin.java:6 + DatasetFieldServiceImpl.java:218,277
- dependencies_semantic.requires-config ← application.yml:14-15 (per sibling sidecar) + IngestionDataEntitiesFilter.java:28 (path-matcher scope evidence)
- dependencies_semantic.coupling[0] ← IngestionController.java:31 + IngestionController.java:81-87 + gradle/libs.versions.toml:6
- dependencies_semantic.coupling[1] ← IngestionController.java:82-87 vs IngestionController.java:40-42 (sibling guard)
- dependencies_semantic.coupling[2] ← IngestionDataEntitiesFilter.java:28 (exact-literal matcher) + concepts/detail/invariants/two-ingestion-filters-asymmetric-auth.yaml lines 53-57
- dependencies_semantic.coupling[3] ← IngestionServiceImpl.java:76-79 (no annotation) + IngestionServiceImpl.java:66 (sibling `ingest` IS annotated) + DatasetFieldServiceImpl.java:159 (annotation lives here for the stats path)
- dependencies_semantic.coupling[4] ← IngestionController.java:44 (postDataEntityList=200) + IngestionController.java:86 (postDataSetStatsList=201) + IngestionController.java:94 (ingestMetrics=201)
- dependencies_semantic.coupling[5] ← DatasetFieldServiceImpl.java:202 + IngestionController.java:81-87 (tag-creation-as-side-effect bypasses TAG_CREATE)
- tests_coverage_semantic.test_files ← BaseIngestionTest.java:82-88 + DatasetFieldIngestionTest.java line 256-291 (excerpt seen) + IngestionModelGenerator.java:70-90
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-20T00:00:00Z of https://docs.opendatadiscovery.org/features/data-quality (status 200) — only doc page that mentions the endpoint by name
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-20T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security (status 200) — explicit verbatim mention of the filter-coverage gap
- docs_link_semantic.inferred_docs[2] ← WebFetch 2026-05-20T00:00:00Z of https://docs.opendatadiscovery.org/features/active-platform-features/data-quality/test-results-import (status 404)
- docs_link_semantic.doc_drift_findings[0] ← absence of payload-shape narrative on the data-quality page (WebFetched 2026-05-20)
- docs_link_semantic.doc_drift_findings[1] ← Security docs surface the gap at the wrong page from an operator's path-of-discovery (WebFetched 2026-05-20 of /features/data-quality + /configuration-and-deployment/enable-security)
- docs_link_semantic.doc_drift_findings[2] ← DatasetFieldServiceImpl.java:191-231 (tag-as-side-effect) + WebFetch 2026-05-20 (no doc surfaces this)
- docs_link_semantic.doc_drift_findings[3] ← DatasetFieldServiceImpl.java:201-228 + F-008 drift class `silent_destruction_replace_not_merge`
- implicit_adrs[0] ← IngestionController.java:81-87 (thin proxy) + IngestionServiceImpl.java:76-79 (passthrough) + DatasetFieldServiceImpl.java:158-181 (the @ReactiveTransactional boundary)
- implicit_adrs[1] ← IngestionController.java:86 (201) + IngestionController.java:94 (201 sibling) + IngestionController.java:44 (200 sibling) + postDataEntityList sibling sidecar
- implicit_adrs[2] ← DatasetFieldServiceImpl.java:273-278 (`createExternalStatisticsRelation`) + TagOrigin.java:6 + DatasetFieldServiceImpl.java:218 (`listTagsRelations(..., TagOrigin.EXTERNAL_STATISTICS)`)
- bugs_limitations_corner_cases[0] ← IngestionController.java:81-87 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:95-96 + WebFetch enable-security page
- bugs_limitations_corner_cases[1] ← DatasetFieldServiceImpl.java:168-179 (cross-dataset write evidence) + IngestionController.java:81-87
- bugs_limitations_corner_cases[2] ← IngestionController.java:81-87 + DatasetFieldServiceImpl.java:158-181 + system-mission.md REFACTOR-024
- bugs_limitations_corner_cases[3] ← IngestionController.java:82-87 + DatasetFieldServiceImpl.java:161,168 + IngestionController.java:40-42 (sibling guard)
- bugs_limitations_corner_cases[4] ← opendatadiscovery-specification/components.yaml:1596-1621 + DatasetFieldServiceImpl.java:233-251
- bugs_limitations_corner_cases[5] ← DatasetFieldServiceImpl.java:191-231 + IngestionController.java:81-87
- bugs_limitations_corner_cases[6] ← DatasetFieldServiceImpl.java:221-223 (relationsToDelete computation)
- bugs_limitations_corner_cases[7] ← IngestionController.java:82-87 + application.yml:14-15
- bugs_limitations_corner_cases[8] ← DatasetFieldServiceImpl.java:172-181, 237-244 (silent drop + inverse-direction log)
- bugs_limitations_corner_cases[9] ← DatasetFieldServiceImpl.java:168-170, 179 (FTS recalc fires on dataset_oddrn even when no fields resolved)
- bugs_limitations_corner_cases[10] ← IngestionController.java:86 (empty body) + DatasetFieldServiceImpl.java:158-181 (no return shape)
- bugs_limitations_corner_cases[11] ← DatasetFieldServiceImpl.java:217-228 (read-modify-write not atomic across concurrent POSTs)
- security.auth_mode_relevance ← IngestionController.java:81-87 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:95-96 + WebFetch enable-security (2026-05-20)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 (exact-literal matcher) + concepts/detail/invariants/two-ingestion-filters-asymmetric-auth.yaml lines 53-57
- security.authorization_assertions ← IngestionController.java:81-87 (verified empty) + DatasetFieldServiceImpl.java:158-181 (verified empty)
- security.owner_scoping ← IngestionController.java:81-87 + DatasetFieldServiceImpl.java:158-181 (no Owner consult)
- security.data_exposure[0] ← IngestionController.java:81-87 + DatasetFieldServiceImpl.java:233-251
- security.data_exposure[1] ← DatasetFieldServiceImpl.java:191-231 (tag taxonomy mutation)
- security.data_exposure[2] ← DatasetFieldServiceImpl.java:179 (FTS recalc)
- security.known_security_gaps[0] ← IngestionController.java:81-87 + IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:95-96 + WebFetch enable-security
- security.known_security_gaps[1] ← DatasetFieldServiceImpl.java:172-174 + IngestionController.java:82-87 + system-mission.md REFACTOR-024
- security.known_security_gaps[2] ← DatasetFieldServiceImpl.java:191-231 + TagOrigin.java:6
- security.known_security_gaps[3] ← DatasetFieldServiceImpl.java:158-181 (no parent-child cross-check)
- security.known_security_gaps[4] ← IngestionController.java:82-87 + application.yml:14-15 (per sibling sidecar)
- security.known_security_gaps[5] ← IngestionController.java:30 (@Slf4j present, unused on this method) + DatasetFieldServiceImpl.java:158-181 (no @ActivityLog vs sibling lines 99,119)
- security.known_security_gaps[6] ← DatasetFieldService.java:16-31 + IngestionController.java:82-87
- performance.hot_paths ← IngestionController.java:82-87 + IngestionServiceImpl.java:76-79 + DatasetFieldServiceImpl.java:158-181
- performance.throughput_characteristics ← IngestionController.java:82-87 (synchronous .thenReturn) + DatasetFieldServiceImpl.java:175 (Mono.zipDelayError parallel sub-flows)
- performance.resource_allocation ← application.yml:14-15 (per sibling sidecar) + IngestionController.java:82 + DatasetFieldServiceImpl.java:179
- performance.scaling_characteristics ← IngestionController.java:32-35 (stateless) + DatasetFieldServiceImpl.java:172-174 (IN-clause expansion)
- performance.known_performance_gaps[0] ← IngestionController.java:82-87 + DatasetFieldServiceImpl.java:158-181 (no 202+queue)
- performance.known_performance_gaps[1] ← DatasetFieldServiceImpl.java:158-181 (no early-exit before FTS recalc)
- performance.known_performance_gaps[2] ← DatasetFieldServiceImpl.java:201-204 (one-at-a-time semantics inferred from verb)

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

