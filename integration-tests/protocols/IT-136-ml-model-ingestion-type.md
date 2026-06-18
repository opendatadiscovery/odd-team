---
id: IT-136
title: "ML_MODEL ingestion: a contract-valid type maps + reads back (no 500); ML_MODEL is a group identity; unmappable types are 400 not 500"
gates:
  validates: []                # ingestion type resolution (issue opendatadiscovery/odd-platform#1725)
  enforces: []                 # ADR ml-entity-taxonomy (ML_MODEL = a DATA_ENTITY_GROUP identity)
  regresses: []                # #1725 (500 on ingesting type ML_MODEL)
test_class: integration
stack: odd-minimal
automation: "e2e:ml-model-ingestion-type.spec.ts"
plan_ref: I5
status: ready
---

# IT-136 — ML_MODEL ingestion type mapping (#1725 / CTRIB-021 / ADR ml-entity-taxonomy)

> Source of truth — a human can run every step below without tooling; the `automation:` spec runs the same.

## 1. What this checks

`POST /ingestion/entities` with `type: ML_MODEL` (advertised in the ingestion contract) must NOT 500. Per the
ML-entity-taxonomy ADR, `ML_MODEL` is the model-identity GROUP; the platform resolves a wire `ML_MODEL` by its
payload SHAPE:
- a `data_consumer` payload (the #1725 "Chatbot") ingests as **`ML_MODEL_ARTIFACT`** and reads back as such
  (the catalog read-back path that, mis-handled, produced babaMar's secondary 500);
- a `data_entity_group` payload ingests as the **`ML_MODEL`** group identity;
- a contract type with no internal counterpart (e.g. `UNKNOWN`) returns a clean **400**, never a 500.

**Operator consequence if it FAILS:** a collector author following ODD's own ingestion contract (which lists
`ML_MODEL`) hits a 500 on the front door of the platform — exactly the #1725 report. Source: issue #1725,
CTRIB-021, `adrs/drafts/ml-entity-taxonomy.md`.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED` → anonymous `POST /ingestion/entities`). The SUT is built from
  the working tree (`ODD_SUT=working`, the default) so it carries the fix; `ODD_SUT=ref:main` is the RED baseline.
- **Seed:** one raw `data_source` row (id 21360, oddrn `//e2e-it136/ds`) so the batch resolves its
  `data_source_oddrn` (`seedIngestionDataSource`). Idempotent.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT 1 FROM data_source WHERE oddrn='//e2e-it136/ds'`.

## 4. Run protocol

1. `POST /ingestion/entities {data_source_oddrn, items:[{oddrn, name, type:"ML_MODEL", data_consumer:{inputs:[…]}}]}`
   → **200**; then `GET /api/dataentities/{id}` (id via the entity's oddrn) → `type.name == "ML_MODEL_ARTIFACT"`.
2. `POST … items:[ member(type ML_MODEL + data_consumer), group(type ML_MODEL + data_entity_group{entities_list:[member]}) ]`
   → **200**; the group entity reads back `type.name == "ML_MODEL"`.
3. `POST … items:[{oddrn, name, type:"UNKNOWN", data_consumer:{inputs:[]}}]` → **400** (not 500).

**Automated rail:** `integration-tests/run-suite.sh IT-136`
(RED baseline: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-136` → step 1/2 return 500, step 3 returns 500).

## 5. What it checks — assertions

- **PASS** when: step 1 → 200 + read-back `ML_MODEL_ARTIFACT`; step 2 → 200 + read-back `ML_MODEL`; step 3 → 400.
- **FAIL** when: any ingest of a contract-valid `ML_MODEL` returns 500 (the #1725 bug), OR the read-back 500s
  (the stale-output-enum / secondary-500), OR `UNKNOWN` returns 500 instead of 400.

## 6. Result log

Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-136.md` (date · stack_commit/SUT · runner ·
outcome · evidence · notes).

## Cross-references

- Source: opendatadiscovery/odd-platform#1725 · CTRIB-021 · `adrs/drafts/ml-entity-taxonomy.md`
- Unit sibling: `odd-platform-api/.../mapper/ingestion/IngestionMapperImplTest.java`
- Related: IT-061 (F-096 `client_error_surfaces_as_5xx` — the broader error-contract class this fix narrows for the type bridge)
