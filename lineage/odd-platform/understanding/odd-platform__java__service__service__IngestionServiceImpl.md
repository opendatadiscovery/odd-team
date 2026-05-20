---
node_id: "odd-platform java service service:IngestionServiceImpl"
node_kind: service
axis: services
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Z-IngestionServiceImpl-retry
related_features:
  - F-008  # Batch Ingestion (S2S API) — pillar P-10 — this sidecar is the SERVICE-TIER VERTEX of the 5-vertex picture
related_pillar_features:
  - P-10:F-001  # Batch Ingestion (S2S API)
sibling_sidecars:
  - lineage/odd-platform/understanding/odd-platform__java__service__service__IngestionService.md  # interface-axis sidecar (batch I) — macro narrative for the 14-processor chain
  - lineage/odd-platform/understanding/odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md  # batch O — hop-0 filter-layer vertex
  - lineage/odd-platform/understanding/odd-platform__java__repository_reactive__repository__ReactiveDataEntityRepositoryImpl.md  # batch H/R — repository-tier vertex (the SQL substrate)
  - lineage/odd-platform/understanding/odd-platform__java__repository_reactive__repository__ReactiveLineageRepositoryImpl.md  # batch H — lineage repository-tier vertex
  - lineage/odd-platform/understanding/odd-platform__java__service__service__LineageServiceImpl.md  # batch I — lineage service-tier vertex (LineageServiceImpl.replaceLineagePaths)
---

# IngestionServiceImpl — semantic understanding

> **F-008 5-vertex closure context.** This sidecar is the **service-tier vertex** of
> F-008 (Batch Ingestion / S2S API, pillar P-10:F-001) and closes the 5-vertex
> picture established across earlier batches:
>
> - **Hop-0 filter vertex (batch O)** — `IngestionDataEntitiesFilter` — sibling
>   sidecar `odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md`.
>   Establishes the default-OFF auth posture (`auth.ingestion.filter.enabled=false`
>   per application.yml:48).
> - **Hop-1 controller vertex (batch P, unresolved)** — `IngestionController.postDataEntityList`
>   — IngestionController.java:38-45 thin `.flatMap(ingestionService::ingest)`
>   delegate. No principal extraction; no per-caller scoping.
> - **Hop-2 service vertex (THIS sidecar, batch Z)** — `IngestionServiceImpl.ingest`
>   at IngestionServiceImpl.java:65-74. The single-transaction-per-batch enforcement
>   point. Payload-driven datasource resolution via `getIdByOddrnForUpdate` (line
>   68). NO principal check, NO cross-tenant assertion at this layer.
> - **Hop-3 processor-chain vertex (batch I IngestionService sidecar)** — the
>   14 `IngestionRequestProcessor` beans (INITIAL/MAIN/FINALIZING). Two are
>   silently destructive: `MetadataIngestionRequestProcessor.java:72-80`
>   (delete-on-absence for metadata bindings) and
>   `LineageIngestionRequestProcessor.java:17` (replace-not-merge for lineage
>   establishers). Both run inside this service's `@ReactiveTransactional`.
> - **Hop-4 repository-tier vertex (batch H/R)** — `ReactiveDataEntityRepositoryImpl`,
>   `ReactiveLineageRepositoryImpl`, `ReactiveDataSourceRepositoryImpl`. The SQL
>   substrate of the destruction: plain INSERT (no ON CONFLICT), batch DELETE
>   keyed by establisher / metadata binding, `SELECT … FOR UPDATE` on
>   `data_source` (the serialisation invariant).
>
> The **interface-axis sibling** (`IngestionService.md`, session-2026-05-19-I)
> carries the macro narrative (14-processor inventory, processor-chain table,
> upstream-callers table, full downstream-side-effects ledger, doc-drift
> findings). This **impl-axis** sidecar anchors to the impl-class internals
> — the line-anchored invariants of `persistDataEntities` and
> `buildIngestionRequest`, the private `extract*Relations` helpers, the
> delta-counter math — without re-printing the macro story. Read both
> together for the full F-008 service-tier picture.
>
> **Coherence (Rule 6 / LSN-018 cross-registry check).** This sidecar refreshes
> the F-008 service-tier evidence without contradicting F-008 detail YAML,
> the batch-I `IngestionService.md` sibling, the batch-O filter sibling, or
> the batch-H/R repository siblings. Where the present file's observation
> overlaps a F-008 drift facet (`silent_destruction_replace_not_merge`,
> `single_transaction_per_batch_no_per_entity_isolation`,
> `notfoundexception_surfaces_as_5xx_info_leak` at the service-tier mirror),
> the back-link is to F-008 via `related_features` above. New observations
> (the duplicate-ODDRN crash, the null-entityClassIds NPE, the
> @Slf4j-unused-no-audit-trail surface, the four-pass Stream.concat O(4N))
> are file-local to this impl class and do not duplicate any existing
> F-008 drift facet.

## understanding

`IngestionServiceImpl` is the only platform-side implementation of `IngestionService`
(IngestionService.java:7-11). Its `ingest(DataEntityList)` (line 65-74) is a five-step
reactive chain wrapped in `@ReactiveTransactional`: resolve the target datasource id
by ODDRN with row-lock (`getIdByOddrnForUpdate`), call the private
`persistDataEntities(dataSourceId, items)` (line 81-152) which does the partition + upsert
+ build-IngestionRequest work, hand the assembled `IngestionRequest` to
`IngestionProcessorChain.processIngestionRequest`, push to `OTLPMetricService.exportMetrics`,
collapse to `Mono<Void>`. The companion `ingestStats(DatasetStatisticsList)` (line 76-79)
is a one-line delegate to `DatasetFieldService.updateStatistics(...)` — NOT
`@ReactiveTransactional` at this layer. The rest of the file (line 81-315) is the private
machinery: `persistDataEntities`, `buildIngestionRequest`, four `extract*Relations`
helpers, `calculateTotalDeltaCount`, `calculateDeltaValues`, `classesAndTypeFilled`.

## concepts

- entities:
  - "`IngestionService` (interface — IngestionService.java:7-11 — two methods, NO principal parameter)"
  - "`DataEntityList` (request payload — `data_source_oddrn` + `items: List<DataEntity>`)"
  - "`DataEntityIngestionDto` (internal representation — built by `IngestionMapper.createIngestionDto(de, dataSourceId)`, keyed by ODDRN in the per-call `Map<String, DataEntityIngestionDto> ingestionDtoMap`)"
  - "`IngestionTaskRun` (built by `IngestionMapper.mapTaskRun(de)` — separate flow for JOB_RUN-typed items)"
  - "`DataEntityPojo` (jOOQ-generated POJO — the DB row shape)"
  - "`EnrichedDataEntityIngestionDto` (carries `id` + `previousVersionPojo` + the original DTO — built at line 119 for existing entities, line 143 for new entities)"
  - "`DataEntitySpecificAttributesDelta` (per-existing-non-MICROSERVICE entity old-vs-new JSON pair — line 100-113)"
  - "`DataEntityTotalDelta` (record with `totalDelta: long + entityDelta: Map<Integer, Map<Integer, Long>>` — built by `calculateTotalDeltaCount` line 276-301)"
  - "`IngestionRequest` (assembled by `buildIngestionRequest` line 154-197 — the union object passed downstream to the 14-processor chain)"
  - "`LineagePojo` (lineage edges built by `extractLineageRelations` line 233-274 from `dataSet.parentDatasetOddrn`, `dataTransformer.sourceList/targetList`, `dataConsumer.inputList`)"
  - "`DataQualityTestRelationsPojo` (built by `extractDataQARelations` line 210-219)"
  - "`GroupEntityRelationsPojo` (built by `extractGroupEntityRelations` line 199-208)"
  - "`GroupParentGroupRelationsPojo` (built by `extractGroupParentGroupRelations` line 221-231)"
- operations:
  - resolve-datasource-id-by-payload-oddrn-FOR-UPDATE (line 68)
  - error-on-unknown-datasource-via-NotFoundException (line 69)
  - delegate-to-persistDataEntities (line 70)
  - delegate-to-IngestionProcessorChain (line 71)
  - delegate-to-OTLPMetricService (line 72)
  - collapse-to-Mono-Void (line 73)
  - partition-JOB_RUN-from-other-entities (line 83-86 vs line 88-91)
  - map-DataEntity-to-DataEntityIngestionDto-keyed-by-ODDRN (line 83-86)
  - map-JOB_RUN-DataEntity-to-IngestionTaskRun (line 88-91)
  - fetch-existing-pojos-by-ODDRN-list-including-hollow-and-deleted (line 93-94)
  - partition-DTOs-by-existing-vs-new (line 96-98)
  - build-specific-attributes-deltas-excluding-MICROSERVICE (line 100-113)
  - build-enriched-existing-DTOs (line 115-121)
  - lower-existing-DTOs-to-pojo-for-bulkUpdate (line 123-125)
  - filter-previous-DELETED-pojos-for-restore (line 127-131)
  - lower-new-DTOs-to-pojo-for-bulkCreate (line 133)
  - bulk-update (line 134)
  - restore-deleted-relations (line 135-136)
  - calculate-total-delta-count (line 138-139 + line 276-301)
  - bulk-create-and-enrich-with-returned-ids (line 141-143)
  - sequence-write-operations-then-build-request (line 145-150)
