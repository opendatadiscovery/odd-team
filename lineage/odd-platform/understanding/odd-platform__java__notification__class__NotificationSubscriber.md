---
node_id: "odd-platform java notification class:NotificationSubscriber"
node_kind: class
axis: notification
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-notificationsubscriber
---

# NotificationSubscriber — semantic understanding

## understanding

`NotificationSubscriber` is the run-loop **primary surface** of ODD Platform's outbound alert-notification subsystem (F-009 / P-07:F-002 WAL-driven Notification Delivery). It is a JDK `Thread` subclass (not a Spring `@Component` — instantiated and submitted to a dedicated single-thread `ExecutorService` by `NotificationSubscriberStarter` on `ApplicationReadyEvent`) that, on the leader-elected node, opens a Postgres logical-replication connection through `PGConnectionFactory`, lazily creates the named replication slot + publication if absent, opens a `PGReplicationStream` against `pgoutput`, and polls `stream.readPending()` in an inner busy-sleep loop (10 ms sleep on empty buffer). Each non-empty buffer is decoded via `PostgresWALMessageDecoder.decode(...)`; INSERT/UPDATE messages on the `ALERT` table are routed to the injected `PostgresWALMessageProcessor` (production binding: `AlertNotificationMessageProcessor`) for translate + fan-out, and the `setAppliedLSN` + `setFlushedLSN` are advanced to `stream.getLastReceiveLSN()` **immediately after** the synchronous `process(...)` returns successfully. Any unhandled exception in the inner loop (decoder failure, processor failure, leader-lock loss, replication-stream disconnect) is caught by the outer `while (!Thread.interrupted())` loop, logged at ERROR, releases the lock via try-with-resources on the `Connection`, then waits 10 seconds before re-acquiring the advisory lock and rebuilding the stream — meaning the un-advanced WAL position is re-delivered on the next iteration (the **at-least-once with poison-message-replay** delivery semantic; see `poison-message-wal-replay-loop` concept). This file is the canonical evidence for the lazy-create-no-drop replication-artefact policy (lines 104-126 + 128-158) and for the cluster-wide single-writer invariant that anchors F-009.

## concepts

- entities: [
    "NotificationSubscriber (extends java.lang.Thread; @RequiredArgsConstructor)",
    "WalProperties (injected; carries advisoryLockId / replicationSlotName / publicationName)",
    "PostgreSQLLeaderElectionManager (interface; acquires a Connection holding `pg_advisory_lock(?)`)",
    "PostgresWALMessageDecoder (sibling; decoder strategy)",
    "PostgresWALMessageProcessor (interface — production binding: AlertNotificationMessageProcessor)",
    "PGConnection / PGReplicationStream / ChainedLogicalStreamBuilder (org.postgresql replication API)",
    "Tables.ALERT (jOOQ table reference — the only published table)",
    "DecodedWALMessage (Optional<...> from decoder)",
    "NotificationSubscriberException (re-throw envelope on InterruptedException)"
  ]
- operations: [
    "leader acquisition (`leaderElectionManager.acquire(advisoryLockId, true)` — true = replication-mode connection)",
    "replication-slot existence probe + lazy CREATE_REPLICATION_SLOT using `pgoutput` output plugin",
    "publication existence probe + lazy CREATE PUBLICATION FOR TABLE alert (only the alert table is published)",
    "open `PGReplicationStream` with `proto_version=1` + `publication_names=<configured publication>`",
    "busy-poll `stream.readPending()` with 10 ms back-off on empty buffer",
    "decode each non-empty buffer to `Optional<DecodedWALMessage>`",
    "synchronous `messageProcessor.process(decodedMessage)` for present messages",
    "advance both `setAppliedLSN` AND `setFlushedLSN` to `stream.getLastReceiveLSN()` after each processed message",
    "outer-loop fallback: catch any Exception, log ERROR, release the lock via try-with-resources, sleep 10 s, retry"
  ]
- invariants: [
    "Single subscriber per cluster — leader is whoever holds `pg_advisory_lock(notifications.wal.advisory-lock-id)`; other instances block in `acquire(...)`",
    "Output plugin is hardcoded to `pgoutput` (PG 10+ native logical-decoding plugin) — NOT operator-tunable",
    "Only the `ALERT` table is published — hardcoded `Tables.ALERT` at line 51; subscriber will not surface WAL events for any other table",
    "Lazy-create-no-drop policy: BOTH replication slot AND publication are CREATEd on first leader run if absent; NEITHER is DROPped by this code (cleanup is an operator responsibility documented on the live doc page)",
    "LSN advance happens AFTER `process(...)` returns successfully — uncaught throws inside `process(...)` will surface to the outer catch, the lock is released, and the un-advanced LSN re-delivers the same message (at-least-once with poison-replay)",
    "setAppliedLSN and setFlushedLSN are advanced together to the SAME `getLastReceiveLSN()` value — the platform does NOT distinguish 'applied at consumer' from 'durably flushed to Postgres' (both fire on the same `process(...)` completion)",
    "Empty `readPending()` quiesces with 10 ms sleep — idle CPU bounded but the thread is NOT parked on an event — it polls",
    "Outer-loop retry cadence is hardcoded 10 seconds — no exponential back-off, no operator-tunable retry delay",
    "Thread interrupt is honored at TWO checkpoints (outer `while (!Thread.interrupted())` at L46 and inner `if (Thread.interrupted())` at L62) — graceful shutdown propagates the interrupt and exits cleanly without advancing LSN on the in-flight message",
    "RELATION messages (PG schema-info events on first encounter of a relation oid) are decoded for column-meta caching but produce `Optional.empty()` — they do NOT fire `process(...)` (per PostgresWALMessageDecoder.java:46-47)",
    "TRUNCATE / DELETE / BEGIN / COMMIT / TYPE / ORIGIN / LOGICAL_DECODING_MESSAGE are silently dropped (decoder switch default → `Optional.empty()` per PostgresWALMessageDecoder.java:52-53)"
  ]
- audiences: [
    "platform-operator (configures PG replication; observes the subscriber-thread logs; manually cleans up replication slot + publication on subsystem disable per live doc)",
    "spring-container (instantiates and runs this Thread via NotificationSubscriberStarter's single-thread ExecutorService at `ApplicationReadyEvent`)",
    "data-engineer-analyst + data-quality-engineer (downstream alert recipients — the end of the WAL → fan-out chain whose first hop lives in this file)",
    "notification-recipient (Slack channel / webhook endpoint / email inbox — receives the payload assembled downstream of this subscriber)"
  ]

## dependencies_semantic

- requires-feature: [
    "`notifications.enabled=true` — the `@ConditionalOnNotifications` gate is enforced on `NotificationSubscriberStarter` (the only construction site of this class) per NotificationSubscriberStarter.java:17; THIS file is NOT itself a Spring bean, but it is unreachable when the subsystem is off",
    "Alerting feature must produce rows on `ALERT` table — the publication only carries `Tables.ALERT` (line 51), and the decoder only routes INSERT + UPDATE on that table; an alerting subsystem that bypasses the ALERT table (e.g. emits via an outbox in a different table) would NOT be visible to this subscriber"
  ]
- requires-config: [
    "notifications.wal.advisoryLockId (default 100) — passed to leaderElectionManager.acquire(...) at line 47; collides silently with operator-customised partition/datacollab lock ids if reused (sibling NotificationsProperties sidecar captured the collision risk)",
    "notifications.wal.replicationSlotName (default `odd_platform_replication_slot`) — used in the slot-exists probe at L106 + the SLOT_NAME parameter at L57 + the CREATE_REPLICATION_SLOT at L118",
    "notifications.wal.publicationName (default `odd_platform_publication_alert`) — used in the publication-exists probe at L133 + the streamOptions `publication_names` value at L43 + the CREATE PUBLICATION at L151"
  ]
