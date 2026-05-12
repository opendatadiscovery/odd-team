---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.datacollaboration.config config-properties-class:DataCollaborationProperties"
node_kind: config-properties-class
axis: config_prefixes
extracted_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
enriched_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-04
---

# DataCollaborationProperties — semantic understanding

## understanding

`@ConfigurationProperties(prefix = "datacollaboration")` POJO that binds three
integer properties powering the Data Collaboration (Slack) feature's
background plumbing: two Postgres advisory-lock IDs (sender + event-receiver)
and the per-message retry budget. The class is the canonical type-safe home
for the lock IDs and retry count consumed by
`DataCollaborationMessageSenderJob` (sender lock + retry budget) and
`DataCollaborationMessageEventProcessor` (receive-event lock). It is a
**partial** home for the `datacollaboration.*` prefix: four sibling keys
(`enabled`, `slack-oauth-token`, `message-partition-period`) bypass this
class and are consumed via `@Value` in `FeatureResolverImpl`,
`DataCollaborationFeatureCondition`, `DataCollaborationConfiguration`, and
`MessageTablePartitionManager`. The only invariant the class enforces itself
is `sendingMessagesRetryCount >= 0`, asserted at bean construction via a
`@PostConstruct` validator that throws `IllegalStateException`.

## concepts

- entities: [DataCollaborationProperties, Postgres advisory lock, retry budget, message-sender thread, message-event-receiver thread]
- operations: [bind-`datacollaboration.*`-to-pojo, validate-retry-count-non-negative-at-postconstruct]
- invariants: [`sending-messages-retry-count >= 0` (DataCollaborationProperties.java:16-19, fail-fast at bean init), three int fields are bound from properties whose application.yml defaults are `110 / 120 / 3` (application.yml:201-204)]
- audiences: [internal — odd-platform operators tuning the Data Collaboration background-job plumbing; consumed by `DataCollaborationMessageSenderJob`, `DataCollaborationMessageEventProcessor`, and their `*Starter` classes via constructor injection (Lombok `@RequiredArgsConstructor`)]

## dependencies_semantic

- requires-feature:
  - `datacollaboration.enabled=true` — the `@EnableConfigurationProperties(DataCollaborationProperties.class)` declaration sits on `DataCollaborationConfiguration` which itself is `@ConditionalOnDataCollaboration` (DataCollaborationConfiguration.java:16-17 + DataCollaborationFeatureCondition.java:18-22). When the feature flag is false, this Properties bean is NOT registered; consumers (`DataCollaborationMessageSenderStarter`, `...EventProcessorStarter`) are also `@ConditionalOnDataCollaboration` so they share the same gate and never look the bean up.
- requires-config:
  - `datacollaboration.sender-message-advisory-lock-id` (DataCollaborationProperties.java:10) — default `120` (application.yml:202). Consumed by `DataCollaborationMessageSenderJob.acquireLeaderElectionConnection()` at line 94: `leaderElectionManager.acquire(dataCollaborationProperties.getSenderMessageAdvisoryLockId(), true)`.
  - `datacollaboration.receive-event-advisory-lock-id` (DataCollaborationProperties.java:11) — default `110` (application.yml:201). Consumed by `DataCollaborationMessageEventProcessor.acquireLeaderElectionConnection()` at line 148: `leaderElectionManager.acquire(dataCollaborationProperties.getReceiveEventAdvisoryLockId(), true)`.
  - `datacollaboration.sending-messages-retry-count` (DataCollaborationProperties.java:12) — default `3` (application.yml:204). Consumed by `DataCollaborationMessageSenderJob.shouldRetry()` at line 90: `trySendCount == null || trySendCount < dataCollaborationProperties.getSendingMessagesRetryCount()`. Validated `>= 0` in `@PostConstruct validate()` (lines 14-20).
