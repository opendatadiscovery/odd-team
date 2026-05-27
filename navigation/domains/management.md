# Management

The operator-CRUD surface in `odd-platform` under `/management/{namespaces,datasources,integrations,collectors,owners,tags,associations,roles,policies}` (9 SPA sub-routes). Pillar P-08 in the ontology; consumed by every administrative workflow (register a data source, rotate a collector token, edit an owner, configure namespace/title/role/policy taxonomy).

## Code Entry Points (odd-platform)

### Controllers (REST endpoints)
- `odd-platform-api/src/main/java/.../controller/OwnerController.java` — 4 endpoints (POST/PUT/DELETE + GET list). GET is ungated; mutations gated by `OWNER_{CREATE,UPDATE,DELETE}` via `SecurityConstants.java:143-147`.
- `odd-platform-api/src/main/java/.../controller/CollectorController.java` — 5 endpoints (CRUD + regenerate-token). Mutations gated by `COLLECTOR_{CREATE,UPDATE,DELETE,TOKEN_REGENERATE}` via `SecurityConstants.java:127-137`. List endpoint ungated (read-collaborative).
- `odd-platform-api/src/main/java/.../controller/NamespaceController.java` — 5 endpoints (CRUD + list + details). Mutations gated by `NAMESPACE_{CREATE,UPDATE,DELETE}` at `SecurityConstants.java:98-108`. List + details ungated.
- `odd-platform-api/src/main/java/.../controller/DataSourceController.java` — 5 endpoints (CRUD + regenerate-token). Mutations gated by `DATA_SOURCE_{CREATE,UPDATE,DELETE,TOKEN_REGENERATE}`. List ungated.
- `odd-platform-api/src/main/java/.../controller/IntegrationController.java` — 2 endpoints (list + details). No SecurityRule entries — any authenticated user reads; anonymous under `auth.type=DISABLED`.
- `odd-platform-api/src/main/java/.../controller/LinksController.java` — single endpoint `GET /api/links`; authenticated read; backed by `AdditionalLinkProperties` (`@ConfigurationProperties("odd")`).
- `odd-platform-api/src/main/java/.../controller/TitleController.java` — list endpoint backing the OwnerTitleAutocomplete + TitleFilter UI surfaces; no Management UI tab for Titles (admin-via-side-channel via `OwnershipServiceImpl.titleService.getOrCreate`).
- `odd-platform-api/src/main/java/.../controller/DataEntityAttachmentController.java` — 10 endpoints (files + links + uploads); 3 READ endpoints have no SecurityRule entry (cross-entity read leak class).
- `odd-platform-api/src/main/java/.../controller/OwnerAssociationRequestController.java` — 7 endpoints for the User→Owner binding workflow (parallel control-plane to Owner CRUD).

### Services (business logic)
- `odd-platform-api/src/main/java/.../service/OwnerServiceImpl.java` — full Owner CRUD + `getOrCreate` side-door (line 38-42). All mutating methods @ReactiveTransactional; NO @ActivityLog (audit silence).
- `odd-platform-api/src/main/java/.../service/CollectorServiceImpl.java` — Collector CRUD + token regeneration.
- `odd-platform-api/src/main/java/.../service/NamespaceServiceImpl.java` — Namespace CRUD + `getOrCreate` side-door (line 36-40) reached from 4 sister services.
- `odd-platform-api/src/main/java/.../service/DataSourceServiceImpl.java` — Data Source CRUD + token regeneration; `namespace_name` side-door on create/update.
- `odd-platform-api/src/main/java/.../service/TitleServiceImpl.java` — Title `getOrCreate` (line 18-22); sole production callers are `OwnershipServiceImpl.create/update` (sister-service side-door pattern).
- `odd-platform-api/src/main/java/.../integration/service/IntegrationService` (interface) + `IntegrationRegistryFactory.java` — boot-time classpath scan of `META-INF/wizard/*.yaml`; case-insensitive id merge.
- `odd-platform-api/src/main/java/.../service/auth/TokenGeneratorImpl.java` — `RandomStringUtils.randomAlphanumeric(40)` token mint (lines 34-42); plaintext at rest.

