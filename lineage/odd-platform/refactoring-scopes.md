---
artefact: refactoring-scopes
generated_at: "2026-05-11T10:00:00+02:00"
generated_at_commit: ede5d277
sidecar_count: 25
prompt_version: "adr-archaeologist/0.2.0"
total_scopes: 91
scopes_by_severity: { CRITICAL: 0, HIGH: 33, MEDIUM: 46, LOW: 12 }
scopes_by_category: { missing-auth: 10, missing-retry: 2, missing-rate-limit: 4, missing-sanitisation: 2, missing-audit: 4, missing-validation: 18, missing-pagination: 1, missing-quota: 1, missing-test: 4, buggy-default: 9, path-mismatch: 1, deferred-failure: 1, header-injection: 1, race-condition: 4, error-mapping: 2, observability: 5, missing-grace-period: 1, weak-rng: 1, plaintext-at-rest: 1, response-cache-leak: 1, idempotency: 1, transactional-consistency: 1, multi-instance-fs: 1, contract-typo: 1, enumeration-vector: 1, dual-path: 1, dead-code: 1, info-disclosure: 1, missing-fail-fast: 1, label-asymmetry: 1, batch-isolation: 1, missing-retention: 1, missing-doc-prereq: 1, timezone-implicit: 1, body-before-auth: 1, missing-constant-time: 1, duplicate-parse: 1, hard-coded-path: 1 }
batch_2026_05_10A_summary: { added_scopes: 23, strengthened_scopes: 4 }
batch_2026_05_10B_summary: { added_scopes: 24, strengthened_scopes: 1 }
---

# Refactoring scopes — odd-platform — 2026-05-11

## What's here

This file catalogues IMPLEMENTATION GAPS — absent features, missing
validation, unauthenticated calls, buggy defaults, observability holes,
race conditions — that the substrate surfaced from the per-node sidecars'
`bugs_limitations_corner_cases` blocks and from `concepts.yaml`'s
`security_aggregate.weaknesses` / `performance_aggregate.weaknesses`. Per
the wisdom test (Nygard 2011 / adr.github.io / AWS Prescriptive Guidance),
these findings DO NOT qualify as architectural decisions because (a) the
absence has no stated rationale in code or docs, and (b) addressing it is
refactoring within the existing structure rather than a structural change.

Each scope is an actionable refactoring item the maintainer triages into
the backlog. Suggested groupings appear at the bottom of each scope; common
groupings include `GenAI hardening sprint`, `Authorization audit batch`,
`OpenAPI contract hardening`, `Attachment quota enforcement`, `Controller
test bootstrap`.

These findings DO NOT belong in `adrs/drafts/`. The corresponding
`implicit-adrs.md` carries the actual ADR candidates (23 after the wisdom
test re-classified 7 of the previous run's "ADRs" as scopes — see
`implicit-adrs.md` "Reclassification trace").

## Summary

- **Scopes**: 91 total (0 CRITICAL, 33 HIGH, 46 MEDIUM, 12 LOW).
- **Refresh note (2026-05-10B batch — config-key-consumer layer)**: 24 new scopes added (REFACTOR-068..091) from 5 new sidecars (`AppInfoController.auth.type@L18`, `AuthorizationManagerCondition.auth.type@L11`, `CounterTimeSeriesExtractor.metrics.storage@L20`, `IngestionDataEntitiesFilter.auth.ingestion.filter.enabled@L20`, `ActivityTablePartitionManager.odd.activity.partition-period@L11`). 1 existing scope strengthened by verify-side corroboration: REFACTOR-048 (token plaintext-at-rest — `IngestionDataEntitiesFilter.java:56` plaintext `.equals(...)` confirms the comparison shape from the verify side; the rotate side established the storage shape, the verify side completes the model). No new CRITICAL findings. The 7 highest-leverage 2026-05-10B additions are: **REFACTOR-078 (default `POST /ingestion/entities` UNAUTHENTICATED — LSN-001-shape; docs do not surface `auth.ingestion.filter.enabled`, HIGH)**, **REFACTOR-082 (AlertManager sibling endpoint unprotected and misnamed property — `auth.ingestion.filter.enabled` reads as if it locks down 'ingestion' globally, HIGH)**, **REFACTOR-085 (NO RETENTION/DROP for activity table — code contradicts live doc "retention and partitioning" claim; silent monotonic growth, LSN-001-shape, HIGH)**, **REFACTOR-073 (no boot-time security-posture validator — triangulated across 3 sidecars: AppInfoController + AuthorizationManagerCondition + IngestionDataEntitiesFilter; HIGH)**, **REFACTOR-072 (LOGIN_FORM mode runs without `AuthorizationCustomizer` — no policy/permission enforcement under the documented "dev-mode" auth, HIGH)**, **REFACTOR-068 (`/api/appInfo` unauth fingerprinting under DISABLED default, HIGH)**, **REFACTOR-086 (silent-fail on partition CREATE failure — no metric, no health-check, HIGH)**. Additional HIGH: REFACTOR-074 (tenant-id label asymmetry write-vs-read on empty-string).
- **Refresh note (2026-05-10A batch)**: 23 new scopes added (REFACTOR-045..067) from 5 new sidecars (`regenerateCollectorToken`, `postMessageInSlack`, `getActivity`, `uploadFileChunk`, `getAllAlerts`). 4 existing scopes strengthened by additional `surfaced_by` evidence: REFACTOR-010 (cross-entity uploadId hijack — uploadFileChunk confirms), REFACTOR-011 (same-index race overwrite — uploadFileChunk confirms), REFACTOR-013 (size-enforcement bypass — uploadFileChunk confirms from chunk-path side), REFACTOR-024 (getAllAlerts cross-owner exposure — getAllAlerts directly surfaces with security gap HIGH per sidecar). No new CRITICAL findings; the 6 highest-leverage 2026-05-10A additions are: REFACTOR-045 (non-SecureRandom token RNG, HIGH), REFACTOR-046 (no token rotation audit log, HIGH), REFACTOR-048 (token plaintext-at-rest, HIGH), REFACTOR-049 (DISABLED-mode token-rotation bypass, HIGH conditional), REFACTOR-050 (Slack-posting no authz gate + cross-owner data_entity_id, HIGH), REFACTOR-053 (Activity feed cross-owner exposure under read-collaborative borderline, HIGH), REFACTOR-058 (chunk staging path is `attachment.storage`-INDEPENDENT — applies to LOCAL **and** REMOTE — extends REFACTOR-033, HIGH).
- **Re-run note (2026-05-08 base)**: 7 candidates from the slice-8 first run failed the wisdom test (no stated rationale; refactoring within existing structure) and were re-classified to scopes. The canonical case is the previous ADR-CANDIDATE-005 ("GenAI not authenticated outbound and not retried") → REFACTOR-001 + REFACTOR-002.
- **Top affected concepts** (from `concepts.yaml`):
  - **Collector / Token** (NEW concept-level severity from 2026-05-10A: HIGH overall): 8 scopes — non-SecureRandom RNG, no audit log, no grace period, plaintext-at-rest, DISABLED bypass, response-body cache leak, no rate-limit, non-`@ReactiveTransactional`.
  - **Data Collaboration / Slack messaging** (NEW concept-level severity from 2026-05-10A: HIGH overall): 7 scopes — no authz gate (cross-owner posting), no body validation, channel_id unscoped, no audit log, no inbound rate-limit, non-discriminating Slack rate-limit handling, caller cannot observe send failure.
  - **Activity feed** (NEW concept-level severity from 2026-05-10A: HIGH overall): 6 scopes — cross-owner exposure under borderline read-collaborative, lasEventId typo on public API contract, userIds/ownerIds enumeration vector, unbounded size, free-text description exposure, type=null vs type=ALL dual-path.
  - **GenAI Assistant** (security overall LOW): 8 scopes — auth, retry, rate-limit, sanitisation, audit-log, SSRF guard, per-user quota, anonymous-reach under DISABLED.
  - **Data Entity** (security overall LOW): 5 scopes — `/term` vs `/terms` path mismatch, no compile-time guard against drift, no observability at controller, lineage-depth unbounded, pagination unbounded.
  - **Attachment** (security + performance overall LOW): 11 scopes — server-side cap bypass (STRENGTHENED), cross-entity uploadId hijack (STRENGTHENED), race-overwrite of chunks (STRENGTHENED), Content-Disposition injection, LOCAL ephemeral default (LSN-001), LOCAL multi-instance broken, REMOTE us-east-1 pin (LSN-002), bucket pre-existence not validated, S3 creds in /actuator/env, NEW: chunk staging path is storage-INDEPENDENT, NEW: NumberFormatException leak, NEW: chunk-dir pre-existence unverified.
  - **AlertManager Webhook Receiver** (security + performance overall LOW + MEDIUM): 5 scopes — silent orphan, timezone-naive timestamp, no rate-limit/dedup/payload-cap, hand-rolled DTO drops fields, generatorURL Prometheus-specific.
  - **Alert** (security LOW, performance MEDIUM): 3 scopes — `getAllAlerts` (STRENGTHENED) + `changeAlertStatus` ungated mutations, reopen-guard race-window.
  - **Locale Bundle** (security HIGH note: HIGH refers to the assertion that browser-internal-only is a strong-signal posture, not that there's a gap): 1 scope — `fallbackLng` six-element array bug.
  - **Directory** (security LOW, performance LOW): 1 scope — unmemoised reflection on `/api/directory/datasources?prefix={prefix}`.
  - **Authentication / boot-time posture (NEW 2026-05-10B; aggregated across THREE sidecars: AppInfoController + AuthorizationManagerCondition + IngestionDataEntitiesFilter)**: 6 scopes — `/api/appInfo` fingerprinting under DISABLED, empty/typo `auth.type` silent breakage, AuthorizationManagerCondition dead code, LOGIN_FORM bypasses AuthorizationCustomizer, no boot-time security-posture validator (triangulated), AppInfoController zero test coverage.
  - **Metric storage / Prometheus (NEW 2026-05-10B)**: 4 scopes — tenant-id label asymmetry, label PII pass-through, no retry/DLQ on remote-write, IllegalArgumentException rejects entire batch.
  - **Ingestion-token verification (NEW 2026-05-10B)**: 7 scopes — default-off unauthenticated ingestion, plaintext .equals not constant-time (corroborates REFACTOR-048), hard-coded path matcher, body-buffered-before-auth, AlertManager sibling unprotected + misnamed property, no failed-auth logging, duplicate body parse.
  - **Activity partition lifecycle (NEW 2026-05-10B)**: 7 scopes — no retention/DROP (LSN-001 shape, doc-contradiction), silent-fail swallow, no `@Min(1)` validation, advisory-lock-id no `:default` and undocumented, no observability, CREATE TABLE privilege undocumented, cron timezone-implicit.
- **Suggested sprint groupings** (highest-value bundles for backlog triage):
  - **GenAI hardening sprint** — REFACTOR-001..007 + REFACTOR-016 + REFACTOR-019 (8 scopes; 4 HIGH).
  - **Authorization audit batch** — REFACTOR-008..012 + REFACTOR-024 + REFACTOR-050 + **REFACTOR-072 + REFACTOR-073 (NEW 2026-05-10B)** (10 scopes; 7 HIGH; spans ActivityController, AlertController, DataCollaborationController, plus the cross-cutting LOGIN_FORM-bypasses-authorization gap and the boot-time security-posture-validator gap).
  - **Attachment integrity sprint** — REFACTOR-013, REFACTOR-025..030, REFACTOR-033..037, REFACTOR-058, REFACTOR-060, REFACTOR-061 (15 scopes; 8 HIGH including LSN-001/002 reactivations and the new storage-independent chunk-staging finding).
  - **Token rotation hardening (NEW 2026-05-10A)** — REFACTOR-045..049 + REFACTOR-062..065 (9 scopes; 4 HIGH; canonical case for the new ADR-CANDIDATE-017 and the most-impactful security work in batch 2026-05-10A).
  - **Data Collaboration hardening (NEW 2026-05-10A)** — REFACTOR-050..056 + REFACTOR-066 (8 scopes; 1 HIGH + 6 MEDIUM; opens with the cross-owner posting authz gap which is the highest-leverage fix).
  - **Activity feed hardening (NEW 2026-05-10A)** — REFACTOR-053 + REFACTOR-057 + REFACTOR-059 + REFACTOR-051 + REFACTOR-052 (6 scopes; 1 HIGH; closely paired with ADR-CANDIDATE-003 borderline triage).
  - **AlertManager hardening** — REFACTOR-017, REFACTOR-018, REFACTOR-031, REFACTOR-032 + **REFACTOR-082 (NEW 2026-05-10B — sibling-unprotected-by-misnamed-property)** (5 scopes; 2 HIGH).
  - **OpenAPI contract hardening** — REFACTOR-014, REFACTOR-044, REFACTOR-020 (3 scopes; 1 HIGH).
  - **Controller test bootstrap** — REFACTOR-021, REFACTOR-022, REFACTOR-023 + **REFACTOR-070 (NEW 2026-05-10B — AppInfoController zero coverage)** (4 scopes; 0 HIGH but high-leverage for catching all of the above).
  - **Authentication / boot-time security posture hardening (NEW 2026-05-10B)** — REFACTOR-068..073 (6 scopes; 4 HIGH; the cross-cutting triangulated gap REFACTOR-073 is the highest-leverage anchor — a boot-time security-posture validator would catch REFACTOR-068, -069, -071, -072 as side-effects).
  - **Ingestion-endpoint auth hardening (NEW 2026-05-10B)** — REFACTOR-078..084 (7 scopes; 2 HIGH; canonical case for the new ADR-CANDIDATE-027 — the trust-gradient codification + the docs-don't-surface-the-toggle LSN-001-shape).
  - **Metric storage hardening (NEW 2026-05-10B)** — REFACTOR-074..077 (4 scopes; 1 HIGH; the tenant-id label asymmetry is the multi-tenant-leakage canonical case).
  - **Activity partition lifecycle hardening (NEW 2026-05-10B)** — REFACTOR-085..091 (7 scopes; 2 HIGH; opens with REFACTOR-085 the doc-contradicting "no retention" LSN-001-shape finding, the highest-leverage durability fix).

## Scopes

### HIGH severity

- **REFACTOR-001**: GenAI outbound HTTP requests carry no authentication header — no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`, no `apiKey`/`token` field on `GenAIProperties`
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[4]` (originally classified as ADR-CANDIDATE-005 in run 0.1.0; reclassified per wisdom test)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[3]` ("No outbound authentication sent to {genai.url} — operators must put external service on a trusted network or front it with their own auth proxy")
  - **Statement**: The platform forwards user-supplied prompts to an operator-supplied URL with NO Authorization header, NO bearer token, NO API key. `GenAIProperties.java:8-12` declares only `enabled`, `url`, `requestTimeout` — no auth field. `WebClientConfiguration.java:26-29` builds the WebClient with no `defaultHeader(...)`. The absence has no stated rationale in code or comments — the maintainer didn't decide to skip outbound auth; it just isn't there. (Contrast with ADR-CANDIDATE-006 / AlertManager: there, the absence is *deliberately* documented in the live security doc as operator-network-delegated.)
  - **Evidence**: `WebClientConfiguration.java:26-29` (no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`) + `GenAIProperties.java:8-12` (no `apiKey` / `token` / `auth` fields)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (GenAI thin-proxy stance) does NOT defend the absence of outbound auth — "thin proxy" defends the absence of *prompt enrichment*, not the absence of authentication. No governing ADR. The live GenAI doc page acknowledges the gap ("The platform sends no authentication to the external service") but is descriptive, not prescriptive.
  - **Proposed remedy**: Add an `apiKey: String` field to `GenAIProperties` (optional, with `@Nullable` annotation); when set, `WebClientConfiguration` injects a `defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + key)` via Spring's standard pattern. Document the field in the live config-doc admonition.
  - **Severity rationale**: HIGH — operators deploying GenAI assuming the platform handles outbound auth are exposed (egress from the platform pod, no authentication on the LLM call). The previous run mis-classified this as an architectural decision; per Rule 0, the absence is a gap.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-002**: GenAI outbound calls have no retry / backoff / circuit-breaker on transient upstream failure
  - **Category**: missing-retry
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[4]` (originally bundled with REFACTOR-001 in ADR-CANDIDATE-005 of run 0.1.0)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:performance.known_performance_gaps.[1]`
    - `concepts.yaml:entities[GenAI Assistant].performance_aggregate.weaknesses.[1]`
  - **Statement**: The Mono pipeline at `GenAIServiceImpl.java:41-51` has `.onErrorResume(...)` that translates errors into `GenAIException`, but NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `genai.url` produces an immediate 500 to the caller; the caller must retry from outside. Combined with the per-request HTTP cost (potentially seconds-to-minutes), this amplifies user-visible latency variance.
  - **Evidence**: `GenAIServiceImpl.java:41-51` (no retry operator)
  - **Existing-ADR-or-implied-prescription**: None. Thin-proxy stance does not defend retry-absence; retry is request-routing reliability, not "prompt engineering" or "RAG" (which the proxy stance explicitly delegates).
  - **Proposed remedy**: Add `.retryWhen(Retry.backoff(maxAttempts, minBackoff).filter(this::isTransient))` on the WebClient call; expose `genai.retry.max-attempts` (default 3) and `genai.retry.min-backoff-millis` (default 200) via `GenAIProperties`. Document in the live config-doc.
  - **Severity rationale**: HIGH — for a feature whose latency floor is seconds-to-minutes, a single transient upstream blip surfacing as a 500 is operationally hostile.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-003**: GenAI endpoint has no rate-limit, no per-user quota, no abuse-detection
  - **Category**: missing-rate-limit
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[5]`
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[4]` ("No per-user / global rate limit, no abuse-detection — authenticated user can issue unbounded prompts; combined with no @Size on GenAIRequest.body this is DoS + unbounded-cost surface")
  - **Statement**: Every authenticated user can fire prompts at the LLM at maximum throughput. There is no `@Throttle` annotation, no `Bucket4j` integration, no distributed token bucket, no per-user spend cap. Combined with no `@Size` on `GenAIRequest.body` and only the implicit `spring.codec.max-in-memory-size: 20MB` ceiling, this is a denial-of-service surface AND an unbounded-cost surface (operators billing per token at the LLM see N×bill from N concurrent users).
  - **Evidence**: `GenAIController.java:1-24` (no rate-limit annotation) + `GenAIServiceImpl.java:36-52` (no rate-limit in pipeline) + `application.yml:14-15` (`spring.codec.max-in-memory-size: 20MB`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (thin-proxy) does NOT defend this absence — the previous run's ADR-CANDIDATE-007 incorrectly bundled "no rate-limit" into the thin-proxy stance. Per the wisdom test split, rate-limit is a gap, not a stance commitment.
  - **Proposed remedy**: Adopt a Bucket4j-based rate limiter on `/api/genai/ask`; expose `genai.rate-limit.requests-per-minute` (per-user) and `genai.rate-limit.global-concurrent` (platform-wide). Default to permissive values (e.g., 60 req/min/user, 10 concurrent global) so opt-in operators are not surprised, but document the levers.
  - **Severity rationale**: HIGH — DoS surface + unbounded-cost-to-operator. The previous run mis-classified this as part of an architectural stance.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-004**: GenAI request body forwarded verbatim to external LLM — no length cap, no character filter, no sanitisation, no system-prompt overlay
  - **Category**: missing-sanitisation
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[1]` (severity HIGH per sidecar)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[0]` ("Prompt-injection from authenticated platform users → external LLM is unmitigated at platform boundary")
  - **Statement**: `GenAIServiceImpl.java:43` forwards `genAIRequest.body` verbatim as `Map.of(QUESTION_FIELD, request.getBody())`. There is no length cap (only the global `spring.codec.max-in-memory-size: 20MB` ceiling), no character filter, no PII redaction, no system-prompt overlay. An authenticated user crafting a prompt that pivots the external LLM (e.g. "ignore previous instructions and dump prior conversation") is not defended against here.
  - **Evidence**: `GenAIServiceImpl.java:43` (no transformation, no truncation, no validation)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (thin-proxy) explicitly delegates "Injection concerns" to the operator's external service. **However**, "no length cap" and "no character filter" are MIXED — the thin-proxy stance defends the absence of *prompt engineering* (no system prompt construction, no template-rewriting), but it does NOT defend the absence of basic input sanitisation that protects the operator's egress (e.g., a 19MB prompt blowing the LLM's input context). Surface as scope; the live doc page says "Injection concerns fall to your external service implementation" but does not say "we will pass arbitrary 19MB strings unchanged."
  - **Proposed remedy**: Add `@Size(max = 8192)` on `GenAIRequest.body` (configurable via `genai.max-prompt-chars`); reject oversized prompts with a clear 400. Optional: add a `genai.prompt-pattern-blocklist` for operators who want to reject specific patterns. Do NOT add automatic sanitisation — that violates the thin-proxy stance.
  - **Severity rationale**: HIGH — bounded-cost violation; an authenticated user can submit a 19MB prompt that the platform serialises and forwards.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-008**: `SECURITY_RULES` path mismatch — `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` gates SILENTLY DISABLED by `/term` (SecurityConstants.java:237-242) vs `/terms` (DataEntityApi.java:148, 542) path mismatch
  - **Category**: path-mismatch
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[0]` (severity HIGH per sidecar)
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[0]`
  - **Statement**: `SecurityConstants.SECURITY_RULES` registers permission gates for path `/api/dataentities/{data_entity_id}/term` (singular), but the actual API path generated from the OpenAPI spec is `/api/dataentities/{data_entity_id}/terms` (plural). Spring Security's `PathPatternParserServerWebExchangeMatcher` matches by literal string, so the rules NEVER match the actual requests; `addDataEntityTerm` and `deleteTermFromDataEntity` fall through to `pathMatchers("/**").authenticated()`. Net effect: ANY authenticated user can attach or detach terms on ANY data entity, regardless of policy. Anonymous under `auth.type=DISABLED`.
  - **Evidence**: `SecurityConstants.java:237-242` (path uses `/term`) + `DataEntityApi.java:128, 148` (POST `/api/dataentities/{data_entity_id}/terms`), `DataEntityApi.java:524, 542` (DELETE `/api/dataentities/{data_entity_id}/terms/{term_id}`) + `AuthorizationCustomizer.java:24-30` (path-pattern matcher loop + `.authenticated()` fall-through)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 prescribes "centralised SECURITY_RULES" — this scope is the canonical case-law for the trade-off the ADR's "path-string coupling" caveat warns about.
  - **Proposed remedy**: Update `SecurityConstants.java:237-242` to use the plural `/terms` path patterns matching the OpenAPI spec. Add an integration test that asserts a non-permission-holder receives 403 on `POST /api/dataentities/{id}/terms` (this would have caught the drift). Add a CI check or unit test that diff-walks SECURITY_RULES paths against generated `*Api` interface `@RequestMapping(value = ...)` annotations and fails on any path that has no matching mapping.
  - **Severity rationale**: HIGH — privilege-boundary leak. Has been live since the spec changed `/term` → `/terms`. The fix is a one-line change; the systemic fix (drift detection) is REFACTOR-009.
  - **Suggested backlog grouping**: `Authorization audit batch` (canonical bug — fix first)

- **REFACTOR-013**: `attachment.max-file-size` server-side enforcement bypass — chunked upload pipeline accepts streams of any size
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[4]` (severity HIGH — disk-fill flavour)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[1]` (HIGH per consumer + controller sidecars)
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[1]` + `security.known_security_gaps.[3]` (the chunk-path sidecar confirms the gap from inside the chunk-upload critical path: "DataEntityAttachmentController.java:54-62 reads no size, FileServiceImpl.java:58-67 calls `transferTo` without checking byte count")
  - **Statement**: `AttachmentServiceImpl.java:70-78` and `DataEntityAttachmentController.java:54-62` neither check accumulated chunk size against `maxFileSize`. The cap is purely a UI-side filter in the React `FileInput` component (`file.size <= maxFileSizeInBytes`). A non-browser client (curl, a script, a misbehaving SDK) can post arbitrary-size chunks. With `attachment.storage=LOCAL` (the default per `application.yml:216`), this becomes a host-disk-fill DoS surface — the cap is per-file (default 20 MB) but is enforced at the upload-options surface only, so a malicious or misbehaving client can ignore the advertised cap and stream chunks beyond it.
  - **Evidence**: `AttachmentServiceImpl.java:27-89` (no size guard in `uploadFileChunk` or `completeFileUpload`) + `DataEntityAttachmentController.java:54-62` (controller passes the chunk through without size validation) + `FileInput.tsx:39` (`file.size <= maxFileSizeInBytes` is the only filter before upload starts)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-016 (max-file-size as UX hint) deliberately exposes the cap to the UI but the absence of server-side re-validation is the gap-shaped split — the ADR does not defend it; the maintainer simply did not add server-side re-validation.
  - **Proposed remedy**: Track accumulated bytes across chunks for an `uploadId` (in `FileServiceImpl` or a dedicated `UploadSessionService`); reject the chunk that would exceed `maxFileSize * 1_000_000` with HTTP 413. Update integration tests to cover both (a) UI-side filter, (b) server-side enforcement.
  - **Severity rationale**: HIGH — both data-integrity (server cap is illusory) and operational (LOCAL host-disk fill).
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-016**: GenAI `genai.url` is operator-supplied with no allowlist, no scheme check, no SSRF guard, no `@URL` constraint
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[2]` (severity HIGH)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[1]`
  - **Statement**: `GenAIProperties.url` carries no validation annotations; `WebClientConfiguration.java:28` calls `baseUrl(genAIProperties.getUrl())` with no validation. An operator could set `genai.url=http://internal-only.corp/x` (or any internal-network URL); if config injection is achievable elsewhere (e.g. `application.yml` overlay, ConfigMap mutation), an attacker pivots the platform's egress.
  - **Evidence**: `GenAIProperties.java:10` (no validation annotations) + `WebClientConfiguration.java:28` (`baseUrl(genAIProperties.getUrl())` with no validation)
  - **Existing-ADR-or-implied-prescription**: None. The thin-proxy stance does not defend the absence of URL validation.
  - **Proposed remedy**: Add `@URL`, `@NotBlank`, and `@Pattern(regexp = "^https?://...")` on `GenAIProperties.url`. Optional: add `genai.url-allowlist` for operators who want to constrain to a known set of LLM endpoints. Add `@Validated` at the class level to engage Spring Boot's `@ConfigurationProperties` validation pipeline.
  - **Severity rationale**: HIGH — SSRF surface. An attacker landing config injection can use the platform as a confused deputy to reach internal services.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-019**: Under `auth.type=DISABLED`, `/api/genai/ask` is anonymously reachable; no fail-closed behaviour, no startup warning when `DISABLED` + `genai.enabled=true`
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[4]` (severity HIGH)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[2]`
  - **Statement**: `auth.type=DISABLED` (the `application.yml:34` default) + `genai.enabled=true` produces an LLM proxy reachable from any caller able to reach the platform's HTTP port. There is no fail-closed behaviour in the controller, no startup banner log warning, no `@ConditionalOnProperty(value = "genai.enabled", havingValue = "true") + @ConditionalOnExpression("'${auth.type}' != 'DISABLED'")` guard.
  - **Evidence**: `GenAIController.java:1-24` (no auth-mode check) + `DisabledAuthSecurityConfiguration.java:10` + `application.yml:34` (`auth.type: DISABLED` is the shipped default — but see `application.yml:18` ships `genai.enabled: false`, so the dangerous combination is not the default).
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-004 (GenAI disabled-by-default + fail-fast-on-misconfig) prescribes the fail-fast posture. This scope is a gap *under* that ADR — fail-fast happens at request time when `url`/`requestTimeout` are unset, but there is no fail-fast for the orthogonal misconfiguration "auth.type=DISABLED + genai.enabled=true."
  - **Proposed remedy**: Add a `@PostConstruct` startup check in `GenAIServiceImpl` (or a dedicated `GenAIStartupValidator`): if `auth.type=DISABLED` AND `genai.enabled=true`, log a WARN-level banner and fail boot under a `genai.fail-on-disabled-auth: true` flag (default false for backward compatibility, recommended true in the live config-doc).
  - **Severity rationale**: HIGH — defense-in-depth. The platform's fail-fast posture (ADR-CANDIDATE-004) is undermined by the absence of this orthogonal check.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-024**: `getAllAlerts` returns the entire platform's alert stream to ANY authenticated user — no admin gate, no role check
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM in sidecar but HIGH at concept-aggregate level)
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[0]` (severity HIGH)
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__AlertController__controller-method__getAllAlerts.md:bugs_limitations_corner_cases.[0]` + `security.known_security_gaps.[0]` (severity HIGH per sidecar — the controller-method sidecar elevates the finding to HIGH and adds the doc-drift signal: live alerting page says "stewards and admins watching the full alert surface" while code permits any authenticated user, sharpening the borderline question for ADR-CANDIDATE-003)
  - **Statement**: `AlertController.getAllAlerts` (the "All" tab) returns the cross-tenant alert stream with no admin gate, no role check. `SecurityConstants.SECURITY_RULES` has no entry for `/api/alerts`; the path falls through to `.authenticated()`. Owner-scoping is enforced only on `/api/alerts/my` and `/api/alerts/dependents` via reactor `Context`. The downstream `listAll → listAllWithStatusOpen` query is a flat `WHERE STATUS = OPEN` jOOQ select with no owner join (`ReactiveAlertRepositoryImpl.java:143-156`).
  - **Evidence**: `AlertController.java:35-41` (no security annotations, raw delegation to `alertService.listAll`) + `SecurityConstants.java:98-355` (no `/api/alerts` matcher) + `ReactiveAlertRepositoryImpl.java:143-145` (no owner predicate) + WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-10 (live-page recommends tab for "stewards and admins" — code does not enforce that audience).
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative catalog, BORDERLINE) MAY defend this — if "any authenticated user reads any data entity's alerts" is the intentional posture, then "any authenticated user reads cross-tenant alert stream" is the same posture applied to the alert listing. **However**, this scope is exactly the kind of finding that should make the maintainer think hard about whether ADR-CANDIDATE-003 is a real ADR or a missed-gate scope. The live-doc audience-vs-code-enforcement divergence (NEW signal from 2026-05-10A) is the strongest evidence the borderline should resolve toward "missed gate" rather than "intentional posture." Surface for triage.
  - **Proposed remedy**: Either (a) add an `ALERTS_LIST_ALL` permission and a SECURITY_RULES entry; or (b) confirm ADR-CANDIDATE-003's read-collaborative posture and document this endpoint as covered by it on the live `/configuration-and-deployment/enable-security/authorization` page AND fix the alerting page's "stewards and admins" wording. The choice is the maintainer's; surface, do not auto-fix.
  - **Severity rationale**: HIGH — depending on triage decision, either a privilege-boundary leak or a doc-gap.
  - **Suggested backlog grouping**: `Authorization audit batch` (paired with ADR-CANDIDATE-003 triage)

- **REFACTOR-025**: `changeAlertStatus` accepts mutation with no permission gate — any authenticated user can resolve/reopen any alert by id
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:security.known_security_gaps.[0]` (severity HIGH per sidecar)
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[1]` (severity HIGH)
  - **Statement**: `PUT /api/alerts/{alert_id}/status` carries no `@PreAuthorize`, no `permissionService.hasPermission(...)` call, and no SECURITY_RULES entry. Combined with the deliberate "mutations are gated" posture (ADR-CANDIDATE-002), this is a clear rule-violation, not a posture-choice — every other mutation is gated; this one isn't.
  - **Evidence**: `AlertController.java:1-58` (no security annotations) + `SecurityConstants.java:98-355` (no `/api/alerts/{alert_id}/status` matcher; only `DATASET_FIELD_ADD_TERM` for the per-entity halt-config mutation)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) prescribes "every mutating endpoint is one row in SECURITY_RULES." This scope is a **violation** of that ADR — a missing row for `changeAlertStatus`.
  - **Proposed remedy**: Add a SECURITY_RULES entry for `PUT /api/alerts/{alert_id}/status` mapped to a new `ALERT_STATUS_UPDATE` permission. Define the policy semantics — does this require ALERT-RESOLVE on the data entity the alert is attached to, or platform-wide ALERT_STATUS_UPDATE? Maintainer call.
  - **Severity rationale**: HIGH — privilege-boundary leak; explicitly violates ADR-CANDIDATE-002.
  - **Suggested backlog grouping**: `Authorization audit batch`

