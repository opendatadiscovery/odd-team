---
node_id: "odd-platform java DataEntityController controller-method:getDataEntityDetails"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-F-DataEntityDetails
---

# DataEntityController#getDataEntityDetails — semantic understanding

## understanding

`getDataEntityDetails` (`GET /api/dataentities/{data_entity_id}`) is the **single hottest read endpoint on the platform** — the UI's primary data-entity detail page consults it on every entity-navigation, every deep-link, every refresh, and every "Overview tab" mount. The method is a one-line pass-through to `dataEntityService.getDetails(...)` (`DataEntityController.java:139-147`); the service fans out to a single jOOQ CTE query plus four additional reactive zip-merge round-trips (metadata, dataset versions, terms, tags) plus a side-effecting `UPDATE data_entity SET view_count = view_count + 1` issued on every successful read — making this GET endpoint **not idempotent at the DB layer**. The endpoint carries NO permission gate (no `@PreAuthorize` on either the controller or the generated interface, no entry in `SecurityConstants.SECURITY_RULES` for the GET path), so any authenticated user under LOGIN_FORM/OAUTH2/LDAP — and any anonymous caller under `auth.type=DISABLED` — receives the full DataEntityDetails payload (ownership list, descriptions, business name, tags, terms, custom metadata field values, status, type, dataset versions, lineage shortcuts, sourceCreatedAt, view count) for any data entity ID, including **soft-deleted entities** (the CTE config sets `includeDeleted(true)` deliberately).

## concepts

- entities: [
    "`DataEntityDetails` (response payload; OpenAPI-generated; `DataEntityDetails.java:48-141` enumerates 34 fields including id, oddrn, externalName, internalName, ownership[], dataSource, lookupTableId, entityClasses[], type, dataEntityGroups[], status, sourceCreatedAt, sourceUpdatedAt, lastIngestedAt, viewCount, isStale, stats, metadataFieldValues[], externalDescription, internalDescription, terms[], tags[], versionList[], sourceList[], targetList[], outputList[], inputList[], suiteName, suiteUrl, expectation, severity, datasetsList[], linkedUrlList[], latestRun, itemsCount, entities[], hasChildren, manuallyCreated)",
    "`DataEntityDetailsDto` (internal DTO assembled from the jOOQ details record + four enrichment Monos)",
    "`NotFoundException` (`switchIfEmpty(Mono.error(new NotFoundException(\"Data entity\", dataEntityId)))` at `DataEntityServiceImpl.java:200` — translated to HTTP 404 by the global Spring exception handler)",
    "soft-delete state (entity's `deleted_at` column; bypassed by `includeDeleted(true)` at `ReactiveDataEntityRepositoryImpl.java:220` — see `bugs_limitations_corner_cases`)"
  ]
- operations: [
    "delegate `getDetails(Long)` to `DataEntityService` (controller boundary)",
    "fetch single data-entity row with full dimensions via `baseDimensionsSelect` CTE (`ReactiveDataEntityRepositoryImpl.java:217-225`)",
    "error on missing → `NotFoundException(\"Data entity\", id)` → HTTP 404",
    "enrich entity-class details (zip of: dependencies map + last-task-runs map + DEG-children map + DEG-children-count map + consumers-count map — 5 parallel reactive lookups)",
    "enrich parent groups (`reactiveDataEntityRepository.getParentDEGs(oddrns)`)",
    "enrich details-specific (zip of: metadata field values + dataset versions + terms + tags — 4 parallel reactive lookups)",
    "side-effect: `UPDATE data_entity SET view_count = view_count + 1 WHERE id = ?` and reflect the new value into the response (`ReactiveDataEntityRepositoryImpl.java:174-180`)",
    "map DTO → DataEntityDetails contract via `dataEntityMapper::mapDtoDetails`",
    "lift to `ResponseEntity.ok(...)`"
  ]
- invariants: [
    "every successful read increments `view_count` by 1 in the same transaction — read is a write at the DB layer",
    "soft-deleted entities ARE returned (the detail view intentionally surfaces deleted entities — `includeDeleted(true)` at `ReactiveDataEntityRepositoryImpl.java:220`); hollow entities are excluded by the `DATA_ENTITY.HOLLOW.isFalse()` guard at `ReactiveDataEntityRepositoryImpl.java:918`",
    "the GET endpoint carries `@ReactiveTransactional` at the service layer (`DataEntityServiceImpl.java:197`) — the read + the view-count UPDATE share one transaction",
    "no per-user filtering: every authenticated principal sees an identical payload for a given `dataEntityId` (no ownership, role, namespace, or datasource scoping)"
  ]
- audiences: [
    "ODD Platform UI — the per-entity detail page's Overview tab and every other tab that opens via the same entity context (Lineage, Alerts, Activity, Discussions, Metrics, Test Reports, Structure, Linked Items, Query Examples)",
    "third-party API consumers calling `GET /api/dataentities/{id}` to build dashboards, exports, or compliance scans"
  ]

## dependencies_semantic

- requires-feature: [
    "data-discovery feature — live page `https://docs.opendatadiscovery.org/features/data-discovery` (status 200, 2026-05-12; fetched_excerpt: page describes catalog as 'entry point for locating entities through search and browsing' and lists annotation features 'tagging, business names, statuses, attachments' but **explicitly does not describe the post-click entity-detail page nor any per-entity visibility rules** — see `docs_link_semantic.doc_drift_findings`)",
    "catalog overview / per-entity Overview tab — live page `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (status 200, 2026-05-12; fetched_excerpt: 'The per-entity **Overview tab** is the landing tab inside any data entity's detail page — entity description, owners, tags, terms, custom metadata.' — sole user-facing mention of the detail-page content surface)",
    "view-count statistic — the auto-incremented `view_count` feeds the `getPopular` endpoint's 'most-viewed' ranking (`DataEntityController.java:308-313`) and the catalog-overview 'Popular' recommendations panel"
  ]
- requires-config: [] — N/A (method reads no config keys; behaviour is fixed at compile time)
- requires-runtime: [
    "Spring WebFlux + reactive transaction manager — `@ReactiveTransactional` at `DataEntityServiceImpl.java:197` wraps the entire pipeline including the view-count UPDATE",
    "jOOQ reactive operations — `jooqReactiveOperations.mono(query)` at `ReactiveDataEntityRepositoryImpl.java:223` for the main read, `.mono(query)` at `:179` for the view-count UPDATE",
    "PostgreSQL — soft-delete via `deleted_at` column on `DATA_ENTITY`, `view_count` column on `DATA_ENTITY` (`DATA_ENTITY.VIEW_COUNT` at `ReactiveDataEntityRepositoryImpl.java:176`)",
    "reactor `Context` propagation for the principal — NOT used by this method (the controller method takes no `Authentication` parameter, the service method `getDetails(long)` takes only an `id` — auth is enforced upstream by the security filter chain, not by this read path)"
  ]
