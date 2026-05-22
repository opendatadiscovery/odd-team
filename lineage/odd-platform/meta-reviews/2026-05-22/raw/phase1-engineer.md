---
panel_run: 2026-05-22
phase: 1
expert: panel-engineer
axis: Depth
commit_anchor: ede5d277
prompt_version: panel-engineer/0.1.0
axis_score: 7
axis_band: AMBER
---

# Phase 1 — Engineer (Depth) assessment

## summary

Where the Stress Protocol has reached, the ontology shows real, source-verified stack mastery: I re-derived the canonical LSN-019 bug (`ReactiveTagRepositoryImpl.listMostPopular`) from primary source and the sidecar's `stress_findings.B1` is correct to the line — `paginate(...)` at `ReactiveTagRepositoryImpl.java:148` truncates by `TAG.ID ASC` BEFORE the `orderBy(COUNT_FIELD.desc())` at line 158, exactly the consequence the methodology was built to catch. The deep channel grew from 3 to 20 sidecars since the maiden run — genuine progress. But the target's Depth conditions (1, 6, 9) are not met: `stress_answers_probe_verified` is still exactly 0, the 88.4% is computed over 379 questions from 20 of 159 enriched sidecars (12.6%), and a new bug landing on the ~139 pre-stress sidecars — including `getPopular.md`, the consumer half of the very canonical-bug surface, still `file-analyser/0.2.0` — meets a sidecar whose depth is real but unstructured and unverified. Depth is proven on the sample; it is asserted, not measured, across the substrate.

## target_lens

The explicit target (`meta-reviews/target.md`) assigns Depth conditions **1, 6, 9**. My bar: (1) the coverage must be deep enough to be *worth trusting* — `stress_verified_pct ≥ 0.80` over *all enriched sidecars*, with the denominator covering ≥ 90% of Stress-trigger-bearing nodes (the deep channel is the norm, not a 20-sidecar sample); (6) the probe loop is *closed* — a PASS probe-run mechanically upgrades the originating sidecar to `PROBE-VERIFIED` and `stress_answers_probe_verified` is non-zero; (9) reverse-engineering rigor — every operator-observable claim is traced end-to-end from the code, never inferred-and-hedged. The methodology is "on track" for Depth when condition 1's stress adoption trends up across `trend.md`; it has "hit" Depth only when 1 and 6 hold together. I grade each probe below on whether the *catching question* exists AND whether the answer is verified to the depth the target demands — not on how knowledgeable the prose sounds.

## stack_depth_probes

- id: DP-1
  idiom_class: reactive
  hypothetical_bug: "A new `@ActivityLog`-annotated write method, or a new `ActivityHandler` impl, implements its `getContextInfo`/`getUpdatedState` DB read via `Mono.fromCallable(() -> blockingJdbcDao.read(...))` OR fires a fire-and-forget `auditMono.subscribe()` for a side-effect. Because `ActivityAspect.monoActivityAspect` runs `joinPoint.proceed()` inside `.flatMap(info -> ...)` under `@ReactiveTransactional` (= `@Transactional(\"reactiveTransactionManager\")`), the R2DBC transaction is carried in the Reactor `Context`. A separately-subscribed `Mono` runs with a fresh empty Context — so the handler's read/write executes OUTSIDE the audit transaction, silently breaking the audit-or-fail atomicity the methodology itself documents as `S-E-3`. (NEW bug — reactive-context-propagation class, distinct from the blocking-call class.)"
  where_it_would_live: "odd-platform-api/.../service/activity/ActivityAspect.java:44-58 + any new service/activity/handler/*ActivityHandler.java"
  ontology_engagement: |
    PARTIAL. `ActivityHandler.md:stress_findings` Category E is genuinely deep — S-E-1 (idempotency, INSERT-not-UPSERT), S-E-3 (transactional coupling: emit failure rolls back the mutation), S-E-6 (READ_COMMITTED snapshot semantics) — all correct. But every one of these *assumes* the whole chain stays in one TX. None asks the prior question: does the Reactor `Context` carrying the R2DBC connection survive the `flatMap(joinPoint.proceed())` operator boundary, and what breaks it? I verified `ReactiveTransactional.java` (meta-annotation on the advice method) and `ActivityAspect.java:44-58` (proceed nested in flatMap) from source. The sidecar names `Mono.deferContextual` only as a passive dependency note ("auth-context lookup pattern"), never as a stress trigger. A new handler that subscribes a Mono separately, or bridges to blocking JDBC, would silently leave the transaction with no error and no test failing — the methodology generates no catching question for it.
  verdict: partial
  evidence: "ActivityAspect.java:44-58 + ReactiveTransactional.java:9-13 (verified) + understanding/...ActivityHandler.md:stress_findings S-E-1/E-3/E-6, dependencies.requires-runtime (deferContextual as dep-note only)"

