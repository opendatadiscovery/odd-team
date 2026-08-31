---
node_id: "odd-platform java repository reactive repository:ReactiveLineageRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: f12b8fbc          # substrate manifest last_scan_commit (lineage/odd-platform/manifest.yaml:2)
enriched_at_commit: 077313ad           # odd-platform contrib/CTRIB-062-my-data-filter HEAD (read from the worktree ref)
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-08-31-ctrib062-lineage-repo
---

# ReactiveLineageRepositoryImpl — semantic understanding

## understanding

Reactive jOOQ repository over the Postgres `lineage` table (parent_oddrn ↔ child_oddrn ↔
establisher_oddrn directed-edge rows with an `is_deleted` soft-delete flag;
ReactiveLineageRepositoryImpl.java:1-244). It mediates every read and write of lineage edges — the
ingestion rewrite pair (delete-by-establisher + idempotent batch insert), the soft-delete/restore
cascade, parent/child fan-out counts, the depth-1 progressive-expansion fan-out — and it now hosts
**two structurally different graph traversals**. (1) `lineageCte` (lines 217-243, unchanged by
CTRIB-062) is a hand-written `WITH RECURSIVE ... UNION ALL` over **edges** that backs the lineage
canvas: its only terminator is `t.depth < lineageDepth` (line 241), it carries no visited set, no
owner predicate and no row cap, so its cost grows with PATH count rather than node count.
(2) The CTRIB-062 / #1842 ST-8 pair `getNeighbourOddrnsFromOwnedSet` (lines 164-183) and
`getNeighbourOddrns` (lines 189-205) are single-hop **node** lookups returning an ordered,
`LIMIT`-ed set of neighbour oddrns — the first anchored on the caller's owned set as an inlined
`data_entity JOIN ownership` subquery (lines 175-178, the file's **only** owner-anchored query),
the second on an already budget-bounded frontier — which `MyDataScopeResolverImpl` composes into a
bounded breadth-first walk with an application-side visited set. The DOWNSTREAM (parent→child) /
UPSTREAM (child→parent) convention is centralised in `anchorField` / `neighbourField`
(lines 209-215) precisely so the two traversal shapes cannot disagree (comment at lines 207-208).

## concepts

- entities: [
    "`LineagePojo` (table row: parent_oddrn, child_oddrn, establisher_oddrn, is_deleted; ReactiveLineageRepositoryImpl.java:21 + LineagePojo generated POJO)",
    "`LineageDepth` (DTO wrapping a primitive `int` depth + a boolean `empty` flag; LineageDepth.java:1-19)",
    "`LineageStreamKind` (enum: UPSTREAM | DOWNSTREAM; the single discriminator for both traversal shapes; used at ReactiveLineageRepositoryImpl.java:141-143, 210, 214, 227-228)",
    "`CommonTableExpression<Record>` (jOOQ CTE handle for `WITH RECURSIVE`; ReactiveLineageRepositoryImpl.java:217-243)",
    "`LINEAGE` jOOQ-generated table reference (columns PARENT_ODDRN, CHILD_ODDRN, ESTABLISHER_ODDRN, IS_DELETED; import at ReactiveLineageRepositoryImpl.java:36)",
    "`OWNERSHIP` jOOQ-generated table reference — NEW import at ReactiveLineageRepositoryImpl.java:37; the file's first reference to the ownership model",
    "`DATA_ENTITY` jOOQ-generated table reference — now read at TWO sites: the depth-1 fan-out JOIN (lines 142-146) and the owned-set anchor subquery (lines 175-177)",
    "neighbour oddrn (`Flux<String>`) — the ST-8 traversal's unit of currency; a bare oddrn, NOT a LineagePojo edge (lines 173, 182, 198, 204)"
  ]
- operations: [
    "batchDeleteByEstablisherOddrn — `DELETE FROM lineage WHERE establisher_oddrn IN (...) RETURNING *` (lines 44-49); the ingest-rewrite primitive",
    "batchInsertLineages — multi-row INSERT with `ON CONFLICT DO NOTHING` (jOOQ `onDuplicateKeyIgnore`) into (parent, child, establisher) tuples (lines 51-60)",
    "getTargetsCount — group-by parent_oddrn count of non-deleted edges keyed by parent (lines 62-71)",
    "getChildrenCount — count-distinct child_oddrn grouped by parent_oddrn over non-deleted edges (lines 73-81)",
    "getParentCount — count-distinct parent_oddrn grouped by child_oddrn over non-deleted edges (lines 83-91)",
    "softDeleteLineageRelations — UPDATE is_deleted=true for any edge touching `dataEntityOddrns` on EITHER end (lines 93-101)",
    "restoreLineageRelations — UPDATE is_deleted=false for any edge touching `dataEntityOddrns` on EITHER end (lines 103-111)",
    "getLineageRelations(List<String>) — internal-DEG edges: distinct (parent,child) where BOTH endpoints are in the oddrn list and not deleted (lines 113-121)",
    "getLineageRelations(Set<String>, LineageDepth, LineageStreamKind) — the recursive-CTE EDGE traversal (lines 123-133)",
    "getLineageRelationsForDepthOne(List<Long>, LineageStreamKind) — depth-1 fan-out around entity IDs joined to DATA_ENTITY (lines 135-150); the progressive-expansion primitive",
    "**getNeighbourOddrnsFromOwnedSet(long ownerId, LineageStreamKind, int limit)** (lines 164-183) — ST-8 hop 1. `SELECT DISTINCT <neighbour> FROM lineage WHERE <anchor> IN (SELECT data_entity.oddrn FROM data_entity JOIN ownership ON ownership.data_entity_id = data_entity.id WHERE ownership.owner_id = ?) AND is_deleted = false ORDER BY <neighbour> LIMIT ?`. Returns bare oddrns, not edges. Guards `limit <= 0` → `Flux.empty()` (lines 168-170).",
    "**getNeighbourOddrns(Collection<String> frontierOddrns, LineageStreamKind, int limit)** (lines 189-205) — ST-8 hops 2..n. Same projection / ordering / limit contract; the anchor predicate is a materialised `IN (frontier)` list (line 200) instead of a subquery. Guards empty frontier OR `limit <= 0` → `Flux.empty()` (lines 193-195).",
    "anchorField / neighbourField (private static; lines 209-215) — the single definition of the direction convention: DOWNSTREAM anchors on PARENT_ODDRN and yields CHILD_ODDRN; UPSTREAM anchors on CHILD_ODDRN and yields PARENT_ODDRN",
    "lineageCte (private; lines 217-243) — assembles the `WITH RECURSIVE` body: seed = edges touching the root oddrn set in the chosen direction at depth=1 (lines 230-234); recursive step = JOIN cte on direction-appropriate equality, depth+1, `t.depth < lineageDepth` AND not deleted (lines 236-241)"
  ]
- invariants: [
    "Soft-delete is the canonical deletion mechanism — every read filters `LINEAGE.IS_DELETED.isFalse()`, including BOTH new traversal methods (lines 67, 78, 88, 117, 147, 179, 201, 234, 241). Hard delete only via batchDeleteByEstablisherOddrn (line 47) and only by ingestion's rewrite-by-establisher contract.",
    "The direction convention is defined exactly once for the ST-8 pair (lines 209-215) and independently — but identically — inside lineageCte's `conditions` Pair (lines 226-228). DOWNSTREAM: anchor/left = PARENT_ODDRN. UPSTREAM: anchor/left = CHILD_ODDRN. Verified equal by reading both sites; they are NOT shared code, so the comment at lines 207-208 (\"kept in one place so the two traversals can never disagree\") describes the ST-8 pair's internal consistency, not a refactor of lineageCte.",
    "The ST-8 methods return a DETERMINISTIC prefix under truncation: the projection is `SELECT DISTINCT <single column>` and the ORDER BY key IS that column (lines 173+180, 198+202), so the sort key is unique within the result and no tie-breaker is needed. The surviving prefix is the lexicographically smallest `limit` oddrns, identically on every re-run.",
    "The ST-8 methods carry NO cycle guard and NO cross-hop dedup — a cycle A→B→A returns A again at hop 2. Cycle safety is the CALLER's, via an application-side visited set (MyDataScopeResolverImpl.java:148-153), and is asserted at MyDataScopeResolverTest.java:120-144.",
    "The ST-8 methods do NOT exclude the caller's own oddrns from the neighbour set. `A → B` with both owned returns B. The owned-entity exclusion is a separate downstream query (ReactiveDataEntityRepositoryImpl.listIdsByOddrnsExcludingOwnedBy:547-559, called at MyDataScopeResolverImpl.java:167).",
    "The `lineage` table has NO owner column (V0_0_2__add_lineage.sql:1-7 + V0_0_17__add_establisher_into_lineage.sql:1-2 + V0_0_79__data_deprecation.sql:11-12). Owner scoping therefore can only enter this file through a JOIN to `data_entity` → `ownership` — which is exactly what lines 175-178 do, and is the ONLY such JOIN in the file.",
    "The recursive CTE depth bound is `tDepth.lessThan(lineageDepth.getDepth())` (line 241); `LineageDepth.of(N)` yields exactly N hops (seed = depth 1, each recursive round +1). `LineageDepth.empty()` (LineageDepth.java:16-18) is `new LineageDepth(-1, true)`, so `t.depth < -1` is FALSE on the first iteration and recursion terminates with seed-only output. The `boolean empty` flag is NEVER read inside lineageCte — only the depth value matters.",
    "No `@ReactiveTransactional` on this repository class (lines 39-41: only `@Repository` + `@RequiredArgsConstructor`). Mutations rely on the caller's transactional scope: `LineageServiceImpl.replaceLineagePaths` is `@ReactiveTransactional` (LineageServiceImpl.java:124-133), `DataEntityInternalStateServiceImpl.restoreDeletedDataEntityRelations` is `@ReactiveTransactional` (DataEntityInternalStateServiceImpl.java:101-104). Both ST-8 methods are pure reads."
  ]
- audiences: [
    "ODD Platform lineage canvas (F-005) — the recursive-CTE read path on the entity-detail screen; unchanged by CTRIB-062",
    "ODD Platform unified asset search — the ST-8 \"My data\" scope filter (`my_data: [UPSTREAM|DOWNSTREAM]` + `upstream_depth` / `downstream_depth` on `POST /api/search/assets`); the ST-8 pair is its lineage primitive",
    "ODD Platform ingestion (LineageServiceImpl.replaceLineagePaths) — the batchDeleteByEstablisherOddrn + batchInsertLineages pair atomically rewrites an establisher's declared edges",
    "Entity soft-delete / restore flow (DataEntityInternalStateServiceImpl) — soft-delete / restore lineage edges when an entity transitions DELETED ↔ active",
    "Cross-owner subgraph enumeration in DataEntityRelationsService (getDependentDataEntityOddrns) — anchors the owner's entity oddrns and expands the reachable subgraph in EITHER direction with `LineageDepth.empty()` (a one-hop expansion in practice — see invariant 7)"
  ]

## dependencies_semantic

- requires-feature: [
    "F-005 data lineage feature — the recursive-CTE traversal (lines 123-133 + 217-243) backs the lineage canvas",
    "ST-8 unified asset search My-data scope (#1842 / CTRIB-062) — the neighbour-walk pair (lines 164-205) is its only lineage primitive. No `feature-flows/detail/F-NNN.yaml` anchors it yet: grep for `unified-asset-search|asset_search|AssetSearch` across `lineage/odd-platform/feature-flows/detail/` returns ZERO files.",
    "F-021 cross-owner / owner-relations enumeration (DataEntityRelationsService.getDependentDataEntityOddrns) — uses the CTE to expand from owner-anchored oddrns to the reachable subgraph"
  ]
- requires-config: [] — N/A: this repository reads no config keys. No `@Value`, no `@ConfigurationProperties`. Both the CTE depth and the ST-8 `limit` are per-call parameters. The ST-8 bounds are deliberately compile-time constants one hop up (MyDataScopeResolverImpl.java:53-57 + the Javadoc at :70-74 — "deliberately NOT a Spring property"), so there is no operator config surface for them.
- requires-config-schema: [
    "Migration `V0_0_101__lineage_child_oddrn_index.sql:28` — `CREATE INDEX IF NOT EXISTS lineage_child_oddrn ON lineage (child_oddrn)`. Not a config key, but a hard runtime prerequisite for the UPSTREAM hop's performance contract: without it the UPSTREAM anchor predicate at lines 179+200 has no usable index (the PK's leading column is parent_oddrn), and the migration's own measurement records 880.46 ms Seq Scan vs 22.40 ms Bitmap Index Scan on a 50 000-edge fixture (V0_0_101:12-16)."
  ]
- requires-runtime: [
    "PostgreSQL with recursive-CTE support — `DSL.withRecursive(cte)` at line 128. The deployed version per the CTRIB-062 plan-time probe is postgres:13.2-alpine (V0_0_101__lineage_child_oddrn_index.sql:12-13).",
    "jOOQ reactive operations via `JooqReactiveOperations` (line 42) wrapping Spring's `DatabaseClient` (JooqReactiveOperations.java:28); `.flux(query)` (lines 48, 69, 80, 90, 99, 109, 120, 131, 148, 182, 204) executes via R2DBC through `databaseClient.inConnectionMany` (JooqReactiveOperations.java:45-48). The `query.returning()` calls on UPDATE/DELETE (lines 48, 98, 108) require Postgres's RETURNING support.",
    "Spring DI — `@Repository` (line 39) + `@RequiredArgsConstructor` (line 40) + final `JooqReactiveOperations` field (line 42). Bean consumers: LineageServiceImpl, DataEntityRelationsServiceImpl, DataEntityInternalStateServiceImpl, DataEntityServiceImpl, and NEW: MyDataScopeResolverImpl (grep `lineageRepository\\.|reactiveLineageRepository\\.` across `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/` — 11 hits across 5 files)."
  ]
- couples-to: [
    "Postgres `lineage` table schema (V0_0_2__add_lineage.sql, V0_0_17__add_establisher_into_lineage.sql, V0_0_26__remove_length_constraints.sql, V0_0_79__data_deprecation.sql, V0_0_101__lineage_child_oddrn_index.sql)",
    "Postgres `ownership` table (NEW coupling — lines 175-178). `ownership` is declared at V0_0_3__add_ownership.sql:10-22 with a `UNIQUE (data_entity_id, owner_id)` constraint whose LEADING column is data_entity_id.",
    "Postgres `data_entity` table — the depth-1 fan-out JOIN (lines 142-146) and the owned-set anchor subquery (lines 175-177)",
    "`MyDataScopeResolverImpl` — a bidirectional contract coupling, not just a call. The repository supplies ordering + limit; the resolver supplies the visited set, the budget arithmetic (`remaining + 1` at MyDataScopeResolverImpl.java:142-143) and the cycle safety. Neither half is correct alone."
  ]

## upstream_callers

| Caller (file:line) | Method invoked | Entry point | Multiplicity per trigger | Owner-scoping at caller? | Notes |
|---|---|---|---|---|---|
| MyDataScopeResolverImpl.hop (MyDataScopeResolverImpl.java:142) | `getNeighbourOddrnsFromOwnedSet(ownerId, kind, remaining+1)` | `rest:POST /api/search/assets` → `ui: search page, My-data scope filter` | **1 per selected direction** (max 2 — UPSTREAM then DOWNSTREAM, MyDataScopeResolverImpl.java:90-96), so 0, 1 or 2 per search request | **N/A at this caller — the owner id is a METHOD ARGUMENT here.** The identity chokepoint is two hops up: AssetSearchServiceImpl.java:77-79 resolves it from `authIdentityProvider.fetchAssociatedOwner()` and never from the request body. | Called only at `depth == 1` (MyDataScopeResolverImpl.java:141). Skipped entirely when `remaining <= 0` (:136-138) or when a previous direction already truncated (:120). |
| MyDataScopeResolverImpl.hop (MyDataScopeResolverImpl.java:143) | `getNeighbourOddrns(frontier, kind, remaining+1)` | `rest:POST /api/search/assets` | **0..2 per direction** — hops 2..n, bounded by `clampDepth` ⇒ `MAX_DEPTH = 3` (MyDataScopeResolverImpl.java:53, 112-114). Worst case 2 directions x 2 = **4 calls per search request**; combined with hop 1, **≤ 6 lineage statements per request**. | Inherited from hop 1 — the frontier is already owner-derived. | Recursion stops early when the hop discovers nothing new or the budget bit (MyDataScopeResolverImpl.java:154-157). |
| LineageServiceImpl.getLineage (LineageServiceImpl.java:95-97) | `getLineageRelations(Set, LineageDepth.of(N), kind)` | `rest:GET /api/dataentities/{id}/lineage/{upstream,downstream}` → `ui: entity-detail lineage canvas` | 1 per canvas open | NO — a single root oddrn with no owner filter | Unchanged by CTRIB-062. `lineage_depth` now carries `default: 1` + `minimum: 1` in the spec (openapi.yaml:1601-1608). |
| LineageServiceImpl.getLineage (LineageServiceImpl.java:98-99) | `getLineageRelationsForDepthOne(rootIds, kind)` | same as above | 1 per canvas open (returns `Flux.empty()` when `expandedEntityIds` is empty, line 138-140) | NO | Progressive UI expansion. |
| LineageServiceImpl.getLineage (LineageServiceImpl.java:113-114) | `getChildrenCount` + `getParentCount` | same as above | 2 per canvas open | NO — the oddrn set is the union of every oddrn in the CTE result | Fan-out badges per node. |
| LineageServiceImpl.getDataEntityGroupLineage (LineageServiceImpl.java:66) | `getLineageRelations(List<String>)` | `rest:GET /api/dataentitygroups/{id}/lineage` | 1 | NO — the list comes from `groupEntityRelationRepository.getDEGEntitiesOddrns(...)` | Internal-DEG edges only. |
| LineageServiceImpl.replaceLineagePaths (LineageServiceImpl.java:131-132) | `batchDeleteByEstablisherOddrn` THEN `batchInsertLineages` | `rest:POST /ingestion/entities` | 1 pair per ingested payload with lineage | N/A — ingestion | `@ReactiveTransactional` at LineageServiceImpl.java:125 is the atomicity boundary. |
| DataEntityRelationsServiceImpl.getDependentOddrns (DataEntityRelationsServiceImpl.java:34) | `getLineageRelations(Set, LineageDepth.empty(), kind)` | `rest:GET /api/dataentities/my/{upstream,downstream}` | 1 | **YES at the anchor set** — the caller resolves the owner via `authIdentityProvider.fetchAssociatedOwner()` then passes the owner's entity-oddrn set as the root | `LineageDepth.empty()` ⇒ depth=-1 ⇒ seed-only (one hop). This was the file's ONLY owner-derived traversal before CTRIB-062 — and the owner filter lived in the CALLER, not the SQL. |
| DataEntityServiceImpl (DataEntityServiceImpl.java:665) | `getTargetsCount(datasetOddrns)` | `rest:GET /api/dataentities/{id}` (dataset children badge) | 1 | NO | — |
| DataEntityInternalStateServiceImpl (DataEntityInternalStateServiceImpl.java:126) | `softDeleteLineageRelations(oddrns)` | entity status transition → DELETED | 1 | N/A | Edges touching the entity on EITHER end (line 97). |
| DataEntityInternalStateServiceImpl (DataEntityInternalStateServiceImpl.java:133) | `restoreLineageRelations(oddrns)` | entity status transition out of DELETED | 1 | N/A | `@ReactiveTransactional` on the parent method (:101). |

## downstream_side_effects

| Method | DB tables touched | RW shape | Cardinality per call | Concurrency / consistency |
|---|---|---|---|---|
| batchDeleteByEstablisherOddrn (44-49) | `lineage` | DELETE … RETURNING | 0..N rows removed | Atomic only under the caller's transaction (LineageServiceImpl.java:125); outside one, a concurrent reader can observe the empty intermediate state. |
| batchInsertLineages (51-60) | `lineage` | INSERT … ON CONFLICT DO NOTHING … RETURNING (line 59) | 0..N rows inserted (conflicted rows are NOT returned) | Idempotent on the (parent, child, establisher) PK (V0_0_17__add_establisher_into_lineage.sql:116-117). |
| getTargetsCount / getChildrenCount / getParentCount (62-91) | `lineage` | SELECT + GROUP BY | 1 map | Read-only; non-deleted edges only. |
| softDeleteLineageRelations / restoreLineageRelations (93-111) | `lineage` | UPDATE … RETURNING | 0..N rows flipped | The OR-on-either-end filter (lines 97, 107) flips both directions in one statement; transactional under the caller. |
| getLineageRelations(List) (113-121) | `lineage` | SELECT DISTINCT (parent, child) | 0..N edges | Read-only. |
| getLineageRelations(Set, depth, kind) (123-133) | `lineage` | `WITH RECURSIVE t AS (seed UNION ALL step) SELECT DISTINCT parent, child FROM t` | 0..N edges | **Single statement ⇒ a single MVCC snapshot: the returned subgraph is internally consistent.** Intermediate rows materialise in `work_mem`; the outer `selectDistinct` (128-130) dedupes only the final projection. |
| getLineageRelationsForDepthOne (135-150) | `lineage`, `data_entity` (JOIN) | SELECT DISTINCT (parent, child) | 0..N edges; short-circuits to `Flux.empty()` on empty rootIds (138-140) | Read-only. |
| **getNeighbourOddrnsFromOwnedSet (164-183)** | `lineage`, `data_entity`, `ownership` | SELECT DISTINCT `<neighbour>` … ORDER BY `<neighbour>` LIMIT ? | **0..limit oddrns**; exactly 0 when `limit <= 0` (168-170) | Read-only. **NOT a snapshot of the walk** — see the row below. |
| **getNeighbourOddrns (189-205)** | `lineage` | SELECT DISTINCT `<neighbour>` … ORDER BY `<neighbour>` LIMIT ? | **0..limit oddrns**; exactly 0 on empty frontier or `limit <= 0` (193-195) | Read-only, but the ST-8 walk is **≤ 6 SEPARATE statements with no shared snapshot and no enclosing transaction** (MyDataScopeResolverImpl has no `@ReactiveTransactional`). Under READ COMMITTED each hop sees a different snapshot, so a concurrent ingestion rewrite (LineageServiceImpl.replaceLineagePaths) can produce a scope that mixes pre- and post-rewrite graph states. The recursive CTE it replaces does NOT have this property. |

No side-effect class outside `db-read` / `db-write` is produced by this node: no activity emit, no SSE push, no external call, no cache mutation, no log emit (the class carries no logger).

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "delete-by-establisher selects exactly the specified establishers and leaves others intact; RETURNING emits the removed rows"
    test_class: integration
    test_files: [LineageRepositoryTest.java:47-64]
  - behaviour: "ON CONFLICT DO NOTHING — a pre-inserted duplicate is silently skipped on re-insert"
    test_class: integration
    test_files: [LineageRepositoryTest.java:66-81]
  - behaviour: "getTargetsCount / getChildrenCount / getParentCount return the expected per-oddrn counts"
    test_class: integration
    test_files: [LineageRepositoryTest.java:83-109, 283-297, 299-311]
  - behaviour: "getLineageRelations(List) applies the BOTH-endpoints-in-list filter"
    test_class: integration
    test_files: [LineageRepositoryTest.java:111-128]
  - behaviour: "recursive-CTE traversal at DEPTH 1/2/3 in both directions on a 7-edge tree; depth=1 from a root returns ONLY direct children"
    test_class: integration
    test_files: [LineageRepositoryTest.java:130-281]
  - behaviour: "ST-8 walk — UPSTREAM and DOWNSTREAM traverse opposite directions and each direction's depth is independent; a depth above MAX_DEPTH is clamped, not rejected"
    test_class: integration
    test_files: [MyDataScopeResolverTest.java:70-96]
  - behaviour: "ST-8 walk — a neighbour the caller also OWNS is excluded from the result (exercises the fact that the repository does NOT exclude it; the exclusion is downstream)"
    test_class: integration
    test_files: [MyDataScopeResolverTest.java:98-118]
  - behaviour: "ST-8 walk — a 2-node cycle terminates, yields the node once, and is not reported as truncated"
    test_class: integration
    test_files: [MyDataScopeResolverTest.java:120-144]
  - behaviour: "ST-8 walk — the node budget truncates and the SAME request yields the SAME set twice (determinism)"
    test_class: integration
    test_files: [MyDataScopeResolverTest.java:146-180]
  - behaviour: "ST-8 walk — an owner with 6 owned entities and a budget of 3 still finds its neighbour (the owned set is not materialised into the budget — the hop-1 subquery's raison d'être)"
    test_class: integration
    test_files: [MyDataScopeResolverTest.java:182-212]
  - behaviour: "ST-8 walk — an owner with no lineage resolves to an empty untruncated scope, never a fall-through to the unscoped catalog"
    test_class: integration
    test_files: [MyDataScopeResolverTest.java:214-231]
- uncovered_behaviours:
  - behaviour: "WHICH subset survives truncation. MyDataScopeResolverTest.java:146-180 asserts the set is IDENTICAL across two runs but never asserts it is the lexicographically smallest prefix — the property the ORDER BY at lines 180/202 actually delivers. A change to `orderBy(neighbour)` (e.g. dropping it, or ordering by a second column) would keep that test green while silently changing which neighbours an operator sees."
    test_class: integration
    criticality: HIGH
    note: "Statically determinable (DISTINCT single-column projection ordered by that same column has no ties), so this is a regression-test gap, not a probe."
  - behaviour: "`limit <= 0` → `Flux.empty()` on BOTH methods (lines 168-170, 193-195). No test drives a non-positive limit; the resolver's `remaining <= 0` short-circuit at MyDataScopeResolverImpl.java:136-138 means production never reaches these guards, so they are structurally untested."
    test_class: unit
    criticality: MEDIUM
  - behaviour: "Empty frontier → `Flux.empty()` (lines 193-195). Unreached in production because MyDataScopeResolverImpl.java:154-157 stops when `discovered.isEmpty()`."
    test_class: unit
    criticality: LOW
  - behaviour: "The ST-8 methods have NO repository-layer test at all. Search root: the WHOLE repo — `grep -rn 'getNeighbourOddrns|getNeighbourOddrnsFromOwnedSet' <odd-platform-repo> --include='*.java'` returns 7 hits, all in `odd-platform-api/src/main/java/` (interface x2, impl x2, resolver call sites x2 + one javadoc @link); ZERO in `odd-platform-api/src/test/java/`. All behavioural coverage is transitive through MyDataScopeResolverTest."
    test_class: integration
    criticality: MEDIUM
    note: "Defensible as a design choice — the resolver is the meaningful unit — but it means a direct SQL regression (e.g. a swapped anchor/neighbour field) is only caught through the resolver's assertions."
  - behaviour: "Soft-delete filtering on the ST-8 path — no test inserts an `is_deleted = true` edge and asserts the neighbour walk skips it (lines 179, 201)."
    test_class: integration
    criticality: HIGH
    note: "This is the interaction between the entity delete cascade (DataEntityInternalStateServiceImpl.java:126) and the new search scope: a deleted entity must not appear in a My-data impact set."
  - behaviour: "softDeleteLineageRelations / restoreLineageRelations — still no test asserting the either-end predicate, idempotency, or that non-touching edges are untouched."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Recursive-CTE termination on a CYCLIC graph. LineageRepositoryTest.java:130-281 uses a tree. The contrast is now sharp and testable: MyDataScopeResolverTest.java:120-144 proves the ST-8 walk is cycle-safe; there is no matching test proving the CTE is NOT, or documenting its row growth."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`getLineageRelations(set, LineageDepth.empty(), kind)` seed-only output — the DataEntityRelationsServiceImpl.java:34 call site is structurally untested at the repository layer."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Hop cost as a function of `limit` — whether the `ORDER BY` + `DISTINCT` forces full materialisation regardless of LIMIT."
    test_class: performance
    criticality: HIGH
    note: "PROBE-NEEDED — P-394."
  - behaviour: "Whether the 5s wall-clock cancel actually terminates the in-flight Postgres statement issued at lines 182/204."
    test_class: performance
    criticality: MEDIUM
    note: "PROBE-NEEDED — P-395."
  - behaviour: "The V0_0_101 index is load-bearing for the UPSTREAM hop but nothing asserts it exists or is used. A future `DROP INDEX` or a planner regression silently returns the walk to the 880 ms Seq Scan the migration measured (V0_0_101:15)."
    test_class: performance
    criticality: MEDIUM
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/LineageRepositoryTest.java:29-311 — Testcontainers integration (extends BaseIntegrationTest at :29); 7 @Test methods, NONE touching the ST-8 pair",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/MyDataScopeResolverTest.java:38-287 — Testcontainers integration; 7 @Test methods, the sole behavioural coverage of the ST-8 pair",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/LineageServiceTest.java:123-174 — unit; mocks `lineageRepository.getLineageRelations(any(), any(), any())`"
  ]
