---
node_id: "odd-platform java service service:LineageServiceImpl"
node_kind: service
axis: services
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-I-lineage-service
---

# LineageServiceImpl — semantic understanding

## understanding

Reactive Spring `@Service` (LineageServiceImpl.java:51-53) that composes `ReactiveLineageRepository`, `ReactiveDataEntityRepository`, `ReactiveGroupEntityRelationRepository`, and `LineageMapper` into three public operations: (1) `getLineage(long, int, List<Long>, LineageStreamKind)` — the lineage-canvas read for F-005, executes a recursive-CTE walk merged with a depth-1 expansion fan-out (LineageServiceImpl.java:87-122); (2) `getDataEntityGroupLineage(Long)` — the DEG-internal lineage assembly for the `Data Entity Group → Lineage` tab (LineageServiceImpl.java:59-85); (3) `replaceLineagePaths(List<LineagePojo>)` — the ingestion atomic-rewrite primitive wrapped in `@ReactiveTransactional` (LineageServiceImpl.java:124-133). The service is the **negative-case sibling** of the batch-G/batch-H anchor-set defence-in-depth pattern: `getLineage` accepts a raw `dataEntityId` from the controller WITHOUT invoking `authIdentityProvider.fetchAssociatedOwner()`, so the SQL-layer cross-owner enumeration documented at the repository layer (REFACTOR-203) is NOT mitigated at this layer either — confirmed by direct read of LineageServiceImpl.java:87-122 (no `AuthIdentityProvider` import at line 19 + no `authIdentityProvider` field at lines 54-57). The contrast is `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns` (DataEntityRelationsServiceImpl.java:25-39) which DOES call `fetchAssociatedOwner()` (line 26) before passing the resolved owner's entity-oddrn set to the same repository.

## concepts

- entities: [
    "`DataEntityLineage` (OpenAPI response contract; LineageServiceImpl.java:21) — root + downstream + upstream graph for the lineage-canvas API",
    "`DataEntityGroupLineageList` (OpenAPI response contract; LineageServiceImpl.java:20) — list of per-DEG-member lineage streams for the DEG-lineage API",
    "`DataEntityLineageDto` (internal DTO with `dataEntityDto + downstream + upstream`; DataEntityLineageDto.java:9-17) — assembled at LineageServiceImpl.java:240-253",
    "`DataEntityLineageStreamDto` (internal DTO record: nodes, edges, groups, groupsRelations; DataEntityLineageStreamDto.java:9-13) — assembled at LineageServiceImpl.java:135-198 (two overloaded private builders)",
    "`DataEntityGroupLineageDto` (record of List<DataEntityLineageStreamDto>; DataEntityGroupLineageDto.java:5)",
    "`LineageNodeDto` (record: entity, childrenCount, parentsCount; LineageNodeDto.java:5) — wraps DataEntityDimensionsDto with per-node fan-out counts",
    "`LineagePojo` (jOOQ-generated row from the `lineage` table — parent_oddrn, child_oddrn, establisher_oddrn, is_deleted)",
    "`LineageDepth` (DTO wrapping `int depth + boolean empty`; LineageDepth.java:8-19) — `of(int)` and `empty()` factory methods",
    "`LineageStreamKind` (enum: UPSTREAM | DOWNSTREAM; LineageStreamKind.java:1-6) — direction of traversal",
    "`DataEntityDimensionsDto` (per-oddrn metadata: dataEntity + dataSource + namespace + owners + tags) — the per-node payload"
  ]
- operations: [
    "getLineage(long dataEntityId, int lineageDepth, List<Long> expandedEntityIds, LineageStreamKind) — root resolve (404 if missing) → recursive-CTE walk merged with depth-1 expansion → distinct → fetch per-oddrn metadata + group relations + children/parent counts → assemble + map to DataEntityLineage (LineageServiceImpl.java:87-122)",
    "getDataEntityGroupLineage(Long dataEntityGroupId) — resolve DEG-member oddrns (404 if no entities) → fetch internal-DEG edges → filter out DEG-typed entities from both edges and dict → build relationsMap → walk owner-anchored connected components → assemble per-component streams → map (LineageServiceImpl.java:59-85)",
    "replaceLineagePaths(List<LineagePojo>) — group by establisher_oddrn → batchDeleteByEstablisherOddrn → batchInsertLineages, under @ReactiveTransactional (LineageServiceImpl.java:124-133)",
    "getLineageStream (4-arg, lines 135-179) — assemble DataEntityLineageStreamDto for the canvas-read path: edges as Pair<id,id>, nodes as LineageNodeDto with fan-out counts, group repository, groupRelations Map<entityId, List<groupId>>",
    "getLineageStream (3-arg, lines 181-198) — assemble DataEntityLineageStreamDto for the DEG-internal path: edges + nodes without fan-out counts, empty groups (the DEG case never resolves group memberships)",
    "establishDEGRelations (lines 200-216) — for every DEG-member oddrn, expand the connected component of related entities via BFS-shaped recursion (getRelationsForEntities), avoiding re-walking already-participated oddrns",
    "getRelationsForEntities (lines 218-233) — tail-recursive expansion: collect new edges touching the to-handle set, expand the new-oddrn frontier, recurse until the frontier is empty",
    "buildDataEntityLineage (lines 240-253) — pivot the stream into the downstream OR upstream slot based on LineageStreamKind",
    "getDataEntityWithDatasourceMap (lines 235-238) — fetch DataEntityDimensionsDto for a collection of oddrns and pivot to `Map<oddrn, dto>`",
    "buildRelationsMap (lines 282-289) — pivot List<LineagePojo> to Map<oddrn, List<edge>> with each edge filed under BOTH endpoints (used only by the DEG-lineage path)",
    "isDEG / isDegODDRN (lines 304-312) — predicate: does any of the entity's class IDs equal DATA_ENTITY_GROUP?"
  ]
- invariants: [
    "getLineage emits `404 NotFoundException` ONLY if the root data entity does not exist (line 93); every other failure mode (NPE on null Integer→int autoboxing at the controller→service boundary, depth=0 returning empty result, depth=MAX_VALUE running to Postgres limits) is unhandled and surfaces as a 500-class error",
    "getDataEntityGroupLineage emits `404 NotFoundException` if `getDEGEntitiesOddrns(dataEntityGroupId)` emits an empty Flux (line 62 — `.switchIfEmpty(Flux.error(new NotFoundException(...)))`); a DEG with at least one member entity is treated as 'valid' regardless of whether the members have lineage edges",
    "Inner-DEG suppression: the comment at line 71 — `// Remove this when we will support inner DEGs for DEG lineage` — and the predicate at lines 72-75 filters out edges where EITHER endpoint is itself a DEG, AND removes DEG-typed entries from the metadata dictionary. The current behaviour does NOT recurse into nested DEGs; this is an explicit deferred-feature marker",
    "getLineage assembles `Set.of(root.getDataEntity().getOddrn())` (line 96) — a SINGLE-element root set passed to the repository CTE. Multi-root traversal at the service layer is not exposed; the repository supports it but no controller-method consumer asks for it",
    "Two-input split: `lineageRelations` (the recursive CTE walk) is `mergeWith(expandedRelations)` (line 100), then `.distinct().collectList()` (lines 101-102) — the distinct happens on whole LineagePojo equality (default record-style); edges duplicated across the two queries are collapsed before metadata fetch",
    "`oddrnsToFetch` (line 106) is the union of every oddrn referenced in the merged edge set, used to drive THREE downstream calls in one `Mono.zip` (lines 113-114: `getChildrenCount`, `getParentCount`, plus the repositoryMapsMono from line 110-111 which itself fans out to `fetchGroupRelations` + `getGroupsAndEntitiesMaps`)",
    "Reactive composition runs as a chain of `.flatMap` operators on a single `Mono` — no `subscribeOn`, no explicit Scheduler, no parallel publishing; the pipeline executes on whatever the upstream WebFlux event loop hands off",
    "replaceLineagePaths is the ONLY method on this service that is `@ReactiveTransactional` (line 125); getLineage and getDataEntityGroupLineage are read-only and NOT transactional",
    "Establisher-grouping at line 127-129: `pojos.stream().map(LineagePojo::getEstablisherOddrn).collect(toSet())` produces the set of establisher oddrns to delete. The contract is 'replace ALL edges by these establishers with the supplied pojos' — if an establisher in the input pojo set has no current edges to delete, the delete clause is a no-op; if an existing establisher is NOT in the input pojo set, its edges are LEFT UNTOUCHED (this is the establisher-keyed provenance property)",
    "getDataEntityGroupLineage uses the 3-arg getLineageStream private overload (line 80), which always passes `List.of()` as groups and `Map.of()` as groupsRelations (line 197) — DEG-lineage results NEVER surface group memberships in the response, only the underlying edge graph"
  ]
