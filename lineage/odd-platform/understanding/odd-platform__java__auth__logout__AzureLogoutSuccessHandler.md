---
node_id: "odd-platform java auth logout:AzureLogoutSuccessHandler"
node_kind: provider-logout-success-handler
axis: auth_logout_handlers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-batch-O
---

# AzureLogoutSuccessHandler — semantic understanding

## understanding

`AzureLogoutSuccessHandler` is the Azure-specific branch of the `OAuthLogoutSuccessHandler` chain-of-responsibility dispatch (`OAuthLogoutSuccessHandler.java:36-38` → `getLogoutHandler(provider).map(handler -> handler.handle(...))`). When a user authenticated under an Azure OAuth2 client invokes the platform's logout endpoint, this handler runs: it sets HTTP 302 (`AzureLogoutSuccessHandler.java:35`), constructs an Azure-side logout URL by appending `post_logout_redirect_uri` (the inbound HTTP request's base URI per `UriUtils.getBaseUri`) and `client_id` to the operator-configured `provider.getLogoutUri()` (lines 38-44), writes that URL into the `Location` header (line 46), then invalidates the local `WebSession` to drop the platform-side OAuth2 token store (line 47). The class is `@Conditional(AzureCondition.class)` (line 21) — only registered when at least one configured `auth.oauth2.client.*.provider` value matches `AZURE` (case-insensitive) per `AbstractProviderCondition.getRegisteredProviders` (`AbstractProviderCondition.java:15-22`). The implementation answers the four orchestrator-prompt questions as: (a) NO server-side token revocation — only the local Spring `WebSession` is invalidated; (b) NO Azure end_session_endpoint discovery — the `logoutUri` is operator-supplied verbatim, no `/.well-known/openid-configuration` lookup; (c) NO platform-side allowlist on `post_logout_redirect_uri` — the value is derived from the inbound request URI's host/scheme (Host-header-derived, see drift facet); (d) NO logout-time cleanup of `search_facets` rows — the `search_facets` table has no user binding (`V0_0_1__init.sql:204-211`), so the row survives logout and is reaped only by the `SearchFacetsHousekeepingJob` TTL eviction (default 30 days per F-010 / `housekeeping.ttl.search_facets_days`).

## concepts

- entities: [
    "`AzureLogoutSuccessHandler` (the `@Component` `@Conditional(AzureCondition.class)` class implementing `LogoutSuccessHandler`; `AzureLogoutSuccessHandler.java:20-23`)",
    "`LogoutSuccessHandler` (the ODD-internal interface — NOT Spring's `ServerLogoutSuccessHandler` — declaring `boolean shouldHandle(String provider)` + `Mono<Void> handle(WebFilterExchange, Authentication, ODDOAuth2Properties.OAuth2Provider)`; `LogoutSuccessHandler.java:8-14`)",
    "`AzureCondition` (the Spring `Condition` that activates the bean only when an `auth.oauth2.client.*.provider == AZURE` exists; `AzureCondition.java:10-15` + `AbstractProviderCondition.java:11-23`)",
    "`Provider.AZURE` (the enum constant matched by `shouldHandle`; `Provider.java:3-5`)",
    "`ODDOAuth2Properties.OAuth2Provider` (the per-client config POJO this handler reads via `provider.getLogoutUri()` + `provider.getClientId()`; `ODDOAuth2Properties.java:31-53`)",
    "`UriUtils.getBaseUri(URI)` (the static helper that derives the scheme+host+port from the inbound request URI, replacing path/query/fragment with `/`; `UriUtils.java:11-23`)",
    "`UriComponentsBuilder` (Spring's URL builder that produces the Azure end-session URL with appended query params and UTF-8 encoding; lines 38-44)",
    "`WebSession::invalidate` (the Spring WebFlux Mono that drops the in-memory session including the OAuth2 token store; line 47)",
    "`OAuthLogoutSuccessHandler` (the dispatcher that delegates to this handler when the active `OAuth2AuthenticationToken`'s registration's `provider == 'azure'`; `OAuthLogoutSuccessHandler.java:30-42`)"
  ]
- operations: [
    "`shouldHandle(provider)` — return true when the dispatched provider name matches `Provider.AZURE.name()` case-insensitively (`AzureLogoutSuccessHandler.java:26-28`)",
    "`handle(exchange, authentication, provider)` — orchestrate the Azure logout flow: status 302 + construct Azure end-session URL + set Location header + invalidate session (`AzureLogoutSuccessHandler.java:31-48`)",
    "construct-azure-end-session-url — `UriComponentsBuilder.fromUri(URI.create(provider.getLogoutUri())).queryParam('post_logout_redirect_uri', UriUtils.getBaseUri(requestUri)).queryParam('client_id', provider.getClientId()).encode(UTF_8).build().toUri()` (lines 38-44)",
    "derive-post-logout-redirect — `UriUtils.getBaseUri(requestUri)` strips the inbound request's path/query/fragment, returning scheme+host+port+`/` (`UriUtils.java:11-22`)",
    "invalidate-local-session — `exchange.getExchange().getSession().flatMap(WebSession::invalidate)` (line 47) — terminal Mono that the OAuth2 logout pipeline subscribes to"
  ]
