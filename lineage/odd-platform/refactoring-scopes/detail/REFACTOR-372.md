## REFACTOR-372 — `extractOwnershipRelation` throws `IllegalArgumentException` on missing ownerDict/titleDict references — corruption of `term_ownership` (e.g., owner row deleted without `ON DELETE CASCADE`) surfaces as 5xx with stack-trace-leaking message

**Severity**: LOW
**Category**: error-mapping (corrupt-row handling)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[3]`

**Description**: `ReactiveTermRepositoryImpl.extractOwnershipRelation` (lines 595-602) processes `jsonArrayAgg(term_ownership.*)` results into typed `OwnershipDto` objects. The method looks up referenced `owner_id` and `title_id` in pre-fetched dictionary maps. If a `TermOwnershipPojo` references an `owner_id` not in the ownerDict (or a `title_id` not in the titleDict), the method throws `IllegalArgumentException("There's no owner with id %s found in ownerDict")`.

The exception traverses the reactor error channel to the controller advice, where it surfaces as a 5xx response with a stack-trace-leaking message. **Realistic trigger**: a database UPDATE deleting an `owner` row while a Term still has a `term_ownership` referencing it. V0_0_35:38-40 declares term_ownership FKs WITHOUT `ON DELETE CASCADE` — orphan term_ownership rows are possible.

The defensive throw is correct SEMANTICALLY (the data is corrupted) but the user-visible result is a 5xx rather than a clean 404 or 502.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:581-608` — extractOwnershipRelation throws
- `V0_0_35__add_terms.sql:30-44` — term_ownership FKs without CASCADE

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-071 (centralised DB-error translation) prescribes the typed-exception pattern. This scope is the application-layer-thrown-IllegalArgumentException equivalent that bypasses the translation layer.

**Proposed remedy**:
1. **Add ON DELETE CASCADE to V0_0_NNN migration** — owner deletion cascades to term_ownership removal. Prevents the corrupt-row case structurally.
2. **Catch IllegalArgumentException at the service tier** — convert to a 502 BAD_GATEWAY with a clear message; preserves the architecture's defensive-throw.
3. **Skip the corrupt row in the aggregation** — `extractOwnershipRelation` logs a warning and SKIPS the orphan; the Term renders without the broken ownership. Trade-off: silent data-loss in the response.

Option 1 is the cleanest; Option 2 is the smallest blast radius.

**Severity rationale**: LOW — corrupt-row case; rare in practice; no security impact. Worth fixing for operator UX (clean 502 vs 5xx with stack trace).

**Suggested backlog grouping**: `Schema-cleanup batch` — pair with the FK-cascade audit for V0_0_NNN.

---
