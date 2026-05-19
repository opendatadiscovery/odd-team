---
node_id: "odd-platform java auth logout:CognitoLogoutSuccessHandler"
node_kind: logout-success-handler
axis: auth_logout_handlers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-O
back_links:
  features: [F-011]
  pillars: [P-09]
  retrospectives: []
---

# CognitoLogoutSuccessHandler — semantic understanding

## understanding

`CognitoLogoutSuccessHandler` is the provider-specific OAuth2 logout handler
that runs when an authenticated user clicks "logout" in the ODD Platform UI
and the deployment's active OAuth2 client is registered with `provider:
cognito`. It builds a 302 redirect to the AWS Cognito User Pool `/logout`
endpoint with two query parameters — `client_id=<ODD's app client id>` and
`logout_uri=<requestUri base, i.e. the platform's root URL>` — invalidates
the local Spring WebFlux session, and lets the browser follow the redirect
into Cognito which then redirects back to `logout_uri` after clearing its
own session cookies. The handler is one of five sibling provider-specific
implementations of the internal `LogoutSuccessHandler` interface
(Cognito / Azure / Google / GitHub / ODD_IAM); the OAuth2 logout chain
(`OAuthLogoutSuccessHandler`) dispatches to the matching sibling via
`shouldHandle(provider)`, falling back to Spring's
`OidcClientInitiatedServerLogoutSuccessHandler` if no provider matches.

## concepts

- entities: [`CognitoLogoutSuccessHandler` (the class at line 22 —
  `@Component @Conditional(CognitoCondition.class) implements
  LogoutSuccessHandler`), `LogoutSuccessHandler` (the internal interface at
  `LogoutSuccessHandler.java:8-14` — NOT Spring's
  `ServerLogoutSuccessHandler`; the ODD-defined provider-routing interface
  carrying `shouldHandle(String provider)` + `handle(WebFilterExchange,
  Authentication, OAuth2Provider)`), `CognitoCondition` (the gate at
  `CognitoCondition.java:10-15` — extends `AbstractProviderCondition`,
  matches when any `auth.oauth2.client.{key}.provider` equals `COGNITO`
  case-insensitively), `Provider.COGNITO` (the enum value at
  `Provider.java:4` used verbatim in `shouldHandle` comparison),
  `OAuth2Provider` (the per-client config record carrying `logoutUri`,
  `clientId` from `ODDOAuth2Properties.java:30-53`), `UriUtils.getBaseUri()`
  (the utility at `UriUtils.java:11-23` that strips path / query / fragment
  from the request URI and replaces path with `/` — produces the
  scheme+host[+port] root URL ODD redirects back to), `WebSession` (Spring
  WebFlux session abstraction — `invalidate()` clears server-side session
  state)]
- operations: [route-to-cognito-logout-on-shouldHandle-match,
  short-circuit-when-logoutUri-empty (return `Mono.empty()`),
  build-302-redirect-to-cognito-/logout-endpoint,
  pass-clientId-and-platform-base-URL-as-logout_uri-query-param,
  invalidate-local-webflux-session-after-setting-redirect-location]
- invariants: [(1) the handler only matches when
  `provider.equalsIgnoreCase("COGNITO")` — the comparison at line 26 uses
  `Provider.COGNITO.name()`, so the operator-written `provider` string is
  case-insensitive (`cognito`, `Cognito`, `COGNITO` all match); (2) if
  `provider.getLogoutUri()` is null OR empty (`StringUtils.isEmpty` returns
  true for both), the handler does NOTHING — line 33-35 returns
  `Mono.empty()` immediately, which means NEITHER the redirect is set NOR
  the local session invalidated — the user is left logged in to ODD and
  the browser's logout request returns 200 with empty body; (3) the
  redirect URI is built from the INCOMING request's URI via
  `UriUtils.getBaseUri(requestUri)` — so `logout_uri` is dynamically
  derived from whichever hostname the user hit (e.g. if the user clicked
  logout while at `https://odd-prod.example.com/path?query`, the
  `logout_uri` becomes `https://odd-prod.example.com/`); operators do NOT
  declare the post-logout redirect target in ODD config — they declare it
  in Cognito's "Allowed sign-out URLs" app-client setting; (4)
  `WebSession::invalidate()` runs AFTER `response.getHeaders().setLocation(uri)`
  is called — the Mono returned by `handle()` is the session-invalidation
  Mono; the redirect-header mutation is a synchronous side effect on the
  response object BEFORE the Mono is subscribed by the Spring framework;
  (5) the 302 status code is set explicitly at line 37 via
  `response.setStatusCode(HttpStatus.FOUND)` — there is no fall-through to
  any default, no conditional on whether logoutUri is empty (the empty
  case returns Mono.empty() BEFORE setting status, so the response keeps
  its default 200)]
- audiences: [browser-end-user-logging-out (the human clicking the logout
  button in the UI), AWS Cognito User Pool /logout endpoint (the target of
  the 302 redirect), Spring Security WebFlux logout filter chain (the
  upstream caller that invokes `handle()` via OAuthLogoutSuccessHandler),
  AWS Cognito app-client "Allowed sign-out URLs" config (the
  external-IdP-side allowlist that gates whether `logout_uri` is accepted
  — if not in the allowlist, Cognito returns an error page instead of
  redirecting back to ODD)]

