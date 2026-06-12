---
id: IT-005
title: "Top Tags must show the most-popular tags, not the oldest-by-id (UI e2e)"
gates:
  validates: [F-018]
  enforces: []
  regresses: [PLT-026]
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/top-tags-ordering.spec.ts"
plan_ref: "I7 (search/session — tag ordering) — Tier-1 DISABLED-stack clean UI flow"
status: ready
expected_result: "GREEN — guards the FIXED contract (#1773 Thread A / CTRIB-007, 2026-06-12): listMostPopular aggregates usage over the FULL directory, then orders usage DESC with id-ASC ties, then paginates; the most-used tags appear on the strip however young. Was the known-bugs RED pin of PLT-026 / LSN-019 (paginate-before-COUNT) until the fix; flipped GREEN-on-fix + RED-on-ref:main proven 2026-06-12 (run-log)."
---

# IT-005 — Top Tags ordering (oldest-by-id, not most-popular)

> **This is an integration test for F-018 (Manual Object Tagging).** It seeds a catalog
> where the most-used tags are also the youngest, then reads the rendered Overview
> "Top Tags" strip. Unlike the dashboard/error tests, this one MUST hit the real
> backend — the defect is in the SQL, and the UI re-sorts client-side, so the only way
> the popular tags can be missing from the strip is the backend never returning them.

## 1. What this checks
"Top Tags" (and `GET /api/tags` / `getPopularTagList`) must return tags ordered by
popularity. **Guards the fixed contract (was PLT-026 / LSN-019, fixed by #1773 Thread A /
CTRIB-007, 2026-06-12):** `ReactiveTagRepositoryImpl.listMostPopular` used to paginate by
`TAG.ID ASC` **before** aggregating usage (pre-fix `ReactiveTagRepositoryImpl.java:147-148`):
page 1 (size 30) was the 30 OLDEST tags by id, the usage ranking applied only *within*
that already-truncated window — past 30 tags, the most-popular young tags never reached
page 1, breaking the OpenAPI "sorted by popularity" promise (`openapi.yaml:343-346`) and
the "Top Tags" UI label. The fix aggregates usage over the FULL filtered directory, then
orders `usage_count DESC, tag.id ASC` (deterministic ties), then paginates. This spec is
the regression guard: it flips RED if the window ever truncates before aggregation again.

**Operator-facing consequence if it FAILS:** "Top Tags" — a primary discovery affordance
— surfaces stale, low-value tags and hides the labels the team actually uses most; the
Tag facet is similarly mis-ranked. An operator curating a vocabulary trusts a "most
popular" surface that is silently "oldest 30 we happened to create first."
Source: F-018 H-001 · PLT-026 · LSN-019 · `ReactiveTagRepositoryImpl.java:147-148`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (platform + Postgres; UI at `http://localhost:18080`). Auto
  bring-up; manually: `docker-compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml up -d`.
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Browser toolchain**: Node 18+ (workspace pins 24) → `cd integration-tests/e2e && npm install && npm run browser`. One-time.
- **Seed** (`helpers/db.seedPopularYoungTags()`, idempotent): one data source + 5 usage
  entities, then **30 OLD tags** (`it005-old-NNN`, lowest ids, each used by 1 entity →
  usedCount 1) followed by **5 POPULAR tags** (`it005-POP-NNN`, highest ids = youngest,
  each used by all 5 entities → usedCount 5). So the 5 most-used tags are exactly the 5
  youngest — a correct popularity sort ranks them at the top; the buggy oldest-by-id
  pagination drops them off page 1. Manually, the same shape: `INSERT INTO tag(name,important)`
  ×35 (POP last) + `INSERT INTO tag_to_data_entity` rows so POP tags out-use the rest.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Seed present (≥35 IT-005 tags, POP tags youngest):
  `psql "$ODD_DB_URL" -c "SELECT count(*) FROM tag WHERE name LIKE 'it005-%';"` → `35`
- The most-used tag is the youngest:
  `psql "$ODD_DB_URL" -c "SELECT name,id FROM tag WHERE name LIKE 'it005-POP-%' ORDER BY id DESC LIMIT 1;"`

## 4. Run protocol — what to run
- **Automated rail**: `integration-tests/run-suite.sh feature-complete` (IT-005's lane
  since the 2026-06-12 flip; single run: `integration-tests/run-suite.sh IT-005`, or
  `cd integration-tests/e2e && npx playwright test top-tags-ordering`).
- **Manual (human-carryable)**: open `http://localhost:18080/` and read the "Top Tags"
  strip; the `it005-POP-*` names (the most-used, youngest) must be visible. API
  cross-check: `GET /api/tags?page=1&size=30` returns the POP tags FIRST (usedCount 5)
  before the low-use olds — usage DESC, id-ASC ties.

## 5. What it checks — assertions
- **PASS (expected since 0.28.0 / the #1773 Thread A fix)** when: ALL five most-used tags
  (`it005-POP-001..005`, the youngest, usedCount 5) are visible on the "Top Tags" strip.
  NOTE the locator nuance: the TagItem chip renders the name + usedCount with a CSS-margin
  gap (textContent `it005-POP-0055`) — match the name as a SUBSTRING, never exact/word-
  boundary (the pin was born RED; its PASS side first ran on the 2026-06-12 fix and
  exposed this).
- **FAIL** when: any `it005-POP-*` tag is absent and the strip shows older `it005-old-*`
  tags instead — listMostPopular truncated before aggregating again (the PLT-026 / LSN-019
  regression; proven RED against pre-fix main 2026-06-12, run-log).

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace/screenshot under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence (which tag names rendered vs the seeded POP names) · notes`.

## Cross-references
- Source: F-018 H-001 / UC-001 · PLT-026 (Thread A) · LSN-019 · `ReactiveTagRepositoryImpl.java:137-167` (fixed shape) · `openapi.yaml:343-346` · TEST-GAP-855/856
- Plan: `lineage/odd-platform/test-plan.md` batch I7 (tag ordering) + the Tier-1 e2e build-out
- Automation: `integration-tests/e2e/specs/top-tags-ordering.spec.ts` (seed: `helpers/db.seedPopularYoungTags`)
- **FLIPPED 2026-06-12 (the pre-authored fix landed — LSN-029, pin re-grounded never deleted):** odd-platform #1773 Thread A / CTRIB-007 (`contrib/CTRIB-007-tag-popularity-ordering` @ 82812cdf) moved the usage aggregation BEFORE pagination (usage DESC, id-ASC ties) — IT-005 moved `known-bugs` → `feature-complete` (+ rejoined `ui-e2e`); GREEN-on-fix (1/1, 3.8s) + RED-on-`ref:main` proof in `run-log/2026-06-12-IT-005.md`. Unit twin: `TagRepositoryImplTest.testListMostPopularReturnsGloballyMostUsedTags` (failing-first, RED on pre-fix main).
