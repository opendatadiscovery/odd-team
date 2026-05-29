---
doc_page: "docs/data-discovery/catalog-overview.md"
page_title: "Catalog Overview page"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/catalog-overview"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Directory"
    - "Popular Entities Ranking"
    - "User-Owner Mapping"
    - "ODD Platform Home-Page Visitors"
    - "Tag"
  features:
    - "F-141"
  code_nodes:
    - "odd-platform ts react-component:Overview"
    - "odd-platform java DataEntityController controller-method:getPopular"
    - "odd-platform ts react-component:DataEntitiesUsageInfo"
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Page describes the Recommended → Popular column as 'the most-viewed or most-used data entities across the catalog' (catalog-overview.md:52) but omits that the ranking signal is view_count DESC ALONE and that the loop is self-reinforcing and trivially inflatable: clicking any Popular/Recommended tile navigates to /dataentities/{id}/overview which mounts DataEntityDetails → fires getDataEntityDetails which UPDATEs data_entity.view_count on every read, with no rate-limit, no idempotency key, no auth gate, no anti-abuse signal. A scripted detail-read loop (anonymous under auth.type=DISABLED) pumps any chosen entity to the top of the Popular column. This is the F-001 / view_count loop. Evidence: operation:list-popular-data-entities (concepts/detail/operations/list-popular-data-entities.yaml) + getPopular sidecar understanding — DataEntityController.java:307-313 → DataEntityServiceImpl.java:227-231 → ReactiveDataEntityRepositoryImpl.java:629-649 (DATA_ENTITY.VIEW_COUNT.sort(DESC) sole signal); confirms REFACTOR-201. Operator-critical caveat (LSN-001/LSN-002 class) — DOC-GAP candidate."
maintainer_curated: false
---

# Catalog Overview page — doc understanding

This page documents the platform's home/landing surface — the **Catalog Overview Home Page** feature `F-141` (`odd-platform ts react-component:Overview`, `Overview.tsx`), which composes six independent landing widgets (Main search, Top tags, Domains, the per-class Entities report, Directory, and the conditional Owner association / Recommended band) into one route. The Entities report card grid is `odd-platform ts react-component:DataEntitiesUsageInfo`; the Directory band documents the **Directory** concept; the Top tags chip strip documents the **Tag** concept; the Owner association section + Recommended panel document the **User-Owner Mapping** concept and the **ODD Platform Home-Page Visitors** audience. The Recommended → Popular column documents the **Popular Entities Ranking** concept, backed by `GET /api/dataentities/popular` (`odd-platform java DataEntityController controller-method:getPopular`, confirmed via graph-node — `DataEntityController.java:307`).

The page is notably accurate on the conditional-rendering caveats the substrate previously flagged as drift: it now correctly states the Recommended panel is **hidden** under `auth.type=DISABLED` (matching the `Overview.tsx` auth-mode gate) and that tiles open the entity **Overview tab** (matching the `dataEntityDetailsPath` default path). Its `exclude_from_search` warning hint (catalog-overview.md:61) matches code exactly — `/popular` is the sole list-shape that ignores the predicate (Popular Entities Ranking concept weaknesses). The one remaining drift is an **omission**: the Popular column's ranking is `view_count DESC` alone and the click→view_count→ranking loop is trivially inflatable with no rate-limit or auth gate (the F-001 loop) — an operator-critical caveat the page does not surface (see `doc_claim_vs_code`).

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
