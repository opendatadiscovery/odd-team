## 2026-06-12 — suite/protocol: known-bugs
- runner: AI-assisted Claude (Fable 5) — CTRIB-006 /contribute implement session (full-regression gate)
- odd-platform working-tree HEAD: abe51417 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ abe51417  (image odd-platform:odd-team-sut, digest sha256:823d2f9f2fb5aa19a171e30881031f502ef2d8edecf1154482124ad52704ca76)
- protocols: IT-003 IT-004 IT-005 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/top-tags-ordering.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: full-regression gate suite 3/3 for the #1752 fix (CTRIB-006), SUT = working tree @ abe51417: **6 failed / 0 passed — EXPECTED all-RED**, every failure its documented pin (IT-007 attachment-local durability LSN-001/PLT-086; IT-006 error boundary TEST-GAP-1013; IT-004 DQ dashboard unknown-status PLT-052; IT-003 tsquery poisoning ×2 PLT-090/PLT-127; IT-005 top-tags ordering PLT-026). ZERO unexpected GREENs — no fix landed un-flipped (tests-pillar flip-on-fix checklist clean for this change).

## 2026-06-12 — suite/protocol: known-bugs
- runner: AI-assisted Claude (Fable 5) — CTRIB-006 /review session (reviewer's own full-regression run, separate from the implement session)
- odd-platform working-tree HEAD: abe51417 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ abe51417  (image odd-platform:odd-team-sut, digest sha256:48086f18a87f3f13448f9b653202522227d8350318fb57e6c055e1877e0334a3)
- protocols: IT-003 IT-004 IT-005 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/top-tags-ordering.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: REVIEWER re-measurement, gate suite 3/3 (G-C2 / 2026-06-11 directive): **6 failed / 0 passed — EXPECTED all-RED**, every failure its documented pin (IT-007 LSN-001/PLT-086 attachment durability; IT-006 TEST-GAP-1013 error boundary; IT-004 PLT-052 unknown run status; IT-003 ×2 PLT-090/PLT-127 tsquery poisoning; IT-005 PLT-026 top-tags ordering). ZERO unexpected GREENs on the #1752-fix SUT — no fix landed un-flipped; matches the implement run's six exactly.

