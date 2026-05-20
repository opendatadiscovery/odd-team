## REFACTOR-524 — `MimeMessageHelper` constructed without explicit charset — JVM default charset (US-ASCII on minimal Linux containers) mangles non-ASCII alert content; requires JVM env-var workaround (`JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8`)

**Severity**: MEDIUM
**Category**: missing-charset + i18n + jvm-default-leak
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications email channel)]

**Surfaced by**:
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — "**MimeMessageHelper construction does NOT specify charset** — line 47 `new MimeMessageHelper(mimeMessage)` (1-arg constructor) defaults to the JVM default charset. Spring's MimeMessageHelper offers a 2-arg `(mimeMessage, encoding)` and 3-arg constructors that take an encoding string; neither is used. Result: a JVM started without `-Dfile.encoding=UTF-8` (e.g. a containerised deployment that did not set `JAVA_TOOL_OPTIONS`) renders non-ASCII alert content (e.g. data entity names with international characters) in whatever the platform default charset is — usually US-ASCII on minimal Linux containers, mangling the body. Live doc captures the JAVA_TOOL_OPTIONS workaround but does not point at this code line as the origin."

**Statement**: `EmailNotificationSender.java:47`:
```java
final MimeMessageHelper helper = new MimeMessageHelper(mimeMessage);
```
The 1-arg constructor defaults charset to JVM default. Spring's `MimeMessageHelper(MimeMessage, String encoding)` 2-arg constructor or `MimeMessageHelper(MimeMessage, boolean multipart, String encoding)` 3-arg constructor would let the code specify UTF-8 explicitly.

**Result**: A JVM started without `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` (e.g. typical minimal Linux container with `JAVA_HOME=/opt/jdk` and no global env-vars) renders non-ASCII alert content (e.g. `customer_数据_dashboard` or `pipeline_müller_prod`) in US-ASCII or platform-default charset, mangling the body.

The live doc captures the `JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8` workaround but does NOT point at `EmailNotificationSender.java:47` as the origin — operators reading the doc see the workaround but cannot easily evaluate whether the fix lives in code or in deployment-config.

**Evidence**:
- `EmailNotificationSender.java:47` — 1-arg constructor (no charset)
- Live doc `configuration-and-deployment/odd-platform#enable-alert-notifications` (workaround documented)
- Spring's `MimeMessageHelper` API (offers 2-arg / 3-arg constructors with charset)

**Proposed remedy**:

1. **Path A (one-line fix)** — Change to `new MimeMessageHelper(mimeMessage, StandardCharsets.UTF_8.name())`. Explicit UTF-8 regardless of JVM default. Workaround becomes unnecessary.

2. **Path B (defence-in-depth)** — Path A + add boot-time assertion in `NotificationConfiguration` that `Charset.defaultCharset()` is UTF-8 (or log a WARN). Operators see the misconfig at boot.

Path A is the SHIP-FAST minimum.

**Severity rationale**: MEDIUM — operator-visible content mangling for non-ASCII deployments; doc workaround exists but the code fix is one line; common containerised deployments hit this by default.

**Suggested backlog grouping**: `Notifications hardening sprint`.

---
