---
node_id: "odd-platform java TagController controller-method:getPopularTagList"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-rev5-sprint-2026-05-21-TAGGING-getPopularTagList
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control (open-read posture)
---

# getPopularTagList — semantic understanding

## understanding

`getPopularTagList` is the **single READ endpoint of the Tag API** — `GET /api/tags`,
mapped by the OpenAPI-generated `TagApi` interface that `TagController` implements
(`TagController.java:36-44`). It is a 2-line reactive delegation: it takes four query
parameters (`page`, `size`, `query`, `ids`) and forwards them — with an argument-order
swap — to `tagService.listMostPopular(query, ids, page, size)` (line 42), mapping the
resulting `Page<TagDto>` to a `TagsResponse` payload. **The endpoint is misnamed at every
layer.** Its name (`getPopularTagList`), the service method it calls (`listMostPopular`),
and the OpenAPI description (`'Gets the list of existing tags sorted by popularity'`,
`openapi.yaml:345`) all promise popularity-ranked results. The downstream SQL does NOT
deliver that: `ReactiveTagRepositoryImpl.listMostPopular` truncates the candidate pool to
`size` rows ordered by `TAG.ID ASC` (creation order, since `tag.id` is a serial PK) at
`ReactiveTagRepositoryImpl.java:148` BEFORE usage counts are computed; the outer
`orderBy(field(COUNT_FIELD).desc())` at line 158 re-ranks only those already-selected rows.
For any directory with more than `size` tags, the response is the OLDEST `size` tags — the
LSN-019 drift, empirically reproduced by the maintainer on 2026-05-20 (35 equally-popular
tags returned the oldest 30). The endpoint carries **no SecurityRule** — `SecurityConstants.SECURITY_RULES`
(`SecurityConstants.java:138-142`) registers POST/PUT/DELETE entries for `/api/tags` but
no GET entry, so the request falls through to the catch-all `pathMatchers("/**").authenticated()`
(`AuthorizationCustomizer.java:29-30`): any authenticated user can enumerate the entire
global tag directory regardless of which `TAG_*` permissions they hold.

## concepts

- entities: [
    "`TagApi` — OpenAPI-generated controller interface; `getPopularTagList` is an `@Override` of its generated abstract method (`TagController.java:36-37`).",
    "`page: Integer` — query parameter, OpenAPI `PageParam` (`openapi.yaml:348`); flows to `(page - 1) * size` as the SQL OFFSET expression (`ReactiveTagRepositoryImpl.java:148`).",
    "`size: Integer` — query parameter, OpenAPI `SizeParam` (`openapi.yaml:349`); flows to the SQL LIMIT inside `paginate(...)` (`ReactiveTagRepositoryImpl.java:148`).",
    "`query: String` — query parameter, OpenAPI `SearchParam` (`openapi.yaml:350`); case-insensitive substring name-filter via `nameField.containsIgnoreCase(nameQuery)` (`ReactiveAbstractCRUDRepository.java:243`).",
    "`ids: List<Long>` — query parameter, OpenAPI `IdsParam` (`openapi.yaml:351`); optional tag-id-set filter — adds `TAG.ID.in(ids)` only when non-empty (`ReactiveTagRepositoryImpl.java:141-142`).",
    "`ServerWebExchange` — Spring WebFlux reactive request context; injected (`TagController.java:41`) but unused by this method.",
    "`TagsResponse` — OpenAPI paginated response wrapper `{pageInfo, items: List<Tag>}` returned to the caller (`openapi.yaml:358`).",
    "`Page<TagDto>` — the service/repository-layer paginated shape `listMostPopular` returns before `tagMapper::mapToTagsResponse` converts it (`TagServiceImpl.java:73-77`).",
    "`TagService` — the single injected service bean (`TagController.java:20`); this method invokes exactly one of its 9 methods (`listMostPopular`)."
  ]
- operations: [
    "`getPopularTagList(Integer page, Integer size, String query, List<Long> ids, ServerWebExchange exchange)` (`TagController.java:36-44`) — 2-line reactive read: `tagService.listMostPopular(query, ids, page, size).map(ResponseEntity::ok)`. Note the argument-order swap: the controller signature is `(page, size, query, ids)`; the service call is `(query, ids, page, size)` (line 42).",
    "delegation to `TagServiceImpl.listMostPopular` (`TagServiceImpl.java:72-77`) — straight-through `reactiveTagRepository.listMostPopular(query, ids, page, size).map(tagMapper::mapToTagsResponse)`; no re-sort, no filter, no auth check at the service layer.",
    "delegation to `ReactiveTagRepositoryImpl.listMostPopular` (`ReactiveTagRepositoryImpl.java:137-167`) — the SQL pipeline: (a) `listCondition(query)` builds the soft-delete + optional name-substring conditions (line 140); (b) optional `TAG.ID.in(ids)` added when `ids` non-empty (lines 141-142); (c) `paginate(selectFrom(TAG).where(conditions), [OrderByField(TAG.ID, ASC)], (page-1)*size, size)` truncates to `size` rows by `TAG.ID ASC` (line 148); (d) the truncated set becomes `tag_cte` (line 150); (e) `getDataEntityWithDatasetFields` UNION-ALLs `tag_to_data_entity` + `tag_to_dataset_field` usage counts over the CTE rows only (lines 373-392); (f) the outer `cteSelect.orderBy(field(COUNT_FIELD).desc())` re-ranks those rows by summed count desc (lines 153-158); (g) `pageifyResult` with `fetchCount(query, ids)` for the total (lines 162-166)."
  ]
- invariants: [
    "Pure 2-line delegation — no business logic, no transformation, no programmatic auth check in this method body (`TagController.java:36-44`); it is a stub-implementation of the generated `TagApi.getPopularTagList`.",
    "The endpoint promises popularity ordering at three independent layers (method name `getPopularTagList`; service method `listMostPopular`; OpenAPI `description: 'Gets the list of existing tags sorted by popularity'` at `openapi.yaml:345`) but the SQL selects by `TAG.ID ASC` before counting — the response IS popularity-ordered only when the directory holds <= `size` tags. See stress_findings.name_behavior_pairs[0] (LSN-019).",
    "`getPopularTagList` is the ONLY endpoint among the four on `/api/tags` with no `SecurityRule` entry — `SecurityConstants.SECURITY_RULES` has POST/PUT/DELETE entries for `/api/tags` (`SecurityConstants.java:138-142`) but no GET entry; the request inherits the catch-all `authenticated()` (`AuthorizationCustomizer.java:29-30`).",
    "Page total semantics are correct — `fetchCount(query, ids)` (`ReactiveTagRepositoryImpl.java:165` → `ReactiveAbstractCRUDRepository.java:229-234`) uses `listCondition(nameQuery, ids)` (BOTH filters), so `pageInfo.total` reflects the full filtered directory size, not the page size. The drift is in WHICH `size` rows are returned, not in the reported total.",
    "OpenAPI declares only a `'200'` response for this read endpoint (`openapi.yaml:353`); the controller returns 200 via `ResponseEntity::ok` (line 43) — NO status-code drift on this method (unlike `createTag` / `updateTag`, which return 200 against an OpenAPI-declared 201).",
    "`query` substring matching is case-insensitive (`containsIgnoreCase`, `ReactiveAbstractCRUDRepository.java:243`) — asymmetric with the case-SENSITIVE exact-name lookup the directory-write path uses (`listByNames` → `TAG.NAME.in(names)`); a user can search 'post' and see both 'Postgres' and 'postgres' if both rows exist."
  ]
