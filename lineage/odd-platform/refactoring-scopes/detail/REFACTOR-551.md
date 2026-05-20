## REFACTOR-551 — `TagServiceImpl.deleteRelationsWithTerm` multi-step read+write WITHOUT `@ReactiveTransactional` — concurrent term-tag-add can be silently dropped from delete-set

**Severity**: MEDIUM
**Category**: transactional-consistency (race-condition)
**Surfaced by**:
- `TagServiceImpl.md:bugs_limitations_corner_cases[deleteRelationsWithTerm-no-tx]` (MEDIUM) — "A concurrent write to `tag_to_term` between the read at :126 and the write at :132 will not be detected; if a tag is added to the term concurrently, the just-added relation will not be in the `currentTags` collection and will not be deleted... unlike the other multi-statement non-TX methods (`getOrCreateTagsByName`, `getOrInjectTagByName`) [which] have race protections in the underlying repository (unique-constraint or ON CONFLICT DO UPDATE); `deleteRelationsWithTerm` has neither"
- `TagServiceImpl.md:stress_findings.S-E-1[i]` ("`deleteRelationsWithTerm` is multi-step read+write WITHOUT `@ReactiveTransactional` — possible race; severity MEDIUM")
- `TagServiceImpl.md:invariants[multi-step writes without @ReactiveTransactional]`
- `TagServiceImpl.md:implicit_adrs[3]` (frames it as the EXCEPTION to the multi-step-write-needs-TX pattern — the inconsistency is logged as ambiguous; this REFACTOR is the GAP framing)

**Description**: `TagServiceImpl.deleteRelationsWithTerm(long termId, Set<String> tagsToKeep)` (`:123-134`) is a TWO-step multi-statement DB operation:
1. `reactiveTagRepository.listByTerm(termId)` (line 126) — READ all tag relations for the term
2. Compute `idsToDelete = currentTags.filter(t -> !tagsToKeep.contains(t.getName())).map(TagPojo::getId)` (lines 128-130) — in-memory difference
3. `reactiveTagRepository.deleteTermRelations(termId, idsToDelete)` (line 132) — WRITE the deletes

The method has NO `@ReactiveTransactional` annotation, despite being a multi-statement read-then-write. The other multi-step services in `TagServiceImpl` follow a consistent pattern:
- `update`, `delete`, `updateRelationsWithDataEntity`, `createRelationsWithTerm` — ALL carry `@ReactiveTransactional` (lines 45, 58, 97, 137)
- `getOrCreateTagsByName`, `getOrInjectTagByName` — DON'T carry it, but the race is silenced by the underlying repository (unique-constraint exception OR `ON CONFLICT DO UPDATE`)
- `deleteRelationsWithTerm` — DOESN'T carry it AND has NO underlying race protection

