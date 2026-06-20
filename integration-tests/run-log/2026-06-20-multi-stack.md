## 2026-06-20 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 657b12cf (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 657b12cf  (image odd-platform:odd-team-sut, digest sha256:a1bb08c715c7b5019847b9418ce97fc2a23ea84cf04c9a4bcffe7294f4afe048)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

