---
id: IT-016
title: "The data entity Overview renders linked glossary terms (and none when unlinked)"
gates:
  validates: [F-002]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-terms-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-016 — Linked terms render on the Overview (F-002)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity Overview renders glossary **terms linked to the entity** when a link exists, and none when
there is no link — the terms panel is data-driven. If this FAILS, a term-to-entity assignment (F-002
Term-to-Entity Linkage) does not reach the entity read surface. Source: feature-flow F-002.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityTerm(name, def, ns)` — seeds a `namespace`,
  a `term`, and a `data_entity_to_term` link (verified image schema); or `clearEntityTerms()` for none.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT t.name FROM data_entity_to_term de JOIN term t ON t.id = de.term_id WHERE de.data_entity_id = 2001;`.

## 4. Run protocol
1. SUCCESS: `seedEntityTerm("<term>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe.
2. NEGATIVE: `clearEntityTerms()`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-016` (Playwright `e2e/specs/entity-terms-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the linked term name is visible on the Overview.
  (FAIL: term name never appears → the linkage does not reach the Overview.)
- **NEGATIVE (PASS):** with no link, the term name is absent (count 0).

## 6. Result log
- 2026-06-03 — authored; run via run-suite.sh IT-016 (see run-log/).
