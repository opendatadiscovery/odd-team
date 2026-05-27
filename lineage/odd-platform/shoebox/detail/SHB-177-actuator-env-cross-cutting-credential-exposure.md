# SHB-177 — Spring Boot Actuator `/env` exposure default-on; cross-cutting credentials enumeration surface

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators running ODD inherit a Spring Boot Actuator default that exposes `/actuator/env`, `/actuator/health`, `/actuator/prometheus`, and `/actuator/info` on the SAME HTTP port as the application — and `/actuator/env` enumerates every resolved property value including S3 credentials (`attachment.remote.access-key/secret-key`), LDAP bind password (`auth.ldap.password`), OAuth2 client secret (`auth.oauth2.client.*.client-secret`), R2DBC database password (`spring.datasource.password`), and the platform's `spring.custom-datasource.password`. Spring Boot 3.4+ masks values matching `password|secret|key|token` key-name patterns by default — so the VALUES render as `******` rather than cleartext — but the KEY NAMES and the *presence* of every configured credential leak, the JDBC URL host:port:database-name is unmasked, and the masking is one operator-configuration mistake away from breaking (`management.endpoint.env.show-values=ALWAYS`). The actuator path is in `SecurityConstants.WHITELIST_PATHS` so it's reachable unauthenticated regardless of `auth.type` mode.

## Evidence

