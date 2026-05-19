## ADR-CANDIDATE-092 — Lineage canvas uses `d3-hierarchy` TREE layout (NOT a force-directed DAG renderer like `d3-force` / Cytoscape / react-flow); diamonds-as-duplicates and cross-edges-as-overlay are the consequence

**Severity**: HIGH
**Classification**: promote
**Support count**: 1 sidecar primary-source (LineageGraph)
**Axes present**: ui_components, ui_graph_rendering
**Pillars affected**: [P-05] — Data Lineage

**Surfaced by**:
- `LineageGraph.md:implicit_adrs[2]` (|-
    "**d3-hierarchy over force-directed graph** — the choice of `d3-hierarchy` `tree<T>()` layout (generateGraph.ts:1, 57, 97) over a force-directed graph (e.g. `d3-force`, Cytoscape, react-flow) is intentional and load-bearing. The tree layout gives deterministic node positions per render — same input → same SVG coordinates → predictable user experience as data grows. The cost: DAG shapes (diamonds) duplicate nodes (D in A→B→D + A→C→D renders twice — confirmed by reading generateGraph.ts:68-76, 108-116 where `hierarchy(parsedData.root, d => parsedData.upstream.edgesById[d.id]?.map(...))` recursively visits children from each node, with no visited-set check). The choice prioritises layout determinism over visual DAG faithfulness.")

**Decision statement**: The ODD Platform lineage canvas renders an entity's reachable subgraph using `d3-hierarchy`'s `tree<T>()` layout (`generateGraph.ts:57-66, 97-106`). The team rejected force-directed layouts (`d3-force`, Cytoscape, react-flow). The chosen approach has two structural consequences encoded into the renderer:
1. **Diamond DAG amplification** — when entity D is reachable from root R via multiple paths (R→B→D AND R→C→D), `d3-hierarchy.hierarchy(root, childAccessor)` builds a TREE topology and visits D once per path; D renders as TWO HierarchyPointNodes at distinct (x,y). React keys at `LineageGraph.tsx:91` use `${node.x}${node.y}` so the two instances are distinct DOM nodes. This amplifies REFACTOR-202 (backend-side diamond row duplication) into a visual realisation.
2. **Cross-edges as separate overlay** — edges that the backend marked as "would close a diamond / cycle if traversed by the tree builder" are returned in `crossEdges` and rendered as separate `<CrossLink>` components (`LineageGraph.tsx:69-83`), NOT participating in the tree layout. Cycle handling is HYBRID: backend `selectDistinct` deduplicates rows; frontend tree-builder + cross-edge overlay attempts to split the response into tree + non-tree edges.

The rationale: tree layouts give DETERMINISTIC node positions (same input → same SVG coordinates → predictable user experience as data grows). Force-directed layouts give visually-pleasing but non-deterministic positions that drift across re-renders. The team prioritised determinism over DAG faithfulness.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the deliberate `d3tree<TreeNodeDatum>().nodeSize([...]).separation(...)` builder + the separate `crossEdges` plumbing handling non-tree edges as a second class confirm the architectural commit.
2. *Structural impact?* YES — defines the visual contract of every Lineage tab; affects performance (O(N) per node + O(C×N) per cross-edge); affects how operators interpret diamond-shaped lineage (they see duplicates, not a single node).
3. *Refactoring or structural?* STRUCTURAL — switching to a force-directed or DAG-aware renderer is a different library + layout algorithm + rendering surface.
→ ADR.

**Evidence**:
- LineageGraph.md says: "`d3tree<TreeNodeDatum>().nodeSize([...]).separation(...)` builder (generateGraph.ts:57-66) + the separate `crossEdges` plumbing (generateGraph.ts:81-95, 121-135) that handles non-tree edges as a second class"
- intent_anchor: the structural separation — tree builder for one class of edges, cross-edge overlay for another
- LineageGraph.md says: "Backend-supplied `nodesById + edgesById + crossEdges` are SHAPED INTO A TREE at the UI by `d3-hierarchy`."

**Existing ADR**: composes with:
- **ADR-CANDIDATE-057** (single-query recursive-CTE lineage + progressive expansion) — the backend half supplies the data shape; this ADR is the UI's interpretation.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-202 (existing — recursive-CTE no cycle-detection) — UI realisation primary-source confirmed: diamonds amplify visually
- REFACTOR-288 (NEW — Diamond DAG amplification at the UI: d3-hierarchy.hierarchy() builds a TREE not a DAG; entity D reachable via two paths renders as TWO SVG nodes at distinct positions; no visited-set check)
- REFACTOR-290 (NEW — crossEdge silent drop when referenced node id is missing from `nodesById` — `nUp.find(node => node.data.id === edge.sourceId)` returns undefined, the `if (sourceNode && targetNode)` guard skips, no error log)

**Proposed action**: Promote to `adrs/drafts/d3-hierarchy-tree-not-dag-for-lineage-canvas.md`. Document:
- The d3-hierarchy choice over force-directed / Cytoscape / react-flow.
- The determinism rationale.
- The diamond-DAG-as-duplicates consequence (with a worked example).
- The cross-edge-as-separate-overlay model.
- The performance ceiling (O(N) per node + O(C×N) per cross-edge; no virtualisation; main-thread synchronous render).
- The migration path if the team ever adopts a DAG-aware renderer: how the cross-edge response shape changes, how the tree builder is replaced.

**Severity rationale**: HIGH — load-bearing architectural decision for Pillar P-05. The choice affects every operator's visual interpretation of lineage. A future maintainer attempting to "fix the duplicates" would need to understand the determinism trade-off.

**Cross-pillar bump**: P-05 single-pillar so no cross-pillar bump; HIGH already from load-bearing nature.

**Suggested backlog grouping**: `UI architecture codification` + `Lineage subsystem documentation sprint`.

---
