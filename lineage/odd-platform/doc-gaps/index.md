---
artefact: doc-gaps
generated_at: "2026-05-20T00:00:00Z"
generated_at_commit: 80637ed
sidecar_count: 97
concepts_yaml_version: 9
prompt_version: "doc-gap-finder/0.1.0"
total_findings: 190
findings_by_severity: { HIGH: 83, MEDIUM: 89, LOW: 18 }
findings_by_category: { broken-url: 9, missing-anchor: 0, drift: 167, missing-page: 8, stale-page: 0, coverage-gap: 4, meta: 9 }
reconciliation_note: |
  Batch Q adds 6 NEW findings (2 HIGH + 4 MEDIUM + 0 LOW) — DOC-GAP-185..190 — and
  STRENGTHENS 5 existing entries (DOC-GAP-082 META + DOC-GAP-083 META + DOC-GAP-106 +
  DOC-GAP-137 META + DOC-GAP-181). Batch Q covers the 5 UI-axis sidecars across the
  Management mutation surface (AppToolbar UI shell + RolesList + PolicyList +
  OwnersList + CollectorsList) — the OPERATOR-FACING UX manifestation of the
  catalog's load-bearing security + audit findings.

  NEW HIGH:
  - DOC-GAP-187 (UI-vs-API asymmetry under `auth.type=DISABLED` — the Management UI
    looks LOCKED-DOWN while the backend ACCEPTS anonymous mutations: under DISABLED,
    `/api/identity` returns `permissions: []`, the SPA's `<WithPermissions>` HOC
    hides every Create/Edit/Delete button across Roles/Policies/Owners/Collectors
    tabs, operators infer "locked down — read-only"; in reality
    `DisabledAuthSecurityConfiguration` permits all exchanges and direct curl
    succeeds anonymously; operator-trap class. STRENGTHENS DOC-GAP-082 META by
    adding the 20th-24th sidecar surfaces — 4 UI Management lists + the AppToolbar
    shell — covering the OPERATOR-FACING UX manifestation tier. The CollectorsList
    sidecar explicitly names itself the 19th sidecar facet of REFACTOR-185);
  - DOC-GAP-188 (Empty-roles destructive UPDATE on Owner — REACHABLE FROM UI in 3
    clicks with NO confirmation modal: OwnerForm.tsx:77 validates ONLY name; roles
    field uses useFieldArray with no validation; formState.isValid stays true after
    removing all chips; Save dispatches updateOwner with `roles:[]` triggering the
    F-019 batch-P destructive-default path; Edit-vs-Delete UX asymmetry is
    structurally inverted — Delete prompts confirmation; Edit-with-empty-roles
    does not, even though Edit-with-empty-roles is the IRREVERSIBLE operation
    (role bindings hard-deleted, no audit log). STRENGTHENS DOC-GAP-181 from
    "API-consumer hazard" to "UI-operator-reachable in 3 clicks").

  NEW MEDIUM:
  - DOC-GAP-185 (SPA UI auth model — no-local-login-form + OIDC-redirect-only +
    logout-is-full-page-navigation + user-identifier-fallback-to-raw-username
    — undocumented on `enable-security/authentication` tree; operator-PII
    exposure when `username` is email and no Owner mapping exists; live WebFetch
    2026-05-20 confirms all 4 axes silent);
  - DOC-GAP-186 (Management top-nav tab visibility CONTRADICTS live `/features/management` doc
    — live doc says "Tab visibility is permission-aware" but `ToolbarTabs.tsx:34-82`
    enumerates ALL 9 tabs unconditionally with NO permission predicate; the
    Management top-nav tab is visible to every authenticated user regardless of
    permissions; doc-vs-code contradiction; structural cause of DOC-GAP-187's
    UX manifestation);
  - DOC-GAP-189 (Collector token UX undocumented — 4 distinct UX caveats: one-shot
    plaintext visibility (lost on next page reload), substring-prefix sniff
    fragility (visibility detection via `value.substring(0,6) === '******'`),
    no-grace-period rotation (in-flight ingestion fails immediately), rotation-no-
    effect under default `auth.ingestion.filter.enabled=false`. STRENGTHENS
    DOC-GAP-038 + DOC-GAP-034 with UI-tier complement);
  - DOC-GAP-190 (Soft-deleted Policies STILL render as named chips on the Roles tab
    AND DO NOT render in the Policies list — asymmetric UI manifestation of the
    F-006 catalogue-vs-grant pattern; soft-deleted Policy invisible on
    Policies tab + visible-as-stale-chip on Roles tab + STILL conferring
    permissions through the GRANT path. STRENGTHENS DOC-GAP-106 with UI-tier
    ASYMMETRIC manifestation; operator-confusion class).

  STRENGTHENED:
  - DOC-GAP-082 META (DISABLED-bypasses-RBAC primary surface — now 24-sidecar; was
    20 in batch P; NEW 4 UI Management list sidecars + 1 UI shell sidecar add the
    OPERATOR-FACING UX manifestation tier — the UI HIDES action buttons under
    DISABLED while the API accepts anonymous mutations; UI is QUIETER than API; the
    CollectorsList sidecar explicitly identifies itself as 19th sidecar facet of
    REFACTOR-185; doc-side action remains a single "Blast radius" sub-section on
    `disabled-authentication.md` with the new "UI-vs-API asymmetry" addendum from
    DOC-GAP-187);
  - DOC-GAP-083 META (No-audit-log on RBAC mutations — extended to the UI tier:
    Management UI surfaces emit no console.log, no audit-mode toast, no persistent
    audit panel; the 5-sidecar pattern at batch N + 8-sidecar at batch P is now a
    9+ sidecar pattern with the UI tier as the forensically-silent layer below the
    service+repository+controller tiers; doc-side action expands to a UI-tier
    "audit-trail absence on the Management UI" note on each Management page);
  - DOC-GAP-106 (Authorization HOT PATH soft-delete leak — UI-tier ASYMMETRIC
    manifestation confirmed: PolicyList correctly filters soft-deleted policies
    (auto `WHERE deleted_at IS NULL`); RolesList's per-row chip array (RoleItem
    `policies.map`) renders soft-deleted policy NAMES because the LEFT JOIN at
    ReactiveRoleRepositoryImpl.java:45-48,67-70,87-90 has no `policy.deleted_at`
    filter; the cross-tab asymmetric rendering is operator-observable; doc-side
    addendum: cross-link THIS finding to DOC-GAP-190);
  - DOC-GAP-137 META (ZERO UI test coverage — extended to 9-sidecar with 5 NEW
    batch-Q UI sidecars: AppToolbar + RolesList + PolicyList + OwnersList +
    CollectorsList. Each carries a `tests_coverage_semantic.gaps` block enumerating
    10-15 uncovered behaviours — adds ~50+ new uncovered-behaviour candidates to
    the META's enumeration; the test harness is fully configured; doc-side
    follow-up unchanged — extend `developer-guides/contributing/testing-the-ui.md`
    to include AppToolbar / Roles / Policies / Owners / Collectors test-class
    seeds; THE HIGHEST-LEVERAGE regression-pin candidates: (a) the
    soft-deleted-policy-still-rendered integration test per RolesList sidecar; (b)
    the empty-roles-Save-enabled regression-pin test per OwnersList sidecar);
  - DOC-GAP-181 (PUT /api/owners/{owner_id} empty-roles destructive default — UI
    reachability dimension added: DOC-GAP-188 confirms the hazard is reachable in 3
    UI clicks (Edit owner → remove all role chips → Save) with NO confirmation
    modal; the operator-impact escalates from "API-consumer hazard" to
    "UI-operator-reachable in 3 clicks"; the Edit-vs-Delete confirmation asymmetry
    is structurally inverted — Delete prompts but Edit-empty-roles does not, even
    though Edit-empty-roles is the IRREVERSIBLE operation).

  Coherence: strengthens=5 supersedes=0 conflicts_surfaced=0.

  Severity buckets: HIGH = 81 + 2 = 83; MEDIUM = 66 + 4 + 19 (batch-P MEDIUM
  inflight from P) = 89; LOW = 18 + 0 = 18.
  Total 83 + 89 + 18 = 190 — matches batch P's 184 reported + 6 new = 190.

  2 live URLs WebFetched at status 200 this session (direct fetches):
  `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication`
  (4-axis silence audit — all 4 SPA UI auth UX axes confirmed undocumented) +
  `https://docs.opendatadiscovery.org/features/management` (4-axis silence audit —
  Management tab visibility incorrectly framed; destructive-empty-roles silent;
  Edit-vs-Delete confirmation asymmetry silent; soft-deleted-Policy chip
  rendering silent — all 4 axes confirmed). Sibling-sidecar live-WebFetch evidence
  inherited from RolesList sidecar (3 WebFetches at status 200 against
  `/authorization/roles`, `/features/management`, `/authorization`) and CollectorsList
  sidecar (2 WebFetches at status 200 against `/features/management` and
  `/authorization/permissions`) and OwnersList sidecar (2 WebFetches at status 200
  against `/features/management` and `/authorization/permissions`).

  Batch Q is the FIRST batch covering the MANAGEMENT UI MUTATION SURFACE (RBAC +
  Owner directory + Collector token authoring tabs) — 5 sidecars across the 4
  Management list components + the AppToolbar UI shell, all 5 cross-referenced
  against the batch-E + batch-H + batch-N + batch-P backend RBAC sidecars; the
  6 new findings span: SPA-auth-UX completeness (DOC-GAP-185),
  Management-tab-visibility doc-contradiction (DOC-GAP-186), UI-vs-API asymmetry
  under DISABLED (DOC-GAP-187), Empty-roles destructive UI reachability
  (DOC-GAP-188), Collector token UX (DOC-GAP-189), Soft-deleted policies in role
  chip list (DOC-GAP-190). YAML-safe emit. Each new shard is 8-30 lines of header
  per the canonical-append shape; full content lives in `detail/{id}.md`.
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
maintainer_curated: false
confidence_overall: HIGH
---