- gaps: |
    The coverage picture inverted with CTRIB-062. The recursive CTE is well covered for happy-path
    tree shapes and uncovered for its failure modes (cycles, diamonds, large depth). The NEW walk is
    covered for exactly those failure modes — cycle safety, budget truncation, determinism, the
    prolific-owner case — because the author wrote the tests against the design's stated risks
    (MyDataScopeResolverTest.java:26-35). What the new tests do NOT cover is the part that lives in
    THIS file rather than in the resolver: the ORDER BY that decides *which* neighbours survive
    truncation, and the `is_deleted` filter on the neighbour hop. The highest-leverage single test is
    the lexicographic-prefix assertion (integration, MyDataScopeResolverTest): it converts the
    strongest operator-visible property of this node from "true by inspection" into "true by
    assertion", and it is the only thing standing between an innocuous-looking change to line 180
    and a silently different impact set on a shared search URL.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file (ReactiveLineageRepositoryImpl.java:1-244)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "Operator-facing feature page for the F-005 lineage feature the recursive CTE backs"
    last_verified_at: "2026-08-31T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Live WebFetch 2026-08-31, status 200. Reported content, relevant to this node:
      - depth: "the canvas's 1-20 depth dropdown is a UI presentation choice; the URL and the API
        accept any positive integer with no upper bound."
      - owner scoping: "Owner-scoping is enforced at exactly one site — the lineage projection
        downstream has no defence-in-depth."
      - my-data semantics: the triplet endpoints return "the set of entities that the user's owned
        entities depend on but the user does not own" (and vice versa).
      - performance: "The endpoint fetches the full owned set before applying pagination";
        "PostgreSQL's planner cost is non-linear above ~1000 IN-clause elements."
      - EXPLICIT ABSENCES reported by the fetch: no discussion of cycles; no search-filtering
        mechanism described.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage"
    anchor: ""
    rationale: "API-reference page for the lineage endpoints whose read path traverses the CTE"
    last_verified_at: "2026-08-31T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Live WebFetch 2026-08-31, status 200. Reported content:
      - lineage_depth: "Number of hops to traverse from the rooted entity" with a server-side
        default of 1 when omitted; no maximum; "very large values trigger correspondingly expensive
        recursive walks."
      - owner scoping: "Lineage reads are not access-controlled per owner."; only the `/my/`
        endpoints are scoped to the signed-in user, and they "removes your own entities from the
        result."
  - url: "documentation@release/1.0.0 — docs/data-discovery/search.md + docs/data-discovery/catalog-overview.md"
    anchor: ""
    rationale: "The ST-8 My-data search scope (my_data / upstream_depth / downstream_depth) is unreleased behaviour and rides the documentation release train."
    pending_release: "1.0.0"
    train_ref: "release/1.0.0 — branch docs/CTRIB-062-my-data-filter, per contributor/CTRIB-062.md:17 and :470-475"
    last_verified_status: "not-applicable — release-train gated; GitBook publishes main only, so the live site cannot show it yet (per the release-train marker)"
    confidence: LOW
