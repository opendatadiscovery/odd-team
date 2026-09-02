## 2026-09-02 — suite/protocol: known-bugs
- runner: AI-assisted Claude Opus 5 (ctrib061 stream, CTRIB-061 / #1841 ST-7)
- odd-platform working-tree HEAD: **3d5a7096** in `../odd-platform-ctrib061` (the SUT source). The `b5d9f150` the
  harness prints is the SHARED `../odd-platform` checkout, NOT the SUT -- LSN-033
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib061  (image odd-platform:odd-team-sut-ctrib061, digest sha256:2465c623722f3b7323e5bc50b7cdfe53b21979a84f664320ce5230f47be8a0a2)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: api:FAIL (TST-058) e2e:**3 failed / 0 passed -- EXPECTED RED**
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: The intended quarantine RED, all three still red and **no unexpected GREEN** (an unexpected green would
  mean a fix landed un-flipped and would trigger the tests-pillar flip-on-fix checklist): IT-004
  `attachment-local-durability:35`, IT-006 `error-boundary-containment:29`, IT-007
  `quality-dashboard-unknown-status:33`. Unchanged by this branch.

