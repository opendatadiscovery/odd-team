---
panel_run: 2026-05-21
phase: 1
expert: panel-engineer
axis: Depth
commit_anchor: ede5d277
prompt_version: panel-engineer/0.1.0
axis_score: 6
axis_band: AMBER
---

# Phase 1 — Engineer (Depth) assessment

## summary

The ontology demonstrates genuine stack mastery where the Stress Protocol (LSN-019) has been applied: the `stress_findings` sections trace jOOQ chains line-by-line, catch the ORDER-BY-then-LIMIT trap, and generate exactly the catching questions a senior engineer would. The pre-stress sidecars (`bugs_limitations_corner_cases` shape) are also strong on reactive boundaries and the EXCLUDE_FROM_SEARCH inconsistency, and the React/TS sidecars show real React-18 awareness (Strict-Mode double-fire, AbortController absence, remount refetch). But depth is **unevenly distributed**: only 3 of 144 sidecars (2 of 15 jOOQ repositories) carry the systematic 5-category stress sweep; the other 141 rely on a less-systematic shape that catches the bugs it happens to look at but does not sweep idiom triggers. Two stack-idiom classes — Spring AOP proxy-bypass and the jOOQ name-resolution `NULL`-field trap — have **no node in the ontology that generates the catching question** for a NEW bug.

## stack_depth_probes

- id: DP-1
  idiom_class: spring
  hypothetical_bug: "A maintainer adds `@ReactiveTransactional(propagation = REQUIRES_NEW)` to the private helper `DataEntityServiceImpl.incrementViewCount` (line 488), intending the view-count UPDATE to commit independently of the detail-read transaction. Spring AOP cannot proxy a `private` method, and the call site at line 207 is a `this.`-self-invocation — so the annotation is silently ignored. The increment stays inside the outer `getDetails` transaction and still rolls back on enrichment failure, the exact opposite of the maintainer's intent."
  where_it_would_live: "odd-platform-api/.../service/DataEntityServiceImpl.java:488 (the private helper) + :207 (the self-invocation call site)"
  ontology_engagement: |
    The `DataEntityServiceImpl` sidecar engages transaction boundaries deeply — it counts the 8 `@ReactiveTransactional` sites, identifies `getDetails` as the only transactional read, notes the nested-transaction propagation into `DataEntityInternalStateServiceImpl`, and flags rollback as untested (understanding §invariants, §coupling[0..1], tests_coverage §1). But every claim treats annotation PLACEMENT as equivalent to annotation EFFECT. Nowhere does the sidecar — or `implicit_adrs`, or `concepts.invariants` — surface "is `@ReactiveTransactional` even honoured on a private / self-invoked method?". `incrementViewCount` is correctly described as transactionally protected *via the outer boundary* (downstream_side_effects[0], txn_scope) — which is true today only because the helper carries no annotation of its own. The ontology has no trigger that would fire the proxy-visibility question the moment a future annotation is added to a private method.
  verdict: would-miss
  evidence: "DataEntityServiceImpl.java:197,207,488 (source) + understanding/odd-platform__java__service__service__DataEntityServiceImpl.md:§invariants[56-57], §coupling[109-110], downstream_side_effects[223-226] (no proxy-visibility question anywhere)"

