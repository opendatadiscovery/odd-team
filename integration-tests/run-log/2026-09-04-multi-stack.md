## 2026-09-04 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session odd-team-05 — CTRIB-065 / #1878 Phase D, regression #1 via `run-regression.sh ctrib065` under the heavy-e2e flock; SUT `SUT_DESC = WORKING TREE @ 51f324a6+uncommitted`, image `sha256:9fd77c3b…` — the only uncommitted file at build time was a TEST (jib excludes tests), so the image content == the committed `51f324a6`. Box loaded throughout by the maintainer's demo `odd-collector` restart-looping at ~100% CPU; load 8-12 on 8 cores)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib065  (image odd-platform:odd-team-sut-ctrib065, digest sha256:9fd77c3b629132b385636c959a54d1c4edaa29f97dc557af8ff324c52548eb66)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **18 passed / 1 failed of 19 (17.7m)** — **IT-154 (the demo stand) 5/5 GREEN**; LOGIN_FORM session cookie, LDAP RBAC, MinIO REMOTE attachments and both notifications-WAL specs all green. The 1 = `my-data-scope-narrows:413` (IT-153), its 30s "search settled" wait on the results header — the case CTRIB-062 documents as C0-flaky (2026-09-03 it was `:434`, green on retry): the red moves between that spec's cases, n=6 across sessions. Own-stack LOGIN_FORM spec with no saved-search surface; in the isolated retry set.

## 2026-09-04 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session odd-team-05 — CTRIB-065 / #1878, regression **#2** at the FINAL head `5751a8cb` via `run-regression.sh ctrib065` under the heavy-e2e flock; SUT built from the contrib/CTRIB-065-saved-search-holds-every-dimension worktree. Box loaded throughout by the maintainer's demo `odd-collector` restart-looping at ~100% CPU; load 8-12 on 8 cores)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib065  (image odd-platform:odd-team-sut-ctrib065, digest sha256:5fcba4ea6282ddd53046dc3a5db6e273fd5a8e9c6c40a54c7dc2b527b8890b80)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **19 passed / 0 failed — a CLEAN SWEEP**, the first across the last three runs of this lane (main 2026-09-03: 18/1; regression #1: 18/1). IT-153's `:413`, run #1's only red, passes here — which retires it as flaky rather than broken and matches CTRIB-062's own C0 record for that spec. IT-154's demo stand 5/5 again; LOGIN_FORM, LDAP, MinIO and both notifications-WAL specs green.