- **REFACTOR-026**: LSN-001 reactivation — LOCAL attachment storage default writes to ephemeral `/tmp/odd/attachments`; container restart wipes all uploaded files
  - **Category**: buggy-default
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[4]` (related)
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[0]` (severity HIGH)
  - **Statement**: `application.yml:218-219` ships `attachment.local.path: /tmp/odd/attachments`. Kubernetes pod restart, Docker `docker stop`/`docker rm`, and most container schedulers wipe `/tmp` on container lifecycle events. The live doc page documents this and recommends `/var/lib/odd/attachments` + a persistent volume; the YAML still ships the ephemeral default. This is the canonical retrospective for the entire workspace's "danger of unsafe defaults" line.
  - **Evidence**: `application.yml:218-219` + `LocalFilePathConstructor.java:14-23` + `retrospectives/LSN-001-attachment-ephemeral-default.md`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-012 (attachment-storage `@ConditionalOnProperty` boot-time wiring) does NOT defend the ephemeral default — the ADR is about the *wiring mechanism*, not the *path value*. The default path is a gap; the maintainer didn't decide `/tmp/odd/attachments` was a safe production default.
  - **Proposed remedy**: Change `application.yml:218-219` default to `/var/lib/odd/attachments` (matches the live doc). Update Helm chart / Docker Compose examples to declare the volume mount. Update LSN-001 retrospective with the post-fix state.
  - **Severity rationale**: HIGH — production-data-loss; the canonical case the entire workspace exists to catch.
  - **Suggested backlog grouping**: `Attachment integrity sprint` (priority 1)

- **REFACTOR-027**: LSN-002 reactivation — REMOTE on AWS S3 silently restricted to `us-east-1` (MinIO SDK `MinioAsyncClient.builder()` omits `.region(...)`)
  - **Category**: buggy-default
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[2]` (severity HIGH)
  - **Statement**: `MinioConfig.minioClient()` constructs `MinioAsyncClient.builder()` with `.endpoint()` + `.credentials()` only, never `.region(...)`. The MinIO SDK defaults the region to `us-east-1` for SigV4 signing; AWS S3 buckets in any other region reject the request with `AuthorizationHeaderMalformed` or `PermanentRedirect`. Self-hosted MinIO is unaffected because it ignores the region header.
  - **Evidence**: `MinioConfig.java:19-25` (no `.region(...)` call) + `retrospectives/LSN-002-minio-region-unset.md`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-013 (REMOTE = MinIO SDK only) is the architectural decision; this scope is the canonical retrospective for "what breaks when you assume MinIO-SDK semantics on AWS S3."
  - **Proposed remedy**: Add `attachment.remote.region: ""` to `application.yml`; in `MinioConfig.minioClient()`, call `.region(...)` when non-empty. Document on the live `configuration-and-deployment/odd-platform` page as a required field for AWS deployments.
  - **Severity rationale**: HIGH — silent us-east-1 lock-in for AWS-deploying operators.
  - **Suggested backlog grouping**: `Attachment integrity sprint` (priority 2)

- **REFACTOR-028**: REMOTE attachment storage — bucket existence not validated at boot; first-upload-failure pattern
  - **Category**: deferred-failure
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[2]` (severity MEDIUM in sidecar)
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[5]`
  - **Statement**: `RemoteFileUploadServiceImpl.validate()` only checks the bucket *name* is non-empty (line 46-50). An operator who mistypes the bucket or points at a non-existent one boots cleanly and only sees the failure on the first upload, by which time the upload UI has accepted the file and consumed user time. This was originally classified as ADR-CANDIDATE-017 in run 0.1.0; per the wisdom test, the absence has no stated rationale (no comment defends "we don't validate at boot") and is refactoring within `MinioConfig` / `RemoteFileUploadServiceImpl`.
  - **Evidence**: `MinioConfig.java:1-26` (no bucket-creation call) + `RemoteFileUploadServiceImpl.java:45-50` (only validates non-empty, not existence)
  - **Existing-ADR-or-implied-prescription**: None defends the absence. ADR-CANDIDATE-012 (boot-time wiring) doesn't defend it; the wiring decision is about Spring `@ConditionalOnProperty` shape, not bucket-validation.
  - **Proposed remedy**: Add `@PostConstruct` health check in `MinioConfig` (or a dedicated `RemoteStorageStartupValidator`) that calls `minioClient.bucketExists(BucketExistsArgs.builder().bucket(...).build())` and fails boot if the bucket is missing. Optional: under `attachment.remote.auto-create-bucket: true`, call `makeBucket` instead.
  - **Severity rationale**: HIGH (concept-level severity from concepts.yaml) — operators see "platform is up" but uploads are broken until they hit a real upload.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-029**: S3 credentials (`attachment.remote.access-key`, `attachment.remote.secret-key`) exposed via `/actuator/env` by default
  - **Category**: missing-validation (config-leak)
  - **Surfaced by**:
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[2]` (severity HIGH)
  - **Statement**: With Spring Boot Actuator's standard exposure list and `endpoint.env.enabled: true`, `/actuator/env` returns the values of `@Value`-injected properties. Spring's default key-pattern sanitisation masks values matching `password|secret|key|token` by name, but the keys themselves leak (path + endpoint exposure). Operators who forget to disable `/actuator/env` (or who whitelist it for ops tooling) leak the creds' presence + the configuration shape.
  - **Evidence**: `MinioConfig.java:14-17` (`@Value("${attachment.remote.access-key}")` + `@Value("${attachment.remote.secret-key}")`) + Spring Boot Actuator default config
  - **Existing-ADR-or-implied-prescription**: None. The attachment-storage ADRs do not address the actuator exposure.
  - **Proposed remedy**: Document the actuator exposure on the live config page; recommend `management.endpoint.env.show-values: WHEN_AUTHORIZED` (Spring Boot 3 default but worth the explicit override). Optional: integrate with Spring Cloud Config / Vault — see REFACTOR-030.
  - **Severity rationale**: HIGH (concept-level) — credentials leak via standard actuator endpoint.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-033**: Multi-instance LOCAL attachment storage broken — chunk staging directory keyed by `uploadId` only, no replica id; cross-replica chunk assembly is undefined
  - **Category**: race-condition
  - **Surfaced by**:
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[1]` (severity HIGH)
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
  - **Statement**: For LOCAL storage, chunk staging is a per-instance filesystem path. A horizontally-scaled deployment with LOCAL storage produces intermittent failures whenever the load balancer routes `uploadFileChunk` and `completeFileUpload` to different instances. REMOTE (S3) is shared by construction.
  - **Evidence**: `LocalFileUploadServiceImpl.java:32-52` + `RemoteFileUploadServiceImpl.java:53-77` (both use `FileUtils.getChunkDirectory(uploadId)` which is local-fs)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-012 (boot-time wiring) does not address multi-instance deployment.
  - **Proposed remedy**: Document on the live config page that LOCAL storage requires single-instance deployment OR a shared volume mount. Optional: add a `attachment.local.shared-volume: true` flag that switches off the per-instance assumption (no-op for now, advisory only).
  - **Severity rationale**: HIGH (concept-aggregate) — silent failure mode on multi-instance LOCAL deployments.
  - **Suggested backlog grouping**: `Attachment integrity sprint`
  - **NEW — see also REFACTOR-058 (2026-05-10A)**: Per uploadFileChunk sidecar, the chunk staging path constant `FileUtils.CHUNK_BASE_PATH = "/tmp/odd/chunks"` is **storage-backend-INDEPENDENT** — REMOTE deployments share the same per-instance failure mode. REFACTOR-033 captures the LOCAL-storage flavour; REFACTOR-058 generalises the finding to REMOTE storage.

- **REFACTOR-018**: AlertManager payload silent orphan — alert missing `entity_oddrn` label is accepted, persisted with null `data_entity_oddrn`, returns 204; caller has no signal of misconfiguration
  - **Category**: error-mapping
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[0]` (HIGH)
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[3]`
  - **Statement**: `externalAlert.getLabels().get("entity_oddrn")` returns null for missing key; no null-check before `.setDataEntityOddrn(...)`. Controller returns 204 No Content unconditionally. Operators relying on AlertManager's notification-success signal cannot detect this misconfiguration.
  - **Evidence**: `AlertServiceImpl.java:178` + `AlertManagerController.java:25` (`.map(o -> ResponseEntity.noContent().build())`)
  - **Existing-ADR-or-implied-prescription**: None defends silent acceptance.
  - **Proposed remedy**: Reject AlertManager payloads where any alert is missing `entity_oddrn` with HTTP 400 + an explanatory body. Optional: support a partial-success mode where each alert reports its routing outcome.
  - **Severity rationale**: HIGH (per sidecar) — silent data loss for operators.
  - **Suggested backlog grouping**: `AlertManager hardening`

- **REFACTOR-044** (formerly part of ADR-CANDIDATE-021 in run 0.1.0): Lineage endpoints accept unbounded `lineageDepth` and unbounded `expandedEntityIds` at the controller — no `@Max`, no `@Size`, no clamp
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:bugs_limitations_corner_cases.[0]` (HIGH)
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses.[1]`
  - **Statement**: `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` declare `Integer lineageDepth, List<Long> expandedEntityIds` with no constraints. A caller passing `lineageDepth=1000000` triggers a `LineageService` traversal bounded only by whatever (if any) limit the service enforces. The previous run classified this as ADR-CANDIDATE-021 ("the back-end trusts the UI"); per the wisdom test, "trust the UI" is not a defensible architectural stance for a public API — it's a missing validation.
  - **Evidence**: `DataEntityController.java:256-273, 308-313, 368-371` + `openapi.yaml:1260-1276` + `components.yaml:2033-2065`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add `@Max(20)` (or whatever the production-realistic ceiling is) on `lineageDepth` at the controller; add `@Size(max = 1000)` on `expandedEntityIds`. Update the OpenAPI spec's `lineageDepth` parameter to declare `maximum: 20`.
  - **Severity rationale**: HIGH (concept-aggregate) — DoS surface on the platform's hottest endpoint.
  - **Suggested backlog grouping**: `OpenAPI contract hardening`

- **REFACTOR-045** (NEW 2026-05-10A): Collector token entropy uses non-cryptographically-secure RNG — `RandomStringUtils.randomAlphanumeric(40)` delegates to `ThreadLocalRandom` (commons-lang 3.16+), not `SecureRandom`
  - **Category**: weak-rng
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[4]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[1]` (severity HIGH)
  - **Statement**: `TokenGeneratorImpl.java:39, 49` calls `setValue(RandomStringUtils.randomAlphanumeric(40))`. Without an explicit Random argument, commons-lang 3.16+ uses `ThreadLocalRandom` — a non-cryptographically-secure PRNG. The token is the shared secret authenticating ALL ingestion against the platform; a predictable RNG seed (process startup time, easy to recover via JVM lifecycle telemetry) reduces the brute-force surface from ~238 bits (alphanumeric × 40) to whatever the seed entropy provides. The `commons-lang 3.16+` `RandomStringUtils.secure().nextAlphanumeric(40)` (or explicit `new SecureRandom()`) would be the security-grade source.
  - **Evidence**: `TokenGeneratorImpl.java:39, 49` (`RandomStringUtils.randomAlphanumeric(40)` — no Random arg)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (NEW 2026-05-10A — token rotation semantics) implicitly assumes the token is "long-random opaque string" — high entropy is a precondition for the plaintext-equality model. This scope is a direct violation of the implicit precondition: the token is "long" (40 chars) but not necessarily "random" in the cryptographic sense.
  - **Proposed remedy**: Replace `RandomStringUtils.randomAlphanumeric(40)` with `RandomStringUtils.secure().nextAlphanumeric(40)` (commons-lang 3.16+) OR explicit `new SecureRandom()` injected into TokenGeneratorImpl. Add a unit test asserting the chosen RNG is `SecureRandom`-backed.
  - **Severity rationale**: HIGH — defeats the implicit precondition of the platform's S2S authentication model. The fix is one line; the absence of the fix has no defending rationale.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-046** (NEW 2026-05-10A): Collector token rotation is not audit-logged — no `log.*` call on the regenerate path; the `TOKEN.updated_by` column is the only forensic trail and is overwritten on each rotation
  - **Category**: missing-audit
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[2]` (severity HIGH)
  - **Statement**: `grep` for `log.(info|warn|debug|error)` against CollectorController, CollectorServiceImpl, TokenGeneratorImpl, ReactiveTokenRepositoryImpl returned zero matches. The TOKEN row's `updated_by` column captures the actor username from `AuthIdentityProvider.getCurrentUser()` — the only forensic trail — but `updated_by` is overwritten on the next rotation, so the audit trail is single-state, not append-only. A security-incident review of "who rotated token X 30 days ago" cannot answer from production data.
  - **Evidence**: `TokenGeneratorImpl.java:28-52` (no log calls) + `CollectorServiceImpl.java:82-90` (no log calls) + `CollectorController.java:47-51` (no log calls)
  - **Existing-ADR-or-implied-prescription**: None defends the absence. ADR-CANDIDATE-017 (token rotation semantics) describes the structural decisions; audit logging is not part of those decisions and the absence is a gap.
  - **Proposed remedy**: Add INFO-level audit log at the regenerate boundary: `log.info("[token-rotation] collectorId={} actor={}", collectorId, currentUsername)`. Optionally append to a dedicated `audit_log` table for query-able forensic history (so rotation history beyond the most-recent state is recoverable). Document on the live `enable-security` page that rotation is logged.
  - **Severity rationale**: HIGH — investigation-readiness gap on a credential-rotation surface. An attacker who rotates collector tokens to disrupt ingestion (REFACTOR-049 + REFACTOR-064 amplifier path) leaves no application-side trail.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-047** (NEW 2026-05-10A): Collector token rotation has no grace period — in-flight ingestion using the previous token 401s the moment the UPDATE commits; no `previous_token` column, no `valid_until` window
  - **Category**: missing-grace-period
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[5]` (severity HIGH operational)
  - **Statement**: ADR-CANDIDATE-017's "in-place UPDATE" rotation model has a structural consequence: there is NO overlap window during which the old token still authenticates. The moment `UPDATE token SET value = ... WHERE id = :id` commits, every in-flight ingestion request using the old token starts 401-ing with `"Token is not correct"` (`IngestionDataEntitiesFilter.java:55-58` — single-value `String.equals(...)`). Operators rotating during active ingestion cause an outage that lasts until every collector picks up the new token (config-file change + restart). Neither the docs site nor the response body warns of this.
  - **Evidence**: `TokenGeneratorImpl.java:44-52` + `ReactiveTokenRepositoryImpl.java:30-39` + `IngestionDataEntitiesFilter.java:55-58`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 codifies the in-place UPDATE model. This scope is a structural consequence of the model, not a violation. The absence of defending documentation IS a gap (the operator has no warning); the absence of a grace-period mechanism is a feature gap (adding `previous_token` + `valid_until` would be a structural change requiring an extension ADR).
  - **Proposed remedy**: At minimum, document the operational consequence on a new "Token Rotation" doc section (under `enable-security`). At maximum, add a `previous_token` + `previous_token_valid_until` columns to the TOKEN table; modify `IngestionDataEntitiesFilter` to accept either the current or the (still-valid) previous token; expose `attachment.token.rotation-grace-minutes` as an operator config. The structural change requires extending or superseding ADR-CANDIDATE-017.
  - **Severity rationale**: HIGH — operational severity. Operators rotating during incident response can cascade into ingestion outages.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-048** (NEW 2026-05-10A; STRENGTHENED 2026-05-10B): Collector tokens stored in plaintext at rest in the `TOKEN` table — DB read, replica, backup, or jOOQ log carries credentials in the clear
  - **Category**: plaintext-at-rest
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[3]` (severity HIGH)
    - **STRENGTHENED 2026-05-10B** — `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[2]` + `security.known_security_gaps.[1]` (severity MEDIUM per sidecar; corroborates from the verify side: "Token comparison is `.equals(...)` (line 56), not `MessageDigest.isEqual(...)` — vulnerable to timing-based token discovery on a local network where an attacker can measure response time differences. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle is violated." — the verify side's plaintext `.equals(...)` confirms the storage shape established by the rotate side; together they compose the full plaintext-at-rest + plaintext-equality + non-constant-time model. REFACTOR-079 captures the constant-time-comparison gap independently; REFACTOR-048 is the storage-at-rest dimension)
  - **Statement**: ADR-CANDIDATE-017's "plaintext-equality against in-DB string" model means the database stores tokens as-is. There is no application-layer hashing (no BCrypt, no SHA-256+salt, no HMAC verification — the `IngestionDataEntitiesFilter` does a literal `dto.tokenPojo().getValue().equals(token)` check at line 55-58). A read-only DB replica, a Postgres backup, a jOOQ statement log capture, an SQL-injection at the TOKEN table — any of these escalates from "DB read" to "platform-wide ingestion compromise."
  - **Evidence**: `ReactiveTokenRepositoryImpl.java:21-39` (record stored as-is) + `IngestionDataEntitiesFilter.java:55-58` (plaintext `.equals(...)` check confirms no hashing)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 codifies the plaintext-equality model. This scope is the structural consequence of the model; addressing it is a structural change (would require BCrypt-on-write + BCrypt.matches-on-read, breaking the rotation model that returns plaintext on regenerate). The maintainer's choice for ADR-017 was "long-random over TLS"; the gap-shape of REFACTOR-048 is the price.
  - **Proposed remedy**: At minimum, document on the new "Token Rotation" doc section that tokens are plaintext at rest and that operators must (a) restrict DB access, (b) encrypt-at-rest at the storage layer, (c) treat backups as credential-bearing. At maximum, redesign to BCrypt-at-rest, which would require extending ADR-CANDIDATE-017 (and breaks the rotation model: the new BCrypt'd token can no longer be RETURNed in plaintext to the operator).
  - **Severity rationale**: HIGH — credential plaintext at rest is one DB read away from total ingestion compromise.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-049** (NEW 2026-05-10A): Under `auth.type=DISABLED`, the token regenerate endpoint is anonymously reachable — `COLLECTOR_TOKEN_REGENERATE` permission is bypassed entirely; any caller can rotate any collector's token and receive the plaintext
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[6]` (severity HIGH in DISABLED deployments)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[4]` (severity HIGH in DISABLED deployments)
  - **Statement**: Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` short-circuits all permission checks via `.anyExchange().permitAll()`. The `COLLECTOR_TOKEN_REGENERATE` permission gate at `SecurityConstants.java:135-137` is consumed only by `AuthorizationCustomizer` in the protected-mode security configurations. Result: any caller able to reach the platform on a DISABLED deployment can `PUT /api/collectors/{id}/token`, rotate any collector's token, and receive the plaintext in the response. `TokenGeneratorImpl.java:30-31` falls through to `Mono.just(this.regenerate(tokenPojo, null))` — the resulting TOKEN row's `updated_by` is NULL, so even the single-state forensic trail is empty.
  - **Evidence**: `TokenGeneratorImpl.java:27-32` (no-current-user fallback) + `DisabledAuthSecurityConfiguration.java` (filename per glob)
  - **Existing-ADR-or-implied-prescription**: None. (DISABLED is documented as dev-only in the live security docs, but the docs do not specifically warn about token-rotation exposure under DISABLED — only generic "use only in dev" guidance.)
  - **Proposed remedy**: Either (a) gate the rotation endpoint with `@ConditionalOnProperty(value="auth.type", havingValue="DISABLED", matchIfMissing=false)` to register a fail-closed bean variant; (b) add a startup banner WARN when `auth.type=DISABLED` is set in production-shaped deployments (e.g., when `spring.profiles.active!=dev`); (c) document the exposure prominently on the live `enable-security` page.
  - **Severity rationale**: HIGH (in DISABLED deployments). Combines with REFACTOR-046 (no audit log) for a forensically-invisible platform-wide ingestion DoS via rotation-spam.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-050** (NEW 2026-05-10A): `postMessageInSlack` has no authorization gate AND no owner-scoping on `data_entity_id` — any authenticated user can attach a message to any data entity in the catalog and send it to any Slack channel the bot has been invited to
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[0]` (severity HIGH — no authz gate)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[3]` (severity HIGH — no owner scoping)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[0]` (severity HIGH)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[2]` (severity HIGH)
  - **Statement**: `POST /api/datacollaboration/providers/slack/messages` carries no `@PreAuthorize`, no `SecurityRule` in `SecurityConstants.SECURITY_RULES`, and no programmatic permission check in `DataCollaborationServiceImpl.createAndSendMessage(...)`. The request only falls through `AuthorizationCustomizer.pathMatchers('/**').authenticated()`. Combined with the `data_entity` lookup checking only existence + non-hollowness (`DataCollaborationServiceImpl.java:50-52`, no owner filter), any authenticated user can post a message to any Slack channel the configured bot can reach, attached to any `data_entity_id` — INCLUDING data entities owned by other tenants/owners. This is BOTH a violation of ADR-CANDIDATE-002 (centralised SECURITY_RULES is the registry; a missing entry is a violation, not a posture) AND a cross-tenant message-injection path.
  - **Evidence**: `SecurityConstants.java:96-355` (no entry for `/api/datacollaboration/providers/slack/messages`) + `AuthorizationCustomizer.java:29-30` (catch-all) + `DataCollaborationController.java:33-39` (no annotations) + `DataCollaborationServiceImpl.java:47-62` (no owner filter, no permission check)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) prescribes "every mutating endpoint is one row in SECURITY_RULES." This scope is a **violation** of that ADR — there is no row for `postMessageInSlack`. The decision to write to Slack is a mutation (it triggers an external-system side-effect AND persists `messages` rows); a missing rule is a missed gate, not a posture.
  - **Proposed remedy**: Add a SECURITY_RULES entry for `POST /api/datacollaboration/providers/slack/messages` mapped to a new `DATA_COLLABORATION_MESSAGE_POST` permission in `DATA_ENTITY` context (gated by ownership of the `data_entity_id` in the request body). Service-side, add an owner-scoping check in `DataCollaborationServiceImpl.createAndSendMessage` that asserts the calling user has read access to the `data_entity_id`. Add an integration test that attempts cross-owner posting under a non-owning principal and asserts 403.
  - **Severity rationale**: HIGH — cross-tenant data-injection vector + privilege-boundary leak. Outbound side-effect to Slack means the misuse is operationally visible to the affected workspace.
  - **Suggested backlog grouping**: `Authorization audit batch` + `Data Collaboration hardening`

