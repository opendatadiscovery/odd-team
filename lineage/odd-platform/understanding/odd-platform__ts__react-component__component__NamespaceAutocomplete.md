---
node_id: "odd-platform ts react-component component:NamespaceAutocomplete"
node_kind: react-component
axis: ui-components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-22-datasource-ui-reanalysis-NamespaceAutocomplete
---

# NamespaceAutocomplete — the select-or-create namespace combo-box — semantic understanding

## understanding

`NamespaceAutocomplete` is the **select-or-create combo-box** a user fills in
the "Namespace" field of the Add/Edit-datasource form (and four other forms).
From the user's seat: they click into the field, a dropdown opens showing
existing namespaces; as they type, the list debounce-filters (500ms) to
namespaces matching what they typed; if they type a name that matches **no**
existing namespace, a final highlighted row appears reading *"No result. Create
new custom namespace «what-they-typed»"* — selecting it (or pressing Enter)
takes the typed text as the value. The default, expected path is **picking an
existing namespace**; the create row is the **no-match fallback**, explicitly
labelled. The component never calls a create API itself — on form submit the
parent sends the chosen-or-typed text as a plain `namespaceName` string and the
backend `DataSourceController.registerDataSource` get-or-creates a namespace on
it. This is the canonical instance of a UX pattern reused across ~11 sibling
autocompletes in `components/shared/elements/Autocomplete/` (Owner, Role, Term,
Policy, Provider, SlackChannels, …); LSN-023 records that this component's
backend was previously mis-read, from a backend-only chain, as a "permission
side-door" — the present sidecar is the UI-side evidence that it is a
deliberate, labelled UX affordance.

## concepts

- entities:
  - "Namespace (the generated-sources DTO; the dropdown options are `Namespace` rows, narrowed to `FilterOption = Omit<Namespace,'id'|'name'> & Partial<Namespace>` so a not-yet-created option can carry a `name` but no `id`) — NamespaceAutocomplete.tsx:15,25"
  - "FilterOption (local type — an existing namespace HAS `id`; a create-suggestion option has `name` only and `id` undefined; `option.id` truthiness is the discriminator in `renderOption`) — NamespaceAutocomplete.tsx:25,168"
  - "ControllerRenderProps<…,'namespaceName'> (the react-hook-form field this component is the input for — bound from FIVE parent form types: Term / DataEntityGroup / DataSource / Collector / LookupTable) — NamespaceAutocomplete.tsx:27-34"
  - "namespaceName (the form field — a plain `string`; the component's only output, emitted via `onChange`) — NamespaceAutocomplete.tsx:29-33,127"
  - "searchNamespace (alias for the `fetchNamespaceList` redux thunk — the read side; resolves to a `{ namespaceList, pageInfo }` page) — NamespaceAutocomplete.tsx:20,52-57"
  - "AutocompleteSuggestion (the child component rendering the «No result. Create new custom namespace X» label) — NamespaceAutocomplete.tsx:22,171-174"
- operations:
  - "open-dropdown — `onOpen` sets `autocompleteOpen=true`; the `useEffect` then triggers a search (NamespaceAutocomplete.tsx:138-140,106-111)"
  - "debounce-search — `handleSearch` dispatches `searchNamespace({query: searchText, page:1, size:30})` behind a 500ms debounce; on resolve, `setOptions(namespaceList)` (NamespaceAutocomplete.tsx:49-60)"
  - "filter-as-you-type — `getFilterOptions` runs MUI's `createFilterOptions` over the fetched `options` (NamespaceAutocomplete.tsx:74-89)"
  - "offer-create-on-no-match — when `searchText !== '' && !loading && no option's name equals the typed inputValue`, append a synthetic `{ name: inputValue }` option to the list (NamespaceAutocomplete.tsx:78-84)"
  - "emit-chosen-name — `handleOptionChange` resolves the selected option (object with `name`, or raw typed string) to a plain string and calls the form field's `onChange` (NamespaceAutocomplete.tsx:113-130)"
  - "render-create-row — `renderOption` shows the namespace name for an existing option (`option.id` truthy) or the «Create new custom namespace» suggestion for a create option (`option.id` falsy) (NamespaceAutocomplete.tsx:165-178)"
- invariants:
  - "The create suggestion is offered ONLY on a genuine no-match: the guard `!options.some(option => option.name === params.inputValue)` requires NO fetched option to have a name exactly equal to the typed text (NamespaceAutocomplete.tsx:81)"
  - "The component's output is ALWAYS a plain string — `onChange(newField?.name || '')`; an object option contributes only its `name`, a raw string passes through, a null clear yields `''` (NamespaceAutocomplete.tsx:127)"
  - "The component performs NO write — it never dispatches `createNamespace`; namespace persistence happens server-side in `registerDataSource` (NamespaceAutocomplete.tsx whole file — `searchNamespace` is the only thunk imported; create is the backend's `getOrCreate`)"
  - "`freeSolo` is enabled — a value typed and Enter-confirmed without selecting any row is accepted as the field value (NamespaceAutocomplete.tsx:150 + 124-126)"
  - "On a select (`reason !== 'input'`), the input text is CLEARED — `handleInputChange` sets `searchText=''` (NamespaceAutocomplete.tsx:99-101)"
- audiences:
  - "platform-operator (fills the Namespace field of the Add/Edit-datasource form — Management → Datasources tab; the '+ Add datasource' button is the documented entry-point per the live Management doc page, WebFetched 2026-05-22)"
  - "any user authoring a Term, Data Entity Group, Collector, or Lookup Table (the same component is the namespace field on all five forms — NamespaceAutocomplete.tsx:27-34)"

## dependencies_semantic

- requires-feature:
  - "`fetchNamespaceList` redux thunk (imported aliased as `searchNamespace`) — the read side; calls `namespaceApi.getNamespaceList({page,size,query})` and returns `{namespaceList: items, pageInfo}` (namespace.thunks.ts:13-28). This is the 1-hop link to the backend `GET /api/namespaces`."
  - "`namespaceApi.getNamespaceList` (generated OpenAPI client) — the actual HTTP call behind the thunk (namespace.thunks.ts:11,19-23)."
  - "`AutocompleteSuggestion` shared component — renders the «No result. Create new custom namespace X» two-part label (AutocompleteSuggestion.tsx:23-30)."
  - "`Input` shared component — the text-field shell, given a loading state (NamespaceAutocomplete.tsx:23,155-164)."
  - "MUI `Autocomplete` + `@mui/material/useAutocomplete` (`createFilterOptions`, `FilterOptionsState`, `AutocompleteInputChangeReason`) — the underlying combo-box widget and its filter primitive (NamespaceAutocomplete.tsx:2-7)."
  - "`use-debounce` `useDebouncedCallback` — the 500ms search debounce (NamespaceAutocomplete.tsx:8,50-58)."
  - "`react-hook-form` `ControllerRenderProps` — the component is a controlled form input; the parent `<Controller name='namespaceName'>` supplies `controllerProps` (NamespaceAutocomplete.tsx:9,128 of DataSourceForm.tsx)."
  - "`react-i18next` `useTranslation` — labels `Namespace`, `custom namespace`, and (via AutocompleteSuggestion) `No result.` / `Create new` are translatable (NamespaceAutocomplete.tsx:10,39,160-162,172)."
