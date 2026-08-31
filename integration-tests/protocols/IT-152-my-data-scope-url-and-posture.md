---
id: IT-152
title: "My-data scope: the URL contract survives a facet toggle, the tab strip is gone, the count renders, and the group is hidden under DISABLED"
gates:
  validates: [F-017, F-148]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:my-data-scope.spec.ts"
plan_ref: "contributor/CTRIB-062.md (ST-8 of #1825 / #1842); ADR adrs/drafts/unified-asset-search.md D4/D8/D10"
status: ready
---

# IT-152 — My-data scope: URL contract + retired tab strip + the DISABLED posture

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks

ST-8 (#1842) adds a **My data** scope group (`My Objects` · `Upstream of my data` · `Downstream of my data`,
each lineage direction with its own depth) to the catalog search, retires the last result tab, and moves the
match count into a results header. This protocol pins the four claims that are observable **without an owner
identity**, so they run on the shared `odd-minimal` stack:

1. **The `my_data` params survive a sidebar facet toggle.** They are URL-only params, so they must be merged
   back in `Search.tsx`'s facet→URL mirror alongside `sort` / `asset_kinds` / `entityClasses`. A URL-only
   param that is *not* in that merge object survives a page load and then **vanishes the moment any facet is
   toggled** — the #1858 defect class, and the single highest-risk wiring point in the slice. **Operator
   consequence if it FAILS:** you scope a search to your data, click one more filter, and silently get the
   whole catalog back while the sidebar still looks scoped.
2. **The result tab strip is gone.** ST-4 retired the seven class tabs; ST-8 retires the last one
   (`My Objects`), so no `role=tab` remains on `/search`. A one-tab strip is not a control.
3. **The match count survives that retirement.** The tab hint was the ONLY place `/search` showed a count, so
   the results header must render it — including `0 results` on an empty search, which distinguishes "nothing
   matched" from "still loading".
4. **"Clear All" clears the My-data scope and its depths, and keeps the query and the sort.** The scope is a
   FILTER — it lives in the Filters panel, next to Asset type — so the panel's single "Clear All" must take it,
   its two depths and the sidebar facets, while the query and the ordering (which are not filters) survive.
   This is a deliberate change to a shipped control: before ST-8 the handler rebuilt the URL from
   `{query, sort, myObjects}` and preserved the owned scope by design. **Operator consequence if it FAILS:** you
   press the one control that means "start over", the sidebar goes blank, and your results stay silently scoped
   to your own data — or, in the other direction, Clear All wipes the query you were still working on.
5. **The My-data group is HIDDEN under `auth.type=DISABLED`.** There is no user-owner identity on such a
   deployment, so nobody can ever use the filter. This mirrors what the manual already publishes for the twin
   surface — the Recommended panel "is hidden from the home page entirely" under DISABLED
   (`data-discovery/catalog-overview.md`). A permanently-dead control is clutter with no remedy; the
   contrasting state (signed in, *no Owner binding* → rendered, disabled, with the remedy named) needs an
   authenticating stack and is pinned by **IT-153**.

The owner-scoped half — each scope actually narrowing the result, and the three home panels deep-linking into
it — cannot be observed under DISABLED (`fetchAssociatedOwner()` resolves empty, so every My-data scope
returns an empty page by design) and is therefore **IT-153**, on a LOGIN_FORM stack.

## 2. Preparation — build the test stand

Fast tier (read-path/UI mechanics): direct platform-DB seeding is correct here — no collector semantics are
under test.

- **Stack**: the shared `odd-minimal` stack (`auth.type=DISABLED`), brought up by the suite runner.
  `ODD_STACK_EXTERNAL=1` to reuse a running one.
- **Seed data**: two searchable data entities sharing a query token, in this protocol's own id namespace
  (`21520`-`21521`, oddrn `//e2e-it152/`, names `it152mydata_*`), inserted with `dbQuery` + their
  `search_entrypoint` vectors, plus a tag on one of them so there is a sidebar facet to toggle.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Auth mode is DISABLED: `curl -fsS http://localhost:18080/api/info` → `"authType":"DISABLED"`
- Seed present: `SELECT count(*) FROM data_entity WHERE id IN (21520,21521);` → `2`

## 4. Run protocol — what to run

1. Open `/search?q=it152mydata` and wait for the result rows.
2. Read the results header; note the rendered count.
3. Assert no `role=tab` element exists anywhere on the page.
4. Navigate to `/search?q=it152mydata&my_data[]=UPSTREAM&upstream_depth=2`.
5. Toggle a sidebar facet (select the seeded tag), wait for the URL to settle, and re-read the URL.
6. From `/search?q=it152mydata&sort=NAME&my_data[]=UPSTREAM&upstream_depth=2&downstream_depth=3&statuses[]=3`,
   press **Clear All**; re-read the URL. `my_data`, both depths and `statuses` are gone; `q` and `sort` remain.
   Wait out the mirror debounce (~1.5s) and re-read once more — a late write must not resurrect the scope.
6. Open `/search` with a query that matches nothing and read the header.
7. Open `/search` and inspect the Filters sidebar for a "My data" control.

**Automated rail**: `integration-tests/run-suite.sh feature-complete` (or `run-suite.sh IT-152`).

## 5. What it checks — assertions

- **PASS** when: the URL still carries `my_data[]=UPSTREAM` **and** `upstream_depth=2` after the facet toggle,
  and now also carries the facet; the page renders **zero** `role=tab` elements; the results header shows
  `N results` matching the rendered rows and `0 results` for a no-match query; and the Filters sidebar
  contains **no** "My data" control under DISABLED.
- **FAIL** when: the scope or depth param disappears from the URL after a facet toggle (the #1858 regression —
  a silently unscoped search); any `role=tab` survives on `/search` (the retirement did not happen); no count
  renders (the count was lost with the tab strip); or a My-data control renders on a deployment where it can
  only ever be empty (the silent-empty defect class of IT-055 / IT-056, reproduced on a new surface).

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner · outcome (PASS|FAIL) · evidence (the captured URL + counts) · notes`.

## Cross-references
- Source: `contributor/CTRIB-062.md` (ST-8 spec R1/R4/R5/R7), ADR `adrs/drafts/unified-asset-search.md` D4/D8/D10
- Sibling: **IT-153** (the owner-scoped narrowing + panel deep-links, LOGIN_FORM)
- Re-pointed alongside this slice, NOT retired: **IT-068** (`search-class-tab-filter`) and **IT-151**
  (`search-url-facets`) both drove the retired class-tab strip; each now exercises the sidebar
  **Data entity type** filter (`#filter-entityClasses`), which is where class selection has lived since ST-4.
  Their claims are unchanged in substance and strength. IT-068's **PLT-147** null-details regression lock
  (a DATA_TRANSFORMER whose details DTO is null must still render as a result row and open its detail page)
  never touched a tab and stays exactly where it is — moving a live regression lock into an unrelated
  protocol would lose it, not preserve it. **IT-102** (`multilingual-i18n`) likewise moves its
  literals-outside-JSX guard from the tab labels to the sidebar filter labels, the same regression surface.
- Related: `IT-151` (the facet-URL contract this extends), `IT-150` (the query-URL contract beneath both)
