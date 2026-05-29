---
doc_page: "docs/data-discovery/statuses.md"
page_title: "Data Entity Statuses"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/statuses"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/statuses"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data Entity"
    - "Update Data Entity Status (lifecycle with cascade)"
    - "Housekeeping TTL retention"
    - "TTL retention broken by statusUpdatedAt nullification (cross-batch finding D + F)"
  features:
    - "F-044"
  code_nodes:
    - "odd-platform java DataEntityController controller-method:updateStatus"
    - "odd-platform java mapper:DataEntityMapperImpl"
    - "odd-platform java scheduling:DataEntityStatusSwitchJob"
    - "odd-platform java scheduling:DataEntityHousekeepingJob"
    - "odd-platform java org.opendatadiscovery.oddplatform.housekeeping.config config-properties-class:HousekeepingTTLProperties"
audience: [operator]
doc_claim_vs_code:
  - "Page's SQL legend transposes the DataEntityStatusDto enum ids: it states `2 = STABLE, 3 = DEPRECATED, 4 = DRAFT`, but the code defines DRAFT(2), STABLE(3), DEPRECATED(4). Only UNASSIGNED(1) and DELETED(5) are stated correctly. The page's own audit query (`WHERE status = 5`) is unaffected (DELETED=5 is right), but an operator adapting the legend to target STABLE/DRAFT/DEPRECATED would hit the wrong rows. Evidence: odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/DataEntityStatusDto.java:11-16 (UNASSIGNED(1,false), DRAFT(2,true), STABLE(3,false), DEPRECATED(4,true), DELETED(5,false))."
  - "Page asserts (status-changes-propagate-to-data-sources + the soft-delete-cascade list in the soft-delete-TTL section) a cascade reaching ~25 child tables and a data-source-row mirror on restore; the substrate confirms the cascade fan-out and the restore-mirror path but no enriched code node enumerates the exact ~25-table set or the data-source mirror line — confirmable cascade evidence is at the service level only. Evidence: DataEntityInternalStateServiceImpl.java:73-98 (soft-delete + restore-mirror cascade) per F-044 chain hop 3; node odd-platform java service service:internal:DataEntityInternalStateServiceImpl is a contributing node of F-044 but is not separately enriched, so the precise child-table count is NOT VERIFIED against a single node and stays a substrate-coverage gap rather than a confirmed drift."
maintainer_curated: false
---

# Data Entity Statuses — doc understanding

This operator-facing page documents the five-state Data Entity status lifecycle
(`UNASSIGNED` / `DRAFT` / `STABLE` / `DEPRECATED` / `DELETED`), the operator-set
status surface (entity detail page, Catalog Statuses facet, `DATA_ENTITY_STATUS_UPDATED`
activity event), the soft-delete model with its `housekeeping.ttl.data_entity_delete_days`
30-day retention window, and the scheduled `DRAFT`/`DEPRECATED` → `DELETED` auto-flip.
It is, in effect, the published write-up of feature flow **F-044** (`Data Entity Status
Lifecycle — scheduled auto-flip + retention TTL`), and its two `Known limitation`
callouts are the doc-side mirror of F-044's confirmed drift classes.

The page binds to: the **Update Data Entity Status** operation (`PUT /api/dataentities/{id}/statuses`,
gated by `DATA_ENTITY_STATUS_UPDATE`, routing through `DataEntityInternalStateServiceImpl.changeStatusForDataEntities`
→ `DataEntityMapperImpl.applyStatus`); the **Housekeeping TTL retention** concept
(`housekeeping.ttl.data_entity_delete_days`, default 30, consumed by `DataEntityHousekeepingJob`);
and the cross-batch invariant **TTL retention broken by statusUpdatedAt nullification**,
which is exactly the bug the page's danger callout describes. The page is unusually
accurate: its danger callout correctly states that `applyStatus` mutates the pojo
before its change-detection guard so `status_updated_at` is never written and the
TTL never fires (confirmed verbatim — `DataEntityMapperImpl.java:242-253`, guard at
L249 compares the just-written value against itself; `DataEntityHousekeepingJob.java:73-82`
NULL-excludes those rows), and its warning callout correctly states the 10-minute /
9-minute-ShedLock / no-`LIMIT` burst behaviour of `DataEntityStatusSwitchJob`
(`DataEntityStatusSwitchJob.java:21-31`, `ReactiveDataEntityRepositoryImpl.getPojosForStatusSwitch`).

The one substantive defect is in the page's manual-cleanup SQL legend, which transposes
the `DataEntityStatusDto` integer ids for `STABLE` / `DRAFT` / `DEPRECATED` (see
`doc_claim_vs_code`). DELETED=5 is correct, so the page's own audit query is sound;
the risk is to an operator who reuses the legend to query a different status.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
