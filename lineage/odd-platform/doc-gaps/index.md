---
artefact: doc-gaps
generated_at: "2026-05-19T00:00:00Z"
generated_at_commit: 80637ed
sidecar_count: 83
concepts_yaml_version: 9
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 160
findings_by_severity: { HIGH: 79, MEDIUM: 63, LOW: 18 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 139, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 9 }
reconciliation_note: |
  Batch N adds 5 NEW findings (1 HIGH + 3 MEDIUM + 1 LOW) — DOC-GAP-168..172.
  NEW HIGH: DOC-GAP-168 (Tag directory side-door REFACTOR-223 — `DATA_ENTITY_TAGS_UPDATE`
  permission mints global Tag directory rows; live `/features/data-discovery/tagging`
  + `/authorization/permissions` pages name TAG_CREATE separately without naming the
  per-entity permission as a directory-write surface).
  NEW MEDIUM: DOC-GAP-169 (Tag name case-sensitivity divergence — `listByNames`
  case-sensitive vs `listMostPopular.query` substring case-insensitive; operators
  see `PII` and `pii` as two distinct directory rows), DOC-GAP-170 (Tag
  delete-then-recreate loses ALL prior assignment history + `listMostPopular`
  is globally-scoped; both halves combined make the side-door's pollution permanent
  + visible to every user), DOC-GAP-171 (user_owner_mapping monotonic growth +
  cross-provider username display collisions in 4 sibling repositories' LEFT JOINs
  — strengthens DOC-GAP-149 META with 2 additional sub-mechanisms).
  NEW LOW: DOC-GAP-172 (`term_to_term.deleted_at` schema-vs-application drift —
  V0_0_91 adds the column; ReactiveTermRepositoryImpl reads at 7 sites without
  filtering; either dead schema or missing filter).
  STRENGTHENED: DOC-GAP-103 (provider-null cross-mode bleed — now 3-LAYER
  TRIANGULATED: controller + service + repository; `ReactiveUserOwnerMappingRepositoryImpl.getConditions`
  is the SQL-layer manifestation) + DOC-GAP-141 (S2S `ADMIN` literal collision —
  3-LAYER TRIANGULATED: auth-filter + service + repository; case-sensitive `.eq()`
  predicate confirmed at the SQL layer) + DOC-GAP-149 META (P-09 pillar-overpromise
  — sub-mechanism count grows 5 → 7 with soft-delete monotonic growth + cross-provider
  LEFT JOIN display collisions; pillar now 3-layer-confirmed at controller + service +
  repository) + DOC-GAP-072 (Roles page — 5 → 10 sub-findings with the symmetric
  Role-side soft-deleted-policy LEFT JOIN gap + case-sensitivity-asymmetry; 4-LAYER
  TRIANGULATION across the RBAC primary surface) + DOC-GAP-083 META (No-audit-log
  on RBAC mutations — 4 → 5-sidecar at the RBAC primary surface AND extends to a
  6th surface: ingestion-side Tag mutations; cross-pillar pattern significance grows
  P-09 → P-09+P-10+P-01) + DOC-GAP-106 (Authorization HOT PATH soft-delete leak —
  Role-side LEFT JOIN gap is the SYMMETRIC mirror of the Policy-side; defence-in-depth
  fix now requires 4 SQL predicates instead of 1; both halves of the Role↔Policy join
  graph leak soft-deleted policies symmetrically) + DOC-GAP-112 (Policy soft-delete +
  create-asymmetry — symmetric Role-side mirror confirmed; both halves of the RBAC
  mutation surface have the same shape of asymmetry; case-sensitivity adds an extra
  exploit dimension on the Role side) + DOC-GAP-100 (`[[ns:term]]` syntax — 5 → 6
  sidecars; repository-tier confirms case-INsensitive resolution at the SQL layer;
  the regex output and the persistence lookup have DIFFERENT case-handling semantics
  — undocumented case-insensitivity) + DOC-GAP-144 (Term update/delete guard —
  repository-tier primary source for `hasDescriptionRelations` SQL query + NEW
  restore-soft-deleted-entity dangling-reference corner case; cross-link DOC-GAP-118).
  Severity buckets: HIGH = 78 + 1 = 79; MEDIUM = 60 + 3 = 63; LOW = 17 + 1 = 18.
  Total 79 + 63 + 18 = 160 — matches actual sharded file count (155 + 5 new = 160).
  Strengthened entries (DOC-GAP-103, 141, 149, 072, 083, 106, 112, 100, 144) do NOT
  change severity buckets — only append batch-N evidence to existing entries.
  Note: DOC-GAP-099 has a detail/ shard but is not listed in this index (predates
  the sharding refactor); the batch-N strengthening does not touch DOC-GAP-099.
  This is a known historical state.