- couples-to: [
    "`DataEntityApi#getDataEntityDetails` (generated from OpenAPI spec — `odd-platform-api-contract/build/generated/src/main/java/.../api/DataEntityApi.java:873-888`; `@RequestMapping(method=GET, value=\"/api/dataentities/{data_entity_id}\", produces={\"application/json\"})`; no `@PreAuthorize` / `@Secured` / authorization annotation on the generated method)",
    "`DataEntityService#getDetails(long)` (`DataEntityServiceImpl.java:196-209` — the orchestration entrypoint with @ReactiveTransactional)",
    "`ReactiveDataEntityRepository#getDetails(long)` (`ReactiveDataEntityRepositoryImpl.java:217-225`)",
    "`ReactiveDataEntityRepository#incrementViewCount(long)` (`ReactiveDataEntityRepositoryImpl.java:173-180` — the read-side write)",
    "`ReactiveMetadataFieldRepository#getDtosByDataEntityId`, `ReactiveDatasetVersionRepository#getVersions`, `TermService#getDataEntityTerms`, `ReactiveTagRepository#listDataEntityDtos` — four parallel enrichment lookups at `DataEntityServiceImpl.java:617-622`",
    "`AuthorizationCustomizer` (`<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/authorization/AuthorizationCustomizer.java:24-30`) — sole authorization layer; this GET path has no entry in `SECURITY_RULES`, falls through to `.pathMatchers(\"/**\").authenticated()` at line 29-30"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "happy-path read-back after status change — `DataEntityStatusChangeTest#statusChangeTest` issues `webTestClient.get().uri(\"/api/dataentities/{data_entity_id}\", id)` (via the `getDetails(Long)` helper at `DataEntityStatusChangeTest.java:73-80`); covers HTTP 200, JSON deserialisation into `DataEntityDetails`, and the post-status-change state assertion (the test calls `getDetails` twice — once after STABLE-set, once after DEPRECATED-set)"
  ]
- uncovered_behaviours: [
    "404 path — no test asserts `NotFoundException` → HTTP 404 for a non-existent `data_entity_id`",
    "soft-deleted entity read — no test asserts that a soft-deleted entity IS still returned (which is the current behaviour; the inverse — that deleted entities are hidden — would be a regression to catch)",
    "hollow entity read — no test asserts that a hollow entity is NOT returned (`DATA_ENTITY.HOLLOW.isFalse()` is enforced inside the CTE; a regression that removes the hollow guard would silently expose ingestion-staging entities)",
    "view-count side effect — no test asserts that `view_count` is incremented exactly once per call (or that it does NOT increment when the entity does not exist); the side effect is invisible to the existing happy-path read-back",
    "cross-owner read — no test asserts that user A can read user B's data entity (which IS the current behaviour under read-collaborative); the inverse — that owner-scoping would block cross-tenant reads — is the regression that exists today",
    "DISABLED-mode anonymous read — no test asserts `auth.type=DISABLED` produces a 200 for an unauthenticated caller (the current behaviour per the 8-sidecar DISABLED-bypass triangulation in `implicit-adrs.md`)",
    "404 vs 403 distinction — no test asserts whether a 404 on a non-existent ID is indistinguishable from a 404 on an existing-but-blocked ID (today both produce 404 because there is no per-entity authz layer)",
    "transactional rollback of view-count — no test asserts that a downstream enrichment failure rolls back the view-count UPDATE (the `@ReactiveTransactional` annotation implies it would; not verified by any existing test)",
    "N+1 round-trip count — no test/benchmark asserts the round-trip count per call; a regression that splits the CTE into N queries would silently degrade the platform's hottest read"
  ]
- test_files: [
    "`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DataEntityStatusChangeTest.java:38, 46, 73-80` (the only test that exercises `GET /api/dataentities/{id}`; uses it as a read-back assertion after status PUT, not as a primary subject)",
    "`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceTest.java:48-end` (DataEntityServiceTest exists but `grep -n 'getDetails' <odd-platform-repo>/odd-platform-api/src/test/java/.../service/DataEntityServiceTest.java` returns ZERO matches — the service's `getDetails` orchestration is not unit-tested)"
  ]
- gaps: |
    The endpoint that the entire platform's "view an entity" UX rides on has effectively one happy-path read-back assertion, used as a passive verifier inside a status-mutation test. The most expensive regression risks have zero coverage: (a) the side-effecting view-count UPDATE inside a `@ReactiveTransactional` boundary — a regression that decouples the UPDATE from the transaction would either double-count views on retry or leave orphan increments on enrichment failure; (b) the `includeDeleted(true)` flag — a regression that flips it to `false` would 404 every soft-deleted entity's detail page in the UI, breaking the lifecycle-recovery flow; (c) the absence of owner-scoping — a future change adding per-tenant filtering would need explicit test coverage to confirm it gates correctly and surface that the 38-other-controller-endpoints have the same gap; (d) DISABLED-mode anonymous behaviour — a regression that adds a SECURITY_RULES entry for GET reads would change behaviour under LOGIN_FORM/OAUTH2/LDAP and is invisible until the operator hits it. A `@WebFluxTest(DataEntityController.class)` suite asserting (1) 200 + correct JSON for an authorized caller, (2) 404 for a non-existent ID, (3) 200 + isStale-flagged payload for a soft-deleted entity, (4) 403 (or a documented 200) for an unauthorized caller under each `auth.type`, (5) exactly one view-count increment per call would catch every one of these regressions.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation on the method or class (verified by inspecting `<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:139-147` and the file head 1-69)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "Catalog feature page — the primary discovery entrypoint that drives clicks through to `GET /api/dataentities/{id}` calls"
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "Data Discovery section's role as an entry point for locating entities through search and browsing"
      "Catalog Overview page and Directory as discovery mechanisms"
      Annotation features listed: "tagging, business names, statuses, attachments"
      The page **does not** describe the post-click entity-detail page nor any per-entity visibility/authorization rules — confirmed by WebFetch ask-prompt 2026-05-12.
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: ""
    rationale: "Sole live page that mentions the per-entity detail page — establishes that the Overview tab is the landing tab"
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Verbatim: "The per-entity **Overview tab** is the landing tab inside any data entity's detail page — entity description, owners, tags, terms, custom metadata."
      The page **does not** describe other fields surfaced in `DataEntityDetails` (status, dataSource, lookupTableId, sourceCreatedAt/sourceUpdatedAt/lastIngestedAt, viewCount, isStale, stats, dataset versions, lineage shortcuts, latestRun, suite info, linkedUrlList, hasChildren, manuallyCreated, datasetsList, etc.) — partial coverage only.
      The page **does not** state any access-control or per-user filtering on entity detail viewing — confirmed by WebFetch ask-prompt 2026-05-12.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Authorization-framework reference; the canonical SoT for whether reads are gated"
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Authorization overview page enumerates: "Policies, Permissions, Roles, Owners, User-owner association."
      The page **does not** address GET endpoint authorization — specifically does NOT state whether `GET /api/dataentities/{id}` is permission-gated or authenticated-only — confirmed by WebFetch ask-prompt 2026-05-12.
      This silence is the doc-drift finding: the page does not describe the read-collaborative posture (ADR-CANDIDATE-003) that the code implements.
