## 2026-09-05 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session review-ctrib065 — the FULL four-suite regression for the PLT-265 fold-in, `ODD_PLATFORM_DIR=../odd-platform-ctrib061 ODD_SUT=working run-regression.sh revctrib065b` under the heavy-e2e flock; SUT built from the CLEAN committed worktree @ 510a29b9. Required because AppPopover is shared by four call sites, so the blast radius is wider than the one screen)
- odd-platform working-tree HEAD: 96d77668 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib065b  (image odd-platform:odd-team-sut-revctrib065b, digest sha256:addf8ab0abb533e6683638af5256847a6fdc79b0f36784a9b57ccd638aba76d0)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed = IT-004 / IT-006 / IT-007** — the expected quarantine RED, no unexpected GREEN.

