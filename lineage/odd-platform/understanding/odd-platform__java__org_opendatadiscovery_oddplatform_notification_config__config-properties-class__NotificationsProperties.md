---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:NotificationsProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-notifications-properties
---

# NotificationsProperties — semantic understanding

## understanding

`NotificationsProperties` is the top-level `@ConfigurationProperties("notifications")` POJO for ODD Platform's outbound alert-notification subsystem — a feature-flagged, off-by-default service that streams `ALERT` table changes via PostgreSQL logical-replication WAL and fans them out to Slack, generic webhook, and SMTP email receivers. The class itself holds only three things: the feature toggle (`enabled`), a deprecated/legacy top-level `webhookUrl`, and the WAL replication-slot coordinates (`wal.advisoryLockId`, `wal.replicationSlotName`, `wal.publicationName`). The remaining notification surface — per-channel receivers (Slack/webhook/email URLs and SMTP credentials) and the `message.downstream-entities-depth` knob — is **NOT** modelled on this class; receiver settings are sister-prefixed under `notifications.receivers.*` and consumed via `@Value` injections plus a sibling `EmailSenderProperties` (`notifications.receivers.email`), while `notifications.message.downstream-entities-depth` is a raw `@Value` injection inside `NotificationConfiguration`. The actual on/off gate for the entire subsystem is `NotificationsFeatureCondition` (referenced via `@ConditionalOnNotifications`), which reads `notifications.enabled` directly through the Spring `Environment` with default `false` — bypassing this POJO's `enabled` field on the boot path.

## concepts

- entities: [NotificationsProperties, WalProperties, EmailSenderProperties (sibling), AlertNotificationMessage, DecodedWALMessage, NotificationSender (Slack | Webhook | Email)]
- operations: [feature-flag gating, WAL replication-slot coordinates carrier, fan-out alert delivery, leader-elected single-thread WAL consumer]
- invariants: [
    "subsystem is disabled by default — `notifications.enabled` defaults to false",
    "feature-condition reads notifications.enabled from Spring Environment directly, NOT from this POJO's `enabled` field",
    "WAL subscriber runs only on the leader node — acquired via Postgres advisory lock id `notifications.wal.advisory-lock-id` (default 100)",
    "replication-slot and publication are created lazily on first run if absent; ODD Platform never drops them on shutdown",
    "fan-out is sequential through `List<NotificationSender>`; per-sender exceptions are caught and logged but do NOT stop the loop"
  ]
- audiences: [platform operator (must enable + configure PG logical replication), alert recipient (Slack channel / webhook endpoint / email inbox)]

## dependencies_semantic

- requires-feature: ["alerting feature must produce rows in the `ALERT` table — notifications are pure consumers of `INSERT`/`UPDATE` on that table"]
- requires-config: [
    "notifications.enabled=true (gate for the whole subsystem, read by NotificationsFeatureCondition)",
    "notifications.wal.advisory-lock-id (default 100) — must NOT collide with partition.advisory-lock-id=90 or datacollaboration.{receive-event,sender-message}-advisory-lock-id=110/120 if they share the same DB",
    "notifications.wal.replication-slot-name (default odd_platform_replication_slot)",
    "notifications.wal.publication-name (default odd_platform_publication_alert)",
    "notifications.message.downstream-entities-depth (default 1; non-negative required — IllegalArgumentException on boot if negative)",
    "at least ONE of notifications.receivers.{slack.url | webhook.url | email.sender} must be set or no sender bean is registered (the fan-out loop iterates an empty list silently)",
    "odd.platform-base-url — used to render clickable links in Slack and email payloads (default http://localhost:8080 — leaks dev hostname into outbound alerts if unset in production)"
  ]