- audiences: [
    "ODD Platform UI lineage canvas (F-005) — DataEntityController.getDataEntityDownstreamLineage / getDataEntityUpstreamLineage (DataEntityController.java:255-273) are the HTTP-surface entry points for getLineage",
    "ODD Platform UI DEG lineage panel — DataEntityController.getDataEntityGroupsLineage (DataEntityController.java:276-281) is the HTTP-surface entry point for getDataEntityGroupLineage; consumed by `useDataEntityGroupLineage` (odd-platform-ui/src/lib/hooks/api/dataEntity.ts:45-52) on the `DEGLineage.tsx` component",
    "ODD Platform ingestion pipeline — LineageIngestionRequestProcessor (LineageIngestionRequestProcessor.java:13-23) calls `replaceLineagePaths(request.getLineageRelations())` when the incoming ingestion payload carries lineage edges; runs per `POST /ingestion/entities` request",
    "Third-party API consumers calling `GET /api/dataentities/{id}/lineage/downstream`, `GET /api/dataentities/{id}/lineage/upstream`, and `GET /api/dataentitygroups/{group_id}/lineage` directly per the openapi.yaml contract"
  ]

## dependencies_semantic

- requires-feature: [
    "F-005 data-lineage feature — substrate feature anchor for the lineage-canvas read path (getLineage). The operator-facing live doc (`https://docs.opendatadiscovery.org/features/data-lineage`) — last verified in this workspace 2026-05-12 status 200 per the batch-F `getDataEntityDownstreamLineage` sidecar — does NOT describe depth caps, cycle handling, owner-scoping, or DEG-recursion behaviour; the API-reference live doc (`https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage`) — same verification — describes `lineage_depth` as 'Number of hops to traverse from the rooted entity. Unset returns the platform's default depth' (this service does NOT implement a default; null Integer→int autoboxing at line 89 is the realised behaviour); WebFetch in this session 2026-05-19 was permission-denied (see docs_link_semantic.last_verified_status)",
    "F-005 DEG-lineage sub-flow — getDataEntityGroupLineage backs the DEG's own `Lineage` tab. The operator-facing page does not separately describe DEG-lineage behaviour; the API page references `getDataEntityGroupsLineage` but does not document the inner-DEG-suppression noted at LineageServiceImpl.java:71-75",
    "F-021 ingestion — replaceLineagePaths is the ingestion-side primitive for lineage-edge updates; the contributing feature is the broader ingestion pipeline, of which lineage-edge replacement is one of many ingestion-request processors (LineageIngestionRequestProcessor.java:10-13)"
  ]
- requires-config: [] — N/A: this service reads no config keys. No `@Value`, no `@ConfigurationProperties`. Recursion depth is a per-call parameter; there is no service-layer ceiling or floor applied to it.
- requires-runtime: [
    "Spring DI — `@Service` + `@RequiredArgsConstructor` at LineageServiceImpl.java:51-53; constructor-injects ReactiveLineageRepository, ReactiveDataEntityRepository, ReactiveGroupEntityRelationRepository, LineageMapper (lines 54-57)",
    "Spring `@Transactional` reactive proxy — `@ReactiveTransactional` (LineageServiceImpl.java:125) is meta-annotated `@Transactional(\"reactiveTransactionManager\")` (ReactiveTransactional.java:11); requires the `reactiveTransactionManager` bean to be configured (R2DBC + Spring TransactionalOperator)",
    "Project Reactor — Mono, Flux, Tuples; `reactor.function.TupleUtils.function` at line 49 to destructure Mono.zip tuples; `Flux.error / Mono.error` for error materialisation",
    "Apache Commons Collections — `CollectionUtils.isEmpty` at line 222 and `SetUtils.union / SetUtils.difference` at lines 18, 231, 257 — pulls a non-trivial transitive dependency that the team has chosen to depend on for set algebra ergonomics over plain JDK Set ops",
    "LineageMapper Spring bean (MapStruct-generated impl injected at line 57); LineageMapper.mapLineageDto / mapGroupLineageDto produce the response contracts"
  ]
- couples-to: [
    "`LineageService` interface (LineageService.java:11-19) — defines the public contract. The interface signature uses primitive `int` for lineageDepth (LineageService.java:12); the controller method passes a boxed `Integer` (DataEntityController.java:257) — the autobox is the null-NPE vector inherited from the controller layer (batch-F finding)",
    "`ReactiveLineageRepository` — wired at LineageServiceImpl.java:54; the service uses 6 of its public methods: getLineageRelations(List), getLineageRelations(Set,depth,kind), getLineageRelationsForDepthOne, getChildrenCount, getParentCount, batchDeleteByEstablisherOddrn, batchInsertLineages",
    "`ReactiveDataEntityRepository` — wired at LineageServiceImpl.java:55; getDataEntityWithDataSourceAndNamespace(long) (line 92) + getDataEntitiesWithDataSourceAndNamespace(Collection<String>) (line 236)",
    "`ReactiveGroupEntityRelationRepository` — wired at LineageServiceImpl.java:56; getDEGEntitiesOddrns(long) (line 61) + fetchGroupRelations(Set<String>) (line 110)",
    "`LineageMapper` — wired at LineageServiceImpl.java:57; mapLineageDto (line 121) + mapGroupLineageDto (line 84)",
    "Spring `@ReactiveTransactional` proxy infrastructure — the `replaceLineagePaths` method only achieves atomicity because the Spring TX proxy wraps the call (the annotation does nothing if called via `this.replaceLineagePaths(...)` from another method in the same class, but no such self-invocation exists)",
    "OpenAPI-generated DTOs `DataEntityLineage` and `DataEntityGroupLineageList` (LineageServiceImpl.java:20-21) — owned by the spec; signature change here would require coordinated regeneration"
  ]

## upstream_callers

| Caller (file:line) | Method invoked | Call context | Owner-scoping at caller? | Notes |
|---|---|---|---|---|
| DataEntityController.getDataEntityDownstreamLineage (DataEntityController.java:255-263) | `getLineage(dataEntityId, lineageDepth, expandedEntityIds, DOWNSTREAM)` | Lineage-canvas read for downstream direction — F-005 primary surface | **NO** — controller does not call `fetchAssociatedOwner()` (no `AuthIdentityProvider` field at DataEntityController.java:74-82 lineage-related fields) | The four-argument pass-through where `Integer lineageDepth` is autoboxed to primitive `int` at the service boundary (line 261). Null `lineage_depth` → NPE at LineageServiceImpl.java:96 (`LineageDepth.of(lineageDepth)` — the autoboxing happens BEFORE `.of()` is called). |
| DataEntityController.getDataEntityUpstreamLineage (DataEntityController.java:265-273) | `getLineage(dataEntityId, lineageDepth, expandedEntityIds, UPSTREAM)` | Lineage-canvas read for upstream direction — F-005 symmetric surface | **NO** — same as downstream; controller has no owner argument | Identical to the downstream method modulo `LineageStreamKind.UPSTREAM`; same null-NPE vector. |
| DataEntityController.getDataEntityGroupsLineage (DataEntityController.java:276-281) | `getDataEntityGroupLineage(dataEntityGroupId)` | DEG-lineage tab read — F-005 DEG sub-flow | **NO** — controller has no owner argument; the DEG ID is path-supplied and the service does not filter by current user | Two-line delegation; the DEG must exist and have at least one member entity for a 200 response (LineageServiceImpl.java:61-62). |
| LineageIngestionRequestProcessor.process (LineageIngestionRequestProcessor.java:15-18) | `replaceLineagePaths(request.getLineageRelations())` | Ingestion pipeline — atomic rewrite of an establisher's edges per `POST /ingestion/entities` request | N/A — ingestion path, gated by `IngestionDataEntitiesFilter` upstream when `auth.ingestion.filter.enabled=true` | Wraps in `.then()` to convert `Flux<LineagePojo>` to `Mono<Void>`; the transactional boundary is the service-method annotation (LineageServiceImpl.java:125), not the processor. |

