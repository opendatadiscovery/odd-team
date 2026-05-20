---
node_id: "odd-platform java service service:NotificationsDispatcher"
node_kind: service
axis: services
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-notifications-dispatcher
schema_version: v0.3.0
node_target_alias: |-
  The substrate node id `service:NotificationsDispatcher` does not map to a literally-named
  `NotificationsDispatcher.java` file in the codebase. The dispatcher role — per-channel
  fan-out of decoded WAL alert messages to the configured Slack / Webhook / Email senders —
  is implemented by `AlertNotificationMessageProcessor`
  (`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java`),
  which is the sole implementor of the `PostgresWALMessageProcessor` interface and the
  injected `messageProcessor` field on `NotificationSubscriber`. This sidecar enriches the
  dispatcher role at that file, with the upstream caller chain
  (`NotificationSubscriberStarter` → `NotificationSubscriber.run()` → `messageProcessor.process(...)`)
  and downstream sender chain (`Slack` / `Webhook` / `Email` `NotificationSender` impls) treated
  as 1-hop neighbours per the per-file fresh-context rule.
---

# NotificationsDispatcher (AlertNotificationMessageProcessor) — semantic understanding

## understanding

`AlertNotificationMessageProcessor` is the dispatcher node of ODD Platform's outbound notification chain — the per-channel fan-out that runs INSIDE the leader-elected WAL-consumer thread once `NotificationSubscriber` has decoded an `ALERT`-row WAL message. The dispatcher receives a `DecodedWALMessage` (INSERT or UPDATE on `ALERT`), invokes `NotificationMessageTranslator.translate(...)` to enrich it into an `AlertNotificationMessage` (a multi-statement jOOQ read of `alert_chunk`, the alerted `data_entity` row joined to `owner` / `namespace` / `data_source`, and a recursive downstream-lineage CTE bounded by `notifications.message.downstream-entities-depth`), then iterates `List<NotificationSender<AlertNotificationMessage>>` synchronously and calls `.send(...)` on each — Slack, Generic Webhook, SMTP Email — catching `NotificationSenderException` per-sender and continuing the loop on failure. The dispatcher carries no retry, no dead-letter queue, no delivery audit table, no metric counter, no per-channel filter (every channel gets every alert), no owner-scoping (every recipient gets every alert regardless of which Owner the alerted data entity belongs to), and no rate-limit — a one-bad-channel-does-not-block-the-others stance encoded as a try/catch around `notificationSender.send(...)`.

## concepts

- entities: [AlertNotificationMessageProcessor (dispatcher), PostgresWALMessageProcessor (interface), DecodedWALMessage, AlertNotificationMessage, NotificationSender (Slack | Webhook | Email), NotificationMessageTranslator (AlertNotificationMessageTranslator), NotificationSenderException]
- operations: [translate-decoded-WAL-to-AlertNotificationMessage, fan-out-sequential-per-channel, per-sender exception catch-and-log, continue-on-channel-failure]
- invariants: [
    "dispatcher runs ONLY inside the leader-elected single-thread WAL consumer (one cluster-wide active instance) — caller is `NotificationSubscriber.run()` which acquires `notifications.wal.advisory-lock-id` (default 100) via `PostgreSQLLeaderElectionManager`",
    "dispatcher is created lazily via Spring `@ConditionalOnNotifications` — bean does not exist if `notifications.enabled=false` (the default)",
    "fan-out is SEQUENTIAL through `List<NotificationSender>` — one slow sender delays all subsequent senders for the same alert",
    "per-sender exceptions of type `NotificationSenderException` are caught, logged at ERROR with the receiver id, and the loop continues to the NEXT sender for the SAME message",
    "the loop iterates every sender bean Spring registered — operators cannot route alerts conditionally (no per-channel filter, no severity gate, no owner-match)",
    "translation runs BEFORE fan-out — a translation failure (e.g. unknown alert type code, missing data entity, null type_id) throws and is NOT caught here, propagating to NotificationSubscriber's outer catch which logs and waits 10s before re-acquiring the lock"
  ]
- audiences: [platform-operator (configures channels), notification-recipient (Slack channel / webhook endpoint / email inbox), odd-platform-ui-end-user (the alert that triggers the dispatch originated in their UI)]

## dependencies_semantic

- requires-feature: [
    "P-07 Active Platform Features > Notifications sub-feature (live doc: https://docs.opendatadiscovery.org/features/active-platform-features/notifications)",
    "P-07 Active Platform Features > Alerting (the source of `ALERT` table rows — dispatcher consumes WAL events on INSERT/UPDATE; without Alerting producing rows, dispatcher is idle)",
    "P-05 Data Lineage (the recursive CTE in `AlertNotificationMessageTranslator#fetchDownstream` walks the LINEAGE table — downstream-depth>0 requires populated lineage edges)"
  ]
- requires-config: [
    "notifications.enabled=true (NotificationsFeatureCondition gate) — without it, the @Component is not instantiated by Spring",
    "at least ONE of notifications.receivers.{slack.url | webhook.url | email.sender} must be set or the injected `List<NotificationSender>` is empty and every WAL message is decoded + translated + no-op-fan-out (silent dispatch)",
    "notifications.message.downstream-entities-depth (default 1) — bounds the CTE cost in translate()",
    "odd.platform-base-url — used by EmailNotificationSender to render the alert link (default http://localhost:8080 leaks into outbound mails if unset in production)"
  ]
