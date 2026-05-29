---
doc_page: "docs/management.md"
page_title: "Management"
live_url: "https://docs.opendatadiscovery.org/features/management"
live_url_verified_status: "200"
live_url_resolved_slug: "features/management"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    # canonical names present in concepts.yaml (catalog v8)
    - "Collector Token"
    - "Ingestion Filter"
    - "Policy (Authorization)"
    - "Role (Authorization)"
    - "Owner (Authorization directory entry)"
    - "Tag"
    - "User-Owner Mapping"
    - "FTS Search Vector (Data Entity)"
    - "Plaintext-equality shared-secret token model"
    - "Permission-bypass via Owner auto-create (side-door write path)"
    - "Read-collaborative cross-owner enumeration"
    - "Regenerate Collector Token"
    - "Create Policy"
    - "Create Role"
    - "Create Owner"
    # confirmed live graph concepts newer than the v8 catalog freeze (verified via graph-node)
    - "Regenerate Data Source Token"
    - "Register Data Source (UI admin path)"
    - "Delete Owner — soft-delete with cascade-block"
    - "Delete Data Source (UI admin, guarded soft-delete)"
    - "DataSource delete is an incomplete soft-delete — orphans the token row and leaves the FTS search_entrypoint vector uncleared"
    - "owner_association_request orphan rows persist after owner-delete"
    - "NAMESPACE_CREATE side-door confirmed at 4 sister services (Term + DataSource + Collector + DataEntityGroup)"
    - "Integration Wizard endpoints have NO RBAC permission (open-read across all auth modes including anonymous-under-DISABLED)"
    - "RBAC read endpoints (Role/Policy/Permission/Policy-Schema lists) have NO SecurityRule — any authenticated user reads"
    - "Collector plaintext token at-rest — end-to-end SQL-to-DOM exposure chain"
  features:
    - "F-161"   # Management section top-level chrome (sidebar + outer permissions provider + Integrations bare-route)
    - "F-105"   # Management Section Route Gating (read-collaborative posture; reads not blocked)
    - "F-031"   # Data Source Lifecycle — list / register / update / delete / regenerate-token
    - "F-020"   # Collector Lifecycle Management
    - "F-019"   # Owner Lifecycle Management
    - "F-028"   # Namespace Lifecycle — create / list / details / update / delete
    - "F-018"   # Manual Object Tagging
    - "F-125"   # Ingestion Credential Lifecycle — orphan tokens, plaintext at rest, no rotation grace
  code_nodes:
    - "odd-platform java DataSourceController controller-method:regenerateDataSourceToken"
    - "odd-platform java IngestionDataEntitiesFilter config-key-consumer:auth.ingestion.filter.enabled@L20"