## downstream_side_effects

| Method | Repository / mapper calls | RW shape | Transactional scope | Concurrency / failure modes |
|---|---|---|---|---|
| getLineage (lines 87-122) | reactiveDataEntityRepository.getDataEntityWithDataSourceAndNamespace (line 92); lineageRepository.getLineageRelations(Set,depth,kind) (line 95-97); lineageRepository.getLineageRelationsForDepthOne (line 98-99); groupEntityRelationRepository.fetchGroupRelations (line 110); lineageRepository.getChildrenCount (line 113); lineageRepository.getParentCount (line 114); reactiveDataEntityRepository.getDataEntitiesWithDataSourceAndNamespace (via getDataEntityWithDatasourceMap at line 236, invoked from getGroupsAndEntitiesMaps line 257); lineageMapper.mapLineageDto (line 121) | Read-only — 6+ DB round-trips per call (root-resolve + recursive-CTE + depth-1 expansion + group-relations fetch + 2× count + entity-metadata fetch) | Non-transactional (no @ReactiveTransactional); each DB call is its own statement | Failure in any inner Mono propagates as the outer Mono's error; partial materialisation is possible — the `Optional.orElseThrow` blocks at lines 152-154 and 170-173 throw `RuntimeException("Entity with oddrn %s wasn't fetched")` if the metadata fetch returned fewer oddrns than the edge set referenced (race window: an entity hard-deleted between the lineage walk and the metadata fetch) |
| getDataEntityGroupLineage (lines 59-85) | groupEntityRelationRepository.getDEGEntitiesOddrns (line 61); reactiveDataEntityRepository.getDataEntitiesWithDataSourceAndNamespace (via getDataEntityWithDatasourceMap at line 236, invoked from line 65); lineageRepository.getLineageRelations(List<String>) (line 66); lineageMapper.mapGroupLineageDto (line 84) | Read-only — 3 DB round-trips per call (DEG-members + entity-metadata + lineage-relations) + in-memory BFS expansion of the connected components (`establishDEGRelations` line 76-78 + `getRelationsForEntities` recursion lines 218-233) | Non-transactional | The in-memory BFS recursion at `getRelationsForEntities` (line 218-233) is **tail-recursive but uses the JVM call stack** — for a DEG with a very wide connected component (e.g. 10K+ entities in a single component), this can blow the stack. The recursion frontier is `newOddrns = SetUtils.difference(established, handled)` (line 231) which converges only when no new oddrns are discovered. |
| replaceLineagePaths (lines 124-133) | lineageRepository.batchDeleteByEstablisherOddrn (line 131); lineageRepository.batchInsertLineages (line 132) | Write — DELETE then INSERT against `lineage` table | **`@ReactiveTransactional`** (line 125) — both calls run inside one Spring reactive transaction; partial failure rolls back the DELETE | The contract is 'delete all edges by these establishers, then insert the supplied edges'. If `pojos` is empty, `establishers` is empty (line 127-129) and `batchDeleteByEstablisherOddrn(emptySet)` becomes a no-op DELETE with `establisher_oddrn IN ()` — Postgres handles this as `WHERE FALSE`; safe but a wasted round-trip. |

## tests_coverage_semantic

- covered_behaviours: [
    "getLineage happy path — `LineageServiceTest.getLineageTest` (LineageServiceTest.java:123-174) — mocks ALL three repositories + the mapper config; calls `lineageService.getLineage(1L, 1, List.of(), DOWNSTREAM)`; asserts a 3-node graph (root + 2 children) with 2 edges; verifies the mapper output shape (nodes have ids 1L/2L/3L, edges are (1→2) and (1→3)); does NOT exercise the depth-1 expansion path (`getLineageRelationsForDepthOne` is mocked to `Flux.empty()` at line 150) and does NOT exercise group relations (`fetchGroupRelations` returns empty map at line 152) (test_class: unit)"
  ]
- uncovered_behaviours: [
    "getLineage with null `lineageDepth` Integer — controller→service autoboxing NPE is unexercised; no test asserts the behaviour or pins it as a known limitation (test_class: integration)",
    "getLineage with non-existent dataEntityId — `NotFoundException` propagation from line 93 is unexercised; no test asserts the 404 wire shape (test_class: integration)",
    "getLineage with non-empty `expandedEntityIds` — the depth-1 expansion `mergeWith` (line 100) + distinct semantics are unexercised; a test with overlapping rows between the two queries would verify the merged edge set is deduplicated correctly (test_class: unit or integration)",
    "getLineage with `lineageDepth=0` — the resulting `LineageDepth.of(0)` produces a CTE where `tDepth.lessThan(0)` is FALSE on iteration 1, meaning the recursive step never fires and only the seed (depth-1 edges) is returned. The behavioural contract here is not pinned; a regression that changed `.lessThan` to `.lessThanOrEqual` would silently shift this from 'one-hop' to 'no edges' (test_class: integration)",
    "getLineage with `lineageDepth=Integer.MAX_VALUE` — no test exercises the no-upper-bound limitation surfaced in batch-F bugs_limitations_corner_cases[1] (test_class: integration / load)",
    "getLineage with cyclic lineage — no test creates a cycle (A→B→A) in the underlying data and asserts termination behaviour (test_class: integration)",
    "getLineage with diamond DAG — no test creates a diamond (A→B, A→C, B→D, C→D) and asserts the merged edge set deduplicates correctly through `.distinct()` (test_class: integration)",
    "getLineage missing-oddrn-during-metadata-fetch — the `RuntimeException(\"Entity with oddrn %s wasn't fetched\")` at line 153 is unexercised; this is the race-window failure mode where an entity is hard-deleted between lineage walk and metadata fetch (test_class: integration)",
    "getDataEntityGroupLineage happy path — NO unit test on this method exists in LineageServiceTest.java (Grep `getDataEntityGroupLineage` against test files returns 0 hits). The DEG-lineage path is entirely untested at the service layer (test_class: unit or integration)",
    "getDataEntityGroupLineage with empty DEG — `NotFoundException` propagation at line 62 is unexercised (test_class: integration)",
    "getDataEntityGroupLineage with nested DEGs — the inner-DEG suppression at lines 71-75 (with the `// Remove this when we will support inner DEGs for DEG lineage` comment as the explicit deferred-feature marker) is unexercised; no test asserts that DEG-typed entities are filtered out of the result (test_class: integration)",
    "getDataEntityGroupLineage with a DEG whose member graph has multiple disconnected components — `establishDEGRelations` (lines 200-216) builds separate streams per component, but no test asserts the per-component partitioning is correct (test_class: integration)",
    "getDataEntityGroupLineage with a very-wide connected component — the JVM-stack-recursion at `getRelationsForEntities` (lines 218-233) is unexercised; no test exercises the StackOverflowError boundary (test_class: integration / load)",
    "replaceLineagePaths happy path — NO unit test on this method exists in LineageServiceTest.java. The ingestion path is tested INDIRECTLY via `LineageIngestionTest.simpleLineageIngestionTest` (LineageIngestionTest.java:48-51) which exercises the full ingestion HTTP flow; the service method itself has no isolated test asserting the @ReactiveTransactional semantics (test_class: integration)",
    "replaceLineagePaths with empty pojos list — the `establishers` set is empty (line 128) → the delete clause `establisher_oddrn IN ()` is a no-op; this edge case is unexercised (test_class: unit)",
    "replaceLineagePaths transactional rollback — no test asserts that a failure in `batchInsertLineages` rolls back `batchDeleteByEstablisherOddrn` (the @ReactiveTransactional atomicity contract); this is the regression hazard for any future refactor that splits the method or moves the annotation (test_class: integration)",
    "Owner-scoping ABSENCE — no test asserts that getLineage returns lineage edges crossing owner boundaries; the negative-case property is structurally untested (test_class: integration)"
  ]
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/LineageServiceTest.java:1-175 — single @Test method `getLineageTest` covers ONLY getLineage happy path with depth=1 (test_class: unit)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/LineageIngestionTest.java:37-end — `simpleLineageIngestionTest` exercises the HTTP-layer ingestion path that flows through `replaceLineagePaths`; not isolated to the service method (test_class: integration)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/mapper/LineageMapperTest.java:1-end — tests `LineageMapper` in isolation; does not exercise this service (test_class: unit)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/LineageRepositoryTest.java:1-326 — tests the underlying repository; does not exercise this service (test_class: integration)"
  ]
