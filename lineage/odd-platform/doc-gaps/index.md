---
artefact: doc-gaps
generated_at: "2026-05-19T00:00:00Z"
generated_at_commit: ede5d277
sidecar_count: 60
concepts_yaml_version: 8
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 127
findings_by_severity: { HIGH: 63, MEDIUM: 51, LOW: 13 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 100, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 6 }
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars: AppInfoController @ auth.type@L18, AuthorizationManagerCondition @ auth.type@L11, CounterTimeSeriesExtractor @ metrics.storage@L20, IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20, ActivityTablePartitionManager @ odd.activity.partition-period@L11). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041 — code never DROPs partitions, doc claims partition-period controls retention). 4 distinct findings on activity-partition subsystem (DOC-GAP-041..043 + DOC-GAP-040 partial covers via cross-ref). Verified WebFetch 2026-05-11 — `enable-security` parent page DOES now state `auth.ingestion.filter.enabled defaults to false`, partial doc coverage; the `/api/appInfo` introspection surface, DISABLED-default of auth.type, LOGIN_FORM-drops-authorization, and tenant-id read/write asymmetry remain undocumented."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: DisabledAuthSecurityConfiguration @ auth.type@L10, LoginFormSecurityConfiguration @ auth.type@L31, OAuthSecurityConfiguration @ auth.type@L71, LDAPSecurityConfiguration @ auth.type@L51, NotificationsProperties config-properties-class). Four auth-mode SecurityConfiguration sidecars deepened the Auth Mode coverage from 'config consumers' to 'wiring sites' — surfacing the blast-radius of DISABLED (CSRF/CORS/actuator/S2S-ignored/audit-absence), 5-vs-7 OAuth2 provider drift with no Okta/Keycloak handlers, missing `azureTenantId` POJO field vs documented YAML, unvalidated Azure `logout-uri`, LDAP scheme silence (ldaps:// not differentiated), `auth.ldap.password` leak via actuator/env, substring-collision admin escalation in LDAP, `auth.login-form-redirect` open-redirect surface, session-cookie security gaps under LOGIN_FORM. Notifications sidecar surfaced dead `webhookUrl` field, no rate-limit, no audit trail, no per-channel filtering, no PII redaction, replication-slot orphan risk, GitBook routing drift (legacy `/active-platform-features/notifications` 404 — joining DOC-GAP-035 in cross-cutting class). New class-level DOC-GAP-058 captures the GitBook legacy-route drift as an audit-recommended pattern, not a single page. NEW HIGH findings: 8 (DOC-GAP-045, DOC-GAP-046, DOC-GAP-048, DOC-GAP-050, DOC-GAP-051, DOC-GAP-053, DOC-GAP-054, DOC-GAP-055). Live URL re-verification 2026-05-12: `disabled-authentication` 200 confirms blast-radius omission verbatim; `oauth2-oidc` 200 verifies 7-provider docs claim; `/active-platform-features/notifications` 404 confirms cross-cutting routing drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars: ODDOAuth2Properties, ODDLDAPProperties, EmailSenderProperties, DataCollaborationProperties, HousekeepingTTLProperties). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings."
  - "2026-05-12 (batch E): DOC-GAP-072..083 — refresh after batch 2026-05-12E (5 method-level RBAC sidecars: RoleController.createRole, PolicyController.createPolicy, OwnerController.createOwner, PermissionController.getResourcePermissions, SearchController.search). 4 new RBAC entity concepts (Policy / Role / Owner / Permission) + 1 new feature concept (Search Session) added to concepts.yaml."
  - "2026-05-12 (batch F): DOC-GAP-084..095 — refresh after batch 2026-05-12F (5 method-level sidecars: DataEntityController.getDataEntityDetails, DataEntityController.createOwnership, DataEntityController.updateStatus, DataEntityController.getDataEntityDownstreamLineage, IngestionController.postDataEntityList). Centerpiece-read coverage of DataEntityController (the platform's most-trafficked endpoint) plus the most-critical ingestion endpoint."
  - "2026-05-13 (batch G): DOC-GAP-096..103 — refresh after batch 2026-05-13-G (5 DataEntityController method-level sidecars: addDataEntityTerm, upsertDataEntityInternalDescription, createDataEntityTagsRelations, getMyObjects, getPopular)."
  - "2026-05-19 (batch H): DOC-GAP-104..112 — refresh after batch 2026-05-19-H (5 repository-layer sidecars: ReactiveDataEntityRepositoryImpl, ReactiveLineageRepositoryImpl, ReactiveOwnershipRepositoryImpl, ReactivePolicyRepositoryImpl, ReactiveAlertRepositoryImpl). FIRST batch of repository-layer (SQL primary source) coverage in the catalog. NEW HIGH findings: 5 (DOC-GAP-104..107 + DOC-GAP-108 cross-batch correction); NEW MEDIUM: 3 (DOC-GAP-109, DOC-GAP-110, DOC-GAP-112); NEW LOW: 1 (DOC-GAP-111). STRENGTHENED existing findings: DOC-GAP-021 + DOC-GAP-099 + DOC-GAP-101 + DOC-GAP-082 (now 13-sidecar) + DOC-GAP-083 (4th layer = repository-layer forensic silence) + DOC-GAP-003 + DOC-GAP-038 + DOC-GAP-073 (now 7-sub-finding). WebFetch DENIED in current session — live-URL state inherited from neighbour sidecars verified 2026-05-08 through 2026-05-13 at status 200."
  - "2026-05-19 (batch I): DOC-GAP-113..127 — refresh after batch 2026-05-19-I (5 service-layer sidecars: AlertServiceImpl, DataEntityServiceImpl, IngestionService, PolicyServiceImpl, LineageServiceImpl). FIRST batch of service-layer (business-invariant primary source) coverage in the catalog. NEW HIGH findings: 5 (DOC-GAP-113 — IngestionService silent metadata-delete-on-absence — LSN-001-shape; DOC-GAP-114 — IngestionService silent lineage-edge-delete-on-absence — LSN-001-shape sibling; DOC-GAP-115 — Lineage service-layer anchor-set defence asymmetry — positive case at DataEntityRelationsServiceImpl vs negative case at LineageServiceImpl, confirms REFACTOR-203 at service-layer; DOC-GAP-116 META — Service-tier `@ReactiveTransactional` boundary pattern undocumented platform-wide ADR; DOC-GAP-117 — AlertManager webhook generatorURL XSS via UI markdown render). NEW MEDIUM findings: 8 (DOC-GAP-118 — soft-delete silent restore on re-ingestion; DOC-GAP-119 — MICROSERVICE specific-attributes alert exclusion silent; DOC-GAP-120 — all-or-nothing batch rollback / 5xx-no-body-shape; DOC-GAP-121 — ingestion-driven UPDATEs not audit-logged; DOC-GAP-122 — PolicyService lost-update race on PUT — non-transactional read-then-write asymmetry vs RoleService; DOC-GAP-123 — PolicyService schema-validation 500-not-400 via IllegalArgumentException; DOC-GAP-124 — Lineage inner-DEG suppression undocumented deferred-feature; DOC-GAP-125 — AlertManager webhook LocalDateTime timezone-naive startsAt). NEW LOW findings: 2 (DOC-GAP-126 — PolicyService non-admin list ignores pagination; DOC-GAP-127 — LineageService self-invocation @ReactiveTransactional Spring-proxy bypass undocumented). STRENGTHENED existing findings: DOC-GAP-097 (silent-UPDATE-on-missing extends to upsertBusinessName at service tier) + DOC-GAP-105 (5-angle confirmed with service-layer null-NPE + no-clamp + heap-amplification) + DOC-GAP-107 (5-vector compound — adds XSS surface as 4th and LocalDateTime as 5th) + DOC-GAP-110 (3-layer triangulation; maintainer-intent captured as deliberate trade-off) + DOC-GAP-083 META (4-layer for PolicyServiceImpl forensic silence; maintainer-intent ownership-binding-vs-directory-CRUD asymmetry confirmed) + DOC-GAP-073 (8th sub-finding: concurrency model + pagination asymmetry). WebFetch DENIED in current session — live-URL state inherited from neighbour sidecars verified 2026-05-08 through 2026-05-13 at status 200; verification recency MEDIUM per stale-probe cadence; no live-URL claim more than 11 days stale; re-verification deferred to next WebFetch-enabled session."
