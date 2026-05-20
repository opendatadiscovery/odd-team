## ADR-CANDIDATE-191 — Establisher-keyed lineage replacement convention — every lineage edge produced from a re-ingested entity carries `establisher_oddrn = thisDtoOddrn`; downstream `replaceLineagePaths` DELETEs every prior edge keyed by establisher and INSERTs the new set — the entity OWNS its outgoing lineage for atomic replacement

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate establisher-keyed ownership convention)
**Pillars affected**: [P-05-data-lineage (the lineage replacement model), P-10-integrations-ingestion (the assembly site for the establisher key)]
**Support count**: 1 sidecar PRIMARY SOURCE (batch Z IngestionServiceImpl) + cross-batch corroboration with batch-I LineageServiceImpl + LineageIngestionRequestProcessor as the downstream destructive verb
**Axes present**: services (the IngestionServiceImpl class)
**Batch**: Z (2026-05-20)

**Surfaced by**:
- `IngestionServiceImpl.md:implicit_adrs.[2]` (HIGH) — "The `establisher_oddrn` is hard-coded to the DTO's own ODDRN on every lineage edge produced in `extractLineageRelations` (line 243 for DATA_SET parent edge, line 253 for DATA_TRANSFORMER source edge, line 260 for DATA_TRANSFORMER target edge, line 269 for DATA_CONSUMER input edge). This is the structural enactment of the **establisher-keyed atomic-rewrite** invariant (sibling `LineageServiceImpl.md` implicit_adrs[1] from batch I). The decision is: 'the entity that introduces an edge OWNS that edge for replacement purposes' — on every re-ingestion of this entity, every edge it established last time is REPLACED by the edges in the new payload." — intent_anchor: the consistent `setEstablisherOddrn(dtoOddrn)` pattern is itself the architectural opinion — the alternative (using parent or child as establisher) was not chosen — confidence: HIGH
- `IngestionServiceImpl.md:concepts.invariants.[8]` (HIGH) — "Lineage extraction (`extractLineageRelations` line 233-274) is driven by ENTITY CLASSES, not by entity type. A single entity that is BOTH `DATA_SET` and `DATA_CONSUMER` (multi-class entities exist in the contract) will produce lineage edges from BOTH branches: parentDatasetOddrn from the DATA_SET branch (line 238-246) AND inputList from the DATA_CONSUMER branch (line 264-271). `DATA_TRANSFORMER` produces edges from BOTH sourceList and targetList (line 248-262). The `establisherOddrn` is always the DTO's own ODDRN (line 243, 253, 260, 269) — meaning a lineage edge 'established by' this entity will be REPLACED on next ingestion of this entity (per LineageService.replaceLineagePaths batchDeleteByEstablisherOddrn at LineageServiceImpl.java:131). This is the **assembly-layer** enactment of F-008's `silent_destruction_replace_not_merge` drift facet — the destructive verb lives downstream in LineageIngestionRequestProcessor, but the establisher-keyed payload that DRIVES the destruction is built right here at line 243/253/260/269."

**Decision statement**: ODD's data-entity ingestion (`POST /ingestion/entities`) applies an ESTABLISHER-KEYED LINEAGE REPLACEMENT convention: every lineage edge produced from a re-ingested entity carries `establisher_oddrn = thisDtoOddrn`. The downstream `LineageServiceImpl.replaceLineagePaths` (LineageServiceImpl.java:124-133) DELETEs every prior edge keyed by establisher AND inserts the new set in one atomic step inside the outer `@ReactiveTransactional` boundary (per ADR-CANDIDATE-190).

The architectural commitments:

1. **The entity OWNS its outgoing lineage edges.** `IngestionServiceImpl.extractLineageRelations` (lines 233-274) emits four lineage-edge shapes from a single entity:
   - `DATA_SET` → parent-dataset edge (line 238-246) — establisher = this DTO's ODDRN
   - `DATA_TRANSFORMER` → source-list edges (line 248-256) — establisher = this DTO's ODDRN
   - `DATA_TRANSFORMER` → target-list edges (line 258-262) — establisher = this DTO's ODDRN
   - `DATA_CONSUMER` → input-list edges (line 264-271) — establisher = this DTO's ODDRN

   Every `setEstablisherOddrn(...)` call uses `dto.getOddrn()` — the SAME entity that built the edge. The alternative (using parent or child as establisher) was not chosen.

2. **Replace, not merge.** On every re-ingestion of an entity, ALL prior edges that this entity established are DELETED (via `batchDeleteByEstablisherOddrn` at LineageServiceImpl.java:131) before the new edges from the current payload are inserted. A collector that previously emitted edges A→B and A→C but on re-ingest only emits A→B SILENTLY REMOVES A→C. There is no `keep_existing_edges` flag, no merge mode, no "delta-only" intent declaration. The F-008 detail YAML facet `silent_destruction_replace_not_merge` is enforced at THIS line.

