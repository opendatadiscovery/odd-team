---
node_id: "odd-platform java DataEntityAttachmentController controller-class:DataEntityAttachmentController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-V
---

# DataEntityAttachmentController — semantic understanding

## understanding

`DataEntityAttachmentController` is a thin Spring WebFlux REST controller implementing the OpenAPI-generated `DataEntityAttachmentApi` interface; it is the HTTP surface for a data entity's two attachment kinds — uploaded **files** (chunked multipart upload) and external **links** — under `/api/dataentities/{data_entity_id}/{attachments|files|links}*`. Each of its 10 methods delegates a single call to `AttachmentService` and lifts the result into a `200 OK` (or `204 No Content` on deletes) `ResponseEntity`; no validation, authorisation, exception translation, file-name sanitization, or storage-backend awareness happens at the controller layer. Authorization for write operations is wired declaratively at the WebFilter layer (`SecurityConstants.SECURITY_RULES` matching `/api/dataentities/{data_entity_id}/files/**` and `/links/**` for POST/PUT/DELETE → `DATA_ENTITY_ATTACHMENT_MANAGE`); read operations (`getAttachments`, `getUploadOptions`, `downloadFile`) have no rule and rely on the global authentication filter alone.

## concepts

- entities: [`DataEntityAttachments`, `DataEntityFile`, `DataEntityLink`, `DataEntityLinkFormData`, `DataEntityLinkListFormData`, `DataEntityUpload`, `DataEntityUploadFormData`, `DataEntityUploadOptions`, `uploadId` (UUID), `dataEntityId` (long), `fileId` (long), `linkId` (long)]
- operations: [
    `list-data-entity-attachments` (files + links combined for one dataEntityId — getAttachments — DataEntityAttachmentController.java:31-35),
    `get-upload-options` (returns server-advertised maxSize in bytes — DataEntityAttachmentController.java:38-42; computed in service as `maxFileSize * 1_000_000`),
    `chunked-file-upload` (3-step state machine: `initiateFileUpload` issues a server-side `uploadId` UUID from posted `DataEntityUploadFormData{fileName}` → `uploadFileChunk` posts each `Part` with integer `index` and the same `uploadId` → `completeFileUpload` recombines and returns `DataEntityFile` — DataEntityAttachmentController.java:45-70),
    `download-file` (streams `Resource` as `application/octet-stream` with `Content-Disposition: attachment;filename=<dto.fileName()>` — DataEntityAttachmentController.java:73-80),
    `delete-file` (hard-delete by fileId — DataEntityAttachmentController.java:83-88),
    `save-links` (bulk-create from `DataEntityLinkListFormData{items[]}` — DataEntityAttachmentController.java:91-97),
    `update-link` (mutate one link by linkId — DataEntityAttachmentController.java:100-107),
    `delete-link` (delete one link by linkId — DataEntityAttachmentController.java:110-114)
  ]
- invariants: [
    "thin-delegate convention: every method is a single `attachmentService.X(...).map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for void responses) — no business logic at controller layer",
    "the chunked-upload state is server-owned: clients do not choose the `uploadId`; it is a random UUID minted by `FileUploadService.initiateUpload()`",
    "`dataEntityId` is a path parameter on every method but is only used by `getAttachments` / `getUploadOptions` / `initiateFileUpload` / `saveLinks` — the file/link mutation methods (`deleteFile`, `updateLink`, `deleteLink`, `completeFileUpload`, `downloadFile`) accept the dataEntityId in the path purely for URL hierarchy and do not pass it to the service (DataEntityAttachmentController.java:65-114) — see implicit_adrs"
  ]
- audiences: ["authenticated UI users browsing a data entity Overview tab", "any HTTP client authenticated through Spring Security WebFlux"]

## dependencies_semantic

- requires-feature: [
    "AttachmentService (delegate) — `service.attachment.AttachmentService` (interface) + `AttachmentServiceImpl` — orchestrates `FileService` and `LinkService`",
    "FileService (downstream of AttachmentService) — file lifecycle on top of a `FileUploadService` strategy",
    "LinkService — pure JDBC-backed CRUD over links table; no storage backend"
  ]
- requires-config: [
    "`attachment.storage` (LOCAL or REMOTE, default LOCAL via `matchIfMissing=true` on the LOCAL beans) — selects the `FileUploadService` and `FilePathConstructor` implementations (LocalFilePathConstructor.java:13, LocalFileUploadServiceImpl.java:26, RemoteFilePathConstructor.java:10, RemoteFileUploadServiceImpl.java:36)",
    "`attachment.max-file-size` (megabytes, default 20) — surfaced verbatim via `getUploadOptions` (multiplied by 1_000_000 to bytes; AttachmentServiceImpl.java:27-28, AttachmentServiceImpl.java:60-62)",
    "`attachment.local.path` (default `/tmp/odd/attachments`) — LOCAL base directory; validated non-empty at boot (LocalFilePathConstructor.java:15-23)",
    "`attachment.remote.url` / `access-key` / `secret-key` / `bucket` — REMOTE mode credentials and bucket (MinioConfig.java:12-17, RemoteFileUploadServiceImpl.java:39-50)"
  ]
