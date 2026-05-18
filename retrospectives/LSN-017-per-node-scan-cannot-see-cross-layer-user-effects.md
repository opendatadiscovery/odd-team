---
id: LSN-017
title: Per-node code-anchored scan cannot see cross-layer user-observable effects
date: 2026-05-19
domain: workspace-meta (cross-pillar — applies to the entire agentic-ontology methodology)
severity: high
gates_informed:
  - feedback_entry_points_not_files.md (auto-memory — the rule that emerged)
  - feedback_code_is_truth_docs_are_audit_target.md (auto-memory)
  - adrs/drafts/feature-anchored-ontology.md (the layered-ADR that resolves the miss)
  - APPROACH.md rev2 (portability surface gains the entry-point principle + feature-flow layer)
related_lsn:
  - LSN-016 (heuristic-substrate-no-semantic-content — direct ancestor: structural blind-spots)
status: closed
---

# LSN-017: Per-node code-anchored scan cannot see cross-layer user-observable effects

## What happened

On 2026-05-19, after seven batches of agentic-ontology enrichment (50/395 sidecars; concepts.yaml v8; 67 ADR candidates; 211 refactoring scopes; 312 test gaps; 103 doc gaps), the maintainer ran a live empirical probe against `demo.oddp.io` on data entity 497:

> "could you check that view_count doubles each time we open details for a data entity?"

The probe was prompted by a behaviour the maintainer had observed in the UI but which the ontology — already rich in batch-G findings about view_count (REFACTOR-201 inflation surface, REFACTOR-220 closing the producer↔consumer loop, REFACTOR-221 no-index, TEST-GAP-256/259/309/310 four-class regression candidates) — had nowhere catalogued.

The empirical sequence:

1. **5 sequential `GET /api/dataentities/497` calls.** Each increment to `data_entity.view_count` was exactly **+1** per call. The backend's documented per-call delta is confirmed.
2. **Probe of the UI route `/dataentities/497/overview`** (which serves the SPA HTML shell, 694 bytes). HTML route alone does NOT increment.
3. **Code-walk of `DataEntityDetails.tsx`** to find the actual UI behaviour on page-open. Located at `odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:56-64`:

```ts
useEffect(() => {
  dispatch(fetchDataEntityDetails({ dataEntityId }));
}, [
  dataEntityId,
  isDataEntityGroupUpdated,
  isDataEntityAddedToGroup,
  isDataEntityDeletedFromGroup,
  details.status?.status,   // ← derived from the fetch response
]);
```

The fifth dependency (`details.status?.status`) is itself produced by the fetch. The component flow on every page-open is therefore:

- Mount → `details.status?.status === undefined` → useEffect fires → API call #1 → view_count +1.
- API call #1 returns → redux store sets `details.status` → dependency-array value changes from `undefined` to `STABLE` (or whichever lifecycle status) → useEffect re-fires → API call #2 → view_count +1.
- API call #2 returns with identical `details.status?.status` → useEffect quiesces.

**Net effect: every user-visible page-open of a data-entity detail page registers as +2 in view_count.** Combined with the prior batch-G findings (no rate-limit, no index, `view_count DESC` ranking on `getPopular`), the platform's home-page Popular strip is exactly twice as cheap to inflate as the ontology — going into the probe — assumed.

The ontology was silent on this. None of the seven prior batches produced any artefact (sidecar / concept / ADR-candidate / refactoring-scope / doc-gap / test-gap) that named "opening the detail page registers as two views" as a fact. The closest neighbours:

- `getDataEntityDetails.md` (batch F): per-call +1 increment. **Backend-side, correct, complete.**
- `getPopular.md` (batch G): consumer of view_count DESC; ranking trivially inflatable. **Backend-side, correct, complete.**
- TEST-GAP-256 (batch F): "no test asserts UPDATE happens exactly once per call". **Backend-anchored; assumes +1 per call.**
- TEST-GAP-309 (batch G): "scripted detail-reads pump the entity to top of /popular". **Backend-anchored; assumes the cost basis is N API calls.**

None of these said: **two API calls fire per user page-open.** That fact lives in the *composition* between the React useEffect dep-array and the backend's per-call delta. No single sidecar's authoring scope contained both ends, so the product was never computed.

## Why it slipped

Three structural causes, in increasing order of root-ness.

