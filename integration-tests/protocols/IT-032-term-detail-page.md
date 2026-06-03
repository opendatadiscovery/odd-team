---
id: IT-032
title: "A glossary term's detail page renders its name + definition (term-specific)"
gates:
  validates: [F-151]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/term-detail-page.spec.ts"
plan_ref: ""
status: ready
---

# IT-032 — Term detail page composition (F-151)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
A glossary term's **detail page** (`/terms/{id}/overview` → `GET /api/terms/{id}`) renders the term's
name + definition, and shows only THIS term's content (another term's definition does not appear). If
it FAILS, the term detail composition (F-151) is broken. Distinct from IT-019 (term SEARCH) and IT-016
(term-to-entity linkage). Verified live (2026-06-03): name + definition render verbatim. Source:
feature-flow F-151.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedTermWithDefinition(name, definition)` — seeds a term (+ namespace)
  and RETURNS its id (the detail route needs the id); idempotent. Seed a second term to prove
  term-specificity.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s http://localhost:18080/api/terms/{id}` → the term name + definition.

## 4. Run protocol
1. SUCCESS: `id = seedTermWithDefinition("<A>", "<defA>")` + seed a second term; open
   `/terms/{id}/overview`; wait for `GET /api/terms/{id}`; observe.
2. NEGATIVE: same seed; assert the SECOND term's definition is absent on the first term's page.

**Automated rail**: `integration-tests/run-suite.sh IT-032` (Playwright `e2e/specs/term-detail-page.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the term name and its definition render on the detail page.
- **NEGATIVE (PASS):** another term's definition does not appear (visible count 0) — term-specific.

## 6. Result log
- 2026-06-03 — authored; term detail page ground-truth verified (name + definition render); run via run-suite.sh IT-032 (see run-log/).
