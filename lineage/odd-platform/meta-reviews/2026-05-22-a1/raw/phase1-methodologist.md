---
panel_run: 2026-05-22
phase: 1
expert: panel-methodologist
axis: Process
commit_anchor: ede5d277
prompt_version: panel-methodologist/0.1.0
convergence_verdict: accreting
axis_score: 5
axis_band: AMBER
---

# Phase 1 — Methodologist (Process) assessment

## summary

The methodology is architecturally sound and every revision was incident-driven — there is no
epicycle in the causal chain. But at commit `ede5d277` the process is accreting, not converging:
eight revisions have added eight layers/protocols/stances, yet target conditions 2, 5, 6, and 7
remain structurally unmet, the probe-runner feedback loop does not close (9 PASS runs, zero
PROBE-VERIFIED upgrades), and rev 8 (section 0 / LSN-023) was added this panel run cycle after
the previous panel explicitly flagged its class — which means the panel itself has not yet produced
a measurable direction-change. The case-law loop is reactive and sound; the enforcement layer
(non-LLM gates, probe-runner merge, end-to-end execution) is the gap between the well-written
methodology and a methodology that converges.

## target_lens

For the Process axis the target conditions that matter most are **2, 5, and 7**: (2) every
claimed-fix LSN carries closure-evidence — not just `status: closed` with a prompt instruction;
(5) each rejection criterion has a non-LLM executor, `coherence_sweep.py` exists and runs; (7)
the methodology has been run end-to-end at least once at current scope, with honest-coverage axes
recorded as a time series. Condition 8 (panel validated through the maiden acceptance gate) is a
secondary concern for this axis. The concrete bar: no LSN is `closed` without a cited probe-run
or scan-pass; every `IS REJECTED` rule in `APPROACH.md §5` has a corresponding non-prompt
enforcer; `manifest.yaml` carries a second trend row showing honest-coverage movement. None of
these bars are met at this commit.

## claimed_fix_verification

