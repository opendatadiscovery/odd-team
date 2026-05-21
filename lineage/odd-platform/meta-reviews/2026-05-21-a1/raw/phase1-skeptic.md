---
panel_run: 2026-05-21
phase: 1
expert: panel-skeptic
axis: Honesty
commit_anchor: ede5d277
prompt_version: panel-skeptic/0.1.0
high_conf_sampled: 8
high_conf_falsified: 0
axis_score: 6
axis_band: AMBER
---

# Phase 1 — Skeptic (Honesty) assessment

## summary

The ontology's HIGH-confidence factual claims hold up well against primary sources — no false HIGH-confidence assertion was found across the 8 sampled targets. However the headline stress-coverage metric in `manifest.yaml` is stale: it reports 88.0% over 25 questions, while the live codebase has 53 questions across 8 stress-protocol sidecars and the true figure is 90.6%. More critically, 9 probes (P-001 through P-009) ran on 2026-05-19 with `outcome: PASS` but zero sidecar `confidence` labels were upgraded from `PROBE-NEEDED` to `PROBE-VERIFIED` — the feedback loop from probe-runner to sidecar is broken. A pile of 32 probes carries `status: pending-*` with 0 `PROBE-VERIFIED` labels anywhere in the corpus, meaning the honest axis (stress_verified_pct) cannot include the probe-verified tier even after evidence exists to fill it.

## calibration_probes

- id: CAL-1
  claim: "the `getActivity` method declares `final Long lasEventId` on line 34 (missing the `t` in `last`)"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened ActivityController.java at the repo commit ede5d277. Checked line 34 for the
    parameter name. Also checked ActivityService.java:42 to see if the typo propagates.
  source_evidence: "ActivityController.java:34 — `final Long lasEventId` (confirmed; typo is real)"
  verdict: holds

- id: CAL-2
  claim: "IngestionDataEntitiesFilter is conditionally registered via @ConditionalOnProperty('auth.ingestion.filter.enabled', havingValue='true') with NO matchIfMissing"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md:understanding"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened IngestionDataEntitiesFilter.java:20. Checked for @ConditionalOnProperty annotation,
    the havingValue, and the absence of matchIfMissing. Checked that line 56 uses
    `.equals(token)` (not MessageDigest.isEqual or similar constant-time comparison).
  source_evidence: "IngestionDataEntitiesFilter.java:20 — @ConditionalOnProperty(value=\"auth.ingestion.filter.enabled\", havingValue=\"true\") confirmed; no matchIfMissing attribute; line 56 uses dto.tokenPojo().getValue().equals(token)"
  verdict: holds

- id: CAL-3
  claim: "TokenGeneratorImpl uses RandomStringUtils.randomAlphanumeric(40) — non-SecureRandom RNG for collector token generation"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:implicit_adrs"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened TokenGeneratorImpl.java. Checked import on line 5 for the RNG source. Checked
    line 39 (generate path) and line 49 (regenerate path) for the actual call.
  source_evidence: "TokenGeneratorImpl.java:5 — `import org.apache.commons.lang3.RandomStringUtils;`; line 39 — `RandomStringUtils.randomAlphanumeric(40)` (confirmed; Apache Commons RandomStringUtils uses java.util.Random, not SecureRandom)"
  verdict: holds

- id: CAL-4
  claim: "/api/activity is NOT enumerated in SecurityConstants.SECURITY_RULES (SecurityConstants.java:98-356) and falls through to pathMatchers('/**').authenticated()"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Searched SecurityConstants.java for any entry containing "activity". Result: zero matches.
    Confirmed the file contains SECURITY_RULES from line 98 onward with no /api/activity entry.
    Confirmed AuthorizationCustomizer.java:29-30 has the catch-all pathMatchers("/**").authenticated().
  source_evidence: "SecurityConstants.java:98-356 — grep for 'activity' returns no output; AuthorizationCustomizer.java:29-30 — confirmed catch-all"
  verdict: holds

- id: CAL-5
  claim: "COLLECTOR_TOKEN_REGENERATE permission gates /api/collectors/{collector_id}/token at SecurityConstants.java:135-137"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:concepts.invariants.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read SecurityConstants.java lines 135-137. Checked that a SecurityRule is present for
    PUT /api/collectors/{collector_id}/token mapped to COLLECTOR_TOKEN_REGENERATE.
  source_evidence: "SecurityConstants.java:135-137 — `new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/collectors/{collector_id}/token\", PUT), COLLECTOR_TOKEN_REGENERATE)` — confirmed exactly as claimed"
  verdict: holds

