---
panel_run: 2026-05-21
phase: 1
expert: panel-skeptic
axis: Honesty
commit_anchor: ede5d277
prompt_version: panel-skeptic/0.1.0
high_conf_sampled: 10
high_conf_falsified: 0
axis_score: 5
axis_band: AMBER
---

# Phase 1 — Skeptic (Honesty) assessment

## summary

This is the full re-run against the now-ratified explicit target (target.md version 1.0, ratified 2026-05-21). The ontology's HIGH-confidence factual claims hold up under falsification: 10 sampled targets drawn from both the older batch-A/B sidecars (file-analyser/0.2.0) and the newer batch-G sidecars (file-analyser/0.4.0) found zero confidently-wrong assertions. However three structural honesty failures persist and are escalated against the ratified target: (1) the manifest is stale — it reports a denominator of 25 stress questions while the live corpus has 53, and `sidecars_with_stress_section` is reported as 3 when it is 8; (2) the target's condition 1 requires `stress_verified_pct ≥ 0.80` computed over a denominator covering `≥ 90%` of substrate nodes carrying triggers — the actual denominator covers only 8 of 147 enriched sidecars (5.4%), so the 90.6% headline number is accurate over a tiny scope and the condition is structurally unmet; (3) the probe-runner feedback loop remains architecturally absent — 9 PASS probe-runs from 2026-05-19 produced zero PROBE-VERIFIED label upgrades, so `stress_answers_probe_verified` is permanently 0.

## target_lens

The Honesty axis owns target conditions 1, 2, and 8. For condition 1, the honesty bar is: the `stress_verified_pct ≥ 0.80` figure must be computed over a denominator that covers `≥ 90%` of substrate nodes carrying Stress-Protocol triggers — not over the handful of sidecars that happened to be authored under file-analyser/0.4.0. A 90.6% figure computed over 8 of 147 sidecars (5.4% of enriched nodes) is a precise and accurate local number, but it does not satisfy the condition's denominator requirement — condition 1 is not met. For condition 2, the Honesty axis checks that no `status: closed` LSN's fix is prompt-only; closure evidence must be a probe-run or scan-pass. For condition 8, the Honesty axis checks whether the panel's own verdicts are trustworthy — whether calibration claims in panel reports are backed by cited evidence rather than assertion. The concrete bar: condition 1 is not met at this run (5.4% Stress-Protocol adoption vs. 90% required); condition 2 is unverifiable until closed LSNs exist; condition 8 cannot be assessed until ≥ 3 panel runs exist.

## calibration_probes

- id: CAL-1
  claim: "getActivity method declares `final Long lasEventId` on line 34 (missing 't' in 'last')"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened ActivityController.java directly at REPO_ROOT_ABS. Checked line 34 for the exact
    parameter name. The sidecar also claims ActivityService.java:42 carries the same symbol
    in the service interface — checked whether the typo propagates into the service or is
    corrected there.
  source_evidence: "ActivityController.java:34 — `final Long lasEventId` — confirmed, typo present. ActivityServiceImpl.java:96 — parameter is `final Long lastEventId` (corrected at service layer; typo only at the controller method signature, not the service call)"
  verdict: holds

- id: CAL-2
  claim: "IngestionDataEntitiesFilter @ConditionalOnProperty has havingValue='true' with NO matchIfMissing attribute, making filter default-off"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__auth__filter__IngestionDataEntitiesFilter.md"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened IngestionDataEntitiesFilter.java:20. Verified the annotation's attributes. Any
    matchIfMissing=true would make the filter default-on; its absence means default-off.
  source_evidence: "IngestionDataEntitiesFilter.java:20 — @ConditionalOnProperty(value = \"auth.ingestion.filter.enabled\", havingValue = \"true\") — no matchIfMissing attribute present; default-off claim confirmed"
  verdict: holds

- id: CAL-3
  claim: "IngestionDataEntitiesFilter.java:56 uses `.equals(token)` for token verification — plaintext equality, not constant-time comparison"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:implicit_adrs.[3]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened IngestionDataEntitiesFilter.java lines 55-58. Checked whether the comparison is
    a String.equals call or MessageDigest.isEqual / BCrypt.matches / HMAC.
  source_evidence: "IngestionDataEntitiesFilter.java:56 — `if (!dto.tokenPojo().getValue().equals(token))` — String.equals confirmed; no constant-time comparison"
  verdict: holds