- requires-runtime: [
    "Spring WebFlux reactive HTTP layer (Mono/Flux/ServerWebExchange)",
    "Spring Security WebFilter chain configured with the path-pattern matchers in `SecurityConstants.SECURITY_RULES` for the `DATA_ENTITY_ATTACHMENT_MANAGE` permission (SecurityConstants.java:247-276)",
    "local filesystem writable at `/tmp/odd/chunks` for chunked-upload staging (FileUtils.java:24 — hard-coded constant `CHUNK_BASE_PATH = \"/tmp/odd/chunks\"`, even when `attachment.storage=REMOTE`)",
    "Postgres for `file` and `link` tables (via `FileRepository` + `LinkRepository`)",
    "MinIO/S3-compatible endpoint reachable at `attachment.remote.url` when `attachment.storage=REMOTE`"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "chunked-upload happy path (initiate → multiple chunks → complete) for both LOCAL and REMOTE backends",
    "duplicate-fileName rejection at `initiateFileUpload` (FileServiceImpl.java:47-54 — only test of `BadUserRequestException` in the path)",
    "`uploadFileChunk` non-FilePart rejection (FileServiceImpl.java:64-67 — `BadUserRequestException(\"Uploaded multipart is not a file\")`)",
    "`uploadFileChunk` / `completeFileUpload` with a non-PROCESSING uploadId (FileServiceImpl.java:93-102)",
    "`downloadFile` 404 path when fileId does not exist (FileServiceImpl.java:88 — `NotFoundException`)",
    "`DATA_ENTITY_ATTACHMENT_MANAGE` permission enforcement for POST/PUT/DELETE on attachments — no integration test confirms a 403 is returned to an unauthorised user",
    "cross-data-entity file/link access (e.g. PUT /api/dataentities/123/files/{file_id_belonging_to_999} — does the service reject the mismatched dataEntityId? — see bugs_limitations_corner_cases)",
    "REMOTE-mode S3 bucket not pre-created or unreachable — does the error surface to the user or get swallowed?",
    "filename containing path traversal characters (`../`), control characters, leading dot, NUL bytes — see bugs_limitations_corner_cases"
  ]
- test_files: []
- gaps: |
    Zero unit or integration tests exercise this controller's path or the
    chunked-upload state machine. A regression that breaks `initiateFileUpload`,
    `uploadFileChunk`, or `completeFileUpload` — or that breaks the
    `DATA_ENTITY_ATTACHMENT_MANAGE` wiring on the path-pattern matchers in
    `SecurityConstants` — would ship undetected. The chunk-recombination
    sort-by-integer-parsed-filename in `FileUtils.listFilesInOrder`
    (FileUtils.java:43-49) is particularly fragile: a chunk file whose name
    does not parse as an integer (e.g. a stray `.tmp` file in
    `/tmp/odd/chunks/<uploadId>/`) throws `NumberFormatException` wrapped as
    `RuntimeException` and aborts the upload mid-flight.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/data-discovery/attachments"
    anchor: ""
    rationale: "Feature page for data entity attachments — operator + user guidance for both files and links; cites RBAC via DATA_ENTITY_ATTACHMENT_MANAGE; declares the LOCAL-is-ephemeral hint."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "Operators and users can attach **files and links** to any data entity to carry additional context — runbook PDFs, sample CSVs, dashboard screenshots, links to internal wikis, ticketing references."

      "The default `LOCAL` storage mode is ephemeral. Files are written to a local container path that is wiped on any container or pod restart — routine deployment, node drain, crash, Kubernetes eviction. Use `REMOTE` (S3 / MinIO) storage for any deployment where users will actually upload attachments."

      "There is no restriction on file type — images, CSVs, PDFs, TXT files, and any other format are accepted. The single restriction is **file size**, which is capped at `attachment.max-file-size` megabytes (default `20`). Files larger than the cap are rejected by the upload API."

      "Adding, deleting, and managing attachments on a data entity is gated by the `DATA_ENTITY_ATTACHMENT_MANAGE` permission."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#attachment-storage-configuration"
    rationale: "Operator-side configuration reference for attachment.storage / attachment.local.path / attachment.max-file-size / attachment.remote.*; live page confirmed to enumerate LOCAL ephemeral warning, REMOTE caveats, max-in-memory-size cap, us-east-1 region pin (LSN-001 + LSN-002 remediation surfaces)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "ODD Platform allows users to attach files and links to data entities from the UI. This section covers the operator-facing configuration for **where** those uploaded files are stored."

      "The default `LOCAL` storage mode is ephemeral. Attachments are written to `/tmp/odd/attachments` inside the ODD Platform container filesystem. Any container or pod restart — routine deployment, node drain, crash, Kubernetes eviction — permanently deletes all uploaded files."

      "spring.codec.max-in-memory-size acts as a transport-layer ceiling and must equal or exceed attachment.max-file-size"

      "AWS S3 region is pinned to us-east-1 when using the remote backend"
