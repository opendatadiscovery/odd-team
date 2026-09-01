---
id: IT-003
title: "A tsquery metacharacter in catalog/dictionary search must not 500 or poison the session (UI e2e)"
gates:
  validates: [F-017, F-024]
  enforces: []
  regresses: [PLT-090, PLT-127]
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/search-tsquery-poisoning.spec.ts"
plan_ref: "I7 (search/session poisoning) — Tier-1 UI scenario; lead item of the e2e build-out. EXTENDED 2026-08-30 by CTRIB-060 (#1840 / ST-6) with operator-shaped payloads on both query surfaces."
status: ready
expected_result: "GREEN as of CTRIB-016 / odd-platform#1756 (metacharacters, ships 0.28.0) and CTRIB-060 / odd-platform#1840 (operator shapes, ships 1.0.0) — JooqFTSHelper.tsQuery strips the full tsquery operator set, so a `(`/`)`/`:`/`'`/`<` returns results or \"No matches found\" and never persists a poisoned session. Was RED (the unescaped to_tsquery 500); moved known-bugs -> feature-complete 2026-06-16. Flips on main when the CTRIB-016 PR merges."
---

# IT-003 — search tsquery poisoning (the persistent-500 footgun)

> **This is the integration test for the Search-poisoning class (F-017 + F-024).** It
> drives the real browser through the user flow a person actually hits — typing a name
> with a parenthesis or colon into the search box — and reads the persisted poison
> straight from Postgres as independent ground truth. One root cause, two user
> surfaces (catalog `/search` = PLT-090, dictionary `/termsearch` = PLT-127); the spec
> covers both as two test cases.

