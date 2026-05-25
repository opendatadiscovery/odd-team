---
doc_gap_id: DOC-GAP-297
severity: HIGH
category: drift
batch: ZG
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"   # Quality Dashboard — the only consumer of this endpoint
related_features:
  - F-022          # per-dataset Test Reports — sibling read surface (different aggregation; not the same drift but cross-link relevant)
related_doc_gaps:
  - DOC-GAP-265    # sibling 3-vs-6-status finding (vocabulary; the test_results enum); same dashboard
  - DOC-GAP-264    # sibling Title-LSN-020 (filter binding); same dashboard
  - DOC-GAP-272    # sibling Namespace widening (filter binding); same dashboard
  - DOC-GAP-271    # sibling spec-underdescription (10 params); same endpoint
related_retrospectives:
  - LSN-019        # transcription-drift class (UI label vs implementation semantic) — closely related; this is the per-test-vs-per-run binding drift on the dashboard
---

## DOC-GAP-297 — Quality Dashboard `test_results` counts TESTS keyed on latest-run-status, NOT RUNS — directly contradicting the live `/features/data-quality/dashboard` page's verbatim "the count of test runs broken down by status (passed / failed / skipped)" definition; the SQL joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`), a denormalised table whose `task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`) — exactly one row per test; a test that ran 100 times (99 SUCCESS, 1 most-recent FAILED) contributes 1 to FAILED bucket; the dashboard cannot distinguish "one transient failure on a stable test" from "a test that fails every run"; the OpenAPI operation summary "Get Data Quality tests runs" (`openapi.yaml:1975-1976`), the UI chart label "Test Results Breakdown" (`DataQualityContent.tsx:110`), and the live doc all describe a per-run count; the platform delivers a per-test count keyed on the latest run — this is the LSN-019 class transcription drift instantiated on the dashboard endpoint, the SAME class as the per-test runs-history UI labels its ROW count by start_time but the SQL orders by end_time (DOC-GAP-294 sibling); the implicit ADR (denormalised last-run table) is INTENTIONAL but its semantic divergence from the doc is silent and load-bearing for operator triage

**Severity**: HIGH
**Category**: drift (doc-verbatim-vs-code semantic drift; the doc states "count of test runs", the code returns "count of tests by latest-run status")

### Surfaced by

- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:docs_link_semantic.doc_drift_findings.[0]` (HIGH per sidecar) — verbatim: *"DOC DRIFT — `test_results` counts TESTS, not RUNS, contrary to the dashboard doc's verbatim definition. The live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` page (WebFetched 2026-05-25 status 200) defines Test Results Breakdown as 'the count of test runs broken down by status (passed / failed / skipped)' — implying every historical run contributes to the count. The implementation joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`), whose `task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`) — exactly one row per test. A test that ran 100 times (90 SUCCESS, 10 FAILED, latest=FAILED) contributes ONE row to the FAILED bucket, not 90/10. The dashboard doc says 'count of test runs'; the code computes 'count of tests by their latest-run status'. The operator-visible consequence: a test that flapped many times but recently succeeded shows as one SUCCESS, with the failure history invisible; a test that succeeded for years and just started failing shows as one FAILED, eclipsing the success history. This is the LSN-019 class (`listMostPopular` → not popularity-ordered) instantiated on the dashboard endpoint. Severity: HIGH — the dashboard caption 'Test Results Breakdown' and the live doc both describe a per-run count; the platform delivers a per-test count keyed on the latest run."*
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar — full trace from operation summary → UI label → live doc → SQL → PK constraint)
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:stress_findings.name_behavior_pairs[getDataQualityTestsRuns]` — `DRIFT_NAME_VS_BEHAVIOR`; operator-visible consequence: *"A developer reading the OpenAPI spec or the URL pattern who expects to GET a paginated list of test-run instances (matching the per-entity DataEntityRunController shape at `/api/dataentities/{id}/runs`) receives instead a fixed-shape aggregate."*
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:stress_findings.name_behavior_pairs[getLatestDataQualityRunsResults]` — second confirmation: *"The name 'LatestDataQualityRunsResults' and the OpenAPI field 'test_results' (combined with the dashboard doc's 'count of test runs broken down by status') promise count of test-run-instances grouped by category and status."* — DRIFT_NAME_VS_BEHAVIOR
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:tests_coverage_semantic.uncovered_behaviours[Latest-run vs all-runs semantics]` (HIGH per sidecar) — *"a test that has run 100 times (90 SUCCESS, 10 FAILED, latest=FAILED) contributes ONE count to FAILED bucket, not 90/10 split — the load-bearing invariant has no test pinning it"*
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[0]` — the intentional denormalisation: *"The dashboard reads a denormalised 'latest run per test' table rather than aggregating over the full task-run history at query time. The decision IS the semantic — it changes the dashboard's meaning from 'count of test runs by status' to 'count of tests by their latest-run-status'."*
- `concepts.yaml:entities[DATA_ENTITY_TASK_LAST_RUN]` (the PK-per-task denormalisation; the substrate-side primary source) + `entities[DataEntityRunStatus]` (the 6-value enum used as the GROUP BY second axis)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (verbatim from sidecar): *"Test Results Breakdown — the count of test runs broken down by status (passed / failed / skipped)."* — the doc's verbatim definition is "count of TEST RUNS".
- `odd-platform/odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:76, 95` (verbatim per sidecar) — the SQL JOIN to `DATA_ENTITY_TASK_LAST_RUN`; the GROUP BY + COUNT key off the joined row (one row per test).
- `odd-platform/odd-platform-api/src/main/resources/db/migration/V0_0_45__last_runs_table.sql:9` (verbatim per sidecar) — `task_oddrn varchar PRIMARY KEY` — the schema constraint that guarantees one row per test.
- `odd-platform/odd-platform-api/src/main/resources/db/migration/V0_0_45__last_runs_table.sql:15-21` (the back-fill INSERT) — `DISTINCT ON (tr.task_oddrn) tr.task_oddrn AS task_oddrn, tr.oddrn AS last_task_run_oddrn, tr.end_time AS end_time, tr.status AS status FROM data_entity_task_run tr ORDER BY tr.task_oddrn, tr.end_time DESC ... ON CONFLICT DO UPDATE` — the back-fill that establishes the "one row per test, keyed on most-recent end_time" invariant.
- `odd-platform/odd-platform-specification/openapi.yaml:1975-1976` (per sidecar) — operation summary: *"Get Data Quality tests runs"* — implies retrieval of run instances; the operationId `getDataQualityTestsRuns` reinforces the implication. The response shape (per `components.yaml:3748-3825`) is an aggregate envelope with NO run-level data.
- `odd-platform/odd-platform-ui/src/components/.../DataQualityContent.tsx:110` (per sidecar) — UI title chart label: *"Test Results Breakdown"* — same per-run language as the doc.
- **The operator-impact narrative**: a data-quality engineer sees the dashboard show "5 FAILED tests" and clicks into the affected category to triage. They expect "5 failed test runs across the catalog" — meaning 5 incidents that need investigation. The platform's actual semantic: 5 tests whose MOST RECENT run was FAILED. If those 5 tests have been failing for hours / days / weeks (steady-state failure), the dashboard shows the same "5 FAILED" indefinitely; if those 5 tests flapped just once and the next run succeeds, the dashboard drops to "0 FAILED". The engineer's triage queue is anchored on test count, not incident count; they cannot tell if a test is "still failing" or "failed once and recovered" from the dashboard alone. The doc's promise (count of test runs) would let them gauge incident volume; the implementation gives them test count.
- **The intent narrative** (from sidecar `implicit_adrs.[0]`): the denormalisation is a deliberate scalability trade-off — recomputing "latest run per test" over `DATA_ENTITY_TASK_RUN` (which grows with ingestion volume) at every dashboard load would scale poorly; the `DATA_ENTITY_TASK_LAST_RUN` table is maintained out-of-band by the ingestion path and the dashboard reads it. The trade-off is correct; the semantic divergence is what needs disclosure.

### Drift narrative

The Quality Dashboard is the operator's one-stop view for catalog-wide DQ health. The "Test Results Breakdown" ring is the load-bearing first-pass visualisation: an operator glances at it to know "is there a problem". The doc tells them "this is the count of test runs broken down by status" — a per-incident framing. The implementation gives them "the count of tests whose latest run has each status" — a per-test framing keyed on the most-recent run.

The two framings diverge for any test with history > 1 run:
- **Test with 100 runs, 99 SUCCESS, 1 FAILED most recent** → per-run framing: 99 SUCCESS + 1 FAILED in the breakdown; per-test framing: 1 FAILED. The doc's framing would tell the operator "this test is mostly healthy with one recent incident"; the implementation's framing tells them "this test is currently failing".
- **Test with 100 runs, 1 SUCCESS, 99 FAILED most recent SUCCESS** → per-run framing: 1 SUCCESS + 99 FAILED; per-test framing: 1 SUCCESS. The doc would alert; the implementation reassures.
- **Test with 100 runs, 50 SUCCESS / 50 FAILED, latest SUCCESS** → per-run framing: 50/50 split; per-test framing: 1 SUCCESS, flapping invisible.

The semantic divergence is most material for FLAPPING tests (tests that succeed and fail unpredictably) — the per-run framing surfaces flapping as a balanced distribution; the per-test framing collapses to whichever the most-recent run was. The dashboard's diagnostic value depends entirely on which semantic the operator carries.

The implicit ADR (denormalisation for scalability) is correct: a per-run aggregation over `DATA_ENTITY_TASK_RUN` would not scale to millions of runs. The fix is not to change the implementation; the fix is to align the doc and the UI label with the implementation's semantic. Two options:
1. **Rename the doc + UI vocabulary** to "Tests by Latest-Run Status" — accurate, less catchy.
2. **Keep the "Test Results Breakdown" label** but add an explicit caveat: "Each test contributes one entry per its most-recent run; flapping tests show as their latest status, not as a per-run histogram."

The maintainer chooses; the doc-side disclosure is bounded either way.

### Proposed doc action

**Two-part action — fix the dashboard doc's verbatim definition + add a "Reading the dashboard" caveat**.

1. **Doc-side PRIMARY — `documentation/docs/features/data-quality/dashboard.md`** — replace the current verbatim "the count of test runs broken down by status" with:

   > **Test Results Breakdown** — the count of TESTS in the catalog broken down by the status of each test's most-recent run. Each test contributes exactly one entry — its most-recent run's status — so flapping tests (tests that have failed and recovered repeatedly) show as their CURRENT status (e.g. a test with 99 historical SUCCESS runs and a single most-recent FAILED run contributes 1 to the FAILED bucket, not 99/1 to the SUCCESS/FAILED split). To inspect the per-test execution history including flapping signals, navigate to the test's `/history` tab (see [Test Results](/features/data-quality/test-results)).

   The cross-link to the proposed test-results.md page (per DOC-GAP-293) lets operators dig into the per-run history when the per-test summary is insufficient.

2. **Doc-side COMPANION — "Reading the dashboard" sub-section in dashboard.md** — add a small sub-section explaining the per-test semantic + the implicit denormalisation:

   > **Reading the dashboard.** The dashboard is a denormalised aggregate: counts are derived from the per-test latest-run table, not from the full task-run history. This makes the page fast at any catalog size but means flapping tests collapse to their most-recent state. To investigate incident volume over a time window, query the `/api/dataentities/{id}/runs` endpoint directly (see [Test Results](/features/data-quality/test-results)).

### Cross-references

- **DOC-GAP-265** (Test Results Breakdown 3-vs-6 statuses) — sibling vocabulary finding on the SAME ring on the SAME page; the same authoring pass closes both
- **DOC-GAP-264** (Title filter LSN-020) — sibling dashboard finding; same page; same authoring pass
- **DOC-GAP-272** (Namespace filter widening) — sibling dashboard finding; same page
- **DOC-GAP-271** (spec under-description for 10 params) — sibling endpoint finding; cross-reference
- **DOC-GAP-266** (Table Health label vocabulary drift) — sibling dashboard finding on a DIFFERENT ring on the same page
- **DOC-GAP-293** (missing test-results.md page) — the doc home for the per-run history that the per-test semantic motivates
- **LSN-019** — transcription-drift class (`listMostPopular` returns not-popularity-ordered) — this is the same class on the dashboard surface: a user-facing label ("test runs") that does not match the SQL semantic ("tests by latest-run status")
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` enumerates `DATA_ENTITY_TASK_LAST_RUN` (the denormalised table, primary source for the semantic) and `DataQualityResults` (the response envelope) — both consistent with the per-test-by-latest-status framing. `feature-flows/F-022` references the per-dataset DQ surface, not the catalog-wide dashboard; no contradictions. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

HIGH. The Test Results Breakdown is the FIRST visualisation an operator looks at on the dashboard; the operator's mental model is anchored on the doc's verbatim definition. The semantic divergence between "count of test runs" (doc) and "count of tests by latest-run-status" (code) directly affects triage workflow: an operator chasing "5 FAILED" expects 5 incidents to investigate; the implementation shows them 5 tests in failing state, which may be 5 distinct incidents or 5 ongoing failures or any mix. The fix is one paragraph rewrite + one cross-link — bounded. The severity is HIGH (not MEDIUM) because the doc-verbatim contradiction is direct and the affected metric is the dashboard's flagship indicator. Compared with DOC-GAP-265 (the 3-vs-6 status count drift on the same ring) at MEDIUM, this is the per-incident-vs-per-test semantic drift at HIGH — operator-decision impact, not just vocabulary alignment.

### Last verified

- 2026-05-25 — sidecar's WebFetch result (live page 200 with verbatim "count of test runs") + the SQL JOIN to `DATA_ENTITY_TASK_LAST_RUN` + the PK constraint at `V0_0_45__last_runs_table.sql:9` re-confirmed at substrate commit `4ec2b20`.