- id: DP-2
  idiom_class: jooq-sql
  hypothetical_bug: "A maintainer adds a new list method to `ReactiveDataEntityRepositoryImpl` that sorts by a derived column — e.g. `DataEntityCTEQueryConfig.builder().orderBy(field(\"alert_count\").sort(DESC))` — without adding `alert_count` to the CTE's projected `selectFields`. `getOrderFields` (line 945-952) resolves the sort field by NAME STRING: `deCte.field(cteConfig.getOrderBy().getName())`. `Table.field(String)` returns `null` when the name is not in the table's projection; jOOQ then NPEs on `null.sort(...)` at query-build time — or, if the path takes the `field(name)` branch (line 952), emits an unqualified column reference that PostgreSQL rejects at execution. Either way the failure is invisible at code-review time."
  where_it_would_live: "odd-platform-api/.../repository/reactive/ReactiveDataEntityRepositoryImpl.java:945-968 (getOrderFields — the name-string resolution) + 909-939 (cteDataEntitySelect — the projection that must contain the name)"
  ontology_engagement: |
    The `ReactiveDataEntityRepositoryImpl` sidecar dissects `cteDataEntitySelect`, the EXCLUDE_FROM_SEARCH omission, and the 7 paginated call sites exhaustively (concepts §invariants[2], implicit_adrs[3], bugs §1). It quotes `getOrderFields` appending the `DATA_ENTITY.ID.desc()` tiebreaker (downstream_side_effects[1] notes). But it treats `getOrderFields` purely as a determinism guarantee — it never engages the FRAGILITY of String-keyed field resolution against a CTE projection. Verified against source: `getQuerySuggestions` (line 471-513) sorts by the derived `RANK_FIELD_ALIAS` and the maintainer there had to explicitly `.select(rankField.as(RANK_FIELD_ALIAS))` BEFORE referencing it, and used the typed `jooqQueryHelper.getField(...)` helper — proof the trap is real and live developers already navigate it. The ontology records the safe instances but generates no catching question for a future unsafe one. The 2 jOOQ repos that DO carry `stress_findings` (Tag, Activity) would generate this question; `ReactiveDataEntityRepositoryImpl` — the platform's busiest repository — does not.
  verdict: would-miss
  evidence: "ReactiveDataEntityRepositoryImpl.java:945-952,471-513 (source) + understanding/odd-platform__java__repository_reactive__repository__ReactiveDataEntityRepositoryImpl.md:downstream_side_effects[181], implicit_adrs[246] (getOrderFields treated as determinism-only, no fragility question)"

- id: DP-3
  idiom_class: jooq-sql
  hypothetical_bug: "A maintainer adds a `listByDomain(domainId, page, size)` method whose CTE config sets a custom `orderBy` but forgets the tiebreaker, OR ranks a slow-changing column (e.g. `created_at`) that has many ties — yielding non-deterministic pagination where the same row appears on page 1 and page 2 across two requests. This is the canonical LSN-019 bug class re-instantiated in a NEW method."
  where_it_would_live: "odd-platform-api/.../repository/reactive/ReactiveDataEntityRepositoryImpl.java — any new method composing DataEntityCTEQueryConfig"
  ontology_engagement: |
    This is the class the methodology was BUILT to catch, and where it is strongest. The `ReactiveTagRepositoryImpl` stress section (Category B1, C1) traces `listMostPopular` end-to-end: it identifies that `paginate(...)` applies `ORDER BY tag.id ASC LIMIT size` BEFORE the count aggregation, that the outer `ORDER BY count DESC` only re-ranks the already-truncated pool, and that there is NO secondary tiebreaker so ties fall to natural row order. It cites the empirical LSN-019 reproduction (35 tags, equal counts → oldest 30 returned). For any jOOQ repository that has been through the Stress Protocol, a new ORDER-BY/LIMIT bug WOULD be caught — the 5-category sweep fires on the trigger automatically. The gap is reach, not depth: only 2 of 15 jOOQ-repository sidecars carry this section (`sidecars_with_stress_section: 3` in manifest.yaml; `sidecars_pre_stress_protocol: 141`).
  verdict: would-catch
  evidence: "understanding/odd-platform__java__repository__reactive__repository__ReactiveTagRepositoryImpl.md:§stress_findings B1+C1 (line-by-line jOOQ chain trace) + ReactiveTagRepositoryImpl.java:138-167 (source confirms) + manifest.yaml:36-39 (only 3 sidecars stress-equipped)"

