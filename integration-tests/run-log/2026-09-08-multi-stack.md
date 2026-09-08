## 2026-09-08 — suite/protocol: multi-stack
- runner: AI-assisted Claude Opus 5 (1M context), session ctrib067 (CTRIB-067 Phase D, run-regression.sh under the machine-wide flock)
- odd-platform working-tree HEAD: 0238005c (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib067  (image odd-platform:odd-team-sut-ctrib067, digest sha256:a6c9700f1bfc535e7952568c8834f43a1bdf222d694a5a06760187881fbb9544)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153 IT-154
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts demo-stand-first-run.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **7 failed / 12 passed (17.1m)** — attributed, none of it this change. FIVE are `demo-stand-first-run` (IT-154), which drives odd-platform's own `docker/demo.yaml` against the PUBLISHED image (`ghcr.io/opendatadiscovery/odd-platform@sha256:3b61b3f2...`) — it never executes this branch's code, so it is change-independent by construction. The other two are `my-data-scope-narrows` `:388` and `:434`; `:434` failed on the branch three runs running and passed on main, and its trace shows `net::ERR_NETWORK_CHANGED` aborting `assets/Search-*.js` — TST-071. Its sibling `:388` shows the mirror image on main; both have now passed AND failed on identical code.

