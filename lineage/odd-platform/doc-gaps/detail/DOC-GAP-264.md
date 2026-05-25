---
doc_gap_id: DOC-GAP-264
severity: HIGH
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_features:
  - F-022
related_doc_gaps:
  - DOC-GAP-146   # Title directory auto-grows side-door — adjacent Title concept surface
related_retrospectives:
  - LSN-020   # input-name-vs-implementation drift — CANONICAL class
---

## DOC-GAP-264 — Quality Dashboard "Title" filter is an LSN-020 input-name-vs-implementation drift — the UI label is bare `t('Title')` but the `titleIds`/`deTitleIds` query parameter binds at the SQL layer to `OWNERSHIP.TITLE_ID` (ownership ROLE, e.g. "Data Steward"), NOT to any dataset name/title; the live `/features/data-quality/dashboard` page lists "Title" as one of the five filter dimensions but DOES NOT explain what it filters by; an operator selecting a value expecting to narrow the dashboard to a named dataset narrows it instead to entities where someone holds that ownership role — and when Owner+Title are both selected the SQL puts them in ONE OWNERSHIP join joined by AND, so an operator expecting "owned by Alice AND tagged Title X" may get an empty dashboard if Alice's ownership row carries a different title

**Severity**: HIGH
**Category**: drift (LSN-020 input-name-vs-implementation — same class as `userIds`→`OWNER_ID` and `getPopularTagList`'s `ids` parameter; the Quality Dashboard's filter panel inherits the same defect)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityFilters.md:docs_link_semantic.doc_drift_findings.[0]` (HIGH per sidecar — *"DOC DRIFT — the 'Title' filter is undocumented and its name is misleading. The live `dashboard` page (WebFetched 2026-05-22 status 200) lists 'Title' as one of the five filter dimensions but explicitly does NOT explain what it filters by. The UI label is the bare i18n key `t('Title')` (`TitleFilter.tsx:29`). The `titleIds` parameter binds at the SQL layer to `OWNERSHIP.TITLE_ID` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`) — the ownership *title/role* (e.g. 'Data Steward', 'Owner'), a concept distinct from a dataset's name."*)
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar — full SQL trace through `filtersAtom` → `getDataQualityTestsRuns` → `DataQualityRunsServiceImpl` → `DataQualityTestFiltersMapper` → `ReactiveDataQualityRunsRepositoryImpl.getConditionsForFilters` to `OWNERSHIP.TITLE_ID.in(titleIds)`)
- `odd-platform__ts__react-component__component__DataQualityFilters.md:stress_findings.request_inputs[Title filter]` — Category-F drift `DRIFT_INPUT_NAME_VS_IMPLEMENTATION`; pinned by probe **P-110** (`lineage/odd-platform/probes/P-110.yaml`)
- `odd-platform__ts__react-component__component__DataQualityFilters.md:tests_coverage_semantic.uncovered_behaviours[Title-filter-scope]` (criticality HIGH — *"no test pins what the 'Title' filter actually filters by; the SQL bind is OWNERSHIP.TITLE_ID"*)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim: *"No description provided. The 'Title' dimension is listed among available filters but receives no explanation of how it operates or what it filters."*
- The page DOES list the five dimensions verbatim: *"Namespace, Datasource, Owner, Title, and Tag"* — so "Title" is a named, prominent filter chip with no doc-side disambiguation.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TitleFilter.tsx:29` — verbatim: `name={t('Title')}` (a bare i18n key; no qualifier like "Ownership Title" or "Ownership Role")
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/DataQualityFilters.tsx:73, 88` — the two mount sites: `<TitleFilter filterKey='deTitleIds' />` (tables block) + `<TitleFilter filterKey='titleIds' />` (tests block)
- `odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:301, 309` — the SQL bind: `OWNERSHIP.TITLE_ID.in(titleIds)` (line 301 in the combined-with-Owner branch, line 309 in the title-only branch); `OWNERSHIP.TITLE_ID` references the `TITLE` table whose rows are ownership ROLES (e.g. "Data Steward", "Owner")
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TitleFilter.tsx:4` — `useGetTitleList` populates the autocomplete options from the ownership-title list API; a careful operator who opens the dropdown sees role names and can infer the meaning (partial mitigation), but the bare label alone misleads
- **Combined Owner+Title corner case** — `ReactiveDataQualityRunsRepositoryImpl.java:297-302`: when both `ownerIds` and `titleIds` are supplied, the SQL builds ONE OWNERSHIP join joined by AND on `OWNER_ID.in(ownerIds).and(TITLE_ID.in(titleIds))`. The result is entities where THAT owner holds THAT title — NOT entities where the owner exists OR someone has that title separately. An operator expecting "owned by Alice AND (separately) some entity has Title X" gets a different (and likely empty) result.

### Drift narrative

The Quality Dashboard's "Title" filter is the third instance of the LSN-020 class surfaced this campaign:
1. Activity Feed `userIds` parameter → binds to `OWNER_ID` (LSN-020 original case)
2. `getPopularTagList`'s `ids` parameter → shared `IdsParam` describes "Entity ids" but filters by tag id (DOC-GAP-255 batch X-TAGGING co-located drift)
3. **This finding** — Quality Dashboard `titleIds`/`deTitleIds` parameter → binds to `OWNERSHIP.TITLE_ID` (ownership role), label says "Title"

The pattern is recurrent: a generic word used as a user-facing label binds at the data layer to a different entity than the word naturally suggests. "Title" in a data catalog suggests dataset name/title; the implementation filters by ownership role. The dashboard doc lists "Title" as one of five dimensions and does NOT explain what it filters by — leaving the operator to discover the binding by opening the dropdown and inferring from option content. For operators who type a known dataset name into the filter, the dashboard will return zero results (no ownership-role row carries a dataset name) and the operator has no signal that the filter is binding to a different concept.

The combined Owner+Title corner case amplifies the operator-impact: an operator who selects an owner AND a title expecting "owned by X AND some entity also has title Y" gets the AND-within-a-single-ownership-row interpretation, which is far narrower. An empty dashboard result is interpreted as "no failing tests" when it actually means "no entity has BOTH this owner AND this ownership-title row" — a silent data-quality signal loss.

### Proposed doc action

**Three-part action** — doc-side primary + UI-label improvement (recommended) + code-side comment (optional).

1. **Doc-side PRIMARY — `documentation/docs/features/data-quality/dashboard.md`** — add a "Filter dimensions reference" sub-section after the five-dimension list, with one short paragraph per filter:

   > **Namespace** — narrows the dashboard to entities whose namespace (or whose datasource's namespace) matches the selection. The match is inclusive: selecting namespace X matches both entities directly assigned to X and entities whose datasource is in X. [see DOC-GAP-272 for the widening drift]
   >
   > **Datasource** — narrows the dashboard to entities belonging to the selected data source(s).
   >
   > **Owner** — narrows the dashboard to entities owned by the selected owner(s).
   >
   > **Title — IMPORTANT: this filter binds to OWNERSHIP ROLE (e.g. "Data Steward", "Owner"), NOT to a dataset's name.** Selecting a value narrows the dashboard to entities where AT LEAST one owner holds that ownership role. When combined with the Owner filter, both apply to the SAME ownership row — i.e. "owned by X with role Y", not "owned by X AND some other entity has role Y". To filter by a dataset's name, use the main catalog search instead.
   >
   > **Tag** — narrows the dashboard to entities carrying the selected tag(s).

2. **UI-side RECOMMENDED — `odd-platform-ui/.../FilterItem/TitleFilter.tsx:29`** — rename the label from `t('Title')` to `t('Ownership title')` or `t('Ownership role')`. The change is one line + one i18n key migration; it removes the operator-trap at the source. The corresponding `name={...}` change on the autocomplete chip will make the filter self-documenting.

3. **Code-side COMMENT — `ReactiveDataQualityRunsRepositoryImpl.java:296-311`** — add a one-line comment naming the LSN-020 binding: `// titleIds binds to OWNERSHIP.TITLE_ID (ownership role); see LSN-020 / DOC-GAP-264`.

