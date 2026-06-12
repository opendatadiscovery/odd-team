## 2026-06-13 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Fable 5 (CTRIB-009 FULL-regression gate, suite 4/4)
- odd-platform working-tree HEAD: cc248bac (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ cc248bac+uncommitted  (image odd-platform:odd-team-sut, digest sha256:5bdc388ce6342f2cfe8cb48f93deb4fdf6a88818822f76c372da7d56c886b3fe)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 6 passed / 0 failed (56.0s) on the fix SUT — the IT-128 relationships pipeline stand (neo4j GRAPH + postgres-FK ERD through the real collector) green. Baseline held; FULL regression complete: feature-complete 279/0 + multi-stack 9/0 + known-bugs 5/5-expected-RED + ingestion-e2e 6/0.

