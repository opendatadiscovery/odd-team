## REFACTOR-519 — `NotificationSubscriberStarter` does NOT detect thread death — the WAL subscriber's `run()` exiting via re-thrown `NotificationSubscriberException` kills the single-thread Executor's only worker; no log line, no restart, no health-check; the platform silently stops delivering notifications

**Severity**: HIGH
**Category**: no-failure-handler + observability + silent-failure
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications subsystem availability), P-08-observability-and-operations]

**Surfaced by**:
- `NotificationSubscriber.md:bugs_limitations_corner_cases.[7]` (HIGH) — "**`NotificationSubscriberStarter` has no thread-death detection** — sibling NotificationSubscriberStarter.java:33-35 submits `new NotificationSubscriber(...)` to a single-thread ExecutorService but never holds the returned `Future`. If THIS file's `run()` exits (e.g. via the `NotificationSubscriberException` thrown at L89 or L99 on outer-loop InterruptedException), the executor's worker dies and the subscriber is gone for the rest of the JVM lifetime. The platform continues to accept alerts (INSERT/UPDATE into `alert`), Postgres continues to retain WAL on the slot, and no notifications fire — silently. No log line tracks the dead subscriber; operators discover the failure when an alert they expected never delivers."

**Statement**: At `NotificationSubscriberStarter.java:21-35`:
```java
private final ExecutorService executor = Executors.newSingleThreadExecutor(
    new BasicThreadFactory.Builder().namingPattern("notification-subscriber-thread").build()
);

@EventListener(ApplicationReadyEvent.class)
public void start() {
    executor.submit(new NotificationSubscriber(...));   // <-- Future NOT retained
}
```

The `Future<?>` returned by `executor.submit(...)` is discarded. There is NO `Future.get()` call, NO exception handler, NO thread-death listener, NO `UncaughtExceptionHandler` set on the executor's thread factory.

When `NotificationSubscriber.run()` exits via the `NotificationSubscriberException` thrown at line 89 (InterruptedException-during-inner-loop) or line 99 (InterruptedException-during-outer-10s-sleep):
1. The exception propagates out of `run()`.
2. The executor's worker thread terminates.
3. The single-thread executor has NO other workers; subsequent task submission would create a new thread, but there is no resubmission code path.
4. The platform continues accepting alerts via the HTTP API (`POST /ingestion/alert/alertmanager`, `PUT /api/alerts/{id}/status`) — these INSERT/UPDATE into the `ALERT` table.
5. Postgres continues retaining WAL on the replication slot (lazy-create-no-drop per ADR-CANDIDATE-028) — `pg_wal/` grows.
6. NO notifications fire — silently.
7. NO log line tracks the dead subscriber.

**Discovery only happens when**:
- An operator notices an expected alert never arrived in Slack.
- An operator queries `pg_replication_slots` and notices `confirmed_flush_lsn` is stuck at an old value.
- Disk monitoring catches the PG primary's `pg_wal/` growing.

**Composing failure modes**:
- The OS-socket-timeout-blocking case (REFACTOR-515) eventually returns from the blocked `send(...)` call, so the subscriber thread is not killed — REFACTOR-515 is operationally LESS severe than REFACTOR-519 because REFACTOR-515's stall is at least observable (the thread is alive but blocked).
- REFACTOR-519's silent death is the WORST operational mode of the Notifications subsystem.

**Evidence**:
- `NotificationSubscriberStarter.java:21-23, 33-35` — single-thread executor + discarded Future
- `NotificationSubscriber.java:87-89` — InterruptedException-during-inner-loop re-throws
- `NotificationSubscriber.java:99-100` — InterruptedException-during-outer-sleep re-throws
- `NotificationSubscriber.java:87` (outer catch wrapping `InterruptedException` as `NotificationSubscriberException`)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-179 NEW batch Y (leader-elected single-writer-per-cluster) — the architectural choice that makes the single-thread executor structurally correct (more than one subscriber would violate the leader-election invariant). The ADR is silent on the thread-death observability gap.
- No ADR defends absence of thread-death detection; refactoring gap.

**Proposed remedy**:

1. **Path A (Future + restart loop)** — Modify `NotificationSubscriberStarter.start()` to retain the Future + register an exception handler that logs at ERROR + resubmits a new `NotificationSubscriber` after a configurable delay (e.g. 30s back-off). The leader-election invariant is preserved because the new instance also acquires the advisory lock.

2. **Path B (Spring Actuator HealthIndicator)** — Add `NotificationSubscriberHealthIndicator` that checks (a) the executor's `isShutdown()` / `isTerminated()` AND (b) the worker thread's alive status. Spring Boot's `/actuator/health` returns DOWN if the subscriber is dead. Operators with health-check-driven alerting see the failure.

3. **Path C (UncaughtExceptionHandler on the thread factory)** — Set the thread factory's `UncaughtExceptionHandler` to a callback that logs + emits a Prometheus counter `notifications_subscriber_thread_deaths_total`. Doesn't resurrect the thread but at least surfaces the failure observability.

4. **Path D (all three — recommended)** — Path A (resubmit) + Path B (health-check) + Path C (counter). Defence-in-depth.

Path D is the recommended structural fix. Path A alone is the operational floor (silent failure -> automatic recovery). Path B alone is the observability floor.

**Severity rationale**: HIGH — silent failure of the entire Notifications subsystem with no log signal, no health-check signal, no metric; operators discover the failure days later when alerts are silently missing; compounds with REFACTOR-509 (WAL retention on the now-pinned slot).

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family).

---
