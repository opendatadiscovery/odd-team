## 2026-06-11 — suite/protocol: known-bugs
- runner: AI-assisted Claude (Fable 5) — CTRIB-004 /review full-set regression measurement (2026-06-11 directive)
- odd-platform working-tree HEAD: 93cb5252 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 93cb5252  (image odd-platform:odd-team-sut, digest sha256:83ac80775b4a87774a6228099025cb3989569faa9fd1850250f239ea48bac962)
- protocols: IT-003 IT-004 IT-005 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/top-tags-ordering.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 6 failed = EXPECTED RED, exactly the documented pins (IT-003 tsquery x2 PLT-090/127, IT-004 DQ dashboard PLT-052, IT-005 Top Tags PLT-026, IT-006 error boundary TEST-GAP-1013, IT-007 LOCAL attachment LSN-001/PLT-086). NO pin unexpectedly GREEN → no un-flipped fix anywhere; #1764 perturbed none of the pinned behaviours. First run of this lane since IT-002 moved out to feature-complete.

