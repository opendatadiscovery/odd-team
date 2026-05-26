---
doc_gap_id: DOC-GAP-305
severity: MEDIUM
category: drift
batch: ZI
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 80637ed
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-01:F-002"     # Search and Filtering — Catalog page
related_features:
  - F-001
related_doc_gaps:
  - DOC-GAP-161      # search_facets schema — bearer-token session UUID (sibling — schema layer)
  - DOC-GAP-249      # Search.tsx tsquery injection + session poisoning (sibling — UX-tier security)
  - DOC-GAP-080      # search live doc silent on query syntax (sibling — same page coverage)
  - DOC-GAP-079      # search WHO + visibility (sibling — same page coverage)
related_retrospectives:
  - LSN-001          # operator-trap canonical
  - LSN-002          # operator-trap canonical
  - LSN-018          # Rule-6 coherence-conflict mechanism
---

## DOC-GAP-305 — Live `/features/data-discovery/search` doc page is COMPLETELY SILENT on the `/search/{searchId}` URL form, on session-UUID URL semantics from the UI perspective, on deep-link sharing UX (what the recipient sees vs what the sender saw), AND on the tab-click-drops-session behaviour — operators interacting with the URL bar have ZERO documentation; the doc covers HOW to search (free-text + facets + 7 filter list) but not the URL surface that mediates session sharing, bookmark fragility, and tab-navigation side-effects; the URL form's `:searchId` NAME further DRIFTS from its actual semantic (it is a server-side session UUID, not a saved-search id) — distinct from DOC-GAP-161 (which is the SCHEMA-tier finding on bearer-token session semantics) by being the URL-form + UX-tier doc-coverage complement

**Severity**: MEDIUM
**Category**: drift (doc-page silence on a load-bearing URL surface + Category F LSN-020-class drift on the `searchId` path-segment NAME)

### Surfaced by

- `odd-platform__ts__routes__route__search.md:docs_link_semantic.doc_drift_findings.[0]` ("The live doc page does NOT mention the `/search/{searchId}` URL form at all. WebFetched 2026-05-26: the page describes free-text + faceted search and lists the 7 facets, but the entire URL-shape / session-persistence / deep-link-sharing story is undocumented. An operator reading the doc has no way to know that (a) the URL bar carries a session UUID, (b) the UUID is shareable, (c) the UUID represents a persisted server-side row, (d) tab-clicking the 'Catalog' tab drops the session.") **(NEW batch ZI — search-route sidecar PRIMARY SOURCE)**
- `odd-platform__ts__routes__route__search.md:docs_link_semantic.doc_drift_findings.[1]` ("The live doc page does NOT mention the access model for the Catalog page. No statement of 'every authenticated user can search' or 'search is read-collaborative'. Operators have to infer the absence of access-controls.")
- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases.[2]` (LOW per sidecar — "Clicking the 'Catalog' top-nav tab DROPS the current search session. ToolbarTabs.tsx:38 links to `searchPath()` (no UUID). When a user has an active session at `/search/{uuid}` and clicks the 'Catalog' tab, the URL becomes `/search` (no param); Search.tsx:37-42 sees `!routerSearchId && !searchId` and creates a NEW empty session via `useCreateSearch({query:'', pageSize:30, filters:{}})`. The user's previous filter state is lost (the URL no longer points at the prior UUID). This may be intentional (a 'fresh catalog view' affordance) but is undocumented.")
- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases.[5]` (LOW per sidecar — "No URL state for ANY filter / facet / query / page-position — only the session UUID. A user filtering by `Type=Dataset, Owner=Alice` cannot bookmark a URL that encodes that filter; they must rely on the server-side `search_facets` row persisting. If the row TTL is short (or zero — see Stress Protocol Category F, probe P-168), the bookmark breaks.")
- `odd-platform__ts__routes__route__search.md:stress_findings.name_behavior_pairs.[searchPath]` (MINOR drift — "`searchPath` is a misleading name for ODD's vocabulary — the doc page calls this 'Catalog'. A new developer searching the codebase for 'Catalog' would not find this module; the search URL `/search` is also the source of the route's name, not the user-visible label. Documenting case-law: the same drift exists for the top-nav tab — labelled 'Catalog' in ToolbarTabs.tsx:38 (t('Catalog')) but the URL/path/route is /search.")
- `odd-platform__ts__routes__route__search.md:stress_findings.request_inputs.[searchId]` (DRIFT_INPUT_NAME_VS_IMPLEMENTATION — "The name `searchId` promises 'a saved/persistent search identifier'. The implementation uses it as a SERVER-SIDE SESSION ROW UUID — a transient row in `search_facets` that was minted by the most recent `POST /api/search` and that has no user binding, no TTL guarantee at this layer, no 'saved search' semantics. The same row gets MUTATED on every facet change (PUT /api/search/{searchId}/facets). The UUID is not user-meaningful, not bookmarkable in the way 'saved search #42' would be, not durable in the way a saved-search id would be.")
- Cross-link DOC-GAP-161 — the SCHEMA-tier complement (bearer-token UUID semantics from the backend angle); THIS finding adds the UI / URL-form / UX-tier complement
- Cross-link DOC-GAP-249 — Search.tsx tsquery injection / session poisoning (a different doc-page silence on the same page); together they cover the search-page coverage cluster

