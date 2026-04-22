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
- **None** — feature is completely undocumented. User-reported issue: LOCAL storage is ephemeral in containers, REMOTE config requires source code reading.

## Related Domains
- data-entities (attachments belong to entities)
- management (RBAC permission)
