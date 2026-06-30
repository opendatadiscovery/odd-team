---
id: IT-150
title: "Search query lives in the URL (?q=) — shareable, bookmarkable, back/forward-correct (ST-1a / D10)"
gates:
  validates: [F-017]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:search-url-state.spec.ts"
plan_ref: "contributor/CTRIB-048.md (ST-1a of #1825 search overhaul); ADR adrs/drafts/unified-asset-search.md D10/D9"
status: ready
---

# IT-150 — Search state in the URL (F-017 / ST-1a / ADR D10)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
ST-1a (the first slice of the #1825 search overhaul) moves the search **query** into the URL as a parametrised
query param (`?q=`). The platform's primary discovery surface (`/search`) becomes **stateless, shareable,
bookmarkable, and back/forward-correct**: committing a query (the home-hero box or the search-page box)
navigates to the canonical **`/search?q=<query>`** — **no session id in the URL** — and the page runs the
search **from the URL**. This retires the expiring `/search/{sessionId}` share handle (the IT-125 / #1760
dead-link class). Legacy `/search/{sessionId}` deep-links keep working (D9) — covered by **IT-125** (unchanged).
If this FAILS, the shareable/bookmarkable search contract (ADR D10) is broken.

> The main query box has placeholder "Search" exactly and searches on Enter (the sidebar facets are
> "Search by name"). Catalog search matches the FTS `search_entrypoint.data_entity_vector`; the helper
> `seedSearchableEntity(id, name)` seeds the entity + its entrypoint vector.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner.
- **Seed data**: `seedSearchableEntity(2150,"IT150UrlAlpha")` + `seedSearchableEntity(2151,"IT150UrlBeta")`
  (IT-150-specific ids, never clobber the shared 2001/2022).

## 3. Readiness check
- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- `POST /api/search {"query":"IT150UrlAlpha","filters":{}}` → `total >= 1`.

## 4. Run protocol
1. **Commit → ?q= URL:** open `/search`; type `IT150UrlAlpha` + Enter; observe the URL becomes
   `/search?q=IT150UrlAlpha` (pathname `/search`, no `/{uuid}`) and the match renders, the other is filtered.
2. **Share/bookmark:** open `/search?q=IT150UrlAlpha` in a fresh context (no prior session); observe the query
   restored in the box and the result rendered — with no pre-existing session.
3. **Back/forward:** from `?q=IT150UrlAlpha`, commit `IT150UrlBeta`; `goBack()` → URL `?q=IT150UrlAlpha` and
   the Alpha result re-runs; `goForward()` → `?q=IT150UrlBeta`.
4. **Fail closed (unknown params):** open `/search?q=IT150UrlAlpha&foo=bar&utm_source=x`; observe the box
   restores the query (`IT150UrlAlpha`) and the search runs — the unknown extras (`foo`, `utm_source`) are
   ignored, never fatal. (A genuinely malformed `%`-encoding is a server-side 400 before the SPA loads — the
   framework-status contract, covered by IT-125, not an SPA concern.)

**Automated rail**: `integration-tests/run-suite.sh IT-150` (Playwright `e2e/specs/search-url-state.spec.ts`).

## 5. What it checks — assertions
- **Commit (PASS):** `page.url()` matches `/search?…q=IT150UrlAlpha`, pathname `=== '/search'`; the match is
  visible; the non-match count is 0. (FAIL: the URL is `/search/{uuid}`, or the query is absent from the URL.)
- **Share (PASS):** loading the param URL with no prior session restores the query into the box and renders the
  result.
- **Back/forward (PASS):** back/forward change the `?q=` URL AND re-run the corresponding query.
- **Fail-closed (PASS):** a URL with unknown extra params (valid encoding) restores the query + runs the
  search, ignoring the extras (never a crash).

## 6. RED proof (the base, pre-ST-1a)
`ODD_SUT=ref:main` (CTRIB-048 base, `2f9734e1`): committed queries navigate to `/search/{sessionId}` (no `?q=`),
so the URL / share / back-forward assertions FAIL — the contract does not exist yet. GREEN on the working-tree SUT.

## 7. Result log
- 2026-06-30 — authored for CTRIB-048 / ST-1a (#1825). Ground-truth verified against the working-tree SUT
  (`odd-platform:odd-team-sut-ctrib048`); RED proof on `ODD_SUT=ref:main`. See run-log/.
