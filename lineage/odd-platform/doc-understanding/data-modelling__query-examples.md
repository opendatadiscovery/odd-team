---
doc_page: "docs/data-modelling/query-examples.md"
page_title: "Query Examples"
live_url: "https://docs.opendatadiscovery.org/features/data-modelling/query-examples"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-modelling/query-examples"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Query Example (operator-curated SQL/KQL/Spark snippet attached to data entities and terms)"
    - "Query Example CRUD + Faceted Search (the 13-endpoint surface owned by QueryExampleController)"
    - "Cross-controller permission split — QueryExample owns _CREATE/_UPDATE/_DELETE, DataEntity owns _DATASET_*, Term owns _TERM_* link permissions (pattern invariant from batch V)"
    - "F-004 stored-XSS extends to QueryExample (4th Markdown rendering surface — data-entity description + dataset-field description + term definition + query-example definition+query)"
    - "Markdown Rendering Pipeline (rehype-raw without rehype-sanitize)"
  features:
    - "F-025"
    - "F-132"
    - "F-155"
  code_nodes:
    - "odd-platform java QueryExampleController controller-method:createQueryExamples"
    - "odd-platform java QueryExampleController controller-method:updateQueryExample"
    - "odd-platform java QueryExampleController controller-method:deleteQueryExample"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleList"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleDetails"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleByDatasetId"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleByTermId"
    - "odd-platform java QueryExampleController controller-method:queryExamplesSearch"
    - "odd-platform java QueryExampleController controller-method:getQueryExampleSearchSuggestions"
    - "odd-platform java DataEntityController controller-method:deleteQueryExampleToDatasetRelationshipNew"
    - "odd-platform ts react-component component:QueryExampleDetailsContainer"
    - "odd-platform ts react-component component:QueryExampleDetailsTabs"
audience: [operator, developer, data-consumer]
doc_claim_vs_code:
  - "LOW drift (endpoint-count understatement) — page §API surface (docs/data-modelling/query-examples.md:46) states the API Reference covers '16 endpoints across three groups'. Code says the true total is 17: 13 on QueryExampleController + 2 on DataEntityController (createQueryExampleToDatasetRelationshipNew / delete...) + 2 on TermController (create/deleteQueryExampleToTermRelationship). The concept node explicitly flags '16 endpoints' as off-by-one. Evidence: entitie:query-example / concepts/detail/entities/query-example.yaml:33-41. NOT VERIFIED whether the linked API-reference page (docs/developer-guides/api-reference/query-examples.md, linked from page line 46) repeats the same '16' figure — re-confirm the endpoint count there when that page is analysed."
  - "NO operator-harm drift on the caveat surface — the page's three load-bearing caveats are PRESENT and code-accurate, a strong positive: (1) stored-XSS / no-HTML-sanitisation danger admonition matches rehype-raw-without-rehype-sanitize on the shared Markdown.tsx (invariant:f-004-stored-xss-extends-to-query-example-fourth-markdown-surface; Markdown.tsx:1-127, QueryExampleController.java:26-42, QueryExampleServiceImpl.java:42); (2) open-read posture (every authenticated user reads every snippet) matches the 10-of-13 endpoints carrying no SecurityRule (operation:query-example-crud-and-faceted-search read-collaborative posture); (3) no-Activity-Feed audit-silence matches QueryExampleServiceImpl carrying no @ActivityLog (operation:query-example-crud-and-faceted-search SIDE EFFECTS)."
  - "NO drift on the details-page caveats — the page's `?tab=` empty-body warning and the Linked-Terms-badge understatement info admonition both match code exactly. Empty-body: QueryExampleDetailsContainer.tsx:30-31,74,80,85 + QueryExampleDetailsTabs.tsx:38 (arbitrary `?tab=` → no matching render branch → header with blank body, findIndex returns -1 → no active tab). Badge understatement: QueryExampleDetailsContainer.tsx:69 (linkedEntitiesHint = linkedEntities.pageInfo.total, correct across pages) vs :70 (linkedTermsHint = linkedTerms.items.length, understates if paginated). Both surfaced as F-132 observed_vs_expected facets."
  - "NO drift on the cross-controller permission warning — the page's warning that the 7 QUERY_EXAMPLE_* permissions are wired across three controllers matches invariant:cross-controller-permission-split-batch-v-pattern: QueryExampleController gates _CREATE/_UPDATE/_DELETE (SecurityConstants.java:112-113,312-317), DataEntityController gates _DATASET_CREATE/_DELETE (SecurityConstants.java:318-324), TermController gates _TERM_CREATE/_DELETE (SecurityConstants.java:187-192). The doc-side observation in that invariant (the flat grid hides the resolver/scope per permission) is itself the gap this page partially closes by naming the three controllers explicitly."
maintainer_curated: false
---

# Query Examples — doc understanding

This page is the operator + developer + data-consumer surface for Query
Examples — operator-curated SQL/KQL/Spark snippets carrying a `definition`
(prose) and a `query` (code body), linkable to data entities and glossary
terms. It maps to feature **F-025 (Query Examples — CRUD + Faceted Search)**
for the catalog/search/CRUD surface, **F-132** for the three-tab details page
(`?tab=` URL state + count-hint badges), and **F-155** for the cross-pillar
Term ↔ Query-Example linkage; the implementing code is `QueryExampleController`
(13 endpoints, confirmed via graph-node) plus the dataset/term link endpoints
on `DataEntityController` / `TermController`. Concept bindings: `Query Example`,
`Query Example CRUD + Faceted Search`, the `cross-controller permission split`
invariant, and the `F-004 stored-XSS` / `rehype-raw-without-rehype-sanitize`
invariants.

The page is unusually well-grounded against the code: every one of its
operator caveats (stored-XSS via the unsanitised Markdown renderer, the
open-read posture on all read/search endpoints, the absence of any
Activity-Feed audit trail, the `?tab=` empty-body footgun, the Linked-Terms
badge understatement, and the three-controller permission wiring) is confirmed
against a graph node with `file:line` evidence — these are correct, not drift.
The single genuine drift is a LOW-severity count understatement: the API
surface section says "16 endpoints" where the code total is 17 (the concept
node flags the "16" as an off-by-one).

## Maintainer notes