**Operator-visible consequence** (concurrent race scenario): 
- TX1: `PUT /api/terms/{termId}/tags` with `tagsToKeep = {A, B, C}` — currently the term has `{A, B, C, D}`; TX1 reads current state, computes "delete D"
- TX2 (concurrent): `PUT /api/terms/{termId}/tags` with `tagsToKeep = {A, B, C, E}` — currently the term still has `{A, B, C, D}` (TX1 hasn't committed); TX2 reads current state, computes "delete D"; TX2 then calls `getOrCreateTagsByName({E})` and links E
- TX1 commits `delete D`
- TX2 commits `delete D` AND `link E`

Both TXs computed the delete set from a stale read. The race is benign in this case (both wanted D deleted). The TRUE race surfaces when:
- TX1: `PUT /api/terms/{termId}/tags` with `tagsToKeep = {A, B, C}` (the user's intent: remove anything else; D is the only "anything else" right now)
- TX2 (concurrent): `POST /api/terms/{termId}/tags` (a different endpoint OR direct service call) that ADDS tag E to the term — TX2 commits FIRST
- TX1 then computes "remove anything not in {A, B, C}" from a snapshot taken BEFORE TX2's commit → delete-set = `{D}` (NOT `{D, E}`)
- TX1 commits delete of D
- Term ends up with `{A, B, C, E}` instead of the user's intended `{A, B, C}`

The just-added relation (E) is INVISIBLE to TX1's delete computation and SURVIVES TX1's clean-up. The user who clicked "save" expecting only {A, B, C} sees {A, B, C, E} after refresh.

**Why this isn't caught by the existing repository race protections**: 
- `deleteTermRelations(termId, idsToDelete)` operates on the IDs computed from TX1's stale snapshot.
- There is no `tag_to_term` unique-constraint that would flag the race (E's row exists; it's not being inserted by TX1).
- `ON CONFLICT DO UPDATE` doesn't apply (no UPSERT in the delete path).
- READ COMMITTED isolation does NOT prevent the lost update; only the PostgreSQL-level "REPEATABLE READ" or higher would (and even those would surface a serialization failure rather than silently dropping).

**Primary source citations**:
- `TagServiceImpl.java:123-134` (deleteRelationsWithTerm — no `@ReactiveTransactional`, multi-statement read+write)
- `TagServiceImpl.java:45` (update — HAS `@ReactiveTransactional`)
- `TagServiceImpl.java:58` (delete — HAS `@ReactiveTransactional`)
- `TagServiceImpl.java:97` (updateRelationsWithDataEntity — HAS `@ReactiveTransactional`)
- `TagServiceImpl.java:137` (createRelationsWithTerm — HAS `@ReactiveTransactional` even for single-statement)
- The inconsistency between `:124` and `:97` is the anchor: both are multi-step read+write on relation tables; `:97` IS transactional; `:124` is NOT.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (`@ReactiveTransactional` boundary asymmetry — list-shaped reads stay OUTSIDE TX; per-resource writes ARE INSIDE TX) prescribes that multi-step writes carry `@ReactiveTransactional`. `deleteRelationsWithTerm` is a multi-step write that VIOLATES this prescription. The violation is either a bug (missing annotation) or an undocumented intent (e.g. "term-tag updates are not concurrent in practice" — but no comment defends this).

**Proposed remedy**: Two options:

1. **Add `@ReactiveTransactional`**: One-line addition at `TagServiceImpl.java:123`. The read and the write run in a single TX; READ COMMITTED ensures TX1 sees TX2's commits or doesn't, NOT mid-state. The race becomes a lost-update (the LAST writer wins) instead of a silent partial drop. UX trade-off: the user's intent is honored if their TX is the LAST commiter; concurrent updates can still produce surprise but the surprise is bounded by "last writer wins" rather than "intermediate writer's adds survive even when explicitly excluded".

2. **Add explicit row-level locking**: Use `SELECT ... FOR UPDATE` on the `tag_to_term` rows for the termId at the read step. Trade-off: per-update locking; throughput penalty for term-tag-update concurrency (rare in practice).

**Recommended**: Option 1. The maintainer should also add a contract test asserting that concurrent term-tag adds are NOT silently dropped (`TagServiceImplTest.testDeleteRelationsWithTerm_ConcurrentAdd_NotDroppedFromDelete`). The test scaffolding is `StepVerifier.create(...)` with `Mono.zip(...)` of the two concurrent operations.

**Severity rationale**: MEDIUM — the race is real and the user-visible consequence is "your save dropped a concurrent add silently" — a UX defect with low frequency (term-tag updates are not concurrent under typical workload). The fix is a one-line annotation; the cost is near-zero; the alignment with ADR-CANDIDATE-067 is positive. The severity is bounded by the rarity of concurrent term-tag updates on the same term.

**Suggested backlog grouping**: SEC-NNN concurrency-hardening sprint (paired with REFACTOR-549 TOCTOU). The Tag-tier instance of "multi-step write without TX" pattern; the maintainer's choice to fix it is also a signal for the cross-cutting pattern "every multi-step write needs `@ReactiveTransactional`."

---
