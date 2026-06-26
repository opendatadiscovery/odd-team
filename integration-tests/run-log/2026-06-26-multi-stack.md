## 2026-06-26 — suite/protocol: multi-stack
- runner: AI-assisted Claude Opus 4.8 — release-review (session review-release-029); ODD_SUT=published:0.29.0 (ghcr.io/opendatadiscovery/odd-platform:0.29.0 digest a2e0c86d)
- odd-platform working-tree HEAD: f12b8fbc (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-rel029  (image odd-platform:odd-team-sut-rel029, digest sha256:a2e0c86d488b8a5f287910b5d26dc2bcf30d61082fe87e75d5fa7824e916b3b5)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **9 passed / 9**. GREEN (MinIO / LOGIN_FORM / LDAP / notifications own-stack specs).

