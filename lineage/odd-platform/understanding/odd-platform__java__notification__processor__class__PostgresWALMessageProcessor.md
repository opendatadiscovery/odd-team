---
node_id: "odd-platform java notification.processor class:PostgresWALMessageProcessor"
node_kind: class
axis: notification.processor
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-batch-Y-notification-bridge
schema_version: v0.3.0
node_target_kind: java-interface-spi-seam
node_target_summary: |-
  Single-method SPI interface declaring the contract between the WAL listener
  (`NotificationSubscriber.run()`) and the alert dispatcher
  (`AlertNotificationMessageProcessor` — the sole implementor). Seven lines, no
  default methods, no JavaDoc. The interface is the F-009 "bridge" node — the
  injection seam through which the WAL-decoded `DecodedWALMessage` crosses into
  the channel-fanout loop.
back_links:
  features: [F-009, F-007, F-006]
  pillars: [P-07]
  lsns: [LSN-001, LSN-017, LSN-018]
  retrospectives: []
  related_sidecars:
  - odd-platform__java__service__service__NotificationsDispatcher.md
  - odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md
  - odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md
---

# PostgresWALMessageProcessor — semantic understanding

## understanding

`PostgresWALMessageProcessor` is a one-method Java SPI interface — the dependency-injection seam between ODD Platform's WAL listener thread (`NotificationSubscriber.run()`) and the alert dispatcher (`AlertNotificationMessageProcessor`, the sole implementor). The contract declares `void process(DecodedWALMessage message) throws InterruptedException` — INSERT or UPDATE WAL events on the `ALERT` table arrive here, and downstream channel fan-out (Slack / Webhook / Email) is the implementor's responsibility. The interface itself carries no semantic content beyond the signature; ALL of F-009's drift facets (fanout, error isolation asymmetry, no retry / no audit, poison-message replay, owner-scoping bypass, debug-log PII leak) live on the implementation side. The interface's load-bearing role is **structural** — its single-impl assumption lets `NotificationSubscriber` advance the WAL LSN unconditionally after `process()` returns, and its narrow contract (no return value, no failure signal, no LSN-acknowledgement hook) is what shapes the at-least-once-via-replay-loop / at-most-once-on-success delivery semantics that F-009 catalogues.

## concepts

- entities: [PostgresWALMessageProcessor (interface), DecodedWALMessage (input record), AlertNotificationMessageProcessor (sole implementor, gated by `@ConditionalOnNotifications`), NotificationSubscriber (caller — leader-elected single-thread)]
- operations: [declare-process-contract, bridge-wal-decoder-to-channel-fanout, propagate-interrupted-exception-for-thread-shutdown]
- invariants:
  - "interface has exactly ONE implementor in the codebase — `AlertNotificationMessageProcessor` — verified via grep `implements PostgresWALMessageProcessor` returning a single match (AlertNotificationMessageProcessor.java:18)"
  - "the contract is `void process(...) throws InterruptedException` — the only declared failure mode that crosses the seam is `InterruptedException` for cooperative thread shutdown; ANY other exception type (RuntimeException, IllegalStateException, IllegalArgumentException) crosses the seam silently and surfaces in `NotificationSubscriber`'s outer `catch (Exception e)` at NotificationSubscriber.java:90"
  - "the return type is `void` — there is NO way for the dispatcher to signal partial-failure / retry-please / poison-message-skip-this-LSN to the caller; the WAL LSN advances unconditionally at NotificationSubscriber.java:83-84 after `process()` returns normally"
  - "the interface does NOT extend a generic message-handler shape — `DecodedWALMessage` is hard-coded as the input type, so the seam is alert-table-specific (Tables.ALERT is the only published table per NotificationSubscriber.java:51)"
- audiences: [spring-container (resolves the bean via type), notification-subscriber-thread (the single consumer), maintainer (the SPI shape is the operator-invisible truth about delivery semantics)]

## dependencies_semantic

