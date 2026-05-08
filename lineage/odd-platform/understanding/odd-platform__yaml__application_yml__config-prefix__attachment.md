---
node_id: "odd-platform yaml application.yml config-prefix:attachment"
node_kind: config-prefix
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-02
---

# attachment.* (config-prefix in application.yml:215-224) — semantic understanding

## understanding

The `attachment:` namespace declares the platform's file-attachment subsystem configuration: a single `storage` mode switch (`LOCAL` | `REMOTE`), a per-file `max-file-size` cap in megabytes, and two mode-specific sub-prefixes (`local.path` for filesystem storage, `remote.{url,access-key,secret-key,bucket}` for S3-compatible object storage). Spring routes the value of `attachment.storage` through `@ConditionalOnProperty` annotations on `MinioConfig`, `LocalFilePathConstructor`, `LocalFileUploadServiceImpl`, `RemoteFilePathConstructor`, and `RemoteFileUploadServiceImpl`, so the sub-prefix that an operator must populate is determined by the `storage` value (with `LOCAL` being `matchIfMissing = true` — the implicit default if the property is absent). The shipped defaults make the feature start cleanly out of the box but ship two operator-unsafe behaviours captured as separate retrospectives: LSN-001 (LOCAL writes to `/tmp/odd/attachments`, ephemeral on container restart) and LSN-002 (REMOTE pins to `us-east-1` because `MinioConfig` never calls `.region(...)`).

## concepts

- entities: [attachment storage backend, S3-compatible bucket, local filesystem path, attachment upload session, attachment file size cap]
- operations: [select storage mode (LOCAL/REMOTE), point LOCAL at a filesystem path, point REMOTE at an S3-compatible endpoint with credentials and bucket, cap per-file upload size]
- invariants: [`attachment.storage` is the single switch — `MATCH_IF_MISSING = true` for LOCAL means an empty/unset value resolves to LOCAL; `attachment.local.path` must be non-empty when LOCAL is active (`LocalFilePathConstructor.validate()` throws on empty); `attachment.remote.bucket` must be non-empty when REMOTE is active (`RemoteFileUploadServiceImpl.validate()` throws on empty); `attachment.max-file-size` is interpreted as megabytes and converted to bytes via `× 1_000_000` on the server (decimal MB, not binary MiB); the `attachment.remote.access-key` and `attachment.remote.secret-key` defaults are blank — REMOTE mode requires the operator to populate them]
- audiences: [platform operators (set via `application.yml`, env vars, or Helm values); React UI clients (read `attachment.max-file-size` indirectly via `DataEntityUploadOptions.maxSize`); MinIO / S3 service operators on the receiving end of REMOTE mode]

## dependencies_semantic

