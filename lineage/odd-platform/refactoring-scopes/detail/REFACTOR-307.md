## REFACTOR-307 — NotificationsDispatcher has no retry, no dead-letter queue, no audit trail — failed deliveries (any channel, any reason) are logged at ERROR and the WAL LSN advances regardless; no DB record of which alert went to which channel with what status

**Severity**: HIGH
**Category**: missing-audit (no-retry-no-dlq)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[1]` (HIGH) — "No retry, no dead-letter, no audit. A failed delivery (any channel, any reason) is logged at ERROR and the message is treated as delivered from the dispatcher's perspective. The WAL stream's `setAppliedLSN` and `setFlushedLSN` are advanced regardless (NotificationSubscriber.java:83-84) — the dispatcher has no way to signal 'do not advance LSN'. Operators have NO database record of delivery success/failure per alert per channel."

**Description**: After `AlertNotificationMessageProcessor.process()` returns (regardless of how many senders threw), `NotificationSubscriber.java:83-84` calls `stream.setAppliedLSN(decodedMessage.lsn())` and `stream.setFlushedLSN(decodedMessage.lsn())` — the WAL stream advances past this alert. The dispatcher has NO mechanism to signal "this message should be re-delivered" (other than throwing OUT of process(), which produces the poison-message loop per REFACTOR-306). There is NO retry logic; NO `notifications_delivery_attempts` table; NO `notifications_delivery_log` table recording (alert_id, channel, status, attempt_count, last_attempt_at). The per-sender exception catch (per ADR-CANDIDATE-098) logs at ERROR with the receiver id; that's the ONLY record. Operators querying "did this alert reach Slack?" have nothing beyond log-grep on the receiver-id string.

**Failure mode**: A 1-hour Slack incident drops the webhook endpoint; during that hour, 50 alerts fire. Each alert's process() call attempts Slack delivery, throws NotificationSenderException, logs at ERROR, continues to webhook + email (both deliver successfully). The 50 alerts are PERMANENTLY LOST for the Slack channel; there is no retry queue, no operator-visible "50 Slack deliveries failed in the last hour" surface, no replay mechanism. After Slack recovers, the platform has no record of what to replay.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:30-35` (catch-and-log only)
- `NotificationSubscriber.java:83-84` (LSN advanced unconditionally after process() returns)
- Grep `notifications_delivery_log` / `notifications_audit` against `src/main/resources/db/migration/` returns zero matches — no audit table.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-098 (NEW batch K — per-channel catch-and-continue) is the architectural decision that frames the catch-and-continue stance; the ADR DOES NOT defend the absence of any delivery audit at all. The catch-and-continue stance only requires that other channels still receive the alert; it does NOT preclude recording the per-channel outcome. Cross-link with REFACTOR-127 (batch C — same finding from the NotificationsProperties config angle).

**Proposed remedy**: Three composable fixes. (a) **Audit table**: add a `notifications_delivery_log` table `(alert_id, channel_receiver_id, attempt_count, last_status, last_error_msg, last_attempt_at)`; INSERT a row from each per-sender catch with the failure reason; UPDATE on success. Pair with a TTL retention (consistent with HousekeepingTTL). (b) **Retry queue**: on per-sender failure, schedule a retry via a separate scheduler with exponential back-off (config keys for retry-count + initial-backoff). Reuses Postgres-as-only-runtime-dependency posture (no new infrastructure). (c) **Operator-visible API**: expose `GET /api/notifications/delivery-status?alert_id=N` so operators can verify delivery; pair with a per-channel "replay" admin action.

**Severity rationale**: HIGH — operational visibility + delivery reliability; combined with REFACTOR-128 (email per-recipient partial delivery) + REFACTOR-129 (no rate-limiting), the Notifications subsystem has the WEAKEST delivery guarantees in the platform. Compliance frameworks requiring "notifications delivered with audit trail" are not satisfied.

**Suggested backlog grouping**: `Notifications hardening sprint` (cross-batch with REFACTOR-127 / -128 / -137).

---
