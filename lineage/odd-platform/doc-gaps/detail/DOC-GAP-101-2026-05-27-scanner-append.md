# DOC-GAP-101 — scanner corroboration append (2026-05-27)
# Parent: DOC-GAP-101.md (Popular ranking signal undocumented externally)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T000000Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    finding_id_in_scan: F-001 (with sub-findings F-001a HIGH drift + F-001b HIGH drift)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27.md
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-001.yaml
    confirms:
      - "Popular ranking signal undocumented externally — live `/features/data-discovery/catalog-overview` (WebFetched 2026-05-27 status 200) makes ZERO mention of the computational mechanism (view_count DESC), the inflation surface, the +2-per-page-open LSN-017 amplification, the EXCLUDE_FROM_SEARCH bypass on the popular CTE, or the DISABLED-mode anonymous readability."
      - "Primary-source verification of the view_count UPDATE path at ReactiveDataEntityRepositoryImpl.java:174-178: `UPDATE DATA_ENTITY SET VIEW_COUNT = VIEW_COUNT + 1 WHERE ID = ?` — confirms substrate's hop-4 evidence in F-001."
    extends:
      - "F-001a (NEW): PopularStrip DISABLED-mode rendering CONTRADICTS live doc. catalog-overview.md:43 claims 'on auth-disabled deployments the panel is visible but the per-user filtering does not apply'; code at Overview.tsx:25-27 hides the entire OwnerAssociation wrapper (which contains the Popular column) under DISABLED. Direct factual contradiction — distinct from the inflation-surface concern DOC-GAP-101 already documents."
      - "F-001b (NEW): PopularStrip click-target documented as Structure but code routes to /overview. Live doc says 'Clicking a tile opens that entity's Structure page'; code at DataEntityList.tsx:38 + dataEntitiesRoutes.ts:66-73 (default path='overview') navigates to the Overview tab. Direct factual contradiction — also F-001-inflation-loop-closure-relevant (the Overview tab is the read-as-write endpoint that fires fetchDataEntityDetails)."
    severity_adjustment: unchanged (parent DOC-GAP-101 already HIGH; scan adds two HIGH sub-findings)
    dedup_action: corroborate_and_extend
    proposed_doc_action: |-
      The DOC-GAP-101 fix should be expanded to cover BOTH the inflation/mechanism dimension (original) AND the
      two factual contradictions surfaced by this scan (F-001a + F-001b). A single doc revision on
      `data-discovery/catalog-overview` can close all three: (a) document the view_count DESC mechanism + EXCLUDE_FROM_SEARCH bypass + DISABLED-mode anonymous reads (DOC-GAP-101 original); (b) correct the DISABLED-mode visibility claim (F-001a); (c) correct the Structure-vs-Overview click target (F-001b).