- requires-config:
  - "N/A — a pure UI component; no config keys, env vars, or feature flags gate it."
- requires-runtime:
  - "A running odd-platform backend exposing `GET /api/namespaces` — without it the dropdown stays empty and `loading` may not clear (the `.then()` never runs if the thunk rejects; see resource_boundaries)."
  - "React 18 client runtime; redux store with the `namespace` slice registered (the thunk's `.fulfilled` is also reduced into `namespace.slice.ts:21`, though this component reads results directly from `.unwrap()`, not the slice)."
- coupling:
  - "The component is coupled to the backend's get-or-create contract: it deliberately emits a plain `namespaceName` STRING (never an id) so the backend `namespaceService.getOrCreate` can resolve-or-create. A backend change to require a `namespace_id` would break this component's entire create path (see coherence_notes — this is the LSN-023 cross-reference)."
  - "Coupled to `Namespace.id` as the existing-vs-new discriminator: `renderOption` keys on `option.id` truthiness (line 168) and the no-match guard keys on `option.name` (line 81). A generated-sources change making `Namespace.id` optional/renamed shifts both behaviours."
  - "Five parent forms pass `controllerProps` for a field literally named `namespaceName` (NamespaceAutocomplete.tsx:29-33) — the union type is the coupling surface; a sixth form must add its `ControllerRenderProps<…,'namespaceName'>` to the union or TypeScript rejects it."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Selecting an existing namespace from the dropdown emits that namespace's `name` (string) to the form field."
    test_class: unit
    criticality: HIGH
    note: "The default, most-common path; `handleOptionChange` object branch (NamespaceAutocomplete.tsx:117-121,127). No `NamespaceAutocomplete.test.tsx` exists (Grep for `NamespaceAutocomplete` test files found none)."
  - behaviour: "Typing a name that matches no existing namespace shows exactly one «Create new custom namespace X» suggestion row."
    test_class: unit
    criticality: HIGH
    note: "The `getFilterOptions` no-match branch (NamespaceAutocomplete.tsx:78-84). This is the affordance LSN-023 turns on — it has no test."
  - behaviour: "Typing a name that EXACTLY matches an existing fetched namespace does NOT show the create suggestion."
    test_class: unit
    criticality: HIGH
    note: "The `!options.some(o => o.name === inputValue)` guard (line 81). The negative case — a regression here re-introduces the duplicate-looking create row for existing names."
  - behaviour: "Selecting the create suggestion (or Enter on freeSolo input) emits the typed text verbatim as the field value."
    test_class: unit
    criticality: HIGH
    note: "`handleOptionChange` string branch + object-without-id branch (NamespaceAutocomplete.tsx:117-127)."
  - behaviour: "End-to-end: choosing «Create new custom namespace X» and submitting the datasource form creates exactly one namespace named X and links the data source to it."
    test_class: integration
    criticality: HIGH
    note: "UI → registerDataSource thunk → POST /api/datasources → namespaceService.getOrCreate. Probe P-089."
  - behaviour: "When more existing namespaces share a prefix than the 30-row fetch cap, an exact-match existing namespace outside the window is mislabelled as creatable."
    test_class: integration
    criticality: MEDIUM
    note: "The `size: 30` cap (line 52) vs the client-side no-match guard (line 81). Probe P-086."
  - behaviour: "The combo-box applies no client-side shape (trim / max-length / charset) to a freeSolo-typed namespace name before emitting it."
    test_class: integration
    criticality: MEDIUM
    note: "No validation rule on the parent's `namespaceName` Controller (DataSourceForm.tsx:124-129); `handleOptionChange` does not trim (line 124-127). Probe P-087."
  - behaviour: "Out-of-order resolution of two debounced searches leaves `options` holding stale-query results / does not strand the loading spinner."
    test_class: integration
    criticality: MEDIUM
    note: "No request-sequence guard / AbortController; `loading` is set from both the effect and the `.then()`. Probe P-088."
  - behaviour: "If `searchNamespace` rejects, `loading` is reset (the spinner does not strand on)."
    test_class: integration
    criticality: MEDIUM
    note: "`.then()` has no `.catch()` (NamespaceAutocomplete.tsx:53-57); on rejection `setLoading(false)` never runs. Routed to bugs_limitations_corner_cases; not separately probed in P-086..P-089."
  - behaviour: "Keyboard-only operation: open / type / arrow-to-create-row / Enter / clear all reachable without a pointer (`handleHomeEndKeys`, `selectOnFocus`)."
    test_class: integration
    criticality: LOW
    note: "Accessibility of the create affordance; `handleHomeEndKeys` + `selectOnFocus` are set (NamespaceAutocomplete.tsx:151-152). The sibling OwnerAutocomplete additionally sets `blurOnSelect` — NamespaceAutocomplete does not (a behavioural inconsistency, see bugs_limitations)."
- test_files:
  - "NO `NamespaceAutocomplete.test.*` / `.spec.*` exists (Grep for `NamespaceAutocomplete` across the UI tree found only the component, its importers, and this batch's probes — no test file)."
  - "NO co-located test for any sibling under `components/shared/elements/Autocomplete/` was found in the same Grep — the entire shared-autocomplete pattern is untested at the component level."
- gaps: |
    The component has ZERO test coverage, and `integration` is the worst-covered
    class — every operator-observable behaviour of the create affordance crosses
    the UI→thunk→backend boundary and none of it is asserted. The highest-leverage
    gap is the end-to-end create path (P-089): without it, a refactor of either
    the no-match guard (line 81) or the backend get-or-create contract silently
    breaks the labelled "Create new custom namespace" affordance and there is no
    regression net. The second priority is the `unit` negative case — "exact
    match does NOT offer create" (line 81) — because that single boolean is what
    separates the intended select-or-create UX from a confusing duplicate-create
    prompt. Because this is the CANONICAL instance of an ~11-component shared
    pattern, one well-built test suite here is a template the siblings can copy.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The Management → Datasources page is the closest user-facing doc for the form this component lives in. WebFetched 2026-05-22: it documents the '+ Add datasource' entry-point but says nothing about the Namespace field, the dropdown, or the create-on-no-match affordance."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim, WebFetched 2026-05-22 (status 200): "the + Add datasource button at the top-right is the entry-point for registering a source the operator wants to ingest."
      Verbatim (namespaces, general): "Logical groupings used to scope tags, terms, and other taxonomy concepts. Acts as a label dimension applied across the catalog."
      Verbatim (deployment sequence): "Create a namespace before authoring tags or terms that should be scoped to a particular team or domain."
      The page does NOT document: that the datasource form has a Namespace field, that the field is a search-as-you-type combo-box over existing namespaces, or that typing an unknown name offers a labelled "Create new custom namespace" option. The fetched content confirms the absence — there is no description of namespace selection or creation within the datasource workflow.
