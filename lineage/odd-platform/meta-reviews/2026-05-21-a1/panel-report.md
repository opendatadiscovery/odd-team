---
panel_run: 2026-05-21
commit_anchor: ede5d277
mode: lite
is_maiden_run: true
verdict: GO-WITH-CHANGES
overall_score: 5.7
overall_band: AMBER
prior_panel: none
validation_status: pre-acceptance-gate
---

# Panel Report — 2026-05-21

This is the **maiden run** of the Adversarial Review Panel, in **lite mode**: `RAW_DIR`
holds the six Phase-1 expert reports and **no Phase-2 cross-examination memos** —
Phase 2 was skipped. Consequence for synthesis: the consensus/contested split below
is built from *independent Phase-1 corroboration* only. No finding was tested by an
adversarial peer memo, so "contested" here means two Phase-1 reports reached
different readings of the same artefact, not that one expert rebutted another on
cited evidence. Treat the contested section as weaker than a full-mode run would
produce.

## verdict

**GO-WITH-CHANGES**

The methodology is fundamentally sound and is the right architecture for the target —
every layer earns its place, the failure-driven revision history is honest, and where
the methodology has actually been *run* (the Stress-Protocol sidecars, the feature
reflections, the probed feature flows) it produces senior-engineer-grade depth that
two independent experts re-derived from source. But it has a coherent, named set of
must-fix items that block the target, and they cluster on one theme: **the methodology
is specified far ahead of where it has been executed.** Five major structures were
added in a 72-hour window (rev 2→6); the substrate was last scanned 2026-05-08, before
any of them; the core enforcement of three of those structures lives only as a prompt
instruction with no executor. The single hardest number in this report: of 144 sidecars,
**3 carry the Stress Protocol** — the rev-4 interrogation layer the methodology's own
depth claim rests on. And 62% of the sprint's tracked findings are sitting in `detail/`
directories whose index files were never updated, so they are invisible to every
downstream consumer including this panel. None of this is a structural flaw in the
*design* — it is an execution and enforcement debt. Address the seven ranked
`what_must_improve` items, run the methodology end-to-end once at its current scope,
and pass the maiden acceptance gate, and it will reach the target. Until then every
finding here is **provisional** (Rule 7 — the panel has not passed its own gate).

## scorecard

| Axis | Expert | Band | Score | Δ vs prior |
|---|---|---|---|---|
| Coverage | Adversary | AMBER | 6 | n/a (maiden) |
| Process | Methodologist | AMBER | 5 | n/a |
| Cost | Economist | AMBER | 4 | n/a |
| Depth | Engineer | AMBER | 6 | n/a |
| Usefulness | Practitioner | AMBER | 7 | n/a |
| Honesty | Skeptic | AMBER | 6 | n/a |
| **Overall** | — | **AMBER** | **5.7** | n/a |

Overall = mean(6,5,4,6,7,6) = 5.67 → **5.7**. Band: no RED axis, every axis AMBER →
**AMBER**. The verdict (`GO-WITH-CHANGES`) is coherent with the scorecard: no RED axis
and no critical regression rules out `STRUCTURAL-RETHINK`; six AMBER axes and a
CRITICAL consensus finding rule out `GO`.

## fresh_spot_check_ledger

The Adversary's eight blind spot-checks against odd-platform @ ede5d277:

- SC-1 | JooqFTSHelper.tsQuery multi-word FTS semantics | random-walk | COVERED-CORRECT | HIGH
- SC-2 | HousekeepingJobManager @Scheduled cadence + ConditionalOnProperty | boundary | COVERED-CORRECT | HIGH
- SC-3 | DataEntityController#getPopular ranking signal | capability | COVERED-CORRECT | HIGH
- SC-4 | cteDataEntitySelect EXCLUDE_FROM_SEARCH filter on list reads | negative-space | COVERED-CORRECT | HIGH
- SC-5 | ReactiveDataEntityRepositoryImpl#getQuerySuggestions result cap | boundary | COVERED-CORRECT | HIGH
- SC-6 | tsquery-operator-injection invariant — ftsCondition call-site enumeration | negative-space | **COVERED-WRONG** | HIGH
- SC-7 | PostgreSQLLeaderElectionManagerImpl#acquire advisory-lock leader election | random-walk | **MISSED-SILENT** | n/a
- SC-8 | spring.session.timeout=-1 + session.provider IN_MEMORY defaults | negative-space | COVERED-CORRECT | HIGH

