# Batch VAL-LSN-019-B index reconciliation — 2026-05-20

This file is appended alongside the main `index.md` (per the catalog's batch-by-batch append convention used since batch X). The main `index.md` headline carries the batch-S/R counts (197); subsequent batches (T/U/V/X) added shards directly to `detail/` without updating the headline counts. This batch-VAL-LSN-019-B reconciliation file records the additions WITHOUT modifying the main index headline counts (which are stale-by-design pending a maintainer-led full reconciliation).

## Batch summary

**Trigger**: VAL-LSN-019-B (second Stress Protocol canary — Activity feed feature). Five new/rewritten sidecars covering the Activity feed surface:

1. `lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-class__ActivityController.md` (controller-class enclosing tier; LSN-019 STRESS PROTOCOL applied)
2. `lineage/odd-platform/understanding/odd-platform__java__service__ActivityServiceImpl.md` (service-tier enclosing tier; LSN-019 STRESS PROTOCOL applied)
3. `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveActivityRepositoryImpl.md` (existing batch R sidecar — re-referenced for cross-layer)
4. `lineage/odd-platform/understanding/odd-platform__java__service__activity__handler__ActivityHandler.md` (handler interface tier; LSN-019 STRESS PROTOCOL applied)
5. `lineage/odd-platform/understanding/odd-platform__java__housekeeping__job__ActivityEmptyPartitionsHousekeepingJob.md` (housekeeping-job tier; LSN-019 STRESS PROTOCOL applied)

**Outcome**: **3 NEW findings (2 HIGH + 1 MEDIUM + 0 LOW)** + **7 STRENGTHENED existing entries**. Per LSN-018 stale-probe cadence: 0 direct live WebFetches this session — all relevant `docs.opendatadiscovery.org` URLs inherited from prior batches within the 11-day stale-probe window (the `activity-feed` page, the `configuration-and-deployment/odd-platform` page, the `developer-guides/api-reference` hub, the `user-owner-association` page — all WebFetched within 2026-05-08 to 2026-05-20 per prior batch evidence chains).

## NEW (3) — DOC-GAP-257 .. DOC-GAP-259

### HIGH severity

- **DOC-GAP-257** (HIGH; drift): **Activity-emit failure on an `@ActivityLog`-annotated mutation SILENTLY ROLLS BACK the originating business mutation — operator-surprise class** — every `@ActivityLog`-annotated method runs inside `ActivityAspect.monoActivityAspect` / `fluxActivityAspect` (`ActivityAspect.java:42, 62`) which carries `@ReactiveTransactional`; transient activity-table write failures roll back successful business mutations, producing phantom-success failures that downstream retry strategies cannot diagnose; the live `/features/active-platform-features/activity-feed` page is SILENT on the transactional coupling; the design IS deliberate (audit-or-fail semantic per DOC-GAP-116 META + ActivityHandler invariants[6]) but the operator-impact dimension is missing from the doc-product; the three production paths (the `@ActivityLog` AOP path, `AlertServiceImpl.applyAlertActions`, `ActivityIngestionRequestProcessor.process`) all exhibit the rollback semantic with the ingestion path carrying the LARGEST BLAST RADIUS (a single hot-path activity-write failure can roll back a 1000+ entity ingestion batch). **NEW activity-feature-specific instantiation of DOC-GAP-116 META.**
  - **Full detail**: `detail/DOC-GAP-257.md`

- **DOC-GAP-259** (HIGH; drift): **`ActivityEmptyPartitionsHousekeepingJob` has a SILENT-DATA-LOSS RACE WINDOW between the empty-check and the partition DROP** — a concurrent `INSERT INTO activity` landing in the few-millisecond gap between `SELECT count(*) = 0` and `DROP TABLE` is silently lost; LSN-001-shape (silent default + destructive action); the empty-check + DROP are TWO SEPARATE PreparedStatements on the same Connection, NOT wrapped in a transaction (in DELIBERATE asymmetry with `AlertHousekeepingJob.java:25` + `DataEntityHousekeepingJob.java:71`); the audit-or-fail semantic of DOC-GAP-257 makes the loss MORE consequential — the durable audit row is silently converted to a lost audit; the live `/configuration-and-deployment/odd-platform` page is SILENT on partition lifecycle entirely (per DOC-GAP-060); cross-link LSN-018 (the pre-LSN-018-fix reducer would have missed this entirely) + LSN-019 (the Stress Protocol on a 17-line class produced this operationally-load-bearing finding); Probe P-012 pending for experimental verification of the race window's frequency in production. **NEW canonical LSN-001-class finding on the housekeeping subsystem.**
  - **Full detail**: `detail/DOC-GAP-259.md`

### MEDIUM severity

- **DOC-GAP-258** (MEDIUM; drift): **`/api/activity/counts` accepts NULL `begin_date` and `end_date` — produces UNBOUNDED COUNT(*) over the entire retained activity history; asymmetric with `/api/activity` (which validates dates with `BadUserRequestException`)** — `ActivityServiceImpl.getActivityList` (`:98-100, :128-130`) rejects null dates with `BadUserRequestException`; `ActivityServiceImpl.getActivityCounts` (`:138-166`) has NO null-check on either date AND issues four `Mono.zip`-parallel `SELECT COUNT(*)` queries over the WHOLE retained activity history (F-010: activity table grows monotonically per DOC-GAP-041); a single `/api/activity/counts` call WITHOUT dates yields four full-table aggregation scans in parallel, exhausting the connection pool; combined with the auth-mode-only `.authenticated()` gating (DOC-GAP-200) any authenticated user can issue these unbounded scans repeatedly with no rate limit, no scope filter, and no audit-trail. **NEW DoS-surface finding on the activity counts endpoint.**
  - **Full detail**: `detail/DOC-GAP-258.md`

## STRENGTHENED (7)

- **DOC-GAP-025** (Activity Feed exposes cross-owner audit trail) → batch VAL-LSN-019-B adds **SERVICE-TIER + HANDLER-INTERFACE-TIER** primary sources via `ActivityServiceImpl.S-D-1` + `ActivityHandler.invariants[6]`. The catalog now has **4-LAYER coverage** (controller-method + controller-class + service-tier + handler-interface-tier). Per-mode visibility posture (ALL / MY_OBJECTS / UPSTREAM / DOWNSTREAM bypassing owner-scoping for 3 of 4 modes) confirmed at the service tier; cross-link to DOC-GAP-202 strengthened with the per-mode filter-applicability matrix.
  - **Strengthen append**: `detail/DOC-GAP-025-batch-VAL-LSN-019-B-append.md`

- **DOC-GAP-041** (Activity-feed retention claim drift) → batch VAL-LSN-019-B adds **SERVICE-TIER + HOUSEKEEPING-JOB-TIER** primary sources. The catalog now has **4-LAYER coverage** (config-key-consumer + config-properties-class + service-tier + housekeeping-job-tier). New cross-pillar dimension: DOC-GAP-259 (silent-data-loss race window) extends DOC-GAP-041 from "no retention runs" to "the partial retention that DOES run has a silent-data-loss race window". The maintainer's doc-side fix should be coordinated across DOC-GAP-041 + DOC-GAP-060 + DOC-GAP-259 in ONE doc-product pass.
  - **Strengthen append**: `detail/DOC-GAP-041-batch-VAL-LSN-019-B-append.md`

- **DOC-GAP-116 META** (Service-tier @ReactiveTransactional boundary pattern undocumented) → batch VAL-LSN-019-B adds **ActivityServiceImpl + ActivityHandler interface** primary sources. The catalog now has **10-sidecar coverage** (AlertServiceImpl + IngestionServiceImpl + DataEntityServiceImpl + LineageServiceImpl + PolicyServiceImpl + RoleServiceImpl + OwnerServiceImpl + DataSourceIngestionServiceImpl + ActivityServiceImpl + ActivityHandler interface). NEW STRUCTURAL DIMENSION: ActivityServiceImpl has THREE distinct TX boundaries for the SAME service-tier method (`createActivityEvent`) depending on caller path — a pattern that AMPLIFIES the META's surprise-dimension. Cross-link to NEW DOC-GAP-257 (activity-feature-specific instantiation).
  - **Strengthen append**: `detail/DOC-GAP-116-batch-VAL-LSN-019-B-append.md`

- **DOC-GAP-142** (No auto-create-on-first-login under OAUTH2/LDAP — silent empty MY_OBJECTS) → batch VAL-LSN-019-B adds **ActivityServiceImpl S-D-2 service-tier** primary source. The catalog now has **3-LAYER triangulation** (AuthIdentityProviderImpl batch B + service consumers via batch I + ActivityServiceImpl batch VAL-LSN-019-B). NEW DIMENSION: the activity-feed MY_OBJECTS tab silent-empty is the most operator-visible manifestation of the deeper user-owner-mapping requirement.
  - **Strengthen append**: `detail/DOC-GAP-142-batch-VAL-LSN-019-B-append.md`

- **DOC-GAP-191** (Activity Feed event-type enumeration is INCOMPLETE — 27-vs-20 enum gap) → batch VAL-LSN-019-B adds **SERVICE-TIER + HANDLER-INTERFACE-TIER + HANDLER-IMPL-INVENTORY** primary sources. The catalog now has **4-LAYER coverage** (repository-tier + service-tier + handler-interface-tier + handler-impl-inventory). NEW STRUCTURAL DIMENSION: the 9-event handler-absent enumeration (not just 7 from DOC-GAP-191) — 9 of the 27 event types have NO concrete `ActivityHandler` impl; 2 (OPEN_ALERT_RECEIVED / RESOLVED_ALERT_RECEIVED) ARE documented but use a different emission mechanism that bypasses the handler interface entirely. The doc-side fix is extended with a handler-bypass meta-explanation.
  - **Strengthen append**: `detail/DOC-GAP-191-batch-VAL-LSN-019-B-append.md`

- **DOC-GAP-200** (ActivityController zero-authorization) → batch VAL-LSN-019-B adds **CLASS-TIER + SERVICE-TIER + HANDLER-INTERFACE-TIER** primary sources. The catalog now has **4-LAYER coverage** (controller-method + controller-class + service-tier + handler-interface-tier). NEW STRUCTURAL DIMENSION: the per-entity activity-tab (`GET /api/dataentities/{id}/activity/list`) has the same cross-owner read posture as the global feed — confirmed at the service tier via `ActivityServiceImpl.S-D-3`. The 4-layer absence of authorization is structurally universal, not a method-level oversight.
  - **Strengthen append**: `detail/DOC-GAP-200-batch-VAL-LSN-019-B-append.md`

- **DOC-GAP-202** (Activity-feed two-tier taxonomy reconciliation) → batch VAL-LSN-019-B adds **SERVICE-TIER `getActivityList` 4-arm switch + class-tier `ActivityType` dispatch** primary sources. The catalog now has **3-LAYER coverage** (controller-method + controller-class + service-tier). NEW SUB-FINDING: `ownerIds` query parameter SILENTLY DROPPED for non-ALL view modes — only `type=ALL` (and the default `type=null`) respect the `ownerIds` filter; MY_OBJECTS / UPSTREAM / DOWNSTREAM silently ignore it. The doc-side fix is re-shaped to lead with a per-mode filter-applicability matrix.
  - **Strengthen append**: `detail/DOC-GAP-202-batch-VAL-LSN-019-B-append.md`

## NOT-A-NEW-DOC-GAP (acknowledged but skipped per scoping rule)

- **ActivityHandler interface — internal API; no public doc** (item #9 in the orchestrator headline list): per the orchestrator's instructions ("likely not a doc-gap (internal). Skip unless cross-pillar doc references handlers"). The handler interface is correctly scoped as internal infrastructure — the doc-product appropriately does not surface it. **No new entry filed.** The handler interface IS surfaced as a strengthen-append on DOC-GAP-191 (the handler-impl-inventory dimension) and DOC-GAP-116 META (the audit-or-fail invariant) where it's load-bearing for OPERATOR-facing semantics.

## Coherence sweep

- **strengthens**: 7 (DOC-GAP-025, DOC-GAP-041, DOC-GAP-116, DOC-GAP-142, DOC-GAP-191, DOC-GAP-200, DOC-GAP-202)
- **supersedes**: 0
- **conflicts_surfaced**: 0
- **case-law cross-links**: LSN-001 (silent-data-loss-on-default-config — referenced in DOC-GAP-259), LSN-002 (operator-following-docs-off-a-cliff — DOC-GAP-257 / DOC-GAP-259), LSN-018 (reducer-contradiction-no-coherence-check — explicitly cited as the pre-fix failure mode this batch's discovery WOULD have hit), LSN-019 (descriptive-vs-interrogative file-analyser prompt — this batch IS the canonical VAL-LSN-019-B validation on the Activity Feed surface)

## Doc-side fix coordination

The three new findings + seven strengthens cluster around the `features/active-platform-features/activity-feed.md` live page AND the `configuration-and-deployment/odd-platform.md` housekeeping section. The maintainer's most efficient doc-side fix is a COORDINATED PASS:

1. **`features/active-platform-features/activity-feed.md`**:
   - Add per-mode filter-applicability matrix (DOC-GAP-202 strengthen + DOC-GAP-025 service-tier widening)
   - Add visibility / authorization admonition (DOC-GAP-025 + DOC-GAP-200)
   - Add 27-event complete enumeration with handler-bypass meta-explanation (DOC-GAP-191 strengthen)
   - Add transactional-coupling / audit-or-fail admonition (NEW DOC-GAP-257)
   - Add counts-endpoint date-required + recommended polling cadence (NEW DOC-GAP-258 + DOC-GAP-028)
   - Add partition lifecycle cross-link with race-window caveat (DOC-GAP-041 strengthen + NEW DOC-GAP-259)
   - Add MY_OBJECTS prerequisite cross-link (DOC-GAP-142 strengthen)

2. **`configuration-and-deployment/odd-platform.md`**:
   - Add "Partition lifecycle" sub-section (DOC-GAP-060 + DOC-GAP-041 + NEW DOC-GAP-259 + DOC-GAP-061)
   - Add per-job transaction-discipline note (DOC-GAP-148 + DOC-GAP-259)

3. **`developer-guides/api-reference/activity.md`** (new page per DOC-GAP-029):
   - Document the `size` REQUIRED contract (DOC-GAP-022 + DOC-GAP-202 + the size-required-vs-nullable sub-finding)
   - Document the date-required contract for the counts endpoint (NEW DOC-GAP-258)
   - Document the audit-or-fail semantic per endpoint (NEW DOC-GAP-257)

4. **`developer-guides/architecture/transaction-model.md`** (new page per DOC-GAP-116 META):
   - Add "Activity-feed write paths" sub-section (DOC-GAP-116 strengthen)
   - Add "audit-or-fail vs best-effort" decision matrix (DOC-GAP-257 cross-link)
   - Add @Profile("!integration-test") caveat (DOC-GAP-155 cross-link)

5. **`configuration-and-deployment/enable-security/authorization/user-owner-association.md`**:
   - Add "First-login UX and unmapped-user behaviour" sub-section (DOC-GAP-142 strengthen — references the activity-feed-MY_OBJECTS-tab manifestation)

The coordination is one maintainer-pass across 5 doc pages closes 3 new findings + 7 strengthens. YAML-safe emit.