- doc_drift_findings:
  - "The Management page documents the '+ Add datasource' button but not the Namespace field's select-or-create behaviour — an operator is not told that typing an unknown namespace name will CREATE that namespace on save. The create affordance is labelled in the UI («Create new custom namespace X») but undocumented; the doc gap, not the UI, is what made LSN-023's backend-only reading look like a hidden side-door."
  - "The deployment-sequence advice 'Create a namespace before authoring tags or terms' implies namespaces must pre-exist; the datasource form (and the four other forms using this component) in fact let a user create a namespace inline. The docs and the product disagree on whether namespace creation is a prerequisite step or an inline affordance."

## implicit_adrs

- "Associate-or-create relationships are entered through a single select-or-create combo-box: the control shows existing values, filters as the user types, and offers an explicitly-labelled «Create new …» row only on a genuine no-match; the backend get-or-creates on the typed name. The UI never calls a separate create API for the associated entity." — evidence: NamespaceAutocomplete.tsx:74-84 (no-match guard + synthetic option) + 165-178 (`renderOption` existing-vs-create branch) + 113-130 (emits a plain name string, never an id) + AutocompleteSuggestion.tsx:23-30 (the «No result. Create new …» label) + the same shape in OwnerAutocomplete.tsx:67-80,118-133 — intent_anchor: the comment `// Suggest the creation of a new value` (NamespaceAutocomplete.tsx:77) directly above the no-match branch states the intent; the `AutocompleteSuggestion` component exists solely to render a deliberate, translatable "Create new {label}" affordance; and the pattern is applied consistently across ~11 sibling autocompletes under `components/shared/elements/Autocomplete/` — a convention, not an accident. (APPROACH.md rule 19 — UX patterns are ADR candidates.) — confidence: HIGH
- "The combo-box is intentionally `freeSolo`: a value the user types and confirms with Enter without picking any row is accepted as the field value, so the create path works by keyboard alone and does not require the user to mouse onto the suggestion row." — evidence: NamespaceAutocomplete.tsx:150 (`freeSolo`) + 62-65 (`getOptionLabel` comment `// Value selected with enter, right from the input`) + 123-126 (`handleOptionChange` comment `// Create value from keyboard` wrapping the `typeof newValue === 'string'` branch) — intent_anchor: two in-code comments (`Value selected with enter, right from the input`, `Create value from keyboard`) explicitly document that the raw-string path is a designed keyboard affordance, not an accident of `freeSolo`. — confidence: HIGH
- "Existing-namespace identity is the presence of a server-assigned `id`; a create-suggestion option deliberately has a `name` but no `id`, and `renderOption` branches on `option.id` to decide whether to show the plain name or the «Create new» label." — evidence: NamespaceAutocomplete.tsx:25 (`FilterOption = Omit<Namespace,'id'|'name'> & Partial<Namespace>` — `id` made optional ON PURPOSE) + 168 (`option.id ? option.name : <AutocompleteSuggestion .../>`) — intent_anchor: the `FilterOption` type is hand-authored to make `id` optional specifically so an un-persisted option is representable; the ternary on `option.id` is the deliberate existing-vs-new switch. — confidence: HIGH

## bugs_limitations_corner_cases