Pass rate 5/8 = 0.63; one COVERED-WRONG, one MISSED-SILENT.

## consensus_findings

# Ranked by cited-evidence strength + severity. NOT by headcount (Rule 3).

- rank: 1
  finding: "62% of tracked findings are invisible — index/detail divergence across all four sharded reducers"
  raised_by: [Economist]
  corroborated_independently_by: [Practitioner]
  severity: CRITICAL
  evidence: "test-map 312 index vs 881 detail; refactoring-scopes 225 vs 518; implicit-adrs 69 vs 198; doc-gaps 103 vs 259. 709 indexed, 1,856 in detail, 1,147 invisible. Index files last modified 2026-05-19/20; detail files 2026-05-21 11:41. TEST-GAP-313 and REFACTOR-229 verified as valid YAML present in detail/, absent from index. (ECO-F1)"
  chair_note: "Single-expert finding but the citation is mechanically reproducible — a directory glob vs an index regex; weight is HIGH on cited evidence per Rule 3, not on headcount. Independently corroborated by the Practitioner's PRA-F5 (feature-flows.yaml index stale: lists 5, detail/ has 30). Two reducers' indexes proven stale by two experts is a methodology-wide pattern, not one missed write. This is a correctness defect wearing an efficiency-defect costume: the panel itself, reading index files, saw a 38%-complete picture of the sprint."
  routed_to: backlog-item

- rank: 2
  finding: "Stress Protocol enforcement is a prompt instruction with no executor — and it has reached only 3 of 144 sidecars"
  raised_by: [Methodologist, Engineer]
  severity: HIGH
  evidence: "manifest.yaml sidecars_with_stress_section=3, sidecars_pre_stress_protocol=141. file-analyser.md Rule 9 'a sidecar with triggers_total==0 ... is REJECTED' — APPROACH.md §5 Rule 13 — has no executor: lineage/_extractor/registry-shard/ contains coverage.py + rebuild_indexes.py + yaml_safe_fix.py but no sidecar/stress validator; next-batch SKILL Phase 3 has no stress-check step. (MET-F1, ENG-F1)"
  chair_note: "Two experts on two axes reached this independently from the same manifest counter — Process sees it as a missing structural gate, Depth sees its consequence (the platform's busiest repository, ReactiveDataEntityRepositoryImpl, is not stress-equipped, so DP-2's jOOQ name-resolution trap would be missed). The methodology's headline depth claim rests on a layer applied to ~2% of nodes. The denominator effect compounds it: stress_verified_pct is computed over 3 sidecars, so the honest-coverage axis is structurally non-representative."
  routed_to: new-gate

- rank: 3
  finding: "Five core rejection criteria exist only as LLM prompt instructions — 'gate-as-prompt' (proposed un-named Failure F)"
  raised_by: [Methodologist, Engineer]
  severity: HIGH
  evidence: "APPROACH.md §5 Rules 13/15 + file-analyser.md Rule 9 + feature-reflector.md: five REJECTED/non-negotiable criteria (empty-stress reject, missing-reflection incomplete, zero-hypothesis reject, banned-phrase reject, pillar-count [8,12] STOP). None enforced by a static script. coherence_sweep.py — itself one such gate and a cited panel-blind-spot mitigation — is unimplemented (LSN-018 open). (MET un_named_failure_modes F; ENG-F2 routes to new-gate)"
  chair_note: "The Methodologist names this as a class (Failure F); the Engineer's ENG-F2 is one instance of it (no idiom-trigger for the Spring AOP proxy-bypass class, routed to new-gate). A gate that an LLM can silently skip is a floor that is not nailed down. This is the structural root under finding rank 2."
  routed_to: approach-rev