- requires-runtime:
  - Spring Boot configuration-properties scanning (the class itself has no `@Component`; registration happens via `@EnableConfigurationProperties(DataCollaborationProperties.class)` on `DataCollaborationConfiguration` at line 17).
  - Lombok `@Data` to generate the setters that Spring relies on for relaxed-binding (kebab-case YAML → camelCase Java fields).
  - `jakarta.annotation.PostConstruct` to fire the validator after Spring binds the properties — runs once at bean init; never re-checks at runtime.

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - happy-path binding: kebab-case `datacollaboration.sender-message-advisory-lock-id: 120` resolves to `senderMessageAdvisoryLockId=120`.
  - `@PostConstruct` rejection: a `datacollaboration.sending-messages-retry-count: -1` value causes Spring context startup to fail with `IllegalStateException("datacollaboration.sending-messages-retry-count property cannot be below zero")`.
  - absence of bean when `datacollaboration.enabled=false`: the Properties bean is not registered (because `@EnableConfigurationProperties` sits on `@ConditionalOnDataCollaboration` config class).
  - boundary behaviour: `sending-messages-retry-count: 0` is accepted (`< 0` is the only rejection) — the sender loop's `shouldRetry()` returns `trySendCount == null || trySendCount < 0`, i.e. only the very first send attempt is permitted; any failure is immediately final. No test surfaces this corner case.
  - lock-id-collision detection: no behaviour validates that `senderMessageAdvisoryLockId != receiveEventAdvisoryLockId` and that neither collides with `partition.advisory-lock-id` (90, application.yml:198) or `notifications.wal.advisory-lock-id` (100, application.yml:177). A misconfiguration that sets two locks to the same int silently makes the corresponding background threads contend on the same Postgres advisory lock.
- test_files: []
- gaps: |
    Zero Java tests reference `DataCollaborationProperties` or any of its three
    fields (verified via Grep of `<odd-platform>/odd-platform-api/src/test`
    for `DataCollaborationProperties` / the three field names — no matches).
    A regression that (a) removed the `@PostConstruct` validator, (b)
    introduced an inadvertent default of `-1` somewhere, or (c) duplicated a
    lock-id across the four advisory-lock-using subsystems (notifications.wal,
    partition, data-collaboration sender + receiver) would not be caught by
    the existing suite. The lock-id-collision risk is the most operationally
    consequential gap — see `bugs_limitations_corner_cases.[2]` below.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration"
    anchor: ""
    rationale: "Canonical user-facing home for the Data Collaboration feature; references this Properties class's three keys (sender + receiver advisory-lock-ids, retry count) plus its sibling keys (enabled, slack-oauth-token, message-partition-period). Cross-links to the configuration guide for full setup."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetch (2026-05-12, 200) extracted:
      - "`datacollaboration.enabled` — Default is `false`. When disabled, all
        `/api/datacollaboration/...` routes and the `/api/slack/events`
        webhook return `404 Not Found`."
      - "`datacollaboration.slack-oauth-token` — Used for OAuth authentication
        with the Slack app that powers Data Collaboration."
      - "`datacollaboration.sending-messages-retry-count` — Default is `3`.
        Controls how many times each message is retried before being marked
        failed."
      - The page enumerates the lock-IDs (`sender-message-advisory-lock-id`,
        `receive-event-advisory-lock-id`) and `message-partition-period` as
        existing-but-with-no-detail-here, deferring to the configuration
        guide.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#enable-data-collaboration"
    rationale: "Configuration guide enumerates ALL `datacollaboration.*` keys with defaults; this is where the Properties class's three keys are formally documented as operator-tuneable knobs."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch (2026-05-12, 200) extracted:
      - "`datacollaboration.enabled`: Feature toggle (defaults to `false`)"
      - "`datacollaboration.slack-oauth-token`: OAuth token from Slack app's
        'OAuth & Permissions' section"
      - "`datacollaboration.receive-event-advisory-lock-id`: PostgreSQL
        advisory lock for translating messenger events to messages (defaults
        to `110`)"
      - "`datacollaboration.sender-message-advisory-lock-id`: PostgreSQL
        advisory lock for sending platform messages to messengers (defaults
        to `120`)"
      - "`datacollaboration.message-partition-period`: Time interval in
        **days** for message table partitioning (defaults to `30`)"
      - "`datacollaboration.sending-messages-retry-count`: Retry attempts
        when sending messages to providers; cannot be negative (defaults to
        `3`)"
      - "this Slack integration is **distinct from alert notifications**.
        Data collaboration uses a full OAuth-driven Slack app with
        bidirectional communication via Slack Events API, whereas alert
        notifications use only a one-way incoming webhook."
