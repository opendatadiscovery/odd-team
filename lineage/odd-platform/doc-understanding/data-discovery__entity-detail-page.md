---
doc_page: "docs/data-discovery/entity-detail-page.md"
page_title: "Data entity detail page"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/entity-detail-page"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data-Entity Detail-Page Shell (DataEntityDetails React component)"
    - "Read Data Entity Details (centerpiece read)"
    - "Popular Entities Ranking"
    - "view_count UPDATE→READ loop closed; trivially inflatable; no anti-abuse signal"
  features:
    - "F-176"
    - "F-177"
  code_nodes:
    - "odd-platform ts components/DataEntityDetails react-component:DataEntityDetails"
    - "odd-platform ts components/DataEntityDetails/Overview react-component:Overview"
  audience: [operator, developer]
doc_claim_vs_code:
  - "Page lists 'view count' as a neutral General-sidebar identity field (line 28) and never states that opening the detail page registers as +2, not +1 — code: every page-open fires fetchDataEntityDetails TWICE because the useEffect dep-array contains details.status?.status, which is itself populated by the fetch's fulfilled action (DataEntityDetails.tsx:56-64; first render status=undefined→real, second render re-fires). Each call is a bare view_count+1 UPDATE (ReactiveDataEntityRepositoryImpl.java:174-178). Net +2 per page-open, empirically pinned by probe P-004. Evidence: entitie:data-entity-detail-page-shell ('2x fetchDataEntityDetails — the LSN-017 doubling; 6 backend HTTP requests per mount'); invariant:view-count-update-read-loop-closed-trivially-inflatable-no-anti-abuse-signal. This is the LSN-017 surface — the operator-critical caveat (a self-inflating counter) the page omits."
  - "Page presents view_count purely as display metadata and gives no caveat that it is the SOLE, trivially-inflatable ranking signal for the home-page Popular strip — code: listPopular orders exclusively by VIEW_COUNT.sort(DESC) with only an id-DESC tiebreaker (ReactiveDataEntityRepositoryImpl.java:633), no rate-limit, no idempotency key, no anti-abuse signal, and no index on view_count. A scripted read loop (anonymous under DISABLED auth) pushes any entity to the top of GET /api/dataentities/popular. Evidence: invariant:view-count-update-read-loop-closed-trivially-inflatable-no-anti-abuse-signal; entitie:popular-entities-ranking. An operator reading the General panel cannot tell that the number they see is the inflation target documented in the view_count loop."
  - "Page states (line 28) that the General panel shows 'source-side timestamps' alongside view count — operator-observable framing is accurate; backend confirms the centerpiece read returns the full 34-field DataEntityDetails payload including viewCount and source timestamps (operation:read-data-entity-details-centerpiece-read). NOT drift — recorded as a confirmed-accurate claim."
maintainer_curated: false
---

# Data entity detail page — doc understanding

This page is the canonical operator reference for the **composition** of the per-entity detail page: the two-column Overview tab (12 sub-panels), the per-class panel/tab matrix, the class/type header badges, sidebar Tags/Terms/Groups truncation, and the per-panel permission map. It binds end-to-end to the substrate: the page-as-a-whole is the `DataEntityDetails` React shell (concept `entitie:data-entity-detail-page-shell`, node `odd-platform ts components/DataEntityDetails react-component:DataEntityDetails`); the Overview composition it describes is feature **F-176** (`Overview.tsx`, two-column xs=9/xs=3 grid, class-conditional stats and DQ-report, per-panel `WithPermissionsProvider`); the "Class and type badges" section is feature **F-177** (`DataEntityDetailsHeader.tsx`, enum-driven class chips + freeform type chip, no per-class tooltip). The page's permission tables match F-176/F-177's per-panel permission sets, and the run-class "no main-column stats panel renders" caveat (lines 47, 51) matches F-176's class-conditional switch reality.

The high-value finding is the **view_count surface**. The General sidebar panel (line 28) lists "view count" as an ordinary identity field. This is the operator-facing surface of **LSN-017**: every page-open fires `fetchDataEntityDetails` twice (`DataEntityDetails.tsx:56-64` — the `details.status?.status` dep-array entry, itself set by the fetch), and each fetch is a bare `view_count + 1` UPDATE (`ReactiveDataEntityRepositoryImpl.java:174-178`), so a single visit registers as **+2**. The same counter is the sole, un-throttled, un-indexed ranking signal for the home-page Popular strip (`ReactiveDataEntityRepositoryImpl.java:633`). The page documents the field but omits both caveats — the self-doubling and the inflatability — which is exactly the LSN-001/LSN-002 class of operator-critical omission this layer exists to surface.

No dedicated substrate concept was found for the page's Tags/Terms/Groups sidebar **sort-order defect** (the "ordering undefined / stringify comparator" warnings, lines 96-102) or for the sidebar **truncation caps** themselves; the page's own admonitions are the current source of truth for those behaviours, and they are not contradicted by any confirmed node. `describes` is left at the six confirmed bindings rather than padded with weak matches.

## Maintainer notes
