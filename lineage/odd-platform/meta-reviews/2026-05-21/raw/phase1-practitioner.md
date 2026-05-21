---
panel_run: 2026-05-21
phase: 1
expert: panel-practitioner
axis: Usefulness
commit_anchor: ede5d277
prompt_version: panel-practitioner/0.1.0
tasks_attempted: 3
tasks_completed_from_ontology: 3
total_forced_source_opens: 0
axis_score: 7
axis_band: AMBER
---

# Phase 1 — Practitioner (Usefulness) assessment

## summary

A maintainer can complete all three tasks tested here — a doc-claim verification,
a scope-a-change analysis, and an onboarding question — entirely from the ontology
without opening the target source. The information is present and, in two of three
tasks, immediately actionable. The critical flaw is navigational: the path from a
high-level question to the artefact that answers it is not self-evident. TASK-2
(scope-a-change on Popular pagination) required reading a 561-line sidecar to
extract the answer; the answer was correct and file:line-cited but buried under 400
lines of unrelated detail. The ontology's altitude problem is not absence of content
— it is the absence of a decision-layer summary that sits between the feature-flows
index and the full sidecar. A maintainer who opens the sidecar hoping for a
"pagination change affects: [X, Y, Z]" will find it eventually, but not in one hop.

## task_simulations

- id: TASK-1
  task: "Verify the doc claim that 'Clicking a Popular tile opens the entity's Structure page.' Is the claim correct?"
  task_type: verify-doc-claim
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "few hops — feature-flows/detail/F-003.yaml is the landing artefact; the facet 'Popular click-target navigates to Overview, doc says Structure (batch J)' answers the question in four lines with file:line citations on both sides (DataEntityList.tsx:38 + dataEntitiesRoutes.ts:66-73 + catalog-overview.md:54). Navigation path: feature-flows.yaml (5 features listed) → F-003 (Popular ranking) → observed_vs_expected facet 2."
  altitude: "right — the facet is short, cites both the doc claim and the code counter-evidence, names the downstream consequence (F-001 inflation loop closure), and states the expected fix direction. No verbosity tax."
  notes: |
    The task completed in one read of F-003.yaml lines 114-136. The claim is wrong:
    the doc says Structure, the code (DataEntityList.tsx:38 → dataEntityDetailsPath
    defaults to 'overview') navigates to Overview. The facet provides the fix
    direction (update the doc to 'Overview tab') and the secondary consequence
    (the Overview-tab navigation is what closes the F-001 view_count inflation
    loop — changing to Structure would break it). No source open required. This
    is the ontology working exactly as promised.

- id: TASK-2
  task: "I want to add pagination support to the Popular entities list. What files and components are affected, and are there any constraints I need to know before starting?"
  task_type: scope-a-change
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "had to read broadly to discover it — feature-flows/detail/F-003.yaml answers the question but the answer is spread across three non-adjacent sections of a 375-line file. The critical constraint ('Hardening Popular (e.g. pagination for inflation-resistance) requires hardening all four together OR splitting the component') lives in the observed_vs_expected block at line 102; the file:line chain for the affected nodes lives in the sidecar at lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md lines 63-72. Two reads needed."
  altitude: "too verbose to load — the getPopular sidecar is 561 lines; the pagination-relevant content occupies roughly 50 lines. The maintainer must read the full sidecar or grep-within to find: (a) no pageInfo in response (components.yaml:925-928), (b) OwnerEntitiesList structural constraint (4 columns, all use DataEntityList, no per-column 'view more'), (c) page-1-indexed offset math with no minimum enforcement (openapi.yaml:877-893), (d) no index on view_count, (e) chain: DataEntityController.java:307-313 → DataEntityServiceImpl.java:227-231 → ReactiveDataEntityRepositoryImpl.java:629-649."
  notes: |
    The scoping answer is complete and file:line-anchored from the ontology. The
    affected chain is clear: controller (DataEntityController.java:307-313) →
    service (DataEntityServiceImpl.java:227-231) → repository
    (ReactiveDataEntityRepositoryImpl.java:629-649). The UI constraint is critical
    and non-obvious: Popular is the 4th column inside OwnerEntitiesList.tsx:99-105
    (not a standalone PopularStrip.tsx — that file does not exist); adding a
    'view more' link to Popular alone requires either splitting DataEntityList or
    adding per-column behaviour to all four columns simultaneously. The response
    contract also needs updating: DataEntityRefList (components.yaml:925-928) is
    a bare array with no pageInfo wrapper, so the OpenAPI spec and the UI thunk
    (dataentities.thunks.ts:177-184, which fetches page=1 only) need coordinated
    changes. The constraint is findable but requires reading two artefacts
    (F-003 + getPopular sidecar). A 'change impact' summary block at the feature
    level does not exist; the maintainer assembles it from the contributing_nodes
    list plus the sidecar chain.