- id: DP-2
  idiom_class: jooq-sql
  hypothetical_bug: "A new repository method `listStaleByOwner(ownerId, page, size)` is added to power a 'stale entities I own' admin panel. It composes `cteDataEntitySelect` (the same builder `listPopular`/`listByOwner` use), forgetting that `cteDataEntitySelect` (ReactiveDataEntityRepositoryImpl.java:909-939) silently does NOT apply `EXCLUDE_FROM_SEARCH` — so the new panel surfaces entities an operator deliberately hid from the catalog. (NEW method, same idiom class as the live REFACTOR-222 inconsistency.)"
  where_it_would_live: "odd-platform-api/.../ReactiveDataEntityRepositoryImpl.java — a new method composing cteDataEntitySelect"
  ontology_engagement: |
    WOULD-CATCH. `ReactiveDataEntityRepositoryImpl.md` (file-analyser/0.3.0) carries the predicate-application matrix exhaustively: `concepts.entities` names `EXCLUDE_FROM_SEARCH` as "applied in countByState line 448 + getDataEntityDefaultConditions line 974 — NOT applied inside cteDataEntitySelect at lines 909-939", and `tests_coverage_semantic.gaps[1]` anticipates *exactly this regression class*: "A future maintainer adding the predicate to cteDataEntitySelect would unify behaviour but silently change listPopular/listByOwner/listByTerm semantics ... without a regression-catcher test this is invisible." I re-derived from source: `listPopular` at `ReactiveDataEntityRepositoryImpl.java:631-637` composes `cteDataEntitySelect(cteConfig)` with no EXCLUDE_FROM_SEARCH — confirmed. A maintainer reading this sidecar carries the catching question to the new method.
  verdict: would-catch
  evidence: "ReactiveDataEntityRepositoryImpl.java:629-649,909-939 (verified) + understanding/...ReactiveDataEntityRepositoryImpl.md:concepts.entities, tests_coverage_semantic.gaps[1], bugs_limitations[EXCLUDE_FROM_SEARCH]"

- id: DP-3
  idiom_class: react-ts
  hypothetical_bug: "A new modal `LookupTableForm` (or any sibling of `DataSourceForm`) is added by copying the existing form pattern. The maintainer copies the Save button verbatim — `disabled={!isValid}` — so on a slow network a double-click fires TWO POST requests before the first resolves. For a non-idempotent create endpoint without a server-side unique index, this creates two rows. (NEW component, same dispatch-multiplicity / double-invocation idiom class as the live DataSourceForm.)"
  where_it_would_live: "odd-platform-ui/src/components/**/*Form.tsx — any new react-hook-form modal with a submit button"
  ontology_engagement: |
    WOULD-CATCH. `DataSourceForm.md:stress_findings.resource_boundaries` (file-analyser/0.5.0) engages this exactly: "Double-click on Save: the button's `disabled` depends only on `isValid` (DataSourceForm.tsx:153) — it is NOT disabled by `isLoading`. So a fast double-click before the first dispatch resolves can fire TWO POSTs." I verified `DataSourceForm.tsx:146-155` from source — `disabled={!isValid}`, no `isLoading` guard, and `isLoading` drives only the `DialogWrapper` progress bar at line 166. The sidecar also draws the correct consequence (create path → confusing 400 via ODDRN unique index; edit path → idempotent) and `NamespaceAutocomplete.md:bugs[392]` independently engages the `useCallback`-deps-resetting-the-debounce-timer anti-pattern with the right consequence. The React idiom depth on the ~6 covered UI components is real and consequence-correct.
  verdict: would-catch
  evidence: "DataSourceForm.tsx:146-155,166 (verified) + understanding/...DataSourceForm.md:stress_findings.resource_boundaries + NamespaceAutocomplete.md:bugs[useDebouncedCallback]"