- doc_drift_findings:
  - "RESOLVED since the 2026-05-12 baseline: the previously-recorded drift 'live API-reference claims a default lineage_depth that does not exist in code' no longer holds. The spec now declares `minimum: 1, default: 1` (openapi.yaml:1601-1608) and the operation descriptions say 'defaults to 1 when omitted' (openapi.yaml:1597, 1632), which matches the live page's 'server-side default of 1 when omitted'. The live page's 'no maximum … very large values trigger correspondingly expensive recursive walks' also matches line 241, where `lineageDepth.getDepth()` is consumed with no clamp. No action."
  - "FORWARD DRIFT, release-train gated: the live features/data-lineage page states 'Owner-scoping is enforced at exactly one site — the lineage projection downstream has no defence-in-depth.' That is accurate for the released code, where the only owner-derived traversal is DataEntityRelationsServiceImpl.java:34 pre-computing an anchor set outside the SQL. It stops being accurate the moment ST-8 ships: `getNeighbourOddrnsFromOwnedSet` puts `OWNERSHIP.OWNER_ID.eq(ownerId)` INSIDE the SQL (ReactiveLineageRepositoryImpl.java:178), which is a second, differently-shaped owner-scoping site. The sentence needs updating on the release/1.0.0 train, not on main. Severity: MEDIUM (a doc that will be wrong on release, not one that is wrong now)."
  - "COVERAGE GAP, release-train gated: neither live page describes the My-data lineage SEARCH filter — the features/data-lineage fetch explicitly reports 'No search filtering mechanism is described.' A `grep -rn 'my_data|MY_OBJECTS|upstream_depth' <documentation-repo>/docs/` finds the tokens only in ADR-0022 (the ACTIVITY feed's view modes), never in a search context. Expected: the paired doc work is DOC-504/DOC-503 on the release/1.0.0 train (contributor/CTRIB-062.md:17, :470-475). Severity: LOW while unreleased; becomes HIGH if ST-8 ships without the train landing."
  - "STILL OPEN: no operator-facing page documents lineage cycle handling. The absence now matters more, not less, because the two traversals behave DIFFERENTLY on a cycle — the CTE re-expands it per path until the depth bound (lines 235-241), the ST-8 walk terminates on the caller's visited set (MyDataScopeResolverImpl.java:148-153). An operator comparing 'Downstream' on the canvas with 'Downstream' in search on a cyclic graph gets two different answers and no documentation explaining why. Severity: MEDIUM."

## implicit_adrs

- "**The graph view and the search filter get different traversal primitives, deliberately, and the CTE is left untouched.** The ST-8 pair was added ALONGSIDE `lineageCte` rather than replacing it or generalising it, because a search filter runs per interaction and a canvas open is a deliberate exploration." — evidence: ReactiveLineageRepositoryImpl.java:164-205 (added) + 217-243 (unchanged) + MyDataScopeResolverImpl.java:24-28 — intent_anchor: "`ReactiveLineageRepositoryImpl#getLineageRelations` is a `WITH RECURSIVE ... UNION ALL` over EDGES with no visited set, so its cost grows with PATH count, not node count. … The graph view keeps that CTE unchanged; the search filter needs a primitive that is bounded by construction." (MyDataScopeResolverImpl.java:24-29) — confidence: HIGH

- "**The owned set is bound as a SUBQUERY, never a materialised id list — the uncapped-MY_OBJECTS invariant is protected at the SQL boundary.** Hop 1 inlines `SELECT data_entity.oddrn FROM data_entity JOIN ownership WHERE ownership.owner_id = ?` so that a prolific owner's ownership can neither be enumerated by the walk nor charged against the traversal budget." — evidence: ReactiveLineageRepositoryImpl.java:175-178 + the regression test at MyDataScopeResolverTest.java:182-212 — intent_anchor: "The owned set is an inlined SUBQUERY, never a materialised id list: the My-data walk must not cap or even enumerate the caller's ownership, because {@code MY_OBJECTS} itself stays uncapped (an owner of tens of thousands of assets keeps seeing all of them), and a huge owned set must not consume the traversal budget before the first hop runs." (ReactiveLineageRepositoryImpl.java:155-158) — confidence: HIGH

- "**Every bounded hop is ORDERED, so truncation yields a deterministic prefix — because the search state is a shareable URL.** The `ORDER BY <neighbour>` is not cosmetic; it is the mechanism that makes two people opening the same link see the same impact set." — evidence: ReactiveLineageRepositoryImpl.java:180, 202 (`orderBy(neighbour)` immediately preceding `limit`) — intent_anchor: "Returns the distinct neighbour oddrns in a stable order, at most {@code limit} of them, so that when the caller's node budget cuts the walk short the surviving prefix is DETERMINISTIC — the search state is a shareable URL, so two people opening the same link must see the same scope." (ReactiveLineageRepository.java:34-36) — confidence: HIGH

- "**The direction convention is extracted into one pair of private helpers rather than duplicated per method**, so that the two traversal shapes in this file cannot drift apart on the DOWNSTREAM/UPSTREAM mapping." — evidence: ReactiveLineageRepositoryImpl.java:209-215 (helpers) used at 171-172 and 196-197; the CTE's independent-but-identical encoding at 226-228 — intent_anchor: "DOWNSTREAM walks parent -> child, so it anchors on the parent; UPSTREAM walks child -> parent. Same convention as lineageCte below, kept in one place so the two traversals can never disagree." (ReactiveLineageRepositoryImpl.java:207-208) — confidence: HIGH

