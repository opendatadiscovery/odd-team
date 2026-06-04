---
id: IT-036
title: "Metrics ingestion — a collector's pushed metric families persist and are served back on the entity"
gates:
  validates: [F-030]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:metrics-ingestion.spec.ts"
plan_ref: I5
status: ready
---

# IT-036 — F-030 Metrics Ingestion (collector → platform → read-back)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.

## 1. What this checks

A collector pushes metric families for an entity via `POST /ingestion/metrics`; the platform must
persist them and serve them back on `GET /api/dataentities/{id}/metrics`. **Operator consequence if
it FAILS:** pushed metrics silently vanish or never render — the metrics tab is dead. Driven through
the real ingestion endpoint (the metrics feature is enabled in odd-minimal — `POST /ingestion/metrics`
returns 201).

## 2. Preparation

- **Stack:** `odd-minimal` (default `AUTH_TYPE=DISABLED`). The e2e harness brings it up; or run against
  a persistent stack with `ODD_STACK_EXTERNAL=1`.
- **Seed:** a raw `data_source` (`seedIngestionDataSource`) + one ingested TABLE entity (via the
  ingestion-API helper). Metrics attach to that entity by ODDRN.

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Metrics enabled: `POST /ingestion/metrics {"items":[]}` → `201`

## 4. Run protocol

1. `POST /ingestion/entities` with one TABLE entity `E` → 200.
2. `POST /ingestion/metrics` with `{items:[{oddrn:E, metric_families:[ GAUGE it036_http_requests = 4242 ]}]}` → **201**.
3. Look up `E`'s id: `SELECT id FROM data_entity WHERE oddrn = '<E>'`.
4. `GET /api/dataentities/{id}/metrics` → body contains the family name + the gauge value.
5. Negative: a second entity with NO metrics → `GET .../metrics` → body does NOT contain the family.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-036` (e2e:metrics-ingestion.spec.ts).

## 5. Assertions

- **PASS** when: metrics ingest returns 201 and the GET serves back the family + value; a no-metrics
  entity serves no family.
- **FAIL** when: the family/value is missing after ingest (lost metrics), or a no-metrics entity
  carries another entity's family (cross-entity leakage).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-036.md`.

## Cross-references
- Source: F-030 Metrics Ingestion; feature-reflections/detail/F-030.yaml
- Plan: `lineage/odd-platform/test-plan.md` batch I5
- Uses the ingestion-API seed helper (`e2e/helpers/ingest.ts` — ingestMetrics/gaugeFamily/getEntityMetricsBody).
