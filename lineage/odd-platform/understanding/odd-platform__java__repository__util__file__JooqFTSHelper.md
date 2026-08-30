---
node_id: "odd-platform java odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/util file:JooqFTSHelper.java"
node_kind: file
axis: files
extracted_at_commit: 82e7e70e29f05902640a2f69490f33fc65c68ba3
enriched_at_commit: 82e7e70e29f05902640a2f69490f33fc65c68ba3
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-08-30-01
source_state: |
  Read from the WORKING TREE of the `contrib/CTRIB-060-search-query-operators`
  worktree, whose branch tip is 82e7e70e (verified:
  `.git/worktrees/odd-platform-ctrib060/logs/HEAD` records one checkout and no
  commit; `refs/heads/contrib/CTRIB-060-search-query-operators` == 82e7e70e,
  which is the CTRIB-059 GATE-2 merge). The #1840 / ST-6 query-grammar work
  described below is therefore UNCOMMITTED at the cited commit. Every line
  number in this sidecar refers to the working-tree file as read on 2026-08-30.
related_features:
  - F-001          # P-01:F-001 Search and Filtering — this node is the FTS sink for every search surface
back_links:
  probes:
    - P-392        # operator-leaf cap: what the HTTP caller sees at 64 vs 65 leaves
    - P-393        # the per-OR-branch querytree() guard: does it actually buy the index scan
---

# JooqFTSHelper — semantic understanding

## understanding

`JooqFTSHelper` is the single Spring `@Component` through which every full-text
search surface in the platform builds SQL: it compiles a user's search string
into a Postgres `tsquery` expression (`tsQueryExpression`), wraps that expression
into a match predicate (`ftsCondition`) and a relevance score (`ftsRankField`),
compiles facet selections into jOOQ `Condition`s (`facetStateConditions`,
`resultFacetStateConditions`), and builds the `WITH … INSERT … ON CONFLICT DO
UPDATE` statement that writes the weighted `tsvector` index rows
(`buildVectorUpsert`). As of #1840 / ST-6 it is also where the product's
**user-facing query grammar** lives — bare words prefix-match and AND together,
while a `"quoted phrase"`, a `-excluded` term and the bare word `or` compile
compositionally out of `phraseto_tsquery` / `plainto_tsquery` / `to_tsquery`
leaves joined by the SQL-level tsquery operators `&&`, `||` and `!!`. Because 10
repository implementations and 62 call sites route through this one class, a
change here changes the unified cross-kind search, the legacy session search,
term / query-example / lookup-table search, autocomplete suggestions, the sidebar
facet counts and the `ts_headline` result highlights simultaneously — which is
why the grammar was added here rather than at any one endpoint. The class holds
no mutable state and executes nothing: every method returns a jOOQ fragment for
a caller to assemble and run.

## concepts

- entities: [SearchQuery, TsQueryExpression, OperatorGroup, OperatorLeaf, PrefixTerm, QuotedPhrase, NegatedTerm, OrBranch, SearchVector (tsvector), SearchEntrypointRow, FacetStateDto, SearchFilterDto, FacetType, FTSConfigDetails, FTSWeight]
- operations: [compile-query-to-tsquery, detect-operator-usage, tokenise-into-or-groups, sanitise-tsquery-metacharacters, append-prefix-marker, build-phrase-leaf, build-negation-leaf, conjoin-leaves, guard-branch-index-searchability, build-match-condition, build-rank-field, compile-facet-conditions, split-cte-vs-join-facet-conditions, build-weighted-vector-upsert, aggregate-vectors]
- invariants:
  - "One grammar, one sink: `ftsCondition`, `ftsRankField` and the `ts_headline` highlight all route through the SAME `tsQueryExpression`, so a row cannot be matched by one query and highlighted by another" — file:line: JooqFTSHelper.java:122, :174, :197 + ReactiveDataEntityRepositoryImpl.java:799-801
  - "An operator-free query takes the byte-identical pre-#1840 path — `operatorGroups` returns `null` and `prefixTsQuery` emits the single `to_tsquery(<sanitised>)` call" — file:line: JooqFTSHelper.java:198-201, :246-248, :329-331 + JooqFTSHelperTest.java:130-135
  - "Operators NARROW, they never revoke prefix matching: the bare terms of an operator query are appended through the same `prefixTsQuery` builder as the non-operator path" — file:line: JooqFTSHelper.java:316-322 + JooqFTSHelperTest.java:137-145
  - "`AND` binds tighter than `or`: each whitespace-separated group is conjoined with `&&` first, then the groups are joined with `||`" — file:line: JooqFTSHelper.java:203-220, :225-233
  - "A quoted span is consumed BEFORE `-` and `or` are interpreted, so `\"customer or orders\"` is one phrase and the `-` inside a phrase is literal text" — file:line: JooqFTSHelper.java:274-285 + JooqFTSHelperTest.java:147-164
  - "Every user-supplied value reaches Postgres as a BIND (`DSL.val`), never as rendered SQL text — for bare terms, phrases and negations alike" — file:line: JooqFTSHelper.java:301, :325, :330 + JooqFTSHelperTest.java:205-213
  - "Every leaf is a Postgres constructor that cannot raise on metacharacters: `phraseto_tsquery` and `plainto_tsquery` parse plain text; only `to_tsquery` parses tsquery syntax, and its argument is pre-sanitised by `tsQuery`" — file:line: JooqFTSHelper.java:44-49, :301, :325, :330
  - "An expression with no surviving branch collapses to `CAST('' AS tsquery)` — the empty tsquery matches nothing and never raises 42601" — file:line: JooqFTSHelper.java:221-222, :333-335
  - "The empty tsquery is the identity for `&&` and `||`, which is what lets a guarded branch be dropped rather than voiding the whole expression" — file:line: JooqFTSHelper.java:208-213 (stated intent), :214-219 (the construction)
  - "`buildVectorUpsert` rejects an empty vector-field list outright but silently drops any field with neither a weight nor a remapping (WARN only)" — file:line: JooqFTSHelper.java:94-96 vs :364, :379-392
  - "The vector upsert is idempotent by construction: `ON CONFLICT DO UPDATE SET target = excluded.target` recomputes the whole column from current row state — no read-modify-write" — file:line: JooqFTSHelper.java:117, :398-400
- audiences:
  - "Every catalog user who types in the search box (home hero + `/search` page) or the Dictionary / query-example / lookup-table search fields" — file:line: odd-platform-ui/src/components/shared/elements/MainSearchInput/MainSearchInput.tsx:60-79, odd-platform-ui/src/components/Search/Search.tsx:132
  - "Third-party API consumers of `POST /api/assets/search` and the legacy `/api/search` session endpoints" — file:line: AssetSearchController.java:25-33, SearchController.java:50-55
  - "Collectors ingesting metadata — the write half (`buildVectorUpsert`) runs on the ingestion path" — file:line: service/ingestion/processor/FTSVectorsIngestionRequestProcessor.java:8, :15

## dependencies_semantic

- requires-feature:
  - "`FTSConfig.FTSConfigDetails` — supplies (vectorTable, vectorTableIdField, ftsWeights, conditionsMap) per FTS entity kind" — file:line: FTSConfig.java:46-50 + JooqFTSHelper.java:68, :100, :115
  - "`FTSConstants.DATA_ENTITY_CONDITIONS` — the facet→Condition function map `resultFacetStateConditions` hardcodes" — file:line: FTSConstants.java:79-118 + JooqFTSHelper.java:37, :151, :163
  - "`FacetStateDto` / `SearchFilterDto` — the parsed facet selection the two facet compilers walk" — file:line: JooqFTSHelper.java:135, :143-147, :158
  - "`Pair` (platform utility) — the (cteConditions, joinConditions) return shape" — file:line: JooqFTSHelper.java:28, :169
- requires-config: []  — no `@Value`, no `@ConfigurationProperties`, no environment-driven knob; every tunable in this file is a `private static final` (verified by reading the whole file, lines 1-401)
- requires-runtime:
  - "PostgreSQL with the text-search functions `to_tsquery`, `phraseto_tsquery`, `plainto_tsquery`, `querytree`, `ts_rank`, `setweight`, `to_tsvector` and the tsquery operators `@@`, `&&`, `||`, `!!`" — file:line: JooqFTSHelper.java:122, :174, :215, :301, :325, :330, :365
  - "The custom aggregate `tsvector_agg`, created in migration V0_0_14__normalize_fts_process.sql" — file:line: JooqFTSHelper.java:368-369 + odd-platform-api/src/main/resources/db/migration/V0_0_14__normalize_fts_process.sql:21
  - "GIN indexes on the `*_search_entrypoint.search_vector` columns — the index the querytree guard exists to keep reachable" — file:line: V0_0_1__init.sql:235-236, V0_0_35__add_terms.sql:75-76
  - "The database's DEFAULT text-search configuration — neither the tsquery constructors nor `concatVectorFields`' `to_tsvector` pass an explicit config, so matching and indexing move together if a deployment changes the default" — file:line: JooqFTSHelper.java:325, :330, :365 + ReactiveDataEntityRepositoryImpl.java:796-798 (the same choice restated for `ts_headline`)
  - "jOOQ generated model (`Tables.DATA_ENTITY`) and the jOOQ plain-SQL templating engine (`DSL.field`/`DSL.condition` with `{0}` placeholders)" — file:line: JooqFTSHelper.java:36, :122, :214-219

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Every tsquery metacharacter (`! & ' ( ) * : < > |` and backslash) is stripped, prefix `:*` and `&` joining survive, empty tokens are dropped, an all-metacharacter query collapses to `\"\"`"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:29-76]
  - behaviour: "Operator DETECTION matches the intended grammar — `my-table` / `e-mail` / `2024-01-01` / a trailing dash / `oracle` / `ORdering` / `sales_or_ops` are NOT operators; a quoted span, a boundary `-term`, and the whole token `or` (any case) ARE"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:83-128]
  - behaviour: "An operator-free query compiles to EXACTLY the pre-existing `to_tsquery('customer:*&orders:*')` — structural parity, not just equivalent results"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:130-135]
  - behaviour: "Bare terms inside an operator query keep their `:*` prefix (the published search.md promise survives operator use)"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:137-145]
  - behaviour: "A quoted span is tokenised first: `or` and `-` inside quotes are phrase text; a negated phrase works; an unterminated quote runs to end-of-input rather than dropping the text"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:147-164]
  - behaviour: "The index-searchability guard is emitted once PER OR-BRANCH (two `querytree` occurrences for `customer or -test`), not once over the union"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:166-176]
  - behaviour: "Past the 64-leaf cap the expression is exactly `CAST('' AS tsquery)` and does NOT contain the plain-path `to_tsquery('term:*` — fail closed, never fall back to the inverting path"
    test_class: unit
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:190-203]
  - behaviour: "Single quotes in user text are escaped by the bind renderer (`'O''Brien said'`) — no literal breakout"
    test_class: security
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java:205-213]
  - behaviour: "End-to-end against a real Postgres: a quoted phrase matches only adjacent words; `-term` EXCLUDES (previously REQUIRED); `or` returns either branch; prefix survives inside an operator query; a non-indexable `or` branch is dropped without voiding the query; a negation-only query returns an empty page"
    test_class: integration
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/AssetSearchServiceIntegrationTest.java:303-409]
  - behaviour: "20 operator-shaped poison payloads (`\"unbalanced`, `trailing-`, `or`, `-`, `- -`, `--`, `\"\" \"\"`, `-\"`, `\"-\"`, `?`, `{0}`, …) each return a page, never 42601 / 500"
    test_class: security
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/AssetSearchServiceIntegrationTest.java:411-429]
  - behaviour: "Term search survives tsquery-metacharacter poisoning (including `'` and `<`, which a naive `[()&|!*:]` strip misses)"
    test_class: security
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTermSearchTsQueryPoisonTest.java:28-70]
  - behaviour: "`ts_headline` binds both the text and the query as data — an injection payload in the highlighted text is returned verbatim, not executed"
    test_class: security
    test_files: [odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityHighlightInjectionTest.java:32-71]
