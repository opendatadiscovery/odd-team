---
node_id: "odd-platform java repository reactive repository:ReactiveActivityRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.4.0
enrichment_status: stress-complete
confidence_overall: HIGH
session_id: session-2026-05-20-R02
stress_protocol_applied: true
related_features:
  - F-006   # P-09:F-001 RBAC — audit-silence pattern (Activity table is the ATTEMPTED audit log; RBAC mutations don't emit here)
  - F-007   # P-07:F-001 Alerting — AlertServiceImpl writes systemEvent=true OPEN/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED to this table
  - F-010   # P-08:F-002 Housekeeping — ActivityEmptyPartitionsHousekeepingJob drops empty past partitions of THIS table
related_pillar_features:
  - P-07:F-003  # Activity Feed sub-feature of Active Platform Features (the read surface this repository serves)
  - P-09:F-001  # RBAC (audit-silence asymmetry — this repo's writes are scoped to the data-entity FK)
  - P-08:F-002  # Housekeeping TTL Enforcement (partition rotation interaction)
related_concepts:
  - activity-table-partitioning
  - audit-log-presence-asymmetry-2-tier-audit-story
  - no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f
  - provider-null-cross-mode-bleed   # CROSS-MODE BLEED MIRROR — created_by join by username only
coherence_notes:
  - kind: strengthens
    target: F-006
    note: |
      F-006's `forensic_silence_on_rbac_mutations` and `six_sidecar_audit_silence_pattern_ui_tier_confirmation`
      drift facets are STRUCTURALLY REINFORCED by this repository's schema. The `activity.data_entity_id`
      column is NOT NULL with a FK constraint to `data_entity(id)` (V0_0_48__add_activity.sql:4,12) — the
      audit table CANNOT physically store an event that does not reference a data entity. RBAC mutations
      (Role.create / Role.update / Policy.create / Owner.create / Owner.delete / role-to-owner attach /
      policy-to-role attach) have NO data_entity context — they cannot emit even if a future @ActivityLog
      were added. The audit-silence is not a missing-annotation gap; it is a schema-level impossibility
      requiring a separate audit surface (or a NULLable data_entity_id with a discriminator). PRIMARY-SOURCE
      anchor for the data-entity-scoping invariant.
  - kind: strengthens
    target: F-007
    note: |
      F-007's AlertManager surface — AlertServiceImpl.java:252,258,318,324 issue `activityService.createActivityEvents(...)`
      with `.systemEvent(true)` for OPEN_ALERT_RECEIVED, RESOLVED_ALERT_RECEIVED, and ALERT_STATUS_UPDATED.
      Those flows reach this repository via the `save(List<ActivityPojo>)` batch path (line 57-71). The
      `is_system_event` column on activity (V0_0_48__add_activity.sql:8) is the discriminator the UI uses
      to surface "auto-resolved alert events" per the docs page. The write side for F-007's audit-trail
      contribution is HERE, not in AlertServiceImpl.
  - kind: strengthens
    target: F-010
    note: |
      F-010's `cross_pillar_activity_retention_to_p_07` relationship — the ActivityEmptyPartitionsHousekeepingJob
      (extends EmptyPartitionsHousekeepingJob, targets `Tables.ACTIVITY.getName()` per
      ActivityEmptyPartitionsHousekeepingJob.java:14-17) drops EMPTY past partitions for THIS table. Combined
      with ActivityTablePartitionManager (which CREATEs but never DROPs non-empty partitions), the activity
      table grows monotonically until rows themselves age out via app-level deletion (which does NOT exist —
      see bugs_limitations_corner_cases[0]).
  - kind: rule9_supersedes
    target: prior_self_v02
    note: |
      The v0.2.0 sidecar (file-analyser/0.2.0, session-2026-05-20-R01) authored a HIGH-confidence
      `concepts.invariants[2]` claim — that the cursor pagination uses a "(trunc(created_at, SECOND), id)
      tuple-less-than comparison" that "introduces a possible ordering inversion within the same second."
      LSN-019 Stress Protocol (Rule 9, Category C — orderings) trace-answers that claim in stress_findings.C2:
      the truncation occurs ONLY ON THE LEFT side of the row-comparator (line 287-288 -- truncate column
      to second-precision AND truncate cursor to second-precision -- producing equal precision on the
      comparator); the ORDER BY at line 291 uses full-precision `created_at` DESC tied with `id` DESC.
      The combination is CORRECT for forward cursoring (every row that should be returned is returned)
      but produces a re-ordering anomaly at second boundaries: rows arriving within the same second
      may be returned in a DIFFERENT visual order than the next page's batch, because the row-comparator
      compares only to second-precision while the ORDER BY sorts at microsecond precision. This is
      NOT "skip rows" (which the v0.2 version implied via `bugs_limitations_corner_cases[4]`) but
      "stable-result-but-shuffled-order-within-a-second-bucket". Stress Protocol corrects the
      severity classification and emits probe P-021 to pin the precise behaviour.
  - kind: conflicts_surfaced
    target: none
    note: |
      Pre-emit coherence sweep ran against feature-flows/F-006 + F-007 + F-010, concepts/index.yaml
      (audit-log-presence-asymmetry-* + activity-table-partitioning + provider-null-cross-mode-bleed),
      and the two prior Activity sidecars (ActivityController.getActivity + ActivityTablePartitionManager).
      ZERO contradictions surfaced; this sidecar STRENGTHENS the three features and the cross-mode-bleed
      concept rather than supersedes any prior claim. (Rule 9 self-supersedes the prior version of THIS
      sidecar via the `rule9_supersedes` coherence note above — same node, refined claim.)
emitted_probes:
  - P-021   # cursor-pagination at second-boundary — order-stability under high write rate (Stress Protocol C2)
  - P-022   # partition DROP empty-only contract verification — concurrent INSERT/SELECT lock interaction (Stress Protocol E1)
---

# ReactiveActivityRepositoryImpl — semantic understanding

## understanding

`ReactiveActivityRepositoryImpl` is the jOOQ-backed reactive repository for the `public.activity` audit table — the platform's append-only forensic substrate. It exposes two write paths (`saveReturning` for single-row inserts via `ActivityServiceImpl.createActivityEvent`, and `save` for batched inserts via `ActivityServiceImpl.createActivityEvents`, partitioned in 1000-row chunks by `JooqReactiveOperations.executeInPartition`), plus seven read paths backing the UI Activity Feed and its three companion views (My-objects / Upstream / Downstream / Data-entity-detail). The read paths are NOT owner-scoped at the SQL layer — `findAllActivities`, `findDependentActivities`, and `findDataEntityActivities` issue cross-owner SELECTs and rely entirely on caller-side filter parameters (`ownerIds`, `userIds`, `tagIds`, lineage `oddrns`) for narrowing. The audit surface is **structurally constrained** to data-entity-scoped events: `activity.data_entity_id` is `NOT NULL` with a FK to `data_entity(id)` (V0_0_48__add_activity.sql:4,12), so RBAC mutations (Role / Policy / Owner CRUD) and Datasource registrations CANNOT be recorded here — the audit-silence-on-RBAC pattern observed across batches F/H/N (F-006) is rooted in this schema decision. **Critical for the Stress Protocol**: this repository does NOT use the `JooqQueryHelper.paginate(...)` helper (the same helper whose paginate-inside-CTE shape produced LSN-019 — verified by grep, zero matches in this file). The activity read paths construct ORDER BY directly at the outer SELECT (`orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())` at line 291), so the LSN-019 paginate-inside-CTE drift does NOT apply here.

## concepts