- doc_drift_findings:
  - "The user-facing feature page claims 'no restriction on file type' (data-discovery/attachments.md:23) — code confirms this is literally true: no MIME-type check, no extension allowlist, no magic-byte sniffing exists anywhere in `AttachmentServiceImpl`, `FileServiceImpl`, `LocalFileUploadServiceImpl`, or `RemoteFileUploadServiceImpl`. The doc statement matches the code, but the security posture this implies (operators trust authenticated users to upload anything, including HTML/JS/SVG which the browser may execute on download) is not surfaced as a caveat — see bugs_limitations_corner_cases.gap-mime-allowlist."
  - "The user-facing feature page says 'A single data entity can carry **multiple files and multiple links** — the platform does not cap the count' (data-discovery/attachments.md:37) — code confirms no count limit anywhere; however, the platform also imposes no quota per-entity, per-user, or platform-wide. A single authenticated user with DATA_ENTITY_ATTACHMENT_MANAGE on any one data entity can fill the storage backend without bound — not surfaced as a caveat. See bugs_limitations_corner_cases.gap-no-quota."
  - "No doc page mentions filename sanitization or the lack thereof. Code at FileServiceImpl.java:50-51 propagates the user-supplied `fileName` raw into the storage path (via `pathConstructor.getFilePath`) and into the `Content-Disposition` header on download (DataEntityAttachmentController.java:77). No doc covers what happens for filenames containing `..`, `/`, `\\`, control characters, or non-ASCII — see bugs_limitations_corner_cases.gap-filename-sanitization."

## implicit_adrs

- "Authorization for attachment writes is enforced declaratively at the WebFilter layer via path-pattern matchers, not by controller-level @PreAuthorize annotations or programmatic checks in `AttachmentService`." — evidence: SecurityConstants.java:247-276 (six `SecurityRule` entries for `/api/dataentities/{data_entity_id}/files/**` POST/PUT, `/files/{file_id}` DELETE, `/links` POST, `/links/{link_id}` PUT/DELETE, all gated by `DATA_ENTITY_ATTACHMENT_MANAGE`) + DataEntityAttachmentController.java:1-116 (zero authorization annotations) — intent_anchor: "`new SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/dataentities/{data_entity_id}/files/**\", POST), DATA_ENTITY_ATTACHMENT_MANAGE)`" — confidence: HIGH

- "Storage backend (LOCAL filesystem vs REMOTE S3-compatible) is selected by Spring `@ConditionalOnProperty` on each implementation bean — exactly one `FileUploadService` and one `FilePathConstructor` exist at runtime, and `LOCAL` is the default-on stance via `matchIfMissing=true`." — evidence: LocalFilePathConstructor.java:13 (`@ConditionalOnProperty(value = \"attachment.storage\", havingValue = \"LOCAL\", matchIfMissing = true)`) + LocalFileUploadServiceImpl.java:26 (same) + RemoteFilePathConstructor.java:10 (`havingValue = \"REMOTE\"`) + RemoteFileUploadServiceImpl.java:36 (same) — intent_anchor: "`@ConditionalOnProperty(value = \"attachment.storage\", havingValue = \"LOCAL\", matchIfMissing = true)`" — confidence: HIGH

- "Chunked-upload protocol is intentionally 3-step (initiate → upload-part(s) → complete) with a server-issued `uploadId` UUID — clients cannot inject their own upload identifier, and an upload in `PROCESSING` state is the only one accepting new chunks or completion." — evidence: FileServiceImpl.java:41-55 (initiate creates UUID + persists PROCESSING row) + FileServiceImpl.java:58-67 (uploadFileChunk routes through checkProcessingUploadById) + FileServiceImpl.java:69-76 (complete routes through same) + FileServiceImpl.java:93-102 (`checkProcessingUploadById` rejects non-PROCESSING with `BadUserRequestException`) — intent_anchor: "`if (!pojo.getStatus().equals(PROCESSING.getCode())) { sink.error(new BadUserRequestException(\"There is no processing upload with id %s\".formatted(uploadId))); }`" — confidence: HIGH

- "REMOTE-mode bucket is required at boot; an empty string fails fast with `IllegalStateException`." — evidence: RemoteFileUploadServiceImpl.java:45-50 (`@PostConstruct validate() { if (StringUtils.isEmpty(bucket)) throw new IllegalStateException(\"Bucket can't be empty\"); }`) — intent_anchor: "`throw new IllegalStateException(\"Bucket can't be empty\");`" — confidence: HIGH

- "LOCAL-mode base path is required at boot; an empty string fails fast — `LOCAL` is a deliberate, explicit choice even though it is the default." — evidence: LocalFilePathConstructor.java:18-23 (`@PostConstruct validate() { if (StringUtils.isEmpty(basePath)) throw new IllegalStateException(\"Local base path property can't be empty\"); }`) — intent_anchor: "`throw new IllegalStateException(\"Local base path property can't be empty\");`" — confidence: HIGH

