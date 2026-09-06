## 2026-09-06 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude, session ctrib066 — the remaining three suites of the four-suite regression, reusing the cdaa7d45 image (build bypassed) under the heavy-e2e flock: `ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-ctrib066 run-suite.sh <suite>`)
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib066  (image odd-platform:odd-team-sut-ctrib066, digest sha256:b3701f317143451e71ebd933ec3faf78e661a482572e3477d3b6cca8b003fcf9)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 / 15 PASS (6.0m)** — the ingestion-grade stands (source-system -> odd-collector -> platform -> UI) all green. ST-9 does not touch ingestion; zero regressions.

## 2026-09-06 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session review-ctrib066 — the REVIEWER's own four-suite regression)
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib066  (image odd-platform:odd-team-sut-revctrib066, digest sha256:61132a929fb7e6f160e470a80927944879280029039bdc475550d4195404f61f)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 / 15 PASS (6.4m)** — the ingestion-grade stands (source system -> odd-collector -> platform -> UI) all green, incl. IT-128 relationships + IT-145 dataset pipeline. ST-9 does not touch ingestion.

