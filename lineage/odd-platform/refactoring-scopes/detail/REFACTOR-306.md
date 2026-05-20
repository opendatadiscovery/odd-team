## REFACTOR-306 — Translation failures cause WAL re-delivery loop — `IllegalArgumentException` (unknown alert type code) or `IllegalStateException` (missing data entity, duplicate alerted-entity rows) inside `translate()` bypasses the dispatcher and triggers `NotificationSubscriber` outer catch + 10s back-off + re-acquire; the SAME WAL LSN is replayed indefinitely

**Severity**: HIGH
**Category**: idempotency (poison-message replay loop)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[6]` (HIGH) — "Translation failures cause WAL re-delivery loop. A `RuntimeException` (e.g. `IllegalArgumentException` from unknown alert type code, `IllegalStateException` from missing data entity) inside `translate()` bypasses the dispatcher and reaches `NotificationSubscriber.java:90`. NotificationSubscriber logs the error, releases the lock, waits 10s, and re-acquires. The SAME WAL LSN is replayed — the dispatcher is invoked again on the same poison message indefinitely, with 10s back-off between cycles, blocking subsequent WAL messages from being processed."

**Description**: ADR-CANDIDATE-100 (NEW batch K — translate-before-fan-out atomic; fail-loud on data-integrity, fail-soft on delivery) is the architectural posture. The fail-loud side of that bifurcation has a structural hazard: when `translate()` raises a `RuntimeException`, the WAL LSN advancement at `NotificationSubscriber.java:83-84` does NOT execute (process() never returns successfully). The outer catch at line 90 logs the error, releases the advisory lock, sleeps 10s, and re-acquires the lock — at which point the SAME WAL message is decoded and translated again, with the same data, producing the same exception. The cycle repeats indefinitely (10s back-off between iterations); meanwhile subsequent WAL messages buffer in the replication slot until either operator intervention OR the platform restarts (which may or may not clear the upstream state depending on what caused the exception).

**Failure mode**: A migration adds a new alert type code (e.g. `LATE_ARRIVING_DATA`); the database inserts the row, but the running platform's `AlertNotificationMessageTranslator.java:87` switch over alert-type-codes throws `IllegalArgumentException(\"Unknown alert type code: 42\")`. Every 10 seconds the platform re-decodes the WAL message and re-throws. Notifications STOP entirely for the duration — no Slack, no webhook, no email — because the WAL stream is blocked on the poison message. Operator-visible signal is `log.error` only (no Prometheus counter, no health endpoint).

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:23-24` (uncaught translate call)
- `AlertNotificationMessageTranslator.java:87` (`IllegalArgumentException` on unknown alert-type code)
- `AlertNotificationMessageTranslator.java:94-101` (`IllegalStateException` on missing/duplicate alerted-entity rows)
- `NotificationSubscriber.java:60-91` (outer try/catch + 10s back-off + re-acquire loop)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-100 (NEW batch K — translate-before-fan-out / fail-loud) IS the architectural decision that produces this hazard. The ADR's wording: "translation errors HOLD the LSN (replays the same message); delivery errors ADVANCE the LSN (drops the message)." The fail-loud side has no poison-message escape hatch — the assumption is that translation errors are TRANSIENT (operator fixes the data; the message replays successfully on the next cycle). The IMPLIED prescription is that translation errors must always be data-fix-able; the structural absence is a max-retry / dead-letter / poison-detection mechanism. The fix is REFACTORING within the existing structure (add a retry counter + escape hatch), not changing the ADR.

**Proposed remedy**: Three composable fixes. (a) **Retry-counter escape hatch**: maintain an in-memory counter of consecutive failures for the same LSN at `NotificationSubscriber.java:90`; after N failures (e.g. 5), ADVANCE the LSN with a structured `log.error(\"Poison message at LSN={}; advancing past it\", lsn)` + emit a Prometheus counter `notifications_wal_poison_messages_total` (operator-alertable). (b) **Dead-letter table**: on poison-message detection, INSERT the failed `DecodedWALMessage` into a `notifications_dead_letter` table for operator inspection before advancing the LSN. (c) **Boot-time validation**: at startup, assert that every value in the `alert_type` table has a matching switch-case in `AlertNotificationMessageTranslator` — catches the migration-shape failure at boot rather than at first poison message.

**Severity rationale**: HIGH — operability gap; a single poison message stops ALL notifications indefinitely. Detection is via log inspection only; recovery requires operator intervention. The structural absence of a poison-detection mechanism is a real operational hazard for any operator running notifications under sustained alert volume.

**Suggested backlog grouping**: `Notifications hardening sprint` (alongside REFACTOR-127/-128/-129/-130 batch C). Pair with REFACTOR-313 (no Notifications observability metric) — operators cannot detect "WAL stuck" without log inspection.

---
