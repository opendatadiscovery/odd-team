# SHB-015 — Attachment chunk staging path is hardcoded `/tmp/odd/chunks` and per-instance — multi-instance deployments fail under BOTH LOCAL and REMOTE storage

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators deploying odd-platform with multiple instances behind a load balancer see intermittent attachment-upload failures (NoSuchFileException, incomplete chunk sets) because the chunked-upload state machine (`initiateFileUpload` → N × `uploadFileChunk` → `completeFileUpload`) stages chunks to a **hardcoded** `/tmp/odd/chunks/{uploadId}/{index}` filesystem path. The chunk staging path is `FileUtils.CHUNK_BASE_PATH` (a constant, NOT config-driven), and it is identical under BOTH `attachment.storage=LOCAL` AND `attachment.storage=REMOTE` — only the finalised-file location differs (LOCAL writes the final assembly to local disk, REMOTE pushes to S3). When a load balancer routes `initiateFileUpload` to instance A and a subsequent `uploadFileChunk` to instance B, `transferTo` fails with `NoSuchFileException` because instance B's `/tmp/odd/chunks/{uploadId}/` directory does not exist. F-027 (Attachment Lifecycle) anchors the LSN-001 surface (LOCAL ephemeral default wiping data on restart); this thread anchors the **multi-instance availability defect** that affects REMOTE storage too — the LSN-001 sibling F-027 doesn't capture.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/FileUtils.java:23-28` — `public static final String CHUNK_BASE_PATH = "/tmp/odd/chunks";`. Hardcoded, NOT config-driven.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/FileServiceImpl.java:58-67` — `uploadFileChunk` writes via `FilePart.transferTo(getChunkDirectory(uploadId).resolve(String.valueOf(index)))`. The path is per-instance local filesystem.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/upload/LocalFileUploadServiceImpl.java:37` — chunk directory is CREATED at initiate (`FileUtils.createDirectories(chunkDirectory)`) on whichever instance handled initiate.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/upload/RemoteFileUploadServiceImpl.java:55-56` — REMOTE storage ALSO creates the chunk directory at initiate, on the local filesystem. The storage-backend dispatch happens at FINALISATION, not at chunk-stage.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityAttachmentController.java:54-62` — the chunk endpoint; the controller does not invoke `createDirectories` (only `getChunkDirectory` to assemble the path).
- `lineage/odd-platform/refactoring-scopes.md:107-115` — REFACTOR-013 (HIGH) — the LSN-001 LOCAL multi-instance flavour is captured; the REMOTE-storage flavour is its sibling that this thread surfaces.
- Live doc: `https://docs.opendatadiscovery.org/features/data-discovery/attachments` (verified at class-level enrichment 2026-05-08, status 200) — describes drag-and-drop upload but does NOT describe the chunked-upload wire protocol, the multi-instance requirement, or the `/tmp/odd/chunks` staging path.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DataEntityAttachmentController__controller-method__uploadFileChunk.md:bugs_limitations_corner_cases[0]` (HIGH-severity entry).

## Notes

- **The shape is structurally identical to LSN-001** (the attachment-storage default wiping data on container restart): a hardcoded ephemeral path that fails silently under expected deployment patterns. The REMOTE storage flag does NOT save you — the chunk-stage path is upstream of the storage-backend dispatch.
- **Operator-visible failure modes**:
  - **Direct**: a load balancer routes `initiateFileUpload` to instance A; subsequent `uploadFileChunk` to instance B → `NoSuchFileException` → HTTP 500. The user sees an opaque error in the upload dialog. Retry may or may not work depending on routing stickiness.
  - **Indirect**: container `tmpwatch` / cron / sibling-pod cleanup wipes `/tmp/odd/chunks/{uploadId}/` between initiate and final assembly → `completeFileUpload` finds an incomplete chunk set → file is either silently truncated or fails assembly.
