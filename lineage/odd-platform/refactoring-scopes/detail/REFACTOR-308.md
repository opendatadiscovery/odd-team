## REFACTOR-308 — NotificationsDispatcher has no rate-limiting, no batching, no throttle — WAL streams alerts as fast as Postgres decodes them; a burst of 10k alerts translates 1:1 into 10k Slack messages / webhook POSTs / emails; Slack rate-limits (429), dispatcher logs failure, message is gone

**Severity**: HIGH
**Category**: missing-rate-limit
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[2]` (HIGH) — "No rate-limiting / no batching / no token bucket. WAL streams alerts as fast as Postgres decodes them; the dispatcher runs synchronously; senders block on HTTP/SMTP. A burst of 10k alerts (e.g. a misconfigured DQ run flagging every dataset) translates 1:1 into 10k Slack messages, 10k webhook POSTs, 10k emails. Slack will rate-limit (429); dispatcher logs the failure and the message is gone from that channel."

**Description**: `AlertNotificationMessageProcessor.process()` (lines 25-36) iterates senders without any rate-limit, token-bucket, batching, or aggregation. The upstream `NotificationSubscriber.run()` loops indefinitely on `stream.readPending()` and dispatches each decoded message synchronously. A burst of N alerts (e.g. a misconfigured DQ run that flags every dataset in the catalog) translates 1:1 into N Slack messages, N webhook POSTs, N emails. Slack enforces rate limits at the receiver (HTTP 429); `AbstractNotificationSender.java:24-27` checks only for 2xx and treats non-2xx as `NotificationSenderException` — caught by the dispatcher's per-sender guard (per ADR-CANDIDATE-098), logged at ERROR, message gone from that channel (combined with REFACTOR-307 no-retry-no-DLQ, gone permanently).

**Failure mode**: A misconfigured DQ run produces 10,000 failed-test alerts in 30 seconds. The notifications subsystem fires 10,000 Slack messages, 10,000 webhook POSTs, 10,000 emails. Slack's `tier1` per-channel rate limit (1 msg/second sustained, ~5 msg/second burst) means roughly 9,990 Slack messages are 429-rejected within seconds; the dispatcher logs 9,990 errors and discards the messages. The webhook endpoint may handle the burst (operator-dependent) or may rate-limit similarly. The SMTP server may reach a per-sender hourly cap and reject subsequent emails. The downstream effect is "alert storm" — operators are buried in valid-but-too-many notifications AND the platform silently drops most of them.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:25-36` (synchronous loop, no batching, no throttle)
- `AbstractNotificationSender.java:24-27` (200-only check, no 429 handling)
- `AlertNotificationMessageProcessor.java:30-35` (catch-and-log only on 429)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-099 (NEW batch K — sequential synchronous fan-out; deliberate simplicity) defends the absence of parallelism but does NOT defend the absence of rate-limiting. The IMPLIED prescription is that operators expecting bursty alert volumes need rate-limiting at THIS layer (cross-link REFACTOR-129 batch C, same finding from NotificationsProperties angle).

**Proposed remedy**: Three composable fixes. (a) **Per-channel token bucket**: add `notifications.receivers.{slack,webhook,email}.rate-limit: 60/min` config; gate each `notificationSender.send(...)` call on token availability; queue or drop excess (operator-configurable). (b) **Burst-aggregation**: detect alert-storm conditions (>N alerts in M seconds with overlapping data-entity ownership) and emit a SINGLE aggregated alert with a summary ("50 datasets had DQ-test failures; click here for full list"). (c) **429-aware retry with exponential back-off**: in `AbstractNotificationSender`, on HTTP 429 specifically (per `Retry-After` header), enqueue a retry rather than treat as failure. Combine with REFACTOR-307 (audit log + retry queue).

**Severity rationale**: HIGH — operational reliability; an alert storm reveals the absence of every rate-limiting / aggregation mechanism simultaneously, producing the worst-case "alerts arrived but were silently dropped" scenario.

**Suggested backlog grouping**: `Notifications hardening sprint` (cross-batch with REFACTOR-129 / -307).

---
