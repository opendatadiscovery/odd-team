---
artefact: doc-gaps
generated_at: "2026-05-12T12:00:00Z"
generated_at_commit: ede5d277
sidecar_count: 35
concepts_yaml_version: 5
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 71
findings_by_severity: { HIGH: 35, MEDIUM: 29, LOW: 7 }
findings_by_category: { broken-url: 8, missing-anchor: 0, drift: 55, missing-page: 4, stale-page: 0, coverage-gap: 2, meta: 2 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars: AppInfoController @ auth.type@L18, AuthorizationManagerCondition @ auth.type@L11, CounterTimeSeriesExtractor @ metrics.storage@L20, IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20, ActivityTablePartitionManager @ odd.activity.partition-period@L11). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041 — code never DROPs partitions, doc claims partition-period controls retention). 4 distinct findings on activity-partition subsystem (DOC-GAP-041..043 + DOC-GAP-040 partial covers via cross-ref). Verified WebFetch 2026-05-11 — `enable-security` parent page DOES now state `auth.ingestion.filter.enabled defaults to false`, partial doc coverage; the `/api/appInfo` introspection surface, DISABLED-default of auth.type, LOGIN_FORM-drops-authorization, and tenant-id read/write asymmetry remain undocumented."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: DisabledAuthSecurityConfiguration @ auth.type@L10, LoginFormSecurityConfiguration @ auth.type@L31, OAuthSecurityConfiguration @ auth.type@L71, LDAPSecurityConfiguration @ auth.type@L51, NotificationsProperties config-properties-class). Four auth-mode SecurityConfiguration sidecars deepened the Auth Mode coverage from 'config consumers' to 'wiring sites' — surfacing the blast-radius of DISABLED (CSRF/CORS/actuator/S2S-ignored/audit-absence), 5-vs-7 OAuth2 provider drift with no Okta/Keycloak handlers, missing `azureTenantId` POJO field vs documented YAML, unvalidated Azure `logout-uri`, LDAP scheme silence (ldaps:// not differentiated), `auth.ldap.password` leak via actuator/env, substring-collision admin escalation in LDAP, `auth.login-form-redirect` open-redirect surface, session-cookie security gaps under LOGIN_FORM. Notifications sidecar surfaced dead `webhookUrl` field, no rate-limit, no audit trail, no per-channel filtering, no PII redaction, replication-slot orphan risk, GitBook routing drift (legacy `/active-platform-features/notifications` 404 — joining DOC-GAP-035 in cross-cutting class). New class-level DOC-GAP-058 captures the GitBook legacy-route drift as an audit-recommended pattern, not a single page. NEW HIGH findings: 8 (DOC-GAP-045, DOC-GAP-046, DOC-GAP-048, DOC-GAP-050, DOC-GAP-051, DOC-GAP-053, DOC-GAP-054, DOC-GAP-055). Live URL re-verification 2026-05-12: `disabled-authentication` 200 confirms blast-radius omission verbatim; `oauth2-oidc` 200 verifies 7-provider docs claim; `/active-platform-features/notifications` 404 confirms cross-cutting routing drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars: ODDOAuth2Properties, ODDLDAPProperties, EmailSenderProperties, DataCollaborationProperties, HousekeepingTTLProperties). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings. Cross-cutting refinements: (a) Lombok `@Data` toString sensitive-field leak — 4-sidecar triangulated (ODDLDAPProperties.password + ODDOAuth2Properties.clientSecret + EmailSenderProperties.password + NotificationsProperties); Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` DOES sanitise `/actuator/env` (batch-C scope was overbroad); the DURABLE leak surface is Lombok-generated `toString()` if logged. Refines DOC-GAP-006 + DOC-GAP-050 with the precise leak vector. (b) Partial-home pattern — DataCollaborationProperties binds 3 of 7 `datacollaboration.*` keys; EmailSenderProperties does not model `notifications.receivers.email.notification.emails` recipient list; docs that enumerate the prefix don't surface the split. (c) Activity-feed retention claim DOUBLE-CONFIRMED — HousekeepingTTLProperties has no `activity*Days` field; both partition-manager (WIDTH only) AND housekeeping (no activity scope) angles agree the docs claim is wrong (DOC-GAP-041 promoted to multi-angle case). (d) Lock-id collision risk on DataCollab undocumented; partition / notifications.wal / data-collab use four distinct defaults (90/100/110/120) with no validation that operators maintain disjointness. NEW HIGH findings: 7 (DOC-GAP-059, DOC-GAP-061, DOC-GAP-063, DOC-GAP-067, DOC-GAP-069, DOC-GAP-070); plus 1 promoted HIGH on the META Lombok-toString cluster. NEW MEDIUM: 5 (DOC-GAP-060, DOC-GAP-062, DOC-GAP-064, DOC-GAP-066, DOC-GAP-068, DOC-GAP-071). NEW LOW: 1 (DOC-GAP-065). Live URL re-verification 2026-05-12: `/oauth2-oidc` 200 verifies that ODD_IAM provider is COMPLETELY ABSENT from the page (drift in the other direction — POJO supports a provider docs don't name) + `username-attribute` (descriptive prose) vs `user-name-attribute` (every YAML example) inconsistency on the SAME page; `/configuration-and-deployment/odd-platform` 200 verifies housekeeping section frames 'three cleanup tasks' (missing 2 of 5 jobs), acknowledges jOOQ bug verbatim but with no upstream-issue link, fully documents SMTP caveats verbatim; `/features/active-platform-features/data-collaboration` 200 verifies no lock-id collision warning; `/features/active-platform-features/notifications` 200 verifies no rate-limit/audit/PII coverage; `/features/active-platform-features/activity-feed` 200 verifies the retention claim wording verbatim ('retention and partitioning are controlled by `odd.activity.partition-period`'); `/configuration-and-deployment/enable-security/authentication/ldap` 200 verifies no LDAP password actuator caveat, no substring-collision warning, no LDAPS guidance."
---

# Doc gaps — odd-platform — 2026-05-12 (batch D refresh)

## Summary

