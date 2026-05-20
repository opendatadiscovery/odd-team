## REFACTOR-250 — `@ActivityLog` AOP is `@Profile("!integration-test")` — activity emission for `updateStatus` (and every other @ActivityLog-annotated method) is SILENTLY DISABLED in integration tests

**Severity**: LOW (test-infra gap, not a production-runtime defect)
**Category**: missing-test + observability
**Surfaced by**:
- `AlertServiceImpl.md:bugs_limitations_corner_cases[9]`

**Description**: `ActivityAspect.java:24` declares the AOP-providing class with `@Profile("!integration-test")`. The `@ActivityLog` annotation on service methods (`AlertServiceImpl.updateStatus` at line 112, `OwnershipServiceImpl.create` at line 48, `DataEntityServiceImpl.upsertBusinessName` at line 336, etc.) relies on this aspect to intercept the method invocation and emit the activity-feed event.

In integration tests (Spring profile `integration-test`), the aspect is NOT wired into the application context. Method invocations on @ActivityLog-annotated services proceed WITHOUT activity-feed emission. The end-to-end test `AlertIngestionTest` cannot assert that `updateStatus` produces an `ALERT_STATUS_UPDATED` row in the `activity` table; the row is never written because the aspect's `monoActivityAspect` advice is not registered.

The consequence: a regression that breaks `updateStatus`'s activity emission (or any other @ActivityLog-annotated method's emission) lands GREEN in the integration-test suite. Only:
- Unit tests with the aspect explicitly wired (e.g. via `@SpyBean(ActivityAspect.class)` or `@Import(ActivityAspect.class)`) can assert emission.
- Production deployments where the aspect IS wired can observe the regression — typically discovered only after deployment.

This is the same class of finding as REFACTOR-244 (no method-level observability across repositories) but on the TEST side: the test infrastructure intentionally silences a production observability concern, creating a hidden test-coverage trap.

The intent of the `@Profile("!integration-test")` exclusion is reasonable: integration tests don't want to litter the test DB with activity rows for every CRUD operation. But the consequence is that activity-emission regressions are invisible in the integration suite — which is supposed to be the "test the full stack" gate.

**Primary source citations**:
- `ActivityAspect.java:24` — the `@Profile("!integration-test")` guard
- `AlertServiceImpl.java:111-112` — the only `@ActivityLog`-annotated method on AlertServiceImpl
- `AlertIngestionTest.java` — the integration-test class that exercises the full ingestion stack (covered_behaviours per the sidecar) but cannot assert activity emission because of the profile exclusion
- contrast with `OwnershipServiceImpl.java:48` + similar — every @ActivityLog-annotated service method shares the same test-coverage gap
- composes with `DataEntityServiceImpl.md:bugs_limitations_corner_cases[7]` (zero log.* calls on the file despite @Slf4j — same forensic-silence pattern)

**Existing-ADR-or-implied-prescription**: none. ADR-CANDIDATE-060 (programmatic activity emission for bulk vs AOP for single-resource) implicitly relies on the AOP's correctness; the test-side gap means the AOP correctness is harder to assert than the programmatic-emission correctness (the latter is direct code, the former is profile-gated AOP).

**Proposed remedy**: Three composable fixes:
1. **Unit test the AOP** — write `ActivityAspectTest` that imports `ActivityAspect` explicitly and asserts that invoking a fake @ActivityLog-annotated method produces the expected `activity` table row. Catches regressions in the aspect's own logic.
2. **Selective integration test for activity emission** — write `ActivityEmissionIntegrationTest` that activates the `integration-test` profile EXCEPT excludes the `@Profile("!integration-test")` guard for this test class (via `@ActiveProfiles({"integration-test", "activity-test"})` + a conditional aspect annotation). Asserts that the full stack produces activity rows on a mutation.
3. **Doc the profile gap** — add a code comment at `ActivityAspect.java:24` explaining the profile exclusion and pointing to the unit-test obligation. A maintainer reading the @ActivityLog annotation on a service method should know "AOP is NOT wired in the integration test suite; assert emission via unit test or the selective integration test."

Options (1) + (2) together close the test coverage gap; option (3) makes the existing gap explicit to future maintainers.

**Severity rationale**: LOW — test-infra gap, not a production-runtime defect. The platform's activity emission works in production; the gap is the regression-detection failure mode. Compounds with REFACTOR-188 (no audit log on RBAC mutations — the regression-detection gap at the RBAC tier is even more severe because no AOP exists there to begin with).

**Suggested backlog grouping**: `Test bootstrap hardening` — pair with REFACTOR-021, -022, -023, -070 (controller test coverage gaps). The activity-emission test is a cross-cutting infrastructure investment.

---
