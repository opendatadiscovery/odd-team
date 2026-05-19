---
artefact: doc-gaps
generated_at: "2026-05-19T00:00:00Z"
generated_at_commit: ede5d277
sidecar_count: 55
concepts_yaml_version: 8
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 112
findings_by_severity: { HIGH: 58, MEDIUM: 43, LOW: 11 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 86, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 5 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars: AppInfoController @ auth.type@L18, AuthorizationManagerCondition @ auth.type@L11, CounterTimeSeriesExtractor @ metrics.storage@L20, IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20, ActivityTablePartitionManager @ odd.activity.partition-period@L11). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041 — code never DROPs partitions, doc claims partition-period controls retention). 4 distinct findings on activity-partition subsystem (DOC-GAP-041..043 + DOC-GAP-040 partial covers via cross-ref). Verified WebFetch 2026-05-11 — `enable-security` parent page DOES now state `auth.ingestion.filter.enabled defaults to false`, partial doc coverage; the `/api/appInfo` introspection surface, DISABLED-default of auth.type, LOGIN_FORM-drops-authorization, and tenant-id read/write asymmetry remain undocumented."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: DisabledAuthSecurityConfiguration @ auth.type@L10, LoginFormSecurityConfiguration @ auth.type@L31, OAuthSecurityConfiguration @ auth.type@L71, LDAPSecurityConfiguration @ auth.type@L51, NotificationsProperties config-properties-class). Four auth-mode SecurityConfiguration sidecars deepened the Auth Mode coverage from 'config consumers' to 'wiring sites' — surfacing the blast-radius of DISABLED (CSRF/CORS/actuator/S2S-ignored/audit-absence), 5-vs-7 OAuth2 provider drift with no Okta/Keycloak handlers, missing `azureTenantId` POJO field vs documented YAML, unvalidated Azure `logout-uri`, LDAP scheme silence (ldaps:// not differentiated), `auth.ldap.password` leak via actuator/env, substring-collision admin escalation in LDAP, `auth.login-form-redirect` open-redirect surface, session-cookie security gaps under LOGIN_FORM. Notifications sidecar surfaced dead `webhookUrl` field, no rate-limit, no audit trail, no per-channel filtering, no PII redaction, replication-slot orphan risk, GitBook routing drift (legacy `/active-platform-features/notifications` 404 — joining DOC-GAP-035 in cross-cutting class). New class-level DOC-GAP-058 captures the GitBook legacy-route drift as an audit-recommended pattern, not a single page. NEW HIGH findings: 8 (DOC-GAP-045, DOC-GAP-046, DOC-GAP-048, DOC-GAP-050, DOC-GAP-051, DOC-GAP-053, DOC-GAP-054, DOC-GAP-055). Live URL re-verification 2026-05-12: `disabled-authentication` 200 confirms blast-radius omission verbatim; `oauth2-oidc` 200 verifies 7-provider docs claim; `/active-platform-features/notifications` 404 confirms cross-cutting routing drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars: ODDOAuth2Properties, ODDLDAPProperties, EmailSenderProperties, DataCollaborationProperties, HousekeepingTTLProperties). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings. Cross-cutting refinements: (a) Lombok `@Data` toString sensitive-field leak — 4-sidecar triangulated (ODDLDAPProperties.password + ODDOAuth2Properties.clientSecret + EmailSenderProperties.password + NotificationsProperties); Spring Boot 3.4.10's `management.endpoint.env.show-values: NEVER` DOES sanitise `/actuator/env` (batch-C scope was overbroad); the DURABLE leak surface is Lombok-generated `toString()` if logged. Refines DOC-GAP-006 + DOC-GAP-050 with the precise leak vector. (b) Partial-home pattern — DataCollaborationProperties binds 3 of 7 `datacollaboration.*` keys; EmailSenderProperties does not model `notifications.receivers.email.notification.emails` recipient list; docs that enumerate the prefix don't surface the split. (c) Activity-feed retention claim DOUBLE-CONFIRMED — HousekeepingTTLProperties has no `activity*Days` field; both partition-manager (WIDTH only) AND housekeeping (no activity scope) angles agree the docs claim is wrong (DOC-GAP-041 promoted to multi-angle case). (d) Lock-id collision risk on DataCollab undocumented; partition / notifications.wal / data-collab use four distinct defaults (90/100/110/120) with no validation that operators maintain disjointness. NEW HIGH findings: 7 (DOC-GAP-059, DOC-GAP-061, DOC-GAP-063, DOC-GAP-067, DOC-GAP-069, DOC-GAP-070); plus 1 promoted HIGH on the META Lombok-toString cluster. NEW MEDIUM: 5 (DOC-GAP-060, DOC-GAP-062, DOC-GAP-064, DOC-GAP-066, DOC-GAP-068, DOC-GAP-071). NEW LOW: 1 (DOC-GAP-065). Live URL re-verification 2026-05-12: `/oauth2-oidc` 200 verifies that ODD_IAM provider is COMPLETELY ABSENT from the page (drift in the other direction — POJO supports a provider docs don't name) + `username-attribute` (descriptive prose) vs `user-name-attribute` (every YAML example) inconsistency on the SAME page; `/configuration-and-deployment/odd-platform` 200 verifies housekeeping section frames 'three cleanup tasks' (missing 2 of 5 jobs), acknowledges jOOQ bug verbatim but with no upstream-issue link, fully documents SMTP caveats verbatim; `/features/active-platform-features/data-collaboration` 200 verifies no lock-id collision warning; `/features/active-platform-features/notifications` 200 verifies no rate-limit/audit/PII coverage; `/features/active-platform-features/activity-feed` 200 verifies the retention claim wording verbatim ('retention and partitioning are controlled by `odd.activity.partition-period`'); `/configuration-and-deployment/enable-security/authentication/ldap` 200 verifies no LDAP password actuator caveat, no substring-collision warning, no LDAPS guidance."
  - "2026-05-12 (batch E): DOC-GAP-072..083 — refresh after batch 2026-05-12E (5 method-level RBAC sidecars: RoleController.createRole, PolicyController.createPolicy, OwnerController.createOwner, PermissionController.getResourcePermissions, SearchController.search). 4 new RBAC entity concepts (Policy / Role / Owner / Permission) + 1 new feature concept (Search Session) added to concepts.yaml. Two NEW cross-cutting invariants captured: 'Administrator-name reservation asymmetry on CRUD' (2-sidecar, Role + Policy) and 'No-audit-log on RBAC mutations' (3-sidecar, Role + Policy + Owner); 'Read-collaborative cross-owner enumeration' strengthened from 2-sidecar to 3-sidecar by Search. NEW HIGH findings: 8 (DOC-GAP-072 — Roles API surface undocumented; DOC-GAP-073 — Policies page omits POLICY_CREATE + Administrator-bootstrap + audit + schema endpoint + DISABLED bypass; DOC-GAP-076 — read-side getResourcePermissions endpoint undocumented across 3 live pages; DOC-GAP-079 — Search WHO-can-search + cross-owner enumeration undocumented; DOC-GAP-082 META — DISABLED-bypasses-RBAC-primary-surface 8-sidecar triangulated; DOC-GAP-083 META — No-audit-log on RBAC mutations 3-sidecar triangulated; plus extensions to DOC-GAP-058 and the read-collaborative cluster). NEW MEDIUM findings: 3 (DOC-GAP-074 — OwnerController 201-vs-200 OpenAPI/impl drift confirms class-wide pattern; DOC-GAP-075 — Owners page omits creation mechanics + OWNER_CREATE + audit; DOC-GAP-077 — 4-vs-5 PermissionResourceType enum-vs-doc category drift; DOC-GAP-080 — Search query-syntax/tsquery special-character behaviour undocumented; DOC-GAP-081 — `/features/active-platform-features/search` 404 — third broken-URL instance strengthens DOC-GAP-058). NEW LOW finding: 1 (DOC-GAP-078 — Administrator policy LOOKUP_TABLE coverage unverified). Live URL re-verification 2026-05-12 (batch E): `/authorization/roles` 200 verifies 7 ROLE-creation topics not covered; `/authorization/policies` 200 verifies 7 POLICY-related topics not covered; `/authorization/owners` 200 verifies 6 OWNER-related topics not covered; `/authorization/permissions` 200 verifies 6 PERMISSION-related topics not covered (incl. 5-category doc vs 4-enum-value code shape mismatch); `/authorization` 200 verifies parent page omits DISABLED-vs-authorization relationship, read-side discovery endpoint, audit-logging, and which auth modes wire authorization; `/features/data-discovery/search` 200 verifies WHO/syntax/limits/cross-owner all silent; `/features/active-platform-features/search` 404 confirms third broken-URL instance; `/disabled-authentication` 200 verifies single production warning but no RBAC-bypass explicit narrative. The 5-sidecar batch confirms the RBAC primary surface is the largest single-feature doc-gap cluster — 8 distinct HIGH findings + 3 MEDIUM across 4 live `/authorization/*` pages."
  - "2026-05-12 (batch F): DOC-GAP-084..095 — refresh after batch 2026-05-12F (5 method-level sidecars: DataEntityController.getDataEntityDetails, DataEntityController.createOwnership, DataEntityController.updateStatus, DataEntityController.getDataEntityDownstreamLineage, IngestionController.postDataEntityList). Centerpiece-read coverage of DataEntityController (the platform's most-trafficked endpoint) plus the most-critical ingestion endpoint. NEW HIGH findings: 8 (DOC-GAP-084 — DataEntityDetails read-endpoint posture undocumented; the centerpiece read 4-sidecar triangulates read-collaborative; DOC-GAP-085 — view-count UPDATE inside GET is undocumented; read-replica-defeating side-effect; DOC-GAP-087 — Ownership-create flow + Owner+Title auto-create bypass undocumented across 3 live RBAC pages; DOC-GAP-088 — DataEntityMapperImpl statusUpdatedAt reset bug breaks the 30-day soft-delete TTL silently (LSN-001 shape); strengthens DOC-GAP-041 retention-claim cluster; DOC-GAP-089 — lineage_depth 'Unset returns default' is documented but unimplementable (NPE); DOC-GAP-091 — S2S docs X-API-Key example vs IngestionDataEntitiesFilter Authorization-Bearer drift — operator trap; DOC-GAP-092 — POST /ingestion/entities is doc-orphaned (no canonical operator-facing page; only the S2S sub-page mentions it and with the wrong header); DOC-GAP-094 META — doc-vs-code spelling/format mismatch class 2-sidecar; DOC-GAP-095 META — read-collaborative cross-owner enumeration strengthened from 3-sidecar to 4-sidecar with the centerpiece DataEntityDetails addition; STRONGEST evidence resolving ADR-CANDIDATE-003). NEW MEDIUM findings: 3 (DOC-GAP-086 — DataEntityDetails 34-field code vs 5-field doc coverage; DOC-GAP-090 — expanded_entity_ids documented as Data Entity Group-only but code accepts any IDs; DOC-GAP-093 — IngestionController postDataEntityList 201-vs-200 strengthens DOC-GAP-074 from 3- to 4-instance class-wide pattern). STRENGTHENED existing findings: DOC-GAP-009 + DOC-GAP-021 + DOC-GAP-041 + DOC-GAP-058 + DOC-GAP-074 + DOC-GAP-082 + DOC-GAP-083."
  - "2026-05-13 (batch G): DOC-GAP-096..103 — refresh after batch 2026-05-13-G (5 DataEntityController method-level sidecars: addDataEntityTerm, upsertDataEntityInternalDescription, createDataEntityTagsRelations, getMyObjects, getPopular). NEW HIGH findings: 4 (DOC-GAP-096 — Markdown rendering pipeline rehype-raw without rehype-sanitize stored-XSS surface entirely undocumented; DOC-GAP-097 — 'upsert' description misleading; pure UPDATE with silent no-op on missing entity; DOC-GAP-098 — createDataEntityTagsRelations replace-all-vs-create operationId drift; DOC-GAP-099 — getMyObjectsWithUpstream/Downstream OpenAPI summary describes wrong semantic). NEW MEDIUM findings: 3 (DOC-GAP-100 — [[ns:term]] description syntax undocumented; DOC-GAP-101 — Popular ranking signal + inflation surface undocumented; DOC-GAP-102 — getMyObjects empty-Flux UX trap). NEW LOW finding: 1 (DOC-GAP-103 — LOGIN_FORM+LDAP both produce provider=null cross-mode user-identity bleed). STRENGTHENED existing findings: DOC-GAP-001 + DOC-GAP-009 + DOC-GAP-053 + DOC-GAP-077."
  - "2026-05-19 (batch H): DOC-GAP-104..112 — refresh after batch 2026-05-19-H (5 repository-layer sidecars: ReactiveDataEntityRepositoryImpl, ReactiveLineageRepositoryImpl, ReactiveOwnershipRepositoryImpl, ReactivePolicyRepositoryImpl, ReactiveAlertRepositoryImpl). FIRST batch of repository-layer (SQL primary source) coverage in the catalog. NEW HIGH findings: 5 (DOC-GAP-104 — SQL-injection in `getHighlightedResult` raw `String.formatted` + `DSL.field(raw_sql)`, user-controllable inputs include internal_description/internal_name/tags + search query, FIRST SQL-injection-class finding in the catalog; DOC-GAP-105 — Lineage recursive-CTE has NO cycle guard / NO upper bound on depth / NO owner JOIN — 4-angle confirmed at SQL primary source, supersedes DOC-GAP-021 framing with primary-source evidence; DOC-GAP-106 — `getRolesPolicies` does NOT filter soft-deleted policies on the RBAC authorization hot path — direct-DB soft-delete produces ghost-permission policies that silently keep granting access; DOC-GAP-107 — AlertManager webhook `POST /ingestion/alert/alertmanager` bypasses IngestionDataEntitiesFilter AND `createAlerts` has NO ON CONFLICT — operator-trap webhook with 3 vectors strengthens DOC-GAP-003 + DOC-GAP-038; DOC-GAP-108 — CROSS-BATCH CORRECTION: batch-F createOwnership sidecar's '5xx on duplicate' misclaim → actual is HTTP 400/USR003 (UniqueConstraint) with friendly message 'Ownership for this data entity and owner already exists' — verified end-to-end through ExceptionUtils + JooqReactiveOperations + ControllerAdvice + ErrorCode; substrate-level correction needed). NEW MEDIUM findings: 3 (DOC-GAP-109 — Alert listByOwner empty-result total uses platform-wide count instead of countAlertsWithStatusOpenByOwner — UX correctness bug, one-line fix; DOC-GAP-110 — Alert reopen-conflict guard is read-then-write without FOR UPDATE / partial unique index — concurrent reopens can both pass EXISTS check; DOC-GAP-112 — Policy soft-delete + partial unique index `policy_name_unique WHERE deleted_at IS NULL` + create-path missing Administrator-name protection = compound risk under direct-DB; companion to DOC-GAP-106 + strengthens DOC-GAP-073). NEW LOW finding: 1 (DOC-GAP-111 — Ownership is HARD-delete at SQL layer, undocumented in Permissions and Owners pages; recovery via activity-feed audit trail dependency). STRENGTHENED existing findings: DOC-GAP-021 + DOC-GAP-099 + DOC-GAP-101 + DOC-GAP-082 (now 13-sidecar) + DOC-GAP-083 (4th layer = repository-layer forensic silence) + DOC-GAP-003 + DOC-GAP-038 + DOC-GAP-073 (now 7-sub-finding). WebFetch DENIED in current session — all live-URL state inherited from neighbour sidecars verified 2026-05-08 (status 200 — `/configuration-and-deployment/odd-platform`), 2026-05-10 (status 200 — `/features/active-platform-features/alerting`), 2026-05-12 (status 200 — `/authorization/{policies,permissions,owners,roles}`, `/features/data-lineage`, `/developer-guides/api-reference/lineage`, `/features/data-discovery/catalog-overview`, `/configuration-and-deployment/odd-platform#housekeeping`, `/disabled-authentication`), 2026-05-13 (status 200 — `/features/data-discovery/search`, `/features/data-discovery/catalog-overview`). Verification recency MEDIUM per the dynamic-verification stale-probe cadence; no live-URL claim in batch H is more than 11 days stale; re-verification deferred to next WebFetch-enabled session."