- invariants:
  - "`ingest(...)` is `@ReactiveTransactional` (line 66, expanded via ReactiveTransactional.java:11 to `@Transactional(\"reactiveTransactionManager\")`); `ingestStats(...)` is NOT (line 76-79 carries only `@Override`). Two different transactional boundaries for the two methods on the same interface. The `@ReactiveTransactional` here is the **outer** transaction binding the WHOLE 14-processor chain (per F-008 chain hop-3) + the OTLP export — one failure anywhere rolls back the entire batch (the `batch_atomicity_without_signal` F-008 drift facet enforced at THIS line)."
  - "`persistDataEntities` does the JOB_RUN split BEFORE any DB call: items where `d.getType().equals(JOB_RUN)` go to `mapTaskRun(...)` (line 88-91) and become `IngestionTaskRun` records; all other items are mapped to `DataEntityIngestionDto`. A `DataEntityList` mixing JOB_RUN and other types in one payload routes them through two separate flows in one transaction."
  - "Entity dedup is by ODDRN at the application layer. `ingestionDtoMap` is `Map<String, DataEntityIngestionDto>` keyed by ODDRN (`Collectors.toMap(DataEntityIngestionDto::getOddrn, identity())` — line 86). If the same ODDRN appears twice in the inbound `items` list, `Collectors.toMap` THROWS `IllegalStateException: Duplicate key` (default merge function refuses duplicates). The platform does not silently deduplicate within a single payload — same-ODDRN duplicates within one request crash the entire ingestion. No test asserts this behaviour. Sibling-call evidence: `Collectors.toMap` with two-arg call uses the default throwing merger."
  - "`dataEntityRepository.listByOddrns(ingestionDtoMap.keySet(), true, true)` (line 93) fetches ALL existing rows for the inbound ODDRNs INCLUDING hollow rows AND including soft-deleted rows (the two booleans are `includeHollow=true`, `includeDeleted=true`). This is what makes the soft-delete-restore path possible: the existing-entity partition includes rows the platform previously soft-deleted, and the code branches on `previousVersionPojo.getStatus().equals(DataEntityStatusDto.DELETED.getId())` (line 127-131) to restore them."
  - "MICROSERVICE existing entities are EXCLUDED from `specificAttributesDeltas` (line 100-113: `filter(e -> DataEntityTypeDto.MICROSERVICE != e.getValue().getType())`). The `specificAttributesDeltas` list is what feeds backwards-incompatible-schema alert detection downstream (per AlertIngestionRequestProcessor.java:60 — `alertLocator.getAlertBISCandidates(request.getSpecificAttributesDeltas(), request.getChangedDatasetIds())`) — so microservices CANNOT raise BIS alerts via the specific-attributes path. The exclusion is undocumented; no comment defends it (line 103 carries only the filter expression, no `// ...` annotation). F-008 drift facet `undocumented_carve_out` is enacted on THIS line."
  - "`bulkCreate(pojosToCreate)` (line 142) returns `Flux<DataEntityPojo>` of the **inserted rows with their generated DB IDs**. The `.map(d -> new EnrichedDataEntityIngestionDto(d.getId(), null, ingestionDtoMap.get(d.getOddrn())))` (line 143) re-joins the returned row to the original input DTO via the ODDRN key — passing `previousVersionPojo=null` (new entities have no previous version). The dependency on `ingestionDtoMap.get(d.getOddrn())` requires every newly-inserted DB row to have an ODDRN that matches a key in `ingestionDtoMap`; if the DB returns a row with a different ODDRN (e.g. via a trigger that rewrites the value), the map lookup returns `null` and the EnrichedDto carries `null` for the underlying DTO."
  - "`bulkCreate` is a plain INSERT — no ON CONFLICT clause. Verified at ReactiveAbstractCRUDRepository.java:114-126 (`insertManyReturning(records)`). Concurrent ingestions targeting the same ODDRN-in-same-datasource are **prevented by the `data_source` row lock** (`getIdByOddrnForUpdate` at line 68 = `SELECT id FROM data_source WHERE oddrn=? AND deleted_at IS NULL FOR UPDATE` per ReactiveDataSourceRepositoryImpl.java:94-101). Cross-datasource concurrent ingestions of the same ODDRN are NOT serialised (the lock is per-datasource); whether the `data_entity.oddrn` column has a global UNIQUE constraint determines what happens (unverified in this batch — would require schema check)."
  - "`calculateTotalDeltaCount` (line 276-301) maintains a `Map<entityClassId, Map<typeId, Long>>` of class×type counters. New non-hollow entities increment by +1 (line 281-286). Existing entities have their PREVIOUS class×type DECREMENTED by 1 if the previous pojo had non-null classes-and-type (line 288-292), then their NEW class×type INCREMENTED by 1 (line 293). The total delta count is `hollowUpdatedEntitiesCount + searchablePojos.size()` (line 300) — hollow-to-real upgrades count as a +1 (the hollow row existed but was excluded from search; promoting it to a real entity adds 1 to the total)."
  - "Lineage extraction (`extractLineageRelations` line 233-274) is driven by ENTITY CLASSES, not by entity type. A single entity that is BOTH `DATA_SET` and `DATA_CONSUMER` (multi-class entities exist in the contract) will produce lineage edges from BOTH branches: parentDatasetOddrn from the DATA_SET branch (line 238-246) AND inputList from the DATA_CONSUMER branch (line 264-271). `DATA_TRANSFORMER` produces edges from BOTH sourceList and targetList (line 248-262). The `establisherOddrn` is always the DTO's own ODDRN (line 243, 253, 260, 269) — meaning a lineage edge 'established by' this entity will be REPLACED on next ingestion of this entity (per LineageService.replaceLineagePaths batchDeleteByEstablisherOddrn at LineageServiceImpl.java:131). This is the **assembly-layer** enactment of F-008's `silent_destruction_replace_not_merge` drift facet — the destructive verb lives downstream in LineageIngestionRequestProcessor, but the establisher-keyed payload that DRIVES the destruction is built right here at line 243/253/260/269."
  - "DEG (DATA_ENTITY_GROUP) handling: `extractGroupEntityRelations` (line 199-208) emits a `GroupEntityRelationsPojo` per (DEG, member-entity) pair from `dto.getDataEntityGroup().entitiesOddrns()`; `extractGroupParentGroupRelations` (line 221-231) emits ONE `GroupParentGroupRelationsPojo` per DEG that has a non-null `groupOddrn` (the parent DEG). Both emit `false` as the third pojo constructor arg (line 206, 230) — that's the `is_manual` flag, meaning these relations are flagged as collector-driven (not UI-created). The downstream `GroupEntityRelationIngestionRequestProcessor` does a DELETE-then-CREATE pattern (GroupEntityRelationIngestionRequestProcessor.java:18-21) — silent destruction class confirmed at this assembly layer (the relations REPLACE the existing set on each ingestion). The `false` flag also means UI-created DEG memberships (the `true` flag side) are NOT touched by collector ingestion — there is a structural separation between collector-driven and UI-driven group memberships."
  - "**No principal check at this layer.** The whole 80-line orchestration callback at line 95-151 reads ONLY: the datasource id resolved from the payload ODDRN (line 68), the inbound `List<DataEntity>` (line 82), the existing pojos fetched from the DB (line 93). NO `ServerWebExchange`, NO `SecurityContext`, NO collector-id from session, NO @AuthenticationPrincipal. The service operates on whatever datasource the payload names — F-008 drift facet `datasource_scoping_is_payload_driven_not_principal_driven` enforced at line 68. Cross-tenant scoping is the upstream filter's responsibility (batch-O sibling `IngestionDataEntitiesFilter` — default OFF — and the per-datasource token resolution at IngestionDataEntitiesFilter.java:43-51). This service trusts the filter's verdict OR — under bundled defaults — trusts NOTHING."
- audiences: [contributors editing `IngestionServiceImpl` directly, reviewers checking the per-line invariants of the impl, security auditors anchoring to specific lines, performance reviewers analysing the per-method DB cost, F-008 5-vertex closure reviewers]

## dependencies_semantic

> See sibling `IngestionService.md` for the upstream-callers, downstream-side-effects,
> processor-chain composition, and config dependencies. This block records only the
> Impl-specific couplings the interface sidecar consolidated up.