- id: CAL-6
  claim: "ActivityServiceImpl.java:98-100 throws BadUserRequestException('Begin date and end date can't be null') when beginDate or endDate is null"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:concepts.invariants.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read ActivityServiceImpl.java lines 98-100. Checked whether the null guard exists
    and whether the exception message matches the claim verbatim.
  source_evidence: "ActivityServiceImpl.java:98-100 — `if (beginDate == null || endDate == null) { return Flux.error(new BadUserRequestException(\"Begin date and end date can't be null\")); }` — confirmed; exact message match"
  verdict: holds

- id: CAL-7
  claim: "The four ActivityType enum values (ALL / MY_OBJECTS / DOWNSTREAM / UPSTREAM) dispatch via a switch; type=null routes to fetchAllActivities before the switch"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:concepts.invariants.[2]"
  claimed_confidence: MEDIUM
  falsification_attempt: |
    Read ActivityServiceImpl.java:103-117. Checked the if(type==null) guard and the
    switch block. Confirmed whether ALL also routes to fetchAllActivities or elsewhere.
  source_evidence: "ActivityServiceImpl.java:103-117 — null-check at line 103 routes to fetchAllActivities (line 104-105); switch at 107 has case ALL -> fetchAllActivities and case MY_OBJECTS -> fetchMyActivities at line 108; confirmed dual-path to same destination"
  verdict: holds

- id: CAL-8
  claim: "SecurityConstants.WHITELIST_PATHS includes '/ingestion/**' (wildcard), while LoginFormSecurityConfiguration uses exact paths /ingestion/entities and /ingestion/datasources — creating inconsistent per-mode coverage for /ingestion/alert/alertmanager"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md:bugs_limitations_corner_cases"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read SecurityConstants.java:95-96 for the WHITELIST_PATHS content.
    Read LoginFormSecurityConfiguration.java:49-51 for the permittedPaths array.
    Read AuthorizationCustomizer.java:22 to confirm WHITELIST_PATHS is what OAUTH2/LDAP use.
    Checked whether the wildcard and exact-list discrepancy is real.
  source_evidence: "SecurityConstants.java:95-96 — WHITELIST_PATHS contains '/ingestion/**' (wildcard); LoginFormSecurityConfiguration.java:49-51 — permittedPaths is {'/actuator/health', '/favicon.ico', '/ingestion/entities', '/ingestion/datasources', '/api/slack/events'} (exact-only, no wildcard); AuthorizationCustomizer.java:22 — OAUTH2/LDAP use WHITELIST_PATHS; discrepancy is real"
  verdict: holds

## metric_honesty

headline_metric_used: |
  The manifest.yaml and the commit message both report `stress_verified_pct: 88.0%` as
  the headline honest metric. The coverage.py source code correctly labels the
  node-with-sidecar axis as "vanity" and the stress_verified_pct as the honest axis —
  this is a genuine calibration improvement over a vanity metric. The labelling is
  honest in intent.
gaming_check: |
  The manifest's reported numbers are STALE relative to the actual sidecar corpus.
  The manifest (last computed in commit 08ce36b, 2026-05-20) reports:
    stress_questions_total: 25, stress_answers_static_inferred: 22, stress_verified_pct: 88.0%
  Running coverage.py live today (2026-05-21) against the same files shows:
    stress_questions_total: 53, stress_answers_static_inferred: 48, stress_verified_pct: 90.6%
  The discrepancy occurs because new stress-protocol sidecars were committed after the
  last `--write-manifest` run. The manifest was not updated when those sidecars landed.

  The 53 stress questions are not trivially small — the TagController sidecar alone has
  23 stress-confidence labels (a mix of PROBE-NEEDED and STATIC-INFERRED); the
  ActivityEmptyPartitionsHousekeepingJob sidecar has 15. These are substantive
  multi-axis questions (auth-mode behaviour, boundary conditions, name-vs-behaviour
  contracts) that require real code traces to answer. No gaming of trivial questions
  detected; the denominator is honest.

  Separate concern: 9 probe-runs (P-001..P-009, all PASS, 2026-05-19) produced
  probe-run artefacts in `probe-runs/` but the sidecar confidence labels that emitted
  those probes were never updated from PROBE-NEEDED to PROBE-VERIFIED. The
  `stress_answers_probe_verified` count remains 0 across the entire corpus — despite
  existing empirical evidence that some answers are now machine-verified. The honest
  axis undercounts verified knowledge.

  Additionally: coverage.py's integrity audit surfaced 5 sidecars referencing node IDs
  not in the substrate and 5 feature-flow chains referencing non-substrate IDs.
  These are visible in the integrity block of the dashboard but are NOT reflected in
  the manifest. The manifest's `nodes_with_own_sidecar: 144` vs. live `147` confirms
  the stale state.
verdict: flatters

