---
artefact: doc-gaps
generated_at: "2026-05-18T00:00:00Z"
generated_at_commit: ede5d277
sidecar_count: 50
concepts_yaml_version: 8
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 103
findings_by_severity: { HIGH: 53, MEDIUM: 40, LOW: 10 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 77, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 5 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars: AppInfoController @ auth.type@L18, AuthorizationManagerCondition @ auth.type@L11, CounterTimeSeriesExtractor @ metrics.storage@L20, IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20, ActivityTablePartitionManager @ odd.activity.partition-period@L11). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041 — code never DROPs partitions, doc claims partition-period controls retention). 4 distinct findings on activity-partition subsystem (DOC-GAP-041..043 + DOC-GAP-040 partial covers via cross-ref). Verified WebFetch 2026-05-11 — `enable-security` parent page DOES now state `auth.ingestion.filter.enabled defaults to false`, partial doc coverage; the `/api/appInfo` introspection surface, DISABLED-default of auth.type, LOGIN_FORM-drops-authorization, and tenant-id read/write asymmetry remain undocumented."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: DisabledAuthSecurityConfiguration @ auth.type@L10, LoginFormSecurityConfiguration @ auth.type@L31, OAuthSecurityConfiguration @ auth.type@L71, LDAPSecurityConfiguration @ auth.type@L51, NotificationsProperties config-properties-class). Four auth-mode SecurityConfiguration sidecars deepened the Auth Mode coverage from 'config consumers' to 'wiring sites' — surfacing the blast-radius of DISABLED (CSRF/CORS/actuator/S2S-ignored/audit-absence), 5-vs-7 OAuth2 provider drift with no Okta/Keycloak handlers, missing `azureTenantId` POJO field vs documented YAML, unvalidated Azure `logout-uri`, LDAP scheme silence (ldaps:// not differentiated), `auth.ldap.password` leak via actuator/env, substring-collision admin escalation in LDAP, `auth.login-form-redirect` open-redirect surface, session-cookie security gaps under LOGIN_FORM. Notifications sidecar surfaced dead `webhookUrl` field, no rate-limit, no audit trail, no per-channel filtering, no PII redaction, replication-slot orphan risk, GitBook routing drift (legacy `/active-platform-features/notifications` 404 — joining DOC-GAP-035 in cross-cutting class). New class-level DOC-GAP-058 captures the GitBook legacy-route drift as an audit-recommended pattern, not a single page. NEW HIGH findings: 8 (DOC-GAP-045, DOC-GAP-046, DOC-GAP-048, DOC-GAP-050, DOC-GAP-051, DOC-GAP-053, DOC-GAP-054, DOC-GAP-055). Live URL re-verification 2026-05-12: `disabled-authentication` 200 confirms blast-radius omission verbatim; `oauth2-oidc` 200 verifies 7-provider docs claim; `/active-platform-features/notifications` 404 confirms cross-cutting routing drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars: ODDOAuth2Properties, ODDLDAPProperties, EmailSenderProperties, DataCollaborationProperties, HousekeepingTTLProperties). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings. Cross-cutting refinements: (a) Lombok `@Data` toString sensitive-field leak — 4-sidecar triangulated (ODDLDAPProperties.password + ODDOAuth2Properties.clientSecret + EmailSenderProperties.password + NotificationsProperties); Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` DOES sanitise `/actuator/env` (batch-C scope was overbroad); the DURABLE leak surface is Lombok-generated `toString()` if logged. Refines DOC-GAP-006 + DOC-GAP-050 with the precise leak vector. (b) Partial-home pattern — DataCollaborationProperties binds 3 of 7 `datacollaboration.*` keys; EmailSenderProperties does not model `notifications.receivers.email.notification.emails` recipient list; docs that enumerate the prefix don't surface the split. (c) Activity-feed retention claim DOUBLE-CONFIRMED — HousekeepingTTLProperties has no `activity*Days` field; both partition-manager (WIDTH only) AND housekeeping (no activity scope) angles agree the docs claim is wrong (DOC-GAP-041 promoted to multi-angle case). (d) Lock-id collision risk on DataCollab undocumented; partition / notifications.wal / data-collab use four distinct defaults (90/100/110/120) with no validation that operators maintain disjointness. NEW HIGH findings: 7 (DOC-GAP-059, DOC-GAP-061, DOC-GAP-063, DOC-GAP-067, DOC-GAP-069, DOC-GAP-070); plus 1 promoted HIGH on the META Lombok-toString cluster. NEW MEDIUM: 5 (DOC-GAP-060, DOC-GAP-062, DOC-GAP-064, DOC-GAP-066, DOC-GAP-068, DOC-GAP-071). NEW LOW: 1 (DOC-GAP-065). Live URL re-verification 2026-05-12: `/oauth2-oidc` 200 verifies that ODD_IAM provider is COMPLETELY ABSENT from the page (drift in the other direction — POJO supports a provider docs don't name) + `username-attribute` (descriptive prose) vs `user-name-attribute` (every YAML example) inconsistency on the SAME page; `/configuration-and-deployment/odd-platform` 200 verifies housekeeping section frames 'three cleanup tasks' (missing 2 of 5 jobs), acknowledges jOOQ bug verbatim but with no upstream-issue link, fully documents SMTP caveats verbatim; `/features/active-platform-features/data-collaboration` 200 verifies no lock-id collision warning; `/features/active-platform-features/notifications` 200 verifies no rate-limit/audit/PII coverage; `/features/active-platform-features/activity-feed` 200 verifies the retention claim wording verbatim ('retention and partitioning are controlled by `odd.activity.partition-period`'); `/configuration-and-deployment/enable-security/authentication/ldap` 200 verifies no LDAP password actuator caveat, no substring-collision warning, no LDAPS guidance."
  - "2026-05-12 (batch E): DOC-GAP-072..083 — refresh after batch 2026-05-12E (5 method-level RBAC sidecars: RoleController.createRole, PolicyController.createPolicy, OwnerController.createOwner, PermissionController.getResourcePermissions, SearchController.search). 4 new RBAC entity concepts (Policy / Role / Owner / Permission) + 1 new feature concept (Search Session) added to concepts.yaml. Two NEW cross-cutting invariants captured: 'Administrator-name reservation asymmetry on CRUD' (2-sidecar, Role + Policy) and 'No-audit-log on RBAC mutations' (3-sidecar, Role + Policy + Owner); 'Read-collaborative cross-owner enumeration' strengthened from 2-sidecar to 3-sidecar by Search. NEW HIGH findings: 8 (DOC-GAP-072 — Roles API surface undocumented; DOC-GAP-073 — Policies page omits POLICY_CREATE + Administrator-bootstrap + audit + schema endpoint + DISABLED bypass; DOC-GAP-076 — read-side getResourcePermissions endpoint undocumented across 3 live pages; DOC-GAP-079 — Search WHO-can-search + cross-owner enumeration undocumented; DOC-GAP-082 META — DISABLED-bypasses-RBAC-primary-surface 8-sidecar triangulated; DOC-GAP-083 META — No-audit-log on RBAC mutations 3-sidecar triangulated; plus extensions to DOC-GAP-058 and the read-collaborative cluster). NEW MEDIUM findings: 3 (DOC-GAP-074 — OwnerController 201-vs-200 OpenAPI/impl drift confirms class-wide pattern; DOC-GAP-075 — Owners page omits creation mechanics + OWNER_CREATE + audit; DOC-GAP-077 — 4-vs-5 PermissionResourceType enum-vs-doc category drift; DOC-GAP-080 — Search query-syntax/tsquery special-character behaviour undocumented; DOC-GAP-081 — `/features/active-platform-features/search` 404 — third broken-URL instance strengthens DOC-GAP-058). NEW LOW finding: 1 (DOC-GAP-078 — Administrator policy LOOKUP_TABLE coverage unverified). Live URL re-verification 2026-05-12 (batch E): `/authorization/roles` 200 verifies 7 ROLE-creation topics not covered; `/authorization/policies` 200 verifies 7 POLICY-related topics not covered; `/authorization/owners` 200 verifies 6 OWNER-related topics not covered; `/authorization/permissions` 200 verifies 6 PERMISSION-related topics not covered (incl. 5-category doc vs 4-enum-value code shape mismatch); `/authorization` 200 verifies parent page omits DISABLED-vs-authorization relationship, read-side discovery endpoint, audit-logging, and which auth modes wire authorization; `/features/data-discovery/search` 200 verifies WHO/syntax/limits/cross-owner all silent; `/features/active-platform-features/search` 404 confirms third broken-URL instance; `/disabled-authentication` 200 verifies single production warning but no RBAC-bypass explicit narrative. The 5-sidecar batch confirms the RBAC primary surface is the largest single-feature doc-gap cluster — 8 distinct HIGH findings + 3 MEDIUM across 4 live `/authorization/*` pages."
  - "2026-05-12 (batch F): DOC-GAP-084..095 — refresh after batch 2026-05-12F (5 method-level sidecars: DataEntityController.getDataEntityDetails, DataEntityController.createOwnership, DataEntityController.updateStatus, DataEntityController.getDataEntityDownstreamLineage, IngestionController.postDataEntityList). Centerpiece-read coverage of DataEntityController (the platform's most-trafficked endpoint) plus the most-critical ingestion endpoint. NEW HIGH findings: 8 (DOC-GAP-084 — DataEntityDetails read-endpoint posture undocumented; the centerpiece read 4-sidecar triangulates read-collaborative; DOC-GAP-085 — view-count UPDATE inside GET is undocumented; read-replica-defeating side-effect; DOC-GAP-087 — Ownership-create flow + Owner+Title auto-create bypass undocumented across 3 live RBAC pages; DOC-GAP-088 — DataEntityMapperImpl statusUpdatedAt reset bug breaks the 30-day soft-delete TTL silently (LSN-001 shape); strengthens DOC-GAP-041 retention-claim cluster; DOC-GAP-089 — lineage_depth 'Unset returns default' is documented but unimplementable (NPE); DOC-GAP-091 — S2S docs X-API-Key example vs IngestionDataEntitiesFilter Authorization-Bearer drift — operator trap; DOC-GAP-092 — POST /ingestion/entities is doc-orphaned (no canonical operator-facing page; only the S2S sub-page mentions it and with the wrong header); DOC-GAP-094 META — doc-vs-code spelling/format mismatch class 2-sidecar; DOC-GAP-095 META — read-collaborative cross-owner enumeration strengthened from 3-sidecar to 4-sidecar with the centerpiece DataEntityDetails addition; STRONGEST evidence resolving ADR-CANDIDATE-003). NEW MEDIUM findings: 3 (DOC-GAP-086 — DataEntityDetails 34-field code vs 5-field doc coverage; DOC-GAP-090 — expanded_entity_ids documented as Data Entity Group-only but code accepts any IDs; DOC-GAP-093 — IngestionController postDataEntityList 201-vs-200 strengthens DOC-GAP-074 from 3- to 4-instance class-wide pattern). STRENGTHENED existing findings: DOC-GAP-009 (data-entities api-reference missing — now has 34-field-payload evidence from getDataEntityDetails sidecar); DOC-GAP-021 (lineage depth + expansion caveats) — promoted to HIGH via DOC-GAP-089 unimplementable-default sub-finding; DOC-GAP-041 (activity retention) — now 3-angle joined by DOC-GAP-088 (statusUpdatedAt reset breaks data_entity_delete_days TTL); DOC-GAP-058 (legacy-vs-canonical routing META) unchanged in count but the dual-page-404 pattern on /ingestion broadens the cross-cutting class to 'doc-orphaned write endpoints' (see DOC-GAP-092); DOC-GAP-074 (201-vs-200 OpenAPI/impl drift) — now 4-instance (Owner + Role + Policy + ingestion postDataEntityList); DOC-GAP-082 (DISABLED-bypasses-RBAC META) extended with read-side surfaces — DataEntityDetails + lineage downstream + ingestion-filter-OFF default all share the same root cause; DOC-GAP-083 (No-audit-log on RBAC mutations META) cross-strengthened by Ownership-create which IS audit-logged (asymmetry with Owner directory CRUD): captures the maintainer-design intent that 'ownership-binding is audit-worthy, owner-directory CRUD is not'. Live URL re-verification 2026-05-12 (batch F, 10 fetches consumed): `/configuration-and-deployment/enable-security/authentication/s2s` 200 — confirms curl example uses `X-API-Key` for POST /ingestion/entities verbatim + recommends combining S2S with `auth.ingestion.filter.enabled: true` without distinguishing the two auth filters' header conventions (DOC-GAP-091); `/configuration-and-deployment/data-ingestion` 404 + `/data-ingestion` 404 — confirms NO canonical operator-facing doc page exists for the ingestion endpoint (DOC-GAP-092); `/features/data-discovery/catalog-overview` 200 — confirms only 5 fields named (description / owners / tags / terms / custom metadata) vs DataEntityDetails.java's 34 fields, NO access-control statement (DOC-GAP-084 + DOC-GAP-086), NO view-count side-effect mention (DOC-GAP-085); `/features/data-discovery/statuses` 200 — references status-update timestamp drives soft-delete TTL but doesn't surface the reset bug (DOC-GAP-088); `/features/data-lineage` 200 — silent on lineage_depth, expanded_entity_ids, authorization, pagination/performance/DoS (DOC-GAP-089 + DOC-GAP-090); `/developer-guides/api-reference/lineage` 200 — quotes lineage_depth: 'Unset returns the platform's default depth' verbatim (DOC-GAP-089 unimplementable) + expanded_entity_ids: 'IDs of Data Entity Group entities' verbatim (DOC-GAP-090 narrower-than-code); `/features/data-discovery` 200 — silent on read-endpoint authorization (DOC-GAP-084); `/use-cases/use-cases/de-deprecation` 200 — describes deprecation workflow without status_updated_at / TTL semantics (DOC-GAP-088 sibling)."
  - "2026-05-13 (batch G): DOC-GAP-096..103 — refresh after batch 2026-05-13-G (5 DataEntityController method-level sidecars: addDataEntityTerm, upsertDataEntityInternalDescription, createDataEntityTagsRelations, getMyObjects, getPopular). NEW HIGH findings: 4 (DOC-GAP-096 — Markdown rendering pipeline rehype-raw without rehype-sanitize stored-XSS surface entirely undocumented; DOC-GAP-097 — 'upsert' description misleading; pure UPDATE with silent no-op on missing entity; DOC-GAP-098 — createDataEntityTagsRelations replace-all-vs-create operationId drift; DOC-GAP-099 — getMyObjectsWithUpstream/Downstream OpenAPI summary describes wrong semantic). NEW MEDIUM findings: 3 (DOC-GAP-100 — [[ns:term]] description syntax undocumented; DOC-GAP-101 — Popular ranking signal + inflation surface undocumented; DOC-GAP-102 — getMyObjects empty-Flux UX trap). NEW LOW finding: 1 (DOC-GAP-103 — LOGIN_FORM+LDAP both produce provider=null cross-mode user-identity bleed). STRENGTHENED existing findings: DOC-GAP-001 (term path-mismatch) — PRIMARY-SOURCE confirmed from batch G; DOC-GAP-009 (data-entities api-reference missing) — 5 more methods join the 35+ uncovered cluster; DOC-GAP-053 (META 'docs frame default without blast-radius') — now 6-sidecar; DOC-GAP-077 (Permissions page omits path/scope-asymmetry warnings) — 3 new policy-scope-asymmetry instances. Live URL re-verification 2026-05-13 (batch G, 5 fetches): `/features/data-discovery/catalog-overview` 200 (Popular + My Objects surface described, mechanism / inflation / EXCLUDE_FROM_SEARCH detail absent); `/configuration-and-deployment/enable-security/authorization/permissions` 200 (lists 5 DataEntity-related permissions with one-sentence each, no path/scope warnings); `/features/data-discovery/business-names` 200 (no description-write surface); `/features/active-platform-features/dictionary` 404 + `/features/active-platform-features/glossary` 404; `/developer-guides/api-reference/glossary` 200 (documents term-link/unlink endpoints with plural paths but no permission-gating discussion)."