---

# Doc gaps — odd-platform — 2026-05-19 (batch H refresh)

## Summary

- **Findings**: 112 total (58 HIGH, 43 MEDIUM, 11 LOW)
- **By category**: broken-url 9, drift 86, missing-page 8, coverage-gap 4, meta 5
- **By feature** (top affected concepts): Auth Mode (15), Data Entity (12 — batch H adds repository-layer SQL primary-source: SQL-injection in `getHighlightedResult`), RBAC primary surface (Policy / Role / Owner / Permission) (10 — batch H adds repository-layer SQL: getRolesPolicies returns soft-deleted policies + Policy compound risk + Ownership hard-delete + duplicate-ownership 400 USR003), Lineage (3 — batch H adds the canonical SQL-layer primary-source finding for cycle / depth / owner — DOC-GAP-105 supersedes DOC-GAP-021), Notifications (8), Ingestion (3 — strengthens DOC-GAP-038 with AlertManager-not-filter-matched repository-layer confirmation), Search (3), Activity Feed (5), Attachment (5), Housekeeping TTL (4), DataCollaboration (4), Alert (6 — batch H adds reopen-race + listByOwner-empty-counter + AlertManager-no-ON-CONFLICT), AlertManager Webhook Receiver (4 — DOC-GAP-107 compound), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4), Multi-Tenant Configuration / Metrics Ingestion (1), Collector / Collector Token (2), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). 38 HIGH findings are LSN-001/LSN-002-class operator-impact gaps. **Batch H adds one CROSS-BATCH CORRECTION (DOC-GAP-108 — 5xx misclaim → 400 USR003) AND strengthens 8 existing findings with REPOSITORY-LAYER SQL primary-source evidence** — the first batch to anchor findings on `Reactive*RepositoryImpl` SQL bodies rather than controller-method behaviour. Key strengtheners:
  - (n) **NEW batch H: DOC-GAP-082 META extends to 13-sidecar** — the 5 batch-H repository sidecars confirm the DISABLED-bypass blast radius extends to the SQL primary source on the read-and-write paths (DataEntity / Lineage / Policy / Alert / Ownership repositories all anonymously reachable under DISABLED). Doc-side action remains the single `/disabled-authentication.md` "Blast radius" section.
  - (o) **NEW batch H: DOC-GAP-083 META adds 4th-layer confirmation** — the `ReactivePolicyRepositoryImpl` SQL primary source emits NO log lines on any mutation; the forensic silence the META centers on is now confirmed at controller + service + repository layers. The partial-exception evidence from `ReactiveOwnershipRepositoryImpl` (ownership-edge mutations DO carry `@ActivityLog` at the service) confirms the maintainer-design intent that 'ownership-binding is audit-worthy, owner-directory CRUD is not' — extends the META's recommendation to "extend the OwnershipServiceImpl pattern to PolicyServiceImpl / RoleServiceImpl / OwnerServiceImpl".
  - (p) **NEW batch H: DOC-GAP-105 supersedes DOC-GAP-021 with SQL primary-source** — the lineage recursive-CTE has NO cycle guard, NO depth ceiling, NO owner JOIN at the `WITH RECURSIVE` body; combined with the controller-layer NPE on `lineage_depth: "Unset returns default"` (DOC-GAP-089) and the inverse-semantic OpenAPI summary on `getMyObjectsWithUpstream/Downstream` (DOC-GAP-099), the lineage feature is the second-largest single-feature gap-cluster behind RBAC. Doc-side proposal: three admonitions on `features/data-lineage.md` (Depth and bounds / Cycle handling / Visibility scope) + API-ref correction on `lineage_depth` and `expanded_entity_ids`.
  - (q) **NEW batch H: CROSS-BATCH CORRECTION (DOC-GAP-108)** — the batch-F `createOwnership.md:bugs_limitations_corner_cases.[2]` claim "5xx on duplicate" is wrong; the verified path is jOOQ DataAccessException → ExceptionUtils.translateDatabaseException (SQLStateClass.C23) → UniqueConstraintException with `ErrorCode.UNIQUE_CONSTRAINT(USR003, resolvable=true, retryable=false)` → ControllerAdvice.handleUniqueConstraint → HTTP 400 + friendly message "Ownership for this data entity and owner already exists". The misclaim is in the cached substrate; concept-merger reducer should propagate this correction. OpenAPI + Permissions live page + Owners live page do NOT declare the 400/USR003 response — adjacent doc-side gap.
  - (r) **NEW batch H: DOC-GAP-106 (HIGH) closes the AUTHORIZATION HOT PATH soft-delete leak** — `ReactivePolicyRepositoryImpl.getRolesPolicies` is invoked on every authorized HTTP request via `ManagementPermissionExtractor` + `AbstractContextualPermissionExtractor`; the JOIN at `:32-38` has NO `policy.deleted_at IS NULL` predicate. Combined with the absence of FK cascade on `role_to_policy.policy_id`, a soft-deleted policy with surviving role bindings continues to grant permissions to users in those roles. The today-state defence at `PolicyServiceImpl.java:89-92` (cascade-delete check) holds only for the documented API flow; direct-DB or future-refactor bypass produces ghost-permission policies. Single-line code-side fix; doc-side admonition pairs with DOC-GAP-073.
  - (s) **NEW batch H: First SQL-injection finding in the catalog (DOC-GAP-104)** — `ReactiveDataEntityRepositoryImpl.getHighlightedResult` at lines 799-806 builds raw SQL via `String.formatted(text, tsQuery)` then passes to `DSL.field(sql, ...)`. Both arguments flow from user-controllable surfaces (`internal_description` via `upsertDataEntityInternalDescription`, search query via `JooqFTSHelper.tsQuery` which only appends `:*` per token without escaping). The writer gate is `DATA_ENTITY_DESCRIPTION_UPDATE` (typically broad on Owner roles); the reader gate is `DATA_ENTITY_VIEW` (default for any authenticated user). Under `auth.type=DISABLED` both gates are bypassed.

