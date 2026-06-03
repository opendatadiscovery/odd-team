---
id: IT-034
title: "The term's Query-Examples tab lists linked query examples (and none when unlinked)"
gates:
  validates: [F-155]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/term-query-examples.spec.ts"
plan_ref: ""
status: ready
---

# IT-034 — Term query-example linkage (F-155)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The term detail **Query examples** tab (`/terms/{id}/query-examples` →
`GET /api/terms/{id}/queryexample`) lists the query examples linked to the term (definition + SQL),
and none when the term has no linked examples. If it FAILS, a query-example→term assignment (F-155
Term Query-Example Linkage) does not reach the term read surface. Verified live (2026-06-03): the
definition + SQL render. Source: feature-flow F-155.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedTermWithQueryExample(name, definition, query)` — seeds a term + a
  `query_example` + a `query_example_to_term` link, RETURNS the term id; `seedTermWithDefinition(name, def)`
  for a term with no examples.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s http://localhost:18080/api/terms/{id}/queryexample?page=1&size=20` → the example in `items[]`.

## 4. Run protocol
1. SUCCESS: `id = seedTermWithQueryExample("<term>", "<def>", "<sql>")`; open `/terms/{id}/query-examples`;
   wait for the `GET …/queryexample` response; observe.
2. NEGATIVE: `id2 = seedTermWithDefinition("<other>", "def")`; open `/terms/{id2}/query-examples`; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-034` (Playwright `e2e/specs/term-query-examples.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the linked query example's SQL renders on the term's Query-Examples tab.
- **NEGATIVE (PASS):** a term with no linked example lists none (visible count 0).

## 6. Result log
- 2026-06-03 — authored; query-example tab ground-truth verified (definition + SQL render); run via run-suite.sh IT-034 (see run-log/).
