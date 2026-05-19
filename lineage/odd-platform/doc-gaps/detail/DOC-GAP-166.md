- **DOC-GAP-166**: `to_tsquery` operator-injection on PERSISTED `search_facets.query_string` — `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) splits user input on a single space, appends `:*` to each token, joins with `&`, and embeds verbatim into `to_tsquery(?)` at `JooqFTSHelper.java:100-105`; NO escaping of tsquery operators (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\`); a caller who POSTs a search with `query='foo )('` PERSISTS the row in `search_facets.query_string`; every SUBSEQUENT facet aggregator that runs on that row's state — every `getSearchFacetList` AND every `getFiltersForFacet` call — fails at `to_tsquery` parse time with Postgres `42601` "syntax error in tsquery"; the session row is reachable but EVERY facet read 500s INDEFINITELY; the failure mode is PERSISTENT-PER-SESSION, distinct from the EPHEMERAL injection in DOC-GAP-080 (which only affects the originating `search` call); combined with DOC-GAP-104 (the SQL-format-injection on `getHighlightedResult`), the persisted-injection-broken-session surface is the THIRD invocation site of the same `JooqFTSHelper.tsQuery` bug at a wider operational cost (HIGH; strengthens DOC-GAP-104 + DOC-GAP-080 with persistence dimension)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__SearchController__controller-method__facets.md:bugs_limitations_corner_cases.[4]` (HIGH) **(NEW batch M — controller-method primary source for facets)**
    - `odd-platform__java__SearchController__controller-method__facets.md:security.known_security_gaps.[2]` (HIGH — paired with batch H)
    - `odd-platform__java__SearchController__controller-method__facets.md:concepts.invariants.[5]` (the FTS site shared across every facet aggregator)
    - Cross-batch: batch-H `ReactiveDataEntityRepositoryImpl.md` (DOC-GAP-104 — the SQL-format-injection on `getHighlightedResult` — the SAME `JooqFTSHelper.tsQuery` code surface); batch-E `SearchController.search.md` (DOC-GAP-080 — the ephemeral query-syntax injection on `search` itself)
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses` (the FTS aggregate weakness now has THREE invocation-site primary sources)
  - **Evidence**:
    - `JooqFTSHelper.java:164-168` — verbatim:
      ```
      public static String tsQuery(String plainQuery) {
          return Arrays.stream(plainQuery.split(" "))
              .map(q -> q + ":*")
              .collect(Collectors.joining("&"));
      }
      ```
      The split-and-join produces a tsquery-meaningful string composed of user input tokens. No escaping.
    - `JooqFTSHelper.java:100-105` — verbatim:
      ```
      public Condition ftsCondition(Field<Object> vectorField, String query) {
          if (StringUtils.isEmpty(query)) {
              return DSL.noCondition();
          }
          return DSL.field("? @@ to_tsquery(?)", vectorField, tsQuery(query));
      }
      ```
      The `tsQuery(query)` result is embedded as a parameter to `to_tsquery(?)`. Parameterisation prevents SQL injection (the value is a string literal to Postgres), but the value is interpreted by Postgres as a tsquery expression — tsquery operators within the value are honoured at parse time.
    - `ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582` — EVERY facet aggregator's FTS condition site:
      - Line 182: entity-class aggregator's FTS site
      - Line 267: type aggregator's FTS site
      - Line 469: status aggregator's FTS site
      - Line 582: tag aggregator's FTS site
      And similar at the owner / group aggregators. All five call `ftsCondition(SEARCH_ENTRYPOINT.SEARCH_VECTOR, state.getQuery())`.
    - `SearchServiceImpl.java:75-82` — `search` creates a row via `searchFacetRepository.create(new SearchFacetsPojo(uuid, query, ...))`; the `query` is the raw caller-supplied text up to varchar(255); persisted verbatim into `search_facets.query_string`.
    - `V0_0_1__init.sql:209` — `query_string varchar(255)` — column accepts up to 255 chars of any content; no CHECK constraint, no character-class validation.
    - **Attack shape**: (a) Caller A POSTs `POST /api/search` with body `{query: "foo )("}`. (b) The platform creates a `search_facets` row with `query_string = "foo )("`. (c) Caller A immediately receives the UUID and the initial `SearchFacetsData` (the FIRST call already 500s — distinct ephemeral failure per DOC-GAP-080). (d) Caller A (or anyone with the UUID per DOC-GAP-161) issues `GET /api/search/{uuid}` — the facet aggregators fire; every aggregator calls `ftsCondition(SEARCH_ENTRYPOINT.SEARCH_VECTOR, "foo )(")` which produces `to_tsquery('foo )(:*')` — Postgres raises `42601 "syntax error in tsquery at character N"`. (e) The GET returns HTTP 500. (f) The same call returns 500 on every subsequent attempt; the session is PERMANENTLY BROKEN.
    - **Severity over DOC-GAP-080**: DOC-GAP-080 captures the EPHEMERAL injection on the originating `search` call (the row is created but the first read fails; subsequent reads with the bad query_string would also fail, but in practice a UI client never reaches the persisted-read path after a 500 on POST). This finding's persistence dimension is wider: even when the originating POST succeeds (e.g. the caller has `query='foo'`, the POST creates the row, then a malicious actor later updates the row via `updateFacets` with `query='foo )(' `), every subsequent read of that session 500s. The session is a DoS surface for any caller who can READ or DRIVE that UUID.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` 2026-05-19 status 200 (re-verified in current session) — verbatim: "**Status: Not addressed in documentation**" on tsquery operator escaping for special characters.
  - **Proposed doc action**: **Two-part action**.
    1. **Code-side primary** (file `/log-issue odd-platform`): refactor `JooqFTSHelper.tsQuery` to escape tsquery operators. Three ordered options. (a) **Minimum**: use Postgres `plainto_tsquery(?)` instead of `to_tsquery(?)` — `plainto_tsquery` parses user input as plain text, escaping operators automatically; the prefix-match `:*` semantic is lost but the platform's search affordance is restored to safe defaults. (b) **Medium**: keep `to_tsquery` but pre-escape tsquery-meaningful characters in the input before splitting: `query.replaceAll("[!()|:&<>\\\\']", " ")` — preserves prefix-match while stripping operators. (c) **Full**: combine with structured operator support via a query-DSL layer; allow operators to OPT-IN to advanced tsquery operators via a query-prefix `expert:` marker; default to the safe `plainto_tsquery` behaviour.
    2. **Doc-side primary** (until the code-side fix lands): extend `features/data-discovery/search.md` with a "Query syntax safety" sub-section (cross-link DOC-GAP-080): "Search queries containing the special characters `! ( ) : | < > \ '` are interpreted by Postgres's tsquery parser as operators. Queries with unbalanced or malformed operator combinations will return an HTTP 500 'syntax error in tsquery' error. The platform PERSISTS your query in a search session; subsequent reads of the session also 500 until you create a new session with a clean query. As a workaround until tsquery operator handling is fixed: avoid the special characters above in search queries; if you need to find entities containing parentheses or punctuation in their names, use the facet filters (Tag, Owner, Namespace, etc.) which do not invoke tsquery."
    3. **Pillar-side meta-recommendation** (cross-link DOC-GAP-167 META): the search-page coverage gap on tsquery semantics has been DOC-GAP-080 (query syntax) + DOC-GAP-161 (session UUIDs) + DOC-GAP-160 (facet counts) + this finding (persisted injection) — four distinct doc-coverage gaps on one page across THREE batches. The page needs a comprehensive rewrite, not piecemeal additions.
  - **Cross-references**:
    - DOC-GAP-080 (search query syntax silent — original ephemeral injection on `search`) — this finding adds the PERSISTENCE dimension; together they form the FTS-injection-surface cluster
    - DOC-GAP-104 (SQL-format-injection on `getHighlightedResult`) — sibling finding on a DIFFERENT code surface (`String.formatted` vs `to_tsquery` parser); both are downstream of `JooqFTSHelper.tsQuery`
    - DOC-GAP-160 (NEW batch M — facet count scoping silent) — sibling finding on the same controller; the persisted-injection breaks the facet aggregators that this finding documents
    - DOC-GAP-161 (NEW batch M — session UUIDs are bearer tokens) — sibling finding on the same controller; the bearer-token UUIDs are the planting + propagation vector for the persistent break
    - DOC-GAP-167 META (NEW batch M — REV-3 LAYER-0 P-05 Data Lineage sub-feature overpromise) + the search-page doc-coverage cluster
    - REFACTOR-201 / REFACTOR-222 (existing refactoring scopes for the highlight + search-surface area) — adds the FTS-parser-safety axis
    - LSN-001 / LSN-002 — operator-impact-by-omission class
  - **Severity rationale**: HIGH — the persistence dimension is the load-bearing axis. The EPHEMERAL injection (DOC-GAP-080) is bounded by the originating call's failure; this finding's persistent-broken-session is a DoS surface for any caller with the UUID. Combined with DOC-GAP-161 (UUIDs as bearer tokens), the attack shape is: malicious actor obtains a UUID via URL leak → updates the session's query with a malformed tsquery expression → the legitimate session-owner's subsequent reads all 500. The doc-side action is the workaround documentation; the code-side action is the `plainto_tsquery` migration as the minimum-viable fix.
