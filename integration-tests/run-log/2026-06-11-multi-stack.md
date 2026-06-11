## 2026-06-11 — suite/protocol: multi-stack
- runner: AI-assisted Claude (Fable 5) — CTRIB-004 /review full-set regression measurement (2026-06-11 directive)
- odd-platform working-tree HEAD: 93cb5252 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 93cb5252  (image odd-platform:odd-team-sut, digest sha256:a61afa7ec21641927b4a128aa6f372a580cc7fa0f476bbf22f274ffeebd6ce7b)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 9 passed (3.4m) — MinIO REMOTE attachment round-trip, LOGIN_FORM auth boundary + session-cookie posture, LDAP RBAC enforcement + policy lifecycle, notifications WAL lifecycle + failover. Full multi-stack lane GREEN on the #1764 fix SUT (93cb5252).

