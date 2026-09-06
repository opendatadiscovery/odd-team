## 2026-09-06 — suite/protocol: multi-stack
- runner: AI-assisted (Claude, session ctrib066 — the remaining three suites of the four-suite regression, reusing the cdaa7d45 image (build bypassed) under the heavy-e2e flock: `ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-ctrib066 run-suite.sh <suite>`)
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib066  (image odd-platform:odd-team-sut-ctrib066, digest sha256:b3701f317143451e71ebd933ec3faf78e661a482572e3477d3b6cca8b003fcf9)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **19 / 19 PASS (18.7m)** — every docker-churning multi-stack spec green (MinIO object storage, LOGIN_FORM / OAUTH2 / LDAP auth postures, notifications/WAL). ST-9 is a search-surface change and touched none of these; zero regressions in the multi-stack suite.

