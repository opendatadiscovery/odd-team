# SHB-067 — /api/activity/counts accepts null dates and silently scans the entire activity history; /api/activity rejects them — asymmetric validation = unbounded query oracle

**Category**: open
**Severity**: MEDIUM

## Hypothesis

The Activity Feed exposes two sibling endpoints: `GET /api/activity` (list) and `GET /api/activity/counts` (badge counter). The LIST endpoint validates `beginDate` and `endDate` at the service layer (`ActivityServiceImpl.getActivityList` lines 98-100 raise `BadUserRequestException` on null), enforcing a date-bounded query. The COUNTS endpoint at `ActivityServiceImpl.getActivityCounts` (lines 138-166) has NO such validation. A caller (a UI bug, a curl-based admin tool, an enumeration probe) hitting `/api/activity/counts` without `begin_date` / `end_date` triggers the repository's `getCommonConditions` to build no `created_at` predicate, producing an UNBOUNDED count over the ENTIRE retained activity history (cross-link SHB-089 — that history is monotonically growing). On a production deployment with millions of activity rows, this is a performance cliff — a single bad query holds a connection for seconds-to-minutes, blocking concurrent requests on the same pool. Combined with the no-RBAC posture on activity reads (any authenticated user can hit the endpoint), the asymmetry is an authenticated-user-DOS surface.

## Evidence

- `odd-platform-api/src/main/java/.../service/ActivityServiceImpl.java:98-100, :128-130` — both `getActivityList` and `getDataEntityActivityList` validate `beginDate == null || endDate == null` → `BadUserRequestException`.
- `ActivityServiceImpl.java:138-166` — entire `getActivityCounts` method. Line-by-line: NO null check on `beginDate` / `endDate`. The four-way `Mono.zip(totalCount, myObjectActivitiesCount, downstreamActivitiesCount, upstreamActivitiesCount)` (line 158-165) dispatches to repository methods that fold the dates into `getCommonConditions`.
- Per ActivityServiceImpl sidecar `stress_findings.S-B-3` PROBE-NEEDED MEDIUM: "The count query would build no `created_at` predicate and aggregate over the ENTIRE retained activity history (all partitions per F-010 housekeeping)."
- `ReactiveActivityRepositoryImpl.getCommonConditions` (referenced) — `.add(ACTIVITY.CREATED_AT.greaterOrEqual(...))` only fires when not-null; without dates, the WHERE clause has no `created_at` predicate.
- ActivityServiceImpl sidecar `tests_coverage_semantic.uncovered_behaviours[4]` MEDIUM: "no test asserts (or constrains) the behaviour when getActivityCounts is called without dates."
- Cross-link SHB-089: the activity table has no row-level retention, so the unbounded count scans monotonically-growing history.
- Cross-link the ActivityController sidecar `security.known_security_gaps.[0]` HIGH: no RBAC = any authenticated user can issue the bad query.
- Per ActivityController sidecar `coupling`: `/api/activity` falls through to `pathMatchers('/**').authenticated()`; under DISABLED, anonymous callers reach it.
- OpenAPI for `/api/activity/counts` (per ActivityController sidecar) — both `begin_date` and `end_date` are marked `required: true`, so the spec disagrees with the service implementation. Belt-and-braces is the design intent on `/api/activity` (per sidecar); the same belt is MISSING on `/api/activity/counts`.

## Notes

- This is an ENRICHER for **F-021 (Activity Feed)**. F-021 covers the cross-owner audit-trail read surface. This thread surfaces the parallel asymmetric-validation gap on the counts endpoint — a load-bearing performance + security concern.
- Probe P-023 was emitted to verify the behaviour; per the sidecar this is PROBE-NEEDED, not yet exercised.
- The fix is one-line: add the same null check to `getActivityCounts` that exists in `getActivityList`. Reversible, immediate. The risk is operator-impact: a UI fix may be needed simultaneously to ensure the counts endpoint is called with dates from every caller.
- Compound with the cursor-pagination semantics on the LIST endpoint: a counter showing "1,234,567 events" is operator-visible drift from the UI's behaviour of paginating only the last N events; the count contradicts the visible list and creates user confusion.
- The asymmetric-validation pattern likely exists elsewhere in the codebase: anywhere a `/list` + `/count` endpoint pair shares logic via inheritance/composition without symmetric pre-condition checks. Worth a sweep.
- Concept-merger candidate: "endpoint-pair validation symmetry" — a code-quality invariant.

## Next

1. **Probe (P-023)**: call `curl /api/activity/counts` without dates against a populated demo platform; measure HTTP status, response body, latency.
2. **Graduate** as a load-bearing facet of F-021, OR roll into SHB-089 (monotonic growth) as a compounding consequence.
3. **REFACTOR-NNN MEDIUM** — add the null check at `ActivityServiceImpl.java:138-166`. One-line fix.
4. **TEST-NNN MEDIUM** — pin both the list and the counts validation symmetry.
5. **DOC-NNN LOW** — OpenAPI spec already declares both dates required; no doc change needed once the code fixes the gap.
6. **Sweep**: grep for other `*Count` endpoints sharing logic with `*List` siblings; check validation parity.

## Links

- cluster_with: [F-021, SHB-089]
- merged_into: (open)
- supersedes: []