- requires-runtime: [
    "PostgreSQL with wal_level=logical, max_replication_slots>=1, max_wal_senders>=1, wal_keep_size>=16 (per live doc Configuration-and-deployment > Enable Alert Notifications)",
    "Database user must have REPLICATION attribute (ALTER ROLE ... WITH REPLICATION)",
    "PostgreSQLLeaderElectionManager — for the advisory-lock acquisition; without leadership, the subscriber thread blocks indefinitely on acquire()",
    "Freemarker template `email.ftlh` on classpath (Email sender only)",
    "java.net.http.HttpClient — shared singleton bean across Slack + Webhook senders"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "WAL message decoding path (RELATION/INSERT/UPDATE handling in PostgresWALMessageDecoder)",
    "Lazy replication-slot + publication creation on first run",
    "AlertNotificationMessageTranslator — recursive downstream lineage CTE construction at varying depths",
    "Fan-out loop behaviour when one sender throws (does the next sender still get called? — code says yes, but no test asserts it)",
    "Email partial-delivery loop semantics (per live doc, recipient N+1 is skipped after recipient N fails — this is a regression-prone behaviour with zero test coverage)",
    "Configuration validation: blank sender / blank host / blank protocol on `notifications.receivers.email` (IllegalArgumentException paths in NotificationConfiguration#mailSender)",
    "Negative `notifications.message.downstream-entities-depth` rejection on boot",
    "Behaviour when `notifications.enabled=true` but ZERO receivers configured — empty-list fan-out silently no-ops",
    "Leader-election interaction: what happens when leadership is lost mid-stream? (current code: while-loop releases the lock and waits 10s before re-acquire)"
  ]
- test_files: []
- gaps: |
    The entire notification package has ZERO test files in odd-platform-api/src/test (verified via find on path '*notification*' — no Test classes returned). The most likely places a regression lands and goes unnoticed:
      1. Email silent-partial-delivery (one bad recipient drops all subsequent recipients in the same MimeMessage iteration — `EmailNotificationSender#send`).
      2. Slack and Webhook senders throw any `IOException` as `NotificationSenderException` which is caught + logged by `AlertNotificationMessageProcessor` — a misconfigured webhook never surfaces to the operator beyond a log line.
      3. WAL decoder column-meta caching: the decoder caches `tableColumns` keyed by relationId from RELATION messages; if Postgres recycles relationIds across publication recreate, stale meta could decode wrong values. No test covers cache-invalidation.
      4. Replication-slot and publication leak on shutdown — documented as an operator's manual-cleanup responsibility (`SELECT pg_drop_replication_slot(...); DROP PUBLICATION ...`), but if the slot name changes between deploys (config drift), the old slot accumulates WAL forever — risking the primary's disk.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The live `configuration-and-deployment/odd-platform` page contains an `Enable Alert Notifications` section documenting every `notifications.*` key consumed by this POJO and its siblings (notifications.enabled, notifications.wal.{advisory-lock-id,replication-slot-name,publication-name}, notifications.message.downstream-entities-depth, notifications.receivers.{slack.url,webhook.url,email.*}) — and ODD's PostgreSQL replication requirements. This is the canonical configuration home."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Section: "Enable Alert Notifications"
      Quote (WebFetch 2026-05-12, status 200):
        "ODD Platform uses the PostgreSQL replication mechanism to be able to send a notification even if there's a network lag occurred or the Platform crashes."
        "ODD Platform doesn't clean up replication slot it has created."
      PG requirements quoted: "max_wal_senders = 1; wal_keep_size = 16; wal_level = logical; max_replication_slots = 1"
      DB user role: "ALTER ROLE {database_username} WITH REPLICATION"
      Cleanup SQL: "SELECT pg_drop_replication_slot('<>'); DROP PUBLICATION IF EXISTS <>;"
      Known limitations (SMTP) quoted: "SMTP server will hang notification delivery. The JavaMail defaults for `mail.smtp.connectiontimeout`, `mail.smtp.timeout` (read), and `mail.smtp.writetimeout` are infinite." / "Only STARTTLS is supported — implicit-TLS ports (e.g. Gmail port 465, many corporate relays) will not work." / "Self-signed or internal-CA SMTP certificates require a JVM-level workaround. `mail.smtp.ssl.trust` is not exposed as an ODD configuration key." / "Non-ASCII subjects and bodies may be mangled." / "if one recipient fails, subsequent recipients are skipped."
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "The live feature-level overview page describing what notifications carry, the three outbound channels, and the inbound Prometheus AlertManager webhook (separate feature). Anchored on the active-platform-features index."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      H1: "Notifications"
      Quote: "disabled out of the box"
      Outbound channels: "Slack incoming webhook, SMTP email, and generic JSON webhook — each independently configurable."
      Inbound channel: "Prometheus AlertManager webhook ... POST /ingestion/alert/alertmanager ... Requires the `entity_oddrn` label ... endpoint is unauthenticated."
      Caveat: "SMTP timeouts are unset (can hang), email delivery stops at first recipient failure, and the AlertManager webhook lacks authentication safeguards."
  - url: "https://docs.opendatadiscovery.org/active-platform-features/notifications"
    anchor: ""
    rationale: "Older / alternate path referenced from `active-platform-features` listing. Verified non-canonical — 404 on direct fetch; the canonical is under `/features/active-platform-features/notifications`."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 404
    confidence: HIGH