- requires-feature:
  - "`IngestionMapper` (line 63) — the Impl class injects an `IngestionMapper` interface (mapper/ingestion/IngestionMapper.java). Called at three sites: `createIngestionDto(de, dataSourceId)` line 85 (per-DataEntity DTO build), `mapTaskRun(de)` line 90 (JOB_RUN to IngestionTaskRun), `dtoToPojo(...)` line 124 + line 133 (DTO to POJO for repository writes — note the single-arg + collection-arg overloads in IngestionMapper)."
  - "`ReactiveDataSourceRepository.getIdByOddrnForUpdate(String)` (line 61 + line 68) — single resolution from payload `data_source_oddrn` to `data_source.id` with `SELECT ... FOR UPDATE` semantics. The Impl does NOT call any other DataSourceRepository method; the row lock is the ONLY interaction this service has with the datasource table. Repository-tier substrate confirmed in batch R sibling sidecar."
  - "`ReactiveDataEntityRepository.listByOddrns(Collection<String>, boolean, boolean)` (line 60 + line 93) — three-arg overload with `includeHollow=true, includeDeleted=true`. The default-args overload (no booleans, `listByOddrns(oddrns)`) is NOT used here; the Impl explicitly demands hollow+deleted to be included — the soft-delete-restore mechanism (F-008 drift facet `silent_undelete_on_re_ingestion`) depends on this. Repository-tier substrate confirmed in batch H sibling sidecar `ReactiveDataEntityRepositoryImpl.md`."
  - "`ReactiveDataEntityRepository.bulkUpdate(Collection<DataEntityPojo>)` (line 134) — multi-row UPDATE returning the updated pojos."
  - "`ReactiveDataEntityRepository.bulkCreate(Collection<DataEntityPojo>)` (line 142) — plain INSERT via `insertManyReturning` (ReactiveAbstractCRUDRepository.java:114-126); no ON CONFLICT."
  - "`DataEntityInternalStateService.restoreDeletedDataEntityRelations(List<DataEntityPojo>)` (line 58 + line 135-136) — un-archives relations of soft-deleted entities. Called on the SAME transaction as the upsert (the restore method is itself `@ReactiveTransactional` at DataEntityInternalStateServiceImpl.java:101 — Spring's default propagation joins the inner txn into the outer). The restore writes to `lineage`, `group_entity_relations`, `group_parent_group_relations`, plus bumps `data_entity_statistics`. **No activity event on restore** — the un-archive is silent. F-008 drift facet `silent_undelete_on_re_ingestion` enacted at THIS call site."
  - "`IngestionProcessorChain.processIngestionRequest(IngestionRequest)` (line 55 + line 71) — the 14-processor chain entry point. Phase ordering by TreeMap of `IngestionProcessingPhase.order` (INITIAL=1, MAIN=2, FINALIZING=3 per IngestionProcessingPhase.java:7-10). Within a phase, `Mono.zip` runs processors concurrently (IngestionProcessorChain.java:36); between phases, `.concatMap` enforces ordering (line 39). See sibling `IngestionService.md` for processor inventory."
  - "`OTLPMetricService.exportMetrics(IngestionRequest)` (line 56 + line 72) — terminal step. Interface OTLPMetricService.java:6-8. Inside the outer `@ReactiveTransactional` boundary — OTLP export is bound to txn commit. A network failure on OTLP rollbacks the whole ingestion. F-008 drift facet `otlp_export_inside_transaction` enacted at THIS line (the interface sidecar IngestionService.md carries this drift facet on the macro side)."
  - "`DatasetFieldService.updateStatistics(DatasetStatisticsList)` (line 57 + line 78) — the implementation of `ingestStats(...)`. The Impl class injects `DatasetFieldService` (line 57); the method delegates `ingestStats` to it via a single `.updateStatistics(...)` call. `ingestStats` is NOT `@ReactiveTransactional` at THIS layer (line 76 has only `@Override`), so the transaction shape of stats ingestion lives in `DatasetFieldServiceImpl.updateStatistics` (separate concern; `POST /ingestion/entities/datasets/stats` is the entry-point — sibling F-008 chain not covered by THIS sidecar's primary scope)."
- requires-config:
  - "`metrics.export.enabled` (default `false` per application.yml:158-163 — verified this batch — `metrics.export.enabled: false` is explicitly set). The interface sidecar flagged a possible config gap; this batch CONFIRMS the property is set to `false` in the bundled defaults, so `NoOpOTLPMetricService` (NoOpOTLPMetricService.java:8 — `havingValue=\"false\"`) registers, NOT `OTLPMetricServiceImpl` (line 18 — `havingValue=\"true\"`). Neither bean has `matchIfMissing=true` (verified via Grep across both files). Removing the explicit `enabled: false` from application.yml would break Spring DI for `OTLPMetricService` — neither bean would register, Spring would fail to wire IngestionServiceImpl's constructor (line 56). The default is **explicit-OFF**, not **implicit-OFF**."
  - "`auth.ingestion.filter.enabled` (default `false`, application.yml:48) — gates upstream filter. Impl reads no auth config; included here because under the default the filter NEVER runs and this Impl is reachable by any HTTP caller — the F-008 drift facet `destruction_under_default_off_auth` enforced UPSTREAM of this Impl, but the destruction itself happens inside this Impl's transaction."
  - "`spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) — caps the payload size upstream. Impl is guaranteed to see ≤ 20 MB. Coupled with the `body_buffered_before_auth_dos_surface` F-008 drift facet — the 20MB cap is the per-request work amplification the filter (batch O) carries; this Impl receives only valid-shaped 20MB payloads."
- requires-runtime:
  - "Spring WebFlux + Reactor (lines 44-45 import Mono, Flux)."
  - "jOOQ reactive (line 16 imports `org.jooq.JSONB` — used at line 109 for the `JSONB.jsonb(\"{}\")` empty-object literal in the specific-attributes-delta builder)."
  - "Lombok `@RequiredArgsConstructor` (line 51) — constructor injection of the seven final fields. NO manual constructor."
  - "Lombok `@Slf4j` (line 53) — log instance present. **Verified: zero `log.*` calls in the file** (Grep for `log\\.` in IngestionServiceImpl.java returned no matches). The `@Slf4j` annotation is dead code at this layer — every behavioural decision in the file (the JOB_RUN split, the DELETED-status restore, the MICROSERVICE exclusion, the hollow-vs-real partition, the duplicate-ODDRN crash) executes silently."
- coupling:
  - "Static import of `JOB_RUN` from `DataEntityType` (line 49) — the JOB_RUN identity comes from the ingestion-contract OpenAPI module's enum (`org.opendatadiscovery.oddplatform.ingestion.contract.model.DataEntityType`), NOT from the platform's internal `DataEntityTypeDto`. A rename in the contract would silently break the JOB_RUN-vs-entity split. Note: `DataEntityTypeDto` (line 22) is the **internal** type enum used at line 103 for the MICROSERVICE check; the two enums are DISTINCT and named-coincidentally."
  - "`DataEntityStatusDto.DELETED.getId()` (line 130) — the soft-delete restore depends on the integer ID of the DELETED status. A schema migration that renumbers the status table would silently break the restore path."
  - "`DataEntityClassDto` enum identities used in the four `extract*` methods: `DATA_ENTITY_GROUP` (line 200, 224), `DATA_QUALITY_TEST` (line 211), `DATA_SET` (line 238), `DATA_TRANSFORMER` (line 248), `DATA_CONSUMER` (line 264). A rename / removal would silently break the corresponding extraction branch."
  - "`Optional::isPresent` / `Optional::get` in `buildIngestionRequest` (line 182-183) — the `extractGroupParentGroupRelations` helper returns `Optional<GroupParentGroupRelationsPojo>`, and the streaming pipeline filters by `isPresent` then unwraps via `get`. This is the only Optional-returning extractor; the others (`extractGroupEntityRelations`, `extractDataQARelations`, `extractLineageRelations`) all return `List<...>` (possibly empty)."
  - "**F-008 chain coupling.** Every `IngestionRequestProcessor` bean (14 total) couples to the `IngestionRequest` shape assembled at line 154-197. Adding a new field on the request (e.g. a new `relationsToReplace` list) requires updating the builder here AND all 14 processors. Removing a field (e.g. retiring `groupParentGroupRelations`) would orphan the corresponding extract helper here and possibly a downstream processor — silent dead code without a centralised registration mechanism."

## tests_coverage_semantic

> See sibling `IngestionService.md` for the full test inventory (BaseIngestionTest +
> 9 `*IngestionTest` subclasses). This block records only Impl-specific gaps the
> interface sidecar consolidated up.

- covered_behaviours:
  - "Indirectly via every `*IngestionTest` through `BaseIngestionTest.ingestAndAssert(...)` (BaseIngestionTest.java:74-80) → calls `POST /ingestion/entities` → controller invokes `IngestionService::ingest` → `IngestionServiceImpl.ingest(...)` (the only impl). The Impl's happy-path is exercised on every test."
