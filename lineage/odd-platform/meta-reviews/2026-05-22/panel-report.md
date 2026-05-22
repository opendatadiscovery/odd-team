---
panel_run: 2026-05-22
commit_anchor: ede5d277
mode: lite
is_maiden_run: false
verdict: GO-WITH-CHANGES
overall_score: 5.2
overall_band: AMBER
prior_panel: 2026-05-21
validation_status: pre-acceptance-gate
---

# Panel Report — 2026-05-22 (lite run)

The **third** panel run and the **second lite-mode** run: `RAW_DIR` holds six Phase-1
reports and — this being lite mode — **no Phase-2 cross-examination memos**. The prior
run (2026-05-21, full mode) is the `prior_panel` for the scorecard delta. Without Phase 2
there is no cross-examination this run: no finding was adversarially re-tested by a peer,
no severity adjusted on a second expert's evidence, no disputed finding narrowed. The
findings below are each a single expert's Phase-1 position. That is a real reduction in
panel confidence relative to the full run — every finding's weight rests on its own cited
evidence and the chair's read of it, not on independent corroboration. Treated accordingly.

## target

measured_against: `target.md` v1.1 — ratified_by_maintainer: **partial** (v1.0 ratified
2026-05-21; v1.1 adds conditions 9-11, transcribed from `APPROACH.md` §0 and merged to
`main` by the maintainer 2026-05-22, but **pending the maintainer's explicit review of
their phrasing**). The verdict is therefore additionally provisional on conditions 9-11
until the maintainer ratifies their wording — v1.1's status line says so itself.

Mission: *the odd-platform ontology exists so the ODD maintainer can hold the published
docs — then tests, then features — to a publishing standard, with every user-facing claim
traceable to the code that enforces it; a queryable, code-anchored, self-maintaining model
that turns O(n) code exploration into O(1) lookups and makes doc/test/code drift
mechanically discoverable.*

The eleven "hit" conditions, compact: (1) honest coverage — `stress_verified_pct ≥ 0.80`
over a denominator covering ≥ 90% of trigger-bearing substrate nodes; (2) every closed LSN
structurally closed with closure-evidence; (3) the eight §1 promises answerable with zero
forced source opens on a randomly chosen feature; (4) zero index/detail divergence; (5) no
structural gate prompt-only — each rejection criterion has a non-LLM executor,
`coherence_sweep.py` runs; (6) the probe loop closed — a PASS probe-run mechanically
upgrades its sidecar to `PROBE-VERIFIED`; (7) the methodology run end-to-end once at
current scope on a post-revision substrate, honest-coverage axes recorded as a time series;
(8) the panel validated through the maiden acceptance gate, `trend.md` non-decreasing
across ≥ 3 runs with consensus-finding count trending down; (9) reverse-engineering rigor —
every operator-observable claim traced from code read end-to-end, never inferred-and-hedged;
(10) the UI interaction layer present as a substrate axis and enriched, threaded into every
feature flow, no feature `ui-incomplete`; (11) every feature flow carries a current
feature-reflector reflection at the senior-product-owner bar. On-track = conditions
1/3/4/6/9/10/11 trending up; hit = all eleven true at one commit.

proposed_refinement (routed `target-refinement`; chair suggests, does not edit): condition
1's denominator should name a single authoritative source. This run the six experts
reported the live stress denominator with small but real spread — 159 enriched (Adversary,
Skeptic, Engineer, Methodologist) vs the Economist's `ls understanding/` count of 164, and
the prior run measured 147. The condition would be sharper specifying the live `coverage.py`
run's `nodes_with_own_sidecar` field at the panel's `commit_anchor` as the one denominator
of record, with `understanding/` file count explicitly noted as a non-authoritative proxy
(it counts README/template files). This is the same refinement the prior run proposed; it
has not yet been actioned.

## verdict

**GO-WITH-CHANGES**

The architecture is sound and that is not in question — but this run says, more plainly
than the two before it, that **the gap between the methodology's specification and its
execution is not closing, and on two axes it widened.** Read the trend honestly: overall
score 5.7 (maiden) → 5.7 (full) → **5.2** (this run). The drop is real, not noise — Cost
fell 5→4 and Usefulness fell 6→4, and both falls are the same story: the rev-4/5 layers
(Stress Protocol, feature-reflector) are specified, the methodology keeps adding artefact
surface, but the execution scope of those layers has not moved while the cost of carrying
the un-executed surface compounds.

The hard facts the maintainer must act on. **The probe loop is still architecturally open
— `stress_answers_probe_verified` is exactly 0**, the same zero as the maiden run and the
full run, despite the stress channel growing 3→8→20 sidecars; three independent experts
(Methodologist, Skeptic, Engineer) traced it to the same root — the probe-runner's
write-back step does not execute, `artefacts_updated: []` on all nine PASS runs. **The
feature-reflector layer covers 1 of 30 features and this run could not even read its
output** — the Practitioner's product-owner-review task (target condition 11) returned
nothing, raised CRITICAL. **The Stress Protocol reaches 20 of 159 enriched sidecars
(12.6%) against a target demanding 90%** — and the Engineer's finding is sharper than a
percentage: `getPopular`, the consumer half of the *exact* surface LSN-019 is the case-law
for, is still on the pre-protocol `file-analyser/0.2.0` prompt; the backfill is not
sequenced by canonical-bug proximity. **`test-map/index.yaml` is now 1.44 MB** — the prior
run flagged it at 1.26 MB / 157% of the agent load limit and routed a CRITICAL shard
action; one run later it has grown another 180 KB, which is direct evidence the prior
panel's top-ranked finding was not acted on.

