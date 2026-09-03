## 2026-09-03 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session review-ctrib063 round 2 — the /implement rework that closed the /review fix-list; the NEXT /review must be a fresh session)
- odd-platform working-tree HEAD: the SUT source is `9c1360df` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree) — build-sut.sh reports `built from source: the odd-platform WORKING TREE @ 9c1360df`. Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib063r2  (image odd-platform:odd-team-sut-ctrib063r2, digest sha256:4f6feeeea94817ce04696a4f0acac07e6bc6cd5423ce6b997514cfc34b7e5b0c)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed (5.9m) — GREEN**, matching the standing 15/0 baseline. IT-145 dataset-pipeline lifecycle 9/9 and IT-128 relationships pipeline 6/6, both real source-system → real collector → platform → UI. Nothing in this branch reaches ingestion, so `unaffected` was the expected result and it is what was measured, against a SUT built by this run from the committed `9c1360df`.

## 2026-09-03 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session review-ctrib063r2 — the FRESH `/review` of the round-2 rework; SUT built by THIS session, not carried from implement)
- odd-platform working-tree HEAD: the SUT source is `9c1360df` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree; `git status --porcelain` empty). `run-regression.sh revctrib063r2` with ODD_PLATFORM_DIR pointed at that worktree built image `odd-platform:odd-team-sut-revctrib063r2` (digest `sha256:57e9c69f9a5eb67f679b42b501b6f69a80c224d6da926ee5198828ae14f36644`) from it. Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib063r2  (image odd-platform:odd-team-sut-revctrib063r2, digest sha256:57e9c69f9a5eb67f679b42b501b6f69a80c224d6da926ee5198828ae14f36644)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed (5.7m) — GREEN**, matching the standing 15/0 baseline. IT-145 dataset-pipeline lifecycle and IT-128 relationships pipeline, both real source-system -> real collector -> platform -> UI. Nothing in this branch reaches ingestion, so `unaffected` was the expected result and it is what was measured on a SUT this session built from `9c1360df`.

