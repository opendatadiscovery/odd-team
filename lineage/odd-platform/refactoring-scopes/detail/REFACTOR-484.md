## REFACTOR-484 — Filename path-traversal + CRLF injection in attachment uploads — raw user-supplied `fileName` propagates to storage path + Content-Disposition header with NO sanitization

**Severity**: HIGH
**Category**: path-traversal + header-injection + missing-sanitisation
**Batch**: V (2026-05-20)
**Pillars affected**: [P-01-data-discovery (attachment subsurface), P-09-security-access-control]

**Surfaced by**:
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:bugs_limitations_corner_cases.[1]` (HIGH) — "File-name is propagated raw from the user-supplied `DataEntityUploadFormData.fileName` into (a) the storage path (`Paths.get(basePath, dataEntityId, fileName)` for LOCAL, S3 object key for REMOTE) and (b) the `Content-Disposition` header on download. There is no sanitization, no rejection of path-traversal characters (`..`, `/`, `\\`), no NUL-byte filter, no length cap, no quoting/encoding of the header value. A filename like `../../../etc/odd-secret.txt` resolves outside `attachment.local.path` for LOCAL writes/reads; a filename containing CRLF could inject headers on download (RFC 6266 quoting is absent)."
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:security.known_security_gaps.[2]` (HIGH) — "filename is propagated raw into storage path AND into Content-Disposition header — path-traversal write/read + CRLF header injection on download"
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:security.data_exposure.[3]` — "Filenames in `Content-Disposition` header are unsanitized — exposes the raw stored name verbatim to downloaders"

**Statement**: The user-supplied `fileName` from `DataEntityUploadFormData` propagates raw through the entire attachment lifecycle without sanitization at ANY tier:

**(a) Storage-path side** — `FileMapper.java:30-31`:
```java
filePojo.setName(fileMetadata.getFileName());
filePojo.setPath(pathConstructor.getFilePath(fileMetadata.getFileName(), dataEntityId));
```

For LOCAL storage, `LocalFilePathConstructor.java:31-33` returns `getFileDirectory(dataEntityId).resolve(fileName).toString()` — `Path.resolve` does NOT normalize `..` traversal. A filename like `../../../etc/odd-secret.txt` resolves to a path OUTSIDE `attachment.local.path`. For REMOTE storage, the S3 object key is similarly constructed from the raw fileName — though S3 itself doesn't have a filesystem traversal semantic, the object key contains the raw bytes, which propagate to subsequent operations.

**(b) Content-Disposition header side** — `DataEntityAttachmentController.java:76-79`:
```java
return attachmentService.downloadFile(fileId)
    .map(dto -> ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment;filename=" + dto.fileName())
        .body(dto.resource()));
