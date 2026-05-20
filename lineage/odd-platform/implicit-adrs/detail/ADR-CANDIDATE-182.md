## ADR-CANDIDATE-182 — Notifications WAL bridge is a single-implementor narrow SPI seam — `PostgresWALMessageProcessor` declares only `process(DecodedWALMessage)`; cooperative-shutdown via InterruptedException only; void return + undeclared wider exception surface is the structural enabler of poison-message replay

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate narrow-SPI design)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature), P-10-deployment-architecture (subsystem extensibility)]
**Support count**: 1 sidecar primary source (batch Y PostgresWALMessageProcessor) + cross-batch corroboration via single-implementor grep (verified at sidecar level — exactly 1 match `implements PostgresWALMessageProcessor` returning `AlertNotificationMessageProcessor.java:18`)
**Axes present**: notification.processor (java-interface-spi-seam)
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `PostgresWALMessageProcessor.md:implicit_adrs.[0]` (HIGH) — "Single-implementor narrow SPI seam — `PostgresWALMessageProcessor` declares only `process(DecodedWALMessage)`; the alert-table coupling is encoded in the upstream caller (`NotificationSubscriber.registerPublication(connection, Tables.ALERT)`) rather than in the interface signature. This choice prefers a simple single-stream / single-handler shape over a multi-handler dispatcher (`Map<RelationId, Processor>`) — and the choice is committed by the `final` field declaration at `NotificationSubscriber.java:36 private final PostgresWALMessageProcessor messageProcessor`." — intent_anchor: `private final PostgresWALMessageProcessor messageProcessor;` (NotificationSubscriber.java:36) + `registerPublication(connection, Tables.ALERT);` (NotificationSubscriber.java:51)
- `PostgresWALMessageProcessor.md:implicit_adrs.[1]` (HIGH) — "Cooperative-shutdown via InterruptedException only — the SOLE declared throws clause is `InterruptedException` (PostgresWALMessageProcessor.java:6). This frames the seam as a thread-cooperation contract (subscriber is a `Thread` extending `extends Thread` at NotificationSubscriber.java:29 — explicit Thread subclassing, not a Runnable). The implementor's wider exception surface (any RuntimeException) is intentionally UNDECLARED at the seam — letting the subscriber's outer catch block decide LSN advancement / lock release / 10s back-off." — intent_anchor: `void process(final DecodedWALMessage message) throws InterruptedException;` (PostgresWALMessageProcessor.java:6) + `catch (final InterruptedException e) { Thread.currentThread().interrupt(); throw new NotificationSubscriberException(e); }` (NotificationSubscriber.java:87-89)

**Decision statement**: ODD's Notifications WAL pipeline crosses through a deliberately-narrow SPI interface — `PostgresWALMessageProcessor` — declared in 7 lines of code at `odd-platform-api/src/main/java/.../notification/processor/PostgresWALMessageProcessor.java`. The interface declares exactly ONE method:

```java
void process(final DecodedWALMessage message) throws InterruptedException;
```

The SPI shape encodes FIVE structural commitments:

1. **`void` return** — no per-message LSN-acknowledgement guidance, no partial-failure signal, no "this-LSN-is-poison-skip-it" channel. The caller (NotificationSubscriber) advances `setAppliedLSN` + `setFlushedLSN` unconditionally after normal return (per ADR-CANDIDATE-180). The dispatcher cannot tell the subscriber "I delivered to Slack but failed Webhook — please replay just the Webhook part" — there is no shape for that conversation.

2. **`InterruptedException` is the ONLY declared throws clause** — the seam is framed as a thread-cooperation contract. The subscriber thread (`NotificationSubscriber extends Thread` at line 29) propagates `InterruptedException` upward via L87-89 + re-interrupts itself. This is the canonical cooperative-shutdown pattern. The implementor's WIDER exception surface (`IllegalArgumentException` and `IllegalStateException` from `AlertNotificationMessageTranslator.java:87, 94, 101`) is INTENTIONALLY UNDECLARED — letting these RuntimeExceptions propagate to the outer `catch (Exception e)` at NotificationSubscriber.java:90, which logs + releases the lock + waits 10s + re-acquires + replays the SAME LSN.

3. **`DecodedWALMessage` is hard-coded as the input type** — the seam is NOT generic over event types. There is no `process(WALMessage<T>)` parameterised shape; no `process(T message)` with type erasure. The interface is alert-table-specific because `NotificationSubscriber` only publishes the ALERT table (per ADR-CANDIDATE-178). The two commitments are deeply paired: the SPI cannot widen the input type because the WAL pipeline cannot widen the published-table set.

4. **Single-implementor invariant** — verified at sidecar level via `grep 'implements PostgresWALMessageProcessor'` returning exactly 1 match (`AlertNotificationMessageProcessor.java:18`). The invariant is committed by the `private final PostgresWALMessageProcessor messageProcessor;` field declaration at `NotificationSubscriber.java:36` — a single-bean field, not a `Map<String, PostgresWALMessageProcessor>` or `List<PostgresWALMessageProcessor>`. Spring's bean-resolution by-type at construction is the structural enforcement.

5. **No default methods, no JavaDoc, no comment** — the interface body is the contract. The maintainer chose NOT to use default-method evolution (which would have allowed adding new callbacks like `onPoisonMessage(LSN)` without breaking implementors) and NOT to document the contract via JavaDoc (which would have surfaced the void-return / undeclared-exception trade-offs to implementors).

