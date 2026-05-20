## REFACTOR-518 — No retry / no DLQ / no audit / no metrics on failed notification delivery — silent alert drops; operators cannot answer "did alert X reach Slack?" or "how many alerts failed delivery last week?"

**Severity**: HIGH
**Category**: missing-retry + missing-audit + missing-metrics + observability
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications all 3 channels), P-08-observability-and-operations]

**Surfaced by**:
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[3]` (HIGH) — "**No retry, no DLQ, no audit on failed Slack delivery (file-local manifestation of F-009 REFACTOR-127).** The contract here is single-attempt-or-fail. The dispatcher catches NotificationSenderException and moves on — there is no record in the ALERT table, no row in any audit table, no metric counter increment, no Prometheus 'notifications_sent_total{channel=\"Slack\",result=\"failure\"}' increment. An operator asking 'how many alerts went to Slack last week' or 'which alerts failed Slack delivery between 14:00 and 14:30 yesterday' has no answer beyond grep'ping log files for `Notification sender Slack:` substring."
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[3]` (HIGH) — "**NO retry on failure — single attempt, then drop.** A transient network failure (DNS hiccup, brief receiver outage, transient 5xx) causes one `NotificationSenderException` log line at ERROR, and the alert is gone from the webhook channel forever. The WAL LSN advances regardless (NotificationSubscriber.java:83-84), so the alert is NOT replayed by the WAL stream. No exponential back-off, no retry budget, no per-channel circuit breaker."
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[11]` (MEDIUM) — "**No retry on transient SMTP failures** — JavaMailSender#send blocks until the transport returns (success) or throws MessagingException (failure). There is no exponential back-off, no per-recipient retry, no DLQ."

**Statement**: The platform's notification delivery has NO observability or recovery mechanisms:

| Concern | Slack | Webhook | Email |
|---|---|---|---|
| Retry on transient failure | NO | NO | NO |
| Dead-letter queue | NO | NO | NO |
| Audit table row | NO | NO | NO |
| Prometheus metric (success/failure counter) | NO | NO | NO |
| Operator API to query delivery status | NO | NO | NO |
| Log-line correlation-id | NO (receiverId only) | NO | NO |

The dispatcher (`AlertNotificationMessageProcessor.java:29-34`) catches `NotificationSenderException` and emits `log.error("Notification sender {}: {}", sender.receiverId(), e.getMessage(), e)`. That single log line is the ONLY trace of a failed delivery. No record in the ALERT table (the alert row is committed at INSERT time; the notification delivery is downstream and untracked). No row in the `activity` table (per REFACTOR-520 + ADR-CANDIDATE-146 — the schema doesn't allow notification-delivery events).

**Cross-link with the 3-structural-barrier audit story (per ADR-CANDIDATE-146 strengthen batch Y)**:
- ENUM-ROOTED: ActivityEventTypeDto has no NOTIFICATION_* constants
- SCHEMA-ROOTED: activity.data_entity_id NOT NULL FK
- SPI-SEAM-ROOTED: PostgresWALMessageProcessor.process has no correlation-id

All three structural barriers BLOCK adding notification-delivery audit at the same time. This refactoring scope is what each of those structural barriers stops the maintainer from doing today.

**Operational consequences**:
- Operators auditing "did alert X reach Slack" cannot answer.
- Operators investigating "which alerts failed delivery between 14:00 and 14:30 yesterday" must grep log aggregator (and the log line has no alert-id correlation).
- Compliance / SOC2 / regulatory audit requirements that include alert-delivery traceability cannot be met.
- Operators making capacity decisions on the notification subsystem (alert rate, channel utilization, failure rate) have no metric.

**Evidence**:
- `AlertNotificationMessageProcessor.java:29-35` — catch-and-log dispatcher with no metric / audit emission
- `AbstractNotificationSender.java:16-30` — sendAndValidate with no metric emission
- `SlackNotificationSender.java:40-49` — single-attempt send
- `WebhookNotificationSender.java:18-23` — single-attempt send
- `EmailNotificationSender.java:54-57` — single-attempt per recipient
- `ActivityEventTypeDto.java:3-31` — no NOTIFICATION_* constants
- F-009 drift facet `no_retry_no_dlq_no_audit`

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-186 NEW batch Y codifies "one-shot fire-and-forget exactly-200" — this is the design choice. ADR explicitly says it does NOT defend "the absence of retry/DLQ/audit which is a refactoring gap."
- ADR-CANDIDATE-180 NEW batch Y codifies "at-least-once via LSN-after-process" — explicitly states "no DLQ, no skip-poison API, no operator API to advance LSN past a bad message; the platform offers no DLQ".
- ADR-CANDIDATE-146 (audit-table schema-rooted scope) — the structural barrier to adding audit; STRENGTHENED batch Y with SPI-seam-rooted as the third barrier.
- F-009 drift facet — the cross-feature finding.

**Proposed remedy**:

1. **Path A (Prometheus metrics — minimum)** — Add Micrometer counter `notifications_sent_total{channel, result}` (Slack, Webhook, Email × success, failure). Increment at every send call site. Add gauge `notifications_wal_consecutive_failures_total` (per REFACTOR-508). Operators can build alerts on these.

2. **Path B (structured ERROR log with correlation)** — Replace `log.error("Notification sender {}: {}", ...)` with structured log line carrying `alert_id`, `channel`, `wal_lsn`, `error_class`, `attempt_number`. Operators can grep + aggregate.

3. **Path C (in-table audit — STRUCTURAL CHANGE)** — Per ADR-CANDIDATE-146 strengthen-batch-Y, requires (a) widening ActivityEventTypeDto with NOTIFICATION_* constants OR creating a dedicated `notification_delivery_audit` table (per ADR-CANDIDATE-167 pattern for OwnerAssociationRequest), (b) extending the SPI (per ADR-CANDIDATE-182) with correlation-id, (c) per-channel emission at the sender. Significant structural work but the architecturally-cleanest path.

4. **Path D (per-channel retry + DLQ — STRUCTURAL CHANGE)** — Wrap sender invocations in a retry decorator with exponential back-off (e.g. Resilience4j). On all-retries-exhausted, write to a dead-letter table for operator manual replay. Touches ADR-CANDIDATE-180's at-least-once stance — moving toward at-least-once with finite retries.

Path A + B are the SHIP-FAST minimum (observability). Path C is the cleanest long-term audit answer. Path D is the reliability fix.

**Severity rationale**: HIGH — single most-frequently-cited operability + compliance gap in the Notifications subsystem; cross-references three batch-Y ADRs as structural enablers; cross-references the F-006 audit-silence drift family.

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family) + `Notifications observability sprint`.

---
