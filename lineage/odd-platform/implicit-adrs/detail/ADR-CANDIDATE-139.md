## ADR-CANDIDATE-139 — `IngestionDataEntitiesFilter` is the SOLE defender of `POST /ingestion/entities` — ORTHOGONAL to the four UI auth modes (DISABLED/LOGIN_FORM/OAUTH2/LDAP) which all explicitly PERMIT the path. When the filter is OFF (default), there is NO fallback authentication — unlike the SecurityWebFilterChain (which has SECURITY_RULES as a backup against `@PreAuthorize` omissions), ingestion auth has only ONE LAYER

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-09-security-access-control, P-10-integrations-ingestion]
**Support count**: 1 sidecar (batch O IngestionDataEntitiesFilter — class-level layer); cross-batch confirmed by every `*SecurityConfiguration` sidecar (batch C — LoginFormSecurityConfiguration + OAuthSecurityConfiguration + LDAPSecurityConfiguration + DisabledAuthSecurityConfiguration all explicitly permit `/ingestion/entities` or `/ingestion/**`)
**Axes present**: filters, auth_mode_configurations
**Batch**: O (2026-05-19)

**Surfaced by**:
- `IngestionDataEntitiesFilter.md:implicit_adrs.[3]` (HIGH) — "When the toggle is OFF, the path is ORTHOGONALLY permitted by every UI auth mode — ingestion auth is the SOLE defender, not a layered defender" — evidence: LoginFormSecurityConfiguration.java:49-51 (`permittedPaths` includes `/ingestion/entities` + `/ingestion/datasources`) + SecurityConstants.java:95-96 (`WHITELIST_PATHS = {..., "/ingestion/**", ...}`) + AuthorizationCustomizer.java:22 (`pathMatchers(SecurityConstants.WHITELIST_PATHS).permitAll()`) + DisabledAuthSecurityConfiguration.java:13-18 (`.anyExchange().permitAll()`) + SecurityConstants.java:98-355 (no SECURITY_RULES entry for `/ingestion/entities`) — intent_anchor: "the cross-cutting permit pattern is deliberate. The Ingestion API contract is HTTP-public-but-token-authenticated; embedding it inside the SecurityWebFilterChain's per-permission authorization model would require a synthetic Permission, a per-datasource ResourceExtractor, and a non-trivial AuthorizationManager — the maintainer instead chose a dedicated WebFilter that intercepts BEFORE the SecurityWebFilterChain's authorize step. The trade-off: when the filter is off, there is NO fallback defense."
- `IngestionDataEntitiesFilter.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Default-OFF posture leaves `POST /ingestion/entities` UNAUTHENTICATED on a bundled deployment — this is the LARGEST single security exposure in the platform's default deployment posture. `application.yml:48` ships `auth.ingestion.filter.enabled: false`; `IngestionDataEntitiesFilter.java:20` has `havingValue="true"` and NO `matchIfMissing`; therefore the bean is not registered, and the SecurityWebFilterChain explicitly permits `/ingestion/entities` (LoginFormSecurityConfiguration.java:50; SecurityConstants.WHITELIST_PATHS line 96; DisabledAuthSecurityConfiguration line 13-18) under all four UI auth modes."

**Decision statement**: ODD's `POST /ingestion/entities` endpoint is **defended SOLELY** by `IngestionDataEntitiesFilter` — a WebFlux `WebFilter` that intercepts BEFORE the SecurityWebFilterChain's authorize step. The four UI authentication modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) ALL **explicitly PERMIT** the ingestion path:

- **DISABLED** (the shipped default) — `DisabledAuthSecurityConfiguration.java:13-18` calls `.anyExchange().permitAll()` (REFACTOR-185 — the 15+1-sidecar triangulation)
- **LOGIN_FORM** — `LoginFormSecurityConfiguration.java:49-51` lists `/ingestion/entities` + `/ingestion/datasources` as exact-path permitted paths
- **OAUTH2 + LDAP** — `AuthorizationCustomizer.java:22` calls `pathMatchers(SecurityConstants.WHITELIST_PATHS).permitAll()` where `SecurityConstants.WHITELIST_PATHS` (line 96) contains `/ingestion/**`

Authentication on this endpoint is **EXCLUSIVELY** the filter's responsibility, regardless of `auth.type`. The architectural choices encoded:

- **(a) The Ingestion API is "HTTP-public-but-token-authenticated"** — a deliberate decoupling from the UI authentication model. Collectors are S2S agents (machine-to-machine), not human users in a session. Their authentication model (bearer tokens, per-datasource, plaintext-equality) is structurally different from UI sessions (cookies, OAuth2 tokens, LDAP bind). The maintainer chose to express the distinction at the WebFilter layer — a dedicated filter that runs orthogonally to the SecurityWebFilterChain.
- **(b) The decoupling avoids a synthetic Permission for ingestion** — embedding ingestion-auth in the SECURITY_RULES table would require: (i) a synthetic Permission (e.g., `INGEST_DATA_ENTITY`); (ii) a per-datasource `ResourceExtractor` that resolves the datasource by the body's `dataSourceOddrn`; (iii) a custom `AuthorizationManager` that performs the token-compare. The complexity would be higher than a dedicated WebFilter; the maintainer chose the simpler filter.
- **(c) The trade-off is NO fallback defence-in-depth** — the SecurityWebFilterChain has SECURITY_RULES as a backup against `@PreAuthorize` omissions on the UI/API surface (ADR-CANDIDATE-002). Ingestion auth has only the one filter layer. When the toggle is OFF, the endpoint is open. There is no second-layer defence.
- **(d) Defence-in-depth via `auth.s2s.enabled=true` is the only fallback today** — when S2S is enabled, the `S2sAuthenticationFilter` runs BEFORE the SecurityWebFilterChain's authorize step. A request carrying a valid S2S `X-API-Key` header reaches `POST /ingestion/entities` regardless of the IngestionDataEntities filter's state. The live S2S doc page recommends combining S2S with `auth.ingestion.filter.enabled=true` for defence-in-depth — a pairing the platform does NOT enforce.
- **(e) The pattern is CONSISTENT with `S2sAuthenticationFilter`** — both the ingestion filter and the S2S filter are dedicated WebFilters that defend via shared-secret tokens, orthogonal to the UI auth modes. The naming (`*AuthenticationFilter` for S2S, `*Filter` for ingestion) is the only differentiation; the architecture is identical.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — every UI security config independently lists `/ingestion/entities` as PERMITTED. This is a deliberate cross-mode commitment, NOT an oversight in any one mode. The maintainer wrote the permit entries 4 times (once per security config) AND wrote the filter class with `@ConditionalOnProperty(havingValue="true")` + explicit `false` default in YAML. The "permit-and-let-the-filter-decide" pattern is the architectural statement.
2. **Structural impact?** YES — affects every ingestion deployment's security posture; affects the maintainer-extension contract (any new `/ingestion/*` endpoint MUST decide whether to add a filter sibling or rely on the SecurityWebFilterChain — the choice has consequences); affects the operator's mental model (the `auth.type` value does NOT control ingestion auth — the operator MUST also know about `auth.ingestion.filter.enabled`).
3. **Switching to SecurityWebFilterChain-integrated ingestion auth is REFACTORING or STRUCTURAL?** STRUCTURAL — moving ingestion auth into SECURITY_RULES would require: (i) synthetic Permission; (ii) per-datasource ResourceExtractor; (iii) custom AuthorizationManager performing token-compare; (iv) integration with the per-mode AuthorizationCustomizer; (v) per-mode test coverage. A multi-week structural refactor of the entire ingestion-auth model.

**Evidence**:
- IngestionDataEntitiesFilter.java:20 (`@Component` + `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` — NO `matchIfMissing`)
- application.yml:48 (`auth.ingestion.filter.enabled: false` — explicit literal)
- LoginFormSecurityConfiguration.java:49-51 (`permittedPaths` includes `/ingestion/entities` + `/ingestion/datasources`)
- SecurityConstants.java:95-96 (`WHITELIST_PATHS = {..., "/ingestion/**", ...}`)
- AuthorizationCustomizer.java:22 (`pathMatchers(SecurityConstants.WHITELIST_PATHS).permitAll()`)
- DisabledAuthSecurityConfiguration.java:13-18 (`.anyExchange().permitAll()`)
- SecurityConstants.java:98-355 (NO SECURITY_RULES entry for `/ingestion/entities`)
- S2sAuthenticationFilter.java:17-48 (the sibling S2S filter — same architectural pattern, orthogonal to UI modes)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-002** (centralised SECURITY_RULES — this ADR specifies the WHY of the SECURITY_RULES table NOT covering `/ingestion/entities`). **Composes with ADR-CANDIDATE-027** (ingestion-token opt-in via filter — this ADR specifies the consequence of the opt-in default). **Composes with ADR-CANDIDATE-006** (AlertManager network-delegated auth — sibling pattern: another `/ingestion/*` endpoint that the SecurityWebFilterChain permits; AlertManager has NO filter at all; the trust-gradient is operator-network-delegated → opt-in-filter-protected → unconditionally-filter-protected). **Composes with ADR-CANDIDATE-029** (DISABLED-as-default — the DISABLED mode's `.anyExchange().permitAll()` is the FIRST permit-all-the-path; the ingestion filter is the SOLE defender even under DISABLED). **Composes with ADR-CANDIDATE-036** (mode-agnostic Authorization — every UI mode permits the ingestion path uniformly).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-204 (existing, STRENGTHENED) — default-off unauthenticated ingestion at controller side (HIGH)
- REFACTOR-205 (existing, STRENGTHENED) — cross-tenant ingestion under filter-OFF (HIGH)
- REFACTOR-185 (existing, STRENGTHENED to 16-sidecar) — DISABLED-mode bypass + ingestion-filter-off compound
- REFACTOR-417 NEW — Hard-coded path matcher means /entities/batch or /v2 would silently bypass (MEDIUM)

**Proposed action**: Promote to `adrs/drafts/ingestion-auth-orthogonal-sole-defender.md` (new ADR). Document:
- The filter as the SOLE defender of `/ingestion/entities`.
- The cross-mode permit pattern (every UI mode permits the path).
- The trade-off: no fallback defence-in-depth when the filter is off.
- The defence-in-depth pairing recommendation: combine with `auth.s2s.enabled=true` for S2S `X-API-Key` fallback.
- The maintainer-extension contract: any new `/ingestion/*` endpoint MUST decide where on the trust gradient it lives.
- The operator-mental-model surface: explain to operators that `auth.type` does NOT control ingestion auth.

**Severity rationale**: HIGH — security-architecture-defining decision. Affects every ingestion deployment's security posture under every UI auth mode. The sole-defender-when-off characteristic is the LARGEST single security exposure in default deployments (REFACTOR-204 + REFACTOR-205 + REFACTOR-185 — the 16-sidecar triangulation). Future maintainers proposing per-endpoint auth model changes must understand this decision.

---
