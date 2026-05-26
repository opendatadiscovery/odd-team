# SHB-093 — Cascade-on-delete check is TOCTOU-racy across Owner / Namespace / DataSource (non-atomic with the soft-delete that follows)

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Three Management-tab delete paths (Owner, Namespace, DataSource) use the same architectural shape: check N referent-existence predicates via `Mono.zip` in parallel, then `.filter(!exists).switchIfEmpty(CascadeDeleteException)` then `repository.delete(id)`. None acquire a row-level lock (`SELECT FOR UPDATE`) on the parent row, none use a Postgres advisory lock, and they run under `READ COMMITTED` (Spring/R2DBC default). Between the existence read and the soft-delete UPDATE, a concurrent INSERT against a referent table (POST /api/dataentities/{id}/ownership for Owner; POST a datasource/term/collector/data-entity to a namespace; POST a data-entity to a datasource) can slip through, leaving an orphan referent row pointing at a now-soft-deleted parent.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerServiceImpl.java:88-100` — Owner delete: `@ReactiveTransactional` boundary + 3-leg `Mono.zip` cascade-check (`termOwnership.existsByOwner` + `ownership.existsByOwner` + `userOwnerMapping.isOwnerAssociated`) + `deleteOwnerRelationsExcept` + `ownerRepository.delete(id)`. No FOR UPDATE.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/NamespaceServiceImpl.java:73-90` — Namespace delete: NOT `@ReactiveTransactional` (per NamespaceController sidecar bugs[5]), 4-leg `Mono.zip` (datasource + collector + term + data_entity existence). Worse than Owner because no transaction boundary at all.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataSourceServiceImpl.java:85-96` — DataSource delete: `@ReactiveTransactional` + 1-leg check (`dataEntityRepository.existsNonDeletedByDataSourceId(id)`) + soft-delete. No FOR UPDATE.
- `REFACTOR-430` (per OwnerServiceImpl sidecar) — already files the Owner-side race.
- `odd-platform-api/src/main/resources/db/migration/V0_0_51__add_owner_association_request.sql:11` — `owner_association_request` FK has NO `ON DELETE` clause; Owner cascade-check doesn't include this table either (REFACTOR-427).
- `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:84` + `V0_0_11__add_namespace_support.sql:1-2` + `V0_0_29__add_collector.sql:14` + `V0_0_35__add_terms.sql:12` — all 4 namespace-referent FKs have NO `ON DELETE` clause; PG cascade is not relied on.

## Notes

- The race is BOUNDED by the transaction duration (~3-4 EXISTS queries) — narrow but observable. Under sustained admin load + concurrent ingestion, the race is reachable.
- Consequence: orphan rows that pass FK checks at insert time but point at soft-deleted parents. The subsequent read-side soft-delete filters HIDE the orphan from list endpoints but the row persists in the DB. A direct by-id read (where `getDto` doesn't filter on `deleted_at IS NULL`) surfaces the orphan + the soft-deleted parent.
- The Namespace case is the worst: no `@ReactiveTransactional` at all means the entire cascade-check + soft-delete chain is non-atomic with itself; even single-threaded a partial failure (network blip mid-UPDATE) leaves the namespace as `deleted_at IS NULL` while the operator sees a successful response.
- Fix: add `SELECT FOR UPDATE` on the parent row at the start of the cascade-check; OR use Postgres advisory lock keyed on `(table_id, parent_id)`; OR add `@ReactiveTransactional(isolation = REPEATABLE_READ)`.
- This is a structural class across 3 controllers — worth one feature anchor + one ADR.

## Next

1. **ENRICH F-019** (Owner cascade) + **F-028** (Namespace cascade) + **F-031** (DataSource cascade) each with this shared drift facet.
2. **PROMOTE** to feature: `F-NNN — Cascade-on-delete protection pattern across Management-tab deletes` with explicit acknowledgement of the TOCTOU race-window class. Pillar P-08.
3. **REFACTOR-NNN**: add `SELECT FOR UPDATE` on the parent row in all 3 service-tier delete paths. Add `@ReactiveTransactional` to `NamespaceServiceImpl.delete` to close the unannotated case.
4. **TEST-GAP-NNN**: per-path concurrency test seeding the cascade-check then injecting a concurrent referent INSERT; assert either the delete fails OR the insert fails — never both succeed.
5. **REFACTOR-427**: add the missing 4th cascade-leg for `owner_association_request` on Owner delete.

## Links

- cluster_with: [F-019, F-028, F-031]
- merged_into: F-076
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated to F-076 (Cross-Management Cascade-on-Delete Protection Pattern, pillar P-08). The structural-class pattern across 3 Management surfaces (Owner/Namespace/DataSource) warrants a standalone feature anchor — F-076 cross-links to F-019/F-028/F-031 while each per-feature flow retains its specific cascade facet. The graduation is per the thread's own "worth one feature anchor + one ADR" recommendation. Concurrently F-019 was enriched with a back-link shoebox_extension noting the cross-feature pattern observation. Category flipped clustering → merged.
