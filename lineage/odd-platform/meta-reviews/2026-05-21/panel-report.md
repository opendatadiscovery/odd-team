---
panel_run: 2026-05-21
commit_anchor: ede5d277
mode: full
is_maiden_run: false
verdict: GO-WITH-CHANGES
overall_score: 5.7
overall_band: AMBER
prior_panel: 2026-05-21
validation_status: pre-acceptance-gate
---

# Panel Report — 2026-05-21 (full run)

The **second** panel run and the **first full-mode** run: `RAW_DIR` holds six Phase-1
reports AND six Phase-2 cross-examination memos. The maiden run (2026-05-21-a1) was lite
mode and is the `prior_panel` for the scorecard delta. Phase 2 produced **real
cross-examination**: one disputed finding (contested below), three severity adjustments
on independent evidence, and — notably — the Skeptic self-corrected its own Phase-1 CAL-4
verdict from `holds` to `over-confident` (recorded in `what_went_well`).

## target

measured_against: `target.md` v1.0 — ratified_by_maintainer: yes (ratified 2026-05-21).
The target is a ratified v1.0 artefact, so the verdict is **not** provisional on the
target itself — only on the panel's own pre-acceptance-gate status (see caveat).

Mission: *the odd-platform ontology exists so the ODD maintainer can hold the published
docs — then tests, then features — to a publishing standard, with every user-facing claim
traceable to the code that enforces it; a queryable, code-anchored, self-maintaining model
that turns O(n) code exploration into O(1) lookups and makes doc/test/code drift
mechanically discoverable.*

The eight "hit" conditions: (1) honest coverage — `stress_verified_pct ≥ 0.80` over a
denominator covering ≥ 90% of trigger-bearing substrate nodes; (2) every closed LSN
structurally closed with closure-evidence; (3) the eight §1 promises answerable with zero
forced source opens on a randomly chosen feature; (4) zero index/detail divergence; (5) no
structural gate is prompt-only — each rejection criterion has a non-LLM executor,
`coherence_sweep.py` exists and runs; (6) the probe loop closed — a PASS probe-run
mechanically upgrades its sidecar to `PROBE-VERIFIED`; (7) the methodology run end-to-end
once at current scope on a post-revision substrate, honest-coverage axes recorded as a time
series; (8) the panel validated through the maiden acceptance gate, `trend.md` non-decreasing
across ≥ 3 runs. On-track = conditions 1/3/4/6 trending up; hit = all eight true at once.

proposed_refinement (routed `target-refinement`; chair suggests, does not edit): condition 1
should name a concrete denominator source. Three experts measured the live Stress-Protocol
denominator differently this run (manifest: 3 sidecars / 25 questions; live coverage.py:
8 / 53) — the condition would be sharper specifying the *live* `coverage.py` run as
authoritative, not the committed manifest, which can go stale.

## verdict

**GO-WITH-CHANGES**

The methodology is the right architecture and the full-mode run confirms it: where it has
been *run*, the depth is senior-engineer-grade — two independent tracers (Adversary +
Engineer) re-derived jOOQ operator-precedence, reactive blocking-call, Spring primitive-binding,
and unguarded-`JSON.parse` diagnoses from primary source and agreed on every one; the Skeptic
falsified zero of 10 HIGH-confidence factual claims; the panel's own ratified explicit target
(the LSN-022 fix) is load-bearing this run. None of this is in doubt.

But the run is blunt about what the maiden run could only infer: **the accretion debt has
hardened into an operational blocker, not just methodology lag.** `test-map/index.yaml` is at
157% of the agent load limit — a hard stop that halts the next reducer batch mid-run *today*;
the methodology has generated more artefact surface than its own reducer infrastructure can
ingest in one pass. The headline depth metric is a canary: the Stress Protocol — the rev-4
interrogation layer the entire honest-coverage claim rests on — reaches 8 of 147 enriched
sidecars (5.4%) against a target demanding 90%. The probe loop is open: 9 PASS probe-runs
produced zero `PROBE-VERIFIED` upgrades. And one HIGH-severity security claim is **confidently
inverted** — the collector token RNG described as insecure `ThreadLocalRandom` when the pinned
`commons-lang3 3.18.0` makes it `SecureRandom` — propagated through three artefact tiers
including the `concepts/index.yaml` catalog, uncaught by the coherence sweep.

This is `GO-WITH-CHANGES`, not `STRUCTURAL-RETHINK`, because every one of these is an
execution-and-enforcement debt against a sound design — no axis is RED, no closed LSN
regressed, the revision history is incident-driven not epicyclical. It is not `GO` because a
CRITICAL load-stop and a confidently-wrong security claim cannot sit under a clean verdict.
The path is unchanged from the maiden run and now sharper: shard the oversized indices, run
the Stress-Protocol backfill, close the probe loop, build the non-LLM gates, correct the
inverted RNG claim, run the methodology end-to-end once at current scope, pass the panel's
own acceptance gate. Do those and it hits the target.

