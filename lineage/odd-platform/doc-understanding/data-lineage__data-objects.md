---
doc_page: "docs/data-lineage/data-objects.md"
page_title: "Data Objects Lineage"
live_url: "https://docs.opendatadiscovery.org/features/data-lineage/data-objects"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-lineage/data-objects"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Traverse Lineage Graph (recursive-CTE)"
    - "Get data entity group lineage (flat graph per DEG member, inner DEGs suppressed)"
    - "DEG-Anchored Lineage (group-internal co-membership view)"
    - "Lineage Canvas (d3-hierarchy tree + crossEdges overlay)"
    - "LoadMore Lineage Expansion (depth-1 fan-out + slice monotonic accumulation)"
  features:
    - "F-005"   # Query params / depth — downstream default-depth handling
    - "F-016"   # Group lineage section — DEG-anchored lineage
    - "F-055"   # Lineage depth — UI control vs API contract section
    - "F-186"   # View-mode toggle (Compact / Full) section
  code_nodes:
    - "odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage"
    - "odd-platform java DataEntityController controller-method:getDataEntityUpstreamLineage"
    - "odd-platform java DataEntityController controller-method:getDataEntityGroupsLineage"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Lineage depth §) says the unset-lineage_depth branch is 'unreachable from the UI' and 'the platform's current behaviour on unset is undefined (treat the parameter as required when calling directly)'. Code is sharper than 'undefined': the parameter is a primitive int; a missing value autoboxes null -> NullPointerException -> HTTP 500. The page softens a hard crash into 'undefined behaviour', and the live API-reference's 'Unset returns the platform's default depth' is outright unimplementable. Evidence: F-005 (Downstream lineage traversal — default depth handling); operation:traverse-lineage-graph-recursive-cte (the null-lineage_depth NPE is unreachable from the UI); getDataEntityDownstreamLineage.md:bugs_limitations_corner_cases.[0-2] (severity HIGH)."
  - "Page never mentions authorization on any lineage endpoint. Code: all three endpoints (per-entity /downstream, /upstream, and DEG /lineage) have NO SECURITY_RULES entry and fall through to the catch-all `.pathMatchers(\"/**\").authenticated()`; neither service performs an owner/anchor check. Any authenticated user who knows an entity-id or DEG-id reads the full reachable cross-owner lineage subgraph (lineage edges leak other teams' pipeline structure). The DEG path's blast radius is strictly wider (cross-owner co-membership enumeration). Evidence: F-016 finding (1) co-membership leakage; concepts.yaml DataEntity security gap 'Lineage-graph cross-owner enumeration (batch F)' citing getDataEntityDownstreamLineage.md:security.known_security_gaps.[0,1] (HIGH); LineageServiceImpl.java:54-57 has no AuthIdentityProvider field."
  - "Page (Group lineage §) frames the 404-on-empty-DEG as a single condition ('a DEG that exists but has zero members'). Code raises the SAME NotFoundException(\"Data entity group\", id) for THREE distinct conditions: (a) DEG id does not exist, (b) DEG exists with zero members, (c) the path-parameter id is a Data Entity that is not a DEG at all. The page documents only condition (b); operators debugging a 404 cannot discriminate. Evidence: F-016 finding (3) 404 conflation; operation:get-data-entity-group-lineage-flat-graph gap (d); LineageServiceImpl.java:62."
  - "Page (Group lineage §) describes the endpoint as returning 'the lineage union across those eighteen child entities' but does not disclose two carve-outs the code applies. (i) Inner DEGs are silently suppressed — edges/metadata where either endpoint is itself a DEG are filtered out, with the source comment `// Remove this when we will support inner DEGs for DEG lineage` (LineageServiceImpl.java:71-75); a DEG containing nested DEGs returns them missing. (ii) The edge filter requires BOTH endpoints in the member set (getLineageRelations, ReactiveLineageRepositoryImpl.java:112-119), so edges exiting/entering the DEG (to non-member parents / from non-member children) are dropped — the operator cannot see that the DEG has external upstream sources or downstream consumers. Evidence: F-016 findings (2) inner-DEG suppression + (4) bidirectional edge filter; operation:get-data-entity-group-lineage-flat-graph gaps (c),(e)."
  - "Page (Lineage depth §) correctly states there is no @Max cap and the URL `?d=` is forwarded unclamped, but omits the downstream cost the code makes operator-critical: the recursive CTE has NO cycle guard (only the depth bound + outer selectDistinct terminates it), so diamond/DAG topologies amplify intermediate rows before dedup, and the full graph is `.collectList()`-materialised in JVM heap before serialisation. A deep walk on a branchy graph is a memory + CPU amplification vector, not only 'deep recursion'. Evidence: operation:traverse-lineage-graph-recursive-cte ('No cycle guard in the recursion'; 'full graph is .collectList()-materialised in heap'); concepts.yaml performance gaps citing getDataEntityDownstreamLineage.md:performance.hot_paths.[0-2] + known_performance_gaps.[0-4]; getDataEntityDownstreamLineage.md:bugs_limitations_corner_cases.[3,7]."
  - "Page (Query parameters §) documents `expanded_entity_ids` without a size caveat. Code applies no `maxItems`/@Size cap; a large id list silently exceeds Postgres's ~32K bound-parameter limit on the prepared statement. Lower-priority than the depth caveats but undocumented. Evidence: concepts.yaml DataEntity bug note citing getDataEntityDownstreamLineage.md:bugs_limitations_corner_cases.[0-2] ('`expanded_entity_ids` has no `maxItems` cap — exceeds Postgres 32K-parameter prepared-statement limit silently')."
maintainer_curated: false
---

# Data Objects Lineage — doc understanding

This page is the operator-and-developer feature page for cross-entity lineage. It documents (a) the per-entity upstream/downstream lineage graph, served by `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` (DataEntityController.java:255 / :265) over a single Postgres `WITH RECURSIVE` CTE (concept `Traverse Lineage Graph (recursive-CTE)`); (b) the dedicated group-lineage endpoint `getDataEntityGroupsLineage` (DataEntityController.java:275, feature F-016, concept `Get data entity group lineage (flat graph per DEG member, inner DEGs suppressed)`) that returns the union over a DEG's children; and (c) two UI surfaces of the lineage canvas — the Compact/Full view-mode toggle (feature F-186) and the depth control (feature F-055), both rendered on the `Lineage Canvas (d3-hierarchy tree + crossEdges overlay)` with progressive expansion via `LoadMore Lineage Expansion (depth-1 fan-out + slice monotonic accumulation)`.

The page is unusually code-accurate on the depth-bypass story — its core claims (UI sends `lineage_depth=1`; dropdown caps at 20 but `?d=` is unclamped; `@Min(1)` and no `@Max`; click-through propagates the clicked node's depth) are each confirmed verbatim against the substrate (concept `Traverse Lineage Graph (recursive-CTE)`: `defaultLineageQuery.d=1 at constants.ts:77`, `d: node.depth || 1`; feature F-055). The drift is therefore not in what the page says but in what it omits or softens: the unset-depth branch is a hard NPE/500 rather than "undefined" behaviour (F-005); the cross-owner authorization gap is undocumented on every lineage endpoint; the group-lineage 404 conflates three conditions (the page names one); inner-DEG suppression and the both-endpoints edge filter (F-016) silently reshape the group result; and the unbounded recursion's cycle-guard absence + full-heap materialisation make a deep walk a memory/CPU amplifier, not only a deep query. Every binding above was confirmed via graph-node; every drift entry cites a `node_id` and a `file:line`/sidecar locator.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
