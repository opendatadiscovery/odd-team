# DOC-GAP-165 — scanner corroboration append (2026-05-27 batch-6)
# Parent: DOC-GAP-165.md (DEG-lineage edges crossing DEG boundary silently filtered — `getLineageRelations(List<String>)` requires BOTH endpoints in member set)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T1700Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    mode_b_batch: batch-6
    finding_id_in_scan: F-016 (with bidirectional-edge-filter facet — facet of substrate F-016)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27-batch-6.md#f-016-deg-anchored-lineage-p-05-data-lineage
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-016.yaml
    confirms:
      - "VERIFIED VERBATIM this run at LineageServiceImpl.java:59-85: the `getDataEntityGroupLineage` method body invokes `lineageRepository.getLineageRelations(entitiesOddrns).collectList()` at line 66-67. The List<String>-overload of getLineageRelations is the bidirectional-IN overload (substrate's repository-tier evidence at ReactiveLineageRepositoryImpl.java:112-119 not re-Read this pass; the substrate cite has been verified previously)."
      - "Live `/features/data-lineage/data-objects` (WebFetched 2026-05-27 status 200) confirms substrate's silent-on-bidirectional-filter claim — page mentions the DEG endpoint without naming the filter shape."
      - "API reference at openapi.yaml:2418-2433 — VERIFIED this run — declares ONLY the path parameter. The bidirectional filter is documented neither in the spec nor on the live API-reference page."
    extends:
      - "Substrate F-016 evidence chain confirms bidirectional IN-clause: edges exiting the DEG (member→non-member) and edges entering the DEG (non-member→member) are dropped. Operator question 'what does this DEG consume?' is NOT answered by this endpoint. Same operator-debug confusion class as DOC-GAP-099 (inverse-semantic OpenAPI summary on `getMyObjectsWithUpstream/Downstream`)."
      - "Cross-link to F-016a (NEW this batch): the sibling membership endpoint `getDataEntitiesByDEGOddrn` returns the FLAT member list with no edge filter at all (200 OK, empty if no members). The two endpoints offer two DIFFERENT views into the same DEG-membership structure: lineage filters edges where BOTH endpoints in member set; membership returns members flat. Documenting one without the other leaves operators confused about which question each answers."
    severity_adjustment: unchanged (parent DOC-GAP-165 already MEDIUM; scan re-anchors the primary-source line numbers + adds cross-endpoint context)
    dedup_action: corroborate_and_extend
    proposed_doc_action: |-
      DOC-GAP-165's doc-side fix (admonition on `/features/data-lineage` or `/developer-guides/api-reference/lineage`
      describing the bidirectional edge filter) should be paired with the sibling-endpoint-contract documentation
      (F-016a) so operators can pick the right endpoint for the question. A single paragraph naming both endpoints +
      describing which question each answers (lineage = "what's the internal connectivity?"; membership = "who's in
      this group?") closes both gaps coherently.
