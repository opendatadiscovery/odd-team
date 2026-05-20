## ADR-CANDIDATE-190 — `IngestionServiceImpl.ingest(...)` `@ReactiveTransactional` outer-txn binds the WHOLE 14-processor chain + OTLP export as ONE atomic batch — single-transaction-per-batch is the F-008 atomicity enforcement point

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate atomicity-across-the-pipeline stance; the F-008 5-vertex picture's service-tier load-bearing structural decision)
**Pillars affected**: [P-10-integrations-ingestion (the ingestion pipeline shape), P-07-active-platform-features (alerts derived from ingestion roll into the same txn), P-05-data-lineage (lineage replace-by-establisher inside the same txn), P-04-data-quality (DQ test results materialised inside the same txn)]
**Support count**: 1 sidecar PRIMARY SOURCE (batch Z IngestionServiceImpl) + cross-batch corroboration with the F-008 detail YAML facets index + batch-I IngestionService (interface-axis sibling) + batch-H/R ReactiveDataEntityRepositoryImpl + batch-O IngestionDataEntitiesFilter (the 5-vertex closure)
**Axes present**: services (the IngestionServiceImpl class)
**Batch**: Z (2026-05-20)

**Surfaced by**:
- `IngestionServiceImpl.md:concepts.invariants.[0]` (HIGH) — "`ingest(...)` is `@ReactiveTransactional` (line 66, expanded via ReactiveTransactional.java:11 to `@Transactional(\"reactiveTransactionManager\")`); `ingestStats(...)` is NOT (line 76-79 carries only `@Override`). Two different transactional boundaries for the two methods on the same interface. The `@ReactiveTransactional` here is the **outer** transaction binding the WHOLE 14-processor chain (per F-008 chain hop-3) + the OTLP export — one failure anywhere rolls back the entire batch (the `batch_atomicity_without_signal` F-008 drift facet enforced at THIS line)." — intent_anchor: IngestionServiceImpl.java:66 `@ReactiveTransactional` annotation immediately above the `ingest` method; ReactiveTransactional.java:11 expands to `@Transactional("reactiveTransactionManager")`
- `IngestionServiceImpl.md:implicit_adrs.[0]` (HIGH) — "Private orchestration helper `persistDataEntities(long, List<DataEntity>)` is the composition seam — `ingest(...)` (line 65-74) is intentionally a five-step reactive chain, and ALL of the persistence work (JOB_RUN split, ODDRN dedup, partition, bulkUpdate/bulkCreate, restore, delta calculation, IngestionRequest assembly) is delegated to ONE private method (line 81-152)." — intent_anchor: the consistent shape (one public `ingest`, one private `persistDataEntities`, one private `buildIngestionRequest`, four pure-function `extract*Relations` helpers, one pure-function `calculateTotalDeltaCount` with its `calculateDeltaValues` sub-helper) IS the architectural opinion
- `IngestionServiceImpl.md:dependencies_semantic.requires-feature.OTLPMetricService` (HIGH) — "`OTLPMetricService.exportMetrics(IngestionRequest)` (line 56 + line 72) — terminal step. Interface OTLPMetricService.java:6-8. Inside the outer `@ReactiveTransactional` boundary — OTLP export is bound to txn commit. A network failure on OTLP rollbacks the whole ingestion. F-008 drift facet `otlp_export_inside_transaction` enacted at THIS line"
- `IngestionServiceImpl.md:dependencies_semantic.requires-feature.IngestionProcessorChain` (HIGH) — "`IngestionProcessorChain.processIngestionRequest(IngestionRequest)` (line 55 + line 71) — the 14-processor chain entry point. Phase ordering by TreeMap of `IngestionProcessingPhase.order` (INITIAL=1, MAIN=2, FINALIZING=3 per IngestionProcessingPhase.java:7-10). Within a phase, `Mono.zip` runs processors concurrently (IngestionProcessorChain.java:36); between phases, `.concatMap` enforces ordering (line 39)."

**Decision statement**: ODD's data-entity ingestion (`POST /ingestion/entities` → `IngestionService.ingest(DataEntityList)`) is governed by a SINGLE-TRANSACTION-PER-BATCH atomicity stance. The `@ReactiveTransactional` annotation at `IngestionServiceImpl.java:66` (expanded via `ReactiveTransactional.java:11` to `@Transactional("reactiveTransactionManager")`) is the OUTER transaction that binds:

1. **Datasource resolution + row lock** (`getIdByOddrnForUpdate` at line 68) — `SELECT id FROM data_source WHERE oddrn=? AND deleted_at IS NULL FOR UPDATE` — serialises concurrent ingestions targeting the same datasource for the duration of the batch.

2. **The full `persistDataEntities` orchestration** (lines 81-152): JOB_RUN partition + ODDRN-dedup map + listByOddrns (hollow+deleted=true) + new/existing partition + specific-attributes-deltas excluding MICROSERVICE + bulkUpdate + bulkCreate-and-enrich + restoreDeletedDataEntityRelations + calculateTotalDeltaCount + buildIngestionRequest.

3. **The 14-processor chain** (`IngestionProcessorChain.processIngestionRequest` at line 71) — three phases (INITIAL → MAIN → FINALIZING) running across 14 `IngestionRequestProcessor` beans, including MetadataIngestionRequestProcessor (silent delete-on-absence), LineageIngestionRequestProcessor (replace-by-establisher), DatasetStructureIngestionRequestProcessor (FTS recompute), AlertIngestionRequestProcessor (BIS-alert derivation), and 10 others.

4. **OTLP metric export** (`OTLPMetricService.exportMetrics` at line 72) — the terminal step. The OTLP write itself runs INSIDE the txn boundary; a network failure on OTLP rolls back the entire ingestion's DB writes.

The architectural commitments:

- **(a) Atomic batches.** A failure anywhere in steps 1-4 rolls back ALL DB writes from this request. Operators reading the F-008 5-vertex picture see "an ingestion either completes fully or appears never to have happened" — there is no half-applied batch. This is the F-008 detail YAML facet `batch_atomicity_without_signal` enforced at THIS line.

- **(b) Single-method exception scope = entire batch.** Any RuntimeException thrown by any processor / any repository / any extractor inside this `@ReactiveTransactional` boundary aborts the WHOLE transaction. There is NO per-entity isolation, NO partial-success mode, NO "skip the bad one and continue" mechanism. The F-008 drift facet `no_partial_success` is enforced HERE.

- **(c) Datasource-row-lock serialisation.** Concurrent ingestions targeting the SAME datasource serialise on the `data_source` row lock acquired at line 68. The lock is held until the outer txn commits — i.e. through the 14-processor chain + OTLP export. Cross-datasource ingestions DO run concurrently. The lock duration scales with payload size + processor chain latency + Postgres write throughput; an unhealthy DB amplifies the serialisation cost.

- **(d) `ingestStats` is INTENTIONALLY OUTSIDE the boundary.** The sibling method `IngestionServiceImpl.ingestStats(DatasetStatisticsList)` at line 76-79 is a one-line delegate with NO `@ReactiveTransactional` annotation. The transaction shape of stats ingestion lives downstream at `DatasetFieldServiceImpl.updateStatistics` (line 159). The asymmetry is deliberate: data-entity ingestion is the multi-table, multi-processor, multi-side-effect path that requires atomicity; stats ingestion is a per-field bulkUpdate within ONE table's surface area, transactional at the deepest layer. The shape is not consistent — but the shape IS the architectural opinion.

- **(e) OTLP export inside the transaction is an accepted trade-off.** A network call inside a DB transaction is a known anti-pattern (holds Postgres connections idle for the OTLP round-trip). The maintainer accepted this because: under the bundled `metrics.export.enabled: false` default (application.yml:158-163), `NoOpOTLPMetricService` is wired and the call is a no-op; under operator opt-in, the OTLP cost is bounded and consistent with the per-batch atomicity stance (an OTLP metric should not record an ingestion that didn't happen, and an ingestion shouldn't commit if its metric export failed). The trade-off is documented at F-008's `otlp_export_inside_transaction` drift facet.

