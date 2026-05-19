## REFACTOR-270 — Empty roles list silently routes through non-admin branch via vacuous `noneMatch` on empty stream; a future refactor flipping the test would silently route empty-role users to the admin path

**Severity**: LOW
**Category**: refactor-risk (no observed bug)
**Surfaced by**:
- `PolicyServiceImpl.md:bugs_limitations_corner_cases[4]`

**Description**: `PolicyServiceImpl.list` (line 55) tests `roles.stream().noneMatch(r -> r.pojo().getName().equals("Administrator"))`. For an EMPTY roles list, `.noneMatch(...)` returns TRUE (vacuous truth — Java Stream API semantics). The `.map(roles -> getRolePolicies(...))` branch is taken; the empty-roles user routes through the in-memory non-admin path; `getRolePolicies(emptyList, query)` returns an empty `Page` (no policies at all).

The intent — "a user with no roles sees no policies" — is structurally correct. An empty-roles user has no policies via the role-binding mechanism, and the in-memory branch correctly returns empty.

The FRAGILITY: the `noneMatch` test is the ONLY thing keeping the empty-roles invariant. A future refactor that flips the predicate (e.g. `.anyMatch(... "Administrator")` for a code-clarity improvement) would silently route empty-role users to the admin path — they would see EVERY policy in the platform. Java Stream API's `.anyMatch` on an empty stream returns FALSE; the negation pattern `!.anyMatch(...)` would also return TRUE for empty, but a refactor that uses `.anyMatch(...)` WITHOUT the negation would invert.

A REGRESSION TEST pinning the empty-roles → empty-Page contract is the right defence. No test currently exists (verified by the sidecar's exhaustive grep on PolicyService tests returning ZERO matches).

**Primary source citations**:
- `PolicyServiceImpl.java:52-60` — the branching list method
- Java Stream API `noneMatch` semantics (vacuous truth on empty stream)
- composes with REFACTOR-269 (the pagination gap on the in-memory branch)

**Existing-ADR-or-implied-prescription**: none. The empty-roles handling is implicit in the test logic. The fix is a regression test.

**Proposed remedy**: Two composable fixes:
1. **Defending comment** at line 55:
   ```java
   // A user with NO roles still routes through the non-admin branch (noneMatch on
   // empty stream is vacuously true). This is intentional: empty-roles users see
   // no policies. A future refactor flipping the predicate (e.g. .anyMatch) would
   // silently route empty-roles users to the admin path, exposing every policy.
   .map(user -> user.roles().stream().noneMatch(r -> r.pojo().getName().equals(ADMINISTRATOR_POLICY)))
   ```
2. **Regression test**: add a test pinning the empty-roles → empty-Page contract. The test creates a user with NO roles, invokes `policyService.list(page, size, query, user)`, and asserts the result is `Page.empty()`.

The two fixes are independent; either closes the refactor-risk gap.

**Severity rationale**: LOW — no observed bug; the gap is the future-refactor fragility. The current behaviour is correct.

**Suggested backlog grouping**: `Code-comment hygiene sprint` — pair with REFACTOR-249, REFACTOR-251, REFACTOR-261, REFACTOR-263. The intent-anchor-comment gaps are a cross-cutting cluster.

---