- rank: 4
  finding: "Probe-runner feedback loop is architecturally absent — 9 PASS runs produce zero PROBE-VERIFIED upgrades"
  raised_by: [Skeptic]
  corroborated_independently_by: [Methodologist]
  severity: HIGH
  evidence: "probe-runs/2026-05-19-P-001..P-009 all outcome:PASS; grep 'confidence: PROBE-VERIFIED' across all 147 sidecars = 0 matches; probes P-001..P-009 have no `status:` field — no schema to mark a probe resolved. 32 probes carry status:pending-*. (SKE-F2)"
  chair_note: "The Skeptic found it by grep; the Methodologist's MET-F7 reaches the same place from the process side (probe-runner infrastructure may not exist; stress_answers_probe_verified=0). PROBE-VERIFIED is the methodology's highest-confidence tier and the closing mechanism named in LSN-019's rule-that-emerged — it is permanently 0. The honest axis can only ever improve via STATIC-INFERRED until this is repaired."
  routed_to: new-gate

- rank: 5
  finding: "The methodology has been specified far ahead of execution — rev 2→6 in 72h, never run end-to-end at current scope"
  raised_by: [Methodologist]
  corroborated_independently_by: [Economist, Engineer, Practitioner]
  severity: HIGH
  evidence: "APPROACH.md revision history rev 2 (05-19) → rev 6 (05-21); manifest.yaml last_scan_date=2026-05-08 predates all five additions; features_with_at_least_one_cell_probed=4 of 30; stress_answers_probe_verified=0. (MET-F6)"
  chair_note: "This is the meta-finding the other four are symptoms of. The Methodologist names it directly (MET-F6, convergence_verdict: accreting). The Economist's saturation curve, the Engineer's 3/144 reach, and the Practitioner's 5-of-30 feature-flow coverage are all the same gap seen from four axes. NOT thrashing — no rev undoes a prior one, the design is coherent — but accretion is not convergence. The methodology cannot yet be judged on its running behaviour because it has not run."
  routed_to: human-verify

- rank: 6
  finding: "Two index files are at 81–98% of the agent context-load limit — imminent hard blocker"
  raised_by: [Economist]
  severity: HIGH
  evidence: "test-map.yaml 784,445 bytes ≈ 98% of a ~800KB practical load limit; concepts.yaml 647,447 bytes ≈ 81%. Growth ~62KB/batch (test-map) and ~56KB/batch (concepts). test-map exceeds limit within ~2 batches. (ECO-F2, ECO-F3)"
  chair_note: "Single-expert, but the byte counts are direct measurements. The Economist's own independence note correctly flags that bytes are a proxy for tokens and Claude's BPE compresses repetitive YAML — so this is a near-limit WARNING, not a proven failure. Routed to cut-this-step because the fix is subtraction (shard the index), not addition. Maintainer must confirm the true token count."
  routed_to: cut-this-step

- rank: 7
  finding: "No change-impact summary layer — scoping a proposed change requires reading a full 561-line sidecar"
  raised_by: [Practitioner]
  severity: HIGH
  evidence: "getPopular sidecar is 561 lines; the pagination-scoping answer is spread across 3 non-adjacent sections. TASK-2 required a 2-artefact read to assemble the change-impact answer APPROACH.md §1 item 2 promises as a structured map. (PRA-F1)"
  chair_note: "The content that fulfils APPROACH.md §1's impact-analysis promise EXISTS — the Practitioner completed all 3 tasks with zero source opens — but it is not pre-assembled into one artefact. This is an ergonomics/form gap, not an absence gap. The Practitioner's own independence note flags the score may be 1-2 points generous because an LLM navigates a 561-line file faster than a human in a terminal would."
  routed_to: approach-rev

- rank: 8
  finding: "LSN closed-status is self-declared by the incident author with no independent-evidence requirement (proposed un-named Failure H)"
  raised_by: [Methodologist]
  severity: MEDIUM
  evidence: "LSN-020 and LSN-021 both authored and marked status:closed on 2026-05-21 with no process-change checklist and no closure-evidence entry; LSN-019 (open) shows the correct shape — explicit checklist, concrete measurable closure condition, status held open. (MET-F4, MET un_named_failure_modes H)"
  chair_note: "Directly relevant to this panel's own Rule-5 mandate: a 'closed' LSN whose fix is a prompt instruction (Failure F) is closed on paper, open in practice. The LSN-019 checklist pattern is the fix model. See lsn_regression_check below — this run found no closed-LSN rediscovery, but finding rank 2/3 confirm LSN-019's fix is incomplete, which is exactly why LSN-019 being still-open is correct."
  routed_to: lsn-candidate

