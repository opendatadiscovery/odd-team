---
id: ADR-DRAFT-feature-anchored-ontology
title: "Anchor the agentic ontology on entry-points and user-observable features, not on per-node code reading; compose cross-layer behaviour via a feature-flow reducer; control every feature along a 4-class test matrix"
status: draft
date: 2026-05-19
scope: workspace-meta (EXTENDS `agentic-code-ontology.md` revision 3 — does not supersede)
related_drafts: ADR-DRAFT-agentic-code-ontology, ADR-DRAFT-code-lineage-substrate
trigger_incident: 2026-05-19 view_count empirical probe — ontology had 50/395 sidecars + 7 reducer artefacts after batch G yet was silent on a user-observable doubling that emerges from cross-layer code composition
case_law: retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md
runtime_correction: 2026-05-19 — initial proposal naively suggested treating documented features as the input corpus; maintainer corrected: docs may be stale or silent, code is truth, docs are the audit target
---

# ADR-DRAFT: Feature-anchored ontology — entry-points, code-as-truth, cross-layer composition, 4-class control

## Context

### The trigger

After seven batches of agentic-ontology enrichment (batch G shipped 2026-05-18 on `feature/agentic-ontology-enrichment-batch-2026-05-13-G`; cumulative state: 50/395 sidecars; concepts.yaml v8 with 105 concepts; implicit-adrs.md with 67 candidates; refactoring-scopes.md with 211 scopes; doc-gaps.md with 103 findings; test-map.yaml with 312 test gaps), the maintainer ran a live empirical probe against `demo.oddp.io`:

> *could you check that view_count doubles each time we open details for a data entity?*

Empirical answer (5 sequential probes + UI route check + React component code-walk):

- **Backend `GET /api/dataentities/{id}` increments view_count by exactly +1 per call.** Documented in batch-F sidecar; confirmed.
- **UI page-open fires the API twice per mount** due to a `useEffect` dependency-array containing `details.status?.status` (a value derived from the fetch response, which causes the effect to re-fire after the first fetch lands). `DataEntityDetails.tsx:56-64`.
- **Net user-observable behaviour: opening a detail page increments view_count by 2.** No sidecar, no concept, no ADR-candidate, no refactoring-scope, no doc-gap, no test-gap in the ontology contained this fact.

The closest neighbours in the ontology:

- `getDataEntityDetails.md` sidecar (batch F): per-call delta = +1. Backend-anchored, correct, complete.
- `getPopular.md` sidecar (batch G): consumer of `view_count DESC`; ranking trivially inflatable. Backend-anchored, correct, complete.
- TEST-GAP-256 (batch F), TEST-GAP-309 (batch G): inflation regression candidates, both anchored on the *backend* per-call cost.

The doubling fact lives in the **cross-layer composition** — `(UI dispatch-multiplicity = 2) × (backend per-call delta = +1)`. Neither a UI sidecar nor a backend sidecar alone produces it. No reducer composes it. The methodology has no layer where it would surface.

### Why this is an architectural decision, not a tactical pivot

A tactical pivot would be "enrich the React component, add a comment to the relevant sidecar, log a REFACTOR-NNN." That misses the structural problem.

Three independent considerations make this a genuine architectural decision:

1. **The unit of analysis is wrong, not the per-node analysis.** Per-node sidecars are correct in their scope; what they produce is faithful. The missing layer is **composition across nodes that share a user-observable boundary**. The same shape will keep producing misses for every feature whose behaviour depends on >1 layer interacting — which is most features in any non-trivial product.

2. **The polarity on documentation is wrong.** The first attempt at fixing the gap (in the meta-conversation that produced LSN-017) proposed extracting feature-flows from documentation. The maintainer corrected: docs can be stale, inconsistent, or silent. Code is truth; docs are the audit target, not the source. Anchoring on docs would systematically miss any feature the docs failed to name — including (canonically) bugs that produce user-visible effects.