- id: TASK-3
  task: "Onboard onto the Activity Feed's userIds filter. Does passing userIds=[42] return events generated BY user 42, or something else?"
  task_type: onboard
  completed_from_ontology: yes
  forced_source_opens: []
  actionability: actionable
  findability: "few hops — feature-reflections/index.yaml line 30 names the LSN-020 drift as the highest-severity contradiction for F-021, with the one-line answer verbatim: 'GET /api/activity?userIds=[N] does NOT filter by who-performed-the-action; it filters by USER_OWNER_MAPPING.OWNER_ID.in([N])'. From there, feature-reflections/detail/F-021.yaml lines 84-134 give the full chain with SQL evidence (ReactiveActivityRepositoryImpl.java:272-273 — the literal `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` bind) and the three downstream consequences. Navigation path: feature-reflections/index.yaml → highest_severity_contradiction → F-021.yaml → H-001."
  altitude: "right — the feature reflection answers the question at product-owner altitude (what does the user expect vs what they get) then provides the implementation chain at maintainer altitude (the exact SQL predicate and file:line). The hierarchy is correctly layered."
  notes: |
    The answer is: `userIds` does NOT filter by who performed the action. It filters
    by `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`, so passing userIds=[42] returns
    events involving entities owned by owner-ID 42, not events performed by
    user-ID 42. Three consequences follow: users with no owner mapping are
    unfilterable via this parameter; owner reassignment retroactively rewrites
    past attribution visible through this filter; multiple users mapped to one
    owner collapse to identical result sets. All of this is cited to
    ReactiveActivityRepositoryImpl.java:272-273 with the literal SQL predicate.
    The feature-reflections/index.yaml headline was sufficient to answer the
    question; the full detail file adds provenance. This is Layer 4b (the
    feature-reflector subagent) paying for itself.

## findings

- id: PRA-F1
  title: "No change-impact summary layer — scoping a change requires reading a full sidecar"
  severity: HIGH
  evidence: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md (561 lines; pagination-scoping answer across 3 non-adjacent sections); TASK-2 required 2-artefact read to assemble the change-impact answer"
  detail: |
    The ontology's promise (APPROACH.md §1, item 2 — 'impact analysis returns a
    structured map: affected concepts, related controllers/services, doc pages
    that must update, tests that must extend, ADRs that constrain') is met in
    substance but not in form. The structured map exists — it is assembled from
    contributing_nodes in the feature-flow + the full sidecar — but there is no
    single artefact that surfaces it pre-assembled. A maintainer asking "what is
    affected if I add pagination to Popular" must read a 561-line sidecar to
    extract the relevant ~50 lines. The feature-flow detail files (F-003.yaml)
    carry observed_vs_expected drift but not a change-impact summary for proposed
    modifications. The gap is: the ontology has no 'change-scope' reducer output.
    The closest thing is refactoring-scopes.md — but it covers identified
    refactoring items (REFACTOR-NNN), not proposed-change scoping.
  routed_to: new-gate
  confidence: HIGH