- doc_drift_findings:
  - "The active-platform-features index appears to link `notifications` at a path that 404s (`/active-platform-features/notifications`), while the page renders at `/features/active-platform-features/notifications` — link drift on the index page (candidate DOC-NNN; verify via doc-gap-check on the index file)."
  - "The legacy top-level `notifications.webhookUrl` field exists on `NotificationsProperties` but NO consumer reads it; the live `webhook` channel is bound to `notifications.receivers.webhook.url` instead. The `webhookUrl` field is dead config — undocumented because it is unwired, but it remains a public field of a `@ConfigurationProperties` class and will accept binding silently (no fail-fast). Candidate cleanup item (code) or admonition (docs)."
  - "`notifications.message.downstream-entities-depth` is consumed via raw `@Value`, NOT through this `@ConfigurationProperties` POJO — the POJO model is incomplete vs the actual config surface. Cosmetic for operators but a structural inconsistency vs ODD's `@ConfigurationProperties` pattern elsewhere."

## implicit_adrs

- "Notifications subsystem ships **disabled by default**, gated by a `Condition` that reads `notifications.enabled` from the Spring `Environment` (not by `@ConditionalOnProperty(matchIfMissing=false)` on the bean methods) — encoding a single-source-of-truth, off-by-default stance enforced uniformly across `NotificationConfiguration`, `NotificationSubscriberStarter`, and `AlertNotificationMessageProcessor` via `@ConditionalOnNotifications`." — evidence: NotificationsFeatureCondition.java:8-13 (`getProperty(..., Boolean.class, false)`) + ConditionalOnNotifications.java:1-13 (the meta-annotation) + NotificationConfiguration.java:29 (`@ConditionalOnNotifications` on the @Configuration class) — intent_anchor: "`return context.getEnvironment().getProperty(FeatureResolver.NOTIFICATIONS_ENABLED_PROPERTY, Boolean.class, false);`" — confidence: HIGH

- "Each outbound channel is **independently activated by the presence of its URL/sender key** via `@ConditionalOnProperty(name = \"notifications.receivers.X\")` on the sender bean methods — there is no single 'enable channel' toggle. Absence of a key = no bean = silently no-op for that channel. This is a deliberate ergonomic: operators configure only the channels they want by populating only those keys." — evidence: NotificationConfiguration.java:36 (slack) + NotificationConfiguration.java:69 (webhook) + NotificationConfiguration.java:83 (email) — intent_anchor: "`@ConditionalOnProperty(name = \"notifications.receivers.slack.url\")` / `... webhook.url` / `... email.sender`" — confidence: HIGH

- "Notification fan-out is **fail-soft per channel**: a sender exception is caught at the processor layer, logged at ERROR, and the loop continues to the next sender. The next WAL message is still processed. This encodes a 'one bad channel does not block the others' stance, but it also means a misconfigured webhook is invisible to operators outside log inspection." — evidence: AlertNotificationMessageProcessor.java:26-36 — intent_anchor: "`} catch (final NotificationSenderException e) { log.error(String.format(\"Error occurred while sending notification via %s\", notificationSender.receiverId()), e); }`" — confidence: HIGH

- "The subscriber is a **leader-elected single-thread consumer** of the WAL: `PostgreSQLLeaderElectionManager.acquire(advisoryLockId, true)` blocks until leadership; on the leader, ONE executor-service thread named `notification-subscriber-thread` runs the replication stream loop. This serialises the WAL consumer behind a Postgres advisory lock, preventing duplicate notifications in HA deployments." — evidence: NotificationSubscriberStarter.java:21-32 (single-thread executor + ApplicationReadyEvent kick-off) + NotificationSubscriber.java:39-46 (acquire loop) — intent_anchor: "`Executors.newSingleThreadExecutor(r -> new Thread(r, \"notification-subscriber-thread\"))` + `leaderElectionManager.acquire(walProperties.getAdvisoryLockId(), true)`" — confidence: HIGH

