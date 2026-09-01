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