audience: [operator]
doc_claim_vs_code:
  - "RESOLVED-DRIFT (page now leads the code-node's own doc audit): the regenerateDataSourceToken sidecar's docs_link_semantic (WebFetched 2026-05-21) recorded that the live Management page named the Regenerate action but documented NONE of the load-bearing rotation mechanics — no grace period, no plaintext-in-response, no DISABLED bypass. The current page (commit 30795b4) documents ALL of them in the 'Data Sources known caveats' + 'Collectors known caveats' blocks. The code node's recorded drift finding is now stale and over-counts; the page has closed it. Evidence: odd-platform java DataSourceController controller-method:regenerateDataSourceToken (DataSourceServiceImpl.java:99-106)."
  - "CONFIRMED (no drift): page claims regenerateDataSourceToken is the only non-@ReactiveTransactional mutating method on the Datasource service. Code agrees — create (DataSourceServiceImpl.java:52), update (:69), delete (:86) carry @ReactiveTransactional; regenerate (:99) does not. Evidence: odd-platform java DataSourceController controller-method:regenerateDataSourceToken."
  - "CONFIRMED (no drift): page claims default deployment ships ingestion-token verification OFF on POST /ingestion/entities so token rotation has no security effect on the bulk path under default config. Code agrees — @ConditionalOnProperty(value=auth.ingestion.filter.enabled, havingValue=true) with NO matchIfMissing, and application.yml:48 sets it false. Evidence: odd-platform java IngestionDataEntitiesFilter config-key-consumer:auth.ingestion.filter.enabled@L20 (IngestionDataEntitiesFilter.java:20)."
  - "CONFIRMED (no drift): page claims Datasource delete orphans the TOKEN row and leaves the FTS index uncleared. Code agrees — soft-delete does not cascade or clear adjacent rows; update path calls updateSearchVectors, delete path does not. Evidence: invariant:datasource-delete-incomplete-cleanup-orphan-token-uncleared-fts (DataSourceServiceImpl.java:85-96)."
  - "CONFIRMED (no drift): page claims Owner delete zips three existence-predicates (term-ownership, data-entity-ownership, user-owner association). Code agrees — Mono.zip(termOwnership.existsByOwner, ownership.existsByOwner, userOwnerMapping.isOwnerAssociated). Evidence: operation:delete-owner-with-cascade-block (OwnerServiceImpl.java:88-100)."
  - "CONFIRMED (no drift): page's owner_association_request orphan gap is real. Code agrees — cascade-block omits owner_association_request; soft-delete means the FK (no ON DELETE clause) is never consulted. Evidence: invariant:owner-association-request-orphan-rows-after-owner-delete (OwnerServiceImpl.java:90-91; V0_0_51__add_owner_association_request.sql:11)."
  - "CONFIRMED (no drift): page claims the namespace_name auto-create side-door exists on DataSource + three other endpoints (Term, Collector, Data-entity-group) — four total. Code agrees — getOrCreate-as-side-door confirmed at four sister services. Evidence: invariant:namespace-create-side-doors-cross-pillar-4-sister-services-batch-w-closure (TermServiceImpl.java:103,138 + DataSource/Collector/DEG sister sites)."
  - "MINOR-IMPRECISION (caveat, not contradiction): page states Collector tokens are written 'verbatim' and warns on plaintext at rest — accurate — but does not surface that the generator uses ThreadLocalRandom (RandomStringUtils.randomAlphanumeric(40)), a non-CSPRNG (the CSPRNG-correct call is .secure().nextAlphanumeric(40)). The non-constant-time equality IS documented; the weak-RNG provenance of the token is not. Low-severity DOC-GAP candidate. Evidence: invariant:collector-plaintext-token-at-rest-end-to-end-sql-to-dom-chain (TokenGeneratorImpl.java:34-42)."
maintainer_curated: false
---

# Management — doc understanding

This page is the operator-facing map of the platform's in-UI Management section — the nine
mutating tabs (Namespaces, Datasources, Integrations, Collectors, Owners, Tags, Associations,
Roles, Policies) rendered by `Management.tsx` / `ManagementTabs` / `ManagementRoutes`, the
authorization posture across them, and the operationally load-bearing caveats around token
rotation, cascade-block deletion, and the read surface. It maps to feature **F-161** (the
top-level Management chrome — sidebar + outer `WithPermissionsProvider` seeded only with
`OWNER_ASSOCIATION_MANAGE` + the Integrations bare-route) and **F-105** (Management route
gating — every sub-area except `/management/associations` is deep-linkable and renders the full
catalog for any authenticated user; only buttons hide), plus the per-tab lifecycle features
F-031 / F-020 / F-019 / F-028 / F-018 / F-125 (all confirmed via graph-node).

The page is **unusually well-aligned with the code** and is one of the strongest doc→code
matches in the corpus: every danger/warning hint cites a behaviour confirmed by an enriched
node or invariant. Two runtime claims are confirmed against fully-enriched code nodes
(`regenerateDataSourceToken` — DataSourceServiceImpl.java:99-106; the `IngestionDataEntitiesFilter`
config-key gate — IngestionDataEntitiesFilter.java:20 + application.yml:48). The rest of the
caveats trace to confirmed invariant/operation concept nodes (owner/namespace/datasource
cascade-block, the orphan-token + uncleared-FTS delete asymmetry, the `namespace_name`
auto-create side-door across four sister services, the plaintext-equality token model, the
RBAC read-collaborative posture, the Integration-wizard open-read posture).

The single highest-value drift observation runs **doc-ahead-of-code-audit**: the
`regenerateDataSourceToken` sidecar's own May-21 live-doc audit flagged that the Management page
documented none of the rotation mechanics — that finding is now **stale**, because the current
page (commit 30795b4) documents all of them. The doc has closed the drift the code node still
records. The only residual gap is a low-severity omission: the page warns on plaintext-at-rest +
non-constant-time comparison but does not mention the token generator's non-CSPRNG
(`ThreadLocalRandom`) provenance.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