- gaps: |
    The single existing unit test (LineageServiceTest.getLineageTest) covers ~25% of the code paths in this service: it exercises getLineage's happy path with depth=1, empty expandedEntityIds, no group relations, and a mocked-repository configuration that papers over the recursive-CTE semantics. The remaining ~75% of behaviour — getDataEntityGroupLineage (entirely untested at service layer), replaceLineagePaths (entirely untested at service layer; only indirect HTTP-flow coverage), the null-Integer NPE vector, the depth=0 edge case, the cyclic / diamond-DAG behavioural pinning, the inner-DEG suppression contract (which is comment-marked as deferred-feature), the missing-oddrn-during-metadata-fetch race-window error, the transactional rollback contract for replaceLineagePaths, the JVM-stack-recursion boundary in `getRelationsForEntities`, and the owner-scoping absence — has ZERO test coverage. The substrate-named regression cases (REFACTOR-202 amplification, REFACTOR-203 cross-owner) flow THROUGH this service; pinning the negative-case behaviours at the service layer (even as `@Disabled` regression-prevention tests with explanatory comments) would create the test-class anchor that adr-archaeologist + test-coverage-mapper need to triage future refactors. The `// Remove this when we will support inner DEGs for DEG lineage` comment at line 71 is particularly telling: it acknowledges a known-deferred-feature without a corresponding `@Disabled` test or backlog citation; a test_class:integration regression test pinning the current 'inner DEGs are filtered out' contract would catch the moment that comment-promised refactor accidentally breaks the existing API contract.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in LineageServiceImpl.java (Grep `@docs` against the file returns 0 hits)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "Operator-facing feature page for the F-005 lineage feature that getLineage + getDataEntityGroupLineage back"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "network-error — WebFetch permission denied in this session; live verification deferred to the next available WebFetch-enabled run"
    confidence: LOW
    fetched_excerpts: |
      Indirect verification via the batch-F `getDataEntityDownstreamLineage` sidecar (lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md) which recorded a successful WebFetch on 2026-05-12 at status 200 with the excerpt 'data-object lineage: catalog entities and connections' and a cross-link to /developer-guides/api-reference/lineage. The page does not separately describe DEG-lineage, depth caps, cycle handling, or owner-scoping.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage"
    anchor: ""
    rationale: "API-reference page for the lineage endpoints (getDataEntityDownstreamLineage, getDataEntityUpstreamLineage, getDataEntityGroupsLineage) whose service layer is this file"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "network-error — WebFetch permission denied in this session"
    confidence: LOW
    fetched_excerpts: |
      Indirect verification via batch-F sidecar (same file as above), verified 2026-05-12 status 200: `lineage_depth` is documented as 'Number of hops to traverse from the rooted entity. Unset returns the platform's default depth' — this service does NOT implement a default; null Integer→int autoboxing at line 89 is the realised behaviour, confirming the doc-drift recorded in the batch-F sidecar. `expanded_entity_ids` is documented as 'IDs of Data Entity Group entities' — but the service passes them straight to `lineageRepository.getLineageRelationsForDepthOne(expandedEntityIds, lineageStreamKind)` (line 98-99) which accepts ANY data-entity IDs with no group-class filter.
- doc_drift_findings:
  - "Inherited from batch-F: live API-reference page claims `lineage_depth` 'Unset returns the platform's default depth' — this service does NOT implement a default. The controller passes `Integer lineageDepth` (DataEntityController.java:257) into the service's primitive-`int` parameter (LineageService.java:12); null autoboxes to NPE BEFORE line 96 (`LineageDepth.of(lineageDepth)`) even executes. The doc is actively misleading: there is no platform default; omitting the parameter is a 500-class request at the controller→service boundary. Severity: MEDIUM (doc-drift, error-handling-hole; this service is one of the two surfaces that confirm the drift)."
  - "Inherited from batch-F: live API-reference page describes `expanded_entity_ids` as 'IDs of Data Entity Group entities' — the service accepts ANY data-entity IDs and passes them to a depth-1 fan-out that joins on `DATA_ENTITY.ID.in(rootIds)` with no entity-class filter. The doc's narrowing to 'Data Entity Group entities' is incorrect; the parameter is a general per-entity expansion set. Severity: LOW (the broader behaviour is more permissive than the documented contract)."
  - "Operator-facing feature page does not document the inner-DEG suppression behaviour for getDataEntityGroupLineage (LineageServiceImpl.java:71-75 with the `// Remove this when we will support inner DEGs for DEG lineage` comment). A third-party caller building tooling on `getDataEntityGroupsLineage` for a DEG that contains nested DEGs will silently observe missing edges with no contract description of why. Severity: MEDIUM (coverage gap on an undocumented contract carve-out marked as deferred-feature in the code)."

## implicit_adrs

- "Single-Mono pipeline per public method — getLineage and getDataEntityGroupLineage are each a single Mono composed via `.flatMap` chains with a final `.map(lineageMapper::...)`. There is no `subscribeOn`, no explicit Scheduler, no parallel-publishing, no per-step error handling. The composition pattern reflects an intentional 'reactive happy path with default-context propagation' stance: the WebFlux event loop handles scheduling, downstream errors propagate to the outer Mono, and the response is committed only after the full graph is assembled. The split between `Mono.zip(repositoryMapsMono, getChildrenCount, getParentCount)` at lines 113-114 is the one place where parallelism happens — those three queries run concurrently because `Mono.zip` subscribes to each input." — evidence: LineageServiceImpl.java:87-122 + 59-85 + 113-114 — intent_anchor: `return Mono.zip(repositoryMapsMono, lineageRepository.getChildrenCount(oddrnsToFetch), lineageRepository.getParentCount(oddrnsToFetch)).map(function((repositoryMaps, childrenCountMap, parentsCountMap) -> ...))` (lines 113-119) — confidence: HIGH