- id: PRA-F2
  title: "Sidecar altitude is correct for deep-dive work but too verbose for quick lookups"
  severity: MEDIUM
  evidence: "lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md — 561 lines for a single controller method; TASK-2 altitude judgment: 'too verbose to load'"
  detail: |
    Individual sidecars (Layer 2) are correctly pitched for a maintainer doing
    deep work on a specific node. They are too long to serve as a quick-lookup
    surface for cross-cutting questions ('what does pagination affect?'). The
    APPROACH.md §1 promise of O(1) lookups implies a maintainer can GET the
    answer without reading the whole file. In practice, the maintainer must
    either grep-within or read sequentially until they find the relevant section.
    For 561-line sidecars, grep-within is required but not scaffolded (there is
    no section anchor index at the top of sidecars). This is a secondary finding
    to PRA-F1: the problem is not the sidecar's length (which is justified by
    depth) but the absence of a sub-sidecar summary block (e.g. a 'change-scope'
    or 'fast-lookup' header).
  routed_to: approach-rev
  confidence: MEDIUM

- id: PRA-F3
  title: "Feature-flows index covers only 5 features out of 30 discovered — 83% of features have no flow entry"
  severity: HIGH
  evidence: "lineage/odd-platform/manifest.yaml: features_discovered: 30, feature-flows.yaml: total_features: 5, feature-flows/detail/: 15 files present (F-001..F-015) but feature-flows.yaml index lists only 5; manifest.yaml nodes_touched_by_any_feature_flow: 296 out of 395 substrate nodes"
  detail: |
    TASK-2 and TASK-3 succeeded because the relevant features (Popular ranking,
    Activity Feed) happen to have entries in either feature-flows/detail/ or
    feature-reflections/detail/. A maintainer asking the same questions about
    an unenriched feature would fall off the ontology immediately — there is no
    feature-flow or feature-reflection to consult. The manifest reports 30
    features discovered but only 5 in the feature-flows.yaml index (though 15
    detail files exist, suggesting the index is stale). The gap between
    'substrate nodes with sidecars' (144) and 'nodes touched by any feature flow'
    (296) suggests the feature-composition layer covers node-IDs that appear in
    feature flow contributing_nodes but does not mean those nodes have full
    sidecar enrichment. For features not yet in feature-flows/detail/, the
    ontology degrades to the per-node sidecar layer alone — which means
    TASK-2-style scoping requires manually tracing contributing nodes from the
    substrate, which is the O(n) exploration the ontology exists to avoid.
  routed_to: backlog-item
  confidence: HIGH

- id: PRA-F4
  title: "system-mission.md live_url_verifications all marked 'pending-WebFetch-session' — the mission anchor's confidence ceiling is MEDIUM"
  severity: LOW
  evidence: "lineage/odd-platform/system-mission.md frontmatter: confidence_overall: MEDIUM; all 14 live_url_verifications entries: status: pending-WebFetch-session"
  detail: |
    The system-mission.md artefact (Layer 0 / rev 3 addition) correctly
    flags its own confidence as MEDIUM because live-URL verification was
    deferred. For the Usefulness axis this is a low-severity finding: the
    pillar shape (P-01..P-11) was navigable without the live-site verification
    during TASK-3 onboarding. But a maintainer making a doc claim that cites
    a live URL from system-mission.md cannot fully trust the rendering status
    of those URLs. This is not a methodology gap (the deferral was documented
    per CLAUDE.md Gate 8) but a freshness gap — the WebFetch pass has not
    been run.
  routed_to: backlog-item
  confidence: MEDIUM

- id: PRA-F5
  title: "feature-flows.yaml index is stale — lists 5 features but detail/ directory has 15+ files"
  severity: MEDIUM
  evidence: "feature-flows.yaml: total_features: 5, processed_node_ids: 5 entries; feature-flows/detail/: F-001..F-030 (30 files present by ls); manifest.yaml: features_discovered: 30"
  detail: |
    The feature-flows.yaml top-level index was generated with 5 features
    (slice-2 / slice-3 manual seed) but 30 detail files now exist. A maintainer
    consulting feature-flows.yaml as the entry-point to feature coverage would
    conclude only 5 features are composed, missing the 25 additional flows in
    detail/. The index's batch_history section stops at slice-3. The feature
    index is the O(1) navigation surface; a stale index makes the O(1) promise
    false for the 25 features not in it. Navigation via feature-reflections/
    index.yaml was accurate for TASK-3 (one reflection, current). The gap is
    specifically in the feature-flows.yaml index, not the detail files themselves.
  routed_to: backlog-item
  confidence: HIGH

