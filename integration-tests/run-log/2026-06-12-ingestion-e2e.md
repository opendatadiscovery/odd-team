## 2026-06-12 — suite/protocol: ingestion-e2e
- runner: human (Raman) — maintainer-run; entry filled at his commit-and-push request
- odd-platform working-tree HEAD: abe51417 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ abe51417  (image odd-platform:odd-team-sut, digest sha256:76ae5e2eb477cc1a66f9f4d50fa1d7369750067d7a3fdb7d2909ae371653b105)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: **e2e:PASS — the maintainer's own first run of the new ingestion-grade lane** (IT-128 6/6 through the suite entrypoint: neo4j + postgres-FK truth -> real collector -> platform -> API + UI). Validates the lane wiring end-to-end on top of the authoring session's GREEN + ref:main RED proof.