- **Findings**: 71 total (35 HIGH, 29 MEDIUM, 7 LOW)
- **By category**: broken-url 8, drift 55, missing-page 4, coverage-gap 2, meta 2
- **By feature** (top affected concepts): Auth Mode (15 — expanded again in batch D with ODD_IAM-absent + adminUserInfoFlag-absent + username-attribute spelling drift), Notifications (8 — expanded in batch D with email completeness + Lombok-toString refinement), Data Entity (5), Activity Feed (5 — now 2-angle-confirmed retention drift), Attachment (5), Housekeeping TTL (4 — NEW in batch D), DataCollaboration (4 — expanded in batch D with lock-id collision + partial-home), Alert (4), AlertManager Webhook Receiver (3), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4), Multi-Tenant Configuration / Metrics Ingestion (1), Collector / Collector Token (2), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). 19 HIGH findings are LSN-001/LSN-002-class operator-impact gaps. Batch D adds two new meta-recommendations and refines two batch-C ones:
  - (a) **GitBook legacy-vs-canonical routing drift** (DOC-GAP-058 — meta-finding) — 2 sidecars (DataCollaboration batch A + Notifications batch C). Same shape: legacy `/active-platform-features/X` 404s while `/features/active-platform-features/X` serves 200. Recommend a doc-side audit of ALL legacy paths likely to be referenced from external blog posts / Slack discussions.
  - (b) **"Docs frame default behaviour but omit blast radius"** (DOC-GAP-053 meta-finding) — extends DOC-GAP-036, DOC-GAP-038, DOC-GAP-041, DOC-GAP-059. **Batch D upgrades to 4-sidecar triangulation** with HousekeepingTTLProperties — operator overriding application.yml without re-supplying the housekeeping block silently rebinds to 0 and triggers immediate hard-delete (exact LSN-001 shape). Pages exist and document the happy path, but do not enumerate the operational consequence cluster (CSRF + CORS + actuator + S2S-ignored + audit-absence for DISABLED; retention claim with no DROP path for activity-feed; Java-default-vs-YAML-default cliff for housekeeping). Recommend a doc-side audit of every "default behaviour" claim against the code's actual blast radius.
  - (c) **NEW batch D: Lombok `@Data` toString sensitive-field leak (DOC-GAP-067 — meta-finding)** — 4-sidecar triangulated (ODDLDAPProperties.password + ODDOAuth2Properties.clientSecret + EmailSenderProperties.password + NotificationsProperties). Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` DOES sanitise `/actuator/env` (so batch-C's actuator-env framing was overbroad); the durable leak surface is Lombok-generated `toString()` if logged. The doc pages for each affected feature (LDAP, OAuth2, login-form, notifications) need a "Logging discipline" caveat warning operators against `log.info("props = {}", properties)` or future code adding such lines. Refines DOC-GAP-006 + DOC-GAP-050.
  - (d) **NEW batch D: Partial-home pattern (DOC-GAP-068 — meta-finding)** — `@ConfigurationProperties` classes bind only a subset of their config-prefix's keys; operators reading the prefix in docs don't see that one POJO doesn't cover all keys. 2-sidecar triangulated (DataCollaborationProperties: 3 of 7 `datacollaboration.*` keys; EmailSenderProperties: omits `notifications.receivers.email.notification.emails` recipient list). Doc pages that enumerate the prefix need to call out the @Value-scattered remainder for maintainer onboarding (LOW operator-impact, MEDIUM maintainer-impact).
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface.
  - **Doc-text-vs-code audience drift** (2026-05-10A): the live alerting doc names "stewards and admins" while code enforces "any authenticated user."
  - **Triangulated default-open posture** (2026-05-10B): four config-key-consumer sidecars + four `*SecurityConfiguration` sidecars now converge on the same operator-trap shape — DISABLED-default of `auth.type` + FALSE-default of `auth.ingestion.filter.enabled` + no fail-fast on misconfigured `auth.type` + no boot WARN under DISABLED + actuator/env reachable under DISABLED. Per LSN-001 + LSN-002 case-law, this is the canonical insecure-default failure mode the ontology was built to surface.
  - **Documentation-overstates-config-effect** (2026-05-10B + 2026-05-12D): activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code has NO row-by-age retention path (partition manager controls WIDTH only; housekeeping has no `activity*Days` field). **Now 2-angle triangulated**.
  - **GitBook legacy-route 404 cluster**: `/active-platform-features/notifications` joins `/active-platform-features/data-collaboration`, both 404 with redirect-suggestion stubs; the canonical `/features/active-platform-features/*` paths serve 200.
  - **Auth-mode-wiring-site blast-radius gap (2026-05-12C)** — the dedicated sub-pages (`disabled-authentication`, `login-form`, `oauth2-oidc`, `ldap`) document the happy-path config but consistently omit security-relevant operational consequences (CSRF posture, session cookie security, S2S composition behaviour under each mode, actuator-env credential exposure, LDAPS scheme guidance, substring-collision admin escalation in LDAP, OAuth2 provider-handler coverage gap).
  - **Notifications subsystem under-documented for operations (2026-05-12C + D)** — the live page documents channels + WAL requirements + cleanup but omits: no rate-limit (alert bursts → Slack 429 / SMTP queue saturation), no audit trail (operators can't answer "did this alert get delivered?"), no per-channel filtering (every channel gets every alert regardless of owner), no PII redaction (free-text descriptions flow verbatim into outbound payloads), replication-slot orphan risk on rename, dead `notifications.webhookUrl` top-level field still binds. **Batch D adds**: email port=0 (Java primitive default) cliff, boxed Boolean nullability, modern SMTP-AUTH OAUTH2 absent, no Reply-To/Cc/Bcc/DKIM support, sender no `@Email` validation, recipient list comma-split has no per-address trim (silent partial delivery from whitespace).
  - **NEW 2026-05-12D: Housekeeping subsystem doc completeness** — the live page describes "three cleanup tasks" but code has 5 HousekeepingJob beans (missing Activity + Message empty-partitions jobs); the `housekeeping.ttl.*` 30-day default lives only in the bundled `application.yml` (not in Java field initializers) — an operator overriding the YAML rebinds to 0 and triggers immediate hard-delete (LSN-001 shape). Docs acknowledge the jOOQ-precedence bug for manual RESOLVED alerts but provide no upstream-issue link / workaround.
  - **NEW 2026-05-12D: OAuth2 docs internal inconsistency** — the page uses `username-attribute` (no hyphen between user and name) in descriptive prose but `user-name-attribute` (hyphenated) in every YAML example; Spring relaxed binding maps `user-name-attribute` (not `username-attribute`) to the `userNameAttribute` POJO field. Operators copy-pasting the prose key get silent binding failure. Additionally, ODD_IAM provider is COMPLETELY absent from the docs page (5-enum-value vs 7-docs-providers drift gets a third angle) and `adminUserInfoFlag` (the ODD_IAM admin-detection mechanism) is undocumented despite being a POJO field.

## Findings

### HIGH severity

- **DOC-GAP-001**: DataEntity `/term` vs `/terms` path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM gates — undocumented on Permissions page
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:concepts.invariants` + `:bugs_limitations_corner_cases.[0]` (term path mismatch)
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-08 status 200 — page lists `DATA_ENTITY_ADD_TERM. Allows adding a term to a data entity` and `DATA_ENTITY_DELETE_TERM. Allows removing a term from a data entity` with NO warning that these gates are silently disabled by `/term` (SecurityConstants.java:237-242) vs `/terms` (DataEntityApi.java:148, 542) path mismatch.
    - `concepts.yaml:entities[Data Entity].security_aggregate.authorization_consistency.detail`: "DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM rules silently disabled by `/term` vs `/terms` path mismatch"
    - DataEntityController.md verifies any authenticated user can attach/detach terms on any entity.
  - **Proposed doc action**: Add a "Known limitations" admonition to `configuration-and-deployment/enable-security/authorization/permissions.md` next to DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM rows: "Currently NOT enforced — the SECURITY_RULES path matcher uses `/term` while the API publishes `/terms`. Any authenticated user can attach/detach terms on any data entity until this is fixed in source." Cross-reference an upstream issue to fix the path matcher.
  - **Cross-references**:
    - LSN-class — silent-bypass of a documented permission gate (data-integrity at risk: arbitrary terms attached to any entity by any auth'd user)
    - Should drive a `/log-issue odd-platform` upstream fix in addition to the doc warning
  - **Severity rationale**: HIGH — operator reads permissions doc, believes terms are gated, deploys with assumption; in practice every authenticated user can mutate terms on every entity. LSN-001/LSN-002 class.

- **DOC-GAP-002**: Alerting feature page does not warn that `getAllAlerts` exposes every platform alert to any authenticated user; doc text names "stewards and admins" audience while code enforces any authenticated user
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:security.known_security_gaps.[1]` (severity HIGH)
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:security.known_security_gaps.[0]`
    - `odd-platform__java__AlertController__controller-method__getAllAlerts.md:security.known_security_gaps.[0]` + `:docs_link_semantic.doc_drift_findings.[0]` **(2026-05-10A — method-level audience-drift evidence)**
    - `odd-platform__openapi__tags__openapi-tag__alert.md:security.known_security_gaps.[0]`
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[0,1]` + `:cross_file_inconsistencies.[2]` (doc-code audience divergence)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-10 status 200 — confirmed verbatim: "All — Every open and resolved alert across the whole platform" with use-case recommendation "Platform-wide triage; **stewards and admins watching the full alert surface**." The page contains **no discussion** of access-control, authorization, or role-based restrictions for the `getAllAlerts` endpoint or the "All" tab.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — page lists `GET /api/alerts` and notes `My Objects`/`Dependents` require Owner-link, but does NOT warn that the `All` listing exposes every alert to every authenticated user.
    - getAllAlerts.md (2026-05-10A) verifies absence: `SecurityConstants.java:98-295` contains a rule for `PUT /api/alerts/{alert_id}/status` but NO entry for `GET /api/alerts`; `AuthorizationCustomizer.java:29-30` falls through to `pathMatchers('/**').authenticated()`. Repository `ReactiveAlertRepositoryImpl.java:143-145` issues `selectFrom(ALERT).where(ALERT.STATUS.eq(OPEN))` with no owner predicate.
    - **Audience-drift sub-finding (2026-05-10A)**: doc text recommends the All tab for "stewards and admins"; code permits any authenticated user. Two corrective paths exist (align doc to enforced "any authenticated user" behaviour, OR add an admin/steward Permission gate aligned with doc's stated audience) — the choice is the maintainer's; the drift is the finding.
  - **Proposed doc action**: Add a "Visibility scope" admonition to `features/active-platform-features/alerting.md` and to `developer-guides/api-reference/alerts.md`: "`getAllAlerts` (`GET /api/alerts`) returns the entire platform's alert population to any authenticated user — there is no role/permission gate. The 'stewards and admins' framing on the All tab describes the *intended* audience, not an enforced restriction. Under `auth.type=DISABLED` the endpoint is anonymously reachable. If your deployment requires admin-only visibility on the `All` tab, gate the endpoint at the network layer or front the platform with a permission-aware reverse proxy." Mirror on `changeAlertStatus`: any authenticated user can mutate any alert by id. **Decide concurrently** whether to add a `ALERT_LIST_ALL` permission gate (code-side fix) or rewrite the doc audience framing (doc-side fix); either resolves the drift.
  - **Cross-references**:
    - LSN-001/LSN-002 class — operator follows doc trusting that "Alerts feature" is owner-scoped, deploys with no auth-mode-DISABLED expectation
    - F-053 (advisory locks) — same family of "operationally relevant default unsurfaced"
  - **Severity rationale**: HIGH — alert content carries entity identifiers, severity, slack-style messages; multi-tenant deployments leak cross-tenant alert metadata under default config. The audience-drift makes this worse: operators reading "stewards and admins" reasonably assume the platform enforces that scoping.

- **DOC-GAP-003**: AlertManager Webhook Receiver lacks rate-limit / payload-cap / dedup / spoofing caveats on operator-facing config page
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:security.known_security_gaps.[0,1,2,3]` (all severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:performance.known_performance_gaps.[0,1,2]`
    - `concepts.yaml:entities[AlertManager Webhook Receiver].security_aggregate.weaknesses.[0,1,2,3]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Prometheus AlertManager Integration section is present and warns about no application-layer auth + recommends perimeter controls. Does NOT warn about: (a) entity_oddrn alert-spoofing (caller chooses arbitrary entity_oddrn, no check that caller may raise alerts on that entity); (b) no rate-limit / payload-size cap / no dedup — unauthenticated DoS vector creates unbounded `AlertPojo` + `AlertChunkPojo` rows; (c) silent orphaning when `entity_oddrn` label missing — payload accepted, persisted with null data_entity_oddrn, returns 204 No Content with no signal of misconfiguration; (d) ExternalAlert.startsAt timezone-naive `LocalDateTime` strips RFC3339 offsets.
    - AlertManagerController.md:security.known_security_gaps.[1] (Alert spoofing HIGH severity)
    - AlertManagerController.md:bugs_limitations_corner_cases.[0] (silent_orphan)
  - **Proposed doc action**: Extend the "Prometheus AlertManager Integration" section on `configuration-and-deployment/odd-platform.md` with a "Known limitations" admonition covering: spoofing surface (any caller within network reach can raise alerts on any entity by choosing entity_oddrn), no rate-limit / payload-size cap, no dedup of repeated AlertManager `group_interval` re-sends, silent orphaning when entity_oddrn missing (no visible caller signal), timezone-naive LocalDateTime drops AlertManager's RFC3339 offset, hand-rolled DTO does not honour AlertManager `status: resolved` to close alerts.
  - **Cross-references**:
    - LSN-002 family (operationally surprising default — webhook accepted-but-ignored)
    - Concept "AlertManager Webhook Receiver" is `canonical_candidate: true` per concepts.yaml — see DOC-GAP-019
  - **Severity rationale**: HIGH — webhook is the integration point operators wire production AlertManager into; missing caveats translate to (a) operator deploys without a rate-limit, gets DoS'd; (b) operator wires AlertManager without entity_oddrn validation, alerts silently orphan; (c) attacker on the network plane spoofs alerts onto sensitive entities.

- **DOC-GAP-004**: Attachment feature page does not warn about read-path authorization asymmetry (GET endpoints unprotected)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:security.known_security_gaps.[0]` (severity HIGH; read-path asymmetry)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:docs_link_semantic.doc_drift_findings.[3]`
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 — RBAC section names `DATA_ENTITY_ATTACHMENT_MANAGE` as the gate, but does NOT disclose that the gate is asymmetric: read paths (`GET /attachments`, `GET /files/uploads` upload options, `GET /files/{file_id}` download) carry no permission gate at all and are reachable by any authenticated user.
    - DataEntityAttachmentController sidecar verifies: "POST/PUT/DELETE on `/files/**` and `/links/**` gated by DATA_ENTITY_ATTACHMENT_MANAGE; GET endpoints carry NO permission gate."
  - **Proposed doc action**: Add to `features/data-discovery/attachments.md` RBAC section: "**Read-path posture**: The `DATA_ENTITY_ATTACHMENT_MANAGE` permission gates only the *write* paths (add, edit, delete, upload). The *read* paths (list attachments, download a file, fetch upload options) are gated by authentication only — any authenticated user can list and download attachments on any data entity. Under `auth.type=DISABLED` they are anonymously reachable."
  - **Cross-references**:
    - LSN-001 retrospective (already cited on the same page for LOCAL-ephemerality)
    - DataEntityController concept's same family (read-endpoints uniformly under-gated)
  - **Severity rationale**: HIGH — attachments may contain sensitive customer data; operator reading the doc believes attachments are gated.

- **DOC-GAP-005**: Attachment max-file-size cap is client-side-only; non-browser caller can submit arbitrary-size files — undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:security.known_security_gaps`
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:security.known_security_gaps.[3]` **(2026-05-10A — method-level reinforcement at HIGH severity)** + `:docs_link_semantic.doc_drift_findings.[1]`
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Attachment Storage Configuration section frames `attachment.max-file-size` as a per-file cap with `spring.codec.max-in-memory-size` interaction described as the WebFlux codec layer failure mode. Does NOT disclose the cap is enforced ONLY client-side (UI filter) — no service-layer re-validation in `AttachmentServiceImpl`, `DataEntityAttachmentController`, or `FileServiceImpl`.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-10 status 200 — confirms the page asserts "Files larger than the cap are rejected by the upload API" — operator reasonably believes server enforces.
    - AttachmentServiceImpl@L27.md sidecar verifies absence of server-side enforcement.
    - **Method-level reinforcement (2026-05-10A)**: uploadFileChunk.md verifies the chunk endpoint reads no size, FileServiceImpl.java:58-67 calls `transferTo` without checking byte count. Combined with no rate-limit, this is a host-disk DOS surface against the chunk-staging filesystem. Already tracked as REFACTOR-013 (HIGH).
  - **Proposed doc action**: Add to both pages (config + feature) a Known-limitations admonition: "**Server-side enforcement**: the `attachment.max-file-size` cap is enforced in the UI (the file-picker filters before upload). The chunked-upload API does not re-validate per-chunk or aggregate size, so a non-browser caller with `DATA_ENTITY_ATTACHMENT_MANAGE` can submit arbitrarily-large files. Operators who need a hard server-side cap must enforce it via `spring.codec.max-in-memory-size` (which fails the request at the WebFlux codec layer with `DataBufferLimitException`) or at the network layer."
  - **Cross-references**:
    - F-056 (`spring.codec.max-in-memory-size` undocumented) — fix in same content area
    - REFACTOR-013 in `lineage/odd-platform/refactoring-scopes.md:107-115`
  - **Severity rationale**: HIGH — operator-facing storage planning (S3 bucket size, LOCAL filesystem capacity) anchored on a cap that doesn't apply.

- **DOC-GAP-006**: `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page (**REFINED batch D**: Spring Boot 3.4.10's `show-values: NEVER` default DOES mask values; the durable leak surface is Lombok-toString — see DOC-GAP-067)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:security.known_security_gaps`
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[2]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Attachment Storage Configuration is comprehensive on storage backends and known limitations BUT contains NO warning about Spring Boot Actuator `/actuator/env` exposure surfacing `attachment.remote.access-key` / `attachment.remote.secret-key` keys.
    - attachment-config-prefix.md sidecar surfaces this as severity HIGH.
    - **Batch D refinement (2026-05-12)**: Per `ODDLDAPProperties.md` primary-source verification — Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` default DOES sanitise `/actuator/env` (the secret values appear as `******`). The durable leak vector is NOT actuator-env (the actuator surface is partially protected by default); it is Lombok `@Data`-generated `toString()` if any code path logs the Properties bean. Need to verify whether the attachment-storage POJO (if any) is similarly `@Data`-decorated — likely yes by pattern. The actuator-env framing remains valid as a defence-in-depth concern (operators with externally-reachable actuator endpoints leak the key NAMES even when values are masked, and `show-values: NEVER` is operator-overridable).
  - **Proposed doc action**: Cross-link with F-054 (DOC-163) — when authoring the F-054 fix on Spring Boot Actuator, include a paragraph on attachment-storage credential exposure: "The default `management.endpoints.web.exposure.include` exposes `/actuator/env`. Spring Boot 3.4.10 masks credential VALUES by default (`management.endpoint.env.show-values: NEVER`), so resolved values appear as `******` — but the *key names* themselves (`attachment.remote.access-key`, `attachment.remote.secret-key`, `auth.oauth2.client.client-secret`, etc.) are still returned, confirming the configuration shape. **Additionally**, if any Spring `@ConfigurationProperties` POJO bound to these keys uses Lombok `@Data` (the platform's default pattern), the auto-generated `toString()` includes the credential field — any code path that logs the bean (or any future `log.debug("config = {}", properties)` addition) emits the credential verbatim, bypassing actuator masking entirely. For production deployments: (1) override the exposure list to drop `env`, or move Actuator to a separate management port; (2) ensure Properties classes carrying credentials use `@ToString.Exclude` on sensitive fields (see DOC-GAP-067)."
  - **Cross-references**:
    - **F-054** in `findings/docs-coverage-undocumented-features/2026-05-08.md` — same gap, broader scope (fold this finding into F-054's authoring as a sub-bullet)
    - **DOC-GAP-050** (LDAP `auth.ldap.password` leak — same actuator-vs-Lombok refinement; 2026-05-12C + D)
    - **DOC-GAP-067 (NEW batch D — META)** — Lombok-toString sensitive-field leak class; 4-sidecar triangulated
  - **Severity rationale**: HIGH — operationally-reachable Actuator + S3 credentials shape is a security-deployment footgun even with the value mask (key-name disclosure + `show-values` operator-overridable + Lombok-toString bypass).

- **DOC-GAP-007**: GenAI feature page lacks prompt-injection / SSRF / DISABLED-anonymous-reachability caveats
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:security.known_security_gaps.[0,1,2]` (all severity HIGH)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:docs_link_semantic.doc_drift_findings.[1]`
    - `concepts.yaml:entities[GenAI Assistant].security_aggregate.weaknesses.[0,1,2]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-08 status 200 — page documents disabled-by-default + sends-no-auth + request_timeout=0 caveat + API-only. Does NOT warn about: (a) prompt-injection from authenticated platform user → external LLM (text forwarded verbatim, no length cap, no character filter, no system-prompt overlay); (b) SSRF — `genai.url` operator-supplied with NO allowlist, NO scheme check, NO SSRF guard; an attacker landing config injection elsewhere can pivot the platform's egress; (c) under `auth.type=DISABLED`, `/api/genai/ask` is anonymously reachable, no startup warning when DISABLED + genai.enabled=true.
  - **Proposed doc action**: Add a "Security caveats" H2 to `features/active-platform-features/genai.md` covering: prompt-injection posture (platform is a thin verbatim proxy; sanitisation/validation is the external service's responsibility), SSRF surface (`genai.url` is not validated; treat it as a trusted-network egress), DISABLED-mode reachability (under `auth.type=DISABLED` the endpoint is anonymous; pair `genai.enabled=true` only with an authenticating auth.type), absent rate-limit / abuse-detection / per-user quota, no audit logging of prompts (prompts are not stored anywhere by the platform; abuse-investigation requires upstream LLM logs).
  - **Cross-references**:
    - LSN-002 family — `genai.enabled=true` with primitive `int` request_timeout default 0 is documented; sibling unsafe-default cases here are the URL/SSRF and DISABLED ones
  - **Severity rationale**: HIGH — DISABLED-mode anonymous LLM access is a "deploy with trial config, leak external LLM quota" surface; SSRF amplifies a config-injection bug into an egress pivot.

- **DOC-GAP-008**: Directory feature page does not warn that the surface is platform-wide and bypasses owner-scoping (reconnaissance surface)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:security.known_security_gaps.[0,1,2]`
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:docs_link_semantic.doc_drift_findings.[2]`
    - `concepts.yaml:entities[Directory].security_aggregate.weaknesses.[0,1,2]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-08 status 200 — page documents the four-level hierarchy and the Search-vs-Directory contrast. Contains NO warning that Directory is platform-wide and unscoped by ownership; that any authenticated user (in LOGIN_FORM/OAUTH2/LDAP) can enumerate every registered data source's name, ODDRN, host, database, and per-type entity counts; that ODDRN-derived properties via `getOddrnProperties` include `host` and `database`.
    - DirectoryController.md verifies: "DirectoryController has zero @PreAuthorize annotations and no entry in SecurityConstants.SECURITY_RULES (rule list is mutating-method-only; all four Directory routes are GETs). Falls through to global SecurityFilterChain `authenticated()` rule. Under auth.type=DISABLED Directory is open to any caller."
  - **Proposed doc action**: Add to `features/data-discovery/directory.md` a "Visibility scope" admonition: "Directory is a non-owner-scoped view of the entire registered-data-source inventory. Any authenticated user (LOGIN_FORM / OAUTH2 / LDAP) can enumerate every data source's name, host, database, ODDRN, and entity counts — including those whose entities they would not be able to read individually. Under `auth.type=DISABLED` the surface is anonymously reachable. For deployments where data-source topology must not be discoverable by all users, gate the `/api/directory*` paths at the network or reverse-proxy layer."
  - **Cross-references**:
    - DataEntity concept — same auth-mode-only-on-reads family
  - **Severity rationale**: HIGH — operator-facing reconnaissance leak; in regulated environments (PCI/SOX) the registered-data-source list is itself sensitive metadata.

- **DOC-GAP-009**: `developer-guides/api-reference` does not document the 40 dataEntity operations — punts to Swagger UI
  - **Category**: coverage-gap
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:docs_link_semantic.doc_drift_findings.[0]`
    - `concepts.yaml:entities[Data Entity].axes_present` (controllers + openapi_tags) — concept is the largest in the catalog
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-10 status 200 — page enumerates sub-pages: Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships. NO `data-entities` sub-page exists; page directs readers to Swagger UI at `{platform-base-url}/api/v3/api-docs`.
    - openapi-tag-dataEntity.md verifies the dataEntity tag groups ~40 operations.
    - SUMMARY.md verifies absence: no `developer-guides/api-reference/data-entities.md` entry.
  - **Proposed doc action**: Create `developer-guides/api-reference/data-entities.md` enumerating the 40 operations grouped by functional area (Catalog navigation, Lineage, Tags, Terms, Statuses, Description, Metadata, Activity, Messages, Alerts config, Group management, Internal name). Add to SUMMARY.md under the API Reference section. Cross-link from `features/data-discovery.md` and from the Permissions page.
  - **Cross-references**:
    - F-019 historic (pre-resolution) — the API-reference under-coverage class
    - DOC-GAP-029 (parallel: same gap shape for Activity Feed)
  - **Severity rationale**: HIGH — every API consumer building an integration writes against the dataEntity operations; punting them to Swagger UI mismatches the platform's stated API-reference surface.

- **DOC-GAP-010**: Attachment chunked-upload protocol (3-step state machine) undocumented anywhere; cross-entity uploadId hijack now confirmed at method level
  - **Category**: coverage-gap
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:concepts.operations.[chunked-file-upload]`
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[2]` + `:security.known_security_gaps.[0]` **(2026-05-10A — method-level evidence: hijack vector + multi-instance staging path)**
    - `concepts.yaml:operations[Chunked File Upload (3-step state machine)]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-10 status 200 — describes UX (drag-and-drop) but NOT the wire protocol API consumers must implement. Verbatim: "This is a user-facing feature guide, not an API reference. It explains *what* attachments do and *how users interact* with them, but omits technical implementation details for developers integrating file uploads programmatically."
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-10 status 200 — no `data-entity-attachments` sub-page; sub-pages enumerated above.
    - SUMMARY.md confirms absence of `developer-guides/api-reference/data-entity-attachments.md`.
    - **Method-level evidence (2026-05-10A)**: uploadFileChunk.md verifies (a) `uploadId` is the authoritative session key — `dataEntityId` from path is bound but never forwarded (`AttachmentService.java:30` signature has no `dataEntityId`), (b) cross-entity hijack: a user with `DATA_ENTITY_ATTACHMENT_MANAGE` on entity X who learns another user's `uploadId` Y issued for entity Z can post chunks via `POST /api/dataentities/X/files/uploads/Y/chunks` and the chunk lands against Z (gate authorises path entity, service forwards by uploadId), (c) multi-instance staging: chunk path `/tmp/odd/chunks/{uploadId}/{index}` is hardcoded (`FileUtils.CHUNK_BASE_PATH`, not config-driven) — applies to BOTH `attachment.storage=LOCAL` AND `REMOTE` (the chunk staging path is upstream of the storage-backend dispatch). The class-level sidecar identified the LOCAL multi-instance flavour; the method-level finding promotes it to storage-mode-independent.
  - **Proposed doc action**: Either create `developer-guides/api-reference/data-entity-attachments.md` or add a "Wire protocol" H2 to `features/data-discovery/attachments.md` documenting: (1) `POST /api/dataentities/{id}/files/uploads` issues `uploadId` UUID; (2) `POST /api/dataentities/{id}/files/uploads/{uploadId}/chunks` with `index` query param posts each chunk; (3) `POST /api/dataentities/{id}/files/uploads/{uploadId}/complete` finalises and returns DataEntityFile. Note that `uploadId` is the authoritative session key — the path's dataEntityId on chunk/complete is effectively cosmetic; **the cross-entity uploadId-hijack caveat (DOC-GAP-023) belongs in the same section AND the multi-instance chunk-staging caveat (REMOTE storage equally affected per uploadFileChunk.md) belongs adjacent to the LSN-001 attachment-ephemeral admonition on the same page.**
  - **Cross-references**:
    - DOC-GAP-009 (api-reference under-coverage) — same family
    - DOC-GAP-023 (cross-entity uploadId hijack) — fold into chunked-upload section
    - LSN-001 (attachment-ephemeral default) — extend the existing danger box to cover the chunk-staging path being storage-mode-independent
  - **Severity rationale**: HIGH — every integration uploading attachments via API has to reverse-engineer the protocol from the OpenAPI spec; the live page's "drag-and-drop" prose is misleading for non-browser callers; the method-level evidence (cross-entity hijack + multi-instance staging) makes the missing protocol doc carry direct security/operational consequences.

- **DOC-GAP-025**: Activity Feed exposes cross-owner audit trail (`old_state`/`new_state` diffs) to any authenticated user — undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[2,4]`
    - `concepts.yaml:entities[Activity Feed]`
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[0]` + `:security.data_exposure.[0,1]` + `:docs_link_semantic.doc_drift_findings.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-10 status 200 — page lists seven filter facets and 20+ event types. Does NOT mention: visibility / authorization, who can see the feed, the `type` parameter (MY_OBJECTS / UPSTREAM / DOWNSTREAM / ALL), pagination via `lastEventId`, or any access-control statement.
    - getActivity.md verifies: `/api/activity` and `/api/activity/counts` carry no `@PreAuthorize`, no SecurityRule, fall through to `pathMatchers('/**').authenticated()`. The default `type=null` and `type=ALL` paths both route to `fetchAllActivities` which has no owner predicate.
    - Activity payload includes `created_by` (actor identity) and `old_state`/`new_state` ActivityState diffs covering description free-text, business_name edits, internal_name edits on dataset fields, custom-metadata key/value, term/tag assignments, ownership transitions, alert halt-config changes.
  - **Proposed doc action**: Add a "Visibility scope" admonition to `features/active-platform-features/activity-feed.md`: "The global Activity feed (`GET /api/activity`) is gated by authentication only; any authenticated user can read **cross-owner** audit-trail events including actor identity, full old-state/new-state diffs. The `type=MY_OBJECTS` filter respects the caller's owner association; the default and `type=ALL` views do not. Under `auth.type=DISABLED` the feed is anonymously reachable."
  - **Cross-references**:
    - DOC-GAP-002, DOC-GAP-004, DOC-GAP-008 — the auth-mode-only-on-reads family
    - DOC-GAP-029 (Activity api-reference page missing) + DOC-GAP-030 (Activity Feed page omits type/visibility/pagination)
  - **Severity rationale**: HIGH — Activity Feed is the platform's audit-trail surface; cross-owner exposure of who-changed-what diffs is GDPR/SOX-relevant in regulated environments.

- **DOC-GAP-029**: No `/developer-guides/api-reference/activity` page — global Activity feed has no first-party API reference
  - **Category**: missing-page
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:docs_link_semantic.inferred_docs.[1]` (status 404, confidence LOW) + `:docs_link_semantic.doc_drift_findings.[2]`
    - `concepts.yaml:entities[Activity Feed].notes`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/activity` 2026-05-10 status 404.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-10 status 200 — no "Activity" entry.
  - **Proposed doc action**: Create `developer-guides/api-reference/activity.md` enumerating `GET /api/activity` (twelve query parameters with their semantics — beginDate/endDate required, size, datasourceId, namespaceId, tagIds, ownerIds, userIds, type [MY_OBJECTS|UPSTREAM|DOWNSTREAM|ALL with default=ALL], eventType, lastEventId, lastEventDateTime cursor pair); `GET /api/activity/counts`. Add to SUMMARY.md under API Reference. Include DOC-GAP-025's visibility-scope caveat.
  - **Cross-references**: DOC-GAP-009, DOC-GAP-025, DOC-GAP-030.
  - **Severity rationale**: HIGH — Activity Feed is the only first-party API consumer surface for audit trails; same family as DOC-GAP-009.

- **DOC-GAP-032**: Slack Data Collaboration cross-tenant message injection + missing authorization gate undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[0,2]` (both severity HIGH) + `:bugs_limitations_corner_cases.[0,3]` + `:docs_link_semantic.doc_drift_findings.[0,1]`
    - `concepts.yaml:entities[Slack collaboration app].security_aggregate.weaknesses.[0,1]` + `:cross_file_inconsistencies.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` 2026-05-10 status 200 — endpoint description documents the queue + retry behaviour. The page documents NO authentication / authorization requirements, NO request validation, NO rate-limit behaviour.
    - postMessageInSlack.md verifies: `SecurityConstants.java:96-355` has NO entry for `/api/datacollaboration/providers/slack/messages`; controller has no `@PreAuthorize`. The service accepts any user-supplied `data_entity_id` with only existence + hollow-check; no ownership check. `channel_id` is also fully user-supplied; no server-side mapping.
  - **Proposed doc action**: Add a "Security caveats" sub-section to `developer-guides/api-reference/data-collaboration.md` for the POST endpoint covering: authorization model (auth-only, no ownership check on `data_entity_id`, no allowlist on `channel_id`, no rate-limit, no body-size cap), DISABLED-mode anonymous reachability. Mirror the caveat on `features/active-platform-features/data-collaboration.md`.
  - **Cross-references**: DOC-GAP-002 / DOC-GAP-004 / DOC-GAP-008 / DOC-GAP-025 — auth-mode-only-on-reads family extended to a write surface.
  - **Severity rationale**: HIGH — Slack workspaces frequently host channel-level confidentiality assumptions; cross-tenant message injection plus arbitrary `channel_id` selection means an attacker with any platform login can post into any channel the bot is in.

- **DOC-GAP-036**: `auth.type=DISABLED` is the application.yml-bundled default but live `enable-security/authentication` pages do NOT state this — operator following the docs ships an unauthenticated platform without explicit opt-in
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:docs_link_semantic.doc_drift_findings.[1]` + `:bugs_limitations_corner_cases.[2]` (severity HIGH)
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:docs_link_semantic.doc_drift_findings.[1]` + `:security.known_security_gaps.[0]`
    - `odd-platform__java__DisabledAuthSecurityConfiguration__config-key-consumer__auth_type@L10.md:implicit_adrs.[0]` + `:security.known_security_gaps.[0]` (severity HIGH) **(2026-05-12C — wiring-site confirmation: application.yml:32-34 declares DISABLED default + live doc verbatim 'This is the default configuration')**
    - `concepts.yaml:entities[Auth Mode].security_aggregate.weaknesses` (now 4-sidecar triangulated default-open posture)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication` 2026-05-12 status 200 — confirmed verbatim: H1 "Disabled authentication"; body "ODD Platform allows to disable authentication at all. This is useful when you want to deploy platform locally and don't need any security configured. This is the default configuration and no additional settings are required."; YAML example `auth: type: DISABLED`; warning admonition "DO NOT use this method in your production environment!" — the page DOES say "This is the default configuration" (positive coverage of the default itself), but does NOT enumerate the blast radius (CSRF / CORS / actuator / S2S-ignored / audit-absence — see DOC-GAP-045).
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-12 status 200 — parent page does NOT state DISABLED is the default; only enumerates the four modes.
    - DisabledAuthSecurityConfiguration@L10.md verifies: `application.yml:32-34` declares `auth: # DISABLED, LOGIN_FORM, OAUTH2, LDAP\n  type: DISABLED`; the bean has no `matchIfMissing`. An operator who clears the key gets no `SecurityWebFilterChain` from any of the four config classes.
  - **Proposed doc action**: Extend `configuration-and-deployment/enable-security/authentication.md` (the parent navigation page) with an explicit "Default behaviour" admonition above the four mode rows: "**The application.yml-bundled default is `auth.type: DISABLED`.** A deployment that does not explicitly set `auth.type` inherits this default and runs with `DisabledAuthSecurityConfiguration` — every endpoint, every method, every payload `.anyExchange().permitAll()`. For any production-shaped deployment, explicitly set `auth.type` to one of `LOGIN_FORM` (dev only), `OAUTH2`, or `LDAP`. Empty-string values (`AUTH_TYPE=`) or typos (`OUATH2`, `LOGINFORM`) silently produce a deployment with no `SecurityWebFilterChain` bean. There is no boot-time fail-fast on misconfigured `auth.type`." Pair with sibling Known-limitations rows cross-referencing DOC-GAP-037 (appInfo fingerprinting), DOC-GAP-039 (LOGIN_FORM-drops-authorization), DOC-GAP-045 (DISABLED blast radius).
  - **Cross-references**:
    - LSN-001 / LSN-002 class
    - DOC-GAP-037, DOC-GAP-039, DOC-GAP-045 — sibling auth-mode-wiring-site findings
    - 4-sidecar concepts.yaml triangulation
  - **Severity rationale**: HIGH — canonical LSN-001-class default-open posture. The disabled-authentication page itself does name DISABLED as "the default configuration" (positive partial coverage), but the parent navigation page does not, and the consequence cluster (DOC-GAP-045) remains unstated.

- **DOC-GAP-037**: `/api/appInfo` discloses active `auth.type` + `projectVersion` to unauthenticated network callers under DISABLED-default — passive fingerprinting surface, undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:docs_link_semantic.doc_drift_findings.[0]` + `:security.data_exposure.[0,1]` + `:security.known_security_gaps.[0]`
    - `concepts.yaml:entities[Auth Mode].security_aggregate.weaknesses` (deployment fingerprinting)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-11 status 200 — verbatim verdict: "`/api/appInfo` endpoint — not mentioned"; "default value of `auth.type` (DISABLED as default) — not mentioned".
    - AppInfoController@L18.md verifies: `AppInfoController.java:24-28` returns `AppInfo.authType(authType).projectVersion(projectVersion)`; `SecurityConstants.WHITELIST_PATHS` does NOT include `/api/appInfo`. Under `auth.type=DISABLED`, the endpoint is anonymously reachable and discloses (a) the deployment's auth mode, (b) the precise platform version.
  - **Proposed doc action**: Add to `configuration-and-deployment/enable-security/authentication.md` a "Deployment introspection surfaces" sub-section: "`/api/appInfo` returns `{ projectVersion, authType }`. Under `auth.type=DISABLED` (the application.yml default — see DOC-GAP-036) the endpoint is reachable by any caller with network access; the response discloses the deployment's active auth mode and platform version."
  - **Cross-references**: DOC-GAP-036 (parent default-open posture); LSN-001/LSN-002 class.
  - **Severity rationale**: HIGH — combined with DOC-GAP-036, reliable network-side fingerprinting probe.

- **DOC-GAP-038**: `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:docs_link_semantic.doc_drift_findings.[0,1,2]` (all three HIGH) + `:bugs_limitations_corner_cases.[0,6]` (HIGH) + `:security.known_security_gaps.[0,3]` (HIGH)
    - `concepts.yaml:entities[Ingestion Filter]`
  - **Evidence**: see existing DOC-GAP-038 body (preserved); 2026-05-11 verifications stand.
  - **Proposed doc action**: Three-part doc action — per-datasource bearer-token sub-section, coverage table, default-behaviour admonition. See full text in batch 2026-05-10B retained.
  - **Cross-references**: DOC-GAP-036, DOC-GAP-003, DOC-GAP-034; LSN-001/LSN-002.
  - **Severity rationale**: HIGH — same shape as LSN-001 (attachment-ephemeral default).

- **DOC-GAP-039**: `auth.type=LOGIN_FORM` runs WITHOUT the authorization framework (Policies / Permissions / Roles / Owners) — `Authorization` page describes the framework with no mention of which auth modes wire it
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[1]` (severity HIGH) + `:security.known_security_gaps.[1]` (severity HIGH)
    - `odd-platform__java__LoginFormSecurityConfiguration__config-key-consumer__auth_type@L31.md:bugs_limitations_corner_cases.[0]` (severity HIGH) + `:security.known_security_gaps.[0]` (severity HIGH) **(2026-05-12C — wiring-site confirmation: LoginFormSecurityConfiguration.java:55-57 does NOT call `new AuthorizationCustomizer(...)`)**
    - `concepts.yaml:entities[Auth Mode].security_aggregate.weaknesses`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-11 status 200 — verbatim: "The Authorization page describes the authorization framework components (Policies, Permissions, Roles, Owners, and User-owner association) but does not discuss which authentication modes wire or enable these authorization features."
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form` 2026-05-12 status 200 — login-form page itself does NOT mention the authorization framework applicability.
    - LoginFormSecurityConfiguration@L31.md verifies: lines 55-57 configure only `.pathMatchers("/**").authenticated()` — NO `AuthorizationCustomizer`. By contrast OAuthSecurityConfiguration.java:98 and LDAPSecurityConfiguration.java:145 BOTH instantiate `new AuthorizationCustomizer(permissionService, extractors)`. Result: every form-authenticated user can call every endpoint regardless of any Policy/Permission/Role configured via the UI.
  - **Proposed doc action**: Add a "Authorization framework applicability" admonition to the top of `configuration-and-deployment/enable-security/authorization.md`: "The Policies / Permissions / Roles / Owners framework described on this page is wired ONLY when `auth.type` is `OAUTH2` or `LDAP`. Under `auth.type=LOGIN_FORM` (documented as dev-only) the platform falls through to `.authenticated()` — every authenticated user can call every endpoint covered by Policy gates. Under `auth.type=DISABLED` (the application.yml default — see DOC-GAP-036) there is neither authentication nor authorization. To deploy with the access-control posture this page describes, set `auth.type` to `OAUTH2` or `LDAP`." Mirror with a sibling note on the authentication parent page next to the LOGIN_FORM row and a fail-loud caveat on `login-form.md` itself.
  - **Cross-references**: DOC-GAP-036, DOC-GAP-040, DOC-GAP-002/004/008/025 (auth-mode-only-on-reads family).
  - **Severity rationale**: HIGH — operators landing on `Authorization` reasonably assume the framework applies under all four modes; switching to LOGIN_FORM in a misconfigured production deployment silently disables every Policy gate. 2026-05-12C wiring-site evidence promotes this to "load-bearing" — every LOGIN_FORM user is also granted ADMIN authorities (`LoginFormSecurityConfiguration.java:81`) which compounds the gap.

- **DOC-GAP-041**: Activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code never DROPs activity partitions AND housekeeping has no `activity*Days` field; the retention claim is materially incorrect (**2-angle CONFIRMED batch D**)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[0]` (severity HIGH — "silent-data-growth class — analogous to LSN-001")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[0]` (severity HIGH — "Drift CONFIRMED from second angle") **(NEW batch D — 2-angle triangulated)**
    - `concepts.yaml:entities[Activity Table Partitioning]` + `:entities[Housekeeping TTL]` (new batch D)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-12 status 200 — verbatim Configuration section claims `Activity-feed retention and partitioning are controlled by the platform-level setting odd.activity.partition-period`. Page does NOT specify what "retention" means or whether ODD actively removes activity records based on age.
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-11 + 2026-05-12 status 200 — partition-period section documents cadence but contains NO mention of retention or DROP semantics.
    - ActivityTablePartitionManager@L11.md verifies code-side angle 1: `AbstractPartitionManager.createPartitionsIfNotExists` only CREATEs partitions; it never invokes `PartitionService.dropPartition`.
    - **Batch D — angle 2 from HousekeepingTTLProperties**: The `housekeeping.ttl.*` surface has EXACTLY three fields (`resolvedAlertsDays`, `searchFacetsDays`, `dataEntityDeleteDays`) — there is NO `activityDays` or equivalent. The only activity-touching housekeeping path is `ActivityEmptyPartitionsHousekeepingJob` which calls `partitionService.getEmptyPastPartitions(...)` → `partitionService.dropPartition(...)` — but this requires the partition to ALREADY BE EMPTY (`isPartitionEmpty` at `PartitionServiceImpl.java:133-141` checks `COUNT(*) = 0`). There is NO code path that deletes activity rows by age. Both angles agree: time-based retention for activity-feed data does not exist anywhere in the platform codebase.
  - **Proposed doc action**: Two-part fix. (1) Remove "retention" from the activity-feed page's claim; replace with cadence-only wording: "Activity-feed partitioning cadence is controlled by `odd.activity.partition-period`. ODD does NOT retention-delete activity rows — operators with high-volume activity must manually drop old partitions or implement application-level archival." (2) Add to `configuration-and-deployment/odd-platform.md` partition-period section a "Known limitations: no automatic retention" admonition. (3) **Batch D add**: extend the housekeeping section of `configuration-and-deployment/odd-platform.md` to note that the "three cleanup tasks" enumeration covers `AlertHousekeepingJob` / `SearchFacetsHousekeepingJob` / `DataEntityHousekeepingJob` but NOT the two `EmptyPartitionsHousekeepingJob` siblings (Activity + Message), and that the empty-partitions jobs are different from row-by-age retention.
  - **Cross-references**: LSN-001 class; DOC-GAP-042; DOC-GAP-043; **DOC-GAP-060 (NEW batch D — housekeeping coverage incomplete)**; **DOC-GAP-061 (NEW batch D — companion finding on MESSAGE table)**.
  - **Severity rationale**: HIGH — materially incorrect doc claim with LSN-001-class operational consequence. Multi-angle confirmation (batch B + D) elevates confidence.

- **DOC-GAP-045**: `disabled-authentication` page declares DISABLED "the default configuration" with a single production-warning, but omits the full blast radius (CSRF / CORS / actuator / S2S-ignored / audit-absence / no boot WARN)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__DisabledAuthSecurityConfiguration__config-key-consumer__auth_type@L10.md:docs_link_semantic.doc_drift_findings.[0,1,2,3]` (all four HIGH or MEDIUM with HIGH parent classification) + `:bugs_limitations_corner_cases.[0,1,2,4,5]` + `:security.known_security_gaps.[0,1,2,3,4,5]` (multiple HIGH/MEDIUM) **(new 2026-05-12C — wiring-site-level evidence)**
    - `concepts.yaml:entities[Auth Mode]` (canonical sidecar — concept axes expanded with `config_prefixes` + `controllers` after batch C)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication` 2026-05-12 status 200 — full page body re-verified verbatim: H1 "Disabled authentication"; body "ODD Platform allows to disable authentication at all. This is useful when you want to deploy platform locally and don't need any security configured. This is the default configuration and no additional settings are required."; YAML `auth: type: DISABLED`; warning "DO NOT use this method in your production environment!". Re-verified the page does NOT mention: (a) CSRF protection or its absence, (b) CORS configuration, (c) actuator endpoints, (d) audit logging, (e) S2S filter behaviour under DISABLED, (f) `/api/appInfo` introspection, (g) `auth.s2s.enabled` being silently ignored under DISABLED, (h) absence of boot-time WARN log.
    - DisabledAuthSecurityConfiguration@L10.md verifies: (a) `DisabledAuthSecurityConfiguration.java:15` calls `.csrf(ServerHttpSecurity.CsrfSpec::disable)` — CSRF off; (b) no `.cors(...)` call in the entire class (line 13-18) — and no global `CorsWebFilter` / `CorsConfigurationSource` bean anywhere in `<odd-platform-repo>/odd-platform-api/src/main/java` (verified via grep 2026-05-12); (c) `application.yml:226-240` enables `/actuator/health|prometheus|env|info` by default, and `SecurityConstants.WHITELIST_PATHS:95-96` lists `/actuator/**` regardless of mode — under DISABLED's `.anyExchange().permitAll()` they are unauthenticated; (d) grep for `AuditLog | @Auditable | AuthLogger | accessLog` across `<odd-platform-repo>/odd-platform-api/src/main/java` returned zero matches 2026-05-12 — no audit infrastructure anywhere; (e) `DisabledAuthSecurityConfiguration.java:13-18` does NOT read `auth.s2s.enabled` — under DISABLED, `auth.s2s.enabled=true` is silently ignored (the S2sAuthenticationFilter is wired in LoginForm/OAuth/LDAP only via `LoginFormSecurityConfiguration.java:61-63`, `OAuthSecurityConfiguration.java:108-110`, `LDAPSecurityConfiguration.java:149-151`); (f) `AppInfoController` is anonymously reachable under DISABLED per DOC-GAP-037; (g) the class has no `@Slf4j` annotation, no `org.slf4j.Logger` import, no `log.warn(...)` — the deployment boots silently into an unauthenticated state with no log signal (contrast with `LDAPSecurityConfiguration.java:56` which IS `@Slf4j`).
  - **Proposed doc action**: Extend `configuration-and-deployment/enable-security/authentication/disabled-authentication.md` with a "Blast radius" / "What DISABLED actually disables" section immediately below the warning admonition: "Under `auth.type=DISABLED` the platform serves every HTTP path under `/**` to every network caller with no authentication and no authorization. Additionally: (1) **CSRF** is disabled — POST/PUT/DELETE without CSRF tokens succeed. (2) **CORS** is unconfigured at the security layer — cross-origin browser callers reach the application via `.anyExchange().permitAll()` but no `Access-Control-*` response headers are added; behaviour is inconsistent vs `OAUTH2`/`LDAP` which both call `.cors(withDefaults())`. (3) **Actuator endpoints** `/actuator/{health,prometheus,env,info}` (enabled by default in `application.yml:226-240`) are reachable on the same HTTP port; `/actuator/env` discloses resolved configuration property names. (4) **`auth.s2s.enabled=true` is silently ignored** under DISABLED — the S2sAuthenticationFilter is only wired in `LOGIN_FORM`/`OAUTH2`/`LDAP`. An operator who configures S2S thinking it overlays additional protection on top of DISABLED gets no warning. (5) **No audit logging** is emitted by any auth path in the codebase — under DISABLED specifically, attackers leave no audit trail. (6) **No boot-time WARN** is logged when DISABLED activates — the class has no `@Slf4j`. Operators inheriting an unmodified container image get DISABLED with no startup signal." Pair with a sibling Known-limitations row on the parent `enable-security/authentication.md` cross-referencing this section.
  - **Cross-references**:
    - DOC-GAP-036 (DISABLED-default of `auth.type` undocumented) — parent finding; this DOC-GAP-045 captures the blast-radius gap that DOC-GAP-036's admonition should reference
    - DOC-GAP-037 (`/api/appInfo` fingerprinting under DISABLED) — sub-finding of the same blast radius
    - DOC-GAP-006 (actuator/env exposure for S3 credentials) — same actuator-exposure root cause, different consumer
    - LSN-001 / LSN-002 — bundled-default insecure-default class
    - Drives a `/log-issue odd-platform` upstream issue for the boot WARN
  - **Severity rationale**: HIGH — the page exists and frames DISABLED as "the default configuration" with a production warning; an operator who reads the warning and decides DISABLED is OK for dev gets no view of the SIX additional consequences beyond "no authentication." This is the most directly LSN-001-class "framing without blast radius" gap in the entire ontology — a single page where adding one section would close six operational caveats at once.

- **DOC-GAP-046**: OAuth2/OIDC docs list 7 supported providers (AWS Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC) but `Provider` enum has only 5; Okta/Keycloak operators silently get no provider-specific user enrichment and no provider-specific logout (**2-angle CONFIRMED batch D from primary-source POJO sidecar**; see also DOC-GAP-069, DOC-GAP-070 for batch-D-surfaced refinements: ODD_IAM completely absent from docs, `adminUserInfoFlag` field undocumented)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:docs_link_semantic.doc_drift_findings.[0]` (severity HIGH) + `:bugs_limitations_corner_cases.[4]` (severity HIGH) + `:security.known_security_gaps.[3]` (severity HIGH) **(2026-05-12C)**
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:docs_link_semantic.doc_drift_findings.[2]` (primary-source POJO confirmation — `Provider.java:3-5` lists exactly 5: COGNITO/GITHUB/GOOGLE/ODD_IAM/AZURE) **(NEW batch D — 2-angle triangulated)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim: lists 7 providers (AWS Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC providers). Includes YAML examples for Keycloak (`provider: keycloak`) and Okta (`provider: okta`).
    - OAuthSecurityConfiguration@L71.md verifies: `Provider.java:3-5` enumerates exactly 5 values: `COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE`. `<odd-platform-repo>/odd-platform-api/src/main/java/.../auth/handler/impl/` contains only `GoogleUserHandler.java` and `GithubUserHandler.java` (verified via filesystem listing 2026-05-12). `<odd-platform-repo>/odd-platform-api/src/main/java/.../auth/logout/` contains 5 named handlers: Cognito, Google, GitHub, Azure, ODD_IAM (no Okta, no Keycloak). The `Provider.GOOGLE.name()` comparison at `OAuthSecurityConfiguration.java:168` is the only enum-typed comparison; everywhere else `properties.getClient().get(providerId).getProvider()` flows as a raw string into `shouldHandle(provider)`.
    - Result: Okta and Keycloak operators authenticate via generic OIDC (Spring's discovery handles them) but: (a) get NO provider-specific user enrichment (no admin-group claim mapping for `groups`/`roles` claims — operators following the Keycloak/Okta docs examples expecting admin assignment via group membership get silent failure), (b) get NO provider-specific logout (fallback to OIDC-initiated logout only; acceptable for OIDC-compliant providers but operators relying on Okta's admin-group mapping see no admin role assignment).
    - Adjacent gap: `ODD_IAM` IS in the `Provider` enum but is NOT documented on the live OAuth2/OIDC page — drift in the other direction (docs missing the ODD_IAM option).
  - **Proposed doc action**: Two-part doc action. (1) On `configuration-and-deployment/enable-security/authentication/oauth2-oidc.md`, add a "Provider handler coverage" Known-limitations admonition next to the Supported Providers list: "Provider-specific behaviour (user enrichment, admin-group claim mapping, logout) is implemented in handler classes under `auth/handler/impl/` and `auth/logout/`. The current handler set covers: **User enrichment** — Google + GitHub only. **Logout** — Cognito + Google + GitHub + Azure + ODD_IAM. **Okta + Keycloak + Custom OIDC providers** authenticate via generic OIDC discovery and receive: NO provider-specific user enrichment (admin-group claims from these providers are not mapped to the platform's ADMIN role — every Okta/Keycloak user authenticates as a regular USER regardless of group membership), NO provider-specific logout (falls back to OIDC-initiated end-session, which works when the provider supports it). For Okta/Keycloak admin-group integration, file an upstream issue requesting handler implementations." (2) Add a "Provider value" note for the `ODD_IAM` enum member: "The `ODD_IAM` provider value is supported by the platform (logout handler present) but is intended for ODD-hosted deployments; external operators should use one of the public providers listed above."
  - **Cross-references**: LSN-010 (Azure admin-groups default key drift) — same family of "admin-role assignment defaults are a recurring documentation drift surface across auth modes". Drives a `/log-issue odd-platform` upstream for handler implementations.
  - **Severity rationale**: HIGH — operators following the OAuth2/OIDC docs for Okta or Keycloak deploy expecting admin-group integration to work and get a silent gap; the docs frame these as supported providers with no warning.

- **DOC-GAP-047**: OAuth2 docs reference `azure-tenant-id` config key + use `${auth.oauth2.client.azure.azure-tenant-id}` interpolation, but `ODDOAuth2Properties.OAuth2Provider` POJO has NO `azureTenantId` field — Azure YAML example is not deployable as-shown
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:docs_link_semantic.doc_drift_findings.[3]` + `:bugs_limitations_corner_cases.[7]` (severity MEDIUM per sidecar; HIGH per concepts.yaml triangulation — docs example is not deployable) **(new 2026-05-12C)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim Azure section quotes `azure-tenant-id` field references: "`azure-tenant-id` must still be set to the tenant that owns the app registration." The YAML examples use `${auth.oauth2.client.azure.azure-tenant-id}` interpolation in `issuer-uri`.
    - OAuthSecurityConfiguration@L71.md verifies: `ODDOAuth2Properties.OAuth2Provider` at `ODDOAuth2Properties.java:32-52` has fields `clientId, clientSecret, provider, clientName, redirectUri, scope, issuerUri, authorizationUri, tokenUri, userInfoUri, jwkSetUri, logoutUri, userNameAttribute, adminAttribute, groupsClaim, adminUserInfoFlag, adminGroups, adminPrincipals, organizationName, allowedDomain, pkce` — and crucially does NOT include `azureTenantId`. The commented Azure example in `application.yml:128-156` uses the same `${auth.oauth2.client.azure.azure-tenant-id}` pattern. An operator who uncomments the example as-is hits a Spring `Could not resolve placeholder` failure at boot.
  - **Proposed doc action**: Two-part doc fix (with a code-side option). Doc-side: update the Azure section on `oauth2-oidc.md` to either (a) drop the `azure-tenant-id` separate key and have operators inline the tenant id into `issuer-uri` directly (`https://login.microsoftonline.com/{your-tenant-id}/v2.0`), or (b) document that the field must be added to the operator's local properties via a workaround. Recommend (a) as the canonical fix — matches Spring Boot's OAuth2 client convention. Code-side: file `/log-issue odd-platform` to either add the `azureTenantId` field to `ODDOAuth2Properties.OAuth2Provider` OR update the docs example. The decision is the maintainer's; the doc-vs-code divergence is the finding.
  - **Cross-references**: DOC-GAP-048 (Azure `logout-uri` not validated — same Azure-doc-vs-code surface). Drives `/log-issue odd-platform` for field/docs reconciliation.
  - **Severity rationale**: HIGH — the docs YAML example is not deployable verbatim. Operators copy-pasting the Azure example hit a Spring placeholder-resolution failure at boot. This is the "doc example doesn't run" failure mode — visible at first deploy, costly because the operator has to debug what should have been a copy-paste.

- **DOC-GAP-048**: OAuth2 docs flag Azure `logout-uri` as REQUIRED ("unset value causes NullPointerException") but `ODDOAuth2Properties.validate()` only checks `clientId` and `provider` — operator boots successfully and fails at first logout
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:docs_link_semantic.doc_drift_findings.[2]` + `:bugs_limitations_corner_cases.[3]` + `:security.known_security_gaps.[4]` (severity MEDIUM per sidecar; HIGH per concepts.yaml triangulation) **(new 2026-05-12C)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim: "Always include `logout-uri` when configuring the `azure` provider." When unset: "leaving `logout-uri` unset raises a `NullPointerException` and the logout flow returns a 500 response."
    - OAuthSecurityConfiguration@L71.md verifies: `ODDOAuth2Properties.validate()` (lines 17-28) checks `clientId` and `provider` for non-empty only; `logoutUri` and other fields are unchecked. An operator following the Azure example without `logout-uri` boots successfully and fails at first logout — runtime failure, not boot failure. Fail-fast was applied to `clientId` and `provider`; the same posture was not extended to `logoutUri` despite the docs flagging it as required.
  - **Proposed doc action**: Two-part fix. (1) Doc-side stop-gap: strengthen the Azure section's caveat verbatim on `oauth2-oidc.md`: "**Critical**: `logout-uri` must be configured for the Azure provider. The platform does NOT validate this at boot time — an Azure deployment without `logout-uri` boots successfully and fails at the first user logout with a 500 response. Verify your deployment has `auth.oauth2.client.azure.logout-uri` set before promoting to production." (2) Code-side fix (preferred long-term): file `/log-issue odd-platform` to extend `ODDOAuth2Properties.validate()` to require `logoutUri` when `provider.equalsIgnoreCase("azure")`. The same posture should extend to any provider-specific required field.
  - **Cross-references**: DOC-GAP-047 (Azure tenant-id field absent — same Azure-doc-vs-code surface). Drives `/log-issue odd-platform`.
  - **Severity rationale**: HIGH — the docs name the requirement explicitly but the code's fail-fast posture is incomplete; operators rely on the platform's boot-time validation for safety nets that don't exist for this field.

- **DOC-GAP-049**: OAuth2/OIDC docs do NOT mention `auth.s2s.enabled` or the S2S composition with OAUTH2 — operators deploying OAuth2 + S2S see an undocumented X-API-Key → ADMIN-across-all-paths surface
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:docs_link_semantic.doc_drift_findings.[1]` + `:bugs_limitations_corner_cases.[5]` + `:security.known_security_gaps.[0]` (severity HIGH) **(new 2026-05-12C)**
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:bugs_limitations_corner_cases.[6]` + `:security.known_security_gaps.[no-failure-handler? actually S2S]` (related — LDAP page silent on S2S composition too)
    - `concepts.yaml:entities[Auth Mode]` (S2S composes-not-mutex — 4-sidecar triangulated)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim verdict: the page does NOT mention `auth.s2s.enabled` or discuss how S2S authentication composes with OAuth2.
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` 2026-05-12 status 200 — LDAP page is also silent on S2S composability.
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s` 2026-05-12 status 200 — does correctly state "S2S runs alongside the configured interactive auth mechanism, not instead of it" + "they can call any endpoint that admins can call" + lists `LOGIN_FORM`, `OAUTH2`, `LDAP` as compatible — but the doc graph is one-directional; landing on the OAuth2/OIDC or LDAP page does not surface this.
    - OAuthSecurityConfiguration@L71.md + LDAPSecurityConfiguration@L51.md verify: `OAuthSecurityConfiguration.java:108-110` and `LDAPSecurityConfiguration.java:149-151` both `addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC)` when `auth.s2s.enabled=true`. The S2S filter (`S2sAuthenticationFilter.java:31-34`) injects a hard-coded `ADMIN` user + `ADMIN` role into the security context — applying across the ENTIRE `/**` surface (not just `/ingestion/**`). An operator setting `auth.s2s.enabled=true` alongside OAUTH2 or LDAP exposes a broad API-key authentication surface — every controller, every endpoint, every method — with ADMIN privilege.
  - **Proposed doc action**: Add a "Server-to-server (S2S) composability" admonition to BOTH `oauth2-oidc.md` and `ldap.md` (and `login-form.md` for symmetry): "When `auth.s2s.enabled=true` (default `false` per `application.yml:40-41`), the S2sAuthenticationFilter is layered on top of the active auth mode at the `HTTP_BASIC` filter slot. Requests bearing a valid `X-API-Key` header are processed as a hard-coded ADMIN principal — across the ENTIRE `/**` surface, not just the ingestion paths. This composition is distinct from `auth.ingestion.filter.enabled` (the per-datasource bearer-token filter that only covers `/ingestion/entities`). See [Server-to-server (S2S)](/configuration-and-deployment/enable-security/authentication/s2s.md) for the full filter behaviour, and treat the S2S token as a high-privilege admin-equivalent credential." Cross-link from each mode page to the S2S sub-page.
  - **Cross-references**:
    - DOC-GAP-051 (LDAP page silent on multiple security caveats — S2S composition is one of seven gaps)
    - DOC-GAP-052 (LOGIN_FORM page omits authorization framework applicability)
    - The S2S-composes-not-mutex cross-cutting pattern (4-sidecar triangulated in concepts.yaml batch C)
  - **Severity rationale**: HIGH — operators deploying OAuth2/LDAP and reading the dedicated mode page have no view of the S2S surface unless they separately land on the S2S sub-page; the X-API-Key → ADMIN-across-`/**` semantics are operationally significant and deserve cross-linking from each mode page.

- **DOC-GAP-050**: LDAP `auth.ldap.password` leak surface — actuator-env value-mask is operator-overridable AND the **durable** leak vector is Lombok `@Data`-generated `toString()` (**REFINED batch D**: from primary-source `ODDLDAPProperties` sidecar; Spring Boot 3.4.10's `show-values: NEVER` default DOES sanitise actuator-env; Lombok-toString is the canonical leak path)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:docs_link_semantic.doc_drift_findings.[actuator-env password leak]` + `:bugs_limitations_corner_cases.[actuator-env password leak]` (severity HIGH) + `:security.known_security_gaps.[actuator env password]` (severity HIGH) **(2026-05-12C)**
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDLDAPProperties.md:docs_link_semantic.doc_drift_findings.[3]` + `:bugs_limitations_corner_cases.[0]` (severity HIGH) + `:security.known_security_gaps.[0]` (severity HIGH) **(NEW batch D — primary-source POJO refinement)**
    - `concepts.yaml:entities[Auth Mode]` + `invariants.lombok-toString-leak` (4-sidecar triangulated)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` 2026-05-12 status 200 — verbatim verdict (re-verified): page does NOT mention Spring actuator endpoints or credential exposure concerns; documents `auth.ldap.password` as configuration key with NO exposure warning of any kind.
    - **Batch D refinement from ODDLDAPProperties.md primary-source**: Spring Boot 3.4.10 (pinned at `<odd-platform-repo>/odd-platform-api/build.gradle:2`) ships `management.endpoint.env.show-values: NEVER` as the framework default — so `/actuator/env` returns `auth.ldap.password: ******` (VALUE IS MASKED). The batch-C framing focused on actuator-env was overbroad. The DURABLE leak vector is: `ODDLDAPProperties.java:10,14` declares `password` as plain `String` field with Lombok `@Data` (line 10) generating a public getter + a `toString()` that includes ALL fields, NO `@ToString.Exclude` on `password`, NO `@JsonIgnore`. Any code path that logs the bean (`log.info("properties = {}", properties)`) — or any future code addition that does — emits the password verbatim, bypassing actuator masking entirely. Grep for `keys-to-sanitize` across `<odd-platform-repo>` returned zero hits 2026-05-12 (no platform-side masking override). The actuator-exposure concern remains valid as a defence-in-depth concern (operators may override `show-values` to `WHEN_AUTHORIZED` or `ALWAYS`; the key NAMES are always returned even with masking).
    - LDAPSecurityConfiguration@L51.md verifies whitelist scope: `SecurityConstants.WHITELIST_PATHS:95-96` lists `/actuator/**` — `AuthorizationCustomizer.java:22-24` permitAll-s the whitelist BEFORE the authenticated fall-through. Under any auth mode (LOGIN_FORM/OAUTH2/LDAP), `/actuator/env` is reachable WITHOUT authentication. Under DISABLED, the actuator surface is reachable across the entire HTTP plane (per DOC-GAP-045).
  - **Proposed doc action**: Add a "Credential exposure surface" admonition to `configuration-and-deployment/enable-security/authentication/ldap.md`: "**Two distinct leak surfaces apply to `auth.ldap.password`**. **(1) Actuator surface**: the platform's default `management.endpoints.web.exposure.include` exposes `/actuator/env`, reachable through `SecurityConstants.WHITELIST_PATHS` BEFORE any auth check (under any non-DISABLED auth mode) and anonymously under `DISABLED`. Spring Boot 3.4.10's framework default `management.endpoint.env.show-values: NEVER` MASKS the password VALUE — operators see `auth.ldap.password: ******`. The key NAME is always returned, confirming the credential's existence and shape. Operators who override `show-values` to `WHEN_AUTHORIZED` or `ALWAYS` re-expose the value. **(2) Logging surface (the durable leak vector)**: `ODDLDAPProperties` uses Lombok `@Data` which auto-generates a `toString()` covering ALL fields including `password` — there is no `@ToString.Exclude`, no `@JsonIgnore`. Any code path that logs the bean (`log.info(\"properties = {}\", properties)`) — or any future code addition that does — emits the password verbatim. The actuator masking does NOT apply to in-process log output. **Mitigation**: (a) override actuator exposure to drop `env`, or move Actuator to a separate management port; (b) keep `show-values: NEVER` (the default) intact; (c) avoid logging Properties beans verbatim — see DOC-GAP-067 (META) for the cross-cutting Lombok-toString class." Mirror on `oauth2-oidc.md` (client-secret), `login-form.md` (credentials), and the parent `enable-security.md`.
  - **Cross-references**:
    - DOC-GAP-006 (attachment.remote.access-key / secret-key — same actuator-exposure root cause; this DOC-GAP-050 is the LDAP-flavoured sibling)
    - F-054 (DOC-163 actuator exposure parent finding) — fold both DOC-GAP-006 and DOC-GAP-050 into F-054's authoring as sibling caveats
    - DOC-GAP-045 (under DISABLED, the actuator surface is anonymously reachable — amplifies this finding)
  - **Severity rationale**: HIGH — LDAP bind credentials are operationally sensitive (compromise allows directory-wide reconnaissance); the docs name the property without warning that it is reachable via the platform's own HTTP surface. Same LSN-001-class operational consequence as DOC-GAP-006.

- **DOC-GAP-051**: LDAP setup page omits `ldap://` vs `ldaps://` scheme guidance, substring-match admin-groups collision risk, empty admin-groups → no admins, S2S composability, `management.health.ldap.enabled` default false, and timeout/pooling configuration — seven distinct caveats absent
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md:docs_link_semantic.doc_drift_findings.[ldap vs ldaps, empty admin-groups → no admins, S2S composes with LDAP, LdapTemplate flag combination, health.ldap.enabled default false, provider=null for LDAP UserDto]` (severity HIGH on multiple) + `:bugs_limitations_corner_cases.[no LDAPS enforcement, containsIgnoreCase substring collision, no admins when adminGroups empty, S2S admin everywhere, size-limit silent truncation, no reachability check at boot]` (multiple HIGH) + `:security.known_security_gaps.[no LDAPS enforcement, substring admin match, no admins when empty, size-limit silent truncation, health.ldap.enabled false]` (multiple HIGH) **(new 2026-05-12C — seven distinct gaps on one doc page)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` 2026-05-12 status 200 — verbatim verdict: NONE of the seven specific security/operability caveats are addressed in this page. Page documents `auth.ldap.url` with example `ldap://localhost:389` (no LDAPS guidance), `auth.ldap.groups.admin-groups: 'A list granting admin permissions'` (no substring-match warning, no empty-list consequence), no S2S cross-link, no health-check status, no timeout/pool tuning.
    - LDAPSecurityConfiguration@L51.md verifies SEVEN distinct gaps: (1) **ldap://-vs-ldaps://**: `LDAPSecurityConfiguration.java:119` accepts the URL verbatim, NO scheme enforcement; under `ldap://`, bind credentials AND end-user login credentials travel in cleartext. (2) **substring admin-collision**: `LDAPSecurityConfiguration.java:48,94-98` uses `containsIgnoreCase` (substring match) — `admin-groups: ['ops']` matches LDAP groups `cn=ops`, `cn=devops`, `cn=noops`, `cn=oopsgroup`; a typo or wildcard-sounding admin-group name escalates membership across unrelated groups. (3) **empty admin-groups → no admins**: `LDAPSecurityConfiguration.java:91-93` returns USER-only when `admin-groups` is empty/null; the only path to ADMIN in such a deployment is via S2S API key. (4) **S2S composability**: `LDAPSecurityConfiguration.java:140,149-151` adds the S2S filter at `HTTP_BASIC` when `auth.s2s.enabled=true` — X-API-Key requests grant ADMIN across all `/**` (covered by DOC-GAP-049 cross-reference). (5) **size-limit silent truncation**: `LDAPSecurityConfiguration.java:131` `setIgnoreSizeLimitExceededException(true)` — group-membership queries silently truncate; an admin user whose membership lives past the cutoff is silently demoted with no log line. (6) **health.ldap.enabled default false**: `application.yml:242-243` — `/actuator/health` does NOT include LDAP-server reachability; a directory outage is invisible. (7) **no timeout/pool config**: `LDAPSecurityConfiguration.java:117-124` has no `setPooled(true)`, no JNDI connect/read timeouts — slow LDAP server stalls logins at JNDI default (minutes-scale TCP-connect timeout).
  - **Proposed doc action**: Add a "Security and operability caveats" H2 to `configuration-and-deployment/enable-security/authentication/ldap.md` enumerating all seven caveats. Recommend authoring as a cluster — one section, seven sub-bullets — rather than seven separate admonitions. Suggested order: (a) LDAPS scheme (operational baseline first); (b) actuator/env password exposure (DOC-GAP-050 — cross-link); (c) substring admin-group collision; (d) empty admin-groups → no admins; (e) S2S composability (DOC-GAP-049 — cross-link); (f) `management.health.ldap.enabled` default false; (g) no timeout/pool config. Each bullet should name the proximate operational consequence + the recommended mitigation.
  - **Cross-references**:
    - DOC-GAP-049 (S2S composability — sub-bullet of this cluster)
    - DOC-GAP-050 (actuator/env LDAP password — sub-bullet of this cluster)
    - DOC-GAP-006 (actuator/env attachment credentials) + DOC-GAP-050 — same actuator-exposure family
    - LSN-001 / LSN-002 — bundled-default insecure-default class (LDAPS-vs-LDAP silence is canonical)
    - Drives `/log-issue odd-platform` upstream for: (1) scheme-validation + boot WARN on `ldap://`; (2) equality-match option for admin-groups; (3) `management.health.ldap.enabled=true` default when `auth.type=LDAP`; (4) JNDI timeouts via `LdapContextSource.setBaseEnvironmentProperties(...)`
  - **Severity rationale**: HIGH — seven distinct caveats on one page is the largest single-page coverage gap in the catalog. Each caveat individually is HIGH or MEDIUM; the cluster is HIGH because the page's audience (enterprise / on-prem operators) is the highest-stakes audience in the auth-mode catalog. An operator following this page without the additional caveats deploys a directory integration with several silent-failure modes.

- **DOC-GAP-052**: LOGIN_FORM page omits `auth.login-form-redirect` config key (open-redirect surface), the absence of the authorization framework (DOC-GAP-039 sibling), session-cookie security flags, S2S composability, plain-text credential leak via `/actuator/env`, and CSRF posture — six distinct caveats absent
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__LoginFormSecurityConfiguration__config-key-consumer__auth_type@L31.md:docs_link_semantic.doc_drift_findings.[1,2]` (Authorization absent, login-form-redirect undocumented) + `:bugs_limitations_corner_cases.[1,5,6,7]` (multiple MEDIUM) + `:security.known_security_gaps.[1,2,3,4]` (multiple MEDIUM) **(new 2026-05-12C)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form` 2026-05-12 status 200 — verbatim verdict: page does NOT mention any of: `auth.login-form-redirect`, the Policies/Permissions/Roles/Owners framework applicability under LOGIN_FORM, CSRF protection, session cookie configuration details (HttpOnly/Secure/SameSite — only mentions "does not support rotation, session revocation, or MFA"), S2S filter co-existence, plain-text credential leak via `/actuator/env`. The page DOES say "LOGIN_FORM stores credentials in plain text in the platform configuration" — but that frames the storage as the operator's config-file concern, not as an actuator-exposure leak.
    - LoginFormSecurityConfiguration@L31.md verifies: (a) `auth.login-form-redirect` read at line 41 with default `""`; if set, `URI.create(redirectURIString)` at line 89 is invoked WITHOUT scheme/host/path validation, then drives `DefaultServerRedirectStrategy().sendRedirect(...)` at line 46 — open-redirect surface depending on configuration origin. (b) `LoginFormSecurityConfiguration.java:55-57` configures only `.authorizeExchange(... .pathMatchers(permittedPaths).permitAll().pathMatchers("/**").authenticated())` — NO `AuthorizationCustomizer` (cross-references DOC-GAP-039). (c) Session cookie has no `Secure`/`HttpOnly`/`SameSite` configured; `application.yml:1-3` sets `spring.session.timeout: -1` (sessions never expire) and `session.provider: IN_MEMORY` (no revocation, no shared store across replicas). (d) `auth.s2s.enabled=true` composes with LOGIN_FORM via `LoginFormSecurityConfiguration.java:61-63` — same `addFilterAt(s2sAuthenticationFilter, HTTP_BASIC)` pattern (cross-references DOC-GAP-049). (e) `auth.login-form-credentials` is bound via `@Value` to a plain String; `/actuator/env` exposes the value (Spring's default sanitisation does NOT mask `auth.login-form-credentials` by the `password`/`secret`/`key` key-pattern — verify; the `credentials` key name does not trigger Spring's default masking). (f) CSRF unconditionally disabled at line 54 on a session-cookie-based auth mode — a logged-in user visiting a malicious site can have state-changing requests issued via their session cookie.
  - **Proposed doc action**: Add a "Security and operability caveats" H2 to `configuration-and-deployment/enable-security/authentication/login-form.md` enumerating six caveats. Suggested order: (a) **No authorization framework** — cross-reference DOC-GAP-039; LOGIN_FORM users all get ADMIN authorities and there is no Policy/Permission gate. (b) **`auth.login-form-redirect` is unvalidated** — operator-supplied URL is consumed verbatim; treat as a sensitive value; avoid sourcing from user input. (c) **Session cookie security** — `HttpOnly`/`Secure`/`SameSite` not configured at the security layer; `spring.session.timeout: -1` means sessions never expire; no revocation mechanism. (d) **S2S composability** — cross-reference DOC-GAP-049. (e) **Plain-text credentials via `/actuator/env`** — `auth.login-form-credentials` value is reachable through the actuator surface; mitigate by overriding actuator exposure or moving Actuator to a management port; cross-reference DOC-GAP-050 / DOC-GAP-006 family. (f) **CSRF disabled** — verify your deployment doesn't expose session-cookie POSTs to cross-origin pages.
  - **Cross-references**:
    - DOC-GAP-039 (LOGIN_FORM drops authorization framework — sub-bullet of this cluster)
    - DOC-GAP-049 (S2S composability — sub-bullet of this cluster)
    - DOC-GAP-050 (actuator/env credential exposure — sub-bullet of this cluster)
    - Drives `/log-issue odd-platform` upstream for: (1) `auth.login-form-redirect` scheme/host validation, (2) session cookie security flags, (3) session timeout default
  - **Severity rationale**: HIGH — LOGIN_FORM is documented as "dev-only" in the live docs but operators using it in dev environments are the same operators who will eventually promote to staging/production; the docs miss the chance to surface the six caveats that matter even in dev (operators deploying behind shared corporate networks, etc.).

- **DOC-GAP-053**: **META-FINDING** — "docs frame default behaviour but omit blast radius" pattern (3-sidecar triangulated; cross-cutting class)
  - **Category**: drift
  - **Surfaced by**:
    - DOC-GAP-036 + DOC-GAP-045 (DISABLED-default of `auth.type` — docs frame, blast radius omitted)
    - DOC-GAP-038 (`auth.ingestion.filter.enabled=false` default — partial doc coverage on parent page, blast radius and sibling-endpoint coverage omitted)
    - DOC-GAP-041 (activity-feed partition retention claim — page frames cadence, claims retention, code has no DROP)
    - Pattern referenced in concepts.yaml's batch-C cross-cutting findings comment block
  - **Evidence**: aggregated from above findings — common shape is **(a) page exists at the canonical home, (b) page documents the setting and its happy path, (c) page does NOT enumerate the operational consequence cluster** that materialises when an operator inherits the default. The cluster size varies (DISABLED: 6 consequences; ingestion-filter: 2 sibling-endpoint coverage gaps; activity-feed: 1 DROP-path absence) but the failure mode is the same.
  - **Proposed doc action**: This finding is a **meta-recommendation, not a single-page doc action**. The maintainer-facing action is: when authoring any "default behaviour" claim on a doc page, run a Pre-authoring stance check item: "Does the default's blast radius live next to the claim, or several sections away?" Concretely, the maintainer could systematise this by adding to `pillars/documentation/gates.md` an explicit Gate 3 extension: "Caveats captured as admonition blocks must appear ADJACENT to the default behaviour claim, not three sections away. A page that says 'the default is X' without the consequence cluster of X is failing Gate 3 even if the consequence cluster appears on a sibling page." Add to `playbooks/pre-authoring-stance.md` an explicit blast-radius prompt.
  - **Cross-references**:
    - LSN-001 (attachment-ephemeral default) + LSN-002 (MinIO region unset) — both are this pattern's canonical case-law; the case-law cluster grows as the substrate surfaces more instances
    - All three batches (2026-05-08 + 2026-05-10A + 2026-05-12C) have surfaced instances of this pattern; recommend the maintainer treat it as a documentation-pillar standing concern, not a per-page fix
  - **Severity rationale**: HIGH (meta) — the pattern is responsible for at least 9 of the current HIGH-severity findings. Surfacing it as a standing pillar concern accelerates future scans by giving the reviewer a named pattern to spot.

- **DOC-GAP-054**: Notifications subsystem: no rate-limit / queue / backpressure — bursty alert events translate 1:1 into outbound HTTP/SMTP requests; Slack will rate-limit (429), SMTP/webhook receivers will be overwhelmed
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:bugs_limitations_corner_cases.[10]` (severity HIGH) + `:performance.known_performance_gaps.[0]` (severity HIGH) + `:security.known_security_gaps.[no rate limit cross-ref]` **(new 2026-05-12C)**
    - `concepts.yaml:entities[Notifications]` (new in batch C)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` 2026-05-12 status 200 — page documents outbound channels (Slack/SMTP/Webhook) and inbound AlertManager webhook with auth caveats; does NOT mention rate-limiting, backpressure, queue mechanics, or the consequence of bursty alerts. The "SMTP server will hang notification delivery" caveat IS present (per Configure ODD Platform doc) — partial coverage of the SMTP-hang issue but not the broader rate-limit gap.
    - NotificationsProperties.md verifies: `AlertNotificationMessageProcessor.java:25-36` is a synchronous for-each loop over `List<NotificationSender>`; no rate-limit, no token bucket, no batching, no per-channel queue. A burst of 10k alerts (e.g. misconfigured data-quality run) fires 10k Slack messages + 10k webhook POSTs + 10k emails with no rate cap. Slack returns 429 → `AbstractNotificationSender.java:24-27` logs it as failure and drops the alert from that channel with no retry-with-backoff.
  - **Proposed doc action**: Add to `features/active-platform-features/notifications.md` a "Operational limits" Known-limitations admonition: "**No rate-limiting**: notification dispatch is synchronous and unbounded — every alert event triggers one HTTP/SMTP request per configured channel immediately on receipt. Bursty alert generation (e.g. a misconfigured data-quality run that produces hundreds of alerts in seconds) will: (a) trigger Slack's per-webhook 429 rate-limit response, causing the platform to log failures and drop those alerts from the Slack channel with no automatic retry; (b) flood SMTP relays or webhook receivers, potentially triggering downstream rate limits or queue backups. For deployments expecting high alert volumes, configure your alerting feature with deduplication / suppression upstream, or front the platform's outbound notification path with a queue / rate-limiter at the network layer." Mirror on `configuration-and-deployment/odd-platform.md` Enable-Alert-Notifications section.
  - **Cross-references**:
    - DOC-GAP-003 (AlertManager inbound rate-limit — symmetric: no rate-limit on the ingress side either)
    - LSN-002 family (operationally surprising default)
    - Drives `/log-issue odd-platform` upstream for: queue / rate-limit / retry-with-backoff design
  - **Severity rationale**: HIGH — operationally significant for any deployment expecting alert volumes higher than a few per minute. The 429-drop behaviour is silently lossy; operators have no visibility into how many alerts were dropped to which channel.

- **DOC-GAP-055**: Notifications subsystem: no audit trail of delivery (no DB record, no metric, only DEBUG-level log) — operators cannot answer "did the alert get delivered?" or "which alerts went to which channels?"
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:bugs_limitations_corner_cases.[3]` (severity HIGH — no retry/DLQ/audit) + `:bugs_limitations_corner_cases.[11]` (severity MEDIUM — no audit trail) + `:security.known_security_gaps.[3]` (severity MEDIUM) **(new 2026-05-12C)**
    - `concepts.yaml:entities[Notifications]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` 2026-05-12 status 200 — page documents the channels + lifecycle but does NOT mention audit-trail / metric / DB-visible signal for delivery success/failure.
    - NotificationsProperties.md verifies: `AlertNotificationMessageProcessor.java:25-36` only emits `log.debug("Sending notification message via {}: {}", ...)` and catches `NotificationSenderException` with `log.error(...)`. No `notification_delivery` table, no Micrometer counter, no Prometheus gauge. There is no DB-visible signal that notifications stopped working — an operator monitoring application health from `/actuator/health` or from dashboard metrics has no way to detect that Slack/webhook/email delivery is failing.
  - **Proposed doc action**: Add a Known-limitations admonition to `features/active-platform-features/notifications.md`: "**No delivery audit trail**: the platform logs notification dispatch at DEBUG level and per-sender failures at ERROR level, but does NOT record delivery success/failure in the database, does NOT emit Micrometer metrics, and does NOT surface degraded delivery state on `/actuator/health`. Operators cannot programmatically answer: 'were the alerts I expected delivered?', 'which channel last succeeded?', or 'how many alerts were dropped due to rate-limiting?'. For audit-required deployments, configure application-log aggregation that captures the DEBUG-level dispatch logs and the ERROR-level failure logs."
  - **Cross-references**:
    - DOC-GAP-054 (rate-limit absence — same gap shape, different consequence)
    - Drives `/log-issue odd-platform` upstream for: `notification_delivery` audit table + Micrometer counters + health-check signal
  - **Severity rationale**: HIGH — compliance/observability gap; operators have no first-class way to answer the basic question "is alerting working?". Combined with DOC-GAP-054 (rate-limit absence), the platform silently drops alerts under load AND provides no signal that it has done so.

- **DOC-GAP-059**: Housekeeping TTL Java-default vs YAML-default mismatch — operator overriding application.yml without the housekeeping block silently rebinds to 0 (Java `int` default) → next 15-min housekeeping cycle hard-deletes ALL resolved alerts, ALL search-facet history, ALL soft-deleted entities (LSN-001 shape, undocumented)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings.[2]` + `:bugs_limitations_corner_cases.[2]` (severity HIGH — "LSN-001-shape silent-data-loss-on-default — exact same failure class as attachment.storage.mode default") **(NEW batch D)**
    - `concepts.yaml:entities[Housekeeping TTL]` (new in batch D)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — verbatim: "`housekeeping.ttl.resolved_alerts_days`: ... Integer, days. **Defaults to `30`**." The page documents the default value but does NOT clarify where the default LIVES (Java initializer vs bundled YAML floor).
    - HousekeepingTTLProperties.md verifies: `HousekeepingTTLProperties.java:9-11` declares `private int resolvedAlertsDays;` / `searchFacetsDays;` / `dataEntityDeleteDays;` — three `int` primitives with NO Java-side `= 30` initializer. The `30` floor lives ONLY in `application.yml:168-170`. An operator who replaces `application.yml` via `--spring.config.location=` or via Spring Cloud Config (a common production-config pattern) and forgets to re-supply the `housekeeping.ttl.*` block binds `0` for all three TTLs. The next housekeeping cycle (~15 minutes after boot) executes the three DELETE jobs with cutoffs of `now() - 0 days = now()` — DELETEs ALL rows in `RESOLVED`/`RESOLVED_AUTOMATICALLY` state, ALL search-facet history rows with `LAST_ACCESSED_AT <= now()`, and ALL DataEntity rows in DELETED status (cascading through ~25 child tables).
  - **Proposed doc action**: Add a "Default-value persistence" admonition to the housekeeping section on `configuration-and-deployment/odd-platform.md` immediately after the `housekeeping.ttl.*` defaults table: "**Where the defaults live**: the `30`-day defaults for `housekeeping.ttl.resolved_alerts_days`, `housekeeping.ttl.search_facets_days`, and `housekeeping.ttl.data_entity_delete_days` are set in the platform's bundled `application.yml` — they are NOT hard-coded Java-side defaults. If your deployment overrides `application.yml` (e.g. via `--spring.config.location=`, Spring Cloud Config, Kubernetes ConfigMap, or a custom Docker image), you MUST re-supply the `housekeeping.ttl.*` block. Omitting these keys silently rebinds to `0` (Java `int` primitive default), and the next housekeeping cycle (~15 minutes after boot) will hard-delete ALL resolved alerts, ALL search-facet history, and ALL soft-deleted data entities. This is an LSN-001-class default failure mode — verify your deployed configuration includes the TTL block explicitly. **Recommended mitigation upstream**: file an issue requesting that the Java field declarations carry explicit `= 30` initializers — `private int resolvedAlertsDays = 30;`."
  - **Cross-references**:
    - LSN-001 (attachment-ephemeral-default — exact same failure class)
    - DOC-GAP-053 (META: "docs frame default behaviour but omit blast radius" — this finding is the 4th sidecar triangulation)
    - Drives `/log-issue odd-platform` upstream to promote the defaults into the Java declaration (`private int resolvedAlertsDays = 30;` etc.)
  - **Severity rationale**: HIGH — LSN-001 canonical shape: bundled application.yml hides a silent-but-catastrophic default. Operators overriding YAML (a documented production pattern in Spring Boot deployments) inherit immediate production data loss with no warning.

- **DOC-GAP-061**: No `messageDays` retention field for the DataCollaboration `MESSAGE` table — `housekeeping.ttl.*` surface has 3 fields, none target messages; symmetric to DOC-GAP-041 activity-feed gap (silent unbounded growth)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[1]` (severity MEDIUM per sidecar — DataCollab is feature-flagged off by default) **(NEW batch D)**
    - `concepts.yaml:entities[Housekeeping TTL]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — neither the housekeeping section nor the Enable Data Collaboration section documents any time-based retention for the MESSAGE table.
    - HousekeepingTTLProperties.md verifies: `HousekeepingTTLProperties.java:8-12` has no `messageDays` field. `MessageEmptyPartitionsHousekeepingJob.java:18-21` only drops EMPTY past partitions (excludes `MESSAGE_PROVIDER_EVENT` sibling table). No row-delete-by-age path exists for messages. Operators running DataCollaboration with high message throughput accumulate messages indefinitely.
  - **Proposed doc action**: Add to the Enable Data Collaboration section on `configuration-and-deployment/odd-platform.md` a Known-limitations admonition: "**No message retention**: ODD does NOT retention-delete messages from the `MESSAGE` table. The `MessageEmptyPartitionsHousekeepingJob` runs on the same 15-minute schedule as the other housekeeping tasks, but it only drops EMPTY past partitions — partitions containing any rows are retained indefinitely. Operators expecting high message throughput must manually drop old partitions or implement application-level archival. Mirror caveat applies to the activity feed (see DOC-GAP-041)."
  - **Cross-references**: DOC-GAP-041 (parallel activity-feed gap — same shape, different table); LSN-001 class; Drives `/log-issue odd-platform` upstream for message-retention design.
  - **Severity rationale**: HIGH — silent unbounded growth on a feature operators have to enable explicitly; the gap is invisible to operators reading either the DataCollab feature page or the housekeeping section. Severity HIGH per the parallel to DOC-GAP-041 (Activity Feed); sidecar tags MEDIUM citing limited blast radius (DataCollab off by default), but the doc-side action shape is identical to DOC-GAP-041 — promote to HIGH for the catalog.

- **DOC-GAP-063**: OAuth2 docs internal inconsistency — descriptive prose uses `username-attribute` (no hyphen) but every YAML example uses `user-name-attribute` (hyphenated); Spring relaxed binding maps `user-name-attribute` (not `username-attribute`) to the `userNameAttribute` POJO field; operators copy-pasting the prose key get silent binding failure
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:docs_link_semantic.doc_drift_findings.[3]` (severity HIGH per concepts.yaml triangulation) **(NEW batch D)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim verdict from this session's fetch: descriptive prose uses `auth.oauth2.client.{client-id}.username-attribute` (no hyphen between user and name); every YAML example uses `user-name-attribute` (hyphenated). The page has a SAME-PAGE inconsistency. Examples quoted: GitHub `user-name-attribute: login`, Google `user-name-attribute: name`, Azure `user-name-attribute: email`, Okta `user-name-attribute: email`, Keycloak `user-name-attribute: preferred_username`.
    - ODDOAuth2Properties.md verifies: `ODDOAuth2Properties.java:44` declares `private String userNameAttribute;`. Spring's `@ConfigurationProperties` relaxed-binding rules treat `user-name-attribute` (kebab-case with a hyphen between `user` and `name`) as the matching key for `userNameAttribute`, NOT `username-attribute` (which would map to a hypothetical `usernameAttribute` single-word field). An operator who follows the descriptive prose verbatim and writes `username-attribute: email` in YAML gets a SILENTLY-UNBOUND field — Spring's binder ignores unknown keys by default. The result: provider falls back to whatever default username attribute Spring's OAuth2 client chooses (typically `sub` for OIDC, `id` for GitHub), producing unexpected display names with no boot-time error.
  - **Proposed doc action**: Two-part fix. (1) Doc-side stop-gap — update `oauth2-oidc.md` to use `user-name-attribute` (hyphenated, matches every YAML example) in ALL prose references. Audit the entire page for `username-attribute` mentions and standardise to `user-name-attribute`. (2) Code-side upstream — file `/log-issue odd-platform` to rename the POJO field from `userNameAttribute` to `usernameAttribute` (single word) OR add a `@Name("username-attribute")` alias annotation to support both spellings transparently. The single-word spelling matches Spring Boot's own OAuth2 `spring.security.oauth2.client.registration.{id}.user-name-attribute` convention; the operator's mental model anchors on the upstream Spring convention. Pick one canonical spelling and enforce it. The drift itself is the finding.
  - **Cross-references**: DOC-GAP-046 (5-vs-7 provider drift — same OAuth2 page, sibling fix); DOC-GAP-069 (ODD_IAM absent — same OAuth2 page, third finding).
  - **Severity rationale**: HIGH — operators copy-pasting the descriptive prose key get silent failure with no boot warning; the displayed username falls back to an opaque OIDC `sub` value (a UUID or numeric ID) which surfaces in the platform UI as the user's display name. The bug is invisible until first login attempt; even then it presents as "the display name is wrong" rather than as a config binding error. Same-page inconsistency between prose and examples violates the "Sources" discipline.

- **DOC-GAP-067**: **META-FINDING** — Lombok `@Data` toString sensitive-field leak class (4-sidecar triangulated)
  - **Category**: drift (meta)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDLDAPProperties.md:bugs_limitations_corner_cases.[0]` + `:security.known_security_gaps.[0]` (HIGH) — `password` field via `@Data` (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:bugs_limitations_corner_cases.[3]` + `:security.known_security_gaps.[0]` (MEDIUM) — `clientSecret` field via `@Data` on nested `OAuth2Provider` (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[3]` + `:security.known_security_gaps.[0]` (MEDIUM) — SMTP `password` field via `@Data` (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md` (batch C — pattern initial detection)
    - `concepts.yaml:invariants[Lombok-toString sensitive-field leak]` (4-sidecar triangulated invariant, version 5)
  - **Evidence**:
    - Pattern: every `@ConfigurationProperties` POJO that binds a credential / secret / token uses Lombok `@Data` without `@ToString.Exclude` annotations. Specific instances verified:
      - `ODDLDAPProperties.java:10,14` — `@Data` on class + `private String password` field, no `@ToString.Exclude`
      - `ODDOAuth2Properties.java:30,34` — `@Data` on nested `OAuth2Provider` + `private String clientSecret` field, no `@ToString.Exclude`
      - `EmailSenderProperties.java:6-10` — `@Data` on class + `private String password` field, no `@ToString.Exclude`
      - `NotificationsProperties.java` (per batch-C sidecar) — same pattern
    - Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` default DOES mask credential values in `/actuator/env` responses (so actuator-env is partially mitigated by the framework), BUT this masking is bypassable two ways: (a) operator overrides `show-values` to `WHEN_AUTHORIZED` or `ALWAYS`; (b) `Spring Boot's '/actuator/configprops` may sanitise differently per field. The DURABLE leak vector is the Lombok-generated `toString()` — `log.info("properties = {}", properties)` or any debug-rendering of the bean emits the credential in plaintext, bypassing actuator masking entirely. WebFetch of each LDAP / OAuth2 / Login-form / Notifications docs page 2026-05-12 confirms NONE of the four pages warns operators about logging the Properties bean.
  - **Proposed doc action**: Three-part action.
    1. **Doc-side**: add a "Logging discipline" admonition to EACH affected page (`enable-security/authentication/ldap.md`, `oauth2-oidc.md`, `login-form.md`, `features/active-platform-features/notifications.md`): "**Do not log Properties beans verbatim**. The ODD Platform's `@ConfigurationProperties` classes for credentials (LDAP password, OAuth2 client secret, SMTP password, etc.) use Lombok `@Data`, which auto-generates a `toString()` method that includes every field — including the credential. Code that calls `log.info(\"properties = {}\", properties)` or that serialises the bean via Jackson without `@JsonIgnore` annotations emits the credential in cleartext to your log aggregator. This is independent of Spring's actuator masking (which protects the `/actuator/env` endpoint by default). For audit-required deployments, configure your log aggregator to redact patterns matching `password=`, `clientSecret=`, `client-secret=`."
    2. **Code-side upstream**: file `/log-issue odd-platform` to add `@ToString.Exclude` to every credential field across the four POJOs. Recommended fix per POJO:
       - `ODDLDAPProperties.password` → `@ToString.Exclude`
       - `ODDOAuth2Properties.OAuth2Provider.clientSecret` → `@ToString.Exclude`
       - `EmailSenderProperties.password` → `@ToString.Exclude`
       - `NotificationsProperties` (per batch-C sidecar — verify field names)
    3. **Pillar-side meta-recommendation**: add to `pillars/documentation/gates.md` an explicit reviewer checklist item: "For any feature that documents `@ConfigurationProperties` credential keys (passwords, tokens, secrets), verify the docs include a Logging-discipline caveat referencing the Lombok-toString leak class."
  - **Cross-references**:
    - DOC-GAP-006 (attachment S3 credentials — same shape, likely same Lombok `@Data` pattern in the attachment Properties class — flag for sidecar coverage in a future batch)
    - DOC-GAP-050 (LDAP password — primary refinement target; this META finding generalises it)
    - LSN-001 / LSN-002 — defaults-not-documented class
    - Drives `/log-issue odd-platform` upstream for `@ToString.Exclude` audit across all `@ConfigurationProperties` POJOs holding credentials
  - **Severity rationale**: HIGH (meta) — 4-sidecar triangulation. The pattern is cross-cutting (4+ doc pages affected); a single class-level mitigation (audit `@ToString.Exclude` coverage on all Properties POJOs) closes the gap structurally. Spring Boot's framework-default masking creates a false sense of security — operators who verify actuator-env is masked may not check log output, and the Lombok-toString leak persists invisibly until a debug-logging line is added in a future commit. Same LSN-001 shape: a default that's safe today but unsafe under any future code addition.

- **DOC-GAP-069**: ODD_IAM provider is in the `Provider` enum but COMPLETELY ABSENT from the OAuth2/OIDC docs page — operators deploying ODD_IAM have no doc surface (drift in the other direction — POJO supports a provider docs don't name)
  - **Category**: missing-page
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:docs_link_semantic.doc_drift_findings.[2]` last paragraph + `:docs_link_semantic.doc_drift_findings.[4]` **(NEW batch D)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim re-verified: lists 7 providers (Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC). **ODD_IAM is NOT mentioned anywhere on this page.**
    - ODDOAuth2Properties.md verifies: `Provider.java:3-5` enumerates 5 values including `ODD_IAM`. The codebase ships `<odd-platform-repo>/odd-platform-api/src/main/java/.../auth/logout/ODDIAMLogoutSuccessHandler.java` AND `auth/handler/impl/ODDIAMUserHandler.java` — both provider-specific handlers exist and are reachable when an operator configures `provider: odd_iam`. The provider is intended for ODD-hosted deployments per concepts.yaml notes; external operators reading the public docs cannot discover this option.
  - **Proposed doc action**: Two-part fix. (1) Add a "ODD_IAM (internal)" section to `oauth2-oidc.md` documenting the provider for completeness — explicitly mark it as "intended for ODD-hosted deployments; external operators should use one of the public providers above". Include the `adminUserInfoFlag` field documentation (which is the ODD_IAM admin-detection mechanism per `ODDIAMUserHandler.java:36-38`). (2) Alternatively, mark `Provider.ODD_IAM` as internal/deprecated in code if it's not intended for external use — but the presence of a public-facing handler suggests the docs gap is the correct fix.
  - **Cross-references**: DOC-GAP-046 (5-vs-7 provider drift — same root issue from the opposite angle); DOC-GAP-070 (adminUserInfoFlag field undocumented — sub-finding).
  - **Severity rationale**: HIGH — operators with access to the codebase may discover ODD_IAM and configure it without doc support; first-principles deployment of an undocumented provider is a high-risk operation (no field documentation, no admin-detection model, no logout-URI expectations). For an OSS project's auth surface, "the code supports X but the docs don't mention X" is a structural completeness defect.

- **DOC-GAP-070**: `adminUserInfoFlag` field is the ODD_IAM admin-detection mechanism but is undocumented on the OAuth2/OIDC docs page (sub-finding of DOC-GAP-069)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_auth__config-properties-class__ODDOAuth2Properties.md:docs_link_semantic.doc_drift_findings.[4]` **(NEW batch D)**
    - `concepts.yaml:entities[Auth Mode]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-12 status 200 — verbatim: page's "Admin Access Control Semantics" section names only `admin-principals`, `admin-attribute`, `admin-groups`. **`admin-user-info-flag` / `adminUserInfoFlag` is NOT mentioned anywhere.**
    - ODDOAuth2Properties.md verifies: `ODDOAuth2Properties.java:47` declares `private Boolean adminUserInfoFlag;`. `ODDIAMUserHandler.java:36-38` reads `provider.getAdminUserInfoFlag()` to drive ODD_IAM-specific admin role assignment. The field is provider-specific (ODD_IAM only) and operators of that provider have no doc surface for it.
  - **Proposed doc action**: When authoring DOC-GAP-069's ODD_IAM section on `oauth2-oidc.md`, include `admin-user-info-flag` in the Common-vs-Provider-Specific field tables. Describe its semantics: "Boolean (default false). When true, the platform consults the OIDC UserInfo endpoint's response shape to determine ADMIN role assignment under the ODD_IAM provider. Not consulted by other providers."
  - **Cross-references**: DOC-GAP-069 (parent finding — ODD_IAM provider absent from docs).
  - **Severity rationale**: HIGH — bundled with DOC-GAP-069 as a structural docs-completeness gap. Sub-finding could be MEDIUM if treated in isolation, but together with the parent it forms a coherent gap requiring one authoring action.

### MEDIUM severity

- **DOC-GAP-011**: Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:docs_link_semantic.inferred_docs.[1]` (status: 404 at enrichment time)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__ts__routes__route__alerts.md:docs_link_semantic.doc_drift_findings.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/alerting` 2026-05-08 status 404 — H1 "Page Not Found"; suggests canonical.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-08 status 200.
  - **Proposed doc action**: Cross-link audit; update to `/features/active-platform-features/alerting`. See DOC-GAP-058 (class-level meta).
  - **Cross-references**: DOC-GAP-012, DOC-GAP-013, DOC-GAP-014, DOC-GAP-015, DOC-GAP-035, DOC-GAP-056, DOC-GAP-058 (same URL-prefix-drift class).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-012**: Legacy URL `/active-platform-features/genai` returns 404 — canonical at `/features/active-platform-features/genai`
  - **Category**: broken-url
  - **Surfaced by**: `GenAIController.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Evidence**: WebFetch `/active-platform-features/genai` 2026-05-08 status 404; canonical 200.
  - **Proposed doc action**: Same as DOC-GAP-011. See DOC-GAP-058.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035, DOC-GAP-056, DOC-GAP-058.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-013**: Legacy URL `/data-discovery/attachments` returns 404 — canonical at `/features/data-discovery/attachments`
  - **Category**: broken-url
  - **Surfaced by**: `DataEntityAttachmentController.md:docs_link_semantic.inferred_docs.[1]`
  - **Evidence**: WebFetch `/data-discovery/attachments` 2026-05-08 status 404; canonical 200.
  - **Proposed doc action**: Same as DOC-GAP-011. See DOC-GAP-058.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035, DOC-GAP-056, DOC-GAP-058.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-014**: Legacy URL `/data-discovery/directory` returns 404 — canonical at `/features/data-discovery/directory`
  - **Category**: broken-url
  - **Surfaced by**: `DirectoryController.md:docs_link_semantic.inferred_docs.[1]` + `:doc_drift_findings.[1]`
  - **Evidence**: WebFetch `/data-discovery/directory` 2026-05-08 status 404; canonical 200.
  - **Proposed doc action**: Same as DOC-GAP-011. See DOC-GAP-058.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035, DOC-GAP-056, DOC-GAP-058, F-039.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-015**: Legacy URL `/main-concepts` returns 404 — canonical at `/introduction/main-concepts.md`
  - **Category**: broken-url
  - **Surfaced by**: `DataEntityController.md:docs_link_semantic.doc_drift_findings.[0]` + openapi-tag-dataEntity sidecar.
  - **Evidence**: WebFetch `/main-concepts` 2026-05-08 status 404.
  - **Proposed doc action**: Same as DOC-GAP-011. See DOC-GAP-058.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035, DOC-GAP-056, DOC-GAP-058.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-016**: Directory page wording: level 3 mixes "classes" and "types" — operator confusion
  - **Category**: drift
  - **Surfaced by**: `DirectoryController.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Evidence**: WebFetch `/features/data-discovery/directory` 2026-05-08 status 200 — confirmed "classes" vs "types" mixing in level-3 prose.
  - **Proposed doc action**: In `features/data-discovery/directory.md`, replace level-3 prose's "Data Entity classes" with "Data Entity types". Cross-link `main-concepts.md` for disambiguation.
  - **Cross-references**: None.
  - **Severity rationale**: MEDIUM — vocabulary slip.

- **DOC-GAP-017**: GenAI feature page: OpenAPI spec declares only 200 OK — no documented 400/500 error contract for `/api/genai/ask`
  - **Category**: drift
  - **Surfaced by**: `GenAIController.md:docs_link_semantic.doc_drift_findings.[2]`
  - **Evidence**: spec declares only 200; runtime returns 400 on disabled, 500 on timeout.
  - **Proposed doc action**: Either update the OpenAPI spec to declare 400/500, or add an "Error contract" section to the GenAI feature page. Drive an upstream spec issue separately.
  - **Cross-references**: DOC-GAP-018 (spec security block absence — same class).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-018**: API spec carries no `security:` block and no `components.securitySchemes` — invariant of contract-vs-runtime mismatch undocumented
  - **Category**: drift
  - **Surfaced by**: `openapi-tag-alert.md:doc_drift_findings.[3]` + `:implicit_adrs.[3]`; `openapi-tag-dataEntity.md:implicit_adrs.[0]`; `concepts.yaml:invariants[Spec carries no security: block]`
  - **Evidence**: exhaustive grep for `security:` block returns zero matches; api-reference does not warn.
  - **Proposed doc action**: Add a "Security note" admonition to `developer-guides/api-reference.md` directing readers to Authorization/Permissions pages for auth model.
  - **Cross-references**: DOC-GAP-009 (when data-entities api-ref page lands).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-019**: Concept "AlertManager Webhook Receiver" is a canonical_candidate but not a registered term in `main-concepts.md`
  - **Category**: missing-page
  - **Surfaced by**: `concepts.yaml:entities[AlertManager Webhook Receiver]` (canonical_candidate: true); `canonicalisation_candidates.[3]`.
  - **Evidence**: SUMMARY.md confirms `main-concepts.md` exists; the receiver lacks a canonical-term entry.
  - **Proposed doc action**: Add "AlertManager Webhook Receiver" (synonym "Prometheus AlertManager Integration") to `documentation/docs/introduction/main-concepts.md`; cross-link to the receiver section on `configuration-and-deployment/odd-platform.md`.
  - **Cross-references**: DOC-GAP-003.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-020**: Concept "Locale Bundle" / "Multilingual UI" — F-047 is filed; cross-referenced here
  - **Category**: missing-page
  - **Surfaced by**: `concepts.yaml:entities[Locale Bundle]`; sidecar refs.
  - **Evidence**: WebFetch `/configuration-and-deployment/odd-platform` 2026-05-08 — verbatim "no mention of language selection, multilingual support..."
  - **Proposed doc action**: Already filed as F-047; no new authoring action.
  - **Cross-references**: F-047; LSN-013.
  - **Severity rationale**: MEDIUM (per F-047).

- **DOC-GAP-021**: Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat
  - **Category**: drift
  - **Surfaced by**: `DataEntityController.md:doc_drift_findings.[1]`; `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses`.
  - **Evidence**: WebFetch `/features/data-lineage` 2026-05-08 — depth caveat absent. api-ref `/lineage` 200 covers contract.
  - **Proposed doc action**: Add "Depth and bounds" admonition to `features/data-lineage.md`.
  - **Cross-references**: DataEntity performance_aggregate.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-022**: Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap
  - **Category**: drift
  - **Surfaced by**: `concepts.yaml:invariants[Pagination unconstrained]`; multiple sidecars (alert, dataEntity, AlertController.getAllAlerts, ActivityController.getActivity).
  - **Evidence**: spec encodes `size` as int32 with no min/max; `size=2147483647` permissible.
  - **Proposed doc action**: Add "Pagination" section to `developer-guides/api-reference.md` noting unbounded `size` + conservative values guidance.
  - **Cross-references**: DOC-GAP-018.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-023**: Cross-entity uploadId hijack (Attachment) — undocumented; method-level evidence confirms the attack shape
  - **Category**: drift
  - **Surfaced by**: `DataEntityAttachmentController.md:known_security_gaps` (MEDIUM); `uploadFileChunk.md:security.known_security_gaps.[0]` + `:bugs_limitations_corner_cases.[2]`; `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[3]`.
  - **Evidence**: `AttachmentService.java:30` signature has no `dataEntityId`; `FileServiceImpl.java:93-102` resolves by `uploadId` only — gate authorises path entity, service forwards by uploadId.
  - **Proposed doc action**: Fold into DOC-GAP-010's wire-protocol authoring; recommend service-side cross-validation upstream.
  - **Cross-references**: DOC-GAP-010.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-030**: Activity Feed feature page omits `type` parameter, visibility model, cursor pagination mechanics
  - **Category**: drift
  - **Surfaced by**: `getActivity.md:doc_drift_findings.[0,1,3]`.
  - **Evidence**: WebFetch `/features/active-platform-features/activity-feed` 2026-05-10 — 7 filter facets + 20+ event types; missing `type` / visibility / pagination / payload-shape descriptions.
  - **Proposed doc action**: Extend `features/active-platform-features/activity-feed.md` with type-of-feed + pagination + payload-shape sub-sections.
  - **Cross-references**: DOC-GAP-025, DOC-GAP-029, DOC-GAP-031.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-033**: Slack Data Collaboration api-reference page omits authentication/authorization/validation/rate-limit
  - **Category**: drift
  - **Surfaced by**: `postMessageInSlack.md:doc_drift_findings.[0,1]`.
  - **Evidence**: WebFetch `/developer-guides/api-reference/data-collaboration` 2026-05-10 — absence verbatim.
  - **Proposed doc action**: Covered by DOC-GAP-032's authoring; surfaced separately as the doc-page-level gap.
  - **Cross-references**: DOC-GAP-032.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-034**: Token Rotation operational mechanics (grace period, audit logging, plaintext-in-response, in-flight 401) absent from enable-security pages
  - **Category**: missing-page
  - **Surfaced by**: `regenerateCollectorToken.md:doc_drift_findings.[0,1,2]`; `concepts.yaml:entities[Collector Token]`.
  - **Evidence**: permissions/authentication pages name the gate without operational mechanics.
  - **Proposed doc action**: Create `enable-security/token-rotation.md` (or extend authentication.md) per the existing DOC-GAP-034 plan.
  - **Cross-references**: None.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-035**: `/active-platform-features/data-collaboration` returns 404 on legacy URL — canonical at `/features/active-platform-features/data-collaboration`
  - **Category**: broken-url
  - **Surfaced by**: `postMessageInSlack.md:inferred_docs.[0]` (status 404, LOW confidence) + `:doc_drift_findings.[2]` (HIGH for doc-drift); `concepts.yaml:entities[Slack collaboration app].cross_file_inconsistencies.[0]`.
  - **Evidence**: WebFetch `/active-platform-features/data-collaboration` 2026-05-10 status 404; canonical 200.
  - **Proposed doc action**: Same as DOC-GAP-011 class. See DOC-GAP-058 (cross-cutting meta).
  - **Cross-references**: DOC-GAP-011..015, DOC-GAP-056, DOC-GAP-058.
  - **Severity rationale**: MEDIUM (broken-URL rubric); HIGH per sidecar's doc-drift framing (operators cannot find the only page describing a feature they need to configure with care).

- **DOC-GAP-040**: `AuthorizationManagerCondition` is unwired dead code — Authorization page describes the framework as if a centralised condition gates it
  - **Category**: drift
  - **Surfaced by**: `AuthorizationManagerCondition@L11.md:bugs_limitations_corner_cases.[0]` (MEDIUM) + `:security.known_security_gaps.[0]` (MEDIUM); `concepts.yaml:entities[Auth Mode]`.
  - **Evidence**: grep returns only the file's own path 2026-05-10; no `@Conditional(AuthorizationManagerCondition.class)` anywhere. Authorization wiring is per-config `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2"|"LDAP")` directly. Triangulated by 2026-05-12C OAuthSecurityConfiguration + LDAPSecurityConfiguration sidecars — both wire `new AuthorizationCustomizer(...)` directly at the per-config level, confirming the Condition class is vestigial.
  - **Proposed doc action**: Primarily code-hygiene (drive `/log-issue odd-platform`); doc-side is covered by DOC-GAP-039.
  - **Cross-references**: DOC-GAP-039.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-042**: Activity-feed partition WIDTH is `2 × partition-period` (60 days at default) but docs say "a new partition every 30 days"
  - **Category**: drift
  - **Surfaced by**: `ActivityTablePartitionManager@L11.md:doc_drift_findings.[1]`; `concepts.yaml:entities[Activity Table Partitioning]`.
  - **Evidence**: WebFetch 2026-05-11 — "2x partition width" not mentioned. Code at `AbstractPartitionManager.java:35` uses `lastPartitionDate.plusDays(partitionDaysPeriod * 2L)`.
  - **Proposed doc action**: Update `odd.activity.partition-period` section on `configuration-and-deployment/odd-platform.md` to surface the 2x overlap.
  - **Cross-references**: DOC-GAP-041, DOC-GAP-043.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-043**: Activity-feed partition CREATE failures are silently swallowed; operator has no metric / alert / health-check signal — undocumented; `partition.advisory-lock-id` undocumented
  - **Category**: drift
  - **Surfaced by**: `ActivityTablePartitionManager@L11.md:doc_drift_findings.[3]` + `:bugs_limitations_corner_cases.[2]` (HIGH) + `:performance.known_performance_gaps.[1]` (MEDIUM); `concepts.yaml:entities[Activity Table Partitioning]`.
  - **Evidence**: WebFetch 2026-05-11 — partition-period section lacks failure-mode discussion; `partition.advisory-lock-id` absent from documented set despite sibling lock ids being listed.
  - **Proposed doc action**: Three-part fix (Failure modes + DB role requirements + `partition.advisory-lock-id` documentation) per the existing DOC-GAP-043 plan.
  - **Cross-references**: DOC-GAP-041, DOC-GAP-042; LSN-001.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-056**: Legacy URL `/active-platform-features/notifications` returns 404 — canonical at `/features/active-platform-features/notifications`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__NotificationsProperties.md:docs_link_semantic.inferred_docs.[2]` (status 404, HIGH confidence) + `:doc_drift_findings.[0]` **(new 2026-05-12C)**
    - `concepts.yaml:entities[Notifications]` (new in batch C)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/notifications` 2026-05-12 status 404 — H1 "Page Not Found".
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` 2026-05-12 status 200 — canonical feature page renders normally, documents outbound channels + AlertManager inbound webhook + SMTP timeout caveat + "AlertManager webhook unauthentication" warning.
    - The substrate's NotificationsProperties sidecar verifies the active-platform-features/notifications path 404 vs the features/active-platform-features/notifications path 200 — SAME shape as DOC-GAP-035 (data-collaboration).
  - **Proposed doc action**: Cross-link audit across `documentation/` repo for any `/active-platform-features/notifications` references; update to `/features/active-platform-features/notifications`. See DOC-GAP-058 (class-level meta) — recommend doing a doc-side sweep of ALL legacy `/active-platform-features/*` and `/data-discovery/*` and `/main-concepts` paths.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-012, DOC-GAP-013, DOC-GAP-014, DOC-GAP-015, DOC-GAP-035, **DOC-GAP-058** (same URL-prefix-drift class — now 2 sidecars triangulated for the cross-cutting pattern).
  - **Severity rationale**: MEDIUM — the broken-URL itself is the broken-URL rubric MEDIUM; per the sidecar's framing the underlying doc-drift is more concerning because the canonical page covers a feature operators need to configure with care (PG replication setup, SMTP/Slack/webhook credentials, AlertManager unauth caveat).

- **DOC-GAP-057**: Notifications subsystem under-documents operational caveats — dead `notifications.webhookUrl` field, no per-channel filtering, no PII redaction, replication-slot orphan risk on rename, webhook unsigned delivery
  - **Category**: drift
  - **Surfaced by**:
    - `NotificationsProperties.md:bugs_limitations_corner_cases.[0,7,9,12,13]` (multiple MEDIUM/HIGH) + `:security.known_security_gaps.[0,2]` **(new 2026-05-12C)**
    - `concepts.yaml:entities[Notifications]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` 2026-05-12 status 200 — page documents channels + lifecycle + SMTP/AlertManager caveats but is silent on the 5 sub-caveats below.
    - NotificationsProperties.md verifies five distinct sub-findings:
      - (1) **Dead `notifications.webhookUrl` field**: `NotificationsProperties.java:9` declares a top-level `webhookUrl` String field; no code in the notification package reads it (grep negative 2026-05-12). The active webhook URL is `notifications.receivers.webhook.url`. An operator setting the top-level key gets silent acceptance, zero effect.
      - (2) **No per-channel filtering**: `AlertNotificationMessageProcessor.java:25-36` iterates `List<NotificationSender>` unconditionally on every alert. No filter by alert type, severity, data-entity owner, or namespace. An operator wanting "only Critical alerts to Slack, all to email" cannot express this in config.
      - (3) **No PII redaction**: `AlertNotificationMessageTranslator.java:73-83` populates the full alert payload — dataEntity name, dataSourceName, namespaceName, owners[], downstream lineage entities, alertChunks — into Slack/webhook/email outbound. Free-text descriptions / business names / customer-id-encoded table names flow verbatim to outbound channels with no redaction option.
      - (4) **Replication-slot orphan risk on rename**: `NotificationSubscriber.java:99-122` lazy-creates the replication slot but never drops it; if an operator renames `notifications.wal.replication-slot-name` between deploys and forgets to drop the old slot, Postgres retains WAL for the orphan indefinitely — risking primary disk exhaustion. The live doc warns about manual cleanup but does NOT warn about rename-orphan specifically.
      - (5) **Webhook unsigned delivery**: `WebhookNotificationSender.java:18-23` is a plain `HttpRequest.POST(...)` with no HMAC, no shared secret, no signature header. Receivers cannot verify that a webhook actually originated from ODD Platform vs an attacker who scraped the webhook URL.
  - **Proposed doc action**: Add to `features/active-platform-features/notifications.md` a "Known limitations and operational caveats" section enumerating all five caveats with the proximate consequence + mitigation for each. Pair with code-side cleanup of dead `webhookUrl` field via `/log-issue odd-platform`.
  - **Cross-references**:
    - DOC-GAP-054 (rate-limit) + DOC-GAP-055 (audit trail) — these three findings together (DOC-GAP-054 / DOC-GAP-055 / DOC-GAP-057) are the operational-caveat cluster on the Notifications page; recommend authoring them as one consolidated "Known limitations" section
    - Drives `/log-issue odd-platform` upstream for: (a) drop dead `webhookUrl` field, (b) per-channel routing config, (c) webhook signing / HMAC option
  - **Severity rationale**: MEDIUM — none of the five sub-caveats is independently HIGH (PII redaction is operator-controllable; webhook signing is industry-standard but not always required; dead field is config-hygiene), but the cluster's collective impact on operational confidence is significant. The PII surface in particular matters for regulated deployments.

- **DOC-GAP-058**: **META-FINDING** — GitBook legacy-vs-canonical routing drift is a cross-cutting class (now 2-sidecar triangulated: DataCollaboration + Notifications); recommend a doc-side audit of ALL legacy paths
  - **Category**: broken-url
  - **Surfaced by**:
    - `postMessageInSlack.md:docs_link_semantic.inferred_docs.[0]` (DataCollaboration legacy 404 — batch 2026-05-10A)
    - `NotificationsProperties.md:docs_link_semantic.inferred_docs.[2]` + `:doc_drift_findings.[0]` (Notifications legacy 404 — batch 2026-05-12C)
    - Pattern referenced in concepts.yaml's batch-C cross-cutting findings comment block
    - All individual instances: DOC-GAP-011..015 + DOC-GAP-035 + DOC-GAP-056
  - **Evidence**:
    - Pattern: every URL of the form `/active-platform-features/{slug}` or `/data-discovery/{slug}` or `/main-concepts` 404s with a GitBook redirect-suggestion stub. The canonical path is `/features/active-platform-features/{slug}` or `/features/data-discovery/{slug}` or `/introduction/main-concepts.md`.
    - 2-sidecar triangulation across batches confirms the pattern is generalisable, not single-page noise. Recommend treating as a class-level concern.
  - **Proposed doc action**: Three-part class-level fix:
    1. **Doc-side audit**: Sweep the `documentation/` repo for any internal links pointing at the legacy paths (`/active-platform-features/*`, `/data-discovery/*`, `/main-concepts`). Update to canonical paths. Verify via `git grep` in the docs repo.
    2. **External-link mitigation**: For each legacy path that's likely to surface in external blog posts / Slack discussions / GitHub README hyperlinks, add a GitBook redirect rule in `.gitbook.yaml` (GitBook supports path redirects). Recommended set: alerting, genai, data-collaboration, notifications, activity-feed (all under `active-platform-features/`); attachments, directory (under `data-discovery/`); plus `/main-concepts`.
    3. **Substrate / scanner / state-file fix**: Any sidecar / scanner / state file pointing at legacy URLs needs an update on next enrichment.
  - **Cross-references**:
    - All individual broken-url findings: DOC-GAP-011..015 + DOC-GAP-035 + DOC-GAP-056
    - Concept "Notifications" + "Slack collaboration app" in concepts.yaml (both have cross_file_inconsistencies entries naming this drift)
  - **Severity rationale**: MEDIUM (meta — the underlying broken-URL rubric is MEDIUM); the class is worth surfacing as a single audit-recommendation rather than 7 individual same-shape findings.

- **DOC-GAP-060**: Housekeeping docs frame the subsystem as "three cleanup tasks" but code has 5 HousekeepingJob beans — `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` are undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings.[1]` **(NEW batch D)**
    - `concepts.yaml:entities[Housekeeping TTL]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — verbatim: "...iterates through three cleanup tasks: resolved alerts, search-facet history, and soft-deleted data entities."
    - HousekeepingTTLProperties.md verifies code reality: `HousekeepingJobManager` iterates `List<HousekeepingJob>` — Spring autowires FIVE implementations: `AlertHousekeepingJob`, `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`, plus `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` (both extend `EmptyPartitionsHousekeepingJob`). The two empty-partitions jobs run on the same 15-minute schedule and drop empty past partitions for the activity / message tables.
  - **Proposed doc action**: Update the housekeeping section's enumeration to "five cleanup tasks" — three row-by-age DELETE jobs (alerts / search-facets / data-entities) plus two empty-partitions DROP jobs (activity / message). Cross-link the empty-partitions jobs to the partition-period config keys (`odd.activity.partition-period`, `datacollaboration.message-partition-period`) and clarify that empty-partition-drop ≠ row-by-age retention (the partitions must be already empty — see DOC-GAP-041, DOC-GAP-061).
  - **Cross-references**: DOC-GAP-041 (activity retention claim drift); DOC-GAP-061 (message retention gap); LSN-001 class (partial-coverage docs).
  - **Severity rationale**: MEDIUM — operators reading the housekeeping section cannot learn that the same scheduler also drops empty activity/message partitions; the gap is incomplete-coverage rather than incorrect-content.

- **DOC-GAP-062**: AlertHousekeepingJob jOOQ-precedence bug acknowledged in docs but unlinked to a tracking issue / no workaround documented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings.[3]` + `:bugs_limitations_corner_cases.[3]` (severity HIGH per sidecar — silent data loss for manual alert resolutions) **(NEW batch D)**
    - `concepts.yaml:entities[Housekeeping TTL]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — verbatim: "**Note:** the retention window is intended to apply to both `RESOLVED` (manual) and `RESOLVED_AUTOMATICALLY` (system) states, but a **known platform bug currently exempts manual resolutions from the retention check** — manual `RESOLVED` alerts are hard-deleted on the next housekeeping run regardless of this value."
    - HousekeepingTTLProperties.md verifies: `AlertHousekeepingJob.java:28-34` — predicate is `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's operator precedence: `.and(...)` binds to the most recent `.or(...)`, producing `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND STATUS_UPDATED_AT <= cutoff)`. Manual RESOLVED rows lack the TTL guard and are hard-deleted on the very next 15-minute cycle. The bug acknowledgement is useful but the page provides NO upstream-issue link, NO workaround, NO ETA for fix.
  - **Proposed doc action**: Update the bug-acknowledgement paragraph on the housekeeping section to link to an upstream issue: "...a known platform bug (see [odd-platform issue #NNNN](https://github.com/opendatadiscovery/odd-platform/issues/NNNN)) currently exempts manual resolutions from the retention check..." File `/log-issue odd-platform` first to create the tracking issue with: (a) the bug repro, (b) the suggested fix (`.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`), (c) the operator workaround (disable housekeeping until fixed: `housekeeping.enabled: false` — but this stops ALL three jobs, not just alerts).
  - **Cross-references**: LSN-001 class; Drives `/log-issue odd-platform` for the jOOQ-fix.
  - **Severity rationale**: MEDIUM — the docs are honest about the bug but leave operators with no tracking link or workaround. For a documented bug, the operator-impact is mitigated by awareness; the docs gap is in tracking/recovery, not in concealment.

- **DOC-GAP-064**: DataCollaboration lock-id collision risk undocumented — operators tuning the four advisory-lock IDs (`partition.advisory-lock-id=90`, `notifications.wal.advisory-lock-id=100`, `datacollaboration.receive-event-advisory-lock-id=110`, `datacollaboration.sender-message-advisory-lock-id=120`) get no guardrails; operator who copies default 100 to data-collab silently breaks both subsystems
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:docs_link_semantic.doc_drift_findings.[1]` + `:bugs_limitations_corner_cases.[2]` + `:security.known_security_gaps.[1]` (severity MEDIUM) **(NEW batch D)**
    - `concepts.yaml:entities[Slack collaboration app]` + `:invariants[advisory-lock-collision]` (NEW batch D)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration` 2026-05-12 status 200 — verbatim verdict: "This page does **not warn about setting lock IDs to colliding values** or mention conflict risks between subsystems."
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — Enable Data Collaboration section enumerates the lock-IDs with their defaults (110, 120) but does NOT mention that operators MUST keep them disjoint from `partition.advisory-lock-id` (90) and `notifications.wal.advisory-lock-id` (100). No collision-avoidance guidance.
    - DataCollaborationProperties.md verifies: `DataCollaborationProperties.java:14-20` validates `sendingMessagesRetryCount >= 0` only; there is ZERO cross-subsystem validation that the four advisory-lock-ids are disjoint. Grep `<odd-platform>` for `advisoryLockId` collision checks returned no hits 2026-05-12. An operator who sets `datacollaboration.sender-message-advisory-lock-id: 100` silently overlaps `notifications.wal.advisory-lock-id` (default 100) — both subsystems contend on the same Postgres advisory lock; whichever boots first wins, the other silently fails to acquire its lock and produces no warning.
  - **Proposed doc action**: Two-part fix. (1) Doc-side: add a "Lock-ID disjointness" admonition to the Enable Data Collaboration section AND to the feature page: "**Advisory lock IDs must be disjoint across subsystems**. ODD Platform uses four Postgres advisory locks for leader-elected background workers — `partition.advisory-lock-id` (default 90, partition CREATE job), `notifications.wal.advisory-lock-id` (default 100, alert-notification WAL subscriber), `datacollaboration.receive-event-advisory-lock-id` (default 110, Slack event receiver), `datacollaboration.sender-message-advisory-lock-id` (default 120, Slack message sender). The shipped defaults are non-overlapping; if you override ANY of these, ensure your custom values remain disjoint across ALL FOUR subsystems. There is NO boot-time validation — colliding lock IDs silently disable one of the colliding subsystems with no log warning." (2) Code-side: file `/log-issue odd-platform` to add cross-subsystem validation at boot — a `@PostConstruct` check that asserts the four advisory-lock-ids are pairwise distinct.
  - **Cross-references**: DOC-GAP-053 (META: docs frame default behaviour but omit blast radius — adjacent shape); Drives `/log-issue odd-platform` for cross-subsystem lock-id-disjointness validation.
  - **Severity rationale**: MEDIUM — operationally significant; collision produces silent feature degradation. Severity bounded by the fact that operators customising lock-ids without a reason are rare; the failure mode is invisible-failure on a tuneable knob, not a default-shipped bug.

- **DOC-GAP-066**: Email channel config doc completeness — `port`=int default 0 cliff, boxed Boolean nullability, modern SMTP-AUTH OAUTH2 absent, no Reply-To / Cc / Bcc / DKIM support, sender no `@Email` validation, recipient list comma-split has no per-address trim
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:docs_link_semantic.doc_drift_findings.[1,2]` + `:bugs_limitations_corner_cases.[5,6,8,9,10,11]` (severities mostly LOW/MEDIUM individually; cluster MEDIUM) **(NEW batch D)**
    - `concepts.yaml:entities[Notifications]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — verbatim verdict from this session's fetch: (a) `port` type/default-0 NOT documented; (b) `smtp.auth` / `smtp.starttls` boxed-Boolean nullability NOT documented; (c) modern OAUTH2/XOAUTH2 SMTP-AUTH NOT documented; (d) Reply-To / Cc / Bcc / DKIM NOT documented; (e) sender `@Email` validation NOT documented; (f) recipient list comma-split per-address trimming NOT documented; `mail.smtp.ssl.trust` workaround IS documented (positive coverage).
    - EmailSenderProperties.md verifies code-side specifics:
      - `EmailSenderProperties.java:12` — `private int port;` (primitive; defaults to 0)
      - `EmailSenderProperties.java:18-20` — `private Boolean auth;` / `private Boolean starttls;` (boxed; null at binding time is legal; `Properties#put(\"mail.smtp.auth\", null)` throws NPE at first SMTP send, leaking past boot validation)
      - `NotificationConfiguration.java:51-72` — no auth-mechanism keys, no `mail.smtp.connectionpoolsize`, no `mail.smtp.ssl.enable` (only STARTTLS)
      - `EmailNotificationSender.java:51,55` — only `setSubject` + `setTo` called; no Reply-To / Cc / Bcc / DKIM
      - `NotificationConfiguration.java:39-41` — `StringUtils.isBlank` check only on sender; no `@Email` validation
      - `NotificationConfiguration.java:118` — recipient list `notificationEmails.trim().split(\",\")` — no per-address trim; leading-space recipient becomes `' b@x.com'` (invalid InternetAddress)
  - **Proposed doc action**: Extend the Enable Alert Notifications section's email-config sub-list with a "Known limitations" admonition cluster covering all six caveats. Each caveat should name (a) the symptom an operator sees, (b) the proximate code site (just the file path, not line numbers, in doc text), (c) the mitigation. Example: "`port` is a Java `int` primitive — omitting the key binds to `0` and JavaMail falls back to the protocol default port. To set port=587 explicitly, ensure the YAML key is present. For SMTP-AUTH OAUTH2 (XOAUTH2) modern auth (Microsoft 365 / Gmail OAUTH2-only relays), this channel does not support it; use the webhook channel instead or implement an OAUTH2-to-PLAIN-SMTP proxy." Mirror on `features/active-platform-features/notifications.md`.
  - **Cross-references**: DOC-GAP-054 (rate-limit absence); DOC-GAP-055 (audit trail absence); DOC-GAP-057 (operational caveat cluster); DOC-GAP-067 (Lombok-toString — email password leak vector).
  - **Severity rationale**: MEDIUM — cluster of six operationally-relevant caveats, each individually LOW but collectively significant for an operator deploying email-channel notifications in production. Recipient-list comma-split (point f) is the highest-impact within the cluster because it produces silent partial delivery (the cluster joins DOC-GAP-054/055/057 as the Notifications-page completeness gap).

- **DOC-GAP-068**: **META-FINDING** — Partial-home pattern: `@ConfigurationProperties` POJOs bind only a subset of their config-prefix's keys; docs that enumerate the prefix don't surface the @Value-scattered remainder
  - **Category**: drift (meta)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[3]` (severity LOW per sidecar) — 3 of 7 keys (NEW batch D)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_notification_config__config-properties-class__EmailSenderProperties.md:bugs_limitations_corner_cases.[8]` (severity LOW per sidecar) — recipient list scattered (NEW batch D)
    - `concepts.yaml:invariants[Partial-home pattern]` (2-sidecar triangulated; version 5)
  - **Evidence**:
    - Pattern: `@ConfigurationProperties` POJOs that ought to be the single source-of-truth for a config-prefix bind only some of the prefix's keys; the rest are read via `@Value` injection scattered across other classes. Specific instances verified:
      - `DataCollaborationProperties` binds 3 of 7 `datacollaboration.*` keys (`sender-message-advisory-lock-id`, `receive-event-advisory-lock-id`, `sending-messages-retry-count`); remainder (`enabled`, `slack-oauth-token`, `message-partition-period`) read via `@Value` across `DataCollaborationConfiguration.java:21` + `FeatureResolverImpl.java:17` + `MessageTablePartitionManager.java:19`.
      - `EmailSenderProperties` binds 7 fields under `notifications.receivers.email.*` but does NOT model `notifications.receivers.email.notification.emails` (recipient list); the recipient list is consumed via `@Value` at `NotificationConfiguration.java:104`.
    - Doc impact: pages that enumerate the prefix as a coherent surface (the configuration guide does this for both data-collab and notifications) don't surface that ONE POJO doesn't cover ALL keys. A maintainer onboarding to extend the feature reads the Properties class to understand the schema and misses the scattered keys. An operator reading the docs sees the prefix as coherent; the operator-impact is LOW (docs are accurate, the prefix DOES work as documented). The maintainer-impact is MEDIUM (config-prefix has no single class to point at).
  - **Proposed doc action**: Two-part fix per affected feature. (1) Doc-side: when authoring the config-prefix enumeration in the configuration guide, prefix the list with "**Where these keys are bound**: most of this prefix is bound via `<canonical-POJO>`. A few keys are consumed via `@Value` directly: `<scattered-keys-list>` are read at boot in `<consumer-class>`. The docs treat the prefix as a single surface; in source code the prefix is split — bear this in mind when extending the feature." (2) Code-side upstream: file `/log-issue odd-platform` per affected feature to consolidate scattered `@Value` reads into the canonical Properties class. Recommended order: (a) DataCollab → add `enabled` + `slackOauthToken` + `messagePartitionPeriod` to `DataCollaborationProperties`; (b) Notifications → add `notification.emails` to `EmailSenderProperties` or to a sibling recipient-list POJO.
  - **Cross-references**: DOC-GAP-053 (META: docs frame defaults without blast radius — adjacent pattern); DOC-GAP-071 (DataCollab-specific instance); Drives `/log-issue odd-platform` upstream for partial-home consolidation.
  - **Severity rationale**: MEDIUM (meta) — 2-sidecar triangulation suggests the pattern is broader (likely affects other `@ConfigurationProperties` POJOs in the codebase). Operator-impact is LOW per instance; maintainer-onboarding-impact is MEDIUM cumulative.

- **DOC-GAP-071**: DataCollab `datacollaboration.*` prefix is a partial-home — 3 of 7 keys bind to `DataCollaborationProperties`, 4 scattered across `@Value` in 4 files (specific instance of DOC-GAP-068 META)
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[3]` (severity LOW per sidecar) **(NEW batch D)**
    - `concepts.yaml:entities[Slack collaboration app]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — Enable Data Collaboration section enumerates all 6 documented `datacollaboration.*` keys as a coherent surface (the docs are accurate for operators).
    - DataCollaborationProperties.md verifies code-side: `DataCollaborationProperties.java:1-21` binds exactly three int fields (`senderMessageAdvisoryLockId`, `receiveEventAdvisoryLockId`, `sendingMessagesRetryCount`). Remainder scattered:
      - `enabled` → `FeatureResolverImpl.java:17` + `DataCollaborationFeatureCondition.java:18-22`
      - `slack-oauth-token` → `DataCollaborationConfiguration.java:21`
      - `message-partition-period` → `MessageTablePartitionManager.java:19`
  - **Proposed doc action**: Per DOC-GAP-068 (META), add a "Where these keys are bound" note to the Enable Data Collaboration section listing the scattered consumers. The doc fix is MAINTAINER-onboarding-oriented; the operator-impact is LOW.
  - **Cross-references**: DOC-GAP-068 (META — parent finding); DOC-GAP-064 (lock-id collision); Drives `/log-issue odd-platform` for partial-home consolidation of `datacollaboration.*`.
  - **Severity rationale**: MEDIUM — instance of DOC-GAP-068 META pattern; isolated docs-completeness gap with maintainer-side impact.

### LOW severity

- **DOC-GAP-024**: OpenAPI tag `alert` has no `description:` field and no `externalDocs.url`
  - **Category**: drift
  - **Surfaced by**: `openapi-tag-alert.md:doc_drift_findings.[0,2]`.
  - **Evidence**: spec's `alert` tag declaration is `name: alert` only (openapi.yaml:30).
  - **Proposed doc action**: Add `description:` + `externalDocs:` to the `alert` tag in `odd-platform-specification/openapi.yaml`; mirror for `dataEntity` and `activity` tags. Upstream spec change.
  - **Cross-references**: DOC-GAP-029.
  - **Severity rationale**: LOW.

- **DOC-GAP-026**: AlertManager DTO drops `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`; cannot honour `status: resolved`
  - **Category**: drift
  - **Surfaced by**: `AlertManagerController.md:performance.known_performance_gaps.[3]`; concepts.yaml.
  - **Evidence**: docs do not surface dropped fields.
  - **Proposed doc action**: Add "Behaviour notes" to Prometheus AlertManager Integration section.
  - **Cross-references**: DOC-GAP-003.
  - **Severity rationale**: LOW.

- **DOC-GAP-027**: Locale-bundle CSP / localStorage caveat absent on (eventual) i18n doc page
  - **Category**: drift
  - **Surfaced by**: `concepts.yaml:entities[Locale Bundle].security_aggregate.weaknesses.[1]`; i18n.ts + SelectLanguage sidecars.
  - **Evidence**: bootstrap unguarded `localStorage.getItem('i18nextLng')` — in privacy mode raises before render.
  - **Proposed doc action**: Include Known-limitations sub-section when F-047 authoring lands.
  - **Cross-references**: F-047, DOC-GAP-020.
  - **Severity rationale**: LOW.

- **DOC-GAP-028**: Activity Feed counts endpoint (`/api/activity/counts`) issues 4 parallel aggregation queries per call
  - **Category**: drift
  - **Surfaced by**: `getActivity.md:performance.known_performance_gaps.[1]` + `:performance.hot_paths.[2]`.
  - **Evidence**: 4-parallel `Mono.zip` queries (totalCount + myObjects + downstream + upstream); no caching.
  - **Proposed doc action**: Fold into DOC-GAP-029 api-reference content; recommend ≥30s polling cadence on high-traffic platforms.
  - **Cross-references**: DOC-GAP-029.
  - **Severity rationale**: LOW.

- **DOC-GAP-031**: `lasEventId` typo on Java controller signature persists into generated client SDKs
  - **Category**: drift
  - **Surfaced by**: `getActivity.md:bugs_limitations_corner_cases.[0]`.
  - **Evidence**: `ActivityController.java:34` declares `final Long lasEventId` (missing `t`).
  - **Proposed doc action**: Code fix (rename `lasEventId` → `lastEventId`). Conditional doc fix on DOC-GAP-029.
  - **Cross-references**: DOC-GAP-029, DOC-GAP-030.
  - **Severity rationale**: LOW.

- **DOC-GAP-044**: Prometheus `tenant_id` label read/write asymmetry on empty-string `odd.tenant-id`
  - **Category**: drift
  - **Surfaced by**: `CounterTimeSeriesExtractor@L20.md:doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[0]`; concepts.yaml.
  - **Evidence**: `AbstractTimeSeriesExtractor.java:60` uses `!= null` (empty string passes); `ExternalMetricReader.java:111` uses `isNotEmpty` (empty string fails).
  - **Proposed doc action**: Extend `prometheus-tenant-label-odd-tenant-id` section on `configuration-and-deployment/odd-platform.md` with empty-string-vs-unset admonition.
  - **Cross-references**: drives `/log-issue odd-platform` for read/write alignment.
  - **Severity rationale**: LOW.

- **DOC-GAP-065**: DataCollaboration `sending-messages-retry-count: 0` is accepted by `@PostConstruct` validator (`< 0` check is strict) but docs imply minimum is 1 — semantic edge case undocumented
  - **Category**: drift
  - **Surfaced by**: `odd-platform__java__org_opendatadiscovery_oddplatform_datacollaboration_config__config-properties-class__DataCollaborationProperties.md:docs_link_semantic.doc_drift_findings.[2]` (severity LOW per sidecar) **(NEW batch D)**
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-12 status 200 — verbatim: "`datacollaboration.sending-messages-retry-count`: ... Cannot be less than zero. Defaults to `3`." The "cannot be less than zero" phrasing implies values >= 0 are accepted; "Defaults to 3" implies typical use is >= 1.
    - DataCollaborationProperties.md verifies code: `DataCollaborationProperties.java:14-20` — validator is `if (sendingMessagesRetryCount < 0)` (strict `<`, not `<=`). Value `0` is accepted; `shouldRetry()` check uses strict `<` again, meaning `retry-count: 0` produces "try once, no retry" behaviour (the message is attempted once and either succeeds or is marked failed, with NO retry).
  - **Proposed doc action**: Add a single-sentence clarification to the Enable Data Collaboration section: "Setting `datacollaboration.sending-messages-retry-count: 0` is accepted and means 'attempt once, no retry on failure' (the message is sent once; if delivery fails, it is marked failed immediately with no retry attempts). Setting `1` means 'attempt once, retry once on failure'."
  - **Cross-references**: DOC-GAP-064 (lock-id collision); DOC-GAP-071 (partial-home).
  - **Severity rationale**: LOW — semantic edge case; the operational impact is minor (operators setting `0` likely intend "no retry" anyway). Docs accuracy improvement.

## Concept-without-page candidates (from concepts.yaml × SUMMARY.md)

Concepts surfaced by the substrate that are not registered as canonical terms in `main-concepts.md`. Some have a doc home (a section on a config page); others have none.

| Concept | canonical_candidate | Axes present | Contributing nodes | Suggested doc home | Notes |
|---|---|---|---|---|---|
| Locale Bundle / Multilingual UI | true | ui_shell | 2 | `configuration-and-deployment/i18n.md` or `features/i18n.md` | F-047 already filed; LSN-013 case-law; six locales invisible |
| Attachment | true | controllers, config_prefixes | 4 | `features/data-discovery/attachments.md` + config section; missing only as canonical term in `main-concepts.md` | LSN-001 + LSN-002 case-law; method-level uploadFileChunk evidence reinforces |
| Attachment Storage Backend | true | config_prefixes, controllers | 2 | `configuration-and-deployment/odd-platform.md` section | DOC-GAP-006 attaches; chunk-staging path universality extends |
| AlertManager Webhook Receiver | true | controllers | 1 | `configuration-and-deployment/odd-platform.md` section; missing as canonical term in main-concepts.md (DOC-GAP-019) | suggested_add_to_docs: true |
| Activity Feed | true | controllers | 1 | `features/active-platform-features/activity-feed.md` exists but missing as canonical term + missing api-reference page (DOC-GAP-029) | vocabulary_status: codebase-anchored, doc-side-partially-covered |
| Collector Token | true | controllers | 1 | New page at `configuration-and-deployment/enable-security/token-rotation.md` (DOC-GAP-034) | main-concepts.md mentions S2S but not rotation contract |
| Auth Mode | true | config_prefixes, controllers | **7** (NEW 2026-05-12C: 4 wiring-site `*SecurityConfiguration` + 3 config-key-consumer from batch B) | `configuration-and-deployment/enable-security/authentication.md` + sub-pages; missing **(a)** DISABLED-default disclosure on parent (DOC-GAP-036), **(b)** DISABLED blast radius (DOC-GAP-045 — NEW), **(c)** LOGIN_FORM-drops-authorization (DOC-GAP-039), **(d)** OAuth2 provider 5-vs-7 drift (DOC-GAP-046 — NEW), **(e)** azure-tenant-id field absent (DOC-GAP-047 — NEW), **(f)** Azure logout-uri unvalidated (DOC-GAP-048 — NEW), **(g)** OAuth2/S2S composition (DOC-GAP-049 — NEW), **(h)** LDAP actuator-env password leak (DOC-GAP-050 — NEW), **(i)** LDAP 7-caveats cluster (DOC-GAP-051 — NEW), **(j)** LOGIN_FORM 6-caveats cluster (DOC-GAP-052 — NEW), **(k)** appInfo introspection (DOC-GAP-037), **(l)** empty/typo footgun | Triangulated by 7 sidecars in batch B + batch C |
| Ingestion Filter | true | config_prefixes | 1 | Parent `enable-security.md` mentions default; DOC-GAP-038 captures four gaps | Distinct from S2S; conflated in docs |
| Activity Table Partitioning | true | config_prefixes | 1 | `configuration-and-deployment/odd-platform.md` section; missing retention-vs-partitioning correction (DOC-GAP-041), 2x WIDTH (DOC-GAP-042), failure-mode + DB-role + `partition.advisory-lock-id` (DOC-GAP-043) | Operational-mechanics concept |
| Metrics Storage Backend | true | config_prefixes | 1 | `configuration-and-deployment/odd-platform.md#metric-storage-backend`; missing tenant-id asymmetry (DOC-GAP-044) | suggested_add_to_docs: false |
| Multi-Tenant Configuration | true | config_prefixes | 1 | `configuration-and-deployment/odd-platform.md` subsection; missing tenant-isolation caveats | suggested_add_to_docs: false |
| Notifications | true (new 2026-05-12C) | config_prefixes | 2 (expanded batch D with EmailSenderProperties) | `features/active-platform-features/notifications.md` exists (200) + `configuration-and-deployment/odd-platform.md` Enable-Alert-Notifications section exists; missing **(a)** rate-limit caveat (DOC-GAP-054 — batch C), **(b)** audit-trail caveat (DOC-GAP-055 — batch C), **(c)** dead `webhookUrl` + per-channel filtering + PII redaction + replication-slot orphan + webhook unsigned cluster (DOC-GAP-057 — batch C); **(d)** legacy URL routing (DOC-GAP-056 — batch C); **(e)** email config completeness cluster — port=0 cliff / boxed Boolean nullability / OAUTH2 absent / no Reply-To-Cc-Bcc-DKIM / no @Email validation / recipient-list trim (DOC-GAP-066 — NEW batch D); **(f)** Lombok-toString email-password leak (DOC-GAP-067 META, NEW batch D); plus cross-link from main-concepts.md | vocabulary_status: codebase-anchored, doc-side-partially-covered |
| Housekeeping TTL | true (NEW 2026-05-12D) | config_prefixes | 1 | `configuration-and-deployment/odd-platform.md#housekeeping` exists (200) — documents 3 of 5 jobs and shipped 30-day defaults BUT missing **(a)** Java-default-vs-YAML-default cliff (DOC-GAP-059 — NEW); **(b)** missing 2 of 5 jobs (DOC-GAP-060 — NEW); **(c)** jOOQ bug ack with no upstream-issue link (DOC-GAP-062 — NEW); **(d)** activity-feed retention 2nd-angle confirmation (strengthens DOC-GAP-041); **(e)** message retention gap (DOC-GAP-061 — NEW) | vocabulary_status: codebase-anchored, doc-side-partially-covered |
| ODD API Consumer (audience) | true | controllers, openapi_tags | 6 | `main-concepts.md` audience vocabulary | suggested_add_to_docs: true; named in 6 sidecars |
| Prometheus AlertManager (audience) | true | controllers | 1 | `main-concepts.md` audience vocabulary; cross-link DOC-GAP-019 | suggested_add_to_docs: false |

## Coverage-gap candidates (high-fan-out concepts × api-reference depth)

| Concept | Operations / surface | Documented count | Gap | Suggested action |
|---|---|---|---|---|
| Data Entity | 40 controller operations | 0 (api-reference index punts to Swagger) | All 40 ops undocumented as a per-tag api-reference subpage | DOC-GAP-009 — create `developer-guides/api-reference/data-entities.md` |
| Attachment | 10 ops (chunked-upload + list + edit + delete + download) | 0 (no api-reference page) | Wire protocol absent everywhere | DOC-GAP-010; method-level evidence (cross-entity hijack + multi-instance staging) makes this critical |
| Alert | 9+1 ops | 9+1 on `/developer-guides/api-reference/alerts` | Auth-mode + visibility-scope caveats absent; doc-vs-code audience drift | DOC-GAP-002 |
| Activity Feed | 2 endpoints (`GET /api/activity` + `GET /api/activity/counts`); 12 query parameters | 0 (api-reference page 404) | All endpoints undocumented | DOC-GAP-029 — create `developer-guides/api-reference/activity.md`; DOC-GAP-030 extends feature page |
| Slack collaboration / Data Collaboration | ~7 endpoints | api-ref page exists (200) but omits authn/authz/validation/rate-limit | Security-content gaps | DOC-GAP-032, DOC-GAP-033; DOC-GAP-035 for legacy URL |
| Collector / Collector Token | 5 endpoints; 1 ingestion auth filter | Permission named; auth-mode named | Operational mechanics (rotation contract) absent | DOC-GAP-034 |
| Directory | 4 ops | 4 (api-reference page exists) | Owner-scoping / authz caveat absent | DOC-GAP-008 |
| GenAI | 1 op | 1 (feature page documents the contract) | Security caveats absent | DOC-GAP-007 |
| Multilingual UI / Locale Bundle | 2 ops | 0 (no doc page) | F-047 (filed) | DOC-NNN per F-047 |
| AlertManager Webhook Receiver | 1 op | 1 (operator-facing config section) | Caveats absent + concept not registered as canonical term | DOC-GAP-003 + DOC-GAP-019 |
| Auth Mode (2026-05-12C aggregated, expanded batch D) | 4 mode sub-pages + 1 S2S sub-page + parent | 5 sub-pages exist (200); each documents happy path | 15 distinct gaps clustered across DOC-GAP-036..039 + DOC-GAP-045..052 + **DOC-GAP-063, DOC-GAP-069, DOC-GAP-070 (NEW batch D)** | Cluster cross-references — each sub-page benefits from one consolidated security/operability caveats H2 |
| Notifications (2026-05-12C aggregated, expanded batch D) | 1 feature page + 1 config-section | Both exist (200); document channels + WAL setup + SMTP caveats verbatim | 8 distinct gaps clustered across DOC-GAP-054..057 + DOC-GAP-056 (legacy URL) + **DOC-GAP-066, DOC-GAP-067 (NEW batch D)** | One consolidated "Known limitations" section on the feature page; cross-link from main-concepts |
| Housekeeping TTL (NEW 2026-05-12D aggregated) | 1 config-section | Exists (200); documents 3 of 5 jobs + shipped 30-day defaults + jOOQ bug ack | 4 distinct gaps: DOC-GAP-059 (Java-default-vs-YAML cliff), DOC-GAP-060 (3-vs-5 jobs framing), DOC-GAP-061 (no message retention), DOC-GAP-062 (jOOQ bug unlinked) | One consolidated "Default-value persistence + complete job coverage" section on housekeeping page |
| DataCollaboration (2026-05-12C aggregated, expanded batch D) | 1 feature page + 1 config-section | Both exist (200); enumerate 6 keys correctly | 4 distinct gaps: DOC-GAP-032 (cross-tenant), DOC-GAP-033 (auth/authz/rate), **DOC-GAP-064 (lock-id collision NEW)**, **DOC-GAP-071 (partial-home NEW)**, DOC-GAP-065 (retry-count=0 LOW) | "Lock-ID disjointness" admonition + "Where these keys are bound" maintainer note on config-section |

## Stale-page candidates (SUMMARY.md × concepts.yaml — pages with no surfaced concept)

(Empty section — the substrate is currently undercoverage with 30 sidecars across a much larger codebase. The risk is substrate-coverage-gap, not stale-page; flag for re-enrichment of unsurfaced areas instead.)

## Maintainer notes

(Free-form. Preserved across refreshes.)

**2026-05-10A batch refresh**: 8 new findings (DOC-GAP-028..035) added; 3 existing findings extended with method-level evidence (DOC-GAP-002, DOC-GAP-005, DOC-GAP-010, DOC-GAP-022, DOC-GAP-023). DOC-GAP-025 upgraded LOW → HIGH on direct getActivity.md evidence. Two new categories of pattern surfaced:
1. **Doc-vs-code audience drift** (DOC-GAP-002 sub-finding): doc text recommends "stewards and admins" audience while code enforces "any authenticated user" — both code-side fix (add ALERT_LIST_ALL gate) and doc-side fix (rewrite audience framing) are valid; the drift itself is the finding.
2. **Source-published-but-routed-wrong** (DOC-GAP-035): legacy un-prefixed URL `/active-platform-features/data-collaboration` 404s but the canonical path renders normally — joins the existing DOC-GAP-011..015 cluster.

**2026-05-10B batch refresh** (5 config-key-consumer sidecars; 9 new findings DOC-GAP-036..044; doc-gaps.md jumped from 35 to 44 total):
- 5 HIGH findings added: DOC-GAP-036, DOC-GAP-037, DOC-GAP-038, DOC-GAP-039, DOC-GAP-041
- 3 MEDIUM findings added: DOC-GAP-040, DOC-GAP-042, DOC-GAP-043
- 1 LOW finding added: DOC-GAP-044
- Three new patterns surfaced: triangulated default-open posture, documentation-overstates-config-effect, partial-doc-coverage-with-gap-on-asymmetry.

**2026-05-12C batch refresh** (5 sidecars: 4 `*SecurityConfiguration` wiring-site auth-mode classes + 1 NotificationsProperties config-properties-class; 14 new findings DOC-GAP-045..058; doc-gaps.md jumped from 44 to 58 total):

- **8 new HIGH findings**: DOC-GAP-045 (DISABLED blast radius — CSRF/CORS/actuator/S2S-ignored/audit-absence/no-boot-WARN cluster), DOC-GAP-046 (OAuth2 5-vs-7 provider drift; Okta/Keycloak no handlers), DOC-GAP-047 (Azure azure-tenant-id field absent from POJO; YAML example not deployable), DOC-GAP-048 (Azure logout-uri unvalidated at @PostConstruct despite docs flagging required), DOC-GAP-049 (OAuth2/LDAP/LOGIN_FORM pages silent on S2S composition; X-API-Key→ADMIN-across-/** undocumented per mode), DOC-GAP-050 (LDAP auth.ldap.password leak via /actuator/env), DOC-GAP-051 (LDAP page omits 7 distinct caveats — LDAPS/admin-substring/no-admins/S2S/health/timeouts/pool), DOC-GAP-052 (LOGIN_FORM page omits 6 distinct caveats — authz framework/login-form-redirect/session-cookie security/S2S/actuator-env/CSRF), DOC-GAP-053 (META: "docs frame default behaviour but omit blast radius" — 3-sidecar-triangulated cross-cutting pattern), DOC-GAP-054 (Notifications no rate-limit — Slack 429 / SMTP saturation), DOC-GAP-055 (Notifications no audit trail).
- **5 new MEDIUM findings**: DOC-GAP-056 (Notifications legacy URL 404 — joins routing-drift cluster), DOC-GAP-057 (Notifications operational caveats cluster — dead webhookUrl + per-channel filtering + PII redaction + replication-slot orphan + webhook unsigned), DOC-GAP-058 (META: GitBook legacy-vs-canonical routing drift class — 2-sidecar triangulated; recommend doc-side audit of ALL legacy paths).
- Several existing findings extended with batch-C wiring-site evidence: DOC-GAP-036 (DisabledAuthSecurityConfiguration implicit_adrs + bugs_limitations confirm application.yml-bundled DISABLED default and no-matchIfMissing across 4 sibling classes), DOC-GAP-039 (LoginFormSecurityConfiguration wiring-site confirms no AuthorizationCustomizer + ADMIN-for-all), DOC-GAP-040 (OAuth2+LDAP sidecars confirm AuthorizationManagerCondition is unwired — direct per-config @ConditionalOnProperty is the actual gate).
- Live URL re-verification this session (2026-05-12):
  - `/configuration-and-deployment/enable-security/authentication/disabled-authentication` 200 — full body re-fetched verbatim; confirms DOC-GAP-045's blast-radius omission cluster verbatim (no mention of CSRF/CORS/actuator/audit/S2S-ignored/appInfo/boot-WARN).
  - `/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 200 — confirms 7-provider claim verbatim (AWS Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC); confirms Azure logout-uri required claim verbatim ("Always include `logout-uri` when configuring the `azure` provider" + "leaving `logout-uri` unset raises a `NullPointerException`"); confirms `azure-tenant-id` field references in YAML examples.
  - `/configuration-and-deployment/enable-security/authentication/ldap` 200 — confirms verbatim that NONE of the seven specific security/operability caveats (DOC-GAP-051) are addressed in the page.
  - `/configuration-and-deployment/enable-security/authentication/login-form` 200 — confirms verbatim that NONE of the six caveats (DOC-GAP-052) are addressed.
  - `/active-platform-features/notifications` 404 — confirms DOC-GAP-056 routing drift.
  - `/features/active-platform-features/notifications` 200 — confirms canonical Notifications feature page renders; documents channels + AlertManager unauth caveat + SMTP timeout caveat (partial coverage of operational caveats; DOC-GAP-054/055/057 capture the remaining gaps).
- **Three new meta-recommendations** worth maintainer-level attention:
  1. **DOC-GAP-053**: "docs frame default behaviour but omit blast radius" pattern is now 3-sidecar-triangulated. Recommend adding to `pillars/documentation/gates.md` an explicit Gate 3 extension: caveats must appear ADJACENT to the default-behaviour claim, not several sections away. Recommend adding to `playbooks/pre-authoring-stance.md` an explicit blast-radius prompt.
  2. **DOC-GAP-058**: GitBook legacy-vs-canonical routing drift is now 2-sidecar-triangulated. Recommend a doc-side audit of ALL legacy `/active-platform-features/*`, `/data-discovery/*`, and `/main-concepts` paths in the `documentation/` repo. Recommend GitBook redirect rules for high-traffic legacy paths.
  3. **Auth-mode concept cluster**: the Auth Mode concept is now 7-sidecar-triangulated and has 12 distinct gaps across the 5 sub-pages of `enable-security/authentication/`. Recommend a single batch authoring session that adds one consolidated "Security and operability caveats" H2 to each sub-page rather than 12 individual admonitions across multiple sessions — the cluster size justifies one focused authoring batch.

**2026-05-12D batch refresh** (5 config-properties-class primary-source POJO sidecars: ODDOAuth2Properties, ODDLDAPProperties, EmailSenderProperties, DataCollaborationProperties, HousekeepingTTLProperties; 13 new findings DOC-GAP-059..071; doc-gaps.md jumped from 58 to 71 total):

- **6 new HIGH findings** + 1 promoted META HIGH: DOC-GAP-059 (Housekeeping TTL Java-default vs YAML-default cliff — LSN-001 shape), DOC-GAP-061 (No `messageDays` retention — symmetric to activity), DOC-GAP-063 (OAuth2 `username-attribute` prose vs `user-name-attribute` YAML same-page inconsistency), DOC-GAP-067 (META: Lombok `@Data` toString sensitive-field leak — 4-sidecar triangulated), DOC-GAP-069 (ODD_IAM provider absent from docs), DOC-GAP-070 (`adminUserInfoFlag` undocumented).
- **6 new MEDIUM findings**: DOC-GAP-060 (housekeeping framed as 3 jobs; code has 5), DOC-GAP-062 (jOOQ bug ack unlinked to upstream issue), DOC-GAP-064 (DataCollab lock-id collision risk undocumented), DOC-GAP-066 (Email config completeness cluster — 6 sub-caveats), DOC-GAP-068 (META: partial-home pattern — 2-sidecar triangulated), DOC-GAP-071 (DataCollab partial-home specific instance).
- **1 new LOW finding**: DOC-GAP-065 (DataCollab retry-count=0 semantics undocumented).
- **Significant refinements to existing findings**:
  - **DOC-GAP-006** (S3 credential actuator-env): batch-D primary-source verification refines the leak surface — Spring Boot 3.4.10's `show-values: NEVER` default DOES mask values; durable leak vector is Lombok-toString (cross-reference DOC-GAP-067 META).
  - **DOC-GAP-041** (Activity-feed retention claim): 2-angle confirmed — HousekeepingTTLProperties has NO `activityDays` field; both partition-manager (WIDTH only) AND housekeeping (no activity scope) agree the docs claim is wrong. Promoted from 1-angle to 2-angle case.
  - **DOC-GAP-046** (OAuth2 5-vs-7 provider drift): 2-angle confirmed from ODDOAuth2Properties primary-source POJO sidecar; cross-links to new DOC-GAP-069 (ODD_IAM absent in docs) and DOC-GAP-070 (`adminUserInfoFlag` absent).
  - **DOC-GAP-050** (LDAP password leak): 2-angle refined — Spring Boot 3.4.10 actuator-env masking works by default; Lombok-toString is the durable leak vector. Proposed doc action rewritten to address BOTH surfaces (actuator + logging discipline). Cross-references DOC-GAP-067 META.
- **Live URL re-verification this session (2026-05-12, batch D)**:
  - `/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 200 — re-verified; ODD_IAM provider entirely absent (DOC-GAP-069); `adminUserInfoFlag` entirely absent (DOC-GAP-070); same-page inconsistency between `username-attribute` (descriptive prose) and `user-name-attribute` (every YAML example) confirmed verbatim (DOC-GAP-063).
  - `/configuration-and-deployment/odd-platform` 200 — re-verified housekeeping section: confirms "three cleanup tasks" framing (missing 2 of 5 jobs per DOC-GAP-060); jOOQ bug acknowledgement verbatim with no upstream-issue link (DOC-GAP-062); 30-day default documented but no Java-vs-YAML-default-location caveat (DOC-GAP-059). Re-verified SMTP caveats (timeout / STARTTLS / silent partial delivery) ARE documented verbatim — POSITIVE coverage on these; DOC-GAP-066 cluster captures the REMAINING uncovered email caveats.
  - `/features/active-platform-features/data-collaboration` 200 — re-verified; no lock-id collision warning anywhere on the feature page (DOC-GAP-064).
  - `/features/active-platform-features/notifications` 200 — re-verified; no rate-limit / per-channel-filtering / PII / webhook-signing / OAUTH2-SMTP / Reply-To / `@Email` validation coverage (DOC-GAP-054, 055, 057, 066).
  - `/features/active-platform-features/activity-feed` 200 — re-verified; retention claim wording verbatim ("Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`") — page does NOT explain what "retention" means or clarify that ODD has NO row-by-age delete path (DOC-GAP-041).
  - `/configuration-and-deployment/enable-security/authentication/ldap` 200 — re-verified; no LDAP password actuator caveat, no substring-collision warning, no LDAPS guidance (DOC-GAP-050, 051).
- **Two new meta-recommendations** worth maintainer-level attention (joining DOC-GAP-053 and DOC-GAP-058 from batch C):
  1. **DOC-GAP-067 (META Lombok-toString leak class)**: 4-sidecar triangulated. Recommend a code-side audit across ALL `@ConfigurationProperties` POJOs holding credentials (LDAP password, OAuth2 client secret, SMTP password, S3 access/secret keys, slack-oauth-token, etc.) to add `@ToString.Exclude` annotations. Recommend a doc-side "Logging discipline" admonition on every affected page. Recommend a pillar-side gate addition (`pillars/documentation/gates.md`) requiring credential docs to include Logging-discipline caveats.
  2. **DOC-GAP-068 (META Partial-home pattern)**: 2-sidecar triangulated. Recommend a code-side consolidation pass — every `@ConfigurationProperties` POJO should bind its ENTIRE prefix, not just the subset its author chose to type. Recommend a "Where these keys are bound" maintainer-onboarding note on the configuration-guide sections that enumerate split prefixes.
- **Cross-cutting refinement on the actuator-env framing**: batch D's primary-source verification narrowed the credential-leak scope. The original batch-C framing ("actuator/env leaks credentials to whitelisted callers") was overbroad — Spring Boot 3.4.10 ships `show-values: NEVER` as the framework default, masking the VALUES. The DURABLE leak vector is Lombok `@Data`-generated `toString()` if logged. The actuator concerns remain valid for defence-in-depth (operators may override `show-values`; key NAMES are always returned) but the META framing should focus on the Lombok pattern. DOC-GAP-006, DOC-GAP-050 updated; DOC-GAP-067 captures the cross-cutting pattern.
