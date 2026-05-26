# SHB-002 — Compact lineage view-mode toggle

**Category**: open
**Severity**: LOW

## Hypothesis

The two lineage views (DEG-anchored and per-entity Hierarchy) expose a "compact" rendering mode toggled by a `full: boolean` URL query parameter. The mode probably hides per-node detail (run-status, field counts, owner chips, etc.) so users navigating dense graphs can see structure without per-node clutter. As of 2026-05-26 this control is not described in any feature flow — F-005 (Per-entity lineage) and F-016 (DEG-anchored lineage) thread the data fetch and graph layout but never enumerate the view-mode toggle.

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/Lineage/DEGLineage/lib/interfaces.ts:24-29` — `interface DEGLineageQueryParams { full: boolean; // full or compact view; x, y, s: zoom/pan state }`. The `full` flag is a URL-encoded query param, persisted on link share / browser-back.
- `odd-platform-ui/src/components/DataEntityDetails/Lineage/HierarchyLineage/lineageLib/interfaces.ts:76` — same `full: boolean // full or compact view` declaration on the Hierarchy variant. **Two distinct lineage views, identical toggle shape** — strong signal this is a deliberate cross-view feature, not an accident.

## Notes

- "compact" is referenced as a contrasting label to "full" in source comments at both interfaces.ts files; the actual difference in rendering has not been read yet. Plausible interpretations:
  - guess: "compact" hides per-node detail panels (owner / status / field-count) and renders smaller nodes.
  - guess: "compact" hides leaf-level expansion and shows only group-level nodes (relevant to DEG views where DEGs contain dozens of inner entities).
  - guess: "compact" aggregates parallel edges into bundled lines.
  - All three are testable by reading the consumers of `DEGLineageQueryParams.full` and `HierarchyLineageQueryParams.full`.
- The flag is in the URL query, not in user preferences / a server-stored profile — so the choice does NOT persist across sessions / devices. Probably deliberate (it's a per-graph navigation mode, not a global preference), but worth confirming.
- No toggle UI has been located yet — there must be a button/segmented control somewhere that flips this; needs greppage for `setSearchParams.*full` or `Switch.*full` in the Lineage tree.
- Zoom/pan state (`x`, `y`, `s`) lives in the same params object — these are also "lineage view-mode state" but probably belong to a separate feature ("Lineage navigation state persistence in URL"). Possibly the same feature; possibly worth two threads.
- This is an `open` thread, not `clustering`. Only 2 evidence refs; need to read the toggle UI, the consumers of `full`, and validate at least one interpretation before promoting to `clustering`.

## Next

1. **Read the consumers of `full`** in `DEGLineage/` and `HierarchyLineage/` to determine what rendering actually changes between `full: true` and `full: false`.
2. **Find the toggle UI control** — grep `odd-platform-ui/src/components/DataEntityDetails/Lineage/` for components that call `setSearchParams` with `full`, or for buttons/switches labelled "compact" / "full" / "detail" / "summary".
3. **Decide:** is this its own feature (`F-NNN — Lineage Compact / Full View Toggle`), or a facet of F-005 (`drift_class: ui_view_mode_toggle_undocumented`) and F-016 (same)? Probably its own feature given the consistent shape across two distinct lineage variants — but defer to the feature-flow-builder.
4. **Check zoom-pan-state** — should it be a sibling thread (SHB-003 — "Lineage zoom/pan persistence via URL") or fold into this one? Lean toward sibling: different UX concern, just happens to share the same query params object.
5. **DOC-NHN** — `docs.opendatadiscovery.org/features/data-lineage` (or wherever Lineage is documented) does it mention the compact toggle? If not, this is an operator-discoverability gap.

## Links

- cluster_with: []
- merged_into: (open)
- supersedes: []

## evaluation

(feature-flow-builder will append a dated entry here on its next run.)
