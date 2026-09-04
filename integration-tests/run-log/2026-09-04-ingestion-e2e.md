## 2026-09-04 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session odd-team-05 — CTRIB-065 / #1878 Phase D, regression #1 via `run-regression.sh ctrib065` under the heavy-e2e flock; SUT `SUT_DESC = WORKING TREE @ 51f324a6+uncommitted`, image `sha256:9fd77c3b…` — the only uncommitted file at build time was a TEST (jib excludes tests), so the image content == the committed `51f324a6`. Box loaded throughout by the maintainer's demo `odd-collector` restart-looping at ~100% CPU; load 8-12 on 8 cores)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib065  (image odd-platform:odd-team-sut-ctrib065, digest sha256:9fd77c3b629132b385636c959a54d1c4edaa29f97dc557af8ff324c52548eb66)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **14 passed / 1 failed of 15 (11.4m)** — the whole `dataset-pipeline-lifecycle` stand green through the REAL collector (9/9), `relationships-ingestion-pipeline` 5/6. The 1 = `:195`, the GRAPH overview's `Source:` label not visible within 20s on a page opened right after a full neo4j ingestion — a first-paint timeout on a stand that touches no saved-search code.

## 2026-09-04 — suite/protocol: ingestion-e2e
- runner: AI-assisted (Claude Opus 5, session odd-team-05 — CTRIB-065 / #1878, regression **#2** at the FINAL head `5751a8cb` via `run-regression.sh ctrib065` under the heavy-e2e flock; SUT built from the contrib/CTRIB-065-saved-search-holds-every-dimension worktree. Box loaded throughout by the maintainer's demo `odd-collector` restart-looping at ~100% CPU; load 8-12 on 8 cores)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib065  (image odd-platform:odd-team-sut-ctrib065, digest sha256:5fcba4ea6282ddd53046dc3a5db6e273fd5a8e9c6c40a54c7dc2b527b8890b80)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 0 failed — also a CLEAN SWEEP** (run #1 was 14/1): `relationships-ingestion-pipeline:195`, run #1's red, passes here. Both green-target lanes that carried a single red in run #1 are fully green at the final head, completing the contention signature: nothing outside the tracked baseline reproduces across the two runs.

