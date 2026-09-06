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
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: af5a573b (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib066  (image odd-platform:odd-team-sut-ctrib066, digest sha256:b3701f317143451e71ebd933ec3faf78e661a482572e3477d3b6cca8b003fcf9)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