- doc_drift_findings:
  - "**Live `/features/data-discovery` and `/features/data-discovery/catalog-overview` describe entity-detail visibility as 'the landing tab inside any data entity's detail page' with the implicit assumption that any user reaches it; they do NOT state the security posture — specifically that ANY authenticated user (and any anonymous caller under `auth.type=DISABLED`) can read ANY entity's full details including descriptions, ownership history, soft-deleted state, and view-count.** The live security page (`/configuration-and-deployment/enable-security/authorization`) also does not address read-endpoint posture. The maintainer's reader cannot determine from docs whether cross-owner reads are intentional. Per the 3-surface read-collaborative-blast-radius family (REFACTOR-024 alerts + REFACTOR-053 activity + REFACTOR-187 search), DataEntityDetails is the 4th and largest surface — the centerpiece UI read — and the doc-vs-code drift is widest here."
  - "**`DataEntityDetails` payload has 34 fields (`DataEntityDetails.java:48-141`); the catalog-overview page lists 5 of them (description, owners, tags, terms, custom metadata).** No live page enumerates the full payload, the `viewCount` side-effect (the user's read mutates state), or the `isStale` flag semantics. Third-party API consumers must read the OpenAPI spec to know what the endpoint returns."
  - "**The view-count side-effect is undocumented.** Live docs do not state that a GET request to `/api/dataentities/{id}` performs a write (UPDATE) at the DB layer. Operators auditing for read-only access paths, building read-replicas, or applying transactional isolation tuning have no published signal that this GET endpoint mutates state."

## implicit_adrs

