---
id: IT-033
title: "The term's Linked-entities tab lists entities linked to the term (and none when unlinked)"
gates:
  validates: [F-002]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/term-linked-entities.spec.ts"
plan_ref: ""
status: ready
---

# IT-033 — Term linked-entities reverse view (F-002 term-side)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The term detail **Linked entities** tab (`/terms/{id}/linked-entities` →
`GET /api/terms/{id}/linked_entities`) lists the entities linked to the term, and none when the term
has no links — the reverse-lookup of the term-to-entity linkage (F-002). This is a DISTINCT surface +
code path from IT-016 (which verifies the entity→term direction). Verified live (2026-06-03): the
linked entity renders. Source: feature-flow F-002.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedTermLinkedToEntity(name)` — links entity 2001 to a term (via
  data_entity_to_term) and RETURNS the term id (the route needs it); `seedTermWithDefinition(name, def)`
  for an unlinked term.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s http://localhost:18080/api/terms/{id}/linked_entities?page=1&size=20` → the entity in `items[]`.

## 4. Run protocol
1. SUCCESS: `id = seedTermLinkedToEntity("<term>")`; open `/terms/{id}/linked-entities`; wait for the
   `GET …/linked_entities` response; observe.
2. NEGATIVE: `id2 = seedTermWithDefinition("<other>", "def")`; open `/terms/{id2}/linked-entities`; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-033` (Playwright `e2e/specs/term-linked-entities.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the linked entity (it002_table) is listed on the term's Linked-entities tab.
- **NEGATIVE (PASS):** a term with no links lists no entity (visible count 0).

## 6. Result log
- 2026-06-03 — authored; linked_entities API + tab ground-truth verified; run via run-suite.sh IT-033 (see run-log/).
  NOTE: linked_columns (F-153) deferred — GET /api/terms/{id}/linked_columns 500s (NPE on the column's
  null parent dataEntityPojo; needs the full column→dataset_structure→data_entity chain). Logged in
  PHASE3-BUILDOUT Discovered findings.