- id: DP-4
  idiom_class: jooq-sql
  hypothetical_bug: "A new 'most popular by recency-decayed score' read is added to `DataEntityController` by copying `getPopular`. The maintainer trusts `getPopular.md`'s claim that ranking is `view_count DESC` and never re-checks the SQL truth — but `getPopular` is a `file-analyser/0.2.0` sidecar with NO stress section. A regression that flips `cteDataEntitySelect`'s soft-delete filter, or that changes `getOrderFields` so the `DATA_ENTITY.ID.desc()` tiebreaker fires ASC, silently changes the platform home page's first impression with no test failing. (NEW read of the SAME canonical-bug class as LSN-019 — landing on a node whose sidecar predates the Stress Protocol.)"
  where_it_would_live: "odd-platform-api/.../DataEntityController.java:307-313 + ReactiveDataEntityRepositoryImpl.java:629-649,941-968"
  ontology_engagement: |
    PARTIAL. `getPopular.md` is rich free-text and its claims ARE correct — I re-verified `listPopular` (ReactiveDataEntityRepositoryImpl.java:629-649) and `getOrderFields` (lines 945-967, unconditional `DATA_ENTITY.ID.desc()` tiebreaker at 962-966) line-exact against source. But the sidecar is `prompt_version: file-analyser/0.2.0` with NO `stress_findings` block — its depth lives in unstructured `bugs_limitations_corner_cases` prose. It is one of the 139 `sidecars_pre_stress_protocol`. The catching question for a NEW regression here is NOT channelled into the structured, Category-C ordering interrogation the target's condition 1 measures; `tests_coverage_semantic.gaps` does call for a regression-catcher test, so a careful maintainer is partly armed. The defect: the consumer half of the literal canonical-bug surface (LSN-019 is its sibling) is still on the pre-rev-4 prompt — the Stress Protocol backfill has not reached it.
  verdict: partial
  evidence: "getPopular.md header (prompt_version: file-analyser/0.2.0, no stress_findings) + ReactiveDataEntityRepositoryImpl.java:629-649,945-967 (verified line-exact) + manifest.yaml (sidecars_pre_stress_protocol: 139)"

## findings

- id: ENG-F1
  title: "Depth coverage is a 20-sidecar sample of 159 enriched: a new bug on the other 139 meets an unverified pre-Stress-Protocol sidecar — including getPopular, the canonical-bug surface itself"
  severity: HIGH
  evidence: "manifest.yaml coverage_metrics (sidecars_with_stress_section: 20, sidecars_pre_stress_protocol: 139, nodes_with_own_sidecar: 159) + getPopular.md header (file-analyser/0.2.0, no stress_findings) + HousekeepingTTLProperties.md / ReactiveDataEntityRepositoryImpl.md (0.2.0 / 0.3.0) + target.md condition 1"
  detail: |
    The deep channel grew 3→20 since the maiden run — real progress — but it is 12.6% of the 159 enriched sidecars and the target's condition 1 requires the structured stress channel over *all* enriched sidecars with the denominator covering ≥ 90% of trigger-bearing nodes. DP-2 (would-catch) and DP-4 (partial) both leant on `ReactiveDataEntityRepositoryImpl.md` (0.3.0) and `getPopular.md` (0.2.0): the depth is real and I verified it line-exact, but it is unstructured free-text, not the Category-A-F interrogation the honest axis counts. Most damning: `getPopular` — the consumer half of the *exact* surface class LSN-019 is the case-law for — is still on `file-analyser/0.2.0`. The Stress Protocol backfill has not been prioritised by canonical-bug-class proximity. A new ordering/pagination regression on those 139 nodes is caught only if a maintainer happens to read the free-text prose, not because the structured catching question fires.
  routed_to: approach-rev
  confidence: HIGH