- id: CAL-4
  claim: "TokenGeneratorImpl uses RandomStringUtils.randomAlphanumeric(40) — sourced from Apache Commons Lang, NOT SecureRandom"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[1]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Opened TokenGeneratorImpl.java. Checked the import (line 5) for the RNG source class.
    Checked lines 39 and 49 for the actual call sites.
  source_evidence: "TokenGeneratorImpl.java:5 — `import org.apache.commons.lang3.RandomStringUtils;`; line 39 — `setValue(RandomStringUtils.randomAlphanumeric(40))` (generate path); line 49 — same call (regenerate path). No SecureRandom import or usage."
  verdict: holds

- id: CAL-5
  claim: "SecurityConstants.java:135-137 contains SecurityRule(NO_CONTEXT, PUT /api/collectors/{collector_id}/token, COLLECTOR_TOKEN_REGENERATE)"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:concepts.invariants.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read SecurityConstants.java lines 135-137. Verified the exact constructor arguments:
    context type (NO_CONTEXT vs DATA_ENTITY), path pattern, HTTP method, permission enum value.
  source_evidence: "SecurityConstants.java:135-137 — `new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/collectors/{collector_id}/token\", PUT), COLLECTOR_TOKEN_REGENERATE)` — exact match to claimed line and content"
  verdict: holds

- id: CAL-6
  claim: "ActivityServiceImpl.getActivityList throws BadUserRequestException('Begin date and end date can’t be null') when beginDate or endDate is null (lines 98-100)"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:concepts.invariants.[0]"
  claimed_confidence: HIGH
  falsification_attempt: |
    Read ActivityServiceImpl.java lines 98-100. Checked whether the guard exists, which
    direction (beginDate OR endDate), and the exact exception message string.
  source_evidence: "ActivityServiceImpl.java:98-100 — `if (beginDate == null || endDate == null) { return Flux.error(new BadUserRequestException(\"Begin date and end date can't be null\")); }` — confirmed; exact message match"
  verdict: holds

- id: CAL-7
  claim: "ActivityServiceImpl.getActivityCounts (lines 138-166) carries NO null-check for beginDate/endDate — unlike getActivityList which has the check at lines 98-100"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__ActivityServiceImpl.md:stress_findings.S-B-3"
  claimed_confidence: HIGH (STATIC-INFERRED HIGH per sidecar stress_findings)
  falsification_attempt: |
    Read ActivityServiceImpl.java lines 138-166 (the getActivityCounts method). Checked whether
    any null-guard on beginDate or endDate exists anywhere in the method body. Also compared
    against getActivityList at 98-100 to confirm the asymmetry is real.
  source_evidence: "ActivityServiceImpl.java:138-166 — method body begins with `final ActivityEventTypeDto eventTypeDto = eventType != null ? ...` — no null-check for beginDate or endDate anywhere before the four count sub-queries are assembled. Confirmed asymmetry with lines 98-100 (getActivityList guard) and 128-130 (getDataEntityActivityList guard)."
  verdict: holds

- id: CAL-8
  claim: "ownerIds parameter is silently dropped for MY_OBJECTS / UPSTREAM / DOWNSTREAM view modes — only fetchAllActivities accepts it"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__ActivityServiceImpl.md:stress_findings.S-B-2"
  claimed_confidence: HIGH (STATIC-INFERRED HIGH per sidecar stress_findings)
  falsification_attempt: |
    Read ActivityServiceImpl.java lines 107-116 (the switch block). Checked the method
    signatures of fetchMyActivities (line 108 call site) and fetchDependentActivities
    (lines 110, 112) to verify ownerIds is absent from those signatures. Confirmed
    fetchAllActivities at line 104 and 114 DOES include ownerIds.
  source_evidence: "ActivityServiceImpl.java:108 — fetchMyActivities call has no ownerIds argument; line 110/112 — fetchDependentActivities calls have no ownerIds argument; line 104/114 — fetchAllActivities calls include ownerIds. Method signatures at lines 168+ confirm fetchMyActivities and fetchDependentActivities have no ownerIds parameter. Claim holds."
  verdict: holds

