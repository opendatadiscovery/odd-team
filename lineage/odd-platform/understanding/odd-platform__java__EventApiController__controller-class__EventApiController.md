---
node_id: "odd-platform java EventApiController controller-class:EventApiController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-25-zf-event-api
---

# EventApiController — semantic understanding

## understanding

`POST /api/slack/events` is the inbound Slack Events API webhook receiver for
the Data Collaboration feature. The controller (EventApiController.java:18-57)
is a thin reactive surface: it reads the raw JSON body, delegates to
`SlackEventParser.parse(...)` to classify the payload into one of four
ParseResultType cases (CHALLENGE / FILTER / ERROR / PAYLOAD), and either echoes
back Slack's URL-verification `challenge` value, ack-200s anything filtered or
unhandled, or — for the PAYLOAD case (a thread-reply `message` event) — calls
`DataCollaborationService.enqueueMessageEvent(...)` which inserts a row into
`message_provider_event` (state=PENDING) for the asynchronous
`DataCollaborationMessageEventProcessor` thread to materialise into a child
`message` row later. The endpoint is gated by `@ConditionalOnDataCollaboration`
(EventApiController.java:15) — the controller bean is not registered when
`datacollaboration.enabled=false` (DataCollaborationFeatureCondition.java:18-22),
so the route 404s by default.

## concepts

- entities: [SlackEvent, MessageEvent, MessageChangedEvent, ParseResult, MessageEventRequest, MessageProviderEventPojo, Message (parent), MessageProviderDto]
- operations: [receive-slack-webhook, classify-slack-event, echo-url-challenge, enqueue-thread-reply-event, ack-filtered-event, async-materialise-event-to-message]
- invariants: [route exists only when datacollaboration.enabled=true; URL verification challenge MUST echo the challenge value to register the Slack callback; thread-reply messages only (parent posts and non-thread replies are FILTER-acked); enqueue is a thin SQL INSERT — actual message materialisation happens in the leader-elected event-processor thread; the path is publicly accessible (whitelisted in all auth modes)]
- audiences: [Slack workspace event-subscription delivery system targeting `<ODD_PLATFORM_BASE_URL>/api/slack/events` per the Slack app manifest published in the live docs]

## dependencies_semantic

- requires-feature:
  - `datacollaboration.enabled=true` (DataCollaborationFeatureCondition.java:18-22 + application.yml:205 default `false`) — controller bean not registered when false; route returns 404.
- requires-config:
  - `datacollaboration.receive-event-advisory-lock-id` (DataCollaborationProperties.java:11 + application.yml:201=`110`) — Postgres advisory-lock id the downstream `DataCollaborationMessageEventProcessor` thread (DataCollaborationMessageEventProcessor.java:147-149) acquires to single-leader the event-to-message materialisation loop. The controller itself does not touch the lock; the lock is taken by the consumer thread.
  - **Live docs anchor (NOT an `@docs` annotation in the source):** `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` publishes the Slack app manifest with `request_url: https://<ODD_PLATFORM_BASE_URL>/api/slack/events` and the bot event-subscription `message.channels`. Per WebFetch 2026-05-25 status 200 the docs are the user-facing source of truth for the endpoint's existence and shape.
- requires-runtime:
  - Slack workspace event-subscription configured at the docs-published `request_url`. The app manifest in the docs requests scopes `channels:history`, `channels:read`, `chat:write`, `users:read`, `incoming-webhook` and bot event `message.channels`.
  - Operating `DataCollaborationMessageEventProcessor` thread (DataCollaborationMessageEventProcessor.java:34-76) — the controller only enqueues; without the processor running, `message_provider_event` rows accumulate indefinitely in PENDING state.
  - Existing tracked parent `message` row whose `provider_message_id` equals the inbound event's `thread_ts` (SlackMessageProviderEventHandler.java:31). Events for thread replies whose parent is NOT a tracked ODD message are silently dropped at the service layer (`switchIfEmpty` returns `Mono.empty()` — SlackMessageProviderEventHandler.java:32-35) and the controller still ack-200s.

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "URL-verification CHALLENGE returns 200 with `{\"challenge\": \"<echoed-value>\"}` body — the only contract Slack uses to register the callback"
    test_class: integration
    criticality: CRITICAL
    note: "If this regresses, Slack rejects the event subscription and the entire data-collaboration thread-reply ingest is silently dead — the failure is asymptomatic on the ODD side; only Slack's app config UI shows the verification failure."
  - behaviour: "thread-reply `message` event without `thread_ts` is FILTERed (acked, not enqueued)"
    test_class: integration
    criticality: HIGH
  - behaviour: "`message_changed` subtype with thread_ts enqueues UPDATE; without thread_ts FILTERed"
    test_class: integration
    criticality: HIGH
  - behaviour: "unknown outer event type / unknown inner event type / null inner event — all return 200 (FILTER / ERROR), not 4xx"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "endpoint accepts forged POSTs from any internet caller (no X-Slack-Signature verification, no auth gate, path whitelisted in all auth modes)"
    test_class: security
    criticality: HIGH
    note: "See known_security_gaps below; this is the load-bearing untested behaviour."
  - behaviour: "Slack at-least-once duplicate delivery — same event_id arriving N times inserts N message_provider_event rows; downstream processor materialises N child message rows"
    test_class: integration
    criticality: HIGH
    note: "No idempotency key, no unique constraint on (provider, event_id) in V0_0_59__data_collaboration.sql:25-39."
  - behaviour: "404 Not Found when datacollaboration.enabled=false"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "malformed JSON request body — JSONSerDeUtils.deserializeJson throws; controller surfaces what HTTP status?"
    test_class: integration
    criticality: MEDIUM
    note: "SlackEventParser.parse(...) has no try/catch on the deserialize call (SlackEventParser.java:23); a malformed body propagates through `.map(slackEventParser::parse)` as an exception and the response shape depends on the global reactive error handler, untested."
  - behaviour: "performance: sustained Slack delivery burst (e.g. 100 events/sec from a chatty workspace) — single-controller-instance throughput, processor backlog growth"
    test_class: performance
    criticality: MEDIUM
