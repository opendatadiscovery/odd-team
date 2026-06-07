---
id: IT-072
title: "The entity Overview right-sidebar composes the Tags, Dictionary-terms and Data-entity-groups collections"
gates:
  validates: [F-179]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/overview-sidebar-collections.spec.ts"
plan_ref: "I9"
status: ready
---

# IT-072 — Overview sidebar collections: Tags / Terms / Groups (F-179)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity Overview (`DataEntityDetails/Overview/Overview.tsx`) lays out a right column (`xs={3}`)
stacking OverviewGeneral + OverviewGroups ("Data entity groups") + OverviewTags ("Tags") +
OverviewTerms ("Dictionary terms"). Each panel is data-driven and renders its members' names
verbatim. This pins the F-179 user-facing promise that **the sidebar collections EXIST and render
their members** when the entity has a tag + a term + a group. If it FAILS, one of the three
collection panels is missing or does not render its members. Source: feature-flow F-179.

NB — F-179's headline drift (slice-then-sort, important-tag-below-cut) lives in the `>visibleLimit`
overflow path (UC-1/2/4/5, contradicted, PLT-096 owns the fix); THIS test pins the
panels-compose-and-render promise, not ordering correctness for >20 members.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reuse the shared stack (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: one entity (id 20721) seeded with ONE tag + ONE term + ONE group membership, each via
  the verified per-surface SQL replicated against this spec's ids: tag (`tag` + `tag_to_data_entity`);
  term (`namespace` + `term` + `data_entity_to_term`); group membership (a DEG `data_entity` +
  `group_entity_relations` by ODDRN). A bare entity (no tag/term/group) is the negative.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API projection: `curl -s http://localhost:18080/api/dataentities/20721` → `tags[]`, `terms[]`,
  `data_entity_groups[]` all populated (snake_case wire).

## 4. Run protocol
1. SUCCESS: seed the entity with a tag + term + group; open `/dataentities/20721/overview`; wait for
   `GET /api/dataentities/20721`; observe the "Tags", "Dictionary terms", "Data entity groups" panel
   headings + each member name.
2. NEGATIVE: seed a bare entity (clear all three); open the Overview; wait for detail; observe none of
   the three member names render.

**Automated rail**: `integration-tests/run-suite.sh IT-072` (Playwright `e2e/specs/overview-sidebar-collections.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** all three panel headings render AND each panel renders its seeded member (the
  tag, the term, the group, each verbatim).
- **NEGATIVE (PASS):** with no tag/term/group, none of the three member names render (visible count 0).
- **FAIL:** a panel heading or a member name is missing when seeded.

## 6. Result log
- 2026-06-07 — authored; sidebar headings ("Tags" / "Dictionary terms" / "Data entity groups") +
  member rendering verified against primary source (Overview.tsx right column). Both tests PASS via
  Playwright (ODD_STACK_EXTERNAL=1).
