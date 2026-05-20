## REFACTOR-522 — Webhook POST does NOT set `Content-Type: application/json` header — receivers strictly checking Content-Type reject the request with 415 Unsupported Media Type

**Severity**: LOW
**Category**: missing-header + receiver-compatibility
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications Webhook channel)]

**Surfaced by**:
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[6]` (MEDIUM) — "**`Content-Type: application/json` header is NOT set.** `HttpRequest.BodyPublishers.ofString(...)` does not set any Content-Type; the builder pattern in this class invokes only `.uri(...)`, `.POST(...)`, `.build()` (lines 20-23). Receivers strictly checking `Content-Type` (e.g. Discord, many corporate WAFs) reject the request with 415 Unsupported Media Type — surfaced as NotificationSenderException at the dispatcher, alert dropped. The fix is a one-line `.header(\"Content-Type\", \"application/json\")` between lines 21 and 22."

**Statement**: At `WebhookNotificationSender.java:18-23`:
```java
final HttpRequest request = HttpRequest.newBuilder()
    .uri(webhookUrl)
    .POST(HttpRequest.BodyPublishers.ofString(JSONSerDeUtils.serializeJson(message)))
    .build();
```
The JDK's `HttpRequest.BodyPublishers.ofString(...)` does NOT set a default Content-Type. The builder pattern in this class adds only `.uri(...)` + `.POST(...)`. NO `.header("Content-Type", "application/json")` call.

The Slack sender has the same gap at `SlackNotificationSender.java:43-46`. Slack's incoming-webhook parser accepts JSON empirically without Content-Type, but the behavior is undocumented.

**Receivers that reject without Content-Type**:
- Discord webhook receiver (some configurations)
- Corporate WAFs / API gateways with strict MIME validation
- Strict OpenAPI-generated receivers
- Some incident-management platform receivers

**Evidence**:
- `WebhookNotificationSender.java:20-23` — no `.header(...)` calls
- `SlackNotificationSender.java:43-46` — same gap, partially noted at `bugs_limitations_corner_cases.[5]`

**Proposed remedy**: One-line addition in both senders: `.header("Content-Type", "application/json")`. Also add `User-Agent: ODD-Platform/<version>` for receiver-side diagnostic.

**Severity rationale**: LOW — operator workaround exists (HTTP gateway can inject the header) but is a trivial code fix to avoid.

**Suggested backlog grouping**: `Notifications hardening sprint`.

---
