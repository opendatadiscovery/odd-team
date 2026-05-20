## REFACTOR-481 — `CHUNK_BASE_PATH = "/tmp/odd/chunks"` is HARD-CODED constant regardless of `attachment.storage` mode (LSN-001 residue at chunk-staging tier)

**Severity**: HIGH
**Category**: hard-coded-path + LSN-001-class + multi-instance-fs
**Batch**: V (2026-05-20)
**Pillars affected**: [P-01-data-discovery (attachment subsurface), P-08-management-administration (operator deployment posture)]

**Surfaced by**:
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[5]` (MEDIUM at sidecar tier — promoted to HIGH at scope tier per operator-impact reasoning below) — "`/tmp/odd/chunks` is a HARD-CODED constant (FileUtils.java:24) regardless of `attachment.storage` mode. When operators run with `attachment.storage=REMOTE` and configure S3/MinIO for persistence, the chunk staging path still uses `/tmp` and is wiped on container restart. An in-flight upload (initiate done, chunks uploaded, complete not yet called) will fail on container restart even with REMOTE persistence configured — silent partial-upload data loss for the chunk window."
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:pre_emit_coherence_check` — "STRENGTHENS LSN-001 (attachment-ephemeral-default). … Chunk staging is hard-coded to `/tmp/odd/chunks` regardless of `attachment.storage` mode (FileUtils.java:24). Even when an operator follows the now-corrected documentation and switches to REMOTE persistence, in-flight uploads still depend on `/tmp` for the chunk window."
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:performance.known_performance_gaps.[1]` (HIGH for clustered deployments) — "chunk staging is NODE-LOCAL with no sticky-routing assumption — multi-replica deployments behind a non-sticky load balancer will fail uploads mid-stream"
- cross-batch — STRENGTHENS REFACTOR-058 (chunk staging path is storage-INDEPENDENT — applies to LOCAL **and** REMOTE — surfaced from 2026-05-10A `uploadFileChunk` per-method sidecar)

**Statement**: At `FileUtils.java:24`, the chunk staging directory is declared as a HARD-CODED constant:

```java
private static final String CHUNK_BASE_PATH = "/tmp/odd/chunks";
```

Both LOCAL (`LocalFileUploadServiceImpl.java:34`) and REMOTE (`RemoteFileUploadServiceImpl.java:55`) `FileUploadService` implementations stage uploaded chunks at `/tmp/odd/chunks/<uploadId>/<index>` during the 3-step chunked-upload protocol (per ADR-CANDIDATE-165). The staging directory is ephemeral inside any container/pod filesystem — Kubernetes evictions, container restarts, node drains, routine deployments, crashes ALL wipe `/tmp` (or it's a tmpfs that resets on restart).

**LSN-001 residue framing**:

LSN-001 (`retrospectives/LSN-001-attachment-ephemeral-default.md`) closed the doc-side loop by warning operators that LOCAL attachment storage at `/tmp/odd/attachments` is ephemeral. The doc-side fix is live (`https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration` verified 2026-05-20, status 200 — carries the ephemerality warning + Kubernetes operator guidance). **The doc-side fix is INCOMPLETE at the code-side chunk-staging tier**: an operator following the corrected documentation switches to REMOTE storage (S3 / MinIO) and reasonably expects their attachment uploads to be durable. They are — for COMPLETED uploads. For IN-FLIGHT uploads (initiate done, chunks uploaded, complete not yet called), the chunks are still staged in `/tmp` and are LOST on container restart.

**Operator-side consequences**:

- **Silent partial-upload data loss for the chunk window**. An operator uploading a 50MB report in 5MB chunks at the moment of a Kubernetes rolling deployment loses everything between initiate and complete. The operator's UI shows the upload in progress; the deployment restarts the pod; the chunks vanish; the complete-call fails (or worse — the complete-call succeeds if the chunks happen to all reach the same pod, but produces a truncated file).

- **Multi-replica deployments are doubly broken**. Even WITHOUT a container restart, a multi-replica deployment behind a non-sticky load balancer routes successive chunk-upload requests to DIFFERENT pods. Each pod has its own `/tmp/odd/chunks/<uploadId>/` directory. Chunk 1 goes to pod A, chunk 2 goes to pod B; the complete-call on whichever pod receives it finds only its local subset. The upload fails OR (if the LB happens to route everything to one pod by chance) succeeds-but-fragile. **This is undocumented at the operator-facing doc.**

- **The chunk-reassembly fragility class** (per DataEntityAttachmentController sidecar `bugs_limitations_corner_cases.[6]`) — `FileUtils.listFilesInOrder` parses each chunk filename as an integer (FileUtils.java:43-49); any stray non-integer file in the chunk directory throws `NumberFormatException` wrapped as `RuntimeException` and aborts the upload. The `/tmp` location makes stray-file pollution more likely (other processes write to `/tmp`).

**Evidence**:

- `FileUtils.java:24` — `private static final String CHUNK_BASE_PATH = "/tmp/odd/chunks";` — the hard-coded constant
- `LocalFileUploadServiceImpl.java:34` — uses CHUNK_BASE_PATH
- `RemoteFileUploadServiceImpl.java:55` — uses CHUNK_BASE_PATH (REMOTE still stages locally before S3 PUT)
- `RemoteFileUploadServiceImpl.java:67-77` — REMOTE complete-call calls `DataBufferUtils.join(chunksFlux)` to reassemble chunks from `/tmp/odd/chunks/<uploadId>/` then issues S3 PUT. The PUT is durable; the local chunk window is not.
- doc-side: `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration` — covers the LOCAL ephemerality + Kubernetes guidance but does NOT mention the chunk-staging residue.

**Existing-ADR-or-implied-prescription**:

- ADR-CANDIDATE-164 (NEW batch V) codifies the storage-strategy `@ConditionalOnProperty` design — this scope is the operational gap that the ADR's matchIfMissing=true LOCAL default propagates into the chunk-staging tier.
- ADR-CANDIDATE-165 (NEW batch V) codifies the 3-step chunked-upload protocol — this scope is the protocol's NODE-LOCAL fragility at the chunk window.
- LSN-001 retrospective closed the doc-side loop on LOCAL ephemerality; this scope is the CODE-SIDE residue.

**Proposed remedy**:

1. **Path A — Externalize `CHUNK_BASE_PATH` via `@Value("${attachment.chunks.path:/tmp/odd/chunks}")`** + add a fail-fast `@PostConstruct` validator (consistent with the ADR-CANDIDATE-164 pattern: REMOTE bucket can't be empty; LOCAL base path can't be empty). Document the operator-side mounting requirement (PersistentVolumeClaim or hostPath; not emptyDir) in the live deployment docs.
2. **Path B — Use the storage backend for chunk staging** — for REMOTE deployments, stage chunks IN the S3 bucket (e.g. `bucket/chunks/<uploadId>/<index>`) so the chunks are durable + cross-pod-visible. For LOCAL, document the operator-side mounting requirement as in Path A.
3. **Path C — Eliminate chunk staging entirely** via streaming reassembly — receive each chunk and stream-append to the storage backend (S3 multipart upload natively supports this). Removes the `/tmp` dependency entirely but requires a more substantial refactor.

Path B is the cleanest for REMOTE deployments; Path A is the minimum operator-facing fix; Path C is the long-term architectural improvement.

**Severity rationale**: HIGH — silent data loss vector for any operator using attachment uploads under REMOTE persistence with multi-replica deployments OR with any restart during in-flight uploads; the LSN-001 doc-side closure is INCOMPLETE; the operator's reasonable expectation ("REMOTE persistence means uploads are durable") is violated; same severity class as LSN-001 itself.

**Suggested backlog grouping**: `Attachment hardening sprint` — covers REFACTOR-481 (this), REFACTOR-484 (filename path-traversal + CRLF), REFACTOR-058 (chunk staging path storage-INDEPENDENT — STRENGTHENED by this finding).

---