## dependencies_semantic

- requires-feature: [Spring WebFlux reactive HTTP stack
  (`ServerHttpResponse`, `WebFilterExchange`, `WebSession`); Spring
  Security OAuth2 client (`Authentication`); Spring Boot
  `@ConfigurationProperties` for binding `OAuth2Provider.logoutUri` and
  `OAuth2Provider.clientId`; the internal
  `LogoutSuccessHandler`-routing chain in `OAuthLogoutSuccessHandler`
  (which selects this handler via `shouldHandle("COGNITO")`);
  `UriComponentsBuilder` for query-parameter encoding with UTF-8 charset]
- requires-config: [`auth.type=OAUTH2` (gates `OAuthLogoutSuccessHandler`
  registration at `OAuthLogoutSuccessHandler.java:16` via
  `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` — if
  not OAUTH2, the entire logout chain is not registered and this handler
  is never invoked); `auth.oauth2.client.{key}.provider=cognito` (the
  CognitoCondition at `CognitoCondition.java:13` matches via
  `containsIgnoreCase(getRegisteredProviders(env), "COGNITO")` — without
  any registered Cognito client, this bean is NOT instantiated);
  `auth.oauth2.client.{key}.logout-uri` (REQUIRED for the handler to do
  anything — line 33 short-circuits to `Mono.empty()` if empty; the value
  is the AWS Cognito User Pool hosted-UI `/logout` endpoint, e.g.
  `https://<your-pool>.auth.us-east-1.amazoncognito.com/logout`);
  `auth.oauth2.client.{key}.client-id` (REQUIRED — passed as the
  `client_id` query parameter; without it, Cognito returns an error);
  external Cognito App Client config: "Allowed sign-out URLs" must
  include the ODD platform's base URL (the value produced by
  `UriUtils.getBaseUri(requestUri)`) — without that allowlist entry,
  Cognito rejects the `logout_uri` parameter and the user sees a
  Cognito-side error page after logout]
- requires-runtime: [Spring WebFlux reactive request-handling thread to
  invoke the `Mono<Void>`; HTTP 302 follow-through in the browser to reach
  the Cognito hostname; outbound network connectivity from the user's
  browser (NOT from the platform — this is a redirect, the platform does
  not call Cognito directly); a non-null `provider.getLogoutUri()`
  resolved at boot from operator YAML; a non-null `provider.getClientId()`
  validated at boot by `ODDOAuth2Properties.validate()` (line 22 throws
  IllegalStateException if `clientId` is empty)]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [(1) `shouldHandle("cognito")` / `shouldHandle("COGNITO")` /
  `shouldHandle("Cognito")` all return true (case-insensitive match) — no
  test pins this contract; (2) `shouldHandle("azure")` returns false; (3)
  empty `provider.getLogoutUri()` returns `Mono.empty()` and leaves the
  response status as default (NOT 302) — no test asserts the
  short-circuit branch; (4) the constructed redirect URI contains
  `client_id={clientId}&logout_uri={base}` URL-encoded with UTF-8
  charset; (5) `UriUtils.getBaseUri(requestUri)` strips path / query /
  fragment from the request URI and uses scheme+host[+port]+`/`; (6)
  `WebSession::invalidate()` is invoked after the redirect header is set
  (ordering matters — if invalidation ran first, the redirect would still
  function because the redirect target is in the response object not in
  session state, but a future refactor that moves invalidation earlier
  would not break observable behaviour — no test pins the ordering);
  (7) `CognitoCondition` matches when any registered client has
  `provider: cognito` (case-insensitive) and not otherwise; (8) when
  multiple OAuth2 clients are registered (Cognito + Google), this handler
  is selected ONLY for the Cognito-provider authentication and not for a
  Google logout]
- test_files: []
- gaps: |
    A repo-wide Grep for `CognitoLogoutSuccessHandler` against the test tree
    (`grep -rln 'CognitoLogoutSuccessHandler' <odd-platform-repo>/odd-platform-api/src/test/`)
    returns zero matches. Same for `LogoutSuccessHandler` and `OAuthLogoutSuccessHandler` —
    the entire OAuth2 logout chain is uncovered. Regressions most likely to bite operators:
    (a) silently changing the short-circuit branch — the current
    `if (StringUtils.isEmpty(provider.getLogoutUri())) return Mono.empty();`
    behaviour leaves the user logged in if `logoutUri` is omitted, which is a
    plausible "graceful degradation" interpretation but also a silent
    failure-mode (the user clicks logout and stays logged in with no error);
    a future refactor flipping this to `throw new IllegalStateException(...)`
    would tighten the contract but break deployments that intentionally omit
    `logoutUri`. No test locks the current behaviour either way. (b) Removing
    the trailing `WebSession::invalidate()` — currently the local platform
    session is cleared atomically with the IdP-redirect issuance (the Mono
    that gets subscribed). A regression that turns line 49 into
    `return Mono.empty();` would silently leave the platform session active
    server-side while the browser follows the redirect to Cognito — the
    classic "logout flow that doesn't actually log out". Without a test,
    this regression is invisible until an operator notices that their
    "logged-out" user remembers a session cookie. (c) Changing the query
    parameter names from `client_id` / `logout_uri` to camelCase or other
    variants — the parameter names are AWS Cognito's wire contract (per AWS
    docs, the `/logout` endpoint requires exactly `client_id` and
    `logout_uri`), not ODD's choice; a typo here breaks every Cognito
    deployment. (d) Changing `UriUtils.getBaseUri()` to preserve the
    incoming request path/query — if the user clicked logout from
    `https://odd/dashboard?filter=foo`, the current handler builds
    `logout_uri=https://odd/`; a future change to send
    `logout_uri=https://odd/dashboard?filter=foo` would require
    `dashboard?filter=foo` to be in Cognito's "Allowed sign-out URLs"
    allowlist (operators only allowlist the root).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc"
    anchor: ""
    rationale: "The Cognito-specific section on the OAuth2/OIDC docs page
      mentions `logout-uri` as a Cognito-specific field with the description
      'Application will be redirected to this URI after user logout for
      removing session on cognito side.' The page is the only doc surface
      that mentions Cognito + logout, so this is the canonical doc home for
      this handler's user-facing behaviour. No `@docs` annotation in the
      source."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html"
    anchor: ""
    rationale: "AWS Cognito's documentation for the /logout endpoint
      (the upstream contract this handler builds the request against) —
      defines the exact `client_id` + `logout_uri` query-parameter contract
      this handler implements + the 'Allowed sign-out URLs' app-client
      allowlist semantic. Linked from the ODD OAuth2/OIDC docs page."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
