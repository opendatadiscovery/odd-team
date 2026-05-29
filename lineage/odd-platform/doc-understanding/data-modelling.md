---
doc_page: "docs/data-modelling.md"
page_title: "Data Modelling"
live_url: "https://docs.opendatadiscovery.org/features/data-modelling"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-modelling"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Query Example (operator-curated SQL/KQL/Spark snippet attached to data entities and terms)"
    - "Data Entity Relationship (ERD + Graph variants)"
    - "Data Modelling ERD is a SUB-tab inside Relationships, NOT a peer of Query Examples + Relationships (operator navigation hierarchy clarity)"
  features:
    - "F-025"
  code_nodes:
    - "odd-platform ts components/DataModelling react-component:DataModellingTabs"
    - "odd-platform ts routes route:relationships"
audience: [operator]
doc_claim_vs_code: []
maintainer_curated: false
---

# Data Modelling — doc understanding

This is the hub page for the **Data Modelling** pillar (P-02): a section-overview that frames Data Modelling as the home for operator-curated artefacts describing a dataset's *contract* (how it's queried, how it's connected), then routes the reader to its two child surfaces — **Query Examples** and **Relationships**. It does not document endpoints or behaviour itself; the substance lives on the two child pages (`data-modelling/query-examples.md`, `data-modelling/relationships.md`).

The page binds to two section-level concepts confirmed via graph-node: `entitie:query-example` (Query Example — the operator-curated SQL/KQL/Spark snippet, pillar P-02, surfaced through feature `F-025` "Query Examples (CRUD + Faceted Search)") and `entitie:data-entity-relationship` (the ERD + Graph relationship variants discriminated by the `relationship_type` column). The page's "two child surfaces today, Query Examples + Relationships in a vertical-tabs sidebar" framing is exactly what the navigation-clarity invariant `data-modelling-erd-is-sub-tab-not-peer-of-relationships` records from `components/DataModelling/DataModellingTabs.tsx:11-23` — ERD is a sub-tab *inside* Relationships, not a peer tab. The hub navigation itself is the `DataModellingTabs` react-component substrate node; the `/data-modelling/relationships` entry point is the enriched `route:relationships` node (`BASE_PATH = '/data-modelling'`, owns no auth gate — consistent with this page's UI-entry-points table listing no RBAC permission on the Relationships row, while gating the Query Examples routes on `QUERY_EXAMPLE_CREATE/UPDATE/DELETE`).

No doc-claim-vs-code drift on this hub page: every claim it makes (two-tab navigation, the `/data-modelling` → `/data-modelling/query-examples` default, the route/RBAC table, the two relationship classes `ENTITY_RELATIONSHIP`/`GRAPH_RELATIONSHIP`) aligns with the confirmed code and concept nodes. Two drift findings exist in the ontology but are scoped to the *child* `relationships.md` page, not this hub — `relationships-list-target-column-copy-paste-source-data` (HIGH-severity UI bug: the Relationships list Target column renders Source data, `components/DataModelling/Relationships/RelationshipsListItem.tsx:73-81`) and `relationship-id-name-vs-data-entity-id-translates-silently`. They are not recorded as drift here because this hub page makes no Source/Target-column or relationship-id claim; they belong to the relationships child-page sidecar.

## Maintainer notes
