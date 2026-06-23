## 2026-06-23 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib031  (image odd-platform:odd-team-sut-ctrib031, digest sha256:56f54a0562c98e760888d53d1eeb4acbf6d4a751f0d5ba89ff1a4de9d5c2d432)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

