---
artefact: doc-gaps
generated_at: "2026-05-11T00:00:00Z"
generated_at_commit: ede5d277
sidecar_count: 25
concepts_yaml_version: 3
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 44
findings_by_severity: { HIGH: 19, MEDIUM: 19, LOW: 6 }
findings_by_category: { broken-url: 6, missing-anchor: 0, drift: 25, missing-page: 6, stale-page: 0, coverage-gap: 7 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars: AppInfoController @ auth.type@L18, AuthorizationManagerCondition @ auth.type@L11, CounterTimeSeriesExtractor @ metrics.storage@L20, IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20, ActivityTablePartitionManager @ odd.activity.partition-period@L11). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041 — code never DROPs partitions, doc claims partition-period controls retention). 4 distinct findings on activity-partition subsystem (DOC-GAP-041..043 + DOC-GAP-040 partial covers via cross-ref). Verified WebFetch 2026-05-11 — `enable-security` parent page DOES now state `auth.ingestion.filter.enabled defaults to false`, partial doc coverage; the `/api/appInfo` introspection surface, DISABLED-default of auth.type, LOGIN_FORM-drops-authorization, and tenant-id read/write asymmetry remain undocumented."
---

# Doc gaps — odd-platform — 2026-05-11

## Summary

- **Findings**: 44 total (19 HIGH, 19 MEDIUM, 6 LOW)
- **By category**: broken-url 6, drift 25, missing-page 6, coverage-gap 7
- **By feature** (top affected concepts): Auth Mode (4 — new in 2026-05-10B; DISABLED-default + LOGIN_FORM-drops-authorization + appInfo fingerprinting + empty-string footgun), Data Entity (5), Activity Feed (5 — extended in 2026-05-10B by activity-partition findings), Attachment (5), Alert (4), AlertManager Webhook Receiver (3), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4 — new in 2026-05-10B), Multi-Tenant Configuration / Metrics Ingestion (1 — new in 2026-05-10B), Collector / Collector Token (2), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). 9 HIGH findings are LSN-001/LSN-002-class operator-impact gaps (added: DOC-GAP-036 + DOC-GAP-037 + DOC-GAP-041 in 2026-05-10B). Batch 2026-05-10B config-key-consumer sidecars triangulate the **default-open posture** cross-cutting pattern: three independent sidecars converge on the same operator-trap shape (DISABLED-default of `auth.type` + FALSE-default of `auth.ingestion.filter.enabled` + no fail-fast on misconfigured `auth.type`).
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface (e.g. "Alerts feature" page does not warn that every auth'd user sees every alert; "Activity Feed" page does not warn that every auth'd user reads cross-owner audit trails).
  - **Doc-text-vs-code audience drift** (new pattern, 2026-05-10A): the live alerting doc names "stewards and admins" as the All-tab audience while code enforces "any authenticated user" — this is a *prescriptive-doc-vs-permissive-code* mismatch. Code change OR doc change can resolve; the doc-vs-code drift itself is the finding.
  - **Triangulated default-open posture** (new pattern, 2026-05-10B): THREE independent config-key-consumer sidecars converge on the same operator-trap shape — (a) `auth.type=DISABLED` is the application.yml default (`AppInfoController@L18` + `AuthorizationManagerCondition@L11`), (b) `auth.ingestion.filter.enabled=false` is the application.yml default (`IngestionDataEntitiesFilter@L20`), (c) no fail-fast on misconfigured `auth.type` (empty/typo silently produces a deployment with no `SecurityWebFilterChain` bean). Per LSN-001 + LSN-002 case-law, this is the canonical insecure-default failure mode the ontology was built to surface. The live docs partial-cover (a) and (b) — `enable-security` parent page now mentions `auth.ingestion.filter.enabled defaults to false` (WebFetched 2026-05-11, 200), but **none** of the four pages surveyed (`enable-security`, `enable-security/authentication`, `enable-security/authorization`, `enable-security/authentication/s2s`) state that `auth.type=DISABLED` IS the bundled application.yml default.
  - **Documentation-overstates-config-effect** (new pattern, 2026-05-10B): activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" (WebFetched 2026-05-11, 200) — code has only a CREATE path; **no DROP / retention path ever runs for the activity table**. The doc is materially incorrect: an operator setting `partition-period=7` to reduce "retention" gets narrower partitions but unbounded growth. Same shape as LSN-001 (attachment-ephemeral-default).
  - URL-prefix drift (continued): legacy un-prefixed URLs (`/active-platform-features/*`, `/data-discovery/*`, `/main-concepts`) all 404 with GitBook redirect-suggestion stubs. New entry in this class: `/active-platform-features/data-collaboration`.
  - **Source-published-but-routed-wrong** (new pattern, 2026-05-10A): `/active-platform-features/data-collaboration` returns 404 even though `documentation/docs/active-platform-features/data-collaboration.md` exists in the repo; the live publication is reachable only at `/features/active-platform-features/data-collaboration`. This is the same URL-prefix-drift class as DOC-GAP-011 — the live URL is canonical, the legacy URL is the dead stub.
  - The api-reference subtree covers `directory` + `lineage` + `alerts` + `data-collaboration` + others, but no `data-entities` page exists AND no `activity` page exists (404 verified 2026-05-10). The 40 dataEntity operations and the global activity feed are punted to Swagger UI / OpenAPI spec on the index page.

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
    - `odd-platform__java__AlertController__controller-method__getAllAlerts.md:security.known_security_gaps.[0]` + `:docs_link_semantic.doc_drift_findings.[0]` **(new 2026-05-10A — method-level audience-drift evidence)**
    - `odd-platform__openapi__tags__openapi-tag__alert.md:security.known_security_gaps.[0]`
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[0,1]` + `:cross_file_inconsistencies.[2]` (doc-code audience divergence)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-10 status 200 — confirmed verbatim: "All — Every open and resolved alert across the whole platform" with use-case recommendation "Platform-wide triage; **stewards and admins watching the full alert surface**." The page contains **no discussion** of access-control, authorization, or role-based restrictions for the `getAllAlerts` endpoint or the "All" tab.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — page lists `GET /api/alerts` and notes `My Objects`/`Dependents` require Owner-link, but does NOT warn that the `All` listing exposes every alert to every authenticated user.
    - getAllAlerts.md (2026-05-10A) verifies absence: `SecurityConstants.java:98-295` contains a rule for `PUT /api/alerts/{alert_id}/status` but NO entry for `GET /api/alerts`; `AuthorizationCustomizer.java:29-30` falls through to `pathMatchers('/**').authenticated()`. Repository `ReactiveAlertRepositoryImpl.java:143-145` issues `selectFrom(ALERT).where(ALERT.STATUS.eq(OPEN))` with no owner predicate.
    - **Audience-drift sub-finding (new 2026-05-10A)**: doc text recommends the All tab for "stewards and admins"; code permits any authenticated user. Two corrective paths exist (align doc to enforced "any authenticated user" behaviour, OR add an admin/steward Permission gate aligned with doc's stated audience) — the choice is the maintainer's; the drift is the finding.
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
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:security.known_security_gaps.[3]` **(new 2026-05-10A — method-level reinforcement at HIGH severity)** + `:docs_link_semantic.doc_drift_findings.[1]`
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Attachment Storage Configuration section frames `attachment.max-file-size` as a per-file cap with `spring.codec.max-in-memory-size` interaction described as the WebFlux codec layer failure mode. Does NOT disclose the cap is enforced ONLY client-side (UI filter) — no service-layer re-validation in `AttachmentServiceImpl`, `DataEntityAttachmentController`, or `FileServiceImpl`.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-10 status 200 — confirms the page asserts "Files larger than the cap are rejected by the upload API" — operator reasonably believes server enforces.
    - AttachmentServiceImpl@L27.md sidecar verifies absence of server-side enforcement.
    - **Method-level reinforcement (new 2026-05-10A)**: uploadFileChunk.md verifies the chunk endpoint reads no size, FileServiceImpl.java:58-67 calls `transferTo` without checking byte count. Combined with no rate-limit, this is a host-disk DOS surface against the chunk-staging filesystem. Already tracked as REFACTOR-013 (HIGH).
  - **Proposed doc action**: Add to both pages (config + feature) a Known-limitations admonition: "**Server-side enforcement**: the `attachment.max-file-size` cap is enforced in the UI (the file-picker filters before upload). The chunked-upload API does not re-validate per-chunk or aggregate size, so a non-browser caller with `DATA_ENTITY_ATTACHMENT_MANAGE` can submit arbitrarily-large files. Operators who need a hard server-side cap must enforce it via `spring.codec.max-in-memory-size` (which fails the request at the WebFlux codec layer with `DataBufferLimitException`) or at the network layer."
  - **Cross-references**:
    - F-056 (`spring.codec.max-in-memory-size` undocumented) — fix in same content area
    - REFACTOR-013 in `lineage/odd-platform/refactoring-scopes.md:107-115`
  - **Severity rationale**: HIGH — operator-facing storage planning (S3 bucket size, LOCAL filesystem capacity) anchored on a cap that doesn't apply.