- id: DP-4
  idiom_class: reactive
  hypothetical_bug: "A maintainer 'optimises' `RemoteFileUploadServiceImpl.completeFileUpload` by replacing the `DataBuffer::asInputStream` + `getStreamSize` path (line 68-69) with a direct `Files.readAllBytes(path)` or a synchronous `inputStream.readAllBytes()` call placed inside the `.map(...)` operator at line 70 — without wrapping it in `subscribeOn(Schedulers.boundedElastic())`. The blocking filesystem read then runs on the Netty event-loop thread that carries the WebFlux request, stalling every other in-flight request multiplexed onto that loop."
  where_it_would_live: "odd-platform-api/.../service/attachment/remote/RemoteFileUploadServiceImpl.java:60-77 (completeFileUpload) — a blocking call dropped into the .map at line 70"
  ontology_engagement: |
    The reactive-boundary discipline IS present in the ontology. The `DataEntityServiceImpl` sidecar explicitly verifies "zero `.block()` calls — the batch-D anti-pattern is NOT present" (understanding line 19). 9 sidecars carry event-loop / `boundedElastic` awareness. The `uploadFileChunk` sidecar is genuinely deep on the upload path — cross-entity hijack, multi-instance `/tmp` staging, same-index race, disk DOS. But it stops at the controller→service handoff: it never engages whether `FilePart.transferTo` or the chunk-assembly IO is offloaded off the event loop. No sidecar covers `RemoteFileUploadServiceImpl` / `LocalFileUploadServiceImpl` directly (the `completeFileUpload` reactive composition is un-enriched — confirmed: no `understanding/*FileUpload*` or `*completeFileUpload*` sidecar exists). Verified against source: the current code is careful (`Mono.fromFuture` for the MinioAsyncClient, `boundedElastic` for `inputStream.available()`, a dedicated `BlockingOperationUtils` utility). The methodology catches `.block()` by grep, but a NEW blocking call that is NOT `.block()` — a raw `Files.read`, a synchronous SDK call, a `transferTo` on a blocking stream — has no node generating the "does this run on the event loop?" question for the upload composition.
  verdict: partial
  evidence: "RemoteFileUploadServiceImpl.java:60-77,107-138 + BlockingOperationUtils.java (source — careful) + understanding/odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md (no event-loop question on transferTo) + grep: no understanding sidecar for *FileUploadServiceImpl*"

- id: DP-5
  idiom_class: react-ts
  hypothetical_bug: "A maintainer adds a `useEffect` to `OwnerEntitiesList` that depends on a prop or a Redux-selected object (e.g. `[ownerEntities]` or `[identity]`) where the selector returns a NEW array/object reference on every store update — causing the effect to re-fire on every render and re-dispatch the 4 fetch thunks in an infinite-ish loop, hammering the un-indexed `ORDER BY view_count DESC` query."
  where_it_would_live: "odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerEntitiesList/OwnerEntitiesList.tsx:58-64 (the useEffect)"
  ontology_engagement: |
    The `PopularStrip` sidecar is the strongest single piece of stack-depth work in the sample. It engages the `useEffect(..., [])` empty-deps array as a deliberate caching choice, React-18 Strict-Mode DOUBLE-FIRE of the dispatch, the absent AbortController / cleanup, react-router-v6 remount-on-back refetch, the absence of request deduplication, and the throughput cost of refetching against the un-indexed sort (bugs[198-200], performance[225-235]). It explicitly recommends gating the dispatch on `isNotFetched`. A maintainer changing the deps array to an unstable reference would be caught: the sidecar already reasons about exactly what the `[]` deps array buys and what removing it would cost. Source verified — `OwnerEntitiesList.tsx:58-64` is unchanged between the sidecar's `extracted_at_commit 9ac6436e` and the anchor `ede5d277` (git log empty for the file across that range), so the analysis still holds. This is real React mastery, not transcription.
  verdict: would-catch
  evidence: "understanding/odd-platform__ts__react-component__component__PopularStrip.md:bugs[198-200], performance[225-235] + OwnerEntitiesList.tsx:58-64 (source) + git log 9ac6436e..ede5d277 (file unchanged — sidecar still valid)"

## findings

