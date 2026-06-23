---
id: IT-050
title: "Lookup Tables RDM: create+define+populate yields a SQL-joinable physical table; a normalisation collision is rejected 400 (not 500); cross-table column PATCH/DELETE are rejected 400 (not mutating the wrong table)"
gates:
  validates: [F-026]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:lookup-tables-rdm.spec.ts"
plan_ref: I3
status: ready
---

# IT-050 — F-026 Lookup Tables (Reference Data Management)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` e2e spec runs the same steps and writes the same result.

## 1. What this checks

The lookup-table lifecycle: `POST /table` (create) → `POST /table/{id}/columns` (define schema) →
`POST /table/{id}/data` (populate). Per F-026 `use_case_coverage` the entire user-facing promise
layer is UNGUARDED (only 2 service-tier unit tests exist; none exercise a promise end-to-end).

- **UC-001 (CONFIRMED — happy-path):** the create+define+populate flow yields a real SQL-joinable
  Postgres table `n_{nsId}__{slug}` in `lookup_tables_schema` whose columns + rows are readable
  DIRECTLY from the schema — the "reference data is SQL-joinable" contract the docs promise.
  **Consequence if it FAILS:** the platform's reference-data store is not actually queryable
  downstream — the feature's whole reason to exist is broken.
- **UC-007 (RE-GROUNDED RED→GREEN, odd-platform#1769 defect a):** two names normalising to the same
  physical name in one namespace (`buildTableName = name.toLowerCase().replace(' ','_')`) used to
  collide at the DDL `CREATE TABLE` and surface a generic **500 (SYS001)**. `createLookupTable` now
  pre-checks uniqueness (`ReactiveLookupTableRepository.existsByTableName`) and rejects the collision
  with an actionable **400 USR003** ("already exists in this namespace") — the platform's standard
  uniqueness-collision contract. Was the LSN-029 collision-500 pin; now asserts the FIX (RED on pre-fix main).
- **UC-010 (RE-GROUNDED RED→GREEN, odd-platform#1769 defect b):** `updateLookupTableField` used to
  discard the path `lookup_table_id` (took only `columnId`), so `PATCH /table/{A}/column/{col_of_B}`
  mutated table B's column even though the caller addressed table A. The write path now enforces the
  SAME column-belongs-to-table guard the READ path (`getLookupTableField`) always has — a mismatched
  column-id is rejected **400** ("doesn't belong to") and table B is untouched. Was the LSN-029
  cross-table-jump pin; now asserts the FIX (RED on pre-fix main).
- **UC-011 (NEW, odd-platform#1769 defect b twin):** `deleteLookupTableField` had the IDENTICAL
  dropped-path-id defect and is destructive — `DELETE /table/{A}/column/{col_of_B}` dropped table B's
  column. It now enforces the same guard: a cross-table DELETE is rejected **400** and B's column
  survives. **Consequence if it regresses:** a caller can DROP a column off a table they did not address.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal`, `AUTH_TYPE=DISABLED` (default) so the reference-data endpoints are
  reachable anonymously. The e2e harness brings the stack up/down; `ODD_STACK_EXTERNAL=1` reuses one.
- **Seed data:** `ensureNamespace('it050_ns')` (create resolves the namespace by name and no-ops
  silently if absent). Tables/columns/rows are created by the REAL API (the act). Prior
  `it050_`-prefixed tables are dropped first (idempotent).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Schema present: `SELECT 1 FROM information_schema.schemata WHERE schema_name='lookup_tables_schema'`
- Namespace present: `SELECT 1 FROM namespace WHERE name='it050_ns'`

## 4. Run protocol

1. **UC-001:** `POST /table {name:'it050_country_codes', namespace_name:'it050_ns'}` → **200** (auto
   `id` column). `POST /table/{id}/columns [{name:'code',field_type:'VARCHAR',is_nullable:false},
   {name:'label',field_type:'VARCHAR'}]` → **200**. `POST /table/{id}/data` with two rows
   (US/United States, CA/Canada) → **200**. Read back from PG:
   `SELECT column_name FROM information_schema.columns WHERE table_schema='lookup_tables_schema' AND
   table_name='n_{nsId}__it050_country_codes'` → `[id,code,label]`;
   `SELECT code,label FROM lookup_tables_schema."n_{nsId}__it050_country_codes" ORDER BY id` →
   `[US|United States, CA|Canada]`.
2. **UC-007:** `POST /table {name:'it050_dup name', namespace_name:'it050_ns'}` → **200**.
   `POST /table {name:'it050_dup_name', namespace_name:'it050_ns'}` (normalises to the SAME physical
   name) → **400**, body `code:USR003`, message contains "already exists" (the actionable collision
   error — was a raw 500/SYS001 pre-fix).
3. **UC-010:** create `it050_table_a` + `it050_table_b`; add column `bcol` to B. `GET
   /table/{A}/columns/{bcol_id}` → **400** ("bcol doesn't belong to it050_table_b" — read-side
   baseline). `PATCH /table/{A}/columns/{bcol_id} {name:'it050_bcol_renamed'}` → **400** (write-side
   guard); read back table B's physical columns → still `bcol` (NOT `it050_bcol_renamed`); table A's
   physical columns are still just `[id]`.
4. **UC-011:** create `it050_del_a` + `it050_del_b`; add column `bcol` to B.
   `DELETE /table/{del_a}/columns/{bcol_id}` (B's column via A's URL) → **400** (write-side guard);
   read back table B's physical columns → still contain `bcol` (the destructive cross-table drop was blocked).

**Automated rail:** `integration-tests/run-suite.sh IT-050`
(runs `e2e/specs/lookup-tables-rdm.spec.ts`).

## 5. What it checks — assertions

- **PASS** when: the populated table is SQL-joinable with the right columns + verbatim rows (UC-001);
  AND a normalisation collision returns **400 USR003** with an "already exists" message (UC-007);
  AND the cross-table PATCH returns **400** and leaves table B's column unchanged while the read path
  also rejects it (UC-010); AND the cross-table DELETE returns **400** and table B keeps its column (UC-011).
- **FAIL** when: the physical table/columns/rows are wrong or absent (UC-001 broken); OR the collision
  returns 500/SYS001 (UC-007 — the pre-fix bug regressed: the uniqueness pre-check is gone); OR the
  cross-table PATCH returns 200 / mutates B (UC-010 — the write-side guard regressed); OR the
  cross-table DELETE returns 2xx / drops B's column (UC-011 — the destructive guard regressed).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-050.md` (+ Playwright report on failure).

## Cross-references
- Source: F-026 UC-001 (SQL-joinable physical table) + UC-007 (collision → 400) + UC-010 (PATCH
  cross-table guard) + UC-011 (DELETE cross-table guard, new); `lineage/odd-platform/feature-flows/detail/F-026.yaml`.
  Facets `build_table_name_lossy_normalisation_collision_500`,
  `update_column_path_param_discarded_cross_table_jump` — both FIXED under odd-platform#1769 / CTRIB-033
  (re-enriched in Phase D).
- Code (post-fix, odd-platform#1769): `ReferenceDataServiceImpl` `createLookupTable` (existsByTableName
  pre-check → `UniqueConstraintException`), `updateLookupTableField`/`deleteLookupTableField` (now take
  `lookupTableId` + the column-belongs-to-table guard), `buildTableName`;
  `ReactiveLookupTableRepository[Impl].existsByTableName` (new finder); `ReferenceDataController`
  (PATCH + DELETE column now pass the path table-id through).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (Master Data Management lifecycle).