## scorecard

| Axis | Expert | Band | Score | Δ vs prior |
|---|---|---|---|---|
| Coverage | Adversary | AMBER | 6 | 0 |
| Process | Methodologist | AMBER | 5 | 0 |
| Cost | Economist | AMBER | 5 | +1 |
| Depth | Engineer | AMBER | 7 | +1 |
| Usefulness | Practitioner | AMBER | 6 | -1 |
| Honesty | Skeptic | AMBER | 5 | -1 |
| **Overall** | — | **AMBER** | **5.7** | 0.0 |

Overall = mean(6,5,5,7,6,5) = 5.67 → **5.7**. Band: no RED axis, every axis AMBER →
**AMBER**. The score is flat vs the maiden 5.7 — Cost +1 and Depth +1 offset by Honesty −1
and Usefulness −1. The movements are not noise: Honesty and Usefulness fell **because the
now-ratified target made previously-implicit conditions explicit and measurable** (condition
1's denominator requirement; condition 3's randomly-chosen-feature requirement) — the
methodology did not regress, the yardstick sharpened. Cost rose because the maiden's dominant
defect (62% invisible findings) genuinely improved to 25.8%. The verdict is coherent with the
scorecard: no RED axis and no critical LSN regression rules out `STRUCTURAL-RETHINK`; six
AMBER axes plus a CRITICAL consensus finding rules out `GO`.

## fresh_spot_check_ledger

The Adversary's eight blind spot-checks against odd-platform @ ede5d277:

- SC-1 | V0_0_85 internal_description 255→unbounded column-width migration | negative-space | MISSED-SILENT | n/a
- SC-2 | ReactiveLineageRepositoryImpl.lineageCte recursive-CTE depth/cycle bound | boundary | COVERED-CORRECT | HIGH
- SC-3 | FileServiceImpl.uploadFileChunk chunk-index handling + non-FilePart reject | capability | COVERED-CORRECT | HIGH
- SC-4 | WebhookNotificationSender.send outbound request shape (headers/signing/status) | random-walk | COVERED-CORRECT | HIGH
- SC-5 | TokenGeneratorImpl.generate/regenerate collector-token RNG source | negative-space | **COVERED-WRONG** | HIGH
- SC-6 | SearchServiceImpl.getFacets/getFilterOptions faceted-search enumeration | capability | COVERED-CORRECT | HIGH
- SC-7 | helpers.ts bytesToKb/bytesToMb file-size unit conversion | random-walk | COVERED-CORRECT | MEDIUM
- SC-8 | TokenGeneratorImpl.regenerateToken in-place row mutation / no audit | boundary | COVERED-CORRECT | MEDIUM

Pass rate 5/7 = 0.71 (SC-1 MISSED-SILENT, SC-5 COVERED-WRONG, zero SCOPE-EXCLUDED). One
COVERED-WRONG caps the Coverage axis at AMBER per the rubric.

## consensus_findings
# Ranked by cited-evidence strength + severity. NOT by headcount (Rule 3).

- rank: 1
  finding: "test-map/index.yaml at 157% of the agent load limit — a hard stop for the next reducer batch TODAY"
  raised_by: [Economist, Practitioner]
  severity: CRITICAL
  evidence: "wc -c test-map/index.yaml = 1,257,706 bytes vs 800 KB limit (200K tokens × 4 bytes/token); 157%. Independently re-measured by the Practitioner (same command, identical result). Grew 60% since the maiden run (784,445 → 1,257,706 bytes) in 8 batches. The incremental test-coverage-mapper must load this file whole before processing — at 1.26 MB it exhausts the context budget before any sidecar content arrives. (ECO-F1, PRA-F2-corroboration)"
  routed_to: cut-this-step

- rank: 2
  finding: "Target condition 1 denominator structurally unmet — the Stress Protocol reaches 5.4% of enriched sidecars, not the 90% the target requires"
  raised_by: [Skeptic, Methodologist, Engineer, Practitioner]
  severity: HIGH
  evidence: "coverage.py live (2026-05-21): 8 sidecars carry a stress_findings section out of 147 enriched = 5.4%; 139 sidecars pre-date the Stress Protocol and contribute zero stress questions. The 90.6% stress_verified_pct headline is accurate over its 53-question / 8-sidecar scope but that scope is one island. target.md condition 1 requires the denominator to cover ≥ 90% of trigger-bearing nodes. Four experts reached this independently from four access paths (coverage.py run / manifest read / depth probe / task simulation) — convergence on independent evidence, not a correlated draw. (SKE-F2, MET-F3/Failure-G, ENG-F1, PRA-F5)"
  routed_to: approach-rev

