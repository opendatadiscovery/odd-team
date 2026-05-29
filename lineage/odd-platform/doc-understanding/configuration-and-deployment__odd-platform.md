---
doc_page: "docs/configuration-and-deployment/odd-platform.md"
page_title: "Configure ODD Platform"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/odd-platform"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Attachment Storage Backend"
    - "Attachment"
    - "GenAI Assistant"
    - "Housekeeping TTL retention"
    - "Notifications"
    - "Metrics Ingestion"
    - "Multi-Tenant Configuration (odd.tenant-id)"
    - "AlertManager Webhook Receiver"
    - "Slack collaboration app"
    - "Auth Mode"
    - "Activity Table Partitioning"
  features: []
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.config.properties config-properties-class:GenAIProperties"
    - "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.config config-properties-class:HousekeepingTTLProperties"
    - "odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:NotificationsProperties"
    - "odd-platform java org.opendatadiscovery.oddplatform.notification.config config-properties-class:EmailSenderProperties"
    - "odd-platform java org.opendatadiscovery.oddplatform.datacollaboration.config config-properties-class:DataCollaborationProperties"
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertManagerController"
    - "odd-platform java MinioConfig config-key-consumer:attachment.storage@L10"
    - "odd-platform java MinioConfig config-key-consumer:attachment.remote.url@L12"
    - "odd-platform java MinioConfig config-key-consumer:attachment.remote.access-key@L14"
    - "odd-platform java MinioConfig config-key-consumer:attachment.remote.secret-key@L16"
    - "odd-platform java RemoteFileUploadServiceImpl config-key-consumer:attachment.storage@L36"
    - "odd-platform java RemoteFileUploadServiceImpl config-key-consumer:attachment.remote.bucket@L39"
    - "odd-platform java LocalFileUploadServiceImpl config-key-consumer:attachment.storage@L26"
    - "odd-platform java AttachmentServiceImpl config-key-consumer:attachment.max-file-size@L27"
    - "odd-platform java CounterTimeSeriesExtractor config-key-consumer:metrics.storage@L20"
    - "odd-platform java MessageTablePartitionManager config-key-consumer:datacollaboration.message-partition-period@L19"
    - "odd-platform java ActivityTablePartitionManager config-key-consumer:odd.activity.partition-period@L11"
audience: [operator]
doc_claim_vs_code:
  - "Page (source_line 1028) presents `attachment.max-file-size` as 'maximum size per uploaded file' — an operator reads this as a server-side per-file guard. Code: `AttachmentServiceImpl` reads it ONLY into the `DataEntityUploadOptions.maxSize` payload served to the React UI for client-side file filtering; `uploadFileChunk` / `completeFileUpload` perform NO server-side per-file size re-validation. The only server-side ceiling is the transport-tier `spring.codec.max-in-memory-size` (DataBufferLimitException), which the page does document. Net: the per-file cap is a UI hint, not a server enforcement — a caller bypassing the UI can exceed `attachment.max-file-size` up to the codec ceiling. Evidence: odd-platform java AttachmentServiceImpl config-key-consumer:attachment.max-file-size@L27 / odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/AttachmentServiceImpl.java:27"
maintainer_curated: false
---

# Configure ODD Platform — doc understanding

This is the master post-deployment configuration reference for the running Platform — it documents essentially every `application.yml` key the Platform consumes, grouped by subsystem: PostgreSQL datasource + lookup-table `custom-datasource` fallback, security / actuator-exposure / credential hygiene (`auth.type` family → **Auth Mode**), HTTP session providers (`session.provider`, `spring.session.timeout`, `spring.data.redis.*`), metrics storage + OTLP export (`metrics.*` → **Metrics Ingestion**, **Multi-Tenant Configuration (odd.tenant-id)**), alert notifications (`notifications.*` → **Notifications**, confirmed via `NotificationsProperties` + `EmailSenderProperties`), the inbound Prometheus **AlertManager Webhook Receiver** (`POST /ingestion/alert/alertmanager`, confirmed via `AlertManagerController`), Data Collaboration (`datacollaboration.*` → **Slack collaboration app**, confirmed via `DataCollaborationProperties` + `MessageTablePartitionManager`), housekeeping retention (`housekeeping.*` → **Housekeeping TTL retention**, confirmed via `HousekeepingTTLProperties`), the platform-level `odd.*` settings (stale-period, `odd.tenant-id`, **Activity Table Partitioning** via `ActivityTablePartitionManager`, `odd.links`), **Attachment Storage Backend** (`attachment.*` → confirmed via `MinioConfig` / `RemoteFileUploadServiceImpl` / `LocalFileUploadServiceImpl` / `AttachmentServiceImpl`), logging, and the **GenAI Assistant** (`genai.*`, confirmed via `GenAIProperties`).

The page is the operator-facing home for the LSN-class silent-default caveats this workspace exists to protect: the **`LOCAL` attachment storage ephemeral default** (`/tmp/odd/attachments`, lost on restart — LSN-001) and the **AWS S3 `us-east-1` region pin** (MinIO client built without `.region(...)` — LSN-002) are both present as `danger`/`warning` admonitions in the Attachment Storage section, and the same silent-default framing is reused for the housekeeping `int`-default-`0` data-wipe (`HousekeepingTTLProperties`) and the `INTERNAL_POSTGRES` tenant-isolation gap (`odd.tenant-id` is PROMETHEUS-only). The page's caveat coverage is unusually complete — the cross-checked invariants (genai.request_timeout naming, tenant isolation, advisory-lock collision, housekeeping primitive default) are all already documented accurately. The one residual drift is the `attachment.max-file-size` framing (see frontmatter): the page implies a per-file server-side guard, but the key only drives client-side UI filtering — server-side enforcement exists solely at the `spring.codec.max-in-memory-size` transport tier. Audience is **operator** throughout (deployment / `application.yml` configuration); developer-facing API surfaces are cross-linked out to the API Reference and feature pages rather than documented here.

## Maintainer notes
