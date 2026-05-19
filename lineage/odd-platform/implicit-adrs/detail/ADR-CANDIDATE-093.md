## ADR-CANDIDATE-093 — Two-direction mirrored independent tree layouts at the lineage canvas — upstream tree at negative-x, downstream tree at positive-x, both rooted at the same entity — the visual centre-anchored idiom

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (LineageGraph)
**Axes present**: ui_components, ui_graph_rendering
**Pillars affected**: [P-05] — Data Lineage

**Surfaced by**:
- `LineageGraph.md:implicit_adrs[3]` (|-
    "**Two-direction independent layouts mirrored** — separate `d3tree` instances for upstream (generateGraph.ts:57-76) and downstream (generateGraph.ts:97-116), each rooted at the same `parsedData.root`. Upstream's x-coordinate is INVERTED via `-(width + mx)` (line 60) so the trees grow in opposite directions from the root. The mirroring is intentional: a single tree builder with directional edges would put all nodes on one side.")

**Decision statement**: The lineage canvas builds TWO independent `d3-hierarchy` tree instances rooted at the same entity:
- **Upstream tree** (`generateGraph.ts:57-76`) — child accessor is `upstream.edgesById[d.id]?.map(edge => nodesById[edge.sourceId])`; x-coordinate INVERTED via `-(nodeSize.size.width + nodeSize.size.mx)` (line 60) so the tree grows LEFTWARD from the root.
- **Downstream tree** (`generateGraph.ts:97-116`) — child accessor is `downstream.edgesById[d.id]?.map(edge => nodesById[edge.targetId])`; x-coordinate POSITIVE so the tree grows RIGHTWARD from the root.

The two trees share the SAME root node but render in mirrored layouts; the LineageGraph rendering at `LineageGraph.tsx:84-110` mounts both trees as siblings inside a single SVG, with the root entity visually centred. The sign flip at `generateGraph.ts:60` is the ONLY difference between the two tree configurations.

The team rejected:
- **(a) Single tree builder with directional edges** — would put all nodes on one side; the visual centre-anchored idiom requires the mirror.
- **(b) Two separate canvases (upstream + downstream)** — would require operators to mentally compose them; the single-canvas-with-centred-root presentation is more legible.
- **(c) Force-directed centred** — would not give the deterministic centre-anchoring.

Consequences encoded:
- **Visual centre-anchoring** — root entity is always at (0, 0); upstream nodes have negative x, downstream positive x.
- **Independent layouts** — upstream and downstream can have different depths, different branching factors, different x extents; neither constrains the other.
- **Pan/zoom integration** — `Zoom<SVGSVGElement>` (`HierarchyLineage.tsx:106-127`) operates on the combined SVG; initial transform centres the viewport on the root.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the explicit sign flip + the parallel tree builders + the single SVG with centred root are deliberate. The maintainer chose this idiom over the rejected alternatives.
2. *Structural impact?* YES — defines the visual presentation of the lineage feature; affects pan/zoom behaviour, the initial transform matrix, the canvas layout calculations.
3. *Refactoring or structural?* STRUCTURAL — switching to a different presentation idiom (e.g. up-down rather than left-right, or single-direction with arrows) requires a different layout algorithm.
→ ADR.

**Evidence**:
- LineageGraph.md says: "generateGraph.ts:57-76 (upstream) + 97-116 (downstream) + line 60 sign flip"
- intent_anchor: "the explicit sign flip at generateGraph.ts:60 (`-(nodeSize.size.width + nodeSize.size.mx)`) which is the only difference between treeUp and treeDown configuration"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-092** (d3-hierarchy tree, not DAG) — the layout algorithm.
- **ADR-CANDIDATE-091** (URL as source of truth) — the pan/zoom transform matrix is URL-encoded.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-291 (NEW — Sequential dual-fetch contract is fragile under partial failures: HierarchyLineage.tsx:54-66 issues downstream first then upstream via `.then()` chain; if downstream returns 500, upstream NEVER fires; user sees single error with no recovery path)

**Proposed action**: Promote to `adrs/drafts/two-direction-mirrored-lineage-layouts.md`. Document:
- The two-tree pattern with the centred root.
- The sign-flip mechanism.
- The fetch sequence (downstream first, then upstream) and its error coupling.
- The independence property (upstream and downstream layouts don't constrain each other).
- The pan/zoom integration.
- The visual contract for operators: centre = root entity; left = upstream; right = downstream.

**Severity rationale**: MEDIUM — pattern-shaping decision for Pillar P-05; specific to the lineage canvas; observable but feature-local.

**Suggested backlog grouping**: `UI architecture codification`.

---
