---
doc_gap_id: DOC-GAP-306
severity: MEDIUM
category: drift
batch: ZI
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-01"           # Data Discovery — Directory sub-feature (four-level browse)
related_features: []
related_doc_gaps:
  - DOC-GAP-014      # Legacy /data-discovery/directory URL 404 (sibling URL-archaeology)
  - DOC-GAP-201      # DirectoryController reconnaissance surface (sibling visibility silence)
  - DOC-GAP-138      # NaN-swallowing route hook cluster — see Strengthens append
related_retrospectives:
  - LSN-018          # Rule-6 coherence-conflict mechanism
---

## DOC-GAP-306 — Live `/features/data-discovery/directory` doc page (WebFetched 2026-05-26 status 200) lists the four URL patterns including the level-3 form `/directory/{type-prefix}/{data-source-id}/all`, but does NOT explain that the literal segment `'all'` is an **in-band sentinel** meaning "no type filter; show all entity types of this data source" — the doc asymmetrically explains level-4's `{type-id}` as a numeric id but offers NO equivalent explanation for level-3's `all` literal; the asymmetry leaves operators deep-linking to level-3 URLs without understanding what `all` represents (would `any` work? what if the data source has only one entity type? is `all` reserved or arbitrary?); separately the doc page is SILENT on what happens when the `{data-source-id}` segment is non-numeric (e.g. a typo / stale bookmark to `/directory/postgresql/abc/all`) — the UI's `useDirectoryRouteParams` hook coerces via `parseInt(dataSourceId, 10)` with NO `isNaN` guard, propagating `NaN` through every consumer to a backend 400/404 with an AppErrorPage surface; the doc does not warn that level-3/level-4 URLs require numeric IDs and offers no link to "how to find a data-source-id"

**Severity**: MEDIUM
**Category**: drift (doc-asymmetry on level-3 magic-string + missing guidance on URL well-formedness; LSN-020-adjacent on the sentinel value)

### Surfaced by