---

# Doc gaps — odd-platform — 2026-05-18 (batch G refresh)

## Summary

- **Findings**: 95 total (49 HIGH, 37 MEDIUM, 9 LOW)
- **By category**: broken-url 9, drift 73, missing-page 6, coverage-gap 2, meta 5
- **By feature** (top affected concepts): Auth Mode (15 — expanded batch D with ODD_IAM-absent + adminUserInfoFlag-absent + username-attribute spelling drift), Data Entity (11 — expanded batch F with DataEntityDetails centerpiece-read posture + view-count side-effect + 34-vs-5-field coverage + ownership-create flow + statusUpdatedAt reset bug + lineage depth/expansion drift; **the largest single-feature gap-cluster in this catalog now alongside RBAC** when DataEntityController is treated as one feature surface), RBAC primary surface (Policy / Role / Owner / Permission) (8 — batch E), Notifications (8 — expanded batch D with email completeness + Lombok-toString refinement), Ingestion (3 — NEW batch F; postDataEntityList doc-orphaned + X-API-Key/Authorization-Bearer drift + 201/200 spec mismatch), Search (3 — batch E; Search Session canonical_candidate), Activity Feed (5 — now 3-angle-confirmed retention drift via statusUpdatedAt reset bug), Attachment (5), Housekeeping TTL (4 — batch D), DataCollaboration (4 — batch D with lock-id collision + partial-home), Alert (4), AlertManager Webhook Receiver (3), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4), Multi-Tenant Configuration / Metrics Ingestion (1), Collector / Collector Token (2), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). 33 HIGH findings are LSN-001/LSN-002-class operator-impact gaps. Batch F adds **two NEW meta-findings** (DOC-GAP-094 doc-vs-code spelling/format mismatch; DOC-GAP-095 read-collaborative 4-sidecar) and strengthens five existing patterns:
  - (i) **NEW batch F: Read-collaborative cross-owner enumeration — now 4-sidecar (DOC-GAP-095 META)** — strengthened by `DataEntityController.getDataEntityDetails`, joining `getAllAlerts` (batch A), `getActivity` (batch B), `SearchController.search` (batch E). DataEntityDetails is **the centerpiece UI read of the platform** — every entity-detail page mount, every tab-switch, every browser refresh. A single ID-enumeration loop against `GET /api/dataentities/{1..N}` yields the complete catalog (entity classes, types, data sources, soft-delete state) with full 34-field payload (descriptions, ownership, metadata, terms, tags, lineage shortcuts, source URLs, view counts). The blast radius is wider than alerts/activity/search COMBINED. Live `/features/data-discovery` 200 + `/features/data-discovery/catalog-overview` 200 + `/configuration-and-deployment/enable-security/authorization` 200 all silent on read-endpoint posture (re-verified 2026-05-12 batch F). **STRONGEST single piece of evidence resolving ADR-CANDIDATE-003 borderline** — the silence is consistent across 4 distinct first-class platform surfaces AND across 3 dedicated security pages. The maintainer's call narrows to: (a) treat the silence AS the design intent and author a unified "Read-collaborative posture" section on the Authorization parent page documenting that any authenticated user reads any entity's full details, OR (b) treat the silence as a missed gate cluster and add per-feature permission gates. Either resolves the drift; doc-product silence on the centerpiece read is the decisive signal that one resolution is required.
  - (j) **NEW batch F: Doc-vs-code spelling/format mismatch — now 2-sidecar (DOC-GAP-094 META)** — `username-attribute` (descriptive prose) vs `user-name-attribute` (every YAML example) on `oauth2-oidc.md` (DOC-GAP-063 batch D) + `X-API-Key` header (curl example on `s2s.md`) vs `Authorization: Bearer` header (consumed by `IngestionDataEntitiesFilter` when `auth.ingestion.filter.enabled=true`) (DOC-GAP-091 batch F). Pattern: docs use one format/spelling while code expects another; operators copy-pasting docs verbatim get silent binding failure or 401. Recommend a doc-side spelling/format audit + a code-side alias mechanism (`@Name` annotations / multi-header acceptance) per affected surface.
  - (k) **STRENGTHENED batch F: Activity-feed retention claim — now 3-angle confirmed (DOC-GAP-041)** — joins existing partition-manager (WIDTH only, batch B) + HousekeepingTTLProperties (no activity scope, batch D) with `DataEntityController.updateStatus` mapper bug (DOC-GAP-088 batch F): `DataEntityMapperImpl.applyStatus` sets `pojo.setStatus(...)` BEFORE the `if (statusDto.getId() != pojo.getStatus())` check, so `statusUpdatedAt` is NEVER set on any transition. The 30-day `data_entity_delete_days` TTL relies on `STATUS_UPDATED_AT.lessOrEqual(now - N days)`; with the column always NULL, the predicate evaluates to NULL (≈ false in SQL three-valued logic). Soft-deleted entities never hard-delete. **Third independent angle confirming the platform has no functioning row-by-age retention path** — this is now the strongest LSN-001-class case in the catalog.
  - (l) **STRENGTHENED batch F: DISABLED-bypasses-everything (DOC-GAP-082 META extended)** — the 8-sidecar RBAC triangulation extends in batch F to: (m1) `DataEntityController.getDataEntityDetails` — DISABLED-mode anonymous read of the entire catalog's detail metadata (HIGH per sidecar); (m2) `DataEntityController.getDataEntityDownstreamLineage` — DISABLED-mode anonymous graph-shaped cross-owner enumeration (HIGH per sidecar); (m3) `DataEntityController.updateStatus` — DISABLED-mode anonymous wholesale data-entity soft-deletion (HIGH per sidecar); (m4) `DataEntityController.createOwnership` — DISABLED-mode anonymous ownership-binding establishment with auto-create Owner+Title side effects (HIGH per sidecar); (m5) `IngestionController.postDataEntityList` — already known via DOC-GAP-038 ingestion-filter-OFF default. The DISABLED-bypass META now covers **13 sidecars** across the RBAC primary surface + DataEntity read/write surface + ingestion surface. Single `/disabled-authentication.md` "Blast radius" section addition + cross-references on `/authorization/*` + `/features/data-discovery` + `/features/data-discovery/catalog-overview` + `/features/data-lineage` + `/features/data-discovery/statuses` closes the gap structurally across **9+ live pages**. Highest-leverage maintainer-time investment in the entire catalog (was DOC-GAP-082 at 8-sidecar; now 13-sidecar).
  - (m) **STRENGTHENED batch F: OpenAPI 201-vs-implementation-200 drift (DOC-GAP-074) — now 4-instance class-wide pattern** — joins batch-E's Owner + Role + Policy create operations with `IngestionController.postDataEntityList` (DOC-GAP-093 batch F). The pattern: spec declares 201 Created, implementation returns 200 OK via `ResponseEntity::ok` or `ResponseEntity.ok().build()`. Sibling `postDataSetStatsList` and `ingestMetrics` correctly return 201 — postDataEntityList is the only inconsistent endpoint in IngestionController, suggesting an unintentional drift rather than a deliberate upsert-vs-insert distinction. Class-wide audit recommended.

