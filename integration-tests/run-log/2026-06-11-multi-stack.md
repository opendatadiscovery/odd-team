## 2026-06-11 — suite/protocol: multi-stack
- runner: AI-assisted Claude (Fable 5) — CTRIB-004 /review full-set regression measurement (2026-06-11 directive)
- odd-platform working-tree HEAD: 93cb5252 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 93cb5252  (image odd-platform:odd-team-sut, digest sha256:a61afa7ec21641927b4a128aa6f372a580cc7fa0f476bbf22f274ffeebd6ce7b)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 9 passed (3.4m) — MinIO REMOTE attachment round-trip, LOGIN_FORM auth boundary + session-cookie posture, LDAP RBAC enforcement + policy lifecycle, notifications WAL lifecycle + failover. Full multi-stack lane GREEN on the #1764 fix SUT (93cb5252).

## 2026-06-11 — suite/protocol: multi-stack
- runner: AI-assisted Claude Fable 5 (CTRIB-005 /contribute run)
- odd-platform working-tree HEAD: 074c9927 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 074c9927  (image odd-platform:odd-team-sut, digest sha256:b42b763edd58fd9e4bdcf5f6dcb875fda99f7932606de268dbf6d878c44f988b)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: CTRIB-005 full-regression: 9/9 GREEN (3.3m) — MinIO attachment, LOGIN_FORM x2 (incl. session-cookie posture), LDAP x2, notifications WAL x2, multi-stack auth flows; no interaction with the #1760 advice/route/UI changes.

## 2026-06-11 — suite/protocol: multi-stack
- runner: AI-assisted Claude Fable 5 (CTRIB-005 /contribute run)
- odd-platform working-tree HEAD: 5cbf60a3 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 5cbf60a3  (image odd-platform:odd-team-sut, digest sha256:66e54645cb50aa5ea14db29c420f5da12ed34e40d51942d92bbada85945ee0ab)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: CTRIB-005 correction run (the 5 multi-stack compose files also lost the exposure override): 9/9 GREEN (3.6m) — the removal is behaviour-neutral for these specs (only actuator exposure widened to the shipped default).