3. **Test-coverage is single-class today.** `test-coverage-mapper` produces `TEST-GAP-NNN` candidates against per-sidecar `uncovered_behaviours` — that is one class of test (essentially unit-level: does THIS node behave correctly?). A feature is controlled along four orthogonal axes (unit / integration / performance / security); the current methodology has visibility into one of four. The view_count doubling bug lives precisely in the empty integration cell.

The right response is **extension, not replacement**. The substrate ADR and the agentic-code-ontology ADR stay valid. This ADR adds:

- A new unit of analysis: **entry points** (places where the system meets an external observer)
- A new analytic direction: **outside-in traversal** from entry-point → service → repository → DB / external-call / activity-emission, with **references-as-placeholders** at unresolved hops
- A new reducer: **feature-flow-builder** that composes per-feature observable behaviour across entry-point sidecar chains
- A new test-control discipline: **four-class test matrix** (unit / integration / performance / security) per feature
- A new methodology principle: **code is truth, docs are audit target** — feature catalog is derived from the code-walk, then checked against published docs

### What this layer buys (and what it does NOT)

| Buys | Does not buy |
|---|---|
| **Cross-layer composition** — per-feature multiplication, amplification factors, observed-vs-expected. The view_count doubling lands as a feature-drift entry with a single citation chain. | **Replacement of per-node sidecars.** Sidecars stay as-is; they remain the unit of code-level enrichment. Composition reads sidecars; it does not replace them. |
| **Feature catalog derived from code, not docs.** Each entry-point traversal produces a feature; the union of features is the catalog. Doc-gap-finder compares the catalog to live docs. | **Replacement of docs as a reference surface.** Docs remain the operator-facing surface the project publishes. The shift is in directionality: code-anchored truth flows TO docs, not from. |
| **Per-feature test-control matrix.** Each feature has a 4-cell row: unit / integration / performance / security. Empty cells are gaps; covered cells are pinned. | **Generation of test code.** This ADR specifies the matrix; emission of test scaffolds is a downstream slice (deferred). The schema field `test_files_proposed` already exists; the matrix simply organises it by class. |
| **Multi-pass refinement.** Same code visited from multiple entry-point chains; the node's full meaning accumulates. References act as placeholders during early passes. | **Single-session completeness.** The methodology is incremental by design. A first traversal leaves refs; later passes flesh them. No batch is "complete." |
| **Change-request scoping with second-order effects.** "If I fix the useEffect, what downstream cells in the matrix flip?" The ontology answers with citations. | **Mechanical fix proposals.** The ADR surfaces gaps and their structural causes; fix selection remains the maintainer's call (per ADR-CANDIDATE-006 in agentic-code-ontology — file-analyser does not write source code). |

### Why now, not later

The prior batches A–G demonstrated that per-node enrichment delivers value at scale: 211 refactoring scopes, 67 ADR candidates, 312 test gaps, 105 concepts — material findings the maintainer would not have surfaced without the methodology. The methodology produced strong code-anchored results.

The empirical probe revealed where the methodology's ceiling is. Continuing to scale per-node enrichment without adding the composition layer would produce more findings of the existing shape but would not catch view_count-class bugs. The methodology's blind spot is **structural**, not "we haven't scanned enough nodes yet." Adding the composition layer earlier (now) is cheaper than later (after another 50 sidecars of the same shape).

The cost ceiling consideration is similar to LSN-016's pivot: the right time to add a layer is when the layer below has shipped enough to demonstrate its shape and its limits. Batch G's findings — five-sidecar read-collaborative cluster, 18-sidecar DISABLED-bypass cluster, six-sidecar audit-log refinement — show the per-node shape is reliable. The view_count miss shows the per-node ceiling. Adding the composition layer now is the natural next pivot.

## Decision

**Anchor the agentic ontology on entry-points and user-observable features. Each enrichment traversal starts at an entry point (UI mount / button onClick / REST operation / scheduled job / webhook / WAL listener / SDK builder / boot-time configuration), walks downstream through services / repositories / external effects, and records user-observable consequences at every hop. Code is the source of truth; documentation is the audit target. A new reducer composes per-feature observable behaviour from the entry-point sidecar chains and emits per-feature observed-vs-expected facts plus a 4-class test-control matrix.**