- fetched_excerpts: |
    From WebFetch of
    `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc`
    on 2026-05-19 (status 200) — the Cognito section:
    > `auth.oauth2.client.{client-id}.logout-uri` — post-logout redirect destination
    > "auth.oauth2.client.{client-id}.logout-uri". Application will be redirected to this URI after user logout for removing session on cognito side.
    > [References AWS Cognito logout endpoint documentation: https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html]

    From WebFetch of
    `https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html`
    on 2026-05-19 (status 200):
    > The `/logout` endpoint is a redirection endpoint. It signs out the user and redirects either to an authorized sign-out URL for your app client, or to the `/login` endpoint.
    > To redirect your user to a page that you choose, add **Allowed sign-out URLs** to your app client. In your users' requests to the `logout` endpoint, add `logout_uri` and `client_id` parameters. If the value of `logout_uri` is one of the **Allowed sign-out URLs** for your app client, Amazon Cognito redirects users to that URL.
    > The logout endpoint doesn't sign users out of OIDC or social identity providers (IdPs). To sign users out from their session with an external IdP, direct them to the sign-out page for that provider.
    > *client_id* — The app client ID for your app. … Required.
    > *logout_uri* — Redirect your user to a custom sign-out page with a *logout_uri* parameter. Set its value to the app client **sign-out URL** where you want to redirect your user after they sign out. Use *logout_uri* only with a *client_id* parameter.