## contested_findings

# Lite mode — no Phase-2 memos. These are divergent Phase-1 readings, not rebutted findings.

- finding: "Coverage axis severity of the component-tier scan-scope gap (leader election, scheduled jobs)"
  raised_by: Adversary (ADV-F2/F3 — MEDIUM; the substrate's 5 entry-point axes structurally exclude service/component-tier concurrency code; SC-7 MISSED-SILENT)
  disputed_by: "not disputed by a peer — surfaced as contested because the Adversary's own scoring is internally ambivalent"
  raiser_basis: "PostgreSQLLeaderElectionManagerImpl is the single-leader primitive for four subsystems and has no node and no sidecar; 2 of 8 spot-checks fell in this gap (25% scope-shortfall on a load-bearing sample)."
  disputer_basis: "The Adversary itself notes (independence_self_assessment) that a stricter reading makes SC-7 SCOPE-EXCLUDED rather than MISSED-SILENT — the class is genuinely outside the declared 5 axes, so it is arguably a known scope boundary, not a miss. That reading lifts pass rate to 5/7=0.71 and the band stays AMBER regardless."
  chair_note: "Unresolved — maintainer to decide. The substantive question is a design choice the panel cannot make for the maintainer: should the substrate gain a service/component axis, or should APPROACH.md state explicitly that non-entry-point code is covered only transitively via feature-flows and accept the blind spot? Either is defensible; the methodology currently does neither (it neither covers it nor declares it out of scope). Routed in what_must_improve rank 5-adjacent."

- finding: "Whether the rev 2→6 accretion is a methodology risk or expected sprint behaviour"
  raised_by: Methodologist (convergence_verdict: accreting — flags it as the dominant Process concern)
  disputed_by: "the Methodologist's own report (it states explicitly 'this is not thrashing — no rev undoes a prior one, no layer is obsoleted')"
  raiser_basis: "Five major structures in 72h, additions not shrinking (rev 6 is the largest since rev 2), none exercised end-to-end — convergence requires the honest-coverage axes to trend up across batches and there is no prior data point."
  disputer_basis: "Each individual revision is locally justified and triggered by a real class-level miss; the layering shows genuine structural understanding; no rework. By that reading it is focused sprint work under a hard deadline, not loss of control."
  chair_note: "Unresolved — maintainer to decide. This is genuinely a judgement only the maintainer holds (MET needs_human_verification names it: 'whether the 72-hour accretion felt like thrashing or focused sprint work is evidence no artefact can capture'). The panel's position: the accretion is defensible AS DESIGN; the risk is purely that execution has not caught up — which is finding rank 5 and is actionable without re-litigating the revision history."

## what_went_well

- "Where the Stress Protocol has run, it is the genuine article. The Engineer independently re-derived ReactiveTagRepositoryImpl's §stress_findings line-by-line jOOQ trace from source (ReactiveTagRepositoryImpl.java:138-167) — paginate() applies ORDER BY tag.id ASC LIMIT size before count aggregation, the outer ORDER BY count DESC re-ranks only the truncated pool, no tiebreaker. 'A senior engineer reading the same code generates exactly these questions.' (Engineer, DP-3)"
- "HIGH-confidence factual claims hold under adversarial falsification. The Skeptic opened 8 HIGH-confidence claims against primary source at the repo commit and falsified zero — exact file:line matches including a real typo (`lasEventId`), a non-SecureRandom RNG, and a cross-mode security whitelist inconsistency. The sidecar authoring discipline produces accurate claims. (Skeptic, CAL-1..CAL-8)"
- "The ontology over-delivers where it has been enriched. The Adversary's getPopular spot-check (SC-3) found not just the view_count DESC ranking but the inflation surface, the missing index, the pre-traffic id-DESC degeneration, and a probed integration cell (P-006) — 'this is the depth the methodology is aiming for'. Four of five Adversary passes were over-delivered, not bare. (Adversary, SC-1/SC-3/SC-4/SC-8)"
- "Layer 4b (feature-reflector) pays for itself. The Practitioner answered the Activity-Feed userIds onboarding question (it filters by USER_OWNER_MAPPING.OWNER_ID, not who-performed-the-action) entirely from feature-reflections/index.yaml — an answer the controller sidecar alone does not surface; it required the cross-file top-down pass. (Practitioner, TASK-3)"
- "The methodology is candid about its own limits. The Methodologist credits the honest-coverage metric split (vanity vs stress-verified vs reflection-verified) as 'the right instrument', and the panel's own correlated-blind-spot risk is stated openly in APPROACH.md §16.3 and the ADR — 'unusual candor for a self-assessment system'. The retrospective format has a coherent causal chain per LSN and no two LSNs name the same fix. (Methodologist, what_went_well)"
- "Cross-artefact redundancy is low and the methodology distinguishes citation from duplication. The Economist verified REFACTOR-ID cross-references in concepts.yaml are citations (7 IDs, 100% also canonical in refactoring-scopes.md), not copies; incremental-reducer mode showed 0 sidecar-quality re-verification failures across 20+ batches. (Economist, redundancy_assessment)"

## what_must_improve

# Ranked. Every item routed.

- rank: 1
  item: "Update all four reducer index files (test-map.yaml, refactoring-scopes.md, implicit-adrs.md, doc-gaps.md) and feature-flows.yaml from their detail/ directories — 1,147 findings are currently invisible. Then add an index-sync step to the next-batch driver's Phase 3 so a batch cannot commit detail files without updating the index."
  severity: CRITICAL
  routed_to: backlog-item
  source_finding: "Economist-ECO-F1 + Practitioner-PRA-F5"

- rank: 2
  item: "Build a static post-emit validator (validate_sidecar.py or extend coverage.py) that mechanically enforces the five rejection criteria — empty-stress-on-triggered-node, missing reflection, zero-hypothesis reflection, banned phrases, pillar-count band — and wire it into next-batch Phase 3 before the commit step. The word 'REJECTED' in the agent contracts must have an executor."
  severity: HIGH
  routed_to: new-gate
  source_finding: "Methodologist-MET-F1 + Methodologist un-named Failure F"

- rank: 3
  item: "Run the Stress Protocol across the remaining 141 pre-stress sidecars — at minimum the 13 jOOQ repositories not yet stress-equipped, starting with ReactiveDataEntityRepositoryImpl (the busiest repository). Until this lifts well above 3/144, the honest-coverage denominator is non-representative and the depth claim is unbacked."
  severity: HIGH
  routed_to: approach-rev
  source_finding: "Engineer-ENG-F1 + Methodologist-MET-F1"

- rank: 4
  item: "Implement the probe-runner→sidecar feedback loop: add a `status` field to the probe schema, and a step that flips an originating sidecar's confidence from PROBE-NEEDED to PROBE-VERIFIED when its probe-run outcome is PASS. The 9 PASS runs from 2026-05-19 should retroactively upgrade their sidecars."
  severity: HIGH
  routed_to: new-gate
  source_finding: "Skeptic-SKE-F2 + Methodologist-MET-F7"

- rank: 5
  item: "Wire the feature-reflector into the next-batch autonomous driver's Phase 2 reducer fan-out — it is non-negotiable per Rule 15 but is absent from the orchestrator, so 29 of 30 features are permanently un-reflected under /loop. Same for closing the substrate-scope decision: either add a service/component axis or state in APPROACH.md that non-entry-point code is covered transitively only."
  severity: HIGH
  routed_to: approach-rev
  source_finding: "Methodologist-MET-F2 + Adversary-ADV-F3"

- rank: 6
  item: "Shard test-map.yaml and concepts.yaml into a summary index + detail/ before either hits the agent context-load limit (test-map within ~2 batches). The index+detail/ pattern already exists in the methodology — extend it. Confirm the true token count first; the byte measurement is a proxy."
  severity: HIGH
  routed_to: cut-this-step
  source_finding: "Economist-ECO-F2 + Economist-ECO-F3"

- rank: 7
  item: "Author the maiden panel acceptance-gate corpus (maintainer-authored gold set + seeded-defect corpus per APPROACH.md §16.4). Until it passes, every panel report — including this one — is provisional. Implement coherence_sweep.py (LSN-018's named fix, also a cited panel-blind-spot mitigation). Add a closure-evidence requirement and the LSN-019-style checklist to every LSN before it may be marked closed."
  severity: MEDIUM
  routed_to: human-verify
  source_finding: "Methodologist-MET-F3 + Methodologist-MET-F5 + Methodologist-MET-F4"

## lsn_regression_check

- regression_found: false

The chair read every `retrospectives/LSN-*` (LSN-001 through LSN-021) and cross-checked
each panel finding — in particular the Adversary's one COVERED-WRONG and one
MISSED-SILENT, and the Skeptic's calibration failures — against every LSN marked
`status: closed`. **No panel finding is a fresh rediscovery of a closed LSN.** That is
a genuine and meaningful negative result: the case-law that has been closed (LSN-001
through LSN-017, LSN-020, LSN-021) is not visibly recurring in the current artefacts.

Two clarifications the maintainer should hold:

- The Adversary's ADV-F1 (COVERED-WRONG: a HIGH-severity security invariant carrying
  wrong file:line citations — "confident misinformation") and the Engineer's ENG-F1
  (Stress Protocol reaches 3/144) are independent rediscoveries of the **LSN-019**
  failure class. LSN-019 is `status: open` — so this is **confirmation of an open
  LSN, not a regression against a closed one.** It is, however, strong independent
  evidence that LSN-019 must stay open until its fix has a structural executor.
