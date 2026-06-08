---
id: IT-081
title: "[[ns:term]] description mention renders as a clickable term deeplink (is_description_link=TRUE)"
gates:
  validates: [F-056]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:term-description-mention-autolink.spec.ts"
plan_ref: I9
status: ready
---

# IT-081 — [[ns:term]] description-mention auto-link renders as a term deeplink

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks
A data-entity internal description containing a `[[namespace:term]]` mention of an EXISTING term
renders, on the entity Overview, as a clickable hyperlink to that term's detail page — and the
backing `data_entity_to_term` row carries `is_description_link = TRUE` (F-056 UC-5 render/deeplink +
UC-1 persisted ground truth). If this regresses, operators reading an entity description see raw
`[[ns:term]]` markers instead of a navigable glossary link, and the description-mention side-channel
(the whole point of F-056) is silently broken on the read surface.

Source: F-056 use_cases UC-5 (`useTermWiki.transformDescriptionToMarkdown:186-199`,
`Markdown.tsx` TermLink → `styled('a')`), UC-1 (`is_description_link=TRUE`).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres) already running at `http://localhost:18080`. For an
  external stack export `ODD_STACK_EXTERNAL=1` (never bring up/tear down a shared stack).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default) — the admin principal holds all perms.
- **Seed data** (ids 20810–20819; all names prefixed `it081_`):
  1. namespace `it081_ns`.
  2. term `it081_Customer` in `it081_ns` with a definition.
  3. data_entity id 20810 (source 20810) whose `internal_description` contains `[[it081_ns:it081_Customer]]`.
  4. `data_entity_to_term(data_entity_id=20810, term_id=<termId>, is_description_link=TRUE)`.
  (The spec seeds this persisted state directly via `dbQuery`; it is the state the description-save
  write-path `TermServiceImpl.handleDataEntityDescriptionTerms` produces.)

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present: `SELECT is_description_link FROM data_entity_to_term WHERE data_entity_id = 20810` → one row, `true`.

## 4. Run protocol — what to run
1. (DB ground truth) Confirm the link row exists with `is_description_link = TRUE`.
2. Navigate to `/dataentities/20810/overview`; await `GET /api/dataentities/20810`.
3. Read the rendered description block.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/term-description-mention-autolink.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the description renders an `<a href*="/terms/{termId}">it081_Customer</a>` link AND
  the raw `[[it081_ns:it081_Customer]]` markers do NOT appear in the rendered DOM AND the DB row has
  `is_description_link = TRUE`.
- **FAIL** when: the raw `[[ns:term]]` markers render literally (no rewrite), OR no anchor to
  `/terms/{id}` is present, OR the link row is missing / `is_description_link = FALSE`.

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-081.md`
(`date · stack_commit · runner · outcome · evidence · notes`).

## Cross-references
- Source: F-056 UC-5 / UC-1; retrieval note `lineage/odd-platform/retrieval-feedback/2026-06-03-term-description-mention-test-coverage.md`
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation spec: `integration-tests/e2e/specs/term-description-mention-autolink.spec.ts`
