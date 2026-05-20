## REFACTOR-533 — `EmailNotificationSender` constructor accepts unused `HttpClient` parameter — dead-wired through `AbstractNotificationSender` for symmetry with Slack/Webhook; misleading API for future maintainers

**Severity**: LOW
**Category**: dead-code + misleading-api
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications code hygiene)]

**Surfaced by**:
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[10]` (LOW) — duplicated in REFACTOR-531; keeping as standalone for tracking purposes

**Statement**: `EmailNotificationSender.java:27, 32`:
```java
public EmailNotificationSender(final HttpClient httpClient, ..., final List<String> notificationsEmails) {
    super(httpClient);   // <-- HttpClient stored in parent but never used for SMTP
    ...
}
```
The `HttpClient` parameter is required by the `AbstractNotificationSender` parent's constructor (for symmetry with Slack + Webhook senders), but SMTP delivery uses `JavaMailSender` / `mail.Session`. The HttpClient is dead-wired for type symmetry.

**Evidence**:
- `EmailNotificationSender.java:27, 32`
- `AbstractNotificationSender.java:14`
- `NotificationConfiguration.java:117` — bean factory passes `httpClient` argument

**Proposed remedy**: Either (a) decouple AbstractNotificationSender from HttpClient (move HttpClient to a sub-abstraction for HTTP senders only) or (b) add a comment / @Deprecated annotation on the HttpClient parameter in Email's constructor.

**Severity rationale**: LOW — code-clarity issue; not a runtime bug.

**Suggested backlog grouping**: `Notifications code hygiene`.

---