- rank: 3
  finding: "Probe-runner feedback loop architecturally absent — 9 PASS probe-runs produced zero PROBE-VERIFIED sidecar upgrades; target condition 6 unmet"
  raised_by: [Skeptic, Engineer, Methodologist]
  severity: HIGH
  evidence: "probe-runs/2026-05-19-P-001..P-009.yaml all outcome: PASS; grep 'confidence: PROBE-VERIFIED' across 147 sidecars = 0 matches (the 2 textual hits are aspirational prose, not confidence labels — Adversary Phase-2 confirmed); probes/P-001..P-009.yaml carry no `status:` field — there is no schema to mark a probe resolved. manifest stress_answers_probe_verified = 0. LSN-019's closure condition explicitly requires PROBE-VERIFIED ≥ 1 — unmet. (SKE-F3, ENG-F2, MET-F1)"
  routed_to: new-gate

- rank: 4
  finding: "Collector token RNG described as insecure (ThreadLocalRandom) when pinned commons-lang3 3.18.0 makes it SecureRandom — a confidently-inverted HIGH-severity security claim propagated through three artefact tiers"
  raised_by: [Adversary, Engineer]
  severity: HIGH
  evidence: "F-020.yaml:358-359 + concepts/index.yaml:2289-2290,4922 assert 'delegates to ThreadLocalRandom in commons-lang 3.16+, NOT SecureRandom'. Ground truth: gradle/libs.versions.toml:10 pins apache-lang='3.18.0'; Apache RELEASE-NOTES record 3.18.0 'Reimplement RandomUtils and RandomStringUtils on top of SecureRandom#getInstanceStrong()' — verified by the Engineer via WebFetch as a second independent tracer (3 of 8 Adversary claims re-traced, 3 agree, 0 disagree). The claim contradicts the project's OWN older sidecars (IngestionDataEntitiesFilter.md) which correctly treat the token as brute-force-infeasible without asserting RNG weakness. Skeptic escalated the calibration dimension to CRITICAL-on-Honesty; Methodologist to CRITICAL-on-Process. (ADV-F1, ENG Phase-2 reverification)"
  routed_to: lsn-candidate

- rank: 5
  finding: "Two claimed-fix LSNs (018, 019) remain open with unmet closure conditions — target condition 2 not met"
  raised_by: [Methodologist, Skeptic]
  severity: HIGH
  evidence: "retrospectives/LSN-018 + LSN-019 both status: open. LSN-019's closure gate ('Stress Protocol run on one full batch + PROBE-VERIFIED ≥ 1') is unmet — stress_answers_probe_verified = 0. LSN-018's gate (entity-index built + batch-O sweep success) is unmet — coherence/entity-index.yaml does not exist (ls confirmed). The open status is ACCURATELY signalled — this is not a process flaw, it is condition 2 honestly reporting itself unmet. (MET-F1, SKE-F3-corroboration)"
  routed_to: human-verify

- rank: 6
  finding: "The methodology has never been run end-to-end at its current scope — target condition 7 unmet; accretion debt now has a structural blocker the specification did not anticipate"
  raised_by: [Methodologist, Economist, Engineer, Practitioner]
  severity: HIGH
  evidence: "manifest last_scan_date = 2026-05-08, predates revs 2-6 (file-analyser/0.5.0, feature-reflector/0.1.0, panel rev 6). features_with_at_least_one_cell_probed = 4/30. trend.md has one row — no honest-coverage time series exists. Methodologist Phase-2 (MET-P2-N1): the end-to-end run is no longer just a scheduling matter — it requires structural reducer changes (test-map sharding, concepts backfill, index rebuilds) BEFORE the next full pass can succeed. (MET-F4, ECO Phase-2 corroboration, ENG-F1, PRA-F4)"
  routed_to: approach-rev

- rank: 7
  finding: "Stress-Protocol and reflection rejection criteria have no non-LLM executor — 'gate-as-prompt' (un-named Failure F); target condition 5 unmet"
  raised_by: [Methodologist, Engineer]
  severity: HIGH
  evidence: "APPROACH.md §5 Rules 13/15 state 'IS REJECTED' / 'is incomplete' / 'is rejected at validation' — the enforcer is the LLM agent reading the instruction, the same agent that can emit an empty stress_findings block when context-constrained. coherence_sweep.py exists (the one non-LLM gate); there is NO equivalent validator for stress_findings completeness or reflection existence; next-batch SKILL.md Phase 3 has no such step. ENG-F3 is direct evidence: a numeral-vs-list arithmetic contradiction ('Three of the 27' then a list of TEN) survived into a stress-complete / confidence-HIGH ActivityHandler sidecar. (MET-F2, ENG-F3, MET Phase-2 severity-adjust)"
  routed_to: new-gate