- "Establisher-keyed atomic-rewrite contract for ingestion — replaceLineagePaths takes a `List<LineagePojo>`, extracts the SET of establishers, deletes ALL edges by those establishers, then inserts the supplied pojos, ALL inside a single @ReactiveTransactional. The contract is 'when an entity re-publishes its lineage, the rewrite is atomic and per-establisher: edges declared by OTHER entities are untouched'. This is the cornerstone of non-destructive multi-producer ingestion." — evidence: LineageServiceImpl.java:124-133 + ReactiveTransactional.java:11 + ReactiveLineageRepositoryImpl.java:42-58 — intent_anchor: `@ReactiveTransactional public Flux<LineagePojo> replaceLineagePaths(final List<LineagePojo> pojos) { final Set<String> establishers = pojos.stream().map(LineagePojo::getEstablisherOddrn).collect(Collectors.toSet()); return lineageRepository.batchDeleteByEstablisherOddrn(establishers).thenMany(lineageRepository.batchInsertLineages(pojos)); }` (lines 124-133) — confidence: HIGH

- "Two-query lineage assembly — getLineage issues TWO lineage-read queries (recursive-CTE for the bulk subgraph + depth-1 fan-out for `expandedEntityIds`) and merges them via `Flux.mergeWith(...).distinct()`. This is a deliberate UI-affordance protocol: the canvas reads a shallow tree by default (cheaper CTE), then asks for one-hop expansions as the user clicks specific nodes. The alternative — a single combined-depth query — would either over-fetch for the default canvas or under-fetch for the expansion clicks. The split is encoded as TWO separate parameters in the controller signature and TWO separate repository methods." — evidence: LineageServiceImpl.java:95-100 + LineageService.java:12-14 + ReactiveLineageRepositoryImpl.java:122-148 — intent_anchor: `final Flux<LineagePojo> lineageRelations = lineageRepository.getLineageRelations(Set.of(root.getDataEntity().getOddrn()), LineageDepth.of(lineageDepth), lineageStreamKind); final Flux<LineagePojo> expandedRelations = lineageRepository.getLineageRelationsForDepthOne(expandedEntityIds, lineageStreamKind); return lineageRelations.mergeWith(expandedRelations).distinct()...` (LineageServiceImpl.java:95-101) — confidence: HIGH

- "DEG-lineage is INNER-DEG-FREE by deliberate carve-out, marked as deferred-feature in the source — getDataEntityGroupLineage filters out edges whose endpoint is itself a DEG (LineageServiceImpl.java:73) AND removes DEG-typed entries from the metadata dictionary (line 75). The comment at line 71 — `// Remove this when we will support inner DEGs for DEG lineage` — is the explicit intent anchor: this is a known limitation, scoped to be lifted in a future change, NOT an accidental absence. The decision shapes the API contract: clients see a DEG's lineage as a flat graph of non-DEG members, not a recursive graph of nested DEGs." — evidence: LineageServiceImpl.java:71-75 — intent_anchor: `// Remove this when we will support inner DEGs for DEG lineage \n final List<LineagePojo> filteredRelations = relations.stream() \n .filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict)) \n .toList(); \n dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()));` (lines 71-75) — confidence: HIGH

- "DEG-lineage is per-MEMBER, not per-DEG — the 3-arg getLineageStream overload (lines 181-198) produces one DataEntityLineageStreamDto PER DEG-member oddrn, and `establishDEGRelations` (lines 200-216) partitions the DEG's edge graph into per-member connected components (tracking `participatedOddrns` to avoid re-walking). The result is `List<DataEntityLineageStreamDto>` in the response, not a single stream — the API contract is 'one lineage stream per DEG-member starting point'. This is the contract that `DataEntityGroupLineageList` (OpenAPI: `items: array of DataEntityLineageStream`) encodes." — evidence: LineageServiceImpl.java:79-82 + 181-198 + 200-216 — intent_anchor: `final List<DataEntityLineageStreamDto> items = establishedRelations.entrySet().stream().map(oddrnRelations -> getLineageStream(oddrnRelations.getKey(), oddrnRelations.getValue(), dict)).toList(); return new DataEntityGroupLineageDto(items);` (lines 79-82) — confidence: HIGH

## bugs_limitations_corner_cases

- "Anchor-set defence-in-depth is NOT applied — getLineage accepts `dataEntityId` from the controller and resolves the root via `reactiveDataEntityRepository.getDataEntityWithDataSourceAndNamespace(dataEntityId)` (line 92) WITHOUT calling `authIdentityProvider.fetchAssociatedOwner()`. The recursive-CTE walk that follows (line 95-97) operates on the resolved oddrn with NO owner filter at any layer (the repository itself confirms this — ReactiveLineageRepositoryImpl.java:122-176). This is the **negative-case sibling** of the batch-G/batch-H anchor-set pattern: `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns` (DataEntityRelationsServiceImpl.java:25-30) DOES call `fetchAssociatedOwner()` before invoking the same repository — that's how `getMyObjectsWithUpstream/Downstream` achieves owner-scoping even though the SQL layer doesn't. THIS service has no such anchor; cross-owner enumeration is unmitigated for the lineage-canvas read path (REFACTOR-203 confirmation at the service layer)." — evidence: LineageServiceImpl.java:87-122 (no AuthIdentityProvider import at line 19; no field at lines 54-57; no fetchAssociatedOwner call anywhere in the method body) vs DataEntityRelationsServiceImpl.java:20, 26 (the positive case) — severity: HIGH

- "Null-`lineageDepth` NPE at the controller→service boundary — the service signature is `getLineage(long dataEntityId, int lineageDepth, ...)` (LineageService.java:12) — primitive `int`. The controller passes `Integer lineageDepth` (DataEntityController.java:257) which is null-allowed by the OpenAPI spec (`lineage_depth` is `required: false`). The autoboxing at the call site (DataEntityController.java:261 `lineageService.getLineage(dataEntityId, lineageDepth, ...)`) throws NullPointerException when `lineageDepth` is null, BEFORE this service's body executes. The doc claims the unset behaviour is 'returns the platform's default depth' — there is no such default. This service does not check for null because the type system says it can't be null; the realised behaviour is unimplementable as written." — evidence: LineageService.java:12 + LineageServiceImpl.java:88-89 + DataEntityController.java:255-262 + ReactiveLineageRepositoryImpl.java:122-148 — severity: HIGH

- "No upper-bound check on `lineageDepth` at this service — getLineage builds `LineageDepth.of(lineageDepth)` (line 96) and hands the primitive int directly to the repository. There is no `Math.min(lineageDepth, MAX_DEPTH)` defensive clamp, no `if (lineageDepth > MAX) throw new ...`, no warning log. A caller passes `lineageDepth=Integer.MAX_VALUE` and the recursive CTE runs to whatever Postgres or graph-density limits enforce (REFACTOR-202 amplification at the service layer)." — evidence: LineageServiceImpl.java:87-97 (no defensive check between the controller boundary and the repository call) — severity: HIGH

- "Diamond-DAG amplification is COMPOSED at this service — getLineage merges the recursive-CTE result (which already materialises diamond intermediate rows; batch-H finding) with the depth-1 expansion fan-out via `Flux.mergeWith(...).distinct()` (lines 100-101), then calls `.collectList()` (line 102). The full edge list is held in JVM heap; the dedup happens after both queries materialise. For a depth-N diamond pattern with branching factor B, the intermediate row count grows as O(B^N) at the SQL layer BEFORE the service's distinct prunes — the cost is paid both in Postgres work_mem AND in JVM heap during the `.distinct().collectList()`." — evidence: LineageServiceImpl.java:95-102 + ReactiveLineageRepositoryImpl.java:122-131, 163-175 — severity: MEDIUM

- "Owner-scoping is BYPASSED — getLineage and getDataEntityGroupLineage both return graph payloads where every reachable entity's metadata is exposed regardless of the caller's owner relationship. The service performs no owner check, and the underlying lineage table has no owner column (V0_0_2__add_lineage.sql confirms — batch-H finding). For getDataEntityGroupLineage, the DEG itself becomes the anchor (line 61 — `getDEGEntitiesOddrns(dataEntityGroupId)`); any DEG visible to the caller exposes its full member-graph + reachable edges, even if specific members are owned by other teams." — evidence: LineageServiceImpl.java:87-122 (no owner filter in getLineage) + 59-85 (no owner filter in getDataEntityGroupLineage) + DataEntityController.java:255-281 (no Authentication argument passed in) — severity: HIGH

