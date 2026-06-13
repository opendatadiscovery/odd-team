## 2026-06-13 — suite/protocol: multi-stack
- runner: AI-assisted Claude Fable 5 (CTRIB-009 FULL-regression gate, suite 2/4)
- odd-platform working-tree HEAD: cc248bac (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ cc248bac+uncommitted  (image odd-platform:odd-team-sut, digest sha256:39d24adf2dc5eb5b56db76c2287c71a5c79ae36add1775280a643e16dff4a9a8)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 9 passed / 0 failed (3.1m) on the fix SUT (working tree @ cc248bac + the uncommitted CTRIB-009 mapper guards). Baseline count held (MinIO / LOGIN_FORM / LDAP / notifications-WAL self-managed stacks). Zero regressions.

## 2026-06-13 — suite/protocol: multi-stack
- runner: AI-assisted Claude Fable 5 (/review CTRIB-009 — reviewer's own FULL-regression gate, suite 2/4)
- odd-platform working-tree HEAD: 1653a909 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 1653a909  (image odd-platform:odd-team-sut, digest sha256:8526cc439c5509c6bd10fb06988ef41352dc39a024419e02b6e423c7c5ef7199)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: REVIEWER RUN (separate session): 9 passed / 0 failed (3.3m) on the SUT built fresh from the CLEAN tree @ the committed PR head 1653a909 (image 8526cc43). Baseline held (MinIO / LOGIN_FORM / LDAP / notifications-WAL self-managed stacks). Zero regressions.

## 2026-06-13 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 05ecf0a9 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 05ecf0a9+uncommitted  (image odd-platform:odd-team-sut, digest sha256:ae74942df71dacb4fdc21dbbfbb21ed41a3df54e91ee0ecf18dd54ed52d885bd)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-13 — suite/protocol: multi-stack
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 05ecf0a9 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 05ecf0a9+uncommitted  (image odd-platform:odd-team-sut, digest sha256:f88e69276c3a99f44f1964f63d44d95013d6d90950a22038e22297b0353d314e)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-13 — suite/protocol: multi-stack
- runner: AI-assisted Claude Opus 4.8 - separate-session /review (CTRIB-010 #1657, G-C2 independent regression)
- odd-platform working-tree HEAD: 97978249 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 97978249  (image odd-platform:odd-team-sut, digest sha256:60110431ef6518b1112d2fdd0dbac8e718348e5769965f487fff8d59e203cd2c)
- protocols: IT-008 IT-009 IT-010 IT-011 IT-012 IT-123 IT-124
- api probes: none; ui e2e: specs/attachment-remote-roundtrip.spec.ts specs/auth-mode-boundary.spec.ts specs/ldap-rbac-enforcement.spec.ts specs/notifications-wal-lifecycle.spec.ts specs/notifications-wal-failover.spec.ts session-cookie-posture.spec.ts rbac-policy-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

