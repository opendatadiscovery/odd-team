## ADR-CANDIDATE-002 — STRENGTHENED BATCH V — Centralized `SecurityConstants.SECURITY_RULES` path-matcher pattern reaches 23-sidecar support; NEW sub-patterns (NO_CONTEXT vs context-scoped resolver split) AND new wiring-bug evidence

**Severity unchanged**: HIGH
**Updated support count**: now **23-sidecar** (was 18 after batch F; batch V adds 5 new class-level sidecars)
**Batch**: V (2026-05-20)

**New surfaced_by** (5 — all `controller-class` axis):
- `QueryExampleController__controller-class__QueryExampleController.md:implicit_adrs.[1]` (HIGH) — "**Read-collaborative posture is the default; mutation is gated** — 3 of 13 endpoints have SecurityRules; the other 10 (all reads + search) fall through to `authenticated()`." — evidence: SecurityConstants.java:112-113 (POST /api/queryexample → QUERY_EXAMPLE_CREATE), 312-317 (PUT /api/queryexample/{id} → QUERY_EXAMPLE_UPDATE; DELETE → QUERY_EXAMPLE_DELETE) + AuthorizationCustomizer catch-all + the 10 ungated endpoints' lack of programmatic checks
- `ReferenceDataController__controller-class__ReferenceDataController.md:implicit_adrs.[1]` (HIGH) — "RBAC gating lives at the route matcher (SecurityConstants), not at the controller method — a generated `*Api` interface implementation that holds no annotations is the design." — evidence: SecurityConstants.java:47-55 (9 permission imports), 114-115 (POST `/api/referencedata/table` → LOOKUP_TABLE_CREATE), 325-354 (8 further mutating-endpoint matchers) — intent_anchor: 9 LOOKUP_TABLE_* permissions wired uniformly with NO_CONTEXT resolver
- `OwnerAssociationRequestController__controller-class__OwnerAssociationRequestController.md:implicit_adrs.[5]` (HIGH) — "Authorization wiring is centralised in SecurityConstants.SECURITY_RULES, NOT in @PreAuthorize annotations on the controller — this mirrors the project-wide pattern" — evidence: OwnerAssociationRequestController.java:1-86 (zero @PreAuthorize / zero @Secured / zero @PostAuthorize annotations across the whole file) + SecurityConstants.java:148-162 (the canonical wiring for THIS controller's 5 protected paths)
- `DataEntityAttachmentController__controller-class__DataEntityAttachmentController.md:implicit_adrs.[0]` (HIGH) — "Authorization for attachment writes is enforced declaratively at the WebFilter layer via path-pattern matchers, not by controller-level @PreAuthorize annotations or programmatic checks in `AttachmentService`." — evidence: SecurityConstants.java:247-276 (six `SecurityRule` entries for `/api/dataentities/{data_entity_id}/files/**` POST/PUT, `/files/{file_id}` DELETE, `/links` POST, `/links/{link_id}` PUT/DELETE, all gated by `DATA_ENTITY_ATTACHMENT_MANAGE`) + DataEntityAttachmentController.java:1-116 (zero authorization annotations)
- `DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[1]` (HIGH) — "**Authorization is parent-scoped — every DATASET_FIELD permission resolves to the parent DataEntity's permission via `DatasetFieldResourceExtractor`; there is NO field-level permission check.**" — evidence: DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303 — intent_anchor: 6 DATASET_FIELD-scope rules all resolved via parent-DataEntity

**Cross-batch insight**: The 23-sidecar pattern now anchors three distinct sub-patterns of resolver wiring:

1. **NO_CONTEXT sub-pattern** (platform-wide permission, no per-resource scoping):
   - LOOKUP_TABLE family (9 rules at SecurityConstants.java:114-115, 325-354) — NEW in batch V
   - QUERY_EXAMPLE_CREATE (line 112-113) — partially NEW in batch V (the UPDATE + DELETE are context-scoped)
   - Role / Policy / Owner directory CRUD (batches E + earlier)
   - Collector token regenerate (batch 2026-05-10A)

2. **CONTEXT-SCOPED sub-pattern** (per-resource permission, resolved via ResourceExtractor):
   - DATA_ENTITY family (createOwnership, updateStatus — batch F)
   - DATA_ENTITY_ATTACHMENT_MANAGE family (6 rules at SecurityConstants.java:247-276 — NEW in batch V)
   - DATASET_FIELD family (6 rules at SecurityConstants.java:282-303 — NEW in batch V; resolved via `DatasetFieldResourceExtractor` to parent DataEntity)
   - QUERY_EXAMPLE_UPDATE / _DELETE (lines 312-317 — NEW in batch V; resolved via QueryExamplePermissionExtractor)
   - OWNER_ASSOCIATION_MANAGE / OWNER_RELATION_MANAGE (NEW in batch V; resolved via OwnerAssociationRequest-side context)
   - TERM family (existing — used by ADR-CANDIDATE-003)

3. **DELIBERATE-ABSENCE sub-pattern** (no SecurityRule entry, fall-through to `.authenticated()`):
   - All GET endpoints (10 of 13 in QueryExampleController, 5 of 14 in ReferenceDataController, 3 of 7 in OwnerAssociationRequestController, 3 of 10 in DataEntityAttachmentController, 2 of 7 in DatasetFieldController) — read-collaborative posture per ADR-CANDIDATE-003
   - POST /api/owner_association_request — NEW in batch V; this is the FIRST positive-intent absence for a mutating endpoint (the SELF-request entry MUST be reachable by users holding ZERO permissions to enable their own onboarding; documented in ADR-CANDIDATE-167)
   - GET /api/owners/providers — NEW in batch V; positive-intent absence (auth-mode discovery is intentionally readable by any user who can submit a request)

**NEW pattern-fragility evidence in batch V** (the central-table-as-fragile case):

DatasetFieldController surfaced TWO WIRING BUGS at SecurityConstants.java that the pattern's centralization was supposed to prevent:

- **SecurityConstants.java:295-296** — PUT `/api/alerts/{alert_id}/status` is wired to `DATASET_FIELD_ADD_TERM` (a clear copy-paste bug from the dataset-field block immediately preceding it). An alert-status update endpoint is gated by a dataset-field-scope term permission with no involvement of any dataset_field at the request path. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; any user holding an actual ALERT permission but NOT `DATASET_FIELD_ADD_TERM` CANNOT.

- **SecurityConstants.java:297-299** — POST `/api/datasetfields/{id}/terms` is wired to `DATA_ENTITY_ADD_TERM` (the DataEntity-scope permission) instead of `DATASET_FIELD_ADD_TERM` (the field-scope permission declared at `PolicyPermissionDto.java:34`). Live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-20, status 200) document `DATASET_FIELD_ADD_TERM` as the gate for this endpoint — operators following the docs configure permissions that do not match runtime behaviour.