- "Replication-slot and publication are **created lazily on first leader run** if absent, but are **never dropped** by the platform — encoding 'operator owns cleanup' as the stated policy. The live doc page explicitly tells operators to drop them manually." — evidence: NotificationSubscriber.java:99-122 (`SELECT EXISTS ... pg_replication_slots WHERE slot_name = ?` + conditional `createReplicationSlot()`) + NotificationSubscriber.java:128-153 (publication exists-check + conditional CREATE PUBLICATION) — intent_anchor: "live-doc quote (WebFetch 2026-05-12, status 200): 'ODD Platform doesn't clean up replication slot it has created.'" — confidence: HIGH

- "Email is delivered via a **per-recipient loop reusing one `MimeMessage`** — implying intentional simplicity (no BCC fan-out, no batch send) but encoding the partial-delivery caveat the live doc spells out." — evidence: EmailNotificationSender.java:53-58 (`for (final String notificationsEmail : notificationsEmails) { helper.setTo(notificationsEmail); emailSender.send(mimeMessage); }`) — intent_anchor: "live-doc quote: 'if one recipient fails, subsequent recipients are skipped.'" — confidence: MEDIUM (the loop shape is intentional; whether the silent-skip is intentional or a known limitation accepted by the maintainers is ambiguous — the doc frames it as a 'known limitation', not as a feature)

## bugs_limitations_corner_cases

- "Dead config field: `NotificationsProperties.webhookUrl` (the top-level one on this POJO) has NO consumer — the active webhook URL is `notifications.receivers.webhook.url` read by `NotificationConfiguration#webhookNotificationSender` via `@Value`. An operator setting `notifications.webhookUrl=...` (top-level) gets silent acceptance and zero effect." — evidence: NotificationsProperties.java:9 (field declared) + grep across notification package finds no consumer reading `getWebhookUrl()` — severity: MEDIUM

- "`notifications.message.downstream-entities-depth` is a runtime config key the POJO does NOT model — it is consumed via raw `@Value` in `NotificationConfiguration#alertNotificationMessageTranslator`. The `@ConfigurationProperties` surface is incomplete vs the actual config key namespace." — evidence: NotificationConfiguration.java:116-117 + NotificationsProperties.java (no `message` sub-class) — severity: LOW

- "Advisory-lock-id collision risk: `notifications.wal.advisory-lock-id` defaults to 100. ODD platform also uses `partition.advisory-lock-id=90`, `datacollaboration.receive-event-advisory-lock-id=110`, `datacollaboration.sender-message-advisory-lock-id=120` — distinct in the shipped defaults, but if an operator customises any of these and reuses 100, the notification subscriber will never get leadership (or will collide with another subsystem)." — evidence: NotificationsProperties.java:13 (advisoryLockId) + application.yml:177 (`notifications.wal.advisory-lock-id: 100`) + application.yml:198 (`partition.advisory-lock-id: 90`) + application.yml:201-202 (`datacollaboration.receive-event-advisory-lock-id: 110`, `sender-message-advisory-lock-id: 120`) — severity: MEDIUM

- "No retry, no dead-letter, no audit trail on failed notification delivery. `AlertNotificationMessageProcessor` catches `NotificationSenderException`, logs at ERROR, and moves on — the alert is lost from that channel's perspective and there is no record in the `ALERT` table that delivery failed. Operators have no DB-visible signal that notifications stopped working." — evidence: AlertNotificationMessageProcessor.java:30-35 — severity: HIGH

- "Email per-recipient silent partial delivery: `EmailNotificationSender` iterates `notificationsEmails` in order, reusing the same `MimeMessage` and calling `helper.setTo(email); emailSender.send(mimeMessage);` per iteration. Any thrown `MessagingException` aborts the loop via the surrounding try/catch — recipients after the failing one never receive the alert. Documented as a known limitation on the live doc, but the code has no fault-tolerance (no continue-on-error, no per-recipient try/catch)." — evidence: EmailNotificationSender.java:53-61 — severity: HIGH

- "Email `password` is bound as a plain `String` field on `EmailSenderProperties` — no `@Sensitive` / `@Hidden` / masking annotation. Spring's `/actuator/env` (if enabled) will surface it with default sanitisation rules (`password` is in Spring's default mask list, so this is partially mitigated by Spring, but ODD does not assert the masking explicitly)." — evidence: EmailSenderProperties.java:7 (`private String password;`) — severity: LOW

- "Slack and Webhook senders accept ANY `URI` string — no allowlist, no `@URL` validation, no scheme restriction. An operator setting `notifications.receivers.slack.url=file:///etc/passwd` will fail at HTTP-send time, but no boot-time guard catches the mistake. (The constructor's empty-string check at NotificationConfiguration.java:46-48 / 75-77 is the only validation.)" — evidence: NotificationConfiguration.java:42-58 (slack) + NotificationConfiguration.java:69-80 (webhook) — severity: LOW

