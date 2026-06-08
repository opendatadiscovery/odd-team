---
id: IT-086
title: "Creating a query example via the authoring dialog renders on details + persists in DB"
gates:
  validates: [F-131]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:query-example-authoring-dialog.spec.ts"
plan_ref: I9
status: ready
---

# IT-086 — Query Example Authoring Dialog: create flow (F-131)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The **Query Example Authoring Dialog** create path drives the real UI→backend→DB write: open the
Create dialog from the Query Examples list, fill Definition + the Query Markdown editor, submit, and
the new example both **renders on its details page** and **exists in the DB**. If it FAILS, F-131
(authoring dialog) is broken — operators cannot create query snippets through the UI. Covers F-131
UC-002 (one submit → exactly one example, amplification_factor 1) + UC-012 (dialog auto-closes +
routes to the fresh details page). F-131 ships 0/12 verified promises; this is the first guard on its
happy path. Source: feature-flow F-131.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED → every permission granted, so the gated "Add query
  example" button renders). Brought up by the runner during the e2e run.
- **Seed data**: NONE required to create. The spec only does idempotent cleanup of any prior run's
  example matched by its unique `definition` (`it086_ … it086zauth`), before and after. The created
  id is auto-assigned (bigserial).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Create wiring: `POST /api/queryexample {"definition":"…","query":"…"}` → HTTP 200 +
  `QueryExampleDetails` with an `id`; the row is then readable at `GET /api/queryexample/{id}`.

## 4. Run protocol
1. Open `/data-modelling/query-examples`; click the **Add query example** button.
2. In the dialog, fill the Definition field (`<input name="definition">` — the "Definition" label is
   a styled span, not a `<label for>`) and the Query Markdown editor (`<textarea>` inside
   `#md-editor`).
3. Click the submit button **Add query example** (enabled only once both fields are non-empty after
   trim — `disabled={!formState.isValid}`). This fires `POST /api/queryexample` and on success
   navigates to `/data-modelling/query-examples/{newId}`.

**Automated rail**: `integration-tests/run-suite.sh IT-086` (Playwright
`e2e/specs/query-example-authoring-dialog.spec.ts`).

## 5. What it checks — assertions
- **PASS (UI):** after submit, the details page header `Query Example #{newId}` renders, and the
  Overview shows the authored definition + query body verbatim.
- **PASS (DB ground truth):** exactly one `query_example` row exists with the authored `definition`
  (`is_deleted=false`), its `id` equals the id the POST returned, and its `query` matches verbatim.
- **FAIL:** the dialog does not open / submit stays disabled / no navigation to the details page; or
  zero or more-than-one rows are persisted; or the persisted body differs from what was typed.

## 6. Result log
- 2026-06-07 — authored; ground-truth verified (`POST /api/queryexample` stores definition+query
  verbatim, row immediately readable). Selector note: Definition = `input[name="definition"]`, Query
  = `#md-editor textarea`. Run via `run-suite.sh IT-086`. PASS (1/1) against the shared odd-minimal
  stack.

## Cross-references
- Source: F-131 (feature-flows/detail/F-131.yaml) UC-002, UC-012
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation: `integration-tests/e2e/specs/query-example-authoring-dialog.spec.ts`