### Evidence

- **Code primary source — the URL form**: `odd-platform-ui/src/routes/searchRoutes.ts:7-12` (per search-route sidecar) — the function `searchPath(searchId?)` returns `/search` with no arg and `/search/{searchId}` with one. The route mount at `App.tsx:61` declares `<Route path={searchPath() + '/*'} element={<Search/>}/>` — a wildcard accepting any string in the segment.
- **Code primary source — the session-creation roundtrip**: `Search.tsx:37-42` (per sidecar) — on mount with no URL UUID, dispatches `createDataEntitiesSearch` → `POST /api/search` → server allocates a `search_facets` row → `useCreateSearch.ts:17` navigates the URL bar to `/search/{uuid}` immediately. The user typing `/search` lands on `/search/{uuid}` within one render cycle.
- **Code primary source — the tab-click-drops-session UX**: `ToolbarTabs.tsx:38` (per sidecar) — the 'Catalog' top-nav tab has `link: searchPath()` (no UUID). Clicking the tab while the user is at `/search/{uuid}` navigates to `/search`; `Search.tsx:37-42` then re-runs the create-session branch (since `routerSearchId` is now undefined); the user's filter state from the prior session is abandoned (the URL no longer references the prior UUID; the previous filters are unreachable except via browser back-button).
- **Code primary source — the Category F drift on `searchId`**: per sidecar `stress_findings.request_inputs.[searchId]` — the parameter name promises 'saved-search id' (the conventional reading of `{id}` in REST URLs); the implementation uses it as a session UUID. The name's mental model leads operators to expect: stable identifier, persistent across sessions, link-shareable, possibly enumerable via a "my saved searches" list (none of which exist in ODD). The actual behaviour: transient row, no user binding, mutated by every PUT /facets call.
- **Live doc primary source — fresh WebFetch this session**: `https://docs.opendatadiscovery.org/features/data-discovery/search` 2026-05-26 status **200**. Verbatim per WebFetch prompt response this session:
  - URL form `/search/{searchId}` or `/search/{uuid}`: **ABSENT**
  - Session UUIDs: **ABSENT**
  - Persisting search state across navigation: **ABSENT**
  - Deep-link sharing of searches: **ABSENT**
  - Tab-click behaviour: **ABSENT**
  - Access control / who can use search: **ABSENT**
  The doc focuses on the search INTERFACE (the input field, the 7 facets, the empty-state) but addresses NONE of the URL-mediated behaviour.
