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

## 2026-09-02 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session review-ctrib063 — the /review confirmation run that CLOSED the DoD gate implement declared OWED)
- odd-platform working-tree HEAD: the `969a5d5b` printed here is the SHARED ../odd-platform checkout, NOT this run's SUT source (LSN-033). The real subject is `c88bf405` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree); see the `e2e SUT` line.
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib063  (image odd-platform:odd-team-sut-revctrib063, digest sha256:94ebefae6cf7ea0736d6228e12821ce92ca61f257e1f5c8de47328b54de4fe24)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **17 passed / 0 failed (14.7m) — GREEN, whole suite, one process, in suite order.** This is the gate CTRIB-063's ledger declared OWED: the ctrib063 run was killed mid-`known-bugs` and `multi-stack` never ran, so IT-154 had only ever been executed on its own. 14 was the standing figure for the eight prior protocols across four sessions; **IT-154's three cases make 17**, so the new spec coexists with all eight other self-managed stacks — exactly what this suite still owed. All ten soft assertions inside `demo-stand-first-run.spec.ts:113` green, plus cases 7 and 8 (the stack-free injector cases). TST-064's `my-data-scope-narrows` flake did NOT fire on this sample (five IT-153 cases green, `:388` and `:477` among them).