- "Race-window error: `Optional.orElseThrow(() -> new RuntimeException(\"Entity with oddrn %s wasn't fetched\"))` (lines 152-154 + 170-173) — if an entity is HARD-deleted between the lineage walk (lines 95-99) and the metadata fetch (line 110-111 + 113-114), the dtoRepository map will not contain the oddrn referenced by the edge set, and the assembly throws a bare RuntimeException with no error-code mapping. The user sees a generic 500. (Note: entities are typically SOFT-deleted via DataEntityInternalStateServiceImpl which also soft-deletes their lineage edges, mitigating this for the soft-delete path; the race window is for hard-deletes or the moment between soft-delete-of-entity and soft-delete-of-edges propagating.)" — evidence: LineageServiceImpl.java:152-154 + 169-173 + DataEntityInternalStateServiceImpl ownership of soft-delete-edges (see batch-H sidecar) — severity: LOW

- "JVM-stack recursion in `getRelationsForEntities` (lines 218-233) — the method is tail-recursive in structure (recursion is the final statement) but Java doesn't have tail-call optimisation; each `getRelationsForEntities(established, newOddrns, ...)` adds a stack frame. For a DEG with a wide connected component, recursion depth equals the number of BFS-frontier expansions (typically the component's diameter, not its size). For a path-graph component of length 1000+, this approaches the default JVM stack limit. The blast radius is bounded by DEG membership at line 61, but DEGs with thousands of members are not prevented." — evidence: LineageServiceImpl.java:218-233 (recursion at line 232) + 200-216 (the caller pattern) — severity: LOW

- "Inner-DEG suppression is comment-marked as deferred-feature but lacks a backlog citation or @Disabled regression test — the comment at line 71 (`// Remove this when we will support inner DEGs for DEG lineage`) acknowledges a known limitation, but there is no corresponding test that pins the CURRENT contract ('inner DEGs filtered out'). A future maintainer attempting the lift will have no test feedback when they accidentally break the existing API consumers; the lift will silently change the response shape from 'flat graph of non-DEG members' to 'recursive graph including DEG nodes'." — evidence: LineageServiceImpl.java:71-75 (deferred-feature comment with no test anchor) — severity: MEDIUM

- "replaceLineagePaths empty-input no-op without an early return — when `pojos` is an empty list (line 126), `establishers` is an empty set (line 127-129), `batchDeleteByEstablisherOddrn(emptySet)` issues a DELETE with `establisher_oddrn IN ()` which Postgres handles as `WHERE FALSE` (one round-trip cost), then `batchInsertLineages(emptyList)` is also a no-op. Two wasted DB round-trips for an empty input. Ingestion should never send an empty pojo list (the processor's `shouldProcess` at LineageIngestionRequestProcessor.java:21-23 short-circuits this) but a defensive early-return at the service layer would harden against direct misuse." — evidence: LineageServiceImpl.java:124-133 (no early-return guard) + LineageIngestionRequestProcessor.java:21-23 (upstream short-circuit) — severity: LOW

- "Self-invocation of `replaceLineagePaths` would silently bypass `@ReactiveTransactional` — Spring's transactional proxy only applies on EXTERNAL calls; if a future method on LineageServiceImpl called `this.replaceLineagePaths(...)`, the annotation would NOT apply, and the delete+insert would NOT be atomic. There is no self-invocation today, but the standard Spring caveat is undocumented at the service. A method-local refactor splitting the pair into two helpers and invoking from a third internal method would silently lose the transactional contract." — evidence: LineageServiceImpl.java:124-133 (Spring proxy semantics; no in-class self-invocation today) — severity: LOW

## security

- auth_mode_relevance: INTERNAL_ONLY — this service is a Spring `@Service` bean consumed only by controller-layer code and the ingestion processor; it is not directly on the HTTP surface. Authentication mode shapes the upstream caller's behaviour (the DataEntityController methods that flow into this service) but does not gate this service directly. Under DISABLED mode the upstream controller is unauthenticated and the service is reachable by any network probe (REFACTOR-185 inheritance through DataEntityController.getDataEntityDownstreamLineage / getDataEntityUpstreamLineage / getDataEntityGroupsLineage); under LOGIN_FORM/OAUTH2/LDAP the service is reachable by any authenticated user via the catch-all `pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29-30 per batch-F sidecar).
- ingestion_filter_relevance: PARTIAL — replaceLineagePaths flows through LineageIngestionRequestProcessor (LineageIngestionRequestProcessor.java:13-23) which runs on the `POST /ingestion/entities` path; the IngestionDataEntitiesFilter gates that path when `auth.ingestion.filter.enabled=true`. getLineage and getDataEntityGroupLineage do NOT participate in ingestion — they are the UI/API surface.
- authorization_assertions: [] — N/A: the service carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call, no owner-resolution call. Authorization is uniformly delegated to the upstream controller / authentication chain, which performs only `.authenticated()`.
- owner_scoping: BYPASSES — every public method on this service operates on caller-supplied IDs (dataEntityId, dataEntityGroupId, pojos) with no owner filter at any layer. The recursive-CTE walk has no JOIN-side owner predicate (batch-H confirmation); the DEG-member resolution at line 61 returns ALL members of the DEG regardless of caller ownership. The service is the **service-layer cross-owner enumeration sink** for the lineage-canvas and DEG-lineage read paths. — evidence: LineageServiceImpl.java:87-122 (no owner argument, no fetchAssociatedOwner call) + 59-85 (no owner argument) + 124-133 (ingestion path; N/A) + ReactiveLineageRepositoryImpl.java:122-176 (no SQL-layer owner filter) + DataEntityRelationsServiceImpl.java:25-39 (the positive-case sibling that DOES apply anchor-set scoping)
- data_exposure: [
    "Full downstream / upstream lineage subgraph for a single rooted data entity (every reachable entity's id, oddrn, internal/external name, entity_classes, datasource, namespace, group memberships, status, children_count, parents_count + the edge list) → returned to the controller layer for any authenticated caller under LOGIN_FORM/OAUTH2/LDAP; any caller under DISABLED. No owner filter applied at any layer.",
    "Full DEG-lineage graph (per-DEG-member subgraphs of non-DEG-typed entities + the edges between them) → returned to the controller layer for any authenticated caller. The DEG itself becomes the anchor; visibility of the DEG implies visibility of its full member-graph + reachable edges.",
    "Graph-shaped cross-owner pipeline structure leakage — lineage edges encode causal connections; leaking that entity X (owned by team A) has a downstream child Y (owned by team B) reveals the EXISTENCE of team B's pipeline structure even if team B's individual entities are not otherwise enumerable. This is the structural property REFACTOR-203 names; this service is the service-layer confirmation site."
  ]
- known_security_gaps: [
    "Anchor-set defence-in-depth is NOT applied to getLineage — confirms the negative-case half of the batch-G/batch-H anchor-set pattern. The service has no `AuthIdentityProvider` field, no `fetchAssociatedOwner` call, no owner check anywhere in the getLineage method body. — evidence: LineageServiceImpl.java:54-57 (no AuthIdentityProvider field) + 87-122 (no owner-resolution call) vs DataEntityRelationsServiceImpl.java:20, 26 (the positive case) — severity: HIGH",
    "Anchor-set defence-in-depth is NOT applied to getDataEntityGroupLineage either — the DEG ID is the anchor (line 61); any DEG visible to the caller is treated as an unrestricted starting point for full-member-graph enumeration. — evidence: LineageServiceImpl.java:59-85 — severity: HIGH",
    "No depth ceiling at the service — `lineageDepth` flows from the controller directly into `LineageDepth.of(lineageDepth)` (line 96) with no defensive clamp. Combined with the SQL-layer no-cap finding (batch-H), this is a DoS-amplification vector inherited end-to-end. — evidence: LineageServiceImpl.java:87-97 + ReactiveLineageRepositoryImpl.java:174 — severity: HIGH",
    "Null-`lineageDepth` NPE returns a generic 500 to the caller rather than the documented 'default depth' behaviour — exception trace leaks into logs; third-party callers cannot distinguish 'invalid request' from 'server error'. — evidence: LineageServiceImpl.java:88-89 + LineageService.java:12 + DataEntityController.java:261 — severity: MEDIUM"
  ]