- `odd-platform__ts__routes__route__directory.md:docs_link_semantic.doc_drift_findings.[2]` ("Doc gap — the `'all'` magic string is NOT explained. The live doc page (2026-05-26 status 200) lists `/directory/{type-prefix}/{data-source-id}/all` as the level-3 URL pattern but does NOT explain that `'all'` is an in-band sentinel meaning 'no type filter; show all entity types'. An operator deep-linking to a Directory level-3 URL has to either (a) read the source or (b) navigate from level 2 to learn that the `all` segment is special. The same docs page does explain level 4's `{type-id}` as a numeric id, by contrast — so the asymmetry is real. A one-sentence addition to the doc would close the gap.") **(NEW batch ZI — directory-route sidecar PRIMARY SOURCE)**
- `odd-platform__ts__routes__route__directory.md:concepts.invariants.[2]` ("`useDirectoryRouteParams` coerces `dataSourceId` via `parseInt(dataSourceId, 10)` (line 37) with NO `isNaN` guard. A deep-link to `/directory/postgresql/abc/all` produces `dataSourceId: NaN`; consumers (`DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`) receive `NaN` and call backend APIs with `dataSourceId=NaN`; the backend responds 400/404 — same shape as the `useTermsRouteParams` NaN-swallowing pattern (`terms` sidecar `invariants[2]`)")
- `odd-platform__ts__routes__route__directory.md:concepts.invariants.[1]` ("The `'all'` literal is a load-bearing magic string shared across THREE files: this module's hook coercion (line 34), the inner Routes' Navigate fallback (`Directory/DirectoryRoutes.tsx:16`), and `EntitiesTabs.tsx:26`. NO named constant unites them. Renaming `'all'` to e.g. `'any'` in one location without the others silently desynchronises the Navigate target / hook recognition / tab builder.")
- `odd-platform__ts__routes__route__directory.md:implicit_adrs.[2]` ("The literal `'all'` is the in-band sentinel for 'no type filter at the entity-list level'. Choosing a sentinel STRING (rather than e.g. an explicit `?typeId=` query param or an explicit `*` wildcard) is a deliberate convention: the URL `/directory/{prefix}/{dsId}/all` is human-readable and self-describing (the operator types it and understands they're asking for 'all types'), whereas a missing query param or a `*` would obscure intent.")
- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases.[2]` (LOW per sidecar — "The literal `'all'` is a load-bearing magic string shared across THREE files with no named constant uniting them. Renaming `'all'` to e.g. `'any'` in one location without the others silently desynchronises") — code-side drift surface that the doc-side silence compounds
- Cross-link DOC-GAP-201 — DirectoryController visibility silence (the SAME page is silent on access control); together they cover the Directory page's doc-coverage cluster
- Cross-link DOC-GAP-138 (NaN-swallowing cluster — directory's `useDirectoryRouteParams` is now the 4th cluster instance — see Strengthens append this batch)

### Evidence

- **Code primary source — the `'all'` sentinel mechanism**: `odd-platform-ui/src/routes/directoryRoutes.ts:34` (per directory-route sidecar): the hook coerces `typeId === 'all' ? undefined : parseInt(typeId, 10)`. The literal string `'all'` is recognised; any other non-numeric input produces `NaN`. The downstream UI's Type-column toggle (`TableHeader.tsx:22`) consumes the resolved `typeId` and renders the Type column ONLY when `typeId` is `undefined` (i.e. when the URL segment was literally `'all'`).
- **Code primary source — the sentinel is shared across THREE files**: per sidecar `invariants[1]`:
  - `directoryRoutes.ts:34` recognises `typeId === 'all'`
  - `Directory/DirectoryRoutes.tsx:15-17` uses `<Navigate to='all' replace />` to redirect level-3-bare URLs to level-3-with-`all`
  - `EntitiesTabs.tsx:26` builds the 'All' tab URL via `directoryDataSourcePath(prefix, dsId, 'all')`
  - The three sites are coordinated by the literal string `'all'` with no shared constant.
- **Code primary source — the NaN-propagation path**: per sidecar `invariants[2]`:
  - `directoryRoutes.ts:37` — `parseInt(dataSourceId, 10)` with no guard
  - Six consumer files (`DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`) consume the parsed value with no null/NaN check
  - `Entities.tsx:36-41` passes `{dataSourceId: NaN}` to `useGetDataSourceEntities` → backend `GET /api/directory/datasources/NaN/types` → 400/404 → UI surfaces `AppErrorPage` (per `Entities.tsx:60-64`)
- **Live doc primary source — fresh WebFetch this session**: `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-26 status **200** (inherited from directory-route sidecar's enrichment this session; the four URL patterns are documented verbatim). Verbatim per sidecar `inferred_docs.[0].fetched_excerpts`:
  - *"Level 1 — Data source types: `/directory`"*
  - *"Level 2 — Data sources of selected type: `/directory/{type-prefix}`"*
  - *"Level 3 — Entity types within selected data source: `/directory/{type-prefix}/{data-source-id}/all` (UI surfaces this on the data-source detail page)"*
  - *"Level 4 — Entities of selected (data source, entity type) pair: `/directory/{type-prefix}/{data-source-id}/{type-id}`"*
  The doc lists `'all'` verbatim in the level-3 pattern but does NOT explain what `'all'` means semantically. It DOES describe `{type-id}` at level 4 implicitly as a numeric id (via the `{type-id}` curly-brace placeholder convention). The asymmetry is the doc-product defect.
- **The doc asymmetry argument (verbatim)**: the same docs page explains level 4's `{type-id}` as a numeric id (via the curly-brace placeholder); but at level 3, `'all'` is a literal string with quote-marks, not a placeholder. The placeholder convention versus literal-string convention is the visual difference; the doc does not name `'all'` as a SENTINEL. An operator unfamiliar with the convention reads the level-3 pattern and may assume `all` is itself a placeholder for some value (e.g. a sentinel like `*` or `any`), or may assume it's a verbatim required literal but not understand the semantic.
- **The operator-impact narrative — deep-link confusion**: an operator wants to share "the PostgreSQL data-source #1 with all entity types visible" as a link. They construct `/directory/postgresql/1/all` from the doc page. The URL works. They then want to share "the PostgreSQL data-source #1 with only TABLE types visible" — they need the `type-id` for TABLE. The doc does not surface where to find a `type-id`; the operator clicks through the UI, finds the TABLE tab, copies the URL bar (which is the level-4 form), shares that. The asymmetry surfaces only on this path. **Alternative scenario**: an operator types `/directory/postgresql/1/any` or `/directory/postgresql/1/all-types` or `/directory/postgresql/1/*` — these all fail (the `useDirectoryRouteParams` hook returns `typeId: NaN` for non-numeric non-`'all'` strings); the UI may render an empty entities list with the Type column suppressed (`TableHeader.tsx:22 if (!typeId)` toggles the column off because `NaN` is falsy). The operator sees inconsistent behaviour with no doc-side explanation.
- **The operator-impact narrative — typo bookmark**: an operator bookmarks `/directory/postgresql/abc/all` after a typo in `1`. They later return, see an empty Entities page (the AppErrorPage surfaces 400/404 from the backend). They cannot tell from the UI whether (a) the data source was deleted, (b) the URL is malformed, or (c) the platform is broken. The doc does not warn that level-3/4 URLs require numeric `{data-source-id}`.
- **The cluster context**: this finding shares the load-bearing-magic-string class with `:typeId === 'all'` (the existing finding) and the load-bearing-numeric-id class with the NaN-swallowing cluster (DOC-GAP-138). The Directory page joins the cluster on both axes. The doc-side fix is bounded: one sentence on `'all'` + one sentence on numeric IDs.

### Proposed doc action

**TWO-PART action — extend the live doc page with explicit URL-form explanations; cross-link to the NaN cluster.**

1. **Doc-side PRIMARY — extend `documentation/docs/features/data-discovery/directory.md`** (or the equivalent local-repo path) with a NEW sub-section "URL form and well-formedness" under the URL-level enumeration:

   > ## URL form and well-formedness
   >
   > The Directory page URLs use four levels:
   >
   > - **Level 1** — `/directory` — the data-source-types overview.
   > - **Level 2** — `/directory/{type-prefix}` — data sources of the selected ODDRN-prefix type (e.g. `postgresql`, `snowflake`, `kafka`). The prefix is one of the platform's registered ODDRN-prefix values; `other` is the sentinel for unknown-ODDRN data sources.
   > - **Level 3** — `/directory/{type-prefix}/{data-source-id}/all` — entity-types-overview for a specific data source. The literal segment **`all`** is a *sentinel* meaning "show entities of all types within this data source"; the URL is reachable by clicking a data-source row from level 2, or by direct deep-link. Substituting any other value for `all` (e.g. `any`, `*`, `every`) is NOT supported — only the literal `all` is recognised.
   > - **Level 4** — `/directory/{type-prefix}/{data-source-id}/{type-id}` — entities of a specific (data-source, entity-type) pair. `{type-id}` is a numeric id; substitute the integer id of the entity type (visible in the URL bar after clicking a Type tab on level 3).
   >
   > **`{data-source-id}` and `{type-id}` are numeric.** A URL with a non-numeric `{data-source-id}` (e.g. a typo `/directory/postgresql/abc/all`) renders an error page — the platform's reactive API returns 404 for the underlying data-source-types lookup. If a deep-link or bookmark renders an error page, verify that the `{data-source-id}` matches the integer id of an existing data source.
   >
   > **The `all` literal is reserved.** It is the only non-numeric value the level-3 / level-4 URL pattern accepts at the `{type-id}` position. Any other non-numeric string produces an error page.

2. **Doc-side COMPANION — add a "Where to find a data-source-id" cross-link** in the same sub-section pointing to the Management → Datasources page (where the operator can copy the numeric id from the row) OR to the API-reference `GET /api/datasources` endpoint (which lists data sources with their numeric ids).

3. **Code-side OPTIONAL — three ordered options at `/log-issue odd-platform`**:

   - **Minimum (constant extraction)**: extract `'all'` to a shared constant `DIRECTORY_ALL_TYPES_SENTINEL = 'all'` exported from `directoryRoutes.ts`; import at the three call sites (the hook, `DirectoryRoutes.tsx`, `EntitiesTabs.tsx`). Removes the magic-string drift class. One-file change at the source; three small edits at consumers.
   - **Medium (NaN guard)**: add `if (Number.isNaN(parsedDataSourceId)) return <NotFoundPage />;` at the consumer-facing entry points (or in a shared `useStrictParams` utility per DOC-GAP-138 strengthen). Closes the silent NaN propagation path. The fix is symmetric with the proposed action in DOC-GAP-138 strengthen.
   - **Full (URL-shape upgrade)**: replace the `'all'` sentinel with an explicit `?typeId=` query parameter (level-3 becomes `/directory/{type-prefix}/{data-source-id}`, with a missing `?typeId` meaning "all types"; level-4 becomes `/directory/{type-prefix}/{data-source-id}?typeId={id}`). Backwards-incompatible at the URL surface; aligns with platform-wide conventions where filters are query params (per the Activity Feed `?type=` parameter). Requires the Navigate redirect at `DirectoryRoutes.tsx:15-17` to be reworked; the existing in-band-sentinel URLs would need a `<Navigate>` shim during deprecation.

### Cross-references

- **DOC-GAP-014** (legacy `/data-discovery/directory` URL 404 — sibling URL-archaeology on the same Directory page; THIS finding extends the page's URL-coverage gap on the SEMANTIC dimension)
- **DOC-GAP-201** (NEW batch T — DirectoryController reconnaissance surface — sibling visibility silence on the SAME page; together they cover the Directory page's doc-coverage on TWO axes: visibility / access (201) + URL semantics / well-formedness (304))
- **DOC-GAP-138** (NaN-swallowing route-hook cluster — Directory's `useDirectoryRouteParams` joins as the 4th cluster instance; see Strengthens append this batch)
- **DOC-GAP-095 META** (Read-collaborative cross-owner enumeration cluster) — cross-link via DOC-GAP-201
- **DOC-GAP-149 META** (REV-3 LAYER-0 — P-01 doc-page coverage drift) — THIS finding is a P-01 instance: the canonical Directory page has structural URL-semantic silence

### Severity rationale

MEDIUM. The doc-page silence on the `'all'` sentinel is a coverage gap that operators discover by trial and error; the NaN-propagation path is a UX defect (no security boundary crossed, no data lost — the operator gets an AppErrorPage and recovers by going back). Severity is MEDIUM because:

1. **The URL surface is moderately load-bearing**: Directory is one of the platform's 9 top-nav features, used for catalog browsing. URL-based deep-linking to specific data-source + type combinations is a routine operator action (e.g. linking a colleague to "the PostgreSQL prod-warehouse's TABLE entities").
2. **The asymmetry between the doc's level-3 (`'all'` literal, unexplained) and level-4 (`{type-id}` placeholder, implicitly numeric) is a real doc-product defect**: a careful operator reading the page notices the inconsistency and forms questions the doc does not answer.
3. **The NaN-propagation path is operator-trust-eroding**: a stale bookmark renders an error page with no path to recovery (the operator cannot tell what went wrong). The fix is straightforward (add a guard + a NotFoundPage shim) but requires either doc-side warning (this finding) or code-side fix (DOC-GAP-138 strengthen).
4. **The cluster context strengthens the case**: together with DOC-GAP-201 (visibility) + DOC-GAP-014 (legacy URL), the Directory page now has THREE distinct doc-gap findings; one PR could close all three.

Severity is NOT HIGH because: (a) the doc page is silent / asymmetric, not actively wrong; (b) the operator-impact is UX confusion, not security exposure; (c) the operator can recover from a typo bookmark by clicking back / navigating from the level-1 landing.

Severity is NOT LOW because: (a) the magic-string `'all'` is a load-bearing convention with no shared constant + no doc explanation; (b) the NaN-propagation pattern is the 4th instance in a known cluster (DOC-GAP-138) that the workspace has already flagged as a class; (c) the doc-page-asymmetry is a real doc-product defect that any reasonable reviewer would call out.

### Last verified

- 2026-05-26 — directory-route sidecar PRIMARY SOURCE at substrate commit `ede5d277`; live WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/directory` status **200** (inherited from sidecar enrichment this session — verbatim URL patterns confirmed in `inferred_docs.[0].fetched_excerpts`); cross-corroboration via `directoryRoutes.ts:30-41` (the hook + builder + sentinel mechanism) + six consumer-file reads + `Directory/DirectoryRoutes.tsx:11-17` (the Navigate redirect).
