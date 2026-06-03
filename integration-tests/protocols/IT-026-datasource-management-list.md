---
id: IT-026
title: "The data source management list renders configured data sources (and not phantom ones)"
gates:
  validates: [F-031]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/datasource-management-list.spec.ts"
plan_ref: ""
status: ready
---

# IT-026 — Data source management list (F-031)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The configuration-audience management list (`/management/datasources` → `GET /api/datasources`)
renders each **configured data source** by name, and a name belonging to no data source is not
listed — the list is data-driven. If it FAILS, configured data sources do not reach the management
read surface (F-031 Data Source Lifecycle Management). Source: feature-flow F-031;
`Management/DataSourcesList`. Verified live (2026-06-03): the source name renders verbatim.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedDataSource(id, name)` — inserts a `data_source` (distinct id so it
  never collides with the entity-seed source 2001).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT name FROM data_source WHERE id = 2026;`.
- API: `curl -s 'http://localhost:18080/api/datasources?page=1&size=30'` → the source in `items[]`.

## 4. Run protocol
1. SUCCESS: `seedDataSource(2026, "<name>")`; open `/management/datasources`; wait for the
   `GET /api/datasources` response; observe the list.
2. NEGATIVE: same seed; assert a name belonging to no source (`IT026GhostSource`) is absent.

**Automated rail**: `integration-tests/run-suite.sh IT-026` (Playwright `e2e/specs/datasource-management-list.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the configured data source name renders in the management list.
  (FAIL: the source never appears → it does not reach the management list.)
- **NEGATIVE (PASS):** a name belonging to no data source is not listed (visible count 0).

## 6. Result log
- 2026-06-03 — authored; data-source list rendering ground-truth verified; run via run-suite.sh IT-026 (see run-log/).