- "Duplicate file-name-per-data-entity is rejected at initiate time, not at complete time — the platform treats (dataEntityId, fileName) as a logical primary key for visible files." — evidence: FileServiceImpl.java:47-54 (`fileRepository.getFileByDataEntityAndName(...).handle((pojo, sink) -> { if (pojo != null) sink.error(new BadUserRequestException(\"File with name %s already exists for this data entity\".formatted(...))); })`) — intent_anchor: "`\"File with name %s already exists for this data entity\".formatted(fileMetadata.getFileName())`" — confidence: HIGH

- "The controller hierarchical URL (`/api/dataentities/{data_entity_id}/files/{file_id}`) is layout-only; mutation operations on a specific file or link do NOT verify that the file/link actually belongs to the data entity in the path." — evidence: DataEntityAttachmentController.java:83-87 (`deleteFile` accepts `dataEntityId` in the path but only passes `fileId` to `attachmentService.deleteFile(fileId)` — `dataEntityId` is discarded) + DataEntityAttachmentController.java:100-107 (`updateLink` same — discards `dataEntityId`) + DataEntityAttachmentController.java:110-114 (`deleteLink` same) + DataEntityAttachmentController.java:65-70 (`completeFileUpload` same) + DataEntityAttachmentController.java:73-80 (`downloadFile` same — uses only `fileId`) — intent_anchor: "method signatures consistently accept `final Long dataEntityId` then never reference it in the body — repeated across 5 methods" — confidence: MEDIUM (the pattern is *applied consistently* — that is the convention — but no comment defends the choice; this could equally be classified as a corner-case; recorded here because the consistency is the signal of intent and the WebFilter path-matcher catches authorization at the dataEntity granularity for the management permission)

## bugs_limitations_corner_cases

- "READ operations (`GET /api/dataentities/{id}/attachments`, `GET .../files/uploads`, `GET .../files/{file_id}` download) have NO `SecurityRule` in `SecurityConstants.java` — they fall back to the global authentication filter only. Any authenticated user (including the lowest-privilege role) can list AND download files attached to ANY data entity, regardless of owner or role." — evidence: SecurityConstants.java:247-276 (only POST/PUT/DELETE matchers for `/files/**` and `/links/**`; no GET matcher) + DataEntityAttachmentController.java:31-42, 73-80 (read methods with no annotations) — severity: HIGH

- "File-name is propagated raw from the user-supplied `DataEntityUploadFormData.fileName` into (a) the storage path (`Paths.get(basePath, dataEntityId, fileName)` for LOCAL, S3 object key for REMOTE) and (b) the `Content-Disposition` header on download. There is no sanitization, no rejection of path-traversal characters (`..`, `/`, `\\`), no NUL-byte filter, no length cap, no quoting/encoding of the header value. A filename like `../../../etc/odd-secret.txt` resolves outside `attachment.local.path` for LOCAL writes/reads; a filename containing CRLF could inject headers on download (RFC 6266 quoting is absent)." — evidence: FileMapper.java:30-31 (`filePojo.setName(fileMetadata.getFileName()); filePojo.setPath(pathConstructor.getFilePath(fileMetadata.getFileName(), dataEntityId));`) + LocalFilePathConstructor.java:31-33 (`return getFileDirectory(dataEntityId).resolve(fileName).toString();`) + DataEntityAttachmentController.java:76-79 (`.header(HttpHeaders.CONTENT_DISPOSITION, \"attachment;filename=\" + dto.fileName())`) — severity: HIGH

- "No MIME-type validation or file-type allowlist anywhere in the upload path. The platform stores HTML, SVG, JS, executables, archives with no inspection; on `downloadFile` the response is forced to `application/octet-stream` (DataEntityAttachmentController.java:78), which mitigates browser-side execution of stored files on the download path — but the same files are also reachable via direct S3/MinIO URL or filesystem path if operators expose the storage backend, where the original extension governs MIME serving." — evidence: DataEntityAttachmentController.java:1-116 (no MIME check) + AttachmentServiceImpl.java:1-89 (none) + FileServiceImpl.java:1-103 (none) + LocalFileUploadServiceImpl.java:1-79 (none) + RemoteFileUploadServiceImpl.java:1-141 (none) — severity: MEDIUM (mitigated for in-platform download by forced octet-stream; remains a concern for direct backend access and for stored-XSS via filename rendering — see F-004)

- "No per-user or per-data-entity quota on attachment count or cumulative size; the only ceiling is `attachment.max-file-size` PER FILE. An authenticated user with DATA_ENTITY_ATTACHMENT_MANAGE on one data entity can upload N files of 20 MB each indefinitely until the storage backend fills." — evidence: FileServiceImpl.java:33-103 (no count/sum check) + AttachmentServiceImpl.java:59-62 (max-size returned as per-file limit only) — severity: MEDIUM

