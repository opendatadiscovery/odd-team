---
id: IT-146
title: "Dataset Structure tab filters its columns by tag and by data type (client-side, #1679)"
gates:
  validates: [F-047]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:dataset-structure-tag-filter.spec.ts"
plan_ref: ""
status: ready
---

# IT-146 — F-047 Dataset Structure: in-page tag / type column filter (#1679 / CTRIB-038)

> A protocol is the source of truth — a human can execute every step below WITHOUT tooling.
> The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

The Dataset → **Structure** tab renders the tags present across the dataset's columns as **clickable
chips** (each showing how many columns carry it) that **filter the column list** to columns with the tag,
and makes the existing **data-type** count chips clickable filters too — all client-side over the
already-loaded structure (`DataSetField.tags` is in the payload), composed with the name search, with a
clear-all reset (issue #1679).

**Operator consequence if it fails:** an operator on a wide dataset (the #1679 mockup shows 153 columns)
cannot narrow the column list to the columns that matter (e.g. the sensitive/PII-tagged ones) and falls
back to "extract everything and check outside ODD" — the discovery failure the catalog exists to remove.

Source: #1679 (clintjb); CTRIB-038; odd-sme consult
`lineage/odd-platform/sme-consultations/2026-06-26-dataset-structure-tag-filter.md`.

## 2. Preparation — build the test stand

TIER: read-path / UI mechanics over realistic ingested structure — the fast tier is correct (the feature
is a client-side filter over the structure payload; no collector-mapping semantics under test). Tags are
seeded through the **real stats-ingestion path** (the only anonymous tag-mint under DISABLED — IT-047),
not the `PUT /api/datasetfields/{id}/tags` write path (out of scope; that path is unrelated to this read
feature and 500'd on a stale image during reproduction).

- **Stack:** `odd-minimal` (`AUTH_TYPE=DISABLED`), the e2e harness default (`integration-tests/e2e`).
- **Seed (collision-free band 2146):**
  - a `data_source` (`//e2e-it146/ds`) + a TABLE entity `//e2e-it146/ds/tables/it146_tbl` with four columns:
    `it146_email`, `it146_name` (TYPE_STRING) and `it146_amount`, `it146_count` (TYPE_NUMBER) — few enough
    that the virtualized list renders all rows.
  - field tags via `POST /ingestion/entities/datasets/stats`: `it146_email` → `{it146pii, it146sensitive}`,
    `it146_name` → `{it146pii}`  ⇒ `it146pii` count 2, `it146sensitive` count 1; types Str (2) / Dec (2).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `GET /api/datasets/{id}/structure` → `field_list[]` of 4, with `it146_email.tags` containing
  `it146pii` + `it146sensitive` (confirms tags are in the structure payload — the LSN-031 running-system
  check the client-side filter depends on).

## 4. Run protocol

1. Navigate to `/dataentities/{id}/structure`.
2. Confirm all four column names render.
3. Confirm a tag chip `it146pii` renders in the header (`[data-qa="dataset-structure-tag-filter"]`) showing
   count `2`.
4. Click the `it146pii` chip → the list narrows to `it146_email` + `it146_name`; `it146_amount` + `it146_count`
   disappear.
5. Click **Clear All** → the full four-column list returns.
6. Click the `Dec` (number) type chip (`[data-qa="dataset-structure-type-filter"]`) → the list narrows to
   `it146_amount` + `it146_count`; the string columns disappear.

**Automated rail:** `integration-tests/run-suite.sh IT-146` (or via `run-regression.sh <id>` in the
feature-complete suite). RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-146`.

## 5. What it checks — assertions

- **PASS** when: the tag chip renders with its column count; clicking it filters the column list to the
  tagged columns; the type chip filters by type; Clear All restores the full list.
- **FAIL** (regression signature) when: no tag chips render, the type chips are inert, a chip click does not
  filter the list, or Clear All does not reset — i.e. the #1679 affordance is absent or broken (the `ref:main`
  baseline, by construction).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-146.md` (and the suite log when run via a suite).
Fields: `date · stack_commit · runner · outcome · evidence · notes`.

## Cross-references
- Source: F-047 (dataset field per-column surface) + #1679; CTRIB-038; reuse precedent `TopTagsList` /
  `catalog-overview.md` (one-click tag-filter chips).
- Related ITs: IT-023 (structure display), IT-039 (structure via ingestion), IT-047 (stats tag handling — the
  seeding path).