---

# Doc gaps — odd-platform — 2026-05-19 (batch I refresh)

## Summary

- **Findings**: 127 total (63 HIGH, 51 MEDIUM, 13 LOW)
- **By category**: broken-url 9, drift 100, missing-page 8, coverage-gap 4, meta 6
- **By feature** (top affected concepts): Auth Mode (15), Data Entity (13 — batch I adds service-tier silent-UPDATE on upsertBusinessName via DOC-GAP-097 strengthen; service-tier transaction-boundary META via DOC-GAP-116), RBAC primary surface (Policy / Role / Owner / Permission) (12 — batch I adds Policy lost-update race + schema-validation 500-not-400 + non-admin list pagination asymmetry), Lineage (5 — batch I adds anchor-set defence asymmetry at service layer + inner-DEG suppression undocumented + self-invocation @ReactiveTransactional caveat), Ingestion (8 — batch I adds 5 NEW: silent metadata-delete + silent lineage-edge-delete + soft-delete silent restore + MICROSERVICE exclusion + all-or-nothing batch + ingestion-driven-UPDATEs not audit-logged), Notifications (8), Search (3), Activity Feed (5), Attachment (5), Housekeeping TTL (4), DataCollaboration (4), Alert (7 — batch I adds AlertManager webhook 4th/5th vectors: generatorURL XSS + LocalDateTime), AlertManager Webhook Receiver (5 — DOC-GAP-107 now 5-vector compound), GenAI Assistant (3), Slack collaboration app (3), Activity Table Partitioning (4), Multi-Tenant Configuration / Metrics Ingestion (1), Collector / Collector Token (2), Directory (2), Multilingual UI (1)
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). **Batch I adds 15 NEW findings (5 HIGH + 8 MEDIUM + 2 LOW) AND strengthens 6 existing findings with SERVICE-LAYER business-invariant primary-source evidence** — the first batch to anchor findings on `*ServiceImpl` business logic rather than controller method behaviour or repository SQL. Key new findings + strengtheners:
  - (t) **NEW batch I: DOC-GAP-113 + DOC-GAP-114 — Ingestion silent destruction LSN-001 family** — `IngestionService` is `@ReactiveTransactional` (single top-level transaction wrapping 14-processor chain); `MetadataIngestionRequestProcessor.process` issues `difference + delete` on omitted metadata; `LineageServiceImpl.replaceLineagePaths` does delete-then-insert on omitted edges. Neither path emits a log.warn on the delete branch; neither emits an activity-feed event; the OpenAPI contract documents the request shape with NO indication of replace-not-merge semantics. A collector that emits incomplete metadata or lineage on ANY tick silently destroys platform-side data with no operator visibility. Two HIGH-severity findings on the same underlying maintainer-design contract (implicit_adrs.[4]: replace-not-merge is INTENTIONAL).
  - (u) **NEW batch I: DOC-GAP-115 — Lineage anchor-set asymmetry positive vs negative case** — `LineageServiceImpl.getLineage` has NO `AuthIdentityProvider` field, NO `fetchAssociatedOwner` call, NO owner check anywhere; `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns` DOES call `fetchAssociatedOwner()` and uses the owner's entity-oddrn set as the seed. The two services live one directory apart in the same package, encode opposite security postures on the SAME underlying repository (ReactiveLineageRepositoryImpl), and produce features that operators may reasonably treat as equivalent. The platform's marquee F-005 lineage-canvas is the cross-owner enumeration sink; the seemingly-equivalent "My objects with lineage" feature is owner-scoped.
  - (v) **NEW batch I: DOC-GAP-116 META — Service-tier transaction-boundary pattern is undocumented platform-wide ADR** — every `*ServiceImpl` places `@ReactiveTransactional` at the service tier; every `Reactive*RepositoryImpl` carries NO annotation. The pattern is the platform's most consequential architectural decision and is entirely undocumented operator-facing. The within-service ASYMMETRIES (RoleServiceImpl IS transactional; PolicyServiceImpl is NOT; DataEntityServiceImpl.updateStatus delegates to a downstream-annotated method; AlertServiceImpl.updateStatus relies on @ActivityLog AOP's synthetic transaction) are also undocumented; operators reasonably assume uniform discipline and are wrong. Single highest-leverage developer-guide-page addition the platform can ship.
  - (w) **NEW batch I: DOC-GAP-117 — AlertManager webhook XSS via UI markdown render** — `AlertServiceImpl.handleExternalAlerts` embeds the AlertManager-supplied `generatorURL` verbatim into the chunk description via `String.format("Distribution Anomaly. URL: %s", queryUrl)`. The URL is parsed by `UriComponentsBuilder.fromUri` which does NOT block `javascript:` / `data:` schemes. Combined with DOC-GAP-096 (UI's `rehype-raw` without `rehype-sanitize`) AND DOC-GAP-038 (unauthenticated webhook), this is a wire-XSS chain: ANY network-reachable caller plants the payload; the UI renders it as innerHTML/markdown-via-rehype-raw; the XSS executes in any platform user's session that views the alert. Fourth attack vector on DOC-GAP-107's compound finding (5-vector now with DOC-GAP-125's LocalDateTime).
  - (x) **NEW batch I: DOC-GAP-105 strengthens to 5-angle** — the service-layer sidecar confirms the null-NPE at the controller→service boundary, the no-clamp on lineageDepth, AND the diamond-DAG amplification composition (`.distinct().collectList()` on top of the recursive-CTE intermediate-row materialisation). The api-ref's "Unset returns default" claim is the single most directly-falsifiable doc statement in the entire catalog.
  - (y) **NEW batch I: DOC-GAP-122 — PolicyService lost-update race** — `PolicyServiceImpl.update` is NOT `@ReactiveTransactional`; the read-then-write composition can lose updates silently with no error returned. `RoleServiceImpl.update` IS transactional; the asymmetry is the canonical concrete instance of DOC-GAP-116 META. Admin-rare frequency but exact class of bug that ships unnoticed until a multi-admin audit lands on inconsistent policy state.
  - (z) **NEW batch I: DOC-GAP-097 + DOC-GAP-083 + DOC-GAP-107 + DOC-GAP-110 + DOC-GAP-073 strengthened with service-layer primary-source confirmation** — silent-UPDATE-on-missing extends to upsertBusinessName at the service tier; forensic silence on PolicyServiceImpl confirmed at 4-layer triangulation with maintainer-intent capture; AlertManager webhook compound finding gains 4th + 5th attack vectors; Alert reopen-conflict guard maintainer-intent confirmed as deliberate trade-off; Policies live doc page gains 8th sub-finding (concurrency model).