- uncovered_behaviours:
  - "Duplicate ODDRN within a single payload: `Collectors.toMap(DataEntityIngestionDto::getOddrn, identity())` (line 86) uses the default throwing merger — duplicates THROW `IllegalStateException: Duplicate key`. Behaviour on the HTTP boundary: caller receives 5xx (not a structured 400 'duplicate oddrn' response). No test asserts this. A buggy collector emitting the same ODDRN twice in one payload crashes the entire ingestion with no clear error message. test_class: `IngestionDuplicateOddrnTest` (does not exist)."
  - "Empty `ingestionDtoMap.keySet()` (all items are JOB_RUN): `dataEntityRepository.listByOddrns(emptySet, true, true)` (line 93) — does the repository handle empty `IN ()` correctly? Likely yes (`listByOddrns` typically short-circuits on empty), but the codepath at line 93-151 is not tested for the all-JOB_RUN case. test_class: `IngestionAllJobRunPayloadTest` (does not exist)."
  - "`calculateTotalDeltaCount` edge cases: (a) entity with null `entityClassIds` reaching `classesAndTypeFilled` check (line 313-315) — confirmed filter returns false, skips decrement, but new-pojo path at line 281-286 has no null guard before `pojo.getEntityClassIds()` is passed to `calculateDeltaValues`; a new pojo with null entityClassIds would NPE at `Arrays.stream(entityClassIds)` (line 307). No test for null-entityClassIds path. test_class: `IngestionDeltaCalculationNullClassesTest` (does not exist)."
  - "`extractLineageRelations` empty-collection edge cases: an entity with `DATA_TRANSFORMER` class but null `sourceList` / `targetList` — `dto.getDataTransformer().sourceList().stream()` (line 249) would NPE if `sourceList()` returns null. No test for null-source-list. test_class: `IngestionLineageNullSourceListTest` (does not exist)."
  - "Hollow-promotion delta: `calculateTotalDeltaCount` adds `hollowUpdatedEntitiesCount` (line 296-298, 300) to the total delta — counting hollow→real upgrades as +1 to total entity count. No test asserts the counter increment matches operator expectations (an operator who pre-creates hollow rows via lineage may be surprised when their 'count of real entities' jumps on first ingestion). test_class: `IngestionHollowPromotionCounterTest` (does not exist)."
  - "Cross-collector pollution probe (F-008 batch-S established the positive case-law for `data_source` registration; this Impl is the F-008 chain hop where the destruction would occur). Concrete probe: collector A registers datasource D and ingests entity E into D; collector B steals A's token and ingests entity E' into D with `data_source_oddrn=D.oddrn` — the service-tier code at line 68 resolves D unconditionally, the @ReactiveTransactional at line 66 commits B's destructive write. No test asserts this; the structural defence is the upstream IngestionDataEntitiesFilter token-to-datasource binding (batch O sidecar), which is DEFAULT-OFF per application.yml:48. test_class: `IngestionCrossCollectorPollutionTest` (does not exist)."
- test_files:
  - "(All test files inherited from sibling IngestionService.md tests_coverage_semantic.test_files block. No additional Impl-specific test class exists.)"
- gaps: |
    The Impl has zero unit tests — every test of the ingestion service routes through the
    HTTP boundary via `BaseIngestionTest`. The line-anchored invariants this sidecar records
    (duplicate-ODDRN crash, null-entityClassIds NPE, null-sourceList NPE, JOB_RUN-only
    payload, hollow-promotion counter semantics, cross-collector pollution) are all
    observable only via integration paths that nobody has written. A direct `@MockBean`-style
    unit test of `IngestionServiceImpl` against mocked repositories + a mocked processor chain
    would cover all of these gaps in tens of lines of test code — but the project's
    convention is to test the integration surface, so the unit-level surface is structurally
    untested.

    The most likely regression lands in `calculateTotalDeltaCount` (line 276-301) or in
    the `extract*Relations` helpers (line 199-274) — these are pure functions, exercised
    only as side effects of the full ingestion path. A change that, say, refactors the
    new-pojo delta loop to use `entitiesToUpdate.stream()` instead of `searchablePojos.stream()`
    (line 281 vs line 284) would silently break the count math and would not break any test.

    The cross-collector-pollution probe is the single highest-leverage missing test for the
    F-008 5-vertex picture — it validates that the destruction-under-default-off-auth facet
    has the expected blast radius (any caller, any payload-named datasource, full
    metadata/lineage destruction). Today the blast radius is only enumerable via reading
    this file plus the batch-O filter sidecar plus the F-008 detail YAML; no automated
    artefact prevents a regression.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/integrations/integrations/ingestion-filters"
    anchor: ""
    rationale: "Closest live doc page touching the ingestion plane — covers the regex `include`/`exclude` collector-side filter mechanism, NOT the platform-side `IngestionService`. WebFetched 2026-05-20 (status 200) — confirmed page does NOT document POST /ingestion/entities, auth.ingestion.filter.enabled, single-transaction-per-batch, payload-driven datasource scoping, replace-not-merge, soft-delete restore, or FTS recompute."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from WebFetch (2026-05-20): "This page exclusively covers ingestion filters—the regex-based `include`/`exclude` mechanism for scoping collectors to specific dimensions (schemas, datasets, files, pipelines). It does not discuss API endpoints, authentication configuration, transaction semantics, metadata handling strategies, or search indexing operations."
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s"
    anchor: ""
    rationale: "The only live doc that mentions `POST /ingestion/entities` by name (a curl example). WebFetched 2026-05-20 (status 200). Does NOT describe what the endpoint does beyond being a callable example; does NOT cover transaction semantics, silent destruction, or any service-layer invariants. Operators using the example as their mental model of the endpoint will not learn anything about destruction-on-absence semantics."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim summary of WebFetch (2026-05-20): "no description of what POST /ingestion/entities does beyond it being mentioned as an example endpoint that can be called with S2S authentication; no transaction semantics guarantees; no warnings about silent metadata or lineage destruction; no mention of replace-not-merge behavior or batch atomicity."
    confidence: LOW
- doc_drift_findings:
  - "The Impl-layer behaviour (single-transaction-per-batch, payload-driven datasource scoping with no principal check, replace-not-merge for lineage/metadata, soft-delete restore, MICROSERVICE specific-attributes exclusion, duplicate-ODDRN-in-payload crash, hollow-promotion counter semantics) is UNDOCUMENTED on the live docs site. Re-confirmed via WebFetch of `integrations/integrations/ingestion-filters` and `configuration-and-deployment/enable-security/authentication/s2s` (both status 200 on 2026-05-20). The interface-axis sibling sidecar's doc-drift findings remain the canonical record for this gap; this sidecar refreshes the WebFetch evidence as of 2026-05-20."
  - "The F-008 5-vertex picture (filter + controller + service + processor chain + repository tiers) has NO single doc page that explains the cross-tier composition. Operators reading the S2S authentication page see a curl example; operators reading the ingestion-filters page see regex-include/exclude rules; neither surface explains that a `POST /ingestion/entities` on the bundled-default deployment is anonymously reachable, runs in a single transaction, replaces lineage and metadata silently, and has no DLQ. The cross-tier explanation is a DOC-NNN candidate."

## implicit_adrs

> See sibling `IngestionService.md` for the macro ADRs (single-transaction-per-batch,
> three-phase processor chain, payload-driven datasource scoping, JOB_RUN separation,
> replace-not-merge). This block records only Impl-specific structural decisions the
> interface sidecar consolidated up.

- "Private orchestration helper `persistDataEntities(long, List<DataEntity>)` is the
  composition seam — `ingest(...)` (line 65-74) is intentionally a five-step reactive
  chain, and ALL of the persistence work (JOB_RUN split, ODDRN dedup, partition,
  bulkUpdate/bulkCreate, restore, delta calculation, IngestionRequest assembly) is
  delegated to ONE private method (line 81-152). The size of `persistDataEntities`
  (~70 lines including reactive composition) is the visible cost of keeping `ingest`
  readable. The maintainer deliberately did NOT split `persistDataEntities` into
  smaller private methods despite its length — the `flatMap(existingPojoDict -> { ... })`
  callback at line 95-151 carries the local state (`existingPojoDict`,
  `ingestionDtoMap`, `ingestionDtoPartitions`, `specificAttributesDeltas`,
  `enrichedExistingDtos`, `entitiesToUpdate`, `entitiesToRestore`, `pojosToCreate`,
  `totalDelta`, `enrichedNewDtos`) that further decomposition would require passing
  through method parameters or wrapping in a state object. The decision is intent:
  one big reactive callback over multiple small methods. — evidence:
  IngestionServiceImpl.java:65-74 + IngestionServiceImpl.java:81-152 — intent_anchor:
  the consistent shape (one public `ingest`, one private `persistDataEntities`, one
  private `buildIngestionRequest`, four pure-function `extract*Relations` helpers,
  one pure-function `calculateTotalDeltaCount` with its `calculateDeltaValues`
  sub-helper) IS the architectural opinion: reactive composition stays in the
  orchestrator, pure data shaping lives in helpers, the IngestionRequest builder is
  the assembly seam. — confidence: HIGH"

