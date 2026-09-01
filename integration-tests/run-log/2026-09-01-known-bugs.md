## 2026-09-01 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session review-ctrib062-2 — the /review confirmation run)
- odd-platform working-tree HEAD: 966d3053 in ../odd-platform-ctrib062 (the reviewed SHA; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout, not the SUT source -- LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib062  (image odd-platform:odd-team-sut-revctrib062, digest sha256:6acff772a415c4c19ae1f79565c7e9d417388d87cf8abe28718dcdacce5ec61f)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed -- EXPECTED; RED is this suite's pass condition.** IT-004 quality-dashboard-unknown-status:33, IT-006 error-boundary-containment:29, IT-007 attachment-local-durability:35. ZERO unexpected GREENs, so no un-flipped fix is hiding here.

## 2026-09-01 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session ctrib062g — the Phase-G rework of the 2026-09-01 /review fix-list)
- odd-platform working-tree HEAD: 5b20c3da in ../odd-platform-ctrib062 (the SUT source; the `c54b9c61` the harness prints is the SHARED ../odd-platform checkout — LSN-033)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062g  (image odd-platform:odd-team-sut-ctrib062g, digest sha256:838ad9847f3d4ecb4321f52a204d23581f4c89716c8d1f40ab1f36871c399f57)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed — EXPECTED; RED is this suite's pass condition.** IT-004, IT-006, IT-007. Zero unexpected GREENs, so no un-flipped fix is hiding here.

