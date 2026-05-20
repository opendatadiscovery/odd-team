## REFACTOR-527 — `receiverId()` values are asymmetric labels: `"Slack"` (single token), `"email"` (lowercase), `"Generic webhook"` (capital G + space) — log greppability requires three patterns; `NotificationSenderException.getMessage()` renders grammatically odd output

**Severity**: LOW
**Category**: label-asymmetry + observability + log-greppability
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications observability)]

**Surfaced by**:
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[10]` (LOW) — "**`receiverId() = \"Generic webhook\"` (capital G + space) is asymmetric with Slack's `\"Slack\"` and email's `\"email\"`.** Log greppability across channels requires three different patterns. The string is also load-bearing for `NotificationSenderException.getMessage()` (NotificationSenderException.java:26 — `String.format(\"Notification sender %s: %s\", notificationReceiverId, super.getMessage())`) — the formatted output for webhook is `Notification sender Generic webhook: <message>` which is grammatically odd."

**Statement**: Each sender's `receiverId()`:
- `SlackNotificationSender.java:52-54` — returns `"Slack"`
- `EmailNotificationSender.java:39-41` — returns `"email"`
- `WebhookNotificationSender.java:27-29` — returns `"Generic webhook"`

Three different conventions: PascalCase, lowercase, space-containing. Log grep / Prometheus label / Elastic-search field aggregation requires three distinct patterns. `NotificationSenderException.getMessage()` renders as `"Notification sender Generic webhook: <message>"` (grammatically odd).

**Evidence**:
- `SlackNotificationSender.java:52-54`
- `EmailNotificationSender.java:39-41`
- `WebhookNotificationSender.java:27-29`
- `NotificationSenderException.java:24-27`

**Proposed remedy**: Normalize to single-token lowercase: `"slack"`, `"email"`, `"webhook"`. Update exception message format. Backward-incompatible for any operator log-aggregation rules; flag in changelog.

**Severity rationale**: LOW — observability hygiene; not security-critical.

**Suggested backlog grouping**: `Notifications observability sprint`.

---
