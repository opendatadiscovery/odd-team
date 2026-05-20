## ADR-CANDIDATE-072 — Establisher-keyed lineage edge provenance — `establisher_oddrn` enables non-destructive rewrite-by-establisher ingestion contract

**Severity**: HIGH
**Classification**: promote (unique-load-bearing)
**Support count**: 1 sidecar (this batch — Lineage)
**Axes present**: repositories, schema, ingestion

**Surfaced by**:
- `ReactiveLineageRepositoryImpl.md:implicit_adrs[4]` (the explicit establisher-keyed provenance + non-destructive ingestion)
- `ReactiveLineageRepositoryImpl.md:implicit_adrs[1]` (the paired ingestion-atomicity contract via batchDeleteByEstablisherOddrn + batchInsertLineages)

**Decision statement**: Every lineage edge in ODD carries a third column — `establisher_oddrn` — that records WHICH DATA ENTITY DECLARED the edge. This is NOT the parent and NOT the child; it is the producer (or, in the cross-producer case, the entity whose ingestion run published the edge).

The schema migration history is the architectural commit message:
- **`V0_0_2__add_lineage.sql:1-7`** — the original lineage table had only `(parent_oddrn, child_oddrn)` with PK `(parent_oddrn, child_oddrn)`.
- **`V0_0_17__add_establisher_into_lineage.sql:1-2`** — adds `establisher_oddrn` column.
- **`V0_0_17:116-117`** — REPLACES the PK with `(parent_oddrn, child_oddrn, establisher_oddrn)`, allowing multiple establishers to declare the same edge.
- **`V0_0_17:119`** — `CREATE INDEX lineage_establisher_oddrn ON lineage (establisher_oddrn)` — the index that supports the rewrite-by-establisher path.

The downstream consequence — the architectural property that this ADR PROTECTS — is the **non-destructive rewrite-by-establisher ingestion contract**:

```java
// LineageServiceImpl.replaceLineagePaths (lines 124-133)
@ReactiveTransactional
public Flux<LineagePojo> replaceLineagePaths(...) {
  return lineageRepository.batchDeleteByEstablisherOddrn(establishers)
    .thenMany(lineageRepository.batchInsertLineages(pojos));
}
```

When entity X re-publishes its lineage, the rewrite atomically:
1. Deletes ONLY the edges X declared (`DELETE FROM lineage WHERE establisher_oddrn IN (X's_oddrn)`).
2. Inserts X's new declared edges.
3. Edges declared by other entities (Y, Z, ...) are UNTOUCHED.

This is the property that makes ingestion idempotent and non-destructive across producers. Without the establisher column, a re-publication by X would either:
- (alt1) Delete-by-(parent, child) tuples — losing Y and Z's parallel declarations of the same edge.
- (alt2) Read-then-merge — N+1 round-trips, complex conflict logic, hard to make atomic.
- (alt3) Skip the rewrite contract entirely — accept that lineage edges accumulate forever, with no producer-driven cleanup.

The establisher-keyed model picks the cleanest path: ONE table, THREE columns, ONE primary key, ONE index. The producer-driven rewrite-by-establisher contract is enforced at the SQL layer (the PK uniqueness + the DELETE-by-establisher predicate).