- **DOC-GAP-006**: `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:security.known_security_gaps`
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[2]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Attachment Storage Configuration is comprehensive on storage backends and known limitations BUT contains NO warning about Spring Boot Actuator `/actuator/env` exposure surfacing `attachment.remote.access-key` / `attachment.remote.secret-key` keys (Spring's default key-pattern sanitisation masks values but the keys leak).
    - attachment-config-prefix.md sidecar surfaces this as severity HIGH.
  - **Proposed doc action**: Cross-link with F-054 (DOC-163) — when authoring the F-054 fix on Spring Boot Actuator, include a paragraph on attachment-storage credential exposure: "The default `management.endpoints.web.exposure.include` exposes `/actuator/env`. While Spring's default key-pattern sanitisation masks values containing `password`/`secret`/`key`/`token`, the *key names* themselves (`attachment.remote.access-key`, `attachment.remote.secret-key`, `auth.oauth2.client.client-secret`, etc.) are returned. Operators with externally-reachable Actuator endpoints leak the configuration shape; for production deployments, override the exposure list to drop `env` or move Actuator to a separate management port."
  - **Cross-references**:
    - **F-054** in `findings/docs-coverage-undocumented-features/2026-05-08.md` — same gap, broader scope (fold this finding into F-054's authoring as a sub-bullet)
  - **Severity rationale**: HIGH — operationally-reachable Actuator + S3 credentials leak shape is a security-deployment footgun.

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
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[2]` + `:security.known_security_gaps.[0]` **(new 2026-05-10A — method-level evidence: hijack vector + multi-instance staging path)**
    - `concepts.yaml:operations[Chunked File Upload (3-step state machine)]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-10 status 200 — describes UX (drag-and-drop) but NOT the wire protocol API consumers must implement. Verbatim: "This is a user-facing feature guide, not an API reference. It explains *what* attachments do and *how users interact* with them, but omits technical implementation details for developers integrating file uploads programmatically."
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-10 status 200 — no `data-entity-attachments` sub-page; sub-pages enumerated above.
    - SUMMARY.md confirms absence of `developer-guides/api-reference/data-entity-attachments.md`.
    - **Method-level evidence (new 2026-05-10A)**: uploadFileChunk.md verifies (a) `uploadId` is the authoritative session key — `dataEntityId` from path is bound but never forwarded (`AttachmentService.java:30` signature has no `dataEntityId`), (b) cross-entity hijack: a user with `DATA_ENTITY_ATTACHMENT_MANAGE` on entity X who learns another user's `uploadId` Y issued for entity Z can post chunks via `POST /api/dataentities/X/files/uploads/Y/chunks` and the chunk lands against Z (gate authorises path entity, service forwards by uploadId), (c) multi-instance staging: chunk path `/tmp/odd/chunks/{uploadId}/{index}` is hardcoded (`FileUtils.CHUNK_BASE_PATH`, not config-driven) — applies to BOTH `attachment.storage=LOCAL` AND `REMOTE` (the chunk staging path is upstream of the storage-backend dispatch). The class-level sidecar identified the LOCAL multi-instance flavour; the method-level finding promotes it to storage-mode-independent.
  - **Proposed doc action**: Either create `developer-guides/api-reference/data-entity-attachments.md` or add a "Wire protocol" H2 to `features/data-discovery/attachments.md` documenting: (1) `POST /api/dataentities/{id}/files/uploads` issues `uploadId` UUID; (2) `POST /api/dataentities/{id}/files/uploads/{uploadId}/chunks` with `index` query param posts each chunk; (3) `POST /api/dataentities/{id}/files/uploads/{uploadId}/complete` finalises and returns DataEntityFile. Note that `uploadId` is the authoritative session key — the path's dataEntityId on chunk/complete is effectively cosmetic; **the cross-entity uploadId-hijack caveat (DOC-GAP-023) belongs in the same section AND the multi-instance chunk-staging caveat (REMOTE storage equally affected per uploadFileChunk.md) belongs adjacent to the LSN-001 attachment-ephemeral admonition on the same page.**
  - **Cross-references**:
    - DOC-GAP-009 (api-reference under-coverage) — same family
    - DOC-GAP-023 (cross-entity uploadId hijack) — fold into chunked-upload section
    - LSN-001 (attachment-ephemeral default) — extend the existing danger box to cover the chunk-staging path being storage-mode-independent
  - **Severity rationale**: HIGH — every integration uploading attachments via API has to reverse-engineer the protocol from the OpenAPI spec; the live page's "drag-and-drop" prose is misleading for non-browser callers; the method-level evidence (cross-entity hijack + multi-instance staging) makes the missing protocol doc carry direct security/operational consequences.

- **DOC-GAP-025**: Activity Feed exposes cross-owner audit trail (`old_state`/`new_state` diffs) to any authenticated user — undocumented (UPGRADED from LOW to HIGH; method-level evidence)
  - **Category**: drift
  - **Surfaced by**:
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[2,4]` (extended 2026-05-10A — global activity feed cross-owner)
    - `concepts.yaml:entities[Activity Feed]` **(new in 2026-05-10A — Activity Feed promoted to first-class concept)**
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:security.known_security_gaps.[0]` (severity HIGH) + `:security.data_exposure.[0,1]` + `:docs_link_semantic.doc_drift_findings.[1]` **(new 2026-05-10A)**
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-10 status 200 — page lists seven filter facets (Calendar, Datasource, Namespace, Event type, Tag, Owner, User) and 20+ event types. Does NOT mention: visibility / authorization, who can see the feed, the `type` parameter (MY_OBJECTS / UPSTREAM / DOWNSTREAM / ALL), pagination via `lastEventId`, or any access-control statement.
    - getActivity.md verifies: `/api/activity` and `/api/activity/counts` carry no `@PreAuthorize`, no SecurityRule, fall through to `pathMatchers('/**').authenticated()` (`SecurityConstants.java:95-356` — no entry). The default `type=null` and `type=ALL` paths both route to `fetchAllActivities` which has no owner predicate. `userIds`/`ownerIds` filter parameters are not validated — submitting candidate id lists allows enumeration.
    - Activity payload includes `created_by` (actor identity) and `old_state`/`new_state` ActivityState diffs covering `description` free-text (DescriptionActivityStateDto), `business_name` edits, `internal_name` edits on dataset fields, custom-metadata key/value, term/tag assignments, ownership transitions, alert halt-config changes — all surfaced cross-owner under default and ALL types.
  - **Proposed doc action**: Add a "Visibility scope" admonition to `features/active-platform-features/activity-feed.md`: "The global Activity feed (`GET /api/activity`) is gated by authentication only; any authenticated user can read **cross-owner** audit-trail events including actor identity, full old-state/new-state diffs of descriptions, business names, ownership changes, and custom metadata. The `type=MY_OBJECTS` filter respects the caller's owner association; the default and `type=ALL` views do not. Under `auth.type=DISABLED` the feed is anonymously reachable. For deployments where audit-trail visibility must be role-gated, gate `/api/activity*` at the network or reverse-proxy layer." Add the same caveat to the per-entity Activity tab (`/api/dataentities/{id}/activity`) on the data-entity detail page.
  - **Cross-references**:
    - DOC-GAP-002, DOC-GAP-004, DOC-GAP-008 — the auth-mode-only-on-reads family (broad systemic pattern across DataEntity/Alert/Attachment/Directory/Activity)
    - DOC-GAP-029 (Activity api-reference page missing) + DOC-GAP-030 (Activity Feed page omits type/visibility/pagination) — sibling findings
  - **Severity rationale**: HIGH — Activity Feed is the platform's audit-trail surface; cross-owner exposure of who-changed-what diffs is GDPR/SOX-relevant in regulated environments. Description free-text fields can carry incident notes, customer ids, or internal tickets — surfaced to every authenticated user.

- **DOC-GAP-029**: No `/developer-guides/api-reference/activity` page — global Activity feed has no first-party API reference
  - **Category**: missing-page
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:docs_link_semantic.inferred_docs.[1]` (status 404, confidence LOW) + `:docs_link_semantic.doc_drift_findings.[2]`
    - `concepts.yaml:entities[Activity Feed].notes` (vocabulary_status: "codebase-anchored, doc-side-partially-covered")
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/activity` 2026-05-10 status 404 — H1 verbatim "Page Not Found".
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-10 status 200 — sub-page enumeration: Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships. **No "Activity" entry.**
    - Parallel to DOC-GAP-009 (data-entities missing) — same shape, different tag.
    - getActivity.md verifies the OpenAPI spec at `openapi.yaml:3206-3284` carries `description: 'Returns activity for dedicated period'` — no per-parameter descriptions, no MY_OBJECTS/UPSTREAM/DOWNSTREAM/ALL semantics. The spec on its own is the only API-reference surface for activity and it under-documents.
  - **Proposed doc action**: Create `developer-guides/api-reference/activity.md` enumerating: `GET /api/activity` (twelve query parameters with their semantics — beginDate/endDate required, size, datasourceId, namespaceId, tagIds, ownerIds, userIds, type [MY_OBJECTS|UPSTREAM|DOWNSTREAM|ALL with default=ALL], eventType, lastEventId, lastEventDateTime cursor pair); `GET /api/activity/counts` (aggregate totals across the four type modes). Add to SUMMARY.md under API Reference. Cross-link from `features/active-platform-features/activity-feed.md` and from the Permissions page. **Include the visibility-scope caveat from DOC-GAP-025** as a Known-limitations admonition adjacent to the endpoint description.
  - **Cross-references**:
    - DOC-GAP-009 (parallel — data-entities api-reference missing; same pattern)
    - DOC-GAP-025 (sibling — visibility-scope caveat belongs on the new page)
    - DOC-GAP-030 (sibling — feature page omissions belong on the feature page, not the api-reference)
  - **Severity rationale**: HIGH — Activity Feed is the only first-party API consumer surface for audit trails; integrators wanting to drive audit reads programmatically have no first-party reference and must read OpenAPI directly. Same family as DOC-GAP-009 (40 dataEntity operations punted to Swagger). The audit-trail use-case (compliance / incident review) particularly benefits from a typed reference page.

- **DOC-GAP-032**: Slack Data Collaboration cross-tenant message injection + missing authorization gate undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:security.known_security_gaps.[0,2]` (both severity HIGH) + `:bugs_limitations_corner_cases.[0,3]` + `:docs_link_semantic.doc_drift_findings.[0,1]`
    - `concepts.yaml:entities[Slack collaboration app].security_aggregate.weaknesses.[0,1]` + `:cross_file_inconsistencies.[0]` **(new 2026-05-10A)**
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` 2026-05-10 status 200 — endpoint description verbatim: "Queue a message for delivery into Slack. Returns `202 Accepted` once the message is enqueued; a background sender (`DataCollaborationMessageSenderJob`) drains the queue with up to `datacollaboration.sending-messages-retry-count` retries per message." The page documents NO authentication / authorization requirements, NO request validation (max length, sanitisation), NO rate-limit behaviour for `POST /api/datacollaboration/providers/slack/messages`.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration` 2026-05-10 status 200 — feature page describes Discussions tab and message-lifecycle but does not state authorization model. "The feature is 'disabled by default' but the UI tab remains visible, potentially confusing operators who haven't configured it" is the only operationally-relevant caveat.
    - postMessageInSlack.md verifies: `SecurityConstants.java:96-355` has NO entry for `/api/datacollaboration/providers/slack/messages`; controller has no `@PreAuthorize`; `DataCollaborationServiceImpl.createAndSendMessage(...)` has no programmatic permission check. The service accepts any user-supplied `data_entity_id` with only existence + hollow-check (`DataCollaborationServiceImpl.java:50-52`); no ownership check. User A can attach a message to a data entity owned by user B's owner — cross-tenant message-injection. `channel_id` is also fully user-supplied; no server-side `(data_entity, allowed_channels)` mapping.
  - **Proposed doc action**: Add a "Security caveats" sub-section to `developer-guides/api-reference/data-collaboration.md` for the POST endpoint: "**Authorization model**: this endpoint is gated by authentication only — any authenticated user can queue a Slack message attached to ANY data entity in the catalog, posted to ANY Slack channel the configured bot can reach. There is no ownership check on `data_entity_id`, no allowlist mapping for `channel_id`, no rate limit, and no body-size cap (`text` is `required` only — Slack's per-message ~40 KB limit fails AFTER the 202 response). Under `auth.type=DISABLED` the endpoint is anonymously reachable. For deployments where Slack-attached message provenance must be tied to data-entity ownership, gate the endpoint at the reverse-proxy layer or restrict the bot's channel scope to a subset that aligns with your tenancy model." Mirror the caveat on `features/active-platform-features/data-collaboration.md` (the feature page).
  - **Cross-references**:
    - DOC-GAP-002 / DOC-GAP-004 / DOC-GAP-008 / DOC-GAP-025 — the auth-mode-only-on-reads family extended to a write surface (the systemic pattern is "the platform's authorization model is path-pattern-coupled and silently absent on many surfaces")
  - **Severity rationale**: HIGH — Slack workspaces frequently host channel-level confidentiality assumptions (e.g. `#engineering-private`); cross-tenant message injection plus arbitrary `channel_id` selection means an attacker with any platform login can post into any channel the bot is in, attached to any entity. In multi-tenant deployments this is a Slack-side data-leak amplifier.

- **DOC-GAP-035**: `/active-platform-features/data-collaboration` returns 404 on legacy URL — canonical at `/features/active-platform-features/data-collaboration`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:docs_link_semantic.inferred_docs.[0]` (status 404, confidence LOW) + `:docs_link_semantic.doc_drift_findings.[2]` (severity HIGH for doc-drift) **(new 2026-05-10A)**
    - `concepts.yaml:entities[Slack collaboration app].cross_file_inconsistencies.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/data-collaboration` 2026-05-10 status 404 — H1 verbatim "Page Not Found". GitBook offers two alternative URLs: `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration.md` and `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration` 2026-05-10 status 200 — canonical feature page renders normally; covers Discussions tab, Slack OAuth, message-lifecycle, default-disabled posture.
    - postMessageInSlack.md surfaces this as severity HIGH for doc-drift because the source `documentation/docs/active-platform-features/data-collaboration.md` exists in the docs repo (DOC-138 / DOC-155-159 batch landed), so the broken legacy URL is particularly confusing for operators who follow internal cross-links or older external blog posts to the un-prefixed path.
  - **Proposed doc action**: Same as DOC-GAP-011 family — audit the codebase + documentation/ repo for any `/active-platform-features/data-collaboration` references; update to `/features/active-platform-features/data-collaboration`. Optionally add a GitBook redirect rule from the legacy path to the canonical one (`.gitbook.yaml`).
  - **Cross-references**: DOC-GAP-011, DOC-GAP-012, DOC-GAP-013, DOC-GAP-014, DOC-GAP-015 (same URL-prefix-drift class — the Data Collaboration variant joins the cluster).
  - **Severity rationale**: HIGH — legacy URL is more likely to surface in external blog posts / Slack discussions than for older features because the data-collaboration content was added recently; operators clicking to the legacy URL hit a 404 stub. The broken-URL itself is MEDIUM by the rubric (cosmetic 404 with redirect-suggestion stub) but the underlying doc-drift severity (operators cannot find the only page describing a feature they need to configure with care) is HIGH per sidecar's framing. Holding HIGH per the sidecar's surfaced severity.

- **DOC-GAP-036**: `auth.type=DISABLED` is the application.yml-bundled default but live `enable-security/authentication` pages do NOT state this — operator following the docs ships an unauthenticated platform without explicit opt-in
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:docs_link_semantic.doc_drift_findings.[1]` + `:bugs_limitations_corner_cases.[2]` (severity HIGH) **(new 2026-05-10B)**
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:docs_link_semantic.doc_drift_findings.[1]` + `:security.known_security_gaps.[0]` **(new 2026-05-10B)**
    - `concepts.yaml:entities[Auth Mode].security_aggregate.weaknesses` (triangulated default-open posture)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-11 status 200 — verbatim: "page does not explicitly state that `DISABLED` is the bundled default. It mentions `auth.type` configuration options and how each behaves, but makes no claim about which is the application.yml default."
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-11 status 200 — confirmed: `auth.ingestion.filter.enabled defaults to false` IS now stated verbatim on this parent page (partial coverage of the default-open posture; the `auth.type=DISABLED` default sibling claim is absent).
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-11 status 200 — does NOT state which modes wire authorization.
    - AppInfoController@L18.md verifies: `application.yml:34` sets `auth.type: DISABLED`; `DisabledAuthSecurityConfiguration.java:13-18` is `.anyExchange().permitAll()`; AppInfoController.java:18 declares `@Value("${auth.type}")` with NO default. An operator who omits `auth.type` in their override (helm values, env, etc.) inherits the application.yml default and runs a fully open platform.
    - AuthorizationManagerCondition@L11.md verifies the same default + the per-config `@ConditionalOnProperty` semantics: empty-string or typo'd `auth.type` produces a deployment with NO `SecurityWebFilterChain` bean wired.
  - **Proposed doc action**: Add a "Default behaviour" admonition to `configuration-and-deployment/enable-security/authentication.md` (or extend the existing default-disclosure on `enable-security.md`): "**The application.yml-bundled default is `auth.type: DISABLED`.** A deployment that does not explicitly set `auth.type` inherits this default and runs with `DisabledAuthSecurityConfiguration` — every endpoint, every method, every payload `.anyExchange().permitAll()`. There is no authentication and no authorization. For any production-shaped deployment, explicitly set `auth.type` to one of `LOGIN_FORM` (dev only), `OAUTH2`, or `LDAP`. Empty-string values (`AUTH_TYPE=`) or typos (`OUATH2`, `LOGINFORM`) silently produce a deployment with no `SecurityWebFilterChain` bean — Spring's autoconfiguration fallback may apply a permit-all default chain. There is no boot-time fail-fast on misconfigured `auth.type`." Pair with a sibling Known-limitations row on `enable-security.md` cross-referencing DOC-GAP-037 (the appInfo fingerprinting surface) and DOC-GAP-039 (the LOGIN_FORM-drops-authorization gap).
  - **Cross-references**:
    - LSN-001 / LSN-002 class — bundled-default insecure-default (canonical pattern the ontology was built to surface)
    - DOC-GAP-037 (appInfo fingerprinting under DISABLED — same root cause, different attack surface)
    - DOC-GAP-039 (LOGIN_FORM drops authorization framework — same default-doc-divergence shape on a different axis)
    - Concepts.yaml triangulation across three sidecars (`AppInfoController` + `AuthorizationManagerCondition` + `IngestionDataEntitiesFilter`)
  - **Severity rationale**: HIGH — the canonical LSN-001-class default-open posture. Operators reading current docs see auth modes enumerated as options without knowing which is the bundled default; they reasonably assume there is no default (or that the default is one of the authenticated modes). The application.yml-bundled DISABLED default plus absent fail-fast on misconfiguration is the platform's single largest "deploy with trial config, get owned" surface.

- **DOC-GAP-037**: `/api/appInfo` discloses active `auth.type` + `projectVersion` to unauthenticated network callers under DISABLED-default — passive fingerprinting surface, undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md:docs_link_semantic.doc_drift_findings.[0]` + `:security.data_exposure.[0,1]` + `:security.known_security_gaps.[0]` (severity MEDIUM per sidecar; HIGH per concepts.yaml triangulation) **(new 2026-05-10B)**
    - `concepts.yaml:entities[Auth Mode].security_aggregate.weaknesses` (deployment fingerprinting)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-11 status 200 — verbatim verdict: "`/api/appInfo` endpoint — not mentioned"; "default value of `auth.type` (DISABLED as default) — not mentioned".
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-11 status 200 — the parent page documents `auth.type` modes and `auth.ingestion.filter.enabled` default but contains no mention of `/api/appInfo`.
    - AppInfoController@L18.md verifies: `AppInfoController.java:24-28` returns `AppInfo.authType(authType).projectVersion(projectVersion)`; `AppInfo.java:48-66` exposes both as first-class JSON fields. `SecurityConstants.WHITELIST_PATHS` (lines 95-96) does NOT include `/api/appInfo`. Under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()` — `/api/appInfo` is anonymously reachable and discloses (a) the deployment's auth mode (telling an attacker whether to attempt credential stuffing vs OIDC tampering vs walking in), (b) the precise platform version (telling them which CVEs apply).
    - Under `LOGIN_FORM`/`OAUTH2`/`LDAP`, `/api/appInfo` falls through to `.authenticated()` — the disclosure surface is post-auth, but the implicit-ADR (`AppInfoController` is a *reporter* of the active mode so the SPA can render the right login flow) means an operator may reasonably expect the endpoint to be pre-auth-reachable under LOGIN_FORM too (so the form can render); the current behaviour likely produces a broken-UI bug under LOGIN_FORM that no doc page addresses.
  - **Proposed doc action**: Add to `configuration-and-deployment/enable-security/authentication.md` a "Deployment introspection surfaces" sub-section: "`/api/appInfo` returns `{ projectVersion, authType }`. Under `auth.type=DISABLED` (the application.yml default — see DOC-GAP-036) the endpoint is reachable by any caller with network access to the HTTP port; the response discloses the deployment's active auth mode and platform version. For deployments where the auth mode or version should not be discoverable pre-authentication, place the platform behind a reverse proxy that strips or path-gates `/api/appInfo`, or move to a non-DISABLED auth mode. Note: the endpoint is also reachable post-auth under `LOGIN_FORM`/`OAUTH2`/`LDAP`; under `LOGIN_FORM` specifically, the SPA's login form may depend on calling this endpoint *before* the user has authenticated — verify your deployment's SPA bootstrap path if you wish to gate `/api/appInfo`."
  - **Cross-references**:
    - DOC-GAP-036 (parent default-open posture)
    - LSN-001 / LSN-002 class
  - **Severity rationale**: HIGH — the disclosure itself is small (auth-mode string + version string), but combined with the DISABLED-default (DOC-GAP-036) it is a reliable network-side fingerprinting probe. An attacker scanning IP ranges for ODD deployments hits `/api/appInfo`, learns the auth mode (telling them what kind of break-in is needed), reads the version (scopes the CVE set), and chooses their next move — all without needing a single credential.

- **DOC-GAP-038**: `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:docs_link_semantic.doc_drift_findings.[0,1,2]` (all three HIGH) + `:bugs_limitations_corner_cases.[0,6]` (HIGH) + `:security.known_security_gaps.[0,3]` (HIGH) **(new 2026-05-10B)**
    - `concepts.yaml:entities[Ingestion Filter]` (canonical sidecar)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-11 status 200 — verbatim: "`auth.ingestion.filter.enabled` config key — not mentioned"; "`Authorization: Bearer` for ingestion endpoints — not mentioned"; "`IngestionDataEntitiesFilter` — not mentioned".
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-11 status 200 — confirmed verbatim: "`auth.ingestion.filter.enabled` defaults to `false`." — partial doc coverage (parent page) but no surrounding context (header convention, sibling-endpoint coverage, plaintext token comparison, body-buffered-before-auth DoS).
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s` 2026-05-11 status 200 — confirmed: only documents `auth.s2s.enabled` + `auth.s2s.token` + `X-API-Key` header for the SEPARATE `S2sAuthenticationFilter`. The S2S subpage references `auth.ingestion.filter.enabled` in passing ("consider combining S2S with `auth.ingestion.filter.enabled: true`") but does NOT document the per-datasource bearer-token protocol, the per-collector fallback, the `Authorization: Bearer` header convention, or that the toggle covers only `/ingestion/entities`.
    - IngestionDataEntitiesFilter@L20.md verifies: `application.yml:46-48` explicitly sets `auth.ingestion.filter.enabled: false`; the annotation at IngestionDataEntitiesFilter.java:20 has `havingValue="true"` with no `matchIfMissing`. When false, the filter bean is not registered, `SecurityConstants.WHITELIST_PATHS` whitelists `/ingestion/**`, every auth mode's `permittedPaths` includes `/ingestion/entities`, and the endpoint is reachable without any credential. Critically: `AlertManagerController.java:21` matches `/ingestion/alert/alertmanager` and is NOT covered by `IngestionDataEntitiesFilter` (path mismatch) NOR by `IngestionDataSourceFilter` (also path mismatch) NOR by `@PreAuthorize` — turning `auth.ingestion.filter.enabled=true` does NOT protect this endpoint. The property name "ingestion filter" reads globally; in practice it gates one of three `/ingestion/*` paths.
    - Two distinct doc-drift sub-findings: (a) docs CONFLATE `S2sAuthenticationFilter` (global `X-API-Key`) with `IngestionDataEntitiesFilter` (path-matched `Authorization: Bearer`) — two distinct filters, different headers, different token sources, different config keys, different scopes; (b) docs do not enumerate which `/ingestion/*` endpoints are covered by which filter, so an operator turning the toggle ON believes the whole ingestion surface is locked down.
  - **Proposed doc action**: Three-part doc action:
    1. Add to `configuration-and-deployment/enable-security/authentication.md` (or extend the S2S subpage) a "Per-datasource bearer-token ingestion auth" sub-section: "Distinct from the global S2S (`auth.s2s.enabled` + `X-API-Key`) authentication, the platform supports per-datasource bearer-token authentication on `POST /ingestion/entities`. Controlled by `auth.ingestion.filter.enabled` (default `false`). When `true`, callers must present `Authorization: Bearer <token>` matching the registered datasource's TOKEN row (or the parent collector's TOKEN row if the datasource has none). Token comparison is plaintext `String.equals` (no hashing, no constant-time comparison, no rotation grace — see DOC-GAP-034 for the rotation contract). Failed-auth attempts are NOT logged and NOT rate-limited."
    2. Add a "Coverage of `/ingestion/*` endpoints" table to the same section: enumerate `POST /ingestion/entities` (covered by `IngestionDataEntitiesFilter` when `auth.ingestion.filter.enabled=true`), `POST /ingestion/datasources` (covered by `IngestionDataSourceFilter` unconditionally — always on), `POST /ingestion/alert/alertmanager` (NOT covered by any filter, NO `@PreAuthorize`, see DOC-GAP-003 for the AlertManager-specific caveats). State explicitly: "`auth.ingestion.filter.enabled=true` does NOT protect `POST /ingestion/alert/alertmanager` — that endpoint is reachable to any caller on the network plane regardless of the toggle."
    3. Add a "Default behaviour" admonition: "The bundled `application.yml` defaults `auth.ingestion.filter.enabled` to `false`. A bundled deployment that the operator runs unmodified has `POST /ingestion/entities` reachable by any caller able to speak the ingress API — any caller can submit a `DataEntityList` payload referencing any registered `dataSourceOddrn`. The ingested entities become visible to all platform users. For production deployments, explicitly set `auth.ingestion.filter.enabled=true` AND provision per-datasource (or per-collector) tokens AND configure your collectors to send the `Authorization: Bearer` header."
  - **Cross-references**:
    - DOC-GAP-036 (parent default-open posture; triangulated)
    - DOC-GAP-003 (AlertManager unprotected sibling endpoint — extended here with the toggle-coverage caveat)
    - DOC-GAP-034 (rotation contract for the collector tokens this filter checks)
    - LSN-001 / LSN-002 — bundled-default class
  - **Severity rationale**: HIGH — same shape as LSN-001 (attachment-ephemeral default): a critical-severity default the docs only partially surface (parent page now mentions the default but not the consequences, sibling page conflates two distinct filters, no page enumerates which `/ingestion/*` paths are covered). Operators who toggle ON believe the whole `/ingestion/*` surface is locked down; in practice only one of three paths is.

- **DOC-GAP-039**: `auth.type=LOGIN_FORM` runs WITHOUT the authorization framework (Policies / Permissions / Roles / Owners) — `Authorization` page describes the framework with no mention of which auth modes wire it
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[1]` (severity HIGH) + `:security.known_security_gaps.[1]` (severity HIGH) **(new 2026-05-10B)**
    - `concepts.yaml:entities[Auth Mode].security_aggregate.weaknesses`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-11 status 200 — verbatim verdict: "The Authorization page describes the authorization framework components (Policies, Permissions, Roles, Owners, and User-owner association) but does not discuss which authentication modes wire or enable these authorization features. There are no statements about LOGIN_FORM, OAUTH2, LDAP, or DISABLED modes in relation to the authorization framework."
    - AuthorizationManagerCondition@L11.md verifies: `OAuthSecurityConfiguration.java:98` and `LDAPSecurityConfiguration.java:145` are the ONLY two `SecurityWebFilterChain` configurations that instantiate `new AuthorizationCustomizer(permissionService, extractors)` — i.e. only OAUTH2 and LDAP wire the per-Policy permission evaluation. `LoginFormSecurityConfiguration.java:55-58` configures `.authorizeExchange(...).pathMatchers("/**").authenticated()` — that gates by authentication, never by Policy/Permission/Role/Owner. `DisabledAuthSecurityConfiguration.java:13-18` skips both. The composite `AuthorizationManagerCondition` returns TRUE only for OAUTH2 OR LDAP (matching this design); the Condition class itself is unwired dead code (see DOC-GAP-040), but the underlying wiring is firmly OAUTH2-or-LDAP only.
    - The live `enable-security/authentication` page mentions "LOGIN_FORM is documented as dev-only" but does NOT state the consequence: "switching to LOGIN_FORM means the entire authorization framework you see on /authorization is silently absent."
  - **Proposed doc action**: Add a "Authorization framework applicability" admonition to the top of `configuration-and-deployment/enable-security/authorization.md`: "The Policies / Permissions / Roles / Owners framework described on this page is wired ONLY when `auth.type` is `OAUTH2` or `LDAP`. Under `auth.type=LOGIN_FORM` (documented as dev-only) the platform falls through to `.authenticated()` — every authenticated user can call every endpoint covered by Policy gates. Under `auth.type=DISABLED` (the application.yml default — see DOC-GAP-036) there is neither authentication nor authorization. To deploy with the access-control posture this page describes, set `auth.type` to `OAUTH2` or `LDAP`." Mirror with a sibling note on the authentication page next to the LOGIN_FORM row: "Note: LOGIN_FORM does not wire the authorization framework — see the Authorization page for details."
  - **Cross-references**:
    - DOC-GAP-036 (parent default-open posture)
    - DOC-GAP-040 (`AuthorizationManagerCondition` is unwired dead code — adjacent finding; this DOC-GAP-039 is about the doc gap, DOC-GAP-040 is about the code hygiene)
    - DOC-GAP-002 / DOC-GAP-004 / DOC-GAP-008 / DOC-GAP-025 — the auth-mode-only-on-reads family (LOGIN_FORM-drops-authorization makes those gaps universal under LOGIN_FORM regardless of the per-controller posture)
  - **Severity rationale**: HIGH — operators landing on `Authorization` to plan permission-model integration reasonably assume the framework applies under all four modes; switching to LOGIN_FORM in a misconfigured production deployment silently disables every Policy gate. Per the LOGIN_FORM "dev-only" caveat on the live docs, the audience for this doc fix is operators who misread the dev-only framing as "you may use it in production with a few caveats." This is the canonical doc-vs-code authority gap.

- **DOC-GAP-041**: Activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code never DROPs activity partitions; the retention claim is materially incorrect
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[0]` (severity HIGH — "silent-data-growth class — analogous to LSN-001") **(new 2026-05-10B)**
    - `concepts.yaml:entities[Activity Table Partitioning]` (new operational concept in 2026-05-10B)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-11 status 200 — verbatim Configuration section: "Activity-feed retention and partitioning are controlled by the platform-level setting [`odd.activity.partition-period`](/configuration-and-deployment/odd-platform.md#activity-feed-partitioning-odd-activity-partition-period) on [Configure ODD Platform](/configuration-and-deployment/odd-platform.md). Adjust the partitioning cadence per the volume your deployment generates — the operator-side reference is the canonical home for this key."
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-11 status 200 — partition-period section verbatim documents the cadence ("The default creates a new partition every 30 days") but contains NO mention of retention or DROP semantics. Activity partitioning section: "Mention of partition RETENTION semantics or DROP path for activity table: Not present — no retention or DROP discussion for the activity table."
    - ActivityTablePartitionManager@L11.md verifies code: `AbstractPartitionManager.createPartitionsIfNotExists` (AbstractPartitionManager.java:14-51) only CREATEs partitions; it never invokes `PartitionService.dropPartition` or `getEmptyPastPartitions` (PartitionService.java:21-25 — both methods exist on the interface but are never called for the activity table; grep for `dropPartition` in the partition package returns only the service itself, no callers). Setting `partition-period=7` to "reduce retention" produces narrower partitions but unbounded growth — the activity table accumulates rows monotonically.
  - **Proposed doc action**: Two-part doc action:
    1. Fix the activity-feed page's Configuration section verbatim: remove the word "retention" from "Activity-feed retention and partitioning are controlled by..." — the setting controls partition WIDTH/cadence only. Replace with: "Activity-feed partitioning cadence is controlled by the platform-level setting `odd.activity.partition-period` on Configure ODD Platform. **Activity-feed retention is not automatically managed by ODD Platform** — partitions are created but never dropped. Operators wanting to shorten retention must manually `DROP TABLE` aged partitions via DBA workflow, or maintain an external pgcron / housekeeping job that drops `activity_YYYYMMDD_YYYYMMDD` partitions older than the desired retention window."
    2. Add to `configuration-and-deployment/odd-platform.md` (under the existing `odd.activity.partition-period` section) a "Known limitations: no automatic retention" admonition: "There is no automatic DROP path for the `activity` table. The setting controls partition width only; partitions accumulate over the lifetime of the deployment. For deployments running ODD Platform for multiple years with high activity volumes, schedule an external pgcron / housekeeping job to drop aged partitions per your retention policy. The platform's `PartitionService.dropPartition` API exists but is not invoked for the activity table by any built-in job."
  - **Cross-references**:
    - LSN-001 class — silent-data-growth-default analogous to attachment-ephemeral-default; operator follows doc, believes retention is managed, accumulates unbounded data
    - DOC-GAP-042 (2x partition width undocumented — same page, adjacent finding)
    - DOC-GAP-043 (silent-fail on partition CREATE failure — same subsystem, adjacent finding)
  - **Severity rationale**: HIGH — the doc page is materially incorrect (claims `partition-period` controls retention when it does not), and the doc-vs-code divergence has an LSN-001-class operational consequence: operator setting `partition-period=7` to "reduce retention" gets narrower partitions but unbounded growth, then runs into table-size / planner-cost problems years later with no visibility into why. The operationally-misleading default-doc claim is the textbook LSN-001 case-law pattern.

### MEDIUM severity

- **DOC-GAP-011**: Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:docs_link_semantic.inferred_docs.[1]` (status: 404 at enrichment time)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__ts__routes__route__alerts.md:docs_link_semantic.doc_drift_findings.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/alerting` 2026-05-08 status 404 — H1 "Page Not Found"; suggests `https://docs.opendatadiscovery.org/features/active-platform-features/alerting.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-08 status 200 — confirmed canonical.
  - **Proposed doc action**: Audit cross-links across the codebase and `documentation/` repo for any `/active-platform-features/alerting` references; update to `/features/active-platform-features/alerting`. The substrate / orchestrator prompt template referencing the un-prefixed URL needs correction. Optionally add a GitBook redirect rule from the legacy path to the canonical one (GitBook supports redirects in `.gitbook.yaml`).
  - **Cross-references**:
    - DOC-GAP-012, DOC-GAP-013, DOC-GAP-014, DOC-GAP-015, DOC-GAP-035 (same URL-prefix-drift class — surface once, list together)
  - **Severity rationale**: MEDIUM — operators clicking external links to the un-prefixed URL hit a 404 stub; GitBook's redirect-suggestion stub mitigates but doesn't eliminate the friction.

- **DOC-GAP-012**: Legacy URL `/active-platform-features/genai` returns 404 — canonical at `/features/active-platform-features/genai`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/genai` 2026-05-08 status 404 — suggests `https://docs.opendatadiscovery.org/features/active-platform-features/genai.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-08 status 200.
  - **Proposed doc action**: Same as DOC-GAP-011 — cross-link audit and correction.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035 (same class).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-013**: Legacy URL `/data-discovery/attachments` returns 404 — canonical at `/features/data-discovery/attachments`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:docs_link_semantic.inferred_docs.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/data-discovery/attachments` 2026-05-08 status 404 — suggests `/features/data-discovery/attachments.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200.
  - **Proposed doc action**: Same as DOC-GAP-011.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035 (same class).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-014**: Legacy URL `/data-discovery/directory` returns 404 — canonical at `/features/data-discovery/directory`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:docs_link_semantic.inferred_docs.[1]`
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:docs_link_semantic.doc_drift_findings.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/data-discovery/directory` 2026-05-08 status 404 — suggests `/features/data-discovery/directory.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-08 status 200.
  - **Proposed doc action**: Same as DOC-GAP-011. F-039 was claimed resolved with the canonical URL, so the active link is fine — but any sidecar / scanner / state file pointing at the legacy URL needs an update.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035, F-039 (resolved upstream but legacy-URL references linger).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-015**: Legacy URL `/main-concepts` returns 404 — canonical at `/introduction/main-concepts.md`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:docs_link_semantic.inferred_docs.[0]` (confidence LOW, status 200 but content empty — this might be the JS-rendered case)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/main-concepts` 2026-05-08 status 404 — H1 "Page Not Found".
    - SUMMARY.md confirms the canonical path: `## Introduction → Main Concepts → main-concepts.md`.
  - **Proposed doc action**: Same as DOC-GAP-011. Note that the openapi-tag:dataEntity sidecar previously recorded status 200 here — re-verifying confirms the correct status is 404; the prior 200 reading was a JS-rendered stub that summarised as content. Update the dataEntity sidecar's `inferred_docs[0]` URL to `/introduction/main-concepts.md` on next enrichment.
  - **Cross-references**: DOC-GAP-011, DOC-GAP-035 (same class). The "Data Entity" canonical glossary entry that the openapi-tag-dataEntity sidecar wanted to verify lives at the canonical URL.
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-016**: Directory page wording: level 3 mixes "classes" and "types" — operator confusion
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/directory` 2026-05-08 status 200 — confirmed: "Level 3 describes 'distinct Data Entity classes' but the table entry for level 3 states 'Entity types within the selected data source.' This mixing of 'classes' and 'types' could create confusion for operators."
    - DirectoryController.md verifies the controller returns DataEntityType (TABLE/FILE/STREAM/...), not DataEntityClass (which is a different ODD vocabulary dimension).
  - **Proposed doc action**: In `features/data-discovery/directory.md`, replace every occurrence of "Data Entity classes" / "classes" in level-3 prose with "Data Entity types" / "types". Cross-reference `main-concepts.md` if Class vs Type vocabulary needs disambiguation.
  - **Cross-references**: None.
  - **Severity rationale**: MEDIUM — a vocabulary slip an operator familiar with ODD's `DataEntityClass` (a separate dimension: ENTITY/CONSUMER/SET/...) would interpret as a different feature.

- **DOC-GAP-017**: GenAI feature page: OpenAPI spec declares only 200 OK — no documented 400/500 error contract for `/api/genai/ask`
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:docs_link_semantic.doc_drift_findings.[2]`
  - **Evidence**:
    - GenAIController.md verifies: spec at `odd-platform-specification/openapi.yaml:4194-4213` declares ONLY `200 OK`. In practice endpoint returns 400 when `genai.enabled=false` (via `BadUserRequestException`) and 500 on timeout / upstream errors (via `GenAIException`).
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-08 status 200 — page mentions `enabled=false` returns "Gen AI is disabled" but doesn't surface the 400 status code or general error contract.
    - The generated `GenaiApi` interface therefore does not advertise the actual error contract.
  - **Proposed doc action**: Two routes (pick one or both): (a) update `odd-platform-specification/openapi.yaml` to declare `400` and `500` responses for `/api/genai/ask` (proper contract fix); (b) add an "Error contract" sub-section to the GenAI feature page enumerating the runtime statuses + their meanings until the spec catches up. Recommend (a) for the spec fix as a separate upstream issue, plus (b) as a doc-side stop-gap.
  - **Cross-references**:
    - The "Spec carries no security: block; authorization is wholly out-of-band" invariant in concepts.yaml — same class of spec-vs-runtime contract gaps
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-018**: API spec carries no `security:` block and no `components.securitySchemes` — invariant of contract-vs-runtime mismatch undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:docs_link_semantic.doc_drift_findings.[3]`
    - `odd-platform__openapi__tags__openapi-tag__alert.md:implicit_adrs.[3]`
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[0]`
    - `concepts.yaml:invariants[Spec carries no security: block; authorization is wholly out-of-band of the OpenAPI contract]`
  - **Evidence**:
    - openapi-tag-alert.md verifies: "exhaustive grep on openapi.yaml + components.yaml returns zero matches at commit ede5d277" for any security: block.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-10 status 200 — page punts readers to Swagger UI but does not warn that the spec's auth / role / scope information is absent.
  - **Proposed doc action**: Add a "Security note" admonition to `developer-guides/api-reference.md`: "The OpenAPI spec at `/api/v3/api-docs` declares no top-level `security:` block and no `components.securitySchemes`. Authorization decisions are enforced in Spring Security wiring downstream of the generated `*Api` interface. To learn which auth modes / permissions / roles apply, see [Authorization](/configuration-and-deployment/enable-security/authorization.md) and [Permissions](/configuration-and-deployment/enable-security/authorization/permissions.md). The spec on its own is not authoritative for auth requirements." Optionally cross-link from each api-reference sub-page.
  - **Cross-references**: DOC-GAP-018's recommendation pairs with DOC-GAP-009 — the missing data-entities api-reference page should carry this note as a sub-section.
  - **Severity rationale**: MEDIUM — every API consumer reading the spec is mis-served on auth.

- **DOC-GAP-019**: Concept "AlertManager Webhook Receiver" is a canonical_candidate but not a registered term in `main-concepts.md`
  - **Category**: missing-page
  - **Surfaced by**:
    - `concepts.yaml:entities[AlertManager Webhook Receiver]` (canonical_candidate: true)
    - `concepts.yaml:canonicalisation_candidates.[3]` (proposed_canonical: AlertManager Webhook Receiver, suggested_add_to_docs: true)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/main-concepts` 2026-05-08 status 404 (legacy URL) — canonical at `/introduction/main-concepts.md`. The local SUMMARY.md confirms the canonical exists but the on-page enumeration of canonical terms does not include "AlertManager Webhook Receiver".
    - The receiver has its own live section (`configuration-and-deployment/odd-platform.md#prometheus-alertmanager-integration`) and is conceptually distinct from the platform's internal Alert lifecycle: external write-only ingress, no `*Api` interface, hand-rolled DTO, unauthenticated by design.
  - **Proposed doc action**: Add "AlertManager Webhook Receiver" (with synonym "Prometheus AlertManager Integration") as a canonical term entry in `documentation/docs/introduction/main-concepts.md`; cross-link to the receiver's section on `configuration-and-deployment/odd-platform.md`. The concept's canonical home is the existing config section; the missing piece is the **vocabulary registration**.
  - **Cross-references**:
    - DOC-GAP-003 (where the receiver's caveats live)
  - **Severity rationale**: MEDIUM — discoverability + cross-linking; not an operator-impact gap on its own.

- **DOC-GAP-020**: Concept "Locale Bundle" / "Multilingual UI" — F-047 is filed; cross-referenced here
  - **Category**: missing-page
  - **Surfaced by**:
    - `concepts.yaml:entities[Locale Bundle]` (canonical_candidate: true)
    - `concepts.yaml:canonicalisation_candidates.[0]`
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — verbatim verdict "no mention of language selection, multilingual support, internationalization (i18n), locale settings, translation, supported languages, language picker, language switcher, SelectLanguage, or UI language configuration."
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features` returns 404 stub (the live URL is canonical at `/features/active-platform-features` per SUMMARY.md).
    - i18n_ts.md and SelectLanguage.md sidecars both surface this.
  - **Proposed doc action**: Already filed as F-047 in `findings/docs-coverage-undocumented-features/2026-05-08.md`. No new authoring action here — surfaced for substrate-side completeness (the substrate also surfaces this concept; the file-analyser-side doc_drift_findings reinforce F-047 with code-side evidence).
  - **Cross-references**:
    - **F-047** in `findings/docs-coverage-undocumented-features/2026-05-08.md` — same gap
    - LSN-013 retrospective (research-punted-on-substrate-draft) — this is the original case
  - **Severity rationale**: MEDIUM (per F-047 — six languages invisible to users + contributors).

- **DOC-GAP-021**: Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:docs_link_semantic.doc_drift_findings.[1]`
    - `concepts.yaml:entities[Data Entity].performance_aggregate.weaknesses` (no upper bound on lineageDepth)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-lineage` 2026-05-08 status 200 — does not document `lineageDepth` or `expandedEntityIds` or any depth caveat.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage` 2026-05-08 status 200 — DOES document `lineageDepth` (minimum 1) and `expandedEntityIds`. So the api-ref subpage covers the contract; the feature page is silent on operational caveats.
    - DataEntityController.md verifies: "No max-depth bound on lineage endpoints; `lineageDepth=1000000` reaches LineageService unmodified" + "DataEntityGroup lineage (`/api/dataentitygroups/{id}/lineage`) accepts no depth parameter at all."
  - **Proposed doc action**: Add a "Depth and bounds" admonition to `features/data-lineage.md`: "Lineage queries accept a `lineageDepth` parameter (minimum 1, no documented maximum). Large platforms with deep lineage graphs should set a reasonable depth — the platform does not bound the value at the controller layer; a request with `lineageDepth=1000000` reaches the LineageService unconstrained, producing arbitrarily-large response payloads. The `getDataEntityGroupLineage` endpoint accepts no depth parameter and walks the full graph by default — use it sparingly on large graphs."
  - **Cross-references**:
    - DataEntity concept's `performance_aggregate` weaknesses — the unbounded-depth + unbounded-pagination family
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-022**: Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap
  - **Category**: drift
  - **Surfaced by**:
    - `concepts.yaml:invariants[Pagination parameters declared but unconstrained at spec and controller layers]`
    - `odd-platform__openapi__tags__openapi-tag__alert.md:performance.known_performance_gaps.[0]`
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:performance.known_performance_gaps.[3]`
    - `odd-platform__java__AlertController__controller-method__getAllAlerts.md:bugs_limitations_corner_cases.[1]` + `:performance.known_performance_gaps.[0]` **(new 2026-05-10A — method-level reinforcement: `size=1_000_000` reaches jOOQ unmodified)**
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[3]` + `:performance.known_performance_gaps.[0]` **(new 2026-05-10A — same shape on activity feed)**
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — describes list endpoints as "Paginated list" but provides no parameters, page-size guidance, or response-size caveats.
    - Verified: spec encodes `page`, `size` as int32 with no min/max/default at `components.yaml:4213-4229`. A spec-conformant `size=2147483647` is permissible.
    - Method-level evidence (2026-05-10A): `AlertController.java:36-37` and `ActivityController.java:26` both bind `Integer size` without `@Max`, the generated `*Api` interfaces have `@NotNull @Valid` only, and the repositories pass through unmodified.
  - **Proposed doc action**: Add a "Pagination" section to `developer-guides/api-reference.md` (parent page) noting: "All paginated endpoints accept `page` and `size` as required `Integer` query parameters. The spec declares no upper bound on `size`; runtime behaviour is determined by the service / repository layer, not by the contract. Callers should pass conservative values (e.g. `size <= 1000`). Future contract revisions should add `maximum` constraints. This applies uniformly to alerts (`GET /api/alerts`), activity (`GET /api/activity`), data-entity listings, and other paginated surfaces."
  - **Cross-references**:
    - DOC-GAP-018 (spec-level coverage gaps in same family)
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-023**: Cross-entity uploadId hijack (Attachment) — undocumented; method-level evidence confirms the attack shape
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:security.known_security_gaps` (severity MEDIUM)
    - `odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:security.known_security_gaps.[0]` + `:bugs_limitations_corner_cases.[2]` **(new 2026-05-10A — method-level evidence)**
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[3]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-10 status 200 — RBAC section names DATA_ENTITY_ATTACHMENT_MANAGE but does not surface that the gate authorises the path's data entity while the service forwards by uploadId; a user with permission on entity X who learns another user's uploadId Y issued for entity Z can post chunks via `POST /api/dataentities/X/files/uploads/Y/chunks`.
    - DataEntityAttachmentController.md surfaces this as severity MEDIUM.
    - **Method-level evidence (new 2026-05-10A)**: uploadFileChunk.md verifies the misalignment is structural — `AttachmentService.java:30` signature is `Mono<Void> uploadFileChunk(final UUID uploadId, final Part file, final int index)` — `dataEntityId` is intentionally omitted from the service contract; `FileServiceImpl.java:93-102` resolves by `uploadId` only via `fileRepository.getFileByUploadId(uploadId)`. Fix requires service-side cross-validation (e.g. `assert filePojo.dataEntityId == path.dataEntityId`).
  - **Proposed doc action**: Fold into the DOC-GAP-010 (chunked-upload protocol) authoring — when documenting the wire protocol, explicitly call out that uploadId is the authoritative session key and the path's dataEntityId is cosmetic on chunk/complete; recommend that operators implementing custom integrations validate upload session ownership at the application layer. Optionally drive an upstream issue for service-side cross-validation in FileServiceImpl.
  - **Cross-references**: DOC-GAP-010 (combine).
  - **Severity rationale**: MEDIUM — requires path-mismatch + cross-user uploadId leak; less impactful than DOC-GAP-004 but worth surfacing. Method-level evidence confirms the attack shape (no longer hypothetical).

- **DOC-GAP-030**: Activity Feed feature page omits `type` parameter, visibility model, cursor pagination mechanics
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:docs_link_semantic.doc_drift_findings.[0,1,3]` **(new 2026-05-10A)**
    - `concepts.yaml:entities[Activity Feed].notes`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-10 status 200 — page lists seven filter facets verbatim (Calendar / Datasource / Namespace / Event type / Tag / Owner / User) and 20+ event types organised by category (lifecycle, ownership, tags/terms, dataset fields, groups, alerts). The page **does NOT mention**: (a) the `type` parameter that switches between MY_OBJECTS / UPSTREAM / DOWNSTREAM / ALL views (UI + controller + ActivityType enum support it); (b) who can see activity (no authorization/visibility statement — see DOC-GAP-025); (c) pagination mechanics (cursor via `lastEventId` + `lastEventDateTime`); (d) the `size` parameter or default page size; (e) free-text descriptions surfaced via `DescriptionActivityStateDto`, custom-metadata values surfaced via `CustomMetadataActivityState`, dataset-field internal-name changes, business-name edits.
    - getActivity.md verifies the controller's twelve query parameters vs the doc's seven filter facets — the doc page covers the UI affordances but omits API-driven axes.
  - **Proposed doc action**: Extend `features/active-platform-features/activity-feed.md` with: (a) a "Type-of-feed" sub-section enumerating MY_OBJECTS / UPSTREAM / DOWNSTREAM / ALL semantics with the visibility-scope caveat from DOC-GAP-025; (b) a "Pagination" sub-section covering the `(lastEventId, lastEventDateTime)` cursor pattern (note: `size` default + recommended cap pending DOC-GAP-022); (c) a "Activity payload shape" sub-section describing what fields appear in `old_state`/`new_state` (free-text descriptions, internal/business-name changes, custom-metadata, etc.) so operators can assess audit-feed sensitivity. Cross-link to the (new) DOC-GAP-029 api-reference page for the parameter contract.
  - **Cross-references**: DOC-GAP-025 (visibility-scope), DOC-GAP-029 (api-reference page), DOC-GAP-031 (lasEventId typo).
  - **Severity rationale**: MEDIUM — the activity-feed UI page is operationally important (compliance / incident review) and the omission of the type/visibility/pagination axes leaves operators with a partial mental model.

- **DOC-GAP-033**: Slack Data Collaboration api-reference page omits authentication/authorization/validation/rate-limit
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__DataCollaborationController__controller-method__postMessageInSlack.md:docs_link_semantic.doc_drift_findings.[0,1]` **(new 2026-05-10A)**
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` 2026-05-10 status 200 — the page documents the `POST /api/datacollaboration/providers/slack/messages` endpoint behaviour (queue + 202 + retry count) and confirms gating by `@ConditionalOnDataCollaboration` (404 when `datacollaboration.enabled=false`). Verbatim absence: "the page does NOT document authentication / authorization requirements, request schema, or rate-limit behaviour for this endpoint."
    - postMessageInSlack.md verifies the absence is operationally significant — the endpoint has no permission gate, no body-size cap, no rate limit (see DOC-GAP-032).
  - **Proposed doc action**: This finding is **fully covered by DOC-GAP-032's proposed doc action** — adding a "Security caveats" sub-section to the api-reference page covering authn/authz/validation/rate-limit closes both findings simultaneously. Surfaced separately so the maintainer can see the doc-page-level gap as distinct from the security-content gap (DOC-GAP-032 is the *what to add*; DOC-GAP-033 is the *where it's missing*).
  - **Cross-references**: DOC-GAP-032 (combine in authoring).
  - **Severity rationale**: MEDIUM — api-reference is the authoritative consumer-facing surface; absence of authn/authz/validation/rate-limit is consistent with the spec-level "no security: block" finding (DOC-GAP-018) but operators reading the api-ref page reasonably expect it to call out the security model.

- **DOC-GAP-034**: Token Rotation operational mechanics (grace period, audit logging, plaintext-in-response, in-flight 401) absent from enable-security pages
  - **Category**: missing-page
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:docs_link_semantic.doc_drift_findings.[0,1,2]` **(new 2026-05-10A)**
    - `concepts.yaml:entities[Collector Token].notes` (vocabulary_status: "codebase-anchored, doc-side-partially-covered")
    - `concepts.yaml:entities[Collector].cross_file_inconsistencies.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-10 status 200 — verbatim: "* `COLLECTOR_TOKEN_REGENERATE`. Allows regenerating the security token for a collector." The page does NOT describe operational consequences such as grace periods, audit logging, plaintext-in-response behavior, or in-flight 401 handling related to token rotation.
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-10 status 200 — page enumerates auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S) without explaining how the S2S credential is rotated.
    - regenerateCollectorToken.md verifies the operational concerns: (a) no grace period — in-flight ingestion using old token 401s the moment UPDATE commits; (b) no audit log — `TOKEN.updated_by` overwritten on each rotation, no append-only history; (c) plaintext returned in response body — any reverse-proxy / browser-history / response-logging middleware records the new credential; no `Cache-Control: no-store`, no sensitive-body header; (d) under `auth.type=DISABLED` the gate is bypassed entirely — any caller can rotate any collector's token anonymously and receive plaintext; (e) no rate-limit on rotation — stolen MANAGEMENT-permission session can rotate every collector's token in a loop, breaking platform-wide ingestion; (f) token entropy uses non-CSPRNG `RandomStringUtils.randomAlphanumeric(40)`.
  - **Proposed doc action**: Create a new sub-page `configuration-and-deployment/enable-security/token-rotation.md` (or extend `authentication.md` with a "Rotation contract" H2) covering: (1) which Permission grants rotation (`COLLECTOR_TOKEN_REGENERATE`, MANAGEMENT tier); (2) operational shape — in-place UPDATE with no overlap window, plaintext in response body (caveat: avoid rotating via non-TLS path; plan for the response value to leak through any logging middleware); (3) in-flight ingestion impact — the old token 401s the moment UPDATE commits; coordinate rotation with the collector's config-reload cadence; (4) audit log absence — the `TOKEN.updated_by` column is the only forensic surface and is overwritten on each rotation; operators wanting a rotation history must capture it externally; (5) `auth.type=DISABLED` caveat — the gate is bypassed; any caller can rotate any token; do not enable DISABLED in any deployment with internet-reachable management endpoints; (6) entropy concern — current `RandomStringUtils.randomAlphanumeric(40)` uses non-CSPRNG; an upstream issue tracks migration to `RandomStringUtils.secure().nextAlphanumeric(40)`. Add to SUMMARY.md under enable-security. Cross-link from `permissions.md` (next to the COLLECTOR_TOKEN_REGENERATE row) and from `authentication.md` (next to S2S).
  - **Cross-references**: None (this is the first ODD doc-finding in the enable-security/token-rotation sub-area).
  - **Severity rationale**: MEDIUM — the operational mechanics matter for any deployment using collectors; rotation without a grace period is a known-class operator footgun (LSN-002 family — operationally surprising default). The plaintext-in-response shape is a security-deployment caveat; the missing audit log is a compliance gap. Severity is MEDIUM (not HIGH) because the gate IS correctly wired (verified) — the concerns are operational/compliance rather than authorization-bypass.

- **DOC-GAP-040**: `AuthorizationManagerCondition` is unwired dead code — Authorization page describes the framework as if a centralised condition gates it, but no `@Conditional` consumes the class
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__AuthorizationManagerCondition__config-key-consumer__auth_type@L11.md:bugs_limitations_corner_cases.[0]` (severity MEDIUM) + `:security.known_security_gaps.[0]` (severity MEDIUM) **(new 2026-05-10B)**
    - `concepts.yaml:entities[Auth Mode]` (axes_present extended)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-11 status 200 — page describes the framework abstractly with no reference to a Condition-gated wiring path; this is the doc gap.
    - AuthorizationManagerCondition@L11.md verifies: `grep -rln "AuthorizationManagerCondition" <odd-platform> --include="*.java"` returns ONLY the file's own path (2026-05-10). No `@Conditional(AuthorizationManagerCondition.class)` anywhere; the authorization wiring it appears designed to gate is in practice carried out by direct per-config `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` and `havingValue="LDAP"` annotations on `OAuthSecurityConfiguration.java:71` and `LDAPSecurityConfiguration.java:51`. The Condition class is vestigial.
  - **Proposed doc action**: This is **primarily a code-hygiene fix, secondarily a doc fix**. Code-side: file an upstream issue via `/log-issue odd-platform` to either (a) wire `AuthorizationManagerCondition` into the `SecurityWebFilterChain` factory path (consolidating the per-config `@ConditionalOnProperty` annotations behind the composite Condition for clarity) or (b) delete the dead Condition class entirely. Doc-side: DOC-GAP-039's Authorization-framework-applicability admonition (above) already names the OAUTH2/LDAP gating; no additional doc text required if the dead code is deleted, and a clarifying note if the dead code is wired up. The choice between (a) and (b) is the maintainer's; the operational doc-vs-code consequence is captured by DOC-GAP-039.
  - **Cross-references**:
    - DOC-GAP-039 (the operationally-relevant doc gap; this DOC-GAP-040 is the code-hygiene companion)
    - Drives a `/log-issue odd-platform` for the dead-code resolution
  - **Severity rationale**: MEDIUM — code-hygiene-shaped; a future maintainer reading the Condition class would reasonably assume it gates the authorization-manager wiring path and rely on it, causing silent regressions. The doc-side consequence is already captured by DOC-GAP-039.

- **DOC-GAP-042**: Activity-feed partition WIDTH is `2 × partition-period` (60 days at default) but docs say "a new partition every 30 days" — operator storage planning under-estimates by 2x
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:docs_link_semantic.doc_drift_findings.[1]` **(new 2026-05-10B)**
    - `concepts.yaml:entities[Activity Table Partitioning]` (new operational concept)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-11 status 200 — verbatim verdict: "Mention of `2x partition width` or '60 days' related to activity partitions: Not present." The page says "The default creates a new partition every 30 days, which is appropriate for most deployments."
    - ActivityTablePartitionManager@L11.md verifies: `AbstractPartitionManager.java:35` is `new TablePartition(lastPartitionDate, lastPartitionDate.plusDays(partitionDaysPeriod * 2L))` — the `* 2L` literal sets WIDTH to twice the `partitionDaysPeriod`, while `AbstractPartitionManager.java:37` advances the cursor by `partitionDaysPeriod` only — producing a deliberate 2x-overlap window so INSERTs targeting `baseline + period` always land in an existing partition before the next CREATE cycle. The implicit-ADR is consistent across `ActivityTablePartitionManager` and the sibling `MessageTablePartitionManager` — the 2:1 width-to-cadence ratio is the design.
  - **Proposed doc action**: Update the `odd.activity.partition-period` section on `configuration-and-deployment/odd-platform.md` to surface the 2x overlap: "**Partition width vs cadence**: setting `odd.activity.partition-period=30` (the default) creates partitions that each span 60 days (2 × period) and appends a new partition every 30 days. The deliberate 2x overlap ensures INSERTs near the partition boundary always land in an existing partition. Storage planning should size for partition width = 2 × period, not = period." Same caveat on the activity-feed Configuration section (cross-reference with DOC-GAP-041).
  - **Cross-references**:
    - DOC-GAP-041 (parent doc-claim correction on the same subsystem)
    - DOC-GAP-043 (silent-fail on CREATE failure — same subsystem)
  - **Severity rationale**: MEDIUM — operator storage planning ends up off by 2x; not security-shaped but materially incorrect. The 2x-overlap design itself is sound; the docs just under-disclose it.

- **DOC-GAP-043**: Activity-feed partition CREATE failures are silently swallowed (ERROR log only); operator has no metric / alert / health-check signal — undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md:docs_link_semantic.doc_drift_findings.[3]` + `:bugs_limitations_corner_cases.[2]` (severity HIGH) + `:performance.known_performance_gaps.[1]` (severity MEDIUM — observability gap) **(new 2026-05-10B)**
    - `concepts.yaml:entities[Activity Table Partitioning]` (new operational concept)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-11 status 200 — partition-period section documents the cadence but contains no mention of failure modes (DB role lacking CREATE TABLE privilege, partition-name collision, advisory-lock contention, ShedLock cluster outage). Verbatim verdict: "Mention of partition RETENTION semantics or DROP path for activity table: Not present" and no failure-mode discussion either.
    - ActivityTablePartitionManager@L11.md verifies: `PostgreSQLPartitionCreationJob.java:53-60` catches the `RuntimeException` raised by `AbstractPartitionManager.createPartitionsIfNotExists` (line 49) and logs at ERROR before continuing to the next manager. There is no alerting, no Micrometer counter / timer / gauge, no health-check degradation, no UI surfacing. An ODD instance booting with a DB role lacking CREATE TABLE privilege logs ERROR once at boot and the application proceeds — until `activity` INSERTs begin failing as rows arrive for the uncovered window.
    - Adjacent finding: `partition.advisory-lock-id` (default `90`) is required by `@Value("${partition.advisory-lock-id}")` at PostgreSQLPartitionCreationJob.java:26 with NO `:default` fallback; the live docs page does NOT list this key in its documented set (verified verbatim by the sidecar: "`partition.advisory-lock-id` ABSENT from the documented set, while `notifications.wal.advisory-lock-id` and `datacollaboration.receive-event-advisory-lock-id` ARE listed"). An operator who removes the key from a customised application.yml fails bean wiring at boot — a configuration-ghost footgun.
  - **Proposed doc action**: Three-part doc action on `configuration-and-deployment/odd-platform.md` activity-partition section:
    1. Add a "Failure modes" sub-section: "Partition creation can fail for the following reasons: (a) the platform's DB role lacks `CREATE TABLE` privilege on the `public` schema; (b) a partition name collision with a manually-created partition outside the `activity_YYYYMMDD_YYYYMMDD` convention; (c) advisory-lock contention with another instance during boot; (d) Postgres rejection on `endDate < beginDate` (when `odd.activity.partition-period` is set to a negative integer). Failures are logged at ERROR level by `PostgreSQLPartitionCreationJob` and the boot continues — downstream `INSERT INTO activity` calls fail with `no partition of relation \"activity\" found for row` when rows arrive in the uncovered window. There is currently no Micrometer metric, no health-check signal, and no UI surface for partition-creation failures; operators should monitor application logs for `Couldn't create partition for table activity`."
    2. Add a "DB role requirements" sub-section: "The platform's DB role must have `CREATE TABLE` privilege on the `public` schema to support boot-time and nightly partition creation for the `activity` (and `message`, when DataCollaboration is enabled) tables. Least-privileged deployments that grant only DML must add DDL grants for the partition-managed tables."
    3. Add `partition.advisory-lock-id` to the documented configuration-key list with a note: "`partition.advisory-lock-id`: Postgres advisory lock id (default `90`) used at boot to serialise partition creation across multiple instances. The key has no `:default` fallback in code — the application.yml-bundled default is the only thing preventing a Spring placeholder-resolution failure at boot. Operators customising application.yml must keep this key set."
  - **Cross-references**:
    - DOC-GAP-041 (parent doc-claim correction on the same subsystem)
    - DOC-GAP-042 (2x partition width — adjacent finding)
    - LSN-001 class — silent-fail of durability-critical subsystem (the activity audit trail is the platform's compliance surface)
  - **Severity rationale**: MEDIUM — operationally-shaped; not direct data loss but the operator's blind-spot on partition-creation health is a compliance footgun. The undocumented `partition.advisory-lock-id` is a configuration-ghost.

### LOW severity

- **DOC-GAP-024**: OpenAPI tag `alert` has no `description:` field and no `externalDocs.url` — Swagger UI / ReDoc consumers see unannotated tag
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:docs_link_semantic.doc_drift_findings.[0,2]`
  - **Evidence**:
    - openapi-tag-alert.md verifies: spec's `alert` tag declaration is `name: alert` only (openapi.yaml:30); no description, no externalDocs.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — the doc page exists; the spec just doesn't link to it from the tag.
  - **Proposed doc action**: Add `description:` and `externalDocs:` to the `alert` tag in `odd-platform-specification/openapi.yaml`. Mirror for the `dataEntity` tag and the `activity` tag (once DOC-GAP-029 lands). This is an upstream `odd-platform-specification` change; file via `/log-issue opendatadiscovery-specification`.
  - **Cross-references**: DOC-GAP-029 (when the activity api-ref page lands, link from the activity tag).
  - **Severity rationale**: LOW — cosmetic tooling concern; doc page exists.

- **DOC-GAP-026**: AlertManager DTO drops AlertManager fields (`status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`); cannot honour `status: resolved` to close alerts
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:performance.known_performance_gaps.[3]`
    - `concepts.yaml:entities[AlertManager Webhook Receiver].performance_aggregate.weaknesses.[3]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Prometheus AlertManager Integration section documents the inbound contract but does not surface that the platform's hand-rolled DTO drops AlertManager's `status: resolved` semantics; a downstream RESOLVED transition cannot be auto-driven by AlertManager.
  - **Proposed doc action**: Add to the Prometheus AlertManager Integration section a "Behaviour notes" sub-bullet: "ODD's hand-rolled receiver consumes only `labels`, `startsAt`, `generatorURL`, and `description` from each AlertManager alert. Fields `status`, `endsAt`, `annotations`, `fingerprint`, and `groupKey` are dropped on the floor. AlertManager's `status: resolved` transition cannot auto-close the corresponding ODD alert; operators must mark alerts resolved manually (or via `PUT /api/alerts/{id}/status`)."
  - **Cross-references**: DOC-GAP-003 (broader AlertManager caveats).
  - **Severity rationale**: LOW — partially-implemented integration limitation.

- **DOC-GAP-027**: Locale-bundle CSP / localStorage caveat absent on (eventual) i18n doc page
  - **Category**: drift
  - **Surfaced by**:
    - `concepts.yaml:entities[Locale Bundle].security_aggregate.weaknesses.[1]`
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:security.known_security_gaps` (severity LOW)
    - `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:security.known_security_gaps`
  - **Evidence**:
    - i18n.ts sidecar: bootstrap calls `localStorage.getItem('i18nextLng')` unguarded; in privacy-mode browsers where localStorage access throws, the import-for-side-effects raises before `<App />` renders — entire UI unreachable.
    - F-047 (filed) does not surface the CSP / localStorage caveat; it surfaces the discoverability gap.
  - **Proposed doc action**: When DOC-NNN authoring on F-047 lands, include a Known-limitations sub-section: "Operators implementing a Content Security Policy that disables localStorage break the language-switcher's persistence path; users will have their selection reset to `en` on every page load. In privacy-mode browsers where localStorage access throws, the bootstrap's unguarded `localStorage.getItem('i18nextLng')` call raises before the app renders — the entire UI is unreachable, including the login screen."
  - **Cross-references**: F-047 (carries the parent gap), DOC-GAP-020 (cross-reference).
  - **Severity rationale**: LOW — tied to a non-default browser configuration.

- **DOC-GAP-028**: Activity Feed counts endpoint (`/api/activity/counts`) issues 4 parallel aggregation queries per call — undocumented operational caveat
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:performance.known_performance_gaps.[1]` + `:performance.hot_paths.[2]` **(new 2026-05-10A)**
    - `concepts.yaml:entities[Activity Feed].performance_aggregate.weaknesses.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-10 status 200 — page does not describe `/api/activity/counts` as an endpoint that does aggregation work; the count badges appear in UI without operational caveat.
    - getActivity.md verifies: `getActivityCounts` issues four parallel `Mono.zip` queries (`totalCount` + `myObjectsCount` + `downstreamCount` + `upstreamCount`); for a UI polling counts on a refresh interval, DB load is 4× the apparent endpoint count. No caching, no debouncing, no aggregate table.
  - **Proposed doc action**: Fold into DOC-GAP-029's api-reference content (when authored): note that `GET /api/activity/counts` issues four aggregation queries per call; recommend conservative polling cadence (e.g. ≥30s between refreshes) on high-traffic platforms; surface as a deployment-tuning consideration.
  - **Cross-references**: DOC-GAP-029 (api-reference page; combine).
  - **Severity rationale**: LOW — operationally relevant but not security-shaped.

- **DOC-GAP-031**: `lasEventId` typo on Java controller signature persists into generated client SDKs; doc page does not surface the parameter at all
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__ActivityController__controller-method__getActivity.md:bugs_limitations_corner_cases.[0]` (severity LOW) **(new 2026-05-10A)**
    - `concepts.yaml:entities[Activity Feed].security_aggregate.weaknesses.[4]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-10 status 200 — searched for `lasEventId`, `lastEventId`, `last_event_id`, `lasEvent` — verbatim verdict: "The page does not surface any of these parameter names." The doc-side does not mention the cursor-pagination parameter at all (see DOC-GAP-030 for the broader pagination omission).
    - getActivity.md verifies: `ActivityController.java:34` declares `final Long lasEventId` (missing the `t` in `last`). The OpenAPI parameter is `last_event_id` (correct) but the Java method signature exposes `lasEventId`. `ActivityService.java:42` is correctly spelled `lastEventId` — the controller's local variable name is the only surface that carries the typo. Generated client SDKs derived from the controller signature would carry the typo; once published, fixing the typo is a breaking change for consumers.
  - **Proposed doc action**: This is a **code fix, not a doc fix**. The doc-side action is contingent: (a) if the typo is fixed in code (preferred; rename `lasEventId` → `lastEventId` in `ActivityController.java:34` — verify no generated client SDK has been published with the typo before deciding), no doc action needed; (b) if the typo is preserved for backward compatibility, the (new) `developer-guides/api-reference/activity.md` page (DOC-GAP-029) must call it out: "**Parameter name caveat**: the Java controller method signature exposes the cursor-id parameter as `lasEventId` (missing `t` typo, preserved for SDK backward compatibility); the OpenAPI parameter is correctly `last_event_id`. Client SDKs generated from the Java contract carry the typo; SDKs generated from OpenAPI do not." Drive an upstream issue via `/log-issue odd-platform` to decide path (a) vs (b).
  - **Cross-references**: DOC-GAP-029 (where the conditional doc fix would land), DOC-GAP-030 (the pagination axis is currently invisible in the feature-page filter list — fixing both together makes sense).
  - **Severity rationale**: LOW — typo on a public API surface is a long-term papercut (every consumer reading the Java signature has to learn it); but the doc-page-level effect is minimal because the page does not surface the parameter at all today (see DOC-GAP-030).

- **DOC-GAP-044**: Prometheus `tenant_id` label has read/write asymmetry on empty-string `odd.tenant-id` — write side appends `tenant_id=""`, read side omits the filter; undocumented on the Prometheus tenant-label section
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md:docs_link_semantic.doc_drift_findings.[0]` + `:bugs_limitations_corner_cases.[0]` (severity HIGH per sidecar; MEDIUM per concepts.yaml triangulation) **(new 2026-05-10B)**
    - `concepts.yaml:entities[Metrics Ingestion]` + `:entities[Multi-Tenant Configuration]` (new concepts in 2026-05-10B)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-11 status 200 — verbatim verdict: anchors `metric-storage-backend` AND `prometheus-tenant-label-odd-tenant-id` confirmed PRESENT (the section exists with positive doc coverage of the happy path). However: "Discussion of read/write tenant-id label asymmetry on empty-string `tenant-id`: Not present — the documentation states the key has 'no default (empty means no label is applied)' but does not discuss asymmetry between reads and writes."
    - CounterTimeSeriesExtractor@L20.md verifies: `AbstractTimeSeriesExtractor.java:60` uses `if (tenantId != null)` — an empty string passes the guard and writes a `tenant_id=""` label onto every TimeSeries. `ExternalMetricReader.java:111` uses `StringUtils.isNotEmpty(tenantId)` — an empty string fails the guard and the read filter omits the `tenant_id` clause. Net effect: if an operator supplies `ODD_TENANT_ID=` (env var set to empty) rather than leaving the variable unset, every write goes to a series tagged `tenant_id=""` but reads query across all tenants. In a shared-Prometheus multi-tenant deployment this either (a) buries this tenant's series under an unfilterable label other tenants don't have, or (b) returns series from co-tenants whose `tenantId` was `null`.
    - The doc page DOES describe the happy path correctly ("empty means no label is applied, and the Prometheus query returns series across all tenants") — but that description matches the READ side only; the WRITE side has the asymmetric `!= null` guard. The doc is partially accurate; the gap is the asymmetry between the two sides under the specific empty-string-from-env case.
  - **Proposed doc action**: Extend the existing `prometheus-tenant-label-odd-tenant-id` section on `configuration-and-deployment/odd-platform.md` with a "Known limitation: empty-string vs unset" admonition: "`odd.tenant-id` distinguishes three cases at runtime: (1) unset (key absent from application.yml, no env var override) — Spring binds `null`, BOTH the write side (`tenant_id` label not appended) AND the read side (no filter) agree on 'no tenant'; (2) explicitly set to a non-empty string — both sides apply the value as the label and the filter; (3) explicitly set to empty string (e.g. `ODD_TENANT_ID=` env var) — **asymmetric**: the write side appends `tenant_id=\"\"` to every series, but the read side omits the filter and queries across all tenants. In shared-Prometheus multi-tenant deployments, never set `ODD_TENANT_ID=` as an empty env override; either leave the variable fully unset (Spring binds null) or set it to a non-empty unique string per ODD Platform deployment. A future code fix should align the two sides (both `!= null` or both `isNotEmpty`); track the upstream issue if filed."
  - **Cross-references**:
    - Drives a `/log-issue odd-platform` upstream fix for the read/write asymmetry
    - Metrics storage backend concept's doc home (positive coverage; this finding extends existing content)
  - **Severity rationale**: LOW — requires the operator to supply `ODD_TENANT_ID=` (empty string) AND run a shared-Prometheus multi-tenant deployment for the asymmetry to bite. Most deployments either leave the variable unset (case 1, safe) or set a real tenant id (case 2, safe). The doc currently describes case 1+2 correctly; the gap is the absent case 3 caveat.

## Concept-without-page candidates (from concepts.yaml × SUMMARY.md)

Concepts surfaced by the substrate that are not registered as canonical terms in `main-concepts.md`. Some have a doc home (a section on a config page); others have none.

| Concept | canonical_candidate | Axes present | Contributing nodes | Suggested doc home | Notes |
|---|---|---|---|---|---|
| Locale Bundle / Multilingual UI | true | ui_shell | 2 | `configuration-and-deployment/i18n.md` or `features/i18n.md` | F-047 already filed; LSN-013 case-law; six locales invisible to users + contributors |
| Attachment | true | controllers, config_prefixes | 4 | Already has page at `features/data-discovery/attachments.md` and config section; missing only as a canonical term in `main-concepts.md` | LSN-001 + LSN-002 case-law live here; method-level uploadFileChunk evidence reinforces |
| Attachment Storage Backend | true | config_prefixes, controllers | 2 | Already documented as a section on `configuration-and-deployment/odd-platform.md`; canonical_candidate suggested_add_to_docs:false (concept too operationally-narrow for main-concepts) | DOC-GAP-006 attaches; chunk-staging path universality finding (REMOTE storage equally affected) extends the doc home |
| AlertManager Webhook Receiver | true | controllers | 1 | Has a section on `configuration-and-deployment/odd-platform.md`; missing as canonical term in main-concepts.md (DOC-GAP-019) | suggested_add_to_docs: true |
| Activity Feed | true (new 2026-05-10A) | controllers | 1 | Has feature page at `features/active-platform-features/activity-feed.md` but missing as canonical term in main-concepts.md AND missing api-reference page (DOC-GAP-029) | vocabulary_status: codebase-anchored, doc-side-partially-covered |
| Collector Token | true (new 2026-05-10A) | controllers | 1 | New page recommended at `configuration-and-deployment/enable-security/token-rotation.md` (DOC-GAP-034) — operational-mechanics-shaped (in-place UPDATE, no grace, plaintext-in-response, audit-absence) | main-concepts.md mentions S2S auth mode but not token-rotation contract |
| Auth Mode | true (new 2026-05-10B) | config_prefixes, controllers | 3 | Already has page at `configuration-and-deployment/enable-security/authentication.md` and parent `enable-security.md`; missing **(a)** explicit DISABLED-default disclosure, **(b)** LOGIN_FORM-drops-authorization caveat, **(c)** appInfo introspection surface, **(d)** empty-string / typo footgun | DOC-GAP-036, DOC-GAP-037, DOC-GAP-039 cluster the gaps; triangulated by 3 config-key-consumer sidecars |
| Ingestion Filter (per-datasource bearer-token) | true (new 2026-05-10B) | config_prefixes | 1 | Parent `enable-security.md` now mentions `auth.ingestion.filter.enabled` default (WebFetched 2026-05-11) but does NOT document the `Authorization: Bearer` header, the per-datasource token model, the sibling-endpoint coverage gap (AlertManager), plaintext-equality, body-buffered-before-auth — DOC-GAP-038 captures all four gaps | Distinct from the S2S subpage which covers `S2sAuthenticationFilter` (`X-API-Key`); the two filters are conflated in current docs |
| Activity Table Partitioning | true (new 2026-05-10B) | config_prefixes | 1 | Has section on `configuration-and-deployment/odd-platform.md` (positive coverage of cadence + default); missing **(a)** retention-vs-partitioning correction (DOC-GAP-041), **(b)** 2x partition WIDTH disclosure (DOC-GAP-042), **(c)** failure-mode + DB-role privileges + `partition.advisory-lock-id` documentation (DOC-GAP-043) | Operational-mechanics concept; cross-references LSN-001 class |
| Metrics Storage Backend | true (new 2026-05-10B) | config_prefixes | 1 | Already documented in `configuration-and-deployment/odd-platform.md#metric-storage-backend` (positive coverage of `metrics.storage` + `metrics.prometheus-host` + Prometheus remote-write requirement); missing only **(a)** tenant-id read/write asymmetry on empty-string (DOC-GAP-044) | suggested_add_to_docs: false (concept too operationally-narrow for main-concepts; the section exists) |
| Multi-Tenant Configuration | true (new 2026-05-10B) | config_prefixes | 1 | Has subsection `prometheus-tenant-label-odd-tenant-id` on `configuration-and-deployment/odd-platform.md` (positive coverage of tenant-id label); missing tenant-isolation caveats (no validation, by-label-convention not by enforcement) and read/write asymmetry (DOC-GAP-044) | suggested_add_to_docs: false (operationally-narrow concept) |
| ODD API Consumer (audience) | true | controllers, openapi_tags | 6 | `main-concepts.md` audience vocabulary | suggested_add_to_docs: true; named in 6 sidecars |
| Prometheus AlertManager (audience) | true | controllers | 1 | `main-concepts.md` audience vocabulary; cross-link with DOC-GAP-019 | suggested_add_to_docs: false (the receiver itself is the visible concept) |

## Coverage-gap candidates (high-fan-out concepts × api-reference depth)

| Concept | Operations / surface | Documented count | Gap | Suggested action |
|---|---|---|---|---|
| Data Entity | 40 controller operations under `/api/dataentities/*` (concepts.yaml entry; DataEntityController + DataEntityAttachmentController + openapi-tag:dataEntity + DirectoryController + ActivityController.getActivity) | 0 (api-reference index punts to Swagger UI) | All 40 ops undocumented as a per-tag api-reference subpage | DOC-GAP-009 — create `developer-guides/api-reference/data-entities.md` |
| Attachment | 10 ops (chunked-upload protocol + list + edit + delete + download) | 0 (no api-reference page exists) | Wire protocol absent everywhere | DOC-GAP-010 — create page or extend feature page; 2026-05-10A method-level evidence (cross-entity hijack + multi-instance staging) makes this critical |
| Alert | 5 platform endpoints + 4 per-entity in dataEntity tag + AlertManager webhook | 9 + 1 enumerated on `/developer-guides/api-reference/alerts` | Auth-mode + visibility-scope caveats absent; doc-vs-code audience drift on All-tab | DOC-GAP-002 — admonition on alerts feature + api-reference (extended 2026-05-10A) |
| Activity Feed | 2 endpoints (`GET /api/activity` + `GET /api/activity/counts`); 12 query parameters | 0 (api-reference page returns 404) | All endpoints undocumented as a per-tag api-reference subpage | DOC-GAP-029 (new 2026-05-10A) — create `developer-guides/api-reference/activity.md`; DOC-GAP-030 extends feature page |
| Slack collaboration / Data Collaboration | ~7 endpoints under `/api/datacollaboration/*` | api-ref page exists (200) but omits authn/authz/validation/rate-limit | Security-content gaps | DOC-GAP-032, DOC-GAP-033 (new 2026-05-10A); also DOC-GAP-035 for the broken legacy URL |
| Collector / Collector Token | 5 endpoints under `/api/collectors/*`; 1 ingestion auth filter | Permission named on `/permissions`; auth-mode named on `/authentication` | Operational mechanics (rotation contract) absent | DOC-GAP-034 (new 2026-05-10A) — create `enable-security/token-rotation.md` or extend `authentication.md` |
| Directory | 4 ops | 4 (api-reference page exists) | Owner-scoping / authz caveat absent | DOC-GAP-008 — admonition on directory feature page |
| GenAI | 1 op | 1 (feature page documents the contract) | Security caveats absent | DOC-GAP-007 — security-caveats H2 |
| Multilingual UI / Locale Bundle | 2 ops (changeLanguage, bootstrap) | 0 (no doc page) | F-047 (filed) | DOC-NNN per F-047 |
| AlertManager Webhook Receiver | 1 op | 1 (operator-facing config section) | Caveats absent + concept not registered as canonical term | DOC-GAP-003 + DOC-GAP-019 |

## Stale-page candidates (SUMMARY.md × concepts.yaml — pages with no surfaced concept)

(Empty section — the substrate is currently undercoverage with 20 sidecars across a much larger codebase. The risk is substrate-coverage-gap, not stale-page; flag for re-enrichment of unsurfaced areas instead. Documentation-side stale-page identification requires substrate parity that is not yet achieved at slice 7+.)

## Maintainer notes

(Free-form. Preserved across refreshes.)

**2026-05-10A batch refresh**: 8 new findings (DOC-GAP-028..035) added; 3 existing findings extended with method-level evidence (DOC-GAP-002, DOC-GAP-005, DOC-GAP-010, DOC-GAP-022, DOC-GAP-023). DOC-GAP-025 upgraded LOW → HIGH on direct getActivity.md evidence. Two new categories of pattern surfaced:
1. **Doc-vs-code audience drift** (DOC-GAP-002 sub-finding): doc text recommends "stewards and admins" audience while code enforces "any authenticated user" — both code-side fix (add ALERT_LIST_ALL gate) and doc-side fix (rewrite audience framing) are valid; the drift itself is the finding.
2. **Source-published-but-routed-wrong** (DOC-GAP-035): legacy un-prefixed URL `/active-platform-features/data-collaboration` 404s but the canonical path renders normally — joins the existing DOC-GAP-011..015 cluster; the data-collaboration variant is particularly visible because the source content was added recently (DOC-138 / DOC-155-159 batch).

**2026-05-10B batch refresh** (5 config-key-consumer sidecars; 9 new findings DOC-GAP-036..044; doc-gaps.md jumped from 35 to 44 total):
- 5 HIGH findings added: DOC-GAP-036 (DISABLED-default of auth.type undocumented), DOC-GAP-037 (`/api/appInfo` fingerprinting under DISABLED), DOC-GAP-038 (ingestion filter coverage + AlertManager sibling endpoint gap), DOC-GAP-039 (LOGIN_FORM drops authorization framework), DOC-GAP-041 (activity-feed page falsely claims partition-period controls retention)
- 3 MEDIUM findings added: DOC-GAP-040 (`AuthorizationManagerCondition` dead code), DOC-GAP-042 (2x partition WIDTH undocumented), DOC-GAP-043 (silent-fail on partition CREATE failure + `partition.advisory-lock-id` undocumented + DB-role privileges undocumented)
- 1 LOW finding added: DOC-GAP-044 (tenant-id read/write asymmetry on empty-string)
- Live URL re-verification this session (2026-05-11):
  - `/configuration-and-deployment/enable-security` 200 — NEW positive coverage: `auth.ingestion.filter.enabled defaults to false` now explicitly stated (DOC-138 / 155-159 batch landing); the `auth.type=DISABLED` default sibling claim remains absent.
  - `/configuration-and-deployment/enable-security/authentication` 200 — does NOT state DISABLED is the default; does NOT mention `/api/appInfo` or `auth.ingestion.filter.enabled`.
  - `/configuration-and-deployment/enable-security/authorization` 200 — does NOT state which auth modes wire the framework (LOGIN_FORM/DISABLED gap undocumented).
  - `/configuration-and-deployment/enable-security/authentication/s2s` 200 — covers only `S2sAuthenticationFilter` (`auth.s2s.*` + `X-API-Key`); the per-datasource bearer-token protocol of `IngestionDataEntitiesFilter` is not documented here.
  - `/configuration-and-deployment/odd-platform` 200 — positive coverage of `metrics.storage` + `odd.tenant-id` + `odd.activity.partition-period`; missing tenant-id read/write asymmetry + 2x partition width + retention/DROP path + failure modes + `partition.advisory-lock-id`.
  - `/features/active-platform-features/activity-feed` 200 — Configuration section is materially incorrect: claims `partition-period` controls "retention and partitioning"; code has only a CREATE path.
- Three new patterns surfaced:
  1. **Triangulated default-open posture** (cross-cutting): THREE config-key-consumer sidecars converge on the same operator-trap — DISABLED-default of `auth.type` + FALSE-default of `auth.ingestion.filter.enabled` + no fail-fast on misconfigured `auth.type`. The live docs partial-cover one of the three; the cluster (DOC-GAP-036 / DOC-GAP-037 / DOC-GAP-038 / DOC-GAP-039) is the canonical LSN-001/LSN-002-class default-insecure surface.
  2. **Documentation-overstates-config-effect** (DOC-GAP-041): activity-feed page claims a setting controls "retention" when code has no DROP path. The doc is materially wrong; same LSN-001 shape as attachment-ephemeral-default.
  3. **Partial-doc-coverage-with-gap-on-asymmetry** (DOC-GAP-044): the doc page describes the happy path of `odd.tenant-id` correctly but omits the read/write asymmetry on empty-string. The page is partially accurate; the gap is the specific edge case that bites a particular env-var pattern.
- Net cumulative: 44 findings; 19 HIGH (10 of which are LSN-001/LSN-002 class — DOC-GAP-001 / 002 / 004 / 005 / 006 / 010 / 025 / 036 / 038 / 041); the maintainer's triage budget for HIGH-severity content is dominated by the security-content-on-feature-pages family + the default-open-posture cluster + the new activity-partition retention misstatement.
