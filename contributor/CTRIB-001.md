---
id: CTRIB-001
github_issue_number: 1744
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1744
class: bug
status: review-ready
reproduced: "live this session 2026-06-09 (documented in issue body + retrospectives/LSN-031): GET /api/activity?tag_ids=1,2&owner_ids=1,2&type=ALL -> 20 rows / 5 distinct; GET /api/activity/counts -> total_count=20; UI 5 cards under 'All 20' badge. Local stack currently down — the durable reproduction is the failing repository test (phase D, testcontainers)."
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-09 — EXISTS fix; root-cause comment skipped; branch protection confirmed)"
plan_approved_at: "2026-06-09"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1745"
pr_draft: true
---

# CTRIB-001 — Fix GET /api/activity tag+owner fan-out (#1744)

Issue #1744 is the filed form of PLT-176 (`issues/odd-platform/PLT-176.md`).

## Scope analysis
- **Class: bug** (labels: `kind: bug`, `scope: backend`, `func: Activity`; author: the maintainer).
- **Feature:** Activity feed (F-021) — an audit/triage read surface; mission-relevant.
- **Affected:** `ReactiveActivityRepositoryImpl` — the list query AND all three count methods; both `GET /api/activity` and `GET /api/activity/counts`.
- **Architectural significance (G-C7): NO ADR.** Read-side query correctness; no DB migration, no auth/security-posture change, no breaking wire-contract change (the response shape is unchanged — the fix removes duplicate rows + corrects the inflated count).
- **Clarify (G-C6): no question warranted** — fully specified (file:line + fix options in the issue), and the author is the maintainer.

## Root cause
`addJoins` (`ReactiveActivityRepositoryImpl.java:237-241`) LEFT-JOINs the one-to-many `TAG_TO_DATA_ENTITY` and `OWNERSHIP` tables, and `getCommonConditions` (`:266-271`) filters via `TAG_ID.in(...)` / `OWNER_ID.in(...)`. With no `DISTINCT`, an entity matching N filtered tags x M filtered owners yields N*M rows per activity event. The SAME `addJoins` + `getCommonConditions` back the list query (`findActivities`, no `DISTINCT` at `:290-294`) AND all three count methods (`getTotalActivitiesCount` `:145-163`, `getMyObjectsActivitiesCount` `:166-184`, `getDependentActivitiesCount` `:187-206`, via `selectCount()` at `:297-302`) — so the count is inflated by the same factor. The front end de-dupes the list by id, but the count endpoint cannot → the on-screen count/list contradiction.