- invariants:
  - "Bean exists only when at least one `auth.oauth2.client.*.provider=AZURE` is configured — `@Conditional(AzureCondition.class)` gates registration (`AzureLogoutSuccessHandler.java:21` + `AzureCondition.java:10-15` + `AbstractProviderCondition.java:15-22`)"
  - "`handle()` makes NO null-check on `provider.getLogoutUri()` — line 39 calls `URI.create(provider.getLogoutUri())` which throws `NullPointerException` when its argument is null per the JDK contract (verified: `java.net.URI.create(String)` calls `new URI(str)` which throws NPE on null). The sibling `CognitoLogoutSuccessHandler.java:33-35` carries the matching guard (`if (StringUtils.isEmpty(provider.getLogoutUri())) return Mono.empty();`); Azure does not."
  - "Session invalidation is the only platform-side cleanup — there is NO call to revoke the Azure access/refresh/id token at Microsoft Graph or the Azure token endpoint (compare: `GoogleLogoutSuccessHandler.java:43-54` calls `oauth2.googleapis.com/revoke`; `GithubLogoutSuccessHandler.java:51-63` calls `DELETE /applications/{client_id}/grant`). Tokens issued by Azure remain valid at Azure until their natural TTL expires; if the user's browser retained the token (e.g. a non-HttpOnly localStorage copy harvested by an attacker), it would still work against any other resource the user had consented for."
  - "`post_logout_redirect_uri` is computed from the INBOUND request URI's Host header (`UriUtils.getBaseUri(requestUri)`) — there is NO server-side allowlist of allowed redirect targets, no validation of the Host header against a configured platform base URL, no enforcement that the redirect domain is the platform itself. A misconfigured reverse proxy that forwards a user-controlled Host header would cause the Azure logout to redirect the browser to that attacker-controlled domain after Azure's logout completes (Azure's own validation of `post_logout_redirect_uri` against its registered Web/SPA redirect URIs is the only remaining guard — see drift facet #2)."
  - "Azure NEVER returns a `null` Logout URI via discovery in this code path — the `provider.getLogoutUri()` is the operator-configured `auth.oauth2.client.{key}.logout-uri` raw String per `ODDOAuth2Properties.OAuth2Provider.java:43`. The platform performs no Azure OIDC discovery (`/.well-known/openid-configuration`) to obtain `end_session_endpoint`; the discovery happens inside Spring at boot for `authorization_endpoint`/`token_endpoint` only if `issuer-uri` is configured. The Azure end-session endpoint is operator-supplied verbatim."
  - "HTTP status is hardcoded 302 FOUND (`response.setStatusCode(HttpStatus.FOUND)` at line 35) — not 303 SEE OTHER. Per RFC 7231 §6.4.3, 302 is the historical redirect that browsers conventionally treat as 303 for the response method (the original request was POST to `/logout` per Spring Security; the browser-side GET to Azure's end-session URL is what 302 implies). Acceptable for an OAuth2 logout redirect; consistent with sibling handlers (Cognito, ODD_IAM, Google, Github all use `HttpStatus.FOUND`)."
  - "The dispatch path is: `OAuthLogoutSuccessHandler.onLogoutSuccess(exchange, authentication)` (`OAuthLogoutSuccessHandler.java:31-42`) → `if (authentication instanceof OAuth2AuthenticationToken oauthToken) → properties.getClient().get(providerId).getProvider()` → `getLogoutHandler(provider).map(handler -> handler.handle(exchange, authentication, oAuth2Provider))`. The handler chain is `List<LogoutSuccessHandler>` injected (`OAuthLogoutSuccessHandler.java:19,23`), filtered by `shouldHandle(provider)`. If no handler matches, fallback is the OIDC-initiated default (`defaultOidcLogoutHandler` bean wired at `OAuthSecurityConfiguration.java:180-183` to `OidcClientInitiatedServerLogoutSuccessHandler`)."
- audiences: [
    "Spring Security WebFlux logout machinery — invokes `OAuthLogoutSuccessHandler.onLogoutSuccess` after the SecurityContext is cleared on POST `/logout`",
    "Azure AD (Microsoft Entra ID) — receives the 302 Location header pointing at the operator-configured `logout-uri` with query params `post_logout_redirect_uri` + `client_id`",
    "End-user's browser — receives the 302 to Azure; after Azure clears its session it re-redirects to the `post_logout_redirect_uri` value (assuming Azure-side allowlisting passed)",
    "Operators deploying ODD Platform with `auth.type=OAUTH2` + at least one `auth.oauth2.client.{key}.provider=azure` configured"
  ]

## dependencies_semantic

- requires-feature:
  - "**P-09:F-001 UI Authentication (OAUTH2 mode)** — this handler exists ONLY in OAUTH2 auth.type (the OAuthLogoutSuccessHandler dispatcher carries `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"OAUTH2\")` at `OAuthLogoutSuccessHandler.java:16`); per live doc `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` WebFetched 2026-05-19 status 200, Azure AD is one of 7 documented OAuth2/OIDC providers"
  - "**Spring Security 6 reactive logout pipeline** — `WebFilterExchange`, `Authentication`, `Mono<Void>` signatures; the handler plugs into Spring's `ServerLogoutSuccessHandler` chain via the `OAuthLogoutSuccessHandler` dispatcher"
  - "**ODD provider-routing convention** — the `LogoutSuccessHandler` interface (NOT Spring's `ServerLogoutSuccessHandler`) declares `boolean shouldHandle(String provider)`; same idiom as `OAuthUserHandler.shouldHandle` for user enrichment dispatch — established at `OAuthSecurityConfiguration.java:79-80,185-201`"
- requires-config:
  - "`auth.type=OAUTH2` — gates the dispatcher (`OAuthLogoutSuccessHandler.java:16`). Without OAUTH2, this handler is registered as a `@Component` but never invoked because the dispatcher does not exist in the bean container."
  - "`auth.oauth2.client.{key}.provider=AZURE` (or `azure`, case-insensitive) — activates `AzureCondition` per `AbstractProviderCondition.java:15-22`. Without an Azure entry, the bean is not registered."
  - "`auth.oauth2.client.{key}.logout-uri` — REQUIRED for Azure per live doc WebFetched 2026-05-19 status 200 (`'logout-uri must be set for Azure SSO. ... An unset logout-uri raises a NullPointerException and the logout flow returns a 500 response.'`). The handler dereferences `provider.getLogoutUri()` at line 39 with no null-guard."
  - "`auth.oauth2.client.{key}.client-id` — REQUIRED (validated at `ODDOAuth2Properties.java:22-24`). Sent as `client_id` query param to Azure end-session endpoint."
- requires-runtime:
  - "Spring WebFlux reactive stack — `Mono<Void>` return, non-blocking session invalidation"
  - "Reachable Azure end-session endpoint at the operator-supplied URL (typically `https://login.microsoftonline.com/{tenant_id_or_organizations}/oauth2/v2.0/logout`)"
  - "Azure-side configuration: the `post_logout_redirect_uri` value (the platform's base URL derived from the inbound Host header) MUST be registered in the Azure App Registration's `Redirect URIs` (Web platform `Logout URL` field) per Azure's standard rejection of unregistered post-logout redirect targets; this is operator-side Azure portal configuration NOT enforced by the platform"
  - "In-memory `WebSession` store (Spring default — no shared Redis / Hazelcast session store wired per `OAuthSecurityConfiguration.java:1-269` absence of `@EnableSpringWebSession` bean)"
