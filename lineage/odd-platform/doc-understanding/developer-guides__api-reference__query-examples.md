---
doc_page: "docs/developer-guides/api-reference/query-examples.md"
page_title: "Query Examples"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/query-examples"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/query-examples"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Query Example (operator-curated SQL/KQL/Spark snippet attached to data entities and terms)"
    - "Query Example CRUD + Faceted Search (the 13-endpoint surface owned by QueryExampleController)"
    - "Cross-controller permission split — QueryExample owns _CREATE/_UPDATE/_DELETE, DataEntity owns _DATASET_*, Term owns _TERM_* link permissions (pattern invariant from batch V)"
  features:
    - "F-025"
  code_nodes:
    - "odd-platform java QueryExampleController controller-method:getQueryExampleList"
    - "odd-platform java QueryExampleController controller-method:createQueryExamples"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleDetails"
    - "odd-platform java QueryExampleController controller-method:updateQueryExample"
    - "odd-platform java QueryExampleController controller-method:deleteQueryExample"
    - "odd-platform java QueryExampleController controller-method:queryExamplesSearch"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleSearchFacetList"
    - "odd-platform java QueryExampleController controller-method:updateQueryExampleSearchFacetList"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleSearchResults"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleSearchSuggestions"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleByDatasetId"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleByTermId"
    - "odd-platform java DataEntityController controller-method:createQueryExampleToDatasetRelationshipNew"
    - "odd-platform java DataEntityController controller-method:deleteQueryExampleToDatasetRelationshipNew"
    - "odd-platform java TermController controller-method:createQueryExampleToTermRelationship"
    - "odd-platform java TermController controller-method:deleteQueryExampleToTermRelationship"
audience: [developer]
doc_claim_vs_code:
  - "Page headline + frontmatter claim '16 endpoints across three groups' (5 CRUD + 5 faceted + 6 lookup/linking). CODE CONFIRMS 16: substrate holds exactly 12 `QueryExampleController controller-method:` nodes + 4 cross-controller link methods (2 on DataEntityController, 2 on TermController). The doc count is CORRECT. NOT a drift against this page — recorded as a positive verification. Evidence: 12 QueryExampleController methods enumerated at nodes.jsonl (controller-method nodes); link methods odd-platform java DataEntityController controller-method:createQueryExampleToDatasetRelationshipNew / DataEntityController.java:436, deleteQueryExampleToDatasetRelationshipNew, TermController controller-method:createQueryExampleToTermRelationship / TermController.java:218, deleteQueryExampleToTermRelationship."
  - "ONTOLOGY-INTERNAL drift (NOT a page error): concepts.yaml operation:query-example-crud-and-faceted-search and Feature F-025 both headline 'the 13-endpoint surface owned by QueryExampleController', but the substrate holds only 12 QueryExampleController controller-method nodes and the concept's own prose enumerates 4+2+1+5 = 12. The QueryExampleController-owned count is 12, not 13. The api-reference page does NOT repeat this error — it correctly attributes 10 endpoints to QueryExampleController under CRUD+Faceted and groups the two reverse-lookup endpoints (dataset/term) with the cross-controller link endpoints. Drift to fix in the concept/feature title, not in the doc. Evidence: operation:query-example-crud-and-faceted-search (concepts/detail/operations/query-example-crud-and-faceted-search.yaml:1); F-025 (feature-flows/detail/F-025.yaml:1)."
  - "Page gives operationIds for the two TERM link endpoints (createQueryExampleToTermRelationship / deleteQueryExampleToTermRelationship) — CONFIRMED correct against TermController.java:218 (operation_id createQueryExampleToTermRelationship). But the page gives NO operationId for the two DATASET link endpoints, whose actual operationIds carry a 'New' suffix (createQueryExampleToDatasetRelationshipNew / deleteQueryExampleToDatasetRelationshipNew at DataEntityController.java:436). Asymmetric operationId coverage — low-severity DOC-GAP candidate; the page is not wrong, just less complete on the dataset side. Evidence: odd-platform java DataEntityController controller-method:createQueryExampleToDatasetRelationshipNew / DataEntityController.java:436."
  - "Page is an endpoint INDEX only and surfaces no security caveat beyond the RBAC permission gating. The implementing surface carries an operator-critical read-collaborative posture: per concepts.yaml operation node, 10 of the non-mutating endpoints have NO SecurityRule and fall through to .authenticated() — any authenticated user can read every query example across every namespace; and NO Activity Feed emission occurs on any query-example mutation (audit-silence). These are out of scope for a pure endpoint-list page (they are documented in the feature/RBAC pages this page links to) — recorded for the doc-gap-finder to decide whether the api-reference page should cross-note the read-posture. Evidence: operation:query-example-crud-and-faceted-search (concepts/detail/operations/query-example-crud-and-faceted-search.yaml:1); F-025 drift facets ten_of_thirteen_endpoints_no_security_rule_authenticated_only + audit_silence_no_activity_log_on_any_query_example_mutation."
maintainer_curated: false
---

# Query Examples — doc understanding

This is the API-reference (developer-audience) index for the Query Examples feature: a flat list of the 16 HTTP endpoints split into CRUD (5), faceted-search-session (5), and per-entity/per-term lookup + linking (6). It deliberately defers feature description, RBAC permission semantics, and the term-linking workflow to the canonical [data-modelling/query-examples.md] feature page it links to, and binds to that page's `#permissions-rbac` anchor for the seven `QUERY_EXAMPLE_*` permissions.

The page maps cleanly onto the implementation: 12 endpoints on `QueryExampleController` (confirmed by exactly 12 `controller-method` substrate nodes — 5 CRUD, 5 faceted-search, 2 reverse-lookup by dataset/term) plus 4 cross-controller link endpoints (2 on `DataEntityController` at `DataEntityController.java:436`, 2 on `TermController` at `TermController.java:218`). The headline count of 16 is therefore CORRECT against the substrate. The "16 vs 17" question raised at ingest is resolved: the api-reference page is accurate; the only count drift in the ontology is the concept/feature title's "13-endpoint surface owned by QueryExampleController" (the controller owns 12 methods), which the doc page does not repeat.

The term-link operationIds the page cites (`createQueryExampleToTermRelationship` / `deleteQueryExampleToTermRelationship`) are verified against `TermController.java:218`. The page omits the dataset-link operationIds, whose real names carry a `New` suffix — a minor completeness gap, not a contradiction. The operator-critical security posture of this surface (10 endpoints with no SecurityRule; no audit-log emission) lives on the linked feature/RBAC pages and is correctly out of scope for a pure endpoint index.

## Maintainer notes
