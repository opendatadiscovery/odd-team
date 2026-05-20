## REFACTOR-278 — `updateDataEntity` in dataentities.slice.ts silently STRIPS empty-externalName entries from sourceList/targetList/inputList/outputList, replacing them with `unknownXCount` integers; a backend regression emitting null externalName for KNOWN entities silently disappears from the lineage shortcuts on the detail page

**Severity**: LOW
**Category**: silent-data-shape-transformation
**Pillars affected**: [P-01, P-05] — Discovery × Lineage shortcuts on the detail page
**Surfaced by**:
- `fetchDataEntityDetails.md:bugs_limitations_corner_cases[4]` (|-
    "**Silent client-side stripping of empty external-name entries** — `updateDataEntity` at `dataentities.slice.ts:28-47` walks `sourceList`/`targetList`/`inputList`/`outputList` and **filters out any entry where `externalName` is falsy**, replacing them with `unknownSourcesCount` / `unknownTargetsCount` / `unknownInputsCount` / `unknownOutputsCount`. This is a client-side data-shape transformation that is opaque to anyone reading the raw API payload; the UI shows '+ N more' chips for these but the data is gone from the store. A backend regression that starts emitting null externalName for known entities would silently disappear from the lineage shortcuts on the detail page.")

**Description**: The fan-out reducer for `fetchDataEntityDetails.fulfilled` at `dataentities.slice.ts:28-47` calls `updateDataEntity(state, payload)`, which walks each of the four lineage-shortcut arrays (`sourceList`, `targetList`, `inputList`, `outputList`) and:
1. Filters OUT every entry where `externalName` is falsy.
2. Counts the filtered-out entries.
3. Stores the survivors in the array.
4. Stores the count in `unknownSourcesCount` / `unknownTargetsCount` / `unknownInputsCount` / `unknownOutputsCount`.

The UI renders the survivors as clickable chips + an "and N more" chip for the unknown counts. The intent: when the backend cannot resolve a referenced entity to a name, show the count rather than display "Unknown entity, Unknown entity, Unknown entity ..." literally.

The problem: this is a CLIENT-SIDE data-shape transformation that is OPAQUE to anyone reading the raw API payload. A backend regression — e.g. a column rename that produces `externalName: null` for entities that DO exist — would silently disappear from the lineage shortcuts on the detail page. The "+ N more" count would inflate, but the user has no way to tell whether those N are "really unknown" or "regression-disappeared knowns."

**Primary source citations**:
- `dataentities.slice.ts:28-47` — the filter loop
- `dataentities.slice.ts:55-65` — the reducer wiring
- `fetchDataEntityDetails.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-085 codifies the fan-out architecture; this is a sub-behaviour of the fan-out that should be DOCUMENTED in the ADR (the slice owns the transform, the API contract preserves the raw shape). No existing ADR prescribes the absence of regression detection.

**Proposed remedy**: Two-part fix:
1. **Defending comment** at `dataentities.slice.ts:28-47` documenting the transform + its rationale + its silent-data-loss-on-backend-regression failure mode.
2. **Test** that mounts the slice with a known-good `DataEntityDetails` payload + asserts the four counts match the four list sizes pre-filter. A future test against a regression payload would surface the disappearance.

Alternative: log a warning when filter-count exceeds 0 in development mode, to surface the issue in dev-DB testing.

**Severity rationale**: LOW — the failure mode requires a backend regression to manifest; today the filter behaviour is correct for the intended case. The gap is robustness against backend changes, not a current bug.

**Suggested backlog grouping**: `UI test coverage bootstrap` (REFACTOR-289).

---
