## ADR-CANDIDATE-165 — Chunked-upload protocol is intentionally 3-step (initiate → upload-part(s) → complete) with a server-issued `uploadId` UUID; clients cannot inject their own upload identifier; PROCESSING is the only state accepting chunks or completion

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; POSITIVE-INTENT — encodes externally-visible HTTP protocol)
**Pillars affected**: [P-01-data-discovery (attachment subsurface), P-11-platform-api (HTTP contract surface)]
**Support count**: 1 sidecar primary-source (batch V DataEntityAttachmentController class) + 2026-05-10A `uploadFileChunk` per-method sidecar (the uploadId-as-session-key pattern was surfaced at the per-method tier; the class-level sidecar elevates the full 3-step protocol)
**Axes present**: controllers, controller-method (cross-batch corroboration)
**Batch**: V (2026-05-20)

**Surfaced by**:
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:implicit_adrs.[2]` (HIGH) — "Chunked-upload protocol is intentionally 3-step (initiate → upload-part(s) → complete) with a server-issued `uploadId` UUID — clients cannot inject their own upload identifier, and an upload in `PROCESSING` state is the only one accepting new chunks or completion." — evidence: FileServiceImpl.java:41-55 (initiate creates UUID + persists PROCESSING row) + FileServiceImpl.java:58-67 (uploadFileChunk routes through checkProcessingUploadById) + FileServiceImpl.java:69-76 (complete routes through same) + FileServiceImpl.java:93-102 (`checkProcessingUploadById` rejects non-PROCESSING with `BadUserRequestException`)
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:implicit_adrs.[5]` (HIGH) — "Duplicate file-name-per-data-entity is rejected at initiate time, not at complete time — the platform treats (dataEntityId, fileName) as a logical primary key for visible files." — evidence: FileServiceImpl.java:47-54
- cross-batch: 2026-05-10A `DataEntityAttachmentController__controller-method__uploadFileChunk.md` (the uploadId-as-session-key implicit ADR was previously cited at the per-method tier)

**Decision statement**: The attachment chunked-upload state machine is split into THREE HTTP endpoints with a SERVER-OWNED `uploadId` UUID:

1. **Initiate** — `POST /api/dataentities/{data_entity_id}/files/uploads`
   - Request: `DataEntityUploadFormData{fileName}` (the file name to be uploaded)
   - Server action: generate a fresh UUID, persist a `file_upload_metadata` row with status PROCESSING + the data-entity-id + file-name binding, REJECT-IF-DUPLICATE on (dataEntityId, fileName) via `fileRepository.getFileByDataEntityAndName(...)` raising `BadUserRequestException("File with name %s already exists for this data entity")` (FileServiceImpl.java:47-54)
   - Response: `DataEntityUpload{uploadId, fileName, status: PROCESSING}`

2. **Upload Chunk** (one HTTP call per chunk) — `POST /api/dataentities/{data_entity_id}/files/uploads/{uploadId}/chunk?index={i}`
   - Request: a single multipart `Part` with the chunk bytes
   - Server action: validate the supplied `uploadId` is in PROCESSING state (`checkProcessingUploadById` at FileServiceImpl.java:93-102 — rejects non-PROCESSING with `BadUserRequestException("There is no processing upload with id %s")`); reject non-FilePart parts (`BadUserRequestException("Uploaded multipart is not a file")` at FileServiceImpl.java:64-67); stage the chunk at `/tmp/odd/chunks/<uploadId>/<index>` (LOCAL + REMOTE both stage locally per ADR-CANDIDATE-164 + REFACTOR-481)
   - Response: HTTP 200 (no body)

3. **Complete** — `POST /api/dataentities/{data_entity_id}/files/uploads/{uploadId}/complete`
   - Request: empty
   - Server action: validate PROCESSING state again; reassemble chunks via `FileUtils.listFilesInOrder` (parsing each filename as an integer to sort by chunk index — FileUtils.java:43-49); flip status to COMPLETE; persist the `file` row with the resolved storage backend (LOCAL writes to `attachment.local.path`; REMOTE writes via `DataBufferUtils.join` + S3 PUT per RemoteFileUploadServiceImpl.java:67-77)
   - Response: `DataEntityFile{id, fileName, ...}`