3. **The convention is consistent across all four edge shapes.** Four sites (lines 243, 253, 260, 269) — identical pattern: `setEstablisherOddrn(dto.getOddrn())`. There is no exception, no carve-out, no comment defending the choice. The CONSISTENCY across all four branches is the architectural opinion — a future maintainer wanting to introduce a different establisher convention (e.g. parent-as-establisher for transitive ownership) would have to confront FOUR consistent sites + the downstream `replaceLineagePaths` query shape (LineageServiceImpl.java:124-133) + the LineageIngestionRequestProcessor (LineageIngestionRequestProcessor.java:17) + the SQL substrate (`batchDeleteByEstablisherOddrn` at ReactiveLineageRepositoryImpl).

4. **Multi-class entities produce edges from MULTIPLE branches.** An entity that is BOTH `DATA_SET` and `DATA_CONSUMER` (multi-class entities are first-class in the contract) emits edges from BOTH branches — and ALL of them carry the SAME `establisher_oddrn`. Removing the entity's `DATA_CONSUMER` class on re-ingest SILENTLY REMOVES the input-list edges WHILE the parent-dataset edge from the `DATA_SET` branch persists. The replacement primitive is per-establisher, not per-edge-type.

5. **The destructive verb lives downstream.** `IngestionServiceImpl.extractLineageRelations` BUILDS the establisher-keyed payload; the destructive verb (DELETE-by-establisher then INSERT) lives at `LineageServiceImpl.replaceLineagePaths` invoked by `LineageIngestionRequestProcessor.java:17`. The composition is: this ADR documents the ASSEMBLY convention; the downstream processor + service applies it. Per-batch atomicity (ADR-CANDIDATE-190) bounds the destruction within one transaction.

The decision has SECURITY consequences under the bundled defaults:
- Under `auth.ingestion.filter.enabled=false` (default), an unauthenticated caller submitting a `DataEntityList` with the SAME ODDRN as an existing entity but EMPTY lineage fields TRIGGERS the silent deletion of all prior edges established by that entity (per REFACTOR-185's 17-sidecar enumeration + F-008's `destruction_under_default_off_auth` facet).
- The destruction is FORENSICALLY SILENT — no activity log entry (per REFACTOR-544's @Slf4j-unused finding), no audit trail, no operator-visible signal.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - The four consistent `setEstablisherOddrn(dto.getOddrn())` sites at lines 243, 253, 260, 269 — identical pattern, no exceptions, no comments defending alternatives.
   - The downstream `replaceLineagePaths` shape at LineageServiceImpl.java:124-133 (sibling LineageServiceImpl sidecar's implicit_adrs[1]) explicitly uses `batchDeleteByEstablisherOddrn` — the downstream query depends on this convention.
   - The contract-side model carries `establisher_oddrn` as a first-class column on `lineage` (LineagePojo) — the convention is schema-encoded, not implementation-detail.
2. **Structural impact?** YES — every future lineage-related feature must respect the establisher-keyed primitive; changing to a different convention requires reshaping the assembly + the SQL + the processor; the F-008 destructive surface depends on this.
3. **Refactoring or structural?** STRUCTURAL — moving to a merge-not-replace model would require redesigning the per-batch delete semantics, the partial-state handling, the establisher-vs-edge-key SQL primitive. Not a refactor.

**Existing ADR**: none in `adrs/`. Composes deeply with ADR-CANDIDATE-190 NEW batch Z (single-transaction-per-batch atomicity — the txn boundary inside which this destruction runs), the sibling LineageServiceImpl sidecar's `implicit_adrs[1]` (the DOWNSTREAM destructive-verb framing — this ADR is the ASSEMBLY-SIDE framing), and the F-008 detail YAML drift facet `silent_destruction_replace_not_merge` (the operator-visible consequence framing).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-544 NEW batch Z (3 NEW IngestionServiceImpl F-008 drift facets including silent destructive paths with no log — establisher-keyed deletion runs without any operator-visible signal; MEDIUM; closely linked to this ADR)
- F-008 detail YAML drift facets: `silent_destruction_replace_not_merge`, `destruction_under_default_off_auth`, `lineage_edge_replacement_no_audit`
- REFACTOR-185 STRENGTHENED batch Z (the destructive surface is anonymously reachable under bundled defaults — the establisher-keyed deletion is the destructive verb that the unauthenticated POST triggers)

**Proposed action**: Promote to `adrs/drafts/establisher-keyed-lineage-replacement.md` (new ADR). Document the four assembly sites + the downstream replace primitive + the multi-class edge composition + the F-008 destruction consequence under bundled defaults. Cross-link with ADR-CANDIDATE-190 (the txn boundary) and the LineageServiceImpl sidecar (the downstream verb). Doc-side: the live `/features/data-lineage` page MUST surface the "re-ingestion replaces, does NOT merge" caveat — operators integrating custom collectors should know that omitting an edge from a subsequent payload silently deletes it.

**Severity rationale**: HIGH — defines the platform's lineage atomicity + replacement model; the destructive verb that drives F-008's `silent_destruction_replace_not_merge` facet; serves as the structural guard against scope-expansion ("let me add a merge-mode flag" requires re-engaging the establisher-keyed convention); cross-references the highest-severity gaps in the F-008 destructive surface (REFACTOR-185 default-off-auth + REFACTOR-544 silent destructive paths).

---
