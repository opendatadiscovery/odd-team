## REFACTOR-593 — The Data Quality Dashboard's "Title" filter (`titleIds` / `deTitleIds`) silently filters by OWNERSHIP ROLE (`OWNERSHIP.TITLE_ID`), not by dataset title/name — the bare `t('Title')` label invites the wrong mental model; LSN-020 input-name-vs-implementation drift instantiated on the dashboard

**Severity**: HIGH
**Category**: owner-mapping-drift / name-behaviour-drift (LSN-020 class)
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard | P-08 Management — owner association directory]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[0]` (HIGH) — |-
    "**The 'Title' filter (`titleIds` / `deTitleIds`) binds to `OWNERSHIP.TITLE_ID` — ownership role, not dataset title — with no UI signal of the translation.** The label is the bare `t('Title')` (`TitleFilter.tsx:29`). Traced through `filtersAtom` → `getDataQualityTestsRuns` → `DataQualityRunsServiceImpl` → `DataQualityTestFiltersMapper` → `ReactiveDataQualityRunsRepositoryImpl.getConditionsForFilters`, `titleIds` binds to `OWNERSHIP.TITLE_ID.in(titleIds)` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`). `OWNERSHIP.TITLE_ID` references the `TITLE` table — the ownership *role* assigned alongside an owner (e.g. 'Data Steward'). An operator who selects a value in the 'Title' filter expecting to narrow the dashboard to a named dataset narrows it instead to datasets where someone holds that ownership title. This is the LSN-020 input-name-vs-implementation drift class, instantiated on the dashboard."
- `odd-platform__ts__react-component__component__DataQualityFilters.md:stress_findings.request_inputs[TitleFilter]` (DRIFT_INPUT_NAME_VS_IMPLEMENTATION) — the Category-F trace; documents the full SQL bind site and the AND-semantics when Owner + Title are BOTH selected (the SQL puts both predicates in ONE OWNERSHIP join joined by AND, so the operator gets entities where THAT owner holds THAT title — not "owned by Alice OR titled Steward").

**Description**: The Quality Dashboard's filter sidebar exposes a filter labelled `t('Title')` in BOTH the "Filters for tables" and "Filters for tests" sections (`DataQualityFilters.tsx:73, 88`; label at `TitleFilter.tsx:29`). The 'Title' autocomplete is populated by `useGetTitleList` (`TitleFilter.tsx:4`), which lists ownership titles. An operator reading 'Title' in a data-catalog filter panel will reasonably expect to filter by a dataset's title — i.e., the human-readable name of an entity. The implementation does something entirely different:

```
TitleFilter.tsx:29 (label='Title')
  → DataQualityFilters.tsx:73, 88 (filterKey: 'titleIds' / 'deTitleIds')
  → DataQualityStore.ts:32-42 (filtersAtom projects to id[])
  → DataQualityContent.tsx:23-24 (useGetDataQualityDashboard)
  → dataQuality.ts:79 (dataQualityRunsApi.getDataQualityTestsRuns)
  → DataQualityRunsController.java:19-32 (titleIds param)
  → DataQualityRunsServiceImpl → DataQualityTestFiltersMapper.mapToDto
  → ReactiveDataQualityRunsRepositoryImpl.getConditionsForFilters
  → OWNERSHIP.TITLE_ID.in(titleIds)   ← the SQL bind site
                                        (ReactiveDataQualityRunsRepositoryImpl.java:301, 309)
```

`OWNERSHIP.TITLE_ID` references the `TITLE` table — an ownership ROLE such as 'Data Steward', 'Owner', etc., assigned alongside an owner on an entity. The filter actually narrows the dashboard to **entities where SOME owner holds the selected ownership role** — a completely different and much wider slice than "entities named X." When BOTH Owner and Title are selected, the SQL puts both predicates in ONE OWNERSHIP join joined by AND (`ReactiveDataQualityRunsRepositoryImpl.java:297-302`): the result is entities where THAT owner holds THAT title — not entities matching that owner OR that title, and not even entities where the owner exists and (separately) someone has that title. An operator expecting "owned by Alice AND tagged with title X" may get an empty dashboard if Alice's ownership row has a different title.

The mitigation is partial: a careful operator who OPENS the dropdown sees role names ('Data Steward', 'Owner', etc.) and can infer that 'Title' here means ownership role. But the bare LABEL is misleading; the operator who reads the dashboard's filter sidebar at a glance ('Namespace / Datasource / Owner / Title / Tag') maps 'Title' to 'dataset title' as the natural reading of the word in a data catalog.

