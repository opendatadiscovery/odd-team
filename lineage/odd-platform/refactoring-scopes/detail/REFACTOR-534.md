## REFACTOR-534 — Sequential per-recipient SMTP I/O with NO connection pooling — N recipients = N SMTP connect/STARTTLS/auth/send/disconnect cycles per alert; ~500ms+ per-alert for 5 recipients

**Severity**: LOW
**Category**: performance + no-conn-pool
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel throughput)]

**Surfaced by**:
- `EmailNotificationSender.md:performance.known_performance_gaps.[0]` (MEDIUM) — "**Sequential per-recipient SMTP I/O with no connection pooling** — for N recipients, N independent SMTP connect/STARTTLS/auth/send/disconnect cycles. A platform with `notification.emails: 'a@x.com,b@y.com,c@z.com,d@w.com,e@v.com'` performs 5 SMTP handshakes per alert. For a 100ms-per-connection relay, that's ~500ms minimum per alert just for email."
- `EmailNotificationSender.md:performance.known_performance_gaps.[2]` (MEDIUM) — "**No batching / no BCC fan-out** — for a platform with 50 internal recipients, the code performs 50 SMTP sends rather than one SMTP send with 50 BCC recipients. The latter would reduce per-alert SMTP overhead by ~50x. Live doc recommends 'use distribution lists on the SMTP side for fan-out' — the platform code does not offer in-app BCC."

**Statement**: `JavaMailSenderImpl` default behaviour opens a fresh SMTP transport per `send()` call. With N recipients, the per-recipient loop at `EmailNotificationSender.java:54-57` triggers N independent SMTP handshakes (connect + STARTTLS + auth + send + disconnect). For a 100ms-RTT relay, 5 recipients = ~500ms per alert just on SMTP overhead.

The platform code does NOT use BCC fan-out (one SMTP send with N BCC recipients) — even though the live doc recommends "distribution lists on the SMTP side for fan-out."

**Evidence**:
- `EmailNotificationSender.java:54-57` — per-recipient send loop
- `NotificationConfiguration.java:51-72` — JavaMailSender factory; no `mail.smtp.connectionpool*` properties

**Proposed remedy**:

1. **Path A (in-app BCC fan-out)** — Use `helper.setBcc(recipients.toArray(new String[0]))` for a single MimeMessage with N BCC recipients. One SMTP send per alert. Matches live-doc recommendation operationally (recipients are on the BCC line, not To).

2. **Path B (SMTP connection pooling)** — Configure `mail.smtp.connectionpool*` properties on the JavaMailSenderImpl bean. Reuse the SMTP connection across alerts.

3. **Path C (both A + B)** — Maximum efficiency.

Path A is the SHIP-FAST optimization (1 SMTP send per alert instead of N).

**Severity rationale**: LOW — performance optimization; not security-critical; bounded impact on high-recipient deployments.

**Suggested backlog grouping**: `Notifications throughput optimization`.

---