- "Webhook delivery is single-shot, no signing, no shared-secret, no HMAC. The receiving endpoint cannot verify that a webhook actually originated from ODD Platform vs an attacker who scraped the webhook URL." — evidence: WebhookNotificationSender.java:18-23 (`HttpRequest.newBuilder().uri(webhookUrl).POST(...)` — no auth header, no signature) — severity: MEDIUM

- "Slack webhook delivery: response-status check is hard-coded `== HttpStatus.OK.value()` (200). Slack's incoming webhook can return 2xx other than 200 in edge cases; a non-200 2xx will be misclassified as failure and logged as error even though Slack accepted the message." — evidence: AbstractNotificationSender.java:24-27 (`if (response.statusCode() != HttpStatus.OK.value())`) — severity: LOW

- "Notification fan-out delivers to ALL configured channels for ALL alerts — there is NO per-channel filtering by alert type, severity, data-entity owner, or namespace. An operator wanting 'only Critical alerts to Slack, all alerts to email' cannot express this in config." — evidence: AlertNotificationMessageProcessor.java:25-36 (the loop iterates `List<NotificationSender>` unconditionally on every `AlertNotificationMessage`) + no filter / predicate / config key for routing — severity: MEDIUM

- "No rate-limiting / throttling at any layer: WAL streams as fast as Postgres can decode, the loop in `AlertNotificationMessageProcessor` is synchronous, and senders block on HTTP. A burst of 10k alerts (e.g. a misconfigured data-quality run) will fire 10k Slack messages, 10k webhook POSTs, and 10k emails with no rate cap. Slack will rate-limit the webhook (Slack returns 429), webhooks will overwhelm the receiver, and email recipients will get spammed." — evidence: AlertNotificationMessageProcessor.java:25-36 (synchronous fan-out, no batching, no token bucket) — severity: HIGH

- "No structured audit log of notifications sent: only `log.debug(\"Sending notification message via {}: {}\", ...)` at INFO/DEBUG level. There is no `notification_delivery` table, no metric counter, no Prometheus gauge. Operators have no way to answer 'when did notifications last work?' or 'which alert IDs were delivered to which channels?'." — evidence: AlertNotificationMessageProcessor.java:28 (only DEBUG-level log) — severity: MEDIUM

- "PII surface in notification payloads: `AlertNotificationMessage` carries `dataEntity.{name, dataSourceName, namespaceName}`, `owners[].ownerName`, `eventAt`, and `downstream` lineage entities up to `notifications.message.downstream-entities-depth`. If any data entity or owner name contains operator-supplied free-text (descriptions, table names), it is rendered verbatim into Slack/webhook/email — no redaction, no allowlist. For organisations whose dataset names encode customer identifiers, this is a privacy concern." — evidence: AlertNotificationMessageTranslator.java:73-83 (full builder population from DB columns) + email.ftlh template (renders into HTML body) — severity: MEDIUM