**1. The unit of analysis was wrong.** Per-node enrichment is the unit. A sidecar scopes to ONE substrate node + ≤1-hop neighbours. The backend sidecar for `getDataEntityDetails` correctly observed `+1 view_count per call`; the UI useEffect lives in a different node entirely (would have been enriched only on a future UI-axis sidecar pass — which didn't exist yet for that component). Even when both sidecars exist, the multiplier *between* them — UI-call-multiplicity × backend-per-call-delta — is not a property of either node. It only exists at the *user-observable boundary*. The methodology had no layer where that fact would land.

**2. The methodology took the wrong polarity on documentation.** The first attempt at a fix during the meta-conversation proposed "treat documented features as the input corpus from which feature-flows are extracted." The maintainer corrected: docs can be stale, inconsistent, or silent about behaviours the code has. **Code is truth; docs are the audit target, not the source.** The ontology cannot start from a docs-derived feature catalog because the feature catalog must itself be derivable from the code-walk, then *checked against* docs for drift. Anchoring on docs would have shipped a methodology that systematically missed any feature the docs failed to name — including (canonically) bugs that produce user-visible effects.

**3. The traversal was inside-out, not outside-in.** Sidecars start at a code node and look at the surrounding files. Users start at an entry point — clicking a button, opening a page, calling an API, watching a scheduled job's output — and observe the system's downstream effects. The two perspectives produce different ontologies. Inside-out (current) catalogues code surface; outside-in (the corrected approach) catalogues user-observable behaviour as a function of code surface. Cross-layer composition is invisible to the former and central to the latter.

## Rule that emerged

Five principles, codified in `adrs/drafts/feature-anchored-ontology.md` and folded into `APPROACH.md` rev 2:

1. **Code is the source of truth; documentation is the audit target.** Features emerge from code-walk, not from docs. Doc-gap-finder verifies code-anchored truth against published docs — flipping the prior implicit assumption.

2. **Entry points are the unit of analysis.** An entry point is a place where the system meets an external observer — UI route mount, UI button onClick, REST operation, scheduled job, webhook receiver, WAL listener, SDK builder, boot-time configuration evaluation. Each entry-point sidecar traces downstream effects through services / repositories / DB writes / activity emissions, recording user-observable consequences and call-graph references at every hop.

3. **The same code is visited many times — that is the structural justification for the ontology.** A `view_count` UPDATE is reached from the UI detail-page mount (×2 due to useEffect dep-array), from third-party API consumers (×1), from any future entry point yet to be enriched. The node's full meaning is the union of facts gathered across all entry-point traversals that touch it. References act as placeholders during traversal; later passes flesh them out.

4. **The feature-flow-builder reducer composes per-feature observable behaviour across entry-point sidecar chains.** Output is feature-level facts — multiplicity products, cross-layer drifts, side-effect cardinalities — that no single sidecar produces. The view_count doubling is the canonical case: only the cross-product of (UI dispatch-multiplicity = 2) × (backend per-call delta = +1) is the user-visible truth.

5. **Features are controlled by tests along four orthogonal axes: unit, integration, performance, security.** Per-feature test matrix records coverage by class. Empty cells = uncontrolled dimensions; the doubling bug lives in the empty integration cell for the detail-page-view-tracking feature. Test files are themselves classified as a substrate axis (`test_axis`) so the matrix can be populated automatically.

## Forcing question

The one question that, asked in advance, would have caught the miss:

> **"For this code I'm enriching, what is the user-observable behaviour that depends on it, and from which entry points is that behaviour triggered? What is the cardinality of those triggers?"**

The current sidecar asks "what does this code do" (local). The forcing question asks "what does opening / clicking / triggering produce at the user's screen" (composition). The two answers diverge wherever a cross-layer multiplier exists.

This is the forcing question Type-7 probes will operationalise: maintainer-authored user-observable invariants (e.g. "opening the detail page registers as one view") that the ontology must surface AND the live probe must confirm. A FAIL where ontology was silent is a methodology miss; a FAIL where ontology had flagged the drift is the methodology working.

## References

- File:line evidence
  - `odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:56-64` — the useEffect dep-array bug
  - `odd-platform-api/src/main/java/.../ReactiveDataEntityRepositoryImpl.java:173-180` — the +1 view_count UPDATE
  - `odd-platform-api/src/main/java/.../ReactiveDataEntityRepositoryImpl.java:633` — the `view_count DESC` sole-signal ranking in `listPopular`
  - `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md` — batch-F sidecar with per-call delta
  - `lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getPopular.md` — batch-G sidecar with consumer-side ranking
- Live probe evidence
  - 5 sequential GETs against `https://demo.oddp.io/api/dataentities/497` showed +1 per call
  - `/dataentities/497/overview` SPA HTML route alone does not increment
  - Per browser page-open: +2 (composition not in any sidecar)
- Related LSN entries
  - LSN-016 — heuristic substrate misses syntactic-variant code. LSN-017 is the agentic-layer analogue: agentic per-node enrichment misses cross-layer composition.
- Related playbooks (forthcoming)
  - `playbooks/entry-point-traversal.md` — protocol for walking from an entry point through services / repositories / DB writes, leaving references at unresolved hops.
  - `playbooks/feature-flow-composition.md` — protocol for composing per-feature observable behaviour across multiple entry-point chains.
- Related auto-memory (to be saved)
  - `feedback_entry_points_not_files` — sidecars scope to entry points, not file-by-file; the same code may be reached from many entry points, and that is the point.
  - `feedback_code_is_truth_docs_are_audit_target` — never derive feature catalog from docs; derive from code-walk and verify against docs.

## How this differs from LSN-016

LSN-016 caught a substrate-layer miss: heuristic tree-sitter produced syntactically-correct nodes with zero semantic content. The fix was layering an agentic semantic enrichment ON TOP.

LSN-017 catches the analogous miss one layer up: the agentic semantic enrichment produces per-node semantic content but misses cross-layer composition. The fix is layering a feature-anchored synthesis ON TOP of the per-node enrichment — composing per-feature observable behaviour from entry-point sidecar chains.

The pattern is monotonic: each layer ABOVE catches what the layer below cannot see. Substrate → enrichment → composition → user-observable-truth. Future LSNs may surface yet-higher layers (cross-feature interactions; emergent system behaviours across multiple features). The methodology accommodates that growth — it does not bake in a final layer count.

The forcing question generalises across layers: at every layer, ask "what is the observable consequence at the boundary above this layer?" Substrate's boundary is the enriched ontology. Enrichment's boundary is the feature catalog. Feature catalog's boundary is the user. Each layer's answer is built from below; each layer's *blind-spot* lives at its own boundary unless the next layer up exists.