- `odd-platform-api/src/main/resources/application.yml:226-242` — `management.endpoints.web.exposure.include: health, prometheus, env, info`; `management.endpoint.env.enabled: true`; `management.endpoint.env.show-values: WHEN_AUTHORIZED` (Spring Boot 3.4+ default behaviour for value display is per-endpoint config; actual default since SB 3.4 is `NEVER` unless explicitly set).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` includes `/actuator/**` — the actuator surface is reachable BEFORE auth in every mode (DISABLED + LOGIN_FORM + OAUTH2 + LDAP).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:14-17` — `@Value("${attachment.remote.access-key}")` and `secret-key` bound to plain Strings; via `@Data` Lombok all fields visible to actuator.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/properties/ODDLDAPProperties.java:10,14` — `@Data` on the Properties class generates a `toString()` that includes `password` field verbatim. No `@ToString.Exclude`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/properties/ODDOAuth2Properties.java:30,34` — `@Data` on the nested `OAuth2Provider` POJO + `private String clientSecret` with NO `@ToString.Exclude`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/R2DBCConfiguration.java:35,58` — `dataSourceProperties.getPassword()` + `@Value("${spring.custom-datasource.password:}")`; both bound; both reachable through env actuator key-matching.
- `odd-platform-api/src/main/resources/application.yml:7` — `spring.datasource.password: odd-platform-password` (shipped default; an operator that forgets to override deploys with a well-known credential).
- `bash grep 'keys-to-sanitize' <odd-platform-repo>` returns zero matches; the platform relies entirely on Spring Boot's built-in `password|secret|key|token` substring masking defaults.

## Notes

- **Cross-cutting hypothesis: every credential the platform binds via `@Value` or `@ConfigurationProperties` is in the actuator surface.** A complete enumeration: (1) `spring.datasource.password`, (2) `spring.custom-datasource.password`, (3) `attachment.remote.access-key`, (4) `attachment.remote.secret-key`, (5) `auth.ldap.password`, (6) `auth.ldap.username`, (7) `auth.oauth2.client.*.client-secret`, (8) the GenAI provider API keys (per F-039 surface), (9) Slack OAuth tokens (Data Collaboration surface), (10) Notifications HMAC secret (per F-009), (11) the collector ingestion tokens — wait, those live in PG not in `@Value`, so they're not in `/env`; they ARE in `/actuator/health` if a health indicator queries them.
- **Masking is defence-in-depth, not contract.** Spring Boot 3.4+ defaults `show-values=NEVER` (or `WHEN_AUTHORIZED` per Spring docs at that version). An operator who downgrades for debugging (or who pre-3.4 inherits the older `ALWAYS` default) instantly leaks every cleartext credential. No platform-side test asserts the masking covers every key the platform binds. No platform-side override hardens the default beyond what Spring Boot supplies.
- **Field-name leak is the unfixable part.** Even with values masked, `/actuator/env` reveals the SCHEMA of which credentials are configured: an attacker who scrapes `/actuator/env` under `auth.type=DISABLED` (whitelisted regardless) learns that the deployment uses OAuth2 with Google + Azure clients (because `auth.oauth2.client.google.*` and `auth.oauth2.client.azure.*` keys appear), that LDAP is wired (because `auth.ldap.*` keys appear), that REMOTE attachment storage is configured (because `attachment.remote.*` keys appear). This is deployment fingerprinting beyond what `/api/appInfo` (SHB-173) exposes.
- **The JDBC URL leak is unmasked.** `spring.datasource.url=jdbc:postgresql://prod-pg.internal.example.com:5432/odd-platform` — the host:port:database-name doesn't match `password|secret|key|token`, so it renders verbatim. An attacker scanning a network learns the PG location.
- **`management.server.port` is unset.** The actuator runs on the same HTTP port as the application — no operator can split actuator onto an internal-only port without a deliberate config change. `application.yml` ships no `management.server.port`. The deployment-discipline mitigation is operator-side firewall / ingress rule.
- **LDAP `@Data` + `toString()` is a defence-in-depth gap.** A future log line `log.info("loaded properties: {}", properties)` emits the LDAP password verbatim. No platform-side `@ToString.Exclude` discipline. Same gap for OAuth2 `clientSecret`.
- This is the textbook "drift facet that names a feature" per BRIEFING.md heuristic 5. The drift is on the operator-observable surface "what is the deployment's exposed configuration metadata"; no F-NNN anchors this. The feature candidate: `F-NNN — Management Endpoint Exposure & Credential Handling`.
- Related: SHB-173 (deployment fingerprint via `/api/appInfo`); SHB-174 (S3 credentials specifically); REFACTOR-029 (per-sidecar refactoring scope); R2DBCConfiguration sidecar security.data_exposure[1].

## Next

1. **Graduate** — `F-NNN — Operator Management-Endpoint Exposure Surface`. Pillar P-09 (security) + P-08 (admin). Subjects: SecurityConstants.WHITELIST_PATHS + application.yml management block + every config-class binding credentials + the Lombok `@Data` toString pattern + the LDAP/OAuth/MinIO/R2DBC `@ToString.Exclude` gaps.
2. **Open follow-ups**:
   - SEC-NNN — add `@ToString.Exclude` (Lombok) on every `password|secret|key|token` field across ODDLDAPProperties / ODDOAuth2Properties.OAuth2Provider / any other `@Data`-annotated Properties class. Defence-in-depth against future log lines.
   - SEC-NNN — restrict `management.endpoints.web.exposure.include` to `health, prometheus` by default; require operators to opt-in to `env, info` exposure.
   - DOC-NNN — add an operator-page admonition on the security page: "ODD ships actuator endpoints (env, health, prometheus, info) on the main HTTP port with public whitelisting; for production, configure a separate `management.server.port` and restrict it to internal callers."
   - PERF-NNN (not perf — sec) — add a startup self-check that scans every `@Value`-bound credential against the actuator masker's pattern; fail-fast or warn if a key would render unmasked.
3. **Probe** — boot a default-config platform and `curl localhost:8080/actuator/env`. Capture the JSON keys to confirm the enumeration above. Verify that `show-values` defaults to `NEVER` empirically.
4. **DOC-NNN** — every `*.md` config-key reference page (attachment storage, LDAP, OAuth2, database) needs an admonition naming the actuator-env exposure as part of the operator threat model.

## Links

- cluster_with: [SHB-173, SHB-174, F-029]
- merged_into: F-122
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — SECURITY load-bearing. Evidence: 7+ file:line citations across config classes + Properties classes + R2DBC + SecurityConstants + application.yml. Minted F-122 (P-09:F-008 Management-Endpoint Exposure & Credential Handling). Cluster_with [SHB-173, SHB-174, F-029] preserved — F-119 (just-minted SHB-173 graduation) carries the AppInfo fingerprint; F-122 carries the broader actuator schema fingerprint.