- rev: 4
  failure_named: "Failure C — descriptive enrichment without interrogation (LSN-019)"
  fix_mechanism: "Stress Protocol bolted into file-analyser as non-negotiable pre-emit phase;
    Rule 13 in APPROACH.md §5; section 14 Stress Protocol documentation"
  verdict: closes-the-instance-only
  evidence: |
    The mechanism is correctly specified in `.claude/agents/file-analyser.md Rule 9` and
    `APPROACH.md §14`. But the closure condition LSN-019 itself names is: *"promote to closed
    only after Stress Protocol has run on at least one full batch and produced PROBE-VERIFIED ≥
    1."* `manifest.yaml:stress_answers_probe_verified = 0`. `retrospectives/LSN-019:status =
    open`. 20 of 159 sidecars carry a stress_findings section; 139 are pre-protocol
    (`manifest.yaml:sidecars_pre_stress_protocol = 139`). The fix as written is mechanically
    sound for new sidecars; it does not close the class because the backfill pass it requires
    has not run and the probe-runner merge step that would produce PROBE-VERIFIED is
    architecturally broken (probe-run artefacts show `artefacts_updated: []` uniformly —
    confirmed at `lineage/odd-platform/probe-runs/2026-05-19-P-001.yaml:artefacts_updated`).
    `LSN-019` is `status: open`; target condition 2 is explicitly measuring this.

- rev: 5
  failure_named: "Failure D — bottom-up assembly without product-owner reflection (LSN-020)"
  fix_mechanism: "Category F added to Stress Protocol; Layer 4b feature-reflector subagent added
    (APPROACH.md §15, rule 15)"
  verdict: closes-the-instance-only
  evidence: |
    `LSN-020:status = closed` — the LSN itself calls this closed, and the subagent contract
    (`.claude/agents/feature-reflector.md`) is well-specified. But target condition 10
    (target.md v1.1 — features must not carry `ui-incomplete`, and no feature flow may
    terminate at the backend) is NOT yet met: `lineage/odd-platform/feature-reflections/`
    contains exactly 1 file (`F-021.yaml`); 30 of 31 feature flows have no Layer 4b reflection
    (glob-confirmed). Category F is in the file-analyser prompt, but 139 of 159 sidecars were
    enriched before `file-analyser/0.5.0` and do not contain Category F data. The fix closes
    the specific LSN-020 incident; it does not close the class because execution of the new
    layer is at 3% of scope.

- rev: 6
  failure_named: "Failure E — methodology cannot audit itself (LSN-021)"
  fix_mechanism: "Adversarial Review Panel added as §16 + Rule 16; target.md introduced (LSN-022
    fix)"
  verdict: closes-the-class
  evidence: |
    The panel mechanism is structurally sound. LSN-021 and LSN-022 are both `status: closed`.
    The panel has run twice (`trend.md` has two rows), and on the second run it independently
    re-derived findings at the same severity as the maiden run — it is behaving as an
    independent oracle. The correlated-blind-spot residual risk is acknowledged in
    `APPROACH.md §16.3` and the validation gate is not yet passed
    (`panel-report.md:validation_status = pre-acceptance-gate`), but the structural fix is
    correctly specified and executing. One caveat: the panel's own maiden acceptance gate
    (target condition 8) has not passed — the panel cannot fully self-certify. That is not a
    claimed-fix failure; it is an open condition correctly labelled.

- rev: 8
  failure_named: "Operating bar never written down — ontology built without UI (LSN-023)"
  fix_mechanism: "APPROACH.md §0 'The operating stance' added; rules 17-19 added; section 6
    Step 3 updated; subagent contracts amended (file-analyser Rule 0, feature-flow-builder
    ui-incomplete gate, feature-reflector Rule 9)"
  verdict: closes-the-instance-only
  evidence: |
    The mechanism correctly addresses the LSN-023 failure. `file-analyser.md Rule 0` and
    `feature-flow-builder.md` both carry `ui-incomplete` language (confirmed via grep).
    However the fix is a prompt-instruction fix: file-analyser Rule 0 warns against the
    junior's answer but has no non-LLM gate that rejects a sidecar enriched without UI
    component reads. The substrate still has no `ui-interaction` axis — `manifest.yaml:axes`
    contains `ui_shell` and `ui_routes` but not the component/form/modal tree that
    `APPROACH.md §0.3` declares mandatory for user-facing products. `F-031.yaml` still carries
    `drift_class_summary: [permission_side_door, ...]` — the specific wrong finding that
    LSN-023 names — with no `ui_unverified: true` flag visible in the committed artefact.
    The class closure requires substrate re-scan with a UI interaction axis added; that has
    not happened.

## un_named_failure_modes

- proposed: "Failure F — gates exist as prose, not executors; the enforcement chain is LLM-to-LLM"
  mechanism: |
    APPROACH.md §5 rules 13, 14, 15, 17, 18, and 19 each state that certain conditions cause
    a sidecar, feature flow, or finding to be REJECTED. The enforcer of every one of these
    rejections is the LLM agent reading the rule instruction — the same agent that, under
    context pressure, produces the empty `stress_findings` block or the UI-absent feature flow
    that the rule is supposed to reject. `coherence_sweep.py` exists (APPROACH.md §12 cross-
    reference) but validates cross-artefact internal consistency, not stress-section
    completeness or reflection existence. There is no non-LLM script that opens a sidecar and
    checks `stress_summary.triggers_total > 0` or `stress_findings != []` for nodes with
    visible numeric literals; no script that checks `feature-reflections/detail/F-NNN.yaml`
    exists for every `feature-flows/detail/F-NNN.yaml`. The 139 pre-protocol sidecars
    coexist in the registry with no automated flag, and the manifest's own stale metrics
    (25 questions vs live 53 questions) passed undetected until the previous panel measured
    them.
  evidence: |
    `APPROACH.md §5 rule 13` — "a sidecar with triggers_total == 0 IS REJECTED";
    enforcer = the file-analyser prompt, not a script.
    `probe-runs/2026-05-19-P-001.yaml:artefacts_updated = []` — the probe-runner runs but
    does not write back; the merge step that would flip confidence to PROBE-VERIFIED is not
    executing. `manifest.yaml:stress_questions_total = 25` vs `coverage.py` live = 53 (prior
    panel report, rank-9 finding) — stale manifest survived commits undetected.
    `panel-report.md rank-7` — the previous panel named this Failure F at HIGH severity,
    routing to new-gate; it has not been closed.
  fix_shape: "A `validate-sidecars.py` script (companion to `coverage.py`) that rejects
    commits with sidecars missing stress_findings on trigger-bearing nodes; a
    `validate-reflections.py` that flags feature flows without a corresponding reflection;
    both run in CI / pre-commit, not just in the panel report."

- proposed: "Failure G — probe-runner feedback loop architecturally broken; all probes are
    perpetually pending"
  mechanism: |
    The Stress Protocol (rev 4) is designed to produce two outcomes: (a) STATIC-INFERRED
    answers in sidecars, and (b) PROBE-NEEDED questions emitted as probe skeletons at
    `probes/P-NNN.yaml`. The probe-runner is supposed to execute those skeletons, produce a
    probe-run artefact, and merge the measured outcome back into the sidecar as a
    `confidence: PROBE-VERIFIED` annotation. This merge is the mechanism that closes Failure C
    — it is what moves the methodology from "descriptive transcription" to "verified truth."
    But the probe-runner subagent's `Rule 4` merge step does not execute: every probe-run in
    `lineage/odd-platform/probe-runs/` carries `artefacts_updated: []`. Nine PASS probe-runs
    exist; zero PROBE-VERIFIED confidence labels exist in any sidecar. The probe-runner
    specification in `.claude/agents/probe-runner.md Rule 4` describes the merge correctly, but
    the runtime execution is not producing it — either because `runner.py` does not implement
    the merge path, or because the probe-runner subagent is not executing that step.
    This means target condition 6 is structurally unmet and `stress_verified_pct` will remain
    anchored at STATIC-INFERRED denominator forever regardless of how many probes PASS.
  evidence: |
    `lineage/odd-platform/probe-runs/2026-05-19-P-001.yaml:artefacts_updated = []` (confirmed
    by reading the file — same pattern for all nine runs). `manifest.yaml:
    stress_answers_probe_verified = 0`. `grep 'confidence: PROBE-VERIFIED'` across
    `lineage/odd-platform/understanding/` — 0 matches. `probe-runner.md Rule 4` specifies the
    merge; it is not executing.
  fix_shape: "Implement the `artefacts_updated` write-back in `runner.py`; add an integration
    test to `probe-runner.md`'s self-check step that verifies at least one sidecar was
    updated after a PASS run; make `stress_answers_probe_verified > 0` a CI gate."

## convergence_analysis

rev_history_shape: |
  Rev 1-3 (2026-05-12 to 2026-05-19): three revisions in 7 days, each adding a new layer
  (substrate / enrichment / reducers / Layer 0 mission anchor). Each was incident-triggered
  and architecturally coherent. Revisions were small and additive.
  
  Rev 4-5 (2026-05-20 to 2026-05-21): two revisions in 1 day, adding Stress Protocol +
  Category F + Layer 4b. Both were larger than rev 1-3 (new schema fields, new sidecar
  sections, new subagent, new APPROACH.md sections). Both were triggered by maintainer
  empirical tests that the methodology missed. The revisions were getting LARGER and the
  triggering miss-cycle was FASTER — a candidate thrash signal.
  
  Rev 6-7 (2026-05-21): two revisions on one day — panel + explicit target (rev 6) and
  the derived graph query layer (rev 7). Rev 6 is meta-level (the panel), a qualitatively
  different intervention (proactive rather than reactive). Rev 7 solves a concrete
  infrastructure problem (index bloat). Both are non-epicyclical.
  
  Rev 8 (2026-05-22): added section 0 operating stance, the same day as this panel run.
  This is the panel's own prior cycle (the previous panel flagged UI absence as a HIGH
  finding) producing a same-day methodology revision — which is exactly the proactive loop
  the panel was designed to enable. However the rev adds another section and three new rules
  rather than closing any open condition — the architecture grows rather than contracts.
  
  The shape: revisions are not getting smaller. The methodology in rev 8 is materially more
  complex than rev 1. But the complexity reflects genuine successive discoveries (each LSN
  is a real miss, each rev closes a real class). This is accretion, not thrash — the
  distinction is that each layer earns its place by closing a class the prior layer cannot
  see, not by patching the same class repeatedly. The accretion debt, however, is real: the
  layers added in revs 4-5 (Stress Protocol, Category F, Layer 4b) are each at <5% execution
  scope — layers whose existence is not in doubt but whose execution has not caught up to
  their specification.

honest_coverage_trend: |
  Two panel data points (both rows in trend.md):
  Run 1 (lite mode, 2026-05-21): Process axis score 5.
  Run 2 (full mode, 2026-05-21): Process axis score 5. No movement.
  
  The manifest-anchored metrics at commit ede5d277: 159/395 nodes with sidecar (40.3%
  vanity); 20 sidecars with stress section (12.6%); 0 PROBE-VERIFIED; 1/31 features with
  Layer 4b reflection. These are measured at a single commit — no time series exists
  (target condition 7 unmet). The direction cannot be confirmed as up or flat from artefacts;
  it requires a second substrate scan at a later commit with coverage.py output recorded.
  confidence: MEDIUM (single data point, no time series).

## findings

- id: MET-F1
  title: "Probe-runner feedback loop does not execute — all PROBE-VERIFIED upgrades are zero
    despite 9 PASS runs"
  severity: HIGH
  evidence: |
    `lineage/odd-platform/probe-runs/2026-05-19-P-001.yaml:artefacts_updated = []` — all nine
    probe-run artefacts carry empty `artefacts_updated`. `manifest.yaml:
    stress_answers_probe_verified = 0`. `grep 'confidence: PROBE-VERIFIED'` across
    `lineage/odd-platform/understanding/` = 0 matches. `probe-runner.md Rule 4` specifies the
    merge; the merge is not producing output.
  detail: |
    The Stress Protocol's honest-coverage axis (`stress_verified_pct`) is defined as
    `(STATIC-INFERRED + PROBE-VERIFIED) / total`. With PROBE-VERIFIED permanently at zero,
    the metric is structurally capped at the static-inferred fraction and can never improve
    through probe execution — only through more sidecars being written with STATIC-INFERRED
    answers. Target condition 6 ("a probe-run with outcome PASS mechanically upgrades its
    originating sidecar's confidence to PROBE-VERIFIED") is unmet. LSN-019's own closure
    condition requires PROBE-VERIFIED ≥ 1. The probe runner subagent contract in Rule 4
    specifies the write-back step but the runner.py implementation does not produce it,
    meaning the architectural promise and the execution reality diverged before the first
    probe was run (all nine runs predate any fix attempt).
  routed_to: new-gate
  confidence: HIGH

- id: MET-F2
  title: "Stress-Protocol and reflection rejection criteria are LLM-enforced only — no non-LLM
    executor closes the 'gate-as-prompt' failure (Failure F)"
  severity: HIGH
  evidence: |
    `APPROACH.md §5 rule 13` — "IS REJECTED" — enforcer is the file-analyser prompt. No
    `validate-sidecars.py` exists (Glob confirms — only `coverage.py` found in
    `lineage/_extractor/registry-shard/`). `manifest.yaml:sidecars_pre_stress_protocol = 139`
    shows 139 sidecars entered the registry without the gate that would reject them.
    `APPROACH.md §5 rule 15` — "a feature flow without a refresh-aged reflection is
    incomplete" — no script enforces this; 30 of 31 feature flows lack a reflection.
    Target condition 5 — "no structural gate is prompt-only" — is unmet.
  detail: |
    The gap is not about whether the Stress Protocol is correctly specified (it is). The gap
    is that the 139 pre-protocol sidecars are indistinguishable to a downstream reducer from
    the 20 stress-complete sidecars — both exist in the same `understanding/` directory with
    no enforced marker. A batch can add a new sidecar with empty stress_findings and no gate
    fires. This is the same failure class that LSN-019 itself cites as the root of the
    vanity-coverage problem: a metric that cannot distinguish thorough interrogation from
    shallow transcription. The fix requires a non-LLM script, not a stronger prompt.
  routed_to: new-gate
  confidence: HIGH

- id: MET-F3
  title: "LSN-019 status: open with closure condition unmet — the Failure C claimed fix does
    not close the class at current scope"
  severity: HIGH
  evidence: |
    `retrospectives/LSN-019:status = open`. LSN-019's own Process change checklist item:
    "Promote LSN-019 to closed only after the Stress Protocol has run on at least one full
    batch [...] and produced a non-empty stress_findings block per sidecar with at least one
    PROBE-VERIFIED resolution." `manifest.yaml:stress_answers_probe_verified = 0`.
    `manifest.yaml:sidecars_with_stress_section = 20` of 159 total. Target condition 2
    ("every claimed-fix LSN is structurally closed with closure-evidence") is unmet.
  detail: |
    LSN-019 is correctly labelled open — this is accurate signalling, not a process flaw.
    The problem is what the open status implies: the rev-4 fix (Stress Protocol) is specified
    and partially executing, but the claimed closure of Failure C rests on a probe-verified
    resolution that cannot happen because the probe-runner merge is broken (MET-F1). LSN-019
    and MET-F1 are causally linked: fixing MET-F1 unblocks LSN-019's closure path. Until then
    target condition 2 can be met for LSN-020, LSN-021, LSN-022 (all `closed`) but not for
    LSN-019, which is the highest-leverage LSN in the stack.
  routed_to: approach-rev
  confidence: HIGH

- id: MET-F4
  title: "Rev 8 (section 0 / LSN-023) adds three new rules but does not close any open target
    condition — and the specific F-031 wrong finding it names is still committed"
  severity: MEDIUM
  evidence: |
    `APPROACH.md §0` added 2026-05-22; `LSN-023:status = closed`. But
    `lineage/odd-platform/feature-flows/detail/F-031.yaml:drift_class_summary` still contains
    `permission_side_door` — the specific wrong finding LSN-023 names as evidence. The
    substrate still has no `ui-interaction` axis (`manifest.yaml:axes` = `ui_shell`,
    `ui_routes`, `controllers`, `openapi_tags`, `config_prefixes`). Rules 17-19 in
    `APPROACH.md` declare the UI interaction layer mandatory but do not require a substrate
    re-scan to validate the mandate is met. `file-analyser.md Rule 0` adds the operating
    stance but has no non-LLM rejection gate for sidecars enriched without UI reads.
  detail: |
    LSN-023 is `status: closed` but its claimed fix is prompt-only. The fix shape for
    LSN-023's class requires (a) a substrate re-scan adding a `ui-interaction` axis, (b) a
    batch of UI component sidecars enriched under `file-analyser/0.5.0`+, and (c) F-031
    re-composed with the UI chain resolved. None of these have happened; the committed artefact
    still carries the wrong finding. Closing an LSN without the artefact correction is the
    same pattern the methodology identifies as its own failure mode in condition 2. Severity
    MEDIUM (not HIGH) because the fix direction is correct and the artefact correction is a
    known pending batch, not an architectural question.
  routed_to: lsn-candidate
  confidence: HIGH

- id: MET-F5
  title: "Methodology has never been run end-to-end at current scope — target condition 7
    structurally unmet"
  severity: HIGH
  evidence: |
    `manifest.yaml:last_scan_date = 2026-05-08` predates revs 2-8 (all dated 2026-05-19 to
    2026-05-22). `manifest.yaml:features_with_at_least_one_cell_probed = 4` of 31.
    `lineage/odd-platform/feature-reflections/detail/` contains 1 file. `trend.md` has 2
    rows, both dated 2026-05-21 — no honest-coverage time series spanning before and after the
    rev 4-8 changes. Target condition 7 requires: "the methodology has been run end-to-end at
    least once at its current scope — substrate scan → domain-extractor → Stress-Protocol
    enrichment → probe-runner → reducers + feature-flow-builder + feature-reflector →
    coherence-sweep → panel — on a substrate scanned after the latest APPROACH revision."
  detail: |
    The substrate was scanned at commit `ede5d277` on 2026-05-08; the methodology has since
    acquired five new revisions (4-8), a new mandatory axis (UI interaction), a new subagent
    (feature-reflector), and an updated file-analyser (0.5.0 with Category F). The current
    artefact set is a partially-enriched, pre-revision substrate. The previous panel
    (rank-6 finding) also flagged this and noted it "is no longer just a scheduling matter —
    it requires structural reducer changes (test-map sharding, concepts backfill, index
    rebuilds) BEFORE the next full pass can succeed." That structural blocker (test-map at
    157% of load limit) is unresolved. An end-to-end run on the current scope is the single
    action that would simultaneously validate revs 4-8 and produce the time series that
    makes convergence observable.
  routed_to: approach-rev
  confidence: HIGH

## what_went_well

- "The case-law loop (LSN retrospectives) is mechanically sound — every LSN carries a named
  closure condition, and LSNs 020-023 were all closed with evidence, not just a status
  change. The format produces actionable artefacts, not blame documents. Evidence:
  `retrospectives/LSN-020:status = closed` + gates_informed list; `LSN-022:status = closed`
  + `target.md` as the artefact."

- "The panel's own design (APPROACH.md §16) correctly bounds its correlated-blind-spot risk
  by requiring code-anchored verdicts over unanimity. The previous run's self-correction
  (Skeptic upgrading its own CAL-4 verdict in Phase 2) is precisely the behaviour the
  design is meant to produce. Evidence: `panel-report.md:what_went_well`."

- "Rev 8 was produced the same cycle as the previous panel finding that triggered it — the
  proactive loop (panel → LSN-023 → section 0) actually fired. The pipeline from panel
  finding to APPROACH.md revision worked. Evidence: `trend.md` row 2 at 2026-05-21, then
  `APPROACH.md §0` revision history entry at 2026-05-22 citing LSN-023."

- "The probe specification quality is high — P-001 through P-009 carry concrete
  arrange/act/observe/assert with SQL fixtures, verified schema comments, and realism
  caveats. The probe artefacts themselves are production-quality and verifiable. The problem
  is the write-back step, not the probe design. Evidence: `lineage/odd-platform/probes/
  P-001.yaml` reviewed."

## axis_score

score: 5
band: AMBER
rationale: |
  Process rubric AMBER requires: the process works but shows accretion, ≥ 1 claimed-fix that
  does not close its class, or flat honest-coverage. All three conditions are present. The
  process works — each revision closes a real class, the case-law loop fires, the panel is
  running. Accretion is real but not thrash: eight revisions, each incident-driven, no
  epicycle. Two claimed-fixes do not close their classes at current scope (LSN-019 / Failure
  C, and rev-8 / LSN-023). Honest-coverage is not trending because the time series does not
  exist. The score does not reach 4 (RED band floor) because the architecture is sound and no
  structural flaw exists — the failures are enforcement and execution gaps against a correct
  specification, not wrong architecture. The score does not reach 6 (upper AMBER) because
  target conditions 2, 5, 6, and 7 are all unmet, the probe-runner feedback loop is broken,
  and the methodology has never been executed end-to-end at its current scope.

## independence_self_assessment

shared_blind_spot_risk: |
  I read APPROACH.md as both the methodology surface and the methodology's self-description
  — these are the same document, which means the framing I absorbed is the framing the
  methodology chose for itself. The rev history is written by the same minds that authored
  the revisions, and it presents each revision as incident-driven and locally rational (which
  it is) without a view from above of whether the incremental approach is converging. I may
  have under-weighted the convergence concern because the rev history's reasoning is
  persuasive, and I am the same model family that wrote it. Specifically, I accepted the
  distinction between "accretion" and "thrash" using the methodology's own vocabulary; a
  more adversarial assessment might find the 8-revision, 8-layer architecture to be
  structurally over-complex for the problem it solves. I do not find evidence for that view
  in the artefacts — but I acknowledge the risk that the framing is self-serving.

needs_human_verification:
  - "MET-F1 — the probe-runner merge failure. Verify whether runner.py implements the
    artefacts_updated write-back or whether the probe-runner subagent is not executing Rule
    4. The artefacts_updated = [] pattern is consistent across all 9 runs; a human reading
    runner.py source would determine whether this is a code gap or a subagent execution gap."
  - "MET-F4 — F-031 / LSN-023. Confirm the wrong `permission_side_door` finding in F-031
    is acknowledged as a pending correction rather than a deliberate retention, and that the
    LSN-023 `closed` status accurately reflects the maintainer's intent for a phased fix."
