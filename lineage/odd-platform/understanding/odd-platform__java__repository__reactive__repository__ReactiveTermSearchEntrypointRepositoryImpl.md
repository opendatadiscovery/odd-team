---
node_id: "odd-platform java repository reactive repository:ReactiveTermSearchEntrypointRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-batch-U-01
related_features:
  - F-002          # P-06:F-001 Term-to-Entity Linkage (term lifecycle = vector refresh triggers)
  - F-001          # P-01:F-001 Search and Filtering (this repository feeds the term half of the FTS index used by search)
related_pillar_features:
  - "P-06:F-001"
  - "P-01:F-001"
back_links:
  refactoring_scopes:
    - REFACTOR-229   # FTS tsquery operator-injection family — Term FTS write path uses the SAME JooqFTSHelper that has the unescaped tsquery; this sidecar is the second WRITE-side surface adjacent to the DEFERRED ReactiveSearchEntrypointRepositoryImpl
  concepts:
    - tsquery-operator-injection-via-persisted-state
---

# ReactiveTermSearchEntrypointRepositoryImpl — semantic understanding

## understanding

ReactiveTermSearchEntrypointRepositoryImpl is the **term-side** counterpart of the
DataEntity-side FTS-vector write surface. It maintains the four `tsvector`
columns of `term_search_entrypoint` (`term_vector`, `tag_vector`,
`namespace_vector`, `owner_vector`) by issuing one `INSERT ... ON CONFLICT DO
UPDATE` per refresh event. The seven public methods each rebuild ONE vector
column for ONE term in response to a single event the service tier observes:
term created/updated, namespace renamed, term-to-namespace link mutated,
tag-to-term link mutated, tag renamed, term ownership created/updated/deleted,
or owner record (name/title) edited. The implementation is fully
delegate-shaped — every method assembles a jOOQ `Select` of the new vector
inputs and hands the upsert construction to `JooqFTSHelper.buildVectorUpsert`,
the helper shared with the DataEntity-side `ReactiveSearchEntrypointRepository`.

## concepts

- entities: [Term, TermSearchEntrypoint, TermVector, TagVector, NamespaceVector, OwnerVector, Tag, Namespace, Owner, Title, TermOwnership, TagToTerm, TsvectorRow, FTSConfigDetails]
- operations: [updateTermVectors, updateChangedNamespaceVector, updateNamespaceVectorsForTerm, updateTagVectorsForTerm, updateChangedTagVectors, updateChangedOwnershipVectors, updateChangedOwnerVectors, build-vector-upsert-from-select, recompute-vector-from-current-row-state]
- invariants:
  - "Vector refresh is per-term-per-column — every method writes EXACTLY ONE column of `term_search_entrypoint` for ONE term (or the set of terms reachable from the changed entity)" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:37-60 (single-term term-vector), :110-133 (term-id-scoped tag fanout), :135-166 (tag-id-scoped term fanout via CTE)
  - "All five non-term-id-scoped methods filter on `TERM.DELETED_AT.isNull()` — soft-deleted terms are excluded from refreshes that fan out from namespace/tag/ownership/owner events" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:72, :143, :182, :224
  - "All seven methods use `INSERT ... ON CONFLICT DO UPDATE` semantics via `JooqFTSHelper.buildVectorUpsert` — the primary key is `term_search_entrypoint.term_id`, so the conflict target is implicit" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:51-57, :75-81, :99-105, :124-130, :157-163, :197-205, :239-247 + JooqFTSHelper.java:93-97
  - "Tag/ownership/owner methods pass `agg=true` to `buildVectorUpsert` — multiple tag rows or ownership rows for the same term are aggregated into a single tsvector via the custom `tsvector_agg` SQL aggregate (defined in V0_0_14__normalize_fts_process.sql per JooqFTSHelper.java:191 comment); term-method and namespace methods pass the default `agg=false`" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:130, :163, :203, :245 (agg=true) vs :37-60, :63-84, :87-107 (no agg flag, defaults to false at JooqFTSHelper.java:43-52)
  - "Owner / title fields are field-aliased and remapped via `Map.of(ownerNameAlias, OWNER.NAME, titleNameAlias, TITLE.NAME)` so the helper's `setweight` lookup can find the FTSConstants weight for the ORIGINAL column despite the SELECT-time aliasing" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:172-178, :204, :214-220, :246 + JooqFTSHelper.java:195-218 (`getWeightRelation` falls back to `remappingConfig`)
  - "The two tag-related and two ownership-related methods build a CTE on the changed entity's ID, then re-join from `term` to recompute the FULL set of tag/owner rows — NOT just the delta. This means a single-tag rename re-emits the full tag vector for every term that has that tag (and a single-owner edit re-emits the full owner vector for every term they own)" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:141-155, :180-195, :222-237
  - "TERM_OWNERSHIP soft-delete is NOT filtered — the `TERM.DELETED_AT.isNull()` filter on the CTE excludes deleted *terms* but `TERM_OWNERSHIP.deleted_at` (the link soft-delete column per V0_0_35__add_terms.sql:36) is NOT checked, so a refresh triggered by a deleted-ownership-row still pulls it back into the vector via the leftJoin at :193, :235 (the deleted ownership row's owner/title still contribute weight to the rebuilt vector)" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:180-195 (no `TERM_OWNERSHIP.DELETED_AT.isNull()` clause) + V0_0_35__add_terms.sql:36 (term_ownership.deleted_at present)

