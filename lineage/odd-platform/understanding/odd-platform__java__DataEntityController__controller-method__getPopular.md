---
node_id: "odd-platform java DataEntityController controller-method:getPopular"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-13-G
---

# DataEntityController#getPopular — semantic understanding

## understanding

`getPopular` (`GET /api/dataentities/popular`) is the **read-side closure of the view_count loop opened by `getDataEntityDetails`** — the "most popular data entities throughout the catalog" surface, consumed by the UI's Overview/recommendations strip (`odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:177-184`, `dataEntityApi.getPopular({page, size})`). The method is a four-line pass-through (`DataEntityController.java:307-313`) to `dataEntityService.listPopular(page, size)` (`DataEntityServiceImpl.java:227-231`) which is itself a one-line pass-through to `reactiveDataEntityRepository.listPopular(page, size)` (`ReactiveDataEntityRepositoryImpl.java:629-649`). The repository builds a CTE with `DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC)` as the sole ranking signal — meaning the ordering is **exclusively** a function of the counter that `getDataEntityDetails` increments on every read (`getDataEntityDetails.md:implicit_adrs.[2]`). Combined with the absence of (a) any rate-limit on the detail-read, (b) any authorization gate on either endpoint, and (c) any anti-abuse signal in the ranking, the loop is **trivially inflatable** by any authenticated caller (and any anonymous caller under `auth.type=DISABLED`): a scripted loop of `GET /api/dataentities/{id}` calls pushes any chosen entity to the top of `GET /api/dataentities/popular` with no resistance. This **confirms REFACTOR-201 from primary source.**

## concepts

- entities: [
    "`DataEntityRef` (response payload — 9 fields: id, oddrn, externalName, internalName, entityClasses[], manuallyCreated, status, isStale, hasAlerts; assembled by `DataEntityMapperImpl.mapReference` at `DataEntityMapperImpl.java:533-549`; `view_count` itself is NOT surfaced in the response — only used for ordering)",
    "`DataEntityRefList` (the OpenAPI schema returned at `components.yaml:925-928` — a bare `array of DataEntityRef`, no wrapper, NO `pageInfo` object — pagination state is opaque to the client)",
    "`DATA_ENTITY.VIEW_COUNT` (the bigint counter at `data_entity.view_count`, added by Liquibase V0_0_10 with `DEFAULT 0`; made `NOT NULL` by V0_0_37; **NO index** — verified by `grep -rn 'view_count' <odd-platform-repo>/odd-platform-api/src/main/resources/db/migration` returning only the column-add and NOT-NULL constraint migrations)",
    "`DataEntityCTEQueryConfig` — the builder pattern used to parameterise `cteDataEntitySelect` (limitOffset + orderBy + optional FTS + optional includeDeleted; `ReactiveDataEntityRepositoryImpl.java:631-634`)",
    "`hasAlerts` subquery (`ReactiveDataEntityRepositoryImpl.java:866-870` — `DSL.exists(... ALERT.DATA_ENTITY_ODDRN.eq(...) AND ALERT.STATUS = OPEN ...)`) — adds an EXISTS per CTE row to compute the `has_alerts` boolean returned to the client"
  ]
- operations: [
    "controller delegate: `dataEntityService.listPopular(page, size)` (DataEntityController.java:311) wrapped in `Mono.just(...)` then `.map(ResponseEntity::ok)` — note: the inner `Flux<DataEntityRef>` is wrapped in a `Mono<ResponseEntity<Flux<DataEntityRef>>>` (streaming body)",
    "service delegate: `reactiveDataEntityRepository.listPopular(page, size).map(dataEntityMapper::mapRef)` (DataEntityServiceImpl.java:228-231) — NO `@ReactiveTransactional`, NO enrichment, NO auth filter, NO owner predicate",
    "repository: build CTE with `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))` + `.limitOffset(LimitOffset(size, (page-1)*size))`; call `cteDataEntitySelect(cteConfig)` (which applies addSoftDeleteFilter + HOLLOW.isFalse but NOT EXCLUDE_FROM_SEARCH); select CTE columns + `hasAlerts(deCte)`; outer `orderBy(getOrderFields(cteConfig, deCte))` which adds the `DATA_ENTITY.ID.desc()` tiebreaker (ReactiveDataEntityRepositoryImpl.java:629-649)",
    "result mapping: `dataEntityDtoMapper::mapDtoRecordFromCTE` → `DataEntityDto` → `dataEntityMapper::mapRef` → `DataEntityRef` (9-field projection at DataEntityMapperImpl.java:533-549)"
  ]
- invariants: [
    "ranking is exclusively `view_count DESC, id DESC` — no signal-mixing, no time-decay, no per-class weighting, no recency, no popularity-among-the-caller's-team, no ownership filter (ReactiveDataEntityRepositoryImpl.java:633 sole orderBy + getOrderFields tiebreaker at :945-967)",
    "soft-deleted entities are excluded: `cteConfig` does NOT set `.includeDeleted(true)` so `cteDataEntitySelect` line 916 applies `addSoftDeleteFilter` which adds `DATA_ENTITY.STATUS.ne(DELETED.getId())` (line 121-122)",
    "hollow entities are excluded: `cteDataEntitySelect` line 918 unconditionally adds `DATA_ENTITY.HOLLOW.isFalse()`",
    "**`EXCLUDE_FROM_SEARCH` is NOT applied** — the popular query surfaces entities marked `exclude_from_search=true` (a flag widely respected by search/facets/statistics — see `ReactiveSearchEntrypointRepositoryImpl.java:91, 117, 149, 181, 555` and `ReactiveSearchFacetRepositoryImpl.java:167, 461, 575` and `JooqFTSHelper.java:149`) — the popular ranking is the sole list-shaped surface that ignores it",
    "no per-user / per-owner / per-namespace filter — same payload returned to every authenticated caller (no `OwnerPojo` parameter on any layer of the chain)",
    "no authorization gate — no `@PreAuthorize` on controller method, no `@PreAuthorize` on generated `DataEntityApi#getPopular`, no entry in `SecurityConstants.SECURITY_RULES` for `GET /api/dataentities/popular` — falls through to `pathMatchers(\"/**\").authenticated()` at `AuthorizationCustomizer.java:29-30`",
    "the controller never reads `ServerWebExchange.exchange` — the parameter exists only to satisfy the OpenAPI-generated `DataEntityApi#getPopular(Integer, Integer, ServerWebExchange)` signature (DataEntityController.java:307-313)",
    "**page-1 indexed** — `LimitOffset(size, (page-1)*size)` at line 632; passing `page=0` yields a negative offset (Postgres rejects, the call errors). The OpenAPI spec at `openapi.yaml:877-893` declares the parameter shape but does NOT enforce a minimum at the spec layer — verified by lines 882-884 which only `$ref` PageParam/SizeParam with no constraint annotation visible at this offset"
  ]
- audiences: [
    "ODD Platform UI — `Overview/Overview.tsx` (the platform's home page) consumes `fetchPopularDataEntitiesList` from `dataentities.thunks.ts:177-184` via `dataEntityApi.getPopular({page, size})`, surfacing a strip of the most-viewed entities on the catalog home (per the live catalog-overview doc fetched in batch F: 'Catalog Overview page and Directory as discovery mechanisms')",
    "third-party API consumers calling `GET /api/dataentities/popular` for dashboards / weekly digests / 'trending' integrations"
  ]

## dependencies_semantic

- requires-feature: [
    "data-discovery feature — Popular strip is a recommendation surface on the catalog Overview page (per the live `catalog-overview` doc text in `getDataEntityDetails.md:docs_link_semantic.inferred_docs[1].fetched_excerpts` from batch F, not re-fetched this session)",
    "view_count tracking — depends on `getDataEntityDetails` to populate the counter via the read-as-write side-effect (`getDataEntityDetails.md:implicit_adrs.[2]`). Without `getDataEntityDetails` traffic, `view_count` stays at the migration-default 0 and the ranking degenerates to `id DESC` (which means the most-recently-ingested entities surface as 'popular')"
  ]
