---
artefact: doc-gaps
generated_at: "2026-05-10T00:00:00Z"
generated_at_commit: ede5d277
sidecar_count: 20
concepts_yaml_version: 2
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 35
findings_by_severity: { HIGH: 14, MEDIUM: 16, LOW: 5 }
findings_by_category: { broken-url: 6, missing-anchor: 0, drift: 16, missing-page: 6, stale-page: 0, coverage-gap: 7 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
---

# Doc gaps — odd-platform — 2026-05-10

## Summary

- **Findings**: 35 total (14 HIGH, 16 MEDIUM, 5 LOW)
- **By category**: broken-url 6, drift 16, missing-page 6, coverage-gap 7
- **By feature** (top affected concepts): Data Entity (5), Attachment (5), Alert (4), Activity Feed (4 — new in 2026-05-10A), AlertManager Webhook Receiver (3), GenAI Assistant (3), Slack collaboration app (3 — new in 2026-05-10A), Collector / Collector Token (2 — new in 2026-05-10A), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). 7 HIGH findings are LSN-001/LSN-002-class operator-impact gaps. Batch 2026-05-10A method-level sidecars promoted DOC-GAP-025 (was LOW, now HIGH) with direct evidence; extended DOC-GAP-002 + DOC-GAP-010 with method-level reinforcement (no new findings — Rule 4 dedup).
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface (e.g. "Alerts feature" page does not warn that every auth'd user sees every alert; "Activity Feed" page does not warn that every auth'd user reads cross-owner audit trails).
  - **Doc-text-vs-code audience drift** (new pattern, 2026-05-10A): the live alerting doc names "stewards and admins" as the All-tab audience while code enforces "any authenticated user" — this is a *prescriptive-doc-vs-permissive-code* mismatch. Code change OR doc change can resolve; the doc-vs-code drift itself is the finding.
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