- requires-feature:
  - "P-07 Active Platform Features → Notifications sub-feature — the implementor is `@ConditionalOnNotifications`-gated (NotificationsFeatureCondition.java:8-13 reads `Boolean.class, false`), so the seam materialises only when `notifications.enabled=true`"
  - "F-009 WAL-driven Notification Delivery — this interface IS the bridge node at F-009 chain hop-3 (between hop-2 `NotificationSubscriber` and the sender beans at hop-4a/b/c)"
- requires-config: []  # interface itself reads no config keys; the implementor + condition class read `notifications.enabled`
- requires-runtime:
  - "single-thread executor on the leader-elected platform instance (NotificationSubscriberStarter.java:21-23 `Executors.newSingleThreadExecutor(... \"notification-subscriber-thread\")`)"
  - "Postgres logical replication (pgoutput plugin) on the `ALERT` table — NotificationSubscriber.java:30,51,53-58 — the seam is fed by `stream.readPending()` polled at 10ms intervals"
- input-type-coupling:
  - "`DecodedWALMessage` (DecodedWALMessage.java:5) — a `record(int relationId, Operation operation, Map<String, Column> columns)` with `Operation` enum limited to `INSERT, UPDATE` (DecodedWALMessage.java:6-9); the seam EXCLUDES DELETE / TRUNCATE / RELATION operations (`PostgresWALMessageDecoder.java:44-54` returns `Optional.empty()` for non-INSERT/UPDATE message types, so `process()` is never invoked for them)"
- output-type-coupling:
  - "`void` — there is no return type for the seam to communicate per-channel-delivery status, per-message LSN-advancement guidance, or batch-status back to the caller"
- exception-type-coupling:
  - "ONLY `InterruptedException` is declared on the signature (PostgresWALMessageProcessor.java:6); the implementor's actual exception surface is much wider — `IllegalArgumentException` / `IllegalStateException` from `AlertNotificationMessageTranslator.translate(...)` (AlertNotificationMessageTranslator.java:87, 94, 101) cross the seam undeclared and trigger the F-009 poison-message replay loop"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "the single-implementor invariant — no test asserts `PostgresWALMessageProcessor` has exactly one `@Component`-annotated implementor (a future second implementor injected into `NotificationSubscriber` would silently break the alert-specific assumption)"
  - "the void-return / unconditional-LSN-advance coupling — no test asserts that `process()` returning normally and `process()` throwing produce different LSN-acknowledgement outcomes"
  - "the InterruptedException-propagation contract — no test asserts the seam correctly propagates `InterruptedException` to `NotificationSubscriber.run()`'s outer catch at line 87 (cooperative shutdown path)"
  - "the non-declared-exception-bypass — no test asserts what `NotificationSubscriber` does when `process()` throws RuntimeException (it currently lands in line 90's `catch (Exception e)`, logs, releases the lock, waits 10s, re-acquires, replays the SAME LSN — the F-009 poison-message replay loop)"
- test_files: []  # `find <odd-platform-repo> -path '*test*' -name '*Notification*'` returns 0 matches; the entire notification/ package has no test coverage at the odd-platform-api layer
- gaps: |
    A regression that adds a second `PostgresWALMessageProcessor` implementor (e.g. for a future `OWNER` or `DATA_ENTITY` WAL stream) without updating the `NotificationSubscriber` field type to `Map<Class, PostgresWALMessageProcessor>` or `List<PostgresWALMessageProcessor>` would land here. Spring would fail bean resolution at boot (good); but if both implementors were `@Primary` and `@ConditionalOnX`-gated, runtime selection silently picks one. The interface has no test pinning that "alert dispatcher is the alert-table consumer" — only the `NotificationSubscriber.java:51 registerPublication(connection, Tables.ALERT)` line couples the WAL stream to the alert table. A separate-file rename of `Tables.ALERT` to e.g. `Tables.DATA_ENTITY` in a careless refactor would silently flip the seam's table coupling, and no test would catch it.

## docs_link_semantic