- "Detail endpoint is intentionally outside `SECURITY_RULES` — the GET path has no permission rule and falls through to `pathMatchers(\"/**\").authenticated()`. The decision is consistent across all 27+ GET endpoints on `DataEntityController` (per the class-level sidecar's invariants[3]) and across the read-collaborative blast-radius family (getAllAlerts, getActivity, search). This is the centerpiece embodiment of ADR-CANDIDATE-003 (read-collaborative GET-uniformly-authenticated)." — evidence: SecurityConstants.java:98-355 (no GET /api/dataentities/{id} rule in the entire SECURITY_RULES list) + AuthorizationCustomizer.java:24-30 (the fall-through to `.authenticated()`) — intent_anchor: "the cross-controller consistency across 27+ GET endpoints" — confidence: HIGH
- "**Soft-deleted entities ARE returned by the detail view, by design.** `ReactiveDataEntityRepositoryImpl.java:217-225` builds the CTE config with `.includeDeleted(true)`; combined with the CTE select at lines 909-917 which bypasses `addSoftDeleteFilter` when `isIncludeDeleted()` is true. The UI needs this to render lifecycle-deleted entities (so users can see/restore them, see the `isStale` flag, etc.); contrasted with the search/list paths which set `includeDeleted(true)` only for the by-id path (`getDimensions` at line 186, `getDimensionsByIds` at line 208, `getDetails` at line 220). The deliberate-asymmetry is the implicit ADR." — evidence: ReactiveDataEntityRepositoryImpl.java:217-225 (`.includeDeleted(true)` for getDetails) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE config branches on the flag) + DataEntityDetails.java:86 (`isStale` field exists for client-side rendering of the deleted/stale state) — intent_anchor: "the deliberate `.includeDeleted(true)` + the `isStale` response field as a paired contract" — confidence: HIGH
- "**Read counts as a write — `getDetails` runs inside `@ReactiveTransactional` and side-effects `view_count`.** `DataEntityServiceImpl.java:197` carries `@ReactiveTransactional`; line 199-208 chains `incrementViewCount` into the pipeline; `ReactiveDataEntityRepositoryImpl.java:173-180` issues an `UPDATE data_entity SET view_count = view_count + 1 WHERE id = ?` with `.returningResult(...)` so the new value is returned and reflected in the response. The decision: track view-count for the `getPopular` ranking (`DataEntityController.java:308-313`) and the recommendation panel, accepting that every read is also a write at the DB layer." — evidence: DataEntityServiceImpl.java:197-208 (`@ReactiveTransactional` + `.flatMap(this::incrementViewCount)`) + ReactiveDataEntityRepositoryImpl.java:173-180 (the UPDATE statement) — intent_anchor: "the explicit `incrementViewCount` step in the orchestration chain, paired with the `viewCount` field surfaced in the DataEntityDetails contract (`DataEntityDetails.java:84`) and the `getPopular` endpoint that consumes it" — confidence: HIGH
- "Detail orchestration is a multi-stage zip-merge enrichment rather than a single fat query — five parallel lookups for entity-class details (dependencies + last task runs + DEG children + DEG children count + consumers count), four parallel lookups for details specifics (metadata + dataset versions + terms + tags), plus the parent-DEG lookup and the view-count UPDATE. The decision: trade query simplicity for reactive parallelism; one stage's slow query does not block the others." — evidence: DataEntityServiceImpl.java:513-531 (5-way `Mono.zip` for entity-class details) + DataEntityServiceImpl.java:616-631 (4-way `Mono.zip` for details enrichment) — intent_anchor: "the consistent `Mono.zip(...)` pattern with `function(...)` consumer applied across both enrichment phases" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Cross-owner enumeration of full entity details — same shape as REFACTOR-024 (alerts), REFACTOR-053 (activity), REFACTOR-187 (search) but on the centerpiece read.** Any authenticated user under LOGIN_FORM/OAUTH2/LDAP can issue `GET /api/dataentities/{id}` for any `id` in the database and receive the full DataEntityDetails payload — owners (full Ownership[] list, exposing organisational membership), internalDescription + externalDescription (free-text fields that may contain PII, internal URLs, customer names), tags + terms (which may encode classifications/sensitivity labels), custom metadata field values (operator-defined key-value pairs that may include credentials, contact info, or business context), dataSource (with name, namespace, description), linkedUrlList (operator-supplied URLs that may reach internal systems), and the source's lifecycle state. The blast radius here is **wider than alerts/activity/search** because a single ID-enumeration loop yields the complete catalog. The ADR-CANDIDATE-003 borderline triage now has its strongest single piece of evidence: the posture is either (a) genuinely intentional collaborative-catalog and must be documented as such on the live security page, or (b) a missed gate that needs a `DATA_ENTITY_READ` permission. The maintainer's call." — evidence: DataEntityController.java:139-147 (no permission check at controller) + DataEntityApi.java:873-888 (no `@PreAuthorize` on the generated interface) + SecurityConstants.java:98-355 (no rule for `GET /api/dataentities/{data_entity_id}`) + AuthorizationCustomizer.java:29-30 (fall-through to `authenticated()`) — severity: HIGH
- "**Resource enumeration via 200-vs-404 — user discovers which data-entity IDs exist by walking the integer ID space.** The endpoint returns 200 + full payload for any extant ID and 404 (`NotFoundException(\"Data entity\", id)` at `DataEntityServiceImpl.java:200`) for any non-existent ID. There is no per-user 403 layer that would mask the existence question. A caller scripting `GET /api/dataentities/1` ... `GET /api/dataentities/1000000` discovers (a) which IDs are populated, (b) which entity classes/types/data-sources they map to, (c) which were soft-deleted (via the `isStale` flag) — a full catalog reconnaissance with a single loop, achievable by any authenticated user (and any anonymous caller under DISABLED). Mitigation today: integer IDs are sequential, but the rate is unthrottled at this endpoint." — evidence: DataEntityServiceImpl.java:200 (the `NotFoundException` branch returning 404) + no rate-limiting middleware found in AuthorizationCustomizer.java — severity: MEDIUM
- "**DISABLED-mode anonymous read — under `auth.type=DISABLED` (the default in `application.yml`), this endpoint is reachable WITHOUT authentication.** Per the 8-sidecar DISABLED-bypass triangulation in `implicit-adrs.md` (DisabledAuthSecurityConfiguration.java:14-17 — `permitAll()` on every exchange), and per the auth-mode-coupling captured in the class-level sidecar's security block. An operator who deploys with the default config and exposes port 8080 to an untrusted network is leaking the entire catalog's detailed metadata to anyone who can reach the port — descriptions, ownership, metadata, terms, tags, lineage shortcuts, source URLs, view counts. This is the LSN-001-shape failure mode applied to read access." — evidence: DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:29-30 (only wired when auth is enabled) + DataEntityController.java:139-147 (no defence in depth) — severity: HIGH (under default config)
- "**View-count UPDATE inside `@ReactiveTransactional` — read retries inflate the counter, and enrichment failures roll back the increment silently.** The `view_count` UPDATE shares the same transaction as the read + 4 enrichment merges. If any enrichment step fails after `incrementViewCount` has executed, the transaction rolls back and the count is NOT incremented even though the user's HTTP layer may have observed the request. Conversely, a client-driven retry (network reset, gateway timeout, browser reload) increments the count multiple times for what the user perceives as one view. There is no idempotency key, no client-id-based debouncing, no rate-limit on the increment side. The `getPopular` ranking that consumes `view_count` is therefore subject to (a) under-counting on partial failures, (b) over-counting on retries / hot-reload loops, (c) trivial inflation by a malicious client scripting `GET /api/dataentities/{id}` to push an entity to the top of the Popular panel." — evidence: DataEntityServiceImpl.java:197 (`@ReactiveTransactional`) + DataEntityServiceImpl.java:199-208 (chain ordering: read → enrich-class → enrich-parents → enrich-details → incrementViewCount → map) + ReactiveDataEntityRepositoryImpl.java:174-180 (the UPDATE statement) — severity: MEDIUM
- "**`view_count` is a hot-key UPDATE under read load — write-contention on the platform's most-read entities scales as O(reads).** Every page-view increments `data_entity.view_count` for the same row; for a high-traffic deployment with a popular entity (e.g. an ML model that hundreds of users view daily), the row sees row-level write-locks proportional to the read rate. Postgres handles this fine at small scale; at scale, the hot row becomes a write-throughput bottleneck on what is supposed to be a read-only path. There is no batching, no in-memory aggregation, no eventually-consistent counter." — evidence: ReactiveDataEntityRepositoryImpl.java:173-180 (synchronous per-call UPDATE with returningResult) + DataEntityServiceImpl.java:488-495 (one increment per request, no debounce) — severity: MEDIUM
- "**N+1-style enrichment chain — one detail fetch issues ~10 reactive sub-queries to PostgreSQL.** Breakdown per call: (1) main CTE detail select (`getDetails` at `ReactiveDataEntityRepositoryImpl.java:217-225`); (2-6) five parallel enrich-class lookups via `Mono.zip` (dependencies, last task runs, DEG entities, DEG children count, consumers count — `DataEntityServiceImpl.java:513-531`); (7) parent-DEG lookup (`enrichParentGroups` at `DataEntityServiceImpl.java:604-614`); (8-11) four parallel enrich-details lookups (metadata, dataset versions, terms, tags — `DataEntityServiceImpl.java:617-622`); (12) view-count UPDATE. **Reactor zip parallelises pairs**, so the wall-clock impact is roughly max(per-stage latency) per stage rather than a sum — but the DB connection pool faces ~10 round-trips per detail-page render. The Popular / lineage / search pages that link to detail trigger this on every hover-preload too." — evidence: DataEntityServiceImpl.java:198-208 (orchestration chain) + DataEntityServiceImpl.java:513-531 (5-zip) + DataEntityServiceImpl.java:617-622 (4-zip) + ReactiveDataEntityRepositoryImpl.java:173-180, 217-225 — severity: MEDIUM (depends on connection pool sizing)
- "**No HTTP cache headers — `ETag`, `If-Modified-Since`, `Cache-Control`, `Last-Modified` are all absent.** The detail page is the platform's hottest read; for a given entity, the payload changes only on UI mutations (description, tags, terms, ownership, metadata, status, alert config) and on collector re-ingestion. A 304-on-unchanged response with ETag-derived-from `(updated_at, view_count)` would eliminate the body transfer for most renders, but the controller emits no Cache-Control / ETag. Every refresh re-transfers the full payload AND triggers a view-count UPDATE." — evidence: DataEntityController.java:139-147 (only `.map(ResponseEntity::ok)` — no custom headers, no ETag computation) + DataEntityApi.java:873-888 (generated interface emits only `application/json` with no cache-control directive) — severity: LOW (performance optimisation, not correctness)
- "**No request-level observability — `@Timed`/`MeterRegistry`/structured-log entries absent on the platform's most-trafficked endpoint.** `DataEntityController.java:1-454` declares `@Slf4j` but no method body invokes `log.*`. A latency regression on `getDetails` shows up only as a downstream DB metric or as a user-reported slowness; the controller boundary itself is silent." — evidence: DataEntityController.java:139-147 (no instrumentation in the body) + DataEntityController.java:1-454 (zero `log.*` invocations file-wide) — severity: LOW
- "**The `mapDtoDetails` mapper applies no filtering on owner-sensitive fields — every viewer sees the same payload as the entity's owners.** `dataEntityMapper::mapDtoDetails` (`DataEntityServiceImpl.java:208`) emits the full ownership list (including the `Owner.name` of every owner — typically user-mapped names that may encode org-chart info), the full free-text description, the full custom metadata field values (operator-defined keys + values), the source URL list (operator-supplied URLs that may reach internal systems). A multi-tenant deployment cannot use this endpoint as-is to expose detail pages to external collaborators without leaking the org's owner list." — evidence: DataEntityServiceImpl.java:208 (`dataEntityMapper::mapDtoDetails`) + DataEntityDetails.java:48-141 (34-field schema, none of which is conditionally serialised based on viewer identity) — severity: MEDIUM (for multi-tenant deployments)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — under the three authenticated modes the endpoint requires authentication and nothing else (falls through to `.authenticated()` via AuthorizationCustomizer.java:29-30); under `auth.type=DISABLED` the endpoint is anonymously reachable per DisabledAuthSecurityConfiguration.java:14-17 (`permitAll()`). `S2S` is `N/A` — the S2S ingestion filter is mounted only on `/ingestion/entities` (per IngestionDataEntitiesFilter.java:21 path matcher per the class-level sidecar's S2S statement); this endpoint is at `/api/dataentities/{id}` and never sees the ingestion filter.
- **ingestion_filter_relevance**: `NO — UI/API surface at /api/dataentities/{id}, not /ingestion/entities`.
- **authorization_assertions**: [] — no `@PreAuthorize` on `DataEntityController.java:139-147`, no `@PreAuthorize` on the generated `DataEntityApi.java:873-888`, no programmatic permission check anywhere in `DataEntityService#getDetails` or downstream. The endpoint has NO entry in `SecurityConstants.SECURITY_RULES` (verified — `grep -n "dataentities" <odd-platform-repo>/odd-platform-api/src/main/java/.../auth/util/SecurityConstants.java` returns only POST/PUT/DELETE rules at lines 196-323; no GET rule for the detail path). Authorization is therefore reduced to the `pathMatchers("/**").authenticated()` fall-through at AuthorizationCustomizer.java:29-30.
- **owner_scoping**: `BYPASSES — returns full data-entity details to any authenticated caller regardless of owner` — `DataEntityController.java:139-147` passes only `dataEntityId` to the service; `DataEntityServiceImpl.java:196-209` and `ReactiveDataEntityRepositoryImpl.java:217-225` accept only `(long id)` and apply no owner predicate. There is NO `OwnerPojo owner` parameter on this path (contrast with `findByState` at `DataEntityServiceImpl.java:182-194` which DOES take an owner). This is the centerpiece embodiment of the read-collaborative posture — the most consequential bypass in the catalog.
- **data_exposure**:
  - "Full `DataEntityDetails` payload (34 fields including `ownership[]`, `internalDescription`, `externalDescription`, `tags[]`, `terms[]`, `metadataFieldValues[]`, `dataSource` (name+namespace+description), `linkedUrlList[]`, `entities[]`/`sourceList[]`/`targetList[]`/`outputList[]`/`inputList[]`, `viewCount`, `isStale`, `manuallyCreated`, `suiteUrl`, `suiteName`, `expectation`, `severity`) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/dataentities/{id}` — no role/permission gate; under `auth.type=DISABLED` this becomes anonymous to any caller able to reach the platform's port" — evidence: DataEntityDetails.java:48-141 (field list) + AuthorizationCustomizer.java:29-30 (auth-only fall-through) + DisabledAuthSecurityConfiguration.java:14-17 (DISABLED bypass)
  - "Soft-deleted entities (entities with `deleted_at IS NOT NULL`) → returned with `isStale=true` (or similar) to ANY authenticated user via the same path — same auth-only gate" — evidence: ReactiveDataEntityRepositoryImpl.java:217-225 (`.includeDeleted(true)`) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE bypasses softDelete filter when flag is true) + DataEntityDetails.java:86 (`isStale` field)
  - "Free-text fields (`internalDescription`, `externalDescription` from `DataEntityDetails.java:93-95`) are operator/collector-supplied — may carry PII (customer names, internal URLs), business-sensitive context (project codenames), or compliance-relevant content (regulated-data references); none of which is masked or redacted by the read path"
  - "Operator-supplied `metadataFieldValues[]` and `linkedUrlList[]` may include credentials-shaped fields, internal URLs, or contact info — emitted verbatim to every viewer"
  - "Resource-existence enumeration: 200 vs 404 reveals which integer IDs are populated — full catalog reconnaissance for any authenticated user (or any anonymous DISABLED-mode caller)" — evidence: DataEntityServiceImpl.java:200 (`NotFoundException` returning 404) + no rate-limit middleware
