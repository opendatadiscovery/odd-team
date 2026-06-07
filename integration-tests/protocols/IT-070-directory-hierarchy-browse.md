---
id: IT-070
title: "The Directory renders the ODDRN-prefix card grid and, on drill-down, each instance with its reflected connection properties"
gates:
  validates: [F-023]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/directory-hierarchy-browse.spec.ts"
plan_ref: "I9"
status: ready
---

# IT-070 — Directory hierarchy-driven catalog browse (F-023)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Directory is the catalog's **hierarchy-driven** browse surface (vs Search's query-driven one).
Level 1 (`GET /api/directory`, `Directory.tsx`) renders **one card per ODDRN prefix** with the
catalog-wide entity count; level 2 (`GET /api/directory/datasources?prefix=...`, `DataSourceList.tsx`)
lists each registered instance and derives its table columns from the response `properties` — so the
**ODDRN-reflected connection properties (host, database for Postgres) become visible table cells**
(the F-023 `oddrn_reflection_infrastructure_property_leak` facet at the UI rendering tier). If it
FAILS, the hierarchy browse / drill-down does not render. Source: feature-flow F-023 (UC-1, UC-2).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reuse the shared stack (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: a data source with a **postgres-shaped ODDRN**
  `//postgresql/host/<host>/databases/<db>` + one renderable entity under it (ids 20700/20701, via
  `dbQuery`). The postgres-shaped ODDRN parses to prefix `postgresql` (DirectoryServiceImpl
  `getDataSourcePrefix` → `OddrnPath.prefix`) → a real level-1 "Postgresql" card; level 2 reflects
  `{host, database}` (`getOddrnPathProperties`, Java reflection over `@PathField`). A non-parseable
  ODDRN would bucket to "Other" — the seed uses a parseable one so the real prefix card renders.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Level 1 reflects the seed: `curl -s http://localhost:18080/api/directory` → an item with
  `"prefix":"postgresql"`.
- Level 2 reflects the properties: `curl -s "http://localhost:18080/api/directory/datasources?prefix=postgresql"`
  → the seeded source with `properties: {host, database}`.

## 4. Run protocol
1. LEVEL 1: seed the source; open `/directory`; wait for `GET /api/directory`; observe the heading
   "Directories" + a "Postgresql" prefix card.
2. LEVEL 2: open `/directory/postgresql`; wait for `GET /api/directory/datasources?prefix=postgresql`;
   observe the seeded source name + its reflected `host` + `database` cells.
3. NEGATIVE: open `/directory/other`; wait for the `prefix=other` fetch; the postgres-parseable source
   must NOT appear under the (unparseable) "other" bucket.

**Automated rail**: `integration-tests/run-suite.sh IT-070` (Playwright `e2e/specs/directory-hierarchy-browse.spec.ts`).

## 5. What it checks — assertions
- **LEVEL 1 (PASS):** the "Directories" heading + the "Postgresql" prefix card render.
- **LEVEL 2 (PASS):** the registered instance renders by name + its ODDRN-reflected `host` and
  `database` properties render as table cells.
- **NEGATIVE (PASS):** the postgres source is absent from the "other" bucket (visible count 0).
- **FAIL:** any level fails to render its expected card/row/property.

## 6. Result log
- 2026-06-07 — authored; level-1 prefix card + level-2 reflected `{host, database}` ground-truthed live
  (curl); all 3 tests PASS via Playwright (`--reporter=line`, ODD_STACK_EXTERNAL=1).