- **REFACTOR-053** (NEW 2026-05-10A): `getActivity` exposes the entire platform's audit trail to any authenticated user — including `old_state`/`new_state` of every tracked field (descriptions, business names, ownership transitions, custom-metadata values) for resources the caller has no relation to
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[0]` (severity HIGH)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[4]` (severity MEDIUM in sidecar but HIGH at concept-aggregate level given audit-trail-confidentiality)
  - **Statement**: `/api/activity` (and `/api/activity/counts`) has no `@PreAuthorize`, no programmatic permission check at controller or service layer, and no entry in `SecurityConstants.SECURITY_RULES`. Under LOGIN_FORM/OAUTH2/LDAP, any authenticated user can read the GLOBAL activity feed across every owner — including audit trails for resources they have no ownership association with, exposing actor identity (`created_by`) and full old-state/new-state diffs of descriptions, business names, ownership changes, and custom metadata. The Policies/Permissions/Roles/Owners framework documented at `/configuration-and-deployment/enable-security/authorization` is not applied. The activity-feed feature page makes no visibility statement — operators reading the docs cannot determine that ANY authenticated user reads the GLOBAL audit trail. Combined with `DescriptionActivityStateDto` (free-text descriptions) flowing through the audit history, ANY description ever entered on the platform (incident notes, customer identifiers, internal tickets) is readable by every authenticated user.
  - **Evidence**: `ActivityController.java:1-58` + `ActivityServiceImpl.java:86-117` (no security context read) + `SecurityConstants.java:95-356` (no /api/activity rule) + `DescriptionActivityStateDto.java:3` (the free-text payload) + WebFetch `/configuration-and-deployment/enable-security/authorization` (no per-endpoint wiring) + WebFetch `/features/active-platform-features/activity-feed` (no visibility statement)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative GET-uniformly-authenticated, BORDERLINE) MAY defend this — if the read-collaborative posture is intentional, the global activity feed is consistent with it. However, the audit-trail-of-all-changes-ever is qualitatively different from "any authenticated user reads any data entity's metadata" — audit history typically warrants stricter gating in any RBAC-aware system. This scope is the strongest single piece of evidence the maintainer should resolve the ADR-CANDIDATE-003 borderline toward "missed gate" rather than "intentional posture."
  - **Proposed remedy**: Either (a) add a `PLATFORM_ACTIVITY_READ_ALL` permission and SECURITY_RULES entry that gates the global activity feed; or (b) split `/api/activity` into `/api/activity/my` (owner-scoped, no permission gate) and `/api/activity/all` (admin-permission gated); or (c) confirm ADR-CANDIDATE-003's read-collaborative posture and document on the live security page that the global audit trail is intentionally readable by every authenticated user. The maintainer's call.
  - **Severity rationale**: HIGH — audit-trail-confidentiality breach affecting every change ever made on the platform, including potentially-sensitive descriptions.
  - **Suggested backlog grouping**: `Authorization audit batch` (paired with ADR-CANDIDATE-003 triage)

