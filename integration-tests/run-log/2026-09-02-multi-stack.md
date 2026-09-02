## 2026-09-02 — suite/protocol: multi-stack
- runner: AI-assisted Claude Opus 5 (ctrib061 stream, CTRIB-061 / #1841 ST-7)
- odd-platform working-tree HEAD: **3d5a7096** in `../odd-platform-ctrib061` (the SUT source). The `b5d9f150` the
  harness prints is the SHARED `../odd-platform` checkout, NOT the SUT -- LSN-033
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib061  (image odd-platform:odd-team-sut-ctrib061, digest sha256:2465c623722f3b7323e5bc50b7cdfe53b21979a84f664320ce5230f47be8a0a2)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: api:FAIL (TST-058) e2e:**14 passed / 0 failed** (11.4m)
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: Fully green. No regression from the favorites predicate or the `/favorites` route retirement.

