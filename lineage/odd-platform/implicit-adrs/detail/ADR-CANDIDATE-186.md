## ADR-CANDIDATE-186 — HTTP notification channels (Slack + Webhook) are one-shot fire-and-forget with exactly-HTTP-200 success semantic — every non-200 raises uniform `NotificationSenderException`, no retry, no backoff, no Retry-After honoring; dispatcher catches and continues

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate "don't queue at platform; let receiver be source-of-truth" stance)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature HTTP channels), P-10-deployment-architecture (failure-mode contract for outbound HTTP)]
**Support count**: 2 sidecars primary source (batch Y SlackNotificationSender + WebhookNotificationSender)
**Axes present**: notification.sender
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `SlackNotificationSender.md:implicit_adrs.[0]` (HIGH) — "Slack delivery is one-shot fire-and-forget with exactly-HTTP-200 success semantic — every non-200 (including 429 rate-limit) raises a single uniform `NotificationSenderException` that the dispatcher catches and logs; there is NO retry, NO backoff, NO Retry-After honoring, NO DLQ, NO per-status-class handling. This encodes a deliberate 'don't queue at the platform; let Slack be the source-of-truth for delivery; if Slack is unavailable, accept the loss' stance — consistent with the broader F-009 catch-and-continue ADR-CANDIDATE-098." — intent_anchor: `sendAndValidate(request)` (no retry loop) + `AbstractNotificationSender.java:26 if (response.statusCode() != HttpStatus.OK.value()) { throw new NotificationSenderException(...); }` (SlackNotificationSender.java:40-49 + AbstractNotificationSender.java:16-30)
- `WebhookNotificationSender.md:implicit_adrs.[1]` (HIGH) — "**Symmetric exception wrapping with Slack — both throw checked `NotificationSenderException` via the shared parent.** Both WebhookNotificationSender and SlackNotificationSender invoke `sendAndValidate(...)` (parent line 16-30) which converts IOException -> checked NotificationSenderException AND wraps non-200 status -> checked NotificationSenderException. This makes the two HTTP-channel siblings well-behaved with respect to the dispatcher's per-channel catch-and-continue ADR (AlertNotificationMessageProcessor.java:31 catches NotificationSenderException). The contract violator is EmailNotificationSender, NOT this class — see exception-type-asymmetry-notification-senders concept." — intent_anchor: WebhookNotificationSender.java:19-23 + AbstractNotificationSender.java:16-30 (no try/catch wrapping in subclass; parent's typed exception)

**Decision statement**: ODD's two HTTP notification channels (Slack incoming-webhook + generic webhook) share a single delivery contract enforced by their common parent class `AbstractNotificationSender.sendAndValidate(...)` (lines 16-30):

1. **One-shot send** — a single `httpClient.send(request, BodyHandlers.ofString())` invocation per alert. No retry loop, no scheduled retry, no exponential back-off.
2. **Exactly HTTP 200 = success** — `if (response.statusCode() != HttpStatus.OK.value()) throw new NotificationSenderException(...)`. ANY non-200 (201, 202, 204, 4xx, 5xx, 429) is treated identically — uniform exception.
3. **`NotificationSenderException` is the SOLE checked exception type** — the dispatcher (`AlertNotificationMessageProcessor.java:31`) `catch (NotificationSenderException)` handles every HTTP-channel failure with `log.error(...)` + continues iterating remaining senders.
4. **No Retry-After honoring** — Slack documents incoming-webhooks as rate-limited to ~1 message per second per webhook; on excess, Slack returns 429 with `Retry-After: N` header. ODD's check at `AbstractNotificationSender.java:26` reads ONLY `response.statusCode()`; the `Retry-After` header is NEVER read.
5. **No body inspection on failure** — the response body (which Slack uses to convey error details) is read into the `HttpResponse<String>` but never logged, never parsed.
6. **No DLQ, no audit, no metric** — failed alerts are LOST from that channel forever. The WAL LSN advances regardless (per ADR-CANDIDATE-180), so the alert is NOT replayed.

The architectural commitments:
- **(a) "Don't queue at the platform; let the receiver be the source-of-truth."** ODD does NOT model itself as a delivery-guarantee layer for outbound notifications. The receiver (Slack workspace history, webhook endpoint's downstream queue, etc.) is the operator's authoritative store. If Slack is unavailable for 5 minutes, all alerts during that window are lost from the Slack channel — ODD does not buffer them.
- **(b) Uniform-on-failure simplifies dispatcher logic.** A single `catch (NotificationSenderException)` block in `AlertNotificationMessageProcessor.process` handles every HTTP failure mode identically. The alternative (per-status-class handling: retry on 5xx, honor 429 Retry-After, escalate 4xx) would require sender-side state, retry queues, and dispatcher-side branch logic — orthogonal to the current "iterate senders, catch-and-log, advance LSN" pattern.
- **(c) 200-only is the strictest of the documented choices.** RFC 7230 allows any 2xx as success; HTTP best-practice accepts 2xx; many webhook receivers return 201 (Created) or 202 (Accepted) or 204 (No Content). ODD's strictness narrows operator-receiver choice (REFACTOR-521 captures the gap — operator-friendly receivers returning 201/202/204 cannot be used without an HTTP gateway).
- **(d) Symmetric exception contract across Slack + Webhook.** The two HTTP-channel senders go through the SAME parent code path (`sendAndValidate`). The Email channel does NOT (its inline RuntimeException wrap at `EmailNotificationSender.java:58-60` bypasses the dispatcher's `catch (NotificationSenderException)` — REFACTOR-511 captures this asymmetry).
- **(e) Burst-loss-to-rate-limit is the implicit cost.** A burst of 50 alerts to Slack (e.g. a single failed dbt run producing 50+ alerts) triggers ~49 429 responses; the platform's burst delivery rate is bounded by Slack's webhook rate-limit. Without Retry-After honoring, ALL 49 alerts are lost from the Slack channel.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - The `sendAndValidate(...)` design at the abstract parent (a single method with the 200-or-throw shape) is shared across BOTH HTTP senders — the symmetry is structural, not accidental.
   - The choice of `NotificationSenderException` as a CHECKED exception forces the implementor to either declare it or catch it; the dispatcher's `catch (NotificationSenderException)` at `AlertNotificationMessageProcessor.java:31` is the deliberate single-handler.
   - The ABSENCE of any retry loop in either sender class (Slack's `send` is 9 lines, Webhook's is 6 lines) — both are minimalist; retry was deliberately omitted.
2. **Structural impact?** YES — every future "add retry / back-off / DLQ / Retry-After" feature must work AROUND this contract; every operator-receiver choice (which webhook receivers to integrate) is bounded by the 200-only check.
3. **Refactoring or structural?** STRUCTURAL — adding retry requires either (a) modifying `AbstractNotificationSender.sendAndValidate` (affects both senders + their per-channel guarantees) or (b) adding a decorator pattern (introduces new abstraction). Adding Retry-After honoring requires per-status-class branch logic at the parent. Both structural.

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-180 (at-least-once via LSN-after-process — the WAL side advances regardless of HTTP-side failure, which is the structural reason a failed Slack delivery is permanently lost), ADR-CANDIDATE-187 (single-channel-per-deployment — the HTTP channels deliver to ONE URL each), ADR-CANDIDATE-098 referenced by the sidecar quote (catch-and-continue dispatcher pattern — same family).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-511 NEW batch Y (Email RuntimeException bypass — the asymmetry; email DOES NOT follow this ADR; HIGH)
- REFACTOR-512 NEW batch Y (Slack mrkdwn-injection — orthogonal but co-located; HIGH; F-004 6th surface)
- REFACTOR-513 NEW batch Y (Webhook no HMAC — same shape; receiver cannot verify origin; HIGH)
- REFACTOR-515 NEW batch Y (no connect/request timeout on shared HttpClient — the COMPLEMENTARY gap; unreachable URL hangs the dispatcher thread indefinitely; HIGH)
- REFACTOR-517 NEW batch Y (no URI scheme allowlist on Slack/Webhook URLs — SSRF surface; MEDIUM)
- REFACTOR-518 NEW batch Y (no retry/DLQ/audit on failed delivery — the LOAD-BEARING gap this ADR's stance produces; HIGH)
- REFACTOR-521 NEW batch Y (HTTP 200-only narrow accept — 201/202/204 receivers cannot be used; MEDIUM)
- REFACTOR-523 NEW batch Y (Slack 429 silently dropped; no Retry-After; MEDIUM)

**Proposed action**: Promote to `adrs/drafts/http-notification-fire-and-forget.md` (new ADR). Document the six sub-decisions + the operator-visible consequences (burst-loss, narrow status accept, no DLQ) + the deliberate symmetry across Slack + Webhook + the Email-channel asymmetry as the call-out exception. Doc-side: the live notifications page should surface the 200-only check + the no-retry behaviour + Slack-429-silent-drop so operators evaluating ODD against incumbent alternatives (PagerDuty, Opsgenie which DO retry) can make an informed choice.

**Severity rationale**: HIGH — defines the platform's notification delivery contract for HTTP channels (2 of 3 outbound channels); operationally significant (burst-loss to 429 is real for high-cardinality alert sources); cross-references the Email-channel asymmetry which compounds the cross-channel-abort behaviour; structural for every future reliability feature.

---
