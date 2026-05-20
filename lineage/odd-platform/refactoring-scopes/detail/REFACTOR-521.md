## REFACTOR-521 — HTTP-channel senders treat exactly HTTP 200 as success — 201 (Created), 202 (Accepted), 204 (No Content) and other 2xx codes from common webhook receivers are treated as FAILURE; operator must run HTTP gateway to rewrite 2xx -> 200

**Severity**: MEDIUM
**Category**: status-code-narrow + receiver-compatibility
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications HTTP channels)]

**Surfaced by**:
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[7]` (MEDIUM) — "**200-only HTTP accept — common 2xx-success codes treated as failure.** The parent's `sendAndValidate` at AbstractNotificationSender.java:26-29 checks `response.statusCode() != HttpStatus.OK.value()` — i.e. exactly 200. A webhook receiver that responds 201 (Created), 202 (Accepted, common for async receive), 204 (No Content) is treated as a failure; the alert is dropped from logs with a misleading 'Notification sender response didn't complete with 200 status code' error message."
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[0]` (HIGH) — partial overlap (Slack 429 + other non-200 share the uniform-failure shape)

**Statement**: `AbstractNotificationSender.java:26`:
```java
if (response.statusCode() != HttpStatus.OK.value()) {        // <-- exactly 200
    throw new NotificationSenderException(...);
}
```
The check is `!= 200`. Both Slack and Webhook channels go through this single line. Any non-200 status is treated identically:
- **201 (Created)** — many incident-management webhooks respond Created on successful queue insertion
- **202 (Accepted)** — async-receive pattern (caller acknowledges receipt; processing happens later)
- **204 (No Content)** — common for "received but no body to return"
- **429 (Too Many Requests)** — Slack's rate-limit response
- **5xx** — receiver-side errors

The treatment is uniform: throw `NotificationSenderException`, dispatcher catches, logs ERROR with message "Notification sender response didn't complete with 200 status code", alert is gone forever (no retry, no DLQ per REFACTOR-518).

**Operator workaround**: Deploy an HTTP gateway (nginx, envoy, traefik) in front of the receiver that rewrites 2xx -> 200. Deployment burden + extra infrastructure.

**Common receivers that respond non-200**:
- Discord webhook receives → 204 No Content
- Microsoft Teams webhook → 200 (OK)
- PagerDuty Events API → 202 Accepted (async)
- Opsgenie webhook → 202 Accepted
- Custom queue-backed receivers → 201 or 202

**Evidence**:
- `AbstractNotificationSender.java:26-29` — the exact status check
- `SlackNotificationSender.java:40-49` — Slack uses this check
- `WebhookNotificationSender.java:18-23` — Webhook uses this check

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-186 NEW batch Y codifies "one-shot fire-and-forget exactly-HTTP-200" — this IS the design choice. ADR explicitly mentions REFACTOR-521 as a co-surfaced gap (narrow status accept).

**Proposed remedy**:

1. **Path A (widen to 2xx range)** — Change `response.statusCode() != HttpStatus.OK.value()` to `response.statusCode() / 100 != 2` (any 2xx is success). One-line change. Backward-compatible (200-responding receivers still work).

2. **Path B (operator-tunable acceptable status codes)** — Add `notifications.receivers.http.acceptable-status-codes: List<Integer>` (default `[200]`). Operators with receivers that always respond 201 can configure `[200, 201]`. More flexible but complicates configuration.

3. **Path C (per-channel acceptable status)** — Same as Path B but per-channel (Slack vs Webhook). Even more flexible but more configuration surface.

Path A is the SHIP-FAST recommended. The cost is minimal and matches HTTP best-practice (RFC 7230 says 2xx is success).

**Severity rationale**: MEDIUM — narrows operator-receiver compatibility; cross-references ADR-CANDIDATE-186 (the design choice the ADR codifies); operator-workaround exists (HTTP gateway) but is a deployment burden.

**Suggested backlog grouping**: `Notifications hardening sprint`.

---