- requires-runtime: [
    "PostgreSQL with `wal_level=logical`, `max_replication_slots>=1`, `max_wal_senders>=1`, `wal_keep_size>=16` (per live doc, verified WebFetch 2026-05-20 status 200)",
    "Database role with `WITH REPLICATION` attribute (`ALTER ROLE <user> WITH REPLICATION`) — the replication-mode connection at line 47 needs this; PG rejects the streaming-replication protocol without it",
    "Postgres `pgoutput` output plugin (built-in since PG 10) — hardcoded at line 30 as `PG_REPLICATION_OUTPUT_PLUGIN`; PG 9.x is not supported",
    "PGConnectionFactory + replication-mode JDBC URL — opens connection with `PGProperty.REPLICATION=database` + `ASSUME_MIN_SERVER_VERSION=11.0` (sibling PGConnectionFactory.java:30-32)",
    "PostgreSQLLeaderElectionManager — implementation acquires `pg_advisory_lock(...)` on the same Connection used for streaming (line 22 of PostgreSQLLeaderElectionManagerImpl); the lock is released when the try-with-resources closes the Connection",
    "JDK ≥17 (Spring Boot 3.x) — file uses `String.formatted(...)` (JDK15+ instance method), `Map.of(...)` and try-with-resources extensively",
    "An injected `PostgresWALMessageProcessor` bean — at runtime this is `AlertNotificationMessageProcessor` per @ConditionalOnNotifications scoping; in tests it could be a fake/no-op, but no tests exist in the package (verified zero matches in tests-coverage)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "Replication-slot lazy create — does the slot get created on first run if absent? Does the existing-slot probe correctly skip creation? (lines 104-126)",
    "Publication lazy create — same path, lines 128-158",
    "Race: two ODD instances boot concurrently, both pass the slot-exists check at L106 while the slot does not yet exist, both attempt CREATE_REPLICATION_SLOT — the second `createReplicationSlot()` call will fail with PG `ERROR: replication slot already exists` (Postgres-side serialisation), and the failure surfaces as a `SQLException` that propagates to the outer catch at L90, causing a 10s retry. Behaviour is correct but no test asserts it (and no test asserts that the retry eventually succeeds)",
    "Leader-loss-mid-stream — operator runs `SELECT pg_terminate_backend(...)` on the streaming connection: the streaming loop throws, the lock is released, the outer catch logs, the 10s sleep + re-acquire fires. No test asserts the recovery path completes correctly",
    "Decoder returns `Optional.empty()` for non-INSERT/UPDATE messages (RELATION / TRUNCATE / DELETE / BEGIN / COMMIT / TYPE / ORIGIN / LOGICAL_DECODING_MESSAGE) — line 79 short-circuits the processor call but STILL advances LSN at lines 83-84; this prevents un-decodable-message accumulation but no test asserts it",
    "Process-throws-uncaught → LSN replay loop (the poison-message replay invariant captured as a concept; sibling AlertNotificationMessageProcessor.process throws IllegalArgumentException on unknown alert types and IllegalStateException on missing data — both bypass the inner try and reach the outer catch; LSN does NOT advance; same message re-delivers on the next 10s iteration). No test simulates this loop",
    "Thread.interrupt during inner loop — the L62 check exits the inner loop with `Thread.currentThread().interrupt()` set + `return`; the outer try-with-resources closes the connection; the run() method exits. No test asserts the graceful-shutdown path",
    "InterruptedException inside `TimeUnit.MILLISECONDS.sleep(10L)` at L71 — propagates to the outer catch at L87 which re-interrupts and throws `NotificationSubscriberException`. No test asserts the InterruptedException-on-empty-buffer path",
    "Replication-slot orphan: operator renames `notifications.wal.replication-slot-name` between deploys without dropping the old slot — Postgres retains WAL forever for the orphan slot. Behaviour is correct (the new run creates the new slot), but no test asserts the live-doc-warned operator trap",
    "Connection close failure on outer try-with-resources (e.g. PG server is down) — the AutoCloseable's close() throws, the outer catch fires, the 10s sleep + retry begins, but the original cause is lost in the close-failure exception per Java's try-with-resources exception suppression rules. No test asserts the diagnostic chain",
    "CREATE PUBLICATION SQL injection surface (line 151) — the publication-name and table-name are interpolated via `String.formatted(...)` directly into a CREATE PUBLICATION statement; both come from operator config + jOOQ Tables registry. jOOQ-side is safe (compile-time), but `walProperties.getPublicationName()` is operator-supplied. A pathological value (`'odd; DROP TABLE alert; --'`) would inject. PG identifier rules and the validation absence is documented under bugs_limitations_corner_cases."
  ]