Batch F-and-prior meta-recommendations (preserved):
  - (i) **batch F: Read-collaborative cross-owner enumeration — 4-sidecar (DOC-GAP-095 META)** — DataEntityDetails + getAllAlerts + getActivity + SearchController.search.
  - (j) **batch F: Doc-vs-code spelling/format mismatch — 2-sidecar (DOC-GAP-094 META)** — `username-attribute` vs `user-name-attribute` + `X-API-Key` vs `Authorization: Bearer`.
  - (k) **batch F: Activity-feed retention claim — 3-angle confirmed (DOC-GAP-041)** — partition-manager + HousekeepingTTLProperties + statusUpdatedAt reset bug.
  - (l) **batch F: DISABLED-bypasses-everything (DOC-GAP-082 META extended to 13-sidecar in batch H — see (n) above)**.
  - (m) **batch F: OpenAPI 201-vs-200 drift (DOC-GAP-074) — 4-instance class-wide pattern** — Owner + Role + Policy + postDataEntityList.

Batch E-and-prior meta-recommendations (preserved):
  - (e) **batch E: DISABLED-bypasses-RBAC-primary-surface (DOC-GAP-082 META)** — extended in batches F and H.
  - (f) **batch E: No-audit-log on RBAC mutations (DOC-GAP-083 META)** — extended in batch H with repository-layer evidence.
  - (g) **batch E: Read-collaborative cross-owner enumeration — 3-sidecar** — extended to 4-sidecar in batch F.
  - (h) **batch E: GitBook legacy-vs-canonical routing drift — 3-sidecar (DOC-GAP-058)**.