- "Replication-slot orphan risk: if an operator renames `notifications.wal.replication-slot-name` between deployments and forgets to drop the old slot, Postgres retains WAL for the orphaned slot indefinitely — risking primary disk exhaustion. The live doc warns about manual cleanup but does not warn about rename-orphan specifically." — evidence: NotificationSubscriber.java:99-122 (lazy create, never drop) + application.yml:178 (configurable slot name) — severity: MEDIUM

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `NotificationsProperties` is a config-binding POJO, not an HTTP surface. The auth mode does not gate this code directly. The downstream `POST /ingestion/alert/alertmanager` inbound webhook (a SEPARATE feature surfaced under the same `Notifications` doc page) is unauthenticated per the live feature doc, but that endpoint is NOT consumed by THIS POJO — it is a sister inbound channel. (See `bugs_limitations_corner_cases` for the cross-channel observation.)
- **ingestion_filter_relevance**: `NO — outbound subsystem, not on the /ingestion/entities path`. The notification subscriber READS from the `ALERT` table via WAL; it does not participate in the ingestion auth filter chain.
- **authorization_assertions**: [] — config POJO; no `@PreAuthorize` applicable.
- **owner_scoping**: `BYPASSES — fan-out is unconditional`. Every configured channel receives every alert event regardless of which data-entity owners would have been entitled to see it. The `AlertNotificationMessage` payload includes `owners[]` (owner name + title) for the alerted entity, but does NOT route based on them — every Slack channel / webhook URL / email recipient gets every alert. — evidence: AlertNotificationMessageProcessor.java:25-36 (no per-recipient owner filter) + AlertNotificationMessageTranslator.java:73-83 (owners populated, never consulted for routing).
- **data_exposure**: [
    "Full alert payload (alertType, eventType, eventAt, updatedBy, dataEntity.{id,name,dataSourceName,namespaceName,type,owners[]}, downstream lineage entities to configured depth, alertChunks) → any party with access to the configured Slack channel / webhook URL / email inbox, regardless of ODD authentication mode — evidence: AlertNotificationMessageTranslator.java:73-83 + EmailNotificationSender.java:60-89 (template variables) + SlackNotificationSender.java:51-58 (full message via SlackMessageGenerator) + WebhookNotificationSender.java:20-23 (full JSON serialise via JSONSerDeUtils)",
    "Slack webhook URL itself is a credential — anyone with it can post arbitrary messages to that channel; ODD does not mask `notifications.receivers.slack.url` in `/actuator/env` (Spring's default sanitisation does not include 'url')",
    "Email SMTP password → bound as plain `String` on `EmailSenderProperties.password`; Spring's default `/actuator/env` sanitisation masks `password` by name so this is partially mitigated, but not asserted by ODD"
  ]
- **known_security_gaps**: [
    "Webhook deliveries are unsigned — no HMAC, no shared secret, no signature header. A receiver cannot verify origin. — evidence: WebhookNotificationSender.java:18-23 — severity: MEDIUM",
    "Slack and Webhook URLs accept any scheme/host — no `@URL` constraint, no allowlist, no SSRF guard at config-bind time. — evidence: NotificationConfiguration.java:42-80 — severity: LOW",
    "Alert payload routes to ALL configured channels regardless of owner; cross-tenant or multi-team deployments cannot scope notifications to the owning team. — evidence: AlertNotificationMessageProcessor.java:25-36 — severity: MEDIUM",
    "No audit trail of notifications dispatched — no DB record, no metric. Operators cannot answer 'were the alerts I expected actually delivered?' — evidence: AlertNotificationMessageProcessor.java:28 (debug-log only) — severity: MEDIUM",
    "PG replication role is broad: `ALTER ROLE ... WITH REPLICATION` is required cluster-wide; ODD does not document scoping to a per-publication role. — evidence: live doc + NotificationSubscriber.java:38-46 (uses the configured datasource credentials for the replication connection) — severity: LOW"
  ]

## performance

- **hot_paths**: [
    "Per WAL message: `messageDecoder.decode(buffer)` (sync, in-thread) then `messageProcessor.process(decodedMessage)` which runs `messageTranslator.translate(...)` (multi-statement jOOQ query: alert chunks + alerted data entity + recursive downstream CTE) then sequentially iterates `List<NotificationSender>` calling `.send(...)` on each — every send is a synchronous HTTP/SMTP round-trip. End-to-end latency per alert ≈ (decode) + (DB roundtrips for downstream depth=1+) + Σ per channel network RTT. — evidence: NotificationSubscriber.java:64-77 (decode loop) + AlertNotificationMessageProcessor.java:25-36 (sync fan-out) + AlertNotificationMessageTranslator.java:60-86 (translate uses DSLContext)",
    "Recursive downstream lineage CTE in `AlertNotificationMessageTranslator#fetchDownstream` — depth-bounded by `notifications.message.downstream-entities-depth` (default 1). At depth N over wide lineage graphs, the CTE cost scales with the branching factor — evidence: AlertNotificationMessageTranslator.java:122-160"
  ]
- **throughput_characteristics**: [
    "Single-thread WAL consumer per cluster (leader-elected) — throughput bounded by the slowest sender plus translation DB cost. No parallelisation across channels.",
    "Synchronous, no batching — one HTTP/SMTP roundtrip per alert per channel.",
    "Polling loop sleeps 10ms between empty `readPending()` calls — idle CPU baseline is bounded."
  ]
