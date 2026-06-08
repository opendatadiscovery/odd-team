---
id: IT-087
title: "Query example details page: Overview renders body; Linked Entities / Linked Terms tabs show links"
gates:
  validates: [F-132]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:query-example-details-tabs.spec.ts"
plan_ref: I9
status: ready
---

# IT-087 — Query Example Details Tab Navigation (F-132)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The **Query Example Details** page (`/data-modelling/query-examples/{id}`) renders the **Overview**
(definition + query) and its **Linked Entities** / **Linked Terms** tabs surface the linked records.
If it FAILS, F-132 (details tab navigation) is broken — operators cannot read a snippet or see what
it is linked to. Covers F-132 UC-001 (single-fetch Overview render), UC-002 (Linked Entities tab),
UC-003 (Linked Terms tab). F-132 ships 0/11 verified promises; this is the first guard on its
read-render path. Source: feature-flow F-132.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data** (ids 20870-20879, `it087_` prefix; via `helpers/db.ts dbQuery`):
  1. `data_source(id=20871)` + `data_entity(id=20871, external_name='it087_orders_table',
     entity_class_ids={1}, type_id=1)` — the entity to link.
  2. `query_example(id=20870, definition, query, is_deleted=false)`.
  3. `data_entity_to_query_example(data_entity_id=20871, query_example_id=20870)` — Linked Entities.
  4. `term('it087_OrderStatus')` in namespace `it087-ns`, then
     `query_example_to_term(query_example_id=20870, term_id, is_description_link=false)` — Linked
     Terms (the details join requires `term.deleted_at IS NULL`; a fresh term satisfies it).
  Idempotent (DELETE children then example on the fixed ids; ON CONFLICT upsert for source/entity).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Details wiring: `GET /api/queryexample/20870` returns `linked_entities.items[].external_name ==
  it087_orders_table` and `linked_terms.items[].term.name == it087_OrderStatus`.

## 4. Run protocol
1. OVERVIEW: open `/data-modelling/query-examples/20870`; wait for `GET /api/queryexample/20870`;
   the default Overview tab shows the definition + query bodies (rendered via Markdown).
2. LINKED ENTITIES: click the **Linked Entities** tab (`role=tab`); observe the linked entity name.
3. LINKED TERMS: click the **Linked Terms** tab; observe the linked term name.

**Automated rail**: `integration-tests/run-suite.sh IT-087` (Playwright
`e2e/specs/query-example-details-tabs.spec.ts`).

## 5. What it checks — assertions
- **OVERVIEW (PASS):** header `Query Example #20870` + the definition body + the query body render.
- **LINKED ENTITIES (PASS):** the Linked Entities tab renders `it087_orders_table` (the entity's
  `internalName ?? externalName`).
- **LINKED TERMS (PASS):** the Linked Terms tab renders `it087_OrderStatus` (the term `name`).
- **FAIL:** the details page hangs on the loading page (single fetch broken), or a tab renders empty
  despite a seeded link (tab wiring or payload mapping broken).

## 6. Result log
- 2026-06-07 — authored; ground-truth verified (`GET /api/queryexample/20870` returns the linked
  entity `external_name` + linked term `name`). Run via `run-suite.sh IT-087`. PASS (3/3) against the
  shared odd-minimal stack.

## Cross-references
- Source: F-132 (feature-flows/detail/F-132.yaml) UC-001, UC-002, UC-003
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation: `integration-tests/e2e/specs/query-example-details-tabs.spec.ts`
