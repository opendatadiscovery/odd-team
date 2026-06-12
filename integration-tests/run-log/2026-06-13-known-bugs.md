## 2026-06-13 — suite/protocol: known-bugs
- runner: AI-assisted Claude Fable 5 (CTRIB-009 FULL-regression gate, suite 3/4)
- odd-platform working-tree HEAD: cc248bac (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ cc248bac+uncommitted  (image odd-platform:odd-team-sut, digest sha256:8c9dd90dfd9556728a0d8537120e87cb145be7501abe0c6d26046ee2670b790f)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 5 failed / 0 passed — EXPECTED all-RED on the fix SUT; every failure its documented pin (IT-007 LSN-001/PLT-086 attachment durability - IT-006 TEST-GAP-1013 error boundary - IT-004 PLT-052 DQ unknown-status - IT-003 x2 PLT-090/PLT-127 tsquery poisoning). ZERO unexpected GREENs = no un-flipped fixes; the CTRIB-009 mapper guards touch none of these pins.

