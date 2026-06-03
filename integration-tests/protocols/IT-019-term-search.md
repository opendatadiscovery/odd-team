---
id: IT-019
title: "Catalog-wide term search (Dictionary tab) finds a term by name (and not on a non-match)"
gates:
  validates: [F-024]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/term-search.spec.ts"
plan_ref: ""
status: ready
---

# IT-019 — Term search on the Dictionary tab (F-024)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Dictionary tab (`/termsearch`) is a **search-with-facets** surface: the operator types a
query into "Search terms…", the UI creates a term-search session (`POST /api/terms/search`) and
renders the matches (`GET /api/terms/search/{id}/results`). This IT verifies a seeded glossary
term is **findable by name** and that a **non-matching** query returns nothing — the real
UI→backend→DB term-search path. If it FAILS, the catalog-wide term browse (F-024) is broken.
Source: feature-flow F-024; `TermSearch.tsx` + `TermController` `/api/terms/search*`.

> Note (F-024 drift `doc_calls_dictionary_tab_a_list_code_renders_search_with_facets_empty_first_view`):
> the Business Glossary doc calls the Dictionary tab a flat "list", but the code renders an empty
> search-with-facets view until a query/facet is applied. This IT exercises the actual search.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedSearchableTerm(name, ns?, def?)` — seeds a namespace, a term,
  and (critically) the `term_search_entrypoint.term_vector` FTS vector. Term search matches the
  ENTRYPOINT vector, NOT the `term` table directly — a raw term INSERT is invisible to search.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed searchable: `POST /api/terms/search {"query":"<name>","filters":{}}` → `total >= 1`;
  `GET /api/terms/search/{search_id}/results` → the term in `items[]`.

> The Dictionary lists ALL terms on load (empty-query session); `TermSearchInput` fires the search
> on **Enter** only (`onChange` just tracks local text). So the test seeds TWO distinct searchable
> terms and presses Enter, asserting the match is shown AND the other is filtered out — proving the
> search actually filters rather than just rendering the initial all-terms list.

## 4. Run protocol
1. SUCCESS: `seedSearchableTerm("<name>")` + `seedSearchableTerm("<other>")`; open `/termsearch`;
   type `<name>` into "Search terms…" and press **Enter**; wait for the `GET …/results` response; observe.
2. NEGATIVE: open `/termsearch`; type a non-matching query (`ZZZNoSuchTermZZZ`) + Enter; wait for results; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-019` (Playwright `e2e/specs/term-search.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the searched term appears in the results table AND the other seeded term is
  filtered out (count 0). (FAIL: the term never appears, or filtering does not happen.)
- **NEGATIVE (PASS):** a non-matching query returns neither term (count 0).

## 6. Result log
- 2026-06-03 — authored; API + UI flow ground-truth verified (POST/GET 200, term rendered) before
  authoring; run via run-suite.sh IT-019 (see run-log/).
