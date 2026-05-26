## REFACTOR-674 — Dictionary tab doc-vs-code drift: the Business Glossary live doc page says "The Dictionary tab is the catalog-wide LIST of all terms in the platform" and "Browse terms across every namespace" implying a flat browseable surface, but the actual code at `ToolbarTabs.tsx:67` wires the Dictionary tab to `termsSearchPath()` (`/termsearch`) which renders `TermSearch.tsx` — a SEARCH+FACETS UI with an EMPTY results pane until the operator types a query or applies a facet; the doc's mental model and the code's behaviour diverge

**Severity**: MEDIUM
**Category**: doc-vs-code-drift / mental-model-mismatch / empty-state-UX
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-06 Data Glossary] × documentation pillar

**Surfaced by**:
- `terms.md:docs_link_semantic.doc_drift_findings[0]` — "**Live doc says 'list', code shows 'search'.** The Business Glossary page (https://docs.opendatadiscovery.org/features/data-glossary/business-glossary, WebFetched 2026-05-26, status 200) describes 'The Dictionary tab is the catalog-wide list of all terms in the platform' and 'Browse terms across every namespace'. The Dictionary tab in code is wired to `termsSearchPath()` (ToolbarTabs.tsx:67) which lands the user on `/termsearch` — `TermSearch.tsx`, a search-with-facets UI (TermSearchFilters left sidebar + TermSearchResults right), NOT a flat browseable list. The user clicking 'Dictionary' sees an empty search-results table until they type a query or apply a facet. **The doc's mental model (list) and the code's behaviour (search) diverge** — surface as a doc-coherence finding for the doc-gap-finder pass."
- `terms.md:stress_findings.name_behavior_pairs.[termsSearchPath()]` DRIFT_MINOR — "Doc says 'list' (catalog-wide list of all terms) — code shows 'search with facets, empty until you type a query'. The operator who clicks Dictionary expecting a list sees an empty results pane until they apply a query/facet."

**Statement**: The live Business Glossary doc at `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (WebFetched 2026-05-26, status 200) contains the following sentences in its "The Dictionary tab" section:

> "The Dictionary tab is the catalog-wide list of all terms in the platform."
>
> "From here you can: Browse terms across every namespace. Create a new term (gated by TERM_CREATE)."

A reader of the doc forms the mental model: clicking the Dictionary tab lands on a LIST surface (a paginated table, alphabetically sorted, browseable without typing anything) — same mental model as the Data Entities Directory or the Owners list under Management.

The actual implementation:

1. **`ToolbarTabs.tsx:67`** wires the Dictionary tab's `link` to `termsSearchPath()`, which returns `/termsearch`.
2. **`App.tsx:63`** mounts `<Route path={`${termsSearchPath()}/*`} element={<TermSearch />} />`.
3. **`TermSearch.tsx:70-86`** renders a two-pane SEARCH UI:
   - `TermSearchFilters` (left sidebar — facet selectors: namespace, owner, tag, query string).
   - `TermSearchResults` (right pane — results table populated by the active search query).
4. The initial state of the search query is empty; the results pane shows an empty table until the operator types a query or applies a facet.

The user clicking "Dictionary" with the doc's mental model in mind sees an empty pane with a search box and a sidebar of facet filters — no immediate "list of terms," no "browse" affordance, no obvious next step. The path to the doc's promised "browse across every namespace" requires the operator to either (a) leave the search box blank AND click an empty facet (which may or may not trigger a list-all behaviour — depends on the search backend's empty-query semantics), or (b) type a wildcard, or (c) apply a single namespace filter to see that namespace's terms.

The doc's "list" framing and the code's "search" implementation are NOT compatible. The doc is wrong, OR the code is wrong, OR both need updating.

**Resolution options (maintainer triage)**:

**Path A — Update the doc to match the code**:
1. Rewrite the Dictionary tab section to say "The Dictionary tab is the SEARCH surface for all terms in the platform" with sub-bullets explaining: enter a query, apply facets, browse results. Replace "Browse terms across every namespace" with "Filter by namespace to browse a namespace's terms" or similar.
2. Add a screenshot of the actual UI (search box + facet sidebar + empty initial state).
3. Add an "empty initial state" explanation: when the operator first lands on the page, the results pane is empty; this is by design (the search index requires a query); use the facets to narrow down or leave them empty + click search to list all.

**Path B — Update the code to match the doc**:
1. Make the initial state of `/termsearch` show a list of ALL terms (paginated, alphabetical) — i.e., fire a wildcard / empty query against the search backend on mount.
2. The facet sidebar narrows the visible list; the search box adds free-text matching.
3. Operator clicking Dictionary sees a browseable list immediately; the doc's framing holds.

**Path C — Add a SEPARATE list surface**:
1. Author a new route `/terms/all` or `/terms/list` that renders a paginated alphabetical list (no search).
2. Wire the Dictionary tab's link to this list page instead of `/termsearch`.
3. Provide an explicit "Search terms" link inside the list page that navigates to `/termsearch` for the search-with-facets UI.
4. Update the doc to mention both surfaces (list = default; search = explicit).

Path A is the cheapest (1 doc page edit). Path B requires changing the search backend's empty-query behaviour and may impact performance at scale (the wildcard query against a catalog with 100K+ terms is heavier than a sparse-by-default search). Path C is the most user-friendly but requires authoring a new component + integrating with the existing search index.

The maintainer's call. Path A is the default for an UNFUNDED OSS project with limited capacity; Path C aligns with the doc's intent and the operator mental model but requires significantly more work.

**Evidence**:
- WebFetch `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (2026-05-26, status 200) — verbatim "list" and "browse" language
- `ToolbarTabs.tsx:67` (Dictionary tab → `termsSearchPath()`)
- `App.tsx:63` (route mount)
- `TermSearch.tsx:70-86` (the two-pane search UI structure)
- `TermSearch.tsx:36` (initial form data — empty query)