## low_confidence_rot

sampled: 12
resolved_over_batches: 0
stale: 12
verdict: rotting

## findings

- id: SKE-F1
  title: "manifest.yaml stress metrics stale — live numbers diverge by 28 questions and 2.6 pp"
  severity: MEDIUM
  evidence: "lineage/odd-platform/manifest.yaml:coverage_metrics (stress_questions_total: 25, stress_verified_pct: 88.0%) vs. coverage.py live output (stress_questions_total: 53, stress_verified_pct: 90.6%); manifest last updated in commit 08ce36b"
  detail: |
    The manifest is the single authoritative record of the ontology's honest-axis
    metrics. It is the input the panel reads, the number the investigator-log references
    in commit messages, and the value any downstream tooling would consume. It is
    currently stale by 28 questions and reports a lower verified percentage than the
    actual corpus achieves (88.0% vs. 90.6%). Any claim that the ontology is "88% stress-verified"
    is imprecise. Because the true number is higher (90.6%, not lower), this is a benign
    stale-low reading — the system is slightly more verified than reported, not less.
    Still: a stale manifest erodes the mechanism's trustworthiness. The fix is running
    `python3 lineage/_extractor/registry-shard/coverage.py --write-manifest` after any
    batch that adds or modifies stress-protocol sidecars, and adding this to the
    next-batch driver's post-commit checklist.
  routed_to: backlog-item
  confidence: HIGH

- id: SKE-F2
  title: "Probe-runner feedback loop broken — 9 PASS runs produce zero PROBE-VERIFIED upgrades"
  severity: HIGH
  evidence: |
    probe-runs/2026-05-19-P-001.yaml through 2026-05-19-P-009.yaml: all outcome: PASS;
    grep for 'confidence: PROBE-VERIFIED' across all 147 sidecars: 0 matches;
    probes/P-001.yaml through P-009.yaml: no `status:` field at all
  detail: |
    The stress protocol's honest axis is `(STATIC-INFERRED + PROBE-VERIFIED) / total`.
    P-001 through P-009 ran on 2026-05-19 and produced machine-verified answers, but
    no mechanism exists to propagate those results back into the sidecar confidence
    labels. The probes themselves have no `status` field — there is no schema for
    marking a probe `resolved`. The sidecars that emitted those probes still carry
    `confidence: PROBE-NEEDED` labels that are factually no longer PROBE-NEEDED.
    Additionally, 32 probes total exist in `probes/` with `status: pending-*` — none
    are marked resolved regardless of whether runs exist for them. The feedback loop
    is architecturally absent, not just lagging. Until it is repaired, PROBE-VERIFIED
    will remain 0 and the honest metric can only improve via STATIC-INFERRED, which
    is bounded by analyser thoroughness rather than empirical observation.
    Note: probes P-010 through P-032 have no corresponding probe-run, so their
    PROBE-NEEDED status is genuinely accurate and not a calibration failure for those.
  routed_to: new-gate
  confidence: HIGH

