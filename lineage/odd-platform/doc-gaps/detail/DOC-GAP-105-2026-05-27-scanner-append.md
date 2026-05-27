# DOC-GAP-105 — scanner corroboration append (2026-05-27)
# Parent: DOC-GAP-105.md (Lineage recursive-CTE primary-source — cycle/owner/upper-bound + NPE-on-null-default)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T000000Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    finding_id_in_scan: F-005 (with sub-findings F-005a MEDIUM drift + F-005b MEDIUM missing-caveat)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27.md
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-005.yaml
    confirms:
      - "Lineage default-depth NPE pinned at primary source — LineageService.java:12-14 declares `getLineage(final long dataEntityId, final int lineageDepth, ...)` (primitive `int`); DataEntityController.java:256-263 receives `Integer lineageDepth` (boxed) and passes it to the service. Autoboxing `Integer → int` on a null Integer throws NullPointerException at the call site → HTTP 500. The substrate's hop-2 evidence in F-005 is verbatim correct at LineageService.java:12 — VERIFIED."
      - "Cross-owner enumeration class extension to dataset-structure surface (F-005 batch W) — DatasetController.getDataSetStructureByVersionId at DatasetController.java:23-30 IGNORES the `data_entity_id` URL parameter (SQL filters by `DATASET_VERSION.ID` only at ReactiveDatasetVersionRepositoryImpl.java:129) — a request to `GET /api/datasets/{any_id}/structure/{valid_version_id_for_other_dataset}` returns the OTHER dataset's structure. Same blast radius as the lineage cross-owner pattern at a different read surface. DOC-GAP-105's lineage-only scope is now visibly part of a broader cross-owner enumeration class spanning lineage + structure + structure-diff + relationships endpoints."
      - "UI hardcodes `lineage_depth=1` across 3 surfaces (HierarchyLineage initial + LoadMoreButton incremental + GroupedEntitiesListModal) — the doc-claimed 'unset returns default depth' branch is unreachable from the UI. Direct API callers who try unset get the NPE 500 instead. PRIMARY-SOURCE verification at constants.ts:74-84 + HierarchyLineage.tsx:47 + useQueryParams.ts:38-44."
    extends:
      - "F-005a (NEW dimension on DOC-GAP-105): UI silently masks F-005 default-depth NPE — d=1 hardcoded across 3 UI surfaces; the doc's 'unset returns default depth' branch is unreachable from the UI. Adjacent to DOC-GAP-105's NPE dimension; adds the UI-mask layer the original gap does not capture."
      - "F-005b (NEW): Click-through compounds lineage depth — Node.tsx:46-52 navigates to `dataEntityLineagePath(entityId, lineageQueryString)` where `lineageQueryString` is built from `useQueryParams({...defaultLineageQuery, d: node.depth || 1})`. Clicking a node 5 hops from root → new view opens with d=5 around that leaf. Combined with the no-upper-bound finding (already in DOC-GAP-105), a casual user clicking through the canvas can trigger arbitrarily-expensive recursive CTE walks without touching the depth slider."
    severity_adjustment: unchanged (parent DOC-GAP-105 already HIGH)
    dedup_action: corroborate_and_extend
    proposed_doc_action: |-
      The DOC-GAP-105 fix should explicitly call out the UI-side amplification surface in addition to the
      backend/SQL-layer findings the original DOC-GAP-105 documents. The lineage feature page authoring task should:
      (a) document the lineage_depth default + valid range + behaviour-on-omission (DOC-GAP-105 original);
      (b) document cycle/diamond DAG handling (DOC-GAP-105 original);
      (c) document the cross-owner read posture explicitly OR add JOIN-side owner filter at the lineage endpoint (DOC-GAP-105 original);
      (d) NEW: document that the UI's depth slider [1..20] is bypassable via direct URL editing (`?d=999999999` reaches the CTE);
      (e) NEW: document that clicking a graph node title compounds the depth from the clicked node's distance from root;
      (f) NEW: extend the cross-owner enumeration class to the dataset-structure surface (per F-005 batch W findings) — same posture, different endpoint.
