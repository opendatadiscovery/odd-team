---
doc_page: "docs/data-discovery/attachments.md"
page_title: "Data Entity Attachments"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/attachments"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/attachments"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Attachment"
    - "Attachment Storage Backend"
    - "Chunked File Upload (3-step state machine)"
    - "List Data Entity Attachments"
  features:
    - "F-027"
  code_nodes:
    - "odd-platform java DataEntityAttachmentController controller-method:initiateFileUpload"
    - "odd-platform java DataEntityAttachmentController controller-method:uploadFileChunk"
    - "odd-platform java DataEntityAttachmentController controller-method:completeFileUpload"
    - "odd-platform yaml application.yml config-prefix:attachment"
    - "odd-platform java MinioConfig config-key-consumer:attachment.storage@L10"
    - "odd-platform java LocalFilePathConstructor config-key-consumer:attachment.storage@L13"
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "LOW drift — the live page now carries danger admonitions for BOTH the ephemeral-LOCAL-storage data-loss class (LSN-001) and the cross-entity authorization-bypass class on attachment mutation endpoints; verified against MinioConfig/LocalFilePathConstructor (attachment.storage consumers) and the privilege-escalation invariant. Earlier batches flagged these as undocumented; the page has since been corrected. Re-confirm on each refresh."
maintainer_curated: false
---

# Data Entity Attachments — doc understanding

This page is the operator + data-consumer surface for attaching files and links
to a data entity. It documents the three-step chunked upload (initiate →
uploadChunk → complete, the `DataEntityAttachmentController` methods), the
operator-configurable storage backend (`attachment.storage` — LOCAL vs REMOTE
S3, consumed by `MinioConfig` and `LocalFilePathConstructor`), and the RBAC
model. It maps to feature **F-027 (Attachment Lifecycle)** and the `Attachment`
/ `Attachment Storage Backend` concepts.

The page is notable as a corrected-drift exemplar: it now warns operators about
the ephemeral-LOCAL-storage data-loss default (LSN-001 class) and the
attachment-mutation authorization-bypass risk — both of which the substrate
previously surfaced as undocumented. The doc↔code DESCRIBES links make that
correspondence auditable on every refresh.

## Maintainer notes
First doc-understanding sidecar — authored during the ground-truth-lineage
Phase-1 build as the end-to-end validation of the DESCRIBES path. The remaining
101 pages are produced by the `doc-analyser` subagent via `/ingest-docs`.