- audiences: [
    "odd-platform-ui-end-user — the response feeds the Catalog Overview 'Top Tags' chip strip, the tag-search facet, the data-entity / dataset-field detail-page tag dropdown, and the Management -> Tags tab listing.",
    "odd-api-consumer — programmatic clients of `GET /api/tags` via the OpenAPI spec.",
    "any-authenticated-user — under LOGIN_FORM / OAUTH2 / LDAP, every authenticated principal can call this endpoint and enumerate the whole directory regardless of `TAG_*` grants (open-read posture).",
    "platform-operator — indirectly: an operator reading 'Top Tags' to assess vocabulary health is shown the OLDEST tags, not the most-used, for any directory beyond `size` tags."
  ]

## dependencies_semantic

- requires-feature: [
    "`TagApi` OpenAPI-generated controller interface — supplies the `@GetMapping`-equivalent route binding for `getPopularTagList` (generated from `openapi.yaml:342-360`).",
    "`TagService.listMostPopular` (`TagService.java`) — the sole service method this endpoint calls; its drift is propagated 1:1 (`TagServiceImpl.java:72-77`).",
    "`ReactiveTagRepositoryImpl.listMostPopular` (`ReactiveTagRepositoryImpl.java:137-167`) — the SQL surface; the popularity-ordering drift originates here.",
    "`JooqQueryHelper.paginate` (`ReactiveTagRepositoryImpl.java:148` calls it) — the pagination helper whose paginate-inside-CTE semantics select by `TAG.ID ASC`; the load-bearing dependency for the LSN-019 drift.",
    "`SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:138-142`) — the ABSENCE of a GET entry is load-bearing for this endpoint's auth posture.",
    "`AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:20-31`) — the catch-all `pathMatchers(\"/**\").authenticated()` (lines 29-30) that this endpoint falls through to."
  ]
- requires-config: [] — N/A. This method reads no Spring properties; behaviour is unconditional.
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `TagController` is a `@RestController` (`TagController.java:16`); `getPopularTagList` returns `Mono<ResponseEntity<TagsResponse>>`.",
    "Spring Security ReactiveSecurityWebFilterChain — composed via `OAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` / `LdapSecurityConfiguration` / `SecurityConfiguration`; `AuthorizationCustomizer` is the access wiring.",
    "`reactor.core.publisher.Mono` — the reactive return type.",
    "jOOQ + reactive Postgres driver (via `ReactiveTagRepositoryImpl`) — the actual query execution path."
  ]
