---
id: IT-044
title: "Statistics ingestion — pushed per-column number_stats persist + read back; an unstated field carries none"
gates:
  validates: [F-095]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:stats-ingestion.spec.ts"
plan_ref: I5
status: ready
---

# IT-044 — F-095 Statistics Ingestion (per-column stats round-trip)

## 1. What this checks

A collector pushes per-column statistics via `POST /ingestion/entities/datasets/stats`; the platform
must persist them onto the dataset's fields and serve them on `GET /api/datasets/{id}/structure`.
**Operator consequence if it FAILS:** pushed column statistics silently vanish. Verified shape (read,
not guessed): `DataSetFieldStat.number_stats` — a wrong wrapper key is silently ignored (hollow 201),
so the test asserts the READ-BACK, not the POST status alone.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** a raw `data_source` + a TABLE entity ingested with two TYPE_NUMBER fields (amount, qty).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Stats endpoint: `POST /ingestion/entities/datasets/stats {"items":[]}` → 201

## 4. Run protocol

1. Ingest a TABLE entity with NUMBER fields `amount` + `qty` → 200.
2. `POST /ingestion/entities/datasets/stats` with `{items:[{dataset_oddrn, fields:{<amount>:{name,number_stats:{…unique_count:4242}}}}]}` → 201.
3. `GET /api/datasets/{id}/structure` → `amount`.stats.number_stats.unique_count == 4242; `qty`.stats.number_stats == null.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-044`.

## 5. Assertions

- **PASS** when: the pushed `unique_count` reads back on `amount`, and `qty` (no stats pushed) has null number_stats.
- **FAIL** when: the stat is missing on `amount` (lost), or `qty` shows phantom stats.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-044.md`.

## Cross-references
- Source: F-095 Statistics ingestion endpoint; shape from IngestionModelGenerator.generateDatasetStatisticsList + a live probe.
- Plan: `lineage/odd-platform/test-plan.md` batch I5
- Re-probed with the read-the-config discipline after an earlier wrong "not tractable" dismissal.
