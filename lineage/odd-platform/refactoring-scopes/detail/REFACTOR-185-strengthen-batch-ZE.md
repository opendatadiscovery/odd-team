## STRENGTHENS — Batch ZE (Discovery + Search + Links + Feature + Relationship + Title — 5 NEW READ-surface confirmations; the read-surface bookend extends with the PROVIDER-NULL-BLEED-LIMITED-RISK FACET)

**Five new class-level sidecars extend REFACTOR-185's DISABLED-mode bypass coverage to the catalog-discovery read-surface layer.** Where prior batches enumerated 18 sidecars across write paths + identity + ingestion + Owner-mutation surfaces, batch ZE adds 5 NEW READ-surfaces: SearchController (7 endpoints), TitleController (1 endpoint), FeatureController (1 endpoint), RelationshipController (3 endpoints), LinksController (1 endpoint). Total: **13 NEW endpoints anonymously reachable under DISABLED-mode default deployment**, all on the read-surface side.

**New surfaced_by entries**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "**`auth.type=DISABLED` makes the entire search surface anonymously reachable.** All seven endpoints fall through to `pathMatchers('/**').authenticated()` which is bypassed under `DisabledAuthSecurityConfiguration`. Combined with bearer-token-shaped sessions + cross-owner posture, the DISABLED mode lets any network-reachable client enumerate the entire catalog. DISABLED is dev-only per docs, but operators who misuse it expose the whole catalog discovery surface."
- `odd-platform__java__TitleController__controller-class__TitleController.md:concepts.invariants.[3]` — "in `auth.type=DISABLED` it is unauthenticated (`DisabledAuthSecurityConfiguration:16` permitAll)"
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:bugs_limitations_corner_cases.[0]` (LOW per FeatureController sidecar — elevated framing here to MEDIUM as the FEATURE-FLAG-FINGERPRINT FACET; reduces vs IdentityController principal-impersonation) — "Under `auth.type=DISABLED` (the bundled default per application.yml:34), `GET /api/features/active` is anonymously reachable... The PROVIDER-NULL-BLEED facet of REFACTOR-185; severity is reduced vs IdentityController and IntegrationController because the information is operator-policy-configurable booleans (not principal-impersonation, not internal-hostname leak), but the inconsistency across auth modes is real."
- `odd-platform__java__RelationshipController__controller-class__RelationshipController.md:concepts.invariants.[2]` — "Under `auth.type=DISABLED` every endpoint is reachable unauthenticated"
- `odd-platform__java__LinksController__controller-class__LinksController.md:security.known_security_gaps.[3]` — "Under DISABLED mode the endpoint is public — an unauthenticated probe to /api/links discloses operator-internal URLs to the public internet if the deployment is internet-facing"

**Cross-batch refinement** (batch ZE adds the PROVIDER-NULL-BLEED-LIMITED-RISK FACET enumeration):

The original REFACTOR-185 framing extended progressively:
- Batches B-O (16 sidecars): destructive-write surface (RBAC mutations + DataEntity writes + Ingestion writes + Owner mutations) + identity-layer bleed (IdentityController as admin under DISABLED)
- Batch P (18 sidecars): Owner CRUD complete (create + update + delete all anonymously reachable)
- Batch Z (17 + 18 sidecars; AUTH-MODE-ORTHOGONAL): sibling /ingestion/** endpoints + GET DEG-members read-side surface

**Batch ZE introduces the FEATURE-FLAG-FINGERPRINT + DIRECTORY-ENUMERATION FACETS — a new sub-class of DISABLED-mode exposures**:

| Sidecar | DISABLED-mode exposure class | Severity (per sidecar) | Information disclosed |
|---|---|---|---|
| SearchController | Catalog enumeration + bearer-token attack vector | MEDIUM | Full catalog cross-owner: data entities + their owners + tags + custom metadata + lineage relations |
| TitleController | Directory enumeration | LOW | Title vocabulary (role labels — typically tens of rows) |
| FeatureController | Feature-flag fingerprint (PROVIDER-NULL-BLEED-LIMITED-RISK) | LOW | Which optional platform features are activated (DataCollaboration / ALERT_NOTIFICATIONS) |
| RelationshipController | Catalog graph topology | HIGH (compound with REFACTOR-626) | Every relationship in the catalog including source/target entity names, types, descriptions |
| LinksController | Operator-internal URL disclosure | LOW | URLs the operator configured for internal wikis / runbooks / dashboards (REFACTOR-616 sibling pattern) |

**The architectural picture extended**:

The REFACTOR-185 cluster now spans EVERY major surface area of the platform under DISABLED-mode default:
1. **Destructive write surfaces** (the original framing) — POLICY / ROLE / OWNER CRUD; DataEntity ownership / status mutations; Ingestion writes
2. **Read-side discovery surfaces** — getDataEntityDetails; getDataEntityDownstreamLineage; getActivity; getAllAlerts; getResourcePermissions; **NEW ZE: getSearchResults; getTitleList; getActiveFeatures; getRelationships; getLinks**
3. **Identity bleed** — IdentityController.whoami returns synthetic admin under DISABLED (per ADR-CANDIDATE-210)
4. **Configuration disclosure** — IntegrationController wizard + platform_url leak; **NEW ZE: FeatureController feature-flag fingerprint; LinksController internal URL leak**
5. **/ingestion/** orthogonal surface** — postDataSetStatsList, ingestMetrics, getDataEntitiesByDEGOddrn

**Updated triangulation count**: REFACTOR-185 now triangulates across **23 sidecars** (was 18 after batch Z) — adding 5 new class-level read-surface confirmations from batch ZE. The strongest single finding in the catalog continues to grow.

**The architectural pattern under DISABLED is now complete across pillars**:
- **P-01 Data Discovery** (Search) ✓ NEW ZE
- **P-02 Data Modelling** (Relationships + Lineage) ✓ NEW ZE
- **P-03 Data Quality** — prior batches
- **P-04 Data Catalog** (DataEntity reads) — batch F
- **P-05 Ownership** (Owner CRUD + Title directory) ✓ NEW ZE (Title)
- **P-06 Configuration & Deployment** (FeatureController + LinksController + AppInfo + Integration) ✓ NEW ZE (Feature + Links)
- **P-07 Alerting** — batch A
- **P-08 Activity** — prior batches
- **P-09 Security & Access Control** (RBAC mutations + Identity + Permission reads) — batch ZD
- **P-10 Ingestion** — batches Z

**Severity unchanged at HIGH** — the deployment-default risk continues. The maintainer's prescription (boot-time security-posture validator per REFACTOR-073 — emitting a fail-loud WARN on `auth.type=DISABLED` when production-profile is active OR the platform is bound to a non-loopback interface) remains the highest-leverage cross-cutting fix. The validator should compound-check `auth.type=DISABLED + auth.ingestion.filter.enabled=false + the 5 batch-ZE read endpoints' anonymous reachability` and emit a per-cluster matrix WARN.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-029 (DISABLED-as-default — the architectural commitment that makes this consequence persist); ADR-CANDIDATE-210 (whoami empty-context permissive fallback — identity-layer FACET); REFACTOR-073 (the boot-time security-posture validator gap — the cross-cutting fix); REFACTOR-626 NEW (the relationship cross-tenant exposure compounded by DISABLED).
- SUPERSEDES: none.
- CONFLICTS: none.

---
