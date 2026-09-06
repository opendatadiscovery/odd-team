## 2026-09-06 — suite/protocol: known-bugs
- runner: AI-assisted (Claude, session ctrib066 — the remaining three suites of the four-suite regression, reusing the cdaa7d45 image (build bypassed) under the heavy-e2e flock: `ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-ctrib066 run-suite.sh <suite>`)
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib066  (image odd-platform:odd-team-sut-ctrib066, digest sha256:0ee6bc899f9f8863c90617fcf8d8d39ad75694c58235ec1fad5a7a7cd55bc2f6)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed / 3 (the EXPECTED known-bugs signature — all three pinned bugs still reproduce, none fixed un-flipped)**: attachment-local-durability (LOCAL storage silently loses an uploaded file on container recreate — LSN-001 / PLT-086), error-boundary-containment (a malformed dashboard payload white-screens the app — TEST-GAP-1013 / F-042), quality-dashboard-unknown-status (an out-of-enum run status blanks the dashboard — PLT-052). ST-9 touches none of these; the set is unchanged from the tracked known-bugs baseline.

## 2026-09-06 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)  <!-- reviewer note (review-ctrib066, 2026-09-06): NOT this reviewer's entry. This is a stray, never-filled skeleton left by the ctrib066 implement session's second (build-then-OOM) attempt on the same image; the known-bugs RESULT the item's ledger quotes comes from the first entry above (digest 0ee6bc89). Left unfilled rather than invented — the mechanism is TST-070. -->
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib066  (image odd-platform:odd-team-sut-ctrib066, digest sha256:b3701f317143451e71ebd933ec3faf78e661a482572e3477d3b6cca8b003fcf9)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-09-06 — suite/protocol: known-bugs
- runner: AI-assisted (Claude Opus 5, session review-ctrib066 — the REVIEWER's own four-suite regression, `run-regression.sh revctrib066`)
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-revctrib066  (image odd-platform:odd-team-sut-revctrib066, digest sha256:61132a929fb7e6f160e470a80927944879280029039bdc475550d4195404f61f)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed / 3 — the EXPECTED known-bugs signature**, read from the JSON reporter: attachment-local-durability:35 (LSN-001 / PLT-086), error-boundary-containment:29 (TEST-GAP-1013 / F-042), quality-dashboard-unknown-status:33 (PLT-052). All three pinned bugs still reproduce; **no unexpected GREEN**, so nothing was fixed un-flipped. ST-9 touches none of them.

