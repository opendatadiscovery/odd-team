---
node_id: "odd-platform ts react-component component:DataSourcesList"
node_kind: react-component
axis: ui-components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-22-datasource-ui-reanalysis
---

# DataSourcesList — semantic understanding

## understanding

`DataSourcesList` (DataSourcesList.tsx:28-126) is the **Management → Datasources
screen** — the operator opens the `/management/datasources` tab and sees a
full-height page headed "Datasources" with a running count ("N datasources
overall"), a search box, an "Add datasource" button, and a vertically scrolling
list of cards (one per registered data source: logo, name, ODDRN, description,
namespace, masked collector token). It is the UI entry point (hop 1) of the Data
Source Lifecycle feature (F-031): every datasource the operator registers,
edits, deletes, or whose token they regenerate begins on this screen. The
component is a thin Redux-connected view — it holds only `query` and a mirrored
`totalDataSources` in local state, reads the list / page-info / loading flags
from four selectors, and dispatches exactly one thunk, `fetchDataSourcesList`,
on mount, on every search keystroke, on Enter, and on infinite-scroll. Creating,
editing, and deleting are delegated to the nested `DataSourceForm` modal and
`DataSourceItem` card; this component owns only the catalog browse + search
surface.

## concepts

- entities:
  - "DataSource (the per-card domain object — id, name, oddrn, description, namespace, token; the generated-sources `DataSource` type; one card rendered per item, DataSourcesList.tsx:111-115 → DataSourceItem.tsx:25-126)"
  - "DataSourcesList page state (`{ page, total, hasNext }` — the `CurrentPageInfo` slice field read via `getDataSourcesListPage`, DataSourcesList.tsx:33; drives the count, the infinite-scroll `hasMore`, and the next-page number)"
  - "query (the search string — local React state, DataSourcesList.tsx:43; the value typed into the search box; forwarded verbatim to the backend as the `query` request parameter)"
  - "size = 30 (the fixed page size — a local `const`, DataSourcesList.tsx:42; every `fetchDataSourcesList` dispatch requests 30 items)"
  - "totalDataSources (a LOCAL MIRROR of the slice `total`, DataSourcesList.tsx:44; displayed in the header count; deliberately frozen while a search is active — see bugs_limitations_corner_cases)"
  - "fetchDataSourcesList (the single Redux thunk this screen dispatches — datasources.thunks.ts:14-32; calls `dataSourceApi.getDataSourceList({page,size,query})` → backend `GET /api/datasources`)"
  - "DataSourceForm (the create/edit modal — opened by the 'Add datasource' button via `btnCreateEl` cloning, DataSourcesList.tsx:91-99; the F-031 register/update entry point)"
  - "DataSourceItem / DataSourceSkeletonItem / EmptyContentPlaceholder (the three render states of the list region — populated card, infinite-scroll loader skeleton, and the empty placeholder)"
- operations:
  - "render the Datasources screen (DataSourcesList.tsx:72-122): header + count + search + Add button + scrollable card list"
  - "load page 1 on mount and after a delete (DataSourcesList.tsx:46-48): `useEffect` dispatches `fetchDataSourcesList({page:1,size})` when `query` is empty"
  - "search by name (DataSourcesList.tsx:54-65): a 500ms-debounced dispatch of `fetchDataSourcesList({page:1,size,query})` on each keystroke and immediately on Enter"
  - "infinite-scroll next page (DataSourcesList.tsx:67-70,104-110): `fetchNextPage` dispatches `fetchDataSourcesList({page:page+1,size,query})` when `hasNext` is true and the user scrolls the `#datasources-list` container to the bottom"
  - "open the Add-datasource modal (DataSourcesList.tsx:90-100): the `DataSourceForm` is mounted unconditionally inside `WithPermissions`; its `btnCreateEl` Button is the visible trigger that opens the dialog"
  - "show count (DataSourcesList.tsx:76-78): `<NumberFormatted value={totalDataSources}/> datasources overall`"
- invariants:
  - "Exactly ONE data-fetching thunk is dispatched by this screen — `fetchDataSourcesList`. Register/update/delete/regenerate thunks are dispatched by the nested `DataSourceForm` / `DataSourceItem`, not by this component."
  - "Page size is hard-coded to 30 (`const size = 30`, DataSourcesList.tsx:42) — there is no UI control to change it; the operator cannot page in larger or smaller chunks."
  - "The list region renders ONLY when `dataSourcesList.length > 0` (DataSourcesList.tsx:102); when the list is empty AND not currently fetching, `EmptyContentPlaceholder` renders instead (DataSourcesList.tsx:119-121)."
  - "`EmptyContentPlaceholder` is mounted with NO props (DataSourcesList.tsx:120) — so its own `isContentLoaded`/`isContentEmpty` default both to `true` and its `text` defaults to the i18n key 'No information to display' (EmptyContentPlaceholder.tsx:18-27,46). The list-vs-empty decision is made entirely by the `DataSourcesList.tsx:119` guard, not by the placeholder's own props."
  - "The header count is `totalDataSources`, a LOCAL copy of the slice `total` that is updated ONLY when `query` is empty (DataSourcesList.tsx:50-52). During an active search the count stays frozen at the pre-search catalog total."
  - "Page accumulation is the slice's job, not this component's: page 1 does `setAll` (replace), page>1 does `setMany` (append) — datasources.slice.ts:25-30. The component just calls the thunk with an incremented `page`."
  - "The Add-datasource control and each card's Edit/Delete control are wrapped in `WithPermissions` (DataSourcesList.tsx:90, DataSourceItem.tsx:44,57) — they render to nothing for a user lacking the matching permission (`WithPermissions` returns `null`, WithPermissions.tsx:27-29)."
- audiences:
  - "platform-operator (the Management → Datasources tab — per live docs.opendatadiscovery.org/features/management, WebFetched 2026-05-22 status 200: 'View existing sources, audit ingestion timestamps, edit metadata, link to a Collector + Namespace')"
  - "odd-platform-ui-end-user with at least one of the 4 DATA_SOURCE_* permissions (the route gate, ManagementRoutes.tsx:43-57, admits the screen only to such users)"

## dependencies_semantic

- requires-feature:
  - "`fetchDataSourcesList` thunk (datasources.thunks.ts:14-32) — wraps `dataSourceApi.getDataSourceList`; the only data dependency of this screen. Reaches backend `GET /api/datasources` (DataSourceController.getDataSourceList — see coherence_notes)."
  - "`datasourceSlice` + `datasourceAdapter` (datasources.slice.ts:7-47) — the `createEntityAdapter` store; supplies `getDataSourcesList` (selectAll) and accumulates pages via `setAll`/`setMany`."
  - "`getDataSourcesListPage` / `getIsDataSourcesListFetching` / `getDatasourceDeletingStatuses` selectors (datasources.selectors.ts:9-31) — supply page-info, the fetch loading flag, and the delete loading flag."
  - "`DataSourceForm` (DataSourceForm.tsx:29-173) — the create/edit modal; this screen mounts it as the 'Add datasource' trigger."
  - "`DataSourceItem` (DataSourceItem.tsx:25-126) — the per-card renderer; itself mounts a `DataSourceForm` (edit) and a `ConfirmationDialog` (delete)."
  - "`InfiniteScroll` from `react-infinite-scroll-component` (DataSourcesList.tsx:4,104-110) — the scroll-to-load-more mechanism."
  - "`useDebouncedCallback` from `use-debounce` (DataSourcesList.tsx:3,54) — the 500ms search debounce."
  - "shared elements: `Input` (search-m variant), `Button`, `EmptyContentPlaceholder`, `NumberFormatted`, `ScrollableContainer`, `DataSourceSkeletonItem` — DataSourcesList.tsx:14-26."
- requires-config:
  - "No build-time / env config consumed directly. Behaviour shifts with the platform `auth.type` only indirectly — via whether `usePermissions` resolves any DATA_SOURCE_* permission (which gates the route mount and the Add/Edit/Delete controls)."
- requires-runtime:
  - "React 18 + Redux Toolkit store with the `dataSources` slice registered."
  - "react-i18next `t()` provider — every visible label (`'Datasources'`, `'Search datasource'`, `'Add datasource'`, `'datasources overall'`) is an i18n key (DataSourcesList.tsx:29,75,77,83,96)."
  - "react-router — the component is lazy-loaded and mounted at `path='datasources'` under the Management routes (ManagementRoutes.tsx:11,43-57)."
  - "A reachable odd-platform backend serving `GET /api/datasources` — without it every fetch rejects and the screen shows a server-error toast (handleResponseThunk.ts:34-42) and an empty placeholder."
- coupling:
  - "Route-permission coupling: the screen is mounted by `WithPermissionsProvider` with `allowedPermissions = [DATA_SOURCE_CREATE, DATA_SOURCE_UPDATE, DATA_SOURCE_DELETE, DATA_SOURCE_TOKEN_REGENERATE]` (ManagementRoutes.tsx:46-55). A user with NONE of the four cannot open the tab; the read endpoint itself is NOT permission-gated server-side (see coherence_notes / the backend sidecar)."
  - "Search-parameter coupling: the `query` typed here flows verbatim to the backend `query` parameter; the backend applies a name-PREFIX match on the page and a name-SUBSTRING match on the empty-page count (REFACTOR-425 — see coherence_notes). The UI label 'Search datasource' does not disclose that translation."
  - "Ordering coupling: this screen renders datasources in whatever order the backend returns them. The backend orders `data_source.id ASC` (creation order) and this component applies NO client-side re-sort — so newly-registered sources appear at the BOTTOM of the list (see Category C / coherence_notes)."
  - "Slice-page coupling: `fetchNextPage` relies on `page` coming from `getDataSourcesListPage`; the slice writes `pageInfo.page` from the thunk's returned `page` (datasources.thunks.ts:28, datasources.slice.ts:23). A mismatch between the requested `page` and the stored `page` would break append-vs-replace."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "On mount the screen dispatches fetchDataSourcesList({page:1,size:30}) and renders the returned cards"
    test_class: integration
    criticality: HIGH
    note: "No test file for DataSourcesList exists (Grep-verified — see test_files). The screen's core load path is uncovered."
  - behaviour: "Typing in the search box debounces 500ms then dispatches fetchDataSourcesList with the query; Enter dispatches immediately"
    test_class: unit
    criticality: HIGH
    note: "The debounce + Enter behaviour (DataSourcesList.tsx:54-65) is the most regression-prone logic on the screen and is untested."
  - behaviour: "Scrolling the list to the bottom while hasNext is true dispatches the next page and appends cards (not replace)"
    test_class: integration
    criticality: HIGH
    note: "Infinite-scroll append depends on page>1 → slice setMany (datasources.slice.ts:25-30); a regression here silently drops or duplicates rows."
  - behaviour: "When the fetched list is empty and not loading, EmptyContentPlaceholder ('No information to display') renders instead of the card list"
    test_class: unit
    criticality: MEDIUM
    note: "The empty-state guard DataSourcesList.tsx:119-121."
  - behaviour: "A user lacking DATA_SOURCE_CREATE does not see the 'Add datasource' button"
    test_class: security
    criticality: MEDIUM
    note: "WithPermissions gate at DataSourcesList.tsx:90 — untested at the component level."
  - behaviour: "The header count stays frozen at the pre-search total while a search is active, and resyncs to the slice total once the query is cleared"
    test_class: unit
    criticality: MEDIUM
    note: "The totalDataSources mirror (DataSourcesList.tsx:44,50-52) — an intentional-looking but operator-confusing behaviour; pinned by P-072."
  - behaviour: "A failed GET /api/datasources surfaces a server-error toast and leaves the screen on the empty placeholder (no inline error state)"
    test_class: integration
    criticality: MEDIUM
    note: "handleResponseThunk.ts:34-42 — the screen has no error-specific UI; untested."
- test_files:
  - "NO test file for DataSourcesList exists. Grep for `DataSourcesList` across odd-platform-ui/src found only DataSourcesList.tsx and ManagementRoutes.tsx (the route mount) — no `.test.tsx` / `.spec.tsx`, no `__tests__` entry."
- gaps: |
    The entire screen is untested. The highest-leverage gap is the INTEGRATION
    class: infinite-scroll page accumulation (page 1 = setAll/replace, page>1 =
    setMany/append, datasources.slice.ts:25-30) is the single place a regression
    would silently corrupt what the operator sees — dropped rows, duplicated
    rows, or a search that appends to stale results. The second gap is the UNIT
    class: the 500ms debounce + Enter-immediate logic and the frozen-count
    mirror, both small-but-fiddly and both currently unpinned. A SECURITY-class
    test that the 'Add datasource' button is absent for a user without
    DATA_SOURCE_CREATE would also be cheap and is missing.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Management → Datasources tab this component renders. WebFetched 2026-05-22 status 200. It describes the operator's intent (view/edit/remove sources, the Add button) but is silent on the search box, the list ordering, the infinite-scroll pagination, and the page size."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-22 (status 200). On the screen: verbatim "Registered
      data sources — the platform's view of every system a Collector or
      Push-client is reporting from. View existing sources, audit ingestion
      timestamps, edit metadata, link to a Collector + Namespace." The
      screenshot caption: "every registered data source on a deployment, each
      card showing the source's ODDRN, description, namespace, and a
      partially-redacted Collector token with a Regenerate action." On the Add
      button: verbatim "the + Add datasource button at the top-right is the
      entry-point for registering a source the operator wants to ingest" — but
      "the page does not describe the 'Add datasource' form itself or document
      its specific fields." On search: "The page does not mention search or
      filtering capabilities for the data source list." On ordering /
      pagination: "The page does not describe any list ordering, pagination,
      infinite scroll, or empty-state behaviors."
- doc_drift_findings:
  - "The management doc page is SILENT on the search box. The screen has a prominent 'Search datasource' field (DataSourcesList.tsx:81-89). Documented-feature gap — and a compounding one: the search behaviour itself is the REFACTOR-425 prefix/substring divergence (see bugs_limitations_corner_cases), so even when search IS documented it must be documented with that caveat."
  - "The management doc page is SILENT on list ordering. The screen shows datasources in `data_source.id ASC` (creation order, backend-determined, no client re-sort). An operator who registers a new source and expects it at the top of the list will find it at the bottom. Documented-feature gap — matches the backend getDataSourceList sidecar's ordering drift finding."
  - "The management doc page is SILENT on pagination / infinite-scroll / page size. The screen loads 30 at a time and scroll-loads more (DataSourcesList.tsx:42,104-110). An operator with >30 sources sees only the first 30 until they scroll. Documented-feature gap."
  - "The doc caption says the card shows 'a partially-redacted Collector token'. The card actually renders the token via `DataSourceItemToken` only when `dataSource.token?.value` is truthy (DataSourceItem.tsx:95) and hides it behind a show/hide toggle; the masked value is the backend's `'******'+real-last-6` form. The doc's 'partially-redacted' is accurate at the screen level but, as the backend sidecar notes, does not disclose that the visible part is real token material."

## implicit_adrs

- "Search is debounced at 500ms rather than fired per keystroke — a deliberate request-rate decision" — evidence: DataSourcesList.tsx:54-56 (`useDebouncedCallback(() => dispatch(...), 500)`) + DataSourcesList.tsx:63-65 (`handleKeyDown` fires the SAME debounced callback immediately on Enter) — intent_anchor: "`const handleSearch = useDebouncedCallback(() => { dispatch(fetchDataSourcesList({ page: 1, size, query })); }, 500);`" — the explicit 500ms argument plus the parallel Enter handler that bypasses the wait is a deliberate "debounce typing, but let Enter commit now" interaction decision, not incidental. — confidence: HIGH
- "List browsing uses infinite-scroll (load-30-then-scroll-for-more) rather than numbered pages — a deliberate browse-pattern decision reused across the Management lists" — evidence: DataSourcesList.tsx:104-110 (`InfiniteScroll` with `next={fetchNextPage}` `hasMore={hasNext}` and a skeleton `loader`) + datasources.slice.ts:25-30 (the slice's page>1 `setMany` append is the storage half of the same pattern) — intent_anchor: "`<InfiniteScroll scrollableTarget='datasources-list' next={fetchNextPage} hasMore={hasNext} loader={<DataSourceSkeletonItem length={5} />} dataLength={dataSourcesList.length}>`" — the InfiniteScroll + skeleton-loader + slice-append triad is a complete, intentional design; numbered pagination was not chosen. — confidence: HIGH
- "The create-and-edit form is ONE component (`DataSourceForm`) driven by the presence/absence of a `dataSource` prop, not two separate forms" — evidence: DataSourceForm.tsx:69-87 (`onSubmit` branches `dataSource ? updateDataSource : registerDataSource`; `formTitle` branches `dataSource ? 'Edit datasource' : 'Add datasource'`) + DataSourcesList.tsx:91 (mounted with no `dataSource` → create) vs DataSourceItem.tsx:45-46 (mounted with `dataSource` → edit) — intent_anchor: "`{dataSource ? t('Edit datasource') : t('Add datasource')}`" — the single prop-discriminated form is a deliberate DRY decision; the same component serves both F-031 mutation entry points. — confidence: HIGH
- "Every mutating control on the screen is permission-gated client-side via `WithPermissions`, even though the gates are advisory (the backend is the real authority)" — evidence: DataSourcesList.tsx:90 (Add wrapped in `WithPermissions permissionTo={DATA_SOURCE_CREATE}`) + DataSourceItem.tsx:44,57 (Edit/Delete wrapped in DATA_SOURCE_UPDATE / DATA_SOURCE_DELETE) + WithPermissions.tsx:27-29 (renders `null` when not permitted) — intent_anchor: "`<WithPermissions permissionTo={Permission.DATA_SOURCE_CREATE}>`" — the consistent wrapping of every mutating control (and only mutating controls — the search box and the list are ungated) is a deliberate "hide what you cannot do" UX convention applied platform-wide. — confidence: HIGH

## bugs_limitations_corner_cases

- "The header count freezes during search. `totalDataSources` is a local mirror updated ONLY when `query` is empty (DataSourcesList.tsx:50-52). While the operator is searching, the header keeps showing the PRE-SEARCH catalog total — e.g. searching in a 200-source catalog that matches 3 sources still reads '200 datasources overall' above a 3-card list. The slice DOES carry the correct search-scoped `total`, but this component deliberately ignores it mid-search." — evidence: DataSourcesList.tsx:44,50-52,76-78 — severity: MEDIUM
- "The mount `useEffect` (DataSourcesList.tsx:46-48) has dependency array `[isDataSourceDeleting, query]` and its body runs `if (!query) dispatch(...)`. Because `query` is in the deps, EVERY keystroke re-runs the effect; the effect then no-ops (because `query` is now truthy) while the SEPARATE debounced `handleSearch` does the real search dispatch. On clearing the search box back to empty, the effect fires again and re-dispatches a full page-1 fetch. Net result: a transient double path (the debounced search dispatch AND the effect's clear-triggered dispatch) around the empty/non-empty boundary." — evidence: DataSourcesList.tsx:46-48,54-61 — severity: LOW
- "After a delete the list reloads from page 1 ONLY. The `useEffect` re-fires on `isDataSourceDeleting` and dispatches `{page:1,size}` — but only `if (!query)`. If the operator deletes a card while a search is active, NO refetch happens (the `!query` guard blocks it); the deleted card is removed from the store by the slice's `removeOne` (datasources.slice.ts:38-40), but any rows that a corrected search would now surface on later pages are not reloaded." — evidence: DataSourcesList.tsx:46-48 + datasources.slice.ts:38-40 — severity: LOW
- "Page size is hard-coded to 30 with no UI control (DataSourcesList.tsx:42). An operator cannot change how many sources load per scroll; on a very large catalog this is many scroll-fetches." — evidence: DataSourcesList.tsx:42 — severity: LOW
- "There is no inline error state. A failed `GET /api/datasources` rejects the thunk; `handleResponseThunk` shows a transient server-error toast (handleResponseThunk.ts:34-42) and the screen — with an empty `dataSourcesList` and `isDataSourcesListFetching` false — falls through to `EmptyContentPlaceholder` showing 'No information to display'. The operator sees the SAME empty screen for 'no datasources exist' and 'the backend errored', distinguishable only by the toast they may have missed." — evidence: DataSourcesList.tsx:119-121 + handleResponseThunk.ts:34-42 — severity: MEDIUM
- "The search is name-prefix on the page but name-substring on the empty-page count (the backend REFACTOR-425 divergence — see coherence_notes). Surfaced on THIS screen: when the operator types a substring that is not a prefix of any name (e.g. 'snow' against 'my-snowflake-dev'), the card list is empty but the screen's count region — if it were search-scoped — would read a non-zero total. As it stands the count is frozen at the pre-search total (the bug above), so the divergence is masked HERE; it becomes visible to a programmatic `GET /api/datasources` caller. Recorded so the two bugs are not conflated." — evidence: DataSourcesList.tsx:50-52,87 + coherence_notes (REFACTOR-425) — severity: LOW
- "`EmptyContentPlaceholder` is rendered with `fullPage` defaulting to `true` (EmptyContentPlaceholder.tsx:23,33) INSIDE the same `Grid` that may already contain the header and search box — the placeholder reserves `calc(100vh - 32px)`, so on an empty catalog the operator gets a full-viewport-tall empty block under the header rather than a compact message. Cosmetic." — evidence: DataSourcesList.tsx:119-121 + EmptyContentPlaceholder.tsx:30-51 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "DataSourcesList.tsx:42"
      name: "size (page size)"
      value: "30 (hard-coded const, no UI control)"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "size is a fixed literal 30 — it is never 0 or 1 on this screen; there is no control to set it. (The backend getDataSourceList sidecar covers the size=0/size=1 backend boundary under its own P-037.) The relevant N on THIS screen is the CATALOG size: 0 datasources → EmptyContentPlaceholder; 1 datasource → a single card, infinite-scroll inert (hasNext false)."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:42,102,119-121"
        - q: "What at N = tunable (30)? At N = tunable + 1 (31)? At N = tunable x 100 (3000)?"
          a: "Catalog of exactly 30: one fetch, all 30 cards, infinite-scroll inert (backend page_info.has_next false). Catalog of 31: page 1 shows 30 cards, hasNext true, scrolling to the bottom triggers fetchNextPage → page 2 (1 card) appended via slice setMany. Catalog of 3000: 100 scroll-fetches of 30 to fully enumerate; each fetch is an independent GET /api/datasources?page=N&size=30."
          confidence: PROBE-NEEDED
          evidence: "P-070"
        - q: "What at null / negative / non-numeric?"
          a: "Not reachable from the UI — `size` is a const literal 30; the operator has no input that feeds it. N/A for this component."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:42"
        - q: "What does the operator see at each boundary?"
          a: "At catalog<=30: a complete list, no scroll-load. At catalog>30: the first 30, then a 5-card skeleton loader (DataSourceSkeletonItem length=5) flashes while the next page loads, then 30 more cards. The operator gets no page numbers and no 'showing 30 of N' indicator beyond the (frozen-during-search) header count."
          confidence: PROBE-NEEDED
          evidence: "P-070"
    - location: "DataSourcesList.tsx:54"
      name: "search debounce interval"
      value: "500 (ms, useDebouncedCallback)"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "Not a list-cardinality tunable — it is a debounce delay. At 0ms the search would fire per keystroke (no coalescing); at the chosen 500ms keystrokes within 500ms of each other coalesce into one dispatch."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:54-56"
        - q: "What at N = tunable (500ms) and beyond?"
          a: "At 500ms a fast typist's full word produces ONE search dispatch ~500ms after they stop. A larger value would feel laggy; a smaller value would multiply backend calls. Enter (handleKeyDown, line 63-65) bypasses the wait and commits immediately."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:54-56,63-65"
        - q: "What at null / negative / non-numeric?"
          a: "Not reachable — 500 is a literal argument to useDebouncedCallback; no operator input feeds it."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:54"
        - q: "What does the operator see at each boundary?"
          a: "While the 500ms debounce is pending the list still shows the PREVIOUS query's results; there is no in-search spinner over the list (the only loading UI is the infinite-scroll skeleton). A slow backend plus fast typing means the operator may briefly see results for a query they have already changed."
          confidence: PROBE-NEEDED
          evidence: "P-071"
    - location: "DataSourcesList.tsx:108"
      name: "DataSourceSkeletonItem length (scroll-loader placeholder count)"
      value: "5"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "A cosmetic count of skeleton rows shown while the next page loads. It is fixed at 5 and unrelated to how many rows actually arrive (the next page brings up to 30)."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:108"
        - q: "What at N = tunable and beyond?"
          a: "Fixed literal 5 — never varied. Purely a loading-affordance choice."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:108"
        - q: "What at null / negative / non-numeric?"
          a: "Not reachable — literal."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:108"
        - q: "What does the operator see at each boundary?"
          a: "Five skeleton placeholder cards appear at the bottom of the list during a next-page fetch, then are replaced by the (up to 30) real cards. A mild visual mismatch when the next page brings far more or far fewer than 5 rows."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:104-110"
  name_behavior_pairs:
    - name: "DataSourcesList ('Datasources' screen) / 'Add datasource' button"
      promise: "A button labelled 'Add datasource' (DataSourcesList.tsx:96) promises that clicking it lets the operator register a new data source."
      implementation: "The Button is the `btnCreateEl` of a `DataSourceForm` mounted with NO `dataSource` prop (DataSourcesList.tsx:91-99). DataSourceForm clones the button to attach `onClick={handleOpen}` (DataSourceForm.tsx:159-161) which opens a `DialogWrapper` modal whose Save dispatches `registerDataSource` (DataSourceForm.tsx:69-81). Clicking the button opens the create-datasource modal — exactly as the label promises."
      drift: NONE
      operator_visible_consequence: "No drift. Recorded because the button does not itself create anything — it opens the modal — but that is the conventional reading of an 'Add' button."
      confidence: STATIC-INFERRED
      evidence: "DataSourcesList.tsx:91-99 + DataSourceForm.tsx:69-81,159-161"
    - name: "'Search datasource' input"
      promise: "An input placeholdered 'Search datasource' (DataSourcesList.tsx:83) promises a free-text search that finds datasources matching what the operator types — the natural reading is a substring/contains match anywhere in the name."
      implementation: "The typed value becomes local `query` (handleInputChange, DataSourcesList.tsx:58-61), is debounced 500ms, and dispatched as the backend `query` parameter. The backend (getDataSourceList) filters the PAGE with `DATA_SOURCE.NAME.startsWithIgnoreCase(query)` — a name-PREFIX match — and computes the empty-page count with a `containsIgnoreCase` substring match. The UI applies no filtering of its own."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "The operator typing a fragment that appears in the MIDDLE of a datasource name (e.g. 'flake' for 'my-snowflake-dev') gets ZERO results, because the backend page query matches only name PREFIXES. 'Search datasource' reads as substring search; the implementation is prefix search. This is the UI surface of the backend's REFACTOR-425 divergence."
      confidence: STATIC-INFERRED
      evidence: "DataSourcesList.tsx:58-61,83 + backend getDataSourceList sidecar request_inputs.query (ReactiveDataSourceRepositoryImpl.java:156 startsWithIgnoreCase)"
  orderings:
    - location: "DataSourcesList.tsx:111-115 (dataSourcesList.map render) + datasources.slice.ts:7-9,25-30 (the entity adapter)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "Two layers. (1) Backend: `GET /api/datasources` orders `data_source.id ASC` — creation order — per the getDataSourceList sidecar (ReactiveDataSourceRepositoryImpl.java:62 → JooqQueryHelper.java:45). (2) Redux store: `datasourceAdapter = createEntityAdapter<DataSource>({ selectId })` is created WITHOUT a `sortComparer` (datasources.slice.ts:7-9), so `selectAll` returns entities in INSERTION order. `setAll` (page 1) inserts in the backend's returned order; `setMany` (page>1) appends. Net: the screen renders datasources in backend `id ASC` order, unchanged."
          confidence: STATIC-INFERRED
          evidence: "datasources.slice.ts:7-9,25-30 + backend getDataSourceList sidecar orderings"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Not applicable — the backend orders by `data_source.id` (primary key, unique); there are never equal sort keys, and the entity adapter preserves that unique order."
          confidence: STATIC-INFERRED
          evidence: "datasources.slice.ts:7-9 + backend getDataSourceList sidecar orderings"
        - q: "Which subset is returned when result-set > page size?"
          a: "size=30 per fetch; page 1 = the first 30 by id ASC (setAll/replace), page>1 = the next 30 appended (setMany). The operator sees a growing-by-30 list as they scroll. The store accumulates every page fetched so far."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:42,67-70 + datasources.slice.ts:25-30"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "NO. This component applies no `.sort()`; the entity adapter has no `sortComparer`; the `.map` at DataSourcesList.tsx:111-115 iterates `getDataSourcesList` (selectAll) directly. This RESOLVES the REFERENCE left open in the backend getDataSourceList sidecar's orderings stress finding ('Does any upstream layer re-sort? — the UI MAY re-sort client-side ... REFERENCE to the UI datasources component'): the answer is no — the backend's `id ASC` creation order reaches the operator's screen unchanged, so newly-registered datasources genuinely appear at the bottom of the Management list."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:111-115 + datasources.slice.ts:7-9 (no sortComparer)"
  auth_gates:
    - location: "ManagementRoutes.tsx:43-57 (the route mount) + DataSourcesList.tsx:90 (the Add-button gate)"
      endpoint: "ui_route:/management/datasources (the DataSourcesList screen)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "auth.type is a backend deployment setting; the UI sees only the resolved permission set from `usePermissions`. Under DISABLED the backend grants the full permission set, so the route gate and every control are visible. Under LOGIN_FORM/OAUTH2/LDAP the screen is admitted only if the user holds at least one of DATA_SOURCE_CREATE/UPDATE/DELETE/TOKEN_REGENERATE (ManagementRoutes.tsx:46-55); the Add/Edit/Delete controls each appear only with their specific permission. The data fetch itself (GET /api/datasources) is NOT permission-gated server-side."
          confidence: STATIC-INFERRED
          evidence: "ManagementRoutes.tsx:43-57 + DataSourcesList.tsx:90 + backend getDataSourceList sidecar auth_gates"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP an unauthenticated user is intercepted by the platform auth layer before any Management route renders (the SPA shell redirects to login). Under DISABLED there is no authentication and the screen renders for anyone reaching the deployment. The component itself has no unauthenticated branch."
          confidence: STATIC-INFERRED
          evidence: "ManagementRoutes.tsx:43-57 + backend getDataSourceList sidecar auth_gates (the catch-all .authenticated())"
        - q: "What does a wrong-role caller see?"
          a: "A user with NONE of the 4 DATA_SOURCE_* permissions: `WithPermissionsProvider` still mounts the `DataSourcesList` Component (it gates context, not the mount — WithPermissionsProvider.tsx:30-39), so such a user CAN reach the screen and see the catalog, but every mutating control (Add, Edit, Delete) renders to nothing. A user with e.g. only DATA_SOURCE_UPDATE sees Edit on each card but no Add button and no Delete. The read is open; mutations are hidden."
          confidence: STATIC-INFERRED
          evidence: "WithPermissionsProvider.tsx:30-39 + DataSourcesList.tsx:90 + DataSourceItem.tsx:44,57 + WithPermissions.tsx:27-29"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Client-side: at the route mount (`WithPermissionsProvider allowedPermissions`, ManagementRoutes.tsx:46-55) and on each mutating control (`WithPermissions`, DataSourcesList.tsx:90 / DataSourceItem.tsx:44,57). These gates are ADVISORY — they hide UI; the backend SecurityConstants rules are the real authority for mutations, and the read endpoint has NO backend gate at all. The catalog data is reachable by any authenticated user regardless of what this screen shows."
          confidence: STATIC-INFERRED
          evidence: "ManagementRoutes.tsx:46-55 + DataSourcesList.tsx:90 + backend getDataSourceList sidecar auth_gates"
  resource_boundaries:
    - location: "DataSourcesList.tsx:46-48 (mount useEffect) + DataSourcesList.tsx:54-56 (debounced search) + datasources.slice.ts:19-31 (fetch reducer)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Possible in one window. The screen can have an in-flight debounced search dispatch AND an in-flight scroll-triggered next-page dispatch (fetchNextPage, DataSourcesList.tsx:67-70). The slice keys append-vs-replace on `pageInfo.page` of the RESOLVED payload (datasources.slice.ts:25): a page-2 search response resolving AFTER a page-1 fresh-query response would `setMany`-append page-2 rows of the OLD query onto the new query's page-1 rows. There is no request-generation guard / no abort of stale fetches. P-073 pins whether this race is reachable in practice."
          confidence: PROBE-NEEDED
          evidence: "P-073"
        - q: "Is the call replay-safe?"
          a: "The GET itself is idempotent (read-only — backend sidecar confirms no side effect). Re-dispatching `fetchDataSourcesList` with the same args yields the same payload; page 1 `setAll` overwrites cleanly. The non-idempotent risk is purely ordering of overlapping page requests (above), not the call itself."
          confidence: STATIC-INFERRED
          evidence: "datasources.slice.ts:19-31 + backend getDataSourceList sidecar resource_boundaries"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "The Redux entity adapter store IS the cache. It has no TTL — it holds whatever pages have been fetched until `setAll` (a fresh page-1 fetch) replaces them or `removeOne`/`upsertOne` mutate them. The mount useEffect re-fetches page 1 on every mount and after every delete (when query is empty), so a stale store is corrected on remount; but while the screen stays mounted, a datasource registered in another tab/session does NOT appear until a page-1 refetch is triggered."
          confidence: STATIC-INFERRED
          evidence: "datasources.slice.ts:10-31 + DataSourcesList.tsx:46-48"
  request_inputs:
    - location: "DataSourcesList.tsx:81-89 (the search Input) → DataSourcesList.tsx:43,55 (query state → thunk arg)"
      input_kind: query-param
      input_name: "query (the 'Search datasource' input value)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The placeholder 'Search datasource' (DataSourcesList.tsx:83) promises the operator a free-text search that surfaces datasources matching the entered text — read naturally as 'show me sources whose name contains what I type'."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:83"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "handleInputChange sets local `query` (DataSourcesList.tsx:58-61) → handleSearch dispatches `fetchDataSourcesList({page:1,size,query})` (line 55) → thunk calls `dataSourceApi.getDataSourceList({page,size,query})` (datasources.thunks.ts:20-24) → backend `GET /api/datasources?query=` → ReactiveDataSourceRepositoryImpl.queryCondition binds `DATA_SOURCE.NAME.startsWithIgnoreCase(query)` for the page and `containsIgnoreCase` for the empty-page count (per the backend getDataSourceList sidecar, ReactiveDataSourceRepositoryImpl.java:151-160,80). No UI-side filtering."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:55,58-61 + datasources.thunks.ts:20-24 + backend getDataSourceList sidecar request_inputs.query"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — 'Search datasource' implies a contains/substring search over the name; the backend page query is a name-PREFIX match (`startsWithIgnoreCase`). Nothing in the UI label, placeholder, or any tooltip discloses that only name PREFIXES match. This is the UI surface of the backend REFACTOR-425 prefix/substring divergence."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:83 + backend getDataSourceList sidecar request_inputs.query (startsWithIgnoreCase)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An operator searching for a fragment that appears mid-name (e.g. 'flake' for a source named 'my-snowflake-dev', or 'prod' for 'analytics-prod-warehouse') gets an EMPTY card list and the EmptyContentPlaceholder — the source exists but is invisible to that search. Because the header count is frozen at the pre-search total (the totalDataSources mirror bug), the operator does not even get a '0 of N' hint that their search matched nothing. They are likely to conclude the datasource is not registered."
          confidence: PROBE-NEEDED
          evidence: "P-071"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "On the UI side: NONE — the component holds only `query` and forwards it; there is no second search field. The closer-aligned mechanism (a consistent contains-match, or the data_source FTS vector) lives backend-side and is noted in the backend getDataSourceList sidecar's request_inputs.query Q5."
          confidence: REFERENCE
          evidence: "backend getDataSourceList sidecar request_inputs.query"
      routes_to_finding: "bugs_limitations_corner_cases (search prefix/substring) AND docs_link_semantic.doc_drift_findings (search undocumented + must be documented with the prefix caveat)"
    - location: "DataSourceItem.tsx:21-25 (DataSourceItemProps.dataSource — the prop this screen passes at DataSourcesList.tsx:113)"
      input_kind: body-field
      input_name: "dataSource (the prop passed to each DataSourceItem)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The prop name `dataSource` promises one full data-source domain object — the model behind a single card."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:21-25 + DataSourcesList.tsx:113"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DataSourcesList.tsx:111-115 maps each `dataSource` from `getDataSourcesList` and passes it to `DataSourceItem dataSource={dataSource}`. The card reads .oddrn (logo + ODDRN row), .name (heading + delete-confirm text), .description, .namespace?.name, .token?.value (DataSourceItem.tsx:38-109); .id keys the React list and is the `dataSourceId` for the delete thunk."
          confidence: STATIC-INFERRED
          evidence: "DataSourcesList.tsx:111-115 + DataSourceItem.tsx:31,38-109"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `dataSource` is exactly one DataSource object used to render and act on one card."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:21-126"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — not a silent translation."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:21-25"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the prop is the whole object; fields used are a deliberate subset of the DataSource shape, with no name collision."
          confidence: STATIC-INFERRED
          evidence: "DataSourceItem.tsx:38-109"
      routes_to_finding: "N/A — MATCHES, no finding"
  probes_emitted:
    - probe_id: P-070
      question: "With a catalog of 31 and 3000 datasources, does the screen load 30, then scroll-load the rest 30 at a time, appending (not replacing) — and does the count/skeleton behave correctly at the page boundary?"
      probe_path: "lineage/odd-platform/probes/P-070.yaml"
    - probe_id: P-071
      question: "When the operator types a name SUBSTRING that is not a name PREFIX (e.g. 'flake' for 'my-snowflake-dev'), does the screen show an empty list with no '0-results' signal — confirming the 'Search datasource' label over-promises?"
      probe_path: "lineage/odd-platform/probes/P-071.yaml"
    - probe_id: P-072
      question: "While a search is active, does the header count stay frozen at the pre-search catalog total instead of reflecting the search-scoped total?"
      probe_path: "lineage/odd-platform/probes/P-072.yaml"
    - probe_id: P-073
      question: "Can an overlapping search dispatch and scroll-next-page dispatch resolve out of order and append stale-query rows onto a fresh query's results?"
      probe_path: "lineage/odd-platform/probes/P-073.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 30
    answers_static_inferred: 23
    answers_probe_needed: 5
    answers_reference: 2
    drift_flags: 1
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED — this is a UI screen, not an HTTP endpoint; auth mode applies indirectly. The route is mounted only for users whose resolved permission set (from `usePermissions`) includes at least one DATA_SOURCE_* permission (ManagementRoutes.tsx:46-55). Under DISABLED the backend grants the full permission set so the screen and all controls are open.
- ingestion_filter_relevance: N/A — not HTTP; this is the Management UI surface. The data it shows comes from `GET /api/datasources`, which is the UI admin endpoint, not an `/ingestion/*` path.
- authorization_assertions:
  - "Route-level gate: the screen is wrapped in `WithPermissionsProvider allowedPermissions={[DATA_SOURCE_CREATE, DATA_SOURCE_UPDATE, DATA_SOURCE_DELETE, DATA_SOURCE_TOKEN_REGENERATE]}` — evidence: ManagementRoutes.tsx:43-57. NOTE: `WithPermissionsProvider` with a `Component` prop mounts the Component regardless and only seeds the permission context (WithPermissionsProvider.tsx:30-39) — the route is NOT hard-blocked by these permissions; they populate the context the inner `WithPermissions` gates read."
  - "Control-level gate: the 'Add datasource' button is wrapped in `WithPermissions permissionTo={Permission.DATA_SOURCE_CREATE}` — evidence: DataSourcesList.tsx:90; the button renders to nothing without that permission (WithPermissions.tsx:27-29)."
  - "Per-card Edit / Delete gates live in DataSourceItem (`WithPermissions` for DATA_SOURCE_UPDATE / DATA_SOURCE_DELETE) — evidence: DataSourceItem.tsx:44,57 — recorded here because this screen renders those cards."
- owner_scoping: N/A — this screen is not data-scoped per owner; it renders whatever `GET /api/datasources` returns, and that endpoint applies no owner filter (backend getDataSourceList sidecar: BYPASSES). Every authenticated user who reaches this screen sees the entire datasource catalog.
- data_exposure:
  - "Full live datasource catalog (per card: name, ODDRN, description, namespace, masked token) → any user who reaches the Management → Datasources route. The route is gated only by holding one DATA_SOURCE_* permission, and even that gate is advisory (the underlying GET is ungated server-side)."
  - "Masked collector token → rendered on each card via `DataSourceItemToken` when `dataSource.token?.value` is truthy (DataSourceItem.tsx:95-109). The masked value is the backend's `'******'+real-last-6` form; the card additionally offers a show/hide toggle and a 'Save token in a secure location' warning when revealed (DataSourceItem.tsx:110-121)."
- known_security_gaps:
  - "The client-side permission gates on this screen are advisory only — they hide controls but the backend read endpoint (GET /api/datasources) has no permission gate at all (backend getDataSourceList sidecar). A user without any DATA_SOURCE_* permission is kept off the route by convention, but the catalog data is reachable by any authenticated caller hitting the API directly" — evidence: ManagementRoutes.tsx:46-55 + WithPermissionsProvider.tsx:30-39 + backend getDataSourceList sidecar authorization_assertions — severity: LOW (defence-in-depth observation; the real gap is the backend's, recorded there as MEDIUM)
  - "No inline error UI: a backend failure is shown only as a transient toast; the screen then looks identical to an empty catalog. An operator who misses the toast cannot tell 'no datasources' from 'backend down' — a minor operational-clarity gap, not an exposure" — evidence: DataSourcesList.tsx:119-121 + handleResponseThunk.ts:34-42 — severity: LOW

## performance

- hot_paths:
  - "On every mount the screen dispatches a page-1 fetch (DataSourcesList.tsx:46-48); on every search keystroke a debounced fetch (after 500ms); on every scroll-to-bottom a next-page fetch. The render itself maps `dataSourcesList` to one `DataSourceItem` per row (DataSourcesList.tsx:111-115) — a card with a logo, 3-4 LabeledInfoItems and a token sub-component; render cost grows linearly with the number of accumulated rows." — evidence: DataSourcesList.tsx:46-48,111-115
- throughput_characteristics:
  - "One paginated GET per fetch trigger; size fixed at 30. To enumerate a 3000-source catalog the operator triggers 100 sequential scroll-fetches."
  - "Search is debounced 500ms — caps keystroke-driven request rate; Enter bypasses the debounce for an immediate request."
  - "The Redux entity adapter accumulates every fetched page in memory (setMany append) for the lifetime of the mount — a long scroll session holds all loaded cards' data in the store and all their DOM nodes in `InfiniteScroll`."
- resource_allocation:
  - "DOM/memory grows with scroll depth: `react-infinite-scroll-component` here is not virtualized — it renders ALL accumulated cards (DataSourcesList.tsx:104-116 has no windowing). After scrolling through 1000 sources, ~1000 card DOM subtrees are live. For typical catalogs (<100 sources) this is negligible." — evidence: DataSourcesList.tsx:104-116
  - "No outbound work beyond the GET; no client-side sorting or filtering cost."
- scaling_characteristics:
  - "The screen scales fine for typical Management catalogs (tens of datasources). The unbounded concern is a very large catalog scrolled deeply: non-virtualized infinite-scroll keeps every loaded card mounted. There is no client-side cap and no 'jump to page' — only linear scroll." — evidence: DataSourcesList.tsx:104-116
- known_performance_gaps:
  - "Infinite-scroll is not virtualized — on a large catalog scrolled deeply, DOM node count grows without bound (each page adds up to 30 card subtrees, none recycled)" — evidence: DataSourcesList.tsx:104-116 — severity: LOW (catalog-size-dependent; most deployments have few datasources)

## upstream_callers

- entry_point: "ui_route:/management/datasources"
  caller_node: "odd-platform ts react-component component:ManagementRoutes (route mount at ManagementRoutes.tsx:43-57; the `<Route path='datasources'>` lazy-loads and mounts DataSourcesList inside WithPermissionsProvider)"
  multiplicity_per_trigger: 1
  evidence: "ManagementRoutes.tsx:11 (`React.lazy(() => import('../DataSourcesList/DataSourcesList'))`) + ManagementRoutes.tsx:43-57 (the Route element). One screen mount per navigation to the Datasources tab."
  observation_class: ui-call
  unresolved: false
- entry_point: "ui_route:/management/datasources (operator interaction within the mounted screen)"
  caller_node: "DataSourcesList itself — the screen dispatches fetchDataSourcesList from THREE distinct interaction points"
  multiplicity_per_trigger: "1 on mount (useEffect, DataSourcesList.tsx:46-48); +1 per ~500ms-debounced search keystroke burst (handleSearch, line 54-56); +1 immediately per Enter (handleKeyDown, line 63-65); +1 per scroll-to-bottom while hasNext (fetchNextPage, line 67-70); +1 after each delete completes when query is empty (the same mount useEffect re-firing on isDataSourceDeleting). A single screen-open with no interaction = exactly 1 fetch."
  evidence: "DataSourcesList.tsx:46-48 (mount + post-delete), 54-56 (debounced search), 63-65 (Enter), 67-70 (scroll-next)"
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: external-call
  description: "Dispatches fetchDataSourcesList → `dataSourceApi.getDataSourceList({page,size,query})` → HTTP GET /api/datasources to the odd-platform backend"
  evidence: "DataSourcesList.tsx:47,55,69 + datasources.thunks.ts:20-24"
  cardinality_per_call: "1 GET per fetch trigger (mount / debounced-search-burst / Enter / scroll-next / post-delete)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"

- side_effect_class: page-render
  description: "Renders the Datasources screen: header + count, a 'Search datasource' input, an 'Add datasource' button (permission-gated), and either a scrollable card list (one DataSourceItem per datasource) or the 'No information to display' empty placeholder"
  evidence: "DataSourcesList.tsx:72-122"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"

- side_effect_class: cache-mutate
  description: "Each fetch's fulfilled action writes the Redux `dataSources` slice — page 1 replaces all entities (setAll), page>1 appends (setMany), and pageInfo is overwritten. This is store mutation, not a DB write; recorded because it changes what subsequent renders (and other screens reading the slice) see."
  evidence: "datasources.slice.ts:19-31 (the fetchDataSourcesList.fulfilled reducer)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"

- side_effect_class: log-emit
  description: "On a FAILED GET, handleResponseThunk shows a transient server-error toast (showServerErrorToast); on success the fetch thunk shows no toast (no setSuccessOptions). REFERENCE: the register/update/delete thunks dispatched by the nested DataSourceForm/DataSourceItem DO show success toasts and DO emit backend Activity — those side effects belong to the DataSourceForm / DataSourceItem sidecars (not yet enriched), not to this screen."
  evidence: "datasources.thunks.ts:31 (empty options — no setSuccessOptions, switchOffErrorMessage unset) + handleResponseThunk.ts:34-42"
  cardinality_per_call: "0 on success, 1 toast on failure"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
  unresolved: true

## coherence_notes

- kind: resolves
  target: "odd-platform java DataSourceController controller-method:getDataSourceList"
  note: |
    The backend getDataSourceList sidecar's `orderings` stress finding left a
    REFERENCE open on the question "Does any upstream layer re-sort or filter
    the result?" — verbatim: "The UI MAY re-sort client-side (not in scope for
    this backend node — REFERENCE to the UI datasources component sidecar)."
    This sidecar RESOLVES it: the UI does NOT re-sort. `DataSourcesList` maps
    `getDataSourcesList` (the entity-adapter selectAll) straight to cards
    (DataSourcesList.tsx:111-115); the `datasourceAdapter` is created with no
    `sortComparer` (datasources.slice.ts:7-9), so selectAll preserves insertion
    order, and inserts happen in the backend's returned order. The backend's
    `data_source.id ASC` creation order therefore reaches the operator's screen
    unchanged — newly-registered datasources genuinely appear at the BOTTOM of
    the Management list. The backend sidecar's `name_behavior_pairs` ordering
    drift (MINOR) is confirmed end-to-end as an operator-visible behaviour.
- kind: resolves
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The DataSourceController class sidecar's upstream_callers recorded the UI
    caller as `odd-platform-ui datasources-list React component (not yet
    enriched — REFERENCE)` with `unresolved: true`, naming the expected files
    (datasources.thunks.ts, lib/hooks/api/datasource.ts, lib/api.ts). This
    sidecar resolves that reference for the LIST path: the UI caller is
    `DataSourcesList`, it calls `fetchDataSourcesList` (datasources.thunks.ts:14-32)
    which calls `dataSourceApi.getDataSourceList`. Note the actual call path is
    the thunk + the generated `dataSourceApi` from `lib/api` — there is no
    `lib/hooks/api/datasource.ts` hook in this path (the class sidecar's guess
    of a hooks file does not apply to the datasources list; the thunk pattern is
    used instead).
- kind: refines
  target: "odd-platform java DataSourceController controller-method:getDataSourceList"
  note: |
    The backend getDataSourceList sidecar flags the `query` parameter as
    DRIFT_INPUT_NAME_VS_IMPLEMENTATION (prefix-on-page vs substring-on-count,
    REFACTOR-425). This sidecar refines WHERE the operator meets that drift: the
    `query` parameter is fed by an input the UI labels 'Search datasource'
    (DataSourcesList.tsx:83). So the drift is not abstract — a real operator
    typing a mid-name fragment into a box labelled 'Search datasource' gets zero
    results. The UI compounds it: the header count is frozen at the pre-search
    total (the totalDataSources mirror), so the operator gets no '0 results'
    signal either. The fix surface is twofold — backend (consistent match
    predicate) and UI (either honour substring, or relabel/tooltip the box, or
    show a search-scoped '0 of N').
- kind: relates
  target: "F-031 (Data Source Lifecycle Management feature flow)"
  note: |
    F-031's chain currently records hop 1 (the UI entry point) as
    `node: ts react-component:datasources-list` with `unresolved: true` and was
    composed entirely from backend DataSourceController nodes (per LSN-023).
    This sidecar IS that hop-1 node, now enriched: the Management → Datasources
    screen is the operator entry point from which register / update / delete /
    regenerate-token all start (via the nested DataSourceForm modal and
    DataSourceItem card). F-031's chain[0].unresolved can be flipped to false and
    F-031 is no longer ui-incomplete for the browse/search/entry surface. The
    register/update/delete/regenerate child surfaces (DataSourceForm,
    DataSourceItem, DataSourceItemToken, ConfirmationDialog) remain un-enriched
    and are the next UI nodes F-031 needs. Per LSN-023, the namespace_name field
    of registerDataSource is served by `NamespaceAutocomplete` (DataSourceForm.tsx:124-129)
    — a deliberate select-or-create combo-box, NOT a side-door; that correction
    belongs to the DataSourceForm sidecar.

## sources

- understanding ← DataSourcesList.tsx:28-126 + ManagementRoutes.tsx:43-57 + datasources.thunks.ts:14-32 + WebFetch 2026-05-22 of https://docs.opendatadiscovery.org/features/management (status 200)
- concepts.entities.DataSource ← DataSourcesList.tsx:111-115 + DataSourceItem.tsx:21-126
- concepts.entities.DataSourcesList-page-state ← DataSourcesList.tsx:33 + datasources.selectors.ts:28-31
- concepts.entities.query ← DataSourcesList.tsx:43,58-61
- concepts.entities.size ← DataSourcesList.tsx:42
- concepts.entities.totalDataSources ← DataSourcesList.tsx:44,50-52,76-78
- concepts.entities.fetchDataSourcesList ← datasources.thunks.ts:14-32
- concepts.entities.DataSourceForm ← DataSourcesList.tsx:91-99 + DataSourceForm.tsx:29-173
- concepts.operations ← DataSourcesList.tsx:46-70,72-122
- concepts.invariants.empty-state ← DataSourcesList.tsx:102,119-121 + EmptyContentPlaceholder.tsx:18-51
- concepts.invariants.page-accumulation ← datasources.slice.ts:25-30
- concepts.invariants.permission-gating ← DataSourcesList.tsx:90 + DataSourceItem.tsx:44,57 + WithPermissions.tsx:27-29
- dependencies_semantic.requires-feature.fetchDataSourcesList ← datasources.thunks.ts:14-32
- dependencies_semantic.requires-feature.datasourceSlice ← datasources.slice.ts:7-47
- dependencies_semantic.requires-feature.selectors ← datasources.selectors.ts:9-31
- dependencies_semantic.requires-feature.DataSourceForm ← DataSourceForm.tsx:29-173
- dependencies_semantic.requires-feature.DataSourceItem ← DataSourceItem.tsx:25-126
- dependencies_semantic.coupling ← ManagementRoutes.tsx:46-55 + DataSourcesList.tsx:55 + datasources.slice.ts:7-9,23
- tests_coverage_semantic ← Grep for `DataSourcesList` across odd-platform-ui/src (found only DataSourcesList.tsx + ManagementRoutes.tsx — no test file)
- docs_link_semantic.inferred_docs[0] (management) ← WebFetch 2026-05-22 of https://docs.opendatadiscovery.org/features/management (status 200)
- implicit_adrs[0] (500ms debounce + Enter-immediate) ← DataSourcesList.tsx:54-56,63-65
- implicit_adrs[1] (infinite-scroll not numbered pages) ← DataSourcesList.tsx:104-110 + datasources.slice.ts:25-30
- implicit_adrs[2] (one prop-discriminated form) ← DataSourceForm.tsx:69-87 + DataSourcesList.tsx:91 + DataSourceItem.tsx:45-46
- implicit_adrs[3] (mutating controls permission-gated) ← DataSourcesList.tsx:90 + DataSourceItem.tsx:44,57 + WithPermissions.tsx:27-29
- bugs_limitations_corner_cases (each entry) ← cited inline via evidence: tags
- stress_findings ← DataSourcesList.tsx:28-126 + datasources.thunks.ts:14-32 + datasources.slice.ts:7-47 + ManagementRoutes.tsx:43-57 + WithPermissions.tsx:1-35 + WithPermissionsProvider.tsx:1-52 + DataSourceItem.tsx:21-126 + EmptyContentPlaceholder.tsx:18-55 + handleResponseThunk.ts:1-44 + backend getDataSourceList sidecar
- security.authorization_assertions ← ManagementRoutes.tsx:43-57 + DataSourcesList.tsx:90 + DataSourceItem.tsx:44,57 + WithPermissionsProvider.tsx:30-39 + WithPermissions.tsx:27-29
- security.data_exposure ← DataSourcesList.tsx:111-115 + DataSourceItem.tsx:95-121 + backend getDataSourceList sidecar
- performance.hot_paths ← DataSourcesList.tsx:46-48,111-115
- performance.resource_allocation ← DataSourcesList.tsx:104-116
- upstream_callers ← ManagementRoutes.tsx:11,43-57 + DataSourcesList.tsx:46-70
- downstream_side_effects ← DataSourcesList.tsx:47,55,69,72-122 + datasources.thunks.ts:20-24,31 + datasources.slice.ts:19-31 + handleResponseThunk.ts:34-42
- coherence_notes ← the DataSourceController getDataSourceList method sidecar + the DataSourceController class sidecar (both read this session) + LSN-023

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of a DataSourcesList test file is Grep-verified at commit 80637ed)
- docs_link_semantic: HIGH (management page fetched live this session, status 200)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (each is statically traced; the frozen-count and no-error-state findings are read directly off the component code)
- security: HIGH
- performance: MEDIUM (the non-virtualized-scroll DOM-growth concern is real but uncharacterised at scale — catalog-size-dependent and not probe-pinned, since it is LOW severity for realistic deployments)
- upstream_callers: HIGH (the route mount and the in-screen dispatch points are fully traced)
- downstream_side_effects: HIGH (the log-emit entry carries one unresolved REFERENCE to the un-enriched DataSourceForm/DataSourceItem mutation thunks — the list path's own side effects are fully traced)
- stress_findings: MEDIUM (23 of 30 questions STATIC-INFERRED; 5 PROBE-NEEDED across P-070..P-073, 2 REFERENCE; the load-bearing operator-observable claims — id-ASC ordering reaching the screen unchanged, the search prefix-vs-substring drift, the frozen header count — are all STATIC-INFERRED with strong evidence and additionally probe-guarded)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)