- rank: 8
  finding: "refactoring-scopes (53.7%) and implicit-adrs (62.1%) remain severely index/detail-orphaned — 401 real findings invisible to index consumers; target condition 4 unmet"
  raised_by: [Economist, Adversary]
  severity: HIGH
  evidence: "refactoring-scopes: 240 indexed / 518 detail = 278 orphans; implicit-adrs: 75 indexed / 198 detail = 123 orphans (Adversary Phase-2 re-counted, exact match). REFACTOR-241..518 and ADR-CANDIDATE-076..198 are valid committed detail files invisible to a consumer reading the index. An index-rebuild pass surfaces all 401 at near-zero token cost — rebuild only, zero information loss. (ECO-F3, ADV Phase-2 corroboration)"
  routed_to: backlog-item

- rank: 9
  finding: "manifest.yaml stress metrics are stale — reports 3 sidecars / 25 questions / 88.0% when live coverage.py shows 8 / 53 / 90.6%; the panel measuring the target was mis-fed"
  raised_by: [Skeptic, Economist, Practitioner]
  severity: HIGH
  evidence: "manifest stress_questions_total: 25, sidecars_with_stress_section: 3, stress_verified_pct: 88.0; coverage.py live: 53, 8, 90.6%. The stale direction is benign (true is better than reported). BUT the Adversary's Phase-2 severity adjustment is decisive: three experts (MET-F3, ECO, PRA-F5) reasoned their Phase-1 findings off the stale 3-sidecar figure. A manifest that mis-feeds the panel measuring the target is a panel-integrity defect, not a MEDIUM housekeeping note — escalated MEDIUM→HIGH. coverage.py --write-manifest must run after every batch that touches stress sidecars. (SKE-F1, ADV Phase-2 severity-adjust, ECO + PRA corroboration)"
  routed_to: backlog-item

- rank: 10
  finding: "Layer 4b (feature-reflector) covers 1 of 30 features — the product-owner reflection is structurally absent for 97% of features"
  raised_by: [Practitioner]
  severity: HIGH
  evidence: "feature-reflections/detail/ contains 1 file (F-021); feature-flows/detail/ contains 30 (F-001..F-030). For 29 features a maintainer asking 'does this feature deliver what it promises users?' has no Layer 4b artefact. Single-expert but mechanically reproducible (a directory glob); not disputed by any peer in Phase 2 (Practitioner Phase-2 position_held). Target condition 3 (§1 promises 7-8) is not met for any feature except F-021. (PRA-F4)"
  routed_to: approach-rev

- rank: 11
  finding: "concepts/index.yaml frozen at sidecar_count 55 while 147 sidecars exist — 92 sidecars of concept extraction absent from the catalog, and the inverted RNG claim is in that catalog with no refresh path"
  raised_by: [Economist, Adversary]
  severity: HIGH
  evidence: "concepts/index.yaml sidecar_count: 55 vs manifest nodes_with_own_sidecar: 144/147 live. Batch-ZA investigator-log: 'concept-merger FAILED (socket error)'. The catalog powers criticality ranking for test-coverage-mapper and doc-gap-finder — those reducers rank against a partial concept graph. Adversary Phase-2 new-finding: the rank-4 inverted RNG claim is IN concepts/index.yaml (lines 2289-2290, 4922), and because the catalog is frozen at 55 the wrong claim has no refresh path to be corrected. (ECO-F2, ADV Phase-2 new_finding)"
  routed_to: backlog-item

## contested_findings

- finding: "PRA-F1 — feature-flows/index.yaml is 'not loadable as a unit' / 'exceeds the read-tool's 256 KB limit'"
  raised_by: Practitioner
  disputed_by: Adversary
  raiser_basis: "TASK-2 (impact analysis) hit a forced navigation step: the practitioner reports the 318-326 KB feature-flows index exceeds a 256 KB Read limit and required grep-offset navigation — a genuine blocker for a human maintainer without shell access; scored HIGH."
  disputer_basis: "The Adversary read feature-flows/index.yaml directly this run with NO error; the Economist read it whole too (ECO-F4 measured it at 326,330 bytes / 41% of the 800 KB agent budget). No hard 256 KB Read limit was observed in play. The real defect is navigation friction, not a load-stop — the genuine load-stop is ECO-F1 (test-map at 1.26 MB)."
  chair_note: |
    Partially resolved by Phase 2 itself. The Practitioner's OWN Phase-2 memo concedes the
    point: it adjusts PRA-F1's framing downward to 'navigation-friction finding, not an
    operational hard stop of the class ECO-F1 represents' while keeping HIGH for Usefulness.
    The disagreement is now narrow and the panel converges: the feature-flows index imposes
    grep-workaround overhead (real, HIGH for usefulness — a 326 KB file is above a
    comfortable single-Read and dents the §1 O(1)-lookup promise); it is NOT a loader crash.
    The chair carries it as a HIGH usefulness-friction finding, not double-counted against
    the CRITICAL ECO-F1 load-stop. The "256 KB limit" claim specifically is treated as NOT
    VERIFIED (two experts read the file whole); the friction finding stands on file size.

