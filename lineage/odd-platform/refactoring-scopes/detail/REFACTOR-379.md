## REFACTOR-379 — Tag `listMostPopular` external-aggregate divergence — dataset-entity arm uses `boolOr(TAG_TO_DATA_ENTITY.EXTERNAL)`; dataset-field arm uses `boolOr(TAG_TO_DATASET_FIELD.ORIGIN.ne(INTERNAL.name()))`; semantic "is this tag used externally" computed differently across two arms

**Severity**: LOW
**Category**: silent-feature-divergence (semantic drift between data-entity arm and dataset-field arm of the same UNION-ALL)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[8]`

**Description**: `ReactiveTagRepositoryImpl.listMostPopular` (lines 373-392) UNION-ALLs aggregates from `tag_to_data_entity` and `tag_to_dataset_field`. The "external" flag computation diverges:
- dataset-entity arm: `boolOr(TAG_TO_DATA_ENTITY.EXTERNAL)` — directly reads the boolean column.
- dataset-field arm: `boolOr(TAG_TO_DATASET_FIELD.ORIGIN.ne(TagOrigin.INTERNAL.name()))` — derives from origin enum.

The semantic "is this tag used externally" is computed differently across the two relation tables — `EXTERNAL_STATISTICS` is folded into 'external' on the dataset-field side because `ne(INTERNAL)` includes it, but is folded into 'external' on the dataset-entity side ONLY if the boolean column was set.

The result: a tag used only on dataset fields via `EXTERNAL_STATISTICS` will report `external = true` from `listMostPopular`, but the same tag's dataset-entity usage with `external = false` would still aggregate correctly. The divergence is intentional but not asserted in tests.

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:373-391`

**Proposed remedy**:
1. **Document the semantic** — add a Javadoc comment explaining the divergence and the intent.
2. **Add a regression test** — assert the cross-arm consistency at typical row shapes.
3. **Unify the semantic** — pick ONE definition of "external" (e.g., `origin != INTERNAL`) and apply to both arms. UX trade-off: changes to how `tag_to_data_entity.external` is used downstream.

Option 1 is the smallest blast radius.

**Severity rationale**: LOW — silent-feature-divergence; UX semantic ambiguity; no security impact.

**Suggested backlog grouping**: `Tagging-tier hardening sprint` — small documentation / test addition.

---
