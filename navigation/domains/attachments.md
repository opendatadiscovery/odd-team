# Attachments

File attachments and links on data entities — LOCAL and REMOTE (S3/MinIO) storage backends.

## Code Entry Points (odd-platform)

### Controller
- `odd-platform-api/.../controller/DataEntityAttachmentController.java` — 7 endpoints: get attachments, upload options, initiate/chunk/complete upload, download, delete file, save/update/delete links

### Services
- `odd-platform-api/.../service/attachment/AttachmentService.java` → `AttachmentServiceImpl.java`
- `odd-platform-api/.../service/attachment/FileService.java` → `FileServiceImpl.java`
- `odd-platform-api/.../service/attachment/FileUploadService.java`
- `odd-platform-api/.../service/attachment/LinkService.java` → `LinkServiceImpl.java`
- `odd-platform-api/.../service/attachment/FilePathConstructor.java`

### Storage Backends
- `odd-platform-api/.../service/attachment/local/` — local filesystem storage (default: `/tmp/odd/attachments`)
- `odd-platform-api/.../service/attachment/remote/` — S3/MinIO storage
  - `RemoteFileUploadServiceImpl.java`
  - `RemoteFilePathConstructor.java`
- `odd-platform-api/.../config/MinioConfig.java` — MinioAsyncClient bean for REMOTE mode. Uses `io.minio.MinioAsyncClient` with only endpoint + credentials — **no region configured**, so the SDK defaults to `us-east-1` for SigV4 signing. AWS S3 buckets outside `us-east-1` fail. See DOC-008 known-limitation note.

### UI
- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewAttachments/`
  - `AttachmentsHeader/AttachmentsHeader.tsx`
  - `AttachmentItem/AttachmentItem.styles.ts`
  - `OverviewAttachments.tsx`

### Configuration (application.yml lines 215-224)
- `attachment.storage` — LOCAL (default) or REMOTE
- `attachment.max-file-size` — max upload size in MB (default: 20)
- `attachment.local.path` — local storage path (default: `/tmp/odd/attachments`)
- `attachment.remote.url` — S3/MinIO endpoint URL
- `attachment.remote.access-key` — S3 access key
- `attachment.remote.secret-key` — S3 secret key
- `attachment.remote.bucket` — S3 bucket name

### RBAC
- `DATA_ENTITY_ATTACHMENT_MANAGE` permission

### Housekeeping
- `DataEntityHousekeepingJob.java` — references attachment cleanup

## Documentation
- `docs/configuration-and-deployment/odd-platform.md` — "Attachment Storage Configuration" section (DOC-008 shipped 2026-04-23). Documents all `attachment.*` keys, warns about ephemeral LOCAL default path (K8s/Docker), provides REMOTE S3/MinIO examples, notes the AWS-S3-region known limitation.
- `docs/Features.md` — "Data Entity Attachments" section (user-facing flow, anchor `#id-6fbe`).

## Known Issues / Code Gaps
- **Missing region config (platform-side fix needed)**: `MinioConfig.java` does not accept `attachment.remote.region` and does not call `.region(...)` on the MinIO builder. As a result, AWS S3 buckets outside `us-east-1` cannot be used. Fix would add an optional `attachment.remote.region` property and pass it through. Tracked as a related functional bug from DOC-008; a GitHub Issue on `odd-platform` should be opened when the docs PR merges.

## Related Domains
- data-entities (attachments belong to entities)
- management (RBAC permission)
