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

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- Seed present: `GET /api/datasets/... ` (or DB `entityByOddrn('//e2e-it148/ds/tables/it148_tbl')`)
  returns the entity id.

## 4. Run protocol

1. Navigate to `/dataentities/{id}/overview`. Confirm the header star (`[data-qa="favorite-star"]`)
   renders and is NOT pressed (`aria-pressed="false"`).
2. Click the star. Confirm a `PUT /api/favorites/DATA_ENTITY/{id}` returns 2xx and the star is now
   pressed (`aria-pressed="true"`).
3. Navigate to `/`. Confirm the **Favorites** panel heading renders and lists `it148_tbl` (a link).
4. Navigate to `/favorites`. Confirm `it148_tbl` is listed.
5. Navigate back to `/dataentities/{id}/overview` (star pressed). Click it. Confirm a
   `DELETE /api/favorites/DATA_ENTITY/{id}` returns 2xx and the star is un-pressed.
6. Navigate to `/`. Confirm `it148_tbl` is **gone** from the Favorites panel.

**Automated rail:** `integration-tests/run-suite.sh IT-148`. RED proof:
`ODD_SUT=ref:main integration-tests/run-suite.sh IT-148` — on `main` (66c472e2, the S1+S2 backend but
NO S3 frontend) there is no star affordance, no panel and no `/favorites` route, so the run fails.

## 5. What it checks — assertions

- **PASS** when: the star toggles pressed/un-pressed on click; the starred asset appears on both the
  main-page panel and the Favorites tab; un-starring removes it from the panel.
- **FAIL** (regression signature) when: the star affordance is absent, or a starred asset does not
  appear on the panel/tab, or un-starring leaves it shown — i.e. the `ref:main` baseline by construction.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-148.md` (and the suite log when run via a suite).
Fields: `date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: #1815 / PRD-0001 (Favorites + Recently Viewed); CTRIB-039 (S1 write API, S2 list API, S3 FE).
- Related ITs: IT-146/IT-147 (the sibling Dataset-Structure filter e2e harness this mirrors).
