# SHB-144 — Primary navigation tab labels diverge from URL paths, breaking the operator's URL-mental-model

**Category**: merged
**Severity**: LOW

## Hypothesis

Operators see a "Catalog" tab label that navigates to `/search/<uuid>` (not `/catalog/...`), a "Dictionary" tab label that navigates to `/termsearch/<uuid>` (not `/dictionary/...`), and a "Data Modelling" tab label that navigates to `/data-modelling/query-examples` (not a Data Modelling overview); the labels are pillar-conceptual but the URLs are sub-feature-implementation. An operator who bookmarks the URL they land on after clicking "Catalog" bookmarks a one-time search-id, not a catalog landing; sharing the URL with a colleague shares THEIR search-id, not the catalog.

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:37-39` — Catalog tab label, link = `searchPath()` → `/search`.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:66-69` — Dictionary tab label, link = `termsSearchPath()` → `/termsearch`.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54` — Data Modelling tab label, link = `queryExamplesPath()` → `/data-modelling/query-examples` directly (bypasses `/data-modelling`).
- `odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3-7` — `dataModellingPath()` returns `/data-modelling` but is UNUSED as a tab target — the natural-fit landing helper exists but the tab hardcodes the sub-feature.
- Live docs `https://docs.opendatadiscovery.org/features/data-discovery/search` (WebFetch 2026-05-26, status 200): "select the Catalog tab. There you will find the Search bar" — docs use the label "Catalog" but the URL the user lands on is `/search`. The docs reinforce the conceptual label; the URL diverges silently.

## Notes

- These three labels translate silently to URL families that don't contain the label string anywhere — operator-confusion-shaped, not functionally broken.
- The Data Modelling pillar HAS a second sub-feature (Relationships per `dataModelling/relationshipsRoutes.ts`), but the tab hardcodes Query Examples as the landing. Adding Data Modelling sub-features in the future will compound the drift.
- The Master Data label MATCHES today (one-feature pillar) but becomes a TRANSLATES_SILENTLY drift the moment a second Master Data sub-feature ships.
- Selected-tab highlight uses `pathname.includes(tab.value)` (substring scan) — a future route like `/management-history` or `/data-quality-old` could silently match the wrong tab.

## Next

1. Decide: should pillar-conceptual labels rename to sub-feature labels ("Search" / "Term Search" / "Query Examples") OR should sub-feature URL families be aliased to pillar URLs (`/catalog → /search`)?
2. DOC-NNN — `docs.opendatadiscovery.org/features` does NOT map the 9-tab UI labels to the 6-pillar list documented under `/features/features` (six pillars vs nine tabs is its own framing gap). 
3. Read `dataModelling/relationshipsRoutes.ts` to confirm Relationships is reachable only from inside Query Examples / Data Entity Details, not the toolbar — operator-discoverability gap.

## Links

- cluster_with: [SHB-143, F-041]
- merged_into: F-041
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — F-041 already carries 4 distinct facets that cover the label/URL drift comprehensively: `dictionary_label_vs_termsearch_url_drift_through_i18n_natural_keys`, `catalog_label_vs_search_url_drift_through_i18n_natural_keys`, `data_modelling_label_lands_on_query_examples_specifically_not_pillar_overview`, plus the substring-match fragility facet `tab_selectedness_substring_match_fragile_under_route_rename`. The thread's hypothesis is verbatim covered. F-041: Application Toolbar — drift_class: ui_label_vocabulary_disagrees_with_url_vocabulary (existing).
