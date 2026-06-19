## 2026-06-19 — suite/protocol: ingestion-e2e
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 24c55d31 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 24c55d31+uncommitted  (image odd-platform:odd-team-sut, digest sha256:8639ab14cf4b3515414f545a475787dea08cda0c5498381dd9766aaae0aee6b9)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