## performance

- hot_paths: [
    "getLineage — every lineage-canvas open in the UI flows through this method (DataEntityController.getDataEntityDownstreamLineage / getDataEntityUpstreamLineage). Per-call cost: 6+ DB round-trips (root resolve + recursive-CTE + depth-1 expansion + group-relations fetch + children-count + parent-count + entity-metadata batch) + full graph materialisation in heap via `.collectList()` at line 102. The recursive-CTE alone scales as O(branching × depth) in intermediate rows.",
    "getDataEntityGroupLineage — every DEG `Lineage` tab open flows through this method (DataEntityController.getDataEntityGroupsLineage). Per-call cost: 3 DB round-trips + an in-memory BFS expansion (`establishDEGRelations` + `getRelationsForEntities`) whose cost is bounded by the DEG's connected-component size × number of components.",
    "replaceLineagePaths — every ingestion request carrying lineage edges flows through this method. Per-call cost: 1 DELETE round-trip + 1 INSERT round-trip inside one transaction. Hot in high-throughput ingestion (e.g. an Airflow collector publishing per-DAG-run lineage)."
  ]
- throughput_characteristics: [
    "Single Mono per request — non-blocking but synchronous-shape from the caller's perspective (one HTTP request → one HTTP response holding the full graph). No streaming variant.",
    "`Mono.zip(repositoryMapsMono, getChildrenCount, getParentCount)` at lines 113-114 — these three queries fan out concurrently because Mono.zip subscribes to each input simultaneously. This is the one parallel section of the pipeline.",
    "No batching of multiple lineage requests; each call is a fresh CTE walk + metadata fetch even if the UI is paging through the same entity's expansions (a depth-1 expansion click re-issues the full canvas-read endpoint with an updated expanded_entity_ids list).",
    "replaceLineagePaths is a single transaction containing TWO statements — high-throughput ingestion serialises through the @ReactiveTransactional boundary on the reactiveTransactionManager."
  ]
- resource_allocation: [
    "JVM heap — getLineage calls `.collectList()` at line 102 to materialise the full merged edge set, then loads dtoRepository + groupRepository + childrenCountMap + parentsCountMap (lines 110-119) all in heap before constructing the response. A 100K-edge graph holds 100K LineagePojo + 200K oddrns worth of DataEntityDimensionsDto + count maps simultaneously.",
    "Postgres work_mem — the recursive CTE materialises intermediate rows; for diamond DAGs and cyclic graphs, intermediate row counts grow before the outer selectDistinct prunes (batch-H finding). Service-layer composition adds the `.distinct().collectList()` heap cost on top.",
    "JVM call stack — `getRelationsForEntities` (lines 218-233) is recursive without TCO; depth equals BFS-frontier expansions (component diameter, not size). Default JVM stack limit ~512KB / ~5000 frames; component diameters in production lineage are typically <100 hops but not bounded.",
    "Per-connection R2DBC slot — getLineage holds the reactor pipeline open for 6+ sequential DB calls (some concurrent via Mono.zip); each call uses `databaseClient.inConnectionMany(...)` per JooqReactiveOperations (batch-H finding); a slow CTE pinning a connection extends the pipeline's connection occupancy."
  ]
- scaling_characteristics: [
    "Stateless service — scales horizontally with API instances; bottleneck is Postgres + JVM heap on the API node.",
    "No caching at the service layer — every call re-walks the CTE and re-fetches every entity's metadata; identical repeated requests pay full cost.",
    "No pagination on getLineage or getDataEntityGroupLineage responses — the only way to bound the response is `lineageDepth` (a quality-of-result tradeoff) or `expandedEntityIds` list size (a UI-affordance parameter, not a paging cursor). Third-party API consumers have no documented paging pattern.",
    "@ReactiveTransactional on replaceLineagePaths uses the reactiveTransactionManager — scaling depends on R2DBC connection-pool sizing (configured at the platform level, not visible at this service).",
    "No request-level cancel propagation surfaced — a client cancelling the HTTP request (e.g. user closes browser mid-canvas-load) propagates upstream through WebFlux's reactor signals; whether the in-flight CTE query gets cancelled at the Postgres side depends on R2DBC's cancel signal handling (not explicitly verified at this layer)."
  ]
- known_performance_gaps: [
    "Full-graph in-memory materialisation via `.collectList()` at line 102 — no streaming response; a 100K-node downstream subgraph + its per-node metadata holds in heap before serialisation. — evidence: LineageServiceImpl.java:101-119 — severity: MEDIUM",
    "Diamond-DAG composition cost — service-layer `.distinct().collectList()` (lines 101-102) deduplicates the merged edge set in heap; the upstream CTE has already materialised the intermediate rows (batch-H). Cost is paid in both work_mem AND JVM heap. — evidence: LineageServiceImpl.java:100-102 + ReactiveLineageRepositoryImpl.java:163-175 — severity: MEDIUM",
    "No caching layer — `@Cacheable` keyed on `(dataEntityId, lineageDepth, expandedEntityIds, lineageStreamKind)` would absorb most UI-canvas re-opens; the lineage graph changes only on ingestion. — evidence: LineageServiceImpl.java:87-122 (no @Cacheable, no cache lookup) — severity: LOW",
    "JVM-stack-recursion in `getRelationsForEntities` is unbounded by service-layer guards — for DEGs with wide connected components, stack-overflow is a soft limit. — evidence: LineageServiceImpl.java:218-233 — severity: LOW",
    "No request-cancel verification — whether browser-cancel propagates to in-flight Postgres CTE queries depends on R2DBC plumbing not visible at this layer; without verification, a long-canvel-cancel-reopen cycle can hold connections. — evidence: LineageServiceImpl.java:87-122 (no explicit cancel handler) — severity: LOW",
    "No batching for the multi-call zip — the `Mono.zip(repositoryMapsMono, getChildrenCount, getParentCount)` (lines 113-114) DOES parallelise across three queries, but the upstream sequential chain (root-resolve → recursive-CTE + depth-1-expansion merge → distinct → metadata fetch) cannot be further parallelised without restructuring; lineage canvas latency is gated by the recursive CTE + the entity-metadata fetch in series. — evidence: LineageServiceImpl.java:87-122 — severity: LOW"
  ]

## sources