- requires-feature: [Spring Boot property-source resolution; Spring Boot `@ConditionalOnProperty` mode routing; MinIO Java SDK (`io.minio.MinioAsyncClient`) when REMOTE is active; Java NIO `Path` for LOCAL filesystem operations; the WebFlux multipart codec layer at `spring.codec.max-in-memory-size`]
- requires-config: [transport ceiling `spring.codec.max-in-memory-size` declared at `application.yml:14-15` (default `20MB`) — this prefix's `max-file-size` must not exceed it or uploads fail at the codec layer before any attachment-side check; nothing else in the YAML cross-couples to `attachment.*`]
- requires-runtime: [for LOCAL: a writable filesystem path that survives container restarts (NOT met by the default `/tmp/odd/attachments` on Kubernetes/Docker — see LSN-001); for REMOTE: network reachability to `attachment.remote.url`, valid credentials, a pre-existing bucket named `attachment.remote.bucket` (the platform does not create it), and — on AWS S3 specifically — a bucket in `us-east-1` because the SDK builder omits `.region(...)` (see LSN-002)]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [(1) bean-wiring under each `attachment.storage` value — that LOCAL→`LocalFile*` beans are constructed and REMOTE→`RemoteFile*` + `MinioAsyncClient` beans are constructed; (2) the `matchIfMissing = true` semantics of LOCAL — that an unset `attachment.storage` boots the LOCAL beans; (3) `LocalFilePathConstructor.validate()` blank-path failure mode; (4) `RemoteFileUploadServiceImpl.validate()` blank-bucket failure mode; (5) end-to-end upload + download under LOCAL and REMOTE with realistic file sizes; (6) the regional caveat captured in LSN-002 (REMOTE against a non-`us-east-1` AWS bucket fails with `AuthorizationHeaderMalformed` / `PermanentRedirect`)]
- test_files: []
- gaps: |
    There is no test file in `odd-platform-api/src/test` that references the `attachment` prefix, `MinioConfig`, `LocalFilePathConstructor`, `LocalFileUploadServiceImpl`, `RemoteFilePathConstructor`, or `RemoteFileUploadServiceImpl` — verified 2026-05-08 by `find odd-platform -path "*/test/*" -name "*.java" | xargs grep -l "attachment"` returning empty. Both LSN-001 (ephemerality) and LSN-002 (us-east-1 pin) are exactly the failure modes a contract-style integration test against a Testcontainers-MinIO instance pointed at `eu-west-1` would have caught. The two highest-leverage missing tests are: (a) a wiring test that asserts each `attachment.storage` value selects the correct bean set, and (b) a Testcontainers integration test that verifies REMOTE mode against a non-default region — both would prevent silent-data-loss regressions in this prefix.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#attachment-storage-configuration"
    rationale: "The published `Attachment Storage Configuration` section is the canonical operator-facing home for every key under the `attachment.*` YAML prefix, including the storage-mode switch, the LOCAL path, the REMOTE S3 settings, and the max-file-size cap. There is no `@docs` annotation in `application.yml`; the link is inferred from the existing documentation page."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-08 (status 200, anchor `attachment-storage-configuration` present in page TOC):
    > "**`attachment.storage`**: Accepts `LOCAL` or `REMOTE`. Defaults to `LOCAL`."
    > "**`attachment.local.path`**: Directory path for file storage. Defaults to `/tmp/odd/attachments` (ephemeral)."
    > "The default LOCAL storage mode is ephemeral. Attachments are written to /tmp/odd/attachments inside the ODD Platform container filesystem. Any container or pod restart — routine deployment, node drain, crash, Kubernetes eviction — permanently deletes all uploaded files."
    > "Use REMOTE (S3 / MinIO) storage for any Kubernetes or Docker deployment where users will actually upload attachments. LOCAL mode is suitable only for single-host evaluations or local development where losing attachments on restart is acceptable."
    > Known limitations (REMOTE mode): "**AWS S3 region pinned to `us-east-1`.** The attachment client is built without an explicit region, so it uses the MinIO Java SDK's default region (`us-east-1`) for request signing. Against **AWS S3 this means only buckets in `us-east-1` work** — buckets in any other region fail signature validation with errors such as `AuthorizationHeaderMalformed` or `PermanentRedirect`. If you need AWS S3 in another region, either host your bucket in `us-east-1` or use a MinIO server in front of it. Self-hosted MinIO and most other S3-compatible services ignore the region header and are unaffected."
    > Known limitations (REMOTE mode): "**HTTP client timeouts are the MinIO SDK defaults (\~5 minutes), not configurable.** ODD Platform does not supply a custom `OkHttpClient` to the MinIO builder, so the SDK's built-in defaults apply: roughly a 5-minute read/write timeout."
    > Known limitations (REMOTE mode): "Chunked uploads are assembled on the container's local filesystem before they are sent to `REMOTE` storage — a mid-upload container restart loses the staged chunks."
    > Example LOCAL YAML on the live page uses `path: /var/lib/odd/attachments` (a persistable path), explicitly diverging from the `application.yml` shipped default `/tmp/odd/attachments`.
- doc_drift_findings:
  - "The shipped `application.yml:219` default for `attachment.local.path` is `/tmp/odd/attachments`; the live doc page's LOCAL example renders `/var/lib/odd/attachments` instead, with the explicit caveat that the shipped default is ephemeral. The doc therefore correctly documents the LSN-001 trap and recommends a different path, but the YAML default the operator inherits has not been changed. An operator who copies the doc example overrides the trap; an operator who relies on the YAML default falls into it."
  - "The live doc page mentions a chunked-upload restart hazard for REMOTE mode (`mid-upload container restart loses the staged chunks`), which is consistent with `RemoteFileUploadServiceImpl.completeFileUpload` reading the chunk directory off the local filesystem (FileUtils.getChunkDirectory). The chunk-staging directory is shared across LOCAL and REMOTE — the same hazard applies to LOCAL when the container restarts mid-upload, but the doc only calls it out under REMOTE. Mild scoping drift, not a contradiction."

## implicit_adrs

- "Storage-mode selection is a Spring `@ConditionalOnProperty` switch on `attachment.storage`, not a runtime strategy lookup — beans are wired at boot per the active mode, and switching modes requires a restart." — evidence: MinioConfig.java:10 + LocalFileUploadServiceImpl.java:26 + LocalFilePathConstructor.java:13 + RemoteFileUploadServiceImpl.java:36 + RemoteFilePathConstructor.java:10 — confidence: HIGH
- "LOCAL is the implicit default when `attachment.storage` is unset (`matchIfMissing = true` on the LOCAL `@ConditionalOnProperty` annotations). The shipped `application.yml:216` value `LOCAL` is redundant defence-in-depth; an operator who deletes the line still gets LOCAL beans." — evidence: LocalFilePathConstructor.java:13 + LocalFileUploadServiceImpl.java:26 + application.yml:216 — confidence: HIGH
- "REMOTE storage is S3-compatible-only, and specifically targets the MinIO SDK rather than AWS SDK v2 — the `MinioAsyncClient` builder is the only client constructed, and there is no AWS-specific code path." — evidence: MinioConfig.java:3 + MinioConfig.java:20-25 + RemoteFileUploadServiceImpl.java:3-8 — confidence: HIGH
- "The `attachment.remote.bucket` is operator-supplied and must pre-exist — neither `MinioConfig` nor `RemoteFileUploadServiceImpl` calls `bucketExists` or `makeBucket`. Boot succeeds against a non-existent bucket; the failure surfaces only on the first upload attempt." — evidence: MinioConfig.java:1-26 (no bucket-creation call) + RemoteFileUploadServiceImpl.java:45-50 (only validates non-empty, not existence) — confidence: HIGH
- "Per-file size enforcement is delegated downstream — the YAML `max-file-size` cap is consumed exclusively by `AttachmentServiceImpl.getUploadOptions()` to populate a UI hint, and no service-layer or controller-layer guard re-validates against it. The cap is a UX boundary, not a security boundary, at this prefix's level." — evidence: AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:60-62 + RemoteFileUploadServiceImpl.java:60-77 (no size check) + LocalFileUploadServiceImpl.java:43-52 (no size check) — confidence: HIGH

## bugs_limitations_corner_cases

- "LSN-001 — LOCAL default is ephemeral on container restart. The shipped default of `attachment.local.path: /tmp/odd/attachments` lives inside the container filesystem; Kubernetes (any pod restart, eviction, deployment), Docker (any `docker stop`/`docker rm`), and most container schedulers wipe `/tmp` on container lifecycle events. An operator following the shipped defaults silently loses every uploaded attachment on the first restart. The live doc page documents this and recommends `/var/lib/odd/attachments` + a persistent volume; the YAML still ships `/tmp/odd/attachments` as the default." — evidence: application.yml:218-219 + LocalFilePathConstructor.java:14-23 + retrospectives/LSN-001-attachment-ephemeral-default.md — severity: HIGH
- "LSN-002 — REMOTE on AWS S3 silently restricted to `us-east-1`. `MinioConfig.minioClient()` constructs `MinioAsyncClient.builder()` with `.endpoint()` + `.credentials()` only, never `.region(...)`. The MinIO SDK defaults the region to `us-east-1` for SigV4 signing; AWS S3 buckets in any other region reject the request with `AuthorizationHeaderMalformed` or `PermanentRedirect`. Self-hosted MinIO is unaffected because it ignores the region header. The live doc page documents this; there is no way to fix it from the YAML — the constraint is in the bean factory." — evidence: MinioConfig.java:19-25 (no `.region(...)` call) + retrospectives/LSN-002-minio-region-unset.md — severity: HIGH
- "REMOTE bucket is not auto-created and not auto-validated for existence at boot. `RemoteFileUploadServiceImpl.validate()` only checks the bucket *name* is non-empty (line 46-50). An operator who mistypes the bucket or points at a non-existent one boots cleanly and only sees the failure on the first upload, by which time the upload UI has accepted the file and consumed user time." — evidence: MinioConfig.java:1-26 + RemoteFileUploadServiceImpl.java:45-50 — severity: MEDIUM
- "Chunk-staging directory is operator-invisible filesystem state shared across LOCAL and REMOTE. Both `LocalFileUploadServiceImpl.initiateUpload` (line 32-41) and `RemoteFileUploadServiceImpl.initiateUpload` (line 53-58) write incoming chunks to `FileUtils.getChunkDirectory(uploadId)` on the container's local filesystem before assembling and forwarding. A container restart mid-upload loses the staged chunks regardless of `attachment.storage` mode. The live doc only flags this for REMOTE; the LOCAL hazard is symmetric." — evidence: LocalFileUploadServiceImpl.java:32-52 + RemoteFileUploadServiceImpl.java:53-77 — severity: MEDIUM
- "MinIO SDK HTTP-client timeouts (~5 minutes per the live doc) are not exposed at this YAML prefix. `MinioConfig` builds `MinioAsyncClient` with no custom `OkHttpClient`, so the SDK defaults apply globally to all REMOTE operations. There is no `attachment.remote.timeout` knob; tuning requires a code change. Slow networks combined with a large `attachment.max-file-size` produce unrecoverable socket timeouts on uploads that would otherwise complete." — evidence: MinioConfig.java:19-25 (no `.httpClient(...)` call) + WebFetch live doc excerpt above — severity: MEDIUM
- "REMOTE credentials are stored as plain `@Value`-injected strings — there is no integration with Spring Cloud Config, Vault, AWS IAM instance profiles, or environment-injected secret stores beyond Spring's standard property-source resolution. An operator who wants IAM-role-based S3 access (no static keys) cannot achieve it from the YAML; the only path is environment variables containing the static keys." — evidence: MinioConfig.java:14-17 + application.yml:222-223 — severity: LOW
- "Boot-time crash if `attachment.max-file-size` is unset: `AttachmentServiceImpl` declares `@Value(\"${attachment.max-file-size}\")` with no `:default` fallback and a boxed `Integer` type. The shipped `application.yml:217` value of `20` is the only safety net — an operator overriding it to blank via env (`ATTACHMENT_MAX_FILE_SIZE=`) gets a Spring property-resolution failure at startup." — evidence: AttachmentServiceImpl.java:27 + application.yml:217 — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a YAML configuration namespace, not an HTTP endpoint. The `attachment.*` keys are read at bean-construction time by `@Value`-injected consumers (`MinioConfig`, `AttachmentServiceImpl`, `LocalFilePathConstructor`, `LocalFileUploadServiceImpl`, `RemoteFilePathConstructor`, `RemoteFileUploadServiceImpl`, etc.) which run server-side inside the platform process. They themselves are gated only by whichever `auth.type` (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`) protects the controllers (`DataEntityController.uploadAttachment`, `AttachmentController`) that ultimately invoke them. The config values do not change behaviour based on the active auth mode.
- **ingestion_filter_relevance**: `N/A — config namespace, not HTTP path`. The `attachment.*` prefix is not on the `/ingestion/entities` filter chain; uploads flow through the UI/API surface.
- **authorization_assertions**: `[]`. The 11 consumer references of `attachment.*` (`MinioConfig.java:14-17`, `AttachmentServiceImpl.java:27`, `LocalFilePathConstructor.java:13-14`, `LocalFileUploadServiceImpl.java:26`, `RemoteFilePathConstructor.java:10-11`, `RemoteFileUploadServiceImpl.java:36-39`, plus their callers) inherit authorization from the controllers that call them — no permission/policy assertion lives on the config-prefix consumers themselves.
- **owner_scoping**: `N/A — global config`. `attachment.*` is a process-wide configuration; the values do not vary per Owner / per User and are not data-scoped.
- **data_exposure**:
  - `"attachment.remote.access-key + attachment.remote.secret-key (S3 credentials, plain string in YAML) → exposed via /actuator/env to any caller able to reach the actuator port (default: same port as app, no separate management port)"` — evidence: application.yml:222-223 (plain-text key/secret declaration) + application.yml:226-242 (`management.endpoints.web.exposure.include: health, prometheus, env, info`; `endpoint.env.enabled: true`) + findings/docs-coverage-undocumented-features/2026-05-08.md F-054.
  - `"attachment.remote.url (S3 endpoint URL) → exposed via /actuator/env"` — evidence: application.yml:221 + application.yml:230-231.
  - `"attachment.local.path (filesystem path) → exposed via /actuator/env, no infosec impact directly but reveals deployment topology"` — evidence: application.yml:218-219 + application.yml:230-231.
- **known_security_gaps**:
  - `"S3 credentials (attachment.remote.access-key, attachment.remote.secret-key) are exposed via /actuator/env by default. Spring Boot Actuator's default exposure list — set in this same application.yml at line 230-231 (management.endpoints.web.exposure.include: health, prometheus, env, info) with endpoint.env.enabled: true at line 237-238 — surfaces every PropertySource value, including @Value-injected credentials. Spring masks values whose key matches a sanitisation pattern (default: password, secret, key, token, ...) — the access-key and secret-key keys do match the default sanitisation pattern, so the values render as '******' in the JSON response. However, the keys themselves (and their non-empty/empty status) are still visible, and the masking can be disabled or weakened by misconfiguring management.endpoint.env.show-values. Any operator who exposes the actuator port externally (no separate management.server.port set, no network-level isolation) leaks credential metadata to unauthenticated callers." — evidence: application.yml:222-223 + application.yml:226-242 + findings/docs-coverage-undocumented-features/2026-05-08.md F-054 (severity: high) — severity: HIGH
  - `"S3 credentials cannot be sourced from a secret store (Vault, AWS IAM instance profile, Kubernetes Secret as files) without going through Spring property-source resolution as plain strings. There is no SDK-level integration that would let MinioConfig consume an IAM role or a file-mounted secret reference; the only path is to inject the literal access-key/secret-key as env vars or YAML. This compounds the /actuator/env exposure — an operator who would otherwise mitigate by avoiding plain-text credentials cannot." — evidence: MinioConfig.java:14-17 + application.yml:222-223 — severity: MEDIUM
  - `"max-file-size is a UI hint, not a security boundary. AttachmentServiceImpl.getUploadOptions() converts attachment.max-file-size × 1_000_000 and surfaces it as DataEntityUploadOptions.maxSize for the React client (AttachmentServiceImpl.java:60-62). Neither LocalFileUploadServiceImpl nor RemoteFileUploadServiceImpl re-validates incoming chunks against this cap (LocalFileUploadServiceImpl.java:43-52, RemoteFileUploadServiceImpl.java:60-77). A malicious client that bypasses the UI and posts directly to the upload API can submit files larger than max-file-size — the only enforcement that actually fires is spring.codec.max-in-memory-size (20MB at application.yml:14-15), which is a transport-layer cap, not an attachment-layer one. This is a documented Cornerstone 3 (configuration is a separate audience surface) gap: operators reading the config believe max-file-size limits uploads; it limits only the UI-presented upload size." — evidence: AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:60-62 + LocalFileUploadServiceImpl.java:43-52 + RemoteFileUploadServiceImpl.java:60-77 + application.yml:14-15 + application.yml:217 — severity: MEDIUM

## performance

- **hot_paths**: `[]` — config values are read at @Value injection time (one-shot at bean construction during Spring context startup). They are not on the per-request critical path. The downstream consumers (`LocalFileUploadServiceImpl.uploadPart`, `RemoteFileUploadServiceImpl.uploadPart`, `AttachmentServiceImpl.getUploadOptions`) read the resolved fields from already-injected instance state, not the property source.
- **throughput_characteristics**: `N/A — config prefix, not a request handler`. Throughput characteristics live on the consuming services (chunked upload via `initiateFileUpload` + `uploadPart` + `completeFileUpload`); see the per-consumer sidecars for those (`LocalFileUploadServiceImpl`, `RemoteFileUploadServiceImpl`).
- **resource_allocation**:
  - `"attachment.max-file-size (default 20, interpreted as MB → 20_000_000 bytes via AttachmentServiceImpl.java:60-62) bounds the per-upload size the UI advertises to clients. The actual buffering ceiling is spring.codec.max-in-memory-size = 20MB at application.yml:14-15 — both happen to coincide at 20MB by default, but they are independent knobs and an operator who raises one without the other will hit the codec cap before the attachment cap."` — evidence: application.yml:14-15 + application.yml:217 + AttachmentServiceImpl.java:60-62.
  - `"attachment.local.path determines where the LOCAL backend writes — if pointed at a tmpfs mount or a small disk volume, the storage capacity is bounded by that filesystem, not by anything in this prefix. There is no quota check at the prefix level."` — evidence: application.yml:218-219 + LocalFilePathConstructor.java:14-23.
  - `"attachment.remote.url + .access-key + .secret-key + .bucket determine the REMOTE S3 target — capacity is bounded by the S3-compatible service the operator provisioned. The MinIO SDK creates one MinioAsyncClient bean per Spring context (MinioConfig.java:10-25); it is reused across uploads, so per-request allocation is bounded by the SDK's connection-pool defaults (no custom OkHttpClient is supplied, so SDK defaults apply)."` — evidence: MinioConfig.java:10-25 + application.yml:220-224.
- **scaling_characteristics**:
  - `"Cluster-wide single config — every replica reads the same attachment.* values at boot. There is no per-replica override mechanism; all replicas point at the same LOCAL path or the same REMOTE bucket."` — evidence: application.yml:215-224 (one prefix block, no replica-aware indirection) + Spring Boot @Value/property-source standard behaviour.
  - `"LOCAL mode does not horizontally scale beyond one replica that owns the filesystem path. Two replicas pointed at the same attachment.local.path on a shared volume can race on chunk-staging directories (FileUtils.getChunkDirectory(uploadId)) — the staging path is keyed by uploadId only, no replica id; cross-replica chunk assembly is undefined. Helm/Kubernetes deployments running >1 replica with LOCAL storage are effectively broken; the LSN-001 ephemeral-default trap masks this because operators rarely persist /tmp anyway."` — evidence: application.yml:218-219 + LocalFileUploadServiceImpl.java:32-52 + retrospectives/LSN-001-attachment-ephemeral-default.md — severity-relevant for `known_performance_gaps` below.
  - `"REMOTE mode horizontally scales because the S3-compatible service is the source of truth. Replicas may still race on the local chunk-staging directory during multipart upload (RemoteFileUploadServiceImpl.java:53-77 reads/writes FileUtils.getChunkDirectory before forwarding to S3), but the assembled object is the bucket's responsibility."` — evidence: RemoteFileUploadServiceImpl.java:53-77 + MinioConfig.java:10-25.
- **known_performance_gaps**:
  - `"attachment.max-file-size = 20 MB ceiling may be too low for realistic data-platform uploads (large CSV samples, ML model artefacts, schema dumps). There is no operator-facing guidance on what to raise it to or what the trade-offs are; raising it past spring.codec.max-in-memory-size (also 20MB at application.yml:14-15) silently fails at the codec layer with DataBufferLimitException, not at the attachment layer with a friendlier error. F-056 in findings/docs-coverage-undocumented-features/2026-05-08.md captures the cross-coupling doc gap."` — evidence: application.yml:14-15 + application.yml:217 + findings/docs-coverage-undocumented-features/2026-05-08.md F-056 — severity: MEDIUM
  - `"attachment.storage = LOCAL (the shipped default per application.yml:216 + matchIfMissing=true on the LOCAL beans) does not horizontally scale and is ephemeral on the default path /tmp/odd/attachments (LSN-001). Operators running >1 replica or any container scheduler need REMOTE; the YAML defaults do not communicate this performance/scaling reality. The bugs_limitations_corner_cases LSN-001 entry already captures the data-loss angle; the scaling-cap angle is the same root cause."` — evidence: application.yml:216-219 + LocalFilePathConstructor.java:13-23 + LocalFileUploadServiceImpl.java:26-52 + retrospectives/LSN-001-attachment-ephemeral-default.md — severity: HIGH
  - `"REMOTE mode's MinIO SDK HTTP timeouts (~5 minutes per the live doc) are not configurable via this prefix — large attachments combined with slow networks produce unrecoverable socket timeouts. There is no attachment.remote.timeout knob. The bugs_limitations_corner_cases entry above captures this from the operator-config angle; from the performance angle, throughput is bounded by the SDK's default OkHttpClient settings."` — evidence: MinioConfig.java:19-25 (no .httpClient(...) call) + WebFetch live doc excerpt above — severity: MEDIUM

## sources

- understanding ← application.yml:215-224 + MinioConfig.java:10 + LocalFilePathConstructor.java:13 + LocalFileUploadServiceImpl.java:26 + RemoteFileUploadServiceImpl.java:36 + retrospectives/LSN-001-attachment-ephemeral-default.md + retrospectives/LSN-002-minio-region-unset.md
- concepts.entities ← application.yml:215-224 + MinioConfig.java:11-26 + LocalFilePathConstructor.java:14-34
- concepts.operations ← application.yml:216 + application.yml:218-219 + application.yml:220-224 + application.yml:217
- concepts.invariants.matchIfMissing ← LocalFilePathConstructor.java:13 + LocalFileUploadServiceImpl.java:26
- concepts.invariants.local-path-validation ← LocalFilePathConstructor.java:18-23
- concepts.invariants.remote-bucket-validation ← RemoteFileUploadServiceImpl.java:45-50
- concepts.invariants.MB-decimal-conversion ← AttachmentServiceImpl.java:61
- concepts.invariants.blank-credentials-default ← application.yml:222-223
- dependencies_semantic.requires-feature ← MinioConfig.java:3 + LocalFilePathConstructor.java:4-5 + RemoteFileUploadServiceImpl.java:3-8 + LocalFilePathConstructor.java:13 (ConditionalOnProperty)
- dependencies_semantic.requires-config.spring.codec ← application.yml:14-15 (verified by Read offset around shipping defaults — same file)
- dependencies_semantic.requires-runtime.LOCAL ← LocalFilePathConstructor.java:14-23 + LocalFileUploadServiceImpl.java:32-41 + retrospectives/LSN-001-attachment-ephemeral-default.md
- dependencies_semantic.requires-runtime.REMOTE ← MinioConfig.java:19-25 + RemoteFileUploadServiceImpl.java:45-50 + retrospectives/LSN-002-minio-region-unset.md
- tests_coverage_semantic.gaps ← Grep result: no `*.java` test under `odd-platform-api/src/test` references `attachment`, `MinioConfig`, `Local*Constructor`, `Local*Upload*`, `Remote*Constructor`, or `Remote*Upload*` (verified 2026-05-08)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform on 2026-05-08, status 200, anchor `attachment-storage-configuration` present in page TOC at position 36
- docs_link_semantic.fetched_excerpts ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#attachment-storage-configuration on 2026-05-08, status 200
- docs_link_semantic.doc_drift_findings.[0] ← application.yml:219 vs WebFetched LOCAL example excerpt `path: /var/lib/odd/attachments`
- docs_link_semantic.doc_drift_findings.[1] ← LocalFileUploadServiceImpl.java:32-52 + RemoteFileUploadServiceImpl.java:53-77 vs WebFetched "Known limitations (REMOTE mode)" chunk-staging excerpt
- implicit_adrs.[0] ← MinioConfig.java:10 + LocalFileUploadServiceImpl.java:26 + LocalFilePathConstructor.java:13 + RemoteFileUploadServiceImpl.java:36 + RemoteFilePathConstructor.java:10
- implicit_adrs.[1] ← LocalFilePathConstructor.java:13 + LocalFileUploadServiceImpl.java:26 + application.yml:216
- implicit_adrs.[2] ← MinioConfig.java:3 + MinioConfig.java:20-25 + RemoteFileUploadServiceImpl.java:3-8
- implicit_adrs.[3] ← MinioConfig.java:1-26 + RemoteFileUploadServiceImpl.java:45-50
- implicit_adrs.[4] ← AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:60-62 + RemoteFileUploadServiceImpl.java:60-77 + LocalFileUploadServiceImpl.java:43-52
- bugs_limitations_corner_cases.[0] ← application.yml:218-219 + LocalFilePathConstructor.java:14-23 + retrospectives/LSN-001-attachment-ephemeral-default.md
- bugs_limitations_corner_cases.[1] ← MinioConfig.java:19-25 + retrospectives/LSN-002-minio-region-unset.md
- bugs_limitations_corner_cases.[2] ← MinioConfig.java:1-26 + RemoteFileUploadServiceImpl.java:45-50
- bugs_limitations_corner_cases.[3] ← LocalFileUploadServiceImpl.java:32-52 + RemoteFileUploadServiceImpl.java:53-77
- bugs_limitations_corner_cases.[4] ← MinioConfig.java:19-25 + WebFetch live doc excerpt
- bugs_limitations_corner_cases.[5] ← MinioConfig.java:14-17 + application.yml:222-223
- bugs_limitations_corner_cases.[6] ← AttachmentServiceImpl.java:27 + application.yml:217
- security.auth_mode_relevance ← application.yml:215-224 (config namespace, no HTTP path) + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-08, status 200 (auth modes: DISABLED / LOGIN_FORM / OAUTH2 / LDAP enumerated)
- security.ingestion_filter_relevance ← application.yml:215-224 (no /ingestion path coupling) + application.yml:46-48 (auth.ingestion.filter.enabled is the gating switch and lives outside this prefix)
- security.authorization_assertions ← MinioConfig.java:14-17 + AttachmentServiceImpl.java:27 + LocalFilePathConstructor.java:13-14 + LocalFileUploadServiceImpl.java:26 + RemoteFilePathConstructor.java:10-11 + RemoteFileUploadServiceImpl.java:36-39 (consumers carry no @PreAuthorize / programmatic permission gate)
- security.owner_scoping ← application.yml:215-224 (process-wide config, no Owner/User indirection)
- security.data_exposure.[0-2] ← application.yml:222-223 + application.yml:226-242 + findings/docs-coverage-undocumented-features/2026-05-08.md F-054 + retrospectives/LSN-001-attachment-ephemeral-default.md
- security.known_security_gaps.[0] ← application.yml:222-223 + application.yml:226-242 + findings/docs-coverage-undocumented-features/2026-05-08.md F-054 (severity: high)
- security.known_security_gaps.[1] ← MinioConfig.java:14-17 + application.yml:222-223
- security.known_security_gaps.[2] ← AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:60-62 + LocalFileUploadServiceImpl.java:43-52 + RemoteFileUploadServiceImpl.java:60-77 + application.yml:14-15 + application.yml:217
- performance.hot_paths ← application.yml:215-224 + AttachmentServiceImpl.java:27 + AttachmentServiceImpl.java:60-62 (one-shot @Value injection, not per-request)
- performance.throughput_characteristics ← LocalFileUploadServiceImpl.java:32-52 + RemoteFileUploadServiceImpl.java:53-77 (consumers, deferred to per-consumer sidecars)
- performance.resource_allocation.[0] ← application.yml:14-15 + application.yml:217 + AttachmentServiceImpl.java:60-62
- performance.resource_allocation.[1] ← application.yml:218-219 + LocalFilePathConstructor.java:14-23
- performance.resource_allocation.[2] ← MinioConfig.java:10-25 + application.yml:220-224
- performance.scaling_characteristics.[0] ← application.yml:215-224
- performance.scaling_characteristics.[1] ← application.yml:218-219 + LocalFileUploadServiceImpl.java:32-52 + retrospectives/LSN-001-attachment-ephemeral-default.md
- performance.scaling_characteristics.[2] ← RemoteFileUploadServiceImpl.java:53-77 + MinioConfig.java:10-25
- performance.known_performance_gaps.[0] ← application.yml:14-15 + application.yml:217 + findings/docs-coverage-undocumented-features/2026-05-08.md F-056
- performance.known_performance_gaps.[1] ← application.yml:216-219 + LocalFilePathConstructor.java:13-23 + LocalFileUploadServiceImpl.java:26-52 + retrospectives/LSN-001-attachment-ephemeral-default.md
- performance.known_performance_gaps.[2] ← MinioConfig.java:19-25 + WebFetch live doc excerpt

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

