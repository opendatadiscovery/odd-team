# DOC-GAP-133 — scanner corroboration append (2026-05-27 batch-6)
# Parent: DOC-GAP-133.md (Microservices lineage and data-entity lineage share the same React canvas component; no toggle, no entity-class-specific rendering)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T1700Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    mode_b_batch: batch-6
    finding_id_in_scan: F-054 (full feature)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27-batch-6.md#f-054-microservices-lineage-p-05-data-lineage
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-054.yaml
    confirms:
      - "VERIFIED VERBATIM this run at Lineage.tsx:12-26: 14-line dispatcher routes ONLY on `isDEG` (`getIsDataEntityBelongsToClass(dataEntityId).isDEG` at line 14); return `isDEG ? <DEGLineageAtomProvider><DEGLineage /></DEGLineageAtomProvider> : <HierarchyLineage />` at lines 19-25. No `isMicroservice` branch exists. All MICROSERVICE-class entities fall through to <HierarchyLineage /> identically to a Postgres table."
      - "VERIFIED VERBATIM this run at LineageServiceImpl.java:87-91: `getLineage(final long dataEntityId, final int lineageDepth, final List<Long> expandedEntityIds, final LineageStreamKind lineageStreamKind)` — NO EntityClass parameter. Same SQL, same response shape for every class."
    extends:
      - "F-054a (NEW): Microservices lineage cross-owner enumeration amplified — `LineageServiceImpl.getLineage` (verified) has no owner JOIN, no class-aware filter. Live microservices doc page silent on access control. Operational topology (latency, error rate, call rate) is often more sensitive than schema lineage."
      - "F-054b (NEW): Microservice-specific OpenTelemetry trace fields silently dropped at the response-DTO mapper (operation_name, span_kind, error_rate, p95_latency, callsPerMinute). Live doc names OTel ingestion but not which fields survive."
    ontology_doc_mitigation_detected:
      - "SUBSTRATE FACET RECLASSIFIED: The substrate facet `microservices_lineage_indistinguishable_from_data_object_lineage_no_class_aware_ui` was authored at framing 'doc-promised distinct surface vs code uniformity'. Live `/features/data-lineage/microservices` page WebFetched 2026-05-27 now EXPLICITLY acknowledges 'same UI surface as Data Objects Lineage' + 'microservice nodes participating alongside datasets, transformers, and the rest of the entity model' + 'Microservices appear in the catalog as `MICROSERVICE`-class transformer entities'. The doc has improved since substrate authoring; the substrate's drift framing is no longer accurate at the live-doc level. The substrate-shoebox correction is queued (F-054 description reframe: doc-promised-distinct-surface → doc-confirmed-uniform-surface-with-OTel-feed)."
      - "DOC-GAP-133's parent framing (`microservices lineage and data-entity lineage share the same React canvas component; no toggle, no entity-class-specific rendering`) is STILL ACCURATE AT THE CODE LEVEL — but the doc-side gap framing (operators expect distinct UX per the docs) is doc-mitigated. The residual doc gap is now the payload-field-drop dimension (F-054b) and the access-control dimension (F-054a)."
    severity_adjustment: parent DOC-GAP-133 facet partially-mitigated; residual gaps F-054a HIGH (access-control) + F-054b MEDIUM (payload fields) remain
    dedup_action: corroborate_and_extend_with_doc_mitigation_recognition
    proposed_doc_action: |-
      DOC-GAP-133's parent doc-action (operator-visible note on `/features/data-lineage/microservices`) has been
      PARTIALLY ADDRESSED — the live page now states the same-canvas behaviour explicitly. The remaining doc gaps are:
      (a) "Access model" subsection naming the cross-owner read posture (F-054a — HIGH);
      (b) Payload-field subsection naming the supported microservice-specific trace fields (F-054b — MEDIUM).
      Cross-link to REFACTOR-203 (cross-owner enumeration family) and the LineageMapper.mapLineageDto response-DTO mapping site for the payload-field dimension.