- couples-to:
  - "`OAuthLogoutSuccessHandler` — the dispatcher that selects this handler via `getLogoutHandler(provider)` at line 44-48"
  - "`AzureCondition` + `AbstractProviderCondition` — boot-time gate"
  - "`ODDOAuth2Properties.OAuth2Provider` — the typed config POJO read at runtime for `logoutUri` + `clientId`"
  - "`UriUtils.getBaseUri` — utility that derives the post-logout redirect from the inbound request"
  - "Sibling handlers (`CognitoLogoutSuccessHandler`, `GithubLogoutSuccessHandler`, `GoogleLogoutSuccessHandler`, `ODDIAMLogoutSuccessHandler`) — same `List<LogoutSuccessHandler>` injection, same `shouldHandle` filter idiom"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "`shouldHandle('azure')` / `shouldHandle('AZURE')` / `shouldHandle('Azure')` returns true (case-insensitive match) — no test"
  - "`shouldHandle('cognito')` returns false — no test"
  - "`handle()` issues 302 with correct Location URL containing `post_logout_redirect_uri` + `client_id` query params — no test"
  - "`handle()` invalidates the WebSession — no test asserts the session is cleared after the redirect is set"
  - "NPE on null `provider.getLogoutUri()` — no test exercises the documented requirement, no boot-time validation rejects the misconfiguration, no integration test catches the runtime failure (the NPE manifests only at first logout attempt by an Azure user)"
  - "post_logout_redirect_uri reflects the inbound Host header — no test asserts what happens when a proxy forwards a malicious Host header"
  - "`AzureCondition` activates the bean only when at least one Azure provider is configured — no test asserts the bean is absent for non-Azure deployments"
  - "Order with the OAuth2 dispatcher — no test asserts that `OAuthLogoutSuccessHandler.getLogoutHandler('azure')` resolves to THIS handler (not Cognito / Google / etc.)"
- test_files: []
- gaps: |
    `find <odd-platform-repo>/odd-platform-api/src/test -name '*Logout*.java' -o -name '*Azure*.java'` returned zero matches at enrichment time. The entire `auth/logout/` package has ZERO test coverage — 6 production classes (5 provider handlers + 1 dispatcher), 0 test files. The two highest-leverage regressions:
    (1) A future refactor that removes the `OAuthLogoutSuccessHandler.shouldHandle` dispatch indirection (e.g. moving to a `Map<Provider, LogoutSuccessHandler>` lookup) could silently regress provider matching — no integration test catches this.
    (2) A future addition of a 6th provider (Okta / Keycloak per docs) without the corresponding handler will silently fall through to `defaultOidcLogoutHandler` — no test asserts the documented provider set has a handler. The CognitoLogoutSuccessHandler's `StringUtils.isEmpty(provider.getLogoutUri())` guard pattern is inconsistent with the other handlers — a regression test asserting fail-fast behaviour OR consistent silent-skip behaviour would lock the choice as deliberate.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source per the file-wide convention (verified by Read of all 49 lines).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc"
    anchor: ""
    rationale: "The OAuth2/OIDC sub-page is the canonical documentation home for `auth.oauth2.client.*` Azure configuration including the `logout-uri` parameter that this handler consumes."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` on 2026-05-19 (status 200):
    > Parameter: `auth.oauth2.client.{client-id}.logout-uri`. Value: The Azure AD OpenID Connect logout endpoint. For single-tenant deployments: `https://login.microsoftonline.com/{azure_tenant_id}/oauth2/v2.0/logout`. For multi-tenant: `https://login.microsoftonline.com/organizations/oauth2/v2.0/logout`.
    > Requirement: Yes, it is mandatory. The documentation states: 'logout-uri must be set for Azure SSO. The Azure-specific logout handler calls URI.create(provider.getLogoutUri()); leaving logout-uri unset raises a NullPointerException and the logout flow returns a 500 response.'
    > end_session_endpoint discovery mechanism: Not documented. The page does not mention Azure's OpenID Connect discovery endpoint (`/.well-known/openid-configuration`) providing an `end_session_endpoint` value, nor any mechanism for ODD Platform to auto-discover this endpoint.
    > post_logout_redirect_uri whitelisting: Not documented. The documentation does not address whether operators must whitelist redirect URIs on the Azure side after logout, nor any Azure portal configuration related to post-logout redirection.
