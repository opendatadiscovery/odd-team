---
id: IT-017
title: "The data entity Overview renders custom metadata key/value pairs (and none when unset)"
gates:
  validates: [F-013]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-metadata-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-017 — Custom metadata renders on the Overview (F-013)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The entity Overview renders **operator-curated custom metadata** (an INTERNAL-origin
`metadata_field` plus its `metadata_field_value` for the entity) as a field-name + value
pair when a value is set, and the value is absent when the entity has no custom metadata —
the metadata panel is data-driven per entity. If this FAILS, a custom-metadata assignment
(F-013) does not reach the entity read surface (`OverviewMetadata.tsx`). Source: feature-flow
F-013 (Custom Metadata Field Editing — read/display contract).

> Scope note: F-013's WRITE path carries the documented silent-UPDATE-not-UPSERT drift
> family (silent 200 on missing pair/entity, no type validation, `active`→NULL, forensic
> silence). This IT pins the **display** contract only (value-driven panel); the write-side
> drifts are tracked separately (unit `test_matrix` + probe candidates in the feature flow).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityMetadata(name, value, type?)` —
  getOrCreates an INTERNAL `metadata_field` and DELETE-then-INSERTs its
  `metadata_field_value` for the entity (verified image schema); or `clearEntityMetadata()`
  for none.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present:
  `SELECT mf.name, mfv.value FROM metadata_field_value mfv JOIN metadata_field mf ON mf.id = mfv.metadata_field_id WHERE mfv.data_entity_id = 2001;`.

## 4. Run protocol
1. SUCCESS: `seedEntityMetadata("<field>", "<value>")`; open `/dataentities/2001/overview`;
   wait for the `GET /api/dataentities/2001` detail response; observe.
2. NEGATIVE: `clearEntityMetadata()`; open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-017` (Playwright `e2e/specs/entity-metadata-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the custom metadata **value** renders verbatim on the Overview, and the
  field **label** renders. Note: `MetadataItem` renders the field name through `TextFormatted`,
  which lower-cases it and replaces `_` with a space (`IT017_cost_centre` → `It017 cost centre`);
  the value is rendered verbatim. The spec asserts the value verbatim + the label via a
  transform-tolerant regex.
  (FAIL: the value never appears → the custom-metadata assignment does not reach the Overview.)
- **NEGATIVE (PASS):** with no value, the value string is absent (count 0).

## 6. Result log
- 2026-06-03 — authored; run via run-suite.sh IT-017 (see run-log/).
