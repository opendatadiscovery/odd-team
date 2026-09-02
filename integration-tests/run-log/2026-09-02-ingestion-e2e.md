## 2026-09-02 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Opus 5 (ctrib061 stream, CTRIB-061 / #1841 ST-7)
- odd-platform working-tree HEAD: **3d5a7096** in `../odd-platform-ctrib061` (the SUT source). The `b5d9f150` the
  harness prints is the SHARED `../odd-platform` checkout, NOT the SUT -- LSN-033
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib061  (image odd-platform:odd-team-sut-ctrib061, digest sha256:2465c623722f3b7323e5bc50b7cdfe53b21979a84f664320ce5230f47be8a0a2)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: api:FAIL (TST-058) e2e:**15 passed / 0 failed** (5.9m)
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: Fully green. The ingestion-grade stands are unaffected by this slice.

## 2026-09-02 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session review-ctrib063 — the /review confirmation run that CLOSED the DoD gate implement declared OWED)
- odd-platform working-tree HEAD: the `969a5d5b` printed here is the SHARED ../odd-platform checkout, NOT this run's SUT source (LSN-033). The real subject is `c88bf405` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree); see the `e2e SUT` line.
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib063  (image odd-platform:odd-team-sut-revctrib063, digest sha256:94ebefae6cf7ea0736d6228e12821ce92ca61f257e1f5c8de47328b54de4fe24)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed (6.2m) — GREEN**, matching the standing 15/0 baseline. IT-145 dataset-pipeline lifecycle 9/9 (tables+view, ODD types from `pg_type.typname`, COMMENTs as descriptions, rows/fields counts, view→table upstream lineage, the UI render, the add-column/edit-comment/add-table/add-row delta and its UI re-render, and the source-deletion no-reconcile characterization) · IT-128 relationships pipeline 6/6 (5 neo4j edge types with direction preserved, `is_directed` + UNKNOWN-typed property attributes, both postgres FK constraints child→parent with derived cardinality + `is_identifying`, and the GRAPH row rendering Person→Company through the pipeline). Completes the second of the two suites CTRIB-063's ledger declared NEVER RUN. Nothing in this branch reaches ingestion — the diff is a compose file, a demo injector, one sample JSON and two READMEs — so "unaffected" was the expected result and it is what was measured, against a SUT I built myself from `c88bf405`.

