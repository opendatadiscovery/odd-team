## REFACTOR-528 — Webhook channel has NO custom HTTP header support — operator cannot inject `Authorization`, API key, tenant header, correlation ID, or any custom auth header; receivers requiring auth headers need an HTTP gateway in front

**Severity**: MEDIUM
**Category**: missing-header-config + receiver-compatibility + operator-deployment-burden
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications Webhook channel)]

**Surfaced by**:
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**NO custom HTTP header support — operator cannot inject bearer token, API key, tenant header, or any auth header.** Many webhook receivers (incident management platforms, custom relay services, multi-tenant aggregators) require an `Authorization` header or a tenant-identifier header to route the payload. There is NO configuration knob for `notifications.receivers.webhook.headers.X`, no `@ConfigurationProperties` mapping for a header map, no per-call header injection. Operators must place an HTTP gateway in front of their actual receiver to add headers — a deployment burden ODD's docs do not surface."

**Statement**: ODD's Webhook channel sends bare HTTP POSTs with no operator-controlled headers. The HttpRequest builder at `WebhookNotificationSender.java:20-23` invokes only `.uri(...)`, `.POST(...)`, `.build()`. There is NO:
- `notifications.receivers.webhook.headers: Map<String, String>` config
- Per-channel custom-header registration
- @ConfigurationProperties mapping for a header set

Receivers requiring `Authorization: Bearer <token>`, `X-API-Key: <key>`, `X-Tenant: <id>`, or similar cannot be used directly. Operators must:
- Deploy nginx / envoy / traefik in front of the actual receiver
- Inject headers at the gateway layer
- Maintain the gateway as additional infrastructure

**Cross-link with REFACTOR-513** (no HMAC) — the two together are the full "ODD does NOT contribute to receiver-side auth/identification" stance per ADR-CANDIDATE-188 (thin proxy).

**Evidence**:
- `WebhookNotificationSender.java:20-23` — no header methods
- `NotificationConfiguration.java:88-99` — bean factory; no header config

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-188 NEW batch Y (Webhook thin-proxy) — the architectural choice; REFACTOR-528 is one of the explicit "absences the stance does NOT defend."

**Proposed remedy**:

1. **Path A (header map config)** — Add `notifications.receivers.webhook.headers: Map<String, String>` (operator-tunable). Apply at HttpRequest builder.

2. **Path B (named header presets)** — Add `notifications.receivers.webhook.auth: { type: BEARER, value: <token> }` / `{ type: BASIC, username: ..., password: ... }` / `{ type: API_KEY, name: X-API-Key, value: ... }`. More structured than freeform map.

3. **Path C (defer to operator gateway — keep thin-proxy stance)** — Document the operator-burden explicitly in the live doc. No code change; doc transparency only.

Path A is the SHIP-FAST flexible option. Path B is more structured. Path C respects the thin-proxy ADR.

**Severity rationale**: MEDIUM — operator-deployment burden; bounded workaround exists; touches the thin-proxy ADR's stance.

**Suggested backlog grouping**: `Webhook channel hardening` (cross-link with REFACTOR-513 HMAC family).

---