- MET-F3 (coherence_sweep.py unimplemented) maps to **LSN-018**, also `status: open`.
  Same reading: a confirmed-still-open LSN, not a closed-LSN regression.

The absence of a closed-LSN regression is encouraging but weakly evidenced this run:
the panel experts were blind to the LSNs (correct, per design), but lite mode ran no
Phase-2 corroboration, and the panel has not passed its acceptance gate. A future
full-mode run is the real test of regression-freedom.

## cost

ontology_cost_verdict: |
  The Economist's verdict is cost_trend: RISING — but for a benign reason. ~7,345
  tokens/finding at the index count, ~3,773/finding at the true detail count.
  test-coverage-mapper marginal yield fell 42% (42→25 gaps/batch) — assessed as
  expected saturation (early batches hit high-density controller/auth nodes first),
  not a methodology defect. The real cost story is not redundancy (LOW-MODERATE,
  cross-artefact text redundancy is low) — it is 6.9 MB of orphaned detail files and
  the index/detail divergence (finding rank 1) that makes 62% of output invisible.
  cut-this-step candidates the Economist surfaced: orphaned detail re-indexing,
  test-map/concepts sharding, retired historical comment blocks, selective reducer
  activation for small batches.
panel_run_cost: |
  7 agent invocations (lite mode — 6 Phase-1 experts + chair; Phase-2 cross-examination
  skipped). Phase-1 experts measured ~700K tokens total. The Economist's own estimate
  put a full 13-invocation run at ~630K tokens (~9% of the ~7M-token sprint); this
  lite run is cheaper in invocations but the Phase-1 measurement came in higher.