- **known_security_gaps**:
  - "**Cross-owner read of full entity details — the centerpiece read-collaborative gap.** Any authenticated user reads any data entity's full payload (ownership, descriptions, metadata, terms, tags, linked URLs, source URLs). Same shape as REFACTOR-024 (alerts), REFACTOR-053 (activity), REFACTOR-187 (search) — this is the 4th and **largest** surface; the centerpiece UI read of the platform. Strengthens the maintainer's case that ADR-CANDIDATE-003 resolves toward 'missed gate' rather than 'intentional posture' OR that the live security page must explicitly document that any authenticated user reads any entity's full details." — evidence: DataEntityController.java:139-147 + SecurityConstants.java:98-355 (no GET rule) + AuthorizationCustomizer.java:29-30 — severity: HIGH
  - "**DISABLED-mode anonymous read of the entire catalog's detail metadata.** Under default `auth.type=DISABLED` (application.yml:34), any caller able to reach the platform's HTTP port reads every entity's full DataEntityDetails. LSN-001-shape. Strengthens REFACTOR-073 (boot-time security-posture validator) by adding the highest-stakes read path to the 8-sidecar triangulation." — evidence: DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:24-30 (only wired when auth is enabled) — severity: HIGH
  - "**404-vs-403 indistinguishability enables ID-enumeration reconnaissance.** The endpoint cannot distinguish 'entity does not exist' from 'entity exists but caller has no permission to read' because there is no per-entity permission layer to make the second outcome possible. A scripted enumeration scan against `/api/dataentities/{1..N}` discovers the full populated ID space, mapped to entity classes / types / data sources / soft-delete state. Mitigated only by sequential integer IDs (which a determined attacker enumerates linearly anyway) and the absence of rate-limiting." — evidence: DataEntityServiceImpl.java:200 + no rate-limit in the chain — severity: MEDIUM
  - "**View-count is an unauthenticated-write surface — any authenticated user (or any anonymous DISABLED-mode caller) can inflate any entity's `view_count` arbitrarily.** A scripted loop pushes any chosen entity to the top of `getPopular`'s ranking. The Popular panel on the catalog overview is the first signal new users see; a malicious actor can game it to promote a misleading entity. No rate-limit, no idempotency, no per-IP throttle." — evidence: DataEntityServiceImpl.java:199-208 + ReactiveDataEntityRepositoryImpl.java:174-180 (unconditional increment on every successful read) + DataEntityController.java:308-313 (the `getPopular` consumer) — severity: MEDIUM
  - "**Soft-deleted entities readable without acknowledgement — operators expecting a soft-delete to make the entity 'go away from the API surface' get the opposite behaviour.** The `includeDeleted(true)` flag at `ReactiveDataEntityRepositoryImpl.java:220` is undocumented externally; the live deletion docs (if any) do not state that the detail GET continues to surface deleted entities. Under regulated-data deletion requirements (GDPR right-to-erasure, etc.), a soft-delete that still emits the full payload to authenticated users is not a deletion." — evidence: ReactiveDataEntityRepositoryImpl.java:217-225 + DataEntityDetails.java:86 (`isStale` field) — severity: MEDIUM (regulated environments)

