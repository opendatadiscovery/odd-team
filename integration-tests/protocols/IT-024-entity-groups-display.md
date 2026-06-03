---
id: IT-024
title: "The data entity Overview renders the groups the entity belongs to (and none when ungrouped)"
gates:
  validates: [F-012]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-groups-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-024 — Group membership renders on the Overview (F-012)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity Overview "Data entity groups" section renders the **Data Entity Groups (DEGs) the entity is
a member of** when a membership exists, and none when there is no membership — the panel is
data-driven. If it FAILS, a group-membership assignment (F-012 Data Entity Group Membership) does not
reach the member entity's read surface. Source: feature-flow F-012. Verified live (2026-06-03): the
group name renders verbatim.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityGroupMembership(name)` — creates a DEG
  data_entity (class DATA_ENTITY_GROUP=8, type DAG=17) + a `group_entity_relations` row linking the
  group ODDRN → entity 2001 ODDRN (verified image schema); or `clearEntityGroupMembership()` for none.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT * FROM group_entity_relations WHERE data_entity_oddrn = '//e2e-source-IT-002/db/tables/it002_table';`.
- API projection: `curl -s http://localhost:18080/api/dataentities/2001` → `data_entity_groups[]` (snake_case wire).

## 4. Run protocol
1. SUCCESS: `seedEntityGroupMembership("<group>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe the "Data entity groups" section.
2. NEGATIVE: `clearEntityGroupMembership()`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-024` (Playwright `e2e/specs/entity-groups-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the group name renders on the Overview.
  (FAIL: the group never appears → the membership does not reach the Overview.)
- **NEGATIVE (PASS):** with no membership, the group name is absent (visible count 0).

## 6. Result log
- 2026-06-03 — authored; group-membership rendering ground-truth verified; run via run-suite.sh IT-024 (see run-log/).
