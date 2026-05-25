---
artefact: refactoring-scopes
generated_at: "2026-05-19T14:30:00Z"
generated_at_commit: ede5d277
sidecar_count: 55
prompt_version: "adr-archaeologist/0.2.0"
total_scopes: 227
scopes_by_severity: { CRITICAL: 0, HIGH: 66, MEDIUM: 106, LOW: 55 }
scopes_by_category: { missing-auth: 11, missing-retry: 3, missing-rate-limit: 6, missing-sanitisation: 2, missing-audit: 8, missing-validation: 30, missing-pagination: 1, missing-quota: 1, missing-test: 4, buggy-default: 12, path-mismatch: 1, deferred-failure: 1, header-injection: 1, race-condition: 4, error-mapping: 4, observability: 7, missing-grace-period: 1, weak-rng: 1, plaintext-at-rest: 1, response-cache-leak: 1, idempotency: 1, transactional-consistency: 2, multi-instance-fs: 1, contract-typo: 1, enumeration-vector: 1, dual-path: 1, dead-code: 3, info-disclosure: 1, missing-fail-fast: 2, label-asymmetry: 1, batch-isolation: 1, missing-retention: 2, missing-doc-prereq: 1, timezone-implicit: 1, body-before-auth: 1, missing-constant-time: 1, duplicate-parse: 1, hard-coded-path: 1, missing-cors: 1, missing-warn-log: 1, silent-feature-ignored: 1, missing-csrf: 2, missing-actuator-gating: 1, open-redirect: 1, missing-default: 2, fragile-parsing: 2, credential-leak: 3, session-cookie-flags: 1, no-brute-force-defence: 1, no-failure-handler: 1, doc-code-drift: 3, no-multi-replica-session: 1, no-config-field: 2, fragile-wiring: 1, scheme-enforcement: 1, substring-collision: 1, no-admin-path: 1, size-limit-silent-trunc: 1, ad-config-ignored: 1, no-health-check: 1, owner-mapping-drift: 1, no-retry-no-dlq: 1, partial-delivery: 1, unsigned-webhook: 1, status-code-narrow: 1, no-channel-filter: 1, advisory-lock-collision: 2, pii-disclosure: 1, replication-slot-orphan: 1, smtp-timeout: 1, lombok-tostring-leak: 1, partial-home-properties: 1, advisory-lock-registry: 1, primitive-default-leak: 1, jooq-precedence-bug: 1, block-in-transaction: 1, no-dryrun: 1, sequential-connection: 1, no-backlog-metric: 1, lock-window-race: 1, missing-tls-trust: 1, smtp-implicit-tls: 1, smtp-oauth2: 1, no-email-validation: 1, port-default-zero: 1, npe-on-boxed-bool: 1, recipient-parse-fragile: 1, no-conn-pool: 1, no-reply-headers: 1, no-upper-bound: 1, refactor-risk: 1, no-validated: 2, doc-spelling-drift: 1, url-no-validation: 1, empty-map-passes: 1, provider-conditional-unvalidated: 1, scope-required-unvalidated: 1, ad-domain-unvalidated: 1, postconstruct-gated-by-conditional: 1 }
batch_2026_05_10A_summary: { added_scopes: 23, strengthened_scopes: 4 }
batch_2026_05_10B_summary: { added_scopes: 24, strengthened_scopes: 1 }
batch_2026_05_12C_summary: { added_scopes: 49, strengthened_scopes: 1 }
batch_2026_05_12D_summary: { added_scopes: 42, strengthened_scopes: 4 }
batch_2026_05_12E_summary: { added_scopes: 28, strengthened_scopes: 3 }
batch_2026_05_12F_summary: { added_scopes: 17, strengthened_scopes: 5 }
batch_2026_05_13G_summary: { added_scopes: 12, strengthened_scopes: 4, new_scopes_by_severity: { HIGH: 5, MEDIUM: 5, LOW: 2 }, new_scopes_by_category: { buggy-default: 1, missing-validation: 2, missing-sanitisation: 1, missing-rate-limit: 1, missing-index: 1, missing-filter: 1, name-behaviour-drift: 1, missing-error-translation: 1, missing-defence-in-depth: 1, permission-bypass: 1, performance-redundant-query: 1 } }
batch_2026_05_19H_summary: { added_scopes: 16, strengthened_scopes: 6, new_scopes_by_severity: { HIGH: 3, MEDIUM: 9, LOW: 4 }, new_scopes_by_category: { missing-sanitisation: 1, missing-defence-in-depth: 2, missing-auth: 1, error-mapping: 1, ux-bug: 1, idempotency: 1, performance-redundant-work: 1, race-condition: 1, missing-index: 1, dead-code: 1, missing-cache: 1, misleading-code: 1, misleading-api: 1, dual-driver-race: 1, observability: 1 } }
---

# Refactoring scopes — odd-platform — 2026-05-12

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

- **Scopes**: 199 total (0 CRITICAL, 58 HIGH, 92 MEDIUM, 49 LOW). The numbering goes to REFACTOR-215; REFACTOR-151 + REFACTOR-159 were deliberately skipped (per-POJO Lombok-toString gaps folded into cross-cutting REFACTOR-181); REFACTOR-186 / REFACTOR-190 / REFACTOR-192 / REFACTOR-194 / REFACTOR-196 / REFACTOR-197 / REFACTOR-212 / REFACTOR-213 were referenced in cross-cutting batch notes but not promoted as standalone entries (the underlying findings are captured at the cross-batch + ADR-CANDIDATE level via the existing entries' "STRENGTHENS" + "cross-cutting" annotations).
- **Refresh note (2026-05-12F batch — DataEntity centerpiece reads + write paths + ingestion controller deepening)**: 17 new scopes added (REFACTOR-185 + REFACTOR-198..211 + REFACTOR-214 + REFACTOR-215) from 5 new sidecars (`DataEntityController.getDataEntityDetails`, `DataEntityController.createOwnership`, `DataEntityController.updateStatus`, `DataEntityController.getDataEntityDownstreamLineage`, `IngestionController.postDataEntityList`). 5 existing scopes strengthened: **REFACTOR-073 (no boot-time security-posture validator — now 11-SIDECAR TRIANGULATED with five batch-F sidecars joining; the strongest single triangulation in the catalog)**, REFACTOR-024 (cross-owner read — now part of a 6-sidecar read-collaborative-blast-radius family alongside getActivity, search, getResourcePermissions, getDataEntityDetails NEW, getDataEntityDownstreamLineage NEW), REFACTOR-085 (no activity retention + the `statusUpdatedAt` nullification cross-batch finding — TTL retention now broken at TWO levels), REFACTOR-188 (no audit logging on RBAC mutations — REFINED scope: NOT codebase-wide; specifically RBAC-tier directory-CRUD — DataEntity-tier mutations DO emit audit events), REFACTOR-193 (OpenAPI 201 vs implementation 200 status-code drift — now 2-sidecar with IngestionController.postDataEntityList joining the batch-E RBAC create paths). The 10 highest-leverage 2026-05-12F additions are: **REFACTOR-185 (DISABLED-mode bypasses ALL SECURITY_RULES including the centerpiece data-entity write paths — 11-sidecar triangulated; HIGH; STRENGTHENS REFACTOR-073 to the strongest single triangulation in the catalog)**, **REFACTOR-198 (`applyStatus` ordering bug nulls `statusUpdatedAt` on every status transition → defeats DataEntityHousekeepingJob 30-day TTL silently; HIGH; cross-batch with HousekeepingTTLProperties from batch D)**, **REFACTOR-199 (Owner auto-create via createOwnership BYPASSES OWNER_CREATE permission; HIGH; permission-escalation surface)**, **REFACTOR-200 (cross-owner read of full DataEntityDetails — the centerpiece read-collaborative gap; HIGH)**, **REFACTOR-201 (view_count UPDATE inside @ReactiveTransactional → retries inflate counter + trivial inflation of getPopular ranking; MEDIUM)**, **REFACTOR-202 (lineage_depth NPE on missing parameter + no upper-bound cap; HIGH doc-vs-code drift + DoS-amplification)**, **REFACTOR-203 (lineage cross-owner enumeration via graph traversal — graph-shaped enumeration vector wider than search; HIGH)**, **REFACTOR-204 (default-off unauth ingestion at controller side; HIGH; STRENGTHENS REFACTOR-078)**, **REFACTOR-205 (cross-tenant ingestion under filter-OFF; HIGH)**, **REFACTOR-206 (Title auto-create has no allowlist; MEDIUM)**. The cross-cutting findings (batch F): (a) DISABLED-mode bypasses SECURITY_RULES is now 11-sidecar triangulated; (b) Read-collaborative cross-owner enumeration is 6-sidecar triangulated; (c) Permission-bypass via auto-create-on-missing is 2-sidecar NEW (Owner + Title); (d) TTL retention broken at two levels (status_updated_at nullification + activity-table no retention); (e) Audit-log-on-RBAC-mutations REFINED to RBAC-tier specifically (not codebase-wide); (f) OpenAPI 200/201 drift now 2-sidecar (RBAC + ingestion).
- **Refresh note (2026-05-12D batch — config-properties-class deepening)**: 42 new scopes added (REFACTOR-141..184 minus REFACTOR-151 and REFACTOR-159) from 5 new sidecars (`HousekeepingTTLProperties`, `ODDOAuth2Properties`, `ODDLDAPProperties`, `EmailSenderProperties`, `DataCollaborationProperties`). 4 existing scopes strengthened: REFACTOR-085 (no activity retention — now 3-sidecar triangulated; HousekeepingTTLProperties confirms from the 2nd angle — explicit fields list of three TTLs has NO activity field), REFACTOR-117 (LDAP /actuator/env password leak — REFINED: actuator angle refuted (Spring Boot 3.4.10 default sanitises `*password*` patterns at `/actuator/env`), Lombok-toString angle strengthened, folded into cross-cutting REFACTOR-181), REFACTOR-133 (advisory-lock-id collision risk — strengthened by DataCollabProperties explicit operator-tuneable design, folded into cross-cutting REFACTOR-183), REFACTOR-115 (ODDOAuth2Properties missing azureTenantId — strengthened with full POJO-field enumeration; STRENGTHENS REFACTOR-156 from doc-vs-code drift angle). The 8 highest-leverage 2026-05-12D additions are: **REFACTOR-141 (Housekeeping `@Value`-default-leak: Java-side `private int X;` fields with no `=30` initialiser; YAML floor is the ONLY safety; config-override that drops the block produces 0/0/0 TTLs deleting ALL resolved alerts + search facets + soft-deleted entities on the next 15-min cycle — HIGH, LSN-001 shape)**, **REFACTOR-142 (AlertHousekeepingJob jOOQ operator-precedence bug — `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` produces `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND cutoff)` — manual RESOLVED rows are hard-deleted on the very next 15-minute cycle; docs ACKNOWLEDGE this but code is unfixed — HIGH)**, **REFACTOR-155 (Azure logoutUri unvalidated at boot → `URI.create(null)` NPE on first logout — HIGH; price of ADR-CANDIDATE-048's narrow-validator)**, **REFACTOR-156 (`azureTenantId` per docs YAML examples does NOT exist on `OAuth2Provider` POJO — Spring's `ignoreUnknownFields=true` default silently binds nothing — HIGH; doc-vs-code drift; STRENGTHENS REFACTOR-115)**, **REFACTOR-181 (cross-cutting Lombok `@Data`-toString sensitive-field leak — 4-sidecar triangulated: clientSecret + password + email-password + LDAP-password; REFINEMENT — Spring Boot 3.4.10's `/actuator/env` IS protected by default; the real gap is in-process `log.info("properties={}", properties)` accidents — HIGH)**, **REFACTOR-150 (no `messageDays` retention field for `MESSAGE` table — DataCollaboration symmetry gap with the activity retention absence — MEDIUM)**, **REFACTOR-183 (cross-cutting no central advisory-lock-ID registry — 3-sidecar triangulated; four operator-tuneable IDs (90/100/110/120) have NO startup disjoint-allocation assertion — MEDIUM)**, **REFACTOR-145 (DataEntityHousekeepingJob `.block()` inside jOOQ transaction — MinIO/S3 outage stalls housekeeping cascade indefinitely — MEDIUM)**. The cross-cutting findings: (a) Lombok-toString sensitive-field leak is now 4-sidecar triangulated AND REFINED — actuator angle refuted; (b) Partial-home @ConfigurationProperties is 2-sidecar triangulated (REFACTOR-182); (c) Advisory-lock-ID registry absence is 3-sidecar triangulated (REFACTOR-183).
- **Refresh note (2026-05-12C batch — `*SecurityConfiguration` + Notifications layer)**: 49 new scopes added (REFACTOR-092..140) from 5 new sidecars (`DisabledAuthSecurityConfiguration.auth.type@L10`, `LoginFormSecurityConfiguration.auth.type@L31`, `OAuthSecurityConfiguration.auth.type@L71`, `LDAPSecurityConfiguration.auth.type@L51`, `NotificationsProperties`). 1 existing scope strengthened: REFACTOR-073 (no boot-time security-posture validator — now 4-sidecar triangulated by DisabledAuthSecurityConfiguration joining AppInfoController + AuthorizationManagerCondition + IngestionDataEntitiesFilter). The 10 highest-leverage 2026-05-12C additions are: **REFACTOR-099 (LOGIN_FORM runs WITHOUT AuthorizationCustomizer — HIGH; VALIDATES batch-B's REFACTOR-072 via direct file:line evidence — LoginFormSecurityConfiguration.java:55-57 vs OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145)**, **REFACTOR-108 (S2S+OAUTH2 X-API-Key grants ADMIN across all `/**` — HIGH; the privilege escalation surface; doc does not surface broad scope)**, **REFACTOR-113 (Okta + Keycloak no provider-specific enrichment / logout — HIGH; doc-vs-code drift)**, **REFACTOR-117 (`auth.ldap.password` leaks via `/actuator/env` — HIGH)**, **REFACTOR-118 (no LDAP scheme enforcement — bind credentials cleartext on `ldap://` — HIGH)**, **REFACTOR-119 (`containsIgnoreCase` substring-collision admin escalation — HIGH)**, **REFACTOR-127 (Notifications no retry / DLQ / audit trail on failed delivery — HIGH)**, **REFACTOR-128 (email per-recipient silent partial delivery — HIGH)**, **REFACTOR-129 (no rate-limiting at any Notifications layer — HIGH)**, **REFACTOR-130 (SMTP infinite timeouts blocks ALL Notifications channels — HIGH)**. The cross-cutting findings are: (a) Default-DISABLED + no-fail-fast is now 4-sidecar triangulated; (b) S2S composes-not-mutex is 4-sidecar consistent (3 modes wire identically, 1 explicitly ignores); (c) lazy-create-no-drop pattern is 2-sidecar triangulated (partitions + replication slots).
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
  - **Auth Mode — DISABLED (NEW 2026-05-12C; 7 scopes)**: no CORS, no boot WARN, S2S silently ignored, CSRF undocumented cross-mode, actuator unauth, no audit logging codebase-wide, missing-key fall-through.
  - **Auth Mode — LOGIN_FORM (NEW 2026-05-12C; 9 scopes, 1 HIGH)**: LOGIN_FORM-without-AuthorizationCustomizer (HIGH; validates REFACTOR-072), open-redirect, no credential default, fragile parsing, /actuator/env credential leak, session-cookie no security flags + never-expire, CSRF disabled on session mode, permit-all paths hand-coded, no brute-force defence.
  - **Auth Mode — OAUTH2 (NEW 2026-05-12C; 9 scopes, 2 HIGH)**: S2S+OAUTH2 ADMIN across all `/**` (HIGH; privilege escalation), Okta+Keycloak no provider-specific enrichment (HIGH; doc-vs-code), CSRF undocumented per-file, login-redirect-URI no allowlist, no OAuth2 failure handler, Azure logoutUri unchecked, WebSession HA-deployment unsupported, ODDOAuth2Properties missing azureTenantId, customOidcUserService fragile wiring.
  - **Auth Mode — LDAP (NEW 2026-05-12C; 10 scopes, 3 HIGH)**: /actuator/env password leak (HIGH), no LDAPS scheme enforcement (HIGH), containsIgnoreCase substring-collision admin escalation (HIGH), empty admin-groups = no admin path, LdapTemplate silent size-limit truncation, AD mode ignores dn-pattern + user-filter, no LDAP health-check, no LDAP-injection guidance, no boot-time reachability test, AuthIdentityProvider provider-tag drift.
  - **Notifications subsystem (NEW 2026-05-12C; 14 scopes, 4 HIGH)**: no retry/DLQ/audit (HIGH), email partial-delivery (HIGH), no rate-limiting at any layer (HIGH), SMTP infinite timeouts (HIGH), dead webhookUrl field, incomplete @ConfigurationProperties, advisory-lock-id collision, no per-channel routing, unsigned webhooks, Slack 2xx-but-not-200 misclassified, no structured audit log, PII surface in payloads, replication-slot orphan on rename, email password no @Sensitive.
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
  - **Authentication / boot-time security posture hardening (EXPANDED 2026-05-12C)** — REFACTOR-068..073 + REFACTOR-092..126 (41 scopes; 9 HIGH; the canonical sprint for the auth-mode family — DISABLED + LOGIN_FORM + OAUTH2 + LDAP gaps surfaced from the dedicated `*SecurityConfiguration` sidecars). Highest-leverage anchors: REFACTOR-099 (LOGIN_FORM-without-AuthorizationCustomizer — VALIDATES REFACTOR-072), REFACTOR-108 (S2S grants ADMIN across `/**`), REFACTOR-113 (Okta+Keycloak drift), REFACTOR-117 (LDAP password actuator leak), REFACTOR-118 (no LDAPS), REFACTOR-119 (substring-collision admin), REFACTOR-073 (no boot-time validator — 4-sidecar triangulated). A boot-time security-posture validator alone catches REFACTOR-068/-069/-071/-072/-098 as side-effects.
  - **Notifications hardening (NEW 2026-05-12C)** — REFACTOR-127..140 (14 scopes; 4 HIGH; canonical case for the Notifications subsystem family — opens with REFACTOR-127 retry/DLQ/audit and REFACTOR-130 SMTP timeouts as the highest-leverage operability fixes).
  - **Cross-cutting observability sprint (NEW 2026-05-12C)** — REFACTOR-097 (no audit logging codebase-wide) + REFACTOR-127 (no notification delivery audit) + REFACTOR-137 (no structured notification audit log) (3 scopes; 1 HIGH; cross-cutting foundational sprint — audit logging is a project commitment that closes both auth-side and notification-side observability gaps).

## Scopes

### HIGH severity

# refactoring-scopes — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 211

---

## REFACTOR-001 — GenAI outbound HTTP requests carry no authentication header — no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`, no `apiKey`/`token` field on `GenAIProperties`

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[4]` (originally classified as ADR-CANDIDATE-005 in run 0.1.0; reclassified per wisdom test)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[3]` ("No outbound authentication sent to {genai.url} — operators must put external service on a trusted network or front it with their own auth proxy")
  - **Statement**: The platform forwards user-supplied prompts to an operator-supplied URL with NO Authorization header, NO bearer token, NO API key. `GenAIProperties.java:8-12` declares only `enabled`, `url`, `requestTimeout` — no auth field. `WebClientConfiguration.java:26-29` builds the WebClient with no `defaultHeader(...)`. The absence has no stated rationale in code or comments — the maintainer didn't decide to skip outbound auth; it just isn't there. (Contrast with ADR-CANDIDATE-006 / AlertManager: there, the absence is *deliberately* documented in the live security doc as operator-network-delegated.)
  - **Evidence**: `WebClientConfiguration.java:26-29` (no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`) + `GenAIProperties.java:8-12` (no `apiKey` / `token` / `auth` fields)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (GenAI thin-proxy stance) does NOT defend the absence of outbound auth — "thin proxy" defends the absence of *prompt enrichment*, not the absence of authentication. No governing ADR. The live GenAI doc page acknowledges the gap ("The platform sends no authentication to the external service") but is descriptive, not prescriptive.
  - **Proposed remedy**: Add an `apiKey: String` field to `GenAIProperties` (optional, with `@Nullable` annotation); when set, `WebClientConfiguration` injects a `defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + key)` via Spring's standard pattern. Document the field in the live config-doc admonition.
  - **Severity rationale**: HIGH — operators deploying GenAI assuming the platform handles outbound auth are exposed (egress from the platform pod, no authentication on the LLM call). The previous run mis-classified this as an architectural decision; per Rule 0, the absence is a gap.

**Discriminating context**: The platform forwards user-supplied prompts to an operator-supplied URL with NO Authorization header, NO bearer token, NO API key. `GenAIProperties.java:8-12` declares only `enabled`, `url`, `requestTimeout` — no auth field. `WebClientConfiguration.java:26-29` builds the WebClient with no `defaultHeader(...)`. The absence has no stated rationale in code or comments — the maintainer didn't decide to skip outbound auth; it just isn't there. (Contrast with ADR-CANDIDATE-006 / AlertManager: there, the absence is *deliberately* documented in the live security doc as operator-network-delegated.)

**Full detail**: `detail/REFACTOR-001.md`

---

## REFACTOR-002 — GenAI outbound calls have no retry / backoff / circuit-breaker on transient upstream failure

**Severity**: HIGH
**Category**: missing-retry
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[4]` (originally bundled with REFACTOR-001 in ADR-CANDIDATE-005 of run 0.1.0)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:performance.known_performance_gaps.[1]`
    - `concepts.yaml:entities[GenAI Assistant].performance_aggregate.weaknesses.[1]`
  - **Statement**: The Mono pipeline at `GenAIServiceImpl.java:41-51` has `.onErrorResume(...)` that translates errors into `GenAIException`, but NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `genai.url` produces an immediate 500 to the caller; the caller must retry from outside. Combined with the per-request HTTP cost (potentially seconds-to-minutes), this amplifies user-visible latency variance.
  - **Evidence**: `GenAIServiceImpl.java:41-51` (no retry operator)
  - **Existing-ADR-or-implied-prescription**: None. Thin-proxy stance does not defend retry-absence; retry is request-routing reliability, not "prompt engineering" or "RAG" (which the proxy stance explicitly delegates).
  - **Proposed remedy**: Add `.retryWhen(Retry.backoff(maxAttempts, minBackoff).filter(this::isTransient))` on the WebClient call; expose `genai.retry.max-attempts` (default 3) and `genai.retry.min-backoff-millis` (default 200) via `GenAIProperties`. Document in the live config-doc.
  - **Severity rationale**: HIGH — for a feature whose latency floor is seconds-to-minutes, a single transient upstream blip surfacing as a 500 is operationally hostile.

**Discriminating context**: The Mono pipeline at `GenAIServiceImpl.java:41-51` has `.onErrorResume(...)` that translates errors into `GenAIException`, but NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `genai.url` produces an immediate 500 to the caller; the caller must retry from outside. Combined with the per-request HTTP cost (potentially seconds-to-minutes), this amplifies user-visible latency variance.

**Full detail**: `detail/REFACTOR-002.md`

---

## REFACTOR-003 — GenAI endpoint has no rate-limit, no per-user quota, no abuse-detection

**Severity**: HIGH
**Category**: missing-rate-limit
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[5]`
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[4]` ("No per-user / global rate limit, no abuse-detection — authenticated user can issue unbounded prompts; combined with no @Size on GenAIRequest.body this is DoS + unbounded-cost surface")
  - **Statement**: Every authenticated user can fire prompts at the LLM at maximum throughput. There is no `@Throttle` annotation, no `Bucket4j` integration, no distributed token bucket, no per-user spend cap. Combined with no `@Size` on `GenAIRequest.body` and only the implicit `spring.codec.max-in-memory-size: 20MB` ceiling, this is a denial-of-service surface AND an unbounded-cost surface (operators billing per token at the LLM see N×bill from N concurrent users).
  - **Evidence**: `GenAIController.java:1-24` (no rate-limit annotation) + `GenAIServiceImpl.java:36-52` (no rate-limit in pipeline) + `application.yml:14-15` (`spring.codec.max-in-memory-size: 20MB`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (thin-proxy) does NOT defend this absence — the previous run's ADR-CANDIDATE-007 incorrectly bundled "no rate-limit" into the thin-proxy stance. Per the wisdom test split, rate-limit is a gap, not a stance commitment.
  - **Proposed remedy**: Adopt a Bucket4j-based rate limiter on `/api/genai/ask`; expose `genai.rate-limit.requests-per-minute` (per-user) and `genai.rate-limit.global-concurrent` (platform-wide). Default to permissive values (e.g., 60 req/min/user, 10 concurrent global) so opt-in operators are not surprised, but document the levers.
  - **Severity rationale**: HIGH — DoS surface + unbounded-cost-to-operator. The previous run mis-classified this as part of an architectural stance.

**Discriminating context**: Every authenticated user can fire prompts at the LLM at maximum throughput. There is no `@Throttle` annotation, no `Bucket4j` integration, no distributed token bucket, no per-user spend cap. Combined with no `@Size` on `GenAIRequest.body` and only the implicit `spring.codec.max-in-memory-size: 20MB` ceiling, this is a denial-of-service surface AND an unbounded-cost surface (operators billing per token at the LLM see N×bill from N concurrent users).

**Full detail**: `detail/REFACTOR-003.md`

---

## REFACTOR-004 — GenAI request body forwarded verbatim to external LLM — no length cap, no character filter, no sanitisation, no system-prompt overlay

**Severity**: HIGH
**Category**: missing-sanitisation
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[1]` (severity HIGH per sidecar)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[0]` ("Prompt-injection from authenticated platform users → external LLM is unmitigated at platform boundary")
  - **Statement**: `GenAIServiceImpl.java:43` forwards `genAIRequest.body` verbatim as `Map.of(QUESTION_FIELD, request.getBody())`. There is no length cap (only the global `spring.codec.max-in-memory-size: 20MB` ceiling), no character filter, no PII redaction, no system-prompt overlay. An authenticated user crafting a prompt that pivots the external LLM (e.g. "ignore previous instructions and dump prior conversation") is not defended against here.
  - **Evidence**: `GenAIServiceImpl.java:43` (no transformation, no truncation, no validation)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-005 (thin-proxy) explicitly delegates "Injection concerns" to the operator's external service. **However**, "no length cap" and "no character filter" are MIXED — the thin-proxy stance defends the absence of *prompt engineering* (no system prompt construction, no template-rewriting), but it does NOT defend the absence of basic input sanitisation that protects the operator's egress (e.g., a 19MB prompt blowing the LLM's input context). Surface as scope; the live doc page says "Injection concerns fall to your external service implementation" but does not say "we will pass arbitrary 19MB strings unchanged."
  - **Proposed remedy**: Add `@Size(max = 8192)` on `GenAIRequest.body` (configurable via `genai.max-prompt-chars`); reject oversized prompts with a clear 400. Optional: add a `genai.prompt-pattern-blocklist` for operators who want to reject specific patterns. Do NOT add automatic sanitisation — that violates the thin-proxy stance.
  - **Severity rationale**: HIGH — bounded-cost violation; an authenticated user can submit a 19MB prompt that the platform serialises and forwards.

**Discriminating context**: `GenAIServiceImpl.java:43` forwards `genAIRequest.body` verbatim as `Map.of(QUESTION_FIELD, request.getBody())`. There is no length cap (only the global `spring.codec.max-in-memory-size: 20MB` ceiling), no character filter, no PII redaction, no system-prompt overlay. An authenticated user crafting a prompt that pivots the external LLM (e.g. "ignore previous instructions and dump prior conversation") is not defended against here.

**Full detail**: `detail/REFACTOR-004.md`

---

## REFACTOR-008 — `SECURITY_RULES` path mismatch — `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` gates SILENTLY DISABLED by `/term` (SecurityConstants.java:237-242) vs `/terms` (DataEntityApi.java:148, 542) path mismatch

**Severity**: HIGH
**Category**: path-mismatch
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[0]` (severity HIGH per sidecar)
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[0]`
  - **Statement**: `SecurityConstants.SECURITY_RULES` registers permission gates for path `/api/dataentities/{data_entity_id}/term` (singular), but the actual API path generated from the OpenAPI spec is `/api/dataentities/{data_entity_id}/terms` (plural). Spring Security's `PathPatternParserServerWebExchangeMatcher` matches by literal string, so the rules NEVER match the actual requests; `addDataEntityTerm` and `deleteTermFromDataEntity` fall through to `pathMatchers("/**").authenticated()`. Net effect: ANY authenticated user can attach or detach terms on ANY data entity, regardless of policy. Anonymous under `auth.type=DISABLED`.
  - **Evidence**: `SecurityConstants.java:237-242` (path uses `/term`) + `DataEntityApi.java:128, 148` (POST `/api/dataentities/{data_entity_id}/terms`), `DataEntityApi.java:524, 542` (DELETE `/api/dataentities/{data_entity_id}/terms/{term_id}`) + `AuthorizationCustomizer.java:24-30` (path-pattern matcher loop + `.authenticated()` fall-through)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 prescribes "centralised SECURITY_RULES" — this scope is the canonical case-law for the trade-off the ADR's "path-string coupling" caveat warns about.
  - **Proposed remedy**: Update `SecurityConstants.java:237-242` to use the plural `/terms` path patterns matching the OpenAPI spec. Add an integration test that asserts a non-permission-holder receives 403 on `POST /api/dataentities/{id}/terms` (this would have caught the drift). Add a CI check or unit test that diff-walks SECURITY_RULES paths against generated `*Api` interface `@RequestMapping(value = ...)` annotations and fails on any path that has no matching mapping.
  - **Severity rationale**: HIGH — privilege-boundary leak. Has been live since the spec changed `/term` → `/terms`. The fix is a one-line change; the systemic fix (drift detection) is REFACTOR-009.

**Discriminating context**: `SecurityConstants.SECURITY_RULES` registers permission gates for path `/api/dataentities/{data_entity_id}/term` (singular), but the actual API path generated from the OpenAPI spec is `/api/dataentities/{data_entity_id}/terms` (plural). Spring Security's `PathPatternParserServerWebExchangeMatcher` matches by literal string, so the rules NEVER match the actual requests; `addDataEntityTerm` and `deleteTermFromDataEntity` fall through to `pathMatchers("/**").authenticated()`. Net effect: ANY authenticated user can attach or detach terms on ANY data entity, regardless of policy. Anonymous under…

**Full detail**: `detail/REFACTOR-008.md`

---

## REFACTOR-013 — `attachment.max-file-size` server-side enforcement bypass — chunked upload pipeline accepts streams of any size

**Severity**: HIGH
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[4]` (severity HIGH — disk-fill flavour)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[1]` (HIGH per consumer + controller sidecars)
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[1]` + `security.known_security_gaps.[3]` (the chunk-path sidecar confirms the gap from inside the chunk-upload critical path: "DataEntityAttachmentController.java:54-62 reads no size, FileServiceImpl.java:58-67 calls `transferTo` without checking byte count")
  - **Statement**: `AttachmentServiceImpl.java:70-78` and `DataEntityAttachmentController.java:54-62` neither check accumulated chunk size against `maxFileSize`. The cap is purely a UI-side filter in the React `FileInput` component (`file.size <= maxFileSizeInBytes`). A non-browser client (curl, a script, a misbehaving SDK) can post arbitrary-size chunks. With `attachment.storage=LOCAL` (the default per `application.yml:216`), this becomes a host-disk-fill DoS surface — the cap is per-file (default 20 MB) but is enforced at the upload-options surface only, so a malicious or misbehaving client can ignore the advertised cap and stream chunks beyond it.
  - **Evidence**: `AttachmentServiceImpl.java:27-89` (no size guard in `uploadFileChunk` or `completeFileUpload`) + `DataEntityAttachmentController.java:54-62` (controller passes the chunk through without size validation) + `FileInput.tsx:39` (`file.size <= maxFileSizeInBytes` is the only filter before upload starts)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-016 (max-file-size as UX hint) deliberately exposes the cap to the UI but the absence of server-side re-validation is the gap-shaped split — the ADR does not defend it; the maintainer simply did not add server-side re-validation.
  - **Proposed remedy**: Track accumulated bytes across chunks for an `uploadId` (in `FileServiceImpl` or a dedicated `UploadSessionService`); reject the chunk that would exceed `maxFileSize * 1_000_000` with HTTP 413. Update integration tests to cover both (a) UI-side filter, (b) server-side enforcement.
  - **Severity rationale**: HIGH — both data-integrity (server cap is illusory) and operational (LOCAL host-disk fill).

**Discriminating context**: `AttachmentServiceImpl.java:70-78` and `DataEntityAttachmentController.java:54-62` neither check accumulated chunk size against `maxFileSize`. The cap is purely a UI-side filter in the React `FileInput` component (`file.size <= maxFileSizeInBytes`). A non-browser client (curl, a script, a misbehaving SDK) can post arbitrary-size chunks. With `attachment.storage=LOCAL` (the default per `application.yml:216`), this becomes a host-disk-fill DoS surface — the cap is per-file (default 20 MB) but is enforced at the upload-options surface only, so a malicious or misbehaving client can ignore the…

**Full detail**: `detail/REFACTOR-013.md`

---

## REFACTOR-016 — GenAI `genai.url` is operator-supplied with no allowlist, no scheme check, no SSRF guard, no `@URL` constraint

**Severity**: HIGH
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[2]` (severity HIGH)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[1]`
  - **Statement**: `GenAIProperties.url` carries no validation annotations; `WebClientConfiguration.java:28` calls `baseUrl(genAIProperties.getUrl())` with no validation. An operator could set `genai.url=http://internal-only.corp/x` (or any internal-network URL); if config injection is achievable elsewhere (e.g. `application.yml` overlay, ConfigMap mutation), an attacker pivots the platform's egress.
  - **Evidence**: `GenAIProperties.java:10` (no validation annotations) + `WebClientConfiguration.java:28` (`baseUrl(genAIProperties.getUrl())` with no validation)
  - **Existing-ADR-or-implied-prescription**: None. The thin-proxy stance does not defend the absence of URL validation.
  - **Proposed remedy**: Add `@URL`, `@NotBlank`, and `@Pattern(regexp = "^https?://...")` on `GenAIProperties.url`. Optional: add `genai.url-allowlist` for operators who want to constrain to a known set of LLM endpoints. Add `@Validated` at the class level to engage Spring Boot's `@ConfigurationProperties` validation pipeline.
  - **Severity rationale**: HIGH — SSRF surface. An attacker landing config injection can use the platform as a confused deputy to reach internal services.

**Discriminating context**: `GenAIProperties.url` carries no validation annotations; `WebClientConfiguration.java:28` calls `baseUrl(genAIProperties.getUrl())` with no validation. An operator could set `genai.url=http://internal-only.corp/x` (or any internal-network URL); if config injection is achievable elsewhere (e.g. `application.yml` overlay, ConfigMap mutation), an attacker pivots the platform's egress.

**Full detail**: `detail/REFACTOR-016.md`

---

## REFACTOR-019 — Under `auth.type=DISABLED`, `/api/genai/ask` is anonymously reachable; no fail-closed behaviour, no startup warning when `DISABLED` + `genai.enabled=true`

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[4]` (severity HIGH)
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[2]`
  - **Statement**: `auth.type=DISABLED` (the `application.yml:34` default) + `genai.enabled=true` produces an LLM proxy reachable from any caller able to reach the platform's HTTP port. There is no fail-closed behaviour in the controller, no startup banner log warning, no `@ConditionalOnProperty(value = "genai.enabled", havingValue = "true") + @ConditionalOnExpression("'${auth.type}' != 'DISABLED'")` guard.
  - **Evidence**: `GenAIController.java:1-24` (no auth-mode check) + `DisabledAuthSecurityConfiguration.java:10` + `application.yml:34` (`auth.type: DISABLED` is the shipped default — but see `application.yml:18` ships `genai.enabled: false`, so the dangerous combination is not the default).
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-004 (GenAI disabled-by-default + fail-fast-on-misconfig) prescribes the fail-fast posture. This scope is a gap *under* that ADR — fail-fast happens at request time when `url`/`requestTimeout` are unset, but there is no fail-fast for the orthogonal misconfiguration "auth.type=DISABLED + genai.enabled=true."
  - **Proposed remedy**: Add a `@PostConstruct` startup check in `GenAIServiceImpl` (or a dedicated `GenAIStartupValidator`): if `auth.type=DISABLED` AND `genai.enabled=true`, log a WARN-level banner and fail boot under a `genai.fail-on-disabled-auth: true` flag (default false for backward compatibility, recommended true in the live config-doc).
  - **Severity rationale**: HIGH — defense-in-depth. The platform's fail-fast posture (ADR-CANDIDATE-004) is undermined by the absence of this orthogonal check.

**Discriminating context**: `auth.type=DISABLED` (the `application.yml:34` default) + `genai.enabled=true` produces an LLM proxy reachable from any caller able to reach the platform's HTTP port. There is no fail-closed behaviour in the controller, no startup banner log warning, no `@ConditionalOnProperty(value = "genai.enabled", havingValue = "true") + @ConditionalOnExpression("'${auth.type}' != 'DISABLED'")` guard.

**Full detail**: `detail/REFACTOR-019.md`

---

## REFACTOR-024 — `getAllAlerts` returns the entire platform's alert stream to ANY authenticated user — no admin gate, no role check

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM in sidecar but HIGH at concept-aggregate level)
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[0]` (severity HIGH)
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__AlertController__controller-method__getAllAlerts.md:bugs_limitations_corner_cases.[0]` + `security.known_security_gaps.[0]` (severity HIGH per sidecar — the controller-method sidecar elevates the finding to HIGH and adds the doc-drift signal: live alerting page says "stewards and admins watching the full alert surface" while code permits any authenticated user, sharpening the borderline question for ADR-CANDIDATE-003)
  - **Statement**: `AlertController.getAllAlerts` (the "All" tab) returns the cross-tenant alert stream with no admin gate, no role check. `SecurityConstants.SECURITY_RULES` has no entry for `/api/alerts`; the path falls through to `.authenticated()`. Owner-scoping is enforced only on `/api/alerts/my` and `/api/alerts/dependents` via reactor `Context`. The downstream `listAll → listAllWithStatusOpen` query is a flat `WHERE STATUS = OPEN` jOOQ select with no owner join (`ReactiveAlertRepositoryImpl.java:143-156`).
  - **Evidence**: `AlertController.java:35-41` (no security annotations, raw delegation to `alertService.listAll`) + `SecurityConstants.java:98-355` (no `/api/alerts` matcher) + `ReactiveAlertRepositoryImpl.java:143-145` (no owner predicate) + WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-10 (live-page recommends tab for "stewards and admins" — code does not enforce that audience).
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative catalog, BORDERLINE) MAY defend this — if "any authenticated user reads any data entity's alerts" is the intentional posture, then "any authenticated user reads cross-tenant alert stream" is the same posture applied to the alert listing. **However**, this scope is exactly the kind of finding that should make the maintainer think hard about whether ADR-CANDIDATE-003 is a real ADR or a missed-gate scope. The live-doc audience-vs-code-enforcement divergence (NEW signal from 2026-05-10A) is the strongest evidence the borderline should resolve toward "missed gate" rather than "intentional posture." Surface for triage.
  - **Proposed remedy**: Either (a) add an `ALERTS_LIST_ALL` permission and a SECURITY_RULES entry; or (b) confirm ADR-CANDIDATE-003's read-collaborative posture and document this endpoint as covered by it on the live `/configuration-and-deployment/enable-security/authorization` page AND fix the alerting page's "stewards and admins" wording. The choice is the maintainer's; surface, do not auto-fix.
  - **Severity rationale**: HIGH — depending on triage decision, either a privilege-boundary leak or a doc-gap.

**Discriminating context**: `AlertController.getAllAlerts` (the "All" tab) returns the cross-tenant alert stream with no admin gate, no role check. `SecurityConstants.SECURITY_RULES` has no entry for `/api/alerts`; the path falls through to `.authenticated()`. Owner-scoping is enforced only on `/api/alerts/my` and `/api/alerts/dependents` via reactor `Context`. The downstream `listAll → listAllWithStatusOpen` query is a flat `WHERE STATUS = OPEN` jOOQ select with no owner join (`ReactiveAlertRepositoryImpl.java:143-156`).

**Full detail**: `detail/REFACTOR-024.md`

---

## REFACTOR-025 — `changeAlertStatus` accepts mutation with no permission gate — any authenticated user can resolve/reopen any alert by id

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:security.known_security_gaps.[0]` (severity HIGH per sidecar)
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[1]` (severity HIGH)
  - **Statement**: `PUT /api/alerts/{alert_id}/status` carries no `@PreAuthorize`, no `permissionService.hasPermission(...)` call, and no SECURITY_RULES entry. Combined with the deliberate "mutations are gated" posture (ADR-CANDIDATE-002), this is a clear rule-violation, not a posture-choice — every other mutation is gated; this one isn't.
  - **Evidence**: `AlertController.java:1-58` (no security annotations) + `SecurityConstants.java:98-355` (no `/api/alerts/{alert_id}/status` matcher; only `DATASET_FIELD_ADD_TERM` for the per-entity halt-config mutation)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) prescribes "every mutating endpoint is one row in SECURITY_RULES." This scope is a **violation** of that ADR — a missing row for `changeAlertStatus`.
  - **Proposed remedy**: Add a SECURITY_RULES entry for `PUT /api/alerts/{alert_id}/status` mapped to a new `ALERT_STATUS_UPDATE` permission. Define the policy semantics — does this require ALERT-RESOLVE on the data entity the alert is attached to, or platform-wide ALERT_STATUS_UPDATE? Maintainer call.
  - **Severity rationale**: HIGH — privilege-boundary leak; explicitly violates ADR-CANDIDATE-002.

**Discriminating context**: `PUT /api/alerts/{alert_id}/status` carries no `@PreAuthorize`, no `permissionService.hasPermission(...)` call, and no SECURITY_RULES entry. Combined with the deliberate "mutations are gated" posture (ADR-CANDIDATE-002), this is a clear rule-violation, not a posture-choice — every other mutation is gated; this one isn't.

**Full detail**: `detail/REFACTOR-025.md`

---

## REFACTOR-026 — LSN-001 reactivation — LOCAL attachment storage default writes to ephemeral `/tmp/odd/attachments`; container restart wipes all uploaded files

**Severity**: HIGH
**Category**: buggy-default
**Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[4]` (related)
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[0]` (severity HIGH)
  - **Statement**: `application.yml:218-219` ships `attachment.local.path: /tmp/odd/attachments`. Kubernetes pod restart, Docker `docker stop`/`docker rm`, and most container schedulers wipe `/tmp` on container lifecycle events. The live doc page documents this and recommends `/var/lib/odd/attachments` + a persistent volume; the YAML still ships the ephemeral default. This is the canonical retrospective for the entire workspace's "danger of unsafe defaults" line.
  - **Evidence**: `application.yml:218-219` + `LocalFilePathConstructor.java:14-23` + `retrospectives/LSN-001-attachment-ephemeral-default.md`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-012 (attachment-storage `@ConditionalOnProperty` boot-time wiring) does NOT defend the ephemeral default — the ADR is about the *wiring mechanism*, not the *path value*. The default path is a gap; the maintainer didn't decide `/tmp/odd/attachments` was a safe production default.
  - **Proposed remedy**: Change `application.yml:218-219` default to `/var/lib/odd/attachments` (matches the live doc). Update Helm chart / Docker Compose examples to declare the volume mount. Update LSN-001 retrospective with the post-fix state.
  - **Severity rationale**: HIGH — production-data-loss; the canonical case the entire workspace exists to catch.

**Discriminating context**: `application.yml:218-219` ships `attachment.local.path: /tmp/odd/attachments`. Kubernetes pod restart, Docker `docker stop`/`docker rm`, and most container schedulers wipe `/tmp` on container lifecycle events. The live doc page documents this and recommends `/var/lib/odd/attachments` + a persistent volume; the YAML still ships the ephemeral default. This is the canonical retrospective for the entire workspace's "danger of unsafe defaults" line.

**Full detail**: `detail/REFACTOR-026.md`

---

## REFACTOR-027 — LSN-002 reactivation — REMOTE on AWS S3 silently restricted to `us-east-1` (MinIO SDK `MinioAsyncClient.builder()` omits `.region(...)`)

**Severity**: HIGH
**Category**: buggy-default
**Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[2]` (severity HIGH)
  - **Statement**: `MinioConfig.minioClient()` constructs `MinioAsyncClient.builder()` with `.endpoint()` + `.credentials()` only, never `.region(...)`. The MinIO SDK defaults the region to `us-east-1` for SigV4 signing; AWS S3 buckets in any other region reject the request with `AuthorizationHeaderMalformed` or `PermanentRedirect`. Self-hosted MinIO is unaffected because it ignores the region header.
  - **Evidence**: `MinioConfig.java:19-25` (no `.region(...)` call) + `retrospectives/LSN-002-minio-region-unset.md`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-013 (REMOTE = MinIO SDK only) is the architectural decision; this scope is the canonical retrospective for "what breaks when you assume MinIO-SDK semantics on AWS S3."
  - **Proposed remedy**: Add `attachment.remote.region: ""` to `application.yml`; in `MinioConfig.minioClient()`, call `.region(...)` when non-empty. Document on the live `configuration-and-deployment/odd-platform` page as a required field for AWS deployments.
  - **Severity rationale**: HIGH — silent us-east-1 lock-in for AWS-deploying operators.

**Discriminating context**: `MinioConfig.minioClient()` constructs `MinioAsyncClient.builder()` with `.endpoint()` + `.credentials()` only, never `.region(...)`. The MinIO SDK defaults the region to `us-east-1` for SigV4 signing; AWS S3 buckets in any other region reject the request with `AuthorizationHeaderMalformed` or `PermanentRedirect`. Self-hosted MinIO is unaffected because it ignores the region header.

**Full detail**: `detail/REFACTOR-027.md`

---

## REFACTOR-028 — REMOTE attachment storage — bucket existence not validated at boot; first-upload-failure pattern

**Severity**: HIGH
**Category**: deferred-failure
**Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[2]` (severity MEDIUM in sidecar)
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[5]`
  - **Statement**: `RemoteFileUploadServiceImpl.validate()` only checks the bucket *name* is non-empty (line 46-50). An operator who mistypes the bucket or points at a non-existent one boots cleanly and only sees the failure on the first upload, by which time the upload UI has accepted the file and consumed user time. This was originally classified as ADR-CANDIDATE-017 in run 0.1.0; per the wisdom test, the absence has no stated rationale (no comment defends "we don't validate at boot") and is refactoring within `MinioConfig` / `RemoteFileUploadServiceImpl`.
  - **Evidence**: `MinioConfig.java:1-26` (no bucket-creation call) + `RemoteFileUploadServiceImpl.java:45-50` (only validates non-empty, not existence)
  - **Existing-ADR-or-implied-prescription**: None defends the absence. ADR-CANDIDATE-012 (boot-time wiring) doesn't defend it; the wiring decision is about Spring `@ConditionalOnProperty` shape, not bucket-validation.
  - **Proposed remedy**: Add `@PostConstruct` health check in `MinioConfig` (or a dedicated `RemoteStorageStartupValidator`) that calls `minioClient.bucketExists(BucketExistsArgs.builder().bucket(...).build())` and fails boot if the bucket is missing. Optional: under `attachment.remote.auto-create-bucket: true`, call `makeBucket` instead.
  - **Severity rationale**: HIGH (concept-level severity from concepts.yaml) — operators see "platform is up" but uploads are broken until they hit a real upload.

**Discriminating context**: `RemoteFileUploadServiceImpl.validate()` only checks the bucket *name* is non-empty (line 46-50). An operator who mistypes the bucket or points at a non-existent one boots cleanly and only sees the failure on the first upload, by which time the upload UI has accepted the file and consumed user time. This was originally classified as ADR-CANDIDATE-017 in run 0.1.0; per the wisdom test, the absence has no stated rationale (no comment defends "we don't validate at boot") and is refactoring within `MinioConfig` / `RemoteFileUploadServiceImpl`.

**Full detail**: `detail/REFACTOR-028.md`

---

## REFACTOR-029 — S3 credentials (`attachment.remote.access-key`, `attachment.remote.secret-key`) exposed via `/actuator/env` by default

**Severity**: HIGH
**Category**: missing-validation (config-leak)
**Surfaced by**:
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[2]` (severity HIGH)
  - **Statement**: With Spring Boot Actuator's standard exposure list and `endpoint.env.enabled: true`, `/actuator/env` returns the values of `@Value`-injected properties. Spring's default key-pattern sanitisation masks values matching `password|secret|key|token` by name, but the keys themselves leak (path + endpoint exposure). Operators who forget to disable `/actuator/env` (or who whitelist it for ops tooling) leak the creds' presence + the configuration shape.
  - **Evidence**: `MinioConfig.java:14-17` (`@Value("${attachment.remote.access-key}")` + `@Value("${attachment.remote.secret-key}")`) + Spring Boot Actuator default config
  - **Existing-ADR-or-implied-prescription**: None. The attachment-storage ADRs do not address the actuator exposure.
  - **Proposed remedy**: Document the actuator exposure on the live config page; recommend `management.endpoint.env.show-values: WHEN_AUTHORIZED` (Spring Boot 3 default but worth the explicit override). Optional: integrate with Spring Cloud Config / Vault — see REFACTOR-030.
  - **Severity rationale**: HIGH (concept-level) — credentials leak via standard actuator endpoint.

**Discriminating context**: With Spring Boot Actuator's standard exposure list and `endpoint.env.enabled: true`, `/actuator/env` returns the values of `@Value`-injected properties. Spring's default key-pattern sanitisation masks values matching `password|secret|key|token` by name, but the keys themselves leak (path + endpoint exposure). Operators who forget to disable `/actuator/env` (or who whitelist it for ops tooling) leak the creds' presence + the configuration shape.

**Full detail**: `detail/REFACTOR-029.md`

---

## REFACTOR-033 — Multi-instance LOCAL attachment storage broken — chunk staging directory keyed by `uploadId` only, no replica id; cross-replica chunk assembly is undefined

**Severity**: HIGH
**Category**: race-condition
**Surfaced by**:
    - `concepts.yaml:entities[Attachment].performance_aggregate.weaknesses.[1]` (severity HIGH)
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
  - **Statement**: For LOCAL storage, chunk staging is a per-instance filesystem path. A horizontally-scaled deployment with LOCAL storage produces intermittent failures whenever the load balancer routes `uploadFileChunk` and `completeFileUpload` to different instances. REMOTE (S3) is shared by construction.
  - **Evidence**: `LocalFileUploadServiceImpl.java:32-52` + `RemoteFileUploadServiceImpl.java:53-77` (both use `FileUtils.getChunkDirectory(uploadId)` which is local-fs)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-012 (boot-time wiring) does not address multi-instance deployment.
  - **Proposed remedy**: Document on the live config page that LOCAL storage requires single-instance deployment OR a shared volume mount. Optional: add a `attachment.local.shared-volume: true` flag that switches off the per-instance assumption (no-op for now, advisory only).
  - **Severity rationale**: HIGH (concept-aggregate) — silent failure mode on multi-instance LOCAL deployments.
  - **Suggested backlog grouping**: `Attachment integrity sprint`

**Discriminating context**: For LOCAL storage, chunk staging is a per-instance filesystem path. A horizontally-scaled deployment with LOCAL storage produces intermittent failures whenever the load balancer routes `uploadFileChunk` and `completeFileUpload` to different instances. REMOTE (S3) is shared by construction.

**Full detail**: `detail/REFACTOR-033.md`

---

## REFACTOR-018 — AlertManager payload silent orphan — alert missing `entity_oddrn` label is accepted, persisted with null `data_entity_oddrn`, returns 204; caller has no signal of misconfiguration

**Severity**: HIGH
**Category**: error-mapping
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[0]` (HIGH)
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[3]`
  - **Statement**: `externalAlert.getLabels().get("entity_oddrn")` returns null for missing key; no null-check before `.setDataEntityOddrn(...)`. Controller returns 204 No Content unconditionally. Operators relying on AlertManager's notification-success signal cannot detect this misconfiguration.
  - **Evidence**: `AlertServiceImpl.java:178` + `AlertManagerController.java:25` (`.map(o -> ResponseEntity.noContent().build())`)
  - **Existing-ADR-or-implied-prescription**: None defends silent acceptance.
  - **Proposed remedy**: Reject AlertManager payloads where any alert is missing `entity_oddrn` with HTTP 400 + an explanatory body. Optional: support a partial-success mode where each alert reports its routing outcome.
  - **Severity rationale**: HIGH (per sidecar) — silent data loss for operators.

**Discriminating context**: `externalAlert.getLabels().get("entity_oddrn")` returns null for missing key; no null-check before `.setDataEntityOddrn(...)`. Controller returns 204 No Content unconditionally. Operators relying on AlertManager's notification-success signal cannot detect this misconfiguration.

**Full detail**: `detail/REFACTOR-018.md`

---

## REFACTOR-044 — Lineage endpoints accept unbounded `lineageDepth` and unbounded `expandedEntityIds` at the controller — no `@Max`, no `@Size`, no clamp

**Severity**: HIGH
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:bugs_limitations_corner_cases.[0]` (HIGH)
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses.[1]`
  - **Statement**: `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` declare `Integer lineageDepth, List<Long> expandedEntityIds` with no constraints. A caller passing `lineageDepth=1000000` triggers a `LineageService` traversal bounded only by whatever (if any) limit the service enforces. The previous run classified this as ADR-CANDIDATE-021 ("the back-end trusts the UI"); per the wisdom test, "trust the UI" is not a defensible architectural stance for a public API — it's a missing validation.
  - **Evidence**: `DataEntityController.java:256-273, 308-313, 368-371` + `openapi.yaml:1260-1276` + `components.yaml:2033-2065`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add `@Max(20)` (or whatever the production-realistic ceiling is) on `lineageDepth` at the controller; add `@Size(max = 1000)` on `expandedEntityIds`. Update the OpenAPI spec's `lineageDepth` parameter to declare `maximum: 20`.
  - **Severity rationale**: HIGH (concept-aggregate) — DoS surface on the platform's hottest endpoint.

**Discriminating context**: `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` declare `Integer lineageDepth, List<Long> expandedEntityIds` with no constraints. A caller passing `lineageDepth=1000000` triggers a `LineageService` traversal bounded only by whatever (if any) limit the service enforces. The previous run classified this as ADR-CANDIDATE-021 ("the back-end trusts the UI"); per the wisdom test, "trust the UI" is not a defensible architectural stance for a public API — it's a missing validation.

**Full detail**: `detail/REFACTOR-044.md`

---

## REFACTOR-045 — Collector token entropy uses non-cryptographically-secure RNG — `RandomStringUtils.randomAlphanumeric(40)` delegates to `ThreadLocalRandom` (commons-lang 3.16+), not `SecureRandom`

**Severity**: HIGH
**Category**: weak-rng
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[4]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[1]` (severity HIGH)
  - **Statement**: `TokenGeneratorImpl.java:39, 49` calls `setValue(RandomStringUtils.randomAlphanumeric(40))`. Without an explicit Random argument, commons-lang 3.16+ uses `ThreadLocalRandom` — a non-cryptographically-secure PRNG. The token is the shared secret authenticating ALL ingestion against the platform; a predictable RNG seed (process startup time, easy to recover via JVM lifecycle telemetry) reduces the brute-force surface from ~238 bits (alphanumeric × 40) to whatever the seed entropy provides. The `commons-lang 3.16+` `RandomStringUtils.secure().nextAlphanumeric(40)` (or explicit `new SecureRandom()`) would be the security-grade source.
  - **Evidence**: `TokenGeneratorImpl.java:39, 49` (`RandomStringUtils.randomAlphanumeric(40)` — no Random arg)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (NEW 2026-05-10A — token rotation semantics) implicitly assumes the token is "long-random opaque string" — high entropy is a precondition for the plaintext-equality model. This scope is a direct violation of the implicit precondition: the token is "long" (40 chars) but not necessarily "random" in the cryptographic sense.
  - **Proposed remedy**: Replace `RandomStringUtils.randomAlphanumeric(40)` with `RandomStringUtils.secure().nextAlphanumeric(40)` (commons-lang 3.16+) OR explicit `new SecureRandom()` injected into TokenGeneratorImpl. Add a unit test asserting the chosen RNG is `SecureRandom`-backed.
  - **Severity rationale**: HIGH — defeats the implicit precondition of the platform's S2S authentication model. The fix is one line; the absence of the fix has no defending rationale.

**Discriminating context**: `TokenGeneratorImpl.java:39, 49` calls `setValue(RandomStringUtils.randomAlphanumeric(40))`. Without an explicit Random argument, commons-lang 3.16+ uses `ThreadLocalRandom` — a non-cryptographically-secure PRNG. The token is the shared secret authenticating ALL ingestion against the platform; a predictable RNG seed (process startup time, easy to recover via JVM lifecycle telemetry) reduces the brute-force surface from ~238 bits (alphanumeric × 40) to whatever the seed entropy provides. The `commons-lang 3.16+` `RandomStringUtils.secure().nextAlphanumeric(40)` (or explicit `new…

**Full detail**: `detail/REFACTOR-045.md`

---

## REFACTOR-046 — Collector token rotation is not audit-logged — no `log.*` call on the regenerate path; the `TOKEN.updated_by` column is the only forensic trail and is overwritten on each rotation

**Severity**: HIGH
**Category**: missing-audit
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[2]` (severity HIGH)
  - **Statement**: `grep` for `log.(info|warn|debug|error)` against CollectorController, CollectorServiceImpl, TokenGeneratorImpl, ReactiveTokenRepositoryImpl returned zero matches. The TOKEN row's `updated_by` column captures the actor username from `AuthIdentityProvider.getCurrentUser()` — the only forensic trail — but `updated_by` is overwritten on the next rotation, so the audit trail is single-state, not append-only. A security-incident review of "who rotated token X 30 days ago" cannot answer from production data.
  - **Evidence**: `TokenGeneratorImpl.java:28-52` (no log calls) + `CollectorServiceImpl.java:82-90` (no log calls) + `CollectorController.java:47-51` (no log calls)
  - **Existing-ADR-or-implied-prescription**: None defends the absence. ADR-CANDIDATE-017 (token rotation semantics) describes the structural decisions; audit logging is not part of those decisions and the absence is a gap.
  - **Proposed remedy**: Add INFO-level audit log at the regenerate boundary: `log.info("[token-rotation] collectorId={} actor={}", collectorId, currentUsername)`. Optionally append to a dedicated `audit_log` table for query-able forensic history (so rotation history beyond the most-recent state is recoverable). Document on the live `enable-security` page that rotation is logged.
  - **Severity rationale**: HIGH — investigation-readiness gap on a credential-rotation surface. An attacker who rotates collector tokens to disrupt ingestion (REFACTOR-049 + REFACTOR-064 amplifier path) leaves no application-side trail.

**Discriminating context**: `grep` for `log.(info|warn|debug|error)` against CollectorController, CollectorServiceImpl, TokenGeneratorImpl, ReactiveTokenRepositoryImpl returned zero matches. The TOKEN row's `updated_by` column captures the actor username from `AuthIdentityProvider.getCurrentUser()` — the only forensic trail — but `updated_by` is overwritten on the next rotation, so the audit trail is single-state, not append-only. A security-incident review of "who rotated token X 30 days ago" cannot answer from production data.

**Full detail**: `detail/REFACTOR-046.md`

---

## REFACTOR-047 — Collector token rotation has no grace period — in-flight ingestion using the previous token 401s the moment the UPDATE commits; no `previous_token` column, no `valid_until` window

**Severity**: HIGH
**Category**: missing-grace-period
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[5]` (severity HIGH operational)
  - **Statement**: ADR-CANDIDATE-017's "in-place UPDATE" rotation model has a structural consequence: there is NO overlap window during which the old token still authenticates. The moment `UPDATE token SET value = ... WHERE id = :id` commits, every in-flight ingestion request using the old token starts 401-ing with `"Token is not correct"` (`IngestionDataEntitiesFilter.java:55-58` — single-value `String.equals(...)`). Operators rotating during active ingestion cause an outage that lasts until every collector picks up the new token (config-file change + restart). Neither the docs site nor the response body warns of this.
  - **Evidence**: `TokenGeneratorImpl.java:44-52` + `ReactiveTokenRepositoryImpl.java:30-39` + `IngestionDataEntitiesFilter.java:55-58`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 codifies the in-place UPDATE model. This scope is a structural consequence of the model, not a violation. The absence of defending documentation IS a gap (the operator has no warning); the absence of a grace-period mechanism is a feature gap (adding `previous_token` + `valid_until` would be a structural change requiring an extension ADR).
  - **Proposed remedy**: At minimum, document the operational consequence on a new "Token Rotation" doc section (under `enable-security`). At maximum, add a `previous_token` + `previous_token_valid_until` columns to the TOKEN table; modify `IngestionDataEntitiesFilter` to accept either the current or the (still-valid) previous token; expose `attachment.token.rotation-grace-minutes` as an operator config. The structural change requires extending or superseding ADR-CANDIDATE-017.
  - **Severity rationale**: HIGH — operational severity. Operators rotating during incident response can cascade into ingestion outages.

**Discriminating context**: ADR-CANDIDATE-017's "in-place UPDATE" rotation model has a structural consequence: there is NO overlap window during which the old token still authenticates. The moment `UPDATE token SET value = ... WHERE id = :id` commits, every in-flight ingestion request using the old token starts 401-ing with `"Token is not correct"` (`IngestionDataEntitiesFilter.java:55-58` — single-value `String.equals(...)`). Operators rotating during active ingestion cause an outage that lasts until every collector picks up the new token (config-file change + restart). Neither the docs site nor the response body warns…

**Full detail**: `detail/REFACTOR-047.md`

---

## REFACTOR-048 — Collector tokens stored in plaintext at rest in the `TOKEN` table — DB read, replica, backup, or jOOQ log carries credentials in the clear

**Severity**: HIGH
**Category**: plaintext-at-rest
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[3]` (severity HIGH)
    - **STRENGTHENED 2026-05-10B** — `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[2]` + `security.known_security_gaps.[1]` (severity MEDIUM per sidecar; corroborates from the verify side: "Token comparison is `.equals(...)` (line 56), not `MessageDigest.isEqual(...)` — vulnerable to timing-based token discovery on a local network where an attacker can measure response time differences. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle is violated." — the verify side's plaintext `.equals(...)` confirms the storage shape established by the rotate side; together they compose the full plaintext-at-rest + plaintext-equality + non-constant-time model. REFACTOR-079 captures the constant-time-comparison gap independently; REFACTOR-048 is the storage-at-rest dimension)
  - **Statement**: ADR-CANDIDATE-017's "plaintext-equality against in-DB string" model means the database stores tokens as-is. There is no application-layer hashing (no BCrypt, no SHA-256+salt, no HMAC verification — the `IngestionDataEntitiesFilter` does a literal `dto.tokenPojo().getValue().equals(token)` check at line 55-58). A read-only DB replica, a Postgres backup, a jOOQ statement log capture, an SQL-injection at the TOKEN table — any of these escalates from "DB read" to "platform-wide ingestion compromise."
  - **Evidence**: `ReactiveTokenRepositoryImpl.java:21-39` (record stored as-is) + `IngestionDataEntitiesFilter.java:55-58` (plaintext `.equals(...)` check confirms no hashing)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 codifies the plaintext-equality model. This scope is the structural consequence of the model; addressing it is a structural change (would require BCrypt-on-write + BCrypt.matches-on-read, breaking the rotation model that returns plaintext on regenerate). The maintainer's choice for ADR-017 was "long-random over TLS"; the gap-shape of REFACTOR-048 is the price.
  - **Proposed remedy**: At minimum, document on the new "Token Rotation" doc section that tokens are plaintext at rest and that operators must (a) restrict DB access, (b) encrypt-at-rest at the storage layer, (c) treat backups as credential-bearing. At maximum, redesign to BCrypt-at-rest, which would require extending ADR-CANDIDATE-017 (and breaks the rotation model: the new BCrypt'd token can no longer be RETURNed in plaintext to the operator).
  - **Severity rationale**: HIGH — credential plaintext at rest is one DB read away from total ingestion compromise.

**Discriminating context**: ADR-CANDIDATE-017's "plaintext-equality against in-DB string" model means the database stores tokens as-is. There is no application-layer hashing (no BCrypt, no SHA-256+salt, no HMAC verification — the `IngestionDataEntitiesFilter` does a literal `dto.tokenPojo().getValue().equals(token)` check at line 55-58). A read-only DB replica, a Postgres backup, a jOOQ statement log capture, an SQL-injection at the TOKEN table — any of these escalates from "DB read" to "platform-wide ingestion compromise."

**Full detail**: `detail/REFACTOR-048.md`

---

## REFACTOR-049 — Under `auth.type=DISABLED`, the token regenerate endpoint is anonymously reachable — `COLLECTOR_TOKEN_REGENERATE` permission is bypassed entirely; any caller can rotate any collector's token and receive the plaintext

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[6]` (severity HIGH in DISABLED deployments)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[4]` (severity HIGH in DISABLED deployments)
  - **Statement**: Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` short-circuits all permission checks via `.anyExchange().permitAll()`. The `COLLECTOR_TOKEN_REGENERATE` permission gate at `SecurityConstants.java:135-137` is consumed only by `AuthorizationCustomizer` in the protected-mode security configurations. Result: any caller able to reach the platform on a DISABLED deployment can `PUT /api/collectors/{id}/token`, rotate any collector's token, and receive the plaintext in the response. `TokenGeneratorImpl.java:30-31` falls through to `Mono.just(this.regenerate(tokenPojo, null))` — the resulting TOKEN row's `updated_by` is NULL, so even the single-state forensic trail is empty.
  - **Evidence**: `TokenGeneratorImpl.java:27-32` (no-current-user fallback) + `DisabledAuthSecurityConfiguration.java` (filename per glob)
  - **Existing-ADR-or-implied-prescription**: None. (DISABLED is documented as dev-only in the live security docs, but the docs do not specifically warn about token-rotation exposure under DISABLED — only generic "use only in dev" guidance.)
  - **Proposed remedy**: Either (a) gate the rotation endpoint with `@ConditionalOnProperty(value="auth.type", havingValue="DISABLED", matchIfMissing=false)` to register a fail-closed bean variant; (b) add a startup banner WARN when `auth.type=DISABLED` is set in production-shaped deployments (e.g., when `spring.profiles.active!=dev`); (c) document the exposure prominently on the live `enable-security` page.
  - **Severity rationale**: HIGH (in DISABLED deployments). Combines with REFACTOR-046 (no audit log) for a forensically-invisible platform-wide ingestion DoS via rotation-spam.

**Discriminating context**: Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` short-circuits all permission checks via `.anyExchange().permitAll()`. The `COLLECTOR_TOKEN_REGENERATE` permission gate at `SecurityConstants.java:135-137` is consumed only by `AuthorizationCustomizer` in the protected-mode security configurations. Result: any caller able to reach the platform on a DISABLED deployment can `PUT /api/collectors/{id}/token`, rotate any collector's token, and receive the plaintext in the response. `TokenGeneratorImpl.java:30-31` falls through to `Mono.just(this.regenerate(tokenPojo, null))` — the…

**Full detail**: `detail/REFACTOR-049.md`

---

## REFACTOR-050 — `postMessageInSlack` has no authorization gate AND no owner-scoping on `data_entity_id` — any authenticated user can attach a message to any data entity in the catalog and send it to any Slack channel the bot has been invited to

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[0]` (severity HIGH — no authz gate)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[3]` (severity HIGH — no owner scoping)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[0]` (severity HIGH)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[2]` (severity HIGH)
  - **Statement**: `POST /api/datacollaboration/providers/slack/messages` carries no `@PreAuthorize`, no `SecurityRule` in `SecurityConstants.SECURITY_RULES`, and no programmatic permission check in `DataCollaborationServiceImpl.createAndSendMessage(...)`. The request only falls through `AuthorizationCustomizer.pathMatchers('/**').authenticated()`. Combined with the `data_entity` lookup checking only existence + non-hollowness (`DataCollaborationServiceImpl.java:50-52`, no owner filter), any authenticated user can post a message to any Slack channel the configured bot can reach, attached to any `data_entity_id` — INCLUDING data entities owned by other tenants/owners. This is BOTH a violation of ADR-CANDIDATE-002 (centralised SECURITY_RULES is the registry; a missing entry is a violation, not a posture) AND a cross-tenant message-injection path.
  - **Evidence**: `SecurityConstants.java:96-355` (no entry for `/api/datacollaboration/providers/slack/messages`) + `AuthorizationCustomizer.java:29-30` (catch-all) + `DataCollaborationController.java:33-39` (no annotations) + `DataCollaborationServiceImpl.java:47-62` (no owner filter, no permission check)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) prescribes "every mutating endpoint is one row in SECURITY_RULES." This scope is a **violation** of that ADR — there is no row for `postMessageInSlack`. The decision to write to Slack is a mutation (it triggers an external-system side-effect AND persists `messages` rows); a missing rule is a missed gate, not a posture.
  - **Proposed remedy**: Add a SECURITY_RULES entry for `POST /api/datacollaboration/providers/slack/messages` mapped to a new `DATA_COLLABORATION_MESSAGE_POST` permission in `DATA_ENTITY` context (gated by ownership of the `data_entity_id` in the request body). Service-side, add an owner-scoping check in `DataCollaborationServiceImpl.createAndSendMessage` that asserts the calling user has read access to the `data_entity_id`. Add an integration test that attempts cross-owner posting under a non-owning principal and asserts 403.
  - **Severity rationale**: HIGH — cross-tenant data-injection vector + privilege-boundary leak. Outbound side-effect to Slack means the misuse is operationally visible to the affected workspace.

**Discriminating context**: `POST /api/datacollaboration/providers/slack/messages` carries no `@PreAuthorize`, no `SecurityRule` in `SecurityConstants.SECURITY_RULES`, and no programmatic permission check in `DataCollaborationServiceImpl.createAndSendMessage(...)`. The request only falls through `AuthorizationCustomizer.pathMatchers('/**').authenticated()`. Combined with the `data_entity` lookup checking only existence + non-hollowness (`DataCollaborationServiceImpl.java:50-52`, no owner filter), any authenticated user can post a message to any Slack channel the configured bot can reach, attached to any `data_entity_id`…

**Full detail**: `detail/REFACTOR-050.md`

---

## REFACTOR-053 — `getActivity` exposes the entire platform's audit trail to any authenticated user — including `old_state`/`new_state` of every tracked field (descriptions, business names, ownership transitions, custom-metadata values) for resources the caller has no relation to

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[0]` (severity HIGH)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[4]` (severity MEDIUM in sidecar but HIGH at concept-aggregate level given audit-trail-confidentiality)
  - **Statement**: `/api/activity` (and `/api/activity/counts`) has no `@PreAuthorize`, no programmatic permission check at controller or service layer, and no entry in `SecurityConstants.SECURITY_RULES`. Under LOGIN_FORM/OAUTH2/LDAP, any authenticated user can read the GLOBAL activity feed across every owner — including audit trails for resources they have no ownership association with, exposing actor identity (`created_by`) and full old-state/new-state diffs of descriptions, business names, ownership changes, and custom metadata. The Policies/Permissions/Roles/Owners framework documented at `/configuration-and-deployment/enable-security/authorization` is not applied. The activity-feed feature page makes no visibility statement — operators reading the docs cannot determine that ANY authenticated user reads the GLOBAL audit trail. Combined with `DescriptionActivityStateDto` (free-text descriptions) flowing through the audit history, ANY description ever entered on the platform (incident notes, customer identifiers, internal tickets) is readable by every authenticated user.
  - **Evidence**: `ActivityController.java:1-58` + `ActivityServiceImpl.java:86-117` (no security context read) + `SecurityConstants.java:95-356` (no /api/activity rule) + `DescriptionActivityStateDto.java:3` (the free-text payload) + WebFetch `/configuration-and-deployment/enable-security/authorization` (no per-endpoint wiring) + WebFetch `/features/active-platform-features/activity-feed` (no visibility statement)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative GET-uniformly-authenticated, BORDERLINE) MAY defend this — if the read-collaborative posture is intentional, the global activity feed is consistent with it. However, the audit-trail-of-all-changes-ever is qualitatively different from "any authenticated user reads any data entity's metadata" — audit history typically warrants stricter gating in any RBAC-aware system. This scope is the strongest single piece of evidence the maintainer should resolve the ADR-CANDIDATE-003 borderline toward "missed gate" rather than "intentional posture."
  - **Proposed remedy**: Either (a) add a `PLATFORM_ACTIVITY_READ_ALL` permission and SECURITY_RULES entry that gates the global activity feed; or (b) split `/api/activity` into `/api/activity/my` (owner-scoped, no permission gate) and `/api/activity/all` (admin-permission gated); or (c) confirm ADR-CANDIDATE-003's read-collaborative posture and document on the live security page that the global audit trail is intentionally readable by every authenticated user. The maintainer's call.
  - **Severity rationale**: HIGH — audit-trail-confidentiality breach affecting every change ever made on the platform, including potentially-sensitive descriptions.

**Discriminating context**: `/api/activity` (and `/api/activity/counts`) has no `@PreAuthorize`, no programmatic permission check at controller or service layer, and no entry in `SecurityConstants.SECURITY_RULES`. Under LOGIN_FORM/OAUTH2/LDAP, any authenticated user can read the GLOBAL activity feed across every owner — including audit trails for resources they have no ownership association with, exposing actor identity (`created_by`) and full old-state/new-state diffs of descriptions, business names, ownership changes, and custom metadata. The Policies/Permissions/Roles/Owners framework documented at…

**Full detail**: `detail/REFACTOR-053.md`

---

## REFACTOR-058 — Chunk staging path is `attachment.storage`-INDEPENDENT — `FileUtils.CHUNK_BASE_PATH = "/tmp/odd/chunks"` is a hardcoded constant; multi-instance failure mode applies to LOCAL **and** REMOTE storage equally

**Severity**: HIGH
**Category**: multi-instance-fs
**Surfaced by**:
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:performance.known_performance_gaps.[0]` (severity HIGH)
  - **Statement**: NEW finding from the chunk-method sidecar that elaborates and corrects the class-level finding (REFACTOR-033). The chunk staging path constant `FileUtils.CHUNK_BASE_PATH = "/tmp/odd/chunks"` (`FileUtils.java:24`) is a **hardcoded constant**, NOT config-driven. Both `LocalFileUploadServiceImpl.java:37` (LOCAL) and `RemoteFileUploadServiceImpl.java:56` (REMOTE) call `FileUtils.createDirectories(chunkDirectory)` from the same path. The storage backend ONLY differs at `completeFileUpload` finalisation — chunks are staged at the same per-instance local-fs path regardless of `attachment.storage` value. A horizontally-scaled REMOTE deployment without a shared volume backing `/tmp/odd/chunks` produces intermittent failures whenever the load balancer routes `initiateFileUpload` and `uploadFileChunk` to different instances, EXACTLY THE SAME WAY a LOCAL deployment does. The class-level sidecar attributed multi-instance brokenness to LOCAL only; that attribution is incomplete. (Note: REFACTOR-033 is the LOCAL-flavour finding; this entry generalises to BOTH backends.)
  - **Evidence**: `FileUtils.java:23-28` (`CHUNK_BASE_PATH = "/tmp/odd/chunks"` constant, not config-driven) + `FileServiceImpl.java:60-62` (writes to that path regardless of backend) + `LocalFileUploadServiceImpl.java:34-38` + `RemoteFileUploadServiceImpl.java:55-56` (both create-directories at the same location)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-012 (boot-time wiring) does not address chunk staging — the wiring decision is about the storage backend, but the chunk staging path is upstream of the backend dispatch.
  - **Proposed remedy**: Promote `CHUNK_BASE_PATH` from a hardcoded constant to a config key `attachment.chunk-staging.path` (default `/tmp/odd/chunks` for back-compat; recommended override for any multi-instance deployment). Document on the live config page that multi-instance deployments require a shared volume mount AT this path (irrespective of LOCAL vs REMOTE storage backend). Update REFACTOR-033's scope to LOCAL-finalisation-only and cite this scope as the chunk-staging-flavour.
  - **Severity rationale**: HIGH — silent failure mode on multi-instance deployments. Operators choosing REMOTE storage to escape the LSN-001 ephemeral-storage trap discover (only on production traffic) that the chunk-staging path traps them anyway.

**Discriminating context**: NEW finding from the chunk-method sidecar that elaborates and corrects the class-level finding (REFACTOR-033). The chunk staging path constant `FileUtils.CHUNK_BASE_PATH = "/tmp/odd/chunks"` (`FileUtils.java:24`) is a **hardcoded constant**, NOT config-driven. Both `LocalFileUploadServiceImpl.java:37` (LOCAL) and `RemoteFileUploadServiceImpl.java:56` (REMOTE) call `FileUtils.createDirectories(chunkDirectory)` from the same path. The storage backend ONLY differs at `completeFileUpload` finalisation — chunks are staged at the same per-instance local-fs path regardless of `attachment.storage`…

**Full detail**: `detail/REFACTOR-058.md`

---

## REFACTOR-068 — Under `auth.type=DISABLED` (the application.yml default), `/api/appInfo` is reachable by unauthenticated network callers and discloses the active auth mode + project version — a passive fingerprinting surface; live docs do not warn that the default deployment leaks both pieces of metadata

**Severity**: HIGH
**Category**: info-disclosure
**Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[2]` + `bugs_limitations_corner_cases.[3]` (severity MEDIUM in sidecar but HIGH at concept-aggregate level given the LSN-001-shape default + the fingerprinting-for-CVE-matching framing)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:security.known_security_gaps.[0]` (severity MEDIUM in sidecar with LSN-001/LSN-010 case-law citation; promoted to HIGH here for cross-cutting alignment with REFACTOR-073 / REFACTOR-078)
  - **Statement**: `/api/appInfo` is NOT in `SecurityConstants.WHITELIST_PATHS` (which contains only `/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events`) and NOT in `SECURITY_RULES`. Under `auth.type=DISABLED` (the `application.yml:34` default), `DisabledAuthSecurityConfiguration.java:16` applies `.anyExchange().permitAll()` — so `/api/appInfo` is reachable by ANY network caller. The response body contains `{authType, projectVersion}` (`AppInfoController.java:24-28` + `AppInfo.java:22-66`). A network attacker can therefore (a) determine the platform's auth mode (telling them whether to attempt credential stuffing, OIDC tampering, or just walk in) and (b) determine the precise project version (telling them which CVEs apply). Neither piece of metadata is documented as a public-disclosure surface in the live docs (WebFetched 2026-05-10 of `/configuration-and-deployment/enable-security`).
  - **Evidence**: `AppInfoController.java:18-29` (no auth annotation, returns AppInfo) + `application.yml:34` (`auth.type: DISABLED` default) + `DisabledAuthSecurityConfiguration.java:13-18` (`.anyExchange().permitAll()`) + `SecurityConstants.java:95-96` (WHITELIST_PATHS does not include `/api/appInfo`) + WebFetch of live `enable-security` page on 2026-05-10 (status 200, no `/api/appInfo` coverage)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-024 (NEW 2026-05-10B — AppInfo auth-mode introspection contract) describes the deliberate publication of `authType`; the ADR does NOT defend the absence of pre-auth-vs-post-auth coverage policy. The decision was made in the context of LOGIN_FORM/OAUTH2/LDAP modes (where the SPA needs the response BEFORE the user has authenticated, so pre-auth reachability is required); the consequence under DISABLED — anonymous network fingerprinting — is a structural side effect, not a defended posture.
  - **Proposed remedy**: Either (a) explicitly add `/api/appInfo` to `SecurityConstants.WHITELIST_PATHS` AND document on the live `enable-security` page that the endpoint is intentionally pre-auth-reachable to support SPA login-flow rendering, with the trade-off (passive fingerprinting under DISABLED) called out; OR (b) restrict the endpoint to authenticated callers under LOGIN_FORM/OAUTH2/LDAP and find an alternative SPA-side mechanism for pre-auth login-flow discovery. Option (a) is the lower-risk path and aligns with the ADR's reporter contract — surface the disclosure explicitly on the docs page, including the recommendation NOT to run `auth.type=DISABLED` on network-reachable deployments.
  - **Severity rationale**: HIGH — LSN-001-shape silent unsafe default (`auth.type=DISABLED` is the `application.yml:34` default) compounding with an undocumented disclosure surface. Operators following the live docs may inherit this exposure without realising.

**Discriminating context**: `/api/appInfo` is NOT in `SecurityConstants.WHITELIST_PATHS` (which contains only `/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events`) and NOT in `SECURITY_RULES`. Under `auth.type=DISABLED` (the `application.yml:34` default), `DisabledAuthSecurityConfiguration.java:16` applies `.anyExchange().permitAll()` — so `/api/appInfo` is reachable by ANY network caller. The response body contains `{authType, projectVersion}` (`AppInfoController.java:24-28` + `AppInfo.java:22-66`). A network attacker can therefore (a) determine the platform's auth mode (telling them whether…

**Full detail**: `detail/REFACTOR-068.md`

---

## REFACTOR-072 — `auth.type=LOGIN_FORM` runs WITHOUT the `AuthorizationCustomizer` — no `Policy / Permission / Role / Owner` framework enforcement; the live Authorization docs page describes the framework without naming this precondition

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:security.known_security_gaps.[1]` (severity HIGH)
  - **Statement**: `LoginFormSecurityConfiguration.java:55-58` configures its `SecurityWebFilterChain` with `authorizeExchange(...).pathMatchers("/**").authenticated()` — gating by authentication, not by the `Policy / Permission / Role / Owner` framework. The composite `AuthorizationManagerCondition` correctly returns FALSE for LOGIN_FORM (intentional — only OAUTH2 and LDAP are in the disjunction); the consequence is undocumented: the entire authorization framework is silently absent in LOGIN_FORM deployments. Any authenticated user can hit any endpoint that depends on `AuthorizationCustomizer` for fine-grained access control. The live `/configuration-and-deployment/enable-security/authorization` page describes Policies/Permissions/Roles/Owners as the authorization model **without** stating which auth modes wire them in.
  - **Evidence**: `LoginFormSecurityConfiguration.java:55-58` (no `AuthorizationCustomizer` invocation) + `OAuthSecurityConfiguration.java:98` (`.authorizeExchange(new AuthorizationCustomizer(...))`) + `LDAPSecurityConfiguration.java:145` (same) + `AuthorizationManagerCondition.java:11-17` (only OAUTH2 + LDAP nested) + WebFetch of `/configuration-and-deployment/enable-security/authorization` on 2026-05-10 (status 200, no precondition statement)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-025 (NEW — AnyNestedCondition idiom) confirms the OR-of-OAUTH2-and-LDAP is deliberate; the absence of LOGIN_FORM from the disjunction is structural. The ADR does NOT defend the documentation gap or the absence of an alternative authorization layer for LOGIN_FORM. The live docs frame LOGIN_FORM as "dev-only", which is the closest mitigating signal but does not state the consequence.
  - **Proposed remedy**: Either (a) wire `AuthorizationCustomizer` for LOGIN_FORM (would require including LOGIN_FORM as a third nested class in `AuthorizationManagerCondition` AND resolving the dead-code issue per REFACTOR-071); OR (b) document explicitly on the live `enable-security/authorization` page that the authorization framework is wired ONLY under OAUTH2 and LDAP, with LOGIN_FORM running "authentication only, no authorization." Doc-side option (b) is the safe immediate fix; the wire-it option (a) is a larger architectural change that may not be desirable given LOGIN_FORM's dev-only positioning.
  - **Severity rationale**: HIGH — operators running LOGIN_FORM in production (against the docs' guidance, but plausible) inherit authenticated-but-unauthorized; every authenticated user can call every endpoint that depends on `AuthorizationCustomizer` for permission enforcement.

**Discriminating context**: `LoginFormSecurityConfiguration.java:55-58` configures its `SecurityWebFilterChain` with `authorizeExchange(...).pathMatchers("/**").authenticated()` — gating by authentication, not by the `Policy / Permission / Role / Owner` framework. The composite `AuthorizationManagerCondition` correctly returns FALSE for LOGIN_FORM (intentional — only OAUTH2 and LDAP are in the disjunction); the consequence is undocumented: the entire authorization framework is silently absent in LOGIN_FORM deployments. Any authenticated user can hit any endpoint that depends on `AuthorizationCustomizer` for fine-grained…

**Full detail**: `detail/REFACTOR-072.md`

---

## REFACTOR-073 — No boot-time security-posture validator — operator misconfigurations (empty `auth.type`, typo'd `auth.type`, `auth.type=DISABLED` + `auth.ingestion.filter.enabled=false` on a network-reachable deployment) produce silently-degraded security postures with no fail-fast

**Severity**: HIGH
**Category**: missing-fail-fast

**Discriminating context**: The platform has no `@PostConstruct`-level security-posture validator that runs at boot and fails-loud or warns-loud on misconfiguration combinations. The three independent gaps surfaced by three independent sidecars compose into a single architectural shape: **misconfiguration is always silent**. Operator scenarios: (a) `auth.type` empty (env unset, `AUTH_TYPE=`) → no `SecurityWebFilterChain` bean wired, behaviour falls back to Spring Boot's autoconfigured permit-all default — silent. (b) `auth.type=OUATH2` (typo of OAUTH2) → no `@ConditionalOnProperty(havingValue=...)` matches, same silent…

**Full detail**: `detail/REFACTOR-073.md`

---

## REFACTOR-074 — Tenant-id label asymmetry between write side (`!= null`) and read side (`isNotEmpty`) — an operator supplying `ODD_TENANT_ID=` (empty env var, not unset) silently splits the multi-tenant dataset

**Severity**: HIGH
**Category**: label-asymmetry
**Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:security.known_security_gaps.[0]` (severity HIGH — multi-tenant isolation gap)
  - **Statement**: `AbstractTimeSeriesExtractor.java:60` (write side) uses `if (tenantId != null)` — an empty string passes the guard and writes a `tenant_id=""` label onto every TimeSeries record. `ExternalMetricReader.java:111` (read side) uses `StringUtils.isNotEmpty(tenantId)` — an empty string FAILS the guard and the read filter omits the `tenant_id` clause. Net effect: an operator supplying `ODD_TENANT_ID=` via env (set to empty string, not unset) sees writes go to `tenant_id=""` series tagged with an unfilterable label, while reads query across ALL tenants (no filter applied). In a shared-Prometheus multi-tenant deployment, this would either (a) bury THIS tenant's series under an unfilterable empty-tenant-id label, or (b) leak THIS tenant's reads to include series from co-tenants whose `tenantId` was `null`. The platform's multi-tenant isolation depends on this asymmetric pair behaving correctly, and they do not.
  - **Evidence**: `AbstractTimeSeriesExtractor.java:60` (`if (tenantId != null)`) + `ExternalMetricReader.java:111` (`StringUtils.isNotEmpty(tenantId)`) + `application.yml:208-210` (`tenant-id:` declared empty by default, distinguishable from unset only at env-override time)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-026 (NEW 2026-05-10B — metric storage mirrored `@ConditionalOnProperty`) describes the binary-switch wiring; this scope is a gap-shape within the chosen wiring — the multi-tenant property design relies on consistent empty-vs-null treatment between write and read sides, which the implementation does not provide.
  - **Proposed remedy**: Pick a single canonical empty-string treatment and apply it on both sides. Recommended: use `StringUtils.isNotEmpty(tenantId)` on both sides (treat empty-string as no-tenant-id) — this aligns with the live doc claim that "empty means no label is applied, and the Prometheus query returns series across all tenants." Add a unit test that injects `ODD_TENANT_ID=""` and asserts both writes and reads produce series-without-tenant-id-label. Document on the live `/configuration-and-deployment/odd-platform#prometheus-tenant-label-odd-tenant-id` page that empty-string and unset are equivalent.
  - **Severity rationale**: HIGH — multi-tenant isolation can fail silently under a specific env-override pattern that operators commonly use (empty string is the canonical "unset" signal for some CI/CD systems).

**Discriminating context**: `AbstractTimeSeriesExtractor.java:60` (write side) uses `if (tenantId != null)` — an empty string passes the guard and writes a `tenant_id=""` label onto every TimeSeries record. `ExternalMetricReader.java:111` (read side) uses `StringUtils.isNotEmpty(tenantId)` — an empty string FAILS the guard and the read filter omits the `tenant_id` clause. Net effect: an operator supplying `ODD_TENANT_ID=` via env (set to empty string, not unset) sees writes go to `tenant_id=""` series tagged with an unfilterable label, while reads query across ALL tenants (no filter applied). In a shared-Prometheus…

**Full detail**: `detail/REFACTOR-074.md`

---

## REFACTOR-078 — Default deployment ships with `POST /ingestion/entities` UNAUTHENTICATED — `application.yml:48` sets `auth.ingestion.filter.enabled: false`; live docs do not surface this property; same shape as LSN-001 (attachment-storage ephemeral default)

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[0]` (severity HIGH)
  - **Statement**: `IngestionDataEntitiesFilter.java:20` carries `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` with NO `matchIfMissing=true` attribute. `application.yml:46-48` explicitly sets the property to `false`. Combined with `SecurityConstants.WHITELIST_PATHS` including `/ingestion/**` and every security config's `permittedPaths` (or whitelist) including `/ingestion/entities` (`LoginFormSecurityConfiguration.java:50`), the result is: ANY caller able to reach the platform's HTTP port can `POST /ingestion/entities` with a valid `DataEntityList` payload and have entities ingested. This is the same shape as LSN-001 (attachment-storage ephemeral default) — a critical-severity default that the docs do not warn about. The live `/configuration-and-deployment/enable-security/authentication` page enumerates DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S without mentioning `auth.ingestion.filter.enabled` or that `POST /ingestion/entities` is unauthenticated under default.
  - **Evidence**: `IngestionDataEntitiesFilter.java:20` (no `matchIfMissing`) + `application.yml:46-48` (`auth.ingestion.filter.enabled: false`) + `LoginFormSecurityConfiguration.java:50` (permitted paths include `/ingestion/entities`) + `SecurityConstants.java:95-96` (WHITELIST_PATHS includes `/ingestion/**`) + WebFetch of live `/configuration-and-deployment/enable-security/authentication` page on 2026-05-10 (status 200, property not mentioned)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 (NEW 2026-05-10B — ingestion-endpoint auth trust gradient) codifies the opt-in posture as the deliberate design (registration-mandatory → ingestion-opt-in → external-alert-network-delegated). The ADR does NOT defend the docs-don't-surface-the-toggle gap — the deliberate opt-in posture is only safe IF operators are told about the toggle. The docs gap is the LSN-001-shape failure mode.
  - **Proposed remedy**: Either (a) flip the default to `auth.ingestion.filter.enabled: true` and require operators to explicitly opt OUT for dev mode; OR (b) keep the default but surface the property on the live `/configuration-and-deployment/enable-security/authentication` page with a prominent `{% hint style="danger" %}` admonition explaining the implication: "Default deployment ships with `POST /ingestion/entities` unauthenticated. Operators running ODD on a network-reachable host MUST set `auth.ingestion.filter.enabled=true` AND configure per-collector tokens." The (b) option preserves the deliberate opt-in posture from ADR-CANDIDATE-027; the (a) option is a breaking change for existing dev deployments but a safer default. Maintainer triage decision.
  - **Severity rationale**: HIGH — LSN-001-shape silent unsafe default. Operators following the live docs may run a production-shaped deployment with an unauthenticated ingestion endpoint.

**Discriminating context**: `IngestionDataEntitiesFilter.java:20` carries `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` with NO `matchIfMissing=true` attribute. `application.yml:46-48` explicitly sets the property to `false`. Combined with `SecurityConstants.WHITELIST_PATHS` including `/ingestion/**` and every security config's `permittedPaths` (or whitelist) including `/ingestion/entities` (`LoginFormSecurityConfiguration.java:50`), the result is: ANY caller able to reach the platform's HTTP port can `POST /ingestion/entities` with a valid `DataEntityList` payload and have entities…

**Full detail**: `detail/REFACTOR-078.md`

---

## REFACTOR-082 — AlertManager sibling endpoint `POST /ingestion/alert/alertmanager` is NOT covered by ANY filter — `auth.ingestion.filter.enabled` reads as if it locks down 'ingestion' globally but covers only `/ingestion/entities`; the property name is misleading

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[6]` (severity HIGH)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[3]` (severity HIGH)
  - **Statement**: `AlertManagerController.java:21` carries `@PostMapping(path = "ingestion/alert/alertmanager")` with NO `@PreAuthorize`, is NOT matched by `IngestionDataEntitiesFilter` (path-matcher is `/ingestion/entities` exact), is NOT matched by `IngestionDataSourceFilter` (path-matcher is `/ingestion/datasources` exact), and IS in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`) + every auth mode's permitted-paths. An attacker reaching the platform can POST arbitrary external-alert payloads, regardless of any `auth.ingestion.filter.enabled` setting. The property name suggests "ingestion is locked down" but the toggle covers only one of the `/ingestion/*` endpoints. This is the canonical case for ADR-CANDIDATE-006's deliberate network-delegated-auth posture — operators MUST deploy AlertManager behind a network-layer auth gate; the deliberate posture does NOT defend the docs-side gap that no operator is told this.
  - **Evidence**: `AlertManagerController.java:21` (no `@PreAuthorize`) + `IngestionDataEntitiesFilter.java:28` (path matcher: `/ingestion/entities` only) + `IngestionDataSourceFilter.java:20` (path matcher: `/ingestion/datasources` only)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-006 (AlertManager network-delegated auth) codifies the absence of app-layer auth as the deliberate decision. This scope is the misleadingly-named-property gap: the property name `auth.ingestion.filter.enabled` reads as if it covers the AlertManager endpoint but does not. The deliberate posture is sound; the property name (and the docs' framing) is what misleads.
  - **Proposed remedy**: Either (a) rename the property to `auth.ingestion.entities.filter.enabled` (breaking change requiring deprecation + migration window) to reflect the actual scope; OR (b) preserve the property name but add a prominent admonition on the live `enable-security/authentication` page explaining: "`auth.ingestion.filter.enabled=true` enables token verification ONLY on `POST /ingestion/entities`. Sibling endpoints `POST /ingestion/datasources` (always token-protected) and `POST /ingestion/alert/alertmanager` (NEVER application-layer protected; see ADR-CANDIDATE-006) follow different protection postures." Option (b) is the lower-risk path; option (a) is the explicit-naming fix.
  - **Severity rationale**: HIGH — combines with REFACTOR-078 (default-off ingestion filter) and REFACTOR-068 (DISABLED default) to produce a fully-open ingestion surface on an out-of-the-box deployment.

**Discriminating context**: `AlertManagerController.java:21` carries `@PostMapping(path = "ingestion/alert/alertmanager")` with NO `@PreAuthorize`, is NOT matched by `IngestionDataEntitiesFilter` (path-matcher is `/ingestion/entities` exact), is NOT matched by `IngestionDataSourceFilter` (path-matcher is `/ingestion/datasources` exact), and IS in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`) + every auth mode's permitted-paths. An attacker reaching the platform can POST arbitrary external-alert payloads, regardless of any `auth.ingestion.filter.enabled` setting. The property name suggests "ingestion is locked…

**Full detail**: `detail/REFACTOR-082.md`

---

## REFACTOR-085 — **NO RETENTION / DROP path for the `activity` table** — `AbstractPartitionManager.createPartitionsIfNotExists` only CREATEs; the live activity-feed Configuration page claims "Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`" but the code does NOT auto-drop partitions; silent monotonic growth

**Severity**: HIGH
**Category**: missing-retention
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:docs_link_semantic.doc_drift_findings.[0]`
    - **STRENGTHENED 2026-05-12D** — `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[0]` (severity HIGH — confirms from 2nd angle: `HousekeepingTTLProperties.java:8-12` has exactly three TTL fields and NO activity field; `ActivityEmptyPartitionsHousekeepingJob` only drops empty partitions (`isPartitionEmpty` check at `PartitionServiceImpl.java:133-141`); ANY partition with even one row is retained indefinitely. The cross-angle triangulation makes the claim unambiguous: NO time-based retention for activity-feed data exists anywhere in the platform codebase.)
    - **STRENGTHENED 2026-05-12D** — REFACTOR-150 (NEW 2026-05-12D — same shape on `MESSAGE` table for DataCollaboration) confirms this as a CROSS-SUBSYSTEM pattern: high-volume Postgres-resident audit tables in this codebase have NO time-based retention; only EMPTY-past-partition cleanup. The pattern applies to activity AND message tables.
  - **Statement**: `AbstractPartitionManager.java:14-51` only creates partitions; it never invokes `PartitionService.dropPartition` or `getEmptyPastPartitions`. The `PartitionService` interface defines both methods (`PartitionService.java:21-25`), and `PartitionServiceImpl` implements `dropPartition` at lines 82-127, but a grep for callers across the partition package returns only the service itself — no `AbstractPartitionManager` or `PostgreSQLPartitionCreationJob` invokes `dropPartition` for the activity table. Net effect: the `activity` table grows monotonically. An operator running ODD for several years with high-volume activity (e.g., 1M events/day) accumulates 365×N days × ~size-per-event of audit data with no automatic cleanup. The live `/features/active-platform-features/activity-feed#configuration` page explicitly tells operators that the setting controls "retention and partitioning" — that claim is **incorrect**: setting `partition-period=7` narrows partitions but does NOT shorten the retained window. To actually shorten retention, an operator must manually `DROP TABLE activity_YYYYMMDD_YYYYMMDD` partitions. This is the same shape as LSN-001 (attachment-storage ephemeral default) — silent operator-misleading default with production consequences.
  - **Evidence**: `AbstractPartitionManager.java:14-51` (no `dropPartition` invocation anywhere) + `PartitionService.java:21-25` (`getEmptyPastPartitions` + `dropPartition` defined but unused by this caller) + grep of the partition package for `dropPartition` returns only PartitionService.java + PartitionServiceImpl.java (no callers) + WebFetch of `/features/active-platform-features/activity-feed#configuration` on 2026-05-10 (status 200, live quote: "Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`")
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW 2026-05-10B — range-partition lifecycle) codifies the four-decision family including the continue-on-failure orchestration; the ADR does NOT defend the absence of a retention path because the absence has no stated rationale. The maintainer chose width-and-cadence + dual-lock + extensibility + continue-on-failure; retention was simply not addressed. The docs-side claim ("retention and partitioning are controlled by") is the canonical case-law for "documentation that says the platform does X when the platform does not."
  - **Proposed remedy**: Either (a) extend `AbstractPartitionManager.createPartitionsIfNotExists` to also invoke `PartitionService.getEmptyPastPartitions` + `dropPartition` based on a new `odd.activity.partition-retention-days` config key (default unbounded for back-compat; operators opt in to retention by setting the value); OR (b) correct the live activity-feed Configuration page wording to remove the "retention" claim, replacing with "Activity-feed partition cadence is controlled by `odd.activity.partition-period`; the platform does NOT auto-drop old partitions — operators implement retention by manually `DROP TABLE activity_YYYYMMDD_YYYYMMDD` against partitions outside their retention window." Option (b) is the docs-only fix and the safe immediate path; option (a) is the structural fix that requires extending ADR-CANDIDATE-028.
  - **Severity rationale**: HIGH — LSN-001-shape silent operator-misleading default. The combination "docs claim retention" + "code does not implement retention" + "no auto-cleanup" produces years-of-storage-bloat with no warning. Operators relying on the doc claim WILL eventually run out of disk.

**Discriminating context**: `AbstractPartitionManager.java:14-51` only creates partitions; it never invokes `PartitionService.dropPartition` or `getEmptyPastPartitions`. The `PartitionService` interface defines both methods (`PartitionService.java:21-25`), and `PartitionServiceImpl` implements `dropPartition` at lines 82-127, but a grep for callers across the partition package returns only the service itself — no `AbstractPartitionManager` or `PostgreSQLPartitionCreationJob` invokes `dropPartition` for the activity table. Net effect: the `activity` table grows monotonically. An operator running ODD for several years…

**Full detail**: `detail/REFACTOR-085.md`

---

## REFACTOR-086 — Silent-fail swallow on partition CREATE failure — `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` catches `RuntimeException` and logs at ERROR before continuing the loop; no metric, no health-check degradation, no UI surfacing

**Severity**: HIGH
**Category**: observability
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[2]` (severity HIGH)
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:performance.known_performance_gaps.[1]` (severity MEDIUM per sidecar; HIGH at concept-aggregate given durability impact)
  - **Statement**: `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` (lines 53-61) catches the `RuntimeException` raised by `AbstractPartitionManager.createPartitionsIfNotExists` (line 49) and logs at ERROR before continuing the loop. There is no alerting, no metric, no health-check degradation, no UI surfacing. An ODD instance that booted with a DB role lacking CREATE TABLE privilege would log ERROR once at boot and the application would continue serving traffic — until `activity` INSERTs began failing as rows arrived for the uncovered window. Combined with the boot-time @PostConstruct execution (silently failed at startup, no readiness-probe signal) and the nightly cron (silently failed at midnight, no metric counter), the entire partition-creation subsystem can fail for weeks before any operator notices.
  - **Evidence**: `PostgreSQLPartitionCreationJob.java:53-60` (the `catch (final Exception e) { log.error(...); }` block) + `AbstractPartitionManager.java:48-50` (the wrapping `RuntimeException(e)`) + grep of the partition package for `MeterRegistry|Counter|Timer|Gauge` (zero matches)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW 2026-05-10B) codifies the continue-on-failure orchestration as the deliberate decision — "maximise partition-creation success across all tables over fail-fast detection of a single-table failure." The ADR DOES defend the absence of fail-loud; the ADR does NOT defend the absence of metrics/observability. Continue-on-failure is sound IF operators have an observability signal; the gap is the absence of any signal.
  - **Proposed remedy**: Add Micrometer instrumentation: (1) `partition.creation.success_total{table}` counter (incremented on success); (2) `partition.creation.failure_total{table}` counter (incremented in the catch block); (3) `partition.creation.last_success_seconds{table}` gauge (timestamp of last successful CREATE); (4) `partition.last_window_end_seconds{table}` gauge (the `endDate` of the most-recent partition). Operators can alert on "no success in 25 hours" or "failure count > 0 in last hour." Optionally: degrade the Spring Boot health-check to `OUT_OF_SERVICE` when the `last_success_seconds` is older than `partition-period` days — readiness-probe signal for k8s liveness.
  - **Severity rationale**: HIGH — durability-critical subsystem with no observability signal. Combines with REFACTOR-085 (no retention) for the full "operators have no visibility into the activity table's partition lifecycle" gap.

**Discriminating context**: `PostgreSQLPartitionCreationJob.createPartitionIfNotExists` (lines 53-61) catches the `RuntimeException` raised by `AbstractPartitionManager.createPartitionsIfNotExists` (line 49) and logs at ERROR before continuing the loop. There is no alerting, no metric, no health-check degradation, no UI surfacing. An ODD instance that booted with a DB role lacking CREATE TABLE privilege would log ERROR once at boot and the application would continue serving traffic — until `activity` INSERTs began failing as rows arrived for the uncovered window. Combined with the boot-time @PostConstruct execution…

**Full detail**: `detail/REFACTOR-086.md`

---

## REFACTOR-099 — LOGIN_FORM mode runs WITHOUT `AuthorizationCustomizer` — every form-authenticated user bypasses the Policies/Permissions/Roles/Owners framework regardless of admin-only endpoint gates configured via the platform UI

**Severity**: HIGH
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__LoginFormSecurityConfiguration__config-key-consumer__auth_type@L31.md:bugs_limitations_corner_cases.[0]` (severity HIGH)
    - `odd-platform__java__LoginFormSecurityConfiguration__config-key-consumer__auth_type@L31.md:security.known_security_gaps.[0]` (severity HIGH — "Confirms REFACTOR-073 batch B finding")
  - **Statement**: `LoginFormSecurityConfiguration.java:55-57` configures only `.authorizeExchange(spec -> spec.pathMatchers(permittedPaths).permitAll().pathMatchers("/**").authenticated())` — it does NOT call `new AuthorizationCustomizer(permissionService, extractors)` the way `OAuthSecurityConfiguration.java:98` and `LDAPSecurityConfiguration.java:145` do. The `AuthorizationCustomizer` walks `SecurityConstants.SECURITY_RULES` and applies per-Policy/Permission/Role/Owner managers via `ReactiveAuthorizationManagerFactory.manager(...)`. By skipping it in LOGIN_FORM, every form-authenticated user can call every endpoint — including admin-only endpoints — regardless of any Policy/Permission/Role configured via the platform UI. The live Authorization documentation (WebFetched 2026-05-12) does not warn about this. **This is a documentation-vs-reality divergence with high blast radius** for any operator running LOGIN_FORM in production. This is the **direct file:line evidence** for batch-B's REFACTOR-072 (which surfaced the gap from the AuthorizationManagerCondition sidecar's perspective).
  - **Evidence**: `LoginFormSecurityConfiguration.java:53-66` + `OAuthSecurityConfiguration.java:98` + `LDAPSecurityConfiguration.java:145` + `AuthorizationCustomizer.java:14-32` + WebFetch of `/enable-security/authorization` (2026-05-12)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) prescribes that every mode wires `AuthorizationCustomizer`. LOGIN_FORM is the violation. ADR-CANDIDATE-031 (LOGIN_FORM dev/demo) frames LOGIN_FORM as dev-only but the absence of programmatic guardrails against production use is the gap. ADR-CANDIDATE-036 (mode-agnostic authorization) explicitly identifies LOGIN_FORM as the exception.
  - **Proposed remedy**: Either (a) wire `AuthorizationCustomizer` in LOGIN_FORM mode (a one-line change at `LoginFormSecurityConfiguration.java:55-57`) — accepting that LOGIN_FORM's ADMIN-for-all means every user gets ADMIN role and the Policies still apply with that role; or (b) add a fail-fast at boot when `auth.type=LOGIN_FORM` and `spring.profiles.active` includes "prod"/"production" — the dev-only positioning is enforced programmatically; or (c) deprecate LOGIN_FORM entirely in favour of OAUTH2/LDAP for any deployment claiming authorization. Maintainer triage.
  - **Severity rationale**: HIGH — privilege boundary leak under LOGIN_FORM mode. The dev/demo positioning (ADR-CANDIDATE-031) is doc-only; the code permits production deployment with no programmatic guardrail.

**Discriminating context**: `LoginFormSecurityConfiguration.java:55-57` configures only `.authorizeExchange(spec -> spec.pathMatchers(permittedPaths).permitAll().pathMatchers("/**").authenticated())` — it does NOT call `new AuthorizationCustomizer(permissionService, extractors)` the way `OAuthSecurityConfiguration.java:98` and `LDAPSecurityConfiguration.java:145` do. The `AuthorizationCustomizer` walks `SecurityConstants.SECURITY_RULES` and applies per-Policy/Permission/Role/Owner managers via `ReactiveAuthorizationManagerFactory.manager(...)`. By skipping it in LOGIN_FORM, every form-authenticated user can call every…

**Full detail**: `detail/REFACTOR-099.md`

---

## REFACTOR-108 — S2S+OAUTH2 (and S2S+LOGIN_FORM, S2S+LDAP) — X-API-Key request grants `ADMIN` across the ENTIRE `/**` surface, not just `/ingestion/**`. The composition stance is intent-anchored (ADR-CANDIDATE-032), but the blast radius is not surfaced on the live S2S docs page

**Severity**: HIGH
**Category**: missing-auth (or doc-code-drift)
**Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:bugs_limitations_corner_cases.[5]` (severity HIGH — "Combined with `IngestionDataEntitiesFilter` ... an operator who sets `auth.s2s.enabled=true` AND `auth.ingestion.filter.enabled=true` is exposing TWO distinct API-key authentication surfaces with different scopes")
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:security.known_security_gaps.[0]` (severity HIGH)
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:bugs_limitations_corner_cases.[6]` (severity MEDIUM — same finding, LDAP perspective)
  - **Statement**: When `auth.s2s.enabled=true` AND `auth.type=OAUTH2` (or LOGIN_FORM or LDAP), `S2sAuthenticationFilter` is added at `SecurityWebFiltersOrder.HTTP_BASIC` BEFORE the interactive-mode authentication runs. The S2S filter (`S2sAuthenticationFilter.java:31-39`) checks `X-API-Key` on every request; on match, it injects `User.withUsername("ADMIN").roles("ADMIN")` into the security context — meaning the request is processed as `ADMIN` for the ENTIRE request lifecycle, including all `/api/**` UI endpoints, not just `/ingestion/**`. The live `/enable-security/authentication/s2s` page acknowledges "they can call any endpoint that admins can call" but does not explicitly surface that this includes the entire UI/data surface (an operator reading "S2S for server-to-server clients" may assume `/ingestion/**` scoping). The composition is deliberate (ADR-CANDIDATE-032) but the blast radius is the un-defended consequence.
  - **Evidence**: `OAuthSecurityConfiguration.java:108-110` + `LDAPSecurityConfiguration.java:149-151` + `LoginFormSecurityConfiguration.java:61-63` + `S2sAuthenticationFilter.java:31-39` + WebFetch S2S docs 2026-05-12
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-032 (NEW 2026-05-12C — S2S composes-not-mutex) codifies the composition stance and the broad scope as deliberate; this scope is the doc-blast-radius gap the ADR's design does NOT defend at the doc layer.
  - **Proposed remedy**: Either (a) add an admonition to the live S2S docs page explicitly stating "S2S X-API-Key requests are processed as ADMIN across the entire `/**` surface, not just `/ingestion/**`. Use a network-layer gateway to scope S2S to ingestion paths if you do not want it to grant UI access"; or (b) add path-scoped S2S keys (a structural change against ADR-CANDIDATE-032 — surface for maintainer decision). The doc fix is the minimum.
  - **Severity rationale**: HIGH — operators following the live S2S docs (which name "server-to-server" without scoping clarification) deploy with a broader S2S blast radius than they expect.

**Discriminating context**: When `auth.s2s.enabled=true` AND `auth.type=OAUTH2` (or LOGIN_FORM or LDAP), `S2sAuthenticationFilter` is added at `SecurityWebFiltersOrder.HTTP_BASIC` BEFORE the interactive-mode authentication runs. The S2S filter (`S2sAuthenticationFilter.java:31-39`) checks `X-API-Key` on every request; on match, it injects `User.withUsername("ADMIN").roles("ADMIN")` into the security context — meaning the request is processed as `ADMIN` for the ENTIRE request lifecycle, including all `/api/**` UI endpoints, not just `/ingestion/**`. The live `/enable-security/authentication/s2s` page acknowledges "they…

**Full detail**: `detail/REFACTOR-108.md`

---

## REFACTOR-113 — Okta + Keycloak operators (per live OAuth2/OIDC docs) authenticate via generic OIDC but receive NO provider-specific user enrichment (no admin-group claim mapping) AND no provider-specific logout — `auth/handler/impl/` contains only `GoogleUserHandler` and `GithubUserHandler`; `auth/logout/` contains Cognito + Google + GitHub + Azure + ODD_IAM handlers; no Okta or Keycloak implementations. Operators relying on Okta admin-group claims silently see USER assignment due to ADR-CANDIDATE-035's fail-closed mapper

**Severity**: HIGH
**Category**: doc-code-drift
**Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:bugs_limitations_corner_cases.[4]` (severity HIGH)
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:security.known_security_gaps.[3]` (severity HIGH)
  - **Statement**: The `Provider` enum (`Provider.java:3-5`) lists `COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE` — 5 values. The live OAuth2/OIDC docs document Okta + Keycloak + "Custom OIDC providers" as supported. Operators following the docs configure `auth.oauth2.client.okta.*` properties; the OAuth2 client registration loop (line 161-178) accepts any provider name and forwards it to OAuthUserHandler.shouldHandle(provider) — but no `OktaUserHandler` exists, so the default OIDC path is used. ADR-CANDIDATE-035 (fail-closed `GrantedAuthoritiesMapper`) means Okta-supplied admin-group claims silently map to `USER` because none of them match the `UserProviderRole` enum. Operators relying on Okta admin-group propagation get no admin assignment without writing a custom OktaUserHandler. The live docs do not surface this gap.
  - **Evidence**: `Provider.java:3-5` + `WebFetch /oauth2-oidc 2026-05-12` + `Bash find <odd-platform-repo> -path '*handler/impl*' -name '*.java'` (Google + Github only) + `Bash find <odd-platform-repo> -path '*auth/logout*' -name '*LogoutSuccessHandler.java'` (5 named, no Okta / Keycloak)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-034 (OAuth provider-quirks strategy pattern) describes the chain-of-responsibility — the gap is that the strategy chain has no Okta/Keycloak implementations. ADR-CANDIDATE-035 (fail-closed mapper) amplifies the consequence — without a provider-specific handler, Okta admin-group claims silently drop to USER.
  - **Proposed remedy**: Either (a) add `OktaUserHandler` + `KeycloakUserHandler` impls that map provider-specific group claims to `UserProviderRole.ADMIN`; or (b) document the limitation on the live OAuth2/OIDC page — Okta + Keycloak operators must write their own UserHandler if they want admin-group mapping. Doc-only fix is acceptable IF the live docs explicitly say so.
  - **Severity rationale**: HIGH — operators following Okta + Keycloak docs deploy with broken admin-group mapping; the symptom (no admin users) is operator-debugging-hostile.

**Discriminating context**: The `Provider` enum (`Provider.java:3-5`) lists `COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE` — 5 values. The live OAuth2/OIDC docs document Okta + Keycloak + "Custom OIDC providers" as supported. Operators following the docs configure `auth.oauth2.client.okta.*` properties; the OAuth2 client registration loop (line 161-178) accepts any provider name and forwards it to OAuthUserHandler.shouldHandle(provider) — but no `OktaUserHandler` exists, so the default OIDC path is used. ADR-CANDIDATE-035 (fail-closed `GrantedAuthoritiesMapper`) means Okta-supplied admin-group claims silently map to `USER`…

**Full detail**: `detail/REFACTOR-113.md`

---

## REFACTOR-117 — `auth.ldap.password` (the LDAP bind password) leaks via `/actuator/env` by default — `ODDLDAPProperties.password` is a plain `String` field bound via `@ConfigurationProperties + @Data`; `application.yml:226-240` enables the `env` actuator endpoint; `SecurityConstants.WHITELIST_PATHS` permitAll-s `/actuator/**` so the endpoint is reachable to every caller without auth

**Severity**: HIGH
**Category**: credential-leak
**Surfaced by**:
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:bugs_limitations_corner_cases.[1]` (severity HIGH)
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:security.known_security_gaps.[0]` (severity HIGH)
  - **Statement**: `ODDLDAPProperties.java:14` declares `private String password;` bound from `auth.ldap.password`. The shipped `application.yml:226-240` configures `management.endpoints.web.exposure.include: health,prometheus,env,info` and `management.endpoint.env.enabled: true`. Spring's default sanitisation masks `password`-by-name in the `env` response, but `SecurityConstants.WHITELIST_PATHS:95-96` permitAll-s `/actuator/**`, so the entire env endpoint is reachable WITHOUT authentication. On a network-reachable platform (the default port for the application is the same as for management endpoints), `/actuator/env` discloses the resolved configuration shape including the `auth.ldap.password` property's existence (even if value-masked, the property name + structure is intelligence). For operators relying on Spring's default masking, this is partially mitigated; for operators who customise the sanitisation list, the password value itself can leak.
  - **Evidence**: `ODDLDAPProperties.java:9,14` + `application.yml:226-240` + `SecurityConstants.java:95-96` (`WHITELIST_PATHS = {"/actuator/**", ...}`) + `AuthorizationCustomizer.java:22-24` (`pathMatchers(WHITELIST_PATHS).permitAll()`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-036 (LDAP mode-agnostic authorization) wires `AuthorizationCustomizer` which uses `WHITELIST_PATHS`. The ADR does NOT defend the actuator exposure — the gap is the cross-cutting actuator-on-app-port + permitAll combination.
  - **Proposed remedy**: Either (a) restrict the env actuator endpoint via `management.endpoint.env.enabled: false` in the shipped `application.yml` (operators who want it can opt in); or (b) move actuator endpoints to a separate management port via `management.server.port: 8081` and document the operator's responsibility to NOT expose that port; or (c) remove `/actuator/**` from `SecurityConstants.WHITELIST_PATHS` and gate the actuator behind the application-level auth chain (under DISABLED this still permits all, but under LOGIN_FORM/OAUTH2/LDAP the operator must authenticate). Recommended: (a) + (c). Combine with REFACTOR-103 (LOGIN_FORM credentials leak via same mechanism).
  - **Severity rationale**: HIGH — credential leak via standard actuator endpoint, reachable without authentication on the default port.

**Discriminating context**: `ODDLDAPProperties.java:14` declares `private String password;` bound from `auth.ldap.password`. The shipped `application.yml:226-240` configures `management.endpoints.web.exposure.include: health,prometheus,env,info` and `management.endpoint.env.enabled: true`. Spring's default sanitisation masks `password`-by-name in the `env` response, but `SecurityConstants.WHITELIST_PATHS:95-96` permitAll-s `/actuator/**`, so the entire env endpoint is reachable WITHOUT authentication. On a network-reachable platform (the default port for the application is the same as for management endpoints),…

**Full detail**: `detail/REFACTOR-117.md`

---

## REFACTOR-118 — No scheme enforcement on `auth.ldap.url` — `ldap://` URLs accept plaintext binds; LDAP bind password AND end-user login credentials travel in cleartext across the wire. No boot-time warning, no validation rejection, no doc warning on the live LDAP setup page

**Severity**: HIGH
**Category**: scheme-enforcement
**Surfaced by**:
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:bugs_limitations_corner_cases.[2]` (severity HIGH)
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:security.known_security_gaps.[1]` (severity HIGH — "aligns with LSN-002 (MinIO region unset) and LSN-001 (attachment ephemeral default) — silent insecure defaults that the docs do not surface as caveats")
  - **Statement**: `LdapContextSource.setUrl(properties.getUrl())` at `LDAPSecurityConfiguration.java:119` accepts the URL verbatim. The example given on the live docs page (WebFetched 2026-05-12) is `ldap://corp-ad.example.com:389` — plaintext-bind. An operator following the docs verbatim gets a deployment where every LDAP authentication round-trip (the bind password supplied at `auth.ldap.password` AND every end-user login attempt) travels unencrypted across the network. `ODDLDAPProperties.validate()` (lines 42-49) checks `url` is non-empty but NOT that scheme is `ldaps://`. No boot-time warning is emitted, no log line surfaces the cleartext risk. The defect aligns with the LSN-001/LSN-002 case-law class — silent insecure defaults that the docs do not flag.
  - **Evidence**: `LDAPSecurityConfiguration.java:117-124` + `ODDLDAPProperties.java:42-49` + WebFetch live LDAP docs 2026-05-12
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-036 (LDAP mode-agnostic authorization) does not address transport security. The gap has no defending rationale.
  - **Proposed remedy**: Add scheme validation in `ODDLDAPProperties.validate()`: if `url` starts with `ldap://`, log a WARN-level message and require an explicit `auth.ldap.allow-plaintext: true` to proceed (default false). Update the live LDAP setup page to use `ldaps://corp-ad.example.com:636` as the canonical example, with the plaintext alternative explicitly flagged as dev-only. Add a retrospective LSN-NNN entry — the failure mode is identical to LSN-001/002.
  - **Severity rationale**: HIGH — cleartext credentials over operator-network; LSN-001/002-class silent insecure default.

**Discriminating context**: `LdapContextSource.setUrl(properties.getUrl())` at `LDAPSecurityConfiguration.java:119` accepts the URL verbatim. The example given on the live docs page (WebFetched 2026-05-12) is `ldap://corp-ad.example.com:389` — plaintext-bind. An operator following the docs verbatim gets a deployment where every LDAP authentication round-trip (the bind password supplied at `auth.ldap.password` AND every end-user login attempt) travels unencrypted across the network. `ODDLDAPProperties.validate()` (lines 42-49) checks `url` is non-empty but NOT that scheme is `ldaps://`. No boot-time warning is emitted,…

**Full detail**: `detail/REFACTOR-118.md`

---

## REFACTOR-119 — `containsIgnoreCase` substring-match on `admin-groups` admits substring-collision admin escalation — an operator configuring `admin-groups: ['ops']` may inadvertently grant ADMIN to every LDAP group whose name contains 'ops' (substring `devops`, `noops`, `oopsgroup`)

**Severity**: HIGH
**Category**: substring-collision
**Surfaced by**:
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:bugs_limitations_corner_cases.[5]` (severity HIGH)
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:security.known_security_gaps.[2]` (severity HIGH)
  - **Statement**: `LDAPSecurityConfiguration.java:94-98` decides admin-group membership via `adminGroups.stream().anyMatch(adminGroup -> containsIgnoreCase(authority.getAuthority(), adminGroup))`. The `containsIgnoreCase` import (line 48, from `OperationUtils`) is a SUBSTRING match, not EQUALITY. An admin-groups config of `['Admin']` matches `cn=Administrators` AND `cn=NonAdminContractors` (because both contain 'Admin' as a substring). The maintainer's choice is deliberate-and-ergonomic (ADR-CANDIDATE-038 captures the ergonomic short-form intent) but the collision consequence has no defending rationale and is operator-trap-shaped. The live LDAP setup page says `admin-groups: A list granting admin permissions` without warning about substring collisions.
  - **Evidence**: `LDAPSecurityConfiguration.java:94-98` + import line 48 (`containsIgnoreCase`) + WebFetch live LDAP docs 2026-05-12
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-038 (NEW 2026-05-12C — LDAP `containsIgnoreCase` ergonomic) captures the intent for short-form admin-group names; the ADR does NOT defend the substring-collision consequence. The wisdom-test split: ergonomic intent → ADR; substring-collision → this scope.
  - **Proposed remedy**: Either (a) switch to `Set::contains` with case-insensitive comparator (equality, not substring); operators with short-form configs must update to full DNs — breaking change; OR (b) keep substring match but warn at boot-time when the admin-groups allowlist is short enough to be collision-prone (e.g., any entry < 4 chars) — backwards-compatible; OR (c) add a doc warning on the live LDAP setup page with a concrete bad-config example. Recommended (b) + (c).
  - **Severity rationale**: HIGH — privilege escalation surface. An operator with a 3-char `admin-groups` entry (legitimate short-form) is one substring-collision away from elevating arbitrary users to ADMIN.

**Discriminating context**: `LDAPSecurityConfiguration.java:94-98` decides admin-group membership via `adminGroups.stream().anyMatch(adminGroup -> containsIgnoreCase(authority.getAuthority(), adminGroup))`. The `containsIgnoreCase` import (line 48, from `OperationUtils`) is a SUBSTRING match, not EQUALITY. An admin-groups config of `['Admin']` matches `cn=Administrators` AND `cn=NonAdminContractors` (because both contain 'Admin' as a substring). The maintainer's choice is deliberate-and-ergonomic (ADR-CANDIDATE-038 captures the ergonomic short-form intent) but the collision consequence has no defending rationale and is…

**Full detail**: `detail/REFACTOR-119.md`

---

## REFACTOR-127 — Notifications fan-out has NO retry, NO dead-letter, NO audit trail on failed delivery — `AlertNotificationMessageProcessor` catches `NotificationSenderException`, logs at ERROR, and moves on. The alert is lost from that channel's perspective; no DB record in the `ALERT` table indicates delivery failed

**Severity**: HIGH
**Category**: no-retry-no-dlq
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:bugs_limitations_corner_cases.[3]` (severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:performance.known_performance_gaps.[0]` (severity HIGH — "Slack will rate-limit the webhook (429), and the platform has no retry-with-backoff on 429")
  - **Statement**: `AlertNotificationMessageProcessor.java:30-35` catches `NotificationSenderException` from each sender's `.send()` call, logs at ERROR with the failing channel's `receiverId()`, and continues to the next sender. No retry-with-backoff, no dead-letter table, no `notification_delivery` table tracking per-alert-per-channel outcomes. Operators have no DB-visible signal that notifications stopped working — only log lines, and only if the operator inspects them. Combined with no rate-limiting (REFACTOR-129), a burst of 10k alerts will fire 10k Slack messages and any 429 rate-limit response from Slack causes silent dropping of subsequent messages with no recovery.
  - **Evidence**: `AlertNotificationMessageProcessor.java:25-36` + `AbstractNotificationSender.java:24-27` (status code check is `== HttpStatus.OK.value()`; non-200 logs failure but does NOT trigger retry)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-042 (NEW 2026-05-12C — fail-soft fan-out) codifies the per-channel try/catch-log-continue as deliberate; the ADR DOES defend "one bad channel doesn't block others" but DOES NOT defend the absence of retry / DLQ / audit. The gap is the structural price of the design that the ADR codifies as the maintainer's trade-off — operators must close this gap to make Notifications production-grade.
  - **Proposed remedy**: Add three coordinated changes: (a) introduce a `notification_delivery` table tracking `(alert_id, channel_id, attempt_at, status, error)`; insert a row per attempt; (b) add retry-with-backoff on `NotificationSenderException` (configurable max-attempts + min-backoff via `notifications.retry.*` keys); (c) add Micrometer metrics `notification.delivery.success_total{channel}` + `notification.delivery.failure_total{channel}` for observability. Keep the fail-soft posture (continue to next channel) but make the failures observable.
  - **Severity rationale**: HIGH — operability gap; operators relying on notifications for alerting have no signal when delivery silently degrades.

**Discriminating context**: `AlertNotificationMessageProcessor.java:30-35` catches `NotificationSenderException` from each sender's `.send()` call, logs at ERROR with the failing channel's `receiverId()`, and continues to the next sender. No retry-with-backoff, no dead-letter table, no `notification_delivery` table tracking per-alert-per-channel outcomes. Operators have no DB-visible signal that notifications stopped working — only log lines, and only if the operator inspects them. Combined with no rate-limiting (REFACTOR-129), a burst of 10k alerts will fire 10k Slack messages and any 429 rate-limit response from Slack…

**Full detail**: `detail/REFACTOR-127.md`

---

## REFACTOR-128 — Email per-recipient silent partial delivery — `EmailNotificationSender` iterates `notificationsEmails` in order reusing the SAME `MimeMessage`; any thrown `MessagingException` aborts the loop. Recipients after the failing one never receive the alert. No per-recipient try/catch

**Severity**: HIGH
**Category**: partial-delivery
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:bugs_limitations_corner_cases.[4]` (severity HIGH)
  - **Statement**: `EmailNotificationSender.java:53-61` runs `for (final String notificationsEmail : notificationsEmails) { helper.setTo(notificationsEmail); emailSender.send(mimeMessage); }`. Any thrown `MessagingException` propagates up to `AlertNotificationMessageProcessor`'s outer catch — recipients after the failing one never receive the alert. The live doc page documents this as a "known limitation". Even so, the code has no fault-tolerance (no per-recipient try/catch, no continue-on-error). Combined with the shared `MimeMessage` instance across recipients (a memory-saving optimisation that complicates error recovery), the partial-delivery hazard is unresolved.
  - **Evidence**: `EmailNotificationSender.java:53-61`
  - **Existing-ADR-or-implied-prescription**: None defends the absence of per-recipient retry. ADR-CANDIDATE-042 (fail-soft fan-out) is at the CHANNEL level (one Slack failure doesn't block email); this scope is intra-channel (one email recipient failure shouldn't block other recipients on the same channel).
  - **Proposed remedy**: Wrap the per-recipient `emailSender.send(...)` in its own try/catch; on `MessagingException`, log at ERROR with recipient identification and continue the loop. Optional: track per-recipient delivery in the `notification_delivery` table (REFACTOR-127).
  - **Severity rationale**: HIGH — operability gap; email-list members downstream of a failing recipient silently miss alerts.

**Discriminating context**: `EmailNotificationSender.java:53-61` runs `for (final String notificationsEmail : notificationsEmails) { helper.setTo(notificationsEmail); emailSender.send(mimeMessage); }`. Any thrown `MessagingException` propagates up to `AlertNotificationMessageProcessor`'s outer catch — recipients after the failing one never receive the alert. The live doc page documents this as a "known limitation". Even so, the code has no fault-tolerance (no per-recipient try/catch, no continue-on-error). Combined with the shared `MimeMessage` instance across recipients (a memory-saving optimisation that complicates…

**Full detail**: `detail/REFACTOR-128.md`

---

## REFACTOR-129 — Notifications subsystem has NO rate-limiting / throttling at any layer — WAL streams as fast as Postgres can decode, the processor loop is synchronous, senders block on HTTP. A burst of 10k alerts will fire 10k Slack messages + 10k webhook POSTs + 10k emails with no rate cap. Slack returns 429; webhooks overwhelm receivers; email recipients spammed

**Severity**: HIGH
**Category**: missing-rate-limit
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:bugs_limitations_corner_cases.[10]` (severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:performance.known_performance_gaps.[0]` (severity HIGH)
  - **Statement**: `AlertNotificationMessageProcessor.java:25-36` is synchronous — for each `AlertNotificationMessage`, iterate `List<NotificationSender>` and call `.send()` per sender, blocking on each HTTP/SMTP round-trip. No batching, no token bucket, no per-channel rate-limiting. A misconfigured data-quality run firing 10k alerts will translate 1:1 into 10k outbound deliveries on each configured channel. Slack will rate-limit the incoming webhook (returns 429); webhooks overwhelm their receivers; email recipients get spammed. Combined with no retry (REFACTOR-127), once Slack 429s the alerts AFTER the cap are silently dropped.
  - **Evidence**: `AlertNotificationMessageProcessor.java:25-36` + `AbstractNotificationSender.java:24-27`
  - **Existing-ADR-or-implied-prescription**: None defends the absence of rate-limiting. ADR-CANDIDATE-043 (single-leader WAL consumer) explains the single-thread design but does not address backpressure.
  - **Proposed remedy**: Add three coordinated rate-limit knobs in `NotificationsProperties.WalProperties` (or a new `RateLimitProperties` nested class): (a) `max-alerts-per-minute-per-channel` (default 60); (b) `max-alerts-per-minute-global` (default 600); (c) `burst-cap` (default 30 — token-bucket capacity). Apply via a Bucket4j-based filter in the processor loop. On burst exceeding the cap, defer the alert via Postgres-resident queue (a `notification_queue` table) and continue processing — backpressure should not block the WAL consumer.
  - **Severity rationale**: HIGH — operability gap; burst-of-alerts overwhelms downstream receivers.

**Discriminating context**: `AlertNotificationMessageProcessor.java:25-36` is synchronous — for each `AlertNotificationMessage`, iterate `List<NotificationSender>` and call `.send()` per sender, blocking on each HTTP/SMTP round-trip. No batching, no token bucket, no per-channel rate-limiting. A misconfigured data-quality run firing 10k alerts will translate 1:1 into 10k outbound deliveries on each configured channel. Slack will rate-limit the incoming webhook (returns 429); webhooks overwhelm their receivers; email recipients get spammed. Combined with no retry (REFACTOR-127), once Slack 429s the alerts AFTER the cap…

**Full detail**: `detail/REFACTOR-129.md`

---

## REFACTOR-130 — SMTP infinite timeouts — JavaMail defaults for `mail.smtp.connectiontimeout`, `mail.smtp.timeout` (read), and `mail.smtp.writetimeout` are infinite per JavaMail's documented defaults. A hung SMTP server blocks the subscriber thread INDEFINITELY, stalling ALL notification channels (not just email — the single-thread WAL consumer processes channels sequentially)

**Severity**: HIGH
**Category**: smtp-timeout
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:performance.known_performance_gaps.[2]` (severity HIGH — "a hung SMTP server blocks the subscriber thread forever, stopping ALL notification delivery")
  - **Statement**: `NotificationConfiguration.java:34-68` constructs the JavaMail Properties bag with NO `mail.smtp.connectiontimeout`, NO `mail.smtp.timeout`, NO `mail.smtp.writetimeout`. JavaMail's documented defaults for all three are infinite. Combined with the single-thread WAL consumer (ADR-CANDIDATE-043), a hung SMTP server blocks the `notification-subscriber-thread` INDEFINITELY — no further alerts are processed for ANY channel (Slack, webhook, email) until the JVM restarts. This is the critical path failure mode for the entire Notifications subsystem. The live doc page acknowledges this as a "known limitation" but the code has no defaults.
  - **Evidence**: `NotificationConfiguration.java:34-68` (no SMTP timeout properties) + JavaMail documentation + `NotificationSubscriber.java:39-46` (single-thread consumer)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-043 (single-leader WAL consumer) is the structural design that AMPLIFIES this gap — a single hung thread stalls everything. The gap is the absence of SMTP timeouts; the ADR codifies the design choice that makes the absence critical.
  - **Proposed remedy**: Set SMTP timeouts in `NotificationConfiguration.smtpProperties()`: `mail.smtp.connectiontimeout: 10000` (10s), `mail.smtp.timeout: 30000` (30s read), `mail.smtp.writetimeout: 30000` (30s write). Expose as `notifications.receivers.email.smtp.timeout.*` for operator tuning. Optional: add a circuit-breaker that disables the email sender for N minutes after consecutive timeouts.
  - **Severity rationale**: HIGH — single-thread WAL consumer blocking indefinitely on SMTP timeout = ALL notification delivery stalls. Critical-path failure.

**Discriminating context**: `NotificationConfiguration.java:34-68` constructs the JavaMail Properties bag with NO `mail.smtp.connectiontimeout`, NO `mail.smtp.timeout`, NO `mail.smtp.writetimeout`. JavaMail's documented defaults for all three are infinite. Combined with the single-thread WAL consumer (ADR-CANDIDATE-043), a hung SMTP server blocks the `notification-subscriber-thread` INDEFINITELY — no further alerts are processed for ANY channel (Slack, webhook, email) until the JVM restarts. This is the critical path failure mode for the entire Notifications subsystem. The live doc page acknowledges this as a "known…

**Full detail**: `detail/REFACTOR-130.md`

---

## REFACTOR-141 — Housekeeping TTL defaults are Java-side `private int X;` primitives with NO Java initialiser; the safety floor (30/30/30 days) lives ONLY in the shipped `application.yml`. A deployment that overrides `application.yml` (via `--spring.config.location=` or Spring Cloud Config) WITHOUT re-supplying `housekeeping.ttl.*` binds `0` to all three fields. The next housekeeping cycle (~15 minutes after boot) hard-DELETES all RESOLVED alerts + all search facets + all soft-deleted entities — LSN-001 silent-default-produces-data-loss shape

**Severity**: HIGH
**Category**: primitive-default-leak
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[2]` (HIGH — "LSN-001 shape silent-data-loss-on-default — exact same failure class as attachment.storage.mode default")
  - **Statement**: `HousekeepingTTLProperties.java:9-11` declares three `private int resolvedAlertsDays;` / `private int searchFacetsDays;` / `private int dataEntityDeleteDays;` fields with no `= 30` initialiser. The 30/30/30 default floor lives ONLY at `application.yml:168-170`. A deployment that mounts a different config file without re-supplying the `housekeeping.ttl` block binds `0` for all three. The next housekeeping cycle would: (a) DELETE all RESOLVED + RESOLVED_AUTOMATICALLY alerts whose status-update is `<= now()` — i.e. ALL resolved alerts; (b) DELETE all search-facets with `LAST_ACCESSED_AT <= now()`; (c) DELETE all data-entities in DELETED status — cascading through ~25 child tables. The opt-out posture of ADR-CANDIDATE-046 (housekeeping ships ON) makes this consequence sharper — operators inherit data-deleting behaviour by default + the YAML floor is the only safety. Promoting the defaults into the Java declaration (`private int resolvedAlertsDays = 30;`) closes this gap.
  - **Evidence**: `HousekeepingTTLProperties.java:9` (`private int resolvedAlertsDays;` — no `= 30`), `:10`, `:11` + `application.yml:168-170` (the `30` floor) + `AlertHousekeepingJob.java:24-46` + `SearchFacetsHousekeepingJob.java:19-30` + `DataEntityHousekeepingJob.java:68-128` (consumer paths confirming the cascade)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-046 (housekeeping opt-out by shipped default) does NOT defend the absence of Java-side initialisers — the opt-out stance assumes the YAML floor is present; this gap is the price paid when the assumption fails. ADR-CANDIDATE-048 (narrow-validator scope) does NOT defend the absence either — a validator could check `resolvedAlertsDays > 0` and reject 0 at boot.
  - **Proposed remedy**: Add Java initialisers: `private int resolvedAlertsDays = 30;` + `private int searchFacetsDays = 30;` + `private int dataEntityDeleteDays = 30;`. Alternative: add `@Min(1)` (via `@Validated` on the class) so 0 is rejected at boot with a clear error message. Both fixes preserve the YAML-floor as the operator-visible default while closing the override-bug.
  - **Severity rationale**: HIGH — LSN-001 shape silent-data-loss-on-default; identical failure class to attachment.storage.mode default. Combined with ADR-CANDIDATE-046 (housekeeping ships ON) and the no-dry-run gap (REFACTOR-146), the blast radius is production-class.

**Discriminating context**: `HousekeepingTTLProperties.java:9-11` declares three `private int resolvedAlertsDays;` / `private int searchFacetsDays;` / `private int dataEntityDeleteDays;` fields with no `= 30` initialiser. The 30/30/30 default floor lives ONLY at `application.yml:168-170`. A deployment that mounts a different config file without re-supplying the `housekeeping.ttl` block binds `0` for all three. The next housekeeping cycle would: (a) DELETE all RESOLVED + RESOLVED_AUTOMATICALLY alerts whose status-update is `<= now()` — i.e. ALL resolved alerts; (b) DELETE all search-facets with `LAST_ACCESSED_AT <=…

**Full detail**: `detail/REFACTOR-141.md`

---

## REFACTOR-142 — `AlertHousekeepingJob` jOOQ operator-precedence bug — the predicate chain `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` produces `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND cutoff)`, NOT the intended `(STATUS=RESOLVED OR RESOLVED_AUTOMATICALLY) AND cutoff`. Manual RESOLVED rows are hard-deleted on the very next 15-minute cycle. The live doc acknowledges this as "a known platform bug" but the code has no `// TODO`, no GitHub-issue link, and no test

**Severity**: HIGH
**Category**: jooq-precedence-bug
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[3]` (HIGH — "silent data loss for manual alert resolutions — a user marking an alert RESOLVED loses it on the next housekeeping cycle, with 30-day retention promised in docs but bypassed in code")
  - **Statement**: `AlertHousekeepingJob.java:28-34` writes a fluent-builder predicate chain that exploits jOOQ's left-to-right binding: `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's `.and(...)` binds to the most recent `.or(...)`, producing the SQL predicate `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= cutoff)`. The TTL therefore applies ONLY to RESOLVED_AUTOMATICALLY rows; manual RESOLVED rows match the first disjunct and are hard-deleted IMMEDIATELY on the very next 15-minute cycle. The live `/configuration-and-deployment/odd-platform` docs page acknowledges the bug ("a known platform bug currently exempts manual resolutions from the retention check") — but there is no test asserting the predicate's behaviour, no `// TODO` in the source, and no GitHub issue linked.
  - **Evidence**: `AlertHousekeepingJob.java:28-34` (the predicate chain) + WebFetch `/configuration-and-deployment/odd-platform` 2026-05-12 (the docs acknowledgement) + grep for `// TODO` / `// FIXME` / GitHub-issue-URL in the file returning zero matches
  - **Existing-ADR-or-implied-prescription**: None — the bug contradicts the documented 30-day retention promise. There is no ADR defending "manual resolutions should not be retained".
  - **Proposed remedy**: Parenthesise the OR-group: `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))` — group the OR before AND-ing the cutoff. Add a jOOQ-tested predicate-verification test that asserts the generated SQL contains exactly `((status = 'RESOLVED') OR (status = 'RESOLVED_AUTOMATICALLY')) AND (status_updated_at <= ?)`. Add an `@SqlQueryTest` or equivalent.
  - **Severity rationale**: HIGH — silent data loss for every manually-resolved alert with the 30-day retention contract from docs broken in code. Operators consulting the docs assume retention; the code violates it.

**Discriminating context**: `AlertHousekeepingJob.java:28-34` writes a fluent-builder predicate chain that exploits jOOQ's left-to-right binding: `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's `.and(...)` binds to the most recent `.or(...)`, producing the SQL predicate `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= cutoff)`. The TTL therefore applies ONLY to RESOLVED_AUTOMATICALLY rows; manual RESOLVED rows match the first disjunct and are hard-deleted IMMEDIATELY on the very next 15-minute cycle. The live…

**Full detail**: `detail/REFACTOR-142.md`

---

## REFACTOR-155 — Azure `logoutUri` is required per the live OAuth2 docs (`'unset value raises a NullPointerException and the logout flow returns a 500 response'`) but NOT validated at `@PostConstruct`. The validator at `ODDOAuth2Properties.java:16-28` checks ONLY `clientId` + `provider` non-empty. `AzureLogoutSuccessHandler.java:39` calls `URI.create(provider.getLogoutUri())` with no null guard — `URI.create(null)` throws `NullPointerException` per the JDK contract. An Azure operator following the docs but omitting `logout-uri` boots successfully and hits the NPE at first logout. The Cognito handler has the matching `isEmpty` guard; Azure does not

**Severity**: HIGH
**Category**: provider-conditional-unvalidated
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:bugs_limitations_corner_cases.[0]` (HIGH)
  - **Statement**: The OAuth2 narrow-validator (ADR-CANDIDATE-048) intentionally limits boot-time checks to fields Spring needs for bean construction (clientId + provider). Provider-conditional required fields like Azure `logoutUri` are deferred to runtime usage-sites. For Azure, the usage site is `AzureLogoutSuccessHandler.java:39`'s `URI.create(provider.getLogoutUri())` call — which throws NPE on null. The live docs document `logoutUri` as required for Azure but the validator does not enforce it; operators see the boot succeed and the failure surface only at first logout (potentially weeks after the misconfigured deployment first ships). The Cognito handler has the matching `isEmpty` guard at lines 33-35 — the asymmetry between Cognito (guarded) and Azure (unguarded) is itself a code-quality smell.
  - **Evidence**: `ODDOAuth2Properties.java:16-28` (validator does not check `logoutUri`) + `AzureLogoutSuccessHandler.java:39` (`URI.create(null)` NPE site) + `CognitoLogoutSuccessHandler.java:33-35` (the sibling Cognito guard) + WebFetch `/oauth2-oidc` 2026-05-12 (the docs require Azure logoutUri)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-048 (narrow-validator scope) is the design that produces this gap — the validator's job is structural-config-faults only, not semantic correctness. The maintainer accepted the price (provider-conditional required fields deferred to runtime) as part of the design. This refactor proposes either (a) extend the validator with provider-conditional branches (`if "AZURE".equalsIgnoreCase(provider.getProvider()) && StringUtils.isEmpty(provider.getLogoutUri()) throw new IllegalStateException(...)`), OR (b) add a null-guard at `AzureLogoutSuccessHandler.java:39` that throws a more descriptive error than NPE.
  - **Proposed remedy**: Add a provider-conditional fail-fast branch to `ODDOAuth2Properties.validate()`: when `provider.equalsIgnoreCase("AZURE")` AND `logoutUri` is empty, throw `IllegalStateException("Azure provider requires logout-uri to be set; see live docs.")`. Alternatively, mirror `CognitoLogoutSuccessHandler`'s `isEmpty` guard at line 33-35 in `AzureLogoutSuccessHandler` and surface a 400-with-message-instead-of-500-NPE. The two fixes can coexist for defence-in-depth.
  - **Severity rationale**: HIGH — every Azure-tenant deployment with omitted `logout-uri` produces a 500 at first logout. The blast radius is per-Azure-deployment; the failure is operator-confusing (NPE stack trace pointing to JDK internals).

**Discriminating context**: The OAuth2 narrow-validator (ADR-CANDIDATE-048) intentionally limits boot-time checks to fields Spring needs for bean construction (clientId + provider). Provider-conditional required fields like Azure `logoutUri` are deferred to runtime usage-sites. For Azure, the usage site is `AzureLogoutSuccessHandler.java:39`'s `URI.create(provider.getLogoutUri())` call — which throws NPE on null. The live docs document `logoutUri` as required for Azure but the validator does not enforce it; operators see the boot succeed and the failure surface only at first logout (potentially weeks after the…

**Full detail**: `detail/REFACTOR-155.md`

---

## REFACTOR-156 — `azureTenantId` per the live OAuth2 docs YAML examples (and the commented-out `application.yml:128-156` Azure example) does NOT exist on `OAuth2Provider`. The POJO at `ODDOAuth2Properties.java:30-53` lists 21 fields; `azureTenantId` is absent. Spring's relaxed `@ConfigurationProperties` binder ignores unknown keys by default (no `ignoreUnknownFields=false` is set on the annotation at line 11). So `azure-tenant-id: <id>` in YAML binds nothing — the value remains reachable only through Spring property-placeholder resolution (`${auth.oauth2.client.azure.azure-tenant-id}` inline in URI strings). The docs YAML examples are NOT deployable verbatim to this POJO

**Severity**: HIGH
**Category**: doc-code-drift
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:bugs_limitations_corner_cases.[1]` (HIGH)
  - **Statement**: The live `/oauth2-oidc` docs page (WebFetched 2026-05-12) and the commented-out application.yml Azure example BOTH reference `azure-tenant-id` as a configurable key under `auth.oauth2.client.azure`. The `OAuth2Provider` POJO at `ODDOAuth2Properties.java:30-53` enumerates 21 fields; `azureTenantId` is absent. Spring Boot's relaxed binder (with `@ConfigurationProperties(prefix="auth.oauth2")` at line 11, NO `ignoreUnknownFields=false`) silently accepts the key and binds nothing. Operators following the docs verbatim get a deployment where the Azure tenant ID is reachable ONLY through Spring's `${...}` property-placeholder resolution inline in URI strings (per the application.yml example using `${auth.oauth2.client.azure.azure-tenant-id}` inside `issuer-uri` / `authorization-uri` / `token-uri` etc.). This is operator-confusing — the docs imply a typed POJO field, the reality is a placeholder dependency. STRENGTHENS REFACTOR-115 (ODDOAuth2Properties missing azureTenantId) with full POJO-field enumeration confirming the field is genuinely absent across all 21 declared fields.
  - **Evidence**: `ODDOAuth2Properties.java:30-53` (21-field enumeration of `OAuth2Provider`, no `azureTenantId`) + `application.yml:128-156` (commented-out Azure example referencing `azure-tenant-id`) + WebFetch `/oauth2-oidc` 2026-05-12 (the docs YAML examples)
  - **Existing-ADR-or-implied-prescription**: None — the gap is a doc-vs-code drift. ADR-CANDIDATE-047 (Map-keyed schema) defends the extensibility but does not address per-provider doc-vs-POJO key alignment.
  - **Proposed remedy**: Two options: (a) add `private String azureTenantId;` to `OAuth2Provider` POJO so `azure-tenant-id` binds to a first-class field; (b) keep the placeholder pattern but document explicitly that `azureTenantId` is NOT a POJO field — it is a free Environment property consumed inline in URI strings. Option (a) is operator-friendlier (typed validation, IDE autocomplete); option (b) is consistent with the Spring property-placeholder convention. Decision warrants the maintainer's review of which Azure-config pattern to canonicalise.
  - **Severity rationale**: HIGH — doc-vs-code drift on a production-supported provider (Azure). Operators following docs hit silent no-bind and discover the issue only via "why is my Azure tenant ID null in the URI?" debugging.

**Discriminating context**: The live `/oauth2-oidc` docs page (WebFetched 2026-05-12) and the commented-out application.yml Azure example BOTH reference `azure-tenant-id` as a configurable key under `auth.oauth2.client.azure`. The `OAuth2Provider` POJO at `ODDOAuth2Properties.java:30-53` enumerates 21 fields; `azureTenantId` is absent. Spring Boot's relaxed binder (with `@ConfigurationProperties(prefix="auth.oauth2")` at line 11, NO `ignoreUnknownFields=false`) silently accepts the key and binds nothing. Operators following the docs verbatim get a deployment where the Azure tenant ID is reachable ONLY through Spring's…

**Full detail**: `detail/REFACTOR-156.md`

---

## REFACTOR-181 — Cross-cutting Lombok `@Data`-generated `toString()` includes sensitive fields verbatim across `@ConfigurationProperties` POJOs — 4-sidecar triangulated. The original `/actuator/env` framing (batches B/C) was INCORRECT — Spring Boot 3.4.10 (the platform's pinned version at `<odd-platform-repo>/odd-platform-api/build.gradle:2`) defaults `management.endpoint.env.show-values: NEVER` which sanitises `*password*` / `*secret*` patterns. The actuator surface IS protected by default. The REAL gap is the in-process `toString()` path: any future `log.info("properties={}", properties)` accident leaks secrets verbatim

**Severity**: HIGH
**Category**: lombok-tostring-leak
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:bugs_limitations_corner_cases.[3]` + `security.known_security_gaps.[0]` (MEDIUM — `clientSecret` not `@ToString.Exclude`'d)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDLDAPProperties.md:bugs_limitations_corner_cases.[0]` + `security.known_security_gaps.[0]` (HIGH — `password` not `@ToString.Exclude`'d + the REFINEMENT verifying Spring Boot 3.4.10 default sanitisation IS in place)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[3]` + `security.known_security_gaps.[0]` (MEDIUM — `password` not `@ToString.Exclude`'d)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md` (cross-referenced from batch C — Notifications-side @Data toString surfaces; partial-home shape where some sensitive fields are on this POJO and some are inline `@Value`-bound)
  - **Statement**: Four `@ConfigurationProperties` POJOs in the codebase declare sensitive fields (clientSecret, password, email-password, LDAP-password) as plain `String` with Lombok `@Data` at the class level, with NO `@ToString.Exclude` or `@JsonIgnore` annotation. Lombok's `@Data` generates `toString()` that includes ALL fields. Spring Boot 3.4.10's `/actuator/env` endpoint masks `*password*` / `*secret*` by default (`management.endpoint.env.show-values: NEVER`, verified via WebFetch + the platform's pinned Spring Boot version at `<odd-platform-repo>/odd-platform-api/build.gradle:2`) — so the actuator surface IS protected. The REAL gap is the in-process `toString()` path: a future `log.info("properties={}", properties)` accident, an info-contributor, a Spring `EnvironmentEndpoint` text rendering of a bound bean object, or a debugger inspection dumped to log all expose the password verbatim. The REFINEMENT is significant — the original REFACTOR-117 (batches B/C) framed this as an actuator-side gap; operators reading that scope might have assumed actuator config was the fix. The actual fix is `@ToString.Exclude` discipline on every sensitive field across every `@ConfigurationProperties` POJO.
  - **Evidence**: `ODDOAuth2Properties.java:30-34` (no `@ToString.Exclude` on `clientSecret`) + `ODDLDAPProperties.java:10,14` (no `@ToString.Exclude` on `password`) + `EmailSenderProperties.java:6-10` (no `@ToString.Exclude` on `password`) + `<odd-platform-repo>/odd-platform-api/build.gradle:2` (Spring Boot 3.4.10) + Spring Boot 3.4.10 documented `management.endpoint.env.show-values: NEVER` default + grep `keys-to-sanitize` returns zero hits in repo (no platform-side override of Spring's default sanitiser registry — both confirming Spring's defaults are the only protection AND that the platform has not added defence-in-depth)
  - **Existing-ADR-or-implied-prescription**: None — the absence of `@ToString.Exclude` has no defending rationale. The maintainer's signal is consistent across all four POJOs: secrets are bound but not explicitly masked at the field level. ADR-CANDIDATE-018 (fail-fast at boot) and ADR-CANDIDATE-048 (narrow-validator) both rely on these POJOs but don't address the secret-exposure surface.
  - **Proposed remedy**: Add `@ToString.Exclude` to every sensitive field across all `@ConfigurationProperties` POJOs: `ODDOAuth2Properties.OAuth2Provider.clientSecret` (line 34), `ODDLDAPProperties.password` (line 14), `EmailSenderProperties.password` (line 7), `NotificationsProperties.receivers.slack.oauthToken` (if present), and any future credential-shaped fields. Optionally, add `@JsonIgnore` for serialisation safety. Document the pattern as part of the project's `@ConfigurationProperties` authoring discipline (a cornerstone the maintainer adds to `pillars/code-quality/` when that pillar activates).
  - **Severity rationale**: HIGH — cross-cutting secret-exposure surface across four critical config POJOs. The actuator-default mitigation is defensive-only; in-process logging is the real gap. A single misplaced `log.info("config={}", props)` PR-comment leaks production credentials.

**Discriminating context**: Four `@ConfigurationProperties` POJOs in the codebase declare sensitive fields (clientSecret, password, email-password, LDAP-password) as plain `String` with Lombok `@Data` at the class level, with NO `@ToString.Exclude` or `@JsonIgnore` annotation. Lombok's `@Data` generates `toString()` that includes ALL fields. Spring Boot 3.4.10's `/actuator/env` endpoint masks `*password*` / `*secret*` by default (`management.endpoint.env.show-values: NEVER`, verified via WebFetch + the platform's pinned Spring Boot version at `<odd-platform-repo>/odd-platform-api/build.gradle:2`) — so the actuator…

**Full detail**: `detail/REFACTOR-181.md`

---

## REFACTOR-185 — DISABLED-mode bypasses every SECURITY_RULES entry including the centerpiece data-entity write paths and the read-side discovery surface — 11-sidecar triangulated

**Severity**: HIGH
**Category**: missing-auth (cross-cutting)

**Discriminating context**: When `auth.type=DISABLED` (the shipped YAML default at `application.yml:32-34`), `DisabledAuthSecurityConfiguration.java:11-19` registers a `SecurityWebFilterChain` calling `.anyExchange().permitAll()`, completely bypassing the `SECURITY_RULES` table and the `AuthorizationCustomizer`. The blast radius now spans the platform's entire surface: (a) the keys-to-the-kingdom RBAC mutations (POLICY_CREATE + ROLE_CREATE + OWNER_CREATE per batch E); (b) the centerpiece data-entity write paths (DATA_ENTITY_OWNERSHIP_CREATE + DATA_ENTITY_STATUS_UPDATE per batch F); (c) the centerpiece read endpoints…

**Full detail**: `detail/REFACTOR-185.md`

---

## REFACTOR-198 — `DataEntityMapperImpl.applyStatus` ordering bug nulls `statusUpdatedAt` on every status transition → `DataEntityHousekeepingJob` 30-day TTL retention is silently broken

**Severity**: HIGH
**Category**: ordering-bug (cross-batch)
**Surfaced by**:
    - `odd-platform__java__DataEntityController__controller-method__updateStatus.md:bugs_limitations_corner_cases.[0]`
    - cross-batch: `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:dependencies_semantic.requires-runtime` (the housekeeping TTL relies on `status_updated_at`)
  - **Statement**: `DataEntityMapperImpl.applyStatus` (at lines 247-249) executes `pojo.setStatus(statusDto.getId())` on line 247 BEFORE the `if (statusDto.getId() != pojo.getStatus())` check on line 249. At the point of the check, `pojo.getStatus()` already equals `statusDto.getId()`, so the condition is always false and `statusUpdatedAt` is NEVER set on any status transition. The `DataEntityHousekeepingJob.java:73-82` TTL query `STATUS_UPDATED_AT.lessOrEqual(now - 30 days)` filters by `status_updated_at`; if that column is NULL for entities that transitioned to DELETED via this code path, the `lessOrEqual` predicate against a NULL column evaluates to NULL (≈ false in SQL three-valued logic) — those entities are NEVER hard-deleted by the housekeeping cycle. The bug is a HIGH-severity correctness break with two structural consequences: (a) the 30-day soft-delete retention window is silently broken — soft-deleted entities accumulate indefinitely in the data_entity table; (b) the maintainer's status-state-machine ADR (ADR-CANDIDATE-058) is undermined at the implementation layer — the architectural commitment is sound but the code violates it.
  - **Evidence**: `DataEntityMapperImpl.java:242-253` (the ordering inversion: `setStatus(...)` on line 247 + `if (statusDto.getId() != pojo.getStatus())` check on line 249) + `DataEntityHousekeepingJob.java:73-82` (the TTL query that depends on the column being non-NULL for DELETED entities) + verified at commit `ede5d277`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-058 (status state machine + soft-delete-as-deletion-model) is the architectural intent; this bug breaks the implementation-side guarantee that the ADR's TTL retention window is honoured. ADR-CANDIDATE-046 (housekeeping opt-out by shipped default) accepts that operators can disable housekeeping but does NOT defend the case where housekeeping IS enabled and the TTL is silently broken by a code bug elsewhere.
  - **Proposed remedy**: Reorder the check before the mutation in `DataEntityMapperImpl.applyStatus`: capture the prior status into a local variable BEFORE `setStatus(...)`, then check `if (statusDto.getId() != priorStatus) { pojo.setStatusUpdatedAt(now); }`. Add a unit test asserting `status_updated_at` is set on every status transition. Add a smoke test running `DataEntityHousekeepingJob` against a fixture entity transitioned via the controller; assert hard-delete fires after the TTL window.
  - **Severity rationale**: HIGH — silent data-retention break. Production deployments with default housekeeping configuration accumulate soft-deleted entities indefinitely; the 30-day TTL is documented but unimplemented at the verified commit.

**Discriminating context**: `DataEntityMapperImpl.applyStatus` (at lines 247-249) executes `pojo.setStatus(statusDto.getId())` on line 247 BEFORE the `if (statusDto.getId() != pojo.getStatus())` check on line 249. At the point of the check, `pojo.getStatus()` already equals `statusDto.getId()`, so the condition is always false and `statusUpdatedAt` is NEVER set on any status transition. The `DataEntityHousekeepingJob.java:73-82` TTL query `STATUS_UPDATED_AT.lessOrEqual(now - 30 days)` filters by `status_updated_at`; if that column is NULL for entities that transitioned to DELETED via this code path, the `lessOrEqual`…

**Full detail**: `detail/REFACTOR-198.md`

---

## REFACTOR-199 — Owner auto-create-on-miss via `createOwnership` BYPASSES the `OWNER_CREATE` permission gate — a caller with `DATA_ENTITY_OWNERSHIP_CREATE` can mint new Owner directory entries without holding `OWNER_CREATE`

**Severity**: HIGH
**Category**: missing-permission-check (permission-escalation surface)

**Discriminating context**: Calling `POST /api/dataentities/{id}/ownership` with `owner_name: "New Person"` (a name not yet in the `owner` directory) silently creates a fresh `OwnerPojo` row via `OwnerService.getOrCreate(name)` (`OwnerServiceImpl.java:39-42` → `ownerRepository.create(new OwnerPojo().setName(name))`). The gate for this endpoint is `DATA_ENTITY_OWNERSHIP_CREATE` (per `SecurityConstants.java:215-217`), NOT `OWNER_CREATE`. This is the SECOND write path into the Owner directory — the first being `POST /api/owners` (batch-E sidecar's directory CRUD), which IS gated by `OWNER_CREATE` (per…

**Full detail**: `detail/REFACTOR-199.md`

---

## REFACTOR-200 — Cross-owner read of the centerpiece DataEntityDetails — the widest blast-radius read-collaborative gap in the catalog

**Severity**: HIGH
**Category**: enumeration-vector (read-collaborative blast radius)

**Discriminating context**: Any authenticated user under LOGIN_FORM/OAUTH2/LDAP can issue `GET /api/dataentities/{id}` for any `id` in the database and receive the full DataEntityDetails payload — owners (full Ownership[] list, exposing organisational membership), internalDescription + externalDescription (free-text fields that may contain PII, internal URLs, customer names), tags + terms (which may encode classifications/sensitivity labels), custom metadata field values (operator-defined key-value pairs that may include credentials, contact info, or business context), dataSource (with name, namespace, description),…

**Full detail**: `detail/REFACTOR-200.md`

---

## REFACTOR-201 — View-count UPDATE inside `@ReactiveTransactional` — read retries inflate the counter, enrichment failures roll back the increment silently, no idempotency key on the increment side, getPopular ranking is trivially inflatable

**Severity**: MEDIUM
**Category**: idempotency

**Discriminating context**: The `view_count` UPDATE shares the same `@ReactiveTransactional` as the read + 4 enrichment merges. (a) If any enrichment step fails after `incrementViewCount` has executed, the transaction rolls back and the count is NOT incremented even though the user's HTTP layer may have observed the request. (b) A client-driven retry (network reset, gateway timeout, browser reload) increments the count multiple times for what the user perceives as one view. (c) A malicious or careless client can script `GET /api/dataentities/{id}` to push an entity to the top of the Popular panel…

**Full detail**: `detail/REFACTOR-201.md`

---

## REFACTOR-202 — `lineage_depth` NPE on missing parameter — primitive `int` autoboxing mismatch + no upper-bound cap → DoS-amplification vector; docs claim "Unset returns the platform's default depth" which is unimplemented

**Severity**: HIGH
**Category**: missing-validation + doc-code-drift

**Discriminating context**: Two compositional gaps on the same parameter. (a) **NPE on missing**: the OpenAPI spec marks `lineage_depth` as `required: false` (`openapi.yaml:1294-1300`) and the generated interface declares `Integer lineageDepth` (`DataEntityApi.java:918`), but the service signature requires primitive `int lineageDepth` (`LineageService.java:12`). When a client omits the parameter, autoboxing of a null `Integer` to `int` at `LineageServiceImpl.java:89` throws `NullPointerException`. The live API-reference doc states "Unset returns the platform's default depth" — there is no default in code; the documented…

**Full detail**: `detail/REFACTOR-202.md`

---

## REFACTOR-203 — Lineage cross-owner enumeration via downstream graph traversal — graph-shaped enumeration vector wider than search

**Severity**: HIGH
**Category**: enumeration-vector (read-collaborative blast radius)

**Discriminating context**: The controller method calls `LineageService.getLineage(dataEntityId, depth, expandedEntityIds, DOWNSTREAM)` with no `Authentication`/`Principal` argument (`DataEntityController.java:256-262`); the service implementation does not consume the reactor `Context` for the current user (`LineageServiceImpl.java:87-122`) and the repository walk filters only by `LINEAGE.IS_DELETED.isFalse()` (`ReactiveLineageRepositoryImpl.java:167, 174`). The returned graph therefore contains every data entity reachable via the lineage edges, including entities the caller has no owner relationship to. Combined with…

**Full detail**: `detail/REFACTOR-203.md`

---

## REFACTOR-204 — Default-off unauth ingestion at controller side — `postDataEntityList` has no `@PreAuthorize` and relies entirely on `IngestionDataEntitiesFilter` which is `enabled: false` by default

**Severity**: HIGH
**Category**: missing-auth + doc-code-drift

**Discriminating context**: `IngestionController.postDataEntityList` has no `@PreAuthorize` (line 37-45). Authentication is delegated to `IngestionDataEntitiesFilter`, which is gated by `auth.ingestion.filter.enabled` (`application.yml:48` — defaults to `false`). The path is in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`, `SecurityConstants.java:95-96`) — so even the UI auth modes (LOGIN_FORM/OAUTH2/LDAP) do not protect it. Result: a bundled deployment that an operator runs unmodified accepts `POST /ingestion/entities` from any caller able to reach the platform's HTTP port, with the caller free to choose any…

**Full detail**: `detail/REFACTOR-204.md`

---

## REFACTOR-205 — Cross-tenant ingestion under filter-OFF — caller can submit `data_source_oddrn` for ANY datasource and the entities materialise into that datasource's namespace

**Severity**: HIGH
**Category**: missing-auth (cross-tenant)

**Discriminating context**: Under `auth.ingestion.filter.enabled=false` (the default per REFACTOR-204), a caller with no token can `POST /ingestion/entities` with ANY `data_source_oddrn` in the body and the entities materialise into that datasource's namespace. The controller does not validate that the caller has any relationship to the target datasource (`IngestionController.java:38-44` passes the payload through unchanged; `IngestionServiceImpl.java:68-69` resolves the datasource BY ODDRN FROM THE PAYLOAD, not from any session/principal). Filter-OFF removes the only check that constrains this. Combined with…

**Full detail**: `detail/REFACTOR-205.md`

---

## REFACTOR-206 — Title auto-create via `createOwnership` has no allowlist — the platform's title vocabulary accumulates arbitrary user-submitted strings (typos, free-text descriptions, language variants) without an enum constraint

**Severity**: MEDIUM
**Category**: missing-validation

**Discriminating context**: Same pattern as REFACTOR-199 but for Title: any caller-supplied `title_name` not in the `title` directory becomes a fresh row via `TitleService.getOrCreate(name)` (`TitleServiceImpl.java:19-22`). There is no allowlist of valid titles (no "Steward / Owner / Reviewer" enum), no length / character-set / pattern constraint on `title_name` (`components.yaml:450-451` declares only `type: string`), and no audit event for Title-directory growth (no `@ActivityLog` on `TitleServiceImpl.getOrCreate`). Operators expecting a fixed vocabulary of titles ("Owner", "Steward", "Reviewer") discover that the…

**Full detail**: `detail/REFACTOR-206.md`

---

## REFACTOR-207 — Recursive lineage CTE has no cycle-detection — `UNION ALL` without a visited-set guard; only termination is the depth ceiling

**Severity**: MEDIUM
**Category**: missing-validation

**Discriminating context**: The CTE body is `UNION ALL` (`ReactiveLineageRepositoryImpl.java:168`) without a visited-set guard; the only termination is `tDepth.lessThan(lineageDepth.getDepth())`. For a lineage graph with a cycle (e.g. a transformer that consumes its own downstream artefact), row-count growth before depth-termination is unbounded by graph structure and limited only by the depth ceiling — which itself has no upper bound (REFACTOR-202). The outer `selectDistinct` (`ReactiveLineageRepositoryImpl.java:127`) deduplicates the FINAL result but does not prune the CTE work; the cost has already been paid inside…

**Full detail**: `detail/REFACTOR-207.md`

---

## REFACTOR-208 — No pagination / streaming on lineage — full graph materialised in memory; for a 100K-node downstream subgraph the response holds all 100K LineageNodeDto + edge list + group-relation map in JVM heap simultaneously

**Severity**: MEDIUM
**Category**: missing-pagination

**Discriminating context**: `LineageServiceImpl.getLineage(...)` calls `.collectList()` on the merged edge Flux (`LineageServiceImpl.java:102`) and then loads `repositoryMaps + childrenCountMap + parentsCountMap` for every referenced oddrn (`LineageServiceImpl.java:106-119`) before constructing the response. For a 100K-node downstream subgraph the response holds all 100K `LineageNodeDto`s + edge list + group-relation map in JVM heap simultaneously, then serialises the full payload to the response. There is no `Flux<...>` streaming variant and no `page`+`size` cursor on either parameter. Combined with REFACTOR-202 (no…

**Full detail**: `detail/REFACTOR-208.md`

---

## REFACTOR-209 — No state-machine guard on data-entity status transitions — any-to-any transitions allowed (UNASSIGNED → DELETED, DELETED → DRAFT, DRAFT → STABLE, etc.); the Statuses doc is silent on whether transitions are restricted

**Severity**: LOW
**Category**: missing-validation

**Discriminating context**: Restore-from-DELETED is intentional (the live doc explicitly documents the soft-delete window allowing return to a visible state), but transitions like `UNASSIGNED → DELETED` skipping DRAFT / DEPRECATED bypass the auto-switch-time intent entirely and leave no audit signal that this was unusual. The Statuses doc is silent on whether transitions are restricted; the code is permissive. Operators reading the docs cannot derive that any-to-any is supported.

**Full detail**: `detail/REFACTOR-209.md`

---

## REFACTOR-210 — No optimistic locking on DataEntityPojo — concurrent status PUTs to the same `dataEntityId` race on last-writer-wins; the activity log captures both events with their respective oldState snapshots taken BEFORE the parallel mutation began

**Severity**: MEDIUM
**Category**: race-condition

**Discriminating context**: Two simultaneous operators each issuing a DEPRECATED + status_switch_time on the same entity can result in one of their `status_switch_time` values being silently overwritten. The activity log captures both events with their respective `oldState` snapshots taken BEFORE the parallel mutation began — so the audit shows two transitions FROM the same `oldState` to (potentially) different `newState` values, which can mislead a forensic reader.

**Full detail**: `detail/REFACTOR-210.md`

---

## REFACTOR-211 — `view_count` hot-key UPDATE under read load — write-contention on the platform's most-read entities scales as O(reads); the hot row becomes a write-throughput bottleneck on what is supposed to be a read-only path

**Severity**: MEDIUM
**Category**: lock-window-race (performance)

**Discriminating context**: Every page-view increments `data_entity.view_count` for the same row; for a high-traffic deployment with a popular entity (e.g. an ML model that hundreds of users view daily), the row sees row-level write-locks proportional to the read rate. Postgres handles this fine at small scale; at scale, the hot row becomes a write-throughput bottleneck on what is supposed to be a read-only path. There is no batching, no in-memory aggregation, no eventually-consistent counter.

**Full detail**: `detail/REFACTOR-211.md`

---

## REFACTOR-005 — `GenAIProperties` has no `@Validated` / `@NotBlank` / `@URL` / `@Min(1)` — Spring Boot's `@ConfigurationProperties` validation is not engaged

**Severity**: MEDIUM
**Category**: missing-validation

**Discriminating context**: `GenAIProperties.java:1-12` carries only `@ConfigurationProperties` and `@Data`; no `@Validated`, no `jakarta.validation.constraints.*` imports. The platform misses Spring's startup-time validation hook. The fail-fast happens at first request rather than at boot — even though boot-time fail-fast would be more operator-friendly.

**Full detail**: `detail/REFACTOR-005.md`

---

## REFACTOR-006 — `requestTimeout=0` accepted at startup; `Duration.ofMinutes(0)` is legal but produces immediate ReadTimeoutException with confusing error message

**Severity**: MEDIUM
**Category**: buggy-default

**Discriminating context**: `WebClientConfiguration.java:23` calls `Duration.ofMinutes(genAIProperties.getRequestTimeout())`; Java primitive default is `0`. Operator sets `genai.enabled=true` without setting `request_timeout` → zero-duration timeout. Every request fires immediately as a `ReadTimeoutException`; the error message at `GenAIServiceImpl.java:48-51` is `"Gen AI request take longer that %s min".formatted(...)` which renders as `"Gen AI request take longer that 0 min"` — diagnostic of the misconfiguration but the message implies upstream slowness. Plus a typo: "longer that" should be "longer than".

**Full detail**: `detail/REFACTOR-006.md`

---

## REFACTOR-007 — GenAI prompts and responses are not logged for audit / abuse-investigation

**Severity**: MEDIUM
**Category**: missing-audit

**Discriminating context**: The controller has no `@Slf4j`; `GenAIServiceImpl.java:19`'s `@Slf4j` annotation is unused (no `log.info` / `log.warn` / `log.error` calls). An operator investigating prompt-injection abuse or data-exfiltration through the LLM has no platform-side trail.

**Full detail**: `detail/REFACTOR-007.md`

---

## REFACTOR-009 — No compile-time / test-time guard against SECURITY_RULES path-pattern drift; the term-mismatch case (REFACTOR-008) had no automated detection

**Severity**: MEDIUM
**Category**: missing-test
**Surfaced by**:
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[4]` ("Authorization layer is path-string-coupled with no compile-time/test-time guard against drift")
  - **Statement**: SECURITY_RULES is a list of literal path strings; OpenAPI-generated `*Api` interfaces carry their own literal `@RequestMapping(value = ...)` strings. If the spec changes and SECURITY_RULES isn't updated (REFACTOR-008's case), the build is green and the security regression is silent.
  - **Evidence**: `SecurityConstants.java:98-355` (string-literal paths) + `DataEntityApi.java:148, 542` (string-literal paths) — no shared source of truth, no integration test that walks both
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) calls out the path-string-coupling trade-off; this scope is the missing test infrastructure that mitigates the trade-off.
  - **Proposed remedy**: Add a unit test that walks the generated `*Api` interfaces' `@RequestMapping(value = ...)` annotations and asserts every value with a security-significant prefix appears in SECURITY_RULES (or is explicitly excluded with a comment). Optionally: add a custom Gradle task that fails the build on SECURITY_RULES paths that have no matching mapping (the inverse direction — catches stale rules).
  - **Severity rationale**: MEDIUM — process gap; reduces likelihood of REFACTOR-008-class bugs.

**Discriminating context**: SECURITY_RULES is a list of literal path strings; OpenAPI-generated `*Api` interfaces carry their own literal `@RequestMapping(value = ...)` strings. If the spec changes and SECURITY_RULES isn't updated (REFACTOR-008's case), the build is green and the security regression is silent.

**Full detail**: `detail/REFACTOR-009.md`

---

## REFACTOR-010 — Cross-entity uploadId hijack — caller with DATA_ENTITY_ATTACHMENT_MANAGE on entity X who learns uploadId Y issued for entity Z can post chunks via `POST /api/dataentities/X/files/uploads/Y/chunks`

**Severity**: MEDIUM
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[3]`
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[2]` + `security.known_security_gaps.[0]` ("the security gate at SecurityConstants.java:247-251 authorises against the URL's `data_entity_id`, but the chunk lands against the `uploadId`'s originating entity. A user with `DATA_ENTITY_ATTACHMENT_MANAGE` on entity X can post chunks toward entity Z if they obtain a `uploadId` issued for Z. The misalignment is structural (path vs uploadId) and can only be fixed by service-side cross-validation (e.g., `assert filePojo.dataEntityId == path.dataEntityId` in `FileServiceImpl.uploadFileChunk`).") — chunk-method sidecar confirms from the chunk-upload side and adds the structural fix recommendation
  - **Statement**: The controller / service chain never verifies the `uploadId` belongs to the path's `dataEntityId`. The chunks land against the original entity (because `FileRepository.getFileByUploadId(uploadId)` resolves by uploadId only), so the data-loss surface is bounded, but the URL becomes deceptive. The misalignment is structural — the SECURITY_RULES gate evaluates against the path's `data_entity_id` (per ADR-CANDIDATE-002), the chunk lands against the `uploadId`'s entity (per ADR-CANDIDATE-023). A caller already-authorized on entity X can divert chunks to any entity they obtain a `uploadId` for.
  - **Evidence**: `DataEntityAttachmentController.java:54-62, 65-70` + `AttachmentServiceImpl.java:71-78` + `FileServiceImpl.java:93-102` + `SecurityConstants.java:247-251` (gate matches URL, not service-resolved entity)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-023 (NEW 2026-05-10A — uploadId-as-session-key) describes the structural shape; this scope is the gap it produces. The fix preserves the ADR's shape: add `assert filePojo.dataEntityId == path.dataEntityId` in the service.
  - **Proposed remedy**: Add a check in `FileServiceImpl.checkProcessingUploadById` that `file.dataEntityId` matches the path's `dataEntityId`; reject mismatch with HTTP 400. Add an integration test for the cross-entity path.
  - **Severity rationale**: MEDIUM — correctness-of-RBAC bug; URL deception even if data-integrity is preserved.

**Discriminating context**: The controller / service chain never verifies the `uploadId` belongs to the path's `dataEntityId`. The chunks land against the original entity (because `FileRepository.getFileByUploadId(uploadId)` resolves by uploadId only), so the data-loss surface is bounded, but the URL becomes deceptive. The misalignment is structural — the SECURITY_RULES gate evaluates against the path's `data_entity_id` (per ADR-CANDIDATE-002), the chunk lands against the `uploadId`'s entity (per ADR-CANDIDATE-023). A caller already-authorized on entity X can divert chunks to any entity they obtain a `uploadId` for.

**Full detail**: `detail/REFACTOR-010.md`

---

## REFACTOR-011 — Concurrent chunks with the same `index` for the same `uploadId` race-overwrite each other silently — no idempotency token beyond `index`

**Severity**: MEDIUM
**Category**: race-condition
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - **STRENGTHENED 2026-05-10A**: `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases.[4]` (MEDIUM) ("Same-`index` race overwrites silently. `FilePart.transferTo(chunkDirectory.resolve(String.valueOf(index)))` is a last-writer-wins file write keyed by `index`. A client retrying chunk `index=3` while the prior attempt is still flushing has both writes target the same path. Reactor's `transferTo` does not provide write-isolation semantics; the prior write may be partially flushed when the second begins. The assembled file (`completeFileUpload`) reads chunks via `FileUtils.listFilesInOrder` and concatenates whatever bytes are present — corruption is silent.")
  - **Statement**: `FilePart.transferTo(path.resolve(String.valueOf(index)))` is last-writer-wins file write keyed by `index`. If a client retries a failed chunk while the first attempt is still flushing, both writes target the same path; a retry-after-partial-write pattern can produce a corrupt assembled file with no error surfaced.
  - **Evidence**: `DataEntityAttachmentController.java:54-62` + `FileServiceImpl.java:58-67`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Use `Files.move(StandardCopyOption.ATOMIC_MOVE)` from a per-attempt temp file; or per-chunk `(index, attempt)` key; or strict version of `FileChannel.tryLock`. Add an integration test that fires concurrent chunks with the same index.
  - **Severity rationale**: MEDIUM — silent data corruption under specific retry patterns.

**Discriminating context**: `FilePart.transferTo(path.resolve(String.valueOf(index)))` is last-writer-wins file write keyed by `index`. If a client retries a failed chunk while the first attempt is still flushing, both writes target the same path; a retry-after-partial-write pattern can produce a corrupt assembled file with no error surfaced.

**Full detail**: `detail/REFACTOR-011.md`

---

## REFACTOR-012 — `downloadFile` Content-Disposition header injection — `dto.fileName()` injected verbatim with no sanitisation, no quoting, no `filename*=UTF-8''...` encoding

**Severity**: MEDIUM
**Category**: header-injection
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[6]`
  - **Statement**: `DataEntityAttachmentController.java:77` does `"attachment;filename=" + dto.fileName()`. CR/LF in filename → header injection; non-ASCII renders inconsistently across browsers; `"` or `;` truncates the value. Filename originates from `DataEntityUploadFormData.fileName` posted at `initiateFileUpload` — fully attacker-controlled.
  - **Evidence**: `DataEntityAttachmentController.java:73-80` + `FileServiceImpl.java:41-55`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Use Spring's `ContentDisposition.attachment().filename(dto.fileName(), StandardCharsets.UTF_8).build().toString()`. Reject CR/LF in filenames at upload time (a separate fast-fail validation).
  - **Severity rationale**: MEDIUM — header injection vulnerability.

**Discriminating context**: `DataEntityAttachmentController.java:77` does `"attachment;filename=" + dto.fileName()`. CR/LF in filename → header injection; non-ASCII renders inconsistently across browsers; `"` or `;` truncates the value. Filename originates from `DataEntityUploadFormData.fileName` posted at `initiateFileUpload` — fully attacker-controlled.

**Full detail**: `detail/REFACTOR-012.md`

---

## REFACTOR-014 — OpenAPI spec for GenAI declares only `200 OK` — `400` and `500` failure modes are emitted by the controller advice but not in the contract

**Severity**: MEDIUM
**Category**: missing-validation (contract-completeness)

**Discriminating context**: `openapi.yaml:4205-4211`'s `responses:` block has only `'200'`; the actual feature emits `BadUserRequestException` → HTTP 400 (when `genai.enabled=false`) and `GenAIException` → HTTP 500 (timeout / upstream error) via `ControllerAdvice.java:24-27, 55-59`. Consumers reading the generated client are blind to both failure modes.

**Full detail**: `detail/REFACTOR-014.md`

---

## REFACTOR-015 — `getDataEntityActivity` exposes who-changed-what audit trail to any authenticated user

**Severity**: MEDIUM
**Category**: missing-auth

**Discriminating context**: The activity stream (per-data-entity who-did-what audit log) is a GET endpoint outside SECURITY_RULES. Any authenticated user can read any entity's activity — including who has been editing descriptions, tags, terms, ownership, and so on.

**Full detail**: `detail/REFACTOR-015.md`

---

## REFACTOR-017 — AlertManager endpoint has no rate-limit, payload-size limit, or duplicate-suppression — unauthenticated DoS / noise injection vector

**Severity**: MEDIUM
**Category**: missing-rate-limit
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[2]`
  - **Statement**: A misconfigured AlertManager (or a malicious caller — the endpoint is unauthenticated by design per ADR-CANDIDATE-006) can flood ODD with alerts. Each `ExternalAlert` produces one `AlertPojo` row + one `AlertChunkPojo` row inside `@ReactiveTransactional` `handleExternalAlerts`; cross-batch volume is not bounded. AlertManager `group_interval` re-sends every 5m by default; each re-send creates a fresh `AlertPojo` even if `(entity_oddrn, type=DISTRIBUTION_ANOMALY)` already has an OPEN alert (no dedup).
  - **Evidence**: `AlertManagerController.java:21-26` + `AlertServiceImpl.java:152-191`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-006 (network-delegated auth) explicitly defers application-layer auth to the network layer. The ADR does NOT defend the absence of rate-limit / dedup / payload-cap; those are gaps.
  - **Proposed remedy**: Add Bucket4j or Spring Cloud Gateway-style rate-limit on `/ingestion/alert/alertmanager`. Implement upsert-on-conflict for `(entity_oddrn, type, status=OPEN)` to dedup re-sends.
  - **Severity rationale**: MEDIUM — DoS + noise-injection on the unauthenticated path.

**Discriminating context**: A misconfigured AlertManager (or a malicious caller — the endpoint is unauthenticated by design per ADR-CANDIDATE-006) can flood ODD with alerts. Each `ExternalAlert` produces one `AlertPojo` row + one `AlertChunkPojo` row inside `@ReactiveTransactional` `handleExternalAlerts`; cross-batch volume is not bounded. AlertManager `group_interval` re-sends every 5m by default; each re-send creates a fresh `AlertPojo` even if `(entity_oddrn, type=DISTRIBUTION_ANOMALY)` already has an OPEN alert (no dedup).

**Full detail**: `detail/REFACTOR-017.md`

---

## REFACTOR-020 — Pagination parameters (`PageParam`, `SizeParam`) are int32 with no min/max/default — caller can pass `size=2147483647`

**Severity**: MEDIUM
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses.[0]`
  - **Statement**: `components.yaml:4213-4229`'s shared `PageParam` and `SizeParam` declarations are int32 with no `minimum`/`maximum`/`default`. Page-size validation is at the caller's discretion. Same wisdom-test classification as REFACTOR-044 — "service-layer defends" is descriptive of a gap, not a deliberate posture.
  - **Evidence**: `components.yaml:4213-4229` + `openapi.yaml:828-866` (every list operation references these unconstrained params)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Update `components.yaml`'s `PageParam` (`minimum: 1`) and `SizeParam` (`minimum: 1`, `maximum: 200`, `default: 20`). Regenerate and re-test all list endpoints.
  - **Severity rationale**: MEDIUM — pervasive across every list endpoint.

**Discriminating context**: `components.yaml:4213-4229`'s shared `PageParam` and `SizeParam` declarations are int32 with no `minimum`/`maximum`/`default`. Page-size validation is at the caller's discretion. Same wisdom-test classification as REFACTOR-044 — "service-layer defends" is descriptive of a gap, not a deliberate posture.

**Full detail**: `detail/REFACTOR-020.md`

---

## REFACTOR-021 — No controller-level smoke / `@WebFluxTest` exists for AlertController

**Severity**: MEDIUM
**Category**: missing-test

**Discriminating context**: A breaking change to the OpenAPI generator template, the WebFlux configuration, or the Jackson serialiser config could silently break all five `/api/alerts*` endpoints with the build still passing.

**Full detail**: `detail/REFACTOR-021.md`

---

## REFACTOR-022 — No controller-level test exists for any DataEntityAttachmentController endpoint

**Severity**: MEDIUM
**Category**: missing-test

**Discriminating context**: 10 endpoints, including the stateful chunked-upload protocol, with no `@WebFluxTest` coverage. The chunked-upload protocol is the highest-value target for a wired integration test.

**Full detail**: `detail/REFACTOR-022.md`

---

## REFACTOR-023 — No controller-level integration test exists for GenAIController

**Severity**: MEDIUM
**Category**: missing-test

**Discriminating context**: A regression in the OpenAPI generator template, the WebFlux configuration, the `ControllerAdvice` exception mapping, or the security filter chain (e.g. accidentally adding `/api/genai/**` to the WHITELIST_PATHS) could silently change the endpoint's contract or auth posture with the build still passing.

**Full detail**: `detail/REFACTOR-023.md`

---

## REFACTOR-030 — `i18n` `fallbackLng` is the full six-element array `['en','es','ch','fr','ua','hy']` rather than conventional `'en'`

**Severity**: MEDIUM
**Category**: buggy-default

**Discriminating context**: Per i18next semantics, on missing key, i18next walks the fallbackLng array in order. A French user with a key present in Spanish/Chinese but missing in French would see Spanish or Chinese unexpectedly before reaching English. Almost certainly not intended.

**Full detail**: `detail/REFACTOR-030.md`

---

## REFACTOR-031 — AlertManager hand-rolled DTO drops fields the platform may later want to honour (`status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`)

**Severity**: MEDIUM
**Category**: missing-validation (DTO-completeness)

**Discriminating context**: `AlertManagerRequest` has only `alerts: List<ExternalAlert>`; `ExternalAlert` has only `labels`, `generatorURL`, `startsAt`. AlertManager's actual schema has `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`. If the platform later wants to act on `status: resolved` to close alerts, it must add deserialisation for that field — the current DTO would lose it.

**Full detail**: `detail/REFACTOR-031.md`

---

## REFACTOR-032 — `ExternalAlert.startsAt` is timezone-naive `LocalDateTime`; AlertManager's RFC3339 timezone offset is silently stripped by Jackson

**Severity**: MEDIUM
**Category**: buggy-default
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[4]`
  - **Statement**: `ExternalAlert.java:14` declares `private LocalDateTime startsAt`; Prometheus AlertManager sends `startsAt` as RFC3339 with timezone (e.g. `2026-05-08T10:23:45.123Z`). Jackson's default `LocalDateTime` deserialiser strips the offset. If the platform JVM and AlertManager are in different zones, alert timestamps drift by the offset.
  - **Evidence**: `ExternalAlert.java:14` + `AlertServiceImpl.java:67-68`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Change `LocalDateTime` to `OffsetDateTime` or `Instant`. Update `AlertServiceImpl` formatter pattern to preserve the zone. Add a unit test with a zoned input.
  - **Severity rationale**: MEDIUM — timestamp correctness on the alert-routing path.

**Discriminating context**: `ExternalAlert.java:14` declares `private LocalDateTime startsAt`; Prometheus AlertManager sends `startsAt` as RFC3339 with timezone (e.g. `2026-05-08T10:23:45.123Z`). Jackson's default `LocalDateTime` deserialiser strips the offset. If the platform JVM and AlertManager are in different zones, alert timestamps drift by the offset.

**Full detail**: `detail/REFACTOR-032.md`

---

## REFACTOR-034 — MinIO SDK HTTP-client timeouts (~5min default) not configurable at YAML — slow networks combined with large `attachment.max-file-size` produce unrecoverable socket timeouts

**Severity**: MEDIUM
**Category**: buggy-default

**Discriminating context**: `MinioConfig` builds `MinioAsyncClient` with no custom `OkHttpClient`, so the SDK defaults apply globally to all REMOTE operations. There is no `attachment.remote.timeout` knob; tuning requires a code change.

**Full detail**: `detail/REFACTOR-034.md`

---

## REFACTOR-035 — No per-tenant / per-data-entity / total-upload quota — operator setting a per-file cap implicitly accepts that one user can fill storage by repeated max-size uploads

**Severity**: MEDIUM
**Category**: missing-quota

**Discriminating context**: `attachment.max-file-size` is a single per-file cap. There is no `attachment.max-total-size`, no per-data-entity quota, no per-tenant quota. Combined with REFACTOR-026 (LOCAL ephemeral default), an operator who sets a 100 MB per-file cap accepts that a single user can fill `/tmp` ahead of an unrelated container restart.

**Full detail**: `detail/REFACTOR-035.md`

---

## REFACTOR-036 — Boot-time crash if `attachment.max-file-size` is unset — `@Value("${attachment.max-file-size}")` has no `:default` fallback

**Severity**: MEDIUM
**Category**: buggy-default
**Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:bugs_limitations_corner_cases.[6]` (LOW)
  - **Statement**: `AttachmentServiceImpl.java:27` declares `@Value("${attachment.max-file-size}")` with no `:default` fallback and a boxed `Integer` type. Operator overriding via env (`ATTACHMENT_MAX_FILE_SIZE=`) gets a Spring property-resolution failure at startup. The shipped `application.yml:217` value `20` is the only safety net.
  - **Evidence**: `AttachmentServiceImpl.java:27` + `application.yml:217`
  - **Proposed remedy**: Add a fallback: `@Value("${attachment.max-file-size:20}")`. Or — better — bind via `@ConfigurationProperties` with default initialiser.
  - **Severity rationale**: MEDIUM — boot-time crash on env override.

**Discriminating context**: `AttachmentServiceImpl.java:27` declares `@Value("${attachment.max-file-size}")` with no `:default` fallback and a boxed `Integer` type. Operator overriding via env (`ATTACHMENT_MAX_FILE_SIZE=`) gets a Spring property-resolution failure at startup. The shipped `application.yml:217` value `20` is the only safety net.

**Full detail**: `detail/REFACTOR-036.md`

---

## REFACTOR-037 — Reopen-conflict guard on `changeAlertStatus` is read-then-write without serialisable fence — two concurrent OPEN requests for sibling alerts on same entity can both pass the guard

**Severity**: MEDIUM
**Category**: race-condition

**Discriminating context**: `AlertServiceImpl.updateStatus` checks "no open alert of same type for this entity exists" then writes. Concurrent requests can both pass the check before either writes. No `SELECT ... FOR UPDATE`, no advisory lock, no transactional fence.

**Full detail**: `detail/REFACTOR-037.md`

---

## REFACTOR-038 — Directory landing-page DataSource list loaded without pagination — O(N) memory + parsing on every Directory navigation

**Severity**: MEDIUM
**Category**: missing-pagination
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
    - `concepts.yaml:entities[Directory].performance_aggregate.weaknesses.[0]`
  - **Statement**: `DirectoryServiceImpl.getDataSourceTypes` calls `dataSourceRepository.list()` (full scan) then groups in memory by ODDRN prefix. For platforms with tens of thousands of registered data sources, the cost compounds linearly per Directory landing-page hit.
  - **Evidence**: `DirectoryServiceImpl.java:48-50`
  - **Proposed remedy**: Add a DB-level aggregate query that returns counts grouped by ODDRN prefix (eliminating the in-memory grouping). Or paginate the unfiltered list and force the UI to render incrementally.
  - **Severity rationale**: MEDIUM — performance scaling issue on the Directory landing page.

**Discriminating context**: `DirectoryServiceImpl.getDataSourceTypes` calls `dataSourceRepository.list()` (full scan) then groups in memory by ODDRN prefix. For platforms with tens of thousands of registered data sources, the cost compounds linearly per Directory landing-page hit.

**Full detail**: `detail/REFACTOR-038.md`

---

## REFACTOR-051 — Slack-posting `MessageRequest.text` has no max-length, no sanitisation, no markdown allowlist — a 4 MB body is accepted and persisted; only fails at Slack's `chat.postMessage` boundary, AFTER the 202 has been returned to the caller

**Severity**: MEDIUM
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
  - **Statement**: `MessageRequest.text` is marked `required` only (`components.yaml:3410-3423`); no `@Size`, no `@Pattern`, no length cap. The controller accepts up to `spring.codec.max-in-memory-size` (~20 MB by default), persists the message row to the `messages` table, returns `202 Accepted`. The downstream sender thread then attempts `chat.postMessage` which fails with `msg_too_long` (Slack's per-message limit is ~40 KB). The user sees `202 Accepted` and the message ends up in `ERROR_SENDING` state after the retry budget exhausts. UX hostile (user has no per-request signal of failure).
  - **Evidence**: `MessageRequest` schema `components.yaml:3410-3423` + `SlackAPIClientImpl.java:64-81` + `DataCollaborationMessageSenderJob.java:58-63`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the 202+queue+retry shape; this scope is the gap that the queue-decoupled posture does NOT defend (the queue accepts bytes; the queue does not validate bytes against the downstream contract).
  - **Proposed remedy**: Add `@Size(max = 40000)` on `MessageRequest.text` (matches Slack's actual per-message limit, conservatively). Reject oversized at the controller with HTTP 400 — never persist to `messages` if the message can't possibly succeed downstream. Update OpenAPI schema accordingly.
  - **Severity rationale**: MEDIUM — DoS amplifier (queue pollution) + UX hostile failure mode.

**Discriminating context**: `MessageRequest.text` is marked `required` only (`components.yaml:3410-3423`); no `@Size`, no `@Pattern`, no length cap. The controller accepts up to `spring.codec.max-in-memory-size` (~20 MB by default), persists the message row to the `messages` table, returns `202 Accepted`. The downstream sender thread then attempts `chat.postMessage` which fails with `msg_too_long` (Slack's per-message limit is ~40 KB). The user sees `202 Accepted` and the message ends up in `ERROR_SENDING` state after the retry budget exhausts. UX hostile (user has no per-request signal of failure).

**Full detail**: `detail/REFACTOR-051.md`

---

## REFACTOR-052 — Slack-posting endpoint has no inbound rate-limit — a single authenticated user can fill the `messages` table at maximum throughput; sender thread becomes the bottleneck

**Severity**: MEDIUM
**Category**: missing-rate-limit
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[7]` (MEDIUM)
  - **Statement**: `POST /api/datacollaboration/providers/slack/messages` has no per-endpoint rate-limiting, no Bucket4j integration, no per-user throttle. A single authenticated user can call the endpoint in a tight loop with 4 MB bodies, all of which are persisted to `messages` and then drained by a single-leader sender (`DataCollaborationMessageSenderJob`). The sender thread becomes the bottleneck, not the inbound, so attacker-controlled growth of `messages` rows is unbounded by the inbound. Combined with REFACTOR-050 (no authz gate) and REFACTOR-051 (no body validation), this is a queue-pollution + DB-disk-fill surface for any authenticated user.
  - **Evidence**: `DataCollaborationController.java:33-39` + no per-endpoint rate-limiting in this controller, the global filter chain (`AuthorizationCustomizer.java:19-31`), or in `DataCollaborationServiceImpl.createAndSendMessage(...)`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the 202+queue+retry shape; this scope is a gap on the inbound side. The ADR's queue model ASSUMES bounded inbound; the absence of an enforceable upper bound is the gap.
  - **Proposed remedy**: Add per-user rate-limit on `POST /api/datacollaboration/providers/slack/messages` (e.g., 10 messages/minute/user). Expose `datacollaboration.rate-limit.requests-per-minute-per-user`. Document on the live `data-collaboration` page.
  - **Severity rationale**: MEDIUM — queue pollution / DB-disk-fill via attacker-controlled inbound.

**Discriminating context**: `POST /api/datacollaboration/providers/slack/messages` has no per-endpoint rate-limiting, no Bucket4j integration, no per-user throttle. A single authenticated user can call the endpoint in a tight loop with 4 MB bodies, all of which are persisted to `messages` and then drained by a single-leader sender (`DataCollaborationMessageSenderJob`). The sender thread becomes the bottleneck, not the inbound, so attacker-controlled growth of `messages` rows is unbounded by the inbound. Combined with REFACTOR-050 (no authz gate) and REFACTOR-051 (no body validation), this is a queue-pollution +…

**Full detail**: `detail/REFACTOR-052.md`

---

## REFACTOR-054 — Slack-posting caller cannot observe send failure — controller returns 202 with `state=PENDING_SEND`; downstream `ERROR_SENDING` is only visible by polling `/api/dataentities/{id}/messages`

**Severity**: MEDIUM
**Category**: error-mapping
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[4]` (MEDIUM)
  - **Statement**: The controller returns `202 Accepted` with a `Message` body whose `state` is `PENDING_SEND`. Downstream Slack failures (auth revoked, channel archived, text too long, rate-limited beyond retry budget) flip the row to `ERROR_SENDING` in the sender job. There is no notification, no push mechanism, no webhook back to the original caller. The user must re-fetch via the `/api/dataentities/{id}/messages` endpoints to see status.
  - **Evidence**: `DataCollaborationController.java:38` + `DataCollaborationServiceImpl.java:96` + `DataCollaborationMessageSenderJob.java:58-63`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the 202 model; this scope is the structural consequence (asynchrony precludes inline failure-reporting) but the absence of a polling/webhook/notification mechanism is a gap, not part of the ADR.
  - **Proposed remedy**: Either (a) add a Server-Sent-Events endpoint or WebSocket channel that streams message-state changes to subscribed clients; (b) add a polling endpoint specifically for one message (`GET /api/datacollaboration/messages/{uuid}/state`); (c) document on the live `data-collaboration` page that the UI must poll the per-entity messages endpoint to discover send-failures.
  - **Severity rationale**: MEDIUM — UX gap; users have no immediate signal whether their message succeeded.

**Discriminating context**: The controller returns `202 Accepted` with a `Message` body whose `state` is `PENDING_SEND`. Downstream Slack failures (auth revoked, channel archived, text too long, rate-limited beyond retry budget) flip the row to `ERROR_SENDING` in the sender job. There is no notification, no push mechanism, no webhook back to the original caller. The user must re-fetch via the `/api/dataentities/{id}/messages` endpoints to see status.

**Full detail**: `detail/REFACTOR-054.md`

---

## REFACTOR-055 — Slack rate-limit handling is non-discriminating — every exception treated as the same 3-retry budget with fixed 1s sleep; 429 / `ratelimited` is not distinguished from `invalid_auth` / `channel_not_found`

**Severity**: MEDIUM
**Category**: error-mapping
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[5]` (MEDIUM)
  - **Statement**: Every exception from `SlackAPIClientImpl.postMessage` is caught at `DataCollaborationMessageSenderJob.java:55` as a generic `Exception e` and either retried (`shouldRetry`) or persisted as `markMessageAsFailed`. Slack's `ratelimited` / `429` responses are not distinguished from auth (`invalid_auth`, `not_authed`) or channel (`channel_not_found`, `not_in_channel`) errors — the same 3-retry budget applies, with a fixed 1-second sleep. Under sustained 429s the budget is exhausted in <4s and the message is dropped.
  - **Evidence**: `DataCollaborationMessageSenderJob.java:54-65` + `SlackAPIClientImpl.java:73-77`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the retry-budget shape; this scope is the missing differentiation by error class — the ADR doesn't defend "treat all errors equally."
  - **Proposed remedy**: Distinguish error classes: (a) `429 / ratelimited` → exponential-backoff, longer total budget (Slack's `Retry-After` header should drive the next-attempt delay); (b) `invalid_auth / token_revoked` → terminal failure, no retry, fail-loud (operator must rotate); (c) `channel_not_found / not_in_channel` → terminal failure, no retry; (d) network errors → existing retry budget. Add Micrometer counters per error class for operator observability.
  - **Severity rationale**: MEDIUM — defective retry behaviour drops messages that retry-with-backoff would deliver.

**Discriminating context**: Every exception from `SlackAPIClientImpl.postMessage` is caught at `DataCollaborationMessageSenderJob.java:55` as a generic `Exception e` and either retried (`shouldRetry`) or persisted as `markMessageAsFailed`. Slack's `ratelimited` / `429` responses are not distinguished from auth (`invalid_auth`, `not_authed`) or channel (`channel_not_found`, `not_in_channel`) errors — the same 3-retry budget applies, with a fixed 1-second sleep. Under sustained 429s the budget is exhausted in <4s and the message is dropped.

**Full detail**: `detail/REFACTOR-055.md`

---

## REFACTOR-056 — Slack channel_id is fully user-supplied — caller can target ANY Slack channel the platform's bot has been invited to, regardless of which channel the in-app autocomplete listed

**Severity**: MEDIUM
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[3]` (MEDIUM)
  - **Statement**: The request body's `channel_id` is passed straight to `SlackAPIClient.exchangeForChannel(channelId)`. Any Slack channel the bot has been invited to (`Conversation::isMember` filter in `SlackAPIClientImpl.java:45`) is acceptable. There is no concept of "which channels are valid for which data entity / owner" server-side. A user with the autocomplete UI listing channels A and B can craft a request targeting channel C (if the bot is in C), even if the platform UI never offers C.
  - **Evidence**: `DataCollaborationController.java:34-37` + `DataCollaborationServiceImpl.java:53-56` + `SlackAPIClientImpl.java:50-62`
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add a server-side `(data_entity_id, allowed_channels[])` mapping (a new `data_entity_slack_channel` join table). The autocomplete API returns the per-entity allowed channels; the post API rejects channel_ids not in that set with HTTP 400.
  - **Severity rationale**: MEDIUM — escape from autocomplete UI; cross-channel posting is a data-leak surface to channels the user wouldn't normally see.

**Discriminating context**: The request body's `channel_id` is passed straight to `SlackAPIClient.exchangeForChannel(channelId)`. Any Slack channel the bot has been invited to (`Conversation::isMember` filter in `SlackAPIClientImpl.java:45`) is acceptable. There is no concept of "which channels are valid for which data entity / owner" server-side. A user with the autocomplete UI listing channels A and B can craft a request targeting channel C (if the bot is in C), even if the platform UI never offers C.

**Full detail**: `detail/REFACTOR-056.md`

---

## REFACTOR-057 — `getActivity` and `getActivityCounts` exposes cross-owner aggregate counts to any authenticated user via `/api/activity/counts`

**Severity**: MEDIUM
**Category**: missing-auth
**Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[5]` (LOW per sidecar but MEDIUM at concept-aggregate given the cross-owner aggregate exposure)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.data_exposure.[1]`
  - **Statement**: `getActivityCounts` returns `totalCount`, `myObjectsCount`, `downstreamCount`, `upstreamCount` in a single payload. `totalCount` is computed without any owner filter (`ActivityServiceImpl.java:219-230`). Any authenticated user calling `/api/activity/counts` learns the total cross-owner activity volume in the window, even if they cannot enumerate the events themselves under `MY_OBJECTS`. (In practice they CAN enumerate via `type=ALL` per REFACTOR-053, but the counts endpoint trivially exposes the aggregate without paging — a low-cost reconnaissance signal.)
  - **Evidence**: `ActivityServiceImpl.java:139-166` (the `zip` of four counts) + `ActivityServiceImpl.java:219-230` (`getTotalCount` with no owner filter)
  - **Existing-ADR-or-implied-prescription**: Same as REFACTOR-053 — ADR-CANDIDATE-003 borderline.
  - **Proposed remedy**: Same triage as REFACTOR-053. If the maintainer adds `PLATFORM_ACTIVITY_READ_ALL`, gate `getActivityCounts.totalCount` behind it (return only `myObjectsCount` to non-admin callers). If the maintainer confirms read-collaborative posture, no change required but the live-doc must say so.
  - **Severity rationale**: MEDIUM — informational; the same data is reachable via the list endpoint (REFACTOR-053), but the counts endpoint is trivially queryable.

**Discriminating context**: `getActivityCounts` returns `totalCount`, `myObjectsCount`, `downstreamCount`, `upstreamCount` in a single payload. `totalCount` is computed without any owner filter (`ActivityServiceImpl.java:219-230`). Any authenticated user calling `/api/activity/counts` learns the total cross-owner activity volume in the window, even if they cannot enumerate the events themselves under `MY_OBJECTS`. (In practice they CAN enumerate via `type=ALL` per REFACTOR-053, but the counts endpoint trivially exposes the aggregate without paging — a low-cost reconnaissance signal.)

**Full detail**: `detail/REFACTOR-057.md`

---

## REFACTOR-059 — `getActivity` `type=null` and `type=ALL` route to `fetchAllActivities` via separate code branches — defence-in-depth gap; a future refactor adding owner-scoping to one branch would silently bypass via the other

**Severity**: MEDIUM
**Category**: dual-path
**Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[1]` (MEDIUM)
  - **Statement**: `ActivityServiceImpl.java:103-105` has `if (type == null) { return fetchAllActivities(...) }` BEFORE the four-arm switch; the switch's `case ALL ->` ALSO routes to `fetchAllActivities`. There are two paths to the same destination. A future refactor that adds owner-scoping to the `ALL` enum case (e.g., to address REFACTOR-053 partially) would silently bypass the new gate when callers omit the `type` parameter. Defence-in-depth requires either collapsing the two branches OR asserting `type != null` at the controller layer.
  - **Evidence**: `ActivityServiceImpl.java:103-105` (the `if (type == null)` branch) + `ActivityServiceImpl.java:114` (`case ALL -> fetchAllActivities(...)`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-022 (NEW — view-modes-as-single-parameter dispatch) describes the enum-dispatch shape; this scope is the implementation gap.
  - **Proposed remedy**: Either (a) remove the `if (type == null)` branch and let the switch handle null via `default ->` (which currently does nothing — would require explicit null handling); (b) add `if (type == null) type = ActivityType.ALL` at the start; (c) reject `type=null` at the controller with `@NotNull` (breaking change, requires OpenAPI update).
  - **Severity rationale**: MEDIUM — defence-in-depth gap on a security-relevant code path.

**Discriminating context**: `ActivityServiceImpl.java:103-105` has `if (type == null) { return fetchAllActivities(...) }` BEFORE the four-arm switch; the switch's `case ALL ->` ALSO routes to `fetchAllActivities`. There are two paths to the same destination. A future refactor that adds owner-scoping to the `ALL` enum case (e.g., to address REFACTOR-053 partially) would silently bypass the new gate when callers omit the `type` parameter. Defence-in-depth requires either collapsing the two branches OR asserting `type != null` at the controller layer.

**Full detail**: `detail/REFACTOR-059.md`

---

## REFACTOR-060 — `userIds` and `ownerIds` filter parameters on `getActivity` are not validated — submission of arbitrary id lists allows enumeration of which users/owners have generated platform activity in a window

**Severity**: MEDIUM
**Category**: enumeration-vector
**Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[2]` (MEDIUM)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[2]` (MEDIUM)
  - **Statement**: `ActivityController.java:30-31` accepts `List<Long> ownerIds` and `List<Long> userIds` with no validation that the IDs reference existing users/owners. A caller can submit `userIds=[1,2,3,...,N]` to probe which users have generated platform activity in the window — a low-cost user-id enumeration vector. The response shape (empty vs. populated Flux) distinguishes valid-and-active from invalid-or-inactive users. No rate limit on `/api/activity` — an attacker can sweep id ranges quickly.
  - **Evidence**: `ActivityController.java:30-31` + `ActivityServiceImpl.java:179-181` (parameters threaded through unchanged)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: At minimum, add `@Size(max = 100)` on the list parameters to bound batch enumeration. Add per-endpoint rate-limit. Optionally, add a server-side check that the caller has a relationship to each requested user/owner (e.g., admin-only, or scoped to the caller's owner set).
  - **Severity rationale**: MEDIUM — enumeration vector; combines with REFACTOR-053 (cross-owner exposure) for full audit-trail discovery.

**Discriminating context**: `ActivityController.java:30-31` accepts `List<Long> ownerIds` and `List<Long> userIds` with no validation that the IDs reference existing users/owners. A caller can submit `userIds=[1,2,3,...,N]` to probe which users have generated platform activity in the window — a low-cost user-id enumeration vector. The response shape (empty vs. populated Flux) distinguishes valid-and-active from invalid-or-inactive users. No rate limit on `/api/activity` — an attacker can sweep id ranges quickly.

**Full detail**: `detail/REFACTOR-060.md`

---

## REFACTOR-062 — Token-rotation response body returns the new plaintext token without `Cache-Control: no-store` or other sensitive-body headers — every reverse-proxy / API-gateway / browser-history / response-logging middleware between UI and backend records the credential

**Severity**: MEDIUM
**Category**: response-cache-leak
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[3]` (MEDIUM)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[0]` (MEDIUM)
  - **Statement**: `CollectorController.java:50` returns the rotated Collector via `.map(ResponseEntity::ok)` with NO response-header customisation. The new plaintext token is in the body. Any logging / caching / proxying middleware on the response path captures the credential. No header marks the body as sensitive (no `Cache-Control: no-store`, no custom `X-Sensitive-Body` signal for downstream tooling).
  - **Evidence**: `CollectorController.java:50` + `TokenMapper.java:15-18` (plaintext returned when showToken=true)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (token rotation semantics) requires returning plaintext on rotate (the user has no other way to learn the secret); the ADR does NOT defend the absence of cache/log-prevention headers — those are a gap-shape orthogonal to the rotation model.
  - **Proposed remedy**: Add `Cache-Control: no-store, no-cache, must-revalidate` and `Pragma: no-cache` to the rotation response. Optionally add a custom `X-Sensitive-Body: token` advisory header for downstream log-redaction tooling. Document on the live `enable-security` page that operators should redact response bodies for `PUT /api/collectors/*/token` in any logging tier.
  - **Severity rationale**: MEDIUM — credential exposure via standard middleware behaviour.

**Discriminating context**: `CollectorController.java:50` returns the rotated Collector via `.map(ResponseEntity::ok)` with NO response-header customisation. The new plaintext token is in the body. Any logging / caching / proxying middleware on the response path captures the credential. No header marks the body as sensitive (no `Cache-Control: no-store`, no custom `X-Sensitive-Body` signal for downstream tooling).

**Full detail**: `detail/REFACTOR-062.md`

---

## REFACTOR-063 — No rate-limit on token rotation endpoint — attacker with a stolen MANAGEMENT-permission session can rotate every collector's token in a tight loop, breaking platform-wide ingestion

**Severity**: MEDIUM
**Category**: missing-rate-limit
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[5]` (MEDIUM)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[6]` (MEDIUM)
  - **Statement**: `CollectorController.java:47-51` carries no `@RateLimited` annotation; `SecurityConstants.java:135-137` has no rate-limit metadata on the SecurityRule; there is no programmatic throttle. An attacker who has stolen a valid session of a user with `COLLECTOR_TOKEN_REGENERATE` permission can rotate every collector's token in a tight loop. Combined with REFACTOR-047 (no grace period), this breaks platform-wide ingestion within a single attacker request burst.
  - **Evidence**: `CollectorController.java:47-51` (no `@RateLimited`) + `SecurityConstants.java:135-137` (no throttle metadata)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add Bucket4j rate-limit on the rotation endpoint (e.g., 10 rotations/minute/user, 100 rotations/minute platform-wide). Expose `collector.token.rotation-rate-limit` properties for operators.
  - **Severity rationale**: MEDIUM — DoS amplifier when combined with stolen credentials.

**Discriminating context**: `CollectorController.java:47-51` carries no `@RateLimited` annotation; `SecurityConstants.java:135-137` has no rate-limit metadata on the SecurityRule; there is no programmatic throttle. An attacker who has stolen a valid session of a user with `COLLECTOR_TOKEN_REGENERATE` permission can rotate every collector's token in a tight loop. Combined with REFACTOR-047 (no grace period), this breaks platform-wide ingestion within a single attacker request burst.

**Full detail**: `detail/REFACTOR-063.md`

---

## REFACTOR-064 — `CollectorServiceImpl.regenerateToken` is NOT `@ReactiveTransactional` — inconsistent with sibling `create` / `update` / `delete` methods on the same service

**Severity**: LOW
**Category**: transactional-consistency
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[2]` (LOW)
  - **Statement**: `CollectorServiceImpl.java:82-90` has no `@ReactiveTransactional` (compare with `create`, `update`, `delete` at lines 38, 51, 72 — all annotated). The current rotation is a single DB UPDATE so a transaction boundary is not strictly required for atomicity, but the absence is inconsistent. If a future change adds an audit-log insert (REFACTOR-046) or a notification dispatch, the developer must remember to add the annotation; a forgotten annotation produces silent partial-failure (token rotated but audit row not written, or vice-versa).
  - **Evidence**: `CollectorServiceImpl.java:82-90` (no `@ReactiveTransactional`) vs lines 38, 51, 72 (annotated)
  - **Existing-ADR-or-implied-prescription**: None directly. Implicit convention: every mutating service method is `@ReactiveTransactional` (the sibling methods establish this).
  - **Proposed remedy**: Add `@ReactiveTransactional` to `regenerateToken`. The change is no-op for the current single-UPDATE shape; sets up the convention for future additions.
  - **Severity rationale**: LOW — defensive consistency.

**Discriminating context**: `CollectorServiceImpl.java:82-90` has no `@ReactiveTransactional` (compare with `create`, `update`, `delete` at lines 38, 51, 72 — all annotated). The current rotation is a single DB UPDATE so a transaction boundary is not strictly required for atomicity, but the absence is inconsistent. If a future change adds an audit-log insert (REFACTOR-046) or a notification dispatch, the developer must remember to add the annotation; a forgotten annotation produces silent partial-failure (token rotated but audit row not written, or vice-versa).

**Full detail**: `detail/REFACTOR-064.md`

---

## REFACTOR-069 — `@Value("${auth.type}")` at `AppInfoController.java:18` declares NO default; empty-string env override (`AUTH_TYPE=`) or typo (`OUATH2`) silently breaks downstream `@ConditionalOnProperty` matches AND echoes the broken value back in the `AppInfo.authType` response

**Severity**: MEDIUM
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[0]` (severity MEDIUM)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:security.known_security_gaps.[1]` + `security.known_security_gaps.[2]` (severity LOW per sidecar — operator action required but no fail-fast guardrail)
  - **Statement**: `AppInfoController.java:18` carries `@Value("${auth.type}")` with no `:DISABLED` default. An operator overriding `auth.type` to an empty string (env var unset to empty, removed YAML key, etc.) or to a typo value (e.g. `OUATH2`, `LOGINFORM`) silently produces: (a) AppInfoController constructs with empty string / typo string; (b) every downstream `@ConditionalOnProperty(value="auth.type", havingValue="...")` fails to match; (c) NO `SecurityWebFilterChain` bean is wired; (d) Spring Boot's `ReactiveSecurityAutoConfiguration` autoconfigures a permit-all default chain — the platform boots unauthenticated; (e) `/api/appInfo` echoes the empty/typo value back to SPA clients (which have no rendering rule for it). The `application.yml:34` default `DISABLED` saves the bundled deployment from this; an operator who unsets the key on purpose hits the undocumented failure mode. The cross-cutting fix is REFACTOR-073 (boot-time security-posture validator).
  - **Evidence**: `AppInfoController.java:18` (no `:default`) + `AuthorizationManagerCondition.java:11,15` + `DisabledAuthSecurityConfiguration.java:10` + `LoginFormSecurityConfiguration.java:31` + `OAuthSecurityConfiguration.java:71` + `LDAPSecurityConfiguration.java:51` (none use `matchIfMissing`) + `application.yml:34` (default DISABLED)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-024 (NEW — AppInfo auth-mode introspection contract) prescribes the `@Value` reporter pattern; the absence of a default is the implementation gap, not the contract. REFACTOR-073 is the cross-cutting fix that subsumes this.
  - **Proposed remedy**: At minimum, add `:DISABLED` default to the `@Value` (`@Value("${auth.type:DISABLED}")`) so empty-string overrides resolve consistently. Better: add validation per REFACTOR-073's `SecurityPostureValidator` recommendation. Best: define `auth.type` as an enum in `@ConfigurationProperties` with `@NotNull` + `@Validated`.
  - **Severity rationale**: MEDIUM — operator-error gated; the bundled default prevents it, but an operator unsetting the key hits an undocumented failure mode.

**Discriminating context**: `AppInfoController.java:18` carries `@Value("${auth.type}")` with no `:DISABLED` default. An operator overriding `auth.type` to an empty string (env var unset to empty, removed YAML key, etc.) or to a typo value (e.g. `OUATH2`, `LOGINFORM`) silently produces: (a) AppInfoController constructs with empty string / typo string; (b) every downstream `@ConditionalOnProperty(value="auth.type", havingValue="...")` fails to match; (c) NO `SecurityWebFilterChain` bean is wired; (d) Spring Boot's `ReactiveSecurityAutoConfiguration` autoconfigures a permit-all default chain — the platform boots…

**Full detail**: `detail/REFACTOR-069.md`

---

## REFACTOR-071 — `AuthorizationManagerCondition` is dead code — no class in the repository references it via `@Conditional(AuthorizationManagerCondition.class)` or any other consumer mechanism; the Condition class is vestigial

**Severity**: MEDIUM
**Category**: dead-code
**Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:bugs_limitations_corner_cases.[0]` (severity MEDIUM)
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:security.known_security_gaps.[0]` (severity MEDIUM)
  - **Statement**: Verified via `Bash grep -rln "AuthorizationManagerCondition" <odd-platform> --include="*.java"` on 2026-05-10 — only the file's own path is returned. The authorization-manager wiring it appears designed to gate is in practice carried out by direct per-config `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` and `havingValue="LDAP"` annotations on `OAuthSecurityConfiguration.java:71` and `LDAPSecurityConfiguration.java:51`, each of which independently instantiates `new AuthorizationCustomizer(...)` inside its `SecurityWebFilterChain` bean. The Condition class is therefore vestigial — either the original consumer was refactored out (history not accessible) or it was added in anticipation of a consumer that never landed. Risk: a future maintainer reading the Condition class would reasonably assume it gates the authorization-manager wiring path and rely on it; the wiring would silently fail because nothing actually consults the Condition.
  - **Evidence**: `AuthorizationManagerCondition.java:1-18` (file body) + `OAuthSecurityConfiguration.java:71` (direct `@ConditionalOnProperty`) + `LDAPSecurityConfiguration.java:51` (direct `@ConditionalOnProperty`) + grep on 2026-05-10
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-025 (NEW 2026-05-10B — AnyNestedCondition idiom) confirms the idiom is alive elsewhere (SlackMessageGeneratorCondition). The IDIOM is sound; this specific INSTANCE is dead. The ADR does NOT defend the dead-code; the IDIOM is captured for the SlackMessageGeneratorCondition use, not for this one.
  - **Proposed remedy**: Either (a) delete `AuthorizationManagerCondition.java` and let the per-config `@ConditionalOnProperty` annotations be the canonical wiring (no behaviour change; reduces source-code mass and removes the misleading file); OR (b) wire `AuthorizationManagerCondition` into the authorization-customizer registration (would centralise the OAUTH2 OR LDAP disjunction — change to `@Conditional(AuthorizationManagerCondition.class)` on a new `AuthorizationCustomizerConfiguration` that holds the per-config bean shared logic). Option (a) is the simpler safe fix; option (b) is the larger architectural unification.
  - **Severity rationale**: MEDIUM — code-hygiene + future-maintainer trap. The dead code IS the warning; deleting it removes the trap. Combined with REFACTOR-072 (LOGIN_FORM bypasses AuthorizationCustomizer entirely), the maintainer should triage whether the intent was always to OR-gate OAUTH2/LDAP-only authorization or to extend to LOGIN_FORM.

**Discriminating context**: Verified via `Bash grep -rln "AuthorizationManagerCondition" <odd-platform> --include="*.java"` on 2026-05-10 — only the file's own path is returned. The authorization-manager wiring it appears designed to gate is in practice carried out by direct per-config `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` and `havingValue="LDAP"` annotations on `OAuthSecurityConfiguration.java:71` and `LDAPSecurityConfiguration.java:51`, each of which independently instantiates `new AuthorizationCustomizer(...)` inside its `SecurityWebFilterChain` bean. The Condition class is therefore…

**Full detail**: `detail/REFACTOR-071.md`

---

## REFACTOR-075 — Metric labels propagated verbatim from ingestion payload to Prometheus proto label list — no allowlist, no sanitisation, no PII filter; an ingested metric with `user_email=...` or `dataset_owner_email=...` labels writes them verbatim to the operator's Prometheus

**Severity**: MEDIUM
**Category**: missing-sanitisation
**Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:security.known_security_gaps.[1]` (severity MEDIUM)
  - **Statement**: `AbstractTimeSeriesExtractor.java:30` calls `mapper.mapToProtoLabels(labels)` with no allowlist, no sanitisation, no PII redaction. If a collector ingests a metric whose labels carry PII or tenant-identifying user values, that PII is written verbatim to the operator's Prometheus and becomes readable to every operator/team with access to the Prometheus UI. The platform's role as a "thin proxy" for Prometheus remote-write is well-defined; the absence of label sanitisation is consistent with that thin-proxy stance, but the absence is not codified in any ADR — it falls under the same category as ADR-CANDIDATE-005's GenAI thin-proxy decision (the thin-proxy stance defends absence of prompt engineering, NOT absence of basic safety).
  - **Evidence**: `AbstractTimeSeriesExtractor.java:30-31` (straight pass-through via `mapper.mapToProtoLabels(labels)`)
  - **Existing-ADR-or-implied-prescription**: None directly. ADR-CANDIDATE-026 (NEW 2026-05-10B) describes the metric-storage wiring; ADR-CANDIDATE-005 (GenAI thin-proxy) is the closest precedent — thin-proxy defends scope-boundary but not safety primitives.
  - **Proposed remedy**: At minimum, document on the live `/configuration-and-deployment/odd-platform` page that metric labels are forwarded verbatim and operators should ensure ingestion-side collectors don't emit PII as labels. At maximum, add an optional `metrics.prometheus.label-allowlist` (regex or string list) that filters labels before write — operators opt in by setting the list.
  - **Severity rationale**: MEDIUM — PII pass-through to a separate operational system (Prometheus); cardinality risk is implicit but secondary.

**Discriminating context**: `AbstractTimeSeriesExtractor.java:30` calls `mapper.mapToProtoLabels(labels)` with no allowlist, no sanitisation, no PII redaction. If a collector ingests a metric whose labels carry PII or tenant-identifying user values, that PII is written verbatim to the operator's Prometheus and becomes readable to every operator/team with access to the Prometheus UI. The platform's role as a "thin proxy" for Prometheus remote-write is well-defined; the absence of label sanitisation is consistent with that thin-proxy stance, but the absence is not codified in any ADR — it falls under the same category as…

**Full detail**: `detail/REFACTOR-075.md`

---

## REFACTOR-076 — No retry / backoff / DLQ on Prometheus `/api/v1/write` failures — `onErrorMap` rethrows as `PrometheusException` and the entire ingestion request fails; transient Prometheus outage (rolling restart, network blip) loses the batch

**Severity**: MEDIUM
**Category**: missing-retry
**Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:performance.known_performance_gaps.[0]` (severity MEDIUM)
  - **Statement**: `ExternalIngestionMetricsServiceImpl.java:206-219` has `.onErrorMap(e -> ... throw new PrometheusException(e))` with NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `metrics.prometheus-host` produces an immediate 5xx to the calling collector; the collector must retry from outside. There is no in-memory queue, no Postgres fallback, no eventual-consistency mechanism. A Prometheus rolling restart drops every concurrent metric write.
  - **Evidence**: `ExternalIngestionMetricsServiceImpl.java:206-219` (no retry operator)
  - **Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-026 (NEW — metric storage mirrored wiring) does NOT defend retry-absence; retry is request-routing reliability, not part of the wiring choice.
  - **Proposed remedy**: Add `.retryWhen(Retry.backoff(maxAttempts, minBackoff).filter(this::isTransient))` on the WebClient call; expose `metrics.prometheus.retry.max-attempts` (default 3) and `metrics.prometheus.retry.min-backoff-millis` (default 200). Document on the live config-doc page.
  - **Severity rationale**: MEDIUM — a single transient upstream blip surfaces as ingestion failure for every concurrent collector.

**Discriminating context**: `ExternalIngestionMetricsServiceImpl.java:206-219` has `.onErrorMap(e -> ... throw new PrometheusException(e))` with NO `.retry(...)` / `.retryWhen(...)`. A transient network blip on the way to `metrics.prometheus-host` produces an immediate 5xx to the calling collector; the collector must retry from outside. There is no in-memory queue, no Postgres fallback, no eventual-consistency mechanism. A Prometheus rolling restart drops every concurrent metric write.

**Full detail**: `detail/REFACTOR-076.md`

---

## REFACTOR-077 — `IllegalArgumentException` on missing `counterValue.getTotal()` aborts the entire ingestion batch — no per-point isolation; one malformed counter rejects every co-batched metric for every DataEntity in the request

**Severity**: MEDIUM
**Category**: batch-isolation
**Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:bugs_limitations_corner_cases.[2]` (severity MEDIUM)
  - **Statement**: `CounterTimeSeriesExtractor.java:38-40` throws `IllegalArgumentException("Counter value is null")` when `counterValue.getTotal() == null`. The exception escapes `ExternalIngestionMetricsServiceImpl.writeRequest()` (lines 222-251) which iterates over every MetricFamily / Metric / MetricPoint in the request body — one bad point in a batch aborts the entire batch's `saveMetricsToPrometheus` chain, rejecting metrics for every co-batched DataEntity. There is no per-point try/catch, no per-extractor isolation, no `Flux.concatMapDelayError` to continue past failure.
  - **Evidence**: `CounterTimeSeriesExtractor.java:38-40` + `ExternalIngestionMetricsServiceImpl.java:222-251` (no per-extractor try/catch)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-026 (NEW) describes the per-MetricType dispatch but does NOT defend the absence of per-point isolation.
  - **Proposed remedy**: Wrap the per-MetricPoint extraction in try/catch within `writeRequest`; collect failed points as a "rejected" list returned to the caller (with structured error details); proceed with the rest of the batch. Add a Micrometer counter for rejected points.
  - **Severity rationale**: MEDIUM — operational hostility on a batch-ingestion path; a single misconfigured collector poisons the entire ingestion stream.

**Discriminating context**: `CounterTimeSeriesExtractor.java:38-40` throws `IllegalArgumentException("Counter value is null")` when `counterValue.getTotal() == null`. The exception escapes `ExternalIngestionMetricsServiceImpl.writeRequest()` (lines 222-251) which iterates over every MetricFamily / Metric / MetricPoint in the request body — one bad point in a batch aborts the entire batch's `saveMetricsToPrometheus` chain, rejecting metrics for every co-batched DataEntity. There is no per-point try/catch, no per-extractor isolation, no `Flux.concatMapDelayError` to continue past failure.

**Full detail**: `detail/REFACTOR-077.md`

---

## REFACTOR-079 — Plaintext-equality token comparison on the ingestion filter — `String.equals(...)` is not constant-time; timing-based token discovery is theoretically feasible on a local network

**Severity**: MEDIUM
**Category**: missing-constant-time
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[2]` (severity MEDIUM)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[1]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:56` compares the inbound token to the in-DB value via `String.equals(...)` — NOT `MessageDigest.isEqual(...)`. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle of constant-time secret comparison is violated. The sibling `S2sAuthenticationFilter` has the same issue (`s2sTokenProvider.isValidToken(...)` against a YAML-configured `auth.s2s.token`). NOTE: this scope **strengthens REFACTOR-048** (token plaintext-at-rest) from the verify side — the storage shape (REFACTOR-048) and the comparison shape (REFACTOR-079) compose ADR-CANDIDATE-017's full plaintext-equality model.
  - **Evidence**: `IngestionDataEntitiesFilter.java:56` (`.equals(...)`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (token rotation semantics) codifies plaintext-equality as the model; the ADR's rationale ("long-random over TLS") implicitly accepts that timing attacks are not the primary concern. This scope is a defence-in-depth gap within the deliberate model — fixing it does NOT alter the architectural decision.
  - **Proposed remedy**: Replace `.equals(...)` with `MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8))` in BOTH `IngestionDataEntitiesFilter.java:56` AND `S2sTokenProvider.isValidToken`. Add a unit test asserting constant-time semantics under adversarial input. No ADR change required.
  - **Severity rationale**: MEDIUM — defence-in-depth gap on the credential-comparison surface.

**Discriminating context**: `IngestionDataEntitiesFilter.java:56` compares the inbound token to the in-DB value via `String.equals(...)` — NOT `MessageDigest.isEqual(...)`. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle of constant-time secret comparison is violated. The sibling `S2sAuthenticationFilter` has the same issue (`s2sTokenProvider.isValidToken(...)` against a YAML-configured `auth.s2s.token`). NOTE: this scope **strengthens REFACTOR-048** (token plaintext-at-rest) from the verify side — the storage shape (REFACTOR-048) and the…

**Full detail**: `detail/REFACTOR-079.md`

---

## REFACTOR-080 — Hard-coded path matcher in `IngestionDataEntitiesFilter` — `/ingestion/entities` exact, no `/**` suffix; future addition of `POST /ingestion/entities/batch` or `/v2` would bypass the filter silently

**Severity**: MEDIUM
**Category**: hard-coded-path
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[3]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:28` passes the literal string `"/ingestion/entities"` (exact match, no wildcard, no `/**`) to the path-matcher constructor. There is no test, no comment, no `@docs` annotation pinning the path. A future addition of `POST /ingestion/entities/batch` (batch ingestion) or `POST /ingestion/entities/v2` (versioned API) would bypass the filter without any compile-time signal — the new endpoint would inherit the `/ingestion/**` whitelist and the catch-all permit-all behaviour.
  - **Evidence**: `IngestionDataEntitiesFilter.java:28` (literal string `"/ingestion/entities"`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 (NEW — ingestion-endpoint auth trust gradient) codifies hard-coded-per-subclass as the deliberate pattern (matcher-in-constructor); the ADR does NOT defend the absence of forward-compatibility guards.
  - **Proposed remedy**: Add an integration test that asserts every `IngestionApi`-generated `@RequestMapping` matching `/ingestion/entities*` is covered by some filter; fail the build on uncovered paths. Alternative: change the matcher to `/ingestion/entities/**` (more inclusive) — but this introduces a breaking change if new sub-paths under `/ingestion/entities/` should have DIFFERENT auth postures.
  - **Severity rationale**: MEDIUM — future-regression risk on a security-load-bearing path.

**Discriminating context**: `IngestionDataEntitiesFilter.java:28` passes the literal string `"/ingestion/entities"` (exact match, no wildcard, no `/**`) to the path-matcher constructor. There is no test, no comment, no `@docs` annotation pinning the path. A future addition of `POST /ingestion/entities/batch` (batch ingestion) or `POST /ingestion/entities/v2` (versioned API) would bypass the filter without any compile-time signal — the new endpoint would inherit the `/ingestion/**` whitelist and the catch-all permit-all behaviour.

**Full detail**: `detail/REFACTOR-080.md`

---

## REFACTOR-081 — Body-buffered-before-auth-check — `IngestionDataEntitiesFilter` reads the full request body into memory (up to 20 MB) BEFORE validating the token, allowing low-effort heap-pressure DoS via invalid-token + max-size payload

**Severity**: MEDIUM
**Category**: body-before-auth
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[5]` (severity MEDIUM)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[4]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:37-40` calls `super.getBody().collectList()` which buffers the entire body, then `readBody(dataBuffer, DataEntityList.class)` parses it to extract `dataSourceOddrn`, THEN the token is validated against the resolved datasource. An attacker submitting maximum-size 20 MB payloads with invalid tokens forces the platform to buffer + parse the body before rejecting. The order is body-first because the dataSourceOddrn determines WHICH token to compare against. A 20-attacker concurrent burst with max-size payloads holds 400 MB in heap during validation.
  - **Evidence**: `IngestionDataEntitiesFilter.java:37-60` (body-first ordering) + `application.yml:14-15` (`spring.codec.max-in-memory-size: 20MB`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 (NEW — ingestion-endpoint auth trust gradient) codifies the per-subclass filter pattern; the ADR does NOT defend the body-first ordering.
  - **Proposed remedy**: Reorder to (1) parse the `Authorization` header first; (2) require a fast-extractable identity from the header itself (e.g., a `X-DataSource-Oddrn` companion header sent by collectors); (3) validate the token against the named datasource WITHOUT reading the body; (4) THEN parse the body and continue. Alternative: add a smaller pre-check buffer cap (e.g. 1 MB) on the ingestion path specifically — invalid tokens reject after buffering 1 MB instead of 20 MB.
  - **Severity rationale**: MEDIUM — heap-pressure DoS amplifier on an unauthenticated-by-default path (REFACTOR-078).

**Discriminating context**: `IngestionDataEntitiesFilter.java:37-40` calls `super.getBody().collectList()` which buffers the entire body, then `readBody(dataBuffer, DataEntityList.class)` parses it to extract `dataSourceOddrn`, THEN the token is validated against the resolved datasource. An attacker submitting maximum-size 20 MB payloads with invalid tokens forces the platform to buffer + parse the body before rejecting. The order is body-first because the dataSourceOddrn determines WHICH token to compare against. A 20-attacker concurrent burst with max-size payloads holds 400 MB in heap during validation.

**Full detail**: `detail/REFACTOR-081.md`

---

## REFACTOR-083 — Failed-auth attempts on the ingestion filter are not logged — no `log.*` call on the 401 path, no metric counter, no rate-limit, no lockout

**Severity**: MEDIUM
**Category**: missing-audit
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[7]` (severity MEDIUM)
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:security.known_security_gaps.[2]` (severity MEDIUM)
  - **Statement**: When a token mismatch occurs, `IngestionDataEntitiesFilter.java:55-58` throws `AccessDeniedException("Token is not correct")` and `AbstractIngestionFilter.java:66-72`'s `writeResponse` returns the message verbatim — but neither path emits a log statement. A security incident review of "how many failed-auth attempts in the last hour against the ingestion endpoint" cannot be answered from application logs. There is no rate-limit / lockout / metric counter on the failure path. Same shape as REFACTOR-046 (no token rotation audit log) — investigation-readiness gap.
  - **Evidence**: `IngestionDataEntitiesFilter.java:55-58` (throw, no log) + `AbstractIngestionFilter.java:34-41` (no log on filter-match path) + `AbstractIngestionFilter.java:66-72` (writeResponse, no log)
  - **Existing-ADR-or-implied-prescription**: None defends the absence.
  - **Proposed remedy**: Add `log.warn("[ingestion-auth] failed-auth attempt from remoteAddress={} path={} reason={}", ...)` on both the missing-header and wrong-token paths in `AbstractIngestionFilter`. Add Micrometer counters `ingestion.auth.failure_total{reason}` (reason ∈ {`missing_header`, `wrong_token`, `unknown_datasource`}). Optionally: add a rate-limit on failed attempts per remote IP (e.g. 10 failures/minute/IP → temporary 429).
  - **Severity rationale**: MEDIUM — investigation-readiness gap on a security-critical path.

**Discriminating context**: When a token mismatch occurs, `IngestionDataEntitiesFilter.java:55-58` throws `AccessDeniedException("Token is not correct")` and `AbstractIngestionFilter.java:66-72`'s `writeResponse` returns the message verbatim — but neither path emits a log statement. A security incident review of "how many failed-auth attempts in the last hour against the ingestion endpoint" cannot be answered from application logs. There is no rate-limit / lockout / metric counter on the failure path. Same shape as REFACTOR-046 (no token rotation audit log) — investigation-readiness gap.

**Full detail**: `detail/REFACTOR-083.md`

---

## REFACTOR-084 — Duplicate body parse — filter materialises `DataEntityList` from bytes to extract `dataSourceOddrn`, then the controller's `Mono<DataEntityList>` binding re-deserialises the same payload

**Severity**: MEDIUM
**Category**: duplicate-parse
**Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:performance.known_performance_gaps.[0]` (severity MEDIUM)
  - **Statement**: `IngestionDataEntitiesFilter.java:40` deserialises the entire body to `DataEntityList` purely to extract `dataSourceOddrn`; the controller (`IngestionController.java:38`) then re-parses the same bytes into `Mono<DataEntityList>`. A per-request `O(payload-size)` Jackson parse is performed twice — non-trivial on a high-throughput ingestion path. A streaming JSON extraction of just the `dataSourceOddrn` field (e.g. via `JsonParser` walking to that key only) would avoid the duplicate parse.
  - **Evidence**: `IngestionDataEntitiesFilter.java:40` (full deserialise) + `IngestionController.java:38-44` (controller re-parses)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Replace `readBody(dataBuffer, DataEntityList.class)` in the filter with a streaming-JSON extraction of just `dataSourceOddrn`. Optionally: cache the parsed `DataEntityList` in the `ServerWebExchange.attributes` so the controller reuses it instead of re-parsing.
  - **Severity rationale**: MEDIUM — performance gap on a high-throughput ingestion path.

**Discriminating context**: `IngestionDataEntitiesFilter.java:40` deserialises the entire body to `DataEntityList` purely to extract `dataSourceOddrn`; the controller (`IngestionController.java:38`) then re-parses the same bytes into `Mono<DataEntityList>`. A per-request `O(payload-size)` Jackson parse is performed twice — non-trivial on a high-throughput ingestion path. A streaming JSON extraction of just the `dataSourceOddrn` field (e.g. via `JsonParser` walking to that key only) would avoid the duplicate parse.

**Full detail**: `detail/REFACTOR-084.md`

---

## REFACTOR-087 — No `@Min(1)` validation on `odd.activity.partition-period` — `0` produces no-partition-creation silently (no rows can INSERT); negative values produce invalid `endDate < beginDate` CREATE

**Severity**: MEDIUM
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM)
  - **Statement**: `ActivityTablePartitionManager.java:11` carries `@Value("${odd.activity.partition-period:30}")` with no `@Min(1)` / `@Positive` validation. A `partition-period=0` boot would: (a) compute `bufferDate = baseline.plusDays(0)` = baseline; (b) the `while (lastPartitionDate.isBefore(bufferDate))` predicate evaluates `baseline.isBefore(baseline)` = false; (c) NO partition is created. Rows arriving for `INSERT INTO activity` would be REJECTED by Postgres with `no partition of relation "activity" found for row` — a silent operator misconfiguration produces a hard-fail INSERT path with no boot-time validation error. A negative value would attempt to CREATE a partition with `endDate < beginDate`, rejected by Postgres at CREATE time and logged at ERROR (then swallowed per REFACTOR-086).
  - **Evidence**: `ActivityTablePartitionManager.java:11` (no `@Min` / `@Positive`) + `AbstractPartitionManager.java:30,33-37` (the bufferDate + while-loop arithmetic)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW — range-partition lifecycle) does NOT defend the absence of validation.
  - **Proposed remedy**: Either add `@Positive` to the consumer (`@Positive @Value("${odd.activity.partition-period:30}")`) — requires `@Validated` at class level; OR migrate to `@ConfigurationProperties` POJO with `@Validated` + `@Positive`. Same applies to `MessageTablePartitionManager` (`datacollaboration.message-partition-period`).
  - **Severity rationale**: MEDIUM — operator-error gated; the default value saves the bundled deployment.

**Discriminating context**: `ActivityTablePartitionManager.java:11` carries `@Value("${odd.activity.partition-period:30}")` with no `@Min(1)` / `@Positive` validation. A `partition-period=0` boot would: (a) compute `bufferDate = baseline.plusDays(0)` = baseline; (b) the `while (lastPartitionDate.isBefore(bufferDate))` predicate evaluates `baseline.isBefore(baseline)` = false; (c) NO partition is created. Rows arriving for `INSERT INTO activity` would be REJECTED by Postgres with `no partition of relation "activity" found for row` — a silent operator misconfiguration produces a hard-fail INSERT path with no boot-time…

**Full detail**: `detail/REFACTOR-087.md`

---

## REFACTOR-089 — No Micrometer / observability instrumentation on the partition lifecycle — manager emits `log.debug` on success and `log.error` on failure; no counter, no timer, no gauge for partition-creation success-rate / last-success-timestamp / partition-count

**Severity**: MEDIUM
**Category**: observability
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:performance.known_performance_gaps.[1]` (severity MEDIUM)
  - **Statement**: `AbstractPartitionManager.java:43-44` emits `log.debug` on success (debug level — not captured by default in production logging configuration). `PostgreSQLPartitionCreationJob.java:58-59` emits `log.error` on failure (captured but not actionable without alerting). Grep of the partition package for `MeterRegistry|Counter|Timer|Gauge` returns zero matches. An operator monitoring an ODD deployment has no metric to alert on "partition creation has been failing silently for 30 days." This is essentially the same gap as REFACTOR-086 but specifically about Micrometer observability instrumentation as opposed to the continue-on-failure orchestration; REFACTOR-086 is the orchestration-level gap; REFACTOR-089 is the metric-instrumentation gap.
  - **Evidence**: `AbstractPartitionManager.java:43-44` (debug-only log) + `PostgreSQLPartitionCreationJob.java:58-59` (error log only) + grep zero matches for Micrometer types
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) codifies the continue-on-failure orchestration but does NOT defend the absence of observability; the architectural choice prioritises maximum coverage and CAN coexist with full observability.
  - **Proposed remedy**: Same as REFACTOR-086 — add Micrometer counters/timers/gauges. Adopt as a project-wide convention via a `@PartitionLifecycle` meta-annotation or a `MeterBinder` in the partition package.
  - **Severity rationale**: MEDIUM — observability gap.

**Discriminating context**: `AbstractPartitionManager.java:43-44` emits `log.debug` on success (debug level — not captured by default in production logging configuration). `PostgreSQLPartitionCreationJob.java:58-59` emits `log.error` on failure (captured but not actionable without alerting). Grep of the partition package for `MeterRegistry|Counter|Timer|Gauge` returns zero matches. An operator monitoring an ODD deployment has no metric to alert on "partition creation has been failing silently for 30 days." This is essentially the same gap as REFACTOR-086 but specifically about Micrometer observability instrumentation as…

**Full detail**: `detail/REFACTOR-089.md`

---

## REFACTOR-090 — Partition creation requires CREATE TABLE privilege on `public` schema for the application's DB role — the deployment doc does not surface this requirement; least-privileged DB roles silently degrade

**Severity**: MEDIUM
**Category**: missing-doc-prereq
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:security.known_security_gaps.[0]` (severity MEDIUM)
  - **Statement**: `PartitionServiceImpl.java:55-69` executes `CREATE TABLE IF NOT EXISTS %s PARTITION OF %s` DDL. The application's DB role must have CREATE privilege on the `public` schema to succeed. The live `/configuration-and-deployment/odd-platform` page documents the partition-period config key but does NOT enumerate DB role privilege requirements for partitioning. An operator running ODD against a managed Postgres with a least-privileged DB role (INSERT/SELECT but no DDL) would fail partition creation at boot, log ERROR (REFACTOR-086 swallows it), and silently degrade — `activity` INSERTs would then fail when the existing partition window is exhausted.
  - **Evidence**: `PartitionServiceImpl.java:55-69` (CREATE TABLE DDL) + WebFetch of `/configuration-and-deployment/odd-platform` on 2026-05-10 (status 200, no role-privilege requirements section)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) does not address DB-role prerequisites.
  - **Proposed remedy**: Document on the live `/configuration-and-deployment/odd-platform` page a "Required PostgreSQL role privileges" section enumerating: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables; **`CREATE` on `public` schema (for range-partition lifecycle)**; `USAGE` on sequences; etc. Optionally add a boot-time validator (REFACTOR-073's `SecurityPostureValidator` can subsume this) that probes `current_setting('is_superuser')` + `has_schema_privilege('public', 'CREATE')` and emits a clear error.
  - **Severity rationale**: MEDIUM — deployment-pre-req documentation gap with security-policy implications.

**Discriminating context**: `PartitionServiceImpl.java:55-69` executes `CREATE TABLE IF NOT EXISTS %s PARTITION OF %s` DDL. The application's DB role must have CREATE privilege on the `public` schema to succeed. The live `/configuration-and-deployment/odd-platform` page documents the partition-period config key but does NOT enumerate DB role privilege requirements for partitioning. An operator running ODD against a managed Postgres with a least-privileged DB role (INSERT/SELECT but no DDL) would fail partition creation at boot, log ERROR (REFACTOR-086 swallows it), and silently degrade — `activity` INSERTs would then…

**Full detail**: `detail/REFACTOR-090.md`

---

## REFACTOR-066 — Slack delivery sender is single-leader across the deployment via Postgres advisory lock — horizontal scaling does NOT increase Slack throughput; Discussions feature is bounded at ~1 msg/sec by fixed 1s sleep between iterations

**Severity**: MEDIUM
**Category**: observability (capacity-planning)
**Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:performance.scaling_characteristics`
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:performance.known_performance_gaps.[0]` (LOW per sidecar, surfaced as MEDIUM here for capacity-planning visibility)
  - **Statement**: The sender thread is single-leader across the deployment via Postgres advisory lock id 120 (default). Horizontal scaling of the API process does NOT linearly scale Slack delivery — only one node ever holds the lock and drains the queue. The sender loop's polling cadence is fixed at 1 second between empty queue checks (`DataCollaborationMessageSenderJob.java:70`); under low volume, this is ~1s of fixed end-to-end latency from `202 Accepted` to Slack delivery. Under high volume, retries (1-second sleep in the catch block — line 60) further serialise throughput. A backlog of 1000 messages takes >16 minutes to drain at best.
  - **Evidence**: `DataCollaborationMessageSenderJob.java:60, 70, 93-95` + `DataCollaborationProperties.java:10`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled-outbound-delivery) describes the single-leader-via-advisory-lock shape. This scope is the structural consequence; the ADR's Postgres-as-only-dependency rationale defends the choice. The maintainer should document the throughput characteristics on the live `data-collaboration` page as a capacity-planning consideration.
  - **Proposed remedy**: At minimum, document on the live `data-collaboration` page that Discussions throughput is bounded at ~1 msg/sec and scales with sender-loop tuning, NOT with horizontal scaling of the API tier. Optionally, add a configurable `datacollaboration.sender.poll-interval-millis` (default 1000) and `datacollaboration.sender.batch-size` (default 1) for operators willing to tune.
  - **Severity rationale**: MEDIUM — capacity-planning gap; operators sizing the platform for Discussions usage have no documented limit.

**Discriminating context**: The sender thread is single-leader across the deployment via Postgres advisory lock id 120 (default). Horizontal scaling of the API process does NOT linearly scale Slack delivery — only one node ever holds the lock and drains the queue. The sender loop's polling cadence is fixed at 1 second between empty queue checks (`DataCollaborationMessageSenderJob.java:70`); under low volume, this is ~1s of fixed end-to-end latency from `202 Accepted` to Slack delivery. Under high volume, retries (1-second sleep in the catch block — line 60) further serialise throughput. A backlog of 1000 messages takes…

**Full detail**: `detail/REFACTOR-066.md`

---

## REFACTOR-093 — No boot-time WARN logged when `auth.type=DISABLED` activates — `DisabledAuthSecurityConfiguration.java:1-19` contains no `@Slf4j`, no logger field, no startup log telling operators the deployment is unauthenticated. Operators inheriting an unmodified container image silently get DISABLED with no boot signal

**Severity**: MEDIUM
**Category**: missing-warn-log

**Discriminating context**: `DisabledAuthSecurityConfiguration` lacks both `@Slf4j` annotation and any `log.warn(...)` call. Contrast with `LDAPSecurityConfiguration.java:56` which IS `@Slf4j`. The platform boots silently into the permit-all chain. An operator who inherits the default ODD container image (with `auth.type=DISABLED` shipped) cannot tell from logs that the deployment is unauthenticated.

**Full detail**: `detail/REFACTOR-093.md`

---

## REFACTOR-094 — S2S filter silently ignored under DISABLED — `auth.s2s.enabled=true` is read by LoginForm/OAuth/LDAP modes but NOT by `DisabledAuthSecurityConfiguration`. An operator setting `auth.s2s.enabled=true` thinking it overlays additional protection on top of DISABLED gets no warning that the filter is unwired

**Severity**: MEDIUM
**Category**: silent-feature-ignored

**Discriminating context**: `DisabledAuthSecurityConfiguration.java:13-18` does not read `auth.s2s.enabled` and does not register `S2sAuthenticationFilter`. The property is silently accepted with no error, no warning. Because DISABLED is also `permitAll()`, the misconfiguration is undetectable until the operator switches to a non-DISABLED mode. The live S2S docs do not document this DISABLED+S2S interaction. The composition stance (ADR-CANDIDATE-032) is for the 3 interactive modes; DISABLED is the explicit absence — but the absence is not surfaced.

**Full detail**: `detail/REFACTOR-094.md`

---

## REFACTOR-096 — Actuator endpoints (`/actuator/{health,prometheus,env,info}`) reachable unauthenticated under DISABLED on the same HTTP port as the application; `.anyExchange().permitAll()` does not narrow by path and `SecurityConstants.WHITELIST_PATHS` lists `/actuator/**` regardless of mode

**Severity**: MEDIUM
**Category**: missing-actuator-gating

**Discriminating context**: Under DISABLED, `.anyExchange().permitAll()` at `DisabledAuthSecurityConfiguration.java:16` exposes every path including `/actuator/**`. Spring's default masking applies to property values matching `password|secret|key|token`, but property NAMES (the config shape) are still disclosed via `/actuator/env`. The live `disabled-authentication` page does not warn about this. Combined with REFACTOR-117 (LDAP password leak via same mechanism) and REFACTOR-103 (LOGIN_FORM credentials leak), the actuator-on-app-port + permitAll combination is a cross-mode gap.

**Full detail**: `detail/REFACTOR-096.md`

---

## REFACTOR-097 — No audit logging infrastructure exists in `<odd-platform-api>/src/main/java` — grep for `AuditLog | @Auditable | AuthLogger | accessLog` returned zero matches on 2026-05-12. Under DISABLED specifically, an attacker reaching the platform can read every endpoint with no audit trail

**Severity**: MEDIUM
**Category**: missing-audit

**Discriminating context**: The codebase has no audit-logging infrastructure (no `AuditLog`, `@Auditable`, `AuthLogger`, `accessLog` classes/annotations). Spring's access-log configuration is also not enabled by default at INFO level (`application.yml:247-250` configures `logging.level` for `spring.transaction` and JOOQ tools, not the access log). The gap is codebase-wide, not DISABLED-specific; DISABLED amplifies the consequence (an attacker leaves no recorded principal because there is no recorded principal AND no recorded request).

**Full detail**: `detail/REFACTOR-097.md`

---

## REFACTOR-098 — Missing-key behaviour on `auth.type` — none of the four `*SecurityConfiguration` classes uses `matchIfMissing=true`. An operator who unsets `auth.type` (empty via `AUTH_TYPE=` or by removing the key from a customised `application.yml`) gets NO bean from any of the four; Spring Boot's reactive-security autoconfiguration fallback applies — non-deterministic depending on classpath

**Severity**: MEDIUM
**Category**: missing-fail-fast

**Discriminating context**: `DisabledAuthSecurityConfiguration.java:10` + `LoginFormSecurityConfiguration.java:31` + `OAuthSecurityConfiguration.java:71` + `LDAPSecurityConfiguration.java:51` all use `@ConditionalOnProperty(value="auth.type", havingValue="...")` WITHOUT `matchIfMissing=true`. If an operator unsets the property (override-customising `application.yml` without re-adding it, or setting `AUTH_TYPE=` empty), NONE of the four registers. Spring Boot's reactive-security autoconfiguration then falls back depending on classpath — runtime behaviour, not statically determinable. The shipped `application.yml:34`…

**Full detail**: `detail/REFACTOR-098.md`

---

## REFACTOR-100 — `auth.login-form-redirect` is an open-redirect surface — no validation, no allowlist; `URI.create(redirectUri)` accepts any string; `DefaultServerRedirectStrategy.sendRedirect` invokes it verbatim. The live docs do not mention this property's safety implications

**Severity**: MEDIUM
**Category**: open-redirect

**Discriminating context**: `LoginFormSecurityConfiguration.java:41` reads the raw string with `@Value("${auth.login-form-redirect:}")`; line 89 invokes `URI.create(redirectUri)` without validating scheme / host / path; line 46 invokes `new DefaultServerRedirectStrategy().sendRedirect(...)` with the resulting URI. The redirect target is whatever the operator placed in configuration — in a deployment where this value comes from a templated source (helm chart, env-var substitution, Kubernetes ConfigMap), there is no boundary that rejects an attacker-controlled value. The fetched docs page does not mention…

**Full detail**: `detail/REFACTOR-100.md`

---

## REFACTOR-102 — LOGIN_FORM credential string parsing fragile — line 75 splits on `,` (no quoting/escaping), line 99 splits on `:` (takes only first two segments). A username containing `,` is silently split; a password containing `:` is silently truncated; empty-password throws AIOOBE

**Severity**: MEDIUM
**Category**: fragile-parsing

**Discriminating context**: `LoginFormSecurityConfiguration.java:73-83` splits credentials by `,` then `:`. Edge cases: (a) username with `,` is silently split into two credentials; (b) password with `:` is silently truncated at the first `:`; (c) password with `,` silently split into a username:password pair plus a partial; (d) empty password (`user:` followed by nothing) throws `ArrayIndexOutOfBoundsException` at line 99 — fail-loud only for empty-password. Combined with plain-text storage, this raises typo risk; operators may ship credentials they did NOT intend.

**Full detail**: `detail/REFACTOR-102.md`

---

## REFACTOR-103 — Plain-text LOGIN_FORM credentials in `auth.login-form-credentials` are recoverable via `/actuator/env` — same mechanism as REFACTOR-117 (LDAP password leak). Combined with the unauthenticated `/actuator/health` permit in LOGIN_FORM mode (line 50) and `endpoint.env.enabled: true` shipped default

**Severity**: MEDIUM
**Category**: credential-leak

**Discriminating context**: `auth.login-form-credentials` is resolved at boot into a plain `String` and parsed into the `MapReactiveUserDetailsService`. The plain-text value is in Spring's environment cache. If the operator exposes `/actuator/env` (the bundled `application.yml:226-240` ships with `env`, `prometheus`, `info`, `health` in the exposure list and `management.endpoint.env.enabled: true`), the credentials value is recoverable. Spring's default masking masks the value (the property name contains `credentials` which is in Spring's default mask list — partial mitigation), but the masking is name-based and…

**Full detail**: `detail/REFACTOR-103.md`

---

## REFACTOR-104 — LOGIN_FORM session cookie has no `Secure` / `HttpOnly` / `SameSite` configured at the SecurityWebFilterChain layer; `spring.session.timeout: -1` makes sessions never expire. A cookie compromised on HTTP (or via XSS — note CSRF disabled too) is valid until JVM restart, with no revocation mechanism

**Severity**: MEDIUM
**Category**: session-cookie-flags

**Discriminating context**: `LoginFormSecurityConfiguration.java:53-66` does not configure `HttpOnly`, `Secure`, `SameSite`, or session timeout via the chain. Cookie attributes come from Spring's WebFlux defaults + `spring.session.timeout: -1` in `application.yml:3` (no expiry — sessions live forever). The live docs note "does not support rotation, session revocation, or MFA". A compromised session cookie is valid until the user clears it or the JVM restarts.

**Full detail**: `detail/REFACTOR-104.md`

---

## REFACTOR-105 — CSRF disabled on the session-cookie-based auth mode (LOGIN_FORM) — `LoginFormSecurityConfiguration.java:54` unconditionally calls `.csrf(disable)`. A logged-in user visiting a malicious page can have state-changing requests issued via their session cookie without CSRF protection

**Severity**: MEDIUM
**Category**: missing-csrf

**Discriminating context**: LOGIN_FORM is a session-based authentication mode where CSRF is the canonical defense vector for state-changing requests (POST/PUT/DELETE/PATCH). Line 54 disables CSRF unconditionally. A logged-in user visiting `evil.example.com` can have their browser issue authenticated state-changing requests to the platform via the session cookie. Combined with REFACTOR-104 (no SameSite cookie flag), CSRF protection is the canonical answer that has been removed without explanation.

**Full detail**: `detail/REFACTOR-105.md`

---

## REFACTOR-111 — No OAuth2 failure handler registered — `.oauth2Login(withDefaults())` uses Spring's default failure URL `/login?error`; the Thymeleaf login template renders only a generic `error` flag from the query param. Specific failure causes (denied scope, invalid token, provider unreachable, expired code) are not surfaced. For operators debugging IdP misconfiguration, this is poor signal-to-noise

**Severity**: MEDIUM
**Category**: no-failure-handler

**Discriminating context**: `OAuthSecurityConfiguration.java:99` calls `.oauth2Login(withDefaults())` — no `.authenticationFailureHandler(...)` is registered. The Thymeleaf login template (`oauth2_login.html`) reads `error` from query params (line 251) and renders a generic indicator. The specific failure reason is not surfaced. Operators debugging IdP misconfigurations rely on Spring Security's default logger output.

**Full detail**: `detail/REFACTOR-111.md`

---

## REFACTOR-112 — Azure `logoutUri` unchecked at `@PostConstruct` despite live OAuth2/OIDC docs flagging it as required — `ODDOAuth2Properties.validate()` checks only `clientId` and `provider`; `logoutUri` is unchecked. An operator deploying Azure without `logout-uri` boots successfully and fails at first logout (presumably NPE in `AzureLogoutSuccessHandler`)

**Severity**: MEDIUM
**Category**: missing-validation

**Discriminating context**: `ODDOAuth2Properties.validate()` at lines 17-28 checks `clientId` and `provider` non-empty but NOT `logoutUri`. The live OAuth2/OIDC docs (WebFetched 2026-05-12) state Azure `logout-uri` is required — "unset value causes NullPointerException". The platform boots cleanly with an unset Azure logoutUri and fails at first logout. Fail-fast was applied to clientId + provider; the same posture was not extended to logoutUri.

**Full detail**: `detail/REFACTOR-112.md`

---

## REFACTOR-114 — OAuth2 session storage uses Spring's default `WebSession` (in-memory per JVM). For multi-replica deployments without sticky sessions / shared session store, a user's OAuth2 token is tied to whichever pod handled the initial callback — subsequent requests routed elsewhere force re-prompting. No doc surface

**Severity**: MEDIUM
**Category**: no-multi-replica-session

**Discriminating context**: `OAuthSecurityConfiguration.java:1-269` has no `@EnableSpringWebSession` / Redis session store / sticky-session configuration. For HA deployments, this is a sharp edge with no doc surface. The shipped `application.yml:30` carries `session.provider: IN_MEMORY` — confirming the no-shared-store posture.

**Full detail**: `detail/REFACTOR-114.md`

---

## REFACTOR-115 — `ODDOAuth2Properties.OAuth2Provider` lacks `azureTenantId` field — `application.yml:128-156` commented-out Azure example references `${auth.oauth2.client.azure.azure-tenant-id}` interpolation, which Spring would fail to bind if uncommented as-is. Docs YAML not deployable verbatim

**Severity**: MEDIUM
**Category**: doc-code-drift

**Discriminating context**: `ODDOAuth2Properties.OAuth2Provider` (lines 32-52) has no `azureTenantId` field. The commented Azure example in `application.yml:128-156` references `${auth.oauth2.client.azure.azure-tenant-id}` interpolation. An operator uncommenting the example AS-IS hits a Spring bind failure at startup. Workaround: inline tenant ID into `issuer-uri` directly.

**Full detail**: `detail/REFACTOR-115.md`

---

## REFACTOR-120 — Empty/null `auth.ldap.groups.admin-groups` + `auth.s2s.enabled=false` = NO LDAP path to ADMIN — every authenticated LDAP user assigned only `USER` role, and no S2S admin shortcut available. Every ADMIN-gated endpoint in `SecurityConstants.SECURITY_RULES` is unreachable. The live LDAP docs do not name this consequence

**Severity**: MEDIUM
**Category**: no-admin-path

**Discriminating context**: When `auth.ldap.groups` is null OR `admin-groups` is empty (the application.yml default — the entire `groups` block is commented out), every authenticated LDAP user is assigned only `USER` role (`LDAPSecurityConfiguration.java:91-93`). The ONLY path to ADMIN in such a deployment is via S2S API key (`S2sAuthenticationFilter.java:31-39` hard-codes ADMIN + ADMIN role on token match). An operator who configures LDAP without `admin-groups` and without S2S has a deployment with NO admins.

**Full detail**: `detail/REFACTOR-120.md`

---

## REFACTOR-121 — `LdapTemplate.setIgnoreSizeLimitExceededException(true)` silently truncates group-membership queries that exceed the directory's size limit. An admin user whose group-membership row falls past the cutoff is silently demoted to USER on login. No log, no alert

**Severity**: MEDIUM
**Category**: size-limit-silent-trunc

**Discriminating context**: `LDAPSecurityConfiguration.java:131` sets `ignoreSizeLimitExceededException(true)` — group-membership queries that hit directory size limits truncate silently. An admin user past the cutoff is demoted to USER. Combined with REFACTOR-119 (`containsIgnoreCase` substring-collision), the resulting authority set under truncation is non-deterministic.

**Full detail**: `detail/REFACTOR-121.md`

---

## REFACTOR-125 — No boot-time LDAP URL reachability test — `ODDLDAPProperties.validate()` only checks the URL string is non-empty. The first failure surfaces at end-user login attempt (a generic 401), not at startup. An operator who mistypes the URL or whose LDAP server is down boots successfully and 401s every login

**Severity**: MEDIUM
**Category**: missing-validation

**Discriminating context**: `ODDLDAPProperties.validate()` (lines 42-49) only checks the URL string is non-empty. `LDAPSecurityConfiguration.java:117-124` has no try/catch around the connection open. `management.health.ldap.enabled: false` is the bundled default — `/actuator/health` does NOT include LDAP-server reachability. Combined, an LDAP misconfiguration is invisible until first login.

**Full detail**: `detail/REFACTOR-125.md`

---

## REFACTOR-126 — `AuthIdentityProviderImpl.getCurrentUser()` returns `UserDto(username, null)` for LDAP-authenticated users; switching `auth.type` from OAUTH2 to LDAP (or vice versa) breaks owner-mapping rows that include provider tag. No migration tool, no doc warning

**Severity**: MEDIUM
**Category**: owner-mapping-drift

**Discriminating context**: `AuthIdentityProviderImpl.java:24-35` returns `UserDto(username, null)` for LDAP users — the OAuth2 branch on line 29 does not match. `userOwnerMappingRepository.getAssociatedOwner(user.username(), null)` (line 52) is then used. Any owner-mapping row created under OAuth2 (`provider='okta'`) will NOT match an LDAP login of the same username; conversely, LDAP-issued owner mappings (`provider=null`) won't match an OAuth2 login. No migration tool exists.

**Full detail**: `detail/REFACTOR-126.md`

---

## REFACTOR-133 — Notifications advisory-lock-id collision risk — `notifications.wal.advisory-lock-id` defaults to 100 (distinct from partition=90, dc-receive=110, dc-send=120 in shipped defaults). Operators customising any of these to 100 cause silent subsystem collision

**Severity**: MEDIUM
**Category**: advisory-lock-collision

**Discriminating context**: The shipped advisory-lock-id namespace (90 partition / 100 notifications / 110 dc-receive / 120 dc-send) is collision-free, but the four ids are operator-configurable independently and silently collide if reused. The Notifications subscriber will never get leadership (or will collide with another subsystem). No boot-time check rejects collisions.

**Full detail**: `detail/REFACTOR-133.md`

---

## REFACTOR-134 — No per-channel routing — Notifications fan-out delivers to ALL configured channels for ALL alerts. Operators wanting "only Critical alerts to Slack, all alerts to email" or "scope channel-X to namespace-Y" cannot express this in config

**Severity**: MEDIUM
**Category**: no-channel-filter

**Discriminating context**: `AlertNotificationMessageProcessor.java:25-36` iterates `List<NotificationSender>` unconditionally for every `AlertNotificationMessage`. No filter / predicate / config key for routing exists. Cross-tenant / multi-team deployments cannot scope notifications to the owning team — every channel gets every alert.

**Full detail**: `detail/REFACTOR-134.md`

---

## REFACTOR-135 — Webhook delivery is single-shot, NO signing, NO shared-secret, NO HMAC. The receiving endpoint cannot verify webhook origin — an attacker who scrapes the webhook URL can spoof ODD-originated alerts

**Severity**: MEDIUM
**Category**: unsigned-webhook

**Discriminating context**: `WebhookNotificationSender.java:18-23` issues `HttpRequest.newBuilder().uri(webhookUrl).POST(...)` with no Auth header, no signature header, no HMAC. The receiving endpoint cannot distinguish a genuine ODD webhook from a forged one. Industry-standard solutions (Stripe-style HMAC-SHA256 with shared secret) are not implemented.

**Full detail**: `detail/REFACTOR-135.md`

---

## REFACTOR-137 — No structured audit log of notifications sent — only `log.debug(...)` at DEBUG level. No `notification_delivery` table, no metric counter, no Prometheus gauge. Operators cannot answer 'when did notifications last work?' or 'which alert IDs were delivered to which channels?'

**Severity**: MEDIUM
**Category**: missing-audit

**Discriminating context**: `AlertNotificationMessageProcessor.java:28` only emits `log.debug("Sending notification message via {}: {}", ...)` — DEBUG-level, not INFO. Production deployments running at INFO level get no notification audit signal. No DB-resident table records per-alert-per-channel outcomes. No Micrometer counter increments per delivery. Operators have no way to retrospectively verify delivery.

**Full detail**: `detail/REFACTOR-137.md`

---

## REFACTOR-138 — PII surface in notification payloads — `AlertNotificationMessage` carries `dataEntity.{name, dataSourceName, namespaceName}`, `owners[].ownerName`, lineage entities. If data entity / owner names contain operator-supplied free-text (descriptions, table names encoding customer identifiers), it's rendered verbatim into Slack/webhook/email

**Severity**: MEDIUM
**Category**: pii-disclosure

**Discriminating context**: `AlertNotificationMessageTranslator.java:73-83` populates the full `AlertNotificationMessage` from DB columns; `email.ftlh` template renders into HTML body; Slack/webhook serialise into JSON. No redaction, no allowlist. For organisations whose dataset names encode customer identifiers, this is a privacy concern.

**Full detail**: `detail/REFACTOR-138.md`

---

## REFACTOR-139 — Replication-slot orphan risk on rename — `notifications.wal.replication-slot-name` rename between deployments without dropping the old slot causes Postgres to retain WAL indefinitely for the orphan, risking primary disk exhaustion. The live doc warns about manual cleanup but does not warn about rename-orphan specifically

**Severity**: MEDIUM
**Category**: replication-slot-orphan

**Discriminating context**: `NotificationSubscriber.java:99-122` lazy-creates the replication slot if absent — but never drops it on rename. Operators renaming the slot between deployments leave the old slot orphaned. Postgres retains WAL for unused slots indefinitely, risking primary disk fill. The live notifications doc page warns about manual cleanup but not rename-orphan.

**Full detail**: `detail/REFACTOR-139.md`

---

## REFACTOR-143 — No structured audit log or Micrometer metric on housekeeping deletions — all three jobs emit `log.debug("... deleted N rows ...")` only. Production logging defaults drop DEBUG-level lines; operators cannot answer "how much did housekeeping delete yesterday" without query-the-DB-after-the-fact

**Severity**: MEDIUM
**Category**: missing-audit
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[4]` (MEDIUM) + `security.known_security_gaps.[0]` ("No tamper-evident audit log of housekeeping deletions")
  - **Statement**: `AlertHousekeepingJob.java:45`, `SearchFacetsHousekeepingJob.java:29`, `DataEntityHousekeepingJob.java:128` all emit `log.debug("... deleted N rows ...")` only. No structured `@ActivityLog`, no Prometheus counter (`housekeeping_deleted_total{table=...}`), no audit-event table. Production logging configurations typically drop DEBUG; the deletion volume is operator-invisible. Worse: a compliance investigation for "show me the deleted resolved alerts from 2025-12" cannot be satisfied — no archival, no record of what was deleted, only an INFO/DEBUG count.
  - **Evidence**: `AlertHousekeepingJob.java:45` + `SearchFacetsHousekeepingJob.java:29` + `DataEntityHousekeepingJob.java:128` + grep of `housekeeping/` for `@ActivityLog | Counter | Meter` returning zero matches
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-045 (housekeeping-vs-partition separation) is the design but does not address observability. REFACTOR-097 (no audit logging codebase-wide) is the cross-cutting equivalent — housekeeping is one specific surface where the gap matters more.
  - **Proposed remedy**: Add Micrometer counters per job: `housekeepingJob.deletedRows.counter().tag("table", "alert").increment(deletedResolvedAlerts)`. Add a structured audit event (Spring `ApplicationEventPublisher` → `HousekeepingCycleEvent{table, cutoff, deletedCount}`) that operators can subscribe to via a custom `@EventListener`. Promote `log.debug` to `log.info` so production logging captures the count at the default level.
  - **Severity rationale**: MEDIUM — operability + compliance gap; the absence of observability on data-destructive operations is the canonical "we made the change but nobody saw it" failure mode.

**Discriminating context**: `AlertHousekeepingJob.java:45`, `SearchFacetsHousekeepingJob.java:29`, `DataEntityHousekeepingJob.java:128` all emit `log.debug("... deleted N rows ...")` only. No structured `@ActivityLog`, no Prometheus counter (`housekeeping_deleted_total{table=...}`), no audit-event table. Production logging configurations typically drop DEBUG; the deletion volume is operator-invisible. Worse: a compliance investigation for "show me the deleted resolved alerts from 2025-12" cannot be satisfied — no archival, no record of what was deleted, only an INFO/DEBUG count.

**Full detail**: `detail/REFACTOR-143.md`

---

## REFACTOR-145 — `DataEntityHousekeepingJob.deleteFiles` calls `fileUploadService.deleteFiles(filePojos).block()` inside a jOOQ transaction — MinIO/S3 outage (LSN-002-shape region misconfig, network partition, credential rotation) either hangs indefinitely (no explicit timeout) or throws, taking the surrounding jOOQ transaction with it. The transaction wraps the ENTIRE ~25-table cascade; one failed S3 delete rolls back ALL the cleanup for that batch

**Severity**: MEDIUM
**Category**: block-in-transaction
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[6]` (MEDIUM)
  - **Statement**: `DataEntityHousekeepingJob.java:142` reactively calls `fileUploadService.deleteFiles(filePojos).block()` while wrapped inside the surrounding jOOQ transaction at `DataEntityHousekeepingJob.java:71` (`DSL.using(connection).transaction(ctx -> {...})`). The transaction encompasses the entire ~25-table cascade. If MinIO/S3 is unreachable: (a) the `block()` either hangs indefinitely (no explicit timeout) or throws; (b) the throw propagates up and aborts the jOOQ transaction, rolling back ALL the cleanup for that batch of data entities; (c) the next 15-minute cycle retries the entire batch; (d) if the failure is persistent (e.g. wrong S3 region), data entities accumulate in DELETED status indefinitely while housekeeping silently fails each cycle (only `log.error` at `HousekeepingJobManager.java:45` surfaces it).
  - **Evidence**: `DataEntityHousekeepingJob.java:142` (`.block()` call) + `DataEntityHousekeepingJob.java:71` (surrounding transaction) + `HousekeepingJobManager.java:41-47` (outer catch/log.error)
  - **Existing-ADR-or-implied-prescription**: None defends the block-in-transaction pattern. ADR-CANDIDATE-012 (attachment storage `@ConditionalOnProperty`) is adjacent — the storage backend choice (LOCAL vs REMOTE) is what triggers the LSN-002 region-misconfig failure mode on REMOTE.
  - **Proposed remedy**: Refactor `DataEntityHousekeepingJob.deleteFiles` to perform S3 deletes OUTSIDE the jOOQ transaction: (a) collect file pojos to delete inside the transaction; (b) commit the transaction (the data-entity rows are now soft-deleted but the files persist temporarily); (c) call `fileUploadService.deleteFiles(filePojos)` in a separate non-transactional context with an explicit timeout (`Duration.ofSeconds(30)`). On S3-failure, log + retry-budget instead of rolling back the cleanup. Alternative: pre-fetch the file pojos, delete the data-entity row, and SCHEDULE the file delete via a separate background queue.
  - **Severity rationale**: MEDIUM — interacts with LSN-002 shape (REMOTE S3 misconfig) + housekeeping's 15-min cadence to produce a silent-fail-loud-in-logs deployment where soft-deleted data entities never fully purge. The failure-mode-blast-radius is per-deployment but persistent.

**Discriminating context**: `DataEntityHousekeepingJob.java:142` reactively calls `fileUploadService.deleteFiles(filePojos).block()` while wrapped inside the surrounding jOOQ transaction at `DataEntityHousekeepingJob.java:71` (`DSL.using(connection).transaction(ctx -> {...})`). The transaction encompasses the entire ~25-table cascade. If MinIO/S3 is unreachable: (a) the `block()` either hangs indefinitely (no explicit timeout) or throws; (b) the throw propagates up and aborts the jOOQ transaction, rolling back ALL the cleanup for that batch of data entities; (c) the next 15-minute cycle retries the entire batch; (d) if…

**Full detail**: `detail/REFACTOR-145.md`

---

## REFACTOR-146 — No dry-run / preview / backup-before-delete mechanism in housekeeping — the three TTL jobs hard-DELETE without any operator-overridable safeguard. No `housekeeping.dry-run=true` mode, no `housekeeping.ttl.backup-table` archival, no `--reload-config` style operator gate. A misconfigured `housekeeping.ttl.data_entity_delete_days=1` immediately cascades through ~25 tables on the next 15-minute cycle with no recovery path

**Severity**: MEDIUM
**Category**: no-dryrun
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:security.known_security_gaps.[1]` (MEDIUM — "operator-error blast radius — the LSN-001 shape applies")
  - **Statement**: `HousekeepingJobManager.java:25-39` runs the housekeeping jobs unconditionally — no dry-run check before `housekeepingJob.doHousekeeping(connection)`. `AlertHousekeepingJob.java:40-43` issues the actual DELETE without archival. `DataEntityHousekeepingJob.java:99-126` runs the cascaded DELETE sequence without archival. A typo'd `housekeeping.ttl.data_entity_delete_days=1` is irreversible after the next 15-minute cycle. Combined with REFACTOR-141 (primitive-default-leak), the operator-error blast radius is LSN-001 shape: silent misconfig produces production-class data loss with no recovery.
  - **Evidence**: `HousekeepingJobManager.java:25-39` (no dry-run check) + `AlertHousekeepingJob.java:40-43` + `DataEntityHousekeepingJob.java:99-126` (DELETE sequences)
  - **Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-045 (housekeeping-vs-partition separation) is the design context; the gap is orthogonal.
  - **Proposed remedy**: Add `housekeeping.dry-run: boolean` (default false). When true, jobs LOG the rows they would DELETE but do not commit. Operators can deploy `dry-run=true` first, inspect logs, then flip to false. Alternative: add `housekeeping.ttl.minimum-days: int` (default 7) as a floor — `validate()` rejects `< minimum-days` for any TTL — preventing the typo-=-1 case at boot.
  - **Severity rationale**: MEDIUM — operator-error blast radius for a destructive subsystem. The LSN-001 shape applies; combined with REFACTOR-141 the blast radius is significant.

**Discriminating context**: `HousekeepingJobManager.java:25-39` runs the housekeeping jobs unconditionally — no dry-run check before `housekeepingJob.doHousekeeping(connection)`. `AlertHousekeepingJob.java:40-43` issues the actual DELETE without archival. `DataEntityHousekeepingJob.java:99-126` runs the cascaded DELETE sequence without archival. A typo'd `housekeeping.ttl.data_entity_delete_days=1` is irreversible after the next 15-minute cycle. Combined with REFACTOR-141 (primitive-default-leak), the operator-error blast radius is LSN-001 shape: silent misconfig produces production-class data loss with no recovery.

**Full detail**: `detail/REFACTOR-146.md`

---

## REFACTOR-150 — No `messageDays` retention field for the DataCollaboration `MESSAGE` table — symmetric to the activity-feed retention absence (REFACTOR-085). `MessageEmptyPartitionsHousekeepingJob` (`housekeeping/job/MessageEmptyPartitionsHousekeepingJob.java:12-25`) only drops EMPTY past partitions; there is no time-based retention for messages — operators running DataCollaboration with high message-throughput accumulate messages indefinitely

**Severity**: MEDIUM
**Category**: missing-retention
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[1]` (MEDIUM — "DataCollaboration is feature-flagged off by default — limited blast radius — but operators who enable it inherit silent unbounded growth")
  - **Statement**: `HousekeepingTTLProperties.java:8-12` declares three fields (resolvedAlertsDays, searchFacetsDays, dataEntityDeleteDays) and there is no fourth field for the `MESSAGE` table. `MessageEmptyPartitionsHousekeepingJob.java:18-21` only drops empty past partitions (no row-delete-by-age). For DataCollaboration deployments with high message-throughput (busy Slack channels), the MESSAGE table grows monotonically. The live `/configuration-and-deployment/odd-platform` docs page does not surface this. Pairs with REFACTOR-085 (activity-feed retention absence) as the second "no time-based retention" surface in the platform.
  - **Evidence**: `HousekeepingTTLProperties.java:8-12` (no message field) + `MessageEmptyPartitionsHousekeepingJob.java:18-21` (only empty-partition-drop, no row-delete-by-age)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-019 (DataCollaboration disabled-by-default) limits the blast radius but does NOT defend the absent retention. ADR-CANDIDATE-046 (housekeeping opt-out by shipped default) is the surface where this gap would live if it were addressed — adding `messageDays` to `HousekeepingTTLProperties` extends the opt-out's coverage.
  - **Proposed remedy**: Add `private int messageDays = 30;` field to `HousekeepingTTLProperties.java`. Create a new `MessageHousekeepingJob extends HousekeepingJob` that deletes MESSAGE rows older than the TTL (similar shape to `AlertHousekeepingJob`). Doc-side: update the live docs to enumerate the message-retention behaviour with the new TTL knob.
  - **Severity rationale**: MEDIUM — DataCollaboration opt-in feature; high-volume deployments inherit silent unbounded growth. Pairs with REFACTOR-085 (same shape on activity table) for the cross-subsystem retention gap.

**Discriminating context**: `HousekeepingTTLProperties.java:8-12` declares three fields (resolvedAlertsDays, searchFacetsDays, dataEntityDeleteDays) and there is no fourth field for the `MESSAGE` table. `MessageEmptyPartitionsHousekeepingJob.java:18-21` only drops empty past partitions (no row-delete-by-age). For DataCollaboration deployments with high message-throughput (busy Slack channels), the MESSAGE table grows monotonically. The live `/configuration-and-deployment/odd-platform` docs page does not surface this. Pairs with REFACTOR-085 (activity-feed retention absence) as the second "no time-based retention"…

**Full detail**: `detail/REFACTOR-150.md`

---

## REFACTOR-154 — OAuth2 `provider` field is a free `String` rather than `Provider` enum. A typo like `provder: google` binds cleanly, fails every consumer-side `equalsIgnoreCase(Provider.X.name())` check, and silently routes through generic-OIDC with no provider-specific user enrichment (no GitHub admin-group lookup, no Google allowed-domain enforcement, no Cognito/Azure logout)

**Severity**: MEDIUM
**Category**: provider-conditional-unvalidated
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:bugs_limitations_corner_cases.[2]` (MEDIUM) + `security.known_security_gaps.[2]` (MEDIUM)
  - **Statement**: `ODDOAuth2Properties.java:32` declares `private String provider;` — a free String. The downstream consumer enum comparison happens via `equalsIgnoreCase(Provider.X.name())` at every routing site. A typo `provder: google` binds, fails every `equalsIgnoreCase` check, routes through generic OIDC with NO provider-specific enrichment. The validator does NOT enforce enum membership. This is the architectural counterpart to ADR-CANDIDATE-047 (Map-keyed schema) — the schema is extensible by design but the provider key is unconstrained.
  - **Evidence**: `ODDOAuth2Properties.java:32` (free String) + `Provider.java:3-5` (the unreferenced enum) + `OAuthSecurityConfiguration.java:168` + every `*UserHandler.shouldHandle` consumer (consistent `equalsIgnoreCase` pattern with no fallback warning) + `ODDOAuth2Properties.java:16-28` (validator does not check enum membership)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-047 (Map-keyed schema) intentionally trades type-safety for extensibility — but the trade is on the MAP KEY (registrationId), not the PROVIDER value. The provider field could have been a typed enum without compromising map extensibility. ADR-CANDIDATE-048 (narrow-validator scope) defers semantic correctness to runtime — but enum-membership is a structural fault, not a semantic one.
  - **Proposed remedy**: Add an `@Pattern(regexp = "(?i)(GOOGLE|GITHUB|COGNITO|AZURE|ODD_IAM|OKTA|KEYCLOAK)")` or extend the validator with: `if (!Stream.of(Provider.values()).map(Provider::name).anyMatch(name -> name.equalsIgnoreCase(provider.getProvider()))) throw new IllegalStateException("Provider '" + provider.getProvider() + "' is not a recognised provider. Supported: GOOGLE | GITHUB | COGNITO | AZURE | ODD_IAM. For generic OIDC use 'OIDC'.")`. The fix preserves the Map-keyed schema's extensibility while catching the typo-on-provider case.
  - **Severity rationale**: MEDIUM — operator-trap on typo + silent functionality regression (provider-specific enrichment silently disabled). The blast radius is per-misconfigured-client.

**Discriminating context**: `ODDOAuth2Properties.java:32` declares `private String provider;` — a free String. The downstream consumer enum comparison happens via `equalsIgnoreCase(Provider.X.name())` at every routing site. A typo `provder: google` binds, fails every `equalsIgnoreCase` check, routes through generic OIDC with NO provider-specific enrichment. The validator does NOT enforce enum membership. This is the architectural counterpart to ADR-CANDIDATE-047 (Map-keyed schema) — the schema is extensible by design but the provider key is unconstrained.

**Full detail**: `detail/REFACTOR-154.md`

---

## REFACTOR-160 — `ActiveDirectory.domain` unvalidated when `ActiveDirectory.enabled=true` — `ODDLDAPProperties.validate()` does NOT check `enabled=true` implies `domain` non-empty. The downstream consumer at `LDAPSecurityConfiguration.java:78` constructs `new ActiveDirectoryLdapAuthenticationProvider(null, url)`. Spring Security accepts this but the operator's intended AD-bind semantics are silently bypassed

**Severity**: MEDIUM
**Category**: ad-domain-unvalidated
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDLDAPProperties.md:bugs_limitations_corner_cases.[3]` (MEDIUM) + `security.known_security_gaps.[3]` (MEDIUM)
  - **Statement**: ADR-CANDIDATE-037 (LDAP Active Directory as dedicated branch) is wired via `if (properties.getActiveDirectory() != null && properties.getActiveDirectory().isEnabled())`. The constructor `ActiveDirectoryLdapAuthenticationProvider(domain, url)` accepts null `domain` — falling back to non-domain UPN bind. The Properties-class validator at `ODDLDAPProperties.java:40-49` does NOT check `enabled=true XOR domain.nonEmpty`. Operator configures `auth.ldap.active-directory.enabled: true` without `domain` → boot succeeds → AD-bind semantics silently bypassed. This is the price of ADR-CANDIDATE-048 (narrow-validator scope) applied to a cross-field invariant.
  - **Evidence**: `ODDLDAPProperties.java:35-38` (ActiveDirectory nested class) + `ODDLDAPProperties.java:40-49` (validator does not check `enabled XOR domain`) + `LDAPSecurityConfiguration.java:76-83` (consumer constructs `new ActiveDirectoryLdapAuthenticationProvider(properties.getActiveDirectory().getDomain(), properties.getUrl())`)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-037 (AD-as-dedicated-branch) is the design; ADR-CANDIDATE-048 (narrow-validator scope) is the gap-shaping context. The fix extends the validator with a cross-field invariant.
  - **Proposed remedy**: Extend `ODDLDAPProperties.validate()`: `if (activeDirectory != null && activeDirectory.isEnabled() && StringUtils.isEmpty(activeDirectory.getDomain())) { throw new IllegalStateException("auth.ldap.active-directory.enabled=true requires auth.ldap.active-directory.domain"); }`.
  - **Severity rationale**: MEDIUM — AD-deploying operator-error trap; silent fallback to non-AD bind defeats the operator's intent.

**Discriminating context**: ADR-CANDIDATE-037 (LDAP Active Directory as dedicated branch) is wired via `if (properties.getActiveDirectory() != null && properties.getActiveDirectory().isEnabled())`. The constructor `ActiveDirectoryLdapAuthenticationProvider(domain, url)` accepts null `domain` — falling back to non-domain UPN bind. The Properties-class validator at `ODDLDAPProperties.java:40-49` does NOT check `enabled=true XOR domain.nonEmpty`. Operator configures `auth.ldap.active-directory.enabled: true` without `domain` → boot succeeds → AD-bind semantics silently bypassed. This is the price of ADR-CANDIDATE-048…

**Full detail**: `detail/REFACTOR-160.md`

---

## REFACTOR-164 — SMTP `mail.smtp.ssl.trust` not exposed for self-signed / internal-CA relays — operators using internal CA SMTP cannot configure trust from ODD YAML; they must add the cert to the JVM truststore or pass `-Djavax.net.ssl.trustStore=...` at boot. The live notifications doc surfaces this as a known limitation but the config surface offers no remediation

**Severity**: MEDIUM
**Category**: missing-tls-trust
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[2]` (MEDIUM) + `security.known_security_gaps.[3]` (MEDIUM)
  - **Statement**: `EmailSenderProperties.java` has no `ssl.trust` field and `NotificationConfiguration.java:51-71` never populates `mail.smtp.ssl.trust` in the JavaMail Properties bag. Operators with internal-CA SMTP relays cannot configure trust at the ODD-config layer; they must do it JVM-side (truststore manipulation, `-D` system property). The live notifications doc page acknowledges this as a known limitation but does not surface a workaround.
  - **Evidence**: `EmailSenderProperties.java` (no `ssl.trust` field) + `NotificationConfiguration.java:51-71` (no `ssl.trust` key)
  - **Existing-ADR-or-implied-prescription**: None defends the absence. The narrow-validator design (ADR-CANDIDATE-048) is about boot-time validation, not config-surface completeness.
  - **Proposed remedy**: Add `private String sslTrust;` to `EmailSenderProperties.SmtpProperties` (sibling to `auth` + `starttls`); populate `mail.smtp.ssl.trust` from it in `NotificationConfiguration.smtpProperties()`. Document the field on the live notifications page with a "self-signed / internal-CA workaround" admonition.
  - **Severity rationale**: MEDIUM — operator-deployment-friction for internal-CA SMTP relays; the workaround (JVM truststore) is non-trivial and operator-skill-gated.

**Discriminating context**: `EmailSenderProperties.java` has no `ssl.trust` field and `NotificationConfiguration.java:51-71` never populates `mail.smtp.ssl.trust` in the JavaMail Properties bag. Operators with internal-CA SMTP relays cannot configure trust at the ODD-config layer; they must do it JVM-side (truststore manipulation, `-D` system property). The live notifications doc page acknowledges this as a known limitation but does not surface a workaround.

**Full detail**: `detail/REFACTOR-164.md`

---

## REFACTOR-165 — STARTTLS-only TLS exposure — the only TLS toggle is `notifications.receivers.email.smtp.starttls`; implicit-TLS keys (`mail.smtp.ssl.enable`, `mail.smtps.*`) are never set. Gmail port 465 and many corporate SMTP relays REQUIRE implicit TLS — those cannot be used with this config surface

**Severity**: MEDIUM
**Category**: smtp-implicit-tls
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[1]` (MEDIUM) + `security.known_security_gaps.[4]` (MEDIUM)
  - **Statement**: `EmailSenderProperties.SmtpProperties` exposes only `auth: Boolean` and `starttls: Boolean`. `NotificationConfiguration.java:63-69` (the `if (protocol.equals("smtp"))` branch) populates only `mail.smtp.auth` + `mail.smtp.starttls.enable` + the four hosts/ports. Implicit-TLS-required SMTP relays (Gmail port 465, many corporate relays, AWS SES SMTPS endpoint) need `mail.smtp.ssl.enable: true` or the `smtps` protocol — neither configurable from ODD YAML.
  - **Evidence**: `EmailSenderProperties.java:17-20` (SmtpProperties only has `auth` + `starttls`) + `NotificationConfiguration.java:63-69` (only `starttls` key populated)
  - **Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-041 (per-channel URL-presence) defends the channel-activation pattern but not the per-channel TLS-mode coverage.
  - **Proposed remedy**: Add `private Boolean ssl;` to `SmtpProperties`; in `NotificationConfiguration.java`, populate `mail.smtp.ssl.enable` from it. Alternatively, support `protocol: smtps` (Jakarta Mail's implicit-TLS protocol name) by populating `mail.smtps.*` keys in a parallel branch. Document the choice on the live notifications page with explicit Gmail-port-465 and AWS-SES examples.
  - **Severity rationale**: MEDIUM — major SMTP relay families unsupported; operator-incompat shape with no workaround.

**Discriminating context**: `EmailSenderProperties.SmtpProperties` exposes only `auth: Boolean` and `starttls: Boolean`. `NotificationConfiguration.java:63-69` (the `if (protocol.equals("smtp"))` branch) populates only `mail.smtp.auth` + `mail.smtp.starttls.enable` + the four hosts/ports. Implicit-TLS-required SMTP relays (Gmail port 465, many corporate relays, AWS SES SMTPS endpoint) need `mail.smtp.ssl.enable: true` or the `smtps` protocol — neither configurable from ODD YAML.

**Full detail**: `detail/REFACTOR-165.md`

---

## REFACTOR-166 — SMTP-AUTH XOAUTH2 / modern-auth mechanisms not configurable — `EmailSenderProperties.SmtpProperties` exposes only the binary `auth` Boolean; ODD does not expose `mail.smtp.auth.mechanisms`, `mail.smtp.auth.login.disable`, or any XOAUTH2 knob. SMTP-AUTH OAUTH2 is not configurable — operators on Microsoft 365 / Gmail with OAUTH2-only SMTP cannot use this channel

**Severity**: MEDIUM
**Category**: smtp-oauth2
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[11]` (MEDIUM) + `security.known_security_gaps.[5]` (MEDIUM)
  - **Statement**: Modern SMTP-AUTH XOAUTH2 (used by Microsoft 365 + Gmail when OAUTH2-only is required) needs OAUTH2 token plumbing on the Jakarta Mail Session. `EmailSenderProperties` exposes only `auth: Boolean`. `NotificationConfiguration.java:51-72` populates the Properties bag with no auth-mechanism keys. Tenants on Microsoft 365 with "OAUTH2-only SMTP" enforced cannot use the email notification channel.
  - **Evidence**: `EmailSenderProperties.java:17-20` + `NotificationConfiguration.java:51-72` (no `mail.smtp.auth.mechanisms` etc.)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Substantial — XOAUTH2 SMTP plumbing requires token-refresh logic, not just a config knob. Stage 1: document the limitation on the live notifications page so operators know to use a different relay or PLAIN-AUTH. Stage 2: design a token-refresh path (likely via Spring's OAuth2 client infrastructure) and an `EmailSenderProperties.SmtpProperties.xoauth2: XoauthProperties` nested config.
  - **Severity rationale**: MEDIUM — major-tenant-class operator-incompat; the workaround (PLAIN-AUTH against a relay account) defeats the modern-auth posture of the tenant's IT.

**Discriminating context**: Modern SMTP-AUTH XOAUTH2 (used by Microsoft 365 + Gmail when OAUTH2-only is required) needs OAUTH2 token plumbing on the Jakarta Mail Session. `EmailSenderProperties` exposes only `auth: Boolean`. `NotificationConfiguration.java:51-72` populates the Properties bag with no auth-mechanism keys. Tenants on Microsoft 365 with "OAUTH2-only SMTP" enforced cannot use the email notification channel.

**Full detail**: `detail/REFACTOR-166.md`

---

## REFACTOR-167 — Email `sender` has no `@Email` validation, and the same field doubles as `JavaMailSenderImpl.username` — if the SMTP-AUTH username is NOT the sender address (a common enterprise pattern), there is no way to express that distinction in ODD config. Misconfigured `sender` accepted silently and only fails at SMTP-send time

**Severity**: MEDIUM
**Category**: no-email-validation
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[4]` (MEDIUM)
  - **Statement**: `EmailSenderProperties.java:9` declares `private String sender;` with no `@Email` (Jakarta validation) annotation. `NotificationConfiguration.java:39-41` blank-checks only. The same field is then assigned as the SMTP-AUTH username at `NotificationConfiguration.java:55` (`mailSender.setUsername(emailProperties.getSender())`). Two consequences: (a) typos / malformed addresses pass boot and fail at SMTP-send time with a confusing JavaMail error; (b) enterprises with a service-account-email-distinct-from-the-From-address pattern (common in Microsoft 365 deployments) cannot express the distinction in ODD config.
  - **Evidence**: `EmailSenderProperties.java:9` (no `@Email`) + `NotificationConfiguration.java:39-41` + `NotificationConfiguration.java:55` (sender = username)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-048 (narrow-validator scope) defers semantic correctness to runtime.
  - **Proposed remedy**: Add `@Email` annotation to `EmailSenderProperties.sender` (after adding `@Validated` at class level). Add an optional `private String authUsername;` field — when set, override `setUsername()` with `authUsername`, otherwise fall back to `sender`. Document the username-vs-sender distinction on the live notifications page.
  - **Severity rationale**: MEDIUM — operator-config-fragility + enterprise-pattern-incompat.

**Discriminating context**: `EmailSenderProperties.java:9` declares `private String sender;` with no `@Email` (Jakarta validation) annotation. `NotificationConfiguration.java:39-41` blank-checks only. The same field is then assigned as the SMTP-AUTH username at `NotificationConfiguration.java:55` (`mailSender.setUsername(emailProperties.getSender())`). Two consequences: (a) typos / malformed addresses pass boot and fail at SMTP-send time with a confusing JavaMail error; (b) enterprises with a service-account-email-distinct-from-the-From-address pattern (common in Microsoft 365 deployments) cannot express the distinction…

**Full detail**: `detail/REFACTOR-167.md`

---

## REFACTOR-169 — `SmtpProperties.auth` and `SmtpProperties.starttls` are boxed `Boolean` — null is a legal value at binding time. `NotificationConfiguration.java:65-66` calls `props.put("mail.smtp.auth", emailProperties.getSmtp().getAuth())` — if the field is null, `Properties#put(null)` throws NPE per the Hashtable contract. The first SMTP send NPEs rather than failing at boot, leaking misconfiguration past the boot-time validation

**Severity**: MEDIUM
**Category**: npe-on-boxed-bool
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[6]` (MEDIUM)
  - **Statement**: `EmailSenderProperties.SmtpProperties.auth` + `starttls` are `Boolean` (boxed). When the operator omits these keys from YAML, Spring binds null. `NotificationConfiguration.java:65-66` (`props.put("mail.smtp.auth", emailProperties.getSmtp().getAuth())`) — `Properties` extends `Hashtable` which rejects null values with NPE. The throw happens at boot if the smtp branch is exercised in the bean factory; otherwise it surfaces on first SMTP send.
  - **Evidence**: `EmailSenderProperties.java:18-20` (boxed Boolean) + `NotificationConfiguration.java:65-66` (the unguarded `Properties#put`)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Either (a) change boxed `Boolean` to primitive `boolean` (defaults to false; explicit safe default); or (b) add null-guards: `props.put("mail.smtp.auth", String.valueOf(Boolean.TRUE.equals(emailProperties.getSmtp().getAuth())))`. Option (a) is simpler and matches JavaMail's documented String-value expectation; option (b) keeps null-is-not-set semantic for future Boolean-tri-state-config evolution.
  - **Severity rationale**: MEDIUM — boot-time NPE on a deployment with `smtp.auth` omitted; operator-confusing stack-trace.

**Discriminating context**: `EmailSenderProperties.SmtpProperties.auth` + `starttls` are `Boolean` (boxed). When the operator omits these keys from YAML, Spring binds null. `NotificationConfiguration.java:65-66` (`props.put("mail.smtp.auth", emailProperties.getSmtp().getAuth())`) — `Properties` extends `Hashtable` which rejects null values with NPE. The throw happens at boot if the smtp branch is exercised in the bean factory; otherwise it surfaces on first SMTP send.

**Full detail**: `detail/REFACTOR-169.md`

---

## REFACTOR-172 — Email recipient list comma-split with no per-address trim — `notificationEmails.trim().split(",")` yields recipients with leading spaces. JavaMail rejects the second as invalid `InternetAddress`, aborting the recipient loop before subsequent emails are sent

**Severity**: MEDIUM
**Category**: recipient-parse-fragile
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[9]` (MEDIUM) + `security.known_security_gaps.[6]` (LOW)
  - **Statement**: `NotificationConfiguration.java:118` reads `notification.emails` via `@Value`, then `List.of(notificationEmails.trim().split(","))` parses. A YAML value like `'a@x.com, b@x.com'` yields recipients `'a@x.com'` and `' b@x.com'` (the second has a leading space). JavaMail's `InternetAddress.parse(' b@x.com')` throws. `EmailNotificationSender.java:54-57` iterates per-recipient and any exception aborts the whole loop. Combined with REFACTOR-128 (silent partial delivery), recipients after the typo-ed address never receive the alert.
  - **Evidence**: `NotificationConfiguration.java:118` + `EmailNotificationSender.java:54-57`
  - **Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-042 (fail-soft fan-out) is the channel-level posture; this gap is intra-channel and the fail-soft does not extend per-recipient.
  - **Proposed remedy**: Change the parse to `Arrays.stream(notificationEmails.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList()`. Add `@Email` validation per element. Optional: log a WARN at boot listing the parsed-recipient set so operators can verify.
  - **Severity rationale**: MEDIUM — operator-trap with silent multi-recipient delivery loss.

**Discriminating context**: `NotificationConfiguration.java:118` reads `notification.emails` via `@Value`, then `List.of(notificationEmails.trim().split(","))` parses. A YAML value like `'a@x.com, b@x.com'` yields recipients `'a@x.com'` and `' b@x.com'` (the second has a leading space). JavaMail's `InternetAddress.parse(' b@x.com')` throws. `EmailNotificationSender.java:54-57` iterates per-recipient and any exception aborts the whole loop. Combined with REFACTOR-128 (silent partial delivery), recipients after the typo-ed address never receive the alert.

**Full detail**: `detail/REFACTOR-172.md`

---

## REFACTOR-175 — No DataCollaboration sender/receiver lock-id equality invariant — `receiveEventAdvisoryLockId` and `senderMessageAdvisoryLockId` are operator-tuneable but have NO `@PostConstruct` check that they differ. Setting both to the same int silently lets either thread block the other; the only signal is "Slack messages stop flowing in one direction"

**Severity**: MEDIUM
**Category**: advisory-lock-collision
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:bugs_limitations_corner_cases.[0]` (MEDIUM)
  - **Statement**: `DataCollaborationProperties.java:10-11` declares `senderMessageAdvisoryLockId` and `receiveEventAdvisoryLockId` as operator-tuneable `int` fields. The `@PostConstruct validate()` at lines 14-20 checks only `sendingMessagesRetryCount >= 0`. An operator who tunes both lock IDs to the same value produces a deployment where the sender thread and receiver thread contend on the same Postgres advisory lock — the first acquirer holds the lock, the second blocks indefinitely. Slack-direction-A delivery silently halts.
  - **Evidence**: `DataCollaborationProperties.java:10-11` (the two lock-id fields) + `DataCollaborationProperties.java:14-20` (validator body — only retry-count check) + `DataCollaborationMessageSenderJob.java:94` + `DataCollaborationMessageEventProcessor.java:148` (the two `leaderElectionManager.acquire(...)` consumers)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-018 (fail-fast at boot) is the design but the narrow-validator scope (ADR-CANDIDATE-048) defers cross-field invariants. The maintainer's @PostConstruct could trivially check disjointness.
  - **Proposed remedy**: Extend `DataCollaborationProperties.validate()`: `if (senderMessageAdvisoryLockId == receiveEventAdvisoryLockId) { throw new IllegalStateException("datacollaboration.sender-message-advisory-lock-id and datacollaboration.receive-event-advisory-lock-id must be different values"); }`. Strengthens REFACTOR-183 (cross-cutting advisory-lock-ID registry) from the same-subsystem angle.
  - **Severity rationale**: MEDIUM — silent deployment-functionality regression on operator-tuning.

**Discriminating context**: `DataCollaborationProperties.java:10-11` declares `senderMessageAdvisoryLockId` and `receiveEventAdvisoryLockId` as operator-tuneable `int` fields. The `@PostConstruct validate()` at lines 14-20 checks only `sendingMessagesRetryCount >= 0`. An operator who tunes both lock IDs to the same value produces a deployment where the sender thread and receiver thread contend on the same Postgres advisory lock — the first acquirer holds the lock, the second blocks indefinitely. Slack-direction-A delivery silently halts.

**Full detail**: `detail/REFACTOR-175.md`

---

## REFACTOR-176 — No upper-bound check on `sendingMessagesRetryCount` — a misconfiguration of `Integer.MAX_VALUE` would cause `DataCollaborationMessageSenderJob.shouldRetry()` to effectively never give up; combined with the fixed 1-second `Thread.sleep(1000)` between retries (DataCollaborationMessageSenderJob.java:60), a single poisoned message can block the single-leader sender thread indefinitely. The validator catches `< 0` only

**Severity**: MEDIUM
**Category**: no-upper-bound
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:bugs_limitations_corner_cases.[1]` (MEDIUM)
  - **Statement**: `DataCollaborationProperties.java:14-20` validates only `sendingMessagesRetryCount >= 0`. An operator setting `Integer.MAX_VALUE` produces a retry budget of ~2.1 billion attempts × 1-second sleep = 67-year retry on a poisoned message. The single-leader sender thread (ADR-CANDIDATE-020) is blocked the entire duration; ALL Slack outbound delivery for the deployment halts on one poisoned message.
  - **Evidence**: `DataCollaborationProperties.java:14-20` (validator) + `DataCollaborationMessageSenderJob.java:60` (Thread.sleep(1000)) + `DataCollaborationMessageSenderJob.java:87-91` (shouldRetry)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-020 (decoupled outbound delivery — single-leader) AMPLIFIES the gap.
  - **Proposed remedy**: Add `@Max(100)` (via `@Validated` on the class) or extend the validator: `if (sendingMessagesRetryCount > 100) { throw new IllegalStateException("datacollaboration.sending-messages-retry-count must not exceed 100"); }`. Document the implicit cap on the live DataCollaboration page.
  - **Severity rationale**: MEDIUM — operator-config-foot-gun + interacts with the single-leader sender design to produce a wide blast radius.

**Discriminating context**: `DataCollaborationProperties.java:14-20` validates only `sendingMessagesRetryCount >= 0`. An operator setting `Integer.MAX_VALUE` produces a retry budget of ~2.1 billion attempts × 1-second sleep = 67-year retry on a poisoned message. The single-leader sender thread (ADR-CANDIDATE-020) is blocked the entire duration; ALL Slack outbound delivery for the deployment halts on one poisoned message.

**Full detail**: `detail/REFACTOR-176.md`

---

## REFACTOR-182 — Partial-home `@ConfigurationProperties` — multiple config prefixes have keys SPLIT between a typed POJO and raw `@Value` consumers; future additions are ambiguous about which file owns them, and a maintainer reading the POJO would falsely conclude the prefix has fewer keys than reality

**Severity**: MEDIUM
**Category**: partial-home-properties
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:bugs_limitations_corner_cases.[3]` (LOW — "three keys here, three keys via `@Value` elsewhere — no single class representing the prefix")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[8]` (LOW — "Recipient list NOT modeled on this @ConfigurationProperties POJO — read via raw @Value")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md` (cross-cited — `notifications.message.downstream-entities-depth` not modeled on POJO — REFACTOR-132 from batch C)
  - **Statement**: Three @ConfigurationProperties POJOs in the codebase OWN SOME keys of their prefix while OTHER keys of the same prefix are bound via `@Value` elsewhere. Specifically: (a) `DataCollaborationProperties` owns 3 keys (`sender-message-advisory-lock-id`, `receive-event-advisory-lock-id`, `sending-messages-retry-count`) while `datacollaboration.enabled` + `datacollaboration.slack-oauth-token` + `datacollaboration.message-partition-period` are read via `@Value` elsewhere (DataCollaborationConfiguration.java:21 + FeatureResolverImpl.java:17 + MessageTablePartitionManager.java:19); (b) `EmailSenderProperties` owns 5 keys (sender + host + port + password + protocol + smtp.*) while `notifications.receivers.email.notification.emails` is read via `@Value` at NotificationConfiguration.java:104; (c) `NotificationsProperties` owns the high-level `notifications.wal.*` keys while `notifications.message.downstream-entities-depth` is read via `@Value` (REFACTOR-132). Operators inspecting any of the three POJOs to understand the prefix surface miss keys; future contributors adding new keys face an ambiguous "which file owns this?" decision.
  - **Evidence**: `DataCollaborationProperties.java:1-21` (3 fields) + DataCollaborationConfiguration.java:20-21 (Slack token via @Value) + FeatureResolverImpl.java:17 (enabled via @Value) + MessageTablePartitionManager.java:19 (partition-period via @Value) + EmailSenderProperties.java (5 fields) + NotificationConfiguration.java:104 (recipient list via @Value) + `NotificationsProperties.md` cross-cite (REFACTOR-132)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Consolidate each prefix's keys into a single `@ConfigurationProperties` POJO: (a) add `enabled`, `slackOauthToken`, `messagePartitionPeriod` fields to `DataCollaborationProperties`; (b) add `notificationEmails` field to `EmailSenderProperties` (or a new `EmailNotificationProperties` if the partial split is intentional); (c) add `downstreamEntitiesDepth` field to `NotificationsProperties.MessageProperties`. The consolidation gives operators a single discoverable surface per prefix.
  - **Severity rationale**: MEDIUM — code-organisation + operator-discoverability; not a runtime bug but a maintainability and onboarding friction.

**Discriminating context**: Three @ConfigurationProperties POJOs in the codebase OWN SOME keys of their prefix while OTHER keys of the same prefix are bound via `@Value` elsewhere. Specifically: (a) `DataCollaborationProperties` owns 3 keys (`sender-message-advisory-lock-id`, `receive-event-advisory-lock-id`, `sending-messages-retry-count`) while `datacollaboration.enabled` + `datacollaboration.slack-oauth-token` + `datacollaboration.message-partition-period` are read via `@Value` elsewhere (DataCollaborationConfiguration.java:21 + FeatureResolverImpl.java:17 + MessageTablePartitionManager.java:19); (b)…

**Full detail**: `detail/REFACTOR-182.md`

---

## REFACTOR-183 — No central advisory-lock-ID registry — four operator-tuneable lock IDs (90 partition / 100 notifications / 110 dc-receive / 120 dc-send) are spread across three `@ConfigurationProperties` POJOs + one `@Value` consumer with NO startup assertion of disjoint allocation

**Severity**: MEDIUM
**Category**: advisory-lock-registry
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:bugs_limitations_corner_cases.[2]` + `security.known_security_gaps.[1]` (MEDIUM)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:bugs_limitations_corner_cases.[6]` (cross-cited from batch C — REFACTOR-133)
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md` (cross-cited from batch B — advisory-lock-id=90 at boot)
  - **Statement**: Four Postgres advisory locks coordinate cluster-wide singleton operations: (a) `partition.advisory-lock-id` = 90 (partition manager at boot); (b) `notifications.wal.advisory-lock-id` = 100 (Notifications WAL consumer); (c) `datacollaboration.receive-event-advisory-lock-id` = 110 (Slack event receiver); (d) `datacollaboration.sender-message-advisory-lock-id` = 120 (Slack message sender). The shipped `application.yml` defaults are non-overlapping; operator overrides have NO startup assertion that they STAY non-overlapping. An operator who copies one default into another override silently produces a deployment where (say) the partition manager and the DataCollaboration sender contend on lock-id 90. The failure mode is per-subsystem deadlock/starvation; the diagnostic surface is silent.
  - **Evidence**: `application.yml:177` (partition=90) + `application.yml:198` (notifications=100) + `application.yml:201-202` (dc-110/120) + `DataCollaborationProperties.java:10-11` + `NotificationsProperties` WAL section + `ActivityTablePartitionManager` advisory-lock=90 at boot + grep `<odd-platform-repo>` for cross-subsystem lock-id collision check returning zero hits
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-043 (Notifications single-leader WAL) and ADR-CANDIDATE-020 (decoupled outbound delivery — single-leader sender) BOTH rely on the disjoint allocation; neither defends the absence of a registry. ADR-CANDIDATE-048 (narrow-validator scope) explains why per-POJO validators don't cross-check.
  - **Proposed remedy**: Add a startup-time `AdvisoryLockRegistry` `@Component` that injects all four `*AdvisoryLockId`-bearing beans (`PartitionProperties`, `NotificationsProperties`, `DataCollaborationProperties`) and asserts disjoint allocation in `@PostConstruct`. On collision, throw `IllegalStateException` listing all four IDs and the colliding pair. Alternative: type the lock IDs as a typed enum `AdvisoryLock { PARTITION(90), NOTIFICATIONS(100), DC_RECEIVE(110), DC_SEND(120) }` — but this defeats operator-tuneability. The registry pattern preserves tuneability + adds the safety net.
  - **Severity rationale**: MEDIUM — cluster-wide-coordination integrity invariant with silent-deadlock failure mode. STRENGTHENS REFACTOR-133 (same shape from Notifications side) and REFACTOR-177 (same shape from DataCollab side) — folding into this single cross-cutting REFACTOR is the cleaner triage.

**Discriminating context**: Four Postgres advisory locks coordinate cluster-wide singleton operations: (a) `partition.advisory-lock-id` = 90 (partition manager at boot); (b) `notifications.wal.advisory-lock-id` = 100 (Notifications WAL consumer); (c) `datacollaboration.receive-event-advisory-lock-id` = 110 (Slack event receiver); (d) `datacollaboration.sender-message-advisory-lock-id` = 120 (Slack message sender). The shipped `application.yml` defaults are non-overlapping; operator overrides have NO startup assertion that they STAY non-overlapping. An operator who copies one default into another override silently…

**Full detail**: `detail/REFACTOR-183.md`

---

## REFACTOR-214 — No request-size validation BEFORE deserialisation on ingestion — body buffered up to 20MB before any validation runs; `DataBufferLimitException` surfaces as HTTP 500, not 413 Payload Too Large

**Severity**: MEDIUM
**Category**: missing-validation (DoS-amplification)

**Discriminating context**: The ingestion body is read into memory up to `spring.codec.max-in-memory-size: 20MB` (`application.yml:14-15`); over-cap payloads throw `DataBufferLimitException` which surfaces as HTTP 500, not 413 Payload Too Large. An attacker submitting maximum-cap payloads (with garbage content if the filter is off, or with valid tokens if compromised) forces the platform to buffer 20 MB per concurrent request before validation. No streaming JSON parser. Combined with REFACTOR-204/REFACTOR-205 (default-off unauth ingestion + cross-tenant), the heap-pressure DoS vector is unauthenticated.

**Full detail**: `detail/REFACTOR-214.md`

---

## REFACTOR-215 — Unknown `data_source_oddrn` on ingestion returns 5xx, not 404 — `NotFoundException` not mapped by the WebFlux exception handler on this path; operators reading 5xx in their collector logs may believe the platform is unhealthy when in fact the datasource is misconfigured

**Severity**: MEDIUM
**Category**: error-mapping

**Discriminating context**: `IngestionController.java:38-44` delegates to `ingestionService::ingest`; `IngestionServiceImpl.java:68-69` calls `switchIfEmpty(Mono.error(() -> new NotFoundException("dataSource", oddrn)))`. There is no `@ExceptionHandler(NotFoundException)` converting the exception to HTTP 404 on this path — the default WebFlux error handler returns 500 Internal Server Error. Operators reading 5xx in their collector logs may believe the platform is unhealthy when in fact the datasource is misconfigured. The diagnostic-leak component is also present (REFACTOR-216 below references this) — the 500 surface…

**Full detail**: `detail/REFACTOR-215.md`

---

## REFACTOR-039 — i18n `localStorage` access is unguarded — privacy-mode browsers where `localStorage` throws cause UI to fail to render

**Severity**: LOW
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:bugs_limitations_corner_cases.[3]` (LOW)
    - `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:bugs_limitations_corner_cases.[1]` (LOW)
  - **Statement**: `odd-platform-ui/src/locales/i18n.ts:22` and `SelectLanguage.tsx:30` access `localStorage` with no try/catch. Safari private mode + sandboxed iframes raise on `localStorage` access; the bootstrap import-for-side-effects raises before `<App />` renders → entire UI unreachable.
  - **Evidence**: `i18n.ts:22` + `SelectLanguage.tsx:28-33`
  - **Proposed remedy**: Wrap both in try/catch with a safe fallback to default language.
  - **Severity rationale**: LOW — affects a small operator subset.

**Discriminating context**: `odd-platform-ui/src/locales/i18n.ts:22` and `SelectLanguage.tsx:30` access `localStorage` with no try/catch. Safari private mode + sandboxed iframes raise on `localStorage` access; the bootstrap import-for-side-effects raises before `<App />` renders → entire UI unreachable.

**Full detail**: `detail/REFACTOR-039.md`

---

## REFACTOR-040 — SelectLanguage friendly-name and country-code maps use TypeScript casts with no runtime guard — adding a locale to `i18n.ts` without updating `LANGUAGES_MAP`/`LANG_TO_COUNTRY_CODE_MAP` crashes the language dialog

**Severity**: LOW
**Category**: missing-validation

**Discriminating context**: `SelectLanguage.tsx:48-50, 60` use TypeScript casts; if a locale is added to `i18n.ts` but not the constant maps, the dialog crashes with a `TypeError`.

**Full detail**: `detail/REFACTOR-040.md`

---

## REFACTOR-041 — Reflection-based ODDRN-property extraction in Directory unmemoised — per-request, per-data-source `@PathField` field set re-discovered and getter Method re-resolved

**Severity**: LOW
**Category**: observability (performance)
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:bugs_limitations_corner_cases.[3]` (LOW)
    - `concepts.yaml:entities[Directory].performance_aggregate.weaknesses.[2]`
  - **Statement**: `DirectoryServiceImpl.getOddrnPathProperties` uses Java reflection on every data-source row in `/api/directory/datasources`; cost compounds with prefix-list size.
  - **Evidence**: `DirectoryServiceImpl.java:153-171`
  - **Proposed remedy**: Memoise per-class `@PathField` field set + getter Methods (compute once at startup or lazily on first encounter, cache by class). Or replace reflection with a generated mapper.
  - **Severity rationale**: LOW — performance scaling issue.

**Discriminating context**: `DirectoryServiceImpl.getOddrnPathProperties` uses Java reflection on every data-source row in `/api/directory/datasources`; cost compounds with prefix-list size.

**Full detail**: `detail/REFACTOR-041.md`

---

## REFACTOR-042 — No `@Timed` / Micrometer / structured-logging at DataEntityController boundary — 40 endpoints invisible to controller-layer observability

**Severity**: LOW
**Category**: observability
**Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:bugs_limitations_corner_cases.[5]` (LOW)
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses.[4]`
  - **Statement**: 40 endpoints, none observed at the controller boundary; latency regressions visible only via downstream service / DB metrics.
  - **Evidence**: `DataEntityController.java:1-454` (no `@Timed`, no `MeterRegistry`)
  - **Proposed remedy**: Add `@Timed` (Spring Boot Actuator + Micrometer auto-config) at class level on every controller. Adopt as a project-wide convention via a `Controller`-marker meta-annotation.
  - **Severity rationale**: LOW — observability gap.

**Discriminating context**: 40 endpoints, none observed at the controller boundary; latency regressions visible only via downstream service / DB metrics.

**Full detail**: `detail/REFACTOR-042.md`

---

## REFACTOR-043 — Generated AlertManager `generatorURL` is rewritten with Prometheus-Web-UI–specific query params — non-Prometheus AlertManager fronts (Mimir, Thanos, VictoriaMetrics) produce non-functional UI links

**Severity**: LOW
**Category**: missing-validation

**Discriminating context**: `AlertServiceImpl.java:168-172` embeds `g0.moment_input` and `g0.end_input` (Prometheus PromQL UI query params) into the stored alert chunk's description. If the operator's AlertManager fronts something other than Prometheus, the link may not navigate.

**Full detail**: `detail/REFACTOR-043.md`

---

## REFACTOR-061 — `getActivity` `lasEventId` parameter is a typo on the public API contract — the service-interface name is correct (`lastEventId`), but the controller method's local variable name leaks the typo to the OpenAPI-generated client signature

**Severity**: LOW
**Category**: contract-typo
**Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[0]` (LOW)
  - **Statement**: `ActivityController.java:34` declares `final Long lasEventId` (missing the `t` in `last`). The OpenAPI parameter name is `last_event_id` (correct) but the Java method signature exposes `lasEventId`. Generated client code derived from this signature carries the typo. Since the controller delegates straight to `activityService.getActivityList(... lasEventId, lastEventDateTime)`, the typo also affects the local variable name. The service interface (`ActivityService.java:42`) correctly names the parameter `lastEventId` — only the controller layer carries the typo. Fixing it is a one-character change but produces a breaking change to the generated client signature.
  - **Evidence**: `ActivityController.java:34` (`final Long lasEventId`) + `ActivityService.java:42` (`final Long lastEventId` — correctly named at the service interface)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (cursor pagination convention) describes the parameter shape; this scope is a contract-naming bug.
  - **Proposed remedy**: Rename the controller parameter to `lastEventId`. Note this changes the OpenAPI-generated client signature in any consumer that bound to the typo'd name; an MAJOR version bump or a deprecation cycle may be required depending on the client surface.
  - **Severity rationale**: LOW — naming bug; not security/correctness, but professionalism.

**Discriminating context**: `ActivityController.java:34` declares `final Long lasEventId` (missing the `t` in `last`). The OpenAPI parameter name is `last_event_id` (correct) but the Java method signature exposes `lasEventId`. Generated client code derived from this signature carries the typo. Since the controller delegates straight to `activityService.getActivityList(... lasEventId, lastEventDateTime)`, the typo also affects the local variable name. The service interface (`ActivityService.java:42`) correctly names the parameter `lastEventId` — only the controller layer carries the typo. Fixing it is a one-character…

**Full detail**: `detail/REFACTOR-061.md`

---

## REFACTOR-065 — Token-rotation endpoint has no idempotency token (no `If-Match` ETag); UI double-submit (slow click, network retry) rotates the token twice and invalidates the value the user just copied to clipboard

**Severity**: LOW
**Category**: idempotency
**Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[7]` (LOW)
  - **Statement**: `CollectorController.java:47-51` consults no headers on the PUT. `CollectorApi` has no `If-Match` parameter on the operation. A UI double-submit (slow click → user clicks again before response, network-retry by browser) rotates the token twice. The response body's `token.value` would be the most recent, but the in-flight first response is now stale immediately — if the user copy-paste-uses the first response's token, ingestion fails.
  - **Evidence**: `CollectorController.java:47-51` (no header check) + `CollectorApi` (generated; no `If-Match` parameter on the operation)
  - **Existing-ADR-or-implied-prescription**: None.
  - **Proposed remedy**: Add `If-Match` ETag support: include the current `TOKEN.updated_at` (or a ULID/UUID per token state) in `Collector` GET responses; require `If-Match: <etag>` on the rotation PUT; reject mismatch with HTTP 412 Precondition Failed. UI consumes the etag; double-submit produces a clear 412 instead of a silent stale-token UX.
  - **Severity rationale**: LOW — UX papercut on a critical flow.

**Discriminating context**: `CollectorController.java:47-51` consults no headers on the PUT. `CollectorApi` has no `If-Match` parameter on the operation. A UI double-submit (slow click → user clicks again before response, network-retry by browser) rotates the token twice. The response body's `token.value` would be the most recent, but the in-flight first response is now stale immediately — if the user copy-paste-uses the first response's token, ingestion fails.

**Full detail**: `detail/REFACTOR-065.md`

---

## REFACTOR-070 — No test coverage for `AppInfoController` — grep across `odd-platform-api/src/test` for `AppInfoController`, `getAppInfo`, and the literal `auth.type` returns no hits

**Severity**: LOW
**Category**: missing-test
**Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:tests_coverage_semantic.gaps` (severity LOW)
  - **Statement**: Zero test coverage. No `@WebFluxTest`, no slice test, no integration test asserts the path security of `/api/appInfo` or the shape of the returned `AppInfo` payload. A regression that (1) silently drops `authType` from the DTO, (2) changes path security so an unauthenticated caller can no longer reach `/api/appInfo` (breaking the SPA's login render), or (3) adds new fields to `AppInfo` containing operator-sensitive metadata (build SHA, hostname, etc.) would not be caught.
  - **Evidence**: grep results 2026-05-10 (zero matches)
  - **Proposed remedy**: Add `@WebFluxTest(AppInfoController.class)`; assert for each of `DISABLED / LOGIN_FORM / OAUTH2 / LDAP` (a) the returned `authType` matches the configured value, (b) the response shape is `{projectVersion, authType}` only (no operator-sensitive metadata leaked), (c) the path-security posture is as documented (currently undocumented — see REFACTOR-068).
  - **Severity rationale**: LOW — process leverage; catches REFACTOR-068-class regressions if path-security ever changes.

**Discriminating context**: Zero test coverage. No `@WebFluxTest`, no slice test, no integration test asserts the path security of `/api/appInfo` or the shape of the returned `AppInfo` payload. A regression that (1) silently drops `authType` from the DTO, (2) changes path security so an unauthenticated caller can no longer reach `/api/appInfo` (breaking the SPA's login render), or (3) adds new fields to `AppInfo` containing operator-sensitive metadata (build SHA, hostname, etc.) would not be caught.

**Full detail**: `detail/REFACTOR-070.md`

---

## REFACTOR-088 — `partition.advisory-lock-id` has no `:default` and is undocumented on the live config page — operator deletion of the key fails bean wiring at boot

**Severity**: LOW
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[5]` (severity LOW)
  - **Statement**: `PostgreSQLPartitionCreationJob.java:26` declares `@Value("${partition.advisory-lock-id}")` with NO `:default` (unlike the partition-period's `:30`). If an operator deletes the `partition.advisory-lock-id` key from a customised `application.yml` (or sets `PARTITION_ADVISORY_LOCK_ID=`), bean wiring at boot fails with `Could not resolve placeholder`. The live `/configuration-and-deployment/odd-platform` page does NOT list `partition.advisory-lock-id` — it is a "configuration ghost" for operators, while sibling lock-ids (`notifications.wal.advisory-lock-id`, `datacollaboration.receive-event-advisory-lock-id`) ARE listed.
  - **Evidence**: `PostgreSQLPartitionCreationJob.java:26` (no `:default`) + `application.yml:197-198` (`partition: advisory-lock-id: 90`) + WebFetch of `/configuration-and-deployment/odd-platform` on 2026-05-10 (status 200, `partition.advisory-lock-id` ABSENT from the documented set)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) describes the dual-lock concurrency model but does NOT defend the missing default + undocumented key.
  - **Proposed remedy**: Add `:90` default (`@Value("${partition.advisory-lock-id:90}")`) so removing the key from application.yml still boots. Document the key on the live `/configuration-and-deployment/odd-platform` page alongside the other advisory-lock-id keys.
  - **Severity rationale**: LOW — operator-error gated; ships with sane default.

**Discriminating context**: `PostgreSQLPartitionCreationJob.java:26` declares `@Value("${partition.advisory-lock-id}")` with NO `:default` (unlike the partition-period's `:30`). If an operator deletes the `partition.advisory-lock-id` key from a customised `application.yml` (or sets `PARTITION_ADVISORY_LOCK_ID=`), bean wiring at boot fails with `Could not resolve placeholder`. The live `/configuration-and-deployment/odd-platform` page does NOT list `partition.advisory-lock-id` — it is a "configuration ghost" for operators, while sibling lock-ids (`notifications.wal.advisory-lock-id`,…

**Full detail**: `detail/REFACTOR-088.md`

---

## REFACTOR-091 — `@Scheduled(cron = "0 1 0 * * *")` is server-timezone-implicit — multi-region instances may create partitions at different wall-clock times

**Severity**: LOW
**Category**: timezone-implicit
**Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:bugs_limitations_corner_cases.[6]` (severity LOW)
  - **Statement**: `PostgreSQLPartitionCreationJob.java:40` declares `@Scheduled(cron = "0 1 0 * * *")` with no `zone =` attribute. Spring's `@Scheduled` defaults to the server's local timezone unless `zone` is specified; the cron runs at `00:01` local server time. A multi-region deployment where instances run in different timezones would attempt to create partitions at different wall-clock times. In single-instance deployments, the date boundary at midnight server-local-time may not match the `baseline = DateTimeUtil.generateNow().toLocalDate()` returned for an INSERT firing at that moment. ShedLock's 10m hold prevents the same instance from re-firing; multi-instance races on `baseline` calculation at midnight UTC offset boundaries could theoretically produce off-by-one partition boundaries.
  - **Evidence**: `PostgreSQLPartitionCreationJob.java:40` (no `zone =` attribute) + `AbstractPartitionManager.java:23` (`DateTimeUtil.generateNow().toLocalDate()` — local-date, not Instant)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-028 (NEW) does not address timezone.
  - **Proposed remedy**: Add explicit `zone = "UTC"` to the `@Scheduled` annotation. Update `DateTimeUtil.generateNow()` consumers in the partition code path to use `Instant`/`ZonedDateTime` instead of `LocalDate` so partition boundaries are deterministic across timezones.
  - **Severity rationale**: LOW — theoretical; ShedLock's 10m window covers the common cases.

**Discriminating context**: `PostgreSQLPartitionCreationJob.java:40` declares `@Scheduled(cron = "0 1 0 * * *")` with no `zone =` attribute. Spring's `@Scheduled` defaults to the server's local timezone unless `zone` is specified; the cron runs at `00:01` local server time. A multi-region deployment where instances run in different timezones would attempt to create partitions at different wall-clock times. In single-instance deployments, the date boundary at midnight server-local-time may not match the `baseline = DateTimeUtil.generateNow().toLocalDate()` returned for an INSERT firing at that moment. ShedLock's 10m hold…

**Full detail**: `detail/REFACTOR-091.md`

---

## REFACTOR-067 — `getActivity` `size` parameter has no documented or enforced upper bound — caller submitting `size=Integer.MAX_VALUE` is rate-limited only by the repository's query plan

**Severity**: LOW
**Category**: missing-validation
**Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[3]` (LOW per sidecar)
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:performance.known_performance_gaps.[0]` (MEDIUM per sidecar)
  - **Statement**: `ActivityController.java:26` declares `final Integer size` with no `@Max` annotation, no programmatic check. `ActivityServiceImpl.java:179-181` passes the parameter through to the repository unchanged. A caller submitting `size=Integer.MAX_VALUE` is rate-limited only by the repository's query plan and Postgres's LIMIT clause behaviour. The cursor design assumes well-behaved clients page through with reasonable `size`; that assumption is undocumented.
  - **Evidence**: `ActivityController.java:26` + `ActivityServiceImpl.java:179-181`
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (cursor pagination) describes the cursor shape; this scope is the missing per-page bound.
  - **Proposed remedy**: Add `@Max(200)` on `size`. Add `default: 50` on the OpenAPI spec. Document on the live activity-feed page.
  - **Severity rationale**: LOW — consistent with REFACTOR-020 (the platform-wide pagination-unbounded gap class).

**Discriminating context**: `ActivityController.java:26` declares `final Integer size` with no `@Max` annotation, no programmatic check. `ActivityServiceImpl.java:179-181` passes the parameter through to the repository unchanged. A caller submitting `size=Integer.MAX_VALUE` is rate-limited only by the repository's query plan and Postgres's LIMIT clause behaviour. The cursor design assumes well-behaved clients page through with reasonable `size`; that assumption is undocumented.

**Full detail**: `detail/REFACTOR-067.md`

---

## REFACTOR-092 — No CORS configured under DISABLED — unlike OAuth (`.cors(withDefaults())` at line 95) and LDAP (`.cors(withDefaults())` at line 142), `DisabledAuthSecurityConfiguration` does not call `.cors(...)`. No global `CorsWebFilter` exists; cross-origin browser callers under DISABLED behave inconsistently with other modes

**Severity**: LOW
**Category**: missing-cors

**Discriminating context**: Cross-origin browser callers under DISABLED reach the application via `.anyExchange().permitAll()` but receive no `Access-Control-*` headers from Spring Security — so an SPA hosted on a different origin from the platform port either succeeds (no auth gate) or is blocked by browser CORS rules. Inconsistent posture across modes. Severity LOW because DISABLED is dev-only per docs; the inconsistency is a structural smell.

**Full detail**: `detail/REFACTOR-092.md`

---

## REFACTOR-095 — CSRF disabled cross-mode is undocumented on the live security pages — operators transitioning from a CSRF-protecting framework would not learn from the docs that POST/PUT/DELETE requests succeed without CSRF tokens under any auth.type mode

**Severity**: LOW
**Category**: missing-csrf (doc-gap variant)

**Discriminating context**: All four `*SecurityConfiguration` classes call `.csrf(disable)`. The shared posture is the project's stance (ADR-CANDIDATE-033). The live security pages do not document the cross-mode CSRF stance. Operators transitioning from a CSRF-protecting framework hit POST/PUT/DELETE acceptance with no CSRF tokens — surprising behaviour with no doc surface.

**Full detail**: `detail/REFACTOR-095.md`

---

## REFACTOR-101 — `auth.login-form-credentials` has no default and crashes Spring boot if unset under `auth.type=LOGIN_FORM`. Line 70 uses `@Value("${auth.login-form-credentials}")` with no fallback (compare line 41 / line 42 which both use `${...:default}` form). The shipped `application.yml:37` carries `admin:admin,root:root` so no-override deployments use those credentials, but custom-overrides that supply LOGIN_FORM without credentials fail hard at boot

**Severity**: LOW
**Category**: missing-default

**Discriminating context**: Line 70's `@Value("${auth.login-form-credentials}")` has no fallback. An operator switching `auth.type` from DISABLED → LOGIN_FORM in a customised application.yml without supplying `auth.login-form-credentials` triggers `IllegalArgumentException: Could not resolve placeholder...` which surfaces as a `BeanCreationException` at boot. This is fail-loud (correct posture), but the doc surface does not flag the required-pair nature of these two keys.

**Full detail**: `detail/REFACTOR-101.md`

---

## REFACTOR-106 — LOGIN_FORM permit-all paths are hand-coded as a local constant (lines 49-51 inline the path list) rather than referencing the shared `SecurityConstants.WHITELIST_PATHS`. A maintainer who adds a new always-public path to WHITELIST_PATHS leaves LOGIN_FORM out of sync — paths public in OAUTH2 / LDAP modes require authentication in LOGIN_FORM

**Severity**: LOW
**Category**: doc-code-drift (cross-mode)

**Discriminating context**: `LoginFormSecurityConfiguration.java:49-51` declares the path list inline (`/actuator/health`, `/favicon.ico`, `/ingestion/entities`, `/ingestion/datasources`, `/api/slack/events`); the OAUTH2 + LDAP modes use `SecurityConstants.WHITELIST_PATHS` via `AuthorizationCustomizer.java:22`. The inline list aligns with the shared list today but is not centralised — drift risk for future additions.

**Full detail**: `detail/REFACTOR-106.md`

---

## REFACTOR-107 — No connection-throttling / brute-force protection on LOGIN_FORM — an attacker can submit unlimited login attempts. BCrypt encoding adds ~100ms cost per attempt; this is the only natural rate-limit

**Severity**: LOW
**Category**: no-brute-force-defence

**Discriminating context**: `LoginFormSecurityConfiguration.java:53-66` has no rate-limit filter, no lockout. The only rate-limit is BCrypt's encoding cost (~100ms). For a dev/demo mode this is acceptable; for any production-leaking deployment this is exploitable.

**Full detail**: `detail/REFACTOR-107.md`

---

## REFACTOR-109 — OAuth2 CSRF disabled with no defending comment (line 96). For an SPA + bearer-token / session-cookie deployment this is defensible, but a hardening reviewer cannot distinguish intentional disable from oversight. Same disable in `LDAPSecurityConfiguration.java:143` and `LoginFormSecurityConfiguration.java:54` (cross-mode pattern) but none of the four classes comments the reasoning

**Severity**: LOW
**Category**: missing-csrf (doc-gap variant)

**Discriminating context**: The four-file CSRF disable convention has no defending comment in any class. ADR-CANDIDATE-033 captures the convention; this scope is the doc-gap-per-file consequence.

**Full detail**: `detail/REFACTOR-109.md`

---

## REFACTOR-110 — OAuth2 login-redirect-URI validation is delegated entirely to Spring's default OAuth2 client behaviour; `redirectUri` config field accepts any string and flows verbatim into Spring's `ClientRegistration`. If an operator misconfigures `redirectUri` to a third-party URL, the OAuth2 provider would normally reject, but permissive IdPs allow it

**Severity**: LOW
**Category**: open-redirect (mild)

**Discriminating context**: `OAuthSecurityConfiguration.java:99` calls `.oauth2Login(withDefaults())`. The `redirectUri` config field on `ODDOAuth2Properties.OAuth2Provider` (line 36) accepts any string verbatim. ODD has no allowlist; the platform trusts the OAuth2 provider's redirect validation. This is industry-standard behaviour but worth surfacing for hardening reviews.

**Full detail**: `detail/REFACTOR-110.md`

---

## REFACTOR-116 — customOidcUserService / customOauth2UserService wiring is fragile — `.oauth2Login(withDefaults())` does not explicitly register the custom user-services on the spec. Beans are auto-wired by type via `ReactiveOAuth2UserService<...>` bean lookup. A refactor renaming the beans or changing their generic type parameters could silently revert OAuth2 login to Spring's default user service

**Severity**: LOW
**Category**: fragile-wiring

**Discriminating context**: `OAuthSecurityConfiguration.java:99` calls `.oauth2Login(withDefaults())`; lines 115-139 declare `customOidcUserService` + `customOauth2UserService`. Spring auto-wires by type into the OAuth2 login machinery. A refactor that renames/changes the beans could silently revert behaviour with no test catching it.

**Full detail**: `detail/REFACTOR-116.md`

---

## REFACTOR-122 — Active Directory mode silently ignores `dn-pattern` and `user-filter` config — `ActiveDirectoryLdapAuthenticationProvider(domain, url)` does NOT use BindAuthenticator, so the user-filter / dnPattern configuration is structurally inert under AD. `ODDLDAPProperties.validate()` STILL enforces the dnPattern-OR-filter requirement even in AD mode — operators must configure a search method that's then ignored

**Severity**: LOW
**Category**: ad-config-ignored

**Discriminating context**: `LDAPSecurityConfiguration.java:76-83` constructs `ActiveDirectoryLdapAuthenticationProvider` bypassing BindAuthenticator; the operator's `dn-pattern` / `user-filter` are inert. `ODDLDAPProperties.validate()` (lines 45-48) still requires one of them even in AD mode — confusing.

**Full detail**: `detail/REFACTOR-122.md`

---

## REFACTOR-123 — `management.health.ldap.enabled: false` (the bundled default in `application.yml:242-243`) means `/actuator/health` does NOT include LDAP-server reachability — directory outage invisible to standard health probes

**Severity**: LOW
**Category**: no-health-check

**Discriminating context**: When `auth.type=LDAP`, the bundled application.yml line 242-243 disables LDAP health-check. Operators monitoring health-probes don't see LDAP-server outages.

**Full detail**: `detail/REFACTOR-123.md`

---

## REFACTOR-124 — LDAP bind credentials, search filters, and active-directory.domain are simple `String` fields with NO validation beyond empty-check on url + {dnPattern, filter} XOR. Injection of LDAP filter metacharacters into `dn-pattern` or `user-filter.filter` is operator's responsibility — no sanitisation

**Severity**: LOW
**Category**: missing-validation

**Discriminating context**: `ODDLDAPProperties.java:12-19,36-37` are plain Strings. Spring Security's BindAuthenticator escapes by default in modern versions, but the platform code does not warn about the operator's responsibility for filter pattern safety.

**Full detail**: `detail/REFACTOR-124.md`

---

## REFACTOR-131 — Dead config field — `NotificationsProperties.webhookUrl` (the top-level one on this POJO) has NO consumer. The active webhook URL is `notifications.receivers.webhook.url` read by `NotificationConfiguration#webhookNotificationSender` via `@Value`. An operator setting `notifications.webhookUrl=...` gets silent acceptance and zero effect

**Severity**: LOW
**Category**: dead-code

**Discriminating context**: `NotificationsProperties.java:9` declares `private String webhookUrl;` (top-level). grep across the notification package finds no consumer reading `getWebhookUrl()`. The active key is `notifications.receivers.webhook.url`. The top-level field is dead code.

**Full detail**: `detail/REFACTOR-131.md`

---

## REFACTOR-132 — `notifications.message.downstream-entities-depth` is a runtime config key the POJO does NOT model — consumed via raw `@Value` in `NotificationConfiguration#alertNotificationMessageTranslator`. The `@ConfigurationProperties` surface is incomplete vs the actual config-key namespace

**Severity**: LOW
**Category**: no-config-field

**Discriminating context**: `NotificationConfiguration.java:116-117` reads `notifications.message.downstream-entities-depth` via `@Value` but `NotificationsProperties` has no `message` sub-class. The `@ConfigurationProperties` surface is missing this key.

**Full detail**: `detail/REFACTOR-132.md`

---

## REFACTOR-136 — Slack webhook response-status check is hard-coded `== HttpStatus.OK.value()` (200). Slack's incoming webhook can return 2xx other than 200 in edge cases; non-200 2xx misclassified as failure and logged as error even though Slack accepted the message

**Severity**: LOW
**Category**: status-code-narrow

**Discriminating context**: `AbstractNotificationSender.java:24-27` checks `if (response.statusCode() != HttpStatus.OK.value())`. Slack's incoming webhook may return 2xx variants; the platform's narrow check produces false-positive failure logs and may trigger the fail-soft path even on successful delivery.

**Full detail**: `detail/REFACTOR-136.md`

---

## REFACTOR-140 — Email `password` bound as a plain `String` field on `EmailSenderProperties` with no `@Sensitive` / `@Hidden` / masking annotation. Spring's `/actuator/env` default masks `password`-by-name (partial mitigation), but ODD does not assert the masking explicitly

**Severity**: LOW
**Category**: credential-leak (mild)

**Discriminating context**: `EmailSenderProperties.java:7` declares `private String password;`. Spring's default sanitisation list includes `password` so Spring masks the value in `/actuator/env`, but ODD does not assert this with an annotation.

**Full detail**: `detail/REFACTOR-140.md`

---

## REFACTOR-144 — `@ConditionalOnProperty("housekeeping.enabled", havingValue="true")` with NO `matchIfMissing` — if `housekeeping.enabled` is absent from the resolved configuration (operator deletes the key from a customised application.yml), the `HousekeepingJobManager` bean is NOT instantiated and housekeeping silently does not run

**Severity**: LOW
**Category**: silent-feature-ignored

**Discriminating context**: `HousekeepingJobManager.java:18` carries `@ConditionalOnProperty(value="housekeeping.enabled", havingValue="true")` with no `matchIfMissing` attribute. The integration-test profile flips it to `false` deliberately, but operator misconfiguration (missing key vs `false` key) produces identical no-op behaviour. The docs page describes housekeeping as on-by-default, which is true ONLY because the shipped application.yml ships `enabled: true` — the Java-side guard blocks bean wiring if the key is absent.

**Full detail**: `detail/REFACTOR-144.md`

---

## REFACTOR-147 — No per-job parallelism — single Connection bottleneck. The five HousekeepingJob beans run sequentially on a shared connection. A long DataEntityHousekeepingJob cascade blocks AlertHousekeepingJob and SearchFacetsHousekeepingJob (single-table DELETEs, fast) for minutes

**Severity**: LOW
**Category**: sequential-connection

**Discriminating context**: `HousekeepingJobManager.java:32-35` acquires a single `Connection` from `PGConnectionFactory` and iterates `for (final HousekeepingJob housekeepingJob : housekeepingJobs)` — each job runs synchronously on the same connection. There is no parallelism across the five jobs. Total cycle time is the sum of all jobs' execution times. A slow DataEntityHousekeepingJob blocks AlertHousekeepingJob from running until completion.

**Full detail**: `detail/REFACTOR-147.md`

---

## REFACTOR-148 — No backlog metric — invisible bloat. No counter, no gauge, no `housekeeping.backlog{table=...}` metric exposes the number of rows awaiting deletion. An operator cannot answer 'is housekeeping keeping up?' without manual SQL queries

**Severity**: LOW
**Category**: no-backlog-metric

**Discriminating context**: None of the three jobs emit Micrometer counters or gauges. An operator investigating "is housekeeping keeping up with the soft-delete rate?" has no observable surface — they must manually run `SELECT count(*) FROM alert WHERE status IN (...) AND status_updated_at <= now() - 30 days`. Adding a Prometheus gauge at the start of each cycle would surface backlog growth before it becomes a 14-minute-ShedLock problem.

**Full detail**: `detail/REFACTOR-148.md`

---

## REFACTOR-149 — `lockAtMostFor="14m"` dangerously close to `fixedRate=15m` — under contention or a long cascade, the lock can release before the cycle commits, allowing a SECOND instance to acquire the lock while the first is still finalising. ShedLock's contract is best-effort

**Severity**: LOW
**Category**: lock-window-race

**Discriminating context**: `HousekeepingJobManager.java:25-26` declares `@Scheduled(fixedRate=15, MINUTES)` + `@SchedulerLock(name="housekeepingJob", lockAtLeastFor="14m", lockAtMostFor="14m")`. The 14-minute upper bound is dangerously close to the 15-minute schedule: a job that runs for 14 minutes 1 second releases the lock prematurely and a second instance can acquire it for the next cycle while the first is still committing. Safer setting: `lockAtMostFor` >= 2 × fixedRate (e.g. `30m` for a 15-min rate).

**Full detail**: `detail/REFACTOR-149.md`

---

## REFACTOR-152 — No URL / pattern validation on OAuth2 URI fields — `redirectUri`, `issuerUri`, `authorizationUri`, `tokenUri`, `userInfoUri`, `jwkSetUri`, `logoutUri`, `allowedDomain`, `organizationName` are all plain `String` with no `@URL` / `@Pattern`. Typos like `htp://example` boot successfully and fail at first OAuth2 callback

**Severity**: LOW
**Category**: url-no-validation

**Discriminating context**: `ODDOAuth2Properties.OAuth2Provider` declares 21 fields including 7 URI-shaped fields, none with validation annotations. The narrow-validator (ADR-CANDIDATE-048) does not check URL format. Misconfiguration is detected only at first OAuth2 callback / first logout / first userinfo fetch.

**Full detail**: `detail/REFACTOR-152.md`

---

## REFACTOR-153 — Empty `auth.oauth2.client` map passes the validator and fails downstream with obscure `InMemoryReactiveClientRegistrationRepository` error. Boot fails with a Spring stack trace, not a "you set `auth.type=OAUTH2` but registered zero clients" message

**Severity**: LOW
**Category**: empty-map-passes

**Discriminating context**: `ODDOAuth2Properties.validate()` iterates `getClient().values()` — empty map is a no-op. An operator with `auth.type=OAUTH2` and empty `auth.oauth2.client` boots past validation, then hits `InMemoryReactiveClientRegistrationRepository` constructor's `registrations cannot be empty` error at `OAuthSecurityConfiguration.java:177`. The error is far from the actual root cause.

**Full detail**: `detail/REFACTOR-153.md`

---

## REFACTOR-157 — Provider-required-scope coupling not enforced — GitHub `read:org` and Google `openid` are required for admin-group lookup / OIDC flow but unvalidated at boot. GitHub operator omitting `read:org` from `scope` boots successfully and discovers the admin-group lookup fails only at first admin login

**Severity**: LOW
**Category**: scope-required-unvalidated

**Discriminating context**: `ODDOAuth2Properties.OAuth2Provider.scope: Set<String>` (line 37). OAuth2/OIDC docs and Spring's OAuth2 client both require specific scopes per provider. None enforced at boot. GitHub-admin operator omits `read:org` → admin-group lookup silently returns no groups → admin user assigned USER role only.

**Full detail**: `detail/REFACTOR-157.md`

---

## REFACTOR-158 — General provider-conditional required-fields are not validated at boot — provider-conditional required fields (e.g. Azure logoutUri, GitHub scope-contains-read:org, Google scope-contains-openid) are deferred to runtime usage-sites. Operator's mental model of "boot success = correct config" is incorrect for provider-conditional cases

**Severity**: LOW
**Category**: provider-conditional-unvalidated

**Discriminating context**: This is the umbrella entry for the per-provider gaps (REFACTOR-155, -157, -158) — ADR-CANDIDATE-048 (narrow-validator scope) deliberately limits validation to fields that prevent bean construction. Provider-specific semantic correctness is the operator's responsibility. The mismatch between "boot succeeded" and "deployment will work for my provider" is the operator-confusing surface.

**Full detail**: `detail/REFACTOR-158.md`

---

## REFACTOR-161 — ODDLDAPProperties `@PostConstruct validate()` runs ONLY when auth.type=LDAP — if `auth.type` is NOT LDAP, ODDLDAPProperties is never bound and `auth.ldap.*` keys are silently ignored. An operator pasting the example LDAP config but forgetting `auth.type: LDAP` gets a boot-success deployment using whichever auth mode is active, with the LDAP keys neither used nor flagged

**Severity**: LOW
**Category**: postconstruct-gated-by-conditional

**Discriminating context**: `ODDLDAPProperties.java:9-11` declares `@ConfigurationProperties` without `@Validated`. The bean is instantiated only when `LDAPSecurityConfiguration.java:51`'s `@ConditionalOnProperty(auth.type=LDAP)` evaluates true. If `auth.type` is not LDAP, `ODDLDAPProperties` is never bound, `@PostConstruct validate()` never runs, and operator-supplied `auth.ldap.*` keys are silently ignored. The deployment uses the active auth mode without flagging the dead LDAP config.

**Full detail**: `detail/REFACTOR-161.md`

---

## REFACTOR-162 — `dnPattern` and `userFilter.filter` plain `String` fields with NO injection-aware validation guidance — Spring Security's `BindAuthenticator` and `FilterBasedLdapUserSearch` DO escape LDAP metacharacters in modern versions, but the Properties class does not assert this contract or warn operators of the implicit dependency on Spring Security's escaping

**Severity**: LOW
**Category**: doc-code-drift

**Discriminating context**: `ODDLDAPProperties.dnPattern` + `userFilter.filter` are plain Strings. Operators following the live LDAP docs configure `dn-pattern: uid={0},ou=people,dc=mycompany,dc=com` with `{0}` substituted at runtime with the user-supplied login name. Spring Security's modern versions escape LDAP metacharacters (`(`, `)`, `\\`, `*`, NUL); the Properties class neither asserts this (`@Pattern`) nor documents the implicit dependency.

**Full detail**: `detail/REFACTOR-162.md`

---

## REFACTOR-163 — No `@Validated` annotation on `ODDLDAPProperties` — the platform deliberately chose imperative validation (`@PostConstruct validate()`). Means operators cannot rely on Spring Boot's validation infrastructure to surface multiple errors at once; the first `IllegalStateException` halts boot, operator retries, sees next error, retries again

**Severity**: LOW
**Category**: no-validated

**Discriminating context**: `ODDLDAPProperties.java:9-11` declares `@ConfigurationProperties` only — no `@Validated`. The platform's imperative `@PostConstruct validate()` halts boot on the first throw. Operators with multiple errors (empty URL + missing search method) see only the URL error, retry, see the search-method error, retry again. Spring Boot's `@Validated` + jakarta.validation accumulates errors into a single `ConstraintViolationException`.

**Full detail**: `detail/REFACTOR-163.md`

---

## REFACTOR-168 — `port` is a Java `int` primitive — defaults to 0 when YAML key is absent. JavaMail interprets port=0 as "use the protocol default". For an operator who intends to set port explicitly but typos the key (`port: 587` vs `port-number: 587`), the symptom is "mail goes to port 25" with no boot-time warning

**Severity**: LOW
**Category**: port-default-zero

**Discriminating context**: `EmailSenderProperties.java:12` declares `private int port;` (primitive). Spring's relaxed binder maps the YAML `port` key, but a typo (`port-number` vs `port`) silently leaves the int at 0. JavaMail's `mailSender.setPort(0)` falls back to the protocol-default port (25 for SMTP). The operator's intended 587 / 465 / explicit-port-config is silently bypassed. No `@Min(1) @Max(65535)` validation.

**Full detail**: `detail/REFACTOR-168.md`

---

## REFACTOR-170 — SmtpProperties.auth / starttls values are boxed `Boolean` objects but JavaMail's Properties bag expects `String` values per its documentation. The implicit `Object.toString()` invocation works but is implicit-contract-dependent — a JavaMail version bump could break it

**Severity**: LOW
**Category**: refactor-risk

**Discriminating context**: `NotificationConfiguration.java:65-66` calls `props.put("mail.smtp.auth", Boolean.TRUE)` — Jakarta Mail's docs specify String values ("true" / "false"). The current implementation relies on `Object.toString()` being called downstream when the Properties bag is consumed. This is a working-by-accident implementation; a JavaMail version bump could change the consumer behaviour.

**Full detail**: `detail/REFACTOR-170.md`

---

## REFACTOR-171 — Email recipient list NOT modeled on this `@ConfigurationProperties` POJO — partial-home shape. Operator inspecting the `EmailSenderProperties` source to understand the email channel will miss the recipient-list key entirely. STRENGTHENS REFACTOR-182 (cross-cutting partial-home)

**Severity**: LOW
**Category**: partial-home-properties

**Discriminating context**: `EmailSenderProperties.java` does not declare a `notificationEmails` field. The recipient list `notifications.receivers.email.notification.emails` is read via raw `@Value` in `NotificationConfiguration.java:104`. An operator reading the POJO source sees 5 fields and misses the recipient-list key.

**Full detail**: `detail/REFACTOR-171.md`

---

## REFACTOR-173 — No connection-pool / per-message reuse policy — `JavaMailSenderImpl` opens a new SMTP connection per `.send()` call. For a burst of alerts, each `send()` is a fresh TCP+STARTTLS handshake — latency-amplified and load-amplified on the SMTP relay

**Severity**: LOW
**Category**: no-conn-pool

**Discriminating context**: `NotificationConfiguration.java:51-71` constructs the JavaMail Properties bag with no connection-pool keys (`mail.smtp.connectionpoolsize` etc.). Each `EmailNotificationSender.send()` opens a fresh SMTP connection. For a burst of N alerts × M recipients, this is N × M TCP+STARTTLS handshakes against the relay.

**Full detail**: `detail/REFACTOR-173.md`

---

## REFACTOR-174 — No `Reply-To`, `Cc`, `Bcc`, custom headers, or DKIM-signing surface. Operators wanting `Reply-To: alerts@team.example.com` so recipients can reply to the team rather than the bot sender cannot configure this. The freemarker template controls body only

**Severity**: LOW
**Category**: no-reply-headers

**Discriminating context**: `EmailNotificationSender.java:51,55` calls only `setSubject()` and `setTo()` on `MimeMessageHelper`. There are no `setReplyTo` / `addCc` / `addBcc` calls and no API for custom headers / DKIM. Operators wanting basic email-routing features cannot configure them.

**Full detail**: `detail/REFACTOR-174.md`

---

## REFACTOR-177 — Cross-subsystem lock-id collision risk — DataCollab Properties evidence is the third sidecar in the cross-cutting REFACTOR-183 triangulation. The application.yml defaults (90 / 100 / 110 / 120) are non-overlapping; the code has zero startup assertion that they STAY non-overlapping. An operator who copies one default into another override produces a deployment where two subsystems contend on the same advisory lock

**Severity**: LOW
**Category**: advisory-lock-collision

**Discriminating context**: This is the per-subsystem view of REFACTOR-183's cross-cutting registry absence. DataCollabProperties carries operator-tuneable lock IDs without per-subsystem disjoint-allocation enforcement. The cross-cutting fix (REFACTOR-183) closes this gap as a side-effect.

**Full detail**: `detail/REFACTOR-177.md`

---

## REFACTOR-178 — DataCollaboration partial-home `@ConfigurationProperties` — 3 keys here (`sender-message-advisory-lock-id`, `receive-event-advisory-lock-id`, `sending-messages-retry-count`); 3 keys via `@Value` elsewhere (`enabled`, `slack-oauth-token`, `message-partition-period`). Folds into REFACTOR-182 (cross-cutting partial-home)

**Severity**: LOW
**Category**: partial-home-properties

**Discriminating context**: See REFACTOR-182 for the cross-cutting framing. The DataCollab-specific view: a maintainer reading `DataCollaborationProperties.java` sees 3 fields and misses 3 keys.

**Full detail**: `detail/REFACTOR-178.md`

---

## REFACTOR-179 — `slack-oauth-token` consumed via `@Value` in `DataCollaborationConfiguration` rather than as a `String` field on `DataCollaborationProperties` — bypasses the `@ConfigurationProperties` actuator sanitiser registry. Spring's default `Sanitizer` DOES mask keys ending in `token` so the present masking is correct, but a future rename (e.g. `slack-bot-credential`) would silently un-mask it

**Severity**: LOW
**Category**: refactor-risk

**Discriminating context**: `DataCollaborationConfiguration.java:20-21` reads the Slack OAuth token via `@Value` rather than as a typed `String` field on `DataCollaborationProperties`. The actuator-env sanitiser relies on the field-name pattern (`token`) — a future rename to `slack-bot-credential` would silently bypass the default mask. The risk is preventive (no current vulnerability) but architectural.

**Full detail**: `detail/REFACTOR-179.md`

---

## REFACTOR-180 — No `@Validated` annotation on `DataCollaborationProperties`, no `@Min(0)` / `@Max(...)` JSR-303 constraints on the int fields. The single `@PostConstruct` validator is hand-written; future fields added without an explicit `if (... < 0) throw` would silently bypass validation

**Severity**: LOW
**Category**: no-validated

**Discriminating context**: `DataCollaborationProperties.java:7-21` has no `@Validated`. The `@PostConstruct validate()` is hand-written and only checks `sendingMessagesRetryCount >= 0`. Future-fields added without explicit `if (... < 0) throw` lines would silently bypass validation. Pairs with REFACTOR-163 (same shape on ODDLDAPProperties).

**Full detail**: `detail/REFACTOR-180.md`

---

## REFACTOR-184 — Docs YAML key `username-attribute` (single word, hyphen between `attribute`) does not match POJO field `userNameAttribute` (camelCase split). Spring's relaxed binding converts `username-attribute` → `usernameAttribute` (single word, no `user-name` split), NOT to `userNameAttribute`. To bind, operators must write `user-name-attribute` (with the dash splitting `user` and `name`). The live docs at `/oauth2-oidc` consistently use `username-attribute` — operators following docs verbatim get a silently-unbound field

**Severity**: LOW
**Category**: doc-spelling-drift

**Discriminating context**: `ODDOAuth2Properties.OAuth2Provider.userNameAttribute` (line 44) is declared in camelCase. Spring's `@ConfigurationProperties` relaxed-binding rules treat `user-name-attribute` (kebab with hyphen between `user` and `name`) as the matching key for `userNameAttribute`, NOT `username-attribute` (single word). The live docs at `/oauth2-oidc` consistently use `username-attribute` in the Common-to-All-Providers section (verified 2026-05-12). Operators following docs verbatim configure `username-attribute: email` → Spring relaxed-binds to `usernameAttribute` (which is NOT a POJO field) → silent…

**Full detail**: `detail/REFACTOR-184.md`

---

## REFACTOR-217 — SecurityRule `/term` singular vs OpenAPI `/terms` plural — path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM permission gates

**Severity**: HIGH
**Category**: buggy-default (path-mismatch class)

**Discriminating context**: `SecurityConstants.java:237-239` registers `new PathPatternParserServerWebExchangeMatcher("/api/dataentities/{data_entity_id}/term", POST)` (SINGULAR `term`); the OpenAPI spec at `openapi.yaml:973` declares the operation path as `/api/dataentities/{data_entity_id}/terms` (PLURAL). The controller `@Override` (`DataEntityController.java:149-156`) inherits the plural path from the generated `DataEntityApi`. `AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:24-30`) only invokes the `manager(rule.type(), extractors, permissionService, rule.permission())` permission check when…

**Full detail**: `detail/REFACTOR-217.md`

---

## REFACTOR-218 — Markdown / HTML description body stored verbatim without backend sanitisation; UI renders via `rehype-raw` without `rehype-sanitize` — stored-content-injection / potential stored-XSS

**Severity**: HIGH
**Category**: missing-sanitisation

**Discriminating context**: `setInternalDescription` (`ReactiveDataEntityRepositoryImpl.java:430-438`) writes the request body verbatim into the `internal_description` `text` column. There is no `Jsoup.clean`, no `Encode.html`, no allowlist, no length cap, no `@Size` on the form-data DTO. The UI renders via `@uiw/react-markdown-preview@4.2.2` (`Markdown.tsx:113-124`), which transitively pulls in `rehype-raw@6.1.1` (`pnpm-lock.yaml:5922`). `rehype-raw` parses raw HTML embedded in Markdown into AST nodes that `react-markdown` then renders. NO `rehype-sanitize` is configured anywhere in the UI (`grep -rln 'rehype-sanitize'…

**Full detail**: `detail/REFACTOR-218.md`

---

## REFACTOR-219 — `upsertDataEntityInternalDescription` silently returns 200 OK with empty body when the data entity does not exist — misleading "upsert" semantic

**Severity**: MEDIUM
**Category**: missing-error-translation

**Discriminating context**: `setInternalDescription` is `DSL.update(DATA_ENTITY).set(INTERNAL_DESCRIPTION, …).where(DATA_ENTITY.ID.eq(dataEntityId)).returning()` (`ReactiveDataEntityRepositoryImpl.java:432-435`). If `dataEntityId` does not exist, the query updates 0 rows, the `mono(query).map(r -> r.into(DataEntityPojo.class))` returns `Mono.empty`, the rest of the reactive pipeline collapses, and the controller returns `200 OK` with an empty body — NOT `404 Not Found`. The operation is documented as an "upsert" (`openapi.yaml:929-930`, `summary: "Upsert DataEntity's internal description"`) — implying CREATE-or-UPDATE…

**Full detail**: `detail/REFACTOR-219.md`

---

## REFACTOR-220 — `view_count` inflation loop PRIMARY-SOURCE CONFIRMED — home-page Popular ranking trivially manipulable

**Severity**: HIGH
**Category**: missing-rate-limit + missing-defence-in-depth

**Discriminating context**: PRIMARY-SOURCE CONFIRMATION of the inflation loop:

**Full detail**: `detail/REFACTOR-220.md`

---

## REFACTOR-221 — No index on `data_entity.view_count` — every Popular page render is a sequential scan + sort

**Severity**: MEDIUM
**Category**: missing-index

**Discriminating context**: The Popular ranking `ORDER BY view_count DESC` is executed without an index on `view_count`. Verified across all 91 Liquibase migration files: only `V0_0_10__add_counters.sql` (adds the column with `DEFAULT 0`) and `V0_0_37__update_view_count.sql` (adds `NOT NULL`) touch the column — no `CREATE INDEX` statement on `view_count` anywhere. For a deployment with 10K+ data entities (a realistic scale), every Popular page-load is a sequential scan + in-memory sort. Worst-case Postgres plan: `Sort -> Seq Scan on data_entity ... Filter: (NOT hollow AND status != deleted_id)`. For N=10K entities this…

**Full detail**: `detail/REFACTOR-221.md`

---

## REFACTOR-222 — `EXCLUDE_FROM_SEARCH` flag is NOT applied to `listPopular` — internal / hidden entities surface on the platform's home page

**Severity**: MEDIUM
**Category**: missing-filter

**Discriminating context**: Every other list-shaped surface in the codebase respects `EXCLUDE_FROM_SEARCH` — verified at NINE distinct locations: `ReactiveSearchEntrypointRepositoryImpl.java:91, 117, 149, 181, 555`, `ReactiveSearchFacetRepositoryImpl.java:167, 461, 575`, `JooqFTSHelper.java:149`, plus `ReactiveDataEntityRepositoryImpl.java:448` (countByState) and `:974` (getDataEntityDefaultConditions). The `cteDataEntitySelect` used by `listPopular` (`ReactiveDataEntityRepositoryImpl.java:909-939`) applies `HOLLOW.isFalse()` (line 918) and `addSoftDeleteFilter` (line 916) — but NOT `EXCLUDE_FROM_SEARCH`. An operator…

**Full detail**: `detail/REFACTOR-222.md`

---

## REFACTOR-223 — Tag side-door — `DATA_ENTITY_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE` permission; scope-asymmetry pollutes the tag dropdown across tenants

**Severity**: MEDIUM
**Category**: permission-bypass

**Discriminating context**: A caller with `DATA_ENTITY_TAGS_UPDATE` on any single data entity can submit `tag_name_list: ['arbitrary-new-name']` and a new row appears in the global `tag` directory (visible to every other user via `GET /api/tags/popular`). The documented permission story ("`TAG_CREATE` controls the Tag directory") is incomplete: `DATA_ENTITY_TAGS_UPDATE` also grows the directory, by spec-acknowledged design (ADR-CANDIDATE-065 — auto-create-on-miss). The **scope asymmetry** exacerbates the consequence: `TAG_CREATE` is `MANAGEMENT`-scoped (always unconditional, granted via admin Policies only) while…

**Full detail**: `detail/REFACTOR-223.md`

---

## REFACTOR-224 — `getMyObjects` returns silent empty Flux for unlinked users — operator-UX trap

**Severity**: LOW
**Category**: missing-error-translation (UX framing)

**Discriminating context**: A user authenticated under LOGIN_FORM/OAUTH2/LDAP who has not been linked to an `Owner` record via `OwnerAssociationRequest` admin-resolution OR direct `POST /api/owners/{owner_id}/users` mapping receives `200 OK` with body `[]` from `GET /api/dataentities/my`. There is no 401, no 403, no `OwnerNotAssociatedException`, no flash banner via `getDataEntitiesUsage`, no header signalling "you need an owner link." A new user landing on the `Recommended → My Objects` panel sees an empty strip with no explanation, indistinguishable from "I own nothing yet." The cure is documented elsewhere (operator…

**Full detail**: `detail/REFACTOR-224.md`

---

## REFACTOR-225 — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` — owner-scoping is a single-point-of-failure at the anchor set (no JOIN-side defence-in-depth)

**Severity**: MEDIUM
**Category**: missing-defence-in-depth

**Discriminating context**: The lineage variants of `/my` (`getMyObjectsWithUpstream` / `getMyObjectsWithDownstream`) use a DIFFERENT code path from the base `/my`. They call `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns(streamKind)` which: (a) fetches the user's owned data entities (anchor — owner-scoped), (b) traverses the lineage graph one hop (`lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), streamKind)`), (c) returns the reached oddrns FILTERED to exclude the originally-owned set (`Predicate.not(oddrns::contains)` at line 37). Then `repository.listByOddrns(oddrns, false, false,…

**Full detail**: `detail/REFACTOR-225.md`

---

## REFACTOR-226 — `createDataEntityTagsRelations` operationId vs implementation drift — PUT replace-all semantics under create-language naming

**Severity**: MEDIUM
**Category**: name-behaviour-drift

**Discriminating context**: The OpenAPI spec, the operationId, the controller method name, and the spec summary all say "create" / "creates" for an operation that diffs-and-deletes. A consumer reading the spec who sends `PUT /api/dataentities/{id}/tags` with `tag_name_list: ['new-tag']` expecting "add new-tag, keep existing" will discover that ALL OTHER internal tags on the data entity are deleted. The UI's redux action is correctly named `updateDataEntityTagsActionType`, masking this drift from UI users — but third-party API consumers reading only the spec have no warning. The actual semantic is "replace internal tag…

**Full detail**: `detail/REFACTOR-226.md`

---

## REFACTOR-227 — Description-update side-effect bypasses `DATA_ENTITY_ADD_TERM` permission via `[[ns:term]]` injection

**Severity**: MEDIUM
**Category**: permission-bypass

**Discriminating context**: A caller with only `DATA_ENTITY_DESCRIPTION_UPDATE` (no `DATA_ENTITY_ADD_TERM` permission) can still create term-relation rows by injecting `[[ns:term]]` mentions into the description body. `DataEntityServiceImpl.upsertDescription` (line 328) invokes `termService.handleDataEntityDescriptionTerms` unconditionally. `TermServiceImpl.handleDataEntityDescriptionTerms` (line 200) emits `TERM_ASSIGNMENT_UPDATED` regardless of the caller's term-write permission. The dedicated `DATA_ENTITY_ADD_TERM` permission (`SecurityConstants.java:237-239`) is BYPASSED by the description-write path. The Policy…

**Full detail**: `detail/REFACTOR-227.md`

---

## REFACTOR-228 — `TermAssignmentActivityHandler` re-queries the data-entity's full term list TWICE per assignment for BEFORE/AFTER state capture — O(N) cost per O(1) operation

**Severity**: LOW
**Category**: performance-redundant-query

**Discriminating context**: `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` on `TermServiceImpl.linkTermWithDataEntity` triggers `TermAssignmentActivityHandler` (line 20-61), which captures BEFORE and AFTER terms-list state by re-querying `termRepository.getDataEntityTerms(dataEntityId)` TWICE per call (line 29-43 and 41-43). For data-entities with many terms (50+), this is two full-list queries per single-term-link write — an O(N) cost on a single-term-link write. The cost is acceptable for typical term counts but a hidden quadratic-shape cost on extreme cases where an entity has hundreds of terms and the operator team…

**Full detail**: `detail/REFACTOR-228.md`

---

## Refresh note (2026-05-19H batch — reactive-repository layer deepening)

Five new sidecars (`ReactiveDataEntityRepositoryImpl`, `ReactiveLineageRepositoryImpl`, `ReactiveOwnershipRepositoryImpl`, `ReactivePolicyRepositoryImpl`, `ReactiveAlertRepositoryImpl`) — the repository-axis batch. **16 new scopes added** (REFACTOR-229..244). **6 existing scopes strengthened**: REFACTOR-024, REFACTOR-082, REFACTOR-202, REFACTOR-203, REFACTOR-207, REFACTOR-222 — all now confirmed at the SQL primary source.

The 5 highest-leverage 2026-05-19H additions are:
- **REFACTOR-229 (SQL-format injection vector in `getHighlightedResult` via `String.formatted()` on user-writable inputs; HIGH — anonymous remote SQL injection under DISABLED-mode)**
- **REFACTOR-230 (`getRolesPolicies` RBAC hot path returns soft-deleted policies — orphan role_to_policy bindings still grant permissions; HIGH)**
- **REFACTOR-231 (AlertManager webhook payload-driven alert creation with no caller-ID check — entity_oddrn from untrusted payload; HIGH; extends REFACTOR-082)**
- **REFACTOR-232 (cross-batch correction: createOwnership duplicate-key is HTTP 400 + USR003, NOT 5xx as batch-F stated; MEDIUM correction-priority)**
- **REFACTOR-233 (listByOwner empty-result counter uses platform-wide count, not owner-scoped; MEDIUM UX bug)**

**Cross-cutting findings (batch H)**:
- (a) The repository layer is uniformly transaction-free (5/5 repositories — strengthens ADR-CANDIDATE-067)
- (b) SQL-injection surface area is narrow but exists at ONE site (REFACTOR-229) — the platform's convention is parameterised jOOQ DSL; this is the lone violator
- (c) RBAC observability is broken across three layers: no audit on mutations (REFACTOR-188) + no soft-delete filter on hot path (REFACTOR-230) + no method-level observability (REFACTOR-244)
- (d) Owner-scoping is anchor-set single-point-of-failure with no JOIN-side defence-in-depth (REFACTOR-225 + REFACTOR-237 — 2-sidecar SQL-layer confirmation; ADR-CANDIDATE-075 codifies the architecture, the gap is the missing depth)
- (e) Cross-batch correction propagation: batch-F's createOwnership 5xx-on-duplicate misclaim corrected at SQL primary source via REFACTOR-232

## REFACTOR-229 — SQL-format injection vector in `ReactiveDataEntityRepositoryImpl.getHighlightedResult` via `String.formatted(text, tsQuery)` on user-writable inputs

**Severity**: HIGH
**Category**: missing-sanitisation + injection

**Discriminating context**: `getHighlightedResult` (`ReactiveDataEntityRepositoryImpl.java:799-806`) builds raw SQL by calling `String.formatted(text, tsQuery)` and feeds the resulting string into `DSL.field(sql, String.class)`. The two `%s` slots accept user-writable data (description / tags / search query). Under `auth.type=DISABLED` (default deployment), both gates are bypassed: anonymous network probes can write the payload AND trigger the read. This is the only raw-SQL-format path identified across the 5-repository batch.

**Full detail**: `detail/REFACTOR-229.md`

---

## REFACTOR-230 — `ReactivePolicyRepositoryImpl.getRolesPolicies` (RBAC hot path) returns SOFT-DELETED policies — orphan role_to_policy bindings still grant permissions

**Severity**: HIGH
**Category**: missing-defence-in-depth (authorization)

**Discriminating context**: `getRolesPolicies` (`ReactivePolicyRepositoryImpl.java:32-35`) is invoked on EVERY authorized HTTP request through both permission extractors. The JOIN has **no `policy.deleted_at IS NULL` predicate**. Combined with the absence of FK cascade between `policy.deleted_at` and `role_to_policy.policy_id`, a soft-deleted policy with surviving role bindings continues to confer permissions. The service-layer defence at `PolicyServiceImpl.delete` (line 89-92) is single-layer; any path bypassing it (direct DB UPDATE, future refactor) creates the orphan-binding gap.

**Full detail**: `detail/REFACTOR-230.md`

---

## REFACTOR-231 — AlertManager webhook payload-driven alert creation with no caller-ID check — `entity_oddrn` from untrusted payload determines which data entity the alert attaches to

**Severity**: HIGH
**Category**: missing-auth + missing-validation

**Discriminating context**: `AlertManagerController.alertManagerWebhook` (path `POST /ingestion/alert/alertmanager`) carries no `@PreAuthorize`, is not matched by IngestionDataEntitiesFilter. The service consumes `externalAlert.getLabels().get("entity_oddrn")` (`AlertServiceImpl.java:178`) directly from the payload, then calls `alertRepository.createAlerts(...)` (`ReactiveAlertRepositoryImpl.java:332-342`) which issues `INSERT … RETURNING` with no validation, no caller-ID check, no oddrn-ownership check. The payload's `entity_oddrn` is UNTRUSTED yet DECIDES which data entity the alert attaches to. Anonymous remote alert injection possible under DISABLED-mode default.

**Full detail**: `detail/REFACTOR-231.md`

---

## REFACTOR-232 — Cross-batch correction: `createOwnership` duplicate-key surfaces as HTTP 400 + USR003, NOT 5xx as batch-F stated; the ExceptionUtils translation path is the canonical fix-up

**Severity**: MEDIUM (cross-batch correction-priority)
**Category**: error-mapping

**Discriminating context**: The batch-F sidecar `createOwnership.md:bugs_limitations_corner_cases[2]` line 149 incorrectly stated that the duplicate-key path surfaces as 5xx. The SQL primary-source inspection at `ReactiveOwnershipRepositoryImpl.java:52-58` + `JooqReactiveOperations.java:41` + `ExceptionUtils.java:69-71` + `ControllerAdvice.java:36-40` confirms the actual surface is HTTP 400 with `USR003` and the friendly message `'Ownership for this data entity and owner already exists'`. The misclaim should be propagated as a substrate correction; downstream artefacts (DOC-NNN drafts, API-reference docs, integration-test expectations) inherited the wrong shape.

**Full detail**: `detail/REFACTOR-232.md`

---

## REFACTOR-233 — `ReactiveAlertRepositoryImpl.listByOwner` empty-result counter uses platform-wide count, not owner-scoped count — UX badge misreports total when caller's owner has zero alerts

**Severity**: MEDIUM
**Category**: ux-bug (label-asymmetry / wrong-count)

**Discriminating context**: `listByOwner` (lines 160-179) passes `countAlertsWithStatusOpen()` (line 177) — the platform-wide count — into `pageifyResult` as the `emptyRecordTotalCounter`. The expected method is `countAlertsWithStatusOpenByOwner(ownerId)`. When the caller's owner has zero open alerts, the response's `Page.total` reports the platform-wide count instead of zero. The UI's pagination badge silently misreports.

**Full detail**: `detail/REFACTOR-233.md`

---

## REFACTOR-234 — `ReactiveAlertRepositoryImpl.createAlerts` has no idempotency on AlertManager webhook retries — INSERT without ON CONFLICT; Prometheus retry produces duplicate ALERT rows

**Severity**: MEDIUM
**Category**: idempotency

**Discriminating context**: `createAlerts` (`ReactiveAlertRepositoryImpl.java:332-342`) builds a sequence of INSERT statements with no `.onConflict(...)` clause. The AlertManager webhook path (`AlertServiceImpl.handleExternalAlerts`) bypasses the `AlertActionResolver` de-duplication used by the ingestion path. Prometheus AlertManager retries failed webhook deliveries — each retry produces a duplicate ALERT row. No `external_alert_fingerprint` UNIQUE constraint backstops the de-duplication.

**Full detail**: `detail/REFACTOR-234.md`

---

## REFACTOR-235 — Recursive CTE in `ReactiveAlertRepositoryImpl.getChildOddrnsLinageByOwnOddrnsCte` uses array-membership cycle check that is O(N²) in jOOQ-emitted SQL on heavy-fanout graphs

**Severity**: MEDIUM
**Category**: performance-redundant-work (recursive-CTE evaluation cost)

**Discriminating context**: `getChildOddrnsLinageByOwnOddrnsCte` (`ReactiveAlertRepositoryImpl.java:429-454`) is a SEPARATE recursive CTE from `ReactiveLineageRepositoryImpl`'s lineage-canvas CTE (REFACTOR-207). It accumulates parent oddrns in a `String[]` field per row and adds `notEqual(DSL.all(parentOddrnArrayField))` as cycle prevention. The check works for sane graphs but the array grows linearly per iteration; total work for D-depth, B-branching is O(D × B^D × N). For deep+branchy lineages the cost spikes into multi-million-row CTE evaluation; Postgres CPU saturation manifests.

**Full detail**: `detail/REFACTOR-235.md`

---

## REFACTOR-236 — Alert reopen-guard read-then-write race lacks DB-level UNIQUE constraint backstop (SQL-layer confirmation; STRENGTHENS REFACTOR-037)

**Severity**: MEDIUM
**Category**: race-condition (defence-in-depth at SQL layer)

**Discriminating context**: SQL primary-source confirmation of REFACTOR-037 (existing). The read `openAlertWithTheSameTypeExistsForDataEntity` (lines 397-420) has NO `FOR UPDATE`; the write `updateAlertStatus` (lines 297-306) has NO `FOR UPDATE`; the service composition at `AlertServiceImpl.java:124-131` runs outside any `@ReactiveTransactional` boundary (per ADR-CANDIDATE-073 + ADR-CANDIDATE-067). There is NO `CREATE UNIQUE INDEX ... WHERE status = 'OPEN'` partial-index constraint to backstop concurrent reopen attempts at the schema level.

**Full detail**: `detail/REFACTOR-236.md`

---

## REFACTOR-237 — Owner-scoping in lineage is anchor-set single-point-of-failure (no JOIN-side defence-in-depth at lineage CTE); SQL-layer confirmation that STRENGTHENS REFACTOR-225

**Severity**: MEDIUM
**Category**: missing-defence-in-depth (authorization)

**Discriminating context**: SQL primary-source confirmation: the lineage table has NO owner column (verified across all 4 migrations — V0_0_2 + V0_0_17 + V0_0_26 + V0_0_79). JOIN-side filtering at the lineage CTE is structurally impossible. The CTE at `ReactiveLineageRepositoryImpl.java:163-175` filters ONLY on `is_deleted`; no owner predicate. The anchor-set defence at `DataEntityRelationsServiceImpl.java:26` (`fetchAssociatedOwner()`) is the single defence point for `/my` lineage variants. ADR-CANDIDATE-075 (NEW) codifies the architecture; this scope is the missing defence-in-depth.

**Full detail**: `detail/REFACTOR-237.md`

---

## REFACTOR-238 — No covering index for soft-delete OR-predicate on either-endpoint in `softDeleteLineageRelations` / `restoreLineageRelations` — cascade degrades to sequential scan

**Severity**: MEDIUM
**Category**: missing-index

**Discriminating context**: `softDeleteLineageRelations` (lines 92-99) and `restoreLineageRelations` (102-109) use `LINEAGE.CHILD_ODDRN.in(...).or(LINEAGE.PARENT_ODDRN.in(...))`. The PK `(parent, child, establisher)` supports the parent_oddrn leg only; the child_oddrn leg has NO covering index (V0_0_17:119 adds only `lineage_establisher_oddrn`). For ≥1M lineage rows, Postgres degrades to sequential scan; soft-delete cascades stall for seconds-to-minutes under load.

**Full detail**: `detail/REFACTOR-238.md`

---

## REFACTOR-239 — `policy.is_deleted` column is dead schema — soft-delete base writes only `deleted_at`; schema reader misled into expecting boolean tracking

**Severity**: MEDIUM
**Category**: dead-code (schema-level)

**Discriminating context**: DDL declares `is_deleted boolean NOT NULL DEFAULT FALSE` on `policy` (V0_0_55:26). The soft-delete base writes ONLY `deleted_at` (`ReactiveAbstractSoftDeleteCRUDRepository.java:106-110`); the application never writes `is_deleted`. The column is always `FALSE` even for soft-deleted rows; a schema reader / DBA / forensic SQL user reaches the wrong conclusion. The same pattern is dead schema across multiple platform tables. Cross-link with ADR-CANDIDATE-068 (the soft-delete inheritance taxonomy clarifies that `deleted_at` is the contract; `is_deleted` is vestigial).

**Full detail**: `detail/REFACTOR-239.md`

---

## REFACTOR-240 — `ReactivePolicyRepositoryImpl.getRolesPolicies` is on the RBAC hot path with no caching — every authorized HTTP request hits Postgres

**Severity**: MEDIUM
**Category**: missing-cache (performance hot-path)

**Discriminating context**: `getRolesPolicies` (`ReactivePolicyRepositoryImpl.java:32-38`) is invoked on EVERY authorized HTTP request through both `ManagementPermissionExtractor` and `AbstractContextualPermissionExtractor`. No caching at any layer. For a stable `(roleIds)` set, the result is stable for the lifetime of the role-policy edges (only RBAC-directory mutations invalidate). Short-TTL request-scoped or `@Cacheable` cache would absorb 99%+ of DB load. The platform has Spring Cache infrastructure available; the RBAC hot path is the largest single uncached read in the platform.

**Full detail**: `detail/REFACTOR-240.md`

---

## REFACTOR-241 — `getLineageRelations(List<String>)` builds OR-predicate where both conjuncts are logically equivalent — decorative SQL misleads future maintainers

**Severity**: LOW
**Category**: misleading-code

**Discriminating context**: `ReactiveLineageRepositoryImpl.java:113-117` builds `WHERE is_deleted = false AND ((parent in oddrns AND child in oddrns) OR (child in oddrns AND parent in oddrns))`. The two OR-branches are LOGICALLY EQUIVALENT under conjunction commutativity. Postgres collapses the predicate; the source is misleading. A future maintainer "simplifying" the apparent redundancy to a broader OR-of-either-endpoint semantic would silently change the DEG-internal-lineage assembly contract. The existing test does not distinguish the two semantics.

**Full detail**: `detail/REFACTOR-241.md`

---

## REFACTOR-242 — `LineageDepth.empty()` semantics are call-site folklore — the `empty` flag is never read; only the `-1` value matters

**Severity**: LOW
**Category**: misleading-API (call-site folklore)

**Discriminating context**: `LineageDepth.empty()` returns `new LineageDepth(-1, true)` but `lineageCte` (lines 150-176) NEVER reads the `boolean empty` field. The recursion terminates because `tDepth.lessThan(-1)` is FALSE on the first iteration → seed-only output. The name `empty()` is misleading: callers reading `DataEntityRelationsServiceImpl.java:34` (`getLineageRelations(set, LineageDepth.empty(), kind)`) might plausibly expect zero edges; actual behaviour is "seed-only (one-hop)". The `boolean empty` field appears vestigial; the class signature lies about its semantics.

**Full detail**: `detail/REFACTOR-242.md`

---

## REFACTOR-243 — `AlertHousekeepingJob` uses JDBC `Connection` while `ReactiveAlertRepositoryImpl` uses R2DBC `DatabaseClient` — no shared transaction scope; read-then-purge race produces silent state transitions

**Severity**: LOW
**Category**: dual-driver-race (latent)

**Discriminating context**: The platform splits scheduled-job paths (synchronous JDBC) and request paths (reactive R2DBC) — `AlertHousekeepingJob.java:24` uses JDBC `Connection`; `JooqReactiveOperations.java:28` uses R2DBC `DatabaseClient`. The two share no transaction scope. A read in flight while housekeeping commits a DELETE produces either a stale row in the UI (then the next refresh shows it gone) or `Mono.empty()` if the DELETE committed first. Benign UX confusion, not a correctness gap. The pattern repeats across `DataEntityHousekeepingJob` and `EmptyPartitionsHousekeepingJob`.

**Full detail**: `detail/REFACTOR-243.md`

---

## REFACTOR-244 — No method-level observability across the 5 reactive-repository batch — no `@Timed`, no Micrometer counters, no log entries; latency regressions invisible at the repository boundary

**Severity**: LOW
**Category**: observability (cross-cutting)

**Discriminating context**: Across all 5 repository sidecars in batch H, the consistent finding: zero `@Timed`, zero `Counter`, zero log emissions on success paths. RBAC mutations are FORENSICALLY SILENT at the persistence layer (REFACTOR-188 cross-link). A latency regression in any of the 19+ methods on `ReactiveAlertRepositoryImpl` or 30+ on `ReactiveDataEntityRepositoryImpl` surfaces ONLY through downstream R2DBC connection-pool / WebFlux histogram aggregates. AOP-driven repository instrumentation would close the gap; the absence is acceptable for early-stage but blocks scale-time regression detection.

**Full detail**: `detail/REFACTOR-244.md`

---


## Refresh note — batch ZB (2026-05-21 — DataSourceController endpoint-surface method-level deepening)

Five new method-level sidecars enriched the DataSourceController endpoint surface (`getDataSourceList`, `registerDataSource`, `updateDataSource`, `deleteDataSource`, `regenerateDataSourceToken`; batch W had enriched only the controller CLASS node). Per the Rule-0 wisdom test the batch is GAP-heavy as expected for an endpoint-deepening pass: **11 new refactoring scopes** (REFACTOR-581..591) + **8 existing scopes STRENGTHENED**, and **zero new ADR candidates** (the two ADR-shaped findings triangulate onto existing ADR-CANDIDATE-017 + ADR-CANDIDATE-068 — see `implicit-adrs/index-batch-ZB-append.md`).

**8 existing scopes STRENGTHENED** — the DataSource token-rotation path (`regenerateDataSourceToken`) shares the EXACT same `TokenGeneratorImpl` + `ReactiveTokenRepositoryImpl` code as the Collector token-rotation path, so it confirms the SAME gaps on a sibling endpoint (these are strengthens, not new entries — one gap site, two endpoints):
- **REFACTOR-045** (non-SecureRandom token RNG) — DataSource regenerate confirms `TokenGeneratorImpl.java:49`; re-scope to "every token row".
- **REFACTOR-046** (no rotation audit log) — DataSource regenerate confirms zero `log.*` + single-state `updated_by`.
- **REFACTOR-047** (no rotation grace period) — DataSource regenerate confirms the destructive in-place cutover; the data-source token IS the credential `IngestionDataEntitiesFilter` validates.
- **REFACTOR-048** (token plaintext-at-rest) — DataSource regenerate confirms the shared plaintext `token` table + plaintext `.equals` verify.
- **REFACTOR-049** (DISABLED-mode rotation bypass) — DataSource regenerate confirms the `DATA_SOURCE_TOKEN_REGENERATE` bypass under `auth.type=DISABLED` (member of the REFACTOR-185 cross-cutting cluster).
- **REFACTOR-062** (rotation response no `Cache-Control: no-store`) — DataSource regenerate confirms the bare `.map(ResponseEntity::ok)` shape.
- **REFACTOR-064** (rotation service method NOT `@ReactiveTransactional`) — DataSource regenerate confirms; **carries the batch-ZB CROSS-BATCH CORRECTION** — the method-level primary-source read confirms LOW code-smell, NOT atomicity bug, and records a Rule-6 SUPERSEDES of the test-map registry's stale CRITICAL `TEST-GAP-749` (see `state/coherence-conflicts-batch-ZB.md`).

**Coherence (Rule 6)**: cross-registry grep confirmed all new findings are SAME-polarity with the other registries — `feature-flows` F-010 already carries `orphan_token_row_no_housekeeping` (REFACTOR-581 back-links F-010); `concepts/index.yaml` already carries the "NAMESPACE_CREATE side-door confirmed at 4 sister services (... DataSource ...)" invariant (REFACTOR-584 is SAME-polarity, the endpoint-anchored instance); `test-map` already carries TEST-GAP-755 (Collector orphan-token — REFACTOR-581's sibling). ONE SUPERSEDES surfaced and logged: `test-map` TEST-GAP-749's CRITICAL atomicity-bug framing of `regenerateDataSourceToken`'s missing `@ReactiveTransactional` is refuted by the method-level primary-source read (single atomic UPDATE + in-memory regenerate → no partial-write window); logged to `state/coherence-conflicts-batch-ZB.md` for the test-mapper to drop TEST-GAP-749 CRITICAL→LOW. Zero CONTRADICTS.

**Batch-ZB leverage ranking** (new entries; `triangulation_count × severity_weight`, CRITICAL=8/HIGH=4/MEDIUM=2/LOW=1):
1. REFACTOR-581 — orphan token on data-source delete — HIGH×2 = 8
2. REFACTOR-584 — namespace-create permission bypass (register+update) — MEDIUM×3 = 6
3. REFACTOR-590 — no Activity Event on data-source mutations (register+update+delete) — MEDIUM×3 = 6
4. REFACTOR-583 — actively-ingested source undeletable (doc-prereq + race) — MEDIUM×2 = 4
5. REFACTOR-585 — partial-edit data loss (REPLACE-not-MERGE) — MEDIUM×1 = 2
6. REFACTOR-582 — FTS vector not cleared on delete — MEDIUM×1 = 2
7. REFACTOR-591 — 201-vs-200 status drift consolidation — LOW×2 = 2
8. REFACTOR-586 — no optimistic-lock lost-update — LOW×1 = 1
9. REFACTOR-587 — no FTS refresh on create — LOW×1 = 1
10. REFACTOR-588 — oddrn required-vs-optional contract typo — LOW×1 = 1
11. REFACTOR-589 — null-token opaque 500 — LOW×1 = 1

The orchestrator re-ranks the global `## Top 20 by leverage` head over the COMBINED set; REFACTOR-581 (leverage 8) is the only batch-ZB entry likely to enter the global Top 20 (HIGH severity + cross-registry triangulation with TEST-GAP-755 and F-010).

<!-- NEW-HEADLINES-BELOW -->

## REFACTOR-581 — `DELETE /api/datasources/{id}` orphans the `token` row — soft-delete UPDATEs only `data_source.deleted_at`; the FK-referenced `token` row is never cleaned and CANNOT be soft-deleted; every register-then-delete cycle leaks one plaintext-credential row

**Severity**: HIGH
**Category**: missing-audit + plaintext-at-rest (orphan-credential accumulation)

**Discriminating context**: `DataSourceServiceImpl.delete` (lines 85-96) calls the inherited `ReactiveAbstractSoftDeleteCRUDRepository.delete`, whose `getDeleteChangedFields` (lines 106-110) writes ONLY `deleted_at = NOW()` on `data_source`. The `data_source.token_id` FK still points at the `token` row; that row is never touched, and the `token` table (`V0_0_28__add_token.sql:1-9`) has no `deleted_at` column so it cannot be soft-deleted. No housekeeping job covers the `token` table. EXACT structural sibling of the Collector path (test-map TEST-GAP-755). `token.value varchar(40)` carries the 40-char plaintext credential. Pinned by probe P-046; back-links feature-flows F-010 (`orphan_token_row_no_housekeeping`).

**Full detail**: `detail/REFACTOR-581.md`

---

## REFACTOR-582 — `DELETE /api/datasources/{id}` does NOT clear the data source's FTS `search_entrypoint` vector — unlike the `update` path which calls `updateSearchVectors`; a soft-deleted data source may remain full-text-searchable

**Severity**: MEDIUM
**Category**: missing-fts-cleanup (stale search result)

**Discriminating context**: `DataSourceServiceImpl.delete` (lines 85-96) calls no `searchEntrypointRepository` method; `DataSourceServiceImpl.update` (lines 77,80,127-136) DOES. Whether the soft-deleted source still surfaces in catalog search depends on whether the search query JOINs `data_source` with a `deleted_at IS NULL` predicate (unknown — pinned by P-048). Second instance of the ADR-CANDIDATE-206 deviation (the Tag delete-path REFACTOR-489 is the first).

**Full detail**: `detail/REFACTOR-582.md`

---

## REFACTOR-583 — An actively-ingested data source is effectively undeletable — the cascade-guard 400s while any live `data_entity` child exists; collector re-ingest re-creates children between the delete-children and delete-source steps; the only reliable delete path (stop the collector first) is undocumented

**Severity**: MEDIUM
**Category**: missing-doc-prereq + race-condition (operational dead-end)

**Discriminating context**: `DataSourceServiceImpl.delete` (lines 88-95) throws `CascadeDeleteException` → HTTP 400 if `existsNonDeletedByDataSourceId` finds any live `data_entity` child. `data_entity` rows are collector-re-created every ingest tick, so the delete-children-then-delete-source sequence races the collector. The cascade-guard's check-then-act is also not serialised against ingestion (no `getIdByOddrnForUpdate` lock on the delete path). The live `features/management` page documents none of the delete preconditions. Pinned by P-047.

**Full detail**: `detail/REFACTOR-583.md`

---

## REFACTOR-584 — `POST /api/datasources` and `PUT /api/datasources/{id}` implicitly create a namespace via the `namespace_name` field — bypassing the `NAMESPACE_CREATE` permission gate; a caller holding only `DATA_SOURCE_CREATE` / `DATA_SOURCE_UPDATE` mints new namespace directory rows

**Severity**: MEDIUM
**Category**: permission-bypass (escalation-by-side-effect)

**Discriminating context**: `DataSourceServiceImpl.create` (lines 56-57) and `.update` (lines 74-76) call `namespaceService.getOrCreate(namespace_name)` → `NamespaceServiceImpl.getByName(name).switchIfEmpty(createByName(name))` — INSERTs a `namespace` row if absent. The register/update endpoints are gated only by `DATA_SOURCE_CREATE` / `DATA_SOURCE_UPDATE` (`SecurityConstants.java:116-120`); the explicit `POST /api/namespaces` is gated by `NAMESPACE_CREATE`. SAME shape as REFACTOR-199 (Owner) / REFACTOR-206 (Title); SAME-polarity with the `concepts/index.yaml` "NAMESPACE_CREATE side-door confirmed at 4 sister services (... DataSource ...)" invariant. Pinned by P-039.

**Full detail**: `detail/REFACTOR-584.md`

---

## REFACTOR-585 — `PUT /api/datasources/{id}` is a full-form REPLACE — a partial body silently nulls the omitted fields; an API consumer sending `{name}` to rename a source wipes its `description` and detaches its `namespace`; there is no MERGE option

**Severity**: MEDIUM
**Category**: silent-data-loss (REPLACE-not-MERGE via MapStruct default null-handling)

**Discriminating context**: `DataSourceServiceImpl.update` applies the form via MapStruct `DataSourceMapper.applyToPojo` (`DataSourceMapper.java:49`, `@MappingTarget`); `MapperConfig.java:7-11` sets no `nullValuePropertyMappingStrategy`, so MapStruct's default `SET_TO_NULL` governs — an omitted JSON field deserialises to null and is written as null. `DataSourceUpdateFormData` (`components.yaml:1317-1325`) has 3 optional fields, no `required` block. The behaviour rests on a framework default with no comment defending it. Pinned by P-043.

**Full detail**: `detail/REFACTOR-585.md`

---

## REFACTOR-586 — `data_source` has no optimistic-lock version column — two concurrent `PUT /api/datasources/{id}` edits are last-writer-wins with no conflict detection; operator A's edit silently vanishes under operator B's concurrent edit

**Severity**: LOW
**Category**: race-condition (lost update — no optimistic locking)

**Discriminating context**: `DataSourceServiceImpl.update` reads via `getDto(id)` with no `FOR UPDATE` (the `FOR UPDATE` variant is ingestion-only); the `data_source` table (`V0_0_1__init.sql:38-50`) has no version column used in the UPDATE WHERE clause. Two concurrent PUTs both read the same baseline, both REPLACE, the later commit silently overwrites — no HTTP 409, no `If-Match`. SAME shape as REFACTOR-210 (DataEntityPojo). ADR-CANDIDATE-073 justifies no pessimistic lock but does not cover the absence of any optimistic-concurrency control.

**Full detail**: `detail/REFACTOR-586.md`

---

## REFACTOR-587 — `POST /api/datasources` does not refresh the FTS `search_entrypoint` vector on create — `updateSearchVectors` runs only on the `update` path; a newly registered data source is invisible to full-text search until its first data_entity is ingested

**Severity**: LOW
**Category**: missing-fts-cleanup (deferred search-discoverability)

**Discriminating context**: `DataSourceServiceImpl.create` (lines 51-66) has no `updateSearchVectors` call on the return path; `.update` (lines 77,80,127-136) does. A manually-registered, not-yet-ingested data source is absent from catalog search until its first `data_entity` ingestion triggers the join-driven FTS rebuild. Deviation from ADR-CANDIDATE-206's synchronous-search-index-consistency design; self-healing on first ingestion.

**Full detail**: `detail/REFACTOR-587.md`

---

## REFACTOR-588 — `oddrn` is required-at-runtime but optional-in-the-OpenAPI-contract — `DataSourceFormData` marks only `name` as `required`, yet `POST /api/datasources` rejects an empty `oddrn` with HTTP 400; a spec-generated client omitting `oddrn` receives a surprising rejection

**Severity**: LOW
**Category**: contract-typo (OpenAPI contract understatement)

**Discriminating context**: `DataSourceServiceImpl.createDataSource` (lines 119-120) throws `BadUserRequestException("ODDRN must be filled for data source")` → HTTP 400 on an empty `oddrn`; `components.yaml:1314-1315` lists `required: [name]` only — `oddrn` declared optional. A spec-generated client treats `oddrn` as omittable and gets a 400 it could have prevented client-side. One-line `components.yaml` `required`-block fix.

**Full detail**: `detail/REFACTOR-588.md`

---

## REFACTOR-589 — `PUT /api/datasources/{id}/token` on a data source whose `token` is null surfaces as an opaque HTTP 500 — a `data_source` row whose `token_id` points at a missing/deleted token NPEs or throws `RuntimeException("Token is null")` with no actionable message

**Severity**: LOW
**Category**: error-mapping (opaque 500 on a data-integrity edge)

**Discriminating context**: `DataSourceServiceImpl.regenerateDataSourceToken` line 102 calls `dto.token().tokenPojo()` with no null guard on `dto.token()`; a missing token NPEs or `TokenGeneratorImpl.regenerate` (lines 45-47) throws `RuntimeException("Token is null")` → falls to `ControllerAdvice`'s catch-all generic handler (lines 61-66) → opaque HTTP 500. The exception is service/generator-tier so `JooqReactiveOperations.onErrorMap` (ADR-CANDIDATE-071) does not translate it. Foreseeable data-integrity edge with an unhelpful failure mode.

**Full detail**: `detail/REFACTOR-589.md`

---

## REFACTOR-590 — `data_source` mutations (register / update / delete) emit NO Activity Event — `DataSourceServiceImpl` imports no activity emitter; no audit trail of who registered / edited / deleted a data source or when; 3-sidecar triangulated

**Severity**: MEDIUM
**Category**: missing-audit

**Discriminating context**: `DataSourceServiceImpl` (`create` 51-66, `update` 68-83, `delete` 85-96) imports no `ActivityEvent` and makes no `activityEventEmitter` call on any mutation path. Distinct from REFACTOR-188 (RBAC-directory-mutation audit gap) — batch F's refinement noted DataEntity-tier mutations DO emit (`OWNERSHIP_CREATED`, `DATA_ENTITY_STATUS_UPDATED`); the `data_source` tier is a third, un-audited surface. The platform has the activity substrate (ADR-CANDIDATE-060) but the data-source-mutation paths do not use it.

**Full detail**: `detail/REFACTOR-590.md`

---

## REFACTOR-591 — OpenAPI declares HTTP `201` for `POST /api/datasources` and `PUT /api/datasources/{id}` but the controllers return `200` — a spec-generated client asserting `status == 201` treats a correct registration/update as a failure; consolidates the previously-unpromoted 201-vs-200 cross-cutting drift

**Severity**: LOW
**Category**: status-code-narrow (OpenAPI contract-vs-implementation drift)

**Discriminating context**: `DataSourceController.registerDataSource` line 35 (`.map(ResponseEntity::ok)` = 200) vs `openapi.yaml:453-455` (`'201'` declared); `.updateDataSource` line 44 (`ResponseEntity.ok()` = 200) vs `openapi.yaml:481-487` (`'201'` declared). Pinned by P-038. Consolidates the formerly-unpromoted "REFACTOR-193" cross-cutting observation (createOwner/createRole/updateRole/createPolicy batch E + postDataEntityList batch F) — the 201-vs-200 drift never had a standalone registry entry; REFACTOR-591 is that home. The OpenAPI-generator-as-source-of-truth pattern (ADR-CANDIDATE-001) fixes path/verb but not the controller body's hand-written status code.

**Full detail**: `detail/REFACTOR-591.md`

---

## Refresh note — batch ZC (2026-05-22 — `/data-quality` standalone Data Quality Dashboard, the 5 UI-axis sidecars for F-032)

14 new refactoring scopes (REFACTOR-592..605) added from 5 new sidecars (`DataQuality`, `DataQualityContent`, `DataQualityFilters`, `DataQualityStore`, `TestCategoryResults`). Zero existing scopes strengthened (the F-032 feature is the first DQ-Dashboard surface in the catalog; previous DQ work was on the per-dataset Test reports tab F-022 which has a distinct codebase). The batch is the expected GAP-heavy shape for a UI-feature-deepening pass.

The 14 scopes split as: **2 HIGH** (the latent-crash + the LSN-020 Title drift), **8 MEDIUM** (the operator-UX cluster), **4 LOW** (the polish cluster — many consolidated into REFACTOR-605 to keep the catalog disciplined).

**Cross-cutting findings**:
- (a) The dashboard subtree has ZERO test coverage (21 source / 0 test) — every other scope in the batch is silently re-introducible because there is no regression suite. **REFACTOR-604 is the multiplier for every other gap in this batch.**
- (b) The live `dashboard.md` documentation page is OUT OF SYNC with the implementation on 9 axes (3-vs-6 statuses, Healthy/Warning/Error vs success/failed/broken, Unknown casing, empty-state silence, per-category row silence, filter-interaction silence, Title binding undocumented, namespace widening undocumented, access-control silence). **REFACTOR-600 consolidates the cluster** as one DOC-NNN tranche to ship together.
- (c) The dashboard's URL-as-source-of-truth pattern (per ADR-CANDIDATE-091 STRENGTHENED batch ZC) repeats the same JSON.parse-no-try/catch crash class that REFACTOR-286 surfaced on LineageGraph (REFACTOR-603). The pattern's "validation obligation" needs a codified primitive — per-call-site discipline has now failed independently on two surfaces.
- (d) The autocomplete UX has TWO compound performance gaps (REFACTOR-597 no-debounce + REFACTOR-598 no-pagination + REFACTOR-602 stale-closure) all in the shared `MultipleFilterItemAutocomplete` component — one consolidated component-polish pass addresses all three for the dashboard AND any other autocomplete consumer.
- (e) The dashboard's dispatch chain has a compound performance gap (REFACTOR-597 + REFACTOR-599) — building a typical 4-chip filter slice fires ~24 list-API GETs + 4 dashboard GETs where ~5 + 1 would suffice; ~5x request amplification on the most common workflow.

**The 5 highest-leverage 2026-05-22ZC additions**:

- **REFACTOR-592 (HIGH — buggy-default / latent-crash)**: `palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown` at `DataQualityContent.tsx:48` throws an uncaught TypeError and BLANKS the whole `/data-quality` dashboard if the backend ever returns a `DataEntityRunStatus` outside the 6-enum. The `??` fallback is mis-parenthesised (guards a missing `.color` on a present entry, not a missing entry). Activation pre-condition: any future spec-side enum addition without coordinated frontend regen — a routine evolution change. **The LSN-001 shape (latent activation, full-page operator failure).**

- **REFACTOR-593 (HIGH — name-behaviour-drift, LSN-020 class)**: the 'Title' filter (`titleIds` / `deTitleIds`) binds to `OWNERSHIP.TITLE_ID` (ownership role) at `ReactiveDataQualityRunsRepositoryImpl.java:301, 309` — NOT to any dataset title/name. The bare `t('Title')` label invites the wrong mental model. Same shape as the catalog-wide LSN-020 family (REFACTOR-567 `findMyActivities` axis-mismatch, REFACTOR-496 `getPopularTagList` IdsParam drift). Pair-fix in a single LSN-020 sweep recommended.

- **REFACTOR-600 (MEDIUM — doc-code-drift consolidated)**: the live `dashboard.md` page is out of sync on 9 axes. Consolidated as one DOC-NNN tranche covering: 6-status enum vs 3-status doc; Healthy/Warning/Error labels; Unknown casing; empty-state silence; per-category row silence; filter-panel interaction silence; Title binding undocumented; namespace widening undocumented; access-control posture undocumented (links to ADR-003 STRENGTHENS). The dashboard's primary user-facing doc has not had a Gate-6 audit since the implementation evolved.

- **REFACTOR-595 (MEDIUM — ux-bug / per-mount-reset-lossy)**: navigating away from `/data-quality` resets ALL 10 dashboard filters; the per-mount jotai `<Provider>` destroys `formFiltersAtom` on route unmount, and only URL search-params (a partial channel — does NOT survive the tab-click navigation) persist. Composes with ADR-CANDIDATE-207 (per-mount-reset is the deliberate property) + ADR-CANDIDATE-091 (URL persistence is the deliberate channel) — the UX HOLE is in the seam between the two locally-correct decisions.

- **REFACTOR-604 (MEDIUM — missing-test)**: entire `components/DataQuality/` subtree has ZERO test files (21 source files, 0 test files). The dashboard ships with no automated regression coverage at any test_class. **Multiplier for every other gap in this batch.**

**Remaining REFACTOR entries (full list)**:

| ID | Sev | Cat | One-liner |
|---|---|---|---|
| REFACTOR-592 | HIGH | buggy-default | line-48 status-color TypeError blanks whole dashboard on out-of-enum status |
| REFACTOR-593 | HIGH | name-behaviour-drift | 'Title' filter silently binds OWNERSHIP.TITLE_ID (LSN-020 class) |
| REFACTOR-594 | MEDIUM | name-behaviour-drift | 'Namespace' filter silently widens to DATA_SOURCE.NAMESPACE_ID |
| REFACTOR-595 | MEDIUM | ux-bug | per-mount Provider reset loses 10 filters; URL persistence partial |
| REFACTOR-596 | MEDIUM | error-mapping | no error UI; failed `/api/dataqatests/runs` indistinguishable from empty catalog |
| REFACTOR-597 | MEDIUM | performance-no-debounce | autocomplete keystroke = list-API GET (10 chars = 10 GETs; 10 autocompletes total) |
| REFACTOR-598 | MEDIUM | missing-pagination | autocomplete first-30-only; no truncation indicator |
| REFACTOR-599 | MEDIUM | performance-no-debounce | every chip toggle fires full dashboard refetch (no Apply gate) |
| REFACTOR-600 | MEDIUM | doc-code-drift | consolidated 9-facet doc-drift on `dashboard.md` (statuses + labels + silences) |
| REFACTOR-601 | MEDIUM | ux-bug | category panels alphabetical, not severity-descending |
| REFACTOR-602 | LOW | race-condition | MultipleFilterItemAutocomplete stale-closure; stuck spinner on failed list-API |
| REFACTOR-603 | LOW | missing-validation | URL-sync `JSON.parse` no try/catch (twin of REFACTOR-286 LineageGraph) |
| REFACTOR-604 | MEDIUM | missing-test | entire `components/DataQuality/` subtree: 21 source / 0 test |
| REFACTOR-605 | LOW | polish-cluster | consolidated 10-facet polish (locale-dep, dead guards, unused atom factory, etc.) |

**Suggested sprint groupings**:

- **Quality Dashboard hardening sprint** — REFACTOR-592 / 593 / 594 / 595 / 596 / 597 / 598 / 599 / 601 / 602 / 605. The bug-fix + UX-polish surface; one focused sprint covering the dashboard subtree end-to-end.
- **Quality Dashboard test bootstrap** — REFACTOR-604 (standalone sprint or sub-sprint of hardening). Pair the integration tests directly with the REFACTOR-592 regression to pin the line-48 crash.
- **DOC-NNN dashboard.md tranche** — REFACTOR-600 (doc-side companion). One focused authoring session over the dashboard doc page covering all 9 facets.
- **LSN-020 cross-codebase sweep** — REFACTOR-593 (with REFACTOR-567 / REFACTOR-496). All three are instances of the input-name-vs-implementation pattern; a single audit pass over every user-facing form field whose label is a generic word.
- **URL-as-source-of-truth codified validation primitive** — REFACTOR-603 (with REFACTOR-286). Closes both crash sites and provides the foundation for any third instance of the pattern.
- **Autocomplete hygiene cross-cutting** — REFACTOR-597 + REFACTOR-598 + REFACTOR-602 in the shared `MultipleFilterItemAutocomplete` component. Benefits dashboard AND every other autocomplete consumer.

## REFACTOR-592 — `palette.runStatus[status].color` (`DataQualityContent.tsx:48`) throws an uncaught TypeError and BLANKS the whole `/data-quality` dashboard if the backend ever returns a `DataEntityRunStatus` outside the 6-member enum

**Severity**: HIGH | **Category**: buggy-default / latent-crash | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-592.md`

## REFACTOR-593 — Dashboard 'Title' filter (`titleIds` / `deTitleIds`) silently filters by OWNERSHIP ROLE (`OWNERSHIP.TITLE_ID`), not by dataset title/name — bare `t('Title')` label invites the wrong mental model (LSN-020 class)

**Severity**: HIGH | **Category**: name-behaviour-drift (LSN-020) | **Pillar**: P-04 + P-08 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-593.md`

## REFACTOR-594 — Dashboard 'Namespace' filter silently widens to datasource-inherited namespaces (`NAMESPACE.ID = DATA_ENTITY.NAMESPACE_ID OR NAMESPACE.ID = DATA_SOURCE.NAMESPACE_ID`)

**Severity**: MEDIUM | **Category**: name-behaviour-drift | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-594.md`

## REFACTOR-595 — Navigating away from `/data-quality` resets ALL 10 dashboard filters; per-mount jotai `<Provider>` destroys `formFiltersAtom` on route unmount, URL search-params are a partial channel

**Severity**: MEDIUM | **Category**: ux-bug / per-mount-reset-lossy | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-595.md`

## REFACTOR-596 — Dashboard has no error UI; failed `GET /api/dataqatests/runs` indistinguishable from empty catalog (`useGetDataQualityDashboard` destructures only `{ data, isSuccess }`)

**Severity**: MEDIUM | **Category**: error-mapping / no-error-handler | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-596.md`

## REFACTOR-597 — Dashboard filter autocompletes have NO debounce — every keystroke triggers a list-API GET; 10 chars = 10 GETs; 5 filters × 2 sides = 10 autocompletes; request burst

**Severity**: MEDIUM | **Category**: performance-no-debounce | **Pillar**: P-04 + P-01 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-597.md`

## REFACTOR-598 — Dashboard filter autocompletes capped at first 30 options per search prefix; no pagination, no infinite-scroll, no truncation indicator

**Severity**: MEDIUM | **Category**: size-limit-silent-trunc / missing-pagination | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-598.md`

## REFACTOR-599 — Every dashboard filter chip toggle fires a full `GET /api/dataqatests/runs` (multi-CTE multi-join SQL) — no debounce, no Apply gate; 4-chip filter = 4 backend fetches when 1 would suffice

**Severity**: MEDIUM | **Category**: performance-redundant-work | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-599.md`

## REFACTOR-600 — Live `dashboard.md` is out of sync on 9 axes (consolidated DOC-DRIFT) — 3/6 statuses, Healthy/Warning/Error labels, Unknown casing, empty-state, per-category row, filter interaction, Title binding, namespace widening, access-control silence

**Severity**: MEDIUM | **Category**: doc-code-drift (consolidated cross-facet) | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-600.md`

## REFACTOR-601 — Per-category panels render alphabetical, not severity-descending — operator opening `/data-quality` to triage "which category failing worst" must scan all panels; panel order conveys nothing about quality

**Severity**: MEDIUM | **Category**: ux-bug / ordering-not-meaningful | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-601.md`

## REFACTOR-602 — `MultipleFilterItemAutocomplete` options-loading effect has stale-closure + stuck-spinner; `hookResult` missing from deps; failed list-API shows blank spinner forever

**Severity**: LOW | **Category**: race-condition / stale-closure | **Pillar**: P-04 + cross-cutting autocomplete consumers | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-602.md`

## REFACTOR-603 — Dashboard URL-sync mount effect calls `JSON.parse(value)` with NO try/catch — hand-edited `/data-quality?foo=bar` crashes React tree (twin of REFACTOR-286 LineageGraph)

**Severity**: LOW | **Category**: missing-validation / fragile-parsing | **Pillar**: P-04 + P-05 (cross-cutting URL-source-of-truth) | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-603.md`

## REFACTOR-604 — Entire `components/DataQuality/` subtree has ZERO test files (21 source / 0 test); dashboard ships with no automated regression coverage at any test_class — the multiplier for every other gap in this batch

**Severity**: MEDIUM | **Category**: missing-test | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-604.md`

## REFACTOR-605 — Quality Dashboard LOW-severity polish cluster (10 facets) — locale-dep ordering, dead `!data` guards, unused `getFieldFilterAtom`, whole-atom subscription, `capitalizeFirstLetter` empty-string, missing i18n, negative-count display, no `staleTime`, `toSorted`-outside-`useMemo`, present-only flatMap silent drop, swappable `filterKey` props

**Severity**: LOW (consolidated) | **Category**: code-hygiene / polish / multi-facet | **Pillar**: P-04 | **Batch**: ZC
**Full detail**: `lineage/odd-platform/refactoring-scopes/detail/REFACTOR-605.md`
