## REFACTOR-290 — `crossEdges` silent drop when referenced node id is missing from `nodesById` — `nUp.find(node => node.data.id === edge.sourceId)` returns undefined, the guard skips the edge, no error log, no Sentry breadcrumb, no UI breadcrumb

**Severity**: MEDIUM
**Category**: missing-validation + observability
**Pillars affected**: [P-05] — Data Lineage
**Surfaced by**:
- `LineageGraph.md:bugs_limitations_corner_cases[2]` (|-
    "**No client-side dedupe of crossEdges that reference missing nodes** — `crossEdges` resolution (generateGraph.ts:81-95, 121-135) uses `nUp.find(node => node.data.id === edge.sourceId)`; if the cross-edge references an id that did NOT appear in `upstream.nodesById` (or was filtered before the tree builder ran), the `find()` returns `undefined`, the `if (sourceNode && targetNode)` guard skips the edge, and the cross-edge is SILENTLY DROPPED from the rendered set. No error log, no Sentry breadcrumb, no UI breadcrumb. A backend payload skew (nodesById/crossEdges out of sync) loses lineage information visibly to the operator but invisibly in any failure-reporting channel.")

**Description**: The lineage canvas resolves backend-supplied `crossEdges` against the materialised node lists (upstream + downstream) at `generateGraph.ts:81-95, 121-135`:
```ts
crossEdges.forEach(edge => {
  const sourceNode = nUp.find(node => node.data.id === edge.sourceId);
  const targetNode = nUp.find(node => node.data.id === edge.targetId);
  if (sourceNode && targetNode) {
    crossLinksUp.push({ source: sourceNode, target: targetNode });
  }
});
```

If a cross-edge references an id that did NOT appear in `nodesById` (e.g. the backend filtered the node but kept the edge; a payload-skew race window during ingestion; an explicit-id mismatch between two response sections), the `find()` returns `undefined`, the `if` guard skips, and the cross-edge is SILENTLY dropped.

The operator sees fewer cross-edges in the visualisation but has no way to know they're missing. No error log, no Sentry breadcrumb, no UI breadcrumb, no warning toast. The lineage information disappears invisibly.

For the platform's recursive-CTE + selectDistinct + per-stream filtering shape (per batch-I `LineageServiceImpl` sidecar), a backend regression that breaks the nodesById/crossEdges sync would surface as "lineage looks thinner today" with no diagnostic signal.

**Primary source citations**:
- `generateGraph.ts:81-95` — upstream cross-edge resolution
- `generateGraph.ts:121-135` — downstream cross-edge resolution
- `LineageGraph.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-092 codifies the cross-edge-as-separate-overlay model. The silent-drop is a sub-behaviour; no ADR prescribes the absence of observability.

**Proposed remedy**: Add a `console.warn` (dev) + Sentry/observability breadcrumb (production) when the `if (sourceNode && targetNode)` guard skips a cross-edge. The breadcrumb includes the missing id + the response payload size for diagnostic context.

For the structural defence: add a regression test (REFACTOR-289 unblocks this) that mounts the canvas with a synthetic crossEdge referencing a missing node + asserts a warning is emitted.

**Severity rationale**: MEDIUM — operator-invisible data loss with backend-payload-skew failure mode. Fix is straightforward observability addition.

**Suggested backlog grouping**: `Lineage subsystem observability sprint` + `UI test coverage bootstrap` (REFACTOR-289).

---
