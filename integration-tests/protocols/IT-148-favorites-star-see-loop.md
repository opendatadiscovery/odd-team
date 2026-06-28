---
id: IT-148
title: "Favorites: star an asset from its header -> it shows on the main panel + Favorites tab; un-star removes it (#1815 / CTRIB-039)"
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
- The starred asset appears on the **main-page Favorites panel** AND the **top-level Favorites tab**.
- **Un-starring** removes it from both — driven by the favorites slice, no reload.

**Operator consequence if it fails:** the only personalisation the large no-Owner audience can get
(pin-the-assets-I-care-about) is broken — the star does nothing visible, or the pinned asset cannot be
found again — and the feature's entire reason to exist is gone.

Source: #1815 (the maintainer's PRD-0001 realisation); CTRIB-039 S3 (the favorites frontend).

## 2. Preparation — build the test stand

TIER: read/UI-mechanics (fast tier). Favorites act on the asset **identity** + a per-user write path;
no collector-mapping semantics are under test, so one real-ingested TABLE entity is enough (no columns
needed). Auth is **DISABLED** (odd-minimal default) -> the favorites identity resolves to the shared
sentinel, so the stand seeds and asserts against that one bucket.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), the e2e harness default.
- **Seed (collision-free band 2148):** a `data_source` (`//e2e-it148/ds`) + a TABLE
  `//e2e-it148/ds/tables/it148_tbl` (`it148_tbl`), via real ingestion (`POST /ingestion/entities`).
- **Clean start:** `DELETE /api/favorites/DATA_ENTITY/{id}` once (idempotent) so the star begins
  un-pressed deterministically across re-runs.
- **S4 add (A4):** a searchable Term (`seedSearchableTerm('IT148FavTerm')` — seeds the FTS
  `term_search_entrypoint` so it surfaces in the Dictionary list) + `DELETE /api/favorites/TERM/{id}`
  clean start, for the list-row-star check.

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- Seed present: `GET /api/datasets/... ` (or DB `entityByOddrn('//e2e-it148/ds/tables/it148_tbl')`)
  returns the entity id.

## 4. Run protocol

1. Navigate to `/dataentities/{id}/overview`. Confirm the header star (`[data-qa="favorite-star"]`)
   renders and is NOT pressed (`aria-pressed="false"`).
2. Click the star. Confirm a `PUT /api/favorites/DATA_ENTITY/{id}` returns 2xx and the star is now
   pressed (`aria-pressed="true"`).
3. Navigate to `/`. Confirm the **Favorites (shared)** panel heading renders (DISABLED auth → the set
   is an instance-wide shared bucket, labelled non-possessively — **A8**) and lists `it148_tbl` (a link).
4. Navigate to `/favorites`. Confirm the tab is titled **Favorites (shared)** (A8) and lists `it148_tbl`.
5. Navigate back to `/dataentities/{id}/overview` (star pressed). Click it. Confirm a
   `DELETE /api/favorites/DATA_ENTITY/{id}` returns 2xx and the star is un-pressed.
6. Navigate to `/`. Confirm `it148_tbl` is **gone** from the Favorites panel.

**S4 completion surface (separate tests):**
7. **Facet (A1):** navigate to `/favorites`; confirm the asset-type facet is the platform multi-select
   **combobox** (`role=combobox`), not the S3 fixed checkbox group.
8. **List-row star (A4):** navigate to `/termsearch`, search `IT148FavTerm` (fill "Search terms…" +
   Enter); confirm its row carries a `[data-qa="favorite-star"]`; click it → `PUT /api/favorites/TERM/{id}`
   2xx; navigate to `/favorites` and confirm the term is listed. (`DELETE` to clean up.)

**Group B — Description column (separate test, #1815):**
9. **Description (#1815 Group B):** seed `IT148FavTerm` (`IT019-ns`) and set the entity's
   `internal_description` to mention it (`[[IT019-ns:IT148FavTerm]]`); star the entity; navigate to
   `/favorites` and confirm the **Description** cell (`[data-qa="favorite-description"]`) shows the text
   and renders the `[[…]]` mention as a term link (`a[href*="/terms/"]`) — the server resolves the
   mention into `FavoriteAsset.description`. (`DELETE` + null the description to clean up.)

**Automated rail:** `integration-tests/run-suite.sh IT-148` (or the full `run-regression.sh`). RED proof
for Group B: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-148` — on `main` (da2932e1, the S4+S4b
completion merged but BEFORE Group B) there is **no Description column** (no `[data-qa="favorite-description"]`),
so test 9 fails; tests 1-8 (the S4 surface) pass on da2932e1.

## 5. What it checks — assertions

- **PASS** when: the star toggles pressed/un-pressed on click; the starred asset appears on both the
  main-page panel and the Favorites tab; un-starring removes it from the panel; **(S4)** the
  panel/tab are labelled "Favorites (shared)" under DISABLED auth (A8), the tab facet is the platform
  combobox (A1), and a Dictionary list row can be starred and then appears on the tab (A4);
  **(Group B)** a favorited asset's **Description** cell renders the description text and shows its
  `[[Namespace:Term]]` mentions as term links.
- **FAIL** (regression signature) when: the star affordance is absent, or a starred asset does not
  appear on the panel/tab, or un-starring leaves it shown; **(S4)** the surface is unlabelled under
  DISABLED, the facet is a checkbox group, or the list rows carry no star — i.e. the `ref:main`
  (924d49de) baseline by construction.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-148.md` (and the suite log when run via a suite).
Fields: `date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: #1815 / PRD-0001 + PRD-0002 (Favorites completion); CTRIB-039 (S1 write API, S2 list API,
  S3 FE skeleton, **S4 completion FE — facet/list-stars/rich-rows/shared-label**, A1/A4/A5/A8).
- Related ITs: IT-146/IT-147 (the sibling Dataset-Structure filter e2e harness this mirrors);
  IT-019 (the `/termsearch` Dictionary-list flow the A4 step reuses).
