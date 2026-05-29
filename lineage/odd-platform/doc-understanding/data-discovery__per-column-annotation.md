---
doc_page: "docs/data-discovery/per-column-annotation.md"
page_title: "Per-column annotation"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/per-column-annotation"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/per-column-annotation"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "operation:dataset-field-per-column-metadata-edit"
    - "operation:replace-internal-dataset-field-tag-relations"
  features:
    - "F-047"
  code_nodes:
    - "odd-platform java DatasetFieldController controller-method:updateDatasetFieldDescription"
    - "odd-platform java DatasetFieldController controller-method:updateDatasetFieldTags"
    - "odd-platform java DatasetFieldController controller-method:updateDatasetFieldInternalName"
    - "odd-platform java DatasetFieldController controller-method:createEnumValue"
    - "odd-platform java DatasetFieldController controller-method:addDatasetFieldTerm"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page claims the column Add-term affordance silently fails for DATASET_FIELD_ADD_TERM holders because two SecurityConstants rules are crossed at SecurityConstants.java:295-299 — CONFIRMED IN SOURCE. SecurityConstants.java:295-296 gates `PUT /api/alerts/{alert_id}/status` with `DATASET_FIELD_ADD_TERM` (intended `DATA_ENTITY_ALERT_RESOLVE`, which exists in PolicyPermissionDto.java:27 but is wired to no endpoint), and SecurityConstants.java:298-299 gates `POST /api/datasetfields/{dataset_field_id}/terms` with `DATA_ENTITY_ADD_TERM` (the page documents the UI gate as `DATASET_FIELD_ADD_TERM`). The two permissions are exactly crossed. Page is accurate; the live permissions/alerting pages are the surfaces that must stay consistent with this caveat. Evidence: SecurityConstants.java:295-296,298-299; PolicyPermissionDto.java:27."
  - "Page claims `POST /api/datasetfields/{id}/enum_values` is named createEnumValue but is a bulk replace that soft-deletes any pre-existing row whose id is not in the submitted body — CONFIRMED for the all-INTERNAL case. DatasetFieldController.createEnumValue accepts BulkEnumValueFormData and returns 201; EnumValueServiceImpl.createEnumValues routes to upsertInternalEnumValues → reactiveEnumValueRepository.softDeleteExcept(datasetFieldId, idsToKeep) ONLY when no EXTERNAL-origin enum value is present. REFINEMENT the page omits: when any EXTERNAL-origin enum value exists, the submitted name-set must equal the existing set or the call errors BadUserRequestException(\"User cannot create or delete external enum values\") — the silent soft-delete does NOT apply in that branch. The page's caveat is correct for the dominant operator path (all-INTERNAL columns); the EXTERNAL-present guard is unmentioned. Low-severity under-specification, not a contradiction. Evidence: EnumValueServiceImpl.java:42-110 (softDeleteExcept @L105; external-guard @L52-62)."
  - "Page claims `PUT /api/datasetfields/{id}/tags` with an empty array clears every INTERNAL-origin tag while EXTERNAL-origin (EXTERNAL_STATISTICS) tags survive — CONFIRMED IN SOURCE. DatasetFieldServiceImpl.updateDatasetFieldTags deletes only internal relations (reactiveTagRepository.deleteDatasetFieldInternalRelations(datasetFieldId)) then recreates from the submitted names; an empty list recreates nothing. The before/after audit payload claim is confirmed by @ActivityLog(DATASET_FIELD_TAGS_UPDATED) on the same method. Evidence: DatasetFieldServiceImpl.java:119-132 (deleteDatasetFieldInternalRelations @L124; @ActivityLog @L119)."
  - "Page's per-sub-editor activity-event table — CONFIRMED for 4 of 5 events at source: @ActivityLog(DATASET_FIELD_INTERNAL_NAME_UPDATED) DatasetFieldServiceImpl.java:99; @ActivityLog(DATASET_FIELD_TAGS_UPDATED) DatasetFieldServiceImpl.java:119; @ActivityLog(DATASET_FIELD_VALUES_UPDATED) EnumValueServiceImpl.java:41; the Description and Term-assignment events (DATASET_FIELD_DESCRIPTION_UPDATED / DATASET_FIELD_TERM_ASSIGNMENT_UPDATED) are corroborated by the concept node operation:dataset-field-per-column-metadata-edit. No drift."
maintainer_curated: false
---

# Per-column annotation — doc understanding

This page documents the dataset **Structure** tab's per-column annotation composer — five sub-editors (description, tags, glossary terms, enum values, business name), each calling a distinct `DatasetFieldController` endpoint, each gated by a distinct `DATASET_FIELD_*` permission scoped against the parent dataset. It maps directly to feature **F-047** ("Dataset Field per-Column Annotation Surface") and the concept node `operation:dataset-field-per-column-metadata-edit` (confirmed via graph-node — title: "7 endpoints with parent-scoped authorization"). The five write endpoints resolve to confirmed nodes on `DatasetFieldController` (`updateDatasetFieldDescription`, `updateDatasetFieldTags`, `updateDatasetFieldInternalName`, `createEnumValue`, `addDatasetFieldTerm`).

The page's value is its caveat section, and every load-bearing caveat verifies against source. The HIGH-severity crossed-permission claim is real: `SecurityConstants.java:295-296` mis-gates `PUT /api/alerts/{alert_id}/status` with `DATASET_FIELD_ADD_TERM`, and `SecurityConstants.java:298-299` mis-gates `POST /api/datasetfields/{id}/terms` with `DATA_ENTITY_ADD_TERM` — the two are exactly swapped, and `DATA_ENTITY_ALERT_RESOLVE` (PolicyPermissionDto.java:27) is wired to nothing. The enum bulk-replace soft-delete (`EnumValueServiceImpl.softDeleteExcept`, via the method *named* `createEnumValues`) and the INTERNAL-origin tag-clearing (`DatasetFieldServiceImpl.deleteDatasetFieldInternalRelations`) are both confirmed; the page is the canonical caveat home that the live permissions and alerting pages must stay consistent with. F-047's own ontology summary independently lists the same two SecurityConstants wiring bugs plus the replace-all-tags and bulk-replace-enum defects, corroborating the page. The only gap is a low-severity refinement: the enum caveat does not mention that the silent soft-delete is bypassed (replaced by a hard `BadUserRequestException`) when an EXTERNAL-origin enum value is present on the column. The fourth caveat (fast-column-switch form-state hazard) is explicitly self-labelled unverified in the page and is a UI-source inference, not a code-confirmed claim.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