Batch H-and-prior meta-recommendations (preserved):
  - (n) **batch H: DOC-GAP-082 META 13-sidecar (DISABLED-bypasses-RBAC-primary-surface)**.
  - (o) **batch H: DOC-GAP-083 META 4-layer (No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD asymmetry)** — extended to PolicyServiceImpl service-layer in batch I.
  - (p) **batch H: DOC-GAP-105 supersedes DOC-GAP-021 with SQL primary-source** — extended to 5-angle in batch I.
  - (q) **batch H: CROSS-BATCH CORRECTION (DOC-GAP-108 — 5xx misclaim → 400 USR003)**.
  - (r) **batch H: DOC-GAP-106 closes the AUTHORIZATION HOT PATH soft-delete leak**.
  - (s) **batch H: First SQL-injection finding (DOC-GAP-104)**.

Batch F-and-prior meta-recommendations (preserved):
  - (i) **batch F: Read-collaborative cross-owner enumeration — 4-sidecar (DOC-GAP-095 META)** — now 5-sidecar with batch I's DataEntityServiceImpl + LineageServiceImpl service-tier confirmations.
  - (j) **batch F: Doc-vs-code spelling/format mismatch — 2-sidecar (DOC-GAP-094 META)**.
  - (k) **batch F: Activity-feed retention claim — 3-angle confirmed (DOC-GAP-041)**.
  - (l) **batch F: DISABLED-bypasses-everything (DOC-GAP-082 META 13-sidecar)**.
  - (m) **batch F: OpenAPI 201-vs-200 drift (DOC-GAP-074)**.

