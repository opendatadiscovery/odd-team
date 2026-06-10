## 2026-06-10 — suite/protocol: known-bugs
- runner: human (maintainer, local shell)
- odd-platform working-tree HEAD: 2cf9dc24 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 2cf9dc24  (image odd-platform:odd-team-sut, digest sha256:65a02033e7eb293810308b6e9ca65a5f7606309aeeb9dbdf82355e53a9b8a8a7)
- protocols: IT-002 IT-003 IT-004 IT-005 IT-006 IT-007
- api probes: none; ui e2e: specs/view-count-overview.spec.ts specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/top-tags-ordering.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

