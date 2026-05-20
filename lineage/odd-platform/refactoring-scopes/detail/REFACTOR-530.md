## REFACTOR-530 — No Prometheus / Micrometer metrics for in-flight LSN, last-applied LSN, subscriber progress, slot lag, or thread health — operators must shell into Postgres to answer "is the subscriber making progress?"

**Severity**: MEDIUM
**Category**: observability + missing-metrics
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications observability), P-08-observability-and-operations]

**Surfaced by**:
- `NotificationSubscriber.md:bugs_limitations_corner_cases.[9]` (MEDIUM) — "**No metric for in-flight LSN or last-applied LSN** — the subscriber's progress is observable only via Postgres-side `SELECT * FROM pg_replication_slots WHERE slot_name = ?` (operator query) or `log.debug(\"processing LSN: {}\", stream.getLastReceiveLSN())` at L75 (debug-level only, requires DEBUG logging enabled). No Prometheus gauge for `notification_wal_last_applied_lsn`, no counter for `notification_wal_messages_processed_total{operation=INSERT|UPDATE}`. Operators cannot answer 'is the subscriber making progress?' or 'how far behind is it?' from telemetry; they must shell into Postgres."
- `NotificationSubscriber.md:performance.known_performance_gaps.[4]` (MEDIUM) — "**Slot growth is not surfaced as ODD telemetry** — operators must query `pg_replication_slots.confirmed_flush_lsn` / `pg_wal_lsn_diff(...)` to observe subscriber-induced WAL retention. No Prometheus gauge, no actuator endpoint."

**Statement**: ODD's Notifications subsystem has NO Prometheus metrics:
- `notification_wal_last_applied_lsn` (gauge) — current LSN
- `notification_wal_slot_lag_bytes` (gauge) — `pg_wal_lsn_diff` for the slot (cross-ref REFACTOR-509)
- `notification_wal_messages_processed_total{operation=INSERT|UPDATE}` (counter)
- `notification_wal_consecutive_failures_total` (counter; cross-ref REFACTOR-508)
- `notification_subscriber_thread_alive` (gauge; cross-ref REFACTOR-519)
- `notifications_sent_total{channel, result}` (counter; cross-ref REFACTOR-518)

Operators must:
- Query `pg_replication_slots` directly for progress
- Enable DEBUG logging for `NotificationSubscriber.java:75` log line
- Have no programmatic way to alert on subscriber health

**Evidence**:
- `NotificationSubscriber.java:1-159` — no Micrometer imports
- `NotificationSubscriberStarter.java:1-36` — no metric registration

**Proposed remedy**: Add Micrometer instrumentation:
- Inject `MeterRegistry` into `NotificationSubscriber`
- Register gauges at construction
- Increment counters at process / advance / exception sites
- Periodic query of `pg_replication_slots` for slot-lag (every 60s)

Combined with REFACTOR-518 (per-channel send metrics) and REFACTOR-519 (thread-death detection), this is the "Notifications observability sprint" deliverable.

**Severity rationale**: MEDIUM — operability gap; operators cannot alert on subsystem health; cross-references multiple HIGH-severity scopes that compound from this observability absence.

**Suggested backlog grouping**: `Notifications observability sprint`.

---
