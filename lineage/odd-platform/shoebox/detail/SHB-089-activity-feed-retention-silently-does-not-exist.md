# SHB-089 — Activity-feed (and Message) retention silently does not exist; docs imply it does

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators reading the live `/features/active-platform-features/activity-feed` page see "Activity-feed retention and partitioning are controlled by `odd.activity.partition-period`" and infer that activity rows age out. They do NOT. The `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` are the only activity/message-touching housekeeping paths, both drop **empty past partitions only** (`PartitionService.isPartitionEmpty` requires `COUNT(*) = 0` before drop); the `housekeeping.ttl.*` POJO contains exactly three fields — alert, search-facets, data-entity — and NO `activity*Days` or `messageDays`. In high-volume deployments, `activity` and `message` tables grow unbounded indefinitely.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/config/HousekeepingTTLProperties.java:8-12` — three fields, none touching activity or message.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/ActivityEmptyPartitionsHousekeepingJob.java:9-19` + `MessageEmptyPartitionsHousekeepingJob.java:12-25` — both extend `EmptyPartitionsHousekeepingJob`; neither injects `HousekeepingTTLProperties`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/EmptyPartitionsHousekeepingJob.java:21-22` — calls `partitionService.getEmptyPastPartitions(...)`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/partition/service/PartitionServiceImpl.java:133-141` — `isPartitionEmpty` enforces `COUNT(*) = 0` before allowing drop.
- Live `/configuration-and-deployment/odd-platform#housekeeping` (WebFetched 2026-05-26, status 200) — describes "three cleanup tasks" (alert, search-facets, data-entity) — does NOT enumerate `ActivityEmptyPartitionsHousekeepingJob` or `MessageEmptyPartitionsHousekeepingJob`. The docs' "three tasks" wording matches the configured TTLs, hiding the existence of the two extra jobs and the absence of activity/message retention.
- Live `/features/active-platform-features/activity-feed#configuration` (WebFetched 2026-05-12) — implies `odd.activity.partition-period` controls retention; cross-confirmed in HousekeepingTTLProperties sidecar that this is partition WIDTH only.

## Notes

- This is a NAMING DRIFT: `odd.activity.partition-period` is described as controlling "retention and partitioning" but actually only sets partition width (the interval at which new partitions are created). The retention semantic is silently absent — partitions only drop when EMPTY.
- A high-volume activity-emitting deployment (lots of @ActivityLog hits — e.g. many data entity description edits, ownership changes, alert status changes per the 27-event ActivityEventType enum) sees the `activity` table grow without bound. Operators sizing PG IOPS based on the docs' implied retention will under-provision.
- Compliance frameworks (SOX, GDPR records-of-processing) requiring "audit-log retention is bounded and reviewable" cannot be satisfied by ODD because (a) no time-based retention exists, (b) the partition-empty-drop is a no-op while data is being written.
- Workaround for operators: manually `DELETE FROM activity WHERE created_at < ...` outside the platform's housekeeping; OR set `odd.activity.partition-period` to a small value and tolerate the empty-only drop after partitions naturally age out (only AFTER the entire partition's rows expire — which requires app-side TTL).
- Cross-link to F-021 (Activity Feed) — F-021 anchors the audit-trail emission and read path but does NOT enumerate the retention-absent drift class.
- The `message` table half of this finding is operator-low-impact when DataCollaboration (F-038) is disabled, which is the default — but when DataCollaboration is enabled the same unbounded-growth class applies.

## Next

1. **ENRICH F-021** with this drift facet (`activity_table_no_time_based_retention_partition_drop_requires_empty`). Optionally enrich F-038 with the parallel finding for Message.
2. **REFACTOR-NNN**: add `activityDays` / `messageDays` fields to `HousekeepingTTLProperties`; add corresponding TTL-driven jobs that DELETE rows older than the cutoff inside each partition before partition-empty-drop attempts.
3. **DOC-NNN (CRITICAL)**: rewrite the `/features/active-platform-features/activity-feed#configuration` section to state explicitly that ODD does NOT currently retention-delete activity rows; that `partition-period` controls width only; that the only deletion path is `ActivityEmptyPartitionsHousekeepingJob` requiring `COUNT(*) = 0`. Same for `/data-collaboration` page.
4. **Probe**: instrument a busy demo deployment; measure activity-row growth rate against partition-empty-drop cycle; confirm unbounded growth.

## Links

- cluster_with: [F-021, F-038, F-010]
- merged_into: F-010
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — F-010 (Housekeeping TTL Enforcement, P-08) already enumerates `cross_pillar_activity_retention_to_p_07` + `activity_table_monotonic_growth_confirmed_repo_tier_no_delete_path` in its drift_class_summary. The thread proposed enriching F-021 (P-07) instead, but Slice E owns P-08 and F-021 is P-07; per the anti-pattern rule I MERGE into F-010 (my pillar) preserving the cross-pillar relationship to P-07. F-010: shoebox_extensions_2026_05_26 → drift_class: activity_and_message_tables_no_time_based_retention_partition_drop_requires_empty_silent_doc_drift. F-021 readers will see the cross-link via F-010's existing `cross_pillar_activity_retention_to_p_07`. Category flipped open → merged.