- test_files: []
- gaps: |
    Zero test files reference `EventApiController` or `/api/slack/events`
    (verified by `grep -rln 'EventApiController|/api/slack/events' <odd-platform>/src/test`
    — no matches; the only references are in main source + the
    LoginFormSecurityConfiguration whitelist + the SecurityConstants whitelist).
    The integration class (parser + controller + service + processor + 4 tables)
    is the largest fully-untested user-data-ingest surface in the
    data-collaboration package. The security_class gap is the worst:
    the endpoint is internet-reachable by design (it has to be, for Slack
    to deliver events) but the codebase contains no test, no documentation,
    and no implementation of the Slack signing-secret verification that
    Slack mandates for production-grade integrations
    (`https://api.slack.com/authentication/verifying-requests-from-slack`).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration"
    anchor: "#enable-data-collaboration"
    rationale: "The Slack app manifest + the `request_url: https://<ODD_PLATFORM_BASE_URL>/api/slack/events` literal + the bot event subscription `message.channels` + the `datacollaboration.enabled` / `datacollaboration.slack-oauth-token` properties are all canonically defined here. This is the operator-facing source of truth for the endpoint's existence."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Per WebFetch 2026-05-25 status 200: the "Enable Data Collaboration"
      section publishes the Slack app manifest with
      `request_url: https://<ODD_PLATFORM_BASE_URL>/api/slack/events`,
      bot scopes `channels:history, channels:read, chat:write, users:read,
      incoming-webhook`, and bot event subscription `message.channels`. The
      section documents platform properties `datacollaboration.enabled`
      (must be `true`), `datacollaboration.slack-oauth-token`,
      `datacollaboration.sending-messages-retry-count` (default `3`),
      `datacollaboration.receive-event-advisory-lock-id` (default `110`),
      `datacollaboration.sender-message-advisory-lock-id` (default `120`),
      `datacollaboration.message-partition-period` (default `30`). The section
      contains NO mention of Slack signing-secret / signature verification /
      X-Slack-Signature / X-Slack-Request-Timestamp anywhere — verified by
      asking the WebFetch model to quote any such mention; the model returned
      "Not found".
  - url: "https://docs.opendatadiscovery.org/active-platform-features/data-collaboration"
    anchor: ""
    rationale: "Feature-level page would describe the Discussions tab and the inbound-event behaviour from a user perspective."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      WebFetch 2026-05-25 returned 404. The feature page is not yet
      published to the live site (per the sibling DataCollaborationController
      sidecar note: the active-platform-features/data-collaboration source
      file exists in the documentation repo but live publication of that
      slice is still pending).
- doc_drift_findings:
  - "Live docs (configuration-and-deployment/odd-platform#enable-data-collaboration) instruct operators to point their Slack app's Event Subscriptions request_url at `<ODD_PLATFORM_BASE_URL>/api/slack/events` and request scopes including `channels:history` — i.e. the docs publish a deployment instruction that exposes a publicly-reachable endpoint — but the docs are silent about (a) the absence of Slack signing-secret signature verification in the code, (b) the endpoint being whitelisted from authentication in all auth modes (SecurityConstants.java:96 + LoginFormSecurityConfiguration.java:50), and (c) Slack's at-least-once delivery model producing duplicate downstream message_provider_event rows because the schema lacks a uniqueness constraint on the Slack event_id. An operator following the docs to integrate Slack ends up with an authenticated-bypass, signature-unverified, replay-vulnerable webhook on their public internet surface — and would have no way to know from the docs alone."
  - "Live docs mention `incoming-webhook` as a requested bot scope in the Slack app manifest but the code never uses Slack incoming webhooks (the codebase uses chat.postMessage via the bot-user OAuth token in SlackAPIClientImpl). The scope is requested but unused — historical leftover or copy-paste from a Slack example manifest. Not a security-critical issue but a doc-vs-code drift."

## implicit_adrs

