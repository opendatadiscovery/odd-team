---
id: IT-089
title: "The per-entity Activity tab is scoped to that entity's own events and the Event-type filter narrows it"
gates:
  validates: [F-196]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:entity-activity-tab.spec.ts"
plan_ref: I4
status: ready
---

# IT-089 — Per-entity Activity tab (entity-id-scoped) (F-196)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The data-entity detail **Activity** tab (`/dataentities/{id}/activity` → `GET /api/dataentities/{id}/activity`)
shows ONLY that entity's own change events (F-196-UC-1/UC-10) — `findDataEntityActivities` adds
`DATA_ENTITY.ID.eq(dataEntityId)`, so events never cross entities — and its Event-type filter narrows the
tab (F-196-UC-9). If it FAILS, another entity's activity leaks onto the tab, or the filter does not narrow.
Sibling to IT-088 (F-021 global feed); distinct backend endpoint. Source: feature-flow F-196 (UC-1/9/10).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (inline `dbQuery`, ids 20890/20891, oddrn `//e2e-it089/`):
  - entity A (`it089_scoped_entity`) + TWO events: `DESCRIPTION_UPDATED` and `BUSINESS_NAME_UPDATED`.
  - entity B (`it089_other_entity`) + ONE `DESCRIPTION_UPDATED` event (the scope discriminator).
  - The per-entity `ActivityItem` does NOT print the entity name (the entity is implied), so the
    visible discriminator is the field-header label "Description" / "Business name". `created_at = NOW()`
    (in-partition, in-window). Assertions are scoped to `[data-qa='activity_results_list']` (the
    detail-page chrome above the tabs carries its own "Business name" affordance).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s 'http://localhost:18080/api/dataentities/20890/activity?begin_date=<now-2d ISO>&end_date=<now+2d ISO>&size=30'`
  → only entity 20890's two rows.

## 4. Run protocol
1. SCOPE: open `/dataentities/20890/activity?...`; in the results list observe both "Description" and
   "Business name" headers. Then open `/dataentities/20891/activity?...`; observe "Description" present
   and "Business name" ABSENT (entity A's bizname event did not leak to B).
2. FILTER: open `/dataentities/20890/activity?...&eventType=DESCRIPTION_UPDATED`; observe "Description"
   remains and "Business name" is narrowed out.

**Automated rail**: `integration-tests/run-suite.sh IT-089` (Playwright `e2e/specs/entity-activity-tab.spec.ts`).

## 5. What it checks — assertions
- **SCOPE (PASS):** entity A's tab shows both event headers; entity B's tab shows only its own event and
  NOT entity A's "Business name" event (count 0 in the list). (FAIL: cross-entity leak.)
- **FILTER (PASS):** `eventType=DESCRIPTION_UPDATED` keeps "Description", removes "Business name" (count 0).

## 6. Result log
- 2026-06-07 — authored; entity-id scoping + event_type filter verified end-to-end (2/2 green); the
  per-entity ActivityItem name-omission + chrome "Business name" collision both handled by list scoping;
  run via run-suite.sh IT-089 (see run-log/).
