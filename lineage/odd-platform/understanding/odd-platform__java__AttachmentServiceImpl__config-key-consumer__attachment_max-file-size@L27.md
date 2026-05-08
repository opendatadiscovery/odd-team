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

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH

## Maintainer notes