panel_earns_keep: yes
# The maiden run surfaced one CRITICAL finding (1,147 invisible findings — recoverable
# in a single index-update pass) plus an imminent context-bloat hard-blocker. Either
# finding alone justifies the run cost. The panel earns its keep on this run.
consecutive_no_actionable_findings: 0
# Self-kill criterion (APPROACH.md §16.5): pause the panel after 3 consecutive runs
# with no actionable finding. This run has 8 consensus findings — counter resets to 0.

## correlated_blind_spot_caveat

This panel is six Claude-family agents auditing artefacts built by Claude-family agents.
Unanimity among them is weak evidence — treat it as one correlated draw, not six. The
findings above carry weight only from their cited evidence. The maintainer's own
spot-checks remain the panel's only fully independent oracle.

Every expert flagged this exposure concretely and it must be taken seriously here:
the Adversary noted that on SC-1/SC-3 it and the file-analyser traced the *same short
functions* (a shared misread is improbable but non-zero) and that on SC-4 it took the
"9 affected methods" enumeration partly on the methodology's own evidence; the
Methodologist read APPROACH.md's eloquent self-description before judging it and
cannot fully immunise against the framing effect; the Engineer is asserting NEGATIVES
on DP-1/DP-2 ("the ontology generates no catching question") — and a negative is
exactly what a shared blind spot hides, because if the Spring proxy-bypass / jOOQ
NULL-field traps are also outside the Engineer's idiom set, it would not have invented
those probes; the Skeptic shares the training distribution that makes fluent Java
reasoning *look* correct, especially for reactive execution-order semantics it could
not verify without running the code; the Practitioner notes an LLM navigates a
561-line sidecar faster than a human in a terminal, so the Usefulness score (7) may be
1–2 points generous.