- id: CAL-9
  claim: "ActivityServiceImpl.createActivityEvent switchIfEmpty at line 49 fires for TWO independent conditions — (1) no SecurityContext; (2) empty events list — conflating system-event-detection with no-op cases"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__ActivityServiceImpl.md:stress_findings.S-B-1"
  claimed_confidence: HIGH (STATIC-INFERRED HIGH per sidecar)
  falsification_attempt: |
    Read ActivityServiceImpl.java lines 43-63. Checked whether createActivityEvent and
    createActivityEvents both use switchIfEmpty after getCurrentUser(), and whether an
    empty events list would trigger the null-username fallback in createActivityEvents.
    The boundary condition: if events is empty, mapEventsToPojos returns empty Stream,
    Flux.fromStream produces empty Flux, switchIfEmpty fires with null username.
  source_evidence: "ActivityServiceImpl.java:54-63 — createActivityEvents: line 57 `authIdentityProvider.getCurrentUser().map(...).flatMap(username -> Flux.fromStream(mapEventsToPojos(events, time, username))).switchIfEmpty(Mono.defer(() -> Mono.just(null)).flatMapMany(...))` — the switchIfEmpty fires when either getCurrentUser is empty OR the mapped Flux is empty. Both paths produce null username. Claim holds (the two conditions are conflated)."
  verdict: holds

- id: CAL-10
  claim: "Zero @PreAuthorize, zero programmatic authorization, zero @ReactiveTransactional at the ActivityServiceImpl service layer (lines 33-273, verified line-by-line)"
  claim_location: "lineage/odd-platform/understanding/odd-platform__java__service__ActivityServiceImpl.md:invariants"
  claimed_confidence: HIGH
  falsification_attempt: |
    Grepped ActivityServiceImpl.java for @PreAuthorize, @Secured, hasPermission, and
    @ReactiveTransactional annotations. Confirmed absence across the full method set.
  source_evidence: "grep '@PreAuthorize\\|@Secured\\|@ReactiveTransactional' ActivityServiceImpl.java — zero matches. Confirmed: the service layer carries no authorization or transactional annotations; auth is inherited from callers (ActivityAspect, AlertServiceImpl, IngestionServiceImpl)."
  verdict: holds

## metric_honesty

headline_metric_used: |
  The manifest.yaml and the coverage.py dashboard both present `stress_verified_pct` as
  the honest axis and explicitly label the node-with-sidecar ratio as the vanity axis.
  This framing is correct in intent. However the manifest's reported numbers are stale
  and the target's denominator requirement for condition 1 is not met.
gaming_check: |
  STALE MANIFEST: The manifest reports stress_questions_total: 25 and stress_verified_pct: 88.0%.
  Running coverage.py live (2026-05-21) shows stress_questions_total: 53 and stress_verified_pct: 90.6%.
  The manifest was last updated before five new stress-protocol sidecars landed (batches in
  the 2026-05-20 LSN-019 sprint). The true number is higher (not lower) so the system is
  slightly better than reported — this is benign stale-low, not flattering-high.

  TARGET CONDITION 1 DENOMINATOR FAILURE: The target requires the stress_verified_pct
  denominator to cover >= 90% of substrate nodes that carry Stress-Protocol triggers.
  The live corpus shows: 8 sidecars with stress_findings out of 147 enriched sidecars —
  5.4% Stress-Protocol adoption among enriched nodes, far below the 90% threshold.
  The 90.6% verified figure is accurate over its 53-question scope, but that scope is
  8 of 147 enriched sidecars (5.4%): the 139 pre-Stress-Protocol sidecars contribute
  zero stress questions. The metric measures a small island of the ontology precisely
  rather than the whole ontology approximately. The condition is structurally unmet.

  PROBE-VERIFIED = 0 PERMANENTLY: 9 probe-runs (P-001..P-009) executed on 2026-05-19
  with outcome: PASS. Zero sidecar confidence labels were upgraded from PROBE-NEEDED to
  PROBE-VERIFIED. The honest metric's probe tier contributes nothing because the feedback
  loop from probe-run outcomes to sidecar labels is architecturally absent. Additionally,
  coverage.py's integrity audit shows 5 sidecar orphans (controller-class node IDs not
  in nodes.jsonl) — the manifest reports nodes_with_own_sidecar: 144 while live count
  is 147, a minor undercount.

  The stress questions themselves are substantive — multi-axis auth-mode questions,
  boundary conditions on reactive chains, name-vs-behaviour drift — not trivially
  inflated denominator games. The honest metric is honest in content but broken in scope.