batch_history:
  - "2026-05-08: DOC-GAP-001..027 — initial 15-sidecar reduction"
  - "2026-05-10: DOC-GAP-028..035 — refresh after batch 2026-05-10A (5 method-level sidecars: AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, ActivityController.getActivity, DataCollaborationController.postMessageInSlack, CollectorController.regenerateCollectorToken). DOC-GAP-002, DOC-GAP-010, DOC-GAP-025 extended with method-level evidence; severity on DOC-GAP-025 upgraded HIGH."
  - "2026-05-11: DOC-GAP-036..044 — refresh after batch 2026-05-10B (5 config-key-consumer sidecars). Triangulated default-open posture cross-cutting pattern surfaced. NEW HIGH-severity drift on activity-feed retention claim (DOC-GAP-041)."
  - "2026-05-12 (batch C): DOC-GAP-045..058 — refresh after batch 2026-05-12C (5 sidecars: 4 auth-mode SecurityConfiguration + NotificationsProperties). Auth-mode wiring-site blast-radius gaps surfaced (8 new HIGH); class-level DOC-GAP-058 captures GitBook legacy-route drift."
  - "2026-05-12 (batch D): DOC-GAP-059..071 — refresh after batch 2026-05-12D (5 config-properties-class sidecars). Primary-source POJO sidecars CONFIRM batch-C wiring-site findings AND surface 13 new findings."
  - "2026-05-12 (batch E): DOC-GAP-072..083 — refresh after batch 2026-05-12E (5 method-level RBAC sidecars). 4 new RBAC entity concepts + 1 new feature concept added."
  - "2026-05-12 (batch F): DOC-GAP-084..095 — refresh after batch 2026-05-12F (5 method-level sidecars on DataEntityController centerpiece + IngestionController)."
  - "2026-05-13 (batch G): DOC-GAP-096..103 — refresh after batch 2026-05-13-G (5 DataEntityController method-level sidecars)."
  - "2026-05-19 (batch H): DOC-GAP-104..112 — refresh after batch 2026-05-19-H (5 repository-layer sidecars). FIRST batch of repository-layer (SQL primary source) coverage in the catalog."
  - "2026-05-19 (batch I): DOC-GAP-113..127 — refresh after batch 2026-05-19-I (5 service-layer sidecars). FIRST batch of service-layer (business-invariant primary source) coverage in the catalog."
  - "2026-05-19 (batch J): DOC-GAP-128..138 — refresh after batch 2026-05-19-J (5 UI-axis sidecars). NEW HIGH: 2; MEDIUM: 6; LOW: 3. Strengthens DOC-GAP-101, 105, 096, 100, 117."
  - "2026-05-19 (batch K): DOC-GAP-139..149 — refresh after batch 2026-05-19-K (5 service-tier sidecars). NEW HIGH: 5; MEDIUM: 5; LOW: 1. Strengthens DOC-GAP-001, 054, 055, 057, 060, 062, 075, 100, 103, 108. First REV-3 LAYER-0 META (DOC-GAP-149)."
  - "2026-05-19 (batch L): DOC-GAP-150..158 — refresh after batch 2026-05-19-L (5 DataEntityController method-level sidecars). 9 NEW (4 HIGH + 5 MEDIUM + 0 LOW); 2 STRENGTHENED (DOC-GAP-001 + DOC-GAP-009). Second REV-3 LAYER-0 META (DOC-GAP-158 P-01 Data Entity Groups & Domains)."
  - "2026-05-19 (batch M): DOC-GAP-159..167 — refresh after batch 2026-05-19-M (4 sidecars: getMyObjectsWithUpstream + getMyObjectsWithDownstream + getDataEntityGroupsLineage + SearchController.facets). 9 NEW findings (4 HIGH + 5 MEDIUM + 0 LOW); 5 STRENGTHENED."
  - "2026-05-19 (batch N): DOC-GAP-168..172 — refresh after batch 2026-05-19-N (4 repository-tier sidecars: ReactiveTermRepositoryImpl + ReactiveTagRepositoryImpl + ReactiveUserOwnerMappingRepositoryImpl + ReactiveRoleRepositoryImpl). 5 NEW (1 HIGH + 3 MEDIUM + 1 LOW); 9 STRENGTHENED (DOC-GAP-103 to 3-LAYER; DOC-GAP-141 to 3-LAYER; DOC-GAP-149 META to 7-sub-mechanism + 3-layer; DOC-GAP-072 from 5 to 10 sub-findings + 4-LAYER RBAC; DOC-GAP-083 META to 5-sidecar + cross-pillar extension; DOC-GAP-106 with symmetric Role-side LEFT JOIN gap; DOC-GAP-112 with symmetric Role-side mirror; DOC-GAP-100 to 6-sidecar + case-INsensitive resolution dimension; DOC-GAP-144 with repository-tier primary source + restore-dangling-reference corner case). NEW HIGH: DOC-GAP-168 (FIRST DOC-GAP for the tagging surface). 4 live URLs WebFetched at status 200. Batch N is the FIRST batch covering Tag + Term + User-Owner-Mapping repository tiers; the RBAC repository tier (Role) closes the 4-layer triangulation across the RBAC primary surface. YAML-safe emit."