The decision codifies:
- **(a)** Lineage edges are AUTHORED by entities; the authorship is structural (the establisher column).
- **(b)** The "single edge between A and B" model is rejected. The platform deliberately allows multiple establishers to declare the same edge; the SAME (parent, child) tuple can appear N times with N different establishers. This is REQUIRED for the cross-producer case (e.g. Airflow declaring A→B because Airflow knows about the job; dbt independently declaring A→B because dbt's lineage parser sees the SQL).
- **(c)** Ingestion atomicity is delegated to the caller via `@ReactiveTransactional` (per ADR-CANDIDATE-067). The repository exposes the delete-by-establisher and insert primitives as separate methods rather than a single `replaceLineagesByEstablisher` so the caller can compose them inside ONE transaction.
- **(d)** The hard-delete-by-establisher is the EXCEPTION to ADR-CANDIDATE-068's soft-delete-by-default convention. Lineage edges are soft-deleted via the `is_deleted` column for the entity status-change cascade; lineage edges are HARD-DELETED only via the ingestion rewrite-by-establisher path. The dual-mode soft/hard delete is intentional and structurally encoded.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the explicit PK migration (V0_0_17:116-117) + the dedicated index (V0_0_17:119) + the paired `batchDeleteByEstablisherOddrn` + `batchInsertLineages` + `@ReactiveTransactional` composition is documentation-as-code. The migration file's name (`add_establisher_into_lineage`) is the architectural statement.
2. *Structural impact?* YES — affects the lineage table schema (3 columns + composite PK), the ingestion contract (rewrite-by-establisher atomicity), the cross-producer model (multiple declarations of same edge), the dual-mode delete strategy (soft + hard with different triggers).
3. *Refactoring or structural?* STRUCTURAL — switching to (alt1)/(alt2)/(alt3) would require schema rewrite, ingestion-path rewrite, and a fundamental reconception of the cross-producer lineage model.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactiveLineageRepositoryImpl.md` says: "Establisher-keyed edge provenance — each lineage edge carries the oddrn of the entity that DECLARED it (`establisher_oddrn`). This is the model element that enables 'when entity X re-publishes its lineage, rewrite ONLY the edges X declared, leaving edges declared by Y untouched' — the property that makes ingestion non-destructive across producers."
- `ReactiveLineageRepositoryImpl.md` says: "Ingestion atomicity via paired `batchDeleteByEstablisherOddrn` + `batchInsertLineages` under caller's `@ReactiveTransactional` — the repository deliberately exposes the delete-by-establisher and insert primitives as separate methods rather than a single `replaceLineagesByEstablisher(...)` so the caller (LineageServiceImpl.replaceLineagePaths at LineageServiceImpl.java:124-133) can compose them inside ONE transactional boundary."
- `V0_0_17__add_establisher_into_lineage.sql:1-2, 116-119` — the schema migration

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-068** (NEW — two-tier soft-delete taxonomy) — lineage edges are soft-delete + the establisher-rewrite hard-delete exception.
- **ADR-CANDIDATE-067** (existing — `@ReactiveTransactional` boundary asymmetry) — the ingestion atomicity contract relies on service-layer transactional composition.
- **ADR-CANDIDATE-057** (existing — single-query recursive-CTE lineage traversal) — the read-side architecture that consumes the establisher-keyed model (each edge in the CTE result carries its establisher; the consumer can attribute the edge back to its producer).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-207 (existing — no cycle detection in lineage CTE; the establisher model doesn't help with cycle detection because cycles can span multiple establishers).
- REFACTOR-237 (NEW — owner-scoping in lineage is anchor-set single-point-of-failure; the establisher model doesn't encode owner — owner-scoping requires a JOIN to data_entity, not a lineage-table predicate).

**Proposed action**: Promote to `adrs/drafts/establisher-keyed-lineage-provenance.md` (new ADR). Document:
- The schema (3 columns + composite PK + establisher index).
- The ingestion contract (rewrite-by-establisher atomicity via `@ReactiveTransactional` composition).
- The cross-producer model (multiple establishers declaring same edge).
- The dual-mode delete (soft via `is_deleted`; hard via rewrite-by-establisher).
- The cross-link with ADR-CANDIDATE-068 (the soft-delete-by-default exception).
- The operator-facing UX: lineage edges DON'T disappear when a producer goes offline (the edges remain declared until another rewrite or housekeeping cleans them); the ingestion-rewrite is producer-scoped not edge-scoped.

Cross-link with the ingestion subsystem docs — operators running collectors need to understand that the rewrite-by-establisher contract makes their re-publication safe.

**Severity rationale**: HIGH — load-bearing decision for the lineage subsystem (F-005). Every collector that publishes lineage relies on this contract. Compatible-change calculus for any future maintainer working on ingestion, lineage repository, or the cross-producer story requires understanding the establisher model.

---
