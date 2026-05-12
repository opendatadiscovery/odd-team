---
node_id: "odd-platform java DataCollaborationController controller-method:postMessageInSlack"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
enriched_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-01
---

# postMessageInSlack — semantic understanding

## understanding

`POST /api/datacollaboration/providers/slack/messages` queues an in-app
Discussions message for asynchronous delivery to a configured Slack workspace.
The controller (DataCollaborationController.java:33-39) is a thin reactive
proxy: it deserialises a `MessageRequest` (`data_entity_id`, `channel_id`,
`text`), calls `DataCollaborationService.createAndSendMessage(...)` with
provider `SLACK`, and returns `202 Accepted` once the message row is persisted
in `PENDING_SEND` state — the actual Slack API call happens later in
`DataCollaborationMessageSenderJob` under a Postgres advisory-lock-elected
leader. The endpoint is gated by `@ConditionalOnDataCollaboration` (class-level
on the controller), so every route on this controller returns
`404 Not Found` when `datacollaboration.enabled=false`.

## concepts

- entities: [MessageRequest, Message, MessagePojo, MessageChannelDto, MessageProviderDto, DataEntityPojo]
- operations: [enqueue-slack-message, resolve-channel-by-id, resolve-data-entity, persist-pending-message]
- invariants: [route exists only when datacollaboration.enabled=true, message persisted before 202 returned, data_entity must exist and not be hollow, channel_id must be resolvable via Slack conversations.info, message owner = current user's associated owner (or null when no association)]
- audiences: [authenticated ODD UI users posting from the Discussions tab on a data-entity detail page]

## dependencies_semantic

- requires-feature:
  - `datacollaboration.enabled=true` (DataCollaborationFeatureCondition.java:18-22 + application.yml:205 default `false`) — the controller bean is not registered when the flag is false; route 404s.
- requires-config:
  - `datacollaboration.slack-oauth-token` (DataCollaborationConfiguration.java:21) — fail-fast empty-check at boot: `throw new IllegalArgumentException("Slack OAuth token is empty")` when the property is unset / empty. Used by the `Slack.getInstance().methodsAsync(slackOauthToken)` builder, so this token is the **bot user token** the Slack SDK signs every `chat.postMessage` / `conversations.info` / `conversations.list` call with.
  - `datacollaboration.sender-message-advisory-lock-id` (DataCollaborationProperties.java:10 + application.yml:202=`120`) — Postgres advisory-lock partition used by `DataCollaborationMessageSenderJob` to single-leader the sender thread.
  - `datacollaboration.sending-messages-retry-count` (DataCollaborationProperties.java:12 + application.yml:204=`3`) — retry budget for failed Slack `chat.postMessage` calls; messages above the budget are marked `ERROR_SENDING`. Validated `>=0` in `@PostConstruct` validate() (DataCollaborationProperties.java:14-20).
- requires-runtime:
  - Authenticated user with an associated owner OR no owner (the service tolerates both — `MessagePojo.ownerId` will be `null` for users with no owner association — DataCollaborationServiceImpl.java:57-59).
  - `AuthIdentityProvider.fetchAssociatedOwner()` (DataCollaborationServiceImpl.java:35) — pulls the current Spring Security principal -> Owner row via the `user_owner_mapping` association.
  - `ReactiveMessageRepository.create(...)` persistence path + a running `DataCollaborationMessageSenderJob` thread to actually deliver the message; the controller does not interact with Slack itself on the request thread.
  - Slack workspace reachability for the post-202 sender thread (Slack API `chat.postMessage`); transient Slack failures retry up to `sending-messages-retry-count` (DataCollaborationMessageSenderJob.java:58-63).

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - happy-path `202 Accepted` enqueue
  - `404 Not Found` when `datacollaboration.enabled=false` (`@ConditionalOnDataCollaboration` wiring)
  - `NotFoundException` when `data_entity_id` does not exist OR is hollow (DataCollaborationServiceImpl.java:50-52)
  - SlackAPIException propagation when `channel_id` fails `conversations.info` (SlackAPIClientImpl.java:50-62)
  - cross-tenant / cross-owner posting: user A posts in channel mapped to entity owned by user B's owner — current code does NOT scope by owner
  - empty / oversized message text (no validation in MessageRequest schema — components.yaml:3410-3423 marks `text` `required` only)
  - oversized message text that exceeds Slack's per-message limit (Slack returns `msg_too_long`; surfaced via `SlackAPIException` only after the 202 has already been returned to the caller)
- test_files: []
- gaps: |
    There are zero Java test files under
    `odd-platform-api/src/test/java/.../datacollaboration/` (verified by `find`
    of `<odd-platform>` for `src/test` files referencing
    `datacollaboration`; no matches). A regression that landed an authorization
    gap (cross-owner posting), an unset Slack token leak, or a malformed
    `MessageRequest` would not be caught by the existing test suite. The
    asynchronous send path (DataCollaborationMessageSenderJob) is also
    untested — a regression that broke retry accounting or advisory-lock
    contention would only surface in production.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/active-platform-features/data-collaboration"
    anchor: ""
    rationale: "The feature page describes the Discussions tab and the message-lifecycle model end-to-end; canonical user-facing home for the endpoint's behaviour."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      WebFetch returned 404 with body "Page Not Found / The URL active-platform-features/data-collaboration does not exist".
      The doc page exists in the documentation repo
      (documentation/docs/active-platform-features/data-collaboration.md, e.g.
      lines 7-15 describe the Discussions tab visibility caveat and the
      `datacollaboration.enabled=false` -> 404 behaviour) but has not yet been
      published to the live site (DOC-138 / DOC-155-159 data-collaboration
      batch landed in the docs repo but live publication is still pending at
      enrichment time).
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration"
    anchor: ""
    rationale: "API-reference page enumerates the seven /api/datacollaboration/* routes including this POST endpoint."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "Queue a message for delivery into Slack. Returns 202 Accepted once the
      message is enqueued; a background sender
      (DataCollaborationMessageSenderJob) drains the queue with up to
      datacollaboration.sending-messages-retry-count retries per message."
      The page confirms gating by @ConditionalOnDataCollaboration -> 404 when
      datacollaboration.enabled=false; it does NOT document authentication /
      authorization requirements, request schema, or rate-limit behaviour for
      this endpoint.
- doc_drift_findings:
  - "Live api-reference page does not state which Permission gates this endpoint — and in fact there is none; any authenticated user can post (see security.known_security_gaps). Reader cannot infer authorization model from the live docs."
  - "Live api-reference page does not state any input-validation limits on `text` (length, sanitisation). Slack's per-message size limit and the absence of a server-side cap are both invisible to a reader of the docs."
  - "Live active-platform-features/data-collaboration page is 404 at fetch time even though the source file is in the documentation repo — operators Googling 'odd data collaboration' currently land on broken pages." — severity: HIGH for doc-drift, surfaced for doc-gap-finder follow-up.

## implicit_adrs

- "Slack OAuth token is required at bean-construction time — boot fails fast rather than degrading silently when the token is missing." — evidence: DataCollaborationConfiguration.java:23-25 — intent_anchor: `throw new IllegalArgumentException("Slack OAuth token is empty")` — confidence: HIGH
- "Data Collaboration ships disabled-by-default, opt-in via a single property." — evidence: application.yml:205 (`enabled: false`) + DataCollaborationFeatureCondition.java:18-22 — intent_anchor: `enabled: false` as the application.yml default coupled to the `Conditional` reading `featureEnabled` from `datacollaboration.enabled` — confidence: HIGH
- "Controller is a thin reactive proxy — every method delegates straight to `DataCollaborationService` with no per-request business logic in the controller itself." — evidence: DataCollaborationController.java:25-49 (every method body is a single fluent chain on the service) — intent_anchor: the consistent shape across all three methods (`getSlackChannels`, `postMessageInSlack`, `redirect`) — confidence: HIGH
- "Outbound Slack delivery is decoupled from the HTTP request — the request thread returns `202 Accepted` immediately and a leader-elected background job handles delivery with retry and failure accounting." — evidence: DataCollaborationController.java:38 (`HttpStatus.ACCEPTED`) + DataCollaborationMessageSenderJob.java:23-87 (single Thread with advisory-lock election, retry loop, failure persistence) — intent_anchor: the explicit choice of `ACCEPTED` paired with the queue/sender/lock decomposition — confidence: HIGH
- "Per-deployment single-sender ordering via Postgres advisory locks rather than an external queue." — evidence: DataCollaborationMessageSenderJob.java:93-95 (`leaderElectionManager.acquire(senderMessageAdvisoryLockId, true)`) + DataCollaborationProperties.java:10 — intent_anchor: the advisory-lock-id is a configurable property; the choice of advisory lock over Redis/Kafka/SQS is an explicit architectural decision to keep the Postgres-as-only-dependency posture — confidence: HIGH

## bugs_limitations_corner_cases

- "Endpoint has no authorization gate: there is no `@PreAuthorize`, no `SecurityRule` in `SecurityConstants.SECURITY_RULES` for `/api/datacollaboration/providers/slack/messages`, and no programmatic permission check in `DataCollaborationServiceImpl.createAndSendMessage(...)`. The request only falls through `AuthorizationCustomizer.pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30). Any authenticated user can post a message to any Slack `channel_id` the configured bot can reach, attached to any `data_entity_id` (existence-checked only) — including channels the user has no Slack-side membership of and data entities owned by other tenants/owners." — evidence: SecurityConstants.java:96-355 (no entry for `/api/datacollaboration/providers/slack/messages`) + DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62 — severity: HIGH
- "No message-body validation: `MessageRequest.text` is `required` only (components.yaml:3410-3423). There is no max-length cap, no sanitisation, no allowlist of allowed markdown / mentions. A 4 MB request body would be accepted by the controller, persisted to the `messages` table, and only fail at Slack's `chat.postMessage` boundary (Slack's per-message text limit is ~40 KB) — the user is told `202 Accepted` but the message ends up `ERROR_SENDING` after the retry budget exhausts." — evidence: MessageRequest schema components.yaml:3410-3423 + SlackAPIClientImpl.java:64-81 + DataCollaborationMessageSenderJob.java:58-63 — severity: MEDIUM
- "Channel-id is user-supplied and not validated against an allowlist server-side: the request body's `channel_id` is passed straight to `SlackAPIClient.exchangeForChannel(channelId)` (DataCollaborationServiceImpl.java:53-56). Any Slack channel the bot has been invited to (`Conversation::isMember` filter in SlackAPIClientImpl.java:45) is acceptable. There is no concept of 'which channels are valid for which data entity / owner'." — evidence: DataCollaborationController.java:34-37 + DataCollaborationServiceImpl.java:53-56 + SlackAPIClientImpl.java:50-62 — severity: MEDIUM
- "`data_entity` existence is checked but ownership is not: the service rejects non-existent / hollow entities (DataCollaborationServiceImpl.java:50-52) but does not check that the calling user is allowed to see / discuss the entity. Combined with the missing authorization gate, a user can attach a message to any data entity in the catalog, including ones from a foreign namespace they could not otherwise read." — evidence: DataCollaborationServiceImpl.java:47-62 — severity: HIGH
- "Caller cannot observe send failure: the controller returns `202 Accepted` with a `Message` body whose `state` is `PENDING_SEND` (DataCollaborationServiceImpl.java:96 + MessageStateDto.PENDING_SEND). Downstream Slack failures (auth revoked, channel archived, text too long, rate-limited beyond retry budget) flip the row to `ERROR_SENDING` in the sender job (DataCollaborationMessageSenderJob.java:58-63 calls `markMessageAsFailed` with the exception message) — but there is no notification / push mechanism on the HTTP surface to inform the original caller. The user must re-fetch via the `/api/dataentities/{id}/messages` endpoints to see status." — evidence: DataCollaborationController.java:38 + DataCollaborationServiceImpl.java:96 + DataCollaborationMessageSenderJob.java:58-63 — severity: MEDIUM
- "Slack rate-limit handling is non-discriminating: every exception from `SlackAPIClientImpl.postMessage` becomes a generic `Exception e` caught at DataCollaborationMessageSenderJob.java:55 and either retried (`shouldRetry`) or persisted as `markMessageAsFailed`. Slack's `ratelimited` / `429` responses are not distinguished from auth (`invalid_auth`, `not_authed`) or channel (`channel_not_found`, `not_in_channel`) errors — the same 3-retry budget applies, with a fixed 1-second sleep. Under sustained 429s the budget is exhausted in <4s and the message is dropped." — evidence: DataCollaborationMessageSenderJob.java:54-65 + SlackAPIClientImpl.java:73-77 — severity: MEDIUM
- "No audit logging of who posted what to which channel: there is no `log.info(...)` or audit-table write on the post path. The only persisted trail is the `messages` row, which records `ownerId` but not the calling user's id when the user has no owner association (in which case `ownerId` is `null` — DataCollaborationServiceImpl.java:58-59)." — evidence: DataCollaborationServiceImpl.java:57-62 + DataCollaborationServiceImpl.java:83-102 — severity: MEDIUM
- "No rate-limit / throttling on the inbound endpoint: a single authenticated user can call `POST /api/datacollaboration/providers/slack/messages` in a tight loop with 4 MB bodies, all of which are persisted to `messages` and then drained by a single-leader sender. The sender thread becomes the bottleneck, not the inbound, so attacker-controlled growth of `messages` rows is unbounded by the inbound." — evidence: DataCollaborationController.java:33-39 + no per-endpoint rate-limiting in this controller, the global filter chain (AuthorizationCustomizer.java:19-31), or in `DataCollaborationServiceImpl.createAndSendMessage(...)` — severity: MEDIUM
- "OAuth token leak via `/actuator/env` is the standard Spring Boot risk: `datacollaboration.slack-oauth-token` is consumed via `@Value` (DataCollaborationConfiguration.java:21) and has no `@ConfigurationProperties` sanitiser. The `/actuator/**` path is on the security whitelist (SecurityConstants.java:96), so any caller reaching the actuator port can read `env`. Slack bot tokens (`xoxb-...`) appear under their literal property name; Spring's default `Sanitizer` only masks keys matching `password`, `secret`, `key`, `token`. Property name `slack-oauth-token` matches `token` so it IS masked by Spring's default Sanitizer — but the masking is the only defence; there is no fail-closed on actuator access." — evidence: SecurityConstants.java:96 + DataCollaborationConfiguration.java:21 — severity: LOW (Spring's default sanitiser does mask `token`-suffixed keys; risk is configuration-divergence-shaped, not active vulnerability)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — controller falls through to `AuthorizationCustomizer.pathMatchers('/**').authenticated()` (AuthorizationCustomizer.java:29-30), so any of the three protective auth modes will require authentication; `DISABLED` skips auth entirely (no fail-closed). Evidence: SecurityConstants.java:95-355 has no specific rule for this path; AuthorizationCustomizer.java:29-30 is the catch-all.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The `IngestionDataEntitiesFilter` only registers on `/ingestion/entities`; `/api/datacollaboration/...` is the UI/API surface.
- **authorization_assertions**: []
- **owner_scoping**: `BYPASSES — accepts any data_entity_id the caller can supply, with no current-user-owners filter`. Evidence: DataCollaborationServiceImpl.java:50-52 (existence-checked + hollow-checked only; no owner filter; no permissionService call).
- **data_exposure**:
  - "A Slack message authored by an arbitrary authenticated user → any Slack channel the bot is a member of, attached to any data_entity_id in the catalog, with the platform user's owner-id recorded (or NULL if the user has no owner association)" — evidence: DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62 + SlackAPIClientImpl.java:64-81.
  - "MessagePojo persisted to the `messages` table with `text` field as supplied — no redaction; future SELECTs from any `/api/dataentities/{id}/messages` endpoint return the raw text to readers of that entity" — evidence: DataCollaborationServiceImpl.java:92-101.
- **known_security_gaps**:
  - "No Permission gates the POST: there is no `@PreAuthorize`, no `SecurityRule` matching `/api/datacollaboration/providers/slack/messages` in `SecurityConstants.SECURITY_RULES`, and no programmatic `permissionService.hasPermission(...)` call in `DataCollaborationServiceImpl.createAndSendMessage(...)`. The endpoint falls back to the catch-all `.authenticated()` — any authenticated user can post." — evidence: SecurityConstants.java:96-355 + AuthorizationCustomizer.java:29-30 + DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62 — severity: HIGH
  - "No User-owner association check: a user without an owner association can still post (the service tolerates `ownerId=null` — DataCollaborationServiceImpl.java:57-59). The resulting Slack message has no associable platform owner; the audit trail is anonymous-within-the-deployment." — evidence: DataCollaborationServiceImpl.java:57-62 — severity: MEDIUM
  - "Cross-owner / cross-tenant posting: user A can attach a message to a data entity owned by user B's owner, since there is no owner-filter at the data-entity lookup (DataCollaborationServiceImpl.java:50-52). Combined with the absence of an authorization gate, this is a cross-tenant message-injection path." — evidence: DataCollaborationServiceImpl.java:47-62 — severity: HIGH
  - "Channel-id is fully user-supplied: a user can target ANY Slack channel the platform's bot has been invited to, regardless of which channel the in-app autocomplete listed for them. There is no server-side mapping of `(data_entity, allowed_channels)`." — evidence: DataCollaborationController.java:34-37 + SlackAPIClientImpl.java:50-62 — severity: MEDIUM
  - "Slack error messages are propagated to the persisted `messages` row's failure reason (DataCollaborationMessageSenderJob.java:62 `markMessageAsFailed(message.getUuid(), e.getMessage())`). If the failure reason is later surfaced via a `GET /api/dataentities/{id}/messages` payload, Slack's literal error string (`invalid_auth`, `token_revoked`, etc.) becomes readable by every authenticated user with access to that entity's Discussions tab — a potential token-state oracle." — evidence: DataCollaborationMessageSenderJob.java:54-63 + SlackAPIException flow — severity: LOW (depends on whether the failure reason is exposed via read endpoints; not verified in this enrichment).

## performance

- **hot_paths**:
  - "Per-request `conversations.info` call to Slack: `DataCollaborationServiceImpl.createAndSendMessage` (line 53-56) calls `messageProviderClientFactory.getOrFail(...).getChannelById(...)` for every post — that's a synchronous-from-the-perspective-of-the-202 round-trip to Slack's `conversations.info` (SlackAPIClientImpl.java:50-62). Slack outage / latency directly drives endpoint latency." — evidence: DataCollaborationServiceImpl.java:53-56 + SlackAPIClientImpl.java:50-62.
  - "Per-request `dataEntityRepository.get(...)` DB round-trip (DataCollaborationServiceImpl.java:50)." — evidence: DataCollaborationServiceImpl.java:50.
  - "Per-request `authIdentityProvider.fetchAssociatedOwner()` (DataCollaborationServiceImpl.java:57) — typically a single DB query against `user_owner_mapping`." — evidence: DataCollaborationServiceImpl.java:57.
- **throughput_characteristics**:
  - "Single-message synchronous-style POST — no bulk endpoint." — evidence: DataCollaborationController.java:33-39 + components.yaml:3410-3423 (MessageRequest schema accepts one entity per request).
  - "Reactive Mono<ResponseEntity<Message>> signature — non-blocking on the platform side, but Slack `conversations.info` + DB writes are sequential per request." — evidence: DataCollaborationController.java:34-37.
  - "Outbound to Slack is decoupled from the HTTP request — single-leader sender drains the queue at ~1 message per second (1-second sleep between iterations in DataCollaborationMessageSenderJob.java:70 and again in retry path line 60)." — evidence: DataCollaborationMessageSenderJob.java:60, 70.
- **resource_allocation**:
  - "Slack `AsyncMethodsClient` is built once at boot via `Slack.getInstance().methodsAsync(slackOauthToken)` (DataCollaborationConfiguration.java:27) — shared across all requests; no per-request client allocation." — evidence: DataCollaborationConfiguration.java:19-29.
  - "Caffeine cache for channels: `SlackMessageProviderClient.cache` (max size 1, TTL 1 minute) holds the full channel map (SlackMessageProviderClient.java:38-44). On cache miss, a fresh `conversations.list` pull is triggered — full channel list is loaded into memory at once (paginated via cursor at 200/page in SlackAPIClientImpl.java:130-141). For workspaces with 10K+ channels this is a non-trivial allocation every minute." — evidence: SlackMessageProviderClient.java:34-44 + SlackAPIClientImpl.java:26 (LIMIT_SIZE=200) + SlackAPIClientImpl.java:30-47.
- **scaling_characteristics**:
  - "Sender thread is single-leader across the deployment via Postgres advisory lock id 120 (default `datacollaboration.sender-message-advisory-lock-id` per application.yml:202 + DataCollaborationProperties.java:10). Horizontal scaling of the API process does NOT linearly scale Slack delivery — only one node ever holds the lock and drains the queue." — evidence: DataCollaborationMessageSenderJob.java:93-95 + DataCollaborationProperties.java:10 + application.yml:202.
  - "Sender loop's polling cadence is fixed at 1 second between empty queue checks (DataCollaborationMessageSenderJob.java:70). Under low volume, this is ~1s of fixed end-to-end latency from `202 Accepted` to Slack delivery; under high volume, retries (1-second sleep in the catch block — line 60) further serialise throughput." — evidence: DataCollaborationMessageSenderJob.java:60, 70.
  - "No pagination / cap on the inbound endpoint itself — there is no `messages`-table size budget at the entity level. A pathological user could attach 10K messages to a single entity." — evidence: DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62 (no size check).
- **known_performance_gaps**:
  - "Sender throughput is bounded at ~1 msg/sec by the fixed sleep — a backlog of 1000 messages takes >16 minutes to drain at best." — evidence: DataCollaborationMessageSenderJob.java:70 — severity: LOW (Discussions is a low-volume feature in practice; surface for capacity planning).
  - "Caffeine channel-cache miss on every minute boundary triggers a full `conversations.list` walk (paginated 200/page). For a workspace with N channels the boot/idle cost is O(N/200) Slack round-trips every minute. There is no max-channels safety cap." — evidence: SlackMessageProviderClient.java:38-44 + SlackAPIClientImpl.java:30-47 — severity: LOW.

## sources

- understanding ← DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62 + DataCollaborationMessageSenderJob.java:30-95 + DataCollaborationConfiguration.java:1-30 + DataCollaborationFeatureCondition.java:9-23
- concepts.entities ← MessageRequest (components.yaml:3410-3423) + MessagePojo (DataCollaborationServiceImpl.java:85-102) + MessageProviderDto.SLACK (DataCollaborationController.java:37) + MessageChannelDto (DataCollaborationServiceImpl.java:53-56)
- concepts.operations ← DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62
- concepts.invariants ← DataCollaborationFeatureCondition.java:18-22 (route gating) + DataCollaborationController.java:38 (202 returned post-persist) + DataCollaborationServiceImpl.java:50-52 (entity must exist + not hollow) + DataCollaborationServiceImpl.java:53-56 (channel resolved via Slack API) + DataCollaborationServiceImpl.java:57-59 (owner = associated owner or null)
- dependencies_semantic.requires-feature ← DataCollaborationFeatureCondition.java:18-22 + application.yml:205
- dependencies_semantic.requires-config.slack-oauth-token ← DataCollaborationConfiguration.java:21-29 + application.yml:206 (commented default)
- dependencies_semantic.requires-config.sender-message-advisory-lock-id ← DataCollaborationProperties.java:10 + application.yml:202
- dependencies_semantic.requires-config.sending-messages-retry-count ← DataCollaborationProperties.java:12 + application.yml:204 + DataCollaborationProperties.java:14-20 (validate)
- dependencies_semantic.requires-runtime ← DataCollaborationServiceImpl.java:35, 57 + DataCollaborationMessageSenderJob.java:23-95
- tests_coverage_semantic.test_files ← (no test files found under `odd-platform-api/src/test/.../datacollaboration/`; verified via `find` + path-exists check)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/data-collaboration (2026-05-10, status 404) + source-of-truth documentation/docs/active-platform-features/data-collaboration.md:1-39
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration (2026-05-10, status 200) — fetched_excerpt above
- implicit_adrs.[0] (fail-fast token) ← DataCollaborationConfiguration.java:23-25
- implicit_adrs.[1] (disabled-by-default) ← application.yml:205 + DataCollaborationFeatureCondition.java:18-22
- implicit_adrs.[2] (thin reactive proxy) ← DataCollaborationController.java:25-49
- implicit_adrs.[3] (decoupled 202+queue+sender) ← DataCollaborationController.java:38 + DataCollaborationMessageSenderJob.java:23-87
- implicit_adrs.[4] (Postgres advisory lock for single-sender) ← DataCollaborationMessageSenderJob.java:93-95 + DataCollaborationProperties.java:10
- bugs_limitations_corner_cases.[0] (no authz gate) ← SecurityConstants.java:96-355 + AuthorizationCustomizer.java:29-30 + DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62
- bugs_limitations_corner_cases.[1] (no body validation) ← components.yaml:3410-3423 + SlackAPIClientImpl.java:64-81 + DataCollaborationMessageSenderJob.java:58-63
- bugs_limitations_corner_cases.[2] (channel id unscoped) ← DataCollaborationController.java:34-37 + DataCollaborationServiceImpl.java:53-56 + SlackAPIClientImpl.java:50-62
- bugs_limitations_corner_cases.[3] (data_entity not owner-scoped) ← DataCollaborationServiceImpl.java:47-62
- bugs_limitations_corner_cases.[4] (caller can't observe send failure) ← DataCollaborationController.java:38 + DataCollaborationServiceImpl.java:96 + DataCollaborationMessageSenderJob.java:58-63
- bugs_limitations_corner_cases.[5] (non-discriminating Slack rate-limit handling) ← DataCollaborationMessageSenderJob.java:54-65 + SlackAPIClientImpl.java:73-77
- bugs_limitations_corner_cases.[6] (no audit logging) ← DataCollaborationServiceImpl.java:57-62 + DataCollaborationServiceImpl.java:83-102
- bugs_limitations_corner_cases.[7] (no rate-limit / throttling) ← DataCollaborationController.java:33-39 + AuthorizationCustomizer.java:19-31 + DataCollaborationServiceImpl.java:47-62
- bugs_limitations_corner_cases.[8] (actuator env / OAuth-token sanitiser) ← SecurityConstants.java:96 + DataCollaborationConfiguration.java:21
- security.auth_mode_relevance ← AuthorizationCustomizer.java:29-30 + SecurityConstants.java:95-355
- security.ingestion_filter_relevance ← SecurityConstants.java:96 (whitelist contains `/ingestion/**` not `/api/datacollaboration/**`)
- security.authorization_assertions ← (none — see known_security_gaps.[0])
- security.owner_scoping ← DataCollaborationServiceImpl.java:47-62
- security.data_exposure.[0] ← DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62 + SlackAPIClientImpl.java:64-81
- security.data_exposure.[1] ← DataCollaborationServiceImpl.java:92-101
- security.known_security_gaps.[0] (no @PreAuthorize) ← SecurityConstants.java:96-355 + AuthorizationCustomizer.java:29-30 + DataCollaborationController.java:33-39 + DataCollaborationServiceImpl.java:47-62
- security.known_security_gaps.[1] (User-owner association optional) ← DataCollaborationServiceImpl.java:57-62
- security.known_security_gaps.[2] (cross-owner posting) ← DataCollaborationServiceImpl.java:47-62
- security.known_security_gaps.[3] (channel-id fully user-supplied) ← DataCollaborationController.java:34-37 + SlackAPIClientImpl.java:50-62
- security.known_security_gaps.[4] (Slack error leak via persisted failure reason) ← DataCollaborationMessageSenderJob.java:54-63
- performance.hot_paths ← DataCollaborationServiceImpl.java:50, 53-56, 57 + SlackAPIClientImpl.java:50-62
- performance.throughput_characteristics ← DataCollaborationController.java:33-39 + components.yaml:3410-3423 + DataCollaborationMessageSenderJob.java:60, 70
- performance.resource_allocation ← DataCollaborationConfiguration.java:19-29 + SlackMessageProviderClient.java:34-44 + SlackAPIClientImpl.java:26, 30-47
- performance.scaling_characteristics ← DataCollaborationMessageSenderJob.java:60, 70, 93-95 + DataCollaborationProperties.java:10 + application.yml:202
- performance.known_performance_gaps ← DataCollaborationMessageSenderJob.java:70 + SlackMessageProviderClient.java:38-44 + SlackAPIClientImpl.java:30-47

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes
