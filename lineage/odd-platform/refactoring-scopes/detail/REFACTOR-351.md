## REFACTOR-351 — `search_facets` side-effect UPDATE on every read — every facet GET is a WRITE — `last_accessed_at` is updated on every `get(id)` call but the field is NEVER consulted by any housekeeping job; the design implies a future TTL eviction that never landed

**Severity**: LOW
**Category**: dead-code-write (side-effect read posture)
**Pillars affected**: [P-01-data-discovery]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-method__facets.md:bugs_limitations_corner_cases.[5]` (LOW) — "**`fetchFacetState` does a side-effect UPDATE of `last_accessed_at` on every read (`ReactiveSearchFacetRepositoryImpl.java:99-106`) — every facet GET is a WRITE.** Implications: (a) `GET /api/search/{search_id}` is NOT idempotent at the storage layer; (b) the side-effect UPDATE acquires a row lock; with concurrent UI tabs hitting the same session simultaneously, the write contention can stall; (c) the `last_accessed_at` field exists in the schema but is NEVER READ by any housekeeping job (`V0_0_52__introduce_housekeeping.sql`'s `search_facets` policy: there isn't one). The field is updated but useless — the design implies a future TTL eviction job that never landed (consistent with the `V0_0_1__init.sql:207` TODO `find a way to define TTL`). No comment, annotation, or surrounding code defends the side-effect read posture as intentional."
- `odd-platform__java__SearchController__controller-method__facets.md:performance.known_performance_gaps.[1]` (LOW)

**Description**: `ReactiveSearchFacetRepositoryImpl.get(UUID)` at lines 99-106 is an `UPDATE-RETURNING` against the `search_facets` table:

```java
return jooqReactiveOperations.mono(DSL.update(SEARCH_FACETS)
    .set(SEARCH_FACETS.LAST_ACCESSED_AT, currentOffsetDateTime())
    .where(SEARCH_FACETS.ID.eq(id))
    .returning())
.map(...);
```

Every read of a search session (`GET /api/search/{search_id}` + `GET /api/search/{search_id}/facet/{facet_type}`) triggers this UPDATE. The implications:

1. **Read endpoints are not idempotent at the storage layer**: HTTP semantics expect GET to be safe + idempotent; this endpoint is neither (a row is mutated on every call). Pure HTTP intermediaries assuming GET idempotency may cache responses unexpectedly.
2. **Row-lock contention on concurrent reads**: Each UPDATE acquires a row-level lock; concurrent UI tabs hitting the same session (e.g. user opens search in two tabs) serialise their facet reads behind the lock.
3. **The `last_accessed_at` field is never consulted**: `V0_0_52__introduce_housekeeping.sql` (the housekeeping framework introduction) has no policy for `search_facets`. Verified by grep — there is no `SearchFacetsHousekeepingJob.lastAccessedAt`-based cleanup, no scheduled task that evicts old rows by `last_accessed_at < now() - INTERVAL <TTL>`. The field exists in the schema (`V0_0_1__init.sql:204-211`), is updated on every read, but is never USED.
4. **The schema TODOs at V0_0_1__init.sql:206-207 acknowledge the gap**: `TODO: find more clever way to generate uuid` + `TODO: find a way to define TTL` — the TTL TODO is explicit; the side-effect UPDATE is the partial-implementation that prepared for a TTL eviction job that never landed.

**Concrete operator impact**:
- Wasted Postgres I/O — every facet read is a write; on a busy multi-user platform with 100s of facet calls per minute, the `search_facets` table is the second-hottest write target after the Activity feed.
- Row-lock latency under concurrent reads on the same session — typically negligible (sub-millisecond) but pathological under hot-tab refresh.
- Unbounded table growth (cross-link REFACTOR-352 NEW) compounds with this finding — the table grows forever AND every row is rewritten on every access.

**Primary source citations**:
- `ReactiveSearchFacetRepositoryImpl.java:99-106` (the UPDATE-RETURNING shape on `get`)
- `V0_0_1__init.sql:204-211` (the schema declaring `last_accessed_at`)
- `V0_0_1__init.sql:206-207` (the `TODO: find a way to define TTL` comment)
- `V0_0_52__introduce_housekeeping.sql` (verified by Grep: no `search_facets` policy)
- (cross-link) `SearchFacetsHousekeepingJob.java` — exists for `SearchFacets` cleanup; verify whether it consults `last_accessed_at` (to be checked by maintainer; sidecar reports absence based on Grep)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-121 NEW** (batch M — search-session bearer-token-shaped at schema layer) endorses the schema-level decision; this REFACTOR captures the partial-implementation gap — `last_accessed_at` exists but is wired only for write, not for read.

**Proposed remedy**: Two-path:

1. **Make the field actually drive TTL eviction** (preferred — uses the existing infrastructure):
   - Add a `SearchFacetsHousekeepingJob` (or extend the existing one if it exists) to `DELETE FROM search_facets WHERE last_accessed_at < now() - INTERVAL <ttl>`.
   - Add `housekeeping.ttl.search_facets_days` to `HousekeepingTTLProperties` (per batch D sidecar).
   - The existing UPDATE-RETURNING on every read is now functional: "active" sessions stay alive; "abandoned" sessions get cleaned up.
   - Operator-facing: document the TTL on the live `/features/data-discovery/search` page.

2. **Remove the side-effect UPDATE if TTL is not going to ship**: change `get(UUID)` to a pure SELECT; remove `last_accessed_at` from the schema (or leave it deprecated). The cost is a schema migration; the benefit is HTTP-idempotent reads + reduced write traffic.

Option (1) is the canonical fix — it completes the design implied by the V0_0_1__init.sql TODO. Option (2) is the cleanup if the TTL feature is deprioritised.

**Severity rationale**: LOW — wasted I/O + non-idempotent GET. Not MEDIUM because the operator-facing consequence is bounded (row-lock latency is negligible in typical use); not absent because the dead-code-write pattern is a maintenance burden that future maintainers must understand.

**Suggested backlog grouping**: `Search session hardening sprint` — couple with REFACTOR-344 NEW (search_facets has no user binding), REFACTOR-352 NEW (search_facets rows accumulate without bound), ADR-CANDIDATE-121 NEW (the architectural decision).

---