maintainer_curated: false
confidence_overall: HIGH
---

# Doc gaps — odd-platform — 2026-05-19 (batch N refresh)

## Summary

- **Findings**: 160 total (79 HIGH, 63 MEDIUM, 18 LOW)
- **By category**: broken-url 9, drift 139, missing-page 8, coverage-gap 4, meta 9
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). Batch N adds 5 NEW findings (1 HIGH + 3 MEDIUM + 1 LOW) AND strengthens 9 existing findings — the highest STRENGTHENED count of any batch to date. The cluster has two structural themes: (a) PERSISTENCE-LAYER MIRRORING — every batch-N strengthened finding is the SYMMETRIC mirror of a previously-tracked controller/service finding at the SQL primary source (DOC-GAP-103, 141, 149, 072, 083, 106, 112, 100, 144 all gain repository-tier confirmation); (b) NEW TAG-SURFACE COVERAGE — DOC-GAP-168 / 169 / 170 are the FIRST 3 DOC-GAPs on the tagging surface (cross-pillar: P-01 Data Discovery × P-09 Security & Access Control × P-10 Integrations & Ingestion via REFACTOR-223 side-door).
- **Notable patterns**:
  - **NEW 2026-05-19 batch N: PERSISTENCE-LAYER MIRRORING is the structural insight** — every batch-N strengthened finding is the SYMMETRIC mirror of a previously-tracked controller/service finding at the SQL primary source. The 4-layer triangulation pattern (RBAC primary surface: Role + Policy at controller + service + repository tiers) and the 3-layer triangulation pattern (User-Owner-Mapping chokepoint: auth-filter + service + repository) are now structurally complete.
  - **NEW 2026-05-19 batch N: FIRST DOC-GAPs on the tagging surface (DOC-GAP-168 + DOC-GAP-169 + DOC-GAP-170)** — REFACTOR-223 side-door + case-sensitivity divergence + delete-recreate lifecycle. Cross-pillar finding cluster (P-01 × P-09 × P-10).
  - **NEW 2026-05-19 batch N: DOC-GAP-083 META extends to cross-pillar (P-09 + P-10 + P-01)** — the no-audit-log pattern is now confirmed on the ingestion-side Tag mutation surface (via DOC-GAP-168) in addition to the RBAC primary surface (Role + Policy + Owner); the META is no longer RBAC-specific but a platform-wide audit-coverage gap.
  - **NEW 2026-05-19 batch N: 4 live URLs WebFetched at status 200** — features/data-discovery/tagging + features/data-glossary/business-glossary + configuration-and-deployment/enable-security/authorization/roles + configuration-and-deployment/enable-security/authorization/user-owner-association; all 4 pages confirm silence on the repository-tier primary-source findings.
  - (Earlier batches' notable-pattern bullets preserved in detail/ shards; the structural insight is the PERSISTENCE-LAYER MIRRORING + the cross-pillar audit-coverage extension at batch N.)

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 160

---

## DOC-GAP-001 — DataEntity `/term` vs `/terms` path mismatch silently disables DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM gates — undocumented on Permissions page **(batch L: 6-sidecar)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-001.md`

---

## DOC-GAP-002 — Alerting feature page does not warn that `getAllAlerts` exposes every platform alert to any authenticated user

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

## DOC-GAP-006 — `/actuator/env` exposes S3/MinIO credentials by default — undocumented on Attachment Storage page (REFINED batch D: durable leak surface is Lombok-toString — see DOC-GAP-067)

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

## DOC-GAP-009 — `developer-guides/api-reference` does not document the 40 dataEntity operations — punts to Swagger UI **(batch M)**

**Severity**: HIGH
**Category**: coverage-gap

**Full detail**: `detail/DOC-GAP-009.md`

---

## DOC-GAP-010 — Attachment chunked-upload protocol (3-step state machine) undocumented anywhere; cross-entity uploadId hijack now confirmed at method level

**Severity**: HIGH
**Category**: drift

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

## DOC-GAP-041 — Activity-feed page claims `odd.activity.partition-period` controls "retention and partitioning" — code never DROPs activity partitions AND housekeeping has no `activity*Days` field; retention claim materially incorrect (2-angle CONFIRMED batch D)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-041.md`

---

## DOC-GAP-045 — `disabled-authentication` page declares DISABLED "the default configuration" with a single production-warning, but omits the full blast radius (CSRF / CORS / actuator / S2S-ignored / audit-absence / no boot WARN)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-045.md`

---

## DOC-GAP-046 — OAuth2/OIDC docs list 7 supported providers but `Provider` enum has only 5; Okta/Keycloak operators silently get no provider-specific user enrichment and no provider-specific logout (2-angle CONFIRMED batch D)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-046.md`

---

## DOC-GAP-047 — OAuth2 docs reference `azure-tenant-id` config key + use `${auth.oauth2.client.azure.azure-tenant-id}` interpolation, but `ODDOAuth2Properties.OAuth2Provider` POJO has NO `azureTenantId` field — Azure YAML example is not deployable as-shown

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-047.md`

---

## DOC-GAP-048 — OAuth2 docs flag Azure `logout-uri` as REQUIRED but `ODDOAuth2Properties.validate()` only checks `clientId` and `provider` — operator boots successfully and fails at first logout

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-048.md`

---

## DOC-GAP-049 — OAuth2/OIDC docs do NOT mention `auth.s2s.enabled` or the S2S composition with OAUTH2 — operators deploying OAuth2 + S2S see an undocumented X-API-Key → ADMIN-across-all-paths surface

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-049.md`

---

## DOC-GAP-050 — LDAP `auth.ldap.password` leak surface — actuator-env value-mask is operator-overridable AND the durable leak vector is Lombok `@Data`-generated `toString()` (REFINED batch D)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-050.md`

---

## DOC-GAP-051 — LDAP setup page omits 7 distinct caveats (ldap:// vs ldaps://, substring-match admin-groups collision, empty admin-groups, S2S composability, health check, timeout/pooling)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-051.md`

---

## DOC-GAP-052 — LOGIN_FORM page omits 6 distinct caveats (auth.login-form-redirect open-redirect, missing authorization framework, session-cookie security, S2S composability, plain-text credential leak, CSRF posture)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-052.md`

---

## DOC-GAP-053 — `auth.type=NOOP` is the legacy literal in `application-with-auth.yml` aside from being deprecated — operator copy/pasting from old configs gets cryptic boot error

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-053.md`

---

## DOC-GAP-054 — Notifications subsystem lacks an Operations/Architecture page — operator deploying webhooks has NO doc on WAL slot setup, per-message no-PII-redaction posture, sender ordering, retries, partial-delivery contract **(batch K: 2-sidecar)**

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-054.md`

---

## DOC-GAP-055 — `notifications.enabled` is a 5-key precondition; page presents the toggle without surfacing the matrix — operator deploys with the flag flipped and silently gets no notifications **(batch K)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-055.md`

---

## DOC-GAP-073 — `/configuration-and-deployment/enable-security/authorization/policies` page is concept-only and omits the 7-permission-axis Policy authoring shape **(batch I STRENGTHENS)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-073.md`

---

## DOC-GAP-082 — META-FINDING — `auth.type=DISABLED` BYPASSES the entire Authorization framework; ALL admin operations are anonymously reachable on a network-exposed deployment; 13-sidecar triangulated cluster

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — META-FINDING — No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD audit asymmetry **(batch N: 5-sidecar + cross-pillar extension)**

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-083.md`

---

## DOC-GAP-084 — `LineageServiceImpl.getLineage` is read-collaborative (REFACTOR-203) — no per-owner filtering at the service tier; cross-owner lineage enumeration via per-entity lineage endpoints undocumented

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-084.md`

---

## DOC-GAP-085 — Owner-association request flow has NO authorization framework when `auth.type=LOGIN_FORM`

**Severity**: HIGH
**Category**: drift

**Full detail**: (not yet sharded — held in pre-shard form)

---

## DOC-GAP-087 — `IngestionDataEntitiesFilter` path-pattern matches `/ingestion/entities` POST ONLY — 9 other `/ingestion/*` paths are unfiltered regardless of `auth.ingestion.filter.enabled`

**Severity**: HIGH
**Category**: drift

**Full detail**: (not yet sharded — held in pre-shard form)

---

## DOC-GAP-098 — `updateDataEntityStatus` API path is `PUT /api/dataentities/{id}/statuses/{status_id}` but live `dataEntityStatus` page documents singular `status` — second `/term` vs `/terms` family path-mismatch

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-098.md`

---

## DOC-GAP-104 — `getHighlightedResult` SQL-format-injection AND `to_tsquery` operator-injection at every facet aggregator share the `JooqFTSHelper.tsQuery` surface **(batch M: 2-invocation-site)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-104.md`

---

## DOC-GAP-105 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters or unbounded-depth caveat **(SUPERSEDES DOC-GAP-021; batch M: 7-angle)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-105.md`

---

## DOC-GAP-106 — Authorization HOT PATH soft-delete leak — REFACTOR-201 confirms the AUTHORIZATION HOT PATH does NOT use `addSoftDeleteFilter` **(batch N: symmetric Role-side LEFT JOIN gap)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-106.md`

---

## DOC-GAP-107 — `IngestionService` is the platform's largest single point of failure — all 14 IngestionRequestProcessors run inside ONE `@ReactiveTransactional` boundary

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-107.md`

---

## DOC-GAP-108 — `POST /api/dataentities/{id}/ownership` USR003 error shape (HTTP 400) on duplicate — cross-batch correction propagated; 3-LAYER TRIANGULATION

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-108.md`

---

## DOC-GAP-113 — `IngestionServiceImpl` is the silent-destruction surface — INGESTION REPLACES not MERGES; LSN-001-family bug

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-113.md`

---

## DOC-GAP-114 — Ingestion `DELETED_ENTITIES_QUERY_PAGE_SIZE = 1000` is hardcoded; soft-delete cascade-on-ingestion fires per 1000-entity slice; LSN-class drift

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-114.md`

---

## DOC-GAP-115 — Lineage anchor-set positive-vs-negative-case asymmetry — `/api/dataentity/{id}/lineage` returns DIFFERENT JSON shapes when the anchor entity is or isn't itself in the result set **(batch M: controller-method-tier completeness)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-115.md`

---

## DOC-GAP-116 — META-FINDING — Service-tier `@ReactiveTransactional` boundary pattern is a platform-wide ADR-grade architectural decision but is undocumented at any layer

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-116.md`

---

## DOC-GAP-117 — AlertManager webhook `generatorURL` field embedded verbatim; combined with DOC-GAP-096 + DOC-GAP-038 any network-reachable caller can plant a wire-XSS chain

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-117.md`

---

## DOC-GAP-130 — LSN-017 +2 view_count per detail-page-open undocumented end-to-end

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-130.md`)

---

## DOC-GAP-137 — META-FINDING — ZERO UI test coverage across the entire `odd-platform-ui` SPA

**Severity**: HIGH
**Category**: meta

**Full detail**: (sharded — see `detail/DOC-GAP-137.md`)

---

## DOC-GAP-139 — Independent SecurityConstants bug — `PUT /api/alerts/{alert_id}/status` is wired to `DATASET_FIELD_ADD_TERM`

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-139.md`)

