---
node_id: "odd-platform java DataCollaborationController controller-class:DataCollaborationController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-25-ZF-DataCollaborationController
pillar_anchored_features:
  - P-07 Active Platform Features (Discussions sub-feature)
  - P-09 Security & Access Control (Slack token blast-radius + missing RBAC + open-redirect class)
  - P-08 Management & Administration (datacollaboration.* config namespace, opt-in feature flag)
---

# DataCollaborationController — semantic understanding

## understanding

`DataCollaborationController` is a 50-line Spring WebFlux `@RestController` implementing the OpenAPI-generated `DataCollaborationApi` and exposing exactly three endpoints behind the **Discussions** sub-feature of pillar P-07 (`system-mission.md:200-215`): `GET /api/datacollaboration/providers/slack/channels` (`getSlackChannels` lines 25-31 — channel-autocomplete for the Slack channel picker), `POST /api/datacollaboration/providers/slack/messages` (`postMessageInSlack` lines 33-39 — enqueue message for asynchronous Slack delivery; see the per-method sidecar `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md` for the deep-dive on that endpoint), and `GET /api/messages/{message_id}/url` (`redirect` lines 41-49 — server-side 302 to the message's Slack permalink). The whole controller is class-gated by `@ConditionalOnDataCollaboration` (line 21): when `datacollaboration.enabled` is `false` (the application.yml default at line 205), the bean is not registered and all three routes return **404 Not Found** — verified by `DataCollaborationFeatureCondition.matches` (`DataCollaborationFeatureCondition.java:18-22`) which reads `FeatureResolver.DATA_COLLABORATION_ENABLED_PROPERTY` via the environment. Six substantive findings drive operator-visible behaviour: (1) **Slack OAuth bot token is the SOLE secret protecting the workspace** — held at `datacollaboration.slack-oauth-token` (`DataCollaborationConfiguration.java:21`), used to construct a singleton `AsyncMethodsClient` at boot (line 27), so any compromise of the platform process / `/actuator/env` / configured property leaks workspace channel enumeration + post-as-bot capability; (2) **all three endpoints have NO RBAC permission gate** — `SecurityConstants.SECURITY_RULES` has no entry for `/api/datacollaboration/**` or `/api/messages/**` (verified via grep of `SecurityConstants.java:98-355`), so all three fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`); any authenticated user under LOGIN_FORM / OAUTH2 / LDAP can call all three endpoints regardless of which `DATA_*` permissions they hold; (3) **the `redirect` endpoint is a classic open-redirect-class surface** — the controller emits `ResponseEntity.status(FOUND).headers(h -> h.setLocation(URI.create(providerUrl))).build()` (lines 42-48) where `providerUrl` comes from Slack's `chat.getPermalink` API (`SlackAPIClientImpl.java:84-95`) UNCONDITIONALLY — the controller does NOT validate the URL host/scheme/structure before redirecting. The trust assumption is "Slack returns a slack.com URL"; the assumption is enforced nowhere; if Slack's API ever returned an attacker-controlled URL (or a malformed `URI.create` throws), the failure mode is either an exception bubbling to a 5xx OR a 302 to wherever Slack said; (4) **status-code drift on `redirect`** — OpenAPI declares `301 Moved Permanently` (`openapi.yaml:1788-1789`) but the controller emits `HttpStatus.FOUND` (302) (line 45); the live api-reference doc page WebFetched 2026-05-25 (status 200) acknowledges the drift explicitly ("the OpenAPI spec declares 301 Moved Permanently for this route; the platform actually serves 302 Found"), but client code-generated from the spec may interpret the response differently; (5) **`getSlackChannels` uses `channelName.startsWith(...)` filtering, NOT `contains` / `fuzzy`** — `SlackMessageProviderClient.java:50-55` invokes `slackChannel.name().startsWith(nameLike)`; a user typing the middle of a channel name into the autocomplete returns zero results despite the channel existing in the bot's joined set; the UI's `useDebouncedCallback(500ms)` (`SlackChannelsAutocomplete.tsx:43-54`) drives this filter call on every keystroke; (6) **channel cache is 1-minute TTL Caffeine, size 1** — `SlackMessageProviderClient.java:36-44` builds an `AsyncLoadingCache` with `expireAfterWrite(1, MINUTES)` and `maximumSize(1)` keyed on a fixed sentinel string; the actual `conversations.list` Slack API call (paginated 200/page at `SlackAPIClientImpl.java:26, 130-141`) happens on cache miss; under a stale-cache window of up to 60 seconds, freshly-invited or freshly-removed bot-channel membership is invisible to the autocomplete. The controller's class-level `@RequiredArgsConstructor` (line 19) injects a single `DataCollaborationService` (line 23); every method body is a two-to-four-line reactive delegation. No tests exist (`grep DataCollaborationController <odd-platform-repo>/odd-platform-api/src/test` returns zero matches).

## concepts

- entities: [
    "`DataCollaborationApi` — OpenAPI-generated controller interface implemented at line 22; the three method signatures derive from `openapi.yaml:3704-3743` (`/api/datacollaboration/providers/slack/channels`, `/api/datacollaboration/providers/slack/messages`) and `openapi.yaml:1776-1791` (`/api/messages/{message_id}/url`).",
    "`DataCollaborationService` — single injected service bean (line 23); 4-method interface (`DataCollaborationService.java:11-19`) of which this controller invokes 3 (`getChannels`, `createAndSendMessage`, `resolveMessageUrl`); the 4th (`enqueueMessageEvent`) is called by `EventApiController` (`EventApiController.java:18-42`) — the sibling controller in the same package handling Slack-side webhooks.",
    "`MessageProviderDto.SLACK` — provider enum literal passed to the service for both `getSlackChannels` (line 29) and `postMessageInSlack` (line 37); the service uses `MessageProviderClientFactory.getOrFail(SLACK)` to resolve the `SlackMessageProviderClient` bean (`DataCollaborationServiceImpl.java:41, 53-54, 74-75`).",
    "`MessageChannelList` — response shape for `getSlackChannels`; wraps `items: List<MessageChannel>`. Each `MessageChannel = {channel_id, name}` per `components.yaml` MessageChannel schema.",
    "`MessageChannelDto` — internal channel record (`{id, name}`); produced by `SlackAPIClientImpl.getSlackChannels` (line 46) and `exchangeForChannel` (lines 57-60); mapped to `MessageChannel` via `MessageMapper.mapSlackChannel` (`MessageMapper.java:89-94`).",
    "`MessageRequest` — POST body for `postMessageInSlack`; `{data_entity_id, channel_id, text}` per the OpenAPI MessageRequest schema (components.yaml:3410-3423 per the per-method sidecar). Deep-dive in `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md`.",
    "`Message` — response shape returned by `postMessageInSlack` AND embedded in message-list payloads; built by `MessageMapper.mapPojo` (`MessageMapper.java:21-28`) — sets `url = /api/messages/{uuid}/url` (`MessageMapper.java:85-87`) as a relative server-side path that the UI's `<Button to={url} target='_blank'>` in `Message.tsx:60-66` opens in a new tab, triggering the `redirect` endpoint on this controller.",
    "`MessageProviderIdentity` — internal record returned by `ReactiveMessageRepository.getMessageProviderIdentity` (`ReactiveMessageRepositoryImpl.java:171-185`); carries `{providerMessageId, providerMessageChannel, messageProvider}` — used by `resolveMessageUrl` to call back to Slack's `chat.getPermalink`.",
    "`messageId: UUID` — path-parameter for `redirect` (line 42); MUST be UUIDv1 because `ReactiveMessageRepositoryImpl.getMessageProviderIdentity` (`:176-177`) binds BOTH `MESSAGE.UUID.eq(messageId)` AND `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))` (a covering-index assist; a non-v1 UUID returns wrong timestamp → empty result).",
    "`channelName: String` — query-parameter for `getSlackChannels` (line 26); name is `channel_name` per OpenAPI (`openapi.yaml:3710-3713`); flows through `DataCollaborationServiceImpl.getChannels` (`:40-45`) as `nameLike` → `SlackMessageProviderClient.getChannels` (`:47-56`) where it is filtered via `slackChannel.name().startsWith(nameLike)` (NOT contains).",
    "`AsyncMethodsClient` — the Slack SDK's reactive client (`com.slack.api.methods.AsyncMethodsClient`); constructed once at boot in `DataCollaborationConfiguration.slackAPIClient` (`:27`) and injected into `SlackAPIClientImpl` as a constructor argument; reused across all requests (no per-request build).",
    "`ServerWebExchange` — Spring WebFlux reactive request context; injected on all three methods but used by NONE of them."
  ]
- operations: [
    "`getSlackChannels(String channelName, ServerWebExchange exchange)` (lines 25-31) — autocomplete-read; `dataCollaborationService.getChannels(channelName, SLACK).map(ResponseEntity::ok)`. Downstream chain: `DataCollaborationServiceImpl.getChannels` (`:40-45`) → `messageProviderClientFactory.getOrFail(SLACK).getChannels(channelName)` → `SlackMessageProviderClient.getChannels` (`:47-56`) which reads from the Caffeine cache (`:36-44`) and filters by `name.startsWith(nameLike)`. Returns `MessageChannelList{items: List<MessageChannel>}`. **The actual Slack API call (`conversations.list`, paginated 200/page) only happens on cache miss** — within a 60-second window the same channel set is reused across all callers; under a freshly-invited bot, the new channel is invisible to autocomplete for up to 60 seconds.",
    "`postMessageInSlack(Mono<MessageRequest> messageRequest, ServerWebExchange exchange)` (lines 33-39) — enqueue-write; deep-dive in the per-method sidecar. Returns **`202 Accepted`** (explicit `HttpStatus.ACCEPTED` line 38) after persisting a `messages` row in `PENDING_SEND` state. The actual Slack `chat.postMessage` happens asynchronously in `DataCollaborationMessageSenderJob` under a Postgres-advisory-lock-elected leader (lock id `datacollaboration.sender-message-advisory-lock-id` = `120` per application.yml:202).",
    "`redirect(UUID messageId, ServerWebExchange exchange)` (lines 41-49) — server-side redirect; `dataCollaborationService.resolveMessageUrl(messageId).map(providerUrl -> ResponseEntity.status(FOUND).headers(h -> h.setLocation(URI.create(providerUrl))).build())`. Downstream chain: `DataCollaborationServiceImpl.resolveMessageUrl` (`:72-77`) → `reactiveMessageRepository.getMessageProviderIdentity(messageId)` (`ReactiveMessageRepositoryImpl.java:171-185`) → `messageProviderClientFactory.getOrFail(messageIdentity.messageProvider()).resolveMessageUrl(channelId, messageTs)` → `SlackMessageProviderClient.resolveMessageUrl` (`:64-66`) → `SlackAPIClientImpl.exchangeForUrl` (`:83-95`) which calls Slack's `chat.getPermalink` and returns the `response.getPermalink()` string verbatim. **The controller does NOT validate `providerUrl` before redirecting**: no host check (e.g., `URI.create(providerUrl).getHost().endsWith(\"slack.com\")`), no scheme check (could be `javascript:` if Slack ever returned one), no malformed-URI handler (`URI.create` throws `IllegalArgumentException` for malformed input, which bubbles to the WebFlux exception handler as 5xx). Status code is `HttpStatus.FOUND` (302) — **drifts from OpenAPI's declared 301** (`openapi.yaml:1788-1789`)."
  ]
- invariants: [
    "**Class-level `@ConditionalOnDataCollaboration` (line 21) gates ALL three endpoints** — when `datacollaboration.enabled=false` (the application.yml default at line 205), the bean is not registered and all three routes return 404 Not Found. The flag is read in `DataCollaborationFeatureCondition.matches` (`:18-22`) via `FeatureResolver.DATA_COLLABORATION_ENABLED_PROPERTY` = `\"datacollaboration.enabled\"` (`FeatureResolver.java:6`).",
    "**Slack OAuth bot token is REQUIRED for boot when `datacollaboration.enabled=true`** — `DataCollaborationConfiguration.slackAPIClient` (`:20-29`) executes `if (StringUtils.isEmpty(slackOauthToken)) throw new IllegalArgumentException(\"Slack OAuth token is empty\")` at bean construction; the application context fails to start if the token is unset.",
    "**All three endpoints are RBAC-ungated** — `SecurityConstants.SECURITY_RULES` has zero entries matching `/api/datacollaboration/**` or `/api/messages/**`; all three fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`). The only auth gate is the per-mode authentication (LOGIN_FORM credentials / OAUTH2 OIDC / LDAP bind).",
    "**Under `auth.type=DISABLED` ALL three endpoints are anonymously reachable** — `DisabledAuthSecurityConfiguration` (cross-reference IntegrationController sidecar) applies `.anyExchange().permitAll()`; any network caller (no auth required) reaches every Discussions endpoint when DISABLED is set. The feature flag (`datacollaboration.enabled`) is the SOLE defence in DISABLED mode.",
    "**The `redirect` endpoint trusts Slack's `chat.getPermalink` response verbatim** — `URI.create(providerUrl)` consumes whatever string Slack returns; no host / scheme / structure validation in the controller (lines 42-48) or in `DataCollaborationServiceImpl.resolveMessageUrl` (`:72-77`) or in `SlackMessageProviderClient.resolveMessageUrl` (`:64-66`) or in `SlackAPIClientImpl.exchangeForUrl` (`:84-95`).",
    "**`getSlackChannels` filters by `startsWith`, not `contains`** — `SlackMessageProviderClient.java:52` is `slackChannel.name().startsWith(nameLike)`. A user typing the middle of a channel name (`platform` to find `#odd-platform-alerts`) gets zero results despite the channel existing in the bot's joined set.",
    "**The 1-minute Caffeine cache fronts the Slack channel listing** — `SlackMessageProviderClient.java:38-44` (`maximumSize(1)`, `expireAfterWrite(1, MINUTES)`); fresh invites are invisible for up to 60 seconds.",
    "**Slack `conversations.list` filter** — `SlackAPIClientImpl.java:45` applies `.filter(Conversation::isMember)` after fetching with `ConversationType.PUBLIC_CHANNEL` only (line 132); the bot sees ONLY public channels it has been explicitly added to. Private channels, DMs, and group DMs are excluded entirely. Combined with `excludeArchived(true)` (line 131), the autocomplete returns active public channels the bot is in.",
    "**`messageId` MUST be a UUIDv1** — `ReactiveMessageRepositoryImpl.getMessageProviderIdentity` (`:176-177`) binds an extra `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))` condition; a non-v1 UUID extracts a wrong timestamp, the WHERE clause fails, the inner Mono is empty, and (per the controller-class invariant on `Mono.empty`) the `redirect` endpoint returns 200 OK with no body — NOT 404. The path lacks any `switchIfEmpty(Mono.error(new NotFoundException(...)))`.",
    "**The OpenAPI spec for `redirect` declares 301 but the controller emits 302** — `openapi.yaml:1788-1789` vs `DataCollaborationController.java:45`. The live api-reference doc page (`https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration`, WebFetched 2026-05-25, status 200) explicitly acknowledges the drift."
  ]
- audiences: [
    "odd-platform-ui-end-user — Data Entity Details → Discussions tab; sub-component `CreateMessageForm.tsx` invokes `postMessageInSlack` via `createMessageToSlack` thunk (`dataCollaboration.thunks.ts:31-44`); `SlackChannelsAutocomplete.tsx:43-54` invokes `getSlackChannels` via `fetchSlackChannels` thunk on every debounced keystroke (500ms); `Message.tsx:60-66` renders an 'Open in Slack' button that opens the `url` field (= `/api/messages/{uuid}/url`) in a new tab, triggering `redirect`.",
    "odd-api-consumer — programmatic clients via the OpenAPI spec at `/api/v3/api-docs`; the live api-reference doc page enumerates all three endpoints.",
    "Slack workspace — outbound to `chat.postMessage` (per the per-method sidecar) and to `chat.getPermalink` (`redirect`) and `conversations.list` (`getSlackChannels`) and `conversations.info` (`createAndSendMessage` channel-validation hop).",
    "platform-operator — sets `datacollaboration.enabled=true` plus `datacollaboration.slack-oauth-token` to enable the Discussions sub-feature; the property namespace also carries `sender-message-advisory-lock-id`, `receive-event-advisory-lock-id`, `sending-messages-retry-count`, `message-partition-period`.",
    "browser-as-redirect-target — the `redirect` endpoint produces a 302 with `Location:` set to whatever Slack returned from `chat.getPermalink`; the browser follows the redirect; the user lands on a slack.com URL (under the trust assumption that Slack returns slack.com URLs)."
  ]

## dependencies_semantic

- requires-feature: [
    "`datacollaboration.enabled=true` (`DataCollaborationFeatureCondition.java:18-22` + `application.yml:205` default `false`) — class-level gate; bean not registered when false → 404 on all three routes.",
    "`DataCollaborationApi` OpenAPI-generated controller interface (`api.contract.api.DataCollaborationApi`) — three method signatures derive from `openapi.yaml:3704-3743` + `openapi.yaml:1776-1791`.",
    "`DataCollaborationService` (`:11-19`) — 4-method service contract.",
    "`SlackAPIClient` (`SlackAPIClient.java:11-21`) → `SlackAPIClientImpl` (`SlackAPIClientImpl.java:25-141`) — wraps `com.slack.api:slack-api-client` SDK's `AsyncMethodsClient`.",
    "`AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:20-30`) — catch-all `authenticated()` rule applies to all three endpoints; the only RBAC integration."
  ]
- requires-config: [
    "`datacollaboration.enabled` (`application.yml:205` = `false`) — feature flag.",
    "`datacollaboration.slack-oauth-token` (`DataCollaborationConfiguration.java:21` — fail-fast empty-check at boot; `application.yml:206` commented placeholder) — bot OAuth token (`xoxb-...`) signing every outbound Slack call.",
    "`datacollaboration.sender-message-advisory-lock-id` (`DataCollaborationProperties.java:10` + `application.yml:202` = `120`) — Postgres advisory lock for the single-leader sender. Per-method sidecar covers this in detail.",
    "`datacollaboration.receive-event-advisory-lock-id` (`DataCollaborationProperties.java:11` + `application.yml:201` = `110`) — Postgres advisory lock for the Slack-events processor (consumed by `EventApiController` + `DataCollaborationMessageEventProcessor`).",
    "`datacollaboration.sending-messages-retry-count` (`DataCollaborationProperties.java:12` + `application.yml:204` = `3`) — retry budget; validated `>=0` in `@PostConstruct validate()` (lines 14-20).",
    "`datacollaboration.message-partition-period` (`application.yml:203` = `30`) — partition period for the `messages` table; not consumed by this controller directly.",
    "Slack OAuth scopes the bot token MUST hold for the controller to function: `channels:read` (for `conversations.list` in `getSlackChannels`), `chat:write` (for `chat.postMessage` in `postMessageInSlack`), `chat:read` (for `chat.getPermalink` in `redirect`) — verified via Slack docs WebFetch 2026-05-25 (`https://docs.slack.dev/reference/methods/conversations.list`)."
  ]
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `@RestController` (line 20); reactive `Mono`/`Flux` throughout.",
    "Lombok `@RequiredArgsConstructor` (line 19).",
    "`reactor.core.publisher.Mono`.",
    "Spring Security ReactiveSecurityWebFilterChain — composed via `OAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` / `LdapSecurityConfiguration` / `SecurityConfiguration`; catch-all `authenticated()` per `AuthorizationCustomizer.java:29-30`.",
    "Live Slack workspace reachability for the `chat.getPermalink` (`redirect`) and `conversations.list` (`getSlackChannels`) calls; Slack outage = stale cache OR 5xx (since neither call has explicit fallback in the controller).",
    "`ReactiveMessageRepository.getMessageProviderIdentity(UUID)` (`ReactiveMessageRepositoryImpl.java:171-185`) — JOOQ query against the `messages` table, gated by both `UUID.eq` and `CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))`.",
    "Caffeine async-loading cache (`SlackMessageProviderClient.java:36-44`) for the channel set — 1-minute TTL, size 1, keyed on a fixed sentinel."
  ]