- "Inbound Slack events are persisted to a queue table (`message_provider_event`) and materialised asynchronously by a leader-elected processor thread rather than handled synchronously on the request path." — evidence: EventApiController.java:38-40 + DataCollaborationServiceImpl.java:64-69 + DataCollaborationMessageEventProcessor.java:34-76 — intent_anchor: "`return dataCollaborationService.enqueueMessageEvent(parseResult.messageEvent()).then(SlackEventResponse.ack())` — the controller acks 200 as soon as the queue row is persisted, never waits for the message to be created; the processor runs as a long-running Thread under `acquireLeaderElectionConnection()`." — confidence: HIGH
- "Unknown / unhandled Slack event types are ACKED with 200 rather than 4xx-ed; only structurally-broken payloads (event_callback with null inner event) return 400." — evidence: EventApiController.java:30-37 + SlackEventParser.java:38-43, 56-60, 107-110 — intent_anchor: "the parser routes every unknown / unsupported case to `ParseResultType.FILTER` (which the controller acks 200) and the only ERROR branch is the broken-payload case at SlackEventParser.java:48-52; an unknown event type is `log.debug(filterMessage)` + 200. Slack's documented contract is to retry on non-2xx, so ack-200 on filtered events is the explicit choice to avoid Slack-side retry storms for events ODD does not care about." — confidence: HIGH
- "Only thread replies on tracked parent messages produce a downstream materialised child message; non-thread chatter is filtered at parse-time." — evidence: SlackEventParser.java:65-74, 86-95 + SlackMessageProviderEventHandler.java:31-35 — intent_anchor: "two filters: (1) parser-level `if (messageEvent.getThreadTs() == null) return FILTER` ('Slack message event is not a thread reply'), (2) service-level `switchIfEmpty(Mono.defer(...)` ('Message is not a reply thread for tracked messages'). The two-stage filter encodes that ODD only mirrors the conversation thread anchored to a message ODD itself sent." — confidence: HIGH

## bugs_limitations_corner_cases

