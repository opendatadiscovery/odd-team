---
panel_run: 2026-05-22
phase: 1
expert: panel-practitioner
axis: Usefulness
commit_anchor: ede5d277
prompt_version: panel-practitioner/0.1.0
tasks_attempted: 3
tasks_completed_from_ontology: 2
total_forced_source_opens: 0
axis_score: 4
axis_band: AMBER
---

# Phase 1 — Practitioner (Usefulness) assessment

## summary

The ontology completes two of three tasks from the artefacts alone, with
zero forced source opens — the two completed tasks (verify a doc claim,
scope a description-write change) are genuinely useful and answered at
the right altitude. The third task — a senior-product-owner review of the
Popular Entities feature (target condition 11) — cannot be started from
the ontology because no feature-reflector artefact exists for any feature;
the entire Layer 4b output is absent. For the tasks it does support, the
ontology is actionable and findable in 1-3 hops. The gap is not depth on
covered features: it is that the feature set is five features wide (all on
`DataEntityController`), the UI interaction layer is essentially absent
from sidecars (one `SelectLanguage` widget, one route-shape sidecar, no
form/modal/table enrichment), and no product-owner reflection has been
produced for any feature. Target condition 11 is entirely unmet; condition
10 is structurally acknowledged but un-enriched.

## target_lens

Target conditions 3 and 11 most directly own this axis.

**Condition 3**: Every §1 promise (onboarding, impact analysis, ADR
archaeology, test-coverage lookup, security/performance posture, doc-drift,
feature-flow, control-matrix) must complete from the ontology with zero
forced source opens, drawn from a randomly chosen feature. The bar for
usefulness is: pick any enriched feature at random, attempt the eight
promise-tasks, and finish without opening the source.

**Condition 11**: Every composed feature flow must have a current
feature-reflector reflection — a top-down product-owner pass that reasons
from the user's screen, generates and validates hypotheses on operator
understanding/UX/consistency/customizability, traced through UI sidecars.
No feature may carry `ui-incomplete` and no feature analysis may terminate
at the backend endpoint chain.

The concrete bar this axis holds: (a) at least one feature can be examined
across all eight §1 promises from the ontology with zero forced source
opens; (b) at least one feature-reflector artefact exists and contains the
product-owner reflection described in APPROACH.md §15.

## task_simulations

- id: TASK-1
  task: "Verify the live API-reference doc claim: 'Unset lineage_depth returns
    the platform default depth.' Determine whether this claim is true or
    false and what the actual behaviour is."
  task_type: verify-doc-claim
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "few hops — doc-gaps.md summary names DOC-GAP-089 with the
    exact claim; feature-flows.yaml F-005 corroborates with probe-run
    evidence P-008 (run R-20260519T012533Z-P-008); the sidecar
    odd-platform__java__DataEntityController__controller-method__getDataEntityDownstreamLineage.md
    is referenced as a contributing node in F-005"
  altitude: "right — the ontology delivers a verdict ('documented contract is
    unimplementable — NPE on null lineage_depth') plus the exact file:line
    reference (LineageService.getLineage primitive int parameter), the live
    doc quote, the probe-run ID that measured the 5xx, and the cross-reference
    to REFACTOR-202 and TEST-GAP-279. A maintainer can act immediately."
  notes: |
    doc-gaps.md batch-F summary names DOC-GAP-089 explicitly: "lineage_depth
    'Unset returns default' is documented but unimplementable (NPE)". The
    feature-flows.yaml F-005 entry repeats this with measured evidence: probe
    P-008 GETs without lineage_depth and observes last_response_status in
    [500, 599]. The sidecar for getDataEntityDownstreamLineage is referenced in
    F-005's contributing_nodes list. Navigation path: doc-gaps.md summary
    (one hop) → F-005 in feature-flows.yaml (second hop). The claim-vs-code
    verdict is actionable and evidence-cited. This is the ontology at its best:
    the answer is O(1) from the index.