The same drift is present in the per-dataset DQ Test reports surface (F-022) and other places `titleIds` flows through; the dashboard is the first instance where the file-analyser caught it. The pattern is the same LSN-020 shape this codebase has seen before — `userIds` → `OWNER_ID` (Activity Feed) was the original case; `titleIds` → `OWNERSHIP.TITLE_ID` is the same shape: a generic English word in a UI label that the SQL binds to a specific, narrower column.

**Wisdom-test classification**: GAP. (1) Intentional? NO — no comment defends the bare 'Title' label; no doc page explains the binding; the autocomplete's role-list contents are the ONLY evidence the operator gets. (2) Structural impact? NO — fixing it is a label change ('Ownership Title', 'Ownership Role', or a tooltip qualifier) + a doc note; the SQL is correct for the intended filter, the UI label is what is wrong. (3) Refactoring or structural? REFACTORING — relabelling within the existing filter component is purely cosmetic; no architectural change. → Refactoring scope.

**Primary source citations**:
- `TitleFilter.tsx:29` (`name={t('Title')}` — the misleading label)
- `DataQualityFilters.tsx:73, 88` (the two `filterKey='deTitleIds'` / `'titleIds'` prop assignments)
- `DataQualityStore.ts:32-42` (`filtersAtom` projection — passes ids verbatim)
- `DataQualityContent.tsx:23-24` (the dashboard fetch driver)
- `DataQualityRunsController.java:19-32` (the controller's `titleIds` param)
- `DataQualityTestFiltersMapper.java:9-26` (pass-through to `DataQualityTestFiltersDto`)
- **`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`** (the SQL `OWNERSHIP.TITLE_ID.in(titleIds)` bind site)
- `ReactiveDataQualityRunsRepositoryImpl.java:297-302` (the BOTH-Owner-AND-Title-in-ONE-OWNERSHIP-join semantics)
- LSN-020 (the catalog-wide name-vs-implementation drift class) — case-law precedent

**Existing-ADR-or-implied-prescription**: This is the same shape as the existing **REFACTOR-567** family (`findMyActivities` axis-mismatch — filters by OWNERSHIP.OWNER_ID, not USER_OWNER_MAPPING.OWNER_ID) and **REFACTOR-496** (`getPopularTagList`'s `IdsParam` description-vs-implementation drift). All three are LSN-020 input-name-vs-implementation instances. No ADR prescribes "every user-facing input label must round-trip through the SQL bind site to verify the column matches the label's natural reading" — a procedural prescription like that belongs in the doc-product editorial gate, not as an ADR.

**Proposed remedy**: Three layers, smallest first.

1. **Relabel** the filter in both sections. Replace `t('Title')` with `t('Ownership Title')` or `t('Ownership Role')`. Adopt the same change for the per-dataset DQ surface and any other place `titleIds` is exposed. The translation catalog change is one key per locale; the code change is one line per `*Filter.tsx`.
2. **Add an inline tooltip / helper** on the filter row clarifying "filters to entities where someone has this ownership role" — particularly important because the autocomplete dropdown shows role names which makes the meaning DISCOVERABLE but only AFTER the operator opens it.
3. **Update the live doc** (`docs.opendatadiscovery.org/features/data-quality/dashboard.md`) to enumerate what each of the 5 filter dimensions actually binds to at the SQL layer — the live dashboard page lists the 5 dimensions but does not explain what 'Title' filters by (verbatim absence per the sidecar's `docs_link_semantic.doc_drift_findings[0]` WebFetched 2026-05-22 status 200).

Decide BOTH-Owner-AND-Title semantics intentionally: the current ONE-OWNERSHIP-join-AND is one defensible reading; alternative would be a self-join (entities with Alice as owner UNION entities with title X) which would produce a wider result and likely match more operator intuitions. The choice is a product-owner decision; record it explicitly when the relabel ships.

**Severity rationale**: HIGH. The same LSN-020 class is documented case-law (LSN-020 is in `retrospectives/`); the dashboard instance has a UI label that an operator at a glance will misread, a SQL bind site that produces a structurally different result set, and zero doc disclosure. An operator triaging "why are no failures showing in the X category?" who has 'Title' = 'Data Steward' selected (thinking they filtered to a dataset name) will see a misleadingly-empty dashboard and conclude the catalog has no DQ data — when in fact the catalog is fine, the filter is binding to an unexpected column. Same operator-blindness shape as LSN-020 / LSN-001.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` (with REFACTOR-592 + REFACTOR-594..617) AND `LSN-020 cross-codebase sweep` (with REFACTOR-567 / REFACTOR-496 — all three are instances of the same input-name-vs-implementation pattern; consider a single audit pass over every user-facing form field whose label is a generic word).

---