- "**No Slack request signature verification.** Slack's Events API protocol requires receivers to validate the `X-Slack-Signature` HMAC-SHA256 header (computed over `v0:{X-Slack-Request-Timestamp}:{raw body}` using the app's signing-secret) per `https://api.slack.com/authentication/verifying-requests-from-slack`. The entire codebase contains zero matches for `X-Slack-Signature`, `signing.secret`, `signingSecret`, `verifySignature`, `HMAC.SHA256`, or any related verification primitive — verified by grep across `<odd-platform>`. The controller deserializes the raw body straight from `@RequestBody Mono<String>` (EventApiController.java:23-27) and never reads any header. Any internet host that can reach the endpoint can forge events." — evidence: EventApiController.java:22-27 + SlackEventParser.java:22-23 (parse signature: `parse(final String rawJson)` — no headers, no timestamp, no signature) — severity: HIGH
- "**No authentication gate on the endpoint, in any auth mode.** The path `/api/slack/events` is in `WHITELIST_PATHS` (SecurityConstants.java:96), which is consumed by `AuthorizationCustomizer` (AuthorizationCustomizer.java:22-23) for both OAUTH2 and LDAP auth modes, AND is explicitly listed in `permittedPaths` for LOGIN_FORM mode (LoginFormSecurityConfiguration.java:49-51); `DISABLED` mode permits everything anyway. Combined with the missing signature verification (above), the endpoint accepts unauthenticated POSTs from any caller on the public internet in every supported deployment configuration. The docs' published manifest scope `channels:history` means the bot can read every public channel's history, so an attacker who can forge events can inject arbitrary `message_provider_event` rows (the rows survive parser filtering only when `thread_ts` matches an existing tracked message's `provider_message_id`, but enumeration of tracked thread_ts values is feasible via observing public Slack channels)." — evidence: SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-23 + LoginFormSecurityConfiguration.java:49-51 + DisabledAuthSecurityConfiguration.java:13-17 — severity: HIGH
- "**No idempotency / dedup on Slack at-least-once delivery.** Slack documents that the Events API retries undelivered events for up to 3 attempts and may double-deliver under load (`https://api.slack.com/apis/events-api#retries`). The `message_provider_event` table (V0_0_59__data_collaboration.sql:25-39) has no unique constraint on `(provider, event_id)` or any equivalent — `id` is a BIGSERIAL and the only constraints are the PK on `id` and an FK on `(parent_message_uuid, parent_message_created_at)`. The repository INSERT (ReactiveMessageRepositoryImpl.java:136-155) performs a plain `INSERT INTO message_provider_event` with no `ON CONFLICT` clause. A duplicated Slack delivery for the same `event_ts` therefore inserts N rows; the processor (DataCollaborationMessageEventProcessor.java:88-101 for CREATE) materialises N child message rows with N distinct `message.uuid` values but the same `provider_message_id` (Slack thread reply `ts`). Downstream `getUUIDByProviderInfo` (ReactiveMessageRepositoryImpl.java:188-195) does `select uuid from message where provider_message_id = ? and provider = ?` with no `LIMIT 1` — under duplicate rows it returns a single arbitrary uuid (jOOQ `.mono(query)` on multi-result is undefined under multi-result; effectively first-row but order-undefined)." — evidence: ReactiveMessageRepositoryImpl.java:136-155 + V0_0_59__data_collaboration.sql:25-39 + DataCollaborationMessageEventProcessor.java:88-101 — severity: HIGH
- "**Slack's documented `Retry-After`/`X-Slack-Retry-Num` headers ignored.** The controller does not read `X-Slack-Retry-Num` (which would let the receiver detect a Slack retry and short-circuit) nor `X-Slack-Retry-Reason`. Slack also documents that receivers ack-200 within 3 seconds or Slack retries; the implementation's enqueue path is fast (single INSERT) but if the controller is under load and the INSERT exceeds 3s, Slack will deliver again and the duplicate-row bug above kicks in." — evidence: EventApiController.java:22-42 (no header reads) — severity: MEDIUM
- "**Filter-acked unknown event types silently drop legitimate non-`message.channels` events without surfacing to the operator.** The Slack app manifest in the docs subscribes only to `message.channels`, so additional Slack event-subscriptions configured in the Slack UI but not handled in `SlackEventParser` are dropped at `log.debug` level (SlackEventParser.java:38-43) with no DLQ, metric, or operator-visible signal. The trade-off (silent drop in exchange for no Slack retry storm) is intentional given Slack's retry-on-non-2xx contract, but undocumented for the operator." — evidence: SlackEventParser.java:38-43, 56-60, 107-110 + EventApiController.java:30-33 — severity: LOW
- "**Malformed JSON request body produces an undefined HTTP response.** `JSONSerDeUtils.deserializeJson` (SlackEventParser.java:23) is called inside `.map(slackEventParser::parse)` without a try/catch; an `IOException`-class failure propagates out as a reactive error and the response shape is determined by the global Spring WebFlux error handler. Untested, undocumented, and may return a non-2xx response that Slack interprets as 'retry this event'." — evidence: SlackEventParser.java:22-23 — severity: MEDIUM
- "**Unchecked `(Map<String, Object>) requestMap.get(\"event\")` cast.** SlackEventParser.java:45 performs an unchecked cast; if a malicious payload sends `event: \"string-not-object\"` or `event: 42`, `ClassCastException` propagates from inside the parse step. Same response-shape uncertainty as above." — evidence: SlackEventParser.java:45 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "DataCollaborationProperties.java:11 + application.yml:201"
      name: "datacollaboration.receive-event-advisory-lock-id"
      value: "110 (application.yml default)"
      questions:
        - q: "What at N = 0 or unset?"
          a: "Not directly relevant to the controller — the controller never reads the lock id. The downstream DataCollaborationMessageEventProcessor (DataCollaborationMessageEventProcessor.java:147-149) uses the value to acquire a Postgres advisory lock; if unset/0 the processor competes with any code path holding the global advisory lock 0, which collides with leaderelection.PostgreSQLLeaderElectionManager defaults."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationMessageEventProcessor.java:147-149 + DataCollaborationProperties.java:11"
        - q: "What at tunable collision (set equal to sender-message-advisory-lock-id=120 or partition.advisory-lock-id=90)?"
          a: "Lock contention serialises the sender + event-processor + partition jobs onto one leader connection; throughput drops to one job at a time. Not surfaced to operator. Probe-needed to measure under load."
          confidence: PROBE-NEEDED
          evidence: "P-139"
        - q: "What does the operator see?"
          a: "Silent — only the slow processor throughput is visible; the lock contention itself is invisible without pg_advisory_lock-table inspection."
          confidence: STATIC-INFERRED
          evidence: "DataCollaborationMessageEventProcessor.java:34-76 (the loop logs only on exception)"
  name_behavior_pairs:
    - name: "handleSlackEvent"
      promise: "Receive and process a Slack workspace event delivered to the configured callback URL — implies verification that the caller is Slack (signature check) and reliable processing (no duplicate handling)."
      implementation: "Reads raw body, deserialises JSON, routes by `type` field into CHALLENGE/FILTER/ERROR/PAYLOAD; for PAYLOAD calls enqueueMessageEvent (a plain INSERT). NO signature verification. NO header reads. NO replay protection. NO `event_id` dedup."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator believing they have set up a 'Slack callback' has actually set up an unauthenticated public POST endpoint that accepts any JSON shaped like a Slack event. Forgery + replay are both unmitigated."
      confidence: STATIC-INFERRED
      evidence: "EventApiController.java:22-42 + SlackEventParser.java:22-111 + grep across <odd-platform> for X-Slack-Signature/HMAC/signing-secret returns zero matches"
    - name: "SlackEventResponse.challengeResponse / ack / error"
      promise: "Three response shapes for the three documented Slack event-receiver requirements: challenge echo for verification, 200 ack for accepted events, 4xx for rejected."
      implementation: "challengeResponse returns 200 with body `{\"challenge\": \"<value>\"}` (the JSON record `SlackEventResponse` has a single `challenge` field); ack returns 200 with no body; error returns 400 with no body."
      drift: NONE
      operator_visible_consequence: "Matches Slack's documented contract for the URL-verification step (https://api.slack.com/events/url_verification expects the receiver to return the challenge string)."
      confidence: STATIC-INFERRED
      evidence: "EventApiController.java:44-56"
  orderings: []
  auth_gates:
    - location: "EventApiController.java:22 + SecurityConstants.java:96 + LoginFormSecurityConfiguration.java:49-51 + AuthorizationCustomizer.java:22-23 + DisabledAuthSecurityConfiguration.java:13-17"
      endpoint: "POST /api/slack/events"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: `anyExchange().permitAll()` (DisabledAuthSecurityConfiguration.java:16) — accepts. LOGIN_FORM: in `permittedPaths` (LoginFormSecurityConfiguration.java:49-51) — accepts without auth. OAUTH2 + LDAP: both use `AuthorizationCustomizer` which calls `pathMatchers(WHITELIST_PATHS).permitAll()` (AuthorizationCustomizer.java:22-23) with `/api/slack/events` in `WHITELIST_PATHS` (SecurityConstants.java:96) — accepts without auth. **All four modes accept unauthenticated traffic.**"
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:49-51 + AuthorizationCustomizer.java:22-23 + DisabledAuthSecurityConfiguration.java:13-17"
        - q: "What does an unauthenticated caller see?"
          a: "200 OK for CHALLENGE (echoes attacker's payload `challenge` field back), 200 OK for any FILTER case, 400 Bad Request only for null-event ERROR case, 200 OK for PAYLOAD (and the row gets inserted into message_provider_event — though only acted on by the processor if thread_ts maps to a tracked parent message)."
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java:28-41"
        - q: "What does a wrong-role caller see?"
          a: "Role is irrelevant — path is whitelisted. Same response as unauthenticated."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:22-23"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere. The controller has no @PreAuthorize; the service `DataCollaborationServiceImpl.enqueueMessageEvent` (DataCollaborationServiceImpl.java:64-69) has no authentication or authorization check; the repository `createMessageEvent` (ReactiveMessageRepositoryImpl.java:136-155) performs a plain INSERT. The only filter is the parse-level thread_ts check (SlackEventParser.java:65-74) which is structural, not authorization. The fact that the path is intentionally whitelisted is an implicit ADR (Slack must reach it), but there is no compensating signature check — see bugs_limitations_corner_cases."
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java:18-57 + DataCollaborationServiceImpl.java:64-69 + ReactiveMessageRepositoryImpl.java:136-155"
  resource_boundaries:
    - location: "EventApiController.java:38-40 + ReactiveMessageRepositoryImpl.java:136-155"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two simultaneous deliveries of the same Slack event_id insert two message_provider_event rows (no unique constraint per V0_0_59__data_collaboration.sql:25-39, no ON CONFLICT in the INSERT). The downstream processor then materialises two child message rows; `getUUIDByProviderInfo` (ReactiveMessageRepositoryImpl.java:188-195) under multi-row matches returns an arbitrary uuid because the SELECT has no LIMIT and no ORDER BY. State is not 'corrupted' in the SQL sense but the operator-visible result is duplicate threads."
          confidence: STATIC-INFERRED
          evidence: "V0_0_59__data_collaboration.sql:25-39 + ReactiveMessageRepositoryImpl.java:136-155, 188-195"
        - q: "Is the call replay-safe?"
          a: "No. Slack's at-least-once protocol (documented in Slack's Events API retries page) means duplicate delivery is expected; with no event_id dedup and no signature timestamp check, replay is unmitigated. Confirmed via P-138."
          confidence: PROBE-NEEDED
          evidence: "P-138"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache on this path."
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java + DataCollaborationServiceImpl.java (no @Cacheable on the chain)"
  request_inputs:
    - location: "EventApiController.java:23-24"
      input_kind: body-field
      input_name: "rawRequestBody (Mono<String>) — the raw Slack event JSON"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A raw Slack event payload; the API contract is Slack's published Events API JSON schema (type=url_verification | event_callback with nested event)."
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java:23-24"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Chain: controller (line 26-41) -> SlackEventParser.parse(line 22-111) -> if PAYLOAD, DataCollaborationService.enqueueMessageEvent (line 65-69) -> MessageProviderEventHandlerFactory.getOrFail(SLACK).enqueueEvent -> SlackMessageProviderEventHandler.enqueueEvent (line 25-43) -> ReactiveMessageRepository.createMessageEvent (line 136-155) -> JSONB INSERT into message_provider_event."
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java:26-41 + SlackEventParser.java:22-111 + DataCollaborationServiceImpl.java:64-69 + SlackMessageProviderEventHandler.java:25-43 + ReactiveMessageRepositoryImpl.java:136-155"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES (structurally) — the parser reads the documented Slack envelope. BUT: the input is treated as trusted, never authenticated against the Slack signing secret. Naming-wise the input is `rawRequestBody`, which is honest about being raw — the drift here is not in input-name-vs-implementation but in the implicit promise that 'this came from Slack' which the implementation never verifies."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java:22-27"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no name-vs-implementation drift on the raw-body input."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "The ServerWebExchange / request headers (X-Slack-Signature, X-Slack-Request-Timestamp, X-Slack-Retry-Num) are not bound at all — the controller method signature uses ONLY `@RequestBody Mono<String>` and discards every header. The headers Slack sends (and that Slack's contract assumes the receiver reads) are available-but-unused. This is the closest 'available-but-unused' smell — and the canonical fix anchor for adding signature verification."
          confidence: STATIC-INFERRED
          evidence: "EventApiController.java:22-25 (no `@RequestHeader`, no `ServerWebExchange` parameter)"
      routes_to_finding: "bugs_limitations_corner_cases.[0] (no signature verification) AND bugs_limitations_corner_cases.[3] (Retry-After/Retry-Num ignored)"
  probes_emitted:
    - probe_id: P-140
      question: "Does the live /api/slack/events endpoint accept and process a forged Slack event (no X-Slack-Signature header), and what does the operator observe?"
      probe_path: "lineage/odd-platform/probes/P-140.yaml"
    - probe_id: P-138
      question: "Does Slack at-least-once duplicate delivery (same event_ts twice) produce duplicate downstream message rows? What does getUUIDByProviderInfo return under multi-row matches?"
      probe_path: "lineage/odd-platform/probes/P-138.yaml"
    - probe_id: P-139
      question: "Under sustained Slack event burst (60 events/sec for 60s) and an event-processor advisory-lock collision with the sender thread, what is the processor's throughput and the message_provider_event backlog growth?"
      probe_path: "lineage/odd-platform/probes/P-139.yaml"
  stress_summary:
    triggers_total: 5
    questions_total: 17
    answers_static_inferred: 14
    answers_probe_needed: 3
    answers_reference: 0
    drift_flags: 1