- requires-config: [] — N/A (method reads no config keys; behaviour is fixed at compile time; no `@Value`, no `@ConditionalOnProperty` on any layer of the chain)
- requires-runtime: [
    "Spring WebFlux + reactor — `Flux<DataEntityRef>` return type at DataEntityController.java:308; `Mono.just(...)` wrapper at DataEntityController.java:311",
    "jOOQ reactive operations — `jooqReactiveOperations.flux(select)` at ReactiveDataEntityRepositoryImpl.java:647",
    "PostgreSQL — `data_entity` table with the `view_count` bigint column (NOT NULL, DEFAULT 0; **no index** — verified across all 91 migration files); the CTE materialisation is a non-materialised `DSL.with(...).as(...)` (line 640-641 uses `.as(...)` not `.asMaterialized(...)`)",
    "**NO `@ReactiveTransactional` boundary** — contrast with `getDataEntityDetails` which is transactional; the read here is a single SELECT, no side-effect, no `incrementViewCount` step"
  ]
- couples-to: [
    "`DataEntityApi#getPopular` (generated from `odd-platform-specification/openapi.yaml:877-893` — `GET /api/dataentities/popular`; required `page` (int32) + `size` (int32) query params via `PageParam` / `SizeParam` $ref; no `@PreAuthorize` / `@Secured` annotation; no security definition on the operation)",
    "`DataEntityService#listPopular(int, int)` (DataEntityServiceImpl.java:227-231)",
    "`ReactiveDataEntityRepository#listPopular(int, int)` (ReactiveDataEntityRepositoryImpl.java:629-649)",
    "`DataEntityMapper#mapRef(DataEntityDto)` → `mapReference(...)` (DataEntityMapperImpl.java:441-442, :529-548) — emits 9 fields including `isStale` computed by `dataEntityStaleDetector.isDataEntityStale(pojo)` and `hasAlerts` lifted from the CTE-side `EXISTS` subquery",
    "`DataEntityDtoMapper#mapDtoRecordFromCTE` (DataEntityServiceImpl.java:629 → :648 mapping step; converts the raw jOOQ Record into the DataEntityDto pojo wrapper)",
    "`getDataEntityDetails` (DataEntityController.java:139-147) — the upstream producer of `view_count` increments via `incrementViewCount` (ReactiveDataEntityRepositoryImpl.java:173-180); this method is the consumer that surfaces the resulting ranking",
    "`AuthorizationCustomizer` (`AuthorizationCustomizer.java:24-30`) — sole authorization layer; this GET path falls through to `.pathMatchers(\"/**\").authenticated()`",
    "`Overview/Overview.tsx` (UI consumer via `fetchPopularDataEntitiesList` thunk at `dataentities.thunks.ts:177-184`)"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A
- uncovered_behaviours: [
    "happy-path ranking correctness — no test asserts that an entity with higher `view_count` ranks above an entity with lower `view_count`",
    "pagination math — no test asserts `(page-1)*size` correctness; no test asserts `page=0` behaviour (Postgres rejects a negative offset — the endpoint emits a 500 today; the OpenAPI spec does NOT enforce `minimum: 1`)",
    "tiebreaker semantics — no test asserts that two entities with identical `view_count` are ordered by `id DESC` (the second orderBy applied by `getOrderFields` at line 963)",
    "soft-delete exclusion — no test asserts that a soft-deleted entity (STATUS=DELETED) with a high view_count is NOT in the popular list (the inverse — that the addSoftDeleteFilter at line 121-122 fails open — is the regression to catch)",
    "hollow exclusion — no test asserts that a `HOLLOW=true` entity is excluded from popular (line 918)",
    "**exclude-from-search inclusion** — no test asserts the CURRENT behaviour (entities marked `exclude_from_search=true` ARE included in popular), nor does any test surface this as a documented inconsistency vs the search endpoints",
    "view-count-zero handling — no test asserts that newly-ingested entities (view_count=0 from migration default) tie-break by `id DESC` (most-recently-ingested first), nor that this is the intentional pre-traffic ranking",
    "auth gate — no test asserts that an unauthenticated caller under LOGIN_FORM/OAUTH2/LDAP gets 401, nor that any authenticated caller gets 200",
    "DISABLED-mode anonymous read — no test asserts `auth.type=DISABLED` produces 200 for an unauthenticated caller (the current behaviour per the 8-sidecar DISABLED-bypass triangulation captured in `getDataEntityDetails.md:bugs_limitations_corner_cases.[2]`)",
    "**inflation-attack regression** — no test asserts that 1000 sequential `GET /api/dataentities/{1}` calls from a single authenticated caller pushes entity 1 to position 0 in `getPopular` (this is the REFACTOR-201 inflatability surface; a future rate-limit / authz / sampling change needs this test to confirm the regression is closed)",
    "response shape correctness — no test asserts the 9-field `DataEntityRef` projection (id, oddrn, externalName, internalName, entityClasses[], manuallyCreated, status, isStale, hasAlerts) is complete and that `view_count` is NOT surfaced to the client",
    "`hasAlerts` correctness — no test asserts that an entity with an OPEN alert reports `hasAlerts=true` in the popular list (the EXISTS subquery at lines 866-870)"
  ]
- test_files: [
    "`<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceTest.java` — verified by `grep -n 'listPopular\\|getPopular' <odd-platform-repo>/odd-platform-api/src/test/java/.../service/DataEntityServiceTest.java` returning ZERO matches",
    "no `DataEntityControllerTest.java` exists — verified by `find <odd-platform-repo>/odd-platform-api/src/test -name 'DataEntityController*'` returning no matches",
    "no `@WebFluxTest` or `@SpringBootTest` covers `GET /api/dataentities/popular` — verified by `grep -rn 'listPopular\\|getPopular' <odd-platform-repo>/odd-platform-api/src/test` returning ZERO matches"
  ]
- gaps: |
    The Popular ranking — the surface that the platform's home page uses to introduce new users to "what's popular here" — has **zero test coverage at every layer**: not the controller, not the service, not the repository. The ranking signal is a single column (`view_count`) populated by a single producer (`getDataEntityDetails`) with no anti-abuse signal anywhere in the pipeline. A regression that (a) flips the soft-delete filter, (b) flips the hollow filter, (c) accidentally orders by `view_count ASC` instead of DESC, (d) drops the `(page-1)*size` math, or (e) introduces an injection vector through the page/size parameters would silently change the home-page first impression of the entire platform with no test failing. The most consequential regression to catch is the **inflation-attack surface**: a future rate-limit on `getDataEntityDetails`, a future authz gate on `getPopular`, or a future ranking-signal hardening (sampling, time-decay, owner-scoped popularity) needs a test that loops 1000 calls and asserts the chosen entity does NOT reach the top — without that test, the hardening is unverifiable. A `@WebFluxTest(DataEntityController.class)` suite asserting (1) ranking by view_count DESC, (2) soft-deleted entities are excluded, (3) hollow entities are excluded, (4) the current `exclude_from_search` inclusion is intentional (or that a future fix excludes them), (5) `page=0` returns 400 not 500, (6) ranking is stable under tie (id DESC), and (7) inflation by repeated detail-reads is the existing behaviour (regression catcher for any future hardening) would close the gap.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation on the controller method (verified by reading DataEntityController.java:307-313 and the file head); no `@docs` annotation on the service or repository implementation either (verified by reading DataEntityServiceImpl.java:227-231 and ReactiveDataEntityRepositoryImpl.java:629-649)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: ""
    rationale: "Catalog Overview page — surfaces the 'Popular' recommendation strip; same page batch F (getDataEntityDetails sidecar) cited as the sole live mention of the per-entity Overview tab and the Popular recommendations panel. Carrying that anchor forward — NOT re-fetching per the user's explicit 'no WebFetch this run' guard (prior attempt timed out)."
    last_verified_at: "2026-05-12T00:00:00Z (batch F)"
    last_verified_status: "not-verified-this-session — carried from `getDataEntityDetails.md:docs_link_semantic.inferred_docs[1]` (verified live at 200 in batch F)"
    confidence: LOW
    fetched_excerpts: |
      Carried verbatim from batch F (`getDataEntityDetails.md:docs_link_semantic.inferred_docs[1].fetched_excerpts`):
      "The per-entity **Overview tab** is the landing tab inside any data entity's detail page — entity description, owners, tags, terms, custom metadata."
      Batch F also recorded that the page does NOT state any access-control or per-user filtering on entity detail viewing — equally relevant here for the popular ranking.
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "Data Discovery section — the discovery feature umbrella that Popular sits inside"
    last_verified_at: "2026-05-12T00:00:00Z (batch F)"
    last_verified_status: "not-verified-this-session — carried from batch F"
    confidence: LOW
    fetched_excerpts: |
      Carried from batch F (`getDataEntityDetails.md:docs_link_semantic.inferred_docs[0].fetched_excerpts`):
      "Data Discovery section's role as an entry point for locating entities through search and browsing"
      The page does NOT describe the Popular ranking signal, the view_count semantics, or any abuse-resistance guarantees.
- doc_drift_findings:
  - "**The Popular ranking signal is undocumented externally.** The OpenAPI spec (`openapi.yaml:877-893`) names the endpoint 'Get popular entities' with description 'Returns list of the most popular data entities throughout the catalog' — but 'popular' is undefined. The live catalog-overview page (per batch F's WebFetch) mentions Popular as a recommendation surface but does not describe **how** popularity is measured. Operators / third-party consumers cannot determine from docs that ranking is exclusively `view_count DESC` and that `view_count` is incremented on every `GET /api/dataentities/{id}` call. The doc-drift here is the same shape as `getDataEntityDetails.md:doc_drift_findings.[2]` (the view-count side-effect itself is undocumented) — this sidecar surfaces the consumer-side of that gap."
  - "**The inflation-attack surface is undocumented.** Live docs do not warn operators that a malicious authenticated user (or any anonymous caller under DISABLED) can game the Popular ranking by scripting detail-page reads. An operator deploying ODD as a public-facing catalog has no published signal that the home-page recommendation surface is trivially manipulable. Per the read-collaborative blast-radius family (REFACTOR-024 alerts + REFACTOR-053 activity + REFACTOR-187 search + REFACTOR-201 getDataEntityDetails-as-write), the popular ranking is the **public-facing consequence** of the read-as-write decision — the closure of the loop opened by `getDataEntityDetails`."
  - "**`view_count` is not surfaced in the popular response payload** — `DataEntityRef` (components.yaml:894-924, 9 fields) does NOT include `view_count`, even though it's the sole ranking signal. The client therefore has no way to display 'X views' on the popular strip, no way to detect a sudden ranking jump, no way to surface the inflation signal client-side. Whether this is intentional (hide the signal to discourage gaming) or accidental (the response shape predates the popular use-case) is not documented."

## implicit_adrs

- "**Popular ranking signal is `view_count DESC` exclusively — no signal-mixing, no time-decay, no anti-abuse.** `ReactiveDataEntityRepositoryImpl.java:633` builds `cteConfig` with `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))` as the SOLE ordering signal (the secondary `DATA_ENTITY.ID.desc()` at line 963 is only a tiebreaker). Combined with the read-as-write `incrementViewCount` in `getDataEntityDetails` (`getDataEntityDetails.md:implicit_adrs.[2]`), this is the consumer half of the view-count loop. The decision: the simplest possible 'popularity' definition (cumulative reads), accepting that it conflates legitimate interest with bot traffic, hot-link traffic, and deliberate inflation." — evidence: ReactiveDataEntityRepositoryImpl.java:631-634 (`.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))`) + ReactiveDataEntityRepositoryImpl.java:945-967 (the `id DESC` tiebreaker in `getOrderFields`) + cross-reference DataEntityServiceImpl.java:488-495 + ReactiveDataEntityRepositoryImpl.java:173-180 (the producer side from batch F) — intent_anchor: "the explicit `.orderBy(DATA_ENTITY.VIEW_COUNT.sort(SortOrder.DESC))` builder call paired with the `incrementViewCount` step that the producer half guarantees populates the counter on every read — both halves of the loop are intent-anchored at distinct file:line citations" — confidence: HIGH
- "**Popular endpoint is intentionally outside `SECURITY_RULES` — read-collaborative.** Same shape as `getDataEntityDetails` (`getDataEntityDetails.md:implicit_adrs.[0]`): no `@PreAuthorize`, no entry in `SecurityConstants.SECURITY_RULES`, falls through to `pathMatchers(\"/**\").authenticated()`. This is the consumer-side embodiment of ADR-CANDIDATE-003 (read-collaborative GET-uniformly-authenticated) that batch F resolved as deliberate. Cross-controller consistency: all 27+ GET endpoints on DataEntityController carry the same posture." — evidence: SecurityConstants.java:90-355 (no rule for `GET /api/dataentities/popular` — verified by `grep -n 'popular\\|getPopular' <odd-platform-repo>/odd-platform-api/src/main/java/.../auth/util/SecurityConstants.java` returning ZERO matches) + DataEntityController.java:307-313 (no annotation on the method) + cross-reference with `getDataEntityDetails.md:implicit_adrs.[0]` — intent_anchor: "the consistent pattern across 27+ GET endpoints on the controller, captured in `getDataEntityDetails.md:concepts.invariants[3]` and confirmed at the class-level sidecar — Popular fits the same pattern" — confidence: HIGH
- "**Soft-deleted entities are excluded from Popular, by design.** Unlike `getDataEntityDetails` which deliberately sets `.includeDeleted(true)` (`getDataEntityDetails.md:implicit_adrs.[1]`), `listPopular` does NOT set this flag — so `cteDataEntitySelect` line 916 applies `addSoftDeleteFilter` which adds `DATA_ENTITY.STATUS.ne(DELETED.getId())`. The deliberate asymmetry: by-id reads surface deleted entities (so the UI can render the deleted state); list-shaped reads (popular, search, my-objects) hide them (so users do not see deleted entries in recommendation strips)." — evidence: ReactiveDataEntityRepositoryImpl.java:631-634 (cteConfig omits includeDeleted, defaulting to false) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE branches: deleted-filter applied when includeDeleted is false) + ReactiveDataEntityRepositoryImpl.java:118-123 (the addSoftDeleteFilter method) + contrast with ReactiveDataEntityRepositoryImpl.java:220 (the getDetails path sets `.includeDeleted(true)`) — intent_anchor: "the cross-method asymmetry — getDetails opts IN to includeDeleted while listPopular / list-shaped paths do NOT — captured in the class-level CTE-config builder pattern" — confidence: HIGH
- "**No transactional boundary on the read path — `listPopular` is a single SELECT, no side-effect, no view-count touch.** Contrast with `getDataEntityDetails` (`getDataEntityDetails.md:implicit_adrs.[2]`) which carries `@ReactiveTransactional` to wrap the read + the view-count UPDATE in one transaction. `listPopular` reads `view_count` but never writes — the producer/consumer asymmetry is the implicit decision: the consumer half does not amplify the loop." — evidence: DataEntityServiceImpl.java:227-231 (no `@ReactiveTransactional` annotation, simple Flux pass-through) + ReactiveDataEntityRepositoryImpl.java:629-649 (single SELECT, no UPDATE) — intent_anchor: "the absence of @ReactiveTransactional paired with the absence of any UPDATE — the pair is the decision" — confidence: HIGH

