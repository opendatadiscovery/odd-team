---
id: IT-136
title: "ML_MODEL ingestion maps 1:1 to the contract: a group payload ingests (no 500); a consumer-shaped ML_MODEL is a clean 4xx, not a 500"
gates:
  validates: []                # ingestion type resolution (issue opendatadiscovery/odd-platform#1725)
  enforces: []                 # ADR ml-entity-taxonomy (ML_MODEL = a DATA_ENTITY_GROUP identity; platform maps the contract 1:1)
  regresses: []                # #1725 (500 on ingesting type ML_MODEL)
test_class: integration
stack: odd-minimal
automation: "e2e:ml-model-ingestion-type.spec.ts"
plan_ref: I5
status: ready
---

# IT-136 — ML_MODEL ingestion maps 1:1 to the contract (#1725 / CTRIB-021 / ADR ml-entity-taxonomy)

> Source of truth — a human can run every step below without tooling; the `automation:` spec runs the same.

## 1. What this checks

`POST /ingestion/entities` with `type: ML_MODEL` (advertised in the ingestion contract) must NOT 500. The
platform maps the contract type to its internal type **1:1 by name** (`DataEntityTypeDto.valueOf`) — the
**specification is the contract**, and there is NO payload-shape inference/remapping in the platform. Per the
ML-entity-taxonomy ADR, `ML_MODEL` is the model-identity **GROUP**. So:
- `ML_MODEL` with a `data_entity_group` payload ingests (**200**) and reads back as **`ML_MODEL`** (the catalog
  read-back path that, mis-handled, produced the secondary 500);
- a `data_consumer`-shaped `ML_MODEL` is a **type-vs-class contract violation → a clean 4xx** (a consumer-model
  must be sent as `ML_MODEL_ARTIFACT`, added to the ingestion spec via SPC-004) — never the pre-fix 500.

**Operator consequence if it FAILS:** a collector following ODD's own ingestion contract hits a 500 on the front
door — the #1725 report. Source: issue #1725, CTRIB-021, `adrs/drafts/ml-entity-taxonomy.md`.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`). SUT built from the working tree (`ODD_SUT=working`) carries
  the fix; `ODD_SUT=ref:main` is the RED baseline (both cases 500 there — the internal enum lacks `ML_MODEL`).
- **Seed:** one raw `data_source` row (id 21360, oddrn `//e2e-it136/ds`; `seedIngestionDataSource`). Idempotent.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT 1 FROM data_source WHERE oddrn='//e2e-it136/ds'`.

## 4. Run protocol

1. `POST /ingestion/entities { items: [ table(member), { type:"ML_MODEL", data_entity_group:{ entities_list:[member] } } ] }`
   → **200**; then `GET /api/dataentities/{id}` of the group → `type.name == "ML_MODEL"`.
2. `POST /ingestion/entities { items: [ { type:"ML_MODEL", data_consumer:{ inputs:[…] } } ] }` → **4xx (400)**,
   not 500 (a consumer-shaped `ML_MODEL` is a contract violation; use `ML_MODEL_ARTIFACT`).

**Automated rail:** `integration-tests/run-suite.sh IT-136`
(RED baseline: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-136` → both steps return 500).

## 5. What it checks — assertions

- **PASS** when: step 1 → 200 + read-back `ML_MODEL`; step 2 → 400 (not 500).
- **FAIL** when: ingesting a contract-valid `ML_MODEL` group returns 500 (the #1725 bug), OR the read-back 500s
  (stale output enum), OR a consumer-shaped `ML_MODEL` returns 500 instead of a clean 4xx.

## 6. Result log

Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-136.md`.

## Cross-references

- Source: opendatadiscovery/odd-platform#1725 · CTRIB-021 · `adrs/drafts/ml-entity-taxonomy.md` · SPC-004 (the spec adds `ML_MODEL_ARTIFACT`/`_INSTANCE`)
- Unit sibling: `odd-platform-api/.../mapper/ingestion/IngestionMapperImplTest.java`