The decision composes with the F-008 5-vertex picture:
- **Hop-0**: `IngestionDataEntitiesFilter` (batch O — default-OFF) governs WHO can enter this transaction.
- **Hop-1**: `IngestionController.postDataEntityList` (batch F) is the HTTP entry; no principal extraction.
- **Hop-2 (THIS sidecar)**: `IngestionServiceImpl.ingest` is the OUTER TRANSACTION binding point.
- **Hop-3**: The 14-processor chain runs INSIDE this transaction.
- **Hop-4**: The repository tier (`ReactiveDataEntityRepositoryImpl`, `ReactiveLineageRepositoryImpl`, `ReactiveDataSourceRepositoryImpl`) provides the SQL substrate; the row lock at line 68 is the serialisation primitive.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — four independent commitments:
   - The `@ReactiveTransactional` annotation lives at the SERVICE layer (not at controller, not at processor) — the outer boundary is deliberate and singular.
   - The `ingestStats` sibling INTENTIONALLY omits the annotation — the asymmetry confirms the maintainer's choice to scope the outer txn to the multi-processor path.
   - The OTLP export INSIDE the transaction (vs the easier path of "fire OTLP after commit") — accepted operational cost confirms the atomicity stance trumps the network-in-txn anti-pattern.
   - The data_source FOR UPDATE row lock at line 68 — the serialisation primitive chosen for cross-collector concurrency.
2. **Structural impact?** YES — every future ingestion-related feature (a new processor, a new side effect, a partial-success-mode proposal) must contend with the atomicity stance; every operator's deployment topology depends on this for partial-failure semantics; the F-008 destruction surface (silent metadata-delete + silent lineage-replace) is BOUNDED by this transaction (a destructive write that fails on commit is rolled back; under bundled defaults the destructive write that SUCCEEDS commits to disk with no audit).
3. **Refactoring or structural?** STRUCTURAL — moving to per-entity transactions or 202-Accepted-queue mode would require reshaping the processor chain, the OTLP export, the row lock, the alert derivation. Not a refactor.

**Existing ADR**: none in `adrs/`. Composes deeply with ADR-CANDIDATE-027 (ingestion auth trust gradient — `IngestionDataEntitiesFilter` is the upstream defender of this transaction's reachability), ADR-CANDIDATE-061 (ingestion controller-side semantic validation — the pre-transaction empty-payload guard), ADR-CANDIDATE-142 (UPSERT-by-ODDRN partial-merge — the persistence convention applied inside this transaction), ADR-CANDIDATE-190's sibling ADR-CANDIDATE-191 NEW batch Z (establisher-keyed lineage replacement — the destructive verb whose replacement runs inside this transaction).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-544 NEW batch Z (3 NEW IngestionServiceImpl F-008 drift facets — duplicate-ODDRN crash via `Collectors.toMap` default-throw merger + null entity_class_ids NPE in new-pojo path + @Slf4j unused / silent destructive paths; MEDIUM)
- REFACTOR-185 STRENGTHENED batch Z (DISABLED + ingestion-filter-OFF compound — the upstream defenders of this transaction are absent under bundled defaults)
- REFACTOR-540 NEW batch Z (ingestMetrics INTERNAL_POSTGRES tenant_id ABSENT — even with this transaction's atomicity, multi-tenant isolation on the Postgres path is structurally nonexistent)
- F-008 detail YAML drift facets: `single_transaction_per_batch_no_per_entity_isolation`, `batch_atomicity_without_signal`, `silent_destruction_replace_not_merge`, `otlp_export_inside_transaction`, `destruction_under_default_off_auth`

**Proposed action**: Promote to `adrs/drafts/ingestion-single-transaction-atomicity.md` (new ADR). Document the four-step outer-txn composition + the `ingestStats` carve-out + the OTLP-inside-txn trade-off + the data_source row lock serialisation. Cross-link with ADR-CANDIDATE-061 (controller-side validation), ADR-CANDIDATE-027 (auth trust gradient), and ADR-CANDIDATE-191 NEW batch Z (establisher-keyed lineage replacement) as the architectural triple governing F-008's destructive surface. Doc-side: the (currently 404) `configuration-and-deployment/data-ingestion` page MUST surface the single-transaction-per-batch semantics + the no-partial-success consequence + the OTLP-export-in-txn caveat for operators evaluating partial-failure resilience.

**Severity rationale**: HIGH — defines the platform's ingestion atomicity model; load-bearing for partial-failure semantics; serves as the structural guard against scope-expansion ("let me add a 202-Accepted async mode" requires re-engaging the atomicity stance); cross-references the highest-severity gaps in the F-008 5-vertex picture (REFACTOR-185 default-OFF auth + the destructive surface running inside this transaction).

---