verdict: flatters

## low_confidence_rot

sampled: 14
resolved_over_batches: 0
stale: 14
verdict: rotting

The sampled LOW-confidence / PROBE-NEEDED items span:
- probes/P-001 through P-009: `status: pending-stress-protocol` in the probe definition
  files; 2026-05-19 probe-runs with outcome: PASS exist; the originating sidecars still
  carry the pre-probe confidence labels (PROBE-NEEDED or the original LOW). Zero upgrades.
- probes/P-010 through P-032: `status: pending-stress-protocol`; no probe-run files exist.
  These are genuinely unresolved and correctly labelled.
- Five LOW-confidence doc_link items in ActivityController sidecars: doc pages that were
  WebFetched in 2026-05-10 and had status 200 — these are LOW-confidence on the sidecar
  because the doc content was incomplete, not because the URL was unresolved. They carry
  no resolution path.

The probe-runner feedback loop is the decisive failure: once a PROBE-NEEDED item has
a PASS run, there is no mechanism to upgrade it. The low-confidence pile grows with
every new sidecar authored; nothing drains it.

## findings

- id: SKE-F1
  title: "manifest.yaml stress metrics stale by 28 questions — 88.0% reported vs 90.6% live"
  severity: MEDIUM
  evidence: "lineage/odd-platform/manifest.yaml — stress_questions_total: 25, sidecars_with_stress_section: 3, stress_verified_pct: 88.0%; coverage.py live output — stress_questions_total: 53, sidecars_with_stress_section: 8, stress_verified_pct: 90.6%"
  detail: |
    The manifest is the single authoritative record of the ontology's honest-axis metrics
    — it is what the panel reads, what the investigator-log references, and what downstream
    tooling would consume. New stress-protocol sidecars landed in the 2026-05-20 LSN-019
    sprint without triggering a `coverage.py --write-manifest` run. The stale direction
    is benign (true is higher than reported), but any claim that the ontology is "88% stress-verified"
    is imprecise. The fix is running coverage.py --write-manifest after every batch that adds
    or modifies stress-protocol sidecars, and adding this step to the next-batch driver checklist.
  routed_to: backlog-item
  confidence: HIGH

- id: SKE-F2
  title: "Target condition 1 denominator unmet — Stress Protocol covers 5.4% of enriched sidecars, not 90%"
  severity: HIGH
  evidence: |
    target.md condition 1: 'stress_verified_pct >= 0.80, computed over a denominator of all
    enriched sidecars... covers >= 90% of substrate nodes that carry Stress-Protocol triggers';
    coverage.py live: sidecars_with_stress_section: 8, sidecars_pre_stress_protocol: 139,
    total: 147; 8/147 = 5.4%
  detail: |
    The 90.6% stress_verified_pct number is accurate over its scope but the scope is 8 out
    of 147 enriched sidecars. The 139 pre-Stress-Protocol sidecars (authored under
    file-analyser/0.2.0 before Rule 9 was added) contribute zero stress questions to the
    denominator. The target's condition 1 requires the denominator to cover at least 90%
    of substrate nodes carrying triggers — meaning the vast majority of enriched sidecars
    need a stress_findings section before the metric is meaningful at the ontology scale.
    At 5.4% adoption the "90.6% verified" headline refers to one island of 8 recent sidecars;
    the 139 older sidecars are entirely uninterrogated by the Stress Protocol. This is the
    target's most significant unmet condition for the Honesty axis.
  routed_to: approach-rev
  confidence: HIGH

