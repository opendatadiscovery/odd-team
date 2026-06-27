---
id: IT-147
title: "Dataset Structure filter reflects an in-page tag-add without reload + labels the filter chips (#1679 / CTRIB-040)"
gates:
  validates: [F-047]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:dataset-structure-filter-reactivity.spec.ts"
plan_ref: ""
status: ready
---

# IT-147 — F-047 Dataset Structure: filter reactivity + filter labels (#1679 / CTRIB-040)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

Two maintainer-found UX defects on the #1679 Structure-tab tag/type filter (built by CTRIB-038):

1. **Reactivity** — after adding a tag to a column via the per-column Tags editor, the new tag must appear
   in the header filter-chip list **immediately, without a full page reload**. (Root cause: the structure
   view's jotai `datasetStructureRootAtom` was hydrated once at mount and never re-synced when redux
   updated the column's tags; `SyncAtoms` re-syncs it.)
2. **Discoverability** — the tag chips and the (clickable) type chips must carry a label naming the
   affordance (`Filter by tag` / `Filter by type`), so an operator knows they filter the column list.

**Operator consequence if it fails:** an operator tags a column for navigation, looks for it in the filter
bar, does not find it, and concludes the filter is broken (defect 1); or never realises the chips filter at
all (defect 2) — both push them back to "extract everything and check outside ODD".

Source: #1679 (clintjb); CTRIB-040 (follow-up to CTRIB-038); maintainer live report.

## 2. Preparation — build the test stand

TIER: read/UI-mechanics over realistic ingested structure (fast tier — a client-side filter + a single
real tag-write round-trip; no collector-mapping semantics under test). The baseline tag is seeded through
the **real stats-ingestion path** (IT-047); the NEW tag is added through the **UI editor** — the only path
that exercises the redux → atom flow the reactivity defect lives in.

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), the e2e harness default.
- **Seed (collision-free band 2147):** a `data_source` (`//e2e-it147/ds`) + a TABLE
  `//e2e-it147/ds/tables/it147_tbl` with three columns: `it147_email`, `it147_plain` (TYPE_STRING) and
  `it147_amount` (TYPE_NUMBER). `it147_email` carries tag `it147pii` via `POST .../datasets/stats`;
  `it147_plain` starts untagged (it is the one tagged through the UI).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `GET /api/datasets/{id}/structure` → `field_list[]` of 3; `it147_email.tags` contains
  `it147pii`; `it147_plain.tags` empty.

## 4. Run protocol

1. Navigate to `/dataentities/{id}/structure`.
2. Confirm the three column names render and the `it147pii` tag chip renders in the header
   (`[data-qa="dataset-structure-tag-filter"]`).
3. Confirm the header carries a **`Filter by tag`** label and a **`Filter by type`** label.
4. Confirm there is no `it147livetag` filter chip yet.
5. Click the `it147_plain` column row → the right-rail editor re-points to it.
6. In its **TAGS** section click **Add tags** → in the dialog, type `it147livetag` in the tag input
   (`Enter tag name`), pick the offered "create new" option, then click **Save** (a `PUT
   /api/datasetfields/{id}/tags`).
7. **Without reloading**, confirm an `it147livetag` chip now appears in the header filter, and clicking it
   narrows the column list to `it147_plain` (the `it147_email` row disappears).

**Automated rail:** `integration-tests/run-suite.sh IT-147`. RED proof:
`ODD_SUT=ref:c37ca11b integration-tests/run-suite.sh IT-147` (the CTRIB-038 head — pre-fix: no labels, and
the new chip never appears without a reload).

## 5. What it checks — assertions

- **PASS** when: the `Filter by tag` / `Filter by type` labels render; a tag added through the UI appears in
  the header filter without a reload and filters the list.
- **FAIL** (regression signature) when: the labels are absent, or the newly-added tag chip does not appear
  in the header filter until the page is reloaded — i.e. the `ref:c37ca11b` baseline, by construction.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-147.md` (and the suite log when run via a suite).
Fields: `date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: F-047 (dataset field per-column surface) + #1679; CTRIB-040 (follow-up to CTRIB-038 / IT-146).
- Related ITs: IT-146 (the tag/type filter itself), IT-079 (the per-column annotation editor — the tag-add
  surface), IT-047 (stats tag handling — the baseline seeding path).
