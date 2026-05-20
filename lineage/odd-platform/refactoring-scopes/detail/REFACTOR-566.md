## REFACTOR-566 — Activity emit is non-idempotent — `ActivityCreateEvent` has NO deduplication key; `activityRepository.saveReturning` is INSERT-not-UPSERT; two concurrent retries of the same logical change produce two ActivityPojo rows

**Severity**: MEDIUM (audit-log noise; forensic ambiguity)
**Category**: idempotency
**Surfaced by**:
- `ActivityHandler.md:stress_findings.S-E-1` (CANARY HEADLINE — IDEMPOTENCY — "replaying the same `ActivityCreateEvent` produces TWO `ActivityPojo` rows, not one... no idempotency key on `ActivityCreateEvent` (5 fields, none deduplication-capable). `ActivityRepository.saveReturning` is INSERT-not-UPSERT")
- `ActivityServiceImpl.md:stress_findings.S-E-2` ("No idempotency / replay-safety — TWO rows, with sequential `id` values and indistinguishable payloads. The aspect path provides PARTIAL protection: `ActivityAspect.postActivity` line 86 filters `!info.getOldState().equals(newState)` — if a retry submits the same mutation after the first succeeded, the oldState now equals the newState (because the state already changed) and the emit is skipped. But for TRUE concurrent retries (two requests arriving before either has committed) BOTH succeed at the activity-write level (no `ON CONFLICT`, no advisory lock)")
- `ActivityServiceImpl.md:bugs_limitations_corner_cases[4]` ("Activity emit is non-idempotent. Two concurrent submissions of the same `ActivityCreateEvent` produce TWO rows with sequential ids" — MEDIUM)
- `ActivityCreateEvent.java:8-14` (the DTO — 5 fields, none deduplication-capable)
- `ActivityServiceImpl.java:50` (`saveReturning` — INSERT-only, no `ON CONFLICT`)
- `ActivityAspect.java:86` (the partial protection — `!info.getOldState().equals(newState)` skip-on-no-change)
- `ReactiveActivityRepositoryImpl.java:50-71` (the INSERT statement; verified no `ON CONFLICT`, no `INSERT ... ON CONFLICT DO NOTHING` clause)

**Description**: `ActivityCreateEvent` (`dto/activity/ActivityCreateEvent.java:8-14`) is a 5-field DTO:
- `dataEntityId`
- `eventType` (the enum tag)
- `oldState` (JSON state-snapshot — the diff source)
- `newState` (JSON state-snapshot — the diff target)
- `systemEvent` (boolean flag)

None of the fields acts as a deduplication key. The activity persistence at `ActivityServiceImpl.createActivityEvent:43-52` → `activityRepository.saveReturning(ActivityPojo)` issues an unconditional `INSERT INTO activity (...) VALUES (...) RETURNING *`. The `activity` table's primary key is `id BIGSERIAL` — sequence-allocated at INSERT — so duplicate rows get distinct ids.

There is no `ON CONFLICT DO NOTHING`, no advisory lock on the (dataEntityId, eventType, oldState, newState) tuple, no UNIQUE constraint on any business-identifier of the event.

**The trigger sequence for duplicate audit rows**:

1. User submits a description update via the UI (e.g. "fix typo"). HTTP request lands at the controller.
2. The wrapped business mutation runs inside `@ActivityLog(DESCRIPTION_UPDATED)` aspect-managed TX. `getContextInfo` captures `oldState = "description before"`. `getUpdatedState` captures `newState = "description after"`. The activity row is INSERTED.
3. The HTTP response is in-flight to the client; a network blip causes the client to NOT receive it.
4. The client UI's retry logic (axios retry, manual user double-click, RTKQuery automatic retry) re-submits the same request.
5. The 2nd request arrives. The wrapped mutation runs. The `getContextInfo` captures `oldState`:
   - If the FIRST mutation already committed → `oldState = "description after"` (NEW state) → diff with `newState = "description after"` is "no change" → the aspect's `.filter(newState -> !info.getOldState().equals(newState))` at `ActivityAspect.java:86` SKIPS the emit. SUCCESS.
   - If the FIRST mutation has NOT yet committed (true concurrent retry) → `oldState = "description before"` (still OLD) → diff is real → second activity row INSERTED. **DUPLICATE.**

The aspect's `.filter` provides PARTIAL protection for the post-success retry case, NOT for the concurrent retry case.

