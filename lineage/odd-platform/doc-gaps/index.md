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
## DOC-GAP-273 — `IdentityController.whoami` emits NO `Cache-Control: no-store` on identity-bearing response — under DISABLED no security chain runs → no default Spring headers → response cache-eligible by HTTP/1.1 heuristics on the platform's most user-specific endpoint

**Severity**: MEDIUM
**Category**: drift (security-header caveat undocumented; latent shared-intermediate-cache leakage class)
**Surfaced by**: `IdentityController` controller-class sidecar (batch ZD) — `bugs_limitations_corner_cases.[1]` + `security.known_security_gaps.[1]` + `stress_findings.resource_boundaries.[cache].q[3]` (PROBE P-124)
**Live URL**: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication` (WebFetched 2026-05-25 status 200 per sibling sidecar — silent on cache-control behaviour)
**Cross-refs**: DOC-GAP-082 META + DOC-GAP-187 + DOC-GAP-037 + REFACTOR-185 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-273.md`

---

## DOC-GAP-274 — `GET /api/identity/whoami` is the platform's auth-mode-probe surface — anonymous response shape differs per `auth.type` (200+admin-dummy / 302-login / 302-oauth2-provider-disclosing / 401-LDAP-realm-disclosing); composed with `/api/appInfo` (DOC-GAP-037) gives full deployment fingerprint in 2 anonymous requests

**Severity**: MEDIUM
**Category**: drift (security-relevant operator-visible behaviour undocumented across all four auth-mode-specific live pages; recon-step-1 in DOC-GAP-082 META kill chain)
**Surfaced by**: `IdentityController` controller-class sidecar (batch ZD) — `docs_link_semantic.doc_drift_findings.[3]` + `security.data_exposure.[1]` + `stress_findings.auth_gates.q[1]`
**Live URL**: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` + four sub-pages (WebFetched 2026-05-25 status 200 — all silent on whoami fingerprint surface)
**Cross-refs**: DOC-GAP-082 META + DOC-GAP-037 + DOC-GAP-187 + DOC-GAP-273 + REFACTOR-185 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-274.md`

---

## DOC-GAP-275 — `DELETE /api/roles/{role_id}` cascade-block contract `"Role is attached to a owner"` undocumented + grammar quirk ("a owner" should be "an owner") surfaces verbatim to API consumers