- declared_docs: []  # the source file (7 lines) carries no `@docs` annotation, no JavaDoc, no comment
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "the live Notifications doc page is the user-facing surface of the subsystem this interface sits inside; the interface's invariants (single-impl, void return, unconditional LSN advance) shape the doc-stated fanout and partial-failure semantics"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "an alert dispatched to multiple channels is delivered to every channel that is enabled"
      — live doc, /features/active-platform-features/notifications.md § Outbound channels.
      This is the user-facing promise; the seam's `void` return + the implementor's
      try/catch around per-sender `.send(...)` are what realise it for the
      `NotificationSenderException` class of failures, and what BREAK it for the
      `RuntimeException` class (cross-channel abort when email is wrapped as
      raw RuntimeException at EmailNotificationSender.java:58-60).
- doc_drift_findings:
  - "the live doc page describes the WITHIN-CHANNEL email partial-failure (recipient N fails → N+1, N+2 are skipped) — verified live 2026-05-20 — but does NOT name the CROSS-CHANNEL abort: if email is first in the bean-discovery order and throws RuntimeException, Slack and Webhook for that SAME alert are never attempted; this drift sits BETWEEN the seam's `void` contract and the doc's user-facing fanout promise"
  - "the live doc names the SMTP timeouts / silent partial-recipient-delivery / case-sensitive `smtp` protocol failure (Configure ODD Platform → Known limitations link) but does NOT name the bridge seam's single-thread / single-implementor invariant — a future maintainer reading the docs cannot deduce that one WAL stream feeds one dispatcher feeds N senders sequentially, because the interface is invisible from the docs surface"

## implicit_adrs

- "Single-implementor narrow SPI seam — `PostgresWALMessageProcessor` declares only `process(DecodedWALMessage)`; the alert-table coupling is encoded in the upstream caller (`NotificationSubscriber.registerPublication(connection, Tables.ALERT)`) rather than in the interface signature. This choice prefers a simple single-stream / single-handler shape over a multi-handler dispatcher (`Map<RelationId, Processor>`) — and the choice is committed by the `final` field declaration at `NotificationSubscriber.java:36 private final PostgresWALMessageProcessor messageProcessor`." — evidence: PostgresWALMessageProcessor.java:5-7 + NotificationSubscriber.java:36,51 — intent_anchor: "private final PostgresWALMessageProcessor messageProcessor;" (NotificationSubscriber.java:36) + "registerPublication(connection, Tables.ALERT);" (NotificationSubscriber.java:51) — confidence: HIGH
- "Cooperative-shutdown via InterruptedException only — the SOLE declared throws clause is `InterruptedException` (PostgresWALMessageProcessor.java:6). This frames the seam as a thread-cooperation contract (subscriber is a `Thread` extending `extends Thread` at NotificationSubscriber.java:29 — explicit Thread subclassing, not a Runnable). The implementor's wider exception surface (any RuntimeException) is intentionally UNDECLARED at the seam — letting the subscriber's outer catch block decide LSN advancement / lock release / 10s back-off. The intent is visible in the asymmetric design: a declared `throws InterruptedException` plus a void return = the seam is responsible only for honouring interrupt + completing-or-erroring per call; LSN state lives on the OTHER side." — evidence: PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:29,87-91 — intent_anchor: "void process(final DecodedWALMessage message) throws InterruptedException;" (PostgresWALMessageProcessor.java:6) + "catch (final InterruptedException e) { Thread.currentThread().interrupt(); throw new NotificationSubscriberException(e); }" (NotificationSubscriber.java:87-89) — confidence: HIGH

## bugs_limitations_corner_cases