Batch D-and-prior meta-recommendations (preserved):
  - (a) **GitBook legacy-vs-canonical routing drift (DOC-GAP-058)**.
  - (b) **"Docs frame default behaviour but omit blast radius" (DOC-GAP-053)** — 4-sidecar triangulation.
  - (c) **Lombok `@Data` toString sensitive-field leak (DOC-GAP-067)** — 4-sidecar triangulation.
  - (d) **Partial-home pattern (DOC-GAP-068)** — 2-sidecar triangulation.
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface.
  - **Doc-text-vs-code audience drift** (2026-05-10A): the live alerting doc names "stewards and admins" while code enforces "any authenticated user."
  - **Triangulated default-open posture** (2026-05-10B): four config-key-consumer sidecars + four `*SecurityConfiguration` sidecars now converge on the same operator-trap shape — DISABLED-default of `auth.type` + FALSE-default of `auth.ingestion.filter.enabled` + no fail-fast on misconfigured `auth.type` + no boot WARN under DISABLED + actuator/env reachable under DISABLED. Per LSN-001 + LSN-002 case-law, this is the canonical insecure-default failure mode the ontology was built to surface.
  - **Documentation-overstates-config-effect** (2026-05-10B + 2026-05-12D): activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code has NO row-by-age retention path (partition manager controls WIDTH only; housekeeping has no `activity*Days` field). **3-angle triangulated since batch F**.
  - **GitBook legacy-route 404 cluster**: `/active-platform-features/notifications` joins `/active-platform-features/data-collaboration`, both 404 with redirect-suggestion stubs; the canonical `/features/active-platform-features/*` paths serve 200.
  - **Auth-mode-wiring-site blast-radius gap (2026-05-12C)** — the dedicated sub-pages (`disabled-authentication`, `login-form`, `oauth2-oidc`, `ldap`) document the happy-path config but consistently omit security-relevant operational consequences.
  - **Notifications subsystem under-documented for operations (2026-05-12C + D)** — rate-limit / audit / per-channel filtering / PII redaction / replication-slot orphan risk / dead `webhookUrl` / email completeness all silent.
  - **2026-05-12D: Housekeeping subsystem doc completeness** — "three cleanup tasks" framing vs 5 HousekeepingJob beans; 30-day default lives only in bundled application.yml.
  - **2026-05-12D: OAuth2 docs internal inconsistency** — `username-attribute` vs `user-name-attribute` + ODD_IAM absent + adminUserInfoFlag undocumented.
  - **NEW 2026-05-19 batch H: Repository-layer SQL primary-source confirms 8 existing findings AND surfaces 5 new HIGH** — for the first time the catalog is anchored on the SQL bodies, not the controller methods. The pattern is: controller layer carries the API surface, service layer carries business invariants, repository layer carries the SQL truth — when the three layers disagree, the truth is at the repository. Batch H confirms DOC-GAP-082 (13-sidecar), DOC-GAP-083 (4-layer), DOC-GAP-101 (EXCLUDE_FROM_SEARCH inconsistency at 9 list-shape methods), DOC-GAP-021 (no depth cap / cycle / owner), and DOC-GAP-099 (anchor-set defence-in-depth pattern visible at SQL).
  - **NEW 2026-05-19 batch H: First SQL-injection in the catalog** — DOC-GAP-104 is the catalog's first SQL-injection-class finding. The code-side fix is a single function-call rewrite; the doc-side interim mitigation is a single admonition. Code-side action is REFACTOR-201/222 class.
  - **NEW 2026-05-19 batch H: First cross-batch correction propagated** — DOC-GAP-108 surfaces a verified-wrong claim in the cached substrate (batch-F createOwnership.md said 5xx on duplicate; actual is 400 USR003 with friendly message). The substrate correction protocol is now established for future batches to follow.

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 100

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

