## REFACTOR-305 — `EmailNotificationSender` wraps `MessagingException | TemplateException | IOException` as raw `RuntimeException`, BYPASSING the dispatcher's `catch (NotificationSenderException)` per-sender guard; email failures abort fan-out for the message, contradicting the catch-and-continue ADR for one channel only

**Severity**: HIGH
**Category**: error-mapping (asymmetric exception handling)
**Pillars affected**: [P-07-active-platform-features]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__NotificationsDispatcher.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Asymmetric exception handling between sender impls. The dispatcher's per-sender try/catch catches `NotificationSenderException` (checked) only. `EmailNotificationSender` wraps `MessagingException | TemplateException | IOException` as `new RuntimeException(...)` at EmailNotificationSender.java:59 — NOT as `NotificationSenderException`. An email failure therefore BYPASSES the dispatcher's catch and aborts fan-out for that message."

**Description**: `AlertNotificationMessageProcessor.java:29-35` catches `NotificationSenderException` (the checked exception declared on the `NotificationSender` interface). Both `SlackNotificationSender` and `WebhookNotificationSender` throw `NotificationSenderException` on 2xx-mismatch via `AbstractNotificationSender.java:24-29`. `EmailNotificationSender.java:58-60` does NOT — it wraps the underlying JavaMail / Freemarker exceptions as `new RuntimeException(...)`, NOT as `NotificationSenderException`. RuntimeException is NOT caught by the dispatcher's per-sender guard. The dispatcher's fan-out loop aborts mid-iteration when the email sender throws — subsequent senders (if email is not last in the Spring-bean-iteration-order, per REFACTOR-309 sender-order undefined) do NOT receive the alert.

**Failure mode**: An operator has Slack + Webhook + Email channels configured. The SMTP server is down. The dispatcher iterates senders in Spring-bean-order (undefined but suppose email is first or middle). On the SAME alert event: email throws RuntimeException(MessagingException → "Could not connect to SMTP host"); the dispatcher's catch at line 31 does NOT match (catches NotificationSenderException only); the entire `process()` method aborts; the NotificationSubscriber outer catch at line 90 logs the error and triggers 10s back-off + WAL re-acquire (poison-message loop, see REFACTOR-306). Slack and Webhook NEVER receive that alert. The catch-and-continue ADR (ADR-CANDIDATE-098 NEW batch K) is broken specifically for the email channel.

**Primary source citations**:
- `AlertNotificationMessageProcessor.java:31` (catches `NotificationSenderException` only)
- `EmailNotificationSender.java:58-60` (`throw new RuntimeException(\"Couldn't send email: \" + e.getMessage(), e);` — wraps as RuntimeException, NOT NotificationSenderException)
- `SlackNotificationSender.java` + `WebhookNotificationSender.java` via `AbstractNotificationSender.java:24-29` (throws NotificationSenderException correctly)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-098 (NEW batch K — per-channel catch-and-continue fan-out) IS the architectural prescription this bug breaks. The ADR's wording: "one bad channel does not block the others" — the email-channel-specific RuntimeException-wrap silently violates the prescription for that one channel. The fix preserves the ADR.

**Proposed remedy**: One-line code fix. Change `EmailNotificationSender.java:58-60` from `throw new RuntimeException(\"Couldn't send email: \" + e.getMessage(), e);` to `throw new NotificationSenderException(\"Couldn't send email\", e);` (or whatever the canonical wrap shape is for the other two senders). This brings the email channel into compliance with the per-sender catch-and-continue ADR. Add a regression test that asserts `process()` continues to the next sender after the email sender throws. Cross-link with REFACTOR-128 (batch C — email per-recipient silent partial delivery) — the two together describe the email-channel-specific deficiencies.

**Severity rationale**: HIGH — silently breaks the architectural promise of "one bad channel does not block the others" for the email channel; combined with REFACTOR-128 (per-recipient partial delivery), email is the most fragile channel in the Notifications subsystem. The one-line fix is high-leverage.

**Suggested backlog grouping**: `Notifications hardening sprint` (batch C grouping)

---
