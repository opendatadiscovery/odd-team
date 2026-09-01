## 2026-09-01 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session review-ctrib062-2 — the /review confirmation run)
- odd-platform working-tree HEAD: 966d3053 in ../odd-platform-ctrib062 (the reviewed SHA; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, not the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib062  (image odd-platform:odd-team-sut-revctrib062, digest sha256:6acff772a415c4c19ae1f79565c7e9d417388d87cf8abe28718dcdacce5ec61f)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **RUN 1 -- 12 passed / 1 FAILED (12.3m).** The failure is `my-data-scope-narrows.spec.ts:259` (IT-153, CTRIB-062's own test): the R2 pass-through-regression case. It failed through the readiness gate CTRIB-062 added in its section 22b -- `READINESS: the seeded fixture "it153mydata_21530" never became searchable on the freshly-booted LOGIN_FORM stack within 90s`, `last observed page state: header="0 results" renderedRows=[]`. renderedRows EMPTY means the catalog served nothing at all for 90s, which per the helper's own diagnostic rules out the unified-index path; and V0_0_98 maintains asset_search_entrypoint with SYNCHRONOUS AFTER-triggers on search_entrypoint, so there is no background-job race either. Root cause is structural: three multi-stack specs share ONE compose project (helpers/loginform-stack.ts `PROJECT='oddlf'`, fixed port 18082) and helpers/stack.ts:40 composeDown is `down -v`, so IT-009 destroys the volume and IT-153 boots cold behind it, while composeUp only polls /actuator/health on that fixed port -- a probe that cannot distinguish "my new stack is up" from "the previous spec's stack has not died yet". Recorded as C0 in the /review verdict.

## 2026-09-01 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session review-ctrib062-2 — the /review confirmation run)
- odd-platform working-tree HEAD: 966d3053 in ../odd-platform-ctrib062 (the reviewed SHA; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, not the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib062  (image odd-platform:odd-team-sut-revctrib062, digest sha256:9d364352305a89f46eb76c3423924755f3dd93b55ef0b0e4e6d56e7df3a97d49)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **RUN 2 (deliberate re-run of the WHOLE suite) -- 13 passed (9.4m), GREEN, `:259` included.** Run because one disagreeing sample is a measurement, not a verdict. Tally across both sessions is n=3: GREEN (implementer, 2026-08-31) / RED (run 1 above) / GREEN (this run). So the section-22b fix is not broken -- the gate is INTERMITTENT (~1 whole-suite run in 3), and B2 was closed on n=1. NB this run's SUT digest differs from run 1's only because run-regression.sh rebuilt the image; both were built by build-sut.sh from ../odd-platform-ctrib062, clean at 966d3053.

## 2026-09-01 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session ctrib062g — the Phase-G rework of the 2026-09-01 /review fix-list)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout — LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062g  (image odd-platform:odd-team-sut-ctrib062g, digest sha256:838ad9847f3d4ecb4321f52a204d23581f4c89716c8d1f40ab1f36871c399f57)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **SAMPLE 1 of Phase G — 13 passed / 1 failed.** The failure is `my-data-scope-narrows.spec.ts:477`, the S7 locale arm added EARLIER IN THIS PHASE — my own defect, not the C0 intermittent and not a product bug. `:259` (the C0 case) PASSED. Cause: FixedOptionsMultiFilter renders its options inside an MUI Autocomplete that is closed by default, so the option labels asserted on were never in the DOM; DepthSelect likewise only renders once its scope is selected. scopeLabels is properly t()-wrapped and the heading translated at runtime, so there is no i18n defect here.

## 2026-09-01 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session ctrib062g — the Phase-G rework of the 2026-09-01 /review fix-list)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout — LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062g  (image odd-platform:odd-team-sut-ctrib062g, digest sha256:838ad9847f3d4ecb4321f52a204d23581f4c89716c8d1f40ab1f36871c399f57)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **SAMPLE 2 of Phase G — 13 passed / 1 failed, identical.** `:477` again, deterministically, which is what identified it as my test bug rather than a flake. `:259` PASSED again.

## 2026-09-01 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session ctrib062g — the Phase-G rework of the 2026-09-01 /review fix-list)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout — LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062g  (image odd-platform:odd-team-sut-ctrib062g, digest sha256:4ecdd6f7d143cd7c32a1ee70fd6eee504fd914b752b4e1c95d0b7edc704eff79)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **SAMPLE 3 of Phase G, after fixing :477 — 14 passed / 0 failed (9.4m).** The locale arm now selects both scopes in the URL so the labels render as chips (always in the DOM) and the depth label renders; green in 7.6s. `:259` PASSED a third time. Running C0 tally across three sessions and SIX whole-suite runs: green/red/green/green/green/green — ONE RED IN SIX, cause still unknown.

## 2026-09-01 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source, passed via ODD_PLATFORM_DIR; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, NOT the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib0623  (image odd-platform:odd-team-sut-revctrib0623, digest sha256:82983e32b125d8752ee72a10539a8a397b538e7d2ae79a42489432fd54deb26a)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **/review CTRIB-062 third pass (review-ctrib062-3) — the reviewer's OWN confirmation run.** **14 passed / 0 failed (10.8m) -- GREEN, whole suite, one process, in suite order.** All five IT-153 cases passed, including the C0 case (the R2 pass-through-regression test, formerly `:259`, now `:388` after Phase G's failure-time instrumentation grew the file) and `:477`, the S7 locale arm that failed twice during Phase G. **This is the SEVENTH whole-suite multi-stack sample of C0 across four sessions: green / red / green / green / green / green / GREEN -- one red in SEVEN**, an independent sample better than the 'once in six' PR #1871 discloses. The single red remains unexplained and TST-064 owns it; this run does not close it, it lowers the estimate again and adds a fourth consecutive pass of the case.

