---
doc_page: "docs/developer-guides/api-reference/reference-data.md"
page_title: "Reference Data"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/reference-data"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/reference-data"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Reference Data / Lookup Table CRUD + Faceted Search (the 14-endpoint surface owned by ReferenceDataController — P-03 anchor)"
    - "Lookup Table (Master Data Management — P-03 anchor; was-empty pillar now anchored at the controller layer)"
  features:
    - "F-026"
  code_nodes:
    - "odd-platform java ReferenceDataController controller-method:createReferenceTable"
    - "odd-platform java ReferenceDataController controller-method:getLookupTableById"
    - "odd-platform java ReferenceDataController controller-method:updateLookupTable"
    - "odd-platform java ReferenceDataController controller-method:createColumnsForLookupTable"
    - "odd-platform java ReferenceDataController controller-method:getLookupTableField"
    - "odd-platform java ReferenceDataController controller-method:updateLookupTableField"
    - "odd-platform java ReferenceDataController controller-method:getLookupTableRowList"
    - "odd-platform java ReferenceDataController controller-method:getReferenceDataSearchFacetList"
    - "odd-platform java ReferenceDataController controller-method:updateReferenceDataSearchFacetList"
    - "odd-platform java ReferenceDataController controller-method:getReferenceDataSearchResults"
audience: [developer]
doc_claim_vs_code:
  - "Page (opening paragraph) claims 'All endpoints require authentication and respect the per-table RBAC permissions' — code shows reads have NO per-table RBAC: the 9 LOOKUP_TABLE_* security rules in SecurityConstants.java:114-354 cover only the 9 MUTATING endpoints; there is no LOOKUP_TABLE_*_READ permission anywhere in the repo (grep across odd-platform/ returns zero). The 6 read endpoints + the 4 search endpoints carry NO SecurityRule and are gated only by the global .authenticated() filter. Evidence: F-026 (read_endpoints_no_security_rule_six_of_fourteen) / SecurityConstants.java:114-354."
  - "Page (opening paragraph) implies per-table / per-owner RBAC scoping ('respect the per-table RBAC permissions'). Code uses the NO_CONTEXT resolver for all 9 LOOKUP_TABLE_* rules — a holder of e.g. LOOKUP_TABLE_UPDATE can modify ANY lookup table, not just those owned by their Owner; the permissions are NOT per-table-scoped. Evidence: operation:reference-data-lookup-table-crud (Authorization section) / SecurityConstants.java:114 (NO_CONTEXT) / F-026 (lookup_table_global_no_context_scoped_permissions_no_per_owner_scope)."
  - "Page documents PATCH /api/referencedata/table/{lookup_table_id}/columns/{column_id} (updateLookupTableField) as scoped to a specific {lookup_table_id}. Code drops the path param: ReferenceDataController.updateLookupTableField (ReferenceDataController.java:131-141) calls referenceDataService.updateLookupTableField(columnId, item) WITHOUT passing lookupTableId — a caller authorized on table A can PATCH a column belonging to table B by spoofing the URL. (Contrast updateLookupTable at L122-129, which DOES pass lookupTableId.) The page does not warn of this cross-table jump. Evidence: node odd-platform java ReferenceDataController controller-method:updateLookupTableField (ReferenceDataController.java:131) / F-026 (update_column_path_param_discarded_cross_table_jump)."
  - "Page is silent on the column PATCH/DELETE security-rule path mismatch. The OpenAPI spec serves single-column ops at .../columns/{column_id} (plural; openapi.yaml:3917, operationIds getLookupTableField/updateLookupTableField/deleteLookupTableField) and the doc page matches the spec — but SecurityConstants.java:337,341 registers the LOOKUP_TABLE_DEFINITION_UPDATE/_DELETE rules under .../column/{column_id} (singular). A PathPatternParser matcher for the singular path does not match the plural request path, so these two permission gates do not fire for the real endpoints — column PATCH/DELETE fall through to .authenticated() only. Primarily a code (spec-vs-security-config) defect, but it invalidates the page's blanket 'respect the per-table RBAC permissions' claim for two more endpoints. Evidence: openapi.yaml:3917 vs SecurityConstants.java:337,341."
  - "Endpoint-count framing: page header + intro say '16 endpoints'. The concept/feature sidecars count '14 paths' (operation:reference-data-lookup-table-crud title; F-026 entry_point '14-path controller-class surface'). Reconciled, not contradictory: 16 = the 16 distinct operationIds (4+4+4+4) the page tabulates; 14 = distinct URL paths (GET and the mutating verb share a path on table/{id}, table/{id}/columns/{id}, and table/{id}/data/{id}). The live lookup-tables.md feature page also states '16 endpoints' (per F-026 entry text), so the published manual is internally consistent on 16. Not a drift defect; recorded for the count-reconciliation trail. Evidence: F-026 entry_point / operation:reference-data-lookup-table-crud."
maintainer_curated: false
---

# Reference Data — doc understanding

This developer-reference page is the HTTP-API index for the Master Data Management pillar's single user-facing surface — Lookup Tables — served under `/api/referencedata/` by the Spring `ReferenceDataController` (confirmed: 10 controller-method nodes read via graph-node; `ReferenceDataController.java`). It tabulates the operations as four groups (Table / Column / Row CRUD + faceted Search) with method, path, operationId, request body, and the mutating-endpoint RBAC permission. It maps cleanly to feature `F-026` (Lookup Tables / Reference Data Management, pillar P-03) and to the concept `operation:reference-data-lookup-table-crud`. The per-endpoint RBAC mapping in the page's tables is accurate against `SecurityConstants.java:114-354` (createReferenceTable→`LOOKUP_TABLE_CREATE`, updateLookupTable→`LOOKUP_TABLE_UPDATE`, the DEFINITION_* and DATA_* families, etc.).

The page's weakness is its **opening blanket claim** — "All endpoints require authentication and respect the per-table RBAC permissions." Code shows the RBAC is (a) absent on all read + search endpoints (no `LOOKUP_TABLE_*_READ` permission exists; only 9 mutating rules are registered) and (b) `NO_CONTEXT`-scoped, i.e. global rather than per-table/per-owner. Two further confirmed code defects sit under endpoints the page presents as table-scoped: `updateLookupTableField` discards the `lookup_table_id` path param at the controller→service boundary (`ReferenceDataController.java:131-141`), enabling a cross-table column PATCH; and the column PATCH/DELETE security rules are registered under the singular `/column/{column_id}` path while the spec + doc + controller use plural `/columns/{column_id}` (`openapi.yaml:3917` vs `SecurityConstants.java:337,341`), so those gates do not match the real request path. All four drift entries above are DOC-GAP / SEC-candidate material for the maintainer; several are already enumerated as F-026 drift facets.

## Maintainer notes
