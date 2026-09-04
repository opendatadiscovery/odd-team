---
id: IT-155
title: "Saved search: save -> reapply / share keeps the Favorites scope and the Asset-type narrowing (#1878)"
gates:
  validates: [F-017]            # the saved-search promise the ledger resolves today (F-017-UC-08); re-pointed at the saved-search feature node in the CTRIB-065 Phase-D ontology step
  enforces: []
  regresses: [PLT-256]          # odd-platform#1878 — saved searches silently drop asset_kinds + favorites
test_class: integration
stack: odd-minimal
automation: "e2e:saved-search-round-trip.spec.ts"
plan_ref: ""
status: ready
---

# IT-155 — a saved search reproduces the search that was saved (#1878 / CTRIB-065)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 0. LANE — `pending-merge` until odd-platform#1878's PR merges

This protocol asserts behaviour that is FALSE on `origin/main @ 96d77668`: the saved-search contract there is
`SearchFormData`, so a save silently drops the two dimensions this protocol pins. It sits in `pending-merge`
(shared spec repo, per-stream SUTs — `pillars/tests/pillar.md` "`pending-merge` is not a bucket either") and
**graduates to `feature-complete` + `ui-e2e` at CTRIB-065's GATE-2 close-out**, which cites the first
`feature-complete` run-log line that executed it.

## 1. What this checks

**A saved search stores the complete current search — including the Favorites scope and the Asset-type
narrowing — so reapplying it (or opening its share link) reproduces exactly the search that was saved.**
Before #1878 the *Save current search* dialog reported success and stored a DIFFERENT search: reapplying a
favorites-scoped search landed on the whole catalog with the toggle off; reapplying a Terms-only search listed
every asset kind. Nothing in the UI said so.

**Operator consequence if it fails:** the feature's entire promise ("this exact search, again later") is broken
for two of the sidebar's controls, silently — the wider list is easy to not notice, and a shared link hands a
colleague the wrong search. ADR `unified-asset-search` D11 ("one canonical spec, two surfaces") is violated at
system level. Source: odd-platform#1878 (the maintainer's first manual test of merged #1875),
`retrospectives/LSN-042`, `contributor/CTRIB-065.md`.

### The oracle is NARROWING, never presence (same rule as IT-148)

A reapplied favorites search that lists the starred asset proves nothing — the UNFILTERED list contains it too.
Every case seeds a **foil** that matches the same query token but is outside the scope (an un-starred asset for
the Favorites case; a data entity for the Terms-only case) and asserts the foil is **absent** after reapply. The
foil's absence is the whole RED signal on `main`.

## 2. Preparation — build the test stand

Fast tier (direct platform-DB seeding + the real ingestion API): the semantics under test are the saved-search
contract and the search URL — no collector mapping is involved.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED` — every caller is the shared identity; the saved-search rows
  and the favorites bucket are both instance-wide, which is the shipped DISABLED posture).
- **Seed (per case, idempotent):**
  - a datasource `//e2e-it155/ds` (`seedIngestionDataSource(2155, …)`) and one ingested table
    `//e2e-it155/ds/tables/it155_tbl` named `it155_tbl` (the subject; `entityByOddrn` gives its id);
  - a searchable data entity `it155_unstarred_foil` (`seedSearchableEntity(21551, …)`) — matches the `it155`
    prefix token, **never starred**;
  - a searchable Term `IT155SavedTerm` (`seedSearchableTerm`) — matches the same token, case-insensitively;
  - favorites cleared for the subject and the foil (`DELETE /api/favorites/DATA_ENTITY/{id}`), and every saved
    search whose name starts with `it155-` deleted (`GET /api/saved_searches` → `DELETE /api/saved_searches/{id}`).
- **Clipboard (case 3):** the automation installs an init script that replaces `navigator.clipboard.writeText`
  with a capture — the *Copy link* button calls exactly that (`CopyButton.tsx`), and there is no anchor to read.
- **Time budget, sized against measurement (TST-057).** Five runs of this spec on the maintainer's box gave, per
  case: case 2 **15.6-16.3 s** and case 4 **8.9-9.5 s** in every run, but case 3 **8.3 s on a quiet box and
  19.9 s / 50.2 s under load** — the same code, a 6x spread, and every loss was *the SPA not painting*, never an
  assertion. So the automation warms the app once (`beforeAll`), waits up to **60 s** for the search page to
  BOOT (the *Save current search* button is the readiness signal), and gives each case
  `test.setTimeout(150_000)` — the idiom 12 specs in this suite already use. **Every assertion keeps its own
  bound**; the budget changes what the test waits for, never what it proves (on `ref:main` the first three
  cases fail on VALUES, which no timeout can turn green).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- `entityByOddrn('//e2e-it155/ds/tables/it155_tbl')` returns an id; `/search?q=it155` lists `it155_tbl`,
  `it155_unstarred_foil` and `IT155SavedTerm` (the unfiltered baseline all cases narrow from).

