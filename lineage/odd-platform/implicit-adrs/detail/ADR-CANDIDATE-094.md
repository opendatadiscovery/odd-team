## ADR-CANDIDATE-094 — Lineage node click-through navigates to that node's own Lineage tab using `node.depth || 1` as the new traversal depth — depth-compounding-as-you-drill idiom

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (LineageGraph)
**Axes present**: ui_components, ui_routing
**Pillars affected**: [P-05] — Data Lineage

**Surfaced by**:
- `LineageGraph.md:implicit_adrs[4]` (|-
    "**Click-through preserves URL params bag and uses node.depth as new d** — clicking a node title navigates to `dataEntityLineagePath(entityId, lineageQueryString)` where `lineageQueryString` is built from `useQueryParams({...defaultLineageQuery, d: node.depth || 1})` (Node.tsx:49-52). The decision encodes: 'when you click into a node, the view that opens uses that node's depth as the new traversal depth' — i.e. the click compounds depth as you drill in.")

**Decision statement**: Clicking a graph node's title in the Lineage canvas navigates to `/dataentities/{clickedEntityId}/lineage?{queryString}`, where the queryString is built from the CURRENT view's `defaultLineageQuery` MERGED with `d: node.depth || 1` — i.e. the new view's traversal depth is set to the clicked node's depth in the rendered tree (Node.tsx:49-52).

For a node at depth 5 in the current canvas, clicking it opens a new view rooted at that node with `d=5` — compounding the recursive-CTE walk-depth on the backend. A user drilling through deep graphs accumulates depth at each click: root → click depth-3 node → click depth-5 node → click depth-7 node → backend walks at depth 7 for the third query.

The team rejected:
- **(a) Reset to depth=1 on each click** — would force the user to manually re-expand the new graph to a useful depth.
- **(b) Preserve the parent's `d` value** — would not match the visual context (the clicked node was at depth 5, so its lineage at depth 1 would feel underpowered).
- **(c) Open in same canvas (centred re-root)** — would lose URL-shareability and history navigation.

Consequences encoded:
- **(a) Depth grows with drill-depth** — affects backend recursive-CTE cost (REFACTOR-202 amplification per click).
- **(b) URL params bag preserved** — `fn`, `full`, `eag`, `t`, `exd[]`, `exu[]` carry forward; only `d` mutates.
- **(c) Click on root (depth=0) defaults to `d=1`** — `node.depth || 1` short-circuits the falsy root depth.
- **(d) originalGroupId indirection** — clicking on a node that was "expanded out of a group" navigates to the GROUP's lineage rather than the inner entity (Node.tsx:55-57).

**Wisdom test (3-question)**:
1. *Intentional?* YES — the explicit `d: node.depth || 1` override at Node.tsx:51 deliberately overwrites the parent view's `d` value with the child's depth; the maintainer chose the compounding pattern over the rejected alternatives.
2. *Structural impact?* YES — affects the click-through navigation contract; affects the backend recursive-CTE cost amplification surface; affects how operators perceive drill-down through deep lineage.
3. *Refactoring or structural?* STRUCTURAL — switching to a reset-to-1 or preserve-parent contract is a different navigation semantic.
→ ADR.

**Evidence**:
- LineageGraph.md says: "the explicit `d: node.depth || 1` override (Node.tsx:51) which deliberately overwrites the parent view's `d` value with the child's depth"
- intent_anchor: "the pattern says 'navigation depth tracks rendered depth — clicking into a node 5 hops out from root expands depth=5 around that new root'"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-091** (URL as source of truth) — the click-through mutates the URL.
- **ADR-CANDIDATE-092** (d3-hierarchy tree layout) — the `node.depth` comes from the tree builder.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-287 (NEW — `?d=10000` URL exploit: useQueryParams.ts:36 `parseNumbers: true` converts any integer; UI's depth `<AppSelect>` caps at 20 but URL accepts unbounded; combined with the depth-compounding click idiom, an attacker can drive recursive-CTE walks at attacker-controlled depths)

**Proposed action**: Promote to `adrs/drafts/lineage-click-through-depth-compounding.md`. Document:
- The `d: node.depth || 1` override contract.
- The depth-compounding-as-you-drill idiom.
- The URL params bag preservation (`fn`, `full`, `eag`, `t`, `exd[]`, `exu[]`).
- The root-node handling (`|| 1` short-circuit).
- The originalGroupId indirection.
- The backend cost trade-off: deep clicks compound the recursive-CTE walk; pair with a server-side upper-bound (REFACTOR-287) to defend against abuse.

**Severity rationale**: MEDIUM — pattern-shaping decision for the lineage navigation UX; specific to drilling-through behaviour; observable but feature-local.

**Suggested backlog grouping**: `UI architecture codification` + `Lineage subsystem hardening sprint`.

---