- doc_drift_findings:
  - "The ODD docs phrase Cognito logout as 'Application will be redirected
    to this URI after user logout for removing session on cognito side.'
    This is misleading on two axes: (1) the `logoutUri` operators configure
    is NOT the redirect destination but the AWS Cognito `/logout` *endpoint
    URL* (e.g. `https://<pool>.auth.us-east-1.amazoncognito.com/logout`);
    the redirect destination is computed at runtime from the incoming
    request URI via `UriUtils.getBaseUri()` and is NOT operator-controlled.
    (2) 'For removing session on cognito side' implies Cognito alone — the
    handler ALSO invalidates the local Spring WebFlux session at line 49
    via `WebSession::invalidate()`; the docs are silent on the local
    session-clearing half. An operator reading the docs would not know
    that the platform-side session invalidation happens. Verified:
    `CognitoLogoutSuccessHandler.java:33-50`."
  - "The ODD docs do not mention AWS Cognito's 'Allowed sign-out URLs'
    app-client allowlist requirement. Per AWS docs, if the `logout_uri`
    parameter (which ODD computes from `UriUtils.getBaseUri(requestUri)`)
    is NOT in the app client's Allowed sign-out URLs list, 'Amazon Cognito
    redirects users to that URL' fails — the user sees a Cognito error
    page. Operators who deploy ODD behind a new hostname or with
    `auth.oauth2.client.{key}.redirect-uri` pointing at hostname A but the
    user accessing via hostname B (load balancer / DNS alias) would have
    `logout_uri=https://B/` which fails the Cognito allowlist. The docs
    are silent on this coupling; the handler dynamically derives the URI
    from the incoming request, making the coupling implicit. Verified:
    `CognitoLogoutSuccessHandler.java:43` builds logout_uri from request
    URI; ODD docs do not name 'Allowed sign-out URLs'; AWS docs do."
  - "The ODD docs do not mention Cognito's global signout vs. local signout
    distinction. AWS Cognito's `/logout` endpoint signs the user out of
    the Cognito User Pool session ONLY — it does NOT sign the user out of
    federated upstream IdPs (Google / Facebook / SAML providers) that the
    user may have authenticated via. Per AWS docs: 'The logout endpoint
    doesn't sign users out of OIDC or social identity providers (IdPs).
    To sign users out from their session with an external IdP, direct them
    to the sign-out page for that provider.' This handler does NOT
    surface that nuance. An ODD deployment that federates Cognito → Google
    will see a user 'logged out' of ODD + Cognito but the user's Google
    session remains active — a subsequent login attempt skips the Google
    password prompt. The ODD docs do not warn about this. Verified:
    `CognitoLogoutSuccessHandler.java:40-46` only calls Cognito's
    `/logout`; no upstream-IdP-signout step exists."
  - "The ODD docs describe `logout-uri` as one of the optional `Common to
    All Providers` fields per the OAuth2/OIDC page schema, then declare it
    Cognito-specific. The handler's behaviour at line 33-35 short-circuits
    silently when `logoutUri` is empty — the user 'logs out' from ODD's
    perspective (the request returns successfully) but Spring's logout
    filter calls this handler with NO redirect set and NO local session
    invalidation; the user is left logged in. The docs do not surface this
    failure mode. Operators who omit `logout-uri` in Cognito YAML will see
    the logout button do nothing visible — no redirect, no error, just a
    response cycle that returns the user to the same page still logged in.
    Verified: `CognitoLogoutSuccessHandler.java:33-35` returns
    `Mono.empty()` before any session-invalidation or redirect-header step."

## implicit_adrs

- "The ODD logout chain uses an internal `LogoutSuccessHandler` interface
  with provider-routing semantics (`shouldHandle(String provider)`)
  rather than relying on Spring Security's
  `OidcClientInitiatedServerLogoutSuccessHandler` for every provider. The
  decision encodes: (a) Spring's default OIDC-initiated logout requires
  the IdP to expose an OIDC `end_session_endpoint` in its discovery
  document — Cognito's `/logout` is NOT compliant (it accepts
  `logout_uri` + `client_id`, not the OIDC-standard `id_token_hint` +
  `post_logout_redirect_uri`), so the default handler cannot be used;
  (b) similar non-OIDC-compliant logout shapes exist for GitHub (DELETE
  to /applications/{client_id}/grant), Google (POST to /revoke), so the
  ODD chain dispatches per provider via the internal interface;
  (c) the fallback in `OAuthLogoutSuccessHandler.onLogoutSuccess` at
  lines 36-38 retains the default OIDC handler for providers that DO
  comply (`defaultOidcLogoutHandler`) — the per-provider chain is a
  superset, not a replacement. The intent anchor is the consistent
  five-sibling structure (Cognito / Azure / Google / GitHub / ODD_IAM
  all implement the same `LogoutSuccessHandler` interface) + the
  `@Conditional(CognitoCondition.class)` gating that registers each
  sibling only when its provider is registered." — evidence:
  CognitoLogoutSuccessHandler.java:20-22 +
  OAuthLogoutSuccessHandler.java:30-42 +
  AzureLogoutSuccessHandler.java + GoogleLogoutSuccessHandler.java +
  GithubLogoutSuccessHandler.java + ODDIAMLogoutSuccessHandler.java —
  intent_anchor: "@Component @Conditional(CognitoCondition.class) public
  class CognitoLogoutSuccessHandler implements LogoutSuccessHandler" +
  the consistent 5-sibling structure — confidence: HIGH
- "Cognito logout treats an empty `logoutUri` as graceful-degradation
  (return `Mono.empty()`) rather than fail-fast. The decision keeps
  deployments running when an operator omits `logout-uri` — the logout
  button effectively becomes a no-op rather than throwing an exception
  that returns a 500 to the browser. Cognito's handler is the ONLY
  sibling that has this guard (verified: AzureLogoutSuccessHandler.java
  has NO `isEmpty(logoutUri)` guard and calls `URI.create(null)` which
  throws NPE; ODDIAMLogoutSuccessHandler.java relies on `getIssuerUri()`
  and has no logoutUri guard; Google + GitHub do not use `logoutUri` at
  all). The asymmetry is intentional: Cognito's `logout-uri` is the
  Cognito-side `/logout` endpoint URL (mandatory for the redirect to
  work); the graceful-degradation guard exists because the Cognito YAML
  example most operators copy DOES include `logout-uri` but a deployment
  test environment might not. Trade-off: silent no-op is invisible —
  the operator sees the logout button 'work' (no error) but the user
  stays logged in. This is the LSN-001-pattern miss applied to logout:
  defaulting to a permissive behaviour that hides operator
  misconfiguration." — evidence:
  CognitoLogoutSuccessHandler.java:33-35 +
  AzureLogoutSuccessHandler.java:30-48 (NO equivalent guard) —
  intent_anchor: "if (StringUtils.isEmpty(provider.getLogoutUri()))
  { return Mono.empty(); }" + the absence of the same guard in Azure —
  confidence: MEDIUM
- "The post-logout redirect URI (the `logout_uri` query parameter) is
  derived from the INCOMING HTTP request's base URI via
  `UriUtils.getBaseUri(requestUri)` rather than from operator config.
  The decision encodes: (a) ODD does not require operators to declare
  the post-logout target in ODD config — they declare it once in
  Cognito's 'Allowed sign-out URLs' app-client setting; (b) the platform
  hostname is taken from however the user reached the platform, which
  correctly handles multi-hostname deployments (load balancer +
  internal hostname) as long as Cognito's allowlist matches every
  external hostname; (c) the platform's path is always stripped to `/`
  (per `UriUtils.replacePath('/')`) — operators never need to whitelist
  per-page URIs in Cognito. The intent anchor is the same pattern
  applied across all four providers that use UriUtils.getBaseUri
  (Cognito / Azure / Google / GitHub). Trade-off: the dynamic derivation
  produces silent failures when the incoming hostname is not in
  Cognito's allowlist (see `bugs_limitations_corner_cases`)." — evidence:
  CognitoLogoutSuccessHandler.java:43 +
  AzureLogoutSuccessHandler.java:40 +
  GoogleLogoutSuccessHandler.java:40 +
  GithubLogoutSuccessHandler.java:45 + UriUtils.java:11-23 —
  intent_anchor: ".queryParam(\"logout_uri\",
  UriUtils.getBaseUri(requestUri))" + the consistent 4-sibling pattern —
  confidence: HIGH
- "Local platform session is invalidated atomically with the IdP-side
  logout (the redirect header is set first; the session-invalidation
  Mono is the returned value that Spring's framework subscribes to). The
  decision encodes a guarantee: by the time the browser follows the 302
  to Cognito, the platform-side WebSession is server-side-invalidated.
  Cognito then redirects the browser back to the platform's root URL
  with no platform session cookie — the user lands on the login page.
  Even if the user blocks the redirect mid-flight (closes the browser
  after the 302 but before reaching Cognito), the platform session is
  already invalidated. This invariant is symmetric across all five
  siblings — every `*LogoutSuccessHandler.handle()` ends with
  `exchange.getExchange().getSession().flatMap(WebSession::invalidate)`.
  The intent anchor is the consistent five-sibling tail." — evidence:
  CognitoLogoutSuccessHandler.java:49 +
  AzureLogoutSuccessHandler.java:47 +
  ODDIAMLogoutSuccessHandler.java:45 +
  GoogleLogoutSuccessHandler.java:55 +
  GithubLogoutSuccessHandler.java:64 — intent_anchor: "return
  exchange.getExchange().getSession().flatMap(WebSession::invalidate);"
  + the consistent five-sibling tail — confidence: HIGH

## bugs_limitations_corner_cases

- "Empty `logout-uri` causes a silent no-op — the user clicks logout,
  the request returns 200 with no body, no redirect, and the local
  session is NOT invalidated (the Mono.empty() short-circuits before
  the WebSession::invalidate() call at line 49). The user remains logged
  in. There is no log message, no error, no operator-visible signal that
  logout is misconfigured. The only way an operator discovers this is
  by clicking logout and observing the user stays logged in." —
  evidence: CognitoLogoutSuccessHandler.java:33-35 (early return BEFORE
  session invalidation step at line 49) — severity: HIGH
- "Cognito's `/logout` endpoint does not sign the user out of upstream
  federated IdPs (Google / Facebook / SAML / other social providers).
  Per AWS docs: 'The logout endpoint doesn't sign users out of OIDC or
  social identity providers (IdPs).' An ODD deployment that federates
  Cognito → Google (Cognito acting as an OIDC broker) will see a user
  'logged out' of ODD and Cognito but the user's Google session
  remains active — the next login attempt skips the Google password
  prompt. The handler does not surface this nuance. ODD docs do not
  warn." — evidence: CognitoLogoutSuccessHandler.java:40-46 (only calls
  Cognito's /logout, no upstream-IdP step) + WebFetch AWS docs
  2026-05-19 ('The logout endpoint doesn't sign users out of OIDC or
  social identity providers') — severity: MEDIUM
- "Post-logout redirect URI is dynamically derived from the incoming
  request hostname via `UriUtils.getBaseUri(requestUri)`. If the user
  reached ODD via a hostname NOT in Cognito's 'Allowed sign-out URLs'
  allowlist (e.g. internal hostname, load-balancer alias, custom
  domain, IP address), Cognito returns an error page instead of
  redirecting back. The user is left on a Cognito error page with no
  platform-side recovery. This is more likely to bite operators in
  multi-tenant deployments where the same ODD instance serves multiple
  hostnames. ODD docs do not name 'Allowed sign-out URLs'." — evidence:
  CognitoLogoutSuccessHandler.java:43 (`UriUtils.getBaseUri(requestUri)`)
  + WebFetch AWS docs 2026-05-19 ('If the value of logout_uri is one of
  the Allowed sign-out URLs for your app client, Amazon Cognito
  redirects users to that URL') — severity: MEDIUM
- "No token-revocation step. The handler clears the local Spring
  WebFlux session and redirects to Cognito's `/logout`, but it does
  NOT explicitly call Cognito's token-revocation endpoint
  (`https://<pool>.auth.<region>.amazoncognito.com/oauth2/revoke`) to
  invalidate the access token. Spring's OAuth2 client may retain the
  authorized-client record in `ReactiveOAuth2AuthorizedClientService`
  with a valid (until expiry) access token. Compare with
  `GoogleLogoutSuccessHandler.java:43-54` which DOES call Google's
  /revoke endpoint to invalidate the access token, and
  `GithubLogoutSuccessHandler.java:51-65` which calls GitHub's
  /applications/{client_id}/grant DELETE to revoke the grant. Cognito's
  handler does neither — relying entirely on Cognito's /logout endpoint
  to drop the User Pool session cookie. An attacker who exfiltrated
  the access token before logout could continue using it against
  Cognito-issued downstream APIs until the token expires (default 1
  hour for Cognito access tokens). The Cognito User Pool session
  cookie is dropped, but the OAuth2 tokens are not revoked
  server-side." — evidence:
  CognitoLogoutSuccessHandler.java:33-50 (no /revoke call) +
  GoogleLogoutSuccessHandler.java:43-54 (contrast: does call /revoke)
  + GithubLogoutSuccessHandler.java:51-65 (contrast: calls grant
  delete) — severity: MEDIUM