## what_went_well

- "TASK-1 (verify-doc-claim): F-003.yaml's observed_vs_expected block answered the question in four lines with file:line citations on both sides of the drift. Navigation was direct: feature-flows.yaml → F-003 → second facet. This is the ontology's O(1) lookup working as promised. Evidence: feature-flows/detail/F-003.yaml lines 114-136 (Popular click-target navigates to Overview, doc says Structure)."
- "TASK-3 (onboard): feature-reflections/index.yaml's highest_severity_contradiction_one_line gave the one-sentence answer immediately; F-021.yaml provided the full implementation chain. The Layer 4b (feature-reflector) contribution is unambiguously load-bearing here — the answer to the userIds question (USER_OWNER_MAPPING.OWNER_ID.in(userIds), not activity.created_by) is not surfaced by the controller sidecar (ActivityController.md bugs_limitations_corner_cases cites the enumeration risk but not the column-binding drift) and required the cross-file top-down pass to surface. Evidence: feature-reflections/index.yaml line 30 + feature-reflections/detail/F-021.yaml lines 97-119."
- "The getPopular sidecar (TASK-2) is comprehensive enough that a maintainer doing a careful read gets a full change-scope picture with zero source opens. The finding PRA-F1 is about ergonomics (assembly cost), not correctness. Evidence: understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md invariants.[3] (EXCLUDE_FROM_SEARCH), bugs_limitations_corner_cases.[2] (page=0 error), implicit_adrs.[0] (signal-mixing decision), performance.known_performance_gaps.[0] (no view_count index)."

## axis_score
score: 7
band: AMBER
rationale: |
  Three tasks, all three completed from the ontology with zero forced source opens.
  AMBER rather than GREEN for two reasons:
  (1) TASK-2 required reading a 561-line sidecar to assemble a change-scope answer
  that the APPROACH.md §1 promise implies should be O(1) — this is a findability
  failure (PRA-F1), not an absence-of-content failure. A maintainer in a hurry would
  open the source rather than invest the time to navigate the sidecar correctly.
  (2) PRA-F3 (83% of features have no feature-flow or reflection) means the
  zero-source-opens score is not representative of the full feature surface. If the
  three tasks had been chosen from the 25 unenriched features (e.g. Alert management,
  Lineage traversal depth, RBAC policy scoping), the score would be RED. The AMBER
  score reflects the actual experience on the enriched features — genuine usefulness
  with an ergonomic cost — not the projected experience on the full catalog.
  Rubric: GREEN requires zero or one forced source opens total AND actionable AND
  findable. This run had zero opens, but TASK-2's findability was 'had to read
  broadly', which the rubric scores as AMBER-floor. Final: 7/10 AMBER.

## independence_self_assessment
shared_blind_spot_risk: |
  As an LLM, I can navigate a 561-line sidecar quickly by scanning section headers
  and grep-matching internally — a human maintainer doing the same work in a terminal
  session would feel the cognitive load much more acutely. I may have rated TASK-2's
  findability as 'had to read broadly' when the honest human rating is 'unfindable
  in reasonable time without grep'. The AMBER score (7) may be 1-2 points generous
  relative to what a human maintainer would report for the same tasks. The two tasks
  that worked well (TASK-1 and TASK-3) would be similarly easy for a human — those
  findings are not LLM-inflated.
needs_human_verification:
  - "TASK-2 — a real maintainer should attempt the Popular pagination scope task with the ontology only (no source access) and report time-to-answer and number of hops. If it takes more than 5 minutes to locate the OwnerEntitiesList structural constraint and the response-shape gap, PRA-F1 severity should be upgraded to CRITICAL."
  - "PRA-F3 — a human maintainer should attempt TASK-1 or TASK-2 on one of the 25 unenriched features (e.g. Alert status change, Lineage depth parameter) to measure the RED-zone experience that the three chosen tasks did not surface."