- id: SKE-F3
  title: "Probe-runner feedback loop architecturally absent — 9 PASS runs produce zero PROBE-VERIFIED upgrades"
  severity: HIGH
  evidence: |
    probe-runs/2026-05-19-P-001.yaml through 2026-05-19-P-009.yaml: all outcome: PASS;
    grep 'confidence: PROBE-VERIFIED' across 147 sidecars: 0 matches;
    probes/P-001.yaml through P-009.yaml: no status field; no schema for marking resolved
  detail: |
    The Stress Protocol's honest axis is (STATIC-INFERRED + PROBE-VERIFIED) / total. Nine
    probes executed on 2026-05-19 and produced machine-verified answers, but no mechanism
    propagates those results back into the sidecar confidence labels. The probe definition
    files (probes/P-001.yaml through P-009.yaml) carry no `status:` field — there is no
    schema for marking a probe resolved. The sidecars that emitted those probes still carry
    PROBE-NEEDED labels that are factually stale. The PROBE-VERIFIED tier of the honest
    metric is permanently 0 regardless of how many probes pass. This is target condition 6
    unmet: "A probe-run with outcome: PASS mechanically upgrades its originating sidecar's
    confidence to PROBE-VERIFIED; stress_answers_probe_verified is non-zero and tracked per batch."
    Note: probes P-010..P-032 have no corresponding run; their PROBE-NEEDED status is genuinely
    accurate and not a calibration failure for those items.
  routed_to: new-gate
  confidence: HIGH

- id: SKE-F4
  title: "5 sidecar orphans — controller-class node IDs not in nodes.jsonl silently excluded from coverage count"
  severity: LOW
  evidence: |
    coverage.py live integrity audit: 'Sidecars referencing nodes NOT in substrate: 5
    (sample: ActivityController controller-class, AlertManagerController controller-method,
    AppInfoController controller-class, CollectorController controller-class,
    DataEntityAttachmentController controller-class)'; manifest reports
    nodes_with_own_sidecar: 144 vs live 147
  detail: |
    Five controller-class sidecars reference node IDs not in nodes.jsonl. These are nodes
    enriched at the controller-class level when method-level decomposition also exists.
    Their stress questions ARE counted by coverage.py (sidecar walk does not filter by
    substrate membership), but their enrichment does not count toward the vanity metric
    nodes_with_own_sidecar. The immediate calibration impact is negligible, but the
    substrate is stale with respect to the class-level vs method-level decomposition split.
  routed_to: backlog-item
  confidence: HIGH

- id: SKE-F5
  title: "getActivityCounts no-null-check asymmetry is honestly labelled PROBE-NEEDED — correct calibration, but unresolved"
  severity: LOW
  evidence: |
    ActivityServiceImpl.md:stress_findings.S-B-3 — confidence: PROBE-NEEDED MEDIUM;
    probes/P-023.yaml expected but not confirmed present; no probe-run file for P-023
  detail: |
    The sidecar correctly identifies that getActivityCounts has no beginDate/endDate null-check
    (confirmed at ActivityServiceImpl.java:138-166) and labels this PROBE-NEEDED rather than
    claiming it is definitely a performance cliff — this is calibrated uncertainty. The probe
    for this item (P-023) is emitted but has no run. This finding is surfaced as a positive
    calibration example (correctly PROBE-NEEDED rather than over-confidently STATIC-INFERRED)
    that is simultaneously in the stale-PROBE-NEEDED pool. The impact is real: an operator
    calling /api/activity/counts without dates triggers an unbounded partition-spanning count
    across the full activity table (which per F-010 grows without retention). Not confirmed
    empirically yet.
  routed_to: human-verify
  confidence: MEDIUM

## what_went_well