### Five principles — non-negotiable

1. **Code is truth; documentation is the audit target.** Features emerge from code-walk traversal, never from a docs-derived catalog. Doc-gap-finder compares code-anchored feature facts to published docs; drift surfaces as DOC-GAP-NNN. The ontology cannot start from a feature list extracted from docs because the feature list must itself be derivable from code (and docs may be stale, inconsistent, or silent about features the code has — including bugs that produce user-observable effects).

2. **Entry points are the unit of analysis.** An entry point is a code site where the system meets an external observer — UI route mount, UI button onClick, UI form submit, REST operation (each OpenAPI op regardless of caller), scheduled `@Scheduled` job, webhook receiver, WAL listener, SDK builder, boot-time `@PostConstruct` / `@Configuration` evaluation. Each entry-point sidecar walks downstream effects: trigger → service hop → repository hop → DB write / external call / activity emission / SSE push / cache update. At every hop the sidecar logs the user-observable consequence and the call-graph context.

3. **The same code is visited many times — that is the structural justification for the ontology.** A `view_count` UPDATE is reached from the UI detail-page mount (×2 via useEffect dep-array), from third-party API consumers (×1), from any future entry point yet to be enriched. The node's full meaning is the union of facts gathered across all entry-point traversals that touch it. References act as placeholders during early passes; later passes flesh them. Re-visiting the same code from a new entry-point context is expected and welcomed.

4. **A feature-flow-builder reducer composes per-feature observable behaviour from entry-point sidecar chains.** Output: per-feature `observed_vs_expected` assertions, with `amplification_factor` where multipliers stack across layers, and `cross_layer_drift` annotations where one layer's assumption diverges from another's. The view_count doubling lands as `feature_id: F-001`, `amplification_factor: 2`, `observed_vs_expected.observed: +2`, `observed_vs_expected.expected: +1`, drift class `ui_amplification`.

5. **Features are controlled by tests along four orthogonal axes.** Per-feature test matrix:
   - **Unit** — each contributing code node, in isolation, with the right invariant. Fast (~ms). Mocks at every boundary. Failure means: the smallest piece is wrong.
   - **Integration** — the chain composes correctly across layer boundaries (UI dispatch → thunk → API client → controller → service → repository → DB write → response → UI state update). Real WebFluxTest + real DB via Testcontainers. Failure means: pieces compose wrong — the view_count doubling lives here.
   - **Performance** — the chain meets a measurable budget (latency p99, query count, memory allocation, throughput at concurrency N). Failure means: feature degrades silently under load.
   - **Security** — the chain enforces the auth gate, owner-scoping, data-exposure boundary, side-effect blast radius. Tests across the auth-mode matrix. Failure means: happy actor is fine; adversarial actor breaks the feature.

The four classes are orthogonal: a feature can be fully unit-tested and still fail integration (the canonical view_count case), or pass integration at unit-level traffic and still fail performance, or pass for the authenticated happy path and still fail security. The matrix forces explicit coverage along all four.

### Runtime architecture — non-negotiable

The prior runtime principles from `agentic-code-ontology.md` revision 3 all hold without change:

1. Claude Code is the runtime.
2. Subagents are the workers (now extended with `feature-flow-builder`).
3. Skills are the maintainer-facing entry points (new skills: `/feature-walk-build`, deferred).
4. Live documentation is the only doc surface (WebFetch on `docs.opendatadiscovery.org`).
5. Incremental, multi-session.
6. Cost is zero per-call (session-token budget is the constraint).

### Schema extensions

#### Sidecar schema gains two required blocks

Append to the per-node sidecar schema:

