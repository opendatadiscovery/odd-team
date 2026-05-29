---
doc_page: "docs/developer-guides/api-reference/glossary.md"
page_title: "Glossary"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/glossary"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Dictionary tab — Term catalog browse surface (UI shell for P-06 Data Glossary)"
    - "Term-mention Syntax `[[Namespace:TermName]]`"
    - "NAMESPACE_CREATE + TAG_CREATE side-doors via TermController unguarded paths (TERM_CREATE / TERM_UPDATE / TERM_TAGS_UPDATE bypass the dedicated CREATE permissions)"
  features:
    - "F-002"
    - "F-024"
    - "F-154"
    - "F-152"
  code_nodes:
    - "odd-platform java TermController controller-method:getTermsList"
    - "odd-platform java TermController controller-method:createTerm"
    - "odd-platform java TermController controller-method:getTermDetails"
    - "odd-platform java TermController controller-method:updateTerm"
    - "odd-platform java TermController controller-method:getTermByNamespaceAndName"
    - "odd-platform java TermController controller-method:getTermLinkedEntities"
    - "odd-platform java TermController controller-method:getTermLinkedColumns"
    - "odd-platform java TermController controller-method:getTermLinkedTerms"
    - "odd-platform java TermController controller-method:getTermSearchResults"
    - "odd-platform java TermController controller-method:getTermSearchFacetList"
    - "odd-platform java TermController controller-method:updateTermSearchFacets"
    - "odd-platform java TermController controller-method:getTermSearchSuggestions"
    - "odd-platform java TermController controller-method:createTermOwnership"
    - "odd-platform java TermController controller-method:createTermTagsRelations"
audience: [developer]
doc_claim_vs_code:
  - "Page documents POST /api/terms (createTerm) and PUT /api/terms/{term_id} (updateTerm) as plain term writes gated by the term permissions; code shows both invoke namespaceService.getOrCreate(namespaceName) (TermServiceImpl.java:103,138), so a caller holding only TERM_CREATE / TERM_UPDATE can create a brand-new platform-wide namespace WITHOUT the dedicated NAMESPACE_CREATE permission. The page omits this RBAC side-door. Evidence: invariant:namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths / TermServiceImpl.java:101-145, SecurityConstants.java:111,174-176."
  - "Page says PUT /api/terms/{term_id}/tags 'Tags that don't yet exist on the platform are created' but does not warn that this bypasses the dedicated TAG_CREATE permission: TermServiceImpl.upsertTags calls tagService.getOrCreateTagsByName (TermServiceImpl.java:257), so a caller holding only TERM_TAGS_UPDATE can mint new platform-wide tags. Evidence: invariant:namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths / TermServiceImpl.java:253-264, SecurityConstants.java:185-186; createTermTagsRelations node (TermController.java:129)."
  - "Page presents POST /api/dataentities/{data_entity_id}/terms (addDataEntityTerm) as the term-to-entity linking endpoint, gated by the documented DATA_ENTITY_ADD_TERM permission. Code registers that permission at the SINGULAR path /api/dataentities/{id}/term while OpenAPI / this page expose the PLURAL /api/dataentities/{id}/terms — the AuthorizationCustomizer path-matcher never matches and the gate never fires. Evidence: F-002 (auth_layer_hides_endpoint)."
maintainer_curated: false
---

# Glossary — doc understanding

This is the developer/API-reference page for the Business Glossary HTTP surface: term CRUD + natural-key lookup, term-side linkage (linked entities / columns / terms + term-to-term writes), resource-side linkage owned by the data-entity and dataset-field controllers, the multi-step faceted `search_id` flow, and term ownership/tags. Every documented endpoint maps to a confirmed `TermController` controller-method node (e.g. `createTerm` at `TermController.java:69`, `createTermTagsRelations` at `TermController.java:129`); the faceted-search table is the backend of F-024 (Term Search & Browse / Dictionary tab), the CRUD table backs F-154 (Term Create/Edit form), the linked-terms read backs F-152, and the resource-side linkage table is the surface of F-002 (Term linking). The natural-key lookup `getTermByNamespaceAndName` is the endpoint the UI `[[Namespace:TermName]]` description-mention resolver (`useTermWiki`) calls — hence the description-text-vs-direct-link distinction the page points at.

The high-value drift is RBAC silence: three documented write endpoints (`createTerm`, `updateTerm`, `createTermTagsRelations`) and the term-to-entity link endpoint each have an authorization behaviour the page does not surface — two `getOrCreate` side-doors that bypass the dedicated `NAMESPACE_CREATE` / `TAG_CREATE` permissions (confirmed via `invariant:namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths`, primary-source `TermServiceImpl.java:101-145,253-264`), and a never-firing `DATA_ENTITY_ADD_TERM` gate caused by a singular/plural path mismatch (confirmed via F-002). All three are LSN-001/LSN-002-class: an operator reasoning additively about permissions from this page would author a more-permissive-than-expected policy. A fourth, lower-severity observation tied to F-002 (`term_create_update_status_code_drift_controller_returns_200_spec_201`) is a spec-vs-controller status drift rather than a page-vs-code claim, so it is not logged as page drift here.

## Maintainer notes