- "Mutation endpoints discard `dataEntityId` from the URL: `DELETE /api/dataentities/{A}/files/{file_id}` will delete `file_id` even if it belongs to data entity B. Authorization on the management permission is granted per-data-entity (`DATA_ENTITY` AuthorizationManagerType, SecurityConstants.java:248), so a user with MANAGE on entity A but NOT entity B can delete entity B's files by issuing the request through entity A's URL. Same for `updateLink`, `deleteLink`, `downloadFile`, `completeFileUpload`." — evidence: DataEntityAttachmentController.java:83-88 + DataEntityAttachmentController.java:100-107 + DataEntityAttachmentController.java:110-114 + DataEntityAttachmentController.java:73-80 + DataEntityAttachmentController.java:65-70 + AttachmentServiceImpl.java:71-88 (service methods take only fileId/linkId) — severity: HIGH (cross-entity privilege escalation via URL spoofing — directly related to REFACTOR-024 cross-owner enumeration class)

- "`/tmp/odd/chunks` is a HARD-CODED constant (FileUtils.java:24) regardless of `attachment.storage` mode. When operators run with `attachment.storage=REMOTE` and configure S3/MinIO for persistence, the chunk staging path still uses `/tmp` and is wiped on container restart. An in-flight upload (initiate done, chunks uploaded, complete not yet called) will fail on container restart even with REMOTE persistence configured — silent partial-upload data loss for the chunk window." — evidence: FileUtils.java:24 (`private static final String CHUNK_BASE_PATH = \"/tmp/odd/chunks\";`) + LocalFileUploadServiceImpl.java:34 (uses it) + RemoteFileUploadServiceImpl.java:55 (uses it) — severity: MEDIUM (LSN-001 ephemeral-storage class — partial remediation; the user-data-loss vector for REMOTE deployments)

- "`FileUtils.listFilesInOrder` parses each chunk filename as an integer to sort by chunk index (FileUtils.java:43-49). Any stray non-integer file in the chunk directory (`.DS_Store`, an editor swap file, an interrupted-write `.tmp`) throws `NumberFormatException` wrapped as `RuntimeException` and aborts the upload." — evidence: FileUtils.java:43-49 — severity: LOW

- "Link URLs in `saveLinks` / `updateLink` (`DataEntityLinkFormData.url`) are stored raw with no validation — no `@URL` constraint, no scheme allowlist, no length cap. A link with `javascript:` scheme is stored and rendered by the UI; this is the same class as F-004 (stored-XSS family) but on the dedicated link surface rather than the description field." — evidence: components.yaml:2482-2491 (`DataEntityLinkFormData` schema has no `format` or `pattern`) + LinkServiceImpl.java:31-37 (bulk-create stores formData directly via mapper) + LinkServiceImpl.java:41-46 (update applies formData to pojo directly) + DataEntityAttachmentController.java:91-114 (controller passes-through) — severity: MEDIUM (cross-reference F-004)

- "REMOTE-mode MinIO client construction does NOT set `.region(...)` on the builder (MinioConfig.java:20-25) — defaults to `us-east-1` per the AWS SDK convention. Operators running against AWS S3 in another region see opaque signature/redirect errors at runtime — this is the canonical LSN-002 surface and is partially documented on the live operator page but not surfaced as an in-code TODO or comment." — evidence: MinioConfig.java:19-25 — severity: MEDIUM (documented externally; latent in-code)

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP — controller is part of the UI/API surface protected by Spring Security WebFlux; DISABLED skips auth entirely; S2S does not apply (ingestion path only).
- ingestion_filter_relevance: NO — UI/API surface, not ingestion. The `IngestionDataEntitiesFilter` does not register on `/api/dataentities/{id}/(attachments|files|links)` paths.
- authorization_assertions: [
    "`SecurityRule(DATA_ENTITY, PathPattern \"/api/dataentities/{data_entity_id}/files/**\", POST) → DATA_ENTITY_ATTACHMENT_MANAGE` — evidence: SecurityConstants.java:247-251",
    "`SecurityRule(DATA_ENTITY, PathPattern \"/api/dataentities/{data_entity_id}/files/**\", PUT) → DATA_ENTITY_ATTACHMENT_MANAGE` — evidence: SecurityConstants.java:252-256",
    "`SecurityRule(DATA_ENTITY, PathPattern \"/api/dataentities/{data_entity_id}/files/{file_id}\", DELETE) → DATA_ENTITY_ATTACHMENT_MANAGE` — evidence: SecurityConstants.java:257-261",
    "`SecurityRule(DATA_ENTITY, PathPattern \"/api/dataentities/{data_entity_id}/links\", POST) → DATA_ENTITY_ATTACHMENT_MANAGE` — evidence: SecurityConstants.java:262-266",
    "`SecurityRule(DATA_ENTITY, PathPattern \"/api/dataentities/{data_entity_id}/links/{link_id}\", PUT) → DATA_ENTITY_ATTACHMENT_MANAGE` — evidence: SecurityConstants.java:267-271",
    "`SecurityRule(DATA_ENTITY, PathPattern \"/api/dataentities/{data_entity_id}/links/{link_id}\", DELETE) → DATA_ENTITY_ATTACHMENT_MANAGE` — evidence: SecurityConstants.java:272-276"
  ]