### Cross-references

- **LSN-020** — canonical input-name-vs-implementation drift; this is the third confirmed instance in the catalog.
- **DOC-GAP-255** (Tag api-reference + co-located `IdsParam` `getPopularTagList` LSN-020 drift) — adjacent instance, same class, different surface.
- **DOC-GAP-146** (Title directory auto-grows via `ownershipForm.titleName` side-door) — Title CONCEPT cluster cross-link; the same "Title" entity that's auto-creatable in the side-door is the entity bound here.
- **probe P-110** — runtime confirmation of the SQL bind end-to-end.
- **Rule 6 coherence** — cross-registry sweep ran (LSN-020 + Title-related entries in concepts + feature-flows): all SAME-POLARITY. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

HIGH. The Title filter is a load-bearing chip in the dashboard's filter sidebar; an operator using it for its named-by-the-label purpose (filter by dataset name) gets either an empty result or a wider-than-expected result. The combined Owner+Title corner case silently loses data-quality signal. The fix is one paragraph in the dashboard doc plus a one-line UI relabel — both cheap. The operator-trap class (LSN-001/LSN-002) is the same shape as canonical maintainer-pact violations.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the "Title" filter is listed without explanation; SQL binding to `OWNERSHIP.TITLE_ID` re-confirmed at substrate commit `ede5d277` per `ReactiveDataQualityRunsRepositoryImpl.java:301, 309`.
