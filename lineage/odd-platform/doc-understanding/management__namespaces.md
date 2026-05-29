---
doc_page: "docs/management/namespaces.md"
page_title: "Namespaces"
live_url: "https://docs.opendatadiscovery.org/features/management/namespaces"
live_url_verified_status: "200"
live_url_resolved_slug: "features/management/namespaces"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "NAMESPACE_CREATE + TAG_CREATE side-doors via TermController unguarded paths (TERM_CREATE / TERM_UPDATE / TERM_TAGS_UPDATE bypass the dedicated CREATE permissions)"
    - "Soft-delete reincarnation via partial-unique-index — general pattern beyond Tag (Namespace + 5 sister tables, batch W explicit framing)"
    - "F-006 audit-silence is SCHEMA-ROOTED — activity.data_entity_id NOT NULL FK"
    - "Namespace inherited from Collector, not payload — collector-scoped tenancy model"
  features:
    - "F-028"   # Namespace Lifecycle — create / list / details / update / delete
    - "F-076"   # Cross-Management cascade-on-delete protection pattern (Owner / Namespace / DataSource)
  code_nodes:
    - "odd-platform java NamespaceController controller-method:createNamespace"
    - "odd-platform java NamespaceController controller-method:updateNamespace"
    - "odd-platform java NamespaceController controller-method:deleteNamespace"
audience: [operator]
doc_claim_vs_code:
  - "Page claims the cascade-on-delete guard cleanly blocks the delete when any of four referents exists; code shows the guard is a TOCTOU race — the Namespace delete path is not even @ReactiveTransactional, so the existence-check + soft-delete chain is non-atomic with itself AND with concurrent referent INSERTs (READ COMMITTED, no row-level or advisory lock). A referent inserted between the check and the soft-delete is silently orphaned; the page omits this concurrency caveat — evidence: F-076 (NamespaceController#delete, the Mono.zip existsByNamespace* + soft-delete chain)."
  - "Page attributes Namespace-CRUD audit-silence solely to the activity table being schema-anchored to data_entity_id NOT NULL; code confirms that root (V0_0_48__add_activity.sql:4 NOT NULL + :12 activity_data_entity_id_fk, INNER JOIN at ReactiveActivityRepositoryImpl.java:219) but the silence has a SECOND independent root the page omits — the ActivityEventTypeDto enum defines no NAMESPACE_CREATED value, so a NAMESPACE event has no type to emit even if the schema constraint were lifted. Page is correct-but-incomplete — evidence: invariant:f-006-audit-silence-schema-rooted-data-entity-id-not-null-fk + invariant:namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths (enum-rooted compound)."
  - "Page lists FOUR sister services minting namespaces via getOrCreate (Data Source / Term / Collector / Data Entity Group), corroborated at feature level by F-028 (primary_drift_class=namespace_create_side_door_bypass_via_four_sister_services, naming TermServiceImpl / DataSourceServiceImpl / CollectorServiceImpl / DataEntityGroupServiceImpl). Primary-source file:line confirmation in the graph covers only the two Term paths — TermServiceImpl.createTerm:103 and updateTerm:138 call namespaceService.getOrCreate (invariant:namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths). Separately, the Data Source INGESTION path behaves the OPPOSITE way: DataSourceIngestionServiceImpl.java:99-111 stamps the Collector's namespace_id and silently ignores payload namespace_name (invariant:namespace-inherited-from-collector-not-payload). Confidence note, not a contradiction — the four-caller UI-create claim is feature-confirmed; only the two Term callers carry primary-source file:line in the current substrate, and the Data Source mint path is the UI POST/PUT /api/datasources flow, NOT the collector ingestion flow."
maintainer_curated: false
---

# Namespaces — doc understanding

This operator-facing page documents the full Namespace primitive: the five-endpoint
CRUD lifecycle on `NamespaceController` (`createNamespace` @ `NamespaceController.java:21`,
`updateNamespace`, `deleteNamespace` @ `:37`), the three permission gates
(`NAMESPACE_CREATE / UPDATE / DELETE`, RBAC-gated at `SecurityConstants.java:98-108`
with GET ungated), and four load-bearing invariants the substrate confirms with
primary-source evidence — implementing **F-028** (Namespace Lifecycle). It correctly
documents (1) the **auto-create side-door** (`getOrCreate` mints namespace rows without
`NAMESPACE_CREATE`; primary-source confirmed for the two Term paths at
`TermServiceImpl.java:103,138`); (2) **soft-delete reincarnation** via the partial-unique
index `namespace_unique ... WHERE deleted_at IS NULL` at
`V0_0_31__add_deleted_at_field.sql:25` — exactly the reuse-name-with-new-id semantics
described; (3) the **cascade-on-delete guard** across exactly four referent classes
(part of the cross-Management **F-076** pattern); and (4) the **audit-silence** rooted in
`activity.data_entity_id NOT NULL` (`V0_0_48__add_activity.sql:4,12`).

Three drift findings (above), all minor and confidence-calibrating rather than
contradictory: the cascade guard's TOCTOU non-transactionality (F-076) is a genuine
omitted concurrency caveat; the audit-silence has a second enum-rooted cause the page
does not mention; and the "four sister services" side-door claim is feature-confirmed but
only two of the four callers carry primary-source `file:line` in the current substrate.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