Batch E-and-prior meta-recommendations (preserved): (e)-(h) — see prior frontmatter.
Batch D-and-prior meta-recommendations (preserved): (a)-(d) — see prior frontmatter.
- **Notable patterns**:
  - The substrate's per-concept `security_aggregate` weaknesses are systematically absent from the live pages — the docs describe the feature's UX but not the operational risk surface.
  - **Doc-text-vs-code audience drift** (2026-05-10A): the live alerting doc names "stewards and admins" while code enforces "any authenticated user."
  - **Triangulated default-open posture** (2026-05-10B): four config-key-consumer sidecars + four `*SecurityConfiguration` sidecars + (batch H) 5 repository-layer sidecars + (batch I) 5 service-layer sidecars now converge on the same operator-trap shape — DISABLED-default of `auth.type` + FALSE-default of `auth.ingestion.filter.enabled`. Per LSN-001 + LSN-002 case-law, this is the canonical insecure-default failure mode the ontology was built to surface.
  - **Documentation-overstates-config-effect** (2026-05-10B + 2026-05-12D): activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code has NO row-by-age retention path. **3-angle triangulated since batch F**.
  - **GitBook legacy-route 404 cluster**: `/active-platform-features/notifications` joins `/active-platform-features/data-collaboration`, both 404 with redirect-suggestion stubs.
  - **Auth-mode-wiring-site blast-radius gap (2026-05-12C)** — dedicated sub-pages omit security-relevant operational consequences.
  - **Notifications subsystem under-documented for operations (2026-05-12C + D)**.
  - **2026-05-12D: Housekeeping subsystem doc completeness**.
  - **2026-05-12D: OAuth2 docs internal inconsistency**.
  - **2026-05-19 batch H: Repository-layer SQL primary-source confirms 8 existing findings AND surfaces 5 new HIGH** — the catalog is now anchored on the SQL bodies; the pattern is controller→service→repository with truth at the repository.
  - **2026-05-19 batch H: First SQL-injection in the catalog (DOC-GAP-104)**.
  - **2026-05-19 batch H: First cross-batch correction propagated (DOC-GAP-108)**.
  - **NEW 2026-05-19 batch I: Service-layer business-invariant primary-source confirms 6 existing findings AND surfaces 15 new (5 HIGH + 8 MEDIUM + 2 LOW)** — for the first time the catalog is anchored on the `*ServiceImpl` business logic, which is the layer where maintainer-design INTENT is most visible. The pattern from batch I: the service layer carries the business invariants (transaction boundaries, audit-emission, replace-not-merge contracts, anchor-set scoping, schema validation, name-reservation logic); the repository tier is policy-agnostic; the controller tier is the API-surface adapter. When the three layers disagree on a documented contract, the SERVICE layer is the maintainer-intent source — and that intent is often the source of UNDOCUMENTED structural decisions.
  - **NEW 2026-05-19 batch I: First META on a platform-wide ADR-grade architectural pattern (DOC-GAP-116)** — the `@ReactiveTransactional`-at-service-not-repository pattern is THE platform's most consequential architectural decision and is undocumented at every layer. The per-service asymmetries (Policy vs Role; updateStatus vs siblings) are concrete instances of "operators assuming uniform discipline are wrong". Single highest-leverage developer-guide page addition: one canonical-home for the transaction model.
  - **NEW 2026-05-19 batch I: Ingestion silent-destruction LSN-001 family (DOC-GAP-113 + DOC-GAP-114)** — the replace-not-merge contract is the maintainer's INTENTIONAL choice (per implicit_adrs.[4]) but is invisible to operators; the doc-side admonition is owed to every operator running ODD today. The single-doc-line addition is the minimum-cost fix; the code-side log.warn + activity-event emission make the destruction operator-detectable.

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 127

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

