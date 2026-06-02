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
expected_result: "RED until listMostPopular aggregates BEFORE paginating — today page 1 is the 30 OLDEST tags by id, so the youngest most-used tags never appear. PLT-026 / LSN-019."
---

# IT-005 — Top Tags ordering (oldest-by-id, not most-popular)

> **This is an integration test for F-018 (Manual Object Tagging).** It seeds a catalog
> where the most-used tags are also the youngest, then reads the rendered Overview
> "Top Tags" strip. Unlike the dashboard/error tests, this one MUST hit the real
> backend — the defect is in the SQL, and the UI re-sorts client-side, so the only way
> the popular tags can be missing from the strip is the backend never returning them.

## 1. What this checks
"Top Tags" (and `GET /api/tags` / `getPopularTagList`) must return tags ordered by
popularity. **Known bug (PLT-026 / LSN-019):** `ReactiveTagRepositoryImpl.listMostPopular`
paginates by `TAG.ID ASC` **before** it aggregates usage
(`ReactiveTagRepositoryImpl.java:147-148`): page 1 (size 30) is the 30 OLDEST tags by
id, and the usage ranking is applied only *within* that already-truncated window. Once
there are >30 tags, the most-popular tags created latest never reach page 1 — the
OpenAPI "sorted by popularity" promise (`openapi.yaml:344-346`) and the "Top Tags" UI
label are both broken.

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
- **Automated rail**: `integration-tests/run-suite.sh known-bugs`
  (or `cd integration-tests/e2e && npx playwright test top-tags-ordering`).
- **Manual (human-carryable)**: open `http://localhost:18080/` and read the "Top Tags"
  strip; look for the `it005-POP-*` names (the most-used). DB cross-check of what the
  buggy query returns (page 1 = the 30 lowest-id non-deleted tags, regardless of usage):
  `psql "$ODD_DB_URL" -c "SELECT name FROM tag WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 30;"`
  → the `it005-POP-*` names are absent from this list today; a correct popularity sort
  would surface them. (The exact REST endpoint/shape is the `getPopularTagList` operation;
  confirm the live path from the running stack rather than assuming it.)

## 5. What it checks — assertions
- **PASS** when: the most-used tag (`it005-POP-005`, youngest, usedCount 5) is visible on
  the "Top Tags" strip — a correct popularity sort puts it at/near the top.
- **FAIL (expected today)** when: the `it005-POP-*` tags are absent and the strip shows
  older `it005-old-*` tags instead — listMostPopular returned the 30 oldest by id.

## 6. Result log
`integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`; Playwright trace/screenshot under
`integration-tests/e2e/test-results/` on failure. Log fields:
`date · stack_commit · runner · outcome · evidence (which tag names rendered vs the seeded POP names) · notes`.

## Cross-references
- Source: F-018 H-001 · PLT-026 (Thread A) · LSN-019 · `ReactiveTagRepositoryImpl.java:147-148` · `openapi.yaml:344-346` · TEST-GAP-855/856
- Plan: `lineage/odd-platform/test-plan.md` batch I7 (tag ordering) + the Tier-1 e2e build-out
- Automation: `integration-tests/e2e/specs/top-tags-ordering.spec.ts` (seed: `helpers/db.seedPopularYoungTags`)
- Fix that flips this GREEN: move `ORDER BY usage_count DESC` OUTSIDE the paginate primitive (PLT-026 Thread A — compute COUNT over the full tag set, then order, then truncate), then move IT-005 to `feature-complete`.