- "The interface declares `void process(...)` — there is NO return-value channel for the dispatcher to signal partial-delivery, requires-replay, or this-LSN-is-poison-skip. The caller (NotificationSubscriber.java:80-84) treats every normal `process()` return as success and advances `setAppliedLSN` + `setFlushedLSN` unconditionally. A dispatcher that successfully delivers to Slack but fails Webhook + Email STILL acknowledges the LSN as fully processed; from the WAL stream's perspective the message is gone. This is the structural root of F-009's `no_retry_no_dlq_no_audit` drift facet — the seam offers no shape on which a retry / DLQ / audit could be expressed without API change." — evidence: PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:80-84 — severity: HIGH
- "The interface does NOT declare any wider exception type than `InterruptedException`, but the implementor's translation step throws `IllegalArgumentException` (AlertNotificationMessageTranslator.java:87) and `IllegalStateException` (lines 94, 101, 184) — both undeclared at the seam. These unchecked exceptions bypass any caller-side `catch (NotificationSenderException)` clause and surface in `NotificationSubscriber.java:90 catch (Exception e)`, which logs + releases the lock + waits 10s + re-acquires + replays the SAME LSN. A persistently-bad alert row (e.g. an alert pointing at a hard-deleted data_entity oddrn — the FK violation message at line 95 explicitly admits the case as 'despite the foreign key constraint') becomes a poison-message that blocks the WAL stream for every subsequent alert. The seam's narrow `throws InterruptedException` clause makes the implementor's wider exception surface invisible to anyone reading the interface alone." — evidence: PostgresWALMessageProcessor.java:6 + AlertNotificationMessageTranslator.java:87,94,101 + NotificationSubscriber.java:90,94-100 — severity: HIGH
- "The input type `DecodedWALMessage` is hard-coded — the seam is not generic over event types. A future requirement for non-alert WAL streams (e.g. notification on owner-association requests, or on user-onboarding events) cannot be satisfied without either (a) a second processor interface + a second subscriber thread + a second leader-elected advisory lock, or (b) a breaking change to widen the input type. The 'Notifications' label in the docs implies a general-purpose subsystem; the interface's input-type coupling reveals the truth — this is the ALERT-table-only subsystem." — evidence: PostgresWALMessageProcessor.java:3,6 + DecodedWALMessage.java:5 + NotificationSubscriber.java:51 — severity: LOW
- "ZERO test coverage for the interface contract — no test asserts the single-implementor invariant, no test asserts that an undeclared RuntimeException from `process()` triggers the 10s-back-off replay loop (the operator-visible behaviour of F-009 poison-message replay). A regression introducing a second processor (Spring `@Primary` + condition-conflict + ambiguous bean) would surface at runtime in an integration deployment, not at build time." — evidence: PostgresWALMessageProcessor.java (entire file, 7 lines) + `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` returning zero matches — severity: MEDIUM
- "NO notification-delivery audit-event is emitted from the seam OR the implementor — `ActivityEventTypeDto.java:3-31` enumerates 26 activity event types (OWNERSHIP_CREATED, ALERT_STATUS_UPDATED, OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED, etc.) but ZERO of them name notification delivery. F-006's `audit_silence_enum_rooted` drift class names this exact enum gap as a root cause. From the seam's perspective: a dispatcher implementor cannot emit a notification-delivery activity event because the enum has no constant to name; the enum gap is a STRUCTURAL silence on this entire subsystem's observability." — evidence: PostgresWALMessageProcessor.java (seam interface) + ActivityEventTypeDto.java:3-31 (no NOTIFICATION_SENT / NOTIFICATION_FAILED / NOTIFICATION_DELIVERY_* constants) — severity: HIGH (cross-feature; corroborates F-006 audit-silence ENUM-ROOTED)

## security