## what_went_well

- "Two independent tracers did not diverge on the hardest finding. The Engineer re-traced 3 of the Adversary's 8 ground-truth claims (the COVERED-WRONG plus one COVERED-CORRECT plus the MISSED-SILENT) against primary source — 3 agree, 0 disagree. On the inverted RNG claim specifically the Engineer WebFetched the Apache 3.18.0 release notes as a second oracle. The Adversary did not share the methodology's blind spot. (Engineer Phase-2)"
- "The Skeptic self-corrected its own Phase-1 verdict — the panel's adversarial machinery worked on the panel itself. Phase-1 CAL-4 graded the RNG claim `holds`; the Skeptic's Phase-2 memo revises it to `over-confident`, naming the exact failure (it confirmed the call-site lexically but never checked the library version semantically) and routing it as an internal approach-rev finding (SKE-P2-F1). A panel that catches its own calibration miss in cross-examination is the cross-examination earning its keep. (Skeptic Phase-2)"
- "HIGH-confidence factual claims hold under adversarial falsification. The Skeptic opened 10 HIGH-confidence claims against primary source across two sidecar generations (file-analyser/0.2.0 and 0.4.0) and falsified zero — exact file:line matches including a real typo (`lasEventId`), a String.equals token comparison, and a four-call-site `ownerIds`-silent-drop asymmetry that needs four signatures read simultaneously to verify. Claim accuracy — the most important calibration signal — is clean. (Skeptic, CAL-1..CAL-10)"
- "Depth is senior-engineer-grade where the methodology has reached. All four Engineer depth probes returned would-catch with source-verified, consequence-correct diagnoses: jOOQ `.or().and()` operator precedence (verified verbatim against AlertHousekeepingJob.java:30-34, with the parenthesised fix), the `.block()`-inside-transaction anti-pattern with the correct scheduler-thread-vs-event-loop consequence distinction, Spring `private int` `@ConfigurationProperties` binding to 0, and an unguarded `JSON.parse` in a `useMemo`. The ontology maintains grep-anchored NEGATIVE invariants ('zero .block() calls — verified by grep') that turn a future regression into a detectable contradiction. (Engineer, DP-1..DP-4)"
- "The revision history is incident-driven, not speculative — and the panel's own one-day-old LSN-022 fix is load-bearing. Each APPROACH rev has exactly one triggering LSN; the layering rule is respected (lower layers never depend on higher ones, verified across file-analyser / feature-flow-builder / feature-reflector). LSN-022's fix — the ratified explicit target with the Rule-0 / target_lens protocol — was shipped and is wired into every expert this run; the maiden run committed the implicit-target failure and the second run corrected it. (Methodologist, what_went_well)"
- "The maiden run's dominant defect genuinely improved. Index/detail orphan rate dropped from 62% (maiden) to 25.8%; test-map orphan rate specifically fell from 65% to 1.9% — the VAL-LSN-019-B batch rebuilt that index effectively. feature-flows/detail has 30 files with zero orphans. The methodology acts on its own panel findings. (Economist, what_went_well)"

## what_must_improve
# Ranked. Every item routed.

- rank: 1
  item: "Shard test-map/index.yaml to a summary-row index (~80 bytes/entry) with full bodies staying in detail/ — reduces the index from 1.26 MB to ~200 KB and unblocks the next reducer batch. This is the single most urgent action in the methodology; no further enrichment batch can run until it is done. Apply the same preventive shard to feature-flows/index.yaml (326 KB, 41%) and concepts/index.yaml before they become the next hard stops."
  severity: CRITICAL
  routed_to: cut-this-step
  source_finding: "Economist-ECO-F1 + Economist-ECO-F4"

- rank: 2
  item: "Build a pre-commit non-LLM validator (extend coverage.py or a new validate_sidecar.py) that mechanically enforces the rejection criteria — empty stress_findings on a triggered node, missing reflection, zero-hypothesis reflection, banned phrases, pillar-count band — AND checks numeral-vs-list-length self-consistency in stress_findings (the ENG-F3 ActivityHandler contradiction class). Wire it into next-batch Phase 3 as step 3.6, before commit. The word 'REJECTED' in the agent contracts must have an executor."
  severity: HIGH
  routed_to: new-gate
  source_finding: "Methodologist-MET-F2 + Engineer-ENG-F3 (Failure F)"

