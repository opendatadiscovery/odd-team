## REFACTOR-511 — Email `RuntimeException` wrap bypasses dispatcher's per-channel catch — single email failure aborts cross-channel fan-out (Slack + Webhook for the same alert NEVER delivered) — asymmetric contract with Slack + Webhook senders

**Severity**: HIGH
**Category**: error-mapping + contract-asymmetry + cross-channel-abort
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature delivery contract), P-08-observability-and-operations]

**Surfaced by**:
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**RuntimeException wraps MessagingException | TemplateException | IOException — bypasses dispatcher's per-sender catch** (lines 58-60). `AlertNotificationMessageProcessor.java:31` catches only `NotificationSenderException`; the RuntimeException from THIS class propagates upstream, aborting fan-out for ALL subsequent senders for that alert. The other two senders (Slack, Webhook) correctly throw NotificationSenderException via AbstractNotificationSender.sendAndValidate (AbstractNotificationSender.java:23,27). F-009.yaml drift facet `exception_type_asymmetry_across_senders` documents this — this class is the ASYMMETRY's primary source. Recommendation captured: either email should throw NotificationSenderException OR the dispatcher should catch Exception. Live doc does not warn about cross-channel abort on email failure."

**Statement**: At `EmailNotificationSender.java:44-61`:
```java
public void send(final AlertNotificationMessage message) throws NotificationSenderException {
    try {
        final MimeMessage mimeMessage = emailSender.createMimeMessage();
        final MimeMessageHelper helper = new MimeMessageHelper(mimeMessage);
        final String emailContent = getEmailContent(message);
        helper.setSubject(EMAIL_SUBJECT_TEMPLATE.replace("${alertType}", message.getAlertType().name()));
        helper.setText(emailContent, true);
        for (final String notificationsEmail : notificationsEmails) {
            helper.setTo(notificationsEmail);
            emailSender.send(mimeMessage);
        }
    } catch (MessagingException | TemplateException | IOException e) {
        throw new RuntimeException(e);                              // <-- WRONG EXCEPTION TYPE
    }
}
```

The method signature DECLARES `throws NotificationSenderException` — but the catch block at line 59 throws **raw `RuntimeException`**, NOT `NotificationSenderException`. This is the contract violation.

The dispatcher at `AlertNotificationMessageProcessor.java:29-34` catches only `NotificationSenderException`:
```java
for (final NotificationSender sender : senders) {
    try {
        sender.send(message);
    } catch (final NotificationSenderException e) {                 // <-- catches only the typed exception
        log.error("Notification sender {}: {}", sender.receiverId(), e.getMessage(), e);
    }
}
```

A RuntimeException from EmailNotificationSender PROPAGATES PAST this catch, exits the for-loop, exits `process(...)`, surfaces to `NotificationSubscriber.run()`'s outer `catch (Exception e)` at line 90 — which logs + releases the lock + waits 10s + replays the SAME LSN.

**Compound effect with the per-recipient fail-stop (ADR-CANDIDATE-183)**:
1. A single bad recipient (e.g. empty string from `'a@b.com,'` parsing, defunct mailbox returning permanent SMTP 5xx) triggers `MessagingException` at line 56.
2. The catch wraps as `RuntimeException`.
3. The RuntimeException bypasses the dispatcher's `catch (NotificationSenderException)`.
4. The outer fan-out for-loop (per `AlertNotificationMessageProcessor.java:25-36`) is aborted.
5. Slack channel for that alert is NEVER attempted.
6. Webhook channel for that alert is NEVER attempted.
7. The WAL subscriber's outer catch fires (per REFACTOR-508 mechanism).
8. The 10s retry kicks in; the SAME LSN replays; the SAME bad recipient fails again; ad infinitum.

**The two other senders (Slack + Webhook) get this RIGHT**:
- `AbstractNotificationSender.java:23-27`:
   ```java
   try {
       final HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
       if (response.statusCode() != HttpStatus.OK.value()) {
           throw new NotificationSenderException(...);              // <-- typed exception
       }
   } catch (final IOException | InterruptedException e) {
       throw new NotificationSenderException(receiverId(), e);     // <-- typed exception
   }
   ```
   Both `IOException` (network failures) and non-200 status are wrapped as `NotificationSenderException` — caught by the dispatcher.

**Asymmetry**: EmailNotificationSender extends `AbstractNotificationSender` but does NOT use `sendAndValidate(...)` (which is HTTP-specific). The email-side error wrap is INLINE in `send()` and uses the wrong exception type. The asymmetry is structural — the parent's checked-exception contract is not honoured.

**Live doc says**: "An alert dispatched to multiple channels is delivered to every channel that is enabled" (live `/features/active-platform-features/notifications` page, verified 2026-05-20 status 200). The doc DESCRIBES within-channel partial-failure (recipient N fails -> N+1, N+2 skipped) but DOES NOT name the CROSS-CHANNEL abort. Operators reading the doc reasonably expect Slack + Webhook to fire even when email fails — the code reality is otherwise.

**Evidence**:
- `EmailNotificationSender.java:58-60` — the RuntimeException wrap
- `AlertNotificationMessageProcessor.java:29-34` — the dispatcher's narrow catch
- `AbstractNotificationSender.java:23-27` — the correct pattern (used by Slack + Webhook)
- `SlackNotificationSender.java:40-49` — uses `sendAndValidate(...)` correctly
- `WebhookNotificationSender.java:19-23` — uses `sendAndValidate(...)` correctly
- F-009.yaml drift facet `exception_type_asymmetry_across_senders` (line reference)
- Live doc `features/active-platform-features/notifications` page (silent on cross-channel abort)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-183 NEW batch Y codifies per-recipient fail-stop as deliberate; this scope is the CROSS-CHANNEL extension that the ADR DOES NOT defend (the per-recipient stance has rationale; the cross-channel abort is a contract bug).
- ADR-CANDIDATE-186 NEW batch Y codifies the one-shot fire-and-forget for HTTP channels via NotificationSenderException — this scope is the asymmetry violator.

**Proposed remedy**:

1. **Path A (1-line code fix)** — Change line 59-60 to `throw new NotificationSenderException(receiverId(), e);`. The exception is then caught by the dispatcher's narrow catch and the next channel proceeds.

2. **Path B (dispatcher widens the catch)** — Change `AlertNotificationMessageProcessor.java:31` to `catch (final Exception e)` to also handle RuntimeException + any future undeclared exceptions. Defensive depth; would also cover undeclared exceptions from future sender implementations.

3. **Path C (both A and B — defence in depth)** — Fix Email AND widen the dispatcher. Path A ensures the contract; Path B ensures resilience to future contract violations.

Path C is recommended. Path A alone is the minimum fix; Path B alone treats the symptom without fixing the contract; Path C ensures both contract correctness and future-proofing.

Doc-side: update `features/active-platform-features/notifications` to surface the compound cross-channel-abort + per-recipient fail-stop behaviour (or remove the bug per Path A, making the doc CORRECT by default).

**Severity rationale**: HIGH — silently aborts cross-channel delivery for every alert that hits a single bad recipient; the live doc states the opposite of what the code does; operators making decisions based on the doc are misled; structural reliability gap for the F-009 pillar.

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family).

---
