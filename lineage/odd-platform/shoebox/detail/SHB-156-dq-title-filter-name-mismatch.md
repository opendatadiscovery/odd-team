# SHB-156 — DQ Dashboard "Title" filter binds to OWNERSHIP.TITLE_ID (ownership role) — not dataset title — with no UI signal of the translation

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators clicking the "Title" filter chip on the Data Quality Dashboard (`/data-quality`) expect to narrow the dashboard rings to datasets matching a particular dataset name/title. Instead the `titleIds` parameter binds at the SQL layer to `OWNERSHIP.TITLE_ID` — the ownership *role/title* (e.g. "Data Steward", "Owner"). The UI label is the bare i18n key `t('Title')` with no qualifier; the autocomplete IS populated by `useGetTitleList` (which lists ownership titles) so a careful operator opening the dropdown sees role names and can infer — but the bare label alone is misleading. Same shape as LSN-020 (`userIds` → `OWNER_ID`).

## Evidence

- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TitleFilter.tsx:29` — label is `t('Title')` (bare i18n key).
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/DataQualityFilters.tsx:73, 88` — `titleIds` / `deTitleIds` keys passed to the same TitleFilter component on both tables-side and tests-side blocks.
- `odd-platform-ui/src/components/DataQuality/DataQualityStore.ts:32-42` — `filtersAtom` projection passes the ids straight through.
- `odd-platform-api/src/main/java/.../ReactiveDataQualityRunsRepositoryImpl.java:301, 309` — the SQL bind: `OWNERSHIP.TITLE_ID.in(titleIds)` references the `TITLE` table.
- Live doc `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (WebFetch 2026-05-22, status 200) lists "Title" as a filter but EXPLICITLY does not explain what it filters by — the doc punts on the ambiguous term.

## Notes

- An operator using the dashboard to investigate "all tests for the 'orders' dataset" picks Title → searches "orders" → finds nothing → assumes there's no orders dataset, when actually they should be filtering by Namespace or Datasource. Diagnostic dead-end.
- Same drift class as LSN-020 (`userIds` → `OWNER_ID`); the dashboard filter panel exhibits the SAME failure mode for a DIFFERENT field.
- Fix is small: relabel to "Ownership Title" or "Owner Role" in the i18n strings (en.json + 5 siblings).
- This is an ENRICHER for F-032 (Quality Dashboard) — F-032 covers the rings but doesn't enumerate the filter-name drift.
- Adjacent finding: the "Namespace" filter also widens silently — it joins both DATA_ENTITY.NAMESPACE_ID AND DATA_SOURCE.NAMESPACE_ID, so a namespace selected matches both entity-direct and datasource-inherited namespaces (per DataQualityFilters sidecar doc_drift_findings[1]). Separate thread candidate.

## Next

1. Promote as ENRICHER to F-032 — primary anchor: the OWNERSHIP.TITLE_ID bind + the UI label.
2. Relabel in `locales/translations/en.json` + 5 siblings: `"Title": "Ownership Title"`.
3. DOC-NNN — update the dashboard doc page to explain what "Title" filters by AND that "Namespace" widens to datasource-inherited.
4. File a sibling thread for the Namespace-filter widening (separate finding, same class).

## Links

- cluster_with: [F-032]
- merged_into: (set when merged into F-032)
- supersedes: []