## DOC-GAP-050 — LDAP `auth.ldap.password` leak surface — actuator-env value-mask is operator-overridable AND the **durable** leak vector is Lombok `@Data`-generated `toString()` (**REFINED batch D**)

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

## DOC-GAP-073 — Policies live doc page omits POLICY_CREATE permission, Administrator-bootstrap, audit-trail absence, `GET /api/policies/schema` endpoint, and DISABLED-mode bypass (keys-to-the-kingdom under DISABLED — 5 doc-drift findings) **(batch H STRENGTHENS to 7 sub-findings via DOC-GAP-106 + DOC-GAP-112; batch I adds 8th: concurrency model + pagination asymmetry — see DOC-GAP-122 + DOC-GAP-123 + DOC-GAP-126)**

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

## DOC-GAP-083 — **META-FINDING** — No-audit-log on RBAC mutations pattern **(batch H STRENGTHENS with repository-layer forensic-silence confirmation + ownership-edge partial-exception evidence; batch I STRENGTHENS to 4-layer triangulation for PolicyServiceImpl with maintainer-intent capture of ownership-binding-vs-directory-CRUD design asymmetry)**

**Severity**: HIGH
**Category**: drift (meta)

**Full detail**: `detail/DOC-GAP-083.md`

---

## DOC-GAP-096 — Markdown rendering on data-entity descriptions is not sanitised at the backend AND the UI's `rehype-raw` configuration has no `rehype-sanitize` — stored-content-injection surface entirely undocumented

**Severity**: HIGH
**Category**: drift (security caveat absent on doc page covering the feature)

**Full detail**: `detail/DOC-GAP-096.md`

---

## DOC-GAP-097 — `PUT /api/dataentities/{id}/description` is a pure UPDATE with silent no-op on missing entity — operationId, OpenAPI summary, and consumer expectation all use "upsert" language that contradicts the implementation **(batch I STRENGTHENS with service-tier confirmation that extends to sibling field `upsertBusinessName`; maintainer-intent captured as deliberate per-write-shape asymmetry)**

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

## DOC-GAP-105 — Lineage recursive-CTE at the SQL primary source has NO cycle guard, NO upper bound on `lineageDepth`, NO owner JOIN — supersedes DOC-GAP-021 framing with primary-source evidence; combined with controller-layer NPE on null default (DOC-GAP-089) + inverse-semantic OpenAPI summary (DOC-GAP-099), 4-angle confirmed **(batch I extends to 5-angle with service-layer null-NPE site + no-clamp + heap-amplification composition confirmations)**

