---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:DataEntityAttachmentController"
node_kind: controller
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-03
---

# DataEntityAttachmentController — semantic understanding

## understanding

`DataEntityAttachmentController` is a thin Spring WebFlux REST controller implementing the OpenAPI-generated `DataEntityAttachmentApi` interface; it exposes the HTTP surface for a data entity's two attachment kinds — uploaded **files** (chunked multipart upload) and external **links** — under `/api/dataentities/{data_entity_id}/{attachments|files|links}*`. Each of its 10 methods delegates a single call to `AttachmentService` and lifts the result into a `200 OK` (or `204 No Content` for deletes) `ResponseEntity`; no validation, authorisation, exception translation, or storage-backend awareness happens at the controller layer. The chunked-upload protocol is a 3-step state machine (initiate → upload-part(s) → complete) keyed by a server-issued `uploadId` UUID — the controller is purely the wire-protocol surface; chunk persistence, recombination, and storage-backend dispatch (`LOCAL` filesystem vs `REMOTE` S3-compatible) happen in `FileServiceImpl` / `FileUploadService` below it.

## concepts

- entities: [`DataEntityAttachments`, `DataEntityFile`, `DataEntityLink`, `DataEntityLinkFormData`, `DataEntityLinkListFormData`, `DataEntityUpload`, `DataEntityUploadFormData`, `DataEntityUploadOptions`, `uploadId` (UUID)]
- operations: [
    `list-data-entity-attachments` (files + links combined, getAttachments — DataEntityAttachmentController.java:31-35),
    `get-upload-options` (returns server-advertised max-file-size in bytes — getUploadOptions — DataEntityAttachmentController.java:38-42),
    `chunked-file-upload` (3-step state machine: `initiateFileUpload` issues a server-side `uploadId` from posted `DataEntityUploadFormData` → `uploadFileChunk` posts each part with `index` and the same `uploadId` → `completeFileUpload` finalises and returns `DataEntityFile` — DataEntityAttachmentController.java:45-70),
    `download-file` (streams a single `DataEntityFile` as `application/octet-stream` with `Content-Disposition: attachment;filename=<name>` — DataEntityAttachmentController.java:73-80),
    `delete-file` (hard-delete by file id — DataEntityAttachmentController.java:83-88),
    `save-links` (bulk create from a `DataEntityLinkListFormData` — DataEntityAttachmentController.java:91-97),
    `update-link` (mutate one link by id — DataEntityAttachmentController.java:100-107),
    `delete-link` (hard-delete one link by id — DataEntityAttachmentController.java:110-115)
  ]
- invariants: [
    "Every endpoint is reactive (`Mono<ResponseEntity<...>>`); the controller never branches on status codes — all non-200/204 responses must be raised by the service layer or by a global Spring exception handler",
    "Chunked-upload session identity is a server-generated UUID (`uploadId`); the controller does not check that the `uploadId` belongs to the same `dataEntityId` provided in the path — the path's `dataEntityId` is effectively ignored on `uploadFileChunk` and `completeFileUpload` (DataEntityAttachmentController.java:54-62, 65-70). The `uploadId` itself is the authoritative session key",
    "The chunk `index` parameter is a `String` at the controller boundary and parsed via `Integer.parseInt` (DataEntityAttachmentController.java:60); a non-numeric `index` raises `NumberFormatException` rather than a translated HTTP 400. Any error mapping happens in a global handler, not here",
    "Delete endpoints return `204 No Content` via `.thenReturn(ResponseEntity.noContent().build())`; success endpoints return `200 OK` via `.map(ResponseEntity::ok)` (DataEntityAttachmentController.java:86-87, 113-114 vs. all other methods)",
    "No `@PreAuthorize` / `@Secured` / Spring Security imports on the controller class itself — RBAC enforcement for write paths is wired one layer up via path-matcher `SecurityRule`s in `SecurityConstants.java:248-276` (POST/PUT/DELETE on `/files/**` and `/links/**` gated by `DATA_ENTITY_ATTACHMENT_MANAGE`); read paths (`getAttachments`, `getUploadOptions`, `downloadFile`) have no `SecurityRule` entry"
  ]
- audiences: [
    "ODD Platform UI — per-entity Attachments tab, drag-and-drop file uploader, link picker (per live doc page, see `documents.inferred_docs[]`)",
    "API consumers building integrations against `/api/dataentities/{id}/attachments`, `/files`, `/links`"
  ]

## dependencies_semantic

- requires-feature: [
    "data-entity attachments feature (live doc: `https://docs.opendatadiscovery.org/features/data-discovery/attachments`)",
    "storage-backend abstraction (`LOCAL` filesystem vs `REMOTE` S3-compatible) — selected by `attachment.storage` config key (application.yml:215-224); the controller is storage-agnostic but its chunk-upload contract assumes a backend can stage chunks indexed by `uploadId` and recombine them on `completeFileUpload`"
  ]
