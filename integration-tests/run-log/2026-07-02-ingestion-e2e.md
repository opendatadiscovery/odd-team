## 2026-07-02 — suite/protocol: ingestion-e2e
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: f63d3915 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib049  (image odd-platform:odd-team-sut-ctrib049, digest sha256:3948e2ace88fc5f9a69ba1d466c8a9cb1e641b79a7b6d6a2d88a5ccce5ae6d3a)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

