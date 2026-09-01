## 2026-09-01 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session review-ctrib062-2 — the /review confirmation run)
- odd-platform working-tree HEAD: 966d3053 in ../odd-platform-ctrib062 (the reviewed SHA; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, not the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib062  (image odd-platform:odd-team-sut-revctrib062, digest sha256:6acff772a415c4c19ae1f79565c7e9d417388d87cf8abe28718dcdacce5ec61f)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed (4.9m).** Green.

## 2026-09-01 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session ctrib062g — the Phase-G rework of the 2026-09-01 /review fix-list)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout — LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062g  (image odd-platform:odd-team-sut-ctrib062g, digest sha256:838ad9847f3d4ecb4321f52a204d23581f4c89716c8d1f40ab1f36871c399f57)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed (5.1m).** Green.

## 2026-09-01 — suite/protocol: ingestion-e2e
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source, passed via ODD_PLATFORM_DIR; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, NOT the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib0623  (image odd-platform:odd-team-sut-revctrib0623, digest sha256:82983e32b125d8752ee72a10539a8a397b538e7d2ae79a42489432fd54deb26a)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **/review CTRIB-062 third pass (review-ctrib062-3) — the reviewer's OWN confirmation run.** **15 passed / 0 failed (5.0m) -- GREEN.** The real source -> collector -> platform -> UI stands, including IT-128's relationships ingestion pipeline (ERD constraint row through to the UI list). Untouched by this slice and green, as expected.

