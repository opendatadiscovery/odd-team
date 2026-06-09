---
id: CTRIB-001
github_issue_number: 1744
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1744
class: bug
status: implementing
reproduced: "live this session 2026-06-09 (documented in issue body + retrospectives/LSN-031): GET /api/activity?tag_ids=1,2&owner_ids=1,2&type=ALL -> 20 rows / 5 distinct; GET /api/activity/counts -> total_count=20; UI 5 cards under 'All 20' badge. Local stack currently down — the durable reproduction is the failing repository test (phase D, testcontainers)."
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-09 — EXISTS fix; root-cause comment skipped; branch protection confirmed)"
plan_approved_at: "2026-06-09"
pr_url:
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
(phase D)

## Comments (issue thread)
- Root-cause comment: DRAFTED, held for GATE 1 (first public bot action; and it largely restates the maintainer-authored issue — post for the public record, or skip).
