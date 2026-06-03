---
id: IT-020
title: "The data entity Overview renders assigned tag chips (and none when untagged)"
gates:
  validates: [F-018]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-tags-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-020 — Assigned tags render on the Overview (F-018)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity Overview renders the **tags assigned to the entity** as chips when an assignment exists,
and none when there is no assignment — the tags panel is data-driven. If this FAILS, a tag
assignment (F-018 Manual Object Tagging) does not reach the entity read surface
(`OverviewTags` / `TagItem`). Distinct from IT-005 (F-018 catalog Top-Tags ordering bug). Source:
feature-flow F-018. Verified live (2026-06-03): the tag chip renders the name verbatim.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityTag(name)` — getOrCreates a `tag` and
  links it via `tag_to_data_entity` (verified image schema); or `clearEntityTags()` for none.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT t.name FROM tag_to_data_entity tde JOIN tag t ON t.id = tde.tag_id WHERE tde.data_entity_id = 2001;`.
- API projection: `curl -s http://localhost:18080/api/dataentities/2001` → `tags[]` (snake_case wire).

## 4. Run protocol
1. SUCCESS: `seedEntityTag("<tag>")`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe the Tags panel.
2. NEGATIVE: `clearEntityTags()`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-020` (Playwright `e2e/specs/entity-tags-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the assigned tag name is visible on the Overview.
  (FAIL: the tag name never appears → the tag assignment does not reach the Overview.)
- **NEGATIVE (PASS):** with no assignment, the tag name is absent (count 0).

## 6. Result log
- 2026-06-03 — authored; tag-chip rendering ground-truth verified; run via run-suite.sh IT-020 (see run-log/).
