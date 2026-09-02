## 2026-09-03 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session review-ctrib063 round 2 — the /implement rework that closed the /review fix-list; the NEXT /review must be a fresh session)
- odd-platform working-tree HEAD: the SUT source is `9c1360df` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree) — build-sut.sh reports `built from source: the odd-platform WORKING TREE @ 9c1360df`. Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib063r2  (image odd-platform:odd-team-sut-ctrib063r2, digest sha256:4f6feeeea94817ce04696a4f0acac07e6bc6cd5423ce6b997514cfc34b7e5b0c)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed — the expected-RED set, all three attributed, ZERO unexpected GREEN.** IT-007 `attachment-local-durability:35` (LOCAL-storage loss on container recreate, LSN-001/PLT-086) · IT-006 `error-boundary-containment:29` (no ErrorBoundary anywhere in odd-platform-ui, TEST-GAP-1013/F-042) · IT-004 `quality-dashboard-unknown-status:33` (out-of-enum run status throws before the `??` fallback, PLT-052 Defect 1). No pin flipped to green, so there is no un-flipped fix to chase.

