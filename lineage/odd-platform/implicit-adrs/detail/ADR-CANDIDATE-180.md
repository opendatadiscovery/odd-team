## ADR-CANDIDATE-180 — At-least-once notification delivery via LSN-advance-AFTER-successful-process — poison-message replay loop accepted as the design cost; setAppliedLSN and setFlushedLSN advance together

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate at-least-once stance over at-most-once)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature delivery semantics), P-10-deployment-architecture (failure-mode behaviour)]
**Support count**: 1 sidecar primary source (batch Y NotificationSubscriber) + cross-batch corroboration (system-mission.md canonicalisation candidate `notification-delivery-semantics-at-least-once-via-replay`)
**Axes present**: notification
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `NotificationSubscriber.md:implicit_adrs.[3]` (HIGH) — "**At-least-once delivery via LSN-advance-AFTER-process** — the order of operations inside the inner loop is (a) decode, (b) call `process(...)` synchronously, (c) advance both setAppliedLSN AND setFlushedLSN to the just-received LSN. The decision encodes 'a successfully-delivered alert advances the WAL pointer; an unsuccessful one does NOT, so the next subscriber-restart re-delivers' — at-least-once semantics. The platform deliberately accepts the duplicate-delivery risk to avoid the alternative (advance-before-process -> loss-on-crash) which would violate operator expectations for an alerting system." — intent_anchor: "the literal statement order: `final Optional<DecodedWALMessage> decodedMessage = messageDecoder.decode(buffer); if (decodedMessage.isPresent()) { messageProcessor.process(decodedMessage.get()); } stream.setAppliedLSN(stream.getLastReceiveLSN()); stream.setFlushedLSN(stream.getLastReceiveLSN());`" (NotificationSubscriber.java:77-84)
- `NotificationSubscriber.md:implicit_adrs.[4]` (MEDIUM) — "**setAppliedLSN and setFlushedLSN advance together to the same `getLastReceiveLSN()`** — the platform does not distinguish 'consumer has applied this message' from 'consumer has durably acknowledged this message back to Postgres for WAL release'. Both advance in lock-step." — intent_anchor: `stream.setAppliedLSN(stream.getLastReceiveLSN()); stream.setFlushedLSN(stream.getLastReceiveLSN());` (NotificationSubscriber.java:83-84)

**Decision statement**: ODD Platform's Notifications subsystem delivers alerts with **at-least-once** semantics via the literal statement order in `NotificationSubscriber`'s inner loop:

1. `messageDecoder.decode(buffer)` returns `Optional<DecodedWALMessage>`
2. If present: `messageProcessor.process(decodedMessage.get())` runs synchronously
3. `stream.setAppliedLSN(stream.getLastReceiveLSN())` advances the consumer-applied horizon
4. `stream.setFlushedLSN(stream.getLastReceiveLSN())` advances the durable-flushed horizon to the SAME value

Step (2) is NOT wrapped in a try/catch. If `process(...)` throws ANY exception (declared `InterruptedException` OR undeclared `RuntimeException` per `PostgresWALMessageProcessor` SPI — see ADR-CANDIDATE-182), the LSN advance at steps 3-4 NEVER happens. The exception propagates to the outer-loop `catch (final Exception e)` at line 90, the lock-holding Connection is released via try-with-resources, the 10s back-off fires, and on re-acquisition the SAME un-advanced LSN is re-delivered.