- "`extract*Relations` helpers all take `EnrichedDataEntityIngestionDto` (the post-DB
  shape) EXCEPT `extractLineageRelations` (line 233) which takes `DataEntityIngestionDto`
  (the pre-DB shape). The lineage helper does NOT need the DB id (the relation uses
  ODDRNs only — `parentOddrn`, `childOddrn`, `establisherOddrn`); the group/DQ helpers
  also use ODDRNs only and could take the pre-DB shape — but they take Enriched anyway.
  The asymmetry is structural: lineage extraction is invoked from BOTH the new-entities
  stream AND the existing-entities stream in `buildIngestionRequest` (line 161-165),
  and the Stream.concat over both requires a common type. The lineage helper takes the
  super-type (DataEntityIngestionDto) so Enriched flows in (via inheritance —
  EnrichedDataEntityIngestionDto extends DataEntityIngestionDto). The DQ / group helpers
  also operate on Stream.concat but take the sub-type explicitly. This is a minor
  inconsistency, not a defect — both compile, both work. — evidence:
  IngestionServiceImpl.java:199-274 (helpers) + IngestionServiceImpl.java:154-197
  (buildIngestionRequest assembly) — intent_anchor: the lineage helper's signature
  explicitly uses `DataEntityIngestionDto`, not Enriched; the DQ / group helpers
  explicitly use Enriched. The author chose the type that worked, didn't bother to
  normalise. — confidence: MEDIUM"

- "The `establisher_oddrn` is hard-coded to the DTO's own ODDRN on every lineage edge
  produced in `extractLineageRelations` (line 243 for DATA_SET parent edge, line 253
  for DATA_TRANSFORMER source edge, line 260 for DATA_TRANSFORMER target edge,
  line 269 for DATA_CONSUMER input edge). This is the structural enactment of the
  **establisher-keyed atomic-rewrite** invariant (sibling `LineageServiceImpl.md`
  implicit_adrs[1] from batch I). The decision is: 'the entity that introduces an
  edge OWNS that edge for replacement purposes' — on every re-ingestion of this
  entity, every edge it established last time is REPLACED by the edges in the new
  payload. The convention is consistent across all four branches; the decision is
  not annotated but is structurally invariant. — evidence: IngestionServiceImpl.java:243,
  253, 260, 269 (four sites, identical pattern) + LineageServiceImpl.java:124-133
  (the downstream replaceLineagePaths) + LineageIngestionRequestProcessor.java:17 (the
  call site) — intent_anchor: the consistent `setEstablisherOddrn(dtoOddrn)` pattern
  is itself the architectural opinion — the alternative (using parent or child as
  establisher) was not chosen. — confidence: HIGH"

- "`@Slf4j` annotation (line 53) is present but UNUSED. No `log.*` call in the file
  (verified). The annotation is structural noise — Lombok-style annotations are
  routinely applied across the service package, and the maintainer kept the convention
  even though this particular service never logs. The cost is operator-relevant: a
  Postgres exception, a NotFoundException, a duplicate-ODDRN crash, a restore decision
  — all surface only as stack traces, with no service-layer `log.warn` to record the
  destructive operation. — evidence: IngestionServiceImpl.java:53 + Grep for `log\\.` in
  the file (zero matches) — intent_anchor: `@Slf4j` is applied by convention; the
  decision to NOT add `log.warn` on the restore path or the duplicate-ODDRN path is
  the implicit one. — confidence: MEDIUM (the annotation is intentional; the absence
  of `log.*` calls is the gap-shaped observation — routed here because the *consistent
  application of @Slf4j across the package* is itself a convention worth recording,
  but per Rule 8 the absence of `log.*` calls is gap-shaped — see
  bugs_limitations_corner_cases[3])"

## bugs_limitations_corner_cases

> See sibling `IngestionService.md` for the macro gap inventory (silent
> metadata-delete-on-absence, silent lineage-edge-deletion-on-absence,
> default-deployment-unauthenticated-write, soft-delete-silent-restore,
> MICROSERVICE-exclusion-undocumented, no-partial-success, OTLP-inside-transaction,
> FTS-recompute-on-every-ingest, UsageReport-runs-on-every-ingest, intra-phase
> ordering non-determinism, activity-log-only-records-creates). This block records
> only Impl-specific issues the interface sidecar consolidated up.

- "Duplicate ODDRN within a single payload causes the entire ingestion to crash with
  `IllegalStateException: Duplicate key`. The two-arg `Collectors.toMap(DataEntityIngestionDto::getOddrn, identity())`
  at line 86 uses the default throwing merger — there is no `(a, b) -> a` or
  `(a, b) -> b` merge function, no comment defending the choice. The HTTP response
  shape is a 5xx with a stack trace logged on the platform side; the collector
  sees an unhelpful error. A collector with a glitched data-source iteration that
  emits the same ODDRN twice in one payload destroys the entire ingestion tick.
  No test asserts this; no comment defends the crash-vs-deduplicate decision."
  — evidence: IngestionServiceImpl.java:83-86 (no merger override) + Java stdlib
  `Collectors.toMap` default-throw semantics — severity: MEDIUM

- "`extractLineageRelations` (line 233-274) silently no-ops when an entity has the
  DATA_SET class but a null `dataSet.parentDatasetOddrn` (line 239) — that's
  intentional. But `dto.getDataTransformer().sourceList()` (line 249) and
  `targetList()` (line 256) and `dto.getDataConsumer().inputList()` (line 265)
  are called WITHOUT null guards. If a collector emits a DATA_TRANSFORMER entity
  with `dataTransformer.sourceList == null` (vs empty list), this NPE at line 249.
  The contract YAML may declare these fields required-with-default-empty, but the
  code does not defend itself. No `Optional.ofNullable(...).orElse(List.of())`
  wrapping; no `CollectionUtils.emptyIfNull(...)`."
  — evidence: IngestionServiceImpl.java:233-274 (no null guards on the three .stream() calls)
  — severity: LOW (depends on contract-side enforcement; likely benign in practice
  because the OpenAPI generator emits non-null defaults)

- "`calculateTotalDeltaCount.calculateDeltaValues` (line 303-311) calls
  `Arrays.stream(entityClassIds).forEach(...)` (line 307) — if a new pojo has
  `entityClassIds == null` (theoretically possible if the IngestionMapper produced
  null for an entity with no class), this NPEs. The Java stdlib `Arrays.stream(null)`
  throws NullPointerException. The `classesAndTypeFilled` helper (line 313-315)
  protects the existing-entity decrement path but NOT the new-entity increment
  path at line 285. Asymmetric defence. No test, no comment."
  — evidence: IngestionServiceImpl.java:284-285 (no `classesAndTypeFilled` guard
  on the new-pojo branch) + IngestionServiceImpl.java:287-294 (the existing-pojo
  branch DOES guard) — severity: LOW

- "`@Slf4j` (line 53) is unused. ZERO `log.*` calls in the file. The destructive
  paths — soft-delete restore (line 135-136), MICROSERVICE exclusion (line 103),
  duplicate-ODDRN crash (line 86), hollow-promotion (line 297), bulk-update with
  potentially stale `previousVersionPojo` data (line 134) — all execute silently.
  An operator investigating 'why did 3 entities I deleted reappear last night?' or
  'why did my microservice's specific-attributes change not raise an alert?' has
  no service-layer log to consult. The application's only artefacts of these
  decisions are the DB state and (for restore) the bumped statistics counters."
  — evidence: IngestionServiceImpl.java:53 (`@Slf4j`) + Grep for `log\\.` in the
  file (zero matches) — severity: MEDIUM

- "`buildIngestionRequest` (line 154-197) executes `Stream.concat(newEntities.stream(), existingEntities.stream())`
  FOUR times (line 162, 168, 174, 180) to build the four relation lists. For a
  large payload (~thousands of entities), this means four full passes over the
  combined entity list. A single pass that builds all four lists in one traversal
  would be more efficient but harder to read. The maintainer chose readability;
  no comment defends the cost."
  — evidence: IngestionServiceImpl.java:161-184 (four separate Stream.concat passes)
  — severity: LOW (micro-optimisation; readability trade-off is defensible)