This is `GO-WITH-CHANGES`, not `STRUCTURAL-RETHINK`: no axis is RED, the revision history
remains incident-driven not epicyclical (Methodologist: accretion, not thrash), no closed
LSN regressed on a clean rediscovery, and where the methodology *has* run the depth is
genuine — the Adversary's four COVERED-CORRECT passes resisted the `CascadeDeleteException`
name-trap, the Skeptic falsified zero of 8 HIGH-confidence claims, the Engineer re-derived
the canonical LSN-019 bug to the line. It is not `GO` because a CRITICAL finding (the
absent feature-reflector layer) and an un-progressed probe loop cannot sit under a clean
verdict, and because the score is falling. The path is unchanged from both prior runs and
now urgent: **the panel has now told the maintainer the same five things three times**
(shard the index, close the probe loop, build the non-LLM gates, run the Stress backfill,
run the methodology end-to-end). The methodology will hit its target — the design supports
it — but only once execution catches up to specification. Adding an eighth and ninth
revision (rev 8 / §0 landed this very cycle) while ranks 1-3 from the prior report sit
unactioned is the pattern to break.

## scorecard

| Axis | Expert | Band | Score | Δ vs prior |
|---|---|---|---|---|
| Coverage | Adversary | AMBER | 6 | 0 |
| Process | Methodologist | AMBER | 5 | 0 |
| Cost | Economist | AMBER | 4 | -1 |
| Depth | Engineer | AMBER | 7 | 0 |
| Usefulness | Practitioner | AMBER | 4 | -2 |
| Honesty | Skeptic | AMBER | 5 | 0 |
| **Overall** | — | **AMBER** | **5.2** | -0.5 |

Overall = mean(6,5,4,7,4,5) = 5.17 → **5.2**. Band: no RED axis, every axis AMBER →
**AMBER**. The verdict is coherent with the scorecard: no RED axis and no clean closed-LSN
regression rules out `STRUCTURAL-RETHINK`; six AMBER axes plus a CRITICAL consensus finding
and a falling score rules out `GO`. The −0.5 movement is carried by Cost (−1) and
Usefulness (−2). Note the panel-composition caveat applies with force to the score itself:
this is a lite run, so unlike the full run the axis scores were not pressure-tested in
Phase-2 cross-examination — read the **trend direction** (down) and the **evidence-anchored
findings**, not the precise 5.2. The Usefulness −2 is the single sharpest signal: the
Practitioner scored 6 in the full run and 4 now, on the same `commit_anchor`, because this
run it attempted target condition 11 (the product-owner review) directly and found Layer
4b entirely absent — the yardstick (v1.1's conditions 10-11) sharpened and the methodology
was measured against it for the first time.

## fresh_spot_check_ledger

The Adversary's seven blind spot-checks against odd-platform @ ede5d277:

- SC-1 | AttachmentServiceImpl.getUploadOptions/uploadFileChunk — max-file-size enforcement | negative-space | COVERED-CORRECT | HIGH
- SC-2 | ActivityController.getActivity — `size` parameter boundary on the activity feed | boundary | COVERED-CORRECT | HIGH
- SC-3 | GenAIController.genAiQuestion — RBAC gate on POST /api/genai/ask | capability | COVERED-CORRECT | HIGH
- SC-4 | NamespaceServiceImpl.delete — delete of a namespace with attached resources | random-walk | COVERED-CORRECT | HIGH
- SC-5 | DataEntityRunController.getRuns — per-entity test/job runs list | capability | MISSED-SILENT | n/a
- SC-6 | V0_0_79__data_deprecation.sql — data-entity status migration / activity-row purge | negative-space | PARTIAL | MEDIUM
- SC-7 | AlertActionResolverImpl.toHalt — per-entity alert-halting suppression semantics | boundary | PARTIAL | MEDIUM

Pass rate 4/7 = 0.57 (AMBER band 0.5-0.8). **Zero COVERED-WRONG** this run — no confidently
inverted claim, a genuine improvement over the full run's one COVERED-WRONG (the inverted
RNG claim). One MISSED-SILENT on a load-bearing capability (`getRuns`) and two PARTIALs;
RED needs ≥ 2 MISSED-SILENT or ≥ 2 COVERED-WRONG, so Coverage stays AMBER. The four passes
were deep, not shallow — each interrogated a boundary or an absence.

## consensus_findings
# Ranked by cited-evidence strength + severity. NOT by headcount (Rule 3).

- rank: 1
  finding: "The probe-runner feedback loop does not execute — stress_answers_probe_verified is exactly 0 across 9 PASS runs and 32 PROBE-NEEDED items; target condition 6 unmet and un-progressed since the maiden run"
  raised_by: [Methodologist, Skeptic, Engineer]
  severity: HIGH
  evidence: "manifest.yaml: stress_answers_probe_verified = 0, stress_answers_probe_needed = 32. All 9 probe-run artefacts (probe-runs/2026-05-19-P-001..P-009) carry artefacts_updated: [] — the Methodologist confirmed this by reading the files directly. grep 'confidence: PROBE-VERIFIED' across understanding/ = 0 matches. probe-runner.md Rule 4 specifies the sidecar-confidence write-back; runner.py does not produce it. Three experts reached this independently from three access paths (Methodologist read the probe-run files; Skeptic read the probe-status fields — all 68+ probes carry status: pending-stress-protocol; Engineer counted the 32 PROBE-NEEDED skeletons against the 379 stress questions). The honest axis numerator is (STATIC-INFERRED + PROBE-VERIFIED); with the PROBE-VERIFIED term structurally pinned at 0, stress_verified_pct can never improve through probe execution. LSN-019's own closure condition requires PROBE-VERIFIED ≥ 1 — unmet. (MET-F1, SKE-F2, ENG-F2)"
  routed_to: new-gate

- rank: 2
  finding: "The feature-reflector layer (Layer 4b) is structurally absent — 1 of 30 features has a product-owner reflection; the eight-promise product-owner-review task returns nothing; target condition 11 entirely unmet"
  raised_by: [Practitioner, Methodologist]
  severity: CRITICAL
  evidence: "Practitioner: Glob for 'feature-reflector*' / 'reflector*' across lineage/odd-platform/ returns zero results in the feature-flows path; feature-flows.yaml header shows prompt_version: feature-flow-builder/0.1.0 with no reflector pass in batch_history; TASK-3 (senior-product-owner review of the Popular Entities feature) could not be started from the ontology — F-003 terminates at the backend CTE with zero product-owner reasoning. Methodologist corroborates: feature-reflections/detail/ contains exactly 1 file (F-021), glob-confirmed; rev-5's claimed fix for LSN-020 (Layer 4b) closes the LSN-020 instance but Category F + the reflector are at ~3% execution scope. Single-mode-but-mechanically-reproducible (a directory glob). CRITICAL because the product-owner review is the hardest, highest-value maintainer task for a UI-driven platform and the ontology delivers nothing for 29 of 30 features. (PRA-F1, MET-F2-rev5)"
  routed_to: approach-rev

