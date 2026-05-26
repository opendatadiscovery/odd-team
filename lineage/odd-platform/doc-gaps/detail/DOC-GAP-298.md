---
doc_gap_id: DOC-GAP-298
severity: MEDIUM
category: drift
batch: ZG
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"   # Quality Dashboard — Table Health is one of the three rings
related_features:
  - F-022          # per-dataset Test Reports — sibling DQ surface; uses a different per-dataset SLA classification
related_doc_gaps:
  - DOC-GAP-266    # Table Health LABEL vocabulary drift; THIS finding is the classification RULES gap (different facet, same ring)
  - DOC-GAP-265    # sibling dashboard 3-vs-6 status finding
  - DOC-GAP-297    # sibling test_results per-test-vs-per-run drift; same dashboard
related_retrospectives: []
---

## DOC-GAP-298 — Quality Dashboard Table Health classification RULES are entirely undocumented; the live `/features/data-quality/dashboard` page (WebFetched 2026-05-25 status 200) enumerates three slices (Healthy / Warning / Error per the rendered labels, "success / failed / broken" per the doc-side vocabulary per DOC-GAP-266) but provides NO definitions for how a table is classified into one bucket vs another; the SQL CTE algebra at `ReactiveDataQualityRunsRepositoryImpl.java:111-157` defines the rules: HEALTHY = dataset has at least one DQ test AND NO last_run with status != SUCCESS; ERROR = dataset has a last_run with status in {BROKEN, FAILED} AND is NOT in healthy; WARNING = everything-else-with-a-DQ-test (typical case: status in {SKIPPED, ABORTED, UNKNOWN}); the rules are NOT mutually independent — they are layered as Healthy-first, then Error, then Warning as the residual — and operators cannot predict which colour their dataset will render without reading the SQL; additionally datasets WITHOUT any DQ tests are silently absent from all three buckets (they appear only in the Monitored Tables ring's Not-Monitored slice — a doc-side missing-cross-link); the classification has a subtle gap: a dataset with 10 tests where 9 latest-runs are SUCCESS and 1 is SKIPPED is classified WARNING (not HEALTHY) because SKIPPED != SUCCESS; the operator-mental-model alignment depends on whether SKIPPED is "caution" or "non-failure" — undisclosed

**Severity**: MEDIUM
**Category**: drift (doc-SILENT not doc-WRONG; the rules exist in code but have no doc presence; operators cannot predict the classification of a real dataset from the docs alone)

### Surfaced by

- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:docs_link_semantic.doc_drift_findings.[3]` (MEDIUM per sidecar) — verbatim: *"DOC DRIFT — Table Health classification rules entirely undocumented. The dashboard page enumerates the three categories (healthy / warning / error) but provides no rules. The SQL implements: HEALTHY = `dataset has NO last_run with status != SUCCESS`; ERROR = `dataset has a last_run with status in {BROKEN, FAILED}` AND NOT in healthy; WARNING = `everything else with a DQ test` (i.e. has a DQ test, last runs include non-SUCCESS but no BROKEN/FAILED — typical case: status in {SKIPPED, ABORTED, UNKNOWN}). The doc-vs-code divergence is doc-SILENT not doc-WRONG: the operator cannot predict which colour their dataset will render."*
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[6]` (LOW per sidecar) — verbatim: *"Table Health computation has a subtle classification gap: a dataset whose latest runs are all SUCCESS but include a SKIPPED is classified HEALTHY; the operator may expect SKIPPED to be a 'caution' state. The HEALTHY CTE: `NOT EXISTS last_run WHERE STATUS != SUCCESS` (`ReactiveDataQualityRunsRepositoryImpl.java:118-124`). A dataset with 10 tests where 9 latest-runs are SUCCESS and 1 is SKIPPED is classified NOT-HEALTHY (because SKIPPED != SUCCESS) but also NOT-ERROR (no BROKEN/FAILED) → WARNING."* (Severity reclassified to MEDIUM at the doc-gap level because the doc-side absence amplifies the operator-confusion: with the rules disclosed, the operator can predict; without disclosure, every dataset's bucket is a surprise.)
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[0]` — the denormalised-last-run-table ADR; the classification rules consume the denormalised state.
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:stress_findings.name_behavior_pairs[getLatestTablesHealth]` — MINOR drift on the rendered-label-vs-doc-vocabulary; operator-visible-consequence: *"Datasets without any DQ tests do not appear in the Table Health ring — they appear only in the 'Not Monitored' slice of Monitored Tables. A maintainer reading the ring titled 'Table Health' may expect every Table-type dataset to be counted; only those WITH a DQ test are."*
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:tests_coverage_semantic.uncovered_behaviours[getLatestTablesHealth]` (HIGH per sidecar) — *"a dataset whose ONLY DQ test's latest run is SUCCESS classifies as healthy; same dataset with a single FAILED latest-run classifies as error; a dataset with mixed pass/skip latest runs classifies as warning — no test exercises the 3-way classification"*

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** — verbatim Q answer per sidecar: *"Table Health rules (verbatim absence): the page enumerates three statuses but 'does not provide explicit definitions for healthy, warning, or error states'."*
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:111-126` (the HEALTHY CTE) — `NOT EXISTS last_run WHERE STATUS != SUCCESS` (verbatim per sidecar).
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:127-146` (the ERROR CTE) — `EXISTS last_run WHERE STATUS in {BROKEN, FAILED} AND NOT IN healthy_set`.
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:148-157` (the WARNING CTE) — `dataset has DQ test AND NOT IN healthy AND NOT IN error` (residual bucket).
- `odd-platform/odd-platform-api/src/main/java/.../mapper/TablesDashboardMapperImpl.java:10-39` — the response shape `TablesHealthDashboard.{healthyTables, warningTables, errorTables}`.
- **The SKIPPED-state surprise narrative**: an operator runs Great Expectations checks where some tests are conditionally SKIPPED (e.g. "skip this volume check if the source table has < 100 rows today"). The SKIPPED is intended as "non-applicable", not "caution". The platform classifies the dataset as WARNING because the SKIPPED latest-run does not satisfy `STATUS = SUCCESS`. The operator's mental model ("a SKIPPED test is fine; the table is healthy") does not match the classification ("SKIPPED is not SUCCESS, therefore not Healthy → Warning"). Without doc-side disclosure of the rules, the operator cannot debug their dashboard's WARNING count.
- **The empty-bucket-for-datasets-without-tests narrative**: a dataset that has never had DQ tests configured does not appear in the Table Health ring at all — neither Healthy nor Warning nor Error. It appears in the Not-Monitored slice of the sibling Monitored Tables ring. An operator reading "Table Health" as "the health of every Table" may expect ALL Tables to be counted; the docs do not state the implicit pre-condition that the table must have at least one DQ test.
- **The intent narrative** (per sidecar `implicit_adrs.[3]`): the closed-set mutually-exclusive classification (every dataset with a DQ test falls into exactly one of {Healthy, Error, Warning}) is by-design — the dashboard's three slices total the count of monitored datasets. The Healthy-first / Error-second / Warning-residual ordering reflects an "errors trump warnings, success is everything else" priority that operators would recognise once disclosed but cannot predict from a label alone.

### Drift narrative

The Quality Dashboard's Table Health ring is the second of three flagship visualisations (alongside Test Results Breakdown and Monitored Tables). The doc names the ring and lists three labels; it stops there. The operator who needs to act on "5 datasets in Warning" must drill into the dataset list (via the click-through, if any), inspect each dataset's tests, and reverse-engineer the rule by triangulation. The classification has three layered rules that compose non-obviously: the dominance of Healthy (any non-SUCCESS demotes), the special-cased Error (only BROKEN/FAILED triggers), and the WARNING residual that swallows SKIPPED/ABORTED/UNKNOWN.

The SKIPPED-state behaviour is operator-surprising: SKIPPED is commonly understood as "did not run, by design" — in many DQ frameworks (Great Expectations, dbt with conditional checks) SKIPPED is the explicit "non-applicable" signal. The platform classifies SKIPPED as not-Healthy, so any dataset with a conditionally-skipped test inherits a WARNING badge in perpetuity. Without disclosure, the operator concludes "the dashboard is broken" or "we have a bug" — neither is true; the classification is consistent, just hidden.

The empty-bucket-for-datasets-without-tests surprise is the operator's second confusion point: a brand-new deployment with no DQ tests anywhere shows 0/0/0 in the Table Health ring (a literally empty ring) and the operator may think "the platform isn't ingesting health data" — actually it's correctly reporting "no monitored tables". The doc could cross-link to the Monitored Tables ring to disambiguate.

The sibling DOC-GAP-266 covers the LABEL VOCABULARY drift (the rendered "Healthy/Warning/Error" vs the doc's "success/failed/broken"); THIS finding covers the CLASSIFICATION RULES that produce the labels. The two findings are co-located and the same authoring pass closes both.

### Proposed doc action

**Single-part action — extend the dashboard.md Table Health section with explicit classification rules**.

`documentation/docs/features/data-quality/dashboard.md` — replace the current three-label sentence (after the DOC-GAP-266 vocabulary fix lands) with:

> **Table Health** — the count of monitored tables broken down by their aggregate health status. Each Table with at least one DQ test falls into exactly one bucket:
>
> - **Healthy** (green) — EVERY latest-run on the table's DQ tests is `Success`. The presence of any latest-run with a non-`Success` status (including `Skipped`, `Aborted`, `Unknown`) excludes the table from this bucket.
> - **Error** (red) — AT LEAST ONE latest-run on the table's DQ tests is `Broken` or `Failed`.
> - **Warning** (yellow) — RESIDUAL: tables that have DQ tests AND are not Healthy AND are not Error. The typical case is a table whose latest-runs include `Skipped`, `Aborted`, or `Unknown` but no `Broken`/`Failed`.
>
> Tables without any DQ tests are NOT counted in any of the three slices — they appear only in the Monitored Tables ring's "Not Monitored" slice. Conditionally-skipped tests (e.g. a Great Expectations check that skips when a precondition is not met) classify their parent table as Warning, not Healthy — the platform treats `Skipped` as "did not pass", not as "did not apply". Adjust your test framework's status emission accordingly if you want skipped checks to keep the table Healthy.
>
> The classification is computed from the per-test latest-run denormalisation (per [Reading the dashboard](#reading-the-dashboard) — see DOC-GAP-297's caveat).

### Cross-references

- **DOC-GAP-266** (Table Health LABEL vocabulary drift — sibling on the SAME ring) — the same authoring pass closes both; this finding adds the classification rules after the vocabulary alignment
- **DOC-GAP-265** (Test Results Breakdown 3-vs-6 statuses) — sibling dashboard finding
- **DOC-GAP-297** (test_results per-test-vs-per-run) — sibling dashboard finding; the "Reading the dashboard" sub-section it adds explains the per-test denormalisation that underlies this classification too
- **DOC-GAP-293** (missing test-results.md page) — cross-link target for operators who need per-test history to investigate a Warning / Error classification
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` enumerates `TablesHealthDashboard` (the response schema) + `DataEntityRunStatus` (the GROUP BY axis) — both consistent with the CTE algebra. `feature-flows/F-022` is per-dataset SLA classification (different surface, different aggregation); the catalog-wide Table Health classification on the dashboard is THIS controller's responsibility. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The classification rules are doc-SILENT not doc-WRONG. Operator-impact is real (the SKIPPED-state surprise affects every deployment that uses conditionally-skipped tests; the empty-bucket confuses new deployments) but recoverable (the rules are stable across versions; once disclosed the operator can predict). The fix is one section in dashboard.md — bounded. Severity is MEDIUM not LOW because the dashboard is a load-bearing surface (every DQ operator visits it) and the SKIPPED-state surprise is genuine: operators using Great Expectations / dbt conditional tests will see WARNING counts they can't explain.

### Last verified

- 2026-05-26 — sidecar's WebFetch result (live page 200 with verbatim absence of Table Health rules) + the SQL CTE algebra at `ReactiveDataQualityRunsRepositoryImpl.java:111-157` re-confirmed at substrate commit `4ec2b20`.