- owner_scoping: BYPASSES — the management permission grants on a (subject=DATA_ENTITY, dataEntityId) tuple but the controller's mutation methods discard the path's `dataEntityId` and operate on `fileId`/`linkId` directly. A user with MANAGE on entity A can mutate entity B's files/links by spoofing the URL prefix. Evidence: DataEntityAttachmentController.java:83-88 + service method signatures in AttachmentServiceImpl.java:71-88.
- data_exposure: [
    "List of (files, links) for ANY data entity → any authenticated user (no SecurityRule on GET `/attachments`) — evidence: SecurityConstants.java:247-276 (no GET rule) + DataEntityAttachmentController.java:31-35",
    "File contents (octet-stream download) for ANY file → any authenticated user — evidence: DataEntityAttachmentController.java:73-80 (no permission check)",
    "Max-file-size configuration value → any authenticated user via `getUploadOptions` — evidence: AttachmentServiceImpl.java:60-62 (returns `maxFileSize * 1_000_000` bytes — low-sensitivity config disclosure)",
    "Filenames in `Content-Disposition` header are unsanitized — evidence: DataEntityAttachmentController.java:77 (`\"attachment;filename=\" + dto.fileName()`) — exposes the raw stored name verbatim to downloaders"
  ]
- known_security_gaps: [
    "no SecurityRule for GET endpoints (`getAttachments`, `getUploadOptions`, `downloadFile`) — any authenticated user can list and download any data entity's attachments — evidence: SecurityConstants.java:247-276 — severity: HIGH",
    "mutation endpoints discard the URL's `dataEntityId` and act on `fileId`/`linkId` alone — cross-entity privilege escalation possible for any user holding DATA_ENTITY_ATTACHMENT_MANAGE on one entity — evidence: DataEntityAttachmentController.java:83-88,100-107,110-114 + AttachmentServiceImpl.java:71-88 — severity: HIGH",
    "filename is propagated raw into storage path AND into Content-Disposition header — path-traversal write/read + CRLF header injection on download — evidence: FileMapper.java:30-31 + DataEntityAttachmentController.java:77 — severity: HIGH",
    "no MIME validation or file-type allowlist; mitigation on in-platform download is forced octet-stream (DataEntityAttachmentController.java:78) — evidence: full upload pipeline (no MIME inspection) — severity: MEDIUM",
    "link URL field has no scheme allowlist, no `@URL` constraint, no length cap — `javascript:` and `data:` URIs are storable and rendered by the UI — evidence: components.yaml:2482-2491 + LinkServiceImpl.java:31-46 — severity: MEDIUM (cross-reference F-004 stored-XSS family)",
    "no per-user/per-entity attachment-count or cumulative-size quota — single-user storage-fill DoS — evidence: FileServiceImpl.java:33-103 — severity: MEDIUM"
  ]

## performance

- hot_paths: [
    "`getAttachments` runs two repository fetches in parallel (files + links) and zips — typical use is page-load of a data entity Overview tab; O(F+L) per entity — evidence: AttachmentServiceImpl.java:34-42",
    "`downloadFile` streams the full file resource via Spring Resource pipeline — for REMOTE mode this is a synchronous read from MinIO before streaming to the client (`DataBufferUtils.join` on RemoteFileUploadServiceImpl.java:67-68 buffers the entire stream in memory before issuing the PUT, but the GET path uses InputStreamResource which streams) — evidence: RemoteFileUploadServiceImpl.java:97-105"
  ]
- throughput_characteristics: [
    "single-item-per-call mutations; the only batch operation is `saveLinks` which bulk-creates from `DataEntityLinkListFormData.items[]` — evidence: AttachmentServiceImpl.java:45-47 + LinkServiceImpl.java:31-37",
    "chunked upload accepts arbitrary chunk count, each chunk a single HTTP POST — no max-chunks-per-upload cap — evidence: DataEntityAttachmentController.java:54-62 + FileServiceImpl.java:58-67"
  ]
- resource_allocation: [
    "chunk staging at `/tmp/odd/chunks/<uploadId>/<index>` consumes local disk per in-flight upload, bounded by `attachment.max-file-size` × chunks-per-upload but no per-user or platform-wide cap — evidence: FileUtils.java:24 + FileServiceImpl.java:60",
    "REMOTE `completeFileUpload` calls `DataBufferUtils.join(chunksFlux)` (RemoteFileUploadServiceImpl.java:67-68) which buffers the entire reassembled file into a single ByteBuffer before issuing the S3/MinIO PUT — peak heap = file size × 1 per concurrent upload (effectively bounded by `attachment.max-file-size`, default 20 MB)",
    "Spring's `spring.codec.max-in-memory-size` is the transport ceiling — must equal or exceed `attachment.max-file-size` (per live docs page) or large uploads fail mid-stream"
  ]