- rank: 3
  finding: "Target condition 1 denominator structurally unmet — the Stress Protocol reaches 12.6% of enriched sidecars, not the 90% the target requires; the canonical-bug surface itself is still un-backfilled"
  raised_by: [Skeptic, Methodologist, Engineer, Economist, Adversary]
  severity: HIGH
  evidence: "manifest.yaml: sidecars_with_stress_section = 20, sidecars_pre_stress_protocol = 139, total enriched = 159 → 12.6% Stress-Protocol adoption. The 88.4% stress_verified_pct headline is arithmetically correct over its 379-question / 20-sidecar scope but that scope is one island; target.md condition 1 requires the denominator to cover ≥ 90% of trigger-bearing nodes. Five experts reached this independently. The Engineer's finding is the sharpest cut: getPopular.md — the consumer half of the EXACT surface class LSN-019 is the case-law for — is still prompt_version: file-analyser/0.2.0 with no stress_findings block; the backfill is not sequenced by canonical-bug-class proximity, so a new ordering/pagination regression on the 139 pre-protocol nodes is caught only by free-text luck. Progress is real (8→20 sidecars, more than doubled since the maiden run) but at this pace ~7 more batch cycles are needed to reach 90%. (SKE-F1, MET-F3, ENG-F1, ECO-F3, ADV-F4)"
  routed_to: approach-rev

- rank: 4
  finding: "test-map/index.yaml has grown to 1.44 MB — 4.1× a 100k-token context window — and is now divergent from its detail/ directory; the prior panel's top-ranked CRITICAL shard action was not done"
  raised_by: [Economist]
  severity: HIGH
  evidence: "wc -c test-map/index.yaml = 1,438,326 bytes. The 2026-05-21 panel measured this same file at 1,257,706 bytes and ranked the shard action #1 at CRITICAL — one run later it has grown a further ~180 KB, direct evidence the action was not taken. find test-map/detail -name '*.yaml' | wc -l = 908 files (highest TEST-GAP-909) while the index reports total_test_gaps = 906 — 3 entries in detail are invisible to an index consumer; two pending-merge delta files (batch-ZB 421 lines, X-TAGGING 390 lines) are unresolved, the X-TAGGING delta's own orchestrator_warning calls for a rebuild_indexes.py pass. Target condition 4 (zero index/detail divergence) unmet. Single-expert this run (the Economist owns the cost axis) but mechanically reproducible by a byte count and a file count; the prior full run had this as a CRITICAL two-expert consensus, so it is a corroborated finding carried forward, not a fresh single-expert claim. (ECO-F1)"
  routed_to: cut-this-step

- rank: 5
  finding: "Stress-Protocol and reflection rejection criteria have no non-LLM executor — 'gate-as-prompt' (Failure F); target condition 5 unmet, and the same ActivityHandler numeral-vs-list contradiction the prior panel flagged survived a full run"
  raised_by: [Methodologist, Engineer]
  severity: HIGH
  evidence: "APPROACH.md §5 rules 13/15/17/18/19 each state a sidecar/feature/finding 'IS REJECTED' — the enforcer of every one is the LLM agent reading the rule, the same agent that under context pressure emits the empty stress_findings block. Glob confirms only coverage.py exists in lineage/_extractor/registry-shard/; no validate-sidecars.py, no validate-reflections.py. Direct evidence the gap bites: ENG-F3 — ActivityHandler.md:concepts.entities still says 'Three of the 27 enum values are NOT covered' then lists ~10 distinct values; this is the SAME finding the 2026-05-21 panel's Engineer raised (prior phase1-engineer ENG-F3), it survived a full panel run unfixed, in an enrichment_status: stress-complete / confidence: HIGH sidecar, and the count gates a RuntimeException surface at ActivityServiceImpl.java:263. A HIGH-severity evidence-cited panel finding routed lsn-candidate is not closing — itself a process signal. (MET-F2-FailureF, ENG-F3)"
  routed_to: new-gate

- rank: 6
  finding: "Two claimed-fix LSNs (018, 019) remain open with unmet closure conditions; rev-8/LSN-023 is closed but its claimed fix is prompt-only and the specific wrong finding it names is still committed — target condition 2 partially unmet"
  raised_by: [Methodologist]
  severity: HIGH
  evidence: "retrospectives/LSN-018 + LSN-019 both status: open — accurately signalled (LSN-019 because PROBE-VERIFIED = 0; LSN-018 because coherence/entity-index.yaml is unbuilt). But MET-F4: LSN-023 carries status: closed while feature-flows/detail/F-031.yaml:drift_class_summary still contains permission_side_door — the exact wrong finding LSN-023 cites as its evidence — and the substrate still has no ui-interaction axis (manifest.yaml axes = ui_shell, ui_routes, controllers, openapi_tags, config_prefixes; none is the component/form/modal tree §0.3 declares mandatory). LSN-023's fix is prompt-only (file-analyser Rule 0, feature-flow-builder ui-incomplete gate) with no non-LLM enforcer and no substrate re-scan. Closing an LSN while its named wrong artefact is still committed is the pattern target condition 2 exists to catch. (MET-F3, MET-F4)"
  routed_to: human-verify

