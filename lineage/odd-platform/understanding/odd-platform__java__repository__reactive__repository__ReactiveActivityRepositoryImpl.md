---
node_id: "odd-platform java repository reactive repository:ReactiveActivityRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-R01
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
  - kind: conflicts_surfaced
    target: none
    note: |
      Pre-emit coherence sweep ran against feature-flows/F-006 + F-007 + F-010, concepts/index.yaml
      (audit-log-presence-asymmetry-* + activity-table-partitioning + provider-null-cross-mode-bleed),
      and the two prior Activity sidecars (ActivityController.getActivity + ActivityTablePartitionManager).
      ZERO contradictions surfaced; this sidecar STRENGTHENS the three features and the cross-mode-bleed
      concept rather than supersedes any prior claim.
---

# ReactiveActivityRepositoryImpl — semantic understanding

## understanding

`ReactiveActivityRepositoryImpl` is the jOOQ-backed reactive repository for the `public.activity` audit table — the platform's append-only forensic substrate. It exposes two write paths (`saveReturning` for single-row inserts via `ActivityServiceImpl.createActivityEvent`, and `save` for batched inserts via `ActivityServiceImpl.createActivityEvents`, partitioned in 1000-row chunks by `JooqReactiveOperations.executeInPartition`), plus seven read paths backing the UI Activity Feed and its three companion views (My-objects / Upstream / Downstream / Data-entity-detail). The read paths are NOT owner-scoped at the SQL layer — `findAllActivities`, `findDependentActivities`, and `findDataEntityActivities` issue cross-owner SELECTs and rely entirely on caller-side filter parameters (`ownerIds`, `userIds`, `tagIds`, lineage `oddrns`) for narrowing. The audit surface is **structurally constrained** to data-entity-scoped events: `activity.data_entity_id` is `NOT NULL` with a FK to `data_entity(id)` (V0_0_48__add_activity.sql:4,12), so RBAC mutations (Role / Policy / Owner CRUD) and Datasource registrations CANNOT be recorded here — the audit-silence-on-RBAC pattern observed across batches F/H/N (F-006) is rooted in this schema decision.

## concepts