- couples-to: [
    "`TagApi` (`TagController implements TagApi` at `TagController.java:18`) — `getPopularTagList` is `@Override` of the generated abstract method; its signature (param names/order, return type) is dictated by `openapi.yaml:342-360`.",
    "`TagService` (constructor-injected, `TagController.java:20`) — coupled to the `listMostPopular` method signature; the controller's `(query, ids, page, size)` argument order must match the service contract.",
    "`SecurityConstants.SECURITY_RULES` — coupled by URL convention (path-pattern match `/api/tags` + HTTP verb), NOT by code reference; a path rename to e.g. `/api/tags/popular` would silently change which rules apply (REFACTOR-217 drift class)."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — No `TagControllerTest.java` exists (`Grep TagController` in `odd-platform-api/src/test` returns zero matches per the existing `TagController` controller-class sidecar). The controller perimeter for `getPopularTagList` is entirely unverified.
- uncovered_behaviours:
  - behaviour: "`getPopularTagList` LSN-019 drift — directory with > `size` tags returns the OLDEST `size` by `TAG.ID ASC`, not the most-popular `size`. With 35 equally-popular tags + size=30, response IDs must be the 30 lowest, the 5 newest absent."
    test_class: integration
    criticality: HIGH
    note: "Pinned by probe P-010 (lineage/odd-platform/probes/P-010.yaml). Converting P-010's arrange/act/assert into a Testcontainers-backed @SpringBootTest would put the drift permanently under CI. The repository-layer `TagRepositoryImplTest.testListMostPopular` (`TagRepositoryImplTest.java:239-267`) is structurally blind — it uses `size = numberOfTestTags` so the LIMIT never fires, and `containsExactlyInAnyOrder` so order is never checked."
  - behaviour: "`getPopularTagList` happy path — GET `/api/tags` with a directory <= `size` tags returns all tags ordered by usage count desc; assert the count-DESC ordering DOES hold in the non-truncated case."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` `query` filter — GET `/api/tags?query=post` returns only tags whose name matches `%post%` case-insensitively; assert both 'Postgres' and 'postgres' match (case-insensitive substring)."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` `ids` filter — GET `/api/tags?ids=1,2,3` restricts to those tag ids; assert empty `ids` is treated as no-filter (not zero-results)."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` open-read posture — assert a user holding NO `TAG_*` permission gets 200 + the full directory (the absence of a GET SecurityRule)."
    test_class: security
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` unauthenticated access — assert 401 (or 302 for LOGIN_FORM) for an unauthenticated caller under LOGIN_FORM/OAUTH2/LDAP; 200 under DISABLED."
    test_class: security
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` `size` boundary — `size=0` returns an empty `items` list with a correct `pageInfo.total`; `size=100000` is accepted with no clamp (large UNION-ALL aggregation)."
    test_class: performance
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` `page`/`size` degenerate inputs — `page=0` / `page=-1` / `size=-1` reach PostgreSQL; assert the SQL-error or surprising-shape behaviour (negative OFFSET / negative LIMIT) is handled or surfaced as a clean 4xx."
    test_class: integration
    criticality: MEDIUM
    note: "stress_findings.tunables records these as PROBE-NEEDED → P-029 emitted."
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:239-267 (`testListMostPopular` — repository-layer only; structurally blind to the LSN-019 ordering drift per the analysis above; covers the `query` substring path, NOT popularity ordering, NOT the LIMIT-truncation case)"
- gaps: |
    The highest-leverage gap is **integration coverage of the LSN-019 drift on `getPopularTagList`** — the controller has zero tests, and the only existing test (`TagRepositoryImplTest.testListMostPopular`) cannot detect the drift because it never exercises the LIMIT (`size = numberOfTestTags`) and never checks order (`containsExactlyInAnyOrder`). Probe P-010 pins the drift at the REST boundary; promoting it to a CI `@SpringBootTest` is the single fix that would surface any future regression (e.g. a refactor that moved the count-ordering inside the paginate window). The second gap is **security tests** — no `TagControllerSecurityTest` exists, so the open-read posture (no GET SecurityRule) and any future path-pattern drift would not surface in CI. The worst-covered test_class on this node is `integration`: every operator-observable behaviour (drift, filters, pagination boundaries) is unverified end-to-end.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `TagController.java` (verified during the end-to-end read of the 53-line file — no `@docs`, `// @docs:`, or javadoc `@docs:` token present).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Tag UX page; the canonical destination for the 'Top Tags' surface this endpoint feeds. Verification inherited from the sibling `TagController` controller-class sidecar (WebFetch 2026-05-20, status 200) — within the ~11-day stale-probe cadence; re-verification not required this session."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch 2026-05-20, status 200, inherited from the TagController controller-class sidecar's verification): the page "references 'Top tags' on the Catalog Overview but provides no API endpoint details, no ordering semantics, and no visibility scope." The live tagging page does NOT state the ordering contract of the Top-Tags surface — it neither confirms nor refutes popularity ordering, so it cannot be used to argue the drift away.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names `TAG_CREATE`/`TAG_UPDATE`/`TAG_DELETE` but, per the sibling sidecar's verification, does not document that GET `/api/tags` has no RBAC gate beyond authentication."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (inherited from the TagController controller-class sidecar's verification): the permissions page lists the three Management-scope TAG permissions but "does not mention that GET `/api/tags` has NO RBAC gate beyond authentication."
- doc_drift_findings:
  - "**LSN-019 — name-vs-behavior drift surfaced at the API contract:** the OpenAPI spec (`openapi.yaml:345`) describes `getPopularTagList` as `'Gets the list of existing tags sorted by popularity'`. The implementation selects the OLDEST `size` tags by `TAG.ID ASC` (`ReactiveTagRepositoryImpl.java:148`) BEFORE counting, then re-ranks only those by count desc (line 158). The OpenAPI description is therefore an inaccurate spec claim for any directory holding more than `size` tags — operator-visible: a deployment with > `size` tags renders OLD-and-unused tags as 'Top Tags'. The spec line itself is the doc artefact in drift; doc-gap-finder should flag `openapi.yaml:345` for correction or for the implementation to be fixed. Empirically confirmed by the maintainer 2026-05-20 (35 equally-popular tags → oldest 30); pinned by P-010."
  - "Live tagging page (WebFetched 2026-05-20, status 200, inherited) provides no ordering semantics for the 'Top Tags' Catalog-Overview surface — it cannot tell an operator whether the list is most-used or oldest. The drift is invisible to a doc reader."
  - "Live permissions page (WebFetched 2026-05-20, status 200, inherited) does not mention that GET `/api/tags` is reachable by any authenticated user with no `TAG_*` permission — the open-read posture is undocumented."

## implicit_adrs

- "**Read endpoints are NOT RBAC-gated — open-read posture by design.** `getPopularTagList` has no `SecurityRule` entry; the request falls through to `pathMatchers(\"/**\").authenticated()`. The same shape is consistent across sibling read endpoints (e.g. `TermController.getTermsList`, `AlertController.getAllAlerts` per the existing `TagController` controller-class sidecar)." — evidence: SecurityConstants.java:138-142 (POST/PUT/DELETE entries only, no GET entry for `/api/tags`) + AuthorizationCustomizer.java:29-30 (the catch-all) — intent_anchor: "The absence of a GET `SecurityRule` is applied consistently across the controller surface — the `SECURITY_RULES` table registers write-verb rules and deliberately omits read-verb rules; the convention IS the decision that tag-directory READ is open to all authenticated users." — confidence: MEDIUM (the convention is consistent and the `SECURITY_RULES` table is a deliberate enumerated structure, but no comment in `SecurityConstants.java` explicitly defends the read-open stance — the intent is inferred from the structural consistency, not stated)

- "**Thin OpenAPI-delegate controller-method pattern.** `getPopularTagList` is a 2-line reactive delegation `service-call.map(ResponseEntity::ok)` with no transformation and no programmatic auth check — business logic stays in the service layer." — evidence: TagController.java:36-44 (the whole method body is 2 lines) + the identical shape of the other 3 methods in the file + consistency across the controller package — intent_anchor: "The OpenAPI-generated `TagApi` interface that `TagController implements` (line 18) IS the architectural statement — the controller is a generated-contract stub; every method delegates straight to a service. The pattern repeats across the file and the package." — confidence: HIGH

## bugs_limitations_corner_cases

- "**`getPopularTagList` LSN-019 name-vs-behavior drift.** The endpoint name (`getPopularTagList`), the service method (`listMostPopular`), and the OpenAPI description (`'Gets the list of existing tags sorted by popularity'`, `openapi.yaml:345`) all promise popularity ordering. `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`) uses `paginate(homogeneousQuery, [new OrderByField(TAG.ID, SortOrder.ASC)], (page-1)*size, size)` (line 148) as the row-SELECTION step — `JooqQueryHelper.paginate` emits `ORDER BY tag.id ASC LIMIT size OFFSET ...` as the inner step; only the `size` rows so-selected enter `tag_cte` (line 150). The outer `cteSelect.orderBy(field(COUNT_FIELD).desc())` (line 158) re-ranks those `size` rows by count desc but cannot reach tags excluded by the inner LIMIT. With > `size` tags where the youngest have higher usage than the oldest `size`, the response contains the OLDEST `size` and the actual-most-popular are missing. Pinned by P-010; empirically confirmed by the maintainer 2026-05-20 (35 equally-popular tags returned the oldest 30). — evidence: TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:140-167 (line 148 the inner paginate, line 158 the outer count-DESC) + ReactiveTagRepositoryImpl.java:373-392 (the UNION-ALL CTE over `tag_cte` only) + lineage/odd-platform/probes/P-010.yaml — severity: HIGH"

- "**No RBAC gate on `getPopularTagList` — global tag directory enumeration by any authenticated user.** No `SecurityRule` entry exists for GET `/api/tags`; the endpoint inherits `authenticated()` from the catch-all. Combined with the side-door write paths (REFACTOR-223 / DOC-GAP-168), a user holding only `DATA_ENTITY_TAGS_UPDATE` can both READ this directory and grow it — without ever holding `TAG_CREATE` or any `TAG_*` permission. — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 (catch-all) + TagController.java:36-44 (no `@PreAuthorize`) — severity: MEDIUM"

- "**No `size` clamp — `size=100000` is accepted at every layer.** `getPopularTagList` passes `size` straight through (`TagController.java:38, 42`); `TagServiceImpl.listMostPopular` and `ReactiveTagRepositoryImpl.listMostPopular` apply no upper bound; `paginate(...)` emits `LIMIT 100000` and the UNION-ALL CTE aggregates over the full directory. A caller can force a large in-memory aggregation. — evidence: TagController.java:37-42 (no `@Max`, no `@Valid`) + ReactiveTagRepositoryImpl.java:138-167 (no clamp) — severity: LOW"

- "**Argument-order swap between controller signature and service call.** The controller method signature is `(page, size, query, ids)` (`TagController.java:37-41`); the call to the service is `tagService.listMostPopular(query, ids, page, size)` (line 42). The types differ enough that a future parameter addition or reorder could silently bind the wrong values (e.g. `query` and `page` are different types so a swap fails to compile, but `page`/`size` are both `Integer` and `query` could be confused with a future `String` param). The swap is correct today but is a fragility surface with no test pinning it. — evidence: TagController.java:37-42 — severity: LOW"

- "**`page`/`size` degenerate inputs reach PostgreSQL un-validated.** `page=0` produces OFFSET `(0-1)*size = -size` → PostgreSQL rejects a negative OFFSET; `size=-1` → `LIMIT -1` → PostgreSQL rejects a negative LIMIT; a literal `null` querystring for `page`/`size` reaches the service signature `int page, int size` (`TagServiceImpl.java:73-74`) and throws `NullPointerException` on unboxing. None of these is guarded in the controller. The operator-visible result is a 500, not a clean 4xx. — evidence: TagController.java:37-42 (no validation) + TagServiceImpl.java:73-74 (primitive `int` params) + ReactiveTagRepositoryImpl.java:148 (the `(page-1)*size` arithmetic) — severity: LOW"

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TagController.java:37"
      name: "page"
      value: "Integer (caller-controlled; OpenAPI PageParam default; no clamp in controller, service, or repository)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "page=1 (typical): OFFSET = (1-1)*size = 0 — first page. page=0: OFFSET = (0-1)*size = -size — paginate emits `LIMIT size OFFSET -size`; PostgreSQL rejects a negative OFFSET (SQL state 22023) → DataAccessException → 500 to the caller. No controller guard."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37-42 + ReactiveTagRepositoryImpl.java:148 (the `(page-1)*size` expression) + JooqQueryHelper.paginate (referenced; not re-read this session)"
        - q: "What at N = tunable + 1 / tunable x 100?"
          a: "page beyond the last populated page (e.g. page=5 with 10 tags and size=30): OFFSET 120 over a 10-row base → empty `items`, `pageInfo.total=10`, `pageInfo.hasNext=false`. No error — an over-range page is a clean empty page. page x 100: same — large OFFSET, empty result, no error."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148, 162-166 (pageifyResult with fetchCount) + ReactiveAbstractCRUDRepository.java:229-234 (fetchCount)"
        - q: "What at null / negative / non-numeric?"
          a: "page is declared `Integer` at the controller (`TagController.java:37`) but the service signature is primitive `int page` (`TagServiceImpl.java:73`); a literal `null` querystring → Spring binds `null` Integer → NullPointerException on unboxing at the service-call boundary → 500. page=-1: OFFSET = (-1-1)*size = -2*size → negative OFFSET → PostgreSQL SQL error → 500. Non-numeric → NumberFormatException at the Spring `@RequestParam` binding layer → 400."
          confidence: PROBE-NEEDED
          evidence: "P-029 (the null/negative-page variant — needs runtime confirmation of the exact HTTP status PostgreSQL's negative-OFFSET error surfaces as)"
        - q: "What does the operator see at each boundary?"
          a: "page=1 with directory <= size: full directory, count-DESC ordered. page=1 with directory > size: LSN-019 drift — OLDEST `size` tags. over-range page: empty list, no error. page=0 / page=-1: 500 error. The UI's 'Top Tags' surface paginates from page=1, so the drift is the dominant operator-visible boundary."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:140-167 + lineage/odd-platform/probes/P-010.yaml (the drift pin)"
    - location: "TagController.java:38"
      name: "size"
      value: "Integer (caller-controlled; OpenAPI SizeParam; no clamp at any layer)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "size=0: paginate emits `LIMIT 0` → empty `items` list; `pageifyResult` returns `pageInfo.total = fetchCount(...)` (the real directory size) and `hasNext=false`. size=1: paginate selects 1 row by `TAG.ID ASC` = the OLDEST tag; the outer count-DESC is a no-op on a single row."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148, 162-166 + ReactiveAbstractCRUDRepository.java:229-234 (fetchCount)"
        - q: "What at N = tunable + 1 / tunable x 100?"
          a: "size larger than the directory (e.g. size=3000, 35 tags): paginate `LIMIT 3000` returns all 35; the outer count-DESC then orders all 35 by usage correctly — the drift does NOT manifest when size >= total. size=100000: accepted with no clamp; the inner paginate runs over the whole TAG table sorted by `TAG.ID ASC`, then the UNION-ALL CTE aggregates over the full result — large in-memory aggregation, no protection."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37-42 (no @Max) + ReactiveTagRepositoryImpl.java:138-167 (no clamp) + ReactiveTagRepositoryImpl.java:373-392 (the UNION-ALL CTE)"
        - q: "What at null / negative / non-numeric?"
          a: "size declared `Integer` at the controller, primitive `int size` at the service (`TagServiceImpl.java:74`); literal `null` querystring → NullPointerException on unboxing → 500. size=-1: paginate emits `LIMIT -1` → PostgreSQL rejects a negative LIMIT → DataAccessException → 500. Non-numeric → NumberFormatException at binding → 400."
          confidence: PROBE-NEEDED
          evidence: "P-029 (the null/negative-size variant — needs runtime confirmation of the surfaced HTTP status)"
        - q: "What does the operator see at each boundary?"
          a: "size >= total tags: full directory in correct count-DESC order. size < total tags: LSN-019 drift — the OLDEST `size` tags re-ranked among themselves by count. size=0: empty 'Top Tags' surface, no error. size=-1 / null: 500."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-158 + lineage/odd-platform/probes/P-010.yaml"
  name_behavior_pairs:
    - name: "TagController.getPopularTagList (TagController.java:36-44) — GET /api/tags, OpenAPI operationId getPopularTagList"
      promise: "Returns the most-popular tags ranked by usage count. The method name (`getPopularTagList`), the service method (`listMostPopular`), the OpenAPI summary (`'List of popular tags'`) and description (`'Gets the list of existing tags sorted by popularity'`, openapi.yaml:344-345) all promise popularity-ordered results. The UI labels the response 'Top Tags'."
      implementation: "Pipeline traced end-to-end: (1) TagController.getPopularTagList delegates to tagService.listMostPopular(query, ids, page, size) (TagController.java:42). (2) TagServiceImpl.listMostPopular delegates straight-through to reactiveTagRepository.listMostPopular (TagServiceImpl.java:75) — no re-sort. (3) ReactiveTagRepositoryImpl.listMostPopular (lines 137-167): (a) `listCondition(query)` + optional `TAG.ID.in(ids)` build the WHERE conditions (lines 140-142); (b) `DSL.selectFrom(TAG).where(conditions)` is the homogeneous base — NO ordering (lines 144-145); (c) `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page-1)*size, size)` (line 148) is the row-SELECTION step — emits `ORDER BY tag.id ASC LIMIT size OFFSET (page-1)*size`; (d) the truncated set becomes `tag_cte` (line 150); (e) `getDataEntityWithDatasetFields` (lines 373-392) UNION-ALLs `tag_to_data_entity` + `tag_to_dataset_field` usage counts OVER THE CTE ROWS ONLY; (f) the outer `cteSelect.orderBy(field(COUNT_FIELD).desc())` (lines 153-158) re-ranks the already-selected `size` rows by summed count desc — it CANNOT reach tags excluded by step (c)'s LIMIT."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "For any directory with more than `size` tags, the response is the OLDEST `size` tags by `TAG.ID ASC` (creation order, since `tag.id` is a serial PK), re-ranked among themselves by count — NOT the `size` most-popular globally. The UI's 'Top Tags' label is operator-misleading: it is effectively 'Oldest Tags' beyond `size` tags. Maintainer's 2026-05-20 empirical test (35 equally-popular tags, size=30) returned the oldest 30 by created_at ASC."
      confidence: STATIC-INFERRED
      evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:140-167 (line 148 inner paginate, line 158 outer count-DESC) + ReactiveTagRepositoryImpl.java:373-392 (the CTE-scoped UNION-ALL) + openapi.yaml:344-345 (the spec promise) + lineage/odd-platform/probes/P-010.yaml (the runtime pin) + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32 (empirical)"
  orderings:
    - location: "ReactiveTagRepositoryImpl.java:148 (inner paginate) + ReactiveTagRepositoryImpl.java:158 (outer cteSelect orderBy)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the SQL the database executes)?"
          a: "Two-level ordering. INNER: `paginate(homogeneousQuery, [OrderByField(TAG.ID, ASC)], (page-1)*size, size)` (line 148) — JooqQueryHelper.paginate emits `ORDER BY tag.id ASC LIMIT size OFFSET (page-1)*size` over `selectFrom(TAG).where(conditions)`; this selects the OLDEST `size` matching tags by serial PK. OUTER: `cteSelect.orderBy(field(COUNT_FIELD).desc())` (line 158) emits `ORDER BY count DESC` over the GROUPED-and-summed CTE rows. ONLY the INNER ordering determines WHICH rows are returned; the OUTER ordering only sorts the already-selected rows."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:140-167 (the full chain, read this session) + ReactiveTagRepositoryImpl.java:373-392 (the CTE)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "INNER `TAG.ID ASC` is over a serial PK — never tied, fully deterministic. OUTER `ORDER BY count DESC` has NO secondary sort key (line 158 is a single-field orderBy); when two tags have equal aggregated count, their relative order is PostgreSQL's implementation-defined order — practically the CTE-natural row order, which is `tag.id ASC` from the inner paginate. The maintainer's 2026-05-20 test (35 equally-popular tags) saw the oldest 30 in `tag.id ASC` order — consistent with the inner selection dominating and the outer count-DESC being a stable no-op on equal counts."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148, 158 (the inner has an explicit OrderByField; the outer has a single-field orderBy with no tie-break)"
        - q: "Which subset is returned when result-set > page size?"
          a: "The FIRST `size` tags by `TAG.ID ASC` (the OLDEST), filtered by `query`/`ids`. This is the LSN-019 drift. The remaining (newer) tags — however popular — are excluded from page 1. Pinned by P-010."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148 + lineage/odd-platform/probes/P-010.yaml + retrospectives/LSN-019:23-32 (empirical 35-tag reproduction)"
        - q: "Does any upstream layer (UI, service) re-sort or filter the result?"
          a: "Service layer (TagServiceImpl.listMostPopular, TagServiceImpl.java:72-77): no re-sort — only `.map(tagMapper::mapToTagsResponse)`. Controller (getPopularTagList, TagController.java:36-44): no re-sort — only `.map(ResponseEntity::ok)`. The UI ('Top Tags' chip strip / search facet) renders `items` in the delivered order; whether the React component re-sorts is a UI-side question — REFERENCE to the UI sidecar (ui_route Catalog-Overview Top-tags chip strip), not yet enriched."
          confidence: REFERENCE
          evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 (no re-sort confirmed) — UI re-sort is REFERENCE to node: ui_route:Catalog-Overview-TopTags (unresolved)"
  auth_gates:
    - location: "SecurityConstants.java:138-142 (the gate-shaped ABSENCE of a GET entry) + TagController.java:36-44"
      endpoint: "GET /api/tags (getPopularTagList)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: 200 — Spring Security is not engaged; no SecurityRule and no catch-all apply. LOGIN_FORM / OAUTH2 / LDAP: identical — there is no GET SecurityRule for `/api/tags` (`SecurityConstants.java:138-142` has only POST/PUT/DELETE entries), so the request matches the catch-all `pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`); any authenticated principal gets 200 + the full directory. The endpoint behaves the same across all three authenticating modes because `SECURITY_RULES` is mode-agnostic."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-31 — auth-mode wiring is REFERENCE to OAuthSecurityConfiguration / LoginFormSecurityConfiguration / LdapSecurityConfiguration / SecurityConfiguration"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "LOGIN_FORM: 302 redirect to the login form (or 401 for an XHR/JSON request). OAUTH2 / LDAP: 401. The catch-all `authenticated()` rule (AuthorizationCustomizer.java:29-30) blocks unauthenticated access even though `getPopularTagList` has no explicit SecurityRule. DISABLED: 200 — no auth check at all."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (the catch-all that backstops the missing GET rule)"
        - q: "What does a wrong-role caller see (a READ_ONLY / no-TAG-permission user)?"
          a: "A user holding NO `TAG_*` permission (or only an unrelated permission such as `DATA_ENTITY_TAGS_UPDATE`) gets 200 + the full tag directory. `getPopularTagList` has no permission requirement beyond `authenticated()` — there is no wrong-role rejection path for this read endpoint. This is the open-read posture: every authenticated user can enumerate the directory."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "The ONLY gate is the catch-all `authenticated()` in the security filter chain (`AuthorizationCustomizer.java:29-30`) — there is NO endpoint-specific permission gate. The controller method has no `@PreAuthorize` (`TagController.java:36-44`); `TagServiceImpl.listMostPopular` has no `@PreAuthorize` and no programmatic permission check (`TagServiceImpl.java:72-77`); `ReactiveTagRepositoryImpl.listMostPopular` has none. The gate is 'authenticated, full stop'."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 (no @PreAuthorize) + TagServiceImpl.java:72-77 (no check) + SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 (the catch-all)"
  resource_boundaries:
    - location: "TagController.java:36-44 (getPopularTagList — a pure read path)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No. `getPopularTagList` is a pure read — `tagService.listMostPopular` issues only SELECT statements (the paginate query + the UNION-ALL CTE + the `fetchCount` SELECT); no INSERT/UPDATE/DELETE anywhere in the chain. Two concurrent calls cannot corrupt state. Each call may observe a slightly different directory snapshot if a concurrent write commits between the paginate query and the `fetchCount` query (no `@ReactiveTransactional` wraps `listMostPopular` — TagServiceImpl.java:72-77 has no annotation) — so `pageInfo.total` and the `items` count could momentarily disagree under heavy concurrent tag creation, but this is a benign read-skew, not corruption."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 (no @ReactiveTransactional) + ReactiveTagRepositoryImpl.java:137-167 (SELECT-only) + ReactiveAbstractCRUDRepository.java:229-234 (the separate fetchCount SELECT)"
        - q: "Is the call replay-safe?"
          a: "Yes — fully idempotent. `getPopularTagList` is a read; the same `page`/`size`/`query`/`ids` against an unchanged directory returns the same response. No side effects (no DB write, no activity-feed entry, no search-vector refresh)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 (read-only delegation)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts this endpoint. No `@Cacheable` annotation on `getPopularTagList`, `TagServiceImpl.listMostPopular`, or `ReactiveTagRepositoryImpl.listMostPopular`; no manual cache writes; no platform-level cache layer visible in the chain. Every `GET /api/tags` is a fresh DB round-trip — confirmed by the absence of any cache annotation across all three layers."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 (no @Cacheable) + TagServiceImpl.java:72-77 (no @Cacheable) + ReactiveTagRepositoryImpl.java:137-167 (no @Cacheable)"
  request_inputs:
    - location: "TagController.java:37 (Integer page)"
      input_kind: query-param
      input_name: "page"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Which page of the paginated tag list to fetch — a 1-based page index."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37 + openapi.yaml:348 (PageParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller forwards `page` to `tagService.listMostPopular(query, ids, page, size)` (TagController.java:42) -> TagServiceImpl.listMostPopular forwards to reactiveTagRepository.listMostPopular (TagServiceImpl.java:75) -> ReactiveTagRepositoryImpl.listMostPopular computes the SQL OFFSET as `(page - 1) * size` and passes it to `paginate(...)` (ReactiveTagRepositoryImpl.java:148)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:148"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `page` is used as the page index; the `(page-1)*size` arithmetic is the standard 1-based-page-to-OFFSET translation."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation. (The only `page` hazard is `page<=0` producing a negative OFFSET → SQL error; recorded under stress_findings.tunables / bugs_limitations_corner_cases, not a naming-drift issue.)"
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `page` has no closer-aligned unused column; it is a pagination control, not an entity attribute."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37"
      routes_to_finding: "bugs_limitations_corner_cases (the page<=0 negative-OFFSET corner case) — no naming drift"
    - location: "TagController.java:38 (Integer size)"
      input_kind: query-param
      input_name: "size"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "How many tags to return per page — the page-size limit."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:38 + openapi.yaml:349 (SizeParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller forwards `size` to `tagService.listMostPopular(...size)` (TagController.java:42) -> TagServiceImpl.listMostPopular (TagServiceImpl.java:75) -> ReactiveTagRepositoryImpl.listMostPopular passes `size` as the LIMIT to `paginate(...)` (ReactiveTagRepositoryImpl.java:148) AND as a factor in the OFFSET expression `(page-1)*size`."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:148"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `size` is the SQL LIMIT (page size). The caveat is operational, not naming: `size` is also the truncation boundary that surfaces the LSN-019 drift (the OLDEST `size` tags are selected). The NAME (`size` = page size) is honest; the SURROUNDING behaviour (which `size` rows) is the drift documented under name_behavior_pairs."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — `size` does what the name says (page size). The misleading element is the ENDPOINT name (`popular`), not the `size` parameter name — see name_behavior_pairs[0]."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:38"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `size` is a pagination control, no closer-aligned unused column."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:38"
      routes_to_finding: "no naming drift; the size-clamp absence is in bugs_limitations_corner_cases"
    - location: "TagController.java:39 (String query)"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A search string used to filter the tag list. The name `query` is fairly generic but, in the context of a tag-list endpoint, implies a tag-name search."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:39 + openapi.yaml:350 (SearchParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller forwards `query` to `tagService.listMostPopular(query, ...)` (TagController.java:42) -> TagServiceImpl.listMostPopular (TagServiceImpl.java:75) -> ReactiveTagRepositoryImpl.listMostPopular calls `listCondition(query)` (ReactiveTagRepositoryImpl.java:140) -> ReactiveAbstractCRUDRepository.listCondition adds `nameField.containsIgnoreCase(nameQuery)` when `query` is non-empty (ReactiveAbstractCRUDRepository.java:242-243). `nameField` resolves to `tag.name` (the recordTable's DEFAULT_NAME_FIELD column, ReactiveAbstractCRUDRepository.java:63)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:140 + ReactiveAbstractCRUDRepository.java:63, 240-243"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `query` filters by tag name via a case-insensitive substring match (`containsIgnoreCase`). It searches exactly the field a caller would expect (`tag.name`). One caveat to note (not a drift): the match is case-INSENSITIVE here, whereas the directory-WRITE existence-check (`listByNames` -> `TAG.NAME.in(names)`) is case-SENSITIVE — so `query=post` matches both 'Postgres' and 'postgres' if both exist, but the write path treats them as distinct rows. The asymmetry is a cross-path UX inconsistency, recorded in invariants."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:242-243 (containsIgnoreCase) + ReactiveTagRepositoryImpl.java (listByNames TAG.NAME.in — case-sensitive, per the ReactiveTagRepositoryImpl sidecar)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — `query` does what the name implies (a tag-name substring search). No silent scope translation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:242-243"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `query` is correctly bound to `tag.name`; there is no other name-like column on the `tag` table that a search should have used instead."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:63 (nameField = DEFAULT_NAME_FIELD)"
      routes_to_finding: "no drift; the case-sensitivity asymmetry between read-search and write-lookup is in invariants"
    - location: "TagController.java:40 (List<Long> ids)"
      input_kind: query-param
      input_name: "ids"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Restrict the result to tags whose id is in the supplied set — an explicit tag-id filter."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:40 + openapi.yaml:351 (IdsParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller forwards `ids` to `tagService.listMostPopular(query, ids, ...)` (TagController.java:42) -> TagServiceImpl.listMostPopular (TagServiceImpl.java:75) -> ReactiveTagRepositoryImpl.listMostPopular: `if (CollectionUtils.isNotEmpty(ids)) conditions.add(TAG.ID.in(ids))` (ReactiveTagRepositoryImpl.java:141-142). `ids` binds to the `TAG.ID` column. Note: `ids` is also threaded into `fetchCount(query, ids)` (line 165) so the page total honours the id filter too."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:141-142, 165"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `ids` binds directly to `TAG.ID.in(ids)`; the parameter name `ids` and the SQL column `TAG.ID` are the same concept. Empty `ids` is treated as no-filter (skipped via the `isNotEmpty` guard), not as zero-results — the documented optional-filter contract."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:141-142"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — `ids` binds to `TAG.ID` with no translation. The only subtlety is the empty-collection = no-filter semantics, which matches the OpenAPI optional-parameter contract."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:141-142"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `ids` is correctly bound to the primary-key column `TAG.ID`; there is no closer-aligned unused field."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:141-142"
      routes_to_finding: "no drift — ids binds to TAG.ID directly"
  probes_emitted:
    - probe_id: P-029
      question: "page/size degenerate-input handling for getPopularTagList — what exact HTTP status does a null / negative / zero page or size produce? (negative OFFSET / negative LIMIT reach PostgreSQL; null Integer unboxes to NullPointerException at the int-param service boundary). Trace says 500 for negative/null and 400 for non-numeric, but the exact surfaced status needs runtime confirmation."
      probe_path: "lineage/odd-platform/probes/P-029.yaml"
  stress_summary:
    triggers_total: 8
    questions_total: 35
    answers_static_inferred: 32
    answers_probe_needed: 2
    answers_reference: 1
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — `getPopularTagList` is on the HTTP UI/API surface (`GET /api/tags`). Under `DISABLED`, Spring Security is not engaged and the endpoint is open. `S2S` is orthogonal — this endpoint is not on the ingestion path (`/ingestion/**`).
- **ingestion_filter_relevance**: `NO — UI/API surface at GET /api/tags, not /ingestion/**`. The endpoint READS a directory that the ingestion path can mutate (via `ExternalTagIngestionRequestProcessor`), but the endpoint itself does not participate in the ingestion filter.
- **authorization_assertions**:
  - "GET `/api/tags` (getPopularTagList) has NO endpoint-specific authorization gate — no `SecurityRule` entry exists for the GET verb on `/api/tags` — evidence: SecurityConstants.java:138-142 (only POST/PUT/DELETE entries)"
  - "The only access control is the catch-all `pathMatchers(\"/**\").authenticated()` — evidence: AuthorizationCustomizer.java:29-30"
  - "No `@PreAuthorize` on the controller method — evidence: TagController.java:36-44"
  - "No `@PreAuthorize` and no programmatic permission check in the downstream `TagServiceImpl.listMostPopular` — evidence: TagServiceImpl.java:72-77"
- **owner_scoping**: `N/A — the Tag directory has no owner concept`. The `tag` table has no `owner_id` column; `getPopularTagList` returns tags across the whole flat global namespace with no per-Owner filtering. (Confirmed against the `ReactiveTagRepositoryImpl` sidecar's `owner_scoping: N/A`.)
- **data_exposure**:
  - "`Mono<ResponseEntity<TagsResponse>>` — up to `size` `Tag` records (`id, name, important, external, usedCount`) plus `pageInfo` -> any authenticated user under LOGIN_FORM/OAUTH2/LDAP, regardless of `TAG_*` permissions; or any caller at all under DISABLED. — evidence: TagController.java:36-44 + openapi.yaml:352-358"
  - "The exposed data is the ENTIRE tag directory (paginated) — there is no scope restriction; an attacker enumerating `page` from 1 upward retrieves every tag name in the deployment. — evidence: ReactiveTagRepositoryImpl.java:137-167 (no scope filter beyond optional `query`/`ids`)"
- **known_security_gaps**:
  - "Open-read posture — any authenticated user can enumerate the whole global tag directory via `getPopularTagList` regardless of `TAG_*` grants. The live permissions doc page (WebFetched 2026-05-20, status 200, inherited) does not document this. — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 — severity: MEDIUM"
  - "Authorization is path-pattern-matched at the security filter chain, not annotation-based — a path rename (e.g. `/api/tags` -> `/api/tags/popular`, the REFACTOR-217 drift class) would silently change which `SecurityRule` set applies; for this read endpoint the effect would be benign (still `authenticated()`), but the fragility is shared with the write endpoints on the same controller. — evidence: SecurityConstants.java:138-142 (PathPatternParserServerWebExchangeMatcher entries) — severity: LOW"
  - "No request-input validation on `page`/`size`/`query`/`ids` — `size` has no upper clamp, `page`/`size` have no lower bound; an unvalidated `size=100000` forces a full-directory aggregation, and `page<=0`/`size<=0` produce 500s. — evidence: TagController.java:37-42 (no `@Valid`, no `@Max`, no `@Min`) — severity: LOW"

## performance

- **hot_paths**:
  - "`getPopularTagList` runs on every UI page-load that renders the Catalog Overview 'Top Tags' chip strip, the tag-search facet, and the data-entity / dataset-field detail-page tag dropdown — a high-frequency read. — evidence: TagController.java:36-44 + the audiences analysis"
  - "Downstream `ReactiveTagRepositoryImpl.listMostPopular` executes a paginate query + a UNION-ALL CTE over `tag_to_data_entity` + `tag_to_dataset_field` + a separate `fetchCount` SELECT — three SQL round-trips per call. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392 + ReactiveAbstractCRUDRepository.java:229-234"
- **throughput_characteristics**:
  - "Reactive `Mono` end-to-end — non-blocking; the jOOQ-reactive Postgres driver releases the connection between awaits. — evidence: TagController.java:37 (Mono return) + TagServiceImpl.java:73 (Mono)"
  - "Single read per request — no bulk shape, no streaming; the whole `Page<TagDto>` is materialised (`collectList()` at ReactiveTagRepositoryImpl.java:161) before mapping. — evidence: ReactiveTagRepositoryImpl.java:160-166"
- **resource_allocation**:
  - "Memory per call is bounded by `size` — but `size` is unclamped (see below), so a `size=100000` request materialises the whole filtered directory into a `List<Record>` via `collectList()`. — evidence: ReactiveTagRepositoryImpl.java:161 + TagController.java:37-42 (no clamp)"
  - "One DB connection per round-trip; `getPopularTagList` is NOT `@ReactiveTransactional` (`TagServiceImpl.listMostPopular` has no annotation) so the three SELECTs may run on different connections from the pool. — evidence: TagServiceImpl.java:72-77 (no @ReactiveTransactional)"
  - "No client-side or server-side cache — every call is a fresh round-trip. — evidence: TagController.java:1-53 + TagServiceImpl.java:72-77 (no @Cacheable)"
- **scaling_characteristics**:
  - "Stateless — `getPopularTagList` holds no per-call state; the controller scales horizontally. — evidence: TagController.java:36-44"
  - "No locking on the read path — pure SELECTs, no `FOR UPDATE`, no advisory lock. — evidence: ReactiveTagRepositoryImpl.java:137-167"
  - "`size` is uncapped — `size=100000` forces the inner paginate over the whole `TAG` table sorted by `TAG.ID ASC`, then a UNION-ALL aggregation over the full result; for a large directory this degrades response time with no protection. — evidence: TagController.java:37-42 + ReactiveTagRepositoryImpl.java:138-167 (no clamp)"
- **known_performance_gaps**:
  - "No `size` clamp on `getPopularTagList` — an unclamped `size` allows a caller to force a full-directory UNION-ALL aggregation + full-result `collectList()`. — evidence: TagController.java:37-42 — severity: LOW"
  - "The UNION-ALL CTE over `tag_to_data_entity` + `tag_to_dataset_field` runs on every popular-tags fetch with no materialized view and no cache; for very large directories this is expensive. The LSN-019 drift compounds the waste — the CTE aggregates counts over the WRONG (oldest) rows. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392 — severity: LOW"

## upstream_callers

- entry_point: "rest:GET /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.getPopularTagList"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:36-44 — `getPopularTagList` is the `@Override` implementation of the generated `TagApi` abstract method; one invocation per HTTP request."
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:Catalog Overview (Top Tags chip strip)"
  caller_node: "ts react-component:Catalog-Overview Top-Tags component (per the existing TagController controller-class sidecar's audience analysis; the UI component is not read in this session)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:36-44 — the 'Top Tags' surface fetches `GET /api/tags?size=30`; the exact UI dispatch multiplicity (whether a React useEffect fires it once or more per mount) is a UI-side fact — REFERENCE to the (not yet enriched) UI sidecar for the Catalog-Overview Top-Tags component."
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:tag-search-facet / data-entity detail tag-dropdown"
  caller_node: "ts react-component:tag-search / tag-management UI control (not read in this session)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:36-44 + openapi.yaml:350 (SearchParam) — the tag-search facet and the per-entity tag dropdown call `GET /api/tags?query=...` to populate selectable tags; UI multiplicity is REFERENCE to the (not yet enriched) UI sidecar."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns a `TagsResponse` payload (`pageInfo` + up to `size` `Tag` items) to the caller — the sole externally-observable output of this read endpoint."
  evidence: "TagController.java:42-43 (`.map(ResponseEntity::ok)`) + openapi.yaml:352-358 (the TagsResponse 200 body)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/tags"
    - "ui_route:Catalog Overview (Top Tags chip strip)"
    - "ui_route:tag-search-facet / data-entity detail tag-dropdown"

- side_effect_class: db-write
  description: "NONE — `getPopularTagList` is a pure read. The downstream chain (`TagServiceImpl.listMostPopular` -> `ReactiveTagRepositoryImpl.listMostPopular`) issues only SELECT statements: the paginate query, the UNION-ALL CTE, and the `fetchCount` SELECT. No INSERT/UPDATE/DELETE, no view_count increment, no activity-feed entry, no search-vector refresh."
  evidence: "TagServiceImpl.java:72-77 (read-only delegation) + ReactiveTagRepositoryImpl.java:137-167 (SELECT-only chain) + ReactiveAbstractCRUDRepository.java:229-234 (fetchCount SELECT)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167, 373-392 + openapi.yaml:342-360 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- concepts.entities.TagApi ← TagController.java:18, 36-37
- concepts.entities.page/size/query/ids ← TagController.java:37-41 + openapi.yaml:347-351
- concepts.entities.TagsResponse ← openapi.yaml:352-358
- concepts.operations.getPopularTagList ← TagController.java:36-44
- concepts.operations.listMostPopular-delegation ← TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167
- concepts.invariants.popularity-promise-vs-SQL ← openapi.yaml:344-345 + ReactiveTagRepositoryImpl.java:148, 158
- concepts.invariants.no-GET-SecurityRule ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- concepts.invariants.page-total-semantics ← ReactiveTagRepositoryImpl.java:165 + ReactiveAbstractCRUDRepository.java:229-234
- concepts.invariants.no-status-code-drift ← openapi.yaml:353 + TagController.java:43
- concepts.invariants.query-case-insensitive ← ReactiveAbstractCRUDRepository.java:242-243
- dependencies_semantic.requires-feature.* ← TagController.java:18, 20, 42 + ReactiveTagRepositoryImpl.java:137-167 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-31
- tests_coverage_semantic.test_files ← odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:239-267 (per the existing ReactiveTagRepositoryImpl + TagController sidecars)
- docs_link_semantic.declared_docs ← TagController.java:1-53 (no @docs token observed during the end-to-end read)
- docs_link_semantic.inferred_docs ← inherited verification from the TagController controller-class sidecar (WebFetch 2026-05-20, status 200)
- docs_link_semantic.doc_drift_findings ← openapi.yaml:345 + ReactiveTagRepositoryImpl.java:148, 158
- implicit_adrs.[0] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- implicit_adrs.[1] ← TagController.java:18, 36-44
- bugs_limitations_corner_cases.[0] ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:140-167, 373-392 + lineage/odd-platform/probes/P-010.yaml
- bugs_limitations_corner_cases.[1] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagController.java:36-44
- bugs_limitations_corner_cases.[2] ← TagController.java:37-42 + ReactiveTagRepositoryImpl.java:138-167
- bugs_limitations_corner_cases.[3] ← TagController.java:37-42
- bugs_limitations_corner_cases.[4] ← TagController.java:37-42 + TagServiceImpl.java:73-74 + ReactiveTagRepositoryImpl.java:148
- security.authorization_assertions ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagController.java:36-44 + TagServiceImpl.java:72-77
- security.data_exposure ← TagController.java:36-44 + openapi.yaml:352-358 + ReactiveTagRepositoryImpl.java:137-167
- performance.hot_paths ← TagController.java:36-44 + ReactiveTagRepositoryImpl.java:137-167, 373-392
- performance.scaling_characteristics ← TagController.java:37-42 + ReactiveTagRepositoryImpl.java:138-167
- upstream_callers.[0] ← TagController.java:36-44
- downstream_side_effects.[0] ← TagController.java:42-43 + openapi.yaml:352-358
- stress_findings.name_behavior_pairs[0] ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:140-167, 373-392 + openapi.yaml:344-345 + lineage/odd-platform/probes/P-010.yaml + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32
- stress_findings.orderings ← ReactiveTagRepositoryImpl.java:148, 158, 373-392
- stress_findings.auth_gates ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-31 + TagController.java:36-44 + TagServiceImpl.java:72-77
- stress_findings.request_inputs ← TagController.java:37-42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:140-142, 148, 165 + ReactiveAbstractCRUDRepository.java:63, 240-243
- stress_findings.probes_emitted.P-029 ← lineage/odd-platform/probes/P-029.yaml

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM — the OpenAPI drift claim is HIGH (the spec line and the SQL are both first-hand read); the live-doc excerpts are inherited from the sibling sidecar's WebFetch within the stale-probe cadence, not re-fetched this session.
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM — the REST entry point is HIGH; the two UI entry points are unresolved REFERENCE entries pending UI-sidecar enrichment.
- downstream_side_effects: HIGH
- stress_findings: HIGH — the load-bearing operator-observable claim (the LSN-019 popularity drift) is STATIC-INFERRED via an end-to-end JOOQ chain trace read first-hand this session, empirically confirmed by the maintainer 2026-05-20, and pinned by P-010. Of 35 stress questions, only 2 resolve to PROBE-NEEDED (the page/size degenerate-input HTTP-status question — non-load-bearing) and 1 to REFERENCE (a UI-side re-sort question).

## Maintainer notes

(none — no prior sidecar existed for this node)