The protocol commitments:
- **(a) `uploadId` is SERVER-ISSUED** — clients cannot inject their own UUID; the server's randomly-minted UUID is the only acceptable identifier. This prevents client-side identifier collision attacks AND lets the server own the upload's lifecycle.
- **(b) The PROCESSING state is the ONLY state accepting chunks or completion.** A non-PROCESSING uploadId (already-completed, cancelled, never-existed) is rejected at every chunk + complete call. The state machine is enforced at every gate.
- **(c) (dataEntityId, fileName) is a logical PRIMARY KEY for visible files.** Duplicate file names on a data entity are rejected at INITIATE time (not at complete) — the duplicate detection happens before any byte is uploaded, saving bandwidth on the duplicate.
- **(d) The protocol is STORAGE-BACKEND-AGNOSTIC.** ADR-CANDIDATE-164's mirrored `@ConditionalOnProperty` selects which backend gets the bytes, but the 3-step protocol is identical across LOCAL and REMOTE.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments: the explicit state-machine check at `checkProcessingUploadById`, the explicit duplicate-rejection at initiate, the server-side UUID minting at `FileUploadService.initiateUpload`. None is implementation accident.
2. **Structural impact?** YES — every HTTP-API consumer of the upload surface depends on the 3-step shape; the chunk-staging directory layout (`/tmp/odd/chunks/<uploadId>/<index>`) assumes the protocol; the state-machine validation depends on the PROCESSING-only invariant.
3. **Refactoring or structural?** STRUCTURAL — a maintainer trying to add a single-shot upload endpoint would have to BREAK the existing protocol (the existing chunk-staging directory layout, the PROCESSING invariant, the (dataEntityId, fileName) duplicate-rejection at initiate) — not extend it.

**Existing ADR**: none in `adrs/`. Cross-references ADR-CANDIDATE-164 (storage backend selection) — the protocol is storage-agnostic; both LOCAL + REMOTE conform.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-010 (cross-entity uploadId hijack — STRENGTHENED by batch V — the `dataEntityId` path parameter is DISCARDED at every method beyond initiate per DataEntityAttachmentController.java:65-114; a holder of `DATA_ENTITY_ATTACHMENT_MANAGE` on entity A can complete an upload bound to entity B by URL-spoofing).
- REFACTOR-011 (same-index race overwrite — two concurrent chunk uploads at the same index overwrite each other; no advisory-lock).
- REFACTOR-481 NEW batch V (chunk staging path ephemeral regardless of mode — chunks are LOST on container restart even under REMOTE persistence).
- REFACTOR-484 NEW batch V (filename path-traversal + CRLF injection — the (dataEntityId, fileName) primary key includes the raw user-supplied fileName).
- chunk-reassembly fragility (`FileUtils.listFilesInOrder` parses chunk filenames as integers — any non-integer file in the chunk directory aborts the upload via `NumberFormatException` per DataEntityAttachmentController sidecar `bugs_limitations_corner_cases.[6]`).

**Proposed action**: Promote to `adrs/drafts/attachment-chunked-upload-3-step.md` (new ADR). Document the 3-step protocol + the PROCESSING-state invariant + the (dataEntityId, fileName) primary key + the server-issued uploadId stance + the storage-agnostic property + the cross-link to REFACTOR-481 (chunk-staging ephemerality) + REFACTOR-010 (cross-entity hijack).

**Severity rationale**: MEDIUM — encodes an externally-visible HTTP contract; operators integrating with the upload API need to understand the protocol; the state-machine invariants are operationally important; not security-critical but the gap-cluster (REFACTOR-010, -011, -481, -484) compounds.

---
