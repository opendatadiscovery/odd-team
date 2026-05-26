# SHB-143 — Primary-navigation tabs render unconditional of feature-flag state

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators see the full nine-tab primary navigation row (Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity) regardless of which Active Features the admin has enabled, because `ToolbarTabs` builds the tab list as a hardcoded literal array and never consults `FeatureController`'s feature-flag output. When `datacollaboration.enabled=false` (the default), clicking the Data Modelling tab navigates to `/data-modelling/query-examples` — a page whose body is gated behind `<WithFeature featureName={Feature.DATA_COLLABORATION}>`, so the operator lands on an empty/non-functional surface with no upstream signal that the affordance was inapplicable.

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:34-82` — the entire `tabs` useMemo is a static literal with no permission / feature-flag predicate; nine tabs are emitted unconditionally.
- `odd-platform-ui/src/components/App.tsx:49` — `fetchActiveFeatures` IS dispatched at App mount, so the feature-flag data IS in redux — but ToolbarTabs.tsx never imports `getActiveFeatures` and never reads it.
- `odd-platform-ui/src/components/DataCollaboration/Message/Message.tsx:59` + `MainThreadMessage.tsx:36` + `DataEntityDetailsHeader.tsx:132` — the pattern that SHOULD be applied: destination pages DO wrap their children in `<WithFeature featureName={Feature.DATA_COLLABORATION}>`. The gating works downstream; only the tab entrypoint is ungated.
- `odd-platform-api/src/main/resources/application.yml` — `datacollaboration.enabled=false` is the DEFAULT.

## Notes

- This is adjacent to F-041 (App Toolbar — unconditional render, no permission gate) but is the DISTINCT feature-flag dimension. F-041 covers permission/role; this covers feature-flag-vs-tab visibility. The cluster_with is intentional — F-041 might absorb this as a facet, or it might graduate as its own F-NNN ("Tab-Visibility Feature-Flag Gap").
- The Master Data tab is a single-feature pillar (Lookup Tables only) — clicking it lands directly on `/master-data/lookup-tables` because no `/master-data` index page exists. If Master Data is reduced to zero sub-features at runtime, the tab still renders.
- Same shape applies to the Management tab (visible to non-admin users — leaks the existence of admin surfaces), and to any future tab whose destination is feature-gated downstream.
- guess: the deliberate intent might be "always show the navigation so operators know what's possible to enable" — but if so, there's no doc, no tooltip on disabled tabs, no greying.

## Next

1. Read `WithFeature.tsx:15-36` to confirm the wrapper is render-blocking (vs. context-only like `WithPermissionsProvider`).
2. Probe (P-174 / P-175 already in flight per ToolbarTabs sidecar): visit each tab under default `datacollaboration.enabled=false` and observe what the operator sees on the destination page.
3. Decide: cluster into F-041 as the "feature-flag dimension" facet, or graduate as a sibling F-NNN.

## Links

- cluster_with: [F-041, F-034]
- merged_into: (open)
- supersedes: []
