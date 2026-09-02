## 2026-09-03 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session review-ctrib063 round 2 — the /implement rework that closed the /review fix-list; the NEXT /review must be a fresh session)
- odd-platform working-tree HEAD: the SUT source is `9c1360df` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree) — build-sut.sh reports `built from source: the odd-platform WORKING TREE @ 9c1360df`. Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib063r2  (image odd-platform:odd-team-sut-ctrib063r2, digest sha256:4f6feeeea94817ce04696a4f0acac07e6bc6cd5423ce6b997514cfc34b7e5b0c)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **18 passed / 0 failed (15.9m) — GREEN, whole suite, one process, in suite order.** 17 was the figure this reviewer measured on 2026-09-02 for the same nine protocols; the eighteenth is **IT-154's new assertion 9**, the injection-failure-reporting case added in this rework — so the tightened case (a scoped `HTTP 400` matcher and summary-relative assertions, rather than a bare `400` against the whole output) is validated here in suite context, not only in the targeted run that authored it. All eleven of IT-154's assertions green. TST-064's `my-data-scope-narrows` flake did not fire on this sample.

