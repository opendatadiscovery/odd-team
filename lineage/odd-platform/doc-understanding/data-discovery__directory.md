---
doc_page: "docs/data-discovery/directory.md"
page_title: "Directory"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/directory"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/directory"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Directory"
    - "Browse Data Entities by Hierarchy (4 levels)"
    - "ODDRN"
    - "Reflection-based ODDRN property extractor — infrastructure-revealing"
  features:
    - "F-023"
  code_nodes:
    - "odd-platform java DirectoryController controller-method:getDataSourceTypes"
    - "odd-platform java DirectoryController controller-method:getDirectoryDatasourceList"
    - "odd-platform java DirectoryController controller-method:getDatasourceEntityTypes"
    - "odd-platform java DirectoryController controller-method:getDatasourceEntities"
  audience: [operator, data-consumer]
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Page level-3 row (directory.md:30) describes the third drill-down level as 'the distinct Data Entity CLASSES' and exemplifies them as Dataset / Transformer / Transformer Run / Quality Test / Consumer / Input / Group / Relationship — i.e. ODD's DataEntityClass dimension. The backing endpoint getDatasourceEntityTypes returns the DataEntityType dimension (TABLE/FILE/STREAM/JOB/MODEL/...), a SEPARATE axis from class. Code returns TYPE, page labels it CLASS — operators familiar with the ODD class-vs-type distinction may mis-read level 3. Evidence: odd-platform java DirectoryController controller-method:getDatasourceEntityTypes / DirectoryController.java:5,47 (returns Flux<DataEntityType>) + DirectoryServiceImpl.java:124-127 (DataEntityTypeDto.findById) — severity LOW (carried from DirectoryController sidecar doc_drift_findings[1], still present at doc HEAD 30795b4)."
  - "RECONCILED (positive drift): the DirectoryController controller-class sidecar (enriched 2026-05-20, commit 9ac6436e) records the live page as SILENT on authorization / owner-scoping / the level-4 count-vs-list divergence / the ODDRN-property infrastructure leak (doc_drift_findings[0] MEDIUM, [2] LOW; SHB-013 Next step 3 'DOC-NNN HIGH'; concepts.yaml entity:directory line 1586). At doc HEAD 30795b4 the page NOW documents all of these: the warning hint block (directory.md:43-45) discloses unscoped catalog-read enumeration + host/database/port/account/warehouse/cluster/topic/project reflection + the DISABLED-mode anonymous reach; the level-4 count-badge subsection (directory.md:47-51) documents the EXCLUDE_FROM_SEARCH page-vs-count divergence; the 'all'-literal subsection (directory.md:53-62) documents the level-3 routing literal. These prior drift findings are RESOLVED by the page; the corresponding doc-gaps entries for this page are stale. Code evidence the page now matches: invariant:reflection-property-extractor-infrastructure-revealing (DirectoryServiceImpl.java:153-171) + security.owner_scoping BYPASSES (DirectoryServiceImpl.java:48,91-99,86) + invariant data-entity-page-vs-count-predicate-divergence-exclude-from-search (ReactiveDataEntityRepositoryImpl.java:595-613 vs 616-627)."
maintainer_curated: false
---

# Directory — doc understanding

This page is the operator/data-consumer guide to the **Directory** — the catalog's hierarchy-driven browse surface (data source type → data source → entity type → entity), the browse counterpart to query-driven Search. It maps to feature **F-023** and the four `DirectoryController` GET methods, one per drill-down level: `getDataSourceTypes` (level 1, `/api/directory`), `getDirectoryDatasourceList` (level 2), `getDatasourceEntityTypes` (level 3), `getDatasourceEntities` (level 4, paged) — all confirmed via graph-node. The page documents UI route shapes (`/directory/{type-prefix}/...`); the backing API paths differ (`/api/directory/datasources?prefix=...`, `.../{id}/types`, `.../{id}`), per concept `Browse Data Entities by Hierarchy (4 levels)`.

The page's three "Known limitations and operator caveats" subsections each trace to a code-confirmed concept/invariant: the level-2 ODDRN-property reflection (invariant `reflection-property-extractor-infrastructure-revealing`, `DirectoryServiceImpl.java:153-171`), the level-4 count-badge divergence (invariant `data-entity-page-vs-count-predicate-divergence-exclude-from-search`, `ReactiveDataEntityRepositoryImpl.java:595-613` page-path vs `616-627` count-path), and the platform-wide unscoped read posture surfaced in the security warning hint (`security.owner_scoping = BYPASSES`). These are the LSN-001/LSN-002-class operator caveats now written next to the feature — a positive reconciliation: the DirectoryController sidecar's 2026-05-20 doc-drift findings (page silent on these) are resolved at doc HEAD `30795b4`.

One residual drift survives (severity LOW, see frontmatter): the level-3 row labels the dimension "Data Entity classes" with class-name examples, but the backing endpoint returns the `DataEntityType` axis — a class-vs-type vocabulary mismatch confirmed against `DirectoryController.java:5,47`.

## Maintainer notes
First analysis (2026-05-29, doc HEAD 30795b4). The high-value finding here is the RECONCILIATION: the page has been substantially improved since the DirectoryController sidecar's 2026-05-20 enrichment, which repeatedly asserts the page is silent on authorization/owner-scoping/count-divergence/`all`-literal. Those are now all documented. The stale claims live in: (a) DirectoryController controller-class sidecar `docs_link_semantic.doc_drift_findings[0]` (MEDIUM) and `[2]` (LOW) + `coherence_check.strengthens` notes asserting "page says NOTHING about authorization"; (b) `concepts.yaml` `entitie:directory` line 1586 ("Live data-discovery/directory doc page does NOT warn operators that Directory is platform-wide and unscoped"); (c) SHB-013 Next step 3 ("DOC-NNN HIGH — page must disclose the visibility model"). A maintainer refreshing those reducers should down-rank/close the corresponding doc-gaps; the `doc_drift_findings[0/2]` are now historical. The ONLY live doc-gap for this page is the level-3 TYPE-vs-CLASS wording (`doc_drift_findings[1]`, LOW) — a candidate to fix on the page (relabel "Data Entity classes" → "data entity types", or clarify both axes).