- "`extractGroupParentGroupRelations` (line 221-231) returns `Optional<...>` while
  the other three extract helpers return `List<...>`. The downstream
  `buildIngestionRequest` (line 182-183) handles this by chaining
  `.filter(Optional::isPresent).map(Optional::get)` — the standard pre-Java-9
  idiom. A modern refactor (Java 9+) would use `.flatMap(Optional::stream)`. The
  inconsistency itself is benign; the older idiom is the smell."
  — evidence: IngestionServiceImpl.java:221-231 + IngestionServiceImpl.java:182-183
  — severity: LOW

- "**Cross-collector pollution surface at this layer.** Under the bundled default
  `auth.ingestion.filter.enabled=false` (application.yml:48), the filter (batch-O
  sibling sidecar) is NOT registered. The controller (batch-P referenced sibling)
  does no principal extraction. This Impl at line 68 resolves the datasource
  ONLY by payload-ODDRN — no caller-to-datasource binding is enforced anywhere
  in the F-008 chain on the bundled deployment. A caller able to reach the port
  can specify ANY `data_source_oddrn` in the payload AND trigger the destructive
  metadata-delete-on-absence + lineage-replace-by-establisher paths against that
  datasource (per F-008 drift facets `destruction_under_default_off_auth` +
  `silent_destruction_replace_not_merge`). The structural defence is the upstream
  filter; under bundled defaults the defence is absent. This Impl is the
  **enforcement point** of the destruction — the destructive verbs live downstream
  in MetadataIngestionRequestProcessor + LineageIngestionRequestProcessor, but
  they run inside this Impl's `@ReactiveTransactional` against the datasource
  THIS Impl resolved from the unvetted payload."
  — evidence: IngestionServiceImpl.java:67-74 (the five-step chain — no
  principal extraction) + IngestionServiceImpl.java:68 (payload-ODDRN-only
  resolution) + application.yml:48 (filter default-OFF) + sibling
  `IngestionDataEntitiesFilter.md` (batch O — filter is `@ConditionalOnProperty(havingValue="true")`)
  — severity: HIGH (under bundled defaults; LOW under properly-configured filter)

## security

> See sibling `IngestionService.md` for the macro security posture
> (auth_mode_relevance INTERNAL_ONLY; ingestion_filter_relevance YES;
> authorization_assertions empty; owner_scoping BYPASSES; data_exposure WRITE
> including silent destructive operations; six known_security_gaps).

- **auth_mode_relevance**: `INTERNAL_ONLY — auth happens upstream at the controller / filter layer`. Impl class is a `@Service` (line 52), not on HTTP. Inherits the upstream posture: when `auth.ingestion.filter.enabled=false` (default), Impl is reachable from any caller; when `=true`, Impl runs after the upstream filter has bound caller-to-datasource. Impl itself consults NO `SecurityContext` / `ServerWebExchange` / `Authentication` (verified: no imports of `SecurityContext`, no `getSecurityContext()` call, no `Authentication` parameter).
- **ingestion_filter_relevance**: `YES (indirectly) — this Impl is the work performed when IngestionDataEntitiesFilter accepts a request`. Sibling sidecar `odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md` (batch O) carries the filter-side posture. Under bundled defaults the filter is not registered — see corner-cases[6].
- **authorization_assertions**: `[]` — no `@PreAuthorize`, no `permissionService.hasPermission(...)`, no programmatic check. Verified: Grep for `hasPermission` and `PreAuthorize` in `IngestionServiceImpl.java` returned zero matches.
- **owner_scoping**: `BYPASSES — Impl writes to whatever datasource the payload names; no Owner / User-owner-association check`. Inherited from interface sidecar.
- **data_exposure**: (inherited from interface sidecar — see `IngestionService.md` security.data_exposure for the four-entry list including the destructive WRITE class). The cross-tenant write capability is the headline at this tier: the F-008 5-vertex picture exposes that an unauthenticated caller (default deployment) writes to any payload-named datasource via this Impl's single-transaction-per-batch boundary.
- **known_security_gaps**:
  - "Impl-specific: the `@Slf4j` annotation (line 53) is present but UNUSED. Destructive operations (restore-on-DELETED at line 135-136, MICROSERVICE exclusion at line 103, duplicate-ODDRN crash at line 86) execute with NO audit trail at this layer. Even if an operator enables DEBUG logging for the package, this Impl emits nothing because no `log.*` calls exist. A compromised collector exploiting the destructive surface (silent-delete-on-absence per MetadataIngestionRequestProcessor / LineageIngestionRequestProcessor — see interface sidecar) cannot be detected from logs originating in this Impl." — evidence: IngestionServiceImpl.java:53 (`@Slf4j`) + Grep for `log\\.` in the file (zero matches) + MetadataIngestionRequestProcessor.java:72-80 (silent delete) + LineageIngestionRequestProcessor.java:17 (replace) — severity: MEDIUM
  - "Impl-specific: duplicate-ODDRN crash (line 86) is observable to an attacker probing the endpoint. Submitting a `DataEntityList` with two items sharing the same ODDRN forces an `IllegalStateException: Duplicate key` to surface as 5xx. An attacker can use this to fingerprint the platform version (if the error format ever changes) or to DoS the ingestion path with cheaply-crafted invalid payloads (each request still does the upstream parse + filter pass + transaction-start before the crash, so a flood of duplicates burns platform resources for free)." — evidence: IngestionServiceImpl.java:83-86 — severity: LOW
  - "F-008 5-vertex closure: this Impl is the **enforcement point** of the cross-collector / cross-tenant destruction surface. The filter (batch O — default OFF) is the only defence against an unauthenticated caller specifying an arbitrary `data_source_oddrn`; if the filter is OFF (bundled default), this Impl at line 68 resolves the datasource ONLY by payload ODDRN, with NO principal-to-datasource binding. The destructive writes downstream (MetadataIngestionRequestProcessor.java:72-80 silent metadata delete; LineageIngestionRequestProcessor.java:17 lineage replace) run inside this Impl's `@ReactiveTransactional` against that arbitrary datasource. The destruction blast radius is per-datasource — an attacker can erase one datasource's metadata + lineage per request. The F-008 drift facet `destruction_under_default_off_auth` is realised at THIS service-tier line + the upstream filter's default-OFF property." — evidence: IngestionServiceImpl.java:67-74 + application.yml:48 + sibling IngestionDataEntitiesFilter sidecar — severity: HIGH (under bundled defaults; the explicit-opt-in mitigation is documented but not the deployed default)

## performance

> See sibling `IngestionService.md` for the macro performance picture
> (hot_paths, throughput_characteristics, resource_allocation,
> scaling_characteristics, five known_performance_gaps).

- **hot_paths**:
  - "Per-call materialisation cost inside `persistDataEntities` (line 81-152): one `Map<String, DataEntityIngestionDto> ingestionDtoMap` (line 83-86), one `List<IngestionTaskRun> taskRuns` (line 88-91), one `Map<String, DataEntityPojo> existingPojoDict` (line 94), one `Map<Boolean, List<DataEntityIngestionDto>> ingestionDtoPartitions` (line 96-98), one `List<DataEntitySpecificAttributesDelta>` (line 100-113), one `List<EnrichedDataEntityIngestionDto> enrichedExistingDtos` (line 115-121), three small `List<DataEntityPojo>` (entitiesToUpdate, entitiesToRestore, pojosToCreate — line 123-133), one `DataEntityTotalDelta totalDelta` (line 138-139). For a 1000-entity payload, that's ~9 collections each of ~1000 elements, all live in heap concurrently. Garbage-collection pressure scales linearly with payload size; heap footprint is multiples of the raw payload."
  - "`buildIngestionRequest` (line 154-197) does FOUR full passes over the combined-entity stream via `Stream.concat(newEntities.stream(), existingEntities.stream())` (line 161, 167, 173, 179). For a 1000-entity payload, that's 4000 entity-traversal-units of work, even though most entities contribute nothing to any single list (only DEG entities contribute to group relations, only DATA_QUALITY_TEST entities contribute to DQ relations, etc.). A single-pass implementation would be O(N) instead of O(4N); the maintainer chose readability."
- **throughput_characteristics**:
  - "Per-call reactive composition: the outer chain at line 67-73 is `.flatMap` ... `.flatMap` ... `.flatMap` ... `.then()` — purely sequential. No `.parallelism()` / `.parallel()`. The processor chain INSIDE this (via IngestionProcessorChain at line 71) is where intra-phase parallelism happens (IngestionProcessorChain.java:36 `Mono.zip(phaseExecutions)`); the Impl itself is sequential."
  - "Single-transaction-per-batch means concurrent ingestions targeting the SAME datasource SERIALISE on the `data_source` row lock (line 68 `FOR UPDATE`). Two collectors hammering the same datasource will see one-at-a-time throughput regardless of total platform parallelism. Cross-datasource ingestions DO run concurrently."
