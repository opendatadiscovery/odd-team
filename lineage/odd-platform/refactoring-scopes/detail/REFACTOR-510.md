## REFACTOR-510 — Publication-name DDL identifier injection at `CREATE PUBLICATION` statement — operator-config string interpolated via `String.formatted(...)` without validation/escaping

**Severity**: MEDIUM
**Category**: missing-validation + ddl-injection + operator-config-trust
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control]

**Surfaced by**:
- `NotificationSubscriber.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**`registerPublication` interpolates publication-name + table-name via `String.formatted(...)` into a CREATE PUBLICATION DDL** — line 151: `\"CREATE PUBLICATION %s FOR TABLE %s\".formatted(walProperties.getPublicationName(), tableName)`. PG identifiers are NOT parameterisable in prepared statements, so the interpolation is structurally required, but no validation/escaping is applied. ... A pathological config value (`'odd_alert; DROP TABLE alert; --'`) would inject."
- `NotificationSubscriber.md:security.known_security_gaps.[0]` (LOW) — "Publication-name SQL-injection surface at L151 — `CREATE PUBLICATION` DDL interpolates the operator-configured `notifications.wal.publication-name` value via `String.formatted(...)`. PG identifier-escape rules + the platform's no-validation stance mean a pathological config value would inject. The attack vector requires operator-config modification (already a higher-privilege threat model than ODD authentication), so severity is bounded."

**Statement**: At `NotificationSubscriber.java:151`:
```java
final String createPublicationSql = "CREATE PUBLICATION %s FOR TABLE %s"
    .formatted(walProperties.getPublicationName(), tableName);
```
PG identifiers cannot be passed as parameters to PreparedStatement (DDL-side limitation); the interpolation is structurally required. But the `walProperties.getPublicationName()` value flows directly from operator config (`notifications.wal.publication-name`) via Spring `@Value` resolution, with NO escaping, NO whitelist validation, NO PG-identifier-rule check at boot time.

A pathological value like `'odd_alert; DROP TABLE alert; --'` would inject — the resulting DDL becomes `CREATE PUBLICATION odd_alert; DROP TABLE alert; -- FOR TABLE alert.alert`, which PG parses as two statements + a comment.

The attack vector requires write access to either (a) `application.yml`, (b) the operator's env-var configuration, or (c) Spring Boot's `/actuator/refresh`-style live-reload (not enabled by default in ODD but common in operator deployments). The threat model is "an attacker with config-modification capability" — which is already a higher-privilege threat than ODD's user authentication.

The asymmetric design: the PROBE statement at L133 (`SELECT EXISTS (SELECT oid FROM pg_publication WHERE pubname = ?)`) IS parameterised (PreparedStatement). Only the CREATE statement at L151 is interpolated.

**Evidence**:
- `NotificationSubscriber.java:151` — the interpolation
- `NotificationSubscriber.java:133-135` — the parameterised probe (asymmetric pair)
- `NotificationSubscriber.java:42-45` — the source of `walProperties` (Spring `@ConfigurationProperties`)
- `NotificationsProperties.java:13-18` — the POJO with `publicationName: String` field

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-018 (fail-fast at boot — 5-sidecar cross-feature) — the implied prescription is to validate `publicationName` at `@PostConstruct` time, throwing `IllegalStateException` if it does NOT match PG identifier rules.
- ADR-CANDIDATE-018 is silent on identifier-class validation (the existing batches' validators check blank/empty/<0 — not identifier-syntax).

**Proposed remedy**:

1. **Path A (boot-time validation)** — Add `@PostConstruct` validation to `NotificationsProperties` that asserts `publicationName.matches("[a-zA-Z_][a-zA-Z0-9_]{0,62}")` (PG identifier rule: alphanumeric + underscore, max 63 chars, start with letter/underscore). Throw `IllegalStateException` on mismatch.

2. **Path B (escape at write)** — Use `DSL.name(publicationName).toString()` (jOOQ's identifier escape) instead of raw interpolation at line 151. jOOQ handles PG identifier quoting via `"..."` syntax.

3. **Path C (defence in depth)** — Both. Validate AT BOOT (fast failure for misconfiguration) AND escape AT WRITE (defence-in-depth against future bypass).

Path C is the recommended approach. Path A alone catches misconfigs early; Path B alone hardens the write path; together they ensure both the boot-time fast-failure and the runtime-safe DDL.

**Severity rationale**: MEDIUM — operator-config-modification threat model bounds severity; the attack requires write access to config (already higher-privilege than user auth); but the lack of any defence is a structural hardening gap.

**Suggested backlog grouping**: `Notifications hardening sprint` (REFACTOR-508 family) + `Configuration-properties validation hardening` (cross-link with ADR-CANDIDATE-018's narrow-validator family).

---