- id: TASK-2
  task: "Scope the change: 'Add input sanitisation to the
    description-write path (PUT /api/dataentities/{id}/description).'
    What files are affected, what tests must extend, what doc pages need
    updating, what related refactoring scopes exist?"
  task_type: scope-a-change
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "few hops — feature-flows.yaml F-004 is directly titled
    'Data entity description — Markdown content storage'; refactoring-scopes.md
    REFACTOR-218 names the fix target; doc-gaps.md DOC-GAP-096 names the
    documentation gap; test_matrix in F-004 names the two PROBED-PINNING-BUG
    cells and the uncovered behaviours"
  altitude: "right — the ontology answers all four sub-questions at actionable
    depth. The UI-side partial mitigation (React attribute filtering) and the
    probe-verified attack surface (DOM tags pass, event attributes stripped,
    execution closed by browser mitigation) are recorded with run IDs. One
    meaningful gap: the markdown-rendering-pipeline concept entry
    (lineage/odd-platform/concepts/detail/entities/markdown-rendering-pipeline-rehype-raw-without-rehype-sanitize.yaml)
    provides cross-feature reach (which OTHER rendering surfaces use the same
    pipeline) but the cross-reference is only accessible by knowing to look in
    concepts/detail/entities — it is not surfaced as a link FROM F-004."
  notes: |
    F-004 in feature-flows.yaml delivers: (1) the backend chain
    (DataEntityController → ReactiveDataEntityRepositoryImpl — stored verbatim,
    no sanitisation); (2) the UI rendering chain (react-markdown + rehype-raw
    without rehype-sanitize); (3) REFACTOR-218 as the fix target; (4) TEST-GAP-293
    and TEST-GAP-295 as test gaps; (5) DOC-GAP-096 as the doc gap; (6)
    probe-verified measurements from P-007 and P-009. The concepts/detail/entities
    directory holds the markdown-rendering-pipeline concept which would extend
    the blast-radius picture (does the same pipeline apply to dataset-field
    descriptions? to term definitions?), but finding it requires knowing the
    entity-level detail directory exists — it is not cross-linked from F-004's
    related_concepts list despite "Markdown Rendering Pipeline" being named
    there. One findability friction point, not a blocking gap.

- id: TASK-3
  task: "Perform a senior-product-owner review of the Popular Entities
    feature: how does the user experience the feature, is it intuitive,
    consistent with the platform, and what UX hypotheses can be validated
    from the implementation chain?"
  task_type: onboard
  completed_from_ontology: no
  forced_source_opens:
    - question_ontology_could_not_answer: "What does the Popular strip look
        like in the UI — which component renders it, what does the operator
        see, how does it behave on click, is it consistent with other ranking
        surfaces?"
      had_to_read: "NOT OPENED — task was declared incomplete rather than
        opening source (per Rule 2). Source that would be required:
        odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx
        and the catalog overview component that renders the Popular strip."
  actionability: descriptive-only
  findability: "not found — no feature-reflector artefact exists anywhere in
    lineage/odd-platform/; the feature-flows.yaml F-003 entry terminates at the
    backend CTE (listPopular) and references the 'Popular strip' as a
    page-render side effect but provides no UI-layer analysis"
  altitude: "too shallow — F-003 in feature-flows.yaml describes the backend
    mechanics accurately (view_count DESC, EXCLUDE_FROM_SEARCH gap) but contains
    zero product-owner reasoning: no hypothesis about what the operator sees,
    no UX consistency check, no analysis of whether 'Popular' is labelled
    correctly in the UI vs what it actually computes, no check on whether the
    strip is discoverable, no review of the click-target behaviour. The F-001
    entry for detail-page view tracking cross-references
    DataEntityDetails.tsx:56-64 but as an UNRESOLVED reference with no sidecar.
    The ui_routes rollup shows /dataentities routes exist but no enriched
    component sidecar is present."
  notes: |
    The entire Layer 4b (feature-reflector) is absent. Searching
    lineage/odd-platform/ for any file matching 'feature-reflector' or
    'reflector' returns zero results. The feature-flows.yaml header confirms
    this: it was generated by feature-flow-builder/0.1.0, not by
    feature-reflector/0.1.0, and the batch_history lists only 'F-001..F-005
    authored' with no reflector pass. Target condition 11 requires every
    composed feature flow to have a current feature-reflector reflection; zero
    of five feature flows have one. For the Popular Entities feature specifically,
    the canonical concept entry (concepts/detail/canonicalisation_candidates/
    popular-entities-ranking.yaml and popular-ranking-signal-most-viewed-or-most-used-doc-claim-misleading.yaml)
    names UI-surface facts ('popular tile click target' in popular-tile-click-target-overview-vs-structure-doc-drift.yaml)
    but these are canonicalisation candidates, not product-owner reflections.
    The ontology cannot answer: what does the operator actually see, is it
    intuitive, and is the labelling consistent with the ranking signal?

## findings

- id: PRA-F1
  title: "Feature-reflector layer (Layer 4b) is entirely absent — zero features
    have a product-owner reflection"
  severity: CRITICAL
  evidence: "lineage/odd-platform/ — Glob for 'feature-reflector*' returns
    zero results; feature-flows.yaml header shows prompt_version:
    feature-flow-builder/0.1.0, no reflector pass in batch_history; five
    features (F-001..F-005) all terminate at backend mechanics with no
    product-owner reflection section"
  detail: |
    Target condition 11 requires every composed feature flow to carry a
    current feature-reflector reflection: top-down product-owner pass,
    5-15 falsifiable user-facing hypotheses, per-hypothesis verdicts traced
    through UI sidecars (APPROACH.md §15). Zero of five feature flows have
    this. The feature-reflector subagent from APPROACH.md rev 5 / §15 has
    not been invoked on any feature. A maintainer asking "how does the user
    experience this feature, is it intuitive, consistent, customisable?" gets
    no answer from the ontology — they must open the source and the UI.
    This is not a gap in depth; it is an absent layer.
  routed_to: approach-rev
  confidence: HIGH