- **The distinctness from DOC-GAP-161**: DOC-GAP-161 covers the SCHEMA-tier finding — `search_facets` has no user binding, UUID is bearer-token. The proposed doc action for DOC-GAP-161 is a "Session handling" admonition focused on SECURITY (treat URLs as confidential). THIS finding covers the UX-tier complement — the doc page is silent on the URL FORM ITSELF, on what the operator should expect when they share or bookmark a URL, on what tab-clicking does. An operator reading DOC-GAP-161's admonition (after it's authored) would know to treat URLs as confidential — but would still not understand what the URL DOES (creates? restores? mutates? abandons?). The two findings are complementary: DOC-GAP-161 is the SECURITY admonition; THIS finding is the UX-MENTAL-MODEL admonition.
- **The distinctness from DOC-GAP-249**: DOC-GAP-249 covers the SECURITY-tier UI complement on tsquery injection + session poisoning. The proposed action is also a search-page admonition but on a different axis (query syntax + injection / poisoning). THIS finding covers the URL-form + tab-behaviour + Category-F-name dimensions.
- **The Catalog vs Search naming-drift evidence**: per sidecar `name_behavior_pairs.[searchPath]` — the top-nav tab is labelled "Catalog" in i18n (`ToolbarTabs.tsx:38` → `t('Catalog')`); the URL is `/search`; the route module is `searchRoutes.ts`; the React component is `Search.tsx`; the live doc page is at `/features/data-discovery/search`; the doc title is "Search and Filtering". Five different surface names for the same feature. A new operator (or new developer) searching the codebase for "Catalog" finds nothing; searching for "Search" finds the wrong-tier file. The doc page should at minimum acknowledge the Catalog / Search synonym at the top of the page.
- **The operator-impact narrative — bookmark fragility (LOW)**: an operator builds a complex faceted search (Datasource=Snowflake + Owner=Alice + Tag=Critical), bookmarks `/search/{uuid}` for daily use. The `search_facets` row TTL story is unspecified at the UI layer (the search-route sidecar emitted P-168 to resolve); if a Housekeeping job ever evicts stale rows, the bookmark 404s silently. The operator sees an empty Catalog, may not realize it's a 404, files a "my saved search disappeared" bug. The doc page does not warn that `/search/{uuid}` URLs are not durable.
- **The operator-impact narrative — sharing surprise (MEDIUM)**: an operator shares `/search/{uuid}` with a colleague (Slack, email, bug report). The recipient opens the link. The recipient sees whatever state the session has AT FETCH TIME. If the sender has been clicking around in their own UI (each click mutates the same row via `PUT /api/search/{uuid}/facets`), the state the recipient sees is DIFFERENT from what the sender saw at share time. The recipient may also mutate the session (the row has no user binding per DOC-GAP-161), which then changes what the sender sees on next refresh. The doc has no warning that "shared URLs are mutable, multi-party"; operators reasonably expect "URLs are immutable views" (the convention from every other catalog UI).
- **The operator-impact narrative — tab-click loses work (LOW)**: an operator at `/search/{uuid_A}` with filter state set, clicks the "Catalog" top-nav tab to check something, comes back. The URL is now `/search/{uuid_B}` (a fresh session); their filters are gone. The browser back-button restores `/search/{uuid_A}` but only if the previous session row still exists. The doc has no warning that the top-nav tab is destructive of session state.

### Proposed doc action

**THREE-PART action — extend the live doc page with three new sections; cross-link to the schema-tier finding DOC-GAP-161 for the security side; surface the Catalog/Search synonym.**

