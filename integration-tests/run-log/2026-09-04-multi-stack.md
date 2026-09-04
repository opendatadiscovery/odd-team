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

## 2026-09-04 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session review-ctrib065 — the /review confirmation run for CTRIB-065 / #1878; `run-regression.sh revctrib065` under the heavy-e2e flock, SUT built with ODD_SUT=ref:contrib/CTRIB-065-saved-search-holds-every-dimension, i.e. from ORIGIN's copy of the branch @ 5751a8cb, not from any stream's worktree. Box: the maintainer's demo `odd-collector` restart-looping at ~103% CPU throughout, measured with `docker stats`)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib065  (image odd-platform:odd-team-sut-revctrib065, digest sha256:5dab59edf76ef09853eb78b8cd50febaafb220a3c19829bb970e3791d1d5bebb)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **16 passed / 3 failed of 19 (19.4m)** — worse than the implementer's 19/19 on identical code, so adjudicated rather than waved through. `my-data-scope-narrows:413` died on **`page.goto: net::ERR_NETWORK_CHANGED`** — a host network-interface event inside Chromium, not an assertion (journalctl shows Cisco AnyConnect `acvpnagent` probing/reconfiguring the network in the same window). `my-data-scope-narrows:388` — the documented C0 flake of this spec, whose red moves between its cases (:259, :413, :434, now :388). `demo-stand-first-run:203` REPRODUCED on a confirmation re-run and was root-caused: `demo-stand.ts:28` falls back to the SHARED `../odd-platform` checkout when ODD_PLATFORM_DIR is unset, and the maintainer's **uncommitted** docker/demo.yaml there sets AUTH_TYPE=LOGIN_FORM, under which the injector loud-refuses (#1877) and the enricher exits 1 — the harness read someone's WIP, not a code defect. Logged by extending **TST-066** in place.

## 2026-09-04 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib065  (image odd-platform:odd-team-sut-revctrib065, digest sha256:5dab59edf76ef09853eb78b8cd50febaafb220a3c19829bb970e3791d1d5bebb)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-09-04 — suite/protocol: multi-stack
- runner: AI-assisted (Claude Opus 5, session review-ctrib065 — the CONFIRMATION re-run of the lane on the SAME image, to adjudicate the three reds of my first run rather than attribute them; `ODD_STREAM=revctrib065ms ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-revctrib065 run-suite.sh multi-stack`)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib065  (image odd-platform:odd-team-sut-revctrib065, digest sha256:5dab59edf76ef09853eb78b8cd50febaafb220a3c19829bb970e3791d1d5bebb)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **17 passed / 2 failed (17.4m)** — the adjudication of my earlier 16/3 on the identical image. **BOTH IT-153 cases that failed in run 1 (`:388`, `:413`) are GREEN here**, retiring them as the documented C0 flake and the `net::ERR_NETWORK_CHANGED` host event they were diagnosed as. `demo-stand-first-run:203` REPRODUCED — and was root-caused rather than re-attributed: `demo-stand.ts:28` falls back to the SHARED `../odd-platform` checkout when `ODD_PLATFORM_DIR` is unset (the `run-suite.sh` path; `run-regression.sh` always sets it), and the maintainer's **uncommitted** `docker/demo.yaml` there adds `AUTH_TYPE=LOGIN_FORM`, under which the injector loud-refuses (#1877) and the enricher exits 1. **TST-066 extended in place.** The one NEW red is `notifications-wal-lifecycle:63` (IT-011), which failed on `Command failed: docker compose -p oddnotif … up -d` — its own stack never came up; not an assertion, on the documented-flaky WAL stand (PLT-139). Same signature as feature-complete: the off-baseline reds MOVE between runs of identical code while the only constant is a harness defect. Nothing in either run points at CTRIB-065.
