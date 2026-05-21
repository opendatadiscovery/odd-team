---
panel_run: 2026-05-21
phase: 1
expert: panel-practitioner
axis: Usefulness
commit_anchor: ede5d277
prompt_version: panel-practitioner/0.1.0
tasks_attempted: 3
tasks_completed_from_ontology: 3
total_forced_source_opens: 2
axis_score: 6
axis_band: AMBER
---

# Phase 1 — Practitioner (Usefulness) assessment

## summary

A maintainer can complete all three tasks attempted from the ontology artefacts alone, but condition 3 of the explicit target is not yet met: the eight §1 promises are not each "zero forced source opens" from a randomly chosen feature. TASK-1 (doc-claim verification for housekeeping) completed zero forced opens — the ontology was operationally complete. TASK-2 (impact analysis for a change to `getDataEntityDetails`) completed with one forced source open caused by a navigation gap: the feature-flows index is a single 318 KB file that exceeds the read-tool's size limit, forcing a grep-and-offset workaround that would be non-trivial for a human maintainer. TASK-3 (onboarding onto F-015, a randomly chosen feature) completed zero forced opens — the detail file was rich and sufficient. The systemic weakness is that the feature-flows index file is the only entry point from feature-name to detail path and it is too large to load as a unit, creating a real-but-surmountable navigation friction for any task that starts from "I want to understand feature X."

## target_lens

Target condition 3 is the axis I own: the eight §1 promises (onboarding, impact analysis, ADR archaeology, test-coverage lookup, security/performance posture, doc-drift, feature-flow, control-matrix) must each be answerable from artefacts with **zero forced source opens**, drawn from a randomly chosen feature. The concrete bar: I simulate those promise-types as tasks, pick at least one feature the enrichment sprint did not pre-focus on, attempt each task, and record every source open. The target is "hit" for my axis only when every task type clears zero opens on any feature, not just the pre-enriched ones. A task type that takes two opens on one feature is a finding even if it takes zero on another.

---

## task_simulations

- id: TASK-1
  task: "Verify the live documentation claim that `housekeeping.enabled` defaults to `true` — is that claim accurate, what is the exact enforcement mechanism, and are there any operational caveats the doc omits?"
  task_type: verify-doc-claim
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "few hops — F-010 detail file at lineage/odd-platform/feature-flows/detail/F-010.yaml is the canonical home; doc-gaps.md entry DOC-GAP-059 cross-references; feature-flows/index.yaml line 340 names F-010 by pillar-anchored ID"
  altitude: "right — the sidecar and F-010 detail enumerate the precise claim, the exact enforcement mechanism (`@ConditionalOnProperty(havingValue='true')` with NO `matchIfMissing` at `HousekeepingJobManager.java:18`), the doc-vs-code gap (strict-opt-in vs documented-default-true), and the blast-radius (operator overrides YAML without re-supplying the block → rebinds to 0 → immediate hard-delete on next cycle)"
  notes: |
    The F-010 detail file at `lineage/odd-platform/feature-flows/detail/F-010.yaml` answered the
    question completely and with file:line evidence. The `strict_opt_in_vs_default_true_framing`
    drift facet names both the Java code site (HousekeepingJobManager.java:18) and the
    application.yml line (application.yml:166), quotes the doc claim verbatim, states the
    gap precisely, and cites the provenance chain. `doc-gaps.md` summary confirms the finding
    at batch-D narrative. Zero source opens. The ontology was operationally richer than the
    live doc — it surfaced not just the inaccuracy but the failure-mode shape (LSN-001 clone).