- rank: 7
  finding: "The methodology has never been run end-to-end at its current scope — target condition 7 unmet; the substrate scan predates revs 2-8 and no honest-coverage time series exists"
  raised_by: [Methodologist, Economist]
  severity: HIGH
  evidence: "manifest.yaml last_scan_date = 2026-05-08 — predates all of revs 2-8 (dated 2026-05-19 to 2026-05-22, including file-analyser/0.5.0, feature-reflector/0.1.0, and §0). features_with_at_least_one_cell_probed = 4 of 31. trend.md has two rows both dated 2026-05-21 — no time series spanning before and after the rev-4/8 changes. The current artefact set is a partially-enriched, pre-revision substrate. MET-F5: an end-to-end run on the current scope is the single action that simultaneously validates revs 4-8 and produces the convergence time series; the prior panel also flagged this and noted it now requires structural reducer changes (the test-map shard) BEFORE the next full pass can succeed. (MET-F5, ECO-F3 corroboration on the pre-stress backfill blocker)"
  routed_to: approach-rev

- rank: 8
  finding: "concepts.yaml top-level monolith is stale by ~109 sidecars and creates a two-representation problem with the 443-file sharded concepts/ detail directory"
  raised_by: [Economist]
  severity: MEDIUM
  evidence: "grep sidecar_count concepts.yaml = 50 (catalog_version: 8); 159 sidecars now exist — a delta of ~109 unconsumed. concepts.yaml is 647,447 bytes / 5,911 lines (1.8× a 350 KB single-pass limit). The sharded concepts/detail/ directory has 443 files. The two representations diverge in content with no automatic reconciliation step; any agent loading concepts.yaml directly is ~109 sidecars out of date. concepts/index.yaml is the lightweight lookup the monolith's retirement needs. Target condition 4's zero-divergence requirement applied to the concept layer. (ECO-F2)"
  routed_to: cut-this-step

- rank: 9
  finding: "The enrichment frontier is 159 of 395 substrate nodes — coverage breadth is ~40%; a load-bearing capability (DataEntityRunController.getRuns) sits extracted-but-unenriched and threaded by no feature flow"
  raised_by: [Adversary]
  severity: HIGH
  evidence: "manifest.yaml: nodes_with_own_sidecar = 159 / total_substrate_nodes = 395 (40.3%). ADV-F1/SC-5: DataEntityRunController.getRuns is present at nodes.jsonl:216 but has no understanding/ sidecar and no feature-flow threads it — F-022 (the one P-04 Data Quality feature) explicitly scopes to DataQualityController's 5 endpoints. getRuns carries real operator-observable boundary behaviour: an HTTP 400 for any entity not a DATA_TRANSFORMER or DATA_QUALITY_TEST (DataEntityRunServiceImpl.java:27-45). Every COVERED-CORRECT this run is a node that HAS a sidecar; the one MISSED-SILENT is a node that does not — the gap is structural (the enrichment frontier), not noise. target.md condition 1 explicitly distinguishes honest coverage from vanity coverage (nodes_with_sidecar/total); breadth is the open work. (ADV-F1, ADV-F4)"
  routed_to: backlog-item

- rank: 10
  finding: "The UI interaction layer is absent from all enriched feature chains — resolver/orchestrator and migration classes that hold cross-cutting operator behaviour also fall between the substrate axes"
  raised_by: [Practitioner, Adversary]
  severity: HIGH
  evidence: "Practitioner PRA-F2: rollups/ui-shell.md has 13 ui_shell nodes, only 1 enriched (SelectLanguage widget); rollups/ui-routes.md has 12 routes, only 1 enriched; feature-flows F-001 hop 1 (DataEntityDetails.tsx) is marked 'unresolved: true — sidecar not yet enriched'; F-003 and F-004 have no UI hop at all. Target condition 10 requires the UI component/form/modal layer present as a substrate axis and threaded into every feature flow. Adversary ADV-F2/ADV-F3 names the sibling structural seam: AlertActionResolverImpl (alert-halt suppression semantics — a halt still permits auto-resolution of existing alerts) and V0_0_79's destructive `DELETE FROM activity` are operator-relevant mechanisms whose host classes are not substrate nodes at all. The methodology currently neither covers the migration axis nor declares it out of scope. (PRA-F2, ADV-F2, ADV-F3)"
  routed_to: approach-rev

- rank: 11
  finding: "Feature coverage is five composed feature flows, all anchored on DataEntityController — target condition 3's randomly-chosen-feature requirement is unmet for ~30 other controllers"
  raised_by: [Practitioner]
  severity: HIGH
  evidence: "feature-flows.yaml header: total_features = 5; processed_node_ids are all DataEntityController methods. The catalog has 36 controllers / 203 controller-methods. For any feature outside the five — CollectorController, DataQualityController, ReferenceDataController (16 methods), TermController (23 methods), QueryExampleController (12 methods) — none of the eight §1 promise-tasks complete from the ontology. Target condition 3 specifies a RANDOMLY chosen feature, not one hand-picked from the composed five. Note: the prior full run's feature-flows count was 30/31 (rank-10 of that report); the Practitioner reads feature-flows.yaml header total_features: 5 this run — this divergence is itself flagged for the maintainer in needs_human_verification (a header may be stale relative to detail/). (PRA-F3)"
  routed_to: approach-rev

## contested_findings

# No finding raised by one expert was explicitly disputed by another this run.
# This is a STRUCTURAL property of lite mode, not evidence of unanimity: with no
# Phase-2 cross-examination memos, no expert had the opportunity to challenge a peer's
# finding on cited evidence. The absence of contested findings here therefore carries
# NO weight as agreement — it is the panel running without its disagreement-surfacing
# mechanism. One latent tension the chair flags for the maintainer, un-adjudicated
# because no expert cross-examined it:
- finding: "How many composed feature flows exist — 5 or 30/31"
  raised_by: Practitioner (reads feature-flows.yaml header total_features: 5)
  disputed_by: none — but the 2026-05-21 full run recorded 30 feature-flow detail files (F-001..F-030) and the maiden run referenced 31 features
  raiser_basis: "PRA-F3 cites feature-flows.yaml header total_features: 5 and processed_node_ids all on DataEntityController; the Practitioner's three task simulations all navigate F-001..F-005."
  disputer_basis: "The prior panel-report.md rank-10 finding cites feature-flows/detail/ containing 30 files (F-001..F-030); LSN-023 (dated 2026-05-22) states 'by batch ZB it had composed 31 features'."
  chair_note: |
    Unresolved — maintainer to decide. The chair cannot adjudicate this from the twelve
    panel documents alone (Rule 1 forbids re-auditing the ontology). The most probable
    reconciliation, NOT verified: feature-flows.yaml is a stale top-level artefact frozen
    at total_features: 5 (the same staleness class as concepts.yaml frozen at sidecar_count
    50 — ECO-F2) while feature-flows/detail/ holds 30+ files. If so, the Practitioner's
    TASK-3 navigated a stale index and PRA-F3's "five features" framing understates real
    coverage — but the absent feature-reflector layer (rank-2) and the UI-layer absence
    (rank-10) hold regardless of whether the count is 5 or 31. The maintainer must confirm
    the live feature-flow count and whether feature-flows.yaml is stale. Listed in
    needs_human_verification.

