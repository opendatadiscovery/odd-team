---
node_id: "odd-platform java AttachmentServiceImpl config-key-consumer:attachment.max-file-size@L27"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-01
---

# attachment.max-file-size (consumer at AttachmentServiceImpl.java:27) — semantic understanding

## understanding

This `@Value`-injected field reads the YAML key `attachment.max-file-size` (in megabytes) from `application.yml` and is consumed in exactly one place: `getUploadOptions()` returns a `DataEntityUploadOptions` payload whose `maxSize` field equals `maxFileSize * 1_000_000` (bytes). That payload is served by `DataEntityAttachmentController#getUploadOptions` to the React UI, which uses it to filter selected files client-side before any chunk upload begins. The cap is therefore a UI-driven hint, not a server-side guard — neither `uploadFileChunk` nor `completeFileUpload` re-validates per-file size against `maxFileSize`.

## concepts

- entities: [`DataEntityUploadOptions`, `DataEntityFile`, attachment upload session]
- operations: [resolve max-file-size from config, expose upload options to UI, multiply MB→bytes (×1_000_000) for the wire format]
- invariants: [`maxFileSize` is interpreted as megabytes; the wire-format multiplier is decimal MB (×1_000_000), not binary MiB (×1_048_576); the value is read once at bean construction and is not re-read at request time]
- audiences: [the React `SaveFilesForm` / `FileInput` components in `odd-platform-ui` (consume `maxSize` from `/api/v3/.../upload/options`)]

## dependencies_semantic