- auth_mode_relevance: INTERNAL_ONLY — the seam is not on the HTTP surface; it is a Java SPI seam internal to the WAL-consumer thread. Auth mode does not apply directly. The implementor's behaviour (channel fanout) is invoked AFTER the leader-elected subscriber acquires the advisory lock, on behalf of NO authenticated principal — the seam runs as the platform's own service identity, not as any user.
- ingestion_filter_relevance: N/A — not HTTP; this is the WAL-CDC outbound path, not the `/ingestion/*` inbound path. The two are unrelated. (Note: F-009 cross-references the Prometheus AlertManager INBOUND webhook at `/ingestion/alert/alertmanager`, but that path does NOT pass through this seam — it writes ALERT rows directly, which the seam THEN processes downstream.)
- authorization_assertions: []  # no @PreAuthorize on the interface; the implementor (AlertNotificationMessageProcessor.java:14-18) carries no programmatic authorization check — the dispatcher serves the system's own outbound channel-config, not any user request
- owner_scoping: BYPASSES — the seam carries a `DecodedWALMessage` with no owner / namespace / principal context. The implementor's downstream translator (AlertNotificationMessageTranslator.java:74-83) materialises `dataEntity.owners[]` but never consults it for routing — every configured channel receives every alert regardless of the alerted data entity's Owner. The owner-scoping bypass is committed AT THE SEAM by the absence of any owner-routing surface in the SPI shape — there is no `process(DecodedWALMessage, OwnerScope scope)` or `List<Channel> route(DecodedWALMessage)` shape that would let an implementor express owner-aware routing.
- data_exposure:
  - "Full AlertNotificationMessage payload (data_entity.{id, name, dataSourceName, namespaceName}, owners[], downstream lineage entities to depth `notifications.message.downstream-entities-depth` default 1, alertChunks[], updatedBy) → every configured channel (Slack workspace + webhook URL + email recipients) regardless of which Owner the data entity belongs to → because the seam's input type carries no routing key"
  - "DEBUG-level log line at AlertNotificationMessageProcessor.java:27 invokes Lombok @ToString on AlertNotificationMessage (AlertNotificationMessage.java:21 `@ToString`) — a DEBUG-enabled incident exfiltrates the full PII-bearing payload into log aggregation. The seam itself does not log; the implementor does — but the seam's `void` return + no per-message identifier in the signature also means there is no LSN / message-id / hash that a structured replacement log line could use instead of the full payload."
- known_security_gaps:
  - "seam carries no authentication / authorization context for the dispatcher to consume — `process(DecodedWALMessage)` has no principal, no scope, no audit-correlation id; an implementor wanting to emit an audit-event 'platform service identity sent alert X to channels [Y, Z]' has no per-message id to anchor it to — the LSN is only known to the caller (`NotificationSubscriber`)" — evidence: PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:75 (log.debug LSN), 83-84 (advances LSN) — severity: MEDIUM
  - "the seam offers no way to express PII redaction or channel-aware payload shaping — `DecodedWALMessage` is the universal input; the implementor's `AlertNotificationMessage` translation runs ONCE and the same payload goes to all channels — a Slack-redacted vs full-Webhook payload split cannot be expressed without changing the seam" — evidence: PostgresWALMessageProcessor.java:6 + AlertNotificationMessageProcessor.java:23-30 (single translate + iterate) — severity: MEDIUM (cross-link to F-009 `pii_passthrough_to_every_channel`)

## performance

- hot_paths:
  - "the seam is invoked once per WAL INSERT/UPDATE on `ALERT` — NotificationSubscriber.java:60-84 polls `stream.readPending()` every 10ms; on a busy alert flow this can be many calls per second on the single subscriber thread" — evidence: NotificationSubscriber.java:68-71 (10ms poll) + line 80 (process call)
- throughput_characteristics:
  - "single-thread / single-instance / sequential per-message — the subscriber thread (`Executors.newSingleThreadExecutor` at NotificationSubscriberStarter.java:21-23) calls `process()` synchronously and blocks on its return before consuming the next WAL message. Throughput is bounded by the slowest channel's `.send(...)` latency on every alert + the translator's recursive-CTE depth scan."
  - "no batch shape — the seam is per-message, not per-LSN-batch. A burst of 10k alert-row inserts into the ALERT table produces 10k sequential `process()` calls on one thread; the seam cannot express bulk dispatch"
- resource_allocation:
  - "the seam carries no per-call resource hint (no cancellation token, no timeout, no rate-limit) — the implementor's per-channel HTTP/SMTP send shape is its own surface; an implementor wanting to bound per-message dispatch latency has no contract to honour"
- scaling_characteristics:
  - "cluster-wide single instance — the implementor runs on the leader-elected platform instance only (NotificationSubscriber.java:47 acquires `notifications.wal.advisory-lock-id` via `PostgreSQLLeaderElectionManager`); horizontal scaling of the platform does NOT scale the dispatcher. The seam's single-implementor / void-return shape is structurally tied to this leader-elected assumption — a multi-implementor seam (e.g. one-per-channel) would need explicit coordination on LSN advancement, which the current shape cannot express"
  - "advisory-lock-id collision risk — `notifications.wal.advisory-lock-id` (default 100) shares the same Postgres advisory-lock id namespace with `partition.advisory-lock-id` (default 90) and `datacollaboration.receive-event-advisory-lock-id` (default 110) and `datacollaboration.sender-message-advisory-lock-id` (default 120) — operators who set lock ids manually risk silent collision; the seam runs only behind whichever lock holder wins, and a collision means the dispatcher never runs at all" — evidence: application.yml:172-179 (notifications block) + lines 197-202 (partition + datacollaboration locks)
