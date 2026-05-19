---
id: ADR-DRAFT-feature-anchored-ontology
title: "Anchor the agentic ontology on entry-points and user-observable features, not on per-node code reading; compose cross-layer behaviour via a feature-flow reducer; control every feature along a 4-class test matrix"
status: draft
date: 2026-05-19
scope: workspace-meta (EXTENDS `agentic-code-ontology.md` revision 3 — does not supersede). Revision 2 (2026-05-19) adds registry sharding + a `registry-search` subagent + an emergent-feature-registry with a substrate-fixed progress denominator after rev-1 deployed across 8 batches and surfaced reducer context growth as the cost ceiling. Revision 3 (2026-05-19) adds **Layer 0 — system mission anchor** beneath all existing layers after batch I surfaced the bottom-up-only failure mode: 60 sidecars produced only 8 features, all bug-anchored rather than pillar-anchored. The maintainer's critique: the agent lacked the platform's gestalt — what features MEAN in this domain — and therefore couldn't generalise code chains to user-observable pillars. Rev 3 introduces a new subagent (`domain-extractor`) that reads live documentation + maintainer-curated vocabulary BEFORE any code-walk and emits `system-mission.md` — a doc-anchored 8-12-pillar shape that downstream reducers (especially `feature-flow-builder`) consume to anchor their classification.
related_drafts: ADR-DRAFT-agentic-code-ontology, ADR-DRAFT-code-lineage-substrate, ADR-DRAFT-dynamic-verification-layer
trigger_incident: 2026-05-19 view_count empirical probe — ontology had 50/395 sidecars + 7 reducer artefacts after batch G yet was silent on a user-observable doubling that emerges from cross-layer code composition
case_law: retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md
runtime_correction: 2026-05-19 — initial proposal naively suggested treating documented features as the input corpus; maintainer corrected: docs may be stale or silent, code is truth, docs are the audit target
revision_2: 2026-05-19 — two cost-ceiling corrections by the maintainer after rev-1 deployment review. (a) rev-1's straw-man "1-line per-id index" for scaling reducer dedup was wrong — 1-line entries lose nuance and breed duplicates. Rev 2: index entries carry multi-paragraph discriminating context, a new `registry-search` subagent reads the index in its own context, reducers spawn the subagent per query and never load the full registry. Vector store remains deferred (LSN-016 anchor) and is named as the eventual mitigation in APPROACH.md §9. (b) rev-1 implied pre-enumerated features as the work unit, which would freeze LSN-017-shape blind-spots. Rev 2: feature registry is append-only and emerges per batch; progress is measured against the fixed substrate node count, never against the feature catalog's size.
revision_3: 2026-05-19 — feature-generalisation correction after batches H + I deployment review. Rev-2 produced 8 features against 60 sidecars; ALL 8 are bug-anchored caveats (view_count doubling, AlertManager webhook spoofing, Policy lifecycle leak, Ingestion-replace destruction, etc.) not user-observable platform pillars (Data Discovery, Data Quality, Lineage, Governance, etc.). Maintainer correction — "currently we could not really formulate the scope of feature, the intent of features, their interconnections, considerations": the methodology needs the PLATFORM'S GESTALT before it can name features at the right granularity. Rev 3 introduces **Layer 0 — system mission anchor**: a new subagent (`domain-extractor`) reads the project's live documentation + maintainer-curated concepts catalog + (when needed) maintainer-supplied framing, and emits `lineage/{repo}/system-mission.md` — a doc-anchored 8-12-pillar description with mission statement, per-pillar capability descriptions + doc-URL anchors + cross-pillar relationships, audiences, architectural pillars. Layer 0 runs ONCE per substrate scan (not per batch); downstream layers (especially `feature-flow-builder`) consult it to classify code chains as pillar-anchored features or as drift facets WITHIN a pillar (the rev-2 bug-pin features get re-classified as drift facets, not standalone features). The methodology remains bottom-up emergent (principle 8) but with top-down anchoring. Features still emerge from code-walks; they now emerge AT THE RIGHT GRANULARITY because the agent knows what "feature" means in this domain.
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

### Revision 2 trigger (2026-05-19) — cost ceiling + emergent-feature corrections

After 8 batches of rev-1 deployment (A-G enrichment + slices 2-6 of the dynamic-verification-layer ADR), two cost-ceiling concerns surfaced in the same maintainer review session that produced this revision.

**Concern A — reducer context grows linearly per batch and is hitting wall-clock + budget ceilings.** Empirical per-artefact state after batch G:

| Artefact | Size after batch G | Growth per batch | Reducer behaviour observed |
|---|---|---|---|
| `test-map.yaml` | 766 KB / 8678 lines | +26-48 gaps/batch | stream-idle timeout on batch F |
| `concepts.yaml` | 632 KB / 5911 lines | +5-21 concepts/batch | rate-limit hit on batch B |
| `refactoring-scopes.md` | 533 KB / 2845 lines | +12-49 scopes/batch | rate-limit hit on batch E |
| `implicit-adrs.md` | 449 KB / 1512 lines | +4-16 candidates/batch | rate-limit hit on batch E |
| `doc-gaps.md` | 285 KB / 1416 lines | +8-14 findings/batch | rate-limit hit on batch E |

Five reducers each reading 200-800 KB of prior artefact every batch to dedup is the binding constraint. Rev-1's incremental-reducer mode cut OUTPUT tokens; it did not cut INPUT tokens. At current growth, reducers exhaust the per-batch budget within ~10-15 more batches.

