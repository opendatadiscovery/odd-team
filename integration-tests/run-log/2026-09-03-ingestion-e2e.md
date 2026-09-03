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

## 2026-09-03 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Fable 5.1, session review-ctrib063r2 — the /implement rework closing the round-2 /review fix-list, run as stream ctrib063r3; the NEXT /review must be a fresh session)
- odd-platform working-tree HEAD: the SUT source is `6557b4b9` in ../odd-platform-ctrib063 (clean tree; README-only on top of `9c1360df`). Image `odd-platform:odd-team-sut-ctrib063r3` built from it by `run-regression.sh ctrib063r3` (digest `sha256:17f57b3ca92ab59d26df19b09048e536e7697f5a66cf54337ef01dc85c26c053`). Any bare SHA the harness prints is the SHARED ../odd-platform checkout (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib063r3  (image odd-platform:odd-team-sut-ctrib063r3, digest sha256:17f57b3ca92ab59d26df19b09048e536e7697f5a66cf54337ef01dc85c26c053)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed (5.8m) — GREEN** at `6557b4b9`, matching the standing 15/0 baseline: IT-145 dataset-pipeline lifecycle and IT-128 relationships pipeline, real source-system -> real collector -> platform -> UI. Nothing in this branch reaches ingestion; `unaffected` was expected and is what was measured.

## 2026-09-03 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5 (1M context), session review-ctrib063r3 — the THIRD, FRESH `/review` of the round-3 rework; SUT built by THIS session, not carried from implement)
- odd-platform working-tree HEAD: the SUT source is `6557b4b9` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree; `git status --porcelain` empty). `run-regression.sh revctrib063r3` with ODD_PLATFORM_DIR pointed at that worktree built image `odd-platform:odd-team-sut-revctrib063r3` (digest `sha256:ba585161422b7ee95b6a0f9e6621cebb39cca7bcf4908e9791356444b38be5d5`) from it — build-sut reported `built from source: the odd-platform WORKING TREE @ 6557b4b9`. Any bare SHA the harness printed is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib063r3  (image odd-platform:odd-team-sut-revctrib063r3, digest sha256:ba585161422b7ee95b6a0f9e6621cebb39cca7bcf4908e9791356444b38be5d5)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed (5.7m) — GREEN**, matching the standing baseline, on the reviewer's own SUT `sha256:ba585161` built from `6557b4b9`. IT-128 relationships ingestion + IT-145 dataset pipeline both whole: source truth -> real collector -> platform -> UI, including the delta re-collection and the ERD constraint row.

## 2026-09-03 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Opus 5 (session review-ctrib061r2, /review re-adjudication)
- odd-platform working-tree HEAD: ab457f0d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib061  (image odd-platform:odd-team-sut-revctrib061, digest sha256:410a5eef5650a7f1a16882bc4e800b8018d3c1f2f3addbd5c3eb714c626b8c70)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed (7.6m) — GREEN**, matching the standing 15/0 baseline. Nothing in this branch reaches ingestion (the diff is search/favorites BE+FE+spec+locales), so 'unaffected' was the expected result and it is what was measured, on a SUT the reviewer built from `3d5a7096` (`odd-platform:odd-team-sut-revctrib061`, `sha256:410a5eef…`). Includes IT-128's relationships pipeline 6/6 and IT-145's dataset pipeline.

