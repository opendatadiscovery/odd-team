# Retrieval feedback — mutations made with no audit-log / activity-feed entry — 2026-06-17

## Retrieval
- query as asked: "Which PLT backlog item describes the gap where Platform modifications/mutations are made WITHOUT firing an audit-log / activity-feed entry? ... write operations / state changes in odd-platform that produce no corresponding activity-feed / audit-log record."
- final query: "PLT backlog item modifications made with no audit log entries mutations not recorded activity feed" (graph) + direct read of issues/odd-platform/PLT-{062,227,018}.md
- answer: PLT-227 (Class A — data-entity-scoped) + PLT-062 (Class B — schema-rooted/non-data-entity) · confidence HIGH · 5 iterations
- note: the answer is a TWO-ITEM split, not a single id. PLT-018 (which PLT-227 was split from) is now scoped to stored-XSS only and is NOT an audit item.

## Refinement suggestions
- node_id: "concepts/detail/invariants/no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f.yaml"
  returned_for_query: "activity feed missing event state change no audit record PLT"
  observed_problem: missing-edge
  evidence: "This invariant is THE canonical concept node for the audit-silence gap, with 7+ corroborating sidecars (REFACTOR-590/426/337/253/252, TEST-GAP-659/238/549/573/221, DOC-GAP-257). None of these nodes — nor the invariant — carries any edge or text reference to the backlog items that TRACK the gap (PLT-062 Class B, PLT-227 Class A). The PLT id was unreachable from the graph; it was only found by leaving the graph and grepping issues/odd-platform/. A graph-only retriever fails this query class entirely."
  suggested_refinement: "PLT backlog items in issues/odd-platform/ are not ingested as graph nodes. Either (a) ingest PLT issue drafts as backlog nodes with a TRACKED_BY / addressed-by edge from the RefactoringScope / TestGap / DocGap / invariant nodes they were triaged from (the PLT front-matter already records discovered_during + sidecar cluster, so the edge is derivable), or (b) at minimum add the PLT-062 / PLT-227 ids into the invariant's text and the audit-cluster sidecars' 'tracked as' field. Without this, the substrate cannot answer 'which backlog item tracks gap X' for any class."
  retriever_confidence: HIGH

- node_id: "test-map/detail/TEST-GAP-659.yaml"
  returned_for_query: "mutation write operation without activity-feed audit-log entry not recorded"
  observed_problem: missing-edge
  evidence: "TEST-GAP-659 is the SCHEMA-ROOTED regression pin for exactly the Class B gap that PLT-062 closes (activity.data_entity_id NOT NULL FK structurally rejects RBAC/Owner/Datasource/Collector mutations). PLT-062's own 'discovered_during' + Where table reference the same schema migration V0_0_48 and the same services, yet there is no link in either direction."
  suggested_refinement: "Add a 'tracked_by: PLT-062' field (and the reciprocal node edge once PLT ingestion exists) to TEST-GAP-659; do the same for the Class A surfaces (LinkServiceImpl / QueryExampleServiceImpl gaps) -> PLT-227. This makes the gap<->backlog mapping queryable from the graph."
  retriever_confidence: HIGH