**Severity**: HIGH
**Category**: drift (live `/features/data-lineage` silent on depth/cycle/owner; api-ref's "Unset returns default" is unimplementable)

**Full detail**: `detail/DOC-GAP-105.md`

---

## DOC-GAP-106 — `ReactivePolicyRepositoryImpl.getRolesPolicies` does NOT filter soft-deleted policies on the RBAC authorization hot path — direct-DB soft-delete produces ghost-permission policies that silently keep granting access; single-line `AND policy.deleted_at IS NULL` fix closes structurally

**Severity**: HIGH
**Category**: drift (live `/authorization/policies` silent on soft-delete semantics + ghost-binding risk + direct-DB caveat; partial-index design + cascade-FK-absence undocumented)

**Full detail**: `detail/DOC-GAP-106.md`

---

## DOC-GAP-107 — AlertManager webhook `POST /ingestion/alert/alertmanager` bypasses `IngestionDataEntitiesFilter` (filter only matches `/ingestion/entities`) AND `ReactiveAlertRepositoryImpl.createAlerts` has NO `ON CONFLICT` — combined: unauthenticated caller can POST AlertManager-shaped payloads with attacker-chosen `entity_oddrn` AND no de-duplication on retry; strengthens DOC-GAP-003 + DOC-GAP-038 **(batch I extends to 5-vector compound — adds DOC-GAP-117 generatorURL XSS via UI markdown render + DOC-GAP-125 LocalDateTime timezone-naive startsAt)**

**Severity**: HIGH
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` warns generically about "no application-layer auth" but does not enumerate the 5 specific vectors)

**Full detail**: `detail/DOC-GAP-107.md`

---

## DOC-GAP-108 — CROSS-BATCH CORRECTION — batch-F `createOwnership` sidecar's "5xx on duplicate" claim is WRONG; actual surface is HTTP 400 with `USR003` (`UniqueConstraint`) and friendly message "Ownership for this data entity and owner already exists" — AND this error shape is undocumented in OpenAPI, in the permissions live page, and in the owners live page

**Severity**: HIGH
**Category**: drift (substrate misclaim correction + class-wide OpenAPI 400-USR003 undeclared on every create endpoint with a UNIQUE constraint translation)

**Full detail**: `detail/DOC-GAP-108.md`

---

## DOC-GAP-113 — IngestionService silent metadata-delete-on-absence — `MetadataIngestionRequestProcessor.process` issues `bindingsToDelete = existingMetadataBindings.difference(currentBindings)` then `metadataFieldValueRepository.delete(bindingsToDelete)` INSIDE the per-request transaction with NO log.warn on the delete branch; a collector that emits incomplete metadata silently destroys platform-side data with no operator visibility; LSN-001-shape silent-data-loss surface

**Severity**: HIGH
**Category**: drift (replace-not-merge contract is an INTENTIONAL maintainer-design choice — implicit_adrs.[4] — but is undocumented operator-facing on `/integrations/ingestion-filters` or `/developer-guides/api-reference`)

**Full detail**: `detail/DOC-GAP-113.md`

---

## DOC-GAP-114 — IngestionService silent lineage-edge-delete-on-absence — `LineageServiceImpl.replaceLineagePaths` does `batchDeleteByEstablisherOddrn(establishers)` then `batchInsertLineages(pojos)` inside one transaction; a collector that emits a partial sourceList silently destroys the rest of the establisher's lineage edges; LSN-001-shape sibling to DOC-GAP-113

**Severity**: HIGH
**Category**: drift (operator-facing `/features/data-lineage` and `/developer-guides/api-reference/lineage` silent on per-ingestion replace semantics; the verb `replaceLineagePaths` is the structural decision)

**Full detail**: `detail/DOC-GAP-114.md`

---

## DOC-GAP-115 — Lineage service-layer anchor-set defence asymmetry — `LineageServiceImpl.getLineage` has NO `AuthIdentityProvider` field, NO `fetchAssociatedOwner` call; `DataEntityRelationsServiceImpl.getDependentDataEntityOddrns` DOES; positive-vs-negative-case asymmetry one directory apart on the SAME underlying repository; lineage canvas is the cross-owner enumeration sink while the seemingly-equivalent "My objects with lineage" feature is owner-scoped

**Severity**: HIGH
**Category**: drift (live `/features/data-lineage` silent on visibility model; the canvas-vs-my-objects asymmetry is invisible to operators evaluating ODD for multi-tenant deployments)

**Full detail**: `detail/DOC-GAP-115.md`

---

## DOC-GAP-116 — **META-FINDING** — Service-tier `@ReactiveTransactional` boundary pattern is a platform-wide ADR-grade architectural decision (every reactive service places txn boundaries at the service; every Reactive*RepositoryImpl is un-annotated) but is undocumented at any layer; within-service asymmetries (RoleServiceImpl IS transactional, PolicyServiceImpl is NOT; updateStatus delegates to a downstream-annotated method) are also undocumented

**Severity**: HIGH
**Category**: drift (meta — pattern-vs-doc divergence on a structural decision; affects every developer-guide page describing platform writes)

**Full detail**: `detail/DOC-GAP-116.md`

---

## DOC-GAP-117 — AlertManager webhook `generatorURL` field is embedded verbatim into chunk description via `String.format("Distribution Anomaly. URL: %s", queryUrl)`; combined with DOC-GAP-096 (UI markdown render without sanitisation) AND DOC-GAP-038 (unauthenticated webhook), any network-reachable caller can plant a wire-XSS chain that fires in any platform user's session viewing the alert; 4th attack vector on DOC-GAP-107's compound finding

**Severity**: HIGH
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` covers wiring without warning about untrusted-URL embedding; the cross-attack-surface chain is invisible)