```markdown
## upstream_callers
For each call-site that reaches this node, record the entry-point context:
- entry_point: "<axis>:<descriptor>" (e.g., "ui_route:/dataentities/{id}/overview")
  caller_node: "<node_id of immediate caller>"
  multiplicity_per_trigger: <N> | unresolved
  evidence: "<file:line>"
  observation_class: ui-call | rest-call | scheduled-trigger | webhook | wal-event | sdk-call | boot-eval

If a caller is known but not yet enriched, record a REFERENCE entry — `unresolved: true` —
to be filled on a later pass.

## downstream_side_effects
For each user-observable or externally-observable consequence of this node's execution:
- side_effect_class: db-write | activity-emit | external-call | sse-push | cache-mutate | log-emit | metric-emit | page-render | header-set | redirect-issue
  description: "<one sentence — what does an external observer see change>"
  evidence: "<file:line>"
  cardinality_per_call: <N> | <conditional-expression>
  reachable_from_entry_points: ["<axis>:<descriptor>", ...]  # union across passes

If a downstream callee is not yet enriched, leave a REFERENCE entry with `unresolved: true`.
```

Plus a per-behaviour `test_class` annotation on `tests_coverage_semantic.uncovered_behaviours` (in addition to the existing `criticality` field):

```yaml
uncovered_behaviours:
  - behaviour: "<one sentence>"
    test_class: unit | integration | performance | security
    criticality: CRITICAL | HIGH | MEDIUM | LOW
    gap_id: TEST-GAP-NNN
```

The existing `category` field (`missing-unit`, `missing-integration`, `missing-edge-case`, `missing-security`, `missing-performance`) rolls into `test_class` (edge-case becomes a flavour of one of the four). The schema migration is forward-compatible: existing sidecars are valid; new sidecars carry the richer annotation.

Sidecar prompt_version bumps `0.2.0 → 0.3.0`.

#### Test files become a substrate axis (`test_axis`)

Each test file is classified by content + naming:
- `@WebFluxTest` / `@SpringBootTest` + real Testcontainers → `integration`
- `@ExtendWith(MockitoExtension)` + service-layer mocks → `unit`
- `*BenchmarkTest.java`, `EXPLAIN ANALYZE`, latency/throughput assertions → `performance`
- `*AuthorizationTest.java`, `*DisabledModeTest.java`, auth-mode matrix → `security`
- Untyped tests → flagged as a substrate-coverage gap (the test itself does not declare what dimension it claims to cover)

The classification feeds the per-feature matrix population.

#### A new reducer: `feature-flow-builder`

System prompt at `.claude/agents/feature-flow-builder.md`. Inputs:

- Every per-node sidecar's `upstream_callers` + `downstream_side_effects` blocks
- The full call graph composed across sidecars (entry-point → controller → service → repository → DB write)
- concepts.yaml (for concept-level criticality anchors)
- The 4-class test-file classification

Output: `lineage/{repo}/feature-flows.yaml` with one entry per emergent feature:

```yaml
feature_id: F-NNN
feature_name: "Detail-page view tracking"
discovered_from_entry_point: "ui_route:/dataentities/{id}/overview"
contributing_nodes:
  - "ui DataEntityDetails.tsx (useEffect dispatch ×2 per mount)"
  - "ts redux/thunks dataentities.thunks.ts:35-40"
  - "java DataEntityController controller-method:getDataEntityDetails"
  - "java ReactiveDataEntityRepositoryImpl.incrementViewCount (+1 per call)"
  - "java DataEntityController controller-method:getPopular (downstream reader)"
amplification_factor: 2  # product across the chain
observed_vs_expected:
  observed: "+2 view_count per UI page-open"
  expected: "+1 view_count per logical page-open"
  drift_class: ui_amplification
  surfaced_by: ["DataEntityDetails.tsx:56-64", "live probe against demo.oddp.io 2026-05-19"]
test_matrix:
  unit:
    state: GAP
    covered: []
    uncovered: ["incrementViewCount() +1 delta", "useEffect dispatch-multiplicity = 1 per mount"]
  integration:
    state: GAP
    covered: []
    uncovered: ["UI-mount → DB delta round-trip", "sequential page-loads → linear accumulation"]
  performance:
    state: GAP
    covered: []
    uncovered: ["view_count UPDATE under 100 concurrent reads", "Popular page p99 at 50K entities", "view_count index regression"]
  security:
    state: GAP
    covered: []
    uncovered: ["DISABLED-mode anonymous inflation", "rate-limit-bypass via scripted reads"]
control_summary: 0/13 — feature uncontrolled along every axis
related_artefacts:
  refactoring_scopes: ["REFACTOR-220", "REFACTOR-229 (NEW — UI useEffect dep-array)"]
  test_gaps: ["TEST-GAP-256", "TEST-GAP-309", "TEST-GAP-310"]
  doc_gaps: ["DOC-GAP-101"]
  concepts: ["Popular Entities Ranking", "Internal Description"]
```

