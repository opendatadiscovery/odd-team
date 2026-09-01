## 2026-09-01 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session review-ctrib062-2 — the /review confirmation run)
- odd-platform working-tree HEAD: 966d3053 in ../odd-platform-ctrib062 (the reviewed SHA; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, not the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib062  (image odd-platform:odd-team-sut-revctrib062, digest sha256:6acff772a415c4c19ae1f79565c7e9d417388d87cf8abe28718dcdacce5ec61f)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed (4.9m).** Green.