```

The `dto.fileName()` is the raw stored filename. NO RFC 6266 quoting, NO UTF-8 encoding (RFC 6266 `filename*` syntax), NO CRLF rejection, NO length cap. A filename containing CRLF (`\r\n`) could inject ADDITIONAL HTTP response headers on download — a CRLF header-injection attack (CWE-113).

**Attack scenarios**:

1. **Path-traversal write (LOCAL storage)**:
   - Attacker (any user with `DATA_ENTITY_ATTACHMENT_MANAGE` on any entity) uploads a file with `fileName: "../../../etc/odd-secret.txt"` and a payload that overwrites a secret file.
   - The chunk-staging at `/tmp/odd/chunks/<uploadId>/<index>` is NOT affected (the chunks are integer-indexed); but the COMPLETE phase calls `pathConstructor.getFilePath(fileName, dataEntityId)` which produces `attachment.local.path/<dataEntityId>/../../../etc/odd-secret.txt`. The resolved path is OUTSIDE the configured base directory.
   - Mitigation depends on (a) whether the platform process has write permission to the target path; (b) whether the file already exists at the target path (a clobber-write only succeeds with write permission).

2. **Path-traversal read (LOCAL storage)**:
   - Attacker uploads a file with `fileName: "../../../etc/passwd"` (or any file the platform process has READ permission to). The complete-call writes the chunks to the resolved out-of-base path; subsequent download-calls read from the same path.
   - More likely vector: read-traversal via `downloadFile(fileId)` — the `fileName` is fetched from the database; if an attacker has previously planted a file with a traversal-shaped name, subsequent downloads will read the planted path. But the path is database-keyed, so a downloader cannot SUPPLY a custom path — the attack vector is the upload-then-download chain.

3. **CRLF header injection on download** (LOCAL + REMOTE):
   - Attacker uploads a file with `fileName: "innocent.txt\r\nSet-Cookie: session=ATTACKER_SESSION_ID"`.
   - On download, the `Content-Disposition` header is constructed as `"attachment;filename=" + dto.fileName()` — the CRLF terminates the header value AND introduces a forged `Set-Cookie` header in the response.
   - Reflected to a victim who downloads the file (via a URL that the attacker shared with the victim) — the victim's browser sees a Set-Cookie + redirect / XSS / session-fixation depending on the attacker's payload.
   - Browser-side mitigations (HSTS, secure cookies, SameSite) reduce but do not eliminate the attack surface.

4. **Filename NUL-byte truncation** (REMOTE storage):
   - Attacker uploads `fileName: "innocent.txt\x00.exe"` — some clients / proxies / S3 SDKs truncate at NUL; the stored object's name is `innocent.txt` (so the database records `innocent.txt`) but the S3 object key may carry the full bytes (depends on the S3 SDK). Inconsistent behavior across clients = parsing surprises.

**Combined with the duplicate-rejection at INITIATE** (per ADR-CANDIDATE-165): the (dataEntityId, fileName) primary-key check at FileServiceImpl.java:47-54 operates on the raw unsanitized fileName. Two attackers can collide on the SAME logical filename if their unsanitized representations differ (e.g. one uses CRLF and the other uses LF in trailing bytes — depending on database collation).

**Evidence**:
- `FileMapper.java:30-31` — raw fileName propagated to storage path
- `LocalFilePathConstructor.java:31-33` — `Path.resolve(fileName)` — no `..` rejection
- `DataEntityAttachmentController.java:76-79` — raw fileName in Content-Disposition header
- absence of any `cleanFileName(...)`, `sanitizePath(...)`, `Path.normalize().startsWith(basePath)`, `validateNoCRLF(...)` calls anywhere in the upload pipeline (verified by full read of DataEntityAttachmentController.java, AttachmentServiceImpl.java, FileServiceImpl.java, LocalFileUploadServiceImpl.java, RemoteFileUploadServiceImpl.java)
- doc-side silence: the operator-facing attachment doc (`https://docs.opendatadiscovery.org/data-discovery/attachments` verified 2026-05-20, status 200) does not surface the filename-sanitization gap

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-165 (NEW batch V) codifies the 3-step chunked-upload protocol — this scope is the protocol's filename-sanitization gap (the (dataEntityId, fileName) primary key is the load-bearing logical identifier and SHOULD be sanitized at every tier).
- LSN-001 + LSN-002 retrospectives closed the attachment-storage doc-side loop on ephemerality + region; this scope is a NEW security-side gap not surfaced in LSN-001/-002.

**Proposed remedy**:

1. **Path A — Sanitize at INITIATE time**: at `FileServiceImpl.initiateUpload` (before line 47), apply a `cleanFileName(String raw)` helper:
   - REJECT (BadUserRequestException) if `fileName` contains `..`, `/`, `\\`, `\0`, `\r`, `\n`, control characters, or exceeds 255 bytes.
   - NORMALIZE leading/trailing whitespace + collapse multiple consecutive dots.
   - PRESERVE the cleaned filename through the rest of the pipeline.
2. **Path B — Sanitize at DOWNLOAD time**: at `DataEntityAttachmentController.downloadFile` (line 76-79), apply RFC 6266 quoting:
   - Use `ContentDisposition.attachment().filename(dto.fileName(), StandardCharsets.UTF_8).build()` — Spring's `ContentDisposition` builder handles RFC 6266 quoting + UTF-8 encoding (`filename*=UTF-8''...` syntax).
   - This closes the CRLF injection surface even if the stored filename slipped past Path A sanitization (defence-in-depth).
3. **Path C — Path-resolution defence at WRITE time**: at `LocalFilePathConstructor.getFilePath`, assert `resolvedPath.normalize().toAbsolutePath().startsWith(basePath.normalize().toAbsolutePath())`. Throw `IllegalStateException` if the path escapes the base. This is the structural defence against path-traversal even if Path A is bypassed.

All three paths should be applied (defence in depth). Path B is the cheapest and closes the highest-severity attack (CRLF injection); Path A is the cleanest and prevents downstream confusion; Path C is the structural guarantee.

**Severity rationale**: HIGH — multiple attack vectors (path-traversal read + write under LOCAL storage; CRLF header injection on download under LOCAL + REMOTE; cross-format truncation surprises under REMOTE); no sanitization at any tier; cross-link to the F-004 stored-XSS family (the Content-Disposition surface joins the description-edit surface as an HTML-context payload sink).

**Suggested backlog grouping**: `Attachment hardening sprint` — covers REFACTOR-484 (this), REFACTOR-481 (chunk-staging ephemerality), REFACTOR-058 (chunk staging path storage-INDEPENDENT — strengthened). Cross-link with the F-004 family (multi-batch backlog item: stored-XSS hardening across 5 surfaces).

---