- "If `searchNamespace` rejects (backend down, network error, 4xx/5xx), the loading spinner strands ON — the dispatch chain `.unwrap().then(...)` has no `.catch()`, so `setLoading(false)` (NamespaceAutocomplete.tsx:56) never runs and the field shows a permanent spinner with an empty dropdown." — evidence: NamespaceAutocomplete.tsx:52-57 (`.then()` only, no `.catch()`) + 51 (`setLoading(true)` before the dispatch) — severity: MEDIUM
- "The create suggestion can be offered for a namespace that ALREADY exists when more than 30 namespaces share the typed prefix: `searchNamespace` caps the fetch at `size: 30` (line 52) but the no-match guard `!options.some(o => o.name === inputValue)` (line 81) only inspects the 30 fetched rows — an exact match outside the window passes the guard and the user is shown «Create new custom namespace «existing-name»». The backend `getByName` resolves the existing row so no duplicate is created, but the UI label is wrong." — evidence: NamespaceAutocomplete.tsx:52 (`size: 30`) + 81 (no-match guard over `options`) — severity: MEDIUM (verified-by-probe P-086)
- "`getFilterOptions` ignores its own filtered result on the no-match branch: it computes `const filtered = filter(options, params)` (line 76) but the no-match `return` ships `[...options, {name: inputValue}]` — the UNfiltered full `options` list plus the suggestion (line 83), not `[...filtered, ...]`. While a create suggestion is showing, the dropdown lists every fetched namespace, not just the ones matching the typed text. The sibling `OwnerAutocomplete` returns `[...filtered, {name: query}]` (OwnerAutocomplete.tsx:77) — the two canonical-pattern instances disagree." — evidence: NamespaceAutocomplete.tsx:76,83 vs OwnerAutocomplete.tsx:71,77 — severity: LOW
- "`handleOptionChange` emits the typed name with NO trimming or shape validation, and the parent `<Controller name='namespaceName'>` sets no `rules` (DataSourceForm.tsx:124-129) — unlike the `name` and `oddrn` Controllers which both carry `rules={{required, validate: trim}}` (DataSourceForm.tsx:98-101,110-113). A whitespace-only or pathologically long namespace name reaches the backend; the backend `StringUtils.isNotEmpty` treats `'   '` as non-empty and would get-or-create a whitespace-named namespace." — evidence: NamespaceAutocomplete.tsx:124-127 (no trim) + DataSourceForm.tsx:124-129 (no rules) vs DataSourceForm.tsx:95-105,106-123 — severity: MEDIUM (verified-by-probe P-087)
- "The `handleSearch` `useCallback` wraps a `useDebouncedCallback` with `[searchNamespace, setLoading, setOptions, searchText]` as deps (line 59) — every keystroke rebuilds the debounced function. `useDebouncedCallback` is designed to be created once; recreating it per render can reset the debounce timer and is a known React anti-pattern. Combined with no request-sequence guard, two in-flight searches can resolve out of order and leave `options` holding stale-query results." — evidence: NamespaceAutocomplete.tsx:49-60 (useCallback wrapping useDebouncedCallback, searchText in deps) + 106-111 (effect re-fires on every searchText change) — severity: MEDIUM (verified-by-probe P-088)
- "`NamespaceAutocomplete` does not set `blurOnSelect`, but the sibling `OwnerAutocomplete` does (OwnerAutocomplete.tsx:151). After selecting a namespace the combo-box keeps focus rather than blurring — a minor UX inconsistency across two instances of the same shared pattern." — evidence: NamespaceAutocomplete.tsx:150-153 (no `blurOnSelect`) vs OwnerAutocomplete.tsx:148-153 — severity: LOW
- "`getFilterOptions` is declared `(filterOptions, params)` but never uses its `filterOptions` argument — it filters `options` (the state) instead (line 76). Harmless because MUI passes the same array, but it is dead-parameter noise and a refactor hazard." — evidence: NamespaceAutocomplete.tsx:74-76 — severity: LOW
- "The «No result. Create new custom namespace X» affordance is not documented anywhere user-facing — the Management doc page (WebFetched 2026-05-22) describes the '+ Add datasource' button but not the Namespace field or its create behaviour. An operator cannot learn from the docs that typing an unknown namespace creates it on save." — evidence: WebFetch 2026-05-22 of `https://docs.opendatadiscovery.org/features/management` (status 200) + NamespaceAutocomplete.tsx:78-84,165-178 — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "NamespaceAutocomplete.tsx:52"
      name: "searchNamespace size argument"
      value: "30"
      questions:
        - q: "What at N = 0? At N = 1? (namespaces in the system)"
          a: "N=0 existing namespaces: the fetch returns an empty list; `options` is `[]`; on any non-empty `searchText` the no-match guard (line 81) is trivially true, so the user is offered «Create new custom namespace X» for whatever they type — the create affordance is the only option, which is correct. N=1: the single namespace shows; if the user types its exact name the guard is false and no create row appears; any other text offers create."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52-55 (setOptions(namespaceList)) + 78-84 (no-match guard)"
        - q: "What at N = 30? At N = 31? At N = 30 x 100 (3000 namespaces)?"
          a: "N<=30 namespaces matching the query: all matches are fetched; the no-match guard inspects the complete matching set; correct labelling. N=31+ namespaces matching the typed PREFIX: only the first 30 are fetched (the thunk hard-codes `size: 30`, line 52, with no paging-on-scroll); an exact-match namespace ranked 31st+ in the backend's result order is absent from `options`, the guard at line 81 passes, and the user sees «Create new custom namespace «existing-name»» for a namespace that exists. At 3000 namespaces the same defect — the cap is fixed regardless of total count. Data integrity is safe (backend getByName resolves the existing row); the UI label is wrong."
          confidence: PROBE-NEEDED
          evidence: "P-086 — whether the 30-cap hides an exact match depends on the backend getNamespaceList ordering, not statically determinable here"
        - q: "What at null / negative / non-numeric size?"
          a: "Not caller-reachable — `size: 30` is a literal in the component (line 52); no user input feeds it. N/A as a defensive boundary."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52 (literal {query: searchText, page: 1, size: 30})"
        - q: "What does the operator see at each boundary?"
          a: "At <=30 matches: a correct dropdown — existing matches, plus the create row only if nothing matches exactly. At >30 prefix-matches with an exact match beyond row 30: a misleading «Create new custom namespace «X»» row for an X that already exists. Selecting it does NOT create a duplicate (backend get-or-create), so the operator's data is fine but they were told they were creating something new when they were not."
          confidence: PROBE-NEEDED
          evidence: "P-086"
    - location: "NamespaceAutocomplete.tsx:50,58"
      name: "useDebouncedCallback delay"
      value: "500 (ms)"
      questions:
        - q: "What at delay = 0 / very small?"
          a: "Not caller-reachable — 500 is a literal (line 58). A smaller delay would fire a backend search on nearly every keystroke (higher GET /api/namespaces load); a larger one would make the dropdown feel laggy. No operator boundary — it is a fixed tuning constant."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:58 (literal 500)"
        - q: "What at delay = 500 x 100?"
          a: "Not caller-reachable. N/A as an overflow boundary."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:58"
        - q: "What does the operator see at the boundary?"
          a: "With the fixed 500ms: typing fast, the operator sees the spinner and a stale/empty list until 500ms after they STOP typing; then the matched list (or the create row) appears. Within the 500ms window the create-suggestion logic runs against whatever `options` last held — see resource_boundaries for the in-flight-race observable."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:50-60,106-111"
  name_behavior_pairs:
    - name: "NamespaceAutocomplete (component name) + the «Create new custom namespace «X»» suggestion row"
      promise: "An autocomplete for namespaces; the suggestion row promises the user that selecting it will CREATE a new custom namespace named X."
      implementation: "On a genuine no-match (`searchText !== '' && !loading && !options.some(o => o.name === inputValue)`, line 81) the component appends a synthetic `{name: inputValue}` option (line 83); `renderOption` shows it via `AutocompleteSuggestion` as «No result. Create new custom namespace «X»» (lines 168-174); selecting it emits the plain string `X` to the form field (line 127). The component itself creates NOTHING — on form submit the parent sends `namespaceName: X` and the backend `registerDataSource → namespaceService.getOrCreate(X)` does `getByName(X).switchIfEmpty(createByName(X))`. So the promise holds end-to-end ONLY because the backend get-or-creates; the component is a labelled affordance whose 'create' is fulfilled server-side."
      drift: NONE
      operator_visible_consequence: "The labelled affordance behaves as promised when the typed name is genuinely new. The one mismatch case (existing name beyond the 30-row fetch window mislabelled as creatable) is a tunable-boundary defect, recorded under tunables / P-086, not a name-vs-behaviour drift of the affordance itself."
      confidence: STATIC-INFERRED
      evidence: "NamespaceAutocomplete.tsx:78-84,127,165-178 + AutocompleteSuggestion.tsx:23-30 + registerDataSource sidecar (NamespaceServiceImpl.java:37-40) — end-to-end verified-by-probe P-089"
    - name: "searchNamespace (the import alias for fetchNamespaceList)"
      promise: "Aliased as `searchNamespace` — promises a SEARCH (server-side filtered fetch) of namespaces by the typed query."
      implementation: "`fetchNamespaceList` calls `namespaceApi.getNamespaceList({page, size, query})` (namespace.thunks.ts:19-23) — `query` IS passed to the backend, so it is a genuine server-side search, not a fetch-all-then-filter. The component additionally re-filters client-side via `createFilterOptions` (line 76). The alias is honest."
      drift: NONE
      operator_visible_consequence: "n/a — `searchNamespace` performs a server-side query as its name implies."
      confidence: STATIC-INFERRED
      evidence: "NamespaceAutocomplete.tsx:20 (import alias) + namespace.thunks.ts:13-28"
  orderings:
    - location: "NamespaceAutocomplete.tsx:52,55,83"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the dropdown row order)?"
          a: "The component does NOT sort. `setOptions(namespaceList)` (line 55) stores the backend's `items` order verbatim; `getFilterOptions` returns either `filter(options, params)` (MUI's createFilterOptions, which preserves input order) or `[...options, {name: inputValue}]` (options order, suggestion last). The actual row order is therefore whatever `GET /api/namespaces` returns — owned by the backend `getNamespaceList`, not visible in this file. The create-suggestion row, when present, is always LAST (`[...options, suggestion]`, line 83)."
          confidence: REFERENCE
          evidence: "node: odd-platform java NamespaceController controller-method:getNamespaceList — the backend ORDER BY is that node's to record; not enriched yet"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Not determinable in this component — it imposes no sort, so any tie-break is the backend query's. REFERENCE to the getNamespaceList node."
          confidence: REFERENCE
          evidence: "node: odd-platform java NamespaceController controller-method:getNamespaceList"
        - q: "Which subset is returned when result-set > page size?"
          a: "The component requests `page: 1, size: 30` (line 52) and never requests page 2 — there is no infinite-scroll, no 'load more'. When more than 30 namespaces match, the user sees only the backend's first 30; the rest are unreachable through this control. This is the same fact the tunables block records as the P-086 mislabel risk."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52 (page:1,size:30; no second-page dispatch anywhere in the file)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Yes — the component applies MUI `createFilterOptions` client-side over the fetched 30 (line 76), a substring match on the typed text. So the dropdown is doubly filtered: server-side by `query`, then client-side by `createFilterOptions`. It is NOT re-sorted. The client-side filter can only NARROW the 30 fetched rows, never reach beyond them."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:45,76,86"
  auth_gates:
    - location: "NamespaceAutocomplete.tsx (whole file)"
      endpoint: "n/a — UI component; no endpoint, no @PreAuthorize"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "N/A at the component layer — `NamespaceAutocomplete` is a React component, not an HTTP surface. It is reachable only inside an already-rendered form (Add-datasource etc.), which is only rendered for a user who has already passed the app's auth gate. The two HTTP calls it transitively triggers — `GET /api/namespaces` (read, via searchNamespace) and `POST /api/datasources` (write, via the parent form's submit) — carry their own server-side gates: GET /api/namespaces is path-rule-gated, POST /api/datasources requires DATA_SOURCE_CREATE (per the registerDataSource sidecar). The component enforces nothing itself."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:20,52 (only searchNamespace dispatched) + registerDataSource sidecar security block"
        - q: "What does an unauthenticated caller see?"
          a: "An unauthenticated user never reaches a rendered Add-datasource form (the route + shell are auth-gated upstream), so they never see this component. If `GET /api/namespaces` were somehow called unauthenticated under LOGIN_FORM/OAUTH2/LDAP it would be rejected by the Spring filter chain before the controller — but that is the namespace endpoint's gate, not this component's."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx — no auth logic; the gate is upstream (route/shell) and downstream (the two APIs)"
        - q: "What does a wrong-role caller see?"
          a: "If a user can open the Add-datasource form but lacks DATA_SOURCE_CREATE, the namespace dropdown still populates (GET /api/namespaces is a separate, lighter gate) and the «Create new custom namespace» row still appears — but the final Save POST is rejected server-side with 403. The create affordance is shown optimistically; the permission is enforced only at submit. The component does not pre-check whether the user may create a namespace or a data source."
          confidence: PROBE-NEEDED
          evidence: "P-089 runs as a DATA_SOURCE_CREATE-only principal and asserts the create path succeeds for that principal; the wrong-role (no DATA_SOURCE_CREATE) 403-at-submit case is the registerDataSource sidecar's auth_gates question, referenced not re-probed here"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "NOWHERE in this component. Authorization for the actions this component contributes to lives entirely server-side: the route/shell gate upstream decides whether the form renders at all; `SecurityConstants` path rules gate `GET /api/namespaces` and `POST /api/datasources` downstream. The component is auth-agnostic by design."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx (no permission import / check) + registerDataSource sidecar (SecurityConstants.java:116-117)"
  resource_boundaries:
    - location: "NamespaceAutocomplete.tsx:49-60,106-111"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two debounced `searchNamespace` dispatches can be in flight at once (rapid typing across debounce windows; the effect at lines 106-111 re-fires on every `searchText` change). There is NO AbortController and NO sequence/staleness guard in the `.then()` (lines 53-57). If the earlier query's response resolves AFTER the later query's, `setOptions` is called last with the STALE query's results — `options` then holds rows for a query the user has moved past. `getFilterOptions` reads the CURRENT `searchText` (line 79) against those stale `options` (line 81), so the «Create new» suggestion can appear/disappear incorrectly until the next fetch settles. No persistent data is corrupted (this is client UI state), but the dropdown can transiently show the wrong list and the wrong create-affordance state."
          confidence: PROBE-NEEDED
          evidence: "P-088 — out-of-order resolution requires injected network latency to force deterministically; NamespaceAutocomplete.tsx:53-57 (no catch / no abort)"
        - q: "Is the call replay-safe?"
          a: "The component's own action — emitting a `namespaceName` string — is idempotent: selecting the same option twice emits the same string. The downstream effect is NOT idempotent: this component feeds the parent form, whose submit calls `registerDataSource`; re-submitting the same datasource form body is not replay-safe (ODDRN unique-constraint → HTTP 400) — but that is the registerDataSource node's property, not this component's. Within this component, opening/typing/selecting repeatedly has no cumulative effect."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:113-130 (pure name emission) + registerDataSource sidecar resource_boundaries"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts the search. Each open / keystroke-after-debounce dispatches a fresh `searchNamespace`; results are held only in the component's `options` state and discarded on unmount (the form closes). The `fetchNamespaceList.fulfilled` reducer also writes the `namespace` slice (namespace.slice.ts:21) but THIS component reads from `.unwrap()` directly (line 53), not the slice — so there is no stale-cache window for the component's own dropdown. The only staleness window is the in-flight-race one above."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52-57 (.unwrap().then, no @-style cache) + namespace.thunks.ts:13-28"
  request_inputs:
    - location: "NamespaceAutocomplete.tsx:27-38 (props) + 36-37"
      input_kind: body-field
      input_name: "controllerProps"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "`controllerProps` promises a react-hook-form `ControllerRenderProps` bundle — the `{name, value, onChange, onBlur, ref}` for a form field. The union type narrows it to a field literally named `namespaceName` on one of five parent form types (Term / DataEntityGroup / DataSource / Collector / LookupTable)."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:27-34"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`controllerProps` is spread onto the MUI `<Autocomplete {...controllerProps}>` (line 134), and `controllerProps.onChange` is passed into `handleOptionChange` (line 144) — the component calls it with the resolved namespace name string on every selection. So the prop is BOTH the form-state binding and the write-back channel. The parent `DataSourceForm` supplies it via `<Controller name='namespaceName' render={({field}) => <NamespaceAutocomplete controllerProps={field} />}>` (DataSourceForm.tsx:124-129)."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:134,144 + DataSourceForm.tsx:124-129"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `controllerProps` is used exactly as a react-hook-form controller render-prop bundle. One subtlety: spreading `{...controllerProps}` onto `<Autocomplete>` ALSO spreads `controllerProps.onChange`, then line 144 OVERRIDES `onChange` with the wrapped `handleOptionChange`. The override is last and wins; the spread's `value`/`ref`/`onBlur` still apply. Behaviour is correct; the spread-then-override is slightly subtle but not drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:134,144"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:134,144"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — `controllerProps` is the component's sole prop and is fully used."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:27-34"
      routes_to_finding: "n/a — MATCHES"
    - location: "NamespaceAutocomplete.tsx:91-104 (handleInputChange) + 145"
      input_kind: form-field
      input_name: "query / searchText (the typed text)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "`searchText` promises the text the user typed, used to SEARCH/filter the namespace list. The component's whole job is to turn typed text into a filtered dropdown."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:46,98 (setSearchText(query))"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Typed text (`reason === 'input'`) sets `searchText` (line 98), which (a) is the dep that re-fires the search effect (line 111), (b) is passed verbatim as the `query` to `searchNamespace` (line 52), and (c) is compared in the no-match guard (line 81) and shipped as the synthetic create-option's `name` (`params.inputValue`, line 83). A non-input change reason (a SELECT) sets `searchText=''` (line 100, comment `// Clear input on select`)."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:91-104,52,81,83,111"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the typed text is used to search, to filter, and to seed the create option, all consistent with 'the text the user typed'. One precision: the create option uses `params.inputValue` (MUI's current input value, line 83) while the search uses `searchText` (the component's state, line 52); these are normally equal but updated on slightly different cycles. Not drift — both faithfully represent the user's typing — but it is the seam the in-flight race (P-088) exploits."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:52,81,83,98"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES. The only caveat is that the typed text is emitted as the final `namespaceName` with no trim/shape (see bugs_limitations + P-087): a user who types trailing whitespace gets it persisted, which is a missing-validation finding, not a name-vs-use translation."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:124-127"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "NamespaceAutocomplete.tsx:42-47"
      routes_to_finding: "n/a — MATCHES (the no-trim concern routes to bugs_limitations_corner_cases + P-087, not to a drift)"
  probes_emitted:
    - probe_id: P-086
      question: "When >30 namespaces share the typed prefix, can the size:30 fetch cap hide an exact-match existing namespace behind the «Create new custom namespace» suggestion?"
      probe_path: "lineage/odd-platform/probes/P-086.yaml"
    - probe_id: P-087
      question: "Does the freeSolo combo-box emit a namespace name with no client-side trim / max-length / charset shaping, and what does the backend do with whitespace-only or oversized names?"
      probe_path: "lineage/odd-platform/probes/P-087.yaml"
    - probe_id: P-088
      question: "Can two out-of-order debounced searches leave `options` holding stale-query results / strand the loading spinner?"
      probe_path: "lineage/odd-platform/probes/P-088.yaml"
    - probe_id: P-089
      question: "End-to-end: does selecting «Create new custom namespace X» and submitting create exactly one namespace X and link the data source to it — confirming the labelled affordance over the LSN-023 'side-door' framing?"
      probe_path: "lineage/odd-platform/probes/P-089.yaml"
  stress_summary:
    triggers_total: 6
    questions_total: 25
    answers_static_inferred: 18
    answers_probe_needed: 4
    answers_reference: 3
    drift_flags: 0
