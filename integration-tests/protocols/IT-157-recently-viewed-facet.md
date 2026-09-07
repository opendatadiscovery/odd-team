---
id: IT-157
title: "Last viewed scope: the search narrows to the assets I opened, orders them newest-first, survives the mirror / Clear All / a saved search, resolves a shared link to the recipient's own history, and the Recently Viewed panel's View all opens exactly that list (#1844 / #1832)"
gates:
  validates: [F-017]            # the catalog-search promise node; F-017-UC-18 (added in the CTRIB-067 ontology step)
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:recently-viewed-facet.spec.ts"
plan_ref: "contributor/CTRIB-067.md (ST-10 of #1825 / #1844, closing #1832); ADR adrs/drafts/unified-asset-search.md D3/D8/D10/D11"
status: ready
---

# IT-157 — the Last-viewed (recency) scope, driven as a user (ST-10 / #1844 / CTRIB-067)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 0. LANE — `pending-merge` until odd-platform#1844's PR merges

This protocol asserts behaviour that is FALSE on `origin/main @ 0238005c`: there is no Last-viewed control, the
`recently_viewed` / `viewed_after` / `viewed_before` params are unknown (dropped on parse, so a deep link lists the
whole match set), there is no `Recently viewed` ordering and the Recently Viewed panel has no View all. It sits in
`pending-merge` (shared spec repo, per-stream SUTs — `pillars/tests/pillar.md` "`pending-merge` is not a bucket
either") and **graduates to `feature-complete` + `ui-e2e` at CTRIB-067's GATE-2 close-out**, which cites the first
`feature-complete` run-log line that executed it (the OWNER rule `TST-067` installed).

## 0a. ISOLATION — read this before adding a case

Under `auth.type=DISABLED` there is exactly ONE recently-viewed bucket (the `__shared__ / DISABLED` sentinel), and
**IT-149 drives the same bucket** for the home-page panel; both live in `feature-complete` once this graduates. So
this protocol **never empties the bucket**. It seeds and asserts its own token's rows, and it excludes by WINDOW,
never by deletion. Case 9's single `DELETE` removes one of THIS spec's own rows and re-records it immediately.

The truly-empty-history state — the control disabled with *"You haven't opened any assets yet."* — is therefore
proven in **vitest**, where the signal is mocked, and deliberately NOT here: proving it in the browser would mean a
global mutation that breaks a sibling spec.

## 1. What this checks

**A user can narrow the catalog search to the assets they themselves opened, read that list as a history, and
share it without it meaning something different for the recipient.** Concretely: (1) the scope narrows and searching
never records a view; (2) it is cross-kind, and the qualifier says whose views these are; (3) a preset narrows by
*when*, resolving to a concrete date the chip names; (4) toggling an unrelated facet does not drop it (the #1858
mirror class); (5) Clear All removes it AND the ordering it made meaningful; (6) a saved search stores and reapplies
it, including the bounds-free "any time" state; (7) the list reads newest-first and the sort control says so;
(8) the home panel's View all opens exactly that list; (9) removing an entry drops it and re-opening restores it;
(10) a shared link carries no identity and junk bounds fail closed; (11) under DISABLED auth the control says the
history is shared; (12) the same link returns the same rows in a timezone fourteen hours away.

**Operator consequence if it fails:** the one history the catalog keeps becomes unreachable or untrustworthy — a
steward who wants "the tables I had open during the incident review" gets a list that silently ignores the filter, a
bookmark that quietly widens, a panel link that lands somewhere else, or — worst — a shared link that shows a
colleague *someone else's* browsing history. Every one is invisible to a unit test.

## 2. Preparation — build the test stand

Fast tier (read-path/UI mechanics): direct platform-DB seeding is correct for the assets — no collector semantics
are under test — but the HISTORY is recorded through the real `POST /api/recently-viewed/{kind}/{id}`, because the
record-on-open signal is the production write path and a direct insert would not prove it.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), API `:18080`, DB `:15432` (or the stream's isolated pair).
- **Seed** (ids `21570`–`21572`, names `it157rv_*`, all matching the prefix query `it157rv`): three searchable data
  entities — `it157rv_opened`, `it157rv_also`, `it157rv_never` — and a term `it157rvterm`.
- **History:** record an open for `it157rv_opened`, `it157rv_also` and the term; then **back-date `it157rv_also` by
  seven days** so a "Today" window separates it from the others:
  ```sql
  UPDATE recently_viewed SET last_viewed_at = (now() at time zone 'UTC') - interval '7 days'
   WHERE asset_kind = 'DATA_ENTITY' AND asset_id = 21571;
  ```
  `it157rv_never` is never opened — it is the FOIL every case checks for absence.
- **Auth:** DISABLED — the history is the shared sentinel bucket, which is what case 11 asserts the UI discloses.

## 3. Readiness check — is the stand ready?

- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- `SELECT asset_kind, asset_id FROM recently_viewed WHERE asset_id IN (21570,21571)` → two rows.
- `POST /api/search/assets?size=30 {"query":"it157rv","filters":{}}` → 4 items (3 data entities + the term).

## 4. Run protocol — what to run

1. Open `/search?q=it157rv`; all four are listed. Then open `/search?q=it157rv&recently_viewed=yes` and watch the
   network. The RECORD endpoint is `POST /api/recently-viewed/{ASSET_KIND}/{id}`; none of those is sent by
   searching. (`POST /api/recently-viewed/status` IS sent and is correct — it is the batch read that draws the
   "Viewed ..." markers on the rows, a read that happens to use POST for its body. Do not count it.)
2. On that URL, confirm the control reads *Assets you have opened* (or *anyone has opened* under DISABLED).
3. Click **Today** under the control.
4. With the scope on, pick **STABLE** in the Statuses facet (type `STABLE`, choose it); wait 1.5 s.
5. Open `/search?q=it157rv&recently_viewed=yes&sort=last_viewed`, then click **Clear All**.
6. With the scope on, **Save current search** as `it157-anytime`; reload `/search?q=it157rv`; **Saved searches** →
   `it157-anytime`.
7. Open `/search?recently_viewed=yes` (no query) and read the Sort-by control — this is where the browse default
   shows. Then open `/search?q=it157rv&recently_viewed=yes&sort=last_viewed` and read the control and the first
   row. Two URLs, because a text query still wins with relevance on both sides of the wire: the scope changes the
   BROWSE default, it does not override a query.
8. Open `/` and click **View all** in the Recently Viewed panel.
9. `DELETE /api/recently-viewed/DATA_ENTITY/21571`, reload the scoped search, then re-open it and reload again.
   **This step re-dates `it157rv_also` to now.** Any later step that relies on the seven-day separation (12 below)
   must re-apply the back-dating from section 2 first — the automation does exactly that.
10. Open `/search?q=it157rv&viewed_after=not-a-date`, then `…&viewed_after=2026-09-01`.
11. On `/search?q=it157rv` read the control's heading and its information icon.
12. Copy the URL from step 3 and open it in a browser context set to `Pacific/Kiritimati`.

**Automated rail:** `ODD_STREAM=<id> ODD_PLATFORM_DIR=<worktree> integration-tests/run-suite.sh IT-157`
(the RED half: the same with `ODD_SUT=ref:main`).

**One environment failure the automation recovers, and why it is not a masked retry.** Chromium aborts in-flight
downloads with `net::ERR_NETWORK_CHANGED` when the HOST's network configuration changes — Docker creating and
tearing down bridge networks beside a running suite does it. When that hits one of the SPA's code-split chunks the
lazy route import rejects and, with no error boundary in `odd-platform-ui`, the page renders **blank**: every
locator is absent and the failure looks like a product defect. The navigation helpers therefore reload ONCE on a
`Failed to fetch dynamically imported module` page error. That is a retry of the NAVIGATION; every assertion below
still runs exactly once, against a page that actually rendered, and the suite keeps `retries: 0`.

## 5. What it checks — assertions

Every case asserts NARROWING with a FOIL, never presence alone: on the unfixed base the params are dropped and the
unfiltered list shows every seeded row, so "the opened entity is listed" is green there — "`it157rv_never` is
ABSENT" is what goes RED.

| # | PASS when | FAIL when (the regression signature) |
|---|---|---|
| 1 | with the scope on: `opened`, `also` and the term listed, `never` **absent**; chip `Last viewed: any time`; **zero** record-POSTs fired by searching | the never-opened entity is still listed (the param was dropped); or searching records views, inflating the user's own history |
| 2 | the opened term is listed and the qualifier *Assets you have opened* renders | the scope excludes non-data-entities, or claims to be data-entity-only |
| 3 | **Today** puts `viewed_after=<instant>` in the URL, removes `recently_viewed=yes`, chip reads `Last viewed: since …`; `opened` listed, `also` **absent** | no control; or the preset's NAME is shown instead of the resolved date (a shared link would then mean something else tomorrow) |
| 4 | after the Statuses facet reaches the URL, `recently_viewed=yes` is STILL there — also 1.5 s later — and `never` still absent | the scope vanishes on the facet toggle — the #1858 class |
| 5 | Clear All removes the scope AND `sort=last_viewed`; all four are back | the scope survives; or the ordering is left behind, so the menu shows a sort the list does not have |
| 6 | the 201 body carries `spec.recently_viewed` with no bound set — on the wire `{"viewed_after": null, "viewed_before": null}`, since Jackson writes the unset bounds; PRESENCE is the switch, so this IS the "any time" state. After reapply the URL carries the scope and `never` is absent | the stored spec has no `recently_viewed` key at all; or the bounds-free state is read as an absence and reapplies unnarrowed |
| 7 | with no query the Sort-by control reads *Recently viewed*; with `sort=last_viewed` it reads the same and `it157rv_opened` (today) is listed above `it157rv_also` (a week old) | the list is in status-priority order — a history that does not read as one; or the control names an ordering the list does not have |
| 8 | the panel's View all has `href="/search?recently_viewed=yes&sort=last_viewed"`, and the landing list shows `opened` and not `never` | the panel has no View all (#1832 unresolved), or lands somewhere that does not resemble the tile |
| 9 | after the DELETE, `also` is absent; after re-opening, it is back | removal does not reach the scoped list, or re-opening fails to re-add |
| 10 | the URL contains no username / identity; junk and bare-date bounds produce NO chip and NO narrowing | a junk bound errors, or filters partially — a filter the user cannot see |
| 11 | the control reads **Last viewed (shared)**, the qualifier *Assets anyone has opened*, and `filter-recently_viewed-info` renders | the filter hides itself or returns empty under DISABLED, contradicting the panel that links to it |
| 12 | the SAME url opened at `Pacific/Kiritimati` returns the SAME rows, with a resolved date on the chip | the rows differ by timezone — the boundary was serialised as a day somewhere instead of an instant |

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-157.md` (or the suite's file).
Log fields: `date · stack_commit · runner · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: `contributor/CTRIB-067.md` §4 (R1–R16), §7 Step 8; ADR `unified-asset-search` D3 (the recency facet),
  D8 (the panel as a deep-link widget), D10 (URL state), D11 (one canonical spec, two surfaces).
- Siblings: IT-156 (the range-facet idioms, the mirror class and the saved-search oracle), IT-149 (the
  record-on-open loop and the panel — **the spec that shares this bucket**), IT-152 (the Statuses-facet toggle idiom),
  IT-155 (the saved-search save → reapply idiom).
