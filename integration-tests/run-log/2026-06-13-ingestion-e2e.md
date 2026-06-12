## 2026-06-13 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Fable 5 (CTRIB-009 FULL-regression gate, suite 4/4)
- odd-platform working-tree HEAD: cc248bac (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ cc248bac+uncommitted  (image odd-platform:odd-team-sut, digest sha256:5bdc388ce6342f2cfe8cb48f93deb4fdf6a88818822f76c372da7d56c886b3fe)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: 6 passed / 0 failed (56.0s) on the fix SUT — the IT-128 relationships pipeline stand (neo4j GRAPH + postgres-FK ERD through the real collector) green. Baseline held; FULL regression complete: feature-complete 279/0 + multi-stack 9/0 + known-bugs 5/5-expected-RED + ingestion-e2e 6/0.

## 2026-06-13 — suite/protocol: ingestion-e2e
- runner: AI-assisted Claude Fable 5 (/review CTRIB-009 — reviewer's own FULL-regression gate, suite 4/4)
- odd-platform working-tree HEAD: 1653a909 (the SUT only when ODD_SUT=working)
- e2e SUT: built from source: the odd-platform WORKING TREE @ 1653a909  (image odd-platform:odd-team-sut, digest sha256:6cc6e88b0cfb0b27c10c2fefa68289f81b3e31d24489bade83e6ddfedc6d0baf)
- protocols: IT-128
- api probes: none; ui e2e: relationships-ingestion-pipeline.spec.ts; manual: none
- outcome: e2e:PASS
- machine traces: lineage/odd-platform/probe-runs/ (api) · integration-tests/e2e/test-results/ (e2e, on failure)
- evidence/notes: REVIEWER RUN (separate session): 6 passed / 0 failed (1.0m) on the SUT built from the CLEAN tree @ the committed PR head 1653a909 (image 6cc6e88b) — the IT-128 relationships pipeline stand (neo4j GRAPH + postgres-FK ERD through the real collector) green. Reviewer FULL regression complete: feature-complete 279/0 + multi-stack 9/0 + known-bugs 5/5-expected-RED (zero unexpected GREENs) + ingestion-e2e 6/0 — counts identical to the implement run, now measured on the committed head.

