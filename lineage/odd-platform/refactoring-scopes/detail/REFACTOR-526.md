## REFACTOR-526 — Email subject template `"ODD Platform - ${alertType} Alert"` hard-coded; operator-non-tunable; cannot remove platform-identity prefix; manual `String.replace` instead of Freemarker

**Severity**: LOW
**Category**: hard-coded + i18n + operator-non-tunable
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel)]

**Surfaced by**:
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[6]` (LOW) — "**Subject template is hard-coded in Java string literal** (`ODD Platform - ${alertType} Alert` at line 21) — operator-non-tunable. Operator can override the body via `email.ftlh` (template under classpath), but NOT the subject."

**Statement**: `EmailNotificationSender.java:21`:
```java
private static final String EMAIL_SUBJECT_TEMPLATE = "ODD Platform - ${alertType} Alert";
```
The prefix `"ODD Platform - "` is operator-non-tunable. Operators wanting:
- Different platform identity (white-label deployments)
- Different language (i18n)
- Stealth deployments (no platform-name in subject)

...cannot achieve any of these without source modification.

**Evidence**:
- `EmailNotificationSender.java:21, 51`

**Proposed remedy**: Add `notifications.email.subject-template` config key (default `"ODD Platform - ${alertType} Alert"`). Operators override as needed.

**Severity rationale**: LOW — cosmetic operator-non-tunability; bounded impact.

**Suggested backlog grouping**: `Notifications hardening sprint`.

---
