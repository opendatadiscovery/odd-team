## STRENGTHENS — Search.tsx UI-COMPONENT PAGE-ROOT primary source confirms the FTS-injection at the Catalog UI text-input layer in batch ZL

DOC-GAP-080 (Search live doc page silent on query syntax) was originally surfaced by the SearchController + JooqFTSHelper backend layer; DOC-GAP-249 (REFACTOR-229 UI-side complement) was added at batch ZE via Search.tsx orchestrator. Batch ZL refreshes the Search.tsx component sidecar at substrate commit `4ec2b20` and provides the CANONICAL PAGE-ROOT primary source confirming the operator-visible Catalog page surface where the typed query enters the system.

### Added surfaced_by (new sidecar cited)

- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases.[FTS-injection: typed search-query text passes UNESCAPED through to to_tsquery(?)]` (HIGH per sidecar — verbatim: "MainSearchInput.tsx:43-44 builds `searchFormData = {query, pageSize:30, filters:{}}` and dispatches verbatim. Server-side `JooqFTSHelper.tsQuery` at `JooqFTSHelper.java:164-168` performs `plainQuery.split(' ').map(q -> q + ':*').join('&')` — NO escaping of tsquery metacharacters (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\\`). A typed query of `foo ) | (bar` reaches `to_tsquery(?)` and Postgres raises `42601 syntax error in tsquery`. The session UUID is then **permanently poisoned** ... **For the `highlightDataEntity` path the same untrusted text is INTERPOLATED into a raw SQL string via `.formatted(text, tsQuery)` — TRUE SQL injection per batch-ZE TRUE-SQL-injection finding at ReactiveDataEntityRepositoryImpl.java:798-806.**")
- `odd-platform__ts__react-component__component__Search.md:stress_findings.name_behavior_pairs.[MainSearch placeholder='Search']` (DRIFT_NAME_VS_BEHAVIOR — "Operator typing natural-language text mostly works (because whitespace-separated words get :*-suffixed and AND-joined — equivalent to prefix-and-AND). But operator typing punctuation triggering tsquery metacharacters (e.g. an entity name containing colons or parens) gets 500 + permanently broken session per REFACTOR-229. The 'Search' label does not warn the user; the docs do not describe tsquery syntax.")
- `odd-platform__ts__react-component__component__Search.md:concepts.operations.[Subcomponent dispatch chain]` — confirms: "Since Search.tsx mounts `<MainSearch>` WITHOUT `mainSearch=true` (line 80), Enter on the Catalog page's text input dispatches `updateDataEntitiesSearch({searchId: storedSearchId, searchFormData: {query, pageSize:30, filters:{}}})` SYNCHRONOUSLY (MainSearchInput.tsx:42-48). **Critically: typed text is dispatched as-is — no sanitisation, no escape of FTS metacharacters (`!`, `|`, `&`, `(`, `)`, `:`, `*`, `<->`).** Results.tsx then triggers pagination via `fetchDataEntitySearchResults({searchId, page+1, size:30})` for infinite scroll (Results.tsx:71-74)."
- Probe **P-188** (per Search.tsx sidecar `stress_findings.probes_emitted[0]`) — "confirm the session-poisoning end-to-end."

### New evidence (supplementary)

- **The Catalog page is the canonical operator entry point**: per sidecar `understanding`: `Search.tsx` (lines 1-92) is the Data Discovery pillar's **Catalog page** root SPA component — the user-facing entry point at `/search/*` (App.tsx:61). Combined with the toolbar 'Catalog' tab linking to `searchPath()` (batch ZH ToolbarTabs sidecar), this confirms that the FTS-injection vector is reachable from the platform's most-used operator surface (the Catalog click is one of the most-frequent operator actions).
- The DOC-GAP-249 STRENGTHENS chain (LookupTables → DOC-GAP-215 → DOC-GAP-249) is RE-CONFIRMED at the page-root layer.
- **WebFetch re-verification 2026-05-26**: per Search.tsx sidecar `docs_link_semantic.inferred_docs` — `https://docs.opendatadiscovery.org/features/data-discovery/search` status **200** within the 11-day stale-probe window per LSN-018. The live doc remains silent on the tsquery syntax + the session-poisoning risk.

### Severity update

Severity remains **HIGH** — primary-source re-confirmation at the Catalog page root strengthens the structural cluster (controller + service + repository + UI page-root + UI text input). The doc-side fix (live page rewrite with tsquery syntax + session-poisoning caveat) remains the primary action.

---

**Batch ZL contribution**: 1 NEW PRIMARY SOURCE at the Catalog page root (Search.tsx component); coverage to existing DOC-GAP-080 + DOC-GAP-249 + DOC-GAP-166 + DOC-GAP-104 strengthened; severity unchanged (HIGH); probe P-188 cross-referenced.
