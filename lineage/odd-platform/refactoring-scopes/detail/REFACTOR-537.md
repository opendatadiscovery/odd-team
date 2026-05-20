## REFACTOR-537 — Email `From` header derived implicitly from `JavaMailSender.setUsername` (= `notifications.receivers.email.sender`) — no allowlist, no domain-match, no SPF/DKIM consideration; operator with config-modification capability can set From to any address

**Severity**: LOW
**Category**: missing-validation + spoofing-surface
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel), P-09-security-access-control]

**Surfaced by**:
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "**No `helper.setFrom(...)` call — From header derived implicitly from JavaMailSender.setUsername** — line 47-53 uses MimeMessageHelper but never sets From. JavaMail's default behaviour: if From is unset, the message takes the session's `mail.from` property OR the JavaMailSender's username (`emailProperties.getSender()` at NotificationConfiguration.java:55) as the envelope From. Operator-visible result: the From header on outgoing alerts equals the `notifications.receivers.email.sender` value — but this isn't documented in this class nor in the live doc. Spoofing prevention: an attacker with config-write capability could set `sender` to any address; no allowlist, no domain-match, no SPF/DKIM consideration (those are SMTP-relay-side concerns)."

**Statement**: The `From` header on outgoing alerts equals `emailProperties.getSender()` (`notifications.receivers.email.sender` config key). No explicit `helper.setFrom(...)` call in `EmailNotificationSender.java`. JavaMail's default behaviour derives From from the session's `mail.from` or the username.

No platform-side validation:
- No allowlist of accepted From domains
- No domain-match check
- No SPF/DKIM consideration (those are SMTP-relay concerns)

An operator with config-modification capability can set From to any address — including spoofed addresses claiming to be other services / brands. The SMTP relay (with SPF/DKIM/DMARC) provides the only protection.

**Threat model**: Config-write capability is required (higher-privilege than user authentication). Severity is bounded; the platform's role is bounded by what SMTP-relay-side enforcement can catch.

**Evidence**:
- `EmailNotificationSender.java:46-53` — no setFrom
- `NotificationConfiguration.java:55` — `setUsername` is the only sender-flow

**Proposed remedy**:

1. **Path A (boot-time domain validation)** — Validate `notifications.receivers.email.sender` matches a regex like `[^@]+@[^@.]+\.[^@]+` at `@PostConstruct`. Throw on invalid.

2. **Path B (allowlist of permitted From domains)** — Add `notifications.receivers.email.allowed-from-domains: List<String>` (operator-tunable). At boot, validate the sender's domain is in the list. Optional.

Path A is the SHIP-FAST minimum.

**Severity rationale**: LOW — config-modification threat model bounds severity; SMTP-relay-side controls (SPF/DKIM) are the operator's primary defence.

**Suggested backlog grouping**: `Notifications email hardening`.

---