- **resource_allocation**: [
    "Single `HttpClient` bean shared across Slack and Webhook senders (good — connection reuse). — evidence: NotificationConfiguration.java:31-34",
    "`AlertNotificationMessageTranslator` loads full `alertChunks` list + full downstream entities into memory before serialising. Bounded by downstream-entities-depth × branching factor × chunks-per-alert. — evidence: AlertNotificationMessageTranslator.java:60-86 + 122-160",
    "Email sender reuses a single `MimeMessage` instance across recipients in the loop — minor allocation savings; offsets a partial-delivery hazard.",
    "JavaMail SMTP connection: no timeout configured (per live doc: 'JavaMail defaults for `mail.smtp.connectiontimeout`, `mail.smtp.timeout` (read), and `mail.smtp.writetimeout` are infinite') — a hung SMTP server will block the subscriber thread indefinitely, stalling ALL channels."
  ]
- **scaling_characteristics**: [
    "Stateful at the cluster level (PostgreSQL advisory lock id 100 + named replication slot + named publication). Horizontal scaling = exactly one active subscriber. — evidence: NotificationSubscriberStarter.java:21-32 + NotificationSubscriber.java:39-46",
    "Advisory lock id 100 collides with no shipped default (partition=90, datacollab=110/120) but operator-customised lock ids could collide silently — evidence: application.yml:177,198,201,202",
    "Replication slot and publication are global Postgres objects; renaming them requires manual drop of the prior slot or WAL accumulation on the primary — evidence: live doc + NotificationSubscriber.java:99-153",
    "No queueing layer between WAL decode and HTTP send — bursts of alerts directly translate into bursts of outbound HTTP/SMTP requests; no backpressure mechanism."
  ]
