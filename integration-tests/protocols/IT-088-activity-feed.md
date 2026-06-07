---
id: IT-088
title: "The global Activity page surfaces the cross-owner audit trail and the Event-type filter narrows it"
gates:
  validates: [F-021]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:activity-feed.spec.ts"
plan_ref: I4
status: ready
---

# IT-088 — Activity Feed (global page + cross-owner audit trail) (F-021)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The global **Activity** page (`/activity` → `GET /api/activity`, `ActivityType.ALL`) renders the
cross-owner audit trail — every authenticated user sees every entity's activity rows (F-021-UC-3) —
and a single filter facet (Event type) narrows the feed to matching events (F-021-UC-17). If it FAILS,
the audit feed does not surface activity or the filter does not narrow. Distinct from IT-089 (F-196
per-entity Activity tab). Source: feature-flow F-021 (use_cases UC-3, UC-17).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (inline via `helpers/db.ts dbQuery`, ids 20880/20881, oddrn `//e2e-it088/`):
  - entity A (`it088_desc_entity`) + a `DESCRIPTION_UPDATED` activity row (`created_at = NOW()`).
  - entity B (`it088_bizname_entity`) + a `BUSINESS_NAME_UPDATED` activity row.
  - `is_system_event=true`, `created_by=NULL` (renders a GearIcon — no dependence on the
    USER_OWNER_MAPPING → OWNER actor join). Plain `NOW()` lands inside the live partition AND the
    default UI window (now-5d .. now+1d); the DB session TZ is UTC, matching the platform's UTC-naive
    persistence (DateTimeUtil.generateNow).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s 'http://localhost:18080/api/activity?begin_date=<now-2d ISO>&end_date=<now+2d ISO>&size=30&type=ALL'`
  → the seeded entities in the array (note the wire is snake_case: `data_entity.external_name`).

## 4. Run protocol
1. SUCCESS: navigate `/activity?beginDate=<ms>&endDate=<ms>&size=30&type=ALL`; wait for `GET /api/activity`;
   observe both `it088_desc_entity` and `it088_bizname_entity` render.
2. FILTER: navigate the same URL + `&eventType=DESCRIPTION_UPDATED`; observe entity A remains, entity B gone.
3. NEGATIVE: navigate with a window 30..20 days in the past; observe neither entity renders.

**Automated rail**: `integration-tests/run-suite.sh IT-088` (Playwright `e2e/specs/activity-feed.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** both seeded entity names render in the global feed.
  (FAIL: a seeded entity never appears → the cross-owner feed does not surface it.)
- **FILTER (PASS):** with `eventType=DESCRIPTION_UPDATED`, entity A renders and entity B (bizname-only) is
  absent (count 0). (FAIL: entity B still shows → the event-type filter does not narrow.)
- **NEGATIVE (PASS):** with a past-only window the seeded events do not render (data-driven by created_at).

## 6. Result log
- 2026-06-07 — authored; global /activity + event_type filter + partition/window/UTC ground-truth verified
  end-to-end (3/3 green via Playwright); run via run-suite.sh IT-088 (see run-log/).
