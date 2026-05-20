## REFACTOR-517 — No URI scheme allowlist / SSRF guard on `notifications.receivers.{slack,webhook}.url` — operator config accepts `file:`, `gopher:`, RFC1918, link-local, IMDS URIs verbatim; JDK HttpClient is the only runtime guardrail

**Severity**: MEDIUM
**Category**: scheme-enforcement + ssrf + missing-validation
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications HTTP channels), P-09-security-access-control]

**Surfaced by**:
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "**No URI scheme allowlist / no SSRF guard at sender layer (inherited from boot-side gap).** The slackWebhookUrl is bound at NotificationConfiguration.java:77 as raw `java.net.URI` via `@Value`, with only an empty-string check at L81-83. THIS class accepts the URI verbatim and invokes `HttpRequest.newBuilder().uri(slackWebhookUrl)` at line 44 — no scheme allowlist (operator can configure `file:` or `gopher:` and only the JDK HttpClient rejection at send-time prevents the request), no host allowlist (operator can configure `http://169.254.169.254/...` for AWS instance-metadata, `http://localhost:NNNN/...` for loopback services, or any RFC1918 address)."
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "**NO URL allowlist / scheme guard / SSRF defence — operator-supplied URL is trusted verbatim.** `NotificationConfiguration.java:94` rejects only empty strings; the URI parser at line 91 accepts any syntactically-valid URI (`file://`, `gopher://`, RFC1918, link-local, `http://localhost`). The JDK HttpClient at runtime will reject non-`http(s)` schemes at send-time, but no boot-time guard prevents a misconfigured URL from being instantiated."

**Statement**: Operator-supplied URLs flow into the sender beans without validation:
- `notifications.receivers.slack.url` -> `NotificationConfiguration.java:77` @Value -> `SlackNotificationSender.java:27` URI field
- `notifications.receivers.webhook.url` -> `NotificationConfiguration.java:91` @Value -> `WebhookNotificationSender.java:11` URI field

Both bean factories check only `url.toString().isEmpty()` (NotificationConfiguration.java:81-83, 94-96). No scheme allowlist (no `URI.getScheme().matches("https?")` check). No host allowlist. No IMDS / RFC1918 / link-local rejection.

**Attack surface**: An operator with config-modification capability (via `application.yml` edit, env-var injection, or Spring Cloud Config refresh) can set:
- `file:///etc/passwd` — file scheme (JDK HttpClient rejects but no boot-time signal)
- `http://169.254.169.254/latest/meta-data/iam/security-credentials/` — AWS IMDS endpoint
- `http://localhost:8500/v1/agent/services` — Consul agent
- `http://10.0.0.50/admin` — RFC1918 internal service
- `gopher://example.com/...` — non-HTTP scheme

For most of these the JDK HttpClient throws at send-time, but the request DOES leak the existence + service identification to the operator's own logs. For RFC1918 / loopback URLs the request succeeds (no JDK guard), making SSRF reachable.

**Threat model**: The attack vector requires write access to ODD's config — already a higher-privilege threat than user authentication. Severity is therefore bounded; but a defence-in-depth posture would reject suspicious schemes at boot.

**Evidence**:
- `NotificationConfiguration.java:77, 81-83` — Slack URL @Value + empty check
- `NotificationConfiguration.java:91, 94-96` — Webhook URL @Value + empty check
- `SlackNotificationSender.java:27, 44` — URI accepted verbatim, used directly in HttpRequest builder
- `WebhookNotificationSender.java:11, 20` — same

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-018 (fail-fast at boot) is silent on URI scheme validation; precedent for adding such validation exists.
- No ADR defends absence of scheme allowlist; refactoring gap.

**Proposed remedy**:

1. **Path A (boot-time scheme allowlist)** — At `@PostConstruct` validation in `NotificationsProperties`, assert `url.getScheme().matches("https?")`. Throw `IllegalStateException` on mismatch. Fast failure.

2. **Path B (host allowlist for sensitive scenarios)** — Add `notifications.receivers.http.allowed-hosts: List<String>` config (operator-tunable). Reject URLs whose host is not in the allowlist. Allows operators to lock down to known relay hosts.

3. **Path C (IMDS / RFC1918 / link-local denylist)** — At boot, parse the URL host + reject if matches sensitive ranges (169.254.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, ::1, fe80::/10). DNS-resolution-time check (an operator-supplied hostname might resolve to RFC1918 at runtime).

Path A is the SHIP-FAST minimum. Path C is the defence-in-depth structural fix.

**Severity rationale**: MEDIUM — operator-config-modification threat model; severity bounded; refactoring gap not defended by ADR.

**Suggested backlog grouping**: `Notifications hardening sprint`.

---
