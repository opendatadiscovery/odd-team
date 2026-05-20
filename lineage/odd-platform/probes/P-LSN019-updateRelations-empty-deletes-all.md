---
probe_id: P-LSN019-updateRelations-empty-deletes-all
source_node: odd-platform java service:TagServiceImpl
source_finding: S-C-2 (Stress Protocol Category C — cardinality and bounds, empty-input semantic)
related_lsn: LSN-019
status: skeleton-emitted
---

# P-LSN019-updateRelations-empty-deletes-all

## What we're testing

`TagServiceImpl.updateRelationsWithDataEntity(dataEntityId, {})` — empty input semantic. The empirical claim under test: passing an empty `tagNames` Set REMOVES ALL non-external tag relations from the data entity. This is the diff semantic playing out — `current \ updated = current` when `updated` is empty.

Static evidence:
- Lines 105-110: `getOrCreateTagsByName({})` returns empty; `updatedRelations = []`.
- Lines 114-116: `pojosToDelete = current.stream().filter(r -> !updated.contains(r)).toList()` — every current relation is in the delete set.
- Line 117: `deleteDataEntityRelations(pojosToDelete)` — deletes all of them.

## Setup

1. Live demo environment.
2. Data entity X with three UI-set tag relations: `(X, A, external=false)`, `(X, B, external=false)`, `(X, C, external=false)`. Plus optionally one EXTERNAL relation `(X, D, external=true)` for the cross-check.
3. Auth: user with `DATA_ENTITY_TAGS_UPDATE` on X.

## Procedure

1. `PUT /api/dataentities/X/tags` with body `{"tagNames": []}` (empty array).
2. `GET /api/dataentities/X` — inspect `tags[]`.

## Expected behaviour (per static reading)

- All non-external relations (A, B, C) are deleted.
- The EXTERNAL relation (D) is preserved (per S-B-2 invariant).
- Final state: `tags = [D]` (only the Collector-set relation remains) OR `tags = []` if no D existed.

## Pass / fail criteria

- **CONFIRMED (PASS for the probe; FAIL for UX safety)**: response `tags = [D]` (or `[]`). All UI-set relations gone.
- **NOT CONFIRMED (no-op semantic)**: response `tags = [A, B, C, D]`. The endpoint treats `[]` as "no change". This would contradict the static reading.

## On confirmation

The behaviour is correct per the diff semantic but is a footgun for API consumers who treat `[]` as "no tags specified, don't change anything". Refactoring scope: either (a) explicitly validate `tagNames` is non-null but distinguish "null" (no-change) from "empty" (delete-all) at the controller — but the current OpenAPI spec does not allow null lists, so this would require spec change; or (b) document the empty-input semantic explicitly in the OpenAPI description for `PUT /api/dataentities/{id}/tags` so consumers don't mistake it for a no-op.

Per the maintainer's note pattern: this is the kind of caveat that should appear next to the default, not three sections away. The OpenAPI description for this endpoint should literally say: *"Submitting an empty `tagNames` array removes all non-external (UI-set) tag relations from the data entity. To preserve the current state, do not call this endpoint."*

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:96-121`
- Cross-reference: S-B-2 / P-LSN019-updateRelations-external-preserve for the EXTERNAL invariant
