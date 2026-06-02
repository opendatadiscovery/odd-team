# odd-platform — MISSING-TEST PLAN (ontology-anchored)

_Step 1 of the testing-framework pipeline (**define** → implement → run). Generated 2026-06-02 by reading the live ontology; read-only. Reviewer: the maintainer batches this into `/implement`._

## Purpose

The prioritized, batched backlog of unit + integration tests to author so that feature/bug work on odd-platform lands on **measurable regression coverage**. Every entry is anchored to a real ontology id (ADR / F-NNN+H-NNN / PLT-NNN / TEST-GAP-NNN). Nothing here is invented; where a target is unclear it is marked `⚠ TARGET UNCLEAR`.

The ontology already says coverage is thin where it matters most:
- **ADR enforcement** — 2/27 ADRs have an enforcing test (ADR-0058 via 3 gate-mapped tests; ADR-0012 treated covered by the pipeline owner — see note). ~25 load-bearing decisions are **unguarded**.
- **Regression** — 41/1355 findings/scopes carry a regress/guard test; the LSN-001/002 landmines are captured as 24 gated TestGaps but **no regression test is authored yet** (`alignment-scorecard.md` D, top-action #1).
- **Functionality** — 28/112 features have a validating test/gate (`test-gates.yaml` `validates:`); the rest are unchecked.
- **Contradictions** — 176 intent↔impl contradictions across 23 reflected features; the HIGH ones are the bug-pins below.

## Sources read
- `lineage/odd-platform/test-gates.yaml` — 66 existing tests + what they cover (the dedup baseline; never duplicate these).
- `lineage/odd-platform/alignment-scorecard.md` — the Ledger (Dimensions A–D, top actions).
- 27 ADRs — `../documentation/docs/developer-guides/architecture-decision-log/ADR-*.md` (decision) + `backlog/adr/ADR-*.md` (`realises:` code loci).
- `lineage/odd-platform/feature-reflections/detail/F-*.yaml` (23) — 133 bug_candidates; HIGH + `dedup_status` + `tracked_as`/`filed_as`.
- `lineage/odd-platform/test-map/detail/TEST-GAP-*.yaml` (1038) — 168 CRITICAL, 349 HIGH, 389 MEDIUM, 131 LOW.
- `lineage/odd-platform/feature-flows/detail/F-*.yaml` (112) — feature names + the validation universe.
- `issues/odd-platform/PLT-*.md` — filed bug drafts (incl. the landmine batch PLT-119…138, + PLT-016/020/062/086/110).

## Classification rule (test_type — applied honestly per entry)

| type | runner / home | criterion | gate convention |
|---|---|---|---|
| **unit** | JUnit + gradle → **CI/CD** | assertable against code / config / logic **without a running system** (mappers, validators, condition classes, jOOQ-predicate logic at the SQL-string level, `@ConfigurationProperties` binding, bean-presence via `ApplicationContextRunner`, pure functions). | `@enforces ADR-NNNN` / `@validates F-NNN` / `@regresses <id>` declared **in-source**. |
| **integration** | docker-compose stack → **LOCAL-only** suite | needs a running stack / multi-service / real Postgres / ingestion round-trip / notification delivery / cross-owner authz / UI e2e / WAL / advisory-lock failover. Each later wrapped in a documented probe protocol with a logged result. | same gate annotations; tagged so CI **excludes** them. Here: CLASSIFY + sketch what it exercises + the stack it needs. **No probe files authored in this step.** |

Spring-context tests (`@WebFluxTest`, `ApplicationContextRunner`, `@SpringBootTest(webEnvironment=NONE)`) that assert **bean topology / filter-chain presence / security-rule wiring** without DB or network are classified **unit→CI** (they boot a sliced context, not a stack). A `@SpringBootTest` that needs Testcontainers-Postgres is **integration**.

## How to use
1. Review priorities; the rows are stable-column + greppable (ids in fixed positions).
2. Feed **Implementation batches** (last section) into `/implement` — one themed batch at a time. Unit batches ship to CI; integration batches go to the local protocol suite (probe-define / probe-run later).
3. P0 + P1 are comprehensive (every unenforced ADR; every HIGH finding). P2/P3 lead with CRITICAL/HIGH and summarize the long tail with counts + a pointer to `test-map/`.

> **Dedup note.** Every ADR / feature already carrying a gate in `test-gates.yaml` is **excluded** from "missing" below and cross-referenced instead. The 24 landmine TestGaps are captured but **unwritten** — they appear here as the P1/P2 pins to author.

---

## P0 — ADR enforcement (load-bearing decisions with no enforcing test)

One row per ADR with **no** enforcing test. ADR-0058 (covered: `EnumValueServiceTest`, `EnumValueRepositoryImplTest`, `NamespaceRepositoryImplTest` carry `enforces: ADR-0058`) and **ADR-0012** (the pipeline owner treats it as covered; **NOTE: `test-gates.yaml` shows 0 `enforces: ADR-0012` — a dedicated `@enforces ADR-0012` bean-selection test is in fact still MISSING; see P2 row TEST-GAP-024/047/730**) are skipped here per instruction. The invariant column is the falsifiable claim a test must pin.

| ADR — title | invariant to assert | test_type | gate | source (realises / TEST-GAP) |
|---|---|---|---|---|
| **ADR-0001** OpenAPI-generated controller interfaces | Every `@RestController` `implements` a generated `*Api` and declares **no** class-level `@RequestMapping` / method-level `@*Mapping`; the only two exceptions are `AlertManagerController` + `EventApiController`. | unit | `@enforces ADR-0001` | reflection-test (classpath scan of `controller.*`); realises `AlertController.java:11-17` |
| **ADR-0002** Centralised path-matcher authorization | No `@PreAuthorize`/`@Secured`/programmatic check on any controller/`*Api`; `SECURITY_RULES` + final `pathMatchers("/**").authenticated()` is the only authz wiring. | unit | `@enforces ADR-0002` | annotation-absence scan + `AuthorizationCustomizer` bean test; realises `SecurityConstants.java:98-355`, `AuthorizationCustomizer.java:20-31` |
| **ADR-0003** Read-collaborative authorization | Every `SECURITY_RULES` row guards a mutation (POST/PUT/DELETE/PATCH) with the **single** GET exception `/api/owner_association_request`→`OWNER_ASSOCIATION_MANAGE`; no catalog read appears in the table. | unit | `@enforces ADR-0003` | table-introspection unit test over `SECURITY_RULES`; realises `SecurityConstants.java:98-355` · also TEST-GAP-018/081/083 (read-openness) |
| **ADR-0004** GenAI disabled-by-default + inert defaults | `genai.enabled` ships `false`; `GenAIServiceImpl` runtime-guards every call (`BadUserRequestException` "Gen AI is disabled"); `GenAIProperties` defaults `url=null`, `requestTimeout=0`. | unit | `@enforces ADR-0004` | service-guard unit test + properties-default test; realises `application.yml:18`, `GenAIServiceImpl.java:37-38`, `GenAIProperties.java` · F-039 H-002 |
| **ADR-0007** Uniform `Mono<ResponseEntity<T>>` pipeline | One `@RestControllerAdvice` (`ControllerAdvice`) maps the exception hierarchy to status (`BadUserRequest`→400, `NotFound`→404, `UniqueConstraint`/`CascadeDelete`→400, `WebExchangeBind`→400, `GenAI`→500, `Exception`→500); no per-controller `@ExceptionHandler`. | unit | `@enforces ADR-0007` | `@WebFluxTest` on `ControllerAdvice` exercising each mapping + scan for stray `@ExceptionHandler`; realises `ControllerAdvice.java` |
| **ADR-0008** OpenAPI tag-per-resource scoping | Every operation in `openapi.yaml` carries exactly **one** tag; zero untagged / multi-tagged operations (generator `useTags: true`). | unit | `@enforces ADR-0008` | spec-lint unit test parsing `openapi.yaml`; realises `odd-platform-specification/openapi.yaml` · F-029 family |
| **ADR-0018** Fail-fast outbound config at boot | Each opted-in integration bean throws `IllegalArgumentException` on an empty required value at construction (blank Slack token / webhook URL / mail sender·host·protocol / empty recipients / negative depth); absence-of-key = bean simply not built (no throw). | unit | `@enforces ADR-0018` | `ApplicationContextRunner` per bean factory (empty→fail, absent→off, valid→up); realises `NotificationConfiguration.java:40,44,48,82,95,111,128`, `DataCollaborationConfiguration.java:23-24` · TEST-GAP-201 |
| **ADR-0019** Data Collaboration disabled-by-default | `datacollaboration.enabled` ships `false`; with it unset/false the `@ConditionalOnDataCollaboration` controller bean is absent → every `/api/datacollaboration/**` route returns **404** (not 403, not a disabled body). | integration | `@enforces ADR-0019` | needs running stack to assert 404 routing; realises `application.yml:205`, `DataCollaborationController.java:21-22`, `DataCollaborationFeatureCondition.java:18-22` |
| **ADR-0020** Decoupled outbound Slack delivery | `postMessageInSlack` persists + returns **202 Accepted** (no inline Slack call); `DataCollaborationMessageSenderJob` acquires the blocking advisory lock (id `120`) before draining; retries ≤ `sending-messages-retry-count` (3) then marks failed. | integration | `@enforces ADR-0020` | stack + Postgres advisory lock + drain loop; realises `DataCollaborationController.java:34-39`, `DataCollaborationMessageSenderJob.java:36-67,89-95`, `application.yml:202,204` |
| **ADR-0021** Activity-stream cursor pagination | `getActivity` + `getDataEntityActivityList` page by `(lastEventId, lastEventDateTime)` cursor, **not** offset/limit; alerts + data-entity list stay offset/limit. | unit | `@enforces ADR-0021` | service-signature + repository-predicate unit test; realises `ActivityController.java:34-35`, `ActivityServiceImpl.java:96-97,119-127` |
| **ADR-0022** Activity view-modes = single enum param | `getActivity` dispatches a single `ActivityType` enum (`ALL`/`MY_OBJECTS`/`DOWNSTREAM`/`UPSTREAM`); null `type` ≡ `ALL`; no separate per-mode endpoints. | unit | `@enforces ADR-0022` | service dispatch unit test (each enum arm → correct fetch); realises `ActivityController.java:32`, `ActivityServiceImpl.java:103-117` |
| **ADR-0028** Range-partition lifecycle (boot + nightly) | Boot `@PostConstruct` uses advisory lock (id `90`); nightly `@Scheduled(cron 0 1 0 * * *)` uses ShedLock (`partitionCreationJob`); double-width/single-cadence coverage; **create-only, never drop**; continue-on-failure per table. | integration | `@enforces ADR-0028` | stack + clock/two-replica contention; realises `PostgreSQLPartitionCreationJob.java:40-41` · TEST-GAP-123 (drop race is the inverse pin) |
| **ADR-0040** Notifications disabled-by-default | `notifications.enabled` ships `false`; one `NotificationsFeatureCondition` (default false) via `@ConditionalOnNotifications` gates all three components → unset = no subscriber/senders/processor, no WAL slot. | unit | `@enforces ADR-0040` | `ApplicationContextRunner` asserting the 3 beans absent when unset; realises `application.yml:173`, `NotificationsFeatureCondition.java:11-13`, applied at `NotificationConfiguration.java:27`,`NotificationSubscriberStarter.java:17`,`AlertNotificationMessageProcessor.java:15` |
| **ADR-0041** Notification per-channel presence-activation | Each sender bean is `@ConditionalOnProperty` on its **own** key (`…slack.url` / `…webhook.url` / `…email.sender`); key present→bean up, absent→silently off; no separate `*.enabled` flag. | unit | `@enforces ADR-0041` | `ApplicationContextRunner` toggling each key independently; realises `NotificationConfiguration.java:37,75,89,102`, `application.yml:180-186` |
| **ADR-0042** Notification fail-soft fan-out | `AlertNotificationMessageProcessor.process` catches `NotificationSenderException` per sender, logs `receiverId()`, continues; no rethrow → next sender + next WAL message proceed. | unit | `@enforces ADR-0042` | unit test with a throwing sender mock asserting siblings still invoked; realises `AlertNotificationMessageProcessor.java:26-35` · **GAP**: F-009 H-002 shows `EmailNotificationSender` throws raw `RuntimeException` that ESCAPES this catch → test must pin the **intended** invariant and will fail until PLT-016 fix |
| **ADR-0043** Notification WAL single-leader | Subscriber runs on one named thread (`notification-subscriber-thread`); first action is **blocking** `acquire(advisoryLockId=100, true)`; non-leaders block + never read WAL; ordered single-thread consume; failover on lock release. | integration | `@enforces ADR-0043` | two-replica stack + advisory-lock failover; realises `NotificationSubscriberStarter.java:21-23`, `NotificationSubscriber.java:47`, `application.yml:177` · TEST-GAP-796 (silent thread-death is the inverse pin) |
| **ADR-0044** Postgres artefact lazy-create, no-drop | Elected consumer creates replication slot + publication only if absent (`SELECT EXISTS …` then create); **no DROP path anywhere** in `notification/`; boot idempotent. | integration | `@enforces ADR-0044` | stack + WAL; assert exists-check no-op on restart + grep-level absence pinned as unit complement; realises `NotificationSubscriber.java:104-126,128-158` |
| **ADR-0045** Housekeeping ⟂ partition separation | Housekeeping (`@Scheduled fixedRate 15m`, ShedLock `housekeepingJob`) and partition creation (nightly cron, ShedLock `partitionCreationJob`) are distinct packages/schedules/locks; the one bridge `EmptyPartitionsHousekeepingJob` lives in housekeeping but delegates to `PartitionService.getEmptyPastPartitions`+`dropPartition`. | unit | `@enforces ADR-0045` | structural unit test (distinct lock names + the delegation shape); realises `EmptyPartitionsHousekeepingJob.java:13-26`, `HousekeepingJobManager.java:17-26`, `PostgreSQLPartitionCreationJob.java:40-41` |
| **ADR-0046** Housekeeping opt-out (enabled-by-default) | `housekeeping.enabled` ships `true`; `HousekeepingJobManager` is `@ConditionalOnProperty(havingValue="true")` with **no** `matchIfMissing` → shipped-`true` produces opt-out, absent-key produces off (the integration-test profile relies on `false`). | unit | `@enforces ADR-0046` | `ApplicationContextRunner` (true→up, false→off, absent→off); realises `application.yml:165-166`, `HousekeepingJobManager.java:17-18`, `application-integration-test.yml:8-9` · TEST-GAP-209/211 (TTL data-loss inverse pins) |
| **ADR-0070** Pull/push one wire contract | `IngestionController implements IngestionApi`; single `postDataEntityList` entry delegates to `ingestionService.ingest(...)` with **no branch on producer type**; platform depends on `ingestion-contract-server`, not a private schema. | integration | `@enforces ADR-0070` | ingestion round-trip (same payload pulled vs pushed → identical result); realises `IngestionController.java:31,38-45`, `libs.versions.toml:6,65`, `IngestionServiceImpl.java:86,93-98` |
| **ADR-0071** Postgres-only runtime dependency | The dependency set carries the Postgres stack + ShedLock-JDBC and **no** client for Kafka/AMQP/ZooKeeper/Consul/etcd/Hazelcast/NATS/Pulsar/ActiveMQ/Elasticsearch; Redis present only as opt-in session store. | unit | `@enforces ADR-0071` | build-file / classpath assertion test (forbidden-coordinate scan of `libs.versions.toml`); realises `gradle/libs.versions.toml`, `odd-platform-api/build.gradle` |
| **ADR-0072** Contract-first reactive stack | No servlet (`spring-boot-starter-web`) on the classpath; every controller returns `Mono`/`Flux`; multi-step writes carry `@ReactiveTransactional`; backend + UI generate from the **same** `openapi.yaml`. | unit | `@enforces ADR-0072` | classpath-absence + reactive-return-type reflection scan + `@ReactiveTransactional` presence; realises `libs.versions.toml:45,72,120`, `DataEntityServiceImpl.java:197`, `odd-platform-api-contract/build.gradle:9-13,44` |
| **ADR-0073** ODDRN universal identity | `data_entity.oddrn` is `UNIQUE` (+ unique index); ingestion keys by ODDRN and partitions into create/update via `listByOddrns`; lineage PK is `(parent_oddrn,child_oddrn)`; unparseable ODDRN prefix → `other` bucket (fails quiet, not loud). | integration | `@enforces ADR-0073` | DB-backed idempotency round-trip (re-ingest same ODDRN → update-in-place, no dup row); realises `V0_0_1__init.sql:66-71,246-247`, `IngestionServiceImpl.java:86,93-98`, `DirectoryServiceImpl.java:101-110` |
| **ADR-0074** Pluggable auth modes (default DISABLED) | `auth.type` selects exactly one mutually-exclusive `SecurityWebFilterChain` (DISABLED/LOGIN_FORM/OAUTH2/LDAP via `@ConditionalOnProperty`); ships **DISABLED** (`anyExchange().permitAll()`, ADR-0002 rules NOT wired); S2S is additive; CSRF off in every mode; LOGIN_FORM grants every credential `ADMIN`. | integration | `@enforces ADR-0074` | per-mode bean-graph + behaviour (DISABLED→open, others→authenticated); realises `DisabledAuthSecurityConfiguration.java:10-18` + 3 sibling configs · **TEST-GAP-133/139/778 are exactly these pins** |
| **ADR-0075** Feature-gating posture | Off-by-default family ships `enabled: false` (GenAI / DataCollab / Notifications); hygiene (Housekeeping) ships `enabled: true` — the deliberate inversion. | unit | `@enforces ADR-0075` | one defaults-assertion unit test reading `application.yml` (`:17-18,200-205,172-173` false; `:165-166` true); realises same · composes ADR-0004/0019/0040/0046 |

**P0 count: 25 ADRs.** Split: **unit** = ADR-0001, 0002, 0003, 0004, 0007, 0008, 0018, 0021, 0022, 0040, 0041, 0042, 0045, 0046, 0071, 0072, 0075 (17). **integration** = ADR-0019, 0020, 0028, 0043, 0044, 0070, 0073, 0074 (8).

---

## P1 — HIGH-finding regression pins

One row per HIGH reflection finding (`severity: HIGH`). **Prioritized**: filed PLTs (a fix is queued; the pin guards it) and `net_new` (no tracker yet) come first within each feature. `dedup_status: already_tracked` rows still need a pin — the bug is filed but **no regression test exists**. Where the fix is queued, the gate is `@regresses PLT-NNN`; where the finding validates intended behaviour the gate is `@validates F-NNN`.

> Most are **integration** because the contradiction is cross-tier (UI→DB, authz at the HTTP boundary, WAL, cross-owner). Pure-logic pins (mapper bug, jOOQ predicate precedence, casing checks, properties defaults) are **unit**.

### F-001 Popular Entities Ranking
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-001 H-002 (PLT-104) | Opening a detail page once = **+2** views (LSN-017 dep-array doubling) skews ranking 2×. Pin: page-open registers delta **=1**. | integration | `@regresses PLT-104` | `DataEntityDetails.tsx:63` · TEST-GAP-836 (UI anchor), TEST-GAP-310 (EXCLUDE_FROM_SEARCH) |
| F-001 H-003 (PLT-104) | `view_count` is a single forgeable signal — no idempotency/rate-limit/auth. Pin: per-(session,entity) debounce on `incrementViewCount`. | integration | `@regresses PLT-104` | `ReactiveDataEntityRepositoryImpl.java:173-180,633` |

### F-005 Lineage Graph Traversal
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-005 H-001 (PLT-100) | Unset `lineage_depth` → NPE→HTTP 500 for a direct API caller (doc claims a default). Pin: missing depth → 400/applied-default, not 500. | integration | `@regresses PLT-100` | F-005 chain |
| F-005 H-002 (PLT-100) | Lineage returns full **cross-owner** subgraph to any authenticated user (anon under DISABLED). Pin: owner-scope / authz on the canvas read. | integration | `@regresses PLT-100` | F-005 · TEST-GAP-081 |
| F-005 H-003 (PLT-042) | No depth upper-bound at any of 5 layers; `?d=10000` → unbounded recursive CTE (DoS). Pin: depth clamp rejected/bounded. | integration | `@regresses PLT-042` | F-005 |
| F-005 H-009 (PLT-042) | Recursive CTE has **no cycle guard**; cyclic graph + large depth = CPU spike. Pin: cyclic fixture terminates bounded. | integration | `@regresses PLT-042` | F-005 (probe-needed) |
| F-005 H-012 (PLT-028) | `GET /datasets/{id}/structure/{versionId}` ignores the dataset id → returns any dataset's structure by version id (cross-entity read). Pin: id+versionId must match. | integration | `@regresses PLT-028` | F-005 |

### F-006 Role-Based Access Control  _(findings logged BUG-NNN/SEC-NNN — not yet filed; treat as net_new)_
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-006 H-001 | RBAC mutations emit **nothing** to any audit surface (schema-rooted `activity.data_entity_id NOT NULL` + no POLICY/ROLE activity enum). Pin: policy/role change emits an audit event. | integration | `@regresses PLT-062` | F-006 (PLT-062 is the coordinated audit migration) |
| F-006 H-002 | A soft-deleted policy still grants via the unfiltered `getRolesPolicies` JOIN (list says "gone", enforcement says "live"). Pin: soft-deleted policy grants nothing. | integration | `@regresses PLT-110` | F-006 · PLT-110 |
| F-006 H-009 | Administrator-name reserved on update/delete but **not** on create (Policy & Role); soft-deleted seeded row frees the name. Pin: create rejects reserved/admin name. | unit | `@validates F-006` | F-006 |
| F-006 H-013 | Policies authored against 75 raw permission codes, no catalogue; `SecurityConstants` wiring mis-routed for DATASET_FIELD tags (REFACTOR-217). Pin: every code maps to a wired rule. | unit | `@regresses PLT-064` | F-006 · TEST-GAP-017 |

### F-007 AlertManager Integration
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-007 H-006 (**net_new**, filed **PLT-121**) | Global "All" tab hard-filters `STATUS=OPEN` — resolved alerts invisible on every global tab. Pin: "All" returns resolved+open. | integration | `@regresses PLT-121` | F-007 · PLT-121 |
| F-007 H-002 (PLT-014) | Unauthenticated webhook + verbatim `entity_oddrn` (no existence/ownership check) → any caller forges OPEN alerts on any entity. Pin: forged-oddrn alert rejected/scoped. | integration | `@regresses PLT-014` | F-007 · TEST-GAP-014/015 |
| F-007 H-004 (PLT-014) | `generatorURL` accepted with no scheme allow-list (`javascript:` not blocked) embedded verbatim. Pin: non-http(s) scheme rejected. | unit | `@regresses PLT-014` | F-007 |

### F-008 Batch Ingestion (S2S API)
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-008 H-002 (PLT-003) | `auth.ingestion.filter.enabled` covers **one** endpoint while its name promises a global ingestion lock; 3 of 5 `/ingestion/*` unprotected. Pin: each `/ingestion/*` honours the flag. | integration | `@regresses PLT-003` | F-008 · TEST-GAP-097 |

### F-009 WAL-driven Notification Delivery  _(all logged BUG-NNN; the WAL/poison + email-abort ones are captured in PLT-016)_
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-009 H-007 (PLT-016) | One malformed alert row **poison-stalls all alerting cluster-wide** (10s replay loop) + grows WAL to disk-exhaustion; no DLQ/skip. Pin: poison row skipped-and-advanced. | integration | `@regresses PLT-016` | `NotificationSubscriber.java:80-84` · TEST-GAP-455 (pin) / TEST-GAP-795 (disk-exhaustion) |
| F-009 H-008 (PLT-016) | Single-thread WAL subscriber can die silently (`InterruptedException` exits `run()`); no death detection → alerting stops, zero telemetry. Pin: subscriber death detected/resubmitted. | integration | `@regresses PLT-016` | `NotificationSubscriberStarter.java:33-35` · **TEST-GAP-796 (CRITICAL)** |
| F-009 H-002 (PLT-016) | Email failure wrapped as raw `RuntimeException` **bypasses** the per-sender catch → aborts fan-out to all later channels; order undefined. Pin: email outage does not stop Slack/webhook. | unit | `@regresses PLT-016` | `EmailNotificationSender.java:58-60`, `AlertNotificationMessageProcessor.java:31` (this is the ADR-0042 escape) |
| F-009 H-011 (PLT-016) | Alert-chunk descriptions render into Slack mrkdwn **unescaped** → `@channel`/`<!here>` injection + phishing links. Pin: mrkdwn-escape applied. | unit | `@regresses PLT-016` | `SlackMessageGenerator.java:77` |
| F-009 H-004 (PLT-016) | Generic webhook is **unsigned** — no HMAC/secret/Authorization, no knob. Pin: optional secret → X-ODD-Signature present + verified. | integration | `@regresses PLT-016` | `WebhookNotificationSender.java:20-22` |
| F-009 H-006 | Alert bursts 1:1, Slack 429 + Retry-After ignored → burst alerts silently dropped. Pin: 429 honoured / bursts coalesced. | integration | `@regresses PLT-016` | `AbstractNotificationSender.java:24-29` (cross-link REFACTOR-129) |
| F-009 H-009 | Email protocol check is case-sensitive `"smtp"`; uppercase `SMTP` silently disables STARTTLS+AUTH (plaintext creds). Pin: `equalsIgnoreCase`. | unit | `@regresses PLT-016` | `NotificationConfiguration.java:63` |

### F-010 Housekeeping TTL Enforcement
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-010 H-007 (**net_new**, filed **PLT-123**) | Activity empty-partition **check-then-DROP race** — a concurrent INSERT between `count(*)=0` and `DROP TABLE` silently destroys a committed audit row. Pin: concurrent insert is never dropped. | integration | `@regresses PLT-123` | F-010 · ADR-0028/0045 inverse |
| F-010 H-001 (PLT-005) | `AlertHousekeepingJob` jOOQ operator-precedence: manual RESOLVED alerts hard-deleted next cycle regardless of `resolved_alerts_days`. Pin: predicate groups correctly. | unit | `@regresses PLT-005` | F-010 · **TEST-GAP-211 (CRITICAL)** |
| F-010 H-002 (PLT-083) | Java-side TTL fields default `0`; partial `application.yml` override silently wipes all retained data within 15 min (LSN-001 shape). Pin: unset TTL ≠ 0/immediate-delete. | unit | `@regresses PLT-083` | F-010 · **TEST-GAP-209 (CRITICAL)** |
| F-010 H-005 (PLT-027) | `STATUS_UPDATED_AT` never bumped on DELETE transition → purge cutoff never matches → soft-deleted entities never purge. Pin: DELETE sets the timestamp. | unit | `@regresses PLT-027` | F-010 (see F-044 root) · **TEST-GAP-276 (CRITICAL)** |

### F-011 Principal-to-Owner Resolution (Owner-Scoping)
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-011 H-001 (**net_new**, filed **PLT-120**) | Cross-mode bleed: LOGIN_FORM "alice" and LDAP "alice" (two people) resolve to **one** Owner (`AuthIdentityProviderImpl.java:32` collapses provider). Pin: provider participates in identity. | integration | `@regresses PLT-120` | F-011 · PLT-120 |
| F-011 H-005 (**net_new**, filed **PLT-122**) | New OAUTH2/LDAP user lands on a fully-rendered but silently-empty platform (200 + []), no Owner, no onboarding. Pin: first login provisions/affords. | integration | `@regresses PLT-122` | F-011 · PLT-122 |
| F-011 H-002 (PLT-072) | S2S API-key clients hard-code `username='ADMIN'` (provider=null) → inherit a human "ADMIN"'s scoped data. Pin: S2S principal ≠ human ADMIN. | integration | `@regresses PLT-072` | F-011 · TEST-GAP-096/097 |
| F-011 H-003 (PLT-064) | Under LOGIN_FORM the whole `SECURITY_RULES` authz table is **inert** (`AuthorizationCustomizer` not wired) — every user unconditionally `ADMIN`. Pin: LOGIN_FORM still enforces rules (or doc'd ADMIN-only). | integration | `@regresses PLT-064` | F-011 (ADR-0074 LOGIN_FORM consequence) · TEST-GAP-139/778 |
| F-011 H-004 (PLT-066) | `PUT /api/owners/{id}` omitting `roles` silently DELETES all role bindings (PUT-vs-PATCH; `getRoleIdsList` null≡empty). Pin: omitted roles ≠ strip. | unit | `@regresses PLT-066` | F-011 |
| F-011 H-006 (PLT-111) | A GitHub login rename orphans the user-owner mapping (keyed on mutable login); recycled handle = identity takeover. Pin: stable-id fallback. | integration | `@regresses PLT-111` | F-011 |

### F-017 Search Filter Facets
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-017 H-002 (PLT-090) | `facet/OWNERS` (+TAGS/GROUPS/TYPES/NAMESPACES) returns whole-platform cardinality with no owner scope (cross-owner enumeration). Pin: facet respects scope. | integration | `@regresses PLT-090` | F-017 |
| F-017 H-005 (PLT-090) | `search_facets` has no `owner_id`/`created_by` — any user with the UUID reads+drives another user's session (bearer-by-UUID). Pin: session ownership enforced. | integration | `@regresses PLT-090` | F-017 |
| F-017 H-007 (PLT-090) | Typed search text reaches `to_tsquery` **unescaped** — a `(`/`:` permanently poisons the session (500 on every later read). Pin: metachars escaped. | integration | `@regresses PLT-090` | F-017 (same class as F-024 H-009) |

### F-018 Manual Object Tagging
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-018 H-004 (**net_new**, filed **PLT-124**) | `updateDatasetFieldTags` relation INSERT never sets `origin`, relies on DB default; explicit jOOQ NULL → endpoint **dead** for non-empty payload. Pin: origin set / endpoint works. | integration | `@regresses PLT-124` | F-018 · PLT-124 |
| F-018 H-001 (PLT-026) | "Top Tags" / `GET /api/tags` returns the **oldest** tags by serial id, not most-popular, once >1 page (paginate-before-aggregate, LSN-018). Pin: ordering is by popularity. | integration | `@regresses PLT-026` | F-018 · **TEST-GAP-855/856 (CRITICAL)** |
| F-018 H-005 (PLT-026) | Four side paths mint global Tag-directory rows without `TAG_CREATE` (getOrCreate side-door + unauthenticated ingestion). Pin: tag mint requires the gate. | integration | `@regresses PLT-026` | F-018 (mirrors F-019 H-004 owner side-door) |

### F-019 Owner Lifecycle Management
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-019 H-004 (**net_new**, filed **PLT-125**) | OWNER table mintable **without** `OWNER_CREATE` via three service-tier `getOrCreate` side-doors (path-anchored gate). Pin: side-doors require the permission. | integration | `@regresses PLT-125` | F-019 · PLT-125 · TEST-GAP-096 |
| F-019 H-007 (**net_new**, filed **PLT-131**) | `GET /api/owners/{id}` returns soft-deleted Owners (`getDto` omits the `deleted_at` filter `list` applies). Pin: detail hides soft-deleted. | unit | `@regresses PLT-131` | F-019 · PLT-131 |
| F-019 H-009 (**net_new**, filed **PLT-132**) | Owner delete cascade-block checks 3 of 4 relations — `owner_association_request` unchecked → orphan approvable onto a dead Owner. Pin: 4th relation blocks. | integration | `@regresses PLT-132` | F-019 · PLT-132 |
| F-019 H-012 (**net_new**, filed **PLT-136**) | Owner delete does not refresh FTS vectors (update does) → deleted owner names keep surfacing in search. Pin: delete refreshes FTS. | integration | `@regresses PLT-136` | F-019 · PLT-136 |
| F-019 H-002 (PLT-066) | Edit-dialog role-strip (3 clicks, no confirm) **irreversibly** hard-deletes all role bindings (reversible Delete has a confirm). Pin: role-strip confirmed/reversible. | integration | `@regresses PLT-066` | F-019 |
| F-019 H-003 (PLT-066) | `PUT /api/owners` with `roles` omitted silently strips bindings (same null≡empty as F-011 H-004). Pin: omitted ≠ strip. | unit | `@regresses PLT-066` | F-019 |
| F-019 H-001 (PLT-062) | Owner create/rename/delete emit ZERO audit (schema+enum rooted). Pin: each emits an event. | integration | `@regresses PLT-062` | F-019 |

### F-020 Collector Lifecycle Management
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-020 H-013 (**net_new**, filed **PLT-126**) | Token entropy = `RandomStringUtils.randomAlphanumeric` (ThreadLocalRandom in commons-lang ≥3.16), **not** `SecureRandom`. Pin: token source is a CSPRNG. | unit | `@regresses PLT-126` | F-020 · PLT-126 |
| F-020 H-004 (PLT-108) | Token regen is in-place UPDATE, no grace window → in-flight ingestion 401s immediately; no UI warning. Pin: regen warns / grace window. | integration | `@regresses PLT-108` | F-020 · TEST-GAP-097 |
| F-020 H-006 (PLT-062) | Zero recoverable audit for any collector lifecycle event. Pin: register/update/delete/rotate emits audit. | integration | `@regresses PLT-062` | F-020 |
| F-020 H-008 (PLT-085) | Collector token plaintext at rest end-to-end (`varchar(40)` no-hash, plaintext SQL equality, non-constant-time compare). Pin: token stored hashed + constant-time compare. | integration | `@regresses PLT-085` | F-020 |

### F-021 Activity Feed (Audit-Trail Surface)  _(logged upstream-issue; not yet filed)_
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-021 H-001 | `userIds` param binds to `USER_OWNER_MAPPING.OWNER_ID`, not the actor column `activity.created_by` — actor filter unimplemented (returns wrong rows). Pin: actor filter matches the actor. | integration | `@validates F-021` | F-021 |
| F-021 H-007 | Historical activity rows lose actor display when the user-owner mapping is soft-deleted (attribution retroactively rewritten). Pin: attribution stable. | integration | `@validates F-021` | F-021 |
| F-021 H-011 | Hard-deleting a data entity erases its audit history from reads (INNER JOIN drops surviving activity rows). Pin: audit survives entity hard-delete. | integration | `@validates F-021` | F-021 · TEST-GAP-083 |

### F-022 Per-Dataset DQ Test Reports & SLA
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-022 H-006 | UI hides the Test-reports tab for soft-deleted datasets (`RestrictedRoute isAllowedTo={!isStatusDeleted}`) though backend preserves them (detail-asymmetry, ADR-0058). Pin: deleted dataset still renders its reports. | integration | `@regresses ADR-0058` | F-022 |

### F-024 Term Search & Browse (Dictionary tab)
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-024 H-009 (**net_new**, filed **PLT-127**) | Malformed tsquery in the Dictionary box persists a poisoned session row → **persistent 500** on every later open. Pin: metachars escaped; poisoned row recoverable. | integration | `@regresses PLT-127` | F-024 · PLT-127 (same class as F-017 H-007) |

### F-027 Attachment Lifecycle (Files + Links)  _(LSN-002 family; cross-entity is PLT-086)_
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-027 H-005 (PLT-086) | Cross-entity privilege escalation — manage-on-A user mutates files/links on any entity B via URL spoof (controller discards the entity context). Pin: mutation checks the target entity. | integration | `@regresses PLT-086` | F-027 · **TEST-GAP-022 (CRITICAL)** |
| F-027 H-004 | Read endpoints (`getAttachments`/`getUploadOptions`/`downloadFile`) have **no** SecurityRule — any authenticated (anon under DISABLED) lists+downloads. Pin: add `DATA_ENTITY_ATTACHMENT` read gate. | integration | `@regresses PLT-086` | F-027 · **TEST-GAP-028 (CRITICAL)** |
| F-027 H-007 | Filename raw into LOCAL path (traversal) + into `Content-Disposition` (CRLF injection); no sanitization. Pin: filename sanitized on both sinks. | integration | `@regresses PLT-086` | F-027 · **TEST-GAP-027 (CRITICAL)** |
| F-027 H-002 | `attachment.max-file-size` is a UI hint only — chunk endpoint enforces **no** size limit (doc claims it rejects oversize). Pin: server rejects oversize. | integration | `@regresses PLT-086` | F-027 · **TEST-GAP-046 (CRITICAL)** |
| F-027 H-006 | Link URL stored raw, no scheme allowlist — `javascript:`/`data:` storable (stored-XSS, F-004 family). Pin: scheme allowlist. | unit | `@regresses PLT-086` | F-027 |
| F-027 H-009 | REMOTE MinIO client never sets `.region(...)` — S3 outside us-east-1 fails opaquely (LSN-002 code residue, doc-mitigated only). Pin: region set + non-us-east-1 works. | integration | `@regresses PLT-086` | F-027 · **TEST-GAP-052 (CRITICAL)** / TEST-GAP-730 |
| F-027 H-010 | Chunk staging `/tmp/odd/chunks` is node-local for LOCAL **and** REMOTE; multi-replica without sticky/shared-volume fails uploads (LSN-001 shape). Pin: multi-replica upload succeeds. | integration | `@regresses PLT-086` | F-027 · TEST-GAP-730 |

### F-029 Platform Public API Contract
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-029 H-012 (**net_new**) | **Zero spec↔running-platform conformance test** — the structural root that lets every status-code / inverse-semantic / missing-field drift through undetected. Pin: a conformance harness over `openapi.yaml`. | integration | `@validates F-029` | F-029 · TEST-GAP family (see P2 conformance) |
| F-029 H-006 (PLT-012) | Spec plural `/terms` is the client URL; `SECURITY_RULES` singular `/term` never matches → `DATA_ENTITY_ADD_TERM/DELETE_TERM` gates **silently disabled**. Pin: term gate actually fires. | integration | `@regresses PLT-012` | F-029 · **TEST-GAP-017 (CRITICAL)** |
| F-029 H-005 (SPC-002) | `getMyObjectsWithUpstream/Downstream` spec summaries are the **inverse** of the implementation. Pin: spec summary matches behaviour. | unit | `@validates F-029` | F-029 (SPC-002 in odd-specification) |

### F-031 Data Source Lifecycle Management
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-031 H-005 (**net_new**, filed **PLT-128**) | Delete on an actively-ingested source 400s and the ConfirmationDialog **stays stuck-open** (`.catch(()=>{})` swallows the rejection). Pin: rejection surfaced + dialog recovers. | integration | `@regresses PLT-128` | F-031 · PLT-128 |
| F-031 H-006 (PLT-038) | Regenerate dialog gives **no** consequence warning — operator gets no signal the old token dies instantly. Pin: warning present. | integration | `@regresses PLT-038` | F-031 |

### F-032 Quality Dashboard
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-032 H-004 (PLT-052) | Out-of-enum run-status throws uncaught `TypeError` (`DataQualityContent.tsx:47-48`) and **blanks the whole dashboard**. Pin: unknown status degrades gracefully. | integration | `@regresses PLT-052` | F-032 · TEST-GAP-1013 (no SPA error boundary) |
| F-032 H-006 (PLT-052) | Breakdown counts **TESTS by latest-run status, not RUNS** (LSN-019); label/URL/OpenAPI/UI all drift. Pin: count semantics = runs. | unit | `@regresses PLT-052` | F-032 |
| F-032 H-005 (DOC-GAP-264) | "Title" filter binds to `OWNERSHIP.TITLE_ID` (ownership role), not dataset name (LSN-020) → operator filters by what they typed and gets nothing. Pin: filter binds to name. | integration | `@regresses DOC-GAP-264` | F-032 |

### F-038 Data Collaboration (Slack Discussions)
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-038 H-003 (**net_new**, filed **PLT-119**) | `POST /datacollaboration/providers/slack/messages` attaches a message to **any** `data_entity_id` in any bot-joined channel — no owner/read scope, no RBAC. Pin: post checks entity scope. | integration | `@regresses PLT-119` | F-038 · PLT-119 · **TEST-GAP-088/089 (CRITICAL)** |
| F-038 H-002 (PLT-054) | `/api/slack/events` performs **no** Slack signature verification + is auth-whitelisted in all four modes — any internet caller forges thread-reply events. Pin: signature verified. | integration | `@regresses PLT-054` | F-038 |
| F-038 H-005 (PLT-054) | Slack at-least-once + no unique constraint on `message_provider_event(provider,event_id)` + no ON CONFLICT → duplicate Slack replies. Pin: idempotent event handling. | integration | `@regresses PLT-054` | F-038 |

### F-039 GenAI Assistant  _(logged upstream-issue; security captured in PLT-020)_
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-039 H-001 (PLT-020) | No authz on a cost-bearing endpoint — any authenticated (anon under DISABLED) invokes the external LLM on the operator's account. Pin: `/api/genai/**` gated + fail-closed under DISABLED. | integration | `@regresses PLT-020` | F-039 · **TEST-GAP-036 (CRITICAL)** |
| F-039 H-002 (PLT-020) | Enable-with-defaults silently misconfigures (`url=null`, `request_timeout=0`) — boots clean, fails every request with a misleading "0 min" message. Pin: enable-without-url fails fast / clear error. | unit | `@enforces ADR-0004` | F-039 (also P0 ADR-0004) |
| F-039 H-005 (PLT-020) | No audit of who asked what — the available `Principal` is declared and discarded. Pin: a GENAI usage event is persisted/logged. | integration | `@regresses PLT-020` | F-039 · TEST-GAP-039 |

### F-044 Data Entity Status Lifecycle  _(the root cause behind F-010 H-005 — same `applyStatus` bug)_
| finding | what to pin | type | gate | source |
|---|---|---|---|---|
| F-044 H-002 (PLT-027) | `DataEntityMapperImpl.applyStatus` mutates the pojo **before** the change-detection guard → `status_updated_at` never set → housekeeping TTL never matches. Pin: DELETE transition sets the timestamp. | unit | `@regresses PLT-027` | F-044 · **TEST-GAP-276 (CRITICAL)** |
| F-044 H-003 (PLT-027) | The manual-PUT delete path shares the same mapper bug — operator deletes also leave `status_updated_at` NULL. Pin: manual delete sets timestamp. | unit | `@regresses PLT-027` | F-044 |
| F-044 H-007 (PLT-027) | Cross-pillar contract (F-044 produces DELETED rows for F-010 to reap) broken at the data layer — housekeeping matches zero rows. Pin: produced rows are reapable. | integration | `@regresses PLT-027` | F-044 (cross-links F-010) |

**P1 count: 78 HIGH-finding pins** (14 net_new/freshly-filed-PLT priority + 64 already_tracked/intended-behaviour). Spread: **unit = 19, integration = 59.**

---

## P2 — CRITICAL / HIGH TestGaps not already pinned by P0/P1

The `test-map` corpus is large (168 CRITICAL, 349 HIGH). The **CRITICAL-security cluster (132)** maps almost 1:1 onto ADR-0002/0003 (P0) and the F-005/F-007/F-017/F-019/F-027/F-038/F-039 authz pins (P1) — those are cross-referenced above, not re-listed. What remains genuinely **distinct** are the **integration regression-pins for the landmines + cross-cutting structural gaps**. Author these:

| subject | what the test exercises | type | gate | TEST-GAP |
|---|---|---|---|---|
| Auth-mode bean-graph — DISABLED | Spring-context asserts `securityWebFilterChainDisabled` present (+ siblings absent) when `auth.type=DISABLED`; the ADR-0074 contract. | unit | `@enforces ADR-0074` | TEST-GAP-133 |
| Auth-mode bean-graph — LOGIN_FORM | context asserts `securityWebFilterChainLoginForm` present + others absent. | unit | `@enforces ADR-0074` | TEST-GAP-139 |
| Auth-mode behaviour — all 4 modes | running-stack: DISABLED→open, LOGIN_FORM/OAUTH2/LDAP→authenticated; the cross-cutting absence. | integration | `@enforces ADR-0074` | TEST-GAP-778 |
| Attachment backend bean topology | context-test: `attachment.storage=LOCAL`→`LocalFile*`, `=REMOTE`→`RemoteFile*`/`MinioConfig`; the **ADR-0012** contract that `test-gates.yaml` does NOT yet cover. | unit | `@enforces ADR-0012` | TEST-GAP-047 |
| Attachment LOCAL durability (LSN-001) | upload→restart container→file gone under LOCAL, survives under REMOTE. | integration | `@regresses ADR-0012` | TEST-GAP-024, TEST-GAP-051 |
| Attachment REMOTE non-us-east-1 (LSN-002) | Testcontainers-MinIO pointed at a non-default region; assert success once `.region(...)` set. | integration | `@regresses PLT-086` | **TEST-GAP-052 (CRITICAL)**, TEST-GAP-730 |
| WAL subscriber thread-death | kill the subscriber thread; assert death detected + a liveness metric/health flips. | integration | `@regresses PLT-016` | **TEST-GAP-796 (CRITICAL)** |
| WAL poison-replay disk-exhaustion | sustained poison row pins WAL position → assert skip-poison prevents unbounded retention. | integration | `@regresses PLT-016` | **TEST-GAP-795 (CRITICAL/perf)**, TEST-GAP-455 |
| EXCLUDE_FROM_SEARCH inclusion | seed hidden+high-view entity; assert it stays out of Popular/search. | integration | `@regresses PLT-104` | **TEST-GAP-310 (CRITICAL)** |
| Tag ordering (LSN-018) | `GET /api/tags?page=1&size=30` must return most-popular, not oldest-by-id. | integration | `@regresses PLT-026` | **TEST-GAP-855/856 (CRITICAL)** |
| Owner cascade-delete composition | service-tier: the 3-line cascade yields the destructive delete; pin the guard. | integration | `@regresses PLT-132` | TEST-GAP-680 |
| SPA error boundary | no React error boundary exists anywhere — any render-time throw blanks the app. | integration | `@validates F-042` | **TEST-GAP-1013 (CRITICAL)** |
| OAuth2 relaxed-binding (kebab) | `auth.oauth2.client.{id}.username-attribute` silently fails to bind (single-word kebab). | unit | `@regresses PLT-130` | TEST-GAP-184 (CRITICAL/binding) |
| HTTP-tier smoke — batch-T controllers | 4 controllers have **zero** WebFluxTest/WebTestClient coverage. | unit | `@validates F-021` | TEST-GAP-717 (CRITICAL) |
| Term (Glossary) pillar — zero coverage | entire P-06 Data Glossary has no test at any tier. | mixed | `@validates F-024` | TEST-GAP-721 (CRITICAL) |
| SLA PNG-vs-JSON endpoint confusion | doc sends operators to the wrong endpoint; assert the documented call returns the documented shape. | integration | `@validates F-022` | TEST-GAP-705 (CRITICAL) |
| ActivityAspect integration-test blind spot | `@Profile("!integration-test")` means integration tests can't catch missing-activity emissions — a META trap to redesign before the audit pins are trustworthy. | integration | `@validates F-021` | TEST-GAP-491 (CRITICAL) |
| Spec↔platform conformance harness | the structural root (F-029 H-012) — generate request/response checks from `openapi.yaml` against the running platform. | integration | `@validates F-029` | TEST-GAP family + F-029 H-012 |

**P2 distinct entries: 18.**

### Long tail (summarized — do NOT enumerate; triage from `test-map/detail/`)

| criticality | missing-security | missing-integration | missing-edge-case | missing-unit | missing-perf | missing-binding | total |
|---|---|---|---|---|---|---|---|
| CRITICAL | 132 | 25 | 9 | 0 | 1 | 1 | **168** |
| HIGH | 119 | 135 | 57 | 25 | 12 | 1 | **349** |
| MEDIUM | — | — | — | — | — | — | **389** |
| LOW | — | — | — | — | — | — | **131** |

- The **132 CRITICAL-security** gaps are predominantly "endpoint X has no permission gate / is anonymously reachable under DISABLED" — they are **covered in aggregate** by the P0 ADR-0002/0003 enforcement tests + the P1 per-feature authz pins. Author the P0/P1 tests first; then sweep `grep -l "criticality: CRITICAL" test-map/detail/*.yaml | xargs grep -l missing-security` to confirm each named endpoint has a row in the resulting `@enforces ADR-0002`/`@regresses PLT-*` suite, and backfill any orphan.
- **MEDIUM (389) + LOW (131)** are deferred. Pointer: `lineage/odd-platform/test-map/detail/` (filter `criticality: MEDIUM|LOW`); most are `missing-edge-case` (null/empty/boundary) folded naturally into the unit batches above as extra assertions.
- Per `alignment-scorecard.md` D: **582/1038 TestGaps are still orphan** (no typed gate). Authoring the batches below + backfilling `gates:` blocks is top-action #4.

---

## P3 — feature-validation gaps (features with no validating test)

84 of the 112 features have no `validates:` gate. Lead with the **reflected-but-unvalidated** features (their hypotheses already give the falsifiable assertions) and the **high-traffic core surfaces**. The "validation test needed" is a happy-path WebFluxTest/UI-render assertion that the feature does what its name claims.

> Already validated (excluded — see `test-gates.yaml`): F-005, 006, 007, 008, 012, 013, 017, 018, 019, 020, 021, 022, 023, 025, 026, 028, 030, 031, 036, 040, 044, 045, 046, 047, 075, 122, 126, 176.

**Tier A — reflected, HIGH-severity, but no validating gate** (the validation + the P1 pins share a fixture):
| feature | validation test needed | type |
|---|---|---|
| F-001 Popular Entities Ranking | ranking returns by view_count desc; the strip renders top-N (pairs with P1 F-001 pins). | integration |
| F-009 WAL Notification Delivery | enabled+one channel → an alert WAL event is delivered once (pairs with P1 F-009 / ADR-0043). | integration |
| F-010 Housekeeping TTL | aged resolved-alert / soft-deleted entity is purged at TTL; non-aged retained. | integration |
| F-011 Principal-to-Owner Resolution | each auth mode resolves a principal to the correct distinct Owner. | integration |
| F-024 Term Search (Dictionary) | term search returns matching terms; the Dictionary tab renders results. | integration |
| F-027 Attachment Lifecycle | upload→list→download round-trip for a scoped user (pairs with ADR-0012). | integration |
| F-029 Public API Contract | the conformance harness (= P2). | integration |
| F-032 Quality Dashboard | dashboard renders run breakdown for a seeded entity; unknown-status degrades. | integration |
| F-038 Data Collaboration | enabled + scoped user posts + reads a message thread. | integration |
| F-039 GenAI Assistant | enabled+configured → ask proxies to the stub LLM and returns its answer. | integration |

**Tier B — core unreflected surfaces with no gate** (catalog plumbing operators hit daily):
| feature | validation test needed | type |
|---|---|---|
| F-002 Term-to-Entity Linkage | linking a term to an entity persists + reads back. | integration |
| F-004 Entity Description Editing | edit→read-back; the stored-XSS scheme guard (F-004 family) holds. | integration |
| F-012 Data Entity Group Membership | (gate exists via `DataEntityDomainsTest`) — extend with explicit `@validates F-012`. | unit |
| F-013 Custom Metadata Field Editing | (mapper/parser tests exist) — add a service round-trip `@validates F-013`. | integration |
| F-015 My-Objects Anchor-Set Reads | `/my`,`/my/upstream`,`/my/downstream` return only owner-anchored entities (ADR-0003 opt-in). | integration |
| F-016 DEG-Anchored Lineage | group-anchored lineage resolves members' edges. | integration |
| F-023 Directory Browsing | (`DirectoryTest` exists) — confirm `@validates F-023` typed gate. | unit |
| F-025 Query Examples | (service/repo tests exist) — add faceted-search `@validates F-025`. | integration |
| F-028 Namespace Lifecycle | (service/repo tests exist) — confirm typed gate. | unit |
| F-030 Metrics Ingestion | (ingestion tests exist) — confirm `@validates F-030` typed gate. | integration |
| F-041 Application Toolbar / Primary Nav | primary nav renders the expected sections per permission. | integration (UI) |
| F-042 Page-level UI Error / Missing-Route | error boundary + 404 route render (= P2 TEST-GAP-1013). | integration (UI) |
| F-043 Multilingual UI (i18n) | locale switch renders translated keys. | integration (UI) |
| F-054/F-055 Lineage depth/microservices | depth-boundary contract (pairs with F-005 H-003 clamp). | integration |
| F-119/F-120/F-121/F-122 operator surfaces | actuator/management-endpoint exposure + connection-pool sizing behave per config. | integration |
| F-141 Catalog Overview Home | home composition renders Popular/Recommended panels (pairs with F-001). | integration (UI) |

**Tier C — UI-composition + term-detail family (F-146…F-208, ~30 features)**: low-individual-risk render/compose surfaces. Summarized, not enumerated — pointer: `feature-flows/detail/F-{146..208}.yaml`. Fold a render-smoke `@validates F-NNN` for each into the **UI-render batch** once the e2e harness (TEST-GAP-454) exists.

**P3 count: 26 named (10 Tier A + 16 Tier B) + ~30 Tier-C summarized.**

---

## Implementation batches

Small/medium **themed** batches for `/implement`, **unit (CI) and integration (LOCAL) separated**, ordered by priority. Sizes: S ≈ 1–3 tests, M ≈ 4–8, L ≈ 9–15.

### UNIT batches → CI/CD (gradle, gated, `@enforces`/`@validates`/`@regresses` in-source)

| # | batch name | members | size | notes |
|---|---|---|---|---|
| U1 | **ADR feature-gating defaults** | ADR-0004, 0040, 0041, 0046, 0075 (+P1 F-039 H-002) via `ApplicationContextRunner` + yaml-defaults | M | one config-test class; highest leverage (5 ADRs, P0) |
| U2 | **ADR contract-shape scans** | ADR-0001, 0002, 0003, 0007, 0008, 0072 (classpath/annotation/spec-lint reflection scans) | M | `ControllerAdvice` mapping test + `SECURITY_RULES` introspection |
| U3 | **ADR stack + structural** | ADR-0021, 0022, 0045, 0071 (forbidden-coordinate scan, lock-name structure, dispatch) | M | pure-logic; no DB |
| U4 | **ADR-0018 fail-fast bean factories** | ADR-0018 (empty/absent/valid per bean) + P1 F-009 H-009 (smtp casing) | S | `ApplicationContextRunner` per channel |
| U5 | **Auth bean-graph contracts** | TEST-GAP-133, 139 (DISABLED/LOGIN_FORM presence), TEST-GAP-047 (attachment bean topology = **ADR-0012**), TEST-GAP-184 (oauth2 kebab binding) | M | sliced-context; CI-safe |
| U6 | **Status/housekeeping mapper bugs (LSN-019/020 + applyStatus)** | F-044 H-002/H-003, F-010 H-001/H-002/H-005, F-032 H-006, TEST-GAP-209/211/276 | M | jOOQ-predicate + mapper logic; pins PLT-027/005/083/052 |
| U7 | **Owner/Tag write-semantics units** | F-019 H-003/H-007, F-011 H-004, F-006 H-009 (PUT-vs-PATCH null≡empty; soft-delete detail; reserved-name) | M | pins PLT-066/131 |
| U8 | **Token + URL-scheme units** | F-020 H-013 (CSPRNG), F-007 H-004 + F-027 H-006 (scheme allowlist), F-029 H-005 (spec-summary lint) | S | pins PLT-126/014/086 |
| U9 | **HTTP-tier smoke (WebFluxTest)** | TEST-GAP-717 (batch-T 4 controllers), AlertController smoke (TEST-GAP-001 class), + typed-gate confirmations F-012/023/028/030 | M | `@WebFluxTest`; feature-validation P3 Tier-B units |

### INTEGRATION batches → LOCAL suite (docker-compose; later wrapped as probe protocols)

| # | batch name | members | size | stack needed |
|---|---|---|---|---|
| I1 | **Auth-mode + authz enforcement (ADR-0002/0003/0074)** | ADR-0002, 0003, 0074; TEST-GAP-778; F-011 H-002/H-003; F-027 H-004; F-039 H-001; the CRITICAL-security read-openness pins (TEST-GAP-018/081/083) | L | platform + Postgres; per-mode boot profiles; pins PLT-064/072/086/020 |
| I2 | **Attachment storage (LSN-001/002, ADR-0012)** | TEST-GAP-024, 051, 052, 730; F-027 H-009/H-010; ADR-0012 durability | M | platform + Postgres + **Testcontainers-MinIO** (non-us-east-1) + container-restart |
| I3 | **Notifications WAL + fan-out (ADR-0040/0042/0043/0044, PLT-016)** | ADR-0043, 0044; F-009 H-007/H-008/H-002/H-011/H-004/H-006; TEST-GAP-455/795/796 | L | 2× platform replicas + Postgres logical-replication + advisory-lock failover + Slack/webhook stubs |
| I4 | **Data Collaboration (ADR-0019/0020, PLT-119/054)** | ADR-0019 (404), ADR-0020 (202+drain); F-038 H-003/H-002/H-005; TEST-GAP-088/089 | M | platform + Postgres + Slack-events stub |
| I5 | **Ingestion identity contract (ADR-0070/0073, PLT-003/012)** | ADR-0070, 0073; F-008 H-002; F-029 H-006 (term-gate path mismatch); TEST-GAP-017/097 | M | platform + Postgres + ingestion payloads (pull vs push) |
| I6 | **Lineage traversal safety (PLT-100/042/028)** | F-005 H-001/H-002/H-003/H-009/H-012; ADR-0028 partition lifecycle; TEST-GAP-123 (drop race) | M | platform + Postgres + seeded graph (deep/cyclic) |
| I7 | **Search/session poisoning + facet scope (PLT-090/127)** | F-017 H-002/H-005/H-007; F-024 H-009; F-018 H-001/H-004/H-005; TEST-GAP-855/856 | M | platform + Postgres FTS + seeded multi-owner catalog |
| I8 | **Audit-trail completeness (PLT-062, ADR-0058)** | F-006 H-001/H-002; F-019 H-001/H-002/H-009/H-012; F-020 H-006/H-008; F-021 H-001/H-007/H-011; F-022 H-006; TEST-GAP-491/680 | L | platform + Postgres; **note TEST-GAP-491** ActivityAspect `!integration-test` profile must be addressed first; pins PLT-062/110/132/136/108/085 |
| I9 | **UI cross-tier e2e (Playwright/vitest)** | TEST-GAP-454 (harness), 1013 (error boundary), 438/836 (F-001 inflation loop), F-031 H-005/H-006, F-032 H-004, F-011 H-001/H-005; P3 Tier-C render-smokes | L | full stack + browser driver; build the harness (TEST-GAP-454) first |
| I10 | **API conformance harness (F-029)** | F-029 H-012 spec↔platform conformance; SLA PNG/JSON (TEST-GAP-705); Glossary pillar smoke (TEST-GAP-721) | M | platform + Postgres + `openapi.yaml`-driven request generation |

**Batch order (priority):** U1→U2→U5→U6 (P0 + landmine units, fastest CI wins) · then I1→I2→I3 (authz + the two LSN landmines + WAL — the scorecard's top-action #1) · then U3/U4/U7/U8/U9 + I4–I10 by feature area.

---

## Provenance / dedup statement
Every row cites a real id read from the live ontology this session: 27 ADR decisions (`../documentation/.../ADR-*.md`) + `realises:` loci (`backlog/adr/ADR-*.md`); 133 bug_candidates across 23 `feature-reflections/detail/F-*.yaml` (HIGH + `dedup_status` + `tracked_as`/`filed_as`); 1038 `test-map/detail/TEST-GAP-*.yaml` (criticality + category + behaviour); filed `issues/odd-platform/PLT-*.md` (incl. landmine PLT-119…138). Excluded as already-covered: the 66 tests in `test-gates.yaml`, ADR-0058 (3 enforcing tests), the 28 validated features. **No id was invented.** `⚠ TARGET UNCLEAR` markers: none required — every pin resolved to a concrete code locus or TestGap.

---

## Step-3 implementation log (authored batches)

Tracks batches moved from **define** → **implemented** (test authored + gated in-source). Run state is logged separately — unit batches in CI (gradle), integration batches in `integration-tests/run-log/`.

| batch | status | test artefact | gates | idiom / notes |
|---|---|---|---|---|
| **U1** ADR feature-gating defaults | **authored** — awaiting CI run | `odd-platform-api/.../config/FeatureGatingDefaultsTest.java` (4 `@Test`) | `@enforces` ADR-0075 / 0004 / 0040 / 0046 | YAML-pin + GenAIProperties POJO defaults (see idiom note). Covers the *defaults* half of 0004/0040; bean-topology half → U5. |
| **U2** dependency posture | **authored** — awaiting CI run | `odd-platform-api/.../config/DependencyPostureTest.java` (3 `@Test`) | `@enforces` ADR-0071 / 0072 | `Class.forName` absence (forbidden messaging/coordination/search + servlet) + reactive-present guard. Merges test-plan U2(0072)+U3(0071); verified green against `libs.versions.toml`. |
| **e2e Tier-1** (I7+I9 UI scenarios) | **RED-confirmed 2026-06-02** (run-log `2026-06-02-known-bugs.md`) | `integration-tests/protocols/IT-003…IT-006-*.md` + `integration-tests/e2e/specs/{search-tsquery-poisoning,quality-dashboard-unknown-status,top-tags-ordering,error-boundary-containment}.spec.ts` | regresses PLT-090/127/052/026 · validates F-017/024/032/042 | Playwright UI e2e, quarantined in `known-bugs`. **All 5 pins ran RED for the documented reason** (IT-003 `500 PUT /api/{search,terms/search}`; IT-004 `palette.runStatus["WARNING"]` TypeError; IT-005 `it005-POP-005` absent; IT-006 `#root` blank). Each flips GREEN when its bug ships → move to `feature-complete` = measurable closure. Triggers: IT-003 types `foo )(` (no-seed); IT-004/IT-006 inject an unknown-status / `tables_dashboard:null` into `/api/dataqatests/runs` (**snake_case wire keys**); IT-005 seeds 35 tags via `helpers/db.seedPopularYoungTags`. Two false-green/crash defects in the first run were fixed (deleted_at column; camelCase-vs-snake_case wire + react-query initialData masking) — see the run-log. |

| **e2e Tier-2a** (I2 attachment durability) | **RED-confirmed 2026-06-02** (run-log `2026-06-02-known-bugs.md`) | `integration-tests/protocols/IT-007-attachment-local-durability.md` + `integration-tests/e2e/specs/attachment-local-durability.spec.ts` (+ `helpers/docker.ts` recreate, `helpers/db.seedAttachmentEntity`) | regresses PLT-086 · validates F-027 · LSN-001 | Integration durability (REST upload/download + a real container **recreate**; no browser). Ran RED end-to-end: upload→download-OK→recreate platform container (DB kept)→attachment **still listed** but download **500** = silent data loss. Two spec defects fixed mid-run: initiate field is `fileName` (a camelCase outlier — ADR-0072), and the `docker.ts` compose path. `known-bugs` + `I2-attachment-storage`. |
| **e2e Tier-2b** (I2 REMOTE + LSN-002) | **IT-008 GREEN-confirmed 2026-06-02** (run-log `2026-06-02-feature-complete.md`); **LSN-002 unit pin authored — awaiting gradle** | `integration-tests/protocols/IT-008-attachment-remote-roundtrip.md` + `specs/attachment-remote-roundtrip.spec.ts` (+ `helpers/minio-stack.ts`, `helpers/attachments.ts`, `probe-stacks/odd-minio.docker-compose.yml`) **AND** odd-platform `MinioConfigRegionTest.java` (branch `test/adr-enforcement-units`, `9ce4f18f`) | IT-008 validates F-027 REMOTE (GREEN, `feature-complete`+I2); unit pin `@regresses PLT-086` | **Finding: vanilla MinIO can't reproduce LSN-002** — minio-java auto-discovers bucket region via GetBucketLocation; upload succeeded vs eu-west-1 (proven). So LSN-002 is pinned **structurally** (unit: MinioConfig must set `.region(...)` from `attachment.remote.region`; RED until fixed), and the MinIO stack was salvaged as IT-008 (REMOTE round-trip, net-new coverage). The real LSN-002 bites AWS S3 under least-privilege IAM (no s3:GetBucketLocation). |
| **e2e Tier-3a** (I1 auth-mode boundary) | **IT-009 GREEN-confirmed 2026-06-02** (run-log `2026-06-02-feature-complete.md`) | `integration-tests/protocols/IT-009-auth-mode-boundary.md` + `specs/auth-mode-boundary.spec.ts` (+ `helpers/stack.ts` generic + `helpers/loginform-stack.ts` + `probe-stacks/odd-loginform.docker-compose.yml`) | enforces ADR-0074 · TEST-GAP-778 | The foundational auth-mode contract (zero coverage before): `/api/dataentities/classes` is open under DISABLED (`:18080`) and requires auth (401/302) under LOGIN_FORM (`:18082`). GREEN, `feature-complete`+`I1`. Generic stack lifecycle extracted to `helpers/stack.ts` (minio-stack refactored onto it, re-verified GREEN). |
| **e2e Tier-3b** (I1 RBAC enforcement) | **IT-010 GREEN-confirmed 2026-06-02** (run-log `2026-06-02-feature-complete.md`) | `integration-tests/protocols/IT-010-ldap-rbac-enforcement.md` + `specs/ldap-rbac-enforcement.spec.ts` (+ `helpers/ldap-stack.ts` + `probe-stacks/odd-ldap.docker-compose.yml`) | enforces ADR-0002 + ADR-0003 | A non-admin LDAP USER (alice) → `DELETE /api/owners/999999` → **403**: SECURITY_RULES enforce under the only local enforcing mode (LOGIN_FORM leaves them inert). **Reframing finding: there is NO ADMIN bypass** — authz resolves permissions from policies, so a fresh USER is denied every gated mutation; and most "auth bugs" (LOGIN_FORM everyone-admin, read-collaborative reads) are documented postures, not clean RED bugs — so the clean Tier-3b win is this GREEN enforcement proof. GREEN, `feature-complete`+`I1`. Resolved 3 infra snags (bitnami image gone→osixia; relative dn-pattern; --renew-anon-volumes). |
| **e2e Tier-3c** (I3 notifications WAL) | **IT-011 GREEN-confirmed 2026-06-02** + **bug filed (PLT-139)** (run-log `2026-06-02-feature-complete.md`) | `integration-tests/protocols/IT-011-notifications-wal-lifecycle.md` + `specs/notifications-wal-lifecycle.spec.ts` (+ `helpers/notifications-stack.ts` + `probe-stacks/odd-notifications.docker-compose.yml`) **AND** `issues/odd-platform/PLT-139.md` | enforces ADR-0040 + ADR-0044 | OFF (odd-minimal) → no replication slot; ON (notifications enabled, postgres wal_level=logical) → slot + publication on `alert` lazily created. **Reframing finding:** the full delivery chain works (alert INSERT→WAL→webhook in ~4s, proven) but is **flaky on fresh boot** — ADR-0044's slot-before-publication create-order can wedge the subscriber permanently (`publication does not exist`, no DROP recovery), **filed PLT-139**. So IT-011 pins the deterministic slot/publication lifecycle; the wedge is the higher-value finding. GREEN, `feature-complete`+`I3`. |
| **e2e Tier-3d** (I3 leader failover) | **IT-012 GREEN-confirmed 2026-06-02** (run-log `2026-06-02-feature-complete.md`) | `integration-tests/protocols/IT-012-notifications-wal-failover.md` + `specs/notifications-wal-failover.spec.ts` (+ `helpers/ha-stack.ts` + `probe-stacks/odd-notifications-ha.docker-compose.yml`) | enforces ADR-0043 | 2-replica stack: A holds advisory lock 100 (leader, pid 575) + B blocks (waiting, pid 700); kill A → B acquires the lock in ~2s (failover). GREEN, `feature-complete`+`I3`. **PLT-139 blast-radius confirmed + the issue strengthened:** the wedge flaps the advisory lock (try-with-resources releases it on each stream error) → no stable leader → all alerting dead cluster-wide; IT-012 un-wedges a clean leader first (drop slot + restart; a plain restart does not recover). |

Branch (odd-platform): `test/adr-enforcement-units` — U1 + U2 atop `2febc791` (merged landmine pins). Awaiting the maintainer's `gradle` run (the unit-side validation gate; once green it de-risks the idiom for U5/U6). The e2e batches live in `integration-tests/e2e/` (odd-team workspace; no odd-platform branch) — run `integration-tests/run-suite.sh known-bugs`.

### Idiom correction (applies to all unit batches — read before U2/U5)

`ApplicationContextRunner` has **zero precedent** in odd-platform's test tree (0 hits; only 1 `@SpringBootTest`, 0 `@WebFluxTest`). The test-plan rows above that say "via `ApplicationContextRunner`" should instead use the **proven config-test idioms** from the LSN-001/002 pins:
- **(A) YAML-pin** — `YamlPropertiesFactoryBean` + `ClassPathResource("application.yml")` → assert shipped property values. For the *defaults posture* (which flags ship true/false). No context boot; CI-safe.
- **(B) reflection structural pin** — reflect over a class's declared fields/methods → assert structure (e.g. MinioConfig field set; controller-annotation absence).
- **(C) POJO defaults** — instantiate a `@ConfigurationProperties` POJO, assert its Java field defaults.

**Consequence for U5:** the *bean-topology* halves — ADR-0040 (3 notification beans absent when unset), ADR-0041 (per-channel `@ConditionalOnProperty` toggling), ADR-0004 (service-guard throws when disabled) — genuinely need a booted/sliced context. Fold them into **U5** (the bean-graph batch) and introduce `ApplicationContextRunner` there **once**, verifying it compiles+evaluates against the real condition classes before fanning out. U1 deliberately covers only the defaults half — honest scoping, not the full ADR-0040/0041 behaviour.

### Discovered findings (logged here, on disk, per follow-up-on-disk)

- **ADR-0003 is integration, not unit (reclassify the P0 row).** `SecurityConstants.SECURITY_RULES` is `public static final` and iterable, but each rule's HTTP method is encapsulated inside Spring's `PathPatternParserServerWebExchangeMatcher` with no public getter — so the "every rule guards a mutation; single GET exception" invariant cannot be cleanly unit-introspected (only via brittle reflection into Spring internals). Assert it in **I1** by booting the app and probing each path's method. The P0 ADR-0003 row's `test_type` moves unit → integration.
- **Duplicate `SECURITY_RULES` row.** `SecurityConstants.java:99-102` registers `/api/namespaces POST → NAMESPACE_CREATE` twice (byte-identical). Harmless (idempotent matching) but redundant — a one-line dedup. Trivial-fold candidate for a future odd-platform housekeeping commit; not worth its own PR or upstream issue.

### Integration-test approach correction (2026-06-02) — e2e user scenarios, not API probes

Integration tests must be **end-to-end user scenarios** (UI → backend → DB), anchored on documented + intended behaviour — not API-endpoint probes. The view_count canary exposed the gap: IT-001/P-001 checked only `GET /api/dataentities/{id}` (+1/call) and **missed the user-facing +2 double-count** (LSN-017 / PLT-104) — that bug lives in a React `useEffect` and is invisible to an HTTP probe. Only a real-browser e2e catches it. (Recorded: `memory/feedback_integration_tests_are_e2e_user_scenarios.md`.)

Corrections applied this session:
- **IT-002** (`integration-tests/e2e/specs/view-count-overview.spec.ts`) — the real integration test: open the entity Overview page once → `view_count` must be +1 (**RED today at +2**; pins PLT-104). IT-001 reframed as the backend sub-check it sits on.
- **Self-contained Playwright harness** added at `integration-tests/e2e/` (own stack via odd-minimal, own deps; not coupled to `odd-platform/tests/`). `run-suite.sh` gained an `e2e:` automation rail alongside the API-probe rail.
- **I1–I10 need re-derivation as user scenarios.** The "build the Playwright harness first (TEST-GAP-454, I9)" deferral was fictional — a mature harness already exists at `odd-platform/tests/` (which informed this build). Each I-batch should lead with the documented user flow + a UI-e2e protocol, with API probes as backend sub-checks. **To action when authoring I1+.**

### E2e integration build-out plan (chosen 2026-06-02 — build out I1+ as user scenarios)

Pattern proven by IT-002: a UI-e2e spec drives the real browser through a documented user flow and reads ground truth from Postgres, catching user-observable bugs the API probes can't. Now applied to the I-batches — each becomes one or more `IT-NNN` protocol + e2e spec. **Sequenced by feasibility, not by label order** (a Principal doesn't start with the hardest):

**Tier 1 — DISABLED stack, single-user, clean UI flow (✅ ALL AUTHORED 2026-06-02 → `known-bugs` suite, expected RED; selectors grounded in `odd-platform-ui/` + `odd-platform/tests/ui/`):**
- ✅ **IT-003** Dictionary/search `tsquery` poisoning — F-024 H-009 / PLT-127, F-017 H-007 / PLT-090: type `foo )(` in the catalog (`[data-qa=search_string]`) + dictionary (`/termsearch`) box → assert no `/api/` 5xx + session not persistently poisoned. `known-bugs` + I7.
- ✅ **IT-004** Quality Dashboard unknown-status crash — F-032 H-004 / PLT-052: inject an out-of-enum run status into the `/data-quality` dashboard response (`status` is VARCHAR(64), not a DB enum; injection = "a backend enum addition") → assert graceful degrade, not a render TypeError. `known-bugs` + I9.
- ✅ **IT-005** Tag ordering — F-018 H-001 / PLT-026: seed 35 tags (youngest 5 most-used) → assert the most-used (youngest) tag surfaces on the Overview "Top Tags" strip; buggy `listMostPopular` paginates oldest-by-id first. `known-bugs` + I7.
- ✅ **IT-006** SPA error boundary — F-042 / TEST-GAP-1013: inject a malformed dashboard payload (fix-independent render throw) → assert `#root` (app shell/nav) survives = containment; today the whole app white-screens. `known-bugs` + I9.

**Tier 2 — needs a container restart / storage infra:**
- ✅ **IT-007** Attachment LSN-001 durability (I2, F-027 / PLT-086) — upload a file (real REST upload flow) → recreate the platform container (`helpers/docker.recreatePlatformContainer`, `--force-recreate --renew-anon-volumes --no-deps`) → file gone under LOCAL (`/tmp/odd/attachments`) while the DB record survives = data loss. **Authored + RED-confirmed 2026-06-02.** `known-bugs` + I2. (Driven via REST not the UI: the bug is storage durability — the user-observable loss is the failed download, same call the UI makes — and the attachments UI may be permission-gated under DISABLED; the real container-recreate is what makes it an integration test, not a probe.)
- ✅ **IT-008 + MinioConfigRegionTest** Attachment LSN-002 region (TEST-GAP-052, F-027 / PLT-086 Defect 2) — **done 2026-06-02, reframed by the evidence.** Built the REMOTE/MinIO stack (`odd-minio.docker-compose.yml`, MinIO @ eu-west-1) and ran the real upload/download: **it SUCCEEDED** — minio-java 8.6.0 auto-discovers the bucket region via GetBucketLocation, so a vanilla MinIO does NOT reproduce LSN-002 (the real bug needs AWS S3 + least-privilege IAM). So LSN-002 is pinned **structurally** as an odd-platform unit test (`MinioConfigRegionTest`, `@regresses PLT-086`: MinioConfig must set `.region(...)` from `attachment.remote.region`; RED until fixed — awaiting gradle), and the MinIO stack was salvaged as **IT-008** (REMOTE round-trip, GREEN — net-new F-027 REMOTE coverage, `feature-complete`+I2). Lesson: a planned integration repro that can't actually reproduce the bug → pin at the cheapest reliable layer (structural unit), don't ship a false-GREEN integration test.

**Tier 3 — needs auth-mode stacks + an IdP (the biggest lift — a dedicated infra batch, NOT a quick spec):**
- ✅ **IT-009 auth-mode boundary (ADR-0074 / TEST-GAP-778)** — done + GREEN 2026-06-02. The foundational contract: DISABLED open vs LOGIN_FORM authenticated. Built the LOGIN_FORM stack (`odd-loginform.docker-compose.yml`) + the generic multi-stack helper (`helpers/stack.ts`). `feature-complete` + I1.
- ✅ **IT-010 LDAP RBAC enforcement (ADR-0002/0003)** — done + GREEN 2026-06-02. Built a local LDAP stack (`odd-ldap.docker-compose.yml`: osixia/openldap + init-seeded non-admin `alice` + `AUTH_TYPE=LDAP`). A non-admin USER → `DELETE /api/owners/999999` → **403** (SECURITY_RULES enforced; the only local mode that exercises the AuthorizationCustomizer). `feature-complete` + I1. **Reframing finding (resolved the LSN-002-style uncertainty): there is NO ADMIN bypass** — authz resolves permissions from policies, so a fresh USER is denied every gated mutation, and the would-be "RBAC bug" pins below are mostly **documented postures**, not clean bugs:
  - F-027 H-004 attachment read-openness — reads have no SECURITY_RULE → any authenticated USER reads; this IS the read-collaborative posture (ADR-0003). A "bug" pin would assert against the documented design (murky). Confirmed/documented (PLT-086 / DOC-253), not pinned RED.
  - F-039 H-001 genai no-authz — genai disabled by default (ADR-0004); needs genai+LLM-stub to exercise. Deferred.
  - F-011 H-003 LOGIN_FORM everyone-admin — the documented ADR-0074 LOGIN_FORM consequence (rules inert); not a clean RED.
  - F-027 H-005 cross-entity mutation escalation (PLT-086) — a genuine clear bug, but needs TWO users + per-entity ownership/policies (the heaviest setup). The cleanest future RED if pursued.
- ✅ **IT-011 notifications WAL lifecycle (ADR-0040/0044)** — done + GREEN 2026-06-02. Built the notifications stack (`odd-notifications.docker-compose.yml`: postgres `wal_level=logical` + `NOTIFICATIONS_ENABLED` + webhook stub). OFF→no slot, ON→slot+publication on `alert` lazily created. `feature-complete` + I3. **Found + filed a real bug (PLT-139):** the WAL subscriber wedges permanently on fresh boot when the slot is created before the publication (`publication does not exist`), unrecoverable (no DROP path) → silent notification death; flaky/timing-dependent. The full delivery chain (alert→WAL→webhook ~4s) is proven manually but, being wedge-flaky, is not the automated gate.
  - ✅ **IT-012 advisory-lock FAILOVER (ADR-0043)** — done + GREEN 2026-06-02. 2-replica `odd-notifications-ha` stack: kill the leader → the standby acquires advisory lock 100 (~2s). Confirmed + strengthened PLT-139 (the wedge flaps the lock → no stable leader cluster-wide; IT-012 un-wedges first).
  - ⏳ **Remaining I3 depth (optional):** the PLT-016 RED pins — poison-message stall (TEST-GAP-455), silent thread-death (TEST-GAP-796), fail-soft fan-out (one throwing sender must not abort siblings). These need fault injection (a malformed alert row / a thread kill / a throwing sender), and are best authored AFTER PLT-139 is fixed (a wedged subscriber confounds poison/thread observation). A further sub-batch.

**Quarantine:** known-open-bug pins → `known-bugs` suite (expected RED); `feature-complete` stays green (passing pins only). A fix flips the pin → move it to `feature-complete` = measurable closure.
**Selector grounding:** UI-interaction specs mirror the proven selectors/page-objects in `odd-platform/tests/ui/` (read to learn; author self-contained in `integration-tests/e2e/`).

---

## Alignment-ingestion status (2026-06-02) — what makes this work COUNT in `/align`

The tests above are BUILT, but the `/align` scorecard (Dimension D RED) does not yet credit most of them. Three gates between "authored" and "counted":

1. **Substrate behind code HEAD** (scorecard blocker [A]): scan `ede5d277` @ 2026-05-26 vs odd-platform HEAD `2febc791`. The unit gate-map merges onto Test NODES, which only exist after a re-scan. → **re-run the substrate scan** to refresh tests + code to HEAD.
2. **Unit pins are on an unmerged branch** `test/adr-enforcement-units` (odd-platform): U1 `FeatureGatingDefaultsTest` (ADR-0075/0004/0040/0046), U2 `DependencyPostureTest` (ADR-0071/0072), `MinioConfigRegionTest` (PLT-086/LSN-002), `AdrContractScanTest` (ADR-0002/0007). Forward-declared in `test-gates.yaml` (this session). → **gradle-verify + merge the branch**, then re-scan → "ADRs with an enforcing test" 2/27 → ~8/27.
3. **Integration tests (IT-001..012) ingestion — ✅ FIXED this session.** The extractor (`extractors/tests.py::_ingest_integration_protocols`) now ingests `integration-tests/protocols/*.md` as Test nodes, reading their frontmatter `gates:` (validates/enforces/regresses) → projected as ENFORCES/VALIDATES/REGRESSES edges. tests-ingest also picked up the 4 unit pins (the live odd-platform checkout is the branch HEAD `b1fc1825`) + merged their `test-gates.yaml` entries. **Measured lift (re-ran `/align`):** "ADRs with an enforcing test" **2/27 → 14/27**; "features with a validating test" **38 → 41**; Test nodes **66 → 82**, **0 orphan**; embeddings rebuilt (7659). Done.

**What still gates the verdict (PILOT-READY → READY):**
- **[A] code substrate behind HEAD** — tests-ingest read the live checkout, but the CODE sidecars/nodes are still `ede5d277`; a full code re-scan (heavy) + merging `test/adr-enforcement-units` clears it.
- **[E] reflection coverage 23/112** — the DEEPEST blocker; the trust gate discounts every metric by it. Raising it (more `/reflect-feature` on ADR-bearing features) is what proves alignment "enough to proceed". Tests are necessary, not sufficient.
- **Finer Dimension-D items:** "bugs/scopes with a regress test" did NOT move — the IT/unit `regresses:` targets are PLT-NNN issue ids, which don't resolve to `Finding`/landmine nodes (the metric counts Findings); mapping PLT→Finding (or adding LSN refs to the regress gates) would lift it. Also a pre-existing Java-parse quirk emits `DependencyPostureTest::name` (class-name regex misfire) so its gate-map entry doesn't merge — a 1-line extractor fix.

**Built so far (this session):** 12 integration protocols (IT-001..012; 7 RED known-bugs + 5 GREEN feature-complete, all run-verified) + 4 unit pins + 1 filed bug (PLT-139) + 1 ADR consequence (ADR-0072) + the integration-test ontology ingestion. Remaining path to "aligned enough": (a) gradle-verify + merge the unit branch + full code re-scan ([A]); (b) raise reflection coverage ([E]); (c) optional finer Dimension-D mappings (PLT→Finding regress, the parse quirk).