## 1. What this checks
Typing a tsquery metacharacter (`(`, `)`, `:`, `&`, `|`, `!`, `*`) into the catalog or
dictionary search box must return **results or "No matches found"** — never an HTTP
500, and never a **persistently** broken session. **Known bug (PLT-090 / PLT-127):**
`JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) inlines the typed query into a
raw `to_tsquery(?)` with **no operator escaping**, so a single metacharacter raises
Postgres `42601 syntax error in tsquery` → HTTP 500. The malformed string is
**persisted** into the `search_facets` session row (which has no owner binding —
PLT-090 defect 1), so **every later read of that session 500s again** until the
housekeeping TTL evicts the row (default 30 days). One keystroke permanently breaks a
bookmarked/shared search.

**Operator-facing consequence if it FAILS:** an operator searching for a real,
metachar-containing name (`user(id)`, `ratio:1`, `a/b`) gets a blank 500 with no
explanation; refreshing repeats it because the poison is persisted; and because the
session URL is shareable and unbound to any owner, a careless or malicious teammate
can permanently poison a colleague's saved search — a one-click, low-skill DoS.
Source: F-017 H-007 · F-024 H-009 · PLT-090 · PLT-127 · `JooqFTSHelper.java:164-168`.


## 1b. What the ST-6 extension adds (CTRIB-060 / #1840)

`JooqFTSHelper` no longer treats every punctuation mark as noise: `"a quoted phrase"`, a leading `-`
(exclusion) and the bare word `or` are now **operators**. That gives the fail-closed property a second family
of adversarial inputs — strings that *look* like operators but are syntactically incomplete:

`"unbalanced` · `trailing-` · `- -` · `or` · `or or` · `"" ""` · `-"` · `"-"` · `foo )( -"" or` · `?{0}`

The property under test is unchanged and is precisely why the query is compiled from Postgres constructors that
**cannot raise** (`to_tsquery` over the existing sanitiser, `phraseto_tsquery`, `plainto_tsquery`) with the
user's text always carried as a **bind**: whatever is typed, the user gets a page — results or "No matches
found" — never an HTTP 500 and never a persisted poison. The last payload (`?{0}`) is deliberate: `?` and `{}`
are *not* stripped by the sanitiser and are jOOQ's own plain-SQL bind/template markers, so it exercises the
boundary between the query text and the SQL template.

Both surfaces are covered because ST-6 made the sink the product's single query grammar — the catalog search
and the Dictionary (term) search must not drift into two dialects.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres; the platform image serves the bundled
  React UI at `http://localhost:18080`). The harness brings it up automatically;
  manually: `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED` (the odd-minimal default) — Tier-1 single-user
  clean flow; no login. Under DISABLED the search endpoints are anonymously reachable,
  which is also exactly the exposure that makes the poison a usable DoS.
- **Browser toolchain**: Node 18+ (workspace pins 24), then
  `cd integration-tests/e2e && npm install && npm run browser` (installs Chromium). One-time.
- **Seed data**: **none required.** The poison fails at `to_tsquery` parse time before
  any row is matched, so it reproduces on an empty catalog. The spec runs a well-formed
  control query first (`dataset` / `glossary`) purely to prove search + stack are
  healthy before the poison — distinguishing a broken stand from the bug.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- UI served: `curl -s http://localhost:18080/ | head` → HTML (`<div id="root">`)
- Search works for a well-formed query (the control):
  `curl -s -X POST http://localhost:18080/api/search -H 'content-type: application/json' -d '{"query":"dataset"}'`
  → `200` with a JSON `search_id` (NOT a 500).

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh known-bugs`
  (or `cd integration-tests/e2e && npx playwright test search-tsquery-poisoning`).
- **Manual (human-carryable)** — catalog surface:
  1. Open `http://localhost:18080/` and type `dataset` in the main search box, press Enter → results/"No matches found" load (the control; no error).
  2. Type `foo )(` in the search box and press Enter. Note the resulting `/search/{id}` URL.
  3. Navigate to `/` and back to that `/search/{id}` URL (reopen the session).
  - Repeat (1)–(3) for the **dictionary** surface starting at `http://localhost:18080/termsearch` (search box placeholder "Search terms…").
  - DB check (independent ground truth):
    `psql "$ODD_DB_URL" -c "SELECT query_string FROM search_facets ORDER BY last_accessed_at DESC LIMIT 1;"`
    → shows the persisted `foo )(` (the poison that 500s every later read).

## 5. What it checks — assertions
- **PASS** when: across the whole flow (submit **and** reopen, both surfaces) **no
  `/api/**` response is a 5xx** — the metacharacter is escaped and the search returns
  results or "No matches found".
- **FAIL (expected today)** when: any `/api/**` response is 500 — the `to_tsquery`
  parse failure. A 5xx on the **reopen** read specifically proves the persistent-DoS
  half (the session stays broken, not just a transient error).
- **FAIL (setup)** when: the well-formed control query 5xx's — the stack/search is
  broken before the poison is tested (fix the stand, not a real regression signal).

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Playwright trace/screenshot land under `integration-tests/e2e/test-results/` on failure
(gitignored — attach material captures to the log). Log fields:
`date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (the 5xx URLs + the persisted query_string) · notes`.

## Cross-references
- Source: F-017 H-007 · F-024 H-009 · PLT-090 (catalog `/api/search`) · PLT-127 (dictionary `/termsearch`) · `JooqFTSHelper.java:164-168`
- Related (NOT this test): PLT-109 / GHSA-rjp9-9vgm-q94c — the `ts_headline` `String.formatted` SQL-injection (different sink, separate severity class)
- Plan: `lineage/odd-platform/test-plan.md` batch I7 (search/session poisoning) + the Tier-1 e2e build-out
- Automation: `integration-tests/e2e/specs/search-tsquery-poisoning.spec.ts`
- Fix that flipped this GREEN: **CTRIB-016 / odd-platform#1756** — `JooqFTSHelper.tsQuery` now strips the full tsquery operator set before `to_tsquery` (one fix closes PLT-090 catalog + PLT-127 dictionary at the shared sink). Moved `known-bugs` -> `feature-complete` 2026-06-16; GREEN on the branch/working-tree SUT, flips on main when the PR merges. (PLT-090 defects 1 & 2 — session-row owner binding + cross-owner facet enumeration — are out of CTRIB-016's scope and remain.)
