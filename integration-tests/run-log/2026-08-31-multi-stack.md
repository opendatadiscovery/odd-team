## 2026-08-31 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: c54b9c61 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib060  (image odd-platform:odd-team-sut-ctrib060, digest sha256:651cb049770f58557819c69065c69302be451dfb996e698a77552be4bc6b81a0)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-08-31 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: c54b9c61 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062  (image odd-platform:odd-team-sut-ctrib062, digest sha256:c763c52a0eb82784e24591ad2192d98787781e9179a839e219d260957a5900fd)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-08-31 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: c54b9c61 (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib062  (image odd-platform:odd-team-sut-ctrib062, digest sha256:bd7cddec0ebca1a5d22b48478df9d891fc97d656d243a029b9a35d2767c19ff8)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts my-data-scope-narrows.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>


## 2026-08-31 — suite/protocol: multi-stack (CTRIB-062 REWORK — the B2 blocker)
- runner: AI-assisted (Claude Opus 5, session ctrib062rework)
- odd-platform working-tree HEAD: 991e0499 (contrib/CTRIB-062-my-data-filter, clean)
- e2e SUT: odd-platform:odd-team-sut-ctrib062, digest sha256:bd7cddec0ebca1a5d22b48478df9d891fc97d656d243a029b9a35d2767c19ff8
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124 IT-153
- outcome: PASS (13 passed, 10.4m)
- evidence/notes: THE B2 CLOSURE. The prior run ended e2e:FAIL and was closed with five TARGETED
  `run-suite.sh IT-153` runs, while the implementer's own root cause said the failure only surfaces in SUITE
  context (a preceding auth-mode-boundary spec tears the LOGIN_FORM stack down, so IT-153's beforeAll boots
  cold). A targeted run cannot reproduce that. This is the whole suite, one process, green.
