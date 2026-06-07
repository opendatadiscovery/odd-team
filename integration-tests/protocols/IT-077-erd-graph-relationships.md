---
id: IT-077
title: "Relationships list renders the surface; PINS the Target-column copy-paste bug (PLT-056 Defect 1)"
gates:
  validates: [F-037]
  enforces: []
  regresses: [PLT-056]
test_class: integration
stack: odd-minimal
automation: "e2e:erd-graph-relationships.spec.ts"
plan_ref: I6
status: ready
---

# IT-077 — ERD/Graph Relationships Listing (F-037)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Data Modelling → **Relationships** list page (`/data-modelling/relationships` → `GET /api/relationships`)
renders the relationships surface — a 5-column table (Name | Type | Namespace,Datasource | Source | Target),
30-row infinite scroll, `?q` search on the relationship-row name. AND it PINS a live UI bug: the **Target
column renders the SOURCE entity's data** (`RelationshipsListItem.tsx:73-81` is a verbatim copy of the Source
cell at :64-72; `item.targetDataEntity` is never read). The API DTO is correct (distinct source + target);
the bug is purely the UI row renderer. This is a GREEN characterization pin (LSN-029) of the CURRENT
incorrect behaviour: it goes RED the instant the one-property fix lands — flagging the fix so H-002 flips to
confirmed and the pin retires. Source: feature-flow F-037 (H-001, H-002); regresses PLT-056 Defect 1.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Shared stack reused via `ODD_STACK_EXTERNAL=1`.
- **Seed data** (own ids `2077x`, namespace `//e2e-it077/`, names `it077_*`; idempotent — spec's
  `seedRelationship()`): a relationship-class entity `20771` (class DATA_RELATIONSHIP `{9}`, type
  ENTITY_RELATIONSHIP `25`, external_name `it077_rel`) + DISTINCT source `20772` (`it077_source`) + target
  `20773` (`it077_target`) + a `relationships` row (`source_dataset_oddrn`→`target_dataset_oddrn`, type
  `ERD`). Distinct source/target names are what make the copy-paste observable. (`relationships` has no
  `is_deleted` column.)

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- API: `curl -s 'http://localhost:18080/api/relationships?page=1&size=30&type=ALL&query=it077_rel'` → 200,
  `items[0].source_data_entity.external_name="it077_source"` AND `target_data_entity.external_name=
  "it077_target"` (both distinct + present — API correct; the drop is UI-only).

## 4. Run protocol
1. H-001 (surface): open `/data-modelling/relationships?q=it077_rel`; wait for `GET /api/relationships`;
   assert the title "Relationships", the row `it077_rel`, and the source `it077_source` render.
2. H-002 (bug pin): on the same page, assert `it077_source` renders TWICE (Source + Target columns) and the
   distinct target name `it077_target` is ABSENT (count 0).

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1
npx playwright test specs/erd-graph-relationships.spec.ts --reporter=line`.

## 5. What it checks — assertions
- **H-001 (PASS):** the Relationships title + the seeded relationship row (name) + the source entity render.
  (FAIL: the surface does not render the relationship.)
- **H-002 (PASS = bug still present):** `it077_source` count is 2 (both columns) AND `it077_target` count is
  0. (RED = bug FIXED: the target name now renders → flip F-037 H-002 to confirmed and retire this pin.)

## 6. Result log
- 2026-06-07 — authored; stack_commit `dd52f520`; runner AI (Claude). Outcome PASS (2/2 — bug confirmed
  present). Evidence: API returns correct distinct source+target (curl); UI renders `it077_source`×2 and
  `it077_target`×0, page body contains "it077_source" but NOT "it077_target" (browser probe before
  asserting). Pin regresses PLT-056 Defect 1 (`RelationshipsListItem.tsx:73-81` copy-paste); RED-on-fix.
