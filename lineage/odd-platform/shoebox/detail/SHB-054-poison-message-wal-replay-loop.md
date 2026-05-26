# SHB-054 — A single un-deliverable ALERT row blocks ALL notifications cluster-wide indefinitely

**Category**: clustering
**Severity**: HIGH

## Hypothesis

If an operator configures notifications and ANY single ALERT row produces a RuntimeException at translate-or-process time (unknown alert-type code, missing data-entity FK, malformed entity_oddrn from AlertManager webhook, Freemarker template render failure on dataEntityName, JsonProcessingException on a future schema-change), the WAL subscriber enters an INFINITE replay loop: it processes the same LSN every 10 seconds, fails identically every time, never advances `setAppliedLSN`/`setFlushedLSN`, and consequently EVERY subsequent alert in the WAL queue is stranded behind it. Operators see "alerts stopped delivering" with NO surfaced root cause — the only remediation is to manually clean the bad row or run `pg_drop_replication_slot(...)` (which loses every undelivered alert cluster-wide). No DLQ, no skip-poison hook, no operator-visible counter for "stuck-at-LSN", no Prometheus metric. This is the load-bearing fragility of the entire F-009 pillar.

## Evidence

- `odd-platform-api/src/main/java/.../notification/NotificationSubscriber.java:77-91` — inner-loop structure: decode → `messageProcessor.process(decodedMessage.get())` → `setAppliedLSN/setFlushedLSN` IN THAT ORDER, with NO try/catch around `process(...)`. LSN advances only on successful return.
- `NotificationSubscriber.java:90-100` — outer-loop catch: `catch (final Exception e) { log.error(...) }` + 10s sleep + retry. Uniformly handles transient PG connection blips AND persistent poison rows — operator cannot distinguish.
- `AlertNotificationMessageProcessor.java:23-24` — `messageTranslator.translate(message)` is NOT wrapped; the translator throws `IllegalArgumentException` on unknown alert-type codes (`AlertNotificationMessageTranslator.java:87`) and `IllegalStateException` on missing/duplicate alerted-entity rows (`AlertNotificationMessageTranslator.java:94-101`).
- `EmailNotificationSender.java:58-60` + the SHB-053 RuntimeException bypass — email-side failures also propagate up to the same loop.
- `WebhookNotificationSender.java:22` + `JSONSerDeUtils.java:62-64` — `JsonProcessingException` wraps as raw `RuntimeException`; latent extension.
- `NotificationSubscriber.java:104-126,128-158` — lazy-create-no-drop policy: operator's only remediation is `pg_drop_replication_slot(...)` per live doc (`configuration-and-deployment/odd-platform`, verified 2026-05-20).
- `NotificationsDispatcher` sidecar `bugs_limitations_corner_cases.[6]` (HIGH severity) and `NotificationSubscriber.md.bugs_limitations_corner_cases.[0]` (HIGH severity) both anchor the `poison-message-wal-replay-loop` invariant; concept catalog entry at `concepts.yaml:4580`.
- `NotificationSubscriberStarter` sidecar caveat: `NotificationSubscriberStarter.java:33-35` submits the subscriber thread but never retains the `Future`, so if `run()` exits (e.g. on uncancellable-interrupt during 10s sleep), the executor's worker is gone for the JVM lifetime — silent total-shutdown of notifications with NO log line tracking the death.
- Live doc explicit silence: per `NotificationSubscriber.md.docs_link_semantic.doc_drift_findings[2]`, the live notifications page does NOT document at-least-once semantics, restart behaviour, or poison-replay recovery; operators have NO live-doc-anchored remediation.

## Notes

- This is BOTH an ENRICHER for F-009 (extends a facet to its true severity) AND a candidate net-new F-NNN ("Notification delivery durability surface — operator visibility into stuck deliveries"). The behaviour is observable at the operator level: alerts stop arriving, no UI signal, no metric, only `log.error` lines repeating every 10 seconds.
- The single-table publication (`registerPublication(connection, Tables.ALERT)` at `NotificationSubscriber.java:51`) bounds the blast radius to the alerting subsystem — a future addition of activity events / DataCollaboration events to the same publication would multiply the impact.
- WAL retention amplifies: Postgres keeps WAL on the primary until `confirmed_flush_lsn` advances. A poison row pinned for a week on a high-INSERT-rate deployment can fill the primary's `wal_keep_size` budget and threaten replication to other consumers (Debezium, streaming replicas).
- Compound with SHB-053 (cross-channel abort): an email-side template-render bug → infinite WAL replay → all channels stuck → operator sees nothing.
- The 10s retry cadence is hardcoded (`NotificationSubscriber.java:96`); no operator-tunable knob exists for exponential backoff.
- Remediation gap is operator-visible: the only known fix is `pg_drop_replication_slot('odd_platform_replication_slot')` per the live doc cleanup SQL — destructive AND requires DBA-level PG access.

## Next

1. **Graduate** as F-NNN "Poison-message WAL replay" — concept already exists, no F-NNN anchor. Pillar P-07. Add HIGH-severity SEC/PERF findings as part of the feature card.
2. **Open follow-ups**:
   - REFACTOR-NNN — add a configurable `notifications.wal.poison-message-max-retries` knob; after N retries of the same LSN, log a structured WARN with the LSN + the exception + the row's `dataEntityOddrn`, advance the LSN to skip the poison, and emit a metric/event the operator can alert on.
   - REFACTOR-NNN — surface a `notifications_wal_last_applied_lsn` Prometheus gauge + `notifications_wal_messages_processed_total` counter; without these, operators cannot detect "stuck."
   - REFACTOR-NNN — `NotificationSubscriberStarter` should retain the Future and restart on thread death.
3. **DOC-NNN** — update `features/active-platform-features/notifications` AND `configuration-and-deployment/odd-platform` to surface the poison-replay failure mode + remediation runbook.
4. **Probe**: introduce a synthetic ALERT row with an invalid alert-type code (cast int from outside the enum's int range via direct DB INSERT), observe the WAL subscriber's behaviour for 60 seconds, confirm complete delivery stoppage cluster-wide.

## Links

- cluster_with: [F-009, SHB-053, SHB-055]
- merged_into: (open)
- supersedes: []