Both bugs are HIGH-severity refactoring scopes (REFACTOR-482 NEW batch V). They strengthen the case for the boot-time SECURITY_RULES validator (cross-link to REFACTOR-073 — now **12-sidecar triangulated** with batch V). The two bugs demonstrate the central-table-as-fragile pattern that ADR-CANDIDATE-002 explicitly identifies as a trade-off ("path-string coupling fragility" + "silent drift when a controller's URL pattern changes but its SECURITY_RULES row does not").

**Updated full triangulation enumeration** (now 23 — 18 prior + 5 new):

Prior 18 (across batches 2026-05-08 base through 2026-05-12F):
- AlertController (class + method sidecars), DataEntityAttachmentController (method), DataEntityController (class + 5 methods), DirectoryController, GenAIController, CollectorController.regenerateCollectorToken, AlertController.changeAlertStatus, AlertController.getAllAlerts, DataEntityAttachmentController.uploadFileChunk, SearchController.search, OwnerController.createOwner, PolicyController.createPolicy, RoleController.createRole, PermissionController.getResourcePermissions, three batch-F write paths (createOwnership, updateStatus, postDataEntityList)

NEW batch V (5 class-level):
- QueryExampleController (class)
- ReferenceDataController (class)
- OwnerAssociationRequestController (class)
- DataEntityAttachmentController (class)
- DatasetFieldController (class)

**Severity unchanged at HIGH**. The 23-sidecar pattern remains the strongest support of any ADR in the catalog; the two new wiring bugs at SecurityConstants.java:295-299 are the price of the centralized design and feed into REFACTOR-073's case for a boot-time validator.

---
