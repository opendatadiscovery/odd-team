## REFACTOR-313 — NotificationsDispatcher no backlog metric, no delivery metric, no failure-by-channel metric — only `log.debug` per-send + `log.error` per-failure; operators have no observability primitive to alert on "notifications broken"

**Severity**: MEDIUM
**Category**: observability
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "No backlog metric / no notification-queue depth. The dispatcher emits only `log.debug(\"Sending notification message via {}: {}\", ...)` at DEBUG level (off in default log config). There is no Prometheus counter for `notifications_sent_total`, no histogram for delivery latency, no gauge for backlog depth (WAL lag), no failure-rate-by-channel metric. Operators have no observability primitive to alert on 'notifications broken'."

**Description**: `AlertNotificationMessageProcessor.java:28` emits `log.debug(\"Sending notification message via {}: {}\", notificationSender.receiverId(), notificationMessage)` — DEBUG level (off in default production log config). Lines 30-35 emit `log.error(\"Error occurred while sending notification via %s\", notificationSender.receiverId())` per per-sender failure. There is NO Micrometer counter, NO Prometheus gauge, NO timing histogram. Operators cannot answer "are notifications being delivered?" "what's the per-channel failure rate?" "what's the WAL lag?" without log inspection. The absence is consistent across the platform's Notifications subsystem (cross-link REFACTOR-127 / -137 batch C — no audit / no observability across the whole subsystem).

**Failure mode**: Slack changes its rate-limit policy from `tier1` to `tier2`; the new rate-limit drops 50% of messages with 429 responses. The dispatcher logs 50% of attempts as `log.error`; operators consuming Prometheus dashboards see NO metric change because there's no `notifications_failures_total` counter. Operators discover the regression only when users on Slack report missing alerts.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:27-28` (only debug log)
- `AlertNotificationMessageProcessor.java:30-35` (only error log)
- Grep `@Timed|MeterRegistry|Counter|Gauge|Histogram` against `notification/` directory returns zero matches

**Existing-ADR-or-implied-prescription**: None. The notifications-subsystem ADRs (ADR-CANDIDATE-040 / -041 / -043 / -098 / -099 / -100) describe activation / fan-out / concurrency / error-handling but say nothing about observability. The IMPLIED prescription is that operators need observability primitives proportional to the subsystem's criticality; the absence is a feature gap.

**Proposed remedy**: Add Micrometer instrumentation:
- `notifications_sent_total{channel,status}` counter (status ∈ {success, failure}).
- `notifications_delivery_duration_seconds{channel}` histogram.
- `notifications_wal_lag_seconds` gauge (read from `pg_replication_slots.lag` per WAL slot).
- `notifications_dispatcher_active` boolean gauge (1 if the dispatcher is the leader-elected instance, 0 otherwise).
- Expose via the existing Prometheus actuator endpoint.

Pair with REFACTOR-307 (audit table) — together they cover the operator-visibility gap.

**Severity rationale**: MEDIUM — operability gap; affects every operator's ability to detect notification-subsystem regressions; without metrics the failure mode is "user reports missing alerts," not "Prometheus alert fires."

**Suggested backlog grouping**: `Cross-cutting observability sprint` (batch C grouping, with REFACTOR-097 / -137 / -244)

---
