---
id: IT-056
title: "My objects silent-empty across Activity / Alerts under DISABLED — data exists, My view empty, no signal"
gates:
  validates: [F-064]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:my-objects-silent-empty.spec.ts"
plan_ref: I1
status: ready
---

# IT-056 — F-064 "My objects" silent-empty across Activity / Alerts under DISABLED

## 1. What this checks

F-064's load-bearing promise — which the feature's own coverage records as **CONFIRMED but
UNVERIFIED** (1/9; the empty-owner branch has zero CI guard) — is that the platform's "My objects"
surfaces silently render **empty** when the caller has no owner association, with **no signal**
distinguishing "no activity / you own nothing" from "you are not bound to an owner". Under
`auth.type=DISABLED` there is never a principal-owner association (F-011), so the silent-empty is
deterministically reproducible.

The decisive contradiction this RED-pins: the **ALL** activity feed is populated (proving activity
EXISTS), yet **My Objects** returns `[]` and `my_objects_count=0` — byte-identical to "nothing
happened". Symmetric on alerting: `GET /api/alerts/my` → 200 with an empty body.

- Activity ALL (`type=ALL`) → real `DATA_ENTITY_CREATED` rows (`fetchAllActivities`).
- Activity MY (`type=MY_OBJECTS`) → `[]` (`fetchMyActivities .switchIfEmpty(Flux.empty())`,
  `ActivityServiceImpl.java:194-198`).
- `getActivityCounts` → `total_count>0` but `my_objects_count=0` (`.defaultIfEmpty(0L)`, lines 239-243).
- Alerts MY (`getAssociatedUserAlerts`) → 200 empty body (`AlertServiceImpl.listByOwner` 82-87 — the
  `flatMap` on the empty owner never fires; the `Mono<AlertList>` completes empty).

These are LSN-029 characterization pins of the CURRENT behaviour; they go RED the moment a diagnostic
affordance / hint payload / missing-association sentinel ships (REFACTOR-224 / F-064 UC-6), or — worse
— the empty-owner branch falls back to an unscoped ALL fetch (a permission-bypass regression with
zero existing CI signal).

**Wire note:** the activity endpoint params are snake_case (`begin_date`, `end_date`). The camelCase
form makes Spring see `begin_date` missing → `MissingRequestValueException` (semantically 400), which
`ControllerAdvice` mistranslates to **500** — pinned as a KNOWN BUG corner (candidate PLT, same defect
class as PLT-076: `ControllerAdvice` lacks the handler so it falls through to `Exception.class` → 500).

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` to reuse.
- **Seed:** `beforeAll` registers a datasource + ingests one entity (anonymous, 200) so the ALL feed
  is deterministically non-empty even against a freshly-reset DB. Ingestion is the act (F-008 path).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `GET /api/activity?begin_date=...&end_date=...&type=ALL` → 200 (snake_case params).

## 4. Run protocol

1. Ingest an activity-producing entity (anonymous POST `/ingestion/entities` → 200).
2. `GET /api/activity?type=ALL` → 200 + ≥1 row; `GET .../activity/counts` → `total_count>0`.
3. `GET /api/activity?type=MY_OBJECTS` → 200 + `[]`; `counts.my_objects_count == 0`.
4. `GET /api/alerts/my` → 200 + empty body / zero items; `GET /api/alerts/totals` → `my_total==0`.
5. `GET /api/activity?type=ALL&size=5` (NO dates) → **500 / SYS001** (the KNOWN-BUG mistranslation).

**Automated rail:** `ODD_STACK_EXTERNAL=1 npx playwright test specs/my-objects-silent-empty.spec.ts`.

## 5. Assertions

- **PASS (DISABLED, pins current behaviour)** when: ALL feed non-empty + `total_count>0`, while
  My Objects list is `[]` and `my_objects_count==0`; Alerts My surfaces zero alerts; the no-dates
  activity call returns 500/SYS001.
- **FLIPS** when: My Objects / Alerts My gain a diagnostic (hint payload / sentinel / association
  banner), OR the empty-owner branch errors or falls back to ALL, OR the missing-param case starts
  returning 400 (the KNOWN-BUG fix — change that assertion to `.toBe(400)`).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-056.md`.

## Cross-references
- Source: `ActivityServiceImpl.java:86-117,138-166,194-198,232-243`, `AlertServiceImpl.java:82-87`,
  `AlertController.java:43-49`, `AuthIdentityProviderImpl.java:50-53`,
  `ControllerAdvice.java:48-66` (the 400→500 mistranslation).
- Feature: `lineage/odd-platform/feature-flows/detail/F-064.yaml` (UC-2/UC-4/UC-5) +
  `feature-reflections/detail/F-064.yaml` (H-002/H-004/H-005 confirmed-but-untested).
- Related: IT-054 (F-011 chokepoint), IT-055 (F-015 my-objects data side); REFACTOR-224; PLT-076
  (same ControllerAdvice 500-instead-of-400 class); LSN-001 (permissive-default hides operator error).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture).
