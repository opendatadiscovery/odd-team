## 2026-06-30 — suite/protocol: ingestion-e2e
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 2f9734e1 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib048  (image odd-platform:odd-team-sut-ctrib048, digest sha256:daa7d501e8f53e1d8c3729897f4b04a8a852d545f4e529d9f10055241345d908)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