For the explicit batch-emit paths (AlertServiceImpl, ActivityIngestionRequestProcessor), `createActivityEvents(List<ActivityCreateEvent>)` (`:54-63`) has NO retry-protection beyond the same INSERT semantics.

**Operator-visible consequence**: 
- The UI's Activity Feed displays two side-by-side rows that LOOK identical — same actor, same timestamp (within sub-second), same `oldState`/`newState`, but distinct `id`s.
- Operators investigating "did X change at T?" see DOUBLE rows — does not impact accuracy but adds noise.
- For batch-emit paths (ingestion of N entities + retry), the duplicate count can be 2× N rows in pathological cases.
- Forensic ambiguity: "was this one event reported twice (retry-driven) OR two separate user actions in tight succession?". Without timestamp microsecond-resolution discrimination, ambiguous.

**Cross-cutting context**: This is the **non-idempotent INSERT-without-ON-CONFLICT defect class**. It composes with REFACTOR-558 (concurrent oldState race) for compounded effects:
- Two concurrent retries → both pass the `oldState.equals(newState)` filter (same pre-mutation state observed) → BOTH INSERT → 2 rows with same oldState.
- The diff is wrong-by-construction (per REFACTOR-558) AND duplicated (per this REFACTOR).

**Primary source citations**:
- `ActivityCreateEvent.java:8-14` (verified DTO shape; no dedup key)
- `ActivityServiceImpl.java:50` (`saveReturning` — verified INSERT-only)
- `ActivityServiceImpl.java:62` (`save` — verified batched INSERT-only)
- `ActivityAspect.java:86` (the partial-protection filter)
- `ReactiveActivityRepositoryImpl.java:50-54` (the JOOQ INSERT — verified no ON CONFLICT)
- `ReactiveActivityRepositoryImpl.java:57-71` (the batched INSERT — verified no ON CONFLICT)
- `V0_0_48__add_activity.sql:1-13` (the activity table schema — verified no UNIQUE constraint on business identifiers)

**Existing-ADR-or-implied-prescription**: NONE. No ADR defends or constrains the idempotency choice. The aspect-level filter (`oldState.equals(newState)`) is implicit defensive code; the maintainer relied on it to catch post-success retries.

**Proposed remedy**: Three options the maintainer can choose between:

1. **LOWEST cost — Accept and document**: Add a note to `activity-feed.md`: "Activity events are NOT deduplicated at persistence. Caller retries before the original event commits can produce duplicate activity rows. Operators viewing the activity feed should expect occasional duplicate rows for high-retry-rate paths (alert ingestion, network-flaky environments)." Cheap; sets operator expectations.

2. **MEDIUM cost — Add an idempotency key on ActivityCreateEvent**: Extend the DTO with a `String idempotencyKey` field. Callers (controllers, aspect, ingestion processor) generate the key based on logical event identity (e.g. `dataEntityId + eventType + timestamp-second + actor`). Add a UNIQUE constraint on the activity table on `(idempotency_key)` where `idempotency_key IS NOT NULL`. The INSERT uses `ON CONFLICT (idempotency_key) DO NOTHING` semantics — retries are no-ops. Trade-off: schema migration + key generation; some retried events with timestamp-precision distinct may legitimately be different events.

3. **HIGHER cost — In-process retry-aware dedup**: Use Reactor's `cache()` operator on the activity-emit Mono within the aspect, keyed by request-correlation-id. Same request retried within window → cached result returned. Architecturally heavier; doesn't survive instance restart.

**Recommended**: Option 1 (accept and document) + Option 2 as a future hardening pass. The complete fix requires schema migration which is heavier than the current value of the protection — most production deployments don't retry-storm.

**Severity rationale**: MEDIUM — audit-log noise; forensic ambiguity. The defect doesn't impact correctness of audit content (the rows show real state transitions), only the rendering and forensic interpretation. Severity is bounded by:
- The aspect's partial protection catches post-success retries (the most common pattern).
- True concurrent retries are rare in normal user-flows.
- Batched ingestion paths (the LARGEST blast radius) are typically not retried via the same caller machinery.

**Suggested backlog grouping**: `SEC-NNN activity-audit correctness sprint`. Pair with REFACTOR-556 (transactional coupling), REFACTOR-558 (oldState race), REFACTOR-560 (system_event flag asymmetry), REFACTOR-561 (spurious activity events from row-order non-determinism). The five findings collectively define "activity audit log is approximate, not authoritative".

---
