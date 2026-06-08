---
id: IT-082
title: "Term Linked-Terms tab lists every term linked to this term (term↔term reverse-lookup)"
gates:
  validates: [F-152]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:term-linked-terms-tab.spec.ts"
plan_ref: I9
status: ready
---

# IT-082 — Term Linked-Terms tab reverse-lookup

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
The term detail "Linked terms" tab (`/terms/{id}/linked-terms`) lists every term linked TO this term
(the term↔term reverse-lookup), rendering each linked term's Name + Namespace (F-152 UC-001); a term
with zero linked terms shows the empty state (UC-005). If this regresses, the glossary's term-to-term
graph is invisible from the detail page — operators cannot see which terms relate to the one they're
reading.

Source: F-152 UC-001 / UC-005 (`LinkedTermsList.tsx`, `LinkedTerm.tsx:27-36`,
`GET /api/terms/{term_id}/linked_terms` → `ReactiveTermRepositoryImpl.getLinkedTermsByTargetTermId`).

> CORRECTION captured here: the F-152 flow claimed the endpoint was `/api/terms/{id}/term` returning
> 500/405 (UC-002 "contradicted"). That path was STALE. The live tab calls
> `GET /api/terms/{term_id}/linked_terms` (`TermApi.ts:807`), which returns 200 and works — verified
> green by this IT.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` running at `http://localhost:18080` (`ODD_STACK_EXTERNAL=1` for a shared stack).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Seed data** (ids 20820–20829; names prefixed `it082_`):
  1. namespace `it082_ns`.
  2. term `it082_HostTerm` (X — the tab opened) + term `it082_LinkedTerm` (B — must appear) in `it082_ns`.
  3. link row: `term_to_term(target_term_id = B.id, assigned_term_id = X.id, is_description_link=false)`.
     **Verified direction**: the paginated reverse-lookup is
     `WHERE assignedTermRelations.ASSIGNED_TERM_ID = {termId}` joined on
     `TARGET_TERM_ID = TERM.ID` (`ReactiveTermRepositoryImpl.java:466-499`), so the rendered term is
     the TARGET term and the opened tab's term is the ASSIGNED term.
  4. a third term `it082_EmptyHostTerm` with no `term_to_term` rows referencing it as assigned.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT 1 FROM term_to_term tt JOIN term x ON x.id = tt.assigned_term_id WHERE x.name = 'it082_HostTerm'` → one row.

## 4. Run protocol — what to run
1. Navigate `/terms/{HostTerm.id}/linked-terms`; await `GET /api/terms/{id}/linked_terms`.
2. Read the rendered list rows.
3. Navigate `/terms/{EmptyHostTerm.id}/linked-terms`; read the empty state.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/term-linked-terms-tab.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the host term's tab renders `it082_LinkedTerm` + its namespace `it082_ns`; the empty
  term's tab renders no linked-term row.
- **FAIL** when: the linked term/namespace is missing on the host tab, OR the endpoint 4xx/5xx.
- **KNOWN BUG pinned** (F-152 facet `copy_paste_empty_state_no_linked_entities_in_linked_terms_view`,
  `LinkedTermsList.tsx:81`): the empty state on the LINKED TERMS tab renders the copy-pasted
  "No linked entities" label. The empty test asserts that CURRENT (incorrect) copy — it goes RED when
  the label is fixed to "No linked terms" (flip-on-fix signal).

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-082.md`.

## Cross-references
- Source: F-152 UC-001 / UC-005 (+ corrected UC-002 endpoint)
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation spec: `integration-tests/e2e/specs/term-linked-terms-tab.spec.ts`