## DOC-GAP-073 — Policies live doc page omits POLICY_CREATE permission, Administrator-bootstrap, audit-trail absence, `GET /api/policies/schema` endpoint, and DISABLED-mode bypass (keys-to-the-kingdom under DISABLED — 5 doc-drift findings) **(batch H STRENGTHENS to 7 sub-findings via DOC-GAP-106 + DOC-GAP-112)**

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

## DOC-GAP-082 — **META-FINDING** — DISABLED-bypasses-RBAC-primary-surface pattern **(now 13-sidecar triangulation, batch H STRENGTHENS from 8 to 13 with 5 repository-layer sidecars confirming the SQL primary source on read-and-write paths)**

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — **META-FINDING** — No-audit-log on RBAC mutations pattern **(batch H STRENGTHENS with repository-layer forensic-silence confirmation + ownership-edge partial-exception evidence)**

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

## DOC-GAP-099 — `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` OpenAPI summary literally describes the wrong semantic — claims response is owned-with-lineage; actual response is NON-owned entities reachable from owned set **(batch H STRENGTHENS with SQL primary-source confirmation of anchor-set defence-in-depth pattern)**

**Severity**: HIGH
**Category**: drift (OpenAPI contract drift; spec summary is the inverse of implementation)

**Full detail**: `detail/DOC-GAP-099.md`