- "**Index-shape decisions for this repository are measured on the deployed Postgres version, not assumed.** V0_0_101 adds `lineage (child_oddrn)` and its comment records the EXPLAIN evidence — DOWNSTREAM 29.95 ms on the PK vs UPSTREAM 880.46 ms Seq Scan vs 22.40 ms on the new index — together with the reason CONCURRENTLY was not used." — evidence: V0_0_101__lineage_child_oddrn_index.sql:1-28 — intent_anchor: "MEASURED, not assumed (odd-team CTRIB-062 plan-time probe, on postgres:13.2-alpine — the deployed version — against this exact DDL with a dense 50 000-edge fixture, 200 anchor oddrns per hop)" (V0_0_101:12-13) — confidence: HIGH

- "Soft-delete is the canonical deletion mechanism for lineage edges — every read filters `is_deleted = false`, and the rule was extended to the new methods without exception. The only hard-delete path remains the ingestion rewrite-by-establisher." — evidence: ReactiveLineageRepositoryImpl.java:67, 78, 88, 117, 147, **179**, **201**, 234, 241 + V0_0_79__data_deprecation.sql:11-12 — intent_anchor: the paired symmetric `softDeleteLineageRelations` / `restoreLineageRelations` methods (lines 93-111) plus the unbroken `IS_DELETED.isFalse()` filter across all nine read sites — confidence: HIGH

- "Ingestion atomicity via paired `batchDeleteByEstablisherOddrn` + `batchInsertLineages` under the CALLER's `@ReactiveTransactional` — the repository deliberately exposes the two primitives separately so the service can compose them in one transactional boundary." — evidence: ReactiveLineageRepositoryImpl.java:44-60 + LineageServiceImpl.java:124-133 — intent_anchor: `@ReactiveTransactional public Flux<LineagePojo> replaceLineagePaths(...) { return lineageRepository.batchDeleteByEstablisherOddrn(establishers).thenMany(lineageRepository.batchInsertLineages(pojos)); }` (LineageServiceImpl.java:125-133) — confidence: HIGH

- "Establisher-keyed edge provenance — each edge carries the oddrn of the entity that DECLARED it, so re-publishing entity X rewrites only X's edges and leaves Y's untouched." — evidence: V0_0_17__add_establisher_into_lineage.sql:1-2, 116-117, 119 + ReactiveLineageRepositoryImpl.java:44-49 — intent_anchor: `CREATE INDEX lineage_establisher_oddrn ON lineage (establisher_oddrn)` (V0_0_17:119) — confidence: HIGH

## bugs_limitations_corner_cases

- "**The neighbour hop returns oddrns the caller already owns, and those consume the traversal budget before being discarded.** `getNeighbourOddrnsFromOwnedSet` (lines 173-181) has no predicate excluding the anchor's own owned set; for `A → B` with both owned, B is returned. `MyDataScopeResolverImpl.hop` adds B to `visited` (MyDataScopeResolverImpl.java:148-153), charging it against `maxScopeNodes`, and only `toDataEntityIds` removes it afterwards via `listIdsByOddrnsExcludingOwnedBy` (MyDataScopeResolverImpl.java:167 → ReactiveDataEntityRepositoryImpl.java:547-559). Operator-visible consequence: a team whose owned assets are densely interlinked can be told 'results truncated — narrow your search' while the returned neighbour set is far SMALLER than the 10 000 budget, because most of the budget was spent on their own entities. MyDataScopeResolverTest.java:98-118 asserts the exclusion happens but not that it happens too late to refund the budget." — evidence: ReactiveLineageRepositoryImpl.java:173-181 + MyDataScopeResolverImpl.java:145-159, 162-171 + ReactiveDataEntityRepositoryImpl.java:547-559 — severity: MEDIUM

- "**The ST-8 walk is not a consistent snapshot of the lineage graph; the recursive CTE is.** The walk issues up to 6 independent statements (2 directions x 3 hops; MyDataScopeResolverImpl.java:90-96, 130-159) through `jooqReactiveOperations.flux` (lines 182, 204), each acquiring its own connection (JooqReactiveOperations.java:45-48), with no enclosing transaction anywhere on the path (`grep -n '@ReactiveTransactional' <odd-platform-repo>/.../service/MyDataScopeResolverImpl.java` and `.../service/AssetSearchServiceImpl.java` — zero hits in either). Under READ COMMITTED, an ingestion `replaceLineagePaths` landing mid-walk (LineageServiceImpl.java:126-133 — a DELETE followed by an INSERT) can be observed half-applied ACROSS hops: hop 2 can see a node whose outbound edges hop 3 no longer finds. The single-statement CTE at lines 128-130 cannot exhibit this." — evidence: ReactiveLineageRepositoryImpl.java:182, 204 + MyDataScopeResolverImpl.java:130-159 + JooqReactiveOperations.java:44-49 + LineageServiceImpl.java:124-133 — severity: MEDIUM

- "**Hops 2..n bind an IN-list of up to 10 001 elements, which the hop-1 design explicitly avoids.** `getNeighbourOddrns` binds `anchor.in(frontierOddrns)` (line 200) where the frontier is `discovered` from the previous hop, sized up to `remaining` ≤ 10 000 (MyDataScopeResolverImpl.java:135, 142-147). The reason hop 1 uses a subquery (budget protection, lines 155-158) does not apply here — the frontier IS already bounded — but the planner cost does: the live features/data-lineage page (WebFetched 2026-08-31, status 200) states 'PostgreSQL's planner cost is non-linear above ~1000 IN-clause elements.' `JooqReactiveOperations.executeInPartition` (JooqReactiveOperations.java:51-67, BATCH_SIZE 1000) exists for exactly this shape and is not used here." — evidence: ReactiveLineageRepositoryImpl.java:198-203 vs 173-181 + MyDataScopeResolverImpl.java:135-147 + JooqReactiveOperations.java:24, 51-67 — severity: MEDIUM

- "**Truncation is deterministic but BIASED by oddrn lexicographic order.** `ORDER BY <neighbour>` (lines 180, 202) makes the surviving prefix reproducible — the stated goal — but the sort key is the ODDRN string, which begins with the data-source type (`//airflow/...`, `//postgresql/...`, `//snowflake/...`). A truncated My-data impact set therefore systematically over-represents alphabetically-early source types and can omit an entire platform. Neither Javadoc mentions this: ReactiveLineageRepository.java:34-36 frames the ordering purely as determinism." — evidence: ReactiveLineageRepositoryImpl.java:180, 202 + ReactiveLineageRepository.java:34-36 — severity: MEDIUM

- "**The `LIMIT` bounds the rows returned, not the work done.** The projection is `SELECT DISTINCT <col> … ORDER BY <col> LIMIT ?` (lines 173-181, 198-203); a distinct-then-sort cannot emit its first row until the full matching set is aggregated and sorted unless the planner finds an index-ordered path, and the UPSTREAM hop's driving index (`lineage_child_oddrn`, V0_0_101:28) orders by the ANCHOR column while the ORDER BY is on the NEIGHBOUR column. Consequence: `MyDataScopeResolverImpl`'s shrinking `remaining` budget (MyDataScopeResolverImpl.java:135) buys no work reduction on the hop that overruns it — a hub anchor with a very wide fan-out costs the same at `limit=1` as at `limit=10001`. PROBE-NEEDED — P-394." — evidence: ReactiveLineageRepositoryImpl.java:173-181, 198-203 + V0_0_101__lineage_child_oddrn_index.sql:28 — severity: MEDIUM

- "**The owned-set anchor subquery applies no predicate on `data_entity` beyond the ownership join.** Lines 175-178 select `data_entity.oddrn` filtered only by `ownership.owner_id`; there is no `status`, `hollow`, or `exclude_from_search` condition. Entity-level soft-delete is covered INDIRECTLY, because the delete cascade also soft-deletes the edges (DataEntityInternalStateServiceImpl.java:126 → softDeleteLineageRelations) and line 179 filters those. `hollow` and `exclude_from_search` entities are NOT covered by that cascade, so an owned hollow stub or a search-excluded entity still anchors the walk and its neighbours still consume budget." — evidence: ReactiveLineageRepositoryImpl.java:175-179 + DataEntityInternalStateServiceImpl.java:126 + the columns as seeded at MyDataScopeResolverTest.java:267-274 — severity: LOW

- "**`ownership.owner_id` has no index of its own.** The anchor subquery filters `OWNERSHIP.OWNER_ID.eq(ownerId)` (line 178). Search roots: `grep -in 'ON ownership|INDEX.*ownership' <odd-platform-repo>/odd-platform-api/src/main/resources/db/migration/` returns only `term_ownership` hits, and `grep -rn 'CREATE INDEX' <odd-platform-repo>/odd-platform-api/src/main/java/` returns ZERO (no Java-side DDL), so the only index-bearing declarations on the table are the PK and `UNIQUE (data_entity_id, owner_id)` at V0_0_3__add_ownership.sql:12-17 — whose LEADING column is data_entity_id. The owner predicate must therefore scan (at best an index-only scan of the whole unique index). CTRIB-062 measured and indexed the `lineage` side of this query but not the `ownership` side." — evidence: ReactiveLineageRepositoryImpl.java:175-178 + V0_0_3__add_ownership.sql:10-22 + V0_0_101__lineage_child_oddrn_index.sql:8-10 (which enumerates lineage's indexes but not ownership's) — severity: MEDIUM

- "No cycle-detection inside the recursive CTE: the body is `UNION ALL` (line 235) with no visited-set guard and no Postgres `WITH … CYCLE` clause; the only terminator is `tDepth.lessThan(lineageDepth.getDepth())` (line 241). The outer `selectDistinct` (lines 128-130) deduplicates the FINAL result but not the CTE's intermediate work. The CTRIB-062 plan-time measurement quantifies the amplification: from 200 roots on a dense 50 000-edge graph, depth 2 materialised 130 000 rows to yield 800 distinct nodes, and depth 3 did not complete within a 25 s statement timeout (MyDataScopeResolverImpl.java:26-28)." — evidence: ReactiveLineageRepositoryImpl.java:230-241 + 128-130 + MyDataScopeResolverImpl.java:24-29 — severity: HIGH

- "No upper bound on `lineageDepth.getDepth()` at the repository layer — consumed directly at line 241 with no `Math.min`. The CTE path has no equivalent of the ST-8 `MAX_DEPTH = 3` clamp (MyDataScopeResolverImpl.java:53, 112-114); the two traversals in this file now have completely different depth-safety postures, and only the newer one is bounded." — evidence: ReactiveLineageRepositoryImpl.java:241 + LineageDepth.java:12-14 + MyDataScopeResolverImpl.java:53, 111-114 — severity: HIGH

- "No JOIN-side owner filter in the recursive CTE: the seed and recursive step filter only on `is_deleted` (lines 234, 241). When invoked from `DataEntityRelationsServiceImpl.java:34`, owner-scoping relies entirely on the caller pre-filtering the seed oddrn set; the expansion that follows is not owner-scoped. This remains true after CTRIB-062 — the new owner predicate at line 178 belongs to the ST-8 methods only and does not touch the CTE." — evidence: ReactiveLineageRepositoryImpl.java:230-241 + V0_0_2__add_lineage.sql:1-7 + DataEntityRelationsServiceImpl.java:25-39 — severity: HIGH

- "Empty-input behaviour is now inconsistent three ways across the file: `getLineageRelationsForDepthOne` short-circuits empty input (lines 138-140), both ST-8 methods short-circuit empty/non-positive input (lines 168-170, 193-195), and `getLineageRelations(Set, LineageDepth, kind)` does NOT — it builds a CTE with an empty `IN` list (line 234) and pays a round-trip to get an empty result." — evidence: ReactiveLineageRepositoryImpl.java:138-140, 168-170, 193-195 vs 123-133 — severity: LOW

- "`getLineageRelations(List<String>)` (lines 113-121) builds an OR-clause whose two legs are logically equivalent: `(PARENT in oddrns AND CHILD in oddrns) OR (CHILD in oddrns AND PARENT in oddrns)` (lines 118-119). The code reads as though it means 'at least one endpoint in the list'; it implements 'both endpoints in the list'. `getLineageRelationsTest_WithOddrns` (LineageRepositoryTest.java:111-128) inserts a single edge with both endpoints in the queried list, so it does not distinguish the two semantics." — evidence: ReactiveLineageRepositoryImpl.java:113-121 + LineageRepositoryTest.java:111-128 — severity: MEDIUM

