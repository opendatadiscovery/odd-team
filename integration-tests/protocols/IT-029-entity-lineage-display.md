---
id: IT-029
title: "The Lineage tab renders related (upstream) entities (and none when there is no lineage)"
gates:
  validates: [F-005]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-lineage-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-029 — Lineage graph traversal (F-005)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity **Lineage** tab (`/dataentities/{id}/lineage` → `GET /api/dataentities/{id}/lineage/upstream`)
renders the lineage graph, with each related entity as a labelled node, and none when the entity has no
lineage — data-driven. If it FAILS, a lineage relation does not reach the entity's Lineage read surface
(F-005 Lineage Graph Traversal). Verified live (2026-06-03): react-flow node labels are queryable text.
Source: feature-flow F-005.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityLineage(parentName)` — creates an upstream
  DATASET entity + a `lineage(parent_oddrn → child_oddrn=2001)` relation (verified image schema); or
  `clearEntityLineage()` for none.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT parent_oddrn FROM lineage WHERE child_oddrn = '//e2e-source-IT-002/db/tables/it002_table';`.
- API: `curl -s 'http://localhost:18080/api/dataentities/2001/lineage/upstream?lineage_depth=1'` → the parent in `upstream.nodes[]`.

## 4. Run protocol
1. SUCCESS: `seedEntityLineage("<parent>")`; open `/dataentities/2001/lineage`; wait for the
   `GET …/lineage/upstream` response; observe the graph nodes.
2. NEGATIVE: `clearEntityLineage()`; open `/dataentities/2001/lineage`; wait for lineage; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-029` (Playwright `e2e/specs/entity-lineage-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the upstream entity node label renders on the Lineage graph.
  (FAIL: the related entity never appears → the lineage relation does not reach the graph.)
- **NEGATIVE (PASS):** with no lineage, the related entity is absent (visible count 0).

## 6. Result log
- 2026-06-03 — authored; lineage API + Lineage-tab DOM ground-truth verified (node labels queryable);
  run via run-suite.sh IT-029 (see run-log/).