## bugs_limitations_corner_cases

- "**INFLATABILITY CONFIRMED FROM PRIMARY SOURCE — `getPopular` ranking is monotonically pumpable by any authenticated caller.** Closure of REFACTOR-201 from the producer-consumer loop: (a) `getDataEntityDetails` increments `view_count` on every successful read (`ReactiveDataEntityRepositoryImpl.java:173-180`, no rate-limit per `getDataEntityDetails.md:bugs_limitations_corner_cases.[3]`, no idempotency key, no client-id-based debouncing); (b) `listPopular` ranks exclusively by `view_count DESC` (`ReactiveDataEntityRepositoryImpl.java:633`, sole orderBy signal); (c) neither endpoint carries an authorization gate beyond `.authenticated()`; (d) no anti-abuse signal exists anywhere in the chain (no IP throttling, no signed-request, no sampling, no time-decay, no per-user view-count cap). **A scripted loop of N calls to `GET /api/dataentities/{id}` from a single authenticated caller pushes entity {id} to the top of `GET /api/dataentities/popular` after sufficient N.** Under `auth.type=DISABLED` (the default), the attacker need not even authenticate. The Popular strip on the platform's home page is therefore a **manipulable first impression** — a malicious caller can promote any entity (including a deceptively-named one — e.g. `\"production-database-credentials\"`) to the top of the recommendations strip. Mitigation candidates unimplemented: (i) rate-limit `getDataEntityDetails`; (ii) sample the increment (probability 1/N); (iii) per-user view-count cap per entity per day; (iv) signal-mix (combine view_count with recency, owner-popularity, alert-state); (v) human-curated popular list overriding the algorithm." — evidence: ReactiveDataEntityRepositoryImpl.java:633 (the sole orderBy on view_count) + ReactiveDataEntityRepositoryImpl.java:173-180 (the unconditional increment) + DataEntityController.java:139-147 (no rate-limit on the producer) + DataEntityController.java:307-313 (no rate-limit on the consumer) + SecurityConstants.java:90-355 (no rule on either path) + DisabledAuthSecurityConfiguration.java:14-17 (anonymous DISABLED-mode access enables unauthenticated inflation) — severity: HIGH
- "**`exclude_from_search` is NOT applied to the Popular ranking — internal/staging entities marked as hidden-from-search ARE surfaced on the platform's home page.** Every other list-shaped surface in the codebase respects `EXCLUDE_FROM_SEARCH`: `ReactiveSearchEntrypointRepositoryImpl.java:91, 117, 149, 181, 555`, `ReactiveSearchFacetRepositoryImpl.java:167, 461, 575`, `JooqFTSHelper.java:149`, `ReactiveDataEntityRepositoryImpl.java:448` (countByState) + `:974` (getDataEntityDefaultConditions). The `cteDataEntitySelect` used by `listPopular` (line 909-939) applies `HOLLOW.isFalse()` (line 918) and `addSoftDeleteFilter` (line 916) — but NOT `EXCLUDE_FROM_SEARCH`. An operator who marks an entity `exclude_from_search=true` (typically to hide internal artefacts: ingestion-test fixtures, deprecated migrations, scratch tables) has a published expectation (per the column semantics and the consistent application elsewhere) that the entity is hidden from list-shaped surfaces — Popular silently violates that expectation. If the entity has a high view_count (which can happen because internal entities get heavy view-traffic from the operator team itself or via inflation), it surfaces to all users on the home page." — evidence: ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect — no EXCLUDE_FROM_SEARCH predicate) + ReactiveDataEntityRepositoryImpl.java:970-976 (`getDataEntityDefaultConditions` shows the project's pattern of applying all three filters together: HOLLOW + STATUS + EXCLUDE_FROM_SEARCH) + ReactiveSearchEntrypointRepositoryImpl.java:91 + JooqFTSHelper.java:149 (the widely-applied pattern) — severity: MEDIUM
- "**`page=0` produces a database error, not a 400.** The pagination math at `ReactiveDataEntityRepositoryImpl.java:632` computes `(page-1)*size`. For `page=0, size=10`, this is `-10` — Postgres rejects a negative LIMIT OFFSET. The OpenAPI spec at `openapi.yaml:877-893` does NOT declare `minimum: 1` for the page parameter — it only $refs `PageParam` and `SizeParam` from components.yaml, neither of which (per the grep evidence above) enforces the bound at the spec layer. The result: a misbehaved client triggers a 500-class error instead of a 400. Same gap repeats across all paginated list endpoints in the controller — but is most consequential here because Popular is invoked unauthenticated under DISABLED-mode." — evidence: ReactiveDataEntityRepositoryImpl.java:632 (`(page-1)*size` math, no guard) + openapi.yaml:877-893 (the spec entry) — severity: LOW
- "**Cross-owner visibility — Popular surfaces entities from all owners to all users.** Same shape as `getDataEntityDetails.md:bugs_limitations_corner_cases.[0]` but on the home-page first-impression surface: any authenticated user under LOGIN_FORM/OAUTH2/LDAP — and any anonymous caller under DISABLED — sees the same 10-entity popular strip including entities owned by other teams. A multi-tenant deployment that uses ODD to surface team-scoped catalogs cannot constrain Popular to the caller's own team (no `OwnerPojo` parameter on any layer of the chain). The blast radius is narrower than `getDataEntityDetails` because the `DataEntityRef` projection is 9 fields (vs the 34-field `DataEntityDetails` payload) — but the home-page placement makes the visibility decision more publicly consequential." — evidence: DataEntityController.java:307-313 (no principal) + DataEntityServiceImpl.java:227-231 (no owner filter) + ReactiveDataEntityRepositoryImpl.java:629-649 (no owner predicate in the CTE) — severity: MEDIUM
- "**No index on `data_entity.view_count` — the ORDER BY view_count DESC sequential-scans the whole table on every popular-list page render.** Verified across all 91 Liquibase migration files: only `V0_0_10__add_counters.sql` (adds the column with `DEFAULT 0`) and `V0_0_37__update_view_count.sql` (adds `NOT NULL`) touch the column — no `CREATE INDEX` statement on `view_count` anywhere. For a deployment with 10K+ data entities (a realistic scale), every Popular page-load is a sequential scan + sort. The cost is hidden today because the home-page load issues a single popular call per visit, but at scale (or if a UI change adds infinite-scroll, hover-preload, or auto-refresh) it becomes a noticeable load on the primary database. Mitigation: `CREATE INDEX idx_data_entity_view_count_desc ON data_entity (view_count DESC) WHERE hollow = false AND status != <DELETED_id>` (partial index on the popular-eligible rows)." — evidence: ReactiveDataEntityRepositoryImpl.java:633 (the orderBy) + `grep -rln 'view_count' <odd-platform-repo>/odd-platform-api/src/main/resources/db/migration` returning only the column-add and NOT-NULL migrations + V0_0_10__add_counters.sql:1-2 (no index in this migration either) — severity: LOW (depends on entity count)
- "**No pagination metadata in response — client cannot detect end-of-list, cannot prefetch, cannot estimate total.** `DataEntityRefList` (components.yaml:925-928) is a bare `array of DataEntityRef`, no `pageInfo` wrapper, no `total`, no `hasNext`. A client paging through Popular has to call until it gets an empty array — and for the Popular endpoint specifically, that means scanning the entire data_entity table sorted by view_count. Most clients (per the UI thunk at `dataentities.thunks.ts:177-184`) request page 1 only — so the gap is latent. Contrast with `DataEntityList` (components.yaml:1223-1230) which DOES carry `pageInfo`." — evidence: components.yaml:925-928 (the DataEntityRefList declaration) + dataentities.thunks.ts:177-184 (UI consumer only fetches page 1) — severity: LOW
- "**Pre-traffic ranking degenerates to `id DESC` — newly-ingested entities surface as 'popular' before any user has viewed them.** The migration default is `view_count = 0` for every existing row at the time of V0_0_10's deployment. For entities ingested after V0_0_10, the column defaults to 0 until the first `getDataEntityDetails` call. With many entities at `view_count=0`, the tiebreaker `id DESC` (line 963 in `getOrderFields`) kicks in — meaning the most-recently-ingested entities sort first. On a fresh ODD deployment (zero historical traffic), the Popular strip shows 'newest entities' rather than 'most-viewed' — and operators have no published signal that this is the bootstrap behaviour." — evidence: V0_0_10__add_counters.sql:1-2 (`DEFAULT 0`) + V0_0_37__update_view_count.sql:1-3 (existing-rows backfill to 0) + ReactiveDataEntityRepositoryImpl.java:945-967 (the `id DESC` tiebreaker in getOrderFields) — severity: LOW
- "**No request observability — `@Timed`/`MeterRegistry`/structured-log entries absent on the home-page surface.** Same shape as `getDataEntityDetails.md:bugs_limitations_corner_cases.[7]` — the controller declares `@Slf4j` at line 68 but no method body invokes `log.*` (zero `log.*` invocations file-wide). A regression in Popular latency / ranking correctness is invisible at the controller boundary." — evidence: DataEntityController.java:307-313 (no instrumentation) + DataEntityController.java:1-454 (zero `log.*` invocations file-wide, as captured in batch F) — severity: LOW
- "**No HTTP cache headers — Popular is a near-stable ranking (changes are slow, since view_count is monotonic), but the controller emits no Cache-Control / ETag / Last-Modified.** A 5-second client-side cache would absorb the dominant traffic pattern (home-page refreshes). Same shape as `getDataEntityDetails.md:bugs_limitations_corner_cases.[6]`." — evidence: DataEntityController.java:307-313 (only `.map(ResponseEntity::ok)`) — severity: LOW
- "**Concurrent rank changes are not transactional — the popular list a client sees may include duplicates or skips if writes occur during pagination.** Postgres SERIALIZABLE isolation is not used; the read is REPEATABLE READ default (no `@ReactiveTransactional` on this path); concurrent `getDataEntityDetails` UPDATEs to view_count can reorder the CTE result mid-pagination. A client paging through (page=1, page=2, page=3) may see entity X on both page=1 and page=2 (if X's view_count incremented past entities that were ahead of it), or may miss entity Y entirely (if Y's view_count incremented past where the client just paged from). The UI consumer fetches page=1 only (per the thunk) so the gap is latent — but third-party API consumers iterating through all pages would observe non-determinism." — evidence: DataEntityServiceImpl.java:227-231 (no `@ReactiveTransactional`) + ReactiveDataEntityRepositoryImpl.java:629-649 (single SELECT, no isolation hint) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — same posture as `getDataEntityDetails.md:security.auth_mode_relevance`. Under the three authenticated modes the endpoint requires authentication and nothing else (falls through to `.authenticated()` via AuthorizationCustomizer.java:29-30); under `auth.type=DISABLED` the endpoint is anonymously reachable per DisabledAuthSecurityConfiguration.java:14-17 (`permitAll()`). `S2S` is `N/A` — S2S filter is mounted only on `/ingestion/entities`; Popular is at `/api/dataentities/popular`.
- **ingestion_filter_relevance**: `NO — UI/API surface at /api/dataentities/popular, not /ingestion/entities`.
- **authorization_assertions**: [] — no `@PreAuthorize` on DataEntityController.java:307-313, no `@PreAuthorize` on the generated `DataEntityApi#getPopular`, no programmatic permission check anywhere in `DataEntityServiceImpl.listPopular` or `ReactiveDataEntityRepositoryImpl.listPopular`. The endpoint has NO entry in `SecurityConstants.SECURITY_RULES` (verified by `grep -n 'popular\\|getPopular' <odd-platform-repo>/odd-platform-api/src/main/java/.../auth/util/SecurityConstants.java` returning ZERO matches). Authorization is therefore reduced to the `pathMatchers("/**").authenticated()` fall-through at AuthorizationCustomizer.java:29-30.
- **owner_scoping**: `BYPASSES — returns popular entities from all owners to any authenticated caller` — DataEntityController.java:307-313 passes only `(page, size)` to the service; DataEntityServiceImpl.java:227-231 accepts only `(int, int)`; ReactiveDataEntityRepositoryImpl.java:629-649 builds the CTE without an owner predicate (no OwnerPojo parameter anywhere on the chain). Compare with `DataEntityServiceImpl.findByState` (batch F citation: `:182-194`) and `ReactiveDataEntityRepositoryImpl.listByOwner` (line 515-534) which DO take owner — those paths confirm the project knows how to scope by owner, but `listPopular` deliberately does not.
- **data_exposure**:
  - "9-field `DataEntityRef` payload (id, oddrn, externalName, internalName, entityClasses[], manuallyCreated, status, isStale, hasAlerts) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/dataentities/popular` — no role/permission gate; under `auth.type=DISABLED` this becomes anonymous to any caller able to reach the platform's port. **Note: `view_count` itself is NOT in the response** — `DataEntityRef` schema at components.yaml:894-924 omits it deliberately or accidentally" — evidence: DataEntityMapperImpl.java:533-548 (the 9-field projection) + components.yaml:894-924 (the schema) + AuthorizationCustomizer.java:29-30 (auth-only fall-through) + DisabledAuthSecurityConfiguration.java:14-17 (DISABLED bypass)
  - "`hasAlerts=true` flag exposes the alerting state of every popular entity — an authenticated user can see which entities are currently alerting (the EXISTS subquery at `ReactiveDataEntityRepositoryImpl.java:866-870` is unconditional). Cross-reference REFACTOR-024 (alerts read-collaborative gap) — Popular is a secondary disclosure path for alerting state, hitting the same posture without being separately reasoned about" — evidence: ReactiveDataEntityRepositoryImpl.java:866-870 (the hasAlerts EXISTS) + DataEntityMapperImpl.java:529-531 (mapReference applies hasAlerts to the response)
  - "`isStale=true` flag exposes the staleness state of every popular entity — operators marking entities as stale (via lastIngestedAt threshold logic in `dataEntityStaleDetector`) inadvertently broadcast that signal on the home page" — evidence: DataEntityMapperImpl.java:547 (`isStale(dataEntityStaleDetector.isDataEntityStale(pojo))`)
  - "**Resource enumeration via view-count exposure (indirect):** Popular surfaces high-view entities deterministically. An attacker can enumerate which entities have been viewed N+ times by paging through Popular until the listed view-count-derived ordering changes (since the response does NOT include view_count, the attacker must infer via repeated calls + their own inflation arithmetic). Lower-stakes than the direct ID-enumeration on `getDataEntityDetails`, but the inference is feasible." — evidence: ReactiveDataEntityRepositoryImpl.java:633 (deterministic ordering by view_count) + components.yaml:925-928 (no pageInfo, requiring page-by-page inference)
- **known_security_gaps**:
  - "**INFLATABILITY surface — primary-source-confirmed manipulability of the platform's home-page recommendation strip.** Already enumerated in `bugs_limitations_corner_cases.[0]` (severity: HIGH); restated here in security terms: an authenticated user (or DISABLED-mode anonymous caller) can promote any entity to the top of Popular by scripting reads against `getDataEntityDetails`. Mitigation candidates: rate-limit on detail-read; sample the increment; per-user view-count cap; human-curated popular override. Until one of these ships, the home-page first impression of every ODD deployment is **publicly manipulable**. This is REFACTOR-201 confirmed from primary source — the closure of the loop opened by `getDataEntityDetails`." — evidence: ReactiveDataEntityRepositoryImpl.java:633 (sole orderBy) + ReactiveDataEntityRepositoryImpl.java:173-180 (the producer) + no rate-limit anywhere in the chain — severity: HIGH
  - "**`exclude_from_search` bypass on the home page** — internal/staging entities marked hidden-from-search are surfaced on Popular if they have view_count. An operator-team's internal scratch tables (heavily viewed by the operator team themselves) bubble to the public-facing home page. Severity depends on what operators put in `exclude_from_search=true` entities; for a regulated-data deployment, this is a potential disclosure path." — evidence: ReactiveDataEntityRepositoryImpl.java:909-939 (cte missing the EXCLUDE_FROM_SEARCH predicate) + 9 other locations in the codebase that DO apply it — severity: MEDIUM
  - "**Cross-owner visibility on the home page** — multi-tenant deployments cannot constrain Popular to caller's own team. Same shape as the read-collaborative blast-radius family (REFACTOR-024 alerts + REFACTOR-053 activity + REFACTOR-187 search). Popular is the consumer-side embodiment of ADR-CANDIDATE-003 (resolved as intentional in batch F)." — evidence: DataEntityController.java:307-313 + DataEntityServiceImpl.java:227-231 + ReactiveDataEntityRepositoryImpl.java:629-649 (no owner predicate) — severity: MEDIUM
  - "**DISABLED-mode anonymous read of the platform's home-page recommendation surface.** Under `auth.type=DISABLED` (the default), any caller able to reach the platform's HTTP port reads the Popular ranking — including the names, oddrns, statuses, alert flags, and staleness flags of the top-viewed entities. LSN-001-shape. Adds Popular to the 8-sidecar DISABLED-bypass triangulation for `REFACTOR-073` (boot-time security-posture validator)." — evidence: DisabledAuthSecurityConfiguration.java:14-17 + AuthorizationCustomizer.java:24-30 (only wired when auth is enabled) — severity: HIGH (under default config)
  - "**Alerting state disclosure via hasAlerts** — the unconditional EXISTS subquery on ALERT joins (`ReactiveDataEntityRepositoryImpl.java:866-870`) emits the `hasAlerts` boolean to every viewer. An attacker can correlate Popular over time to detect 'which popular entity just started alerting' — a coarse-grained but real signal of platform health." — evidence: ReactiveDataEntityRepositoryImpl.java:866-870 + DataEntityMapperImpl.java:529-531 — severity: LOW

## performance

- **hot_paths**:
  - "`GET /api/dataentities/popular` is invoked on every home-page load (the UI thunk at `dataentities.thunks.ts:177-184` is wired to the Overview component at `Overview/Overview.tsx:9-20`). Backend cost per call: 1 CTE select with sort-by-view_count + LIMIT/OFFSET + 1 EXISTS subquery on ALERT for each CTE row. NO enrichment, NO transaction, NO view-count UPDATE. Lower per-call cost than `getDataEntityDetails`, but higher invocation rate (every UI mount, every navigate-home)." — evidence: DataEntityController.java:307-313 + DataEntityServiceImpl.java:227-231 + ReactiveDataEntityRepositoryImpl.java:629-649 + ReactiveDataEntityRepositoryImpl.java:866-870 (hasAlerts EXISTS)
- **throughput_characteristics**:
  - "Non-blocking reactive chain — `Flux<DataEntityRef>` end to end; per-call thread is not held during DB await" — evidence: DataEntityController.java:308-311 (`Mono.just(...).map(ResponseEntity::ok)` wrapping `Flux<DataEntityRef>`)
  - "NO transactional boundary — single SELECT, no row-locks acquired by this path (contrast with getDataEntityDetails which holds the data_entity row's write-lock for view_count UPDATE)" — evidence: DataEntityServiceImpl.java:227-231 (no @ReactiveTransactional)
  - "Streaming response body — `ResponseEntity<Flux<DataEntityRef>>` emits rows as they materialise from the DB cursor; latency-to-first-byte depends on first row's mapping, not full result" — evidence: DataEntityController.java:308 + ReactiveDataEntityRepositoryImpl.java:647 (`jooqReactiveOperations.flux(select)`)
- **resource_allocation**:
  - "1 main CTE select + 1 EXISTS subquery per row (the `hasAlerts` field). For `size=N`, the connection holds for ~N EXISTS evaluations; jOOQ + R2DBC should fuse these into the same query plan, but the per-row EXISTS adds non-trivial CPU." — evidence: ReactiveDataEntityRepositoryImpl.java:640-645 (the outer SELECT including `hasAlerts(deCte)`)
  - "No in-memory caching at the service or controller layer — every call re-hits the DB; no `@Cacheable`, no `Caffeine` cache, no manual cache map" — evidence: DataEntityServiceImpl.java:227-231 (no annotation) + grep on `<odd-platform-repo>/odd-platform-api/src/main/java/.../service/DataEntityServiceImpl.java` for `Cache|Cacheable|CacheManager` returned ZERO matches (per batch F evidence)
  - "No response-body caching at the HTTP layer — no ETag / Last-Modified / Cache-Control headers" — evidence: DataEntityController.java:307-313 (only `.map(ResponseEntity::ok)`)
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally" — evidence: DataEntityController.java:1-454 (no instance state beyond injected singletons)
  - "**`ORDER BY view_count DESC` without an index — sequential scan + sort on every page render.** Worst-case Postgres plan: `Sort (cost=... rows=N width=...) -> Seq Scan on data_entity ... Filter: (NOT hollow AND status != deleted_id)`. For N=10K entities this is ~1ms; for N=100K it's ~10-100ms depending on row width and shared_buffers. The lack of index defeats the otherwise-correct intuition that ranking by a counter should be O(K log K) where K = page size." — evidence: ReactiveDataEntityRepositoryImpl.java:633 + `grep -rln 'view_count' <odd-platform-repo>/odd-platform-api/src/main/resources/db/migration` (no index migration)
  - "Pagination: offset-based — `(page-1)*size` at line 632. Offset-pagination becomes expensive at deep pages (Postgres still scans the skipped rows). For Popular this is rarely hit (UI fetches page=1 only) but third-party API consumers paginating deeply pay quadratically." — evidence: ReactiveDataEntityRepositoryImpl.java:632
  - "Concurrent UPDATE contention — see `getDataEntityDetails.md:performance.known_performance_gaps.[0]` (hot-row contention on view_count for the producer side). Popular itself does not UPDATE, so it does not add contention — but the producer half makes the ranking source itself a hot row" — evidence: cross-reference with `getDataEntityDetails.md:performance.hot_paths.[0]` and `:scaling_characteristics`
- **known_performance_gaps**:
  - "**No index on `data_entity.view_count` — every Popular page render is a sequential scan + in-memory sort.** Already enumerated in `bugs_limitations_corner_cases.[4]`; restated here in performance terms. Mitigation: `CREATE INDEX idx_data_entity_view_count_desc ON data_entity (view_count DESC) WHERE hollow = false AND status != <DELETED_id>` — a partial descending B-tree index on the popular-eligible rows. With this index, the query becomes `Index Scan + Limit` which is O(K) for page size K instead of O(N) for total rows N." — evidence: ReactiveDataEntityRepositoryImpl.java:633 + migration evidence above — severity: LOW (depends on entity count; HIGH for 100K+ deployments)
  - "**No caching layer — Popular ranking is near-stable (view_count is monotonically increasing, ranking changes are slow) but every home-page load re-renders from the DB.** A 30-second TTL cache (Caffeine, keyed by `(page, size)`) keyed at the service layer would absorb the dominant traffic. Trade-off: a malicious inflator's ranking jump becomes visible 30s late — which arguably IMPROVES the user experience by reducing the visibility of inflation." — evidence: DataEntityServiceImpl.java:227-231 (no @Cacheable) — severity: MEDIUM
  - "**No HTTP cache headers — every refresh re-transfers the response.** ETag derived from `(view_count_max, view_count_min)` of the result page + `Cache-Control: max-age=30` would handle browser 304s without bypassing the inflation surface (since the inflator can already query the endpoint directly)." — evidence: DataEntityController.java:307-313 (no headers) — severity: LOW
  - "**Per-row `hasAlerts` EXISTS subquery — adds an ALERT-table lookup per CTE row.** For size=10 this is 10 EXISTS evaluations; for size=100 it's 100. The ALERT table grows with every alerted entity, so the per-EXISTS cost depends on ALERT indexing (the join is on `ALERT.DATA_ENTITY_ODDRN.eq(...) AND ALERT.STATUS.eq(OPEN)`). If ALERT has no index on `(DATA_ENTITY_ODDRN, STATUS)`, the EXISTS sequential-scans ALERT N times per Popular page." — evidence: ReactiveDataEntityRepositoryImpl.java:866-870 (the EXISTS) + ReactiveDataEntityRepositoryImpl.java:642-643 (the per-row application) — severity: LOW (depends on ALERT indexing — out of scope for this sidecar)
  - "**No request observability at the controller boundary** — same shape as `getDataEntityDetails.md:performance.known_performance_gaps.[4]`. Latency regressions are visible only via downstream DB metrics." — evidence: DataEntityController.java:307-313 + DataEntityController.java:1-454 (zero log.* invocations file-wide) — severity: LOW
  - "**Bootstrap-deployment ranking degeneration to id DESC** — on a fresh deployment with view_count=0 everywhere, the secondary tiebreaker takes over. This is a correctness gap (the 'popular' surface shows 'newest' instead) AND a performance gap (the user-facing ranking carries no signal). Acceptable as initial behaviour, but undocumented." — evidence: ReactiveDataEntityRepositoryImpl.java:945-967 (the id DESC tiebreaker) + V0_0_10__add_counters.sql:1-2 — severity: LOW (correctness-shaped, surfaced here because it affects perceived performance)

## sources

- understanding ← DataEntityController.java:307-313 (the four-line controller delegation) + DataEntityServiceImpl.java:227-231 (the service pass-through) + ReactiveDataEntityRepositoryImpl.java:629-649 (the repository implementation) + ReactiveDataEntityRepositoryImpl.java:633 (the sole orderBy on view_count) + cross-reference `getDataEntityDetails.md:implicit_adrs.[2]` (the producer half of the loop)
- concepts.entities ← components.yaml:894-924 (DataEntityRef schema, 9 fields) + components.yaml:925-928 (DataEntityRefList) + V0_0_10__add_counters.sql:1-2 + V0_0_37__update_view_count.sql:1-6 + DataEntityMapperImpl.java:533-548 (the mapReference projection) + ReactiveDataEntityRepositoryImpl.java:866-870 (hasAlerts EXISTS)
- concepts.operations ← DataEntityController.java:307-313 + DataEntityServiceImpl.java:227-231 + ReactiveDataEntityRepositoryImpl.java:629-649 + DataEntityMapperImpl.java:533-548 + ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect)
- concepts.invariants[0] ← ReactiveDataEntityRepositoryImpl.java:633 (sole orderBy) + ReactiveDataEntityRepositoryImpl.java:945-967 (getOrderFields tiebreaker)
- concepts.invariants[1] ← ReactiveDataEntityRepositoryImpl.java:631-634 (cteConfig builder; no includeDeleted) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE branches when includeDeleted is false) + ReactiveDataEntityRepositoryImpl.java:118-123 (addSoftDeleteFilter)
- concepts.invariants[2] ← ReactiveDataEntityRepositoryImpl.java:918 (`DATA_ENTITY.HOLLOW.isFalse()` in cteDataEntitySelect)
- concepts.invariants[3] ← ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect — absence of EXCLUDE_FROM_SEARCH predicate) + ReactiveSearchEntrypointRepositoryImpl.java:91, 117, 149, 181, 555 + ReactiveSearchFacetRepositoryImpl.java:167, 461, 575 + JooqFTSHelper.java:149 + ReactiveDataEntityRepositoryImpl.java:448 + :974 (the 9 locations across the codebase that DO apply the filter)
- concepts.invariants[4] ← DataEntityController.java:307-313 (no owner param) + DataEntityServiceImpl.java:227-231 (no owner param) + ReactiveDataEntityRepositoryImpl.java:629-649 (no owner predicate)
- concepts.invariants[5] ← SecurityConstants.java:90-355 (grep for `popular|getPopular` returns ZERO matches) + AuthorizationCustomizer.java:29-30 (auth-only fall-through)
- concepts.invariants[6] ← DataEntityController.java:307-313 (`exchange` parameter not referenced in the body)
- concepts.invariants[7] ← ReactiveDataEntityRepositoryImpl.java:632 (`(page-1)*size`) + openapi.yaml:877-893 (spec entry, no `minimum: 1`)
- concepts.audiences ← Overview/Overview.tsx:9-20 + dataentities.thunks.ts:177-184 (the UI consumer wiring)
- dependencies_semantic.requires-feature ← cross-reference `getDataEntityDetails.md:dependencies_semantic.requires-feature` (carried from batch F's WebFetch — not re-fetched this session per user guard) + DataEntityServiceImpl.java:488-495 (the producer-side incrementViewCount invoked by getDataEntityDetails)
- dependencies_semantic.requires-runtime ← DataEntityController.java:308-311 (Flux signature) + ReactiveDataEntityRepositoryImpl.java:647 (jooqReactiveOperations.flux) + V0_0_10__add_counters.sql + V0_0_37__update_view_count.sql + DataEntityServiceImpl.java:227-231 (no @ReactiveTransactional)
- dependencies_semantic.couples-to ← openapi.yaml:877-893 (spec) + DataEntityServiceImpl.java:227-231 + ReactiveDataEntityRepositoryImpl.java:629-649 + DataEntityMapperImpl.java:441-442, :529-548 + ReactiveDataEntityRepositoryImpl.java:173-180 (producer cross-ref) + AuthorizationCustomizer.java:24-30 + Overview/Overview.tsx:9-20 + dataentities.thunks.ts:177-184
- tests_coverage_semantic.uncovered_behaviours ← absence-based: `grep -rn 'listPopular|getPopular' <odd-platform-repo>/odd-platform-api/src/test` returned ZERO matches + `find <odd-platform-repo>/odd-platform-api/src/test -name 'DataEntityController*'` returned no matches
- tests_coverage_semantic.test_files ← grep evidence as above
- docs_link_semantic.inferred_docs[0] ← carried from `getDataEntityDetails.md:docs_link_semantic.inferred_docs[1]` (batch F WebFetch — not re-fetched per user guard "no WebFetch this run")
- docs_link_semantic.inferred_docs[1] ← carried from `getDataEntityDetails.md:docs_link_semantic.inferred_docs[0]` (batch F WebFetch)
- docs_link_semantic.doc_drift_findings.[0] ← openapi.yaml:877-893 (spec description "Returns list of the most popular data entities throughout the catalog" — undefined "popular") + ReactiveDataEntityRepositoryImpl.java:633 (the actual signal) + cross-reference `getDataEntityDetails.md:doc_drift_findings.[2]` (the producer-side gap)
- docs_link_semantic.doc_drift_findings.[1] ← ReactiveDataEntityRepositoryImpl.java:633 + 173-180 + cross-reference REFACTOR-024 / REFACTOR-053 / REFACTOR-187 / REFACTOR-201 (the read-collaborative blast-radius family)
- docs_link_semantic.doc_drift_findings.[2] ← components.yaml:894-924 (DataEntityRef schema — no view_count field) + ReactiveDataEntityRepositoryImpl.java:633 (the ranking signal that is hidden from the response)
- implicit_adrs[0] ← ReactiveDataEntityRepositoryImpl.java:631-634 (the orderBy decision) + ReactiveDataEntityRepositoryImpl.java:945-967 (the tiebreaker) + DataEntityServiceImpl.java:488-495 + ReactiveDataEntityRepositoryImpl.java:173-180 (the producer half, cross-referenced from batch F)
- implicit_adrs[1] ← SecurityConstants.java:90-355 (no rule) + DataEntityController.java:307-313 (no annotation) + cross-reference `getDataEntityDetails.md:implicit_adrs.[0]`
- implicit_adrs[2] ← ReactiveDataEntityRepositoryImpl.java:631-634 (cteConfig defaulting includeDeleted to false) + ReactiveDataEntityRepositoryImpl.java:909-917 (CTE branches) + ReactiveDataEntityRepositoryImpl.java:118-123 (addSoftDeleteFilter) + cross-reference `getDataEntityDetails.md:implicit_adrs.[1]` (the asymmetry)
- implicit_adrs[3] ← DataEntityServiceImpl.java:227-231 (no @ReactiveTransactional) + ReactiveDataEntityRepositoryImpl.java:629-649 (single SELECT, no UPDATE) + cross-reference `getDataEntityDetails.md:implicit_adrs.[2]` (the producer-side transactional)
- bugs_limitations_corner_cases[0] ← ReactiveDataEntityRepositoryImpl.java:633 (sole orderBy) + ReactiveDataEntityRepositoryImpl.java:173-180 (the producer increment) + DataEntityController.java:139-147 (no rate-limit on producer) + DataEntityController.java:307-313 (no rate-limit on consumer) + SecurityConstants.java:90-355 (no auth rule) + DisabledAuthSecurityConfiguration.java:14-17
- bugs_limitations_corner_cases[1] ← ReactiveDataEntityRepositoryImpl.java:909-939 (cteDataEntitySelect — no EXCLUDE_FROM_SEARCH) + ReactiveDataEntityRepositoryImpl.java:970-976 (the project-wide pattern in getDataEntityDefaultConditions) + ReactiveSearchEntrypointRepositoryImpl.java:91 + JooqFTSHelper.java:149 (the consistent application elsewhere)
- bugs_limitations_corner_cases[2] ← ReactiveDataEntityRepositoryImpl.java:632 + openapi.yaml:877-893
- bugs_limitations_corner_cases[3] ← DataEntityController.java:307-313 (no principal) + ReactiveDataEntityRepositoryImpl.java:629-649 (no owner predicate) + contrast with ReactiveDataEntityRepositoryImpl.java:515-534 (listByOwner — the path that DOES filter by owner)
- bugs_limitations_corner_cases[4] ← ReactiveDataEntityRepositoryImpl.java:633 + V0_0_10__add_counters.sql:1-2 + V0_0_37__update_view_count.sql:1-6 (the two view_count migrations — no index in either)
- bugs_limitations_corner_cases[5] ← components.yaml:925-928 (DataEntityRefList shape — no pageInfo) + dataentities.thunks.ts:177-184 (UI only fetches page=1)
- bugs_limitations_corner_cases[6] ← V0_0_10__add_counters.sql:1-2 + V0_0_37__update_view_count.sql:1-3 + ReactiveDataEntityRepositoryImpl.java:945-967 (the id DESC tiebreaker)
- bugs_limitations_corner_cases[7] ← DataEntityController.java:307-313 (no instrumentation) + cross-reference `getDataEntityDetails.md:bugs_limitations_corner_cases.[7]` (the file-wide log.* absence)
- bugs_limitations_corner_cases[8] ← DataEntityController.java:307-313 (no header customisation) + cross-reference `getDataEntityDetails.md:bugs_limitations_corner_cases.[6]`
- bugs_limitations_corner_cases[9] ← DataEntityServiceImpl.java:227-231 (no @ReactiveTransactional) + ReactiveDataEntityRepositoryImpl.java:629-649 (no isolation hint)
- security.auth_mode_relevance ← DisabledAuthSecurityConfiguration.java:14-17 + AuthorizationCustomizer.java:24-30 + cross-reference `getDataEntityDetails.md:security.auth_mode_relevance`
- security.authorization_assertions ← DataEntityController.java:307-313 + SecurityConstants.java:90-355 (verified grep) + AuthorizationCustomizer.java:29-30
- security.owner_scoping ← DataEntityController.java:307-313 + DataEntityServiceImpl.java:227-231 + ReactiveDataEntityRepositoryImpl.java:629-649 + contrast with ReactiveDataEntityRepositoryImpl.java:515-534 (listByOwner)
- security.data_exposure ← DataEntityMapperImpl.java:533-548 + components.yaml:894-924 + ReactiveDataEntityRepositoryImpl.java:866-870 (hasAlerts EXISTS) + DataEntityMapperImpl.java:547 (isStale population)
- security.known_security_gaps.[0] ← (the inflatability surface — same anchors as bugs_limitations_corner_cases.[0])
- security.known_security_gaps.[1] ← ReactiveDataEntityRepositoryImpl.java:909-939 (cte missing EXCLUDE_FROM_SEARCH) + the 9 locations of the consistent pattern elsewhere
- security.known_security_gaps.[2] ← (same anchors as bugs_limitations_corner_cases.[3])
- security.known_security_gaps.[3] ← DisabledAuthSecurityConfiguration.java:14-17 + AuthorizationCustomizer.java:24-30 + cross-reference `getDataEntityDetails.md:bugs_limitations_corner_cases.[2]` (the 8-sidecar DISABLED-bypass triangulation)
- security.known_security_gaps.[4] ← ReactiveDataEntityRepositoryImpl.java:866-870 (the unconditional hasAlerts EXISTS) + DataEntityMapperImpl.java:529-531
- performance.hot_paths.[0] ← DataEntityController.java:307-313 + dataentities.thunks.ts:177-184 + Overview/Overview.tsx:9-20 + ReactiveDataEntityRepositoryImpl.java:629-649 + ReactiveDataEntityRepositoryImpl.java:866-870
- performance.throughput_characteristics ← DataEntityController.java:308-311 + DataEntityServiceImpl.java:227-231 + ReactiveDataEntityRepositoryImpl.java:647
- performance.resource_allocation ← ReactiveDataEntityRepositoryImpl.java:640-645 + DataEntityServiceImpl.java:227-231 (no @Cacheable) + DataEntityController.java:307-313 (no header)
- performance.scaling_characteristics ← DataEntityController.java:1-454 (stateless) + ReactiveDataEntityRepositoryImpl.java:633 (the view_count orderBy) + V0_0_10/V0_0_37 (no index) + ReactiveDataEntityRepositoryImpl.java:632 (offset pagination)
- performance.known_performance_gaps.[0] ← (same anchors as bugs_limitations_corner_cases.[4])
- performance.known_performance_gaps.[1] ← DataEntityServiceImpl.java:227-231 (no @Cacheable)
- performance.known_performance_gaps.[2] ← DataEntityController.java:307-313 (no headers)
- performance.known_performance_gaps.[3] ← ReactiveDataEntityRepositoryImpl.java:866-870 (hasAlerts EXISTS) + ReactiveDataEntityRepositoryImpl.java:642-643 (per-row application)
- performance.known_performance_gaps.[4] ← DataEntityController.java:307-313 + DataEntityController.java:1-454 (zero log.* invocations)
- performance.known_performance_gaps.[5] ← ReactiveDataEntityRepositoryImpl.java:945-967 (id DESC tiebreaker) + V0_0_10__add_counters.sql:1-2

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (live URLs carried from batch F per user "no WebFetch this run" guard — `last_verified_status: not-verified-this-session`)
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
- probe_id: P-006
  probe_run_id: R-20260519T015117Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T01:51:17+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T020255Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:02:55+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T020259Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:02:59+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T020301Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:03:01+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T020307Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:03:07+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T020320Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:03:20+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T020744Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:07:44+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T020748Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:07:48+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T020751Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:07:51+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T020757Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:07:57+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T020810Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:08:10+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T021148Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:11:48+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T021152Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:11:52+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T021154Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:11:54+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T021200Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:12:00+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T021215Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:12:15+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T022658Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:26:58+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T022702Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:27:02+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T022705Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:27:05+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T022710Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:27:10+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T022725Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:27:25+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T022947Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:29:47+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T022953Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:29:53+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T022956Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:29:56+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T023002Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:30:02+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T023016Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:30:16+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T023231Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:32:31+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T023236Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:32:36+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T023238Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:32:38+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T023244Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:32:44+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T023257Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:32:57+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260519T023643Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:36:43+00:00
  verdict: "all assertions passed"
- probe_id: P-002
  probe_run_id: R-20260519T023647Z-P-002
  outcome: PASS
  test_class: security
  feature_id: F-001
  ran_at: 2026-05-19T02:36:47+00:00
  verdict: "all assertions passed"
- probe_id: P-003
  probe_run_id: R-20260519T023650Z-P-003
  outcome: PASS
  test_class: performance
  feature_id: F-001
  ran_at: 2026-05-19T02:36:50+00:00
  verdict: "all assertions passed"
- probe_id: P-004
  probe_run_id: R-20260519T023657Z-P-004
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-05-19T02:36:57+00:00
  verdict: "all assertions passed"
- probe_id: P-006
  probe_run_id: R-20260519T023710Z-P-006
  outcome: PASS
  test_class: security
  feature_id: F-003
  ran_at: 2026-05-19T02:37:10+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260602T115602Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-02T11:56:02+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260603T135756Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-03T13:57:56+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260610T152831Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-10T15:28:31+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260610T163309Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-10T16:33:09+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T113031Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T11:30:31+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T145114Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T14:51:14+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T154334Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T15:43:34+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T162605Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T16:26:05+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T162710Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T16:27:10+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T163839Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T16:38:39+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T182547Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T18:25:47+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T184017Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T18:40:17+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T200336Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T20:03:36+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T201317Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T20:13:17+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T202845Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T20:28:45+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T205551Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T20:55:51+00:00
  verdict: "all assertions passed"
- probe_id: P-001
  probe_run_id: R-20260611T223112Z-P-001
  outcome: PASS
  test_class: integration
  feature_id: F-001
  ran_at: 2026-06-11T22:31:12+00:00
  verdict: "all assertions passed"