- id: ENG-F2
  title: "The probe loop is still open for Depth: stress_answers_probe_verified = 0 across 379 stress questions and 32 PROBE-NEEDED skeletons"
  severity: HIGH
  evidence: "manifest.yaml coverage_metrics (stress_answers_probe_verified: 0, stress_answers_static_inferred: 335, stress_answers_probe_needed: 32) + target.md condition 6 + ActivityHandler.md:stress_findings (S-E-2 → P-019, S-E-4 → P-018, S-E-5 → P-020 all PROBE-NEEDED, unrun)"
  detail: |
    Target condition 6 (Depth-owned) requires a PASS probe-run to mechanically upgrade the originating sidecar to `PROBE-VERIFIED` and `stress_answers_probe_verified` non-zero. It is exactly 0 — identical to the maiden run despite the stress channel growing 6.7x. 32 analyser-emitted probe-skeletons sit at PROBE-NEEDED. Concrete examples in `ActivityHandler.md`: the OLD-vs-NEW-state capture race (S-E-2 → P-019), the row-order-non-determinism question (S-E-4 → P-018), the system-event NULL-username (S-E-5 → P-020) — all genuinely require runtime observation, all unrun. For an Engineer this is the difference between "I read the SQL and this is the consequence" and "I observed the SQL the database executed." 335 of 379 stress answers are STATIC-INFERRED; the methodology has the mechanism (P-001..P-009 prove the loop CAN close for feature-flow facets) but has not closed it for a single *stress answer*. The honest axis at 88.4% is 88.4% of `STATIC-INFERRED + PROBE-VERIFIED` — and the PROBE-VERIFIED term is zero.
  routed_to: approach-rev
  confidence: HIGH

- id: ENG-F3
  title: "ActivityHandler stress-complete sidecar STILL carries the numeral-vs-list contradiction the 2026-05-21 panel flagged — 'Three of the 27 ... NOT covered' followed by ~10 enum values"
  severity: MEDIUM
  evidence: "understanding/odd-platform__java__service__activity__handler__ActivityHandler.md:concepts.entities (line 32): 'Three of the 27 enum values are NOT covered ... DATA_ENTITY_OVERVIEW_UPDATED, DATA_ENTITY_METADATA_UPDATED, DATA_ENTITY_SCHEMA_UPDATED, DATA_ENTITY_RELATION_UPDATED, CUSTOM_METADATA_CREATED/UPDATED/DELETED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED' + 2026-05-21 phase1-engineer.md ENG-F3 (same finding)"
  detail: |
    The 2026-05-21 panel's engineer raised this exact finding; it is still in the corpus one run later, unfixed. The sentence says "Three" and then lists ten distinct enum values (one of them — `CUSTOM_METADATA_CREATED/UPDATED/DELETED` — itself three values). This is an `enrichment_status: stress-complete`, `confidence_overall: HIGH` sidecar — the most-trusted shape — and the count gates a load-bearing claim (which event types throw `RuntimeException("Can't find handler ...")` at `ActivityServiceImpl.java:263`). A maintainer planning a new `@ActivityLog` event cannot trust the number. That a HIGH-severity, evidence-cited panel finding survived a full run is itself a process signal: panel findings routed `lsn-candidate` are not closing. The defect class — numeral-vs-list-length mismatch in a stress-complete sidecar — needs a non-LLM coherence check (a numeral followed by a comma-list whose length disagrees).
  routed_to: lsn-candidate
  confidence: HIGH

