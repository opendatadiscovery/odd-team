---
id: IT-129
title: "The Activity feed exposes three clear actor/asset filters (asset-Owner / actor-Owner / external-User) and rows show both actor names"
gates:
  validates: [F-021, F-196]
  enforces: []
  regresses: [LSN-020]
test_class: integration
stack: odd-minimal
automation: "e2e:activity-user-filter.spec.ts"
plan_ref: CTRIB-010
status: ready
---

# IT-129 — Activity actor filters + dual-name rows (#1657 / CTRIB-010 v2) (F-021, F-196)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Activity feed disambiguates the ODD **User vs Owner** confusion (#1657). It exposes **three** distinct
filters (was two ambiguous ones), each with an inline `(i)` explanation, and every action row shows **both**
actor names:
- **Owner** (asset owner, `ownerIds` -> `OWNERSHIP`) — who owns the affected data entity.
- **Made by (owner)** (`user_ids` -> `USER_OWNER_MAPPING`) — the actor's CURRENT owner via the mutable
  association; dropdown fed by `GET /api/owners`.
- **Made by (user)** (`usernames` -> `ACTIVITY.CREATED_BY`) — the actor's external username, immutable;
  dropdown fed by `GET /api/activity/users`; works for users with NO owner association.
- **Action row** shows the immutable username AND the user's CURRENT owner, labelled ("alice - current owner: X", as-of-now, not the change-time owner).

If it FAILS, a filter is missing/mislabelled, the username filter is owner-fed (the #1657 bug), or the row
shows only one name. Source: feature-flows F-021 (global) + F-196 (per-entity tab); CTRIB-010; LSN-020. The
backend churn-invariance is locked by the unit test `ReactiveActivityRepositoryActorFilterTest`; this is the
user-facing half (LSN-031).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (inline via `helpers/db.ts dbQuery`, ids 21280-21282, owner 21280, oddrn `//e2e-it129/`):
  - owner `it129_owner_alpha` (id 21280) + an ACTIVE `user_owner_mapping` `it129_alice -> 21280`.
  - actor `it129_bob` with **no** `user_owner_mapping` row (the discriminator — an audit actor that is
    not an Owner; impossible to surface pre-fix).
  - entity A (21281) + a `DESCRIPTION_UPDATED` row `created_by = it129_alice` (mapped -> dual name).
  - entity B (21282) + a `DESCRIPTION_UPDATED` row `created_by = it129_bob` (unmapped -> username only).
  - `is_system_event=false`, `created_at = NOW()` (live partition + default UI window; UTC session).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- Username source: `curl -s 'http://localhost:18080/api/activity/users?page=1&size=30&query=it129'`
  -> `items` containing `it129_alice` (owner `it129_owner_alpha`) and `it129_bob` (no owner).
- Actor-owner source unchanged: `GET /api/activity?...&user_ids=21280` returns alice's row; the new
  `GET /api/activity?...&usernames=it129_bob` returns bob's row (purely additive).

## 4. Run protocol
1. FILTERS PRESENT: open `/activity?...&type=ALL`; observe three filters — `owner_filter`,
   `made_by_owner_filter`, `made_by_user_filter`.
2. USERNAME SOURCE: open **Made by (user)**; type `it129`; wait `GET /api/activity/users`; observe the
   options contain BOTH `it129_alice` and `it129_bob`.
3. USERNAME SELECT: pick `it129_bob`; wait `GET /api/activity?...&usernames=it129_bob`; observe entity B
   renders, entity A does not.
4. ACTOR-OWNER SELECT: open **Made by (owner)**; type `it129_owner_alpha`; wait `GET /api/owners`; pick it;
   wait `GET /api/activity?...&user_ids=21280`; observe entity A (alice's event) renders.
5. DUAL-NAME ROW: on the unfiltered feed, alice's row shows BOTH `it129_alice` and `it129_owner_alpha`.
6. PER-ENTITY: open `/dataentities/21281/activity?...`; observe `made_by_owner_filter` +
   `made_by_user_filter`; the latter is fed by `GET /api/activity/users`.

**Automated rail**: `integration-tests/run-suite.sh IT-129` (Playwright `e2e/specs/activity-user-filter.spec.ts`).

## 5. What it checks — assertions
- **FILTERS (PASS):** all three filters render. (FAIL: a filter missing -> the axes were not separated.)
- **USERNAME SOURCE (PASS):** the dropdown lists `it129_alice` AND `it129_bob` (bob has no owner).
  (FAIL: owners listed / bob absent -> owner-fed, the #1657 bug.)
- **USERNAME SELECT (PASS):** selecting `it129_bob` sends `usernames=it129_bob` and the feed shows entity
  B only. (FAIL: wrong rows, or the param is `user_ids`.)
- **ACTOR-OWNER SELECT (PASS):** selecting `it129_owner_alpha` sends `user_ids=21280` and shows entity A —
  the actor's-current-owner axis still works (un-deprecated, intentional).
- **DUAL-NAME (PASS):** alice's row renders BOTH `it129_alice` and `it129_owner_alpha`.
- **PER-ENTITY (PASS):** both actor filters present; **Made by (user)** fed by `GET /api/activity/users`.
- **RED proof (pre-fix `ODD_SUT=ref:main`):** no `made_by_*` filters, no `/api/activity/users`,
  no dual-name row -> the filters-present + username-source assertions fail for the pinned reason.

## 6. Result log
- 2026-06-13 — authored for CTRIB-010 v1 (username filter), then EXTENDED for v2 (#1657 reframe): three
  filters (asset-Owner / actor-Owner / external-User) + dual-name rows + the info-(i) affordance.
  Verified end-to-end on the working-tree SUT; RED proof on `ODD_SUT=ref:main`. Run via run-suite.sh IT-129.