- requires-runtime: [
    "PostgreSQL with wal_level=logical + REPLICATION role + replication slot + publication (configured by `NotificationSubscriber` — dispatcher inherits these requirements transitively)",
    "PostgreSQLLeaderElectionManager (advisory-lock acquisition; without leadership the upstream NotificationSubscriber blocks indefinitely on acquire() and dispatcher never runs)",
    "java.net.http.HttpClient (shared singleton bean — Slack + Webhook share it; Email uses JavaMailSender instead)",
    "JavaMailSender (only when email sender is registered; conditionally created in NotificationConfiguration)",
    "Freemarker `email.ftlh` template on classpath (only when email sender is registered)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Fan-out continues to next sender after one sender throws NotificationSenderException"
    upstream_callers: ["NotificationSubscriber.run() at NotificationSubscriber.java:80 — calls messageProcessor.process(decodedMessage)"]
    downstream_side_effects: ["log.error invoked with receiver id of failing sender", "next sender in List<NotificationSender> still receives .send(message)"]
    test_class: "missing — no test class exists for AlertNotificationMessageProcessor"
  - behaviour: "Translation failure (unknown alert type code, missing data entity, null type_id) propagates out of process() — not caught here"
    upstream_callers: ["NotificationSubscriber.run() — outer catch at NotificationSubscriber.java:90 logs and triggers 10s back-off"]
    downstream_side_effects: ["WAL stream's setAppliedLSN/setFlushedLSN NOT called for this LSN — message is re-delivered after re-acquisition", "lock released; 10s sleep; re-acquire"]
    test_class: "missing"
  - behaviour: "Empty List<NotificationSender> — process() decodes + translates + no-ops the fan-out loop"
    upstream_callers: ["NotificationSubscriber.run()"]
    downstream_side_effects: ["DB read for alert_chunk + alerted entity + downstream still executes per message (cost without delivery)", "log.debug per-sender NOT emitted because loop body never runs"]
    test_class: "missing"
  - behaviour: "Per-sender exception is NotificationSenderException specifically — RuntimeException from a sender bypasses the catch and propagates"
    upstream_callers: ["NotificationSubscriber.run()"]
    downstream_side_effects: ["EmailNotificationSender's RuntimeException wrap at EmailNotificationSender.java:59 bypasses the per-sender catch; entire process() invocation aborts mid-fan-out (subsequent senders skipped)"]
    test_class: "missing — this asymmetry between checked NotificationSenderException (caught) and RuntimeException (propagates) is undocumented and untested"
  - behaviour: "Sequential fan-out — slow sender N blocks senders N+1..M for the same message"
    upstream_callers: ["NotificationSubscriber.run() — single-thread executor at NotificationSubscriberStarter.java:21-23 means no parallelism"]
    downstream_side_effects: ["Backpressure on WAL stream: subsequent messages buffered in stream.readPending() until the synchronous loop returns"]
    test_class: "missing"
  - behaviour: "ALL configured senders receive ALL alerts — no per-channel filter by alert type / severity / data-entity owner"
    upstream_callers: ["NotificationSubscriber.run()"]
    downstream_side_effects: ["Slack receives Critical + Minor; email receives Critical + Minor; no operator-visible config knob to route subset"]
    test_class: "missing — no test asserts the unconditional broadcast (it is the implicit ADR but unverified by suite)"
- test_files: []
- gaps: |-
    `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` and
    `find <odd-platform-repo> -name '*Notification*Test*.java'` both return zero matches.
    The entire `notification/` package — dispatcher + senders + translator + decoder +
    subscriber + leader-election interaction — has NO test coverage at the
    odd-platform-api level. The dispatcher's specific gaps:
      1. Per-sender exception path (catch-NotificationSenderException-and-continue) is the
         load-bearing implicit ADR — untested. A regression to `catch (Exception e)` →
         `catch (NotificationSenderException e)` change OR to break out of the loop on
         first error would silently flip the dispatcher's stance.
      2. RuntimeException-leaks: `EmailNotificationSender` wraps MessagingException as
         `new RuntimeException(...)` at EmailNotificationSender.java:59, NOT as
         `NotificationSenderException` — meaning email failures BYPASS the per-sender
         catch in AlertNotificationMessageProcessor.java:30-35 and abort the entire
         fan-out for that message. This asymmetry is undocumented and a regression
         hazard.
      3. Empty-senders no-op: when `notifications.enabled=true` but ZERO receivers are
         configured, every WAL message still triggers translate() (DB cost) for zero
         delivery — wasted work, no test asserts the operator-visible behaviour.
      4. Sender-iteration order: `List<NotificationSender>` order depends on Spring's
         bean-collection order (registration order ≈ class-name order ≈ undefined). A
         deterministic-order test or admonition is missing — operators cannot predict
         which channel runs first.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: |-
      The live feature-level notifications page describes the dispatcher's behaviour
      directly — fan-out across channels, per-channel failure handling, partial-delivery
      and SMTP-timeout caveats. The dispatcher is the runtime that implements every
      claim on that page.
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |-
      WebFetch 2026-05-19, status 200:
        "An alert dispatched to multiple channels is delivered to every channel that is enabled."
        "An unreachable SMTP server will hang notification delivery" because "JavaMail
         defaults for connection / read / write timeouts are infinite, and ODD Platform
         does not override them."
        "If recipient N fails (bad address, mailbox full, server-side rejection), the
         loop stops — recipients N+1, N+2, … never receive the alert. There is no retry
         and no partial-failure metric."
        "The documentation does not describe retry logic, dead-letter queues, audit
         trails, rate-limiting, or owner-based message scoping for any channel."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: |-
      The configuration page documents the `notifications.*` config keys and the
      PostgreSQL replication prerequisites — operationally relevant to the dispatcher
      because the dispatcher only runs once the leader-elected WAL subscriber has
      acquired the advisory lock and decoded a message.
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |-
      (Re-using verified excerpts from the NotificationsProperties sidecar
       enriched on 2026-05-12, status 200 — the configuration surface for
       this code path has not changed between batches C and K.)
        "ODD Platform uses the PostgreSQL replication mechanism to be able to send a
         notification even if there's a network lag occurred or the Platform crashes."
        "ODD Platform doesn't clean up replication slot it has created."
- doc_drift_findings:
  - "Live doc names the limitations (no retry / DLQ / audit / rate-limit / owner-scoping) explicitly but does not name the implementation site (`AlertNotificationMessageProcessor`) or the implicit ADR shape (catch-and-continue per channel). Doc-product editorial follow-up: link from the live notifications page to the implicit ADR catalog when one ships (DOC-NNN candidate, NOT blocking)."
  - "Live doc says 'every channel that is enabled' receives every alert — TRUE in code, but the code does NOT enable per-channel filtering of any kind. The live-doc framing is accurate but invites the operator question 'can I route Critical to Slack only?' — no, because the dispatcher has no filter hook. Surfacing this explicitly in the doc would close an implicit-expectation gap (DOC-NNN candidate)."
  - "Live doc on partial-delivery (email recipient N+1 silently skipped) is accurate to the code — but the doc does not mention the asymmetric exception types: `MessagingException` from email is wrapped as `RuntimeException` and propagates OUT of the dispatcher's per-sender catch, aborting fan-out to subsequent senders for that message. This is materially different from the documented 'next channel still runs' behaviour for Slack/Webhook (which throw the checked `NotificationSenderException`). The asymmetry warrants either a code fix (wrap as `NotificationSenderException`) or a doc admonition."

## implicit_adrs

- "**Per-channel catch-and-continue fan-out.** The dispatcher catches `NotificationSenderException` per-sender, logs at ERROR with the receiver id, and proceeds to the NEXT sender for the SAME message. Encodes a 'one bad channel does not block the others' stance — Slack outage does not stop email delivery." — evidence: AlertNotificationMessageProcessor.java:29-35 — intent_anchor: |-
  `try { notificationSender.send(notificationMessage); } catch (final NotificationSenderException e) { log.error(String.format("Error occurred while sending notification via %s", notificationSender.receiverId()), e); }`
  — confidence: HIGH

- "**Sequential synchronous fan-out — no parallelism across channels.** The dispatcher iterates `List<NotificationSender>` with a `for` loop and blocks per sender on `.send(...)`. Encodes a deliberate-simplicity stance: no thread pool, no async, no per-channel SLA budget. One slow sender delays subsequent senders." — evidence: AlertNotificationMessageProcessor.java:25-36 — intent_anchor: "`for (final NotificationSender<AlertNotificationMessage> notificationSender : notificationSenders) { ... notificationSender.send(...) ... }`" — confidence: HIGH

- "**Dispatcher exists conditionally — disabled by default.** The whole bean is gated by `@ConditionalOnNotifications` which reads `notifications.enabled` from the Spring `Environment` with default `false`. Encodes the off-by-default subsystem stance uniformly with the rest of the notification package (NotificationConfiguration, NotificationSubscriberStarter, sender beans all share the same condition)." — evidence: AlertNotificationMessageProcessor.java:14-15 (`@Component` + `@ConditionalOnNotifications`) + NotificationsFeatureCondition.java:11-12 (`context.getEnvironment().getProperty(FeatureResolver.NOTIFICATIONS_ENABLED_PROPERTY, Boolean.class, false)`) — intent_anchor: "`@ConditionalOnNotifications` on the `@Component`-annotated dispatcher class" — confidence: HIGH

- "**Translation happens INSIDE process() before fan-out, NOT in a separate stage.** The dispatcher composes translate→fan-out atomically in one method call from the WAL consumer. This means a translation failure (unknown alert type, missing entity) propagates OUT and triggers the upstream subscriber's outer catch + 10s back-off + re-acquire — re-delivering the SAME WAL LSN until the data is consistent. Encodes a 'fail-loud on data-integrity errors, fail-soft on delivery errors' bifurcation." — evidence: AlertNotificationMessageProcessor.java:23-24 (`final AlertNotificationMessage notificationMessage = messageTranslator.translate(message);`) — intent_anchor: |-
  Translation is uncaught in `process()`; only sender-layer `NotificationSenderException` is caught. Translator throws `IllegalArgumentException` on unknown alert-type code (AlertNotificationMessageTranslator.java:87) and `IllegalStateException` on missing/duplicate alerted-entity rows (AlertNotificationMessageTranslator.java:94-101) — both bypass the dispatcher's try/catch and reach NotificationSubscriber.java:90.
  — confidence: HIGH

## bugs_limitations_corner_cases

- "**Asymmetric exception handling between sender impls.** The dispatcher's per-sender try/catch catches `NotificationSenderException` (checked) only. `EmailNotificationSender` wraps `MessagingException | TemplateException | IOException` as `new RuntimeException(...)` at EmailNotificationSender.java:59 — NOT as `NotificationSenderException`. An email failure therefore BYPASSES the dispatcher's catch and aborts fan-out for that message, meaning subsequent senders (if email is not last in the list) do NOT receive the alert. This contradicts the implicit 'catch-and-continue' ADR for one channel only." — evidence: AlertNotificationMessageProcessor.java:31 (catches NotificationSenderException only) + EmailNotificationSender.java:58-60 (throws raw RuntimeException) — severity: HIGH

- "**No retry, no dead-letter, no audit.** A failed delivery (any channel, any reason) is logged at ERROR and the message is treated as delivered from the dispatcher's perspective. The WAL stream's `setAppliedLSN` and `setFlushedLSN` are advanced regardless (NotificationSubscriber.java:83-84) — the dispatcher has no way to signal 'do not advance LSN'. Operators have NO database record of delivery success/failure per alert per channel." — evidence: AlertNotificationMessageProcessor.java:30-35 (catch-and-log only) + NotificationSubscriber.java:83-84 (LSN advanced unconditionally after process() returns) — severity: HIGH

- "**No rate-limiting / no batching / no token bucket.** WAL streams alerts as fast as Postgres decodes them; the dispatcher runs synchronously; senders block on HTTP/SMTP. A burst of 10k alerts (e.g. a misconfigured DQ run flagging every dataset) translates 1:1 into 10k Slack messages, 10k webhook POSTs, 10k emails. Slack will rate-limit (429); dispatcher logs the failure and the message is gone from that channel." — evidence: AlertNotificationMessageProcessor.java:25-36 (synchronous loop, no batching, no throttle) — severity: HIGH

- "**No per-channel filtering by alert type / severity / owner / namespace.** Every alert goes to every configured channel. An operator wanting 'Critical to Slack, all to email' cannot express that — no filter / predicate / config key for routing exists between the dispatcher and the senders." — evidence: AlertNotificationMessageProcessor.java:25-36 (the loop iterates `notificationSenders` unconditionally) — severity: MEDIUM

- "**No backlog metric / no notification-queue depth.** The dispatcher emits only `log.debug(\"Sending notification message via {}: {}\", ...)` at DEBUG level (off in default log config). There is no Prometheus counter for `notifications_sent_total`, no histogram for delivery latency, no gauge for backlog depth (WAL lag), no failure-rate-by-channel metric. Operators have no observability primitive to alert on 'notifications broken'." — evidence: AlertNotificationMessageProcessor.java:28 (only debug log) — severity: MEDIUM

- "**Sender iteration order is undefined / Spring-bean-order-dependent.** `List<NotificationSender>` is injected as a bean collection. The order — Slack first? Email last? — depends on Spring's bean-registration order, which is class-scan-order-dependent in practice. A change to the codebase (rename, package move, conditional registration order change) can silently flip the order and the slowest sender now sits first, blocking the others." — evidence: AlertNotificationMessageProcessor.java:19 (`private final List<NotificationSender<AlertNotificationMessage>> notificationSenders;` — no `@Order` annotation, no `Comparator`, no explicit sort) — severity: LOW

- "**Translation failures cause WAL re-delivery loop.** A `RuntimeException` (e.g. `IllegalArgumentException` from unknown alert type code, `IllegalStateException` from missing data entity) inside `translate()` bypasses the dispatcher and reaches `NotificationSubscriber.java:90`. NotificationSubscriber logs the error, releases the lock, waits 10s, and re-acquires. The SAME WAL LSN is replayed — the dispatcher is invoked again on the same poison message indefinitely, with 10s back-off between cycles, blocking subsequent WAL messages from being processed." — evidence: AlertNotificationMessageProcessor.java:23-24 (uncaught translate call) + NotificationSubscriber.java:60-91 (outer try/catch + 10s back-off + re-acquire) — severity: HIGH

- "**Empty-senders silent no-op with continued DB cost.** When `notifications.enabled=true` but ZERO receivers are configured, `List<NotificationSender>` is empty (the `@ConditionalOnProperty`-gated sender beans never register). The dispatcher still RUNS — it calls `messageTranslator.translate(message)` on every WAL event (multi-statement jOOQ read incl. recursive CTE) and then no-ops the empty fan-out loop. The DB cost is paid for zero delivery, with no operator-visible warning at boot or per-message." — evidence: AlertNotificationMessageProcessor.java:23 (translate runs before sender-count check) + NotificationConfiguration.java:36 / 69 / 83 (each sender bean is `@ConditionalOnProperty`-gated, so absence = bean not registered = empty collection) — severity: MEDIUM

- "**PII surface: every channel gets full payload regardless of channel security posture.** `AlertNotificationMessage` carries `dataEntity.{id,name,dataSourceName,namespaceName,owners[]}` + `downstream[]` lineage entities. The Slack channel (corporate workspace, potentially many viewers), the webhook (operator-defined URL, security posture unknown to ODD), and the email (inbox security varies) all receive the same payload. For organisations whose dataset names encode customer/PII identifiers, every dispatched alert leaks them to every channel. No redaction hook, no allowlist." — evidence: AlertNotificationMessageProcessor.java:24-30 (notificationMessage passed verbatim to every sender) + AlertNotificationMessageTranslator.java:73-83 (full DB-row payload populated) — severity: MEDIUM

- "**Logging side-channel: alert payload toString'd at DEBUG.** `log.debug(\"Sending notification message via {}: {}\", notificationSender.receiverId(), notificationMessage)` invokes `AlertNotificationMessage.toString()` (Lombok `@ToString` at AlertNotificationMessage.java:21). At DEBUG level (operator-enabled in dev), the full payload — including data-entity names, owners, downstream lineage — is written to platform logs. Production typically runs at INFO so this is mitigated, but a debug-on incident exfiltrates the same PII surface into log aggregation." — evidence: AlertNotificationMessageProcessor.java:27 + AlertNotificationMessage.java:21 (`@ToString` Lombok) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — the dispatcher is a Spring `@Component` invoked from the WAL-consumer thread inside the platform process. It is not on the HTTP surface; UI auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) do not gate this code directly. The auth modes DO determine whether alerts get created in the first place (UI users raising alerts vs. the AlertManager inbound webhook), but the dispatcher operates after `ALERT` rows already exist.
- **ingestion_filter_relevance**: `NO — outbound subsystem, not on the /ingestion/entities path`. The dispatcher does not participate in the ingestion auth filter chain; it reads from the `ALERT` table via WAL and writes to external endpoints (Slack / webhook / SMTP).
- **authorization_assertions**: [] — no `@PreAuthorize`, no programmatic permission check, no policy lookup. The dispatcher operates with full platform privileges (it consults DB rows via DSLContext using the platform's datasource credentials).
- **owner_scoping**: `BYPASSES — fan-out is unconditional`. Every configured channel receives every alert event regardless of which data-entity Owner is attached. The `AlertNotificationMessage` payload INCLUDES `dataEntity.owners[]` (owner name + title) — populated by `AlertNotificationMessageTranslator#fetchAlertedDataEntity` — but the dispatcher does NOT consult them for routing. — evidence: AlertNotificationMessageProcessor.java:25-36 (loop iterates `notificationSenders` unconditionally) + AlertNotificationMessageTranslator.java:73-83 (owners populated but never used for routing).
- **data_exposure**:
  - "Full AlertNotificationMessage payload (alertType, eventType, eventAt, updatedBy, dataEntity.{id,name,dataSourceName,namespaceName,type,owners[]}, downstream[] lineage entities to configured depth, alertChunks[]) → every configured Slack channel + webhook endpoint + email inbox, regardless of channel-side access control and regardless of which Owner the alerted entity belongs to — evidence: AlertNotificationMessageProcessor.java:24-30 + AlertNotificationMessageTranslator.java:73-83 + EmailNotificationSender.java:60-89 (template variables) + SlackNotificationSender.java:40-49 + WebhookNotificationSender.java:18-23 (JSONSerDeUtils.serializeJson)"
  - "Receiver-id (e.g. `Slack`, `email`, `Generic webhook`) and full toString of AlertNotificationMessage logged at DEBUG → platform stdout / log aggregator, anyone with log-pull access — evidence: AlertNotificationMessageProcessor.java:27 + AlertNotificationMessage.java:21 (Lombok @ToString)"
  - "Per-channel error message (`NotificationSenderException.getMessage()` — which embeds the receiver id + the HTTP failure reason or 'Couldn't send HTTP request' + the wrapped IOException stack trace) logged at ERROR → platform stdout — evidence: AlertNotificationMessageProcessor.java:32-34 + NotificationSenderException.java:26 + AbstractNotificationSender.java:24-29"
- **known_security_gaps**:
  - "Owner-scoping bypassed at dispatcher — every channel gets every alert, regardless of the data-entity Owner. Cross-team / multi-tenant deployments cannot scope notifications to the owning team. — evidence: AlertNotificationMessageProcessor.java:25-36 — severity: MEDIUM"
  - "No delivery audit at dispatcher — no DB record of which alert went to which channel with what status. Operators auditing 'who-saw-what' have nothing beyond log greppable receiver-id strings. — evidence: AlertNotificationMessageProcessor.java:30-35 (catch-log-only) — severity: MEDIUM"
  - "PII pass-through: dataset / owner / namespace names rendered verbatim in payloads — no redaction allow/deny list, no PII-tag-aware filter at dispatcher level. — evidence: AlertNotificationMessageProcessor.java:24-30 + AlertNotificationMessageTranslator.java:73-83 — severity: MEDIUM"
  - "DEBUG-level full-payload log: `log.debug(\"Sending notification message via {}: {}\", receiverId, notificationMessage)` invokes Lombok @ToString — production INFO mitigates; DEBUG-on incidents leak payloads to log aggregator. — evidence: AlertNotificationMessageProcessor.java:27 — severity: LOW"

## performance

- **hot_paths**:
  - "Per WAL message, dispatcher's `process()` runs (a) one `translate()` invocation — multi-statement jOOQ read of `alert_chunk` rows + alerted-data-entity join + recursive downstream-lineage CTE bounded by `notifications.message.downstream-entities-depth` — then (b) sequential `for` loop calling `.send(...)` on every registered `NotificationSender`, each a synchronous HTTP/SMTP round-trip. End-to-end per-alert latency ≈ (DB roundtrips for translation) + Σ (per-channel network RTT including potential SMTP hang). — evidence: AlertNotificationMessageProcessor.java:23-36 + AlertNotificationMessageTranslator.java:60-86 + 122-180 + AbstractNotificationSender.java:16-30"
- **throughput_characteristics**:
  - "Single-threaded fan-out — one dispatcher invocation per WAL message; the upstream NotificationSubscriber is a SINGLE-THREAD executor (`Executors.newSingleThreadExecutor`) on the leader node only. Cluster-wide throughput is bounded by the dispatcher's serial latency. — evidence: NotificationSubscriberStarter.java:21-23 + NotificationSubscriber.java:39-46"
  - "No batching — one HTTP/SMTP roundtrip per alert per channel. No 'aggregate 10 alerts into one Slack message' fold."
  - "Backpressure on the WAL stream: while the dispatcher's `process()` is running, the upstream `stream.readPending()` blocks — subsequent WAL messages queue in Postgres replication-slot buffer until the dispatcher returns."
- **resource_allocation**:
  - "No internal queue, no buffer — the dispatcher is stateless and holds only the injected dependencies (`notificationSenders` collection + translator). Per-message allocation = one `AlertNotificationMessage` POJO + transient DB result rows. — evidence: AlertNotificationMessageProcessor.java:14-21"
  - "Shared `HttpClient` for Slack + Webhook senders (good — connection reuse). Email uses JavaMailSender which opens an SMTP connection per send (no pooling configured). — evidence: NotificationConfiguration.java:31-34 + 50-71"
  - "Downstream-lineage CTE in translate() — bounded by `notifications.message.downstream-entities-depth × branching factor × chunks-per-alert`. At depth=1 (default) the load is bounded; depth=5+ on a wide lineage graph can produce thousands of rows per dispatch."
- **scaling_characteristics**:
  - "Stateless at the bean level; statefulness lives upstream (advisory lock + replication slot + publication owned by NotificationSubscriber). Horizontal scaling of platform process = the dispatcher exists on EVERY node but only ONE node's executes (the leader holding `notifications.wal.advisory-lock-id`)."
  - "Sender order is Spring-bean-injection order; not stably configurable. Slow senders run in undefined position relative to fast senders, affecting per-alert tail latency."
  - "No queue between WAL decode and HTTP send — bursts of alerts directly translate into bursts of outbound RTT-bound delivery."
- **known_performance_gaps**:
  - "No rate-limiting: bursty alert events translate 1:1 into outbound deliveries. Slack will rate-limit at the receiver (429), dispatcher logs and drops the alert from that channel. — evidence: AbstractNotificationSender.java:24-27 (200-only check, no 429 handling) + AlertNotificationMessageProcessor.java:30-35 (catch-and-log only) — severity: HIGH"
  - "Synchronous fan-out: one slow sender stalls all subsequent senders for the same alert. A misconfigured webhook with a 30s SLA blocks Slack and email delivery for THAT alert. — evidence: AlertNotificationMessageProcessor.java:25-36 — severity: MEDIUM"
  - "Empty-senders DB cost: translate() runs even when no senders are configured — recursive CTE executed on every WAL event for zero delivery. — evidence: AlertNotificationMessageProcessor.java:23 (translate before sender-count check) — severity: LOW"
  - "Poison-message replay: translation failure triggers NotificationSubscriber's outer catch → 10s back-off → re-acquire → same WAL LSN re-delivered. A persistently-bad row (unknown alert-type code, FK-missing data entity) blocks the WAL stream indefinitely. — evidence: AlertNotificationMessageProcessor.java:23-24 + NotificationSubscriber.java:60-91 — severity: HIGH"
  - "No backlog metric / no delivery metric / no failure-by-channel metric — operators cannot detect 'notifications stuck' without log inspection. — evidence: AlertNotificationMessageProcessor.java:28 (debug-only) — severity: MEDIUM"

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:1-37 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriber.java:60-91 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/translator/AlertNotificationMessageTranslator.java:58-86
- node_target_alias ← Glob "**/*NotificationsDispatcher*.java" returned no files; Glob "**/notification/**/*.java" returned 26 files, none literally named NotificationsDispatcher; AlertNotificationMessageProcessor is the sole implementor of PostgresWALMessageProcessor (the dispatcher interface used by NotificationSubscriber); see NotificationSubscriberStarter.java:28 + NotificationSubscriber.java:36,80.
- concepts.entities.AlertNotificationMessageProcessor ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:14-37
- concepts.entities.PostgresWALMessageProcessor ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/PostgresWALMessageProcessor.java:5-7
- concepts.entities.AlertNotificationMessage ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/dto/AlertNotificationMessage.java:22-45
- concepts.entities.DecodedWALMessage ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/dto/DecodedWALMessage.java:5-23
- concepts.entities.NotificationSender ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/sender/NotificationSender.java:6-10
- concepts.entities.NotificationSenderException ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/exception/NotificationSenderException.java:6-28
- concepts.invariants.leader-elected-single-thread ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriberStarter.java:21-32 + NotificationSubscriber.java:39-46
- concepts.invariants.conditional-on-notifications ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:15 + NotificationsFeatureCondition.java:11-12
- concepts.invariants.sequential-fan-out ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:26-30
- concepts.invariants.per-sender-catch-and-continue ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:29-35
- concepts.invariants.unconditional-broadcast ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:25-36
- concepts.invariants.translate-uncaught ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/processor/AlertNotificationMessageProcessor.java:23-24 + AlertNotificationMessageTranslator.java:87,94-101
- dependencies_semantic.requires-feature.notifications ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-19 status 200)
- dependencies_semantic.requires-feature.alerting ← AlertNotificationMessageProcessor implements `PostgresWALMessageProcessor` which is invoked from NotificationSubscriber.java:80 after decoding ALERT-table WAL events; NotificationSubscriber.java:51 registers publication only for Tables.ALERT
- dependencies_semantic.requires-feature.lineage ← AlertNotificationMessageTranslator.java:142-180 (recursive downstream CTE walks LINEAGE table)
- dependencies_semantic.requires-config.notifications-enabled ← NotificationsFeatureCondition.java:11-12 + AlertNotificationMessageProcessor.java:15
- dependencies_semantic.requires-config.senders ← NotificationConfiguration.java:36,69,83 (@ConditionalOnProperty per-sender-key)
- dependencies_semantic.requires-config.downstream-depth ← NotificationConfiguration.java:122-131 + AlertNotificationMessageTranslator.java:142-145
- dependencies_semantic.requires-runtime.pg-wal ← WebFetch live doc (configuration-and-deployment/odd-platform) verified 2026-05-12 status 200 — "Enable Alert Notifications" section
- dependencies_semantic.requires-runtime.leader-election ← PostgreSQLLeaderElectionManagerImpl.java:18-29 + NotificationSubscriber.java:47
- dependencies_semantic.requires-runtime.httpclient ← NotificationConfiguration.java:32-34 + AbstractNotificationSender.java:14-15
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` and `find <odd-platform-repo> -name '*Notification*Test*.java'` both return zero matches
- tests_coverage_semantic.uncovered_behaviours.fan-out-continues ← AlertNotificationMessageProcessor.java:29-35
- tests_coverage_semantic.uncovered_behaviours.translate-failure-propagates ← AlertNotificationMessageProcessor.java:23-24 + NotificationSubscriber.java:90
- tests_coverage_semantic.uncovered_behaviours.empty-senders-noop ← AlertNotificationMessageProcessor.java:23-26 + NotificationConfiguration.java:36,69,83
- tests_coverage_semantic.uncovered_behaviours.runtimeexception-bypass ← AlertNotificationMessageProcessor.java:31 (catches NotificationSenderException only) + EmailNotificationSender.java:59 (`throw new RuntimeException(...)`)
- tests_coverage_semantic.uncovered_behaviours.sequential-blocking ← AlertNotificationMessageProcessor.java:25-36 + NotificationSubscriberStarter.java:21-23
- tests_coverage_semantic.uncovered_behaviours.unconditional-broadcast ← AlertNotificationMessageProcessor.java:25-36
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-19, status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-12, status 200 — reused from NotificationsProperties sidecar)
- docs_link_semantic.doc_drift_findings[0] (implementation-site link gap) ← live doc reads as user-facing prose; no link to source-code commit references
- docs_link_semantic.doc_drift_findings[1] (no per-channel filtering — operator-expectation gap) ← live doc + AlertNotificationMessageProcessor.java:25-36
- docs_link_semantic.doc_drift_findings[2] (exception-type asymmetry between email and other senders) ← live doc + AlertNotificationMessageProcessor.java:31 + EmailNotificationSender.java:59 + SlackNotificationSender.java + WebhookNotificationSender.java
- implicit_adrs.[0] (per-channel catch-and-continue) ← AlertNotificationMessageProcessor.java:29-35
- implicit_adrs.[1] (sequential synchronous fan-out) ← AlertNotificationMessageProcessor.java:25-36
- implicit_adrs.[2] (dispatcher conditional, disabled by default) ← AlertNotificationMessageProcessor.java:14-15 + NotificationsFeatureCondition.java:11-12
- implicit_adrs.[3] (translate-before-fan-out atomic; bifurcated fail-loud vs fail-soft) ← AlertNotificationMessageProcessor.java:23-24 + AlertNotificationMessageTranslator.java:87,94-101 + NotificationSubscriber.java:60-91
- bugs_limitations_corner_cases.[0] (exception-type asymmetry) ← AlertNotificationMessageProcessor.java:31 + EmailNotificationSender.java:58-60
- bugs_limitations_corner_cases.[1] (no retry / no DLQ / no audit) ← AlertNotificationMessageProcessor.java:30-35 + NotificationSubscriber.java:83-84
- bugs_limitations_corner_cases.[2] (no rate-limit) ← AlertNotificationMessageProcessor.java:25-36 + AbstractNotificationSender.java:16-30
- bugs_limitations_corner_cases.[3] (no per-channel filter) ← AlertNotificationMessageProcessor.java:25-36
- bugs_limitations_corner_cases.[4] (no backlog metric) ← AlertNotificationMessageProcessor.java:28
- bugs_limitations_corner_cases.[5] (sender-iteration order undefined) ← AlertNotificationMessageProcessor.java:19
- bugs_limitations_corner_cases.[6] (translate-failure WAL replay loop) ← AlertNotificationMessageProcessor.java:23-24 + NotificationSubscriber.java:60-91
- bugs_limitations_corner_cases.[7] (empty-senders DB cost) ← AlertNotificationMessageProcessor.java:23 + NotificationConfiguration.java:36,69,83
- bugs_limitations_corner_cases.[8] (PII pass-through) ← AlertNotificationMessageProcessor.java:24-30 + AlertNotificationMessageTranslator.java:73-83
- bugs_limitations_corner_cases.[9] (DEBUG-level full-payload log) ← AlertNotificationMessageProcessor.java:27 + AlertNotificationMessage.java:21
- security.auth_mode_relevance ← AlertNotificationMessageProcessor.java:14-15 (component, not controller)
- security.ingestion_filter_relevance ← AlertNotificationMessageProcessor.java:1-37 (no @RestController, no @RequestMapping, no Filter)
- security.authorization_assertions ← AlertNotificationMessageProcessor.java:1-37 (no @PreAuthorize, no programmatic permission check)
- security.owner_scoping ← AlertNotificationMessageProcessor.java:25-36 + AlertNotificationMessageTranslator.java:73-83
- security.data_exposure.[0] ← AlertNotificationMessageProcessor.java:24-30 + AlertNotificationMessageTranslator.java:73-83 + EmailNotificationSender.java:60-89 + SlackNotificationSender.java:40-49 + WebhookNotificationSender.java:18-23
- security.data_exposure.[1] ← AlertNotificationMessageProcessor.java:27 + AlertNotificationMessage.java:21
- security.data_exposure.[2] ← AlertNotificationMessageProcessor.java:32-34 + NotificationSenderException.java:26
- security.known_security_gaps.[0] (no owner scoping) ← AlertNotificationMessageProcessor.java:25-36
- security.known_security_gaps.[1] (no audit) ← AlertNotificationMessageProcessor.java:30-35
- security.known_security_gaps.[2] (PII pass-through) ← AlertNotificationMessageProcessor.java:24-30 + AlertNotificationMessageTranslator.java:73-83
- security.known_security_gaps.[3] (DEBUG log full payload) ← AlertNotificationMessageProcessor.java:27
- performance.hot_paths.[0] ← AlertNotificationMessageProcessor.java:23-36 + AlertNotificationMessageTranslator.java:60-86 + 122-180 + AbstractNotificationSender.java:16-30
- performance.throughput_characteristics.single-thread ← NotificationSubscriberStarter.java:21-23 + NotificationSubscriber.java:39-46
- performance.throughput_characteristics.no-batching ← AlertNotificationMessageProcessor.java:25-36
- performance.resource_allocation.shared-httpclient ← NotificationConfiguration.java:31-34 + AbstractNotificationSender.java:14-15
- performance.resource_allocation.cte-cost ← AlertNotificationMessageTranslator.java:142-180
- performance.scaling_characteristics.leader-only ← NotificationSubscriber.java:39-46 + PostgreSQLLeaderElectionManagerImpl.java:18-29
- performance.scaling_characteristics.bean-order ← AlertNotificationMessageProcessor.java:19
- performance.known_performance_gaps.[0] (no rate-limit) ← AbstractNotificationSender.java:24-27 + AlertNotificationMessageProcessor.java:30-35
- performance.known_performance_gaps.[1] (synchronous fan-out) ← AlertNotificationMessageProcessor.java:25-36
- performance.known_performance_gaps.[2] (empty-senders DB cost) ← AlertNotificationMessageProcessor.java:23
- performance.known_performance_gaps.[3] (poison-message replay) ← AlertNotificationMessageProcessor.java:23-24 + NotificationSubscriber.java:60-91
- performance.known_performance_gaps.[4] (no metrics) ← AlertNotificationMessageProcessor.java:28

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

(none — net-new sidecar; the dispatcher node was previously covered indirectly through
NotificationsProperties batch C. This sidecar enriches the dispatcher role specifically
at AlertNotificationMessageProcessor — the sole implementor of PostgresWALMessageProcessor —
and confirms via primary code the channel fan-out, catch-and-continue ADR, RuntimeException
asymmetry between email and other senders, and the no-retry/no-DLQ/no-audit/no-rate-limit/
no-owner-scoping cluster as the dispatcher's structural gaps. See related sidecars:
NotificationsProperties (batch C), EmailSenderProperties (batch D), AlertServiceImpl
(alert-creation upstream), AlertController (HTTP surface).)