- doc_drift_findings:
  - "Live docs document `datacollaboration.message-partition-period` and `datacollaboration.slack-oauth-token` and `datacollaboration.enabled` as if all six properties form a single coherent surface, but the code splits them across four files: this Properties class (three int knobs), `DataCollaborationConfiguration.java:21` (`@Value` slack-oauth-token), `FeatureResolverImpl.java:17` + `DataCollaborationFeatureCondition.java:18-22` (`@Value` enabled), `MessageTablePartitionManager.java:19` (`@Value` message-partition-period). Reader of the docs has a unified mental model; reader of the code has to chase four files. Severity: LOW for operator (docs are accurate); MEDIUM for maintainer onboarding (config-prefix has no single class to point at)."
  - "Neither the feature page nor the configuration guide states the **lock-id-collision risk**: that the four `*.advisory-lock-id` defaults (90, 100, 110, 120) MUST stay disjoint and that custom deployments overriding any of them risk silent thread contention with another subsystem. Operators tuning these values have no documented guardrails. Severity: MEDIUM."
  - "Neither doc page states that `sending-messages-retry-count: 0` is accepted but means 'try once, no retry' (the `shouldRetry()` check is strict `<`, not `<=`). The docs imply '3 retries' is a typical knob but do not define the semantics of the minimum. Severity: LOW."

## implicit_adrs

- "`sending-messages-retry-count` is validated fail-fast at bean construction rather than at runtime first-use." — evidence: DataCollaborationProperties.java:14-20 — intent_anchor: `@PostConstruct public void validate() { if (sendingMessagesRetryCount < 0) { throw new IllegalStateException("datacollaboration.sending-messages-retry-count property cannot be below zero"); } }` — confidence: HIGH
- "Advisory-lock IDs are operator-tuneable integers carried as ConfigurationProperties (not constants), letting operators avoid collisions across the four advisory-lock subsystems (partition / notifications.wal / data-collaboration sender / data-collaboration receiver) without recompiling." — evidence: DataCollaborationProperties.java:10-11 + application.yml:198, 177, 201-202 — intent_anchor: the lock IDs are explicitly named `*AdvisoryLockId` and given non-overlapping defaults (90/100/110/120) in application.yml, signalling intentional disjoint allocation — confidence: HIGH
- "Postgres advisory locks (not Redis / Kafka / SQS) are the chosen single-leader election mechanism for both Data Collaboration background workers, preserving the Postgres-as-only-runtime-dependency posture." — evidence: DataCollaborationProperties.java:10-11 + DataCollaborationMessageSenderJob.java:94 + DataCollaborationMessageEventProcessor.java:148 (both call `leaderElectionManager.acquire(<lock-id>, true)`) — intent_anchor: the fact that *both* workers use the same `PostgreSQLLeaderElectionManager` and that the lock-IDs sit on this Properties class — confidence: HIGH

## bugs_limitations_corner_cases