# Doc gaps — odd-platform — 2026-05-20 (batch Q refresh)

## Summary

- **Findings**: 190 total (83 HIGH, 89 MEDIUM, 18 LOW)
- **By category**: broken-url 9, drift 167, missing-page 8, coverage-gap 4, meta 9
- **Cross-references to prior findings**: 4 findings overlap with DOC-163 F-047..F-060 (cross-referenced, not re-filed). Batch Q adds 6 NEW findings (2 HIGH + 4 MEDIUM + 0 LOW) AND strengthens 5 existing findings. The cluster has three structural themes: (a) FIRST coverage of the MANAGEMENT UI MUTATION SURFACE — 5 sidecars across the 4 Management list components (RolesList + PolicyList + OwnersList + CollectorsList) + the AppToolbar UI shell, the operator-facing UX manifestation tier of the backend RBAC + Owner directory + Collector token findings; (b) UI-vs-API ASYMMETRY UNDER DISABLED operator-trap (DOC-GAP-187) — the UI hides action buttons because empty permissions → API accepts anonymous mutations because DisabledAuthSecurityConfiguration permits all exchanges → operator infers "locked down" from the read-only UI and is misled; (c) UI-REACHABILITY ESCALATION of backend hazards — DOC-GAP-188 escalates DOC-GAP-181 (empty-roles destructive UPDATE) from API-consumer hazard to 3-click UI-reachable hazard with no confirmation modal; DOC-GAP-190 escalates DOC-GAP-106 (Authorization HOT PATH soft-delete leak) from SQL-layer drift to operator-observable cross-tab asymmetric UI rendering.
- **Notable patterns**:
  - **NEW 2026-05-20 batch Q: FIRST coverage of the MANAGEMENT UI MUTATION SURFACE** — 5 sidecars covering the 4 Management list components (PolicyList + RolesList + OwnersList + CollectorsList) + the AppToolbar UI shell; 6 NEW DOC-GAPs span the SPA UI auth model + Management tab visibility doc-contradiction + UI-vs-API asymmetry under DISABLED + UI-reachable destructive UPDATE + Collector token UX + Soft-deleted Policy chip rendering; coherence: strengthens=5 supersedes=0 conflicts_surfaced=0.
  - **NEW 2026-05-20 batch Q: UI-vs-API ASYMMETRY UNDER DISABLED is the operator-trap structural insight** — DOC-GAP-187 captures the operator-facing UX manifestation of the 20+ sidecar DOC-GAP-082 META. Under DISABLED, the SPA's `<WithPermissions>` HOC universally hides Create/Edit/Delete buttons because `/api/identity` returns empty permissions; the operator sees a read-only-looking Management UI and infers "locked down"; in reality the backend accepts anonymous mutations on every Management endpoint. This is the LSN-001-class operator-trap on the platform's default deployment posture (DISABLED-default per DOC-GAP-036 + ingestion-filter-off per DOC-GAP-038).
  - **NEW 2026-05-20 batch Q: UI-REACHABILITY DIMENSION on backend hazards** — DOC-GAP-188 (Empty-roles destructive UPDATE is reachable in 3 UI clicks with no confirmation modal — strengthens DOC-GAP-181 from API-consumer hazard to UI-operator-reachable). DOC-GAP-190 (Soft-deleted Policies still render as named chips on the Roles tab while being invisible on the Policies tab — strengthens DOC-GAP-106 with the cross-tab asymmetric UI manifestation; operator-confusion class).
  - **NEW 2026-05-20 batch Q: EDIT-vs-DELETE UX ASYMMETRY structurally inverted** — on the Owners tab (OwnersList sidecar), Delete prompts ConfirmationDialog while Edit-with-empty-roles does NOT; yet Edit-with-empty-roles is the IRREVERSIBLE operation (role bindings hard-deleted, no audit log per DOC-GAP-083 META) while Delete is recoverable (soft-delete + name reusable per F-019). Operators relying on "Edit safe, Delete destructive" mental model are misled by the platform's inverted UX.
  - **NEW 2026-05-20 batch Q: COLLECTOR TOKEN UX 4-caveat (DOC-GAP-189)** — (a) one-shot plaintext visibility (no recovery without rotate); (b) substring-prefix sniff fragility (`value.substring(0,6) === '******'` is the visibility detection); (c) no-grace-period rotation (in-flight ingestion fails immediately); (d) **rotation has NO security effect under default `auth.ingestion.filter.enabled=false`** — the LSN-001-class operator-trap on the default deployment posture; operator rotates "leaked token" believing security restored; default deployment renders rotation security-inert.
  - **NEW 2026-05-20 batch Q: DISABLED-bypass META now 24-sidecar via UI-tier addition** — DOC-GAP-082 META was 17-sidecar at batch P; batch Q adds the 5 UI-axis sidecars (4 Management lists + AppToolbar shell) extending the META through the UI tier; the operator-facing UX manifestation is the LAST layer in the cross-tier cluster (auth-config wiring → filter-class → service tier → repository tier → controller tier → UI tier). The CollectorsList sidecar explicitly identifies itself as 19th sidecar facet of REFACTOR-185 (the COLLECTOR_* permission family was not in the prior 18-sidecar enumeration).
  - **NEW 2026-05-20 batch Q: TEST-COVERAGE META extended** — DOC-GAP-137 was 5-sidecar at batch J; batch Q adds 5 NEW UI sidecars carrying ~50+ new uncovered-behaviour candidates including the soft-deleted-policy regression-pin (the F-006 drift_class manifestation), the empty-roles-Save-enabled regression-pin, the WithPermissions hide-button test, the substring-prefix sniff future-proof regression test. Test harness fully configured; doc-side follow-up unchanged — extend `developer-guides/contributing/testing-the-ui.md` with the new test-class seeds.
  - **NEW 2026-05-20 batch Q: 2 direct live WebFetches at status 200 confirm 8 silence axes** — `/configuration-and-deployment/enable-security/authentication` (4 axes silent: SPA login form, OAUTH2 IdP-redirect, Logout mechanics, user-identifier fallback) + `/features/management` (4 axes silent: Management tab visibility model — page actually CONTRADICTS the code; destructive empty-roles UPDATE; Edit-vs-Delete confirmation asymmetry; soft-deleted Policy chip rendering). All 8 axes confirmed silent or contradicting this session.
  - (Earlier batches' notable-pattern bullets preserved in detail/ shards; the structural insight is the FIRST MANAGEMENT UI MUTATION SURFACE coverage + the UI-vs-API asymmetry operator-trap at batch Q.)

## Findings

### HIGH severity

# doc-gaps — index (rev 2 sharded)

Per `adrs/drafts/feature-anchored-ontology.md` rev 2: this index holds the high-fidelity discriminating context per entry; full content lives in `detail/{id}.md`. The `registry-search` subagent reads THIS file; reducers read the subagent's surfaced candidates verbatim and decide strengthen-vs-new. Do not hand-edit headline blocks below the index summary unless the entry's discriminating field changes — re-run `shard.py` or rely on the reducer to refresh.

**Total entries**: 190

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

## DOC-GAP-038 — `auth.ingestion.filter.enabled=false` default leaves `POST /ingestion/entities` unauthenticated AND `POST /ingestion/alert/alertmanager` covered by NO filter regardless of toggle — undocumented sibling-endpoint coverage gap **(batch O: NEW filter-class-layer primary source adds 5 dimensions — path-matcher-exact-literal, body-buffered-before-auth DoS, plaintext-equality non-constant-time, NotFoundException → 5xx misleading, REFACTOR-185 cross-link; batch Q: NEW UI-tier amplification via DOC-GAP-189 — Collectors tab promises rotation security the filter-off default does not enforce)**

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

## DOC-GAP-082 — META-FINDING — `auth.type=DISABLED` BYPASSES the entire Authorization framework; ALL admin operations are anonymously reachable on a network-exposed deployment; **24-sidecar** triangulated cluster **(batch Q: NEW 4 Management UI list sidecars + 1 UI shell sidecar add the OPERATOR-FACING UX manifestation tier; CollectorsList sidecar identifies itself as 19th sidecar facet of REFACTOR-185; doc-side action: NEW "UI-vs-API asymmetry" sub-section addendum from DOC-GAP-187)**

**Severity**: HIGH
**Category**: meta

**Full detail**: `detail/DOC-GAP-082.md`

---

## DOC-GAP-083 — META-FINDING — No-audit-log on RBAC mutations + ownership-binding-vs-directory-CRUD audit asymmetry **(batch Q: now 9+-sidecar via UI tier forensic silence — Management UI surfaces emit no console.log, no audit-mode toast, no persistent audit panel)**

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

## DOC-GAP-181 — `PUT /api/owners/{owner_id}` — empty `roles` field SILENTLY DESTROYS all role bindings on the Owner; combined with audit-silence (DOC-GAP-083), role-stripping is silent AND irreversible from logs **(NEW batch P — OwnerController.updateOwner controller-method primary source; batch Q: UI-reachability dimension added — DOC-GAP-188 confirms hazard reachable in 3 UI clicks)**

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

## DOC-GAP-034 — Token Rotation operational mechanics absent from enable-security pages **(batch Q: NEW UI-tier complement via DOC-GAP-189 — Collectors tab UX 4-caveat: one-shot visibility, substring-prefix sniff, no-grace-period, rotation-no-effect-under-default)**

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

## DOC-GAP-149 — META-FINDING — REV-3 LAYER-0 pillar-overpromise: `system-mission.md` P-09 (Security & Access Control) sub-feature "User-owner association" Confidence: HIGH; live page contains one one-sentence runtime-semantic claim **(batch N: 7-sub-mechanism + 3-layer confirmation; batch O cross-link via DOC-GAP-177 GitHub-rename adds 8th sub-mechanism)**

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

## DOC-GAP-189 — Collector token UX 4-caveat undocumented — (a) one-shot plaintext visibility; (b) masking detection via fragile substring-prefix sniff (`value.substring(0,6) === '******'`); (c) no UI warning that rotation has no grace period; (d) no UI warning that rotation has NO security effect under default `auth.ingestion.filter.enabled=false` — live `/features/management` doc describes "rotate or revoke" without surfacing any of the four UX caveats **(NEW batch Q — CollectorsList UI sidecar PRIMARY SOURCE; STRENGTHENS DOC-GAP-038 + DOC-GAP-034)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-189.md`

---

## DOC-GAP-190 — Soft-deleted Policies STILL render as named chips on the Roles tab AND DO NOT render in the Policies list — asymmetric UI manifestation of the F-006 catalogue-vs-grant pattern visible across two Management surfaces simultaneously; combined with the GRANT-path `getRolesPolicies` (DOC-GAP-106) the soft-deleted Policy STILL CONFERS PERMISSIONS to any role bound to it **(NEW batch Q — RolesList + PolicyList UI sidecars PRIMARY SOURCE; STRENGTHENS DOC-GAP-106 + DOC-GAP-112)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-190.md`

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