- rank: 3
  item: "Implement the probe-runner → sidecar feedback loop: add a `status` field to the probe schema and a step that flips an originating sidecar's confidence from PROBE-NEEDED to PROBE-VERIFIED when its probe-run outcome is PASS. The 9 PASS runs from 2026-05-19 should retroactively upgrade their sidecars. Until this exists, the honest metric's probe tier is permanently 0 and target condition 6 cannot be met. Also convert the 8 P-LSN019-*.md narrative probe-skeletons into the canonical YAML shape the probe-runner can execute."
  severity: HIGH
  routed_to: new-gate
  source_finding: "Skeptic-SKE-F3 + Engineer-ENG-F2"

- rank: 4
  item: "Correct the inverted collector-token RNG claim in all three artefact tiers (F-020.yaml, the CollectorController + regenerateCollectorToken sidecars, concepts/index.yaml) — commons-lang3 3.18.0 backs RandomStringUtils with SecureRandom. Then add the Gate-4/Gate-9 extension ADV-F2 names: any sidecar claim about framework/library RUNTIME behaviour must cite the resolved dependency version from the build manifest (libs.versions.toml / pom.xml / package.json), not just the library name. Author this as an LSN — it is a class (version-blind library-behaviour reasoning), not a one-off typo."
  severity: HIGH
  routed_to: lsn-candidate
  source_finding: "Adversary-ADV-F1 + Adversary-ADV-F2"

- rank: 5
  item: "Run the Stress-Protocol backfill across the ~139 pre-protocol sidecars so the stress_verified_pct denominator covers ≥ 90% of trigger-bearing nodes. The Economist flags this 29-batch backfill is infeasible until rank-1 (test-map shard) is done — sequence rank 1 first. Until the denominator is representative, the 90.6% headline is a 5.4%-scope figure and target condition 1 is unmet."
  severity: HIGH
  routed_to: approach-rev
  source_finding: "Skeptic-SKE-F2 + Methodologist-MET-F3 + Engineer-ENG-F1 + Practitioner-PRA-F5"

- rank: 6
  item: "Run coverage.py --write-manifest after every batch that adds or modifies a stress-protocol sidecar, and add this step to the next-batch driver checklist. The manifest is what the panel reads to measure the target — a stale manifest mis-fed three experts this run. The fix is a one-line checklist addition."
  severity: HIGH
  routed_to: backlog-item
  source_finding: "Skeptic-SKE-F1 (escalated MEDIUM→HIGH by Adversary Phase-2)"

- rank: 7
  item: "Rebuild the refactoring-scopes and implicit-adrs indexes from their detail/ directories — 401 valid committed findings (REFACTOR-241..518, ADR-CANDIDATE-076..198) are invisible to index consumers. Run concept-merger over the 92 unprocessed sidecars to un-freeze concepts/index.yaml from sidecar_count 55. Then add an index-sync assertion to next-batch Phase 3 so a batch cannot commit detail files without updating the index. Zero information loss — rebuild only."
  severity: HIGH
  routed_to: backlog-item
  source_finding: "Economist-ECO-F2 + Economist-ECO-F3"

- rank: 8
  item: "Wire the feature-reflector into the next-batch autonomous driver so Layer 4b runs on every feature, not 1 of 30. Add a top-level `feature_flow_ids` back-reference field to the sidecar schema (PRA-F2 — a node sidecar currently has no forward pointer to the feature-flows it participates in, forcing a grep of the oversized index for every impact-analysis task). The PRA-F2 × PRA-F1 compound directly blocks target condition 3's zero-forced-opens requirement."
  severity: HIGH
  routed_to: approach-rev
  source_finding: "Practitioner-PRA-F4 + Practitioner-PRA-F2"

- rank: 9
  item: "Run the methodology end-to-end once at its current (rev-6) scope on a substrate scanned after the latest APPROACH revision — substrate scan → domain-extractor → Stress-Protocol enrichment → probe-runner → reducers + feature-flow-builder + feature-reflector → coherence-sweep → panel — with the honest-coverage axes recorded per batch as a time series. This is target condition 7 and the precondition for every later panel run grading running behaviour rather than specification. Sequence after ranks 1 and 7 (the reducer infrastructure must be unblocked first)."
  severity: HIGH
  routed_to: human-verify
  source_finding: "Methodologist-MET-F4 + Methodologist-MET-P2-N1"

- rank: 10
  item: "Add a `migrations` substrate axis OR document in APPROACH.md that db/migration/*.sql schema history is explicitly out of scope. SC-1 (the 255→unbounded internal_description column-width change) was missed because the ~90-file migration directory is not a declared substrate axis — schema-history changes (column-width, NOT NULL additions, default changes, hard-delete migrations) are exactly the operator-facing caveat class the methodology exists to catch. The methodology currently neither covers it nor declares it out of scope."
  severity: MEDIUM
  routed_to: approach-rev
  source_finding: "Adversary-ADV-F3"