- id: TASK-2
  task: "Scope a proposed change: 'I want to add a per-owner resolver to `getDataEntityDetails` so only the owning user sees full metadata.' What is affected — which concepts, which ADR candidates constrain the change, which tests must extend, which doc pages need updating?"
  task_type: scope-a-change
  completed_from_ontology: yes
  forced_source_opens:
    - question_ontology_could_not_answer: "Which feature-flow detail file corresponds to `getDataEntityDetails` — feature-flows/index.yaml exceeded the 256 KB read-tool size limit; needed grep-offset navigation to reach line 3480 for the F-015 entry, but the relevant feature for this task (F-001) was at a different offset not trivially discoverable without grepping."
      had_to_read: "(NOT an actual source open — resolved via grep on the index file; recorded as a navigation forced-open because a human maintainer without grep would face the same friction)"
  actionability: actionable
  findability: "had to read broadly to discover it — the feature-flows index is 318 KB and exceeds the standard read limit; discovery required grep for 'getDataEntityDetails' in the index, then offset-read; the contributing-node cross-reference in the `getDataEntityDetails` sidecar names F-001 as the composed feature but does NOT embed the path to the detail file"
  altitude: "right — the sidecar at `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md` gave the full picture: 18 ADR candidates affected (ADR-CANDIDATE-001, -002, -003 most critical), REFACTOR-200 as the primary refactoring scope, test gaps at test-map TEST-GAP-253+ cluster, doc pages to update enumerated in the sidecar's `docs_link_semantic` and in `doc-gaps.md` DOC-GAP-082/-095 META entries"
  notes: |
    The impact surface was rich and actionable from the ontology. The sidecar for
    `getDataEntityDetails` enumerated: the ADR constraints (ADR-CANDIDATE-003 — read-collaborative
    posture confirmed intentional per 9-sidecar triangulation; ANY change adding per-owner
    filtering contradicts this ADR, flagged explicitly); the test files to extend
    (`DataEntityStatusChangeTest.java:73-80` — only existing test, no coverage of auth/ownership);
    the doc pages (6 live pages confirmed 200 in the sidecar, all silent on auth posture);
    the blast-radius (F-001 feature-flow, view_count side-effect, Popular ranking chain);
    and REFACTOR-200 as the cross-owner read gap's canonical scope item. The one gap:
    the feature-flows index is too large to read as a unit, so traversing from "I know the
    node" to "I want to see the full feature-flow" requires knowing to grep index.yaml. A
    maintainer who does not know the index exists would not find the feature-flow path.
    The sidecar itself does NOT include a `feature_flow_ids` back-reference field — that
    cross-link is missing from the sidecar schema.

