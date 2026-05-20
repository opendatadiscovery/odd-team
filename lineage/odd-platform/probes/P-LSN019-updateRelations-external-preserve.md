---
probe_id: P-LSN019-updateRelations-external-preserve
source_node: odd-platform java service:TagServiceImpl
source_finding: S-B-2 (Stress Protocol Category B — name-behaviour drift, subtle asymmetry)
related_lsn: LSN-019
status: skeleton-emitted
---

# P-LSN019-updateRelations-external-preserve

## What we're testing

`TagServiceImpl.updateRelationsWithDataEntity(dataEntityId, tagNames)` (`TagServiceImpl.java:96-121`) — promises to "update the data entity's tag relations to the given set of names". The empirical claim under test: EXTERNAL relations (Collector-set, `tag_to_data_entity.external = true`) are NOT touched by this method regardless of `tagNames`. A user calling this with `tagNames = {'A', 'B'}` against an entity with EXTERNAL relations `{'C', 'D'}` ends up with `{A, B, C, D}`, not `{A, B}`.

Static evidence:
- Line 102: `.filter(pojo -> !pojo.getExternal())` — the current-relations read filters OUT external rows BEFORE diffing.
- Line 109: `.setExternal(false)` — new relations are hardcoded `external = false`.

## Setup

1. Live demo environment.
2. Data entity X with three tag relations:
   - `(X, 'A', external=false)` — UI-set
   - `(X, 'B', external=false)` — UI-set
   - `(X, 'C', external=true)` — Collector-set
   - `(X, 'D', external=true)` — Collector-set
3. Auth: user with `DATA_ENTITY_TAGS_UPDATE` permission on X.

## Procedure

1. `PUT /api/dataentities/X/tags` with body `{"tagNames": ["A", "E"]}` (drop B, keep A, add E; do NOT mention C or D).
2. `GET /api/dataentities/X` — inspect `tags[]`.

## Expected behaviour (per static reading)

- B is removed (UI-set, not in keep set).
- A is kept (UI-set, in keep set).
- E is added (novel, gets `external=false`).
- C and D are PRESERVED (external=true, never touched).

Final state: `{A, C, D, E}` — four relations.

## Pass / fail criteria

- **PASS**: response `tags[]` contains exactly `{A, C, D, E}`. The C and D relations remain `external=true`. The new E relation has `external=false`.
- **FAIL**: response `tags[]` is `{A, E}` (C and D dropped — bug; UI impersonating Collector deletion) OR `{A, C, D, E}` but with C/D now `external=false` (bug; UI impersonating Collector ownership).

## On confirmation

The behaviour is the documented invariant — this probe is a REGRESSION GUARD, not a bug-finder. Drift here would indicate someone removed the `:102` filter or the `:109` hardcode. Either change would be a P-09 Security & Access Control regression (the UI can impersonate the Collector or vice versa).

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:96-121`, especially lines 102 and 109
- Related controller: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java` (the `PUT /api/dataentities/{id}/tags` endpoint)