- doc_drift_findings:
  - "**Azure logout-uri NPE — operationally documented but not platform-enforced.** The live OAuth2/OIDC docs state explicitly that `logout-uri must be set for Azure SSO` and that 'leaving logout-uri unset raises a NullPointerException and the logout flow returns a 500 response' (WebFetch 2026-05-19 status 200). The code at `AzureLogoutSuccessHandler.java:39` confirms this exactly: `URI.create(provider.getLogoutUri())` is called with no null-guard. The validator at `ODDOAuth2Properties.java:17-28` checks ONLY `clientId` and `provider` for non-empty — `logoutUri` is unchecked. The drift is operator-visible: docs say it's required, the platform boots successfully without it, the failure is deferred to runtime. **STRENGTHENS** the existing batch-K finding at the ODDOAuth2Properties sidecar (`bugs_limitations_corner_cases[0]` HIGH severity) by anchoring the consumer site at `file:line`."
  - "**Azure end_session_endpoint NOT discovered via OIDC.** The OIDC standard (`https://openid.net/specs/openid-connect-rpinitiated-1_0.html`) defines `end_session_endpoint` as a discoverable field at `/.well-known/openid-configuration`. The Azure AD discovery document at `https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration` includes this field. The handler at lines 38-44 does NOT consult discovery — it uses the operator-supplied `provider.getLogoutUri()` raw String verbatim. This is a code/standard drift: the platform requires operators to hard-code the end-session URL that the discovery document would otherwise serve. Operationally this is fine (the URLs are stable) but adds operator-side YAML toil; an issuer-uri-only configuration that fully relied on discovery is impossible for the logout flow."
  - "**`post_logout_redirect_uri` derived from inbound Host header — no platform-side allowlist.** `UriUtils.getBaseUri(requestUri)` (`UriUtils.java:11-22`) strips path/query/fragment from the INBOUND HTTP request's URI and returns scheme+host+port. The Host header is operator-controlled at deployment (via the reverse proxy) but request-controlled at runtime — a forwarded `X-Forwarded-Host` that the proxy trusts and synthesizes into the request URI propagates to the post-logout redirect. The platform does NOT carry an operator-side allowlist of valid post-logout-redirect URLs to cross-check against. The mitigation is that Azure validates `post_logout_redirect_uri` against the App Registration's registered Logout URLs and rejects unregistered targets (per Microsoft Entra ID standard behaviour) — so the Azure-side allowlist is the only protection against open-redirect via a forged Host header. The docs do not surface this dependency on operator-side Azure portal configuration."
  - "**NO server-side Azure token revocation on logout.** The handler invalidates only the local `WebSession` (`AzureLogoutSuccessHandler.java:47` — `exchange.getExchange().getSession().flatMap(WebSession::invalidate)`). It does NOT call Azure's token revocation endpoint (`https://login.microsoftonline.com/{tenant}/oauth2/v2.0/logout` is the END-SESSION endpoint, not the revocation endpoint; Azure AD does not expose a token-revocation endpoint per RFC 7009 in the v2.0 protocol). Compare: `GoogleLogoutSuccessHandler.java:43-54` POSTs to `https://oauth2.googleapis.com/revoke` to actively revoke; `GithubLogoutSuccessHandler.java:51-63` DELETEs `/applications/{client_id}/grant`. For Azure, the access/refresh/id tokens remain valid until their natural TTLs expire (typical Azure access token TTL: 60-90 minutes; refresh token: up to 90 days for confidential clients). The docs do not surface this caveat; operators with stringent compliance requirements (e.g. immediate revocation on logout) need to know."
  - "**Provider name is `'azure'`, not `'AZURE'`, in the docs example YAML, but `Provider.AZURE.name()` produces `'AZURE'`.** `shouldHandle(provider)` uses `equalsIgnoreCase(Provider.AZURE.name())` (line 27) — case-insensitive match handles this transparently. Verified: docs YAML examples use `provider: 'azure'` (lowercase, `application.yml:129`); the enum is `AZURE` (uppercase, `Provider.java:4`). No bug, but worth noting as the convention for operators."

## implicit_adrs

- "The platform delegates token revocation responsibility to the IdP's natural TTL for Azure (no server-side revoke). The decision is encoded by ABSENCE — the handler invalidates the WebSession but issues no outbound HTTP to Azure. The intent anchor is the symmetric DIFFERENCE: `GoogleLogoutSuccessHandler.java:43-54` AND `GithubLogoutSuccessHandler.java:51-63` BOTH explicitly call provider revocation endpoints; `AzureLogoutSuccessHandler` deliberately does not (and Azure AD v2.0 does not expose a token revocation endpoint, so even attempting one would 404). The pattern is consistent with `CognitoLogoutSuccessHandler.java:30-50` and `ODDIAMLogoutSuccessHandler.java:30-46` which also only invalidate the session — for OIDC-style providers, the end-session redirect IS the revocation mechanism (the provider invalidates its own session/cookie when the user lands on the end-session URL)." — evidence: AzureLogoutSuccessHandler.java:31-48 + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-63 + CognitoLogoutSuccessHandler.java:30-50 — intent_anchor: "return exchange.getExchange().getSession().flatMap(WebSession::invalidate);" (no preceding outbound HTTP — sibling Google/Github DO call provider endpoints) — confidence: HIGH
- "Provider routing uses chain-of-responsibility with `shouldHandle(provider)` returning boolean from each implementation. The decision encodes: (a) handlers are autonomous `@Component`s — adding a new provider requires no change to the dispatcher; (b) Spring's `List<LogoutSuccessHandler>` injection wires the chain by type; (c) order does not matter (the filter expects exactly-one matching handler per provider). Intent anchor: the consistent `shouldHandle` idiom across all 5 handlers (`CognitoLogoutSuccessHandler.java:24-26`, `GithubLogoutSuccessHandler.java:33-36`, `GoogleLogoutSuccessHandler.java:28-31`, `ODDIAMLogoutSuccessHandler.java:24-27`, this file at lines 25-28) and the parallel pattern in `OAuthUserHandler.shouldHandle` per `OAuthSecurityConfiguration.java:185-201`." — evidence: AzureLogoutSuccessHandler.java:25-28 + OAuthLogoutSuccessHandler.java:44-48 + 4 sibling handlers — intent_anchor: "public boolean shouldHandle(final String provider) { return provider.equalsIgnoreCase(Provider.AZURE.name()); }" — confidence: HIGH
- "The post-logout redirect target is the inbound request's base URI, NOT a configured `platform.base-url` property. The decision encodes: (a) the platform's deployment URL is inferred from the request the user just made (which the reverse proxy authoritatively constructs); (b) there is no separate `odd.platform-url` / `platform.base-url` configuration property to cross-check against; (c) operators must trust their reverse proxy to set Host/X-Forwarded-Host correctly. The intent anchor is the consistent use of `UriUtils.getBaseUri(requestUri)` across all 4 OIDC-flow handlers (Cognito, Azure, ODDIAM, Google, Github) — same helper, same pattern, no per-handler override. The decision is operator-friendly (no extra config to manage) and reverse-proxy-trusting (a misconfigured proxy that forwards arbitrary Host headers leaks the platform's post-logout redirect to attacker-controlled domains)." — evidence: AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22 + 4 sibling handlers using the same helper + ABSENCE of any `platform.base-url` / `odd.platform-url` config key in `application.yml` (verified by Grep returning no match) — intent_anchor: ".queryParam(\"post_logout_redirect_uri\", UriUtils.getBaseUri(requestUri))" + the shared UriUtils helper — confidence: MEDIUM (the decision is implicit in code shape; no comment, exception message, or annotation explicitly defends it — the consistency across 4 handlers is the convention evidence)

## bugs_limitations_corner_cases