- scaling_characteristics: [
    "stateless controller — instances scale horizontally",
    "chunk staging at `/tmp/odd/chunks/<uploadId>/` is NODE-LOCAL — multi-replica deployments require sticky session (or a single replica) for the chunk lifetime, OR uploads must complete to the same pod that initiated. Not surfaced in the controller; latent constraint inherited from the LSN-001 class — evidence: FileUtils.java:24 + LocalFileUploadServiceImpl.java:34 + RemoteFileUploadServiceImpl.java:55",
    "no pagination on `getAttachments` — list size grows O(F+L) per entity",
    "no rate-limiting on any endpoint — single-user upload-storm trivially saturates `/tmp` disk or REMOTE-bucket bandwidth"
  ]
- known_performance_gaps: [
    "REMOTE completeFileUpload buffers the entire file into heap before the S3 PUT — for max-file-size=20MB and high concurrency this multiplies to N×20MB of transient heap — evidence: RemoteFileUploadServiceImpl.java:67-77 — severity: MEDIUM",
    "chunk staging is NODE-LOCAL with no sticky-routing assumption — multi-replica deployments behind a non-sticky load balancer will fail uploads mid-stream — evidence: FileUtils.java:24 (hard-coded `/tmp/odd/chunks`) + no documentation thereof — severity: HIGH for clustered deployments, MEDIUM otherwise",
    "no rate-limiting; no per-user quota — evidence: DataEntityAttachmentController.java:1-116 (no rate-limit annotations or interceptor) + global Spring Security config has no rate-limit filter — severity: MEDIUM"
  ]

## sources