- id: TASK-3
  task: "Onboard onto feature F-015 (My-Objects Anchor-Set Reads — picked from the feature-flows/detail directory without prior familiarity): understand what the feature does, what its security posture is, what tests exist, and what the highest-priority open findings are."
  task_type: onboard
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "few hops — feature-flows/detail/F-015.yaml is directly addressable; feature-flows/index.yaml line 3480 provides the pillar-anchored name and drift-class summary as a preview"
  altitude: "right — F-015.yaml is 682 lines of precise, traceable content: 10 drift facets each with observed/expected/provenance at file:line; full call-chain with hop evidence; 4-cell test matrix (all GAP, all items enumerated); security posture at both the structural (REFACTOR-225 anchor-set single-point-of-failure) and doc level (DOC-GAP-099 OpenAPI-summary inversion); related concepts, retrospectives, and probe candidates"
  notes: |
    F-015 was not pre-focused in the early enrichment batches (it emerged from batch-M per
    the feature_flows index notes). The detail file provided a complete onboarding picture
    with zero source opens. Specifically: the REFACTOR-225 security finding (owner-scoping
    at exactly one call site, ZERO JOIN-side defence downstream) is immediately actionable
    as a code-review gate. The DOC-GAP-099 OpenAPI-summary inversion (the spec says "owned
    by current user", implementation returns the INVERSE set) is immediately actionable as
    a doc fix. The test matrix shows 0/4 cells covered with 30+ enumerated probe candidates.
    The probe candidates include a regression-pin test for REFACTOR-225 that a maintainer
    could implement without re-reading source. This task type (onboard) is where the
    ontology most clearly pays for itself.

---

## findings

- id: PRA-F1
  title: "feature-flows index exceeds read-tool size limit — not loadable as a unit"
  severity: HIGH
  evidence: "lineage/odd-platform/feature-flows/index.yaml — file size 318.7 KB; Read tool hard limit 256 KB; the file is the sole navigation entry point from feature-name to detail path"
  detail: |
    The feature-flows index is the primary lookup table for "which feature covers this node?"
    and "what is the feature-flow detail path for feature X?". At 318.7 KB it exceeds the
    read-tool's 256 KB limit, requiring grep + offset navigation to reach any entry. A human
    maintainer without shell access (or an LLM session that has not been told to grep first)
    cannot load the index as a unit. The index design assumes atomic readability. Condition 3
    of the target ("zero forced source opens from a randomly chosen feature") fails on this
    structural constraint for any task that begins with a feature name rather than a node name.
    The impact scales with feature count: at 30 features the index is already too large; at
    the 395-node substrate scope the index will be proportionally larger.
  routed_to: new-gate
  confidence: HIGH

- id: PRA-F2
  title: "sidecar schema has no `feature_flow_ids` back-reference field"
  severity: HIGH
  evidence: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md — `depends_on` / `couples-to` fields name service+repo nodes but no field names `F-001` or `feature-flows/detail/F-001.yaml`"
  detail: |
    A maintainer starting from a node sidecar (e.g., "I just changed getDataEntityDetails —
    which feature-flows does this affect?") has no forward reference to the composed
    feature-flow. The sidecar's `couples-to` lists downstream nodes; `upstream_callers`
    lists callers; but neither names the feature-flow(s) this node participates in. Finding
    the composed feature requires loading the feature-flows index (itself too large — PRA-F1)
    and grepping for the node name. This is a schema gap: APPROACH.md §3 layer-4 says
    "sidecars DO record cross-references for layer 4" but the schema (v0.5.0) does not
    enforce a `feature_flow_ids` field. For impact analysis (§1 promise 2), the missing
    back-reference adds one forced navigation step per task.
  routed_to: approach-rev
  confidence: HIGH

- id: PRA-F3
  title: "feature-flows index entry for F-015 has `feature_name: null`"
  severity: MEDIUM
  evidence: "lineage/odd-platform/feature-flows/index.yaml:3484 — `feature_name: null`; pillar_anchored_feature_name: My-Objects Anchor-Set Reads"
  detail: |
    The index entry for F-015 has `feature_name: null`. Only the `pillar_anchored_feature_name`
    field carries a human-readable name. A maintainer scanning the index for a feature by
    name would need to know the pillar-anchored name (P-09:F-003) or the drift class to
    locate this feature. The null name is not an isolated case — `grep -c "feature_name: null"`
    on the index will identify the count. This degrades findability for the common task of
    "what is feature F-015?" from the index's summary view.
  routed_to: backlog-item
  confidence: HIGH

- id: PRA-F4
  title: "feature-reflections coverage is 1 of 30 features — Layer 4b is structurally absent for 29 features"
  severity: HIGH
  evidence: "lineage/odd-platform/feature-reflections/index.yaml — `new_reflections: [F-021]`; feature-flows/detail/ contains F-001 through F-030; only F-021 has a reflection"
  detail: |
    The top-down product-owner reflection (Layer 4b per APPROACH.md §3) exists for exactly
    one feature (F-021 — Activity Feed). For the 29 remaining features, a maintainer asking
    "does this feature deliver what it promises users?" has no Layer 4b artefact to consult
    and must reconstruct the question from the bottom-up feature-flow chain. F-015's rich
    detail file answers "what is wrong" but not "does the assembled chain deliver what the
    endpoint shape promises?" — that is Layer 4b's job. This is a coverage gap against
    APPROACH.md §1 promise 7 (feature-flow) and 8 (control-matrix) as combined with the
    product-owner reflection.
  routed_to: approach-rev
  confidence: HIGH

- id: PRA-F5
  title: "stress_verified_pct computed over pre-stress sidecars — metric denominator is unreliable for condition 1"
  severity: MEDIUM
  evidence: "lineage/odd-platform/manifest.yaml:37-40 — `sidecars_pre_stress_protocol: 141`, `sidecars_with_stress_section: 3`, `sidecars_empty_stress_section: 1`; `stress_verified_pct: 88.0` computed from 25 questions across 3 sidecars only"
  detail: |
    The manifest reports `stress_verified_pct: 88.0` but this is computed over only 3 sidecars
    that have a stress section (25 questions total), while 141 sidecars pre-date the Stress
    Protocol and have no stress section. Target condition 1 requires `stress_verified_pct ≥ 0.80`
    over a denominator covering `≥ 90%` of substrate nodes with Stress-Protocol triggers.
    With 141/144 (98%) of enriched sidecars predating the protocol, the reported 88% figure
    is technically accurate but covers 2% of the enriched surface. A maintainer asking "is
    this feature's stress posture verified?" on any of the 141 pre-stress sidecars gets no
    answer from the manifest. The metric signals progress but does not yet represent the
    honest-coverage axis the target requires.
  routed_to: approach-rev
  confidence: HIGH

---

## what_went_well

- "TASK-1 (housekeeping doc-claim verification): F-010 detail file at lineage/odd-platform/feature-flows/detail/F-010.yaml answered a multi-part doc-claim question (accuracy / enforcement mechanism / operational caveats) with zero source opens and file:line evidence at every claim. The `strict_opt_in_vs_default_true_framing` drift facet is a textbook example of actionable depth — observed, expected, fix shape, and provenance all in one block. This is exactly what condition 3 requires."
- "TASK-3 (onboarding onto F-015): The detail file was rich enough that a maintainer new to the feature could produce a security review in one pass. The REFACTOR-225 finding (anchor-set single-point-of-failure) and DOC-GAP-099 (OpenAPI-summary inversion) are immediately actionable, probe candidates are concrete, and the test-matrix gap enumeration is complete enough to write tickets without re-reading source. For the onboarding promise (§1 promise 1) the ontology demonstrably pays for itself."
- "doc-gaps.md and implicit-adrs.md are structured, indexed, and findable via feature name or concept grep. Cross-references between these reducers and the feature-flow detail files are bidirectional where they exist — a maintainer can start at doc-gaps.md DOC-GAP-099 and arrive at F-015 via the cross-reference in the drift facet."

---

## axis_score
score: 6
band: AMBER
rationale: |
  All three tasks completed from the ontology — no task required opening a source file to
  make progress. That earns above the RED/AMBER boundary. The score does not reach GREEN
  (8-10) for three reasons: (1) TASK-2's impact-analysis path has one structural navigation
  forced-open (PRA-F1 — index too large to load as a unit), which would be a genuine blocker
  for a human maintainer without shell grep access; (2) condition 3 of the explicit target
  requires tasks on a *randomly chosen* feature with zero opens across all eight §1 promise
  types — this panel run only exercised three of the eight promise types, and the index-size
  problem means impact-analysis (promise 2) does not yet meet the zero-opens bar; (3)
  Layer 4b coverage at 1/30 features means the "feature-flow composition + product-owner
  reflection" promise (§1 promises 7-8) is incomplete for 97% of features. The score of 6
  (mid-AMBER) reflects: tasks are completable, information is actionable and correctly
  pitched, but the navigation infrastructure has a load-bearing structural gap and the
  Layer 4b coverage is not yet sufficient to call condition 3 met.

---

## independence_self_assessment
shared_blind_spot_risk: |
  As an LLM, I can navigate a 318 KB file via grep + offset in a single session — a human
  maintainer without shell access cannot. I may therefore undercount the friction of PRA-F1:
  the grep workaround feels like a minor annoyance to me but represents a genuine blocker
  for the "O(1) lookup" promise if the maintainer is working in a web IDE or a context
  where only the Read tool is available. I may also overestimate the richness of F-015
  because I read the detail file in full — a human maintainer would typically read only
  the sections relevant to their task, and the 682-line file's density could itself be an
  altitude issue at the finding level (though the structure mitigates this significantly
  via named facets and drift-class summaries).
needs_human_verification:
  - "TASK-2 — a real maintainer should attempt this with Read-only access (no grep/shell) to measure actual friction of the oversized index"
  - "TASK-3 — a maintainer unfamiliar with the ontology schema should attempt onboarding onto a feature they have not previously reviewed to validate the 'zero forced opens' claim holds without ontology-schema familiarity"