- couples-to: [
    "`DataCollaborationApi` (`implements` at line 22) — every method is `@Override` of the generated interface.",
    "`DataCollaborationService` (constructor-injected line 23).",
    "`MessageProviderDto.SLACK` (line 29, 37) — provider enum literal hard-coded across two methods; if a new provider is added, the controller MUST be updated (the OpenAPI spec already path-qualifies as `/providers/slack/...`).",
    "`SecurityConstants.SECURITY_RULES` + `AuthorizationCustomizer` — coupled by absence (no entries for these paths); the contract is 'this controller is RBAC-ungated'.",
    "`com.slack.api:slack-api-client` SDK — transitively via `SlackAPIClientImpl`."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
    - behaviour: "Class-gate: 404 on all three routes when `datacollaboration.enabled=false`."
      test_class: integration
      criticality: HIGH
      test_files: []
      note: "No `DataCollaborationControllerTest.java` exists; verified via `grep DataCollaborationController <odd-platform-repo>/odd-platform-api/src/test` (zero matches)."
    - behaviour: "Auth-mode matrix: every endpoint returns 401 under LOGIN_FORM/OAUTH2/LDAP for unauthenticated; reaches the controller under authenticated regardless of RBAC role; reaches anonymously under DISABLED."
      test_class: security
      criticality: HIGH
      test_files: []
    - behaviour: "`getSlackChannels` `startsWith`-not-contains filter — query `platform` on a workspace with channel `odd-platform-alerts` returns empty."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`getSlackChannels` cache staleness — invite the bot to a new channel; assert it does NOT appear in the response within 1 second; assert it DOES appear after 60+ seconds."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`redirect` happy path — UUIDv1 of an existing `PENDING_SENT` message → 302 with `Location:` = slack.com permalink."
      test_class: integration
      criticality: HIGH
      test_files: []
    - behaviour: "`redirect` status-code drift — assert response is 302 (de facto) vs OpenAPI 301."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`redirect` open-redirect class — when Slack's `chat.getPermalink` returns an attacker-controlled URL (mock SlackAPIClient), assert the controller still emits the 302 to that URL (the unconditional trust). This is the bug-class boundary."
      test_class: security
      criticality: HIGH
      test_files: []
    - behaviour: "`redirect` non-v1 UUID — assert response is 200 OK with empty body (NOT 404)."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`redirect` non-existent UUIDv1 — assert response is 200 OK with empty body (NOT 404)."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "Slack token blast-radius: with a leaked bot token, an attacker can enumerate all bot-member channels via `conversations.list` and post messages to any of them via `chat.postMessage`. Verified by Slack API docs (not exercisable inside the platform process); record as an operational invariant."
      test_class: security
      criticality: HIGH
      test_files: []
- test_files: []
- gaps: |
    Zero Java test files cover `DataCollaborationController` or any of its three
    endpoints. The class is class-gated by an opt-in flag, so a default-checkout
    build won't even register the bean; that explains the test absence somewhat,
    but the auth-mode matrix + the open-redirect class + the status-code drift
    are all production-relevant correctness questions that a single
    `DataCollaborationControllerIntegrationTest` could pin. The highest-leverage
    gap is the **security class** — the auth-mode matrix + the open-redirect
    class + the Slack-token blast-radius operational invariant. The
    **integration class** has the next-highest leverage — the class-gate
    behaviour, the `startsWith` filter drift, the cache staleness, the
    non-v1-UUID and non-existent-UUID edge cases for `redirect`, and the
    status-code drift. Performance has lower leverage (the feature is low-volume
    in practice).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/active-platform-features/data-collaboration"
    anchor: ""
    rationale: "Canonical user-facing home for the Discussions sub-feature (P-07); describes when the Discussions tab appears, the message-lifecycle model, the opt-in flag."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      WebFetch returned 404; the URL active-platform-features/data-collaboration does not exist on the live site. Live response: "This page returns a 404 error indicating the URL `active-platform-features/data-collaboration` does not exist. The page offers alternative resources." This is the same 404 status documented in the per-method sidecar's docs_link_semantic at enrichment time 2026-05-10.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration"
    anchor: ""
    rationale: "API-reference page enumerates all 7 routes in the data-collaboration namespace including the three on this controller."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Endpoints listed on the live page: (1) GET /api/datacollaboration/providers/slack/channels — "List Slack channels the bot can write to, optionally filtered by `channel_name`. Used by the in-app channel autocomplete." (2) POST /api/datacollaboration/providers/slack/messages. (3) GET /api/dataentities/{data_entity_id}/messages. (4) GET /api/dataentities/{data_entity_id}/messages/{message_id}. (5) GET /api/dataentities/{data_entity_id}/channels. (6) GET /api/messages/{message_id}/url — "302 Found redirect to the provider's deep-link for the message. The OpenAPI spec declares `301 Moved Permanently` for this route; the platform actually serves `302 Found`. Operators should treat responses as 302." (7) POST /api/slack/events. The page does NOT detail any auth/security/RBAC requirements for these endpoints.
- doc_drift_findings:
  - "Live `active-platform-features/data-collaboration` returns 404 — the user-facing canonical home for the Discussions sub-feature is broken. Source markdown exists at `documentation/docs/active-platform-features/data-collaboration.md` (per the per-method sidecar's fetched_excerpts) but is not published. Operator Googling 'odd discussions' lands on broken pages. Severity: HIGH (also surfaced in the per-method sidecar)."
  - "Live api-reference page acknowledges the 302-vs-301 drift on the `redirect` endpoint, but the OpenAPI spec at `openapi.yaml:1788-1789` STILL declares `301 Moved Permanently`. Spec-generated client code may interpret responses incorrectly. Three sources of truth disagree: code (302), spec (301), live doc (302 + note). Severity: MEDIUM."
  - "Live api-reference page does not state which Permission gates any of the three endpoints — and in fact there is none; any authenticated user can call any of them under LOGIN_FORM/OAUTH2/LDAP, and any anonymous caller under DISABLED. Reader cannot infer authorization model from the live docs. Severity: MEDIUM (also surfaced in the per-method sidecar)."
  - "Live api-reference describes `channel_name` as 'optionally filtered by `channel_name`' — does NOT state that the filter is `startsWith`, not `contains` or fuzzy. A user typing the middle of a channel name expects results; gets empty. Severity: LOW."
  - "Live api-reference does not state the 1-minute Caffeine cache TTL for the channel list — a user who just invited the bot to a new channel expects to see it immediately. Severity: LOW."

## implicit_adrs

- "Discussions ships disabled-by-default, opt-in via a single property (`datacollaboration.enabled`)." — evidence: `application.yml:205` (`enabled: false`) + `DataCollaborationFeatureCondition.java:18-22` — intent_anchor: `enabled: false` as the application.yml default coupled to the `Conditional` reading `featureEnabled` from `datacollaboration.enabled` — confidence: HIGH
- "Slack OAuth token is required at bean-construction time — boot fails fast rather than degrading silently when the token is missing." — evidence: `DataCollaborationConfiguration.java:23-25` — intent_anchor: `throw new IllegalArgumentException("Slack OAuth token is empty")` — confidence: HIGH
- "Controller is a thin reactive proxy — every method delegates straight to `DataCollaborationService` with no per-request business logic in the controller itself." — evidence: `DataCollaborationController.java:25-49` (every method body is a single fluent chain on the service) — intent_anchor: the consistent shape across all three methods — confidence: HIGH
- "Slack channels are cached at the service tier (1-minute TTL, single-entry Caffeine) rather than asking Slack on every autocomplete keystroke." — evidence: `SlackMessageProviderClient.java:36-44` — intent_anchor: the explicit `@PostConstruct init()` building the Caffeine cache with `expireAfterWrite(1, MINUTES)` and `maximumSize(1)` plus the comment-free decision to use a single fixed-key entry holding the full channel map — confidence: HIGH
- "Outbound Slack delivery is decoupled from the HTTP request (202 + queue + leader-elected sender) — same architectural decision as in the per-method sidecar; recorded here at the class level for completeness." — evidence: `DataCollaborationController.java:38` + `DataCollaborationMessageSenderJob.java:23-87` — intent_anchor: the `HttpStatus.ACCEPTED` paired with the queue/sender/lock decomposition — confidence: HIGH
- "MessageId is UUIDv1 (not v4) — encodes the message's creation timestamp into the UUID itself, enabling a covering-index assist at lookup time via `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))`." — evidence: `ReactiveMessageRepositoryImpl.java:177` + `UUIDHelper.generateUUIDv1()` (`DataCollaborationServiceImpl.java:89`) + `UUIDHelper.extractDateTimeFromUUID` — intent_anchor: the consistent use of `UUIDHelper.generateUUIDv1()` at message creation paired with the `extractDateTimeFromUUID` predicate at lookup time — the timestamp-embedding design is an explicit performance / partition-pruning choice — confidence: HIGH

## bugs_limitations_corner_cases

- "Open-redirect-class surface on `redirect`: the controller emits `ResponseEntity.status(FOUND).headers(h -> h.setLocation(URI.create(providerUrl)))` (lines 42-48) where `providerUrl` comes from Slack's `chat.getPermalink` response (`SlackAPIClientImpl.java:84-95`) UNCONDITIONALLY. No host check, no scheme check (could be `javascript:` if Slack ever returned one), no allowlist of known-good URL prefixes (e.g., `https://*.slack.com/archives/...`). The trust assumption is 'Slack returns slack.com URLs' — enforced nowhere in the controller-service-client chain. If Slack's API were compromised or returned a malformed URL, the platform becomes a redirector. The class-of-bug is OWASP A01 'Broken Access Control / Open Redirect' (see P-145). Severity: MEDIUM (depends on Slack's API integrity; Slack's reputation for not returning attacker-controlled permalinks is the SOLE defence)." — evidence: `DataCollaborationController.java:42-48` + `DataCollaborationServiceImpl.java:72-77` + `SlackMessageProviderClient.java:64-66` + `SlackAPIClientImpl.java:83-95` — severity: MEDIUM
- "Status-code drift on `redirect`: OpenAPI declares `301 Moved Permanently` (`openapi.yaml:1788-1789`) but the controller emits `HttpStatus.FOUND` (302) (`DataCollaborationController.java:45`). Spec-generated client code (`generated-sources` in `odd-platform-ui`) may interpret the responses differently. Live api-reference doc page acknowledges the drift, but the OpenAPI YAML is still wrong." — evidence: `openapi.yaml:1788-1789` + `DataCollaborationController.java:45` — severity: MEDIUM
- "No 404 / NotFoundException path on `redirect`: when `messageId` does not exist OR is not a valid UUIDv1 (causes `extractDateTimeFromUUID(messageId)` to produce a wrong timestamp), `ReactiveMessageRepositoryImpl.getMessageProviderIdentity` returns `Mono.empty`. The controller's `dataCollaborationService.resolveMessageUrl(messageId).map(...)` short-circuits to `Mono.empty`. Spring WebFlux translates `Mono.empty` from a controller to `200 OK` with NO body — NOT `404 Not Found`. There is no `switchIfEmpty(Mono.error(new NotFoundException(...)))` anywhere in the chain. A caller cannot distinguish 'message does not exist' from 'message exists but Slack returned no permalink'." — evidence: `DataCollaborationController.java:41-49` + `DataCollaborationServiceImpl.java:72-77` + `ReactiveMessageRepositoryImpl.java:171-185` — severity: MEDIUM
- "Slack-side errors on `redirect` surface as 5xx, not 4xx: `SlackAPIClientImpl.exchangeForUrl` (`:84-95`) emits `sink.error(new SlackAPIException(response.getError()))` when `!response.isOk()`. The Spring WebFlux default-error handler maps this to `500 Internal Server Error`. A user clicking 'Open in Slack' on a message whose Slack-side permalink retrieval fails (channel archived, message deleted Slack-side, token scope changed, rate-limited) gets a 5xx — not a more accurate 4xx with a structured error body." — evidence: `SlackAPIClientImpl.java:84-95` + `SlackAPIException.java` (sibling) — severity: MEDIUM
- "Channel filter is `startsWith`, not `contains`: `SlackMessageProviderClient.getChannels` (`:52`) is `slackChannel.name().startsWith(nameLike)`. A user typing `platform` to find `#odd-platform-alerts` gets zero results. The UI's debounced 500ms autocomplete (`SlackChannelsAutocomplete.tsx:43-54`) drives this on every keystroke; the only feedback the user gets is an empty dropdown. Severity is MEDIUM because the UI does not surface 'this is a prefix match' anywhere." — evidence: `SlackMessageProviderClient.java:50-55` + `SlackChannelsAutocomplete.tsx:43-54` — severity: MEDIUM
- "Caffeine cache staleness window of up to 60 seconds: `SlackMessageProviderClient.java:36-44` sets `expireAfterWrite(1, MINUTES)`. A freshly-invited bot is invisible to the autocomplete for up to 60 seconds; a freshly-removed bot is still visible for up to 60 seconds. No cache-invalidation hook exists for `member_joined_channel` / `member_left_channel` Slack events (which `EventApiController` does process — but the cache lives in `SlackMessageProviderClient`, not the event processor)." — evidence: `SlackMessageProviderClient.java:36-44` + `EventApiController.java:18-42` (no cache invalidation in the event processor chain) — severity: LOW
- "Channel cache holds the full channel map — `maximumSize(1)` (`SlackMessageProviderClient.java:39`) means a single cache entry holds a `Map<String, MessageChannelDto>` of ALL bot-member channels. For a workspace with 10K+ channels, this is a non-trivial heap allocation every minute on cache miss. The cache miss triggers a paginated `conversations.list` walk at 200 channels/page (`SlackAPIClientImpl.java:26, 130-141`) — for 10K channels that's 50 round-trips to Slack per cache miss, every minute under the worst case." — evidence: `SlackMessageProviderClient.java:36-44` + `SlackAPIClientImpl.java:26, 30-47, 130-141` — severity: LOW
- "Slack bot OAuth token is the single secret protecting the workspace integration. Token leak (via `/actuator/env`, log emission, configured-property exposure, container-image extraction) → attacker can enumerate ALL bot-member channels via `conversations.list` AND post messages as the bot via `chat.postMessage` AND retrieve permalinks via `chat.getPermalink`. Spring's default Sanitizer DOES mask `token`-suffixed property names (property name `slack-oauth-token` matches), but masking is the sole defence; there is no env-var-rotation hook, no token-lifecycle integration, no fail-closed on token revocation (a revoked token returns `invalid_auth` from Slack → `SlackAPIException` → 5xx, but the platform does NOT mark the feature as broken)." — evidence: `DataCollaborationConfiguration.java:19-29` + Slack docs (WebFetched 2026-05-25 `https://docs.slack.dev/reference/methods/conversations.list`: bot token scopes `channels:read`) — severity: HIGH (operational invariant for any operator running the Discussions sub-feature)
- "No RBAC permission on any of the three endpoints: zero entries in `SecurityConstants.SECURITY_RULES` match `/api/datacollaboration/**` or `/api/messages/**`. All three endpoints fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`). Combined with the missing 404 path on `redirect`, ANY authenticated user can probe message ids — receive 200/empty for non-existent and 302/slack-url for existing — effectively a message-existence-by-id oracle." — evidence: `SecurityConstants.java:98-355` (no matching entries) + `AuthorizationCustomizer.java:29-30` + `DataCollaborationController.java:25-49` — severity: HIGH
- "Under `auth.type=DISABLED`, all three endpoints are anonymously reachable. The feature flag (`datacollaboration.enabled`) is the only defence: in DISABLED mode the catch-all path matcher is `.anyExchange().permitAll()` (cross-reference IntegrationController sidecar), so any caller (no auth required) reaches every Discussions endpoint when the feature flag is on. This is consistent with the platform-wide auth-mode behaviour but is operator-relevant: turning Discussions ON in a DISABLED deployment publishes all three endpoints to the network." — evidence: `AuthorizationCustomizer.java:20-30` + `DisabledAuthSecurityConfiguration` (cross-reference IntegrationController sidecar) — severity: HIGH
- "No audit logging of redirect activity: there is no `log.info(...)` on the redirect path; the platform records WHO redirected to WHICH message at WHICH time nowhere. Combined with the absence of RBAC, this means any authenticated user can probe-by-id without leaving an audit trail. The `messages` table records the message author (ownerId, possibly null per the per-method sidecar) but not redirect-readers." — evidence: `DataCollaborationController.java:41-49` + `DataCollaborationServiceImpl.java:72-77` (no log statements) — severity: MEDIUM
- "All three endpoints share the same single Slack `AsyncMethodsClient` instance (constructed once at boot in `DataCollaborationConfiguration.java:27` and reused via `SlackAPIClientImpl`'s singleton wiring). The Slack SDK's connection pool is opaque to the platform — there is no documented backpressure / concurrent-request cap. Under a burst of autocomplete keystrokes (UI's 500ms debounce mitigates this somewhat) + concurrent message-redirects, all calls share the same outbound HTTP client; a Slack-side rate-limit hits all three endpoint surfaces equally." — evidence: `DataCollaborationConfiguration.java:27` + `SlackAPIClientImpl.java:23-28` — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "SlackAPIClientImpl.java:26"
      name: "LIMIT_SIZE"
      value: "200"
      questions:
        - q: "What at N > LIMIT_SIZE (workspace has > 200 channels)?"
          a: "Cursor-based pagination kicks in. `requestConversationList` (`SlackAPIClientImpl.java:30-47`) uses `.expand(response -> ... if (nextCursor) requestConversationList(nextCursor))` — the full channel set is paginated through. For a workspace with 1000 channels, that's 5 Slack API round-trips per cache miss (every minute under sustained autocomplete load + cache eviction)."
          confidence: STATIC-INFERRED
          evidence: "SlackAPIClientImpl.java:26, 30-47, 125-141"
        - q: "What at LIMIT_SIZE × 100 (workspace has 20K channels)?"
          a: "100 paginated round-trips per cache miss. The full Map<String, MessageChannelDto> is materialised in memory before being cached. Per channel: id + name strings → ~50-100 bytes per Map entry → ~1-2 MB heap allocation per cache miss for 20K channels. The cache miss happens every minute under any read activity. PROBE-NEEDED to verify the Caffeine async-loading behaviour under cache-miss latency (whether subsequent requests block on the loading-future or get stale data)."
          confidence: PROBE-NEEDED
          evidence: "P-143 (cache-staleness probe also covers the multi-round-trip case)"
        - q: "What does the operator see at each boundary?"
          a: "Below LIMIT_SIZE: single round-trip; channel list ready in <1s. At LIMIT_SIZE × N: N round-trips serialised by `.expand`; each subsequent autocomplete keystroke within the cache TTL hits the cache; the cost amortises across all callers in the 60s window."
          confidence: STATIC-INFERRED
          evidence: "SlackAPIClientImpl.java:30-47 + SlackMessageProviderClient.java:36-44"
    - location: "SlackMessageProviderClient.java:38-44"
      name: "Caffeine cache TTL / size"
      value: "expireAfterWrite=1 MINUTE, maximumSize=1"
      questions:
        - q: "What at N = 0 (cache empty / cold start)?"
          a: "First call after bean init triggers `asyncLoadingCache.get(CACHE_FIXED_KEY)` which executes the load function → `slackAPIClient.getSlackChannels()` → full paginated walk. The Mono returned to the caller is parked until the load completes."
          confidence: STATIC-INFERRED
          evidence: "SlackMessageProviderClient.java:36-44 + SlackAPIClientImpl.java:30-47"
        - q: "What at N = 1 (cache populated)?"
          a: "Within the 60s window, all callers receive the same cached map. The Mono completes synchronously from cache; latency drops to ~ms."
          confidence: STATIC-INFERRED
          evidence: "SlackMessageProviderClient.java:36-44"
        - q: "What does the operator see at the 60s cache-eviction boundary?"
          a: "PROBE-NEEDED. The next caller after eviction triggers a fresh load; question is whether the Caffeine async-loading-cache `get` blocks the caller on the in-flight load or returns the just-evicted stale value during refresh. Caffeine docs say `AsyncLoadingCache.get` returns a CompletableFuture that completes when the load completes — i.e., the caller waits for the fresh value. Multiple concurrent first-callers after eviction all wait on the same CompletableFuture (no thundering herd). Pinned by P-143."
          confidence: PROBE-NEEDED
          evidence: "P-143"
  name_behavior_pairs:
    - name: "getSlackChannels(channelName)"
      promise: "List Slack channels (the workspace's channels) — autocomplete data for the channel-picker."
      implementation: "Returns the bot's joined PUBLIC channels (excludeArchived=true, ConversationType.PUBLIC_CHANNEL only, post-filtered by `Conversation::isMember`), cached for 60s, filtered by `name.startsWith(nameLike)` if a query is supplied. Private channels, DMs, group DMs, and channels the bot has not been invited to are entirely excluded."
      drift: MINOR
      operator_visible_consequence: "The autocomplete dropdown is bounded by the bot's invitation scope, not by the user's Slack membership. A user who can see #engineering in their own Slack client may NOT see it in the autocomplete because the bot has not been invited to #engineering. The doc page says 'channels the bot can write to' — accurate but operationally surprising for first-time users."
      confidence: STATIC-INFERRED
      evidence: "SlackAPIClientImpl.java:30-47 + SlackMessageProviderClient.java:47-56"
    - name: "redirect(messageId)"
      promise: "Redirect the user to the message in the provider (Slack permalink)."
      implementation: "Server-side 302 with `Location:` = whatever Slack's `chat.getPermalink` returned for the (channelId, messageTs) pair stored on the `messages` row. UNCONDITIONAL — no URL validation, no host check, no scheme check."
      drift: MINOR
      operator_visible_consequence: "Open-redirect-class surface IF Slack's API returned an attacker-controlled URL. Under Slack's normal operation, the URL is always `https://<workspace>.slack.com/archives/<channel>/<message-id>` — the trust holds in practice. Status code is 302 not 301 (drifts from OpenAPI spec); some user agents cache 301s aggressively, so the choice of 302 is actually correct for a dynamic redirect — but the spec lies."
      confidence: STATIC-INFERRED
      evidence: "DataCollaborationController.java:41-49 + SlackAPIClientImpl.java:83-95 + openapi.yaml:1788-1789 (the 301 declaration)"
    - name: "endpoint return code 200 (not 404) when redirect's messageId does not exist"
      promise: "GET /api/messages/{message_id}/url should return 404 when the message_id does not exist (REST convention)."
      implementation: "Returns 200 OK with empty body (WebFlux `Mono.empty` → 200 by default). No `switchIfEmpty(Mono.error(new NotFoundException(...)))` in the chain."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A caller probing message IDs cannot distinguish 'not found' from 'found but Slack returned no permalink'. Combined with no RBAC, this is a message-existence oracle for any authenticated user. Pinned by P-144."
      confidence: PROBE-NEEDED
      evidence: "P-144"
  orderings:
    - location: "SlackAPIClientImpl.java:30-47 (channel list pagination)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "Slack's `conversations.list` API determines the order — per Slack docs (WebFetched 2026-05-25), the default ordering is by channel creation time ASC (oldest first). The platform does NOT re-sort the result; the autocomplete renders in Slack-API order."
          confidence: STATIC-INFERRED
          evidence: "SlackAPIClientImpl.java:30-47 + Slack docs WebFetch (https://docs.slack.dev/reference/methods/conversations.list)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Slack-API-defined. Not platform-controlled. The platform's `Flux.flatMap(response -> Flux.fromIterable(response.getChannels()))` (`SlackAPIClientImpl.java:44`) preserves the Slack-returned order across pages."
          confidence: STATIC-INFERRED
          evidence: "SlackAPIClientImpl.java:44"
        - q: "Which subset is returned when result-set > page size?"
          a: "Cursor pagination via `.expand` walks the entire result set; for a workspace with N bot-member channels, ALL N are loaded into the Caffeine cache. Per-request filtering by `startsWith(nameLike)` happens after the full set is in memory."
          confidence: STATIC-INFERRED
          evidence: "SlackAPIClientImpl.java:30-47 + SlackMessageProviderClient.java:47-56"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "UI's `SlackChannelsAutocomplete` (`:43-54`) does NOT re-sort. The MUI Autocomplete component renders the result in the order received. Per-keystroke 500ms-debounced re-fetch with the new `channelName` value. The Caffeine cache filter (`startsWith`) does not change order."
          confidence: STATIC-INFERRED
          evidence: "SlackChannelsAutocomplete.tsx:43-54"
  auth_gates:
    - location: "DataCollaborationController.java:25-31 (getSlackChannels)"
      endpoint: "GET /api/datacollaboration/providers/slack/channels"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: any anonymous caller reaches the endpoint (subject only to `datacollaboration.enabled=true`); response is the bot's joined-channel list, filtered by `channelName` if supplied. LOGIN_FORM/OAUTH2/LDAP: any authenticated user reaches the endpoint regardless of which RBAC permissions they hold. There is no `@PreAuthorize` on the controller method, no programmatic `permissionService.hasPermission(...)` call in `DataCollaborationServiceImpl.getChannels`, and no `SecurityConstants.SECURITY_RULES` entry for the path."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:25-31 + DataCollaborationServiceImpl.java:40-45 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401 Unauthorized (or 302 to login form per the form-login flow). Under DISABLED: full response."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + LoginFormSecurityConfiguration.java:53-66"
        - q: "What does a wrong-role caller see?"
          a: "Same as a right-role caller: full response. There is no RBAC distinction."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:25-31 (no @PreAuthorize)"
        - q: "Where does the gate live?"
          a: "Catch-all `authenticated()` at `AuthorizationCustomizer.java:29-30`. NOT at controller-method level, NOT in `SecurityConstants.SECURITY_RULES`, NOT in any downstream service."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + SecurityConstants.java:98-355 (zero matching entries)"
    - location: "DataCollaborationController.java:33-39 (postMessageInSlack)"
      endpoint: "POST /api/datacollaboration/providers/slack/messages"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Same as getSlackChannels — RBAC-ungated; under DISABLED anonymously reachable; under LOGIN_FORM/OAUTH2/LDAP any authenticated user can post. The per-method sidecar covers the cross-tenant / cross-owner posting consequence — a user can attach a message to any data_entity_id in the catalogue with any channel_id the bot can reach."
          confidence: REFERENCE
          evidence: "odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md (security.known_security_gaps)"
        - q: "What does an unauthenticated caller see?"
          a: "Per the per-method sidecar: 401 under LOGIN_FORM/OAUTH2/LDAP; full response under DISABLED."
          confidence: REFERENCE
          evidence: "odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md"
        - q: "What does a wrong-role caller see?"
          a: "Same as right-role: 202 Accepted (regardless of RBAC)."
          confidence: REFERENCE
          evidence: "odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md"
        - q: "Where does the gate live?"
          a: "Same catch-all `authenticated()`."
          confidence: REFERENCE
          evidence: "odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md"
    - location: "DataCollaborationController.java:41-49 (redirect)"
      endpoint: "GET /api/messages/{message_id}/url"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: anonymously reachable; 302 to the message's Slack permalink (or 200/empty if message not found). LOGIN_FORM/OAUTH2/LDAP: any authenticated user reaches the endpoint with their message id — 302 to permalink OR 200/empty. There is no owner-scoping on the messageId lookup (`ReactiveMessageRepositoryImpl.java:171-185` reads MESSAGE.UUID + CREATED_AT only — no `MESSAGE.OWNER_ID = current_user` filter). A user who guesses (or enumerates) any UUIDv1 of any message gets the redirect for it."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:41-49 + DataCollaborationServiceImpl.java:72-77 + ReactiveMessageRepositoryImpl.java:171-185 + SecurityConstants.java:98-355"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: 401 / 302-to-login. Under DISABLED: full response."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "Same as right-role: 302 to the Slack permalink. There is no RBAC distinction."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:41-49"
        - q: "Where does the gate live?"
          a: "Catch-all `authenticated()`. The UUIDv1 timestamp covering-index assist (the `MESSAGE.CREATED_AT.eq(extractDateTimeFromUUID(messageId))` predicate at ReactiveMessageRepositoryImpl.java:177) is NOT an auth gate — it's a query-planner hint that an attacker probing IDs would still satisfy because they're using real UUIDv1s minted by the platform."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 + ReactiveMessageRepositoryImpl.java:171-185"
  resource_boundaries:
    - location: "SlackMessageProviderClient.java:36-44 (Caffeine cache)"
      kind: cache
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No data corruption — Caffeine's AsyncLoadingCache is thread-safe; concurrent get-on-miss calls share the same in-flight CompletableFuture. The cache state itself cannot be corrupted by concurrent access."
          confidence: STATIC-INFERRED
          evidence: "SlackMessageProviderClient.java:38-44 (Caffeine library guarantees)"
        - q: "Is the call replay-safe?"
          a: "GET getSlackChannels: yes — same query yields same result (within the cache window). Two callers in the same minute window see identical responses. After cache eviction, both callers see the same fresh response. The endpoint has no side effects."
          confidence: STATIC-INFERRED
          evidence: "SlackMessageProviderClient.java:47-56 + Caffeine semantics"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "TTL: 1 minute (expireAfterWrite). Eviction key: a fixed sentinel string `CACHE_FIXED_KEY` (line 30) — there is exactly ONE cache entry per platform process holding the full channel map. Staleness window: up to 60 seconds. No event-driven invalidation hook (e.g., on `member_joined_channel` Slack events that EventApiController processes). PROBE-NEEDED to confirm the precise behaviour during cache refresh (whether the just-evicted entry is served during refresh OR the caller blocks)."
          confidence: PROBE-NEEDED
          evidence: "P-143"
    - location: "DataCollaborationConfiguration.java:27 (singleton AsyncMethodsClient)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No — the Slack SDK's AsyncMethodsClient is thread-safe and connection-pooled internally. Concurrent calls use the same client instance without contention."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationConfiguration.java:27 (slack-api-client library guarantees)"
        - q: "Is the call replay-safe?"
          a: "Per-call basis: `chat.getPermalink` is idempotent (same input → same Slack-side permalink). `conversations.list` is idempotent (read). `chat.postMessage` is NOT replay-safe — each call mints a new message in Slack — but it's only invoked by `postMessageInSlack`'s downstream sender, not this controller class directly."
          confidence: STATIC-INFERRED
          evidence: "Slack API semantics + SlackAPIClientImpl.java:50-95"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "Only the Caffeine cache mentioned above fronts ONLY `conversations.list`. The other two Slack methods (`chat.getPermalink`, `conversations.info`) are NOT cached — every call to `redirect` triggers a fresh `chat.getPermalink` Slack round-trip; every call to `postMessageInSlack` triggers a fresh `conversations.info` round-trip."
          confidence: STATIC-INFERRED
          evidence: "SlackAPIClientImpl.java:50-95 (no @Cacheable, no Caffeine wrapper)"
  request_inputs:
    - location: "DataCollaborationController.java:26 (channelName query parameter on getSlackChannels)"
      input_kind: query-param
      input_name: "channelName (OpenAPI: channel_name)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'Filter the channel list by name' — implies a name-matching predicate. Reasonable user expectations: case-insensitive substring match (typical autocomplete UX) or case-insensitive contains match."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:26 + openapi.yaml:3710-3713"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller (line 29) → `DataCollaborationService.getChannels(channelName, SLACK)` → `SlackMessageProviderClient.getChannels(nameLike)` (`:47-56`) → `messages.filter(slackChannel -> slackChannel.name().startsWith(nameLike))` (line 52). Java `String.startsWith` is case-SENSITIVE prefix-match."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:29 + DataCollaborationServiceImpl.java:40-45 + SlackMessageProviderClient.java:47-56"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. Name says 'channel name filter'; implementation is case-sensitive prefix match. A user typing `Platform` to find `#odd-platform-alerts` returns empty (prefix doesn't match AND case differs). A user typing `odd-platform` returns matches. A user typing `platform` returns matches (lowercase prefix lowercase channel name → matches), but a user typing `Platform` does NOT. The live doc page says 'optionally filtered by `channel_name`' — does not specify the match semantics."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "SlackMessageProviderClient.java:52"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Empty dropdown despite the channel existing in the bot's joined set. The UI has no 'try a prefix match' hint. The user concludes 'the bot is not in this channel' (which is sometimes true and sometimes not — the failure mode is ambiguous). With case-mismatch, the failure is even more confusing: `Platform` returns empty but `platform` returns the channel."
          confidence: STATIC-INFERRED
          evidence: "SlackChannelsAutocomplete.tsx:43-54 + SlackMessageProviderClient.java:52"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE within the platform code. The Slack API itself has no built-in name-filter parameter on `conversations.list`; the platform does the filtering client-side. A `.containsIgnoreCase(nameLike)` swap on line 52 would fix the case-insensitive-contains expectation."
          confidence: STATIC-INFERRED
          evidence: "SlackMessageProviderClient.java:52"
      routes_to_finding: "bugs_limitations_corner_cases (channel filter startsWith not contains, severity MEDIUM) + docs_link_semantic.doc_drift_findings (api-reference does not document the filter is prefix-match)"
    - location: "DataCollaborationController.java:42 (messageId path parameter on redirect)"
      input_kind: path-param
      input_name: "messageId (OpenAPI: message_id)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Identifier of the in-platform message; the caller expects 'give me the URL for THIS specific message'. The OpenAPI declares `format: uuid` — UUID standard, no version constraint stated."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationController.java:42 + openapi.yaml:1781-1786"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller (line 43) → `DataCollaborationService.resolveMessageUrl(messageId)` → `ReactiveMessageRepository.getMessageProviderIdentity(messageId)` (`ReactiveMessageRepositoryImpl.java:171-185`) → JOOQ SELECT `MESSAGE.PROVIDER_MESSAGE_ID, PROVIDER_CHANNEL_ID, PROVIDER` WHERE `MESSAGE.UUID.eq(messageId)` AND `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))`. The second predicate is a covering-index assist that REQUIRES the messageId to be UUIDv1 — `extractDateTimeFromUUID` returns the embedded timestamp; a UUID v4 / v7 returns a wrong timestamp; the WHERE clause matches no rows."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationServiceImpl.java:72-77 + ReactiveMessageRepositoryImpl.java:171-185"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY for the UUIDv1 assumption — the platform itself mints UUIDv1s for every message (`UUIDHelper.generateUUIDv1()` at DataCollaborationServiceImpl.java:89), so the only legitimate caller-supplied messageIds in production are UUIDv1s carrying the platform-assigned timestamp; the covering-index assist is a documented performance pattern (partition-pruning on the messages table per `message-partition-period`). However, the OpenAPI spec declares `format: uuid` without the v1 constraint — a programmatic API consumer constructing a UUIDv4 messageId gets 200/empty back with no error explaining the failure."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveMessageRepositoryImpl.java:177 + UUIDHelper.generateUUIDv1 (DataCollaborationServiceImpl.java:89)"
        - q: "For TRANSLATES_LEGITIMATELY: cite the reason"
          a: "Performance pattern — covering-index assist on the partitioned messages table. UUIDv1 carries the creation timestamp; the JOOQ predicate uses BOTH the UUID and the extracted timestamp to enable partition pruning under `datacollaboration.message-partition-period` (`application.yml:203` = 30). The cost: a non-v1 UUID returns 200/empty (NOT 404) — a documentation gap, but the implementation choice is intentional."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMessageRepositoryImpl.java:177 + application.yml:203"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE. The matching column IS used (MESSAGE.UUID). The CREATED_AT is a secondary check, not an absent filter."
          confidence: STATIC-INFERRED
          evidence: "ReactiveMessageRepositoryImpl.java:175-177"
      routes_to_finding: "implicit_adrs (UUIDv1 covering-index assist) + bugs_limitations_corner_cases (200/empty instead of 404 for non-existent messageId)"
  probes_emitted:
    - probe_id: P-143
      question: "Caffeine cache staleness window — what does the operator see at the 60s eviction boundary; does the cache miss block subsequent callers or serve stale?"
      probe_path: "lineage/odd-platform/probes/P-143.yaml"
    - probe_id: P-144
      question: "redirect endpoint returns 200/empty (NOT 404) for non-existent messageId — confirm the WebFlux Mono.empty → 200 OK semantic AND verify the message-existence-oracle implication."
      probe_path: "lineage/odd-platform/probes/P-144.yaml"
    - probe_id: P-145
      question: "redirect endpoint open-redirect class — when SlackAPIClient is mocked to return an attacker-controlled URL (e.g., https://evil.example.com/), confirm the controller emits a 302 with Location: set to that URL UNCONDITIONALLY."
      probe_path: "lineage/odd-platform/probes/P-145.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 38
    answers_static_inferred: 31
    answers_probe_needed: 5
    answers_reference: 4
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — under the three protective modes the catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`) requires authentication; under DISABLED `.anyExchange().permitAll()` reaches the endpoint anonymously. The feature flag (`datacollaboration.enabled=false` default) is the only defence in DISABLED mode.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. None of `/api/datacollaboration/**` or `/api/messages/**` is in `WHITELIST_PATHS` or the S2S ingestion filter scope. (Sibling `EventApiController` is — `/api/slack/events` is in the whitelist per `SecurityConstants.java:96`.)
- **authorization_assertions**: [] — no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` calls, no `SecurityRule` entries for any of the three endpoints.
- **owner_scoping**: `BYPASSES — none of the three endpoints scope by current-user's owners`. `getSlackChannels` returns the bot's joined channels regardless of caller; `postMessageInSlack` accepts any `data_entity_id` (per the per-method sidecar); `redirect` looks up the message by UUID only — no owner filter at `ReactiveMessageRepositoryImpl.java:171-185`.
- **data_exposure**:
  - "Slack channel list (bot's joined PUBLIC channels) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP; any anonymous caller under DISABLED. The list shape is `{channel_id, name}` per channel — the channel ids are required to call `postMessageInSlack` so the exposure is functional, but it also reveals the bot's installation scope (which channels the operator has integrated)." — evidence: `DataCollaborationController.java:25-31` + `SlackMessageProviderClient.java:47-56` + `MessageMapper.java:89-94`.
  - "Slack permalinks (the URL field of `Message`) → any caller who can read the message (no owner-filter on read endpoints `GET /api/dataentities/{id}/messages` per per-method sidecar). Combined with the `redirect` endpoint's 200/empty (not 404) on miss, ANY authenticated user can probe message ids — 200/empty for non-existent, 302/slack-url for existing — effectively a per-id existence oracle." — evidence: `DataCollaborationController.java:41-49` + `ReactiveMessageRepositoryImpl.java:171-185` + `MessageMapper.java:85-87`.
  - "Slack workspace identity (the workspace URL) → leaked via `chat.getPermalink` responses on the `redirect` endpoint. The permalink format is `https://<workspace>.slack.com/archives/...`; calling `redirect` reveals the workspace subdomain. Operators who consider their workspace identity sensitive should treat any reachable redirect as a leak." — evidence: Slack API's `chat.getPermalink` response format + `DataCollaborationController.java:42-48`.
- **known_security_gaps**:
  - "No RBAC permission on any of the three endpoints — all three fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers(\"/**\").authenticated()`. There is no `@PreAuthorize` on the controller, no programmatic `permissionService.hasPermission(...)` in `DataCollaborationServiceImpl`, and no `SecurityConstants.SECURITY_RULES` entry matching `/api/datacollaboration/**` or `/api/messages/**`." — evidence: `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `DataCollaborationController.java:25-49` + `DataCollaborationServiceImpl.java:39-77` — severity: HIGH
  - "Under `auth.type=DISABLED`, all three endpoints are anonymously reachable subject only to the feature flag — turning on Discussions in a DISABLED deployment publishes all three endpoints to the network." — evidence: `AuthorizationCustomizer.java:20-30` — severity: HIGH
  - "Open-redirect-class surface on `redirect`: `URI.create(providerUrl)` unconditionally trusts whatever Slack returned from `chat.getPermalink`. No host check, no scheme check, no allowlist. Trust assumption is 'Slack returns slack.com URLs' — enforced nowhere in the platform's code." — evidence: `DataCollaborationController.java:42-48` + `SlackAPIClientImpl.java:83-95` — severity: MEDIUM (depends on Slack's API integrity)
  - "Slack OAuth bot token is the sole secret protecting the workspace integration. Compromise → workspace channel enumeration + post-as-bot capability. Spring's default Sanitizer masks `token`-suffixed property names but masking is the only defence; no token-rotation hook, no token-lifecycle integration." — evidence: `DataCollaborationConfiguration.java:21` + Slack docs (`https://docs.slack.dev/reference/methods/conversations.list` requires `channels:read` bot scope) — severity: HIGH
  - "Message-existence-by-id oracle on `redirect`: 200/empty for non-existent messageId vs 302/slack-url for existing one — distinguishable by status code and body. Combined with no RBAC, any authenticated user can probe message ids without an audit trail (no log on the redirect path)." — evidence: `DataCollaborationController.java:41-49` + `DataCollaborationServiceImpl.java:72-77` + `ReactiveMessageRepositoryImpl.java:171-185` — severity: MEDIUM
  - "No audit logging on any of the three endpoints — no `log.info` on the controller, no `log.info` on the service-tier methods. The `messages` table records authors (ownerId or null) but not readers / redirect-followers / channel-enumerators." — evidence: `DataCollaborationController.java:25-49` + `DataCollaborationServiceImpl.java:39-77` (no log statements) — severity: MEDIUM
  - "`getSlackChannels` leaks the bot's installation scope — the channel list reveals which channels the operator has integrated. An authenticated reconnaissance step against a poorly-scoped bot reveals the integration's reach." — evidence: `DataCollaborationController.java:25-31` + `SlackAPIClientImpl.java:30-47` — severity: LOW (operationally meaningful for some operators; functionally required for the autocomplete to work)

## performance

- **hot_paths**:
  - "`redirect`: per-call `ReactiveMessageRepository.getMessageProviderIdentity` (one JOOQ select) + per-call Slack `chat.getPermalink` (one Slack API round-trip). Slack-side latency directly drives endpoint latency. No caching on the permalink." — evidence: `DataCollaborationServiceImpl.java:72-77` + `SlackAPIClientImpl.java:83-95`
  - "`getSlackChannels`: cache-hit path is in-memory filter (`startsWith` over the cached Map values); cache-miss path is a paginated `conversations.list` walk to Slack (200/page) + Map materialisation. Under autocomplete keystrokes (500ms debounce per `SlackChannelsAutocomplete.tsx:43-54`), 1-3 calls per dropdown open within the 60s cache window — mostly cheap." — evidence: `SlackMessageProviderClient.java:47-56` + `SlackAPIClientImpl.java:30-47` + `SlackChannelsAutocomplete.tsx:43-54`
  - "`postMessageInSlack`: per-call `ReactiveDataEntityRepository.get` + `conversations.info` Slack round-trip + `authIdentityProvider.fetchAssociatedOwner` + `MessageRepository.create` insert. See per-method sidecar for detail." — evidence: `DataCollaborationServiceImpl.java:47-62`
- **throughput_characteristics**:
  - "All three endpoints are single-request reactive `Mono`s — no bulk endpoints. No client-side concurrent-call cap beyond the Slack SDK's connection pool."
  - "`redirect`'s Slack round-trip is uncached — N redirects per minute = N Slack `chat.getPermalink` calls per minute, no batching. Slack's `chat.getPermalink` rate limit is Tier 3 (50 calls/minute baseline)."
  - "`getSlackChannels` benefits hugely from the 60s cache — N callers in a minute = 1 Slack round-trip (or N pages if cache miss + paginated walk)."
- **resource_allocation**:
  - "Slack `AsyncMethodsClient` is built once at boot (`DataCollaborationConfiguration.java:27`) — shared across all requests; no per-request client allocation." — evidence: `DataCollaborationConfiguration.java:27`
  - "Caffeine async-loading cache holds a full `Map<String, MessageChannelDto>` of ALL bot-member channels in heap — for 10K channels this is ~500KB-1MB heap allocation per cache miss; the cache miss happens every 60s under any read activity." — evidence: `SlackMessageProviderClient.java:36-44` + `SlackAPIClientImpl.java:26 (LIMIT_SIZE=200) + 30-47`
- **scaling_characteristics**:
  - "Controller is stateless — horizontal scaling works for the inbound side."
  - "Each platform process has its own Caffeine cache — N replicas = N independent cache lines = N copies of the channel map. The Slack-side `conversations.list` call is paid N times per cache TTL, once per replica."
  - "The `redirect` endpoint is uncached — high traffic against a single hot message id N times means N Slack `chat.getPermalink` calls. Under sustained traffic at the Slack rate-limit Tier 3 (50 calls/min), the 51st call returns `ratelimited` from Slack → `SlackAPIException` → 5xx for the platform caller."
- **known_performance_gaps**:
  - "`redirect` Slack `chat.getPermalink` is uncached — each click on 'Open in Slack' triggers a fresh Slack round-trip. The permalink is effectively immutable per (channel, message_ts) pair; a Caffeine cache on it would eliminate Slack rate-limit pressure under high-read scenarios." — evidence: `SlackMessageProviderClient.java:64-66` + `SlackAPIClientImpl.java:83-95` (no `@Cacheable`, no Caffeine wrapper) — severity: LOW
  - "Caffeine channel-cache size=1 means a single platform process holds a single Map of all bot-member channels — for huge workspaces (10K+ channels) the heap allocation is meaningful and the cache-miss multi-round-trip walk to Slack is slow (50+ round-trips at 200/page)." — evidence: `SlackMessageProviderClient.java:38-44` + `SlackAPIClientImpl.java:30-47, 130-141` — severity: LOW

## upstream_callers

- entry_point: "ui_route:/dataentities/{id}/discussions"
  caller_node: "ts react-component:SlackChannelsAutocomplete.tsx (via fetchSlackChannels thunk)"
  multiplicity_per_trigger: "1..N (one call per debounced keystroke; useDebouncedCallback at 500ms, plus one on dropdown-open)"
  evidence: "SlackChannelsAutocomplete.tsx:43-54 (useDebouncedCallback 500ms) + dataCollaboration.thunks.ts:18-29 (fetchSlackChannels)"
  observation_class: ui-call
  unresolved: false
- entry_point: "ui_route:/dataentities/{id}/discussions"
  caller_node: "ts react-component:CreateMessageForm.tsx (via createMessageToSlack thunk)"
  multiplicity_per_trigger: 1
  evidence: "CreateMessageForm.tsx:49-58 (form submit) + dataCollaboration.thunks.ts:31-44 (createMessageToSlack)"
  observation_class: ui-call
  unresolved: false
- entry_point: "ui_route:/dataentities/{id}/discussions (or /overview where Discussions tab is visible)"
  caller_node: "ts react-component:Message.tsx (via <Button to={url} target='_blank'>)"
  multiplicity_per_trigger: "0..1 per user click — the message-list page fetches messages and renders the 'Open in Slack' button; the button navigates the browser to /api/messages/{uuid}/url on click"
  evidence: "Message.tsx:60-66 (the Button with to={url}) + MessageMapper.java:85-87 (url = `/api/messages/{uuid}/url`)"
  observation_class: ui-call
  unresolved: false
- entry_point: "rest:GET /api/messages/{message_id}/url (third-party API consumer)"
  caller_node: "unresolved — any programmatic API client following the OpenAPI spec"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:1776-1791 declares the endpoint; the OpenAPI-generated client in odd-platform-ui's lib/api exposes it; any third-party consumer with the OpenAPI spec can call it"
  observation_class: rest-call
  unresolved: true

## downstream_side_effects

- side_effect_class: external-call
  description: "`getSlackChannels` triggers Slack `conversations.list` API call on cache miss — paginated walk of bot-member channels (200/page)."
  evidence: "SlackAPIClientImpl.java:30-47, 130-141 + SlackMessageProviderClient.java:36-44 (cache layer)"
  cardinality_per_call: "0 if cache hit; 1..N pages if cache miss (where N = ceil(bot-member-channels / 200))"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/discussions (via SlackChannelsAutocomplete)"
    - "rest:GET /api/datacollaboration/providers/slack/channels (third-party)"
- side_effect_class: external-call
  description: "`postMessageInSlack` triggers Slack `conversations.info` API call to resolve the channel id (per per-method sidecar). The actual `chat.postMessage` is deferred to the background sender."
  evidence: "DataCollaborationServiceImpl.java:53-56 + SlackAPIClientImpl.java:49-62"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/discussions (CreateMessageForm submit)"
    - "rest:POST /api/datacollaboration/providers/slack/messages (third-party)"
- side_effect_class: db-write
  description: "`postMessageInSlack` inserts a new row into the `messages` table in PENDING_SEND state. See per-method sidecar."
  evidence: "DataCollaborationServiceImpl.java:60 + per-method sidecar"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/discussions"
    - "rest:POST /api/datacollaboration/providers/slack/messages"
- side_effect_class: external-call
  description: "`redirect` triggers Slack `chat.getPermalink` API call to resolve the message permalink. Uncached — every call triggers a fresh Slack round-trip."
  evidence: "DataCollaborationServiceImpl.java:72-77 + SlackAPIClientImpl.java:83-95"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/discussions (Open in Slack button click)"
    - "rest:GET /api/messages/{message_id}/url (third-party)"
- side_effect_class: redirect-issue
  description: "`redirect` returns a 302 Found with `Location:` header set to the Slack permalink URL (or to whatever URL Slack's `chat.getPermalink` returned — see open-redirect-class finding)."
  evidence: "DataCollaborationController.java:42-48"
  cardinality_per_call: "1 on success (302); 0 on missing message (200 OK empty); 0 on Slack error (5xx)"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/discussions (Open in Slack)"
    - "rest:GET /api/messages/{message_id}/url"
- side_effect_class: page-render
  description: "`getSlackChannels` returns a `MessageChannelList` JSON payload to the caller; the UI's MUI Autocomplete renders it as the dropdown options."
  evidence: "DataCollaborationController.java:30 + SlackChannelsAutocomplete.tsx:37-90"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/discussions"
    - "rest:GET /api/datacollaboration/providers/slack/channels"

## sources

- understanding ← DataCollaborationController.java:1-50 + DataCollaborationConfiguration.java:14-30 + DataCollaborationFeatureCondition.java:9-23 + DataCollaborationServiceImpl.java:39-77 + SlackAPIClientImpl.java:23-141 + SlackMessageProviderClient.java:36-66 + SecurityConstants.java:96 + AuthorizationCustomizer.java:29-30 + openapi.yaml:1776-1791, 3704-3743 + system-mission.md:200-215
- concepts.entities ← DataCollaborationController.java:6-9, 11-12, 22 + DataCollaborationService.java:11-19 + DataCollaborationServiceImpl.java:72-77 + MessageMapper.java:84-94 + ReactiveMessageRepositoryImpl.java:171-185 + dataCollaboration.thunks.ts:18-44 + SlackChannelsAutocomplete.tsx:43-54
- concepts.operations ← DataCollaborationController.java:25-49 + DataCollaborationServiceImpl.java:39-77 + SlackAPIClientImpl.java:30-95 + SlackMessageProviderClient.java:36-66
- concepts.invariants ← DataCollaborationFeatureCondition.java:18-22 (class gate) + DataCollaborationConfiguration.java:23-25 (fail-fast token) + SecurityConstants.java:96-355 (RBAC absence) + AuthorizationCustomizer.java:29-30 (catch-all) + DataCollaborationController.java:42-48 (open redirect) + SlackMessageProviderClient.java:52 (startsWith) + SlackMessageProviderClient.java:36-44 (cache TTL) + SlackAPIClientImpl.java:45 (isMember filter) + ReactiveMessageRepositoryImpl.java:176-177 (UUIDv1 covering index) + openapi.yaml:1788-1789 (301 declared) vs DataCollaborationController.java:45 (302 emitted)
- dependencies_semantic.requires-feature ← DataCollaborationFeatureCondition.java:18-22 + application.yml:205 + DataCollaborationService.java:11-19 + SlackAPIClient.java:11-21 + AuthorizationCustomizer.java:20-30
- dependencies_semantic.requires-config ← application.yml:200-206 + DataCollaborationProperties.java:9-21 + DataCollaborationConfiguration.java:19-30 + Slack docs WebFetch 2026-05-25 (https://docs.slack.dev/reference/methods/conversations.list)
- dependencies_semantic.requires-runtime ← DataCollaborationController.java:1-22 + AuthorizationCustomizer.java:29-30 + ReactiveMessageRepositoryImpl.java:171-185 + SlackMessageProviderClient.java:36-44
- tests_coverage_semantic.test_files ← grep `DataCollaborationController` in `<odd-platform>/odd-platform-api/src/test` (zero matches)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/data-collaboration (2026-05-25, status 404)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration (2026-05-25, status 200)
- docs_link_semantic.doc_drift_findings ← cross-comparison of live api-reference, openapi.yaml, and DataCollaborationController.java
- implicit_adrs.[0] (disabled-by-default) ← application.yml:205 + DataCollaborationFeatureCondition.java:18-22
- implicit_adrs.[1] (fail-fast Slack token) ← DataCollaborationConfiguration.java:23-25
- implicit_adrs.[2] (thin reactive proxy) ← DataCollaborationController.java:25-49
- implicit_adrs.[3] (channel cache) ← SlackMessageProviderClient.java:36-44
- implicit_adrs.[4] (202+queue+sender) ← DataCollaborationController.java:38 + DataCollaborationMessageSenderJob.java:23-87 (via per-method sidecar)
- implicit_adrs.[5] (UUIDv1 covering index) ← ReactiveMessageRepositoryImpl.java:177 + DataCollaborationServiceImpl.java:89 + UUIDHelper
- bugs_limitations_corner_cases.[0] (open-redirect) ← DataCollaborationController.java:42-48 + SlackAPIClientImpl.java:83-95
- bugs_limitations_corner_cases.[1] (302 vs 301 status drift) ← openapi.yaml:1788-1789 + DataCollaborationController.java:45
- bugs_limitations_corner_cases.[2] (no 404 on redirect) ← DataCollaborationController.java:41-49 + DataCollaborationServiceImpl.java:72-77 + ReactiveMessageRepositoryImpl.java:171-185
- bugs_limitations_corner_cases.[3] (Slack 5xx not 4xx) ← SlackAPIClientImpl.java:84-95 + SlackAPIException
- bugs_limitations_corner_cases.[4] (startsWith filter) ← SlackMessageProviderClient.java:50-55
- bugs_limitations_corner_cases.[5] (60s cache staleness) ← SlackMessageProviderClient.java:36-44 + EventApiController.java:18-42
- bugs_limitations_corner_cases.[6] (full channel map cached) ← SlackMessageProviderClient.java:36-44 + SlackAPIClientImpl.java:26, 30-47
- bugs_limitations_corner_cases.[7] (Slack token blast-radius) ← DataCollaborationConfiguration.java:19-29 + Slack docs WebFetch 2026-05-25
- bugs_limitations_corner_cases.[8] (no RBAC) ← SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30 + DataCollaborationController.java:25-49
- bugs_limitations_corner_cases.[9] (anonymous under DISABLED) ← AuthorizationCustomizer.java:20-30
- bugs_limitations_corner_cases.[10] (no audit logging) ← DataCollaborationController.java:25-49 + DataCollaborationServiceImpl.java:39-77
- bugs_limitations_corner_cases.[11] (single AsyncMethodsClient) ← DataCollaborationConfiguration.java:27 + SlackAPIClientImpl.java:23-28
- stress_findings ← Stress Protocol execution against DataCollaborationController.java + 1-hop neighbours (see Rule 9)
- security ← SecurityConstants.java:96-355 + AuthorizationCustomizer.java:20-30 + DataCollaborationController.java:25-49 + DataCollaborationServiceImpl.java:39-77 + DisabledAuthSecurityConfiguration (cross-reference IntegrationController sidecar) + Slack docs WebFetch 2026-05-25
- performance ← DataCollaborationServiceImpl.java:39-77 + SlackAPIClientImpl.java:30-95 + SlackMessageProviderClient.java:36-66 + Slack API rate-limit Tier 3 documentation
- upstream_callers ← SlackChannelsAutocomplete.tsx:43-54 + CreateMessageForm.tsx:49-58 + Message.tsx:60-66 + dataCollaboration.thunks.ts:18-44 + openapi.yaml:1776-1791, 3704-3743
- downstream_side_effects ← DataCollaborationController.java:25-49 + SlackAPIClientImpl.java:30-95 + DataCollaborationServiceImpl.java:39-77 + MessageMapper.java:85-87

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (live api-reference fetched 200; user-facing feature page is 404 — drift surfaced)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (some claims rely on Slack-API behavioural assumptions documented from Slack docs WebFetch, not from running probes)
- stress_findings: MEDIUM (3 of the load-bearing operator-visible claims — cache staleness window, 200/empty redirect behaviour, open-redirect class — are PROBE-NEEDED; downgraded from HIGH)
- upstream_callers: HIGH
- downstream_side_effects: HIGH

## Maintainer notes
