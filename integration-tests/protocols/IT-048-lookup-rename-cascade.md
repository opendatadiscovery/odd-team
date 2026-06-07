---
id: IT-048
title: "Lookup table rename silently renames the underlying physical Postgres table (data-loss cascade); a description-only edit does not"
gates:
  validates: [F-059]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:lookup-rename-cascade.spec.ts"
plan_ref: I3
status: ready
---

# IT-048 — F-059 Lookup Table Rename Cascade

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` e2e spec runs the same steps and writes the same result.

## 1. What this checks

Two falsifiable promises about renaming a lookup table — operator-curated reference data whose
rows live in a REAL Postgres table in `lookup_tables_schema` (the documented public surface
downstream dbt/BI/notebooks JOIN against by name):

- **UC-002 (CONFIRMED — harmless-edit guard):** a description-only edit (or a name change that
  normalises to the same physical name) must NOT rename the physical table. The service
  short-circuits the DDL when the normalised name is unchanged —
  `table.tablesPojo().getTableName().equals(tableDto.getTableName()) ? Mono.empty() : ...rename`
  (`ReferenceDataServiceImpl.java:119-122`). **Consequence if it FAILS:** even a metadata-only
  edit would break downstream joins.
- **UC-001 (CONTRADICTED — data-loss pin):** a name change that normalises to a DIFFERENT physical
  name runs `ALTER TABLE ... RENAME TO` on the public schema
  (`ReferenceDataRepositoryImpl.java:191-201`, line 192) with NO alias view, NO warning dialog, NO
  audit event. The OLD physical relation stops resolving. **Consequence if it FAILS (i.e. the bug
  fires, which it does today):** an operator renaming "Customer Lookups" → "Customer Lookup Codes"
  to clarify a concept silently breaks every pipeline still issuing
  `SELECT ... FROM lookup_tables_schema.n_5__customer_lookups` — an LSN-001-class footgun at the
  operator-action layer. This test pins the CURRENT (wrong) behaviour GREEN (LSN-029); it flips RED
  the instant the platform decouples business-name from physical-name or lands a deprecation alias.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (platform + Postgres), `AUTH_TYPE=DISABLED` (default) so the reference-
  data endpoints are reachable anonymously. The e2e harness brings the stack up/down
  (`global-setup`); for an already-running stack use `ODD_STACK_EXTERNAL=1`.
- **Seed data:** a `namespace` row named `it048_ns` (create resolves
  `namespaceRepository.getByName` and silently no-ops if the namespace is absent) —
  `ensureNamespace('it048_ns')` (helpers/lookup.ts). The lookup tables themselves are created by
  the REAL API (the act). Prior `it048_`-prefixed tables are dropped first (idempotent).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Schema present: `SELECT 1 FROM information_schema.schemata WHERE schema_name='lookup_tables_schema'`
- Namespace present: `SELECT 1 FROM namespace WHERE name='it048_ns'`

## 4. Run protocol

1. `POST /api/referencedata/table` `{name:'it048_codes', namespace_name:'it048_ns', description:'before'}`
   → **200**. Read back the physical name: `SELECT table_name FROM lookup_tables WHERE id=<id>` →
   `n_{nsId}__it048_codes`; confirm it exists in `lookup_tables_schema`.
2. `PUT /api/referencedata/table/{id}` `{name:'it048_codes', description:'after'}` → **200**
   (NB: the OpenAPI spec documents 201 for this PUT; the running platform returns **200** —
   verified live 2026-06-07). Re-read `table_name` → UNCHANGED; physical table still present (UC-002).
3. Create a second table `{name:'it048_customer_lookups', ...}` → **200**; capture its physical name.
4. `PUT /api/referencedata/table/{id}` `{name:'it048_customer_lookup_codes', ...}` → **200**.
   Re-read `table_name` → it is now `n_{nsId}__it048_customer_lookup_codes`; the NEW physical table
   exists; the OLD physical relation `n_{nsId}__it048_customer_lookups` is GONE (UC-001).

**Automated rail:** `integration-tests/run-suite.sh IT-048`
(runs `e2e/specs/lookup-rename-cascade.spec.ts`).

## 5. What it checks — assertions

- **PASS** when: a description-only edit leaves the physical table_name + the physical table intact
  (UC-002); AND a name-changing rename moves the physical table to the new name while the OLD
  physical relation no longer exists (UC-001 — the data-loss cascade reproduced GREEN).
- **FAIL** when: a description-only edit drops/renames the physical table (UC-002 broken); OR a
  rename leaves the OLD physical relation resolvable (UC-001 pin flips RED — the platform gained an
  alias / decoupled the name; update the pin + close the bug).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-048.md` (+ Playwright report on failure).

## Cross-references
- Source: F-059 UC-001 (destructive physical rename) + UC-002 (harmless-edit guard);
  `lineage/odd-platform/feature-flows/detail/F-059.yaml`; facet
  `rename_cascade_breaks_documented_public_surface_silently` (HIGH).
- Code: `ReferenceDataServiceImpl.java:107-124,191-194` (rebuild physical name + equals-guard) +
  `ReferenceDataRepositoryImpl.java:181-202` (ALTER TABLE RENAME TO chain).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (Master Data Management lifecycle).