- requires-feature: [`attachment` upload subsystem (file upload chunking via `LinkService` + `FileService`); `DataEntityAttachmentApi` OpenAPI contract that defines `DataEntityUploadOptions.maxSize`]
- requires-config: [`attachment.max-file-size` (declared in `odd-platform-api/src/main/resources/application.yml:217` with default `20` mb); transport-layer dependency on `spring.codec.max-in-memory-size` (declared at `application.yml:14-15` with default `20MB`) — if the YAML value is raised above the codec limit, uploads fail at the WebFlux codec layer before this consumer's value can be checked client-side]
- requires-runtime: [Spring property-source resolution at bean construction time (`@Value` is eager); the OpenAPI-generated `DataEntityUploadOptions` model class shipped from `odd-platform-api-contract`]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [(1) verifying that `getUploadOptions()` returns `maxFileSize * 1_000_000` for a configured `attachment.max-file-size`; (2) regression on the MB→bytes multiplier (decimal vs binary) since the UI hint reads the bytes-domain value back as MB via `bytesToMb`; (3) absence of server-side enforcement — a malicious or buggy client can upload chunks whose accumulated size exceeds `maxFileSize` because no service-layer code re-reads or enforces it]
- test_files: []
- gaps: |
    There is no `AttachmentServiceImplTest` (or equivalent) in the repository — confirmed by `find odd-platform -path "*/test/*" -name "*.java" | xargs grep -l "AttachmentService\|maxFileSize\|UploadOptions"` returning no matches. A regression that broke the MB→bytes multiplier (e.g. switched to `* 1_048_576` to match `bytesToMb` reciprocally, or dropped the multiplier and shipped raw MB to the UI) would not be caught by any automated test. The most likely silent failure is a UX-only regression where the UI hint says "20 Mb" but accepts 20 MiB or rejects everything above 20 bytes.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#attachment-storage-configuration"
    rationale: "The published Attachment Storage Configuration section is the canonical operator-facing home for every key under the `attachment.*` YAML prefix, including `attachment.max-file-size`. There is no `@docs` annotation in the source file, so the link is inferred from the documentation repo's location of the existing key."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-08 (status 200, anchor `attachment-storage-configuration` present):
    > "`attachment.max-file-size`: maximum size per uploaded file, in **megabytes**. Defaults to `20`."
    > "`attachment.max-file-size` must not exceed `spring.codec.max-in-memory-size`. Both ship with the same `20 MB` default, so the attachment cap is effective out of the box. If you raise `attachment.max-file-size` to allow larger uploads — for example `100 MB` — you must raise `spring.codec.max-in-memory-size` to at least the same value, otherwise uploads above `20 MB` fail at the WebFlux codec layer with `DataBufferLimitException` before the attachment validation runs."
- doc_drift_findings:
  - "The live doc page describes `attachment.max-file-size` as a per-file size cap and frames the `spring.codec.max-in-memory-size` interaction as the user-visible failure mode at the WebFlux codec layer. Neither the doc page nor the source surfaces that the cap is enforced **only** client-side (UI-driven filter) and that no service-layer re-validation exists in `AttachmentServiceImpl`, `DataEntityAttachmentController`, or `FileServiceImpl`. An operator reading the doc would reasonably believe the server rejects oversized uploads."

## implicit_adrs

- "The cap is exposed as `bytes` over the wire (MB × 1_000_000), so the contract type `DataEntityUploadOptions.maxSize` is implicitly bytes-with-decimal-MB-conversion rather than megabytes." — evidence: AttachmentServiceImpl.java:61 (`maxFileSize * 1_000_000`) — confidence: HIGH
- "Per-file size is treated as a UX hint, not a security/integrity boundary — enforcement is delegated to the UI client. The server-side service layer accepts whatever the chunk upload pipeline streams." — evidence: AttachmentServiceImpl.java:27-89 (no size guard in `uploadFileChunk` or `completeFileUpload`) + DataEntityAttachmentController.java:54-62 (controller passes the chunk through without size validation) + FileInput.tsx:39 (`file.size <= maxFileSizeInBytes` is the only filter before upload starts) — confidence: HIGH

## bugs_limitations_corner_cases

- "Server-side bypass: a non-browser client (curl, a script, a misbehaving SDK) can call `POST /api/v3/data_entity/{id}/upload/{uploadId}/chunk` with chunks whose accumulated size exceeds `attachment.max-file-size`. The server stores the bytes through `FileService` without checking against `maxFileSize`. The cap is purely a UI-side filter in the React `FileInput` component (file.size ≤ maxFileSizeInBytes)." — evidence: AttachmentServiceImpl.java:70-78 + FileInput.tsx:39 — severity: HIGH
- "Boot-time crash if `attachment.max-file-size` is unset: the field type is `Integer` (boxed) and the `@Value` expression has no `:default` fallback, so an operator who unsets the YAML key (e.g. via env override `ATTACHMENT_MAX_FILE_SIZE=`) gets a Spring property-resolution failure at startup rather than a sane fallback. The `application.yml` default of `20` is the only thing keeping the platform booting." — evidence: AttachmentServiceImpl.java:27 (`@Value(\"${attachment.max-file-size}\")` — no `:N` default) + application.yml:217 (`max-file-size: 20`) — severity: MEDIUM
- "MB→bytes multiplier uses decimal megabytes (×1_000_000) on the server but the UI hint label is rendered via `bytesToMb`. If `bytesToMb` divides by 1_048_576 (binary MiB) — common in JS utilities — the hint label disagrees with the cap by ~4.86% (e.g. server caps at 20_000_000 bytes, label reads '19.07 Mb'). Not verified across the UI helper; flagged for a follow-up." — evidence: AttachmentServiceImpl.java:61 (`* 1_000_000`) + FileInput.tsx:19 (`bytesToMb(maxFileSizeInBytes)`) — severity: LOW
- "`attachment.max-file-size` is a single per-file cap; there is no `total-upload-size`, no per-data-entity quota, and no per-tenant quota. An operator who sets a 100 MB per-file cap implicitly accepts that a single user can fill local or remote storage by repeated max-size uploads. Combined with LSN-001 (LOCAL storage default writes to ephemeral `/tmp/odd/attachments`), the largest practical risk surface is a user filling `/tmp` on a Kubernetes pod ahead of an unrelated container restart." — evidence: AttachmentServiceImpl.java:27-62 (no quota fields) + retrospectives/LSN-001-attachment-ephemeral-default.md — severity: MEDIUM

## sources

- understanding ← AttachmentServiceImpl.java:27-28 + AttachmentServiceImpl.java:60-62 + DataEntityAttachmentController.java:38-42 + FileInput.tsx:36-40
- concepts.entities.DataEntityUploadOptions ← AttachmentServiceImpl.java:13 + AttachmentServiceImpl.java:60-62
- concepts.operations.[resolve-multiply-expose] ← AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:61
- concepts.invariants.[MB-decimal-conversion] ← AttachmentServiceImpl.java:61
- dependencies_semantic.requires-config.attachment.max-file-size ← application.yml:215-217
- dependencies_semantic.requires-config.spring.codec.max-in-memory-size ← application.yml:14-15
- dependencies_semantic.requires-feature ← AttachmentService.java:17-37 + AttachmentServiceImpl.java:30-31
- tests_coverage_semantic.gaps ← Grep result: no test file under odd-platform-api/src/test references `AttachmentService`, `maxFileSize`, or `UploadOptions` (verified 2026-05-08)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-08, status 200, anchor `attachment-storage-configuration` confirmed present
- docs_link_semantic.doc_drift_findings.[0] ← Cross-check between WebFetch excerpt and AttachmentServiceImpl.java:60-89 + DataEntityAttachmentController.java:54-62 + FileServiceImpl.java (Grep for `maxFileSize|max-file-size|maxSize|fileSize` returned no matches)
- implicit_adrs.[0] ← AttachmentServiceImpl.java:61
- implicit_adrs.[1] ← AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:70-78 + DataEntityAttachmentController.java:54-62 + FileInput.tsx:39
- bugs_limitations_corner_cases.[0] ← AttachmentServiceImpl.java:70-78 + DataEntityAttachmentController.java:54-62 + FileInput.tsx:36-40 + FileServiceImpl.java (no size-guard match on Grep)
- bugs_limitations_corner_cases.[1] ← AttachmentServiceImpl.java:27 + application.yml:217
- bugs_limitations_corner_cases.[2] ← AttachmentServiceImpl.java:61 + FileInput.tsx:19
- bugs_limitations_corner_cases.[3] ← AttachmentServiceImpl.java:27-89 + retrospectives/LSN-001-attachment-ephemeral-default.md
- security.auth_mode_relevance ← AttachmentServiceImpl.java:23-25 (`@Service` — service layer, not on the HTTP surface) + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-08, status 200 (auth modes verified verbatim: DISABLED / LOGIN_FORM / OAUTH2 / LDAP)
- security.ingestion_filter_relevance ← AttachmentServiceImpl.java:23-25 (`@Service`) + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-08 (ingestion filter property `auth.ingestion.filter.enabled` is gated on `POST /ingestion/entities` only — attachment upload runs on the UI/API surface)
- security.authorization_assertions ← AttachmentServiceImpl.java:23-89 (no `@PreAuthorize`, no `permissionService.hasPermission(...)` programmatic check; service layer relies on upstream controller/policy enforcement)
- security.owner_scoping ← AttachmentServiceImpl.java:27-28 (config-key consumer — value is a scalar Integer, not a data scope)
- security.data_exposure ← AttachmentServiceImpl.java:60-62 (cap value × 1_000_000 returned to UI via `DataEntityUploadOptions`)
- security.known_security_gaps.[0] ← AttachmentServiceImpl.java:70-78 + DataEntityAttachmentController.java:54-62 + FileInput.tsx:39 (port of bugs_limitations_corner_cases.[0] HIGH-severity finding into security vocabulary)
- performance.hot_paths.[0] ← AttachmentServiceImpl.java:60-62 (`getUploadOptions()` returns `maxFileSize * 1_000_000` — runs on every UI upload-options fetch, i.e. every time the user opens an attachment-upload dialog)
- performance.hot_paths.[1] ← AttachmentServiceImpl.java:70-78 (the cap is conceptually checked client-side per upload — see implicit_adrs.[1] for the absence of server-side enforcement)
- performance.throughput_characteristics ← AttachmentServiceImpl.java:65-78 (per-upload chunked: `initiateFileUpload` + `uploadFileChunk` + `completeFileUpload` — single-item upload session, no batch endpoint)
- performance.resource_allocation ← AttachmentServiceImpl.java:27-28 + application.yml:217 (Integer field, default `20` MB) + dependencies_semantic.requires-config (interaction with `spring.codec.max-in-memory-size` ceiling)
- performance.scaling_characteristics ← AttachmentServiceImpl.java:27-28 (single `@Value`-bound scalar; no per-tenant / per-data-entity / per-owner override mechanism in this file)
- performance.known_performance_gaps.[0] ← AttachmentServiceImpl.java:27 + retrospectives/LSN-001-attachment-ephemeral-default.md (cap-vs-storage-tier interaction: 20 MB default × N concurrent uploads against LOCAL ephemeral `/tmp/odd/attachments` is the LSN-001 risk surface)
- performance.known_performance_gaps.[1] ← AttachmentServiceImpl.java:27 + application.yml:14-15 (`spring.codec.max-in-memory-size: 20MB`) — operator must raise codec limit in lockstep when raising the attachment cap, otherwise uploads fail at the WebFlux codec layer with `DataBufferLimitException`

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a `@Service`-layer `@Value` consumer (AttachmentServiceImpl.java:23-25), not an HTTP endpoint. The auth mode does not gate this code directly. The upstream controller (`DataEntityAttachmentController#getUploadOptions`) runs under whichever of `LOGIN_FORM | OAUTH2 | LDAP` is selected via `auth.type`; verified verbatim against `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` on 2026-05-08 (status 200). When `auth.type=DISABLED` the controller path is unauthenticated and the cap value reaches anonymous callers.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. Attachment upload runs on `/api/v3/data_entity/{id}/upload/...`, which is the UI/API path. The ingestion filter (`auth.ingestion.filter.enabled`, default `false`) gates only `POST /ingestion/entities`; verified verbatim against the same WebFetch on 2026-05-08.
- **authorization_assertions**: `[]` — no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call in this file (AttachmentServiceImpl.java:23-89). Service-layer code; authorization, if any, lives upstream on the controller or downstream on `LinkService` / `FileService`. The absence here is recorded in `known_security_gaps` below.
- **owner_scoping**: `N/A — config-key consumer, not data-scoped`. The injected value is a scalar `Integer` (AttachmentServiceImpl.java:27-28), not a data shape that could be filtered by owner.
- **data_exposure**: `"DataEntityUploadOptions.maxSize (cap × 1_000_000 bytes) → any caller of GET /api/v3/data_entity/{id}/upload/options under the active auth.type mode"` — evidence: AttachmentServiceImpl.java:60-62. The exposed value is the cap itself (default 20_000_000 bytes); not sensitive, but readable by anonymous callers when `auth.type=DISABLED`.
- **known_security_gaps**:
  - `"server-side enforcement bypass — the per-file cap is exposed to the UI as a hint but no service-layer code re-validates upload size; a non-browser caller (curl, script, misbehaving SDK) can POST chunks whose accumulated size exceeds attachment.max-file-size and the FileService accepts them. The cap is purely a UI-side filter in the React FileInput component."` — evidence: AttachmentServiceImpl.java:70-78 (no size guard) + DataEntityAttachmentController.java:54-62 (controller passes chunk through unchecked) + FileInput.tsx:39 (`file.size <= maxFileSizeInBytes` is the only filter) — severity: HIGH
  - `"absence of authorization assertion at this layer — no @PreAuthorize and no permissionService.hasPermission(...) call; reliance is on upstream controller wiring. If the controller layer also lacks an explicit gate (to be confirmed by a controller-layer enrichment), the upload-options endpoint is gated only by authentication, not by data-entity ownership."` — evidence: AttachmentServiceImpl.java:23-89 — severity: MEDIUM

## performance

- **hot_paths**:
  - `"getUploadOptions() executes on every UI upload-options fetch — i.e. every time a user opens the attachment-upload dialog on a data entity detail page; multiplies maxFileSize × 1_000_000 inline and returns synchronously via Mono.just(...)"` — evidence: AttachmentServiceImpl.java:60-62
  - `"the per-file cap is conceptually checked on every upload attempt (currently client-side only — see security.known_security_gaps.[0]); a server-side enforcement port would put the cap on the per-upload critical path"` — evidence: AttachmentServiceImpl.java:70-78 (current absence) + AttachmentServiceImpl.java:27 (cap field)
- **throughput_characteristics**:
  - `"single-item upload session per uploadId — chunked via initiateFileUpload + uploadFileChunk(per chunk) + completeFileUpload; no batch endpoint that uploads multiple files in one round-trip"` — evidence: AttachmentServiceImpl.java:65-78
  - `"reactive Mono signature on getUploadOptions() — non-blocking, no DB round-trip (returns the resolved @Value directly)"` — evidence: AttachmentServiceImpl.java:60-62
- **resource_allocation**:
  - `"the 20 MB default cap (application.yml:217) is the de-facto memory ceiling for a single attachment upload — together with spring.codec.max-in-memory-size (default 20 MB at application.yml:14-15) it bounds how much the WebFlux codec will buffer per request"` — evidence: AttachmentServiceImpl.java:27 + application.yml:217 + application.yml:14-15
  - `"@Value-injected Integer (boxed) read once at bean construction — no per-request property resolution overhead"` — evidence: AttachmentServiceImpl.java:27-28
- **scaling_characteristics**:
  - `"cluster-wide single configuration value — no per-tenant, per-data-entity, or per-owner override mechanism in this file; every node in the cluster reads the same attachment.max-file-size at boot"` — evidence: AttachmentServiceImpl.java:27-28
  - `"stateless service bean — the cap value is process-local but identical across replicas if YAML/env are uniform; horizontal scaling does not affect cap behaviour"` — evidence: AttachmentServiceImpl.java:23-31 (`@Service`, `@RequiredArgsConstructor`, no shared mutable state)
- **known_performance_gaps**:
  - `"cap-vs-storage-tier interaction: with the LOCAL storage default (LSN-001), a 20 MB cap × N concurrent uploads writes to ephemeral /tmp/odd/attachments and is wiped on container restart; raising the cap (e.g. 100 MB) without switching to REMOTE storage proportionally increases the data-loss surface on restart"` — evidence: AttachmentServiceImpl.java:27 + retrospectives/LSN-001-attachment-ephemeral-default.md — severity: HIGH
  - `"cap-vs-codec-ceiling coupling: raising attachment.max-file-size above spring.codec.max-in-memory-size (default 20 MB at application.yml:14-15) silently fails at the WebFlux codec layer with DataBufferLimitException before this consumer's value is reached; the two keys must be raised in lockstep but neither the field nor the application.yml comment surfaces the dependency"` — evidence: AttachmentServiceImpl.java:27 + application.yml:14-15 + application.yml:217 — severity: MEDIUM
  - `"absence of total-upload / per-data-entity / per-tenant quota means a single user can fill storage by repeated max-cap uploads — the per-file cap alone does not bound aggregate consumption"` — evidence: AttachmentServiceImpl.java:27-62 (no quota fields) — severity: MEDIUM

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

