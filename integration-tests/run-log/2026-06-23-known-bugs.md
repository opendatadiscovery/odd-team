## 2026-06-23 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib031  (image odd-platform:odd-team-sut-ctrib031, digest sha256:56f54a0562c98e760888d53d1eeb4acbf6d4a751f0d5ba89ff1a4de9d5c2d432)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib030  (image odd-platform:odd-team-sut-ctrib030, digest sha256:d03a378e31013f7593966ed4621c7142df751b31ee06c9e72cee1a384f782521)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib032  (image odd-platform:odd-team-sut-ctrib032, digest sha256:52d3f79d4e30dea82abfe784446d56d3cf9f3b8d14f36b11199fb6d54b50d5ec)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib030  (image odd-platform:odd-team-sut-ctrib030, digest sha256:42ff85c423957dcac999321bce923b6733f90c52399273e9dcdeea74ea872ae3)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: known-bugs
- runner: AI-assisted Claude Opus 4.8 (CTRIB-030 rework; maintainer Raman Damayeu) — AUTHORITATIVE ctrib030 entry (supersedes the earlier same-day ctrib030 d03a378e / 42ff85c4 entries).
- result: 3 failed / 0 passed — EXPECTED-RED, 0 unexpected-green. The 3 are the tracked known bugs and all stayed RED (no un-flipped fix): IT-007 attachment LOCAL-durability lost-on-restart (LSN-001/PLT-086), IT-006 error-boundary not-contained (F-042/TEST-GAP-1013), IT-004 quality-dashboard unknown-status crash (PLT-052 — `palette.runStatus["WARNING"] undefined`). None lineage-related; none touched by #1758.
- odd-platform SUT source: 04e22af4 — current origin/main c7f14fc5 + the spec-only #1758 fix (see the feature-complete run-log for the full provenance note). [the auto 'working-tree HEAD: fd71eb3d' line below is the default checkout, NOT the SUT.]
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib030  (image odd-platform:odd-team-sut-ctrib030, digest sha256:74b8a80eca86de4efa7c476eff16ef0059dc690e1b543411e3a8ca168799a8d9)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