**Concern B — pre-enumerated feature catalog freezes blind-spots.** The rev-1 strawman "iterate features as the unit of work" risks the methodology pre-committing to an anticipated feature list. Features can emerge from angles no maintainer pre-imagined — LSN-017 itself is exactly that shape (the doubling fact emerges from the *combination* of UI + backend code, not from any doc page or sidecar declaring "view tracking is a feature"). Anchoring progress on a pre-enumerated feature list bakes the maintainer's anticipation into the methodology as a hard ceiling and undermines the LSN-017 principle.

Rev 2 addresses both concerns. The mechanisms are introduced as principles 6, 7, and 8 below; the schema sections "Registry sharding (rev 2)", "A new subagent: `registry-search` (rev 2)", and "Progress denominator + emergent feature registry (rev 2)" specify the implementation surfaces. Every rev-1 win — entry-point traversal, code-is-truth, references-as-placeholders, the 4-class matrix, Type-7 probes, the layer-5 measured-truth feedback — carries forward unchanged.

### Revision 3 trigger (2026-05-19) — feature-generalisation gap

After batch I shipped (the second batch under rev-2 sharded mechanics; 60 sidecars total + 5 reducers run via autonomous `/next-batch`), the maintainer reviewed the feature registry shape and surfaced a structural concern:

> "It's very suspicious that we have very small amount of features in the registry so far, we have so many nodes but 8 features that are mostly about some particular caveats of features according to the description. Seems it's very tough for you to generalize 'feature' level from the implementation. [...] we need to generate characteristics of the system, and use these characteristics to then generate features at the scanner time. From my point of view currently we could not really formulate the scope of feature, the intent of features, their interconnections, considerations, etc."

The diagnosis is sharp. The rev-2 features:

| Feature | Actual user-observable capability | What the registry says today |
|---|---|---|
| F-001 Detail-page view tracking | Popular Entities Ranking (a sub-feature of Data Discovery) | Caveat: useEffect doubling bug |
| F-002 Term linking with permission gate | Data Glossary (sub: term-to-entity linkage) | Caveat: path-mismatch silently disables auth |
| F-003 Popular ranking exclude-from-search | Popular Entities Ranking | Caveat: filter inconsistency across 9 list paths |
| F-004 Markdown description storage | Data Discovery (sub: entity metadata) | Caveat: stored XSS surface |
| F-005 Downstream lineage traversal | Data Lineage | Caveat: NPE + no cycle guard |
| F-006 RBAC policy lifecycle | Governance / Authorization | Caveat: soft-delete orphan permissions |
| F-007 AlertManager webhook ingestion | Alerting (sub: AlertManager integration) | Caveat: ungated cross-tenant alert creation |
| F-008 Ingestion-replace destruction | S2S Ingestion | Caveat: silent metadata delete-on-absence |

Each "feature" is a SPECIFIC BUG/CAVEAT anchored to a code chain, not the user-observable platform pillar that USES that chain. The agent didn't have the gestalt — what does ODD exist to do, what are its primary capabilities at the operator-facing granularity — and therefore couldn't classify code chains correctly.

This is the **bottom-up-only failure mode**: without top-down anchoring, code-walks produce drift findings at the granularity of the drift, not the granularity of the user. Rev-2 principle 8 said features emerge from code-walks; rev 3 refines: features emerge from code-walks AND are anchored on a doc-derived pillar shape. The shape is upstream; the emergence is downstream.

Rev 3 adds **Layer 0 — system mission anchor** beneath the existing layers. A new subagent (`domain-extractor`) reads the live documentation + maintainer-curated vocabulary + (when doc coverage is insufficient) a maintainer-interview escape hatch, and emits `lineage/{repo}/system-mission.md` — a 8-12-pillar shape with mission statement, per-pillar capabilities + doc URLs + cross-pillar relationships, audiences, architectural pillars. Downstream layers consult Layer 0 to classify their findings at the right granularity.

The mechanism is introduced as **principle 9** below. The schema section "Layer 0 — system mission anchor (rev 3)" specifies the implementation surface. Every rev-2 win carries forward — Layer 0 is additive, not substitutive.

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

### Nine non-negotiable principles (5 from rev 1 + 3 from rev 2 + 1 from rev 3)

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

6. **(rev 2) Registry artefacts shard into a high-fidelity index + per-id detail files; reducers never load the full registry.** The current monoliths (`concepts.yaml`, `implicit-adrs.md`, `refactoring-scopes.md`, `doc-gaps.md`, `test-map.yaml`) split into `{artefact}/index.{md|yaml}` and `{artefact}/detail/{id}.{md|yaml}`. The index entry per ID is **multi-paragraph, not 1-line** — it carries the node_id anchor (file:line OR axis:slug), the discriminating behaviour/evidence sentence, severity, classification, surfaced_by sidecar list, and the cross-reference IDs that make the finding distinct. The detail file carries everything else (full evidence chain, related artefacts, fix sketch, maintainer notes). A reader (or the registry-search subagent) decides "same finding strengthened" vs "new finding" from the index alone; the detail is fetched only when strengthening. Reducer input per batch drops from ~700 KB monolithic reads to ~30-50 KB index-reads + ~10-30 KB of fetched details. Growth is sub-linear in batch count.