**Full detail**: `detail/DOC-GAP-117.md`

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

## DOC-GAP-110 — Alert reopen-conflict guard `openAlertWithTheSameTypeExistsForDataEntity` is read-then-write without `SELECT FOR UPDATE` or DB-side `UNIQUE(data_entity_oddrn, type) WHERE status = OPEN` partial-index — two concurrent reopens can both pass the EXISTS check and both proceed to UPDATE, briefly violating the "one OPEN of the same type per data entity" invariant **(batch I STRENGTHENS to 3-layer with service-layer maintainer-intent capture: the unfenced guard is INTENTIONAL trade-off to keep DB schema simple and error UX human-readable)**

**Severity**: MEDIUM
**Category**: drift (live alerting page does not describe the reopen-conflict semantic; the platform invariant has no SQL-level backstop)

**Full detail**: `detail/DOC-GAP-110.md`

---

## DOC-GAP-112 — Policy soft-delete + partial unique index `policy_name_unique ON policy(name) WHERE deleted_at IS NULL` + `PolicyServiceImpl.create` missing Administrator-name protection = compound risk under direct-DB; companion to DOC-GAP-106 + strengthens DOC-GAP-073 with the 7th sub-finding

**Severity**: MEDIUM
**Category**: drift (live `/authorization/policies` silent on the partial-index mechanism that enables Administrator-name re-creation via create-path asymmetry)

**Full detail**: `detail/DOC-GAP-112.md`

---

## DOC-GAP-118 — Soft-deleted data entities are silently restored on re-ingestion — `IngestionServiceImpl.java:127-136` routes DELETED-status entities through `restoreDeletedDataEntityRelations`; activity-feed emits NO event on restore (only on NEW entities); operators deleting deprecated entities find them silently return on the next collector tick unless the entity is ALSO removed from the collector's source — undocumented coupling

**Severity**: MEDIUM
**Category**: drift (operator-facing `/configuration-and-deployment/odd-platform` housekeeping section silent on restore-on-re-ingestion flow; collector-coupling requirement for permanent deletion is invisible)

**Full detail**: `detail/DOC-GAP-118.md`

---

## DOC-GAP-119 — MICROSERVICE-typed existing entities are silently EXCLUDED from `specificAttributesDeltas` at `IngestionServiceImpl.java:103` — `filter(e -> DataEntityTypeDto.MICROSERVICE != e.getValue().getType())` with no defending comment; MICROSERVICE entities can never trigger schema-diff BIS alert candidates; type-specific carve-out invisible to operators evaluating ODD for microservice-heavy catalogs

**Severity**: MEDIUM
**Category**: drift (live `/active-platform-features/alerting` discusses Distribution Anomaly + BIS without naming type-specific carve-outs; the exclusion is structurally invisible)

**Full detail**: `detail/DOC-GAP-119.md`

---

## DOC-GAP-120 — `POST /ingestion/entities` is all-or-nothing on batch failures — `@ReactiveTransactional` scopes the entire 14-processor chain; a single failed entity in a 1000-entity payload rolls back the other 999; HTTP response is `Mono<ResponseEntity<Void>>` with NO error-detail body; collectors receive no per-entity error report; debugging requires server-log access

**Severity**: MEDIUM
**Category**: drift (operator-facing `/integrations/ingestion-filters` documents the toggle; `/developer-guides/api-reference` documents the OpenAPI shape with no error-response-detail story; the rollback semantic and absent 207 Multi-Status response shape are undocumented)

**Full detail**: `detail/DOC-GAP-120.md`

---

