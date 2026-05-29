---
doc_page: "docs/data-discovery/business-names.md"
page_title: "Business names for data entities and dataset fields"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/business-names"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/business-names"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "DatasetField per-column metadata edit (description / internal-name / tags / enum-values / metrics / terms — 7 endpoints with parent-scoped authorization)"
    - "Activity Feed"
  features:
    - "F-178"
    - "F-047"
  code_nodes: []
audience: [operator]
doc_claim_vs_code:
  - "Page RBAC section claims 'The platform records both [entity AND dataset-field renames] as BUSINESS_NAME_UPDATED events on the Activity Feed.' FALSE for the field side: only the data-entity rename emits BUSINESS_NAME_UPDATED (DataEntityServiceImpl.upsertBusinessName @ActivityLog(BUSINESS_NAME_UPDATED) — odd-platform-api/.../service/DataEntityServiceImpl.java:336). The dataset-field rename emits a DIFFERENT event, DATASET_FIELD_INTERNAL_NAME_UPDATED (DatasetFieldServiceImpl.updateInternalName @ActivityLog(DATASET_FIELD_INTERNAL_NAME_UPDATED) — odd-platform-api/.../service/DatasetFieldServiceImpl.java:99; enum constants ActivityEventTypeDto.java:15 BUSINESS_NAME_UPDATED + :22 DATASET_FIELD_INTERNAL_NAME_UPDATED). Operator impact: filtering the Activity Feed by event type BUSINESS_NAME_UPDATED to audit renames silently misses every column-level rename. — evidence: operation:dataset-field-per-column-metadata-edit / odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:99 + DataEntityServiceImpl.java:336"
  - "Page Step 3 + 'Where business names appear' state unconditionally that 'the original technical name persists below the new name as an inline reference.' Code renders the entity name as `internalName || externalName` and the 'Original: {externalName}' footer ONLY when BOTH are present (`internalName && externalName &&` — odd-platform-ui/.../DataEntityDetailsHeader/DataEntityDetailsHeader.tsx, the originalName binding). For a manually-created data entity that has no collector-ingested externalName, the business name becomes the sole display label and no 'Original' line appears. Low severity (ingested entities always carry both names), but the 'always persists below' phrasing is unconditional where the code is conditional. — evidence: F-178 / odd-platform-ui/src/components/DataEntityDetails/DataEntityDetailsHeader/DataEntityDetailsHeader.tsx (originalName + h0 name surface)"
  - "Page does not mention that all business-name edit affordances disappear when the data entity is in DELETED status. The entity-header business-name button is wrapped in `!isStatusDeleted` (F-178 entry, DataEntityDetailsHeader.tsx — the !isStatusDeleted gate spanning the WithPermissions block). No banner explains the missing button. Minor caveat-omission, not a correctness error. — evidence: F-178 / odd-platform-ui/src/components/DataEntityDetails/DataEntityDetailsHeader/DataEntityDetailsHeader.tsx"
maintainer_curated: false
---

# Business names for data entities and dataset fields — doc understanding

An operator-facing page: it teaches an ODD operator how to assign a human-readable
**business name** (the code's "internal name") alongside the collector-ingested
**technical/external name** at two levels — the data entity (detail-page header) and
the dataset field/column (Structure tab) — and where that label then surfaces.
The entity-level flow maps to **F-178** (the detail-page header, whose business-name
button is gated by `DATA_ENTITY_INTERNAL_NAME_UPDATE` and whose write is
`DataEntityServiceImpl.upsertBusinessName`, line 336, emitting `BUSINESS_NAME_UPDATED`);
the field-level flow maps to **F-047** / the *DatasetField per-column metadata edit*
operation (PUT internal-name endpoint → `DatasetFieldServiceImpl.updateInternalName`,
line 99, gated by `DATASET_FIELD_INTERNAL_NAME_UPDATE`). Both permission constants are
real (`PolicyPermissionDto.java:14` + `:31`, wired at `SecurityConstants.java:200` + `:284`)
and both are `DATA_ENTITY`-parent-scoped, so the page's two permission claims are correct.

The page's audit claim is where it drifts: it asserts the platform records **both**
renames as `BUSINESS_NAME_UPDATED`, but the field-level rename emits the distinct
`DATASET_FIELD_INTERNAL_NAME_UPDATED` event — confirmed against the enum
(`ActivityEventTypeDto.java:15`/`:22`) and both `@ActivityLog` annotations. This is the
high-value finding for `doc-gaps.md`: an operator auditing column renames via the
`BUSINESS_NAME_UPDATED` event filter would silently miss them all.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