## 4. Run protocol

**Case 1 — the Favorites scope survives a saved search.**
1. Star the subject (`PUT /api/favorites/DATA_ENTITY/{id}`). Navigate to `/search?favorites=yes&q=it155`.
   Confirm `it155_tbl` is listed and `it155_unstarred_foil` is NOT (the scope is applied).
2. Click **Save current search**, name it `it155-favorites`, click **Save**. Confirm
   `POST /api/saved_searches` answers **201** and — read the response body — its `spec.favorites` is `true`.
   (On `main` the 201 body has NO `favorites` key: the contract dropped it before storing.)
3. Navigate to `/search?q=it155` (unfiltered; confirm the foil IS listed). Open **Saved searches**, click
   `it155-favorites`, then dismiss the popover (Escape / click away — it stays open after the navigation and,
   being a modal, hides the page from assistive tech until closed). Confirm the URL carries `favorites=yes`,
   the sidebar checkbox **Favorites (shared) only** is checked, `it155_tbl` is listed and the foil is **absent**.

**Case 2 — the Asset-type narrowing survives a saved search.**
4. Navigate to `/search?asset_kinds[]=TERM&q=it155`. Confirm `IT155SavedTerm` is listed and `it155_tbl` is NOT.
5. Save it as `it155-terms` (201; the body's `spec.asset_kinds` is `["TERM"]`). Navigate to `/search?q=it155`,
   open **Saved searches**, click `it155-terms`, dismiss the popover. Confirm the URL carries `asset_kinds` +
   `TERM`, the Term is listed and `it155_tbl` is **absent**.

**Case 3 — the share link carries the same dimensions.**
6. Open **Saved searches**; on the `it155-favorites` row click **Copy link** (the middle icon button between
   Rename and Delete). Confirm the copied string is a `/search?…` URL carrying `favorites=yes` and `q=it155`.

**Case 4 — a row saved before the widening reapplies unchanged (compatibility).**
7. Create a saved search through the API with a pre-#1878 spec —
   `POST /api/saved_searches {"name":"it155-legacy","spec":{"query":"it155","filters":{}}}` (201). Start from a
   NARROWED search, `/search?favorites=yes&q=it155` (the foil is out — and the saved-search toolbar only renders
   on a search page, so the starting URL needs a query). Open **Saved searches**, click `it155-legacy`, dismiss
   the popover. Confirm the URL became `/search?q=it155` — the narrowing gone, NO `favorites` and NO
   `asset_kinds` param invented — and that the foil is listed again (nothing was narrowed).

**Automated rail:** `ODD_STREAM=<id> ODD_PLATFORM_DIR=<worktree> integration-tests/run-suite.sh IT-155`.
**RED proof:** `ODD_SUT=ref:main integration-tests/run-suite.sh IT-155` — cases 1-3 fail on `main` (the saved
spec lacks both keys, so the reapply URL and the share link carry neither: the toggle is off, the foil / the
data entity is present). Case 4 passes on `main` too — it is the compatibility guard, not the RED signal.

## 5. What it checks — assertions

- **PASS** when: the 201 body of a save carries `spec.favorites` / `spec.asset_kinds` as sent; reapplying the
  favorites search lands on `favorites=yes` with the checkbox checked and the foil absent; reapplying the
  Terms search lands on `asset_kinds` + `TERM` with the data entity absent; the copied share link carries the
  same params; a legacy row reapplies to the same URL it always did, with no new params.
- **FAIL** (regression signature) when: a 201 body lacks a key the client sent; a reapplied URL lacks
  `favorites` / `asset_kinds`; **the foil appears in a reapplied favorites search** or **the data entity in a
  reapplied Terms search** (the narrowing was dropped — the `main` baseline by construction); the share link
  differs from the reapply URL; or a legacy row gains a param it never had.

## 6. Result log
Every run appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-155.md` (fields: date · stack_commit ·
runner · outcome · evidence · notes).

## Cross-references
- Source: odd-platform#1878 (PLT-256, widened), `retrospectives/LSN-042`, `contributor/CTRIB-065.md` §3-§7
- Sibling: IT-148 (the Favorites scope itself — its narrowing oracle and seed helpers are reused here)
- ADR: `adrs/drafts/unified-asset-search.md` D10 / D11
