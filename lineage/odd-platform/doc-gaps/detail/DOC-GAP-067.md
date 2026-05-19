- **DOC-GAP-067**: **META-FINDING** — Lombok `@Data` toString sensitive-field leak class (4-sidecar triangulated)
  - **Category**: drift (meta)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDLDAPProperties.md:bugs_limitations_corner_cases.[0]` + `:security.known_security_gaps.[0]` (HIGH) — `password` field via `@Data` (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:bugs_limitations_corner_cases.[3]` + `:security.known_security_gaps.[0]` (MEDIUM) — `clientSecret` field via `@Data` on nested `OAuth2Provider` (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[3]` + `:security.known_security_gaps.[0]` (MEDIUM) — SMTP `password` field via `@Data` (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md` (batch C — pattern initial detection)
    - `concepts.yaml:invariants[Lombok-toString sensitive-field leak]` (4-sidecar triangulated invariant, version 5)
  - **Evidence**:
    - Pattern: every `@ConfigurationProperties` POJO that binds a credential / secret / token uses Lombok `@Data` without `@ToString.Exclude` annotations. Specific instances verified:
      - `ODDLDAPProperties.java:10,14` — `@Data` on class + `private String password` field, no `@ToString.Exclude`
      - `ODDOAuth2Properties.java:30,34` — `@Data` on nested `OAuth2Provider` + `private String clientSecret` field, no `@ToString.Exclude`
      - `EmailSenderProperties.java:6-10` — `@Data` on class + `private String password` field, no `@ToString.Exclude`
      - `NotificationsProperties.java` (per batch-C sidecar) — same pattern
    - Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` default DOES mask credential values in `/actuator/env` responses (so actuator-env is partially mitigated by the framework), BUT this masking is bypassable two ways: (a) operator overrides `show-values` to `WHEN_AUTHORIZED` or `ALWAYS`; (b) `Spring Boot's '/actuator/configprops` may sanitise differently per field. The DURABLE leak vector is the Lombok-generated `toString()` — `log.info("properties = {}", properties)` or any debug-rendering of the bean emits the credential in plaintext, bypassing actuator masking entirely. WebFetch of each LDAP / OAuth2 / Login-form / Notifications docs page 2026-05-12 confirms NONE of the four pages warns operators about logging the Properties bean.
  - **Proposed doc action**: Three-part action.
    1. **Doc-side**: add a "Logging discipline" admonition to EACH affected page (`enable-security/authentication/ldap.md`, `oauth2-oidc.md`, `login-form.md`, `features/active-platform-features/notifications.md`): "**Do not log Properties beans verbatim**. The ODD Platform's `@ConfigurationProperties` classes for credentials (LDAP password, OAuth2 client secret, SMTP password, etc.) use Lombok `@Data`, which auto-generates a `toString()` method that includes every field — including the credential. Code that calls `log.info(\"properties = {}\", properties)` or that serialises the bean via Jackson without `@JsonIgnore` annotations emits the credential in cleartext to your log aggregator. This is independent of Spring's actuator masking (which protects the `/actuator/env` endpoint by default). For audit-required deployments, configure your log aggregator to redact patterns matching `password=`, `clientSecret=`, `client-secret=`."
    2. **Code-side upstream**: file `/log-issue odd-platform` to add `@ToString.Exclude` to every credential field across the four POJOs. Recommended fix per POJO:
       - `ODDLDAPProperties.password` → `@ToString.Exclude`
       - `ODDOAuth2Properties.OAuth2Provider.clientSecret` → `@ToString.Exclude`
       - `EmailSenderProperties.password` → `@ToString.Exclude`
       - `NotificationsProperties` (per batch-C sidecar — verify field names)
    3. **Pillar-side meta-recommendation**: add to `pillars/documentation/gates.md` an explicit reviewer checklist item: "For any feature that documents `@ConfigurationProperties` credential keys (passwords, tokens, secrets), verify the docs include a Logging-discipline caveat referencing the Lombok-toString leak class."
  - **Cross-references**:
    - DOC-GAP-006 (attachment S3 credentials — same shape, likely same Lombok `@Data` pattern in the attachment Properties class — flag for sidecar coverage in a future batch)
    - DOC-GAP-050 (LDAP password — primary refinement target; this META finding generalises it)
    - LSN-001 / LSN-002 — defaults-not-documented class
    - Drives `/log-issue odd-platform` upstream for `@ToString.Exclude` audit across all `@ConfigurationProperties` POJOs holding credentials
  - **Severity rationale**: HIGH (meta) — 4-sidecar triangulation. The pattern is cross-cutting (4+ doc pages affected); a single class-level mitigation (audit `@ToString.Exclude` coverage on all Properties POJOs) closes the gap structurally. Spring Boot's framework-default masking creates a false sense of security — operators who verify actuator-env is masked may not check log output, and the Lombok-toString leak persists invisibly until a debug-logging line is added in a future commit. Same LSN-001 shape: a default that's safe today but unsafe under any future code addition.
