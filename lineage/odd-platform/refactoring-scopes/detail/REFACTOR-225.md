## REFACTOR-225 — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` — owner-scoping is a single-point-of-failure at the anchor set (no JOIN-side defence-in-depth)

**Severity**: MEDIUM
**Category**: missing-defence-in-depth
**Surfaced by**:
- `getMyObjects.md:bugs_limitations_corner_cases[5]`
- `getMyObjects.md:security.known_security_gaps[2]`

**Description**: The lineage variants of `/my` (`getMyObjectsWithUpstream` / `getMyObjectsWithDownstream`) use a DIFFERENT code path from the base `/my`. They call `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns(streamKind)` which: (a) fetches the user's owned data entities (anchor — owner-scoped), (b) traverses the lineage graph one hop (`lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), streamKind)`), (c) returns the reached oddrns FILTERED to exclude the originally-owned set (`Predicate.not(oddrns::contains)` at line 37). Then `repository.listByOddrns(oddrns, false, false, page, size)` returns those non-owned entities WITHOUT applying any owner filter at the SQL — the assumption is that the input oddrn set is already scoped correctly. **A regression in (a) — e.g. `fetchAssociatedOwner()` returning a wrong owner, or the WebFilter dropping the principal — leaks unscoped lineage neighbours.** The owner-scoping invariant is therefore SINGLE-POINT-OF-FAILURE at `DataEntityRelationsServiceImpl.java:26` for the lineage variants, vs. defended at the JOIN-side WHERE clause for the base `/my` path. Latent today: the code is correct; the gap is the missing defence-in-depth.

**Primary source citations**:
- `DataEntityRelationsServiceImpl.java:25-31` (the lineage anchor; owner-scope at the entry only)
- `DataEntityServiceImpl.java:219-225` (the post-listAssociated chain)
- `ReactiveDataEntityRepositoryImpl.java:listByOddrns` (no `ownership.owner_id` JOIN filter)
- contrast with `ReactiveDataEntityRepositoryImpl.java:526-527` (the base `/my` JOIN-side defence)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-015 (Owner-scoped routes) documents the architecture but doesn't articulate the defence-in-depth requirement. The base `/my` path defends at the JOIN; the lineage variants defend only at the anchor — the asymmetry is undocumented.

**Proposed remedy**: Add a JOIN-side filter to `listByOddrns` when the consumer context is owner-scoped — OR add a service-layer assertion that the input oddrns are owner-scoped. The simpler remedy: pass an `Optional<OwnerId>` through the lineage-expansion path and apply the filter at the SQL. A regression test should: (a) mock `fetchAssociatedOwner()` to return a different owner, (b) assert the lineage variants emit empty Flux (or 403) rather than leaking neighbours.

**Severity rationale**: MEDIUM — latent vulnerability; the code is correct today but a future refactor that introduces a fallback owner-id (or that misorders the WebFilter chain) would surface the gap. The defence-in-depth principle says don't trust a single anchor when the consequence is cross-owner data exposure.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Pair with REFACTOR-217 (the path-mismatch on terms — both are "the rule fires correctly at one place; what defends if it doesn't?" failures).

---