---

## DOC-GAP-140 — Term description-edit auto-link service-tier side-channel bypasses `DATA_ENTITY_ADD_TERM`

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-140.md`)

---

## DOC-GAP-141 — S2sAuthenticationFilter hardcodes username `'ADMIN'` (uppercase, case-sensitive) into the S2S Authentication token **(batch N: 3-LAYER TRIANGULATION — auth-filter + service + repository)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-141.md`

---

## DOC-GAP-142 — No auto-create-on-first-login under OAUTH2 / LDAP / LOGIN_FORM — new federated user authenticates successfully but has NO `USER_OWNER_MAPPING` row; `My Objects` silently degrades to empty body

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-142.md`

---

## DOC-GAP-143 — NotificationsDispatcher poison-message WAL replay loop on translation failure

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-143.md`)

---

## DOC-GAP-150 — DEG membership writes are a write-collaborative surface — `DATA_ENTITY_ADD_TO_GROUP` is gated PER CHILD ENTITY (not per DEG)

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-150.md`

---

## DOC-GAP-153 — DEG membership audit-feed absence + activity-feed page MISREPRESENTS coverage

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-153.md`

---

## DOC-GAP-156 — `PUT /api/dataentities/{id}/metadata/{metadata_field_id}` returns 200 OK SILENTLY on a `(dataEntityId, metadataFieldId)` pair with no existing row; first DOC-GAP for the custom-metadata feature

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-156.md`)

---

## DOC-GAP-157 — `GET /api/dataentities/{id}/alerts` cross-owner read posture on the doc-recommended audit-export workaround; SECOND DOC-GAP naming cross-owner alert read after DOC-GAP-002

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-157.md`)

