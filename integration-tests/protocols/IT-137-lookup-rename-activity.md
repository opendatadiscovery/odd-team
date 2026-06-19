---
id: IT-137
title: "Renaming a lookup table emits a LOOKUP_TABLE_RENAMED activity event (old -> new name); a description-only edit does not"
gates:
  validates: [F-059]
  enforces: []
  regresses: [PLT-057]
test_class: integration
stack: odd-minimal
automation: "e2e:lookup-rename-activity.spec.ts"
plan_ref: I3
status: ready
---

# IT-137 — F-059 Lookup Table Rename Audit Trail (PLT-057 / #1753 Defect 2)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` e2e spec runs the same steps and writes the same result.

## 1. What this checks

Renaming a lookup table runs `ALTER TABLE ... RENAME TO` on the documented public `lookup_tables_schema`
surface (IT-048 pins that data-loss cascade). Before PLT-057, that mutation emitted **no** activity
event — `ReferenceDataServiceImpl.updateLookupTable` carried no `@ActivityLog` and `ActivityEventTypeDto`
had no `LOOKUP_TABLE_RENAMED` slot — so an operator investigating a downstream pipeline break could not
answer "who renamed which table when" from the platform. The fix annotates the service method and adds
`LookupTableRenamedActivityHandler`, which captures the lookup table's **display name** (the field the
edit form changes) before and after, keyed to the lookup table's backing data entity.

- **UC-001 (was CONTRADICTED, FIXED by PLT-057 D2):** a rename emits exactly one `LOOKUP_TABLE_RENAMED`
  activity event whose `old_state.name` is the pre-rename name and `new_state.name` is the post-rename
  name; the event renders in the Activity feed as "Table name was updated from `<old>` to `<new>`".
  **Consequence if it FAILS (the pre-fix bug):** the rename audit trail is silent.
- **UC-002 (guard — harmless edit):** a description-only edit (name unchanged) emits **no**
  `LOOKUP_TABLE_RENAMED` event — the activity aspect's `oldState == newState` guard suppresses it. A
  metadata-only edit is not a rename. **Consequence if it FAILS:** every edit would spam a false rename.

This test drives the **REAL rename via the API** (not a SQL-seeded activity row), so the activity ASPECT
fires — the only way to prove the emission. The aspect is `@Profile("!integration-test")` (disabled in
the in-process JUnit profile) but ACTIVE on the docker-deployed SUT this suite runs against.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (platform + Postgres), `AUTH_TYPE=DISABLED` (default) so the reference-data
  endpoints are reachable anonymously and the anonymous principal is the activity actor. The e2e harness
  brings the stack up/down; `ODD_STACK_EXTERNAL=1` reuses a running one.
- **Seed data:** `ensureNamespace('it137_ns')`; the lookup tables are created by the REAL API (the
  arrange). Prior `it137_`-prefixed tables are dropped first (idempotent).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Namespace present: `SELECT 1 FROM namespace WHERE name='it137_ns'`

## 4. Run protocol

1. `POST /api/referencedata/table` `{name:'it137_customer_lookups', namespace_name:'it137_ns'}` → **200**;
   read `data_entity_id` (`SELECT data_entity_id FROM lookup_tables WHERE id=<id>`).
2. `GET /api/dataentities/{data_entity_id}/activity?begin_date=<ISO now-1d>&end_date=<ISO now+1d>&size=50`
   → no `LOOKUP_TABLE_RENAMED` event yet.
3. `PUT /api/referencedata/table/{id}` `{name:'it137_customer_lookup_codes'}` → **200**.
4. Re-read the entity activity feed → exactly one `LOOKUP_TABLE_RENAMED` event with
   `old_state.name='it137_customer_lookups'`, `new_state.name='it137_customer_lookup_codes'` (UC-001).
5. Open `http://localhost:18080/activity?beginDate=<ms>&endDate=<ms>&size=30&type=ALL`; the renamed
   table `it137_customer_lookup_codes` renders in the global feed.
6. Create `{name:'it137_stable_name', description:'before'}`; `PUT {name:'it137_stable_name', description:'after'}`
   → **200**; the entity activity feed has **no** `LOOKUP_TABLE_RENAMED` event (UC-002 guard).

**Automated rail:** `integration-tests/run-suite.sh IT-137`
(runs `e2e/specs/lookup-rename-activity.spec.ts`). RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-137`.

## 5. What it checks — assertions

- **PASS** when: a name-changing rename emits exactly one `LOOKUP_TABLE_RENAMED` event carrying the
  old + new name and renders in the feed (UC-001); AND a description-only edit emits none (UC-002).
- **FAIL** when: the rename emits no event (the pre-fix bug regressed), emits the wrong old/new name, or
  a description-only edit spuriously emits a rename event.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-137.md` (+ Playwright report on failure).

## Cross-references
- Source: F-059 UC-001 (destructive physical rename — IT-048) + this audit-trail facet;
  `lineage/odd-platform/feature-flows/detail/F-059.yaml`. Resolves PLT-057 Defect 2.
- Code: `ReferenceDataServiceImpl.updateLookupTable` (`@ActivityLog(LOOKUP_TABLE_RENAMED)` +
  `@ActivityParameter`), `service/activity/handler/LookupTableRenamedActivityHandler.java`,
  `dto/activity/LookupTableNameActivityStateDto.java`, `mapper/ActivityMapper.java` (mapState case),
  `ActivityEventTypeDto` + spec `ActivityEventType` (LOOKUP_TABLE_RENAMED) +
  `ActivityState.lookup_table_name`; FE `ActivityItem.tsx` (both global + per-entity) render the
  `Table name` field. Sibling pin: IT-048 (the physical rename cascade — unchanged, still GREEN).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (Master Data Management lifecycle).