## what_went_well

- "Coverage depth on enriched nodes resisted the name-vs-mechanism trap. The Adversary's SC-4: the NamespaceController sidecar did NOT fall for the `CascadeDeleteException` name — it explicitly states the delete is a 'block-if-attached' application-tier guard, NOT an FK cascade, and flags the TOCTOU race; the Adversary traced the four `existsByNamespace` checks independently and reached the same conclusion (NamespaceController.md:141,153). SC-1 caught the curl-bypass of the attachment size cap at HIGH severity plus the decimal-MB-vs-binary-MiB multiplier; SC-3 surfaced four distinct GenAI security gaps on a feature the docs call 'API-only'. (Adversary, SC-1/3/4)"
- "Zero confidently-wrong claims across two adversarial sampling passes. The full run carried one COVERED-WRONG (the inverted RNG claim); this run the Adversary's seven spot-checks returned zero COVERED-WRONG, and the Skeptic opened 8 HIGH-confidence / STATIC-INFERRED claims across two sidecar generations (file-analyser/0.2.0 and 0.5.0) and falsified zero — every file:line resolved, including the non-trivial soft-delete asymmetry between listPopular and getDataEntityDetails. Claim accuracy — the most important calibration signal — is clean. (Adversary spot-checks; Skeptic CAL-1..CAL-8)"
- "Depth is senior-engineer-grade where the Stress Protocol has reached, and the canonical bug is engaged to the line. The Engineer re-derived the LSN-019 bug from primary source: ReactiveTagRepositoryImpl.md:stress_findings.B1 correctly traces that paginate(...) at ReactiveTagRepositoryImpl.java:148 truncates by TAG.ID ASC BEFORE the orderBy(COUNT_FIELD.desc()) at line 158 — and draws the correct operator consequence (the oldest `size` tags labelled 'most popular'). The jOOQ predicate-application matrix in ReactiveDataEntityRepositoryImpl.md is exhaustive and forward-looking — tests_coverage_semantic.gaps[1] pre-states the regression a future maintainer adding EXCLUDE_FROM_SEARCH to cteDataEntitySelect would cause. Two of four depth probes returned would-catch with source-verified diagnoses. (Engineer, DP-1..DP-4)"
- "The deep stress channel grew 6.7× since the maiden run (3 → 20 sidecars) and the new Category-E stress findings are real operational-depth diagnoses. ActivityHandler.md S-E-1 (idempotency, INSERT-not-UPSERT), S-E-3 (transactional coupling), S-E-6 (READ_COMMITTED snapshot semantics) are all traced to file:line and correct — the trajectory of condition 1 is upward even though the absolute level is far from target. (Engineer, what_went_well; Skeptic confirms the calibration is honestly differentiated)"
- "The reactive case-law loop is mechanically sound and the proactive panel→revision loop fired. The Methodologist confirms every LSN carries a named closure condition and LSNs 020-023 were closed with evidence; rev-8 (§0 / the operating stance) was produced the same cycle as the prior panel's UI-absence finding — the pipeline from a panel finding to an APPROACH.md revision worked. The probe SPECIFICATION quality is high (P-001..P-009 carry concrete arrange/act/observe/assert with SQL fixtures) — the defect is the write-back step, not the probe design. (Methodologist, what_went_well + claimed_fix_verification rev 6)"
- "The cost-control architecture is directionally correct and the reducers dedup. The Economist confirms the incremental-delta pattern keeps per-batch rewrite cost low (deletions/batch 172-910 vs insertions 5,000-13,000) and cross-sidecar triangulation consolidates findings (REFACTOR-073 built from 3 → 18 sidecars rather than 18 duplicate entries). The sharding architecture was introduced before the monoliths became fully unloadable — the decision is sound; the execution is incomplete. (Economist, what_went_well)"

## what_must_improve
# Ranked. Every item routed.

- rank: 1
  item: "Implement the probe-runner → sidecar feedback loop. Add a `status` field to the probe schema and a write-back step in runner.py that flips an originating sidecar's confidence from PROBE-NEEDED to PROBE-VERIFIED when its probe-run outcome is PASS; retroactively upgrade the sidecars behind the 9 existing PASS runs; add an integration check to probe-runner.md's self-check that verifies at least one sidecar was updated after a PASS run. Until this executes, stress_answers_probe_verified is permanently 0, target condition 6 cannot be met, and LSN-019 cannot close. This is the THIRD consecutive panel run raising it unchanged."
  severity: HIGH
  routed_to: new-gate
  source_finding: "Methodologist-MET-F1 + Skeptic-SKE-F2 + Engineer-ENG-F2"

- rank: 2
  item: "Wire the feature-reflector (Layer 4b) into the next-batch autonomous driver so it runs on every feature flow, not 1 of 30/31. The product-owner review — target condition 11, the highest-value maintainer task for a UI-driven platform — is undeliverable for ~97% of features. Sequence the UI-interaction substrate axis first (rank 4), since a reflection that reasons from the user's screen needs UI sidecars to trace through."
  severity: CRITICAL
  routed_to: approach-rev
  source_finding: "Practitioner-PRA-F1 + Methodologist-MET-F2(rev5)"