```

## security

- auth_mode_relevance: [DISABLED, LOGIN_FORM, OAUTH2, LDAP]
  notes: |
    All four auth modes apply, but only insofar as they all WHITELIST this
    path. The whitelist coverage is:
    - DISABLED: `anyExchange().permitAll()` covers it (DisabledAuthSecurityConfiguration.java:13-17)
    - LOGIN_FORM: explicit entry in `permittedPaths` (LoginFormSecurityConfiguration.java:49-51)
    - OAUTH2 + LDAP: in `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96)
      and consumed by `AuthorizationCustomizer` (AuthorizationCustomizer.java:22-23)
      which is wired into the OAUTH2 chain (OAuthSecurityConfiguration.java:98)
      and the LDAP chain.
- ingestion_filter_relevance: "NO — this is a Slack-event ingestion path, not the collector `/ingestion/entities` path. The S2S ingestion filter does not apply."
- authorization_assertions: []
  notes: "Endpoint has no @PreAuthorize and no programmatic permission check anywhere on the request path (controller -> service -> repository). Confirmed by reading EventApiController.java:18-57, DataCollaborationServiceImpl.java:64-69, SlackMessageProviderEventHandler.java:25-43, ReactiveMessageRepositoryImpl.java:136-155."
- owner_scoping: "BYPASSES — the inbound Slack event is enqueued by structural match (thread_ts -> parent message uuid) without consulting the parent message's owner. A Slack message in any channel whose thread_ts matches any tracked ODD message's provider_message_id will be enqueued. The parent message's owner / data-entity ownership is never consulted on the receive path."
- data_exposure:
  - "The endpoint EXPOSES URL-verification challenge echo to any caller — a useful oracle for confirming the platform is alive (`POST {type:url_verification, challenge:probe-value}` -> 200 + `{challenge:probe-value}`) without authentication. This is fundamental to Slack's verification protocol and cannot be removed, but it's worth noting that the endpoint's existence is publicly probeable."
  - "Successful PAYLOAD ingest creates a row in `message_provider_event` whose `event` JSONB column stores the entire Slack event payload (including author user IDs, message text, timestamps). If forged, an attacker can pollute the JSONB column with attacker-controlled content; downstream the processor reads the JSONB via Gson into MessageEvent (SlackMessageProviderEventHandler.java:47) and writes `message.text` and `message.provider_message_author` into the materialised child message — i.e. attacker text could appear in the Discussions tab of a tracked data entity if the attacker can guess a tracked thread_ts (feasible if the ODD platform is connected to a public Slack workspace and the attacker can observe channel history)."