- "The handler implicitly assumes `provider.getClientId()` is non-null
  when `logoutUri` is non-empty. If a deployment somehow had
  `logout-uri` set but `client-id` empty (theoretically rejected by
  `ODDOAuth2Properties.validate()` at line 22-24, but a future
  refactor that removes that validator would expose this), line 42
  `.queryParam(\"client_id\", provider.getClientId())` would pass null
  to `UriComponentsBuilder.queryParam()` which produces the query
  string `?client_id&logout_uri=...` (the parameter name with no
  value). Cognito would reject this with an error. Currently mitigated
  by the validator, but the handler itself has no null guard on
  clientId." — evidence: CognitoLogoutSuccessHandler.java:42 (no
  null guard on clientId) + ODDOAuth2Properties.java:22-24 (validator
  is the only guard) — severity: LOW
- "No nonce / state CSRF protection on the logout request. AWS docs
  describe optional `nonce` and `state` parameters for guarding
  against CSRF and replay attacks. This handler sends neither — only
  `client_id` and `logout_uri`. A CSRF attack against the logout
  endpoint (forcing a victim to log out) is a low-severity attack but
  technically feasible because the logout flow is GET-based per
  Cognito's contract and ODD does not add CSRF state. The doc-side
  implication: an attacker can force any active ODD user to log out
  by tricking their browser into hitting ODD's `/logout` endpoint."
  — evidence: CognitoLogoutSuccessHandler.java:40-46 (no `state` or
  `nonce` parameters added) + WebFetch AWS docs 2026-05-19 (`state` is
  'Strongly recommended if you use a redirect_uri parameter') —
  severity: LOW

