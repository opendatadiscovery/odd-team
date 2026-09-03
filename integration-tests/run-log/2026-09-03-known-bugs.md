## 2026-09-03 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session review-ctrib063 round 2 — the /implement rework that closed the /review fix-list; the NEXT /review must be a fresh session)
- odd-platform working-tree HEAD: the SUT source is `9c1360df` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree) — build-sut.sh reports `built from source: the odd-platform WORKING TREE @ 9c1360df`. Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib063r2  (image odd-platform:odd-team-sut-ctrib063r2, digest sha256:4f6feeeea94817ce04696a4f0acac07e6bc6cd5423ce6b997514cfc34b7e5b0c)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed — the expected-RED set, all three attributed, ZERO unexpected GREEN.** IT-007 `attachment-local-durability:35` (LOCAL-storage loss on container recreate, LSN-001/PLT-086) · IT-006 `error-boundary-containment:29` (no ErrorBoundary anywhere in odd-platform-ui, TEST-GAP-1013/F-042) · IT-004 `quality-dashboard-unknown-status:33` (out-of-enum run status throws before the `??` fallback, PLT-052 Defect 1). No pin flipped to green, so there is no un-flipped fix to chase.

## 2026-09-03 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session review-ctrib063r2 — the FRESH `/review` of the round-2 rework; SUT built by THIS session, not carried from implement)
- odd-platform working-tree HEAD: the SUT source is `9c1360df` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree; `git status --porcelain` empty). `run-regression.sh revctrib063r2` with ODD_PLATFORM_DIR pointed at that worktree built image `odd-platform:odd-team-sut-revctrib063r2` (digest `sha256:57e9c69f9a5eb67f679b42b501b6f69a80c224d6da926ee5198828ae14f36644`) from it. Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib063r2  (image odd-platform:odd-team-sut-revctrib063r2, digest sha256:57e9c69f9a5eb67f679b42b501b6f69a80c224d6da926ee5198828ae14f36644)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed — the expected-RED set, all three attributed, ZERO unexpected GREEN.** IT-007 `attachment-local-durability:35` (LOCAL-storage loss on container recreate, LSN-001/PLT-086) - IT-006 `error-boundary-containment:29` (no ErrorBoundary in odd-platform-ui, TEST-GAP-1013/F-042) - IT-004 `quality-dashboard-unknown-status:33` (out-of-enum run status, PLT-052 Defect 1). No pin flipped green, so there is no un-flipped fix to chase.

## 2026-09-03 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Fable 5.1, session review-ctrib063r2 — the /implement rework closing the round-2 /review fix-list, run as stream ctrib063r3; the NEXT /review must be a fresh session)
- odd-platform working-tree HEAD: the SUT source is `6557b4b9` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree — `docker/README.md` bridge sentence on top of `9c1360df`; no Java/TS/SQL in the branch). `run-regression.sh ctrib063r3` with ODD_PLATFORM_DIR pointed at that worktree built image `odd-platform:odd-team-sut-ctrib063r3` from it (build-sut: `built from source: the odd-platform WORKING TREE @ 6557b4b9`). Any bare SHA the harness prints is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib063r3  (image odd-platform:odd-team-sut-ctrib063r3, digest sha256:17f57b3ca92ab59d26df19b09048e536e7697f5a66cf54337ef01dc85c26c053)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed — the expected-RED set, all three attributed, ZERO unexpected GREEN**, at `6557b4b9`: IT-007 `attachment-local-durability:35` (LOCAL-storage loss on container recreate, LSN-001/PLT-086) - IT-006 `error-boundary-containment:29` (no ErrorBoundary in odd-platform-ui, TEST-GAP-1013/F-042) - IT-004 `quality-dashboard-unknown-status:33` (out-of-enum run status, PLT-052 Defect 1). No pin flipped green.

## 2026-09-03 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5 (1M context), session review-ctrib063r3 — the THIRD, FRESH `/review` of the round-3 rework; SUT built by THIS session, not carried from implement)
- odd-platform working-tree HEAD: the SUT source is `6557b4b9` in ../odd-platform-ctrib063 (branch contrib/CTRIB-063-demo-stand-readiness, clean tree; `git status --porcelain` empty). `run-regression.sh revctrib063r3` with ODD_PLATFORM_DIR pointed at that worktree built image `odd-platform:odd-team-sut-revctrib063r3` (digest `sha256:ba585161422b7ee95b6a0f9e6621cebb39cca7bcf4908e9791356444b38be5d5`) from it — build-sut reported `built from source: the odd-platform WORKING TREE @ 6557b4b9`. Any bare SHA the harness printed is the SHARED ../odd-platform checkout, not this run's subject (LSN-033).
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib063r3  (image odd-platform:odd-team-sut-revctrib063r3, digest sha256:ba585161422b7ee95b6a0f9e6621cebb39cca7bcf4908e9791356444b38be5d5)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed — expected-RED, all three attributed, ZERO unexpected GREEN.** IT-007 `attachment-local-durability:35` (LOCAL storage loses the file on container recreate, LSN-001/PLT-086), IT-006 `error-boundary-containment:29` (a render throw white-screens the shell, TEST-GAP-1013), IT-004 `quality-dashboard-unknown-status:33` (`palette.runStatus["WARNING"]` undefined -> throws before the `??` fallback, PLT-052 Defect 1, `DataQualityContent.tsx:47-48`). No un-flipped fix to chase; the tests-pillar flip-on-fix checklist is not triggered.

## 2026-09-03 — suite/protocol: known-bugs
- runner: AI-assisted Claude Opus 5 (session review-ctrib061r2, /review re-adjudication)
- odd-platform working-tree HEAD: ab457f0d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib061  (image odd-platform:odd-team-sut-revctrib061, digest sha256:410a5eef5650a7f1a16882bc4e800b8018d3c1f2f3addbd5c3eb714c626b8c70)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed / 0 passed — EXPECTED RED, set-equal to the documented pin set, ZERO unexpected GREEN.** IT-007 `attachment-local-durability:35` (LOCAL-storage loss on container recreate, LSN-001/PLT-086) · IT-006 `error-boundary-containment:29` (no ErrorBoundary anywhere in odd-platform-ui, TEST-GAP-1013/F-042) · IT-004 `quality-dashboard-unknown-status:33` (out-of-enum run status throws before the `??` fallback, PLT-052 Defect 1). No pin flipped to green, so there is no un-flipped fix to chase. Reviewer's own run on `odd-platform:odd-team-sut-revctrib061` (`sha256:410a5eef…`, from `3d5a7096`).

