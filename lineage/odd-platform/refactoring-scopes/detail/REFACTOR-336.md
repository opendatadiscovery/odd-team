## REFACTOR-336 — `upsertDataEntityMetadataFieldValue` accepts writes against EXTERNAL-origin metadata fields (collector-populated) — user-edits silently overwrite ingestion-source data until the next ingestion cycle; no origin check anywhere in the upsert path

**Severity**: MEDIUM
**Category**: missing-validation (origin-respect; data-provenance integrity)
**Pillars affected**: [P-01-data-discovery, P-10-integrations-ingestion]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "EXTERNAL-origin fields are writable — the upsert path does not check `MetadataFieldPojo.getOrigin()`. EXTERNAL fields are populated by collectors during ingestion (`MetadataFieldServiceImpl.java:62-71` `ingestMetadataFields` creates fields with `origin=EXTERNAL`); a user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` can overwrite the collector-ingested value through this endpoint. The next ingestion cycle will replace it, but until then the catalog shows the user's edit as authoritative. The user-facing distinction between 'discovered' (EXTERNAL) and 'curated' (INTERNAL) metadata is therefore not enforced at write time"
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:security.known_security_gaps.[2]` (LOW security-side framing; the higher-severity finding is the data-provenance integrity gap)

**Description**: The `metadata_field` table has an `origin` column with two values: `INTERNAL` (operator-curated) and `EXTERNAL` (collector-ingested per `MetadataFieldServiceImpl.java:62-71`'s `ingestMetadataFields`). The platform's user-facing distinction between "discovered" and "curated" metadata depends on operators trusting that EXTERNAL fields reflect the source-system state — they are populated by `odd-collector` runs against, e.g., Snowflake or Postgres metadata, and represent the authoritative source-system view.

`DataEntityServiceImpl.upsertMetadataFieldValue` (lines 287-305) DOES NOT inspect `MetadataFieldPojo.getOrigin()`. A user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` (typically granted to entity owners) can overwrite the value of an EXTERNAL field through this endpoint. The override persists until the next ingestion cycle, when `IngestionService` re-runs the collector payload and replaces the user's edit with the source-system value.

The platform consequences:
- (a) **Data-provenance integrity**: the catalog shows the user's edit as authoritative during the interval between the user-edit and the next ingestion run. BI tools, audit consumers, downstream readers see fabricated "source-system" data.
- (b) **No audit trail** (cross-link REFACTOR-337): the override is silent; no activity event records the overwrite; operators cannot reconstruct "who edited the collector-populated cost_centre field at time T."
- (c) **Silent reversion**: at the next ingestion cycle, the override vanishes and the source-system value reappears, with no notification or warning. The user's edit is silently lost.
- (d) **Surface for security-adjacent confusion**: combined with the no-audit gap, an authorised user can fabricate values that LOOK like source-system metadata, creating a denial-of-trust attack vector against operators who rely on the EXTERNAL/INTERNAL distinction.

**Primary source citations**:
- `DataEntityServiceImpl.java:287-305` (no origin check anywhere in the upsert path)
- `MetadataFieldServiceImpl.java:62-71` (`ingestMetadataFields` creates EXTERNAL fields during ingestion)
- `MetadataFieldServiceImpl.java:86-91` (EXTERNAL field creation in collector path)
- `V0_0_1__init.sql:166-173` (the origin column on `metadata_field`)

**Existing-ADR-or-implied-prescription**: none. The platform's INFORMAL contract (visible in the field naming + the separate `ingestMetadataFields` path) is that EXTERNAL fields are collector-owned. The IMPLIED prescription is one of three options: (a) reject user-edits on EXTERNAL fields with 403; (b) accept the edits but mark the row as "user-overridden" so the next ingestion run knows to preserve the user's edit (override-then-merge); (c) accept the edits as transient and document the silent-reversion behaviour.

**Proposed remedy**: Two options. **(a) Reject EXTERNAL writes**: at `DataEntityServiceImpl.upsertMetadataFieldValue` entry, after fetching `metadataFieldPojo` via `metadataFieldService.get(metadataFieldId)`, check `if (metadataFieldPojo.getOrigin() == EXTERNAL) throw new BadUserRequestException("EXTERNAL-origin metadata is collector-managed and cannot be edited through this endpoint")`. Companion: doc-side, the live custom-metadata page (DOC-NNN candidate — see REFACTOR-NNN doc-gap) describes the EXTERNAL/INTERNAL distinction explicitly. **(b) Accept but mark**: add a `user_overridden BOOLEAN` column to `metadata_field_value` defaulted to FALSE; flip it to TRUE on user-edits; `IngestionService` reads the flag and preserves user-overridden values across collector runs. Higher implementation cost; more robust UX. **(c) Document and accept**: write up the silent-reversion behaviour at the live custom-metadata page and add a UI warning admonition when the user clicks edit on an EXTERNAL field. Lowest cost; clarifies the trade-off without changing behaviour. The maintainer's triage between (a) / (b) / (c) reflects the platform's stance on data provenance — is the EXTERNAL/INTERNAL distinction load-bearing for operator trust, or is it a soft signal that user-edits override?

Cross-batch: cross-link with REFACTOR-199 (Owner auto-create-on-miss BYPASSES OWNER_CREATE — same shape of "authorisation present at one entry point doesn't transitively gate the downstream effect"). The user-edits-overwrite-collector-data pattern is the data-provenance counterpart to the permission-bypass pattern.

**Severity rationale**: MEDIUM — data-provenance integrity gap; the EXTERNAL/INTERNAL distinction is part of the platform's value proposition (per the README's "platform stores the metadata, provides search ... the receiving end of metadata flowing from data systems") and the silent-overwrite undermines operator trust in the catalog. Not HIGH because no data is permanently corrupted (the next ingestion run restores the source-system value) and the operator-edit-shape is gated by the existing `DATA_ENTITY_CUSTOM_METADATA_UPDATE` permission (no anonymous overwrite under non-DISABLED modes).

**Suggested backlog grouping**: `Custom-metadata hardening sprint` (group with REFACTOR-333, -334, -335, -337). Companion DOC-NNN at the (currently-absent) live custom-metadata page.

---
