---
panel_run: 2026-05-22
phase: 1
expert: panel-skeptic
axis: Honesty
commit_anchor: ede5d277
prompt_version: panel-skeptic/0.1.0
high_conf_sampled: 8
high_conf_falsified: 0
axis_score: 5
axis_band: AMBER
---

# Phase 1 — Skeptic (Honesty) assessment

## summary

Sampled 8 HIGH-confidence and STATIC-INFERRED claims across two generations of sidecars
(file-analyser/0.2.0 and file-analyser/0.5.0); all 8 hold under primary-source falsification —
no confidently-wrong assertions found. The manifest's `stress_verified_pct: 88.4%` is
arithmetically accurate but structurally misleading against the target's condition 1: it is
computed over only 20 of 159 enriched sidecars (12.6%), not the ≥ 90% the target requires.
The 139 pre-Stress-Protocol sidecars contribute zero questions to the denominator; the metric
is a precise measurement of a small island. The probe-runner feedback loop remains closed:
`stress_answers_probe_verified: 0` and all 68+ probe files carry `status: pending-stress-protocol`
with no mechanism to write outcomes back to sidecar labels. The LOW-confidence / PROBE-NEEDED
pile has grown from 9 to 32 items since the prior run and remains fully unresolved.

## target_lens

The Honesty axis owns target conditions 1, 2, 8, and 9. For condition 1, the bar is:
`stress_verified_pct ≥ 0.80` computed over a denominator covering `≥ 90%` of substrate nodes
carrying Stress-Protocol triggers. At this run, 20 of 159 enriched sidecars have a stress
section (12.6%) — the denominator condition is not met; condition 1 is therefore not satisfied
regardless of the 88.4% within-scope figure. For condition 2, the bar is: every `status: closed`
LSN carries closure evidence (a probe-run or scan-pass); no closed LSNs exist yet, so this
condition is vacuously unverifiable. For condition 8, the bar is: ≥ 3 panel runs exist with a
non-decreasing trend; this run is the third, but the trend.md scorecard still shows two rows
(the maiden lite run and the first full run), so the third data point is not yet in the record.
For condition 9 (reverse-engineering rigor), the bar is: no sidecar claim rests on a banned-phrase
hedge where the code was traceable. Sampled sidecars meet this bar — claims carry file:line evidence.

## calibration_probes

- id: CAL-1
  claim: "ranking is exclusively `view_count DESC, id DESC` — no signal-mixing, no time-decay"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md:implicit_adrs.[0] — confidence: HIGH"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read ReactiveDataEntityRepositoryImpl.java lines 629-649. Checked whether the cteConfig
    builder has any .orderBy call beyond VIEW_COUNT.sort(SortOrder.DESC), and whether
    getOrderFields at lines 945-967 adds any ranking signal beyond the id DESC tiebreaker.
    Boundary test: checked if any auth-mode-specific override or service-layer re-sort exists.
  source_evidence: "ReactiveDataEntityRepositoryImpl.java:633 — `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))` as the sole cteConfig orderBy call. DataEntityServiceImpl.java:227-231 — no re-sort. Line 645 — outer .orderBy(getOrderFields(cteConfig, deCte)) adds only the id DESC tiebreaker per lines 945-967. Claim holds exactly."
  verdict: holds

- id: CAL-2
  claim: "HousekeepingJobManager fires at fixedRate=15min with lockAtLeastFor=14m and lockAtMostFor=14m"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__service__HousekeepingJobManager.md:implicit_adrs.[2] — confidence: HIGH"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read HousekeepingJobManager.java lines 25-26. Checked the exact numeric values for
    fixedRate, lockAtLeastFor, lockAtMostFor. Checked whether a timeUnit attribute is present
    (it is — TimeUnit.MINUTES). Boundary: are the lock values equal or do they differ?
  source_evidence: "HousekeepingJobManager.java:25 — `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)`. Line 26 — `@SchedulerLock(name = \"housekeepingJob\", lockAtLeastFor = \"14m\", lockAtMostFor = \"14m\")`. Both lock bounds are 14m. Claim holds."
  verdict: holds

- id: CAL-3
  claim: "@ConditionalOnProperty on HousekeepingJobManager has no matchIfMissing attribute — strict opt-in if the key is absent"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__service__HousekeepingJobManager.md:implicit_adrs.[3] — confidence: HIGH"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read HousekeepingJobManager.java line 18. Checked for the presence or absence of
    matchIfMissing. Spring's @ConditionalOnProperty has this attribute available; its
    absence means the condition is false when the key is missing from config.
  source_evidence: "HousekeepingJobManager.java:18 — `@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` — no matchIfMissing attribute present. Claim holds."
  verdict: holds