- "`receiveEventAdvisoryLockId` and `senderMessageAdvisoryLockId` have NO `@PostConstruct` invariant. Setting both to the same int silently lets either thread block the other on the same advisory lock; the only signal is a Slack message stops flowing in one direction. The validator only covers retry-count." — evidence: DataCollaborationProperties.java:14-20 (validator body checks only retry count) — severity: MEDIUM
- "No upper-bound check on `sendingMessagesRetryCount`. A misconfiguration of `Integer.MAX_VALUE` would cause `DataCollaborationMessageSenderJob.shouldRetry()` to effectively never give up; combined with the fixed 1-second `Thread.sleep(1000)` between retries (DataCollaborationMessageSenderJob.java:60), a single poisoned message can block the single-leader sender thread indefinitely (one message blocking the whole deployment's Slack delivery). The validator catches `< 0` only." — evidence: DataCollaborationProperties.java:14-20 + DataCollaborationMessageSenderJob.java:60, 87-91 — severity: MEDIUM
- "Cross-subsystem lock-id collisions are operator-discoverable only after they manifest. The application.yml defaults (`partition: 90`, `notifications.wal: 100`, `datacollaboration.receive-event: 110`, `datacollaboration.sender-message: 120`) are non-overlapping; the code has zero startup assertion that they STAY non-overlapping. An operator who copies one default into another override silently produces a deployment where (say) the partition manager and the data-collaboration sender contend on lock-id 90." — evidence: DataCollaborationProperties.java:10-11 + application.yml:177, 198, 201-202 + no cross-config validation anywhere in the codebase (grep `<odd-platform>` for `advisoryLockId` collision checks: no hits) — severity: MEDIUM
- "Properties class is a **partial home** for the `datacollaboration.*` prefix. Three keys (`sender-message-advisory-lock-id`, `receive-event-advisory-lock-id`, `sending-messages-retry-count`) bind here; three keys (`enabled`, `slack-oauth-token`, `message-partition-period`) are read via `@Value` elsewhere. There is no single class representing the prefix; future additions are ambiguous about which file owns them, and a maintainer reading the Properties class would falsely conclude the prefix has only three keys." — evidence: DataCollaborationProperties.java:1-21 (three fields total) + DataCollaborationConfiguration.java:21 (`@Value("${datacollaboration.slack-oauth-token}")`) + FeatureResolverImpl.java:17 (`@Value(DATA_COLLABORATION_ENABLED_PROPERTY_SPEL)`) + MessageTablePartitionManager.java:19 (`@Value("${datacollaboration.message-partition-period:30}")`) — severity: LOW (code-organisation, not operator-facing)
- "`slack-oauth-token` is consumed via `@Value` in `DataCollaborationConfiguration` rather than as a `String` field on this Properties class, which means it bypasses the `@ConfigurationProperties` actuator sanitiser registry and relies on Spring's default `Sanitizer` (which DOES mask keys ending in `token` — so the present masking is correct, but the architectural choice means a future rename to e.g. `slack-bot-credential` would break the default mask)." — evidence: DataCollaborationConfiguration.java:20-21 + this Properties class declaring only int fields (no Slack credential field) — severity: LOW
- "No `@Validated` annotation on the class, no `@Min(0)` / `@Max(...)` JSR-303 constraints on the int fields. The single `@PostConstruct` validator is hand-written; future fields added without an explicit `if (... < 0) throw` would silently bypass validation." — evidence: DataCollaborationProperties.java:7-21 — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a Spring `@ConfigurationProperties` POJO, not on the HTTP surface. The Data Collaboration feature's HTTP endpoints are protected by the catch-all `AuthorizationCustomizer.pathMatchers('/**').authenticated()` (see batch A's `postMessageInSlack` sidecar). This Properties class affects all auth modes equally — it is bean-registration-gated on `datacollaboration.enabled` rather than on the auth mode.
- **ingestion_filter_relevance**: `N/A — not HTTP`. Pure config-binding class.
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped`.
- **data_exposure**:
  - "Three int values (sender lock-id, receiver lock-id, retry count) exposed via `/actuator/env` to any caller able to reach the actuator port. Default Spring sanitiser does NOT mask int fields named `*advisory-lock-id` or `*retry-count` — these are not credential-shaped so the masking absence is correct; the exposure is low-sensitivity (knowing the deployment's lock IDs aids cross-subsystem collision attacks only if a hostile operator already has actuator access, in which case bigger problems exist)." — evidence: DataCollaborationProperties.java:10-12 + Spring Boot default Sanitizer keys (`password`, `secret`, `key`, `token`).
- **known_security_gaps**:
  - "Properties class does NOT carry the `slack-oauth-token` field — that field is consumed via `@Value` in `DataCollaborationConfiguration.java:21`. If a future refactor moves the OAuth token onto this class, the actuator-env masking depends on the field name still matching Spring's default sanitiser pattern (`token`). Moving it to e.g. `slackBotCredential` would silently un-mask it." — evidence: DataCollaborationConfiguration.java:20-21 + Spring's `Sanitizer` default keys — severity: LOW (preventive — describes a refactor risk, not a current vulnerability)
  - "No validation against lock-id collisions with other subsystems. An operator who sets `datacollaboration.sender-message-advisory-lock-id: 100` overlaps notifications.wal.advisory-lock-id (default 100) and creates a silent denial-of-service across two unrelated features. There is no startup assertion and no doc-page warning (see `docs_link_semantic.doc_drift_findings`)." — evidence: DataCollaborationProperties.java:10 + application.yml:177, 198, 201-202 — severity: MEDIUM (operational availability, not confidentiality / integrity)

## performance

- **hot_paths**:
  - "`getSenderMessageAdvisoryLockId()` is called once per sender-thread startup attempt (DataCollaborationMessageSenderJob.java:94), inside `acquireLeaderElectionConnection()` which itself runs in a retry loop on disconnect. Not a per-request hot path — once-per-leader-election."
  - "`getReceiveEventAdvisoryLockId()` is called once per receiver-thread startup attempt (DataCollaborationMessageEventProcessor.java:148). Same shape — once-per-leader-election."
  - "`getSendingMessagesRetryCount()` is called inside `shouldRetry()` (DataCollaborationMessageSenderJob.java:90) which runs once per failed Slack `chat.postMessage` attempt. Bounded by retry budget × queue depth × 1-second-sleep; never a per-request hot path on the controller side (controller returns 202 immediately)."
- **throughput_characteristics**:
  - "Singleton Spring bean; getters are Lombok-generated, no synchronisation, no caching needed. The properties are read-once-at-bean-init and never reloaded — Spring's standard `@ConfigurationProperties` semantics."
- **resource_allocation**:
  - "Allocates a single POJO instance per Spring context; three `int` fields, no nested objects. Memory impact is negligible (<100 bytes including object header)."
- **scaling_characteristics**:
  - "Lock-ID values directly shape the deployment's single-leader topology: each `*AdvisoryLockId` represents one global lock partition across all `odd-platform` replicas. Horizontal scaling does NOT scale the corresponding worker — only the node holding the lock processes. Two separate Properties (sender + receiver) means TWO single-leader threads at most per deployment (one for sending platform → Slack, one for receiving Slack → platform). Operators expecting receiver-thread parallelism for high-event-volume workspaces will hit this ceiling without warning." — evidence: DataCollaborationProperties.java:10-11 + DataCollaborationMessageSenderJob.java:94 + DataCollaborationMessageEventProcessor.java:148.
- **known_performance_gaps**:
  - "The receive-event-side ceiling (one global thread for ALL inbound Slack events across the deployment) is undocumented as a scaling constraint. A workspace with high event throughput (busy Slack channels mentioning data entities frequently) will queue up events behind a single thread that consumes events at the speed of one Postgres advisory-lock connection × one HTTP fetch per event from Slack's Events API." — evidence: DataCollaborationProperties.java:11 + DataCollaborationMessageEventProcessor.java:148 — severity: LOW (Discussions is a low-volume feature in practice; surface for capacity planning)

## sources

- understanding ← DataCollaborationProperties.java:1-21 + DataCollaborationConfiguration.java:14-30 + DataCollaborationMessageSenderJob.java:90, 94 + DataCollaborationMessageEventProcessor.java:148 + MessageTablePartitionManager.java:19 + FeatureResolverImpl.java:17 + DataCollaborationFeatureCondition.java:18-22
- concepts.entities ← DataCollaborationProperties.java:9-13
- concepts.operations ← DataCollaborationProperties.java:14-20 (validate) + Spring `@ConfigurationProperties` binding semantics
- concepts.invariants ← DataCollaborationProperties.java:16-19 (`< 0` check) + application.yml:201-204 (defaults)
- dependencies_semantic.requires-feature ← DataCollaborationConfiguration.java:16-17 + DataCollaborationFeatureCondition.java:18-22 + DataCollaborationMessageSenderStarter.java:16-17 + DataCollaborationMessageEventProcessorStarter.java:16-17
- dependencies_semantic.requires-config.sender-message-advisory-lock-id ← DataCollaborationProperties.java:10 + application.yml:202 + DataCollaborationMessageSenderJob.java:94
- dependencies_semantic.requires-config.receive-event-advisory-lock-id ← DataCollaborationProperties.java:11 + application.yml:201 + DataCollaborationMessageEventProcessor.java:148
- dependencies_semantic.requires-config.sending-messages-retry-count ← DataCollaborationProperties.java:12, 14-20 + application.yml:204 + DataCollaborationMessageSenderJob.java:90
- dependencies_semantic.requires-runtime ← DataCollaborationConfiguration.java:17 (`@EnableConfigurationProperties`) + DataCollaborationProperties.java:3, 14 (`@PostConstruct`) + DataCollaborationProperties.java:4, 8 (`@Data`)
- tests_coverage_semantic.test_files ← (no test files reference DataCollaborationProperties or the three field names — verified via Grep across `<odd-platform>/odd-platform-api/src/test`)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration (2026-05-12, status 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (2026-05-12, status 200) — Enable Data Collaboration section
- implicit_adrs.[0] (fail-fast retry validation) ← DataCollaborationProperties.java:14-20
- implicit_adrs.[1] (lock-id-as-property) ← DataCollaborationProperties.java:10-11 + application.yml:177, 198, 201-202
- implicit_adrs.[2] (Postgres advisory locks as election mechanism) ← DataCollaborationProperties.java:10-11 + DataCollaborationMessageSenderJob.java:94 + DataCollaborationMessageEventProcessor.java:148
- bugs_limitations_corner_cases.[0] (lock-ids unvalidated for equality) ← DataCollaborationProperties.java:14-20
- bugs_limitations_corner_cases.[1] (no upper bound on retry) ← DataCollaborationProperties.java:14-20 + DataCollaborationMessageSenderJob.java:60, 87-91
- bugs_limitations_corner_cases.[2] (cross-subsystem lock-id collisions undetected) ← DataCollaborationProperties.java:10-11 + application.yml:177, 198, 201-202
- bugs_limitations_corner_cases.[3] (partial home for the prefix) ← DataCollaborationProperties.java:1-21 + DataCollaborationConfiguration.java:20-21 + FeatureResolverImpl.java:17 + MessageTablePartitionManager.java:19
- bugs_limitations_corner_cases.[4] (slack-oauth-token consumed via @Value bypasses the class) ← DataCollaborationConfiguration.java:20-21
- bugs_limitations_corner_cases.[5] (no @Validated / JSR-303 constraints) ← DataCollaborationProperties.java:7-21
- security.auth_mode_relevance ← DataCollaborationProperties.java:1-21 (no HTTP coupling) + sibling `postMessageInSlack` sidecar's auth-mode evidence
- security.ingestion_filter_relevance ← DataCollaborationProperties.java:1-21 (not HTTP)
- security.owner_scoping ← DataCollaborationProperties.java:1-21 (no data-scoping)
- security.data_exposure ← DataCollaborationProperties.java:10-12 + Spring Boot Sanitizer default behaviour
- security.known_security_gaps.[0] (token field elsewhere, default sanitiser dependence) ← DataCollaborationConfiguration.java:20-21
- security.known_security_gaps.[1] (no lock-id-collision validation) ← DataCollaborationProperties.java:10 + application.yml:177, 198, 201-202
- performance.hot_paths ← DataCollaborationMessageSenderJob.java:90, 94 + DataCollaborationMessageEventProcessor.java:148
- performance.throughput_characteristics ← DataCollaborationProperties.java:7-21 + Lombok `@Data` semantics
- performance.resource_allocation ← DataCollaborationProperties.java:9-13
- performance.scaling_characteristics ← DataCollaborationProperties.java:10-11 + DataCollaborationMessageSenderJob.java:94 + DataCollaborationMessageEventProcessor.java:148
- performance.known_performance_gaps ← DataCollaborationProperties.java:11 + DataCollaborationMessageEventProcessor.java:148

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

## Maintainer notes