- entities: [ActivityPojo, ActivityDto, ActivityEventTypeDto (27-value enum), ActivityRecord, public.activity (range-partitioned by created_at), Tables.ACTIVITY, USER_OWNER_MAPPING (LEFT JOIN for actor resolution), OWNER (LEFT JOIN for actor's catalog identity), DATA_ENTITY (INNER JOIN — every activity row has a FK to one), DATA_SOURCE / NAMESPACE / TAG_TO_DATA_ENTITY / OWNERSHIP (conditional LEFT JOINs for filter facets)]
- operations: [save-activity-pojo, save-activity-batch, find-activities-cross-owner, find-activities-my-owner-scoped, find-activities-dependent-lineage-scoped, find-activities-by-data-entity, count-activities-cross-owner, count-activities-my-owner-scoped, count-activities-dependent-lineage-scoped, cursor-paginate-by-created-at-id-tuple]
- invariants:
  - "Every activity row REQUIRES `data_entity_id` (NOT NULL FK). RBAC mutations, Owner CRUD, Datasource registrations, Collector token rotations, Role/Policy edits have NO data-entity context — they cannot emit to this table even if a future `@ActivityLog` annotation were added (V0_0_48__add_activity.sql:4,12)."
  - "Every read path LEFT JOINs `USER_OWNER_MAPPING ON OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL` to resolve the actor's catalog OwnerPojo. The join filters by `OIDC_USERNAME` only — NOT by `provider` — so a LOGIN_FORM-authenticated 'alice' and an LDAP-authenticated 'alice' resolve to the SAME row (a cross-mode bleed mechanism mirroring `provider-null-cross-mode-bleed` from ReactiveUserOwnerMappingRepositoryImpl batch N). Lines 157-158, 178-179, 199-200, 221-222."
  - "Cursor pagination uses a `(trunc(created_at, SECOND), id)` tuple-less-than comparison (`row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` — line 287-288). Truncating to SECOND on the cursor side but NOT on the column being ordered (`orderBy(ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc())` — line 291) introduces a possible ordering inversion within the same second."
  - "Default ordering is `created_at DESC, id DESC` (line 291) with a `limit(size)` (line 292) — newest-first paging without offset. Append-only audit data; no `OFFSET` is ever issued."
  - "`findMyActivities` accepts a `currentOwnerId` and threads it as `OWNERSHIP.OWNER_ID = currentOwnerId` (via `addJoins` + `getCommonConditions`) — but does NOT additionally filter `USER_OWNER_MAPPING.OWNER_ID = currentOwnerId` for the actor join. The 'my' in 'my activities' means 'activity on data entities I own', not 'activity I performed' — a discoverable axis-mismatch (ActivityServiceImpl.java:184-199 + this repo lines 91-107)."
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
- requires-runtime:
  - "PostgreSQL with declarative range-partitioning on `activity` (PARTITION BY RANGE (created_at) — V0_0_48__add_activity.sql:13)."
  - "Spring R2DBC + DatabaseClient (reactive driver underpinning JooqReactiveOperations)."
  - "Reactor Core (Mono / Flux signatures throughout)."
- coupling:
  - "**Write-path callers**: `ActivityServiceImpl.createActivityEvent` (saveReturning, line 50) and `createActivityEvents` (save, line 62). Those two methods are the WRITE FUNNEL — every activity row passes through them. They are called from: (a) `ActivityAspect.postActivity` (the `@ActivityLog`-annotated service methods — 18 methods enumerated across DataEntityServiceImpl, OwnershipServiceImpl, TermServiceImpl, DatasetFieldServiceImpl, DatasetFieldInternalInformationServiceImpl, EnumValueServiceImpl, DataEntityGroupServiceImpl, AlertHaltConfigServiceImpl, AlertServiceImpl, DataEntityInternalStateServiceImpl); (b) `ActivityIngestionRequestProcessor.process` (`DATA_ENTITY_CREATED` system events during ingestion FINALIZING phase, line 51-53); (c) `AlertServiceImpl.changeAlertStatus` + `AlertServiceImpl.resolveAutomatically` (OPEN/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED, lines 252,258,318,324)."
  - "**Read-path callers**: `ActivityServiceImpl.fetchAllActivities` (`findAllActivities`), `fetchMyActivities` (`findMyActivities`), `fetchDependentActivities` (`findDependentActivities`), `getDataEntityActivityList` (`findDataEntityActivities`), and the four count methods. Cursor `(lastEventId, lastEventDateTime)` originates at the HTTP layer (ActivityController) and threads through unchanged."
  - "**Housekeeping coupling**: `ActivityEmptyPartitionsHousekeepingJob` (extends EmptyPartitionsHousekeepingJob targeting `Tables.ACTIVITY.getName()`) drops EMPTY past partitions of this table on the 15-min housekeeping cycle. It does NOT drop non-empty partitions; the activity table grows monotonically until rows are app-level deleted (which never happens — there is no DELETE path against the activity table in this repository or any other)."
  - "**Partition lifecycle coupling**: `ActivityTablePartitionManager` (sidecar batch K) appends partitions at the `odd.activity.partition-period` cadence with `2 × period`-day width. INSERTs from this repository depend on partition coverage existing for `created_at = NOW()` at insert time."
  - "**ActivityMapper coupling**: results from `findAllActivities` / `findMyActivities` / `findDependentActivities` / `findDataEntityActivities` are mapped by `ActivityMapper::mapToActivity` at the service layer; this repo returns `Flux<ActivityDto>` containing the raw `(ActivityPojo, OwnerPojo, DataEntityPojo)` tuple (line 305-308). The mapper translates jsonb `old_state`/`new_state` into typed OpenAPI `ActivityState` based on `event_type`."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Happy-path INSERT: `saveReturning(pojo)` returns ActivityPojo with assigned `id` + `created_at` defaulted to NOW()."
  - "Happy-path batch INSERT: `save(List<ActivityPojo>)` of 999 / 1000 / 1001 rows — verifies the BATCH_SIZE=1000 partition boundary in `JooqReactiveOperations.executeInPartition` (line 62-70)."
  - "Partition-coverage failure: `saveReturning` issued when `created_at = NOW()` falls outside the latest existing activity partition — Postgres rejects with 'no partition of relation \"activity\" found for row'. Currently silent."
  - "Cursor-pagination edge: two activity rows with the same `created_at` truncated to second but different ids — `(trunc(created_at, SECOND), id) < (truncated, lastEventId)` (line 287-288) ordering versus `order by created_at DESC, id DESC` (line 291) — verifies no row is skipped or duplicated at second boundaries."
  - "USER_OWNER_MAPPING soft-delete: an activity row created by 'alice' before alice's user-owner mapping was soft-deleted — the LEFT JOIN filters `DELETED_AT IS NULL` (line 158/179/200/222), so the row appears as actor=null in the UI (visually indistinguishable from system events). No test confirms this is intentional."
  - "Cross-mode bleed: LOGIN_FORM 'alice' creates activity row at time T1; LDAP 'alice' (provider-null mapping override) authenticates at T2 and reads the Activity Feed — the LOGIN_FORM 'alice's activity rows resolve to LDAP 'alice's catalog OwnerPojo (and vice versa). No test pins the bleed; the only coverage is in ReactiveUserOwnerMappingRepositoryImpl batch N for the resolution side."
  - "Filter combinations: tagIds + ownerIds + userIds set semantics — `getCommonConditions` (line 246-277) adds `OR within facet, AND across facets`-ish predicates but does not document the join multiplicity (a data entity with multiple tags will produce duplicate activity rows in the SELECT). No DISTINCT clause."
  - "`type=DOWNSTREAM/UPSTREAM` produces oddrns set with 0 / 1 / many members — `DATA_ENTITY.ODDRN.in(oddrns)` with empty list (line 124, 204) — Postgres jOOQ behaviour for `IN ()` (which would normally raise a SQL parse error) versus `in(emptyList)` which jOOQ rewrites to `1=0`. Edge case worth pinning."
  - "Concurrent INSERT under partition rotation race: two writer threads each inserting at NOW() = boundary moment between partition N and partition N+1 — partition N+1 doesn't yet exist (partition creation cron has not yet run), but Postgres routing rule still references partition N's range. Verifies the 2× overlap design from ActivityTablePartitionManager sidecar implicit_adrs[0]."
- test_files: []
- gaps: |
    No test under `<odd-platform>/odd-platform-api/src/test` references
    `ReactiveActivityRepositoryImpl` or `ReactiveActivityRepository` (grep
    returned zero matches). Neither the write path nor the seven read paths
    are exercised by automated tests.

    The five highest-risk regression sites:

    1. **Cursor pagination correctness at second boundaries** (line 285-288).
       The `truncatedTo(ChronoUnit.SECONDS)` on the comparator side is a known
       source of off-by-one boundary bugs in audit-stream pagination — under
       high write rate, multiple rows can share the same `(created_at SECOND-
       truncated, id)` tuple-key and the cursor-less-than predicate may skip
       rows that arrived in the same second as the cursor anchor. The
       deployment of this pattern across `ActivityController.getActivity`
       sidecar batch A's `concepts.invariants.[1]` is unverified.

    2. **The data-entity-FK invariant** (line 219 + V0_0_48__add_activity.sql:4,12).
       Every activity row is FK-bound to a real data_entity row. If a future
       refactor reintroduced the V0_0_1__init.sql-era `data_entity_id NULL`
       pattern for non-data-entity events (RBAC, Owner, Datasource), the
       LEFT JOIN read paths would surface the rows but the FK would block
       INSERT — a coordinated migration is required. No integration test
       pins the invariant.

    3. **USER_OWNER_MAPPING-join semantics** (cross-mode bleed, lines
       157/178/199/221 + the four locations in this file). The join is
       provider-agnostic; LSN-018-area test pins exist for the resolution
       repository but NOT for this repo's read path. A direct end-to-end
       test that authenticates as LOGIN_FORM 'alice', writes an activity
       row, then re-authenticates as LDAP 'alice' and verifies actor
       resolution does or does not bleed across modes — no such test exists.

    4. **Batch INSERT correctness under > 1000 rows** (line 62-70).
       `executeInPartition` chunks at BATCH_SIZE=1000 per
       JooqReactiveOperations.java:24, and `save` reduces over the chunks
       with `zipWith(Integer::sum)` then `.then()`. A failure on chunk 3 of
       5 — does `.then()` swallow the prior 2 successful inserts? Does the
       overall Mono fail with the chunk-3 error? Partial commit semantics
       under reactive Mono.zip-error propagation are untested.

    5. **Empty-oddrns list for DOWNSTREAM/UPSTREAM** (line 124, 204).
       `DATA_ENTITY.ODDRN.in(List.of())` — jOOQ rewrites to `1=0` typically,
       producing an empty result. The behaviour is correct but un-pinned;
       a refactor to a different SQL fragment generator could change it.

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
      - Failure modes (silent partition-coverage gap, partial batch commits)
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
  - "Documentation's 'Filters on the global Activity page' section enumerates 7 facets (Calendar / datasource / namespace / event type / tags / owners / users) per the ActivityController.getActivity batch-A fetched_excerpts. The repository surfaces an 8th implicit axis via the `type` parameter (ALL / MY_OBJECTS / UPSTREAM / DOWNSTREAM) — only `MY_OBJECTS` is owner-scoped. The docs do not state that the default view is cross-owner (every authenticated user sees activity for every data entity, regardless of ownership association)."
  - "Documentation's Configuration section frames `odd.activity.partition-period` as controlling 'retention and partitioning'. The activity table has NO retention DROP path for non-empty partitions — ActivityEmptyPartitionsHousekeepingJob only drops EMPTY past partitions (ActivityEmptyPartitionsHousekeepingJob.java:9-17). The activity table grows monotonically. (Cross-reference: ActivityTablePartitionManager sidecar batch K doc_drift_findings.[0] for the upstream version of this finding.)"

## implicit_adrs

- "**Audit is structurally scoped to data-entity events**: `activity.data_entity_id` is `NOT NULL` with FK constraint to `data_entity(id)` (V0_0_48__add_activity.sql:4,12). The decision encodes that this table is the 'data-entity audit log', not a 'platform audit log'. RBAC mutations (Role / Policy / Owner CRUD), Datasource registration, Collector token rotation, integration-wizard config changes — none can write here. A separate platform-event audit surface would be required to capture them." — evidence: V0_0_48__add_activity.sql:4 (`data_entity_id bigint NOT NULL`) + V0_0_48__add_activity.sql:12 (`CONSTRAINT activity_data_entity_id_fk FOREIGN KEY (data_entity_id) REFERENCES data_entity (id)`) + this repo line 219 (`.join(DATA_ENTITY).on(DATA_ENTITY.ID.eq(ACTIVITY.DATA_ENTITY_ID))` — INNER JOIN; assumes the FK is unbreakable). — intent_anchor: "the FK constraint at V0_0_48__add_activity.sql:12 is named `activity_data_entity_id_fk` (verbose, schema-evolution-aware naming) and the column is NOT NULL (line 4) — both are explicit choices over the alternative `data_entity_id bigint NULL` which would have left the door open for non-data-entity events. The schema author committed to data-entity-scoped audit." — confidence: HIGH
- "**Cursor pagination uses truncate-to-second + id tiebreaker**: the cursor predicate is `row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)` (line 287-288), while the ORDER BY is plain `ACTIVITY.CREATED_AT.desc(), ACTIVITY.ID.desc()` (line 291). The asymmetry is intentional — the client passes `lastEventDateTime` as an `OffsetDateTime` whose millisecond/microsecond precision may not match what Postgres serialised; truncating to second on the comparator side accommodates client clock-skew while the ORDER BY preserves full-precision newest-first sort." — evidence: line 285-288 (truncated cursor) + line 290-291 (full-precision order) + DateTimeUtil.mapUTCDateTime usage in batch-A sidecar. — intent_anchor: "the `truncatedTo(ChronoUnit.SECONDS)` on `truncated` (line 286) combined with `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)` on the column side (line 288) — both sides explicitly truncate; the ORDER BY at line 291 deliberately does NOT, preserving the full timestamp for newest-first." — confidence: MEDIUM (the WHY-anchor is the syntactic shape; no `// client-clock-skew tolerance` comment proves intent — but the asymmetry is too deliberate to be coincidence).
- "**Batch INSERT chunked at BATCH_SIZE=1000 with `.zipWith(Integer::sum).then()` reduction**: `save(List<ActivityPojo>)` uses `JooqReactiveOperations.executeInPartition` (line 62-70) — the SAME chunking primitive used by every batched INSERT in the repository layer (JooqReactiveOperations.java:24,51-67). The CONVENTION extends to alert-emission flows (AlertServiceImpl emits N alerts → createActivityEvents → save). The 1000-row threshold is a JDBC-server-side maximum-arg-count workaround for Postgres + R2DBC drivers." — evidence: this repo line 62 + JooqReactiveOperations.java:24 (`BATCH_SIZE = 1000`) + JooqReactiveOperations.java:51-67 (the shared executeInPartition pattern). — intent_anchor: "the constant `BATCH_SIZE = 1000` is centralised at JooqReactiveOperations.java:24 — not per-repository; the convention is workspace-wide. The reduction `.reduce((m1, m2) -> m1.zipWith(m2, Integer::sum))` is the standard reactive partial-result aggregator." — confidence: HIGH
- "**Actor resolution joins USER_OWNER_MAPPING by username only (not by auth provider)**: every read path issues `.leftJoin(USER_OWNER_MAPPING).on(USER_OWNER_MAPPING.OIDC_USERNAME.eq(ACTIVITY.CREATED_BY).and(USER_OWNER_MAPPING.DELETED_AT.isNull()))` (lines 157-158, 178-179, 199-200, 221-222). The join is provider-agnostic — this is the read-side mirror of the `provider-null-cross-mode-bleed` mechanism documented at `lineage/odd-platform/concepts/detail/invariants/provider-null-cross-mode-bleed.yaml` (per batch-N ReactiveUserOwnerMappingRepositoryImpl). The decision predates multi-auth-mode deployments; it works correctly for single-mode deployments and bleeds usernames across modes for any deployment using multiple auth backends simultaneously." — evidence: lines 157-158/178-179/199-200/221-222 (four occurrences of the provider-agnostic LEFT JOIN) + ReactiveUserOwnerMappingRepositoryImpl batch N + concept `provider-null-cross-mode-bleed`. — intent_anchor: "the JOIN ON predicate explicitly names `OIDC_USERNAME` and `DELETED_AT` — choosing two columns out of the four available on USER_OWNER_MAPPING (the omitted ones are `OWNER_ID` for filter-narrowing — used in getCommonConditions line 273 for `userIds` filter — and `PROVIDER` which is NEVER referenced from this file). PROVIDER's absence is a deliberate column-selection, not an oversight." — confidence: HIGH

## bugs_limitations_corner_cases

- "**The activity table grows monotonically — no DELETE path, no non-empty-partition DROP path, the docs' 'retention and partitioning are controlled' framing is misleading**. `ActivityEmptyPartitionsHousekeepingJob` only DROPs partitions that contain zero rows (ActivityEmptyPartitionsHousekeepingJob.java:1-18; extends EmptyPartitionsHousekeepingJob which only handles empty partitions). Once a partition has any activity row, it persists forever. A high-volume deployment (1M events/day) accumulates ~365GB+/year of audit data with no recovery path short of manual `DROP TABLE activity_YYYYMMDD_YYYYMMDD`." — evidence: ActivityEmptyPartitionsHousekeepingJob.java:9-17 + the absence of any DELETE-from-activity in this repository (no `deleteFrom(ACTIVITY)` anywhere in the file, grep verified zero matches) + WebFetch activity-feed#configuration ('retention and partitioning are controlled by'). — severity: HIGH (silent-data-growth class — mirrors ActivityTablePartitionManager bugs_limitations_corner_cases[0]).
- "**Cross-mode actor bleed: LOGIN_FORM 'alice' and LDAP 'alice' resolve to the SAME OwnerPojo on the read path**. Every read query LEFT JOINs `USER_OWNER_MAPPING ON OIDC_USERNAME = ACTIVITY.CREATED_BY AND DELETED_AT IS NULL` (lines 157-158, 178-179, 199-200, 221-222) — provider-agnostic. A deployment migrating from LOGIN_FORM to LDAP without uniqueness on (`username`, `provider`) tuples at the user-creation layer will see the historical LOGIN_FORM 'alice' activity rows mapped to the LDAP 'alice' owner — even if those are different people. The write side records the username at INSERT time (`ActivityServiceImpl.createActivityEvent` line 47-49 emits `UserDto::username` only); the read side blindly trusts it. PRIMARY-SOURCE for read-side cross-mode bleed; the resolution-side primary is ReactiveUserOwnerMappingRepositoryImpl batch N." — evidence: lines 157-158/178-179/199-200/221-222 (the four PROVIDER-omitted joins) + ActivityServiceImpl.java:47-49 (single-username INSERT) + V0_0_48__add_activity.sql:10 (`created_by varchar(512)` — no provider column) + concept `provider-null-cross-mode-bleed`. — severity: HIGH (forensic-integrity class — auditing 'who did X' returns ambiguous answers when the username space overlaps across auth modes).
- "**`activity.created_by` is `varchar(512)` NULLABLE — anonymous mutations and ingestion-path system events write null**. `ActivityServiceImpl.createActivityEvent` (line 47-49) emits `null` when `authIdentityProvider.getCurrentUser()` returns empty: (a) under `auth.type=DISABLED` (anonymous traffic mutates the catalog), (b) ingestion-path FINALIZING-phase processors (ActivityIngestionRequestProcessor line 53 explicitly `.systemEvent(true)`; no username binding), (c) scheduler-driven AlertServiceImpl flows that issue OPEN/RESOLVED_ALERT_RECEIVED + ALERT_STATUS_UPDATED with `.systemEvent(true)`. All null-`created_by` rows orphan on the USER_OWNER_MAPPING LEFT JOIN and surface in the UI with `OwnerPojo = null` — visually indistinguishable from 'system' events with no further discriminator beyond `is_system_event = true`. Under DISABLED-mode, the anonymous mutations LOOK like system events." — evidence: V0_0_48__add_activity.sql:10 (created_by varchar(512), NULL allowed) + ActivityServiceImpl.java:47-49 (the `switchIfEmpty(Mono.defer(() -> Mono.just(activityMapper.mapToPojo(event, activityCreateTime, null))))` line — explicit null fallback) + DisabledAuthSecurityConfiguration.java:16 (anonymous permitted under DISABLED). — severity: MEDIUM (anonymity-bypass class — under DISABLED, mutations are unattributable in the audit log; the UI cannot distinguish them from system events).
- "**'My Activities' axis-mismatch: `findMyActivities(currentOwnerId)` filters by `OWNERSHIP.OWNER_ID = currentOwnerId` (activity ON entities I own), NOT by `USER_OWNER_MAPPING.OWNER_ID = currentOwnerId` (activity I performed)**. Lines 91-107 of this file pass `currentOwnerId` into `addJoins`/`getCommonConditions`, which produce `OWNERSHIP.OWNER_ID.in(ownerIds)` predicates (line 270). The actor-side filter (`USER_OWNER_MAPPING.OWNER_ID.in(userIds)`, line 273) is only added if the caller separately passed `userIds`. The UI's 'My' tab shows 'changes to entities my owner is attached to' — which is NOT 'changes I personally made'. A user with no ownership attachments but who has made platform changes sees their own changes ONLY by passing themselves explicitly via `userIds`, not via the `MY_OBJECTS` type parameter. The docs' 'auditing a specific person's platform activity' framing for the User filter (per batch-A WebFetched excerpt) implicitly acknowledges this — but the page does not say MY_OBJECTS is owner-axis-only." — evidence: this repo lines 91-107 (the `findMyActivities` method body) + lines 264-275 (`getCommonConditions` — ownerIds vs userIds are different predicates) + ActivityServiceImpl.java:184-199 (the service path that uses currentOwnerId from `fetchAssociatedOwner`) + WebFetch /features/active-platform-features/activity-feed (User filter framed for 'auditing a specific person'). — severity: MEDIUM (semantics gap — a confused operator looking at the 'My' tab will under-detect their own past changes).
- "**Cursor pagination's truncate-to-second tolerance can skip rows at second boundaries under sustained write rate**. Line 287-288: `row(trunc(ACTIVITY.CREATED_AT, DatePart.SECOND), ACTIVITY.ID).lessThan(truncated, lastEventId)`. If 50 activity rows have `created_at` within the same SECOND truncation bucket, and the client passes back `(lastEventId=row #25, lastEventDateTime=<that-row's-timestamp>)`, the cursor predicate becomes `(SAME_SECOND, ID < 25)` — which DOES correctly skip rows >25 in that second. BUT the ORDER BY is `created_at DESC, id DESC` (line 291) on the FULL precision — so two rows that sort as `[row_30_at_T+0.7s, row_25_at_T+0.2s, row_28_at_T+0.2s, ...]` (created_at micro-precision differing within the second) could mis-sort: row_30 comes first by full precision but second by truncated-to-second precision. The asymmetry between truncated-comparator and full-precision-sort introduces a potential row-skip on the next page request. Magnitude is bounded by the number of rows per second; acceptable for low-write-rate deployments, problematic at 1k+ events/sec." — evidence: line 285-288 (truncation on cursor) + line 290-291 (full-precision ORDER BY). — severity: MEDIUM (forensic-integrity-under-load class).
- "**`save(List<ActivityPojo>)` partial-commit semantics under reactive-Mono.zip error**: line 62-70 dispatches to `executeInPartition` which chunks at 1000 rows and reduces via `.zipWith(Integer::sum)` (JooqReactiveOperations.java:62-66). If chunk 3 of 5 fails (e.g. partition coverage gap on chunk-3's rows because they straddle a midnight rotation boundary), `.zipWith` propagates the chunk-3 error — but chunks 1, 2, and any chunk that completed before chunk-3's error already INSERTed to PG (no transaction wraps the chunked save at this level). The result: a `save(List<ActivityPojo>)` call that surfaces an error to the caller has nonetheless committed PARTIAL audit data. AlertServiceImpl which calls this method twice (lines 258, 324) with multiple alert events could see N/2 alert-receive activity rows committed and N/2 lost, with no compensating delete." — evidence: this repo line 62-70 (no `@Transactional` / `Mono.usingWhen` around the save) + JooqReactiveOperations.java:51-67 (executeInPartition reduce-with-zipWith, no rollback path) + AlertServiceImpl.java:252-258 (the batch-emit calling pattern). — severity: MEDIUM (forensic-completeness class).
- "**INNER JOIN to DATA_ENTITY (line 219) means orphan activity rows after data_entity hard-delete disappear from reads**. If a data_entity row is hard-DELETEd (vs soft-deleted via STATUS=DELETED), the FK constraint at V0_0_48__add_activity.sql:12 (`REFERENCES data_entity (id)`) is `ON DELETE`-unspecified — Postgres defaults to NO ACTION, which would BLOCK the delete. BUT DataEntityHousekeepingJob (per F-010 sidecar) DOES cascade-delete data_entity rows past TTL — which would cascade-delete the activity rows too (if the FK has CASCADE) OR block the housekeeping job's delete (if no CASCADE). The exact CASCADE behaviour is migration-version-dependent and not surfaced in this repository file. Operator reading: 'the audit row referencing a soft-deleted data entity is preserved; the audit row referencing a hard-deleted data entity is gone'. Forensic implication: cleaning up old data entities also cleans up the audit trail explaining WHO created them." — evidence: V0_0_48__add_activity.sql:12 (the FK declaration — no ON DELETE clause visible in the migration) + this repo line 219 (`.join(DATA_ENTITY)` — INNER JOIN; rows with no data_entity match are excluded from reads regardless of FK behaviour) + F-010 DataEntityHousekeepingJob (cascade-delete TTL job). — severity: MEDIUM (forensic-history-erasure class).
- "**No DISTINCT on the SELECT — multi-tag / multi-owner filters duplicate activity rows in results**. `buildBaseQuery` (line 208-225) issues plain `DSL.select(selectFields).from(ACTIVITY).join(DATA_ENTITY)...` followed by conditional LEFT JOINs to TAG_TO_DATA_ENTITY and OWNERSHIP based on filter presence (line 237-242). A data entity with 3 tags + 2 owners produces 6 rows from the join cardinality alone; the SELECT returns all 6 (with the activity columns identical and the join columns differing). The `findActivities` flow doesn't apply DISTINCT — UI sees duplicates. The `size` parameter caps the result set but does NOT collapse duplicates first — a `size=100` request with multi-tag filter may return 100 rows representing only 30-40 distinct activity events." — evidence: line 208-225 (buildBaseQuery, no DISTINCT) + line 237-242 (the LEFT JOINs that produce multiplicity) + line 290-292 (where + orderBy + limit — no DISTINCT applied). — severity: MEDIUM (results-correctness class — UI may show 'duplicate' activity entries).

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
  - "**Cursor pagination's `(trunc(created_at, SECOND), id)` tuple comparison** (line 287-288) uses a derived-column predicate on the LEFT side and full-precision data on the right — Postgres may not use the `activity_created_at_idx` for the truncated comparator if it cannot prove the function is index-aware. The `data_entity_id_idx` index (V0_0_48__add_activity.sql:17) helps for `findDataEntityActivities` but not for the global feed." — evidence: line 285-288 + V0_0_48__add_activity.sql:15-17 (two indexes available).
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
  - "**No row-level lock in this repository** — purely INSERT + SELECT. The cross-process serialisation lives at `ActivityTablePartitionManager` (advisory lock 90 + ShedLock) for partition CREATE only."
  - "Cursor pagination scales linearly for the requesting client. The asymmetry between truncated-second comparator and full-precision ORDER BY (implicit_adrs.[1]) creates a sub-linear correctness regression at high write rate (bugs_limitations_corner_cases.[4])."
  - "**Activity table size growth is unbounded** — no DELETE path, no DROP of non-empty partitions. After 5+ years on a 1M-events/day deployment, the partition count grows to 60+ (at 30-day cadence) or 250+ (at 7-day cadence — operators who tuned per the docs' 'narrower partitions for performance' guidance). Postgres planner overhead grows with partition count even when partition pruning is effective."
  - "**Cross-batch coupling with F-010 housekeeping**: the per-cycle 15-minute housekeeping iteration drops ONLY empty past partitions of activity (ActivityEmptyPartitionsHousekeepingJob). Non-empty partitions never drop; the activity table accumulates monotonically. No alert / metric flags this." 
- known_performance_gaps:
  - "**Unbounded growth of activity table** (mirrors ActivityTablePartitionManager bugs_limitations_corner_cases.[0] from the upstream sidecar). The repository writes; nothing deletes. Multi-year deployments accumulate 100s of GB of audit data with no recovery path." — evidence: this repo file 1-310 (no `deleteFrom(ACTIVITY)` anywhere) + ActivityEmptyPartitionsHousekeepingJob.java:9-17 (only EMPTY partition drops). — severity: HIGH
  - "**No DISTINCT on multi-facet filter queries** — multi-tag / multi-owner filters produce N×M-row results before LIMIT applies. UI with `tagIds=[a,b,c]+ownerIds=[1,2]+size=100` may return only 30-40 distinct activity events with 60-70 duplicates." — evidence: line 208-225 (buildBaseQuery, no DISTINCT) + line 237-242 (the multiplicity-producing LEFT JOINs) + line 290-292 (no DISTINCT applied at finalize). — severity: MEDIUM
  - "**Cursor predicate function-on-column may bypass index**: `trunc(ACTIVITY.CREATED_AT, DatePart.SECOND)` (line 288) wraps the indexed column in a function — Postgres can use the index only if a functional index `(date_trunc('second', created_at))` exists. The migration creates `activity_created_at_idx ON activity(created_at)` (V0_0_48__add_activity.sql:15) — plain column, not functional. Deep-window pagination triggers full-partition scans." — evidence: line 287-288 + V0_0_48__add_activity.sql:15. — severity: MEDIUM
  - "**Per-mutation single-row INSERT round-trip** is unavoidable for the per-event audit pattern but adds N round-trips for N rapid mutations. No batched-mutation aggregation at the service level (each `@ActivityLog` method fires ONE saveReturning). A bulk-tag-assignment UI flow that updates 100 entities issues 100 audit-INSERT round-trips serialised on the request thread." — evidence: line 50-54 (saveReturning is single-row) + ActivityServiceImpl.java:43-52 (createActivityEvent is single-event) + grep of `@ActivityLog` annotations (18 single-method matches; none batch). — severity: LOW
  - "**Coordinate-dependency with partition-creation cron**: an INSERT issued at NOW() = midnight rotation boundary depends on the previous-day partition (whose 2×period width covers today per ActivityTablePartitionManager implicit_adrs[0]) — UNLESS the partition-create cron has been failing silently (ActivityTablePartitionManager bugs_limitations_corner_cases[2]). The repository surfaces partition-coverage gaps as raw Postgres errors via `ExceptionUtils.translateDatabaseException`; there is no graceful-degradation path." — evidence: this repo line 50-54, 57-71 (no fallback) + ActivityTablePartitionManager bugs_limitations_corner_cases[2] (silent-fail). — severity: LOW (gated on the partition cron working; an upstream failure cascades).

## sources

- understanding ← ReactiveActivityRepositoryImpl.java:43-310 + ReactiveActivityRepository.java:11-87 + ActivityServiceImpl.java:36-273 + V0_0_48__add_activity.sql:1-17
- concepts.entities ← ReactiveActivityRepositoryImpl.java:19-41 + ActivityPojo (jOOQ-generated POJO referenced at line 21) + ActivityRecord (jOOQ-generated record referenced at line 24) + ActivityEventTypeDto.java:1-31
- concepts.invariants.[0] ← V0_0_48__add_activity.sql:4 (`data_entity_id bigint NOT NULL`) + V0_0_48__add_activity.sql:12 (FK constraint) + ReactiveActivityRepositoryImpl.java:155, 176, 197, 219 (INNER JOIN to DATA_ENTITY in every read path)
- concepts.invariants.[1] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 (four occurrences of the provider-agnostic LEFT JOIN)
- concepts.invariants.[2] ← ReactiveActivityRepositoryImpl.java:285-288 (truncate-to-second cursor predicate) + line 290-291 (full-precision ORDER BY)
- concepts.invariants.[3] ← ReactiveActivityRepositoryImpl.java:290-292 (where + orderBy + limit shape)
- concepts.invariants.[4] ← ReactiveActivityRepositoryImpl.java:91-107 (findMyActivities) + line 270 (OWNERSHIP.OWNER_ID predicate) + line 273 (USER_OWNER_MAPPING.OWNER_ID predicate)
- concepts.invariants.[5] ← V0_0_48__add_activity.sql:1-13 (schema) + ActivityServiceImpl.java:46-52 (`getCurrentUser` + null fallback at line 49)
- dependencies_semantic.requires-feature.[0] ← ReactiveActivityRepositoryImpl.java:46-47, 51, 59, 62-69 + JooqReactiveOperations.java:23-67
- dependencies_semantic.requires-feature.[1] ← ReactiveActivityRepositoryImpl.java:47, 305-308 + JooqRecordHelper.java:37-43
- dependencies_semantic.requires-feature.[2] ← ReactiveActivityRepository.java:11-87 + ActivityServiceImpl.java:37 (the sole consumer)
- dependencies_semantic.requires-feature.[3] ← ReactiveActivityRepositoryImpl.java:34-41 (the static jOOQ Tables imports)
- dependencies_semantic.requires-config ← application.yml:213 (partition-period: 30) + ActivityTablePartitionManager.java:11 + the indirect partition-coverage dependency surfaced at line 50-54 (saveReturning) + ActivityTablePartitionManager sidecar batch K bugs_limitations_corner_cases.[2]
- dependencies_semantic.requires-runtime ← V0_0_48__add_activity.sql:13 (PARTITION BY RANGE) + ReactiveActivityRepositoryImpl.java:29-30 (Mono/Flux imports) + JooqReactiveOperations.java:16 (R2DBC DatabaseClient)
- dependencies_semantic.coupling ← ActivityServiceImpl.java:50, 62 + ActivityAspect.java:81-95 + ActivityIngestionRequestProcessor.java:51-55 + AlertServiceImpl.java:252,258,318,324 + ActivityEmptyPartitionsHousekeepingJob.java:9-17 + ActivityTablePartitionManager.java:9-21 + ActivityMapper (referenced at ActivityServiceImpl.java:181,197,215)
- tests_coverage_semantic.gaps ← grep for `ReactiveActivityRepositoryImpl|ReactiveActivityRepository` in `<odd-platform>/odd-platform-api/src/test` (zero matches verified) + LSN-018 RULE 6 forcing question (cross-registry: no contradicting test-coverage claim exists in test-map registry per coherence sweep)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20)
- docs_link_semantic.inferred_docs.[1] ← cross-reference to ActivityTablePartitionManager sidecar batch K (live-verified 2026-05-10)
- docs_link_semantic.inferred_docs.[2] ← cross-reference to ActivityController.getActivity sidecar batch A (live-verified 2026-05-10 — 404)
- docs_link_semantic.doc_drift_findings.[0] ← ActivityEventTypeDto.java:3-31 (27 values) + WebFetch activity-feed Event Types section (20 values enumerated)
- docs_link_semantic.doc_drift_findings.[1] ← V0_0_48__add_activity.sql:4,12 + F-006 drift_class + WebFetch activity-feed (no audit-coverage statement)
- docs_link_semantic.doc_drift_findings.[2] ← ReactiveActivityRepositoryImpl.java:73-89 (no current-user predicate) + WebFetch activity-feed Filters section + ActivityController.getActivity sidecar batch A
- docs_link_semantic.doc_drift_findings.[3] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 + the absence of `deleteFrom(ACTIVITY)` in this repo + WebFetch activity-feed Configuration section
- implicit_adrs.[0] ← V0_0_48__add_activity.sql:4, 12 + ReactiveActivityRepositoryImpl.java:155, 176, 197, 219
- implicit_adrs.[1] ← ReactiveActivityRepositoryImpl.java:285-288, 290-291
- implicit_adrs.[2] ← ReactiveActivityRepositoryImpl.java:62-70 + JooqReactiveOperations.java:24, 51-67
- implicit_adrs.[3] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 + ReactiveUserOwnerMappingRepositoryImpl sidecar batch N invariants[2]
- bugs_limitations_corner_cases.[0] ← ActivityEmptyPartitionsHousekeepingJob.java:9-17 + grep for `deleteFrom(ACTIVITY)` in this repo (zero matches) + WebFetch activity-feed#configuration
- bugs_limitations_corner_cases.[1] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 + ActivityServiceImpl.java:47-49 + V0_0_48__add_activity.sql:10
- bugs_limitations_corner_cases.[2] ← V0_0_48__add_activity.sql:10 + ActivityServiceImpl.java:47-49 + ActivityIngestionRequestProcessor.java:53 + AlertServiceImpl.java:252,318
- bugs_limitations_corner_cases.[3] ← ReactiveActivityRepositoryImpl.java:91-107, 264-275 + ActivityServiceImpl.java:184-199 + WebFetch activity-feed Filters
- bugs_limitations_corner_cases.[4] ← ReactiveActivityRepositoryImpl.java:285-288, 290-291
- bugs_limitations_corner_cases.[5] ← ReactiveActivityRepositoryImpl.java:62-70 + JooqReactiveOperations.java:51-67 + AlertServiceImpl.java:252-258, 318-324
- bugs_limitations_corner_cases.[6] ← V0_0_48__add_activity.sql:12 + ReactiveActivityRepositoryImpl.java:219 + F-010 sidecar (DataEntityHousekeepingJob cascade-delete)
- bugs_limitations_corner_cases.[7] ← ReactiveActivityRepositoryImpl.java:208-225, 237-242, 290-292
- security.auth_mode_relevance ← ReactiveActivityRepositoryImpl.java:43 (@Repository) + V0_0_48__add_activity.sql:10 + ActivityServiceImpl.java:47-49 + lines 157-158/178-179/199-200/221-222
- security.ingestion_filter_relevance ← ActivityIngestionRequestProcessor.java:51-55 (the FINALIZING-phase write path that reaches this repo)
- security.authorization_assertions ← this repo file 1-310 (no auth annotations on any method) + ActivityController.getActivity sidecar batch A
- security.owner_scoping ← ReactiveActivityRepositoryImpl.java:73-89, 91-107, 109-126, 264-275 + concept references in sidecar batch I
- security.data_exposure.[0] ← V0_0_48__add_activity.sql:6-7 + ReactiveActivityRepositoryImpl.java:290-291 + DescriptionActivityStateDto.java:3
- security.data_exposure.[1] ← ReactiveActivityRepositoryImpl.java:157-158, 273
- security.data_exposure.[2] ← ReactiveActivityRepositoryImpl.java:157-158, 178-179, 199-200, 221-222 + ActivityServiceImpl.java:47-49 + concept `provider-null-cross-mode-bleed`
- security.known_security_gaps.[0] ← lines 157-158/178-179/199-200/221-222 + ActivityServiceImpl.java:47-49 + V0_0_48__add_activity.sql:10
- security.known_security_gaps.[1] ← ActivityServiceImpl.java:47-49 + V0_0_48__add_activity.sql:8 + DisabledAuthSecurityConfiguration.java:16
- security.known_security_gaps.[2] ← V0_0_48__add_activity.sql:4, 12 + ReactiveActivityRepositoryImpl.java:219 + F-006 drift_class
- security.known_security_gaps.[3] ← V0_0_48__add_activity.sql:6-7 + ReactiveActivityRepositoryImpl.java:290-291
- security.known_security_gaps.[4] ← ReactiveActivityRepositoryImpl.java:62-70 + JooqReactiveOperations.java:51-67 + AlertServiceImpl.java:252-258, 318-324
- performance.hot_paths.[0] ← ReactiveActivityRepositoryImpl.java:57-71 + JooqReactiveOperations.java:51-67 + ActivityIngestionRequestProcessor.java:44-56
- performance.hot_paths.[1] ← ReactiveActivityRepositoryImpl.java:73-89, 208-225, 290-292 + V0_0_48__add_activity.sql:15
- performance.hot_paths.[2] ← ReactiveActivityRepositoryImpl.java:285-288 + V0_0_48__add_activity.sql:15-17
- performance.throughput_characteristics ← ReactiveActivityRepositoryImpl.java:29-30 (reactive imports) + line 57-71 (batched INSERT) + line 50-54 (single-row INSERT)
- performance.resource_allocation ← ReactiveActivityRepositoryImpl.java:50-54, 57-71, 73-89, 109-126 + ActivityIngestionRequestProcessor.java:44-56
- performance.scaling_characteristics ← ReactiveActivityRepositoryImpl.java:43 (stateless) + ActivityEmptyPartitionsHousekeepingJob.java:1-18 (housekeeping coupling)
- performance.known_performance_gaps.[0] ← this repo file 1-310 + ActivityEmptyPartitionsHousekeepingJob.java:9-17
- performance.known_performance_gaps.[1] ← ReactiveActivityRepositoryImpl.java:208-225, 237-242, 290-292
- performance.known_performance_gaps.[2] ← ReactiveActivityRepositoryImpl.java:287-288 + V0_0_48__add_activity.sql:15
- performance.known_performance_gaps.[3] ← ReactiveActivityRepositoryImpl.java:50-54 + ActivityServiceImpl.java:43-52 + grep for @ActivityLog annotations
- performance.known_performance_gaps.[4] ← ReactiveActivityRepositoryImpl.java:50-54, 57-71 + ActivityTablePartitionManager sidecar batch K bugs_limitations_corner_cases.[2]

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

## Maintainer notes