- "All 10 HIGH-confidence factual claims checked against primary source code held. Zero confidently-wrong assertions found across two generations of sidecars (file-analyser/0.2.0 and 0.4.0). Claim accuracy is the most important calibration signal and it is clean."
- "The coverage.py source code correctly labels the node-with-sidecar ratio as 'vanity' and stress_verified_pct as 'the honest axis' — the system knows which metric matters and makes the distinction explicit in both the code and the rendered dashboard output (coverage.py:66-82, 256-300)."
- "The ActivityServiceImpl sidecar (file-analyser/0.4.0) demonstrates explicit multi-trigger stress_findings with honest STATIC-INFERRED vs PROBE-NEEDED distinctions: S-B-1, S-B-2, S-B-4, S-C-1, S-C-2 are STATIC-INFERRED HIGH (code traces confirmed); S-B-3 is PROBE-NEEDED MEDIUM (empirical confirmation deferred appropriately). This is the calibration pattern working as intended."
- "Probe-runs P-001..P-009 all passed on 2026-05-19 — the probe definitions and docker-compose infrastructure execute correctly. The probes are substantive (token rotation, view-count increments, security posture checks) rather than trivial count inflation."
- "The ownerIds-silent-drop finding (CAL-8, S-B-2) is a precise, accurate HIGH-confidence claim about a non-obvious asymmetry in the switch dispatch — it holds under falsification and requires reading four call sites simultaneously to verify. The sidecar captured it correctly."

## axis_score

score: 5
band: AMBER
rationale: |
  HIGH-confidence factual claims hold across 10 sampled targets — this is the most important
  signal and scores well (no confidently-wrong assertions, citations resolve, boundary claims
  verified). This prevents a RED score.

  Three structural honesty failures drag the score into AMBER:
  (1) Target condition 1 denominator is not met: the stress_verified_pct headline number is
  90.6% over 8/147 sidecars (5.4% adoption) — the target requires >= 90% adoption before
  the metric is meaningful at ontology scale. This is the most significant gap.
  (2) The probe-runner feedback loop is absent: PROBE-VERIFIED is permanently 0 despite 9
  PASS runs. Target condition 6 is unmet. The honest metric cannot grow its probe-verified
  tier.
  (3) The manifest is stale, though benignly (true values are better than reported). The
  stale state means any claim about the ontology's verified percentage at the manifest commit
  is imprecise.

  The prior panel run (2026-05-21-a1) scored this axis 6. The full re-run against the
  ratified target scores it 5, primarily because condition 1's denominator requirement
  is now explicitly stated and is demonstrably unmet — the maiden run did not have the
  explicit target to measure against and could not score this failure.

## independence_self_assessment

shared_blind_spot_risk: |
  As an LLM reviewing LLM-authored sidecars I share the training distribution that makes
  fluent, coherent Java reasoning appear correct. Reactive chain composition (Mono.zip,
  switchIfEmpty, flatMapMany) is the highest-risk area: the sidecar language is technically
  plausible and I can verify method-name citations but cannot run the reactive pipeline to
  confirm execution-order semantics at concurrency boundaries. CAL-9 (the switchIfEmpty
  dual-trigger for createActivityEvents) is my weakest verdict — I confirmed the code shape
  is as described but did not execute it against a live Reactor subscription to verify the
  observable conflation. CAL-10 (zero @ReactiveTransactional) is my most reliable verdict
  — annotation presence is a mechanical grep, not a semantic inference.
needs_human_verification:
  - "CAL-9 — createActivityEvents switchIfEmpty dual-trigger: does an empty-list call actually fire the null-username fallback in production, or does Flux.fromStream(empty).switchIfEmpty behave differently under the Reactor scheduler? The static read is consistent with the claim, but reactive context propagation through flatMap can suppress empty-signals in ways not visible to a static reader."
  - "SKE-F2 — is there a planned backfill mechanism for pre-Stress-Protocol sidecars? If the next-batch driver is already scheduled to backfill all 139 older sidecars under file-analyser/0.4.0, the denominator gap is a time-horizon issue, not a structural gap. The investigator-log and APPROACH.md do not confirm a backfill plan."
  - "SKE-F3 — does a /probe-run skill or other mechanism exist that was designed to update sidecar confidence labels post-run? The ADR draft dynamic-verification-layer.md was referenced in probe-run artefacts — if its Slice 3 covers the sidecar-update step, the feedback loop gap may be designed-deferred rather than absent."