---

## DOC-GAP-159 — DEG-anchored lineage cross-owner enumeration; THIRD member of the negative-case lineage family **(batch M)**

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-159.md`)

---

## DOC-GAP-160 — Search facets cross-owner cardinality enumeration; facet counts catalog-wide regardless of myObjects toggle **(batch M)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-160.md`

---

## DOC-GAP-161 — Search session UUIDs as bearer tokens; `search_facets` schema has no owner_id column **(batch M)**

**Severity**: HIGH
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-161.md`)

---

## DOC-GAP-166 — `to_tsquery` operator-injection on PERSISTED `search_facets.query_string` — DoS-shaped vector; STRENGTHENS DOC-GAP-104 + DOC-GAP-080 **(batch M)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-166.md`

---

## DOC-GAP-168 — Tag directory side-door (REFACTOR-223) — any operator with `DATA_ENTITY_TAGS_UPDATE` can MINT global Tag directory rows; live `/features/data-discovery/tagging` + `/authorization/permissions` pages silent **(NEW batch N — FIRST DOC-GAP for the tagging surface)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-168.md`

---

### MEDIUM severity

## DOC-GAP-011 — Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-011.md`

---

## DOC-GAP-012 — Legacy URL `/active-platform-features/genai` returns 404

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-012.md`

---

## DOC-GAP-013 — Legacy URL `/data-discovery/attachments` returns 404

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-013.md`

---

## DOC-GAP-014 — Legacy URL `/data-discovery/directory` returns 404

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

## DOC-GAP-020 — Concept "Locale Bundle" / "Multilingual UI" — F-047 is filed; cross-referenced

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-020.md`

---

## DOC-GAP-021 — Lineage feature page does not document `lineageDepth` / `expandedEntityIds` parameters (batch H: superseded by DOC-GAP-105)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-021.md`

