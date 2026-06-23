---
id: IT-140
title: "A lookup table's Description (set at create or edit) renders on the associated entity Overview (as the external/source description)"
gates:
  validates: [F-026]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/lookup-description-on-overview.spec.ts"
plan_ref: ""
status: ready
---

# IT-140 — Lookup-table description reaches the entity Overview (F-026 / #1781)

> A protocol is the source of truth — a human can execute every step below without tooling.
> The `automation:` e2e spec runs the same steps and reaches the same verdict.

## 1. What this checks

Closing odd-platform#1781: the Lookup-Table create/edit form has a Description field saved to
`lookup_tables.description`, but it was **never propagated to the associated catalog Data Entity**, so
the entity Overview showed nothing — a quiet waste of the operator's curation effort on a surface
(master-data reference tables) where description quality matters.

The fix treats a lookup table as a **source** auto-ingested into the catalog: its description becomes
the Data Entity's **external (source) description** (`DataEntityMapperImpl.mapCreatedLookupTablePojo`
on create + `applyToPojo(DataEntityPojo, ReferenceTableDto)` on update), which the Overview already
renders read-only (`OverviewDescription.tsx` → `ExternalDescription.tsx`, shown when non-empty). The
catalog's own **internal** description (the term-linkable About editor) is left independent and is
NOT clobbered by a lookup-table edit — verified by the mapper unit test; term-linking itself is
unchanged and is covered by IT-081.

- **Create:** a lookup table created with a description shows that description on its entity Overview.
- **Edit:** editing the lookup-table description updates what the Overview shows (the old value is
  replaced).
- **Negative:** a lookup table created without a description shows no description on the Overview
  (no stale/placeholder).

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal`, `AUTH_TYPE=DISABLED` (default) so the reference-data endpoints are
  reachable anonymously. The e2e harness brings the stack up/down (or reuses it under
  `ODD_STACK_EXTERNAL`/`ODD_STREAM`).
- **Seed data:** `ensureNamespace('it140_ns')` (create resolves the namespace by name and short-circuits
  if absent). Lookup tables are created by the REAL API (the act, the bug's own path — not a DB seed).
  Prior `it140_`-prefixed tables are dropped first (idempotent). The entity id is read back from the
  create response (`dataset_id`, DB-serial — never hardcoded).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}` (or the
  isolated stream's base URL).
- Namespace present: `SELECT 1 FROM namespace WHERE name='it140_ns'`.

## 4. Run protocol

1. **Create:** `POST /api/referencedata/table {name:'it140_with_desc', namespace_name:'it140_ns',
   description:'<marker>'}` → **200** (returns `dataset_id`). Open `/dataentities/{dataset_id}/overview`;
   wait for the `GET /api/dataentities/{dataset_id}` detail response; the `<marker>` text is visible.
2. **Edit:** create `it140_edit_desc` with `<marker>`, then `PUT /api/referencedata/table/{id}
   {name:'it140_edit_desc', description:'<new-marker>'}` → **200**. Open the entity Overview; the
   `<new-marker>` is visible and the old `<marker>` is gone.
3. **Negative:** create `it140_no_desc` with no description. Open the entity Overview; the `<marker>`
   text is absent (count 0).

**Automated rail:** `integration-tests/run-suite.sh IT-140`
(runs `e2e/specs/lookup-description-on-overview.spec.ts`).

## 5. What it checks — assertions

- **PASS** when: the create-time description renders on the Overview; an edit updates it (old value
  replaced); and a no-description table renders nothing.
- **FAIL** when: the description never appears (the propagation is broken — the #1781 bug, RED on
  `ODD_SUT=ref:main`); or an edit does not update the Overview; or a stale/placeholder value shows for
  a table with no description.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-140.md` (+ Playwright report on failure).

## Cross-references
- Source: F-026 (Lookup Tables RDM) + F-004 (Entity Description display); the propagation links them.
  Fix: `odd-platform-api/.../mapper/DataEntityMapperImpl.java` (`mapCreatedLookupTablePojo` +
  `applyToPojo(DataEntityPojo, ReferenceTableDto)` — `.setExternalDescription(...)`). Carrier:
  `ReferenceTableDto.tableDescription` (`ReferenceDataServiceImpl.java:83` create / `:121` update).
  Render: `odd-platform-ui/.../Overview/OverviewDescription/{OverviewDescription,ExternalDescription}.tsx`.
- Unit: `DataEntityMapperImplTest` (the mapper-level RED→GREEN + the no-clobber-of-internal assertion).
- Issue: odd-platform#1781 (`CTRIB-032`). The lookup-table description is the entity's external
  description (transitional; docs note a future consolidation to a single description).