- rank: 3
  item: "Shard test-map/index.yaml to a summary-row index (~80 bytes/entry) with full bodies in detail/, and run rebuild_indexes.py to close the 3-entry index/detail divergence and merge the two pending delta files. The index has grown 1.26 MB → 1.44 MB since the prior panel ranked this CRITICAL — it was not done. Apply the same shard/retire to concepts.yaml (647 KB, stale by ~109 sidecars) and feature-flows.yaml before they are the next hard stops. This is the single most overdue infrastructure action."
  severity: HIGH
  routed_to: cut-this-step
  source_finding: "Economist-ECO-F1 + Economist-ECO-F2"

- rank: 4
  item: "Add a `ui-interaction` substrate axis covering the component / form / modal / interactive-control tree, then run a batch of UI-component sidecars under file-analyser/0.5.0+ and re-compose the feature flows with the UI chain resolved. Target condition 10 requires it, §0.3 declares it mandatory, and LSN-023 is closed on a prompt-only fix that does not add the axis. F-031's wrong `permission_side_door` finding stays committed until this runs."
  severity: HIGH
  routed_to: approach-rev
  source_finding: "Practitioner-PRA-F2 + Methodologist-MET-F4 + Adversary-ADV-F2"

- rank: 5
  item: "Build a pre-commit non-LLM validator (extend coverage.py or add validate_sidecars.py) that mechanically enforces the rejection criteria — empty stress_findings on a trigger-bearing node, missing/zero-hypothesis reflection, banned phrases — AND checks numeral-vs-list-length self-consistency in stress_findings (the ActivityHandler 'Three ... [lists 10]' class, ENG-F3, which has now survived two panel runs). Wire it into next-batch Phase 3 before commit. The word 'REJECTED' in the agent contracts must have an executor."
  severity: HIGH
  routed_to: new-gate
  source_finding: "Methodologist-MET-F2(Failure F) + Engineer-ENG-F3"

- rank: 6
  item: "Run the Stress-Protocol backfill across the ~139 pre-protocol sidecars so the stress_verified_pct denominator covers ≥ 90% of trigger-bearing nodes — and sequence the backfill by canonical-bug-class proximity, not arbitrarily: getPopular (the LSN-019 sibling surface) is still on file-analyser/0.2.0 while UI Data Source components are on 0.5.0. The backfill needs the test-map shard (rank 3) done first or the reducer cannot load its own prior state. Until the denominator is representative, the 88.4% headline is a 12.6%-scope figure."
  severity: HIGH
  routed_to: approach-rev
  source_finding: "Skeptic-SKE-F1 + Methodologist-MET-F3 + Engineer-ENG-F1"

- rank: 7
  item: "Run the methodology end-to-end once at its current (rev-8) scope on a substrate scanned after the latest APPROACH revision — substrate scan (with the new UI axis) → domain-extractor → Stress-Protocol enrichment → probe-runner → reducers + feature-flow-builder + feature-reflector → coherence-sweep → panel — recording the honest-coverage axes per batch as a time series. The substrate was last scanned 2026-05-08, predating revs 2-8. This is target condition 7 and the precondition for any later panel grading running behaviour rather than specification. Sequence after ranks 3 and 4."
  severity: HIGH
  routed_to: human-verify
  source_finding: "Methodologist-MET-F5"

- rank: 8
  item: "Enrich DataEntityRunController.getRuns (nodes.jsonl:216, currently extracted-but-unenriched) and thread it into a feature flow — it is the primary run-history surface for the Data Quality and Transformer pillars and carries a real HTTP-400 boundary. More broadly, drive the enrichment frontier from 159/395 toward coverage of the load-bearing capabilities; coverage breadth is the open work behind condition 1."
  severity: HIGH
  routed_to: backlog-item
  source_finding: "Adversary-ADV-F1 + Adversary-ADV-F4"

- rank: 9
  item: "Confirm the live feature-flow count and whether feature-flows.yaml is a stale top-level artefact. The Practitioner read total_features: 5; the prior panel recorded 30 detail files and LSN-023 says 31 features. If feature-flows.yaml is stale (the concepts.yaml staleness class), it must be rebuilt from detail/ and an index-sync assertion added to next-batch Phase 3 so a batch cannot commit detail files without updating the index."
  severity: MEDIUM
  routed_to: human-verify
  source_finding: "Practitioner-PRA-F3 (chair-flagged divergence vs prior run)"

- rank: 10
  item: "Add a `migrations` substrate axis OR document explicitly in APPROACH.md that db/migration/*.sql schema history is out of scope. V0_0_79's unconditional `DELETE FROM activity WHERE event_type='CUSTOM_GROUP_DELETED'` — an irreversible audit-row purge — is uncovered because no axis owns the migration as a unit; destructive DML inside migrations is exactly the operator-harm class the methodology exists to catch (cf. LSN-001). This finding was also raised in the prior run (rank-10) and not yet actioned."
  severity: MEDIUM
  routed_to: approach-rev
  source_finding: "Adversary-ADV-F3"

- rank: 11
  item: "Author the maiden panel acceptance-gate corpus — the maintainer-authored gold set + seeded-defect corpus per APPROACH.md §16.4 (κ ≥ 0.60, recall ≥ 0.80, seeded-defect detection ≥ 0.80 / ≥ 0.90 data-loss-security, ECE ≤ 0.15). Until it passes, every panel report including this one is pre-acceptance-gate and provisional. No agent can substitute — by design. The trend.md curve now has the three rows condition 8 needs, but the gate itself is unpassed."
  severity: MEDIUM
  routed_to: human-verify
  source_finding: "Methodologist target_lens (condition 8) + Skeptic target_lens"

## lsn_regression_check

- regression_found: false

The chair read every `retrospectives/LSN-*` (LSN-001..023; all `status: closed` except the
`open` LSN-018 and LSN-019) and cross-checked each panel finding — the Adversary's
MISSED-SILENT (SC-5) and two PARTIALs, the Skeptic's calibration sampling, every consensus
finding — against every closed LSN. **No panel finding this run is a clean rediscovery of a
closed LSN.** The negative result is genuine: the experts were blind to the LSNs (the
Adversary especially generates fresh checks against primary source). Four observations the
maintainer must hold — none a strict closed-LSN regression, but three are persistence /
non-closure signals that matter as much:

- **rank-1 (probe loop open) is a confirmation of the OPEN LSN-019, raised for the THIRD
  consecutive panel.** LSN-019 is `status: open` precisely because its closure condition
  (Stress Protocol on a full batch + PROBE-VERIFIED ≥ 1) is unmet. This is not a regression
  — but the panel corroborating it at HIGH severity three runs running, with
  `stress_answers_probe_verified` unmoved at exactly 0 across all three, is strong evidence
  the probe-runner write-back is a hard structural blocker, not a backlog item. The
  methodology's single highest-leverage LSN cannot close until rank-1 ships.

- **rank-6 (LSN-023 closed with its named wrong finding still committed) is a near-miss
  against the LSN itself, and a recurrence of the very pattern target condition 2 names.**
  MET-F4 is precise: `LSN-023:status = closed`, but `F-031.yaml:drift_class_summary` still
  carries `permission_side_door` — the exact finding LSN-023's own References section cites
  as the wrong artefact — and the substrate still has no `ui-interaction` axis, which
  LSN-023's "rule that emerged" makes mandatory. This is not a *closed-LSN regression* (no
  fresh rediscovery of a defect LSN-023 fixed); it is a *premature closure* — an LSN marked
  closed before its claimed fix reached the artefacts. The chair surfaces it at HIGH, not
  CRITICAL, because the fix DIRECTION is correct and the maintainer may have intended a
  phased close; needs_human_verification carries the question.

- **ENG-F3 (the ActivityHandler numeral-vs-list contradiction) survived a full panel run
  unfixed — the panel's own finding-closure loop is not closing.** This is the prior run's
  rank-2 / Engineer-ENG-F3 finding, routed `lsn-candidate`, reappearing verbatim one run
  later in a `stress-complete` / `confidence: HIGH` sidecar. Not a closed-LSN regression
  (no LSN was minted for it yet), but a direct signal that panel findings routed
  `lsn-candidate` are not being filed and actioned between runs. If the methodology's
  proactive loop (panel → LSN → fix) does not fire, the panel degrades to a recurring
  report nobody acts on — the Economist's explicit "earns its keep IF findings drive
  fixes" test. Routed as rank-5's self-consistency validator and flagged here.

- **The LSN-018 coherence sweep still cannot catch the full contradiction class — its
  entity-index is unbuilt.** LSN-018 is `status: open`; `coherence/entity-index.yaml` does
  not exist (the prior run confirmed this by `ls`; nothing this run contradicts it). The
  prior full run observed that a version-dependent library-fact error leaves no
  entity-name fingerprint a grep-based sweep matches; this run adds no new evidence on that
  point but the open status persists. Not a regression — LSN-018 is honestly open — but
  its closure (which target condition 5 partly depends on) is blocked behind the
  unbuilt reverse index.

## cost

ontology_cost_verdict: |
  cost_trend: RISING — and the Cost axis fell 5→4 this run, the steepest single-axis drop
  on the scorecard. The dominant fact is unchanged from the full run and got worse:
  test-map/index.yaml grew 1.26 MB → 1.44 MB (4.1× a 100k-token window) — the prior panel
  ranked sharding it CRITICAL and it was not done, so the blocker compounded. cost-per-
  verified-claim is ~8,400-10,400 tokens per STATIC-INFERRED claim with
  stress_answers_probe_verified still 0 — every token spent on a pre-stress sidecar adds
  zero to the honest-coverage denominator. Two unsynchronized representations of the
  concept catalog (concepts.yaml stale at 50 sidecars vs 443 sharded detail files) and the
  prose-duplicate investigator-log (~30-40% restatement) are MEDIUM-HIGH cross-artefact
  redundancy. The Economist's verdict: the waste is structural inaccessibility — ~15-20%
  of artefact volume orphaned, the working set overflowing reducer ingest capacity — not
  catastrophic, and the fixes are all subtraction (shard the indices, retire the monolith,
  rebuild from detail/) at near-zero cost. AMBER not RED because real cost controls exist
  (incremental delta, sharding, reducer dedup) and every cut-candidate is reversible.
panel_run_cost: |
  7 agent invocations (lite mode — 6 Phase-1 experts + chair; no Phase-2 memos). The
  Economist's measured estimate: ~480K tokens this run (6 experts × ~60K input + ~18K
  output; chair ~100K input). Roughly 0.7× the maiden lite run and ~0.35× the full run's
  ~1.4M. Panel cost as a fraction of the ~3.5M-token ontology investment: ~14%.
panel_earns_keep: borderline
# Borderline — not "no", and the reason is the honest tension this section must record.
# In favour: the run produced one CRITICAL finding (the absent feature-reflector layer,
# measured against v1.1's newly-explicit condition 11), zero confidently-wrong claims
# under two sampling passes, and an accurate falling-trend signal. AGAINST: this is the
# THIRD run, and ranks 1-3 of this report (probe loop, feature-reflector, index shard)
# are substantially the same as the prior run's ranks 1/3/8 and the maiden run's findings
# — the panel is re-reporting unactioned findings. A panel that says the same thing three
# times has diagnostic value (it proves the findings are real and the trend is down) but
# its MARGINAL value per run is falling. The Economist's own test applies: the panel earns
# its keep only if its findings drive fixes; between run 2 and run 3 the top findings did
# not drive fixes (test-map grew, probe-verified stayed 0, ENG-F3 survived verbatim).
# The lite mode also means no cross-examination this run — lower cost, lower assurance.
consecutive_no_actionable_findings: 0
# Self-kill criterion (APPROACH.md §16.5): pause the panel after 3 consecutive runs with
# no actionable finding. This run has 11 consensus findings — the counter stays at 0; the
# panel is NOT near its self-kill threshold. BUT the chair flags a DISTINCT degradation
# the §16.5 counter does not capture: 3 consecutive runs with the same top-3 findings
# UNACTIONED. The maintainer should read this as: the panel is not the thing to pause —
# the execution backlog is the thing to clear. Running a 4th panel before ranks 1-4 here
# are addressed will, with near-certainty, produce a 4th report with the same top-3.
# Recommendation: act on ranks 1-4, then run the next panel against the result.