- id: CAL-4
  claim: "getPopularTagList ordering: inner paginate uses TAG.ID ASC before count, so directories > size return the OLDEST size tags (LSN-019 drift)"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__TagController__controller-method__getPopularTagList.md:stress_findings.name_behavior_pairs[0] — confidence: STATIC-INFERRED"
  claimed_confidence: HIGH (STATIC-INFERRED)
  falsification_attempt: |
    Read ReactiveTagRepositoryImpl.java lines 137-167. Checked the paginate call at line 148
    for the OrderByField argument. Attempted to find any secondary sort key in the outer
    cteSelect.orderBy at line 158. Boundary: does the outer COUNT_FIELD.desc() have any
    secondary field that could rescue newer tags from exclusion?
  source_evidence: "ReactiveTagRepositoryImpl.java:148 — `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)`. Line 158 — `cteSelect.orderBy(field(COUNT_FIELD).desc())` — single-field outer sort, no secondary key rescues excluded rows. Claim holds. The LSN-019 drift is confirmed at source."
  verdict: holds

- id: CAL-5
  claim: "soft-deleted entities are excluded from listPopular because cteConfig omits .includeDeleted(true), unlike getDataEntityDetails which sets it explicitly"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md:implicit_adrs.[2] — confidence: HIGH"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read ReactiveDataEntityRepositoryImpl.java lines 629-634 (listPopular cteConfig builder)
    and compared with line 220 (the getDetails path). Checked cteDataEntitySelect lines 909-917
    for the branch that applies addSoftDeleteFilter when includeDeleted is false.
  source_evidence: "ReactiveDataEntityRepositoryImpl.java:631-634 — cteConfig builder has .limitOffset and .orderBy but NO .includeDeleted call. Line 220 — getDetails path sets .includeDeleted(true). Lines 909-917 — cteDataEntitySelect applies addSoftDeleteFilter when includeDeleted flag is false/missing. Claim holds — asymmetry is real."
  verdict: holds