- known_security_gaps:
  - "Endpoint has NO Slack request-signature verification — Slack's `X-Slack-Signature` HMAC-SHA256 over `v0:{timestamp}:{body}` using the app signing-secret is the documented mechanism (`https://api.slack.com/authentication/verifying-requests-from-slack`). Zero matches for `X-Slack-Signature`, `signing.secret`, `signingSecret`, `verifySignature`, `HMAC.SHA256` across the entire `<odd-platform>` codebase." — evidence: EventApiController.java:22-27 (no header bindings) + grep across `<odd-platform>` returns no matches — severity: HIGH
  - "Endpoint is whitelisted from authentication in ALL four auth modes — explicit listing in `WHITELIST_PATHS` (consumed by OAUTH2 + LDAP) and `permittedPaths` (LOGIN_FORM); DISABLED mode is permit-all by definition. Combined with the missing signature verification, ANY internet host that can reach the platform's port can POST to this endpoint." — evidence: SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:49-51 + AuthorizationCustomizer.java:22-23 — severity: HIGH
  - "No protection against Slack at-least-once replay — no event_id stored, no uniqueness constraint on `message_provider_event(provider, event_id)`, no `ON CONFLICT` in the INSERT (ReactiveMessageRepositoryImpl.java:136-155 + V0_0_59__data_collaboration.sql:25-39). A captured genuine Slack event payload (forged or replayed) is accepted N times producing N message rows." — evidence: ReactiveMessageRepositoryImpl.java:136-155 + V0_0_59__data_collaboration.sql:25-39 — severity: HIGH
  - "Live docs publish the callback URL and request `channels:history` scope but document none of the above gaps. An operator following the docs to integrate Slack has no way to know from the docs alone that the endpoint is unauthenticated and signature-unverified." — evidence: `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` (verified 2026-05-25 status 200) — severity: HIGH (doc gap, not code gap; routes to docs follow-up)

## performance

- hot_paths:
  - "Per-event handler runs synchronously on the request thread up to the SQL INSERT: parse (CPU + JSON) + `getUUIDByProviderInfo` (one SELECT) + `createMessageEvent` (one INSERT) before ack-200. Slack's documented 3-second ack deadline means this chain must complete within 3s under all loads — there is no offload, no buffering, no timeout protection." — evidence: EventApiController.java:26-42 + SlackMessageProviderEventHandler.java:25-43
