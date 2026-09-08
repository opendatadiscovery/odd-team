## 2026-09-08 — suite/protocol: known-bugs
- runner: AI-assisted Claude Opus 5 (1M context), session ctrib067 (CTRIB-067 Phase D, run-regression.sh under the machine-wide flock)
- odd-platform working-tree HEAD: 0238005c (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib067  (image odd-platform:odd-team-sut-ctrib067, digest sha256:a6c9700f1bfc535e7952568c8834f43a1bdf222d694a5a06760187881fbb9544)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed** — EXPECTED RED, the lane working as designed: `attachment-local-durability:35`, `error-boundary-containment:29`, `quality-dashboard-unknown-status:33`. An unexpected GREEN here would be the signal (a fix landed un-flipped); three reds is the pin holding.