- id: CAL-6
  claim: "getPopularTagList open-read posture: no GET SecurityRule for /api/tags in SecurityConstants.SECURITY_RULES — falls through to authenticated() catch-all"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__TagController__controller-method__getPopularTagList.md:stress_findings.auth_gates — confidence: STATIC-INFERRED"
  claimed_confidence: HIGH (STATIC-INFERRED)
  falsification_attempt: |
    Read SecurityConstants.java lines 138-142. Looked for any GET rule on /api/tags or
    a pattern that would match GET /api/tags. Boundary: could a wildcard rule for /api/tags/**
    cover the GET case?
  source_evidence: "SecurityConstants.java:138-142 — three entries for /api/tags: POST (TAG_CREATE), PUT /api/tags/{tag_id} (TAG_UPDATE), DELETE /api/tags/{tag_id} (TAG_DELETE). No GET entry for /api/tags or /api/tags/**. AuthorizationCustomizer.java:29-30 — catch-all pathMatchers(\"/**\").authenticated(). Claim holds."
  verdict: holds

- id: CAL-7
  claim: "no index on data_entity.view_count — verified across all Liquibase migration files"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md:bugs_limitations_corner_cases.[4] — confidence: HIGH (via bugs section)"
  claimed_confidence: HIGH
  falsification_attempt: |
    Searched all Liquibase migration files for any CREATE INDEX statement referencing view_count.
    The sidecar asserts this was verified by grep across 91 migration files.
  source_evidence: "grep -rn 'view_count' ../odd-platform/odd-platform-api/src/main/resources/db/migration — returns hits only in V0_0_10__add_counters.sql (column add with DEFAULT 0) and V0_0_37__update_view_count.sql (NOT NULL constraint). No CREATE INDEX on view_count in any migration file. Claim holds."
  verdict: holds

- id: CAL-8
  claim: "DataEntityHousekeepingJob calls fileUploadService.deleteFiles(filePojos).block() inside a jOOQ transaction — reactive Mono blocked inside JDBC transaction"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__service__HousekeepingJobManager.md:bugs_limitations_corner_cases.[2] — confidence: MEDIUM (but factual claim within the MEDIUM severity finding)"
  claimed_confidence: MEDIUM
  falsification_attempt: |
    Read DataEntityHousekeepingJob.java lines 71 and 142. Checked whether the .block() call
    is literally inside the DSL.using(connection).transaction(ctx -> {...}) lambda.
    Boundary: does the transaction lambda extend to line 142, or does deleteFiles run outside?
  source_evidence: "DataEntityHousekeepingJob.java:71 — `jooq.transaction(ctx -> {` opens the transaction. Line 142 — `fileUploadService.deleteFiles(filePojos).block()` is inside the lambda body. Claim holds — the .block() is inside the JDBC transaction context."
  verdict: holds

## metric_honesty

headline_metric_used: "The manifest presents `stress_verified_pct: 88.4%` as the headline honest
axis. coverage.py source code at lines 66-82 explicitly labels the node-with-sidecar ratio as
'vanity' and the stress axis as 'honest'. This framing is correct in intent. However, the
denominator the headline number is computed over is structurally narrow."

gaming_check: |
  THE DENOMINATOR CONDITION IS NOT MET. Target condition 1 requires `stress_verified_pct ≥ 0.80`
  computed over a denominator of all enriched sidecars covering ≥ 90% of substrate nodes that
  carry Stress-Protocol triggers. At this run:
  - sidecars_with_stress_section: 20
  - sidecars_pre_stress_protocol: 139
  - total enriched sidecars: 159
  - Stress-Protocol adoption among enriched nodes: 20/159 = 12.6%

  The 88.4% figure is arithmetically correct over the 379 questions in the 20 stress-enabled
  sidecars. But those 20 sidecars represent 12.6% of the enriched corpus. The 139
  pre-Stress-Protocol sidecars — authored under file-analyser/0.2.0 before Rule 9 landed —
  contribute zero questions to the denominator. Coverage.py's render_dashboard correctly calls
  these out as "Pre-Stress-Protocol (authored before file-analyser/0.4.0)" and flags them as
  needing backfill (coverage.py:293-294). The condition is structurally unmet.

  This is not a gaming of the metric by the system — coverage.py explicitly calls the older
  sidecars out, and the manifest carries the sidecars_pre_stress_protocol: 139 count. The
  problem is that the headline 88.4% sounds like near-full-coverage to a maintainer reading
  the manifest, when it covers 12.6% of enriched nodes.

  PROBE-VERIFIED PERMANENTLY 0. The numerator of the honest axis includes
  PROBE-VERIFIED counts. All 68+ probe files carry `status: pending-stress-protocol`;
  manifest confirms stress_answers_probe_verified: 0. No mechanism upgrades sidecar labels
  from PROBE-NEEDED to PROBE-VERIFIED after a probe run executes. The stress protocol's
  verification tier cannot grow.

  The stress questions themselves are substantive. Sampled questions from the TagController
  and HousekeepingJobManager sidecars cover: exact SQL ordering semantics, boundary behavior
  at page=0 / size=-1, per-auth-mode response differences, degenerate-input NullPointerException
  propagation, transaction boundary semantics, ShedLock race window. Not trivially padded.

verdict: flatters

## low_confidence_rot

sampled: 12
resolved_over_batches: 0
stale: 12
verdict: rotting

The manifest records stress_answers_probe_needed: 32. These span probes P-001 through P-089
(68+ probe files) all with `status: pending-stress-protocol`. The pool has grown from 9
(previous run) to 32 PROBE-NEEDED items in the manifest. Zero resolutions have occurred.
The probe runner infrastructure exists (P-010.yaml is a well-structured Testcontainers probe
with arrange/act/assert) but nothing executes it and nothing writes outcomes back to sidecar
labels. Probe P-024 uniquely carries `status: pending-reflection-verification` rather than
`pending-stress-protocol` — this is a distinct state variant, not a resolution. The LOW-confidence
doc-link items (confidence: LOW on inferred_docs where WebFetch was deferred) also remain
unresolved: they accumulated across batches with no staleness-based resolution trigger.

## findings

- id: SKE-F1
  title: "stress_verified_pct denominator covers 12.6% of enriched sidecars — target condition 1 not met"
  severity: HIGH
  evidence: "manifest.yaml: sidecars_with_stress_section: 20, sidecars_pre_stress_protocol: 139, total enriched: 159; target.md condition 1: 'denominator covers ≥ 90% of substrate nodes that carry Stress-Protocol triggers'"
  detail: |
    The 88.4% headline figure is arithmetically correct over the 379 questions in 20 sidecars.
    But 139 of 159 enriched sidecars were authored under file-analyser/0.2.0 before the
    Stress Protocol's Rule 9 was introduced, and they carry no stress_findings section.
    Coverage.py correctly flags them as "Pre-Stress-Protocol" and counts them under
    sidecars_pre_stress_protocol. The target's condition 1 requires the denominator to cover
    ≥ 90% of substrate nodes carrying Stress-Protocol triggers. At 12.6% adoption the
    condition is not met. A maintainer reading "88.4% stress-verified" would conclude the
    ontology is near-fully interrogated; the reality is that 87.4% of enriched nodes have
    never been through the Stress Protocol at all. The fix is batch backfill of the 139 older
    sidecars under file-analyser/0.4.0 or later. Progress is observable via the
    sidecars_pre_stress_protocol counter decreasing over runs.
  routed_to: approach-rev
  confidence: HIGH

- id: SKE-F2
  title: "Probe-runner feedback loop closed — PROBE-VERIFIED permanently 0, 32 PROBE-NEEDED items accumulate"
  severity: HIGH
  evidence: "manifest.yaml: stress_answers_probe_verified: 0, stress_answers_probe_needed: 32; all 68+ probe files in lineage/odd-platform/probes/ carry status: pending-stress-protocol; no probe carries outcome: PASS or FAIL"
  detail: |
    The stress_verified_pct numerator is (STATIC-INFERRED + PROBE-VERIFIED) / total. The
    PROBE-VERIFIED tier is permanently 0 because no mechanism propagates a probe run's
    outcome back into the sidecar's confidence label. Probe P-010 is a well-structured
    Testcontainers integration test with arrange/act/assert; it would confirm or deny the
    LSN-019 ordering drift at the REST boundary. But even if it were executed today, there
    is no schema field on the sidecar to record the result, and coverage.py reads only the
    `confidence: PROBE-NEEDED` label in the stress_findings section — it cannot see an
    external probe-run outcome file. Target condition 6 ("A probe-run with outcome: PASS
    mechanically upgrades its originating sidecar's confidence to PROBE-VERIFIED;
    stress_answers_probe_verified is non-zero") is unmet. This is the same finding as
    SKE-F3 in the prior run; it has not been resolved across the interval.
  routed_to: new-gate
  confidence: HIGH

- id: SKE-F3
  title: "stress_verified_pct includes REFERENCE answers (12) in the unverified denominator — these are not verified"
  severity: MEDIUM
  evidence: "manifest.yaml: stress_answers_reference: 12; coverage.py lines 143-147: unanswered = PROBE-NEEDED + REFERENCE — REFERENCE is counted as unanswered; stress_verified_pct formula at line 143: verified = STATIC-INFERRED + PROBE-VERIFIED (REFERENCE correctly excluded from numerator)"
  detail: |
    Coverage.py correctly excludes REFERENCE answers from the verified numerator and includes
    them in the unanswered count (lines 143-147). However the manifest carries
    stress_unanswered_pct: 11.6% which combines PROBE-NEEDED (32) and REFERENCE (12) = 44
    unanswered. The REFERENCE answers are deferred to other sidecars — the question at the
    node boundary is not answered until the referenced sidecar resolves it. All 12 REFERENCE
    items are in the stress-enabled sidecars (20 nodes); their count inflates the denominator
    without contributing to either verification tier. This is not gaming — the code handles
    it correctly and the dashboard displays it — but a maintainer reading the 88.4% figure
    without the unanswered breakdown might not notice that 12 of 379 questions are deferred
    across node boundaries with no tracked resolution.
  routed_to: backlog-item
  confidence: MEDIUM

- id: SKE-F4
  title: "Low-confidence doc-link items accumulate with no staleness resolution trigger"
  severity: LOW
  evidence: "Sampled: getPopular.md:docs_link_semantic.inferred_docs[0] confidence: LOW, last_verified_at: 2026-05-12; HousekeepingJobManager.md:docs_link_semantic.inferred_docs[1] confidence: LOW, last_verified_status: not-fetched-this-session"
  detail: |
    Multiple sidecars carry inferred_docs entries with confidence: LOW because a WebFetch
    deferred or timed out during enrichment. The last_verified_at timestamps are 10+ days old
    with no re-verification scheduled. There is no staleness-trigger in the enrichment pipeline
    that re-queues a doc-link for verification once its last_verified_at exceeds a threshold.
    These LOW-confidence items are correctly labelled (the doc links may be valid — LOW means
    unverified, not broken). The issue is that they silently persist across batches without
    a resolution path. This is an honest label correctly applied, but the label has become a
    permanent parking state rather than a tracked-toward-resolution state.
  routed_to: backlog-item
  confidence: MEDIUM

## what_went_well

- "All 8 HIGH-confidence and STATIC-INFERRED factual claims hold under primary-source falsification. The file:line citations are accurate and the boundary claims (e.g. the soft-delete-asymmetry between listPopular and getDataEntityDetails) are non-trivial and correct. Zero confidently-wrong assertions across two sidecar generations."
- "Coverage.py explicitly and correctly labels the stress_verified_pct as the honest axis and nodes_with_sidecar/total as the vanity axis (lines 66-82, 256-300). The system knows which metric matters and makes the distinction visible in both code and dashboard output — the honesty failure is in the denominator scope, not in the labelling."
- "The TagController getPopularTagList sidecar (file-analyser/0.5.0) demonstrates the calibration pattern working correctly: STATIC-INFERRED claims with file:line evidence for every answer, PROBE-NEEDED reserved for runtime-confirmable behaviors (null/negative-page exact HTTP status), and a REFERENCE label for a claim that must be resolved at another node. The calibration is honest and appropriately differentiated."
- "The HousekeepingJobManager sidecar correctly distinguishes three separate HIGH-confidence implicit ADRs (per-job failure isolation, shared connection, ShedLock 14m window) with distinct intent anchors, none of which fail falsification. The analytical depth is substantive."
- "Coverage.py's integrity audit (sidecars_in_substrate-but-not-in-sidecar, nodes_in_sidecar_but_not_in_substrate) makes the substrate-sidecar alignment visible and non-gamed. The reported 5-item orphan sample in prior runs has not grown — the substrate integrity is stable."

## axis_score

score: 5
band: AMBER
rationale: |
  Zero HIGH-confidence factual claims fail falsification across 8 sampled targets (2 sidecars,
  2 generations). This is the most important calibration signal and it is clean — no
  confidently-wrong assertions, citations resolve, boundary claims verified.

  Two structural honesty failures hold from the prior run and prevent a GREEN score:

  (1) Target condition 1 denominator unmet — 12.6% Stress-Protocol adoption (up from 5.4%
  in the prior run — progress from 8 to 20 stress-enabled sidecars). The target requires ≥
  90% before the 88.4% figure is meaningful at ontology scale. Progress is real (more than
  doubled) but the condition remains unmet.

  (2) PROBE-VERIFIED = 0 permanently — no probe-runner feedback loop, 32 PROBE-NEEDED
  items unresolved. This is the same finding as SKE-F3 in the prior run; it has not been
  addressed in the batch interval between runs.

  The score holds at 5 (same as prior full run) rather than rising because the two structural
  failures are persistent, not trending toward closure. The denominator gap closed slightly
  (12.6% vs 5.4%) but at this pace would take ~7 more batch cycles to reach 90%, and the
  probe loop closure is still architecturally absent.

## independence_self_assessment

shared_blind_spot_risk: |
  As an LLM reviewing LLM-authored sidecars I share the training distribution that makes
  coherent Java reasoning appear plausible. Reactive chain semantics (Mono.switchIfEmpty,
  Flux.fromStream edge cases) are the highest-risk category — the sidecar language is
  technically plausible and I can verify method-name citations but cannot execute the
  reactive pipeline. The two CAL probes involving the listing and ordering logic
  (CAL-1, CAL-4) were verified mechanically against the actual source lines and are
  low-risk. The .block()-inside-transaction claim (CAL-8) was verified at the structural
  level (transaction lambda scope) but not at the runtime-scheduler-thread level.
needs_human_verification:
  - "CAL-8 — DataEntityHousekeepingJob .block() inside JDBC transaction: the structural
    verification confirms the call is inside the lambda, but whether blocking on a Reactor
    Mono inside a Spring TaskScheduler thread produces the documented hang-vs-deadlock
    behaviour depends on which scheduler thread pool the scheduled task runs on vs.
    Netty's event loop. The structural claim holds; the runtime-severity claim needs
    an empirical test."
  - "SKE-F1 — is a file-analyser/0.4.0 backfill of the 139 pre-Stress-Protocol sidecars
    already scheduled in the active sprint? If the next batch driver already targets these,
    the gap is a time-horizon issue rather than a structural absence."
