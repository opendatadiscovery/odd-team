---
id: IT-149
title: "Recently Viewed: opening an asset records it -> it shows on the home panel; the detail header shows the 'last viewed' value + remove; removing it drops it (#1816 / CTRIB-041)"
gates:
  validates: [F-RecentlyViewed]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:recently-viewed-record-see-loop.spec.ts"
plan_ref: ""
status: ready
---

# IT-149 — Recently Viewed: the open -> see loop (#1816 / CTRIB-041 S2)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

The end-to-end Recently-Viewed promise (PRD-0001 / #1816): a user who **opens an asset** can **find it
again** without re-searching.

- Opening an asset's detail page **records** it via a deliberate `POST /api/recently-viewed/{kind}/{id}`
  (a signal — NOT a side effect of the asset GET; the existing view-count write is untouched).
- The recorded asset appears on the **main-page Recently Viewed panel**.
- The asset's detail header shows the **"last viewed" value** + a **remove** control (cross-surface
  recency marker), because it is in the user's history.
- **Removing** it drops it from the panel — driven by the recentlyViewed slice, no reload.
- Per-user identity; under **DISABLED** auth the set is the shared instance-wide bucket, labelled
  **"Recently Viewed (shared)"** (non-possessive).

**Operator consequence if it fails:** "take me back to what I was just looking at" — the only history the
catalog offers — is broken: opens are not recorded, or the recorded asset cannot be found again, or the
remove control does not clear it.

Source: #1816 (the maintainer's PRD-0001 realisation); CTRIB-041 S1 (backend foundation, merged #1826),
S2 (this frontend).

## 2. Preparation — build the test stand

TIER: read/UI-mechanics (fast tier). Recently-Viewed acts on the asset **identity** + a per-user write
path; no collector-mapping semantics are under test, so one real-ingested TABLE entity is enough. Auth is
**DISABLED** (odd-minimal default) -> the recency identity resolves to the shared sentinel, so the stand
seeds and asserts against that one bucket.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), the e2e harness default.
- **Seed (collision-free band 2149):** a `data_source` (`//e2e-it149/ds`) + a TABLE
  `//e2e-it149/ds/tables/it149_tbl` (`it149_tbl`), via real ingestion (`POST /ingestion/entities`).
- **Clean start:** `DELETE /api/recently-viewed/DATA_ENTITY/{id}` once (idempotent) so the bucket begins
  empty for this asset deterministically across re-runs.

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- Seed present: DB `entityByOddrn('//e2e-it149/ds/tables/it149_tbl')` returns the entity id.

## 4. Run protocol

1. Navigate to `/dataentities/{id}/overview`. Confirm a `POST /api/recently-viewed/DATA_ENTITY/{id}`
   returns 2xx (the record-on-open signal). On `ref:main` (no frontend) this never fires.
2. Navigate to `/`. Confirm the **Recently Viewed (shared)** panel
   (`[data-qa="recommended-recently-viewed"]`) renders (DISABLED auth → shared bucket, labelled
   non-possessively) and lists `it149_tbl` (a link).
3. Navigate back to `/dataentities/{id}/overview`. Confirm the recency marker
   (`[data-qa="recently-viewed-tag"]`) is visible and shows a "Viewed …" value (it self-hydrates via
   `POST /api/recently-viewed/status` and renders only because the asset is in the user's history).
4. On `/`, click the panel row's remove control (`[data-qa="recently-viewed-remove"]`). Confirm a
   `DELETE /api/recently-viewed/DATA_ENTITY/{id}` returns 2xx.
5. Confirm `it149_tbl` is **gone** from the Recently Viewed panel (no reload).

**List-surface column (test 2, #1816 / CTRIB-042):**
6. Seed a searchable entity; open it (record); on `/search` confirm the **"Recently viewed" column header**
   is present and the entity's results row shows the recency marker (`[data-qa="recently-viewed-tag"]`) in
   its own column — NOT inline in the name cell. Likewise the Dictionary term list and the Query Examples
   list carry a Recently-viewed column. RED on `ref:main` by construction (S2 rendered the marker inline,
   no column).

**Automated rail:** `integration-tests/run-suite.sh IT-149` (or the full `run-regression.sh`). RED proof:
`ODD_SUT=ref:main integration-tests/run-suite.sh IT-149` — on `main` (9097c548, the S1 backend merged but
no frontend) opening the detail page fires no record POST and there is no panel, so step 1 (the record
wait) and step 2 (the panel) fail.

## 5. What it checks — assertions

- **PASS** when: opening the detail page records the asset (record-on-open POST 2xx); the asset appears on
  the main-page Recently Viewed panel labelled "(shared)" under DISABLED; the detail header shows the
  "Viewed …" recency marker + a remove control; removing it from the panel drops it (no reload).
- **FAIL** (regression signature) when: no record-on-open POST fires, or there is no Recently Viewed
  panel, or the opened asset does not appear on it, or the detail-header recency marker is absent, or
  removing it leaves it shown — i.e. the `ref:main` (9097c548, backend-only) baseline by construction.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-149.md` (and the suite log when run via a suite).
Fields: `date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: #1816 / PRD-0001 §10 (Recently Viewed); CTRIB-041 (S1 backend foundation #1826, S2 frontend).
- Related ITs: IT-148 (the sibling Favorites star->see-loop e2e harness this mirrors — same shared
  foundation: identity sentinel, polymorphic asset model, main-page panel slot).
- Deferred: the standalone Recently-Viewed tab + the recency date-filter are superseded by the unified
  Search recency filter (#1825); this protocol covers the foundation + home panel + cross-surface marker.
