## REFACTOR-508 — Poison-message WAL replay loop — persistently-bad ALERT row pins WAL position cluster-wide; no DLQ, no skip-poison API, no operator endpoint to advance LSN past a bad message

**Severity**: HIGH
**Category**: deferred-failure + missing-poison-message-handling + observability
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature LOAD-BEARING fragility), P-10-deployment-architecture (cluster-wide failure mode)]

**Surfaced by**:
- `NotificationSubscriber.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**Poison-message WAL replay loop** — the inner `messageProcessor.process(decodedMessage.get())` call at L80 is NOT wrapped in a try/catch. Any RuntimeException thrown by the processor (AlertNotificationMessageProcessor -> AlertNotificationMessageTranslator throws IllegalArgumentException on unknown alert-type code, IllegalStateException on missing/duplicate alerted-entity rows) propagates out of the inner while-true, is caught by the outer Exception handler at L90, the lock is released, the 10s sleep + re-acquire fires, the SAME un-advanced LSN re-delivers, the translator throws again, ad infinitum. A persistently-bad ALERT row blocks ALL subsequent WAL messages cluster-wide with no operator visibility beyond log inspection."
- `PostgresWALMessageProcessor.md:bugs_limitations_corner_cases.[1]` (HIGH) — "The interface does NOT declare any wider exception type than `InterruptedException`, but the implementor's translation step throws `IllegalArgumentException` (AlertNotificationMessageTranslator.java:87) and `IllegalStateException` (lines 94, 101, 184) — both undeclared at the seam. These unchecked exceptions bypass any caller-side `catch (NotificationSenderException)` clause and surface in `NotificationSubscriber.java:90 catch (Exception e)`, which logs + releases the lock + waits 10s + re-acquires + replays the SAME LSN. A persistently-bad alert row (e.g. an alert pointing at a hard-deleted data_entity oddrn — the FK violation message at line 95 explicitly admits the case as 'despite the foreign key constraint') becomes a poison-message that blocks the WAL stream for every subsequent alert."

**Statement**: A single persistently-failing alert row pins ODD's WAL replication slot at that LSN, blocking ALL subsequent alert notifications cluster-wide with no operator-visible signal beyond log inspection. The trigger conditions:

1. Inside `NotificationSubscriber.run()`'s inner loop (lines 77-84):
```java
final Optional<DecodedWALMessage> decodedMessage = messageDecoder.decode(buffer);
if (decodedMessage.isPresent()) {
    messageProcessor.process(decodedMessage.get());  // <-- NOT wrapped in try/catch
}
stream.setAppliedLSN(stream.getLastReceiveLSN());    // <-- only reached on normal return
stream.setFlushedLSN(stream.getLastReceiveLSN());
```

2. `AlertNotificationMessageTranslator` throws unchecked exceptions on bad data:
   - `IllegalArgumentException` at line 87 (unknown alert-type code)
   - `IllegalStateException` at line 94 (missing alerted-entity row — "despite the foreign key constraint")
   - `IllegalStateException` at line 101 (duplicate alerted-entity rows)
   - `IllegalStateException` at line 184 (missing data-entity referenced by alert)

3. These exceptions propagate to the outer `catch (Exception e)` at NotificationSubscriber.java:90, which:
   - Logs `Error occurred while subscribing` at ERROR level (no error-class taxonomy)
   - Releases the leader-lock via try-with-resources on the Connection
   - Sleeps 10 seconds (`TimeUnit.SECONDS.sleep(10L)` at L96)
   - Re-acquires the lock + rebuilds the stream
   - The SAME un-advanced LSN re-delivers the SAME bad message
   - The translator throws the SAME exception
   - Loop forever

**Operational consequences**:
- **PG WAL accumulates indefinitely** — the un-advanced `confirmed_flush_lsn` on the replication slot means PG retains all WAL since the bad message. Primary disk exhaustion is real under sustained poison-replay.
- **All subsequent alerts are blocked** — even valid alerts inserted AFTER the bad one cannot be processed; they queue in the WAL behind the poison message.
- **No operator-visible signal** — `log.error("Error occurred while subscribing", e)` is the only telemetry; no Prometheus counter, no actuator endpoint, no metric. Operators discover the failure only when an alert they expected never delivers OR when PG monitoring catches the slot's WAL retention.
- **Only operator remediations**:
   - (a) Identify and DELETE the bad ALERT row from PG (requires DB access + diagnostic skill).
   - (b) `pg_drop_replication_slot('<slot_name>')` — loses ALL in-flight undelivered alerts (the slot's WAL retention is discarded).
   - There is NO DLQ, no skip-poison API, no `advance-lsn-past-bad-message` operator endpoint.

**Evidence**:
- `NotificationSubscriber.java:77-91` — the inner loop's no-try/catch + LSN-advance-after-process pattern
- `NotificationSubscriber.java:90-100` — outer catch + 10s retry
- `AlertNotificationMessageTranslator.java:87, 94, 101, 184` — the four unchecked-exception throw sites
- `PostgresWALMessageProcessor.java:6` — the seam's `void process(...) throws InterruptedException` shape that enables undeclared-RuntimeException bypass
- concepts.yaml entry `poison-message-wal-replay-loop` (the canonical concept-level invariant; line 4580)
- `NotificationsDispatcher.md:bugs_limitations_corner_cases.[6]` (sibling sidecar)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-180 NEW batch Y codifies the at-least-once-via-LSN-after-process stance — this scope is the load-bearing CONSEQUENCE of that ADR's design choice; cross-link is explicit.
- ADR-CANDIDATE-182 NEW batch Y codifies the narrow SPI seam — this scope is the structural enabler (void return + undeclared exceptions); cross-link is explicit.
- ADR-CANDIDATE-178 NEW batch Y codifies the ALERT-only publication — the scope's BLAST RADIUS is bounded to alerts (which is good — if owner-lifecycle were on the same pipeline, the poison-loop would block ownership events too).

**Proposed remedy**:

1. **Path A (minimal-change DLQ)** — Wrap the `process(...)` call in a try/catch at `NotificationSubscriber.java:80`. On RuntimeException: log at ERROR with the message body + LSN, advance LSN past the bad message (acknowledge as "delivered but failed"), continue the loop. Operationally equivalent to at-most-once for poison messages. Adds an `alert.poisonMessageReason` text column to the ALERT table for diagnostic forensic.

2. **Path B (extend the SPI)** — Add a return type to `PostgresWALMessageProcessor.process(...)`: `enum ProcessResult { OK, POISON_SKIP, RETRY_LATER }`. Caller (`NotificationSubscriber`) branches on the result: OK -> advance LSN; POISON_SKIP -> advance LSN + log; RETRY_LATER -> do NOT advance LSN (current behaviour). Structural change to the SPI per ADR-CANDIDATE-182.

3. **Path C (operator-driven LSN-advance API)** — Expose a Spring Actuator endpoint or a REST controller method `POST /api/notifications/advance-lsn` that drops + recreates the replication slot at a specified LSN. Operator-driven remediation without losing all in-flight alerts.

4. **Path D (observability-first, minimum risk)** — Add a Prometheus gauge `notifications_wal_consecutive_failures_total` that increments on every outer-catch entry. Add a structured error log line with `error_class` (IllegalArgumentException / IllegalStateException / SQLException / other). Operators can alert on consecutive failures > N. Does not fix the poison-replay but makes it observable.

Path D is the LOW-RISK minimum (observability) — should be done regardless. Path A is the SHIP-FAST fix (per the maintainer's velocity-bias). Path B is the architecturally-cleanest. Path C is the operator-control-plane.

**Severity rationale**: HIGH — the LOAD-BEARING fragility of the F-009 pillar; a single bad ALERT row blocks all alerts cluster-wide; combined with disk-exhaustion via WAL retention, this can take down the PG primary in extreme cases; cross-references ADR-CANDIDATE-180/182/178 (all batch Y) — the structural reasons this scope exists.

**Suggested backlog grouping**: `Notifications hardening sprint` — covers REFACTOR-508 + REFACTOR-509 (WAL retention) + REFACTOR-518 (no retry/DLQ/audit) + REFACTOR-519 (subscriber thread-death) — together address the F-009 pillar's operational fragility.

---