- entities: [ActivityPojo, ActivityDto, ActivityEventTypeDto (27-value enum), ActivityRecord, public.activity (range-partitioned by created_at), Tables.ACTIVITY, USER_OWNER_MAPPING (LEFT JOIN for actor resolution), OWNER (LEFT JOIN for actor's catalog identity), DATA_ENTITY (INNER JOIN — every activity row has a FK to one), DATA_SOURCE / NAMESPACE (conditional LEFT JOINs); TAG_TO_DATA_ENTITY / OWNERSHIP (EXISTS semi-joins for the tag/owner filter facets since #1745 — previously fan-out LEFT JOINs, PLT-176)]
- operations: [save-activity-pojo, save-activity-batch, find-activities-cross-owner, find-activities-my-owner-scoped, find-activities-dependent-lineage-scoped, find-activities-by-data-entity, count-activities-cross-owner, count-activities-my-owner-scoped, count-activities-dependent-lineage-scoped, cursor-paginate-by-created-at-id-tuple]
- invariants:
  - "Every activity row REQUIRES `data_entity_id` (NOT NULL FK). RBAC mutations, Owner CRUD, Datasource registrations, Collector token rotations, Role/Policy edits have NO data-entity context — they cannot emit to this table even if a future `@ActivityLog` annotation were added (V0_0_48__add_activity.sql:4,12)."
  - "Every read path LEFT JOINs `USER_OWNER_MAPPING ON OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL` to resolve the actor's catalog OwnerPojo. The join filters by `OIDC_USERNAME` only — NOT by `provider` — so a LOGIN_FORM-authenticated 'alice' and an LDAP-authenticated 'alice' resolve to the SAME row (a cross-mode bleed mechanism mirroring `provider-null-cross-mode-bleed` from ReactiveUserOwnerMappingRepositoryImpl batch N). Lines 157-158, 178-179, 199-200, 221-222."
  - "Cursor pagination uses a `(trunc(created_at, SECOND), id)` SYMMETRIC tuple-less-than comparison: BOTH sides are second-precision (column: `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)`; cursor: `truncatedTo(ChronoUnit.SECONDS)`) — line 285-288. The ORDER BY at line 291 sorts by full-precision `created_at` DESC with `id` DESC as tiebreaker. The combination guarantees no row is SKIPPED at second boundaries (correct forward cursoring) but allows the visual ORDER of rows arriving within the same second to differ between consecutive pages of the same request stream (Stress Protocol C2 — corrected from prior v0.2 sidecar claim of skip-rows; probe P-021 emitted to pin)."
  - "Default ORDER BY at the outer SELECT is `ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc()` (line 291) with `limit(size)` (line 292) — newest-first paging with deterministic id-desc tiebreaker. Append-only audit data; no `OFFSET` is ever issued. The repository does NOT use `JooqQueryHelper.paginate(...)` (Stress Protocol C1 — LSN-019 paginate-inside-CTE drift does NOT apply here)."
  - "`findMyActivities` accepts a `currentOwnerId` and threads it as an `OWNERSHIP.OWNER_ID = currentOwnerId` EXISTS semi-join (via `getCommonConditions`; since #1745 — formerly an `addJoins` LEFT JOIN) — but does NOT additionally filter `USER_OWNER_MAPPING.OWNER_ID = currentOwnerId` for the actor join. The 'my' in 'my activities' means 'activity on data entities I own', not 'activity I performed' — a discoverable axis-mismatch (ActivityServiceImpl.java:184-199 + this repo lines 91-107)."
  - "The `tagIds`/`ownerIds` filters are EXISTS semi-joins (`EXISTS (SELECT 1 FROM tag_to_data_entity WHERE data_entity_id = data_entity.id AND tag_id IN (...))` and the OWNERSHIP equivalent) — they filter WITHOUT multiplying rows. Before #1745 (PLT-176) they were one-to-many LEFT JOINs with no DISTINCT, so an entity matching N filtered tags x M filtered owners returned each activity N*M times on BOTH the list (`findAllActivities`) AND all three count methods (`getTotalActivitiesCount`/`getMyObjectsActivitiesCount`/`getDependentActivitiesCount`, which share `addJoins`+`getCommonConditions`) — the count badge inflated past the front-end-de-duplicated list (the on-screen count/list contradiction). Pinned by `ReactiveActivityRepositoryFanOutTest`. @regresses PLT-176."
  - "Saved `ActivityRecord` carries `(data_entity_id, event_type, old_state JSONB, new_state JSONB, is_system_event, created_at, created_by)` per the V0_0_48 schema. `created_by` is `varchar(512)` and NULLABLE — `ActivityServiceImpl.createActivityEvent` (line 49) emits `null` as the username when `authIdentityProvider.getCurrentUser()` returns empty (e.g. ingestion-path system events, anonymous DISABLED-mode mutations, scheduler-driven AlertServiceImpl flows). All such rows orphan on the USER_OWNER_MAPPING LEFT JOIN — the read paths surface `OwnerPojo = null` as 'system'/'unattributed' actor."
- audiences: [odd-platform-ui-end-user (Activity Feed page + per-entity tab), platform-operator auditing forensic events, security-compliance reviewer reading after an incident, https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed]

## dependencies_semantic

- requires-feature:
  - "`JooqReactiveOperations` bean — supplies `newRecord(table, pojo)` (line 51, 59), `mono(insertStep)` / `mono(query)` / `flux(query)` for reactive execution, and `executeInPartition(records, mapper)` (line 62) for the 1000-row batched-INSERT path. Error translation via `ExceptionUtils.translateDatabaseException` is centralised in this bean."
  - "`JooqRecordHelper` bean — supplies `extractRelation(record, table, pojoClass)` (line 305-307) which returns `null` when the joined-table's `id` column is null (JooqRecordHelper.java:38-43). The LEFT JOIN nullability of USER_OWNER_MAPPING → OWNER is the discriminator the UI uses for 'system' vs 'attributed' activity rows."
  - "`ReactiveActivityRepository` interface (sibling file) — declares all 8 methods this impl provides; consumed exclusively by `ActivityServiceImpl` (the single bean injecting it; grep verified no other consumers)."
  - "Generated jOOQ tables (Tables.ACTIVITY, DATA_ENTITY, OWNER, OWNERSHIP, USER_OWNER_MAPPING, DATA_SOURCE, NAMESPACE, TAG_TO_DATA_ENTITY) — schema-coupled; a column rename in V0_0_NN migrations breaks compile."
- requires-config:
  - "`odd.activity.partition-period` (default 30, application.yml:213) — INDIRECT dependency: this repository INSERTs rows; ActivityTablePartitionManager ensures partition coverage for the rolling date window. If partition creation has been failing silently (per ActivityTablePartitionManager sidecar bugs_limitations_corner_cases[2]), INSERTs from `save(...)` or `saveReturning(...)` fail at the Postgres layer with 'no partition of relation \"activity\" found for row' — surfaced to the caller via `JooqReactiveOperations` error translation."
  - "`housekeeping.enabled` (HousekeepingJobManager.java:18) — INDIRECT dependency: `ActivityEmptyPartitionsHousekeepingJob` runs only when housekeeping is enabled; without it, empty past partitions accumulate. The 15-minute fixedRate iteration with a ShedLock-coordinated cluster mutex means the `DROP TABLE <activity_partition>` DDL fires at most once per 15 minutes (HousekeepingJobManager.java:25-26)."
- requires-runtime:
  - "PostgreSQL with declarative range-partitioning on `activity` (PARTITION BY RANGE (created_at) — V0_0_48__add_activity.sql:13)."
  - "Spring R2DBC + DatabaseClient (reactive driver underpinning JooqReactiveOperations)."
  - "Reactor Core (Mono / Flux signatures throughout)."
- coupling:
  - "**Write-path callers**: `ActivityServiceImpl.createActivityEvent` (saveReturning, line 50) and `createActivityEvents` (save, line 62). Those two methods are the WRITE FUNNEL — every activity row passes through them. They are called from: (a) `ActivityAspect.postActivity` (the `@ActivityLog`-annotated service methods — 18 methods enumerated across DataEntityServiceImpl, OwnershipServiceImpl, TermServiceImpl, DatasetFieldServiceImpl, DatasetFieldInternalInformationServiceImpl, EnumValueServiceImpl, DataEntityGroupServiceImpl, AlertHaltConfigServiceImpl, AlertServiceImpl, DataEntityInternalStateServiceImpl); (b) `ActivityIngestionRequestProcessor.process` (`DATA_ENTITY_CREATED` system events during ingestion FINALIZING phase, line 51-53); (c) `AlertServiceImpl.changeAlertStatus` + `AlertServiceImpl.resolveAutomatically` (OPEN/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED, lines 252,258,318,324)."
  - "**Read-path callers**: `ActivityServiceImpl.fetchAllActivities` (`findAllActivities`), `fetchMyActivities` (`findMyActivities`), `fetchDependentActivities` (`findDependentActivities`), `getDataEntityActivityList` (`findDataEntityActivities`), and the four count methods. Cursor `(lastEventId, lastEventDateTime)` originates at the HTTP layer (ActivityController) and threads through unchanged."
  - "**Housekeeping coupling**: `ActivityEmptyPartitionsHousekeepingJob` (extends EmptyPartitionsHousekeepingJob targeting `Tables.ACTIVITY.getName()`) drops EMPTY past partitions of this table on the 15-min housekeeping cycle via raw JDBC `DROP TABLE <partition>` (PartitionServiceImpl.java:120-127). The DROP TABLE requires an `ACCESS EXCLUSIVE` lock on the partition — see stress_findings.E1 for the read-vs-DROP collision analysis."
  - "**Partition lifecycle coupling**: `ActivityTablePartitionManager` (sidecar batch K) appends partitions at the `odd.activity.partition-period` cadence with `2 × period`-day width. INSERTs from this repository depend on partition coverage existing for `created_at = NOW()` at insert time."
  - "**ActivityMapper coupling**: results from `findAllActivities` / `findMyActivities` / `findDependentActivities` / `findDataEntityActivities` are mapped by `ActivityMapper::mapToActivity` at the service layer; this repo returns `Flux<ActivityDto>` containing the raw `(ActivityPojo, OwnerPojo, DataEntityPojo)` tuple (line 305-308). The mapper translates jsonb `old_state`/`new_state` into typed OpenAPI `ActivityState` based on `event_type`."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Happy-path INSERT: `saveReturning(pojo)` returns ActivityPojo with assigned `id` + `created_at` defaulted to NOW()."
  - "Happy-path batch INSERT: `save(List<ActivityPojo>)` of 999 / 1000 / 1001 rows — verifies the BATCH_SIZE=1000 partition boundary in `JooqReactiveOperations.executeInPartition` (line 62-70)."
  - "Partition-coverage failure: `saveReturning` issued when `created_at = NOW()` falls outside the latest existing activity partition — Postgres rejects with 'no partition of relation \"activity\" found for row'. Currently silent."
  - "Cursor-pagination order-stability at second boundaries (Stress Protocol C2). Probe P-021 emitted to measure the behaviour empirically. Static-inferred analysis says: forward cursoring is row-complete; visual order within a second can shuffle across page boundaries. Test gap: no integration test pins the contract either way."
  - "Partition DROP empty-only contract verification (Stress Protocol E1). Probe P-022 emitted. Static-inferred analysis says: `DROP TABLE <partition>` takes ACCESS EXCLUSIVE on the partition; concurrent SELECT on the parent table needs ACCESS SHARE on every partition. The CRITICAL safety invariant is that only EMPTY past partitions are dropped. Test gap: no integration test exercises the contract."
  - "USER_OWNER_MAPPING soft-delete: an activity row created by 'alice' before alice's user-owner mapping was soft-deleted — the LEFT JOIN filters `DELETED_AT IS NULL` (line 158/179/200/222), so the row appears as actor=null in the UI (visually indistinguishable from system events). No test confirms this is intentional."
  - "Cross-mode bleed: LOGIN_FORM 'alice' creates activity row at time T1; LDAP 'alice' (provider-null mapping override) authenticates at T2 and reads the Activity Feed — the LOGIN_FORM 'alice's activity rows resolve to LDAP 'alice's catalog OwnerPojo (and vice versa). No test pins the bleed; the only coverage is in ReactiveUserOwnerMappingRepositoryImpl batch N for the resolution side."
  - "Filter combinations: tagIds + ownerIds + userIds set semantics — `getCommonConditions` (line 246-277) adds `OR within facet, AND across facets`-ish predicates but does not document the join multiplicity (a data entity with multiple tags will produce duplicate activity rows in the SELECT). No DISTINCT clause."
  - "`type=DOWNSTREAM/UPSTREAM` with oddrns=[] (empty) — `DATA_ENTITY.ODDRN.in(oddrns)` at line 124, 204. jOOQ rewrites `in(emptyList)` to a `1=0` predicate; no result. Stress Protocol B5 + A4. Untested."
  - "Concurrent INSERT under partition rotation race: two writer threads each inserting at NOW() = boundary moment between partition N and partition N+1 — partition N+1 doesn't yet exist (partition creation cron has not yet run), but Postgres routing rule still references partition N's range. Verifies the 2× overlap design from ActivityTablePartitionManager sidecar implicit_adrs[0]."
- test_files: []
- gaps: |
    No test under `<odd-platform>/odd-platform-api/src/test` references
    `ReactiveActivityRepositoryImpl` or `ReactiveActivityRepository` (grep
    returned zero matches). Neither the write path nor the seven read paths
    are exercised by automated tests.

    The five highest-risk regression sites (Stress Protocol re-prioritised):

    1. **Cursor pagination order-stability at second boundaries** (line 285-288 + 291).
       Stress Protocol C2 corrects the prior v0.2 sidecar's "skip rows" claim
       to "stable result, shuffled visual order within a second". Probe P-021
       emitted to PIN the empirical behaviour. Without the probe, a future
       refactor that, say, switched the tuple comparator to full-precision
       (eliminating the truncate) would silently change the behaviour and
       no test would surface it.

    2. **Partition DROP empty-only contract** (PartitionServiceImpl.java:120-127
       + this repo line 50-54, 73-89). Stress Protocol E1. The DDL takes an
       ACCESS EXCLUSIVE lock; the R2DBC SELECT and INSERT both need
       ACCESS SHARE on the partition. The CRITICAL safety invariant is that
       only EMPTY past partitions are dropped — any regression that drops a
       non-empty partition silently loses audit data. Probe P-022 emitted.

    3. **The data-entity-FK invariant** (line 219 + V0_0_48__add_activity.sql:4,12).
       Every activity row is FK-bound to a real data_entity row. If a future
       refactor reintroduced the V0_0_1__init.sql-era `data_entity_id NULL`
       pattern for non-data-entity events (RBAC, Owner, Datasource), the
       LEFT JOIN read paths would surface the rows but the FK would block
       INSERT — a coordinated migration is required. No integration test
       pins the invariant.

    4. **USER_OWNER_MAPPING-join semantics** (cross-mode bleed, lines
       157/178/199/221 + the four locations in this file). The join is
       provider-agnostic; LSN-018-area test pins exist for the resolution
       repository but NOT for this repo's read path.

    5. **Batch INSERT correctness under > 1000 rows + partial-commit on
       chunk-error** (line 62-70). `executeInPartition` chunks at
       BATCH_SIZE=1000 and reduces with `zipWith(Integer::sum)` — chunk-3
       failure leaves chunks 1-2 committed (Stress Protocol E2 + E3).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Canonical feature-page for the Activity Feed — the read surface this repository serves."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim (WebFetched 2026-05-20):

      Section headings (in order): "Activity Feed" / "Where to find it" /
      "Filters on the global Activity page" / "Event types" / "Auto-resolved
      alert events" / "Configuration" / "Where to next".

      Event types enumerated on the live page (verbatim, grouped):
      - Data entity lifecycle: `DATA_ENTITY_CREATED`,
        `DATA_ENTITY_STATUS_UPDATED`, `BUSINESS_NAME_UPDATED`,
        `DESCRIPTION_UPDATED`
      - Ownership: `OWNERSHIP_CREATED`, `OWNERSHIP_UPDATED`, `OWNERSHIP_DELETED`
      - Tags and terms: `TAG_ASSIGNMENT_UPDATED`, `TERM_ASSIGNMENT_UPDATED`
      - Dataset fields (columns): `DATASET_FIELD_VALUES_UPDATED`,
        `DATASET_FIELD_DESCRIPTION_UPDATED`,
        `DATASET_FIELD_INTERNAL_NAME_UPDATED`, `DATASET_FIELD_TAGS_UPDATED`,
        `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`
      - Data entity groups: `CUSTOM_GROUP_CREATED`, `CUSTOM_GROUP_UPDATED`
      - Alerts: `OPEN_ALERT_RECEIVED`, `RESOLVED_ALERT_RECEIVED`,
        `ALERT_STATUS_UPDATED`, `ALERT_HALT_CONFIG_UPDATED`

      Filters section verbatim: "The Filters panel on the Activity page
      lets you narrow the feed by seven facets: Calendar, Datasource,
      Namespace, Event type, Tag, Owner, User."

      Configuration section verbatim: "Activity-feed retention and
      partitioning are controlled by the platform-level setting
      `odd.activity.partition-period` on [Configure ODD Platform].
      Adjust the partitioning cadence per the volume your deployment
      generates — the operator-side reference is the canonical home for
      this key."

      The page does NOT mention:
      - The four CUSTOM_METADATA_* event types in ActivityEventTypeDto.java:17-19
        (CUSTOM_METADATA_CREATED, CUSTOM_METADATA_UPDATED, CUSTOM_METADATA_DELETED)
      - The four DATA_ENTITY_*_UPDATED events at ActivityEventTypeDto.java:9-12
        (DATA_ENTITY_OVERVIEW_UPDATED, DATA_ENTITY_METADATA_UPDATED,
        DATA_ENTITY_SCHEMA_UPDATED, DATA_ENTITY_RELATION_UPDATED)
      - The data-entity-FK structural constraint that excludes RBAC / Owner /
        Datasource mutations from the audit log
      - The cross-owner read default (only `MY_OBJECTS` is owner-scoped)
      - Cursor pagination mechanics
      - The cross-mode actor-resolution behaviour (LOGIN_FORM vs LDAP)
      - Failure modes (silent partition-coverage gap, partial batch commits,
        ACCESS-EXCLUSIVE lock taken by housekeeping DROP TABLE)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#activity-feed-partitioning-odd-activity-partition-period"
    rationale: "Operator-side config-reference page — names the partition-period setting that determines partition-coverage availability for INSERTs by this repository."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      (Cited as carrying the same content as the ActivityTablePartitionManager
      sidecar batch K verified — preserved here as cross-reference rather
      than re-WebFetched this session.)
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/activity"
    anchor: ""
    rationale: "Expected API-reference page for the `activity` OpenAPI tag — aligned with the existing `developer-guides/api-reference/alerts` pattern."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Verified 404 by the ActivityController.getActivity sidecar batch A.
      The activity OpenAPI tag has no dedicated reference page on the live
      site.
- doc_drift_findings:
  - "Documentation enumerates 20 event types organised in 6 groups (Data entity lifecycle / Ownership / Tags and terms / Dataset fields / Data entity groups / Alerts). Code's `ActivityEventTypeDto.java:3-31` declares 27 values. Seven event types are present in code but undocumented: `DATA_ENTITY_OVERVIEW_UPDATED`, `DATA_ENTITY_METADATA_UPDATED`, `DATA_ENTITY_SCHEMA_UPDATED`, `DATA_ENTITY_RELATION_UPDATED`, `CUSTOM_METADATA_CREATED`, `CUSTOM_METADATA_UPDATED`, `CUSTOM_METADATA_DELETED`. Each can be emitted by ingestion (DATA_ENTITY_*) or by metadata-handler code (CUSTOM_METADATA_*); an operator reading the Activity Feed will see rows with `event_type` values the docs don't enumerate."
  - "Documentation makes NO mention of the structural audit-silence: the `activity` table's data_entity_id FK constraint (V0_0_48__add_activity.sql:4,12) physically excludes RBAC, Owner CRUD, Datasource registration, and Collector token mutations from the audit log. Operators reading the Activity Feed page will reasonably assume 'every platform change is audited'. The asymmetry is silent (see F-006 drift_class `forensic_silence_on_rbac_mutations` and the matching concept `audit-log-presence-asymmetry-2-tier-audit-story`)."
  - "Documentation's 'Filters on the global Activity page' section enumerates 7 facets (Calendar / datasource / namespace / event type / tags / owners / users) per the WebFetched live page. The repository surfaces an 8th implicit axis via the `type` parameter (ALL / MY_OBJECTS / UPSTREAM / DOWNSTREAM) — only `MY_OBJECTS` is owner-scoped. The docs do not state that the default view is cross-owner (every authenticated user sees activity for every data entity, regardless of ownership association)."
  - "Documentation's Configuration section frames `odd.activity.partition-period` as controlling 'retention and partitioning'. The activity table has NO retention DROP path for non-empty partitions — ActivityEmptyPartitionsHousekeepingJob only drops EMPTY past partitions (ActivityEmptyPartitionsHousekeepingJob.java:9-17). The activity table grows monotonically. (Cross-reference: ActivityTablePartitionManager sidecar batch K doc_drift_findings.[0] for the upstream version of this finding.)"
  - "Documentation does not surface that the housekeeping `DROP TABLE <activity_partition>` (PartitionServiceImpl.java:120-127) takes an `ACCESS EXCLUSIVE` lock — operators expecting 'background housekeeping' may be surprised by SELECT/INSERT contention during the 15-minute housekeeping cycle (stress_findings.E1; probe P-022 to measure)."

## implicit_adrs

- "**Audit is structurally scoped to data-entity events**: `activity.data_entity_id` is `NOT NULL` with FK constraint to `data_entity(id)` (V0_0_48__add_activity.sql:4,12). The decision encodes that this table is the 'data-entity audit log', not a 'platform audit log'. RBAC mutations (Role / Policy / Owner CRUD), Datasource registration, Collector token rotation, integration-wizard config changes — none can write here. A separate platform-event audit surface would be required to capture them." — evidence: V0_0_48__add_activity.sql:4 (`data_entity_id bigint NOT NULL`) + V0_0_48__add_activity.sql:12 (`CONSTRAINT activity_data_entity_id_fk FOREIGN KEY (data_entity_id) REFERENCES data_entity (id)`) + this repo line 219 (`.join(DATA_ENTITY).on(DATA_ENTITY.ID.eq(ACTIVITY.DATA_ENTITY_ID))` — INNER JOIN; assumes the FK is unbreakable). — intent_anchor: "the FK constraint at V0_0_48__add_activity.sql:12 is named `activity_data_entity_id_fk` (verbose, schema-evolution-aware naming) and the column is NOT NULL (line 4) — both are explicit choices over the alternative `data_entity_id bigint NULL` which would have left the door open for non-data-entity events. The schema author committed to data-entity-scoped audit." — confidence: HIGH
- "**Cursor pagination uses SYMMETRIC truncate-to-second comparator + full-precision ORDER BY**: the cursor predicate is `row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` (line 287-288) where BOTH sides are second-precision; the ORDER BY is full-precision `ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc()` (line 291). The asymmetry between comparator-precision and sort-precision is intentional — the client passes `lastEventDateTime` as an `OffsetDateTime` whose microsecond precision may have been altered by JSON serialisation (the ISO-8601 wire format only carries 3 decimal digits in some clients); truncating both sides of the comparator to second accommodates that loss while the ORDER BY preserves full-precision newest-first sort." — evidence: line 285-288 (symmetric truncation) + line 290-291 (full-precision order) + DateTimeUtil.mapUTCDateTime usage. — intent_anchor: "the `truncatedTo(ChronoUnit.SECONDS)` on `truncated` (line 286) combined with `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)` on the column side (line 288) — both sides explicitly truncate; the ORDER BY at line 291 deliberately does NOT, preserving the full timestamp for newest-first." — confidence: MEDIUM (the WHY-anchor is the syntactic shape; no `// client-clock-skew tolerance` comment proves intent — but the symmetric-truncation-asymmetric-sort is too deliberate to be coincidence).
- "**Batch INSERT chunked at BATCH_SIZE=1000 with `.zipWith(Integer::sum).then()` reduction**: `save(List<ActivityPojo>)` uses `JooqReactiveOperations.executeInPartition` (line 62-70) — the SAME chunking primitive used by every batched INSERT in the repository layer (JooqReactiveOperations.java:24,51-67). The CONVENTION extends to alert-emission flows (AlertServiceImpl emits N alerts → createActivityEvents → save). The 1000-row threshold is a JDBC-server-side maximum-arg-count workaround for Postgres + R2DBC drivers." — evidence: this repo line 62 + JooqReactiveOperations.java:24 (`BATCH_SIZE = 1000`) + JooqReactiveOperations.java:51-67 (the shared executeInPartition pattern). — intent_anchor: "the constant `BATCH_SIZE = 1000` is centralised at JooqReactiveOperations.java:24 — not per-repository; the convention is workspace-wide. The reduction `.reduce((m1, m2) -> m1.zipWith(m2, Integer::sum))` is the standard reactive partial-result aggregator." — confidence: HIGH
- "**Actor resolution joins USER_OWNER_MAPPING by username only (not by auth provider)**: every read path issues `.leftJoin(USER_OWNER_MAPPING).on(USER_OWNER_MAPPING.OIDC_USERNAME.eq(ACTIVITY.CREATED_BY).and(USER_OWNER_MAPPING.DELETED_AT.isNull()))` (lines 157-158, 178-179, 199-200, 221-222). The join is provider-agnostic — this is the read-side mirror of the `provider-null-cross-mode-bleed` mechanism documented at `lineage/odd-platform/concepts/detail/invariants/provider-null-cross-mode-bleed.yaml` (per batch-N ReactiveUserOwnerMappingRepositoryImpl). The decision predates multi-auth-mode deployments; it works correctly for single-mode deployments and bleeds usernames across modes for any deployment using multiple auth backends simultaneously." — evidence: lines 157-158/178-179/199-200/221-222 (four occurrences of the provider-agnostic LEFT JOIN) + ReactiveUserOwnerMappingRepositoryImpl batch N + concept `provider-null-cross-mode-bleed`. — intent_anchor: "the JOIN ON predicate explicitly names `OIDC_USERNAME` and `DELETED_AT` — choosing two columns out of the four available on USER_OWNER_MAPPING (the omitted ones are `OWNER_ID` for filter-narrowing — used in getCommonConditions line 273 for `userIds` filter — and `PROVIDER` which is NEVER referenced from this file). PROVIDER's absence is a deliberate column-selection, not an oversight." — confidence: HIGH
- "**Repository implements interface directly — NO ReactiveAbstract*CRUDRepository inheritance**: line 45 `class ReactiveActivityRepositoryImpl implements ReactiveActivityRepository` — there is no `extends ReactiveAbstractSoftDeleteCRUDRepository` or `extends ReactiveAbstractCRUDRepository`. The decision encodes that activity rows are APPEND-ONLY: no `delete(long)`, no `update(...)`, no `idCondition(...)`, no `addSoftDeleteFilter`. The schema HAS `created_at` and `created_by` but NO `updated_at` or `deleted_at` column (V0_0_48__add_activity.sql:1-13). Combined with the lack of a `paginate(...)` call (Stress Protocol C1), this is the strongest architectural distinction between this repository and the rest of the data layer." — evidence: line 45 (no `extends`) + V0_0_48__add_activity.sql:1-13 (no updated_at / deleted_at columns) + grep of this file for `addSoftDeleteFilter|deleteFrom|paginate|update\\(` (zero matches each). — intent_anchor: "the class declaration on line 45 is the bare `implements ReactiveActivityRepository` without any inherited CRUD machinery — explicit author choice. The interface (ReactiveActivityRepository.java:11-87) declares ONLY save + find + count methods — no delete, no update. Append-only audit semantics encoded at the type level." — confidence: HIGH

## bugs_limitations_corner_cases

- "**The activity table grows monotonically — no DELETE path, no non-empty-partition DROP path, the docs' 'retention and partitioning are controlled' framing is misleading**. `ActivityEmptyPartitionsHousekeepingJob` only DROPs partitions that contain zero rows (ActivityEmptyPartitionsHousekeepingJob.java:1-18; extends EmptyPartitionsHousekeepingJob which only handles empty partitions). Once a partition has any activity row, it persists forever. A high-volume deployment (1M events/day) accumulates ~365GB+/year of audit data with no recovery path short of manual `DROP TABLE activity_YYYYMMDD_YYYYMMDD`." — evidence: ActivityEmptyPartitionsHousekeepingJob.java:9-17 + the absence of any DELETE-from-activity in this repository (no `deleteFrom(ACTIVITY)` anywhere in the file, grep verified zero matches) + WebFetch activity-feed#configuration ('retention and partitioning are controlled by'). — severity: HIGH (silent-data-growth class — mirrors ActivityTablePartitionManager bugs_limitations_corner_cases[0]).
- "**Cross-mode actor bleed: LOGIN_FORM 'alice' and LDAP 'alice' resolve to the SAME OwnerPojo on the read path**. Every read query LEFT JOINs `USER_OWNER_MAPPING ON OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL` (lines 157-158, 178-179, 199-200, 221-222) — provider-agnostic. A deployment migrating from LOGIN_FORM to LDAP without uniqueness on (`username`, `provider`) tuples at the user-creation layer will see the historical LOGIN_FORM 'alice' activity rows mapped to the LDAP 'alice' owner — even if those are different people. The write side records the username at INSERT time (`ActivityServiceImpl.createActivityEvent` line 47-49 emits `UserDto::username` only); the read side blindly trusts it. PRIMARY-SOURCE for read-side cross-mode bleed; the resolution-side primary is ReactiveUserOwnerMappingRepositoryImpl batch N." — evidence: lines 157-158/178-179/199-200/221-222 (the four PROVIDER-omitted joins) + ActivityServiceImpl.java:47-49 (single-username INSERT) + V0_0_48__add_activity.sql:10 (`created_by varchar(512)` — no provider column) + concept `provider-null-cross-mode-bleed`. — severity: HIGH (forensic-integrity class — auditing 'who did X' returns ambiguous answers when the username space overlaps across auth modes).
- "**`activity.created_by` is `varchar(512)` NULLABLE — anonymous mutations and ingestion-path system events write null**. `ActivityServiceImpl.createActivityEvent` (line 47-49) emits `null` when `authIdentityProvider.getCurrentUser()` returns empty: (a) under `auth.type=DISABLED` (anonymous traffic mutates the catalog), (b) ingestion-path FINALIZING-phase processors (ActivityIngestionRequestProcessor line 53 explicitly `.systemEvent(true)`; no username binding), (c) scheduler-driven AlertServiceImpl flows that issue OPEN/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED with `.systemEvent(true)`. All null-`created_by` rows orphan on the USER_OWNER_MAPPING LEFT JOIN and surface in the UI with `OwnerPojo = null` — visually indistinguishable from 'system' events with no further discriminator beyond `is_system_event = true`. Under DISABLED-mode, the anonymous mutations LOOK like system events." — evidence: V0_0_48__add_activity.sql:10 (created_by varchar(512), NULL allowed) + ActivityServiceImpl.java:47-49 (the `switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))` line — explicit null fallback) + DisabledAuthSecurityConfiguration.java:16 (anonymous permitted under DISABLED). — severity: MEDIUM (anonymity-bypass class — under DISABLED, mutations are unattributable in the audit log; the UI cannot distinguish them from system events).
- "**'My Activities' axis-mismatch: `findMyActivities(currentOwnerId)` filters by `OWNERSHIP.OWNER_ID = currentOwnerId` (activity ON entities I own), NOT by `USER_OWNER_MAPPING.OWNER_ID = currentOwnerId` (activity I performed)**. Lines 91-107 of this file pass `currentOwnerId` into `addJoins`/`getCommonConditions`, which produce `OWNERSHIP.OWNER_ID.in(ownerIds)` predicates (line 270). The actor-side filter (`USER_OWNER_MAPPING.OWNER_ID.in(userIds)`, line 273) is only added if the caller separately passed `userIds`. The UI's 'My' tab shows 'changes to entities my owner is attached to' — which is NOT 'changes I personally made'. A user with no ownership attachments but who has made platform changes sees their own changes ONLY by passing themselves explicitly via `userIds`, not via the `MY_OBJECTS` type parameter. The docs' 'auditing a specific person's platform activity' framing for the User filter (per batch-A WebFetched excerpt) implicitly acknowledges this — but the page does not say MY_OBJECTS is owner-axis-only." — evidence: this repo lines 91-107 (the `findMyActivities` method body) + lines 264-275 (`getCommonConditions` — ownerIds vs userIds are different predicates) + ActivityServiceImpl.java:184-199 (the service path that uses currentOwnerId from `fetchAssociatedOwner`) + WebFetch /features/active-platform-features/activity-feed (User filter framed for 'auditing a specific person'). — severity: MEDIUM (semantics gap — a confused operator looking at the 'My' tab will under-detect their own past changes).
- "**Cursor pagination's symmetric truncate-to-second may produce visual-order shuffle within a second under sustained write rate**. Line 287-288: BOTH sides of the row-comparator are second-precision; the ORDER BY at line 291 sorts at full microsecond precision. **CORRECTED FROM v0.2 SIDECAR CLAIM**: this is NOT a row-skip class bug (the symmetric truncation guarantees no row is missed); it is a visual-order class anomaly — two consecutive pages of the same client cursor session may show rows arriving at T+0.123s and T+0.456s (same second) in different relative orders, because the cursor predicate cannot distinguish them at second-precision but the ORDER BY does at microsecond-precision. Probe P-021 emitted to pin the exact behaviour. Magnitude bounded by rows-per-second × page-overlap-density; harmless for low-write-rate; potentially confusing for operators paging through high-write-rate audit data." — evidence: line 285-288 (symmetric truncation on cursor) + line 290-291 (full-precision ORDER BY) + Stress Protocol C2 trace. — severity: LOW (visual-order class, not data-correctness; corrected severity from prior v0.2 MEDIUM).
- "**`save(List<ActivityPojo>)` partial-commit semantics under reactive-Mono.zip error**: line 62-70 dispatches to `executeInPartition` which chunks at 1000 rows and reduces via `.zipWith(Integer::sum)` (JooqReactiveOperations.java:62-66). If chunk 3 of 5 fails (e.g. partition coverage gap on chunk-3's rows because they straddle a midnight rotation boundary), `.zipWith` propagates the chunk-3 error — but chunks 1, 2, and any chunk that completed before chunk-3's error already INSERTed to PG (no transaction wraps the chunked save at this level). The result: a `save(List<ActivityPojo>)` call that surfaces an error to the caller has nonetheless committed PARTIAL audit data. AlertServiceImpl which calls this method twice (lines 258, 324) with multiple alert events could see N/2 alert-receive activity rows committed and N/2 lost, with no compensating delete." — evidence: this repo line 62-70 (no `@Transactional` / `Mono.usingWhen` around the save) + JooqReactiveOperations.java:51-67 (executeInPartition reduce-with-zipWith, no rollback path) + AlertServiceImpl.java:252-258 (the batch-emit calling pattern). — severity: MEDIUM (forensic-completeness class).
- "**INNER JOIN to DATA_ENTITY (line 219) means orphan activity rows after data_entity hard-delete disappear from reads**. If a data_entity row is hard-DELETEd (vs soft-deleted via STATUS=DELETED), the FK constraint at V0_0_48__add_activity.sql:12 (`REFERENCES data_entity (id)`) is `ON DELETE`-unspecified — Postgres defaults to NO ACTION, which would BLOCK the delete. BUT DataEntityHousekeepingJob (per F-010 sidecar) DOES cascade-delete data_entity rows past TTL — which would cascade-delete the activity rows too (if the FK has CASCADE) OR block the housekeeping job's delete (if no CASCADE). The exact CASCADE behaviour is migration-version-dependent and not surfaced in this repository file. Operator reading: 'the audit row referencing a soft-deleted data entity is preserved; the audit row referencing a hard-deleted data entity is gone'. Forensic implication: cleaning up old data entities also cleans up the audit trail explaining WHO created them." — evidence: V0_0_48__add_activity.sql:12 (the FK declaration — no ON DELETE clause visible in the migration) + this repo line 219 (`.join(DATA_ENTITY)` — INNER JOIN; rows with no data_entity match are excluded from reads regardless of FK behaviour) + F-010 DataEntityHousekeepingJob (cascade-delete TTL job). — severity: MEDIUM (forensic-history-erasure class).
- "**No DISTINCT on the SELECT — multi-tag / multi-owner filters duplicate activity rows in results**. `buildBaseQuery` (line 208-225) issues plain `DSL.select(selectFields).from(ACTIVITY).join(DATA_ENTITY)...` followed by conditional LEFT JOINs to TAG_TO_DATA_ENTITY and OWNERSHIP based on filter presence (line 237-242). A data entity with 3 tags + 2 owners produces 6 rows from the join cardinality alone; the SELECT returns all 6 (with the activity columns identical and the join columns differing). The `findActivities` flow doesn't apply DISTINCT — UI sees duplicates. The `size` parameter caps the result set but does NOT collapse duplicates first — a `size=100` request with multi-tag filter may return 100 rows representing only 30-40 distinct activity events." — evidence: line 208-225 (buildBaseQuery, no DISTINCT) + line 237-242 (the LEFT JOINs that produce multiplicity) + line 290-292 (where + orderBy + limit — no DISTINCT applied). — severity: MEDIUM (results-correctness class — UI may show 'duplicate' activity entries).
- "**Housekeeping `DROP TABLE <activity_partition>` takes ACCESS EXCLUSIVE — blocks concurrent SELECT/INSERT on the parent activity table while the DROP holds the lock**. PartitionServiceImpl.java:120-127 (`final String query = \"DROP TABLE %s\".formatted(partitionName)`) runs as bare JDBC DDL via the housekeeping connection (HousekeepingJobManager.java:32 `pgConnectionFactory.getConnection()`); the DDL takes an ACCESS EXCLUSIVE lock on the target partition. PostgreSQL's partition-routing logic for the parent `activity` table — used by every R2DBC INSERT (this repo line 50-54, 57-71) and every R2DBC SELECT against the parent (line 73-89, 91-107, 109-126, 128-142, 145-163, 165-184, 186-206) — needs ACCESS SHARE on the targeted child partition. While the DROP is in flight, all concurrent INSERTs and SELECTs that touch THAT partition's date range BLOCK. The DROP is per-empty-past-partition, so the blocking window is short for any given partition; BUT under a 15-min housekeeping rate with N empty partitions, the blocking can accumulate to N × DROP-duration. There is no advisory-lock coordination between housekeeping and the R2DBC path; the only mediation is Postgres's lock manager FIFO. Stress Protocol E1; probe P-022 emitted." — evidence: PartitionServiceImpl.java:120-127 (DROP TABLE DDL) + HousekeepingJobManager.java:25-39 (15-min fixedRate, ShedLock-coordinated) + this repo lines 50-54 / 57-71 / 73-89 / 91-107 / 109-126 / 128-142 / 145-163 / 165-184 / 186-206 (every read and write path) + PostgreSQL lock-modes documentation. — severity: MEDIUM (lock-contention class — empirically observable only under load + partition cycling; harmless for steady-state low-write deployments).

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "`ReactiveActivityRepositoryImpl` is a `@Repository` bean — not on the HTTP surface. Auth mode (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP | S2S`) does not apply directly. The bean is instantiated unconditionally. BUT the repository's read paths produce DIFFERENT row sets depending on whether `created_by` carries a real username or null — and that distinction is auth-mode-dependent (DISABLED-mode anonymous mutations write null; LOGIN_FORM/OAUTH2/LDAP/S2S authenticated mutations write the OIDC username). The actor-resolution LEFT JOIN to USER_OWNER_MAPPING is provider-agnostic (lines 157-158, 178-179, 199-200, 221-222) — cross-mode bleed mechanism (see implicit_adrs.[3] + bugs_limitations_corner_cases.[1])." — evidence: ReactiveActivityRepositoryImpl.java:43 (`@Repository`) + V0_0_48__add_activity.sql:10 (created_by NULL allowed) + ActivityServiceImpl.java:47-49 (the null-username fallback) + lines 157-158/178-179/199-200/221-222 (the four provider-agnostic JOINs).
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion (the repository is downstream of both the HTTP controllers and the ingestion processors). The `ActivityIngestionRequestProcessor` (FINALIZING phase) writes to this repository via `ActivityServiceImpl.createActivityEvents`, but the IngestionDataEntitiesFilter is upstream — once the request crosses the filter and reaches this repo, ingestion-vs-UI is no longer distinguishable. `is_system_event = true` is the only schema-level signal that the write came from an ingestion / scheduler path."
- authorization_assertions: []
  - "No `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`, no role check at the repository layer. Authorization for read paths lives upstream at `ActivityController` (which carries NO auth annotations either — see ActivityController.getActivity sidecar batch A) — falls through to `pathMatchers('/**').authenticated()`. Authorization for write paths lives at the `@ActivityLog`-annotated service methods, which DO carry permission checks in some cases (e.g. DataEntityServiceImpl.updateBusinessName at line 336 is gated by upstream controller `@PreAuthorize(\"hasPermission(#dataEntityId, 'DATA_ENTITY', 'DATA_ENTITY_UPDATE_BUSINESS_NAME')\")`). The repository is gate-blind — it executes whatever query the service hands it." — evidence: this repo file 1-310 (no auth annotations on any method) + ActivityController.getActivity sidecar batch A security.authorization_assertions:[]
- owner_scoping: "BYPASSES at the repository SQL layer for `findAllActivities`, `findDependentActivities`, `findDataEntityActivities`, and the corresponding count methods (no `OWNERSHIP.OWNER_ID = currentUser.ownerId` predicate; only filter-parameter-driven narrowing). RESPECTS at the repository SQL layer for `findMyActivities` and `getMyObjectsActivitiesCount` — but the 'respects' is along the OBJECT-OWNERSHIP axis (entities the caller owns), not the ACTOR axis (activity the caller performed). See bugs_limitations_corner_cases.[3] for the axis-mismatch finding. The read-collaborative posture (REFACTOR-024 / REFACTOR-203 / REFACTOR-201 from concepts.yaml, sidecar batch I) extends here: any authenticated user can read activity across all owners by issuing `type=null` or `type=ALL`." — evidence: this repo line 73-89 (findAllActivities — no current-user predicate) + line 91-107 (findMyActivities — currentOwnerId is object-side via OWNERSHIP.OWNER_ID, not actor-side via USER_OWNER_MAPPING.OWNER_ID — line 270 vs 273) + line 109-126 (findDependentActivities — no current-user filter; lineage-scoped only).
- data_exposure:
  - "Activity row payload (id, event_type, old_state JSONB, new_state JSONB, is_system_event, created_at, created_by) → any authenticated caller via `findAllActivities` / `findDependentActivities` / `findDataEntityActivities`. The JSONB `old_state` / `new_state` columns carry user-supplied free-text content for DESCRIPTION_UPDATED, BUSINESS_NAME_UPDATED, internal-name edits, custom-metadata key/value pairs — any sensitive data accidentally entered into those fields is exposed via the audit feed with no owner scoping (cross-reference: ActivityController.getActivity sidecar batch A bugs_limitations_corner_cases.[4])." — evidence: V0_0_48__add_activity.sql:6-7 (old_state / new_state as jsonb) + this repo line 290-291 (where + orderBy with no field-redaction) + DescriptionActivityStateDto.java:3 (the typed wrapper around the description text field).
  - "Actor identity (`created_by` = OIDC_USERNAME at write time; resolved to OwnerPojo at read time via USER_OWNER_MAPPING LEFT JOIN, line 157-158/178-179/199-200/221-222) → any authenticated caller. A user enumerating `userIds` can discover which platform usernames have generated which activity rows over time — the same enumeration vector observed on ActivityController batch A security.data_exposure.[2]; this repository is the SQL implementation behind that vector." — evidence: lines 157-158/178-179/199-200/221-222 (the username-resolution JOIN) + line 273 (`USER_OWNER_MAPPING.OWNER_ID.in(userIds)` predicate, which lets callers narrow by user IDs).
  - "Cross-mode actor confusion (LOGIN_FORM 'alice' vs LDAP 'alice') → both resolve to the same OwnerPojo on the read path due to the provider-agnostic JOIN. A reviewer reading the activity feed to determine 'did X happen via LDAP or LOGIN_FORM?' cannot distinguish from the surfaced data." — evidence: lines 157-158/178-179/199-200/221-222 (the absent PROVIDER predicate) + ActivityServiceImpl.java:47-49 (the username-only write path) + concept `provider-null-cross-mode-bleed`.
- known_security_gaps:
  - "**Provider-agnostic actor resolution = cross-mode bleed read surface**. Activity rows written under one auth mode resolve to the SAME OwnerPojo as activity rows written under another auth mode when the OIDC username string matches. A LOGIN_FORM 'alice' and an LDAP 'alice' display in the UI as the same actor — even if they are different people. Forensic incident response over an audit feed is misled. The bleed is symmetric: the write-side records only the username (no provider qualifier); the read-side joins by username only." — evidence: this repo lines 157-158/178-179/199-200/221-222 (read-side JOIN omits PROVIDER) + ActivityServiceImpl.java:47-49 (write-side records only username) + V0_0_48__add_activity.sql:10 (no `created_by_provider` column on schema). — severity: HIGH (forensic-integrity).
  - "**Anonymous-mutation attribution gap under DISABLED auth.type**. Under `auth.type=DISABLED`, anonymous traffic CAN mutate the catalog (description edits, tag assignments, ownership changes) and the resulting activity rows write `created_by = null` (ActivityServiceImpl line 47-49). These rows are visually indistinguishable from system events at the UI layer — the only discriminator is `is_system_event` which CAN be `false` (anonymous-mutation case) OR `true` (genuine ingestion / scheduler) for null-created_by rows. A reviewer cannot determine whether a null-created_by `false`-system_event row is an unattributed user action or a missed-username on a real user. The docs frame DISABLED as 'dev-only' (per ActivityController batch A) but the runtime cost is real." — evidence: ActivityServiceImpl.java:47-49 (null-username fallback in `switchIfEmpty(Mono.defer(...))`) + V0_0_48__add_activity.sql:8 (is_system_event NOT NULL) + DisabledAuthSecurityConfiguration.java:16 (anonymous permitted). — severity: MEDIUM (auth-mode-cost class).
  - "**Audit-silence on RBAC / Owner / Datasource / Collector-token mutations** is structurally enforced at the schema (NOT a missing-annotation bug). The activity table CANNOT store an RBAC mutation event because `data_entity_id` is NOT NULL with FK to data_entity. The Activity Feed is structurally a 'data-entity audit log', not a 'platform audit log'. Forensic investigation of 'who changed admin role X' / 'who deleted owner Y' / 'who registered datasource Z' has NO surface on the activity table; operators must dig into raw application logs (which may not exist in production, may not be retained, and are not bound to any audit retention policy)." — evidence: V0_0_48__add_activity.sql:4 (data_entity_id NOT NULL) + V0_0_48__add_activity.sql:12 (FK constraint) + this repo line 219 (INNER JOIN to DATA_ENTITY) + F-006 drift_class `forensic_silence_on_rbac_mutations` (the multi-batch sidecar consolidation) + concept `no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f`. — severity: HIGH (forensic-coverage class; F-006 6-sidecar reinforcement).
  - "**`new_state` / `old_state` jsonb columns leak any sensitive content typed into description, business-name, custom-metadata fields** to any authenticated reader via the cross-owner default. The repository surfaces the columns verbatim (line 305-308 maps ActivityPojo with the raw jsonb fields). No redaction policy is applied at the SQL layer. PII / credentials / incident-notes accidentally entered into a description field BY a user with permission to edit that description become readable BY any authenticated user via `findAllActivities`." — evidence: V0_0_48__add_activity.sql:6-7 + this repo line 290-291 (no field-level redaction) + ActivityController.getActivity batch A bugs_limitations_corner_cases.[4]. — severity: MEDIUM (data-exposure class).
  - "**Partial-commit on batch `save(List<ActivityPojo>)` leaves audit gaps**: a failed batch save (e.g. mid-chunk partition-coverage gap) commits the successful chunks while surfacing the error to the caller — the audit trail has 'holes' that an attacker triggering ingestion-side errors could exploit to hide individual events. AlertServiceImpl's batch alert flows (line 252-258, 318-324) are the most exposed: a large alert batch arriving at midnight (partition rotation boundary) could produce a partial commit with N/2 alerts missing from the audit. No compensating delete." — evidence: this repo line 62-70 + JooqReactiveOperations.java:51-67 (no transaction wrap; reduce-with-zipWith partial-commit) + AlertServiceImpl.java:252-258, 318-324 (batch-emit callers). — severity: MEDIUM (forensic-completeness; intersects with F-007 alert lifecycle).

## performance

- hot_paths:
  - "**`save(List<ActivityPojo>)` runs on the HTTP request thread for `@ActivityLog`-annotated service methods and on the ingestion thread for ActivityIngestionRequestProcessor**. The batch chunks at 1000 rows and reduces with `Integer::sum` — a single multi-thousand-row activity batch (e.g. a large ingestion request with N new data entities) emits N audit rows that pass through this repository BEFORE the request completes." — evidence: line 57-71 (save method, executeInPartition delegation) + JooqReactiveOperations.java:51-67 (BATCH_SIZE=1000, chunked execution) + ActivityIngestionRequestProcessor.java:44-56 (constructs N events from request.getNewIds and dispatches all).
  - "**`findAllActivities` is the global Activity Feed read path** — a single PG query with 1 INNER JOIN (DATA_ENTITY) + 2 LEFT JOINs (USER_OWNER_MAPPING, OWNER) baseline, plus conditional LEFT JOINs (DATA_SOURCE, NAMESPACE, TAG_TO_DATA_ENTITY, OWNERSHIP) when those filter facets are present. With 4-7 LEFT JOINs against an audit table that may have tens of millions of rows over a long-running deployment, query-plan stability depends on the `activity_created_at_idx` index (V0_0_48__add_activity.sql:15) and on Postgres partition pruning by `created_at` range." — evidence: line 73-89 + line 208-225 (the base query construction) + line 290-292 (where + orderBy + limit) + V0_0_48__add_activity.sql:15 (created_at index).
  - "**Cursor pagination's `(trunc(created_at, SECOND), id)` tuple comparison** (line 287-288) uses a derived-column predicate on the LEFT side — Postgres may not use the `activity_created_at_idx` for the truncated comparator if it cannot prove the function is index-aware. The `data_entity_id_idx` index (V0_0_48__add_activity.sql:17) helps for `findDataEntityActivities` but not for the global feed." — evidence: line 285-288 + V0_0_48__add_activity.sql:15-17 (two indexes available).
- throughput_characteristics:
  - "Reactive Mono/Flux signature throughout — non-blocking on the request thread; throughput bound by R2DBC connection-pool size + Postgres query-plan execution time."
  - "Batched INSERT via `executeInPartition` at 1000-row chunks — appropriate for ingestion-FINALIZING-phase batches; less optimal for individual `@ActivityLog`-annotated service calls (single-row INSERTs via `saveReturning`, line 50-54)."
  - "Single-row INSERT (`saveReturning`, line 50-54) is a `DSL.insertInto(ACTIVITY).set(record).returning()` — returning the full record so the service layer can read back `id` + defaulted `created_at`. Per-row overhead is unavoidable for the per-mutation audit pattern, but it adds 1 PG round-trip per audited mutation."
- resource_allocation:
  - "**Per-`saveReturning` cost**: 1 INSERT ... RETURNING round-trip per audited mutation. The `@ActivityLog`-annotated service methods (18 enumerated; grep verified) each fire ONE saveReturning call. A high-mutation-rate UI (operator tagging 100 entities in rapid succession) issues 100 audit inserts in sequence."
  - "**Per-`save(List)` cost**: ⌈N/1000⌉ INSERT statements per N-event batch. Each statement issues a multi-row VALUES list (jOOQ `newRecord()` per pojo, chained via `set().newRecord().set()...`). The ingestion-FINALIZING DATA_ENTITY_CREATED batch is the heaviest single-call pattern."
  - "**Per-read cost (`findAllActivities`)**: 1 multi-join SELECT against the partitioned `activity` table, scoped by date-range conditions (line 255-256). Postgres partition pruning eliminates partitions whose date range falls outside the query window — query cost scales with the number of partitions overlapping the window × rows-per-partition × selectivity of the filter predicates. For a 1-day window with a partition cadence of 30 days, only 1 partition is touched (or 2 at the rotation boundary)."
  - "**Per-read cost (`findDependentActivities`)**: 1 lineage-resolution call (`DataEntityRelationsService.getDependentDataEntityOddrns`, upstream of this repo) + 1 multi-join SELECT with `DATA_ENTITY.ODDRN.in(oddrns)` predicate (line 124, 204). IN-clause cardinality matches lineage-graph fanout."
  - "**No connection-pool isolation for the housekeeping cycle's data-entity cascade-DELETE** (F-010 finding) — that DELETE cascades through activity rows transitively via the FK, but the cascading behavior is governed by the FK's `ON DELETE` clause (V0_0_48__add_activity.sql:12 — not specified in this migration; defaults to NO ACTION per PG)."
- scaling_characteristics:
  - "Stateless repository — instances scale horizontally; concurrency is bound by R2DBC pool + Postgres connection limits."
  - "**No row-level lock in this repository** — purely INSERT + SELECT. The cross-process serialisation lives at `ActivityTablePartitionManager` (advisory lock 90 + ShedLock) for partition CREATE only. The housekeeping `DROP TABLE <partition>` (PartitionServiceImpl.java:120-127) takes a PostgreSQL ACCESS EXCLUSIVE table-level lock — Stress Protocol E1 + probe P-022."
  - "Cursor pagination scales linearly for the requesting client. Stress Protocol C2 corrects the prior v0.2 claim: forward cursoring is order-stable in the sense of 'no row skipped'; within-second visual order may shuffle across page boundaries."
  - "**Activity table size growth is unbounded** — no DELETE path, no DROP of non-empty partitions. After 5+ years on a 1M-events/day deployment, the partition count grows to 60+ (at 30-day cadence) or 250+ (at 7-day cadence — operators who tuned per the docs' 'narrower partitions for performance' guidance). Postgres planner overhead grows with partition count even when partition pruning is effective."
  - "**Cross-batch coupling with F-010 housekeeping**: the per-cycle 15-minute housekeeping iteration drops ONLY empty past partitions of activity (ActivityEmptyPartitionsHousekeepingJob). Non-empty partitions never drop; the activity table accumulates monotonically. No alert / metric flags this."
- known_performance_gaps:
  - "**Unbounded growth of activity table** (mirrors ActivityTablePartitionManager bugs_limitations_corner_cases.[0] from the upstream sidecar). The repository writes; nothing deletes. Multi-year deployments accumulate 100s of GB of audit data with no recovery path." — evidence: this repo file 1-310 (no `deleteFrom(ACTIVITY)` anywhere) + ActivityEmptyPartitionsHousekeepingJob.java:9-17 (only EMPTY partition drops). — severity: HIGH
  - "**No DISTINCT on multi-facet filter queries** — multi-tag / multi-owner filters produce N×M-row results before LIMIT applies. UI with `tagIds=[a,b,c]+ownerIds=[1,2]+size=100` may return only 30-40 distinct activity events with 60-70 duplicates." — evidence: line 208-225 (buildBaseQuery, no DISTINCT) + line 237-242 (the multiplicity-producing LEFT JOINs) + line 290-292 (no DISTINCT applied at finalize). — severity: MEDIUM
  - "**Cursor predicate function-on-column may bypass index**: `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)` (line 288) wraps the indexed column in a function — Postgres can use the index only if a functional index `(date_trunc('second', created_at))` exists. The migration creates `activity_created_at_idx ON activity(created_at)` (V0_0_48__add_activity.sql:15) — plain column, not functional. Deep-window pagination triggers full-partition scans." — evidence: line 287-288 + V0_0_48__add_activity.sql:15. — severity: MEDIUM
  - "**Per-mutation single-row INSERT round-trip** is unavoidable for the per-event audit pattern but adds N round-trips for N rapid mutations. No batched-mutation aggregation at the service level (each `@ActivityLog` method fires ONE saveReturning). A bulk-tag-assignment UI flow that updates 100 entities issues 100 audit-INSERT round-trips serialised on the request thread." — evidence: line 50-54 (saveReturning is single-row) + ActivityServiceImpl.java:43-52 (createActivityEvent is single-event) + grep of `@ActivityLog` annotations (18 single-method matches; none batch). — severity: LOW
  - "**Coordinate-dependency with partition-creation cron**: an INSERT issued at NOW() = midnight rotation boundary depends on the previous-day partition (whose 2×period width covers today per ActivityTablePartitionManager implicit_adrs[0]) — UNLESS the partition-create cron has been failing silently (ActivityTablePartitionManager bugs_limitations_corner_cases[2]). The repository surfaces partition-coverage gaps as raw Postgres errors via `ExceptionUtils.translateDatabaseException`; there is no graceful-degradation path." — evidence: this repo line 50-54, 57-71 (no fallback) + ActivityTablePartitionManager bugs_limitations_corner_cases[2] (silent-fail). — severity: LOW (gated on the partition cron working; an upstream failure cascades).
  - "**Housekeeping DROP TABLE may stall reads/writes briefly under load** — the ACCESS EXCLUSIVE lock taken by `DROP TABLE <activity_partition>` (PartitionServiceImpl.java:122) blocks all concurrent INSERT/SELECT that route to that partition. Empirically measurable under high-write-rate × partition-drop-rate combinations. Probe P-022 emitted. Stress Protocol E1." — evidence: PartitionServiceImpl.java:120-127 + HousekeepingJobManager.java:25 (15-min rate). — severity: MEDIUM

## stress_findings

The Stress Protocol (LSN-019, Rule 9) fires on every detected trigger across five categories. Each finding records: trigger location, the auto-fired question, and ONE of three resolutions — trace-answer (STATIC-INFERRED with file:line), probe-answer (PROBE-NEEDED + emitted probe), or out-of-scope reference (REFERENCE + node_id).

### Category A — Tunables (numeric / null / boundary)

- **A1** — `size: Integer` parameter on every read method (lines 76, 94, 112, 131). Question: what at `size=null` / `size=0` / `size=-1` / `size=Integer.MAX_VALUE`? Trace-answer:
  - `size=null` → `limit(null)` at line 292; jOOQ-Postgres translates to an absent LIMIT clause → returns ALL matching rows (potentially millions on a long-running deployment). NO defensive guard at the repository, controller, or service layer (verified: ActivityServiceImpl.java:86-117 passes `size` through unchanged; ActivityController per batch-A sidecar carries no `@Min`/`@Max`/`@NotNull` validation on the param).
  - `size=0` → `limit(0)` → empty Flux. Harmless; degenerate.
  - `size=-1` → `limit(-1)` → jOOQ may emit `LIMIT -1` which PostgreSQL accepts as 'unlimited' (per PG docs: `LIMIT ALL`-equivalent). Behaviour matches `size=null`. Untested.
  - `size=Integer.MAX_VALUE` → `LIMIT 2147483647` — Postgres clamps to actual row count; same as `size=null`. Untested.
  - Confidence: STATIC-INFERRED; no probe emitted (the BadUserRequestException check at ActivityServiceImpl.java:98-100 guards only beginDate/endDate, not size).

- **A2** — `beginDate` / `endDate` parameters (lines 74-75, 92-93, 110-111, 130-131). Question: what at null, equal, reversed (begin > end), far-future, epoch-zero? Trace-answer:
  - `beginDate=null` OR `endDate=null` → `ActivityServiceImpl.getActivityList` (line 98-100) returns `Flux.error(new BadUserRequestException("Begin date and end date can't be null"))` BEFORE this repository is called. Same guard for `getDataEntityActivityList` (line 128-130). **No guard for `getActivityCounts` (line 138-166)** — null dates would propagate to `mapUTCDateTime(null)` at this repo line 255-256, where `DateTimeUtil.mapUTCDateTime(null)` may NPE (sub-finding worth a separate probe).
  - `beginDate == endDate` → `createdAt >= X AND createdAt < X` → empty Flux. Degenerate but harmless.
  - `beginDate > endDate` (reversed) → empty Flux. No error raised; silent zero-result.
  - `endDate` far-future (year 2100) → expands the scan window; Postgres partition pruning still works if year-2100 partitions don't exist (no rows to scan). Harmless.
  - `beginDate` epoch-zero (1970-01-01) → expands the scan window backward beyond all partitions; trivially zero rows. Harmless.
  - Confidence: STATIC-INFERRED. Sub-finding (NPE on null dates in getActivityCounts path) is REFERENCE → ActivityServiceImpl sidecar (parallel batch).

- **A3** — `lastEventId` / `lastEventDateTime` cursor parameters (lines 83-84, 101-102, 119-120, 135-136). Question: what at null (only one set) / both set / both null / negative id / future dateTime? Trace-answer:
  - Both null → cursor predicate at line 284 SKIPS the comparison; full first-page query.
  - Only one set → cursor predicate at line 284 (`lastEventDateTime != null && lastEventId != null`) requires BOTH; if only one is set, the cursor is IGNORED → returns first page (same as both null). This is a SILENT BEHAVIOURAL DRIFT: a caller passing only `lastEventId` may EXPECT id-only cursor semantics; they get a first-page response with no error. Discoverable by callers via duplicate-row appearance on the next page.
  - Both null vs both unset: same behaviour (jOOQ/Java distinction immaterial).
  - `lastEventId < 0` → cursor predicate emits `(trunc_created_at, id) < (truncated, NEGATIVE_VALUE)` → since `id` is `bigserial` ≥ 1, every row matches the id comparison; falls through to time comparison; behaves as if `lastEventId = +∞` for the id axis. Returns rows with id < lastEventId limit which is all rows in the timestamp band. Likely no-op caller error.
  - `lastEventDateTime` in the far future → cursor predicate matches all rows in band; behaves like first-page.
  - Confidence: STATIC-INFERRED. The silent-drift on only-one-cursor-component is a corner-case worth noting; probe P-021 covers the cursor's high-write-rate behaviour but does NOT specifically pin the silent-drift.

- **A4** — `oddrns: List<String>` parameter for findDependentActivities (line 118) at empty list. Question: what at `oddrns=[]`? Trace-answer:
  - Line 124 unconditionally adds `DATA_ENTITY.ODDRN.in(oddrns)`. jOOQ rewrites `in(emptyList)` to `1=0` (FALSE predicate) → zero rows.
  - Asymmetric with the GUARDS in `getCommonConditions` (line 266-271 `CollectionUtils.isNotEmpty(tagIds)`, line 269-271 `CollectionUtils.isNotEmpty(ownerIds)`, line 272-275 `CollectionUtils.isNotEmpty(userIds)`) — for the `oddrns` parameter, NO guard; empty oddrns = zero rows (NOT skip-filter). This is the intended contract for lineage-scoped queries: an entity with no lineage produces no dependent activity.
  - Caller side: `ActivityServiceImpl.fetchDependentActivities` (line 213-216) gets oddrns from `dataEntityRelationsService.getDependentDataEntityOddrns(lineageStreamKind)` — which can return an empty list for entities with no lineage. The downstream Flux signals empty (no error).
  - Confidence: STATIC-INFERRED.

- **A5** — `userIds: List<Long>` / `tagIds: List<Long>` / `ownerIds: List<Long>` filter parameters (lines 80-81, 96-97, 116, 132, 150, 170, 191). Question: what at empty / null / single-element / huge-list? Trace-answer:
  - Empty (`List.of()`) → `CollectionUtils.isNotEmpty(...)` guard at lines 266, 269, 272 SKIPS the predicate → no filter applied (returns activity across ALL tags / owners / users).
  - Null → `CollectionUtils.isNotEmpty(null)` returns `false` → guard skips. Same as empty. Defensive.
  - Single-element → `IN (1234)` predicate → exact match.
  - Huge list (10k+ IDs) → `IN (...)` predicate with 10k arguments → Postgres has no hard limit on IN-list size but query parse + plan time grows; potential performance cliff at ~1k+. No defensive batching at this repo. Out-of-scope (the caller controls list size).
  - Confidence: STATIC-INFERRED.

- **A6** — `currentOwnerId: Long` for findMyActivities (line 100, 173). Question: what at null? Trace-answer:
  - Line 103 (`findMyActivities`) wraps in `List.of(currentOwnerId)` then passes through `buildBaseQuery` + `getCommonConditions`. If `currentOwnerId == null`, `List.of(null)` throws NPE (per `List.of` contract: rejects nulls).
  - Caller-side guard: `ActivityServiceImpl.fetchMyActivities` (line 194-196) sources `currentOwnerId` from `authIdentityProvider.fetchAssociatedOwner().flatMapMany(owner -> ... owner.getId() ...)` — `fetchAssociatedOwner()` MUST emit a non-empty Mono for the chain to reach this repo; if the current user has no associated owner, the Mono completes empty and the chain short-circuits (`switchIfEmpty(Flux.empty())` at line 198).
  - End-to-end posture: the null case never reaches this repository — the upstream guard converts "no owner" into "empty Flux" before calling.
  - Confidence: STATIC-INFERRED.

### Category B — Name-behavior pairs

- **B1 — `findAllActivities` name promises "all activities".** Trigger: method name (line 74). Question: does it return ALL activities? Trace-answer:
  - NO. The name is misleading. The method returns activities within `[beginDate, endDate)` (line 255-256) and matching the cursor predicate (line 287-288). "All" refers to the absence of owner-scoping (cross-owner read), not absence of date / cursor filters.
  - Confidence: STATIC-INFERRED. Severity: LOW (the operator-visible drift is small — UIs always pass beginDate/endDate, so "all" matches the user's intent within their chosen window).

- **B2 — `findMyActivities` name promises "my activities".** Trigger: method name (line 92) + `MY_OBJECTS` enum value at ActivityServiceImpl.java:108. Question: what does "my" mean — activity ON entities I own, or activity I PERFORMED? Trace-answer:
  - **"My" = activity on entities I own.** Line 103 threads `currentOwnerId` into `ownerIds` slot of `getCommonConditions`, which produces `OWNERSHIP.OWNER_ID.in([currentOwnerId])` (line 270). The actor side (USER_OWNER_MAPPING.OWNER_ID, line 273) is NOT auto-filtered by current user.
  - **Operator-visible drift**: a user with no ownership attachments but who has made platform changes (e.g. a fresh user who edited a description) sees NOTHING in the MY tab — their own work is invisible to themselves under "my" semantics.
  - **Workaround**: passing `userIds=[currentUserOwnerId]` separately would produce actor-axis filtering. The UI does not expose this explicit override.
  - Confidence: STATIC-INFERRED. Severity: MEDIUM (this is `bugs_limitations_corner_cases.[3]` — already surfaced). Stress Protocol confirms the drift via name-promise-vs-implementation analysis.

- **B3 — `findDependentActivities` name promises "dependent activities".** Trigger: method name (line 110). Question: dependent on what — owner / data entity / lineage parent? Trace-answer:
  - **Dependent = lineage-related.** Line 124 adds `DATA_ENTITY.ODDRN.in(oddrns)`. The oddrns come from `DataEntityRelationsService.getDependentDataEntityOddrns(LineageStreamKind)` (ActivityServiceImpl.java:212) where `LineageStreamKind` is `DOWNSTREAM | UPSTREAM`. So "dependent" = "anywhere in the lineage tree, in the direction specified by the caller's `type` param".
  - **Subtlety**: the lineage walk is bounded by `DataEntityRelationsService.getDependentDataEntityOddrns` (out-of-scope of this sidecar; reference to that service's sidecar). An infinite-loop in the lineage graph would manifest as huge oddrns list → IN-clause performance cliff (see A5).
  - Confidence: STATIC-INFERRED. Severity: LOW (the lineage walk is a known mechanism).

- **B4 — `findDataEntityActivities` name promises "activities of a specific data entity".** Trigger: method name (line 129). Question: does it return activities of the entity AND its dataset-field children? Trace-answer:
  - **NO. Only the entity itself.** Line 140 adds `DATA_ENTITY.ID.eq(dataEntityId)` — exact match on a single ID. There is no JOIN to `dataset_field` or recursive expansion through child entities.
  - **Operator-visible drift**: viewing the Activity tab of a Dataset entity does NOT show edits to its columns' descriptions or tags. Those edits emit `DATASET_FIELD_*_UPDATED` activity events with their OWN data_entity_id (the column's parent dataset entity? — verify; out-of-scope of this sidecar).
  - REFERENCE → ActivityIngestionRequestProcessor sidecar (or DatasetFieldActivityHandlerImpl, wherever DATASET_FIELD_* events bind their `data_entity_id`).
  - Confidence: STATIC-INFERRED at the repository layer; the downstream question (which data_entity_id does a DATASET_FIELD event bind to?) is REFERENCE.

- **B5 — `getTotalActivitiesCount` / `getMyObjectsActivitiesCount` / `getDependentActivitiesCount` name promises "count".** Trigger: method names (lines 145, 166, 187). Question: COUNT(*) or COUNT(DISTINCT)? Trace-answer:
  - `DSL.selectCount()` at lines 153, 174, 195 → SQL `SELECT COUNT(*)` → counts ROWS, not distinct activity events.
  - **Consequence of B5 + no-DISTINCT-on-reads**: when callers issue a multi-tag/multi-owner filter, the count returned does NOT match the count of unique events the find* methods would return (see bugs_limitations_corner_cases.[7]). For tagIds=[a,b,c]+ownerIds=[1,2] with a single activity row whose data_entity has 3 tags and 2 owners, the count returns 6 but the find* would return 6 duplicate rows representing 1 unique event.
  - Confidence: STATIC-INFERRED. Severity: MEDIUM (UI-visible: the count badge mismatches the visible result-set length).

- **B6 — `saveReturning` name promises "save and return the saved row".** Trigger: method name (line 50). Question: what does it return on conflict / failure? Trace-answer:
  - `DSL.insertInto(ACTIVITY).set(record).returning()` at line 52-53 → no `ON CONFLICT` clause. There is NO unique index on `activity` that this INSERT could conflict against (V0_0_48__add_activity.sql:1-17 shows only the PRIMARY KEY on `(id, created_at)` which is auto-assigned via `bigserial` + `NOW()`).
  - On failure (e.g. partition-coverage gap, FK violation on data_entity_id, schema mismatch) → JooqReactiveOperations.mono propagates the error via `onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` (JooqReactiveOperations.java:41). The Mono signals error; the row is NOT persisted.
  - Confidence: STATIC-INFERRED. Severity: LOW (matches name promise).

- **B7 — `save` (the batch method, line 57) name promises "save these rows".** Trigger: method name + List parameter. Question: atomicity? does failure on row N rollback rows 1..N-1? Trace-answer:
  - **NO atomicity.** `executeInPartition` chunks at 1000 rows; each chunk is its own INSERT statement; chunks are reduced with `.zipWith(Integer::sum)` which does NOT wrap them in a transaction. Mid-batch failure leaves earlier chunks committed.
  - This is `bugs_limitations_corner_cases.[5]` already. Stress Protocol surfaces it via name-promise: "save" connotes "all-or-nothing"; the implementation is "best-effort batched insert".
  - The repository is NOT `@Transactional` (no annotation on this method; verified by grep on the file).
  - Confidence: STATIC-INFERRED. Severity: MEDIUM (already surfaced).

### Category C — Orderings / pagination / aggregation

- **C1 — `orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())` at line 291.** Trigger: ORDER BY clause. Question: is this the lowest-layer ORDER BY (no inner re-sort)? what is the tiebreaker shape? does any layer above re-sort? Trace-answer:
  - **This IS the lowest-layer ORDER BY.** The query is a flat `DSL.select(...).from(ACTIVITY).join(...).leftJoin(...).where(...).orderBy(...).limit(...)`. There is NO inner subquery, NO CTE, NO paginate-helper invocation. `grep paginate` against this file (verified) returns ZERO matches.
  - **Tiebreaker**: `ACTIVITY.ID.desc()` after `ACTIVITY.CREATED_AT.desc()`. `id` is `bigserial` (V0_0_48__add_activity.sql:3) — strictly increasing per insertion order. Two rows with identical `created_at` are deterministically ordered by id desc.
  - **No re-sort above**: ActivityServiceImpl.java maps the Flux via `activityMapper::mapToActivity` (line 181, 197, 215) — no `.sort(...)` call. ActivityController returns the Flux directly (per batch-A sidecar). The order surfaces to the JSON response in the SQL-emitted order.
  - **CRITICAL**: this repository does NOT use `JooqQueryHelper.paginate(...)` — the LSN-019 paginate-inside-CTE drift is NOT applicable here. Verified by:
    1. grep `paginate` in this file: 0 matches.
    2. grep `Paginated|PageInfo|paginate` in this file: 0 matches.
    3. The query at line 290-292 is a direct `where + orderBy + limit` chain — no CTE wrapping.
  - Confidence: STATIC-INFERRED. The activity feed's deterministic newest-first ordering IS what the code does. Severity: N/A — this is the correctness case.

- **C2 — Symmetric truncate-to-second cursor with full-precision ORDER BY** (lines 285-291). Trigger: asymmetry between row-comparator precision and ORDER BY precision. Question: under high write rate (multiple rows per second), does the cursor visit every row exactly once (no skip / no duplicate / no out-of-order)?
  - **Static analysis**:
    1. ORDER BY at line 291 sorts at MICROSECOND precision (the `created_at` column is `timestamp without time zone` — PG's microsecond default).
    2. Cursor predicate at line 287-288 compares at SECOND precision on BOTH sides: `row(trunc(created_at, SECOND), id) < (truncated_last_event_dt, last_event_id)`.
    3. **No row skip** (forward correctness): all rows with `trunc(created_at, SECOND) < truncated_last_event_dt` are unambiguously returned; all rows in the same second-bucket as `last_event_dt` with `id < last_event_id` are returned. No row is excluded.
    4. **Possible duplicate**: a row whose `trunc(created_at, SECOND) == truncated_last_event_dt` AND `id == last_event_id` is the cursor anchor row itself; the `lessThan` operator excludes it correctly. No duplicate from this mechanism.
    5. **Possible out-of-order within a second**: ORDER BY treats `created_at` at microsecond precision; the cursor predicate cannot disambiguate two rows within the same second-bucket EXCEPT by id. So:
       - Page 1: rows ordered by `(created_at DESC microsecond, id DESC)` within each second-bucket.
       - Cursor passes back: `(truncated_last_event_dt, last_event_id)` = the LAST row of page 1.
       - Page 2: filter `row(trunc(created_at, SEC), id) < (T, L)`. Within the same second-bucket as page 1's last row, this filter includes rows with `id < L`. Their ORDER on page 2 is again by `(microsecond DESC, id DESC)`. **Question**: can a row from page 1's same-second-bucket whose `id > L` (so excluded from page 2) appear out-of-order relative to a page-2 row whose `id < L`?
         - Page 1 (within bucket S): rows sorted by microsecond DESC. The last row of page 1 has SOME microsecond μ_L and id L.
         - Page 2 includes rows in bucket S with `id < L`. These rows have various microseconds, potentially > μ_L or < μ_L.
         - **If** there's a row in bucket S with `id < L` AND `microsecond > μ_L`: it should appear BEFORE μ_L's row in pure ORDER BY, but page 1's cursor cut at id=L excluded it (because id < L) → it appears on page 2. The CLIENT sees: page 1 ending at (μ_L, L) followed by page 2 starting at (μ_X > μ_L, ...). **Visual out-of-order**: page 2 surfaces rows that should temporally precede page 1's cursor anchor.
         - **Net**: within a second-bucket, page-boundary ordering is preserved for the COMPLETE bucket only if the bucket fits entirely within one page. When the bucket SPLITS across pages, the split is by id desc — but the next page may re-surface rows with later microseconds that were technically "behind" page 1's cursor in microsecond terms.
       - Confidence in this trace: MEDIUM (the logic is provably correct end-to-end at id-precision; the visual ordering depends on whether the operator considers microsecond-ordering or id-ordering authoritative for the same-second case).
  - **Probe P-021 emitted** to PIN the empirical behaviour under high write rate.
  - Confidence: STATIC-INFERRED → PROBE-NEEDED for the visual-order claim. The "no row skip" half is STATIC-VERIFIED.

- **C3 — `getActivityCount` aggregation shape (line 297-302).** Trigger: COUNT(*) over a multi-LEFT-JOIN result. Question: COUNT(*) vs COUNT(DISTINCT)? join-cardinality multiplier? Trace-answer:
  - `DSL.selectCount()` translates to SQL `SELECT count(*) FROM activity JOIN data_entity ... LEFT JOIN user_owner_mapping ... LEFT JOIN owner ... [conditional joins] WHERE ...` — COUNT all rows from the join cardinality, NOT DISTINCT activity rows.
  - **Drift**: when conditional LEFT JOINs are present (TAG_TO_DATA_ENTITY when tagIds is set; OWNERSHIP when ownerIds is set), the count is INFLATED by the per-tag and per-owner multiplicity. A single activity row whose data_entity has 3 tags + 2 owners with `tagIds=[a,b,c]+ownerIds=[1,2]` counts as 6.
  - **B5 confirmation**: the COUNT and the FIND methods are CONSISTENT with each other (both inflated) but neither matches "distinct activity event count". UI-visible mismatch is between "filtered count" and "unfiltered count" expectations.
  - **No GROUP BY**: `selectCount()` produces a single row (the COUNT scalar); no GROUP BY needed at this layer.
  - Confidence: STATIC-INFERRED. Severity: MEDIUM (already in `known_performance_gaps.[1]` and `bugs_limitations_corner_cases.[7]`).

- **C4 — `getActivityCounts` (the service method, not the repo) zips 4 count queries.** Trigger: ActivityServiceImpl.java:138-166 zips totalCount + myObjects + downstream + upstream. Question: relative ordering of the 4 queries' execution? Trace-answer: OUT-OF-SCOPE — REFERENCE to ActivityServiceImpl sidecar (parallel batch). The repo here only emits the individual count queries; the orchestration is upstream.
  - Confidence: REFERENCE.

- **C5 — `findActivities` returns Flux without backpressure-aware sizing.** Trigger: `Flux<ActivityDto>` at line 293. Question: if the caller is slow to consume, does the underlying R2DBC fetch buffer in-memory? Trace-answer: REFERENCE → JooqReactiveOperations.java:44-49 (`flux` impl uses `Flux.from(query)` which is R2DBC-managed backpressure). Out-of-scope of this sidecar's `understanding`; the relevant detail is that the SQL `LIMIT size` upper-bounds the result set, so backpressure-buffer pressure is bounded by `size`.

### Category D — Authorization gates (repository-layer interrogation)

- **D1 — auth_gates: []**. Question: are there any `@PreAuthorize`, `permissionService.hasPermission(...)`, owner-scoping filters in this file? Trace-answer: NONE.
  - End-to-end grep of the file (lines 1-310) returns zero authorization checks. The repository trusts its caller to have evaluated permissions upstream.
  - **Architectural posture**: repository = data plane; authorization = controller perimeter via `pathMatchers('/**').authenticated()` (per ActivityController sidecar batch A). Every authenticated user under LOGIN_FORM / OAUTH2 / LDAP can issue every read against this repository.
  - **Asymmetry from `findMyActivities`** (line 91-107): the only "filter" that's HARD-WIRED to current-user identity (via `currentOwnerId`) is the OBJECT-OWNERSHIP filter — NOT actor-axis (see B2 + bugs_limitations_corner_cases.[3]). The repository does not enforce "you can only see activity on entities you own"; it executes whatever the caller passes.
  - Evidence: ReactiveActivityRepositoryImpl.java:1-310 (no `@PreAuthorize`, no `permissionService`, no `OWNER.OWNER_ID == currentUser` predicate independent of caller-supplied params).
  - Confidence: STATIC-INFERRED.

- **D2 — Auth-mode behavioural divergence under each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S.** Question: what does this repository return for each auth mode? Trace-answer:
  - The repository's BEHAVIOUR is auth-mode-independent (it runs the same SQL regardless). The DATA it returns differs because:
    - DISABLED: anonymous mutations write `created_by = null` (see bugs_limitations_corner_cases.[2]); reads surface null-actor rows mixed with system-event rows.
    - LOGIN_FORM / OAUTH2 / LDAP: every authenticated mutation writes a username; reads surface attributed rows via the USER_OWNER_MAPPING JOIN (line 157-158/178-179/199-200/221-222).
    - S2S: ingestion path uses `IngestionRequestProcessor.process` which writes `is_system_event = true` with `created_by = null` (ActivityIngestionRequestProcessor.java:53); reads surface as system events.
  - **Provider-agnostic JOIN** (implicit_adrs.[3]) means LOGIN_FORM and LDAP usernames bleed (HIGH-severity in known_security_gaps.[0]).
  - Confidence: STATIC-INFERRED.

### Category E — Resource boundaries (concurrency / TX / locks / cache)

- **E1 — Partition DROP vs concurrent INSERT/SELECT lock collision.** Trigger: housekeeping `DROP TABLE <activity_partition>` (PartitionServiceImpl.java:120-127) vs this repo's `saveReturning` (line 50-54) / `save` (line 57-71) / `findActivities` (line 73-89, etc). Question: can the housekeeping DDL block a concurrent read or write? Trace-answer:
  - **YES, under the PostgreSQL lock model**:
    - `DROP TABLE` on a partition takes `ACCESS EXCLUSIVE` on that child table (PG documentation: lock-modes).
    - `INSERT INTO activity (...)` on the parent table routes to the child partition via PG's partition-routing logic; that routing takes `ROW EXCLUSIVE` on the parent and `ROW EXCLUSIVE` on the child.
    - `SELECT FROM activity WHERE created_at >= X` may scan multiple child partitions; each touched child needs `ACCESS SHARE`.
    - `ACCESS EXCLUSIVE` conflicts with `ROW EXCLUSIVE` AND `ACCESS SHARE` → the DROP blocks all concurrent INSERT/SELECT touching that partition.
  - **Practical impact bounded by**:
    - `ActivityEmptyPartitionsHousekeepingJob` only drops EMPTY partitions (PartitionServiceImpl.java:110 `isPartitionEmpty` check). Active partitions (which are the partitions concurrent operations touch) are NOT dropped.
    - But the empty-check at line 110 is `SELECT count(*) = 0` which can race: if a row is INSERTED between `isPartitionEmpty` check and the `DROP TABLE` execution, the DROP would fail (the FK-checking constraint or row-existence) — or worse, succeed and silently lose that row.
  - **HousekeepingJobManager coordinates via @SchedulerLock** (HousekeepingJobManager.java:26) — only one node runs housekeeping at a time. But the housekeeping cycle holds a single JDBC connection (line 32) and iterates jobs serially; a long DROP on a partition blocks the entire cycle.
  - Probe P-022 emitted to MEASURE the lock-collision behaviour empirically.
  - Confidence: STATIC-INFERRED for the lock-model claim; PROBE-NEEDED for the empirical race timing.

- **E2 — Save batch transaction boundary**. Trigger: `save(List<ActivityPojo>)` at line 57-71. Question: is the batch wrapped in a transaction? Trace-answer:
  - **NO**. The method body dispatches to `JooqReactiveOperations.executeInPartition` (line 62) which is NOT `@Transactional`. The `Mono<Void>` return type and the reactive chain do not carry transaction semantics by default — Spring R2DBC requires `@Transactional` annotation OR explicit `TransactionalOperator.transactional(...)` for a TX boundary.
  - **Verification**:
    - grep `@Transactional|TransactionalOperator|@ReactiveTransactional` in this repo's class body: 0 matches.
    - JooqReactiveOperations.java: lines 30-49 use `databaseClient.inConnection(c -> ...)` — opens a connection per query, no shared TX. Lines 51-67 chunk via `Mono.from(...)` per chunk — each chunk runs in its own connection-scope.
    - The actual TX boundary, if any, lives at the caller (ActivityServiceImpl) which itself is NOT `@Transactional` (verified grep on ActivityServiceImpl.java: 0 matches).
  - **Consequence**: a multi-chunk batch save can partially commit on chunk-N failure (bugs_limitations_corner_cases.[5] + known_security_gaps.[4]).
  - Confidence: STATIC-INFERRED.

- **E3 — Concurrent INSERTs producing duplicate rows?** Trigger: `saveReturning` (line 50-54) with no unique index. Question: are there ANY uniqueness constraints on activity rows? Can two callers both insert "the same" event? Trace-answer:
  - **NO uniqueness constraints** beyond the PRIMARY KEY `(id, created_at)` (V0_0_48__add_activity.sql:11). `id` is `bigserial` (auto-assigned per insert); the PK is degenerate (each row gets a unique id).
  - **NO unique index** on `(data_entity_id, event_type, created_by, created_at)` or any other deduplication tuple.
  - **Consequence**: if two parallel `@ActivityLog`-annotated service methods fire on the same data entity for the same event at near-identical times (e.g. two concurrent description-updates with the same content), TWO activity rows are persisted. There is NO deduplication.
  - **Idempotency posture**: NOT idempotent. The activity table is "at-least-once" capture; downstream consumers (read paths) see duplicate entries for genuinely-duplicate events.
  - **Practical impact**: most write paths are guarded upstream (service-layer optimistic locking, version-checking, etc.), so true concurrent writes of "the same event" are rare. But a retry-on-failure pattern at the service layer (e.g. retry on transient DB error) could double-insert.
  - Confidence: STATIC-INFERRED.

- **E4 — Partition rotation race**: an INSERT at NOW() crossing the partition boundary between partition N and N+1. Trigger: `saveReturning` / `save` with `created_at = NOW()` near midnight. Question: race between INSERT and partition-creation cron? Trace-answer:
  - REFERENCE → ActivityTablePartitionManager sidecar batch K bugs_limitations_corner_cases[2] (the silent partition-coverage-gap finding). Not re-analysed here; out-of-scope of this repository file.
  - The mitigation (per ActivityTablePartitionManager implicit_adrs[0]) is the 2×period partition width — partition N covers [N×30days, (N+2)×30days], so a missed cron iteration is recovered on the next iteration. Detailed analysis lives in batch K.
  - Confidence: REFERENCE.

- **E5 — Caching at the repository layer?** Trigger: caching annotations (`@Cacheable`, `@CachePut`, `@CacheEvict`). Question: is any read cached? Trace-answer:
  - grep `@Cacheable|@CachePut|@CacheEvict|@CacheConfig` in this file: 0 matches. NO repository-layer caching.
  - REFERENCE → upstream: search the service layer for any caching wrapping `ReactiveActivityRepository` calls. (ActivityServiceImpl.java: grep `@Cacheable` returns 0; no service-layer cache.)
  - **Posture**: every read hits Postgres. No staleness window concerns; backpressure is the only flow control.
  - Confidence: STATIC-INFERRED.

- **E6 — Connection-pool exhaustion under high write rate**. Trigger: per-mutation single-row INSERT (saveReturning, line 50-54). Question: under 100k mutations/sec, does the R2DBC connection pool saturate? Trace-answer:
  - REFERENCE → R2DBC pool configuration (out-of-scope of this sidecar; lives in Spring R2DBC config + JooqReactiveOperations.java:28 `DatabaseClient databaseClient`).
  - Per-mutation cost: 1 connection-acquire + 1 INSERT round-trip + 1 connection-release. Pool size N → throughput ceiling ~N × (1/round-trip-latency). Default Spring R2DBC pool size is 10 (out-of-scope verification).
  - Confidence: REFERENCE.

## upstream_callers

- `ActivityServiceImpl` (`odd-platform-api/src/main/java/.../service/activity/ActivityServiceImpl.java`) — the EXCLUSIVE consumer of this repository (the only `ReactiveActivityRepository` injection in the codebase; grep verified). Calls every public method:
  - `saveReturning(pojo)` at ActivityServiceImpl.java:50 (called from `createActivityEvent`)
  - `save(List)` at ActivityServiceImpl.java:62 (called from `createActivityEvents`)
  - `findAllActivities` at ActivityServiceImpl.java:179 (in `fetchAllActivities`)
  - `findMyActivities` at ActivityServiceImpl.java:195 (in `fetchMyActivities`)
  - `findDependentActivities` at ActivityServiceImpl.java:213 (in `fetchDependentActivities`)
  - `findDataEntityActivities` at ActivityServiceImpl.java:133 (in `getDataEntityActivityList`)
  - `getTotalActivitiesCount` at ActivityServiceImpl.java:227
  - `getMyObjectsActivitiesCount` at ActivityServiceImpl.java:241
  - `getDependentActivitiesCount` at ActivityServiceImpl.java:255

## downstream_side_effects

- **DB writes to `activity` table**: `saveReturning` (line 50-54, single-row INSERT RETURNING) and `save` (line 57-71, batched INSERT in 1000-row chunks; no transaction wrap).
- **DB reads from `activity`** (joined with `data_entity`, `user_owner_mapping`, `owner`, and conditionally `data_source`, `namespace`, `tag_to_data_entity`, `ownership`): 7 read methods producing flat `Flux<ActivityDto>` or `Mono<Long>` shapes.
- **No DELETE on activity**: grep `deleteFrom(ACTIVITY)|delete\(ACTIVITY` in this file returns ZERO matches. The activity row is append-only at this layer; deletion happens only via the housekeeping `DROP TABLE` DDL (PartitionServiceImpl.java:120-127), which removes EMPTY past partitions only.
- **No UPDATE on activity**: grep `update(ACTIVITY)` returns ZERO matches. The schema has no `updated_at` column; rows are immutable.
- **Transaction boundaries**: NONE within this class. The repository runs every method in the caller's TX scope (which, for ActivityServiceImpl, is also no-TX — verified above in stress_findings.E2).
- **Lock acquisition**: NONE. No `SELECT … FOR UPDATE`, no advisory locks, no explicit row-locking. The only LOCK-MODEL interaction is the implicit ACCESS SHARE / ROW EXCLUSIVE taken by every SELECT / INSERT against the parent + child partitions — which can be blocked by housekeeping's ACCESS EXCLUSIVE on DROP (stress_findings.E1).
- **No external I/O**: pure jOOQ / R2DBC / Postgres. No HTTP, S3, SMTP, Slack, OTLP, Kafka, message-queue, file-system. No observability emit beyond Spring's standard reactive logging.
- **Search-index side effects**: NONE.
- **Cache side effects**: NONE (verified stress_findings.E5).

## sources

- understanding ← ReactiveActivityRepositoryImpl.java:43-310 + ReactiveActivityRepository.java:11-87 + ActivityServiceImpl.java:36-273 + V0_0_48__add_activity.sql:1-17
- concepts.entities ← ReactiveActivityRepositoryImpl.java:19-41 + ActivityPojo (jOOQ-generated POJO referenced at line 21) + ActivityRecord (jOOQ-generated record referenced at line 24) + ActivityEventTypeDto.java:1-31
- concepts.invariants.[0] ← V0_0_48__add_activity.sql:4 (`data_entity_id bigint NOT NULL`) + V0_0_48__add_activity.sql:12 (FK constraint) + ReactiveActivityRepositoryImpl.java:155, 176, 197, 219 (INNER JOIN to DATA_ENTITY in every read path)
- concepts.invariants.[1] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 (four occurrences of the provider-agnostic LEFT JOIN)
- concepts.invariants.[2] ← ReactiveActivityRepositoryImpl.java:285-288 (symmetric truncate-to-second cursor) + line 290-291 (full-precision ORDER BY) + stress_findings.C2 + probe P-021
- concepts.invariants.[3] ← ReactiveActivityRepositoryImpl.java:290-292 (where + orderBy + limit shape) + stress_findings.C1 (no paginate)
- concepts.invariants.[4] ← ReactiveActivityRepositoryImpl.java:91-107 (findMyActivities) + line 270 (OWNERSHIP.OWNER_ID predicate) + line 273 (USER_OWNER_MAPPING.OWNER_ID predicate)
- concepts.invariants.[5] ← V0_0_48__add_activity.sql:1-13 (schema) + ActivityServiceImpl.java:46-52 (`getCurrentUser` + null fallback at line 49)
- dependencies_semantic.requires-feature.[0] ← ReactiveActivityRepositoryImpl.java:46-47, 51, 59, 62-69 + JooqReactiveOperations.java:23-67
- dependencies_semantic.requires-feature.[1] ← ReactiveActivityRepositoryImpl.java:47, 305-308 + JooqRecordHelper.java:37-43
- dependencies_semantic.requires-feature.[2] ← ReactiveActivityRepository.java:11-87 + ActivityServiceImpl.java:37 (the sole consumer)
- dependencies_semantic.requires-feature.[3] ← ReactiveActivityRepositoryImpl.java:34-41 (the static jOOQ Tables imports)
- dependencies_semantic.requires-config ← application.yml:213 (partition-period: 30) + ActivityTablePartitionManager.java:11 + the indirect partition-coverage dependency surfaced at line 50-54 (saveReturning) + ActivityTablePartitionManager sidecar batch K bugs_limitations_corner_cases.[2] + HousekeepingJobManager.java:18 (`housekeeping.enabled`)
- dependencies_semantic.requires-runtime ← V0_0_48__add_activity.sql:13 (PARTITION BY RANGE) + ReactiveActivityRepositoryImpl.java:29-30 (Mono/Flux imports) + JooqReactiveOperations.java:16 (R2DBC DatabaseClient)
- dependencies_semantic.coupling ← ActivityServiceImpl.java:50, 62 + ActivityAspect.java:81-95 + ActivityIngestionRequestProcessor.java:51-55 + AlertServiceImpl.java:252,258,318,324 + ActivityEmptyPartitionsHousekeepingJob.java:9-17 + ActivityTablePartitionManager.java:9-21 + ActivityMapper (referenced at ActivityServiceImpl.java:181,197,215) + PartitionServiceImpl.java:120-127 (DROP DDL)
- tests_coverage_semantic.gaps ← grep for `ReactiveActivityRepositoryImpl|ReactiveActivityRepository` in `<odd-platform>/odd-platform-api/src/test` (zero matches verified) + LSN-019 Stress Protocol re-prioritisation
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20)
- docs_link_semantic.inferred_docs.[1] ← cross-reference to ActivityTablePartitionManager sidecar batch K (live-verified 2026-05-10)
- docs_link_semantic.inferred_docs.[2] ← cross-reference to ActivityController.getActivity sidecar batch A (live-verified 2026-05-10 — 404)
- docs_link_semantic.doc_drift_findings.[0] ← ActivityEventTypeDto.java:3-31 (27 values) + WebFetch activity-feed Event Types section (20 values enumerated)
- docs_link_semantic.doc_drift_findings.[1] ← V0_0_48__add_activity.sql:4,12 + F-006 drift_class + WebFetch activity-feed (no audit-coverage statement)
- docs_link_semantic.doc_drift_findings.[2] ← ReactiveActivityRepositoryImpl.java:73-89 (no current-user predicate) + WebFetch activity-feed Filters section + ActivityController.getActivity sidecar batch A
- docs_link_semantic.doc_drift_findings.[3] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 + the absence of `deleteFrom(ACTIVITY)` in this repo + WebFetch activity-feed Configuration section
- docs_link_semantic.doc_drift_findings.[4] ← PartitionServiceImpl.java:120-127 + HousekeepingJobManager.java:25-39 + stress_findings.E1 + probe P-022
- implicit_adrs.[0] ← V0_0_48__add_activity.sql:4, 12 + ReactiveActivityRepositoryImpl.java:155, 176, 197, 219
- implicit_adrs.[1] ← ReactiveActivityRepositoryImpl.java:285-288, 290-291 + stress_findings.C2
- implicit_adrs.[2] ← ReactiveActivityRepositoryImpl.java:62-70 + JooqReactiveOperations.java:24, 51-67
- implicit_adrs.[3] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 + ReactiveUserOwnerMappingRepositoryImpl sidecar batch N invariants[2]
- implicit_adrs.[4] ← ReactiveActivityRepositoryImpl.java:45 (`implements ReactiveActivityRepository` — no `extends`) + ReactiveActivityRepository.java:11-87 (no delete/update methods) + V0_0_48__add_activity.sql:1-13 (no updated_at/deleted_at columns)
- bugs_limitations_corner_cases.[0] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 + grep for `deleteFrom(ACTIVITY)` in this repo (zero matches) + WebFetch activity-feed#configuration
- bugs_limitations_corner_cases.[1] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 + ActivityServiceImpl.java:47-49 + V0_0_48__add_activity.sql:10
- bugs_limitations_corner_cases.[2] ← V0_0_48__add_activity.sql:10 + ActivityServiceImpl.java:47-49 + ActivityIngestionRequestProcessor.java:53 + AlertServiceImpl.java:252,318
- bugs_limitations_corner_cases.[3] ← ReactiveActivityRepositoryImpl.java:91-107, 264-275 + ActivityServiceImpl.java:184-199 + WebFetch activity-feed Filters
- bugs_limitations_corner_cases.[4] ← ReactiveActivityRepositoryImpl.java:285-288, 290-291 + stress_findings.C2 + probe P-021 (CORRECTED from v0.2 severity)
- bugs_limitations_corner_cases.[5] ← ReactiveActivityRepositoryImpl.java:62-70 + JooqReactiveOperations.java:51-67 + AlertServiceImpl.java:252-258, 318-324 + stress_findings.E2
- bugs_limitations_corner_cases.[6] ← V0_0_48__add_activity.sql:12 + ReactiveActivityRepositoryImpl.java:219 + F-010 sidecar (DataEntityHousekeepingJob cascade-delete)
- bugs_limitations_corner_cases.[7] ← ReactiveActivityRepositoryImpl.java:208-225, 237-242, 290-292
- bugs_limitations_corner_cases.[8] ← PartitionServiceImpl.java:120-127 + HousekeepingJobManager.java:25-39 + stress_findings.E1 + probe P-022
- security.auth_mode_relevance ← ReactiveActivityRepositoryImpl.java:43 (@Repository) + V0_0_48__add_activity.sql:10 + ActivityServiceImpl.java:47-49 + lines 157-158/178-179/199-200/221-222
- security.ingestion_filter_relevance ← ActivityIngestionRequestProcessor.java:51-55 (the FINALIZING-phase write path that reaches this repo)
- security.authorization_assertions ← this repo file 1-310 (no auth annotations on any method) + ActivityController.getActivity sidecar batch A + stress_findings.D1
- security.owner_scoping ← ReactiveActivityRepositoryImpl.java:73-89, 91-107, 109-126, 264-275 + concept references in sidecar batch I + stress_findings.B2
- security.data_exposure.[0] ← V0_0_48__add_activity.sql:6-7 + ReactiveActivityRepositoryImpl.java:290-291 + DescriptionActivityStateDto.java:3
- security.data_exposure.[1] ← ReactiveActivityRepositoryImpl.java:157-158, 273
- security.data_exposure.[2] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 + ActivityServiceImpl.java:47-49 + concept `provider-null-cross-mode-bleed`
- security.known_security_gaps.[0] ← lines 157-158/178-179/199-200/221-222 + ActivityServiceImpl.java:47-49 + V0_0_48__add_activity.sql:10
- security.known_security_gaps.[1] ← ActivityServiceImpl.java:47-49 + V0_0_48__add_activity.sql:8 + DisabledAuthSecurityConfiguration.java:16
- security.known_security_gaps.[2] ← V0_0_48__add_activity.sql:4, 12 + ReactiveActivityRepositoryImpl.java:219 + F-006 drift_class
- security.known_security_gaps.[3] ← V0_0_48__add_activity.sql:6-7 + ReactiveActivityRepositoryImpl.java:290-291
- security.known_security_gaps.[4] ← ReactiveActivityRepositoryImpl.java:62-70 + JooqReactiveOperations.java:51-67 + AlertServiceImpl.java:252-258, 318-324 + stress_findings.E2
- performance.hot_paths.[0] ← ReactiveActivityRepositoryImpl.java:57-71 + JooqReactiveOperations.java:51-67 + ActivityIngestionRequestProcessor.java:44-56
- performance.hot_paths.[1] ← ReactiveActivityRepositoryImpl.java:73-89, 208-225, 290-292 + V0_0_48__add_activity.sql:15
- performance.hot_paths.[2] ← ReactiveActivityRepositoryImpl.java:285-288 + V0_0_48__add_activity.sql:15-17
- performance.throughput_characteristics ← ReactiveActivityRepositoryImpl.java:29-30 (reactive imports) + line 57-71 (batched INSERT) + line 50-54 (single-row INSERT)
- performance.resource_allocation ← ReactiveActivityRepositoryImpl.java:50-54, 57-71, 73-89, 109-126 + ActivityIngestionRequestProcessor.java:44-56
- performance.scaling_characteristics ← ReactiveActivityRepositoryImpl.java:43 (stateless) + ActivityEmptyPartitionsHousekeepingJob.java:1-18 (housekeeping coupling) + PartitionServiceImpl.java:120-127 (DROP DDL) + stress_findings.C2 + stress_findings.E1
- performance.known_performance_gaps.[0] ← this repo file 1-310 + ActivityEmptyPartitionsHousekeepingJob.java:9-17
- performance.known_performance_gaps.[1] ← ReactiveActivityRepositoryImpl.java:208-225, 237-242, 290-292 + stress_findings.C3
- performance.known_performance_gaps.[2] ← ReactiveActivityRepositoryImpl.java:287-288 + V0_0_48__add_activity.sql:15
- performance.known_performance_gaps.[3] ← ReactiveActivityRepositoryImpl.java:50-54 + ActivityServiceImpl.java:43-52 + grep for @ActivityLog annotations
- performance.known_performance_gaps.[4] ← ReactiveActivityRepositoryImpl.java:50-54, 57-71 + ActivityTablePartitionManager sidecar batch K bugs_limitations_corner_cases.[2]
- performance.known_performance_gaps.[5] ← PartitionServiceImpl.java:120-127 + HousekeepingJobManager.java:25 + stress_findings.E1
- stress_findings.A1 ← ReactiveActivityRepositoryImpl.java:76, 94, 112, 131, 292 + ActivityServiceImpl.java:86-117
- stress_findings.A2 ← ReactiveActivityRepositoryImpl.java:74-75, 92-93, 110-111, 130-131, 255-256 + ActivityServiceImpl.java:98-100, 128-130, 138-166
- stress_findings.A3 ← ReactiveActivityRepositoryImpl.java:83-84, 101-102, 119-120, 135-136, 284-289
- stress_findings.A4 ← ReactiveActivityRepositoryImpl.java:118, 124, 204 + jOOQ in-clause behaviour
- stress_findings.A5 ← ReactiveActivityRepositoryImpl.java:80-81, 96-97, 116, 132, 150, 170, 191, 266-275
- stress_findings.A6 ← ReactiveActivityRepositoryImpl.java:100, 103, 173 + ActivityServiceImpl.java:194-198
- stress_findings.B1 ← ReactiveActivityRepositoryImpl.java:73-89 + line 255-256 (date filter) + line 287-288 (cursor filter)
- stress_findings.B2 ← ReactiveActivityRepositoryImpl.java:91-107, 270, 273 + ActivityServiceImpl.java:108
- stress_findings.B3 ← ReactiveActivityRepositoryImpl.java:109-126, 124 + ActivityServiceImpl.java:212, 213-216
- stress_findings.B4 ← ReactiveActivityRepositoryImpl.java:128-142, 140
- stress_findings.B5 ← ReactiveActivityRepositoryImpl.java:145-163, 165-184, 186-206, 153, 174, 195
- stress_findings.B6 ← ReactiveActivityRepositoryImpl.java:50-54 + JooqReactiveOperations.java:37-49 + V0_0_48__add_activity.sql:1-17 (no unique indexes)
- stress_findings.B7 ← ReactiveActivityRepositoryImpl.java:57-71 + JooqReactiveOperations.java:51-67 + grep for `@Transactional` (0 matches)
- stress_findings.C1 ← ReactiveActivityRepositoryImpl.java:291 + grep for `paginate` in this file (0 matches) + ActivityServiceImpl.java:181, 197, 215 (no sort)
- stress_findings.C2 ← ReactiveActivityRepositoryImpl.java:285-291 + probe P-021 + V0_0_48__add_activity.sql:9 (timestamp microsecond precision)
- stress_findings.C3 ← ReactiveActivityRepositoryImpl.java:153, 174, 195, 297-302
- stress_findings.C4 ← REFERENCE → ActivityServiceImpl sidecar (parallel)
- stress_findings.C5 ← REFERENCE → JooqReactiveOperations.java:44-49 (Flux.from R2DBC backpressure)
- stress_findings.D1 ← ReactiveActivityRepositoryImpl.java:1-310 (grep for @PreAuthorize / permissionService = 0 matches) + ActivityController sidecar batch A
- stress_findings.D2 ← bugs_limitations_corner_cases.[1, 2] + ActivityServiceImpl.java:47-49 + ActivityIngestionRequestProcessor.java:53
- stress_findings.E1 ← PartitionServiceImpl.java:120-127 + HousekeepingJobManager.java:25-39 + probe P-022 + PostgreSQL lock-mode documentation
- stress_findings.E2 ← ReactiveActivityRepositoryImpl.java:57-71 + JooqReactiveOperations.java:30-67 + grep for @Transactional (0 matches)
- stress_findings.E3 ← V0_0_48__add_activity.sql:11 (PK only) + grep for unique indexes on activity (0 matches)
- stress_findings.E4 ← REFERENCE → ActivityTablePartitionManager sidecar batch K bugs_limitations_corner_cases[2]
- stress_findings.E5 ← grep `@Cacheable|@CachePut|@CacheEvict` in this file + ActivityServiceImpl.java (0 matches)
- stress_findings.E6 ← REFERENCE → R2DBC pool configuration

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM
- stress_findings: HIGH (Stress Protocol Rule 9 — every detected trigger answered; 2 probes emitted (P-021 cursor-order-stability + P-022 partition-DROP-empty-only-contract); C2 corrects a v0.2 severity claim with a sharper static-inferred analysis)

## Maintainer notes

## CTRIB-010 / odd-platform#1657 update (2026-06-13) — v2 fix shipped on contrib/CTRIB-010-activity-actor-filter

The activity "User" filter is no longer a single owner-mediated axis. \`getCommonConditions\` now applies
BOTH: the kept \`userIds\` -> \`USER_OWNER_MAPPING.OWNER_ID.in(userIds)\` (the actor's CURRENT owner,
un-deprecated, intentional) AND the NEW \`usernames\` -> \`ACTIVITY.CREATED_BY.in(usernames)\` (the
immutable external identity; selects unmapped actors; invariant under association churn). New method
\`getActivityUsers(page,size,query)\` returns a paginated DISTINCT \`created_by\` (current-owner enriched)
\`Page<AssociatedOwnerDto>\` feeding the new \`GET /api/activity/users\`. The LSN-020/H-001 finding is thus
addressed by making the actor axes explicit rather than removing the owner axis. Behavioural lock:
\`ReactiveActivityRepositoryActorFilterTest\`; e2e IT-129. (Sidecar prose above predates the fix; a full
/enrich regeneration is a tracked follow-up.)