### Config-properties classes
- `odd-platform-api/src/main/java/.../housekeeping/config/HousekeepingTTLProperties.java` — `@ConfigurationProperties("housekeeping.ttl")`; 3 `private int` fields with NO `= 30` initialiser (Java-side default = 0; safety floor lives only in `application.yml:165-170`).
- `odd-platform-api/src/main/java/.../config/properties/AdditionalLinkProperties.java` — `@ConfigurationProperties("odd")`; record-of-record (`record AdditionalLinkProperties(List<Link> links) { record Link(String title, String url) {} }`); NO `@NotBlank`/`@URL`/`@Pattern`/`@Validated`.
- `odd-platform-api/src/main/java/.../config/SchedulingConfiguration.java` — `@EnableScheduling` + `@EnableSchedulerLock(defaultLockAtMostFor="1h")`; `.usingDbTime()` clock-skew defence; single-thread default executor.
- `odd-platform-api/src/main/java/.../config/MinioConfig.java` (lines 1-26) — `@ConditionalOnProperty("attachment.storage" havingValue="REMOTE")`; `MinioAsyncClient.builder().endpoint(url).credentials(accessKey, secretKey).build()` — NO `.region(...)` (LSN-002 root) / `.httpClient(...)` / `.credentialsProvider(...)`.

### Housekeeping subsystem (orchestrator + 5 jobs)
- `odd-platform-api/src/main/java/.../housekeeping/HousekeepingJobManager.java` — orchestrator. `@Scheduled(fixedRate=15min)` + `@SchedulerLock(name="housekeepingJob")`; iterates `List<HousekeepingJob>` (5 discovered beans) on one shared Postgres connection.
- `odd-platform-api/src/main/java/.../housekeeping/job/AlertHousekeepingJob.java` (lines 28-34) — known jOOQ precedence bug (manual RESOLVED rows exempt from TTL).
- `odd-platform-api/src/main/java/.../housekeeping/job/SearchFacetsHousekeepingJob.java`.
- `odd-platform-api/src/main/java/.../housekeeping/job/DataEntityHousekeepingJob.java` — ~25-table cascade; `.block()` inside jOOQ transaction.
- `odd-platform-api/src/main/java/.../housekeeping/job/ActivityEmptyPartitionsHousekeepingJob.java`.
- `odd-platform-api/src/main/java/.../housekeeping/job/MessageEmptyPartitionsHousekeepingJob.java`.

### Session housekeeping (separate from the 5-job set)
- `odd-platform-api/src/main/java/.../auth/session/PostgreSQLSessionHousekeepingJobHandler.java` (line 13) — `@Scheduled(fixedRate=1 HOURS)` with NO `@SchedulerLock` (N-replica race).
- `odd-platform-api/src/main/java/.../auth/session/PostgreSQLSessionHousekeepingJob.java`.

### Advisory-lock leader election
- `odd-platform-api/src/main/java/.../leaderelection/PostgreSQLLeaderElectionManagerImpl.java` (lines 18-30) — `pg_advisory_lock(N)` blocking variant; no timeout / no `pg_try_advisory_lock`.
- `application.yml:177` — `notifications.wal.advisory-lock-id: 100`
- `application.yml:197-198` — `partition.advisory-lock-id: 90`
- `application.yml:201` — `datacollaboration.receive-event-advisory-lock-id: 110`
- `application.yml:202` — `datacollaboration.sender-message-advisory-lock-id: 120`

