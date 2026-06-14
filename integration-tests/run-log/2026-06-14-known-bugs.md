## 2026-06-14 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: a96745ef (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ a96745ef  (image odd-platform:odd-team-sut, digest sha256:f9725e589b82e19488e5884b403477fb873ab84cdb22522da08cc2fa06513997)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

