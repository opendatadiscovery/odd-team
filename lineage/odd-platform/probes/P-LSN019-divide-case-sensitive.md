---
probe_id: P-LSN019-divide-case-sensitive
source_node: odd-platform java service:TagServiceImpl
source_finding: S-B-3 (Stress Protocol Category B — name-behaviour drift, case-sensitivity divergence)
related_lsn: LSN-019
status: skeleton-emitted
---

# P-LSN019-divide-case-sensitive

## What we're testing

`TagServiceImpl.divideTagsByExistence(tagNames)` (`TagServiceImpl.java:144-159`) and its callers — promises to split a set of names into `(existing, toCreate)`. The empirical claim under test: the existence check is case-SENSITIVE, so submitting `{'Postgres', 'postgres'}` when only `Postgres` exists in the DB will mint a second directory row `postgres`. The UI tag-search facet (case-insensitive substring match) surfaces both.

Static evidence:
- `existingTagNames.contains(n)` at line 154 — Java `List<String>.contains` is binary equality.
- `listByNames(tagNames)` calls `ReactiveTagRepositoryImpl.listByNames` which uses `TAG.NAME.in(names)` — case-sensitive SQL `IN` against `text` column.
- The `tag_name_unique` partial unique index in `V0_0_64__remove_is_deleted_field.sql:105` is `text`-based, not `lower(text)`.

## Setup

1. Live demo environment.
2. Empty `tag` table (or precondition: no tags named `Postgres`, `postgres`, `POSTGRES`).
3. Auth: user with `TAG_CREATE` for the direct path, OR user with `DATA_ENTITY_TAGS_UPDATE` for the side-door path.

## Procedure

### Direct path (`TagController.createTag`)

1. `POST /api/tags` with body `{"items": [{"name": "Postgres", "important": false}, {"name": "postgres", "important": false}]}`.
2. `GET /api/tags/popular?page=1&size=10` — inspect.

### Side-door path (`DataEntityController.upsertTags`)

1. Pick data entity X.
2. `PUT /api/dataentities/X/tags` with body `{"tagNames": ["Postgres", "postgres"]}`.
3. `GET /api/tags/popular?page=1&size=10` — inspect.
4. `GET /api/tags/popular?page=1&size=10&query=postgres` — inspect (case-insensitive query).

## Expected behaviour (per static reading)

- Both invocations mint TWO directory rows: `(id=N, name='Postgres')` and `(id=N+1, name='postgres')`.
- The `tag_name_unique` partial index does NOT collapse them because Postgres `text` comparison is byte-exact.
- The case-insensitive `query='postgres'` returns BOTH rows in the popular list.

## Pass / fail criteria

- **DRIFT confirmed (PASS for the probe; FAIL for UX)**: two tag rows exist with names `Postgres` and `postgres` differing only by case. The popular-tags response shows both.
- **DRIFT NOT confirmed (probe inconclusive)**: only one row created OR a unique-constraint exception on the second insert. This would contradict the static reading and warrant a deeper investigation of the actual DB collation.

## On confirmation

The drift is genuine UX inconsistency: the UI's case-insensitive tag-search facet implies tags are case-folded, but the directory's case-sensitive uniqueness allows case-only duplicates. Refactoring scope: either (a) case-fold at write (apply `LOWER(name)` in `bulkCreate` + `ingestData`), (b) case-fold the partial unique index to `(lower(name))`, or (c) document the case-sensitivity invariant clearly in the user-facing docs and the OpenAPI description for `POST /api/tags`.

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:144-159`
- Repository: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTagRepositoryImpl.java:104` (listByNames)
- Schema: `odd-platform-api/src/main/resources/db/migration/V0_0_64__remove_is_deleted_field.sql:105` (partial unique index)