## security

- **auth_mode_relevance**: `OAUTH2`. This handler is registered as a
  Spring `@Component` only when `CognitoCondition` matches —
  `CognitoCondition` checks the runtime-read map at
  `auth.oauth2.client.*` for any entry with `provider: cognito` (case
  insensitive). The parent dispatcher `OAuthLogoutSuccessHandler` is
  itself gated by `@ConditionalOnProperty(value="auth.type",
  havingValue="OAUTH2")` (`OAuthLogoutSuccessHandler.java:16`), so the
  Cognito handler is reachable ONLY in `auth.type=OAUTH2` mode AND
  only when at least one Cognito client is registered. In
  `auth.type=DISABLED`, `LOGIN_FORM`, or `LDAP` modes the entire OAuth2
  logout chain is not registered.
- **ingestion_filter_relevance**: `N/A — UI-side logout flow, not an
  ingestion path`. The handler is invoked via Spring Security's logout
  filter chain on requests to `/logout`, not via `/ingestion/*`.
- **authorization_assertions**: `[]`. Logout success handlers do not
  enforce authorization gates — they are invoked AFTER Spring's logout
  filter has already authenticated the request. Spring's logout filter
  chain runs only for authenticated sessions; an unauthenticated user
  hitting `/logout` is a no-op before this handler is reached.
- **owner_scoping**: `N/A — code is not data-scoped`. The handler is a
  session-lifecycle hook; it does not read or filter any owner-scoped
  data.
- **data_exposure**:
  - `"The redirect URI sent to Cognito contains:
    client_id={ODD-configured Cognito app client ID} +
    logout_uri={ODD platform base URL}. The client_id is identifying
    metadata (the Cognito app client ID is not a secret per se, but it
    is one half of the OAuth2 client credentials pair; the secret half
    is the client-secret which is NOT sent in this redirect, only the
    client_id). The logout_uri reveals the platform's externally-reachable
    base URL — which is already public (it's the URL the user clicked
    logout on). No PII, no token, no session ID is in the redirect.
    → any party observing the user's browser network traffic (browser
    extensions, intercepting proxies, ISP MITM) sees both values."`
  - `"WebSession::invalidate() server-side mutation: removes the
    server-side session state from Spring WebFlux's session store.
    Default Spring WebFlux session store is in-memory; persistence
    layers (Redis, JDBC) would also have the session removed. No data
    leaves the platform via this step."`