validation_status: pre-acceptance-gate

**This panel has NOT yet passed its maiden acceptance gate** (per APPROACH.md §16.4
and the Adversarial Review Panel ADR — Cohen's κ ≥ 0.60 vs maintainer labels, recall
≥ 0.80, seeded-defect detection ≥ 0.80, ECE ≤ 0.15). The gold set and seeded-defect
corpus must be maintainer-authored and **do not yet exist** (the validation/ directory
is empty). Therefore **every finding in this report is PROVISIONAL** — corroborate
each against primary source before acting. Additionally this is a **lite-mode** run:
Phase-2 cross-examination was skipped, so no finding was tested by an adversarial peer
memo. The verdict GO-WITH-CHANGES and the score 5.7 should be read as a first
calibration point, not an authoritative grade.

needs_human_verification:
- "ECO-F1 — confirm whether the 2026-05-21 index-update was intentionally deferred or is a genuine defect (index files are older than detail files in git history)."
- "ECO-F2 / ECO-F3 — the ACTUAL token count of test-map.yaml and concepts.yaml in a real reducer invocation context (not the byte proxy used here); Claude's BPE compresses repetitive YAML, so the load-limit findings may be near-limit warnings rather than hard failures."
- "SC-6 / ADV-F1 — grep ReactiveSearchFacetRepositoryImpl.java for `ftsCondition`, confirm there are six call-sites (117/145/182/267/469/582), correct the tsquery-injection invariant's cited lines, and confirm none of the six sites is dead code behind an unreachable branch."
- "SC-4 / ADV-F2 — verify the ontology's '9 list-shape methods omit EXCLUDE_FROM_SEARCH' enumeration is complete against cteDataEntitySelect's actual consumers (the Adversary verified only the Popular path and the findByState exception)."
- "SC-7 / ADV-F3 — decide whether leader-election / scheduled-job / component-tier code being outside the substrate's 5 axes is acceptable (transitive feature-flow coverage only) or warrants a new substrate axis. The methodology currently neither covers it nor declares it out of scope."
- "DP-1 / DP-2 — a maintainer with Spring + jOOQ expertise should confirm no sidecar anywhere generates the 'is this @Transactional honoured by the proxy?' question or the jOOQ String-keyed-field-resolution fragility question, and decide whether the fix is a new stress category or a pillar gate."
- "MET-F5 — only the maintainer can author the maiden acceptance-gate corpus (gold set + seeded-defect corpus); no agent can substitute, by design."
- "MET-F6 — the maintainer's own judgement on whether the 72-hour rev-2→6 accretion was focused sprint work or loss of control; this is evidence no artefact can capture."
- "MET-F7 — whether lineage/_extractor/probe-runtime/runner.py exists and is executable against the current docker-compose stack."
- "SKE-F2 — confirm the probe-run→sidecar feedback path does not already exist as a designed-but-later slice of the dynamic-verification ADR before building it fresh."
- "CAL-7 — whether the null-vs-ALL dual path in ActivityServiceImpl.java:103-117 has any reactive-context (MDC / security-context) divergence the static read missed."
- "PRA-F3 — a human maintainer should attempt a scope-a-change task on one of the 25 unenriched features (e.g. Alert status change, Lineage depth) to measure the RED-zone experience the three chosen tasks did not surface."

