## 2026-06-22 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 0df69b9d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut  (image odd-platform:odd-team-sut, digest sha256:65c9b3ad91195517ca51974abd97262c17175e4e7bdf4c266224dcc6352bc0a5)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