- known_performance_gaps:
  - "the void return + unconditional-LSN-advance pattern means a slow / failing channel (e.g. Slack 429 rate-limited, SMTP unreachable) blocks the entire alert stream — the next alert cannot be processed until the slow `.send(...)` either succeeds or throws; the seam offers no async / fire-and-forget shape to drain the WAL stream while channels work in the background" — evidence: PostgresWALMessageProcessor.java:6 (sync void) + NotificationSubscriber.java:80-84 (sequential call + LSN advance) + AlertNotificationMessageProcessor.java:25-36 (sequential for-loop over senders) — severity: MEDIUM
  - "the seam cannot batch — even if 100 alert rows were inserted in a single transaction, the WAL stream surfaces them one-by-one (`stream.readPending()` returns one ByteBuffer at a time, decoded one-by-one); the seam has no shape to coalesce, e.g., 10 alerts on the SAME data_entity into one Slack message" — evidence: PostgresWALMessageProcessor.java:6 (single-message input) + NotificationSubscriber.java:68-81 (one-buffer-at-a-time loop) — severity: LOW

## sources

- understanding ← PostgresWALMessageProcessor.java:1-7 (entire interface) + NotificationSubscriber.java:36,80 (caller-side coupling) + AlertNotificationMessageProcessor.java:18,22-36 (sole implementor) + F-009.yaml:131-243 (feature-flow chain)
- concepts.entities.PostgresWALMessageProcessor ← PostgresWALMessageProcessor.java:5
- concepts.entities.DecodedWALMessage ← DecodedWALMessage.java:5 + PostgresWALMessageProcessor.java:6 (input)
- concepts.entities.AlertNotificationMessageProcessor ← AlertNotificationMessageProcessor.java:18
- concepts.entities.NotificationSubscriber ← NotificationSubscriber.java:29,36
- concepts.invariants.single-implementor ← `grep 'implements PostgresWALMessageProcessor' <odd-platform-repo>` returning 1 match (AlertNotificationMessageProcessor.java:18)
- concepts.invariants.interrupted-only-declared ← PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:87-89
- concepts.invariants.void-return-no-failure-signal ← PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:83-84
- concepts.invariants.alert-table-only ← NotificationSubscriber.java:51 + PostgresWALMessageDecoder.java:44-54
- dependencies_semantic.requires-feature.P-07 ← AlertNotificationMessageProcessor.java:15 (`@ConditionalOnNotifications`) + NotificationsFeatureCondition.java:8-13
- dependencies_semantic.requires-feature.F-009 ← F-009.yaml:131-243 (chain hop-3) + system-mission.md:200-220 (P-07 notifications sub-feature) + AlertNotificationMessageProcessor.java:18 (sole implementor)
- dependencies_semantic.requires-runtime.single-thread-executor ← NotificationSubscriberStarter.java:21-23
- dependencies_semantic.requires-runtime.postgres-logical-replication ← NotificationSubscriber.java:30,51,53-58
- dependencies_semantic.input-type-coupling.DecodedWALMessage-INSERT-UPDATE-only ← DecodedWALMessage.java:5-9 + PostgresWALMessageDecoder.java:44-54
- dependencies_semantic.output-type-coupling.void ← PostgresWALMessageProcessor.java:6
- dependencies_semantic.exception-type-coupling.InterruptedException-only-declared ← PostgresWALMessageProcessor.java:6 + AlertNotificationMessageTranslator.java:87,94,101 (undeclared IllegalArgumentException + IllegalStateException)
- tests_coverage_semantic.uncovered_behaviours.[0] ← PostgresWALMessageProcessor.java + AlertNotificationMessageProcessor.java + `grep 'implements PostgresWALMessageProcessor' <odd-platform-repo>` returning 1 match
- tests_coverage_semantic.uncovered_behaviours.[1] ← PostgresWALMessageProcessor.java:6 (void) + NotificationSubscriber.java:83-84 (unconditional LSN advance)
- tests_coverage_semantic.uncovered_behaviours.[2] ← PostgresWALMessageProcessor.java:6 (throws InterruptedException) + NotificationSubscriber.java:87-89 (interrupted-path)
- tests_coverage_semantic.uncovered_behaviours.[3] ← AlertNotificationMessageTranslator.java:87,94,101 + NotificationSubscriber.java:90-100 (10s back-off replay loop)
- tests_coverage_semantic.test_files ← `find <odd-platform-repo>/odd-platform-api/src/test -path '*notification*'` returning zero matches
- docs_link_semantic.inferred_docs.[0] ← WebFetch 2026-05-20 https://docs.opendatadiscovery.org/features/active-platform-features/notifications.md status 200 — quoted excerpt from § Outbound channels
- docs_link_semantic.doc_drift_findings.[0] ← live doc § Outbound channels (within-channel partial-failure described) + EmailNotificationSender.java:58-60 (raw RuntimeException wrap) + AlertNotificationMessageProcessor.java:29-34 (per-sender catch on NotificationSenderException ONLY)
- docs_link_semantic.doc_drift_findings.[1] ← live doc § Setting up notifications (subsystem orientation, no bridge-seam mention) + PostgresWALMessageProcessor.java:5-7 (the seam, invisible from docs)
- implicit_adrs.[0] ← PostgresWALMessageProcessor.java:5-7 + NotificationSubscriber.java:36,51 — intent_anchor: `private final PostgresWALMessageProcessor messageProcessor` + `registerPublication(connection, Tables.ALERT)`
- implicit_adrs.[1] ← PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:29,87-89 — intent_anchor: `throws InterruptedException` + cooperative-interrupt catch block
- bugs_limitations_corner_cases.[0] ← PostgresWALMessageProcessor.java:6 + NotificationSubscriber.java:80-84 (void + unconditional LSN advance)
- bugs_limitations_corner_cases.[1] ← PostgresWALMessageProcessor.java:6 + AlertNotificationMessageTranslator.java:87,94,101 + NotificationSubscriber.java:90,94-100
- bugs_limitations_corner_cases.[2] ← PostgresWALMessageProcessor.java:3,6 + DecodedWALMessage.java:5 + NotificationSubscriber.java:51
- bugs_limitations_corner_cases.[3] ← PostgresWALMessageProcessor.java (entire file) + `find <odd-platform-repo> -name '*Test*.java' -path '*notification*'` zero matches
- bugs_limitations_corner_cases.[4] ← PostgresWALMessageProcessor.java (seam) + ActivityEventTypeDto.java:3-31 (no NOTIFICATION_* constants; corroborates F-006 audit-silence ENUM-ROOTED)
- security.auth_mode_relevance ← PostgresWALMessageProcessor.java:5-7 (no HTTP) + NotificationSubscriber.java:39 (run inside leader-elected thread, no user principal)
- security.owner_scoping ← PostgresWALMessageProcessor.java:6 (no owner in signature) + AlertNotificationMessageTranslator.java:74-83 (owners materialised but never consulted) + AlertNotificationMessageProcessor.java:25-36 (unconditional for-loop)
- security.data_exposure.[0] ← AlertNotificationMessage.java:22-44 (full payload shape) + AlertNotificationMessageProcessor.java:25-36 (sent to every configured sender)
- security.data_exposure.[1] ← AlertNotificationMessage.java:21 (@ToString) + AlertNotificationMessageProcessor.java:27 (log.debug full message)
- security.known_security_gaps.[0] ← PostgresWALMessageProcessor.java:6 (no principal/scope/correlation-id) + NotificationSubscriber.java:75,83-84 (LSN only known to caller)
- security.known_security_gaps.[1] ← PostgresWALMessageProcessor.java:6 (universal input) + AlertNotificationMessageProcessor.java:23-30 (single translate + iterate)
- performance.hot_paths.[0] ← NotificationSubscriber.java:68-71 (10ms poll) + line 80 (process call) + PostgresWALMessageProcessor.java:6
- performance.scaling_characteristics.[1] ← application.yml:172-179 (notifications block) + lines 197-202 (partition + datacollaboration locks)
- performance.known_performance_gaps.[0] ← PostgresWALMessageProcessor.java:6 (sync void) + NotificationSubscriber.java:80-84 (sequential call + LSN advance) + AlertNotificationMessageProcessor.java:25-36 (sequential for-loop)
- performance.known_performance_gaps.[1] ← PostgresWALMessageProcessor.java:6 (single-message input) + NotificationSubscriber.java:68-81 (one-buffer-at-a-time loop)
- back_links.features.F-009 ← F-009.yaml:1-243 (the entire feature-flow; this interface is the bridge node at hop-3)
- back_links.features.F-006 ← ActivityEventTypeDto.java:3-31 + F-006.yaml:43 (`audit_silence_enum_rooted_activity_event_type_dto_term_namespace_owner_lifecycle`) — corroborates the notification-delivery audit silence
- back_links.features.F-007 ← F-009.yaml:131-153 (alerts SOURCED by AlertManager / AlertController / AlertActionResolver — F-007's alert lifecycle is the upstream event the seam consumes via WAL)
- back_links.lsns.LSN-001 ← F-009.yaml:474-475 (attachment ephemeral default — same operator-trust-the-defaults class as the notification-channel silent partial-failure)
- back_links.lsns.LSN-017 ← retrospectives/LSN-017 (cross-layer composition — the seam's `void`+unconditional-LSN-advance composition with NotificationSubscriber's outer catch is the LSN-class miss inside F-009)
- back_links.lsns.LSN-018 ← retrospectives/LSN-018 (pre-emit coherence check — this sidecar strengthens F-009 without contradiction)
- back_links.related_sidecars.NotificationsDispatcher ← lineage/odd-platform/understanding/odd-platform__java__service__service__NotificationsDispatcher.md (the implementation-side sidecar; this interface sidecar is the contract-side companion)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM  # inferred docs only (no @docs annotation on the 7-line interface); the inferred URL is the user-facing surface of the subsystem this seam belongs to, live-verified 2026-05-20
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## coherence_check (LSN-018 Rule 6)

- **named entities I commit to**: PostgresWALMessageProcessor (interface), AlertNotificationMessageProcessor (sole impl), DecodedWALMessage, NotificationSubscriber, NotificationSender, AlertNotificationMessageTranslator, ActivityEventTypeDto, F-009, F-006, F-007.
- **registry polarity sweep**:
  - F-009.yaml CONSISTENT: claims `AlertNotificationMessageProcessor` is the implementor (line 199-209). This sidecar STRENGTHENS at the seam-contract level — no contradiction.
  - NotificationsDispatcher sidecar (existing) CONSISTENT: enriches the IMPL; this sidecar enriches the INTERFACE. The two are companions — the impl sidecar already cites this interface at `node_target_alias`.
  - F-006.yaml CONSISTENT: claims `audit_silence_enum_rooted_activity_event_type_dto` (line 43); this sidecar's `bugs_limitations_corner_cases.[4]` STRENGTHENS by confirming the enum (ActivityEventTypeDto.java:3-31) has no `NOTIFICATION_*` constants — the seam therefore cannot emit notification-delivery audit events even if it tried.
  - F-007.yaml (referenced indirectly via F-009): alert lifecycle is the upstream signal; the seam consumes ALERT-table WAL events. CONSISTENT.
  - Live notifications doc (WebFetched 2026-05-20 status 200): says "alert dispatched to multiple channels is delivered to every channel that is enabled" — this sidecar surfaces a DRIFT not a CONTRADICTION (within-channel partial-failure described; cross-channel RuntimeException abort NOT described). Recorded under `doc_drift_findings`.
- **claim-strengthening summary**: 4 STRENGTHEN, 0 SUPERSEDE, 0 CONFLICT.
- **back-links emitted**: F-009, F-007, F-006, P-07, LSN-001, LSN-017, LSN-018 + 3 related sidecars.

## Maintainer notes
