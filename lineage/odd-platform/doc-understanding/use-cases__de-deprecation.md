---
doc_page: "docs/use-cases/de-deprecation.md"
page_title: "Deprecation for Data Engineer \\ Analyst"
live_url: "https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation"
live_url_verified_status: "200"
live_url_resolved_slug: "use-cases/use-cases/de-deprecation"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Get lineage (recursive-CTE walk with depth-1 expansion fan-out)"
    - "Update Data Entity Status (lifecycle with cascade)"
    - "Ownership (binding edge)"
  features:
    - "F-044"
    - "F-019"
  code_nodes:
    - "operation:get-lineage-recursive-cte-with-depth-1-expansion"
    - "operation:update-data-entity-status-lifecycle-with-cascade"
    - "entitie:ownership-binding-edge"
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Page narrates the deprecation lifecycle as a purely manual human/email process — step 6 'send out a notification letter that this data object is going to be decommissioned in 3 months', step 7 'archive the object and stop object increments', step 8 'after 3 months we delete the object'. It never tells the operator that ODD HAS a native DEPRECATED status with a scheduled-delete date that performs exactly this 'decommission in N months → delete' mechanic automatically. Code: operation:update-data-entity-status-lifecycle-with-cascade — PUT /api/dataentities/{id}/statuses accepts DataEntityStatus DEPRECATED with a REQUIRED status_switch_time (isSwitchable=true), and the scheduled DataEntityStatusSwitchJob (every 10 min) auto-flips entities whose status_switch_time <= now to DELETED. Same capability is feature F-044. The page's 'Solution' under-sells the platform: the operator-facing deprecation tool the page describes by hand already exists as a status with a switch date. (evidence: operation:update-data-entity-status-lifecycle-with-cascade; SecurityConstants.java:277-281; F-044 feature-flows/detail/F-044.yaml:1)"
  - "Page's pivotal decision ('though there is a dashboard sourcing from my object, it was not used for 6 months') depends on the downstream lineage diagram reliably surfacing downstream consumers for an OLD, INHERITED, legacy object — the page's own framing. The downstream lineage read confirms the traversal exists but is qualified by HIGH-severity defects the page gives no caveat for: (a) null-Integer NPE when lineage_depth is unset — DataEntityController.java:257 passes a boxed Integer to a primitive-int service signature, throwing before the walk runs, so the documented 'unset returns default depth' behaviour is unimplementable as written; (b) no upper-bound clamp on lineage_depth — a deep/legacy graph runs the recursive CTE unbounded; (c) no owner-scoping (no AuthIdentityProvider field, no fetchAssociatedOwner) — cross-owner lineage edges are enumerable, so the 'examine downstream systems' step is not owner-isolated. (evidence: operation:get-lineage-recursive-cte-with-depth-1-expansion — LineageServiceImpl.getLineage lines 87-122, controller boxed-Integer at DataEntityController.java:257)"
  - "Page treats step 8 'we delete the object' as a terminal, irreversible action and gives the operator no model of what delete means in ODD. Code: the DELETED transition is a SOFT-delete with cascade (lineage relations + group relations + statistics), paired with a documented 30-day retention window before hard-removal — and that window is itself broken by a known status_updated_at-never-bumped ordering bug (F-044 primary_drift_class status_updated_at_never_set_breaks_30_day_ttl). The page should set the soft-delete-then-retention expectation rather than imply immediate permanent deletion. (evidence: operation:update-data-entity-status-lifecycle-with-cascade soft-delete cascade on DELETED; F-044 feature-flows/detail/F-044.yaml:1)"
maintainer_curated: false
---

# Deprecation for Data Engineer \ Analyst — doc understanding

A use-case narrative for a data engineer / analyst who wants to retire an inherited, low-quality data object without breaking downstream pipelines, dashboards, or views. It delivers a five-beat playbook: find the object's stakeholders/owners, walk its downstream lineage to assess blast radius, convene the owners, notify with a decommission date, then archive and finally delete. Audience is operator (the engineer driving the deprecation) and data-consumer (the analyst inheriting the object).

The page maps onto three confirmed implementation surfaces. "Find the stakeholders, SMEs or primary PoCs" is the Ownership directory (`entitie:ownership-binding-edge` — the `ownership` edge table binding Owner → Data Entity, surfaced via F-019 Owner Lifecycle). "Explore a lineage diagram to check downstream systems sourcing from the object" is the downstream lineage read (`operation:get-lineage-recursive-cte-with-depth-1-expansion`, the `getDataEntityDownstreamLineage` path). The archive/decommission/delete tail of the scenario is the Data Entity status lifecycle (`operation:update-data-entity-status-lifecycle-with-cascade` / F-044), which is exactly where the page's biggest miss sits: ODD already implements "deprecate now, auto-delete on a future switch date" as the DEPRECATED status + `status_switch_time` + `DataEntityStatusSwitchJob`, yet the page narrates that same workflow as a manual email-and-calendar process and never points the reader at the native capability. Two further code-grounded caveats (downstream-lineage NPE / no depth clamp / no owner-scoping, and soft-delete-vs-permanent-delete semantics) are recorded as drift.

## Maintainer notes
