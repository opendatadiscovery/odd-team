---
id: IT-126
title: "Filtering the Activity feed by tag AND owner returns one row per event and a count badge that matches the list"
gates:
  validates: [F-021]
  enforces: []
  regresses: [PLT-176]
test_class: integration
stack: odd-minimal
automation: "e2e:activity-tag-owner-fanout.spec.ts"
plan_ref: CTRIB-001
status: ready
---

# IT-126 — Activity Feed tag+owner fan-out (F-021 / PLT-176 / PR #1745)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The global **Activity** page filtered by **tag AND owner** (`GET /api/activity` + `/api/activity/counts`
with `tag_ids` + `owner_ids`) must return **one row per activity event** and an "All" count badge that
**equals the de-duplicated list the user sees**. Before PR #1745 the list query LEFT-JOINed the
one-to-many `tag_to_data_entity` and `ownership` tables with no `DISTINCT`, so an entity matching N tags x
M owners returned each activity N*M times, and the count endpoint inflated the badge by the same factor —
the front end de-duplicated the list but the badge could not, producing an on-screen count/list
contradiction. If it FAILS, the feed fans a single event into duplicate rows and the badge disagrees with
the visible cards. Source: feature-flow F-021; finding PLT-176; fix PR #1745.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED).
- **The SUT is a run parameter (`retrospectives/LSN-033`), default = the working tree.** This protocol pins
  NO image; `run-suite.sh` builds `odd-platform:odd-team-sut` from `$ODD_SUT` on each run:
  ```
  integration-tests/run-suite.sh IT-126                   # default: the working tree   -> GREEN (the fix)
  ODD_SUT=ref:main integration-tests/run-suite.sh IT-126  # the RED proof: main, pre-fix -> FAIL (4 rows)
  ODD_SUT=published integration-tests/run-suite.sh IT-126 # the released image -> FAIL until the fix ships
  ```
  Never pin a frozen `contrib-*` tag — that makes this regression test blind to every future change.
- **Seed data** (inline via `helpers/db.ts dbQuery`, ids 20890-20895, oddrn `//e2e-it126/`): one
  data entity (`it126_fanout_entity`) carrying **2 tags** (`tag_to_data_entity`) + **2 owners**
  (`ownership` with `data_entity_id`) + **one** `DESCRIPTION_UPDATED` activity (`created_at = NOW()`,
  `is_system_event=true`, `created_by=NULL`).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` -> `{"status":"UP"}`.
- API: `curl -s 'http://localhost:18080/api/activity/counts?begin_date=<now-2d ISO>&end_date=<now+2d ISO>&tag_ids=20891,20892&owner_ids=20893,20894'`
  -> on the FIXED backend `total_count` is **1**; on the buggy backend it is **4**.

## 4. Run protocol
1. Navigate `/activity?beginDate=<ms>&endDate=<ms>&size=30&type=ALL&tagIds[]=20891,20892&ownerIds[]=20893,20894`.
2. Wait for `GET /api/activity` and `GET /api/activity/counts` (both carry `tag_ids` + `owner_ids`).
3. Observe the entity `it126_fanout_entity` renders exactly once; observe the "All" badge count.

**Automated rail**: `integration-tests/run-suite.sh IT-126` (default SUT = the working tree; Playwright
`e2e/specs/activity-tag-owner-fanout.spec.ts`). RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-126`.

## 5. What it checks — assertions
- **No fan-out (PASS):** the `GET /api/activity` response has **no duplicate activity ids**
  (`rows.length === distinct(ids)`). FAIL: 4 rows / 1 distinct -> the tag+owner fan-out.
- **Badge matches list (PASS):** `GET /api/activity/counts.total_count` equals the distinct event count.
  FAIL: badge 4 vs 1 visible card -> the on-screen contradiction.
- **Rendered (PASS):** the seeded entity renders in the filtered feed (the browser drove the real flow).

## 6. Result log
- 2026-06-09 — authored for CTRIB-001 / PR #1745. RED against `published` (`ghcr…:latest`: 4 rows / badge 4),
  GREEN against the working-tree build (1 row / badge 1).
- 2026-06-10 — re-verified through the SUT mechanism (`retrospectives/LSN-033`): `run-suite.sh IT-126`
  (default `working`) builds `odd-platform:odd-team-sut` from the working tree → GREEN; `ODD_SUT=ref:main` → RED.
  No frozen image; the test will catch any future regression in the Activity feed.