## performance

- **hot_paths**:
  - "`GET /api/dataentities/{id}` is the single hottest endpoint on the platform — every entity-detail page mount, every tab-switch that reloads the entity context, every deep-link, every browser refresh. Backend cost per call: 1 CTE select (multi-JOIN over data_entity + namespace + datasource + entity-class join + ...; see `baseDimensionsSelect` at `ReactiveDataEntityRepositoryImpl.java:888-907`) + 5 parallel reactive lookups (enrich-class) + 1 parent-DEG lookup + 4 parallel reactive lookups (enrich-details) + 1 UPDATE statement (view-count). Wall-clock latency dominated by max-of-parallel + sequential UPDATE." — evidence: DataEntityController.java:139-147 + DataEntityServiceImpl.java:196-209 (orchestration) + ReactiveDataEntityRepositoryImpl.java:217-225 (CTE) + DataEntityServiceImpl.java:513-531 (5-zip) + DataEntityServiceImpl.java:617-622 (4-zip) + DataEntityServiceImpl.java:488-495 (view-count increment)
- **throughput_characteristics**:
  - "Non-blocking reactive chain — uses `Mono<...>` end to end; per-call thread is not held during DB await" — evidence: DataEntityController.java:140 (`Mono<ResponseEntity<DataEntityDetails>>`) + DataEntityServiceImpl.java:198 (`Mono<DataEntityDetails>`)
  - "Inside one `@ReactiveTransactional` boundary — read + view-count UPDATE share a single transaction; cannot interleave a read from an inner transaction without commit/rollback overhead" — evidence: DataEntityServiceImpl.java:197
  - "No request-batching — N concurrent detail-page renders issue N separate transactions; no debounce, no deduplication of the same `dataEntityId` within a request window" — evidence: DataEntityServiceImpl.java:198-208 (single-id signature; no batch variant)
- **resource_allocation**:
  - "~10 reactive sub-queries to PostgreSQL per call — 5 parallel enrich-class + 1 parent-DEG + 4 parallel enrich-details + 1 main CTE + 1 UPDATE. Reactor zip parallelises in pairs but the connection-pool peak per request is N+1 connections momentarily; sizing of the R2DBC pool gates concurrency." — evidence: DataEntityServiceImpl.java:198-208 + 513-531 + 604-614 + 617-622 + 488-495
  - "No in-memory caching at the service or controller layer — every call re-hits the DB; no `Caffeine`, no `@Cacheable`, no manual cache map" — evidence: grep on `<odd-platform-repo>/odd-platform-api/src/main/java/.../service/DataEntityServiceImpl.java` for `Cache|Cacheable|CacheManager` returned ZERO matches
  - "No response-body caching at the HTTP layer — no ETag / Last-Modified / Cache-Control headers emitted by the controller" — evidence: DataEntityController.java:139-147 (only `.map(ResponseEntity::ok)`) + DataEntityApi.java:873-888 (generated emits only application/json, no cache directives)
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally; the bottleneck is the shared PostgreSQL row-level write-lock on `data_entity.view_count` for popular entities" — evidence: DataEntityController.java:1-454 (no instance state beyond injected singletons) + ReactiveDataEntityRepositoryImpl.java:174-180 (per-call UPDATE on the same row)
  - "Row-level write-contention on `view_count` — popular entities receive O(reads) UPDATEs/sec on the same row; Postgres handles this but it becomes a write-throughput bottleneck on what is nominally a read path" — evidence: ReactiveDataEntityRepositoryImpl.java:174-180
  - "Cursor / pagination: N/A — this is a single-id fetch; the payload size is bounded by the entity's metadata, tags, terms, dataset-version count, and DEG-membership cardinality; no pagination is exposed" — evidence: DataEntityController.java:139-147 (no page/size parameters)
  - "Lineage shortcuts in the payload (`sourceList`/`targetList`/`outputList`/`inputList`/`entities`/`datasetsList`) are unbounded — a DEG with 10K children produces a 10K-row `entities` array in the response; no `@Size(max=...)` on these fields in the generated `DataEntityDetails.java`" — evidence: DataEntityDetails.java:108-127 (these are `List<@Valid DataEntityRef>` with no max-size constraint)