- uncovered_behaviours:
  - behaviour: "What the HTTP caller receives when the leaf cap is tripped — status code, body shape, and whether anything distinguishes 'refused' from 'no matches'"
    test_class: integration
    criticality: HIGH
    note: "The unit test pins the SQL string; nothing pins the surface. Probe P-392."
  - behaviour: "That the per-branch `querytree()` guard actually produces an index scan (the entire justification for its existence is a plan-level claim in a comment)"
    test_class: performance
    criticality: HIGH
    note: "If `querytree()` did not return 'T' on the deployed Postgres, every negation-only branch would silently degrade to a sequential scan and no existing test would go red. Probe P-393."
  - behaviour: "`-or`, `-\"\"` and `-<stop word>` — a NEGATED token that reduces to an empty tsquery"
    test_class: security
    criticality: MEDIUM
    note: "The poison list at AssetSearchServiceIntegrationTest.java:416-419 covers `or`, `-`, `--`, `- -` but not `-or`; the negation branch at JooqFTSHelper.java:300-302 is reached only when `negated` is true, which `-or` satisfies (line 292 requires `!negated`). One more payload closes it."
  - behaviour: "`facetStateConditions` called with an EMPTY function map silently returns no conditions"
    test_class: unit
    criticality: MEDIUM
    note: "`FTSConstants.QUERY_EXAMPLE_CONDITIONS` and `LOOKUP_TABLES_CONDITIONS` are both `Map.of()` (FTSConstants.java:126-127). No test asserts what happens to a facet selection on those two kinds."
  - behaviour: "`resultFacetStateConditions` drops the ENTITY_CLASSES condition when `state.isMyObjects()` is true"
    test_class: integration
    criticality: MEDIUM
    note: "JooqFTSHelper.java:157-162 has no defending comment and no test; the caller adds no replacement predicate (ReactiveDataEntityRepositoryImpl.java:657-672)."
  - behaviour: "`buildVectorUpsert` when EVERY vector field lacks both a weight and a remapping"
    test_class: unit
    criticality: LOW
    note: "`concatVectorFields` would join an empty stream into an empty expression string (JooqFTSHelper.java:362-369). The empty-list guard at :94-96 does not cover this shape."
- test_files:
  - odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelperTest.java
  - odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/AssetSearchServiceIntegrationTest.java
  - odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTermSearchTsQueryPoisonTest.java
  - odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityHighlightInjectionTest.java
