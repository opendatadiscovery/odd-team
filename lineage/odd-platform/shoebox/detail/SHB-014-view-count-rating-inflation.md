# SHB-014 — `view_count` as ungated popularity-rating channel (any caller inflates any entity to the top of Popular)

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators see a "Popular Entities" recommendation panel on the catalog Overview page (the F-003 Popular Entities feature) where the ranking is `view_count DESC` filtered by `EXCLUDE_FROM_SEARCH=false`. The `view_count` column is incremented by **every** successful `GET /api/dataentities/{id}` call — and that GET endpoint has NO authorization rule, no rate-limit, no idempotency check, no per-IP throttle, AND under `auth.type=DISABLED` is anonymous. ANY authenticated user (and any anonymous DISABLED-mode caller) can script a `for id in 1..N: GET /api/dataentities/{id}` loop to push ANY entity to the top of the Popular panel arbitrarily fast. F-001 (Detail-page view tracking) anchors the GET; F-003 (Popular Entities Ranking) anchors the ranking; **neither F-NNN names the inflation loop the two together create** — the producer side (F-001) writes the counter the consumer side (F-003) ranks on.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:197` — `@ReactiveTransactional` on `getDetails`. Line 199-208 chains `incrementViewCount` into the pipeline.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:488-495` — `incrementViewCount(DataEntityDetailsDto)` calls `reactiveDataEntityRepository.incrementViewCount(id)` unconditionally on every successful read.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:173-180` — the UPDATE: `UPDATE data_entity SET view_count = view_count + 1 WHERE id = ?` with `.returningResult(...)` so the new value reflects into the response.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:139-147` — the GET handler. No `@PreAuthorize`, no rate-limit annotation.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:307-313` — `getPopular` consumer endpoint that ranks by `view_count`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:227-231` — `listPopular` service method (1-line pass-through to repo's `listPopular`).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:98-355` — no SecurityRule for `GET /api/dataentities/{id}` (the GET path is not in the list — only mutations are listed).
- F-003 anchors the Popular Entities Ranking surface — the `EXCLUDE_FROM_SEARCH` filter is in scope, the view_count source is NOT.
- F-001 anchors the Detail-page view tracking — the WRITE side of view_count.

## Notes

- **The inflation loop is trivial to exploit**: a scripted `for id in 1..1000000: curl -H "Authorization: ..." https://platform/api/dataentities/$id` runs at network speed; each request increments `view_count` for that id by 1 inside a single transaction. After N requests against id=42, entity 42 is on top of Popular Entities.
- **Under auth.type=DISABLED, the loop is anonymous**. No authentication required, no audit trail of who incremented what.
- **Anti-abuse signals absent**:
  - No client-id-based debouncing (same user pinging the same entity in rapid succession all count)
  - No IP-based rate-limit
  - No idempotency key
  - No "the same user can only inc by 1 per hour" anti-flood
  - No anomaly detection (e.g. 10K reads from one IP in 5 seconds)
- **Operational impact**:
  - F-003's Popular panel becomes adversarial-content-friendly. A malicious actor promotes a misleading entity (e.g. a deprecated dataset with sensitive descriptions) to the top of the panel, where new users click first.
  - The view_count UPDATE makes the GET endpoint NOT idempotent at the DB layer. Read replicas cannot serve this GET. Browser refresh / network retry doubles the count. The platform's hottest read is permanently primary-only.
  - Row-level write contention on `view_count` for popular entities (e.g. an entity hit by hundreds of users daily) scales as O(reads). At scale, the hot row becomes a write-throughput bottleneck on what is nominally read.
  - Audit trail confusion: a forensic analyst trying to determine "did this entity get viewed 10K times because operators care, or because someone scripted it?" has no signal.
- **Why this is its own SHB rather than a facet of F-001 / F-003**: F-001 names the WRITE; F-003 names the READ; the EMERGENT FEATURE — "popularity ranking that is inflatable by any caller" — is the inflation LOOP the two endpoints form together. The maintainer should consider whether F-003 should retire / change ranking algorithm OR a defence layer is added.
- **Defences worth considering**:
  - Batch the increment via an async queue (lose strict monotonicity, gain write-replica friendliness)
  - Sample-and-aggregate (increment with probability 1/N to bound the write rate)
  - Per-(user, entity, hour) idempotency to bound the inflation rate
  - Move view_count to a separate counter table or in-memory aggregated counter flushed periodically
  - Add audit logging on view_count increments to trace adversarial use

## Next

1. **SEC-NNN — MEDIUM** — design + implement an anti-inflation layer on the view_count → Popular ranking loop. Options enumerated above; recommendation: per-(user, entity, hour) idempotency layer (Redis or DB-side dedup table) so a given user can only contribute one view per entity per hour to the count.
2. **REFACTOR-NNN — MEDIUM** — for read-replica enablement (a future scaling concern), decouple the view_count UPDATE from the GET transaction. Async fire-and-forget via a Sink + scheduled flush is the standard pattern.
3. **DOC-NNN — LOW** — F-001 / F-003 docs should disclose the view_count source and the lack of anti-inflation. Operators evaluating the Popular ranking should know whether it's trustworthy.
4. **TEST-NNN — MEDIUM** — a "popularity inflation" integration test: simulate 1000 GETs from one user on one entity, assert that entity does NOT jump to the top of `getPopular`. Today it does.
5. **Cluster** with F-001 + F-003 — the three together form the complete view-count feature surface. May graduate to its own F-NNN if the maintainer decides the inflation channel is a distinct feature; OR merge into F-003 as a drift facet.

## Links

- cluster_with: [F-001, F-003]
- merged_into: F-003
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — F-001 (write side) +
  F-003 (read/rank side) jointly anchor the view_count loop. F-003 is
  the better merge target because the EMERGENT FEATURE — popularity
  ranking inflatable by any caller — is the RANKING surface; F-001 is
  the upstream contributor already enumerated in F-003's chain.
  Appended drift_class `view_count_ungated_popularity_inflation_loop`
  (MEDIUM) to F-003 with full operational_impact + fix_shape options
  (per-user-entity-hour idempotency layer is the recommended fix).
  Per SHB-014's Next step 5: "May graduate to its own F-NNN if the
  maintainer decides the inflation channel is a distinct feature; OR
  merge into F-003 as a drift facet" — merged to F-003 per the
  default-best-practice "bug-shaped findings become drift_class facets,
  NOT standalone features."