- **known_performance_gaps**: [
    "No rate-limiting: bursty alert events translate 1:1 into outbound deliveries. Slack will rate-limit the webhook (429), and the platform has no retry-with-backoff on 429 — it logs the failure and drops the alert from that channel. — evidence: AbstractNotificationSender.java:24-27 + AlertNotificationMessageProcessor.java:30-35 — severity: HIGH",
    "Synchronous fan-out: one slow sender stalls all subsequent senders for the same alert. A misconfigured webhook with a 30s SLA blocks Slack and email delivery. — evidence: AlertNotificationMessageProcessor.java:25-36 — severity: MEDIUM",
    "SMTP timeouts unset (live-doc-documented): a hung SMTP server blocks the subscriber thread forever, stopping ALL notification delivery. — evidence: NotificationConfiguration.java:34-68 (no `mail.smtp.connectiontimeout` / `mail.smtp.timeout` / `mail.smtp.writetimeout` in the Properties bag) + live-doc 'Known limitations' — severity: HIGH",
    "No connection-pool sizing knobs surfaced for the shared `HttpClient`. — evidence: NotificationConfiguration.java:32 (`HttpClient.newHttpClient()` — default executor, default pool) — severity: LOW"
  ]

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsProperties.java:1-19 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:1-130 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsFeatureCondition.java:1-13 + odd-platform-api/src/main/resources/application.yml:172-195
- concepts.entities.NotificationsProperties ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsProperties.java:1-19
- concepts.entities.WalProperties ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsProperties.java:11-17
- concepts.entities.EmailSenderProperties ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:1-18
- concepts.entities.AlertNotificationMessage ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/dto/AlertNotificationMessage.java
- concepts.entities.NotificationSender ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/NotificationSender.java:1-9
- concepts.invariants.disabled-default ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsFeatureCondition.java:11-12 + odd-platform-api/src/main/resources/application.yml:173
- concepts.invariants.feature-condition-reads-env ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsFeatureCondition.java:11-12
- concepts.invariants.leader-election ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriber.java:41
- concepts.invariants.lazy-create-no-drop ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriber.java:99-122,128-153
- concepts.invariants.fan-out-fail-soft ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:30-35
- dependencies_semantic.requires-config ← odd-platform-api/src/main/resources/application.yml:172-195 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:36,69,83,99-100,116
- dependencies_semantic.requires-runtime.pg-config ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-12 status 200) — section "Enable Alert Notifications"
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returns zero matches
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-12, status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-12, status 200)
- docs_link_semantic.inferred_docs[2] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/notifications (verified 2026-05-12, status 404)
- docs_link_semantic.doc_drift_findings[0] (notifications path 404) ← compare WebFetch results on the two URLs above
- docs_link_semantic.doc_drift_findings[1] (dead webhookUrl) ← `grep -rn 'getWebhookUrl\|webhookUrl' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification` returns only the field declaration
- docs_link_semantic.doc_drift_findings[2] (downstream-entities-depth via @Value) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:116-117
- implicit_adrs.[0] (disabled by default) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsFeatureCondition.java:8-13 + ConditionalOnNotifications.java:8-13
- implicit_adrs.[1] (channels independently activated by URL/sender presence) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:36,69,83
- implicit_adrs.[2] (fan-out fail-soft) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:26-36
- implicit_adrs.[3] (leader-elected single thread) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriberStarter.java:21-32 + NotificationSubscriber.java:39-46
- implicit_adrs.[4] (lazy-create-no-drop) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriber.java:99-122,128-153 + WebFetch live-doc quote
- implicit_adrs.[5] (per-recipient loop) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/EmailNotificationSender.java:53-58
- bugs_limitations_corner_cases.[0] (dead webhookUrl field) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsProperties.java:9 + grep negative
- bugs_limitations_corner_cases.[1] (downstream-entities-depth not modeled) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:116
- bugs_limitations_corner_cases.[2] (advisory-lock collision risk) ← odd-platform-api/src/main/resources/application.yml:177,198,201,202
- bugs_limitations_corner_cases.[3] (no retry / DLQ / audit) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:30-35
- bugs_limitations_corner_cases.[4] (email partial-delivery) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/EmailNotificationSender.java:53-61
- bugs_limitations_corner_cases.[5] (email password unmasked) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java:7
- bugs_limitations_corner_cases.[6] (no URL allowlist) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:42-80
- bugs_limitations_corner_cases.[7] (webhook unsigned) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/WebhookNotificationSender.java:18-23
- bugs_limitations_corner_cases.[8] (non-200 2xx misclassified) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/AbstractNotificationSender.java:24-27
- bugs_limitations_corner_cases.[9] (no per-channel filtering) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:25-36
- bugs_limitations_corner_cases.[10] (no rate-limit) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:25-36 + AbstractNotificationSender.java
- bugs_limitations_corner_cases.[11] (no audit trail) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:28
- bugs_limitations_corner_cases.[12] (PII surface) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/translator/AlertNotificationMessageTranslator.java:73-83 + odd-platform-api/src/main/resources/freemarker/email.ftlh
- bugs_limitations_corner_cases.[13] (replication-slot orphan) ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriber.java:99-122 + WebFetch live-doc
- security.auth_mode_relevance ← N/A — config POJO
- security.ingestion_filter_relevance ← N/A — outbound subsystem
- security.owner_scoping ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:25-36
- security.data_exposure.[0] (full alert payload) ← AlertNotificationMessageTranslator.java:73-83 + EmailNotificationSender.java:60-89 + SlackNotificationSender.java:51-58 + WebhookNotificationSender.java:20-23
- security.data_exposure.[1] (slack webhook url credential) ← NotificationConfiguration.java:42 (@Value injection, no masking annotation)
- security.data_exposure.[2] (email password) ← EmailSenderProperties.java:7
- security.known_security_gaps.[0] (webhook unsigned) ← WebhookNotificationSender.java:18-23
- security.known_security_gaps.[1] (no URL allowlist) ← NotificationConfiguration.java:42-80
- security.known_security_gaps.[2] (no owner scoping) ← AlertNotificationMessageProcessor.java:25-36
- security.known_security_gaps.[3] (no audit) ← AlertNotificationMessageProcessor.java:28
- security.known_security_gaps.[4] (broad replication role) ← WebFetch live-doc + NotificationSubscriber.java:38-46
- performance.hot_paths.[0] (per-WAL message latency) ← NotificationSubscriber.java:64-77 + AlertNotificationMessageProcessor.java:25-36 + AlertNotificationMessageTranslator.java:60-86
- performance.hot_paths.[1] (downstream CTE) ← AlertNotificationMessageTranslator.java:122-160
- performance.resource_allocation.smtp-timeouts ← WebFetch live-doc + NotificationConfiguration.java:34-68
- performance.scaling_characteristics ← NotificationSubscriberStarter.java:21-32 + NotificationSubscriber.java:39-46 + application.yml:177,198,201,202
- performance.known_performance_gaps.[0] (no rate-limit) ← AbstractNotificationSender.java:24-27 + AlertNotificationMessageProcessor.java:30-35
- performance.known_performance_gaps.[1] (synchronous fan-out) ← AlertNotificationMessageProcessor.java:25-36
- performance.known_performance_gaps.[2] (SMTP timeouts) ← NotificationConfiguration.java:34-68 + WebFetch live-doc
- performance.known_performance_gaps.[3] (no pool sizing) ← NotificationConfiguration.java:32

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

(none — net-new sidecar for a new area)
