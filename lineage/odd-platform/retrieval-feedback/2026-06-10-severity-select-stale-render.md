# Retrieval feedback — DQ severity select stale render / cross-test bleed — 2026-06-10

## Retrieval
- query as asked: "Is the DQ severity select's cross-test stale-render/bleed symptom (uncontrolled MUI select, defaultValue, no remount on dataQATestId route change) or the missing setDataQATestSeverity.fulfilled reducer root cause tracked anywhere beyond PLT-177 and TST-031 item 3?"
- final query: structural traversal of F-057 / react-component:TestReportDetailsOverview / controller-method:setDataQATestSeverity + fixed-string identifier sweep (setDataQATestSeverity, TestReportDetailsOverview, F-057) over substrate + trackers, after 6 vector formulations (symptom-side, reducer-side, remount-side, thunk/slice-side, component-side, uncontrolled-select-side)
- answer: F-057 (H-010/H-011/H-012), F-022 (H-007 + drift class), P-221, TEST-GAP-714/709/717, SHB-044, plus trackers PLT-177 / TST-031 / IT-057 / DOC-365 / PLT-055 — NONE covers the cross-test bleed symptom or the missing-fulfilled-reducer root cause · confidence HIGH · 10 iterations

## Refinement suggestions
- node_id: "odd-platform ts components/DataEntityDetails/TestReport/TestReportDetails/TestReportDetailsOverview react-component:TestReportDetailsOverview"
  returned_for_query: "TestReportDetailsOverview test report details overview severity dropdown select component"
  observed_problem: missing-edge
  evidence: "graph-neighbours returns [] — zero edges. No ENRICHED_BY sidecar, no PART_OF_FEATURE to F-057 or F-022, no SURFACES_FINDING — although F-057 H-004/H-005/H-010/H-011 and F-022 H-007/H-014 all cite TestReportDetailsOverview.tsx line ranges, and feature-flows/detail/F-022.yaml:118 names 'react-component:TestReportDetailsOverview' in prose. Structural traversal from the component dead-ends; only a raw grep recovers its findings. F-022's own H-000 (Rule-9 validation-gap: UI not enriched as sidecars) already admits this class of gap."
  suggested_refinement: "Add PART_OF_FEATURE edges TestReportDetailsOverview → F-057 and → F-022 (role: ui-entry-point), or enrich the component with a sidecar that surfaces the H-010/H-011/H-014 findings, so component-anchored retrieval reaches the severity-select defect family in one hop."
  retriever_confidence: HIGH

- node_id: "F-057"
  returned_for_query: "data quality test severity select stale value uncontrolled MUI defaultValue TestReportDetailsOverview no re-sync"
  observed_problem: missing-edge
  evidence: "All three PART_OF_FEATURE neighbours of F-057 are unresolved stub node_ids (the edge target is a serialised dict literal with 'unresolved': True, e.g. \"{'node_id': 'odd-platform java controller:DataQualityController (setDataQATestSeverity)', ...}\") instead of resolved CodeNodes; the real controller-method node 'odd-platform java DataQualityController controller-method:setDataQATestSeverity' exists separately with no edge to F-057. graph-traverse from F-057 therefore cannot reach the real code tier."
  suggested_refinement: "Resolve F-057's PART_OF_FEATURE targets to the canonical CodeNode ids (controller-method:setDataQATestSeverity etc.) in a reducer batch so feature→code traversal works."
  retriever_confidence: HIGH

- node_id: "F-057" (hypothesis H-011, feature-reflections/detail/F-057.yaml:518-555)
  returned_for_query: "component does not remount on route param change navigating between sibling tests shows previous test's value until page refresh" (NOT returned — that is the problem)
  observed_problem: weak-embed-text / thin-enrichment
  evidence: "H-011's actual_behavior names only 'a concurrent change by another operator, or a re-fetch' as the no-re-sync trigger and rates it LOW 'low-frequency'. The dominant single-operator trigger — TestReportDetails does not remount on dataQATestId route change, so the uncontrolled select bleeds the last-picked severity across ALL sibling tests until full page refresh — is absent, as is the compounding root cause (setDataQATestSeverity.fulfilled never reduced into the store, so even a controlled select would read stale state). Searches phrased on the bleed symptom or the reducer cannot land on H-011."
  suggested_refinement: "When the maintainer files the new issue for the bleed/reducer defect, extend F-057 (new hypothesis or H-011 refinement) with the route-change-no-remount trigger and the missing-fulfilled-reducer fact, and cross-link the new PLT id; re-embed so symptom-phrased queries retrieve it."
  retriever_confidence: MEDIUM