- **known_performance_gaps**:
  - "**View-count UPDATE on the hottest read makes a GET endpoint write-bound under load — the platform's most-popular entity becomes a row-level write-lock hotspot.** Every page view increments the same row; at scale this contends with concurrent writes. Mitigation options unimplemented today: (a) batch the increment via an async queue, (b) sample-and-aggregate (increment with probability 1/N), (c) move view-count to a separate counter table or to an eventually-consistent in-memory counter flushed periodically." — evidence: ReactiveDataEntityRepositoryImpl.java:174-180 + DataEntityServiceImpl.java:488-495 (synchronous unconditional increment) — severity: MEDIUM
  - "**~10 DB round-trips per detail-page render with no caching — the most-used endpoint is also the most DB-intensive read in the system.** A Caffeine cache keyed by `dataEntityId` with a short TTL (e.g. 30s) and invalidation on the entity's mutation endpoints would cut detail-page DB load by ~90% for repeated views, at the cost of cache-coherence complexity." — evidence: DataEntityServiceImpl.java:196-209 + grep for `@Cache|CacheManager` returned ZERO matches — severity: MEDIUM
  - "**No HTTP cache headers — every refresh re-transfers the full payload AND triggers a view-count UPDATE.** ETag derived from `(updated_at, view_count)` (or just `updated_at` if view-count must increment on every render) plus `Cache-Control: max-age=10` would handle browser-cache 304s without altering the view-count contract." — evidence: DataEntityController.java:139-147 (no headers) + DataEntityApi.java:873-888 (no cache directives in generated) — severity: LOW
  - "**Unbounded `entities[]` / `sourceList[]` / `targetList[]` / `outputList[]` / `inputList[]` / `datasetsList[]` lineage-shortcut arrays in the response — a DEG / hub-entity with 10K linked references emits a 10K-row response body.** No paging, no truncation, no `@Size(max=...)` constraint." — evidence: DataEntityDetails.java:108-127 — severity: LOW (depends on graph density)
  - "**No request observability at the controller boundary — `@Timed` / Micrometer counters / MDC log entries absent on the platform's single hottest endpoint.** Latency regressions are visible only via downstream DB / connection-pool metrics. The `@Slf4j` annotation on `DataEntityController.java:68` provides a `log` field that is never invoked in this method (or any other in the file)." — evidence: DataEntityController.java:139-147 (no instrumentation) + DataEntityController.java:1-454 (zero `log.*` invocations file-wide) — severity: LOW
  - "**Hot-key contention on `view_count` defeats read replicas — a deployment that adds Postgres read replicas cannot route this GET to a replica because of the inline UPDATE.** The endpoint is permanently primary-only at the DB layer." — evidence: DataEntityServiceImpl.java:197 (`@ReactiveTransactional` + the UPDATE in the same chain) — severity: LOW (deployment-shape concern)

## sources

- understanding ← DataEntityController.java:139-147 (the four-line delegation) + DataEntityServiceImpl.java:196-209 (the orchestration) + ReactiveDataEntityRepositoryImpl.java:217-225 (the CTE + `.includeDeleted(true)`) + DataEntityDetails.java:48-141 (the 34-field schema) + AuthorizationCustomizer.java:29-30 (the auth-only fall-through)
- concepts.entities ← DataEntityDetails.java:48-141 (field-by-field enumeration) + DataEntityServiceImpl.java:200 (NotFoundException construction) + ReactiveDataEntityRepositoryImpl.java:220 (`.includeDeleted(true)`)
- concepts.operations ← DataEntityController.java:139-147 + DataEntityServiceImpl.java:196-209 + DataEntityServiceImpl.java:488-495 (incrementViewCount) + DataEntityServiceImpl.java:513-531 (5-zip enrich-class) + DataEntityServiceImpl.java:604-614 (enrich-parents) + DataEntityServiceImpl.java:616-631 (4-zip enrich-details) + ReactiveDataEntityRepositoryImpl.java:174-180 (UPDATE) + ReactiveDataEntityRepositoryImpl.java:217-225 (CTE)
- concepts.invariants[0] ← DataEntityServiceImpl.java:197 (`@ReactiveTransactional`) + DataEntityServiceImpl.java:207 (`.flatMap(this::incrementViewCount)`) + ReactiveDataEntityRepositoryImpl.java:174-180 (the UPDATE)
- concepts.invariants[1] ← ReactiveDataEntityRepositoryImpl.java:220 (`.includeDeleted(true)`) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE branching on the flag) + ReactiveDataEntityRepositoryImpl.java:918 (`DATA_ENTITY.HOLLOW.isFalse()` guard inside the CTE)
- concepts.invariants[2] ← DataEntityServiceImpl.java:197 (`@ReactiveTransactional`)
- concepts.invariants[3] ← DataEntityController.java:139-147 (no principal arg) + DataEntityServiceImpl.java:198 (`getDetails(long id)` signature — no owner) + ReactiveDataEntityRepositoryImpl.java:217-225 (no owner predicate in the CTE config)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (status 200, 2026-05-12) — fetched_excerpt under `docs_link_semantic.inferred_docs[1]`
- dependencies_semantic.requires-feature ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` (status 200, 2026-05-12) + WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (status 200, 2026-05-12) + DataEntityController.java:308-313 (the `getPopular` view-count consumer)
- dependencies_semantic.requires-runtime ← DataEntityServiceImpl.java:197 (@ReactiveTransactional) + DataEntityServiceImpl.java:198-208 (Mono chain) + ReactiveDataEntityRepositoryImpl.java:174-180 + ReactiveDataEntityRepositoryImpl.java:217-225
- dependencies_semantic.couples-to ← DataEntityApi.java:873-888 (generated) + DataEntityServiceImpl.java:196-209 + ReactiveDataEntityRepositoryImpl.java:173-180, 217-225 + DataEntityServiceImpl.java:617-622 (4-way enrichment) + AuthorizationCustomizer.java:24-30
- tests_coverage_semantic.covered_behaviours ← DataEntityStatusChangeTest.java:38, 46, 73-80 (the only test exercising `GET /api/dataentities/{id}`)
- tests_coverage_semantic.uncovered_behaviours ← absence-based: `grep -n 'getDetails\|getDataEntityDetails' <odd-platform-repo>/odd-platform-api/src/test/java/.../service/DataEntityServiceTest.java` returned zero matches (no service-layer unit test) + `find <odd-platform-repo>/odd-platform-api/src/test/java -name 'DataEntityController*'` returned no matches (no dedicated controller test)
- tests_coverage_semantic.test_files ← DataEntityStatusChangeTest.java:73-80 (`getDetails` helper) + DataEntityServiceTest.java:48-end (exists but does NOT cover `getDetails`)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery` 2026-05-12, status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` 2026-05-12, status 200
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-12, status 200
- docs_link_semantic.doc_drift_findings[0] ← live docs absence-of-statement (all three WebFetches 2026-05-12 confirm no published rule on read-endpoint posture) + SecurityConstants.java:98-355 (code: no GET rule) + AuthorizationCustomizer.java:29-30 (code: auth-only fall-through)
- docs_link_semantic.doc_drift_findings[1] ← DataEntityDetails.java:48-141 (34 fields) vs WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` 2026-05-12 (5 fields named)
- docs_link_semantic.doc_drift_findings[2] ← ReactiveDataEntityRepositoryImpl.java:174-180 (the UPDATE) + WebFetch results (no live page mentions the side-effect)
- implicit_adrs[0] ← SecurityConstants.java:98-355 (no GET rule) + AuthorizationCustomizer.java:24-30 (fall-through) + the 27+ GET endpoints on DataEntityController carry the same posture per the class-level sidecar invariants[3]
- implicit_adrs[1] ← ReactiveDataEntityRepositoryImpl.java:217-225 (`.includeDeleted(true)`) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE branches) + DataEntityDetails.java:86 (`isStale` field paired with the includeDeleted decision)
- implicit_adrs[2] ← DataEntityServiceImpl.java:197 (`@ReactiveTransactional`) + DataEntityServiceImpl.java:207 (`.flatMap(this::incrementViewCount)`) + DataEntityServiceImpl.java:488-495 (the increment method) + DataEntityController.java:308-313 (the consumer of view_count)
- implicit_adrs[3] ← DataEntityServiceImpl.java:513-531 (5-way zip) + DataEntityServiceImpl.java:616-631 (4-way zip)
- bugs_limitations_corner_cases[0] ← DataEntityController.java:139-147 + DataEntityApi.java:873-888 + SecurityConstants.java:98-355 (no rule) + AuthorizationCustomizer.java:29-30 + cross-reference with REFACTOR-024 / REFACTOR-053 / REFACTOR-187 in `lineage/odd-platform/refactoring-scopes.md`
- bugs_limitations_corner_cases[1] ← DataEntityServiceImpl.java:200 (NotFoundException → 404) + no rate-limit in AuthorizationCustomizer.java + sequential integer IDs (verified — the `DATA_ENTITY.ID` is a serial primary key per Liquibase migrations)
- bugs_limitations_corner_cases[2] ← DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:29-30 + cross-reference with 8-sidecar DISABLED-bypass triangulation in `lineage/odd-platform/implicit-adrs.md`
- bugs_limitations_corner_cases[3] ← DataEntityServiceImpl.java:197 (`@ReactiveTransactional`) + DataEntityServiceImpl.java:198-208 (chain ordering) + ReactiveDataEntityRepositoryImpl.java:173-180 + DataEntityController.java:308-313 (the popular-ranking consumer)
- bugs_limitations_corner_cases[4] ← ReactiveDataEntityRepositoryImpl.java:173-180 (per-call UPDATE on the same row)
- bugs_limitations_corner_cases[5] ← DataEntityServiceImpl.java:198-208 + 513-531 + 604-614 + 617-622 + 488-495 (full chain count)
- bugs_limitations_corner_cases[6] ← DataEntityController.java:139-147 (no header customisation) + DataEntityApi.java:873-888 (generated emits no cache directives)
- bugs_limitations_corner_cases[7] ← DataEntityController.java:139-147 + DataEntityController.java:1-454 (zero `log.*` body invocations file-wide; `@Slf4j` at line 68 unused)
- bugs_limitations_corner_cases[8] ← DataEntityServiceImpl.java:208 (`dataEntityMapper::mapDtoDetails`) + DataEntityDetails.java:48-141 (no field-level conditional serialisation)
- security.auth_mode_relevance ← DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:24-30 + IngestionDataEntitiesFilter (S2S) only on `/ingestion/entities` per class-level sidecar
- security.authorization_assertions ← DataEntityController.java:139-147 + DataEntityApi.java:873-888 + SecurityConstants.java:98-355 (grep for `dataentities` in SECURITY_RULES returns only POST/PUT/DELETE rules)
- security.owner_scoping ← DataEntityController.java:139-147 (no owner param) + DataEntityServiceImpl.java:196-209 (no owner param) + ReactiveDataEntityRepositoryImpl.java:217-225 (no owner predicate) + contrast with DataEntityServiceImpl.java:182-194 (`findByState` DOES take `OwnerPojo owner`)
- security.data_exposure ← DataEntityDetails.java:48-141 (34-field schema) + ReactiveDataEntityRepositoryImpl.java:217-225 (`.includeDeleted(true)`) + DataEntityServiceImpl.java:200 (404 branch)
- security.known_security_gaps.[0] ← DataEntityController.java:139-147 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30 + cross-reference with REFACTOR-024 / REFACTOR-053 / REFACTOR-187
- security.known_security_gaps.[1] ← DisabledAuthSecurityConfiguration.java:9-19 + AuthorizationCustomizer.java:24-30 (only wired when auth.type is non-DISABLED)
- security.known_security_gaps.[2] ← DataEntityServiceImpl.java:200 (404 path) + no rate-limit
- security.known_security_gaps.[3] ← DataEntityServiceImpl.java:199-208 + ReactiveDataEntityRepositoryImpl.java:174-180 (unconditional increment) + DataEntityController.java:308-313 (consumer)
- security.known_security_gaps.[4] ← ReactiveDataEntityRepositoryImpl.java:217-225 + DataEntityDetails.java:86 (`isStale`)
- performance.hot_paths.[0] ← DataEntityController.java:139-147 + DataEntityServiceImpl.java:196-209 + ReactiveDataEntityRepositoryImpl.java:217-225 + DataEntityServiceImpl.java:513-531 + 617-622 + 488-495
- performance.throughput_characteristics ← DataEntityController.java:140 + DataEntityServiceImpl.java:197-198
- performance.resource_allocation ← DataEntityServiceImpl.java:198-208 (sub-query count) + grep for `Cache|Cacheable` zero matches + DataEntityController.java:139-147 (no header customisation)
- performance.scaling_characteristics ← DataEntityController.java:1-454 (stateless) + ReactiveDataEntityRepositoryImpl.java:174-180 (per-call UPDATE) + DataEntityDetails.java:108-127 (unbounded list fields)
- performance.known_performance_gaps.[0] ← ReactiveDataEntityRepositoryImpl.java:174-180 + DataEntityServiceImpl.java:488-495
- performance.known_performance_gaps.[1] ← DataEntityServiceImpl.java:196-209 + zero `@Cache` annotations
- performance.known_performance_gaps.[2] ← DataEntityController.java:139-147 + DataEntityApi.java:873-888
- performance.known_performance_gaps.[3] ← DataEntityDetails.java:108-127
- performance.known_performance_gaps.[4] ← DataEntityController.java:139-147 + DataEntityController.java:1-454 (zero `log.*`)
- performance.known_performance_gaps.[5] ← DataEntityServiceImpl.java:197 (transactional containment of the UPDATE)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — appended after each layer-5 probe-run that touches this node's contributing-features. Each entry cites a probe-run artefact under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->

- probe_id: P-001
  probe_run_id: R-20260519T014121Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T01:41:21+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T014819Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T01:48:19+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T015052Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T01:50:52+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T015056Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T01:50:56+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T015058Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T01:50:58+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T015104Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T01:51:04+00:00
  verdict: "all assertions passed"
