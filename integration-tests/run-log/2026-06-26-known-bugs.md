## 2026-06-26 — suite/protocol: known-bugs
- runner: AI-assisted Claude Opus 4.8 — release-review (session review-release-029); ODD_SUT=published:0.29.0 (ghcr.io/opendatadiscovery/odd-platform:0.29.0 digest a2e0c86d)
- odd-platform working-tree HEAD: f12b8fbc (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-rel029  (image odd-platform:odd-team-sut-rel029, digest sha256:a2e0c86d488b8a5f287910b5d26dc2bcf30d61082fe87e75d5fa7824e916b3b5)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **3 failed / 3 = EXPECTED-RED** (IT-004 quality-dashboard-unknown / PLT-052 out-of-enum WARNING render-throw; IT-006 error-boundary-containment / TEST-GAP-1013; IT-007 attachment-local-durability / LSN-001). **0 unexpected GREEN** → no known bug got fixed-and-un-flipped in 0.29.0.

## 2026-06-26 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: f12b8fbc (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib038  (image odd-platform:odd-team-sut-ctrib038, digest sha256:492212ce9bcf7ac799d08655e812c2944bade07b2a6acc0e0d085e8462bc7856)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

## 2026-06-26 — suite/protocol: known-bugs
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: f12b8fbc (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib039  (image odd-platform:odd-team-sut-ctrib039, digest sha256:9ee98020c33e92e58a078ee0ff72c1ee7995e01938af3d16debf38668ed486b2)
- protocols: IT-004 IT-006 IT-007
- api probes: none; ui e2e: specs/quality-dashboard-unknown-status.spec.ts specs/error-boundary-containment.spec.ts specs/attachment-local-durability.spec.ts; manual: none
- outcome: e2e:FAIL
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

