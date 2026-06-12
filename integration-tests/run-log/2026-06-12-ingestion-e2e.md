## 2026-06-12 — suite/protocol: ingestion-e2e
- runner: human (Raman) — maintainer-run; entry filled at his commit-and-push request
- odd-platform working-tree HEAD: abe51417 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ abe51417  (image odd-platform:odd-team-sut, digest sha256:76ae5e2eb477cc1a66f9f4d50fa1d7369750067d7a3fdb7d2909ae371653b105)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **e2e:PASS — the maintainer's own first run of the new ingestion-grade lane** (IT-128 6/6 through the suite entrypoint: neo4j + postgres-FK truth -> real collector -> platform -> API + UI). Validates the lane wiring end-to-end on top of the authoring session's GREEN + ref:main RED proof.

## 2026-06-12 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude (Fable 5) — CTRIB-007 /contribute implement session (full-regression gate)
- odd-platform working-tree HEAD: 82812cdf (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 82812cdf  (image odd-platform:odd-team-sut, digest sha256:f9c1712f19c6c2cc5a7c61d27ae1f9aff107c6de84cf979665ac6fbd39e2e894)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **6 passed / 0 failed (1.2m)** — IT-128 relationships pipeline (neo4j GRAPH truth + postgres-FK ERD truth through the REAL collector) unaffected by the CTRIB-007 tag-ordering fix.

