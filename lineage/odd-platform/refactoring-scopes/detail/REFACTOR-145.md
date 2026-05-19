- **REFACTOR-145** (NEW 2026-05-12D): `DataEntityHousekeepingJob.deleteFiles` calls `fileUploadService.deleteFiles(filePojos).block()` inside a jOOQ transaction — MinIO/S3 outage (LSN-002-shape region misconfig, network partition, credential rotation) either hangs indefinitely (no explicit timeout) or throws, taking the surrounding jOOQ transaction with it. The transaction wraps the ENTIRE ~25-table cascade; one failed S3 delete rolls back ALL the cleanup for that batch
  - **Category**: block-in-transaction
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:bugs_limitations_corner_cases.[6]` (MEDIUM)
  - **Statement**: `DataEntityHousekeepingJob.java:142` reactively calls `fileUploadService.deleteFiles(filePojos).block()` while wrapped inside the surrounding jOOQ transaction at `DataEntityHousekeepingJob.java:71` (`DSL.using(connection).transaction(ctx -> {...})`). The transaction encompasses the entire ~25-table cascade. If MinIO/S3 is unreachable: (a) the `block()` either hangs indefinitely (no explicit timeout) or throws; (b) the throw propagates up and aborts the jOOQ transaction, rolling back ALL the cleanup for that batch of data entities; (c) the next 15-minute cycle retries the entire batch; (d) if the failure is persistent (e.g. wrong S3 region), data entities accumulate in DELETED status indefinitely while housekeeping silently fails each cycle (only `log.error` at `HousekeepingJobManager.java:45` surfaces it).
  - **Evidence**: `DataEntityHousekeepingJob.java:142` (`.block()` call) + `DataEntityHousekeepingJob.java:71` (surrounding transaction) + `HousekeepingJobManager.java:41-47` (outer catch/log.error)
  - **Existing-ADR-or-implied-prescription**: None defends the block-in-transaction pattern. ADR-CANDIDATE-012 (attachment storage `@ConditionalOnProperty`) is adjacent — the storage backend choice (LOCAL vs REMOTE) is what triggers the LSN-002 region-misconfig failure mode on REMOTE.
  - **Proposed remedy**: Refactor `DataEntityHousekeepingJob.deleteFiles` to perform S3 deletes OUTSIDE the jOOQ transaction: (a) collect file pojos to delete inside the transaction; (b) commit the transaction (the data-entity rows are now soft-deleted but the files persist temporarily); (c) call `fileUploadService.deleteFiles(filePojos)` in a separate non-transactional context with an explicit timeout (`Duration.ofSeconds(30)`). On S3-failure, log + retry-budget instead of rolling back the cleanup. Alternative: pre-fetch the file pojos, delete the data-entity row, and SCHEDULE the file delete via a separate background queue.
  - **Severity rationale**: MEDIUM — interacts with LSN-002 shape (REMOTE S3 misconfig) + housekeeping's 15-min cadence to produce a silent-fail-loud-in-logs deployment where soft-deleted data entities never fully purge. The failure-mode-blast-radius is per-deployment but persistent.
  - **Suggested backlog grouping**: `Housekeeping safety sprint`

## STRENGTHENS — HousekeepingJobManager (batch K, OPERATOR-TRAP coupling from orchestrator angle)

**Orchestrator-side primary-source confirmation**. The batch-D HousekeepingTTLProperties sidecar surfaced this from the config-side; the batch-K HousekeepingJobManager sidecar adds the orchestrator-side framing — the outer try/catch at `HousekeepingJobManager.java:45` is the ERROR-log absorber that hides this failure mode from operators.

**New batch-K evidence**:
- `HousekeepingJobManager.md:bugs_limitations_corner_cases.[2]` (MEDIUM): "`.block()` inside transaction anti-pattern (REFACTOR-145 batch D, cross-confirmed from the manager-side angle). `DataEntityHousekeepingJob.doHousekeeping` (lines 71-82) wraps the entire ~25-table cascade in `DSL.using(connection).transaction(ctx -> {...})`. Inside that transaction, `deleteFiles` (lines 131-143) calls the REACTIVE `fileUploadService.deleteFiles(filePojos).block()` at line 142. ... If the S3 call eventually throws, the transaction rolls back ALL ~25 deletes — the next cycle retries the entire batch (REFACTOR-145 latent dragon: under persistent S3 misconfiguration, the data-entity housekeeping never makes progress, and the only signal is `log.error` at the outer manager-level catch at HousekeepingJobManager.java:45)."
- The batch-K finding adds: the failure is FORENSICALLY SILENT at the operator layer because (a) HousekeepingJobManager logs only at ERROR (per ADR-CANDIDATE-101 — per-job failure isolation), (b) the cycle continues to subsequent jobs (so the operator does not see a complete-cycle failure), (c) there is no Micrometer counter (REFACTOR-313 / REFACTOR-327 family).

**Cross-batch triangulation**:
- batch-D (HousekeepingTTLProperties): config-side framing
- batch-K (HousekeepingJobManager): orchestrator-side framing — the outer catch + per-job isolation hide the failure mode

**Severity unchanged**: MEDIUM. Cross-link with REFACTOR-323 (lock-window race) — together they describe the heavy-load failure cluster where the cycle may exceed 14 minutes AND the S3 delete may stall, producing both concurrent-instance and silent-rollback failures.

---