- throughput_characteristics:
  - "Single event per request (no batching), reactive Mono/Flux signature — non-blocking but per-call DB round-trip x2 (SELECT + INSERT). Throughput is bounded by DB connection pool size and INSERT latency on the partitioned `message_provider_event` table."
- resource_allocation:
  - "No client pooling concerns on this path — the inbound side does not call out to Slack. The downstream processor (DataCollaborationMessageEventProcessor) uses one long-running thread + one held connection (DataCollaborationMessageEventProcessor.java:36-38) for the leader-elected materialisation loop."
  - "JSONB column in `message_provider_event.event` stores the full Slack payload (V0_0_59__data_collaboration.sql:32) — no payload-size cap. A maliciously-sized Slack event JSON (or one tactically crafted by an attacker exploiting the unauthenticated endpoint) bloats the table without bound."
- scaling_characteristics:
  - "Controller is stateless — horizontal scaling works for ingest throughput up to DB INSERT contention on `message_provider_event`. BUT: the processor is single-leader (acquires `receive-event-advisory-lock-id=110`), so adding controller instances does not add processing throughput — the backlog grows under sustained ingest spikes."
  - "No pagination concern on this endpoint (single-event POST). The downstream processor reads `getPendingEvents` (DataCollaborationMessageEventProcessor.java:42) which is not seen here — out-of-scope for this controller node."
- known_performance_gaps:
  - "No request-body size limit applied at the controller level — Spring WebFlux defaults govern. A 50MB JSON POST is read into memory by `@RequestBody Mono<String>` before parser dispatch." — evidence: EventApiController.java:23-24 (no `DataBuffer` size cap configured) — severity: MEDIUM
  - "No rate-limit on the unauthenticated public endpoint. Combined with the no-signature gap, an attacker can flood the endpoint and the JSONB column with forged events until the partition fills." — evidence: EventApiController.java + no filter / interceptor / annotation evidence anywhere — severity: MEDIUM
  - "Per-request synchronous DB round-trips (`getUUIDByProviderInfo` SELECT + `createMessageEvent` INSERT) before ack: under DB-connection-pool exhaustion the controller may exceed Slack's 3-second ack window, triggering Slack's retry — which (per the dedup gap above) compounds the load." — evidence: SlackMessageProviderEventHandler.java:31-43 + ReactiveMessageRepositoryImpl.java:136-155 — severity: MEDIUM

## upstream_callers

- entry_point: "webhook:slack-events-api"
  caller_node: "external Slack workspace event-subscription delivery (per docs https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration — `request_url: https://<ODD_PLATFORM_BASE_URL>/api/slack/events` + bot event `message.channels`)"
  multiplicity_per_trigger: "1..N — Slack at-least-once protocol delivers each event at least once, up to ~3 retries on non-2xx response within their retry window"
  evidence: "EventApiController.java:22-25 (the @PostMapping is the only callable entrypoint on the class)"
  observation_class: webhook
  unresolved: false

- entry_point: "rest:url-verification-handshake"
  caller_node: "Slack app config UI / Slack Events API verification step"
  multiplicity_per_trigger: "1 per configuration change in the Slack app's Event Subscriptions page"
  evidence: "EventApiController.java:29 (the CHALLENGE branch handles the one-shot `type:url_verification` request Slack sends when the operator configures or reconfigures the callback)"
  observation_class: webhook
  unresolved: false

- entry_point: "unresolved — adversarial probing"
  caller_node: "any internet host able to reach the platform's port"
  multiplicity_per_trigger: "unbounded — no rate limit, no auth, no signature check"
  evidence: "SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:49-51 (path is whitelisted in all auth modes) + EventApiController.java:22-27 (no signature verification)"
  observation_class: webhook
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "Inserts one row into `message_provider_event` (state=PENDING) per accepted PAYLOAD event. The JSONB `event` column stores the raw Slack event payload."
  evidence: "ReactiveMessageRepositoryImpl.java:136-155 + V0_0_59__data_collaboration.sql:25-39"
  cardinality_per_call: "0 (CHALLENGE/FILTER/ERROR) or 1 (PAYLOAD with matching parent thread_ts) — and 0 with `switchIfEmpty` log.debug when thread_ts does not map to a tracked parent message"
  reachable_from_entry_points:
    - "webhook:slack-events-api"
    - "unresolved — adversarial probing"

- side_effect_class: db-write
  description: "Indirect (later, via DataCollaborationMessageEventProcessor): one row inserted into `message` (state=EXTERNAL) per processed message_provider_event row of action=CREATE; one UPDATE on existing `message.text` per action=UPDATE row. Not reached on the request thread."
  evidence: "DataCollaborationMessageEventProcessor.java:88-127 + DataCollaborationMessageEventProcessor.java:130-145 (buildMessageRecord) — these execute on the processor thread, NOT the controller thread"
  cardinality_per_call: "0 on the controller call; 1 later, asynchronously, per persisted message_provider_event row when the processor loop picks it up"
  reachable_from_entry_points:
    - "webhook:slack-events-api (eventually, via the processor thread)"
    - "unresolved — adversarial probing (eventually, if forged event's thread_ts matches a tracked parent — i.e. forged content appears in a Discussions tab)"

- side_effect_class: log-emit
  description: "Two log emissions — log.debug for FILTER (e.g. unknown event types, non-thread messages) and log.error for ERROR (broken payload)."
  evidence: "EventApiController.java:31, 35"
  cardinality_per_call: "0 or 1, dependent on parse result"
  reachable_from_entry_points: ["webhook:slack-events-api", "unresolved — adversarial probing"]

