---
doc_page: "docs/developer-guides/api-reference.md"
page_title: "API Reference"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Platform API architectural shape — 194 operations / 35 tags / 100 GET + 34 POST + 34 PUT + 24 DELETE + 2 PATCH"
    - "Query Current User Identity (whoami)"
    - "Query Resource Permissions"
    - "Ingest Data Entity List (S2S)"
  features: []
  code_nodes:
    - "odd-platform java IdentityController controller-method:whoami"
    - "odd-platform java AppInfoController controller-method:getAppInfo"
    - "odd-platform java PermissionController controller-method:getResourcePermissions"
    - "odd-platform java IngestionController controller-method:postDataEntityList"
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:PermissionController"
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:IngestionController"
    - "odd-platform openapi tags openapi-tag:identity"
    - "odd-platform openapi tags openapi-tag:appInfo"
    - "odd-platform openapi tags openapi-tag:permission"
audience: [developer, operator]
doc_claim_vs_code:
  - "Page (Permission read surface table + warning hint) enumerates the PermissionResourceType enum as four values DATA_ENTITY, NAMESPACE, TERM, MANAGEMENT and lists the contextual endpoint's valid values as DATA_ENTITY, NAMESPACE, TERM. Code: the enum's actual members are DATA_ENTITY, TERM, QUERY_EXAMPLE, MANAGEMENT — there is NO NAMESPACE value and the page OMITS QUERY_EXAMPLE. Evidence: odd-platform-specification/components.yaml `PermissionResourceType` enum (DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT) + PermissionServiceImpl.java:23-27 which derives context from PolicyTypeDto, whose hasContext flags are DATA_ENTITY(true) / TERM(true) / QUERY_EXAMPLE(true) / MANAGEMENT(false) (PolicyTypeDto enum). The page's central claim (MANAGEMENT → HTTP 400 'does not have context', management permissions live on whoami) is CONFIRMED EXACT against PermissionServiceImpl.java:26; only the enum-membership list is stale — severity MEDIUM (an SDK author following the page builds a switch over a non-existent NAMESPACE arm and misses the real QUERY_EXAMPLE arm)."
  - "Page (Per-feature endpoints index) lists 10 feature sub-pages and the Identity-and-introspection section covers identity/appInfo/permission, but the OpenAPI spec defines 34 distinct operation tags. Multiple tags have ZERO sub-page representation at the hub — the canonical tracked instance is the `dataSet` tag (4 GET endpoints, openapi.yaml:1793-1878, no sub-page) plus the sister `dataSource` tag, per invariant:datasetcontroller-undocumented-dataset-openapi-tag-batch-w. Other unrepresented tags include activity, collector, dataEntityAttachment, dataEntityRun, dataQuality, metadata, namespace, owner, policy, role, search, tag. The page partitions by feature surface (some tags such as `dataEntity` are partly covered via the Lineage sub-page — lineage endpoints carry the `dataEntity` tag, openapi.yaml:1253-1320, NOT a dedicated lineage tag), so the gap is not a clean 1:1 tag deficit; but full-surface coverage is absent and the page does not say so for the dataSet/dataSource families. Evidence: openapi.yaml tag census (34 tags) vs the page's 10 sub-pages + 3 introspection families; canonical doc-gap node invariant:datasetcontroller-undocumented-dataset-openapi-tag-batch-w — severity MEDIUM (coverage gap; partly self-acknowledged by the page's 'per-feature' framing and its note that introspection endpoints are 'not enumerated today')."
  - "Page (whoami section) states that under 'LOGIN_FORM / OAUTH2 / LDAP / S2S' the response is the real identity, treating S2S as a peer auth mode alongside the others. Code: `auth.type` accepts exactly DISABLED / LOGIN_FORM / OAUTH2 / LDAP (the @ConditionalOnProperty havingValue set across DisabledAuthSecurityConfiguration.java:10, LoginFormSecurityConfiguration.java:31, OAuthSecurityConfiguration.java:71, LDAPSecurityConfiguration.java:51); S2S is NOT an `auth.type` value — it is a separate token mechanism (S2sTokenProvider, S2sAuthenticationFilter) layered on top. The operational claim (an S2S-authenticated caller gets a real identity) is not false, but listing S2S as a sibling of the four auth.type modes is imprecise. The appInfo section's authType list (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) is CORRECT and matches the actual auth.type values. Evidence: AppInfoController.java:17-26 (plain `@Value(\"${auth.type}\")` String, no enum) + the four security-config havingValue annotations — severity LOW (framing nuance; appInfo list accurate)."
maintainer_curated: false
---

# API Reference — doc understanding

This is the canonical developer-facing hub for the ODD Platform HTTP API. It indexes 10 per-feature sub-pages (each binding to a controller / OpenAPI tag), then documents four cross-cutting contracts the per-feature pages deliberately do not: the identity/introspection endpoints (`GET /api/identity/whoami`, `GET /api/appInfo`), the two-endpoint permission-read orchestration (`GET /api/resource/{type}/{id}/permissions` vs `whoami.identity.permissions`), the ingestion response contract (`POST /ingestion/entities`), and the Swagger-UI/OpenAPI-spec surface. The page maps to the canonical architectural-shape concept "Platform API architectural shape — 194 operations / 35 tags ..." (its "194-operation OpenAPI surface" and tag counts are corroborated by that invariant, sourced from `odd-platform-specification/openapi.yaml` + `components.yaml`), and to the operation concepts "Query Current User Identity (whoami)", "Query Resource Permissions", and "Ingest Data Entity List (S2S)".

The page is high-fidelity on its three deep-dive contracts, and three of its load-bearing claims are confirmed EXACT against source: (1) under `auth.type=DISABLED`, `whoami` returns the synthetic admin payload `username="admin"` + every `Permission.values()` — IdentityController.java:23-32 returns `dummyOwner()` via `switchIfEmpty`, with `permissions(Arrays.asList(Permission.values()))`; this is the LSN-class anonymous-admin exposure already tracked as REFACTOR-185. (2) `GET /api/resource/MANAGEMENT/0/permissions` returns HTTP 400 "Resource type MANAGEMENT does not have context" — PermissionServiceImpl.java:24-26 throws `BadUserRequestException` for any non-contextual type. (3) `POST /ingestion/entities` returns HTTP 200, not the spec-declared 201 — IngestionController.postDataEntityList returns `ResponseEntity.ok().build()` (the controller's sibling `postDataSetStatsList` and `ingestMetrics` DO return `HttpStatus.CREATED`/201, so the 200 is specific to the entities call); and the page's "duplicate ODDRN surfaces as 5xx" claim is corroborated by the concept "Duplicate ODDRN within a single ingestion payload crashes the batch with IllegalStateException — Collectors.toMap default merger". `GET /api/appInfo` (AppInfoController.java) is also confirmed: it returns `projectVersion` + `authType` with no permission gate, exactly as the page states.

Three drift findings remain (see frontmatter). MEDIUM: the page's `PermissionResourceType` enum membership is stale — it lists a non-existent `NAMESPACE` value and omits the real `QUERY_EXAMPLE` value (actual enum: DATA_ENTITY / TERM / QUERY_EXAMPLE / MANAGEMENT per components.yaml + PolicyTypeDto), so an SDK author following the page builds the wrong switch even though the page's MANAGEMENT-routing advice is correct. MEDIUM: API-surface coverage — 34 spec tags vs 10 sub-pages; the `dataSet` (and sister `dataSource`) tags have zero sub-page representation, the canonical tracked instance being invariant:datasetcontroller-undocumented-dataset-openapi-tag-batch-w; the page partitions by feature surface (lineage endpoints ride the `dataEntity` tag, not a dedicated one), so the deficit is not a clean per-tag count, and the page partly self-acknowledges the gap for the introspection families. LOW: the whoami section lists S2S as a peer of the four `auth.type` modes, but S2S is a token mechanism layered on top, not an `auth.type` value (the appInfo section's authType list is accurate). No `F-NNN` feature binds cleanly here — this is a cross-feature reference hub rather than a single-feature page, so `describes.features` is intentionally empty (Rule 3: empty-but-honest over padded).

## Maintainer notes
