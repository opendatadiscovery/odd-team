---
id: IT-041
title: "Entity staleness — an entity not re-ingested past the period is flagged is_stale; re-ingest clears it"
gates:
  validates: [F-208]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:entity-staleness.spec.ts"
plan_ref: I5
status: ready
---

# IT-041 — F-208 Data Entity Staleness Indicator

## 1. What this checks

An entity not re-ingested for longer than the deployment stale-period is flagged `is_stale` (the
orange-clock signal), and re-ingesting clears it. **Operator consequence if it FAILS:** a dead
collector goes unnoticed — stale data is trusted as fresh. Verified live: the default period is active
even with NO `odd.data-entity-stale-period` env (a 30-day-old entity → stale), which disproves the
F-208-UC-2 "unset silently disables the signal" concern on this image.

## 2. Preparation

- **Stack:** `odd-minimal` (DISABLED). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** one ingested TABLE entity (via the ingestion-API helper); its `last_ingested_at` is then
  aged via `setEntityLastIngestedDaysAgo` (helpers/db.ts).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- Field present: `GET /api/dataentities/{id}` → body has `is_stale` + `last_ingested_at`

## 4. Run protocol

1. Ingest a TABLE entity `E`; `GET /api/dataentities/{id}` → `is_stale=false` (fresh).
2. `UPDATE data_entity SET last_ingested_at = NOW() - 30 days` for `E` → `GET` → `is_stale=true`.
3. Re-ingest `E` (refreshes `last_ingested_at`) → `GET` → `is_stale=false`.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-041`.

## 5. Assertions

- **PASS** when: fresh → not stale; 30-days-old → stale; re-ingest → not stale.
- **FAIL** when: an aged entity is not flagged (signal disabled), or re-ingest does not clear it.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-041.md`.

## Cross-references
- Source: F-208 UC-1 (stale signal) + UC-2 (unset-period not silently disabling — disproven here).
- Plan: `lineage/odd-platform/test-plan.md` batch I5
