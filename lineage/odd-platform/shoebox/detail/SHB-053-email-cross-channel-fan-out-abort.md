# SHB-053 — Email failure silently aborts cross-channel notification fan-out for the alert

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators who configure Slack + Webhook + Email channels expect "an alert dispatched to multiple channels is delivered to every channel that is enabled" (verbatim from the live notifications doc page). The IMPLEMENTATION violates that promise asymmetrically: when EMAIL is the failing channel (any of `MessagingException | TemplateException | IOException`), the `EmailNotificationSender` wraps the exception as a raw `RuntimeException` — bypassing the dispatcher's `catch (NotificationSenderException)` — which aborts the FAN-OUT LOOP for that alert and any subsequent channels (positioned AFTER email in the bean-injection order) NEVER receive `.send()`. Slack and Webhook fail correctly through the parent's `NotificationSenderException` and let the loop continue. The bean-iteration order of `List<NotificationSender>` is undefined (Spring class-scan order); whether the cross-channel abort manifests depends on whether email is registered last (visible only to email recipients) vs first (silently breaks every other channel).

## Evidence

- `odd-platform-api/src/main/java/.../notification/sender/EmailNotificationSender.java:58-60` — the `catch (MessagingException | TemplateException | IOException e) { throw new RuntimeException(...); }` block. The wrap-as-RuntimeException is the only exception path in `send()`.
- `odd-platform-api/src/main/java/.../notification/processor/AlertNotificationMessageProcessor.java:29-35` — dispatcher's per-sender catch is **typed**: `catch (final NotificationSenderException e) { log.error(...) }`. RuntimeException is NOT caught and propagates out of the dispatcher's `process()` method to `NotificationSubscriber.run()`'s outer catch.
- `odd-platform-api/src/main/java/.../notification/sender/SlackNotificationSender.java:48` + `WebhookNotificationSender.java:23` + `AbstractNotificationSender.java:16-30` — Slack + Webhook delegate to `sendAndValidate(...)` which converts both IOException AND non-200 status uniformly into `NotificationSenderException` (checked). They do NOT have the bypass.
- Live doc verbatim (`features/active-platform-features/notifications`, verified 2026-05-19 + 2026-05-20): "An alert dispatched to multiple channels is delivered to every channel that is enabled." — contradicted by email-channel failure path.
- `AlertNotificationMessageProcessor.java:19` — `private final List<NotificationSender<...>> notificationSenders;` — no `@Order`, no `Comparator`; injection order is class-scan-order-dependent → undefined.
- `NotificationsDispatcher` sidecar `bugs_limitations_corner_cases.[0]` (HIGH severity, REFACTOR-305) already catalogues this; WebhookNotificationSender sidecar `bugs_limitations_corner_cases.[9]` documents a LATENT extension via `JSONSerDeUtils.serializeJson`'s `JsonProcessingException → RuntimeException` wrap (`JSONSerDeUtils.java:62-64`), which is currently unreachable (AlertNotificationMessage is Jackson-clean) but structurally present.
- `NotificationSubscriber.java:80-91` — uncaught RuntimeException from `messageProcessor.process(...)` reaches the outer catch, the lock releases, 10s sleep, re-acquire — and the WAL LSN is NOT advanced (per L83-84 only runs after successful return), so the SAME message is replayed and the SAME abort recurs (poison-message loop).

## Notes

- This is an ENRICHER for **F-009 (WAL-driven Notification Delivery)**. F-009 already lists `exception_type_asymmetry_across_senders` as a drift facet; this thread elevates it from facet to first-class operator-observable feature because the consequence ("a misconfigured corporate SMTP relay silently breaks Slack + Webhook alerting too") is not enumerated as a feature — it is a behavioural CONSEQUENCE that operators cannot infer from the docs.
- Compound with poison-message replay: a deterministic email-side failure (TLS handshake to a permanently-unreachable SMTP, a Freemarker template-render bug) means the SAME alert tries to deliver forever, ALL channels stall forever, until the operator manually cleans the bad ALERT row OR runs `pg_drop_replication_slot('<name>')` (which loses all in-flight alerts cluster-wide).
- The fix is small and reversible: either (a) wrap email exceptions as `NotificationSenderException`, OR (b) widen the dispatcher's catch to `catch (Exception e)`. (a) is the safer choice because (b) hides legitimate programming-error bugs that should crash the JVM.
- The same RuntimeException-bypass class lives latent in webhook (via `JSONSerDeUtils.serializeJson`) and slack (via `IllegalArgumentException` in `serializePayload` + `NullPointerException` on null message). Two of three senders are "well-behaved by accident."
- The bean-order non-determinism makes this hard to reproduce: a refactor that renames a sender file or adds a new `@Component` somewhere in the package can flip whether email is first / middle / last, silently changing which OTHER channels lose their alerts.

## Next

1. **Probe**: enable all three channels, configure email with a deliberately-bad SMTP host (`mail.example.invalid:25`), POST an AlertManager payload, observe whether Slack + Webhook delivered the alert. Expected: depends on bean order (undefined).
2. **Graduate** as F-NNN — "Multi-channel notification fan-out contract drift". Pillar P-07. Add `exception_type_asymmetry` as a load-bearing concern, NOT a facet.
3. **REFACTOR-NNN** — wrap email exceptions as `NotificationSenderException` (one-line fix at `EmailNotificationSender.java:58-60`). Add an integration test pinning "one bad channel does not stop the others." Severity HIGH.
4. **DOC-NNN** — update `features/active-platform-features/notifications` to surface the asymmetric exception handling explicitly, with the workaround ("rotate the failing channel's config first; do not enable email without an outbound SMTP relay that's actually reachable").

## Links

- cluster_with: [F-009, SHB-054, SHB-055]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — into F-009 WAL-driven Notification Delivery. F-009's drift_class_summary already enumerates `cross_channel_runtime_exception_abort_email_first_aborts_remainder` (batch Y facet 8), `exception_type_asymmetry_across_senders` (batch K), and `sender_iteration_order_undefined` — all primary-source at EmailNotificationSender.java:58-60 + AlertNotificationMessageProcessor.java:25-36 + AbstractNotificationSender.java:16-30. F-009 batch Y note 8 is the load-bearing primary-source for SHB-053's full hypothesis. No new facet to add; SHB-053's evidence is the canonical narrative form of the existing drift facets. Thread marked merged; cluster_with relationship preserved as a cross-reference but the substantive content lives at F-009. F-009: WAL-driven outbound alert notification fan-out — drift_class facets already cover the full SHB-053 hypothesis.
