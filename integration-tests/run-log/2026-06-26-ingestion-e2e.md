## 2026-06-26 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Opus 4.8 — release-review (session review-release-029); ODD_SUT=published:0.29.0 (ghcr.io/opendatadiscovery/odd-platform:0.29.0 digest a2e0c86d)
- odd-platform working-tree HEAD: f12b8fbc (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-rel029  (image odd-platform:odd-team-sut-rel029, digest sha256:a2e0c86d488b8a5f287910b5d26dc2bcf30d61082fe87e75d5fa7824e916b3b5)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **15 passed / 15**. GREEN (real source→collector→platform ingestion stands).

## 2026-06-26 — suite/protocol: ingestion-e2e
- runner: (fill: AI-assisted <model> | human <name>)
- odd-platform working-tree HEAD: f12b8fbc (the SUT only when ODD_SUT=working)
- e2e SUT: explicit raw image (build-sut bypassed): odd-platform:odd-team-sut-ctrib039  (image odd-platform:odd-team-sut-ctrib039, digest sha256:9ee98020c33e92e58a078ee0ff72c1ee7995e01938af3d16debf38668ed486b2)
- protocols: IT-128 IT-145
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts dataset-pipeline-lifecycle.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: <captured values from the probe-run yaml / Playwright report; or the manual observation>

