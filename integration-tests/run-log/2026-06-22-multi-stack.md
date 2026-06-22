## 2026-06-22 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 0df69b9d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut  (image odd-platform:odd-team-sut, digest sha256:65c9b3ad91195517ca51974abd97262c17175e4e7bdf4c266224dcc6352bc0a5)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

