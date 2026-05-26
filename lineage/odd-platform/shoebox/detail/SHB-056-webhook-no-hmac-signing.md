# SHB-056 — Webhook receivers cannot verify alert payloads originated from ODD (no HMAC, no signing, no shared secret)

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators integrating ODD's generic webhook channel with incident-management platforms (PagerDuty, Opsgenie, custom relay services) cannot cryptographically verify that an alert payload originated from THEIR ODD deployment vs an attacker who learned the webhook URL. The webhook URL is a de-facto bearer token; anyone with it can forge an arbitrary `AlertNotificationMessage`-shaped JSON and POST it to the operator's receiver. ODD ships no HMAC-SHA256-over-body header, no shared-secret config knob, no `X-ODD-Signature` header — by design. The live notifications doc is silent on this; an operator following the docs to enable the channel does not learn that they must place the receiver behind a VPN, IP allowlist, or mTLS gateway to obtain origin verification. Competitor systems (Slack incoming webhooks — well-known; GitHub webhooks — HMAC-SHA256; AlertManager — auth_headers) ship signing as table-stakes.

## Evidence

- `odd-platform-api/src/main/java/.../notification/sender/WebhookNotificationSender.java:18-23` — the entire send-method body. `HttpRequest.newBuilder().uri(webhookUrl).POST(BodyPublishers.ofString(serializeJson(message))).build()` — no `.header("X-ODD-Signature", ...)`, no HMAC computation, no shared-secret field on the class.
- `WebhookNotificationSender.java:11-16` — constructor binds only `HttpClient` + `URI`; no secret field is plumbed in.
- `NotificationConfiguration.java:88-99` (referenced in WebhookNotificationSender sidecar) — bean factory accepts `notifications.receivers.webhook.url` only; no `notifications.receivers.webhook.signing-secret` key exists.
- Live notifications doc (verified 2026-05-20 status 200): documents `notifications.receivers.webhook.url` only; quoted gap per WebhookNotificationSender sidecar `doc_drift_findings.[0]` — "Live doc is silent on HMAC / signature support."
- `WebhookNotificationSender` sidecar `known_security_gaps.[0]` HIGH severity primary source.
- `WebhookNotificationSender` sidecar `data_exposure.[3]` — webhook URL is reachable via `/actuator/env`; Spring's default sanitizer does NOT mask the substring `url`. URL leakage is therefore a low-effort discovery surface.
- Cross-reference SHB-055: an attacker exploiting both the unauthenticated AlertManager webhook (F-007) + the missing webhook signing can construct a payload-injection chain where ODD becomes a laundering relay for arbitrary alerts to the operator's incident-management system.

## Notes

- This is OBVIOUSLY a feature gap, not a feature, but the user-observable surface — "operators integrating with incident-management cannot tell ODD from a spoofer" — IS the feature shape. The current behaviour stems from F-009's "thin proxy" stance (no per-message middleware); the gap is structurally present, not accidentally absent.
- The fix is small and well-bounded: add a `notifications.receivers.webhook.signing-secret` key, compute `X-ODD-Signature: sha256=HMAC(secret, body)`, document the verification snippet operators can run on their receiver. Three sender-related files, one config-properties update, one doc page.
- HMAC adoption is also a precondition for AT-LEAST-ONCE / idempotency-key delivery semantics — a request-id + signature pair is the canonical pattern for "operator's receiver can dedupe across ODD's WAL-replay loops." Without it, the no-retry stance is the only thing protecting receivers from double-deliveries.
- Same pattern absent from Slack-side (per `SlackNotificationSender.bugs_limitations_corner_cases.[5]`) and from inbound AlertManager webhook (F-007); the platform's entire HTTP-integration surface is currently URL-as-bearer-token throughout.
- Cluster with the no-Content-Type, no-custom-headers, 200-only-accept gaps from WebhookNotificationSender sidecar — they together compose "webhook channel integration usability and security baseline."

## Next

1. **Graduate** as F-NNN "Generic webhook integration security baseline" — pillar P-07 primary, P-09 secondary. Frame as "what does an operator need to safely integrate ODD's webhook with an external receiver" (HMAC + custom headers + Content-Type + idempotency key + 2xx-accept).
2. **SEC-NNN** — implement HMAC-SHA256 signing, behind a `notifications.receivers.webhook.signing-secret` opt-in key (rollback-safe: absent secret = today's behaviour). Severity HIGH.
3. **REFACTOR-NNN** — add operator-configurable custom headers (`notifications.receivers.webhook.headers.X`) for receivers requiring `Authorization: Bearer ...`. Cross-cuts F-009 fan-out.
4. **REFACTOR-NNN** — set `Content-Type: application/json` header (one-line fix at `WebhookNotificationSender.java:20-22`).
5. **REFACTOR-NNN** — relax the parent's 200-only check to accept the 2xx range (or operator-configurable status codes).
6. **DOC-NNN** — `features/active-platform-features/notifications` should state the trust model explicitly: "ODD signs no outbound payload; deploy your receiver behind network-layer auth (VPN, IP allowlist, mTLS) OR set `signing-secret`."

## Links

- cluster_with: [F-007, F-009, SHB-055]
- merged_into: (open)
- supersedes: []
