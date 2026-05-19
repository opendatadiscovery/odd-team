## REFACTOR-311 — NotificationsDispatcher empty-senders silent no-op with continued DB cost — `translate()` runs on EVERY WAL event even when `notifications.enabled=true` but ZERO receivers are configured; recursive lineage CTE executed for zero delivery

**Severity**: MEDIUM
**Category**: missing-validation (silent-feature-ignored)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[7]` (MEDIUM) — "Empty-senders silent no-op with continued DB cost. When `notifications.enabled=true` but ZERO receivers are configured, `List<NotificationSender>` is empty (the `@ConditionalOnProperty`-gated sender beans never register). The dispatcher still RUNS — it calls `messageTranslator.translate(message)` on every WAL event (multi-statement jOOQ read incl. recursive CTE) and then no-ops the empty fan-out loop. The DB cost is paid for zero delivery, with no operator-visible warning at boot or per-message."

**Description**: An operator enabling `notifications.enabled: true` but forgetting to configure any of `notifications.receivers.{slack,webhook,email}` URLs/sender keys gets the FULL Notifications subsystem startup (advisory-lock acquisition, replication slot creation, WAL consumer thread), the `AlertNotificationMessageProcessor` bean registers (its `@ConditionalOnNotifications` is satisfied), but `List<NotificationSender>` is empty (per ADR-CANDIDATE-041 — each sender bean is `@ConditionalOnProperty`-gated on its respective URL key). Every WAL `ALERT`-row event triggers `messageTranslator.translate(message)` (`AlertNotificationMessageProcessor.java:23`) — a multi-statement jOOQ read of `alert_chunk` rows + the alerted-data-entity join + a recursive downstream-lineage CTE — and then the for-loop iterates an empty list and no-ops. The DB cost is paid PER ALERT for zero delivery; there is no boot-time warning, no debug-log on empty senders, no operator-visible signal.

**Failure mode**: An operator sets `notifications.enabled: true` in development to test the subsystem, forgets to set any `notifications.receivers.*` keys, and forgets to roll back. In production, every alert event runs the full translate() (including the lineage CTE) for nothing — silent extra DB load proportional to alert volume.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:23` (translate runs before sender-count check)
- `NotificationConfiguration.java:36 / 69 / 83` (each sender bean is `@ConditionalOnProperty`-gated, so absence = bean not registered = empty collection)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-040 (subsystem disabled-by-default) and ADR-CANDIDATE-041 (per-channel URL-presence activation) together frame the activation model. The IMPLIED prescription is that `notifications.enabled=true` AND `notifications.receivers.*` empty is a misconfiguration; the absence of detection is the gap.

**Proposed remedy**: Two composable fixes. (a) **Boot-time warning**: at startup, log `WARN: notifications.enabled=true but no notifications.receivers.* configured; dispatcher will translate alerts but deliver to nothing` if `notificationSenders.isEmpty()` at construction. (b) **Per-message early-exit**: gate the `translate()` call on `notificationSenders.isEmpty()` — `if (notificationSenders.isEmpty()) { log.debug("Empty senders; skipping translate for LSN={}", lsn); return; }`. Pair with a Prometheus counter `notifications_empty_dispatch_total` so operators can detect the misconfiguration.

**Severity rationale**: MEDIUM — operational efficiency + misconfiguration-detection; silent extra DB load proportional to alert volume; mostly cosmetic for low-volume deployments, measurable for high-volume ones.

**Suggested backlog grouping**: `Notifications hardening sprint` (operator-config UX bundle)

---