#### doc-gap-finder gains a new finding class: `feature-control-gap`

For each feature whose test-matrix has one or more empty cells AND whose user-facing doc page does not warn about the uncontrolled dimension. The doc admonition writes itself from the matrix.

Example:

> "DOC-GAP-NNN: Detail-page view tracking is not currently controlled by integration tests; current behaviour registers as 2 views per UI page-open (regression-pin in `feature-flows.yaml#F-001`). The doc page `data-discovery/catalog-overview` does not warn operators that Popular ranking sees a 2× amplification under UI traffic."

#### A new probe class: Type-7 user-observable invariants

Add to `lineage/PROBES.md` alongside the existing types. A Type-7 probe is a maintainer-authored user-observable contract — a single-sentence promise about behaviour at the system's external boundary. Each Type-7 probe is **executable** against a running demo (or staging) instance. The acceptance criterion: ontology must surface the user-observable invariant under the feature node; live probe must confirm (or fail-and-be-cited as a known caveat).

Examples:
- "Opening a detail page registers as one view in popularity ranking" — FAILS today (registers as 2)
- "Adding a term without permission returns 403" — FAILS today (path-mismatch)
- "Empty description PUT returns 400" — FAILS today (silent 200)
- "Soft-deleted entity is excluded from Popular" — FAILS today (EXCLUDE_FROM_SEARCH not applied)

Type-7 probe failures that match a feature-flow drift entry = methodology working. Type-7 probe failures where ontology was silent = methodology miss → log as LSN.

### Workflow — the new cycle

The cycle from `agentic-code-ontology.md` revision 3 (substrate → enrich → reduce → probe → commit) extends with two new steps:

```
substrate scan                   → nodes.jsonl + edges.jsonl + rollups
enrich --batch <entry-points>    → 5 sidecars (1 session) — now entry-point-anchored
                                   sidecars record upstream_callers + downstream_side_effects + test_class
reduce concept-merger            → concepts.yaml refresh
reduce adr-archaeologist         → implicit-adrs.md + refactoring-scopes.md refresh
reduce doc-gap-finder            → doc-gaps.md refresh (now produces feature-control-gap class too)
reduce test-coverage-mapper      → test-map.yaml refresh (now keyed by feature × test_class matrix)
reduce feature-flow-builder      → feature-flows.yaml refresh        ← NEW
probe Type-7 (user-observable)   → live-demo verification of feature invariants  ← NEW
commit + open PR
```

Entry-point-anchored enrichment changes the batch-planning unit. A batch picks **1-3 entry points** (not 5 random code nodes) and traverses outward. Each entry-point chain produces a sidecar set with cross-references. Unresolved hops leave references; later passes resolve them.

### Migration path

The methodology shift is forward-compatible. Existing artefacts stay valid:

- All 50 batch-A-through-G sidecars remain at `prompt_version: 0.2.0`. Re-enrichment to v0.3.0 (adding `upstream_callers` + `downstream_side_effects` + per-behaviour `test_class`) happens incrementally as nodes are re-visited from entry-point traversals.
- concepts.yaml v8 unchanged. New `feature_flows` cross-reference added on next reducer refresh.
- implicit-adrs.md, refactoring-scopes.md, doc-gaps.md unchanged; new entries from batch H onward gain feature_flow cross-refs where applicable.
- test-map.yaml gains a `per_feature` block alongside the existing `per_node` block; old entries unchanged.