---

## DOC-GAP-022 — Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-022.md`

---

## DOC-GAP-023 — Cross-entity uploadId hijack (Attachment) — undocumented

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

## DOC-GAP-034 — Token Rotation operational mechanics absent from enable-security pages

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-034.md`

---

## DOC-GAP-035 — `/active-platform-features/data-collaboration` returns 404 on legacy URL

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

## DOC-GAP-043 — Activity-feed partition CREATE failures are silently swallowed — undocumented; `partition.advisory-lock-id` undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-043.md`

---

## DOC-GAP-056 — Legacy URL `/active-platform-features/notifications` returns 404

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-056.md`

---

## DOC-GAP-057 — Notifications subsystem under-documents operational caveats **(batch K: 2-sidecar)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-057.md`

---

## DOC-GAP-058 — META-FINDING — GitBook legacy-vs-canonical routing drift is a cross-cutting class

**Severity**: MEDIUM
**Category**: meta

**Full detail**: `detail/DOC-GAP-058.md`

---

## DOC-GAP-060 — Housekeeping docs frame the subsystem as "three cleanup tasks" but code has 5 HousekeepingJob beans **(batch K: 3-sidecar)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-060.md` if present)

---

## DOC-GAP-062 — AlertHousekeepingJob jOOQ-precedence bug acknowledged in docs but unlinked to a tracking issue **(batch K)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-062.md` if present)

---

## DOC-GAP-064 — DataCollaboration lock-id collision risk undocumented — operators tuning the four advisory-lock IDs get no guardrails

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-064.md`

---

## DOC-GAP-066 — Email channel config doc completeness — `port`=int default 0 cliff, modern SMTP-AUTH OAUTH2 absent, no Reply-To / Cc / Bcc / DKIM support

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-066.md`

---

## DOC-GAP-068 — META-FINDING — Partial-home pattern: `@ConfigurationProperties` POJOs bind only a subset of their config-prefix's keys

**Severity**: MEDIUM
**Category**: meta

**Full detail**: `detail/DOC-GAP-068.md`

---

## DOC-GAP-071 — DataCollab `datacollaboration.*` prefix is a partial-home — 3 of 7 keys bind to `DataCollaborationProperties`, 4 scattered

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-071.md`

---

## DOC-GAP-072 — Roles live doc page omits the entire role-creation API surface — 10 sub-findings **(batch N: 4-LAYER TRIANGULATION + 5 new sub-findings)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-072.md`

---

## DOC-GAP-074 — OpenAPI declares 201 Created for `POST /api/owners` but `OwnerController.java:26` returns 200 OK — third concrete instance of class-wide 201-vs-200 drift

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-074.md`

---

## DOC-GAP-075 — Owners live doc page omits creation mechanics — 8 sub-findings **(batch K: 3-sidecar)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-075.md`)

---

## DOC-GAP-076 — Permissions live doc page omits the per-entity permission-context coverage map — sibling read-side surface undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-076.md`

---

## DOC-GAP-077 — Live `/authorization/permissions` page lists 5 categories but `PermissionResourceType` enum exposes 4 contextual values

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-077.md`

---

## DOC-GAP-078 — DataCollaboration page wording: "channel" vs "incoming-webhook" — operator confusion

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-078.md`

---

## DOC-GAP-079 — Search live doc page omits the `query_string` parameter — operator-facing UX caveat

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-079.md`

---

## DOC-GAP-080 — Search live doc page silent on query syntax — `JooqFTSHelper.tsQuery` splits user input and passes verbatim to Postgres `to_tsquery(?)` **(batch M: PERSISTENCE dimension at DOC-GAP-166)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-080.md`

---

## DOC-GAP-081 — Legacy URL `/features/active-platform-features/search` returns 404 — canonical at `/features/data-discovery/search`

**Severity**: MEDIUM
**Category**: broken-url

**Full detail**: `detail/DOC-GAP-081.md`

---

## DOC-GAP-100 — `[[namespace:term]]` description auto-linking syntax is platform-specific, undocumented operator-facing **(batch N: 6-sidecar + case-INsensitive resolution dimension)**

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-100.md`

---

## DOC-GAP-101 — Popular ranking signal is undocumented externally — `catalog-overview` describes the surface, no page describes the mechanism **(batch H+J STRENGTHENS)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-101.md`)

---

## DOC-GAP-102 — `getMyObjects` empty-Flux degradation for unlinked users is documented at the wrong layer

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-102.md`

---

## DOC-GAP-103 — LOGIN_FORM and LDAP both produce `provider=null` in `USER_OWNER_MAPPING` — undocumented cross-mode user-identity bleed **(batch N: 3-LAYER TRIANGULATION)**

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-103.md`

---

