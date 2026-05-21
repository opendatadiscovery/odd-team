---
panel_run: 2026-05-21
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

The ontology demonstrates genuine, source-anchored stack mastery on the surfaces it has reached. Every depth probe below found the catching question already present in a sidecar, traced to the exact `file:line`, and — re-derived from primary source per Rule 2 — the diagnoses are correct, including the consequence, not just the pattern name (jOOQ operator precedence, `.block()` inside a JDBC transaction, `private int` `@ConfigurationProperties` binding to `0`, raw `String.formatted` SQL injection, an untry/catch'd `JSON.parse`). That is the real thing, not transcription wearing its costume. The AMBER (not GREEN) verdict is a **coverage-of-depth** problem the target itself names: per the investigator-log the deep `stress_findings` channel exists in only 3 of 146 sidecars (2.1%), `stress_answers_probe_verified` is 0, and the 88% `stress_verified_pct` is computed over a 25-question denominator from those 3 sidecars — so a new bug in any of the other ~140 nodes meets a `file-analyser/0.2.0`/`0.3.0` sidecar whose depth is real but unverified and not Stress-Protocol-structured. Depth is proven where measured; it is asserted, not measured, across the bulk of the substrate.

## target_lens

The explicit target (`meta-reviews/target.md`) assigns the Depth axis conditions **1** and **6**. My bar: (1) the coverage must be deep enough to be *worth verifying* — `stress_verified_pct ≥ 0.80` computed over *all enriched sidecars*, with that denominator covering ≥ 90% of Stress-trigger-bearing nodes — i.e. the deep channel must be the norm, not a 3-sidecar canary; (6) the probe loop must be *closed* — a PASS probe-run mechanically upgrades the originating sidecar to `PROBE-VERIFIED` and `stress_answers_probe_verified` is non-zero. The methodology is "on track" for Depth when condition 1's stress-section adoption is trending up across `trend.md`; it has "hit" Depth only when 1 and 6 hold together. I hold the methodology to that bar below: I grade each probe on whether the *catching question* exists AND whether the answer is *verified to the depth the target demands*.

## stack_depth_probes

- id: DP-1
  idiom_class: jooq-sql
  hypothetical_bug: "A new repository method `listRecentlyDeleted(page, size)` is added to `ReactiveDataEntityRepositoryImpl` to power an admin 'recently soft-deleted entities' panel. It builds `cteDataEntitySelect` with `.includeDeleted(true)` and an `ORDER BY DATA_ENTITY.STATUS_UPDATED_AT DESC` — but the maintainer forgets `EXCLUDE_FROM_SEARCH` is silently NOT applied inside `cteDataEntitySelect`, so the admin panel surfaces entities an operator deliberately hid from the catalog. (NEW bug; not REFACTOR-222 — a new method of the same idiom class as REFACTOR-222.)"
  where_it_would_live: "odd-platform-api/.../ReactiveDataEntityRepositoryImpl.java — a new method composing cteDataEntitySelect (lines 909-939)"
  ontology_engagement: |
    The ontology generates the catching question with very high fidelity. `ReactiveDataEntityRepositoryImpl.md:invariants[2]` states the predicate-application matrix exhaustively — IS applied in `countByState`/`getDataEntityDefaultConditions`/`resultFacetStateConditions`, NOT applied in `cteDataEntitySelect` (lines 909-939) — and `tests_coverage_semantic.gaps[1]` explicitly anticipates *exactly this regression class*: "A future maintainer adding the predicate to `cteDataEntitySelect` would unify behaviour but silently change `listPopular`/`listByOwner`/`listByTerm` semantics ... without a regression-catcher test". I re-derived from source: `listPopular` at `ReactiveDataEntityRepositoryImpl.java:631-632` composes `cteDataEntitySelect` with no `EXCLUDE_FROM_SEARCH` — confirmed. The sidecar would arm a maintainer to ask "does cteDataEntitySelect filter exclude_from_search?" before shipping the new method.
  verdict: would-catch
  evidence: "ReactiveDataEntityRepositoryImpl.java:631-632 (verified) + understanding/...ReactiveDataEntityRepositoryImpl.md:invariants[2], tests_coverage_semantic.gaps[1]"

- id: DP-2
  idiom_class: spring
  hypothetical_bug: "A new typed-config class `MetricsExportProperties` (`@ConfigurationProperties('metrics.export')` `@Data`) is added with a field `private int batchSize;` to control a metrics-flush batch. An operator deploys with a custom `application.yml` that omits `metrics.export.batch-size`. Spring relaxed-binding binds the primitive `int` to `0`; the flush loop `for (i in 0..batchSize)` becomes a no-op and metrics silently never export. (NEW bug — same Spring `@ConfigurationProperties` primitive-default idiom as the live HousekeepingTTLProperties trap.)"
  where_it_would_live: "odd-platform-api/.../config-properties — any new @ConfigurationProperties POJO with a primitive field"
  ontology_engagement: |
    The ontology generates the catching question and states the GENERAL rule, not just the instance. `HousekeepingTTLProperties.md:invariants[1]` (re-verified against `HousekeepingTTLProperties.java` — `private int resolvedAlertsDays;` etc., Lombok `@Data`, zero `= 30` initializer): "Defaults shipped at the YAML level, NOT the Java level — fields are `private int` primitives with no `= 30` initializer; a deployment with no `application.yml` ... binds `0` and would hard-delete data INSTANTLY". This is the catching question stated as a portable Spring idiom ("operators relying on env-var-only configuration are protected only because the bundled application.yml provides the default — not because the Java code does"). A maintainer who has read one such sidecar carries the question to `MetricsExportProperties`. The depth is genuine — the sidecar engaged `matchIfMissing` semantics, relaxed-binding snake↔camel, and the boot-time-only read, all correctly.
  verdict: would-catch
  evidence: "HousekeepingTTLProperties.java:9-11 (verified, Lombok @Data primitives) + understanding/...HousekeepingTTLProperties.md:invariants[1], requires-config"

- id: DP-3
  idiom_class: reactive
  hypothetical_bug: "A new housekeeping job `OrphanAttachmentHousekeepingJob implements HousekeepingJob` is added. To delete S3 objects it calls a reactive `fileUploadService.deleteFiles(...)` and `.block()`s it inside the `DSL.using(connection).transaction(...)` wrapper — the same shape as DataEntityHousekeepingJob — but ALSO, separately, a maintainer 'optimising' `DataEntityServiceImpl.getDetails` inlines a blocking `.block()` call on a metrics lookup inside the `@ReactiveTransactional` reactive chain, poisoning the Netty event loop. (TWO NEW bugs of the reactive-blocking idiom class — one on the scheduler thread, one on the event loop.)"
  where_it_would_live: "odd-platform-api/.../housekeeping/job/* (scheduler-thread .block) and odd-platform-api/.../service/DataEntityServiceImpl.java (event-loop .block inside @ReactiveTransactional)"
  ontology_engagement: |
    The ontology engages BOTH halves and — critically — draws the CONSEQUENCE distinction correctly (Failure-mode 4 territory). `HousekeepingJobManager.md:coupling` and `bugs_limitations_corner_cases[3]` name the `.block()`-inside-`DSL...transaction()` anti-pattern (re-verified: `DataEntityHousekeepingJob.java:71` transaction wrap + `:142` `.block()`), AND correctly reason that because the `@Scheduled` invocation runs on Spring's task-scheduler pool "it does not deadlock the HTTP surface — but the architectural smell remains" + "no `.block(Duration)` → a hung MinIO call hangs the cycle until the 14m ShedLock expires". For the event-loop half, `DataEntityServiceImpl.md:understanding` explicitly verified the *negative*: "pure reactive (zero `.block()`/`.blockOptional()` calls — verified by grep) so the batch-D anti-pattern is NOT present here" — i.e. the ontology has a maintained, grep-anchored invariant that a new `.block()` here would violate. A maintainer reading these two sidecars would catch both new bugs and correctly distinguish "stalls a worker" from "poisons the event loop".
  verdict: would-catch
  evidence: "DataEntityHousekeepingJob.java:71,142 (verified) + understanding/...HousekeepingJobManager.md:bugs_limitations_corner_cases[3] + understanding/...DataEntityServiceImpl.md:understanding"

- id: DP-4
  idiom_class: react-ts
  hypothetical_bug: "A new lineage feature persists a saved filter set in the URL as `?flt=` carrying a JSON-encoded object. `HierarchyLineage` (or a sibling) reads it with `JSON.parse(flt)` inside a `useMemo` to seed initial state — the maintainer copies the existing `?t=` transform-matrix pattern verbatim. A user hand-edits or an old shared link carries a malformed `?flt=`, `JSON.parse` throws synchronously inside render, and the whole Lineage React subtree white-screens with no error boundary. (NEW bug — a new URL param of the SAME unguarded-JSON.parse idiom class.)"
  where_it_would_live: "odd-platform-ui/src/components/DataEntityDetails/Lineage/HierarchyLineage/HierarchyLineage.tsx (and any new query-param consumer)"
  ontology_engagement: |
    The ontology already found the EXACT instance and pinned the line. `LineageGraph.md:security.known_security_gaps` (last bullet): "The `?t=` URL param accepts `JSON.parse(t)` (HierarchyLineage.tsx:85) without try/catch — a malformed value ... throws and crashes the React tree. severity: LOW". I re-derived from source: `HierarchyLineage.tsx:84-88` is `const setInitialTransform = React.useMemo<TransformMatrix>(() => { if (t) return JSON.parse(t) as TransformMatrix; return initialTransformMatrix; }, [t, initialTransformMatrix]);` — bare `JSON.parse`, no try/catch, inside `useMemo`, no error boundary in the rendered tree (verified the component returns `<S.Container>` with no `ErrorBoundary`). The sidecar got the file, the line, the mechanism and the blast radius right. A maintainer copying the `?t=` pattern to `?flt=` has the catching question pre-loaded. The same sidecar also independently invents the `?d=` clamp gap and the diamond-DAG amplification — forward-looking, not LSN-recall.
  verdict: would-catch
  evidence: "HierarchyLineage.tsx:84-88 (verified — bare JSON.parse in useMemo) + understanding/...LineageGraph.md:security.known_security_gaps, bugs_limitations_corner_cases"

## findings

- id: ENG-F1
  title: "Depth coverage is a 3-sidecar canary: the deep stress channel reaches 2.1% of sidecars; a new bug outside it meets an unverified 0.2.0/0.3.0 sidecar"
  severity: HIGH
  evidence: "lineage/odd-platform/investigator-log.md (Batch VAL-LSN-019: 'sidecars_with_stress_section: 3/146 = 2.1%', 'sidecars_pre_stress_protocol: 143/146 = 97.9%') + manifest.yaml coverage_metrics (sidecars_with_stress_section: 3, stress_questions_total: 25) + target.md condition 1"
  detail: |
    All four DP probes hit would-catch — but the three deepest sidecars I leaned on (HousekeepingJobManager, DataEntityServiceImpl, ReactiveDataEntityRepositoryImpl) are `file-analyser/0.3.0`/`0.4.0` and the Stress-Protocol `stress_findings` channel that the target's condition 1 measures exists in only 3 of 146 sidecars. The target requires `stress_verified_pct ≥ 0.80` over *all enriched sidecars* with the denominator covering ≥ 90% of Stress-trigger nodes; today the 88% is over 25 questions from 3 sidecars. The other ~140 sidecars are deep in the older free-text shape — my probes show that depth is real, but it is not the *structured, gap-channelled* depth the target's honest-coverage axis counts, and a new bug landing on a `0.2.0` sidecar (e.g. `getPopular.md`, prompt_version 0.2.0) gets a less systematically stress-tested sidecar. This is the single biggest gap between "Depth proven where measured" and "Depth on target".
  routed_to: approach-rev
  confidence: HIGH

- id: ENG-F2
  title: "The probe loop is open for Depth: stress_answers_probe_verified = 0 — no deep claim has been mechanically upgraded to PROBE-VERIFIED"
  severity: HIGH
  evidence: "manifest.yaml coverage_metrics (stress_answers_probe_verified: 0, stress_answers_static_inferred: 22, stress_answers_probe_needed: 1) + target.md condition 6 + investigator-log.md ('22 STATIC-INFERRED + 0 PROBE-VERIFIED out of 25')"
  detail: |
    Target condition 6 (a Depth-owned condition) requires the probe loop closed — a PASS probe-run upgrades the originating sidecar to `PROBE-VERIFIED` and `stress_answers_probe_verified` is non-zero. It is exactly 0. The deepest stress findings (the LSN-019 `listMostPopular` pagination-before-ranking trace, the tie-break-at-equal-counts question) are STATIC-INFERRED or PROBE-NEEDED; probe-skeletons P-010 and 8 narrative `P-LSN019-*.md` files exist but have not been run, and the investigator-log records the 8 are in a non-canonical `.md` shape probe-runner cannot execute. For an Engineer this matters concretely: a STATIC-INFERRED jOOQ-precedence claim is a senior engineer's reading; a PROBE-VERIFIED one is the SQL actually observed. The methodology has the mechanism (P-001..P-009 probe-runs prove the loop CAN close for feature-flow facets) but has not closed it for a single *stress answer*.
  routed_to: approach-rev
  confidence: HIGH

- id: ENG-F3
  title: "ActivityHandler sidecar — internally contradictory enumeration: 'Three of the 27 enum values are NOT covered' followed by a list of ~10 values"
  severity: MEDIUM
  evidence: "understanding/odd-platform__java__service__activity__handler__ActivityHandler.md:concepts.entities — 'Three of the 27 enum values are NOT covered by any concrete handler in this directory: DATA_ENTITY_OVERVIEW_UPDATED, DATA_ENTITY_METADATA_UPDATED, DATA_ENTITY_SCHEMA_UPDATED, DATA_ENTITY_RELATION_UPDATED, CUSTOM_METADATA_CREATED/UPDATED/DELETED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED'"
  detail: |
    The sentence says "Three" and then lists ten distinct enum values. This is a `stress-complete` sidecar (`file-analyser/0.4.0`, `enrichment_status: stress-complete`, `confidence_overall: HIGH`) — the most-trusted shape in the corpus — yet carries a bare arithmetic self-contradiction in a load-bearing claim (which event types throw `RuntimeException("Can't find handler ...")` at `ActivityServiceImpl.java:263`). A maintainer planning a new `@ActivityLog` event cannot trust the count. This is a Failure-mode-4 risk (a correctly-named pattern with a wrong number attached) and it survived into a stress-complete sidecar — evidence that the depth review does not have an internal consistency gate. The fix is a coherence check that flags numeral-vs-list-length mismatch; routed as an LSN candidate because it is a *class* of defect, not one typo.
  routed_to: lsn-candidate
  confidence: HIGH

- id: ENG-F4
  title: "No reactive-context-propagation idiom is probed anywhere: @ReactiveTransactional + flatMap(joinPoint.proceed()) context-loss class is unexamined"
  severity: MEDIUM
  evidence: "ActivityAspect.java:43-48 (verified — @ReactiveTransactional around-advice; getContextInfo().flatMap(info -> joinPoint.proceed())) + ReactiveTransactional.java (verified — meta-annotation = @Transactional('reactiveTransactionManager')) + grep: zero 'contextWrite'/'deferContextual'/'Context' findings cited in any sidecar"
  detail: |
    The reactive sidecars are strong on the blocking-call trap (DP-3) but the ontology never engages the OTHER first-class reactive trap the target's Rule-1 list names: transactional/Reactor-context propagation across operator boundaries. `@ReactiveTransactional` resolves to `@Transactional("reactiveTransactionManager")` and `ActivityAspect.monoActivityAspect` threads the wrapped mutation through `getContextInfo(...).flatMap(info -> { joinPoint.proceed() ... })` — a real surface where a future maintainer adding a `publishOn`/`subscribeOn` or a `Mono.fromCallable` without `contextWrite` would silently run the inner mutation OUTSIDE the R2DBC transaction context, losing atomicity with no error. No sidecar (ActivityHandler, ActivityServiceImpl, HousekeepingJobManager) asks "does this operator chain preserve the transaction context?". A NEW bug of this class would currently be MISSED — the ontology's reactive depth is single-axis (blocking) where the stack has at least two (blocking + context).
  routed_to: new-gate
  confidence: MEDIUM

- id: ENG-F5
  title: "Static-inference confidence is uniformly stamped HIGH with no calibration band for inference-only depth claims"
  severity: LOW
  evidence: "understanding/...ReactiveDataEntityRepositoryImpl.md, HousekeepingJobManager.md, DataEntityServiceImpl.md, ActivityHandler.md all carry 'confidence_overall: HIGH' header; per-finding 'confidence: HIGH' on STATIC-INFERRED bugs_limitations entries + manifest stress_answers_probe_verified: 0"
  detail: |
    Every deep sidecar I read is `confidence_overall: HIGH`, and STATIC-INFERRED findings inside them also carry `severity`/HIGH without distinguishing "I read the SQL and this WILL happen" from "I read the SQL and this is the likely consequence". The probes show the inferences are in fact correct — but the methodology has no band that says "deep, plausible, NOT probe-confirmed". Condition 6 being open (ENG-F2) means HIGH is currently doing double duty. A `confidence: HIGH-STATIC` vs `HIGH-PROBE-VERIFIED` split (or surfacing the per-claim `stress_answer` verification state into the sidecar header) would let a consuming maintainer see at a glance which depth claims are observed vs reasoned. Low severity because the underlying depth is sound; it is a calibration/legibility gap, not an error.
  routed_to: approach-rev
  confidence: MEDIUM

## what_went_well

- "jOOQ operator-precedence depth is exact and consequence-correct. `HousekeepingTTLProperties.md:invariants[6]` and `HousekeepingJobManager.md:bugs_limitations_corner_cases[2]` diagnose `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` as emitting `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND ... <= cutoff)` — verified verbatim against `AlertHousekeepingJob.java:30-34`. The sidecar drew the right consequence (manual RESOLVED rows purged on the next 15-min cycle regardless of TTL) and even gave the parenthesised fix. This is the canonical stack-idiom bug and the ontology nails it."
- "The ShedLock-window arithmetic is genuine operational depth. `HousekeepingJobManager.md` reasons from `@Scheduled(fixedRate=15, MINUTES)` + `@SchedulerLock(lockAtLeastFor='14m', lockAtMostFor='14m')` (verified at `HousekeepingJobManager.java:25-26`) to a 60-second slack window and a concrete two-instance race for a ≥14-min cycle — a Spring-scheduling trap a senior engineer would raise, surfaced autonomously."
- "The ontology maintains grep-anchored NEGATIVE invariants. `DataEntityServiceImpl.md` records 'zero `.block()` calls — verified by grep' as a standing invariant — a maintained tripwire that turns a future `.block()` insertion into a detectable contradiction. This is exactly the depth posture the panel wants: not just describing what is there, but pinning what must stay absent."
- "Source fidelity is consistently line-exact. Across `getHighlightedResult` (raw `String.formatted` SQL injection, `ReactiveDataEntityRepositoryImpl.java:799-806`), `listPopular` `(page-1)*size` negative-offset (`:631-632`), and `HierarchyLineage` unguarded `JSON.parse` (`:84-88`), every line number I re-checked was correct — the sidecars are anchored to primary source, not paraphrasing it."

## axis_score
score: 7
band: AMBER
rationale: |
  Depth rubric: GREEN (8-10) = the ontology demonstrably engages stack idioms and would catch a new bug of MOST classes; AMBER (4-7) = competent at the surface, would miss subtle stack bugs in ≥ 1 class. All four DP probes returned would-catch with source-verified, consequence-correct diagnoses — that alone argues for the top of AMBER or low GREEN, and the engaged surfaces (jOOQ precedence, Spring config-binding, reactive blocking-call, React JSON.parse) are exactly the everyday traps of this stack. Two things hold it at 7, not 8+: (1) ENG-F4 — the reactive axis is single-dimensional: the ontology catches blocking-call bugs but does not engage the transactional/Reactor-context-propagation class, a genuine "would-miss" for one sub-class of the reactive idiom; (2) ENG-F1 + ENG-F2 — the target's own Depth conditions (1 and 6) are not met: the deep stress channel is a 2.1% canary and `stress_answers_probe_verified` is 0, so the depth I verified is real but is not yet the *measured, probe-closed* depth the explicit target demands. Depth is proven where the methodology has reached; it is not yet proven to be the norm. That is precisely AMBER: excellent on the sample, not yet on target across the substrate.

## independence_self_assessment
shared_blind_spot_risk: |
  I audit Java/Spring/jOOQ/React work produced by a model of my own family, and the sidecars are fluent. My specific correlated-blind-spot risk is the reactive-context class (ENG-F4): the file-analyser did not raise Reactor `Context`/`contextWrite` propagation, and I had to consciously go looking for it — an LLM tracer (me included) pattern-matches the visible `.block()` smell far more readily than the invisible "this operator chain silently dropped the transaction context" smell, because the latter has no lexical fingerprint. It is plausible I under-weighted other context-less-fingerprint traps (e.g. R2DBC connection-per-statement vs per-transaction semantics, jOOQ `fetchLazy` cursor lifetime across a reactive boundary) for the same reason. I also verified all DP probes as would-catch — a maintainer should sanity-check that I did not grade the *prose's* confidence rather than re-derive: I did re-derive every cited line from `REPO_ROOT_ABS`, but a second human trace of DP-3's event-loop-vs-scheduler-thread claim would harden it.
needs_human_verification:
  - "DP-3 — a maintainer with reactor expertise should confirm that the `@Scheduled` housekeeping `.block()` truly runs off the Netty event loop on this Spring Boot 3 / WebFlux config (the sidecar asserts the task-scheduler pool; the consequence severity hinges on it)."
  - "ENG-F4 — a maintainer should personally check whether any existing `@ReactiveTransactional` chain (ActivityAspect, DataEntityServiceImpl write paths) already loses transaction context across a `flatMap`/`publishOn` boundary; if one does, ENG-F4 escalates from new-gate to a live bug."
  - "ENG-F2 — confirm the 8 `P-LSN019-*.md` narrative probe-skeletons can be converted and run so a stress answer can actually reach PROBE-VERIFIED; the open probe loop is a target-condition-6 blocker."