The architectural commitments:
- **(a) At-least-once over at-most-once.** The alternative (advance LSN before process) would produce at-most-once semantics — a crash between LSN-advance and `process(...)` returning successfully would lose the alert. The maintainer deliberately chose at-least-once on the basis that "alerting system loses an alert" is operationally worse than "alerting system delivers duplicate alerts." Cross-channel duplicate suppression is the operator's responsibility (Slack-side deduplication is best-effort; email recipients see two emails; webhook receivers should be idempotent or accept duplicates).
- **(b) Applied and flushed advance together.** ODD does NOT distinguish "consumer has applied this message" from "consumer has durably acknowledged this message back to Postgres for WAL release." Both `setAppliedLSN` and `setFlushedLSN` advance to the SAME `getLastReceiveLSN()` value in the same statement pair. This avoids the operational complexity of tracking two separate horizons; the trade-off is that Postgres cannot retain WAL ahead of the consumer's processing horizon for redundancy purposes.
- **(c) Poison-message replay loop is the accepted cost.** A persistently-failing `process(...)` call (e.g. an ALERT row pointing at a hard-deleted data_entity — the FK violation is documented in `AlertNotificationMessageTranslator.java:95` as "despite the foreign key constraint") pins the WAL position at the bad message indefinitely. PG retains all WAL since the bad message, the subscriber retries every 10s, every retry throws the same exception, and the WAL slot accumulates disk usage on the PG primary. The only remediations are operator-side: clean up the bad row, or `pg_drop_replication_slot(...)` (which loses ALL in-flight undelivered alerts). The platform offers no DLQ, no skip-poison API, no operator endpoint to advance LSN past a bad message.
- **(d) Empty `Optional` (non-INSERT/UPDATE WAL messages) STILL advances LSN.** TRUNCATE / DELETE / BEGIN / COMMIT / RELATION / TYPE / ORIGIN / LOGICAL_DECODING_MESSAGE message types return `Optional.empty()` from the decoder. The LSN advance at lines 83-84 happens unconditionally (outside the `if (decodedMessage.isPresent())` block). This prevents un-decodable-message accumulation on the slot but means non-INSERT/UPDATE events on the ALERT table (e.g. an operator's manual TRUNCATE) advance past silently with no notification fired.
- **(e) Synchronous within the subscriber thread.** `process(...)` is invoked synchronously; the SAME thread that decoded the WAL message issues the LSN advance. There is no async dispatcher, no per-message Future, no thread pool. The single-thread subscriber is the structural reason this works.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments to the design:
   - The literal statement order (decode -> process -> setAppliedLSN -> setFlushedLSN) at NotificationSubscriber.java:77-84. The decision is encoded in code flow; reversing the order would silently flip semantics.
   - The ABSENCE of any try/catch around the `process(...)` call. The maintainer deliberately did NOT wrap the per-message processing in a "log-and-continue" handler — this would have produced at-most-once + lost-alerts semantics.
   - The setAppliedLSN/setFlushedLSN coupling — both advance to `getLastReceiveLSN()` in adjacent statements at lines 83-84. The maintainer did NOT split the two horizons (e.g. flush once per N messages while applying per message) which would have allowed batched-ack optimisation.
2. **Structural impact?** YES — every operator's expectation of "alert delivery guarantees" is defined by this; every channel-side deduplication strategy must be built on this assumption; every future "add retry / DLQ / skip-poison" feature must work AROUND this stance (not against it).
3. **Refactoring or structural?** STRUCTURAL — moving to exactly-once would require a 2PC-style commit between the dispatcher and PG, which PG's logical replication does NOT support. Moving to at-most-once would require swapping the statement order. Neither is a small refactor.

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-182 (single-implementor narrow SPI seam — the `void` return + undeclared-exception-bypass shape of the SPI is the structural enabler of the poison-replay-loop) and ADR-CANDIDATE-178 (WAL pipeline scope — ALERT-only publication is what bounds the poison-replay surface).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-508 NEW batch Y (poison-message WAL replay loop — the LOAD-BEARING gap this ADR's stance produces; HIGH; cross-link to the `poison-message-wal-replay-loop` invariant in concepts.yaml)
- REFACTOR-509 NEW batch Y (WAL retention disk-exhaustion via slot orphan/rename — the cluster-wide consequence of a pinned slot LSN)
- REFACTOR-518 NEW batch Y (no retry/DLQ/audit on failed delivery — the absence of a remediation path)
- REFACTOR-529 NEW batch Y (per-message LSN ack — no batching; cost is bounded by per-message latency)

**Proposed action**: Promote to `adrs/drafts/at-least-once-via-lsn-after-process.md` (new ADR). Document the literal statement order + the four trade-offs (at-least-once vs at-most-once / coupled horizons / poison-replay accepted / synchronous-thread coupling). Cross-link with ADR-CANDIDATE-182 (SPI shape enables this). Live-doc side: the `features/active-platform-features/notifications` page is SILENT on delivery semantics — DOC-GAP-230 already tracks this; the ADR is the canonical source that page should reference once promoted.

**Severity rationale**: HIGH — defines the platform's notification delivery guarantee (operators with regulatory audit requirements + downstream incident-management systems care about this distinction); defines the operational failure mode (poison-replay-loop disk-exhaustion is the F-009 pillar's load-bearing fragility); structural for every future notification reliability question.

---