- id: ENG-F1
  title: "Stress Protocol depth reaches only 3 of 144 sidecars — 141 pre-stress nodes get no systematic idiom-trigger sweep"
  severity: HIGH
  evidence: "manifest.yaml:36-39 (sidecars_with_stress_section: 3; sidecars_pre_stress_protocol: 141; sidecars_empty_stress_section: 1) + 2 of 15 jOOQ-repository sidecars carry §stress_findings (ReactiveTag, ReactiveActivity)"
  detail: |
    The Stress Protocol is where the ontology demonstrably engages stack idioms (DP-3 proves it: the 5-category sweep generates the LSN-019 catching question automatically). But it has been applied to ~2% of substrate nodes. `ReactiveDataEntityRepositoryImpl` — the busiest repository on the platform, 982 lines, 35+ methods — uses the older `bugs_limitations_corner_cases` shape, which is strong on the bugs it examined (EXCLUDE_FROM_SEARCH, SQL-injection) but did NOT sweep the jOOQ name-resolution trigger (DP-2 would-miss). Depth that covers 2% of nodes is depth the panel cannot rely on for a randomly-chosen NEW bug.
  routed_to: approach-rev
  confidence: HIGH

- id: ENG-F2
  title: "No idiom-trigger for the Spring AOP proxy-bypass class (private / self-invoked @Transactional)"
  severity: MEDIUM
  evidence: "DataEntityServiceImpl.java:207,488 (private incrementViewCount, self-invoked) + understanding sidecar §invariants[56-57] treats placement as effect; ReactiveTransactional.java (annotation @Target METHOD+TYPE — no compile-time guard against private targets)"
  detail: |
    Every sidecar that discusses `@ReactiveTransactional` reasons about WHERE the annotation sits, never about whether Spring's proxy will HONOUR it. Self-invocation and private-method annotation are the two most common ways a Spring `@Transactional` silently becomes a no-op. The codebase is correct today (no private method carries the annotation), but the ontology would not surface the catching question the moment that changes. A Stress Protocol category — "annotation effectiveness: is this `@Transactional` / `@Cacheable` / `@Async` on a proxyable method, and is it invoked through the proxy?" — would close this. Add as a new stress-trigger category, OR as a pillar gate.
  routed_to: new-gate
  confidence: HIGH

- id: ENG-F3
  title: "Reactive event-loop check is grep-shaped (.block() only) — misses non-.block() blocking calls"
  severity: MEDIUM
  evidence: "DataEntityServiceImpl.md:understanding line 19 ('zero .block() calls — verified by grep') + DP-4: no understanding sidecar for RemoteFileUploadServiceImpl / LocalFileUploadServiceImpl despite completeFileUpload being a non-trivial reactive composition"
  detail: |
    The methodology detects the reactive anti-pattern by grepping for `.block()`. That catches the literal `.block()` (correctly: the 4 hits are all in @Scheduled job handlers, off the event loop — a correct read). But `Files.readAllBytes`, `InputStream.read()`, a synchronous JDBC/SDK call, `Thread.sleep`, or a blocking `transferTo` placed inside a `map`/`flatMap` on a request path are equally event-loop-poisoning and do not contain the string `.block()`. The upload services — which actually do blocking IO and have to manage `boundedElastic` offload — have no per-node sidecar at all. Reactive depth should be a semantic question ("does any operator on this request chain perform blocking IO without subscribeOn?"), not a string grep.
  routed_to: lsn-candidate
  confidence: MEDIUM

- id: ENG-F4
  title: "Sidecar commit drift — PopularStrip enriched at 9ac6436e, manifest anchor is ede5d277"
  severity: LOW
  evidence: "understanding/odd-platform__ts__react-component__component__PopularStrip.md:extracted_at_commit 9ac6436e vs manifest.yaml:last_scan_commit ede5d277"
  detail: |
    The `PopularStrip` sidecar's frontmatter records `extracted_at_commit: 9ac6436e`, not the manifest anchor `ede5d277`. I re-verified the one file the analysis depends on (`OwnerEntitiesList.tsx`) is byte-unchanged across that range, so this sidecar's conclusions still hold — but the drift means a reviewer cannot trust frontmatter commit equality as a freshness signal. Other sidecars carry `enriched_at_commit: ede5d277` correctly. Either re-stamp on re-anchor or add a "verified-current-at" field distinct from "extracted-at".
  routed_to: backlog-item
  confidence: HIGH

