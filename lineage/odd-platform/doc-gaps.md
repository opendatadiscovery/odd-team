---
artefact: doc-gaps
generated_at: "2026-05-08T19:29:26Z"
generated_at_commit: ede5d277
sidecar_count: 15
concepts_yaml_version: 1
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 27
findings_by_severity: { HIGH: 10, MEDIUM: 13, LOW: 4 }
findings_by_category: { broken-url: 5, missing-anchor: 0, drift: 11, missing-page: 4, stale-page: 0, coverage-gap: 7 }
---

# Doc gaps — odd-platform — 2026-05-08

## Summary

- **Findings**: 27 total (10 HIGH, 13 MEDIUM, 4 LOW)
- **By category**: broken-url 5, drift 11, missing-page 4, coverage-gap 7
- **By feature** (top affected concepts): Data Entity (5), Attachment (5), Alert (3), AlertManager Webhook Receiver (3), GenAI Assistant (3), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). 6 HIGH findings are LSN-001/LSN-002-class operator-impact gaps.
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface (e.g. "Alerts feature" page does not warn that every auth'd user sees every alert).
  - URL-prefix drift: numerous workspace-internal references use un-prefixed legacy URLs (`/active-platform-features/*`, `/data-discovery/*`, `/main-concepts`); GitBook serves them as 404 stubs that point to the canonical `/features/...` or `/introduction/...` paths. Cross-links inside the codebase pointing at the legacy paths are dead.
  - The api-reference subtree covers `directory` + `lineage` + `alerts` + others, but no `data-entities` page exists — the 40 dataEntity operations are punted to Swagger UI on the index page. This is a coverage-gap, not a missing-page (an index exists, just doesn't enumerate ops).

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

- **DOC-GAP-002**: Alerting feature page does not warn that `getAllAlerts` exposes every platform alert to any authenticated user
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:security.known_security_gaps.[1]` (severity HIGH)
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:security.known_security_gaps.[0]`
    - `odd-platform__openapi__tags__openapi-tag__alert.md:security.known_security_gaps.[0]`
    - `concepts.yaml:entities[Alert].security_aggregate.weaknesses.[0,1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-08 status 200 — confirmed: "no explicit access-control documentation exists" for `getAllAlerts`; "no parallel guidance on whether unauthenticated or non-owner users can access the `All` tab or `getAllAlerts` endpoint."
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — page lists `GET /api/alerts` and notes `My Objects`/`Dependents` require Owner-link, but does NOT warn that the `All` listing exposes every alert to every authenticated user; under `auth.type=DISABLED` it is anonymously reachable.
    - AlertController.md confirms zero `@PreAuthorize` and no SECURITY_RULES entry for `/api/alerts*`.
  - **Proposed doc action**: Add a "Visibility scope" admonition to `features/active-platform-features/alerting.md` and to `developer-guides/api-reference/alerts.md`: "`getAllAlerts` (`GET /api/alerts`) returns the entire platform's alert population to any authenticated user — there is no role/permission gate. Under `auth.type=DISABLED` the endpoint is anonymously reachable. If your deployment requires admin-only visibility on the `All` tab, gate the endpoint at the network layer or front the platform with a permission-aware reverse proxy." Mirror on `changeAlertStatus`: any authenticated user can mutate any alert by id.
  - **Cross-references**:
    - LSN-001/LSN-002 class — operator follows doc trusting that "Alerts feature" is owner-scoped, deploys with no auth-mode-DISABLED expectation
    - F-053 (advisory locks) — same family of "operationally relevant default unsurfaced"
  - **Severity rationale**: HIGH — alert content carries entity identifiers, severity, slack-style messages; multi-tenant deployments leak cross-tenant alert metadata under default config.

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
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-08 status 200 — Attachment Storage Configuration section frames `attachment.max-file-size` as a per-file cap with `spring.codec.max-in-memory-size` interaction described as the WebFlux codec layer failure mode. Does NOT disclose the cap is enforced ONLY client-side (UI filter) — no service-layer re-validation in `AttachmentServiceImpl`, `DataEntityAttachmentController`, or `FileServiceImpl`.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` confirms the page asserts "The single restriction is **file size**, which is capped at `attachment.max-file-size` megabytes (default `20`)" — operator reasonably believes server enforces.
    - AttachmentServiceImpl@L27.md sidecar verifies absence of server-side enforcement.
  - **Proposed doc action**: Add to both pages (config + feature) a Known-limitations admonition: "**Server-side enforcement**: the `attachment.max-file-size` cap is enforced in the UI (the file-picker filters before upload). The chunked-upload API does not re-validate per-chunk or aggregate size, so a non-browser caller with `DATA_ENTITY_ATTACHMENT_MANAGE` can submit arbitrarily-large files. Operators who need a hard server-side cap must enforce it via `spring.codec.max-in-memory-size` (which fails the request at the WebFlux codec layer with `DataBufferLimitException`) or at the network layer."
  - **Cross-references**:
    - F-056 (`spring.codec.max-in-memory-size` undocumented) — fix in same content area
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
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-08 status 200 — page enumerates sub-pages: Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships. NO `data-entities` sub-page exists; page directs readers to Swagger UI at `{platform-base-url}/api/v3/api-docs`.
    - openapi-tag-dataEntity.md verifies the dataEntity tag groups ~40 operations.
    - SUMMARY.md verifies absence: no `developer-guides/api-reference/data-entities.md` entry.
  - **Proposed doc action**: Create `developer-guides/api-reference/data-entities.md` enumerating the 40 operations grouped by functional area (Catalog navigation, Lineage, Tags, Terms, Statuses, Description, Metadata, Activity, Messages, Alerts config, Group management, Internal name). Add to SUMMARY.md under the API Reference section. Cross-link from `features/data-discovery.md` and from the Permissions page.
  - **Cross-references**:
    - F-019 historic (pre-resolution) — the API-reference under-coverage class
  - **Severity rationale**: HIGH — every API consumer building an integration writes against the dataEntity operations; punting them to Swagger UI mismatches the platform's stated API-reference surface.

- **DOC-GAP-010**: Attachment chunked-upload protocol (3-step state machine) undocumented anywhere
  - **Category**: coverage-gap
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:concepts.operations.[chunked-file-upload]`
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:docs_link_semantic.doc_drift_findings.[0]`
    - `concepts.yaml:operations[Chunked File Upload (3-step state machine)]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 — describes UX (drag-and-drop) but NOT the wire protocol API consumers must implement.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-08 — no `data-entity-attachments` sub-page.
    - SUMMARY.md confirms absence of `developer-guides/api-reference/data-entity-attachments.md`.
  - **Proposed doc action**: Either create `developer-guides/api-reference/data-entity-attachments.md` or add a "Wire protocol" H2 to `features/data-discovery/attachments.md` documenting: (1) `POST /api/dataentities/{id}/files/uploads` issues `uploadId` UUID; (2) `POST /api/dataentities/{id}/files/uploads/{uploadId}/chunks` with `index` query param posts each chunk; (3) `POST /api/dataentities/{id}/files/uploads/{uploadId}/complete` finalises and returns DataEntityFile. Note that `uploadId` is the authoritative session key — the path's dataEntityId on chunk/complete is effectively cosmetic; the cross-entity uploadId-hijack caveat (severity MEDIUM, sidecar's known_security_gaps) belongs in the same section.
  - **Cross-references**:
    - DOC-GAP-009 (api-reference under-coverage) — same family
  - **Severity rationale**: HIGH — every integration uploading attachments via API has to reverse-engineer the protocol from the OpenAPI spec; the live page's "drag-and-drop" prose is misleading for non-browser callers.

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
    - DOC-GAP-012, DOC-GAP-013, DOC-GAP-014, DOC-GAP-015 (same URL-prefix-drift class — surface once, list together)
  - **Severity rationale**: MEDIUM — operators clicking external links to the un-prefixed URL hit a 404 stub; GitBook's redirect-suggestion stub mitigates but doesn't eliminate the friction.

- **DOC-GAP-012**: Legacy URL `/active-platform-features/genai` returns 404 — canonical at `/features/active-platform-features/genai`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:docs_link_semantic.doc_drift_findings.[0]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/genai` 2026-05-08 status 404 — suggests `https://docs.opendatadiscovery.org/features/active-platform-features/genai.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/genai` 2026-05-08 status 200.
  - **Proposed doc action**: Same as DOC-GAP-011 — cross-link audit and correction.
  - **Cross-references**: DOC-GAP-011 (same class).
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-013**: Legacy URL `/data-discovery/attachments` returns 404 — canonical at `/features/data-discovery/attachments`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:docs_link_semantic.inferred_docs.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/data-discovery/attachments` 2026-05-08 status 404 — suggests `/features/data-discovery/attachments.md`.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200.
  - **Proposed doc action**: Same as DOC-GAP-011.
  - **Cross-references**: DOC-GAP-011 (same class).
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
  - **Cross-references**: DOC-GAP-011, F-039 (resolved upstream but legacy-URL references linger).
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
  - **Cross-references**: DOC-GAP-011 (same class). The "Data Entity" canonical glossary entry that the openapi-tag-dataEntity sidecar wanted to verify lives at the canonical URL.
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
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-08 status 200 — page punts readers to Swagger UI but does not warn that the spec's auth / role / scope information is absent.
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
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — describes list endpoints as "Paginated list" but provides no parameters, page-size guidance, or response-size caveats.
    - Verified: spec encodes `page`, `size` as int32 with no min/max/default at `components.yaml:4213-4229`. A spec-conformant `size=2147483647` is permissible.
  - **Proposed doc action**: Add a "Pagination" section to `developer-guides/api-reference.md` (parent page) noting: "All paginated endpoints accept `page` and `size` as required `Integer` query parameters. The spec declares no upper bound on `size`; runtime behaviour is determined by the service / repository layer, not by the contract. Callers should pass conservative values (e.g. `size <= 1000`). Future contract revisions should add `maximum` constraints."
  - **Cross-references**:
    - DOC-GAP-018 (spec-level coverage gaps in same family)
  - **Severity rationale**: MEDIUM.

- **DOC-GAP-023**: Cross-entity uploadId hijack (Attachment) — undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:security.known_security_gaps` (severity MEDIUM)
    - `concepts.yaml:entities[Attachment].security_aggregate.weaknesses.[3]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 — RBAC section names DATA_ENTITY_ATTACHMENT_MANAGE but does not surface that the gate authorises the path's data entity while the service forwards by uploadId; a user with permission on entity X who learns another user's uploadId Y issued for entity Z can post chunks via `POST /api/dataentities/X/files/uploads/Y/chunks`.
    - DataEntityAttachmentController.md surfaces this as severity MEDIUM.
  - **Proposed doc action**: Fold into the DOC-GAP-010 (chunked-upload protocol) authoring — when documenting the wire protocol, explicitly call out that uploadId is the authoritative session key and the path's dataEntityId is cosmetic on chunk/complete; recommend that operators implementing custom integrations validate upload session ownership at the application layer.
  - **Cross-references**: DOC-GAP-010 (combine).
  - **Severity rationale**: MEDIUM — requires path-mismatch + cross-user uploadId leak; less impactful than DOC-GAP-004 but worth surfacing.

### LOW severity

- **DOC-GAP-024**: OpenAPI tag `alert` has no `description:` field and no `externalDocs.url` — Swagger UI / ReDoc consumers see unannotated tag
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:docs_link_semantic.doc_drift_findings.[0,2]`
  - **Evidence**:
    - openapi-tag-alert.md verifies: spec's `alert` tag declaration is `name: alert` only (openapi.yaml:30); no description, no externalDocs.
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08 status 200 — the doc page exists; the spec just doesn't link to it from the tag.
  - **Proposed doc action**: Add `description:` and `externalDocs:` to the `alert` tag in `odd-platform-specification/openapi.yaml`. Mirror for the `dataEntity` tag. This is an upstream `odd-platform-specification` change; file via `/log-issue opendatadiscovery-specification`.
  - **Cross-references**: None.
  - **Severity rationale**: LOW — cosmetic tooling concern; doc page exists.

- **DOC-GAP-025**: `getDataEntityActivity` exposes audit trail to any authenticated user — undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `concepts.yaml:entities[Data Entity].security_aggregate.weaknesses.[2]`
  - **Evidence**:
    - DataEntityController.md verifies: `getDataEntityActivity` is in the 27+ ungated read endpoints list — no role/owner gate.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` was not run in this session (out of scope of the 15 sidecars surfacing the gap); inferring the same coverage gap from the per-entity activity surface that DataEntityController exposes.
  - **Proposed doc action**: Once DOC-GAP-002 / DOC-GAP-008 / DOC-GAP-009 are authored (per-feature visibility-scope admonitions), include the activity-feed surface in the same family. Suggest adding to the activity-feed feature page: "Per-entity activity feed (`/api/dataentities/{id}/activity`) is gated by authentication only; any authenticated user can read who-changed-what audit trail for any data entity."
  - **Cross-references**: DOC-GAP-002, DOC-GAP-008.
  - **Severity rationale**: LOW (per the substrate's relative ranking; the broader DataEntity concept's gap is already HIGH).

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

## Concept-without-page candidates (from concepts.yaml × SUMMARY.md)

Concepts surfaced by the substrate that are not registered as canonical terms in `main-concepts.md`. Some have a doc home (a section on a config page); others have none.

| Concept | canonical_candidate | Axes present | Contributing nodes | Suggested doc home | Notes |
|---|---|---|---|---|---|
| Locale Bundle / Multilingual UI | true | ui_shell | 2 | `configuration-and-deployment/i18n.md` or `features/i18n.md` | F-047 already filed; LSN-013 case-law; six locales invisible to users + contributors |
| Attachment | true | controllers, config_prefixes | 3 | Already has page at `features/data-discovery/attachments.md` and config section; missing only as a canonical term in `main-concepts.md` | LSN-001 + LSN-002 case-law live here |
| Attachment Storage Backend | true | config_prefixes | 1 | Already documented as a section on `configuration-and-deployment/odd-platform.md`; canonical_candidate suggested_add_to_docs:false (concept too operationally-narrow for main-concepts) | DOC-GAP-006 attaches |
| AlertManager Webhook Receiver | true | controllers | 1 | Has a section on `configuration-and-deployment/odd-platform.md`; missing as canonical term in main-concepts.md (DOC-GAP-019) | suggested_add_to_docs: true |
| ODD API Consumer (audience) | true | controllers, openapi_tags | 6 | `main-concepts.md` audience vocabulary | suggested_add_to_docs: true; named in 6 sidecars |
| Prometheus AlertManager (audience) | true | controllers | 1 | `main-concepts.md` audience vocabulary; cross-link with DOC-GAP-019 | suggested_add_to_docs: false (the receiver itself is the visible concept) |

## Coverage-gap candidates (high-fan-out concepts × api-reference depth)

| Concept | Operations / surface | Documented count | Gap | Suggested action |
|---|---|---|---|---|
| Data Entity | 40 controller operations under `/api/dataentities/*` (concepts.yaml entry; DataEntityController + DataEntityAttachmentController + openapi-tag:dataEntity + DirectoryController) | 0 (api-reference index punts to Swagger UI) | All 40 ops undocumented as a per-tag api-reference subpage | DOC-GAP-009 — create `developer-guides/api-reference/data-entities.md` |
| Attachment | 10 ops (chunked-upload protocol + list + edit + delete + download) | 0 (no api-reference page exists) | Wire protocol absent everywhere | DOC-GAP-010 — create page or extend feature page |
| Alert | 5 platform endpoints + 4 per-entity in dataEntity tag + AlertManager webhook | 9 + 1 enumerated on `/developer-guides/api-reference/alerts` | Auth-mode + visibility-scope caveats absent | DOC-GAP-002 — admonition on alerts feature + api-reference |
| Directory | 4 ops | 4 (api-reference page exists) | Owner-scoping / authz caveat absent | DOC-GAP-008 — admonition on directory feature page |
| GenAI | 1 op | 1 (feature page documents the contract) | Security caveats absent | DOC-GAP-007 — security-caveats H2 |
| Multilingual UI / Locale Bundle | 2 ops (changeLanguage, bootstrap) | 0 (no doc page) | F-047 (filed) | DOC-NNN per F-047 |
| AlertManager Webhook Receiver | 1 op | 1 (operator-facing config section) | Caveats absent + concept not registered as canonical term | DOC-GAP-003 + DOC-GAP-019 |

## Stale-page candidates (SUMMARY.md × concepts.yaml — pages with no surfaced concept)

(Empty section — the substrate is currently undercoverage with 15 sidecars across a much larger codebase. The risk is substrate-coverage-gap, not stale-page; flag for re-enrichment of unsurfaced areas instead. Documentation-side stale-page identification requires substrate parity that is not yet achieved at slice 7+.)

## Maintainer notes

(Free-form. Preserved across refreshes. Empty on first run.)