- test_files: []
- gaps: |
    The notification package has ZERO test files (verified
    `find <odd-platform-repo> -path '*notification*' -name '*Test*.java'` returns no matches; same finding
    as sibling NotificationsProperties + NotificationConfiguration sidecars). The most regression-prone
    behaviours specific to THIS file:

    1. **Lazy-create idempotency under concurrent startup** — two instances racing the slot-exists check
       (TOCTOU window between SELECT EXISTS at L111 and createReplicationSlot at L115). Recovery relies
       on PG's serialised slot-creation throwing a SQLException that the outer catch absorbs. The
       resulting 10s retry should observe the slot now exists and skip creation, but the existing-slot
       branch is logically separate from the SQLException path — no test verifies the second instance's
       second attempt succeeds.

    2. **LSN advance ONLY after successful process** — this is the canonical at-least-once invariant of
       the file. A test that injects a `PostgresWALMessageProcessor` mock that throws on the first
       invocation and succeeds on the second, then asserts that the message is delivered TWICE (the
       poison-replay loop), is the load-bearing regression test for the F-009 chain. No such test exists.

    3. **No test asserts the publication contains EXACTLY the ALERT table** — a future refactor adding
       another `registerPublication(connection, Tables.OTHER)` call would broadcast OTHER's WAL events
       to the same fan-out chain, with no test failing on the unintended broadcast. Combined with the
       `AlertNotificationMessageProcessor`'s lack of relation-id filter, additional published tables
       would attempt to be decoded as ALERT rows and crash with `IllegalArgumentException` in the
       translator — yet another path into the poison-replay loop.

    4. **Outer-loop retry cadence (10s sleep) is hardcoded** — no operator-tunable knob. A test that
       confirms the retry actually waits 10s ± delta (vs accidentally re-acquiring instantly, which
       could thrash the advisory lock under flapping leader conditions) does not exist.

    5. **`Thread.interrupt()` during outer 10s sleep (L96)** — the catch block at L97-100 re-interrupts
       and throws `NotificationSubscriberException`, but this exits `run()` entirely. After this, the
       Executor's single thread is gone, and `NotificationSubscriberStarter` does NOT detect the death
       (no future.get(), no restart logic). No test asserts the failure mode.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-alert-notifications"
    rationale: "The live `configuration-and-deployment/odd-platform` page is the canonical operator-facing home for the WAL-driven delivery mechanism this file implements. It documents every `notifications.wal.*` knob this file reads (advisory-lock-id, replication-slot-name, publication-name), the PostgreSQL configuration the runtime depends on (`wal_level=logical`, `max_wal_senders>=1`, `wal_keep_size>=16`, `max_replication_slots>=1`), the cluster-wide single-subscriber semantics enforced by the advisory lock, and the lazy-create-no-drop policy ('ODD Platform doesn't clean up replication slot it has created.')."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Quoted verbatim from the "Enable Alert Notifications" section:

      Mechanism narrative:
        "ODD Platform uses the PostgreSQL replication mechanism to be able to send a notification
         even if there's a network lag occurred or the Platform crashes."

      Lazy-create + cleanup policy:
        Slot + publication "created if it doesn't exist yet."
        "ODD Platform doesn't clean up replication slot it has created."
        Cleanup SQL:
          SELECT pg_drop_replication_slot('<replication_slot_name>');
          DROP PUBLICATION IF EXISTS <publication_name>;

      Postgres requirements:
        max_wal_senders = 1
        wal_keep_size = 16
        wal_level = logical
        max_replication_slots = 1
        ALTER ROLE {username} WITH REPLICATION

      Single-subscriber semantics (advisory lock):
        "`notifications.wal.advisory-lock-id` (default `100`) ensures only one instance of the
         Platform processes alert messages in horizontally-scaled deployments via PostgreSQL
         advisory locking."

      Cloud-provider variance:
        "configuration may vary from one on-demand/cloud provider to another"
        AWS RDS: requires `rds.logical_replication=1` and `rds_replication` role grants instead.

  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/notifications"
    anchor: ""
    rationale: "Feature-level overview page describing what alert notifications are (the user-observable surface) and referencing the WAL-driven outbound dispatcher. The page references the configuration anchor (configuration-and-deployment/odd-platform#postgresql-configuration) for replication-slot details, but DOES NOT itself document delivery semantics (at-least-once / poison-replay / restart recovery)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20, status 200. Page explicitly mentions:
        "the outbound dispatcher requires a configured PostgreSQL logical-replication slot"
        (back-link to /configuration-and-deployment/odd-platform.md#postgresql-configuration)
      Page is SILENT on: WAL-driven delivery mechanics, delivery semantics (at-least-once /
      at-most-once / exactly-once), restart behaviour, recovery from disconnect / failover,
      alert duplication behavior, retry behaviour, and the relationship between Alert row
      INSERT/UPDATE and notification message firing. (WebFetch agent explicitly noted these
      questions were unanswered by the page.)

- doc_drift_findings:
  - "Live doc claims `max_wal_senders = 1` AND `max_replication_slots = 1` as the configuration values to set. This is presented as exact numeric guidance but it is a MINIMUM, not a target value — Postgres clusters often have OTHER replication consumers (PGBouncer logical-replication probes, Debezium consumers, streaming replicas) needing their own senders/slots. Following the live doc verbatim on a multi-consumer PG cluster would lower an existing higher value to 1, breaking other consumers. THIS file's actual requirement is `>= 1`. (Live doc later says 'increment if replication already exists', but the prominent example values still read as absolutes.) Candidate doc clarification DOC-NNN."
  - "Live doc states 'only one instance of the Platform processes alert messages' as the advisory-lock guarantee, but does NOT name the failure mode if the lock-holder dies mid-stream (sibling NotificationSubscriber.run() outer-loop releases the lock on Exception and waits 10s before re-acquiring — other instances can take leadership during that window). The HA-failover narrative is undocumented. Operator-facing gap."
  - "Live doc's `/features/active-platform-features/notifications` page DOES NOT document the at-least-once delivery semantic captured by THIS file's LSN-advance-after-process pattern. Live-doc-side silence on (a) duplicate delivery on subscriber restart with un-advanced LSN, (b) the poison-message-WAL-replay-loop already catalogued as a concept-level invariant, (c) the 10s retry cadence after any unhandled exception. DOC-GAP-230 already tracks this category."
  - "The DOC-GAP-230 entry surfaced under `lineage/odd-platform/doc-gaps/detail/DOC-GAP-230.md` is the doc-side cross-reference for this file's WAL-replay-loop fragility — operator currently has no live-doc-anchored remediation path for the load-bearing poison-message failure mode beyond `pg_drop_replication_slot(...)` which loses all in-flight undelivered alerts."

## implicit_adrs

- "**Output plugin is hardcoded to `pgoutput`** (not operator-tunable). `pgoutput` is the PG-native logical-decoding plugin shipped since PG 10, removing the operator burden of installing `wal2json` or `decoderbufs` as third-party extensions. The decision binds the platform to PG ≥10 (consistent with `PGConnectionFactory.ASSUME_MIN_SERVER_VERSION=11.0`) and to the pgoutput binary-format that `PostgresWALMessageDecoder` knows how to parse. The hardcoded constant + the `PG_REPLICATION_OUTPUT_PLUGIN` name + the no-config-key-for-this-knob shape are the intent anchor." — evidence: NotificationSubscriber.java:30 + L119 — intent_anchor: "`private static final String PG_REPLICATION_OUTPUT_PLUGIN = \"pgoutput\";` + `.withOutputPlugin(PG_REPLICATION_OUTPUT_PLUGIN)`" — confidence: HIGH

- "**Lazy-create-no-drop replication artefact policy** — both the slot AND the publication are CREATEd on first leader run if absent (lines 113-120 + 140-152) but NEITHER is DROPped on shutdown or on disable. The decision encodes 'operator owns cleanup' (live doc verbatim: 'ODD Platform doesn't clean up replication slot it has created.'). The intent is durability — a slot that survives a platform crash retains the WAL position so the subscriber resumes at the last unprocessed message rather than losing alerts. The trade-off is the operator-must-manually-clean caveat that lives in the live doc + the rename-orphan disk-exhaustion risk." — evidence: NotificationSubscriber.java:104-126 (slot create-if-absent) + L128-158 (publication create-if-absent) + WebFetched live doc + sibling NotificationsProperties.implicit_adrs.[4] — intent_anchor: "`SELECT EXISTS (SELECT slot_name FROM pg_replication_slots WHERE slot_name = ?)` + `if (!resultSet.getBoolean(1)) { ... createReplicationSlot() ... }` (the explicit exists-then-create pattern, applied symmetrically to both slot and publication) + live-doc quote" — confidence: HIGH

- "**Leader-elected single-writer-per-cluster** — the run loop acquires `pg_advisory_lock(notifications.wal.advisory-lock-id)` on the very first statement of the outer loop (L47) and any code path that loses or fails to acquire the lock results in either blocking-in-acquire (the canonical happy path for the non-leader) or releasing-and-retrying-after-10s (the leader-failover path). The decision encodes 'duplicate-notification prevention by Postgres-mediated serialisation' — there is no application-level lease, no Zookeeper, no Redis, just PG advisory locks. The intent is operational simplicity (no extra service to deploy) and atomicity (the lock is automatically released by the JDBC connection close, ruling out lock-leak-on-crash)." — evidence: NotificationSubscriber.java:47 (`leaderElectionManager.acquire(walProperties.getAdvisoryLockId(), true)`) + PostgreSQLLeaderElectionManagerImpl.java:22 (`SELECT pg_advisory_lock(%d)`) — intent_anchor: "the try-with-resources scoping the entire WAL processing inside the lock-holding Connection: `try (final Connection connection = leaderElectionManager.acquire(...)) { ... }`" — confidence: HIGH

- "**At-least-once delivery via LSN-advance-AFTER-process** — the order of operations inside the inner loop is (a) decode, (b) call `process(...)` synchronously, (c) advance both setAppliedLSN AND setFlushedLSN to the just-received LSN. The decision encodes 'a successfully-delivered alert advances the WAL pointer; an unsuccessful one does NOT, so the next subscriber-restart re-delivers' — at-least-once semantics. The platform deliberately accepts the duplicate-delivery risk to avoid the alternative (advance-before-process → loss-on-crash) which would violate operator expectations for an alerting system. The choice is intent-anchored by the literal statement order in the inner loop." — evidence: NotificationSubscriber.java:77-84 (decode → process → setAppliedLSN/setFlushedLSN in that order, with NO try/catch around process to short-circuit the LSN advance) — intent_anchor: "the literal statement order: `final Optional<DecodedWALMessage> decodedMessage = messageDecoder.decode(buffer); if (decodedMessage.isPresent()) { messageProcessor.process(decodedMessage.get()); } stream.setAppliedLSN(stream.getLastReceiveLSN()); stream.setFlushedLSN(stream.getLastReceiveLSN());`" — confidence: HIGH

- "**setAppliedLSN and setFlushedLSN advance together to the same `getLastReceiveLSN()`** — the platform does not distinguish 'consumer has applied this message' from 'consumer has durably acknowledged this message back to Postgres for WAL release'. Both advance in lock-step. The decision avoids the operational complexity of tracking two separate horizons; the trade-off is that Postgres cannot release WAL ahead of the consumer's processing pace (which is already the at-least-once-friendly stance) but also cannot retain WAL past the consumer's processing horizon for redundancy. The intent is the smallest possible Postgres-side state for an outbound-only consumer." — evidence: NotificationSubscriber.java:83-84 — intent_anchor: "`stream.setAppliedLSN(stream.getLastReceiveLSN()); stream.setFlushedLSN(stream.getLastReceiveLSN());`" — confidence: MEDIUM (the same-value coupling is intentional per the code structure; the trade-off-vs-WAL-redundancy reasoning is inferred from the pattern, not explicitly stated)

- "**Only the `ALERT` table is published** — the `registerPublication(connection, Tables.ALERT)` call at line 51 hardcodes the published-table set to a single jOOQ table reference. Adding another table to the publication requires a code change (not a config change), keeping the WAL-driven dispatcher tightly scoped to alerts and preventing accidental broadcast of unrelated table changes. The trade-off: any future WAL-driven sub-feature (e.g. activity events, lookup-table mutations) must implement its own subscriber, its own publication, its own slot — there is no shared-WAL-bus pattern in the platform today." — evidence: NotificationSubscriber.java:51 (`registerPublication(connection, Tables.ALERT)`) + L128-130 (the only target-table parameter is the alert table) — intent_anchor: "`registerPublication(connection, Tables.ALERT);` — the literal hard-binding to the ALERT table via a jOOQ Tables.* constant rather than a config key" — confidence: HIGH

- "**Inner-loop polling, not event-driven** — the polling pattern (`buffer = stream.readPending(); if (buffer == null) { TimeUnit.MILLISECONDS.sleep(10L); continue; }`) is a deliberate choice over the alternative `stream.read()` blocking call. The 10 ms sleep gives the thread a yield window and makes the inner loop interruptable at the `Thread.interrupted()` check at L62. The trade-off: ~10 ms median latency added to each alert vs the simplicity of an interruptible inner loop without a separate timeout thread. The intent is clean shutdown ergonomics." — evidence: NotificationSubscriber.java:68-72 — intent_anchor: "`final ByteBuffer buffer = stream.readPending(); if (buffer == null) { TimeUnit.MILLISECONDS.sleep(10L); continue; }` — the explicit non-blocking call + sleep + interruption-check sequence" — confidence: HIGH

- "**10s outer-loop retry cadence** — on any uncaught Exception in the inner streaming loop (decoder failure, processor failure, PG connection drop, leader-lock-loss), the outer catch logs the error and the run loop sleeps for 10 seconds before re-acquiring the lock and rebuilding the stream. The decision encodes a fixed back-off rather than exponential — a flapping Postgres relay produces 6 retries/minute, capped by the lock-acquire blocking semantics. The intent is operational predictability over adaptive throttling." — evidence: NotificationSubscriber.java:94-100 — intent_anchor: "`log.debug(\"Released a lock, waiting 10 seconds for next iteration\"); try { TimeUnit.SECONDS.sleep(10L); } ...` (hardcoded 10 s, no config key for the retry delay)" — confidence: MEDIUM (the cadence is hardcoded with intent — the explicit `log.debug` framing supports that the 10s wait is part of the documented behaviour — but no comment explains WHY 10s vs another value)

## bugs_limitations_corner_cases

- "**Poison-message WAL replay loop** — the inner `messageProcessor.process(decodedMessage.get())` call at L80 is NOT wrapped in a try/catch. Any RuntimeException thrown by the processor (AlertNotificationMessageProcessor → AlertNotificationMessageTranslator throws IllegalArgumentException on unknown alert-type code, IllegalStateException on missing/duplicate alerted-entity rows) propagates out of the inner while-true, is caught by the outer Exception handler at L90, the lock is released, the 10s sleep + re-acquire fires, the SAME un-advanced LSN re-delivers, the translator throws again, ad infinitum. A persistently-bad ALERT row blocks ALL subsequent WAL messages cluster-wide with no operator visibility beyond log inspection. The only remediations are: (a) clean up the bad row, or (b) `pg_drop_replication_slot(...)` (which loses all in-flight undelivered alerts). No DLQ, no skip-poison mechanism, no operator API to advance LSN past a bad message. Captured as the dedicated `poison-message-wal-replay-loop` invariant in the concept catalog (concepts.yaml:4580). This is the load-bearing fragility of the F-009 pillar." — evidence: NotificationSubscriber.java:77-91 (no try/catch around process; setAppliedLSN only after successful return) + AlertNotificationMessageProcessor.java:23-24 (translate is uncaught) + sibling NotificationsDispatcher.md.bugs_limitations_corner_cases.[6] — severity: HIGH

- "**Single-table publication is hardcoded** — `registerPublication(connection, Tables.ALERT)` at L51 hardwires the published-table set. Adding another WAL-driven sub-feature requires a code change. Worse: if a future maintainer adds a SECOND `registerPublication(connection, Tables.OTHER)` call WITHOUT also updating the downstream decoder + processor to handle the new relation-id, OTHER's WAL events would attempt to decode as ALERT rows via `tableColumns.get(relationId)`-on-cache-miss → `RuntimeException(\"No column meta for relation ID %d\".formatted(relationId))` (PostgresWALMessageDecoder.java:96), which bypasses the dispatcher and lands in the same poison-replay loop. The single-table coupling is enforced only by social convention (one call site); no test catches the regression." — evidence: NotificationSubscriber.java:51 + PostgresWALMessageDecoder.java:96 — severity: MEDIUM

- "**`registerPublication` interpolates publication-name + table-name via `String.formatted(...)` into a CREATE PUBLICATION DDL** — line 151: `\"CREATE PUBLICATION %s FOR TABLE %s\".formatted(walProperties.getPublicationName(), tableName)`. PG identifiers are NOT parameterisable in prepared statements, so the interpolation is structurally required, but no validation/escaping is applied. The `tableName` is sourced from `targetTable.getSchema().getName() + \".\" + targetTable.getName()` (line 144) which is compile-time jOOQ-safe, but the `publicationName` comes from operator config (`notifications.wal.publication-name`). A pathological config value (`'odd_alert; DROP TABLE alert; --'`) would inject; PG identifier-quoting rules (and the lack of identifier-escaping here) make this exploitable in principle. The likelihood is low (config is operator-owned, not user-supplied), but no test asserts the validation absence. Severity is MEDIUM because the attack surface is operator-config-modification (which already grants broader compromise) not user-controlled input." — evidence: NotificationSubscriber.java:144-152 — severity: MEDIUM

- "**Publication-name probe uses `pubname` column from `pg_publication`** — line 133: `SELECT EXISTS (SELECT oid FROM pg_publication WHERE pubname = ?)`. The probe-statement IS parameterised (PreparedStatement), unlike the create statement at L151. The asymmetry is structural (PG bans parameterised DDL identifiers) but worth noting: only one of the two statements gets the SQL-injection guard rail." — evidence: NotificationSubscriber.java:133-135 vs L151 — severity: LOW

- "**Replication-slot orphan on slot-name rename** — if an operator changes `notifications.wal.replication-slot-name` between deploys without first running `SELECT pg_drop_replication_slot('<old_name>')` (per the live doc cleanup SQL), the OLD slot accumulates WAL forever on the primary. Risk: primary disk exhaustion. The lazy-create at L113-120 creates the NEW slot fine — the OLD slot is now invisible to ODD Platform but still pinned by Postgres. Documented as a `bugs_limitations_corner_cases` entry on sibling NotificationsProperties.md and as a `lazy-create-no-drop` canonicalisation candidate." — evidence: NotificationSubscriber.java:104-126 (lazy create with no rename detection) + WebFetched live doc — severity: MEDIUM

- "**`setAppliedLSN` advances even for non-INSERT/UPDATE messages** — line 79 short-circuits the processor call on `Optional.empty()` (the decoder returns empty for RELATION / TRUNCATE / DELETE / BEGIN / COMMIT / TYPE / ORIGIN / LOGICAL_DECODING_MESSAGE), but lines 83-84 STILL advance setAppliedLSN + setFlushedLSN unconditionally. This is correct behaviour (we don't want WAL accumulation just because we're skipping an irrelevant message type), but it has a subtle implication: a TRUNCATE on the alert table would advance the WAL pointer past the truncation without firing a notification. Operators relying on alerts during a TRUNCATE-induced outage have NO signal. Severity is LOW because operators don't normally TRUNCATE the alert table." — evidence: NotificationSubscriber.java:77-84 (LSN advance is outside the `if (decodedMessage.isPresent())` block) + PostgresWALMessageDecoder.java:46-54 (TRUNCATE / DELETE / etc. return empty) — severity: LOW

- "**Outer catch absorbs ALL Exception subtypes uniformly** — line 90: `catch (final Exception e) { log.error(\"Error occurred while subscribing\", e); }`. SQLException (connection lost), RuntimeException (processor poison-replay), Postgres-side replication-protocol violations, decoder out-of-bounds reads — all converge to the same handler with the same 10s retry. The platform has no way to distinguish 'transient PG connectivity blip' from 'persistent poison message at this LSN'. Distinct error-class metrics would let operators see WHICH failure mode dominates; current observability is `log.error` at a single severity with no Prometheus counter, no structured field, no error-class taxonomy." — evidence: NotificationSubscriber.java:90-92 — severity: MEDIUM

- "**`NotificationSubscriberStarter` has no thread-death detection** — sibling NotificationSubscriberStarter.java:33-35 submits `new NotificationSubscriber(...)` to a single-thread ExecutorService but never holds the returned `Future`. If THIS file's `run()` exits (e.g. via the `NotificationSubscriberException` thrown at L89 or L99 on outer-loop InterruptedException), the executor's worker dies and the subscriber is gone for the rest of the JVM lifetime. The platform continues to accept alerts (INSERT/UPDATE into `alert`), Postgres continues to retain WAL on the slot, and no notifications fire — silently. No log line tracks the dead subscriber; operators discover the failure when an alert they expected never delivers." — evidence: NotificationSubscriber.java:87-100 (re-throw on InterruptedException paths) + NotificationSubscriberStarter.java:33-35 (no `Future` retained, no exception handler) — severity: HIGH

- "**Outer-loop retry sleep is itself uncancellable** — `TimeUnit.SECONDS.sleep(10L)` at L96 catches InterruptedException AND re-throws as NotificationSubscriberException (L99). If a graceful shutdown signal arrives during the 10 s sleep, the subscriber thread exits via the re-throw — the same dead-subscriber-no-detection pathology applies. The inner-loop 10 ms sleep also wraps in a try-catch but only the outer catch (L87) re-throws as NotificationSubscriberException. Behaviour is consistent but the exit-on-interrupt-during-retry-sleep pattern is brittle." — evidence: NotificationSubscriber.java:95-100 + L87-89 — severity: MEDIUM

- "**No metric for in-flight LSN or last-applied LSN** — the subscriber's progress is observable only via Postgres-side `SELECT * FROM pg_replication_slots WHERE slot_name = ?` (operator query) or `log.debug(\"processing LSN: {}\", stream.getLastReceiveLSN())` at L75 (debug-level only, requires DEBUG logging enabled). No Prometheus gauge for `notification_wal_last_applied_lsn`, no counter for `notification_wal_messages_processed_total{operation=INSERT|UPDATE}`. Operators cannot answer 'is the subscriber making progress?' or 'how far behind is it?' from telemetry; they must shell into Postgres." — evidence: NotificationSubscriber.java:75 + ABSENCE of metrics imports/Micrometer registry calls — severity: MEDIUM

- "**Replication-slot probe race window** — between the EXISTS probe at L106-112 and the createReplicationSlot at L115-120, a second ODD instance starting concurrently could pass the same probe (slot not yet present) and attempt the same create. Postgres serialises slot creation (the second call gets `ERROR: replication slot already exists`), which surfaces as a SQLException to the outer catch at L90. The retry loop will then observe the slot exists and skip creation — correct behaviour, but no test asserts it, and the failure surface (a SQLException during boot) is not specifically logged as 'race with another instance' (just generic `Error occurred while subscribing`). Operator diagnostic friction." — evidence: NotificationSubscriber.java:106-122 + L90-92 — severity: LOW

- "**`Properties` map for replication slot options is hardcoded to `proto_version=1`** — line 42. Postgres logical decoding currently supports proto_version 1, 2, 3, 4. Locking to v1 means streaming-decoding optimisations introduced in PG 14+ (e.g. `streaming` parameter for in-progress transactions) are not accessible without a code change. Trade-off: maximum compatibility (PG 10+) vs no headroom for future optimisations. No config key surfaces the proto_version choice; operators on PG 14+ cannot opt into newer-protocol behaviours." — evidence: NotificationSubscriber.java:42 (`\"proto_version\", \"1\"`) — severity: LOW

- "**Replication connection is opened EVERY outer-loop iteration** — the try-with-resources at L47 acquires a fresh Connection per leader-acquisition cycle. On a stable leader the outer loop never iterates (the inner while-true holds the stream until interrupted or exception), so the connection is long-lived. But on an unstable leader (frequent exceptions in the inner loop), each retry opens a new Connection + replication-slot probe + publication probe = 3 round-trips per retry, every 10s. Under churn this could overwhelm a stressed Postgres. No connection caching, no probe-result caching. Severity LOW because the churn would require pre-existing PG instability." — evidence: NotificationSubscriber.java:46-92 — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `NotificationSubscriber` is a `Thread` subclass run via an `ExecutorService` on `ApplicationReadyEvent`. It is not on the HTTP surface; ODD's `auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) does not gate this code directly. Behaviour shifts based on the FEATURE gate (`notifications.enabled` enforced at NotificationSubscriberStarter level via `@ConditionalOnNotifications`), not the AUTH mode. — evidence: NotificationSubscriber.java:1-159 (no Spring annotations, no HTTP imports) + NotificationSubscriberStarter.java:17 (`@ConditionalOnNotifications` is the only gate).

- **ingestion_filter_relevance**: `NO — outbound subsystem, not on the /ingestion path`. The subscriber READS from the `ALERT` table via WAL and routes to outbound senders; nothing here participates in the `IngestionDataEntitiesFilter` chain on `POST /ingestion/entities`. — evidence: NotificationSubscriber.java:1-159 (no servlet filter, no controller mapping, no `/ingestion/*` references).

- **authorization_assertions**: [] — `Thread` subclass; no `@PreAuthorize` is applicable. Authorization is enforced upstream at the alert-creation site (which `INSERT`s into the alert table); the WAL subscriber receives all rows that PG decoded for the publication.

- **owner_scoping**: `BYPASSES — every WAL event is processed regardless of which data-entity owners the alert references`. The subscriber is downstream of the `ALERT` table; it has no view into ownership. Every configured channel receives every alert event regardless of which data-entity owners would have been entitled to see it. The processor (AlertNotificationMessageProcessor) iterates the full sender list per WAL event — no per-owner / per-namespace / per-tenant scoping. — evidence: NotificationSubscriber.java:80 (single `process(...)` call; no owner inspection) + sibling AlertNotificationMessageProcessor.java:25-36 (no owner filter) + sibling AlertNotificationMessageTranslator (the translator runs the recursive downstream-lineage CTE — see NotificationsProperties sidecar — and emits owners[], but never consults them for routing).

- **data_exposure**: [
    "Full alert payload (alertType, eventType, eventAt, updatedBy, dataEntity.{id,name,dataSourceName,namespaceName,type,owners[]}, downstream lineage entities to `notifications.message.downstream-entities-depth`, alertChunks) → Slack channel / generic webhook URL / SMTP email recipient. The exposure is committed at this file's `process(...)` invocation (line 80) — once the processor is called, the payload is on the wire.",
    "Connection credentials (Postgres username + password from `DataSourceProperties`) are reachable via PGConnectionFactory.getConnection(true) at the start of every outer-loop iteration. The credentials live in the Spring DataSource configuration (gated by the standard ODD secrets backend); no exposure surface unique to THIS file beyond the standard Spring DataSource credential lifecycle.",
    "`log.debug(\"processing LSN: {}\", ...)` at L75 logs the WAL LSN — operationally informative, not sensitive. `log.warn` at L63 and `log.error` at L91 log thread-interrupt + generic errors with stack trace; the stack trace may include PG-side error messages that occasionally embed identifier names (publication-name, slot-name) — not sensitive at the ODD level but operator-config visible."
  ]

- **known_security_gaps**: [
    "Publication-name SQL-injection surface at L151 — `CREATE PUBLICATION` DDL interpolates the operator-configured `notifications.wal.publication-name` value via `String.formatted(...)`. PG identifier-escape rules + the platform's no-validation stance mean a pathological config value would inject. The attack vector requires operator-config modification (already a higher-privilege threat model than ODD authentication), so severity is bounded. — evidence: NotificationSubscriber.java:151 — severity: LOW",
    "No DDL identifier validation on slot-name (L106 probe + L118 SLOT_NAME parameter via the org.postgresql driver) — the driver-side validation is the only guardrail. A malformed slot-name would fail at PG with a less-helpful error than ODD-side validation would produce; not a security issue per se, but a robustness gap. — evidence: NotificationSubscriber.java:104-126 — severity: LOW",
    "Replication-role broad-scope: per the live doc, the database user requires `ALTER ROLE ... WITH REPLICATION` cluster-wide. ODD does not document scoping to a per-publication role (PG 16+ allows finer-grained replication-role grants); the broad role is a least-privilege violation in shared-DB deployments. — evidence: WebFetched live doc + NotificationSubscriber.java:47 (uses the same DataSource the rest of the platform uses) — severity: LOW",
    "No audit trail of WAL messages consumed / advanced — the LSN advance at L83-84 is silent at the application layer. Operators cannot answer 'which alerts were delivered, when?' from ODD telemetry; only `pg_replication_slots.confirmed_flush_lsn` and `log.debug` at DEBUG-level give signal. Cross-tenant or multi-team deployments with a regulatory requirement to audit alert delivery cannot meet that requirement with the current code. — evidence: NotificationSubscriber.java:75,80,83-84 — severity: MEDIUM",
    "No fan-out scoping by data-entity owner / namespace / tenant — every WAL ALERT INSERT/UPDATE is broadcast to every configured channel. (Architectural decision committed downstream at the AlertNotificationMessageProcessor + NotificationConfiguration layers; THIS file is the entry point that drives the broadcast.) For multi-team deployments, this means cross-team alert visibility is unavoidable. Concept catalog `notification-recipient` audience + sibling sidecars carry the full posture. — evidence: NotificationSubscriber.java:80 (single processor.process call) + sibling AlertNotificationMessageProcessor.java:25-36 — severity: MEDIUM"
  ]

## performance

- **hot_paths**: [
    "**Inner-loop poll** at L68-72: `stream.readPending()` is called continuously, with a 10 ms sleep on empty buffer. This is the platform's busiest single-thread loop when alerts are streaming. CPU baseline is bounded (10 ms sleep + minimal syscall per poll) but the thread is not parked — under light load it consumes one CPU-thread's worth of poll overhead per ODD instance. — evidence: NotificationSubscriber.java:68-72",
    "**Per-WAL-message decode + process** at L77-84: synchronous decode → synchronous process → synchronous LSN-advance. End-to-end latency per alert ≈ (decoder cost, ~bytes-to-Java-objects, negligible) + (process cost — sibling AlertNotificationMessageProcessor: translate via recursive CTE + iterate List<NotificationSender> with HTTP/SMTP per sender). The total per-message latency is dominated by the slowest sender. The subscriber thread is the SOLE consumer; per-message latency directly translates to backlog growth on the replication slot. — evidence: NotificationSubscriber.java:77-84 + sibling AlertNotificationMessageProcessor.java:25-36",
    "**LSN advance** at L83-84: `stream.setAppliedLSN(...)` + `stream.setFlushedLSN(...)` — two driver-side calls per message. Cheap (in-memory + occasional ack to PG); not a hot-path concern but worth noting that the platform pays this cost per message rather than batching ack."
  ]

- **throughput_characteristics**: [
    "**Single-thread WAL consumer per cluster** — exactly one subscriber thread is leader-elected via Postgres advisory lock. No parallelisation across channels, no parallelisation across messages. Throughput is bounded by the per-message process() latency (sibling: typically Slack RTT + email SMTP RTT + webhook RTT, sequential).",
    "**No batching of WAL messages** — every decoded buffer is processed and ack'd individually; no `readPending()` batch dequeue, no group-fan-out across multiple alerts.",
    "**Polling cadence** — 10 ms sleep on empty buffer adds ~5 ms median to per-alert latency under low load. Under high load (continuous stream of pending buffers) the sleep does not fire and throughput approaches per-message processing latency.",
    "**Outer-loop recovery cadence** — 10 s retry after any uncaught exception. Under instability, throughput drops to 0 for the 10 s window + however long it takes to re-acquire the lock + re-build the stream.",
    "**Bounded by sibling poison-message-replay loop**: a persistently-bad ALERT row pins throughput at exactly 0 cluster-wide until the operator remediates (see bugs_limitations_corner_cases.[0])."
  ]

- **resource_allocation**: [
    "**One JDBC Connection** in replication-mode per leader-acquisition cycle (line 47). The connection is held for the entire inner-while-true lifetime — long-lived under stable leadership. Connection bypasses HikariCP (replication-mode connections are opened via raw DriverManager per PGConnectionFactory.java:36).",
    "**One PGReplicationStream + underlying socket** per outer-loop iteration. The stream is created at L60 and closed via try-with-resources when the inner-loop exits.",
    "**Decoder column-meta cache** (PostgresWALMessageDecoder.tableColumns map): keyed by Postgres relationId from RELATION messages, accumulates entries as RELATION events arrive. The map is bounded by the number of distinct tables in the publication (currently 1 — Tables.ALERT), so the cache is effectively a single entry. If the publication scope grows the cache scales linearly.",
    "**No bounded queue between WAL decode and sender fan-out** — the processor call is synchronous in the subscriber thread; backpressure propagates back into PG (the slot stops advancing while the subscriber is stuck).",
    "**Outer 10s sleep + inner 10ms sleep** allocate no heap; cheap idle.",
    "**WAL retention on the slot** — PG retains all WAL since `confirmed_flush_lsn` for the slot. If the subscriber is stuck (poison-replay) or down (thread-death pathology), WAL accumulates on the PG primary. The live doc warns about this as the cluster-wide disk-exhaustion risk."
  ]

- **scaling_characteristics**: [
    "**Horizontal scaling = exactly one active subscriber** per cluster, enforced by the advisory lock. Adding ODD instances increases redundancy (failover speed) but NOT throughput.",
    "**Failover speed bounded by lock-release + 10s outer-loop retry** — when the lock-holder dies, other instances waiting in `acquire(...)` block until PG releases the lock (immediate on connection close, or `idle_in_transaction_session_timeout` if the holder is hung).",
    "**Vertical scaling has no headroom for THIS code** — the per-message work is single-threaded by design (proto_version=1, no streaming/parallel-apply); the only way to scale throughput is to optimise the downstream process() (parallel sender fan-out, batching).",
    "**State is durable in Postgres** — replication slot + publication + advisory lock are all PG-side, so a full cluster restart loses no WAL position. Replication-slot lifecycle is operator-managed (lazy-create-no-drop)."
  ]

- **known_performance_gaps**: [
    "**Per-message LSN ack** — every successful process() call advances setAppliedLSN + setFlushedLSN individually. Batched ack (advance once per N messages, with a `setFlushedLSN(maxLSN)` periodically) would reduce PG ack traffic but is not implemented. Cost is bounded by per-message latency; under high alert rates this could add measurable PG round-trip overhead. — evidence: NotificationSubscriber.java:83-84 — severity: LOW",
    "**Polling instead of event-driven** — 10 ms sleep on empty buffer means ~5 ms median added latency per alert under low load. The PG JDBC driver supports `read()` (blocking) as well as `readPending()` (non-blocking); the platform chose the non-blocking pattern for shutdown ergonomics (see implicit_adrs.[7]). Trade-off: latency for cancellability. — evidence: NotificationSubscriber.java:68-72 — severity: LOW",
    "**10s retry cadence is hardcoded** — no operator knob. Under fast-flapping conditions the retry pattern is fixed; under slow-recovering conditions the operator cannot stretch the back-off. — evidence: NotificationSubscriber.java:96 — severity: LOW",
    "**Poison-message replay loop pins WAL position** — the un-advanced LSN on a persistently-failing process() call means PG WAL grows indefinitely. Under sustained poison-replay conditions, primary disk exhaustion is real. This is the F-009 pillar's load-bearing performance pathology and the single most consequential operator-facing risk in the subsystem. — evidence: NotificationSubscriber.java:77-91 + concepts.yaml:4580 (`poison-message-wal-replay-loop` invariant) — severity: HIGH",
    "**Slot growth is not surfaced as ODD telemetry** — operators must query `pg_replication_slots.confirmed_flush_lsn` / `pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)` to observe subscriber-induced WAL retention. No Prometheus gauge, no actuator endpoint. — evidence: NotificationSubscriber.java:1-159 (no Micrometer/Prometheus registry imports) — severity: MEDIUM"
  ]

## sources

- understanding ← odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriber.java:1-159 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/NotificationSubscriberStarter.java:1-36 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/PGConnectionFactory.java:22-42 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/leaderelection/PostgreSQLLeaderElectionManagerImpl.java:17-29 + WebFetched live doc (verified 2026-05-20 status 200)
- concepts.entities.NotificationSubscriber ← NotificationSubscriber.java:27-37 (class declaration + injected fields)
- concepts.entities.WalProperties ← NotificationSubscriber.java:32 + NotificationsProperties.java:13-18
- concepts.entities.PostgreSQLLeaderElectionManager ← NotificationSubscriber.java:34 + PostgreSQLLeaderElectionManager.java:6-18
- concepts.entities.PostgresWALMessageDecoder ← NotificationSubscriber.java:35 + PostgresWALMessageDecoder.java:1-236
- concepts.entities.PostgresWALMessageProcessor ← NotificationSubscriber.java:36 + processor/PostgresWALMessageProcessor.java:5-7
- concepts.entities.PGConnection-PGReplicationStream ← NotificationSubscriber.java:48,53-60
- concepts.entities.Tables.ALERT ← NotificationSubscriber.java:51
- concepts.entities.NotificationSubscriberException ← NotificationSubscriber.java:89,99 + notification/exception/NotificationSubscriberException.java:1-15
- concepts.invariants.single-subscriber ← NotificationSubscriber.java:47 (acquire) + PostgreSQLLeaderElectionManagerImpl.java:22 (`pg_advisory_lock`)
- concepts.invariants.pgoutput-hardcoded ← NotificationSubscriber.java:30,119
- concepts.invariants.only-alert-table-published ← NotificationSubscriber.java:51
- concepts.invariants.lazy-create-no-drop ← NotificationSubscriber.java:104-126,128-158 + WebFetched live doc verbatim 'ODD Platform doesn't clean up replication slot it has created.'
- concepts.invariants.lsn-advance-after-process ← NotificationSubscriber.java:77-84 (the statement order)
- concepts.invariants.applied-flushed-coupled ← NotificationSubscriber.java:83-84
- concepts.invariants.empty-readpending-10ms-sleep ← NotificationSubscriber.java:68-72
- concepts.invariants.10s-outer-retry ← NotificationSubscriber.java:94-100
- concepts.invariants.two-checkpoint-interrupt ← NotificationSubscriber.java:46,62
- concepts.invariants.relation-msg-decoded-not-processed ← NotificationSubscriber.java:79 + PostgresWALMessageDecoder.java:46-47
- concepts.invariants.truncate-etc-silently-dropped ← PostgresWALMessageDecoder.java:52-53
- dependencies_semantic.requires-feature.notifications-enabled ← NotificationSubscriberStarter.java:17 (`@ConditionalOnNotifications`) + NotificationsFeatureCondition.java:11-13
- dependencies_semantic.requires-feature.alert-table-rows ← NotificationSubscriber.java:51 (publication target)
- dependencies_semantic.requires-config — all three keys ← NotificationSubscriber.java:43,47,57,109,118,136,151 (every walProperties.* invocation site)
- dependencies_semantic.requires-runtime.pg-config ← WebFetched live doc (verified 2026-05-20, status 200, `configuration-and-deployment/odd-platform`)
- dependencies_semantic.requires-runtime.replication-role ← WebFetched live doc + PGConnectionFactory.java:30-32 (replication-mode connection)
- dependencies_semantic.requires-runtime.pgoutput ← NotificationSubscriber.java:30,119
- dependencies_semantic.requires-runtime.pgconnectionfactory ← PGConnectionFactory.java:22-42 + NotificationSubscriber.java:48
- dependencies_semantic.requires-runtime.leaderelection ← PostgreSQLLeaderElectionManagerImpl.java:14-29 + NotificationSubscriber.java:47
- tests_coverage_semantic.test_files ← `find <odd-platform-repo> -path '*notification*' -name '*Test*.java'` returns zero matches (verified via Glob)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verified 2026-05-20, status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/notifications (verified 2026-05-20, status 200)
- docs_link_semantic.doc_drift_findings[0] (max_wal_senders=1 absolute vs minimum) ← WebFetched live doc verbatim
- docs_link_semantic.doc_drift_findings[1] (HA failover narrative gap) ← live-doc absence + NotificationSubscriber.java:90-100
- docs_link_semantic.doc_drift_findings[2] (at-least-once / poison-replay narrative gap) ← live-doc agent-noted absence + NotificationSubscriber.java:77-91 + concepts.yaml:4580
- docs_link_semantic.doc_drift_findings[3] (DOC-GAP-230 cross-link) ← lineage/odd-platform/doc-gaps/detail/DOC-GAP-230.md
- implicit_adrs.[0] (pgoutput hardcoded) ← NotificationSubscriber.java:30,119
- implicit_adrs.[1] (lazy-create-no-drop) ← NotificationSubscriber.java:104-126,128-158 + WebFetched live doc
- implicit_adrs.[2] (leader-elected single-writer) ← NotificationSubscriber.java:47 + PostgreSQLLeaderElectionManagerImpl.java:22
- implicit_adrs.[3] (at-least-once via LSN-advance-after-process) ← NotificationSubscriber.java:77-84
- implicit_adrs.[4] (setAppliedLSN+setFlushedLSN coupled) ← NotificationSubscriber.java:83-84
- implicit_adrs.[5] (single-table publication) ← NotificationSubscriber.java:51
- implicit_adrs.[6] (polling not event-driven) ← NotificationSubscriber.java:68-72
- implicit_adrs.[7] (10s outer-loop retry) ← NotificationSubscriber.java:94-100
- bugs_limitations_corner_cases.[0] (poison-message WAL replay loop) ← NotificationSubscriber.java:77-91 + AlertNotificationMessageProcessor.java:23-24 + concepts.yaml:4580 (`poison-message-wal-replay-loop` invariant)
- bugs_limitations_corner_cases.[1] (single-table publication hardcoded) ← NotificationSubscriber.java:51 + PostgresWALMessageDecoder.java:96
- bugs_limitations_corner_cases.[2] (DDL injection surface on publication-name) ← NotificationSubscriber.java:144-152
- bugs_limitations_corner_cases.[3] (asymmetric parameterisation between probe + create) ← NotificationSubscriber.java:133-135 vs 151
- bugs_limitations_corner_cases.[4] (replication-slot orphan on rename) ← NotificationSubscriber.java:104-126 + WebFetched live doc
- bugs_limitations_corner_cases.[5] (setAppliedLSN advances on non-decoded message) ← NotificationSubscriber.java:77-84 + PostgresWALMessageDecoder.java:46-54
- bugs_limitations_corner_cases.[6] (outer catch absorbs all Exception subtypes) ← NotificationSubscriber.java:90-92
- bugs_limitations_corner_cases.[7] (NotificationSubscriberStarter has no thread-death detection) ← NotificationSubscriber.java:87-100 + NotificationSubscriberStarter.java:33-35
- bugs_limitations_corner_cases.[8] (outer retry sleep uncancellable / re-throw exits run()) ← NotificationSubscriber.java:95-100
- bugs_limitations_corner_cases.[9] (no LSN telemetry) ← NotificationSubscriber.java:75 (DEBUG-only) + absence of Micrometer/Prometheus imports
- bugs_limitations_corner_cases.[10] (replication-slot probe TOCTOU race) ← NotificationSubscriber.java:106-122 + L90-92
- bugs_limitations_corner_cases.[11] (proto_version=1 locked) ← NotificationSubscriber.java:42
- bugs_limitations_corner_cases.[12] (replication connection opened per outer-loop iteration) ← NotificationSubscriber.java:46-92
- security.auth_mode_relevance ← NotificationSubscriber.java:1-159 (no HTTP surface) + NotificationSubscriberStarter.java:17
- security.ingestion_filter_relevance ← NotificationSubscriber.java:1-159 (no `/ingestion` references)
- security.owner_scoping ← NotificationSubscriber.java:80 (single processor.process call, no owner inspection)
- security.data_exposure.[0] (alert payload) ← NotificationSubscriber.java:80 + sibling AlertNotificationMessageProcessor.java:25-36 + sibling AlertNotificationMessageTranslator (re-cited from NotificationsProperties.md.security.data_exposure)
- security.data_exposure.[1] (PG credentials) ← PGConnectionFactory.java:27-32 + NotificationSubscriber.java:47
- security.data_exposure.[2] (log details) ← NotificationSubscriber.java:63,75,91
- security.known_security_gaps.[0] (publication-name SQL-injection) ← NotificationSubscriber.java:151
- security.known_security_gaps.[1] (slot-name driver-side-only validation) ← NotificationSubscriber.java:104-126
- security.known_security_gaps.[2] (broad replication role) ← WebFetched live doc + NotificationSubscriber.java:47
- security.known_security_gaps.[3] (no audit trail) ← NotificationSubscriber.java:75,80,83-84
- security.known_security_gaps.[4] (no fan-out scoping) ← NotificationSubscriber.java:80 + AlertNotificationMessageProcessor.java:25-36
- performance.hot_paths.[0] (inner-loop poll) ← NotificationSubscriber.java:68-72
- performance.hot_paths.[1] (per-WAL message decode+process+ack) ← NotificationSubscriber.java:77-84 + sibling AlertNotificationMessageProcessor.java:25-36
- performance.hot_paths.[2] (LSN advance per-message) ← NotificationSubscriber.java:83-84
- performance.throughput_characteristics.single-thread ← NotificationSubscriber.java:47 + NotificationSubscriberStarter.java:21-22
- performance.throughput_characteristics.no-batching ← NotificationSubscriber.java:77-84
- performance.resource_allocation.connection-per-outer-iter ← NotificationSubscriber.java:47 + PGConnectionFactory.java:36
- performance.resource_allocation.stream-and-socket ← NotificationSubscriber.java:60-86
- performance.resource_allocation.decoder-cache ← PostgresWALMessageDecoder.java:34
- performance.resource_allocation.wal-retention ← NotificationSubscriber.java:83-84 + WebFetched live doc
- performance.scaling_characteristics.advisory-lock-bottleneck ← NotificationSubscriber.java:47
- performance.scaling_characteristics.failover-bounded-by-lock-release ← NotificationSubscriber.java:46-92,94-100
- performance.known_performance_gaps.[0] (per-message LSN ack) ← NotificationSubscriber.java:83-84
- performance.known_performance_gaps.[1] (polling not event-driven) ← NotificationSubscriber.java:68-72
- performance.known_performance_gaps.[2] (10s retry hardcoded) ← NotificationSubscriber.java:96
- performance.known_performance_gaps.[3] (poison-message pins WAL) ← NotificationSubscriber.java:77-91 + concepts.yaml:4580
- performance.known_performance_gaps.[4] (no slot-growth telemetry) ← NotificationSubscriber.java:1-159 (absence of metrics imports)

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

(none — net-new sidecar for the F-009 PRIMARY SURFACE: the run-loop class
itself. Pairs with the existing batch-K NotificationsDispatcher sidecar
(AlertNotificationMessageProcessor — the dispatcher / hop-3) and the
batch-X NotificationConfiguration sidecar (bean-factory / hop-0) to close
the F-009 chain at hop-1 (this file — the WAL consumer + replication-slot
manager). Findings unique to THIS file vs the sibling sidecars: the
at-least-once delivery semantic primary source at lines 77-84 (LSN-advance
AFTER process); the pgoutput-hardcoded output-plugin choice (line 30);
the only-ALERT-table publication scope (line 51); the publication-name
DDL-injection surface (line 151); the 10s outer-loop retry cadence
hardcoded (line 96); the proto_version=1 lock-in (line 42); the
NotificationSubscriberStarter no-thread-death-detection pathology (the
single-thread executor + no Future-retention pattern is committed at the
combination of this file + the starter); the publication-probe-vs-create
asymmetric SQL-parameterisation (parameterised probe at L133, formatted
create at L151). Cross-references: poison-message-wal-replay-loop
invariant (concepts.yaml:4580); lazy-create-no-drop-replication-artefacts-operator-owns-cleanup
canonicalisation candidate; DOC-GAP-230 doc-side mirror; F-009 feature
flow with this file added as hop-1 evidence. LSN-018 pre-emit coherence
check applied: all live-doc claims WebFetched 2026-05-20 status 200; all
implicit_adrs gated by intent anchors (constants / SQL probe patterns /
statement order); gap-shaped observations correctly routed to
bugs_limitations_corner_cases not implicit_adrs.)
