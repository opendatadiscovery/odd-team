## REFACTOR-513 — Webhook outbound POSTs carry NO HMAC / signature / shared-secret / authentication header — operator's webhook receiver cannot verify the payload's origin; anyone with the URL can forge an arbitrary `AlertNotificationMessage`-shaped payload

**Severity**: HIGH
**Category**: missing-auth + missing-signature + receiver-origin-verification
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications Webhook channel), P-09-security-access-control]

**Surfaced by**:
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**NO HMAC / signature / shared-secret / authentication header — operator endpoint cannot verify the payload's origin.** The HttpRequest at lines 20-22 carries only `.uri(...)` + `.POST(BodyPublishers.ofString(...))` + `.build()`. No `Authorization` header, no `X-ODD-Signature`, no HMAC-SHA256 over the body, no shared-secret config knob. An attacker who learns the webhook URL (e.g. via `/actuator/env` if exposed, via deployment artefacts, via leaked container images) can POST a forged payload that the operator's receiver cannot distinguish from a legitimate ODD alert. This is the load-bearing security gap for the generic-webhook channel."
- `WebhookNotificationSender.md:security.known_security_gaps.[0]` (HIGH) — "**No HMAC / signature / shared-secret** — operator's webhook receiver cannot verify the payload came from ODD. Anyone with the URL can forge an arbitrary `AlertNotificationMessage`-shaped payload. Mitigations require operator-side IP allowlisting, VPN deployment, or HTTP gateway with mTLS — none of which ODD's docs surface."

**Statement**: ODD's generic Webhook channel sends outbound POSTs with NO authentication signal. The HttpRequest construction at `WebhookNotificationSender.java:18-23`:
```java
final HttpRequest request = HttpRequest.newBuilder()
    .uri(webhookUrl)
    .POST(HttpRequest.BodyPublishers.ofString(JSONSerDeUtils.serializeJson(message)))
    .build();
```
carries NONE of the standard authentication mechanisms:
- NO `Authorization: Bearer <token>` header
- NO `X-ODD-Signature: <hmac>` header (e.g. HMAC-SHA256 of body with shared secret)
- NO `X-Webhook-Token: <shared-secret>` header
- NO `Content-Digest: sha-256=...` header (RFC 9421 HTTP Message Signatures)

The operator's webhook receiver therefore CANNOT distinguish a legitimate ODD-originated payload from a forged one. Anyone with the webhook URL can craft a request body matching the `AlertNotificationMessage` shape and POST it.

**Attack vectors for URL leakage**:
- `/actuator/env` if exposed (Spring Boot's default `/actuator/env` sanitisation does NOT include `url` substring — REFACTOR-535)
- Deployment artefacts (env-vars baked into container images, environment-variable dumps to logs)
- Operator dashboards / monitoring tools showing config
- Network-level disclosure (TLS interception during initial deployment, packet captures during testing)
- Slack-side configuration UI (for the Slack channel — the URL IS the credential there)

**Compounding factors**:
- Per ADR-CANDIDATE-188 (Webhook thin-proxy), this is the DELIBERATE stance — operators OWN receiver-side authentication. But the live doc does NOT make this explicit; operators evaluating ODD against alternatives (Slack incoming webhooks DO support signed payloads, GitHub webhooks ship HMAC-SHA256 by default, AlertManager supports webhook_config with auth headers) cannot determine from the docs whether ODD signs.
- The mitigation requires operator-side investment: IP allowlisting (network ACL), VPN-only deployment (network-layer auth), HTTP gateway with mTLS (terminating proxy that adds Authorization header). All operator-deployment-burden.
- Combined with REFACTOR-514 (cross-tenant exposure), the URL leak risks not just forgery but also full PII surface disclosure.

**Live doc says NOTHING**. The `features/active-platform-features/notifications` page (verified 2026-05-20 status 200) is SILENT on signing / HMAC / auth headers. The maintainer's stance (thin proxy) is the implicit design choice but is not explained to operators.

**Evidence**:
- `WebhookNotificationSender.java:20-22` — no `.header(...)` calls
- `WebhookNotificationSender.java:1-30` — the entire class; no signing utility, no secret-management
- `NotificationConfiguration.java:88-99` — bean factory; no `secret` parameter, no `Authorization` config knob
- Live doc `features/active-platform-features/notifications` (silent on HMAC)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-188 NEW batch Y (Webhook thin-proxy) codifies the stance; this scope is the OPERATOR-BURDEN cost the ADR's stance produces. The ADR explicitly says "thin-proxy stance does NOT defend the absence of features" — REFACTOR-513 IS the absence the ADR refers to.

**Proposed remedy**:

1. **Path A (HMAC-SHA256 signing — recommended)** — Add `notifications.receivers.webhook.signing-secret` config key (operator-tunable). At send time, compute `hmac_sha256(secret, body)` and set `X-ODD-Signature: sha256=<hex>` header. The receiver verifies by re-computing the HMAC on the body and comparing constant-time. Standard pattern; widely supported.

2. **Path B (shared-secret bearer token)** — Add `notifications.receivers.webhook.bearer-token` config key. Set `Authorization: Bearer <token>` header on every request. Simpler than HMAC but: (a) less secure (token vulnerable to replay if TLS is intercepted), (b) doesn't authenticate the body (a man-in-the-middle could re-route to a different payload).

3. **Path C (X.509 client certificate / mTLS)** — Configure the platform's `HttpClient` with a client cert; the operator's receiver authenticates the platform via TLS-level client-cert validation. Strongest auth; requires operator-side TLS infrastructure.

4. **Path D (operator-burden documentation)** — If the maintainer wants to keep the thin-proxy stance, the live doc MUST surface the absence of signing + the operator-burden mitigations (IP allowlist, VPN, mTLS-gateway-in-front). This is the minimum doc fix even without code change.

Path D is the MINIMUM (operator-friendly doc transparency). Path A is the SHIP-FAST recommended (HMAC is the industry standard for webhook signing). Path C is the strongest but requires operator infrastructure.

**Severity rationale**: HIGH — load-bearing security gap for the generic-webhook channel; operators evaluating ODD against signed-webhook alternatives cannot tell from the docs that signing is absent; forge-payload attack vector is real once URL leaks; cross-references REFACTOR-514 (cross-tenant), REFACTOR-518 (no audit means forgeries leave no diagnostic trail).

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family) + `Webhook channel security hardening`.

---