- **known_security_gaps**:
  - `"No token revocation: the handler does not call Cognito's
    /oauth2/revoke endpoint. The OAuth2 access token (and refresh
    token, if Cognito issues one) remains valid server-side until
    natural expiry (default 1 hour for Cognito access tokens). An
    attacker who exfiltrated the access token before logout can
    continue using it against Cognito-protected downstream APIs.
    Compare with GoogleLogoutSuccessHandler.java:43-54 which DOES
    call /revoke. Asymmetric treatment across the 5 sibling handlers."
    — evidence: CognitoLogoutSuccessHandler.java:33-50 (no /revoke) +
    GoogleLogoutSuccessHandler.java:43-54 (contrast) — severity: MEDIUM`
  - `"Empty logoutUri produces silent no-op (no redirect + no session
    invalidation). An operator misconfigure that omits `logout-uri`
    means clicking logout does NOT log the user out — the user stays
    logged in with no error message. This is a defence-in-depth
    miss: the second half of the logout flow (WebSession::invalidate)
    is gated on the first half (logoutUri presence), so a missing
    logoutUri also disables the LOCAL session clear."
    — evidence: CognitoLogoutSuccessHandler.java:33-35 (return
    Mono.empty() BEFORE WebSession::invalidate at line 49) —
    severity: HIGH`
  - `"Cognito /logout does not sign user out of upstream federated
    IdPs (Google / Facebook / SAML brokers). A federated user is left
    with an active session at the upstream IdP — the next login
    attempt skips the password prompt. AWS docs explicitly call this
    out. The handler does not surface or document this."
    — evidence: CognitoLogoutSuccessHandler.java:40-46 (only calls
    Cognito /logout) + WebFetch AWS docs 2026-05-19 — severity: MEDIUM`
  - `"No CSRF protection on logout. The logout flow is GET-based per
    Cognito's contract and ODD does not add `state` / `nonce` query
    parameters. An attacker who tricks a victim's browser into
    requesting ODD's `/logout` endpoint forces the victim out. AWS
    docs strongly recommend `state` parameter. Low-severity attack
    (the worst an attacker achieves is forcing a user to log out)."
    — evidence: CognitoLogoutSuccessHandler.java:40-46 (no state/nonce)
    + WebFetch AWS docs 2026-05-19 ('Strongly recommended') —
    severity: LOW`
  - `"The post-logout redirect URI is dynamically derived from the
    incoming request hostname. A user who reaches ODD via an
    unallowed hostname (alias, internal hostname) experiences a
    Cognito-side error page instead of redirect-back. Cross-tenant
    risk in shared deployments where multiple hostnames front the
    same ODD instance."
    — evidence: CognitoLogoutSuccessHandler.java:43 + WebFetch AWS
    docs 2026-05-19 (Allowed sign-out URLs requirement) —
    severity: LOW`

## performance

- **hot_paths**: `[]`. Logout is a once-per-session event triggered by
  the user clicking the logout button — not a request-path hot path.
  Latency budget: a single 302 redirect (no upstream call from the
  platform; the browser follows the redirect to Cognito directly).
- **throughput_characteristics**: `"single-request handler — one logout
  per user session per logout-click; no batching, no async, no
  streaming. The Mono returned by handle() is a single-element
  reactive pipeline that does one session-store mutation
  (WebSession::invalidate) and returns Mono<Void>."`
- **resource_allocation**: `"minimal — one UriComponentsBuilder
  allocation per call, one URI.create() call (with the operator-set
  logoutUri string), one base-URI construction via UriUtils, one
  WebSession lookup + invalidate. No outbound HTTP from the platform
  (Cognito's /logout is reached via the user's browser following the
  302, NOT a direct platform-to-Cognito call)."`
- **scaling_characteristics**: `"stateless — the handler holds no
  instance state beyond the (read-only) injected ODDOAuth2Properties /
  OAuth2Provider records. Instances scale horizontally trivially."`
- **known_performance_gaps**: `[]`.

## sources