1. **Doc-side PRIMARY — extend `documentation/docs/features/data-discovery/search.md`** (or the equivalent local-repo path) with a NEW section "Catalog page URLs and session handling":

   > ## Catalog page URLs and session handling
   >
   > The Catalog page lives at `/search` (with no URL parameters) and at `/search/{search-id}` (with a session UUID).
   >
   > - When you visit `/search` (the "Catalog" top-nav tab), the platform allocates a fresh server-side **search session** and immediately redirects the URL bar to `/search/{uuid}`. The UUID represents your in-progress query + filters state on the server.
   > - As you type queries, change facets, or paginate, the platform updates the SAME session row server-side. The URL UUID stays the same; the session's state on the server changes.
   > - When you share the URL `/search/{uuid}`, you grant anyone with the URL READ + WRITE access to your session's state. The recipient sees whatever state the session has at fetch time — which may differ from what you saw at share time if you keep using the search after sharing. Mutations the recipient makes (clicking facets, changing query text) propagate back to your view on refresh.
   > - The session UUID is NOT a saved-search id. There is no "My saved searches" page; UUIDs are not enumerable; there is no built-in expiry visible at the UI layer.
   > - Bookmarking `/search/{uuid}` saves a pointer to a session that may eventually be evicted by server-side housekeeping (see [DOC-GAP-161](../../adrs/notes/...) for the schema-layer caveats on session lifecycle).
   > - **Clicking the "Catalog" top-nav tab while you are at `/search/{uuid}` is destructive**: it navigates to `/search` (no UUID), which immediately allocates a NEW session. Your previous session UUID remains in the browser's back-history but the new session has no link to it. To preserve the old session, bookmark the URL bar before clicking the tab.
   > - There are no query-string parameters for filters, query text, or page position — the session UUID is the only URL-bearing state. URLs cannot encode partial state.

2. **Doc-side COMPANION — name the Catalog/Search synonym at the top of the page**: the page title is "Search and Filtering" and the URL is `/search`, but the top-nav tab and operator vocabulary both use "Catalog". Add a one-line preface: *"Note: the platform's catalog-browsing surface is variously called 'Catalog' (in the top navigation), 'Search' (in the URL), and 'Search and Filtering' (the canonical feature name). The three terms refer to the same page."*

