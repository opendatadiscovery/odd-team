## REFACTOR-654 — Data Quality Dashboard's "Table Health" classification has a subtle SKIPPED ambiguity — a dataset with all-SUCCESS-but-one-SKIPPED latest runs classifies as WARNING (correct per CTE algebra) but operators may expect SKIPPED to be benign; the doc page does not disclose the rules

**Severity**: LOW
**Category**: operator-surprise-classification-rules
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-04 Data Quality]

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[6]` (LOW) — "**Table Health computation has a subtle classification gap: a dataset whose latest runs are all SUCCESS but include a SKIPPED is classified HEALTHY; the operator may expect SKIPPED to be a 'caution' state.** The HEALTHY CTE: `NOT EXISTS last_run WHERE STATUS != SUCCESS` (`ReactiveDataQualityRunsRepositoryImpl.java:118-124`). A dataset with 10 tests where 9 latest-runs are SUCCESS and 1 is SKIPPED is classified NOT-HEALTHY (because SKIPPED != SUCCESS) but also NOT-ERROR (no BROKEN/FAILED) → WARNING. Conversely a dataset with ALL SUCCESS latest-runs IS healthy."

**Statement**: The "Table Health" ring classifies datasets into HEALTHY / WARNING / ERROR via a three-CTE algebra:

```sql
-- HEALTHY: every latest_run is SUCCESS
HEALTHY: NOT EXISTS (last_run WHERE STATUS != SUCCESS)

-- ERROR: at least one latest_run is BROKEN or FAILED, and not in HEALTHY
ERROR: EXISTS (last_run WHERE STATUS IN ('BROKEN', 'FAILED')) AND NOT IN healthy

-- WARNING: everything else (has DQ test, not HEALTHY, not ERROR)
WARNING: has DQ test AND NOT IN healthy AND NOT IN error
```

The classification is mutually exclusive and exhaustive over datasets with at least one DQ test. The operator-surprise: a dataset where ALL latest runs are SUCCESS except ONE SKIPPED classifies as WARNING (not HEALTHY because SKIPPED != SUCCESS; not ERROR because no BROKEN/FAILED). An operator may expect SKIPPED to be benign — "the test was skipped, not failed" — and infer HEALTHY.

The CTE algebra is internally consistent; the doc page (`https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status 200) enumerates the three categories but provides NO rules. The operator cannot predict which colour their dataset will render.

**Evidence**:
- HEALTHY CTE: `ReactiveDataQualityRunsRepositoryImpl.java:118-124` (`STATUS notIn(SUCCESS)`)
- ERROR CTE: `ReactiveDataQualityRunsRepositoryImpl.java:127-146` (`STATUS in (BROKEN, FAILED)` AND not in healthy)
- WARNING CTE: `ReactiveDataQualityRunsRepositoryImpl.java:148-157` (fallthrough)
- Doc page silent on rules: WebFetch 2026-05-25 status 200

**Existing-ADR-or-implied-prescription**: no governing ADR. The classification rules are encoded in the SQL but not anchored to a decision.

**Proposed remedy**:
- **Option A (doc-side fix)**: update the live dashboard page to enumerate the three rules verbatim (HEALTHY = all SUCCESS latest runs; ERROR = any BROKEN/FAILED latest run; WARNING = everything else).
- **Option B (semantic change)**: reclassify SKIPPED as benign — include it in HEALTHY. Changes the metric semantic; operator-visible.
- **Option C (UI tooltip)**: render a per-dataset tooltip on the Table Health ring explaining why each dataset is classified.

Option A is the smallest change.

**Severity rationale**: LOW — minor operator-surprise; the SQL is consistent; the metric's value (for triage) is unchanged once rules are documented.

**Suggested backlog grouping**: `Quality Dashboard observability sprint` (consolidates with REFACTOR-600 — multi-axis dashboard doc incompleteness).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-600 (the multi-axis doc-incompleteness cluster).
- SUPERSEDES: none.
- CONFLICTS: none.

---
