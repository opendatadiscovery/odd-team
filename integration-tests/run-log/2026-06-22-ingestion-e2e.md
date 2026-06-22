## 2026-06-22 — suite/protocol: ingestion-e2e
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 0df69b9d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut  (image odd-platform:odd-team-sut, digest sha256:65c9b3ad91195517ca51974abd97262c17175e4e7bdf4c266224dcc6352bc0a5)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

