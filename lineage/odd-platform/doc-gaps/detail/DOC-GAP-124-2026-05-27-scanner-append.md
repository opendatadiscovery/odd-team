# DOC-GAP-124 — scanner corroboration append (2026-05-27 batch-6)
# Parent: DOC-GAP-124.md (Inner-DEG suppression in `LineageServiceImpl.getDataEntityGroupLineage` is a deliberate deferred-feature carve-out)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T1700Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    mode_b_batch: batch-6
    finding_id_in_scan: F-016 (with inner-DEG-suppression facet — facet of substrate F-016)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27-batch-6.md#f-016-deg-anchored-lineage-p-05-data-lineage
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-016.yaml
    confirms:
      - "VERIFIED VERBATIM this run at LineageServiceImpl.java:71-75: `// Remove this when we will support inner DEGs for DEG lineage` comment at line 71 + the `.filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict)).toList()` at lines 72-74 + `dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()))` at line 75. The deferred-feature carve-out's three-part structure (filter relations + remove dict entries + the verbatim TODO comment) is intact at the cited line numbers."
      - "VERIFIED this run: NO `@ReactiveTransactional` on `getDataEntityGroupLineage` (lines 59-85). Contrast with `replaceLineagePaths` at line 125 which DOES have it. The non-transactional read-only nature is structurally relevant to the hard-delete-window race facet of F-016."
      - "Live `/features/data-lineage/data-objects` page (WebFetched 2026-05-27 status 200) confirms substrate's silent-on-carve-out claim — page mentions 'the dedicated lineage endpoint for Data Entity Groups... returns the lineage graph for the group's children rather than for the group itself' but is silent on the inner-DEG suppression."
      - "Live `/developer-guides/api-reference/lineage` (WebFetched 2026-05-27 status 200) declares the `/api/dataentitygroups/{data_entity_group_id}/lineage` operation but is silent on inner-DEG suppression."
    extends:
      - "F-016a (NEW): sibling DEG-read endpoints disagree on empty-DEG polarity — lineage endpoint raises 404 at LineageServiceImpl.java:62; sibling `getDataEntitiesByDEGOddrn` at IngestionController.java:75-79 returns 200 OK with empty `CompactDataEntityList`. The asymmetry is a downstream consequence of the same inner-DEG-membership-resolution path that the carve-out filters; doc-fix on DOC-GAP-124 should mention the dual-endpoint contract."
      - "F-016b (NEW): DEG-lineage endpoint declares ONLY the path parameter (verified at openapi.yaml:2418-2433); per-entity siblings carry lineage_depth + expanded_entity_ids. Operators familiar with per-entity endpoints try `?lineage_depth=5` against the DEG endpoint and have it silently ignored. Adjacent to the inner-DEG-suppression contract."
    severity_adjustment: unchanged (parent DOC-GAP-124 already MEDIUM; scan re-anchors the primary-source line numbers + adds two sibling-endpoint dimensions)
    dedup_action: corroborate_and_extend
    proposed_doc_action: |-
      The DOC-GAP-124 doc-side fix (admonition on `/features/data-lineage` describing inner-DEG-free behaviour) should
      additionally cross-link to: (a) the sibling membership endpoint at /ingestion/entities/{degOddrn}/children which
      has DIFFERENT polarity for the same DEG-membership-resolution path (F-016a); (b) the parameter-asymmetry between
      DEG-lineage (path-only) and per-entity lineage (lineage_depth + expanded_entity_ids — F-016b). The deferred-feature
      backlog item (REFACTOR-NNN to be minted from DOC-GAP-124) should additionally cover the dual-endpoint contract
      symmetry to avoid the lift introducing inconsistency.
