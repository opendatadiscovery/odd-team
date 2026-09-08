## 2026-09-08 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Opus 5 (1M context), session ctrib067 (CTRIB-067 Phase D, run-regression.sh under the machine-wide flock)
- odd-platform working-tree HEAD: 0238005c (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib067  (image odd-platform:odd-team-sut-ctrib067, digest sha256:a6c9700f1bfc535e7952568c8834f43a1bdf222d694a5a06760187881fbb9544)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed (7.2m), 0 failed** — green, no attribution needed.

