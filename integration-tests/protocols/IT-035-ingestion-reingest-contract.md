---
id: IT-035
title: "Ingestion write contract — a partial re-ingest preserves omitted entities; a duplicate-ODDRN batch is rejected whole"
gates:
  validates: [F-008]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:ingestion-reingest-contract.spec.ts"
plan_ref: I5
status: ready
---

# IT-035 — F-008 Batch Ingestion: the ingestion-write contract

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` e2e spec runs the same steps and writes the same result.

## 1. What this checks

Two falsifiable claims about the platform's largest + most destructive write surface (F-008,
`POST /ingestion/entities`), driving the REAL ingestion endpoint (not raw-DB seeding):

- **UC-13 (data-loss guard):** ingesting `{a, b}` then re-ingesting only `{a}` must leave `b`
  a live (non-hollow, non-deleted) entity. **Operator consequence if it FAILS:** a collector
  that on one tick scrapes only a subset (a transient/partial scrape) silently destroys the
  omitted catalog entities — an LSN-001-class silent data loss.
- **UC-06 (atomicity):** a payload with a duplicate ODDRN must be rejected as a whole, never
  partially applied. Source: `IngestionServiceImpl.persistDataEntities` collects items via
  `Collectors.toMap(getOddrn, identity)` (IngestionServiceImpl.java:83-86), which throws on a
  duplicate key BEFORE any DB write — so the batch is all-or-nothing (currently via a 500 crash).

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (platform + Postgres), `AUTH_TYPE=DISABLED` (default) so the
  ingestion endpoints are reachable without a collector token (this default reachability is
  itself F-008-UC-01). The e2e harness brings the stack up/down (`global-setup`).
- **Seed data:** a raw `data_source` row the ingestion API resolves `data_source_oddrn`
  against — `seedIngestionDataSource(2035, '//e2e-it035/datasource', 'it035-ds')`
  (helpers/db.ts). The entities themselves are created by the ingestion POST (the act).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Datasource present: `SELECT 1 FROM data_source WHERE oddrn = '//e2e-it035/datasource'`

## 4. Run protocol

1. `POST http://localhost:18080/ingestion/entities` with
   `{data_source_oddrn, items:[tableEntity(a), tableEntity(b)]}` → expect **200**.
2. Read `b` ground-truth: `SELECT id, hollow FROM data_entity WHERE oddrn = '<b>'` → exists, `hollow=false`.
3. `POST /ingestion/entities` with `{data_source_oddrn, items:[tableEntity(a)]}` (b omitted) → expect **200**.
4. Re-read `b` → it must still exist with `hollow=false`.
5. `POST /ingestion/entities` with two items sharing one ODDRN → expect status **≥ 400**;
   then `SELECT id FROM data_entity WHERE oddrn = '<dup>'` → **no row** (no partial write).

**Automated rail:** `integration-tests/run-suite.sh IT-035` (runs `e2e/specs/ingestion-reingest-contract.spec.ts`).

## 5. What it checks — assertions

- **PASS** when: after the partial re-ingest, `b` is still present and non-hollow (UC-13); and the
  duplicate-ODDRN batch is rejected (≥400) with no row persisted (UC-06).
- **FAIL** when: `b` is missing or `hollow=true` after the partial re-ingest (silent destruction —
  a data-loss bug to file + flip this to a known-bug pin); or the duplicate batch returns 200 /
  leaves a partial row (atomicity broken).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-035.md` (+ Playwright report on failure).

## Cross-references
- Source: F-008 UC-13 (re-ingest reconciliation) + UC-06 (batch atomicity); feature-reflections/detail/F-008.yaml
- Plan: `lineage/odd-platform/test-plan.md` batch I5 (ingestion identity)
- First IT to use the ingestion-API seed helper (`e2e/helpers/ingest.ts`) — the PHASE3 plateau unlock.
