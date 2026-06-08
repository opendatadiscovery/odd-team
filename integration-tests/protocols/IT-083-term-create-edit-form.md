---
id: IT-083
title: "Add term dialog creates a term (UI write): fill Name/Namespace/Definition → row + detail page"
gates:
  validates: [F-154]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:term-create-edit-form.spec.ts"
plan_ref: I9
status: ready
---

# IT-083 — Term Create form (Add term dialog) is a true UI write flow

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
The "Add term" dialog on the Dictionary creates a glossary term end-to-end: filling Name + Namespace
+ Definition and submitting writes a `term` row and navigates to the new term's detail page where its
name renders (F-154 H-001); a blank/whitespace Name keeps the submit button disabled (H-012). If this
regresses, operators cannot author glossary terms through the UI — the primary glossary-authoring
entry point is broken.

Source: F-154 H-001 / H-012 (`TermSearch/TermForm/TermsForm.tsx`, `createTerm` thunk →
`POST /api/terms`, `navigate(termDetailsPath(response.id))`).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` running at `http://localhost:18080` (`ODD_STACK_EXTERNAL=1` for a shared stack).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default) — the admin principal holds `TERM_CREATE`
  (verified via `GET /api/identity/whoami`).
- **Seed data** (ids 20830–20839; names prefixed `it083_`):
  1. namespace `it083_ns` PRE-SEEDED — so the NamespaceAutocomplete shows a real, selectable option
     (deterministic; independent of the novel-namespace create side-channel, a separate F-154 facet).
  2. any prior `it083_NewTerm` deleted up-front (FK-safe: search-entrypoint + link rows first) so the
     run is repeatable on the shared stack.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Namespace present: `SELECT 1 FROM namespace WHERE name = 'it083_ns'` → one row.
- Term absent: `SELECT count(*) FROM term WHERE name = 'it083_NewTerm'` → 0.

## 4. Run protocol — what to run
1. Navigate `/termsearch`.
2. Click the **Add term** CTA → the dialog opens.
3. Fill Name = `it083_NewTerm` (placeholder "Start enter the name").
4. In Namespace (placeholder "Namespace"), type `it083_ns` and click the matching listbox option.
5. Fill Definition (the `#md-editor` textarea).
6. Click **Add term** (submit) — enabled only when the form is valid.
7. Await `POST /api/terms` and the navigation to `/terms/{id}/...`.
8. (H-012 corner) repeat steps 2–6 with a whitespace-only Name and observe the disabled submit.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/term-create-edit-form.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: `POST /api/terms` returns 2xx; the app navigates to `/terms/{id}/...`; the term name
  renders on the detail page; the DB has exactly one `term` row for (`it083_NewTerm`,`it083_ns`) with
  the typed definition. AND: with a whitespace-only Name, the submit button stays disabled.
- **FAIL** when: the dialog does not open, the submit stays disabled with valid input, the POST 4xx/5xx,
  no navigation occurs, or no `term` row is created.

> NB the create returns HTTP 200 (not the spec's 201 — F-154 H-011 status-code drift). The assertion
> accepts any 2xx so it validates the create flow without coupling to the drift (which is pinned
> separately).

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-083.md`.

## Cross-references
- Source: F-154 H-001 / H-012 (status-code drift H-011)
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation spec: `integration-tests/e2e/specs/term-create-edit-form.spec.ts`