3. **Doc-side COMPANION — extend the page with a "Who can use search" admonition** (closing the access-control silence — same shape as the proposed DOC-GAP-200 / DOC-GAP-263 admonitions on adjacent features):

   > **Visibility**: the Catalog page is reachable by every authenticated user; under `auth.type=DISABLED`, it is anonymously reachable. The search results respect the per-data-entity visibility model (exclude-from-search + hollow filtering); there is no per-user-owner filter. See [DOC-GAP-079](#) for the page-completeness cross-link.

4. **Code-side OPTIONAL — three ordered options at `/log-issue odd-platform`**:

   - **Minimum**: rename the `:searchId` path segment to `:sessionId` (or `:searchSessionId`) across `searchRoutes.ts`, `App.tsx`, `useCreateSearch.ts`, `Search.tsx`, the OpenAPI spec, and the backend `SearchController`. Aligns the URL name with the implementation. Backwards-incompatible for any external integrator who hardcoded `/search/{searchId}`.
   - **Medium**: add a per-feature `?q=` + `?filters=...` query-string state mode (alongside the session-UUID mode) so that URL-only bookmarks can encode partial state. Lossy (complex facet combinations don't compress to query-strings well) but enables true bookmark-shareable searches. Requires UI + API + spec changes.
   - **Full**: introduce explicit "saved searches" as a first-class feature (a `saved_searches` table with `owner_id`, `name`, `query`, `filters`; UI surfaces for save / list / load / share). The `/search/{searchId}` URL becomes the persistent saved-search address; the current session model becomes private to the browser tab. Larger feature; aligns the URL name with what operators expect.

### Cross-references

- **DOC-GAP-161** (NEW batch M — `search_facets` schema bearer-token-shape) — SCHEMA-tier complement of THIS finding; together they cover the search-session story on TWO tiers: schema (DOC-GAP-161, security admonition) + URL-form-UX (THIS finding, mental-model admonition). The two proposed admonitions land on the SAME page (`/features/data-discovery/search`); the maintainer's most-efficient pass adds both sections in one edit.
- **DOC-GAP-249** (NEW batch ZA — Search.tsx tsquery injection + session poisoning) — sibling UX-tier doc-coverage gap on the same page; THIS finding covers the URL-form / session-UX dimension, DOC-GAP-249 covers the query-syntax / injection dimension; together with DOC-GAP-079 (visibility), DOC-GAP-080 (query syntax), DOC-GAP-161 (schema bearer-token), the search-page doc-coverage cluster now has FIVE distinct findings on the same surface — each closing a different operator-mental-model gap.
- **DOC-GAP-079** (search WHO + visibility silence) — sibling page-completeness gap; THIS finding's "Who can use search" admonition (part 3) closes the same gap from the URL-form section
- **DOC-GAP-080** (search query syntax silence) — sibling page-completeness gap; THIS finding does not extend it (the query-syntax dimension is fully covered by DOC-GAP-080)
- **DOC-GAP-095 META** (Read-collaborative cross-owner enumeration cluster) — THIS finding's access-control silence reinforces the META cluster
- **DOC-GAP-149 META** (REV-3 LAYER-0 — P-01 doc-page coverage drift) — THIS finding is a P-01 instance: the canonical Search page has structural URL-form silence
- **LSN-020** — the `:searchId` Category F drift is an LSN-020-class instance (name promises "saved-search id"; impl uses it as session UUID)
- **LSN-001 / LSN-002** — operator-trap on bookmark-fragility + sharing-surprise + tab-destructive-click

### Severity rationale

MEDIUM. The doc-page silence on the URL form does not silently mislead the operator (DOC-GAP-303 / DOC-GAP-304 are HIGH for that shape); it is a coverage gap that operators discover by trial and error. The bookmark fragility + sharing-surprise + tab-destructive-click are real UX defects but are LOW-severity individually (no data loss, no security breach beyond the read-collaborative posture already documented in DOC-GAP-200). The compound is MEDIUM because:

1. **The URL surface is load-bearing**: every operator using the Catalog page interacts with the URL bar (the search page is the platform's most-used page after the dashboard). The doc's complete silence on the URL form means every operator builds their own (potentially wrong) mental model.
2. **The sharing surprise is the most material consequence**: an operator shares a URL with a colleague expecting "view of the catalog as I see it now"; they get "live pointer to my mutable session". The behaviour violates the convention from every other catalog UI; the doc has no warning.
3. **The cluster context strengthens the case**: with DOC-GAP-161 (schema) + DOC-GAP-249 (security) already filed, the Search page doc-coverage cluster has FIVE complementary findings. Closing them together (one PR that adds three admonitions to the page) is the maintainer-efficient path; THIS finding is the URL-form / UX-mental-model piece.
4. **The Category F drift on `:searchId` is LSN-020-instance**: the parameter name's drift is structural; renaming is the code-side fix, but the doc-side description of what the segment represents is the lower-cost first pass.

Severity is NOT HIGH because: (a) the doc page is silent, not actively wrong (contrast DOC-GAP-303 / DOC-GAP-304 where the doc ACTIVELY misleads); (b) the operator-impact is UX confusion + bookmark fragility, not security exposure or compliance failure; (c) the fix is bounded (three admonition sections on one page).

Severity is NOT LOW because: (a) the URL surface is load-bearing for the most-used page in the platform; (b) the sharing-surprise + tab-destructive-click combine to a real operator-trust harm — operators who get burned by these once lose trust in URL-based sharing across the platform; (c) the LSN-020-class drift on `:searchId` is the kind of mid-layer naming drift the workspace exists to surface.

### Last verified

- 2026-05-26 — search-route sidecar PRIMARY SOURCE at substrate commit `80637ed`; live WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` status **200** (direct fetch this session — five-axis absence confirmed verbatim: URL form, session UUIDs, persistence, deep-link sharing, tab-click); cross-corroboration via `searchRoutes.ts:1-19` + `App.tsx:61` + `Search.tsx:27-48` + `ToolbarTabs.tsx:38, 93` + `useCreateSearch.ts:17` (all statically read; the URL-mediated session lifecycle is unambiguous).
