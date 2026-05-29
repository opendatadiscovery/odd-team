---
doc_page: "docs/master-data-management.md"
page_title: "Master Data Management"
live_url: "https://docs.opendatadiscovery.org/features/master-data-management"
live_url_verified_status: "200"
live_url_resolved_slug: "features/master-data-management"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Lookup Table (Master Data Management — P-03 anchor; was-empty pillar now anchored at the controller layer)"
    - "Reference Data / Lookup Table CRUD + Faceted Search (the 14-endpoint surface owned by ReferenceDataController — P-03 anchor)"
  features:
    - "F-026"
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Subsections bullet) claims Lookup Tables have a 'Schema (9 PostgreSQL field types)'; code enumerates 9 LookupTableFieldType enum constants but only 8 DISTINCT SQL types — TYPE_INTEGER and TYPE_SERIAL both map to INTEGER. Operator reading '9 field types' will not find 9 distinct on-disk column types. Evidence: F-026 entry text ('The doc names 9 PostgreSQL field types; code enumerates 9 enum constants but 8 distinct SQL types (TYPE_INTEGER and TYPE_SERIAL share INTEGER)'). Primary home of this drift is the lookup-tables child page; the MDM landing page repeats the claim in its Subsections description. DOC-GAP candidate (LOW — landing-page echo; fix at the child page)."
  - "Page (Subsections bullet) claims '9 LOOKUP_TABLE_* permissions on three surfaces'; code wires the LOOKUP_TABLE_* permissions through a NO_CONTEXT resolver — a Policy granting e.g. LOOKUP_TABLE_UPDATE permits modifying ANY lookup table, not just those owned by the user's Owner (architectural inconsistency with TERM-scoped + DATA_ENTITY-scoped sibling permissions). The page's permission framing does not surface this global (non-per-owner) scope. Evidence: F-026 entry text HIGH finding (a) 'the 9 LOOKUP_TABLE_* permissions use NO_CONTEXT resolver'; cross-ref getResourcePermissions.md drift findings in concepts.yaml. DOC-GAP candidate (MEDIUM — operator-facing authorization caveat absent on the pillar surface; primary home is permissions.md + lookup-tables child page)."
maintainer_curated: false
---

# Master Data Management — doc understanding

This is the **pillar / landing page** for the Master Data Management (P-03) section. It tells an operator that ODD's MDM surface is the home for operator-curated reference data — the canonical lists, lookup values, and code tables downstream pipelines and BI tools join against — and is candid that what ships is narrower than full MDM: only **Reference Data Management** (operator-managed lookup / reference tables as first-class catalog entities), not golden records / survivorship / stewardship workflows. The page defers all API, schema, RBAC, and PostgreSQL-access detail to the single child surface, **Lookup Tables**, and positions the pillar against the other five governance pillars via the Main Concepts → Data Governance map.

The page binds to two confirmed concepts: the canonical MDM entity concept `entitie:master-data-management-lookup-table-pillar-p-03-anchored` (which records the pillar's P-03 anchoring, the `/master-data/lookup-tables` route shape, and that Lookup Tables are first-class Data Entities of subtype `LOOKUP_TABLE` with physical Postgres row storage in `lookup_tables_schema`), and the operation concept `operation:reference-data-lookup-table-crud` (the 14-endpoint `ReferenceDataController` surface). It documents feature **F-026 (Lookup Tables / Reference Data Management)**. No code nodes are bound directly: the landing page makes no endpoint- or file-level claims of its own — every concrete claim (the 14 endpoints, the field types, the permissions) is stated on, and belongs to, the Lookup Tables child page sidecar; binding controller-method nodes here would over-attribute.

The page's conceptual claims (operator-curated reference data; Reference Data Management is the shipped subset; full MDM semantics are out of scope; opened from the Master Data top-level toolbar tab; Lookup Tables are entities rather than attachments-to-entities) are confirmed accurate against F-026 and the MDM concept node. The two drift findings recorded above are *echoes* of detail-page claims (9 field types; 9 LOOKUP_TABLE_* permissions) whose primary home for correction is the `lookup-tables` child page and `permissions.md` — flagged here because the landing page repeats them in its Subsections description.

## Maintainer notes