- rank: 11
  item: "Build the LSN-018 entity-index.yaml reverse index (coherence/entity-index.yaml does not exist) so the coherence sweep is O(N) not O(N×M) as registries grow; and engage the reactive transactional/Reactor-context-propagation idiom class (ENG-F4) — the reactive sidecars catch the .block() blocking-call trap but never ask 'does this operator chain preserve the transaction context?', a genuine would-miss for one sub-class of the reactive idiom. Update feature-anchored-ontology.md to cover revs 4-5 (currently 2 revisions behind)."
  severity: MEDIUM
  routed_to: backlog-item
  source_finding: "Methodologist-MET-F5 + Engineer-ENG-F4 + Methodologist-MET-F6"

- rank: 12
  item: "Author the maiden panel acceptance-gate corpus — the maintainer-authored gold set + seeded-defect corpus per APPROACH.md §16.4 (κ ≥ 0.60, recall ≥ 0.80, seeded-defect detection ≥ 0.80 / ≥ 0.90 data-loss-security, ECE ≤ 0.15). Until it passes, every panel report including this one is pre-acceptance-gate and provisional. No agent can substitute — by design."
  severity: MEDIUM
  routed_to: human-verify
  source_finding: "Methodologist-MET-F7"

## lsn_regression_check

- regression_found: false

The chair read every `retrospectives/LSN-*` (LSN-001..022; all `status: closed` except
the `open` LSN-018 and LSN-019) and cross-checked each panel finding — the Adversary's
COVERED-WRONG (SC-5) and MISSED-SILENT (SC-1), the Skeptic's revised CAL-4 miss — against
every closed LSN. **No panel finding is a clean rediscovery of a closed LSN.** The
negative result is genuine: the experts were blind to the LSNs. Three observations the
maintainer must hold — none a strict regression, two near-misses worth flagging:

- **rank-4 (inverted token RNG) is a NEAR-MISS against the closed LSN-002 — flagged.**
  LSN-002 closed the class "a third-party library/SDK default the methodology never
  verified against the real environment"; its Gate-5 rule is scoped to SDK **builder
  parameters**. The inverted RNG claim is the sibling sub-class — a version-dependent
  behaviour of a library method that IS being called. Gate 5 never claimed that sub-class,
  so this is not a regression — but it is the second time the methodology has been burned
  by an unverified third-party-library assumption. The rank-4 lsn-candidate should be
  authored as explicitly extending the LSN-002 family, not as a fresh unrelated lesson.
- **rank-2/3/7 confirm the OPEN LSN-018 and LSN-019 — not regressions.** LSN-019 is open
  precisely because its closure condition (Stress Protocol on a full batch + PROBE-VERIFIED
  ≥ 1) is unmet; LSN-018 because the coherence-sweep entity-index is unbuilt. The panel
  corroborating both at HIGH severity is strong evidence they must STAY open.
- **rank-4's propagation past coherence_sweep.py is evidence the LSN-018 fix does not yet
  close its full class.** The inverted claim contradicts the project's own older sidecars
  on the same `TokenGeneratorImpl` entity — exactly the cross-artefact contradiction
  LSN-018's Rule 6 exists to catch — but a version-dependent library-fact error leaves no
  lexical entity-name fingerprint a grep-based sweep matches. LSN-018's eventual fix must
  reach beyond entity-name grep matching.

## cost

ontology_cost_verdict: |
  cost_trend: RISING — and for the first time the rise is a hard blocker, not benign
  saturation. ~5,100 tokens per indexed finding (~3,771 at the detail count — the 41% gap
  quantifies the indexing debt); marginal test-coverage-mapper yield fell 57% (batches K-M
  ~42 gaps/batch → batches V-onward ~18). The decisive fact: the 29-batch Stress-Protocol
  backfill needed for condition 1 is INFEASIBLE while test-map/index.yaml sits at 157% of
  the agent load limit — the reducer cannot load its own prior state. Cost is no longer a
  redundancy story (redundancy is LOW-MODERATE); it is structural inaccessibility — ~15-20%
  of artefact volume orphaned, the working set overflowing reducer ingest capacity. The
  fixes are all subtraction (shard the indices, rebuild from detail/) at near-zero cost.
panel_run_cost: |
  13 agent invocations (full mode — 6 Phase-1 + 6 Phase-2 memos + chair). Measured:
  Phase-1 ~860K tokens, Phase-2 ~516K; with the chair, ~1.4M total — roughly 2× the maiden
  lite run's ~700K, ~20% of the ~7M-token sprint. Earns its keep: ECO-F1 alone (the
  test-map hard stop) catches a blocker that would halt the next reducer batch mid-run —
  preventing one wasted batch (~225K tokens) is a positive return.
