---
id: IT-148
title: "Favorites: star an asset -> find it again via the Catalog search Favorites filter; un-star removes it (#1815 / CTRIB-039; re-grounded for ST-7 / #1841 / CTRIB-061)"
gates:
  validates: [F-Favorites]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:favorites-star-see-loop.spec.ts"
plan_ref: ""
status: ready
---

# IT-148 — Favorites: the star -> see loop (#1815 / CTRIB-039 S3)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

The end-to-end Favorites promise (PRD-0001 / #1815): a user can **star any viewable asset** and **find
it again** without remembering where it lives.

- Starring an asset from its detail header flips the star to pressed.
- The starred asset appears on the **main-page Favorites panel**, and the **Favorites filter** on the
  Catalog search narrows the result list to it (ST-7 / #1841 retired the bespoke `/favorites` tab).
- **Un-starring** removes it from both.
- The retired `/favorites` URL **redirects** to the pre-filtered search, so existing bookmarks survive.

**Operator consequence if it fails:** the only personalisation the large no-Owner audience can get
(pin-the-assets-I-care-about) is broken — the star does nothing visible, or the pinned asset cannot be
found again — and the feature's entire reason to exist is gone.

### The oracle is NARROWING, never presence — read this before editing a case

The obvious check ("go to `/search?favorites=yes`, assert the starred asset is listed") **passes on the
unfixed base**: there the `favorites` param is unknown, is dropped by the URL parser, and the *unfiltered*
search lists that asset anyway. It would be a green test for the bug it exists to catch.

So the stand seeds a **pair** — the starred subject and a deliberately **un-starred foil** (`it148_unstarred_foil`)
that matches the same query token — and every case asserts the subject is present **AND the foil is absent**.
The foil's absence is the whole RED signal. Any future edit that drops the foil assertion silently neuters
this protocol.

Source: #1815 (the maintainer's PRD-0001 realisation); CTRIB-039 S3 (the favorites frontend);
CTRIB-061 / #1841 ST-7 (the tab -> filter re-grounding).

## 2. Preparation — build the test stand

TIER: read/UI-mechanics (fast tier). Favorites act on the asset **identity** + a per-user write path;
no collector-mapping semantics are under test, so one real-ingested TABLE entity is enough (no columns
needed). Auth is **DISABLED** (odd-minimal default) -> the favorites identity resolves to the shared
sentinel, so the stand seeds and asserts against that one bucket.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), the e2e harness default.
- **Seed (collision-free band 2148):** a `data_source` (`//e2e-it148/ds`) + a TABLE
  `//e2e-it148/ds/tables/it148_tbl` (`it148_tbl`), via real ingestion (`POST /ingestion/entities`).
- **The foil (ST-7):** `seedSearchableEntity(21481, 'it148_unstarred_foil')` — searchable by the same
  `it148` prefix token, and **never starred**. Its absence from the filtered list is the RED-on-base signal.
- **Clean start:** `DELETE /api/favorites/DATA_ENTITY/{id}` for both (idempotent) so the star begins
  un-pressed deterministically across re-runs.
- **Term (A4):** a searchable Term (`seedSearchableTerm('IT148FavTerm')` — seeds the FTS
  `term_search_entrypoint` so it surfaces in the Dictionary list) + `DELETE /api/favorites/TERM/{id}`
  clean start, for the cross-kind check.

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- Seed present: `GET /api/datasets/... ` (or DB `entityByOddrn('//e2e-it148/ds/tables/it148_tbl')`)
  returns the entity id.

## 4. Run protocol

1. Navigate to `/dataentities/{id}/overview`. Confirm the header star (`[data-qa="favorite-star"]`)
   renders and is NOT pressed (`aria-pressed="false"`).
2. Click the star. Confirm `PUT /api/favorites/DATA_ENTITY/{id}` returns 2xx and the star is pressed.
3. Navigate to `/`. Confirm the **Favorites (shared)** label renders (DISABLED auth -> an instance-wide
   shared bucket, labelled non-possessively) and the column lists `it148_tbl` as a link.
4. Navigate to `/search?favorites=yes&q=it148`. Confirm `it148_tbl` **is listed** AND
   `it148_unstarred_foil` **is NOT** — the narrowing, not mere presence.
5. Navigate back to `/dataentities/{id}/overview` (star pressed). Click it. Confirm
   `DELETE /api/favorites/DATA_ENTITY/{id}` 2xx and the star is un-pressed.
6. Navigate to `/`. Confirm `it148_tbl` is gone from the panel. Navigate to `/search?favorites=yes&q=it148`
   and confirm it is gone there too (the soft-deleted favorite row must not still match).

**The retirement (ST-7):**
7. Navigate to `/favorites`. Confirm the URL **redirects** to `/search?favorites=yes` — not a blank page —
   and that no **Favorites** tab remains in the main navigation.
8. With the asset starred, navigate to `/` and click the Favorites column's **View all**. Confirm it lands
   on a URL carrying `favorites=yes` and that the list is narrowed (subject present, foil absent).

**The control + the #1858 preservation class:**
9. Navigate to `/search?q=it148` (unfiltered — confirm the foil IS listed). **Tick the Favorites checkbox**
   in the Filters sidebar — the one labelled **Favorites only** (or **Favorites (shared) only** under
   DISABLED auth). Confirm the URL gains `favorites=yes` and the list narrows. Driving the control rather
   than a crafted URL is what proves the write path. (The automation selects it by role + accessible name,
   i.e. exactly what a human or a screen reader sees, not by a `data-qa` hook a styled wrapper might stop
   forwarding.)
10. Click **Clear All**. Confirm `favorites=` leaves the URL (it is a filter, so a filter reset clears it).
11. From `/search?favorites=yes&q=it148`, untick the checkbox. Confirm the param is REMOVED entirely —
    not rewritten to `favorites=no`, which is a different filter.

**Cross-kind + the preserved affordances:**
12. Seed + star `IT148FavTerm` from the Dictionary list row; navigate to `/search?favorites=yes&q=IT148FavTerm`
    and confirm the Term is in the scope (one filter, one list, all asset kinds).
13. On `/search?q=it148` under DISABLED auth, confirm the filter reads **Favorites (shared) only** and that
    `[data-qa="filter-favorites-info"]` (the inline-help icon carrying the shared-bucket consequence) renders.
14. With nothing starred, navigate to `/search?favorites=yes&q=it148` and confirm the empty state reads
    **"Star an asset to pin it here."** — the teaching line the retired tab's empty state carried — rather
    than a bare "No matches found".

**Automated rail:** `integration-tests/run-suite.sh IT-148` (or the full `run-regression.sh`).
**RED proof:** `ODD_SUT=ref:main integration-tests/run-suite.sh IT-148`. On `main` the whole ST-7 surface is
absent, so: steps 4/6/8/9 fail because the unknown `favorites` param is dropped and the **foil is still
listed**; step 7 fails because `/favorites` still renders the old tab; steps 9-11, 13 fail because there is
no Favorites control in the sidebar at all; step 14 fails because the tab, not the search, owns that state.

## 5. What it checks — assertions

- **PASS** when: the star toggles pressed/un-pressed on click; the starred asset appears on the main-page
  panel; the favorites-scoped search lists it **and excludes an asset the caller has not starred**;
  un-starring removes it from both surfaces; `/favorites` redirects to the pre-filtered search and no
  Favorites tab remains; the panel's "View all" lands pre-filtered; clicking the sidebar control writes
  `favorites=yes` and narrows; Clear All clears it and unticking removes the param; a starred Term is in
  the same scope; the control is labelled "(shared)" with inline help under DISABLED auth; and the
  zero-result state teaches the star.
- **FAIL** (regression signature) when: the star affordance is absent; a starred asset does not appear;
  un-starring leaves it shown; **the un-starred foil appears in a favorites-scoped list** (the filter is
  not applied — the `ref:main` baseline by construction, and the signature of a dropped URL param after an
  unrelated facet toggle, the #1858 class); `/favorites` renders a blank page; or the DISABLED consequence
  or the teaching empty state is missing.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-148.md` (and the suite log when run via a suite).
Fields: `date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: #1815 / PRD-0001 + PRD-0002 (Favorites completion); CTRIB-039 (S1 write API, S2 list API,
  S3 FE skeleton, **S4 completion FE — facet/list-stars/rich-rows/shared-label**, A1/A4/A5/A8).
- Related ITs: IT-146/IT-147 (the sibling Dataset-Structure filter e2e harness this mirrors);
  IT-019 (the `/termsearch` Dictionary-list flow the A4 step reuses).