- **REFACTOR-058** (NEW 2026-05-10A; extends REFACTOR-033): Chunk staging path is `attachment.storage`-INDEPENDENT — `FileUtils.CHUNK_BASE_PATH = "/tmp/odd/chunks"` is a hardcoded constant; multi-instance failure mode applies to LOCAL **and** REMOTE storage equally
  - **Category**: multi-instance-fs
  - **Surfaced by**:
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:performance.known_performance_gaps.[0]` (severity HIGH)
  - **Statement**: NEW finding from the chunk-method sidecar that elaborates and corrects the class-level finding (REFACTOR-033). The chunk staging path constant `FileUtils.CHUNK_BASE_PATH = "/tmp/odd/chunks"` (`FileUtils.java:24`) is a **hardcoded constant**, NOT config-driven. Both `LocalFileUploadServiceImpl.java:37` (LOCAL) and `RemoteFileUploadServiceImpl.java:56` (REMOTE) call `FileUtils.createDirectories(chunkDirectory)` from the same path. The storage backend ONLY differs at `completeFileUpload` finalisation — chunks are staged at the same per-instance local-fs path regardless of `attachment.storage` value. A horizontally-scaled REMOTE deployment without a shared volume backing `/tmp/odd/chunks` produces intermittent failures whenever the load balancer routes `initiateFileUpload` and `uploadFileChunk` to different instances, EXACTLY THE SAME WAY a LOCAL deployment does. The class-level sidecar attributed multi-instance brokenness to LOCAL only; that attribution is incomplete. (Note: REFACTOR-033 is the LOCAL-flavour finding; this entry generalises to BOTH backends.)
  - **Evidence**: `FileUtils.java:23-28` (`CHUNK_BASE_PATH = "/tmp/odd/chunks"` constant, not config-driven) + `FileServiceImpl.java:60-62` (writes to that path regardless of backend) + `LocalFileUploadServiceImpl.java:34-38` + `RemoteFileUploadServiceImpl.java:55-56` (both create-directories at the same location)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-012 (boot-time wiring) does not address chunk staging — the wiring decision is about the storage backend, but the chunk staging path is upstream of the backend dispatch.
  - **Proposed remedy**: Promote `CHUNK_BASE_PATH` from a hardcoded constant to a config key `attachment.chunk-staging.path` (default `/tmp/odd/chunks` for back-compat; recommended override for any multi-instance deployment). Document on the live config page that multi-instance deployments require a shared volume mount AT this path (irrespective of LOCAL vs REMOTE storage backend). Update REFACTOR-033's scope to LOCAL-finalisation-only and cite this scope as the chunk-staging-flavour.
  - **Severity rationale**: HIGH — silent failure mode on multi-instance deployments. Operators choosing REMOTE storage to escape the LSN-001 ephemeral-storage trap discover (only on production traffic) that the chunk-staging path traps them anyway.
  - **Suggested backlog grouping**: `Attachment integrity sprint` (priority alongside REFACTOR-033)

- **REFACTOR-068** (NEW 2026-05-10B): Under `auth.type=DISABLED` (the application.yml default), `/api/appInfo` is reachable by unauthenticated network callers and discloses the active auth mode + project version — a passive fingerprinting surface; live docs do not warn that the default deployment leaks both pieces of metadata
  - **Category**: info-disclosure
  - **Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[2]` + `bugs_limitations_corner_cases.[3]` (severity MEDIUM in sidecar but HIGH at concept-aggregate level given the LSN-001-shape default + the fingerprinting-for-CVE-matching framing)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:security.known_security_gaps.[0]` (severity MEDIUM in sidecar with LSN-001/LSN-010 case-law citation; promoted to HIGH here for cross-cutting alignment with REFACTOR-073 / REFACTOR-078)
  - **Statement**: `/api/appInfo` is NOT in `SecurityConstants.WHITELIST_PATHS` (which contains only `/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events`) and NOT in `SECURITY_RULES`. Under `auth.type=DISABLED` (the `application.yml:34` default), `DisabledAuthSecurityConfiguration.java:16` applies `.anyExchange().permitAll()` — so `/api/appInfo` is reachable by ANY network caller. The response body contains `{authType, projectVersion}` (`AppInfoController.java:24-28` + `AppInfo.java:22-66`). A network attacker can therefore (a) determine the platform's auth mode (telling them whether to attempt credential stuffing, OIDC tampering, or just walk in) and (b) determine the precise project version (telling them which CVEs apply). Neither piece of metadata is documented as a public-disclosure surface in the live docs (WebFetched 2026-05-10 of `/configuration-and-deployment/enable-security`).
  - **Evidence**: `AppInfoController.java:18-29` (no auth annotation, returns AppInfo) + `application.yml:34` (`auth.type: DISABLED` default) + `DisabledAuthSecurityConfiguration.java:13-18` (`.anyExchange().permitAll()`) + `SecurityConstants.java:95-96` (WHITELIST_PATHS does not include `/api/appInfo`) + WebFetch of live `enable-security` page on 2026-05-10 (status 200, no `/api/appInfo` coverage)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-024 (NEW 2026-05-10B — AppInfo auth-mode introspection contract) describes the deliberate publication of `authType`; the ADR does NOT defend the absence of pre-auth-vs-post-auth coverage policy. The decision was made in the context of LOGIN_FORM/OAUTH2/LDAP modes (where the SPA needs the response BEFORE the user has authenticated, so pre-auth reachability is required); the consequence under DISABLED — anonymous network fingerprinting — is a structural side effect, not a defended posture.
  - **Proposed remedy**: Either (a) explicitly add `/api/appInfo` to `SecurityConstants.WHITELIST_PATHS` AND document on the live `enable-security` page that the endpoint is intentionally pre-auth-reachable to support SPA login-flow rendering, with the trade-off (passive fingerprinting under DISABLED) called out; OR (b) restrict the endpoint to authenticated callers under LOGIN_FORM/OAUTH2/LDAP and find an alternative SPA-side mechanism for pre-auth login-flow discovery. Option (a) is the lower-risk path and aligns with the ADR's reporter contract — surface the disclosure explicitly on the docs page, including the recommendation NOT to run `auth.type=DISABLED` on network-reachable deployments.
  - **Severity rationale**: HIGH — LSN-001-shape silent unsafe default (`auth.type=DISABLED` is the `application.yml:34` default) compounding with an undocumented disclosure surface. Operators following the live docs may inherit this exposure without realising.
  - **Suggested backlog grouping**: `Authentication / boot-time security posture hardening`

- **REFACTOR-072** (NEW 2026-05-10B): `auth.type=LOGIN_FORM` runs WITHOUT the `AuthorizationCustomizer` — no `Policy / Permission / Role / Owner` framework enforcement; the live Authorization docs page describes the framework without naming this precondition
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:security.known_security_gaps.[1]` (severity HIGH)
  - **Statement**: `LoginFormSecurityConfiguration.java:55-58` configures its `SecurityWebFilterChain` with `authorizeExchange(...).pathMatchers("/**").authenticated()` — gating by authentication, not by the `Policy / Permission / Role / Owner` framework. The composite `AuthorizationManagerCondition` correctly returns FALSE for LOGIN_FORM (intentional — only OAUTH2 and LDAP are in the disjunction); the consequence is undocumented: the entire authorization framework is silently absent in LOGIN_FORM deployments. Any authenticated user can hit any endpoint that depends on `AuthorizationCustomizer` for fine-grained access control. The live `/configuration-and-deployment/enable-security/authorization` page describes Policies/Permissions/Roles/Owners as the authorization model **without** stating which auth modes wire them in.
  - **Evidence**: `LoginFormSecurityConfiguration.java:55-58` (no `AuthorizationCustomizer` invocation) + `OAuthSecurityConfiguration.java:98` (`.authorizeExchange(new AuthorizationCustomizer(...))`) + `LDAPSecurityConfiguration.java:145` (same) + `AuthorizationManagerCondition.java:11-17` (only OAUTH2 + LDAP nested) + WebFetch of `/configuration-and-deployment/enable-security/authorization` on 2026-05-10 (status 200, no precondition statement)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-025 (NEW — AnyNestedCondition idiom) confirms the OR-of-OAUTH2-and-LDAP is deliberate; the absence of LOGIN_FORM from the disjunction is structural. The ADR does NOT defend the documentation gap or the absence of an alternative authorization layer for LOGIN_FORM. The live docs frame LOGIN_FORM as "dev-only", which is the closest mitigating signal but does not state the consequence.
  - **Proposed remedy**: Either (a) wire `AuthorizationCustomizer` for LOGIN_FORM (would require including LOGIN_FORM as a third nested class in `AuthorizationManagerCondition` AND resolving the dead-code issue per REFACTOR-071); OR (b) document explicitly on the live `enable-security/authorization` page that the authorization framework is wired ONLY under OAUTH2 and LDAP, with LOGIN_FORM running "authentication only, no authorization." Doc-side option (b) is the safe immediate fix; the wire-it option (a) is a larger architectural change that may not be desirable given LOGIN_FORM's dev-only positioning.
  - **Severity rationale**: HIGH — operators running LOGIN_FORM in production (against the docs' guidance, but plausible) inherit authenticated-but-unauthorized; every authenticated user can call every endpoint that depends on `AuthorizationCustomizer` for permission enforcement.
  - **Suggested backlog grouping**: `Authorization audit batch` (paired with REFACTOR-073 as cross-cutting boot-time posture)

- **REFACTOR-073** (NEW 2026-05-10B; triangulated across 3 sidecars): No boot-time security-posture validator — operator misconfigurations (empty `auth.type`, typo'd `auth.type`, `auth.type=DISABLED` + `auth.ingestion.filter.enabled=false` on a network-reachable deployment) produce silently-degraded security postures with no fail-fast
  - **Category**: missing-fail-fast
  - **Surfaced by** (THREE independent sidecars — the triangulation makes this the highest-leverage finding in batch 2026-05-10B):
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[0]` + `bugs_limitations_corner_cases.[1]` ("`@Value(\"${auth.type}\")` declares NO default. If a deployment overrides `auth.type` to empty string ... every downstream `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"...\")` fails to match — producing a deployment with no `SecurityWebFilterChain` bean. ... No validation that `authType` matches the documented enum `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`. A typo (`OUATH2`) in the property value silently disables auth — every `@ConditionalOnProperty(havingValue=...)` fails to match, no `SecurityWebFilterChain` bean is created, AND `/api/appInfo` echoes the typo back to clients (which the SPA then has no rendering rule for).")
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:bugs_limitations_corner_cases.[2]` + `bugs_limitations_corner_cases.[3]` + `security.known_security_gaps.[2]` ("`auth.type=DISABLED` (the default per `application.yml:34`) bypasses authentication AND authorization. ... An operator who deploys the platform without setting `auth.type` ... runs a fully open platform; this is the literal default. ... Missing-key behaviour: if `auth.type` is unset ... NONE of the four `SecurityWebFilterChain` beans materialize, and the Spring container boots without a `SecurityWebFilterChain` for the reactive stack — leading to undefined HTTP-surface behaviour. ... The doc surface does not surface that DISABLED is the default nor that 'no authorization' is the literal behaviour.")
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[0]` + `security.known_security_gaps.[0]` ("Default deployment ships with `POST /ingestion/entities` UNAUTHENTICATED. `application.yml:48` sets `auth.ingestion.filter.enabled: false` and the docs (WebFetched 2026-05-10) do not surface this property. ... This is the same shape as LSN-001 (attachment-storage ephemeral default) — a critical-severity default that the docs do not warn about.")
  - **Statement**: The platform has no `@PostConstruct`-level security-posture validator that runs at boot and fails-loud or warns-loud on misconfiguration combinations. The three independent gaps surfaced by three independent sidecars compose into a single architectural shape: **misconfiguration is always silent**. Operator scenarios: (a) `auth.type` empty (env unset, `AUTH_TYPE=`) → no `SecurityWebFilterChain` bean wired, behaviour falls back to Spring Boot's autoconfigured permit-all default — silent. (b) `auth.type=OUATH2` (typo of OAUTH2) → no `@ConditionalOnProperty(havingValue=...)` matches, same silent permit-all fallback; `/api/appInfo` echoes the typo back to SPA clients (which fail to render). (c) `auth.type=DISABLED` (the `application.yml:34` default) + `genai.enabled=true` (operator opt-in but forgot to flip auth) → `/api/genai/ask` anonymously reachable (REFACTOR-019 already captured this for GenAI); (d) `auth.ingestion.filter.enabled=false` (the `application.yml:48` default) + network-reachable deployment → `POST /ingestion/entities` unauthenticated; (e) `auth.type=LOGIN_FORM` + production-shape deployment → no `AuthorizationCustomizer` wired (REFACTOR-072). In every case, the platform boots, serves traffic, and degrades silently. There is no startup banner, no health-check signal, no log.WARN-level alert.
  - **Evidence**: AppInfoController.java:18 (no `@Value` default) + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 (NO `matchIfMissing` on ANY of the four mode SecurityConfigurations) + IngestionDataEntitiesFilter.java:20 (no `matchIfMissing` on the ingestion filter either) + application.yml:34, 48 (defaults set but no validation) + grep across the codebase for a `SecurityPostureValidator` / `BootstrapValidator` returns no matches.
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-018 (NEW — Slack OAuth fail-fast at boot) describes the deliberate fail-fast pattern for Slack OAuth token — explicit `throw new IllegalArgumentException("Slack OAuth token is empty")` at bean construction. The pattern exists in the codebase for ONE outbound integration; this scope is the gap that the pattern has not been extended to the security-mode wiring. ADR-CANDIDATE-018 is the prescription (apply the fail-fast pattern to the security-config beans too) but the gap is structural.
  - **Proposed remedy**: Add a `SecurityPostureValidator` Spring `@Component` with `@PostConstruct` that: (1) asserts `auth.type` is non-empty and matches the enum `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`; raise `IllegalStateException` on missing/typo; (2) emits a `WARN`-level banner when `auth.type=DISABLED` is set in production-shaped deployments (heuristic: `spring.profiles.active != dev` and not localhost); (3) emits a `WARN`-level banner when `auth.type=DISABLED` AND `auth.ingestion.filter.enabled=false` AND the deployment is network-reachable; (4) emits a `WARN`-level banner when `auth.type=LOGIN_FORM` is set (REFACTOR-072 — no authorization framework wired); (5) optionally expose a `security.posture.fail-on-misconfig: true` config flag that converts the WARN banners to fail-boot errors for operators who want strict mode. Doc-side: surface the validator's banners on the live `enable-security` page so operators understand the diagnostic.
  - **Severity rationale**: HIGH — the single highest-leverage gap surfaced in batch 2026-05-10B. Catches all of REFACTOR-068 (DISABLED + `/api/appInfo` fingerprinting), REFACTOR-069 (empty/typo auth.type), REFACTOR-072 (LOGIN_FORM no authorization), REFACTOR-078 (default-off ingestion filter) at boot rather than at first request, and the LSN-001 / LSN-002 class of silent unsafe defaults gets a structural mitigation.
  - **Suggested backlog grouping**: `Authentication / boot-time security posture hardening` (cross-cutting anchor — fix this first and several other scopes downgrade in severity)

- **REFACTOR-074** (NEW 2026-05-10B): Tenant-id label asymmetry between write side (`!= null`) and read side (`isNotEmpty`) — an operator supplying `ODD_TENANT_ID=` (empty env var, not unset) silently splits the multi-tenant dataset
  - **Category**: label-asymmetry
  - **Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:security.known_security_gaps.[0]` (severity HIGH — multi-tenant isolation gap)
  - **Statement**: `AbstractTimeSeriesExtractor.java:60` (write side) uses `if (tenantId != null)` — an empty string passes the guard and writes a `tenant_id=""` label onto every TimeSeries record. `ExternalMetricReader.java:111` (read side) uses `StringUtils.isNotEmpty(tenantId)` — an empty string FAILS the guard and the read filter omits the `tenant_id` clause. Net effect: an operator supplying `ODD_TENANT_ID=` via env (set to empty string, not unset) sees writes go to `tenant_id=""` series tagged with an unfilterable label, while reads query across ALL tenants (no filter applied). In a shared-Prometheus multi-tenant deployment, this would either (a) bury THIS tenant's series under an unfilterable empty-tenant-id label, or (b) leak THIS tenant's reads to include series from co-tenants whose `tenantId` was `null`. The platform's multi-tenant isolation depends on this asymmetric pair behaving correctly, and they do not.
  - **Evidence**: `AbstractTimeSeriesExtractor.java:60` (`if (tenantId != null)`) + `ExternalMetricReader.java:111` (`StringUtils.isNotEmpty(tenantId)`) + `application.yml:208-210` (`tenant-id:` declared empty by default, distinguishable from unset only at env-override time)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-026 (NEW 2026-05-10B — metric storage mirrored `@ConditionalOnProperty`) describes the binary-switch wiring; this scope is a gap-shape within the chosen wiring — the multi-tenant property design relies on consistent empty-vs-null treatment between write and read sides, which the implementation does not provide.
  - **Proposed remedy**: Pick a single canonical empty-string treatment and apply it on both sides. Recommended: use `StringUtils.isNotEmpty(tenantId)` on both sides (treat empty-string as no-tenant-id) — this aligns with the live doc claim that "empty means no label is applied, and the Prometheus query returns series across all tenants." Add a unit test that injects `ODD_TENANT_ID=""` and asserts both writes and reads produce series-without-tenant-id-label. Document on the live `/configuration-and-deployment/odd-platform#prometheus-tenant-label-odd-tenant-id` page that empty-string and unset are equivalent.
  - **Severity rationale**: HIGH — multi-tenant isolation can fail silently under a specific env-override pattern that operators commonly use (empty string is the canonical "unset" signal for some CI/CD systems).
  - **Suggested backlog grouping**: `Metric storage hardening`

- **REFACTOR-078** (NEW 2026-05-10B): Default deployment ships with `POST /ingestion/entities` UNAUTHENTICATED — `application.yml:48` sets `auth.ingestion.filter.enabled: false`; live docs do not surface this property; same shape as LSN-001 (attachment-storage ephemeral default)
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[0]` (severity HIGH)
  - **Statement**: `IngestionDataEntitiesFilter.java:20` carries `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` with NO `matchIfMissing=true` attribute. `application.yml:46-48` explicitly sets the property to `false`. Combined with `SecurityConstants.WHITELIST_PATHS` including `/ingestion/**` and every security config's `permittedPaths` (or whitelist) including `/ingestion/entities` (`LoginFormSecurityConfiguration.java:50`), the result is: ANY caller able to reach the platform's HTTP port can `POST /ingestion/entities` with a valid `DataEntityList` payload and have entities ingested. This is the same shape as LSN-001 (attachment-storage ephemeral default) — a critical-severity default that the docs do not warn about. The live `/configuration-and-deployment/enable-security/authentication` page enumerates DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S without mentioning `auth.ingestion.filter.enabled` or that `POST /ingestion/entities` is unauthenticated under default.
  - **Evidence**: `IngestionDataEntitiesFilter.java:20` (no `matchIfMissing`) + `application.yml:46-48` (`auth.ingestion.filter.enabled: false`) + `LoginFormSecurityConfiguration.java:50` (permitted paths include `/ingestion/entities`) + `SecurityConstants.java:95-96` (WHITELIST_PATHS includes `/ingestion/**`) + WebFetch of live `/configuration-and-deployment/enable-security/authentication` page on 2026-05-10 (status 200, property not mentioned)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 (NEW 2026-05-10B — ingestion-endpoint auth trust gradient) codifies the opt-in posture as the deliberate design (registration-mandatory → ingestion-opt-in → external-alert-network-delegated). The ADR does NOT defend the docs-don't-surface-the-toggle gap — the deliberate opt-in posture is only safe IF operators are told about the toggle. The docs gap is the LSN-001-shape failure mode.
  - **Proposed remedy**: Either (a) flip the default to `auth.ingestion.filter.enabled: true` and require operators to explicitly opt OUT for dev mode; OR (b) keep the default but surface the property on the live `/configuration-and-deployment/enable-security/authentication` page with a prominent `{% hint style="danger" %}` admonition explaining the implication: "Default deployment ships with `POST /ingestion/entities` unauthenticated. Operators running ODD on a network-reachable host MUST set `auth.ingestion.filter.enabled=true` AND configure per-collector tokens." The (b) option preserves the deliberate opt-in posture from ADR-CANDIDATE-027; the (a) option is a breaking change for existing dev deployments but a safer default. Maintainer triage decision.
  - **Severity rationale**: HIGH — LSN-001-shape silent unsafe default. Operators following the live docs may run a production-shaped deployment with an unauthenticated ingestion endpoint.
  - **Suggested backlog grouping**: `Ingestion-endpoint auth hardening` (priority 1; pair with the docs-side DOC-NNN follow-up)

- **REFACTOR-082** (NEW 2026-05-10B): AlertManager sibling endpoint `POST /ingestion/alert/alertmanager` is NOT covered by ANY filter — `auth.ingestion.filter.enabled` reads as if it locks down 'ingestion' globally but covers only `/ingestion/entities`; the property name is misleading
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[6]` (severity HIGH)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[3]` (severity HIGH)
  - **Statement**: `AlertManagerController.java:21` carries `@PostMapping(path = "ingestion/alert/alertmanager")` with NO `@PreAuthorize`, is NOT matched by `IngestionDataEntitiesFilter` (path-matcher is `/ingestion/entities` exact), is NOT matched by `IngestionDataSourceFilter` (path-matcher is `/ingestion/datasources` exact), and IS in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`) + every auth mode's permitted-paths. An attacker reaching the platform can POST arbitrary external-alert payloads, regardless of any `auth.ingestion.filter.enabled` setting. The property name suggests "ingestion is locked down" but the toggle covers only one of the `/ingestion/*` endpoints. This is the canonical case for ADR-CANDIDATE-006's deliberate network-delegated-auth posture — operators MUST deploy AlertManager behind a network-layer auth gate; the deliberate posture does NOT defend the docs-side gap that no operator is told this.
  - **Evidence**: `AlertManagerController.java:21` (no `@PreAuthorize`) + `IngestionDataEntitiesFilter.java:28` (path matcher: `/ingestion/entities` only) + `IngestionDataSourceFilter.java:20` (path matcher: `/ingestion/datasources` only)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-006 (AlertManager network-delegated auth) codifies the absence of app-layer auth as the deliberate decision. This scope is the misleadingly-named-property gap: the property name `auth.ingestion.filter.enabled` reads as if it covers the AlertManager endpoint but does not. The deliberate posture is sound; the property name (and the docs' framing) is what misleads.
  - **Proposed remedy**: Either (a) rename the property to `auth.ingestion.entities.filter.enabled` (breaking change requiring deprecation + migration window) to reflect the actual scope; OR (b) preserve the property name but add a prominent admonition on the live `enable-security/authentication` page explaining: "`auth.ingestion.filter.enabled=true` enables token verification ONLY on `POST /ingestion/entities`. Sibling endpoints `POST /ingestion/datasources` (always token-protected) and `POST /ingestion/alert/alertmanager` (NEVER application-layer protected; see ADR-CANDIDATE-006) follow different protection postures." Option (b) is the lower-risk path; option (a) is the explicit-naming fix.
  - **Severity rationale**: HIGH — combines with REFACTOR-078 (default-off ingestion filter) and REFACTOR-068 (DISABLED default) to produce a fully-open ingestion surface on an out-of-the-box deployment.
  - **Suggested backlog grouping**: `AlertManager hardening` + `Ingestion-endpoint auth hardening`

- **REFACTOR-085** (NEW 2026-05-10B; LSN-001-shape): **NO RETENTION / DROP path for the `activity` table** — `AbstractPartitionManager.createPartitionsIfNotExists` only CREATEs; the live activity-feed Configuration page claims "Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`" but the code does NOT auto-drop partitions; silent monotonic growth
  - **Category**: missing-retention
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Statement**: `AbstractPartitionManager.java:14-51` only creates partitions; it never invokes `PartitionService.dropPartition` or `getEmptyPastPartitions`. The `PartitionService` interface defines both methods (`PartitionService.java:21-25`), and `PartitionServiceImpl` implements `dropPartition` at lines 82-127, but a grep for callers across the partition package returns only the service itself — no `AbstractPartitionManager` or `PostgreSQLPartitionCreationJob` invokes `dropPartition` for the activity table. Net effect: the `activity` table grows monotonically. An operator running ODD for several years with high-volume activity (e.g., 1M events/day) accumulates 365×N days × ~size-per-event of audit data with no automatic cleanup. The live `/features/active-platform-features/activity-feed#configuration` page explicitly tells operators that the setting controls "retention and partitioning" — that claim is **incorrect**: setting `partition-period=7` narrows partitions but does NOT shorten the retained window. To actually shorten retention, an operator must manually `DROP TABLE activity_YYYYMMDD_YYYYMMDD` partitions. This is the same shape as LSN-001 (attachment-storage ephemeral default) — silent operator-misleading default with production consequences.
  - **Evidence**: `AbstractPartitionManager.java:14-51` (no `dropPartition` invocation anywhere) + `PartitionService.java:21-25` (`getEmptyPastPartitions` + `dropPartition` defined but unused by this caller) + grep of the partition package for `dropPartition` returns only PartitionService.java + PartitionServiceImpl.java (no callers) + WebFetch of `/features/active-platform-features/activity-feed#configuration` on 2026-05-10 (status 200, live quote: "Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`")
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW 2026-05-10B — range-partition lifecycle) codifies the four-decision family including the continue-on-failure orchestration; the ADR does NOT defend the absence of a retention path because the absence has no stated rationale. The maintainer chose width-and-cadence + dual-lock + extensibility + continue-on-failure; retention was simply not addressed. The docs-side claim ("retention and partitioning are controlled by") is the canonical case-law for "documentation that says the platform does X when the platform does not."
  - **Proposed remedy**: Either (a) extend `AbstractPartitionManager.createPartitionsIfNotExists` to also invoke `PartitionService.getEmptyPastPartitions` + `dropPartition` based on a new `odd.activity.partition-retention-days` config key (default unbounded for back-compat; operators opt in to retention by setting the value); OR (b) correct the live activity-feed Configuration page wording to remove the "retention" claim, replacing with "Activity-feed partition cadence is controlled by `odd.activity.partition-period`; the platform does NOT auto-drop old partitions — operators implement retention by manually `DROP TABLE activity_YYYYMMDD_YYYYMMDD` against partitions outside their retention window." Option (b) is the docs-only fix and the safe immediate path; option (a) is the structural fix that requires extending ADR-CANDIDATE-028.
  - **Severity rationale**: HIGH — LSN-001-shape silent operator-misleading default. The combination "docs claim retention" + "code does not implement retention" + "no auto-cleanup" produces years-of-storage-bloat with no warning. Operators relying on the doc claim WILL eventually run out of disk.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening` (priority 1) + DOC-NNN doc-side follow-up to correct the activity-feed Configuration page wording

- **REFACTOR-086** (NEW 2026-05-10B): Silent-fail swallow on partition CREATE failure — `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` catches `RuntimeException` and logs at ERROR before continuing the loop; no metric, no health-check degradation, no UI surfacing
  - **Category**: observability
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[2]` (severity HIGH)
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:performance.known_performance_gaps.[1]` (severity MEDIUM per sidecar; HIGH at concept-aggregate given durability impact)
  - **Statement**: `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` (lines 53-61) catches the `RuntimeException` raised by `AbstractPartitionManager.createPartitionsIfNotExists` (line 49) and logs at ERROR before continuing the loop. There is no alerting, no metric, no health-check degradation, no UI surfacing. An ODD instance that booted with a DB role lacking CREATE TABLE privilege would log ERROR once at boot and the application would continue serving traffic — until `activity` INSERTs began failing as rows arrived for the uncovered window. Combined with the boot-time @PostConstruct execution (silently failed at startup, no readiness-probe signal) and the nightly cron (silently failed at midnight, no metric counter), the entire partition-creation subsystem can fail for weeks before any operator notices.
  - **Evidence**: `PostgreSQLPartitionCreationJob.java:53-60` (the `catch (final Exception e) { log.error(...); }` block) + `AbstractPartitionManager.java:48-50` (the wrapping `RuntimeException(e)`) + grep of the partition package for `MeterRegistry|Counter|Timer|Gauge` (zero matches)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW 2026-05-10B) codifies the continue-on-failure orchestration as the deliberate decision — "maximise partition-creation success across all tables over fail-fast detection of a single-table failure." The ADR DOES defend the absence of fail-loud; the ADR does NOT defend the absence of metrics/observability. Continue-on-failure is sound IF operators have an observability signal; the gap is the absence of any signal.
  - **Proposed remedy**: Add Micrometer instrumentation: (1) `partition.creation.success_total{table}` counter (incremented on success); (2) `partition.creation.failure_total{table}` counter (incremented in the catch block); (3) `partition.creation.last_success_seconds{table}` gauge (timestamp of last successful CREATE); (4) `partition.last_window_end_seconds{table}` gauge (the `endDate` of the most-recent partition). Operators can alert on "no success in 25 hours" or "failure count > 0 in last hour." Optionally: degrade the Spring Boot health-check to `OUT_OF_SERVICE` when the `last_success_seconds` is older than `partition-period` days — readiness-probe signal for k8s liveness.
  - **Severity rationale**: HIGH — durability-critical subsystem with no observability signal. Combines with REFACTOR-085 (no retention) for the full "operators have no visibility into the activity table's partition lifecycle" gap.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening`

### MEDIUM severity

- **REFACTOR-005**: `GenAIProperties` has no `@Validated` / `@NotBlank` / `@URL` / `@Min(1)` — Spring Boot's `@ConfigurationProperties` validation is not engaged
  - **Category**: missing-validation
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
  - **Statement**: `GenAIProperties.java:1-12` carries only `@ConfigurationProperties` and `@Data`; no `@Validated`, no `jakarta.validation.constraints.*` imports. The platform misses Spring's startup-time validation hook. The fail-fast happens at first request rather than at boot — even though boot-time fail-fast would be more operator-friendly.
  - **Evidence**: `GenAIProperties.java:1-12`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-004 (disabled-by-default + fail-fast-on-misconfig) is the architectural intent; this gap means fail-fast happens later than it could.
  - **Proposed remedy**: Add `@Validated` at class level; `@NotBlank @URL` on `url`; `@Min(1)` on `requestTimeout`. Add `spring-boot-starter-validation` dependency if not already present.
  - **Severity rationale**: MEDIUM — defense-in-depth for ADR-CANDIDATE-004's fail-fast posture.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-006**: `requestTimeout=0` accepted at startup; `Duration.ofMinutes(0)` is legal but produces immediate ReadTimeoutException with confusing error message
  - **Category**: buggy-default
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:bugs_limitations_corner_cases.[1]` + `[3]` (MEDIUM + LOW)
  - **Statement**: `WebClientConfiguration.java:23` calls `Duration.ofMinutes(genAIProperties.getRequestTimeout())`; Java primitive default is `0`. Operator sets `genai.enabled=true` without setting `request_timeout` → zero-duration timeout. Every request fires immediately as a `ReadTimeoutException`; the error message at `GenAIServiceImpl.java:48-51` is `"Gen AI request take longer that %s min".formatted(...)` which renders as `"Gen AI request take longer that 0 min"` — diagnostic of the misconfiguration but the message implies upstream slowness. Plus a typo: "longer that" should be "longer than".
  - **Evidence**: `WebClientConfiguration.java:22-23` + `GenAIProperties.java:11` (no initializer) + `GenAIServiceImpl.java:48-51`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-004 prescribes fail-fast; this is the canonical "fail-fast at first request, not at boot" instance.
  - **Proposed remedy**: (a) Add `@Min(1)` on `requestTimeout` (covered by REFACTOR-005). (b) Fix the typo in the error message. (c) When `requestTimeout < 1`, raise a clearer `BadConfigurationException` at the WebClient construction in `WebClientConfiguration.java:22-23` rather than at the first request.
  - **Severity rationale**: MEDIUM — UX of misconfiguration discovery.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-007**: GenAI prompts and responses are not logged for audit / abuse-investigation
  - **Category**: missing-audit
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[6]` + `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[5]` (MEDIUM)
  - **Statement**: The controller has no `@Slf4j`; `GenAIServiceImpl.java:19`'s `@Slf4j` annotation is unused (no `log.info` / `log.warn` / `log.error` calls). An operator investigating prompt-injection abuse or data-exfiltration through the LLM has no platform-side trail.
  - **Evidence**: `GenAIController.java:1-24` + `GenAIServiceImpl.java:1-53`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (thin-proxy stance) does NOT defend the absence of audit logging. Audit-logging is a security/operability concern, not "prompt engineering."
  - **Proposed remedy**: Add `log.info("[genai] user={} prompt-length={} response-length={}")` (no full prompt/response content by default — that's a separate `genai.audit-log.full-content: true` opt-in for operators investigating). Track per-user invocation counts via Micrometer counter.
  - **Severity rationale**: MEDIUM — investigation-readiness gap.
  - **Suggested backlog grouping**: `GenAI hardening sprint`

- **REFACTOR-009**: No compile-time / test-time guard against SECURITY_RULES path-pattern drift; the term-mismatch case (REFACTOR-008) had no automated detection
  - **Category**: missing-test
  - **Surfaced by**:
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[4]` ("Authorization layer is path-string-coupled with no compile-time/test-time guard against drift")
  - **Statement**: SECURITY_RULES is a list of literal path strings; OpenAPI-generated `*Api` interfaces carry their own literal `@RequestMapping(value = ...)` strings. If the spec changes and SECURITY_RULES isn't updated (REFACTOR-008's case), the build is green and the security regression is silent.
  - **Evidence**: `SecurityConstants.java:98-355` (string-literal paths) + `DataEntityApi.java:148, 542` (string-literal paths) — no shared source of truth, no integration test that walks both
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) calls out the path-string-coupling trade-off; this scope is the missing test infrastructure that mitigates the trade-off.
  - **Proposed remedy**: Add a unit test that walks the generated `*Api` interfaces' `@RequestMapping(value = ...)` annotations and asserts every value with a security-significant prefix appears in SECURITY_RULES (or is explicitly excluded with a comment). Optionally: add a custom Gradle task that fails the build on SECURITY_RULES paths that have no matching mapping (the inverse direction — catches stale rules).
  - **Severity rationale**: MEDIUM — process gap; reduces likelihood of REFACTOR-008-class bugs.
  - **Suggested backlog grouping**: `Authorization audit batch`

- **REFACTOR-010**: Cross-entity uploadId hijack — caller with DATA_ENTITY_ATTACHMENT_MANAGE on entity X who learns uploadId Y issued for entity Z can post chunks via `POST /api/dataentities/X/files/uploads/Y/chunks`
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[3]`
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[2]` + `security.known_security_gaps.[0]` ("the security gate at SecurityConstants.java:247-251 authorises against the URL's `data_entity_id`, but the chunk lands against the `uploadId`'s originating entity. A user with `DATA_ENTITY_ATTACHMENT_MANAGE` on entity X can post chunks toward entity Z if they obtain a `uploadId` issued for Z. The misalignment is structural (path vs uploadId) and can only be fixed by service-side cross-validation (e.g., `assert filePojo.dataEntityId == path.dataEntityId` in `FileServiceImpl.uploadFileChunk`).") — chunk-method sidecar confirms from the chunk-upload side and adds the structural fix recommendation
  - **Statement**: The controller / service chain never verifies the `uploadId` belongs to the path's `dataEntityId`. The chunks land against the original entity (because `FileRepository.getFileByUploadId(uploadId)` resolves by uploadId only), so the data-loss surface is bounded, but the URL becomes deceptive. The misalignment is structural — the SECURITY_RULES gate evaluates against the path's `data_entity_id` (per ADR-CANDIDATE-002), the chunk lands against the `uploadId`'s entity (per ADR-CANDIDATE-023). A caller already-authorized on entity X can divert chunks to any entity they obtain a `uploadId` for.
  - **Evidence**: `DataEntityAttachmentController.java:54-62, 65-70` + `AttachmentServiceImpl.java:71-78` + `FileServiceImpl.java:93-102` + `SecurityConstants.java:247-251` (gate matches URL, not service-resolved entity)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-023 (NEW 2026-05-10A — uploadId-as-session-key) describes the structural shape; this scope is the gap it produces. The fix preserves the ADR's shape: add `assert filePojo.dataEntityId == path.dataEntityId` in the service.
  - **Proposed remedy**: Add a check in `FileServiceImpl.checkProcessingUploadById` that `file.dataEntityId` matches the path's `dataEntityId`; reject mismatch with HTTP 400. Add an integration test for the cross-entity path.
  - **Severity rationale**: MEDIUM — correctness-of-RBAC bug; URL deception even if data-integrity is preserved.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-011**: Concurrent chunks with the same `index` for the same `uploadId` race-overwrite each other silently — no idempotency token beyond `index`
  - **Category**: race-condition
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[4]` (MEDIUM) ("Same-`index` race overwrites silently. `FilePart.transferTo(chunkDirectory.resolve(String.valueOf(index)))` is a last-writer-wins file write keyed by `index`. A client retrying chunk `index=3` while the prior attempt is still flushing has both writes target the same path. Reactor's `transferTo` does not provide write-isolation semantics; the prior write may be partially flushed when the second begins. The assembled file (`completeFileUpload`) reads chunks via `FileUtils.listFilesInOrder` and concatenates whatever bytes are present — corruption is silent.")
  - **Statement**: `FilePart.transferTo(path.resolve(String.valueOf(index)))` is last-writer-wins file write keyed by `index`. If a client retries a failed chunk while the first attempt is still flushing, both writes target the same path; a retry-after-partial-write pattern can produce a corrupt assembled file with no error surfaced.
  - **Evidence**: `DataEntityAttachmentController.java:54-62` + `FileServiceImpl.java:58-67`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Use `Files.move(StandardCopyOption.ATOMIC_MOVE)` from a per-attempt temp file; or per-chunk `(index, attempt)` key; or strict version of `FileChannel.tryLock`. Add an integration test that fires concurrent chunks with the same index.
  - **Severity rationale**: MEDIUM — silent data corruption under specific retry patterns.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-012**: `downloadFile` Content-Disposition header injection — `dto.fileName()` injected verbatim with no sanitisation, no quoting, no `filename*=UTF-8''...` encoding
  - **Category**: header-injection
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[6]`
  - **Statement**: `DataEntityAttachmentController.java:77` does `"attachment;filename=" + dto.fileName()`. CR/LF in filename → header injection; non-ASCII renders inconsistently across browsers; `"` or `;` truncates the value. Filename originates from `DataEntityUploadFormData.fileName` posted at `initiateFileUpload` — fully attacker-controlled.
  - **Evidence**: `DataEntityAttachmentController.java:73-80` + `FileServiceImpl.java:41-55`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Use Spring's `ContentDisposition.attachment().filename(dto.fileName(), StandardCharsets.UTF_8).build().toString()`. Reject CR/LF in filenames at upload time (a separate fast-fail validation).
  - **Severity rationale**: MEDIUM — header injection vulnerability.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-014**: OpenAPI spec for GenAI declares only `200 OK` — `400` and `500` failure modes are emitted by the controller advice but not in the contract
  - **Category**: missing-validation (contract-completeness)
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
  - **Statement**: `openapi.yaml:4205-4211`'s `responses:` block has only `'200'`; the actual feature emits `BadUserRequestException` → HTTP 400 (when `genai.enabled=false`) and `GenAIException` → HTTP 500 (timeout / upstream error) via `ControllerAdvice.java:24-27, 55-59`. Consumers reading the generated client are blind to both failure modes.
  - **Evidence**: `openapi.yaml:4205-4211` + `GenAIServiceImpl.java:38, 49-51` + `ControllerAdvice.java:24-27, 55-59`
  - **Existing-ADR-or-implied-prescription**: None directly. ADR-CANDIDATE-001 (controllers as thin OpenAPI delegates) creates the expectation that the spec is the source of truth; this scope is a deviation from that expectation.
  - **Proposed remedy**: Update `openapi.yaml`'s GenAI operation to declare `400` and `500` response shapes (using existing problem-shape definitions if present, or adding them).
  - **Severity rationale**: MEDIUM — affects every API consumer.
  - **Suggested backlog grouping**: `OpenAPI contract hardening`

- **REFACTOR-015**: `getDataEntityActivity` exposes who-changed-what audit trail to any authenticated user
  - **Category**: missing-auth
  - **Surfaced by**: `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[2]`
  - **Statement**: The activity stream (per-data-entity who-did-what audit log) is a GET endpoint outside SECURITY_RULES. Any authenticated user can read any entity's activity — including who has been editing descriptions, tags, terms, ownership, and so on.
  - **Evidence**: `DataEntityController.java` (activity endpoint method) + `SecurityConstants.java:98-355` (no matcher)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative, BORDERLINE) MAY defend this — but activity audit trails are a sensitive class typically gated more strictly than catalog reads. Surface for triage. (NEW 2026-05-10A: REFACTOR-053 generalises this finding to the global activity feed at `/api/activity` — both should be triaged together.)
  - **Proposed remedy**: Either confirm under ADR-CANDIDATE-003 (and document on the live security page that "any authenticated user reads any entity's audit trail") or add a `DATA_ENTITY_ACTIVITY_READ` permission. Triage decision.
  - **Severity rationale**: MEDIUM — audit-trail confidentiality.
  - **Suggested backlog grouping**: `Authorization audit batch`

- **REFACTOR-017**: AlertManager endpoint has no rate-limit, payload-size limit, or duplicate-suppression — unauthenticated DoS / noise injection vector
  - **Category**: missing-rate-limit
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[2]`
  - **Statement**: A misconfigured AlertManager (or a malicious caller — the endpoint is unauthenticated by design per ADR-CANDIDATE-006) can flood ODD with alerts. Each `ExternalAlert` produces one `AlertPojo` row + one `AlertChunkPojo` row inside `@ReactiveTransactional` `handleExternalAlerts`; cross-batch volume is not bounded. AlertManager `group_interval` re-sends every 5m by default; each re-send creates a fresh `AlertPojo` even if `(entity_oddrn, type=DISTRIBUTION_ANOMALY)` already has an OPEN alert (no dedup).
  - **Evidence**: `AlertManagerController.java:21-26` + `AlertServiceImpl.java:152-191`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-006 (network-delegated auth) explicitly defers application-layer auth to the network layer. The ADR does NOT defend the absence of rate-limit / dedup / payload-cap; those are gaps.
  - **Proposed remedy**: Add Bucket4j or Spring Cloud Gateway-style rate-limit on `/ingestion/alert/alertmanager`. Implement upsert-on-conflict for `(entity_oddrn, type, status=OPEN)` to dedup re-sends.
  - **Severity rationale**: MEDIUM — DoS + noise-injection on the unauthenticated path.
  - **Suggested backlog grouping**: `AlertManager hardening`

- **REFACTOR-020** (formerly ADR-CANDIDATE-022): Pagination parameters (`PageParam`, `SizeParam`) are int32 with no min/max/default — caller can pass `size=2147483647`
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses.[0]`
  - **Statement**: `components.yaml:4213-4229`'s shared `PageParam` and `SizeParam` declarations are int32 with no `minimum`/`maximum`/`default`. Page-size validation is at the caller's discretion. Same wisdom-test classification as REFACTOR-044 — "service-layer defends" is descriptive of a gap, not a deliberate posture.
  - **Evidence**: `components.yaml:4213-4229` + `openapi.yaml:828-866` (every list operation references these unconstrained params)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Update `components.yaml`'s `PageParam` (`minimum: 1`) and `SizeParam` (`minimum: 1`, `maximum: 200`, `default: 20`). Regenerate and re-test all list endpoints.
  - **Severity rationale**: MEDIUM — pervasive across every list endpoint.
  - **Suggested backlog grouping**: `OpenAPI contract hardening`

- **REFACTOR-021**: No controller-level smoke / `@WebFluxTest` exists for AlertController
  - **Category**: missing-test
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:bugs_limitations_corner_cases.[0]` (MEDIUM); STRENGTHENED 2026-05-10A: `odd-platform__java__AlertController__controller-method__getAllAlerts.md:bugs_limitations_corner_cases.[3]` (MEDIUM — the method-level sidecar confirms zero matches via `find`).
  - **Statement**: A breaking change to the OpenAPI generator template, the WebFlux configuration, or the Jackson serialiser config could silently break all five `/api/alerts*` endpoints with the build still passing.
  - **Evidence**: `find odd-platform -path '*test*' -name 'AlertController*'` returned no matches
  - **Proposed remedy**: Add `@WebFluxTest(AlertController.class)` smoke per endpoint asserting `200/204` against a stubbed service; add a `403` assertion for `SECURITY_RULES`-gated paths under an unauthorized caller.
  - **Severity rationale**: MEDIUM — process leverage; catches REFACTOR-008-class bugs.
  - **Suggested backlog grouping**: `Controller test bootstrap`

- **REFACTOR-022**: No controller-level test exists for any DataEntityAttachmentController endpoint
  - **Category**: missing-test
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[3]` (MEDIUM); STRENGTHENED 2026-05-10A: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:tests_coverage_semantic.gaps` (chunk-method sidecar confirms zero matches via `find` and adds the chunked-protocol-as-highest-value-target framing).
  - **Statement**: 10 endpoints, including the stateful chunked-upload protocol, with no `@WebFluxTest` coverage. The chunked-upload protocol is the highest-value target for a wired integration test.
  - **Evidence**: `find <odd-platform> -path '*test*' -name 'DataEntityAttachmentController*'` returned no matches
  - **Proposed remedy**: Add `@WebFluxTest(DataEntityAttachmentController.class)`; add an integration test for the multi-call upload protocol (initiate → chunk × N → complete).
  - **Severity rationale**: MEDIUM — catches REFACTOR-013-class bugs (server-side cap bypass).
  - **Suggested backlog grouping**: `Controller test bootstrap`

- **REFACTOR-023**: No controller-level integration test exists for GenAIController
  - **Category**: missing-test
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
  - **Statement**: A regression in the OpenAPI generator template, the WebFlux configuration, the `ControllerAdvice` exception mapping, or the security filter chain (e.g. accidentally adding `/api/genai/**` to the WHITELIST_PATHS) could silently change the endpoint's contract or auth posture with the build still passing.
  - **Evidence**: empty find result for `*GenAI*|*Genai*|*genai*` test files
  - **Proposed remedy**: Add `@WebFluxTest(GenAIController.class)`; assert `403` for unauthenticated callers under `LOGIN_FORM`, `200` for authenticated callers, `400` when `genai.enabled=false`.
  - **Severity rationale**: MEDIUM — defense-in-depth; catches the WHITELIST_PATHS-misconfig class of bug.
  - **Suggested backlog grouping**: `Controller test bootstrap`

- **REFACTOR-030**: `i18n` `fallbackLng` is the full six-element array `['en','es','ch','fr','ua','hy']` rather than conventional `'en'`
  - **Category**: buggy-default
  - **Surfaced by**: `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
  - **Statement**: Per i18next semantics, on missing key, i18next walks the fallbackLng array in order. A French user with a key present in Spanish/Chinese but missing in French would see Spanish or Chinese unexpectedly before reaching English. Almost certainly not intended.
  - **Evidence**: `odd-platform-ui/src/locales/i18n.ts:30` + the natural-keys pattern in `translations/en.json`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-011 (natural-keys) prescribes English-as-fallback; this scope is the bug-shaped deviation.
  - **Proposed remedy**: Set `fallbackLng: 'en'` (single string).
  - **Severity rationale**: MEDIUM — UX inconsistency.
  - **Suggested backlog grouping**: `i18n cleanup`

- **REFACTOR-031**: AlertManager hand-rolled DTO drops fields the platform may later want to honour (`status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`)
  - **Category**: missing-validation (DTO-completeness)
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
  - **Statement**: `AlertManagerRequest` has only `alerts: List<ExternalAlert>`; `ExternalAlert` has only `labels`, `generatorURL`, `startsAt`. AlertManager's actual schema has `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`. If the platform later wants to act on `status: resolved` to close alerts, it must add deserialisation for that field — the current DTO would lose it.
  - **Evidence**: `AlertManagerController.java:30-32` + `ExternalAlert.java:11-15`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-014 (AlertManagerController hand-coded as exception to OpenAPI rule) acknowledges the TODO. Adding fields is the natural follow-through to that ADR.
  - **Proposed remedy**: Define an OpenAPI schema for the AlertManager webhook payload (matching Prometheus AlertManager's contract); regenerate; switch the controller to `implements AlertManagerApi`. Or — if the contract is wanted to remain hand-coded — add the missing fields manually. Either resolves the gap.
  - **Severity rationale**: MEDIUM — deferred-feature gap.
  - **Suggested backlog grouping**: `AlertManager hardening`

- **REFACTOR-032**: `ExternalAlert.startsAt` is timezone-naive `LocalDateTime`; AlertManager's RFC3339 timezone offset is silently stripped by Jackson
  - **Category**: buggy-default
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[4]`
  - **Statement**: `ExternalAlert.java:14` declares `private LocalDateTime startsAt`; Prometheus AlertManager sends `startsAt` as RFC3339 with timezone (e.g. `2026-05-08T10:23:45.123Z`). Jackson's default `LocalDateTime` deserialiser strips the offset. If the platform JVM and AlertManager are in different zones, alert timestamps drift by the offset.
  - **Evidence**: `ExternalAlert.java:14` + `AlertServiceImpl.java:67-68`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Change `LocalDateTime` to `OffsetDateTime` or `Instant`. Update `AlertServiceImpl` formatter pattern to preserve the zone. Add a unit test with a zoned input.
  - **Severity rationale**: MEDIUM — timestamp correctness on the alert-routing path.
  - **Suggested backlog grouping**: `AlertManager hardening`

- **REFACTOR-034**: MinIO SDK HTTP-client timeouts (~5min default) not configurable at YAML — slow networks combined with large `attachment.max-file-size` produce unrecoverable socket timeouts
  - **Category**: buggy-default
  - **Surfaced by**: `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[4]` (MEDIUM)
  - **Statement**: `MinioConfig` builds `MinioAsyncClient` with no custom `OkHttpClient`, so the SDK defaults apply globally to all REMOTE operations. There is no `attachment.remote.timeout` knob; tuning requires a code change.
  - **Evidence**: `MinioConfig.java:19-25` (no `.httpClient(...)` call)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add `attachment.remote.connect-timeout-millis`, `attachment.remote.read-timeout-millis`, `attachment.remote.write-timeout-millis` properties; in `MinioConfig`, build a custom `OkHttpClient` from these and pass `.httpClient(...)`.
  - **Severity rationale**: MEDIUM — operational tuning lever missing.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-035**: No per-tenant / per-data-entity / total-upload quota — operator setting a per-file cap implicitly accepts that one user can fill storage by repeated max-size uploads
  - **Category**: missing-quota
  - **Surfaced by**: `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
  - **Statement**: `attachment.max-file-size` is a single per-file cap. There is no `attachment.max-total-size`, no per-data-entity quota, no per-tenant quota. Combined with REFACTOR-026 (LOCAL ephemeral default), an operator who sets a 100 MB per-file cap accepts that a single user can fill `/tmp` ahead of an unrelated container restart.
  - **Evidence**: `AttachmentServiceImpl.java:27-62` (no quota fields) + `retrospectives/LSN-001-attachment-ephemeral-default.md`
  - **Proposed remedy**: Add `attachment.max-total-bytes-per-data-entity` (default unlimited). Track aggregate bytes via `FileRepository.sumByDataEntity(...)`; reject upload that would exceed.
  - **Severity rationale**: MEDIUM — quota gap.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-036**: Boot-time crash if `attachment.max-file-size` is unset — `@Value("${attachment.max-file-size}")` has no `:default` fallback
  - **Category**: buggy-default
  - **Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[6]` (LOW)
  - **Statement**: `AttachmentServiceImpl.java:27` declares `@Value("${attachment.max-file-size}")` with no `:default` fallback and a boxed `Integer` type. Operator overriding via env (`ATTACHMENT_MAX_FILE_SIZE=`) gets a Spring property-resolution failure at startup. The shipped `application.yml:217` value `20` is the only safety net.
  - **Evidence**: `AttachmentServiceImpl.java:27` + `application.yml:217`
  - **Proposed remedy**: Add a fallback: `@Value("${attachment.max-file-size:20}")`. Or — better — bind via `@ConfigurationProperties` with default initialiser.
  - **Severity rationale**: MEDIUM — boot-time crash on env override.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

- **REFACTOR-037**: Reopen-conflict guard on `changeAlertStatus` is read-then-write without serialisable fence — two concurrent OPEN requests for sibling alerts on same entity can both pass the guard
  - **Category**: race-condition
  - **Surfaced by**: `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[2]`
  - **Statement**: `AlertServiceImpl.updateStatus` checks "no open alert of same type for this entity exists" then writes. Concurrent requests can both pass the check before either writes. No `SELECT ... FOR UPDATE`, no advisory lock, no transactional fence.
  - **Evidence**: `AlertServiceImpl.java:124-131`
  - **Proposed remedy**: Either (a) `@Transactional(isolation = SERIALIZABLE)` on `updateStatus`, or (b) add a UNIQUE INDEX on `(data_entity_id, type, status='OPEN')` and rely on the DB to reject duplicate OPENs.
  - **Severity rationale**: MEDIUM — duplicate OPEN alerts under concurrency.
  - **Suggested backlog grouping**: `Alert reliability cleanup`

- **REFACTOR-038**: Directory landing-page DataSource list loaded without pagination — O(N) memory + parsing on every Directory navigation
  - **Category**: missing-pagination
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
    - `concepts.yaml:entities[Directory].performance_aggregate.weaknesses.[0]`
  - **Statement**: `DirectoryServiceImpl.getDataSourceTypes` calls `dataSourceRepository.list()` (full scan) then groups in memory by ODDRN prefix. For platforms with tens of thousands of registered data sources, the cost compounds linearly per Directory landing-page hit.
  - **Evidence**: `DirectoryServiceImpl.java:48-50`
  - **Proposed remedy**: Add a DB-level aggregate query that returns counts grouped by ODDRN prefix (eliminating the in-memory grouping). Or paginate the unfiltered list and force the UI to render incrementally.
  - **Severity rationale**: MEDIUM — performance scaling issue on the Directory landing page.
  - **Suggested backlog grouping**: `Directory performance` (potentially fold into Directory cleanup)

- **REFACTOR-051** (NEW 2026-05-10A): Slack-posting `MessageRequest.text` has no max-length, no sanitisation, no markdown allowlist — a 4 MB body is accepted and persisted; only fails at Slack's `chat.postMessage` boundary, AFTER the 202 has been returned to the caller
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
  - **Statement**: `MessageRequest.text` is marked `required` only (`components.yaml:3410-3423`); no `@Size`, no `@Pattern`, no length cap. The controller accepts up to `spring.codec.max-in-memory-size` (~20 MB by default), persists the message row to the `messages` table, returns `202 Accepted`. The downstream sender thread then attempts `chat.postMessage` which fails with `msg_too_long` (Slack's per-message limit is ~40 KB). The user sees `202 Accepted` and the message ends up in `ERROR_SENDING` state after the retry budget exhausts. UX hostile (user has no per-request signal of failure).
  - **Evidence**: `MessageRequest` schema `components.yaml:3410-3423` + `SlackAPIClientImpl.java:64-81` + `DataCollaborationMessageSenderJob.java:58-63`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the 202+queue+retry shape; this scope is the gap that the queue-decoupled posture does NOT defend (the queue accepts bytes; the queue does not validate bytes against the downstream contract).
  - **Proposed remedy**: Add `@Size(max = 40000)` on `MessageRequest.text` (matches Slack's actual per-message limit, conservatively). Reject oversized at the controller with HTTP 400 — never persist to `messages` if the message can't possibly succeed downstream. Update OpenAPI schema accordingly.
  - **Severity rationale**: MEDIUM — DoS amplifier (queue pollution) + UX hostile failure mode.
  - **Suggested backlog grouping**: `Data Collaboration hardening`

- **REFACTOR-052** (NEW 2026-05-10A): Slack-posting endpoint has no inbound rate-limit — a single authenticated user can fill the `messages` table at maximum throughput; sender thread becomes the bottleneck
  - **Category**: missing-rate-limit
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[7]` (MEDIUM)
  - **Statement**: `POST /api/datacollaboration/providers/slack/messages` has no per-endpoint rate-limiting, no Bucket4j integration, no per-user throttle. A single authenticated user can call the endpoint in a tight loop with 4 MB bodies, all of which are persisted to `messages` and then drained by a single-leader sender (`DataCollaborationMessageSenderJob`). The sender thread becomes the bottleneck, not the inbound, so attacker-controlled growth of `messages` rows is unbounded by the inbound. Combined with REFACTOR-050 (no authz gate) and REFACTOR-051 (no body validation), this is a queue-pollution + DB-disk-fill surface for any authenticated user.
  - **Evidence**: `DataCollaborationController.java:33-39` + no per-endpoint rate-limiting in this controller, the global filter chain (`AuthorizationCustomizer.java:19-31`), or in `DataCollaborationServiceImpl.createAndSendMessage(...)`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the 202+queue+retry shape; this scope is a gap on the inbound side. The ADR's queue model ASSUMES bounded inbound; the absence of an enforceable upper bound is the gap.
  - **Proposed remedy**: Add per-user rate-limit on `POST /api/datacollaboration/providers/slack/messages` (e.g., 10 messages/minute/user). Expose `datacollaboration.rate-limit.requests-per-minute-per-user`. Document on the live `data-collaboration` page.
  - **Severity rationale**: MEDIUM — queue pollution / DB-disk-fill via attacker-controlled inbound.
  - **Suggested backlog grouping**: `Data Collaboration hardening`

- **REFACTOR-054** (NEW 2026-05-10A): Slack-posting caller cannot observe send failure — controller returns 202 with `state=PENDING_SEND`; downstream `ERROR_SENDING` is only visible by polling `/api/dataentities/{id}/messages`
  - **Category**: error-mapping
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[4]` (MEDIUM)
  - **Statement**: The controller returns `202 Accepted` with a `Message` body whose `state` is `PENDING_SEND`. Downstream Slack failures (auth revoked, channel archived, text too long, rate-limited beyond retry budget) flip the row to `ERROR_SENDING` in the sender job. There is no notification, no push mechanism, no webhook back to the original caller. The user must re-fetch via the `/api/dataentities/{id}/messages` endpoints to see status.
  - **Evidence**: `DataCollaborationController.java:38` + `DataCollaborationServiceImpl.java:96` + `DataCollaborationMessageSenderJob.java:58-63`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the 202 model; this scope is the structural consequence (asynchrony precludes inline failure-reporting) but the absence of a polling/webhook/notification mechanism is a gap, not part of the ADR.
  - **Proposed remedy**: Either (a) add a Server-Sent-Events endpoint or WebSocket channel that streams message-state changes to subscribed clients; (b) add a polling endpoint specifically for one message (`GET /api/datacollaboration/messages/{uuid}/state`); (c) document on the live `data-collaboration` page that the UI must poll the per-entity messages endpoint to discover send-failures.
  - **Severity rationale**: MEDIUM — UX gap; users have no immediate signal whether their message succeeded.
  - **Suggested backlog grouping**: `Data Collaboration hardening`

- **REFACTOR-055** (NEW 2026-05-10A): Slack rate-limit handling is non-discriminating — every exception treated as the same 3-retry budget with fixed 1s sleep; 429 / `ratelimited` is not distinguished from `invalid_auth` / `channel_not_found`
  - **Category**: error-mapping
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[5]` (MEDIUM)
  - **Statement**: Every exception from `SlackAPIClientImpl.postMessage` is caught at `DataCollaborationMessageSenderJob.java:55` as a generic `Exception e` and either retried (`shouldRetry`) or persisted as `markMessageAsFailed`. Slack's `ratelimited` / `429` responses are not distinguished from auth (`invalid_auth`, `not_authed`) or channel (`channel_not_found`, `not_in_channel`) errors — the same 3-retry budget applies, with a fixed 1-second sleep. Under sustained 429s the budget is exhausted in <4s and the message is dropped.
  - **Evidence**: `DataCollaborationMessageSenderJob.java:54-65` + `SlackAPIClientImpl.java:73-77`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the retry-budget shape; this scope is the missing differentiation by error class — the ADR doesn't defend "treat all errors equally."
  - **Proposed remedy**: Distinguish error classes: (a) `429 / ratelimited` → exponential-backoff, longer total budget (Slack's `Retry-After` header should drive the next-attempt delay); (b) `invalid_auth / token_revoked` → terminal failure, no retry, fail-loud (operator must rotate); (c) `channel_not_found / not_in_channel` → terminal failure, no retry; (d) network errors → existing retry budget. Add Micrometer counters per error class for operator observability.
  - **Severity rationale**: MEDIUM — defective retry behaviour drops messages that retry-with-backoff would deliver.
  - **Suggested backlog grouping**: `Data Collaboration hardening`

- **REFACTOR-056** (NEW 2026-05-10A): Slack channel_id is fully user-supplied — caller can target ANY Slack channel the platform's bot has been invited to, regardless of which channel the in-app autocomplete listed
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[3]` (MEDIUM)
  - **Statement**: The request body's `channel_id` is passed straight to `SlackAPIClient.exchangeForChannel(channelId)`. Any Slack channel the bot has been invited to (`Conversation::isMember` filter in `SlackAPIClientImpl.java:45`) is acceptable. There is no concept of "which channels are valid for which data entity / owner" server-side. A user with the autocomplete UI listing channels A and B can craft a request targeting channel C (if the bot is in C), even if the platform UI never offers C.
  - **Evidence**: `DataCollaborationController.java:34-37` + `DataCollaborationServiceImpl.java:53-56` + `SlackAPIClientImpl.java:50-62`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add a server-side `(data_entity_id, allowed_channels[])` mapping (a new `data_entity_slack_channel` join table). The autocomplete API returns the per-entity allowed channels; the post API rejects channel_ids not in that set with HTTP 400.
  - **Severity rationale**: MEDIUM — escape from autocomplete UI; cross-channel posting is a data-leak surface to channels the user wouldn't normally see.
  - **Suggested backlog grouping**: `Data Collaboration hardening`

- **REFACTOR-057** (NEW 2026-05-10A): `getActivity` and `getActivityCounts` exposes cross-owner aggregate counts to any authenticated user via `/api/activity/counts`
  - **Category**: missing-auth
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[5]` (LOW per sidecar but MEDIUM at concept-aggregate given the cross-owner aggregate exposure)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.data_exposure.[1]`
  - **Statement**: `getActivityCounts` returns `totalCount`, `myObjectsCount`, `downstreamCount`, `upstreamCount` in a single payload. `totalCount` is computed without any owner filter (`ActivityServiceImpl.java:219-230`). Any authenticated user calling `/api/activity/counts` learns the total cross-owner activity volume in the window, even if they cannot enumerate the events themselves under `MY_OBJECTS`. (In practice they CAN enumerate via `type=ALL` per REFACTOR-053, but the counts endpoint trivially exposes the aggregate without paging — a low-cost reconnaissance signal.)
  - **Evidence**: `ActivityServiceImpl.java:139-166` (the `zip` of four counts) + `ActivityServiceImpl.java:219-230` (`getTotalCount` with no owner filter)
  - **Existing-ADR-or-implied-prescription**: Same as REFACTOR-053 — ADR-CANDIDATE-003 borderline.
  - **Proposed remedy**: Same triage as REFACTOR-053. If the maintainer adds `PLATFORM_ACTIVITY_READ_ALL`, gate `getActivityCounts.totalCount` behind it (return only `myObjectsCount` to non-admin callers). If the maintainer confirms read-collaborative posture, no change required but the live-doc must say so.
  - **Severity rationale**: MEDIUM — informational; the same data is reachable via the list endpoint (REFACTOR-053), but the counts endpoint is trivially queryable.
  - **Suggested backlog grouping**: `Authorization audit batch` (paired with REFACTOR-053)

- **REFACTOR-059** (NEW 2026-05-10A): `getActivity` `type=null` and `type=ALL` route to `fetchAllActivities` via separate code branches — defence-in-depth gap; a future refactor adding owner-scoping to one branch would silently bypass via the other
  - **Category**: dual-path
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[1]` (MEDIUM)
  - **Statement**: `ActivityServiceImpl.java:103-105` has `if (type == null) { return fetchAllActivities(...) }` BEFORE the four-arm switch; the switch's `case ALL ->` ALSO routes to `fetchAllActivities`. There are two paths to the same destination. A future refactor that adds owner-scoping to the `ALL` enum case (e.g., to address REFACTOR-053 partially) would silently bypass the new gate when callers omit the `type` parameter. Defence-in-depth requires either collapsing the two branches OR asserting `type != null` at the controller layer.
  - **Evidence**: `ActivityServiceImpl.java:103-105` (the `if (type == null)` branch) + `ActivityServiceImpl.java:114` (`case ALL -> fetchAllActivities(...)`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-022 (NEW — view-modes-as-single-parameter dispatch) describes the enum-dispatch shape; this scope is the implementation gap.
  - **Proposed remedy**: Either (a) remove the `if (type == null)` branch and let the switch handle null via `default ->` (which currently does nothing — would require explicit null handling); (b) add `if (type == null) type = ActivityType.ALL` at the start; (c) reject `type=null` at the controller with `@NotNull` (breaking change, requires OpenAPI update).
  - **Severity rationale**: MEDIUM — defence-in-depth gap on a security-relevant code path.
  - **Suggested backlog grouping**: `Activity feed hardening`

- **REFACTOR-060** (NEW 2026-05-10A): `userIds` and `ownerIds` filter parameters on `getActivity` are not validated — submission of arbitrary id lists allows enumeration of which users/owners have generated platform activity in a window
  - **Category**: enumeration-vector
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[2]` (MEDIUM)
  - **Statement**: `ActivityController.java:30-31` accepts `List<Long> ownerIds` and `List<Long> userIds` with no validation that the IDs reference existing users/owners. A caller can submit `userIds=[1,2,3,...,N]` to probe which users have generated platform activity in the window — a low-cost user-id enumeration vector. The response shape (empty vs. populated Flux) distinguishes valid-and-active from invalid-or-inactive users. No rate limit on `/api/activity` — an attacker can sweep id ranges quickly.
  - **Evidence**: `ActivityController.java:30-31` + `ActivityServiceImpl.java:179-181` (parameters threaded through unchanged)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: At minimum, add `@Size(max = 100)` on the list parameters to bound batch enumeration. Add per-endpoint rate-limit. Optionally, add a server-side check that the caller has a relationship to each requested user/owner (e.g., admin-only, or scoped to the caller's owner set).
  - **Severity rationale**: MEDIUM — enumeration vector; combines with REFACTOR-053 (cross-owner exposure) for full audit-trail discovery.
  - **Suggested backlog grouping**: `Activity feed hardening`

- **REFACTOR-062** (NEW 2026-05-10A): Token-rotation response body returns the new plaintext token without `Cache-Control: no-store` or other sensitive-body headers — every reverse-proxy / API-gateway / browser-history / response-logging middleware between UI and backend records the credential
  - **Category**: response-cache-leak
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[0]` (MEDIUM)
  - **Statement**: `CollectorController.java:50` returns the rotated Collector via `.map(ResponseEntity::ok)` with NO response-header customisation. The new plaintext token is in the body. Any logging / caching / proxying middleware on the response path captures the credential. No header marks the body as sensitive (no `Cache-Control: no-store`, no custom `X-Sensitive-Body` signal for downstream tooling).
  - **Evidence**: `CollectorController.java:50` + `TokenMapper.java:15-18` (plaintext returned when showToken=true)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (token rotation semantics) requires returning plaintext on rotate (the user has no other way to learn the secret); the ADR does NOT defend the absence of cache/log-prevention headers — those are a gap-shape orthogonal to the rotation model.
  - **Proposed remedy**: Add `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` to the rotation response. Optionally add a custom `X-Sensitive-Body: token` advisory header for downstream log-redaction tooling. Document on the live `enable-security` page that operators should redact response bodies for `PUT /api/collectors/*/token` in any logging tier.
  - **Severity rationale**: MEDIUM — credential exposure via standard middleware behaviour.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-063** (NEW 2026-05-10A): No rate-limit on token rotation endpoint — attacker with a stolen MANAGEMENT-permission session can rotate every collector's token in a tight loop, breaking platform-wide ingestion
  - **Category**: missing-rate-limit
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[5]` (MEDIUM)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[6]` (MEDIUM)
  - **Statement**: `CollectorController.java:47-51` carries no `@RateLimited` annotation; `SecurityConstants.java:135-137` has no rate-limit metadata on the SecurityRule; there is no programmatic throttle. An attacker who has stolen a valid session of a user with `COLLECTOR_TOKEN_REGENERATE` permission can rotate every collector's token in a tight loop. Combined with REFACTOR-047 (no grace period), this breaks platform-wide ingestion within a single attacker request burst.
  - **Evidence**: `CollectorController.java:47-51` (no `@RateLimited`) + `SecurityConstants.java:135-137` (no throttle metadata)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add Bucket4j rate-limit on the rotation endpoint (e.g., 10 rotations/minute/user, 100 rotations/minute platform-wide). Expose `collector.token.rotation-rate-limit` properties for operators.
  - **Severity rationale**: MEDIUM — DoS amplifier when combined with stolen credentials.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-064** (NEW 2026-05-10A): `CollectorServiceImpl.regenerateToken` is NOT `@ReactiveTransactional` — inconsistent with sibling `create` / `update` / `delete` methods on the same service
  - **Category**: transactional-consistency
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[2]` (LOW)
  - **Statement**: `CollectorServiceImpl.java:82-90` has no `@ReactiveTransactional` (compare with `create`, `update`, `delete` at lines 38, 51, 72 — all annotated). The current rotation is a single DB UPDATE so a transaction boundary is not strictly required for atomicity, but the absence is inconsistent. If a future change adds an audit-log insert (REFACTOR-046) or a notification dispatch, the developer must remember to add the annotation; a forgotten annotation produces silent partial-failure (token rotated but audit row not written, or vice-versa).
  - **Evidence**: `CollectorServiceImpl.java:82-90` (no `@ReactiveTransactional`) vs lines 38, 51, 72 (annotated)
  - **Existing-ADR-or-implied-prescription**: None directly. Implicit convention: every mutating service method is `@ReactiveTransactional` (the sibling methods establish this).
  - **Proposed remedy**: Add `@ReactiveTransactional` to `regenerateToken`. The change is no-op for the current single-UPDATE shape; sets up the convention for future additions.
  - **Severity rationale**: LOW — defensive consistency.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-069** (NEW 2026-05-10B): `@Value("${auth.type}")` at `AppInfoController.java:18` declares NO default; empty-string env override (`AUTH_TYPE=`) or typo (`OUATH2`) silently breaks downstream `@ConditionalOnProperty` matches AND echoes the broken value back in the `AppInfo.authType` response
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[0]` (severity MEDIUM)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:security.known_security_gaps.[1]` + `security.known_security_gaps.[2]` (severity LOW per sidecar — operator action required but no fail-fast guardrail)
  - **Statement**: `AppInfoController.java:18` carries `@Value("${auth.type}")` with no `:DISABLED` default. An operator overriding `auth.type` to an empty string (env var unset to empty, removed YAML key, etc.) or to a typo value (e.g. `OUATH2`, `LOGINFORM`) silently produces: (a) AppInfoController constructs with empty string / typo string; (b) every downstream `@ConditionalOnProperty(value="auth.type", havingValue="...")` fails to match; (c) NO `SecurityWebFilterChain` bean is wired; (d) Spring Boot's `ReactiveSecurityAutoConfiguration` autoconfigures a permit-all default chain — the platform boots unauthenticated; (e) `/api/appInfo` echoes the empty/typo value back to SPA clients (which have no rendering rule for it). The `application.yml:34` default `DISABLED` saves the bundled deployment from this; an operator who unsets the key on purpose hits the undocumented failure mode. The cross-cutting fix is REFACTOR-073 (boot-time security-posture validator).
  - **Evidence**: `AppInfoController.java:18` (no `:default`) + `AuthorizationManagerCondition.java:11,15` + `DisabledAuthSecurityConfiguration.java:10` + `LoginFormSecurityConfiguration.java:31` + `OAuthSecurityConfiguration.java:71` + `LDAPSecurityConfiguration.java:51` (none use `matchIfMissing`) + `application.yml:34` (default DISABLED)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-024 (NEW — AppInfo auth-mode introspection contract) prescribes the `@Value` reporter pattern; the absence of a default is the implementation gap, not the contract. REFACTOR-073 is the cross-cutting fix that subsumes this.
  - **Proposed remedy**: At minimum, add `:DISABLED` default to the `@Value` (`@Value("${auth.type:DISABLED}")`) so empty-string overrides resolve consistently. Better: add validation per REFACTOR-073's `SecurityPostureValidator` recommendation. Best: define `auth.type` as an enum in `@ConfigurationProperties` with `@NotNull` + `@Validated`.
  - **Severity rationale**: MEDIUM — operator-error gated; the bundled default prevents it, but an operator unsetting the key hits an undocumented failure mode.
  - **Suggested backlog grouping**: `Authentication / boot-time security posture hardening` (subsumed by REFACTOR-073)

- **REFACTOR-071** (NEW 2026-05-10B): `AuthorizationManagerCondition` is dead code — no class in the repository references it via `@Conditional(AuthorizationManagerCondition.class)` or any other consumer mechanism; the Condition class is vestigial
  - **Category**: dead-code
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:bugs_limitations_corner_cases.[0]` (severity MEDIUM)
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:security.known_security_gaps.[0]` (severity MEDIUM)
  - **Statement**: Verified via `Bash grep -rln "AuthorizationManagerCondition" <odd-platform> --include="*.java"` on 2026-05-10 — only the file's own path is returned. The authorization-manager wiring it appears designed to gate is in practice carried out by direct per-config `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` and `havingValue="LDAP"` annotations on `OAuthSecurityConfiguration.java:71` and `LDAPSecurityConfiguration.java:51`, each of which independently instantiates `new AuthorizationCustomizer(...)` inside its `SecurityWebFilterChain` bean. The Condition class is therefore vestigial — either the original consumer was refactored out (history not accessible) or it was added in anticipation of a consumer that never landed. Risk: a future maintainer reading the Condition class would reasonably assume it gates the authorization-manager wiring path and rely on it; the wiring would silently fail because nothing actually consults the Condition.
  - **Evidence**: `AuthorizationManagerCondition.java:1-18` (file body) + `OAuthSecurityConfiguration.java:71` (direct `@ConditionalOnProperty`) + `LDAPSecurityConfiguration.java:51` (direct `@ConditionalOnProperty`) + grep on 2026-05-10
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-025 (NEW 2026-05-10B — AnyNestedCondition idiom) confirms the idiom is alive elsewhere (SlackMessageGeneratorCondition). The IDIOM is sound; this specific INSTANCE is dead. The ADR does NOT defend the dead-code; the IDIOM is captured for the SlackMessageGeneratorCondition use, not for this one.
  - **Proposed remedy**: Either (a) delete `AuthorizationManagerCondition.java` and let the per-config `@ConditionalOnProperty` annotations be the canonical wiring (no behaviour change; reduces source-code mass and removes the misleading file); OR (b) wire `AuthorizationManagerCondition` into the authorization-customizer registration (would centralise the OAUTH2 OR LDAP disjunction — change to `@Conditional(AuthorizationManagerCondition.class)` on a new `AuthorizationCustomizerConfiguration` that holds the per-config bean shared logic). Option (a) is the simpler safe fix; option (b) is the larger architectural unification.
  - **Severity rationale**: MEDIUM — code-hygiene + future-maintainer trap. The dead code IS the warning; deleting it removes the trap. Combined with REFACTOR-072 (LOGIN_FORM bypasses AuthorizationCustomizer entirely), the maintainer should triage whether the intent was always to OR-gate OAUTH2/LDAP-only authorization or to extend to LOGIN_FORM.
  - **Suggested backlog grouping**: `Authorization audit batch` (paired with REFACTOR-072 triage)

- **REFACTOR-075** (NEW 2026-05-10B): Metric labels propagated verbatim from ingestion payload to Prometheus proto label list — no allowlist, no sanitisation, no PII filter; an ingested metric with `user_email=...` or `dataset_owner_email=...` labels writes them verbatim to the operator's Prometheus
  - **Category**: missing-sanitisation
  - **Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:security.known_security_gaps.[1]` (severity MEDIUM)
  - **Statement**: `AbstractTimeSeriesExtractor.java:30` calls `mapper.mapToProtoLabels(labels)` with no allowlist, no sanitisation, no PII redaction. If a collector ingests a metric whose labels carry PII or tenant-identifying user values, that PII is written verbatim to the operator's Prometheus and becomes readable to every operator/team with access to the Prometheus UI. The platform's role as a "thin proxy" for Prometheus remote-write is well-defined; the absence of label sanitisation is consistent with that thin-proxy stance, but the absence is not codified in any ADR — it falls under the same category as ADR-CANDIDATE-005's GenAI thin-proxy decision (the thin-proxy stance defends absence of prompt engineering, NOT absence of basic safety).
  - **Evidence**: `AbstractTimeSeriesExtractor.java:30-31` (straight pass-through via `mapper.mapToProtoLabels(labels)`)
  - **Existing-ADR-or-implied-prescription**: None directly. ADR-CANDIDATE-026 (NEW 2026-05-10B) describes the metric-storage wiring; ADR-CANDIDATE-005 (GenAI thin-proxy) is the closest precedent — thin-proxy defends scope-boundary but not safety primitives.
  - **Proposed remedy**: At minimum, document on the live `/configuration-and-deployment/odd-platform` page that metric labels are forwarded verbatim and operators should ensure ingestion-side collectors don't emit PII as labels. At maximum, add an optional `metrics.prometheus.label-allowlist` (regex or string list) that filters labels before write — operators opt in by setting the list.
  - **Severity rationale**: MEDIUM — PII pass-through to a separate operational system (Prometheus); cardinality risk is implicit but secondary.
  - **Suggested backlog grouping**: `Metric storage hardening`

- **REFACTOR-076** (NEW 2026-05-10B): No retry / backoff / DLQ on Prometheus `/api/v1/write` failures — `onErrorMap` rethrows as `PrometheusException` and the entire ingestion request fails; transient Prometheus outage (rolling restart, network blip) loses the batch
  - **Category**: missing-retry
  - **Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:performance.known_performance_gaps.[0]` (severity MEDIUM)
  - **Statement**: `ExternalIngestionMetricsServiceImpl.java:206-219` has `.onErrorMap(e -> ... throw new PrometheusException(e))` with NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `metrics.prometheus-host` produces an immediate 5xx to the calling collector; the collector must retry from outside. There is no in-memory queue, no Postgres fallback, no eventual-consistency mechanism. A Prometheus rolling restart drops every concurrent metric write.
  - **Evidence**: `ExternalIngestionMetricsServiceImpl.java:206-219` (no retry operator)
  - **Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-026 (NEW — metric storage mirrored wiring) does NOT defend retry-absence; retry is request-routing reliability, not part of the wiring choice.
  - **Proposed remedy**: Add `.retryWhen(Retry.backoff(maxAttempts, minBackoff).filter(this::isTransient))` on the WebClient call; expose `metrics.prometheus.retry.max-attempts` (default 3) and `metrics.prometheus.retry.min-backoff-millis` (default 200). Document on the live config-doc page.
  - **Severity rationale**: MEDIUM — a single transient upstream blip surfaces as ingestion failure for every concurrent collector.
  - **Suggested backlog grouping**: `Metric storage hardening`

- **REFACTOR-077** (NEW 2026-05-10B): `IllegalArgumentException` on missing `counterValue.getTotal()` aborts the entire ingestion batch — no per-point isolation; one malformed counter rejects every co-batched metric for every DataEntity in the request
  - **Category**: batch-isolation
  - **Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:bugs_limitations_corner_cases.[2]` (severity MEDIUM)
  - **Statement**: `CounterTimeSeriesExtractor.java:38-40` throws `IllegalArgumentException("Counter value is null")` when `counterValue.getTotal() == null`. The exception escapes `ExternalIngestionMetricsServiceImpl.writeRequest()` (lines 222-251) which iterates over every MetricFamily / Metric / MetricPoint in the request body — one bad point in a batch aborts the entire batch's `saveMetricsToPrometheus` chain, rejecting metrics for every co-batched DataEntity. There is no per-point try/catch, no per-extractor isolation, no `Flux.concatMapDelayError` to continue past failure.
  - **Evidence**: `CounterTimeSeriesExtractor.java:38-40` + `ExternalIngestionMetricsServiceImpl.java:222-251` (no per-extractor try/catch)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-026 (NEW) describes the per-MetricType dispatch but does NOT defend the absence of per-point isolation.
  - **Proposed remedy**: Wrap the per-MetricPoint extraction in try/catch within `writeRequest`; collect failed points as a "rejected" list returned to the caller (with structured error details); proceed with the rest of the batch. Add a Micrometer counter for rejected points.
  - **Severity rationale**: MEDIUM — operational hostility on a batch-ingestion path; a single misconfigured collector poisons the entire ingestion stream.
  - **Suggested backlog grouping**: `Metric storage hardening`

- **REFACTOR-079** (NEW 2026-05-10B): Plaintext-equality token comparison on the ingestion filter — `String.equals(...)` is not constant-time; timing-based token discovery is theoretically feasible on a local network
  - **Category**: missing-constant-time
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[2]` (severity MEDIUM)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[1]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:56` compares the inbound token to the in-DB value via `String.equals(...)` — NOT `MessageDigest.isEqual(...)`. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle of constant-time secret comparison is violated. The sibling `S2sAuthenticationFilter` has the same issue (`s2sTokenProvider.isValidToken(...)` against a YAML-configured `auth.s2s.token`). NOTE: this scope **strengthens REFACTOR-048** (token plaintext-at-rest) from the verify side — the storage shape (REFACTOR-048) and the comparison shape (REFACTOR-079) compose ADR-CANDIDATE-017's full plaintext-equality model.
  - **Evidence**: `IngestionDataEntitiesFilter.java:56` (`.equals(...)`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (token rotation semantics) codifies plaintext-equality as the model; the ADR's rationale ("long-random over TLS") implicitly accepts that timing attacks are not the primary concern. This scope is a defence-in-depth gap within the deliberate model — fixing it does NOT alter the architectural decision.
  - **Proposed remedy**: Replace `.equals(...)` with `MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8))` in BOTH `IngestionDataEntitiesFilter.java:56` AND `S2sTokenProvider.isValidToken`. Add a unit test asserting constant-time semantics under adversarial input. No ADR change required.
  - **Severity rationale**: MEDIUM — defence-in-depth gap on the credential-comparison surface.
  - **Suggested backlog grouping**: `Token rotation hardening` + `Ingestion-endpoint auth hardening`

- **REFACTOR-080** (NEW 2026-05-10B): Hard-coded path matcher in `IngestionDataEntitiesFilter` — `/ingestion/entities` exact, no `/**` suffix; future addition of `POST /ingestion/entities/batch` or `/v2` would bypass the filter silently
  - **Category**: hard-coded-path
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[3]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:28` passes the literal string `"/ingestion/entities"` (exact match, no wildcard, no `/**`) to the path-matcher constructor. There is no test, no comment, no `@docs` annotation pinning the path. A future addition of `POST /ingestion/entities/batch` (batch ingestion) or `POST /ingestion/entities/v2` (versioned API) would bypass the filter without any compile-time signal — the new endpoint would inherit the `/ingestion/**` whitelist and the catch-all permit-all behaviour.
  - **Evidence**: `IngestionDataEntitiesFilter.java:28` (literal string `"/ingestion/entities"`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 (NEW — ingestion-endpoint auth trust gradient) codifies hard-coded-per-subclass as the deliberate pattern (matcher-in-constructor); the ADR does NOT defend the absence of forward-compatibility guards.
  - **Proposed remedy**: Add an integration test that asserts every `IngestionApi`-generated `@RequestMapping` matching `/ingestion/entities*` is covered by some filter; fail the build on uncovered paths. Alternative: change the matcher to `/ingestion/entities/**` (more inclusive) — but this introduces a breaking change if new sub-paths under `/ingestion/entities/` should have DIFFERENT auth postures.
  - **Severity rationale**: MEDIUM — future-regression risk on a security-load-bearing path.
  - **Suggested backlog grouping**: `Ingestion-endpoint auth hardening`

- **REFACTOR-081** (NEW 2026-05-10B): Body-buffered-before-auth-check — `IngestionDataEntitiesFilter` reads the full request body into memory (up to 20 MB) BEFORE validating the token, allowing low-effort heap-pressure DoS via invalid-token + max-size payload
  - **Category**: body-before-auth
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[5]` (severity MEDIUM)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[4]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:37-40` calls `super.getBody().collectList()` which buffers the entire body, then `readBody(dataBuffer, DataEntityList.class)` parses it to extract `dataSourceOddrn`, THEN the token is validated against the resolved datasource. An attacker submitting maximum-size 20 MB payloads with invalid tokens forces the platform to buffer + parse the body before rejecting. The order is body-first because the dataSourceOddrn determines WHICH token to compare against. A 20-attacker concurrent burst with max-size payloads holds 400 MB in heap during validation.
  - **Evidence**: `IngestionDataEntitiesFilter.java:37-60` (body-first ordering) + `application.yml:14-15` (`spring.codec.max-in-memory-size: 20MB`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 (NEW — ingestion-endpoint auth trust gradient) codifies the per-subclass filter pattern; the ADR does NOT defend the body-first ordering.
  - **Proposed remedy**: Reorder to (1) parse the `Authorization` header first; (2) require a fast-extractable identity from the header itself (e.g., a `X-DataSource-Oddrn` companion header sent by collectors); (3) validate the token against the named datasource WITHOUT reading the body; (4) THEN parse the body and continue. Alternative: add a smaller pre-check buffer cap (e.g. 1 MB) on the ingestion path specifically — invalid tokens reject after buffering 1 MB instead of 20 MB.
  - **Severity rationale**: MEDIUM — heap-pressure DoS amplifier on an unauthenticated-by-default path (REFACTOR-078).
  - **Suggested backlog grouping**: `Ingestion-endpoint auth hardening`

- **REFACTOR-083** (NEW 2026-05-10B): Failed-auth attempts on the ingestion filter are not logged — no `log.*` call on the 401 path, no metric counter, no rate-limit, no lockout
  - **Category**: missing-audit
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[7]` (severity MEDIUM)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[2]` (severity MEDIUM)
  - **Statement**: When a token mismatch occurs, `IngestionDataEntitiesFilter.java:55-58` throws `AccessDeniedException("Token is not correct")` and `AbstractIngestionFilter.java:66-72`'s `writeResponse` returns the message verbatim — but neither path emits a log statement. A security incident review of "how many failed-auth attempts in the last hour against the ingestion endpoint" cannot be answered from application logs. There is no rate-limit / lockout / metric counter on the failure path. Same shape as REFACTOR-046 (no token rotation audit log) — investigation-readiness gap.
  - **Evidence**: `IngestionDataEntitiesFilter.java:55-58` (throw, no log) + `AbstractIngestionFilter.java:34-41` (no log on filter-match path) + `AbstractIngestionFilter.java:66-72` (writeResponse, no log)
  - **Existing-ADR-or-implied-prescription**: None defends the absence.
  - **Proposed remedy**: Add `log.warn("[ingestion-auth] failed-auth attempt from remoteAddress={} path={} reason={}", ...)` on both the missing-header and wrong-token paths in `AbstractIngestionFilter`. Add Micrometer counters `ingestion.auth.failure_total{reason}` (reason ∈ {`missing_header`, `wrong_token`, `unknown_datasource`}). Optionally: add a rate-limit on failed attempts per remote IP (e.g. 10 failures/minute/IP → temporary 429).
  - **Severity rationale**: MEDIUM — investigation-readiness gap on a security-critical path.
  - **Suggested backlog grouping**: `Ingestion-endpoint auth hardening`

- **REFACTOR-084** (NEW 2026-05-10B): Duplicate body parse — filter materialises `DataEntityList` from bytes to extract `dataSourceOddrn`, then the controller's `Mono<DataEntityList>` binding re-deserialises the same payload
  - **Category**: duplicate-parse
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:performance.known_performance_gaps.[0]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:40` deserialises the entire body to `DataEntityList` purely to extract `dataSourceOddrn`; the controller (`IngestionController.java:38`) then re-parses the same bytes into `Mono<DataEntityList>`. A per-request `O(payload-size)` Jackson parse is performed twice — non-trivial on a high-throughput ingestion path. A streaming JSON extraction of just the `dataSourceOddrn` field (e.g. via `JsonParser` walking to that key only) would avoid the duplicate parse.
  - **Evidence**: `IngestionDataEntitiesFilter.java:40` (full deserialise) + `IngestionController.java:38-44` (controller re-parses)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Replace `readBody(dataBuffer, DataEntityList.class)` in the filter with a streaming-JSON extraction of just `dataSourceOddrn`. Optionally: cache the parsed `DataEntityList` in the `ServerWebExchange.attributes` so the controller reuses it instead of re-parsing.
  - **Severity rationale**: MEDIUM — performance gap on a high-throughput ingestion path.
  - **Suggested backlog grouping**: `Ingestion-endpoint auth hardening`

- **REFACTOR-087** (NEW 2026-05-10B): No `@Min(1)` validation on `odd.activity.partition-period` — `0` produces no-partition-creation silently (no rows can INSERT); negative values produce invalid `endDate < beginDate` CREATE
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM)
  - **Statement**: `ActivityTablePartitionManager.java:11` carries `@Value("${odd.activity.partition-period:30}")` with no `@Min(1)` / `@Positive` validation. A `partition-period=0` boot would: (a) compute `bufferDate = baseline.plusDays(0)` = baseline; (b) the `while (lastPartitionDate.isBefore(bufferDate))` predicate evaluates `baseline.isBefore(baseline)` = false; (c) NO partition is created. Rows arriving for `INSERT INTO activity` would be REJECTED by Postgres with `no partition of relation "activity" found for row` — a silent operator misconfiguration produces a hard-fail INSERT path with no boot-time validation error. A negative value would attempt to CREATE a partition with `endDate < beginDate`, rejected by Postgres at CREATE time and logged at ERROR (then swallowed per REFACTOR-086).
  - **Evidence**: `ActivityTablePartitionManager.java:11` (no `@Min` / `@Positive`) + `AbstractPartitionManager.java:30,33-37` (the bufferDate + while-loop arithmetic)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW — range-partition lifecycle) does NOT defend the absence of validation.
  - **Proposed remedy**: Either add `@Positive` to the consumer (`@Positive @Value("${odd.activity.partition-period:30}")`) — requires `@Validated` at class level; OR migrate to `@ConfigurationProperties` POJO with `@Validated` + `@Positive`. Same applies to `MessageTablePartitionManager` (`datacollaboration.message-partition-period`).
  - **Severity rationale**: MEDIUM — operator-error gated; the default value saves the bundled deployment.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening`

- **REFACTOR-089** (NEW 2026-05-10B): No Micrometer / observability instrumentation on the partition lifecycle — manager emits `log.debug` on success and `log.error` on failure; no counter, no timer, no gauge for partition-creation success-rate / last-success-timestamp / partition-count
  - **Category**: observability
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:performance.known_performance_gaps.[1]` (severity MEDIUM)
  - **Statement**: `AbstractPartitionManager.java:43-44` emits `log.debug` on success (debug level — not captured by default in production logging configuration). `PostgreSQLPartitionCreationJob.java:58-59` emits `log.error` on failure (captured but not actionable without alerting). Grep of the partition package for `MeterRegistry|Counter|Timer|Gauge` returns zero matches. An operator monitoring an ODD deployment has no metric to alert on "partition creation has been failing silently for 30 days." This is essentially the same gap as REFACTOR-086 but specifically about Micrometer observability instrumentation as opposed to the continue-on-failure orchestration; REFACTOR-086 is the orchestration-level gap; REFACTOR-089 is the metric-instrumentation gap.
  - **Evidence**: `AbstractPartitionManager.java:43-44` (debug-only log) + `PostgreSQLPartitionCreationJob.java:58-59` (error log only) + grep zero matches for Micrometer types
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) codifies the continue-on-failure orchestration but does NOT defend the absence of observability; the architectural choice prioritises maximum coverage and CAN coexist with full observability.
  - **Proposed remedy**: Same as REFACTOR-086 — add Micrometer counters/timers/gauges. Adopt as a project-wide convention via a `@PartitionLifecycle` meta-annotation or a `MeterBinder` in the partition package.
  - **Severity rationale**: MEDIUM — observability gap.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening` (paired with REFACTOR-086)

- **REFACTOR-090** (NEW 2026-05-10B): Partition creation requires CREATE TABLE privilege on `public` schema for the application's DB role — the deployment doc does not surface this requirement; least-privileged DB roles silently degrade
  - **Category**: missing-doc-prereq
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:security.known_security_gaps.[0]` (severity MEDIUM)
  - **Statement**: `PartitionServiceImpl.java:55-69` executes `CREATE TABLE IF NOT EXISTS %s PARTITION OF %s` DDL. The application's DB role must have CREATE privilege on the `public` schema to succeed. The live `/configuration-and-deployment/odd-platform` page documents the partition-period config key but does NOT enumerate DB role privilege requirements for partitioning. An operator running ODD against a managed Postgres with a least-privileged DB role (INSERT/SELECT but no DDL) would fail partition creation at boot, log ERROR (REFACTOR-086 swallows it), and silently degrade — `activity` INSERTs would then fail when the existing partition window is exhausted.
  - **Evidence**: `PartitionServiceImpl.java:55-69` (CREATE TABLE DDL) + WebFetch of `/configuration-and-deployment/odd-platform` on 2026-05-10 (status 200, no role-privilege requirements section)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) does not address DB-role prerequisites.
  - **Proposed remedy**: Document on the live `/configuration-and-deployment/odd-platform` page a "Required PostgreSQL role privileges" section enumerating: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables; **`CREATE` on `public` schema (for range-partition lifecycle)**; `USAGE` on sequences; etc. Optionally add a boot-time validator (REFACTOR-073's `SecurityPostureValidator` can subsume this) that probes `current_setting('is_superuser')` + `has_schema_privilege('public', 'CREATE')` and emits a clear error.
  - **Severity rationale**: MEDIUM — deployment-pre-req documentation gap with security-policy implications.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening` (doc-side DOC-NNN follow-up)

- **REFACTOR-066** (NEW 2026-05-10A): Slack delivery sender is single-leader across the deployment via Postgres advisory lock — horizontal scaling does NOT increase Slack throughput; Discussions feature is bounded at ~1 msg/sec by fixed 1s sleep between iterations
  - **Category**: observability (capacity-planning)
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:performance.scaling_characteristics`
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:performance.known_performance_gaps.[0]` (LOW per sidecar, surfaced as MEDIUM here for capacity-planning visibility)
  - **Statement**: The sender thread is single-leader across the deployment via Postgres advisory lock id 120 (default). Horizontal scaling of the API process does NOT linearly scale Slack delivery — only one node ever holds the lock and drains the queue. The sender loop's polling cadence is fixed at 1 second between empty queue checks (`DataCollaborationMessageSenderJob.java:70`); under low volume, this is ~1s of fixed end-to-end latency from `202 Accepted` to Slack delivery. Under high volume, retries (1-second sleep in the catch block — line 60) further serialise throughput. A backlog of 1000 messages takes >16 minutes to drain at best.
  - **Evidence**: `DataCollaborationMessageSenderJob.java:60, 70, 93-95` + `DataCollaborationProperties.java:10`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the single-leader-via-advisory-lock shape. This scope is the structural consequence; the ADR's Postgres-as-only-dependency rationale defends the choice. The maintainer should document the throughput characteristics on the live `data-collaboration` page as a capacity-planning consideration.
  - **Proposed remedy**: At minimum, document on the live `data-collaboration` page that Discussions throughput is bounded at ~1 msg/sec and scales with sender-loop tuning, NOT with horizontal scaling of the API tier. Optionally, add a configurable `datacollaboration.sender.poll-interval-millis` (default 1000) and `datacollaboration.sender.batch-size` (default 1) for operators willing to tune.
  - **Severity rationale**: MEDIUM — capacity-planning gap; operators sizing the platform for Discussions usage have no documented limit.
  - **Suggested backlog grouping**: `Data Collaboration hardening`

### LOW severity

- **REFACTOR-039**: i18n `localStorage` access is unguarded — privacy-mode browsers where `localStorage` throws cause UI to fail to render
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:bugs_limitations_corner_cases.[3]` (LOW)
    - `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:bugs_limitations_corner_cases.[1]` (LOW)
  - **Statement**: `odd-platform-ui/src/locales/i18n.ts:22` and `SelectLanguage.tsx:30` access `localStorage` with no try/catch. Safari private mode + sandboxed iframes raise on `localStorage` access; the bootstrap import-for-side-effects raises before `<App />` renders → entire UI unreachable.
  - **Evidence**: `i18n.ts:22` + `SelectLanguage.tsx:28-33`
  - **Proposed remedy**: Wrap both in try/catch with a safe fallback to default language.
  - **Severity rationale**: LOW — affects a small operator subset.
  - **Suggested backlog grouping**: `i18n cleanup`

- **REFACTOR-040**: SelectLanguage friendly-name and country-code maps use TypeScript casts with no runtime guard — adding a locale to `i18n.ts` without updating `LANGUAGES_MAP`/`LANG_TO_COUNTRY_CODE_MAP` crashes the language dialog
  - **Category**: missing-validation
  - **Surfaced by**: `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:bugs_limitations_corner_cases.[0]` (MEDIUM in sidecar but LOW at concept level)
  - **Statement**: `SelectLanguage.tsx:48-50, 60` use TypeScript casts; if a locale is added to `i18n.ts` but not the constant maps, the dialog crashes with a `TypeError`.
  - **Evidence**: `SelectLanguage.tsx:48-50, 60` + `lib/constants.ts:158-174`
  - **Proposed remedy**: Either add a runtime guard (`if (LANGUAGES_MAP[lang]) ...`) or unify the locale list into a single source-of-truth that the maps derive from.
  - **Severity rationale**: LOW — surfaces only when a contributor adds a locale.
  - **Suggested backlog grouping**: `i18n cleanup`

- **REFACTOR-041**: Reflection-based ODDRN-property extraction in Directory unmemoised — per-request, per-data-source `@PathField` field set re-discovered and getter Method re-resolved
  - **Category**: observability (performance)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:bugs_limitations_corner_cases.[3]` (LOW)
    - `concepts.yaml:entities[Directory].performance_aggregate.weaknesses.[2]`
  - **Statement**: `DirectoryServiceImpl.getOddrnPathProperties` uses Java reflection on every data-source row in `/api/directory/datasources`; cost compounds with prefix-list size.
  - **Evidence**: `DirectoryServiceImpl.java:153-171`
  - **Proposed remedy**: Memoise per-class `@PathField` field set + getter Methods (compute once at startup or lazily on first encounter, cache by class). Or replace reflection with a generated mapper.
  - **Severity rationale**: LOW — performance scaling issue.
  - **Suggested backlog grouping**: `Directory performance`

- **REFACTOR-042**: No `@Timed` / Micrometer / structured-logging at DataEntityController boundary — 40 endpoints invisible to controller-layer observability
  - **Category**: observability
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[5]` (LOW)
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses.[4]`
  - **Statement**: 40 endpoints, none observed at the controller boundary; latency regressions visible only via downstream service / DB metrics.
  - **Evidence**: `DataEntityController.java:1-454` (no `@Timed`, no `MeterRegistry`)
  - **Proposed remedy**: Add `@Timed` (Spring Boot Actuator + Micrometer auto-config) at class level on every controller. Adopt as a project-wide convention via a `Controller`-marker meta-annotation.
  - **Severity rationale**: LOW — observability gap.
  - **Suggested backlog grouping**: `Observability cleanup`

- **REFACTOR-043**: Generated AlertManager `generatorURL` is rewritten with Prometheus-Web-UI–specific query params — non-Prometheus AlertManager fronts (Mimir, Thanos, VictoriaMetrics) produce non-functional UI links
  - **Category**: missing-validation
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[4]` (LOW)
  - **Statement**: `AlertServiceImpl.java:168-172` embeds `g0.moment_input` and `g0.end_input` (Prometheus PromQL UI query params) into the stored alert chunk's description. If the operator's AlertManager fronts something other than Prometheus, the link may not navigate.
  - **Evidence**: `AlertServiceImpl.java:168-172` + `AlertServiceImpl.java:185`
  - **Proposed remedy**: Make the URL-rewrite optional via `attachment.alertmanager.rewrite-prometheus-ui-params: true` (default true to preserve current behaviour). Add a code comment explaining the Prometheus-specific assumption.
  - **Severity rationale**: LOW — affects non-Prometheus deployments.
  - **Suggested backlog grouping**: `AlertManager hardening`

- **REFACTOR-061** (NEW 2026-05-10A): `getActivity` `lasEventId` parameter is a typo on the public API contract — the service-interface name is correct (`lastEventId`), but the controller method's local variable name leaks the typo to the OpenAPI-generated client signature
  - **Category**: contract-typo
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[0]` (LOW)
  - **Statement**: `ActivityController.java:34` declares `final Long lasEventId` (missing the `t` in `last`). The OpenAPI parameter name is `last_event_id` (correct) but the Java method signature exposes `lasEventId`. Generated client code derived from this signature carries the typo. Since the controller delegates straight to `activityService.getActivityList(... lasEventId, lastEventDateTime)`, the typo also affects the local variable name. The service interface (`ActivityService.java:42`) correctly names the parameter `lastEventId` — only the controller layer carries the typo. Fixing it is a one-character change but produces a breaking change to the generated client signature.
  - **Evidence**: `ActivityController.java:34` (`final Long lasEventId`) + `ActivityService.java:42` (`final Long lastEventId` — correctly named at the service interface)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (cursor pagination convention) describes the parameter shape; this scope is a contract-naming bug.
  - **Proposed remedy**: Rename the controller parameter to `lastEventId`. Note this changes the OpenAPI-generated client signature in any consumer that bound to the typo'd name; an MAJOR version bump or a deprecation cycle may be required depending on the client surface.
  - **Severity rationale**: LOW — naming bug; not security/correctness, but professionalism.
  - **Suggested backlog grouping**: `Activity feed hardening`

- **REFACTOR-065** (NEW 2026-05-10A): Token-rotation endpoint has no idempotency token (no `If-Match` ETag); UI double-submit (slow click, network retry) rotates the token twice and invalidates the value the user just copied to clipboard
  - **Category**: idempotency
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[7]` (LOW)
  - **Statement**: `CollectorController.java:47-51` consults no headers on the PUT. `CollectorApi` has no `If-Match` parameter on the operation. A UI double-submit (slow click → user clicks again before response, network-retry by browser) rotates the token twice. The response body's `token.value` would be the most recent, but the in-flight first response is now stale immediately — if the user copy-paste-uses the first response's token, ingestion fails.
  - **Evidence**: `CollectorController.java:47-51` (no header check) + `CollectorApi` (generated; no `If-Match` parameter on the operation)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add `If-Match` ETag support: include the current `TOKEN.updated_at` (or a ULID/UUID per token state) in `Collector` GET responses; require `If-Match: <etag>` on the rotation PUT; reject mismatch with HTTP 412 Precondition Failed. UI consumes the etag; double-submit produces a clear 412 instead of a silent stale-token UX.
  - **Severity rationale**: LOW — UX papercut on a critical flow.
  - **Suggested backlog grouping**: `Token rotation hardening`

- **REFACTOR-070** (NEW 2026-05-10B): No test coverage for `AppInfoController` — grep across `odd-platform-api/src/test` for `AppInfoController`, `getAppInfo`, and the literal `auth.type` returns no hits
  - **Category**: missing-test
  - **Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:tests_coverage_semantic.gaps` (severity LOW)
  - **Statement**: Zero test coverage. No `@WebFluxTest`, no slice test, no integration test asserts the path security of `/api/appInfo` or the shape of the returned `AppInfo` payload. A regression that (1) silently drops `authType` from the DTO, (2) changes path security so an unauthenticated caller can no longer reach `/api/appInfo` (breaking the SPA's login render), or (3) adds new fields to `AppInfo` containing operator-sensitive metadata (build SHA, hostname, etc.) would not be caught.
  - **Evidence**: grep results 2026-05-10 (zero matches)
  - **Proposed remedy**: Add `@WebFluxTest(AppInfoController.class)`; assert for each of `DISABLED / LOGIN_FORM / OAUTH2 / LDAP` (a) the returned `authType` matches the configured value, (b) the response shape is `{projectVersion, authType}` only (no operator-sensitive metadata leaked), (c) the path-security posture is as documented (currently undocumented — see REFACTOR-068).
  - **Severity rationale**: LOW — process leverage; catches REFACTOR-068-class regressions if path-security ever changes.
  - **Suggested backlog grouping**: `Controller test bootstrap`

- **REFACTOR-088** (NEW 2026-05-10B): `partition.advisory-lock-id` has no `:default` and is undocumented on the live config page — operator deletion of the key fails bean wiring at boot
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[5]` (severity LOW)
  - **Statement**: `PostgreSQLPartitionCreationJob.java:26` declares `@Value("${partition.advisory-lock-id}")` with NO `:default` (unlike the partition-period's `:30`). If an operator deletes the `partition.advisory-lock-id` key from a customised `application.yml` (or sets `PARTITION_ADVISORY_LOCK_ID=`), bean wiring at boot fails with `Could not resolve placeholder`. The live `/configuration-and-deployment/odd-platform` page does NOT list `partition.advisory-lock-id` — it is a "configuration ghost" for operators, while sibling lock-ids (`notifications.wal.advisory-lock-id`, `datacollaboration.receive-event-advisory-lock-id`) ARE listed.
  - **Evidence**: `PostgreSQLPartitionCreationJob.java:26` (no `:default`) + `application.yml:197-198` (`partition: advisory-lock-id: 90`) + WebFetch of `/configuration-and-deployment/odd-platform` on 2026-05-10 (status 200, `partition.advisory-lock-id` ABSENT from the documented set)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) describes the dual-lock concurrency model but does NOT defend the missing default + undocumented key.
  - **Proposed remedy**: Add `:90` default (`@Value("${partition.advisory-lock-id:90}")`) so removing the key from application.yml still boots. Document the key on the live `/configuration-and-deployment/odd-platform` page alongside the other advisory-lock-id keys.
  - **Severity rationale**: LOW — operator-error gated; ships with sane default.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening` (doc-side DOC-NNN follow-up)

- **REFACTOR-091** (NEW 2026-05-10B): `@Scheduled(cron = "0 1 0 * * *")` is server-timezone-implicit — multi-region instances may create partitions at different wall-clock times
  - **Category**: timezone-implicit
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[6]` (severity LOW)
  - **Statement**: `PostgreSQLPartitionCreationJob.java:40` declares `@Scheduled(cron = "0 1 0 * * *")` with no `zone =` attribute. Spring's `@Scheduled` defaults to the server's local timezone unless `zone` is specified; the cron runs at `00:01` local server time. A multi-region deployment where instances run in different timezones would attempt to create partitions at different wall-clock times. In single-instance deployments, the date boundary at midnight server-local-time may not match the `baseline = DateTimeUtil.generateNow().toLocalDate()` returned for an INSERT firing at that moment. ShedLock's 10m hold prevents the same instance from re-firing; multi-instance races on `baseline` calculation at midnight UTC offset boundaries could theoretically produce off-by-one partition boundaries.
  - **Evidence**: `PostgreSQLPartitionCreationJob.java:40` (no `zone =` attribute) + `AbstractPartitionManager.java:23` (`DateTimeUtil.generateNow().toLocalDate()` — local-date, not Instant)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) does not address timezone.
  - **Proposed remedy**: Add explicit `zone = "UTC"` to the `@Scheduled` annotation. Update `DateTimeUtil.generateNow()` consumers in the partition code path to use `Instant`/`ZonedDateTime` instead of `LocalDate` so partition boundaries are deterministic across timezones.
  - **Severity rationale**: LOW — theoretical; ShedLock's 10m window covers the common cases.
  - **Suggested backlog grouping**: `Activity partition lifecycle hardening`

- **REFACTOR-067** (NEW 2026-05-10A): `getActivity` `size` parameter has no documented or enforced upper bound — caller submitting `size=Integer.MAX_VALUE` is rate-limited only by the repository's query plan
  - **Category**: missing-validation
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[3]` (LOW per sidecar)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:performance.known_performance_gaps.[0]` (MEDIUM per sidecar)
  - **Statement**: `ActivityController.java:26` declares `final Integer size` with no `@Max` annotation, no programmatic check. `ActivityServiceImpl.java:179-181` passes the parameter through to the repository unchanged. A caller submitting `size=Integer.MAX_VALUE` is rate-limited only by the repository's query plan and Postgres's LIMIT clause behaviour. The cursor design assumes well-behaved clients page through with reasonable `size`; that assumption is undocumented.
  - **Evidence**: `ActivityController.java:26` + `ActivityServiceImpl.java:179-181`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (cursor pagination) describes the cursor shape; this scope is the missing per-page bound.
  - **Proposed remedy**: Add `@Max(200)` on `size`. Add `default: 50` on the OpenAPI spec. Document on the live activity-feed page.
  - **Severity rationale**: LOW — consistent with REFACTOR-020 (the platform-wide pagination-unbounded gap class).
  - **Suggested backlog grouping**: `Activity feed hardening` (parallels `OpenAPI contract hardening`)

## Cross-references with concepts.yaml security_aggregate / performance_aggregate

For maintainers reading `concepts.yaml`, the per-concept `weaknesses` lists map into the REFACTOR-NNN entries above:

| Concept | Aggregate.weaknesses entries | REFACTOR-NNN |
|---|---|---|
| **Data Entity** | term/terms drift; auth-mode-only reads; activity audit-trail exposure; messages cross-tenant exposure; auth path-string-coupling no guard | REFACTOR-008, REFACTOR-009, REFACTOR-015, [activity / messages exposure could be folded under ADR-CANDIDATE-003 triage] |
| **Data Entity** (performance) | size unbounded; lineageDepth unbounded; DataEntityGroup lineage no depth param; no caching on aggregates; no controller observability; no bulk endpoints; Directory all-sources unfiltered; reflection unmemoised | REFACTOR-044, REFACTOR-020, REFACTOR-038, REFACTOR-041, REFACTOR-042 |
| **Alert** (security) | getAllAlerts ungated (STRENGTHENED 2026-05-10A); changeAlertStatus ungated; reopen-guard race | REFACTOR-024, REFACTOR-025, REFACTOR-037 |
| **AlertManager Webhook Receiver** | no app auth (defended by ADR-CANDIDATE-006); alert spoofing; no rate-limit/dedup; silent orphan; tz-naive timestamp | REFACTOR-017, REFACTOR-018, REFACTOR-032; alert-spoofing addressed by ADR-CANDIDATE-006 + REFACTOR-018 |
| **Attachment** (security) | read-path asymmetry; max-size bypass (STRENGTHENED 2026-05-10A); S3 creds in /actuator/env; cross-entity uploadId hijack (STRENGTHENED 2026-05-10A); no audit on download; no virus scan; CD filename injection | REFACTOR-013, REFACTOR-029, REFACTOR-010, REFACTOR-012, REFACTOR-015 (audit), [virus-scan: out of scope this run; surface as separate scope if maintainer cares] |
| **Attachment** (performance) | LSN-001 LOCAL ephemeral; multi-instance LOCAL broken (EXTENDED 2026-05-10A — REFACTOR-058 generalises to REMOTE too); LSN-002 us-east-1; MinIO timeouts; no Range; bucket no-validate; getAttachments no-pagination; reflection unmemoised | REFACTOR-026, REFACTOR-033, REFACTOR-058, REFACTOR-027, REFACTOR-034, REFACTOR-028 |
| **GenAI Assistant** (security) | prompt-injection unmitigated (PARTIAL — defended by thin-proxy stance for prompt engineering, NOT for length/sanitisation); url no-validation; DISABLED+enabled anonymous; no outbound auth; no rate-limit; no audit log; no GENAI_USE permission | REFACTOR-001, REFACTOR-003, REFACTOR-004, REFACTOR-007, REFACTOR-016, REFACTOR-019 |
| **GenAI Assistant** (performance) | requestTimeout=0; no retry; no concurrency cap; no cache; no observability; no max-in-memory-size; no hot-reload | REFACTOR-002, REFACTOR-005, REFACTOR-006 |
| **Directory** | Directory reconnaissance; doc-warn missing; ODDRN host/database leak; no fail-closed second line | [Directory reconnaissance under ADR-CANDIDATE-003 triage; doc-warn is DOC-NNN; ODDRN-leak is operational concern at triage] |
| **Directory** (performance) | level-1 unpaginated; level-2 unpaginated; reflection unmemoised; no HTTP cache; aggregation broad | REFACTOR-038, REFACTOR-041 |
| **Locale Bundle** | localStorage unguarded; CSP doc gap; (security overall HIGH means "no concerns surface"; not an inverted scale) | REFACTOR-039, REFACTOR-040 |
| **Collector / Token (NEW 2026-05-10A)** | non-SecureRandom RNG; no audit log; no grace period; plaintext-at-rest; DISABLED bypass; cache-leak via response body; no rate-limit; non-`@ReactiveTransactional`; no idempotency | REFACTOR-045, REFACTOR-046, REFACTOR-047, REFACTOR-048, REFACTOR-049, REFACTOR-062, REFACTOR-063, REFACTOR-064, REFACTOR-065 |
| **Data Collaboration / Slack messaging (NEW 2026-05-10A)** | no authz gate (cross-owner); no body validation; channel_id unscoped; no audit log; no inbound rate-limit; non-discriminating Slack rate-limit handling; caller cannot observe send failure; sender single-leader | REFACTOR-050, REFACTOR-051, REFACTOR-056, [audit log — same shape as Activity / Token: log.info at boundary, surface as REFACTOR-NNN if maintainer prioritises], REFACTOR-052, REFACTOR-055, REFACTOR-054, REFACTOR-066 |
| **Activity feed (NEW 2026-05-10A)** | cross-owner exposure; lasEventId typo; userIds/ownerIds enumeration; size unbounded; free-text description exposure; counts cross-owner aggregate; type=null vs type=ALL dual-path | REFACTOR-053, REFACTOR-061, REFACTOR-060, REFACTOR-067, [free-text description exposure — folded into REFACTOR-053's data_exposure framing; surface as separate scope if maintainer prefers item-per-disclosure-class], REFACTOR-057, REFACTOR-059 |
| **AppInfo / `/api/appInfo` (NEW 2026-05-10B)** | DISABLED-default unauth fingerprinting; empty/typo auth.type silent breakage; zero test coverage | REFACTOR-068, REFACTOR-069, REFACTOR-070 |
| **AuthorizationManagerCondition + Authorization framework (NEW 2026-05-10B)** | dead-code Condition; LOGIN_FORM bypasses AuthorizationCustomizer; cross-cutting no-boot-time-security-posture-validator | REFACTOR-071, REFACTOR-072, REFACTOR-073 |
| **Metric storage / Prometheus (NEW 2026-05-10B)** | tenant-id label asymmetry; label PII pass-through; no retry on remote-write; IllegalArgumentException rejects entire batch | REFACTOR-074, REFACTOR-075, REFACTOR-076, REFACTOR-077 |
| **Ingestion-endpoint auth (NEW 2026-05-10B)** | default-off unauthenticated; plaintext .equals not constant-time (corroborates REFACTOR-048); hard-coded path; body-buffered-before-auth; AlertManager sibling unprotected (misnamed property); no failed-auth log; duplicate body parse | REFACTOR-078, REFACTOR-079, REFACTOR-080, REFACTOR-081, REFACTOR-082, REFACTOR-083, REFACTOR-084 |
| **Activity partition lifecycle (NEW 2026-05-10B)** | NO retention/DROP (LSN-001 shape doc-contradiction); silent-fail swallow; no @Min(1) validation; advisory-lock-id no :default and undocumented; no Micrometer observability; CREATE TABLE privilege undocumented; cron timezone-implicit | REFACTOR-085, REFACTOR-086, REFACTOR-087, REFACTOR-088, REFACTOR-089, REFACTOR-090, REFACTOR-091 |

Concepts not enumerated above (`AlertManager Webhook Receiver` in security overall LOW with `cross_file_inconsistencies: []`; `ODDRN`, `Auth Mode`, `Ingestion Filter`) carry no per-concept aggregate weaknesses driving NEW scope entries beyond what's already listed. The `Auth Mode` concept's coverage has materially expanded with batch 2026-05-10B — see the new `AppInfo` and `AuthorizationManagerCondition + Authorization framework` rows above; the gaps surfaced from the config-key-consumer layer corroborate and extend the controller-layer gaps already present.

## Cross-references with implicit-adrs.md

The following ADR candidates are cross-linked from this artefact (the reverse direction — ADR-CANDIDATE-NNN's "Co-surfaced gaps" section names the REFACTOR-NNNs):

- **ADR-CANDIDATE-001** (controllers as OpenAPI delegates) → REFACTOR-008 (path drift), REFACTOR-014 (spec-incomplete error responses), REFACTOR-021 / -022 / -023 (no controller tests)
- **ADR-CANDIDATE-002** (centralised SECURITY_RULES) → REFACTOR-008 (term mismatch is the canonical retrospective), REFACTOR-009 (no drift detection), REFACTOR-024 / -025 / -050 (rule-violations: getAllAlerts, changeAlertStatus, postMessageInSlack)
- **ADR-CANDIDATE-003** (read-collaborative GET-uniformly-authenticated, BORDERLINE) → REFACTOR-015 (activity audit exposure), REFACTOR-024 (getAllAlerts), REFACTOR-053 (Activity-feed cross-owner exposure NEW), REFACTOR-057 (Activity counts cross-owner aggregate NEW), [Directory reconnaissance], [Slack messages cross-tenant]
- **ADR-CANDIDATE-004** (GenAI disabled-by-default + fail-fast) → REFACTOR-005 (validation not engaged), REFACTOR-006 (requestTimeout=0 confusing), REFACTOR-019 (DISABLED+enabled gap)
- **ADR-CANDIDATE-005** (GenAI thin-proxy stance) → defends absence of prompt enrichment; does NOT defend absence of REFACTOR-001 (auth), REFACTOR-002 (retry), REFACTOR-003 (rate-limit), REFACTOR-004 (length cap / sanitisation), REFACTOR-007 (audit log), REFACTOR-016 (URL allowlist)
- **ADR-CANDIDATE-006** (AlertManager network-delegated auth) → defends absence of app-layer auth; does NOT defend REFACTOR-017 (rate-limit / dedup / payload cap), REFACTOR-018 (silent orphan)
- **ADR-CANDIDATE-011** (i18n natural-keys) → REFACTOR-030 (fallbackLng bug)
- **ADR-CANDIDATE-012** (attachment storage `@ConditionalOnProperty`) → REFACTOR-026 (LSN-001), REFACTOR-027 (LSN-002), REFACTOR-028 (bucket no-validate), REFACTOR-033 (multi-instance LOCAL broken), REFACTOR-058 (multi-instance chunk staging storage-INDEPENDENT — NEW), REFACTOR-036 (boot-crash on unset)
- **ADR-CANDIDATE-013** (REMOTE = MinIO SDK only) → REFACTOR-027 (LSN-002 canonical), REFACTOR-029 (S3 creds in /actuator/env), REFACTOR-034 (MinIO timeouts not configurable)
- **ADR-CANDIDATE-014** (AlertManagerController hand-coded exception) → REFACTOR-031 (DTO drops fields), REFACTOR-032 (timezone-naive)
- **ADR-CANDIDATE-016** (max-file-size as UX hint) → REFACTOR-013 (server-side bypass — the gap-shaped split, STRENGTHENED 2026-05-10A), REFACTOR-035 (no quota), REFACTOR-036 (boot-crash on unset)
- **ADR-CANDIDATE-017** (NEW — token rotation semantics) → REFACTOR-045 (non-SecureRandom RNG — direct violation of "long-random opaque" implicit precondition), REFACTOR-046 (no audit log), REFACTOR-047 (no grace period — structural consequence of in-place UPDATE), REFACTOR-048 (plaintext-at-rest — structural consequence of plaintext-equality), REFACTOR-049 (DISABLED bypass), REFACTOR-062 (response cache-leak), REFACTOR-063 (no rate-limit), REFACTOR-064 (non-transactional inconsistency), REFACTOR-065 (no idempotency)
- **ADR-CANDIDATE-018** (NEW — Slack OAuth fail-fast at boot) → no defended gaps; the inverse — GenAI does NOT use this pattern, captured at REFACTOR-005/006
- **ADR-CANDIDATE-019** (NEW — Data Collaboration disabled-by-default) → no defended gaps; the disabled-by-default does NOT defend REFACTOR-050..056 once enabled
- **ADR-CANDIDATE-020** (NEW — decoupled-outbound-delivery) → REFACTOR-051 (no body validation), REFACTOR-052 (no inbound rate-limit), REFACTOR-054 (caller cannot observe send failure), REFACTOR-055 (Slack rate-limit handling non-discriminating), REFACTOR-066 (sender single-leader — structural consequence)
- **ADR-CANDIDATE-021** (NEW — cursor pagination for activity streams) → REFACTOR-061 (lasEventId typo on public contract), REFACTOR-067 (size unbounded)
- **ADR-CANDIDATE-022** (NEW — view-modes-as-single-parameter) → REFACTOR-059 (type=null vs type=ALL dual-path defence-in-depth gap)
- **ADR-CANDIDATE-023** (NEW — uploadId-as-session-key) → REFACTOR-010 (cross-entity uploadId hijack — structural consequence; STRENGTHENED 2026-05-10A), REFACTOR-058 (multi-instance chunk staging — NEW)
- **ADR-CANDIDATE-024** (NEW 2026-05-10B — AppInfo auth-mode introspection contract) → REFACTOR-068 (DISABLED-default unauth fingerprinting — structural consequence of pre-auth reachability), REFACTOR-069 (empty/typo auth.type silent breakage), REFACTOR-070 (zero test coverage)
- **ADR-CANDIDATE-025** (NEW 2026-05-10B — AnyNestedCondition idiom) → REFACTOR-071 (dead-code Condition — the IDIOM is sound but this INSTANCE is dead), REFACTOR-072 (LOGIN_FORM bypasses AuthorizationCustomizer — the OR-disjunction only covers OAUTH2+LDAP)
- **ADR-CANDIDATE-026** (NEW 2026-05-10B — metric storage mirrored `@ConditionalOnProperty`) → REFACTOR-074 (tenant-id label asymmetry write-vs-read), REFACTOR-075 (label PII pass-through), REFACTOR-076 (no retry on remote-write), REFACTOR-077 (IllegalArgumentException rejects entire batch)
- **ADR-CANDIDATE-027** (NEW 2026-05-10B — ingestion-endpoint auth trust gradient) → REFACTOR-078 (default-off unauthenticated ingestion — LSN-001 shape), REFACTOR-079 (plaintext .equals not constant-time — STRENGTHENS REFACTOR-048 from verify side), REFACTOR-080 (hard-coded path), REFACTOR-081 (body-buffered-before-auth), REFACTOR-082 (AlertManager sibling unprotected + misnamed property — corroborates ADR-CANDIDATE-006), REFACTOR-083 (no failed-auth logging), REFACTOR-084 (duplicate body parse)
- **ADR-CANDIDATE-028** (NEW 2026-05-10B — range-partition lifecycle) → REFACTOR-085 (NO retention/DROP for activity table — LSN-001 shape doc-contradiction), REFACTOR-086 (silent-fail swallow on CREATE failure — orchestration gap), REFACTOR-087 (no `@Min(1)` validation), REFACTOR-088 (advisory-lock-id no :default + undocumented), REFACTOR-089 (no Micrometer observability — instrumentation gap), REFACTOR-090 (CREATE TABLE privilege undocumented), REFACTOR-091 (cron timezone-implicit)

**Cross-cutting (not anchored to a single ADR)**:
- **REFACTOR-073** (NEW 2026-05-10B — no boot-time security-posture validator) — triangulated across 3 sidecars: AppInfoController + AuthorizationManagerCondition + IngestionDataEntitiesFilter. ADR-CANDIDATE-018 (Slack OAuth fail-fast at boot) is the closest prescription (apply the fail-fast pattern to the security-mode wiring) but no governing ADR codifies a unified security-posture-validator. The maintainer triage should consider whether a new ADR is warranted — "fail-fast at boot for any security-relevant misconfiguration" — or whether REFACTOR-073 is itself a structural change that warrants an ADR rather than only a backlog item.

The maintainer reading the ADR sees the gaps the ADR does NOT defend; the maintainer reading the scope sees which ADR (if any) the gap is a deviation from.

## Maintainer notes

(Free-form section preserved across refreshes. Empty on first run.)
