---
id: IT-078
title: "Dataset schema revision Compare viewer renders the per-field diff between two versions"
gates:
  validates: [F-191]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:schema-revision-compare.spec.ts"
plan_ref: I9
status: ready
---

# IT-078 — Dataset Schema Revision Compare Viewer

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec runs the same steps and writes the
> same result; it never replaces the protocol.

## 1. What this checks
The Compare viewer (`/dataentities/{id}/structure/compare?firstVersionId=&secondVersionId=` →
`DatasetStructureCompare.tsx`) renders the side-by-side per-field diff between two dataset versions:
a field present only in the newer version shows as CREATED, a field present only in the older version
shows as DELETED, and both field names render. Source: F-191 (UC-001/UC-003 confirmed-but-untested;
the feature sat at 0/11 verified promises). Operator consequence if it FAILS: an operator
investigating "what changed in this table's schema between ingest A and ingest B" sees a blank or
wrong diff and is misled about a breaking schema change.

## 2. Preparation — build the test stand
- **Stack**: the shared odd-minimal stack (UI+API on :18080, Postgres on :15432), AUTH_TYPE=DISABLED.
  Run with `ODD_STACK_EXTERNAL=1` to reuse it (never bring up / tear down).
- **Auth/config**: AUTH_TYPE=DISABLED (odd-minimal default → permitAll).
- **Seed data** (via `dbQuery`, ids 20780–20789, oddrn `//e2e-it078/`): a DATA_SET entity (id 20781,
  `entity_class_ids='{1}'`) with TWO `dataset_version` rows for the same `dataset_oddrn` —
  v1 = {it078_col_a, it078_col_b}, v2 = {it078_col_a, it078_col_c}. Each `dataset_field` carries a
  valid `type` JSONB and non-null `stats` ('{}'); the structure link is via `dataset_structure`.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT df.name FROM dataset_structure ds JOIN dataset_field df ON df.id = ds.dataset_field_id JOIN dataset_version dv ON dv.id = ds.dataset_version_id WHERE dv.dataset_oddrn = '//e2e-it078/db/tables/it078_ds';` returns it078_col_a/b/c across the two versions.

## 4. Run protocol — what to run
1. Navigate to `/dataentities/20781/structure/compare?firstVersionId={v1}&secondVersionId={v2}`.
2. Wait for `GET /api/datasets/20781/structure/diff?first_version_id={v1}&second_version_id={v2}` (200).
3. Read the rendered Compare surface.
4. (Corner) Navigate the same route with `firstVersionId == secondVersionId`; observe the diff request
   is refused 4xx and no diff row renders.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/schema-revision-compare.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the "Revision compare" header renders; the v1-only field (it078_col_b, DELETED) and
  the v2-only field (it078_col_c, CREATED) both render in the diff; a column in neither version
  (it078_ghost_col) does not render; and identical version-ids return a 4xx with no diff row.
- **FAIL** when: the diff renders blank, omits the added/removed field, renders a ghost column, or the
  identical-id case returns 200 with a confident (nonsense) diff.

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-078.md` per the standard fields.

## Cross-references
- Source: F-191 (UC-001 render, UC-003 status-coded diff; UC-005/UC-006 error/empty corner — PLT-028)
- Feature flow: `lineage/odd-platform/feature-flows/detail/F-191.yaml`
- Backend diff: `DatasetVersionServiceImpl.getDatasetVersionDiff` (400 on identical ids)
