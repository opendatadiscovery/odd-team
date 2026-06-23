## 2026-06-23 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib030  (image odd-platform:odd-team-sut-ctrib030, digest sha256:d03a378e31013f7593966ed4621c7142df751b31ee06c9e72cee1a384f782521)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib032  (image odd-platform:odd-team-sut-ctrib032, digest sha256:52d3f79d4e30dea82abfe784446d56d3cf9f3b8d14f36b11199fb6d54b50d5ec)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib030  (image odd-platform:odd-team-sut-ctrib030, digest sha256:42ff85c423957dcac999321bce923b6733f90c52399273e9dcdeea74ea872ae3)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-23 — suite/protocol: multi-stack
- runner: AI-assisted Claude Opus 4.8 (CTRIB-030 rework; maintainer Raman Damayeu) — AUTHORITATIVE ctrib030 entry (supersedes the earlier same-day ctrib030 d03a378e / 42ff85c4 entries).
- result: 9 passed / 0 failed — GREEN. This RESOLVES the review-flagged d03a378e multi-stack e2e:FAIL (entry 1 above): that was a build-sut-bypassed run on the old port scheme where the per-stream SUT and the multi-stack webhook-stub both bound :18090; run-regression.sh now floors per-stream SUT ports at 18100/15500, clearing the collision. Not lineage-related either way.
- odd-platform SUT source: 04e22af4 — current origin/main c7f14fc5 + the spec-only #1758 fix (full provenance note in the feature-complete run-log). [the auto 'working-tree HEAD: fd71eb3d' line below is the default checkout, NOT the SUT.]
- odd-platform working-tree HEAD: fd71eb3d (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib030  (image odd-platform:odd-team-sut-ctrib030, digest sha256:74b8a80eca86de4efa7c476eff16ef0059dc690e1b543411e3a8ca168799a8d9)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