Batch H is the first batch under the new methodology. The smallest experiment: pick **one entry point** (the UI `/dataentities/{id}/overview` mount) and run the whole traversal end-to-end, leaving references at every unresolved hop. If the loop closes (references resolve, the multiplicity composes, the Type-7 probe matches the predicted delta), the methodology has signal. If not, iterate before scaling.

## Consequences

### What this enables

1. **The view_count doubling bug is catchable BEFORE a user observes it.** The feature-flow-builder composes `(UI dispatch-multiplicity = 2) × (backend per-call delta = +1) = +2 per page-open` from the sidecar chain. The observed-vs-expected entry records the drift. The doc admonition writes itself from the matrix.

2. **The whole class of cross-layer bugs becomes catchable.** Every bug that emerges from "frontend assumes backend behaves X way; backend actually behaves Y way" — silent-200-on-missing-id, REPLACE-ALL-named-create, owned-vs-non-owned lineage semantics, term-linking side-channel via description, owner-auto-create permission bypass — gets a structured home as a feature-drift entry, not a buried single-sidecar finding.

3. **Tests have a per-feature matrix, not a per-file scatter.** A maintainer asking "is this feature tested?" gets a 4-cell answer (unit/integration/performance/security), not a paragraph of `uncovered_behaviours` scattered across multiple sidecars.

4. **Documentation becomes provably aligned to code.** Every doc statement about a feature is auditable against the feature-flow's observed_vs_expected. The "0% code↔doc gap" ambition from the maintainer's previous message has a measurable surface: count features whose docs match observed_vs_expected.

5. **Change requests can be scoped with second-order effects.** "If I fix the useEffect, what cells in the matrix flip?" The feature-flow entry lists contributing_nodes; the test_matrix lists what becomes pinned by each fix; the doc-gaps subsection lists what doc admonitions can be retired.

### What this costs

- **Schema migration.** Sidecars at v0.2.0 → v0.3.0. All existing 50 sidecars are valid under v0.2.0; re-enrichment to v0.3.0 happens incrementally on re-visits. No big-bang migration.
- **One new reducer subagent.** `.claude/agents/feature-flow-builder.md` — ~300-500 lines of system prompt. Standard reducer pattern; tooled identically to existing four reducers.
- **One new substrate axis.** `test_axis` — classifies test files by content (`@WebFluxTest` / mocks / benchmark / auth-matrix). Implemented as a tree-sitter + content-grep classifier; ~100 lines of extractor code.
- **A new probe class.** Type-7 user-observable invariants. Per-probe authoring cost is low (one sentence + one live curl); per-probe value is high (each probe fails today against batch-G findings, locking in regression prevention as fixes ship).
- **A new playbook.** `playbooks/entry-point-traversal.md` — protocol for the outside-in walk. Roughly 100-200 lines of PROTOCOL-shape content.

### What does NOT change

- The substrate ADR (`code-lineage-substrate.md` revision 3) is unchanged. Tree-sitter extraction is still the source of nodes.jsonl + edges.jsonl. The `file` and `concept` universal axes from extractor v0.2.0 stay.
- The agentic-code-ontology ADR (`agentic-code-ontology.md` revision 3) is extended, not superseded. All non-negotiable rules (live URLs, code-anchor mandate, banned phrases, banned external API, incremental multi-session) carry forward.
- Existing reducer outputs (concepts.yaml, implicit-adrs.md, refactoring-scopes.md, doc-gaps.md, test-map.yaml) stay as-is. feature-flows.yaml is added; the others remain canonical for their respective domains.

### Risks and mitigations

