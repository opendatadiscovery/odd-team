---
id: IT-062
title: "Ingestion auth coverage matrix — under DISABLED every ingestion endpoint is anon-reachable (none returns 401/403)"
gates:
  validates: [F-094]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:ingestion-auth-matrix.spec.ts"
plan_ref: I5
status: ready
---

# IT-062 — F-094 Ingestion API Authentication Coverage Matrix

## 1. What this checks

`auth.ingestion.filter.enabled` reads like "authenticate the `/ingestion/` namespace", but the bean it
gates (`IngestionDataEntitiesFilter`) binds an EXACT-LITERAL `/ingestion/entities` POST matcher and
defaults OFF; the sibling mutating endpoints carry NO filter in any shipped config, and under UI auth modes
the whole `/ingestion/**` prefix is in `SecurityConstants.WHITELIST_PATHS`. IT-046 pins the
`/ingestion/entities` cell + anon collector mint. This protocol does the **broader endpoint matrix**:
under the shipped default `auth.type=DISABLED`, **every** ingestion endpoint is anonymously reachable —
none returns an auth rejection (401/403). All are LSN-029 pins of the current open posture.

| endpoint | method | observed (anon, DISABLED) | pin asserts |
|---|---|---|---|
| `/ingestion/entities/datasets/stats` | POST | 201 | exact 201 (anon side-effect) — UC-4 |
| `/ingestion/metrics` | POST | 201 | exact 201; a bogus bearer is ignored — UC-4 |
| `/ingestion/alert/alertmanager` | POST | 200 | exact 200 (Prometheus webhook open) — UC-5 |
| `/ingestion/dataentities?deg_oddrn=` | GET | 500 (reached handler) | NOT 401/403 |
| `/ingestion/datasources` | POST | 500 (reached handler) | NOT 401/403 |
| `/ingestion/entities` | POST | 200 | exact 200 (filter default-off) — UC-3 contrast |

stats/metrics/alertmanager assert the exact 2xx (request runs the side-effect path anonymously).
dataentities/datasources return a 500 under DISABLED — a server-side lookup / missing-session-collector
error, **not** an auth verdict; the load-bearing claim is the request is **not** rejected by an auth gate
(status ∉ {401,403}), i.e. it traversed the security chain and reached the handler. "Not 401/403" is the
honest characterization of "no auth coverage".

**Operator caveat:** on a network-reachable DISABLED deployment (the shipped default) EVERY ingestion
endpoint is open — an anonymous caller can push entities, dataset stats, metrics, and fire the AlertManager
webhook. DISABLED is for trusted networks only. Enabling `auth.ingestion.filter.enabled=true` closes ONLY
`/ingestion/entities`; the siblings stay open.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config:** DISABLED → SECURITY_RULES bypassed; a supplied credential is ignored.
- **Seed:** one raw `data_source` row (id 20620, oddrn `//e2e-it062/ds`) for the entities/stats/datasources
  payloads (`seedIngestionDataSource`). Idempotent.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- DISABLED posture confirmed behaviorally: a `POST /ingestion/metrics {items:[]}` with a bogus
  `Authorization: Bearer …` returns 201 (the credential is ignored), never 401.

## 4. Run protocol (each request carries NO Authorization header)

1. `POST /ingestion/entities/datasets/stats {items:[{dataset_oddrn, fields:{}}]}` → 201.
2. `POST /ingestion/metrics {items:[]}` → 201; repeat with a bogus bearer → still 201.
3. `POST /ingestion/alert/alertmanager {alerts:[]}` → 200.
4. `GET /ingestion/dataentities?deg_oddrn=//e2e-it062/ds` → status ∉ {401,403}.
5. `POST /ingestion/datasources {items:[{oddrn,name}]}` → status ∉ {401,403}.
6. `POST /ingestion/entities {data_source_oddrn, items:[valid]}` → 200 (filter default-off contrast).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-062`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/ingestion-auth-matrix.spec.ts`).

## 5. Assertions

- **PASS (current platform, DISABLED)** when: stats=201, metrics=201 (bogus-cred=201), alertmanager=200,
  dataentities ∉ {401,403}, datasources ∉ {401,403}, entities=200.
- **FLIPS** when: any endpoint starts returning 401/403 (the namespace got gated / a fail-closed default /
  the filter matcher broadened) — the posture changed; re-scope the matrix. This is the regression signal a
  future widened `auth.ingestion.filter` matcher or a DISABLED-default reversal would produce.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-062.md`.

## Cross-references
- Source: F-094 UC-3 (default-off entities, confirmed) · UC-4 (sibling stats/metrics uncovered, contradicted)
  · UC-5 (alertmanager uncovered, contradicted) · the per-endpoint coverage-matrix facet
  (`ingestion_filter_path_coverage_incomplete_endpoint_dimension`).
- Plan: `lineage/odd-platform/test-plan.md` batch I5 (ingestion); auth posture cross-refs I1.
- Related: IT-046 (the `/ingestion/entities` cell + anon collector/token mint) — this protocol adds the
  sibling-endpoint matrix; reference_odd_platform_auth_modes (DISABLED = permitAll).