## DOC-GAP-109 — Alert `listByOwner` empty-result total uses platform-wide count instead of owner-scoped count

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-109.md`

---

## DOC-GAP-110 — Alert reopen-conflict guard `openAlertWithTheSameTypeExistsForDataEntity` is read-then-write without `SELECT FOR UPDATE` **(batch I STRENGTHENS to 3-layer)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-110.md`

---

## DOC-GAP-111 — Ownership is HARD-DELETE at the SQL layer — no `deleted_at` column on the `ownership` table; irreversibility not surfaced operator-facing

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-111.md`

---

## DOC-GAP-112 — Policy soft-delete + partial unique index + `PolicyServiceImpl.create` missing Administrator-name protection **(batch N: symmetric Role-side mirror confirmed)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-112.md`

---

## DOC-GAP-118 — Soft-deleted data entities are silently restored on re-ingestion — `IngestionServiceImpl.java:127-136`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-118.md`

---

## DOC-GAP-119 — MICROSERVICE-typed existing entities are silently EXCLUDED from `specificAttributesDeltas`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-119.md`

---

## DOC-GAP-120 — `POST /ingestion/entities` is all-or-nothing on batch failures — `@ReactiveTransactional` scopes the entire 14-processor chain

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-120.md`

---

## DOC-GAP-121 — Activity-feed integration in the ingestion path emits ONLY for NEW entities, NOT for ingestion-driven UPDATEs

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-121.md`

---

## DOC-GAP-122 — PolicyService lost-update race on `PUT /api/policies/{id}` — `PolicyServiceImpl.update` is NOT `@ReactiveTransactional`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-122.md`

---

## DOC-GAP-123 — PolicyService schema-validation failures surface as HTTP 500 rather than HTTP 400 — `PolicyJSONValidator` throws `IllegalArgumentException`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-123.md`

---

## DOC-GAP-124 — Inner-DEG suppression in `LineageServiceImpl.getDataEntityGroupLineage` is a deliberate deferred-feature carve-out **(batch M: 2-sidecar)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-124.md`

---

## DOC-GAP-125 — AlertManager webhook `ExternalAlert.startsAt` is `LocalDateTime` (timezone-naive)

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-125.md`

---

## DOC-GAP-128 — Live `/features/data-discovery/catalog-overview` says "Clicking a tile opens that entity's **Structure** page" but UI navigates to Overview tab

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-128.md`

---

## DOC-GAP-129 — Live `/features/data-discovery/catalog-overview` says under DISABLED auth "the panel is visible but the per-user filtering does not apply" — code HIDES the entire Recommended panel under DISABLED

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-129.md`

---

## DOC-GAP-131 — UI Lineage canvas hardcodes a depth-1 default + caps the visible depth slider at 20 + accepts unbounded `?d=` URL param

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-131.md`)

---

## DOC-GAP-132 — UI Lineage canvas amplifies diamond DAGs into duplicate visual nodes AND silently drops crossEdges that reference missing nodes

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-132.md`)

---

## DOC-GAP-134 — F-004 entity-description rendering surface — Permission docs name `DATA_ENTITY_DESCRIPTION_UPDATE` but do NOT say content render is unconditional

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-134.md`)

---

## DOC-GAP-136 — `AppError` banner reflects `error.status` / `error.statusText` / `error.url` / `error.message` verbatim — backend stack traces and internal API paths render into the UI banner

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-136.md`)

---

## DOC-GAP-144 — Term `updateTerm` and `delete` BLOCKED with HTTP 400 if any active description mentions the term via `[[ns:term]]`; live Business Glossary page silent **(batch N: repository-tier primary source + restore-dangling-reference corner case)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-144.md`

---

## DOC-GAP-145 — Term unhandled-mention staging tables with forward-resolution on term-create; feature undocumented

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-145.md`

---

## DOC-GAP-146 — Title directory auto-grows via `OwnershipServiceImpl.titleService.getOrCreate(formData.titleName)`; REFACTOR-206 anchor

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-146.md`

---

## DOC-GAP-147 — NotificationsDispatcher Email vs Slack/Webhook exception asymmetry — `EmailNotificationSender` wraps as RAW `RuntimeException`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-147.md`)

---

## DOC-GAP-149 — META-FINDING — REV-3 LAYER-0 pillar-overpromise: `system-mission.md` P-09 (Security & Access Control) sub-feature "User-owner association" Confidence: HIGH; live page contains one one-sentence runtime-semantic claim **(batch N: 7-sub-mechanism + 3-layer confirmation)**

**Severity**: MEDIUM
**Category**: meta

**Full detail**: `detail/DOC-GAP-149.md`

---

## DOC-GAP-151 — DEG membership ADD/DELETE permission asymmetry undocumented — `DATA_ENTITY_ADD_TO_GROUP` and `DATA_ENTITY_DELETE_FROM_GROUP` are TWO DISTINCT permissions

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-151.md`)

---

## DOC-GAP-152 — DEG membership ADD-vs-DELETE CRUD idempotence asymmetry — POST raises 400 on duplicate; DELETE returns 204 SILENTLY on no-op

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-152.md`)

