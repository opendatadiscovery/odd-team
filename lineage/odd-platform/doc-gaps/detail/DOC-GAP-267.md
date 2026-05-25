---
doc_gap_id: DOC-GAP-267
severity: MEDIUM
category: missing-page
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
  - DOC-GAP-264   # Title-filter LSN-020 — sibling filter-panel finding
  - DOC-GAP-272   # Namespace filter widening — sibling filter-panel finding
---

## DOC-GAP-267 — Quality Dashboard filter sidebar — the entire INTERACTION MODEL of the dashboard's primary operator surface is undocumented despite the dedicated `dashboard.md` sub-page: the live page names the five filter dimensions and the tables-vs-tests split but is SILENT on (a) URL-deeplinkable / shareable filter selections (every selection is mirrored into the query string with `replace: true`), (b) per-side "Clear" buttons (two of them, scoped per side), (c) autocomplete-by-name search (every keystroke fires a list-API request, no debounce; first 30 results only), (d) the live-filtering model (every chip selection immediately re-queries the dashboard; no Apply gate), (e) the per-mount reset behaviour (navigating away and back resets all filters to the empty default — URL is the only persistence channel)

**Severity**: MEDIUM
**Category**: missing-page content (the dashboard sub-page covers the READ surface — what the rings/matrix show — and is silent on the operator's primary INTERACTION surface — how to drive the filter panel)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityFilters.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"DOC DRIFT — the filter panel's whole interaction model is undocumented despite a dedicated dashboard doc page. The `dashboard` page describes the rings and names the filters but never documents: that filter selections are reflected into the URL query string (deep-linkable / shareable), that there are two 'Clear' buttons scoped per side, or that the autocomplete searches by name. The dashboard doc covers the read surface and is silent on the operator's primary interaction surface."*
- `odd-platform__ts__react-component__component__DataQualityFilters.md:implicit_adrs.[2]` — *"Filter selections are mirrored into the URL query string so the dashboard view is deep-linkable and shareable."* — confirms the URL round-trip is a deliberate design intent, not an incidental side-effect
- `odd-platform__ts__react-component__component__DataQualityFilters.md:operations` — *"sync-formFilters-from-url (on mount/searchParams-change, parse JSON-encoded query params into formFiltersAtom — `DataQualityFilters.tsx:28-43`)"*, *"sync-url-from-formFilters (on formFilters change, JSON-encode non-empty arrays into the query string with `replace: true` — `DataQualityFilters.tsx:46-54`)"*, *"clear-tables-filters (reset the five `de*` keys to [])"*, *"clear-tests-filters (reset the five unprefixed keys to [])"*
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar — *"`MultipleFilterItemAutocomplete` has no debounce on the search input — every keystroke triggers a list-API request"*)
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[3]` (MEDIUM per sidecar — *"The autocomplete fetches a fixed first page of 30 options and never paginates — catalogs with >30 namespaces/owners/tags are not fully filterable"*)
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar — *"The filter selection does not survive navigating away from `/data-quality` and back: …the operator loses their filter slice with no warning. (The URL search params written by `DataQualityFilters`' second `useEffect` are the only persistence channel…)"*)
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:docs_link_semantic.doc_drift_findings.[0]` — *"The live `.../features/data-quality/dashboard` page documents the table-side/test-side independence and the per-side filters but is silent on the default state and on filter persistence — it does not tell the operator that filters reset on navigate-away (the per-Provider-mount behaviour, see stress_findings Category E)."*
- `odd-platform__ts__react-component__component__DataQualityFilters.md:security.known_security_gaps.[0]` (LOW per sidecar — filter selections are mirrored into the URL with both id and name as JSON; browser history / server access logs / referer headers carry the operator's filter selection — minor leak surface)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim Q7 answer: *"URL Query String Sync / Deep-Linkable Filters: No information provided. The page contains no mention of query string parameters, URL state synchronization, or shareable deep-linked filter selections."*
- Same fetch — verbatim Q8 answer: *"'Title' Filter Operation: No description provided. The 'Title' dimension is listed among available filters but receives no explanation of how it operates or what it filters."* — confirms the broader pattern: the page names the filters but never describes operator interaction.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/DataQualityFilters.tsx:25, 28-54` — the `useSearchParams` import + the two `useEffect` hooks forming the bidirectional URL ↔ atom sync
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/DataQualityFilters.tsx:64-68, 79-83` — the two `Clear` button handlers (one per side, scoped via `clearTableFiltersAtom` / `clearTestFiltersAtom`)
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/hooks/index.ts:13-16` — the hard-coded `{ page: 1, size: 30 }` autocomplete list-query parameters
- `odd-platform-ui/src/components/shared/elements/MultipleFilterItemAutocomplete/MultipleFilterItemAutocomplete.tsx:57-66` — `setSearchText(query)` on every input change with no debounce
- `odd-platform-ui/src/components/DataQuality/DataQualityProvider.tsx:4-6` + `odd-platform-ui/src/App.tsx:73` — the `<Provider>` per route mount; React Router unmounts on navigation away; the next mount starts a fresh all-empty `formFiltersAtom`

### Drift narrative

The Quality Dashboard's filter sidebar is the dashboard's primary interaction surface — every operator who uses the dashboard for more than passive observation drives the rings + matrix through it. The sidebar's behaviour is rich:

- **URL deep-linking** — every chip selection is mirrored into the URL query string (with `replace: true` so the back button isn't polluted); an operator can copy the URL, paste it into Slack / email / a bug ticket, and the recipient sees the exact filtered view. This is a deliberate design intent (`implicit_adrs.[2]`).
- **Per-side `Clear` buttons** — two of them; the tables-side button resets only the five `de*` keys, the tests-side button resets only the five unprefixed keys; the two sides are independent.
- **Autocomplete-by-name** — typing into a filter chip searches the corresponding catalog dimension by name; the search fires per-keystroke (no debounce) against the dimension's list API.
- **First-30-only ceiling** — the autocomplete fetches only the first 30 options for any given search prefix; a catalog with >30 namespaces/owners/tags is not fully filterable from a single prefix (this is a usability ceiling worth disclosing).
- **Live filtering** — every chip selection immediately re-queries the dashboard; there is no "Apply" button (despite the atom being named `formFiltersAtom`, which over-promises a stage-then-submit model).
- **Per-mount reset** — navigating away from `/data-quality` and back resets all filters to the empty default; the URL query string is the only persistence channel (and only if the operator bookmarked or shared the URL).

The live dashboard page covers the READ surface — three rings + per-category matrix — and names the filters but documents NONE of these interaction behaviours. An operator wanting to:

- **Share a filtered view** — has no doc-side signal that copying the URL works; they will screenshot instead (lossy, stale).
- **Reset filters** — has no doc-side signal that there are two `Clear` buttons or that they're scoped per side; they may navigate-away-and-back (which works but loses bookmark intent) or refresh.
- **Search a large catalog dimension** — has no doc-side signal that only the first 30 results render; they may scroll forever expecting more, or assume their target doesn't exist when it's on page 2.
- **Understand why their filters reset** — has no doc-side signal that the per-mount reset is intentional; may file it as a bug.

### Proposed doc action

**Single-part action — add a "Using the filters" sub-section to the dashboard doc page**.

`documentation/docs/features/data-quality/dashboard.md` — after the rings + matrix description and the five-dimension list (and after the "Filter dimensions reference" sub-section proposed in DOC-GAP-264), add a "Using the filters" section:

> ## Using the filters
>
> The dashboard's filter sidebar has two independent panels — **Filters for tables** (narrows Table Health + Monitored Tables) and **Filters for tests** (narrows Test Results Breakdown). Each panel exposes the same five dimensions (Namespace, Datasource, Owner, Title, Tag). The two sides apply independently — you can pin the tables side to one slice and the tests side to another.
>
> ### Live filtering
>
> Every filter chip selection or deselection re-queries the dashboard immediately — there is no Apply button. Filter chips compose with `AND` semantics (the platform implements only `AND` conjunction across dimensions).
>
> ### Sharing and bookmarking
>
> Every filter selection is mirrored into the URL query string. To share a filtered view, copy the address bar — the recipient opening the URL will see the same filtered dashboard. The URL also makes a bookmarked filtered view possible. Note: the URL carries both the id and the human-readable name of each filter chip (filter chip names will appear in browser history and server access logs).
>
> ### Resetting filters
>
> Each panel has its own **Clear** button — the tables-side Clear resets only the tables-side filters; the tests-side Clear resets only the tests-side. Filter selections do NOT survive navigating away from `/data-quality` and back — the next visit starts from the empty default, unless you arrive via a previously-shared filtered URL.
>
> ### Searching catalog dimensions
>
> Typing into any filter chip searches the corresponding catalog dimension by name (e.g. typing into the Owner chip searches the catalog's owners). Each search returns the first 30 matching entries; if your target is not in the first 30, narrow the search by typing more of its name.

### Cross-references

- **DOC-GAP-264** (Title filter LSN-020 drift) — the "Filter dimensions reference" sub-section in DOC-GAP-264's proposed action sits above this one and explains WHAT each filter binds to; this one explains HOW the panel works.
- **DOC-GAP-272** (Namespace filter widening) — adjacent to DOC-GAP-264 — same "Filter dimensions reference" sub-section; the maintainer can land all three in one authoring pass.
- **DOC-GAP-265 / DOC-GAP-266** (Test Results Breakdown + Table Health label drifts) — sibling dashboard.md edits; the maintainer can land all five (263-267) in one authoring session for a coherent dashboard.md refresh.
- **probe P-111** — runtime confirmation of the per-keystroke list-API multiplicity (relevant if the maintainer wants to also recommend a debounce code-side; out of scope of this doc-only finding).
- **Rule 6 coherence** — cross-registry sweep ran: feature-flows + concepts + test-map all SAME-POLARITY (the per-mount reset behaviour and the URL round-trip are both captured in the sidecar evidence; no contradictions). No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. The filter sidebar is the dashboard's primary interaction surface; the doc covering the dashboard's READ surface and being silent on the INTERACTION surface is a substantial reader-flow gap. The operator-impact is reader-friction (you can figure out the interactions by clicking around) rather than data loss / security exposure, so MEDIUM rather than HIGH. The fix is one new sub-section on the existing dashboard page — cheap.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the page is still silent on URL deep-linking, per-side Clear, autocomplete-by-name, first-30 ceiling, live filtering, and per-mount reset; sidecar evidence (DataQualityFilters.tsx:28-54, hooks/index.ts:13-16, MultipleFilterItemAutocomplete.tsx:57-66, DataQualityProvider.tsx:4-6) re-confirmed at substrate commit `ede5d277`.