| Risk | Mitigation |
|---|---|
| Entry-point traversal produces references that never get resolved (the call-graph is open at too many points) | References carry a `priority` tag based on the entry point's user-visibility. High-priority refs (UI mounts of user-visible pages) are resolution targets in the next batch. Low-priority refs (background WAL listeners) can wait. |
| Feature-flow-builder over-fits — generates feature entries that are noise (chains that cross too many layers without a user-observable destination) | The reducer requires each feature to end at a `downstream_side_effect` whose `observation_class` is in a known external set (db-write / activity-emit / external-call / sse-push / page-render / metric-emit / log-emit / header-set / redirect-issue). Internal calls without a terminal external observation don't promote to features. |
| 4-class test matrix becomes a coverage-% drumbeat instead of a structural quality lens | The matrix is reported by feature, not aggregated to a single number. Cells are colour-coded by criticality (anchored on concepts.yaml security/performance aggregates), not by raw count. Acceptance is probe-driven (Type-7), not matrix-fill-driven. |
| The methodology shift breaks existing tooling (skills / playbooks / external integrations) | Schema v0.3.0 is forward-compatible; v0.2.0 sidecars remain valid. New reducer is additive. New probe class is additive. No deletion, no rename, no breaking change to existing artefacts. |
| Entry-point classes proliferate uncontrollably (every code path becomes an entry-point candidate) | The principle is unchanged from ADR-CANDIDATE-066-like discipline: add an entry-point class when a probe surfaces a class of code the substrate can't reach. Don't pre-design entry-point classes for cases the maintainer hasn't observed. Currently anchored: UI routes, UI components with handlers, REST operations, scheduled jobs, webhook receivers, WAL listeners, SDK builders, boot-time @Configuration eval, CLI entrypoints. Extension only after a probe demands. |

## Related

- LSN-017 — the trigger incident retrospective (view_count doubling miss)
- LSN-016 — heuristic-substrate-no-semantic-content (the prior pivot one layer below)
- agentic-code-ontology.md revision 3 — the layer this ADR extends
- code-lineage-substrate.md revision 3 — the structural seed
- APPROACH.md rev 2 — portability surface (the methodology distillation gets updated alongside this ADR)

## Open questions deliberately not addressed in this ADR

None. Every choice this ADR makes is anchored in the empirical trigger (LSN-017 + the live demo probe) and in the existing layered ADR pattern from agentic-code-ontology.md. Schema details, reducer prompt skeletons, and per-language extractor adjustments are implementation-slice deferrals — they implement this ADR, they do not require a separate decision.

If a slice during implementation surfaces a contradiction with this ADR, the slice triggers a revision-4 of this ADR (not a new ADR) per the established pattern.

## Implementation slices

1. **Slice 1 — methodology surface** (this batch): ADR + LSN-017 + APPROACH.md rev 2 + file-analyser system-prompt update (v0.2.0 → v0.3.0 schema, entry-point principle, references-as-placeholders) + feature-flow-builder system-prompt skeleton.

2. **Slice 2 — first experiment**: Run one entry-point traversal end-to-end (UI `/dataentities/{id}/overview` mount). Produce feature-flow-builder's first feature entry F-001 (view_count loop). Run the live Type-7 probe. Verify the predicted +2 delta. Promote the result to the maintainer.

3. **Slice 3 — test_axis substrate** + test-coverage-mapper rev to produce per-feature matrix. Re-key TEST-GAP entries by feature_id where applicable. doc-gap-finder gains feature-control-gap class.

4. **Slice 4 — Type-7 probe set seed**: Maintainer authors 5-10 user-observable invariants spanning the batch-G findings (term-linking 403, description Markdown round-trip, view_count single-increment, popular EXCLUDE_FROM_SEARCH, getMyObjects empty-Flux). Live-run each against demo. Cross-reference results to existing feature-flows.

5. **Slice 5 — entry-point traversal playbook** + skill (`/feature-walk-build`) + multi-session resumption shape (manifest gains `last_entry_point_traversal_commit`).

Slices 2 onward are deferred to subsequent batches. Slice 1 is this batch.