## dependencies_semantic

- requires-feature:
  - "JooqFTSHelper.buildVectorUpsert — the shared FTS write builder (constructs the `WITH cte AS (...) INSERT ... ON CONFLICT DO UPDATE` chain, handles agg + remappingConfig)" — file:line: JooqFTSHelper.java:43-98
  - "FTSConfig.FTS_CONFIG_DETAILS_MAP entry for FTSEntity.TERM — supplies the (TERM_SEARCH_ENTRYPOINT table, term_id field, TERM_FTS_WEIGHTS, TERM_CONDITIONS) tuple" — file:line: FTSConfig.java:39-43 + ReactiveTermSearchEntrypointRepositoryImpl.java:56, :80, :104, :129, :162, :202, :244
  - "JooqReactiveOperations.mono — reactive jOOQ executor (R2DBC adapter)" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:33, :59, :83, :107, :132, :165, :207, :249
  - "Postgres custom aggregate `tsvector_agg` — used for agg=true methods" — file:line: JooqFTSHelper.java:191 (comment) — defined in V0_0_14__normalize_fts_process.sql per that comment
- requires-config: []  (no `@Value` consumers; no externalised knobs)
- requires-runtime:
  - "PostgreSQL with `tsvector` + `to_tsvector` + the platform's custom `tsvector_agg` aggregate available"
  - "R2DBC PostgreSQL driver (every operation is reactive)"
  - "jOOQ generated model — `Tables.TERM`, `Tables.TERM_SEARCH_ENTRYPOINT`, `Tables.TERM_OWNERSHIP`, `Tables.TAG`, `Tables.TAG_TO_TERM`, `Tables.NAMESPACE`, `Tables.OWNER`, `Tables.TITLE`" — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:19-26
  - "term_search_entrypoint.search_vector is GENERATED ALWAYS AS (term_vector || tag_vector || owner_vector || namespace_vector) STORED — Postgres computes the aggregate column on every write to any of the four input columns" — file:line: V0_0_35__add_terms.sql:65-70

## tests_coverage_semantic

- covered_behaviours:
  - "NamespaceServiceImplTest indirectly tests `updateChangedNamespaceVector` invocation — verifies the namespace-update flow calls the term-side and entity-side vector refreshes via `verify(termSearchEntrypointRepository, only()).updateChangedNamespaceVector(eq(namespaceId))`" — file:line: NamespaceServiceImplTest.java:175, :186 (Mock interaction only; no real DB assertion)
