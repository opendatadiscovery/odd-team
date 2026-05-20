---
probe_id: P-LSN019-getOrCreate-vs-getOrInject-toctou
source_node: odd-platform java service:TagServiceImpl
source_finding: S-B-4 (Stress Protocol Category B — name-behaviour drift, race semantics)
related_lsn: LSN-019
status: skeleton-emitted
---

# P-LSN019-getOrCreate-vs-getOrInject-toctou

## What we're testing

The two near-identical methods:
- `TagServiceImpl.getOrCreateTagsByName(tagNames)` (`:79-86`) — uses `bulkCreate` (fail-on-duplicate).
- `TagServiceImpl.getOrInjectTagByName(tagNames)` (`:88-94`) — uses `ingestData` (upsert with `ON CONFLICT DO UPDATE`).

The empirical claim under test: TWO concurrent calls submitting the SAME novel name will:
- For `getOrCreateTagsByName`: one succeeds, one throws `UniqueConstraintException("Tag with this name already exists")`.
- For `getOrInjectTagByName`: both succeed, BOTH receive the SAME `tag.id` (the upsert returns the existing row for the loser).

Static evidence:
- `getOrCreateTagsByName` calls `bulkCreate` → inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`:113-126`) → INSERT without `ON CONFLICT` → unique-constraint error → translated to `UniqueConstraintException` via `ExceptionUtils.translateDatabaseException`.
- `getOrInjectTagByName` calls `ingestData` → `INSERT ... ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = excluded.name RETURNING *` (per `ReactiveTagRepositoryImpl.java:191-213` and existing repository sidecar) → both callers' RETURNING clause produces the same row.

## Setup

1. Live demo environment.
2. Empty `tag` directory or precondition: no tag named `racing-novel-name`.
3. Two concurrent HTTP clients (or two coroutines).
4. Auth:
   - Client A: user with `DATA_ENTITY_TAGS_UPDATE` (path uses `getOrCreateTagsByName` indirectly via `updateRelationsWithDataEntity`).
   - Client B: Collector-style S2S call with `auth.ingestion.filter.enabled=true` + a valid Collector token (path uses `getOrInjectTagByName`).

## Procedure A — `getOrCreateTagsByName` race (UI vs UI)

1. Two clients both with `DATA_ENTITY_TAGS_UPDATE` on different data entities X1, X2.
2. Submit simultaneously:
   - Client A: `PUT /api/dataentities/X1/tags` with `{"tagNames": ["racing-novel-name"]}`.
   - Client B: `PUT /api/dataentities/X2/tags` with `{"tagNames": ["racing-novel-name"]}`.
3. Inspect both responses.

## Expected behaviour (per static reading)

- One client (let's say A) returns 200 OK with the new tag attached to X1.
- Other client (B) returns 400 Bad Request with body containing `UniqueConstraintException` translated to HTTP error per Spring's exception handlers.

## Procedure B — `getOrInjectTagByName` race (Collector vs Collector)

1. Two Collector-style requests with the same payload containing `dataset.tags = ["racing-novel-name"]` for different data entities X1, X2.
2. `POST /ingestion/entities` from both, simultaneously.
3. Inspect both responses + subsequent `GET /api/tags/popular?query=racing-novel-name`.

## Expected behaviour (per static reading)

- Both responses are 200 OK (no exception propagated).
- `GET /api/tags/popular?query=racing-novel-name` returns ONE row (single `tag.id`).
- Both X1 and X2 have `tag_to_data_entity` rows pointing at the SAME `tag.id`.

## Procedure C — Cross-race (UI vs Collector)

1. Client A: `PUT /api/dataentities/X1/tags` with `{"tagNames": ["racing-novel-name"]}` — UI side via `getOrCreateTagsByName`.
2. Client B: `POST /ingestion/entities` with `dataset.tags = ["racing-novel-name"]` for X2 — Collector side via `getOrInjectTagByName`.
3. Submit simultaneously.

## Expected behaviour

Per the static analysis: the path that wins (gets the INSERT through first) succeeds; the loser sees the conflict. If `getOrCreateTagsByName` wins, the Collector's `ingestData` `ON CONFLICT DO UPDATE` silently returns the existing row → Collector succeeds. If `getOrInjectTagByName` wins, the UI's `bulkCreate` hits unique-constraint → `UniqueConstraintException` → 400 to UI user.

The UI user's experience is therefore NON-DETERMINISTIC under cross-path concurrency: same input, different result depending on Collector timing.

## Pass / fail criteria

- **Both A and B match expectations**: confirms the asymmetric race semantics — recorded as the implicit posture; the UX trap (Procedure C's non-determinism) is the bug surface.
- **C: UI user gets 400 some fraction of the time when Collector races**: confirms the bug surface. Recorded as REFACTOR-NNN candidate (the maintainer's call: either make `getOrCreateTagsByName` use upsert semantics too, or catch `UniqueConstraintException` in the UI write paths and retry).

## On confirmation

This is a known TOCTOU surface logged in the sidecar's `bugs_limitations_corner_cases` (severity: HIGH). The probe formalises the empirical evidence. Refactoring scope: align `getOrCreateTagsByName` with `getOrInjectTagByName`'s upsert semantics OR document the race posture explicitly in the OpenAPI spec for every side-door endpoint.

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:79-94`
- Repository: `ReactiveAbstractCRUDRepository.java:113-126` (inherited bulkCreate) + `ReactiveTagRepositoryImpl.java:180-213` (ingestData upsert)
- Exception: `ExceptionUtils.java:54-56` (UniqueConstraintException translation)
