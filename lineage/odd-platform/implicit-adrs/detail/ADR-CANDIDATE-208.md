## ADR-CANDIDATE-208 — Per-test-category result rows render run-status tiles in FIXED enum-declaration order (not server-supplied order, not count-descending) — the visual columns are deliberately comparable across category rows, achieved by re-sorting `results` via `Object.values(DataEntityRunStatus).map(find)` instead of a plain `results.map`

**Severity**: LOW
**Classification**: promote
**Support count**: 1 sidecar primary-source (`TestCategoryResults`) + 1 byte-identical-pattern sibling (`DataQualityContent` legend) — pattern coheres across the dashboard's tile-grid + legend pair
**Axes present**: ui_components
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__TestCategoryResults.md:implicit_adrs.[0]` (HIGH) — |-
    "**Fixed-position status tiles via enum-order re-sort, not server-order rendering.** `sortedResults` deliberately discards the order the backend serialised `results` in and rebuilds the array by iterating `Object.values(DataEntityRunStatus)` and `find`-ing each status (`TestCategoryResults.tsx:19-25`). The decision is visible in the code shape: a plain `results.map(...)` would have been shorter; the developer chose the enum-driven re-sort specifically so every category row shows its SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN tiles in the same horizontal slots, making the dashboard columns visually comparable across category rows. The same enum-iteration pattern is used for the shared dashboard legend in the sibling (`DataQualityContent.tsx:83-89`), so legend order and tile order are guaranteed to match." — intent_anchor: `Object.values(DataEntityRunStatus).map(status => results.find(result => result.status === status)).flatMap(f => (f ? [f] : []))` (`TestCategoryResults.tsx:21-23`)

**Decision statement**: The per-category result row on the Data Quality Dashboard (`/data-quality`) places the six run-status count tiles in a FIXED horizontal order — `SUCCESS → FAILED → SKIPPED → BROKEN → ABORTED → UNKNOWN` — derived from the `DataEntityRunStatus` enum's declaration order in `components.yaml:1407-1415`. The order is INDEPENDENT of (a) the order the backend serialised the `results` array in (the backend `DataQualityCategoryMapperImpl.mapToDto` imposes no ordering, line 21-43), (b) the per-row count values, (c) the user's locale. Two implementation choices encode the decision:

1. **Enum-iteration re-sort, not `results.map`**: `sortedResults` (`TestCategoryResults.tsx:19-25`) iterates `Object.values(DataEntityRunStatus)` and does `results.find(r => r.status === status)` for each enum value, materialising the tiles in enum order. A plain `results.map(...)` — the obvious shorter alternative — was rejected because it would let the visible column position track whichever order the backend happened to serialise the array in. The longer enum-driven shape is the deliberate signal of "stable column position is the property we're defending."

2. **Legend uses the IDENTICAL enum iteration**: the dashboard's shared legend at `DataQualityContent.tsx:83-89` walks the same `Object.values(DataEntityRunStatus)` to produce the legend chips. Because both the tile row and the legend chip list share one enum iteration, legend order and tile order are guaranteed to match — the operator reading the legend left-to-right reads the tiles in the same left-to-right meaning. This pair (tile re-sort + legend re-sort sharing the enum iteration) is the cross-component intent anchor.

The visual property the decision defends: when an operator scans the dashboard's category panels (Assertion Tests / Column Values Anomalies / Freshness Anomalies / Schema Changes / Unknown category / Volume Anomalies), the FAILED tile is in the same slot in every panel, and the legend's FAILED chip corresponds to that slot. Without this re-sort, an operator could not compare FAILED counts across panels without re-reading each tile's label.

The rejected alternatives:
- **(a) `results.map(r => <Tile status=... />)`** — shorter, but column position tracks backend serialisation order, defeating cross-panel comparison.
- **(b) Sort `results` by count descending** — would order tiles by current failure volume; would make column position TRACK THE DATA, defeating cross-panel comparison even more strongly.
- **(c) Sort by status name alphabetically** — would put ABORTED first, BROKEN second, etc.; an arbitrary order with no semantic priority (the enum-declaration order has at least the "success-first, failure-classes-grouped" implicit semantic the team picked).
- **(d) Per-row tile-set the backend chooses** — would push the ordering decision server-side; the UI layer cannot enforce it; rejected by keeping the ordering in the UI.

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — the longer enum-driven shape over a plain `results.map` IS the deliberate-decision evidence (a maintainer chose the costlier-to-write idiom for a reason); the cross-component identity of the iteration (tile re-sort + legend re-sort) is the second evidence. No comment defends it in prose, but the code shape IS the decision.
2. *Structural impact?* YES — defines the dashboard's cross-panel visual comparability contract; affects how every per-category card composes; couples the UI to the OpenAPI-generated enum's declaration order (a change to the enum's order in `components.yaml` silently reorders every tile in production). Any future "let's sort by failure count" change would breach the comparability contract.
3. *Refactoring or structural?* STRUCTURAL — switching to count-descending or to per-row server-chosen order would change the visual contract every cross-panel comparison currently relies on; the maintainer cannot make a one-line swap without making a real semantic decision.
→ ADR.

**Evidence**:
- `TestCategoryResults.tsx:19-25` — the enum-iteration re-sort: `Object.values(DataEntityRunStatus).map(status => results.find(result => result.status === status)).flatMap(f => (f ? [f] : []))`
- `DataQualityContent.tsx:83-89` — the legend using the identical `Object.values(DataEntityRunStatus)` iteration; same enum, same order, paired by construction
- `components.yaml:1407-1415` — the OpenAPI-generated `DataEntityRunStatus` enum (the canonical declaration order: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN); the UI silently depends on this declaration order
- `TestCategoryResults.tsx:36-42` — the render side: `sortedResults.map` emits tiles in the materialised array's order

**Existing ADR**: composes with:
- **F-032 / P-04:F-002 Quality Dashboard** — the structural choice is one of the dashboard's two ordering decisions (the other is the parent `DataQualityContent.tsx:75-77` alphabetical sort of CATEGORY ROWS via `localeCompare`; that ordering is GAP-shaped — REFACTOR-602 — not ADR-shaped, see below).
- The **opaque-category-string treatment** in `DataQualityContent.tsx`'s `implicit_adrs[2]` ("Category labels are treated as opaque backend strings, sorted client-side — the UI carries no category taxonomy"): the dashboard takes the opposite posture for the TWO ordering axes — for category ROWS it trusts whatever string the backend supplies and sorts alphabetically client-side; for status TILES it ignores the backend order entirely and re-sorts by the typed enum. The two together encode "category set is backend-owned; status set is contract-owned."

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-608** (NEW — the `flatMap(f => (f ? [f] : []))` drop-branch silently omits a status tile if `results` is missing that status; in production it is dead code because the backend mapper's `addMissingStatuses` guarantees all six statuses — but the UI does not assert that backend invariant; an undocumented cross-tier coupling)
- **REFACTOR-602** (NEW — the SIBLING ordering choice at `DataQualityContent.tsx:75-77` sorts category ROWS alphabetically by name, not by failure count — operator opening `/data-quality` to find "which category is failing worst" must scan all panels; this is a SEPARATE ordering decision, and gap-shaped rather than ADR-shaped because there is no stated rationale for the alphabetical-over-severity choice and a reasonable change-request would make it severity-descending)

**Proposed action**: Promote to `adrs/drafts/dashboard-tile-order-enum-driven.md` OR (smaller-scope) fold into the future Quality Dashboard ADR with the cross-panel-comparability section. Document:

- The cross-panel comparability property the decision defends.
- The enum-iteration pattern (`Object.values(DataEntityRunStatus).map(find).flatMap(present-only)`) as the codified shape.
- The cross-component pairing with the legend at `DataQualityContent.tsx:83-89` — when one re-sort moves, both must move together.
- The dependency on the OpenAPI enum's declaration order — a future spec-side reorder silently re-orders every dashboard tile in production; if the enum is ever reordered, the UI tile order changes with it. (Operator-visible silent UI change; an ADR consequence worth pinning so a contract-bumping PR triggers a deliberate "the dashboard's tile order will change" review.)
- The cross-reference to REFACTOR-608 (the silent backend-invariant dependency the present-only flatMap hides) and to REFACTOR-602 (the separate category-row ordering gap).

**Severity rationale**: LOW — pattern-shaping decision for one feature's visual contract. It is real and deliberate (passes the wisdom test) but it is local to the dashboard's category panel; it does not span pillars and does not constrain large parts of the codebase. The right severity is LOW with the upside that recording it pre-empts a "let's sort by failures" or "let's drop the enum re-sort" cleanup PR a year from now that would silently breach the cross-panel comparability operators rely on.

**Suggested ADR-draft slug**: fold into the Quality Dashboard ADR if one is opened; otherwise `adrs/drafts/dashboard-tile-order-enum-driven.md` as a thin standalone.

---