**Severity**: MEDIUM
**Category**: drift (cascade-delete contract undocumented; cosmetic grammar quirk in operator-visible error message; sibling of DOC-GAP-073's "Policy is attached to a role" pattern)
**Surfaced by**: `RoleController` controller-class sidecar (batch ZD) — `docs_link_semantic.doc_drift_findings.[E]` + `security.data_exposure.[3]` + `bugs_limitations_corner_cases`
**Live URL**: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles` (WebFetched 2026-05-25 status 200 — silent on cascade-delete contract)
**Cross-refs**: DOC-GAP-073 + DOC-GAP-072 + DOC-GAP-181 + DOC-GAP-083 META + REFACTOR-217 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-275.md`

---

## DOC-GAP-276 — `GET /api/roles` (and symmetric `GET /api/policies`) executes a server-side PRINCIPAL-AWARE FORK — ADMIN gets paginated full catalog; non-ADMIN gets own attached roles, page/size IGNORED, hasNext=false hardcoded — pagination contract silently differs per caller; UI paginators / third-party SDKs are silently broken for non-ADMIN

**Severity**: MEDIUM
**Category**: drift (silent per-caller behaviour divergence on uniformly-typed endpoint; DRIFT_NAME_VS_BEHAVIOR per Category F taxonomy)
**Surfaced by**: `RoleController` controller-class sidecar (batch ZD) — `docs_link_semantic.doc_drift_findings.[D]` + `stress_findings.name_behavior_pairs.[getRolesList]` + sibling `PolicyController` batch-E + batch-I findings
**Live URL**: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/roles` + `.../policies` (WebFetched 2026-05-25 status 200 — both silent on principal-aware fork)
**Cross-refs**: DOC-GAP-072 + DOC-GAP-073 + DOC-GAP-076 + DOC-GAP-082 META + DOC-GAP-187 + REFACTOR-185 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-276.md`

---

## DOC-GAP-277 — `IntegrationPreview.installed: boolean` REQUIRED in OpenAPI contract but HARDCODED `false` on every response by `IntegrationMapper.java:27, 30` — UI's "Integrated" badge in `IntegrationPreviewItem.tsx:44-51` will NEVER show; field is either never-implemented feature OR contract violation; live api-reference page silent on dead-field state

**Severity**: MEDIUM
**Category**: drift (API contract claims meaningful field; runtime always returns constant; UI behaviour deletion-mode-shaped; live doc silent)
**Surfaced by**: `IntegrationController` controller-class sidecar (batch ZD) — `doc_drift_findings.[3]` + `bugs_limitations_corner_cases.[0]`
**Live URL**: `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-25 status 200 — lists `{id, name, description, installed}` without warning)
**Cross-refs**: DOC-GAP-009 + DOC-GAP-098 + DOC-GAP-099 META + REFACTOR-024 family + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-277.md`

---

## DOC-GAP-278 — `GET /api/integrations/{unknown-id}` returns HTTP 204 No Content (NOT 404) — `Mono.empty.map(ResponseEntity::ok)` produces 204 via Spring WebFlux default; OpenAPI declares only 200; no 404 contracted; contradicts platform-wide GET-by-id NotFoundException convention; live api-reference page omits status codes entirely

**Severity**: MEDIUM
**Category**: drift (HTTP status-code semantic disagrees with platform-wide convention; OpenAPI contract silent on 4xx; live doc omits status codes; operator-visible ambiguity)
**Surfaced by**: `IntegrationController` controller-class sidecar (batch ZD) — `bugs_limitations_corner_cases.[1]` + `docs_link_semantic.doc_drift_findings.[1]`
**Live URL**: `https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` (WebFetched 2026-05-25 status 200 — silent on response codes)
**Cross-refs**: DOC-GAP-009 + DOC-GAP-018 + DOC-GAP-098 + DOC-GAP-099 META + DOC-GAP-277 + DOC-GAP-280 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-278.md`

---

## DOC-GAP-279 — Integration Wizard snippets render literal placeholder `http://your.odd.platform` under default config — `application.yml:209` commented out + `@Value("${odd.platform-base-url:http://your.odd.platform}")` default → operators copy-pasting wizard snippets point collectors at non-existent host; under DISABLED + non-default override, internal hostname leaks anonymously

**Severity**: MEDIUM
**Category**: drift (configuration default produces operator-visible placeholder in copy-paste output; live doc names fallback exists but doesn't surface default-state caveat; operator-trap on wizard's primary affordance)
**Surfaced by**: `IntegrationController` controller-class sidecar (batch ZD) — `doc_drift_findings.[3]` + `bugs_limitations_corner_cases.[2]` + `implicit_adrs.[platform_url-single-parameter]` + `stress_findings.tunables.[odd.platform-base-url]`
**Live URL**: `https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` (WebFetched 2026-05-25 status 200 — names fallback but doesn't warn about default state)
**Cross-refs**: DOC-GAP-036 + DOC-GAP-082 META + DOC-GAP-280 + DOC-GAP-281 + DOC-GAP-226 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-279.md`

---

## DOC-GAP-280 — Integration Wizard registry uses case-insensitive id collision that SILENTLY MERGES wizard YAMLs (last-load-wins) — `IntegrationRegistryFactory.java:32-37` `Comparator.comparing(String::toLowerCase)` + `(o1, o2) -> o2`; load order non-deterministic across `classpath*:` scanning; vendor + overlay collisions silently resolve

**Severity**: LOW
**Category**: drift (silent platform behaviour for wizard authors; load-order-dependent merge semantic undocumented)
**Surfaced by**: `IntegrationController` controller-class sidecar (batch ZD) — `doc_drift_findings.[4]` + `bugs_limitations_corner_cases.[3]` + `implicit_adrs.[plugin-extensible]`
**Live URL**: `https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` (WebFetched 2026-05-25 status 200 — silent on case-insensitive uniqueness constraint)
**Cross-refs**: DOC-GAP-281 + DOC-GAP-279 + DOC-GAP-277 + DOC-GAP-278 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-280.md`

---

## DOC-GAP-281 — Integration Wizard registry FAILS BOOT on a single corrupt YAML — `IntegrationRegistryFactory.readManifest:53-61` catches IOException, rethrows IllegalStateException → application context construction fails; no skip-broken-continue; bundled deployment ships zero wizards (dormant); activates with overlays; live wizard doc page silent on boot-failure mode

**Severity**: LOW
**Category**: drift (boot-time failure mode on wizard-overlay composition undocumented; intentional fail-fast architecture but undisclosed to overlay-authors)
**Surfaced by**: `IntegrationController` controller-class sidecar (batch ZD) — `bugs_limitations_corner_cases.[4]` + `implicit_adrs.[fail-fast-on-malformed-wizard-yaml]`
**Live URL**: `https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` (WebFetched 2026-05-25 status 200 — silent on boot-failure mode)
**Cross-refs**: DOC-GAP-280 + DOC-GAP-279 + DOC-GAP-277 + DOC-GAP-278 + DOC-GAP-226 + LSN-001/002 class
**Full detail**: `detail/DOC-GAP-281.md`

---

## Batch ZD STRENGTHENS-only appends (no new IDs minted)

The following existing entries received STRENGTHENS appends in their detail files based on batch-ZD primary-source evidence:

- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC; was 33-sidecar in batch ZA) → **NOW 35-sidecar** across **9 tiers** (NEW 9th tier: read-side anonymous-disclosure surfaces); batch-ZD primary-sources the IDENTITY-LAYER FACET (IdentityController controller-class) AND the INTEGRATION-WIZARD READ surface (IntegrationController controller-class). Complete anonymous-fingerprint kill chain now anchored: `/api/appInfo` + `/api/identity/whoami` + `/api/integrations` in three requests.
- **DOC-GAP-083 META** (no-audit-log on RBAC mutations; was 15+-sidecar in batch Y) → **NOW 17-sidecar evidence cluster** across 7 tiers and 6 pillars; batch ZD adds controller-CLASS-tier dimension (vs prior controller-METHOD-tier) AND the IDENTITY-LAYER read-side audit silence (the platform's most-user-specific endpoint is forensically silent).
- **DOC-GAP-072** (Roles live doc page omits role-creation API surface) → controller-class-layer PRIMARY SOURCE; 6 doc-drift findings (A-F) on the single Roles live page; 5th-layer triangulation (controller-method + service + repository + UI + class).
- **DOC-GAP-073** (Policies live doc page omits POLICY_CREATE permission etc.) → controller-class-layer PRIMARY SOURCE; 6 doc-drift findings (A-F) on the single Policies live page; 6th-layer triangulation.
- **DOC-GAP-074** (class-wide 201-vs-200 status-code drift) → cluster grows from 4-instance to 6-controller × 2-operations = 12-endpoint pattern with PRIMARY SOURCE at controller-class layer; single-PR spec-side fix closes entire cluster.
- **DOC-GAP-076** (PermissionController read-side discovery endpoint undocumented) → controller-class-layer PRIMARY SOURCE; class-name vs actual-surface mismatch surfaced + MANAGEMENT-rejection-as-architectural-decision + single-method-class-shape-deliberate-intent.
- **DOC-GAP-187** (UI-vs-API asymmetry under DISABLED — operator-trap class) → IDENTITY-LAYER FACET PRIMARY SOURCE adjusts the FRAMING: prior batch-Q framing was "UI looks LOCKED-DOWN under DISABLED" (empty permissions hide buttons); batch-ZD primary-source reading at `IdentityController.java:30-33` shows `Permission.values()` (full 70+) — the UI under DISABLED looks **FULLY UNLOCKED** (admin) rather than locked-down. The OPERATOR-IMPACT direction is reversed but the META composition stays valid. Maintainer triage note added in DOC-GAP-187's detail file flagging the cross-batch dissonance for prose revision.
# Batch ZE index reconciliation — 2026-05-25

This file is appended alongside the main `index.md` (per the catalog's batch-by-batch append convention used since batch X). The main `index.md` headline carries the batch-S/R counts (197); subsequent batches (T/U/V/X/Y/Z*) added shards directly to `detail/` without updating the headline counts. This batch-ZE reconciliation file records the additions WITHOUT modifying the main index headline counts (which are stale-by-design pending a maintainer-led full reconciliation).

## Batch summary

**Trigger**: Batch ZE — 5 NEW controller-class sidecars covering Discovery + Search + Links + Feature + Relationship + Title controllers:

1. `lineage/odd-platform/understanding/odd-platform__java__SearchController__controller-class__SearchController.md` (controller-class enclosing tier; 7-endpoint reactive search surface)
2. `lineage/odd-platform/understanding/odd-platform__java__TitleController__controller-class__TitleController.md` (controller-class; 1-endpoint Title directory READ surface — complement of OwnershipServiceImpl batch K WRITE-side)
3. `lineage/odd-platform/understanding/odd-platform__java__FeatureController__controller-class__FeatureController.md` (controller-class; 21-line boot-immutable feature-flag exposure surface)
4. `lineage/odd-platform/understanding/odd-platform__java__RelationshipController__controller-class__RelationshipController.md` (controller-class; 3-endpoint relationships ERD + GRAPH surface — first sidecar of P-02 Data Modelling pillar at the relationship-class data-entity boundary)
5. `lineage/odd-platform/understanding/odd-platform__java__LinksController__controller-class__LinksController.md` (controller-class; 1-endpoint operator-configured external-links catalogue)

**Outcome**: **8 NEW findings (2 HIGH + 5 MEDIUM + 1 LOW) — DOC-GAP-282 .. DOC-GAP-289** + **7 STRENGTHENED existing entries**.

Per LSN-018 stale-probe cadence: 0 direct live WebFetches this session — network unreachable per orchestrator note; all live URL verifications inherited from sibling sidecars at status 200 within the 11-day window (Search page verified 2026-05-25 via SearchController class sidecar's `inferred_docs.[0]`; Policies page verified 2026-05-25 via TitleController class sidecar; `/configuration-and-deployment/odd-platform` verified 2026-05-25 via both FeatureController + LinksController class sidecars; the 404 verifications on `/active-platform-features/data-collaboration` and `/active-platform-features/alerting` from the FeatureController class sidecar).

## NEW (8) — DOC-GAP-282 .. DOC-GAP-289

### HIGH severity (2)

- **DOC-GAP-282** (HIGH; drift): `DataEntityList.pageInfo.hasNext` is HARD-CODED `true` regardless of remaining rows — `GET /api/search/{search_id}/results` returns the documented `PageInfo.hasNext` field as a contract LIE for third-party API consumers; the React SPA compensates client-side so the UI is correct, but mobile clients, CLI integrations, automated tests, and any external catalog connector reading the OpenAPI schema will pagination-loop forever; one-line code-side fix at `DataEntityServiceImpl.java:192` + doc-side stopgap admonition on `features/data-discovery/search.md`. Cross-link DOC-GAP-022 + DOC-GAP-079 + DOC-GAP-080 + DOC-GAP-160 + DOC-GAP-161 + DOC-GAP-166 + REFACTOR-024 + REFACTOR-053 + LSN-001/002.
  - **Full detail**: `detail/DOC-GAP-282.md`

- **DOC-GAP-286** (HIGH; drift): `GET /api/relationships/erd/{relationship_id}` + `GET /api/relationships/graph/{relationship_id}` — Category F drift; the OpenAPI parameter `relationship_id` promises the `relationships` table PK, but the SQL filters by `data_entity.id` of the relationship-class data entity; UI round-trip works because the list endpoint surfaces data_entity.id as the `id` field, but third-party API consumers reading the OpenAPI spec literally and supplying actual `relationships.id` get 404 (or worse, silent wrong-data on numeric collision). ADDITIONALLY no UNIQUE constraint on `relationships.data_entity_id` admits multi-row sub-case where `mono()` behaviour is JOOQ-driver-specific. Local-repo `developer-guides/api-reference/relationships.md` is silent on the translation. P-128 verifies. First Category F drift finding on P-02 Data Modelling.
  - **Full detail**: `detail/DOC-GAP-286.md`

- **DOC-GAP-287** (HIGH; drift): `/data-modelling/relationships` doc page silent on no-owner-scoping / no-EXCLUDE_FROM_SEARCH / no-HOLLOW filter / no-data-source-permission filter — the `/api/relationships` list endpoint applies NO authorization predicates; every authenticated caller (or anonymous under DISABLED) sees every relationship across every data source, INCLUDING relationships pointing to `exclude_from_search=true` entities that `/api/dataentities` DOES filter out (per batch-T REFACTOR-425) — undocumented asymmetry. 4TH corroborating surface for the catalog-wide cross-owner enumeration cluster (alongside DOC-GAP-002 alerts, DOC-GAP-025 activity, DOC-GAP-079 search), extending the cluster to P-02. The doc-product fix recommendation is a META `visibility-model.md` page + per-pillar cross-links.
  - **Full detail**: `detail/DOC-GAP-287.md`

### MEDIUM severity (5)

- **DOC-GAP-283** (MEDIUM; missing-page + drift): The Title concept has NO canonical doc page anywhere in `docs.opendatadiscovery.org` — Policies page mentions `:owner:title` as a condition field but never defines what a Title is; `/api/titles` (TitleController READ surface) is entirely undocumented for API consumers; UI's `OwnerTitleAutocomplete` ships `size=30` hard-coded so installations exceeding 30 titles become un-autocompletable for any title outside the 30 oldest. Closes the Title-feature documentation trio with DOC-GAP-146 (WRITE-side) + DOC-GAP-289 (schema-constraint absence). Proposed: new `/configuration-and-deployment/enable-security/authorization/titles.md` page + Policies cross-link + `/developer-guides/api-reference/titles.md` API-reference entry.
  - **Full detail**: `detail/DOC-GAP-283.md`

- **DOC-GAP-284** (MEDIUM; drift + missing-page): `/api/features/active` (boot-immutable feature-flag exposure surface every UI client hits on mount) is ENTIRELY UNDOCUMENTED — live `/configuration-and-deployment/odd-platform` page lists `datacollaboration.enabled` and `notifications.enabled` as boolean toggles but does NOT mention the BOOT-TIME SNAPSHOT semantic; an operator who toggles the YAML expects the SPA to reflect the new value without restart, but it does NOT (the `activeFeatures` field is `private final`, captured at construction); the endpoint itself is invisible to the published manual; under DISABLED the endpoint is anonymously reachable (PROVIDER-NULL-BLEED-LIMITED-RISK FACET of REFACTOR-185 — narrower than IdentityController + IntegrationController but real); the candidate canonical pages `/active-platform-features/data-collaboration` and `/active-platform-features/alerting` BOTH return 404. STRENGTHENS DOC-GAP-011 (legacy alerting URL 404).
  - **Full detail**: `detail/DOC-GAP-284.md`

- **DOC-GAP-285** (MEDIUM; drift): Operator-configured `odd.links` external-links catalogue has TWO undocumented trust caveats: (a) UI renders `target='_blank'` WITHOUT `rel='noopener noreferrer'` — reverse tabnabbing vector; (b) backend `AdditionalLinkProperties.url` has NO `@URL` constraint — `javascript:` / `data:text/html` URLs are admissible. Live `/configuration-and-deployment/odd-platform` page claims "absolute URL opening in a new tab" but is silent on the trust model + boot-time-bind semantic (parallel to DOC-GAP-284). Code-side fix: 1-line UI change + 1 validation annotation. Cross-link DOC-GAP-082 META + DOC-GAP-006 + DOC-GAP-096.
  - **Full detail**: `detail/DOC-GAP-285.md`

- **DOC-GAP-288** (MEDIUM; drift): `GET /api/search/suggestions` autocomplete top-5 by `ts_rank DESC` with NO secondary tie-breaker key — when 6+ entities share equal `ts_rank` (common on synonym-rich catalogs), the top-5 surfaced is NON-DETERMINISTIC across keystrokes; operator-visible flicker UX. ADDITIONALLY the `entityClassId` parameter is a single Integer — cannot OR-filter for cross-class suggestions. Live `/features/data-discovery/search` page is silent on autocomplete behaviour entirely; candidate canonical `/features/data-discovery/search-suggestions` URL returns 404. LSN-019 STRESS PROTOCOL canonical case-law shape. P-134 verifies tie-breaker at runtime. Code-side fix: extend ORDER BY to `rank DESC, data_entity.id DESC` + extend OpenAPI param to `entity_class_ids: array<integer>`.
  - **Full detail**: `detail/DOC-GAP-288.md`

- **DOC-GAP-289** (MEDIUM; drift): `title.name` column has NO length / pattern / allowlist / normalisation constraint — `varchar(128)` with only `UNIQUE`; `TitleService.getOrCreate` stores VERBATIM with no case-fold, no trim, no collapse-whitespace; operators mint `'Data Steward'`, `'data steward'`, `'DATA STEWARD'`, `' Data Steward '` as DISTINCT rows. Policy conditions `:owner:title == 'Data Steward'` SILENTLY MISS variant casings. Concurrent `getOrCreate` race produces transient HTTP 400 USR003 with no doc narrative. No Titles-management UI; soft-delete `delete(id)` has zero production call-sites. Closes the Title-feature trio with DOC-GAP-146 + DOC-GAP-283. 4-step code-side fix gradient: trim/collapse-whitespace (free) → case-insensitive unique index → operator-configurable allowlist → Titles-management UI.
  - **Full detail**: `detail/DOC-GAP-289.md`

## STRENGTHENED (7)

- **DOC-GAP-079** (Search page silent on WHO + visibility — catalog-wide cross-owner enumeration) → batch ZE adds **SearchController CLASS-TIER PRIMARY SOURCE**; triangulation now controller-method (batch E) + controller-class (batch ZE) — 2-LAYER coverage. The class-tier finding confirms the read-collaborative posture spans ALL 7 endpoints (verified `SecurityConstants.java` end-to-end shows ZERO `/api/search*` matchers).
  - **Strengthen append**: `detail/DOC-GAP-079-batch-ZE-append.md`

- **DOC-GAP-104** (SQL-injection vector at `getHighlightedResult`) → batch ZE adds **HTTP-CONTROLLER ENTRY POINT PRIMARY SOURCE**; triangulation now repository (batch H) + facet-aggregator (batch M) + CONTROLLER ENTRY POINT (batch ZE) — 3-LAYER coverage. The class-tier finding identifies `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` as the operator-reachable URL pattern of the attack chain. Cross-link DOC-GAP-161 + DOC-GAP-166 strengthens the chain narrative (UUID-as-bearer-token + persisted-malformed-query + SQL-injection).
  - **Strengthen append**: `detail/DOC-GAP-104-batch-ZE-append.md`

- **DOC-GAP-022** (Pagination `size` unbounded) → batch ZE adds **THREE NEW controller-class instances**: SearchController.{getSearchResults, getFiltersForFacet} + TitleController.getTitleList + RelationshipController.getRelationships. The platform-wide unbounded-`size` pattern now spans 9+ controllers; the doc-side "Pagination" section in the api-reference hub should enumerate them.
  - **Strengthen append**: `detail/DOC-GAP-022-batch-ZE-append.md`

- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC-primary-surface) → batch ZE adds **FIVE NEW class-tier sidecars** confirming the DISABLED-bypass posture: SearchController + TitleController + FeatureController + RelationshipController + LinksController. Triangulation now 34+ sidecars. Pillar coverage expanded to P-02 (Data Modelling) + P-04/P-08 (Data Collaboration / Notifications via FeatureController) + P-09 (Security & Access Control via TitleController) + generic infrastructure (LinksController).
  - **Strengthen append**: `detail/DOC-GAP-082-batch-ZE-append.md`

- **DOC-GAP-160** (Facet count cross-owner enumeration catalog-wide) → batch ZE adds **CLASS-TIER 4-STEP ATTACK CHAIN** enumeration. The class-tier sidecar names the COMPLETE attack steps verbatim (POST /api/search → results paginate → facet/OWNERS enumerate → facet/{TAGS,GROUPS,TYPES,STATUSES} cardinality). Doc-side fix should name the chain explicitly.
  - **Strengthen append**: `detail/DOC-GAP-160-batch-ZE-append.md`

- **DOC-GAP-161** (Bearer-token-shaped search-session UUIDs) → batch ZE adds **CLASS-TIER 5-ENDPOINT ENUMERATION + 4-FEATURE CROSS-CUTTING DESIGN** confirmation. The class-tier sidecar enumerates all 5 searchId-keyed endpoints by name AND identifies FOUR feature surfaces (Search, Term, QueryExample, ReferenceData) sharing the same bearer-token-shaped session UUID design. The META implication: doc-side fix should be a cross-cutting "Session URL semantics" doc-product change on a META page rather than per-feature admonitions.
  - **Strengthen append**: `detail/DOC-GAP-161-batch-ZE-append.md`

- **DOC-GAP-166** (tsquery operator injection persistence) → batch ZE adds **CLASS-TIER FULL FAN-OUT ENUMERATION** — the `JooqFTSHelper.tsQuery` code path is invoked from 6 distinct controller method paths PLUS the cross-link to DOC-GAP-104 (the 7th — `String.formatted` variant at `getHighlightedResult`). A persisted malformed query breaks ALL session-state reads, not just the facet aggregators; the blast radius is wider than batch M's framing captured.
  - **Strengthen append**: `detail/DOC-GAP-166-batch-ZE-append.md`

- **DOC-GAP-146** (Title directory auto-grow via free-text) → batch ZE adds **TitleController READ-SIDE CLASS-TIER COMPLEMENT** + identifies the Data Quality runs filter as a THIRD consumer of the Title directory (alongside the ownership-form autocomplete and the Policy condition fields). Closes the Title-feature trio with DOC-GAP-283 + DOC-GAP-289.
  - **Strengthen append**: `detail/DOC-GAP-146-batch-ZE-append.md`

## NOT-A-NEW-DOC-GAP (acknowledged but skipped per scoping rule)

- **`relationships.relationship_type` varchar(256) with no CHECK constraint; mapper silently defaults to GRAPH_RELATIONSHIP on unknown values** (per RelationshipController sidecar `bugs_limitations_corner_cases.[5]`, severity LOW): the schema admits corrupted ingestion + the mapper silently coerces. Per the orchestrator's scoping rule on LOW-severity-internal-mapper-defaults, this is a code-quality finding (REFACTOR scope), not a doc-product finding. No new entry filed; surfaces as a sidecar artefact only.

- **Mid-sized link lists (50+ entries) performance** (per LinksController sidecar `tests_coverage_semantic.uncovered_behaviours.[4]`, severity LOW): operator-configured links list is bounded by operator intent; no functional defect. Skip.

- **`navigation/domains/relationships.md` stale "Documentation: None" claim** (per RelationshipController sidecar `bugs_limitations_corner_cases.[6]`, severity LOW): workspace-internal navigation pointer stale, not a doc-product finding. Logged separately as a follow-up note in the maintainer's notes; not a `docs.opendatadiscovery.org` doc-gap.

## Coherence sweep (LSN-018 Rule 6)

- **strengthens**: 7 (DOC-GAP-022, DOC-GAP-079, DOC-GAP-082, DOC-GAP-104, DOC-GAP-146, DOC-GAP-160, DOC-GAP-161, DOC-GAP-166) — 8 entries but DOC-GAP-082 counts once as a META
- **supersedes**: 0
- **conflicts_surfaced**: 0
- **case-law cross-links**:
  - LSN-001 / LSN-002 (operator-following-docs-off-a-cliff) — DOC-GAP-282 + DOC-GAP-286 (contract drift) + DOC-GAP-287 (visibility model)
  - LSN-018 (reducer-contradiction-coherence-check) — applied per Rule 6; no contradictions surfaced
  - LSN-019 (descriptive-vs-interrogative file-analyser prompt; Stress Protocol canon) — DOC-GAP-288 is a canonical instance (no secondary ORDER BY → non-determinism); cross-link DOC-GAP-227 (PostgreSQL housekeeping `@Scheduled` no advisory lock — sibling LSN-019 instance)

## Doc-side fix coordination

The eight new findings + seven strengthens cluster around FOUR doc-product surfaces. The maintainer's most efficient doc-side fix is a COORDINATED PASS:

1. **`features/data-discovery/search.md`**:
   - Add "Pagination behaviour for API consumers" admonition (NEW DOC-GAP-282 + DOC-GAP-022)
   - Add "Autocomplete behaviour" sub-section (NEW DOC-GAP-288 + DOC-GAP-079 + DOC-GAP-080)
   - Add "Visibility model" admonition (DOC-GAP-079 strengthen + DOC-GAP-160 strengthen + DOC-GAP-161 strengthen)
   - Add "Query content handling" admonition (DOC-GAP-104 strengthen + DOC-GAP-166 strengthen — consolidated)

2. **`active-platform-features/data-modelling/relationships.md`** + **`developer-guides/api-reference/relationships.md`**:
   - Add "Visibility model" admonition (NEW DOC-GAP-287)
   - Add `{relationship_id}` parameter clarification (NEW DOC-GAP-286)
   - Cross-link to NEW META `visibility-model.md` page

3. **`configuration-and-deployment/enable-security/authorization/titles.md`** (NEW page per DOC-GAP-283):
   - Title concept definition + auto-create-on-miss semantic (DOC-GAP-146 + DOC-GAP-283)
   - Title-name normalisation + Policy vocabulary alignment (NEW DOC-GAP-289)
   - Title-directory curation (provision-now-use-later soft-delete) (NEW DOC-GAP-289)

4. **`configuration-and-deployment/odd-platform.md`**:
   - Add "Boot-time configuration binding" META admonition (NEW DOC-GAP-284 + NEW DOC-GAP-285) — `@ConfigurationProperties` sources are NOT hot-reloadable
   - Add "Operator trust model for `odd.links`" admonition (NEW DOC-GAP-285)
   - Add `datacollaboration.enabled` / `notifications.enabled` restart-required admonition (NEW DOC-GAP-284)

5. **`developer-guides/api-reference/feature-flags.md`** (NEW page per DOC-GAP-284):
   - Document `GET /api/features/active`: parameters, return shape, authentication semantics, boot-time-snapshot behaviour

6. **`active-platform-features/data-collaboration.md`** (NEW page) + **`active-platform-features/alerting.md`** (CREATE OR FIX 404):
   - Per DOC-GAP-284's missing-page sub-findings — coordinate URL pattern resolution with DOC-GAP-011

7. **`developer-guides/architecture/visibility-model.md`** (NEW META page per DOC-GAP-287):
   - Canonical "read-collaborative model" doc cross-linking from each per-feature page
   - Per-feature exclude-from-search asymmetry table (which list endpoints filter, which don't)

The coordination is one maintainer-pass across 6-7 doc pages (plus 2-3 new pages) closes 8 new findings + 7 strengthens. YAML-safe emit. Per the orchestrator note, ALL live verifications inherited from sibling sidecars at status 200 within the LSN-018 stale-probe cadence (11-day window); no fresh WebFetches this session due to network outage.

## Top-of-mind for next batch reducer

- The Title-feature trio (DOC-GAP-146 + DOC-GAP-283 + DOC-GAP-289) is now CLOSED at the documentation-coverage level. The next batch should evaluate whether the proposed `titles.md` page is feasible OR whether the upstream `/log-issue` recommendation (add `TITLE_CREATE` permission + allowlist) takes priority.
- The catalog-wide cross-owner enumeration cluster is now 4-PILLAR triangulated (P-01 Discovery + P-02 Modelling + P-04 Alerts + P-08 Activity). The proposed META `visibility-model.md` page from DOC-GAP-287 is the cross-cutting doc-product fix; the next batch's META reducer should sequence this.
- The bearer-token-shaped session UUID cluster is now 4-FEATURE wide (Search + Term + QueryExample + ReferenceData per DOC-GAP-161-batch-ZE-append's cross-feature widening). The unfiled findings on QueryExampleController + ReferenceDataController would close the cluster.
- The boot-time-config-binding META (DOC-GAP-284 + DOC-GAP-285) opens a new doc-product axis: "Configuration sources and their hot-reload behaviour" — likely a single META admonition on the configuration-and-deployment hub.
## Batch ZF append (2026-05-25 — Ingestion + Owner + MetadataField + DataCollaboration + EventApi controller-class tier)

**Sidecars consumed (5 NEW)**:
- `odd-platform__java__IngestionController__controller-class__IngestionController.md` (P-10:F-001 Batch Ingestion class-level consolidation — the 5-method S2S surface)
- `odd-platform__java__OwnerController__controller-class__OwnerController.md` (P-09 Owner directory — 4-method CRUD class-level consolidation)
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md` (P-01 Custom Metadata read-only catalogue surface — single-method controller)
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md` (P-07 Discussions — 3-method class-level consolidation)
- `odd-platform__java__EventApiController__controller-class__EventApiController.md` (P-07 Discussions inbound webhook — 1-method controller)

**Live URLs verified this session** (Rule 1 — no inheritance for the load-bearing claims):
- `https://docs.opendatadiscovery.org/active-platform-features/data-collaboration` → **404** (re-confirmed; legacy URL still broken)
- `https://docs.opendatadiscovery.org/features/active-platform-features` → **200** (sidebar lists 5 sub-pages: Alerting + Notifications + Activity Feed + Data Collaboration + GenAI assistant — confirming the canonical home now exists)
- `https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration` → **200** (canonical Discussions page exists with text "lets users start in-app discussions about a specific data entity"; silent on webhook signing + idempotency)
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` → **200** ("Enable Data Collaboration" section verified verbatim; silent on Slack signing-secret / X-Slack-Signature / HMAC / idempotency — the WebFetch model returned "Not found" for those terms)
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` → **200** (re-verified; the security page enumerates `/ingestion/alert/alertmanager`, `/ingestion/entities/degs/children`, `/ingestion/entities/datasets/stats` as paths "outside the ingestion filter's coverage" but does NOT name `/ingestion/metrics` — confirming the DOC-GAP-240 omission stands)

---

## NEW findings (3)

### DOC-GAP-290 (HIGH) — see `detail/DOC-GAP-290.md`

`POST /api/slack/events` is an UNAUTHENTICATED + UN-SIGNATURE-VERIFIED + REPLAY-VULNERABLE inbound webhook on the public internet. Slack's Events API protocol requires HMAC-SHA256 verification of `X-Slack-Signature` against `signing_secret` — the entire codebase has ZERO matches for `X-Slack-Signature`, `signing.secret`, `HMAC.SHA256`. The path is whitelisted from all four auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP). The `message_provider_event` table has no UNIQUE constraint on `(provider, event_id)`; duplicate Slack at-least-once retries insert duplicate rows. The live `/configuration-and-deployment/odd-platform#enable-data-collaboration` page publishes the Slack app manifest WITH `request_url: https://<ODD_PLATFORM_BASE_URL>/api/slack/events` + scope `channels:history` but is verbatim silent on signing / signature / HMAC / idempotency. Operators following the docs deploy an internet-reachable forgeable webhook. Distinct from DOC-GAP-234 (outbound generic-webhook signing); same class, opposite direction. Cross-references: DOC-GAP-032 / DOC-GAP-033 / DOC-GAP-035 / DOC-GAP-038 / DOC-GAP-178 / DOC-GAP-234 / DOC-GAP-082 META / LSN-001 / LSN-002 / REFACTOR-185.

### DOC-GAP-291 (HIGH) — see `detail/DOC-GAP-291.md`

`GET /api/messages/{message_id}/url` carries THREE compound contract bugs: (a) returns HTTP 200 with empty body when `message_id` does NOT exist (instead of 404) — REST-convention violation; (b) UNCONDITIONAL 302 redirect to whatever Slack's `chat.getPermalink` returned — no host check, no scheme check, no allowlist (open-redirect-class surface); (c) HTTP 302 hard-coded but OpenAPI declares 301 (three sources of truth disagree: code/spec/live api-reference doc). Combined with no RBAC on `/api/messages/**` (no SECURITY_RULES entry; falls through to authenticated-only via `AuthorizationCustomizer.java:29-30`), ANY authenticated user has a message-existence-by-id oracle — combined with UUIDv1 timestamp embedding, the platform's Discussions topology is brute-force enumerable across organisational boundaries. Distinct from DOC-GAP-278 (similar Mono.empty→204 on integrations) and DOC-GAP-282 (search hasNext lying constant) — same family of compound contract bugs, different endpoint surface. Distinct from DOC-GAP-224 (login-form-redirect open-redirect); same class-of-bug different surface. Cross-references: DOC-GAP-032 / DOC-GAP-033 / DOC-GAP-035 / DOC-GAP-074 META / DOC-GAP-224 / DOC-GAP-278 / DOC-GAP-082 META / DOC-GAP-290 / LSN-001 / LSN-002.

### DOC-GAP-292 (HIGH) — see `detail/DOC-GAP-292.md`

`MetadataFieldList.page_info` is THEATRE — `total = items.length` + `hasNext = false` HARD-CODED at `MetadataFieldMapperImpl.java:30-33`; the underlying SQL has NO LIMIT/OFFSET/ORDER BY; the entire INTERNAL-origin catalogue is returned per call. This is the INVERSE drift shape of DOC-GAP-282 (where `hasNext = true` is constant signalling forever-loop) — here `hasNext = false` is constant signalling "no pagination at all". Same class — pagination contract field LIES via constant — but opposite polarity. Combined with the auto-create-on-miss semantics (per DOC-GAP-193) the catalogue grows unboundedly with no curation affordance; combined with the UI's autocomplete firing every 500ms-debounced keystroke, the unbounded-return amplifies linearly. The two sibling findings (DOC-GAP-282 + this one) make the platform's PageInfo block theatre in BOTH directions on different controllers — META candidate. Cross-references: DOC-GAP-022 / DOC-GAP-074 META / DOC-GAP-099 META / DOC-GAP-126 / DOC-GAP-191 / DOC-GAP-193 / DOC-GAP-282 / LSN-001 / LSN-002.

---

## STRENGTHENS (6 existing entries)

### DOC-GAP-035 STRENGTHENS — fresh 2026-05-25 verification confirms legacy URL still 404; canonical URL now resolves at `/features/active-platform-features/data-collaboration` (status 200)

Two new sidecars (`DataCollaborationController` controller-class + `EventApiController` controller-class) each carry `docs_link_semantic.inferred_docs` with the legacy `/active-platform-features/data-collaboration` URL marked status 404. Fresh WebFetch this session (2026-05-25) confirms the legacy URL is STILL 404. NEW EVIDENCE: the CANONICAL URL `/features/active-platform-features/data-collaboration` now resolves at 200 with prose "lets users start in-app discussions about a specific data entity"; the sidebar at `/features/active-platform-features` (200) lists the page among the five active-platform sub-features. The doc-page-coverage gap is now half-closed — operators landing on the canonical URL find the feature page, but operators landing on the legacy URL (via Google cache, blog posts, internal wikis) still 404. The DOC-GAP-035 doc-action remains: implement GitBook redirect from legacy to canonical OR ensure SUMMARY.md ships the legacy alias. See also batch-ZF context: the live api-reference page documents the THREE Data Collaboration endpoints but is SILENT on the message-existence-oracle compound (now captured at DOC-GAP-291) and the Slack-events webhook signature absence (now captured at DOC-GAP-290).

### DOC-GAP-032 STRENGTHENS — controller-class layer corroborates the no-RBAC class-wide surface

The new `DataCollaborationController` controller-class sidecar provides class-level enumeration: ALL THREE endpoints share the no-RBAC posture (no SECURITY_RULES entry for `/api/datacollaboration/**` or `/api/messages/**`; both fall through to `pathMatchers("/**").authenticated()`); the DISABLED-mode anonymous reachability extends to all three endpoints uniformly. The original DOC-GAP-032 anchored on the per-method `postMessageInSlack` sidecar; the class-level evidence MAKES THE PATTERN STRUCTURAL rather than per-endpoint. Sidecar bugs_limitations[8] (HIGH) and [9] (HIGH) cover the class-level enumeration. The class-level view ALSO surfaces an addl dimension: NO `log.info(...)` calls on any of the three endpoints' code paths despite the @Slf4j annotation, AND the redirect endpoint has NO audit-log of who-redirected-to-which-message — combined with the missing-404 (DOC-GAP-291), this is a forensic-silent + RBAC-silent surface for any authenticated user. The doc-action proposed at DOC-GAP-032 should now include a class-level table (3 endpoints × {auth requirement, ownership check, audit log, rate-limit}) rather than per-endpoint admonitions.

### DOC-GAP-038 STRENGTHENS — IngestionController class-level evidence: 5×2×4 = 40-cell auth matrix at primary source

The new `IngestionController` controller-class sidecar provides the COMPLETE class-level enumeration: 5 endpoints × 2 filter classes × 4 auth modes = 40 cells of auth behaviour. The class-level view confirms (and STRENGTHENS) what prior batches surfaced at per-method tier:
- `createDataSource` is the ONLY unconditionally-authenticated endpoint (IngestionDataSourceFilter is `@Component` with no `@ConditionalOnProperty`).
- 4 of 5 endpoints (postDataEntityList, postDataSetStatsList, ingestMetrics, getDataEntitiesByDEGOddrn) are unauthenticated in 3 of 4 auth modes (DISABLED, OAUTH2, LDAP) by default.
- Only `postDataEntityList` becomes authenticated when `auth.ingestion.filter.enabled=true`; the other 3 unauthenticated handlers REMAIN unauthenticated even with the toggle (IngestionDataEntitiesFilter exact-matches `/ingestion/entities` POST only).
- Under LOGIN_FORM the `permittedPaths` array (LoginFormSecurityConfiguration.java:50) NARROWS to `/ingestion/entities` + `/ingestion/datasources` only; the OTHER 3 endpoints fall through to `pathMatchers("/**").authenticated()`. The LOGIN_FORM mode is STRICTER for the 3 nested paths than OAUTH2/LDAP — a previously-undocumented asymmetry (PROBE-NEEDED: P-146 in sidecar).

The class-level sidecar also surfaces the structural-fix-cheap framing: a single PR broadening `IngestionDataEntitiesFilter`'s path matcher to `/ingestion/**` for ALL HTTP methods closes the cluster's coverage gap at the path-matcher level. Combined with the DOC-GAP-240 sibling enumeration, the cluster is now formally complete at the controller-class tier; the doc-action proposed at DOC-GAP-038 should now publish the 40-cell matrix (or a coarser 5-endpoint × {covered-by-filter, covered-by-whitelist} table) as the canonical operator reference.

### DOC-GAP-178 STRENGTHENS — class-level evidence consolidates the two-filter asymmetric architecture

The new `IngestionController` controller-class sidecar provides the class-level view of the 3-filter architecture (IngestionDataSourceFilter unconditional + IngestionDataEntitiesFilter conditional + NO filter for the other 3 paths). The class-level enumeration consolidates the per-method findings at DOC-GAP-178 (per-method on createDataSource) + DOC-GAP-038 (per-method on postDataEntityList) + DOC-GAP-240 (per-method on ingestMetrics) + DOC-GAP-238 (per-method on getDEG) + DOC-GAP-239 (per-method on stats) into ONE class-level statement: "the IngestionController is the canonical evidence anchor for the multi-filter auth architecture; the architecture is consistent at design-level but inconsistent at name-level (the property `auth.ingestion.filter.enabled` reads as global ingestion auth; its actual scope is one endpoint)". The doc-action proposed at DOC-GAP-178 (extend the S2S doc with a per-endpoint coverage table) remains; the class-level sidecar additionally surfaces the `@Slf4j` dead-annotation finding (zero log calls in the controller body) which strengthens DOC-GAP-178's observability-related sub-finding — the auth-coverage gap is ALSO an audit-trail gap.

### DOC-GAP-193 STRENGTHENS — MetadataFieldController controller-class confirms the doc-coverage gap at the read-tier

The new `MetadataFieldController` controller-class sidecar provides the CONTROLLER-TIER primary source (previously the doc-gap was surfaced at the REPOSITORY tier in DOC-GAP-193's batch R). The controller-tier evidence consolidates: a single read endpoint (`GET /api/metadata/fields`) with no RBAC, no pagination (DOC-GAP-292 NEW), no ordering, no auto-create-on-miss safeguard, exposing the catalogue's INTERNAL-origin field names verbatim to any authenticated user. The class-level sidecar also surfaces the **ServerWebExchange wired but unused** finding (line 20-22 declares the param but never reads it) — an architectural signal that an OWNER-scoped variant was contemplated but never built; this is the cross-link to the future "show me only custom-metadata fields used on Data Entities I own" feature DOC-GAP-193 anticipates. The controller-tier sidecar also surfaces the auto-create-on-miss cross-data-entity exposure (per bugs_limitations[4]) which DOC-GAP-193 already names but the class-level view makes structural: the read-endpoint exposes the WRITE-endpoint's side-effect, completing the circle. The doc-action proposed at DOC-GAP-193 (create `features/data-discovery/custom-metadata.md`) is unchanged; this batch adds the controller-tier evidence to the cluster's evidence chain.

### DOC-GAP-212 STRENGTHENS — OwnerController controller-class adds the ungated-getOwnerList + getOrCreate-bypass class-level enumeration

The new `OwnerController` controller-class sidecar provides class-level evidence of TWO operator-facing surfaces that DOC-GAP-212 already names per-method but had not consolidated at the class tier:
- **`GET /api/owners` ungated read** (per sidecar bugs_limitations[0], MEDIUM) — `SecurityConstants.SECURITY_RULES[143-147]` contains rules for POST/PUT/DELETE ONLY; `getOwnerList` has NO permission gate. Any authenticated user enumerates the entire Owner directory including PII-bearing names (e.g. `alice@acme.com`). The live `/owners` permissions page is SILENT on this read posture (per sidecar's verbatim direct fetch 2026-05-25). DOC-GAP-212 surfaced the audit-trail-read ungated surface (`/api/owner_association_request/activity`); this batch adds the SISTER ungated read on the directory itself.
- **`OwnerService.getOrCreate` BYPASSES the OWNER_CREATE gate** (per sidecar bugs_limitations[1], HIGH) — the service-tier method is reached from THREE separate callers each gated by a DIFFERENT permission: (a) OwnerAssociationRequestServiceImpl.java:57 via `POST /api/owner_association_request` (ungated POST); (b) OwnershipServiceImpl.java:52 via `POST /api/dataentities/{id}/ownerships` gated by DATA_ENTITY_OWNERSHIP_CREATE; (c) TermOwnershipServiceImpl.java:35 via `POST /api/terms/{term_id}/ownerships`. A caller without OWNER_CREATE can spam the directory by repeatedly calling any of these three permissioned endpoints with a never-seen `ownerName`. The live `/permissions` page documents OWNER_CREATE but is SILENT on the three side-channel callers. This is the canonical evidence anchor for the F-019 + DOC-GAP-212 + REFACTOR-222 cluster.

The class-level sidecar ALSO carries the 201-vs-200 OpenAPI/impl drift on createOwner + updateOwner (cross-link DOC-GAP-074 + DOC-GAP-184) AND the no-`@Slf4j` observability-silent finding. The doc-action proposed at DOC-GAP-212 (6-flow narrative replacing the doc's 2-flow narrative) is unchanged; this batch's class-level sidecar adds the directory-read posture + the getOrCreate side-channel as additional sub-points of the same operator-trap cluster.

### DOC-GAP-074 STRENGTHENS — class-level evidence on IngestionController consolidates the 5-handler status-code drift (200/201/201/200/200) in one place

The new `IngestionController` controller-class sidecar enumerates ALL THREE mutating handlers' response code postures in one place: `postDataEntityList` → 200 (line 44, spec says 201 — DRIFT); `postDataSetStatsList` → 201 (line 86, ALIGNED); `ingestMetrics` → 201 (line 94, ALIGNED); `createDataSource` → 200 (line 72); `getDataEntitiesByDEGOddrn` → 200 read. Per existing batch-Z 9+-endpoint cluster framing, the IngestionController's postDataEntityList is the SOLE 201-vs-200 instance on the ingestion surface — the class-level evidence MAKES THE DRIFT VISIBLE AT A GLANCE (a reviewer reading the file sees `ok()` at line 44 vs `CREATED` at line 86 + 94 within ~50 lines of each other). The class-level view also confirms the spec authoring intent: 201 was supposed to be the platform-wide convention for the create-side ingestion responses, and the SOLE drifter is postDataEntityList. The doc-action proposed at DOC-GAP-074 META (spec-side alignment from 201 → 200 OR impl-side alignment from 200 → 201, single PR) is unchanged; this batch confirms the ingestion-surface dimension at primary source.

---

## Coherence (LSN-018 Rule 6 pre-emit summary)

| Check | Count |
|---|---|
| Same-polarity STRENGTHENS (new evidence corroborates existing finding) | 7 (DOC-GAP-035 + DOC-GAP-032 + DOC-GAP-038 + DOC-GAP-178 + DOC-GAP-074 + DOC-GAP-193 + DOC-GAP-212) |
| SUPERSEDES (new evidence contradicts existing finding with stronger grounding) | 0 |
| CONTRADICTS surfaced for triage (not emitted) | 0 |
| NEW findings minted | 3 (DOC-GAP-290 + DOC-GAP-291 + DOC-GAP-292) |
| Back-links emitted to feature-flows / refactor / implicit-ADRs | Per each detail file's cross-references block |

Cross-registry coherence sweeps performed:
- `feature-flows/index.yaml` — searched `slack signing`, `Custom Metadata`, `data-collaboration`, `IngestionController class-level`, `OwnerController class-level`; no contradictions; back-link candidates F-008 + F-009 + F-011 + P-07:F-* + P-09:F-* + P-10:F-001 reflected in the new detail files.
- `concepts/index.yaml` — searched the same anchors; no contradictions; `entities[Slack collaboration app]` + `entities[Custom Metadata Field]` + `entities[Owner]` + `entities[Ingestion Filter]` are cited.
- `test-map/index.yaml` — searched; the test-coverage gaps the new sidecars surface (40-cell auth matrix untested at IngestionController; redirect-endpoint 404 path untested; etc.) are noted in cross-references; the new doc-gap detail files do NOT emit test-map entries directly (separate registry).
- `refactoring-scopes/index.md` — searched; REFACTOR-185 (DISABLED auth bypass) + REFACTOR-073 (ingestion-filter path coverage) + REFACTOR-222 (Owner auto-create) + REFACTOR-024 (cross-owner read posture) are reflected as related_refactoring_scopes on the upstream sidecars; no contradictions.
- `implicit-adrs/index.md` — searched; ADR-CANDIDATE-142 + ADR-CANDIDATE-143 cited in the IngestionController class-level sidecar; no contradictions.

No `state/coherence-conflicts-batch-ZF.md` entries were created; the batch commits cleanly.

---

## Per-finding context budget audit

| Finding | Sidecars read | WebFetches | Graph-search results | Detail file size | Within budget? |
|---|---|---|---|---|---|
| DOC-GAP-290 | 1 (EventApiController) | 4 (data-collab 404 + odd-platform conf + active-platform-features + features list) | 3 (slack signing + EventApi dedup + slack permalink open-redirect) | ~13 KB | YES |
| DOC-GAP-291 | 1 (DataCollaborationController) | inherited from sidecar's 2026-05-25 fetches | 2 (redirect 302 + Mono.empty) | ~13 KB | YES |
| DOC-GAP-292 | 1 (MetadataFieldController) | inherited (DOC-GAP-193's batch R 2026-05-20 verifications within 11-day stale-probe window) | 2 (metadataFieldList page_info + custom-metadata feature) | ~12 KB | YES |
| 7 STRENGTHENS | 4 (IngestionController class + OwnerController class + MetadataFieldController class + DataCollaborationController class) — already read for NEW findings | 0 fresh (inherited within stale-probe cadence) | already-loaded from above | ~5 KB combined | YES |
| **Batch total** | 5 sidecars | 4 fresh WebFetches + inherited | 9 graph-search queries | ~46 KB total | **YES — under 200 KB per-batch budget** |
## Batch ZG append (2026-05-26 — GenAI + DataSet + DatasetField + DataQualityRuns + DataEntityRun controller-class tier)

Batch ZG processes the 5 controller-class sidecars covering GenAIController + DataSetController + DatasetFieldController + DataQualityRunsController + DataEntityRunController, all at commit 4ec2b20. The five controllers collectively surface 22 new sidecar findings; after semantic-dedup (warm graph: 15 queries across NEW candidates) **7 NEW DOC-GAP-NNN minted** + **8 existing STRENGTHENED**.

### Coverage summary

| Sidecar | New IDs minted | Strengthens |
|---|---|---|
| GenAIController (class) | — | DOC-GAP-007 |
| DataSetController (class) | DOC-GAP-295 + DOC-GAP-296 | DOC-GAP-022 + DOC-GAP-287 |
| DatasetFieldController (class) | — | DOC-GAP-213 + DOC-GAP-260 |
| DataQualityRunsController (class) | DOC-GAP-297 + DOC-GAP-298 | DOC-GAP-264 + DOC-GAP-265 + DOC-GAP-272 |
| DataEntityRunController (class) | DOC-GAP-293 + DOC-GAP-294 + DOC-GAP-299 | DOC-GAP-022 |

### NEW findings minted (7)

- **DOC-GAP-293** (HIGH, missing-page) — `GET /api/dataentities/{data_entity_id}/runs` (per-test runs-history surface mounted at `/dataentities/{id}/history` + the test-report-details preview) is COMPLETELY UNDOCUMENTED — no doc page on `docs.opendatadiscovery.org`; canonical URL `/features/data-quality/test-results` returns 404; the six-value `DataEntityRunStatus` wire enum is unlisted; the status_reason payload is undocumented; operators have ZERO doc-side recourse for the page-size + ordering + RUNNING-state + cross-owner-read behaviour. **(NEW batch ZG — DataEntityRunController class-tier PRIMARY SOURCE; live WebFetch `/features/data-quality/test-results` 404 + adjacent pages 200 with verbatim absence of runs-history coverage; missing-page evidence at the canonical URL itself)**

- **DOC-GAP-294** (HIGH, drift) — `DataEntityRunStatus` wire enum (6 values: SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN per `components.yaml:1407-1415`) is a STRICT SUBSET of the DB column `data_entity_task_run.status` (7 values via `IngestionTaskRunStatus` + RUNNING); MapStruct's `DataEntityRunMapper` uses `Enum.valueOf()` which throws `IllegalArgumentException` on unknown literals → runs-history endpoint HYPOTHESISED to return HTTP 500 the moment any DQ test enters RUNNING state — the EXACT moment an operator most wants to consult the `/history` tab; pinned by probe P-151; the asymmetry is undocumented at every layer including the OpenAPI spec, the live data-quality pages, and the (missing) test-results.md page. **(NEW batch ZG — DataEntityRunController class-tier PRIMARY SOURCE; static evidence via the 6-vs-7 enum mismatch + the strict MapStruct mode; dynamic verification deferred to P-151)**

- **DOC-GAP-295** (HIGH, drift — security-class — LSN-020 instance) — `DatasetController.{getDataSetStructureByVersionId, getDataSetStructureDiff}` accept `data_entity_id` as the load-bearing path-prefix but the SQL at `ReactiveDatasetVersionRepositoryImpl.java:128-129, 147-157` filters `DATASET_VERSION.ID.eq(versionId)` ONLY with no `dataset_oddrn` predicate — ANY authenticated user can request `GET /api/datasets/X/structure/V` with version V belonging to dataset Y and receive Y's full structure (field names + types + descriptions + tags + terms + lookup-table definitions) with HTTP 200; cross-dataset schema metadata leak via sequential `bigserial` version_id enumeration; the live `/features/data-discovery/schema-diff` page (status 200) describes the per-dataset framing but is SILENT on the dataEntityId-is-decorative semantic; the `DATASET_VERSION.DATASET_ODDRN` column IS in the schema AND is JOINED by the latest-path variant — one-line WHERE-clause closure available; pinned by probe P-147. **(NEW batch ZG — DataSetController class-tier PRIMARY SOURCE; live WebFetch `schema-diff` 200 confirms doc-side silence on the leak; LSN-020 instance; cross-link DOC-GAP-001 SecurityConstants wiring family + DOC-GAP-287 cross-owner cluster)**

- **DOC-GAP-296** (MEDIUM, coverage-gap) — `DatasetController`'s FOUR endpoints (`getDataSetStructure[ByVersionId|Latest]`, `getDataSetStructureDiff`, `getDataSetRelationships`) are missing from `developer-guides/api-reference/relationships` AND every other api-reference sub-page; SECONDARILY the diff endpoint returns HTTP 500 (bare `RuntimeException("Query returned %s rows for diff request")` at `DatasetVersionServiceImpl.java:69-71`) for non-existent version_ids — asymmetric with the IDENTICAL-ids path (clean HTTP 400 via `BadUserRequestException`); callers cannot distinguish wrong-id from platform-broken from the status code alone; pinned by probe P-149; the relationships api-reference page enumerates 3 `RelationshipController` endpoints but does NOT list `DataSetController.getDataSetRelationships` at `GET /api/datasets/{data_entity_id}/relationships`. **(NEW batch ZG — DataSetController class-tier PRIMARY SOURCE; sibling of DOC-GAP-009/244/198 api-reference structural absence family; live WebFetch `api-reference/relationships` 200 confirms the absence)**

- **DOC-GAP-297** (HIGH, drift — LSN-019 class) — Quality Dashboard `test_results` counts TESTS keyed on latest-run-status, NOT RUNS — directly contradicting the live `/features/data-quality/dashboard` verbatim *"the count of test runs broken down by status"*; the SQL joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`) whose `task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`) — exactly one row per test; a test with 100 runs (99 SUCCESS, 1 most-recent FAILED) contributes 1 to FAILED bucket; the dashboard cannot distinguish "transient failure on a stable test" from "test that fails every run"; the OpenAPI operation summary + the UI chart label + the live doc all describe a per-run count; the platform delivers a per-test count keyed on the latest run; the implicit ADR (denormalised last-run table for scalability) is INTENTIONAL but the semantic divergence is silent and load-bearing for operator triage. **(NEW batch ZG — DataQualityRunsController class-tier PRIMARY SOURCE; LSN-019 class — UI label vs SQL semantic transcription drift on the dashboard flagship indicator)**

- **DOC-GAP-298** (MEDIUM, drift) — Quality Dashboard Table Health classification RULES are entirely undocumented; the live `/features/data-quality/dashboard` enumerates three slices but provides NO definitions for how a table is classified; the SQL CTE algebra at `ReactiveDataQualityRunsRepositoryImpl.java:111-157` defines: HEALTHY = dataset has DQ test AND NO last_run with status != SUCCESS; ERROR = dataset has a last_run with status in {BROKEN, FAILED} AND NOT in healthy; WARNING = residual; the rules are NOT mutually independent — they layer Healthy-first / Error / Warning-residual; the operator cannot predict which colour their dataset will render; conditionally-SKIPPED tests (Great Expectations skip-when-precondition-not-met) classify as WARNING (not HEALTHY) because SKIPPED != SUCCESS — the operator-mental-model collision is undisclosed; datasets without DQ tests are silently absent from all three buckets (appear only in Monitored Tables' Not-Monitored slice — a doc-side missing-cross-link). **(NEW batch ZG — DataQualityRunsController class-tier PRIMARY SOURCE; sibling of DOC-GAP-266 (Table Health LABEL drift); THIS finding covers the RULES, DOC-GAP-266 covers the LABELS; live WebFetch `dashboard` 200 confirms verbatim absence of classification rules)**

- **DOC-GAP-299** (HIGH, drift — compound: undocumented diagnostic-PII leak + undocumented cross-owner read posture) — `DataEntityRun.statusReason` is free-form `type: string` populated verbatim by the ingested test framework (Great Expectations, dbt, custom) and surfaced UNFILTERED + UNREDACTED to ANY authenticated user via `GET /api/dataentities/{data_entity_id}/runs` — combined with the controller's read-collaborative posture (no `@PreAuthorize`, no `SecurityRule`, no owner predicate at `ReactiveDataEntityTaskRunRepositoryImpl.java:161-191`), the per-test runs-history endpoint is a CROSS-OWNER DIAGNOSTIC-TEXT BROADCAST CHANNEL; Great Expectations COMPLETE-format emits failed-row sample values including potential PII; dbt emits compiled SQL + schema names; custom frameworks emit arbitrary content; the live data-quality pages (`/features/data-quality`, `/dashboard`, `/test-results-import` — all status 200) are SILENT on the leak channel; pinned by probe P-152. **(NEW batch ZG — DataEntityRunController class-tier PRIMARY SOURCE; compound finding extending DOC-GAP-287 cross-owner cluster to per-test diagnostic text; LSN-001 / LSN-002 operator-impact-by-omission class)**

### Existing entries STRENGTHENED (8)

#### DOC-GAP-007 STRENGTHENS — `GenAIController` class-tier confirms 4 NEW security-posture dimensions undocumented at the live feature page

Batch ZG's `GenAIController` controller-class sidecar adds the class-tier PRIMARY SOURCE confirmation for DOC-GAP-007's "GenAI feature page lacks caveats" finding, with FOUR new undocumented dimensions beyond the original three (prompt-injection / SSRF / DISABLED-anonymous-reachability):

- **NEW dimension: NO authorization gate beyond generic `authenticated()`** — any authenticated user can call `/api/genai/ask` and drive cost on the operator's external AI account; no `GENAI_USE` Permission exists in `PolicyPermissionDto`; no Role check; no owner scope. Per `GenAIController.java:13-24` + `SecurityConstants.SECURITY_RULES` (verified zero matches for `/api/genai/*`).
- **NEW dimension: NO request-body validation** — `GenAIRequest.body` is `type: string` with no `@Size`, no `maxLength` in OpenAPI; the controller has no `@Valid`. Multi-megabyte prompts are accepted and forwarded verbatim. Combined with no-auth-gate + no-rate-limit, this is a cost-injection vector.
- **NEW dimension: NO rate limit** — no Bucket4j / Resilience4j / @RateLimit / token bucket on the endpoint or the outbound WebClient. An authenticated user can fire requests at HTTP client speed; N replicas multiply effective rate by N.
- **NEW dimension: NO audit log of who asked what** — `@Slf4j` is on `GenAIServiceImpl` but NO `log.*` call captures user identity, question text, or response. Forensic reconstruction of "which user submitted which prompt" requires external LLM logs cross-referenced with reverse-proxy access logs. The `ServerWebExchange exchange` parameter is exposed at the controller (available `Principal` + headers) but discarded — the canonical fix-anchor for audit logging.
- **NEW dimension: NO PII redaction / content filter** — user prompts forwarded verbatim to whatever LLM the operator configured. No scrubber, no detection of credentials/secrets/PII.
- **NEW dimension: sibling controller pattern asymmetry** — disabled state surfaces as HTTP 400 (`BadUserRequestException` "Gen AI is disabled") at the service layer, NOT HTTP 404 via `@ConditionalOnProperty` at the controller bean (the sibling `DataCollaborationController` pattern). Operator-visible: data-collaboration 404s the route when disabled; genai 400s it.
- **NEW dimension: response unwrap silently brittle** — `GenAIServiceImpl.java:46-47` does `unescapeJava(CharMatcher.is('"').trimFrom(response))` assuming the external service returns a JSON-quoted string; structured `{...}` responses get mishandled silently (the contract on the external service's response shape is implicit in the implementation and undocumented in OpenAPI).
- **NEW dimension: no max-in-memory-size override on `genAiWebClient`** — uses Spring WebFlux default 256KB; the application-wide 20MB setting at `application.yml:14-15` is NOT inherited; verbose LLM responses > 256KB fail with `DataBufferLimitException`.

The original DOC-GAP-007 framing (3 caveats: prompt-injection / SSRF / DISABLED) is now extended to a 10-caveat compound finding. The proposed doc action (a "Security caveats" H2 on `features/active-platform-features/genai.md`) is unchanged in shape but extends to all 10 dimensions; the maintainer's authoring pass closes them all at once.

- **NEW surfaced_by (batch ZG)**:
  - `odd-platform__java__GenAIController__controller-class__GenAIController.md:bugs_limitations_corner_cases.[0..5]` — verbatim entries for each of the 8 dimensions; severities HIGH/HIGH/HIGH/HIGH/HIGH/MEDIUM/MEDIUM/MEDIUM/LOW.
  - `odd-platform__java__GenAIController__controller-class__GenAIController.md:security.known_security_gaps.[0..6]` — full security-section enumeration.
  - `odd-platform__java__GenAIController__controller-class__GenAIController.md:docs_link_semantic.doc_drift_findings.[0]` — verbatim: *"Live feature page documents 'no authentication, no retry' but is SILENT about the absence of (a) an ODD-side permission/role gate — ANY authenticated user can call the endpoint, not just admins; (b) a per-user / per-tenant rate limit; (c) a request-body size cap; (d) prompt-injection mitigations or content filtering; (e) audit logging of who asked what; (f) PII redaction before forwarding. An operator reading the feature page would not learn that the endpoint is a vector for any authenticated user to drive arbitrary cost on their AI vendor's account, with no in-platform record of what was asked."*
  - `odd-platform__java__GenAIController__controller-class__GenAIController.md:implicit_adrs.[0..4]` — implicit ADRs for the thin-proxy / service-tier-gate / no-auth-header / no-retry / generic-error-fallthrough patterns.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction — the GenAI thin-proxy posture is consistent across the GenAIController-method sidecar (referenced from DOC-GAP-007 + DOC-GAP-017) and the new class-tier sidecar; same polarity throughout. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The doc-action shape stays "add a Security caveats H2 to features/active-platform-features/genai.md"; the contribution is to extend the section to cover the 7 added dimensions beyond the original 3.

#### DOC-GAP-022 STRENGTHENS — DataEntityRun runs-history AND DataSetController structure endpoints add 5 fresh unbounded-`size` instances

Batch ZG's `DataEntityRunController` + `DataSetController` class-tier sidecars surface 5 new endpoints that flow `size` unbounded through OpenAPI → controller → SQL `LIMIT` paths, extending DOC-GAP-022's catalog of the pagination-unbounded pattern:

- **NEW instances (batch ZG)**:
  - `GET /api/dataentities/{id}/runs` — flows `size` to `JOOQ paginate LIMIT` at `ReactiveDataEntityTaskRunRepositoryImpl.java:181`; UI default page-size 100 (`TestRunsHistory.tsx:27`) but `OpenAPI SizeParam` has no max constraint (`components.yaml:4222-4229`); a deliberately-crafted curl with `size=10000000` reaches the DB as-is and attempts to materialise 1M rows through JOOQ + MapStruct + Jackson; combined with the cross-owner read posture (DOC-GAP-299), an attacker can bulk-enumerate diagnostic streams in O(test_count) HTTP calls.
  - `GET /api/datasets/{id}/structure/{version_id}` (and 3 sibling DatasetController endpoints) — flow size through the JOOQ pagination helpers in the dataset version repository; no clamp at the controller; cross-link to DOC-GAP-295's cross-dataset enumeration risk (the unbounded size amplifies the enumeration attack surface).

- **NEW surfaced_by (batch ZG)**:
  - `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:bugs_limitations_corner_cases.[0]` (MEDIUM per sidecar) — *"Page-size unbounded — OpenAPI SizeParam has no min/max constraint (components.yaml:4222-4229); the controller's Integer size parameter is passed through verbatim to the SQL LIMIT."*
  - `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:stress_findings.request_inputs[size]` — `DRIFT_MINOR`; pinned by P-150 partial coverage + needs a dedicated DoS probe.
  - `odd-platform__java__DataEntityRunController__controller-class__DataEntityRunController.md:performance.known_performance_gaps.[0]` — same finding from the performance lens.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction — DOC-GAP-022 catalogs the platform-wide pattern at MEDIUM; this batch adds 5 more concrete endpoints; the proposed "Pagination" section on `developer-guides/api-reference.md` covers the whole class. No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM** at the doc-gap level. The DOC-GAP-022 proposed doc action is unchanged; this batch's contribution is to enumerate 5 more endpoints + the cross-owner read amplification of the runs-history surface.

#### DOC-GAP-213 STRENGTHENS — `DatasetFieldController` class-tier reaffirms both SecurityConstants wiring bugs with the FULL endpoint-set enumeration

Batch ZG's `DatasetFieldController` controller-class sidecar provides the class-tier PRIMARY SOURCE for DOC-GAP-213's compound SecurityConstants wiring-bug finding, plus a NEW response-code drift dimension:

- **NEW evidence (batch ZG)**:
  - `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:concepts.invariants.[5,6]` — verbatim re-statement of both wiring bugs from the class-tier perspective; the 7-endpoint enumeration confirms the wiring bugs sit in a 5-line block (`SecurityConstants.java:295-299`) at the structural boundary between the ALERT-side and DATASET_FIELD-side rule cluster.
  - `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[2]` (MEDIUM per sidecar) — **NEW asymmetric response-code drift dimension**: the OpenAPI declares HTTP 201 for the THREE PUT endpoints (`description`, `internalName`, `tags`) but the controller returns 200 OK via `ResponseEntity::ok` — drift instance ON TOP of the wiring bugs; the `createEnumValue` POST endpoint correctly returns 201 via `HttpStatus.CREATED` — the asymmetry implies the controller author followed the spec for one endpoint but not the other three (DOC-GAP-074 META extension — the platform-wide 201-vs-200 cluster).
  - `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:tests_coverage_semantic.uncovered_behaviours[wiring bugs]` — ZERO direct HTTP-boundary tests catch either wiring bug; probes P-153 + P-154 + P-155 collectively cover the six new HIGH-severity findings from this sidecar (two auth-wiring + BULK-REPLACE + replay + concurrency + cascade).

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction — the wiring-bug pair was originally surfaced by the DatasetFieldController method-tier sidecars (DOC-GAP-213's batch V context); the class-tier sidecar adds the FULL endpoint-set enumeration showing exactly which 5 lines of `SecurityConstants.java` carry both bugs. Same polarity. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The DOC-GAP-213 proposed doc action (5-line SecurityConstants fix + companion docs + REGRESSION-PIN tests + SecurityConstantsConformanceTest platform-wide audit) is unchanged.

#### DOC-GAP-260 STRENGTHENS — `DatasetFieldController` class-tier confirms ALL FOUR tag-write undocumented dimensions

Batch ZG's `DatasetFieldController` controller-class sidecar re-confirms DOC-GAP-260's compound tag-write undocumented-semantic finding (replace-all + auto-create + EXTERNAL_STATISTICS preservation + parent-scoped authorization) from the class-tier perspective:

- **NEW surfaced_by (batch ZG)**:
  - `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:concepts.operations.[2]` — restates the 4-dimension semantic from the class-tier perspective.
  - `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:concepts.invariants.[1]` — parent-scoped authorization via `DatasetFieldResourceExtractor`; reaffirms the data-entity-level permission collapse documented on the live Permissions page misleadingly.
  - `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:dependencies_semantic.coupling.[0]` — the per-request DB round-trip via `getDataEntityIdByDatasetFieldId` is a fresh performance dimension for the parent-scoped authorization model.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no contradiction. Same polarity. No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM**. The DOC-GAP-260 four-part proposed doc action is unchanged.

#### DOC-GAP-264 STRENGTHENS — `DataQualityRunsController` class-tier provides the BACKEND PRIMARY SOURCE for the `titleIds`→`OWNERSHIP.TITLE_ID` LSN-020 binding

Batch ZG's `DataQualityRunsController` controller-class sidecar provides the BACKEND class-tier PRIMARY SOURCE for DOC-GAP-264's `titleIds` filter LSN-020 drift (originally surfaced by the UI-side `DataQualityFilters` sidecar at batch ZC):

- **NEW evidence (batch ZG)**:
  - `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[1]` (HIGH per sidecar) — the full backend trace from controller params → service → mapper → repository SQL bind `OWNERSHIP.TITLE_ID.in(titleIds)` at `ReactiveDataQualityRunsRepositoryImpl.java:301, 309`; reaffirms the LSN-020 instance with the BACKEND-tier primary source.
  - `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:docs_link_semantic.doc_drift_findings.[1]` — same finding from the doc-drift lens; cross-references the UI sidecar.

- **Coherence (LSN-018 Rule 6 pre-emit)**: same polarity as DOC-GAP-264's original UI-side framing; the class-tier backend confirmation closes the SQL-level evidence. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The DOC-GAP-264 three-part proposed doc action (doc-side primary + UI relabel + code-side comment) is unchanged.

#### DOC-GAP-265 STRENGTHENS — `DataQualityRunsController` class-tier confirms the 6-status enum is iterated by the BACKEND's mapper-pad logic (every category × every status = 36-cell envelope)

Batch ZG's `DataQualityRunsController` controller-class sidecar adds the BACKEND mapper-pad invariant evidence for DOC-GAP-265's "doc says 3 statuses, code renders 6" finding:

- **NEW evidence (batch ZG)**:
  - `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:concepts.invariants.[9]` — verbatim: *"Mapper pads every category × every status with `count=0` if absent — the response envelope is always 6 categories × 6 statuses = 36 cells regardless of data"* — the backend GUARANTEES that the wire response carries all 6 statuses regardless of which appear in the DB; the UI's 6-chip legend is therefore data-faithful, not aspirational. This strengthens the case for the doc-side fix to enumerate all 6 statuses.
  - `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[3]` — verbatim: *"Test categories are a closed enum padded with UNKNOWN as a catch-all; the response envelope is always 36 cells (6 categories × 6 statuses) regardless of data shape"* — the DELIBERATE design intent of the 36-cell padding.

- **Coherence (LSN-018 Rule 6 pre-emit)**: same polarity as DOC-GAP-265's original UI-side framing. No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM**. The DOC-GAP-265 proposed doc action (six-status enumeration in dashboard.md) is unchanged.

#### DOC-GAP-272 STRENGTHENS — `DataQualityRunsController` class-tier provides the BACKEND PRIMARY SOURCE for the `namespaceIds` SQL widening

Batch ZG's `DataQualityRunsController` controller-class sidecar provides the BACKEND class-tier PRIMARY SOURCE for DOC-GAP-272's `namespaceIds` SQL widening finding:

- **NEW evidence (batch ZG)**:
  - `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:bugs_limitations_corner_cases.[2]` (MEDIUM per sidecar) — verbatim: *"`namespaceIds`/`deNamespaceIds` filter silently widens the match: 'Namespace X' includes entities whose own NAMESPACE_ID is null/different but whose DATA_SOURCE.NAMESPACE_ID = X. The SQL: `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`)."*
  - `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:docs_link_semantic.doc_drift_findings.[2]` — same finding from the doc-drift lens.

- **Coherence (LSN-018 Rule 6 pre-emit)**: same polarity. No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM**. The DOC-GAP-272 proposed doc action is unchanged.

#### DOC-GAP-287 STRENGTHENS — `DataSetController.getDataSetRelationships` is a NEW invocation site of the cross-owner read posture cluster (extending it to per-dataset relationships)

Batch ZG's `DataSetController` controller-class sidecar provides a 5th surface for the cross-owner read posture cluster:

- **NEW evidence (batch ZG)**:
  - `odd-platform__java__DataSetController__controller-class__DataSetController.md:bugs_limitations_corner_cases.[1]` (MEDIUM per sidecar) — verbatim: *"No owner-scoping at any layer: GET endpoints fall through to `AuthorizationCustomizer.spec.pathMatchers('/**').authenticated()` ... Every authenticated user reads every dataset's structure. With `auth.type=DISABLED` every caller — authenticated or not — reads every dataset's structure. The feature page implies role-based visibility (see doc_drift_findings)."*
  - `odd-platform__java__DataSetController__controller-class__DataSetController.md:docs_link_semantic.doc_drift_findings.[1]` — verbatim: *"Relationships feature page claims 'role-based visibility' / 'every relationship the user can see' — the code path runs no permission filter; output is identical for any authenticated user. Drift: doc implies authorization that code does not implement."* — NEW dimension: the feature page actively MISREPRESENTS the authorization model (claims role-based visibility); not merely silent like DOC-GAP-287's catalog-global members.
  - `odd-platform__java__DataSetController__controller-class__DataSetController.md:security.known_security_gaps.[3]` (LOW per sidecar) — feature-page overstates the security model — doc drift, not a runtime risk.

- **Coherence (LSN-018 Rule 6 pre-emit)**: same polarity as DOC-GAP-287's catalog-wide cross-owner cluster (DOC-GAP-002 alerts, DOC-GAP-025 activity-feed, DOC-GAP-079 search, DOC-GAP-287 catalog-global relationships) — this is a 5TH SURFACE on the SAME pattern, now extending the cluster to per-dataset relationship reads. **NEW dimension on top of the cluster**: the feature page actively claims role-based visibility (a MISREPRESENTATION, not just a silent absence) — this is qualitatively worse than the silent-absence pattern in the other 4 cluster members. The cluster's META framing (cross-owner posture undocumented at every per-pillar surface) is reinforced; the per-dataset relationships surface adds a SUPERLATIVE case (doc claims AUTHORIZATION but the code is the same cross-owner-readable absence). No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The DOC-GAP-287 proposed doc action (per-pillar admonition + cluster-wide META section + code-side options) is unchanged; this batch's contribution is to enumerate the 5th surface + flag the qualitatively-worse "doc misrepresents authorization" dimension that the maintainer's META section can call out.

---

## Coherence (LSN-018 Rule 6 pre-emit summary)

| Check | Count |
|---|---|
| Same-polarity STRENGTHENS (new evidence corroborates existing finding) | 8 (DOC-GAP-007 + DOC-GAP-022 + DOC-GAP-213 + DOC-GAP-260 + DOC-GAP-264 + DOC-GAP-265 + DOC-GAP-272 + DOC-GAP-287) |
| SUPERSEDES (new evidence contradicts existing finding with stronger grounding) | 0 |
| CONTRADICTS surfaced for triage (not emitted) | 0 |
| NEW findings minted | 7 (DOC-GAP-293 + DOC-GAP-294 + DOC-GAP-295 + DOC-GAP-296 + DOC-GAP-297 + DOC-GAP-298 + DOC-GAP-299) |
| Back-links emitted to feature-flows / refactor / implicit-ADRs | Per each detail file's cross-references block |

Cross-registry coherence sweeps performed:

- `feature-flows/index.yaml` — searched `DataEntityRun`, `runs history`, `DataSetController`, `dataEntityId`, `getDataQualityTestsRuns`, `DATA_ENTITY_TASK_LAST_RUN`, `Table Health`, `status_reason`; no contradictions; back-link candidates F-022 (per-dataset Test Reports), P-04:F-001 (Test Results Import), P-04:F-002 (Quality Dashboard) reflected in the new detail files.
- `concepts/index.yaml` — searched the same anchors; no contradictions; `entities[DataEntityRun]`, `entities[DataEntityRunStatus]` (6-value wire enum), `entities[IngestionTaskRunStatus]` (7-value DB enum), `entities[DATA_ENTITY_TASK_LAST_RUN]`, `entities[DataSetVersion]`, `entities[DataSetStructure]`, `entities[DataQualityResults]` are cited.
- `test-map/index.yaml` — searched; the test-coverage gaps surfaced (zero HTTP-boundary tests for the runs-history controller; no test for `getLatestTablesHealth`; cross-owner read posture untested for `/runs`) are noted in cross-references; the new doc-gap detail files do NOT emit test-map entries directly (separate registry).
- `refactoring-scopes/index.md` — searched; REFACTOR-024 (cross-owner read posture family) + (potential new REFACTOR for the `dataEntityId` drift fix at `ReactiveDatasetVersionRepositoryImpl.java:128-129, 147-157`) are reflected as `related_refactoring_scopes` on the upstream sidecars; no contradictions.
- `implicit-adrs/index.md` — searched; ADR-CANDIDATE-003 (read-collaborative catalog) + ADR-CANDIDATE-114 (read-cardinality split) cited in the new controller sidecars; no contradictions.

No `state/coherence-conflicts-batch-ZG.md` entries were created; the batch commits cleanly.

---

## Per-finding context budget audit

| Finding | Sidecars read | WebFetches (fresh + inherited) | Graph-search results | Detail file size | Within budget? |
|---|---|---|---|---|---|
| DOC-GAP-293 | 1 (DataEntityRunController) | 3 inherited (test-results 404 + data-quality 200 + test-results-import 200) | 4 graph-search queries (test-results, runs-history docs, status_reason, page-size) | ~14 KB | YES |
| DOC-GAP-294 | 1 (DataEntityRunController) | 0 fresh; relies on schema citations | 2 graph-search queries (wire enum vs DB enum, RUNNING status) | ~14 KB | YES |
| DOC-GAP-295 | 1 (DataSetController) | 1 inherited (schema-diff 200) | 3 graph-search queries (dataEntityId drift, cross-dataset leak, LSN-020 cluster) | ~16 KB | YES |
| DOC-GAP-296 | 1 (DataSetController) | 1 inherited (api-reference/relationships 200) | 2 graph-search queries (api-reference hub, schema-diff 500 vs 404) | ~14 KB | YES |
| DOC-GAP-297 | 1 (DataQualityRunsController) | 1 inherited (dashboard 200) | 3 graph-search queries (test_results semantics, latest run aggregation, dashboard) | ~14 KB | YES |
| DOC-GAP-298 | 1 (DataQualityRunsController) | 1 inherited (dashboard 200) | 2 graph-search queries (Table Health rules, classification CTE) | ~14 KB | YES |
| DOC-GAP-299 | 1 (DataEntityRunController) | 3 inherited (3 data-quality pages 200 each) | 3 graph-search queries (status_reason leak, cross-owner cluster, free-form text) | ~15 KB | YES |
| 8 STRENGTHENS | 5 sidecars (already read for NEW findings) | 0 fresh (all inherited within stale-probe cadence) | already-loaded from above | ~10 KB combined | YES |
| **Batch total** | 5 sidecars | 10 inherited fresh WebFetches | 19 graph-search queries | ~111 KB total | **YES — under 200 KB per-batch budget** |
<!--
batch: ZH
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
mode: incremental
consumed_sidecars: 5
  - odd-platform__ts__routes__route__management
  - odd-platform__ts__routes__route__terms
  - odd-platform__ts__routes__route__masterData
  - odd-platform__ts__routes__route__dataModelling
  - odd-platform__ts__routes__route__dataQuality

new_findings: 3                # DOC-GAP-300 (LOW) + DOC-GAP-301 (MEDIUM compound) + DOC-GAP-302 (MEDIUM META)
strengthened_findings: 5       # DOC-GAP-186 + DOC-GAP-205 + DOC-GAP-263 + DOC-GAP-138 + DOC-GAP-287 (no severity / category change — no headline rewrite)

frontmatter_count_deltas:
  total_findings: +3
  findings_by_severity:
    HIGH: +0
    MEDIUM: +2                 # DOC-GAP-301 + DOC-GAP-302
    LOW: +1                    # DOC-GAP-300
  findings_by_category:
    drift: +3
    broken-url: +0
    missing-anchor: +0
    missing-page: +0
    stale-page: +0
    coverage-gap: +0
    meta: +1                   # DOC-GAP-302 (compound META — WithPermissionsProvider naming-vs-behaviour META)
  notes:
    - "DOC-GAP-302 is META — it is both classified as category=drift AND meta=true; the count is reflected in BOTH the drift +3 and the meta +1."

dedup:
  protocol: registry-search-spawn.md rev 7.1 (semantic graph-search)
  dedup_runs_per_candidate:
    - "Management UI route /management not admin-only any authenticated user reads catalog WithPermissionsProvider does not block rendering" → top hits DOC-GAP-186 (0.72), DOC-GAP-187 (0.71), DOC-GAP-082 (0.70). Decision: STRENGTHENS DOC-GAP-186 (closest match; the management-route sidecar is the URL-shape PRIMARY SOURCE that confirms the WithPermissionsProvider context-only behaviour at all 9 Management sub-routes).
    - "WithPermissionsProvider context seed does not block rendering naming-vs-behaviour drift" → top hit DOC-GAP-072 (0.71) but unrelated; no existing entry on this naming-vs-behaviour META — MINT DOC-GAP-302.
    - "terms route docs say catalog-wide list but UI is search-with-facets Dictionary tab termsearch" → top hit DOC-GAP-205 (0.80). Decision: STRENGTHENS DOC-GAP-205 (the terms-route sidecar is the URL-shape PRIMARY SOURCE for the same list-vs-search drift; adds 2-LAYER triangulation).
    - "data-modelling URL redirect query-examples doc page describes /data-modelling RBAC overstatement" → top hit DOC-GAP-211 (0.74; query-examples field count drift — not the same), DOC-GAP-287 (0.71; relationships visibility — closest contextual match). Decision: STRENGTHENS DOC-GAP-287 (the dataModelling-route sidecar adds the UI-route primary source for the same P-02 read-collaborative posture cluster).
    - "data-quality dashboard route no access control silence permissions any authenticated user" → top hit DOC-GAP-263 (0.78). Decision: STRENGTHENS DOC-GAP-263 (the dataQuality-route sidecar is the URL-shape PRIMARY SOURCE).
    - "masterData RBAC phrasing route-level permission gate misleading WithPermissionsProvider lookup-tables overstates restriction" → top hits DOC-GAP-186 (0.67) + DOC-GAP-134 (0.66) + DOC-GAP-133 (0.66) — none on Master Data / Lookup Tables specifically; MINT DOC-GAP-301 (compound — 3 vectors).
    - "bare /terms URL blank page no element no index route React Router parent route deep-link rendering hole" → top hits DOC-GAP-138 (0.72; NaN coercion — different class), DOC-GAP-203 (0.69; term-to-term linkage — different class), DOC-GAP-011 (0.68; legacy-URL — different class). Decision: MINT DOC-GAP-300 (no equivalent entry exists for bare-URL blank-page issue at the Data Glossary surface).
    - "termId parseInt NaN coercion no isNaN guard backend 404 invalid term URL non-numeric" → top hit DOC-GAP-138 (0.72). Decision: STRENGTHENS DOC-GAP-138 (the terms-route + management-route sidecars surface 2 additional instances of the SAME class — `useTermsRouteParams` + `useIntegrationRouteParams`).
    - "data-modelling relationships ungated read-collaborative ERD any authenticated user" → top hit DOC-GAP-287 (0.75). Decision: STRENGTHENS DOC-GAP-287 (same finding — UI-route layer COMPANION to the existing controller-tier primary source).
    - "/management/integrations sub-route no WithPermissionsProvider asymmetry inconsistent permission wrapping" → top hit DOC-GAP-187 (0.72; UI-vs-API DISABLED asymmetry — adjacent but different angle). Decision: surfaced as a NEW STRUCTURAL ANCHOR within DOC-GAP-186 strengthen (Integrations sub-route asymmetry is the per-sub-route variant of the broader Management posture drift) + cross-link to DOC-GAP-302 NEW META. Not minted as a standalone finding (the asymmetry is a sub-case of the META + the route-mount documented in DOC-GAP-186 strengthen).
    - "stale URL legacy /features/active-platform-features/data-modelling 404" → top hits DOC-GAP-035 (0.80), DOC-GAP-011 (0.80), DOC-GAP-012 (0.80) — the legacy-URL cluster. Decision: surfaced as a NEW STRUCTURAL ANCHOR within DOC-GAP-287 strengthen (the dataModelling-route sidecar's record adds this pillar to the cluster) but NOT minted as a standalone finding (no in-platform link references the stale URL; the issue is observational not load-bearing).
  dedup_fallback: none (semantic graph-search succeeded for all 8 candidate queries)
  webfetch_verifications_this_session:
    - "All 5 batch-ZH sidecars' WebFetch records inherited within LSN-018 stale-probe 11-day window — see individual detail files. 0 direct WebFetches in THIS reducer pass (per LSN-018 protocol — sidecar enrichments fetched in-session)."

coherence_rule6:
  strengthens: 5
    # DOC-GAP-186 (Management top-nav tab visibility — same-registry same-polarity strengthen via route-module URL-shape PRIMARY SOURCE)
    # DOC-GAP-205 (Dictionary tab UX undocumented — same-registry same-polarity strengthen via route-module URL-shape primary source)
    # DOC-GAP-263 (/data-quality no client-side gate — same-registry same-polarity strengthen via route-module URL-shape primary source)
    # DOC-GAP-138 (DataEntityDetails NaN coercion — same-registry same-polarity strengthen, extended to 3-instance cluster across DataEntityDetails + Terms + Management route modules)
    # DOC-GAP-287 (Data Modelling relationships visibility — same-registry same-polarity strengthen via UI-route layer COMPANION to the existing controller-tier primary source)
  cross_registry_strengthens: 4
    # concepts.yaml:entities[Term] + entities[Lookup Table] + entities[Permission (Authorization)] + entities[Term Search Session] — back-links emitted in DOC-GAP-300/301/302 frontmatter `related_pillar_features`
    # feature-flows F-001 (Lookup Tables) + F-002 (Term-search session) — same-polarity cluster members; back-links emitted in DOC-GAP-300/301 frontmatter
    # implicit-adrs ADR-CANDIDATE-* (read-collaborative posture across P-02/P-03/P-04/P-06 + P-08) — same-polarity; the platform-wide read-collaborative posture is structurally consistent across these 5 pillars
    # retrospectives LSN-001 + LSN-002 + LSN-006 + LSN-018 — same-polarity (operator-trap class + coherence-conflict mechanism)
  supersedes: 0
  conflicts_surfaced: 0
  note: |
    Rule-6 pre-emit check ran for the 3 new findings (anchors:
    `termsPath / termsRoutes / parseInt(termId, 10) / WithPermissionsProvider /
    PermissionProvider / WithPermissions / RestrictedRoute / lookupTablesPath /
    BASE_PATH / dataModellingPath / queryExamplesPath / relationshipsPath /
    dataQualityPath / managementPath / associationsPath / integrationsPath`).
    Every cross-registry hit in concepts.yaml + feature-flows + implicit-adrs +
    retrospectives is SAME-POLARITY (the registries already assert the same
    facts: the read-collaborative posture across 5 pillars, the
    WithPermissions HOC HIDE mechanism, the read-collaborative cross-owner
    enumeration cluster, the NaN-coercion type-assertion-lie pattern). No
    CONTRADICTS, no SUPERSEDES. Back-links emitted on all 3 new detail files +
    all 5 strengthen-append shards.

severity_buckets_after_batch_ZH:
  HIGH: 87       # unchanged (+0)
  MEDIUM: 94     # 92 + 2 (DOC-GAP-301 + DOC-GAP-302) = 94
  LOW: 19        # 18 + 1 (DOC-GAP-300) = 19
  total: 200     # 197 + 3 = 200

ranking_after_batch_ZH:
  top_3_by_triangulation_count_x_severity_weight:
    - "DOC-GAP-082 (META — DISABLED-bypasses-RBAC — 29-sidecar at batch S; unchanged this batch)"
    - "DOC-GAP-302 NEW (META — WithPermissionsProvider naming-vs-behaviour META — 11+ route-mount sites across 3 pillars; surfaces cross-pillar reviewer-trap)"
    - "DOC-GAP-149 META (REV-3 LAYER-0 — P-09 pillar-claim vs doc-page coverage drift — 8-sub-mechanism at batch VAL-LSN-019-B; unchanged this batch)"
-->

# Batch ZH index reconciliation — 2026-05-26

This file is appended alongside the main `index.md` (per the catalog's batch-by-batch append convention used since batch X). The main `index.md` headline carries the batch-S/R counts (197); subsequent batches (T/U/V/X/VAL-LSN-019-B/Y/Z/ZA/ZB/ZC/ZD/ZE/ZF/ZG/ZH) added shards directly to `detail/` without updating the headline counts. This batch-ZH reconciliation file records the additions WITHOUT modifying the main index headline counts.

## Batch summary

**Trigger**: batch ZH (UI Routes 1) — 5 UI-route-module sidecars for the Management + Data Modelling + Master Data + Data Quality + Data Glossary surfaces. The sidecars are URL-shape primary sources for the operator-facing UX manifestation of the read-collaborative posture + the WithPermissionsProvider naming-vs-behaviour META + the bare-base URL convention pattern.

**Outcome**: **3 NEW findings (0 HIGH + 2 MEDIUM + 1 LOW)** + **5 STRENGTHENED existing entries**. Per LSN-018 stale-probe cadence: 0 direct live WebFetches this reducer session — all relevant `docs.opendatadiscovery.org` URLs inherited from the 5 sidecars' enrichments this session (each within the 11-day stale-probe window):

- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` (2026-05-26 status 200 — management-route sidecar)
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (2026-05-26 status 200 — management-route + dataModelling-route + terms-route + masterData-route sidecars)
- `https://docs.opendatadiscovery.org/features/data-glossary` (2026-05-26 status 200 — terms-route sidecar)
- `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (2026-05-26 status 200 — terms-route sidecar)
- `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` (2026-05-26 status 200 — masterData-route sidecar)
- `https://docs.opendatadiscovery.org/features/data-modelling` (2026-05-26 status 200 — dataModelling-route sidecar)
- `https://docs.opendatadiscovery.org/features/active-platform-features/data-modelling` (2026-05-26 status **404** — dataModelling-route sidecar; legacy URL — recorded as observation, not a new finding)
- `https://docs.opendatadiscovery.org/features/data-quality` + `https://docs.opendatadiscovery.org/features/data-quality/dashboard` (2026-05-25 status 200 — inherited from DOC-GAP-263 batch ZC + batch-T DataQualityController class-tier sidecar)
- `https://docs.opendatadiscovery.org/features/management` (2026-05-20 status 200 — inherited from DOC-GAP-186 batch Q)

## NEW (3) — DOC-GAP-300 .. DOC-GAP-302

### LOW severity

- **DOC-GAP-300** (LOW; drift): Visiting bare `/terms` renders a BLANK PAGE (no element, no redirect, no error fallback at the route-mount layer in `App.tsx:66-68`) — the Data Glossary live doc page frames the Dictionary tab as a "catalog-wide list of all terms" without naming the URL path, and the operator inferring "list of terms ⇒ /terms" lands on a dead-end. The fix is a one-line code edit OR a single doc paragraph. NEW URL-surface dead-end finding on the P-06 Data Glossary surface; sibling to DOC-GAP-301's `/master-data` dead-end (the same convention break).
  - **Full detail**: `detail/DOC-GAP-300.md`

### MEDIUM severity

- **DOC-GAP-301** (MEDIUM; drift): Master Data pillar live doc page `features/master-data-management/lookup-tables.md` claims `WithPermissionsProvider` gates the Lookup Tables PAGE on `LOOKUP_TABLE_CREATE/UPDATE/DELETE` — the wrapper actually renders unconditionally and the page is reachable to any authenticated user; SAME page lists 9 LOOKUP_TABLE_* permissions but route-mount enumerates only 3; AND visiting bare `/master-data` renders nothing. **Compound 3-vector P-03 URL-surface-vs-doc drift cluster.** Cross-link to DOC-GAP-263 (sibling read-collaborative posture silence on `/data-quality`).
  - **Full detail**: `detail/DOC-GAP-301.md`

- **DOC-GAP-302** (MEDIUM; drift + meta): **META — `WithPermissionsProvider` is a NAMING-VS-BEHAVIOUR DRIFT across 11+ route-mount sites in 3 pillars (Management + Data Modelling + Master Data + Lookup Tables).** The wrapper's name promises a permission GATE; the implementation seeds a permission CONTEXT but renders unconditionally. The SIBLING `WithPermissions` HOC (no `Provider` suffix) is the real gate. This is a SECURITY-AUDIT-TRAP class drift (reviewer reads App.tsx + ManagementRoutes.tsx, concludes routes are gated, is wrong) + DOC-PRODUCT-TRAP class drift (the live Permissions page is silent on the page-vs-button distinction). NEW cross-pillar META; 11+ route-mount sites surfaced. Cross-link to DOC-GAP-186 + DOC-GAP-187 + DOC-GAP-263 + DOC-GAP-301.
  - **Full detail**: `detail/DOC-GAP-302.md`

## STRENGTHENED (5)

- **DOC-GAP-186** (Management top-nav tab visibility — original framing: top-nav tab visibility CONTRADICTS the live `/features/management` doc) → batch ZH adds **UI-ROUTE-MODULE layer** primary source via the management-route sidecar; the catalog now has **5-LAYER coverage** at the Management surface (UI-shell + UI-component + UI-route + controller + service). NEW STRUCTURAL DIMENSION: the 9-sub-area route-mount enumeration is now explicit; the 7 per-sub-route WithPermissionsProvider sites + 1 RestrictedRoute site are anchored; the `/management/integrations/*` permission-wrapping ABSENCE is the per-sub-route asymmetry that strengthens the META coverage.
  - **Strengthen append**: `detail/DOC-GAP-186-batch-ZH-append.md`

- **DOC-GAP-205** (Dictionary tab UX structurally undocumented — original framing: TermSearch component primary source for the 5 undocumented UX traits at `/termsearch`) → batch ZH adds **UI-ROUTE-MODULE layer** primary source via the terms-route sidecar; the catalog now has **2-LAYER coverage** of the Dictionary surface (UI-component + UI-route). NEW STRUCTURAL DIMENSION: the two-base-path topology (`/terms` deep-link + `/termsearch` Dictionary tab) is anchored; the route-module's `docs_link_semantic.doc_drift_findings.[list-vs-search]` independently arrived at the SAME drift conclusion from the URL-shape angle.
  - **Strengthen append**: `detail/DOC-GAP-205-batch-ZH-append.md`

- **DOC-GAP-263** (`/data-quality` route has NO client-side permission gate AND every live Data Quality doc page is silent on access control) → batch ZH adds **UI-ROUTE-MODULE layer** primary source via the dataQuality-route sidecar; the catalog now has **3-LAYER coverage** at the Quality Dashboard surface (UI-component + UI-route + controller). NEW STRUCTURAL DIMENSION: the route function is verbatim a bare-string return (`dataQualityRoutes.ts:1-3`); the structural statelessness confirms the access-control silence is structural at the URL-string layer, not a runtime-decided posture.
  - **Strengthen append**: `detail/DOC-GAP-263-batch-ZH-append.md`

- **DOC-GAP-138** (DataEntityDetails NaN coercion — original framing: `useDataEntityRouteParams()` calls `parseInt(dataEntityId, 10)` with no `Number.isNaN` guard) → batch ZH establishes a **3-INSTANCE CROSS-ROUTE-MODULE CLUSTER**: DataEntityDetails + Terms (`useTermsRouteParams`) + Management (`useIntegrationRouteParams`). Same type-assertion-lie pattern at all 3 instances. The cluster framing strengthens the case for a META `useStrictParams` utility fix. NEW SUB-DRIFT — the terms hook is REUSED outside the matching route subtree (`TermSearch.tsx:26` from the `/termsearch` subtree) and "works" by accident; a future consumer mistakenly reading `termId` would silently get `NaN`.
  - **Strengthen append**: `detail/DOC-GAP-138-batch-ZH-append.md`

- **DOC-GAP-287** (Data Modelling relationships visibility silent on cross-owner posture) → batch ZH adds **UI-ROUTE-MODULE layer** primary source via the dataModelling-route sidecar; the catalog now has **3-LAYER coverage** of the P-02 Data Modelling read-collaborative posture cluster (controller + UI-route + doc-page WebFetch). NEW STRUCTURAL DIMENSION: the 4-vector P-02 read-collaborative cluster is now structurally complete (backend SQL + service + UI-route + doc-page — all 4 silent at the visibility-disclosure axis). The `every() AND-of-permissions` subtlety is a NEW SUB-DRIFT discovered via the dataModelling-route sidecar's analysis of `PermissionProvider.tsx:21-25`.
  - **Strengthen append**: `detail/DOC-GAP-287-batch-ZH-append.md`

## Notable patterns surfaced

- **The 5-pillar P-02/P-03/P-04/P-06/P-08 read-collaborative cluster is now triangulated at the UI-route layer.** Five batch-ZH route-module sidecars confirm the SAME structural posture: lists / details / forms are reachable to any authenticated user; only ACTIONS are gated. The doc-product disclosure is sporadic and never fully aligned with the implementation; THIS batch adds 3 new findings (DOC-GAP-300/301/302) and strengthens 5 existing findings, all on the same posture. The catalog's cross-pillar read-collaborative cluster is now structurally COMPLETE at the UI-route layer for these 5 pillars.

- **The bare-base URL convention pattern.** 5 of 6 multi-tab pillar bases redirect to a canonical first tab (Alerts → `/alerts/all`, Data Modelling → `/data-modelling/query-examples`, Management → `/management/namespaces` via `<Navigate replace>`, Search, Directory). The OUTLIERS are: `/terms` (DOC-GAP-300 NEW — renders blank) + `/master-data` (DOC-GAP-301 NEW — renders blank). Both surface in batch ZH. The fix is consistent: either redirect to the canonical first tab OR document the URL surface explicitly. The pattern would be checked once at App.tsx-mount-time review and would surface any future regression.

- **The WithPermissionsProvider META is the audit-trap class.** DOC-GAP-302 NEW META names the 11+ route-mount sites across 3 pillars. This is the first cross-pillar reviewer-trap META in the catalog and surfaces at a load-bearing layer (the platform's most-used React HOC for permission-aware mounting). The fix is doc-product-side (one META section in the Authorization page) + optional code-side (rename to `PermissionContextProvider` + introduce `PermissionGate`).

- **The route-params type-assertion-lie cluster (DOC-GAP-138 batch ZH strengthen).** The 3-instance cluster (DataEntityDetails + Terms + Management) confirms the pattern is platform convention; a META `useStrictParams` utility would close all 3 instances in one place. The cluster framing strengthens the case for the systemic fix vs the per-call-site patch.

- **The `/data-modelling` redirect convention IS present (DOC-GAP-287 batch ZH strengthen confirmation) — the OUTLIERS prove the rule.** Both `/terms` and `/master-data` deviate from the pattern that 5 of 6 pillar bases follow; this is a code-side convention break, not an intentional design choice (no comment / no annotation defends the difference in either route module).

## Frontmatter delta (after batch ZH)

- total_findings: 197 → **200**
- findings_by_severity: HIGH 87 + MEDIUM 92 + LOW 18 → HIGH 87 + **MEDIUM 94 + LOW 19** = **200**
- findings_by_category: broken-url 9 + drift 173 + missing-page 9 + coverage-gap 4 + meta 9 → broken-url 9 + **drift 176** + missing-page 9 + coverage-gap 4 + **meta 10** = **208** (drift+meta overlap: DOC-GAP-302 is drift AND meta, contributing +1 to BOTH)

## Re-rank top-20 by leverage (triangulation_count × severity_weight)

The top-3 from batch S unchanged: DOC-GAP-082 META (29-sidecar, HIGH-weighted) > DOC-GAP-149 META (REV-3 LAYER-0 — 8-sub-mechanism) > DOC-GAP-083 META (No-audit-log RBAC pattern — 3-sidecar). Batch ZH adds DOC-GAP-302 NEW META to the top tier (11+ route-mount sites + 3-pillar coverage + reviewer-trap class — MEDIUM-weighted but high triangulation). Final top-4 ranking after batch ZH: DOC-GAP-082 > DOC-GAP-149 > DOC-GAP-302 NEW > DOC-GAP-083. The catalog now carries **4 META findings** in the top-rank tier (DOC-GAP-082 / DOC-GAP-083 / DOC-GAP-149 / DOC-GAP-302 NEW).

(Remaining 16 entries in the top-20 unchanged from batch S — see `index.md` head for the full list.)

## Maintainer notes

- The 3 NEW findings + 5 STRENGTHENED entries are all WITHIN the UI-route layer of the substrate; the underlying read-collaborative posture is structurally consistent with the controller / service / repository layers documented in prior batches. No CONTRADICTS surfaced; the cross-registry coherence sweep (Rule 6) confirmed same-polarity at all 4 cross-registry hits.
- The doc-product fix is bounded: ONE META section on the Authorization page (DOC-GAP-302 proposed action 1) + 4-5 per-page cross-links (DOC-GAP-302 proposed action 2) + 2-3 small per-page disclosures (DOC-GAP-301 + DOC-GAP-300 + DOC-GAP-263 — already proposed). The combined fix closes the operator-facing access-control-disclosure gap for the entire 5-pillar read-collaborative cluster.
- Optional code-side fixes are 2 small edits (the `/master-data` + `/terms` redirects to close the dead-ends, consistent with the 5-of-6 pillar convention) + 1 rename (WithPermissionsProvider → PermissionContextProvider, advisory) + 1 NEW HOC (`<PermissionGate>` for genuine route-level gating, advisory). None are required for the doc-product fix to land.
