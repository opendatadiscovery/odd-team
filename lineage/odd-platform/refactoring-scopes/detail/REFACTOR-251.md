## REFACTOR-251 — `DataEntityServiceImpl.updateStatus` partial-failure window: validation + propagation fan-out run OUTSIDE the transaction

**Severity**: LOW (rare in practice)
**Category**: transactional-consistency
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[2]`

**Description**: `DataEntityServiceImpl.updateStatus` (lines 458-481) is the ONE mutating method on this service that doesn't carry `@ReactiveTransactional` at this tier (per ADR-CANDIDATE-067 + ADR-CANDIDATE-058). Instead, the transaction is delegated to `DataEntityInternalStateServiceImpl.changeStatusForDataEntities` (`DataEntityInternalStateServiceImpl.java:75`). The decision is structural — the rich per-status-transition logic (soft-delete vs restore vs simple transition) warrants its own service method one tier deeper; the txn boundary follows the logic rather than the orchestration.

BUT the orchestration at this layer does NON-TRIVIAL work BEFORE the inner txn opens:
- Line 462-465: status validation (transitions allowed, soft-delete eligibility check).
- Line 466-477: propagation fan-out — collect the list of pojos to update (the target entity + any group-member entities that propagate the status change).

If the propagation fan-out succeeds (collected N pojos to update) but the downstream transaction at `changeStatusForDataEntities` fails partway through `bulkUpdate(updatedPojos)`, the propagation collection is left in a "I computed the work but didn't commit any of it" state. There is no compensating rollback at this layer — the txn rolls back only its own scope (the bulkUpdate is atomic per Postgres semantics, so all-or-nothing within the inner txn; but the OUTER layer's collection of pojos is just an in-memory list that's lost without persistence).

Today this is LOW severity because:
- `bulkUpdate` is a single SQL statement (atomic per Postgres MVCC) — either all rows update or none do.
- The validation + propagation fan-out before the txn are pure reads / computations; no DB state is mutated outside the txn.

The latent risk: a future refactor that adds DB writes between the validation and the inner txn (e.g. an "audit-the-pending-status-change" write) would expose the partial-failure window. The pattern is fragile because the maintainer has to remember "no writes before the inner txn opens."

**Primary source citations**:
- `DataEntityServiceImpl.java:458-481` — no @ReactiveTransactional at this layer
- `DataEntityInternalStateServiceImpl.java:74-75` — the inner @ReactiveTransactional begins at the downstream call
- `DataEntityInternalStateServiceImpl.java:92` — the bulkUpdate inside that downstream txn
- composes with ADR-CANDIDATE-067 (txn boundary asymmetry — updateStatus is the deliberate exception where the txn lives one tier deeper)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 captures the architectural choice; the gap is the absence of a defending comment at `DataEntityServiceImpl.java:458` explaining "the validation + propagation are deliberately outside the txn because they're pure-read computations; future writes must be moved INSIDE the inner txn or this service tier must be wrapped." The fix is documentation / convention, not refactoring.

**Proposed remedy**: Two options:
1. **Defend the pattern with a code comment** at line 458 explaining the intent and the future-write invariant.
2. **Hoist the inner txn to this layer** — add `@ReactiveTransactional` to `updateStatus` at line 458. The Spring transaction manager will compose the existing inner annotation with the outer one (PROPAGATION_REQUIRED is the default). Cost: one extra annotation; benefit: defence-in-depth against future writes leaking outside.

Option (2) is cleaner but slightly redundant; option (1) preserves the current architectural intent.

**Severity rationale**: LOW — no observed bug in practice (bulkUpdate is atomic; nothing else is written outside the inner txn today). The gap is the future-write fragility.

**Suggested backlog grouping**: `Code-comment hygiene sprint` — bundle with REFACTOR-249 and other intent-anchor-comment gaps.

---