Batch E-and-prior meta-recommendations (preserved):
  - (e) **NEW batch E: DISABLED-bypasses-RBAC-primary-surface (DOC-GAP-082 META — 8-sidecar triangulation)** — `auth.type=DISABLED` (the application.yml-bundled default per DOC-GAP-036) silently bypasses the entire RBAC primary surface (POST /api/policies, POST /api/roles, POST /api/owners — all NO_CONTEXT MANAGEMENT-tier gates) because `DisabledAuthSecurityConfiguration.java:13-18` calls `.anyExchange().permitAll()` and never wires `AuthorizationCustomizer`. Live `/disabled-authentication` 200 contains only the generic "DO NOT use this method in your production environment!" warning; it does NOT enumerate that DISABLED mode means any network-reachable caller can create MANAGEMENT/ALL policies, attach them to arbitrary roles, attach those to owners — the full keys-to-the-kingdom escalation chain is open and silent. Live `/authorization` 200 + `/authorization/policies` 200 + `/authorization/roles` 200 + `/authorization/owners` 200 + `/authorization/permissions` 200 all silent on DISABLED-mode bypass. The blast-radius gap from DOC-GAP-045 (CSRF/CORS/actuator/S2S-ignored/audit-absence) now extends to RBAC primary mutations. Highest-leverage HIGH meta-finding in the entire catalog: a single "Blast radius — RBAC primary surface" section on `/disabled-authentication.md` closes the gap across all 5 affected `/authorization/*` pages.
  - (f) **NEW batch E: No-audit-log on RBAC mutations (DOC-GAP-083 META — 3-sidecar triangulated)** — `RoleServiceImpl.create/.update/.delete` + `PolicyServiceImpl.create/.update/.delete` + `OwnerServiceImpl.create` emit NO `@Slf4j` log lines, publish NO events, INSERT into NO audit table. Activity feed (`/api/activity` — Activity Feed concept) does NOT cover RBAC mutations (grep verified: `@ActivityLog` appears only on AlertHaltConfigServiceImpl / AlertServiceImpl / DataEntityInternalStateServiceImpl / DataEntityServiceImpl / DataEntityGroupServiceImpl — none of the three RBAC primary-surface services). Consequence: a hijacked admin account or any S2S API-key holder (which gets ADMIN by default per S2sAuthenticationFilter) can rewrite the authorization model invisibly. Live `/authorization/policies`, `/authorization/roles`, `/authorization/owners` all silent on the audit-trail gap. Single class-level mitigation (audit pattern added to all 3 services) closes the gap structurally.
  - (g) **STRENGTHENED batch E: Read-collaborative cross-owner enumeration — now 3-sidecar** — joins existing AlertController#getAllAlerts (batch A) + ActivityController#getActivity (batch B) with SearchController#search (batch E). Search is the **widest blast radius** — catalog enumeration vector. The combined finding spans three first-class platform surfaces, all sharing the same posture (catch-all `.authenticated()` + no owner predicate), none documented in their respective live pages. ADR-CANDIDATE-003 (read-collaborative borderline) promoted to STABLE in concepts.yaml; doc-side requires a "Who can see this" section on each of the three feature pages.
  - (h) **STRENGTHENED batch E: GitBook legacy-vs-canonical routing drift — now 3-sidecar (joining DOC-GAP-058)** — `/features/active-platform-features/search` 404 confirms a third instance of the legacy-vs-canonical drift, joining `/active-platform-features/data-collaboration` (batch A) and `/active-platform-features/notifications` (batch C). The canonical search page IS `/features/data-discovery/search` (200). Strengthens the doc-side GitBook redirect-audit recommendation in DOC-GAP-058.

