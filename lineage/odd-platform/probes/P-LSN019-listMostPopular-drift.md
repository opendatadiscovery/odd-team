---
probe_id: P-LSN019-listMostPopular-drift
source_node: odd-platform java service:TagServiceImpl
source_finding: S-B-1 (Stress Protocol Category B — name-behaviour drift)
related_lsn: LSN-019 (Stress Protocol canary batch)
status: skeleton-emitted
canary_batch: true
---

# P-LSN019-listMostPopular-drift

## What we're testing

`TagServiceImpl.listMostPopular(query, ids, page, size)` (`TagServiceImpl.java:72-77`) — a pass-through to `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`) — promises "list the most popular tags". The empirical claim under test: the endpoint returns the OLDEST `size` tags (by `tag.id ASC`) re-ordered by `usage_count DESC` within that window, NOT the `size` tags with the highest global `usage_count`.

Static evidence chain:
- `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)` at `ReactiveTagRepositoryImpl.java:148` — inner pagination orders by `TAG.ID ASC` then `LIMIT size`.
- `orderBy(field(COUNT_FIELD).desc())` at `:158` — outer CTE re-orders the already-selected `size` rows by descending count.

## Setup

1. Live demo environment: `demo.oddp.io` (or local equivalent).
2. Tag directory size: must be greater than `size` for the drift to manifest (size=30 default → need ≥31 tags). The maintainer's 2026-05-20 test against demo.oddp.io confirmed this condition was met.
3. Auth: any authenticated user under `LOGIN_FORM | OAUTH2 | LDAP` (the read endpoint has NO SecurityRule per `SecurityConstants.java`).

## Procedure

1. Seed the directory with N=60 tags where `tag.id = 1..60` and `usage_count = 60 - id` (newest tag has lowest usage; oldest tag has highest usage). The relation tables `tag_to_data_entity` + `tag_to_dataset_field` are populated to reflect the usage_count.
2. `GET /api/tags/popular?page=1&size=30`.
3. Capture the returned `items[].id` list.

## Expected behaviour (if name-behaviour were aligned)

- If `listMostPopular` returned the GLOBALLY most popular tags, the response would contain tag ids `1..30` (the oldest tags, which have the highest usage_count by construction). Note: this case happens to coincide with the drift behaviour when usage and age are inversely correlated, so a more discriminating test is below.

## Expected behaviour (per static reading)

- The inner pagination selects ids `1..30` (lowest ids, oldest tags).
- The outer sort re-orders by count_desc → for the construction above, count is `60-id`, so the order within the window is `id=1` (count=59), `id=2` (count=58), …, `id=30` (count=30).
- This matches "GLOBALLY most popular" in this construction.

## Discriminating test (the real probe)

Re-seed with N=60 tags where `usage_count` is HIGHEST for the NEWEST tags (id 31..60 have count ≥ id 1..30). Specifically: `usage_count(id) = id` (newer tags more popular).

- If `listMostPopular` is truly global-popular: returns ids `60, 59, …, 31` (the 30 with highest counts).
- If the drift holds: returns ids `1..30` (the oldest tags) re-sorted by count_desc within the window → `id=30, 29, …, 1`.

**Expected outcome per static reading: drift holds — response = `[30, 29, …, 1]`, not `[60, 59, …, 31]`.**

## Maintainer's empirical confirmation (2026-05-20)

Per the LSN-019 canary brief, the maintainer's 2026-05-20 test against demo.oddp.io confirmed the endpoint returns "the OLDEST 30 tags by creation_at ASC, not the 30 with highest usage_count, despite the method chain being named 'most popular' at every layer." The probe formalises this evidence for regression-protection.

## Pass / fail criteria

- **Drift confirmed (FAIL the implicit "most popular" contract)**: the response's `items[0].id` is the LOWEST id in the directory (oldest tag), not the highest-usage tag.
- **Drift NOT confirmed**: the response's `items[0].id` is the highest-usage tag globally.

## On confirmation

Refactoring scope: REFACTOR-NNN (to be assigned by the maintainer) — the fix is either (a) push the COUNT-DESC ordering INTO the `paginate(...)` call (replace `OrderByField(TAG.ID, SortOrder.ASC)` with `OrderByField(COUNT_FIELD, SortOrder.DESC)` — but COUNT_FIELD is only available after the CTE materialisation, so this requires query restructure), or (b) rename the method to `listOldestTagsReorderedByUsage` to match behaviour, or (c) accept the drift and document it as the intentional posture (which would contradict the public-facing UX promise).

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:72-77`
- Repository drift: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTagRepositoryImpl.java:137-167`
- Existing sidecar: `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTagRepositoryImpl.md`
- Brief: LSN-019 canary batch (the maintainer's 2026-05-20 test)