- "**NPE on null `provider.getLogoutUri()`.** Line 39 calls `URI.create(provider.getLogoutUri())` with no null-guard. Per JDK contract `URI.create(String)` throws NPE on null. The validator at `ODDOAuth2Properties.java:17-28` checks only `clientId` and `provider` — NOT `logoutUri`. An Azure operator who follows the live docs but omits `logout-uri` from `auth.oauth2.client.{key}.*` boots successfully and hits the NPE at first logout attempt. The CognitoLogoutSuccessHandler (`CognitoLogoutSuccessHandler.java:33-35`) carries `if (StringUtils.isEmpty(provider.getLogoutUri())) return Mono.empty();` — Azure does not. Inconsistent guard. Routes here (not `implicit_adrs`) because there is NO comment / exception / annotation / convention defending the absence of the guard; the asymmetry vs Cognito demonstrates the omission is unintentional. STRENGTHENS the existing ODDOAuth2Properties sidecar bug at file:line." — evidence: AzureLogoutSuccessHandler.java:39 + CognitoLogoutSuccessHandler.java:33-35 + ODDOAuth2Properties.java:17-28 + WebFetch of `/oauth2-oidc` on 2026-05-19 ("'unset logout-uri raises a NullPointerException and the logout flow returns a 500 response'") — severity: HIGH
- "**No platform-side allowlist on `post_logout_redirect_uri`.** The redirect target is derived from the inbound request's Host header via `UriUtils.getBaseUri(requestUri)` (line 40 + `UriUtils.java:11-22`). A reverse proxy that trusts and forwards a user-controlled `Host` or `X-Forwarded-Host` header without sanitization would propagate that value into the Azure logout request. The only mitigation is Azure's own validation against the App Registration's registered Logout URLs (per Microsoft Entra ID standard behaviour) — if an operator has set up Azure to accept wildcard or multiple Logout URLs (e.g. for multi-environment Azure App Registration sharing), the platform's contribution is the inbound Host header, which becomes the open-redirect target. The platform has no `odd.platform-url` config to cross-check against, no `WebFilter` that asserts `Host == configured-host`, no test that asserts the Host is whitelisted. Operationally low-risk in standard single-environment deployments where the reverse proxy sets a fixed Host; sharper risk in multi-tenant proxy setups or where `X-Forwarded-Host` is unsafely honoured." — evidence: AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22 + Grep of `application.yml` for `platform.base-url|odd.platform-url|allowed.redirect` returning no match — severity: MEDIUM
- "**No server-side Azure access/refresh token revocation.** The handler invalidates only the platform-side `WebSession`. The OAuth2 access token, refresh token, and id_token issued by Azure remain valid at Azure until their natural TTL expires. If the token was previously exfiltrated (e.g. via XSS, a non-HttpOnly storage tier, a browser-extension compromise), logging the user out of the platform does NOT invalidate the token at Azure or revoke its access to other resources the user had consented for. Azure AD v2.0 does not expose RFC 7009 token revocation, so even attempting revocation would fail — but the platform-side caveat is undocumented and operators with stringent immediate-revocation requirements need to know. Compare: Google handler actively revokes via `oauth2.googleapis.com/revoke`; GitHub handler revokes via `DELETE /applications/{client_id}/grant`." — evidence: AzureLogoutSuccessHandler.java:31-48 (no outbound revocation HTTP) + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-63 — severity: MEDIUM
- "**Zero test coverage.** `find <odd-platform-repo>/odd-platform-api/src/test -name '*Logout*.java'` returns zero matches. No unit test exercises `shouldHandle('azure')`, no integration test asserts the 302 + Location URL shape, no test catches the NPE-on-null-logoutUri regression, no test asserts the WebSession invalidation. The class is small (49 lines) but plugged into the OAuth2 logout pipeline; a regression that swapped the query-param order (`client_id` before `post_logout_redirect_uri`) might pass review but would not break — Azure tolerates the order — yet a regression that omitted `client_id` entirely (Azure's `logout` endpoint accepts `post_logout_redirect_uri` without it but the documented Azure standard recommends `client_id` for audit log clarity) would silently degrade observability without breaking the flow." — evidence: Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*Logout*` returning no matches — severity: LOW
- "**`search_facets` session-state cleanup is NOT performed at logout.** The orchestrator prompt asked whether the bearer-token-shaped search_facets session state is cleaned at logout. Verified: the `search_facets` row is keyed by `gen_random_uuid()` with NO user binding column (`V0_0_1__init.sql:204-211` — no `owner_id`, `user_id`, `created_by`). The row is reaped only by `SearchFacetsHousekeepingJob` (`SearchFacetsHousekeepingJob.java:20-30`) on the `LAST_ACCESSED_AT <= now() - housekeeping.ttl.search_facets_days` predicate (default 30 days per `application.yml:169` + F-010 pillar-anchored feature). Per LSN-018 verification: F-010 correctly enumerates the SearchFacets TTL eviction; the row IS reaped — but ONLY by TTL, NOT by logout. Operationally: the row is orphaned at logout (no user can re-attach because Search session UUIDs are client-side state in browser local storage that is cleared by the SPA on logout). Routes here as a CORNER CASE (the absence of logout-cleanup is benign because the row has no user binding), NOT as a bug — the design choice is consistent. The orchestrator's LSN-018-area concern is RESOLVED: no logout-time cleanup is needed because the row is not user-bound, and TTL eviction handles steady-state row growth. STRENGTHENS F-010 (the housekeeping pillar feature) by confirming the logout-vs-TTL boundary." — evidence: AzureLogoutSuccessHandler.java:47 (only WebSession invalidate) + V0_0_1__init.sql:204-211 (no user binding) + SearchFacetsHousekeepingJob.java:20-30 + application.yml:169 (`search_facets_days: 30`) + F-010 pillar-anchored feature — severity: LOW (informational; behaviour is correct)
- "**Encoding choice — UTF-8 hardcoded.** Line 42 uses `.encode(StandardCharsets.UTF_8)`. This is consistent with the other 4 handlers; URL-encoding for OAuth2 redirect-URI query params requires UTF-8 per RFC 3986. No bug; flagged only because the value is hardcoded rather than configurable, and any future requirement to encode non-UTF-8 (extremely unlikely for OAuth2) would need to change all 5 handlers in lockstep." — evidence: AzureLogoutSuccessHandler.java:42 + 4 sibling handlers — severity: LOW

## security

- **auth_mode_relevance**: `OAUTH2`. The class is `@Conditional(AzureCondition.class)` (line 21) and the dispatcher `OAuthLogoutSuccessHandler` is `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` (`OAuthLogoutSuccessHandler.java:16`). The handler runs ONLY when (a) `auth.type=OAUTH2`, AND (b) at least one `auth.oauth2.client.*.provider=AZURE` is configured. Not relevant to DISABLED / LOGIN_FORM / LDAP modes (those have their own logout flows or none).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The logout endpoint is part of the UI authentication chain at `POST /logout` (Spring Security default), not the ingestion path. The `IngestionDataEntitiesFilter` does not apply.
- **authorization_assertions**: `[]`. The handler runs AFTER Spring Security has cleared the SecurityContext as part of the logout flow — there is no per-request authorization check here. (`OAuthLogoutSuccessHandler.onLogoutSuccess` is invoked by the Spring logout filter only after the credentials have been verified for the logout request itself, which by Spring default requires the user to be authenticated.)
- **owner_scoping**: `N/A — code is not data-scoped`. The handler manipulates session/redirect, not data rows.
- **data_exposure**:
  - `"OAuth2 access/refresh/id token in Spring WebSession → invalidated at logout (line 47); no longer accessible after session destruction. Tokens remain valid at Azure until natural TTL (Azure does not honour RFC 7009 token revocation in v2.0; logout is end-session-only)."`
  - `"client_id query param sent to Azure end-session endpoint → operator-configured value (`auth.oauth2.client.{key}.client-id`); not a secret per OAuth2 standards (the client_id is public; the client_secret is the protected value). Visible in browser history and HTTP logs at Azure side."`
  - `"post_logout_redirect_uri query param → the platform's base URL derived from the inbound request Host header. NOT a secret. Visible at Azure side; reflected back into the 302 Azure returns to the browser."`
- **known_security_gaps**:
  - `"Azure logout-uri NPE — operator misconfiguration produces 500 at first logout; documented in live docs but not validated at boot (`ODDOAuth2Properties.validate` does not check `logoutUri`). Inconsistent guard vs Cognito's `StringUtils.isEmpty` early-return. Severity: HIGH for the operator-experience (silent boot, runtime failure); LOW for security posture (the failure is denial-of-service on the logout flow, not authentication bypass)." — evidence: AzureLogoutSuccessHandler.java:39 + ODDOAuth2Properties.java:17-28 + CognitoLogoutSuccessHandler.java:33-35 — severity: HIGH`
  - `"post_logout_redirect_uri open-redirect via Host header — the platform does not allowlist the redirect target; Azure-side App Registration Logout URLs allowlist is the only mitigation. A misconfigured reverse proxy that forwards user-controlled Host or X-Forwarded-Host headers without sanitization could propagate an attacker-controlled domain into the Azure logout flow. The risk is bounded by Azure's standard validation; an operator who has registered wildcard or multiple Logout URLs in the Azure portal removes the bound." — evidence: AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22 + Grep of `application.yml` for redirect-allowlist returning no match — severity: MEDIUM`
  - `"No Azure token revocation on logout — the access/refresh/id tokens remain valid at Azure until natural TTL. Compromised tokens (XSS, browser-extension exfiltration) retain authority to other Azure resources the user consented for, regardless of platform logout. Compare: Google + GitHub handlers actively revoke. Azure does not expose RFC 7009 revocation in v2.0, so this is a Microsoft-platform limitation as much as an ODD-platform gap; the docs do not surface it." — evidence: AzureLogoutSuccessHandler.java:31-48 (no outbound HTTP) + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-63 — severity: MEDIUM`
  - `"No `state` parameter on the Azure end-session redirect — `post_logout_redirect_uri` + `client_id` are the only query params (lines 40-41). RFC 7636 + OIDC RP-Initiated Logout 1.0 §5 recommends `state` to bind the logout request to the user session and prevent CSRF on the post-logout redirect. The platform does not generate one. Risk: an attacker who induces the user to follow a logout link with a crafted state can replay the post-logout redirect (low severity because the local session is already invalidated; no auth bypass). Sibling handlers (Google, GitHub, ODDIAM, Cognito) similarly omit state." — evidence: AzureLogoutSuccessHandler.java:38-44 (no state param) + RFC OIDC RP-Initiated Logout 1.0 §5 (state RECOMMENDED) — severity: LOW`

## performance

- **hot_paths**: `[]`. Logout is one-shot per session; not a request-rate hot path. Each invocation: O(1) URI builder + one WebSession invalidation.
- **throughput_characteristics**: `"reactive (Mono<Void>) — non-blocking; the WebSession invalidation is in-memory (Spring default WebSession store), no DB I/O. Throughput is bounded by the rate of user logouts, which is operationally trivial vs the rate of normal requests."`
- **resource_allocation**:
  - `"One UriComponentsBuilder allocation per logout (lines 38-44) — small, transient."`
  - `"One WebSession invalidation per logout — frees the in-memory session map entry; for the default Spring WebSession store this releases the OAuth2 access/refresh/id tokens + the FacetStateDto session attributes + any other session-stored data."`
- **scaling_characteristics**:
  - `"Stateless handler — the bean holds no per-request state; instances scale horizontally with no coordination."`
  - `"Default in-memory WebSession store — for multi-replica deployments, the WebSession lives only on the pod that handled the original OAuth2 callback. If the logout request lands on a different pod (sticky-session misconfiguration), `exchange.getExchange().getSession()` resolves an empty session, `WebSession::invalidate` is a no-op on the empty session, and the user appears logged out on the original pod but their session persists silently on others until natural TTL. This is a deployment-time concern, not a handler-code concern."`
- **known_performance_gaps**:
  - `"Multi-replica deployments without shared session store leave orphaned WebSessions on non-logout-handling pods. Same root cause as the OAuthSecurityConfiguration sidecar's `known_performance_gaps[0]` (no @EnableSpringWebSession / Redis session store wired). The Azure logout path is one observable manifestation: a user clicks logout on pod A, the session on pod A is invalidated, but pods B and C still hold the session attribute map if the user's load balancer routing differed earlier in the session. STRENGTHENS the existing OAuthSecurityConfiguration finding." — evidence: AzureLogoutSuccessHandler.java:47 + OAuthSecurityConfiguration.java:1-269 (no session store bean) — severity: MEDIUM`

## sources

- understanding ← AzureLogoutSuccessHandler.java:1-49 + UriUtils.java:11-23 + OAuthLogoutSuccessHandler.java:30-48 + V0_0_1__init.sql:204-211 (no user binding on search_facets) + F-010 pillar feature (TTL eviction) + WebFetch of `/oauth2-oidc` on 2026-05-19 (docs say logout-uri required)
- concepts.entities.AzureLogoutSuccessHandler ← AzureLogoutSuccessHandler.java:20-23
- concepts.entities.LogoutSuccessHandler ← LogoutSuccessHandler.java:8-14
- concepts.entities.AzureCondition ← AzureCondition.java:10-15 + AbstractProviderCondition.java:11-23
- concepts.entities.Provider.AZURE ← Provider.java:3-5
- concepts.entities.ODDOAuth2Properties.OAuth2Provider ← ODDOAuth2Properties.java:31-53
- concepts.entities.UriUtils.getBaseUri ← UriUtils.java:11-23
- concepts.entities.OAuthLogoutSuccessHandler ← OAuthLogoutSuccessHandler.java:30-48
- concepts.invariants.condition-gated ← AzureLogoutSuccessHandler.java:21 + AzureCondition.java:10-15
- concepts.invariants.npe-on-null-logout-uri ← AzureLogoutSuccessHandler.java:39 (URI.create) + CognitoLogoutSuccessHandler.java:33-35 (cf. guard sibling) + WebFetch of `/oauth2-oidc` on 2026-05-19
- concepts.invariants.session-only-cleanup ← AzureLogoutSuccessHandler.java:47 + GoogleLogoutSuccessHandler.java:43-54 (cf. active revocation sibling) + GithubLogoutSuccessHandler.java:51-63
- concepts.invariants.host-header-derived-redirect ← AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22
- concepts.invariants.no-oidc-discovery ← AzureLogoutSuccessHandler.java:38-44 + ODDOAuth2Properties.java:43 (`logoutUri` is a raw String field, not discovered)
- concepts.invariants.dispatch-via-shouldHandle ← OAuthLogoutSuccessHandler.java:44-48 + AzureLogoutSuccessHandler.java:25-28
- dependencies_semantic.requires-feature.UI-authentication-OAUTH2 ← OAuthLogoutSuccessHandler.java:16 + OAuthSecurityConfiguration.java:71 + WebFetch of `/oauth2-oidc` on 2026-05-19
- dependencies_semantic.requires-config.auth.type ← OAuthLogoutSuccessHandler.java:16
- dependencies_semantic.requires-config.auth.oauth2.client.{key}.provider=AZURE ← AzureCondition.java:13 + AbstractProviderCondition.java:15-22
- dependencies_semantic.requires-config.auth.oauth2.client.{key}.logout-uri ← AzureLogoutSuccessHandler.java:39 + ODDOAuth2Properties.java:43 + WebFetch of `/oauth2-oidc` on 2026-05-19
- dependencies_semantic.requires-config.auth.oauth2.client.{key}.client-id ← AzureLogoutSuccessHandler.java:41 + ODDOAuth2Properties.java:22-24 + ODDOAuth2Properties.java:33
- tests_coverage_semantic.gaps ← Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*Logout*` (no matches) + Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*Azure*` (no matches)
- docs_link_semantic.inferred_docs.[0] (oauth2-oidc) ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc on 2026-05-19, status 200
- docs_link_semantic.doc_drift_findings.[0] (npe-on-null-logout-uri) ← AzureLogoutSuccessHandler.java:39 + ODDOAuth2Properties.java:17-28 + WebFetch of `/oauth2-oidc` on 2026-05-19
- docs_link_semantic.doc_drift_findings.[1] (no-oidc-discovery) ← AzureLogoutSuccessHandler.java:38-44 + RFC OIDC Discovery + Azure AD discovery doc (operator-known external resource)
- docs_link_semantic.doc_drift_findings.[2] (host-header-derived-redirect-no-allowlist) ← AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22 + Grep returning no `platform.base-url` match
- docs_link_semantic.doc_drift_findings.[3] (no-azure-token-revocation) ← AzureLogoutSuccessHandler.java:31-48 + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-63
- docs_link_semantic.doc_drift_findings.[4] (provider-name-case) ← AzureLogoutSuccessHandler.java:27 + Provider.java:4 + application.yml:129
- implicit_adrs.[0] (delegate-revocation-to-natural-ttl) ← AzureLogoutSuccessHandler.java:31-48 + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-63 + CognitoLogoutSuccessHandler.java:30-50 + ODDIAMLogoutSuccessHandler.java:30-46
- implicit_adrs.[1] (chain-of-responsibility-routing) ← AzureLogoutSuccessHandler.java:25-28 + OAuthLogoutSuccessHandler.java:44-48 + 4 sibling handlers + OAuthSecurityConfiguration.java:185-201
- implicit_adrs.[2] (inbound-request-derived-redirect) ← AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22 + 4 sibling handlers using the same helper + Grep returning no `platform.base-url` config
- bugs_limitations_corner_cases.[0] (npe-on-null-logout-uri) ← AzureLogoutSuccessHandler.java:39 + CognitoLogoutSuccessHandler.java:33-35 + ODDOAuth2Properties.java:17-28 + WebFetch of `/oauth2-oidc` on 2026-05-19
- bugs_limitations_corner_cases.[1] (no-platform-side-redirect-allowlist) ← AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22 + Grep of `application.yml` for `platform.base-url|odd.platform-url|allowed.redirect` returning no match
- bugs_limitations_corner_cases.[2] (no-azure-token-revocation) ← AzureLogoutSuccessHandler.java:31-48 + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-63
- bugs_limitations_corner_cases.[3] (zero-test-coverage) ← Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*Logout*` + Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*Azure*` (both no matches)
- bugs_limitations_corner_cases.[4] (search-facets-not-cleaned-at-logout) ← AzureLogoutSuccessHandler.java:47 + V0_0_1__init.sql:204-211 + SearchFacetsHousekeepingJob.java:20-30 + application.yml:169 + F-010 pillar feature
- bugs_limitations_corner_cases.[5] (utf8-hardcoded) ← AzureLogoutSuccessHandler.java:42 + 4 sibling handlers
- security.auth_mode_relevance ← AzureLogoutSuccessHandler.java:21 + OAuthLogoutSuccessHandler.java:16
- security.ingestion_filter_relevance ← AzureLogoutSuccessHandler.java:1-49 (UI logout path, not ingestion) + OAuthLogoutSuccessHandler.java (dispatcher on UI)
- security.data_exposure.[0] (oauth2-tokens-in-websession-invalidated) ← AzureLogoutSuccessHandler.java:47
- security.data_exposure.[1] (client-id-to-azure) ← AzureLogoutSuccessHandler.java:41
- security.data_exposure.[2] (post-logout-redirect-uri-to-azure) ← AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22
- security.known_security_gaps.[0] (npe-on-null-logout-uri) ← AzureLogoutSuccessHandler.java:39 + ODDOAuth2Properties.java:17-28
- security.known_security_gaps.[1] (post-logout-redirect-uri-no-allowlist) ← AzureLogoutSuccessHandler.java:40 + UriUtils.java:11-22
- security.known_security_gaps.[2] (no-azure-token-revocation) ← AzureLogoutSuccessHandler.java:31-48 + GoogleLogoutSuccessHandler.java:43-54
- security.known_security_gaps.[3] (no-state-param) ← AzureLogoutSuccessHandler.java:38-44 (no `.queryParam("state", ...)`) + 4 sibling handlers (same omission)
- performance.throughput_characteristics ← AzureLogoutSuccessHandler.java:31-48 (single Mono signature + WebSession invalidation)
- performance.resource_allocation ← AzureLogoutSuccessHandler.java:38-47
- performance.scaling_characteristics ← AzureLogoutSuccessHandler.java:1-49 (stateless) + OAuthSecurityConfiguration.java:1-269 (no shared session store)
- performance.known_performance_gaps.[0] (multi-replica-orphan-websessions) ← AzureLogoutSuccessHandler.java:47 + OAuthSecurityConfiguration.java:1-269

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM

## coherence_check

Rule 6 (LSN-018) pre-emit coherence check — entities/operations/file:line citations cross-checked against the existing registries:

**STRENGTHENS:**
- **F-011 (P-09:F-002 Principal-to-Owner Resolution)** — this sidecar surfaces additional OAUTH2-mode logout machinery; while F-011's focus is principal-to-Owner mapping, the logout path's WebSession invalidation IS the termination of the principal lifecycle. Adds back-link evidence that logout cleanup is local-only and tokens persist at Azure. Coherence note: F-011 already lists `empty_security_context_silent_propagation` as a drift facet — this sidecar shows that after logout, the WebSession is empty by design, and the silent-empty-result fallback (F-011 facet) is the post-logout state on any non-logout endpoint (correctly safe; no contradiction).
- **F-010 (P-08:F-002 Housekeeping TTL Enforcement)** — LSN-018 explicitly noted that F-010 correctly lists `SearchFacetsHousekeepingJob`. This sidecar verifies (via the orchestrator-prompt question on search_facets logout cleanup): the row is NOT cleaned at logout because it has no user binding; F-010's TTL eviction is the sole reaper. CONFIRMS F-010 is correct AND the search_facets-no-user-binding observation is consistent across sidecars (the SearchController.facets sidecar `invariants` lists the same fact at the controller's batch-M finding). No contradiction; strengthens both F-010 (TTL eviction is the reaper) and the SearchController.facets sidecar (`search_facets` has no user binding by design).
- **ODDOAuth2Properties sidecar (`bugs_limitations_corner_cases[0]` — Azure logoutUri unchecked at PostConstruct, HIGH severity)** — this sidecar anchors the consumer site (`AzureLogoutSuccessHandler.java:39` `URI.create(provider.getLogoutUri())` with no null-guard) directly, making the existing finding actionable with file:line evidence. CompoundOAuthOAuth2Properties already cited `AzureLogoutSuccessHandler.java:39` from a config-properties-side reading; this sidecar provides the consumer-side primary source.
- **OAuthSecurityConfiguration sidecar (`bugs_limitations_corner_cases[3]` — azure-logout-uri-unchecked, MEDIUM; `bugs_limitations_corner_cases[6]` — websession-no-shared-store)** — same NPE finding; same multi-replica session-store gap. This sidecar provides the second cross-reference of the NPE site at the actual handler that triggers it, and a third corroboration of the WebSession-no-shared-store concern.

**SUPERSEDES:** none — no prior artefact made claims about Azure logout that this sidecar refines.

**CONFLICTS:** none surfaced. The orchestrator's LSN-018-area question on search_facets logout cleanup is RESOLVED: no cleanup at logout because no user binding; TTL is the sole eviction (F-010 correct, no TEST-GAP-523-style contradiction).

Entities/operations greppable for downstream reducer coherence sweeps:
- `AzureLogoutSuccessHandler` (this file — first sidecar)
- `provider.getLogoutUri()` (consumer of `ODDOAuth2Properties.OAuth2Provider.logoutUri`)
- `URI.create(provider.getLogoutUri())` (the NPE site)
- `post_logout_redirect_uri` (the Azure end-session query param)
- `UriUtils.getBaseUri(requestUri)` (the Host-header-derived redirect source)
- `WebSession::invalidate` (the only platform-side cleanup)
- `search_facets` (the LSN-018-area concept — explicitly NOT cleaned at logout)

## back_links

- related_features: [F-011, F-010]
- related_pillar_features: [P-09:F-002 (Principal-to-Owner Resolution), P-08:F-002 (Housekeeping TTL Enforcement)]
- related_retrospectives: [LSN-018]
- related_concepts: [auth-mode, OAuth2-end-session-flow, WebSession-invalidation, search-facets-row-lifecycle]
- related_sibling_sidecars:
  - odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md (the OAUTH2 dispatcher-side context)
  - odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md (the config-properties-side context for `logoutUri` NPE)
  - odd-platform__java__SearchController__controller-method__facets.md (the search_facets session-state surface)
  - odd-platform__java__service__service__AuthIdentityProviderImpl.md (the principal-layer of F-011)

## Maintainer notes