The architectural commitments:
- **(a) Simplicity over extensibility.** The single-implementor / single-input-type SPI is the simplest possible bridge shape. The maintainer chose this over a per-relation-id dispatcher (which would handle multiple WAL streams) or a per-event-type processor (which would handle non-ALERT events). Extending the subsystem requires structural changes, not interface extension.
- **(b) The OUTER catch block decides LSN policy.** The undeclared-wider-exception-surface at the SPI is what enables the LSN-advance-after-process invariant of ADR-CANDIDATE-180. A wider declared throws clause (e.g. `throws InterruptedException, NotificationSenderException`) would force the subscriber to explicitly handle each declared type at the call site — losing the "any exception means no LSN advance" simplicity.
- **(c) Poison-message replay is structurally enabled, not implemented.** The void return + undeclared exception bypass mean the implementor CANNOT signal "this message is poison — skip it." The structural enablement of the replay loop is encoded at the SPI shape, before any implementor is written. To add poison-skip semantics requires changing the interface signature (a breaking change to a SPI typically reserved for major-version transitions).
- **(d) Audit-event emission is STRUCTURALLY BLOCKED.** The SPI has no per-message correlation-id, no LSN parameter, no audit-context. An implementor wanting to emit "platform sent alert X to channels [Y, Z]" has no anchor — the LSN is known only to the caller (`NotificationSubscriber.java:75 log.debug` at DEBUG level). This composes with ADR-CANDIDATE-146 / F-006 (ENUM-ROOTED audit-silence) — the `ActivityEventTypeDto` enum has no `NOTIFICATION_*` constants because the SPI offers no structural surface to emit them at.
- **(e) Channel-aware payload shaping is STRUCTURALLY BLOCKED.** `DecodedWALMessage` is the universal input; the implementor's translation runs ONCE and the same `AlertNotificationMessage` payload reaches all channels. A Slack-redacted-vs-full-Webhook payload split would require either (a) per-channel translation hooks at the SPI (would require interface change) or (b) per-channel `NotificationSender` impls with their own filter logic (which exists but is uniformly bypassed by the current senders).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - The 7-line interface body — the file literally contains nothing but the method signature; no overload, no default method, no field. The maintainer chose minimalism.
   - The `extends Thread` (NotificationSubscriber.java:29) NOT `implements Runnable` — the explicit Thread-subclassing aligns with the `throws InterruptedException` declaration on the SPI; the maintainer chose a thread-cooperation framing.
   - The `private final` field at `NotificationSubscriber.java:36` — the field type is the interface (single-bean injection), not a collection — the single-implementor design is committed at the consumer side.
2. **Structural impact?** YES — every future "add owner-lifecycle notifications" or "add data-source-mutation notifications" requirement requires either (a) extending the SPI to dispatch by relation-id (changes the interface signature) or (b) creating a parallel subscriber + parallel publication + parallel slot + parallel advisory-lock-id (the multi-subscriber-per-feature pattern). Neither is incremental.
3. **Refactoring or structural?** STRUCTURAL — widening the SPI input type breaks every implementor; adding a per-channel-result return type breaks the void-return invariant; adding correlation-id parameter changes every caller. All structural changes.

**Existing ADR**: none in `adrs/`. Composes deeply with ADR-CANDIDATE-178 (ALERT-only publication — what the SPI input type is bound to), ADR-CANDIDATE-179 (single-thread leader — the only caller of this SPI), ADR-CANDIDATE-180 (at-least-once via LSN-after-process — enabled by the SPI's void return + undeclared exceptions), ADR-CANDIDATE-146 (ENUM-ROOTED audit-silence — the SPI's no-correlation-id is the structural enabler of audit silence at the notification-delivery surface).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-508 NEW batch Y (poison-message WAL replay loop — the SPI's `void` + undeclared exceptions enable this)
- REFACTOR-518 NEW batch Y (no retry/DLQ/audit on failed delivery — the SPI offers no shape to express any of these)
- REFACTOR-520 NEW batch Y (no NOTIFICATION_* constants in ActivityEventTypeDto — STRENGTHENS F-006 ENUM-ROOTED audit-silence; the SPI is the structural reason the enum has no notification constants)
- REFACTOR-532 NEW batch Y (no fan-out scoping by data-entity owner — the SPI input type carries owners[] but cannot express owner-aware routing)

**Proposed action**: Promote to `adrs/drafts/notifications-wal-bridge-narrow-spi.md` (new ADR). Document the five structural commitments + the dependency chain (this ADR enables ADRs 178, 180, 182 + structurally blocks ADR-146's audit-silence resolution). Cross-link with F-006 (the audit-silence drift) to make the ENUM-ROOTED + SPI-ROOTED reasoning explicit — the audit silence has TWO structural causes: the schema (per ADR-146) AND the bridge SPI (per this ADR).

**Severity rationale**: HIGH — defines the platform's notification subsystem extensibility (or lack thereof); defines the structural enabler of multiple downstream invariants (LSN-after-process / audit-silence / no-channel-aware-payload); load-bearing for every future change to the notification subsystem; cross-references the highest-leverage refactor (poison-message replay).

---