- id: SKE-F3
  title: "5 sidecar orphans and 5 feature-flow orphans — non-substrate node IDs silently included in coverage denominator candidates"
  severity: LOW
  evidence: "coverage.py live output integrity audit: 'Sidecars referencing nodes NOT in substrate: 5 (sample: ActivityController controller-class, AlertManagerController controller-method, AppInfoController controller-class, CollectorController controller-class, DataEntityAttachmentController controller-class)'; 'feature-flow chains referencing nodes NOT in substrate: 5'"
  detail: |
    The coverage.py dashboard documents that both lists "should be empty in steady state."
    They are not empty. Five controller-class sidecars reference node IDs that do not
    appear in nodes.jsonl (the substrate). These are controller-class nodes for which
    method-level sidecars also exist — the controller-class nodes were enriched but
    the substrate was not re-scanned after the method-level decomposition expanded the
    node set, or the controller-class node IDs changed format. The immediate effect is
    minor: these 5 sidecars are enriched but their node_ids do not count toward
    `nodes_with_own_sidecar` because they cannot be matched to substrate IDs. The
    manifest therefore undercounts direct enrichment by at most 5. Not a calibration
    failure in the honest-axis sense (the stress questions from these sidecars ARE
    counted by coverage.py's sidecar walk), but a sign that the substrate is stale.
  routed_to: backlog-item
  confidence: HIGH

- id: SKE-F4
  title: "TagController sidecar's single PROBE-NEEDED (getPopularTagList ordering) is tracked and probe-emitted — honest labelling"
  severity: LOW
  evidence: |
    lineage/odd-platform/understanding/odd-platform__java__TagController__controller-class__TagController.md:
    stress_findings section has 1 PROBE-NEEDED label; probes/P-010.yaml status: pending-stress-protocol;
    sidecar explicitly notes 'confidence_overall downgraded to MEDIUM because the LSN-019 drift's
    empirical confirmation is via maintainer's hand-run, not yet via probe-runner'
  detail: |
    The TagController sidecar explicitly documents WHY it carries a PROBE-NEEDED and why
    confidence_overall is MEDIUM rather than HIGH — the `getPopularTagList` name-vs-behaviour
    drift is asserted STATIC-INFERRED but the sidecar conservatively downgrades the overall
    confidence to MEDIUM pending probe-runner confirmation. P-010 is emitted and exists in
    probes/. This is the correct calibration behaviour: honest about what is known vs.
    what is measured. Surfaced as a finding because it is a positive example worth noting
    in the `what_went_well` section, and because the PROBE-NEEDED for this specific
    probe (P-010) is in the same stale-probe-loop state as SKE-F2.
  routed_to: human-verify
  confidence: HIGH

## what_went_well

- "All 8 HIGH-confidence factual claims checked against primary source code held up with exact file:line evidence — zero confidently-wrong assertions found. The sidecar authoring discipline produces accurate claims."
- "The coverage.py code correctly labels the node-with-sidecar axis as 'vanity' and stress_verified_pct as the honest axis — the system knows which metric matters and documents the distinction explicitly (coverage.py:66-82)."
- "The TagController sidecar (the most recent stress-protocol sidecar) explicitly downgrades confidence_overall to MEDIUM pending probe-runner confirmation of the key name-vs-behaviour drift finding — this is calibration working as intended (conservatism under uncertainty)."
- "The IngestionDataEntitiesFilter sidecar correctly models the cross-mode inconsistency between LOGIN_FORM's exact-path permittedPaths and OAUTH2/LDAP's WHITELIST_PATHS wildcard (SecurityConstants.java:96 vs. LoginFormSecurityConfiguration.java:49-51) — a subtle boundary claim that holds under falsification."
- "Probe-runs P-001..P-009 all passed — the probe definitions and docker-compose infrastructure are working. The probes themselves are substantive (rotation of tokens, view-count increments, security bypass) rather than trivial count-inflation."

## axis_score
score: 6
band: AMBER
rationale: |
  HIGH-confidence factual claims hold (no over-confident false assertions found across 8 probes) — this
  is the most important signal and scores well. The manifest's headline honest-metric is stale (wrong
  by 28 questions and ~2.6 percentage points), which is a calibration failure of the metric mechanism,
  not of the underlying claims. The probe-runner feedback loop is broken: 9 probes with PASS outcomes
  produce zero PROBE-VERIFIED label upgrades. This is not a falsified claim but a structural gap: the
  system promises "PROBE-VERIFIED" as the highest-confidence tier and reports 0 of them permanently.
  Twelve LOW-confidence / PROBE-NEEDED items sampled show 0 resolved over batches — the honest labels
  are accumulating without a resolution mechanism. These are AMBER-band weaknesses: not RED (no false
  HIGH-confidence claims) but not GREEN (the metric mechanism is unreliable and the honest-label
  resolution track is absent).

## independence_self_assessment
shared_blind_spot_risk: |
  As an LLM reviewing LLM-authored sidecars, I share the training distribution that makes
  fluent, coherent Java reasoning appear correct. Claims about reactive chain composition
  (Mono.zip, flatMapMany, switchIfEmpty patterns) are especially susceptible — the sidecar
  language is technically plausible and I can confirm the method-name citations but cannot
  verify the reactive execution-order semantics at the boundary without running the code.
  My CAL-7 verdict (ActivityServiceImpl dispatch holds) is based on reading the switch
  statement, not running it — the dual-path-to-fetchAllActivities defect described there
  is a real logic concern that my reading confirmed exists, but whether it is exploitable
  in practice depends on whether ALL and null are actually observationally identical in all
  edge cases; I did not run the service.
needs_human_verification:
  - "CAL-7 — the null-vs-ALL dual path in ActivityServiceImpl.java:103-117: is there any
     transactional, caching, or reactive-context difference between the two paths that the
     static read missed? The sidecar treats them as equivalent; the code confirms same
     destination, but reactive context propagation (e.g. MDC, security context propagation
     in Reactor) might diverge between the if-branch and the switch-branch if the reactive
     pipeline carries context differently for the two paths."
  - "SKE-F2 — does the probe-run/sidecar feedback loop have a manual or automated path
     that exists but was missed (e.g. a /probe-run skill that updates sidecar files)? The
     2026-05-19 probe-run batch log references an ADR for dynamic-verification-layer but
     the sidecar update step may be designed as a later slice."