- id: PRA-F2
  title: "UI interaction layer (forms, modals, component trees) has zero
    enriched sidecars — all five features terminate at the backend endpoint
    chain"
  severity: HIGH
  evidence: "lineage/odd-platform/rollups/ui-shell.md — 13 ui_shell nodes,
    only 1 enriched (SelectLanguage widget); lineage/odd-platform/rollups/
    ui-routes.md — 12 routes listed, only 1 enriched (alerts route-shape
    sidecar); feature-flows.yaml F-001 hop 1 (DataEntityDetails.tsx) marked
    'unresolved: true — sidecar not yet enriched'; F-004 and F-003 have no
    UI hop at all in their chains"
  detail: |
    Target condition 10 requires the UI interaction layer to be present as
    a substrate axis and enriched as sidecars, with every feature's UI layer
    threaded into its feature flow. The substrate does list ui_shell and
    ui_routes nodes (rollups exist), but the enrichment pass has not run on
    component-level nodes. F-001 acknowledges DataEntityDetails.tsx as an
    unresolved reference; F-003 (Popular ranking) has no UI hop at all — the
    'popular strip' component is unnamed. The controllers.md rollup shows 203
    controller-methods; the ui-routes rollup shows 12 routes; there is no
    intermediate layer connecting a route to the forms and modals the operator
    uses. A maintainer asking "what component does the operator interact with
    for this feature" cannot answer from the ontology for any of the five
    features.
  routed_to: approach-rev
  confidence: HIGH

- id: PRA-F3
  title: "Feature coverage is five features, all on DataEntityController —
    no randomly-chosen feature from the broader catalog can be examined
    via the eight §1 promises"
  severity: HIGH
  evidence: "feature-flows.yaml header: total_features: 5; processed_node_ids
    in concepts.yaml show 50 enriched sidecars but feature-flows.yaml
    processed_node_ids are all DataEntityController methods; target condition 3
    requires the eight promises to be answerable from a *randomly chosen*
    feature, not a pre-enriched one"
  detail: |
    Target condition 3 specifies the promises must hold for a randomly chosen
    feature, not one hand-picked from the five composed flows. The catalog has
    36 controllers and 203 controller-methods; enrichment has covered 50 nodes,
    producing 5 features all drawn from DataEntityController. For any feature
    outside this set — CollectorController, DataQualityController,
    ReferenceDataController (16 methods), TermController (23 methods),
    QueryExampleController (12 methods) — none of the eight promise-tasks can
    complete from the ontology. A maintainer working on term-search or
    data-quality test reports is on their own.
  routed_to: approach-rev
  confidence: HIGH

- id: PRA-F4
  title: "F-004's related_concepts cross-reference 'Markdown Rendering Pipeline'
    does not link to the concept's detail file — blast-radius findability
    breaks at the last hop"
  severity: MEDIUM
  evidence: "feature-flows.yaml F-004 related_concepts: ['Internal Description
    (Markdown body)', 'Markdown Rendering Pipeline']; actual detail file is at
    lineage/odd-platform/concepts/detail/entities/
    markdown-rendering-pipeline-rehype-raw-without-rehype-sanitize.yaml —
    the related_concepts field is a bare string, not a path; a maintainer
    scoping the sanitisation change must know the concepts/detail/entities
    directory exists and guess the filename"
  detail: |
    For TASK-2, the ontology answered the core scoping question without a
    forced source open. But the cross-feature blast-radius question (does the
    same rendering pipeline apply to dataset-field descriptions, term
    definitions, or other markdown surfaces?) requires reaching the concept
    detail file. The feature-flows.yaml related_concepts field is a plain
    string label, not a resolvable pointer to the detail artefact. A maintainer
    must know to navigate to concepts/detail/entities/ and pattern-match the
    filename. This is a findability gap, not a coverage gap — the information
    exists but the last hop is broken.
  routed_to: backlog-item
  confidence: HIGH

