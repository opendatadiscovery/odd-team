---
id: IT-050
title: "Lookup Tables RDM: create+define+populate yields a SQL-joinable physical table; collisions 500 and PATCH cross-table jumps mutate the wrong table"
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
- **UC-007 (CONTRADICTED — collision pin):** two names normalising to the same physical name in one
  namespace (`buildTableName = name.toLowerCase().replace(' ','_')`,
  `ReferenceDataServiceImpl.java:191-194`; no uniqueness pre-check at `:73-86`) collide at the DDL
  `CREATE TABLE` and surface a generic **500 (SYS001)**, not a friendly 409. Pinned GREEN on the 500.
- **UC-010 (CONTRADICTED — cross-table-jump pin):** `updateLookupTableField` discards the path
  `lookup_table_id` (`ReferenceDataServiceImpl.java:126-143` takes only `columnId`), so
  `PATCH /table/{A}/column/{col_of_B}` mutates table B's column even though the caller addressed
  table A. The READ path (`getLookupTableField:58-70`) DOES enforce the linkage — the write path is
  asymmetric. **Consequence:** a caller authorised on table A edits table B's schema (a
  cross-resource write). Pinned GREEN on the cross-table PATCH succeeding + actually renaming B's
  physical column.

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
   name) → **500**, body `code:SYS001`.
3. **UC-010:** create `it050_table_a` + `it050_table_b`; add column `bcol` to B. `GET
   /table/{A}/columns/{bcol_id}` → **400** ("bcol doesn't belong to it050_table_b" — read-side
   baseline). `PATCH /table/{A}/columns/{bcol_id} {name:'it050_bcol_renamed'}` → **200**; read back
   table B's physical columns → they now contain `it050_bcol_renamed` (the path table-id was ignored);
   table A's physical columns are still just `[id]`.

**Automated rail:** `integration-tests/run-suite.sh IT-050`
(runs `e2e/specs/lookup-tables-rdm.spec.ts`).

## 5. What it checks — assertions

- **PASS** when: the populated table is SQL-joinable with the right columns + verbatim rows (UC-001);
  AND a normalisation collision returns 500/SYS001 (UC-007 pin GREEN); AND the cross-table PATCH
  returns 200 and renames table B's physical column while the read path rejected it (UC-010 pin GREEN).
- **FAIL** when: the physical table/columns/rows are wrong or absent (UC-001 broken); OR the collision
  returns 409/400 (UC-007 pin flips RED — uniqueness pre-check landed; close the bug); OR the
  cross-table PATCH returns 4xx / does not mutate B (UC-010 pin flips RED — write-side guard landed;
  close the bug).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-050.md` (+ Playwright report on failure).

## Cross-references
- Source: F-026 UC-001 (SQL-joinable physical table) + UC-007 (collision 500) + UC-010 (PATCH
  cross-table jump); `lineage/odd-platform/feature-flows/detail/F-026.yaml`. Facets
  `build_table_name_lossy_normalisation_collision_500`,
  `update_column_path_param_discarded_cross_table_jump`.
- Code: `ReferenceDataServiceImpl.java:73-86,126-143,191-194` (create / updateLookupTableField /
  buildTableName), `ReferenceDataRepositoryImpl.java:63-150` (DDL CREATE TABLE + add columns + add
  rows), `ReferenceDataController.java:131-141` (PATCH column passes table-id the service drops).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (Master Data Management lifecycle).
