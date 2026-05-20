## ADR-CANDIDATE-098 — Per-channel catch-and-continue fan-out — `AlertNotificationMessageProcessor` catches `NotificationSenderException` per-sender, logs at ERROR with the receiver id, and proceeds to the NEXT sender for the SAME message; "one bad channel does not block the others" delivery stance

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-07-active-platform-features]
**Support**: surfaced by 1 sidecar (`NotificationsDispatcher` / `AlertNotificationMessageProcessor`) — primary-source, doc-confirmed by live `/features/active-platform-features/notifications` page; structural delivery-architecture decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:implicit_adrs.[0]` (HIGH confidence) — "Per-channel catch-and-continue fan-out — encodes a 'one bad channel does not block the others' stance — Slack outage does not stop email delivery."

**Decision statement**: The notification dispatcher fans out a decoded WAL `ALERT` event to every configured `NotificationSender` (Slack / Webhook / Email) via a synchronous `for` loop. Each sender call is wrapped in a per-sender `try { send } catch (NotificationSenderException e) { log.error(...); }` block (`AlertNotificationMessageProcessor.java:29-35`); a channel-specific failure is observed via ERROR-log only, and the loop continues to the next sender for the SAME message. The dispatcher does NOT short-circuit on first error, does NOT roll back upstream-published rows, does NOT block downstream WAL-LSN advancement, and does NOT route per-sender retries. The architectural posture: deliver to as many channels as possible per event; failures of individual channels are channel-local concerns that operators absorb at the channel-side (e.g. by subscribing both Slack + email so a Slack outage is covered by email). This is consistent with the live doc's verbatim "an alert dispatched to multiple channels is delivered to every channel that is enabled" — the dispatcher's behaviour is the runtime that backs that claim.

**Wisdom test**: PASS. (1) Deliberate (the try/catch is per-sender, not loop-wide; the catch type is the checked `NotificationSenderException` specifically, narrowing the silence to delivery failures only); (2) Structural impact (every future channel addition inherits this stance — Slack/Webhook/Email all follow the same pattern via `AbstractNotificationSender.send()` throwing `NotificationSenderException` on 2xx-mismatch); (3) Adding the absent "retry"/"DLQ"/"audit" pieces would be REFACTORING within the existing structure (not changing the dispatcher's overall shape) — but the catch-and-continue framing itself is a STRUCTURAL CHOICE the maintainer made deliberately.

**Evidence**:
- NotificationsDispatcher.md says: "`try { notificationSender.send(notificationMessage); } catch (final NotificationSenderException e) { log.error(String.format(\"Error occurred while sending notification via %s\", notificationSender.receiverId()), e); }`" (AlertNotificationMessageProcessor.java:29-35)
- Doc-side confirmation (WebFetched 2026-05-19 status 200): "An alert dispatched to multiple channels is delivered to every channel that is enabled." (live notifications page)
- Asymmetric-exception finding (refactoring scope, NOT this ADR): `EmailNotificationSender.java:58-60` wraps MessagingException as raw `RuntimeException`, BYPASSING this catch — that's an implementation bug (REFACTOR-249 NEW), not part of this ADR's architectural posture.

**Existing ADR**: none. Composes with **ADR-CANDIDATE-040** (Notifications subsystem disabled-by-default) as the runtime side of the same Notifications-subsystem decision: ADR-CANDIDATE-040 declares "shipped off"; this ADR declares "when on, fail-soft per channel." Composes with **ADR-CANDIDATE-041** (per-channel URL-presence activation) as the activation side of the dispatch chain. Composes with **ADR-CANDIDATE-100** (NEW — translate-before-fan-out atomic; fail-loud on data-integrity, fail-soft on delivery) — together they form the dispatcher's delivery posture: data-integrity is loud, delivery is soft.

**Cross-link gaps** (refactoring-scopes anchored on the structure this ADR endorses):
- REFACTOR-249 NEW — EmailNotificationSender wraps MessagingException as raw RuntimeException, BYPASSING this catch — the asymmetric-exception bug breaks the ADR's promise for the email channel.
- REFACTOR-251 NEW — no retry / no DLQ / no audit (the catch-and-continue stance does NOT defend the absence of any delivery audit at all).
- REFACTOR-127 (batch C) — no retry / DLQ / audit-trail on failed delivery (HIGH; cross-batch overlap).
- REFACTOR-253 NEW — no per-channel filter (the catch-and-continue stance does NOT defend the absence of routing logic).

**Proposed action**: Promote to `adrs/drafts/notifications-per-channel-catch-and-continue.md` (new ADR). Document the delivery posture explicitly — "one bad channel does not block the others" with the operational consequences enumerated (Slack outage doesn't stop email; email RuntimeException-asymmetry is a defect the ADR does NOT defend; no retry / no DLQ / no audit is the price). Cross-link with ADR-CANDIDATE-040 (subsystem disabled-by-default) and ADR-CANDIDATE-041 (per-channel URL-presence activation) as the Notifications-subsystem family. Cross-link with REFACTOR-249 (RuntimeException-asymmetry) which the ADR's "catch-and-continue" stance does NOT cover and which should be fixed at the email sender, not by widening the dispatcher's catch.

**Severity rationale**: HIGH — load-bearing delivery-architecture decision; affects every operator-visible alert-notification behaviour; the alternative (loop-wide try/catch, halt-on-first-error) would change the operational characteristics of the Notifications subsystem entirely. The maintainer chose this stance deliberately (per the catch's narrow type AND the per-sender scope); a future change to halt-on-first-error would require maintainer attention.

---
