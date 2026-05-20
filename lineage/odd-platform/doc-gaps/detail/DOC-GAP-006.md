- **DOC-GAP-006**: `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page (**REFINED batch D**: Spring Boot 3.4.10's `show-values: NEVER` default DOES mask values; the durable leak surface is Lombok-toString — see DOC-GAP-067)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:security.known_security_gaps`
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[2]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Attachment Storage Configuration is comprehensive on storage backends and known limitations BUT contains NO warning about Spring Boot Actuator `/actuator/env` exposure surfacing `attachment.remote.access-key` / `attachment.remote.secret-key` keys.
    - attachment-config-prefix.md sidecar surfaces this as severity HIGH.
    - **Batch D refinement (2026-05-12)**: Per `ODDLDAPProperties.md` primary-source verification — Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` default DOES sanitise `/actuator/env` (the secret values appear as `******`). The durable leak vector is NOT actuator-env (the actuator surface is partially protected by default); it is Lombok `@Data`-generated `toString()` if any code path logs the Properties bean. Need to verify whether the attachment-storage POJO (if any) is similarly `@Data`-decorated — likely yes by pattern. The actuator-env framing remains valid as a defence-in-depth concern (operators with externally-reachable actuator endpoints leak the key NAMES even when values are masked, and `show-values: NEVER` is operator-overridable).
  - **Proposed doc action**: Cross-link with F-054 (DOC-163) — when authoring the F-054 fix on Spring Boot Actuator, include a paragraph on attachment-storage credential exposure: "The default `management.endpoints.web.exposure.include` exposes `/actuator/env`. Spring Boot 3.4.10 masks credential VALUES by default (`management.endpoint.env.show-values: NEVER`), so resolved values appear as `******` — but the *key names* themselves (`attachment.remote.access-key`, `attachment.remote.secret-key`, `auth.oauth2.client.client-secret`, etc.) are still returned, confirming the configuration shape. **Additionally**, if any Spring `@ConfigurationProperties` POJO bound to these keys uses Lombok `@Data` (the platform's default pattern), the auto-generated `toString()` includes the credential field — any code path that logs the bean (or any future `log.debug("config = {}", properties)` addition) emits the credential verbatim, bypassing actuator masking entirely. For production deployments: (1) override the exposure list to drop `env`, or move Actuator to a separate management port; (2) ensure Properties classes carrying credentials use `@ToString.Exclude` on sensitive fields (see DOC-GAP-067)."
  - **Cross-references**:
    - **F-054** in `findings/docs-coverage-undocumented-features/2026-05-08.md` — same gap, broader scope (fold this finding into F-054's authoring as a sub-bullet)
    - **DOC-GAP-050** (LDAP `auth.ldap.password` leak — same actuator-vs-Lombok refinement; 2026-05-12C + D)
    - **DOC-GAP-067 (NEW batch D — META)** — Lombok-toString sensitive-field leak class; 4-sidecar triangulated
  - **Severity rationale**: HIGH — operationally-reachable Actuator + S3 credentials shape is a security-deployment footgun even with the value mask (key-name disclosure + `show-values` operator-overridable + Lombok-toString bypass).

## Batch X append

#### Batch 2026-05-20-X STRENGTHENS — credential-leak surface extended from 1-credential-family (S3 only) to 5-credential-family across 4-sidecar triangulation

Batch X surfaces FOUR config-class sidecars (LoginFormSecurityConfiguration + R2DBCConfiguration + MinioConfig + NotificationConfiguration) that all converge on the same `/actuator/env` exposure surface. The original DOC-GAP-006 was framed as "S3/MinIO credentials" leak; batch X reveals the leak spans FIVE distinct credential families:

| Credential family | Sidecar | Source | Default-masking match? | Verbatim exposed? |
|---|---|---|---|---|
| `spring.datasource.password` | R2DBCConfiguration (NEW batch X) | L35 | YES (`password`) | NO (substring-masked) |
| `spring.custom-datasource.password` | R2DBCConfiguration (NEW batch X) | L58 | YES (`password`) | NO (substring-masked; no test asserts masking) |
| `attachment.remote.access-key` + `.secret-key` | MinioConfig (NEW batch X) | L14-17 | YES (`key`, `secret`) | NO (substring-masked) |
| **`auth.login-form-credentials`** | LoginFormSecurityConfiguration (NEW batch X) | L70 | **NO** — field name has NO masking substring | **YES — ENTIRE user credential string exposed verbatim** |
| `notifications.receivers.email.password` | NotificationConfiguration (NEW batch X) | L57-58 | YES (`password`) | NO (substring-masked) |
| **`notifications.receivers.slack.url`** | NotificationConfiguration (NEW batch X) | L77 | **NO** — `url` not in mask list | **YES — Slack incoming-webhook URL is a bearer credential, exposed verbatim** |
| **`notifications.receivers.webhook.url`** | NotificationConfiguration (NEW batch X) | L91 | **NO** — `url` not in mask list | **YES — generic webhook URL exposed verbatim** |

**Eight credential surfaces across 4 config classes. THREE of them are EXPOSED VERBATIM** under Spring Boot's default `EnvironmentEndpoint` masking (the substring matchers `password`/`secret`/`key`/`token` don't match the key names `auth.login-form-credentials`, `slack.url`, `webhook.url`).

The doc-product action expands from the original DOC-GAP-006 framing ("S3 credentials only") to a CROSS-CREDENTIAL-FAMILY framing. Per DOC-GAP-223 (NEW batch X) the canonical doc-side action is:

1. **`documentation/docs/configuration-and-deployment/odd-platform.md`** (the management-endpoints section): replace the existing management-endpoint exposure documentation with the explicit credential-leak warning enumerating the 8 surfaces.
2. **`documentation/docs/configuration-and-deployment/enable-security/README.md`**: add a cross-page "Credential-leak surfaces" sub-section.
3. **`documentation/docs/configuration-and-deployment/operational-hardening.md`** (NEW PAGE): the canonical home for the DOC-GAP-053 META class of findings.

The code-side recommended fix (per DOC-GAP-223) is bounded: one `application.yml` line change (`include: 'health, prometheus, info'` — remove `env`) closes the bulk of the issue across all 5 credential families.

**The auth-mode compositional surface**:
- Under `auth.type=DISABLED`: `/actuator/env` is ANONYMOUSLY reachable via `DisabledAuthSecurityConfiguration.java:13-18` `.anyExchange().permitAll()` — every credential surface is exposed to any network-reachable caller
- Under `auth.type=OAUTH2/LDAP`: `/actuator/**` is WHITELISTED via `SecurityConstants.WHITELIST_PATHS:95-96` — same as DISABLED at the actuator path
- Under `auth.type=LOGIN_FORM`: `/actuator/env` requires authentication (per `LoginFormSecurityConfiguration.java:49-51` permittedPaths NOT including `/actuator/env`), but any of the configured LOGIN_FORM credentials authenticates and ALL form-authenticated users have ADMIN authority (per DOC-GAP-218) — so the entire credential set leaks to every operator who knows another operator's credentials

**Three of four auth modes have `/actuator/env` anonymously reachable**. The compound with DOC-GAP-218 (LOGIN_FORM AuthorizationCustomizer absent) means even under the only "authentication-required" mode (LOGIN_FORM), the credentials leak to any authenticated user.

**The `pg_dump` adjacent credential-leak path** (cross-batch composition with DOC-GAP-221): under `session.provider=INTERNAL_POSTGRESQL`, the session attribute payload is Java-serialised into `SPRING_SESSION_ATTRIBUTES.attribute_bytes` (BYTEA). `pg_dump` of the platform database exfiltrates every authenticated session's attribute map. This is the SECOND credential-leak path beyond `/actuator/env`.

**The Lombok-toString adjacent path** (cross-batch reference to DOC-GAP-067): any future `@Data`-annotated `@ConfigurationProperties` class would leak credentials via `log.info("config={}", config)` calls. NotificationConfiguration's `EmailSenderProperties` is NOT currently `@Data`-annotated (per NotificationConfiguration sidecar evidence) but the field is bound as a plain `String` — defence-in-depth fragile.

**Severity escalates to HIGH** (was HIGH already; the credential-family expansion strengthens the impact). The doc-side action is bounded (one new page + cross-references). The code-side action is one `application.yml` line. The operator-impact-prevented is the platform's entire credential-exposure surface.

**Coherence**: strengthens=1 (DOC-GAP-006 expanded), supersedes=0, conflicts_surfaced=0. Cross-link to DOC-GAP-067 (Lombok-toString) and DOC-GAP-221 (pg_dump session-attribute) as the THREE leak paths in the platform.
