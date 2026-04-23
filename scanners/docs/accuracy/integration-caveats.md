---
id: docs/accuracy/integration-caveats
target_repo: odd-platform (local) + odd-collectors (local) + documentation (local: ../documentation)
scope: Every external SDK / client integration — verify each builder parameter is configured or safely-defaulted, and that unsafe defaults are documented as caveats
estimated_items: 10-20 integrations (one per bean factory / SDK builder)
chunking: One integration per session; group related ones (all auth providers, all storage backends)
depends_on: []
priority: critical
---

## Purpose

Catch the DOC-008 class of bug: a documented feature whose correctness silently depends on an SDK default that is unsafe or surprising in ODD's deployment context. These bugs are invisible to YAML-level scanners (the config file reads fine) and to controller-level feature scanners (the service chain behaves fine). They only surface at the SDK-builder site, where a missing `.region(...)` or a missing `.timeout(...)` becomes an operator's production incident.

**The reference case is MinIO:** `MinioConfig.java` builds an async client with `.endpoint()`, `.credentials()`, and `.build()`. It never calls `.region(...)`. The MinIO Java SDK defaults region to `us-east-1` for SigV4 signing. Every AWS S3 bucket outside `us-east-1` therefore fails with `AuthorizationHeaderMalformed` or `PermanentRedirect` — silently, from the operator's perspective, because the doc claims "use any S3-compatible endpoint". This scanner would have flagged `.region(...)` as a caveat-defaulted parameter the moment the attachment doc was drafted.

## Method

For each integration in scope (list below):

### Step 1 — Locate the bean factory / client builder

Check `navigation/domains/{domain}.md` first. If the navigation file does not list the bean factory, **that is itself a navigation gap** — add it to the domain file before continuing.

For Java (Spring), the bean factory is usually `@Configuration`-annotated with `@Bean` methods constructing the client. For Python (pydantic / typer CLI), it is the model / typed-settings consumer + the SDK call site.

### Step 2 — Enumerate every builder parameter

For each client / SDK builder, list every parameter the SDK accepts (not just the ones this code sets). Consult the SDK's official documentation for the exhaustive parameter list. Example for `MinioAsyncClient.builder()`:

```
.endpoint(String url)
.credentials(String accessKey, String secretKey)
.region(String region)
.httpClient(OkHttpClient client)
```

### Step 3 — Classify each parameter

| Status | Meaning | Action |
|--------|---------|--------|
| `configured from {config.key}` | explicitly set from a documented key | none — verify the doc covers the key |
| `safely defaulted — {rationale}` | SDK default is acceptable in ODD's deployment context, and that context is a reasonable default for operators (e.g., HTTP client defaults for a typical LAN connection) | brief mention in the doc, or leave as SDK-default understood |
| `caveat-defaulted — {limitation}` | SDK default is unsafe / surprising / project-context-dependent — operators can hit it without warning | **finding**: document as a known limitation (admonition block, dedicated section); log a platform-side fix candidate if the code can be improved |

### Step 4 — Verify documentation coverage

For every parameter marked `caveat-defaulted`, grep the documentation repo for any mention of the limitation. If absent, the finding is critical: operators have no way to know the caveat exists until it hits production.

### Step 5 — Verify error / retry / timeout behavior

For each integration, open any explicit error handler, retry interceptor, or timeout configuration in the platform code (not just the SDK's). Undocumented behavior that changes operator expectations — silent drops, unbounded retries, unexpected timeouts — is a finding.

## Integrations in scope

Not exhaustive — add as new integrations land. One session per integration is the target.

### Platform (odd-platform)

- **Storage / Attachments**: `MinioConfig.java` → `MinioAsyncClient` (S3 / MinIO). Check: region, httpClient (timeout / TLS), path-style access, chunked-upload size.
- **Email notifications**: `MailSenderAutoConfiguration` / `JavaMailSenderImpl`. Check: TLS mode, connection timeout, auth failure behavior, character encoding, bounce handling.
- **Slack notifications**: Slack webhook client. Check: timeout, retry on 5xx, base-URL configurability.
- **OAuth2 / OIDC — Google / Keycloak / Okta / Azure AD / generic**: Spring Security OAuth2 client. Check: PKCE, scope defaults, clock-skew tolerance, userinfo endpoint behavior, token refresh, logout URL handling.
- **LDAP**: `LdapContextSource` / `LdapTemplate`. Check: TLS, referral handling, bind timeout, connection pool.
- **Session store — Redis**: Spring Session / Lettuce. Check: TLS, connection pool, timeout, eviction policy assumed.
- **Session store — INTERNAL_POSTGRESQL**: R2DBC pool settings, migration requirements.
- **Tracing — OTLP exporter**: OTLP gRPC / HTTP client. Check: endpoint, TLS, batch size, timeout, retry, sampler defaults.
- **Database — R2DBC**: pool size, statement timeout, SSL mode.
- **Secrets backend — AWS SSM / Vault**: `AwsSsmSecretsBackend` (or equivalent). Check: region, credentials resolution chain, IAM policy assumptions, caching behavior.
- **AlertManager webhook**: HTTP client for AlertManager POSTs. Check: timeout, retry, TLS.

### Collectors (odd-collectors)

- **Boto3 clients (AWS adapters)**: Region resolution order, credentials chain, retry mode, endpoint override.
- **Azure SDK clients**: Authentication mode, endpoint selection, retry.
- **GCP SDK clients**: Credentials (ADC vs. service account), region.
- **Snowflake connector**: Session parameters, account / warehouse defaults, TLS.
- **Databricks SDK**: Authentication mode, workspace / account selection.
- **dbt artifact parsing**: Schema version handling — does the adapter fail gracefully on newer / older dbt?

## Criteria for a Finding

- An SDK builder leaves a parameter at the SDK default, and that default is unsafe / surprising / context-dependent
- An integration silently ignores a config key the doc claims is respected
- An integration hardcodes a value the doc claims is configurable
- Error / retry / timeout behavior materially affects operators and is undocumented
- Credentials / TLS / region defaults that are unsafe in the documented deployment context
- Navigation domain file does not list the bean factory / SDK builder (meta-finding — fix the navigation gap in the same PR as the scan)

## Output

Write to: `findings/docs-accuracy-integration-caveats/YYYY-MM-DD-{integration}.md`

Per integration, include:
- Integration name and bean factory `file:line`
- **Parameter table** — every SDK builder parameter, its status, its effective default, and its operator-facing consequence
- For every `caveat-defaulted` parameter: the current doc coverage (quote if any, "none" if absent), proposed fix, platform-side fix candidate (if applicable)
- Severity scale: **critical** (data loss, security exposure, region lock-in, silent auth failure in production), **high** (unexpected timeouts, silent retries, surprising ergonomic defaults), **medium** (minor caveats that any operator would expect from the SDK's own docs)

## Navigation updates

Every bean factory / SDK builder discovered during the scan must be recorded in the relevant `navigation/domains/{domain}.md` under a dedicated **"Bean factories and SDK builders"** subsection. Future scans and implements depend on this — the Quality Bar's consumer-read responsibility is only practical if navigation lists them.