- "`LineageDepth.empty()` semantics remain call-site folklore: value -1 makes `t.depth < -1` false on the first iteration, so `empty()` means 'seed-only' (one hop), not 'no traversal'. The `boolean empty` flag is never read inside `lineageCte` (lines 217-243)." — evidence: LineageDepth.java:16-18 + ReactiveLineageRepositoryImpl.java:217-243 + DataEntityRelationsServiceImpl.java:34 — severity: MEDIUM

- "Soft-delete on either end uses an OR predicate (lines 97, 107) that could not use an index on the CHILD_ODDRN leg before CTRIB-062. `V0_0_101`'s `lineage_child_oddrn` index (V0_0_101:28) now gives the planner a path for that leg as a side effect, although the migration's stated purpose is the ST-8 upstream hop. The improvement is real but incidental and unasserted by any test." — evidence: ReactiveLineageRepositoryImpl.java:97, 107 + V0_0_101__lineage_child_oddrn_index.sql:20-23 — severity: LOW

- "No `@ReactiveTransactional` on this repository's mutation methods — atomicity is delegated to the caller. A future caller invoking `batchDeleteByEstablisherOddrn` outside a transaction observes a non-atomic delete with no rollback; nothing in the signature warns of this." — evidence: ReactiveLineageRepositoryImpl.java:39-41, 44-60 vs LineageServiceImpl.java:124-133 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "ReactiveLineageRepositoryImpl.java:168-170"
      name: "limit guard (getNeighbourOddrnsFromOwnedSet)"
      value: "limit <= 0 -> Flux.empty()"
      questions:
        - q: "What at limit = 0? At limit = 1?"
          a: "limit=0 and any negative value return Flux.empty() WITHOUT issuing SQL (line 169). limit=1 issues the query and returns exactly the lexicographically smallest neighbour oddrn, because the ORDER BY key is the DISTINCT projection column."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:168-170, 173, 180-181"
        - q: "What at the production maximum (remaining + 1 = 10001) and beyond?"
          a: "No upper clamp exists at this layer — `DSL.val(limit)` (line 181) binds whatever it is given, including Integer.MAX_VALUE. The only ceiling is MAX_SCOPE_NODES = 10_000 one hop up, so production never exceeds 10_001; a future caller could."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:181 + MyDataScopeResolverImpl.java:55, 135, 142"
        - q: "Does a larger limit cost more work, or only return more rows?"
          a: "PROBE-NEEDED. The DISTINCT + ORDER BY on the projected column suggests a blocking sort/aggregate whose cost is independent of LIMIT, but whether the planner finds an index-ordered early-terminating path is not statically determinable."
          confidence: PROBE-NEEDED
          evidence: "P-394"
        - q: "What does the operator see at each boundary?"
          a: "At the cap: MyDataScopeResolverImpl detects it by asking for remaining+1 and comparing sizes (MyDataScopeResolverImpl.java:139-146), sets truncated=true with reason NODE_CAP, and AssetSearchServiceImpl stamps scope_truncated / scope_truncation_reason on the page info (AssetSearchServiceImpl.java:98-106). The operator gets a partial impact set that is explicitly labelled partial. At limit<=0 they would get an empty scope indistinguishable from 'no neighbours' — unreachable in production."
          confidence: STATIC-INFERRED
          evidence: "MyDataScopeResolverImpl.java:139-146, 162-171 + AssetSearchServiceImpl.java:98-106"
    - location: "ReactiveLineageRepositoryImpl.java:193-195"
      name: "empty-frontier + limit guard (getNeighbourOddrns)"
      value: "CollectionUtils.isEmpty(frontierOddrns) || limit <= 0 -> Flux.empty()"
      questions:
        - q: "What at an empty frontier?"
          a: "Flux.empty() with no SQL — prevents an empty `IN ()` clause. Unreachable in production: the resolver stops when `discovered.isEmpty()` (MyDataScopeResolverImpl.java:154-157)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:193-195 + MyDataScopeResolverImpl.java:154-157"
        - q: "What at a frontier of 10 000 elements?"
          a: "A 10 000-element bind list on line 200 — under Postgres's 65 535 parameter ceiling, but in the region where the live features/data-lineage page (WebFetch 2026-08-31, 200) reports planner cost as non-linear. JooqReactiveOperations.executeInPartition (BATCH_SIZE 1000) is not applied."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:200 + MyDataScopeResolverImpl.java:135, 143 + JooqReactiveOperations.java:24, 51-67"
    - location: "ReactiveLineageRepositoryImpl.java:221, 238, 241"
      name: "lineageCte depth counter (startDepth = 1, +1 per round, bound = lineageDepth.getDepth())"
      value: "seed depth 1; terminate when t.depth >= lineageDepth"
      questions:
        - q: "What at depth 0 / negative / LineageDepth.empty()?"
          a: "`t.depth < 0` and `t.depth < -1` are both FALSE on the first iteration (seed depth is 1), so all three collapse to seed-only output — the direct edges around the roots. `empty()` therefore returns rows, despite the name."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:221, 241 + LineageDepth.java:12-18"
        - q: "What at very large depth?"
          a: "No clamp at line 241. Measured behaviour on a dense graph: depth 3 from 200 roots did not complete within a 25 s statement timeout. Contrast the ST-8 path, which clamps to MAX_DEPTH = 3."
          confidence: STATIC-INFERRED
          evidence: "MyDataScopeResolverImpl.java:26-28 + ReactiveLineageRepositoryImpl.java:241 + MyDataScopeResolverImpl.java:53, 112-114"
    - location: "MyDataScopeResolverImpl.java:53-57 (1-hop neighbour; the bounds this node's parameters carry)"
      name: "MAX_DEPTH / MAX_SCOPE_NODES / WALL_CLOCK_BUDGET"
      value: "3 / 10_000 / 5s"
      questions:
        - q: "Can an operator change them?"
          a: "No. They are compile-time constants with a package-private constructor as the only seam, and the Javadoc states the exclusion is deliberate: 'deliberately NOT a Spring property: the bounds stay fixed in production (no operator knob to misconfigure, no config surface to document)'."
          confidence: STATIC-INFERRED
          evidence: "MyDataScopeResolverImpl.java:53-57, 70-83"
        - q: "Which of the three shapes the returned set?"
          a: "Only MAX_SCOPE_NODES. WALL_CLOCK_BUDGET is a circuit breaker that yields TIMEOUT with NO scope rather than a partial set, so a load-dependent bound can never silently change what an operator sees."
          confidence: STATIC-INFERRED
          evidence: "MyDataScopeResolverImpl.java:31-41, 103-108"
  name_behavior_pairs:
    - name: "getNeighbourOddrnsFromOwnedSet"
      promise: "the oddrns one lineage hop away from the entities this owner owns"
      implementation: "SELECT DISTINCT <neighbour> FROM lineage WHERE <anchor> IN (SELECT data_entity.oddrn FROM data_entity JOIN ownership ON ownership.data_entity_id = data_entity.id WHERE ownership.owner_id = ?) AND lineage.is_deleted = false ORDER BY <neighbour> LIMIT ? — anchor/neighbour resolved by streamKind at lines 171-172."
      drift: MINOR
      operator_visible_consequence: "'Neighbour' includes oddrns the same owner owns (A->B, both owned, returns B). Those are removed only downstream, after they have already been charged against the traversal budget."
      confidence: STATIC-INFERRED
      evidence: "ReactiveLineageRepositoryImpl.java:164-183 + MyDataScopeResolverImpl.java:145-153, 167 + ReactiveDataEntityRepositoryImpl.java:547-559"
    - name: "getNeighbourOddrns"
      promise: "the oddrns one hop from the supplied frontier"
      implementation: "Identical projection/ordering/limit, anchored on a materialised IN-list (line 200). Returns previously-visited nodes and frontier members themselves when edges point back — no cross-hop dedup."
      drift: NONE
      operator_visible_consequence: "N/A — the split of responsibility is documented: cycle safety is the caller's visited set, stated at MyDataScopeResolverImpl.java:44-45 and asserted at MyDataScopeResolverTest.java:120-144."
      confidence: STATIC-INFERRED
      evidence: "ReactiveLineageRepositoryImpl.java:189-205 + MyDataScopeResolverImpl.java:44-45, 148-153"
    - name: "anchorField / neighbourField"
      promise: "one definition of DOWNSTREAM=parent->child, UPSTREAM=child->parent for the whole file"
      implementation: "Correct for the ST-8 pair (lines 210, 214, used at 171-172, 196-197). lineageCte encodes the SAME mapping INDEPENDENTLY in its `conditions` Pair (lines 226-228) — it does not call the helpers."
      drift: MINOR
      operator_visible_consequence: "None today — the two encodings were read and are equal. The comment's claim that the convention is 'kept in one place so the two traversals can never disagree' (lines 207-208) is aspirational for lineageCte, which retains its own copy; a future direction change must still be made twice."
      confidence: STATIC-INFERRED
      evidence: "ReactiveLineageRepositoryImpl.java:207-215 vs 226-228"
    - name: "getLineageRelations(Set, LineageDepth.of(N), kind)"
      promise: "lineage relations within N hops of the roots"
      implementation: "Seed emits depth 1 (the direct edges); each recursive round requires t.depth < N and emits depth+1. N=1 yields the direct edges only; N=2 yields two hops."
      drift: NONE
      operator_visible_consequence: "N/A — verified against LineageRepositoryTest.java:130-281, which asserts depth 1/2/3 in both directions."
      confidence: STATIC-INFERRED
      evidence: "ReactiveLineageRepositoryImpl.java:221, 230-241 + LineageRepositoryTest.java:130-281"
    - name: "getLineageRelations(List<String> oddrns)"
      promise: "the lineage relations of these oddrns"
      implementation: "Edges where BOTH endpoints are in the list (lines 118-119; the OR's two legs are commutatively identical)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "For a DEG whose members have edges to entities OUTSIDE the group, those edges are absent from the group lineage view. The name and the decorative OR both read as the broader 'at least one endpoint' semantic."
      confidence: STATIC-INFERRED
      evidence: "ReactiveLineageRepositoryImpl.java:113-121 + LineageServiceImpl.java:66"
    - name: "LineageDepth.empty()"
      promise: "no traversal"
      implementation: "depth = -1, which terminates recursion after the seed — i.e. exactly one hop of real edges."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "`GET /api/dataentities/my/{upstream,downstream}` returns the depth-1 neighbourhood; a maintainer reading DataEntityRelationsServiceImpl.java:34 alone would expect an empty result."
      confidence: STATIC-INFERRED
      evidence: "LineageDepth.java:16-18 + ReactiveLineageRepositoryImpl.java:241 + DataEntityRelationsServiceImpl.java:34"
  orderings:
    - location: "ReactiveLineageRepositoryImpl.java:180-181 and 202-203"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "`ORDER BY child_oddrn ASC` for DOWNSTREAM and `ORDER BY parent_oddrn ASC` for UPSTREAM (jOOQ default direction), applied to the `SELECT DISTINCT <that same column>` projection. No upstream layer wraps or re-orders the SQL."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:173, 180, 198, 202 + 210, 214"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "None is needed and none exists: the projection is DISTINCT on the single sort column, so equal keys cannot occur. The ordering is total and deterministic by construction — which is precisely what makes the truncated prefix reproducible across processes and re-runs."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:173+180, 198+202"
        - q: "Which subset is returned when the result-set exceeds the limit?"
          a: "The lexicographically smallest `limit` oddrns. Because an ODDRN begins with its data-source type, truncation is systematically biased toward alphabetically-early source types — a real property that neither Javadoc states."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:180, 202 + ReactiveLineageRepository.java:34-36"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Filter yes, re-sort no. MyDataScopeResolverImpl drops already-visited oddrns (MyDataScopeResolverImpl.java:148-150), truncates to `remaining` (line 147), accumulates into a LinkedHashSet, then maps to ids via listIdsByOddrnsExcludingOwnedBy and wraps in `Set.copyOf` (MyDataScopeResolverImpl.java:169) — which discards order. Order is irrelevant past that point because the ids are used as a semi-join scope, not as a result ordering."
          confidence: STATIC-INFERRED
          evidence: "MyDataScopeResolverImpl.java:145-159, 162-171 + AssetSearchServiceImpl.java:82-88"
    - location: "ReactiveLineageRepositoryImpl.java:128-130 (recursive-CTE outer select)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "NONE. `DSL.withRecursive(cte).selectDistinct(parent, child).from(cte)` has no ORDER BY at any layer, so row order is whatever the DISTINCT implementation yields (Postgres-implementation-defined)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:128-130"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — there is no sort key. The consumer does not depend on order: LineageServiceImpl collects the edges into a set of oddrns (LineageServiceImpl.java:100-108) before building the graph."
          confidence: STATIC-INFERRED
          evidence: "LineageServiceImpl.java:100-108"
        - q: "Which subset is returned when the result-set is large?"
          a: "All of it — there is no LIMIT anywhere on the CTE path. The result size is bounded only by the graph and the depth."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:123-133, 230-241"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "LineageServiceImpl merges the CTE result with the depth-1 expansion Flux and applies `.distinct()` in memory (LineageServiceImpl.java:100-101) — a dedup, not a re-sort."
          confidence: STATIC-INFERRED
          evidence: "LineageServiceImpl.java:98-103"
  auth_gates:
    - location: "ReactiveLineageRepositoryImpl.java:39-41"
      endpoint: "N/A — Spring @Repository, not on the HTTP surface"
      questions:
        - q: "What does this node return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Identical SQL in all four modes; the repository has no mode awareness. The ST-8 path differs BEFORE reaching it: AssetSearchServiceImpl gates on `authIdentityProvider.fetchAssociatedOwner()`, and when no owner resolves — the auth-DISABLED case, per the comment at AssetSearchServiceImpl.java:75-76 — the Mono is empty and `switchIfEmpty` returns an empty AssetList, so getNeighbourOddrnsFromOwnedSet is never invoked."
          confidence: STATIC-INFERRED
          evidence: "AssetSearchServiceImpl.java:74-91 + ReactiveLineageRepositoryImpl.java:39-41"
        - q: "What does an unauthenticated caller see?"
          a: "For the ST-8 search scope: an empty result list, never an unscoped full-catalog page (AssetSearchServiceImpl.java:90). For the lineage-canvas CTE path: unchanged — no owner gate at any layer."
          confidence: STATIC-INFERRED
          evidence: "AssetSearchServiceImpl.java:74-91 + ReactiveLineageRepositoryImpl.java:230-241"
        - q: "What does a wrong-role caller see?"
          a: "Both traversals are reads, and ODD is read-collaborative by design (only mutations are permission-gated — ADR-0003). No role check exists on either path and none is expected."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:1-244 (no @PreAuthorize, no permission call) + documentation/docs/developer-guides/architecture-decision-log/ADR-0003-read-collaborative-authorization.md"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "For ST-8: in the SERVICE (AssetSearchServiceImpl.java:77) for identity resolution, and additionally IN THE SQL (line 178) for scoping — the first time this file carries an owner predicate. The owner id can only ever be a server-resolved value; the spec states it explicitly ('The scope resolves server-side from the authenticated principal only — no owner identity is ever accepted from the request', components.yaml:2486-2487). For the CTE: nowhere."
          confidence: STATIC-INFERRED
          evidence: "AssetSearchServiceImpl.java:77-83 + ReactiveLineageRepositoryImpl.java:175-178 + odd-platform-specification/components.yaml:2486-2487"
  resource_boundaries:
    - location: "ReactiveLineageRepositoryImpl.java:182, 204"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No — both methods are pure SELECTs. But the WALK they compose is not atomic: up to 6 statements, 6 connection acquisitions (JooqReactiveOperations.java:45-48), no enclosing transaction on any node of the path, so a concurrent replaceLineagePaths (a DELETE then an INSERT, LineageServiceImpl.java:131-132) can be observed half-applied ACROSS hops."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:182, 204 + JooqReactiveOperations.java:44-49 + MyDataScopeResolverImpl.java:130-159 + LineageServiceImpl.java:124-133"
        - q: "Is the call replay-safe?"
          a: "Yes for a fixed graph: the same (ownerId, streamKind, limit) yields byte-identical output because the ordering is total. Asserted end-to-end at MyDataScopeResolverTest.java:146-180."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:173-181 + MyDataScopeResolverTest.java:166-179"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. `grep -n '@Cacheable' <odd-platform-repo>/.../repository/reactive/ReactiveLineageRepositoryImpl.java` and the same on MyDataScopeResolverImpl.java and AssetSearchServiceImpl.java return zero; every search request re-walks the graph from scratch."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:1-244 + MyDataScopeResolverImpl.java:1-181 + AssetSearchServiceImpl.java:40-93"
        - q: "When the 5s wall-clock budget cancels the chain, does the in-flight statement stop?"
          a: "PROBE-NEEDED. Reactor cancels the upstream subscription (MyDataScopeResolverImpl.java:103); whether r2dbc-postgresql issues a backend CancelRequest and whether the backend honours it mid-sort is not determinable from source. If it does not, each timed-out search leaves an orphaned backend finishing work nobody reads."
          confidence: PROBE-NEEDED
          evidence: "P-395"
    - location: "ReactiveLineageRepositoryImpl.java:44-60, 93-111"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "batchInsertLineages is idempotent on the (parent, child, establisher) PK via onDuplicateKeyIgnore (line 59). The delete+insert PAIR is atomic only under the caller's @ReactiveTransactional (LineageServiceImpl.java:125); two concurrent ingestions of the SAME establisher serialise on the row locks the DELETE takes."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:44-60 + V0_0_17__add_establisher_into_lineage.sql:116-117 + LineageServiceImpl.java:124-133"
        - q: "Is the call replay-safe?"
          a: "Yes — replaying the same payload re-deletes and re-inserts the same edges; ON CONFLICT DO NOTHING makes the insert leg idempotent. Note the RETURNING clause returns only ACTUALLY-inserted rows, so a replay returns fewer rows than the first run."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:59 + LineageRepositoryTest.java:66-81"
        - q: "If a cache fronts this, what is the TTL?"
          a: "No cache anywhere on the write path."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:1-244"
  request_inputs:
    - location: "ReactiveLineageRepositoryImpl.java:165"
      input_kind: local-variable
      input_name: "ownerId (long)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Restrict the walk to the lineage of the assets belonging to THIS owner."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:165 + the Javadoc at :153"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound to `OWNERSHIP.OWNER_ID.eq(ownerId)` inside the anchor subquery (line 178), which selects `data_entity.oddrn` for every row of `ownership` held by that owner (lines 175-177). Provenance chain: AssetSearchController.java:31 -> AssetSearchServiceImpl.java:77-79 (`authIdentityProvider.fetchAssociatedOwner()` -> `owner.getId()`) -> MyDataScopeResolverImpl.java:86, 142 -> here."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:175-178 + AssetSearchServiceImpl.java:77-79 + MyDataScopeResolverImpl.java:86, 142"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The parameter is the internal Owner id and it binds to the `ownership.owner_id` column of the same name and meaning. Note the ODD User-vs-Owner distinction: this is the internal Owner (resolved from the principal via user_owner_mapping upstream), not the external user identity — but the parameter name says `ownerId`, not `userId`, so the name is honest. This is the LSN-020 inverse of the Activity Feed's `userIds`."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:165, 178 + AssetSearchServiceImpl.java:77"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:175-178"
        - q: "Is there a column / field that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "`term_ownership.owner_id` (V0_0_35__add_terms.sql:30-41) is the same owner id on a parallel ownership table, and the spec's MY_OBJECTS definition covers 'terms via term_ownership' (components.yaml:2480-2481) — yet the anchor subquery reads only `ownership`. This is a STRUCTURALLY COMPLETE narrowing, not a gap: `term` has no `oddrn` column (V0_0_35__add_terms.sql:1-14) and none was ever added (grep for `ALTER TABLE term\\b|term.*oddrn` across the migration directory returns only created_at/updated_at/is_deleted changes), so a term can never appear in the oddrn-keyed `lineage` table and cannot anchor a lineage hop."
          confidence: STATIC-INFERRED
          evidence: "V0_0_35__add_terms.sql:1-14, 30-41 + odd-platform-specification/components.yaml:2480-2481 + ReactiveLineageRepositoryImpl.java:175-178"
      routes_to_finding: "implicit_adrs.[1] (the subquery decision); no bug entry — the name matches the column"
    - location: "ReactiveLineageRepositoryImpl.java:166, 191"
      input_kind: local-variable
      input_name: "streamKind (LineageStreamKind)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Which way along the arrow to walk — UPSTREAM toward producers, DOWNSTREAM toward consumers."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:166, 191"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Selects both the WHERE column and the SELECT column via anchorField/neighbourField (lines 171-172, 196-197 -> 209-215). DOWNSTREAM: WHERE parent_oddrn IN (...) SELECT child_oddrn. UPSTREAM: WHERE child_oddrn IN (...) SELECT parent_oddrn."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:171-172, 196-197, 209-215"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES, and is asserted end-to-end: MyDataScopeResolverTest.java:72-96 seeds U2->U1->A->D1->D2 with A owned and checks each direction independently."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:209-215 + MyDataScopeResolverTest.java:72-96"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "MyDataScopeResolverTest.java:84-93"
        - q: "Is there a column / field that DOES match the input's name and is NOT being used?"
          a: "NONE. The lineage table has exactly two directional columns and both are used."
          confidence: STATIC-INFERRED
          evidence: "V0_0_2__add_lineage.sql:1-7 + ReactiveLineageRepositoryImpl.java:209-215"
      routes_to_finding: "none"
    - location: "ReactiveLineageRepositoryImpl.java:167, 192"
      input_kind: local-variable
      input_name: "limit (int)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "At most this many neighbours come back."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:167, 181"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound as an explicit value into the SQL LIMIT (lines 181, 203) after a non-positive short-circuit."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:168-170, 181, 193-195, 203"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES for the row count. It does NOT bound the WORK — the caller reading `limit` as a cost control would be wrong, because the DISTINCT + ORDER BY must resolve the full matching set first. The name promises a result bound and delivers exactly that; the misreading risk is the caller's (MyDataScopeResolverImpl.java:135 computes `remaining` as a budget, which is a set-size budget, not a cost budget)."
          drift: MINOR
          confidence: PROBE-NEEDED
          evidence: "P-394"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An operator whose owned set touches a very-high-fan-out hub can hit the 5s wall-clock breaker (TIMEOUT, no scope at all) even though the node budget would have capped the RESULT at 10 000 — because shrinking `remaining` does not shrink the hop's cost."
          confidence: PROBE-NEEDED
          evidence: "P-394 + MyDataScopeResolverImpl.java:103-108, 135"
        - q: "Is there a column / field that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:173-181"
      routes_to_finding: "bugs_limitations_corner_cases (the LIMIT-bounds-rows-not-work entry) + performance.known_performance_gaps"
    - location: "ReactiveLineageRepositoryImpl.java:190"
      input_kind: local-variable
      input_name: "frontierOddrns (Collection<String>)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The current BFS frontier — the nodes discovered by the previous hop, from which this hop expands."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:186-187, 190"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`anchor.in(frontierOddrns)` (line 200), where anchor is parent_oddrn for DOWNSTREAM and child_oddrn for UPSTREAM. The caller passes `discovered` — the newly-seen nodes only, not the cumulative visited set (MyDataScopeResolverImpl.java:148-150, 158)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:200 + MyDataScopeResolverImpl.java:148-158"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:200 + MyDataScopeResolverImpl.java:158"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A. Note the size hazard is real though: the frontier can be up to 10 000 elements and is bound as a literal IN-list, unlike hop 1's subquery."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:200 vs 175-178 + MyDataScopeResolverImpl.java:135, 143"
        - q: "Is there a column / field that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "ReactiveLineageRepositoryImpl.java:198-203"
      routes_to_finding: "bugs_limitations_corner_cases (the 10 001-element IN-list entry)"
  probes_emitted:
    - probe_id: P-394
      question: "Does the LIMIT on the neighbour hop bound the WORK, or only the rows returned?"
      probe_path: "lineage/odd-platform/probes/P-394.yaml"
    - probe_id: P-395
      question: "When the 5s wall-clock budget cancels the walk, does the in-flight Postgres statement issued at lines 182/204 actually terminate?"
      probe_path: "lineage/odd-platform/probes/P-395.yaml"
  stress_summary:
    triggers_total: 16
    questions_total: 48
    answers_static_inferred: 45
    answers_probe_needed: 3
    answers_reference: 0
    drift_flags: 4          # 2 MINOR (getNeighbourOddrnsFromOwnedSet, anchorField/neighbourField) + 2 DRIFT_NAME_VS_BEHAVIOR (getLineageRelations(List), LineageDepth.empty)