- **resource_allocation**:
  - "Per-call: the in-memory cost is dominated by `existingPojoDict` (line 94) which holds a `DataEntityPojo` per existing entity in the payload (with all jOOQ-generated fields, including the potentially-large `specific_attributes` JSONB column on each row). A re-ingestion of a 1000-entity payload where every entity exists in the DB means 1000 `DataEntityPojo` instances are deserialised from R2DBC into heap before any partitioning happens (line 93-94). For wide JSONB rows (~10KB each), this is ~10MB of heap per request — on top of the inbound payload itself (already capped at 20MB at the controller)."
- **scaling_characteristics**:
  - "Impl is stateless (line 55-63 are all `final` injected fields; no mutable instance state)."
  - "`persistDataEntities` (line 81-152) is the only path through which entities reach the DB. There is no batching of multiple `DataEntityList` requests into a single transaction — each HTTP call gets one `@ReactiveTransactional` boundary. A collector that wants to ingest 100,000 entities must split into N requests of ≤ 20 MB each, with each request paying the per-request overhead (datasource row lock acquisition, processor chain setup, OTLP export)."
  - "**No back-pressure beyond the txn boundary.** A burst of `POST /ingestion/entities` requests all targeting the same datasource serialises on the row lock, holding the lock for the full pipeline duration (datasource lookup + bulkUpdate + bulkCreate + restore + 14 processors + OTLP). Under high concurrency, queued requests pile up on the R2DBC connection pool. No documented timeout / queue-depth limit."
- **known_performance_gaps**:
  - "Four-pass `Stream.concat` in `buildIngestionRequest` (line 161-184) — O(4N) for what could be O(N). Severity LOW because each pass is in-memory list traversal; the cost is small vs the DB I/O cost of the surrounding pipeline. But for very large payloads it adds visible latency." — evidence: IngestionServiceImpl.java:161-184 — severity: LOW
  - "`existingPojoDict` materialisation (line 93-94) loads the FULL `DataEntityPojo` for every existing ODDRN in the payload, including the `specific_attributes` JSONB column even though only existing entities of non-MICROSERVICE type actually USE the JSONB (line 100-113). A projected select that fetches only the columns needed by `buildIngestionRequest` + `calculateTotalDeltaCount` (oddrn, id, entity_class_ids, type_id, status, hollow, specific_attributes-when-not-MICROSERVICE) would cut wire bytes and heap pressure." — evidence: IngestionServiceImpl.java:93 (`listByOddrns` returns full pojos) — severity: LOW
  - "`extract*Relations` helpers are invoked from `buildIngestionRequest`'s four parallel Stream.concat passes — for each entity, each helper is invoked once. The four helpers' branching logic on entity class membership (line 200, 211, 224, 238/248/264) re-checks class membership 4× per entity. A single pass that branches once per entity would be more efficient." — evidence: IngestionServiceImpl.java:154-197 (the four-helper assembly) — severity: LOW

## sources

- understanding ← IngestionServiceImpl.java:51-79 (class signature + ingest method + ingestStats method) + IngestionService.java:7-11 (interface) + ReactiveTransactional.java:9-13 (transactional meta-annotation)
- concepts.entities.* ← IngestionServiceImpl.java:55-63 (injected dependencies) + IngestionServiceImpl.java:81-152 (persistDataEntities locals) + IngestionMapper.java (interface)
- concepts.operations ← IngestionServiceImpl.java:65-74 (top-level) + IngestionServiceImpl.java:81-152 (persistDataEntities) + IngestionServiceImpl.java:154-197 (buildIngestionRequest) + IngestionServiceImpl.java:199-274 (four extractors) + IngestionServiceImpl.java:276-311 (calculateTotalDeltaCount + calculateDeltaValues)
- concepts.invariants[0] (ingest @ReactiveTransactional, ingestStats not) ← IngestionServiceImpl.java:65-66 + IngestionServiceImpl.java:76 + ReactiveTransactional.java:11
- concepts.invariants[1] (JOB_RUN split before DB call) ← IngestionServiceImpl.java:49 (import) + IngestionServiceImpl.java:83-91 (filter splits)
- concepts.invariants[2] (Collectors.toMap duplicate-throw) ← IngestionServiceImpl.java:83-86 (no merger override) + Java stdlib `Collectors.toMap` two-arg semantics
- concepts.invariants[3] (listByOddrns with hollow+deleted true) ← IngestionServiceImpl.java:93
- concepts.invariants[4] (MICROSERVICE exclusion from specific-attr deltas) ← IngestionServiceImpl.java:103 + AlertIngestionRequestProcessor.java:60 (downstream consumer)
- concepts.invariants[5] (bulkCreate returns rows with DB IDs, joined back via ODDRN) ← IngestionServiceImpl.java:141-143
- concepts.invariants[6] (bulkCreate = plain INSERT no ON CONFLICT) ← ReactiveAbstractCRUDRepository.java:114-126 (insertManyReturning) + IngestionServiceImpl.java:68 (FOR UPDATE row lock = the serialisation invariant)
- concepts.invariants[7] (calculateTotalDeltaCount math) ← IngestionServiceImpl.java:276-301 + IngestionServiceImpl.java:303-311 (calculateDeltaValues) + IngestionServiceImpl.java:313-315 (classesAndTypeFilled)
- concepts.invariants[8] (extractLineageRelations entity-class driven + establisher-keyed replacement) ← IngestionServiceImpl.java:233-274 + LineageServiceImpl.java:124-133 (downstream replaceLineagePaths)
- concepts.invariants[9] (DEG extract helpers, is_manual=false hardcoded) ← IngestionServiceImpl.java:199-208 (line 206 → false) + IngestionServiceImpl.java:221-231 (line 230 → false) + GroupEntityRelationIngestionRequestProcessor.java:18-21 (DELETE-then-CREATE downstream)
- concepts.invariants[10] (no principal check, payload-driven scoping) ← IngestionServiceImpl.java:67-74 (no SecurityContext / ServerWebExchange) + IngestionServiceImpl.java:68 (payload-ODDRN-only resolution) + sibling IngestionDataEntitiesFilter.md
- dependencies_semantic.requires-feature.IngestionMapper ← IngestionServiceImpl.java:63 (injection) + IngestionServiceImpl.java:85,90,124,133 (call sites)
- dependencies_semantic.requires-feature.ReactiveDataSourceRepository ← IngestionServiceImpl.java:61 + IngestionServiceImpl.java:68
- dependencies_semantic.requires-feature.ReactiveDataEntityRepository ← IngestionServiceImpl.java:60 + IngestionServiceImpl.java:93,134,142
- dependencies_semantic.requires-feature.DataEntityInternalStateService ← IngestionServiceImpl.java:58 + IngestionServiceImpl.java:135-136 + DataEntityInternalStateService.java:16 + DataEntityInternalStateServiceImpl.java:101-104 (the @ReactiveTransactional inner)
- dependencies_semantic.requires-feature.IngestionProcessorChain ← IngestionServiceImpl.java:55 + IngestionServiceImpl.java:71 + IngestionProcessorChain.java:17-56 + IngestionProcessingPhase.java:7-10
- dependencies_semantic.requires-feature.OTLPMetricService ← IngestionServiceImpl.java:56 + IngestionServiceImpl.java:72
- dependencies_semantic.requires-feature.DatasetFieldService ← IngestionServiceImpl.java:57 + IngestionServiceImpl.java:78
- dependencies_semantic.requires-config.metrics_export_enabled ← application.yml:158-163 (`enabled: false` explicit)
- dependencies_semantic.requires-config.auth_ingestion_filter_enabled ← application.yml:46-48 + sibling IngestionDataEntitiesFilter sidecar
- dependencies_semantic.requires-config.spring_codec_max_in_memory_size ← application.yml:14-15
- dependencies_semantic.requires-runtime.Reactor ← IngestionServiceImpl.java:44-45 (imports Flux, Mono)
- dependencies_semantic.requires-runtime.jOOQ ← IngestionServiceImpl.java:16 (`org.jooq.JSONB`) + IngestionServiceImpl.java:109 (`JSONB.jsonb("{}")`)
- dependencies_semantic.requires-runtime.Lombok.RequiredArgsConstructor ← IngestionServiceImpl.java:12 + IngestionServiceImpl.java:51
- dependencies_semantic.requires-runtime.Lombok.Slf4j ← IngestionServiceImpl.java:13 + IngestionServiceImpl.java:53 + Grep for `log\\.` returned zero matches
- dependencies_semantic.coupling.JOB_RUN_from_contract ← IngestionServiceImpl.java:49 (`import ... ingestion.contract.model.DataEntityType.JOB_RUN`)
- dependencies_semantic.coupling.DataEntityStatusDto_DELETED_id ← IngestionServiceImpl.java:130 (`DataEntityStatusDto.DELETED.getId()`)
- dependencies_semantic.coupling.DataEntityClassDto_identities ← IngestionServiceImpl.java:200,211,224,238,248,264
- dependencies_semantic.coupling.Optional_isPresent_get ← IngestionServiceImpl.java:182-183
- dependencies_semantic.coupling.F-008_chain_coupling ← IngestionServiceImpl.java:154-197 (IngestionRequest assembly) + 14 processor files at service/ingestion/processor/
- tests_coverage_semantic.uncovered_behaviours.[*] ← IngestionServiceImpl.java:86 (duplicate-ODDRN throw) + IngestionServiceImpl.java:93 (empty-keySet path) + IngestionServiceImpl.java:284-285 (null entityClassIds in new-pojo path) + IngestionServiceImpl.java:249,256,265 (null sourceList/targetList/inputList) + IngestionServiceImpl.java:296-300 (hollow-promotion counter) + IngestionServiceImpl.java:67-74 (cross-collector pollution at the bundled-default-off filter)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-20T00:00:00Z of https://docs.opendatadiscovery.org/integrations/integrations/ingestion-filters (status 200) — confirmed no coverage of POST /ingestion/entities semantics
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-20T00:00:00Z of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s (status 200) — confirmed no service-layer documentation
- docs_link_semantic.doc_drift_findings ← WebFetch evidence above + sibling IngestionService.md doc_drift_findings + F-008 detail YAML facets index
- implicit_adrs[0] (persistDataEntities not decomposed further) ← IngestionServiceImpl.java:65-74 (ingest) + IngestionServiceImpl.java:81-152 (persistDataEntities — single long callback)
- implicit_adrs[1] (extract*Relations signature asymmetry) ← IngestionServiceImpl.java:199-274 (helpers) + IngestionServiceImpl.java:161-184 (assembly)
- implicit_adrs[2] (establisher-keyed lineage replacement convention) ← IngestionServiceImpl.java:243,253,260,269 (four consistent sites) + sibling LineageServiceImpl.md
- implicit_adrs[3] (@Slf4j unused) ← IngestionServiceImpl.java:53 + Grep for `log\\.` returned zero matches
- bugs_limitations_corner_cases[0] (duplicate-ODDRN crash) ← IngestionServiceImpl.java:83-86 + Java stdlib `Collectors.toMap` semantics
- bugs_limitations_corner_cases[1] (null source/target/input list NPE) ← IngestionServiceImpl.java:233-274 (no null guards)
- bugs_limitations_corner_cases[2] (null entityClassIds NPE in new-pojo path) ← IngestionServiceImpl.java:284-285 + IngestionServiceImpl.java:307 (Arrays.stream(null))
- bugs_limitations_corner_cases[3] (@Slf4j unused / silent destructive paths) ← IngestionServiceImpl.java:53 + Grep zero matches + IngestionServiceImpl.java:103,135-136 (destructive paths without log)
- bugs_limitations_corner_cases[4] (four-pass Stream.concat) ← IngestionServiceImpl.java:161-184
- bugs_limitations_corner_cases[5] (Optional pre-Java-9 idiom) ← IngestionServiceImpl.java:182-183
- bugs_limitations_corner_cases[6] (cross-collector pollution surface) ← IngestionServiceImpl.java:67-74 (no principal check) + IngestionServiceImpl.java:68 (payload-ODDRN-only) + application.yml:48 (filter default-OFF) + sibling IngestionDataEntitiesFilter.md
- security.auth_mode_relevance ← IngestionServiceImpl.java:52 (@Service) + IngestionServiceImpl.java:65-74 (no SecurityContext consult) + Grep for `SecurityContext|Authentication` in the file (zero matches)
- security.ingestion_filter_relevance ← sibling IngestionDataEntitiesFilter sidecar (batch O) + application.yml:48
- security.authorization_assertions ← IngestionServiceImpl.java:65-74 + Grep for `hasPermission|PreAuthorize` in the file (zero matches)
- security.owner_scoping ← sibling IngestionService.md + IngestionServiceImpl.java:67-69 (no principal-based scoping)
- security.known_security_gaps[0] (@Slf4j unused = no audit trail) ← IngestionServiceImpl.java:53 + Grep + sibling MetadataIngestionRequestProcessor.java:72-80 + sibling LineageIngestionRequestProcessor.java:17
- security.known_security_gaps[1] (duplicate-ODDRN probe surface) ← IngestionServiceImpl.java:83-86
- security.known_security_gaps[2] (F-008 cross-collector destruction enforcement point) ← IngestionServiceImpl.java:67-74 + application.yml:48 + sibling IngestionDataEntitiesFilter.md + F-008 detail YAML
- performance.hot_paths ← IngestionServiceImpl.java:83-152 (persistDataEntities materialisation cost) + IngestionServiceImpl.java:161-184 (buildIngestionRequest four-pass)
- performance.throughput_characteristics ← IngestionServiceImpl.java:65-74 (sequential reactive composition) + IngestionServiceImpl.java:68 (FOR UPDATE serialisation) + IngestionProcessorChain.java:36 (intra-phase parallel)
- performance.resource_allocation ← IngestionServiceImpl.java:93-94 (existingPojoDict full pojos)
- performance.scaling_characteristics ← IngestionServiceImpl.java:55-63 (stateless) + IngestionServiceImpl.java:65-74 (per-call @ReactiveTransactional) + IngestionServiceImpl.java:68 (data_source row lock serialisation)
- performance.known_performance_gaps[0] (four-pass) ← IngestionServiceImpl.java:161-184
- performance.known_performance_gaps[1] (full pojo load) ← IngestionServiceImpl.java:93
- performance.known_performance_gaps[2] (re-check class membership in helpers) ← IngestionServiceImpl.java:154-197 + IngestionServiceImpl.java:199-274

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

