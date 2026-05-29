---
doc_page: "docs/active-platform-features/activity-feed.md"
page_title: "Activity Feed"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features/activity-feed"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Activity Feed"
    - "Read Activity Feed (windowed, filtered, type-dispatched)"
    - "Write Activity Event — snapshot-diff-emit pipeline (under @ReactiveTransactional)"
    - "Activity Event State Differ (currently misnamed 'ActivityHandler')"
    - "DEG-propagation cascade audit-feed asymmetry"
  features:
    - "F-021"
    - "F-196"
  code_nodes:
    - "odd-platform java ActivityController controller-method:getActivity"
    - "odd-platform java ActivityController controller-class:ActivityController"
    - "odd-platform java repository reactive repository:ReactiveActivityRepositoryImpl"
    - "odd-platform java service activity handler:ActivityHandler"
    - "odd-platform java housekeeping job:ActivityEmptyPartitionsHousekeepingJob"
    - "odd-platform java ActivityTablePartitionManager config-key-consumer:odd.activity.partition-period@L11"
    - "odd-platform java DataEntityController controller-method:getDataEntityActivity"
    - "odd-platform ts routes route:activity"
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "RESIDUAL drift — the Configuration section claims `odd.activity.partition-period` controls 'Activity-feed retention and partitioning'. The key controls partition WIDTH only; there is no retention/DROP path — `ActivityTablePartitionManager` calls only `createPartitionsIfNotExists` and `public.activity` grows monotonically (the sole reaper `ActivityEmptyPartitionsHousekeepingJob` drops only empty past partitions, a near-no-op on steadily-used platforms). LSN-001 silent-growth class. Evidence: odd-platform java ActivityTablePartitionManager config-key-consumer:odd.activity.partition-period@L11 (ActivityTablePartitionManager.java:11) + concept Activity Feed performance_aggregate.weaknesses (no retention path) + odd-platform java housekeeping job:ActivityEmptyPartitionsHousekeepingJob. The word 'retention' overstates the key."
  - "MISSING caveat — emit-failure rolls back the user's business mutation. The whole snapshot-diff-emit pipeline runs inside the wrapping `ActivityAspect` @ReactiveTransactional, so a transient activity-write failure rolls back the originating @ActivityLog mutation and surfaces 500 with no indication the mutation was reverted (operator-surprising; the opposite of the audit-or-fail intuition). The page documents many emission gaps but not this coupling. Evidence: concept Write Activity Event — snapshot-diff-emit pipeline (ActivityAspect.java:42,62 + postActivity:86) / invariant activity-write-tx-coupled-emit-failure-rolls-back-business-mutation."
  - "MISSING caveat (cascade, distinct from the documented DEG-membership gap) — Owner-propagation to a DEG's children emits ONE parent `OWNERSHIP_CREATED`/`UPDATED`/`DELETED` event and zero per-child events. `@ActivityLog` annotates only the three public OwnershipServiceImpl methods (lines 48/77/100); the cascade `propagateOwnership` (lines 134-148) writes N child rows with no event. An operator auditing 'when did this child gain owner X' via the child's feed sees nothing and must infer the fan-out from the parent DEG. Deliberate per OwnershipServiceImpl implicit_adrs.[2], but undocumented on this page. Evidence: invariant deg-propagation-cascade-audit-feed-asymmetry (OwnershipServiceImpl.java:48,77,100,121-149 + OwnershipCreatedActivityHandler.java:33-36)."
  - "ALIGNED (no drift; previously-flagged, now corrected) — the page already carries code-accurate caveats for: the `User` filter being an entity-OWNERSHIP axis not an actor axis (USER_OWNER_MAPPING.OWNER_ID bind, LSN-020); cross-mode user-name bleed / provider tag dropped (UserDto::username at ActivityServiceImpl.java:47,58); the data-entity-only scope rooted in `activity.data_entity_id` NOT NULL FK; dead enum values DATA_ENTITY_RELATION_UPDATED + CUSTOM_METADATA_* + DEG-membership emitting nothing; DISABLED-mode null `created_by` rendered as system events; and the per-entity `/dataentities/{id}/activity` tab being un-gated and reachable for soft-deleted entities (DataEntityDetailsRoutes.tsx:105). Re-confirm on each refresh."
maintainer_curated: false
---

# Activity Feed — doc understanding

This page is the operator + data-consumer surface for the platform's metadata audit trail: the global **Activity** page (TS route `route:activity`, backend `ActivityController.getActivity` → `ReactiveActivityRepositoryImpl`) and the per-entity **Activity** tab (`DataEntityController.getDataEntityActivity`, feature **F-196**). It documents where the feed lives, the seven global filter facets, the full event-type enumeration emitted by the `ActivityHandler` snapshot-differ machinery, the `My Objects` user-owner-mapping prerequisite, and the partition-width Configuration key. It maps to feature **F-021 (global feed)**, **F-196 (per-entity tab)**, and the `Activity Feed` / `Read Activity Feed` / `Write Activity Event` concepts — the most thoroughly enriched feature in the catalog (seven contributing sidecars across HTTP → service → repository → handler → housekeeping).

This is a corrected-drift exemplar: the page now states, with code-accurate framing, the User-filter ownership-not-actor axis (LSN-020), the cross-mode user-name bleed, the schema-rooted data-entity-only scope, the dead enum values, the DISABLED null-actor rendering, and the un-gated soft-delete-inclusive per-entity tab — all confirmed against the substrate. The residual surfaceable gaps are three: the Configuration section's word "retention" overstates a width-only key (LSN-001 silent-growth class, code-confirmed against `ActivityTablePartitionManager` + the empty-only housekeeping reaper); the audit-or-fail TX coupling (emit failure rolls back the user's mutation) is undocumented; and the Owner-propagation cascade's parent-event-only audit granularity is distinct from the documented DEG-membership gap and not stated on this page. Each is logged above with `node_id` + `file:line` evidence for doc-gap triage.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