```

## security

- auth_mode_relevance: INTERNAL_ONLY — `NamespaceAutocomplete` is a React component, not an HTTP surface; no auth mode applies to it directly. It renders only inside an already-auth-gated form/route. The two HTTP calls it transitively drives — `GET /api/namespaces` and (via the parent form) `POST /api/datasources` — are gated server-side; under DISABLED both are open, under LOGIN_FORM/OAUTH2/LDAP both carry their own path rules (DATA_SOURCE_CREATE for the datasource POST per the registerDataSource sidecar).
- ingestion_filter_relevance: NO — not HTTP; not on the `/ingestion/**` path. The component is a UI admin-surface element.
- authorization_assertions: [] — the component enforces no permission, role, or policy gate. It does not import `permissionService` or any RBAC primitive. (This is correct for a leaf form input — authorization is the route/shell's and the backend's job — but it means the «Create new custom namespace» control is shown to any user who can open the form, regardless of whether they hold the permission to create a namespace or a data source; enforcement is deferred to the submit POST.)
- owner_scoping: N/A — the component reads a global namespace list (`GET /api/namespaces` is not owner-scoped) and emits a name string; there is no per-owner data filtering at this layer.
- data_exposure:
  - "Namespace names and the existence of namespaces are surfaced in the dropdown to any user who can open a form using this component (datasource / term / DEG / collector / lookup-table forms). Namespace names are low-sensitivity org-taxonomy labels, but the component does expose the full first-30 namespace inventory matching any typed prefix to such a user — evidence: NamespaceAutocomplete.tsx:52-55."
- known_security_gaps:
  - "The «Create new custom namespace» affordance is rendered optimistically — it appears for any user who can open the form, with no client-side check that the user holds the permission the eventual save requires (`DATA_SOURCE_CREATE` for the datasource form). A user lacking the permission can type a new namespace name, see the create row, click Save, and only THEN receive a 403. This is a UX gap, not a security hole — the backend `SecurityConstants` rule is the real gate — but the optimistic affordance can mislead a low-privilege user. The deeper, server-side question (creating a namespace via the datasource form's `namespace_name` is gated by DATA_SOURCE_CREATE, not NAMESPACE_CREATE) is owned by the registerDataSource sidecar; this component is simply the UI that surfaces that path as a labelled control" — evidence: NamespaceAutocomplete.tsx:78-84 (create row, no permission check) + registerDataSource sidecar bugs_limitations_corner_cases[0] — severity: LOW (UI-side); the substantive finding is the backend's, see coherence_notes.

## performance

- hot_paths:
  - "NOT a hot path — the component runs only while a user has an Add/Edit-datasource (or term/DEG/collector/lookup-table) form open. Each dropdown open and each post-debounce keystroke triggers one `GET /api/namespaces` — operator-paced, low frequency. The 500ms debounce (NamespaceAutocomplete.tsx:58) bounds the request rate to roughly two per second of sustained typing."
- throughput_characteristics:
  - "One `searchNamespace` dispatch per debounce window; `page: 1, size: 30` fixed — each call transfers at most 30 namespace rows. No batching, no streaming."
  - "No 'load more' / infinite scroll — the component never requests page 2; throughput per form-open is capped at 30 visible namespaces."
- resource_allocation:
  - "Per-instance memory is small — a `FilterOption[]` of <=30 rows plus a synthetic create option; KB-sized. Discarded on form close (unmount)."
  - "No outbound HTTP from the component itself; the single network call is the thunk-driven `GET /api/namespaces`."
  - "`handleSearch` rebuilds its `useDebouncedCallback` on every `searchText` change (dep array, line 59) — a small per-keystroke allocation and a known React anti-pattern, not a memory leak but avoidable churn."
- scaling_characteristics:
  - "Stateless client component — scales with the browser, not the server."
  - "The `size: 30` cap means the component's backend load does NOT grow with total namespace count — but it also means the dropdown cannot represent a large namespace inventory (the P-086 mislabel risk is the cost of this fixed cap)."
- known_performance_gaps:
  - "`handleSearch`'s `useDebouncedCallback` is wrapped in a `useCallback` whose deps include `searchText` (NamespaceAutocomplete.tsx:49-60) — the debounced function is recreated every keystroke, which can reset the debounce timer and is the documented `use-debounce` anti-pattern. Effect: more `GET /api/namespaces` calls than a correctly-memoised debounce would issue" — evidence: NamespaceAutocomplete.tsx:49-60 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/management/datasources (Management → Datasources tab — the '+ Add datasource' / 'Edit datasource' modal)"
  caller_node: "odd-platform ts react-component component:DataSourceForm"
  multiplicity_per_trigger: 1
  evidence: "DataSourceForm.tsx:124-129 — `<Controller name='namespaceName' render={({field}) => <NamespaceAutocomplete controllerProps={field} />}>`; the form is opened once per '+ Add datasource' or per-row 'Edit' click, mounting one NamespaceAutocomplete. The form is the `renderContent` of a `DialogWrapper` whose open button is the cloned `btnCreateEl` (DataSourceForm.tsx:157-169)."
  observation_class: ui-call
- entry_point: "ui-form:term-create / term-edit"
  caller_node: "odd-platform ts react-component component:TermForm (REFERENCE — not enriched)"
  multiplicity_per_trigger: 1
  evidence: "NamespaceAutocomplete.tsx:29 — the props union accepts `ControllerRenderProps<TermFormData,'namespaceName'>`, so a Term form mounts this component for its namespace field. The specific Term form file is not enriched this session."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui-form:data-entity-group-create / edit"
  caller_node: "odd-platform ts react-component component:DataEntityGroupForm (REFERENCE — not enriched)"
  multiplicity_per_trigger: 1
  evidence: "NamespaceAutocomplete.tsx:30 — props union accepts `ControllerRenderProps<DataEntityGroupFormData,'namespaceName'>`."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui-form:collector-create / edit"
  caller_node: "odd-platform ts react-component component:CollectorForm (REFERENCE — not enriched)"
  multiplicity_per_trigger: 1
  evidence: "NamespaceAutocomplete.tsx:32 — props union accepts `ControllerRenderProps<CollectorFormData,'namespaceName'>`."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui-form:lookup-table-create / edit"
  caller_node: "odd-platform ts react-component component:LookupTableForm (REFERENCE — not enriched)"
  multiplicity_per_trigger: 1
  evidence: "NamespaceAutocomplete.tsx:33 — props union accepts `ControllerRenderProps<LookupTableFormData,'namespaceName'>`."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: external-call
  description: "Dispatches the `searchNamespace` (fetchNamespaceList) redux thunk → `GET /api/namespaces?page=1&size=30&query=<typed text>`. Fires on dropdown-open and on every post-debounce keystroke change."
  evidence: "NamespaceAutocomplete.tsx:52-57 (dispatch + .unwrap().then) + 106-111 (effect) + namespace.thunks.ts:13-28"
  cardinality_per_call: "1 per dropdown-open; +1 per 500ms-debounced keystroke change while open"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "ui-form:term-create / term-edit"
    - "ui-form:data-entity-group-create / edit"
    - "ui-form:collector-create / edit"
    - "ui-form:lookup-table-create / edit"
- side_effect_class: cache-mutate
  description: "The `fetchNamespaceList.fulfilled` action is reduced into the redux `namespace` slice — a store write, a side effect of the dispatch even though this component reads results via `.unwrap()` rather than from the slice."
  evidence: "namespace.thunks.ts:13-28 + namespace.slice.ts:21 (`builder.addCase(thunks.fetchNamespaceList.fulfilled, ...)`)"
  cardinality_per_call: "1 per successful searchNamespace dispatch"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "ui-form:term-create / term-edit"
    - "ui-form:data-entity-group-create / edit"
    - "ui-form:collector-create / edit"
    - "ui-form:lookup-table-create / edit"
- side_effect_class: page-render
  description: "Renders the namespace dropdown: existing-namespace rows (plain name) plus, on a no-match, the «No result. Create new custom namespace «X»» suggestion row. This is the user-visible affordance the whole node exists to present."
  evidence: "NamespaceAutocomplete.tsx:132-179 (Autocomplete render) + 165-178 (renderOption) + AutocompleteSuggestion.tsx:23-30"
  cardinality_per_call: "1 dropdown render per open; re-renders on each keystroke/fetch"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "ui-form:term-create / term-edit"
    - "ui-form:data-entity-group-create / edit"
    - "ui-form:collector-create / edit"
    - "ui-form:lookup-table-create / edit"
- side_effect_class: db-write
  description: "INDIRECT — the component itself performs no write. On the PARENT form's submit, the emitted `namespaceName` string is sent in `POST /api/datasources`, where `namespaceService.getOrCreate` may INSERT a namespace row and the data_source row carries its id. The namespace INSERT is the server-side fulfilment of this component's «Create new custom namespace» affordance. Recorded as a downstream side effect of the affordance, owned (for cardinality / transaction detail) by the registerDataSource node."
  evidence: "NamespaceAutocomplete.tsx:127 (onChange emits the name) → DataSourceForm.tsx:69-81 (onSubmit dispatches registerDataSource) → registerDataSource sidecar downstream_side_effects (NamespaceServiceImpl.java:37-40)"
  cardinality_per_call: "0 or 1 namespace row per form submit — 1 if the chosen name is new, 0 if it already exists or is empty"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "ui-form:term-create / term-edit"
    - "ui-form:data-entity-group-create / edit"
    - "ui-form:collector-create / edit"
    - "ui-form:lookup-table-create / edit"

## coherence_notes

- kind: refines
  target: "odd-platform java DataSourceController controller-method:registerDataSource"
  note: |
    The registerDataSource sidecar (batch ZB) records `namespace_name → namespaceService.getOrCreate`
    as a `TRANSLATES_SILENTLY` / `DRIFT_INPUT_NAME_VS_IMPLEMENTATION` finding and routes it to
    `bugs_limitations_corner_cases` as an "implicit namespace creation bypasses NAMESPACE_CREATE …
    escalation by side effect" (its bugs[0], security.known_security_gaps[0]). That sidecar was
    enriched from a backend-only chain and explicitly could not see the UI. THIS sidecar is the
    UI-side primary evidence and REFINES the framing: the backend `getOrCreate` on `namespace_name`
    is the deliberate server half of `NamespaceAutocomplete` — a select-or-create combo-box that
    shows existing namespaces, filters as the user types, and offers an explicitly LABELLED row,
    «No result. Create new custom namespace «X»» (AutocompleteSuggestion.tsx:25-28), only on a
    genuine no-match. The create is a user-chosen, on-screen, labelled affordance, NOT a hidden
    side effect of a field name. Per LSN-023, the batch-ZB `permission_side_door` facet
    (REFACTOR-584 / DOC-GAP-262) and its prescribed fix ("add a `namespace_id` field so the caller
    SELECTS an existing namespace") are CONTRADICTED by the actual UI: the UI already lets the user
    select an existing namespace — that is the default path — and the prescribed fix would delete
    the create affordance that the product intentionally ships. The accurate finding is a
    DOCUMENTATION gap (the affordance is undocumented — see this sidecar's doc_drift_findings),
    not a permission vulnerability. The `namespace_name`-is-a-string contract is REQUIRED by this
    component: it deliberately emits a name, never an id, so the backend can get-or-create.
- kind: refines
  target: "odd-platform java DataSourceController controller-method:registerDataSource"
  note: |
    The registerDataSource sidecar's request_inputs answer for `namespace_name` Q5 says
    "A namespace_id field would let a caller select WITHOUT the create-on-miss risk; its absence
    is structural." This UI sidecar refines that: the absence of a `namespace_id` field is not an
    oversight — it is the consequence of the select-or-create UX decision. A `namespace_id`-only
    contract could not express "the user typed a brand-new name", which is half of what the
    combo-box is for. The structural absence and the intended affordance are the same decision
    seen from two sides.
- kind: relates
  target: "odd-platform ts react-component component:OwnerAutocomplete"
  note: |
    `NamespaceAutocomplete` is the canonical instance of a platform-wide select-or-create pattern.
    `OwnerAutocomplete` (components/shared/elements/Autocomplete/OwnerAutocomplete/OwnerAutocomplete.tsx)
    implements the SAME pattern near-identically: debounced `fetchOwnersList({page:1,size:30,query})`
    (OwnerAutocomplete.tsx:42-53), the same no-match guard `!filterOptions.some(o => o.name === query)`
    (lines 72-80), the same `AutocompleteSuggestion` «Create new owner X» label (line 130), the same
    `freeSolo`. ~11 sibling components live under `components/shared/elements/Autocomplete/`
    (Owner, OwnerId, OwnerTitle, Policy, Provider, Role, SearchSuggestions, SlackChannels, Terms,
    DataEntityChannels, Namespace). When the adr-archaeologist promotes the implicit ADR in this
    sidecar to a real ADR, OwnerAutocomplete and the rest are the corroborating instances — and the
    two LOW-severity divergences this sidecar records (NamespaceAutocomplete returns unfiltered
    `options` on the no-match branch and omits `blurOnSelect`, where OwnerAutocomplete returns
    `[...filtered]` and sets `blurOnSelect`) are pattern-consistency drift worth a follow-up.

## sources

- understanding ← `odd-platform-ui/src/components/shared/elements/Autocomplete/NamespaceAutocomplete/NamespaceAutocomplete.tsx:1-184` + `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx:124-129` + `odd-platform-ui/src/components/shared/elements/AutocompleteSuggestion/AutocompleteSuggestion.tsx:23-30`
- concepts.entities ← NamespaceAutocomplete.tsx:11-34,42-47,168-174
- concepts.operations ← NamespaceAutocomplete.tsx:49-130,138-178
- concepts.invariants ← NamespaceAutocomplete.tsx:81,99-101,124-127,150
- concepts.audiences ← DataSourceForm.tsx:124-129 + NamespaceAutocomplete.tsx:27-34 + WebFetch 2026-05-22 of `https://docs.opendatadiscovery.org/features/management` (status 200)
- dependencies_semantic.requires-feature.fetchNamespaceList ← `odd-platform-ui/src/redux/thunks/namespace.thunks.ts:13-28` + NamespaceAutocomplete.tsx:20,52
- dependencies_semantic.requires-feature.AutocompleteSuggestion ← `odd-platform-ui/src/components/shared/elements/AutocompleteSuggestion/AutocompleteSuggestion.tsx:16-31`
- dependencies_semantic.requires-feature (MUI / use-debounce / react-hook-form / i18next) ← NamespaceAutocomplete.tsx:1-23
- dependencies_semantic.coupling ← NamespaceAutocomplete.tsx:25,27-34,81,127,168 + registerDataSource sidecar (NamespaceServiceImpl.java:37-40)
- tests_coverage_semantic ← Grep `NamespaceAutocomplete` across `odd-platform-ui/src` (only the component, its importers, and this batch's probe files matched — no test file) + DataSourceForm.tsx:95-129
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-22 of `https://docs.opendatadiscovery.org/features/management` (status 200)
- implicit_adrs[0] (select-or-create pattern) ← NamespaceAutocomplete.tsx:74-84,113-130,165-178 + AutocompleteSuggestion.tsx:23-30 + `odd-platform-ui/src/components/shared/elements/Autocomplete/OwnerAutocomplete/OwnerAutocomplete.tsx:67-80,118-133`
- implicit_adrs[1] (freeSolo keyboard-create) ← NamespaceAutocomplete.tsx:62-65,123-126,150
- implicit_adrs[2] (id-presence discriminator) ← NamespaceAutocomplete.tsx:25,168
- bugs_limitations_corner_cases[0] (stranded spinner on reject) ← NamespaceAutocomplete.tsx:51-57
- bugs_limitations_corner_cases[1] (create row for existing name beyond 30-cap) ← NamespaceAutocomplete.tsx:52,81
- bugs_limitations_corner_cases[2] (no-match branch ships unfiltered options) ← NamespaceAutocomplete.tsx:76,83 + OwnerAutocomplete.tsx:71,77
- bugs_limitations_corner_cases[3] (no client-side name shaping) ← NamespaceAutocomplete.tsx:124-127 + DataSourceForm.tsx:95-129
- bugs_limitations_corner_cases[4] (debounce recreated per keystroke) ← NamespaceAutocomplete.tsx:49-60,106-111
- bugs_limitations_corner_cases[5] (no blurOnSelect) ← NamespaceAutocomplete.tsx:150-153 + OwnerAutocomplete.tsx:148-153
- bugs_limitations_corner_cases[6] (dead filterOptions parameter) ← NamespaceAutocomplete.tsx:74-76
- bugs_limitations_corner_cases[7] (affordance undocumented) ← WebFetch 2026-05-22 of `https://docs.opendatadiscovery.org/features/management` (status 200) + NamespaceAutocomplete.tsx:78-84,165-178
- stress_findings ← NamespaceAutocomplete.tsx:42-60,74-111,113-130,132-179 + namespace.thunks.ts:13-28 + AutocompleteSuggestion.tsx:23-30 + registerDataSource sidecar
- security ← NamespaceAutocomplete.tsx:20,52,78-84 (no auth import / no permission check) + registerDataSource sidecar security block
- performance ← NamespaceAutocomplete.tsx:49-60,52,106-111 + namespace.thunks.ts:13-28
- upstream_callers ← DataSourceForm.tsx:124-129,157-169 + NamespaceAutocomplete.tsx:27-34
- downstream_side_effects ← NamespaceAutocomplete.tsx:52-57,106-111,127,132-179 + namespace.thunks.ts:13-28 + namespace.slice.ts:21 + DataSourceForm.tsx:69-81 + registerDataSource sidecar downstream_side_effects
- coherence_notes ← registerDataSource sidecar `odd-platform__java__DataSourceController__controller-method__registerDataSource.md` (Read this session) + retrospectives/LSN-023-feature-ontology-built-without-the-ui.md (Read this session) + OwnerAutocomplete.tsx:42-53,72-80,130,148-153

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of a test file is verified by Grep across the UI tree)
- docs_link_semantic: HIGH (the Management page was WebFetched live this session, status 200; the absence of namespace-field documentation is confirmed from the fetched content)
- implicit_adrs: HIGH (the pattern is anchored by in-code comments AND corroborated by a sibling component read this session)
- bugs_limitations_corner_cases: HIGH (every item is file:line-cited; the four that need runtime to confirm severity are probe-backed)
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM (the DataSourceForm caller is verified by file:line; the four other parent forms are REFERENCE entries inferred from the props union type, not yet enriched)
- downstream_side_effects: HIGH (the component's own effects are file:line-verified; the indirect db-write is cross-referenced to the registerDataSource sidecar)
- stress_findings: HIGH (18 of 25 questions STATIC-INFERRED with strong file:line evidence; 4 PROBE-NEEDED but probe-backed P-086..P-089; 3 REFERENCE for the namespace-list ordering owned by an un-enriched backend node — no load-bearing operator claim rests on an unprobed guess)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)