## DOC-GAP-121 — Activity-feed integration in the ingestion path emits ONLY for NEW entities, NOT for ingestion-driven UPDATEs — `ActivityIngestionRequestProcessor.shouldProcess = isNotEmpty(request.getNewEntities())` AND `activityService.createActivityEvents` consumes `request.getNewIds()` only; ingestion-driven changes to name / description / type / tags / specific-attributes silently produce no activity event; compromised collector mutations are invisible in the audit trail

**Severity**: MEDIUM
**Category**: drift (live `/features/active-platform-features/activity-feed` describes the event types but does not discuss the ingestion-side activity-emission scope; the cross-axis gap is invisible)

**Full detail**: `detail/DOC-GAP-121.md`

---

## DOC-GAP-122 — PolicyService lost-update race on `PUT /api/policies/{id}` — `PolicyServiceImpl.update` is NOT `@ReactiveTransactional`; the read-then-write composition outside any transaction can lose updates silently with no error returned to either caller; sibling `RoleServiceImpl.update` IS transactional; the asymmetry is the canonical concrete instance of DOC-GAP-116 META

**Severity**: MEDIUM
**Category**: drift (live `/configuration-and-deployment/enable-security/authorization/policies` documents the JSON shape; the per-CRUD-method transaction discipline + asymmetry vs `roles.md` are invisible)

**Full detail**: `detail/DOC-GAP-122.md`

---

## DOC-GAP-123 — PolicyService schema-validation failures surface as HTTP 500 (Internal Server Error) rather than HTTP 400 — `PolicyJSONValidator` throws `IllegalArgumentException`; ControllerAdvice has NO dedicated handler for the JDK-standard exception; falls through to the catch-all `Exception.class` → 500 with body `"Internal Server Error"`; validator's actual error message buried in server logs

**Severity**: MEDIUM
**Category**: drift (live `/configuration-and-deployment/enable-security/authorization/policies` documents the JSON shape and recommends consulting the schema endpoint; does not warn that malformed body produces unhelpful 500 with no validator-error detail)

**Full detail**: `detail/DOC-GAP-123.md`

---

## DOC-GAP-124 — Inner-DEG suppression in `LineageServiceImpl.getDataEntityGroupLineage` is a deliberate deferred-feature carve-out (verbatim TODO at line 71 `// Remove this when we will support inner DEGs for DEG lineage`); the source-code TODO has no backlog citation, no `@Disabled` regression test, no operator-facing doc warning; clients building DEG-aware lineage tooling silently observe missing edges

**Severity**: MEDIUM
**Category**: drift (live `/features/data-lineage` discusses lineage without naming the DEG-lineage contract; live `/developer-guides/api-reference/lineage` describes endpoints without describing the inner-DEG carve-out)

**Full detail**: `detail/DOC-GAP-124.md`

---

## DOC-GAP-125 — AlertManager webhook `ExternalAlert.startsAt` is `LocalDateTime` (timezone-naive); Jackson silently strips RFC3339 offset on deserialisation; `AlertServiceImpl` formatter `yyyy-MM-dd HH:mm:ss` has no offset component; embedded Prometheus query-window URL keyed to SERVER local time; operators clicking the link in non-UTC deployments may see no data because the query window is off

**Severity**: MEDIUM
**Category**: drift (live `/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` covers the integration setup but does not describe timezone handling; operators with Prometheus instances in non-UTC zones get broken query-window links with no doc-product warning)

**Full detail**: `detail/DOC-GAP-125.md`

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

## DOC-GAP-126 — PolicyService non-admin list path silently ignores pagination — `PolicyServiceImpl.list` for non-admin users returns `new Page<>(filteredPolicies, filteredPolicies.size(), false)` regardless of `page` / `size` request parameters; admin users get repository-paged results; asymmetric pagination contract invisible to operators and API consumers

**Severity**: LOW
**Category**: drift (live `/configuration-and-deployment/enable-security/authorization/policies` documents the GET endpoint shape; OpenAPI declares page/size with no warning that they're ignored for non-admin callers)

**Full detail**: `detail/DOC-GAP-126.md`

---

## DOC-GAP-127 — LineageServiceImpl.replaceLineagePaths is `@ReactiveTransactional`-annotated but a future self-invocation would silently bypass the annotation — Spring's transactional proxy only applies on EXTERNAL calls; if a future method called `this.replaceLineagePaths(...)`, the delete+insert sequence would NOT be atomic; the standard Spring caveat is undocumented at the service

**Severity**: LOW
**Category**: drift (developer-guide / code-comment absence; no current bug; future-refactor trap)

**Full detail**: `detail/DOC-GAP-127.md`

---
