---
id: IT-131
title: "DQ test severity: the overview shows the CURRENT test's severity (no sibling bleed) and a change is confirm-gated + store-reflected"
gates:
  validates: [F-057]
  enforces: []
  regresses: ["odd-platform#1750"]
test_class: integration
stack: odd-minimal
automation: "e2e:dq-severity-render-bleed.spec.ts"
plan_ref: CTRIB-015
status: ready
---

# IT-131 — DQ severity render fidelity + confirm gate (#1750 / CTRIB-015)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` spec is a convenience rail that runs the same steps and writes the
> same result; it never replaces the protocol.

## 1. What this checks
F-057 (DQ Test Severity Lifecycle), the **UI render + edit** contract that IT-057 (SLA/PUT/DB) does
not exercise. Grounded against the running platform on `http://localhost:18080` (AUTH_TYPE=DISABLED).

- **REGRESSION — sibling-test bleed (odd-platform#1750):** on a dataset with >1 DQ test, the
  test-report overview Severity control kept showing the FIRST-mounted test's severity after an
  **in-app** navigation to a sibling test (every other field updated; severity did not), until a
  full page refresh. Three composing causes: an uncontrolled `defaultValue` MUI select read once at
  mount; the overview route element with no `key={dataQATestId}` (no remount on test switch); and the
  `dataQualityTest` slice never reducing `setDataQATestSeverity.fulfilled` (stale store after a save).
  Operator consequence: a sibling's severity reads wrong on a panel whose every other field is right,
  and "correcting" it through the same no-confirm control persists a genuinely wrong severity.

- **SUCCESS — confirm gate + store reflection (the fix):** choosing a new severity opens a
  confirmation dialog previewing the change (old -> new) and does NOT persist until confirmed; on
  confirm the mutation is awaited and reduced into the store, so the control reflects the persisted
  value WITHOUT a page refresh. This conforms severity to the entity-Status edit pattern
  (`adrs/drafts/confirm-and-store-reduce-field-edits.md`).

## 2. Preparation — build the test stand
- **Stack**: the shared odd-minimal stack (`ODD_STACK_EXTERNAL=1` — never bring it up/down). API
  `http://localhost:18080`, Postgres `:15432`, `AUTH_TYPE=DISABLED`.
- **Seed data** (the spec does this, idempotently, namespaced `it1750_`):
  1. `POST /api/datasources` to register source `//it1750`.
  2. `POST /ingestion/entities` with: a dataset (`type:TABLE`), and TWO DQ tests in the SAME suite
     (`it1750_suite`) — `it1750_test_alpha` and `it1750_test_beta` — each with one run.
  3. Resolve the dataset id + the two DQ-test ids from `data_entity.oddrn`.
  4. `PUT …/severity` to give the two tests DIFFERENT severities: alpha = `MINOR`, beta = `CRITICAL`.

## 3. Readiness check
- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: the two `it1750_test_*` entities exist and carry distinct severities.

## 4. Run protocol
**A — the sibling bleed (the #1750 regression):**
1. Open `/dataentities/{dsId}/test-reports/{alphaId}/overview` (fresh load). The Severity control
   shows `MINOR` (alpha's own).
2. **Click `it1750_test_beta` in the left test list** (in-app react-router navigation — NOT a fresh
   reload, which would remount and mask the bug).
3. The panel heading updates to `it1750_test_beta`. Read the Severity control: it must show
   `CRITICAL` (beta's own). Pre-fix it stayed `MINOR` (alpha's, bled through).

**B — the confirm gate + store reflection:**
4. On a test showing `MINOR`, click the Severity control → a menu of severities opens.
5. Choose `MAJOR` → a confirmation dialog "Change the severity from MINOR to MAJOR?" appears; the
   control still shows `MINOR` (nothing persisted yet).
6. Click `Apply` → the dialog closes and the control shows `MAJOR` (store-reduced, no refresh).
7. Reload the page → the control still shows `MAJOR` (genuinely persisted).

## 5. What it checks — assertions
- **PASS** when: (A) after in-app navigation to a sibling test, the Severity control shows that
  test's OWN severity; (B) a severity change does not persist until confirmed, and after confirming
  the control reflects the new value without a refresh and it survives a reload.
- **FAIL** when: a sibling test renders the previously-viewed test's severity (the #1750 bleed
  returns); or a selection persists with no confirmation; or the control does not reflect a saved
  change until a manual refresh (the missing store reduce returns).

## 6. Result log
Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-131.md` (date · stack_commit · runner ·
outcome · evidence · notes).

## Cross-references
- Source: F-057 · `lineage/odd-platform/feature-flows/detail/F-057.yaml`
- Sibling API/SLA lifecycle (complementary, not overlapping): IT-057
- Issue / work record: odd-platform#1750 · `contributor/CTRIB-015.md`
- Fix: `odd-platform-ui` `TestReportDetailsOverview` (SelectableSeverity) · `TestReportDetails` (route key) ·
  `dataQualityTest.slice` (`setDataQATestSeverity.fulfilled`); ADR `adrs/drafts/confirm-and-store-reduce-field-edits.md`
