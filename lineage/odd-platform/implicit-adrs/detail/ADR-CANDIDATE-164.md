## ADR-CANDIDATE-164 — Attachment storage backend is selected by Spring `@ConditionalOnProperty` on each implementation bean — exactly ONE `FileUploadService` + ONE `FilePathConstructor` exist at runtime, LOCAL is the default-on stance via `matchIfMissing=true`

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; POSITIVE-INTENT)
**Pillars affected**: [P-01-data-discovery (attachment subsurface), P-08-management-administration (deployment operator)]
**Support count**: 1 sidecar primary-source (batch V DataEntityAttachmentController class) + cross-batch corroboration with 2026-05-08 DataEntityAttachmentController class sidecar (the per-class storage strategy was implicit in batch-base findings but not promoted to ADR until batch V)
**Axes present**: controllers, config-key-consumer (cross-referenced)
**Batch**: V (2026-05-20)

**Surfaced by**:
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:implicit_adrs.[1]` (HIGH) — "Storage backend (LOCAL filesystem vs REMOTE S3-compatible) is selected by Spring `@ConditionalOnProperty` on each implementation bean — exactly one `FileUploadService` and one `FilePathConstructor` exist at runtime, and `LOCAL` is the default-on stance via `matchIfMissing=true`." — evidence: LocalFilePathConstructor.java:13 (`@ConditionalOnProperty(value = "attachment.storage", havingValue = "LOCAL", matchIfMissing = true)`) + LocalFileUploadServiceImpl.java:26 (same) + RemoteFilePathConstructor.java:10 (`havingValue = "REMOTE"`) + RemoteFileUploadServiceImpl.java:36 (same) — intent_anchor: "`@ConditionalOnProperty(value = "attachment.storage", havingValue = "LOCAL", matchIfMissing = true)`" — confidence: HIGH

**Decision statement**: Two attachment storage implementation strategies (LOCAL filesystem at `attachment.local.path`, default `/tmp/odd/attachments`; REMOTE S3-compatible at `attachment.remote.*`) are wired by MIRRORED `@ConditionalOnProperty(value = "attachment.storage", havingValue = "<LOCAL|REMOTE>", matchIfMissing = true|absent)` on FOUR implementation beans:

- `LocalFilePathConstructor.java:13` — `havingValue = "LOCAL", matchIfMissing = true`
- `LocalFileUploadServiceImpl.java:26` — `havingValue = "LOCAL", matchIfMissing = true`
- `RemoteFilePathConstructor.java:10` — `havingValue = "REMOTE"` (no matchIfMissing)
- `RemoteFileUploadServiceImpl.java:36` — `havingValue = "REMOTE"` (no matchIfMissing)

The `matchIfMissing=true` on LOCAL is a DELIBERATE default-on choice — `attachment.storage` is OPTIONAL in `application.yml` and absence means LOCAL. The runtime guarantees exactly ONE `FileUploadService` and exactly ONE `FilePathConstructor` exists; Spring's bean-construction phase fails fast at boot if both LOCAL and REMOTE branches activate (impossible by mutually-exclusive `havingValue`) or if neither activates (impossible because LOCAL has `matchIfMissing=true`).

Two `@PostConstruct` validators close the boot-wiring loop:
- LOCAL: `LocalFilePathConstructor.java:18-23` — `if (StringUtils.isEmpty(basePath)) throw new IllegalStateException("Local base path property can't be empty");`
- REMOTE: `RemoteFileUploadServiceImpl.java:45-50` — `if (StringUtils.isEmpty(bucket)) throw new IllegalStateException("Bucket can't be empty");`

Both validators throw `IllegalStateException` (boot-wiring class) rather than `ConstraintViolationException` (request-validation class) — consistent with the ADR-CANDIDATE-018 family pattern that frames config-binding failures as deployment errors, not request errors.

The architectural commitments:
- **(a) The default-on LOCAL stance is the platform's deliberate ergonomic choice** — `docker run odd-platform` boots without any attachment-storage config and produces a working catalog. The LOCAL ephemerality consequence (LSN-001) is doc-only mitigated; the code wiring DOES not warn at boot when running in a Kubernetes deployment.
- **(b) The two storage backends are MUTUALLY EXCLUSIVE.** A third backend (e.g. Azure Blob, GCS) requires adding another `@ConditionalOnProperty` branch with another `havingValue`, plus extending the implementation-bean enumeration. The convention is OPEN to extension but the existing two backends are CLOSED to overlap.
- **(c) The fail-fast validators are PER-MODE** — REMOTE bucket cannot be empty; LOCAL base path cannot be empty. Both validate the active mode's required config; the inactive mode's config is ignored.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the mirrored `@ConditionalOnProperty` with `matchIfMissing=true` on LOCAL is the signature of a deliberate default-on choice; the parallel `@PostConstruct` validators show explicit boot-wiring intent.
2. **Structural impact?** YES — the two-backend mutual-exclusivity is a deployment-architecture decision; every operator deploying ODD-Platform sees either LOCAL or REMOTE behaviour, with no overlap mode; future backends extend the pattern; the LSN-001 default-on consequence is structurally encoded.
3. **Refactoring or structural?** STRUCTURAL — adding a third backend requires extending the property-value contract; collapsing into a single backend requires removing the choice; both are structural changes, not refactoring.

**Existing ADR**: none in `adrs/`. Cross-references LSN-001 (attachment-ephemeral-default) — the matchIfMissing=true LOCAL stance is the wiring-side root cause of the LSN-001 failure; this ADR codifies the wiring; the LSN-001 retrospective closed the doc-side loop.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-058 (chunk staging path is storage-INDEPENDENT — applies to LOCAL **and** REMOTE — extends LSN-001 residue to the chunk-staging tier)
- REFACTOR-481 NEW batch V (CHUNK_BASE_PATH /tmp/odd/chunks ephemeral regardless of attachment.storage)

**Proposed action**: Promote to `adrs/drafts/attachment-storage-conditional-on-property.md` (new ADR). Document the mirrored `@ConditionalOnProperty` wiring + the matchIfMissing=true LOCAL stance + the explicit fail-fast on missing required config + the cross-link to LSN-001 (doc-side closure of the same default) + the cross-link to REFACTOR-481 (chunk-staging tier still ephemeral).

**Severity rationale**: MEDIUM — encodes operator-facing deployment shape; not security-critical but operationally load-bearing; the matchIfMissing=true LOCAL default is the failure-mode-by-default that LSN-001 surfaced and that the chunk-staging tier still inherits.

---