## correlated_blind_spot_caveat

This panel is six Claude-family agents auditing artefacts built by Claude-family agents.
Unanimity among them is weak evidence — treat it as one correlated draw, not six. The
findings above carry weight only from their cited evidence. The maintainer's own
spot-checks remain the panel's only fully independent oracle.

Two cautions specific to this run. First — **this is a lite run with no Phase-2 cross-
examination.** In the full run, Phase 2 produced a self-corrected Skeptic verdict, a
narrowed disputed finding, and three severity adjustments on independent evidence. None of
that happened here: every finding is a single expert's un-cross-examined Phase-1 position.
The chair has weighted findings by cited-evidence strength and noted where a finding is
single-expert (ranks 4, 8, 9, 11) versus carried-forward-corroborated (rank 4 was a
two-expert CRITICAL in the full run). But the panel's disagreement-surfacing machinery did
not run — the empty `contested_findings` section is a consequence of lite mode, not a
sign of consensus. Second — the Engineer's ENG-F4 names a structural correlated blind
spot: an LLM tracer pattern-matches the visible `.block()` smell far more readily than the
fingerprint-less "this operator chain ran with a fresh Reactor Context, outside the
transaction" smell; reactive-context-propagation traps may be systematically under-probed
by a panel of LLM tracers, and the Engineer flags this as its own risk too.

validation_status: pre-acceptance-gate

**This panel has NOT yet passed its maiden acceptance gate** (APPROACH.md §16.4 + the
Adversarial Review Panel ADR). The maintainer-authored gold set and seeded-defect corpus
do not yet exist. Therefore **every finding in this report is PROVISIONAL** — corroborate
each against primary source before acting. The verdict `GO-WITH-CHANGES` and the score 5.2
are a third calibration point, not an authoritative grade. The `trend.md` curve now has
the three rows condition 8 asks for — but the curve is **5.7 → 5.7 → 5.2 (declining, not
non-decreasing)** and the consensus-finding count is **8 → 11 → 11 (not trending down)**;
condition 8 requires a non-decreasing curve with findings trending down, so the panel's
own output is not yet a convergence signal — it is, this run, a divergence warning.

needs_human_verification:
- "rank-1 / MET-F1 — confirm whether runner.py implements the artefacts_updated write-back or whether the probe-runner subagent simply never executes Rule 4. The artefacts_updated: [] pattern is consistent across all 9 runs; reading runner.py source determines whether this is a code gap or a subagent execution gap. (Methodologist needs_human_verification)"
- "rank-6 / MET-F4 — confirm the wrong `permission_side_door` finding in F-031 is acknowledged as a pending correction rather than a deliberate retention, and that LSN-023's `closed` status accurately reflects an intended phased fix. (Methodologist needs_human_verification)"
- "rank-9 — confirm the live feature-flow count: the Practitioner read feature-flows.yaml total_features: 5; the prior panel recorded 30 detail files; LSN-023 says 31 features. Determine whether feature-flows.yaml is a stale top-level artefact (the concepts.yaml staleness class). (chair-flagged, PRA-F3)"
- "rank-1 / SKE-F2 — confirm a probe-run → sidecar-confidence-update mechanism does not already exist as a designed-but-later slice of the dynamic-verification ADR before building it fresh. (Skeptic prior-run carry)"
- "rank-3 / ECO-F1 — confirm whether rebuild_indexes.py exists and is runnable, or is planned-but-unbuilt; this decides whether the test-map index/detail divergence is a one-command fix or a multi-session project. Also confirm the actual token count of test-map/index.yaml in a real reducer context — byte counts proxy tokens. (Economist needs_human_verification)"
- "SC-6 / ADV-F3 — confirm whether schema migrations (and destructive DML inside them) are in the methodology's declared substrate scope; if intentionally out of scope, ADV-F3 downgrades to SCOPE-EXCLUDED. (Adversary needs_human_verification)"
- "SC-1 / ADV-F1 — re-verify there is no server-side attachment size enforcement in a WebFlux filter / codec config outside AttachmentServiceImpl + FileServiceImpl. (Adversary needs_human_verification)"
- "DP-1 / ENG-F4 — a maintainer with Reactor expertise should check whether any existing @ReactiveTransactional write path (ActivityAspect, DataEntityServiceImpl) already subscribes a Mono separately or bridges to a non-Context-aware call, losing the R2DBC transaction; if one does, ENG-F4 escalates from new-gate to a live bug. (Engineer needs_human_verification)"
- "CAL-8 / SKE — DataEntityHousekeepingJob .block() inside the JDBC transaction: the structural claim (call inside the lambda) holds; the runtime hang-vs-deadlock severity depends on which scheduler thread pool runs the @Scheduled task vs Netty's event loop — needs an empirical test. (Skeptic needs_human_verification)"
- "ENG-F3 — a maintainer should personally count the ActivityEventTypeDto handler coverage; the 'Three ... [lists 10]' contradiction means the true uncovered-event-type count is unknown, and that count gates a RuntimeException surface. (Engineer needs_human_verification)"
- "rank-11 — only the maintainer can author the maiden acceptance-gate corpus; no agent can substitute, by design. (Methodologist / Skeptic target_lens)"

## trend_row
| 2026-05-22 | GO-WITH-CHANGES | 5.2 | Cov 6 Proc 5 Cost 4 Depth 7 Use 4 Hon 5 | 11 | Third run (lite) — design still sound but score declining 5.7→5.7→5.2; probe loop open (probe_verified=0) for the 3rd run running, feature-reflector covers 1/30 (CRITICAL), test-map index grew 1.26→1.44 MB unactioned; no closed-LSN regression but top-3 findings unactioned across 3 runs |