### UI surface (odd-platform-ui)
- `odd-platform-ui/src/routes/managementRoutes.ts` (lines 4-14) — 9 ManagementRoutes; `BASE_PATH='/management'`. NO Titles entry.
- `odd-platform-ui/src/components/Management/ManagementTabs.tsx` (lines 19-50) — 9 enumerated tabs (Namespaces / Datasources / Integrations / Collectors / Owners / Tags / Associations / Roles / Policies).
- `odd-platform-ui/src/components/Management/Owners/OwnersList/` + `OwnerForm.tsx` + `EditableOwnerItem.tsx`.
- `odd-platform-ui/src/components/Management/Collectors/CollectorsList/` + `CollectorForm.tsx` + `CollectorItem.tsx` + `CollectorItemToken.tsx` (one-shot plaintext token + substring-prefix sniff).
- `odd-platform-ui/src/components/Management/Namespaces/` + `Datasources/` + `Integrations/` + per-tab forms.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx` (lines 60-66) — operator-link render via React Router `<Link target='_blank'>` (5 link sites; missing `rel='noopener noreferrer'`).

### Schema (V0_0_NN migrations)
- `odd-platform-api/src/main/resources/db/migration/V0_0_3__add_ownership.sql` (lines 1-8) — `title.name varchar(128) UNIQUE`; no CHECK constraint.
- `odd-platform-api/src/main/resources/db/migration/V0_0_28__add_token.sql` (line 4) — `value varchar(40) NOT NULL`; no hashing column; no UNIQUE.
- `odd-platform-api/src/main/resources/db/migration/V0_0_29__add_collector.sql` (line 4) — `name varchar(255) UNIQUE` (FULL unique, not partial).
- `odd-platform-api/src/main/resources/db/migration/V0_0_31__add_namespace.sql` — partial-unique-index pattern for soft-delete + name reuse.
- `odd-platform-api/src/main/resources/db/migration/V0_0_48__add_activity.sql` (lines 4,12) — `activity.data_entity_id NOT NULL` FK to `data_entity(id)` (structural audit-scope constraint).
- `odd-platform-api/src/main/resources/db/migration/V0_0_51__add_owner_association_request.sql` (line 11) — FK to owner(id) with NO `ON DELETE` (orphan-rows hazard).
- `odd-platform-api/src/main/resources/db/migration/V0_0_64__owner_partial_unique.sql` — partial-unique-index on `owner.name WHERE deleted_at IS NULL` (intended name-reuse-after-soft-delete pattern).

## Tests

- `odd-platform-api/src/test/.../repository/TitlesRepositoryImplTest.java` — repository-tier CRUD (id assignment, bulk create/update, soft-delete, getByName). Does NOT cover the controller wire (zero coverage on `/api/titles`).
- Grep `<odd-platform-api>/src/test` for `Housekeeping*` returns ZERO matches. Grep for `Owner*Test` / `Collector*Test` / `Namespace*Test` returns no tests covering the full controller→service→repository chain end-to-end.
- The integration-test profile (`application-integration-test.yml:7-8`) DISABLES housekeeping (`housekeeping.enabled: false`) — exists to opt out, not to test.

## Documentation

- `documentation/docs/features/management.md` — workflow-phrase-level only (creation flows mostly; token rotation explicitly for Collectors; SILENT on update/delete/audit/soft-delete/partial-update-vs-replace across the board).
- `documentation/docs/configuration-and-deployment/odd-platform.md` — housekeeping section (3 cleanup tasks; AlertHousekeepingJob bug acknowledged); odd.links section (global-visibility caveat documented); advisory-lock-ids partially documented.
- `documentation/docs/configuration-and-deployment/enable-security/authorization/owners.md` — concept page; SILENT on lifecycle (permission gates, side-door, audit, empty-roles UPDATE, DISABLED-mode anonymity, getOwnerList ungating).
- `documentation/docs/configuration-and-deployment/enable-security/authorization/policies.md` — mentions `dataEntity:owner:title` once; SILENT on Title vocabulary origin / free-text auto-create / case-sensitivity.
- `documentation/docs/features/management/namespaces.md` — **404 NOT FOUND** (confirmed 2026-05-27).
- `documentation/docs/integrations/integrations/integration-wizard.md` — covers `META-INF/wizard` mechanism + `platform_url` caveat; SILENT on `installed` field dead / 204-on-missing-id / auth posture / DISABLED-mode reach / case-insensitive id collision / boot fail-fast.
- `documentation/docs/features/data-discovery/attachments.md` — covers LSN-001 LOCAL-ephemeral verbatim + us-east-1 reference; SILENT on cross-entity privilege escalation / chunk-staging /tmp under REMOTE / MIME validation / link URL scheme / filename path-traversal.

## Related Domains
→ authentication (users, roles, permissions, SecurityConstants)
→ ingestion (data sources + collectors register here; token plaintext-at-rest the credential-MINTING side; F-008 the credential-CONSUMER side)
→ collaboration (owners → ownership; the side-door bridge)
→ attachments (one of the most operator-trust-load-bearing Management surfaces)

## Ontology features anchored under Management (P-08)
- F-010 Housekeeping TTL Enforcement
- F-019 Owner Lifecycle Management
- F-020 Collector Lifecycle Management
- F-027 Attachment Lifecycle (Files + Links)
- F-028 Namespace Lifecycle Management
- F-031 Data Source Lifecycle Management
- F-033 Integration Wizard
- F-035 Operator-Configured Additional Links
- F-036 Owner-Relationship Title Directory
- F-043 (Quality Dashboard route — batch 1)
- F-065 Advisory-Lock Registry
- F-074 (Management read-collaborative posture)
- F-075 (User-Owner Association Request flow)
- F-076 (Cross-Management Cascade-on-Delete)
- F-104 (batch 1)
- F-105 (Management Section Route Gating — batch 1)
- F-161 (Management Top-Level Chrome)
- F-162 (Integration Wizard Argument-Form Authoring)
- F-163 (One-Shot Token Reveal Affordance Pattern)
- F-171..F-174 (Owner-Association triage + admin direct-bind + active-tab remove + audit-trail)