- side_effect_class: page-render
  description: "Returns either an empty body (ack/error), or `{\"challenge\": \"<echoed-value>\"}` for the URL-verification challenge — note the challenge echo gives an attacker confirmation that an `/api/slack/events` endpoint is alive on this host AND will echo arbitrary content."
  evidence: "EventApiController.java:44-56 (the SlackEventResponse record + the three response factories)"
  cardinality_per_call: 1
  reachable_from_entry_points: ["webhook:slack-events-api", "rest:url-verification-handshake", "unresolved — adversarial probing"]

## sources

- understanding <- EventApiController.java:18-57 + SlackEventParser.java:22-111 + DataCollaborationServiceImpl.java:64-69
- concepts.entities <- SlackEventParser.java:67, 87 (MessageEvent, MessageChangedEvent) + ParseResult.java:8-22 + MessageEventRequest.java:6-9
- concepts.invariants.route-exists-only-when-enabled <- ConditionalOnDataCollaboration.java:12 + DataCollaborationFeatureCondition.java:18-22
- concepts.invariants.thread-reply-messages-only <- SlackEventParser.java:69-74, 90-95
- dependencies_semantic.requires-config.receive-event-advisory-lock-id <- DataCollaborationProperties.java:11 + application.yml:201 + DataCollaborationMessageEventProcessor.java:147-149
- dependencies_semantic.live-docs-anchor <- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` 2026-05-25 status 200
- tests_coverage_semantic.gaps <- grep across `<odd-platform>/src/test` for `EventApiController|/api/slack/events|SlackEventParser` returns no matches
- docs_link_semantic.inferred_docs.[0] <- WebFetch 2026-05-25 status 200 (full content of the section captured in fetched_excerpts)
- docs_link_semantic.inferred_docs.[1] <- WebFetch 2026-05-25 status 404
- docs_link_semantic.doc_drift_findings.[0] <- WebFetch live docs + grep across `<odd-platform>` for `X-Slack-Signature|signing.?secret|HMAC.SHA256` returns no matches
- implicit_adrs.[0] <- EventApiController.java:38-40 + DataCollaborationServiceImpl.java:64-69 + DataCollaborationMessageEventProcessor.java:34-76
- implicit_adrs.[1] <- EventApiController.java:30-37 + SlackEventParser.java:38-43, 56-60, 107-110
- implicit_adrs.[2] <- SlackEventParser.java:65-74, 86-95 + SlackMessageProviderEventHandler.java:31-35
- bugs_limitations_corner_cases.[0] <- EventApiController.java:22-27 + SlackEventParser.java:22-23 + grep `<odd-platform>` for signature primitives (zero matches)
- bugs_limitations_corner_cases.[1] <- SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-23 + LoginFormSecurityConfiguration.java:49-51 + DisabledAuthSecurityConfiguration.java:13-17
- bugs_limitations_corner_cases.[2] <- ReactiveMessageRepositoryImpl.java:136-155 + V0_0_59__data_collaboration.sql:25-39 + DataCollaborationMessageEventProcessor.java:88-101 + ReactiveMessageRepositoryImpl.java:188-195
- bugs_limitations_corner_cases.[3] <- EventApiController.java:22-42 (no header reads)
- bugs_limitations_corner_cases.[5] <- SlackEventParser.java:22-23 (no try/catch on deserializeJson)
- security.auth_mode_relevance <- SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:49-51 + AuthorizationCustomizer.java:22-23 + DisabledAuthSecurityConfiguration.java:13-17 + OAuthSecurityConfiguration.java:98
- security.owner_scoping <- SlackMessageProviderEventHandler.java:31 (filter is thread_ts -> parent uuid; no owner check) + DataCollaborationMessageEventProcessor.java:88-127 (no owner check on materialisation)
- security.known_security_gaps.[0..3] <- see corresponding bugs_limitations_corner_cases sources
- performance.hot_paths <- EventApiController.java:26-42 + SlackMessageProviderEventHandler.java:25-43 + ReactiveMessageRepositoryImpl.java:136-155
- performance.scaling_characteristics <- DataCollaborationMessageEventProcessor.java:34-76, 147-149
- upstream_callers.[0,1] <- EventApiController.java:22-25 + WebFetch live docs 2026-05-25
- upstream_callers.[2] <- SecurityConstants.java:95-96 + EventApiController.java:22-27
- downstream_side_effects.[0] <- ReactiveMessageRepositoryImpl.java:136-155
- downstream_side_effects.[1] <- DataCollaborationMessageEventProcessor.java:88-145
- downstream_side_effects.[2] <- EventApiController.java:31, 35
- downstream_side_effects.[3] <- EventApiController.java:44-56
- stress_findings.probes_emitted <- `lineage/odd-platform/probes/P-140.yaml` + `P-138.yaml` + `P-139.yaml` (emitted by this enrichment pass; P-137 was already taken by an unrelated probe so the signature-verification probe shifted to P-140)

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
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: MEDIUM (3 of 17 questions resolve to PROBE-NEEDED; the load-bearing security claim — no signature verification — is STATIC-INFERRED HIGH from the absence-of-grep-matches + the missing header bindings, but the operator-visible consequence end-to-end is what the probes will verify)

## Maintainer notes
