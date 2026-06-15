## 2026-06-16 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 2cb86c29 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 2cb86c29  (image odd-platform:odd-team-sut, digest sha256:7584966000bba5e177c428842d51bc558d5de08c757ca5cdc1a2ba15e8e9e3fd)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

