---
id: IT-130
title: "DQ dashboard ownership-role filter is labelled 'Owner title', not the ambiguous 'Title' (UI e2e)"
gates:
  validates: [F-032]
  enforces: []
  regresses: []
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/dq-owner-title-filter-label.spec.ts"
plan_ref: "CTRIB-011 (#1767) — the LSN-020 input-name-vs-binding family"
status: ready
expected_result: "GREEN on the working-tree SUT (the relabel fix). RED on ODD_SUT=ref:main — the pre-fix filter renders the bare label 'Title', so 'Owner title' is absent. Traces #1767 / CTRIB-011 / PLT-179."
---

# IT-130 — DQ dashboard ownership filter must read "Owner title", not bare "Title"

> **This is an integration test for F-032 (Quality Dashboard).** It drives the real
> Data Quality dashboard and asserts the user-visible filter label — the symptom an
> operator actually sees. The mislabel is invisible to a back-end test (the binding is
> correct); only the rendered label is wrong. The matching unit-level proof is
> `odd-platform-ui/.../FilterItem/__tests__/TitleFilter.test.tsx`.

## 1. What this checks
The Data Quality dashboard's ownership filter — whose value space is ODD's ownership-Title
catalog and whose selected ids bind to `OWNERSHIP.TITLE_ID` (the role an owner holds, e.g.
"Data Steward") — must be labelled **"Owner title"**, NOT the bare **"Title"**.

**Operator-facing consequence if it FAILS:** the bare "Title" reads as the *dataset name*.
An operator scoping "what is the health of dataset X" types X under "Title" and gets a real,
non-empty, plausible aggregate that is actually "datasets owned under role X" — a silent,
confidently-wrong slice with no error and no empty state to prompt a second look. This may
drive a wrong go/no-go decision on a metrics surface operators trust.
Source: #1767 · CTRIB-011 · PLT-179 · `TitleFilter.tsx:29` (label) +
`ReactiveDataQualityRunsRepositoryImpl` (the `OWNERSHIP.TITLE_ID` bind).

## 2. Preparation — build the test stand
Fast read-path/UI tier (no ingestion, no seed): the filter sidebar
(`DataQuality.tsx:11` → `DataQualityFilters`) renders statically on `/data-quality`,
independent of any DQ data, so no arrange step is needed.

- **Stack**: `odd-minimal` (platform + Postgres; UI at `http://localhost:18080`),
  built from the **working-tree SUT** (`integration-tests/run-suite.sh` default
  `ODD_SUT=working` builds `odd-platform:odd-team-sut` from the working tree each run).
- **Auth/config**: `AUTH_TYPE=DISABLED` (odd-minimal default).
- **Seed data**: none.

## 3. Readiness check — is the stand ready?
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- The SPA serves: `curl -fsS http://localhost:18080/` returns the index HTML.

## 4. Run protocol — what to run
1. Open `/data-quality`.
2. Confirm the filter sidebar rendered (the "Filters" heading is visible).
3. Read the label of the ownership filter (the one sitting directly below the "Owner"
   filter, on both the tables side and the tests side).

Automated: `integration-tests/run-suite.sh IT-130` (working-tree SUT, GREEN-expected).
RED proof: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-130` (pre-fix, the label
reads the bare "Title").

## 5. Assert — the pass condition
- **PASS:** the ownership filter is labelled **"Owner title"**, and it appears on both
  the tables side and the tests side of the panel (count >= 2).
- **FAIL (pre-fix):** the filter is labelled the bare **"Title"**; "Owner title" is absent.

## 6. Teardown
Stack is ephemeral (`run-suite.sh` tears it down). No seed to clean. A screenshot of the
rendered filter sidebar is captured to `e2e/test-results/it-130-dq-owner-title-filter.png`
for the design-before-build pixel review.