Batch D-and-prior meta-recommendations (preserved):
  - (a) **GitBook legacy-vs-canonical routing drift** (DOC-GAP-058 — meta-finding) — 2 sidecars (DataCollaboration batch A + Notifications batch C). Same shape: legacy `/active-platform-features/X` 404s while `/features/active-platform-features/X` serves 200. Recommend a doc-side audit of ALL legacy paths likely to be referenced from external blog posts / Slack discussions.
  - (b) **"Docs frame default behaviour but omit blast radius"** (DOC-GAP-053 meta-finding) — extends DOC-GAP-036, DOC-GAP-038, DOC-GAP-041, DOC-GAP-059. **Batch D upgrades to 4-sidecar triangulation** with HousekeepingTTLProperties — operator overriding application.yml without re-supplying the housekeeping block silently rebinds to 0 and triggers immediate hard-delete (exact LSN-001 shape). Pages exist and document the happy path, but do not enumerate the operational consequence cluster (CSRF + CORS + actuator + S2S-ignored + audit-absence for DISABLED; retention claim with no DROP path for activity-feed; Java-default-vs-YAML-default cliff for housekeeping). Recommend a doc-side audit of every "default behaviour" claim against the code's actual blast radius.
  - (c) **NEW batch D: Lombok `@Data` toString sensitive-field leak (DOC-GAP-067 — meta-finding)** — 4-sidecar triangulated (ODDLDAPProperties.password + ODDOAuth2Properties.clientSecret + EmailSenderProperties.password + NotificationsProperties). Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` DOES sanitise `/actuator/env` (so batch-C's actuator-env framing was overbroad); the durable leak surface is Lombok-generated `toString()` if logged. The doc pages for each affected feature (LDAP, OAuth2, login-form, notifications) need a "Logging discipline" caveat warning operators against `log.info("props = {}", properties)` or future code adding such lines. Refines DOC-GAP-006 + DOC-GAP-050.
  - (d) **NEW batch D: Partial-home pattern (DOC-GAP-068 — meta-finding)** — `@ConfigurationProperties` classes bind only a subset of their config-prefix's keys; operators reading the prefix in docs don't see that one POJO doesn't cover all keys. 2-sidecar triangulated (DataCollaborationProperties: 3 of 7 `datacollaboration.*` keys; EmailSenderProperties: omits `notifications.receivers.email.notification.emails` recipient list). Doc pages that enumerate the prefix need to call out the @Value-scattered remainder for maintainer onboarding (LOW operator-impact, MEDIUM maintainer-impact).
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface.
  - **Doc-text-vs-code audience drift** (2026-05-10A): the live alerting doc names "stewards and admins" while code enforces "any authenticated user."
  - **Triangulated default-open posture** (2026-05-10B): four config-key-consumer sidecars + four `*SecurityConfiguration` sidecars now converge on the same operator-trap shape — DISABLED-default of `auth.type` + FALSE-default of `auth.ingestion.filter.enabled` + no fail-fast on misconfigured `auth.type` + no boot WARN under DISABLED + actuator/env reachable under DISABLED. Per LSN-001 + LSN-002 case-law, this is the canonical insecure-default failure mode the ontology was built to surface.
  - **Documentation-overstates-config-effect** (2026-05-10B + 2026-05-12D): activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code has NO row-by-age retention path (partition manager controls WIDTH only; housekeeping has no `activity*Days` field). **Now 2-angle triangulated**.
  - **GitBook legacy-route 404 cluster**: `/active-platform-features/notifications` joins `/active-platform-features/data-collaboration`, both 404 with redirect-suggestion stubs; the canonical `/features/active-platform-features/*` paths serve 200.
  - **Auth-mode-wiring-site blast-radius gap (2026-05-12C)** — the dedicated sub-pages (`disabled-authentication`, `login-form`, `oauth2-oidc`, `ldap`) document the happy-path config but consistently omit security-relevant operational consequences (CSRF posture, session cookie security, S2S composition behaviour under each mode, actuator-env credential exposure, LDAPS scheme guidance, substring-collision admin escalation in LDAP, OAuth2 provider-handler coverage gap).
  - **Notifications subsystem under-documented for operations (2026-05-12C + D)** — the live page documents channels + WAL requirements + cleanup but omits: no rate-limit (alert bursts → Slack 429 / SMTP queue saturation), no audit trail (operators can't answer "did this alert get delivered?"), no per-channel filtering (every channel gets every alert regardless of owner), no PII redaction (free-text descriptions flow verbatim into outbound payloads), replication-slot orphan risk on rename, dead `notifications.webhookUrl` top-level field still binds. **Batch D adds**: email port=0 (Java primitive default) cliff, boxed Boolean nullability, modern SMTP-AUTH OAUTH2 absent, no Reply-To/Cc/Bcc/DKIM support, sender no `@Email` validation, recipient list comma-split has no per-address trim (silent partial delivery from whitespace).
  - **NEW 2026-05-12D: Housekeeping subsystem doc completeness** — the live page describes "three cleanup tasks" but code has 5 HousekeepingJob beans (missing Activity + Message empty-partitions jobs); the `housekeeping.ttl.*` 30-day default lives only in the bundled `application.yml` (not in Java field initializers) — an operator overriding the YAML rebinds to 0 and triggers immediate hard-delete (LSN-001 shape). Docs acknowledge the jOOQ-precedence bug for manual RESOLVED alerts but provide no upstream-issue link / workaround.
  - **NEW 2026-05-12D: OAuth2 docs internal inconsistency** — the page uses `username-attribute` (no hyphen between user and name) in descriptive prose but `user-name-attribute` (hyphenated) in every YAML example; Spring relaxed binding maps `user-name-attribute` (not `username-attribute`) to the `userNameAttribute` POJO field. Operators copy-pasting the prose key get silent binding failure. Additionally, ODD_IAM provider is COMPLETELY absent from the docs page (5-enum-value vs 7-docs-providers drift gets a third angle) and `adminUserInfoFlag` (the ODD_IAM admin-detection mechanism) is undocumented despite being a POJO field.

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 91

---

## DOC-GAP-001 — DataEntity `/term` vs `/terms` path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM gates — undocumented on Permissions page

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-001.md`

---

## DOC-GAP-002 — Alerting feature page does not warn that `getAllAlerts` exposes every platform alert to any authenticated user; doc text names "stewards and admins" audience while code enforces any authenticated user

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-002.md`

---

## DOC-GAP-003 — AlertManager Webhook Receiver lacks rate-limit / payload-cap / dedup / spoofing caveats on operator-facing config page

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-003.md`

---

## DOC-GAP-004 — Attachment feature page does not warn about read-path authorization asymmetry (GET endpoints unprotected)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-004.md`

---

## DOC-GAP-005 — Attachment max-file-size cap is client-side-only; non-browser caller can submit arbitrary-size files — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-005.md`

---

## DOC-GAP-006 — `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page (**REFINED batch D**: Spring Boot 3.4.10's `show-values: NEVER` default DOES mask values; the durable leak surface is Lombok-toString — see DOC-GAP-067)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-006.md`

---

## DOC-GAP-007 — GenAI feature page lacks prompt-injection / SSRF / DISABLED-anonymous-reachability caveats

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-007.md`

---

## DOC-GAP-008 — Directory feature page does not warn that the surface is platform-wide and bypasses owner-scoping (reconnaissance surface)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-008.md`

---

## DOC-GAP-009 — `developer-guides/api-reference` does not document the 40 dataEntity operations — punts to Swagger UI

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-009.md`

---

## DOC-GAP-010 — Attachment chunked-upload protocol (3-step state machine) undocumented anywhere; cross-entity uploadId hijack now confirmed at method level

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-010.md`

---

## DOC-GAP-025 — Activity Feed exposes cross-owner audit trail (`old_state`/`new_state` diffs) to any authenticated user — undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-025.md`

---

## DOC-GAP-029 — No `/developer-guides/api-reference/activity` page — global Activity feed has no first-party API reference

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-029.md`

---

## DOC-GAP-032 — Slack Data Collaboration cross-tenant message injection + missing authorization gate undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-032.md`

---

## DOC-GAP-036 — `auth.type=DISABLED` is the application.yml-bundled default but live `enable-security/authentication` pages do NOT state this — operator following the docs ships an unauthenticated platform without explicit opt-in

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-036.md`

---

## DOC-GAP-037 — `/api/appInfo` discloses active `auth.type` + `projectVersion` to unauthenticated network callers under DISABLED-default — passive fingerprinting surface, undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-037.md`

---

## DOC-GAP-038 — `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-038.md`

---

## DOC-GAP-039 — `auth.type=LOGIN_FORM` runs WITHOUT the authorization framework (Policies / Permissions / Roles / Owners) — `Authorization` page describes the framework with no mention of which auth modes wire it

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-039.md`

---

## DOC-GAP-041 — Activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code never DROPs activity partitions AND housekeeping has no `activity*Days` field; the retention claim is materially incorrect (**2-angle CONFIRMED batch D**)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-041.md`

---

## DOC-GAP-045 — `disabled-authentication` page declares DISABLED "the default configuration" with a single production-warning, but omits the full blast radius (CSRF / CORS / actuator / S2S-ignored / audit-absence / no boot WARN)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-045.md`

---

## DOC-GAP-046 — OAuth2/OIDC docs list 7 supported providers (AWS Cognito, GitHub, Google, Azure AD, Okta, Keycloak, Custom OIDC) but `Provider` enum has only 5; Okta/Keycloak operators silently get no provider-specific user enrichment and no provider-specific logout (**2-angle CONFIRMED batch D from primary-source POJO sidecar**; see also DOC-GAP-069, DOC-GAP-070 for batch-D-surfaced refinements: ODD_IAM completely absent from docs, `adminUserInfoFlag` field undocumented)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-046.md`

---

## DOC-GAP-047 — OAuth2 docs reference `azure-tenant-id` config key + use `${auth.oauth2.client.azure.azure-tenant-id}` interpolation, but `ODDOAuth2Properties.OAuth2Provider` POJO has NO `azureTenantId` field — Azure YAML example is not deployable as-shown

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-047.md`

---

## DOC-GAP-048 — OAuth2 docs flag Azure `logout-uri` as REQUIRED ("unset value causes NullPointerException") but `ODDOAuth2Properties.validate()` only checks `clientId` and `provider` — operator boots successfully and fails at first logout

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-048.md`

---

## DOC-GAP-049 — OAuth2/OIDC docs do NOT mention `auth.s2s.enabled` or the S2S composition with OAUTH2 — operators deploying OAuth2 + S2S see an undocumented X-API-Key → ADMIN-across-all-paths surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-049.md`

---

## DOC-GAP-050 — LDAP `auth.ldap.password` leak surface — actuator-env value-mask is operator-overridable AND the **durable** leak vector is Lombok `@Data`-generated `toString()` (**REFINED batch D**: from primary-source `ODDLDAPProperties` sidecar; Spring Boot 3.4.10's `show-values: NEVER` default DOES sanitise actuator-env; Lombok-toString is the canonical leak path)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-050.md`

---

## DOC-GAP-051 — LDAP setup page omits `ldap://` vs `ldaps://` scheme guidance, substring-match admin-groups collision risk, empty admin-groups → no admins, S2S composability, `management.health.ldap.enabled` default false, and timeout/pooling configuration — seven distinct caveats absent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-051.md`

---

## DOC-GAP-052 — LOGIN_FORM page omits `auth.login-form-redirect` config key (open-redirect surface), the absence of the authorization framework (DOC-GAP-039 sibling), session-cookie security flags, S2S composability, plain-text credential leak via `/actuator/env`, and CSRF posture — six distinct caveats absent

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-052.md`

---

## DOC-GAP-053 — **META-FINDING** — "docs frame default behaviour but omit blast radius" pattern (3-sidecar triangulated; cross-cutting class)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-053.md`

---

## DOC-GAP-054 — Notifications subsystem: no rate-limit / queue / backpressure — bursty alert events translate 1:1 into outbound HTTP/SMTP requests; Slack will rate-limit (429), SMTP/webhook receivers will be overwhelmed

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-054.md`

---

## DOC-GAP-055 — Notifications subsystem: no audit trail of delivery (no DB record, no metric, only DEBUG-level log) — operators cannot answer "did the alert get delivered?" or "which alerts went to which channels?"

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-055.md`

---

## DOC-GAP-059 — Housekeeping TTL Java-default vs YAML-default mismatch — operator overriding application.yml without the housekeeping block silently rebinds to 0 (Java `int` default) → next 15-min housekeeping cycle hard-deletes ALL resolved alerts, ALL search-facet history, ALL soft-deleted entities (LSN-001 shape, undocumented)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-059.md`

---

## DOC-GAP-061 — No `messageDays` retention field for the DataCollaboration `MESSAGE` table — `housekeeping.ttl.*` surface has 3 fields, none target messages; symmetric to DOC-GAP-041 activity-feed gap (silent unbounded growth)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-061.md`

---

## DOC-GAP-063 — OAuth2 docs internal inconsistency — descriptive prose uses `username-attribute` (no hyphen) but every YAML example uses `user-name-attribute` (hyphenated); Spring relaxed binding maps `user-name-attribute` (not `username-attribute`) to the `userNameAttribute` POJO field; operators copy-pasting the prose key get silent binding failure

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-063.md`

---

## DOC-GAP-067 — **META-FINDING** — Lombok `@Data` toString sensitive-field leak class (4-sidecar triangulated)

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-067.md`

---

## DOC-GAP-069 — ODD_IAM provider is in the `Provider` enum but COMPLETELY ABSENT from the OAuth2/OIDC docs page — operators deploying ODD_IAM have no doc surface (drift in the other direction — POJO supports a provider docs don't name)

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-069.md`

---

## DOC-GAP-070 — `adminUserInfoFlag` field is the ODD_IAM admin-detection mechanism but is undocumented on the OAuth2/OIDC docs page (sub-finding of DOC-GAP-069)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-070.md`

---

## DOC-GAP-072 — Roles live doc page omits the entire role-creation API surface — `POST /api/roles`, `ROLE_CREATE` permission, name uniqueness rules, audit-absence, predefined-name reservation asymmetry, S2S-ADMIN interaction, and the spec-vs-code 201-vs-200 drift (5 doc-drift findings against one page)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-072.md`

---

## DOC-GAP-073 — Policies live doc page omits POLICY_CREATE permission, Administrator-bootstrap, audit-trail absence, `GET /api/policies/schema` endpoint, and DISABLED-mode bypass (keys-to-the-kingdom under DISABLED — 5 doc-drift findings)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-073.md`

---

## DOC-GAP-076 — PermissionController read-side discovery endpoint `GET /api/resource/{type}/{id}/permissions` is undocumented across the 3 canonical `/authorization/*` live pages — operators auditing the security model cannot discover the platform's "what can I do?" surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-076.md`

---

## DOC-GAP-079 — Search feature page (canonical `/features/data-discovery/search`) is silent on WHO can search + cross-owner catalog enumeration — the platform's WIDEST cross-owner read surface is undocumented (3rd corroborating surface for read-collaborative posture)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-079.md`

---

## DOC-GAP-082 — **META-FINDING** — DISABLED-bypasses-RBAC-primary-surface pattern (8-sidecar triangulation; single `/disabled-authentication.md` admonition + 4 `/authorization/*` cross-references close the catalog's largest single-feature consequence cluster)

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — **META-FINDING** — No-audit-log on RBAC mutations pattern (3-sidecar triangulated: Role + Policy + Owner; doc-side action requires 3 page admonitions; code-side fix is a uniform `@ActivityLog`/audit-table addition across 3 services)

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-083.md`

---

## DOC-GAP-096 — Markdown rendering on data-entity descriptions is not sanitised at the backend AND the UI's `rehype-raw` configuration has no `rehype-sanitize` — stored-content-injection surface entirely undocumented

**Severity**: HIGH
**Category**: drift (security caveat absent on doc page covering the feature)

**Full detail**: `detail/DOC-GAP-096.md`

---

## DOC-GAP-097 — `PUT /api/dataentities/{id}/description` is a pure UPDATE with silent no-op on missing entity — operationId, OpenAPI summary, and consumer expectation all use "upsert" language that contradicts the implementation

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; spec asserts upsert; implementation is replace-or-silently-200)

**Full detail**: `detail/DOC-GAP-097.md`

---

## DOC-GAP-098 — `createDataEntityTagsRelations` operationId is misleading — semantic is replace-all (delete missing) but spec/operationId/method-name say "create" (additive); third-party consumers will silently lose tags

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; create-language for replace-all behaviour)

**Full detail**: `detail/DOC-GAP-098.md`

---

## DOC-GAP-099 — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` OpenAPI summary literally describes the wrong semantic — claims response is owned-with-lineage; actual response is NON-owned entities reachable from owned set

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; spec summary is the inverse of implementation)

**Full detail**: `detail/DOC-GAP-099.md`

---

## DOC-GAP-011 — Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-011.md`

---

## DOC-GAP-012 — Legacy URL `/active-platform-features/genai` returns 404 — canonical at `/features/active-platform-features/genai`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-012.md`

---

## DOC-GAP-013 — Legacy URL `/data-discovery/attachments` returns 404 — canonical at `/features/data-discovery/attachments`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-013.md`

---

## DOC-GAP-014 — Legacy URL `/data-discovery/directory` returns 404 — canonical at `/features/data-discovery/directory`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-014.md`

---

## DOC-GAP-015 — Legacy URL `/main-concepts` returns 404 — canonical at `/introduction/main-concepts.md`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-015.md`

---

## DOC-GAP-016 — Directory page wording: level 3 mixes "classes" and "types" — operator confusion

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-016.md`

---

## DOC-GAP-017 — GenAI feature page: OpenAPI spec declares only 200 OK — no documented 400/500 error contract for `/api/genai/ask`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-017.md`

---

## DOC-GAP-018 — API spec carries no `security:` block and no `components.securitySchemes` — invariant of contract-vs-runtime mismatch undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-018.md`

---

## DOC-GAP-019 — Concept "AlertManager Webhook Receiver" is a canonical_candidate but not a registered term in `main-concepts.md`

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-019.md`

---

## DOC-GAP-020 — Concept "Locale Bundle" / "Multilingual UI" — F-047 is filed; cross-referenced here

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-020.md`

---

## DOC-GAP-021 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-021.md`

---

## DOC-GAP-022 — Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-022.md`

---

## DOC-GAP-023 — Cross-entity uploadId hijack (Attachment) — undocumented; method-level evidence confirms the attack shape

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-023.md`

---

## DOC-GAP-030 — Activity Feed feature page omits `type` parameter, visibility model, cursor pagination mechanics

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-030.md`

---

## DOC-GAP-033 — Slack Data Collaboration api-reference page omits authentication/authorization/validation/rate-limit

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-033.md`

---

## DOC-GAP-034 — Token Rotation operational mechanics (grace period, audit logging, plaintext-in-response, in-flight 401) absent from enable-security pages

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-034.md`

---

## DOC-GAP-035 — `/active-platform-features/data-collaboration` returns 404 on legacy URL — canonical at `/features/active-platform-features/data-collaboration`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-035.md`

---

## DOC-GAP-040 — `AuthorizationManagerCondition` is unwired dead code — Authorization page describes the framework as if a centralised condition gates it

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-040.md`

---

## DOC-GAP-042 — Activity-feed partition WIDTH is `2 × partition-period` (60 days at default) but docs say "a new partition every 30 days"

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-042.md`

---

## DOC-GAP-043 — Activity-feed partition CREATE failures are silently swallowed; operator has no metric / alert / health-check signal — undocumented; `partition.advisory-lock-id` undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-043.md`

---

## DOC-GAP-056 — Legacy URL `/active-platform-features/notifications` returns 404 — canonical at `/features/active-platform-features/notifications`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-056.md`

---

## DOC-GAP-057 — Notifications subsystem under-documents operational caveats — dead `notifications.webhookUrl` field, no per-channel filtering, no PII redaction, replication-slot orphan risk on rename, webhook unsigned delivery

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-057.md`

---

## DOC-GAP-058 — **META-FINDING** — GitBook legacy-vs-canonical routing drift is a cross-cutting class (**now 3-sidecar triangulated after batch E: DataCollaboration + Notifications + Search**); recommend a doc-side audit of ALL legacy paths

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-058.md`

---

## DOC-GAP-060 — Housekeeping docs frame the subsystem as "three cleanup tasks" but code has 5 HousekeepingJob beans — `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` are undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-060.md`

---

## DOC-GAP-062 — AlertHousekeepingJob jOOQ-precedence bug acknowledged in docs but unlinked to a tracking issue / no workaround documented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-062.md`

---

## DOC-GAP-064 — DataCollaboration lock-id collision risk undocumented — operators tuning the four advisory-lock IDs (`partition.advisory-lock-id=90`, `notifications.wal.advisory-lock-id=100`, `datacollaboration.receive-event-advisory-lock-id=110`, `datacollaboration.sender-message-advisory-lock-id=120`) get no guardrails; operator who copies default 100 to data-collab silently breaks both subsystems

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-064.md`

---

## DOC-GAP-066 — Email channel config doc completeness — `port`=int default 0 cliff, boxed Boolean nullability, modern SMTP-AUTH OAUTH2 absent, no Reply-To / Cc / Bcc / DKIM support, sender no `@Email` validation, recipient list comma-split has no per-address trim

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-066.md`

---

## DOC-GAP-068 — **META-FINDING** — Partial-home pattern: `@ConfigurationProperties` POJOs bind only a subset of their config-prefix's keys; docs that enumerate the prefix don't surface the @Value-scattered remainder

**Severity**: MEDIUM
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-068.md`

---

## DOC-GAP-071 — DataCollab `datacollaboration.*` prefix is a partial-home — 3 of 7 keys bind to `DataCollaborationProperties`, 4 scattered across `@Value` in 4 files (specific instance of DOC-GAP-068 META)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-071.md`

---

## DOC-GAP-074 — OpenAPI declares 201 Created for `POST /api/owners` (and sibling create endpoints) but `OwnerController.java:26` returns 200 OK via `ResponseEntity::ok` — third concrete instance of a class-wide 201-vs-200 OpenAPI/implementation drift on RBAC create operations

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-074.md`

---

## DOC-GAP-075 — Owners live doc page omits creation mechanics (`POST /api/owners`), `OWNER_CREATE` permission, audit-trail absence, association-request flow mechanics, name validation gaps, and soft-delete recovery semantics (6 doc-drift sub-findings)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-075.md`

---

## DOC-GAP-077 — Live `/authorization/permissions` page lists 5 permission categories (Data entity / Term / Query Example / Lookup table / Management) but the code's `PermissionResourceType` enum exposes 4 contextual values (DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT) — Lookup table is documented as a category but is NOT a contextual resource type; LOOKUP_TABLE_* permissions live as NO_CONTEXT MANAGEMENT-bucket entries

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-077.md`

---

## DOC-GAP-080 — Search live doc page silent on query syntax — `JooqFTSHelper.tsQuery` splits user input on a single space, appends `:*` to each token, joins with `&`, and passes verbatim to Postgres `to_tsquery(?)`; user queries with tsquery-meaningful metacharacters (`!`, `|`, `(`, `)`, `<->`, `:`) silently re-interpret or yield syntax-error 500s

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-080.md`

---

## DOC-GAP-081 — Legacy URL `/features/active-platform-features/search` returns 404 — canonical at `/features/data-discovery/search`; 3rd corroborating instance of the legacy-vs-canonical routing-drift cross-cutting pattern (strengthens DOC-GAP-058 META from 2-sidecar to 3-sidecar)

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-081.md`

---

## DOC-GAP-100 — `[[namespace:term]]` description auto-linking syntax is platform-specific, undocumented in operator-facing pages, and triple-confirmed-missing this session

**Severity**: MEDIUM
**Category**: missing-page (no operator-facing dictionary / glossary / business-glossary feature page exists; the description-side auto-linking syntax has no canonical home)

**Full detail**: `detail/DOC-GAP-100.md`

---

## DOC-GAP-101 — Popular ranking signal is undocumented externally — `catalog-overview` describes the surface, no page describes the `view_count DESC`-only mechanism, the inflation surface, or the `EXCLUDE_FROM_SEARCH` bypass

**Severity**: MEDIUM
**Category**: drift (live `catalog-overview` describes the surface but omits the mechanism + the abuse-resistance gap)

**Full detail**: `detail/DOC-GAP-101.md`

---

## DOC-GAP-102 — `getMyObjects` empty-Flux degradation for unlinked users is documented at the wrong layer — `catalog-overview` mentions the Owner-link prerequisite but no page describes what the operator-facing failure mode looks like

**Severity**: MEDIUM
**Category**: drift (the doc names the prerequisite but doesn't surface the consumer-visible failure mode)

**Full detail**: `detail/DOC-GAP-102.md`

---

## DOC-GAP-024 — OpenAPI tag `alert` has no `description:` field and no `externalDocs.url`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-024.md`

---

## DOC-GAP-026 — AlertManager DTO drops `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`; cannot honour `status: resolved`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-026.md`

---

## DOC-GAP-027 — Locale-bundle CSP / localStorage caveat absent on (eventual) i18n doc page

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-027.md`

---

## DOC-GAP-028 — Activity Feed counts endpoint (`/api/activity/counts`) issues 4 parallel aggregation queries per call

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-028.md`

---

## DOC-GAP-031 — `lasEventId` typo on Java controller signature persists into generated client SDKs

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-031.md`

---

## DOC-GAP-044 — Prometheus `tenant_id` label read/write asymmetry on empty-string `odd.tenant-id`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-044.md`

---

## DOC-GAP-065 — DataCollaboration `sending-messages-retry-count: 0` is accepted by `@PostConstruct` validator (`< 0` check is strict) but docs imply minimum is 1 — semantic edge case undocumented

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-065.md`

---

## DOC-GAP-078 — Administrator policy's effective scope on `LOOKUP_TABLE_*` permissions depends on `PolicyPermissionExtractor`'s handling of `'ALL'` on the MANAGEMENT type — unverified whether `'ALL'` expands to every LOOKUP_TABLE_* constant; if not, the seeded Administrator effectively cannot manage lookup tables despite being the platform's full-permissions role

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-078.md`

---

## DOC-GAP-103 — LOGIN_FORM and LDAP both produce `provider=null` in `USER_OWNER_MAPPING` — undocumented cross-mode user-identity bleed during auth-mode migrations

**Severity**: LOW
**Category**: drift (operational migration caveat absent on the Authorization / User-owner-association doc page)

**Full detail**: `detail/DOC-GAP-103.md`

---