- understanding ← DataEntityAttachmentController.java:1-116 + SecurityConstants.java:247-276 + AttachmentService.java:1-37
- concepts.entities ← DataEntityAttachmentController.java:5-13 (imports) + components.yaml:2410-2491 (schemas)
- concepts.operations ← DataEntityAttachmentController.java:30-114 + openapi.yaml:1566-1774
- concepts.invariants.thin-delegate ← DataEntityAttachmentController.java:31-114 (10 methods, all 1-2 statements)
- concepts.invariants.server-owned-uploadId ← FileServiceImpl.java:41-46 + LocalFileUploadServiceImpl.java:32-41 + RemoteFileUploadServiceImpl.java:53-58
- concepts.invariants.dataEntityId-discarded ← DataEntityAttachmentController.java:65-114 + AttachmentServiceImpl.java:71-88
- dependencies_semantic.requires-feature ← DataEntityAttachmentController.java:14,28 + AttachmentServiceImpl.java:30-31 + FileServiceImpl.java:29-30 + LinkServiceImpl.java:20-21
- dependencies_semantic.requires-config ← application.yml:215-224 + AttachmentServiceImpl.java:27-28 + LocalFilePathConstructor.java:13,15 + RemoteFileUploadServiceImpl.java:36,39 + MinioConfig.java:10-17
- dependencies_semantic.requires-runtime ← FileUtils.java:24 + SecurityConstants.java:247-276 + MinioConfig.java:9-25
- tests_coverage_semantic.test_files ← Grep result: no AttachmentController/AttachmentService/FileService/LinkService tests found in odd-platform-api/src/test
- tests_coverage_semantic.uncovered_behaviours ← FileServiceImpl.java:47-54,64-67,88-91,93-102 + SecurityConstants.java:247-276 + FileUtils.java:43-49
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/data-discovery/attachments 2026-05-20 status 200 (note: top-level path is the live one; the /features/data-discovery/attachments URL returns 404)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration 2026-05-20 status 200 anchor resolves
- docs_link_semantic.doc_drift_findings ← WebFetch excerpts above + FileMapper.java:30-31 + DataEntityAttachmentController.java:77 + AttachmentServiceImpl.java:1-89
- implicit_adrs.declarative-auth ← SecurityConstants.java:247-276 + DataEntityAttachmentController.java:1-116
- implicit_adrs.storage-strategy-via-ConditionalOnProperty ← LocalFilePathConstructor.java:13 + LocalFileUploadServiceImpl.java:26 + RemoteFilePathConstructor.java:10 + RemoteFileUploadServiceImpl.java:36
- implicit_adrs.3-step-chunked-upload ← FileServiceImpl.java:41-102
- implicit_adrs.bucket-required-fail-fast ← RemoteFileUploadServiceImpl.java:45-50
- implicit_adrs.base-path-required-fail-fast ← LocalFilePathConstructor.java:18-23
- implicit_adrs.duplicate-fileName-rejected-at-initiate ← FileServiceImpl.java:47-54
- implicit_adrs.url-hierarchy-layout-only ← DataEntityAttachmentController.java:65-114 + AttachmentServiceImpl.java:71-88
- bugs_limitations_corner_cases.no-read-securityrule ← SecurityConstants.java:247-276 + DataEntityAttachmentController.java:31-42,73-80
- bugs_limitations_corner_cases.filename-unsanitized ← FileMapper.java:30-31 + LocalFilePathConstructor.java:31-33 + DataEntityAttachmentController.java:76-79
- bugs_limitations_corner_cases.no-mime-validation ← DataEntityAttachmentController.java:1-116 + AttachmentServiceImpl.java:1-89 + FileServiceImpl.java:1-103 + LocalFileUploadServiceImpl.java:1-79 + RemoteFileUploadServiceImpl.java:1-141
- bugs_limitations_corner_cases.no-quota ← FileServiceImpl.java:33-103 + AttachmentServiceImpl.java:59-62
- bugs_limitations_corner_cases.dataEntityId-spoofing ← DataEntityAttachmentController.java:65-114 + AttachmentServiceImpl.java:71-88 + SecurityConstants.java:248
- bugs_limitations_corner_cases.chunk-staging-tmp ← FileUtils.java:24 + LocalFileUploadServiceImpl.java:34 + RemoteFileUploadServiceImpl.java:55
- bugs_limitations_corner_cases.chunk-sort-numberformat ← FileUtils.java:43-49
- bugs_limitations_corner_cases.link-url-unvalidated ← components.yaml:2482-2491 + LinkServiceImpl.java:31-46 + DataEntityAttachmentController.java:91-114
- bugs_limitations_corner_cases.minio-region-unset ← MinioConfig.java:19-25 (LSN-002 in-code surface)
- security.auth_mode_relevance ← SecurityConstants.java:247-276 (path-pattern matchers active when auth is enabled)
- security.authorization_assertions ← SecurityConstants.java:247-276
- security.owner_scoping ← DataEntityAttachmentController.java:65-114 + AttachmentServiceImpl.java:71-88
- security.data_exposure ← SecurityConstants.java:247-276 + DataEntityAttachmentController.java:31-80 + AttachmentServiceImpl.java:59-62
- security.known_security_gaps ← above security rows + FileMapper.java:30-31 + components.yaml:2482-2491
- performance.hot_paths ← AttachmentServiceImpl.java:34-42 + RemoteFileUploadServiceImpl.java:97-105
- performance.throughput_characteristics ← AttachmentServiceImpl.java:45-47 + LinkServiceImpl.java:31-37 + DataEntityAttachmentController.java:54-62
- performance.resource_allocation ← FileUtils.java:24 + RemoteFileUploadServiceImpl.java:67-77
- performance.scaling_characteristics ← FileUtils.java:24 + LocalFileUploadServiceImpl.java:34 + RemoteFileUploadServiceImpl.java:55
- performance.known_performance_gaps ← RemoteFileUploadServiceImpl.java:67-77 + FileUtils.java:24

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (heap-buffer claim on REMOTE PUT is from RemoteFileUploadServiceImpl.java:67-77; node-local staging confirmed from FileUtils.java:24 — both static-evidence-anchored, but actual scaling behaviour under load is runtime-only and not measured here)

## pre_emit_coherence_check

Per RULE 6 (LSN-018): this sidecar STRENGTHENS LSN-001 (attachment-ephemeral-default).

The retrospective records the original failure as "the YAML said LOCAL was the default and that was authored verbatim into the doc; the operator-facing consequence (LOCAL writes to a path Kubernetes does not persist) was invisible at the YAML level" and the rule that emerged as Gate 4 (consumer-read before authoring) + Gate 3 (caveats captured as admonitions).

This sidecar adds two new, file-level findings that strengthen the LSN-001 lineage:

1. **Chunk staging is hard-coded to `/tmp/odd/chunks` regardless of `attachment.storage` mode** (FileUtils.java:24). Even when an operator follows the now-corrected documentation and switches to REMOTE persistence, in-flight uploads still depend on `/tmp` for the chunk window. This is a partial-remediation gap — the user-data-loss vector is reduced (completed files persist in S3) but not eliminated (chunks-in-progress are lost on container restart, the same Kubernetes-eviction class). The documentation does not surface this.

2. **The doc was correctly remediated post-LSN-001** (the live page now carries both the ephemeral-storage warning and the Kubernetes-specific operator guidance — confirmed via WebFetch at 2026-05-20T00:00:00Z, status 200, anchor resolves), so the documentation-side rule (Gate 3) is healthy. The remaining LSN-001-class risk is now CODE-side (the hard-coded chunk path), not DOC-side. This is exactly the substrate's value-add: LSN-001 closed the doc-side loop on the visible default; the code-side residue (CHUNK_BASE_PATH) is invisible at the YAML level and is the kind of finding only consumer-read of the implementation surfaces.

Coherence verdict: STRENGTHENS. Adds two file-anchored observations consistent with — and extending — the canonical retrospective.

## Maintainer notes

