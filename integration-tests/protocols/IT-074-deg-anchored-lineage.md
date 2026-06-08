---
id: IT-074
title: "DEG-anchored lineage: the Group lineage tab renders member lineage; empty-members → 404"
gates:
  validates: [F-016]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:deg-anchored-lineage.spec.ts"
plan_ref: I6
status: ready
---

# IT-074 — DEG-Anchored Lineage (F-016)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
A Data Entity Group's **Group lineage** view (`/dataentities/{degId}/lineage`, dispatched to the DEG
branch because the entity's class set contains ENTITY_GROUP) renders the lineage relationships AMONG the
group's member entities — each member as a labelled node. And: a DEG that exists but has zero resolvable
members returns the empty-membership **404** (one of the three conditions of F-016's 404-conflation facet).
If the render FAILS, the DEG-anchored read path (`GET /api/dataentitygroups/{id}/lineage` →
`LineageServiceImpl.getDataEntityGroupLineage`, the recursive member-CTE + bidirectional-IN edge filter)
does not reach the DEG Group-lineage UI. Source: feature-flow F-016 (UC-001, UC-005).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Already-running shared stack reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (own ids `2074x`, namespace `//e2e-it074/`, names `it074_*`; idempotent — in the spec's
  `seedDeg(withMembers)`):
  - data_source `20740`; DEG `20741` (class `{8}`, type `17`); members `20742`/`20743` (class `{1}`, type `1`).
  - `group_entity_relations(group_oddrn=DEG, data_entity_oddrn=member, is_deleted=false)` for both members
    (only when `withMembers`).
  - inter-member `lineage(parent=it074_src → child=it074_tgt)` (both endpoints members → survives the
    bidirectional-IN edge filter).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API (with members): `curl -s http://localhost:18080/api/dataentitygroups/20741/lineage` →
  200, `items[0].nodes[]` contains `it074_src` + `it074_tgt`, `edges:[{source_id,target_id}]`.
- API (no members): same call after deleting the memberships → `404` `USR002` "Data entity group ... not found".

## 4. Run protocol
1. UC-001 (render): `seedDeg(true)`; open `/dataentities/20741/lineage`; wait for `GET
   /api/dataentitygroups/{id}/lineage` (assert 200); observe the member nodes.
2. UC-005 (empty-members 404): `seedDeg(false)`; open `/dataentities/20741/lineage`; wait for the same
   GET (assert 404); observe no member node renders.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1
npx playwright test specs/deg-anchored-lineage.spec.ts --reporter=line`.

## 5. What it checks — assertions
- **UC-001 (PASS):** the DEG-lineage GET is 200 AND both member nodes (`it074_src`, `it074_tgt`) render
  visibly on the DEG canvas. (FAIL: a member is absent → the DEG read path does not reach the canvas.)
- **UC-005 (PASS):** the DEG-lineage GET is 404 for a member-less DEG AND no member node renders.
  (FAIL: empty membership did NOT 404 → the conflation contract changed.)

## 6. Result log
- 2026-06-07 — authored; stack_commit `dd52f520`; runner AI (Claude). Outcome PASS (2/2). Evidence: DEG
  lineage API empirically verified (200 with 2 nodes + edge for with-members; 404 for zero members — both
  curl'd before asserting). EMPIRICAL CORRECTION made during authoring: a DEG with members but NO edge
  returns 200 with one singleton-node stream per member (members still render), so the genuine empty/error
  case is empty-MEMBERSHIP → 404, not no-edge → empty. The spec asserts the verified behaviour.