---

## DOC-GAP-104 — SQL-injection vector in `ReactiveDataEntityRepositoryImpl.getHighlightedResult` — `String.formatted(text, tsQuery)` interpolates user-controllable `internal_description` / `internal_name` / tags + search query into raw SQL passed to `DSL.field(sql, ...)`; no escaping, no parameterisation, no length cap — first SQL-injection-class finding in the catalog

**Severity**: HIGH
**Category**: drift (security caveat absent on doc pages covering the affected writer + reader surfaces)

**Full detail**: `detail/DOC-GAP-104.md`

---

## DOC-GAP-105 — Lineage recursive-CTE at the SQL primary source has NO cycle guard, NO upper bound on `lineageDepth`, NO owner JOIN — supersedes DOC-GAP-021 framing with primary-source evidence; combined with controller-layer NPE on null default (DOC-GAP-089) + inverse-semantic OpenAPI summary (DOC-GAP-099), 4-angle confirmed

**Severity**: HIGH
**Category**: drift (live `/features/data-lineage` silent on depth/cycle/owner; api-ref's "Unset returns default" is unimplementable)

**Full detail**: `detail/DOC-GAP-105.md`

---

## DOC-GAP-106 — `ReactivePolicyRepositoryImpl.getRolesPolicies` does NOT filter soft-deleted policies on the RBAC authorization hot path — direct-DB soft-delete produces ghost-permission policies that silently keep granting access; single-line `AND policy.deleted_at IS NULL` fix closes structurally

**Severity**: HIGH
**Category**: drift (live `/authorization/policies` silent on soft-delete semantics + ghost-binding risk + direct-DB caveat; partial-index design + cascade-FK-absence undocumented)

**Full detail**: `detail/DOC-GAP-106.md`

---

## DOC-GAP-107 — AlertManager webhook `POST /ingestion/alert/alertmanager` bypasses `IngestionDataEntitiesFilter` (filter only matches `/ingestion/entities`) AND `ReactiveAlertRepositoryImpl.createAlerts` has NO `ON CONFLICT` — combined: unauthenticated caller can POST AlertManager-shaped payloads with attacker-chosen `entity_oddrn` AND no de-duplication on retry; strengthens DOC-GAP-003 + DOC-GAP-038

**Severity**: HIGH
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` warns generically about "no application-layer auth" but does not enumerate the 3 specific vectors)

**Full detail**: `detail/DOC-GAP-107.md`

---

## DOC-GAP-108 — CROSS-BATCH CORRECTION — batch-F `createOwnership` sidecar's "5xx on duplicate" claim is WRONG; actual surface is HTTP 400 with `USR003` (`UniqueConstraint`) and friendly message "Ownership for this data entity and owner already exists" — AND this error shape is undocumented in OpenAPI, in the permissions live page, and in the owners live page

**Severity**: HIGH
**Category**: drift (substrate misclaim correction + class-wide OpenAPI 400-USR003 undeclared on every create endpoint with a UNIQUE constraint translation)

**Full detail**: `detail/DOC-GAP-108.md`

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

## DOC-GAP-021 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat **(batch H: superseded by DOC-GAP-105 with SQL primary-source; cross-referenced here)**

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

## DOC-GAP-101 — Popular ranking signal is undocumented externally — `catalog-overview` describes the surface, no page describes the `view_count DESC`-only mechanism, the inflation surface, or the `EXCLUDE_FROM_SEARCH` bypass **(batch H STRENGTHENS with SQL primary-source confirmation of EXCLUDE_FROM_SEARCH inconsistency at 9 list-shape methods)**

**Severity**: MEDIUM
**Category**: drift (live `catalog-overview` describes the surface but omits the mechanism + the abuse-resistance gap)

**Full detail**: `detail/DOC-GAP-101.md`

---

## DOC-GAP-102 — `getMyObjects` empty-Flux degradation for unlinked users is documented at the wrong layer — `catalog-overview` mentions the Owner-link prerequisite but no page describes what the operator-facing failure mode looks like

**Severity**: MEDIUM
**Category**: drift (the doc names the prerequisite but doesn't surface the consumer-visible failure mode)

**Full detail**: `detail/DOC-GAP-102.md`

---

## DOC-GAP-109 — Alert `listByOwner` empty-result total uses platform-wide count (`countAlertsWithStatusOpen`) instead of owner-scoped count (`countAlertsWithStatusOpenByOwner`) — when caller has zero owned alerts, the UI's pagination badge / "X total" indicator displays a non-zero number while the visible list is empty; single-line SQL method swap fix

**Severity**: MEDIUM
**Category**: drift (UX correctness; latent regression; no live-doc claim to drift against — primary-source SQL bug)

**Full detail**: `detail/DOC-GAP-109.md`

---

## DOC-GAP-110 — Alert reopen-conflict guard `openAlertWithTheSameTypeExistsForDataEntity` is read-then-write without `SELECT FOR UPDATE` or DB-side `UNIQUE(data_entity_oddrn, type) WHERE status = OPEN` partial-index — two concurrent reopens can both pass the EXISTS check and both proceed to UPDATE, briefly violating the "one OPEN of the same type per data entity" invariant

**Severity**: MEDIUM
**Category**: drift (live alerting page does not describe the reopen-conflict semantic; the platform invariant has no SQL-level backstop)

**Full detail**: `detail/DOC-GAP-110.md`

---

## DOC-GAP-112 — Policy soft-delete + partial unique index `policy_name_unique ON policy(name) WHERE deleted_at IS NULL` + `PolicyServiceImpl.create` missing Administrator-name protection = compound risk under direct-DB; companion to DOC-GAP-106 + strengthens DOC-GAP-073 with the 7th sub-finding

**Severity**: MEDIUM
**Category**: drift (live `/authorization/policies` silent on the partial-index mechanism that enables Administrator-name re-creation via create-path asymmetry)

**Full detail**: `detail/DOC-GAP-112.md`

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

## DOC-GAP-111 — Ownership is HARD-DELETE at the SQL layer — no `deleted_at` column on the `ownership` table; recovery depends on the activity-feed audit trail being intact; the irreversibility is not surfaced on the Permissions / Owners live pages

**Severity**: LOW
**Category**: drift (operator-facing caveat absent; sibling resources Policy/Role/Owner are soft-delete, ownership is hard-delete — the asymmetry is undocumented)

**Full detail**: `detail/DOC-GAP-111.md`

---
