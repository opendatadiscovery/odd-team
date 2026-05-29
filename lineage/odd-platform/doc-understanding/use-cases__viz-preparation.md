---
doc_page: "docs/use-cases/viz-preparation.md"
page_title: "Data preparation for Visualization Engineer"
live_url: "https://docs.opendatadiscovery.org/use-cases/use-cases/viz-preparation"
live_url_verified_status: "200"
live_url_resolved_slug: "use-cases/use-cases/viz-preparation"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Tag", "Custom Metadata Field + Value"]
  features: ["F-018"]
  code_nodes: []
audience: [data-consumer]
doc_claim_vs_code:
  - "Solution section frames the tagging system + metadata storage as a way to 'set security standards, e.g. row-level security based on the user group'. ODD's Tag directory is a GLOBAL, namespace-free, cross-tenant vocabulary with NO per-tag ACL and NO user-group binding — owner_scoping verdict BYPASSES; tags 'appear in another tenant's popular-tags surface' — so ODD does not provide row-level security or any group-scoped access control; RLS must be built entirely on the DWH/BI side. Evidence: entitie:tag (concepts/detail/entities/tag.yaml:1 — 'Global, cross-tenant directory entry'; security_aggregate.owner_scoping.verdict BYPASSES; concepts.yaml:3267) and F-018 (feature-flows/detail/F-018.yaml:1 — 'global, namespace-free vocabulary')."
  - "Scenario relies on consulting stored metadata (data load mode = streaming, history depth, structure) as authoritative input for dashboard performance/refresh decisions. ODD's custom-metadata values carry NO type validation and an EXTERNAL-origin (collector-ingested) value can be silently overwritten by any user holding DATA_ENTITY_CUSTOM_METADATA_UPDATE until the next ingestion run, and the upsert path silently flips metadata_field_value.active to NULL — so a metadata field a Viz Engineer reads may not be a guarded, validated source of truth. Evidence: entitie:custom-metadata-field-value (concepts/detail/entities/custom-metadata-field-value.yaml:1 — 'NO type validation against metadata_field.type'; 'EXTERNAL-origin overwrite is silent'; 'active=NULL regression')."
maintainer_curated: false
---

# Data preparation for Visualization Engineer — doc understanding

This page is a data-consumer persona walkthrough: a Tableau/BI engineer consults ODD's catalog metadata and tags before building a dashboard, to predict BI-tool performance, decide a data-preparation strategy (filtered view, history limit, pre-aggregated KPIs), and set dashboard security expectations. It is narrative, not feature-reference, so it binds to ODD capabilities rather than to a specific endpoint. The two concrete ODD surfaces it leans on are the tagging system — the `Tag` concept (`entitie:tag`, concepts.yaml:3267) and its operator-facing feature `F-018` Manual Object Tagging (`feature-flows/detail/F-018.yaml:1`) — and "metadata storage", which maps to ODD's custom-metadata entity, `Custom Metadata Field + Value` (`entitie:custom-metadata-field-value`). No specific code node is bound because the page documents no endpoint behaviour; the concept nodes already carry the code provenance.

The high-value drift is in the Solution section's "row-level security based on the user group" framing: ODD's Tag directory is global and cross-tenant with no per-tag ACL and no user-group binding (`entitie:tag` owner_scoping `BYPASSES`; `F-018` "global, namespace-free vocabulary"), so ODD itself provides no group-scoped access control — RLS lives entirely on the DWH/BI side. A secondary, softer caveat: the stored metadata the engineer consults is neither type-validated nor guarded against silent EXTERNAL-origin overwrite (`entitie:custom-metadata-field-value`).

## Maintainer notes
