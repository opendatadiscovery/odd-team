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

