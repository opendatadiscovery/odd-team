## REFACTOR-535 — Webhook URL / Slack webhook URL NOT masked by Spring Boot's default `/actuator/env` sanitisation — if actuator is exposed, the webhook URL (a bearer credential by nature) is fetchable

**Severity**: LOW
**Category**: credential-leak + actuator-exposure
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications credential surface), P-09-security-access-control]

**Surfaced by**:
- `WebhookNotificationSender.md:security.known_security_gaps.[4]` (MEDIUM) — "**Webhook URL not masked by Spring's default `/actuator/env` sanitisation** — if `/actuator/env` is exposed (a common operator misconfiguration; ODD's actuator is on the default port shared with the app), the webhook URL is fetchable. Combined with the no-HMAC gap, the URL leakage is sufficient to forge alerts at the receiver."
- `SlackNotificationSender.md:security.data_exposure.[1]` (MEDIUM)

**Statement**: Spring Boot 3.x's default `/actuator/env` sanitisation masks values for property names matching patterns like `*password*`, `*secret*`, `*credential*`, `*key*`, `*token*`. The substring `url` is NOT in the default mask list.

Both `notifications.receivers.slack.url` and `notifications.receivers.webhook.url` are bearer credentials by nature (anyone with the URL can post to the channel). If `/actuator/env` is exposed (a common operator misconfig in `management.endpoints.web.exposure.include=*` deployments), these URLs are fetchable verbatim.

**Combined with REFACTOR-513** (no HMAC), URL leakage means an attacker can forge arbitrary `AlertNotificationMessage`-shaped payloads against the receiver.

**Evidence**:
- Spring Boot 3.4.10 default sanitisation patterns (verified at framework level)
- `NotificationConfiguration.java:77, 91` — `@Value` binding

**Proposed remedy**:

1. **Path A (extend sanitisation pattern)** — In `application.yml` or a `@Configuration` class, add `management.endpoint.env.keys-to-sanitize` to include `notifications.receivers.*.url`. Spring Boot honours this list for masking.

2. **Path B (actuator-gating)** — Cross-link with REFACTOR-096 from batch C (actuator endpoints unauth under DISABLED). Lock down actuator regardless of operator misconfig.

Path A is the SHIP-FAST minimum. Path B is the structural fix.

**Severity rationale**: LOW — operator-actuator-misconfig threat model; bounded by the actuator-exposure precondition.

**Suggested backlog grouping**: `Notifications credential hygiene` + `Actuator security hardening`.

---
