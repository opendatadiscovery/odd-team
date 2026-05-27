# DOC-GAP-192 — scanner corroboration append (2026-05-27, batch 2)
# Parent: DOC-GAP-192 (Activity Feed scope STRUCTURALLY CONSTRAINED to data-entity events)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T1400Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    finding_id_in_scan: F-021 (with sub-finding F-021a HIGH drift)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27-batch-2.md
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-021.yaml
    confirms:
      - "Activity Feed schema-rooted scope to data-entity events ONLY. activity.data_entity_id NOT NULL FK to data_entity(id) (V0_0_48__add_activity.sql:4,12). RBAC mutations, Datasource lifecycle, Collector token rotation, Integration Wizard config writes CANNOT physically emit even if @ActivityLog were added — the schema prevents it. Per substrate F-021 primary_drift_class + batch R ReactiveActivityRepositoryImpl primary source."
      - "Live doc page (WebFetched 2026-05-27 status 200) lists 20 event types in 6 groups and frames the feature as 'records changes to data entities — description edits, ownership changes, tag and term assignments, custom-metadata edits, and alert lifecycle events.' The framing implicitly suggests platform-wide audit but the implementation is strictly data-entity-scoped — the cross-pillar audit-asymmetry canonicalisation candidate from system-mission.md is rooted HERE."
    extends:
      - "F-021b (NEW sibling-finding): doc lists 20 event types but code declares 27 in ActivityEventTypeDto.java:3-31. Seven undocumented values (DATA_ENTITY_OVERVIEW_UPDATED, DATA_ENTITY_METADATA_UPDATED, DATA_ENTITY_SCHEMA_UPDATED, DATA_ENTITY_RELATION_UPDATED, CUSTOM_METADATA_CREATED, CUSTOM_METADATA_UPDATED, CUSTOM_METADATA_DELETED) — strengthens the sibling DOC-GAP-191. The live doc's hint 'a few additional internal event types are intentionally hidden from the global Activity filter' (per WebFetch) is the partial-disclosure half; the doc does not enumerate which seven are hidden."
      - "F-021c (NEW): Activity Feed read default is cross-owner. Only the `MY_OBJECTS` type parameter is owner-scoped, and it scopes by ENTITY-ownership (not actor-axis). The provider-agnostic LEFT JOIN to USER_OWNER_MAPPING on OIDC_USERNAME is the read-side mirror of F-011's cross-mode-bleed pattern."
      - "F-021d (NEW): Anonymous mutations under auth.type=DISABLED write created_by=null and are visually indistinguishable from system events on the activity feed."
    severity_adjustment: unchanged (parent DOC-GAP-192 already HIGH per substrate doc-gaps catalogue)
    dedup_action: corroborate_and_extend
    proposed_doc_action: |-
      Single doc revision on `/features/active-platform-features/activity-feed` covering:
      (a) the schema-rooted data-entity-only scope (DOC-GAP-192 original + F-021a verbatim);
      (b) enumerate all 27 event types OR explicitly name the 7 hidden ones (DOC-GAP-191 + F-021b);
      (c) the cross-owner read default + MY_OBJECTS axis-mismatch caveat (F-021c);
      (d) the anonymous-mutation null-created_by attribution gap under DISABLED (F-021d).
      Cross-link to system-mission.md canonicalisation candidate "Audit-log Presence Asymmetry"
      for the platform-wide framing.