panel_earns_keep: yes
# This run produced one CRITICAL finding (test-map hard stop), corrected the maiden
# run's score on two axes against the now-explicit target, and the Phase-2
# cross-examination materially changed the picture (a self-corrected Skeptic verdict,
# a disputed finding narrowed, three severity adjustments on independent evidence).
# Full mode earned its ~2× cost over lite this run.
consecutive_no_actionable_findings: 0
# Self-kill criterion (APPROACH.md §16.5): pause the panel after 3 consecutive runs with
# no actionable finding. This run has 11 consensus findings — counter stays at 0.

## correlated_blind_spot_caveat

This panel is six Claude-family agents auditing artefacts built by Claude-family agents.
Unanimity among them is weak evidence — treat it as one correlated draw, not six. The
findings above carry weight only from their cited evidence. The maintainer's own
spot-checks remain the panel's only fully independent oracle.

Two cautions specific to this run. First — rank-4 (the inverted RNG claim) was caught only
because the Adversary read the version pin and the Engineer WebFetched the Apache release
notes; the Skeptic's Phase-1 pass MISSED it and graded the claim `holds`. A confidently-wrong
library-version fact is exactly the shared-training blind spot this panel is most exposed to
("RandomStringUtils is insecure" is a once-true, now-stale training fact). The panel caught
this one; it cannot guarantee it caught every instance of the class. Second — ENG-F4 flags
that an LLM tracer pattern-matches the visible `.block()` smell far more readily than the
fingerprint-less "this chain dropped the transaction context" smell; reactive-context traps
may be systematically under-probed by a panel of LLM tracers.

validation_status: pre-acceptance-gate

**This panel has NOT yet passed its maiden acceptance gate** (APPROACH.md §16.4 + the
Adversarial Review Panel ADR). The maintainer-authored gold set and seeded-defect corpus
do not yet exist (`meta-reviews/validation/` holds only a README). Therefore **every
finding in this report is PROVISIONAL** — corroborate each against primary source before
acting. The verdict `GO-WITH-CHANGES` and the score 5.7 are a second calibration point,
not an authoritative grade. The `trend.md` curve is now two rows; condition 8 requires
≥ 3 non-decreasing rows with consensus-finding count trending down before the panel's
own output can be trusted as a convergence signal.

needs_human_verification:
- "rank-4 / SC-5 — confirm the resolved commons-lang3 version on the actual classpath is 3.18.0 (a Spring Boot BOM override could in principle land it below 3.15.0); the Adversary sourced 3.18.0 from libs.versions.toml:10 but did not resolve the full dependency graph. The 3.15.0+ → SecureRandom mapping is the load-bearing fact behind rank-4."
- "rank-1 / ECO-F1 — confirm the actual token count of test-map/index.yaml in a real reducer invocation context; byte counts proxy tokens and Claude's BPE compresses repetitive YAML, so the margin over the limit (not the direction) is uncertain."
- "rank-2/5 / MET-F1 — whether batch VAL-LSN-019-B partially met the LSN-018/019 closure conditions requires reading that batch's updated sidecars directly; the batch exists but whether it produced PROBE-VERIFIED > 0 is unconfirmed."
- "rank-3 / SKE-F3 — confirm a probe-run → sidecar-confidence-update mechanism does not already exist as a designed-but-later slice of the dynamic-verification-layer ADR before building it fresh."
- "SC-6 — the 'no owner scoping in the six facet aggregators' claim relies on the ontology's cited ReactiveSearchFacetRepositoryImpl line ranges, not an independent re-read; worth a maintainer glance."
- "ENG-F4 — a maintainer should check whether any existing @ReactiveTransactional chain (ActivityAspect, DataEntityServiceImpl write paths) already loses transaction context across a flatMap/publishOn boundary; if one does, ENG-F4 escalates from new-gate to a live bug."
- "DP-3 — a maintainer with reactor expertise should confirm the @Scheduled housekeeping .block() truly runs off the Netty event loop on this Spring Boot 3 / WebFlux config."
- "rank-12 / MET-F7 — only the maintainer can author the maiden acceptance-gate corpus; no agent can substitute, by design."

## trend_row
| 2026-05-21 | GO-WITH-CHANGES | 5.7 | Cov 6 Proc 5 Cost 5 Depth 7 Use 6 Hon 5 | 11 | First full run — design sound, accretion debt now a hard blocker (test-map index at 157% of load limit); Stress Protocol at 5.4% of sidecars, probe loop open, one inverted HIGH-severity RNG claim; no closed-LSN regression |