- **Multiple amplifying defects on the same surface** (cross-link the controller sidecar):
  - **No size enforcement** on the chunk endpoint — the `attachment.max-file-size` cap is a UI hint only. A non-browser client can post chunks larger than the cap (REFACTOR-013 HIGH).
  - **Cross-entity `uploadId` hijack** — caller with `DATA_ENTITY_ATTACHMENT_MANAGE` on entity X can post chunks against entity Z by providing Z's uploadId. The auth gate evaluates the URL's `data_entity_id` (X); the service resolves by `uploadId` only (Z).
  - **Same-`index` race** — last-writer-wins file write keyed by `index`; client retrying chunk `index=3` while prior attempt is still flushing has both writes target the same path, no idempotency token.
  - **No rate-limit / concurrency cap** — a client can saturate `/tmp/odd/chunks` faster than `completeFileUpload` cleans up.
  - **No virus scanning** on chunk acceptance; the assembled file is later downloadable.
  - **No audit logging** on chunk acceptance — anonymous DISABLED-mode scans leave no trace.
- **The fix is structural**: make `CHUNK_BASE_PATH` config-driven (e.g. `attachment.chunk-staging-path`), AND for multi-instance deployments require either a shared volume (NFS / EFS) backing `/tmp/odd/chunks`, OR a state-backend (e.g. S3 multipart upload session, distributed cache) that survives across instances.
- **REMOTE storage doesn't help today** because the chunk-stage path is upstream of the storage-backend dispatch. A native S3 multipart-upload state would: (a) use S3's session-token API to coordinate across instances, (b) eliminate the local-filesystem dependency entirely.

## Next

1. **REFACTOR-NNN — HIGH** — make `CHUNK_BASE_PATH` config-driven via `attachment.chunk-staging-path` with default `/tmp/odd/chunks`. Operator can point to a shared mount in multi-instance deployments.
2. **REFACTOR-NNN — HIGH** — for REMOTE storage, use S3 multipart-upload sessions natively rather than staging chunks locally. The S3 multipart-upload API provides cross-instance coordination via its session token. Single-instance LOCAL deployments keep the current path.
3. **DOC-NNN — HIGH** — the `/features/data-discovery/attachments` page should EXPLICITLY warn that multi-instance deployments require a shared volume backing `/tmp/odd/chunks` (current LOCAL behaviour) until S3 multipart support lands.
4. **DOC-NNN — HIGH** — document the chunked-upload wire protocol (`initiateFileUpload` → `uploadFileChunk` → `completeFileUpload`) somewhere reachable from the developer-guides API reference. Today third-party integrators have to read the OpenAPI spec.
5. **REFACTOR-NNN — MEDIUM** — fix the cross-entity uploadId hijack: in `FileServiceImpl.uploadFileChunk`, assert `filePojo.dataEntityId == path.dataEntityId` before staging.
6. **REFACTOR-NNN — MEDIUM** — server-side enforcement of `attachment.max-file-size` (currently UI-only). Accumulating chunk byte count + checking against the cap.
7. **TEST-NNN — HIGH** — multi-instance integration test that simulates routing initiate + chunk to different instances; today this fails by design.
8. **Cluster** with F-027 (Attachment Lifecycle) + LSN-001 — the broader attachment-storage-defaults defect family.

## Links

- cluster_with: [F-027]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: deferred — F-027 (the natural
  merge target) is pillar P-08 Management & Administration, OUTSIDE
  this slice's pillar (P-01 Data Discovery). Per the slice-A
  anti-pattern: "Do NOT modify F-NNN files OUTSIDE your slice's
  pillar." NOTE: Attachments are listed as a SUB-FEATURE of P-01
  Data Discovery in `system-mission.md` ("Data Entity Attachments
  (files + links; LOCAL vs REMOTE storage; LSN-001 caveat)") — the
  F-027 pillar assignment of P-08 may itself be a migration-artefact
  worth maintainer-triage. The hypothesis is strong (8 refs across
  controller / service / utils / config / spec / live-doc / sidecar /
  refactoring-scopes axes); evidence pattern matches F-027's anchor.
  NEXT-RUN ACTION: a P-08 slice (or a maintainer-triage pass to
  reclassify F-027 to P-01) merges SHB-015 into F-027 as new drift
  facets (`chunk_base_path_hardcoded_per_instance_multi_instance_failure`
  + `cross_entity_upload_id_hijack` + `same_index_race_no_idempotency`).
  Thread stays `clustering` with cluster_with: [F-027] preserved.
