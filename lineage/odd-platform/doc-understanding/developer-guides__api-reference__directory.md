---
doc_page: "docs/developer-guides/api-reference/directory.md"
page_title: "Directory"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/directory"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/directory"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Directory"
    - "Browse Data Entities by Hierarchy (4 levels)"
    - "ODDRN"
  features: []
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:DirectoryController"
    - "odd-platform java DirectoryController controller-method:getDataSourceTypes"
    - "odd-platform java DirectoryController controller-method:getDirectoryDatasourceList"
    - "odd-platform java DirectoryController controller-method:getDatasourceEntityTypes"
    - "odd-platform java DirectoryController controller-method:getDatasourceEntities"
audience: [developer]
doc_claim_vs_code:
  - "ALIGNED (code-confirmed) — the page's four-endpoint table matches the controller exactly. The four operation IDs (`getDataSourceTypes`, `getDirectoryDatasourceList`, `getDatasourceEntityTypes`, `getDatasourceEntities`), all GET, all under `/api/directory`, are the four controller-method nodes (getDataSourceTypes at DirectoryController.java:23, getDatasourceEntities at :36; operation_id metadata matches verbatim). The understanding section confirms `DirectoryController` implements the OpenAPI-generated `DirectoryApi` and forwards levels 1-3 to `DirectoryService` and level 4 to `DataEntityService.getDataEntitiesByDatasourceAndType` — so the page's 'Delegates to DataEntityService' note for level 4 is exact. Evidence: node odd-platform java org.opendatadiscovery.oddplatform.controller controller:DirectoryController (understanding + couplings ← DirectoryController.java:42); method nodes DirectoryController.java:23,36."
  - "ALIGNED (code-confirmed) — the page's level-1 claim that display names + entity counts are 'derived at request time by parsing the ODDRN ... through oddrn-generator's Generator.parse(...)' matches the code: DirectoryServiceImpl groups by ODDRN prefix via org.opendatadiscovery.oddrn.Generator and sources counts from ReactiveDataEntityRepository.getCountByDataSources at request time (no cache). Evidence: node DirectoryController sidecar dependencies_semantic.requires-feature ← DirectoryServiceImpl.java:25-27,43,103,114 (Generator usage) + :47-50 (getCountByDataSources + dataSourceRepository.list)."
  - "OMISSION (LSN-002-class silent fallback, LOW, code-confirmed, undocumented on BOTH this page and the feature page) — the page tells the developer level-1 display names are 'derived ... by parsing the ODDRN', but does NOT state that a parse failure is swallowed: DirectoryServiceImpl.getDataSourcePrefix (and getDataSourceName) catch ALL exceptions and return the `Other`/UNKNOWN_DATASOURCE_TYPE sentinel, so a source whose ODDRN cannot be parsed silently buckets under 'Other' rather than erroring. A developer reading only this api-reference page is not told that level 1 has an 'Other' bucket nor that ODDRN-parse errors are non-fatal-and-silent. The linked feature page (data-discovery/directory.md) documents the ODDRN-property reflection and the owner-scoping/reconnaissance caveat but ALSO does not mention the silent 'Other' fallback. Evidence: node DirectoryController sidecar implicit_adrs[2] + finding:bugs_limitations_corner_cases[1] ← DirectoryServiceImpl.java:101-110,112-122; DirectoryTest.java:42-43,79-85 asserts the 'other' bucket. DOC-GAP candidate: add one line to the level-1 row (or a note) stating sources with an unparseable ODDRN are grouped under 'Other' and the parse error is logged, not surfaced."
  - "ALIGNED (this api-reference page is the MORE-correct of the two Directory surfaces) — the page calls level 3 'entity types' and names the operation getDatasourceEntityTypes; the code returns DataEntityType (TABLE/FILE/STREAM/...), so the api-reference wording is correct. The controller sidecar's docs_link_semantic flags a separate drift on the FEATURE page (data-discovery/directory.md L30 calls level 3 'Data Entity classes', conflating DataEntityType with the distinct DataEntityClass dimension) — that finding belongs to the feature page, not this one; recorded here only to note this page does not share that drift. Evidence: node DirectoryController sidecar docs_link_semantic.doc_drift_findings[0] ← DirectoryApi.java:145 (DataEntityType, not DataEntityClass)."
maintainer_curated: false
---

# Directory — doc understanding

This is the developer-facing API-reference page for the Directory feature: a four-row table of the four `GET` endpoints under `/api/directory` that back the catalogue's hierarchical drill-down (data source type → data source → entity type → entity), one endpoint per level. It binds to the `Directory` entity concept and the `Browse Data Entities by Hierarchy (4 levels)` operation concept, and to `ODDRN` (the prefix that level 1 groups by). The implementing code is `DirectoryController` (confirmed via graph-node: implements the OpenAPI-generated `DirectoryApi`, forwards levels 1-3 to `DirectoryService` and level 4 to `DataEntityService.getDataEntitiesByDatasourceAndType`) and its four controller-method nodes; the four operation IDs and the level-4 `DataEntityService` delegation on the page match the controller verbatim. No Directory `F-NNN` feature node was confirmable via graph-search, so `describes.features` is left empty rather than bound to a weak guess. Audience is developer (an endpoint/operation-ID reference table); the operator caveats live on the cross-linked feature page.

The page is code-accurate on every positive claim it makes (four endpoints, operation IDs, request-time ODDRN parsing via `Generator`, level-4 delegation). The single substantive gap is an LSN-002-class **silent fallback omission**: level-1 display names are said to come from parsing the ODDRN, but neither this page nor the linked feature page tells the reader that an unparseable ODDRN is swallowed (`catch Exception`) into the `Other`/`UNKNOWN_DATASOURCE_TYPE` bucket (`DirectoryServiceImpl.java:101-110`). Logged above as a LOW DOC-GAP candidate. The level-3 terminology on THIS page ("entity types", `DataEntityType`) is correct — the `DataEntityType`-vs-`DataEntityClass` drift the controller sidecar records is a *feature-page* finding (`data-discovery/directory.md`), not a finding against this page.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
