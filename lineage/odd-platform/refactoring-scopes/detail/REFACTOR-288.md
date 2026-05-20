## REFACTOR-288 — Diamond DAG amplification at the UI lineage canvas: `d3-hierarchy.hierarchy()` builds a TREE not a DAG; entity D reachable from root via two paths renders as TWO SVG nodes at distinct positions — no client-side visited-set guard

**Severity**: MEDIUM
**Category**: performance-redundant-work + ui-realisation-of-backend-gap
**Pillars affected**: [P-05] — Data Lineage
**Surfaced by**:
- `LineageGraph.md:bugs_limitations_corner_cases[0]` (|-
    "**Diamond DAG amplification at the UI** — `d3-hierarchy.hierarchy(root, childAccessor)` (generateGraph.ts:69-76, 109-116) builds a TREE, not a DAG. If entity D is reachable from root R via two paths (R→B→D and R→C→D), D appears TWICE in the rendered tree — each instance is a distinct `HierarchyPointNode` with its own `d3attrs.id` UUID (parseData stamps UUIDs once per RAW node, but `hierarchy(...)` re-visits the same raw node along each path, so the SAME `d3attrs.id` shows up at two positions). React keys at LineageGraph.tsx:91 use `node.x${node.y}` — DIFFERENT positions ARE distinct keys, so React mounts two SVG nodes. Cumulatively, this amplifies REFACTOR-202 from the backend into the UI: a diamond at backend produces N rows; the UI renders N visual nodes.")

**Description**: ADR-CANDIDATE-092 codifies the d3-hierarchy choice as deliberate (determinism over DAG faithfulness). REFACTOR-288 is the gap-flavoured side of the same observation: the absence of a UI-side visited-set guard means diamond-shaped lineage graphs render with duplicate nodes, which is:
1. **Visually confusing for operators** — "Why does entity D appear twice in this lineage?" The diamond IS the right answer, but the visual implies duplication.
2. **Performance-degrading** — every diamond doubles the SVG node count; every diamond's downstream nodes triple+ in deep diamond chains; render-thread work scales accordingly.
3. **Amplifies REFACTOR-202** — the backend's recursive-CTE returns N rows for a diamond; the UI faithfully renders all N.

The fix shape: a client-side visited-set guard inside `generateGraph.ts:hierarchy()`-walk would dedupe nodes at the cost of breaking the tree contract (children of a deduped node would not appear at the second position). The trade-off is real:
- **Keep duplication (current)** — visually wrong for operators expecting DAG; performance cost; deterministic layout.
- **Dedupe in UI** — visually cleaner; loses one of the two positions; the tree contract breaks (the child accessor at the deduped position returns no children).
- **Switch to DAG renderer (react-flow, Cytoscape)** — full DAG faithfulness; layout non-deterministic; library swap.

The ADR-CANDIDATE-092 framing locks in option 1 (keep duplication) as the deliberate architectural choice. REFACTOR-288 surfaces the GAP that the choice's consequences are not documented to operators (a user seeing a diamond is left to interpret the visual on their own).

**Primary source citations**:
- `generateGraph.ts:68-76, 108-116` — the hierarchy walk with no visited-set check
- `LineageGraph.tsx:84-110` — the node-per-instance rendering
- `LineageGraph.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-092 (newly minted in batch J) codifies the d3-hierarchy choice. This REFACTOR is the documentation-debt side: operators need to know the visual encoding. The fix is ADR-codification + operator doc (DOC-NNN follow-up).

**Proposed remedy**: Three-layer:
1. **ADR documentation** — the ADR-CANDIDATE-092 draft must include the diamond-rendering consequence + the rationale (determinism over faithfulness).
2. **Operator doc** — a public doc-product surface explaining "if you see an entity rendered twice in the lineage canvas, it appears via multiple paths from the root — this is the DAG faithfully unrolled to a tree" (DOC-NNN).
3. **(Optional, structural)** — visual hint in the UI: when a node renders multiple times, add a small badge "2/3" indicating "this is instance 2 of 3 of the same entity in your current view." Helps operators interpret.

**Severity rationale**: MEDIUM — visual confusion + performance amplification; not a security gap, but compounds with REFACTOR-202 (backend). The doc + ADR fix is the cheap immediate win.

**Suggested backlog grouping**: `Lineage subsystem documentation sprint` + `UI architecture codification`.

---