7. **(rev 2) A `registry-search` subagent owns index reads; reducers spawn it per query, not per batch.** Single-purpose, read-only (tools: `Read, Grep`). Input: the discriminating text from a fresh sidecar finding + an index path. Output: 0-5 candidate matches with their full index entries verbatim + a `verdict` line (`0 matches — create new` / `1 strong match — strengthen ID-X` / `N ambiguous — maintainer-triage`). The reducer reads the verdict + the verbatim excerpts and decides; it never holds the full index in its own context. **Vector store remains deferred** — the text-anchored registry-search subagent buys 1-2 orders of magnitude of additional growth headroom over the monolithic shape; the vector store is built when (a) any one index file crosses ~5 MB, OR (b) registry-search consistently returns >20 candidates per query, OR (c) cross-batch dedup quality drops measurably (surfaced by maintainer-triggered merge-fixups). LSN-016's "no vector store" line in APPROACH.md §9 is updated to reflect this two-stage deferral: structural blind-spots → registry-search subagent → vector store with full-text-search fallback. The deferral order is honoured strictly; the methodology never silently slips an embeddings dependency in before its scaling threshold is hit.

8. **(rev 2) Features emerge from code-walks; progress is measured against the fixed substrate, never against feature count.** *(Refined in rev 3 — principle 9 adds the top-down anchoring without changing the bottom-up emergence rule.)* The feature registry is append-only and grows per batch — each batch may discover new features OR extend existing features from a new entry-point angle (principle 3, "the same code visited many times", produces this naturally). **No batch is gated on "the feature catalog is complete."** Progress is reported along two dimensions, both with a fixed denominator (total substrate node count at substrate scan time, currently 395 for odd-platform):
   - `nodes_with_own_sidecar / total_substrate_nodes` — direct enrichment ratio
   - `nodes_touched_by_any_feature_flow / total_substrate_nodes` — effective coverage; a node counts as touched when it appears as a `contributing_node` in any feature-flow whose chain is complete AND probe-verified along ≥1 test-matrix axis

   Plus two informational metrics with NO denominator and NO completion target:
   - `features_discovered` (monotonic; grows per batch)
   - `features_with_≥1_cell_PROBED / features_discovered` (quality signal for what's been discovered)

   A node that never appears in any feature-flow after the platform reaches high coverage is itself a finding — either dead code (REFACTOR-NNN candidate) or evidence that the substrate's entry-point class set is incomplete (substrate-axis-gap LSN candidate). Coverage closes from two directions (bottom-up sidecars + top-down feature-flow traversals); the fixed denominator means "100%" is a well-defined target whose semantics do not shift as the feature catalog evolves.

9. **(rev 3) Features emerge bottom-up FROM CODE but are classified top-down BY PILLAR.** A new Layer 0 — system mission anchor — runs ONCE per substrate scan (not per batch). The `domain-extractor` subagent reads the project's canonical documentation source (`../documentation/docs/**` for ODD; the equivalent for any other project) + the maintainer-curated concepts catalog + (when needed) maintainer-supplied framing, and emits `lineage/{repo}/system-mission.md` — a doc-anchored 8-12-pillar description of the platform's mission and primary user-observable capabilities at the operator-facing granularity.

   Downstream layers (especially `feature-flow-builder`) **consult `system-mission.md` BEFORE classifying any code chain as a feature**. The rev-2 emergent registry stays — features still emerge from code-walks per principle 8 — but with three classification rules layered on top:
   - **Pillar-anchored emergence** — every new feature_id MUST belong to a pillar from `system-mission.md`. The feature_id namespace is two-tiered: `P-01:F-001` (Data Discovery → Detail-page view tracking) rather than the flat `F-001`. Cross-pillar relationships from `system-mission.md` define which feature interactions are normal vs which are integration boundaries worth probing.
   - **Bug-shaped findings become drift facets, NOT features** — the rev-2 bug-anchored shape (F-001 = "Detail-page view tracking with +2 doubling bug") is wrong. The correct shape: the user-observable capability is "Popular Entities Ranking" (a sub-feature of Data Discovery); the doubling bug is a `drift_class: ui_amplification` facet inside `observed_vs_expected.facets`. The feature itself is anchored on the doc-side language; the drift is the code-vs-doc gap.
   - **Pillar-without-implementation OR implementation-without-pillar are both findings** — bidirectional drift. The doc surfaces 11 pillars; if code-walks reach exhaustion and only 9 are populated, the missing 2 are a doc-side overpromise (DOC-GAP class). Conversely, if code-walks surface a coherent user-observable cluster that has no doc-side home, it's `canonical_candidate: true` in `system-mission.md` for maintainer review.

   **What this preserves** — every rev-2 win (entry-point traversal, code-is-truth, emergent registry, sharded artefacts, registry-search dedup, substrate-fixed denominator). Layer 0 is additive. The agent's gestalt about the platform is upstream of the code-walk; the code-walk remains the truth source for HOW the platform behaves.

   **What this corrects** — the bottom-up-only failure mode that produced bug-pin features at batch I. With Layer 0, F-001..F-008 get re-classified: each becomes a `drift_class` facet inside a pillar-anchored feature (F-001 → Data Discovery's Popular Entities Ranking feature's `ui_amplification` facet; F-006 → Governance's Role-Based Access Control feature's `permission_persistence_after_soft_delete` facet; etc.).

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

#### Layer 0 — system mission anchor (rev 3)

A new artefact at `lineage/{repo}/system-mission.md` produced by a new subagent (`domain-extractor`). One artefact per project, refreshed when (a) substrate is re-scanned, (b) the project's documentation IA changes substantively, or (c) the maintainer hand-edits the `## Maintainer notes` block.

**Structure** (full schema in `.claude/agents/domain-extractor.md`):
- Mission statement (1-2 paragraphs)
- 8-12 primary feature pillars; per pillar: one-line capability, primary user actions, data entities operated on, doc-side narrative (verbatim from live page or local source-of-truth markdown), doc URL + verification status, cross-pillar relationships, sub-feature seed list, audiences served, confidence
- Audiences (6-10 tags)
- Architectural pillars (orthogonal to feature pillars; UI, REST API, S2S, scheduled jobs, etc.)
- Canonicalisation candidates (pillars where docs are thin OR code signal contradicts docs)
- Cross-pillar relationships graph
- Sources block with per-URL verification status
- Confidence per pillar
- Maintainer notes (preserved across refreshes)

**Pillar discipline** — 8-12 total. A pillar qualifies when (a) marketing/landing narrative names it as primary, (b) docs have a top-level section for it, (c) operator can describe in one sentence, (d) multiple sub-features compose under it. Architecture concerns, single-mutation surfaces, substrate axes don't qualify.

**Doc-source contract** — live URLs are gold; local `../documentation/docs/**` markdown is acceptable substitute when WebFetch is denied (with explicit `confidence: MEDIUM (local-anchored; live verification pending)`); pretraining is NEVER acceptable. Same discipline as Rule 1 (live URLs only for documentation).

**Maintainer-interview escape hatch** — if a pillar shows clear code-side signal but no doc-side narrative, `domain-extractor` surfaces it as `canonical_candidate: true` with a maintainer-question; never invents pillars from code alone.

#### A new subagent: `domain-extractor` (rev 3)

System prompt at `.claude/agents/domain-extractor.md`. Tools: `Read, Grep, Glob, WebFetch, Write`. Single-purpose; runs once per substrate scan.

Input contract (passed by the maintainer / orchestrator):

```
PROJECT_REPO: <e.g. odd-platform>
DOCS_SITE_BASE_URL: <e.g. https://docs.opendatadiscovery.org/>
PRIMARY_DOC_SOURCE: <live URL OR local source-of-truth markdown directory>
CANONICAL_CONCEPTS_PAGE: <URL or local path>
MAINTAINER_CONCEPTS_FILE: <optional — workspace-relative path to concepts catalog>
EXISTING_SIDECARS_DIR: <optional — used for code-side cross-check>
OUTPUT_PATH: <e.g. lineage/{repo}/system-mission.md>
```

**Safety rules:**
- Tool surface includes `Write` BUT writes ONLY to OUTPUT_PATH (single path; never modifies source repos or other workspace files).
- Single-pass write per Rule 8 — composes full content in own context, validates against schema, Writes once.
- If WebFetch is denied AND no local doc source is provided → STOP with explicit error. Layer 0 cannot run without canonical doc access (whether live or local-canonical-markdown).
- Pillar count must land in [8, 12] OR STOP and surface to maintainer.

#### Reducer-side changes for Layer 0 (rev 3)

Every downstream reducer's prompt gains a "consult `system-mission.md` for classification" rule. The largest changes are in `feature-flow-builder`:

- Reads `system-mission.md` BEFORE producing/updating any feature.
- For each emerging code chain:
  - **Map to a pillar**: classify into one of the 8-12 pillars (or surface as canonical_candidate if none fits).
  - **Mint feature_id within the pillar's namespace**: `P-NN:F-NNN` two-tier IDs.
  - **Bug-shaped findings become drift facets**, not standalone features. Each existing `F-NNN` from rev-2 gets re-classified as `P-NN:F-MMM` where the bug becomes a `drift_class` facet inside `observed_vs_expected.facets`.
  - **Cross-pillar interactions** surface as relationship-edges on `system-mission.md`, NOT as separate features.

Other reducers (concept-merger, doc-gap-finder, test-coverage-mapper, adr-archaeologist) get lighter touches — they consult `system-mission.md` to anchor naming, severity weighting, and integration-test gap classification (cross-pillar = integration; within-pillar = unit). Full prompt updates land in the slice-10 implementation.

#### Registry sharding (rev 2)

Each cross-file reducer artefact splits into an **index** + a **per-id detail set**:

| Artefact | Index (after split) | Detail (after split) |
|---|---|---|
| `concepts.yaml` | `concepts/index.yaml` — concept_id + canonical_name + audiences + security_aggregate + performance_aggregate + 1-paragraph discriminating context + cross-reference IDs | `concepts/detail/{concept-slug}.yaml` — contributing_files, full aggregates, canonicalisation candidates, maintainer notes |
| `implicit-adrs.md` | `implicit-adrs/index.md` — ADR-CANDIDATE-NNN + 1-paragraph headline + classification (promote / extend-existing / drift / unique-load-bearing) + severity + surfaced_by sidecar list | `implicit-adrs/detail/ADR-CANDIDATE-NNN.md` — Nygard wisdom-test outcomes, full evidence chain, severity rationale, related ADRs |
| `refactoring-scopes.md` | `refactoring-scopes/index.md` — REFACTOR-NNN + 1-paragraph headline + severity + category + surfaced_by sidecar list + cross-reference IDs (TEST-GAP-NNN, DOC-GAP-NNN, related REFACTOR-NNN) | `refactoring-scopes/detail/REFACTOR-NNN.md` — full file:line evidence, fix sketch, related-artefact chain, maintainer notes |
| `doc-gaps.md` | `doc-gaps/index.md` — DOC-GAP-NNN + 1-paragraph headline + category (broken-url / drift / missing-page / coverage-gap / stale-page / feature-control-gap / meta) + severity + live-URL verification status | `doc-gaps/detail/DOC-GAP-NNN.md` — before/after wording proposal, full live-page excerpt, related concepts, related refactors |
| `test-map.yaml` | `test-map/index.yaml` — TEST-GAP-NNN + 1-paragraph behaviour + criticality + test_class + feature_id (if known) + node_id anchor | `test-map/detail/TEST-GAP-NNN.yaml` — proposed test files, related refactors, related doc gaps, criticality justification |

`feature-flows.yaml` shards via the same pattern from day 1 — `feature-flows/{index.yaml, detail/{F-NNN}.yaml}`. The original draft of this ADR proposed "wait until 250 KB" for feature-flows; that threshold was dropped during the same-day maintainer review (2026-05-19) — uniformity across artefacts beats size-gated migrations. All five reducer artefacts now share the same sharded shape; reducer prompts reference sharded paths consistently. The 5 maintainer-curated features F-001..F-005 from slice-2 of `dynamic-verification-layer.md` were converted at slice-9 commit time.

**The 1-paragraph headline in the index is the discriminating field.** Strict rule: every headline contains at least the node_id anchor (file:line OR axis:slug), the discriminating behaviour or evidence sentence, the cross-reference IDs that make the finding distinct, and the severity / classification label. Headlines are written by the reducer at finding-creation and are stable across re-reads. A 1-line headline is rejected by the reducer's self-check; the minimum is one paragraph (~3-5 sentences) with enough surface area that a dedup decision is robust against paraphrasing.

#### A new subagent: `registry-search` (rev 2)

System prompt at `.claude/agents/registry-search.md`. Single-purpose, read-only. Tools: `Read, Grep`.

**Input contract** (passed by the spawning reducer):
- `query_text`: the discriminating text from a fresh finding (the sidecar's `bugs_limitations_corner_cases[N]` entry, or `implicit_adrs[N]` line, or `tests_coverage_semantic.uncovered_behaviours[N]`, etc.)
- `index_path`: the registry index file to search (e.g., `lineage/odd-platform/refactoring-scopes/index.md`)
- `max_candidates`: integer, default 5

**Output contract** (returned to the spawning reducer):
- One YAML block per candidate (up to `max_candidates`):
  - `candidate_id`: e.g., REFACTOR-073 / TEST-GAP-256 / DOC-GAP-085 / ADR-CANDIDATE-015
  - `match_confidence`: HIGH | MEDIUM | LOW
  - `match_basis`: one of `shares-node_id-anchor` / `shares-evidence-file:line` / `shares-discriminating-behaviour-wording` / `shares-cross-reference-IDs` / `shares-category-+-severity-+-axis`
  - `index_entry_excerpt`: the full multi-paragraph index headline verbatim (no summarisation — the reducer reads verbatim and decides)
  - `recommended_action`: `strengthen-existing` | `create-new` | `maintainer-triage-ambiguous`
- Final `verdict` line: `0 matches — create new` OR `1 strong match — strengthen ID-X` OR `N ambiguous matches — flag for maintainer`.

**Safety rules:**
- Tool surface is read-only (`Read, Grep`); the subagent cannot write.
- The subagent never reasons about whether a match is "valid" beyond textual evidence — it surfaces candidates with `match_basis`; the spawning reducer owns the strengthen-vs-new decision.
- `match_confidence` is anchored on textual overlap (file:line citation reuse, exact phrase reuse, shared cross-reference IDs) — never on semantic similarity (no embeddings, no model-based scoring — that's the deferred vector-store work).
- If the index file does not exist or is empty, return `0 matches — create new`.

**Reducer-side change pattern.** Each of the five reducer subagents (`concept-merger`, `adr-archaeologist`, `doc-gap-finder`, `test-coverage-mapper`, `feature-flow-builder`) updates its system prompt to: (1) iterate the new sidecars' findings, (2) spawn `registry-search` per finding, (3) read the candidate excerpts + verdict, (4) decide strengthen vs new, (5) on strengthen → read `{artefact}/detail/{id}`, append, write back; on new → write a fresh detail file, append a headline to the index. Per-batch reducer context: ~50-150 KB regardless of registry size. Compare against rev-1's ~200-800 KB monolithic-input shape.

#### Progress denominator + emergent feature registry (rev 2)

Coverage reports surface at three artefact locations:

- **`state/PROGRESS.md`** (workspace-level): two-dimension coverage table + two informational metrics + a "features discovered this batch" delta. No single-percentage summary; the two dimensions are reported side-by-side.
- **`lineage/{repo}/manifest.yaml`**: gains a `coverage_metrics:` block with `nodes_with_own_sidecar`, `nodes_touched_by_any_feature_flow`, `features_discovered`, `features_with_>=1_cell_PROBED`, `features_with_full_4_cell_matrix_PROBED`, all integers; `total_substrate_nodes` sits in the same block as the fixed denominator.
- **`lineage/{repo}/feature-flows/index.yaml`** (after slice-9 sharding): append-only — each batch commits a discovery delta: `new_features: [F-NNN, ...]`, `extended_features: [F-NNN: <which entry-point added>, ...]`, `merged_features: [F-NNN absorbed-by F-MMM]`. The merge case is maintainer-triggered, not automatic — feature-flow-builder surfaces merge *candidates* when two features share >50% of `contributing_nodes`, and the maintainer triages.

The methodology never gates on "we know all the features." It gates on the substrate denominator. Reaching 100% of `nodes_touched_by_any_feature_flow / total_substrate_nodes` is the operational completion milestone; the feature registry's size at that point is a downstream measurement (the platform genuinely has N features), not a target the methodology aims for.

### Workflow — the new cycle

The cycle from `agentic-code-ontology.md` revision 3 (substrate → enrich → reduce → probe → commit) extends with two new steps:

```
substrate scan                   → nodes.jsonl + edges.jsonl + rollups
domain-extractor (Layer 0)       → lineage/{repo}/system-mission.md
                                   (rev 3 — once per substrate scan; doc-anchored pillar shape)
enrich --batch <entry-points>    → 5 sidecars (1 session) — entry-point-anchored
                                   sidecars record upstream_callers + downstream_side_effects + test_class
reduce concept-merger            → concepts/{index,detail}/ refresh
                                   (rev 2 — sharded; reducer spawns registry-search per new finding)
reduce adr-archaeologist         → implicit-adrs/{index,detail}/ + refactoring-scopes/{index,detail}/ refresh
                                   (rev 2 — sharded; registry-search per query)
reduce doc-gap-finder            → doc-gaps/{index,detail}/ refresh (feature-control-gap class included)
                                   (rev 2 — sharded; registry-search per query)
reduce test-coverage-mapper      → test-map/{index,detail}/ refresh (keyed by feature × test_class matrix)
                                   (rev 2 — sharded; registry-search per query)
reduce feature-flow-builder      → feature-flows.yaml (or feature-flows/{index,detail}/ after slice-9)
                                   refresh + emit batch-discovery delta (new_features / extended_features / merge_candidates)
                                   (rev 2 — emergent registry; never gated on prior catalog completeness)
probe Type-7 (user-observable)   → live-demo verification of feature invariants
                                   (dynamic-verification-layer.md slice-2+ feeds measured truth back into observed_vs_expected)
update manifest coverage_metrics → 2-dimension progress against fixed total_substrate_nodes
                                   (rev 2)
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

**Registry sharding migration (rev 2).** A one-time conversion script splits each of the five monoliths into `{artefact}/index + {artefact}/detail/{id}`. The split is mechanical — the existing artefacts are already structured as numbered entries with stable IDs:

1. Parse the monolith → list of `(id, headline, full_entry)` tuples.
2. Write `{artefact}/index` with one headline per ID (the existing entry header + the existing 1-paragraph context; reducers tighten the headlines on subsequent refreshes if too short to dedup against).
3. Write `{artefact}/detail/{id}` per entry (full content from the monolith).
4. Update each reducer subagent's system prompt to: (a) spawn `registry-search` for dedup; (b) read at most 1-3 detail files when strengthening; (c) write to both the index (append new headline) and the detail (new file). Reducer prompts grow by ~30-50 lines each.
5. Keep the legacy monolith file present for ONE batch as a regression check — the maintainer diff-checks sharded output against monolith output. After parity verified, delete the monolith.

The script runs once per repo (currently odd-platform; future repos at their own pace). The migration is non-destructive — sharded outputs remain human-readable; the index file becomes the primary triage surface and per-id detail files open on demand. concepts.yaml is the highest-cost migration (largest file, most leverage); test-map.yaml is the second-largest. doc-gaps.md / implicit-adrs.md / refactoring-scopes.md follow in any order.

**Emergent feature-registry migration (rev 2).** Less migration work — `feature-flows.yaml` is brand-new (slice-2 of `dynamic-verification-layer.md` created it); today it carries F-001 through F-005 manually curated by the maintainer. From batch H onward, `feature-flow-builder` grows it append-only. The five existing features stay; each gains an optional `discovered_in_batch: <batch_id>` marker (post-hoc filled with `2026-05-19-dyn-verif-slice-2`). The artefact shards into `feature-flows/{index.yaml, detail/{F-NNN}.yaml}` from day 1 (slice 9) — same shape as the other four reducer artefacts; no size-gated migration.

## Consequences

### What this enables

1. **The view_count doubling bug is catchable BEFORE a user observes it.** The feature-flow-builder composes `(UI dispatch-multiplicity = 2) × (backend per-call delta = +1) = +2 per page-open` from the sidecar chain. The observed-vs-expected entry records the drift. The doc admonition writes itself from the matrix.

2. **The whole class of cross-layer bugs becomes catchable.** Every bug that emerges from "frontend assumes backend behaves X way; backend actually behaves Y way" — silent-200-on-missing-id, REPLACE-ALL-named-create, owned-vs-non-owned lineage semantics, term-linking side-channel via description, owner-auto-create permission bypass — gets a structured home as a feature-drift entry, not a buried single-sidecar finding.

3. **Tests have a per-feature matrix, not a per-file scatter.** A maintainer asking "is this feature tested?" gets a 4-cell answer (unit/integration/performance/security), not a paragraph of `uncovered_behaviours` scattered across multiple sidecars.

4. **Documentation becomes provably aligned to code.** Every doc statement about a feature is auditable against the feature-flow's observed_vs_expected. The "0% code↔doc gap" ambition from the maintainer's previous message has a measurable surface: count features whose docs match observed_vs_expected.

5. **Change requests can be scoped with second-order effects.** "If I fix the useEffect, what cells in the matrix flip?" The feature-flow entry lists contributing_nodes; the test_matrix lists what becomes pinned by each fix; the doc-gaps subsection lists what doc admonitions can be retired.

6. **(rev 2)** Reducer cost is bounded by the per-batch input, not by the registry size. Per-batch reducer-context drops from ~200-800 KB monolithic-input shape to ~50-150 KB index-fingerprint + fetched-detail shape. The methodology can run 100+ batches before any new scaling pressure surfaces; the vector-store deferral becomes a comfortable future option, not an emergency.

7. **(rev 2)** Coverage is provably reachable without enumerating every feature. The substrate-fixed denominator means "100% covered" is a well-defined target whose semantics do not shift as the feature catalog grows. A maintainer reports progress; the metric is monotonic AND has a hard ceiling (`total_substrate_nodes`, frozen at substrate scan).

8. **(rev 2)** Dead code becomes a structural finding, not a maintainer hunch. After the platform reaches high coverage on `nodes_touched_by_any_feature_flow`, the residual untouched-by-any-feature-flow nodes are either (a) substrate entry-point-class gaps (substrate-axis-gap LSN candidate) or (b) genuine dead code (REFACTOR-NNN candidate). Both classes get an automatic structural home; neither requires the maintainer to remember to look.

### What this costs

- **Schema migration.** Sidecars at v0.2.0 → v0.3.0. All existing 50 sidecars are valid under v0.2.0; re-enrichment to v0.3.0 happens incrementally on re-visits. No big-bang migration.
- **One new reducer subagent.** `.claude/agents/feature-flow-builder.md` — ~300-500 lines of system prompt. Standard reducer pattern; tooled identically to existing four reducers.
- **One new substrate axis.** `test_axis` — classifies test files by content (`@WebFluxTest` / mocks / benchmark / auth-matrix). Implemented as a tree-sitter + content-grep classifier; ~100 lines of extractor code.
- **A new probe class.** Type-7 user-observable invariants. Per-probe authoring cost is low (one sentence + one live curl); per-probe value is high (each probe fails today against batch-G findings, locking in regression prevention as fixes ship).
- **A new playbook.** `playbooks/entry-point-traversal.md` — protocol for the outside-in walk. Roughly 100-200 lines of PROTOCOL-shape content.
- **(rev 2)** One-time migration of the four big monoliths (concepts / implicit-adrs / refactoring-scopes / doc-gaps / test-map) to the sharded shape. Mechanical conversion script + 5 reducer prompt updates. Slice-by-slice rollout; concepts.yaml is the highest-cost migration (largest file); the others are smaller. Total migration effort: 2-3 batches' worth of slice work.
- **(rev 2)** One new subagent (`registry-search`). Single-purpose, read-only, ~150-250 lines of system prompt. Spawned by every reducer per query; the subagent's context starts fresh per query and never accumulates state across batches.
- **(rev 2)** Coverage-report shape changes from a single percentage to a two-dimension table + two informational metrics. `state/PROGRESS.md` and `/status` skill output update accordingly (~20-30 lines of skill-prompt change). One extra concept for maintainer-facing communication: the two-dimension framing replaces a single-percentage habit.

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
| **(rev 2)** `registry-search` returns false negatives (a fresh finding that SHOULD strengthen an existing entry gets classified as new — duplicate created) | Multi-paragraph index headlines maximise textual-overlap detection (file:line anchors, exact phrase reuse, cross-reference IDs are all in the headline). `match_basis` is reported per candidate so the reducer can audit. The false-negative rate is empirically measured (count of merge-fixups triggered by maintainer triage); if it rises, expand the search subagent's grep heuristics first (concept_id reverse-lookup, severity-anchored neighbour search, axis-anchored filter), then reach for the vector store. |
| **(rev 2)** `registry-search` hits its own context ceiling (an index file grows too large for the subagent to hold) | Index files carry headline-only content; at multi-paragraph-per-entry, ~30-50 KB at 100 entries scales to ~3-5 MB at 10,000 entries. The 5 MB-per-artefact threshold triggers vector-store work (slice deferred; documented in APPROACH.md §9). At current growth rates, this is 2+ years away for any single ODD artefact. |
| **(rev 2)** Emergent-feature registry never converges (every batch adds new features without consolidating) | The `merge_features` operation (one feature absorbs another when a later traversal shows they're the same user-observable contract from different entry points) is a maintainer-triggered triage, not an automatic reducer action. Merge candidates are surfaced by `feature-flow-builder` when two features share >50% of `contributing_nodes`; the maintainer decides. The registry's growth is bounded by the substrate's real feature count (which is finite for any given substrate commit), not by mechanical reducer behaviour. |
| **(rev 2)** Reducer prompts get bloated with the new spawn-search + read-detail logic | The new logic is encapsulated in a shared playbook (`playbooks/registry-search-spawn.md`) that all five reducer prompts reference rather than inlining. Per-reducer prompt grows by ~30-50 lines; the playbook absorbs the rest. |
| **(rev 2)** Substrate-fixed denominator becomes misleading if the substrate is re-scanned (denominator changes) | Manifest records `substrate_scan_commit` alongside `total_substrate_nodes`. When substrate is re-scanned, the manifest captures the new denominator + a `previous_denominator` field for one-batch continuity, and the `coverage_metrics` block is recomputed from the new substrate. Re-scans are rare (substrate extractor version bumps) and explicit. The fixed-denominator promise holds within a substrate-version window. |

## Related

- LSN-017 — the trigger incident retrospective (view_count doubling miss; rev-1 anchor)
- LSN-016 — heuristic-substrate-no-semantic-content (the prior pivot one layer below). **Rev-2 note:** LSN-016 anchors the original "no vector store / no embeddings" rule; rev 2's `registry-search` subagent honours that line by remaining text-anchored only. The vector store stays explicitly deferred until index size or candidate-set-size thresholds force it. APPROACH.md §9 documents the deferral.
- agentic-code-ontology.md revision 3 — the layer this ADR extends
- code-lineage-substrate.md revision 3 — the structural seed (provides the `total_substrate_nodes` denominator)
- **dynamic-verification-layer.md** — the layer-5 measured-truth feedback loop that consumes `feature-flow.observed_vs_expected` and writes measured values back. Rev-2 progress metric `features_with_≥1_cell_PROBED` is populated from that ADR's slice-2+ output.
- APPROACH.md rev 2 — portability surface; gains rev-2 paragraphs on registry sharding + emergent feature registry + the two-stage scalability path (registry-search now, vector store later) alongside the rev-1 entry-point + 4-class additions. **Rev 3 adds §13 — System mission anchor** as a universal section describing Layer 0's role and the `domain-extractor` agent.
- **`.claude/agents/domain-extractor.md`** (rev 3 — NEW) — the Layer 0 subagent's system prompt; doc-anchored pillar extraction with the full output schema for `system-mission.md`.

## Open questions deliberately not addressed in this ADR

None. Rev 1's choices are anchored in LSN-017 + the live demo probe + the existing layered ADR pattern from `agentic-code-ontology.md`. Rev 2's choices are anchored in the 8-batch empirical evidence of reducer context growth + the maintainer's correction of the rev-1 1-line-index strawman + the maintainer's correction of the pre-enumerated-feature-catalog implication. Rev 3's choices are anchored in the batch-I post-deployment observation that 8 features against 60 sidecars were ALL bug-anchored caveats rather than pillar-anchored capabilities + the maintainer's diagnosis that the agent lacked the platform's gestalt + the doc-source contract honoured by the file-analyser (live URLs only, no pretraining) extended to the upstream pillar shape. Schema details, the `domain-extractor` system prompt, the F-001..F-008 re-classification, the pillar-namespace `P-NN:F-NNN` scheme, the local-docs fallback contract, and per-project extractor adjustments are all implementation-slice deferrals — they implement this ADR's decisions, they do not require fresh decisions.

If a slice during implementation surfaces a contradiction with this ADR, the slice triggers a revision-3 of this ADR (not a new ADR) per the established pattern.

## Implementation slices

1. **Slice 1 — methodology surface** (this batch): ADR + LSN-017 + APPROACH.md rev 2 + file-analyser system-prompt update (v0.2.0 → v0.3.0 schema, entry-point principle, references-as-placeholders) + feature-flow-builder system-prompt skeleton.

2. **Slice 2 — first experiment**: Run one entry-point traversal end-to-end (UI `/dataentities/{id}/overview` mount). Produce feature-flow-builder's first feature entry F-001 (view_count loop). Run the live Type-7 probe. Verify the predicted +2 delta. Promote the result to the maintainer.

3. **Slice 3 — test_axis substrate** + test-coverage-mapper rev to produce per-feature matrix. Re-key TEST-GAP entries by feature_id where applicable. doc-gap-finder gains feature-control-gap class.

4. **Slice 4 — Type-7 probe set seed**: Maintainer authors 5-10 user-observable invariants spanning the batch-G findings (term-linking 403, description Markdown round-trip, view_count single-increment, popular EXCLUDE_FROM_SEARCH, getMyObjects empty-Flux). Live-run each against demo. Cross-reference results to existing feature-flows.

5. **Slice 5 — entry-point traversal playbook** + skill (`/feature-walk-build`) + multi-session resumption shape (manifest gains `last_entry_point_traversal_commit`).

6. **Slice 6 (rev 2) — Registry sharding migration**: Mechanical split of the five monoliths (concepts / implicit-adrs / refactoring-scopes / doc-gaps / test-map) into `{artefact}/index + {artefact}/detail/{id}`. Conversion script in `lineage/_extractor/registry-shard/`. Verify with a one-batch diff (sharded reducer output vs prior monolith) before retiring the legacy file. Order: `concepts.yaml` first (largest, most leverage); `test-map.yaml` second; doc-gaps / implicit-adrs / refactoring-scopes in any order.

7. **Slice 7 (rev 2) — `registry-search` subagent + reducer prompt updates**: System prompt at `.claude/agents/registry-search.md`. Shared playbook at `playbooks/registry-search-spawn.md`. Update all five reducer prompts to spawn `registry-search` per query. Validate on one batch: per-reducer wall-clock + input-token measurement before vs after. Target: ≥50% input-token reduction per reducer relative to monolithic baseline.

8. **Slice 8 (rev 2) — coverage-metrics on manifest + state/PROGRESS.md update**: Manifest gains `coverage_metrics:` block with the two dimensions and the two informational metrics. `/status` and `/coverage` skills updated to surface the two-dimension table. `state/PROGRESS.md` template updated. No single-percentage summary anywhere.

9. **Slice 9 (rev 2) — emergent feature-registry shape**: `feature-flow-builder` reducer (slice 3 above) extended to feed the append-only registry with `new_features` / `extended_features` / `merge_candidates` deltas per batch. `feature-flows.yaml` shards into `feature-flows/{index,detail}/` from day 1 — same shape as the other four reducer artefacts; the original draft's "wait until 250 KB" threshold was dropped at maintainer review 2026-05-19 (uniformity > size-gated migration). Merge-candidate triage is maintainer-triggered; merge action is recorded as `merged_features` in the next batch's delta.

10. **Slice 10 (rev 3) — Layer 0 system mission anchor**: New subagent `.claude/agents/domain-extractor.md` (Layer 0; doc-anchored pillar shape). New artefact `lineage/{repo}/system-mission.md`. `feature-flow-builder` updated to consult Layer 0 BEFORE classifying any code chain; bug-shaped findings re-classified as `drift_class` facets inside pillar-anchored features (the F-001..F-008 from rev-2 deployment get re-classified in this slice). Other reducer prompts (concept-merger, doc-gap-finder, test-coverage-mapper, adr-archaeologist) gain lightweight "consult system-mission.md" rules. APPROACH.md §13 documents Layer 0 as universal — every project bootstrapping the methodology runs `domain-extractor` first; the pillar shape is the gestalt every downstream layer assumes.

Slices 2 onward are deferred to subsequent batches. Slices 6-9 (rev 2) can be parallelised across maintainer sessions where they don't share files: 6 + 7 must sequence (sharded artefacts before reducers consume the sharded shape); 8 + 9 can run in parallel with each other and after 6+7 land. Slice 1 is this batch.
