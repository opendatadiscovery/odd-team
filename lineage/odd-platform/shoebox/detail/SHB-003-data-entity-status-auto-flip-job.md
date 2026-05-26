# SHB-003 — Data Entity Status Auto-Flip job (DRAFT/DEPRECATED → DELETED on switch time)

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators see a per-entity "auto-transition to DELETED on the planned date" behaviour because `DataEntityStatusSwitchJob` runs every 10 minutes under ShedLock, scans `data_entity` for rows whose `status_switch_time <= now()`, and bulk-flips them to `DELETED` using the SAME service path as a manual PUT (`DataEntityInternalStateServiceImpl.changeStatusForDataEntities`). The feature is operator-essential — the entire deprecation use-case (the only ODD use-case page that walks an Analyst through a workflow) depends on it — but as of 2026-05-26 it has no F-NNN anchor. F-022 / F-028 / F-031 cover adjacent surfaces; the auto-flip side of the lifecycle is unanchored, and a HIGH-severity correctness defect (Cornerstone applyStatus bug — see SHB-004) silently breaks the housekeeping TTL that completes the lifecycle.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityStatusDto.java:13-16` — the structural flag: `DRAFT(2, true), DEPRECATED(4, true)` mark the two `isSwitchable=true` statuses. The auto-flip rule is **baked into the enum**, not into config.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:462-465` — validation guard: switchable status + `null` `statusSwitchTime` → `BadUserRequestException` (HTTP 400). Operators MUST supply a switch time to use DRAFT or DEPRECATED.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/scheduling/DataEntityStatusSwitchJob.java:21-31` — the scheduled job with `@SchedulerLock(name = "statusSwitchJob")` 9-minute lock + fixed-rate 10 minutes.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java:256-262` — `getPojosForStatusSwitch` returns **ALL** eligible pojos (no `LIMIT`, no chunking). A 5K-entity backlog all maturing in the same hour runs through one tick.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/internal/DataEntityInternalStateServiceImpl.java:73-98` — the SAME `changeStatusForDataEntities` method handles both manual PUT and auto-flip; both share the soft-delete cascade (lineage relations, group relations, parent-group relations, statistics, `manuallyCreated` DEG fill-flag).
- Live doc: `https://docs.opendatadiscovery.org/features/data-discovery/statuses` (verified 2026-05-12 status 200) — documents the auto-transition behaviour at the user level ("let operators set a time period after which the status auto-transitions to DELETED") but does NOT mention the cadence (10 minutes), lock window (9 minutes), or burst-cap behaviour.
- Live doc: `https://docs.opendatadiscovery.org/use-cases/use-cases/de-deprecation` (verified 2026-05-12 status 200) — the entire deprecation use-case walks an Analyst through the manual PUT + scheduled-flip combo.

## Notes

- This is a **scheduling-backed feature** like F-010 (Housekeeping TTL Enforcement, every 15 min) — but distinct: F-010 hard-deletes DELETED entities after `housekeeping.ttl.data_entity_delete_days`, this job transitions DRAFT/DEPRECATED → DELETED on operator-set switch times. Together they form the **two-stage retirement pipeline**: user-scheduled soft-delete (this), then time-based hard-delete (F-010).
- **No per-tick batch cap**: 5K entities all maturing the same hour run one transaction processing 5K pojos + their cascades — potentially exceeding the 9-minute ShedLock window. The job would still complete but the next tick would skip (lock taken), creating phantom-double-tick latency.
- **No way to PEEK at the schedule**: there's no `GET /api/dataentities/scheduled-transitions` endpoint to show operators "here are the entities that will auto-flip in the next 24h." Operators have to inspect individual entity detail pages.
- **The applyStatus bug (SHB-004) silently breaks the downstream TTL** — entities auto-flipped to DELETED have `status_updated_at = NULL`, so `DataEntityHousekeepingJob`'s `STATUS_UPDATED_AT.lessOrEqual(now - N days)` never fires for them. The 30-day retention window is broken end-to-end and operators don't notice.
- **Soft-delete cascade per pojo includes**: lineage relations, group relations, parent-group relations, statistics decrement, manually-created-DEG `MANUALLY_CREATED` unfill, attachment retention. A burst of 5K auto-flips runs 5K × (3-7 cascade writes) inside ONE `@ReactiveTransactional` boundary on `changeStatusForDataEntities`.
- Cross-link with F-022 (DQ Test Reports), F-028 (Namespace Lifecycle), F-031 (Data Source Lifecycle), and the implicit ADR "soft-delete is the platform's deletion model" (the entire workflow assumes restorability up to TTL).

## Next

1. **Graduate** to `F-NNN — Data Entity Status Auto-Flip / Scheduled Deprecation`. Pillar: P-08 (Management & Administration — lifecycle) or P-01 (Data Discovery — status visibility). Primary subjects: `DataEntityStatusSwitchJob`, `DataEntityStatusDto.isSwitchable`, `ReactiveDataEntityRepositoryImpl.getPojosForStatusSwitch`, `DataEntityInternalStateServiceImpl.changeStatusForDataEntities`. Hop into the existing F-010 (Housekeeping TTL) and updateStatus feature graphs.
2. **DOC-NNN** — the live `/features/data-discovery/statuses` page should disclose the 10-minute cadence + 9-minute lock window so operators know the upper bound on flip latency.
3. **REFACTOR-NNN** — `getPojosForStatusSwitch` has no `LIMIT`; recommend per-tick chunking (e.g. 1000 per invocation) to bound transaction size.
4. **TEST-GAP** — `DataEntityStatusChangeTest` covers the PUT path but no test exercises the scheduled job's auto-flip path, the lock acquisition, or burst behaviour.
5. **Cluster** with SHB-004 (the applyStatus bug) — they share the same root surface and together produce the silent retention-window failure.

## Links

- cluster_with: [SHB-004]
- merged_into: (open)
- supersedes: []