## what_went_well

- "DP-3 / ENG-F1: where the Stress Protocol ran, it is the real thing. `ReactiveTagRepositoryImpl.md §stress_findings` B1 traces the `listMostPopular` jOOQ chain line-by-line — `paginate()` applies `ORDER BY tag.id ASC LIMIT size` before count aggregation, the outer `ORDER BY count DESC` re-ranks only the truncated pool, no tiebreaker — and cites the empirical LSN-019 reproduction. A senior engineer reading the same code generates exactly these questions. Verified against ReactiveTagRepositoryImpl.java:138-167."
- "DP-5: the `PopularStrip` sidecar shows genuine React-18 mastery — Strict-Mode double-fire of the `useEffect` dispatch, absent AbortController, react-router-v6 remount-on-back refetch, request-dedup absence, and the throughput cost against an un-indexed sort. This is not pattern-name transcription; it draws the correct consequence each time (bugs[198-200])."
- "The `ReactiveDataEntityRepositoryImpl` sidecar correctly traced the EXCLUDE_FROM_SEARCH inconsistency across 9 list methods vs the count paths and `findByState`'s re-add via `JooqFTSHelper` — a cross-method invariant drift, verified true against cteDataEntitySelect.java:909-939. The doc-drift finding on `attachment.max-file-size` was independently confirmed by live WebFetch of docs.opendatadiscovery.org/features/data-discovery/attachments (2026-05-21): the page calls size 'the single restriction', the chunk API enforces nothing."

## axis_score
score: 6
band: AMBER
rationale: |
  AMBER (competent at the surface, would miss subtle stack bugs in ≥1 class) is the honest score. Two of five probes are would-catch (DP-3 jOOQ ordering, DP-5 React effects) and where the ontology engages it engages at true senior-engineer depth — that pulls the score to the upper end of AMBER, not the lower. But two probes are would-miss (DP-1 Spring proxy-bypass, DP-2 jOOQ name-resolution NULL-field) and one partial (DP-4 non-.block() blocking IO), and the would-miss cases are not exotic — they are everyday Spring/jOOQ traps. The decisive factor against GREEN: the demonstrable depth (the Stress Protocol) reaches 3 of 144 sidecars; the platform's busiest repository is not stress-equipped. GREEN requires the ontology to catch a new bug of MOST classes across a randomly-chosen node — today it catches them only on the ~2% of nodes that went through the Stress Protocol. The methodology's depth ceiling is high; its depth FLOOR (the pre-stress 141 sidecars) is what caps this at 6.

## independence_self_assessment
shared_blind_spot_risk: |
  I assessed sidecars produced by a model of my own family, and the failure mode is correlated: the file-analyser's `bugs_limitations_corner_cases` sections are fluent and name patterns correctly, and an LLM reviewer is primed to accept a correctly-named pattern. I re-derived every verdict from source (`getOrderFields` resolution, `incrementViewCount` privacy, the upload reactive composition, `OwnerEntitiesList` deps array) rather than from sidecar prose — but on DP-1/DP-2 I am asserting a NEGATIVE ("the ontology generates no catching question"), and a negative is exactly what a shared blind spot hides: if the proxy-bypass / NULL-field traps are also outside MY idiom-trigger set, I would not have invented those probes. The Spring proxy-bypass and jOOQ String-keyed-field traps are well-established enough that I am confident they are real classes, but a maintainer should confirm the ontology has no node covering them that I failed to find.
needs_human_verification:
  - "DP-1 — a maintainer with Spring expertise should confirm no sidecar anywhere (concepts.yaml, implicit-adrs.md) generates the 'is this @Transactional honoured by the proxy?' question, and decide whether ENG-F2's new stress-category is the right fix vs a pillar gate."
  - "DP-2 — confirm the jOOQ consequence: whether `deCte.field(<absent-name>)` returning null causes a build-time NPE on `.sort(null)` or an execution-time PostgreSQL error, and whether ENG-F1's stress-reach gap is best closed by re-running the Stress Protocol on all 15 jOOQ repositories."