- gaps: |
    The query-grammar half of this file is unusually well covered — unit tests pin
    the compiled SQL structurally (including the negative case: an operator-free
    query must compile byte-identically to the pre-#1840 expression), and
    Testcontainers tests assert what a USER sees for each operator. The weakest
    class is **performance**: zero tests touch a query PLAN, so the guard at
    :214-216 and the cap at :61 are both justified by comments no test can falsify
    (P-393 and P-392 close this).

    The second weak area is the **facet** half of the file, which has no dedicated
    test at all. `facetStateConditions` and `resultFacetStateConditions` carry two
    silent-drop behaviours (an unmapped FacetType at :350-353, and ENTITY_CLASSES
    under `myObjects` at :157-162) that a regression would land in unnoticed — the
    integration tests that exist all drive the QUERY dimension, never the facet
    dimension against this compiler.

    A regression would land in `operatorGroups`' single-pass scanner
    (:245-314): its index arithmetic around the `-` lookahead (:260-273) and the
    unterminated-quote branch (:274-285) is the kind of code a well-meaning
    refactor breaks, and only the structural SQL assertions would catch it.

## docs_link_semantic

- declared_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: "(none — page-level)"
    source_annotation: |
      Prose Javadoc citation, not a formal `@docs` tag: JooqFTSHelper.java:186-189
      names `docs/data-discovery/search.md` and quotes the published promise
      verbatim — "the search box ... matches the remaining words as prefixes" —
      as the reason `websearch_to_tsquery` was rejected. Grepping the file for
      `@docs` returns zero hits (whole file read, lines 1-401).
    last_verified_at: "2026-08-30T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      From "Known limitations and operator caveats" (WebFetch 2026-08-30, verbatim):

        "**`tsquery` operator characters in the search box are treated as word
        separators.** PostgreSQL full-text search parses the query as a `tsquery`,
        so characters such as `( ) : & | ! '` are not searchable literals — the
        search box strips them and matches the remaining words as prefixes. A name
        like `user(id)` is searched as `user` and `id` (and still matches an entity
        called `user(id)`); a query made up of only these characters returns **No
        matches found**. The same handling applies to the Dictionary (term) search
        box. (As of 0.28.0; in earlier releases these characters were not stripped
        — such a query failed with HTTP 500 and persisted a broken `/search/{uuid}`
        session, reproduced on every later read of that URL until the housekeeping
        job evicted the row.)"

      From "Technical details" (WebFetch 2026-08-30, verbatim):

        "The underlying constants used by the search engine are defined in
        FTSConstants.java"

      Headings present on the live page (WebFetch 2026-08-30): Search and
      Filtering / Faceted search / Result-class tabs / Per-result transparency /
      Technical details / Known limitations and operator caveats / Where else
      search appears / Where to next. There is NO "Query syntax" heading.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: "#query-syntax"
    rationale: "The user-facing description of the three operators this node implements; the section that will document the grammar."
    last_verified_at: "2026-08-30T00:00:00Z"
    last_verified_status: anchor-missing
    confidence: LOW
    pending_release: "1.0.0"
    train_ref: "release/1.0.0 @ 5b2bb04 docs/data-discovery/search.md#query-syntax"
    note: |
      NOT drift. The operators are unreleased behaviour, so the "Query syntax"
      section rides the documentation release train per
      `adrs/drafts/release-train-doc-gating.md`; GitBook publishes docs `main`, so
      the live site cannot show it yet. Verified that the train branch exists:
      `documentation/.git/refs/remotes/origin/release/1.0.0` == 5b2bb04. Verified
      that the local documentation checkout (a contrib branch off main) has no
      Query-syntax section — its search.md:93 is still the pre-operator caveat.
      Confidence stays LOW until the release gate publishes and a later enrichment
      verifies live.
- doc_drift_findings:
  - "The live page's character list is a SUBSET of what the code strips: the page enumerates `( ) : & | ! '` while `TSQUERY_SPECIAL_CHARS` also strips `*`, `<`, `>` and backslash — a reader learns that `<` is a searchable literal when it is a word separator. Live text WebFetched 2026-08-30; code at JooqFTSHelper.java:49. (Whether the 0.28.0 release the page describes had the same set is out of this node's scope — the released tag was not read.)"
  - "The live page's caveat says nothing about `\"` or `-`, which are absent from the strip set at JooqFTSHelper.java:49 and are therefore NOT word separators. On the published behaviour a reader would have to discover for themselves that `-term` does not exclude; the code comment at :309-312 states plainly that the plain path 'reads `-test` as a REQUIRED term'. This is a released-truth gap on a live page, distinct from the release-train-gated operator section."
  - "Live 'Technical details' points readers at `FTSConstants.java` as where 'the underlying constants used by the search engine are defined'. The constants that decide what a query MEANS — the metacharacter set, the operator-detection pattern, the `or` keyword and the 64-leaf cap — are all in `JooqFTSHelper.java:44-61`, not in FTSConstants (which holds only the per-kind weight maps and facet-condition maps, FTSConstants.java:34-134)."

## implicit_adrs

*(Quoting convention: each `intent_anchor` is the comment text at the cited range
with Javadoc markup elided — `{@code X}` and `{@link X}` render as `X`. Prose,
punctuation, capitalisation and emphasis are verbatim; an ellipsis marks an
omitted middle.)*

- "Compose the query grammar out of tsquery primitives instead of delegating to `websearch_to_tsquery`, so that an operator NARROWS a query without revoking the published prefix-matching promise" — evidence: JooqFTSHelper.java:183-190 — intent_anchor: "They are compiled COMPOSITIONALLY out of tsquery primitives rather than by handing the raw string to websearch_to_tsquery, because that function performs no prefix matching -- and this product publishes the opposite promise (\"the search box ... matches the remaining words as prefixes\", docs/data-discovery/search.md). Composing lets an operator NARROW a query without revoking the promise: cust -test still prefix-matches cust, where websearch_to_tsquery finds nothing." — confidence: HIGH
- "Define the grammar in ONE shared sink so no search surface can develop a second dialect" — evidence: JooqFTSHelper.java:177-181 — intent_anchor: "the single place the product's query grammar is defined. Every FTS surface (the unified cross-kind search, the legacy session search, terms, query examples, lookup tables, autocomplete suggestions, the facet counts and the ts_headline highlights) builds its query here, so they cannot drift into two dialects." — confidence: HIGH
- "Guard index-searchability PER OR-BRANCH rather than over the whole expression, accepting a duplicated `CASE` per branch to keep a good branch answerable" — evidence: JooqFTSHelper.java:208-213 — intent_anchor: "Guard EACH OR-BRANCH, not the whole expression. ... Guarding the whole expression instead would make `customer or -test` return NOTHING, when the `customer` branch alone is a perfectly good index scan (measured on postgres:13.2-alpine)." — confidence: HIGH
- "Fail CLOSED past the operator-leaf cap — an over-long operator query matches nothing rather than silently reverting to the semantics the feature exists to fix" — evidence: JooqFTSHelper.java:309-313 — intent_anchor: "FAIL CLOSED -- never fall back to the plain path here: that path reads `-test` as a REQUIRED term, i.e. the exact inversion this feature exists to fix, and it would apply silently." — confidence: HIGH
- "Keep injection safety a STRUCTURAL property (Postgres constructors + binds) rather than a validation step that a future leaf type could forget" — evidence: JooqFTSHelper.java:192-195 — intent_anchor: "every leaf comes from a Postgres constructor that cannot raise on metacharacters -- to_tsquery over the existing tsQuery sanitiser for bare terms, phraseto_tsquery for phrases, plainto_tsquery for exclusions -- and every user-supplied value is a BIND, never rendered into SQL text (#1756 / #1840)." — confidence: HIGH
- "Route the bare terms of an operator query through the SAME builder as the non-operator path so prefix parity is structural rather than test-enforced" — evidence: JooqFTSHelper.java:318-321 — intent_anchor: "The bare terms of an operator query go through the SAME sanitiser + to_tsquery call the non-operator path uses, so prefix parity is structural rather than something a test has to catch." — confidence: HIGH
- "Consume a quoted span FIRST in the single-pass scanner, making quoting the strongest binding in the grammar" — evidence: JooqFTSHelper.java:241-243 — intent_anchor: "The scan is a single left-to-right pass, and ORDER MATTERS: a quoted span is consumed FIRST, so \"customer or orders\" stays one phrase instead of being split on the or inside it" — confidence: HIGH
- "Leave the text-search configuration implicit on every side (tsquery leaves, indexed vectors, highlights) so a deployment that changes the Postgres default moves matching and highlighting together instead of desynchronising them" — evidence: JooqFTSHelper.java:325, :330, :365 (no config argument on any constructor) + ReactiveDataEntityRepositoryImpl.java:796-798 — intent_anchor: "The text-search config is left implicit on BOTH sides (it was hardcoded 'english' here while the tsquery and the indexed vectors - concatVectorFields' to_tsvector(...) - all use the database default), so highlighting and matching cannot diverge on a deployment that sets a different default." — confidence: HIGH
- "Match the operator-detection regex to `websearch_to_tsquery`'s own tokenisation decisions case by case, rather than inventing a stricter or looser rule" — evidence: JooqFTSHelper.java:51-55 — intent_anchor: "a `-` at a token boundary with a term after it (an exclusion -- NOT `my-table` / `e-mail` / `2024-01-01` / a trailing dash), or the bare word `or` (NOT `oracle` / `ORdering` / `sales_or_ops`). Verified case-by-case against websearch_to_tsquery." — confidence: HIGH

## bugs_limitations_corner_cases

- "The `or` TOKEN is counted against the leaf budget even though it produces no leaf: `operatorLeaves++` fires in the `or` branch at :297 exactly as it does for a phrase (:282) or a negation (:301). A query of N alternatives therefore trips the 64-leaf cap at roughly N=33, not N=64 — half the budget the constant advertises, with no way for a caller to know the arithmetic." — evidence: JooqFTSHelper.java:292-298 vs :59-61 — severity: MEDIUM
- "Tripping the cap is indistinguishable from an empty catalog at every surface: `operatorGroups` returns `List.of()` (:313), the branch loop at :203 never executes, and `tsQueryExpression` yields `CAST('' AS tsquery)` (:222). No exception, no log line, no response flag — the caller receives a normal empty page. The decision to fail closed is right (:309-312); the silence about it is the gap." — evidence: JooqFTSHelper.java:203-222, :309-313 — severity: MEDIUM — probe: P-392
- "The whole justification for the per-branch guard is a plan-level claim that no test can falsify. If `querytree()` stopped returning `'T'` for a negation-only branch on a future Postgres, the `CASE` would take its ELSE arm, the query would still return the same (empty) rows, and every existing test would stay green while every negation-only branch silently became a sequential scan of the search index." — evidence: JooqFTSHelper.java:208-216 + JooqFTSHelperTest.java:178-188 (asserts the SQL contains `querytree`, not what it evaluates to) — severity: MEDIUM — probe: P-393
- "`tsQuery(String)` remains PUBLIC while `tsQueryExpression` is now the real entry point. A future caller reaching for the obvious-looking `tsQuery` gets the pre-#1840 semantics — no phrase, no `or`, and `-term` as a REQUIRED term — reintroducing exactly the inversion #1840 fixed, with no compiler or test signal. Verified it currently has no production caller: `grep -rn 'tsQuery(' <odd-platform-repo>/odd-platform-api/src/main/java` returns only its own declaration (:337) and its single internal use (:330)." — evidence: JooqFTSHelper.java:329-331, :337-345 — severity: MEDIUM
- "An asset whose name contains the standalone word `or` cannot be found by pasting its name into the search box: `Sales or Marketing` compiles to `Sales OR Marketing` (two branches), returning every asset matching either word instead of the one asset the user copied. Same class for a name containing ` - ` (`Q3 - 2024` excludes `2024`). This is inherent to a websearch-style grammar and the tooltip does warn about the operators — but the failure is silent and the affected assets are exactly the ones with the most human names." — evidence: JooqFTSHelper.java:54-55 (detection), :292-298 (`or` splits the group), :260-273 (` - ` negates the following token) — severity: MEDIUM
- "`facetStateConditions` silently produces NOTHING for any FacetType absent from the supplied map (`compileFacetCondition` returns null at :351-352, filtered at :138). `FTSConstants.QUERY_EXAMPLE_CONDITIONS` and `LOOKUP_TABLES_CONDITIONS` are both `Map.of()` (FTSConstants.java:126-127), so every facet a caller supplies to query-example search (ReactiveQueryExampleRepositoryImpl.java:79, :98) and lookup-table search (ReactiveLookupTableRepositoryImpl.java:115, :133) is discarded with no error and no signal. Whether the UI offers those facets is a question for the query-example / lookup-table UI sidecars." — evidence: JooqFTSHelper.java:125-140, :347-355 + FTSConstants.java:126-127 — severity: MEDIUM
- "`resultFacetStateConditions` drops the ENTITY_CLASSES facet condition entirely when `state.isMyObjects()` is true (:157-162), and the only caller adds no replacement predicate — `findByState` consumes just the two returned lists (ReactiveDataEntityRepositoryImpl.java:657, :659, :672). There is no comment defending the exclusion. The UI keeps My-Objects and an Asset-type narrowing independently selectable (SearchResultsTabs.tsx:41-45: 'a class narrowing is a refinement of All, not of My'), so the combination is expressible. Whether the current UI still reaches this legacy path, or only third-party callers of `/api/search/{searchId}/results` do, belongs to the SearchController sidecar." — evidence: JooqFTSHelper.java:155-165 + ReactiveDataEntityRepositoryImpl.java:653-672 + SearchResultsTabs.tsx:41-45 — severity: MEDIUM
- "`buildVectorUpsert` guards the empty-list case with an exception (:94-96) but drops an individual unweighted, unremapped field with only a WARN (:379-392, filtered at :364). A field silently missing from the vector makes its content permanently unsearchable, and the only evidence is a log line on a write path that runs per ingestion batch." — evidence: JooqFTSHelper.java:94-96, :362-366, :379-392 — severity: MEDIUM
- "If EVERY field in `vectorFields` is unweighted, `concatVectorFields` joins an empty stream into an empty expression string and hands `DSL.field(\"\")` (or `tsvector_agg()`) to the insert — the empty-list guard at :94-96 does not cover this shape. Not reachable from the four committed weight maps (FTSConstants.java:37-77), which is why this is a latent trap rather than a live defect." — evidence: JooqFTSHelper.java:94-96, :362-369 — severity: LOW
- "The `or` keyword is the English word only (`OR_OPERATOR = \"or\"`, :57, matched case-insensitively at :292). A francophone user typing `ou` gets a bare AND-ed term with no indication. The tooltip is translated but correctly leaves the keyword in English (fr.json:679 renders 'et or pour des alternatives'), so the user IS told — but only if they open the tooltip." — evidence: JooqFTSHelper.java:57, :292 + odd-platform-ui/src/locales/translations/fr.json:679 — severity: LOW
- "`ftsRankField` uses the two-argument `ts_rank(vector, tsquery)` form — no weights array and no normalization argument (:174). Relevance ordering therefore takes whatever the server-side defaults are, and a deployment cannot tune it; there is no comment recording that this was considered." — evidence: JooqFTSHelper.java:172-175 — severity: LOW
- "A `-` followed by nothing but whitespace `break`s out of the scan (:268-270), abandoning any input after it. Unreachable today because `QUERY_OPERATORS` requires a non-space after the dash (:55), so a query ending in a bare dash never enters the scanner — but the two guards must stay in agreement, and nothing enforces that." — evidence: JooqFTSHelper.java:55, :260-273 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "JooqFTSHelper.java:61"
      name: "MAX_OPERATOR_LEAVES"
      value: "64"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "N=0 means QUERY_OPERATORS never matched, so operatorGroups returns null at :246-248 and tsQueryExpression takes the untouched prefixTsQuery path at :199-201 — the byte-identical pre-#1840 expression. N=1 is a single phrase / negation / or-token; the normal compositional path."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:198-201, :246-248 + JooqFTSHelperTest.java:130-135"
        - q: "What at N = 64? At N = 65? At N = 6400?"
          a: "At 64 the test `operatorLeaves > MAX_OPERATOR_LEAVES` (:313) is false, so the groups are returned and the operators apply. At 65 and at 6400 it returns List.of(), the loop at :203 never runs, expression stays null, and :222 yields CAST('' AS tsquery) — matches nothing. Pinned at both sides by JooqFTSHelperTest.java:190-203."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:203-222, :309-313 + JooqFTSHelperTest.java:190-203"
        - q: "What at null / a query the counter mis-attributes?"
          a: "null short-circuits at :246 to the prefix path, and tsQuery(null) returns \"\" (:338-339) -> to_tsquery(''). The mis-attribution case is real: the `or` token increments operatorLeaves at :297 while contributing no leaf, so ~33 `or`-ed alternatives consume the whole 64 budget."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:246, :292-298, :338-339"
        - q: "What does the operator see at each boundary?"
          a: "PROBE-NEEDED. Static reading says HTTP 200 with items == [] and total == 0, no header, no log (there is no log statement anywhere in :309-313). Whether the surface really is indistinguishable from 'no matches', and whether the `or`-token arithmetic shows up at ~33 alternatives, is measured by P-392."
          confidence: PROBE-NEEDED
          evidence: "P-392"
    - location: "JooqFTSHelper.java:49"
      name: "TSQUERY_SPECIAL_CHARS"
      value: "[!&'()*:<>|\\\\]"
      questions:
        - q: "Which characters does it strip, and which conspicuous ones does it NOT?"
          a: "Strips ! & ' ( ) * : < > | and backslash. Does NOT strip `\"` or `-` — deliberately, since #1840 promotes both to operators handled before this sanitiser is reached (:274-285, :260-273). Also does not strip `?`, `{`, `}`, which are not tsquery syntax."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:44-49, :260-285 + JooqFTSHelperTest.java:29-51"
        - q: "What at an all-metacharacter query? At an empty/blank query?"
          a: "Every token is emptied, filtered at :342, and the join yields \"\" -> to_tsquery('') — accepted by Postgres and matching nothing, never 42601. Pinned at JooqFTSHelperTest.java:46-49."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:337-345 + JooqFTSHelperTest.java:46-49, :60-64"
        - q: "What does the operator see?"
          a: "'No matches found' for a metacharacter-only query; for a mixed query the metacharacters act as word separators (`user(id)` searches `user` AND `id`). This is the behaviour the live doc page documents verbatim."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:341-344 + JooqFTSHelperTest.java:39-41 + live page excerpt (WebFetch 2026-08-30)"
    - location: "JooqFTSHelper.java:54-55"
      name: "QUERY_OPERATORS"
      value: "\"|(?:^|\\\\s)-\\\\s*\\\\S|(?:^|\\\\s)(?i:or)(?=\\\\s|$)"
      questions:
        - q: "What decides operator-vs-plain, and what are the near-miss cases?"
          a: "Any double quote anywhere; a `-` at a token boundary with a non-space after it; the whole token `or` (case-insensitive, bounded by the `(?:^|\\s)` prefix and the `(?=\\s|$)` lookahead). Near-misses that stay on the plain path: my-table, e-mail, 2024-01-01, foo--bar, a trailing dash, oracle, ORdering, sales_or_ops."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:51-55 + JooqFTSHelperTest.java:83-110"
        - q: "What at a single stray quote? At `-` alone?"
          a: "A single `\"` makes the query an operator query; the scanner's unterminated-quote branch takes the rest of the input as the phrase (:275-279). `-` alone does NOT match (no non-space follows), so it takes the plain path and reaches to_tsquery as the token `-:*`; the integration poison list asserts that returns a page rather than 500."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:55, :274-285 + JooqFTSHelperTest.java:161-163 + AssetSearchServiceIntegrationTest.java:416-427"
        - q: "What does the operator see when the classification flips?"
          a: "The same input string means two different things depending on one character: `Q3-2024` searches for the single prefix term, `Q3 - 2024` EXCLUDES 2024. Both return a page; neither reports which reading was used."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:55, :260-273"
    - location: "JooqFTSHelper.java:57"
      name: "OR_OPERATOR"
      value: "\"or\""
      questions:
        - q: "Is the keyword localised?"
          a: "No. It is the English literal, compared case-insensitively at :292. The seven shipped locales all carry the syntax-hint key, and the French value deliberately leaves the keyword untranslated ('et or pour des alternatives'), which is the correct handling — the user is told to type `or`."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:57, :292 + odd-platform-ui/src/locales/translations/fr.json:679 + SearchSyntaxHint.tsx:21-23"
        - q: "What at `-or`? At `or` alone? At `or or`?"
          a: "`-or` matches QUERY_OPERATORS via the `-` branch, and line :292 requires `!negated`, so it becomes `!! plainto_tsquery('or')` — a negation of a stop word. `or` alone produces two empty groups, conjoin returns null for each, and :222 yields CAST('' AS tsquery) (pinned at JooqFTSHelperTest.java:185-187). `or or` is in the integration poison list."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:292-302, :221-222 + JooqFTSHelperTest.java:185-187 + AssetSearchServiceIntegrationTest.java:417"
        - q: "What does the operator see?"
          a: "A query that is only operators returns an empty page rather than an error — the explicit design at :221 ('Every branch was empty ... match nothing, never 500')."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:221-222"
  name_behavior_pairs:
    - name: "tsQueryExpression(String)"
      promise: "Produce the SQL expression for the tsquery a user's search string means."
      implementation: "Detects operator usage (:246), takes the untouched prefix path when absent (:200), otherwise conjoins each group's leaves with `&&` (:225-233), wraps each OR-branch in the querytree guard (:214-216), joins branches with `||` (:219), and falls back to the empty tsquery when nothing survives (:222)."
      drift: NONE
      operator_visible_consequence: "n/a"
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:197-223 + JooqFTSHelperTest.java:112-203"
    - name: "tsQuery(String)"
      promise: "Return a tsquery for the given plain query."
      implementation: "Returns the STRING ARGUMENT for to_tsquery — metacharacters replaced by spaces, each surviving token suffixed with `:*`, joined by `&`. It is not a tsquery value, and since #1840 it is only HALF the grammar: it knows nothing about quotes, `-` or `or`."
      drift: MINOR
      operator_visible_consequence: "No user-visible effect today (no production caller other than :330). The hazard is forward-looking: a future caller that picks the shorter, more obviously-named method silently gets the pre-#1840 semantics in which `-term` is REQUIRED, not excluded."
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:329-331, :337-345 + grep -rn 'tsQuery(' <odd-platform-repo>/odd-platform-api/src/main/java (only :330 and :337)"
    - name: "operatorGroups(String)"
      promise: "Tokenise a query into OR-separated groups of AND-ed leaves."
      implementation: "Does exactly that, but overloads its return channel with three meanings: null = 'no operator, take the plain path', List.of() = 'over the cap, fail closed', and a non-empty list = the groups. The distinction between the two empty-ish returns is load-bearing and documented in the code (:311-312: 'NO groups (rather than one empty group) so the caller yields the bare empty tsquery instead of guarding a constant')."
      drift: MINOR
      operator_visible_consequence: "None today; the caller at :198-201 handles both. A refactor that normalised null to an empty list would silently turn every plain query into a no-match."
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:235-244, :246-248, :309-313 + :198-201"
    - name: "ftsCondition(Field, String)"
      promise: "The condition that the vector matches the query."
      implementation: "`{0} @@ {1}` with the vector field and tsQueryExpression(plainQuery)."
      drift: NONE
      operator_visible_consequence: "n/a"
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:120-123"
    - name: "ftsRankField(Field, String)"
      promise: "The relevance rank of the row for this query."
      implementation: "`ts_rank({0}, {1})` — the two-argument form, no weights array, no normalization flag, and no ordering of its own. The ORDER BY that turns this into visible ranking lives in each caller."
      drift: NONE
      operator_visible_consequence: "n/a — but see orderings below: the callers supply no tie-breaker."
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:172-175"
    - name: "facetStateConditions(FacetStateDto, Map, List)"
      promise: "The conditions expressing the caller's facet selection."
      implementation: "Maps each non-ignored facet entry through the supplied function map and DROPS any entry whose FacetType is absent from that map (compileFacetCondition returns null at :351-352, filtered at :138). With an empty map every selection is discarded."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Query-example and lookup-table search pass Map.of() (FTSConstants.java:126-127), so any facet supplied on those two surfaces is silently ignored — the caller gets unfiltered results and no error."
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:125-140, :347-355 + FTSConstants.java:126-127 + ReactiveQueryExampleRepositoryImpl.java:79, :98 + ReactiveLookupTableRepositoryImpl.java:115, :133"
    - name: "resultFacetStateConditions(FacetStateDto)"
      promise: "The facet conditions for a result query, split into CTE-level and join-level."
      implementation: "Splits on a hardcoded four-member predicate (DATA_SOURCES / ENTITY_CLASSES / TYPES / STATUSES to the CTE, everything else to the join), appends the EXCLUDE_FROM_SEARCH visibility filter to the CTE side, and — undocumented — omits the ENTITY_CLASSES condition entirely when state.isMyObjects() is true."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "On the legacy session-search path, a My-Objects search combined with an entity-class narrowing returns rows of every class; the caller adds no replacement predicate (ReactiveDataEntityRepositoryImpl.java:657-672)."
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:142-170 (:157-162 the drop, :167 the visibility filter) + ReactiveDataEntityRepositoryImpl.java:653-672"
    - name: "buildVectorUpsert(...)"
      promise: "Build the upsert that writes the search vector."
      implementation: "Builds `WITH t AS (select) INSERT INTO <vectorTable>(idField, target) SELECT id, <concat of setweight(to_tsvector(field))> FROM t [GROUP BY id] ON CONFLICT DO UPDATE SET target = excluded.target`. Returns the statement; executes nothing."
      drift: NONE
      operator_visible_consequence: "n/a"
      confidence: STATIC-INFERRED
      evidence: "JooqFTSHelper.java:86-118, :357-370, :398-400"
  orderings:
    - location: "JooqFTSHelper.java:172-175 (ftsRankField — the sort key this node produces)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "This node emits no ORDER BY. It emits `ts_rank(vector, tsquery)`; each caller decides. Verified callers: ReactiveDataEntityRepositoryImpl.java:499 (.orderBy(RANK_FIELD_ALIAS.desc())), ReactiveAssetSearchRepositoryImpl.java:369 (order.add(ftsRankField(...).desc())), and the term / query-example / lookup-table suggestion queries at ReactiveTermRepositoryImpl.java:254, ReactiveQueryExampleSearchEntrypointRepositoryImpl.java:101, ReactiveLookupTableRepositoryImpl.java:137."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:172-175 + ReactiveDataEntityRepositoryImpl.java:491-500 + ReactiveAssetSearchRepositoryImpl.java:368-369"
        - q: "What is the tie-breaker when ranks are equal?"
          a: "None at the autocomplete call site: ReactiveDataEntityRepositoryImpl.java:499-500 orders by rank descending and takes SUGGESTION_LIMIT = 5 (:93) with no secondary key, so among equally-ranked rows the five returned are database-implementation-defined and may differ between identical calls."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityRepositoryImpl.java:93, :499-500"
        - q: "Which subset is returned when the result set exceeds the page size?"
          a: "REFERENCE — the LIMIT/OFFSET and cursor machinery belong to the callers (ReactiveAssetSearchRepositoryImpl.java:89 records that ts_rank is not seekable, so relevance stays OFFSET-paged and depth-capped)."
          confidence: REFERENCE
          evidence: "odd-platform java repository reactive repository:ReactiveAssetSearchRepositoryImpl"
        - q: "Does any layer above re-sort or filter the result?"
          a: "REFERENCE — the sort selection (RELEVANCE / STATUS_PRIORITY / UPDATED_AT / NAME, with a per-context default) is resolved above this node, per the SearchFormData.sort contract at odd-platform-specification/components.yaml:2463-2470."
          confidence: REFERENCE
          evidence: "odd-platform java service:AssetSearchServiceImpl"
    - location: "JooqFTSHelper.java:109-111, :368-369 (the aggregation branch of buildVectorUpsert)"
      questions:
        - q: "What is the actual aggregation at the lowest layer?"
          a: "When agg is true the SELECT is wrapped in GROUP BY <cte id> (:109-111) and the vector expression becomes tsvector_agg(<setweight chain>) (:369) — the custom aggregate created in V0_0_14__normalize_fts_process.sql:21. Multiple source rows for one entity collapse into one tsvector."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:100-111, :357-370 + V0_0_14__normalize_fts_process.sql:21"
        - q: "What is the tie-breaker / ordering within the aggregate?"
          a: "None — the aggregate carries no ORDER BY and this node makes no ordering claim about the resulting tsvector."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:368-369"
        - q: "Which subset is aggregated when the source select is large?"
          a: "All of it — there is no LIMIT anywhere in buildVectorUpsert; the caller's Select defines the scope."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:86-118"
        - q: "Does any layer above re-sort or filter?"
          a: "REFERENCE — the per-column scoping (which rows feed each vector) is each entrypoint repository's decision."
          confidence: REFERENCE
          evidence: "odd-platform java repository reactive repository:ReactiveSearchEntrypointRepositoryImpl"
  auth_gates:
    - location: "JooqFTSHelper.java:167"
      endpoint: "n/a — no endpoint in this file; the single access-shaped predicate it compiles"
      questions:
        - q: "What does this return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Identical in all four. Nothing in this file reads auth.type, the security context, or the current user; the whole file was read (lines 1-401) and contains no security import and no authorization annotation. The predicate at :167 excludes rows flagged EXCLUDE_FROM_SEARCH regardless of who is asking."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:1-38 (import block), :39-42 (annotations), :167"
        - q: "What does an unauthenticated caller see?"
          a: "REFERENCE — reachability is decided by the controllers. Under auth.type=DISABLED the search endpoints are anonymous, and this node applies no compensating scope."
          confidence: REFERENCE
          evidence: "odd-platform java AssetSearchController controller-class:AssetSearchController"
        - q: "What does a wrong-role caller see?"
          a: "The same rows. This node compiles no permission, role or owner predicate; ODD's read-collaborative posture means catalog reads are not permission-gated."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:142-170 (only EXCLUDE_FROM_SEARCH; no OWNER / permission condition)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Not here. Read-time eligibility beyond EXCLUDE_FROM_SEARCH (hollow, DELETED status, soft-deleted terms and query examples) is assembled by the callers — e.g. ReactiveAssetSearchRepositoryImpl.java:273-284."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:167 + ReactiveAssetSearchRepositoryImpl.java:273-284"
  resource_boundaries:
    - location: "JooqFTSHelper.java:117, :398-400"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No lost update is possible by construction: ON CONFLICT DO UPDATE SET target = excluded.target replaces the whole column with a value recomputed from current row state — there is no read-modify-write, so concurrent refreshes converge on last-writer-wins, and the loser's value was computed from the same table."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:113-117, :398-400"
        - q: "Is the call replay-safe?"
          a: "Yes. Re-running the same upsert writes the same column value; no counters, no appends, no row multiplication (the INSERT ... SELECT is keyed on the vector table's id field, :115)."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:113-117"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache in this file — no @Cacheable, no map, no memoisation (whole file read). Any staleness is the interval between a source-row write and the caller's vector refresh, which this node does not schedule."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:1-401"
    - location: "JooqFTSHelper.java:39-61, :249-253"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No. The @Component is a stateless singleton: every field is a private static final immutable (a compiled Pattern, a String, an int), and all working state (StringBuilder, ArrayList, the leaf counter) is method-local to operatorGroups."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:39-61, :249-253"
        - q: "Is the call replay-safe?"
          a: "Yes — every public method is a pure function of its arguments; nothing is executed, only built."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:63-345"
        - q: "If a cache fronts this, what is the TTL?"
          a: "n/a — no cache."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:1-401"
    - location: "JooqFTSHelper.java:214-216"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "n/a — read path, no state. The resource question here is COST: the guard exists to keep a non-indexable branch from becoming a sequential scan of the entire search index, which under concurrency would be the platform's worst-case query."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:208-216"
        - q: "Is the call replay-safe?"
          a: "Yes — deterministic SQL generation."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:214-219"
        - q: "Does the guard actually deliver the index scan it exists for?"
          a: "PROBE-NEEDED. No test evaluates querytree() or inspects a plan; the claim rests on a comment recording a measurement on postgres:13.2-alpine. P-393 pins querytree()='T' for the negation-only and stop-word+negation shapes and EXPLAINs the guarded vs unguarded plans."
          confidence: PROBE-NEEDED
          evidence: "P-393"
  request_inputs:
    - location: "JooqFTSHelper.java:121, :173, :197, :245, :329, :337"
      input_kind: local-variable
      input_name: "plainQuery"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "That the argument is a PLAIN, uninterpreted search string — words to be looked up, with no syntax of its own."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:197"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced end-to-end. UI: MainSearchInput.tsx:44-49 writes the raw string to the `q` URL param unmodified -> Search page -> AssetSearchFormData.query -> AssetSearchController.java:26-31 -> AssetSearchService.searchAssets -> ReactiveAssetSearchRepositoryImpl.java:265 ftsCondition -> JooqFTSHelper.java:122 -> tsQueryExpression(:197) -> QUERY_OPERATORS scan (:246) and, when it matches, the single-pass tokeniser at :255-306 which INTERPRETS `\"`, `-` and `or` as syntax. No sanitisation happens client-side."
          confidence: STATIC-INFERRED
          evidence: "MainSearchInput.tsx:44-49 + AssetSearchController.java:26-31 + ReactiveAssetSearchRepositoryImpl.java:265 + JooqFTSHelper.java:122, :197, :246, :255-306"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY. The name is now stale — the string is parsed, not plain — but the translation is documented in the method's own Javadoc, in the OpenAPI contract the caller reads (odd-platform-specification/components.yaml:2450-2460 describes all three operators), and in the UI affordance next to the box (SearchSyntaxHint.tsx:16-29). The parameter name is the only place the old assumption survives."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:177-196 + odd-platform-specification/components.yaml:2450-2460 + SearchSyntaxHint.tsx:16-29"
        - q: "What does a caller see when their assumption is wrong?"
          a: "A user pasting a literal asset name that contains ` or ` gets OR semantics (two branches) instead of the exact name; a name containing ` - ` loses the following word to a negation. Both return a plausible, wrong result set with no signal. The near-miss cases the regex deliberately excludes (my-table, e-mail, 2024-01-01, oracle, sales_or_ops) are the common ones and are safe."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:51-55, :260-273, :292-298 + JooqFTSHelperTest.java:83-110"
        - q: "Is there a field/variable that DOES match the name and is NOT used? (available-but-unused)"
          a: "Yes — `tsQuery(String)` at :337 is precisely the 'treat the whole string as plain words' implementation, still public, still reachable, and no longer the one `tsQueryExpression` uses for an operator query. It is the closer-aligned method a future caller could pick by mistake."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:329-331, :337-345"
      routes_to_finding: "bugs_limitations_corner_cases[4] (the `or`-in-a-name case) AND bugs_limitations_corner_cases[3] (the still-public tsQuery)"
    - location: "JooqFTSHelper.java:142, :158"
      input_kind: body-field
      input_name: "state.isMyObjects()  (SearchFormData.my_objects)"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Restrict the result set to objects belonging to me."
          confidence: STATIC-INFERRED
          evidence: "odd-platform-specification/components.yaml:2461-2462 + JooqFTSHelper.java:158"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Inside this node it does NOT narrow anything — it removes the ENTITY_CLASSES facet condition from the CTE condition list (:157-162). The actual owner narrowing is added by the caller (ReactiveDataEntityRepositoryImpl.java:673-675 adds OWNER.ID.eq(owner.getId()) from a separate parameter)."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:155-165 + ReactiveDataEntityRepositoryImpl.java:657, :673-675"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The flag's only effect in this method is to DISABLE an unrelated facet, with no comment stating why."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:157-162"
        - q: "What does a caller see when their assumption is wrong?"
          a: "On the legacy session-search path, selecting My Objects together with an entity-class narrowing yields rows of every class — the class narrowing is silently inert. The UI treats the two as independently selectable (SearchResultsTabs.tsx:41-45)."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:157-162 + ReactiveDataEntityRepositoryImpl.java:653-672 + SearchResultsTabs.tsx:41-45"
        - q: "Is there a field that DOES match the name and is NOT used? (available-but-unused)"
          a: "Yes — the OWNER facet condition (FacetType.OWNERS -> OWNER.ID.in(...), FTSConstants.java:86) is the condition that expresses ownership, and it is routed to the JOIN list untouched by the myObjects branch. The flag is applied to the wrong facet."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:149-153 + FTSConstants.java:86"
      routes_to_finding: "bugs_limitations_corner_cases[6]"
    - location: "JooqFTSHelper.java:127, :133"
      input_kind: local-variable
      input_name: "facetTypeFunctionMap"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A mapping from facet type to the condition that facet produces — i.e. the caller's facet vocabulary."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:126-127"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "compileFacetCondition looks up the function and returns null when it is absent OR when the filter list is empty (:350-353); nulls are filtered out at :138. Absent-from-map and no-selection are indistinguishable."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:135-139, :347-355"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. A caller supplying a facet whose type the map does not carry receives no condition and no error; with FTSConstants' two empty maps that is EVERY facet on two search surfaces."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:347-355 + FTSConstants.java:126-127"
        - q: "What does a caller see when their assumption is wrong?"
          a: "Unfiltered results with an HTTP 200. Whether the query-example and lookup-table UIs expose facets — and therefore whether a user can reach this — is a question for those UI sidecars."
          confidence: REFERENCE
          evidence: "odd-platform ts react-component:QueryExampleSearch / LookupTables"
        - q: "Is there a field that DOES match the name and is NOT used?"
          a: "NONE — there is no fallback map, no default function, and no 'unsupported facet' channel anywhere in the file."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:347-355"
      routes_to_finding: "bugs_limitations_corner_cases[5]"
    - location: "JooqFTSHelper.java:134"
      input_kind: local-variable
      input_name: "ignoredFacets"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Facet types the caller wants excluded from the compiled conditions."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:131-136"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "A contains() check on the facet key at :136, before compilation. Exactly the promise."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:135-136"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. One production caller passes a non-empty list — ReactiveDataEntityRepositoryImpl.java:444 ignores ENTITY_CLASSES for the count query."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:131-139 + ReactiveDataEntityRepositoryImpl.java:444"
        - q: "What does a caller see when their assumption is wrong?"
          a: "n/a — no drift."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:135-136"
        - q: "Is there a field that DOES match the name and is NOT used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:131-139"
      routes_to_finding: "n/a"
    - location: "JooqFTSHelper.java:80, :92"
      input_kind: local-variable
      input_name: "agg"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "That the vector is aggregated across the source rows."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:80, :92"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Two coupled effects: it adds GROUP BY <cte id> to the insert select (:109-111) AND wraps the setweight chain in tsvector_agg (:369). Both are driven by the one flag, so they cannot desynchronise."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:100, :109-111, :357-369"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:109-111, :369"
        - q: "What does a caller see when their assumption is wrong?"
          a: "Passing false where multiple source rows exist would emit one INSERT row per source row and let ON CONFLICT DO UPDATE keep only the last — a silently truncated vector. Nothing in this node detects the mismatch; correctness rests entirely on each caller's choice."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:105-117"
        - q: "Is there a field that DOES match the name and is NOT used?"
          a: "NONE — there is no cardinality check on the caller's select."
          confidence: STATIC-INFERRED
          evidence: "JooqFTSHelper.java:86-118"
      routes_to_finding: "n/a"
  probes_emitted:
    - probe_id: P-392
      question: "What does the operator SEE when a query trips the 64-leaf cap — and does the `or` token really halve the effective budget?"
      probe_path: "lineage/odd-platform/probes/P-392.yaml"
    - probe_id: P-393
      question: "Does the per-OR-branch querytree() guard actually produce the index scan its comment claims, on the Postgres the platform ships against?"
      probe_path: "lineage/odd-platform/probes/P-393.yaml"
  stress_summary:
    triggers_total: 23           # 4 tunables + 8 name-behavior pairs + 2 orderings + 1 auth gate + 3 resource boundaries + 5 request inputs
    questions_total: 67          # each explicit q/a item, plus each name_behavior_pair entry (its own promise/implementation/drift triple)
    answers_static_inferred: 60
    answers_probe_needed: 2
    answers_reference: 5
    drift_flags: 4               # name_behavior_pairs with drift != NONE: tsQuery, operatorGroups (MINOR); facetStateConditions, resultFacetStateConditions (DRIFT_NAME_VS_BEHAVIOR)
    request_input_drift_flags: 3 # plainQuery (MINOR), my_objects + facetTypeFunctionMap (DRIFT_INPUT_NAME_VS_IMPLEMENTATION)
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY`. The file contains no security import, no
  `@PreAuthorize`, no `SecurityContext` read, and no branch on `auth.type` (whole
  file read, lines 1-401; the import block is :1-37 and the only class annotations
  are `@Component @RequiredArgsConstructor @Slf4j` at :39-41). Its behaviour is
  identical under DISABLED / LOGIN_FORM / OAUTH2 / LDAP. It is nevertheless
  reachable anonymously under `auth.type=DISABLED` through the search controllers,
  which apply the auth decision.
- **ingestion_filter_relevance**: `PARTIAL — the WRITE half is on the ingestion path`.
  `buildVectorUpsert` is reached from `POST /ingestion/entities` via
  `FTSVectorsIngestionRequestProcessor` (service/ingestion/processor/FTSVectorsIngestionRequestProcessor.java:8, :15),
  which holds `ReactiveSearchEntrypointRepository`. The READ half
  (`tsQueryExpression` / `ftsCondition` / `ftsRankField`) is UI/API surface only and
  is not gated by `auth.ingestion.filter.enabled`.
- **authorization_assertions**: `[]` — no permission, role or policy gate is compiled
  by this file. The one access-shaped predicate it emits is a content flag, not an
  authorization decision: `DATA_ENTITY.EXCLUDE_FROM_SEARCH.isNull().or(...isFalse())`
  — evidence: JooqFTSHelper.java:167.
- **owner_scoping**: `N/A — this node is not data-scoped`. `resultFacetStateConditions`
  routes the OWNERS facet into the join-condition list unchanged
  (JooqFTSHelper.java:149-153 + FTSConstants.java:86) but applies no
  current-user predicate of its own; the owner narrowing for My-Objects is added by
  the caller (ReactiveDataEntityRepositoryImpl.java:673-675). Consistent with ODD's
  read-collaborative posture — catalog reads are not permission-gated.
- **data_exposure**:
  - "The compiled tsquery and rank expression are applied to whatever vector table the caller names; this node adds no owner, namespace or tenant predicate — evidence: JooqFTSHelper.java:120-123, :172-175"
  - "User-supplied query text reaches Postgres exclusively as bind values (`DSL.val` at :301, :325, :330); it is never concatenated into SQL text — evidence: JooqFTSHelper.java:301, :325, :330 + JooqFTSHelperTest.java:205-213"
  - "The WARN at :382 / :389 logs a jOOQ `Field` reference (a column identifier), not row data — no user content is written to the log by this file"
- **known_security_gaps**:
  - "The tsquery-syntax attack surface that produced #1756 is closed structurally rather than by validation: `to_tsquery` — the only constructor that parses tsquery syntax — is reached exclusively through the `tsQuery` sanitiser, and the two operator constructors (`phraseto_tsquery`, `plainto_tsquery`) parse plain text and cannot raise on metacharacters. The residual risk is that a future leaf type is added without that property; nothing enforces it mechanically." — evidence: JooqFTSHelper.java:192-195, :301, :325, :330 — severity: LOW
  - "The fail-closed path at :309-313 is the security-relevant branch (it prevents an adversarial query from growing the generated SQL without bound) and it is silent — there is no log, metric or response signal that a query was refused, so an operator cannot distinguish abuse from ordinary empty results." — evidence: JooqFTSHelper.java:309-313 — severity: LOW
  - "`concatVectorFields` builds its expression with `String.format` (:365, :369) rather than binds. The interpolated values are jOOQ `Field` names and a weight letter from the compile-time `FTSConstants` maps, never user input — but the pattern is one refactor away from being unsafe if a caller-supplied name ever reaches `vectorFields`." — evidence: JooqFTSHelper.java:357-370 + FTSConstants.java:37-77 — severity: LOW

## performance

- **hot_paths**:
  - "`tsQueryExpression` runs on EVERY full-text search request across every surface — 27 read-side call sites in 7 repository classes, including the autocomplete suggestions fired per keystroke (ReactiveDataEntityRepositoryImpl.java:480, ReactiveTermRepositoryImpl.java:264)" — evidence: JooqFTSHelper.java:197 + `grep -rn 'jooqFTSHelper\.\(ftsCondition\|ftsRankField\|tsQueryExpression\)' <odd-platform-repo>/odd-platform-api/src/main/java` (27 hits)
  - "The compilation itself is a single left-to-right pass over the query string with no backtracking beyond the quote lookahead — O(len(query)), negligible against the SQL round-trip" — evidence: JooqFTSHelper.java:255-306
  - "`buildVectorUpsert` runs on every ingestion batch and on every metadata edit that touches an indexed field (26 call sites in 4 entrypoint repositories)" — evidence: JooqFTSHelper.java:86-118 + FTSVectorsIngestionRequestProcessor.java:15
- **throughput_characteristics**:
  - "Pure SQL construction — no I/O, no blocking, no reactive operator; safe to call from a reactive chain"
  - "One tsquery expression is built per call site, so a request that both filters and ranks (e.g. ReactiveDataEntityRepositoryImpl.java:480 + :491) compiles the same query twice and emits two independent copies of the expression into the SQL"
- **resource_allocation**:
  - "The generated SQL grows with the number of operator leaves: each leaf contributes one constructor call plus one bind, and each OR-branch contributes a duplicated `CASE WHEN querytree({0}) = 'T' … ELSE {1} END` in which the branch expression appears TWICE (:214-216) — so a 64-leaf query renders the leaf set roughly twice over" — evidence: JooqFTSHelper.java:214-216, :309-313
  - "`operatorGroups` allocates one ArrayList per OR-group and one StringBuilder per group; bounded by the leaf cap" — evidence: JooqFTSHelper.java:249-253, :294-296
- **scaling_characteristics**:
  - "Stateless singleton — scales horizontally with the application; no lock, no shared mutable state" — evidence: JooqFTSHelper.java:39-42, :249-253
  - "The per-branch `querytree()` guard is the mechanism that keeps a negation-only branch from becoming a sequential scan of the whole search index; it is the single most load-bearing performance construct in the file and is unverified by any test" — evidence: JooqFTSHelper.java:208-216 — probe: P-393
  - "No pagination or LIMIT is imposed here; result-set size is entirely the callers' concern" — evidence: JooqFTSHelper.java:63-345
- **known_performance_gaps**:
  - "The `CASE WHEN querytree(X) = 'T' THEN … ELSE X END` construction renders the branch expression twice in the emitted SQL. Whether Postgres folds the two identical subexpressions is not established here — no plan was captured — so the measurable fact is only that the SQL text sent over the wire is larger for operator-heavy queries." — evidence: JooqFTSHelper.java:214-216 — severity: LOW
  - "`ts_rank` is called in its unnormalised two-argument form, so rank does not account for document length; a long description can outrank an exact short name. No knob exists to change this." — evidence: JooqFTSHelper.java:174 — severity: LOW
  - "The 64-leaf cap is roughly three orders of magnitude below the 65535 bind ceiling its comment cites as the rationale. The cap works as product-level conservatism, but the stated reason does not explain the chosen number, and no measurement is recorded alongside it." — evidence: JooqFTSHelper.java:59-61 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/search?q={query}"
  caller_node: "ts react-component:MainSearchInput.tsx"
  multiplicity_per_trigger: "1 tsQueryExpression per FTS predicate in the compiled query; ReactiveAssetSearchRepositoryImpl builds 2 per request (the WHERE at :265 and the relevance ORDER BY at :369) when sort=RELEVANCE"
  evidence: "MainSearchInput.tsx:44-49 (writes the raw query to the `q` param) -> Search.tsx:132 -> AssetSearchController.java:26-31 -> ReactiveAssetSearchRepositoryImpl.java:265, :369 -> JooqFTSHelper.java:122, :174"
  observation_class: ui-call
- entry_point: "rest:POST /api/assets/search"
  caller_node: "java repository:ReactiveAssetSearchRepositoryImpl"
  multiplicity_per_trigger: "2 (ftsCondition + ftsRankField) when a text query and relevance sort are both present; 1 otherwise; 0 for a blank query (guarded at ReactiveAssetSearchRepositoryImpl.java:264)"
  evidence: "ReactiveAssetSearchRepositoryImpl.java:264-266, :368-369"
  observation_class: rest-call
- entry_point: "ui_route:/search (autocomplete suggestions, per keystroke)"
  caller_node: "java repository:ReactiveDataEntityRepositoryImpl.getQuerySuggestions"
  multiplicity_per_trigger: "2 per suggestion request (ftsCondition at :480 + ftsRankField at :491); the request itself fires per keystroke from the suggestions autocomplete"
  evidence: "ReactiveDataEntityRepositoryImpl.java:472-500 + MainSearchInput.tsx:66-76 (SearchSuggestionsAutocomplete)"
  observation_class: ui-call
- entry_point: "rest:GET /api/search/{searchId}/results (legacy session search)"
  caller_node: "java repository:ReactiveDataEntityRepositoryImpl.findByState"
  multiplicity_per_trigger: "1 resultFacetStateConditions + (1 ftsCondition + 1 ftsRankField inside the CTE when the session carries a query)"
  evidence: "SearchController.java:50-55 -> DataEntityServiceImpl.java:182-190 -> ReactiveDataEntityRepositoryImpl.java:657, :919, :924"
  observation_class: rest-call
- entry_point: "rest:GET /api/search/{searchId}/facets (sidebar facet counts)"
  caller_node: "java repository:ReactiveSearchFacetRepositoryImpl"
  multiplicity_per_trigger: "up to 6 ftsCondition calls per facet-count request — one per facet aggregation query"
  evidence: "ReactiveSearchFacetRepositoryImpl.java:120, :148, :185, :270, :472, :662"
  observation_class: rest-call
- entry_point: "rest:GET /api/dataentities/{id} (result highlighting)"
  caller_node: "java repository:ReactiveDataEntityRepositoryImpl.getHighlightedResult"
  multiplicity_per_trigger: "1 tsQueryExpression per highlighted field"
  evidence: "ReactiveDataEntityRepositoryImpl.java:790-804 (ts_headline over jooqFTSHelper.tsQueryExpression(query))"
  observation_class: rest-call
- entry_point: "rest:POST /ingestion/entities (index write path)"
  caller_node: "java repository:ReactiveSearchEntrypointRepositoryImpl"
  multiplicity_per_trigger: "14 buildVectorUpsert call sites in that class alone; the number executed per ingestion batch depends on which vectors the payload dirties"
  evidence: "FTSVectorsIngestionRequestProcessor.java:8, :15 + ReactiveSearchEntrypointRepositoryImpl.java:93, :121, :153, :184, :246, :276, :303, :332, :392, :427, :461, :521, :559, :607"
  observation_class: rest-call
- entry_point: "unresolved (metadata-edit fan-out: term / tag / namespace / owner / datasource edits)"
  caller_node: "java repository:ReactiveTermSearchEntrypointRepositoryImpl (7 sites), ReactiveQueryExampleSearchEntrypointRepositoryImpl (2), ReactiveLookupTableSearchEntrypointRepositoryImpl (3)"
  multiplicity_per_trigger: unresolved
  unresolved: true
  evidence: "ReactiveTermSearchEntrypointRepositoryImpl.java:51, :75, :99, :124, :157, :197, :239 + ReactiveQueryExampleSearchEntrypointRepositoryImpl.java:50, :79 + ReactiveLookupTableSearchEntrypointRepositoryImpl.java:50, :74, :99; the service-tier fan-out (TermServiceImpl.java:115, TagServiceImpl.java:53, NamespaceServiceImpl.java:69, DataSourceServiceImpl.java:77, LookupDataServiceImpl.java:45, QueryExampleServiceImpl.java:46) was located but not walked"
  observation_class: rest-call
- entry_point: "unresolved (Dictionary / query-example / lookup-table search + suggestions)"
  caller_node: "java repository:ReactiveTermRepositoryImpl (5 read sites), ReactiveQueryExampleRepositoryImpl (3), ReactiveLookupTableRepositoryImpl (3), ReactiveQueryExampleSearchEntrypointRepositoryImpl (2)"
  multiplicity_per_trigger: unresolved
  unresolved: true
  evidence: "ReactiveTermRepositoryImpl.java:254, :264, :291, :297, :383 + ReactiveQueryExampleRepositoryImpl.java:84, :103, :109 + ReactiveLookupTableRepositoryImpl.java:119, :137, :143 + ReactiveQueryExampleSearchEntrypointRepositoryImpl.java:101, :109"
  observation_class: rest-call

Call-site census (reproducible):
`grep -rn 'jooqFTSHelper\.' <odd-platform-repo>/odd-platform-api/src/main/java` returns
62 call sites across 10 repository implementation classes — 27 read-side
(`ftsCondition` / `ftsRankField` / `tsQueryExpression`, 7 classes), 26 write-side
(`buildVectorUpsert`, 4 classes) and 9 facet-side (`facetStateConditions` /
`resultFacetStateConditions`, 5 classes).

## downstream_side_effects

- side_effect_class: log-emit
  description: "Emits a WARN naming a vector field that has neither an FTS weight nor a remapping, and then drops that field from the search vector. This is the only side effect this node performs directly — everything else it returns for a caller to execute."
  evidence: "JooqFTSHelper.java:382, :389 (log.warn) + :364 (the .filter(Objects::nonNull) that drops the field)"
  cardinality_per_call: "0..N per buildVectorUpsert call — one per unweighted, unremapped field"
  reachable_from_entry_points:
    - "rest:POST /ingestion/entities"
    - "unresolved (metadata-edit fan-out)"
- side_effect_class: db-write
  description: "REFERENCE — the `INSERT … ON CONFLICT DO UPDATE` that refreshes a `*_search_entrypoint` vector column. This node BUILDS the statement; a caller runs it."
  evidence: "JooqFTSHelper.java:113-117 (statement construction) + ReactiveSearchEntrypointRepositoryImpl.java:93 (a representative call site that receives the built Insert)"
  cardinality_per_call: "0 executed by this node; 1 row upserted per entity when the returned Insert is run"
  unresolved: true
  reachable_from_entry_points:
    - "rest:POST /ingestion/entities"
    - "unresolved (metadata-edit fan-out)"
- side_effect_class: page-render
  description: "REFERENCE — the search result set a user sees. Which rows appear, in what order, and whether an operator query narrows or voids the result is decided by the tsquery this node compiles, but the response is assembled by the service and controller."
  evidence: "JooqFTSHelper.java:120-123, :172-175 -> ReactiveAssetSearchRepositoryImpl.java:265, :369 -> AssetSearchController.java:26-32"
  cardinality_per_call: "1 result page per request"
  unresolved: true
  reachable_from_entry_points:
    - "ui_route:/search?q={query}"
    - "rest:POST /api/assets/search"
    - "rest:GET /api/search/{searchId}/results"
    - "ui_route:/search (autocomplete suggestions)"
- side_effect_class: page-render
  description: "REFERENCE — the `ts_headline` highlight markup on a result row (the 'why you see it' affordance). It is generated from the SAME tsquery that matched, so highlights cannot diverge from the match."
  evidence: "ReactiveDataEntityRepositoryImpl.java:790-804 + JooqFTSHelper.java:197"
  cardinality_per_call: "1 highlighted string per highlighted field"
  unresolved: true
  reachable_from_entry_points:
    - "rest:GET /api/dataentities/{id}"

## sources

- understanding ← JooqFTSHelper.java:39-42, :63-345, :177-196 + the call-site census above
- concepts.invariants.* ← JooqFTSHelper.java:94-96, :117, :122, :174, :197-233, :246-248, :274-285, :301, :316-331, :364, :379-400 + JooqFTSHelperTest.java:130-164, :205-213 + ReactiveDataEntityRepositoryImpl.java:799-801
- concepts.audiences ← MainSearchInput.tsx:60-79 + Search.tsx:132 + AssetSearchController.java:25-33 + SearchController.java:50-55 + FTSVectorsIngestionRequestProcessor.java:8, :15
- dependencies_semantic.requires-feature ← FTSConfig.java:46-50 + FTSConstants.java:79-118, :126-127 + JooqFTSHelper.java:28, :37, :68, :100, :115, :135-169
- dependencies_semantic.requires-runtime ← JooqFTSHelper.java:122, :174, :215, :301, :325, :330, :365-369 + V0_0_14__normalize_fts_process.sql:21 + V0_0_1__init.sql:235-236 + V0_0_35__add_terms.sql:75-76
- tests_coverage_semantic.covered_behaviours ← JooqFTSHelperTest.java:29-213 + AssetSearchServiceIntegrationTest.java:303-429 + ReactiveTermSearchTsQueryPoisonTest.java:28-70 + ReactiveDataEntityHighlightInjectionTest.java:32-71
- tests_coverage_semantic.uncovered_behaviours ← JooqFTSHelper.java:157-162, :292-302, :309-313, :362-369 + FTSConstants.java:126-127 + AssetSearchServiceIntegrationTest.java:416-419
- docs_link_semantic.declared_docs.[0] ← JooqFTSHelper.java:186-189 (in-source prose citation of docs/data-discovery/search.md) + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/search (2026-08-30, 200)
- docs_link_semantic.inferred_docs.[0] ← WebFetch of the same URL (no "Query syntax" heading among the eight returned) + documentation/.git/refs/remotes/origin/release/1.0.0 == 5b2bb04 + documentation/docs/data-discovery/search.md:93 (local checkout, still the pre-operator caveat)
- docs_link_semantic.doc_drift_findings.[0] ← live page excerpt (WebFetch 2026-08-30) vs JooqFTSHelper.java:49
- docs_link_semantic.doc_drift_findings.[1] ← live page excerpt vs JooqFTSHelper.java:49, :309-312
- docs_link_semantic.doc_drift_findings.[2] ← live "Technical details" excerpt vs JooqFTSHelper.java:44-61 + FTSConstants.java:34-134
- implicit_adrs.[0] ← JooqFTSHelper.java:183-190
- implicit_adrs.[1] ← JooqFTSHelper.java:177-181
- implicit_adrs.[2] ← JooqFTSHelper.java:208-213
- implicit_adrs.[3] ← JooqFTSHelper.java:309-313
- implicit_adrs.[4] ← JooqFTSHelper.java:192-195
- implicit_adrs.[5] ← JooqFTSHelper.java:318-321
- implicit_adrs.[6] ← JooqFTSHelper.java:241-243
- implicit_adrs.[7] ← JooqFTSHelper.java:325, :330, :365 + ReactiveDataEntityRepositoryImpl.java:796-798
- implicit_adrs.[8] ← JooqFTSHelper.java:51-55
- bugs_limitations_corner_cases.[0] ← JooqFTSHelper.java:292-298 vs :59-61
- bugs_limitations_corner_cases.[1] ← JooqFTSHelper.java:203-222, :309-313
- bugs_limitations_corner_cases.[2] ← JooqFTSHelper.java:208-216 + JooqFTSHelperTest.java:178-188
- bugs_limitations_corner_cases.[3] ← JooqFTSHelper.java:329-331, :337-345 + `grep -rn 'tsQuery(' <odd-platform-repo>/odd-platform-api/src/main/java`
- bugs_limitations_corner_cases.[4] ← JooqFTSHelper.java:54-55, :260-273, :292-298
- bugs_limitations_corner_cases.[5] ← JooqFTSHelper.java:125-140, :347-355 + FTSConstants.java:126-127 + ReactiveQueryExampleRepositoryImpl.java:79, :98 + ReactiveLookupTableRepositoryImpl.java:115, :133
- bugs_limitations_corner_cases.[6] ← JooqFTSHelper.java:155-165 + ReactiveDataEntityRepositoryImpl.java:653-672 + SearchResultsTabs.tsx:41-45
- bugs_limitations_corner_cases.[7] ← JooqFTSHelper.java:94-96, :362-366, :379-392
- bugs_limitations_corner_cases.[8] ← JooqFTSHelper.java:94-96, :362-369 + FTSConstants.java:37-77
- bugs_limitations_corner_cases.[9] ← JooqFTSHelper.java:57, :292 + odd-platform-ui/src/locales/translations/fr.json:679
- bugs_limitations_corner_cases.[10] ← JooqFTSHelper.java:172-175
- bugs_limitations_corner_cases.[11] ← JooqFTSHelper.java:55, :260-273
- stress_findings.tunables ← JooqFTSHelper.java:44-61, :198-201, :246-248, :292-298, :309-313, :337-345 + JooqFTSHelperTest.java:29-110, :190-203 + P-392
- stress_findings.name_behavior_pairs ← JooqFTSHelper.java:86-118, :120-123, :125-140, :142-175, :197-223, :235-248, :309-345 + FTSConstants.java:126-127 + ReactiveDataEntityRepositoryImpl.java:653-672
- stress_findings.orderings ← JooqFTSHelper.java:100-111, :172-175, :357-370 + ReactiveDataEntityRepositoryImpl.java:93, :491-500 + ReactiveAssetSearchRepositoryImpl.java:89, :368-369 + V0_0_14__normalize_fts_process.sql:21
- stress_findings.auth_gates ← JooqFTSHelper.java:1-38 (import block), :39-42, :142-170 + ReactiveAssetSearchRepositoryImpl.java:273-284
- stress_findings.resource_boundaries ← JooqFTSHelper.java:39-61, :113-117, :208-216, :249-253, :398-400 + P-393
- stress_findings.request_inputs ← JooqFTSHelper.java:80-92, :121-140, :155-165, :197, :245-345 + MainSearchInput.tsx:44-49 + AssetSearchController.java:26-31 + ReactiveAssetSearchRepositoryImpl.java:265 + ReactiveDataEntityRepositoryImpl.java:444, :657, :673-675 + FTSConstants.java:86, :126-127 + odd-platform-specification/components.yaml:2450-2462 + SearchSyntaxHint.tsx:16-29
- security.auth_mode_relevance ← JooqFTSHelper.java:1-38 (no security import), :39-42 (no authorization annotation)
- security.ingestion_filter_relevance ← FTSVectorsIngestionRequestProcessor.java:8, :15
- security.authorization_assertions / owner_scoping ← JooqFTSHelper.java:149-153, :167 + FTSConstants.java:86 + ReactiveDataEntityRepositoryImpl.java:673-675
- security.data_exposure ← JooqFTSHelper.java:120-123, :172-175, :301, :325, :330, :382, :389 + JooqFTSHelperTest.java:205-213
- security.known_security_gaps ← JooqFTSHelper.java:192-195, :309-313, :357-370 + FTSConstants.java:37-77
- performance.hot_paths ← JooqFTSHelper.java:197, :255-306, :86-118 + ReactiveDataEntityRepositoryImpl.java:480, :491 + ReactiveTermRepositoryImpl.java:264 + FTSVectorsIngestionRequestProcessor.java:15
- performance.resource_allocation ← JooqFTSHelper.java:214-216, :249-253, :294-296, :309-313
- performance.scaling_characteristics ← JooqFTSHelper.java:39-42, :63-345, :208-216
- performance.known_performance_gaps ← JooqFTSHelper.java:59-61, :174, :214-216
- upstream_callers.* ← MainSearchInput.tsx:44-49, :66-76 + Search.tsx:132 + AssetSearchController.java:26-31 + SearchController.java:50-55 + DataEntityServiceImpl.java:182-190 + ReactiveAssetSearchRepositoryImpl.java:264-266, :368-369 + ReactiveDataEntityRepositoryImpl.java:472-500, :657, :790-804, :919-924 + ReactiveSearchFacetRepositoryImpl.java:120, :148, :185, :270, :472, :662 + ReactiveSearchEntrypointRepositoryImpl.java (14 sites) + ReactiveTermSearchEntrypointRepositoryImpl.java (7 sites) + FTSVectorsIngestionRequestProcessor.java:8, :15
- downstream_side_effects.[0] ← JooqFTSHelper.java:364, :382, :389
- downstream_side_effects.[1] ← JooqFTSHelper.java:113-117 + ReactiveSearchEntrypointRepositoryImpl.java:93
- downstream_side_effects.[2] ← JooqFTSHelper.java:120-123, :172-175 + ReactiveAssetSearchRepositoryImpl.java:265, :369 + AssetSearchController.java:26-32
- downstream_side_effects.[3] ← ReactiveDataEntityRepositoryImpl.java:790-804 + JooqFTSHelper.java:197

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH — live page WebFetched this session (200); the release-train entry is LOW by construction (the train branch was confirmed to exist by ref SHA, but its content was not read — no Bash in this session, and the local documentation checkout is on an unrelated branch)
- implicit_adrs: HIGH — every entry carries an intent anchor quoted from the cited range, with the Javadoc-markup elision convention stated at the top of the section
- bugs_limitations_corner_cases: HIGH for the code-level statements; the user-reachability of entries [5] and [6] is explicitly scoped as belonging to the query-example / lookup-table UI and SearchController sidecars
- security: HIGH
- performance: MEDIUM — the two load-bearing performance claims (the guard's index scan, the cap's SQL-growth rationale) are comment-sourced and unmeasured; P-393 and P-392 exist to settle them
- upstream_callers: MEDIUM — the 62 call sites are enumerated by grep and the seven named entry points are traced, but two entries remain `unresolved: true` (the metadata-edit fan-out and the per-kind search/suggestion surfaces were located, not walked)
- downstream_side_effects: MEDIUM — only one direct side effect (the WARN) belongs to this node; the other three are REFERENCE entries awaiting the callers' sidecars
- stress_findings: HIGH — 60 of 67 answers are STATIC-INFERRED with file:line evidence; the 2 PROBE-NEEDED answers are the two plan/surface questions no static read can settle, and the 5 REFERENCE answers each name the sidecar that owns them

## Maintainer notes

<!-- Preserved across refreshes. The file-analyser never edits content under this heading. -->