## coherence_check

> Rule 6 (LSN-018) pre-emit coherence sweep — runs at WRITE time, cross-checks
> named entities against existing F-008 detail, sibling sidecars, and concept
> catalog before claiming a new finding.

- **strengthens**:
  - "F-008 drift facet `silent_destruction_replace_not_merge` — strengthened at the assembly-layer enactment: `extractLineageRelations` builds establisher-keyed payloads (line 243/253/260/269) that DRIVE the downstream LineageIngestionRequestProcessor + LineageServiceImpl.replaceLineagePaths atomic-rewrite contract. The destructive verb is downstream; the destructive WIRING is here."
  - "F-008 drift facet `single_transaction_per_batch_no_per_entity_isolation` — strengthened at the @ReactiveTransactional boundary line 66, the OUTER transaction binding all 14 processors + OTLP export."
  - "F-008 drift facet `destruction_under_default_off_auth` — strengthened at the enforcement point: this Impl's line 68 resolves the datasource ONLY by payload ODDRN with NO principal-to-datasource binding, AND application.yml:48 ships the filter OFF."
  - "F-008 drift facet `undocumented_carve_out` (MICROSERVICE specific-attributes exclusion) — strengthened at the exact line 103."
  - "Sibling sidecar `IngestionService.md` (batch I, interface-axis) — strengthened via line-anchored impl-class internals. No contradiction."
  - "Sibling sidecar `IngestionDataEntitiesFilter.md` (batch O, hop-0 filter) — strengthened via service-tier enforcement point. The filter is the gate; the service is the executor. No contradiction."
  - "Sibling sidecar `LineageServiceImpl.md` (batch I) — strengthened via the establisher-keyed lineage replacement convention (implicit_adrs[2] here)."
  - "Sibling sidecar `ReactiveDataEntityRepositoryImpl.md` (batch H) — strengthened via the bulkCreate-plain-INSERT + listByOddrns-with-hollow+deleted-true coupling."
- **supersedes**: []  — no prior claim about this Impl class is superseded by this sidecar.
- **conflicts**: []  — no contradictions with F-008 detail YAML, IngestionService.md interface sibling, IngestionDataEntitiesFilter.md filter sibling, LineageServiceImpl.md service sibling, or repository-tier siblings. All claims here are file-local impl observations OR refinements of the macro story.
- **new_findings_not_yet_in_F008**:
  - "Duplicate-ODDRN crash (line 86) — Impl-specific corner case not in the F-008 drift facets list. Candidate addition: `duplicate_oddrn_in_single_payload_crashes_entire_ingestion`. Severity MEDIUM."
  - "Null-entityClassIds NPE in new-pojo path (line 284-285 vs guarded existing path) — Impl-specific. Candidate F-008 drift facet: `calculate_total_delta_count_null_entity_class_ids_npe`. Severity LOW."
  - "@Slf4j unused / no service-layer audit trail (line 53 + Grep zero matches) — Impl-specific. Candidate F-008 drift facet: `ingestion_service_silent_destructive_paths_no_log_audit`. Severity MEDIUM. Cross-link to the cross-batch audit-silence pattern (concepts.yaml entry per F-008 batch P notes)."

## Maintainer notes

