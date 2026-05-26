# SHB-066 — Notifications and DataCollaboration subsystems emit zero Prometheus metrics — operators cannot answer "are alerts being delivered" without log greppage

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators running ODD Platform in production for alerting need to monitor the notification subsystem the same way they monitor every other critical service: latency histograms (per-channel delivery time), counters (`notifications_sent_total{channel, result=success|failure}`), gauges (WAL replication slot lag, in-flight queue depth, last successful delivery timestamp). The platform emits NONE of these. The notification subsystem has zero Micrometer imports, zero `Counter` / `Timer` / `Gauge` registrations, zero structured `log.info` with parseable fields at success boundaries. The only signal of "notifications working" is `log.debug` (off in production by default) or "no log errors recently" (which is also the signal of "notifications stuck in poison-replay loop — see SHB-054"). The DataCollaboration sender / receiver jobs share the gap. Operators integrating ODD's alerting into their on-call rotation must build observability OUT-of-platform via Postgres queries (`SELECT confirmed_flush_lsn FROM pg_replication_slots`) and log greppage.

## Evidence

- `NotificationsDispatcher` sidecar `bugs_limitations_corner_cases.[4]` MEDIUM severity: "No backlog metric / no notification-queue depth. The dispatcher emits only `log.debug(...)`."
- `NotificationsDispatcher` sidecar `performance.known_performance_gaps.[3]` MEDIUM severity: "No backlog metric / no delivery metric / no failure-by-channel metric — operators cannot detect 'notifications broken' without log inspection."
- `NotificationSubscriber` sidecar `performance.known_performance_gaps.[4]` MEDIUM severity: "Slot growth is not surfaced as ODD telemetry — operators must query `pg_replication_slots.confirmed_flush_lsn` / `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)`."
- `NotificationSubscriber.java:75` — only `log.debug("processing LSN: {}", stream.getLastReceiveLSN())` per LSN; no Micrometer counter.
- `AlertNotificationMessageProcessor.java:27,33` — only `log.debug("Sending notification message via {}: {}", ...)` + `log.error("Error occurred while sending notification via %s", ...)`. DEBUG-off in production; ERROR captures only failures.
- `EmailNotificationSender.java:54-60` + `SlackNotificationSender.java:40-49` + `WebhookNotificationSender.java:18-23` — no per-send counter, no per-send latency, no per-channel timer.
- `ActivityTablePartitionManager` sidecar `performance.known_performance_gaps.[1]` MEDIUM severity: "No metric / observability instrumentation on the partition lifecycle — debug + error logs only."
- DataCollaborationController sidecar `bugs_limitations_corner_cases.[10]` LOW severity: "All three endpoints share the same single Slack `AsyncMethodsClient` instance ... there is no documented backpressure / concurrent-request cap."
- Grep across `notification/`, `partition/`, `datacollaboration/` packages for Micrometer types (`MeterRegistry`, `Counter`, `Timer`, `Gauge`) returns ZERO matches. Verified pattern.

## Notes

- This is an ENRICHER for F-009 + F-010 + F-038 + F-039 (GenAI shares the same gap per its sidecar). It's a cross-cutting CONCERN, not a feature in itself — but the user-observable consequence ("operators cannot tell when their alerting silently broke") IS the feature shape: operators expect telemetry as a first-class affordance, ODD provides none for the most operationally critical subsystem.
- The "metric absence as silent default" pattern is platform-wide and worth a sweep: the only Micrometer-instrumented surfaces today are (per cross-check) the HTTP request layer (Spring Boot Actuator default) and JVM defaults (memory, GC, thread pools). Application-logic metrics — feature-level "this feature is healthy" — are uniformly absent.
- The fix is small but cross-cutting: add `MeterRegistry` injection to each subsystem's primary class; emit the canonical counter/timer/gauge set; document at `configuration-and-deployment/odd-platform`. ~30 LOC per subsystem; high operator-leverage.
- Concept candidate: "subsystem observability baseline" — a non-negotiable for production-grade OSS. Most competitors (Airflow, dbt-cloud, Metabase) ship full Prometheus exposure as table-stakes; ODD's omission is a market-positioning gap.
- The "stuck-at-LSN" gauge specifically is the single most operator-relevant metric — combined with SHB-054 (poison-replay) and SHB-053 (cross-channel abort), `notifications_wal_last_applied_lsn` going flat for > 1 minute is the canonical "alerting broken" alert operators want.
- Cross-cuts the GenAI cost-monitoring gap (per SHB-057) — operators need `genai_requests_total{user, status}` and `genai_external_call_duration_seconds` to budget LLM spend.

## Next

1. **Graduate** as F-NNN "Production observability baseline — Prometheus metrics across notification/partition/datacollaboration/genai" — pillar P-08 (Management & Administration). MEDIUM.
2. **REFACTOR-NNN MEDIUM** — implement the canonical metric set across all four subsystems. Cross-cutting batch. Operator-tunable via standard Spring Boot Actuator endpoint exposure.
3. **DOC-NNN MEDIUM** — `configuration-and-deployment/odd-platform` should add a "Monitoring ODD Platform" section enumerating the exposed metrics + recommended alerts.
4. **REFACTOR-NNN MEDIUM** — add a `/actuator/health/notifications` health indicator that reports "DEGRADED" when the WAL last-applied LSN has not advanced for > 5 minutes (operator-tunable threshold).
5. **Probe** the existing `/actuator` endpoints to confirm which are currently exposed; document baseline state before changes.

## Links

- cluster_with: [F-009, F-010, F-038, F-039, SHB-053, SHB-054, SHB-057]
- merged_into: (open)
- supersedes: []
