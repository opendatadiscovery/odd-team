---
probe_id: P-LSN019-deleteRelationsWithTerm-case
source_node: odd-platform java service:TagServiceImpl
source_finding: S-B-5 (Stress Protocol Category B — name-behaviour drift, case-sensitive set difference)
related_lsn: LSN-019
status: skeleton-emitted
---

# P-LSN019-deleteRelationsWithTerm-case

## What we're testing

`TagServiceImpl.deleteRelationsWithTerm(termId, tagsToKeep)` (`TagServiceImpl.java:123-134`) — promises to delete term-tag relations EXCEPT those whose tag name is in `tagsToKeep`. The empirical claim under test: the keep-set membership check is case-SENSITIVE (Java `Set<String>.contains` is binary equality). A term with tag `Postgres` and a caller passing `tagsToKeep = {'postgres'}` will DELETE the `Postgres` relation.

Static evidence:
- Line 130: `.filter(l -> !tagsToKeep.contains(l.getName()))` — `Set<String>.contains` is case-sensitive.
- The case-sensitivity divergence (`listMostPopular` case-insensitive vs `listByNames` case-sensitive) is the underlying cause — see S-B-3 / P-LSN019-divide-case-sensitive.

## Setup

1. Live demo environment.
2. Term T with tag relations to `Postgres` (id N) and `MySQL` (id M).
3. Auth: user with `TERM_TAGS_UPDATE` on T (the side-door for term-tag-removal).

## Procedure

1. `PUT /api/terms/T/tags` with body `{"tagNames": ["postgres", "MySQL"]}` (lowercase `postgres` instead of `Postgres`).
2. The handler in `TermServiceImpl` (or the equivalent) will delegate to `deleteRelationsWithTerm` and `createRelationsWithTerm`.
3. `GET /api/terms/T` — inspect `tags[]`.

## Expected behaviour (per static reading)

- `deleteRelationsWithTerm(T, {'postgres', 'MySQL'})` reads current term-tags: `[Postgres, MySQL]`.
- Filter: keep `Postgres`? Set contains `postgres`? NO (case-sensitive). → DELETE the `Postgres -> T` relation.
- Filter: keep `MySQL`? Set contains `MySQL`? YES → KEEP.
- `idsToDelete = [N]` (Postgres id).
- `deleteTermRelations(T, [N])` removes the Postgres relation.
- Then `createRelationsWithTerm(T, [postgres_tag])` ADDS a new relation — but `postgres_tag` had to be minted by the prior `getOrCreateTagsByName({'postgres', 'MySQL'})` call (which on `MySQL` finds it existing, on `postgres` finds it missing in the existence-check despite `Postgres` existing, and mints a SECOND row `postgres` per S-B-3).

Final state: term T has relations to `MySQL` (kept) and `postgres` (new lowercase row). The `Postgres` relation is gone; the `Postgres` tag itself still exists in the directory but is no longer attached to T.

## Pass / fail criteria

- **DRIFT confirmed**: term T's relations are `[MySQL, postgres]` (lowercase). The `Postgres` relation was deleted despite the user's intent (rough-case `postgres` was meant to refer to the same tag).
- **DRIFT NOT confirmed**: term T's relations are `[MySQL, Postgres]` (the case-only-different name was treated as a no-op). This would contradict the static reading.

## On confirmation

The drift is a UX trap that compounds S-B-3 (the case-sensitive `divideTagsByExistence`). The user's mental model is "tags are case-insensitive" (because the popular-search-facet is case-insensitive); the write paths are case-sensitive. A user editing term-tags via copy-paste from a different surface can silently lose relations.

Refactoring scope: align the case-sensitivity model — see S-B-3 fix scope. Specifically for this method, the fix could be local: `.filter(l -> !tagsToKeep.stream().anyMatch(t -> t.equalsIgnoreCase(l.getName())))` — but this would create an inconsistency where deletion is case-insensitive but creation is case-sensitive (a worse drift). Best fix: case-fold at write across all paths.

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:123-134`
- Related probe: `P-LSN019-divide-case-sensitive.md` (the root case-sensitivity divergence)
