---
id: IT-127
title: "Term overview renders when a description-linked term lives in a DIFFERENT namespace"
gates:
  validates: [F-151, F-056]
  enforces: []
  regresses: [PLT-006]
test_class: integration
stack: odd-minimal
automation: "e2e:term-cross-namespace-linked-term.spec.ts"
plan_ref: ""
status: ready
---

# IT-127 — Term overview with a cross-namespace linked term (#1746 / PLT-006)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

A term whose definition mentions a term in ANOTHER namespace (`[[OtherNamespace:Term]]` — the canonical
wiki-link example the in-app tooltip shows) must (a) serialize every linked term WITH its namespace on
`GET /api/terms/{id}` (spec contract: `TermRef.namespace` required), and (b) render its overview page.
On the unfixed platform (≤ main @ 921e8c98) two collaborating defects break this: the term-details SQL
aggregation reads the PARENT's namespace table alias instead of the linked terms'
(`ReactiveTermRepositoryImpl.getTermDetailsDto:211`) → `namespace: null` on the wire; and
`useTermWiki`'s `useState` lazy initializer dereferences `term.namespace.name` → an unhandled
`TypeError` white-screens the ENTIRE app (no error boundary). Operators cannot view, edit, or delete
the term from the SPA, with no in-app error. If this regresses, the documented cross-namespace
mention happy path is dead on arrival.

Case 2 additionally pins the FRONT-END guard in isolation: a forced contract-violating
`namespace: null` payload (route-intercepted, with an applied-guard counter) must degrade to an
unresolved mention — never a white screen — even though the fixed backend no longer emits null.

Source: issue #1746 (filed from PLT-006); CTRIB-002 reproduction (2026-06-10).

## 2. Preparation — build the test stand

- **Stack**: `odd-minimal` (platform + Postgres) at `http://localhost:18080`, `AUTH_TYPE=DISABLED`.
  Brought up by the e2e global-setup; `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed data** (`helpers/db.ts seedCrossNamespaceLinkedTerms`, idempotent):
  1. namespace `IT127-parent-ns` → term `IT127CrossNsParent`, definition
     `References [[IT127-linked-ns:IT127CrossNsLinked]] across namespaces.`
  2. namespace `IT127-linked-ns` → term `IT127CrossNsLinked`.
  3. `term_to_term(target_term_id=<parent>, assigned_term_id=<linked>, is_description_link=TRUE)`
     (the row the description-mention write path materialises).

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT count(*) FROM term_to_term WHERE target_term_id = <parentId>` → 1.

## 4. Run protocol — what to run

1. **Case 1 (backend fix, end-to-end):** open `/terms/{parentId}/overview`; capture the
   `GET /api/terms/{parentId}` response; read the rendered page.
2. **Case 2 (frontend guard):** intercept `GET /api/terms/{parentId}` and null every
   `terms[].term.namespace` (count what was nulled — the applied-guard); open the same page; read it.

**Automated rail**: `integration-tests/run-suite.sh IT-127` (Playwright
`e2e/specs/term-cross-namespace-linked-term.spec.ts`; default `ODD_SUT=working`).
RED baseline: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-127` (pre-fix main).

## 5. What it checks — assertions

- **Case 1 PASS:** every `terms[].term.namespace` on the wire is non-null AND the linked term carries
  ITS OWN namespace (`IT127-linked-ns`, not the parent's) AND the page renders (term name +
  `Definition` block visible) AND the `[[ns:term]]` mention rewrites to an `<a href*="/terms/{linkedId}">`
  deeplink AND zero `pageerror` events.
- **Case 2 PASS:** with `namespace: null` forced into ≥1 linked term (applied-guard `injected > 0`),
  the page still renders (term name + `Definition` visible) and no
  `TypeError: Cannot read properties of null` pageerror fires.
- **FAIL (the #1746 regression):** `namespace: null` on the wire (case 1), or a blank page /
  null-deref `pageerror` (either case).

## 6. Result log

Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-127.md`
(`date · stack_commit · runner · outcome · evidence · notes`).

- 2026-06-10 — authored during CTRIB-002. RED captured against the pre-fix SUT (built from
  main @ 921e8c98): case 1 — `terms[0].term.namespace == null` on the wire + blank page; case 2 —
  blank page (`TypeError: Cannot read properties of null (reading 'name')`). GREEN expected against
  the fixed working tree via `run-suite.sh IT-127`.

## Cross-references

- Issue: https://github.com/opendatadiscovery/odd-platform/issues/1746 (PLT-006)
- Work record: `contributor/CTRIB-002.md` (reproduction + root cause + plan)
- Related: IT-032 (term detail composition, same-namespace), IT-081 (description-mention deeplink on
  data entities), IT-082 (linked-terms tab)
- Unit-bucket sibling: `ReactiveTermRepositoryCrossNamespaceLinkTest` (odd-platform, Testcontainers)
- Automation spec: `integration-tests/e2e/specs/term-cross-namespace-linked-term.spec.ts`
