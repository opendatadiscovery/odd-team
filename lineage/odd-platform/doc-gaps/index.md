---
artefact: doc-gaps
generated_at: "2026-05-20T00:00:00Z"
generated_at_commit: 80637ed
sidecar_count: 102
concepts_yaml_version: 9
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 197
findings_by_severity: { HIGH: 87, MEDIUM: 92, LOW: 18 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 173, missing-page: 9, stale-page: 0, coverage-gap: 4, meta: 9 }
reconciliation_note: |
  Batch S adds 2 NEW findings (0 HIGH + 2 MEDIUM + 0 LOW) — DOC-GAP-196 + 197 —
  and STRENGTHENS 5 existing entries (DOC-GAP-107 + DOC-GAP-180 + DOC-GAP-181 +
  DOC-GAP-122 + DOC-GAP-082 META). Batch R (PRIOR — was uncounted in index until
  this refresh) added 5 NEW findings: DOC-GAP-191..195 (4 HIGH + 1 MEDIUM).
  Combined batch R + S contribution: 7 NEW findings (4 HIGH + 3 MEDIUM + 0 LOW)
  + 5 STRENGTHENED (batch S).

  Batch S covers the 5 SERVICE-TIER ENCLOSING-CLASS sidecars: AlertServiceImpl +
  OwnerServiceImpl + PolicyServiceImpl + RoleServiceImpl +
  DataSourceIngestionServiceImpl — the SERVICE-TIER PRIMARY SOURCE layer for the
  pillar's load-bearing security + audit + transaction patterns. The batch
  closes the 4-LAYER-of-RBAC triangulation (controller batch E + service-tier
  batch I/S + repository batch H/N + UI batch Q) and supplies the explicit
  service-tier enactment for ADR-CANDIDATE-142 (partial-merge UPSERT) +
  ADR-CANDIDATE-143 (namespace-from-Collector) + REFACTOR-425 (empty-roles
  destructive UPDATE).

  NEW MEDIUM (batch S):
  - DOC-GAP-196 (Activity-feed emission asymmetry between in-platform alert
    ingestion and AlertManager webhook ingestion — WEBHOOK INGRESS is
    forensically silent at the ingress layer while alert-state-transitions ARE
    audited via the batch save path with `is_system_event=true`; operators
    expecting uniform audit coverage cannot reconstruct AlertManager-batch
    provenance from the platform's audit alone; per AlertServiceImpl batch-S
    sidecar coherence_sweep.strengthens[`alert_received_activity_events_persist_via_batch_save_path`]);
  - DOC-GAP-197 (Authorization HOT PATH — RoleServiceImpl.getCurrentUserRoles +
    PolicyServiceImpl.getCurrentUserPolicies together issue 2 separate
    multi-table JOINs on EVERY authorized HTTP request with NO request-scoped
    cache, NO user-scoped cache; for a busy platform with N req/s under
    LOGIN_FORM/OAUTH2/LDAP, the platform issues ~2N permission-resolution JOIN
    round-trips/s on top of business DB calls; live
    `/configuration-and-deployment/enable-security/authorization` does NOT
    describe per-request DB cost, cache absence, or capacity-planning
    guidance for high-RPS deployments; REFACTOR-389 + REFACTOR-384 cross-link).

  NEW HIGH (batch R — uncounted-in-index until this refresh):
  - DOC-GAP-191 (Activity Feed event-type 27-vs-20 — 7 undocumented enum values
    in code that operators see in the UI dropdown but cannot understand from
    the live doc page);
  - DOC-GAP-192 (Activity Feed scope STRUCTURALLY CONSTRAINED to data-entity
    events — `activity.data_entity_id NOT NULL` schema constraint means RBAC /
    Owner / Datasource / Collector mutations CANNOT physically emit even if
    `@ActivityLog` annotated; canonical SQL-tier primary source for DOC-GAP-083
    META audit-silence);
  - DOC-GAP-193 (Custom-Metadata feature COMPLETELY ABSENT from operator-facing
    docs — substantial feature with permissions, REST endpoints, 7
    MetadataTypeEnum values, but ZERO mention in the doc site);
  - DOC-GAP-194 (Collector token PLAINTEXT-AT-REST + AT-DOM-RENDER — TOKEN.value
    `varchar(40) NOT NULL` with no hashing, no encryption, no uniqueness
    constraint; pg_dump / replica / backup leak surface; STRENGTHENS DOC-GAP-189
    + DOC-GAP-038 + DOC-GAP-034).

  NEW MEDIUM (batch R — uncounted-in-index until this refresh):
  - DOC-GAP-195 (DatasetField description audit-invisible while internal-name +
    tags ARE audit-logged — within-feature asymmetric @ActivityLog pattern;
    documented event DATASET_FIELD_DESCRIPTION_UPDATED is NEVER fired;
    operators investigating description edits find NO Activity Feed evidence;
    one-line code fix + one doc-page edit; sibling to within-feature
    audit-asymmetry pattern that DOC-GAP-149 META captures).

  STRENGTHENED (batch S):
  - DOC-GAP-107 (AlertManager-webhook compound — now 6-VECTOR with new
    audit-provenance asymmetry dimension from DOC-GAP-196; batch S service-tier
    PRIMARY-SOURCE re-confirmed at schema v0.3.0 framing with explicit F-007
    facet correspondence; `coherence_sweep.strengthens` block names this entry
    + the forge+display compound with REFACTOR-024);
  - DOC-GAP-180 (ADR-CANDIDATE-142 partial-merge UPSERT — promoted to
    5-SIDECAR triangulated coverage; batch S DataSourceIngestionServiceImpl
    sidecar supplies the THIRD VERTEX (ENACTMENT POINT) of the ADR-142 + ADR-143
    triangulation; NEW corner cases: cross-collector ownership-preservation
    invariant, NO-FTS-vector-refresh on ingestion path, single-transaction
    rollback shape, concurrent-ingestion race window);
  - DOC-GAP-181 (Empty-roles destructive UPDATE — SERVICE-TIER ENCLOSING-CLASS
    PRIMARY-SOURCE; the destructive composition is anchored across THREE
    specific service-tier lines (71, 76-81, 117-122) in one class; new
    STRUCTURAL INSIGHT: the same destructive primitive is REUSED INTENTIONALLY
    by `delete` so the fix MUST live at the service-tier `getRoleIdsList`
    helper, NOT at the persistence primitive);
  - DOC-GAP-122 (PolicyService lost-update race — SYMMETRIC service-tier
    PRIMARY-SOURCE confirmation from the Role side + Owner side + Alert side;
    the platform-wide 4-RBAC-service @ReactiveTransactional comparison is now
    anchored: PolicyServiceImpl is the UNIQUE outlier (0/3) while RoleServiceImpl
    + OwnerServiceImpl + DataSourceIngestionServiceImpl are uniformly
    transactional);
  - DOC-GAP-082 META (DISABLED-bypasses-RBAC primary surface — now 29-sidecar
    (was 24 in batch Q); batch S adds 5 service-tier sidecars including the
    EXPLICIT keys-to-the-kingdom escalation chain narrative at the
    RoleServiceImpl service-tier; NEW STRUCTURAL DIMENSION: cross-collector
    namespace-tenancy boundary is PRESERVED even under DISABLED-compositional
    bypass via DataSourceIngestionServiceImpl).

  Coherence: strengthens=5 supersedes=0 conflicts_surfaced=0.

  Severity buckets: HIGH = 83 + 4 (batch R DOC-GAP-191/192/193/194) + 0 (batch S) = 87;
  MEDIUM = 89 + 1 (batch R DOC-GAP-195) + 2 (batch S DOC-GAP-196/197) = 92;
  LOW = 18 + 0 + 0 = 18.
  Total 87 + 92 + 18 = 197 — matches batch Q's 190 + 5 batch R + 2 batch S = 197.

  0 direct live WebFetches at status 200 this session (per LSN-018 stale-probe
  cadence — all relevant doc URLs were WebFetched within the 11-day window in
  batch P + Q + R: `/features/active-platform-features/alerting` (batch P,
  2026-05-20 status 200), `/configuration-and-deployment/odd-platform`
  (#prometheus-alertmanager-integration; batch P, 2026-05-20 status 200),
  `/developer-guides/api-reference/alerts` (batch H/I inherited 2026-05-08
  status 200), `/configuration-and-deployment/enable-security/authentication`
  (batch Q, 2026-05-20 status 200), `/configuration-and-deployment/enable-security/authorization`
  (batch E inherited 2026-05-12 status 200), `/features/management` (batch Q,
  2026-05-20 status 200), `/features/active-platform-features/activity-feed`
  (batch R inherited 2026-05-20 status 200), `/configuration-and-deployment/enable-security/authorization/owners`
  (batch P, 2026-05-20 status 200), `/configuration-and-deployment/enable-security/authorization/policies`
  (batch E inherited 2026-05-12 status 200), `/configuration-and-deployment/enable-security/authorization/roles`
  (batch E inherited 2026-05-12 status 200), `/configuration-and-deployment/enable-security/authorization/permissions`
  (batch P inherited 2026-05-20 status 200). All inherited within
  stale-probe cadence per the LSN-018 protocol.

  Batch S is the FIRST batch covering the 5 SERVICE-TIER ENCLOSING-CLASS
  sidecars for the load-bearing security + audit + transaction patterns —
  AlertServiceImpl (the AlertManager-webhook + the user-driven mutation +
  the in-platform ingestion in one class), OwnerServiceImpl (Owner directory
  CRUD trinity + cascade-delete-defence), PolicyServiceImpl (RBAC policy CRUD
  + the AUTHORIZATION HOT PATH consumer), RoleServiceImpl (RBAC role CRUD +
  the AUTHORIZATION HOT PATH entry), DataSourceIngestionServiceImpl (collector
  datasource registration with partial-merge UPSERT semantics). The 2 new
  findings span the activity-feed emission asymmetry on the AlertManager
  webhook ingress (DOC-GAP-196) + the authorization HOT PATH performance
  characteristics (DOC-GAP-197). YAML-safe emit.
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
  - "2026-05-19 (batch O): DOC-GAP-173..177 — refresh after batch 2026-05-19-O (5 sidecars: GoogleUserHandler + GithubUserHandler + AzureLogoutSuccessHandler + CognitoLogoutSuccessHandler + IngestionDataEntitiesFilter). 5 NEW (2 HIGH + 3 MEDIUM + 0 LOW); 3 STRENGTHENED (DOC-GAP-038 with NEW filter-class-layer evidence; DOC-GAP-048 with 2-LAYER TRIANGULATION at consumer-site `URI.create()` NPE; DOC-GAP-082 META to 14-sidecar via path-matching-is-the-gating-mechanism primary-source statement). NEW HIGH: DOC-GAP-173 (Google admin-groups silent no-op) + DOC-GAP-177 (GitHub username-rename orphans USER_OWNER_MAPPING). NEW MEDIUM: DOC-GAP-174 (GHES silent incompatibility) + DOC-GAP-175 (logout-flow provider-asymmetry: Google/GitHub revoke vs Azure/Cognito local-only) + DOC-GAP-176 (GitHub admin-principals BYPASSES organization-name gate). 4 live URLs WebFetched at status 200 via sidecars + 1 direct WebFetch this session for the 8-question audit of the OAuth2/OIDC docs page (all 8 axes confirmed undocumented). Batch O is the FIRST batch covering the AUTH PROVIDER USER-ENRICHMENT + LOGOUT surface; coherence: strengthens=3, supersedes=0, conflicts_surfaced=0. YAML-safe emit."
  - "2026-05-20 (batch P): DOC-GAP-178..184 — refresh after batch 2026-05-20-P (Owner directory mutation surface + Datasource registration controller-method tier: OwnerController.updateOwner + OwnerController.deleteOwner + IngestionController.createDataSource). 7 NEW (3 HIGH + 4 MEDIUM); STRENGTHENED DOC-GAP-082 META to 17-sidecar + DOC-GAP-083 META to 8-sidecar (cross-pillar — P-08 Management Owner directory + P-10 Ingestion-side datasource registration); the Owner mutation surface adds the 17th-19th surfaces; the IngestionController.createDataSource finding is the 19th surface via composition (DISABLED → UI is open → create-collector → token-leak → datasource registration). Batch P registers as 12 unsharded inline entries + 7 detail/ shards; 172 detail / 184 reported."
  - "2026-05-20 (batch Q): DOC-GAP-185..190 — refresh after batch 2026-05-20-Q (5 UI-axis sidecars: AppToolbar UI shell + PolicyList + RolesList + OwnersList + CollectorsList — the Management mutation surface UI tier). 6 NEW (2 HIGH + 4 MEDIUM + 0 LOW); 5 STRENGTHENED (DOC-GAP-082 META to 24-sidecar via UI-tier operator-facing UX manifestation; DOC-GAP-083 META extended to 9+-sidecar via UI tier forensic silence; DOC-GAP-106 with UI-tier ASYMMETRIC manifestation; DOC-GAP-137 META to 9-sidecar UI test coverage with 50+ new uncovered behaviours; DOC-GAP-181 with UI-reachability dimension — 3-click destructive hazard). NEW HIGH: DOC-GAP-187 (UI-vs-API asymmetry under DISABLED — operator-trap class) + DOC-GAP-188 (Empty-roles destructive UPDATE UI-reachable in 3 clicks). NEW MEDIUM: DOC-GAP-185 (SPA UI auth model undocumented) + DOC-GAP-186 (Management tab visibility doc-contradiction) + DOC-GAP-189 (Collector token UX 4-caveat) + DOC-GAP-190 (Soft-deleted Policies in role chip list — UI asymmetry). 2 direct live WebFetches at status 200 this session (`/configuration-and-deployment/enable-security/authentication` + `/features/management`); 7 sibling-sidecar inherited WebFetches at status 200. Coherence: strengthens=5, supersedes=0, conflicts_surfaced=0. Batch Q is the FIRST batch covering the MANAGEMENT UI MUTATION SURFACE — the operator-facing UX manifestation of the entire RBAC + Owner directory + Collector token authoring catalog of findings. YAML-safe emit."
  - "2026-05-20 (batch R): DOC-GAP-191..195 — refresh after batch 2026-05-20-R (5 repository-tier sidecars: ReactiveActivityRepositoryImpl + ReactiveDataSourceRepositoryImpl + ReactiveMetadataFieldRepositoryImpl + ReactiveCollectorRepositoryImpl + ReactiveDatasetFieldRepositoryImpl — the Activity feed + Datasource + Metadata + Collector + DatasetField repository tiers). 5 NEW (4 HIGH + 1 MEDIUM + 0 LOW); STRENGTHENED DOC-GAP-180 (SQL-tier primary source confirms partial-merge is service-tier convention not repo-tier enforcement; NEW listDto predicate divergence finding) + DOC-GAP-189 (token-storage shape) + DOC-GAP-149 META (to 8-sub-mechanism). NEW HIGH: DOC-GAP-191 (Activity Feed event-type 27-vs-20) + DOC-GAP-192 (Activity Feed scope structurally constrained — schema-tier root cause of audit-silence pattern) + DOC-GAP-193 (Custom-Metadata feature absent from docs) + DOC-GAP-194 (Collector token plaintext-at-rest). NEW MEDIUM: DOC-GAP-195 (DatasetField description audit-invisible). Live WebFetches at status 200 confirmed via sidecars. Batch R is the FIRST batch covering the SCHEMA + repository tier of the Activity + Datasource + Metadata + Collector + DatasetField surfaces. YAML-safe emit. Note: batch R was authored as detail/ shards only; this index reconciliation in batch S brings the index/headline list in sync with the existing shards."
  - "2026-05-20 (batch S): DOC-GAP-196..197 — refresh after batch 2026-05-20-S (5 service-tier ENCLOSING-CLASS sidecars: AlertServiceImpl + OwnerServiceImpl + PolicyServiceImpl + RoleServiceImpl + DataSourceIngestionServiceImpl — the service-tier PRIMARY SOURCE layer). 2 NEW (0 HIGH + 2 MEDIUM + 0 LOW); 5 STRENGTHENED (DOC-GAP-107 with 6th vector via audit-provenance asymmetry; DOC-GAP-180 promoted to 5-sidecar via ADR-142+143 service-tier ENACTMENT primary source; DOC-GAP-181 with service-tier enclosing-class anchor — destructive composition across 3 lines; DOC-GAP-122 with symmetric service-tier confirmation of the platform-wide 4-RBAC-service @ReactiveTransactional comparison; DOC-GAP-082 META to 29-sidecar via 5 NEW service-tier sidecars + the explicit keys-to-the-kingdom escalation chain at RoleServiceImpl service-tier). NEW MEDIUM: DOC-GAP-196 (Activity-feed emission asymmetry in-platform vs webhook ingress) + DOC-GAP-197 (Authorization HOT PATH no caching — REFACTOR-389/384 cross-link). 0 direct WebFetches this session (all relevant URLs inherited within stale-probe cadence). Coherence: strengthens=5, supersedes=0, conflicts_surfaced=0. Batch S is the FIRST batch covering the 5 SERVICE-TIER ENCLOSING-CLASS sidecars for the platform's load-bearing security + audit + transaction patterns. Batch S also reconciles the index with the 5 batch-R shards (DOC-GAP-191..195) that were authored as detail/ shards in batch R but not previously added to the index headline list. YAML-safe emit."
maintainer_curated: false
confidence_overall: HIGH
---

# Doc gaps — odd-platform — 2026-05-20 (batch S refresh + batch R reconciliation)

## Summary

- **Findings**: 197 total (87 HIGH, 92 MEDIUM, 18 LOW)
- **By category**: broken-url 9, drift 173, missing-page 9, coverage-gap 4, meta 9
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). Batch S adds 2 NEW findings (0 HIGH + 2 MEDIUM + 0 LOW) AND strengthens 5 existing findings; the batch also reconciles the index with the 5 batch-R shards (DOC-GAP-191..195) that were authored in batch R but not previously included in the index headline list. The combined batch R + S contribution to this refresh is 7 NEW findings (4 HIGH + 3 MEDIUM + 0 LOW) + 5 STRENGTHENED.
- **Notable patterns**:
  - **NEW 2026-05-20 batch S: FIRST coverage of the 5 SERVICE-TIER ENCLOSING-CLASS sidecars** — AlertServiceImpl + OwnerServiceImpl + PolicyServiceImpl + RoleServiceImpl + DataSourceIngestionServiceImpl. The batch closes the 4-LAYER triangulation across all major load-bearing surfaces: controller (batch E/F/P) + service (batch I/S) + repository (batch H/N/R) + UI (batch J/Q). The service-tier primary sources supply the EXPLICIT enactment anchors for ADR-CANDIDATE-142 (partial-merge UPSERT) + ADR-CANDIDATE-143 (namespace-from-Collector) + REFACTOR-425 (empty-roles destructive UPDATE). Coherence: strengthens=5 supersedes=0 conflicts_surfaced=0.
  - **NEW 2026-05-20 batch S: PLATFORM-WIDE @ReactiveTransactional PATTERN COMPARISON is now anchored** — DOC-GAP-122 strengthen produces the 4-RBAC-service comparison: PolicyServiceImpl (0/3 mutating methods annotated — the UNIQUE outlier) + RoleServiceImpl (3/3) + OwnerServiceImpl (3/3) + AlertServiceImpl (partial-by-design: handleExternalAlerts + applyAlertActions YES; updateStatus NO, delegated to ActivityAspect AOP) + DataSourceIngestionServiceImpl (1/1). The case-law cross-batch triangulation confirms PolicyServiceImpl's complete absence is the oversight, not the intentional design.
  - **NEW 2026-05-20 batch S: DOC-GAP-180 promoted to FIFTH-SIDECAR triangulated coverage** — the ADR-CANDIDATE-142 (partial-merge UPSERT) + ADR-CANDIDATE-143 (namespace-from-Collector) cross-layer triangulation now has the EXPLICIT service-tier ENACTMENT primary source via DataSourceIngestionServiceImpl. The 3-line copy-construct-then-setter pattern at `prepareForUpdate` is the structural signal that the maintainer chose two-fields-only deliberately; the cross-collector ownership-preservation invariant is enforced by the same service-tier convention.
  - **NEW 2026-05-20 batch S: DISABLED-bypass META now 29-sidecar via SERVICE-TIER addition** — DOC-GAP-082 META was 24-sidecar at batch Q; batch S adds 5 service-tier sidecars including the EXPLICIT keys-to-the-kingdom escalation chain narrative at RoleServiceImpl + OwnerServiceImpl service-tier. NEW STRUCTURAL DIMENSION: the cross-collector namespace-tenancy boundary is PRESERVED even under DISABLED-compositional bypass (via DataSourceIngestionServiceImpl's `MappingUtils.extractFieldFromNullableObject(c.namespace(), NamespacePojo::getId)` line 106). The 7-tier triangulation (wiring → config → filter → controller → service → repository → UI) is now COMPLETE.
  - **NEW 2026-05-20 batch S: DOC-GAP-181 destructive composition anchored at THREE service-tier lines** — the empty-roles destructive UPDATE is composed across `OwnerServiceImpl.java:71` (call) + `OwnerServiceImpl.java:117-122` (collapse helper) + `OwnerServiceImpl.java:76-81` (cascade). NEW STRUCTURAL INSIGHT: the same destructive primitive is REUSED INTENTIONALLY by `delete` (line 97) — the fix MUST live at the service-tier helper, NOT at the persistence primitive (fixing it lower would break the legitimate `delete` semantic).
  - **NEW 2026-05-20 batch S: AlertManager-webhook compound finding extends to 6 VECTORS** — DOC-GAP-107 now has the audit-provenance asymmetry dimension (DOC-GAP-196 NEW) added to the existing 5 vectors (coverage-gap + entity_oddrn-spoof + no-dedup + undocumented OpenAPI + generatorURL XSS). The WEBHOOK INGRESS is forensically silent at the ingress layer while alert-state-transitions ARE audited via the batch save path — operators expecting uniform audit cannot reconstruct AlertManager-batch provenance from the platform's audit alone.
  - **NEW 2026-05-20 batch S: AUTHORIZATION HOT PATH performance dimension (DOC-GAP-197)** — RoleServiceImpl.getCurrentUserRoles + PolicyServiceImpl.getCurrentUserPolicies together issue 2 multi-table JOINs on EVERY authorized HTTP request with NO cache; for high-RPS deployments (sustained 50+ req/s) the cost is unbounded; live doc has ZERO mention of per-request authorization DB cost or capacity-planning guidance. Cross-link to REFACTOR-389 + REFACTOR-384.
  - **NEW 2026-05-20 batch R reconciliation: 5 SCHEMA+REPOSITORY-tier findings now visible in the index** — batch R authored DOC-GAP-191..195 as detail/ shards but did not update the index headline list; this batch-S refresh reconciles. The 4 HIGH new entries: DOC-GAP-191 (Activity Feed enum 27-vs-20), DOC-GAP-192 (Activity Feed schema-tier root cause of audit-silence), DOC-GAP-193 (Custom-Metadata absent from docs), DOC-GAP-194 (Collector token plaintext-at-rest). The 1 MEDIUM new entry: DOC-GAP-195 (DatasetField description audit-invisible).
  - (Earlier batches' notable-pattern bullets preserved in detail/ shards; the structural insight is the COMPLETE 4-LAYER-of-RBAC + cross-layer enactment-points at batch S.)

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 197

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

## DOC-GAP-038 — `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap **(batch O: NEW filter-class-layer primary source adds 5 dimensions — path-matcher-exact-literal, body-buffered-before-auth DoS, plaintext-equality non-constant-time, NotFoundException → 5xx misleading, REFACTOR-185 cross-link; batch Q: NEW UI-tier amplification via DOC-GAP-189 — Collectors tab promises rotation security the filter-off default does not enforce; batch R: NEW SQL-tier primary source via DOC-GAP-194 — TOKEN.value plaintext-at-rest)**

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

## DOC-GAP-048 — OAuth2 docs flag Azure `logout-uri` as REQUIRED but `ODDOAuth2Properties.validate()` only checks `clientId` and `provider` — operator boots successfully and fails at first logout **(batch O: 2-LAYER TRIANGULATION — consumer-site NPE at `AzureLogoutSuccessHandler.java:39` `URI.create()` confirmed; sibling-asymmetry vs Cognito's `StringUtils.isEmpty` guard)**

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

## DOC-GAP-082 — META-FINDING — `auth.type=DISABLED` BYPASSES the entire Authorization framework; ALL admin operations are anonymously reachable on a network-exposed deployment; **29-sidecar** triangulated cluster **(batch S: NEW 5 service-tier enclosing-class sidecars + EXPLICIT keys-to-the-kingdom escalation chain narrative anchored at RoleServiceImpl + cross-collector namespace-tenancy preserved-under-bypass observation via DataSourceIngestionServiceImpl; 7-tier triangulation COMPLETE)**

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — META-FINDING — No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD audit asymmetry **(batch Q: now 9+-sidecar via UI tier forensic silence — Management UI surfaces emit no console.log, no audit-mode toast, no persistent audit panel; batch R: schema-tier root cause confirmed at DOC-GAP-192 — `activity.data_entity_id NOT NULL` makes audit-silence STRUCTURAL not BUG-LEVEL)**

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

## DOC-GAP-106 — Authorization HOT PATH soft-delete leak — REFACTOR-201 confirms the AUTHORIZATION HOT PATH does NOT use `addSoftDeleteFilter` **(batch N: symmetric Role-side LEFT JOIN gap; batch Q: UI-tier ASYMMETRIC manifestation confirmed via DOC-GAP-190 — Policies tab correctly filters, Roles-tab chip-list renders soft-deleted policies)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-106.md`

---

## DOC-GAP-107 — AlertManager-webhook compound finding — `AlertManagerController.alertManagerWebhook` at `POST /ingestion/alert/alertmanager` bypasses `IngestionDataEntitiesFilter` AND `ReactiveAlertRepositoryImpl.createAlerts` has NO `ON CONFLICT` **(batch S: 6th vector — audit-provenance asymmetry via DOC-GAP-196; service-tier PRIMARY-SOURCE re-confirmed at schema v0.3.0 framing with explicit F-007 facet correspondence)**

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

## DOC-GAP-137 — META-FINDING — ZERO UI test coverage across the entire `odd-platform-ui` SPA **(batch Q: now 9-sidecar with AppToolbar + RolesList + PolicyList + OwnersList + CollectorsList; 50+ new uncovered-behaviour candidates)**

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

## DOC-GAP-173 — Google `admin-groups` is silently no-op — POJO binds the field but `GoogleUserHandler` never reads `provider.getAdminGroups()`; operator copying Cognito/GitHub admin-groups pattern to Google gets zero behaviour change and zero warning **(NEW batch O — FIRST DOC-GAP on per-provider config-bind-vs-handler-coverage asymmetry)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-173.md`

---

## DOC-GAP-177 — GitHub username-rename produces an orphan `USER_OWNER_MAPPING` row — GitHub allows free `login` renames; the handler uses `login` as the username key; a renamed user's prior owner-linkage is silently orphaned; NO id-based fallback **(NEW batch O — FIRST DOC-GAP on the GitHub-specific facet of the compound-key-silent-in-docs family; strengthens DOC-GAP-149 META to 8-sub-mechanism)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-177.md`

---

## DOC-GAP-181 — `PUT /api/owners/{owner_id}` — empty `roles` field SILENTLY DESTROYS all role bindings on the Owner; combined with audit-silence (DOC-GAP-083), role-stripping is silent AND irreversible from logs **(NEW batch P — OwnerController.updateOwner controller-method primary source; batch Q: UI-reachability dimension added — DOC-GAP-188 confirms hazard reachable in 3 UI clicks; batch S: SERVICE-TIER ENCLOSING-CLASS PRIMARY-SOURCE — destructive composition anchored across 3 service-tier lines (71, 76-81, 117-122); same primitive REUSED by `delete` line 97 — fix MUST live at the service-tier helper not the persistence primitive)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-181.md`

---

## DOC-GAP-187 — **UI-vs-API asymmetry under `auth.type=DISABLED` — the Management UI looks LOCKED-DOWN while the backend ACCEPTS anonymous mutations** (operator-trap class) — under DISABLED, `/api/identity` returns `permissions: []`, the SPA's WithPermissions HOC universally hides Create/Edit/Delete buttons; operator infers "locked down"; backend permits all exchanges; STRENGTHENS DOC-GAP-082 META by adding the 20th-24th sidecar surfaces (UI-tier operator-facing UX manifestation) **(NEW batch Q — 5 UI-axis sidecars; CollectorsList sidecar identifies itself as 19th sidecar facet of REFACTOR-185)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-187.md`

---

## DOC-GAP-188 — Empty-roles destructive UPDATE on Owner is REACHABLE FROM THE UI in three clicks with NO confirmation modal — `OwnerForm.tsx:77` validates ONLY name; roles field has no validation; formState.isValid stays true after removing all role chips; Save dispatches updateOwner with `roles:[]` triggering F-019 batch-P destructive-default path; Edit-vs-Delete UX asymmetry inverted (Delete prompts ConfirmationDialog; Edit-with-empty-roles does NOT, even though Edit-with-empty-roles is the IRREVERSIBLE operation per F-019 hard-delete + no audit) — STRENGTHENS DOC-GAP-181 from API-consumer hazard to UI-operator-reachable hazard **(NEW batch Q — OwnersList UI sidecar primary source for the 3-click UI reachability and the inverted UX-confirmation pattern)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-188.md`

---

## DOC-GAP-191 — **Activity Feed event-type enumeration is INCOMPLETE — 27 event types in code vs 20 documented (7-event gap)** — the live `/features/active-platform-features/activity-feed` page enumerates only 20 of the 27 values in `ActivityEventTypeDto.java:3-31`; the seven undocumented types are `DATA_ENTITY_OVERVIEW_UPDATED`, `DATA_ENTITY_METADATA_UPDATED`, `DATA_ENTITY_SCHEMA_UPDATED`, `DATA_ENTITY_RELATION_UPDATED`, `CUSTOM_METADATA_CREATED`, `CUSTOM_METADATA_UPDATED`, `CUSTOM_METADATA_DELETED`; operators reading the Activity Feed see rows with `event_type` values the docs do not enumerate AND filter UI populates from the same enum (operators using the dropdown SEE the 7 additional values but the live doc page does not explain what they MEAN); the doc-side framing presents a closed enumeration of 20 (no "etc.") which is an active mis-statement **(NEW batch R — ReactiveActivityRepositoryImpl sidecar PRIMARY SOURCE; live WebFetch 2026-05-20 status 200 confirms exactly 20 enumerated values)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-191.md`

---

## DOC-GAP-192 — **Activity Feed scope is STRUCTURALLY CONSTRAINED to data-entity events** — `activity.data_entity_id` is `NOT NULL` with FK to `data_entity(id)` (V0_0_48__add_activity.sql:4,12); RBAC mutations (Role / Policy / Owner CRUD), Datasource registration, Collector token rotations, Namespace mutations CANNOT physically emit an activity row even if a future `@ActivityLog` annotation were added; the live page is silent on this scoping constraint; this is the canonical SQL-tier primary source for the DOC-GAP-083 META audit-silence pattern — the platform's choice of `data_entity_id NOT NULL` commits the activity table to data-entity-scoped audit; a separate `platform_event` table would be required to capture non-data-entity mutations **(NEW batch R — ReactiveActivityRepositoryImpl sidecar PRIMARY SOURCE for the SCHEMA-TIER CONSTRAINT; STRENGTHENS DOC-GAP-083 META + DOC-GAP-149 META)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-192.md`

---

## DOC-GAP-193 — **Custom-Metadata feature is COMPLETELY ABSENT from operator-facing documentation** — neither `/features/data-discovery` (the natural P-01 home per system-mission.md) nor any other page in the docs site mentions `custom metadata`, `metadata field`, `metadata key`, or custom key-value annotation of data entities; the platform ships a substantial Custom Metadata feature (DATA_ENTITY_CUSTOM_METADATA_* permissions; `metadata_field` + `metadata_field_value` tables; `MetadataFieldController.listInternalMetadata`; `DataEntityController.upsertDataEntityMetadataFieldValue`; `MetadataIngestionRequestProcessor`; `INTERNAL` + `EXTERNAL` origin distinction; 7 MetadataTypeEnum values) — yet the live docs contain ZERO mention of the feature; operators evaluating ODD for a metadata-annotation use case CANNOT discover the feature from documentation alone **(NEW batch R — ReactiveMetadataFieldRepositoryImpl sidecar PRIMARY SOURCE; live WebFetch 2026-05-20 status 200 confirms absence; STRENGTHENS the batch-L DOC-GAP-156)**

**Severity**: HIGH
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-193.md`

---

## DOC-GAP-194 — **Collector token PLAINTEXT-AT-REST + AT-DOM-RENDER undocumented as operator-side threat model** — TOKEN.value is `varchar(40) NOT NULL` with NO hashing, NO encryption, NO uniqueness constraint (V0_0_28__add_token.sql:1-9); SQL match is plaintext equality (`TOKEN.VALUE.eq(token)`); every DB-side reader (replica, backup, pg_dump, jOOQ log leak, application log leak) recovers every live credential; soft-deleted collectors leave their TOKEN row orphaned; two collectors could share the same token value (no UNIQUE); at the UI tier the token renders as DOM text node on creation (one-shot plaintext visibility per DOC-GAP-189); operator's threat model is bearer-token-storage, not "the platform looks up tokens"; the doc-side fix is an explicit Token storage section + cross-link the UI-tier UX caveats from DOC-GAP-189 **(NEW batch R — ReactiveCollectorRepositoryImpl sidecar PRIMARY SOURCE; STRENGTHENS DOC-GAP-189 + DOC-GAP-038 + DOC-GAP-034)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-194.md`

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

## DOC-GAP-034 — Token Rotation operational mechanics absent from enable-security pages **(batch Q: NEW UI-tier complement via DOC-GAP-189 — Collectors tab UX 4-caveat: one-shot visibility, substring-prefix sniff, no-grace-period, rotation-no-effect-under-default; batch R: NEW SQL-tier primary source via DOC-GAP-194 — TOKEN.value plaintext-at-rest)**

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

## DOC-GAP-075 — Owners live doc page omits creation mechanics — 8 sub-findings **(batch K: 3-sidecar; batch Q: 9th sub-finding on UI-side empty-roles hazard per DOC-GAP-188)**

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

## DOC-GAP-122 — PolicyService lost-update race on `PUT /api/policies/{id}` — `PolicyServiceImpl.update` is NOT `@ReactiveTransactional` **(batch S: SYMMETRIC service-tier confirmation from Role + Owner + Alert + DataSourceIngestion services; the platform-wide 4-RBAC-service @ReactiveTransactional comparison is now anchored: PolicyServiceImpl is the UNIQUE outlier 0/3 while RoleServiceImpl + OwnerServiceImpl + DataSourceIngestionServiceImpl uniformly transactional)**

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

## DOC-GAP-149 — META-FINDING — REV-3 LAYER-0 pillar-overpromise: `system-mission.md` P-09 (Security & Access Control) sub-feature "User-owner association" Confidence: HIGH; live page contains one one-sentence runtime-semantic claim **(batch N: 7-sub-mechanism + 3-layer confirmation; batch O cross-link via DOC-GAP-177 GitHub-rename adds 8th sub-mechanism; batch R: DOC-GAP-192 + DOC-GAP-195 add the 9th + 10th sub-mechanisms — schema-tier constraint + within-feature asymmetric @ActivityLog)**

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

## DOC-GAP-174 — `GithubUserHandler` hard-codes `WebClient.create("https://api.github.com")` — GitHub Enterprise Server (GHES) deployments silently incompatible; no `apiBaseUrl` field on `ODDOAuth2Properties.OAuth2Provider`; first user login fails with DNS/cert errors **(NEW batch O — FIRST DOC-GAP on GHES incompatibility)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-174.md`

---

## DOC-GAP-175 — Logout-flow provider-asymmetry — Google + GitHub actively REVOKE IdP tokens; Azure + Cognito + ODD_IAM invalidate ONLY the local WebSession; tokens at Azure / Cognito remain valid until natural TTL; compliance-relevance for regulated industries **(NEW batch O — FIRST DOC-GAP on the logout-revocation-vs-end-session asymmetry across 5 sibling handlers)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-175.md`

---

## DOC-GAP-176 — GitHub `admin-principals` BYPASSES the `organization-name` membership gate — `adminPrincipals: [external-consultant]` grants ADMIN even to users NOT in `organizationName`; live docs describe the two fields independently without flagging precedence **(NEW batch O — FIRST DOC-GAP on the GitHub admin-principals-vs-org gate precedence)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-176.md`

---

## DOC-GAP-185 — SPA UI auth model (no-local-login-form + OIDC-redirect-only + logout-is-full-page-navigation + user-identifier-fallback-to-raw-username) is undocumented on the operator-facing enable-security pages — the `documentation/docs/configuration-and-deployment/enable-security/authentication` tree describes the 4 backend `auth.type` modes but says NOTHING about how the SPA shell behaves in each mode **(NEW batch Q — AppToolbar UI-shell sidecar PRIMARY SOURCE for the SPA's auth UX contract)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-185.md`

---

## DOC-GAP-186 — Management top-nav tab visibility CONTRADICTS the live `/features/management` doc — live docs say "Tab visibility is permission-aware" but `ToolbarTabs.tsx:34-82` enumerates ALL 9 top-level tabs UNCONDITIONALLY with NO permission predicate; the Management tab itself is visible to every authenticated user regardless of `*_MANAGE` permission holdings **(NEW batch Q — AppToolbar UI-shell sidecar PRIMARY SOURCE; structural cause of DOC-GAP-187's UX manifestation)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-186.md`

---

## DOC-GAP-189 — Collector token UX 4-caveat undocumented — (a) one-shot plaintext visibility; (b) masking detection via fragile substring-prefix sniff (`value.substring(0,6) === '******'`); (c) no UI warning that rotation has no grace period; (d) no UI warning that rotation has NO security effect under default `auth.ingestion.filter.enabled=false` — live `/features/management` doc describes "rotate or revoke" without surfacing any of the four UX caveats **(NEW batch Q — CollectorsList UI sidecar PRIMARY SOURCE; STRENGTHENS DOC-GAP-038 + DOC-GAP-034; batch R: NEW SQL-tier primary source via DOC-GAP-194 — TOKEN.value plaintext-at-rest)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-189.md`

---

## DOC-GAP-190 — Soft-deleted Policies STILL render as named chips on the Roles tab AND DO NOT render in the Policies list — asymmetric UI manifestation of the F-006 catalogue-vs-grant pattern visible across two Management surfaces simultaneously; combined with the GRANT-path `getRolesPolicies` (DOC-GAP-106) the soft-deleted Policy STILL CONFERS PERMISSIONS to any role bound to it **(NEW batch Q — RolesList + PolicyList UI sidecars PRIMARY SOURCE; STRENGTHENS DOC-GAP-106 + DOC-GAP-112)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-190.md`

---

## DOC-GAP-195 — **DatasetField description edits are AUDIT-INVISIBLE while internal-name edits ARE audit-logged** — `DatasetFieldServiceImpl.updateInternalName` (line 99) and `updateDatasetFieldTags` (line 119) carry `@ActivityLog` annotations; `DatasetFieldServiceImpl.updateDescription` (line 87) has NONE; the documented Activity Feed event-type enumeration lists `DATASET_FIELD_DESCRIPTION_UPDATED` under "Dataset fields (columns)" yet the implementation does NOT emit it — a doc-vs-code contradiction; operators investigating a column's description history find NO entry in the Activity Feed and incorrectly conclude "no one edited it" when in fact the description WAS edited (the platform persisted it verbatim per F-004) but the audit-emit step was skipped; one-line code fix + one-doc-page edit **(NEW batch R — ReactiveDatasetFieldRepositoryImpl sidecar PRIMARY SOURCE; cross-references DOC-GAP-191 + DOC-GAP-149 META + DOC-GAP-083 META; sibling within-feature asymmetric pattern)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-195.md`

---

## DOC-GAP-196 — **Activity-feed emission ASYMMETRY between in-platform alert ingestion and AlertManager webhook ingestion** — the WEBHOOK INGRESS is forensically silent at the ingress layer (no `log.info` of who POSTed, no `@Timed` metric, no correlation-id, no source IP/User-Agent capture) while the resulting alert-state-transitions ARE audited via the batch save path with `is_system_event=true`; operators expecting uniform audit coverage cannot reconstruct AlertManager-batch provenance from the platform's audit alone (the operator-investigative scenario "which AlertManager instance sent these 200 alerts at 03:47?" has NO platform-side answer); the live `/features/active-platform-features/activity-feed` page lists OPEN_ALERT_RECEIVED under "Alerts" but does not describe the ASYMMETRIC PROVENANCE; SQL-tier substrate per AlertServiceImpl batch-S sidecar `coherence_sweep.strengthens.[alert_received_activity_events_persist_via_batch_save_path]` and per batch R `ReactiveActivityRepositoryImpl` save path **(NEW batch S — AlertServiceImpl service-tier sidecar PRIMARY SOURCE; STRENGTHENS DOC-GAP-107 with 6th VECTOR; cross-references DOC-GAP-149 META + DOC-GAP-191 + DOC-GAP-192)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-196.md`

---

## DOC-GAP-197 — **Authorization HOT PATH issues 2 multi-table JOINs per authorized request with NO caching** — `RoleServiceImpl.getCurrentUserRoles` (5-table JOIN over user_owner_mapping ⋈ owner_to_role ⋈ role ⋈ role_to_policy ⋈ policy) + `PolicyServiceImpl.getCurrentUserPolicies` (2-table JOIN over policy ⋈ role_to_policy) together fire on EVERY authorized HTTP request via ManagementPermissionExtractor + AbstractContextualPermissionExtractor; for a busy platform with N req/s under LOGIN_FORM/OAUTH2/LDAP, the platform issues ~2N permission-resolution JOIN round-trips/s on top of business DB calls; cost is correctness-preserving (always-fresh permissions) but unbounded; live `/configuration-and-deployment/enable-security/authorization` does NOT mention per-request DB cost, cache absence, or capacity-planning guidance for high-RPS deployments; cross-link REFACTOR-389 + REFACTOR-384 (the authorization-hot-path caching recommendations) **(NEW batch S — RoleServiceImpl + PolicyServiceImpl 2-sidecar PRIMARY SOURCE; cross-references DOC-GAP-106 + DOC-GAP-122 + DOC-GAP-082 META + DOC-GAP-116 META)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-197.md`

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
#### Batch 2026-05-20-X — refresh after 5 CONFIG-CLASS sidecars (LoginFormSecurityConfiguration + NotificationConfiguration + SessionConfiguration + R2DBCConfiguration + MinioConfig)

Batch X covers the FOUNDATIONAL CONFIG-CLASS substrate — the `@Configuration` beans that wire the auth chain (LOGIN_FORM), the alert-notification subsystem (Slack / Webhook / SMTP), the HTTP session backing store (IN_MEMORY / INTERNAL_POSTGRESQL / REDIS), the reactive R2DBC pools (primary + custom for Lookup Tables), and the REMOTE attachment-storage client. These are the LOAD-BEARING WIRING SUBSTRATES every other layer depends on — and ALL FIVE carry doc-vs-code drift that operators cannot detect without code-side audit.

**NEW (15)**: DOC-GAP-218..232

**HIGH (6)**:
- **DOC-GAP-218** (LOGIN_FORM mode AuthorizationCustomizer absent — every form-authenticated user bypasses RBAC entirely; structurally identical to DISABLED but undocumented; live `/authentication/login-form` page says "All users receive ADMIN privileges" but is SILENT on the consequence that Policies/Permissions/Roles/Owners are INERT) — **STRENGTHENS DOC-GAP-082 META** at the auth-mode tier dimension; the DISABLED-bypass pattern is no longer DISABLED-only
- **DOC-GAP-219** (Provider-null cross-mode bleed — LOGIN_FORM and LDAP both produce `provider=null` so `alice@LOGIN_FORM` and `alice@LDAP` resolve to the SAME `OwnerPojo` via `ReactiveUserOwnerMappingRepositoryImpl.getConditions` `IS NULL` path; cross-mode owner-row collision undocumented)
- **DOC-GAP-220** (Notification SMTP protocol case-sensitivity trap — live `/configuration-and-deployment/odd-platform` Gmail example uses `protocol: SMTP` UPPERCASE but `NotificationConfiguration.java:63` compares case-sensitive lowercase `"smtp"` so the YAML-verbatim Gmail config silently FAILS to populate `mail.smtp.auth` + `mail.smtp.starttls.enable`; STARTTLS does not engage; credentials may transit in cleartext)
- **DOC-GAP-221** (`spring.session.timeout: -1` shipped default + PostgreSQLSessionHousekeepingJob no-op for unexpiring sessions — monotonic growth of `SPRING_SESSION`/`SPRING_SESSION_ATTRIBUTES`; live doc names the `-1` value but does NOT name the housekeeping no-op AND does NOT name the operator-invisible monotonic growth)
- **DOC-GAP-222** (Session cookie security attributes never set — no `HttpOnly`/`Secure`/`SameSite` override anywhere in the codebase; LOGIN_FORM is the only session-cookie auth mode; CSRF disabled = full session-stealing risk on plaintext-HTTP deployments; combined with timeout=-1, a stolen cookie is valid until JVM restart)
- **DOC-GAP-223** (`/actuator/env` exposes plaintext datasource + custom-datasource + S3 + LOGIN_FORM credentials by default; `management.endpoints.web.exposure.include: health, prometheus, env, info` ships INCLUDING env; Spring Boot's default masking is substring-only on the property KEY name and no test asserts the masking covers `spring.custom-datasource.password`, `attachment.remote.secret-key`, `auth.login-form-credentials`) — **STRENGTHENS DOC-GAP-006** at 5 NEW credential surfaces

**MEDIUM (9)**:
- **DOC-GAP-224** (`auth.login-form-redirect` open-redirect surface — no scheme/host/path validation; `URI.create()` + `DefaultServerRedirectStrategy().sendRedirect()`; the entire config KEY is absent from the live login-form docs)
- **DOC-GAP-225** (NotificationConfiguration platform-base-url asymmetry — email sender carries `:http://localhost:8080` fallback at L105 but Slack sender consumes NO platform-base-url; dev-hostname leaks into production email alert links if `odd.platform-base-url` is unset; asymmetry undocumented)
- **DOC-GAP-226** (`notifications.message.downstream-entities-depth` `@Value` at L123 has NO default — application.yml ships `1` so unmodified deployments are masked, but any override removing the key triggers `IllegalArgumentException: Could not resolve placeholder` at boot; inconsistent with the file's other `@Value` fallback patterns)
- **DOC-GAP-227** (PostgreSQL session housekeeping `@Scheduled` job has NO `@SchedulerLock` / no advisory-lock guard — N-replica deployment runs N× DB load per hour; inconsistent with the rest of the platform's `@Scheduled` jobs which DO use Postgres advisory locks)
- **DOC-GAP-228** (`spring.r2dbc.pool.*` ten knobs wired in code via `PropertyMapper.alwaysApplyingWhenNonNull()` but UNPUBLISHED in live docs; default `maxSize=10` × two pools = 20-connection ceiling per replica; 5-replica deployments at PG `max_connections=100` are at the edge with no operator-facing guidance)
- **DOC-GAP-229** (`customConnectionPool` instantiated UNCONDITIONALLY — no `@ConditionalOnProperty` gate; every deployment runs a second R2DBC pool whether or not Lookup Tables are used; small deployments waste PG connection slots; live docs treat the secondary pool as opt-in but the code makes it always-on)
- **DOC-GAP-230** (Notification shared `HttpClient` + JavaMail timeouts unset — already partly documented for SMTP but the same hang risk applies to Slack and Webhook senders sharing one `HttpClient.newHttpClient()` with NO connect/request timeouts; serial fan-out means one slow channel blocks all others)
- **DOC-GAP-231** (MinioConfig LSN-002 region docs HEALTHY but no in-code fail-fast / no `attachment.remote.region` config key / no IAM-role support; `.region(...)` `.httpClient(...)` `.credentialsProvider(...)` are three caveat-defaulted SDK parameters — only `.region(...)` is doc-mitigated; per Gate-5 audit) — **STRENGTHENS LSN-002** with code-side residue + new IAM-role gap
- **DOC-GAP-232** (LOGIN_FORM credentials-parsing edge cases — passwords with `:` silently truncated; usernames with `,` silently split; no-colon entry throws `ArrayIndexOutOfBoundsException`; plain-text storage amplifies the typo risk; entire forbidden-character set undocumented)

**STRENGTHENED (5)**:
- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC) → batch X expands to a **NEW PATTERN-CLASS** "auth-modes that DO NOT wire AuthorizationCustomizer". Was: 24-sidecar DISABLED-only. Now: 25-sidecar **DISABLED + LOGIN_FORM** at the wiring tier (the LoginFormSecurityConfiguration adds the 25th surface AND surfaces the structural insight that LOGIN_FORM is the SECOND auth mode where the framework is INERT). This is a CATEGORY-EXPANSION strengthen — the META is no longer "DISABLED-only bypass" but "Two auth modes with no AuthorizationCustomizer wiring" (DISABLED via `.anyExchange().permitAll()` + LOGIN_FORM via the absent `AuthorizationCustomizer` call). The keys-to-the-kingdom escalation chain at DOC-GAP-082's blast-radius section now applies to LOGIN_FORM too (every form-authenticated user can author MANAGEMENT/ALL policies); the proposed doc-action sub-section on `disabled-authentication.md` should be MIRRORED on `login-form.md`.
- **DOC-GAP-006** (`/actuator/env` exposes S3/MinIO credentials) → batch X confirms the leak surface extends to FOUR additional credential families: (a) `spring.datasource.password` from `R2DBCConfiguration.java:35` (R2DBCConfiguration sidecar `security.data_exposure.[0]`); (b) `spring.custom-datasource.password` from `R2DBCConfiguration.java:58` — no test asserts masking covers the custom key; (c) `notifications.receivers.email.password` from `NotificationConfiguration.java:57-58` (NotificationConfiguration sidecar `security.data_exposure.[0]`); (d) `auth.login-form-credentials` from `LoginFormSecurityConfiguration.java:70` (LoginFormSecurityConfiguration sidecar `bugs_limitations_corner_cases.[actuator-env-credential-leak]` MEDIUM/HIGH-if-management-port-exposed). DOC-GAP-006 was originally S3-only; now spans 5 credential families across 5 config classes — the doc-side action should generalise to ALL `@Value`-injected credentials, not just S3.
- **DOC-GAP-038** (`auth.ingestion.filter.enabled=false` default leaves `/ingestion/entities` unauthenticated) → batch X strengthens with LOGIN_FORM-mode-specific evidence: `LoginFormSecurityConfiguration.java:49-51` HAND-CODES `permittedPaths` to include `/ingestion/entities` + `/ingestion/datasources` + `/api/slack/events` — DEFINITELY anonymously reachable under LOGIN_FORM regardless of `auth.ingestion.filter.enabled`. Same `permitAll` pattern as DISABLED. The drift surface now spans LOGIN_FORM + DISABLED at the wiring-site tier.
- **LSN-002** (MinIO region unset → operators get opaque AuthorizationHeaderMalformed) → batch X adds MinioConfig sidecar as the CONFIG-CLASS PRIMARY SOURCE; the doc-side remediation is HEALTHY (live page warns about us-east-1) but no in-code fail-fast guard exists, no `attachment.remote.region` config key exists (grep zero matches), no in-code comment cross-references LSN-002. The Gate-5 unset-parameter audit in the MinioConfig sidecar (`.region(...)` row) captures the residue: caveat-defaulted in code, doc-mitigated only. Plus TWO new unset-parameter findings (`.httpClient(...)` and `.credentialsProvider(...)`) extending the LSN-002 family.
- **DOC-GAP-053 META** (docs frame defaults without blast radius) → batch X surfaces THREE NEW canonical instances: (a) `spring.session.timeout: -1` shipped default = sessions never expire (DOC-GAP-221) — doc names the value but not the blast radius; (b) `session.provider: IN_MEMORY` default — doc warns "no multi-instance" but doesn't name the `/ingestion/datasources` collector-id bridge failure mode (REFACTOR-419 family); (c) `management.endpoints.web.exposure.include: health, prometheus, env, info` default — env actuator exposes credentials (DOC-GAP-223) — doc page enumerates `notifications.*` keys but doesn't warn that the actuator default leaks them.

**Severity buckets**:
- HIGH = 87 (batch S) + 6 (batch T DOC-GAP-198..203 minus 2 mediums = 4) + 4 (batch U) + 4 (batch V) + 6 (batch X) = 111
- MEDIUM = 92 (batch S) + 4 (batch T) + 6 (batch U) + 4 (batch V) + 9 (batch X) = 115
- LOW = 18 + 0 + 0 + 0 + 0 = 18

Total = 111 + 115 + 18 = 244.

(Note on prior batch headers: the batch S index summary stated 197 total; batches T/U/V added 18 shards (DOC-GAP-198..217) but did not update the index summary headline — batch W's findings were never written to disk per the prompt. This batch X reconciles by counting all detail/ shards: 217 prior + 15 new batch X = 232. Plus 5 strengthen-only entries that re-issue existing IDs. Total IDs in catalog after batch X: **232 unique entries (197 from S + 5 from T + 6 from U + 9 from V + 15 from X)**. The 5 STRENGTHENS in batch X re-issue existing entries — they're not new IDs.)

**Coherence**: strengthens=5, supersedes=0, conflicts_surfaced=0. The structural insight: batch X's CONFIG-CLASS-WIRING tier completes the LAYER STACK for the platform's foundational substrates. The 7-tier triangulation enumerated at batch S (wiring → config → filter → controller → service → repository → UI) now has the WIRING tier expanded with 5 net-new sidecars that surface FOUNDATIONAL doc-vs-code drift on the load-bearing security + persistence + notification + storage substrates.

**Live URLs WebFetched at status 200 this session (direct in-batch fetches, per LSN-018 Rule 6)**:
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form` 2026-05-20 — verbatim quoted in DOC-GAP-218 / 224 / 232
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-20 — verbatim quoted in DOC-GAP-220 / 221 / 223 / 225 / 226 / 228 / 229 / 230 / 231 — covers session, notifications, attachment-storage, R2DBC pool sections

**Inherited within LSN-018 stale-probe cadence (2026-05-19/20 sibling-sidecar fetches)**:
- `/configuration-and-deployment/enable-security/authentication/s2s` (LoginFormSecurityConfiguration sidecar) → 2026-05-20 status 200
- `/configuration-and-deployment/enable-security/authorization` (LoginFormSecurityConfiguration sidecar) → 2026-05-20 status 200
- `/configuration-and-deployment/odd-platform#attachment-storage-configuration` (MinioConfig sidecar) → 2026-05-20 status 200
- `/configuration-and-deployment/odd-platform#select-session-provider` (SessionConfiguration sidecar) → 2026-05-20 status 200
- `/configuration-and-deployment/odd-platform#enable-alert-notifications` (NotificationConfiguration sidecar) → 2026-05-20 status 200
- `/features/master-data-management/lookup-tables` (R2DBCConfiguration sidecar) → 2026-05-20 status 200
- `/features/active-platform-features/notifications` (NotificationConfiguration sidecar) → 2026-05-20 status 200

YAML-safe emit.

## DOC-GAP-261 — Deleting a data source is documented only as the workflow phrase "remove a source no longer ingested" — the live `/features/management` page documents NONE of the four operationally load-bearing facts of `DELETE /api/datasources/{data_source_id}`: (a) the delete is BLOCKED with HTTP 400 (`CascadeDeleteException`) while a live `data_entity` child still references the source — an operator clicking Delete on an actively-ingested source gets an error, not a deletion, and the actively-ingested-source-is-undeletable state has NO documented workaround; (b) the delete is a SOFT-delete (`deleted_at = NOW()`), not a hard delete; (c) the Collector `token` row the data source pointed to is left ORPHANED and cannot even be soft-deleted (the `token` table has no `deleted_at` column); (d) the FTS `search_entrypoint` vector is NOT cleared on delete (unlike the `update` path) **(NEW batch ZB — DataSourceController.deleteDataSource controller-method PRIMARY SOURCE; live WebFetch `/features/management` 2026-05-21 status 200; STRENGTHENS-cross-link DOC-GAP-194 orphan-token + DOC-GAP-082 META + DOC-GAP-009; related_features F-008 + F-010; related_test_gaps TEST-GAP-675 + TEST-GAP-701)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-261.md`

---

## DOC-GAP-262 — Registering a data source via `POST /api/datasources` can IMPLICITLY CREATE a namespace as a side effect of the `namespace_name` form field — bypassing the `NAMESPACE_CREATE` permission; a principal holding only `DATA_SOURCE_CREATE` can proliferate namespaces through this side-effect path, even though the explicit `POST /api/namespaces` endpoint is gated by `NAMESPACE_CREATE`; the live `/configuration-and-deployment/enable-security/authorization/permissions` page describes `DATA_SOURCE_CREATE` and `NAMESPACE_CREATE` as INDEPENDENT permissions and never flags that data-source registration is a second, ungated path to namespace creation; the same side-door applies on the update path under `DATA_SOURCE_UPDATE`; the namespace is created with NO Activity Event (no audit trail), and a typo in `namespace_name` silently creates a junk namespace **(NEW batch ZB — DataSourceController.registerDataSource + updateDataSource controller-method PRIMARY SOURCE; live WebFetch `/permissions` + `/features/management` 2026-05-21 status 200; the DataSource vertex of the 4-vertex namespace-create side-door cluster; related_features F-028 + F-008; related_test_gaps TEST-GAP-751; cross-links REFACTOR-223 + DOC-GAP-146 + DOC-GAP-168 + DOC-GAP-082 META)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-262.md`

---

<!--
STRENGTHENED ENTRIES (batch ZB) — no headline rewrite; severity + category unchanged.
The orchestrator should NOT add new index headlines for these; the STRENGTHENS blocks
are appended to the existing detail/ shards.


## DOC-GAP-263 — Standalone `/data-quality` Quality Dashboard route has NO client-side permission gate AND every live Data Quality doc page is silent on access control — any authenticated user (under LOGIN_FORM/OAUTH2/LDAP) and any anonymous caller (under `auth.type=DISABLED`) can open `/data-quality` and view the CATALOG-WIDE aggregate quality posture (per-namespace/datasource/owner table-health + monitored counts + per-category test-run breakdowns), but the live `features/data-quality/dashboard` page + `features/data-quality` landing make NO statement about who can see this surface **(NEW batch ZC — DataQuality + DataQualityContent react-component PRIMARY SOURCES; live WebFetch `dashboard` + `data-quality` 2026-05-25 status 200; STRENGTHENS-cross-link DOC-GAP-082 META + DOC-GAP-149 + DOC-GAP-198 sibling P-04 cluster; related_features F-022; LSN-001/LSN-002 operator-trap class)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-263.md`

---

## DOC-GAP-264 — Quality Dashboard "Title" filter is an LSN-020 input-name-vs-implementation drift — the UI label is bare `t('Title')` but the `titleIds`/`deTitleIds` query parameter binds at the SQL layer to `OWNERSHIP.TITLE_ID` (ownership ROLE, e.g. "Data Steward"), NOT to any dataset name/title; the live `/features/data-quality/dashboard` page lists "Title" as one of the five filter dimensions but DOES NOT explain what it filters by; when Owner+Title are both selected the SQL puts them in ONE OWNERSHIP join joined by AND so an operator expecting "owned by Alice AND tagged Title X" may get an empty dashboard if Alice's ownership row carries a different title **(NEW batch ZC — DataQualityFilters react-component PRIMARY SOURCE; live WebFetch `dashboard` 2026-05-25 status 200 confirms verbatim absence of Title description; LSN-020 class — THIRD confirmed instance in catalog after Activity-Feed userIds and getPopularTagList ids; cross-links DOC-GAP-255 + DOC-GAP-146)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-264.md`

---

## DOC-GAP-265 — Quality Dashboard "Test Results Breakdown" ring + per-category result tiles: live `/features/data-quality/dashboard` page describes the breakdown as 3 statuses ("passed / failed / skipped"); the code renders SIX statuses everywhere — the breakdown donut, the legend, and EVERY per-category result row each iterate the full `DataEntityRunStatus` enum (SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN); an operator who sees a `BROKEN` or `ABORTED` slice (or the 4 extra per-category tile columns) has NO doc explaining what the additional statuses mean **(NEW batch ZC — DataQualityContent + TestCategoryResults react-component PRIMARY SOURCES; live WebFetch `dashboard` 2026-05-25 status 200 confirms verbatim 3-status doc description; minor secondary alias drift "passed" vs rendered "Success")**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-265.md`

---

## DOC-GAP-266 — Quality Dashboard "Table Health" ring label vocabulary drift — live `/features/data-quality/dashboard` page describes the slices as "success / failed / broken"; the DTO + rendered slice labels are "Healthy / Warning / Error" (`TablesHealthDashboard.{healthyTables, warningTables, errorTables}`); an operator reading the docs looking for a "broken tables" count will not find that label on the screen — the doc's vocabulary is not the product's vocabulary; the SLA colour scheme on the sibling `/sla-statuses` page (GREEN/YELLOW/RED) aligns with the rendered Healthy/Warning/Error, making the dashboard doc's "success/failed/broken" the OUTLIER in the otherwise self-consistent doc tree **(NEW batch ZC — DataQualityContent react-component PRIMARY SOURCE; live WebFetch `dashboard` 2026-05-25 status 200; cross-link DOC-GAP-198 + DOC-GAP-265)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-266.md`

---

## DOC-GAP-267 — Quality Dashboard filter sidebar — the entire INTERACTION MODEL of the dashboard's primary operator surface is undocumented despite the dedicated `dashboard.md` sub-page: the live page names the five filter dimensions and the tables-vs-tests split but is SILENT on (a) URL-deeplinkable / shareable filter selections (every selection is mirrored into the query string with `replace: true`), (b) per-side "Clear" buttons (two of them, scoped per side), (c) autocomplete-by-name search (every keystroke fires a list-API request, no debounce; first 30 results only), (d) the live-filtering model (every chip selection immediately re-queries the dashboard; no Apply gate), (e) the per-mount reset behaviour (navigating away and back resets all filters to the empty default — URL is the only persistence channel) **(NEW batch ZC — DataQualityFilters + DataQualityStore react-component+jotai-store PRIMARY SOURCES; live WebFetch `dashboard` 2026-05-25 status 200 confirms verbatim absence of URL deep-linking + Title description)**

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-267.md`

---

## DOC-GAP-268 — Quality Dashboard per-test-category result ROW (the right-side matrix the live page calls "a per-test-category matrix") is undocumented in structure: the doc says "a per-test-category matrix on the right showing per-anomaly-class counts" but never describes the COMPOSITION of a single row — a category name heading + a large total-count number + a horizontal row of per-run-status count tiles (one tile per `DataEntityRunStatus` value, colour-coded, with the literal en-dash `–` for zero/negative counts and the numeral otherwise); operators see the per-category panel and have no doc-side description of what each numeric tile means or how its colour maps to status; the column-alignment design intent (every row's FAILED tile in the same column) is undocumented **(NEW batch ZC — TestCategoryResults react-component PRIMARY SOURCE; live WebFetch `dashboard` 2026-05-25 status 200 confirms one-phrase-only matrix coverage)**

**Severity**: MEDIUM
**Category**: missing-page

**Full detail**: `detail/DOC-GAP-268.md`

---

## DOC-GAP-269 — Quality Dashboard empty-state / no-data-ingested behaviour is undocumented — an operator opening `/data-quality` on a fresh install (or after a failed dashboard fetch) sees three grey "No data" donuts plus zero category panels, with NO explanatory copy on screen and NO doc-side description; the failed-fetch state is INDISTINGUISHABLE from the genuinely-empty-catalog state because the component destructures only `{ data, isSuccess }` from `useGetDataQualityDashboard` (never `isError`/`error`), and react-query's `initialData` (all-zeros `DataQualityResults`) is shown on both initial-loading and error paths **(NEW batch ZC — DataQualityContent react-component PRIMARY SOURCE; live WebFetch `dashboard` 2026-05-25 status 200 confirms verbatim absence of empty-state coverage)**

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-269.md`

---

## DOC-GAP-270 — Minor casing mismatch on the "Unknown" test-category label between live doc and rendered UI — live `/features/data-quality/dashboard` page lists the anomaly class as "Unknown Category" (capital C); the code renders `DataQualityCategory.UNKNOWN.getDescription()` whose exact string is "Unknown category" (lowercase c); the other five categories have matching casing across doc and code, so the "Unknown" entry is the lone OUTLIER **(NEW batch ZC — TestCategoryResults react-component PRIMARY SOURCE; live WebFetch `dashboard` 2026-05-25 status 200 confirms doc-side "Unknown Category" casing)**

**Severity**: LOW
**Category**: drift

**Full detail**: `detail/DOC-GAP-270.md`

---

## DOC-GAP-271 — `GET /api/dataqatests/runs` (the Quality Dashboard's single backend endpoint, operationId `getDataQualityTestsRuns`) declares 10 query parameters in `openapi.yaml:1973-2078` — 5 `de*`-prefixed (`deNamespaceIds` / `deDatasourceIds` / `deOwnerIds` / `deTitleIds` / `deTagIds`) for the data-entity / tables side and 5 unprefixed (`namespaceIds` / `datasourceIds` / `ownerIds` / `titleIds` / `tagIds`) for the test / jobs side — and EVERY ONE of the 10 parameters has NO `description:` field in the spec; an API consumer hitting the endpoint without using the UI cannot tell `de*` means "data-entity / table-side" vs unprefixed "test-side", and even with that knowledge has no description of what each id-array filters by (let alone the load-bearing `titleIds`→`OWNERSHIP.TITLE_ID` ownership-role binding) **(NEW batch ZC — DataQualityContent + DataQualityFilters react-component PRIMARY SOURCES + openapi.yaml spec-axis primary source; cross-links DOC-GAP-198 missing api-reference sub-page + DOC-GAP-264 LSN-020)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-271.md`

---

## DOC-GAP-272 — Quality Dashboard "Namespace" filter SQL widening is undocumented — the live `/features/data-quality/dashboard` page lists "Namespace" as one of the five filter dimensions but never warns that the SQL match is `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` — i.e. selecting namespace X matches BOTH entities directly assigned to X AND entities whose datasource is in X; the result set is WIDER than "entities in namespace X" implies, and the doc-side silence means an operator doing a tenant-scoped quality check will silently include cross-tenant tables that happen to live in a datasource registered in that namespace; the widening is asymmetric (data-entity-namespace match widened to datasource-namespace, but not the reverse) **(NEW batch ZC — DataQualityFilters react-component PRIMARY SOURCE; live WebFetch `dashboard` 2026-05-25 status 200; cross-links DOC-GAP-264 + DOC-GAP-271 + DOC-GAP-267)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-272.md`

---