## definition_of_done   # maiden run only

This is a **proposal for the maintainer to ratify**. It is derived from APPROACH.md §1's
eight promises + the reflexive self-audit commitment, the honest-coverage axes
(APPROACH.md §14), and the CLAUDE.md mission. Once ratified, every later panel run
grades the methodology against it; until ratified it has no force.

The methodology has **hit its target for odd-platform** when all of the following hold
at a single measured commit:

1. **Honest coverage, not vanity coverage.** `stress_verified_pct ≥ 0.80` computed over
   a denominator of **all enriched sidecars** (not 3) — and that denominator covers
   **≥ 90% of substrate nodes** that carry Stress-Protocol triggers (tunables / name-verbs
   / orderings / auth gates / resource boundaries / request-input names). The vanity
   axis (`nodes_with_sidecar / total`) is reported for trend continuity only.
2. **Every claimed-fix LSN is structurally closed.** No `status: closed` LSN whose fix
   exists only as a prompt instruction. Every closed LSN carries a closure-evidence
   entry naming the probe-run / scan-pass / batch ID that validated it (the LSN-019
   checklist pattern, applied retroactively). LSN-018 and LSN-019 are closed against
   real executors, not promises.
3. **The eight §1 promises are demonstrably answerable from artefacts.** A maintainer
   (or a Practitioner-style agent) completes one task per promise — onboarding, impact
   analysis, ADR archaeology, test-coverage lookup, security/performance posture,
   doc-drift, feature-flow, control-matrix — **from the ontology with zero forced
   source opens**, and the task set is drawn from a *randomly chosen* feature, not a
   pre-enriched one. (Today: 3/3 on enriched features, 0% confidence on the 25
   unenriched — promise 7's feature-flow index covers 5 of 30.)
4. **Index/detail integrity.** Zero divergence between every reducer index and its
   detail/ directory — `indexed_count == detail_file_count` for all five reducers.
   No tracked finding is invisible to a consumer reading the index.
5. **No structural gate is prompt-only.** Each of the five rejection criteria
   (APPROACH.md §5 Rules 13/15 + the banned-phrase and pillar-count checks) has a
   non-LLM executor that runs before the batch commit. coherence_sweep.py exists and
   runs.
6. **The probe loop is closed.** A probe-run with `outcome: PASS` mechanically upgrades
   its originating sidecar's confidence to `PROBE-VERIFIED`; `stress_answers_probe_verified`
   is non-zero and tracked per batch.
7. **The methodology has been run end-to-end at least once at its current (rev-6) scope**
   — substrate scan → domain-extractor → Stress-Protocol enrichment → probe-runner →
   reducers + feature-flow-builder + feature-reflector → coherence-sweep → panel — on a
   substrate scanned *after* rev 6, with the honest-coverage axes recorded per batch as
   a time series (so convergence is observable, not asserted).
8. **The panel itself is validated.** The maiden acceptance gate (APPROACH.md §16.4) has
   passed against a maintainer-authored corpus; panel reports are no longer marked
   `pre-acceptance-gate`. The trend.md scorecard shows a non-decreasing curve across
   ≥ 3 runs with consensus-finding count trending down — convergence, not accretion.

A pragmatic reading for the sprint: items 1, 3, 4, 6 are *measurable progress* the
sprint can drive toward; items 2, 5, 7, 8 are *closure conditions* that mark the
target genuinely hit. The methodology is "on track" (this run's verdict) when items
1/3/4/6 are trending up; it has "hit the target" when all eight hold at one commit.

## trend_row

| 2026-05-21 | GO-WITH-CHANGES | 5.7 | Cov 6 Proc 5 Cost 4 Depth 6 Use 7 Hon 6 | 8 | Maiden lite run — sound architecture, specified ahead of execution; 62% of findings invisible (stale indexes), Stress Protocol at 3/144, no closed-LSN regression |