---

## DOC-GAP-154 — HARD-DELETE on relationship edges undocumented — DEG-membership unlink + term-unlink are physical `DELETE FROM`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-154.md`)

---

## DOC-GAP-155 — META-FINDING — `@ActivityLog` AOP aspect carries `@Profile("!integration-test")`; integration-test runs DISABLE the aspect

**Severity**: MEDIUM
**Category**: meta

**Full detail**: (sharded — see `detail/DOC-GAP-155.md`)

---

## DOC-GAP-158 — META-FINDING — REV-3 LAYER-0 pillar P-01 (Data Discovery) sub-feature overpromise — Data Entity Groups & Domains

**Severity**: MEDIUM
**Category**: meta

**Full detail**: (sharded — see `detail/DOC-GAP-158.md`)

---

## DOC-GAP-162 — `LineageDepth.empty()` sentinel encoding fragility — magic -1 encoding silently disabled by future refactor

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-162.md`)

---

## DOC-GAP-163 — `getDataEntityGroupsLineage` 404 conflates THREE semantically distinct conditions — DEG-not-found vs DEG-empty vs wrong-entity-type

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-163.md`)

---

## DOC-GAP-164 — Inner-DEG suppression deferred-feature debt at `LineageServiceImpl.java:71-75`

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-164.md`)

---

## DOC-GAP-165 — DEG-lineage edges crossing DEG boundary silently filtered — `getLineageRelations(List<String>)` requires BOTH endpoints in member set

**Severity**: MEDIUM
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-165.md`)

---

## DOC-GAP-167 — META-FINDING — REV-3 LAYER-0 pillar P-05 (Data Lineage) sub-feature overpromise; 7 axes the live page is silent on

**Severity**: MEDIUM
**Category**: meta

**Full detail**: `detail/DOC-GAP-167.md`

---

## DOC-GAP-169 — Tag name case-sensitivity divergence — `listByNames` case-sensitive vs `listMostPopular.query` substring case-insensitive **(NEW batch N)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-169.md`

---

## DOC-GAP-170 — Tag delete-then-recreate loses ALL prior assignment history + `listMostPopular` globally-scoped **(NEW batch N)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-170.md`

---

## DOC-GAP-171 — user_owner_mapping monotonic growth + cross-provider username display collisions in 4 sibling repositories' LEFT JOINs **(NEW batch N — strengthens DOC-GAP-149 META)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-171.md`

---

### LOW severity

## DOC-GAP-024 — OpenAPI tag `alert` has no `description:` field and no `externalDocs.url`

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-024.md`

---

## DOC-GAP-026 — AlertManager DTO drops `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`

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

## DOC-GAP-044 — Activity-feed partition advisory-lock-id has no doc + no per-feature collision matrix in the housekeeping page

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-044.md`

---

## DOC-GAP-063 — `housekeeping.cron` has 2 fewer config-tunable retention switches than its conceptual scope suggests

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-063.md`

---

## DOC-GAP-067 — `@Data`-generated `toString()` is the DURABLE secret-leak surface — Lombok auto-generates a getter-driven `toString()` on every `@ConfigurationProperties` POJO

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-067.md`

---

## DOC-GAP-069 — `ODD_IAM` provider is completely absent from docs

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-069.md`

---

## DOC-GAP-070 — `ODDOAuth2Properties.OAuth2Provider.adminUserInfoFlag` field is undocumented

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-070.md`

---

## DOC-GAP-088 — `IngestionDataEntitiesFilter.isValid` is silent-noop on validation failures

**Severity**: LOW
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-088.md`)

---

## DOC-GAP-126 — Backwards-Incompatible Schema (BIS) detection is silent on the consumer-collector authoring side

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-126.md`

---

## DOC-GAP-127 — Alert reopen race: open-reopened-in-flight-resolved is a 3-state machine

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-127.md`

---

## DOC-GAP-133 — Microservices lineage and data-entity lineage share the same React canvas component (`LineageGraph.tsx`); no toggle, no entity-class-specific rendering

**Severity**: LOW
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-133.md`)

---

## DOC-GAP-135 — Shift+Enter save shortcut on description edit is keyboard-shortcut convention but undocumented at the page level

**Severity**: LOW
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-135.md`)

---

## DOC-GAP-138 — `dataEntityId` URL parameter on `/dataentities/{id}` is unguarded against NaN / invalid numeric values

**Severity**: LOW
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-138.md`)

---

## DOC-GAP-148 — Per-job transaction-handling asymmetry across the 5 HousekeepingJob beans

**Severity**: LOW
**Category**: drift

**Full detail**: (sharded — see `detail/DOC-GAP-148.md`)

---

## DOC-GAP-172 — `term_to_term.deleted_at` schema-vs-application drift — V0_0_91 adds the column; 7 read sites never filter on it **(NEW batch N)**

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-172.md`

---

## Maintainer notes

(Free-form. Preserved across refreshes. Empty on first run.)
