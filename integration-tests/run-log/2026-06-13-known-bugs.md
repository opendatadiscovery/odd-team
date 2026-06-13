## 2026-06-13 — suite/protocol: known-bugs
- runner: AI-assisted Claude Fable 5 (CTRIB-009 FULL-regression gate, suite 3/4)
- odd-platform working-tree HEAD: cc248bac (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ cc248bac+uncommitted  (image odd-platform:odd-team-sut, digest sha256:8c9dd90dfd9556728a0d8537120e87cb145be7501abe0c6d26046ee2670b790f)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 5 failed / 0 passed — EXPECTED all-RED on the fix SUT; every failure its documented pin (IT-007 LSN-001/PLT-086 attachment durability - IT-006 TEST-GAP-1013 error boundary - IT-004 PLT-052 DQ unknown-status - IT-003 x2 PLT-090/PLT-127 tsquery poisoning). ZERO unexpected GREENs = no un-flipped fixes; the CTRIB-009 mapper guards touch none of these pins.

## 2026-06-13 — suite/protocol: known-bugs
- runner: AI-assisted Claude Fable 5 (/review CTRIB-009 — reviewer's own FULL-regression gate, suite 3/4)
- odd-platform working-tree HEAD: 1653a909 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 1653a909  (image odd-platform:odd-team-sut, digest sha256:d77bbd9db4e3dee13c9fa6f98bee5364b7bdfac6a1736f583cb07131834aa364)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: REVIEWER RUN (separate session): 5 failed / 0 passed — EXPECTED all-RED on the SUT built from the CLEAN tree @ the committed PR head 1653a909 (image d77bbd9d). Every failure its documented pin (IT-007 LSN-001/PLT-086 attachment durability · IT-006 TEST-GAP-1013 error boundary · IT-004 PLT-052 DQ unknown-status · IT-003 ×2 PLT-090/PLT-127 tsquery poisoning). ZERO unexpected GREENs = no un-flipped fixes; the #1755 mapper guards touch none of these pins.

## 2026-06-13 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 05ecf0a9 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 05ecf0a9+uncommitted  (image odd-platform:odd-team-sut, digest sha256:6e117486113e9711d3d7d5a05856665ac6b076a90712db6d410b4a948471233e)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-13 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 05ecf0a9 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 05ecf0a9+uncommitted  (image odd-platform:odd-team-sut, digest sha256:1a729c8efc432b15d6ee9868f6ab89638ced731258eb4cf9a5b6251f0950a45d)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

