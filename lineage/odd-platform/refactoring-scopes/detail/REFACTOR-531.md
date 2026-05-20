## REFACTOR-531 — `SlackNotificationSender`'s `ObjectMapper` is `private static final` — no per-instance configurability; an operator with a Slack-side parser quirk has no platform-side knob

**Severity**: LOW
**Category**: hard-coded + operator-non-tunable + dead-code-asymmetry
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications Slack channel)]

**Surfaced by**:
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[7]` (LOW) — "**ObjectMapper is class-static; no per-instance customisation possible.** The ObjectMapper at SlackNotificationSender.java:21-25 is `private static final` — a single instance shared across all `serializePayload(...)` invocations."
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[10]` (LOW) — "**Constructor accepts HttpClient that is never used** — line 27 receives HttpClient, line 32 calls `super(httpClient)` which stores it in AbstractNotificationSender.httpClient. SMTP delivery does NOT route through HttpClient — JavaMailSender uses java.mail.Session under the hood. The HttpClient is effectively dead code on this code path."

**Statement**: Two related observations on hard-coded sender configuration:

1. **Slack ObjectMapper class-static**: `SlackNotificationSender.java:21-25` declares the ObjectMapper as `private static final`. An operator needing a different Jackson naming strategy (e.g. for a strange Slack-compatible parser), BigDecimal-as-string serialisation, or property-order customisation has no knob — modification requires source change.

2. **Email dead HttpClient parameter**: `EmailNotificationSender.java:27` accepts `HttpClient` in the constructor and stores it via `super(httpClient)`. SMTP delivery uses JavaMail / `mail.Session` under the hood — HttpClient is NEVER used. A maintainer reading the constructor would assume HttpClient is required; it is not.

**Evidence**:
- `SlackNotificationSender.java:21-25` — `private static final ObjectMapper OBJECT_MAPPER`
- `EmailNotificationSender.java:27, 32` — `super(httpClient)` storing unused field
- `AbstractNotificationSender.java:14` — parent's `httpClient` field

**Proposed remedy**:
- Path A (Slack): If operator-tunability is needed, refactor to instance field initialized by constructor injection. Currently no operator demand — keep as-is.
- Path A (Email): Either remove the HttpClient parameter (breaking change to the AbstractNotificationSender contract) OR document explicitly that Email overrides receive an unused HttpClient (misleading API note).

**Severity rationale**: LOW — both are code-hygiene items; bounded operator impact.

**Suggested backlog grouping**: `Notifications code hygiene`.

---
