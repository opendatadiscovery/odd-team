## 2026-07-01 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: f63d3915 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib049  (image odd-platform:odd-team-sut-ctrib049, digest sha256:7e1fb61859d752eb36a81163c6b6b756126ce2954d83f17b4f0f7bd4f059afff)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

