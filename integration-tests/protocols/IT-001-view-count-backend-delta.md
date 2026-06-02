---
id: IT-001
title: "Data-entity page view increments view_count by exactly +1 per backend call"
gates:
  validates: [F-001]
  enforces: []
  regresses: [PLT-104]
test_class: integration
stack: odd-minimal
automation: P-001
plan_ref: "canary (proves the framework) + F-001 backend pin"
status: ready
---

# IT-001 — view_count backend per-call delta

> **Canary protocol.** Proves the integration-test framework end-to-end against the
> known-good `P-001` probe (prepare → readiness → run → check → log). Also the backend
> half of the F-001 Popular-Entities regression; the UI `+2` doubling (LSN-017) is a
> separate browser-stack test (batch I9).

## 1. What this checks
Five sequential `GET /api/dataentities/{id}` calls increment `data_entity.view_count`
by exactly **+5** (the documented +1 per call). **If it FAILS** (delta ≠ 5), the Popular
Entities ranking is driven by a miscounting backend — operators are shown the wrong
"most popular" entities. Source: F-001 H-002/H-003 · PLT-104 · LSN-017.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres), `AUTH_TYPE=DISABLED` (default). The
  probe runtime brings it up; manually:
  `docker compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Seed**: insert `data_source(id=1001)` + `data_entity(id=1001, view_count=0)` (the SQL
  is `P-001` arrange).

## 3. Readiness check — is the stand ready?
- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- `SELECT view_count FROM data_entity WHERE id=1001;` → `0`

## 4. Run protocol — what to run
1. `GET http://localhost:18080/api/dataentities/1001` — five times, ~100 ms apart.
- **Automated rail**: `integration-tests/run-suite.sh IT-001` (runs probe `P-001`).

## 5. What it checks — assertions
- **PASS** when: `final_view_count - initial_view_count == 5`.
- **FAIL** when: delta ≠ 5 — e.g. UI-style `+2`/call reaching the backend, or `0` (not counted).

## 6. Result log
Appended to `integration-tests/run-log/{date}-IT-001.md`; machine trace at
`lineage/odd-platform/probe-runs/{date}-P-001.yaml`.

## Cross-references
- Source: F-001 H-002/H-003 · PLT-104 · LSN-017
- Plan: `lineage/odd-platform/test-plan.md` (F-001 P1 row; canary for the I-suite framework)
- Automation: `lineage/odd-platform/probes/P-001.yaml`