- understanding ← LineageServiceImpl.java:1-313 + LineageService.java:11-19 + DataEntityRelationsServiceImpl.java:25-39 (the positive-case sibling) + ReactiveLineageRepositoryImpl.java:122-176 (downstream confirmation)
- concepts.entities ← LineageServiceImpl.java:20-37 (imports) + DataEntityLineageDto.java:9-17 + DataEntityLineageStreamDto.java:9-13 + DataEntityGroupLineageDto.java:5 + LineageNodeDto.java:5 + LineageDepth.java:8-19 + LineageStreamKind.java:1-6
- concepts.operations ← LineageServiceImpl.java:59-85 (getDataEntityGroupLineage) + 87-122 (getLineage) + 124-133 (replaceLineagePaths) + 135-198 (two private getLineageStream overloads) + 200-233 (DEG-walk recursion) + 235-238 (getDataEntityWithDatasourceMap) + 282-289 (buildRelationsMap) + 304-312 (DEG predicates)
- concepts.invariants ← LineageServiceImpl.java:62, 71-75, 76, 96, 100-102, 106, 113-114, 125, 127-129, 197
- dependencies_semantic.requires-feature ← Inherited from batch-F sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md` (WebFetch verified 2026-05-12 status 200 for both pages); WebFetch in this session was permission-denied — see docs_link_semantic
- dependencies_semantic.requires-runtime ← LineageServiceImpl.java:18, 19, 38-42, 49 (imports) + ReactiveTransactional.java:11 + 51-53 (Spring annotations) + 54-57 (constructor-injected deps)
- dependencies_semantic.couples-to ← LineageService.java:11-19 + LineageServiceImpl.java:54-57 + DataEntityController.java:257-262 + LineageIngestionRequestProcessor.java:13-17
- upstream_callers ← DataEntityController.java:255-281 + LineageIngestionRequestProcessor.java:13-23 + Grep `lineageService\.` returned exactly these 4 caller sites
- downstream_side_effects ← LineageServiceImpl.java:59-133 (each method body) + ReactiveLineageRepositoryImpl.java method signatures (batch-H sidecar) + ReactiveDataEntityRepository.java:52, 54 + ReactiveGroupEntityRelationRepository.java:28, 30
- tests_coverage_semantic.covered_behaviours ← LineageServiceTest.java:123-174 (the single @Test method)
- tests_coverage_semantic.uncovered_behaviours ← LineageServiceTest.java absence inspection (no @Test for getDataEntityGroupLineage; no @Test for replaceLineagePaths; no negative-case tests for getLineage)
- tests_coverage_semantic.test_files ← LineageServiceTest.java:1-175 + LineageIngestionTest.java:1-60 + LineageMapperTest.java + LineageRepositoryTest.java (batch-H sidecar)
- docs_link_semantic.inferred_docs ← Inherited from batch-F sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md:80-106`. Live WebFetch in this session was permission-denied per Rule 1 (recorded as `network-error`).
- docs_link_semantic.doc_drift_findings.[0] ← LineageServiceImpl.java:88-89 (signature requires primitive int; null Integer cannot reach the body) + LineageService.java:12 + DataEntityController.java:255-262 + batch-F sidecar's WebFetch excerpt
- docs_link_semantic.doc_drift_findings.[1] ← LineageServiceImpl.java:98-99 (passes expandedEntityIds directly without group-type filter) + batch-F sidecar's WebFetch excerpt
- docs_link_semantic.doc_drift_findings.[2] ← LineageServiceImpl.java:71-75 (inner-DEG suppression comment-marked deferred) + batch-F sidecar (no doc coverage of DEG-lineage carve-out)
- implicit_adrs.[0] ← LineageServiceImpl.java:87-122 + 59-85 + 113-114
- implicit_adrs.[1] ← LineageServiceImpl.java:124-133 + ReactiveTransactional.java:11 + ReactiveLineageRepositoryImpl.java:42-58 (batch-H confirmation)
- implicit_adrs.[2] ← LineageServiceImpl.java:95-100 + LineageService.java:12-14 + ReactiveLineageRepositoryImpl.java:122-148
- implicit_adrs.[3] ← LineageServiceImpl.java:71-75 (the comment + the filter)
- implicit_adrs.[4] ← LineageServiceImpl.java:79-82 + 181-198 + 200-216
- bugs_limitations_corner_cases.[0] ← LineageServiceImpl.java:19, 54-57, 87-122 (negative case) vs DataEntityRelationsServiceImpl.java:8, 20, 26 (positive case)
- bugs_limitations_corner_cases.[1] ← LineageService.java:12 + LineageServiceImpl.java:88-89 + DataEntityController.java:255-262
- bugs_limitations_corner_cases.[2] ← LineageServiceImpl.java:87-97 (no defensive clamp) + ReactiveLineageRepositoryImpl.java:174 (batch-H)
- bugs_limitations_corner_cases.[3] ← LineageServiceImpl.java:95-102 + ReactiveLineageRepositoryImpl.java:122-131, 163-175 (batch-H)
- bugs_limitations_corner_cases.[4] ← LineageServiceImpl.java:87-122, 59-85 (no owner filter) + DataEntityController.java:255-281 + ReactiveLineageRepositoryImpl.java:122-176 (batch-H)
- bugs_limitations_corner_cases.[5] ← LineageServiceImpl.java:152-154, 169-173 (the orElseThrow blocks)
- bugs_limitations_corner_cases.[6] ← LineageServiceImpl.java:218-233 + 200-216
- bugs_limitations_corner_cases.[7] ← LineageServiceImpl.java:71-75 (deferred-feature comment without test anchor)
- bugs_limitations_corner_cases.[8] ← LineageServiceImpl.java:124-133 + LineageIngestionRequestProcessor.java:21-23
- bugs_limitations_corner_cases.[9] ← LineageServiceImpl.java:124-133 (Spring proxy semantics — out-of-class only)
- security.auth_mode_relevance ← LineageServiceImpl.java:51-53 (Spring @Service; not HTTP) + DataEntityController.java:255-281 (upstream) + batch-F sidecar (DISABLED reachability + AuthorizationCustomizer)
- security.ingestion_filter_relevance ← LineageIngestionRequestProcessor.java:10-23 (the ingestion-side caller) + LineageServiceImpl.java:124-133
- security.owner_scoping ← LineageServiceImpl.java:54-57, 87-122, 59-85 (no AuthIdentityProvider field, no owner argument) + DataEntityRelationsServiceImpl.java:20, 26 (the positive case) + ReactiveLineageRepositoryImpl.java:122-176 (batch-H)
- security.known_security_gaps.[0] ← LineageServiceImpl.java:54-57, 87-122 + DataEntityRelationsServiceImpl.java:20, 26
- security.known_security_gaps.[1] ← LineageServiceImpl.java:59-85
- security.known_security_gaps.[2] ← LineageServiceImpl.java:87-97 + ReactiveLineageRepositoryImpl.java:174 (batch-H)
- security.known_security_gaps.[3] ← LineageServiceImpl.java:88-89 + LineageService.java:12 + DataEntityController.java:261
- performance.hot_paths ← LineageServiceImpl.java:87-122, 59-85, 124-133 + DataEntityController.java:255-281 + LineageIngestionRequestProcessor.java:15-18
- performance.throughput_characteristics ← LineageServiceImpl.java:87-122 (Mono.zip parallelism at 113-114) + ReactiveTransactional.java:11 (single-statement TX scope)
- performance.resource_allocation ← LineageServiceImpl.java:101-119 (collectList + heap materialisation) + 218-233 (stack recursion) + ReactiveLineageRepositoryImpl.java:122-176 (work_mem; batch-H)
- performance.scaling_characteristics ← LineageServiceImpl.java:1-313 (no @Cacheable; no paging) + ReactiveTransactional.java:11 (reactiveTransactionManager)
- performance.known_performance_gaps.[0] ← LineageServiceImpl.java:101-119
- performance.known_performance_gaps.[1] ← LineageServiceImpl.java:100-102 + ReactiveLineageRepositoryImpl.java:163-175 (batch-H)
- performance.known_performance_gaps.[2] ← LineageServiceImpl.java:87-122
- performance.known_performance_gaps.[3] ← LineageServiceImpl.java:218-233
- performance.known_performance_gaps.[4] ← LineageServiceImpl.java:87-122
- performance.known_performance_gaps.[5] ← LineageServiceImpl.java:87-122

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (live WebFetch was permission-denied this session; verification is indirect via the batch-F sidecar's prior verification at 2026-05-12 status 200; the technical claims about the URLs' content are inherited and re-cited rather than re-verified)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

<!-- Empty on initial enrichment. Preserved verbatim across future refreshes. -->

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — reserved for future layer-5 probe runs that touch this node's contributing features (F-005, F-021). Batch-F sidecar for getDataEntityDownstreamLineage already carries 8 P-008 PASS entries pinning the null-Integer NPE empirically; those probes traverse THIS service's getLineage method but the recorded outcomes attach to the controller-method node by ADR Rule 4 (probes attach to the entry-point node, not every traversed node). -->
