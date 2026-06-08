---
id: IT-079
title: "Per-column annotation editor renders the column name, INTERNAL DESCRIPTION + the annotation"
gates:
  validates: [F-192]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:column-annotation-editor.spec.ts"
plan_ref: I9
status: ready
---

# IT-079 — Per-Column Annotation Editor Composition

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec runs the same steps and writes the
> same result; it never replaces the protocol.

## 1. What this checks
The Structure tab's two-column view (`DatasetStructureView.tsx`) renders the per-column annotation
editor (`DatasetFieldOverview.tsx`) on the right against the selected field (default =
`datasetStructureRoot[0]`). The editor renders the column name (`<h1>`), the `INTERNAL DESCRIPTION`
section heading, and the column's internal description text (or "Description is not created yet" when
empty). Source: F-192 (UC-001 confirmed-but-untested; the feature sat at 0/11 verified promises).
Operator consequence if it FAILS: the annotation editor renders blank and a data engineer cannot read
a column's documented meaning when curating a dataset's schema.

## 2. Preparation — build the test stand
- **Stack**: shared odd-minimal (UI+API :18080, Postgres :15432), AUTH_TYPE=DISABLED;
  `ODD_STACK_EXTERNAL=1` to reuse (never bring up / tear down).
- **Seed data** (via `dbQuery`, ids 20790–20799, oddrn `//e2e-it079/`): a DATA_SET entity (id 20791,
  `entity_class_ids='{1}'`) with one `dataset_version` + one `dataset_field` (it079_described_col)
  carrying a distinctive `internal_description`; the structure link via `dataset_structure`.
  A second entity (id 20792) with a column (it079_empty_col) and NULL `internal_description` for the
  empty-annotation corner. Each field: valid `type` JSONB + non-null `stats` ('{}').

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT internal_description FROM dataset_field WHERE oddrn = '//e2e-it079/db/tables/it079_described/columns/it079_described_col';` returns the seeded annotation.

## 4. Run protocol — what to run
1. Navigate to `/dataentities/20791/structure/overview/{versionId}` (the versioned structure overview;
   navigating `/structure` redirects here automatically).
2. Wait for `GET /api/datasets/20791/structure/{versionId}` (200) — the fetch that hydrates the view.
3. Read the right-rail per-column editor.
4. (Corner) Repeat for entity 20792 (un-annotated column); observe the empty-annotation placeholder.

**Automated rail**: `cd integration-tests/e2e && PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/column-annotation-editor.spec.ts --reporter=line`

## 5. What it checks — assertions
- **PASS** when: the editor renders the column name + the `INTERNAL DESCRIPTION` heading + the
  annotation text (matching the DB `internal_description`); the un-annotated column renders
  "Description is not created yet".
- **FAIL** when: the editor renders blank, omits the INTERNAL DESCRIPTION section, shows the wrong/no
  annotation text, or shows annotation text for an un-annotated column.

## 6. Result log
Append a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-079.md` per the standard fields.

## Cross-references
- Source: F-192 (UC-001 re-point/render; the composer is the operator entry-point to the F-047 chain)
- Feature flow: `lineage/odd-platform/feature-flows/detail/F-192.yaml`
- Render path: `DatasetFieldDescription.tsx` + `DatasetFieldDescriptionPreview.tsx`
