## ADR-CANDIDATE-085 — `fetchDataEntityDetails.fulfilled` payload is intentionally FANNED across three normalised Redux slices (dataentities + metadata + owners), with the verbatim source comment "Metadata and Ownership are being stored in MetadataState and OwnersState" as the intent anchor

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source; pattern likely repeated for other detail-page thunks (uninspected)
**Axes present**: ui_redux_thunks, ui_redux_slices
**Pillars affected**: [P-01] — the centerpiece detail-page load architecture

**Surfaced by**:
- `fetchDataEntityDetails.md:implicit_adrs[2]` (|-
    "The fulfilled action's payload is intentionally **fanned across three slices** rather than nested into a single dataentities-slice shape. The author rejected a 'nested entity record' shape in favour of side-by-side normalised slices (dataentities + metadata + owners), each with its own extraReducer registering on the same `fetchDataEntityDetails.fulfilled` action — visible in `dataentities.slice.ts:97`, `metadata.slice.ts:18`, `owners.slice.ts:52`. The COMMENT in `dataentities.slice.ts:55` makes the intent explicit.")

**Decision statement**: On `fetchDataEntityDetails.fulfilled`, the resolved `DataEntityDetails` payload is fanned into THREE independent Redux slices — `dataentities.slice` (the entity record minus metadata + ownership), `metadata.slice` (the metadataFieldValues chunk only), and `owners.slice` (the ownership chunk only) — each with its own `extraReducers.addCase(fetchDataEntityDetails.fulfilled, ...)` registration. The author deliberately rejected a "nested entity record" shape in favour of side-by-side normalised slices. The verbatim source comment at `dataentities.slice.ts:55` is the intent anchor: `// Metadata and Ownership are being stored in MetadataState and OwnersState`.

Consequences encoded:
- **(a) Each child slice owns its own selectors, reducers, and update paths** — metadata edits target `metadata.slice` reducers directly without touching the entity record; ownership mutations target `owners.slice` reducers; the entity record stays clean.
- **(b) Fan-out invariant** — a single network response triggers three reducer runs in one Redux action-dispatch tick; any addCase against `fetchDataEntityDetails.fulfilled` participates in the same atomic update.
- **(c) Backward-compat fragility** — a future field-name change on the `DataEntityDetails` contract could silently break the metadata-slice or owners-slice extraReducer without breaking compilation if the field becomes optional. The normalisation depends on stable field naming.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the verbatim source comment at `dataentities.slice.ts:55` (`// Metadata and Ownership are being stored in MetadataState and OwnersState`) is the textbook intent anchor: the maintainer explicitly stated the partition strategy.
2. *Structural impact?* YES — affects the Redux store shape, the three slice reducers, every selector reading metadata or ownership, every mutation thunk that needs to invalidate one part of the store without affecting others.
3. *Refactoring or structural?* STRUCTURAL — collapsing the three slices back into one nested record would change every consumer's selector shape, the slice file layout, the addCase wiring. Not a refactor.
→ ADR.

**Evidence**:
- fetchDataEntityDetails.md says: "`dataentities.slice.ts:55` (the intent comment) + `metadata.slice.ts:18` + `owners.slice.ts:52-54`"
- intent_anchor: verbatim comment at `dataentities.slice.ts:55`: `// Metadata and Ownership are being stored in MetadataState and OwnersState`
- DataEntityDetails.md confirms (downstream_side_effects): "on fulfilled: write the full `DataEntityDetails` payload (minus metadata + ownership) into `state.dataentities.byId[payload.id]`" + "write `metadataFieldValues` into `state.metadata` slice" + "write `ownership` into `state.owners` slice"

**Existing ADR**: none. Composes with:
- ADR-CANDIDATE-084 (handleResponseAsyncThunk wrapper) — this ADR is the data-shape side; that ADR is the dispatch-shape side. Together they describe the UI's typed-fetch architecture.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-278 (NEW — `updateDataEntity` in dataentities.slice.ts:28-47 SILENTLY STRIPS empty-externalName entries from sourceList/targetList/inputList/outputList, replacing them with `unknownXCount` integers; a backend regression emitting null externalName for known entities silently disappears from the lineage shortcuts on the detail page)

**Proposed action**: Promote to `adrs/drafts/fan-out-detail-payload-across-three-slices.md`. Document:
- The three-slice normalisation strategy.
- The fan-out invariant (one fulfilled action → three reducer runs atomically).
- The intent anchor (the source comment).
- The maintenance obligation: when adding a field to `DataEntityDetails`, decide which slice owns it.
- The mutation-isolation property: edits to metadata don't dirty the entity record.
- The known fragility: implicit dependency on stable field naming across the OpenAPI contract.

**Severity rationale**: MEDIUM — pattern-shaping decision for the centerpiece detail-page architecture. Below HIGH because it's local to the entity-detail subsystem rather than codebase-wide.

**Suggested backlog grouping**: `UI architecture codification` (with ADR-CANDIDATE-084 above).

---