- uncovered_behaviours:
  - "NO direct repository-impl test for ReactiveTermSearchEntrypointRepositoryImpl — none of the seven methods have a unit or integration test that exercises real SQL execution against a Postgres test container (verified: no test class file matches `ReactiveTermSearchEntrypointRepository*Test*` across odd-platform-api/src/test)"
  - "NO test asserting `tsvector_agg(...)` behaves correctly for aggregated tag/owner columns when a term has 0/1/N tags or 0/1/N ownership rows — agg=true is a custom Postgres aggregate that did not exist in stock Postgres FTS"
  - "NO test asserting `TERM.DELETED_AT.isNull()` filter actually excludes soft-deleted terms from refresh fanout (cross-namespace, cross-tag, cross-owner)"
  - "NO test asserting the `TERM_OWNERSHIP.deleted_at` non-filter (the invariant above) — i.e. that the current behaviour of including soft-deleted ownership rows in the rebuilt vector is intentional vs accidental"
  - "NO test asserting the agg=false vs agg=true selection (term-only vs tag/owner) is right — a developer who changed an agg=true to agg=false on a tag method would silently corrupt the tag vector for every multi-tag term, with no test catching it"
  - "NO test for the namespace `INSERT ... ON CONFLICT DO UPDATE` interaction with the GENERATED ALWAYS `search_vector` column — i.e. that a namespace update to one column does not silently zero out the search_vector (Postgres recomputes on any input change, but a buggy upsert that wrote `null` to the wrong column would corrupt the index)"
  - "NO test for the delete-term path — TermServiceImpl.delete (TermServiceImpl.java:153-165) does NOT call any vector-clear method, and there is no test asserting whether soft-deleted terms remain in the FTS index until they cascade-disappear via `TERM.DELETED_AT.isNull()` filters elsewhere"
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/NamespaceServiceImplTest.java:24, :58, :175, :186, :205 (mock-only interactions on this repository's interface)"
- gaps: |
    The repository has effectively ZERO direct coverage. NamespaceServiceImplTest
    is the only test referencing the interface, and it only verifies that the
    method is called — not that the SQL produces the right tsvector. The seven
    methods are SQL-heavy (CTEs, aggregates, `INSERT ... ON CONFLICT`, remapping
    config) and any silent corruption (wrong column written, wrong term refreshed,
    agg flag flipped, soft-delete filter missed) would only surface as
    search-result drift — visible to operators as "term I just edited doesn't
    show up in search" or "deleted term still in autocomplete", but invisible
    in CI. A regression most likely lands as a JooqFTSHelper change (e.g. a
    well-intentioned escape pass for REFACTOR-229 affecting the WRITE path)
    silently breaking tag/owner aggregation, with no integration test catching
    it before deploy.

## docs_link_semantic

- declared_docs: []  # no @docs annotation in source
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-glossary"
    anchor: ""
    rationale: "Data Glossary is the user-facing pillar (P-06) whose terms this repository indexes. WebFetched 2026-05-20 (status 200) — the page does NOT describe term-search-vector maintenance mechanics."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "Term entities also surface inline on every data-entity detail page" — the doc references search adjacency but says nothing about how the platform refreshes the term FTS index when terms / tags / owners / namespaces change.
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-glossary/business-glossary"
    anchor: ""
    rationale: "Per the Data Glossary page, this is the comprehensive sub-page. WebFetched 2026-05-20 (status 200) — does NOT describe term-search-vector maintenance."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "Searches and term-to-entity link operations resolve within the namespace by default" — the doc references where searches resolve but not how the FTS index is maintained for terms.
    confidence: LOW
- doc_drift_findings:
  - "Live docs P-06 Data Glossary + Business Glossary describe term lifecycle and ownership but are SILENT on how the platform maintains the term search index when terms / tags / owners / namespaces mutate. This is internal infrastructure, intentionally invisible to operators — but the doc-side absence means there is also no operator-facing statement about expected search-staleness or refresh-latency. Aligned with the broader 'FTS internals are undocumented' surface noted on the DataEntity-side path."

## implicit_adrs

- "Term FTS index is materialised in a dedicated `term_search_entrypoint` table with FOUR separate vector columns (term_vector / tag_vector / namespace_vector / owner_vector) plus a GENERATED ALWAYS `search_vector` that concatenates them — the per-source-table column layout lets a single-source mutation refresh only the relevant column instead of recomputing the whole row." — evidence: V0_0_35__add_terms.sql:58-73 (schema), ReactiveTermSearchEntrypointRepositoryImpl.java:55, :79, :103, :128, :161, :201, :243 (per-column write targets) — intent_anchor: "search_vector tsvector GENERATED ALWAYS AS (coalesce(term_vector, '') || coalesce(tag_vector, '') || coalesce(owner_vector, '') || coalesce(namespace_vector, '')) STORED" (V0_0_35__add_terms.sql:65-70 — the GENERATED ALWAYS column IS the architectural intent that splits the materialised FTS into per-source columns) — confidence: HIGH
- "Refresh is delegated end-to-end to `JooqFTSHelper.buildVectorUpsert` — the term-side repository carries NO bespoke vector-construction logic. Every method assembles a Select + a list of fields + the target column + the FTS config tuple, and the helper does the rest. The duplication between DataEntity-side and Term-side repositories was the maintainer's deliberate sharing-by-method-signature rather than sharing-by-inheritance." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:51-57, :75-81, :99-105, :124-130, :157-163, :197-205, :239-247 (every method's structure is identical) + JooqFTSHelper.java:43-98 (the shared builder) — intent_anchor: pattern is applied seven-of-seven times across this file and (per scaffold edges) the sibling DataEntity-side file — the consistency IS the convention. — confidence: HIGH
- "Fan-out from a changed namespace / tag / owner re-emits the FULL vector for every affected term, not a delta. This trades write-amplification for query-side simplicity — the search index never has to merge deltas because each refresh writes the complete state of that term's input." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:141-155 (tag CTE rebuilds from current `tag_to_term` set), :180-195 (ownership CTE rebuilds from current `term_ownership`), :222-237 (owner CTE rebuilds from current `term_ownership`) — intent_anchor: every CTE is built from the source table's CURRENT state (`leftJoin(TAG_TO_TERM)` + `leftJoin(TAG)` at :154-155 rather than passing in the changed-tag id alone); the architectural choice is "recompute, don't delta". — confidence: HIGH

## bugs_limitations_corner_cases

- "**Term DELETE leaves stale vectors in `term_search_entrypoint`.** `TermServiceImpl.delete(long id)` (TermServiceImpl.java:153-165) deletes term_to_term, term_to_data_entity, term_to_dataset_field relations and the term row itself, but never calls any method on this repository to drop the term's row from `term_search_entrypoint`. Soft-deleted terms (where `term.deleted_at IS NOT NULL`) keep their last-known tsvector contents in the FTS table indefinitely; readers that join `term` (filtering by `TERM.DELETED_AT.isNull()`) will not see them, but any reader that queries `term_search_entrypoint` directly without joining `term` would surface deleted terms. The pattern is the same shape as the DataEntity-side `delete_search_vector_not_refreshed` family from earlier batches." — evidence: TermServiceImpl.java:153-165 (delete method) + ReactiveTermSearchEntrypointRepositoryImpl.java (no `delete` / `clearVectorsForTerm` method on the interface or impl) + ReactiveTermSearchEntrypointRepository.java:5-20 (interface has only 7 update methods, no delete) — severity: MEDIUM
- "**Soft-deleted TERM_OWNERSHIP rows still contribute to `owner_vector`.** `updateChangedOwnershipVectors` and `updateChangedOwnerVectors` use `leftJoin(TERM_OWNERSHIP).on(TERM_OWNERSHIP.TERM_ID.eq(TERM.ID))` with NO `TERM_OWNERSHIP.DELETED_AT.isNull()` filter. The `term_ownership.deleted_at` column exists (V0_0_35__add_terms.sql:36 + unique index at :43-44 conditioned on `deleted_at IS NULL`), so the platform CAN soft-delete an ownership link; when that happens, this repository's refresh will still walk the soft-deleted row and re-emit the deleted owner's name into the term's owner_vector. The DataEntity-side equivalent and the term-side `delete` in TermOwnershipServiceImpl HARD-DELETE the ownership row (per TermOwnershipServiceImpl.java:52-55 — `termOwnershipRepository.delete(termOwnershipId).flatMap(pojo -> termSearchEntrypointRepository.updateChangedOwnershipVectors(pojo.getId()))` does not show a soft-delete pattern), so in practice ownership deletion may already be hard, masking this — but the absent filter is a latent bug if any path soft-deletes a `term_ownership` row." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:180-195, :222-237 (no DELETED_AT filter on TERM_OWNERSHIP join) + V0_0_35__add_terms.sql:36 (deleted_at column present) + TermOwnershipServiceImpl.java:52-55 (delete-then-refresh path uses the pojo's id, suggesting hard-delete in practice but no filter in this repo to enforce it) — severity: LOW
- "**Tag fanout has no deleted-tag filter.** `updateChangedTagVectors` (line 135-166) reaches `leftJoin(TAG)` without checking whether the tag has been soft-deleted (`tag.deleted_at`). A tag rename event invoked on a soft-deleted tag would still recompute the term-vector contributions of that deleted tag for every term it touched. The DataEntity-side sibling has the same shape per the scaffold edge; the deleted-tag-filter discipline lives in the SERVICE layer not the repository." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:154-155 (no DELETED_AT clause on TAG_TO_TERM or TAG) — severity: LOW
- "**No back-pressure or batching when a tag/owner/namespace event fans out to a large number of terms.** `updateChangedNamespaceVector(namespaceId)` (line 63-84) issues ONE `INSERT ... SELECT` whose subquery's `WHERE NAMESPACE.ID = ?` could match every term in that namespace; the upsert happens in a single SQL statement, which is efficient at the DB level — but `updateChangedTagVectors(tagId)` and `updateChangedOwnerVectors(ownerId)` similarly batch in one statement. The bottleneck is the SQL plan and `tsvector_agg` cost; there is no explicit chunking. A namespace rename on a namespace holding 10k terms produces ONE write of 10k rows, which is fine for correctness but generates a long lock window on `term_search_entrypoint` and a corresponding write-amplification on the GENERATED `search_vector` column. The platform's only check on namespace size is operator-side." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:63-84, :135-166, :210-250 — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this repository is invoked from service-layer code only (TermServiceImpl, TermOwnershipServiceImpl, TagServiceImpl, NamespaceServiceImpl, OwnerServiceImpl) and has no HTTP surface. The auth-mode-relevance flows from the call sites' authorization gates, not this code.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion` — the term lifecycle entry points are catalog UI / API mutations under the standard Permission-gate framework, not the `POST /ingestion/entities` write path. The `auth.ingestion.filter.enabled` gate does NOT apply here.
- **authorization_assertions**: []  (this repository has no `@PreAuthorize` — authorization happens at the controller / service layer; the call sites in TermServiceImpl + TermOwnershipServiceImpl + TagServiceImpl + NamespaceServiceImpl + OwnerServiceImpl are reached only after the controller-side Permission check)
- **owner_scoping**: `N/A — code is not data-scoped` — vector refreshes mutate `term_search_entrypoint` for the target term ID supplied by the caller. The caller's owner-scoping happens upstream.
- **data_exposure**: []  (this code does not return query results to the caller — it writes vectors; the only Mono return type is `Mono<Integer>` row-count)
- **known_security_gaps**:
  - "**REFACTOR-229 family — the term-side WRITE path uses the SAME JooqFTSHelper that has the unescaped tsquery operator-injection surface; however, this file's invocation of the helper goes through `buildVectorUpsert` (a WRITE-side method) which does NOT call `tsQuery` or `to_tsquery`. The injection surface is on the READ path (`JooqFTSHelper.ftsCondition` + `ftsRankField` at JooqFTSHelper.java:100-105, :154-162) — the term-side READS that consume term_search_entrypoint (term search, term ranking) are the second-invocation site, NOT this WRITE path. This file is therefore NOT a NEW invocation site for REFACTOR-229; it is the WRITE path that POPULATES the index that the vulnerable READ path queries. The poison-payload (e.g. `'); DROP TABLE term; --` written to `term.definition`) is stored as a tsvector via `to_tsvector(...)` which Postgres tokenises rather than evaluating as SQL — so the WRITE path itself does NOT detonate the payload. The payload detonates on the READ side, in any caller of `JooqFTSHelper.ftsCondition` over `term_search_entrypoint.search_vector` with a user-controlled query string." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:51-57, :75-81, :99-105, :124-130, :157-163, :197-205, :239-247 (every method uses `buildVectorUpsert`, NOT `ftsCondition`) + JooqFTSHelper.java:43-98 (buildVectorUpsert calls `concatVectorFields` → `to_tsvector` only — no `to_tsquery`) — severity: LOW (this WRITE path is upstream of the vulnerability, not part of it)
  - "**`setweight(to_tsvector(...), 'X')` is built via `String.format` on the field name AND the weight letter** at JooqFTSHelper.java:188. The first `%s` is a jOOQ Field rendered to SQL identifier (safe, comes from the static `Tables.*` model), and the second `%s` is a static one-character weight from `FTSConstants.{DATA_ENTITY,TERM,...}_FTS_WEIGHTS`. The format string is NOT user-input-driven, so this is NOT a CVE — but it IS a code-smell that any change to FTSConstants weights to allow operator-configurable weights would open the second `%s` to injection. Worth flagging because the REFACTOR-229 family makes future-fix-authors look at all `String.format` in JooqFTSHelper." — evidence: JooqFTSHelper.java:188 (the format) + FTSConstants weights (referenced but not user-writable) — severity: LOW (latent, not currently exploitable)

## performance

- **hot_paths**:
  - "`updateTermVectors(termId)` — invoked twice on every term create AND update via `TermServiceImpl.updateSearchVectors` (TermServiceImpl.java:324-329) inside a `Mono.zip` alongside `updateNamespaceVectorsForTerm`. Single-row write, fast, but on every term mutation." — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:37-60 + TermServiceImpl.java:324-329
  - "`updateTagVectorsForTerm(termId)` — invoked in `TermServiceImpl.upsertTags` (TermServiceImpl.java:261-262) after every tag-link change. The CTE rejoins `tag_to_term` × `tag` to rebuild the full tag vector." — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:110-133
  - "`updateChangedOwnershipVectors(ownershipId)` — invoked on every TERM ownership create / delete / title update (TermOwnershipServiceImpl.java:44-46, :54, :66). CTE walks `term_ownership` × `term` × `title` × `owner`." — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:169-208
- **throughput_characteristics**:
  - "Single SQL statement per refresh — the `WITH cte AS (...) INSERT ... SELECT ... ON CONFLICT DO UPDATE` is one round-trip per call (per JooqFTSHelper.buildVectorUpsert at JooqFTSHelper.java:93-97)" — file:line: JooqFTSHelper.java:78-97
  - "Fan-out write amplification: a single namespace / tag / owner mutation can update N rows of `term_search_entrypoint` (where N is the count of terms scoped by that namespace / tag / owner). N is unbounded by code; the platform's only ceiling is the operator's term-count discipline." — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:63-84 (namespace), :135-166 (tag), :210-250 (owner)
- **resource_allocation**:
  - "Each refresh acquires a per-row lock on `term_search_entrypoint` for every row written. The GENERATED ALWAYS `search_vector` column recomputes on every write to the four input columns; this is Postgres-side work, paid per row, paid per refresh." — file:line: V0_0_35__add_terms.sql:65-70 (GENERATED ALWAYS) + ReactiveTermSearchEntrypointRepositoryImpl.java per-write targets
  - "The GIN index `term_search_entrypoint_search_vector_idx` rebuilds per-row on every write (Postgres's standard GIN-write-amplification penalty applies). High-frequency rename / re-tag workflows on large namespaces are expensive at the index layer." — file:line: V0_0_35__add_terms.sql:75-76
- **scaling_characteristics**:
  - "Stateless — no in-memory caches, no instance-level mutable state. Multiple platform instances can refresh different terms concurrently; the `INSERT ... ON CONFLICT DO UPDATE` provides the synchronisation guarantee at the row level." — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:29-34 (only injected dependencies; no fields beyond)
  - "No explicit chunking or back-pressure on multi-term refreshes. A namespace rename involving 10k terms writes 10k rows in one statement." — file:line: ReactiveTermSearchEntrypointRepositoryImpl.java:63-84
- **known_performance_gaps**:
  - "**Fan-out refresh is unbounded.** A tag rename event triggers `updateChangedTagVectors(tagId)` which fans out to every term referencing that tag. The CTE issues a single SQL statement that joins `tag_to_term` × `term` × `tag_to_term` × `tag` — for a tag attached to 10k terms, the result set is 10k tag-attach rows in the CTE plus 10k+ tag-row pairs in the leftJoin. The statement is technically O(N) but the lock window grows linearly. No chunking, no back-pressure, no max-N safety valve." — evidence: ReactiveTermSearchEntrypointRepositoryImpl.java:141-155 — severity: LOW (the platform's term taxonomies are typically small; bites at operator-curated-large-glossary scale)
  - "**Read-side and write-side aren't decoupled.** The same Postgres row of `term_search_entrypoint` is locked for every refresh AND queried for every search-rank call. Bursty refresh traffic (e.g. an `odd-collector` push that auto-creates tags) competes for locks with interactive search-rank reads. There is no separate read-replica routing, no caching layer, no FTS-write-queue." — evidence: V0_0_35__add_terms.sql:58-76 (single table; no read replica configuration) — severity: LOW

## sources

- understanding ← ReactiveTermSearchEntrypointRepositoryImpl.java:1-251 (entire file) + JooqFTSHelper.java:43-98 (the shared builder) + V0_0_35__add_terms.sql:58-76 (the schema)
- concepts.entities ← ReactiveTermSearchEntrypointRepositoryImpl.java:19-26 (table imports) + V0_0_35__add_terms.sql:58-73
- concepts.operations ← ReactiveTermSearchEntrypointRepositoryImpl.java:37, :63, :87, :111, :136, :169, :211 (method signatures)
- concepts.invariants.[0..6] ← ReactiveTermSearchEntrypointRepositoryImpl.java per-line cites embedded in each invariant
- dependencies_semantic.requires-feature ← ReactiveTermSearchEntrypointRepositoryImpl.java:33-34, :51 + JooqFTSHelper.java:43-98 + FTSConfig.java:39-43
- dependencies_semantic.requires-runtime ← V0_0_35__add_terms.sql:58-76 + JooqFTSHelper.java:191 (tsvector_agg migration ref)
- tests_coverage_semantic.test_files ← NamespaceServiceImplTest.java:24, :58, :175, :186, :205 (the ONLY referencing test class found)
- tests_coverage_semantic.uncovered_behaviours ← absence of `ReactiveTermSearchEntrypointRepository*Test*` files across odd-platform-api/src/test (Grep verified)
- docs_link_semantic.inferred_docs ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/features/data-glossary and .../business-glossary (status 200, no FTS-internals coverage)
- implicit_adrs.[0] ← V0_0_35__add_terms.sql:65-70 (GENERATED ALWAYS intent_anchor) + per-line write-target cites
- implicit_adrs.[1] ← seven-of-seven structural identity at ReactiveTermSearchEntrypointRepositoryImpl.java:51-57, :75-81, :99-105, :124-130, :157-163, :197-205, :239-247 + JooqFTSHelper.java:43-98
- implicit_adrs.[2] ← :141-155, :180-195, :222-237 (every CTE rebuilds from current state, not delta)
- bugs_limitations_corner_cases.[0] ← TermServiceImpl.java:153-165 (delete method has no vector-clear) + ReactiveTermSearchEntrypointRepository.java:5-20 (interface has no delete method)
- bugs_limitations_corner_cases.[1] ← ReactiveTermSearchEntrypointRepositoryImpl.java:180-195, :222-237 + V0_0_35__add_terms.sql:36
- bugs_limitations_corner_cases.[2] ← ReactiveTermSearchEntrypointRepositoryImpl.java:154-155
- bugs_limitations_corner_cases.[3] ← ReactiveTermSearchEntrypointRepositoryImpl.java:63-84, :135-166, :210-250
- security.known_security_gaps.[0] ← ReactiveTermSearchEntrypointRepositoryImpl.java (every method uses `buildVectorUpsert`, NOT `ftsCondition`) + JooqFTSHelper.java:43-98 + REFACTOR-229 (cross-link)
- security.known_security_gaps.[1] ← JooqFTSHelper.java:188 (the format) + FTSConstants weights
- performance.hot_paths.[0] ← ReactiveTermSearchEntrypointRepositoryImpl.java:37-60 + TermServiceImpl.java:324-329
- performance.hot_paths.[1] ← ReactiveTermSearchEntrypointRepositoryImpl.java:110-133 + TermServiceImpl.java:261-262
- performance.hot_paths.[2] ← ReactiveTermSearchEntrypointRepositoryImpl.java:169-208 + TermOwnershipServiceImpl.java:44-46, :54, :66
- performance.scaling_characteristics ← ReactiveTermSearchEntrypointRepositoryImpl.java:29-34 + V0_0_35__add_terms.sql:58-76
- performance.known_performance_gaps ← ReactiveTermSearchEntrypointRepositoryImpl.java:141-155 + V0_0_35__add_terms.sql:58-76

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (live-fetched, intentional silence confirmed)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH (REFACTOR-229 ROLE-DISAMBIGUATED rather than inherited — this WRITE path is upstream of the READ-side vuln; setweight format is non-exploitable but flagged)
- performance: HIGH

## Maintainer notes