- requires-config: [] (controller itself reads no config keys; `attachment.max-file-size` is consumed by `AttachmentServiceImpl @ L27` and surfaced through `getUploadOptions`)
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<...>>` return types, `ServerWebExchange` parameter, `org.springframework.http.codec.multipart.Part` for chunk bodies (DataEntityAttachmentController.java:19, 21-23)",
    "Reactive multipart codec — `uploadFileChunk` consumes `Mono<Part>` and the service downcasts to `FilePart` to invoke `transferTo(Path)` for chunk persistence (FileServiceImpl.java:58-62)"
  ]
- couples-to: [
    "`DataEntityAttachmentApi` (auto-generated from `odd-platform-specification/openapi.yaml` paths `/api/dataentities/{data_entity_id}/{attachments|files|links}*` — see openapi.yaml:1566-1774) — supplies all `@RequestMapping` HTTP method/path/media-type metadata; method signatures here must match exactly or `@Override` compilation fails",
    "`AttachmentService` (interface) — the only collaborator; constructor-injected via Lombok `@RequiredArgsConstructor` (DataEntityAttachmentController.java:14, 26-28)",
    "`SecurityConstants.SECURITY_RULES` (one layer up in the auth filter chain) — declares `DATA_ENTITY_ATTACHMENT_MANAGE` gates on POST/PUT `/files/**`, DELETE `/files/{file_id}`, POST `/links`, PUT/DELETE `/links/{link_id}` (SecurityConstants.java:247-276); the controller depends on this declaration for write-path authorisation but cannot see the gate from its own file"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "End-to-end chunked-upload protocol test: `initiateFileUpload` → N × `uploadFileChunk` → `completeFileUpload`, verifying that the assembled file matches the input bytes",
    "Cross-entity uploadId hijack: an attacker who knows another tenant's `uploadId` can post chunks via any `dataEntityId` path because the controller never verifies that the `uploadId` belongs to the path's `dataEntityId` (DataEntityAttachmentController.java:54-62, 65-70). No test asserts this invariant either way",
    "Concurrent chunk uploads with the same `index` for the same `uploadId` — `FilePart.transferTo(path.resolve(String.valueOf(index)))` on FileServiceImpl.java:62 will overwrite the prior chunk silently",
    "Storage-backend switching test: same upload sequence against `attachment.storage=LOCAL` vs `attachment.storage=REMOTE` should produce equivalent `DataEntityFile` results",
    "Filename collision test: a second `initiateFileUpload` for an existing fileName on the same dataEntityId raises `BadUserRequestException` per FileServiceImpl.java:47-54, but no controller-level test asserts the resulting HTTP status",
    "Non-numeric `index` query param: a `String` `index` of `\"abc\"` will surface as a `NumberFormatException` (DataEntityAttachmentController.java:60) rather than a translated 400; no test verifies how this is rendered to clients",
    "Download path-traversal: `downloadFile` injects `dto.fileName()` directly into a `Content-Disposition` header (DataEntityAttachmentController.java:77) without sanitisation — no test asserts behaviour for a filename containing CR/LF or quote characters",
    "Read-path authorisation regression: no test asserts that `GET /api/dataentities/{id}/attachments`, `GET /api/dataentities/{id}/files/uploads` (upload options), and `GET /api/dataentities/{id}/files/{file_id}` (download) are reachable by any authenticated user without `DATA_ENTITY_ATTACHMENT_MANAGE` (SecurityConstants.java:247-276 only gates POST/PUT/DELETE)"
  ]
- test_files: [] — N/A (`find <odd-platform> -path '*test*' -name 'DataEntityAttachmentController*'`, `'AttachmentService*Test*'`, `'FileService*Test*'` all returned no matches at enrichment time)
- gaps: |
    The controller is structurally trivial (10 one-line delegations) but the upload protocol it fronts is stateful, multi-call, and security-sensitive. The most likely regressions live below the controller in the chunk-recombination logic, the storage-backend dispatch, and the `uploadId`-to-dataEntityId binding. A `@WebFluxTest(DataEntityAttachmentController.class)` driving `WebTestClient` through the full chunked-upload flow against a `MockAttachmentService` would catch a wide class of OpenAPI-generator / Jackson / WebFlux-codec regressions; an integration test parameterised over `attachment.storage=LOCAL` vs `attachment.storage=REMOTE` (with a localstack / minio test container for the latter) would catch the storage-backend regression class. A security regression test that exercises each endpoint with an authenticated principal lacking `DATA_ENTITY_ATTACHMENT_MANAGE` and asserts which endpoints return 403 vs 200 would lock in the current — possibly-unintentional — read-path posture. Neither currently exists.

## docs_link_semantic

- declared_docs: [] — N/A (the source file carries no `@docs` Javadoc annotation; the `@docs` annotation programme has not been bootstrapped in this repo at enrichment time)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/attachments"
    anchor: ""
    rationale: "Single live page describing the data-entity attachments feature this controller serves; the page enumerates the file-upload UX, link-attachment UX, storage-backend toggle, and RBAC, all of which map onto the controller's endpoints"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Page H1: "Data Entity Attachments"
      Page H2/H3 anchors: `#attaching-a-file`, `#attaching-a-link`, `#editing-and-deleting-attachments`, `#storage-backend-operator-configurable`, `#rbac`, `#where-to-next`.

      Section "Attaching a file":
      - "Drag-and-drop the file into the attachment window, or browse to select"
      - "There is no restriction on file type — images, CSVs, PDFs, TXT files, and any other format are accepted."
      - "The single restriction is **file size**, which is capped at `attachment.max-file-size` megabytes (default `20`)."

      Section "Attaching a link":
      - "To attach a link to a remotely-stored file (or any URL), insert the link and provide a customised display name."
      - "A single data entity can carry **multiple files and multiple links** — the platform does not cap the count."

      Section "Storage backend (operator-configurable)":
      - "LOCAL (default): files written to a local filesystem path inside the platform container. Suitable only for single-host evaluations"
      - "REMOTE: S3-compatible object storage (AWS S3, MinIO, etc.). Required for production deployments."
      - Danger box: "The default `LOCAL` storage mode is ephemeral. Files are written to a local container path that is wiped on any container or pod restart."

      Section "RBAC":
      - "Adding, deleting, and managing attachments on a data entity is gated by the `DATA_ENTITY_ATTACHMENT_MANAGE` permission."
      - The page does not mention audit logging, virus scanning, rate-limiting, or per-user upload quotas.
  - url: "https://docs.opendatadiscovery.org/data-discovery/attachments"
    anchor: ""
    rationale: "Originally suggested by the input prompt as the likely doc URL; verified live and returns 404 — the page lives under `/features/data-discovery/attachments` (with `/features/` prefix), not at the un-prefixed path"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      404 page suggested correct URL: `https://docs.opendatadiscovery.org/features/data-discovery/attachments.md`
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Canonical operator page for ODD's auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) and the ingestion filter — the live security page authoritative for the `auth_mode_relevance` and `ingestion_filter_relevance` fields"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)"
      "`auth.ingestion.filter.enabled` (default `false`)"
      Ingestion filter gates `POST /ingestion/datasources` (always) and `POST /ingestion/entities` (only when filter enabled). Sibling `/ingestion/*` endpoints are NOT covered by the filter.
      Authorization details deferred to `/configuration-and-deployment/enable-security/authorization.md`.
- doc_drift_findings:
  - "Live doc page (`/features/data-discovery/attachments`) does not document the chunked-upload protocol (3-step `initiate` → `chunk` → `complete` state machine) that the API actually uses. The page describes the UX (`Drag-and-drop the file into the attachment window`) but not the wire protocol API consumers must implement. This is an `api-reference` gap, not a feature-page gap — but no `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-entity-attachments` page was checked in this enrichment; a follow-up DOC-NNN should verify whether the api-reference page exists and covers the chunked protocol."
  - "Live doc page asserts `attachment.max-file-size` default is `20` (megabytes) — this matches `application.yml:217` (`max-file-size: 20 # mb`) and matches `AttachmentServiceImpl.java:27` (`@Value(\"${attachment.max-file-size}\")`). No drift here; recorded for symmetry."
  - "The danger box on the live page warning that `LOCAL` storage is ephemeral and wiped on restart is consistent with LSN-001 (`retrospectives/LSN-001-attachment-ephemeral-default.md`) — i.e., the post-LSN-001 doc fix has shipped. Recorded for symmetry; no drift."
  - "Live RBAC section names `DATA_ENTITY_ATTACHMENT_MANAGE` as the permission gating attachment management — confirmed by `SecurityConstants.java:247-276` and `PolicyPermissionDto.java:38`. The doc page does NOT disclose that the gate is asymmetric: the read paths (`GET /attachments`, `GET /files/uploads` upload options, `GET /files/{file_id}` download) carry no permission gate at all and are reachable by any authenticated user. This is a documentation drift in the omission direction — the doc implies attachment access is permission-gated, but only the management (write) paths are. Candidate DOC-NNN follow-up to surface read-path posture explicitly."

## implicit_adrs

- "Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, not on the `*Controller` class itself. The controller carries only `@RestController` + `@RequiredArgsConstructor` and `@Override` on each method." — evidence: DataEntityAttachmentController.java:25-27 (only `@RestController` and `@RequiredArgsConstructor` on the class; no `@RequestMapping`, `@GetMapping`, `@PostMapping`, `@PutMapping`, or `@DeleteMapping` anywhere in the file) + openapi.yaml:1566-1774 (every endpoint's HTTP method/path lives on the spec, generated into `DataEntityAttachmentApi` at build time) — confidence: HIGH
- "Authorisation/RBAC for attachments is enforced **above** the controller, in a path-matcher-driven Spring Security filter chain — not via `@PreAuthorize` on the controller class. The mapping from URL+HTTP-method to `PolicyPermissionDto` lives in a single `SecurityConstants.SECURITY_RULES` declaration; the controller stays annotation-free. This is a deliberate centralisation: every gate is reviewable from one file rather than scattered across controllers, but the trade-off is that the controller is opaque about its own auth posture — a reader must consult `SecurityConstants` to know which endpoints are gated." — evidence: DataEntityAttachmentController.java:1-116 (no Spring Security annotations or imports of Spring Security types) + SecurityConstants.java:247-276 (every write-path matcher mapped to `DATA_ENTITY_ATTACHMENT_MANAGE`) + WebFetch fetched excerpt confirming the live doc has a `#rbac` section naming this exact permission — confidence: HIGH
- "Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type. Success responses are produced via `.map(ResponseEntity::ok)`; the only departure is delete endpoints, which use `.thenReturn(ResponseEntity.noContent().build())` for a 204. No exception translation or status-code branching happens at the controller — all error mapping is global." — evidence: DataEntityAttachmentController.java:30-115 (every method either ends with `.map(ResponseEntity::ok)` or `.thenReturn(ResponseEntity.noContent().build())`; no `.onErrorResume`, no `.switchIfEmpty(... ResponseEntity.notFound() ...)`, no try/catch) — confidence: HIGH
- "The chunked-upload session is keyed by a single server-generated `uploadId` (UUID) shared across `initiateFileUpload`, `uploadFileChunk`, and `completeFileUpload`. The path-bound `dataEntityId` is repeated on every chunk and complete call, but is not cross-checked against the `uploadId`'s originating data entity at the controller layer (or at the `AttachmentServiceImpl` layer — see AttachmentServiceImpl.java:71-78 which forwards `uploadId` only). The `uploadId` is the authoritative session key; the path's `dataEntityId` is effectively cosmetic on `uploadFileChunk` and `completeFileUpload`." — evidence: DataEntityAttachmentController.java:54-62 (`uploadFileChunk` ignores `dataEntityId` after binding it from the path) + DataEntityAttachmentController.java:65-70 (`completeFileUpload` likewise) + AttachmentServiceImpl.java:71-78 (`uploadFileChunk` and `completeFileUpload` forward only the `uploadId`) — confidence: HIGH
- "Read-side endpoints on the attachments surface (`GET /attachments`, `GET /files/uploads` upload options, `GET /files/{file_id}` download) are NOT gated by `DATA_ENTITY_ATTACHMENT_MANAGE` — only authentication is required. The `SecurityConstants.SECURITY_RULES` table maps only POST, PUT, and DELETE for `/files/**` and `/links/**` paths to that permission; GET paths are absent from the table by design or by omission. This is an embodied decision (any authenticated user can list and download any data entity's attachments) but no ADR documents it; it may be intentional read-availability OR a missed gate." — evidence: SecurityConstants.java:247-276 (only POST/PUT/DELETE matchers for `/files/**`, `/links/**`; no GET matchers) + DataEntityAttachmentController.java:31-42, 73-80 (read endpoints have no service-layer authorisation either) — confidence: HIGH

## bugs_limitations_corner_cases

- "Cross-entity `uploadId` re-use: any caller who learns another data entity's `uploadId` can post chunks (and trigger `completeFileUpload`) using a different `dataEntityId` in the URL, because the controller / service chain never verifies the `uploadId` belongs to the path's `dataEntityId`. The chunks land against the original entity (because `FileRepository.getFileByUploadId(uploadId)` resolves by uploadId only — see `checkProcessingUploadById` at FileServiceImpl.java:93-102), so the data-loss surface is bounded, but the URL becomes deceptive: `POST /api/dataentities/42/files/uploads/{X}/chunks` may attach to entity 17 if `X` was issued for entity 17. Severity is bounded by RBAC enforcement at the security-filter layer; a reviewer should validate that the storage-finalisation step also re-authorises against the `uploadId`'s original data entity." — evidence: DataEntityAttachmentController.java:54-62, 65-70 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:93-102 — severity: MEDIUM
- "Concurrent chunks with the same `index` for the same `uploadId` race-overwrite each other silently. `FilePart.transferTo(path.resolve(String.valueOf(index)))` (FileServiceImpl.java:62) is a last-writer-wins file write keyed by `index`; if a client retries a failed chunk while the first attempt is still flushing, both writes target the same path. The controller exposes no idempotency token beyond `index`. A retry-after-partial-write pattern can produce a corrupt assembled file with no error surfaced." — evidence: DataEntityAttachmentController.java:54-62 + FileServiceImpl.java:58-67 — severity: MEDIUM
- "`downloadFile` injects the database-stored filename directly into the `Content-Disposition` header (DataEntityAttachmentController.java:77: `\"attachment;filename=\" + dto.fileName()`) with no sanitisation, no quoting, and no `filename*=UTF-8''...` encoding. A filename containing a CR/LF allows header injection; a filename with non-ASCII characters renders inconsistently across browsers; a filename with `\"` or `;` truncates the header value. The filename originates from `DataEntityUploadFormData.fileName` posted at `initiateFileUpload`, so it is fully attacker-controlled. Severity bounded by which clients consume this endpoint and what RBAC gates uploads upstream." — evidence: DataEntityAttachmentController.java:73-80 + FileServiceImpl.java:41-55 (filename round-trips from `DataEntityUploadFormData.getFileName()` to storage to `dto.fileName()`) — severity: MEDIUM
- "No controller-level test (`@WebFluxTest(DataEntityAttachmentController.class)` or `WebTestClient`) exists for any of the 10 endpoints. A breaking change to the OpenAPI generator template, the WebFlux multipart codec, or the Jackson serialiser config could silently break the entire attachments surface with the build still passing. The chunked-upload protocol — being stateful and multi-call — is the highest-value target for a wired integration test." — evidence: `find <odd-platform> -path '*test*' -name 'DataEntityAttachmentController*'` and sibling searches returned no matches at enrichment time — severity: MEDIUM
- "When `attachment.storage=LOCAL` (the default per application.yml:216), large file uploads exhaust container disk **without** the application-level `attachment.max-file-size` cap protecting the host. The cap is per-file (default 20 MB per AttachmentServiceImpl.java:61, surfaced through `getUploadOptions`) but is enforced at the upload-options surface — a malicious or misbehaving client can ignore the advertised cap and stream chunks beyond it, because the controller does not enforce the cap on `uploadFileChunk`. With `LOCAL` storage's chunk path being a container-local filesystem at `/tmp/odd/attachments` (application.yml:218-219), aggregate disk-fill is a denial-of-service surface that is invisible to the operator until the container OOMs the disk. LSN-001 recorded the data-loss flavour of this same default; the disk-exhaustion flavour is its sibling and is not currently captured in the docs' danger box." — evidence: DataEntityAttachmentController.java:54-62 (no size enforcement) + AttachmentServiceImpl.java:60-62 (cap returned via `getUploadOptions`, not enforced on chunks) + application.yml:215-219 (`storage: LOCAL`, `local.path: /tmp/odd/attachments`) + retrospectives/LSN-001-attachment-ephemeral-default.md — severity: HIGH
- "The chunk `index` is bound as `String` and parsed via `Integer.parseInt` (DataEntityAttachmentController.java:60). A non-numeric `index` raises `NumberFormatException` from inside a reactor flatMap, surfacing as whatever a global exception handler maps it to — likely `500 Internal Server Error` rather than a `400 Bad Request`. The OpenAPI spec at openapi.yaml:1635-1640 declares `index` with `contentType: application/json` (untyped at the spec level), so the loose `String` binding is a generator artefact, not a maintainer choice — but it leaks an unfriendly error response." — evidence: DataEntityAttachmentController.java:54-62 + openapi.yaml:1635-1640 — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — this is a UI/API surface controller mounted under `/api/dataentities/...`, so the three modes that protect interactive sessions apply. `DISABLED` skips authentication entirely (every endpoint reachable without a principal); `S2S` is irrelevant here because S2S applies only to `/ingestion/*` paths (see `ingestion_filter_relevance` below). The controller itself contains no `@ConditionalOnProperty(value="auth.type", ...)`; the auth-mode coupling lives in the `OAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` beans that build the `SecurityWebFilterChain` and inject `SecurityConstants.SECURITY_RULES`. Evidence: DataEntityAttachmentController.java:1-116 (controller is auth-mode-agnostic) + SecurityConstants.java:95-96 (`WHITELIST_PATHS` is `/actuator/**, /favicon.ico, /ingestion/**, /img/**, /api/slack/events` — `/api/dataentities/...` is NOT whitelisted, so the active auth filter chain applies under all three protected modes) + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-08 status 200 (live page lists `DISABLED / LOGIN_FORM / OAUTH2 / LDAP`).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. All 10 endpoints are mounted under `/api/dataentities/{data_entity_id}/...` per openapi.yaml:1566-1774 + DataEntityAttachmentController.java:31, 38, 45, 54, 65, 73, 83, 91, 100, 110. `auth.ingestion.filter.enabled` (live doc: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`) gates only `POST /ingestion/entities`; this controller is unaffected.
- **authorization_assertions**: [
    "`DATA_ENTITY_ATTACHMENT_MANAGE` on `POST /api/dataentities/{data_entity_id}/files/**` (covers `initiateFileUpload`, `uploadFileChunk`)" — evidence: SecurityConstants.java:247-251,
    "`DATA_ENTITY_ATTACHMENT_MANAGE` on `PUT /api/dataentities/{data_entity_id}/files/**` (covers `completeFileUpload`)" — evidence: SecurityConstants.java:252-256,
    "`DATA_ENTITY_ATTACHMENT_MANAGE` on `DELETE /api/dataentities/{data_entity_id}/files/{file_id}` (covers `deleteFile`)" — evidence: SecurityConstants.java:257-261,
    "`DATA_ENTITY_ATTACHMENT_MANAGE` on `POST /api/dataentities/{data_entity_id}/links` (covers `saveLinks`)" — evidence: SecurityConstants.java:262-266,
    "`DATA_ENTITY_ATTACHMENT_MANAGE` on `PUT /api/dataentities/{data_entity_id}/links/{link_id}` (covers `updateLink`)" — evidence: SecurityConstants.java:267-271,
    "`DATA_ENTITY_ATTACHMENT_MANAGE` on `DELETE /api/dataentities/{data_entity_id}/links/{link_id}` (covers `deleteLink`)" — evidence: SecurityConstants.java:272-276,
    "NO authorization gate on `GET /api/dataentities/{data_entity_id}/attachments` (`getAttachments`) — only authentication required" — evidence: SecurityConstants.java:247-276 (no GET matchers for `/attachments`, `/files`, or `/files/{file_id}`),
    "NO authorization gate on `GET /api/dataentities/{data_entity_id}/files/uploads` (`getUploadOptions`) — only authentication required" — evidence: SecurityConstants.java:247-276,
    "NO authorization gate on `GET /api/dataentities/{data_entity_id}/files/{file_id}` (`downloadFile`) — only authentication required" — evidence: SecurityConstants.java:247-276 + DataEntityAttachmentController.java:73-80 (no programmatic check) + AttachmentServiceImpl.java:81-83 (service forwards to `fileService.downloadFile(fileId)` with no caller-identity check)
  ]
  All gates are `DATA_ENTITY` context (per `AuthorizationManagerType.DATA_ENTITY` declared on each rule, SecurityConstants.java:248, 253, 258, 263, 268, 273) — i.e., the policy is evaluated against the data entity referenced in the path, so a user with `DATA_ENTITY_ATTACHMENT_MANAGE` for one data entity cannot manage attachments on another.
- **owner_scoping**: `BYPASSES — read endpoints return data without owner filtering`. `getAttachments` (DataEntityAttachmentController.java:31-35) calls `attachmentService.getDataEntityAttachments(dataEntityId)` which fans out to `fileService.getDataEntityFiles(dataEntityId)` and `linkService.getDataEntityLinks(dataEntityId)` (AttachmentServiceImpl.java:34-42); neither call accepts a principal or filters by ownership. Same for `downloadFile` (DataEntityAttachmentController.java:73-80 → AttachmentServiceImpl.java:81-83). Combined with the missing-GET-gate observation (above), any authenticated user can read every data entity's attachments and download every file — the only access control is "are you logged in". Whether this is intentional read-availability (consistent with `getAttachments` being on the public Data Entity detail page) or a missed gate is the maintainer's call; the present sidecar surfaces it as embodied behaviour, not a design intent.
- **data_exposure**: [
    "DataEntityAttachments payload (files: List<DataEntityFile>, links: List<DataEntityLink>) including filename, size, upload metadata → any authenticated user, no owner / permission filter applied" — evidence: DataEntityAttachmentController.java:31-35 + AttachmentServiceImpl.java:34-42,
    "Raw file bytes (Resource → application/octet-stream) with attacker-supplied `Content-Disposition` filename → any authenticated user, no owner / permission filter applied" — evidence: DataEntityAttachmentController.java:73-80 + AttachmentServiceImpl.java:81-83,
    "Server-advertised max upload size in bytes via `DataEntityUploadOptions.maxSize` → any authenticated user (low-sensitivity, but reveals operator config)" — evidence: DataEntityAttachmentController.java:38-42 + AttachmentServiceImpl.java:60-62,
    "PII risk on download: attachments may contain customer data uploaded by privileged users; the download endpoint exposes all of it to every authenticated user" — evidence: DataEntityAttachmentController.java:73-80 (no gate) + live doc `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 (page describes general-purpose file attachments — `images, CSVs, PDFs, TXT files`)
  ]
- **known_security_gaps**: [
    "Read-path authorization asymmetry: `DATA_ENTITY_ATTACHMENT_MANAGE` is enforced on POST/PUT/DELETE under `/files/**` and `/links/**`, but no `SecurityRule` covers GET. Any authenticated user can list (`getAttachments`) and download (`downloadFile`) any data entity's attachments. The live doc page's RBAC section discloses the management gate but is silent on read-side posture — operators reading the doc may infer that all attachment access is permission-gated when only writes are." — evidence: SecurityConstants.java:247-276 (only POST/PUT/DELETE matchers) + DataEntityAttachmentController.java:31-35, 73-80 (no programmatic gate at controller) + AttachmentServiceImpl.java:34-42, 81-83 (no programmatic gate at service) + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 — severity: HIGH",
    "No audit logging on attachment download. `downloadFile` (DataEntityAttachmentController.java:73-80) and `getAttachments` (DataEntityAttachmentController.java:31-35) do not log the requesting principal, the file id, or the data entity id. An exfiltrating insider leaves no application-side trace; reverse-engineering `who-downloaded-what` requires reading reverse-proxy access logs (where present) and correlating session ids — not feasible at scale. The live doc page does not surface this." — evidence: DataEntityAttachmentController.java:31-35, 73-80 + AttachmentServiceImpl.java:34-42, 81-83 (no `@Slf4j` field, no `log.info` calls in either class) — severity: MEDIUM",
    "No virus / malware scanning on upload. `initiateFileUpload`, `uploadFileChunk`, and `completeFileUpload` accept and persist arbitrary file bytes (DataEntityAttachmentController.java:45-70 → AttachmentServiceImpl.java:65-78 → FileServiceImpl); the storage backends (LOCAL filesystem and REMOTE S3-compatible) are passive byte sinks. The live doc page advertises 'There is no restriction on file type — images, CSVs, PDFs, TXT files, and any other format are accepted' which is technically accurate but doubles as a green-light for malware upload onto the platform's filesystem or object store. Downloaded later via the unauthorised-by-permission GET path, the artefact becomes a delivery vector." — evidence: DataEntityAttachmentController.java:45-70 + AttachmentServiceImpl.java:65-78 + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 — severity: MEDIUM",
    "Server-side `attachment.max-file-size` cap is advertised via `getUploadOptions` (a UI hint) but NOT enforced on the chunked-upload path. The chunk endpoint accepts unbounded byte streams; only the final assembled-file consumer might reject oversized files (depending on FileServiceImpl behaviour, which is below this controller). Cross-link to the consumer at AttachmentServiceImpl @ L27 sidecar's HIGH-severity gap on the same default. With LOCAL storage default, this is a host-disk DOS; with REMOTE storage, this is a bandwidth / S3-cost amplification." — evidence: DataEntityAttachmentController.java:54-62 (no size check) + AttachmentServiceImpl.java:60-62 (cap surfaced, not enforced) + cross-reference: `lineage/odd-platform/understanding/odd-platform__java__org_opendatadiscovery_oddplatform_service_attachment__attachmentserviceimpl.md` — severity: HIGH",
    "Cross-entity `uploadId` hijack (also recorded under `bugs_limitations_corner_cases[0]`): a user with `DATA_ENTITY_ATTACHMENT_MANAGE` on data entity X who learns another user's `uploadId` Y issued for data entity Z can post chunks and complete the upload via `POST /api/dataentities/X/files/uploads/Y/chunks`. The path-matcher gate evaluates `DATA_ENTITY` context against entity X (which the caller has permission for), but the file lands against entity Z (which the caller may NOT have permission for). The asymmetry is: the security filter authorises the path's data entity, the service forwards to the uploadId's data entity. This is a privilege-misalignment more than a privilege-escalation (the caller already has SOME attachment-manage permission), but it allows a permitted user to attach files to entities they don't manage." — evidence: DataEntityAttachmentController.java:54-62, 65-70 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:93-102 + SecurityConstants.java:247-256 (gate keyed on path's `data_entity_id`) — severity: MEDIUM",
    "`Content-Disposition` filename injection on download: `\"attachment;filename=\" + dto.fileName()` (DataEntityAttachmentController.java:77) is unsanitised. CR/LF in filename → HTTP response splitting; quote/semicolon → header truncation. Filename is attacker-controlled (originates from `DataEntityUploadFormData.fileName` at upload). Severity bounded by browser hardening against response-splitting on TLS connections; still a defence-in-depth gap." — evidence: DataEntityAttachmentController.java:73-80 + FileServiceImpl.java:41-55 — severity: MEDIUM"
  ]

## performance

- **hot_paths**: [
    "`downloadFile` (DataEntityAttachmentController.java:73-80) is on the user-interactive critical path — every UI download click invokes one request that streams a `Resource` through a reactive pipeline. Latency on this path is dominated by the storage backend: LOCAL filesystem → page-cache-bounded; REMOTE S3-compatible → one S3 GetObject per request" — evidence: DataEntityAttachmentController.java:73-80 + AttachmentServiceImpl.java:81-83,
    "`uploadFileChunk` (DataEntityAttachmentController.java:54-62) runs once per chunk per upload — for an N-MB file at default chunk size, this is N invocations on the request critical path; chunk persistence dispatches through `FileServiceImpl.uploadFileChunk` to `FilePart.transferTo(path)`" — evidence: DataEntityAttachmentController.java:54-62 + AttachmentServiceImpl.java:71-73 + FileServiceImpl.java:58-62,
    "`getAttachments` (DataEntityAttachmentController.java:31-35) runs on every entity-detail page load (Attachments tab). It executes two parallel reactive reads via `Mono.zip(dataEntityFiles, dataEntityLinks)` — one DB query per side, joined in memory" — evidence: DataEntityAttachmentController.java:31-35 + AttachmentServiceImpl.java:34-42
  ]
- **throughput_characteristics**: [
    "Chunked upload: 3-step state machine (initiate → N × upload-part → complete) supports multi-part transfers per openapi.yaml:1582-1668. Each chunk is a separate HTTP `POST /api/dataentities/{id}/files/uploads/{upload_id}/chunks` request — there is no single-request multi-chunk batch endpoint" — evidence: openapi.yaml:1618-1645 + DataEntityAttachmentController.java:54-62,
    "Single-file download per request: no range-request support is declared in openapi.yaml:1669-1690, no `Accept-Ranges` header is set in `downloadFile` (DataEntityAttachmentController.java:76-79). Resuming an interrupted download requires re-fetching the full file" — evidence: DataEntityAttachmentController.java:73-80 + openapi.yaml:1669-1690,
    "Bulk-create on links: `saveLinks` accepts `DataEntityLinkListFormData` (a list) and persists in one call (DataEntityAttachmentController.java:91-97) — single-request multi-link create. Updates and deletes on links are single-item per request" — evidence: DataEntityAttachmentController.java:91-115,
    "All endpoints are reactive `Mono`/`Flux` — non-blocking on the server I/O thread, but each request still issues at least one downstream call (DB or storage); the controller does not pipeline or coalesce"
  ]
- **resource_allocation**: [
    "`uploadFileChunk` streams via `FilePart.transferTo(Path)` (FileServiceImpl.java:58-62) — chunk-bounded memory: each chunk is held in an off-heap buffer for the duration of the transfer, then released. Aggregate memory pressure scales with concurrent in-flight chunks, NOT with total upload size" — evidence: DataEntityAttachmentController.java:54-62 + FileServiceImpl.java:58-62,
    "`downloadFile` returns a `Resource` (Spring core abstraction) wrapped in `application/octet-stream` (DataEntityAttachmentController.java:76-79). For LOCAL storage, this is a `FileSystemResource` over the filesystem — kernel-bounded memory via NIO. For REMOTE storage, this is whatever the MinIO / S3 adapter returns — typically a streaming response, but per-request HTTP client allocation depends on whether the MinIO client is pooled (cross-link to `MinioConfig` sidecar; not present in this repo at enrichment time)" — evidence: DataEntityAttachmentController.java:73-80,
    "`getAttachments` zips two `Mono<List<...>>` reads in memory (AttachmentServiceImpl.java:34-42). For a data entity with thousands of attachments, the assembled `DataEntityAttachments` payload is fully materialised before serialisation — no streaming response. There is no pagination at the API surface (openapi.yaml:1566-1581 declares no `page`/`size` query params)" — evidence: AttachmentServiceImpl.java:34-42 + openapi.yaml:1566-1581,
    "`getUploadOptions` allocates a fresh `DataEntityUploadOptions` per request (AttachmentServiceImpl.java:60-62) — trivially cheap; the value is config-driven and could be cached at startup but isn't"
  ]
- **scaling_characteristics**: [
    "Stateless controller — instances scale horizontally; no in-memory session state, no controller-local caches" — evidence: DataEntityAttachmentController.java:25-28 (only an injected service collaborator),
    "Chunked-upload session state lives BELOW the controller, in the storage backend keyed by `uploadId`. For LOCAL storage, this is a per-instance filesystem path (application.yml:218-219 `local.path: /tmp/odd/attachments`) — chunks staged on instance A cannot be completed by instance B without a shared volume. For REMOTE storage (S3-compatible), the staging area is shared object storage by construction. A horizontally-scaled deployment with LOCAL storage will produce intermittent failures whenever the load balancer routes `uploadFileChunk` and `completeFileUpload` to different instances" — evidence: DataEntityAttachmentController.java:54-62, 65-70 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:58-67 + application.yml:215-219 (LOCAL is the default per `attachment.storage` config) + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 (live doc says LOCAL is `Suitable only for single-host evaluations`),
    "No pagination anywhere on the surface — `getAttachments` returns the full list per data entity (DataEntityAttachmentController.java:31-35); response time grows O(N) with attachment count. The live doc page asserts `A single data entity can carry multiple files and multiple links — the platform does not cap the count` (WebFetch 2026-05-08), so the count is operator-bounded only by storage" — evidence: DataEntityAttachmentController.java:31-35 + openapi.yaml:1566-1581 (no pagination params declared),
    "No request-level concurrency limit on `uploadFileChunk` — a malicious client can interleave thousands of in-flight chunks against a single `uploadId`. The controller does not throttle (DataEntityAttachmentController.java:54-62 has no rate-limit annotation or interceptor)"
  ]
- **known_performance_gaps**: [
    "No client-side resume protocol: `downloadFile` does not honour `Range` requests (DataEntityAttachmentController.java:73-80 sets a fixed `application/octet-stream` body, no `Accept-Ranges` header). A user on a flaky connection downloading a 20 MB attachment must restart from byte 0 on each retry. The default `attachment.max-file-size` is 20 MB but operators routinely raise it; on a 200 MB attachment the user-visible reliability is poor" — evidence: DataEntityAttachmentController.java:73-80 — severity: MEDIUM",
    "Chunk uploads are sequential per-upload by protocol shape (one `uploadFileChunk` request per chunk); a multi-threaded client could parallelise distinct chunks on different connections, but the protocol does not declare ordering guarantees and the storage layer (FileServiceImpl.java:58-62) writes chunks to a path keyed by `index` with last-writer-wins semantics. Parallel chunk upload is not a documented pattern and the index-collision behaviour is silently wrong (cross-ref `bugs_limitations_corner_cases[1]`)" — evidence: DataEntityAttachmentController.java:54-62 + FileServiceImpl.java:58-62 — severity: LOW",
    "LOCAL storage is the default (`application.yml:215-219`) and is documented as 'Suitable only for single-host evaluations' (live doc 2026-05-08). On a horizontally-scaled deployment, this default produces upload failures when chunks land on instance A and complete lands on instance B. The performance gap is correctness-adjacent: the fast path (single instance) is fine; the multi-instance path is broken. LSN-001 captured the data-loss flavour of this default; the multi-instance-completion flavour is its sibling" — evidence: application.yml:215-219 + AttachmentServiceImpl.java:71-78 (forwards uploadId to FileServiceImpl) + FileServiceImpl.java:58-67 (chunks resolved via filesystem path) + retrospectives/LSN-001-attachment-ephemeral-default.md — severity: HIGH",
    "REMOTE storage (S3-compatible) HTTP client allocation: when `attachment.storage=REMOTE`, every `uploadFileChunk` and `downloadFile` request dispatches through whatever MinIO / S3 client `FileServiceImpl` (or its REMOTE-backend collaborator) is wired to. If that client is allocated per-request rather than pooled, the controller's reactive throughput is bottlenecked on TCP handshake overhead. This sidecar cannot confirm pooling without reading the REMOTE-backend bean factory; cross-link to `MinioConfig` sidecar pending" — evidence: DataEntityAttachmentController.java:54-62, 73-80 + AttachmentServiceImpl.java:71-83 (forwards to FileService; REMOTE-backend wiring not in this controller's scope) — severity: MEDIUM",
    "`getAttachments` materialises both the file list and the link list fully in memory before zipping — `Mono.zip` on AttachmentServiceImpl.java:37 holds both reads' results before the assembled `DataEntityAttachments` payload streams out. For an entity with thousands of attachments, this is a memory spike per request; combined with no pagination on the API surface, this is a denial-of-service surface against the platform itself" — evidence: AttachmentServiceImpl.java:34-42 + openapi.yaml:1566-1581 (no pagination params) — severity: MEDIUM"
  ]

## sources

- understanding ← DataEntityAttachmentController.java:1-116 (full file; the four-sentence claim mirrors the file's actual shape — 10 one-line delegating methods, no annotations beyond `@RestController` + `@RequiredArgsConstructor` + `@Override`) + AttachmentServiceImpl.java:1-89 (storage-backend dispatch happens here, not at the controller) + FileServiceImpl.java:1-103 (chunk persistence + recombination)
- concepts.entities ← DataEntityAttachmentController.java:6-13 (imports of `DataEntityAttachments`, `DataEntityFile`, `DataEntityLink`, `DataEntityLinkFormData`, `DataEntityLinkListFormData`, `DataEntityUpload`, `DataEntityUploadFormData`, `DataEntityUploadOptions`) + DataEntityAttachmentController.java:55, 66 (`UUID uploadId`)
- concepts.operations ← DataEntityAttachmentController.java:31, 38, 45, 54, 65, 73, 83, 91, 100, 110 (one operation per method)
- concepts.invariants[0] ← DataEntityAttachmentController.java:31, 38, 45, 54, 65, 73, 83, 91, 100, 110 (every method returns `Mono<ResponseEntity<...>>`); DataEntityAttachmentController.java:34, 41, 50, 61, 69, 76-79, 87, 96, 106, 114 (every terminal operator is `.map(ResponseEntity::ok)` or `.thenReturn(ResponseEntity.noContent().build())`)
- concepts.invariants[1] ← DataEntityAttachmentController.java:54-62, 65-70 (`uploadFileChunk` and `completeFileUpload` ignore `dataEntityId` after binding from the path) + AttachmentServiceImpl.java:71-78 (the service likewise forwards only `uploadId`)
- concepts.invariants[2] ← DataEntityAttachmentController.java:57, 60 (`String index` parsed via `Integer.parseInt`)
- concepts.invariants[3] ← DataEntityAttachmentController.java:87 (`.thenReturn(ResponseEntity.noContent().build())` in `deleteFile`) + DataEntityAttachmentController.java:114 (same in `deleteLink`); contrast with `.map(ResponseEntity::ok)` everywhere else
- concepts.invariants[4] ← DataEntityAttachmentController.java:1-116 (no Spring Security annotations or imports on controller class) + SecurityConstants.java:247-276 (write-path gates wired one layer up via `SECURITY_RULES`) + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08 status 200 fetched-excerpt anchor `#rbac`
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` (status 200, 2026-05-08) — fetched excerpts under `documents.inferred_docs[0].fetched_excerpts`
- dependencies_semantic.requires-feature ← WebFetch attachments page (status 200, 2026-05-08) + application.yml:215-224 (`storage: LOCAL # LOCAL, REMOTE`)
- dependencies_semantic.requires-runtime ← DataEntityAttachmentController.java:19-23 (`org.springframework.http.codec.multipart.Part`, `Mono`, `Flux`, `ServerWebExchange`) + FileServiceImpl.java:58-62 (`FilePart.transferTo`)
- dependencies_semantic.couples-to[0,1] ← DataEntityAttachmentController.java:5 (`import ... DataEntityAttachmentApi`), 14 (`import ... AttachmentService`), 26-28 (`@RequiredArgsConstructor`, `implements DataEntityAttachmentApi`, `final AttachmentService attachmentService`) + openapi.yaml:1566-1774 (the spec source for the generated interface)
- dependencies_semantic.couples-to[2] ← SecurityConstants.java:247-276 (the gate declaration that the controller depends on but does not import)
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name 'DataEntityAttachmentController*'`, `'AttachmentService*Test*'`, `'FileService*Test*'` returned no matches (run during enrichment session 2026-05-08)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/attachments` 2026-05-08, status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/data-discovery/attachments` 2026-05-08, status 404 (404 stub redirected to the `/features/...` URL)
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-08, status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch attachments page 2026-05-08 (no chunked-upload mention in fetched excerpts) + DataEntityAttachmentController.java:45-70 (the chunked-upload state machine the doc does not describe)
- docs_link_semantic.doc_drift_findings[1] ← WebFetch attachments page fetched excerpt (`max-file-size` default `20`) + application.yml:217 (`max-file-size: 20 # mb`) + AttachmentServiceImpl.java:27, 60-62
- docs_link_semantic.doc_drift_findings[2] ← WebFetch attachments page fetched excerpt (danger box on `LOCAL` ephemerality) + retrospectives/LSN-001-attachment-ephemeral-default.md
- docs_link_semantic.doc_drift_findings[3] ← WebFetch attachments page fetched excerpt (RBAC section names `DATA_ENTITY_ATTACHMENT_MANAGE`) + SecurityConstants.java:247-276 (only POST/PUT/DELETE matchers; GET unprotected)
- implicit_adrs[0] ← DataEntityAttachmentController.java:25-27 + openapi.yaml:1566-1774 (HTTP method/path on the spec, generated onto the `*Api` interface)
- implicit_adrs[1] ← DataEntityAttachmentController.java:1-116 (no security annotations or imports) + SecurityConstants.java:247-276 (the actual gate declaration) + WebFetch fetched-excerpt confirming `#rbac` is a live-doc anchor describing user-facing RBAC
- implicit_adrs[2] ← DataEntityAttachmentController.java:30-115 (uniform terminal operators `.map(ResponseEntity::ok)` / `.thenReturn(ResponseEntity.noContent().build())`)
- implicit_adrs[3] ← DataEntityAttachmentController.java:54-62, 65-70 + AttachmentServiceImpl.java:71-78
- implicit_adrs[4] ← SecurityConstants.java:247-276 (table only contains POST/PUT/DELETE matchers for `/files/**` and `/links/**`) + DataEntityAttachmentController.java:31-35, 73-80 (no programmatic gate at controller) + AttachmentServiceImpl.java:34-42, 81-83 (no programmatic gate at service)
- bugs_limitations_corner_cases[0] ← DataEntityAttachmentController.java:54-62, 65-70 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:93-102 (`checkProcessingUploadById` resolves only by `uploadId`)
- bugs_limitations_corner_cases[1] ← DataEntityAttachmentController.java:54-62 + FileServiceImpl.java:58-67 (`FilePart.transferTo(path.resolve(String.valueOf(index)))`)
- bugs_limitations_corner_cases[2] ← DataEntityAttachmentController.java:73-80 + FileServiceImpl.java:41-55 (filename originates from `DataEntityUploadFormData.getFileName()`)
- bugs_limitations_corner_cases[3] ← `find` searches for test files (returned no matches)
- bugs_limitations_corner_cases[4] ← DataEntityAttachmentController.java:54-62 + AttachmentServiceImpl.java:60-62 + application.yml:215-219 + retrospectives/LSN-001-attachment-ephemeral-default.md
- bugs_limitations_corner_cases[5] ← DataEntityAttachmentController.java:54-62 + openapi.yaml:1635-1640
- security.auth_mode_relevance ← DataEntityAttachmentController.java:1-116 + SecurityConstants.java:95-96 (WHITELIST_PATHS) + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-08 status 200
- security.ingestion_filter_relevance ← openapi.yaml:1566-1774 (path mounting) + DataEntityAttachmentController.java:31, 38, 45, 54, 65, 73, 83, 91, 100, 110 + WebFetch enable-security page 2026-05-08
- security.authorization_assertions ← SecurityConstants.java:247-276 (six DATA_ENTITY_ATTACHMENT_MANAGE gates on POST/PUT/DELETE) + DataEntityAttachmentController.java:31-35, 38-42, 73-80 (read endpoints at controller) + AttachmentServiceImpl.java:34-42, 60-62, 81-83 (read endpoints at service)
- security.owner_scoping ← DataEntityAttachmentController.java:31-35, 73-80 + AttachmentServiceImpl.java:34-42, 81-83 (no caller-identity parameter, no ownership filter)
- security.data_exposure ← DataEntityAttachmentController.java:31-35, 38-42, 73-80 + AttachmentServiceImpl.java:34-42, 60-62, 81-83 + WebFetch attachments page 2026-05-08 (file types accepted)
- security.known_security_gaps[0] (read-path asymmetry) ← SecurityConstants.java:247-276 + DataEntityAttachmentController.java:31-35, 73-80 + AttachmentServiceImpl.java:34-42, 81-83 + WebFetch attachments page 2026-05-08
- security.known_security_gaps[1] (no audit logging) ← DataEntityAttachmentController.java:31-35, 73-80 + AttachmentServiceImpl.java:34-42, 81-83 (no `@Slf4j`, no logging on read)
- security.known_security_gaps[2] (no virus scanning) ← DataEntityAttachmentController.java:45-70 + AttachmentServiceImpl.java:65-78 + WebFetch attachments page 2026-05-08
- security.known_security_gaps[3] (max-size not enforced on chunks) ← DataEntityAttachmentController.java:54-62 + AttachmentServiceImpl.java:60-62 + cross-link to AttachmentServiceImpl @ L27 sidecar
- security.known_security_gaps[4] (cross-entity uploadId hijack) ← DataEntityAttachmentController.java:54-62, 65-70 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:93-102 + SecurityConstants.java:247-256
- security.known_security_gaps[5] (Content-Disposition injection) ← DataEntityAttachmentController.java:73-80 + FileServiceImpl.java:41-55
- performance.hot_paths ← DataEntityAttachmentController.java:31-35, 54-62, 73-80 + AttachmentServiceImpl.java:34-42, 71-73, 81-83 + FileServiceImpl.java:58-62
- performance.throughput_characteristics ← openapi.yaml:1582-1668, 1669-1690 + DataEntityAttachmentController.java:54-62, 73-80, 91-115
- performance.resource_allocation ← DataEntityAttachmentController.java:54-62, 65-70, 73-80, 38-42 + AttachmentServiceImpl.java:34-42, 60-62 + FileServiceImpl.java:58-62 + openapi.yaml:1566-1581
- performance.scaling_characteristics ← DataEntityAttachmentController.java:25-28, 31-35, 54-62, 65-70 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:58-67 + application.yml:215-219 + WebFetch attachments page 2026-05-08 (LOCAL `Suitable only for single-host evaluations`) + openapi.yaml:1566-1581
- performance.known_performance_gaps[0] (no Range support) ← DataEntityAttachmentController.java:73-80
- performance.known_performance_gaps[1] (sequential chunks) ← DataEntityAttachmentController.java:54-62 + FileServiceImpl.java:58-62
- performance.known_performance_gaps[2] (LOCAL multi-instance) ← application.yml:215-219 + AttachmentServiceImpl.java:71-78 + FileServiceImpl.java:58-67 + retrospectives/LSN-001-attachment-ephemeral-default.md
- performance.known_performance_gaps[3] (REMOTE pool unconfirmed) ← DataEntityAttachmentController.java:54-62, 73-80 + AttachmentServiceImpl.java:71-83
- performance.known_performance_gaps[4] (no pagination on getAttachments) ← AttachmentServiceImpl.java:34-42 + openapi.yaml:1566-1581

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence-of-tests claim is verified by the file-system search, not inferred)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source, so links are inferred; the primary URL was WebFetched live and confirmed 200, the input prompt's suggested URL was confirmed 404, but the binding controller→doc is the enricher's judgment)
- implicit_adrs: HIGH (every claim is structural — visible in the cited source files at the cited lines)
- bugs_limitations_corner_cases: HIGH (each claim is anchored in observable source at a cited line; none rely on dynamic-only behaviour)
- security: HIGH (auth-mode relevance, ingestion-filter relevance, and authorization assertions all anchored in `SecurityConstants.java:95-96, 247-276` and the controller/service files; gaps anchored in present-or-absent code at cited lines; doc-side claims anchored in WebFetch results)
- performance: HIGH (hot-paths and throughput-characteristics anchored in the controller + service + openapi.yaml; scaling-characteristics' multi-instance LOCAL gap anchored in application.yml + the live doc page's own statement; the one MEDIUM-confidence sub-claim — REMOTE client pooling — is explicitly flagged as unconfirmed pending the `MinioConfig` sidecar)

## Maintainer notes

</content>
</invoke>