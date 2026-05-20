## REFACTOR-516 — Email SMTP transport has NO timeouts set — unreachable SMTP relay blocks the per-recipient loop indefinitely; cluster-wide Notifications dispatcher stalled until OS socket timeout

**Severity**: HIGH
**Category**: missing-timeout + blocking-thread + cascading-failure
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel)]

**Surfaced by**:
- `EmailNotificationSender.md:performance.known_performance_gaps.[1]` (HIGH, upstream-rooted) — "**No SMTP timeouts set — sibling NotificationConfiguration sidecar covers this (HIGH severity)**. This class inherits the timeout-unset behaviour by using the JavaMailSender bean produced upstream. A hung SMTP relay blocks the for-loop indefinitely. — evidence: EmailNotificationSender.java:56 (sender.send) + NotificationConfiguration.java:61-69 (Properties bag absent of timeouts) — severity: HIGH (upstream-rooted)"
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[11]` (MEDIUM) — "**No retry on transient SMTP failures** — JavaMailSender#send blocks until the transport returns (success) or throws MessagingException (failure). There is no exponential back-off, no per-recipient retry, no DLQ. A transient SMTP outage (relay temporarily unreachable, mailbox temporarily over quota) causes immediate per-alert delivery failure."

**Statement**: The `JavaMailSender` bean produced by `NotificationConfiguration#mailSender` at lines 51-72 does NOT set any of the JavaMail SMTP timeout properties: `mail.smtp.connectiontimeout`, `mail.smtp.timeout`, `mail.smtp.writetimeout`. The Properties bag at lines 61-69 carries only host/port/protocol/auth/starttls keys.

Per `EmailNotificationSender.java:56`, the per-recipient `emailSender.send(mimeMessage)` call is synchronous and blocks until either (a) the SMTP relay responds with a status code OR (b) the underlying socket times out at the OS level (Linux default ~75-120s).

**Cascading failure** identical to REFACTOR-515's HTTP shape but on the SMTP transport:
1. SMTP relay unreachable / TCP-accept-then-hang.
2. The for-loop's first recipient's `emailSender.send(mimeMessage)` blocks for 75-120s+.
3. WAL subscriber thread (the dispatcher's caller) is captive.
4. Slack + Webhook NEVER fire for that alert (sequential per-channel iteration).
5. Subsequent alerts queue in PG replication slot.
6. PG WAL retention accumulates.

**Cross-channel composition with REFACTOR-511**: If the SMTP relay times out AFTER recipient 1 succeeded but BEFORE recipient 2 — the MessagingException at line 56 is wrapped as RuntimeException (per REFACTOR-511), bypassing the dispatcher's `catch (NotificationSenderException)` AND aborting cross-channel fan-out. The compound effect is severe.

**Sibling sidecar (`NotificationConfiguration`, batch C) flagged this at HIGH severity** in REFACTOR-130; this batch-Y sidecar primary-sources the consequence from the email-sender side.

**Evidence**:
- `EmailNotificationSender.java:56` — `emailSender.send(mimeMessage)` blocking call
- `NotificationConfiguration.java:51-72` — JavaMailSender factory; Properties bag has no timeouts
- REFACTOR-130 from batch C (the upstream-rooted finding)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-018 (fail-fast at boot) is silent on SMTP-specific timeouts; the @PostConstruct validators check blank/empty/<0 but not timeout-set.
- No ADR defends absence of SMTP timeouts; refactoring gap.

**Proposed remedy**:

1. **Path A (set JavaMail Properties at boot)** — Add to `NotificationConfiguration.java:61-69` Properties bag:
   ```java
   props.put("mail.smtp.connectiontimeout", "5000");
   props.put("mail.smtp.timeout", "30000");
   props.put("mail.smtp.writetimeout", "30000");
   ```
   Sensible defaults; hardcoded.

2. **Path B (operator-tunable)** — Add config keys `notifications.receivers.email.connect-timeout-ms` / `request-timeout-ms` / `write-timeout-ms` flowing into the Properties bag. Validate at @PostConstruct.

Path B is recommended (matches Path D of REFACTOR-515). Path A is the minimum.

**Severity rationale**: HIGH — duplicate-of-shape with REFACTOR-130 (the original batch-C finding) + REFACTOR-515 (HTTP-side equivalent) — together these are the cluster-wide stall risk for the Notifications subsystem.

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family).

---