## Plan (awaiting GATE 1)
**Fix — EXISTS semi-join (the issue's preferred option):** in `ReactiveActivityRepositoryImpl` —
- `addJoins`: drop the `tagIds`/`ownerIds` LEFT JOINs (keep the datasource/namespace joins).
- `getCommonConditions`: replace `TAG_TO_DATA_ENTITY.TAG_ID.in(tagIds)` with `DSL.exists(selectOne().from(TAG_TO_DATA_ENTITY).where(TAG_TO_DATA_ENTITY.DATA_ENTITY_ID.eq(DATA_ENTITY.ID).and(TAG_TO_DATA_ENTITY.TAG_ID.in(tagIds))))`; same shape for `OWNERSHIP.OWNER_ID.in(ownerIds)`.
- A semi-join filters without multiplying rows → fixes the list AND all three count methods in one change, no `DISTINCT` needed.

**Scope EXCLUSIONS (G-C5):**
- NOT touching the unbounded-`size` clamp (separate item, PLT-175).
- NOT touching the `USER_OWNER_MAPPING` actor-resolution join (a different concern).
- NOT restructuring the query beyond the tag/owner fan-out.

**Test plan (test-first, BOTH buckets — G-C9):**
- **Unit (odd-platform CI; in-process Testcontainers `BaseIntegrationTest` = unit per the home rule):** a repository test — seed an entity with 2 tags + 2 owners + >=1 activity; assert `findAllActivities` with both filters returns exactly **1** row (not 4) and `getTotalActivitiesCount` returns **1** (not 4). RED on current code -> GREEN on fix. Run the FULL `./gradlew :odd-platform-api:test`.
- **Integration (odd-team IT-NNN; Playwright via `run-suite.sh`) — the user-facing symptom, MANDATORY here (FE/BE contradiction, LSN-031):** drive the Activity UI filtered by tag AND owner; assert the **"All" count badge equals the number of distinct events listed** (today: badge 20 vs 5 cards -> FAIL; after fix: 5 == 5 -> PASS). EXTEND `IT-088` (the existing activity-feed IT) or add a new `IT-NNN`; `validates: [F-021]`, `regresses: PLT-176`. A unit-green / IT-red state = the symptom is unfixed.

**Docs decision (G-C10):** no doc change — the fan-out was a silent backend defect, never documented; the fix makes the feed match the expected one-row-per-event behaviour.

**Ontology refresh (G-C10):** `/enrich --touched` on `ReactiveActivityRepositoryImpl` + the F-021 activity-feed reflection (the de-dup corrects the fan-out facet); committed.

## Test ledger
- **Unit** — `ReactiveActivityRepositoryFanOutTest` (Testcontainers, `repository/reactive/`). Seeds 1 entity + 2 tags + 2 owners + 1 activity. **RED on unfixed code (2026-06-09):** `findAllActivities` returned 4 rows (`hasSize(1)` failed at `:100`) — the fan-out, confirmed. Fix applied (EXISTS semi-joins in `ReactiveActivityRepositoryImpl`: dropped the tag/owner LEFT JOINs from `addJoins`, converted the predicates to `EXISTS`, cleaned the now-vestigial params off `addJoins`/`buildBaseQuery`). **GREEN** + **full `:odd-platform-api:build` GREEN** (432 tests, 0 failures; checkstyle + assemble green).
- **Integration** — **IT-126** (`activity-tag-owner-fanout.spec.ts`): browser e2e driving the global Activity page with the tag+owner filter. **RED on the published image** (`ghcr…:latest`: `GET /api/activity` returns **4** rows / 1 distinct — the fan-out) → **GREEN on the branch-built image** (`odd-platform:contrib-CTRIB-001`, UI bundled: **1** row, badge == 1). Run via `ODD_PLATFORM_IMAGE=odd-platform:contrib-CTRIB-001 integration-tests/run-suite.sh IT-126`. The published-vs-branch RED/GREEN proves the IT catches the bug, not green-washing (`retrospectives/LSN-032`).

## Branch / PR
- Branch `contrib/CTRIB-001-activity-fanout` pushed to `opendatadiscovery/odd-platform` (commit `2cf9dc24`, authored `odd-contributor[bot]`).
- Draft PR: **#1745** — https://github.com/opendatadiscovery/odd-platform/pull/1745 (GATE 2; review requested from `RamanDamayeu`; the bot cannot merge).

## Definition of Done (four merge-readiness gates — `retrospectives/LSN-032`) — ✅ ALL FOUR MET (the PR can leave `draft`)

1. **Unit (full build, on the branch):** ✅ `:odd-platform-api:build` — 432 tests + checkstyle + assemble GREEN on `contrib/CTRIB-001-activity-fanout`.
2. **Integration (branch-built image):** ✅ **IT-126** GREEN on the UI-bundled branch image (`odd-platform:contrib-CTRIB-001`: 1 row, badge == 1) and RED on the published image (4 rows) — the browser e2e verifies the fix end-to-end AND proves it catches the bug (see the test ledger).
3. **Docs:** ✅ **VERIFIED no change** — read `active-platform-features/activity-feed.md`; it documents the Tag/Owner filters' correct intent (narrow by tag/owner), never the buggy count → the fix makes reality match the doc.
4. **Ontology:** ✅ sidecar updated (TAG/OWNERSHIP `LEFT JOIN` → `EXISTS` + the fan-out finding, `@regresses PLT-176`) **and** graph re-embedded (`graph-build odd-platform`: nodes=7071, vectors=7995, model `bge-small`).

## Comments (issue thread)
- Root-cause comment: **skipped per GATE 1** — the maintainer authored the issue with the same analysis; no difference-making comment to add (G-C6).

## PR body (for GATE 2 — draft PR on #1744)

**Title:** `fix(activity): de-duplicate tag+owner filtered feed via EXISTS semi-joins`

```
## Summary
`GET /api/activity` and `/api/activity/counts` LEFT-JOIN the one-to-many `tag_to_data_entity`
and `ownership` tables to apply the `tag_ids` / `owner_ids` filters, with no `DISTINCT`. An entity
matching N filtered tags x M filtered owners therefore returns each activity event N*M times, and the
same fan-out inflates the count — which is what makes the "All" count badge disagree with the
(front-end de-duplicated) list.

This replaces the fan-out LEFT JOINs with `EXISTS` semi-joins, which filter without multiplying rows —
fixing the list query AND all three count methods (`getTotalActivitiesCount`,
`getMyObjectsActivitiesCount`, `getDependentActivitiesCount`) in one change, no `DISTINCT` needed.

## Root cause (ReactiveActivityRepositoryImpl)
- `addJoins(...)` LEFT-joined `TAG_TO_DATA_ENTITY` / `OWNERSHIP` (one-to-many on `data_entity_id`).
- `getCommonConditions(...)` filtered them with `TAG_ID IN (...)` / `OWNER_ID IN (...)`.
- The list select had no `DISTINCT`; the count used `selectCount()` over the same fanned-out rows.

## Change
- `getCommonConditions`: tag/owner predicates -> `EXISTS (SELECT 1 FROM ... WHERE data_entity_id =
  data_entity.id AND ...)`.
- `addJoins` / `buildBaseQuery`: removed the tag/owner LEFT JOINs (and the now-unused params).
- No wire-contract change: the response shape is unchanged; only duplicate rows + the inflated count go.

## Tests
- New `ReactiveActivityRepositoryFanOutTest` (Testcontainers): one entity with 2 tags + 2 owners + 1
  activity -> asserts the list returns 1 row and `getTotalActivitiesCount` returns 1 (not 4). RED before
  the fix, GREEN after; full `:odd-platform-api:build` green.

Closes #1744

---
Opened by odd-contributor[bot]. Human approval required before merge.
```