- understanding ← CognitoLogoutSuccessHandler.java:1-51 (full file)
- concepts.entities.CognitoLogoutSuccessHandler ← CognitoLogoutSuccessHandler.java:20-22
- concepts.entities.LogoutSuccessHandler ← LogoutSuccessHandler.java:8-14
- concepts.entities.CognitoCondition ← CognitoCondition.java:10-15
- concepts.entities.Provider.COGNITO ← Provider.java:3-5
- concepts.entities.OAuth2Provider ← ODDOAuth2Properties.java:30-53
- concepts.entities.UriUtils.getBaseUri ← UriUtils.java:11-23
- concepts.operations.short-circuit-when-logoutUri-empty ← CognitoLogoutSuccessHandler.java:33-35
- concepts.operations.build-302-redirect ← CognitoLogoutSuccessHandler.java:37-48
- concepts.operations.invalidate-local-webflux-session ← CognitoLogoutSuccessHandler.java:49
- concepts.invariants.case-insensitive-provider-match ← CognitoLogoutSuccessHandler.java:26
- concepts.invariants.empty-logoutUri-no-op ← CognitoLogoutSuccessHandler.java:33-35
- concepts.invariants.dynamic-logout_uri-from-request ← CognitoLogoutSuccessHandler.java:43 + UriUtils.java:11-23
- concepts.invariants.session-invalidation-after-redirect-header ← CognitoLogoutSuccessHandler.java:48-49
- dependencies_semantic.requires-config.auth_type ← OAuthLogoutSuccessHandler.java:16
- dependencies_semantic.requires-config.provider_cognito ← CognitoCondition.java:13 + AbstractProviderCondition.java:15-22
- dependencies_semantic.requires-config.logout-uri ← CognitoLogoutSuccessHandler.java:33,41
- dependencies_semantic.requires-config.client-id ← CognitoLogoutSuccessHandler.java:42 + ODDOAuth2Properties.java:22-24
- dependencies_semantic.requires-config.allowed-sign-out-urls ← WebFetch https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html (2026-05-19, 200)
- docs_link_semantic.inferred_docs.oauth2-oidc ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc (2026-05-19, 200)
- docs_link_semantic.inferred_docs.aws-cognito-logout ← WebFetch https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html (2026-05-19, 200)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch quotes + CognitoLogoutSuccessHandler.java:33-50
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch AWS docs ('Allowed sign-out URLs') + CognitoLogoutSuccessHandler.java:43
- docs_link_semantic.doc_drift_findings.[2] ← WebFetch AWS docs ('logout endpoint doesn't sign users out of OIDC or social identity providers') + CognitoLogoutSuccessHandler.java:40-46
- docs_link_semantic.doc_drift_findings.[3] ← WebFetch ODD docs + CognitoLogoutSuccessHandler.java:33-35
- implicit_adrs.[0] internal-LogoutSuccessHandler-routing-interface ← CognitoLogoutSuccessHandler.java:20-22 + OAuthLogoutSuccessHandler.java:30-42 + 4 sibling files
- implicit_adrs.[1] graceful-degradation-on-empty-logoutUri ← CognitoLogoutSuccessHandler.java:33-35 + AzureLogoutSuccessHandler.java:30-48 (contrast)
- implicit_adrs.[2] dynamic-logout_uri-from-request-not-config ← CognitoLogoutSuccessHandler.java:43 + AzureLogoutSuccessHandler.java:40 + GoogleLogoutSuccessHandler.java:40 + GithubLogoutSuccessHandler.java:45 + UriUtils.java:11-23
- implicit_adrs.[3] atomic-local-session-invalidation ← CognitoLogoutSuccessHandler.java:49 + 4 sibling files (consistent tail)
- bugs_limitations_corner_cases.[0] silent-no-op-on-empty-logoutUri ← CognitoLogoutSuccessHandler.java:33-35
- bugs_limitations_corner_cases.[1] no-upstream-IdP-signout ← CognitoLogoutSuccessHandler.java:40-46 + WebFetch AWS docs
- bugs_limitations_corner_cases.[2] dynamic-logout_uri-allowlist-coupling ← CognitoLogoutSuccessHandler.java:43 + WebFetch AWS docs
- bugs_limitations_corner_cases.[3] no-token-revocation ← CognitoLogoutSuccessHandler.java:33-50 + GoogleLogoutSuccessHandler.java:43-54 + GithubLogoutSuccessHandler.java:51-65 (contrasts)
- bugs_limitations_corner_cases.[4] no-clientId-null-guard ← CognitoLogoutSuccessHandler.java:42 + ODDOAuth2Properties.java:22-24
- bugs_limitations_corner_cases.[5] no-CSRF-state-nonce ← CognitoLogoutSuccessHandler.java:40-46 + WebFetch AWS docs
- security.auth_mode_relevance ← CognitoLogoutSuccessHandler.java:21 (@Conditional) + OAuthLogoutSuccessHandler.java:16 (@ConditionalOnProperty auth.type=OAUTH2)
- security.known_security_gaps.[0] no-token-revocation ← CognitoLogoutSuccessHandler.java:33-50 + GoogleLogoutSuccessHandler.java:43-54
- security.known_security_gaps.[1] empty-logoutUri-silent-no-op ← CognitoLogoutSuccessHandler.java:33-35
- security.known_security_gaps.[2] no-upstream-IdP-signout ← CognitoLogoutSuccessHandler.java:40-46 + WebFetch AWS docs
- security.known_security_gaps.[3] no-CSRF-state ← CognitoLogoutSuccessHandler.java:40-46 + WebFetch AWS docs
- security.known_security_gaps.[4] dynamic-allowlist-coupling ← CognitoLogoutSuccessHandler.java:43 + WebFetch AWS docs
- performance.scaling_characteristics ← CognitoLogoutSuccessHandler.java:20-22 (no instance state)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## back_links

- feature: F-011 (P-09:F-002 Principal-to-Owner Resolution) — TANGENTIAL.
  F-011 covers the principal-to-owner resolution mechanism that runs at
  login (AuthIdentityProviderImpl → user_owner_mapping resolution); this
  sidecar covers the inverse half (logout → session teardown). The two
  bookend the user-session lifecycle. F-011's drift facets (provider-null
  cross-mode bleed; S2S 'ADMIN' username collision) do NOT touch the
  logout flow — Cognito users carry a non-null `provider` value
  ('COGNITO') through their session and the logout handler uses that
  value only for `shouldHandle` dispatch, not for owner-resolution
  lookups. Coherence: the logout handler does NOT contradict F-011; it
  extends the security picture with a logout-side surface F-011 does not
  cover. Strengthens: F-011's pillar P-09 ('three independently-configured
  authentication surfaces') because logout is the dual of authentication —
  every auth mode that creates a session also needs a logout path.
- pillar: P-09 (Security & Access Control) — DIRECT. This sidecar is one
  of five sibling logout handlers per provider, all under P-09's
  surface area. The Cognito-specific handler completes the picture of
  the OAuth2 mode's session lifecycle. The known_security_gaps surface
  4 gaps (no token revocation, empty-logoutUri no-op, no upstream IdP
  signout, no CSRF state) that are P-09-relevant findings the concept
  catalog does not currently track.
- retrospectives: NONE. LSN-001 (attachment ephemeral default) is the
  closest stylistic analog — silent failure-mode of an
  operator-misconfigured default. The empty-logoutUri silent-no-op
  finding is the same shape (the handler degrades gracefully to silent
  no-op rather than fail-fast). Worth flagging to the concept-merger /
  adr-archaeologist that this pattern repeats: ODD's tendency to prefer
  graceful-degradation over fail-fast surfaces silent operator
  misconfigurations.

## Maintainer notes
