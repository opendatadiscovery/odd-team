---
node_id: "odd-platform java repository reactive repository:ReactiveLineageRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-H-lineage-repo
---

# ReactiveLineageRepositoryImpl — semantic understanding

## understanding

Reactive jOOQ repository over the Postgres `lineage` table (parent_oddrn ↔ child_oddrn ↔ establisher_oddrn directed-edge rows with an `is_deleted` soft-delete flag; ReactiveLineageRepositoryImpl.java:1-177). It mediates every read and write of lineage edges in the platform: bulk insert / replace by establisher (used by ingestion to rewrite a producer's edges atomically), soft-delete + restore (used by the entity-internal-state delete/restore flow), simple parent/child fan-out counts for the entity-detail screen, the depth-1 fan-out used by progressive UI expansion, AND the **recursive-CTE traversal** that backs the lineage canvas (F-005). The CTE is a hand-written Postgres `WITH RECURSIVE` (lineageCte at ReactiveLineageRepositoryImpl.java:150-176) that walks from a root oddrn set for at most `lineageDepth.getDepth()` hops in the chosen direction (DOWNSTREAM follows parent→child, UPSTREAM follows child→parent), filtering soft-deleted edges in both the seed and the recursive step. The depth bound is the **only** recursion terminator — there is no visited-set guard, no owner JOIN, and no upper cap on the depth value itself.

## concepts

- entities: [
    "`LineagePojo` (table row: parent_oddrn, child_oddrn, establisher_oddrn, is_deleted; ReactiveLineageRepositoryImpl.java:20 + LineagePojo generated POJO)",
    "`LineageDepth` (DTO wrapping a primitive `int` depth + a boolean `empty` flag; LineageDepth.java:1-19)",
    "`LineageStreamKind` (enum: UPSTREAM | DOWNSTREAM; LineageStreamKind.java:1-6)",
    "`CommonTableExpression<Record>` (jOOQ CTE handle for `WITH RECURSIVE`; ReactiveLineageRepositoryImpl.java:150-176)",
    "`LINEAGE` jOOQ-generated table reference (columns PARENT_ODDRN, CHILD_ODDRN, ESTABLISHER_ODDRN, IS_DELETED; ReactiveLineageRepositoryImpl.java:35)"
  ]
- operations: [
    "batchDeleteByEstablisherOddrn — `DELETE FROM lineage WHERE establisher_oddrn IN (...) RETURNING *` (lines 43-47); the ingest-rewrite primitive",
    "batchInsertLineages — multi-row INSERT with `ON CONFLICT DO NOTHING` (jOOQ `onDuplicateKeyIgnore`) into (parent, child, establisher) tuples (lines 50-58)",
    "getTargetsCount — group-by parent_oddrn count of non-deleted edges keyed by parent (lines 61-69)",
    "getChildrenCount — count-distinct child_oddrn grouped by parent_oddrn over non-deleted edges (lines 72-79)",
    "getParentCount — count-distinct parent_oddrn grouped by child_oddrn over non-deleted edges (lines 82-89)",
    "softDeleteLineageRelations — UPDATE is_deleted=true for any edge touching `dataEntityOddrns` on EITHER end (lines 92-99)",
    "restoreLineageRelations — UPDATE is_deleted=false for any edge touching `dataEntityOddrns` on EITHER end (lines 102-109)",
    "getLineageRelations(List<String>) — internal-DEG edges: distinct (parent,child) where BOTH endpoints are in the oddrn list and not deleted (lines 112-119)",
    "getLineageRelations(Set<String>, LineageDepth, LineageStreamKind) — the recursive-CTE traversal (lines 122-131)",
    "getLineageRelationsForDepthOne(List<Long>, LineageStreamKind) — depth-1 fan-out around entity IDs joined to DATA_ENTITY (lines 134-148); the progressive-expansion primitive",
    "lineageCte (private) — assembles the `WITH RECURSIVE` body: seed = edges touching the root oddrn set in the chosen direction at depth=1; recursive step = JOIN cte on direction-appropriate equality, depth+1, `tDepth < lineageDepth` AND not deleted (lines 150-176)"
  ]
- invariants: [
    "Soft-delete is the canonical deletion mechanism — every read filters `LINEAGE.IS_DELETED.isFalse()` (lines 65, 76, 86, 115, 145, 167, 174). Hard delete only via batchDeleteByEstablisherOddrn (line 44) and only by ingestion's rewrite-by-establisher contract.",
    "The `is_deleted` column did not exist in the original schema — it was added in V0_0_79__data_deprecation.sql:11-12 (`ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE`); the original PK was `(parent_oddrn, child_oddrn)` (V0_0_2__add_lineage.sql:6) and was later replaced by `(parent_oddrn, child_oddrn, establisher_oddrn)` (V0_0_17__add_establisher_into_lineage.sql:116-117). The current model encodes edge provenance and supports a single (parent,child) edge declared by multiple establishers.",
    "The `lineage` table has NO owner column (V0_0_2__add_lineage.sql:1-7 + V0_0_17__add_establisher_into_lineage.sql:1-2 + V0_0_79__data_deprecation.sql:11-12) — owner-scoping at the data-entity level cannot be applied at the lineage table directly; any owner filter would require a JOIN to data_entity → ownership.",
    "The recursive CTE depth bound is `tDepth.lessThan(lineageDepth.getDepth())` (line 174) — the primitive `int` value is used directly. There is no null-guard at this layer; nulls would have NPE'd earlier (callers wrap their input in `LineageDepth.of(int)` at LineageServiceImpl.java:96 or `LineageDepth.empty()` at DataEntityRelationsServiceImpl.java:34).",
    "`LineageDepth.empty()` (LineageDepth.java:16-18) returns `new LineageDepth(-1, true)`. When this is passed to lineageCte, the recursive step's `tDepth.lessThan(-1)` is FALSE on the first iteration (depth starts at 1), so recursion terminates with only the seed rows. The `boolean empty` flag is NEVER read inside lineageCte — only the depth value matters; the flag is informational.",
    "No `@ReactiveTransactional` on this repository class (line 37-39: only `@Repository` + `@RequiredArgsConstructor`). Mutations rely on the caller's transactional scope: `LineageServiceImpl.replaceLineagePaths` is `@ReactiveTransactional` (LineageServiceImpl.java:124-133), `DataEntityInternalStateServiceImpl.restoreDeletedDataEntityRelations` is `@ReactiveTransactional` (DataEntityInternalStateServiceImpl.java:101-104)."
  ]
- audiences: [
    "ODD Platform lineage feature (F-005) — the recursive-CTE read path backs the lineage canvas on the entity-detail screen",
    "ODD Platform ingestion (LineageServiceImpl.replaceLineagePaths) — the batchDeleteByEstablisherOddrn + batchInsertLineages pair atomically rewrites an establisher's declared edges",
    "Entity soft-delete / restore flow (DataEntityInternalStateServiceImpl) — soft-delete / restore lineage edges when an entity transitions DELETED ↔ active",
    "Cross-owner subgraph enumeration in DataEntityRelationsService (getDependentDataEntityOddrns) — anchors the owner's entity oddrns and expands the reachable subgraph in EITHER direction with `LineageDepth.empty()` (a one-hop expansion in practice — see invariant 5)"
  ]

## dependencies_semantic

- requires-feature: [
    "F-005 data lineage feature — substrate feature anchor for the recursive-CTE traversal. The operator-facing live doc (`https://docs.opendatadiscovery.org/features/data-lineage`, verified 2026-05-12 status 200 per the existing batch-F `getDataEntityDownstreamLineage` sidecar's fetched_excerpts) does NOT document any depth cap, cycle handling, or owner-scoping; the API-reference live doc (`https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage`, verified 2026-05-12 status 200 per the same sidecar) describes `lineage_depth` as 'Number of hops to traverse from the rooted entity. Unset returns the platform's default depth.' — this is doc-code drift since there is no default in code; verbatim WebFetch on 2026-05-19 was blocked in this session (see docs_link_semantic.last_verified_status)",
    "F-021 cross-owner / owner-relations enumeration (DataEntityRelationsService.getDependentDataEntityOddrns) — uses lineage to expand from owner-anchored oddrns to the reachable subgraph"
  ]
- requires-config: [] — N/A: this repository reads no config keys. No `@Value`, no `@ConfigurationProperties`. The recursion depth is a per-call parameter, not a config-time value.
- requires-runtime: [
    "PostgreSQL with recursive-CTE support — `DSL.withRecursive(cte)` at line 126 (`getLineageRelations` set+depth+kind overload). Postgres 8.4+ supports `WITH RECURSIVE`; minimum supported Postgres version in the platform's compose/manifests is well above this (jOOQ generated tables in `model.Tables` are Postgres-specific).",
    "jOOQ reactive operations via `JooqReactiveOperations` (line 40) which wraps Spring's `DatabaseClient` (`JooqReactiveOperations.java:28`) — the `.flux(query)` calls (lines 46, 67, 78, 88, 97, 107, 118, 129, 146) execute via R2DBC; the `query.returning()` calls on UPDATE/DELETE (lines 96, 106) require Postgres's RETURNING support",
    "Spring DI — `@Repository` (line 37) + `@RequiredArgsConstructor` (line 38) + final `JooqReactiveOperations` field (line 40); the bean is wired into LineageServiceImpl, DataEntityRelationsServiceImpl, DataEntityInternalStateServiceImpl, DataEntityServiceImpl (Grep across odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service)"
  ]
- couples-to: [
    "Postgres `lineage` table schema (V0_0_2__add_lineage.sql, V0_0_17__add_establisher_into_lineage.sql, V0_0_26__remove_length_constraints.sql, V0_0_79__data_deprecation.sql); columns are addressed via the jOOQ-generated `LINEAGE` table reference (ReactiveLineageRepositoryImpl.java:35) which is regenerated from the live schema",
    "Postgres `data_entity` table (only in `getLineageRelationsForDepthOne` at line 144 — `JOIN DATA_ENTITY ON DATA_ENTITY.ODDRN = LINEAGE.PARENT_ODDRN` or `.CHILD_ODDRN`). All other reads operate on lineage rows ALONE.",
    "`LineagePojo` jOOQ-generated POJO — Pojo-mapping via `.map(r -> r.into(LineagePojo.class))` (lines 46, 57, 98, 108, 118, 130, 147); `LineagePojo.isDeleted` is set by the row mapping for INSERTed rows (line 76 in LineageRepositoryTest test asserts isDeleted is intentionally ignored)"
  ]

## upstream_callers

| Caller (file:line) | Method invoked | Call context | Owner-scoping at caller? | Notes |
|---|---|---|---|---|
| LineageServiceImpl.getDataEntityGroupLineage (LineageServiceImpl.java:66) | `getLineageRelations(List<String>)` | DEG-internal lineage assembly | NO — no owner filter on `entitiesOddrns`; the list comes from `groupEntityRelationRepository.getDEGEntitiesOddrns(dataEntityGroupId)` (line 61) | Internal-DEG edges only (both endpoints must be in the list — line 116-117); blast radius bounded by DEG membership. |
| LineageServiceImpl.getLineage (LineageServiceImpl.java:95-97) | `getLineageRelations(Set, LineageDepth.of(N), kind)` | Lineage canvas read path (F-005) — primary recursive-CTE consumer | NO — caller passes a single root oddrn with no owner filter; cross-owner blast radius confirmed in batch-F sidecar `getDataEntityDownstreamLineage.md:bugs_limitations_corner_cases[5]` | Receives `lineageDepth` directly from controller-layer `Integer` (DataEntityController.java:257) — NPE vector documented in the controller-method sidecar; the repository itself is downstream of that hazard. |
| LineageServiceImpl.getLineage (LineageServiceImpl.java:98-99) | `getLineageRelationsForDepthOne(rootIds, kind)` | Progressive UI expansion — depth-1 fan-out around `expandedEntityIds` | NO — same single-root pattern; `rootIds` is the client-supplied `expanded_entity_ids` list | The List<Long> input flows into a `DATA_ENTITY.ID.in(rootIds)` clause (line 145) — Postgres parameter-limit exposure for very large lists. |
| LineageServiceImpl.getLineage (LineageServiceImpl.java:113-114) | `getChildrenCount(oddrnsToFetch)` + `getParentCount(oddrnsToFetch)` | Per-oddrn fan-out counts displayed on each node | NO — `oddrnsToFetch` is the union of every oddrn referenced in the CTE result | Fan-out counts ARE for the full result-set oddrns; no owner filter. |
| LineageServiceImpl.replaceLineagePaths (LineageServiceImpl.java:131-132) | `batchDeleteByEstablisherOddrn` THEN `batchInsertLineages` | Ingestion path — atomic rewrite of an establisher's declared edges | N/A — ingestion, not a UI-bound owner-scoped operation. Wrapping `@ReactiveTransactional` (LineageServiceImpl.java:125) is the atomicity boundary. | Single transactional unit; partial failure rolls back both calls. |
| DataEntityRelationsServiceImpl.getDependentOddrns (DataEntityRelationsServiceImpl.java:34) | `getLineageRelations(Set, LineageDepth.empty(), kind)` | Owner→reachable-subgraph expansion (used by `getMyObjectsWith{Upstream,Downstream}`) | **YES** (at the anchor set) — the caller resolves owner via `authIdentityProvider.fetchAssociatedOwner()` (line 26) THEN passes the owner's entity-oddrn set as the root. This is the **batch-G NEW pattern**: anchor-set defence-in-depth, NOT JOIN-side owner filter. | With `LineageDepth.empty()` (depth=-1; LineageDepth.java:17), `tDepth.lessThan(-1)` is FALSE on the first iteration so recursion terminates after the seed step — effectively a one-hop expansion. The seed rows ARE the depth-1 edges around the anchor set. |
| DataEntityServiceImpl (line 665) | `getTargetsCount(datasetOddrns)` | Dataset-children badge on entity-detail (counts downstream consumers) | NO — `datasetOddrns` is the full visible dataset list; counts are aggregated globally per dataset oddrn | No owner filter at any layer for the counts. |
| DataEntityInternalStateServiceImpl.softDeleteDataEntities (DataEntityInternalStateServiceImpl.java:126) | `softDeleteLineageRelations(oddrns)` | Entity status-change soft-delete cascade | N/A — internal state machinery; called under `@ReactiveTransactional` on `restoreDeletedDataEntityRelations` (line 101) and the analogous transactional path for the delete side | Edges touching the deleted entity on EITHER end are flagged (lines 95-96). |
| DataEntityInternalStateServiceImpl.restore (DataEntityInternalStateServiceImpl.java:133) | `restoreLineageRelations(oddrns)` | Entity status-change restore cascade | N/A — internal state machinery; `@ReactiveTransactional` on parent method (line 101) | Symmetric to softDelete. |

## downstream_side_effects

| Method | DB tables touched | RW shape | RETURNING? | Transactional? | Concurrency / lock concerns |
|---|---|---|---|---|---|
| batchDeleteByEstablisherOddrn (lines 43-47) | `lineage` | DELETE | YES — `.returning()` (line 46) emits the removed rows back as Flux | No `@ReactiveTransactional` on the method; relies on caller (LineageServiceImpl.replaceLineagePaths is `@ReactiveTransactional` at LineageServiceImpl.java:125) | The DELETE+INSERT-RETURNING pair inside one transaction is the atomicity contract for "rewrite an establisher's edges"; outside a transaction, a concurrent reader could observe the empty intermediate state. |
| batchInsertLineages (lines 50-58) | `lineage` | INSERT … ON CONFLICT DO NOTHING (`onDuplicateKeyIgnore`) — RETURNING | YES — `.returning()` returns the actually-inserted rows (NOT the conflicted ones) | Same as above. | Idempotent on (parent, child, establisher) per the PK established at V0_0_17__add_establisher_into_lineage.sql:117. |
| getTargetsCount (lines 61-69) | `lineage` | SELECT — group-by parent_oddrn with `count(one())` | N/A (read) | N/A | Read-only; non-deleted edges only (line 65). |
| getChildrenCount (lines 72-79) | `lineage` | SELECT — count-distinct child_oddrn group-by parent_oddrn | N/A (read) | N/A | Read-only; non-deleted edges only (line 76). |
| getParentCount (lines 82-89) | `lineage` | SELECT — count-distinct parent_oddrn group-by child_oddrn | N/A (read) | N/A | Read-only; non-deleted edges only (line 86). |
| softDeleteLineageRelations (lines 92-99) | `lineage` | UPDATE is_deleted=true | YES — `.returning()` returns the flipped rows | No `@ReactiveTransactional`; caller (DataEntityInternalStateServiceImpl) wraps its delete cascade transactionally | The OR-on-either-end filter (line 95) flips edges in BOTH directions in a single statement; transactional under caller scope. |
| restoreLineageRelations (lines 102-109) | `lineage` | UPDATE is_deleted=false | YES — `.returning()` returns the flipped rows | Same as above | Symmetric to softDelete; caller path is `@ReactiveTransactional` at DataEntityInternalStateServiceImpl.java:101. |
| getLineageRelations(List) (lines 112-119) | `lineage` | SELECT DISTINCT (parent, child) — BOTH endpoints in oddrn list | N/A (read) | N/A | Filter is `IS_DELETED.isFalse() AND ((parent IN ? AND child IN ?) OR (child IN ? AND parent IN ?))` — note the two OR-branches are LOGICALLY EQUIVALENT (both require parent AND child to be in the same list). This is a code-shape pattern, not a defect; jOOQ resolves it to a single predicate after canonicalisation. |
| getLineageRelations(Set, depth, kind) (lines 122-131) | `lineage` | `WITH RECURSIVE t AS (seed UNION ALL recursive) SELECT DISTINCT parent, child FROM t` | N/A (read) | N/A | The CTE's intermediate rows materialise in Postgres `work_mem`; final selectDistinct deduplicates the outer projection only. No cycle guard, no row-count cap, no statement_timeout enforced at this layer. Performance is bounded by `lineageDepth` × branching factor × the lineage table's structure. |
| getLineageRelationsForDepthOne (lines 134-148) | `lineage`, `data_entity` (JOIN) | SELECT DISTINCT (parent, child) from lineage JOIN data_entity on directional equality where data_entity.id IN (?) | N/A (read) | N/A | Empty-list short-circuit at line 137 prevents an empty `IN ()` clause. The JOIN is the only place this repository reads `data_entity`. |
| lineageCte (private; lines 150-176) | `lineage` | CTE-internal — UNION ALL of seed + recursive step | N/A | N/A | The seed at lines 163-167 selects ALL lineage columns + a synthetic `val(1) AS depth`. The recursive step at lines 169-174 increments depth and joins the CTE to lineage on the direction-appropriate field equality. There is no `LIMIT` inside the CTE, no DISTINCT inside the recursion, no `path` array or `cycle` clause (Postgres's optional `WITH ... CYCLE` clause is not used). |

## tests_coverage_semantic

- covered_behaviours: [
    "batchDeleteByEstablisherOddrnTest — LineageRepositoryTest.java:47-64 — asserts delete-by-establisher selects exactly the two specified establishers and leaves the third intact; verifies the RETURNING semantics (test_class: integration)",
    "batchInsertLineagesTest — LineageRepositoryTest.java:66-81 — asserts ON CONFLICT DO NOTHING semantics: pre-inserted `duplicatedPojo` is silently skipped on the second batch insert; verifies the RETURNING semantics by `usingRecursiveComparison().ignoringFields(\"isDeleted\")` (test_class: integration)",
    "getTargetsCountTest — LineageRepositoryTest.java:83-109 — asserts the count of distinct downstream edges keyed by parent_oddrn (test_class: integration)",
    "getLineageRelationsTest_WithOddrns — LineageRepositoryTest.java:111-128 — asserts the BOTH-endpoints-in-list filter for getLineageRelations(List) (test_class: integration)",
    "getLineageRelationsTest_WithRoots — LineageRepositoryTest.java:130-281 — asserts the recursive-CTE traversal across DEPTH=1/2/3 in BOTH directions on a hand-built 7-edge tree (2 roots, 7 nested children + 1 unrelated edge); verifies that DOWNSTREAM seed-set returns only downstream edges, UPSTREAM seed-set on a leaf returns only upstream edges, and depth=1 from a root returns ONLY the direct children (test_class: integration)",
    "getChildrenCountTest — LineageRepositoryTest.java:283-297 — asserts count-distinct child_oddrn grouped by parent (test_class: integration)",
    "getParentCountTest — LineageRepositoryTest.java:299-311 — asserts count-distinct parent_oddrn grouped by child (test_class: integration)"
  ]
- uncovered_behaviours: [
    "softDeleteLineageRelations — no test asserts that edges touching the oddrn list on EITHER end are flagged, that re-running is idempotent, or that non-touching edges are untouched (test_class: integration)",
    "restoreLineageRelations — no test asserts the reverse of softDelete (test_class: integration)",
    "Soft-delete filter coverage in reads — no test exercises a row with `is_deleted=true` and asserts it is excluded from getTargetsCount / getChildrenCount / getParentCount / getLineageRelations / getLineageRelationsForDepthOne / the recursive CTE seed AND recursive step (test_class: integration)",
    "Recursive-CTE termination on a CYCLIC graph — `getLineageRelationsTest_WithRoots` is built on a tree (no cycles); a test with a cycle (e.g. A→B→A) at depth=5 would verify the recursion terminates at the depth bound, not via a visited-set guard, and would document the intermediate-row-count growth pattern referenced in REFACTOR-202 (test_class: integration)",
    "Recursive-CTE termination on a DIAMOND DAG — a test with B→D and C→D both reachable from A at depth=3 would verify the intermediate rows ARE materialised inside the CTE before the outer selectDistinct dedupes (the REFACTOR-202 amplification surface) (test_class: integration)",
    "Empty depth handling — no test calls `getLineageRelations(set, LineageDepth.empty(), kind)` and asserts the seed-only result (this is the DataEntityRelationsServiceImpl call site; the behaviour is structurally untested at the repository layer) (test_class: integration)",
    "Negative depth — no test exercises `LineageDepth.of(0)` or negative values (the controller layer enforces `@Min(1)` per the openapi spec, but the repository accepts any int including negative; a defensive contract test would document this) (test_class: integration)",
    "Very-large depth — no test exercises `LineageDepth.of(10_000)` against any non-trivial graph; no assertion about CTE row-count growth or Postgres work_mem (test_class: load / integration)",
    "getLineageRelationsForDepthOne with empty rootIds — branch is short-circuited at line 137 but no test asserts the Flux.empty() outcome (test_class: integration)",
    "getLineageRelationsForDepthOne with large rootIds — no test exercises `rootIds.size() > 30_000` or similar to surface the Postgres parameter-limit boundary (test_class: integration)",
    "batchInsertLineages with `LineagePojo` carrying `is_deleted=true` from EasyRandom — the existing test uses `.ignoringFields(\"isDeleted\")` (line 76, 79) which suggests insert resets isDeleted to default-false; no explicit assertion verifies this is intended behaviour (test_class: integration)",
    "Concurrency — no test asserts that softDelete + restore in concurrent transactions produces a deterministic ordering, or that batchDelete+batchInsert under `@ReactiveTransactional` rolls back on partial failure (test_class: integration)"
  ]
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/LineageRepositoryTest.java:1-326 — integration tests (extends BaseIntegrationTest at line 29; Testcontainers-Postgres harness)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/LineageServiceTest.java:123-174 — unit test for the service layer; mocks `lineageRepository.getLineageRelations(any(), any(), any())` and asserts the response shape (test_class: unit)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceTest.java — Grep confirms the file imports/references ReactiveLineageRepository but `Grep getLineageRelations|softDeleteLineage|...` returned no hits in this file in the current revision; the dependency is wired (mocked) but no test directly exercises a repository call path"
  ]
- gaps: |
    The integration-test surface for the recursive-CTE traversal is solid for happy-path tree shapes (LineageRepositoryTest.java:130-281), but the three failure modes that REFACTOR-202 / REFACTOR-203 / REFACTOR-185 surfaced have ZERO coverage at the repository layer: (1) cyclic graphs, (2) diamond DAGs, (3) very-large depth values. The downstream-of-getMyObjectsWith{Upstream,Downstream} call site (DataEntityRelationsServiceImpl.java:34 — the batch-G anchor-set pattern) passes `LineageDepth.empty()` (depth=-1) which terminates the recursion after the seed step — but no test at the repository layer documents that this specific input produces seed-only output. A regression that changed `tDepth.lessThan(...)` to `tDepth.lessThanOrEqual(...)` (an off-by-one fix attempt) would silently extend the recursion for `LineageDepth.empty()` callers from depth-1 to depth-0 (no rows) but for `LineageDepth.of(N)` callers from N-1 hops to N hops — different behavioural change per call site. The test_class for every gap above is `integration` because LineageRepositoryTest already uses the Testcontainers harness and adding cases is straightforward; the cycle / diamond / load tests are the ones that materially close the substrate-named gaps.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file (ReactiveLineageRepositoryImpl.java:1-177)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "Operator-facing feature page for the F-005 lineage feature this repository backs"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "network-error — WebFetch permission denied in this session; live verification deferred to the next available WebFetch-enabled run"
    confidence: LOW
    fetched_excerpts: |
      Indirect verification: the batch-F `getDataEntityDownstreamLineage` sidecar (lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md) records a successful WebFetch of this URL on 2026-05-12 at status 200, with the fetched excerpt "data-object lineage: catalog entities and connections" and a cross-link to /developer-guides/api-reference/lineage. No mention of depth caps, cycle handling, owner-scoping, or soft-delete behaviour on the operator page.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage"
    anchor: ""
    rationale: "API-reference page for the lineage endpoints whose read path traverses this repository"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "network-error — WebFetch permission denied in this session"
    confidence: LOW
    fetched_excerpts: |
      Indirect verification via batch-F sidecar (same file as above), verified 2026-05-12 status 200: lineage_depth is documented as "Number of hops to traverse from the rooted entity. Unset returns the platform's default depth." — the repository implementation confirms there is NO server-side default; the depth is passed as a primitive int into `lineageCte` (line 174). expanded_entity_ids is documented as "IDs of Data Entity Group entities" — but the repository accepts ANY data_entity IDs (line 145: `DATA_ENTITY.ID.in(rootIds)` with no entity-class filter), confirming the doc-drift recorded in the batch-F sidecar.
- doc_drift_findings:
  - "Doc-drift inherited from batch-F: live API-reference page claims `lineage_depth` 'Unset returns the platform's default depth' — the recursive-CTE repository confirms NO default exists (the depth value flows directly into `lineageCte` from a caller-supplied `LineageDepth` wrapper; LineageServiceImpl.java:96 builds `LineageDepth.of(lineageDepth)` from the controller's `Integer lineageDepth`, where null triggers an NPE on autoboxing at LineageService.java:12 BEFORE this repository is reached). Severity: MEDIUM (the drift is at the controller-method layer; the repository is a downstream confirmation site)."
  - "Operator-facing feature page silent on depth caps, cycle handling, owner-scoping, and soft-delete behaviour — the repository code embodies all four properties (no cap at line 174; no cycle guard at lines 168-174; no owner JOIN anywhere; soft-delete filter at lines 65, 76, 86, 115, 145, 167, 174). Severity: LOW (this is a coverage gap; the operator-facing page leaves the operator to discover load/security limits empirically)."

## implicit_adrs

- "Soft-delete is the canonical deletion mechanism for lineage edges — every read filters `is_deleted = false` and the only hard-delete path is the ingestion rewrite-by-establisher (batchDeleteByEstablisherOddrn). The schema enforces this at V0_0_79__data_deprecation.sql:11-12 (`NOT NULL DEFAULT FALSE`) and every read filter explicitly references the column at ReactiveLineageRepositoryImpl.java:65, 76, 86, 115, 145, 167, 174." — evidence: ReactiveLineageRepositoryImpl.java:65, 76, 86, 92-99, 102-109, 115, 145, 167, 174 + V0_0_79__data_deprecation.sql:11-12 — intent_anchor: `softDeleteLineageRelations` + `restoreLineageRelations` as paired symmetric methods (lines 91-109) and the consistent `IS_DELETED.isFalse()` filter on every read — confidence: HIGH

- "Ingestion atomicity via paired `batchDeleteByEstablisherOddrn` + `batchInsertLineages` under caller's `@ReactiveTransactional` — the repository deliberately exposes the delete-by-establisher and insert primitives as separate methods rather than a single `replaceLineagesByEstablisher(...)` so the caller (LineageServiceImpl.replaceLineagePaths at LineageServiceImpl.java:124-133) can compose them inside ONE transactional boundary. The `@ReactiveTransactional` lives on the SERVICE method, not on either repository method." — evidence: ReactiveLineageRepositoryImpl.java:42-47 + 49-58 + LineageServiceImpl.java:124-133 — intent_anchor: `@ReactiveTransactional public Flux<LineagePojo> replaceLineagePaths(...) { return lineageRepository.batchDeleteByEstablisherOddrn(establishers).thenMany(lineageRepository.batchInsertLineages(pojos)); }` — confidence: HIGH

- "Single-query recursive-CTE traversal — lineage is walked via Postgres `WITH RECURSIVE` (one DB round-trip), NOT BFS with one round-trip per node. The CTE is hand-written at `lineageCte(...)` (lines 150-176) and the depth-1 progressive-expansion fan-out is a SEPARATE query merged downstream by LineageServiceImpl.java:98-100. The split signals an intentional 'recursive walk for the main subgraph + one-hop expansion for UI clicks' protocol." — evidence: ReactiveLineageRepositoryImpl.java:122-148 + 150-176 + LineageServiceImpl.java:95-100 — intent_anchor: `final var cte = lineageCte(rootOddrns, depth, streamKind); final var query = DSL.withRecursive(cte).selectDistinct(cte.field(LINEAGE.PARENT_ODDRN), cte.field(LINEAGE.CHILD_ODDRN)).from(cte.getName());` (lines 125-128) — confidence: HIGH

- "Idempotent batch insert via `onDuplicateKeyIgnore` against the (parent, child, establisher) primary key — the contract is 'insert these edges; existing rows are unchanged; duplicates are silently skipped'. This is what enables the ingestion rewrite-by-establisher flow to operate without read-before-write logic. The PK was added at V0_0_17__add_establisher_into_lineage.sql:116-117 explicitly to support this." — evidence: ReactiveLineageRepositoryImpl.java:57 (`.onDuplicateKeyIgnore().returning()`) + V0_0_17__add_establisher_into_lineage.sql:116-117 — intent_anchor: `step.onDuplicateKeyIgnore().returning()` + the PK migration ADD PRIMARY KEY (parent_oddrn, child_oddrn, establisher_oddrn) — confidence: HIGH

- "Establisher-keyed edge provenance — each lineage edge carries the oddrn of the entity that DECLARED it (`establisher_oddrn`). This is the model element that enables 'when entity X re-publishes its lineage, rewrite ONLY the edges X declared, leaving edges declared by Y untouched' — the property that makes ingestion non-destructive across producers." — evidence: V0_0_17__add_establisher_into_lineage.sql:1-2 (ADD COLUMN) + 116-117 (PK) + 119 (`CREATE INDEX lineage_establisher_oddrn ON lineage (establisher_oddrn)`) + ReactiveLineageRepositoryImpl.java:43-47 (batchDeleteByEstablisherOddrn) — intent_anchor: `CREATE INDEX lineage_establisher_oddrn ON lineage (establisher_oddrn)` (V0_0_17:119) — confidence: HIGH

## bugs_limitations_corner_cases

- "No cycle-detection inside the recursive CTE: the CTE body is `UNION ALL` (line 168) without a visited-set guard or Postgres `WITH ... CYCLE` clause; the only termination is `tDepth.lessThan(lineageDepth.getDepth())` (line 174). For a lineage graph with a cycle (e.g. a transformer that consumes its own downstream artefact), row-count growth before depth-termination is unbounded by graph structure and limited only by the depth ceiling — which itself has no repository-layer upper bound. The outer `selectDistinct` (line 127) deduplicates the FINAL result but does NOT prune the CTE's intermediate work. This is the REFACTOR-202 amplification surface confirmed at the SQL layer." — evidence: ReactiveLineageRepositoryImpl.java:163-175 (seed + UNION ALL recursive step + tDepth.lessThan termination) + 126-128 (outer selectDistinct over the CTE result) — severity: HIGH

- "Diamond-DAG cost amplification: outer `selectDistinct` over the CTE deduplicates `(parent_oddrn, child_oddrn)` pairs but the recursive body materialises every distinct path from root. For a depth-N diamond pattern with branching factor B, the intermediate row count grows as O(B^N) before the outer projection prunes duplicates. This is documented as REFACTOR-202 at the controller-method layer; the repository code confirms the SQL shape that produces it." — evidence: ReactiveLineageRepositoryImpl.java:126-131 (outer selectDistinct only) + 163-175 (UNION ALL with no inner DISTINCT) — severity: MEDIUM

- "No JOIN-side owner filter in the recursive CTE: the `lineage` table itself carries no owner column (schema migrations V0_0_2 + V0_0_17 + V0_0_79 confirm), and the CTE seed + recursive step filter ONLY on `is_deleted` (lines 167, 174). When the repository is invoked from `DataEntityRelationsServiceImpl.getDependentOddrns` (line 34, the `getMyObjectsWith{Upstream,Downstream}` flow), owner-scoping relies on the CALLER having pre-filtered the seed oddrn set via `authIdentityProvider.fetchAssociatedOwner()` (DataEntityRelationsServiceImpl.java:26) — the batch-G anchor-set defence-in-depth pattern. The recursive expansion that follows is NOT owner-scoped: any edges reachable from the anchor set are returned, including edges into entities owned by other teams. This is REFACTOR-203 cross-owner lineage enumeration confirmed at the repository layer." — evidence: ReactiveLineageRepositoryImpl.java:163-175 (no owner JOIN, only is_deleted filter) + V0_0_2__add_lineage.sql:1-7 (no owner column) + DataEntityRelationsServiceImpl.java:25-39 (caller anchor-set computation) — severity: HIGH

- "No upper bound on `lineageDepth.getDepth()` at the repository layer — the value is consumed directly at line 174 (`tDepth.lessThan(lineageDepth.getDepth())`) with no defensive `Math.min(...)` or boundary check. A caller (legitimate or malicious — for an authenticated caller under the controller's `.authenticated()` gate, or any caller under DISABLED mode per the batch-F security findings) can pass `LineageDepth.of(Integer.MAX_VALUE)` and the CTE will recurse until either (a) the graph is exhausted or (b) Postgres rejects the query for exceeding `work_mem` / `statement_timeout` / a stack-depth limit." — evidence: ReactiveLineageRepositoryImpl.java:174 (no Math.min / no defensive check) + LineageDepth.java:12-14 (`of(int)` accepts any int) — severity: HIGH

- "Empty-input behaviour asymmetry: `getLineageRelationsForDepthOne` short-circuits an empty `rootIds` to `Flux.empty()` (line 137), but the overloaded `getLineageRelations(Set, LineageDepth, LineageStreamKind)` does NOT short-circuit an empty `rootOddrns` set — it builds a CTE with `LINEAGE.PARENT_ODDRN.in(<empty>)` (line 167) which Postgres reduces to `FALSE`, returning an empty result correctly but after a network round-trip. The cost is non-zero but the asymmetry itself signals that the empty-input contract was considered at one call site and not the other; an audit-style consistency pass is warranted." — evidence: ReactiveLineageRepositoryImpl.java:134-148 (short-circuit at 136-138) vs 122-131 (no short-circuit; passes through to CTE construction) — severity: LOW

- "Soft-delete on EITHER end uses an OR predicate (lines 95, 105) that has no covering index — V0_0_79__data_deprecation.sql:11-12 adds `is_deleted` but no index on `(child_oddrn)` for the WHERE clause (the PK starts with parent_oddrn). For a soft-delete cascade involving many entity oddrns, the `LINEAGE.CHILD_ODDRN.in(dataEntityOddrns).or(LINEAGE.PARENT_ODDRN.in(dataEntityOddrns))` may degrade to a sequential scan in Postgres if the planner cannot use both legs of the OR efficiently. The `lineage_establisher_oddrn` index (V0_0_17__:119) does not help this query." — evidence: ReactiveLineageRepositoryImpl.java:95 + V0_0_2__add_lineage.sql:6 (PK starts with parent_oddrn) + V0_0_17__add_establisher_into_lineage.sql:116-117 (PK rotation) + 119 (only establisher index) + V0_0_79__data_deprecation.sql:11-12 (no new indexes added for is_deleted) — severity: MEDIUM

- "`getLineageRelations(List<String>)` (the DEG-internal-edges read at lines 112-119) builds an OR-clause where both legs are LOGICALLY EQUIVALENT: `(PARENT in oddrns AND CHILD in oddrns) OR (CHILD in oddrns AND PARENT in oddrns)` — the two conjuncts are identical under commutativity. jOOQ generates the redundant SQL; Postgres's planner will collapse it but the source code is misleading and any future maintainer rewriting the predicate will not realise the OR is decorative. The intent was likely 'edges where AT LEAST ONE endpoint is in the list' (an inclusive read for DEG-internal lineage), but the code implements 'edges where BOTH endpoints are in the list'. The existing test `getLineageRelationsTest_WithOddrns` (LineageRepositoryTest.java:111-128) inserts a SINGLE edge with both endpoints in the queried list, so it does NOT distinguish the two semantics." — evidence: ReactiveLineageRepositoryImpl.java:113-117 (boolean expression) + LineageRepositoryTest.java:111-128 (test does not exercise the asymmetric case) — severity: MEDIUM

- "LineageDepth.empty() semantics are call-site folklore: when DataEntityRelationsServiceImpl.java:34 passes `LineageDepth.empty()` (value=-1, empty=true), the CTE's recursive step `tDepth.lessThan(-1)` is FALSE on the first iteration so recursion terminates with seed-only output. The `boolean empty` flag is NEVER consulted inside `lineageCte` (lines 150-176) — only the depth integer is read. The class therefore has two paths to 'terminate immediately': `LineageDepth.empty()` (via the -1 value) and `LineageDepth.of(0)` (also `tDepth.lessThan(0)` = FALSE on iteration 1). The name `empty()` suggests 'no traversal at all' but the actual behaviour is 'seed-only' (i.e. the direct edges touching the root oddrn set, which IS non-empty if those edges exist). A caller reading the code at DataEntityRelationsServiceImpl.java:34 would have to trace through `lineageCte` to understand that `empty()` means 'one-hop seed-only', not 'zero edges returned'." — evidence: LineageDepth.java:16-18 + ReactiveLineageRepositoryImpl.java:151-176 (no read of `empty` flag) + DataEntityRelationsServiceImpl.java:34 (the one production caller of `LineageDepth.empty()`) — severity: MEDIUM

- "No `@ReactiveTransactional` on this repository's mutation methods (batchDeleteByEstablisherOddrn / batchInsertLineages / softDeleteLineageRelations / restoreLineageRelations) — atomicity is delegated to the caller. This is the standard repository contract in odd-platform (per the existing `@ReactiveTransactional` placement at LineageServiceImpl.java:125 and DataEntityInternalStateServiceImpl.java:101), but a caller who invokes batchDeleteByEstablisherOddrn directly WITHOUT a transactional scope (e.g. a one-off script or a future controller endpoint) would observe a non-atomic delete with no rollback on partial failure. There is no defensive check or warning in the repository signature; a future maintainer needs to grep call sites to confirm transactional context." — evidence: ReactiveLineageRepositoryImpl.java:37-39 (no class-level annotation) + 42-58 (no per-method @ReactiveTransactional) vs LineageServiceImpl.java:124-133 (service-layer @ReactiveTransactional wrapping the pair) — severity: LOW

## security

- auth_mode_relevance: INTERNAL_ONLY — this is a Spring `@Repository` bean (line 37) consumed only by service-layer code; it is not directly on the HTTP surface. Authentication mode shapes the upstream-caller behaviour (the controller methods that flow into LineageServiceImpl) but does not gate this repository directly. The downstream cross-owner enumeration risk is INHERITED from the caller: under DISABLED mode the upstream controller is unauthenticated, so the recursive-CTE traversal can be driven by any network probe (REFACTOR-185 inheritance).
- ingestion_filter_relevance: N/A — repository, not HTTP. The `IngestionDataEntitiesFilter` operates on `POST /ingestion/entities`, well upstream of this repository.
- authorization_assertions: [] — N/A: the repository carries no `@PreAuthorize`, no programmatic permission check, no `@Secured` annotation. Authorization is the upstream service / controller's responsibility.
- owner_scoping: BYPASSES — the recursive CTE has no owner JOIN; the only filter is `is_deleted = false` (lines 167, 174). When invoked from `DataEntityRelationsServiceImpl.getDependentOddrns` (line 34 — the batch-G anchor-set pattern), the CALLER applies owner-scoping at the anchor set (line 26: `authIdentityProvider.fetchAssociatedOwner()`), and the repository expands the reachable subgraph WITHOUT further owner filtering. When invoked from `LineageServiceImpl.getLineage` (lines 95-99 — the lineage-canvas read path), no owner-scoping is applied at any layer. The repository is the **graph-shaped cross-owner enumeration sink** — its SQL embodies the property that REFACTOR-203 names. — evidence: ReactiveLineageRepositoryImpl.java:122-176 (no owner column, no JOIN, no owner predicate) + V0_0_2__add_lineage.sql:1-7 (schema has no owner column) + DataEntityRelationsServiceImpl.java:25-39 (caller-side anchor-set computation)
- data_exposure: [
    "Full lineage edge set (parent_oddrn, child_oddrn, establisher_oddrn, is_deleted) for any oddrn reachable from a caller-supplied root set within `lineageDepth` hops in EITHER direction → returned to whichever service-layer caller invoked this repository. The repository itself does not serialise to HTTP; the controller-method sidecar (`getDataEntityDownstreamLineage.md`) covers HTTP-layer exposure. The repository's exposure is to the service layer that may or may not apply owner-scoping (see owner_scoping above).",
    "Cross-owner pipeline structure leakage via lineage edges — even if individual entity-detail reads are owner-restricted at some future layer, lineage edges encode causal connections between entities. Knowing that entity X (owned by team A) has a downstream child Y (owned by team B) leaks the EXISTENCE of team B's pipeline structure even if team B's entities are not separately enumerable."
  ]
- known_security_gaps: [
    "No JOIN-side owner filter on the recursive CTE — confirms REFACTOR-203 at the SQL layer. The repository cannot defend against cross-owner enumeration; the only defence point is the caller's anchor-set selection (DataEntityRelationsServiceImpl.java:26) which is NOT applied for the lineage-canvas read path (LineageServiceImpl.java:95-99). — evidence: ReactiveLineageRepositoryImpl.java:122-176 + DataEntityRelationsServiceImpl.java:25-39 (positive case) vs LineageServiceImpl.java:87-122 (negative case) — severity: HIGH",
    "No depth ceiling at the repository — `lineageDepth.getDepth()` flows directly into `tDepth.lessThan(...)` (line 174); a caller can pass `Integer.MAX_VALUE`. Combined with no cycle guard, this is a DoS-amplification vector inherited from REFACTOR-202. — evidence: ReactiveLineageRepositoryImpl.java:174 + 163-175 (no LIMIT, no cycle guard) — severity: HIGH",
    "No `statement_timeout` enforcement at this repository — the jOOQ reactive operations (`JooqReactiveOperations.flux` at JooqReactiveOperations.java:44-49) do not set a per-statement timeout; long-running CTE queries depend on Postgres's session-level `statement_timeout` (set externally, if at all) or the R2DBC client's request timeout (not configured here). — evidence: ReactiveLineageRepositoryImpl.java:129 (`jooqReactiveOperations.flux(query)`) + JooqReactiveOperations.java:44-49 (no timeout configuration) — severity: MEDIUM"
  ]

## performance

- hot_paths: [
    "Recursive-CTE traversal — `getLineageRelations(Set, LineageDepth, LineageStreamKind)` at lines 122-131 is the per-request hot path for every lineage-canvas open in the UI (DataEntityController.getDataEntityDownstreamLineage / getDataEntityUpstreamLineage); the SQL cost grows multiplicatively with depth × branching-factor",
    "`getLineageRelationsForDepthOne` at lines 134-148 is the per-click hot path for every progressive UI expansion — a separate query merged into the canvas response by LineageServiceImpl.java:98-100",
    "`getChildrenCount` + `getParentCount` (lines 72-89) — invoked once per lineage-canvas open over the full result-set oddrn list (LineageServiceImpl.java:113-114) to compute fan-out badges on each node; the cost scales with the size of the response oddrn set",
    "`getTargetsCount` (lines 61-69) — invoked from DataEntityServiceImpl.java:665 to compute the dataset-children badge on every dataset detail render",
    "`batchInsertLineages` + `batchDeleteByEstablisherOddrn` (lines 50-58, 43-47) — invoked on every ingestion of an entity whose lineage edges changed; in a high-throughput ingestion pipeline this is the highest-write hot path on this repository"
  ]
- throughput_characteristics: [
    "Single SQL statement per public method — no per-row round-trip. The recursive CTE walks N hops in ONE round-trip; the depth-1 fan-out is ONE round-trip; the counts are ONE round-trip each.",
    "Batch insert uses jOOQ's multi-row VALUES with `onDuplicateKeyIgnore` — a single INSERT statement regardless of pojo count. (No explicit JDBC batching; Postgres handles the multi-row VALUES natively.)",
    "Reactive Flux signature on every method — non-blocking, but the JooqReactiveOperations layer establishes ONE connection per call via `databaseClient.inConnectionMany(...)` (JooqReactiveOperations.java:45-48); no connection-pool tuning visible at this layer."
  ]
- resource_allocation: [
    "Postgres `work_mem`: the recursive CTE materialises intermediate rows in work_mem; row count grows up to the product of branching-factor × `lineage_depth`; for diamond DAGs the deduplication happens AFTER recursion at the outer `selectDistinct` (lines 126-131) — intermediate rows ARE materialised before pruning.",
    "JVM heap: the repository methods return Flux<LineagePojo> — non-collecting. The caller's `.collectList()` (LineageServiceImpl.java:102) is where the heap pressure manifests; the repository itself does not materialise the full result.",
    "Network: each LineagePojo carries up to 3 string columns (parent/child/establisher oddrns, each varchar with no length cap post-V0_0_26__remove_length_constraints.sql:39) + a boolean — modest per-row, but a 100K-edge response is ~10MB on the wire.",
    "Postgres parameter slots: `LINEAGE.CHILD_ODDRN.in(dataEntityOddrns).or(LINEAGE.PARENT_ODDRN.in(dataEntityOddrns))` (line 95) uses 2× the list size in parameters; soft-delete cascades for >16K entities risk Postgres's 32K-parameter limit. Similar in `getLineageRelationsForDepthOne` (line 145) which uses `rootIds.size()` parameters."
  ]
- scaling_characteristics: [
    "Stateless repository — scales horizontally with API instances; the bottleneck is Postgres.",
    "No caching at this layer — every call re-runs the SQL; identical repeated lineage-canvas reads pay the full DB cost. A `@Cacheable` keyed on `(rootOddrns, depth, streamKind)` would absorb most UI-canvas re-opens (the lineage table changes only on ingestion).",
    "No statement_timeout / cancel hook — a slow CTE query holds the R2DBC connection until completion or Postgres cancels it (depends on session-level `statement_timeout` set externally).",
    "Soft-delete reads pay an `is_deleted = false` filter cost on every query — Postgres can use a partial index but none is declared (V0_0_79__data_deprecation.sql:11-12 adds the column with NO covering index); for a lineage table with a large soft-deleted tail this is sequential-scan-shaped."
  ]
- known_performance_gaps: [
    "No upper bound on recursive-CTE depth at the repository — a caller passes `lineageDepth.getDepth()` directly into the SQL; the cost of a depth-10000 recursion against a dense graph is bounded only by Postgres's resource limits. — evidence: ReactiveLineageRepositoryImpl.java:174 + 122-131 — severity: HIGH",
    "No cycle-detection inside the recursive step — diamond DAGs and true cycles inflate intermediate row counts inside the CTE before the outer selectDistinct prunes; for a depth-N cycle the cost grows linearly in N rather than terminating early. — evidence: ReactiveLineageRepositoryImpl.java:163-175 (UNION ALL with no DISTINCT in recursion, no Postgres `WITH ... CYCLE` clause) — severity: MEDIUM",
    "No covering index for the soft-delete filter — `is_deleted = false` is a query that benefits from a partial index `(parent_oddrn, child_oddrn) WHERE is_deleted = false`; none is declared in any migration. For a large soft-deleted tail the planner falls back to full-table scans on read. — evidence: V0_0_79__data_deprecation.sql:11-12 (no index added) + V0_0_17__add_establisher_into_lineage.sql:119 (only establisher_oddrn index) — severity: MEDIUM",
    "No covering index for the soft-delete OR predicate on either-endpoint — `LINEAGE.CHILD_ODDRN.in(...).or(LINEAGE.PARENT_ODDRN.in(...))` cannot use the (parent, child, establisher) PK efficiently for the CHILD_ODDRN leg; a separate index on `(child_oddrn, is_deleted)` would help. — evidence: ReactiveLineageRepositoryImpl.java:95, 105 + V0_0_17__add_establisher_into_lineage.sql:117 — severity: MEDIUM",
    "No caching layer for the recursive-CTE read path — a short-TTL cache keyed on `(rootOddrns, depth, streamKind)` would absorb UI-canvas re-opens that issue the same query within seconds. — evidence: ReactiveLineageRepositoryImpl.java:122-131 (no `@Cacheable`, no cache lookup in any caller along the chain) — severity: LOW",
    "Misleading OR-predicate in `getLineageRelations(List<String>)` — the two conjuncts at lines 116-117 are logically equivalent; Postgres collapses them but the source code suggests a different (broader) semantic than is actually executed. A future maintainer rewriting the predicate to 'edges where AT LEAST ONE endpoint is in the list' would change the read semantics for DEG-internal-lineage assembly. — evidence: ReactiveLineageRepositoryImpl.java:113-117 — severity: LOW"
  ]

## sources

- understanding ← ReactiveLineageRepositoryImpl.java:1-177 + V0_0_2__add_lineage.sql:1-7 + V0_0_17__add_establisher_into_lineage.sql:1-119 + V0_0_79__data_deprecation.sql:11-12 + LineageDepth.java:1-19 + LineageStreamKind.java:1-6
- concepts.entities ← ReactiveLineageRepositoryImpl.java:20, 35 + LineageDepth.java:1-19 + LineageStreamKind.java:1-6 + V0_0_2/V0_0_17/V0_0_79 schema
- concepts.operations ← ReactiveLineageRepositoryImpl.java:42-148 (each public method) + 150-176 (private CTE assembly)
- concepts.invariants ← ReactiveLineageRepositoryImpl.java:65, 76, 86, 92-99, 102-109, 115, 145, 167, 174 + V0_0_2__add_lineage.sql:1-7 + V0_0_17__add_establisher_into_lineage.sql:1-2, 116-117 + V0_0_79__data_deprecation.sql:11-12 + LineageDepth.java:16-18 + LineageServiceImpl.java:96 + DataEntityRelationsServiceImpl.java:34 + LineageServiceImpl.java:124-133
- dependencies_semantic.requires-feature ← Indirect verification via batch-F sidecar (`odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md` lines 86-105) which recorded successful WebFetches at 2026-05-12 status 200 for both `https://docs.opendatadiscovery.org/features/data-lineage` and `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage`
- dependencies_semantic.requires-runtime ← ReactiveLineageRepositoryImpl.java:37-40, 46, 67, 78, 88, 97, 107, 118, 129, 146 + JooqReactiveOperations.java:28, 44-49
- dependencies_semantic.couples-to ← Migration files (V0_0_2, V0_0_17, V0_0_26, V0_0_79) + ReactiveLineageRepositoryImpl.java:144 (data_entity JOIN) + LineageRepositoryTest.java:74-79 (LineagePojo isDeleted ignored)
- upstream_callers.* ← Grep `lineageRepository.|reactiveLineageRepository.` across odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service + per-line reads of each caller
- downstream_side_effects.* ← ReactiveLineageRepositoryImpl.java:42-176 (each method body)
- tests_coverage_semantic.covered_behaviours ← LineageRepositoryTest.java:47-326 (each @Test method)
- tests_coverage_semantic.uncovered_behaviours ← LineageRepositoryTest.java:47-326 (absence inspection) + LineageServiceTest.java:123-174 (mocked-repository unit test does not exercise the SQL itself)
- tests_coverage_semantic.test_files ← LineageRepositoryTest.java:1-326 + LineageServiceTest.java:1-175 + Grep on DataEntityServiceTest.java
- docs_link_semantic.inferred_docs ← Inherited from batch-F sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md:80-106`. Live WebFetch attempts in this session at 2026-05-19 were denied by the session's tool permissions; status recorded as `network-error` per Rule 1 (live-only). The batch-F WebFetch results (2026-05-12 status 200) serve as the most-recent known-good verification.
- docs_link_semantic.doc_drift_findings.[0] ← Confirmed via ReactiveLineageRepositoryImpl.java:174 (depth used directly, no default) + LineageDepth.java:12-14 (`of(int)`) + LineageServiceImpl.java:96 + LineageService interface signature (primitive `int`) + batch-F sidecar's WebFetch excerpt
- docs_link_semantic.doc_drift_findings.[1] ← ReactiveLineageRepositoryImpl.java:163-175 (no cap, no cycle guard, no owner JOIN) + 92-109 (soft-delete pair) + batch-F sidecar's WebFetch excerpt
- implicit_adrs.[0] ← ReactiveLineageRepositoryImpl.java:65, 76, 86, 92-109, 115, 145, 167, 174 + V0_0_79__data_deprecation.sql:11-12
- implicit_adrs.[1] ← ReactiveLineageRepositoryImpl.java:42-58 + LineageServiceImpl.java:124-133
- implicit_adrs.[2] ← ReactiveLineageRepositoryImpl.java:122-176 + LineageServiceImpl.java:95-100
- implicit_adrs.[3] ← ReactiveLineageRepositoryImpl.java:57 + V0_0_17__add_establisher_into_lineage.sql:116-117
- implicit_adrs.[4] ← V0_0_17__add_establisher_into_lineage.sql:1-2, 116-119 + ReactiveLineageRepositoryImpl.java:43-47
- bugs_limitations_corner_cases.[0] ← ReactiveLineageRepositoryImpl.java:163-175, 126-128
- bugs_limitations_corner_cases.[1] ← ReactiveLineageRepositoryImpl.java:126-131, 163-175
- bugs_limitations_corner_cases.[2] ← ReactiveLineageRepositoryImpl.java:163-175 + V0_0_2__add_lineage.sql:1-7 + DataEntityRelationsServiceImpl.java:25-39
- bugs_limitations_corner_cases.[3] ← ReactiveLineageRepositoryImpl.java:174 + LineageDepth.java:12-14
- bugs_limitations_corner_cases.[4] ← ReactiveLineageRepositoryImpl.java:134-148 (short-circuit at 136-138) vs 122-131
- bugs_limitations_corner_cases.[5] ← ReactiveLineageRepositoryImpl.java:95, 105 + V0_0_17__add_establisher_into_lineage.sql:117, 119 + V0_0_79__data_deprecation.sql:11-12
- bugs_limitations_corner_cases.[6] ← ReactiveLineageRepositoryImpl.java:113-117 + LineageRepositoryTest.java:111-128
- bugs_limitations_corner_cases.[7] ← LineageDepth.java:16-18 + ReactiveLineageRepositoryImpl.java:151-176 + DataEntityRelationsServiceImpl.java:34
- bugs_limitations_corner_cases.[8] ← ReactiveLineageRepositoryImpl.java:37-39, 42-58 + LineageServiceImpl.java:124-133 + DataEntityInternalStateServiceImpl.java:101-104
- security.auth_mode_relevance ← ReactiveLineageRepositoryImpl.java:37 (Spring @Repository; not on HTTP surface) + upstream caller inheritance (batch-F sidecar)
- security.owner_scoping ← ReactiveLineageRepositoryImpl.java:122-176 + V0_0_2__add_lineage.sql:1-7 + DataEntityRelationsServiceImpl.java:25-39 + LineageServiceImpl.java:87-122
- security.known_security_gaps.[0] ← ReactiveLineageRepositoryImpl.java:122-176 + DataEntityRelationsServiceImpl.java:25-39 + LineageServiceImpl.java:87-122
- security.known_security_gaps.[1] ← ReactiveLineageRepositoryImpl.java:174, 163-175
- security.known_security_gaps.[2] ← ReactiveLineageRepositoryImpl.java:129 + JooqReactiveOperations.java:44-49
- performance.hot_paths ← ReactiveLineageRepositoryImpl.java:122-148, 61-89, 50-58, 43-47 + LineageServiceImpl.java:113-114 + DataEntityServiceImpl.java:665
- performance.throughput_characteristics ← ReactiveLineageRepositoryImpl.java:42-148 (single-statement methods) + JooqReactiveOperations.java:44-49
- performance.resource_allocation ← ReactiveLineageRepositoryImpl.java:122-131, 163-175, 95, 145 + V0_0_26__remove_length_constraints.sql:39
- performance.scaling_characteristics ← ReactiveLineageRepositoryImpl.java:1-177 (no @Cacheable, no timeout) + V0_0_79__data_deprecation.sql:11-12 (no covering index)
- performance.known_performance_gaps.[0] ← ReactiveLineageRepositoryImpl.java:174, 122-131
- performance.known_performance_gaps.[1] ← ReactiveLineageRepositoryImpl.java:163-175
- performance.known_performance_gaps.[2] ← V0_0_79__data_deprecation.sql:11-12 + V0_0_17__add_establisher_into_lineage.sql:119
- performance.known_performance_gaps.[3] ← ReactiveLineageRepositoryImpl.java:95, 105 + V0_0_17__add_establisher_into_lineage.sql:117
- performance.known_performance_gaps.[4] ← ReactiveLineageRepositoryImpl.java:122-131
- performance.known_performance_gaps.[5] ← ReactiveLineageRepositoryImpl.java:113-117

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (live WebFetch was denied this session; verification is indirect via the batch-F sidecar's prior verification at 2026-05-12 status 200; the technical claims about the URLs' content are inherited and re-cited rather than re-verified)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

<!-- Empty on initial enrichment. Preserved verbatim across future refreshes. -->

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py. Reserved for future layer-5 probe runs that touch this node's contributing-features (F-005, F-021). -->
