## 2026-06-12 — suite/protocol: multi-stack
- runner: AI-assisted Claude (Fable 5) — CTRIB-006 /contribute implement session (full-regression gate)
- odd-platform working-tree HEAD: abe51417 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ abe51417  (image odd-platform:odd-team-sut, digest sha256:5f639f4eab90adba675c9b0524b2cbc3b65c1440c4c8649939a5140bde1843dc)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: full-regression gate suite 2/3 for the #1752 fix (CTRIB-006), SUT = working tree @ abe51417: **9 passed / 0 failed (3.5m)** — MinIO remote-attachment round-trip, auth-mode boundary, LDAP RBAC, WAL notifications lifecycle/failover, LOGIN_FORM session pair. No regressions from the relationships changes on any alternate-stack posture.

