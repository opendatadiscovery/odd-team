## REFACTOR-571 — `ActivityServiceImpl` has ZERO unit-test coverage — 273 lines of cross-cutting logic (view-mode dispatch, null-date validation, owner-axis resolution, system-event fallback, Mono.zip count aggregation, MY_OBJECTS silent-empty behaviour, asymmetric date-validation) all unguarded by regression tests

**Severity**: HIGH (regression-detection gap on a critical service)
**Category**: missing-test
**Surfaced by**:
- `ActivityServiceImpl.md:tests_coverage_semantic` (CANARY HEADLINE — "[] — **No test file exists for `ActivityServiceImpl` in `odd-platform-api/src/test/`**. Glob for `**/ActivityService*Test*.java` returns zero matches. The only Activity-related test is `ActivityMapperTest.java`... **Service-layer test coverage is ZERO**")
- `ActivityServiceImpl.md:tests_coverage_semantic.uncovered_behaviours[]` (12 specifically named behaviours that need regression tests)
- `ActivityServiceImpl.md:tests_coverage_semantic.gaps` ("A future refactor that, e.g., removed the `.switchIfEmpty(Mono.defer(() -> mapToPojo(event, time, null)))` block (line 49-50) would COMPILE, pass all existing tests, and silently fail every ingestion DATA_ENTITY_CREATED activity emit (because ActivityIngestionRequestProcessor runs without SecurityContext) — a critical audit-trail regression with zero CI signal")
- Glob `**/ActivityService*Test*.java` (returns ZERO matches under `odd-platform-api/src/test/`)

**Description**: `ActivityServiceImpl` (`:33-273`) is the central orchestration layer for the Activity feed feature. The service touches:

- The auth-context resolution + null-username fallback for system events (lines 46-49).
- The 4-way view-mode dispatch on `ActivityType` enum (lines 107-116).
- The asymmetric null-date validation between `getActivityList` and `getActivityCounts` (lines 98-100 vs 138-166).
- The `fetchAssociatedOwner()`-driven MY_OBJECTS owner-scoping (lines 184-199).
- The 4-way `Mono.zip` count aggregation (lines 138-166).
- The `getActivityHandler` linear-scan handler dispatch (lines 260-264).
- The `mapEventsToPojos` batch transformation (lines 266-272).

NONE of these behaviours has a unit test. The only Activity-related test in the repository is `ActivityMapperTest.java` (covers the MapStruct mapper layer only).

**12 specifically uncovered behaviours** (per the sidecar's `uncovered_behaviours[]`):

1. **System-event fallback null-username** (HIGH): no test asserts that `authIdentityProvider.getCurrentUser() == empty` → persisted `created_by = NULL`. A regression swapping to `"system"` string would silently change UI semantics.
2. **Provider-drop** (MEDIUM): no test asserts `UserDto.provider` is DROPPED in the persisted row. A regression mapping `UserDto::toString` would change the cross-mode-bleed semantics.
3. **Empty-list edge case for `createActivityEvents`** (LOW): no test asserts `createActivityEvents([])` is a no-op.
4. **`getActivityList` null-date validation** (HIGH): no test asserts `beginDate==null` throws `BadUserRequestException`. A regression removing validation surfaces as unbounded queries.
5. **`getActivityCounts` null-date acceptance** (MEDIUM): no test pins the current asymmetric behaviour OR asserts the desired symmetry.
6. **`ownerIds` dropped for non-ALL view modes** (MEDIUM): no test asserts the silent-drop is intentional.
7. **MY_OBJECTS silently empty for users without associated Owner** (HIGH): no test pins the `.switchIfEmpty(Flux.empty())` behaviour. A regression that started throwing or returning all activity would surface as 500 or permission bypass.
8. **`getDataEntityActivityList` no per-entity authz** (HIGH): no test pins the contract that ANY authenticated user reads ANY data entity's activity (REFACTOR-559 surface).
9. **`getActivityHandler` missing-handler RuntimeException** (MEDIUM): no test asserts the loud-fail.
10. **`Mono.zip` count cross-query consistency** (LOW): no test pins the intentional inconsistency.
11. **Activity emit rollback under @ActivityLog success** (HIGH): no test asserts the transactional coupling — a regression decoupling the TX would silently break audit consistency.
12. **`createActivityEvent` retry produces duplicates** (MEDIUM): no test pins the non-idempotency. A regression adding `ON CONFLICT` would change behaviour silently.

**Operator-visible consequence**: refactor risk is HIGH on this service. Any change that compiles and passes the mapper-only test could silently regress core feature behaviour. The Activity feed's reliability depends on a 273-line service that the CI cannot validate.

**Cross-cutting context**: This is the **untested-critical-service defect class**. Activity service is the orchestration layer for a HIGH-VISIBILITY feature (compliance-relevant audit log). A regression here has wide blast radius.

**Primary source citations**:
- `ActivityServiceImpl.java:33-273` (the entire service body — every method)
- `ActivityMapperTest.java` (the only Activity-related test — mapper-layer only)
- Glob `**/ActivityService*Test*.java` end-to-end (verified ZERO matches)
- The sidecar's `tests_coverage_semantic.uncovered_behaviours[]` (12 specifically named test cases)

**Existing-ADR-or-implied-prescription**: NONE. The platform has no general "every service has unit tests" requirement codified.

**Proposed remedy**:

Author `ActivityServiceImplTest.java` with the 12 named behaviours above, using:
- Mockito or test-doubles for `ReactiveActivityRepository`, `AuthIdentityProvider`, `DataEntityRelationsService`, `ActivityMapper`.
- StepVerifier from `reactor-test` for the Mono/Flux assertions.
- Each test method named after the behaviour from the `uncovered_behaviours[]` list.

Effort: ~3-5 hours for an experienced Reactor/Mockito author. Each test is 10-30 lines.

Pair with an `ActivityAspectTest.java` for the @ActivityLog AOP path behaviours (regression coverage for REFACTOR-556's transactional coupling).

**Severity rationale**: HIGH — regression-detection gap on a critical service. Severity is bounded by:
- The service is currently stable in production (no known regressions today).
- The fix is mechanical (write tests; no behaviour change).
- The blast radius of a future regression is wide (Activity feed visible to every user).

**Suggested backlog grouping**: `TEST-NNN Activity service-layer bootstrap`. Pair with REFACTOR-021/022/023 (other controller-layer test bootstrap), REFACTOR-070 (AppInfoController zero coverage). The Activity service represents the largest single-service test gap in the catalog.

---