- id: ENG-F4
  title: "Reactive-context-propagation is unprobed everywhere: the @ReactiveTransactional + flatMap(joinPoint.proceed()) Reactor-Context class generates no catching question"
  severity: MEDIUM
  evidence: "ActivityAspect.java:44-58 (verified — @ReactiveTransactional around-advice, joinPoint.proceed() nested in .flatMap) + ReactiveTransactional.java:9-13 (verified — = @Transactional('reactiveTransactionManager')) + ActivityHandler.md:stress_findings Category E (S-E-1/3/6 assume one TX; none interrogates Context survival)"
  detail: |
    The reactive sidecars are strong on TWO reactive sub-classes — the blocking-call trap and transaction *coupling* (does emit-failure roll back the mutation) — but blind to a THIRD: does the Reactor `Context` carrying the R2DBC transaction survive the operator chain? `@ReactiveTransactional` resolves to `@Transactional("reactiveTransactionManager")`; the R2DBC connection is bound to the Context, not a ThreadLocal. A future handler implemented with a separately-subscribed `Mono` (`.subscribe()` fire-and-forget), or a `publishOn` onto a scheduler that a non-Context-aware bridge reads from, runs OUTSIDE the audit transaction — silently, no error. `ActivityHandler.md` mentions `Mono.deferContextual` only as a passive dependency note. DP-1 is `partial` for exactly this reason. This is my own correlated-blind-spot risk too (see independence note) — the trap has no lexical fingerprint, so an LLM tracer pattern-matches the visible `.block()` smell far more readily. A new bug of this class would currently be missed.
  routed_to: new-gate
  confidence: MEDIUM

- id: ENG-F5
  title: "Sidecar provenance is split across four file-analyser prompt versions (0.2.0 / 0.3.0 / 0.4.0 / 0.5.0) with no depth-equivalence between them and no backfill prioritisation"
  severity: LOW
  evidence: "getPopular.md (0.2.0) + HousekeepingTTLProperties.md (0.2.0) + ReactiveDataEntityRepositoryImpl.md (0.3.0) + ActivityHandler.md (0.4.0, stress-complete) + DataSourceForm.md (0.5.0) — all carry confidence_overall: HIGH"
  detail: |
    Five sidecars I read in depth span four prompt versions, and all five are stamped `confidence_overall: HIGH`. A `0.2.0` sidecar (no stress section) and a `0.5.0` sidecar (full Category A-F interrogation + request_inputs) are not equivalent in depth, yet the header gives a consuming maintainer no signal of which interrogation discipline produced the claim. `APPROACH.md` §14 names "Stress Protocol backfill" as a batch theme and `sidecars_pre_stress_protocol` makes the gap *countable* — but the backfill is not sequenced by node criticality or canonical-bug-class proximity (ENG-F1: `getPopular`, the LSN-019 sibling, is still 0.2.0 while UI Data Source components are 0.5.0). A `confidence_overall` band that distinguishes "pre-Stress-Protocol HIGH" from "stress-complete HIGH", plus a backfill order driven by `concepts.yaml` criticality, would let a maintainer read the corpus correctly. Low severity — the underlying depth where I checked is sound — but it is a legibility and prioritisation gap.
  routed_to: backlog-item
  confidence: MEDIUM

## what_went_well

- "The canonical LSN-019 bug is engaged and consequence-correct, verified to the line. `ReactiveTagRepositoryImpl.md:stress_findings.B1` traces `paginate(homogeneousQuery, [(TAG.ID, ASC)], (page-1)*size, size)` at `ReactiveTagRepositoryImpl.java:148` and concludes the candidate pool is `ORDER BY tag.id ASC LIMIT size`-truncated BEFORE the `orderBy(field(COUNT_FIELD).desc())` at line 158. I re-derived from source: `JooqQueryHelper.paginate` (lines 76-83) applies `.orderBy(orderFields).limit(limit).offset(offset)` to the homogeneous query, exactly as the sidecar states. The methodology catches the bug it was built to catch — including the consequence (oldest `size` tags labelled 'most popular'), not just the pattern name."
- "The jOOQ predicate-application matrix is exhaustive and forward-looking. `ReactiveDataEntityRepositoryImpl.md` enumerates EXACTLY which methods apply `EXCLUDE_FROM_SEARCH` (`countByState` line 448, `getDataEntityDefaultConditions` line 974) and which do NOT (`cteDataEntitySelect` lines 909-939) — and `tests_coverage_semantic.gaps[1]` pre-states the regression a future maintainer adding the predicate would cause. That is depth that arms a maintainer against a NEW bug, not just a description of the present."
- "React/TS idiom depth on covered components is genuine and consequence-correct. `DataSourceForm.md:stress_findings.resource_boundaries` catches the `disabled={!isValid}` double-submit (verified at `DataSourceForm.tsx:153`), the REPLACE-not-MERGE edit semantics, and `NamespaceAutocomplete.md` independently engages the `useCallback`-deps-resetting-the-debounce-timer anti-pattern — three distinct React idioms, each with the right operator-visible consequence."
- "The deep stress channel grew 6.7x (3 → 20 sidecars) since the maiden run, and the new Category-E stress findings (`ActivityHandler.md` S-E-1 idempotency, S-E-3 transactional coupling, S-E-6 READ_COMMITTED snapshot semantics) are real operational-depth diagnoses traced to `file:line` — the trajectory of condition 1 is upward."