- id: PRA-F5
  title: "F-001 and F-003 have UI hops marked 'unresolved: true' or absent
    entirely — the feature-flow chains are structurally incomplete"
  severity: MEDIUM
  evidence: "feature-flows.yaml F-001 hop 1: 'unresolved: true — sidecar not
    yet enriched'; F-003 contributing_nodes: no UI-layer node; F-001
    batch_refresh_note acknowledges 'UI component sidecars still un-enriched'"
  detail: |
    For TASK-2 (scoping the description-write change), the absence of the UI
    sidecar for DataEntityDetails.tsx was not blocking because F-004 is
    specifically the description feature and its chain correctly identifies the
    UI rendering layer (react-markdown). But for F-001 (view tracking) and F-003
    (Popular ranking), the UI layer is either missing or explicitly flagged
    unresolved. This means the amplification factor for F-001 (2× useEffect
    double-fire) is recorded in the feature flow's evidence field as an inline
    note rather than traceable from a sidecar — it relies on a manual author
    note, not on a verified enrichment artefact.
  routed_to: backlog-item
  confidence: HIGH

## what_went_well

- "TASK-1 (verify doc claim) completed in two hops with zero ambiguity:
  doc-gaps.md summary → feature-flows.yaml F-005 → probe run P-008. The
  ontology delivered a verdict, the exact measured behaviour (5xx NPE), the
  live doc quote, and the fix target (REFACTOR-202). This is the O(1) lookup
  the methodology promises. Evidence: lineage/odd-platform/doc-gaps.md
  batch-F summary (DOC-GAP-089) + lineage/odd-platform/feature-flows.yaml
  F-005 observed_vs_expected."

- "TASK-2 (scope description-write change) completed from the ontology with
  no forced source opens. F-004 in feature-flows.yaml provided: full backend
  chain, UI rendering chain, fix target (REFACTOR-218), test gaps
  (TEST-GAP-293/295), doc gap (DOC-GAP-096), and the P-007/P-009 probe runs
  distinguishing tag-injection (measured, present) from execution-surface
  (measured, currently mitigated by browser). The 'measured truth refines
  inference' principle is visible and actionable. Evidence: lineage/
  odd-platform/feature-flows.yaml F-004."

- "The sidecar depth on getDataEntityDetails is genuinely high — the
  understanding file at lineage/odd-platform/understanding/odd-platform__java__
  DataEntityController__controller-method__getDataEntityDetails.md covers
  concepts/operations/invariants/audiences/dependencies/tests/docs/ADRs/bugs/
  security/performance at file:line depth across 250+ lines. A maintainer
  onboarding to this endpoint exits with a complete mental model without opening
  the source. Evidence: the sidecar file itself, which answered every sub-question
  in TASK-2 without a source open."

## axis_score
score: 4
band: AMBER
rationale: |
  The rubric is GREEN (8-10) if every task completes from the ontology with zero
  or one forced source open total; AMBER (4-7) if tasks complete but with several
  forced opens, or actionable-but-unfindable; RED (0-3) if a task could not be
  completed at all.

  Two of three tasks completed from the ontology with zero forced source opens.
  The completed tasks are genuinely actionable and findable in 2-3 hops. This
  earns the high end of AMBER territory. The score lands at 4 (not higher) for
  three reasons:

  (1) TASK-3 could not be started from the ontology — target condition 11
  (feature-reflector) is entirely unmet. The product-owner-review task, which
  is the hardest and most valuable maintainer task for a UI-driven platform,
  returns nothing. This is not a partial result; it is a missing layer.

  (2) The random-feature condition (target condition 3) is not met. The five
  features all come from one controller. For any of the ~30 other controllers,
  none of the eight §1 promises are answerable.

  (3) The UI interaction layer is absent from all five feature chains (condition
  10). The two completed tasks happened to be backend-chain tasks where the UI
  absence did not block the answer. But they remain incomplete as feature analyses:
  the ontology cannot say how the operator experiences the feature, only how the
  backend implements it.

  Score 4: the tasks it does cover, it covers well; the coverage and layer gaps
  leave the majority of the ontology's promise undeliverable today.

## independence_self_assessment
shared_blind_spot_risk: |
  As an LLM, I may assess the two completed tasks as "sufficient" because the
  sidecar content is dense and well-cited. A human maintainer attempting the same
  tasks might find the altitude of the doc-gaps.md summary section (the primary
  entry point) too verbose for fast lookup — it is 18-bullet history, not a
  quick-reference index. I may be more tolerant of navigating 250-line sidecars
  than a human with limited context window time would be. I may also under-weight
  the cost of the broken related_concepts cross-reference (PRA-F4) because I can
  enumerate files from the directory listing; a human maintainer cannot do that
  without grep.
needs_human_verification:
  - "TASK-2 — a human maintainer should attempt the description-sanitisation
    scoping task to verify that the 2-3 hop path through feature-flows.yaml F-004
    is fast enough in practice, and that the missing cross-link to the
    markdown-rendering-pipeline concept detail actually blocks the blast-radius
    question rather than being a minor friction point."
  - "TASK-3 — a human maintainer should confirm that the absence of a
    feature-reflector output genuinely blocks the product-owner review task,
    and is not partially compensable by reading the F-003 chain plus the
    canonicalisation-candidate concept files."
