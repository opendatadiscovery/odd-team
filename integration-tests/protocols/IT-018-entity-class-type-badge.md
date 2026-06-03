---
id: IT-018
title: "The detail header renders the entity's class + type badges (and no class badge when unclassified)"
gates:
  validates: [F-177]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-class-type-badge.spec.ts"
plan_ref: ""
status: ready
---

# IT-018 — Class / Type badges on the detail header (F-177)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The data-entity detail **header** renders the operator-visible CLASS badge(s) (one per
`entity_classes[]`, the short label — e.g. `DATA_SET` → **DS**) and a TYPE badge
(`type.name` — e.g. `TABLE` → **TABLE**). The badges are the operator's signal of "what KIND
of thing this entity is" and (per F-176) which Overview sub-panels compose. If the class badge
is absent when the entity IS classified, the class→header projection (F-177) is broken. The
negative pins the documented F-177 drift `class_array_empty_renders_no_badge`: an entity with
no classes renders no class badge (silently indistinguishable from unclassified). Source:
feature-flow F-177; `DataEntityDetailsHeader.tsx` (class via `EntityClassItem`, type via
`EntityTypeItem`).

> KEY LESSON 2: both labels are transform-derived. Verified live (2026-06-03): a TABLE entity
> with `entity_class_ids={1}` renders `DS` then `TABLE` immediately after the entity name; with
> `entity_class_ids={}` only `TABLE` renders.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityClassType(typeId, classIds)` — sets
  `data_entity.type_id` + `data_entity.entity_class_ids` (verified image schema; int[] column).
  Use `(1, [1])` for a TABLE/DATA_SET entity; `(1, [])` for an unclassified TABLE.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT type_id, entity_class_ids FROM data_entity WHERE id = 2001;`.
- API projection: `curl -s http://localhost:18080/api/dataentities/2001` → `type.name` +
  `entity_classes[]` (snake_case wire).

## 4. Run protocol
1. SUCCESS: `seedEntityClassType(1, [1])`; open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe the header badges.
2. NEGATIVE: `seedEntityClassType(1, [])`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-018` (Playwright `e2e/specs/entity-class-type-badge.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the TYPE badge (`TABLE`) and the CLASS short badge (`DS`) are both visible
  in the header. (FAIL: the class badge never appears → the class→header projection is broken.)
- **NEGATIVE (PASS):** with no entity classes, the type badge still renders but the class badge
  is absent (count 0) — the documented `class_array_empty_renders_no_badge` behaviour.

## 6. Result log
- 2026-06-03 — authored; ground-truth verified (DS/TABLE badges) via live header DOM dump; run via
  run-suite.sh IT-018 (see run-log/).