## axis_score
score: 7
band: AMBER
rationale: |
  Depth rubric: GREEN (8-10) = the ontology demonstrably engages stack idioms and would catch a new bug of MOST classes; AMBER (4-7) = competent at the surface, would miss subtle stack bugs in ≥ 1 class. Two DP probes returned would-catch with source-verified, consequence-correct diagnoses; two returned partial. The would-catch surfaces (jOOQ predicate-matrix, React double-submit) are exactly the everyday traps of this stack and the methodology nails them. Three things hold it at 7, not 8+: (1) DP-1 + ENG-F4 — the reactive axis is two-dimensional (blocking-call + transaction-coupling) where the stack has at least three; the Reactor-Context-propagation class generates no catching question, a genuine would-miss for one reactive sub-class; (2) DP-4 + ENG-F1 — the canonical-bug surface itself (`getPopular`, LSN-019's sibling) is still a `0.2.0` pre-Stress-Protocol sidecar, so a new ordering regression there is caught only by free-text luck; (3) ENG-F2 — `stress_answers_probe_verified` is exactly 0, identical to the maiden run, so the target's condition 6 is not just unmet but un-progressed. Depth is proven where the Stress Protocol has reached (now 20 sidecars — up, real); it is asserted, not measured, across the other 139. That is precisely AMBER: excellent on the sample, not on target across the substrate. Same score as the maiden run because the sample widened but the two target-blocking gaps (probe loop, canonical-surface backfill) did not move.

## independence_self_assessment
shared_blind_spot_risk: |
  I audit Java/Spring/jOOQ/React work produced by a model of my own family, and the sidecars are fluent. My specific correlated-blind-spot risk is ENG-F4's reactive-Context class: the file-analyser did not raise Reactor `Context` propagation across the AOP `flatMap` boundary, and I had to consciously go looking for it — an LLM tracer (me included) pattern-matches the visible `.block()` smell far more readily than the invisible "this operator chain ran with a fresh Context, outside the transaction" smell, because the latter has no lexical fingerprint. It is plausible I under-weighted other fingerprint-less traps (R2DBC connection-per-statement vs per-transaction, jOOQ `fetchLazy` cursor lifetime across a reactive boundary, jOOQ implicit type-coercion in a `text`-vs-enum predicate). I re-derived every cited `file:line` from `REPO_ROOT_ABS` (the LSN-019 chain through `JooqQueryHelper.java:76-83`, `getOrderFields` at `ReactiveDataEntityRepositoryImpl.java:945-967`, the `DataSourceForm.tsx:153` double-submit) rather than grading the prose's confidence — but a second human trace of DP-1's Context-loss claim is warranted.
needs_human_verification:
  - "DP-1 / ENG-F4 — a maintainer with Reactor expertise should confirm whether any EXISTING ActivityHandler impl, or any @ReactiveTransactional write path, already subscribes a Mono separately or bridges to a non-Context-aware call, losing the R2DBC transaction; if one does, ENG-F4 escalates from new-gate to a live bug."
  - "ENG-F2 — confirm the 32 PROBE-NEEDED skeletons (incl. P-018/P-019/P-020 from ActivityHandler) are in a canonical shape the probe-runner can execute, so a stress answer can actually reach PROBE-VERIFIED; an open probe loop is a target-condition-6 blocker."
  - "ENG-F3 — a maintainer should personally count the ActivityEventTypeDto handler coverage; the sidecar's 'Three ... [lists 10]' contradiction means the true uncovered-event-type count is unknown, and that count gates a RuntimeException surface."