```

## security

- auth_mode_relevance: INTERNAL_ONLY — a Spring `@Repository` (line 39) consumed only by service code; it is not on the HTTP surface and has no mode awareness. Mode DOES shape whether the ST-8 path executes at all: `AssetSearchServiceImpl.java:74-91` requires `authIdentityProvider.fetchAssociatedOwner()` to emit, and the code comment names the DISABLED case explicitly — "a My-data scope narrows to the caller's own world, so when no owner resolves (e.g. auth disabled) the whole result is empty, never a full-catalog page" (AssetSearchServiceImpl.java:75-76).
- ingestion_filter_relevance: N/A — repository, not HTTP. The write path (batchInsert/batchDelete) is reached FROM ingestion via LineageServiceImpl, but the `IngestionDataEntitiesFilter` operates on `POST /ingestion/entities`, well upstream.
- authorization_assertions: [] — no `@PreAuthorize`, no programmatic permission check, no `@Secured` anywhere in ReactiveLineageRepositoryImpl.java:1-244. Consistent with ADR-0003 read-collaborative authorization (reads are not permission-gated in ODD; only mutations are), so this is a posture, not a gap.
- owner_scoping: **MIXED — and this is what changed.**
  - `getNeighbourOddrnsFromOwnedSet` (lines 164-183): **RESPECTS, in the SQL.** `OWNERSHIP.OWNER_ID.eq(ownerId)` (line 178) is a server-supplied value that can never come from the request — the spec states it as a contract ("The scope resolves server-side from the authenticated principal only — no owner identity is ever accepted from the request", odd-platform-specification/components.yaml:2486-2487) and `AssetSearchServiceImpl.java:77-79` implements it. A crafted `my_data` payload cannot scope to another user's owned set because there is no field to carry one.
  - `getNeighbourOddrns` (lines 189-205): **INHERITS.** The frontier is owner-derived at hop 1 and never re-checked; the expansion itself is unscoped, by design — the whole point of the feature is to surface OTHER teams' assets adjacent to yours.
  - `lineageCte` / `getLineageRelations(Set, depth, kind)` (lines 123-133, 217-243): **BYPASSES** — unchanged. No owner column, no JOIN, only `is_deleted`. When called from DataEntityRelationsServiceImpl.java:34, scoping is the caller's anchor-set choice; when called from LineageServiceImpl.java:95-97 there is none at all.
- data_exposure: [
    "ST-8 path: the set of oddrns adjacent to the caller's owned assets, in either direction, up to 3 hops, capped at 10 000 nodes → the authenticated caller. This is INTENTIONAL cross-owner exposure: the feature exists to show which other teams' assets your data feeds and is fed by. It is a bounded, owner-anchored projection, unlike the canvas path.",
    "Canvas path (unchanged): the full reachable lineage subgraph from any single root, at any depth, to any caller who can reach the endpoint. The live API-reference page (WebFetch 2026-08-31, 200) documents this posture verbatim: 'Lineage reads are not access-controlled per owner.'",
    "Structural leakage: lineage edges encode causal connections. Knowing that entity X (team A) has a downstream child Y (team B) leaks the existence and shape of team B's pipeline even when team B's entities are not otherwise enumerable. The ST-8 filter makes this leakage EASIER to consume — it is now a first-class search facet rather than something you assemble by clicking through canvases — while simultaneously bounding it (3 hops, 10 000 nodes) in a way the canvas path is not."
  ]
- known_security_gaps: [
    "No JOIN-side owner filter on the recursive CTE — unchanged by CTRIB-062. The two traversals in this file now have OPPOSITE owner-scoping postures, and only the newer one carries the predicate in SQL. — evidence: ReactiveLineageRepositoryImpl.java:230-241 (no owner predicate) vs 175-178 (owner predicate) — severity: HIGH",
    "No depth ceiling on the CTE — `lineageDepth.getDepth()` flows straight into line 241 with no clamp, while the ST-8 path clamps to 3 (MyDataScopeResolverImpl.java:112-114). Combined with the absent cycle guard this remains a DoS-amplification vector, and CTRIB-062's own measurement quantifies it (depth 3 from 200 roots did not complete in 25 s). — evidence: ReactiveLineageRepositoryImpl.java:241 + MyDataScopeResolverImpl.java:26-28, 112-114 — severity: HIGH",
    "No statement_timeout at this repository — `jooqReactiveOperations.flux(query)` (lines 131, 182, 204) sets no per-statement timeout (JooqReactiveOperations.java:44-49). The ST-8 path has an APPLICATION-side 5s breaker (MyDataScopeResolverImpl.java:103) but whether it reaches the backend is unverified (P-395); the CTE path has no breaker at all. — evidence: ReactiveLineageRepositoryImpl.java:131, 182, 204 + JooqReactiveOperations.java:44-49 + MyDataScopeResolverImpl.java:103-108 — severity: MEDIUM"
  ]

## performance

- hot_paths: [
    "**ST-8 neighbour hops (lines 164-205) — up to 6 statements on EVERY search request that selects an Upstream/Downstream scope.** This is a per-keystroke-class path, not a per-navigation one, which is exactly why CTRIB-062 measured it before shipping (V0_0_101:12-18).",
    "Recursive-CTE traversal (lines 123-133) — per lineage-canvas open; cost grows with PATH count (measured: 130 000 intermediate rows for 800 nodes at depth 2 from 200 roots; no completion at depth 3 within 25 s — MyDataScopeResolverImpl.java:26-28)",
    "`getLineageRelationsForDepthOne` (lines 135-150) — per progressive-expansion click",
    "`getChildrenCount` + `getParentCount` (lines 73-91) — twice per canvas open, over the full result oddrn set",
    "`getTargetsCount` (lines 62-71) — per dataset-detail render (DataEntityServiceImpl.java:665)",
    "`batchInsertLineages` + `batchDeleteByEstablisherOddrn` (lines 44-60) — the highest-write path, once per ingested payload carrying lineage"
  ]
- throughput_characteristics: [
    "One SQL statement per public method — no per-row round-trip anywhere in the file.",
    "The ST-8 WALK, however, is ≤ 6 SEQUENTIAL statements per request (2 directions x 3 hops), each awaiting the previous (MyDataScopeResolverImpl.java:124-125, 158). Latency is additive, not parallel — directions are deliberately serialised so a shared budget cannot make the result depend on which direction ran first (MyDataScopeResolverImpl.java:116-117).",
    "Batch insert uses a single multi-row VALUES with `onDuplicateKeyIgnore` (lines 53-59) regardless of pojo count.",
    "Reactive Flux throughout; each call acquires a connection via `databaseClient.inConnectionMany` (JooqReactiveOperations.java:45-48), so one My-data search consumes up to 6 connection acquisitions serially."
  ]
- resource_allocation: [
    "ST-8 hop: a DISTINCT + Sort over the anchor's full fan-out. The LIMIT caps the rows returned, not the sort input (see P-394) — so `work_mem` pressure is a function of the hub's degree, not of the budget.",
    "ST-8 hops 2..n: up to 10 001 bind parameters in the IN-list (line 200), against Postgres's 65 535 ceiling. `JooqReactiveOperations.executeInPartition` (BATCH_SIZE 1000, JooqReactiveOperations.java:24, 51-67) is not applied.",
    "Recursive CTE: intermediate rows materialise in `work_mem`; the outer selectDistinct (lines 128-130) prunes only afterwards. The diamond/cycle amplification is O(paths), quantified above.",
    "JVM heap: `MyDataScopeResolverImpl` holds a `LinkedHashSet<String>` of up to 10 000 oddrns plus the per-hop `rows` list of up to 10 001 (MyDataScopeResolverImpl.java:145-151) — tens of KB per in-flight My-data search, not a concern in isolation but multiplied by concurrency.",
    "Network: each LineagePojo carries three unbounded varchar oddrns (V0_0_26__remove_length_constraints.sql:39) + a boolean; the ST-8 methods are leaner, returning a single string column (line 182, 204)."
  ]
- scaling_characteristics: [
    "Stateless repository — scales horizontally; Postgres is the bottleneck.",
    "The ST-8 walk is bounded by construction (3 hops, 10 000 nodes, 5s breaker) — the design property the CTE lacks. Bounded-by-construction is the reason the search filter could not reuse the CTE (MyDataScopeResolverImpl.java:24-29).",
    "No caching at this layer — `@Cacheable` appears nowhere in ReactiveLineageRepositoryImpl.java, MyDataScopeResolverImpl.java, or AssetSearchServiceImpl.java. Every search re-walks; the lineage table changes only on ingestion, so a short-TTL cache keyed on (ownerId, kind, depth) would absorb repeat searches and back-navigation.",
    "The UPSTREAM hop's performance is INDEX-DEPENDENT and newly so: without `lineage_child_oddrn` (V0_0_101:28) it degrades from 22.40 ms to 880.46 ms per hop on a 50 000-edge fixture — ~2.6 s for three upstream hops (V0_0_101:14-17)."
  ]
- known_performance_gaps: [
    "`ownership.owner_id` is unindexed, so the hop-1 anchor subquery's owner predicate cannot seek. Search roots named in the matching bugs entry. CTRIB-062 measured and fixed the `lineage` side of this join and left the `ownership` side unmeasured. — evidence: ReactiveLineageRepositoryImpl.java:175-178 + V0_0_3__add_ownership.sql:10-22 — severity: MEDIUM",
    "Hops 2..n bind a materialised IN-list of up to 10 001 elements while hop 1 deliberately uses a subquery. — evidence: ReactiveLineageRepositoryImpl.java:200 vs 175-178 + JooqReactiveOperations.java:51-67 — severity: MEDIUM",
    "The LIMIT bounds rows, not work: a shrinking `remaining` budget does not shrink hop cost. PROBE-NEEDED — P-394. — evidence: ReactiveLineageRepositoryImpl.java:173-181, 198-203 — severity: MEDIUM",
    "Budget is spent on neighbours that are then discarded (owned-by-caller neighbours), so a dense team can hit `truncated=true` with a small returned set. — evidence: ReactiveLineageRepositoryImpl.java:173 + MyDataScopeResolverImpl.java:145-153, 167 — severity: MEDIUM",
    "No upper bound on recursive-CTE depth; no cycle guard; measured non-completion at depth 3 on a dense graph. — evidence: ReactiveLineageRepositoryImpl.java:241, 230-241 + MyDataScopeResolverImpl.java:26-28 — severity: HIGH",
    "No covering index for the `is_deleted = false` read filter — a partial index `(parent_oddrn, child_oddrn) WHERE is_deleted = false` is declared in no migration (V0_0_79__data_deprecation.sql:11-12 adds the column only). Now on nine read sites including both ST-8 hops. — evidence: V0_0_79__data_deprecation.sql:11-12 + ReactiveLineageRepositoryImpl.java:179, 201 — severity: MEDIUM",
    "No caching on the ST-8 path — every search request re-walks up to 6 statements. — evidence: ReactiveLineageRepositoryImpl.java:164-205 + MyDataScopeResolverImpl.java:1-181 — severity: LOW",
    "Whether the 5s breaker actually releases the backend is unverified. PROBE-NEEDED — P-395. — evidence: MyDataScopeResolverImpl.java:103-108 + JooqReactiveOperations.java:44-49 — severity: MEDIUM"
  ]

## sources

All source citations are repo-relative to `<odd-platform-repo>`; the file under enrichment is
`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveLineageRepositoryImpl.java`
(cited below as the bare filename). Migrations are under `odd-platform-api/src/main/resources/db/migration/`.
Tests are under `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/`.

- understanding ← ReactiveLineageRepositoryImpl.java:1-244 (full read) + ReactiveLineageRepository.java:29-49 (interface contracts) + MyDataScopeResolverImpl.java:21-45 (the composing walk) + V0_0_101__lineage_child_oddrn_index.sql:1-28
- concepts.entities ← ReactiveLineageRepositoryImpl.java:21, 35-37, 173, 182, 198, 204, 217-243 + LineageDepth.java:1-19
- concepts.operations ← ReactiveLineageRepositoryImpl.java:44-243 (each method read in full)
- concepts.invariants ← ReactiveLineageRepositoryImpl.java:67, 78, 88, 117, 147, 179, 201, 209-215, 226-228, 234, 241 + LineageDepth.java:16-18 + MyDataScopeResolverImpl.java:148-153, 167 + ReactiveDataEntityRepositoryImpl.java:547-559 + MyDataScopeResolverTest.java:120-144 + V0_0_2__add_lineage.sql:1-7 + V0_0_17__add_establisher_into_lineage.sql:1-2, 116-117 + V0_0_79__data_deprecation.sql:11-12
- dependencies_semantic.requires-feature ← ReactiveLineageRepositoryImpl.java:123-133, 164-205 + Grep for `unified-asset-search|asset_search|AssetSearch` in `lineage/odd-platform/feature-flows/detail/` (zero files)
- dependencies_semantic.requires-config-schema ← V0_0_101__lineage_child_oddrn_index.sql:1-28
- dependencies_semantic.requires-runtime ← ReactiveLineageRepositoryImpl.java:39-42, 48, 69, 80, 90, 99, 109, 120, 131, 148, 182, 204 + JooqReactiveOperations.java:28, 44-49 + Grep `lineageRepository\.|reactiveLineageRepository\.` across `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/` (11 hits / 5 files)
- dependencies_semantic.couples-to ← ReactiveLineageRepositoryImpl.java:35-37, 142-146, 175-178 + V0_0_3__add_ownership.sql:10-22 + MyDataScopeResolverImpl.java:130-159
- upstream_callers.* ← Grep `lineageRepository\.|reactiveLineageRepository\.` across `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/` + per-line reads of MyDataScopeResolverImpl.java:86-159, AssetSearchServiceImpl.java:40-93, AssetSearchController.java:25-33, LineageServiceImpl.java:66, 87-133, DataEntityRelationsServiceImpl.java:34, DataEntityServiceImpl.java:665, DataEntityInternalStateServiceImpl.java:126, 133
- downstream_side_effects.* ← ReactiveLineageRepositoryImpl.java:44-243 (each method body) + JooqReactiveOperations.java:44-49 + MyDataScopeResolverImpl.java:130-159 + LineageServiceImpl.java:124-133
- tests_coverage_semantic.covered_behaviours ← LineageRepositoryTest.java:47-311 + MyDataScopeResolverTest.java:53-231 (each @Test read)
- tests_coverage_semantic.uncovered_behaviours ← Grep `getNeighbourOddrns|getNeighbourOddrnsFromOwnedSet` across `<odd-platform-repo>` `--include=*.java` (7 hits, all in `src/main/java`; zero in `src/test/java`) + absence inspection of LineageRepositoryTest.java:29-311 (7 @Test methods enumerated) and MyDataScopeResolverTest.java:53-231
- docs_link_semantic.inferred_docs.[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` 2026-08-31, status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` 2026-08-31, status 200
- docs_link_semantic.inferred_docs.[2] ← contributor/CTRIB-062.md:17, 470-475 (docs_routing + the authoring plan); no live fetch, per the release-train marker
- docs_link_semantic.doc_drift_findings.[0] ← odd-platform-specification/openapi.yaml:1597, 1601-1608, 1632 + ReactiveLineageRepositoryImpl.java:241 + the api-reference WebFetch above
- docs_link_semantic.doc_drift_findings.[1] ← the features/data-lineage WebFetch above + ReactiveLineageRepositoryImpl.java:175-178 + DataEntityRelationsServiceImpl.java:25-39
- docs_link_semantic.doc_drift_findings.[2] ← the features/data-lineage WebFetch above + Grep `my_data|MY_OBJECTS|upstream_depth` across `<documentation-repo>/docs/` (3 hits, all in ADR-0022, all about the ACTIVITY feed) + contributor/CTRIB-062.md:17
- docs_link_semantic.doc_drift_findings.[3] ← ReactiveLineageRepositoryImpl.java:235-241 + MyDataScopeResolverImpl.java:148-153 + the features/data-lineage WebFetch (explicit "no discussion of cycles")
- implicit_adrs.[0] ← ReactiveLineageRepositoryImpl.java:164-205, 217-243 + MyDataScopeResolverImpl.java:24-29
- implicit_adrs.[1] ← ReactiveLineageRepositoryImpl.java:155-158, 175-178 + MyDataScopeResolverTest.java:182-212
- implicit_adrs.[2] ← ReactiveLineageRepositoryImpl.java:180, 202 + ReactiveLineageRepository.java:34-36
- implicit_adrs.[3] ← ReactiveLineageRepositoryImpl.java:207-215, 226-228
- implicit_adrs.[4] ← V0_0_101__lineage_child_oddrn_index.sql:1-28
- implicit_adrs.[5] ← ReactiveLineageRepositoryImpl.java:67, 78, 88, 93-111, 117, 147, 179, 201, 234, 241 + V0_0_79__data_deprecation.sql:11-12
- implicit_adrs.[6] ← ReactiveLineageRepositoryImpl.java:44-60 + LineageServiceImpl.java:124-133
- implicit_adrs.[7] ← V0_0_17__add_establisher_into_lineage.sql:1-2, 116-119 + ReactiveLineageRepositoryImpl.java:44-49
- bugs_limitations_corner_cases.[0] ← ReactiveLineageRepositoryImpl.java:173-181 + MyDataScopeResolverImpl.java:145-159, 162-171 + ReactiveDataEntityRepositoryImpl.java:547-559 + MyDataScopeResolverTest.java:98-118
- bugs_limitations_corner_cases.[1] ← ReactiveLineageRepositoryImpl.java:182, 204 + MyDataScopeResolverImpl.java:130-159 + JooqReactiveOperations.java:44-49 + LineageServiceImpl.java:124-133
- bugs_limitations_corner_cases.[2] ← ReactiveLineageRepositoryImpl.java:198-203 vs 173-181 + MyDataScopeResolverImpl.java:135-147 + JooqReactiveOperations.java:24, 51-67 + the features/data-lineage WebFetch
- bugs_limitations_corner_cases.[3] ← ReactiveLineageRepositoryImpl.java:180, 202 + ReactiveLineageRepository.java:34-36
- bugs_limitations_corner_cases.[4] ← ReactiveLineageRepositoryImpl.java:173-181, 198-203 + V0_0_101__lineage_child_oddrn_index.sql:28
- bugs_limitations_corner_cases.[5] ← ReactiveLineageRepositoryImpl.java:175-179 + DataEntityInternalStateServiceImpl.java:126 + MyDataScopeResolverTest.java:267-274
- bugs_limitations_corner_cases.[6] ← ReactiveLineageRepositoryImpl.java:175-178 + V0_0_3__add_ownership.sql:10-22 + V0_0_101__lineage_child_oddrn_index.sql:8-10 + Grep `ON ownership|INDEX.*ownership` in the migration directory (only term_ownership hits) + Grep `CREATE INDEX` in `odd-platform-api/src/main/java/` (zero)
- bugs_limitations_corner_cases.[7] ← ReactiveLineageRepositoryImpl.java:128-130, 230-241 + MyDataScopeResolverImpl.java:24-29
- bugs_limitations_corner_cases.[8] ← ReactiveLineageRepositoryImpl.java:241 + LineageDepth.java:12-14 + MyDataScopeResolverImpl.java:53, 111-114
- bugs_limitations_corner_cases.[9] ← ReactiveLineageRepositoryImpl.java:230-241 + V0_0_2__add_lineage.sql:1-7 + DataEntityRelationsServiceImpl.java:25-39
- bugs_limitations_corner_cases.[10] ← ReactiveLineageRepositoryImpl.java:138-140, 168-170, 193-195 vs 123-133
- bugs_limitations_corner_cases.[11] ← ReactiveLineageRepositoryImpl.java:113-121 + LineageRepositoryTest.java:111-128
- bugs_limitations_corner_cases.[12] ← LineageDepth.java:16-18 + ReactiveLineageRepositoryImpl.java:217-243 + DataEntityRelationsServiceImpl.java:34
- bugs_limitations_corner_cases.[13] ← ReactiveLineageRepositoryImpl.java:97, 107 + V0_0_101__lineage_child_oddrn_index.sql:20-23
- bugs_limitations_corner_cases.[14] ← ReactiveLineageRepositoryImpl.java:39-41, 44-60 + LineageServiceImpl.java:124-133
- stress_findings.tunables ← ReactiveLineageRepositoryImpl.java:168-170, 181, 193-195, 200, 203, 221, 238, 241 + MyDataScopeResolverImpl.java:53-57, 70-83, 103-108, 135-146
- stress_findings.name_behavior_pairs ← ReactiveLineageRepositoryImpl.java:113-121, 164-183, 189-215, 226-241 + LineageDepth.java:16-18 + LineageRepositoryTest.java:130-281 + MyDataScopeResolverTest.java:120-144
- stress_findings.orderings ← ReactiveLineageRepositoryImpl.java:128-130, 173, 180, 198, 202 + MyDataScopeResolverImpl.java:145-171 + LineageServiceImpl.java:98-108
- stress_findings.auth_gates ← ReactiveLineageRepositoryImpl.java:39-41, 175-178, 230-241 + AssetSearchServiceImpl.java:74-91 + odd-platform-specification/components.yaml:2486-2487 + documentation ADR-0003
- stress_findings.resource_boundaries ← ReactiveLineageRepositoryImpl.java:44-60, 93-111, 182, 204 + JooqReactiveOperations.java:44-49 + MyDataScopeResolverImpl.java:103-108, 130-159 + MyDataScopeResolverTest.java:146-180
- stress_findings.request_inputs ← ReactiveLineageRepositoryImpl.java:165-215 + AssetSearchServiceImpl.java:77-79 + MyDataScopeResolverImpl.java:86, 135-158 + V0_0_35__add_terms.sql:1-14, 30-41 + odd-platform-specification/components.yaml:2480-2481, 2486-2487
- security.auth_mode_relevance ← ReactiveLineageRepositoryImpl.java:39 + AssetSearchServiceImpl.java:74-91
- security.owner_scoping ← ReactiveLineageRepositoryImpl.java:175-178 (RESPECTS) vs 189-205 (INHERITS) vs 230-241 (BYPASSES) + AssetSearchServiceImpl.java:77-79 + odd-platform-specification/components.yaml:2486-2487 + DataEntityRelationsServiceImpl.java:25-39
- security.data_exposure ← ReactiveLineageRepositoryImpl.java:164-205, 230-241 + MyDataScopeResolverImpl.java:53-57 + the api-reference WebFetch 2026-08-31
- security.known_security_gaps ← ReactiveLineageRepositoryImpl.java:131, 175-178, 182, 204, 230-241 + JooqReactiveOperations.java:44-49 + MyDataScopeResolverImpl.java:26-28, 103-114
- performance.hot_paths ← ReactiveLineageRepositoryImpl.java:44-205 + V0_0_101__lineage_child_oddrn_index.sql:4-18 + MyDataScopeResolverImpl.java:26-28 + DataEntityServiceImpl.java:665
- performance.throughput_characteristics ← ReactiveLineageRepositoryImpl.java:53-59, 164-205 + MyDataScopeResolverImpl.java:116-125, 158 + JooqReactiveOperations.java:44-49
- performance.resource_allocation ← ReactiveLineageRepositoryImpl.java:128-130, 173-181, 198-203 + MyDataScopeResolverImpl.java:135, 143-151 + JooqReactiveOperations.java:24, 51-67 + V0_0_26__remove_length_constraints.sql:39
- performance.scaling_characteristics ← ReactiveLineageRepositoryImpl.java:1-244 (no @Cacheable) + MyDataScopeResolverImpl.java:1-181 + AssetSearchServiceImpl.java:40-93 + V0_0_101__lineage_child_oddrn_index.sql:14-17, 28
- performance.known_performance_gaps ← the corresponding bugs entries above + V0_0_79__data_deprecation.sql:11-12
- probes ← lineage/odd-platform/probes/P-394.yaml, lineage/odd-platform/probes/P-395.yaml (next free ids: Glob `lineage/odd-platform/probes/P-2[5-9]*.yaml` returned no files; the highest existing id is P-249)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM — the two live pages were fetched this session at status 200, but the excerpts are as reported by the WebFetch summariser rather than raw HTML, and the third entry (the ST-8 search docs) is release-train gated and therefore unverifiable live by construction.
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH — except the LIMIT-bounds-rows-not-work entry, which is MEDIUM pending P-394.
- security: HIGH
- performance: MEDIUM — the index and CTE numbers are quoted from CTRIB-062's own plan-time measurement (recorded verbatim in V0_0_101 and MyDataScopeResolverImpl's Javadoc), not re-measured in this session; the two open cost questions are P-394 / P-395.
- stress_findings: HIGH — 45 of 48 answers are STATIC-INFERRED with file:line evidence; the 3 PROBE-NEEDED answers are genuinely runtime-only (query plan, statement cancellation) and both carry emitted probes.

## Maintainer notes

<!-- Empty on initial enrichment. Preserved verbatim across future refreshes. -->

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py. P-394 and P-395 were emitted by this
     enrichment pass (2026-08-31) and are pending; when they run, flip the corresponding
     stress_findings answers from PROBE-NEEDED to PROBE-VERIFIED with the measured values inlined. -->
