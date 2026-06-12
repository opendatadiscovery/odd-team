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

## 2026-06-12 — suite/protocol: known-bugs
- runner: AI-assisted Claude (Fable 5) — CTRIB-007 /contribute implement session (full-regression gate)
- odd-platform working-tree HEAD: 82812cdf (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 82812cdf  (image odd-platform:odd-team-sut, digest sha256:08f1ce98b77606ba897c2be650c4fa8f9e9b08721d89c75c68a48b8716cf83e9)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **4 failed / 1 passed — ONE UNEXPECTED GREEN (a TST-042 interference instance, NOT an un-flipped fix):** IT-003's catalog-search half passed in-suite while its dictionary half + IT-004/006/007 stayed RED. Investigated in-band: IT-003 re-run in ISOLATION on the same SUT = 2/2 RED (both pins hold — see 2026-06-12-IT-003.md), and the CTRIB-007 diff cannot touch tsquery behaviour. Root: this lane's spec set changed this run (IT-005 left the lane → sequencing/residue shifted). Clean re-run below.

## 2026-06-12 — suite/protocol: known-bugs
- runner: AI-assisted Claude (Fable 5) — CTRIB-007 /contribute implement session (full-regression gate)
- odd-platform working-tree HEAD: 82812cdf (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 82812cdf  (image odd-platform:odd-team-sut, digest sha256:d37ca85d8a939aac592c3d3f24db545f3a5ea5575d5c4fb35745ca1cba51b76c)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **5 failed / 0 passed — EXPECTED all-RED**, every failure its documented pin (IT-003 x2 PLT-090/PLT-127 tsquery poisoning; IT-004 PLT-052 DQ unknown-status; IT-006 TEST-GAP-1013 error boundary; IT-007 LSN-001/PLT-086 attachment durability). ZERO unexpected GREENs — no fix landed un-flipped; IT-005 is correctly OUT of this lane (flipped by CTRIB-007, now in feature-complete).

## 2026-06-12 — suite/protocol: known-bugs
- runner: AI-assisted Claude (Fable 5) — CTRIB-007 /review session (the reviewer's own full-regression gate, G-C2)
- odd-platform working-tree HEAD: 1a196254 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 1a196254  (image odd-platform:odd-team-sut, digest sha256:54a72a107c24cce73d1437325e07ec2fe000bb78e889012743321be54ebb87f1)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **5 failed / 0 passed — EXPECTED all-RED**, every failure its documented pin: IT-007 (LSN-001/PLT-086 attachment durability), IT-006 (TEST-GAP-1013 error boundary), IT-004 (PLT-052 DQ unknown-status crash), IT-003 x2 (PLT-090 catalog + PLT-127 dictionary tsquery). ZERO unexpected GREENs on the PR-HEAD SUT `1a196254` — the post-flip 4-protocol lane composition runs clean (the implement session's one-off TST-042 sequencing flake did not recur).

## 2026-06-12 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: 76dc0225 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 76dc0225  (image odd-platform:odd-team-sut, digest sha256:5896df1f03edb3b3343da76684808d1e66ab82fd86b1ce7e60f198b7d5e53d63)
- protocols: IT-003 IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/search-tsquery-poisoning.spec.ts specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