**Existing-ADR-or-implied-prescription**:
- No prior ADR or refactor addresses the Dictionary tab's UX. The doc-side claim is the implied prescription; the code doesn't honour it.
- Composes with **REFACTOR-670** (NEW this batch — bare `/terms` renders blank): if Path C is chosen, the new list page can ALSO be the bare-`/terms` redirect target (`<Route path={termsPath()}><Route index element={<Navigate to='/terms/list' replace />} /></Route>`) — closing both gaps with one shape.

**Proposed remedy**: Maintainer triage between A / B / C. Default recommendation (per the velocity-over-process bias): **Path A** — update the doc to describe the actual search UI. The doc-pillar follow-up creates a DOC-NNN backlog item for the rewrite + screenshot.

If the maintainer triages Path A:
- Update the live page at `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` section "The Dictionary tab".
- Update related callouts on the parent `https://docs.opendatadiscovery.org/features/data-glossary` page that say "Open it from the top-level navigation Dictionary tab (the in-app surface for browsing and curating terms)" — the "browsing" framing also implies a list.

If the maintainer triages Path C (most operator-friendly):
- Author `TermsListPage.tsx`.
- Add a `termsListPath()` builder per ADR-CANDIDATE-228 convention.
- Mount at `/terms/list` (or `/terms` index — both align with ADR-CANDIDATE-227).
- Wire ToolbarTabs.tsx:67 to the new list page.
- Update doc to reference both surfaces.

**Severity rationale**: MEDIUM — operator-mental-model mismatch causing real friction (the empty initial state of `/termsearch` after clicking "Dictionary" is a UX dead-end for first-time users). Not HIGH because the operator CAN recover (typing a query OR applying a facet surfaces results). Not LOW because the doc-vs-code drift is observable and the operator mental model is the deployment expectation.

**Suggested backlog grouping**: `Doc pillar — DOC-NNN` (Path A) OR `Glossary UX sprint` (Path C composes with REFACTOR-670).
