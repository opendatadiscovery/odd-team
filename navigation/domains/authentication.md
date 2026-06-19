# Authentication

OAuth2, LDAP, login form, session management (in-memory/PostgreSQL/Redis), RBAC.

## Code Entry Points (odd-platform)

### Auth Configurations
- `odd-platform-api/.../config/DisabledAuthSecurityConfiguration.java` — `auth.type=DISABLED`
- `odd-platform-api/.../config/LoginFormSecurityConfiguration.java` — `auth.type=LOGIN_FORM`
- `odd-platform-api/.../config/OAuthSecurityConfiguration.java` — `auth.type=OAUTH2`
- `odd-platform-api/.../config/LDAPSecurityConfiguration.java` — `auth.type=LDAP`

### Auth Package
- `odd-platform-api/.../auth/` — auth managers, extractors, logout handlers, conditions
- `odd-platform-api/.../auth/condition/AuthorizationManagerCondition.java` — conditional auth manager loading
- `odd-platform-api/.../auth/logout/OAuthLogoutSuccessHandler.java` — Generic OAuth logout handler (e.g., Cognito redirect)
- `odd-platform-api/.../auth/logout/AzureLogoutSuccessHandler.java` — Azure-specific logout handler (`@Conditional(AzureCondition.class)`); builds redirect from `provider.getLogoutUri()` — **NPE if `logout-uri` unset**

### OAuth2 Providers (from code — application.yml lines 66-156)
- Cognito: `provider=cognito`, supports admin-groups, logout-uri
- GitHub: `provider=github`, supports organization-name, admin-teams
- Google: `provider=google`, supports allowed-domain
- Okta: generic OIDC provider
- Keycloak: generic OIDC provider, supports `pkce` option
- Azure AD: `provider=azure`, supports multi-tenant and single-tenant, admin-groups — **UNDOCUMENTED**
- Custom OIDC: any issuer-uri based provider

### S2S (Server-to-Server) Authentication
- Config: `auth.s2s.enabled` (default: false), `auth.s2s.token`
- Header: `X-API-Key: {token}`
- Code: `auth/S2sTokenProvider.java` (the `@Value`-injected token + `isValidToken`), `auth/filter/S2sAuthenticationFilter.java` (`@Component implements WebFilter`)
- **GOTCHA:** `S2sAuthenticationFilter` is a GLOBAL WebFilter (no `@ConditionalOnProperty`) — it runs on EVERY request under EVERY auth mode, including DISABLED (not only the 3 real modes' `.addFilterAt`). Was the PLT-001 NPE/DoS surface (#1765, fixed CTRIB-022 — null-guard); PLT-228 = optional registration-gating follow-up.
- Docs: `docs/configuration-and-deployment/enable-security/authentication/s2s.md` (s2s IS documented; doc-precision drift on the DISABLED mechanism → DOC-469)

### Ingestion Auth Filter
- Config: `auth.ingestion.filter.enabled` (default: false)
- When disabled (default), ingestion endpoints are unprotected even with auth enabled
- **UNDOCUMENTED** — security-critical gap

### RBAC / Policies
- Policy JSON schema: resource types (DATA_ENTITY, TERM, MANAGEMENT), condition operators (all, any, eq, not_eq, match, not_match, is, not_is)
- `odd-platform-api/.../dto/policy/PolicyConditionKeyDto.java` — condition field definitions
- User roles: USER, ADMIN
- Owner roles: managed via Management UI

### Session Providers
- IN_MEMORY, INTERNAL_POSTGRESQL, REDIS
- Config: `session.provider` in application.yml

### Permissions (from OpenAPI spec, 75 entries)
See `odd-platform-specification/components.yaml` lines 160-235 for canonical list (the `Permission` enum).
Documented at `docs/configuration-and-deployment/enable-security/authorization/permissions.md`; page carries a generator hint linking back to the enum so drift is visible.

## Tests
<!-- To be populated -->

## Documentation
- `docs/configuration-and-deployment/enable-security/` — 12 pages covering auth and authz
- Key issue: OKTA env var copy-paste bug (provider=google), permissions list outdated

## Related Domains
- management (users, roles, permissions)
- collaboration (authenticated users own entities)
