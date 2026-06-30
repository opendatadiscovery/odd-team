## 2026-06-30 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 2f9734e1 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib048  (image odd-platform:odd-team-sut-ctrib048, digest sha256:daa7d501e8f53e1d8c3729897f4b04a8a852d545f4e529d9f10055241345d908)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

