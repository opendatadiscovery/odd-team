---
node_id: "odd-platform java TagController controller-method:getPopularTagList"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 82812cdf
enriched_at_branch: "contrib/CTRIB-007-tag-popularity-ordering (base: main @ 6f356b72)"
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-refresh-2026-06-12-CTRIB-007-getPopularTagList
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
resulting `TagsResponse` payload to a 200. **As of this commit (82812cdf, the CTRIB-007 /
GitHub #1773 Thread A fix, milestone 0.28.0) the popularity promise is HONOURED:**
`ReactiveTagRepositoryImpl.listMostPopular` aggregates per-tag usage (tag_to_data_entity
+ tag_to_dataset_field via a UNION-ALL CTE) over the FULL filtered tag directory first
(`ReactiveTagRepositoryImpl.java:144-157`), then paginates ordering by summed usage count
DESC with `TAG.ID ASC` as the deterministic tie-break (`:159-162`). *Historical note
(dated): until this fix — i.e. on main @ 6f356b72 and every published release through
0.27.x — the SQL truncated to `size` rows by `TAG.ID ASC` BEFORE counting, returning the
OLDEST `size` tags (the LSN-019 / PLT-026 drift, empirically reproduced 2026-05-20).*
The endpoint still carries **no SecurityRule** — `SecurityConstants.SECURITY_RULES`
(`SecurityConstants.java:138-142`) registers POST/PUT/DELETE entries for `/api/tags` but
no GET entry, so the request falls through to the catch-all `pathMatchers("/**").authenticated()`
(`AuthorizationCustomizer.java:29-30`): any authenticated user can enumerate the entire
global tag directory regardless of which `TAG_*` permissions they hold.

## concepts

- entities: [
    "`TagApi` — OpenAPI-generated controller interface; `getPopularTagList` is an `@Override` of its generated abstract method (`TagController.java:36-37`).",
    "`page: Integer` — query parameter, OpenAPI `PageParam` (`openapi.yaml:348`); flows to `(page - 1) * size` as the SQL OFFSET expression (`ReactiveTagRepositoryImpl.java:162`).",
    "`size: Integer` — query parameter, OpenAPI `SizeParam` (`openapi.yaml:349`); flows to the SQL LIMIT inside `paginate(...)` (`ReactiveTagRepositoryImpl.java:162`). Post-fix, `size` bounds only the OUTPUT rows — it no longer determines WHICH rows are candidates.",
    "`query: String` — query parameter, OpenAPI `SearchParam` (`openapi.yaml:350`); case-insensitive substring name-filter via `nameField.containsIgnoreCase(nameQuery)` (`ReactiveAbstractCRUDRepository.java:242-243`).",
    "`ids: List<Long>` — query parameter, OpenAPI `IdsParam` (`openapi.yaml:351`); optional tag-id-set filter — adds `TAG.ID.in(ids)` only when non-empty (`ReactiveTagRepositoryImpl.java:141-143`).",
    "`ServerWebExchange` — Spring WebFlux reactive request context; injected (`TagController.java:41`) but unused by this method.",
    "`TagsResponse` — OpenAPI paginated response wrapper `{pageInfo, items: List<Tag>}` returned to the caller (`openapi.yaml:358`); produced by the service (`TagService.java:22` returns `Mono<TagsResponse>`).",
    "`Page<TagDto>` — the repository-layer paginated shape (`ReactiveTagRepositoryImpl.java:138` returns `Mono<Page<TagDto>>`) that `tagMapper::mapToTagsResponse` converts at the service (`TagServiceImpl.java:75-76`).",
    "`TagService` — the single injected service bean (`TagController.java:20`); this method invokes exactly one of its methods (`listMostPopular`)."
  ]
- operations: [
    "`getPopularTagList(Integer page, Integer size, String query, List<Long> ids, ServerWebExchange exchange)` (`TagController.java:36-44`) — 2-line reactive read: `tagService.listMostPopular(query, ids, page, size).map(ResponseEntity::ok)`. Note the argument-order swap: the controller signature is `(page, size, query, ids)`; the service call is `(query, ids, page, size)` (line 42).",
    "delegation to `TagServiceImpl.listMostPopular` (`TagServiceImpl.java:72-77`) — straight-through `reactiveTagRepository.listMostPopular(query, ids, page, size).map(tagMapper::mapToTagsResponse)`; no re-sort, no filter, no auth check at the service layer.",
    "delegation to `ReactiveTagRepositoryImpl.listMostPopular` (`ReactiveTagRepositoryImpl.java:137-171`) — the FIXED SQL pipeline: (a) `listCondition(query)` builds the soft-delete + optional name-substring conditions (line 140; soft-delete via `ReactiveAbstractSoftDeleteCRUDRepository.java:87-88`); (b) optional `TAG.ID.in(ids)` added when `ids` non-empty (lines 141-143); (c) `homogeneousQuery = selectFrom(TAG).where(conditions)` — the FULL filtered directory, unpaginated (lines 144-145); (d) `tag_cte` = that full select (line 150); (e) `getDataEntityWithDatasetFields` UNION-ALLs `tag_to_data_entity` + `tag_to_dataset_field` usage counts over ALL CTE rows (line 151 → lines 377-396); (f) `aggregatedSelect` groups per tag, summing the two usage counts and boolOr-ing the `external` flag (lines 153-157); (g) `paginate(aggregatedSelect, [OrderByField(count, DESC), OrderByField(TAG.ID, ASC)], (page-1)*size, size)` applies the ordering + window AFTER aggregation (lines 159-162 → `ReactiveAbstractCRUDRepository.java:294-299` → `JooqQueryHelper.java:62-89`); (h) `pageifyResult` with `fetchCount(query, ids)` as the empty-page total supplier (lines 164-170)."
  ]
- invariants: [
    "Pure 2-line delegation — no business logic, no transformation, no programmatic auth check in this method body (`TagController.java:36-44`); it is a stub-implementation of the generated `TagApi.getPopularTagList`.",
    "The popularity promise made at three layers (method name `getPopularTagList`; service method `listMostPopular`; OpenAPI `description: 'Gets the list of existing tags sorted by popularity'` at `openapi.yaml:345`) is HONOURED at this commit: the executed SQL orders the aggregated directory by `count DESC, tag.id ASC` before applying LIMIT/OFFSET (`ReactiveTagRepositoryImpl.java:159-162` + `JooqQueryHelper.java:73-82`). Tie-break is deterministic (`TAG.ID ASC`). Verified at runtime 2026-06-12: e2e IT-005 GREEN on this commit + RED on pre-fix main 6f356b72 (`integration-tests/run-log/2026-06-12-IT-005.md`).",
    "`getPopularTagList` is the ONLY endpoint among the four on `/api/tags` with no `SecurityRule` entry — `SecurityConstants.SECURITY_RULES` has POST/PUT/DELETE entries for `/api/tags` (`SecurityConstants.java:138-142`) but no GET entry; the request inherits the catch-all `authenticated()` (`AuthorizationCustomizer.java:29-30`).",
    "Page total semantics are correct and, for non-empty pages, snapshot-consistent with the returned rows: `_total` is a `count().over()` window computed in the SAME statement as the page rows (`JooqQueryHelper.java:72, 75-82`, consumed at `:113`); the separate `fetchCount(query, ids)` SELECT (`ReactiveTagRepositoryImpl.java:169` → `ReactiveAbstractCRUDRepository.java:229-234`) fires only when the page is EMPTY (`JooqQueryHelper.java:118-126`) and applies BOTH filters, so `pageInfo.total` always reflects the full filtered directory size.",
    "OpenAPI declares only a `'200'` response for this read endpoint (`openapi.yaml:353`); the controller returns 200 via `ResponseEntity::ok` (line 43) — NO status-code drift on this method (unlike sibling `createTag`, which returns 200 against an OpenAPI-declared 201 at `openapi.yaml:372`).",
    "`query` substring matching is case-insensitive (`containsIgnoreCase`, `ReactiveAbstractCRUDRepository.java:242-243`) — asymmetric with the case-SENSITIVE exact-name lookup the directory-write path uses (`listByNames` → `TAG.NAME.in(names)`, `ReactiveTagRepositoryImpl.java:120-125`); a user can search 'post' and see both 'Postgres' and 'postgres' if both rows exist."
  ]
- audiences: [
    "odd-platform-ui-end-user — the response feeds the Catalog Overview 'Top Tags' chip strip (`Overview.tsx:20-23`), the app-boot tags preload (`App.tsx:50`), the Management → Tags tab listing (`TagsList.tsx:45-58`), the tag autocompletes on data-entity / term / dataset-field detail pages, and the DataQuality tag filter.",
    "odd-api-consumer — programmatic clients of `GET /api/tags` via the OpenAPI spec.",
    "any-authenticated-user — under LOGIN_FORM / OAUTH2 / LDAP, every authenticated principal can call this endpoint and enumerate the whole directory regardless of `TAG_*` grants (open-read posture).",
    "platform-operator — an operator reading 'Top Tags' to assess vocabulary health now sees the genuinely most-used tags (post-fix); on every published release through 0.27.x they see the OLDEST tags for any directory beyond `size`."
  ]

## dependencies_semantic

- requires-feature: [
    "`TagApi` OpenAPI-generated controller interface — supplies the route binding for `getPopularTagList` (generated from `openapi.yaml:342-358`).",
    "`TagService.listMostPopular` (`TagService.java:22`) — the sole service method this endpoint calls (`TagServiceImpl.java:72-77`).",
    "`ReactiveTagRepositoryImpl.listMostPopular` (`ReactiveTagRepositoryImpl.java:137-171`) — the SQL surface; the popularity ordering is implemented here (aggregate-first, paginate-after).",
    "`JooqQueryHelper.paginate` (`JooqQueryHelper.java:62-89`, reached via `ReactiveAbstractCRUDRepository.java:294-299`) — now load-bearing FOR correctness: it applies `ORDER BY count DESC, id ASC` + LIMIT/OFFSET over the aggregated select and emits the `_total`/`_row`/`_next` window metadata.",
    "`JooqQueryHelper.homogeneityCheck` (`JooqQueryHelper.java:138-154`) — the enabling change for the fix: unqualified-name (computed alias) fields are exempted from the one-table invariant (comment at lines 143-145), which is REQUIRED for `paginate(aggregatedSelect, ...)` not to throw — the aggregated select's `count`/`external` aliases are unqualified, and the pre-exemption check would have compared their name-part against the `union_usages` qualifier and raised 'heterogeneous'.",
    "`SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:138-142`) — the ABSENCE of a GET entry is load-bearing for this endpoint's auth posture.",
    "`AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:20-31`) — the catch-all `pathMatchers(\"/**\").authenticated()` (lines 29-30) that this endpoint falls through to."
  ]
- requires-config: [] — N/A. This method reads no Spring properties; behaviour is unconditional.
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `TagController` is a `@RestController` (`TagController.java:16`); `getPopularTagList` returns `Mono<ResponseEntity<TagsResponse>>`.",
    "Spring Security ReactiveSecurityWebFilterChain — `AuthorizationCustomizer` is the access wiring.",
    "jOOQ + reactive Postgres driver (via `ReactiveTagRepositoryImpl`) — the actual query execution path."
  ]
- couples-to: [
    "`TagApi` (`TagController implements TagApi` at `TagController.java:18`) — signature dictated by `openapi.yaml:342-358`.",
    "`TagService` (constructor-injected, `TagController.java:20`) — the controller's `(query, ids, page, size)` argument order must match the service contract.",
    "`SecurityConstants.SECURITY_RULES` — coupled by URL convention (path-pattern match `/api/tags` + HTTP verb), NOT by code reference; a path rename would silently change which rules apply (REFACTOR-217 drift class)."
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Popularity ordering over a directory LARGER than the page size — the most-used tags reach page 1 however young (highest ids); ordering is `usage DESC, id ASC` ties; `total` counts the full filtered directory; `hasNext` true when truncated. The PLT-026 / LSN-019 regression guard."
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:276-335 (`testListMostPopularReturnsGloballyMostUsedTags` — failing-first: javadoc at lines 270-275 names PLT-026/LSN-019; order-SENSITIVE `containsExactly` at line 331; 5 old low-use tags + 3 young high-use tags, pageSize 5; asserts the 3 most-used youngest lead, then id-ASC fill, `total=8`, `hasNext=true`, top `usedCount=3`)"]
  - behaviour: "Same contract verified END-TO-END at the rendered UI: the Overview 'Top Tags' strip shows all 5 seeded most-used (youngest) tags ranked above 30 older low-use tags. GREEN on this commit (1 passed, 3.8s) + RED on pre-fix main @ 6f356b72 (strip rendered the oldest window) — the complete flip proof."
    test_class: integration
    test_files: ["integration-tests/protocols/IT-005-top-tags-ordering.md (odd-team; lane: feature-complete + ui-e2e since the 2026-06-12 flip)", "integration-tests/run-log/2026-06-12-IT-005.md (GREEN @ 82812cdf + RED @ main 6f356b72; includes an in-band API capture: `GET /api/tags?page=1&size=30` returned the 5 most-used tags FIRST, then the olds — total 35)"]
  - behaviour: "`query` substring filter — `listMostPopular(testName, ...)` returns only the renamed matching tags with correct total."
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:238-268 (`testListMostPopular` — order-blind `containsExactlyInAnyOrder`; covers the filter path, not ordering)"]
- uncovered_behaviours:
  - behaviour: "Controller perimeter — no test exercises `TagController.getPopularTagList` itself (param binding, the argument-order swap at line 42, the 200 mapping). Coverage starts at the repository layer and at the e2e layer; the controller+service hop is only covered transitively by IT-005."
    test_class: integration
    criticality: MEDIUM
    note: "grep `TagController` across odd-platform-api/src/test returns ZERO files at this branch (re-verified 2026-06-12)."
  - behaviour: "`getPopularTagList` open-read posture — assert a user holding NO `TAG_*` permission gets 200 + the full directory (the absence of a GET SecurityRule)."
    test_class: security
    criticality: MEDIUM
  - behaviour: "`getPopularTagList` unauthenticated access — assert 401 (or 302 for LOGIN_FORM) for an unauthenticated caller under LOGIN_FORM/OAUTH2/LDAP; 200 under DISABLED."
    test_class: security
    criticality: MEDIUM
  - behaviour: "`size` boundary — `size=0` returns empty `items` with correct `pageInfo.total`; large `size` accepted with no clamp."
    test_class: performance
    criticality: LOW
  - behaviour: "`page`/`size` degenerate inputs — `page=0` / `page=-1` / `size=-1` reach PostgreSQL (negative OFFSET / negative LIMIT); assert the surfaced status is a clean 4xx rather than a 500."
    test_class: integration
    criticality: MEDIUM
    note: "stress_findings.tunables records these as PROBE-NEEDED → P-029 (still pending; scope unaffected by the ordering fix)."
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:238-268, 276-335"
  - "integration-tests/protocols/IT-005-top-tags-ordering.md + integration-tests/e2e/specs/top-tags-ordering.spec.ts (odd-team e2e)"
- gaps: |
    The former highest-leverage gap — integration coverage of the popularity-ordering
    contract — is CLOSED at two layers as of 2026-06-12: the failing-first repository
    test (`testListMostPopularReturnsGloballyMostUsedTags`, RED on pre-fix main) and the
    e2e IT-005 (GREEN-on-fix / RED-on-ref:main, run-log evidence). The remaining gaps:
    (1) the controller layer itself has zero direct tests — the argument-order swap at
    `TagController.java:42` is pinned by nothing below the e2e tier; (2) no
    `TagControllerSecurityTest` — the open-read posture and any future path-pattern drift
    would not surface in CI; (3) degenerate page/size inputs (P-029) remain unverified at
    runtime. The worst-covered test_class on this node is now `security`.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `TagController.java` (verified during the end-to-end read of the 53-line file — no `@docs`, `// @docs:`, or javadoc `@docs:` token present).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Manual Object Tagging page; the canonical destination for the 'Top Tags' surface this endpoint feeds. (Note: the un-prefixed `/data-discovery/tagging` variant returns 404 — verified this session.)"
    last_verified_at: "2026-06-12T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live page (WebFetch 2026-06-12, status 200; title 'Manual Object Tagging') carries the
      PRE-fix caveat, verbatim: "The 'Top tags' strip on Catalog Overview and the Tag-facet
      seed list are sorted by tag id, not by popularity." — "The platform's `listMostPopular`
      query truncates the tag directory to the requested page size **before** computing the
      per-tag usage count" — "a catalog with 35 tags of equal popularity and `size=30` returns
      the 30 oldest tags by id" — "The endpoint's OpenAPI summary describes it as 'sorted by
      popularity'; the implementation cannot honour that contract today without an SQL
      restructure."
    pending_release: "0.28.0"
    train_ref: "documentation release/0.28.0 train — the fixed-behaviour note migrates at the release gate; the live manual correctly describes the latest PUBLISHED release (0.27.x), where the caveat is true."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names the three `TAG_*` write permissions; checked for whether the GET open-read posture is documented."
    last_verified_at: "2026-06-12T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live page (WebFetch 2026-06-12, status 200; title 'Permissions') lists TAG_CREATE
      ("Allows creating a new tag."), TAG_UPDATE, TAG_DELETE. It now ALSO documents the
      side-door write paths, verbatim: "`TAG_CREATE` is not the only path that mints new
      tags — four `*_TAGS_UPDATE` permissions (data entity, dataset field, term) plus
      collector ingestion all silently create tag rows for novel names." It does NOT
      document that GET `/api/tags` has no RBAC gate beyond authentication.
- doc_drift_findings:
  - "**CLOSED at 82812cdf (was LSN-019 / PLT-026 Thread A):** the OpenAPI description `'Gets the list of existing tags sorted by popularity'` (`openapi.yaml:345`) is now an ACCURATE spec claim — the executed SQL orders the full aggregated directory by `count DESC, tag.id ASC` before windowing (`ReactiveTagRepositoryImpl.java:159-162`). No spec correction needed; the code moved to the spec."
  - "**Release-train, tracked, not actionable here:** the live tagging page (fetched 2026-06-12, status 200) still describes the pre-fix oldest-by-id caveat — correct for the latest published release (0.27.x), which ships the unfixed code. The caveat's retirement rides the documentation `release/0.28.0` train (the fix's milestone). If 0.28.0 publishes WITHOUT the caveat migration, this becomes live drift — flag for the release-gate check."
  - "Live permissions page (fetched 2026-06-12, status 200) still does not mention that GET `/api/tags` is reachable by any authenticated user with no `TAG_*` permission — the open-read posture remains undocumented (the side-door WRITE paths, by contrast, are now documented on that page)."

## implicit_adrs

- "**Popularity is computed over the full filtered directory per request — correctness over query cheapness, with a deterministic tie-break.** The fix deliberately aggregates usage for EVERY matching tag before ordering/windowing, accepting the full-directory UNION-ALL cost on each call, and pins `TAG.ID ASC` as the tie-break so equal-count pages are stable." — evidence: ReactiveTagRepositoryImpl.java:147-162 — intent_anchor: "aggregate usage over the FULL filtered directory FIRST, then order by usage and paginate — paginating the raw tag select windowed by id BEFORE counting returned the oldest tags re-ranked among themselves instead of the most popular" (comment at lines 147-149) — confidence: HIGH

- "**Computed (unqualified-alias) fields are exempt from the paginate homogeneity invariant as a general rule.** `homogeneityCheck` guards that a paginated select reads one table; computed aliases (FTS rank, aggregations) are declared non-threatening to that invariant, making aggregated selects paginatable platform-wide rather than special-casing each alias." — evidence: JooqQueryHelper.java:138-154 — intent_anchor: "computed alias fields (the FTS rank, aggregations like count) are not table columns and cannot break the one-table invariant this check guards" (comment at lines 143-145; `RANK_FIELD_ALIAS` today lives only in FTSConstants.java:35 + the four FTS repositories — grep `RANK_FIELD_ALIAS` across odd-platform-api/src/main returns no JooqQueryHelper hit, consistent with the general exemption subsuming a former special case per the CTRIB-007 change context) — confidence: HIGH

- "**Read endpoints are NOT RBAC-gated — open-read posture by design.** `getPopularTagList` has no `SecurityRule` entry; the request falls through to `pathMatchers(\"/**\").authenticated()`. The same shape is consistent across sibling read endpoints." — evidence: SecurityConstants.java:138-142 (POST/PUT/DELETE entries only, no GET entry for `/api/tags`) + AuthorizationCustomizer.java:29-30 (the catch-all) — intent_anchor: "The `SECURITY_RULES` table registers write-verb rules and consistently omits read-verb rules across the controller surface — the convention IS the decision that directory READ is open to all authenticated users." — confidence: MEDIUM (consistent convention in a deliberate enumerated structure, but no comment explicitly defends the read-open stance)

- "**Thin OpenAPI-delegate controller-method pattern.** `getPopularTagList` is a 2-line reactive delegation with no transformation and no programmatic auth check — business logic stays in the service layer." — evidence: TagController.java:36-44 + the identical shape of the other 3 methods in the file — intent_anchor: "The OpenAPI-generated `TagApi` interface that `TagController implements` (line 18) IS the architectural statement — the controller is a generated-contract stub." — confidence: HIGH

## bugs_limitations_corner_cases

- "**No RBAC gate on `getPopularTagList` — global tag directory enumeration by any authenticated user.** No `SecurityRule` entry exists for GET `/api/tags`; the endpoint inherits `authenticated()` from the catch-all. Combined with the (now live-documented) side-door write paths, a user holding only `DATA_ENTITY_TAGS_UPDATE` can both READ this directory and grow it — without ever holding `TAG_CREATE` or any `TAG_*` permission. — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 (catch-all) + TagController.java:36-44 (no `@PreAuthorize`) — severity: MEDIUM"

- "**No `size` clamp — `size=100000` is accepted at every layer.** `getPopularTagList` passes `size` straight through (`TagController.java:38, 42`); no upper bound anywhere; `paginate(...)` emits `LIMIT 100000` and the full page materialises via `collectList()` (`ReactiveTagRepositoryImpl.java:164-165`). Post-fix the aggregation cost no longer depends on `size` (it is always full-directory), so the unclamped `size` now governs only response materialisation/serialisation size. — evidence: TagController.java:37-42 (no `@Max`, no `@Valid`) + ReactiveTagRepositoryImpl.java:159-165 — severity: LOW"

- "**Argument-order swap between controller signature and service call.** The controller method signature is `(page, size, query, ids)` (`TagController.java:37-41`); the service call is `tagService.listMostPopular(query, ids, page, size)` (line 42). Correct today, pinned by no controller-layer test (the repository test and IT-005 would catch a page/size transposition only indirectly). — evidence: TagController.java:37-42 — severity: LOW"

- "**`page`/`size` degenerate inputs reach PostgreSQL un-validated.** `page=0` produces OFFSET `(0-1)*size = -size` → PostgreSQL rejects a negative OFFSET; `size=-1` → `LIMIT -1` rejected; a literal `null` for `page`/`size` reaches the primitive `int` service signature (`TagServiceImpl.java:73-74`) and throws NPE on unboxing. Operator-visible result is a 500, not a clean 4xx. — evidence: TagController.java:37-42 (no validation) + TagServiceImpl.java:73-74 + ReactiveTagRepositoryImpl.java:162 (the `(page-1)*size` arithmetic) — severity: LOW"

- "**UI tie-break diverges from the API tie-break among equal-count tags.** The backend contract is `count DESC, id ASC` (`ReactiveTagRepositoryImpl.java:160-161`); the Top-Tags strip then re-sorts client-side by `usedCount` DESC with an `important`-flag tie-break whose comparator ignores `a.important` (`odd-platform-ui/src/components/Overview/TopTagsList/TopTagsList.tsx:24-34`, the one-sided ternary at line 31). Primary order agrees with the backend; among equal counts the rendered chip order can differ from the API order and is not strictly deterministic at the UI layer. WHICH tags are on the strip is decided solely by the backend window. The defect (if judged one) lives in the UI node — recorded here because it shapes the surface this endpoint feeds. — evidence: TopTagsList.tsx:24-34 + ReactiveTagRepositoryImpl.java:160-161 — severity: LOW"

- "**Stale probe pin:** `lineage/odd-platform/probes/P-010.yaml` (status `pending-stress-protocol`) still asserts the PRE-fix behaviour (`set(returned_tag_ids) == set(range(1009, 1039))` — the oldest-30 window). On this branch that assertion now FAILS by design; the probe's own `realism_caveats` define the flip-on-fix lifecycle (update the assertion to the fixed contract). The regression is meanwhile guarded by the unit test + IT-005, so the probe flip is bookkeeping, not a coverage hole. — evidence: lineage/odd-platform/probes/P-010.yaml:154-180, 235-269 — severity: LOW"

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TagController.java:37"
      name: "page"
      value: "Integer (caller-controlled; OpenAPI PageParam; no clamp in controller, service, or repository)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "page=1: OFFSET = (1-1)*size = 0 — first page of the aggregated, count-DESC-ordered directory. page=0: OFFSET = (0-1)*size = -size — paginate emits a negative OFFSET; PostgreSQL rejects it → DataAccessException → 500 to the caller. No controller guard."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37-42 + ReactiveTagRepositoryImpl.java:162 (the `(page-1)*size` expression) + JooqQueryHelper.java:80-81 (limit/offset emission)"
        - q: "What at N = tunable + 1 / tunable x 100?"
          a: "page beyond the last populated page: large OFFSET over the aggregated select → empty `items`; `pageifyResult` falls to the empty-records branch and `fetchCount(query, ids)` supplies the true total; `hasNext=false`. No error — an over-range page is a clean empty page."
          confidence: STATIC-INFERRED
          evidence: "JooqQueryHelper.java:94-100, 118-126 (empty-records branch) + ReactiveTagRepositoryImpl.java:164-170"
        - q: "What at null / negative / non-numeric?"
          a: "page declared `Integer` at the controller (`TagController.java:37`), primitive `int page` at the service (`TagServiceImpl.java:73`); literal `null` → NPE on unboxing → 500. page=-1 → OFFSET -2*size → PostgreSQL error → 500. Non-numeric → binding failure at the Spring layer → 400. Exact surfaced statuses pending runtime confirmation."
          confidence: PROBE-NEEDED
          evidence: "P-029 (lineage/odd-platform/probes/P-029.yaml — still pending; scope unaffected by the ordering fix)"
        - q: "What does the operator see at each boundary?"
          a: "page=1: the genuinely most-used tags (post-fix). Over-range page: empty list, no error. page=0 / page=-1: 500. The historical boundary hazard (page 1 showing the oldest window) is gone at this commit."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-162 + integration-tests/run-log/2026-06-12-IT-005.md (GREEN/RED flip)"
    - location: "TagController.java:38"
      name: "size"
      value: "Integer (caller-controlled; OpenAPI SizeParam; no clamp at any layer)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "size=0: `LIMIT 0` → empty `items`; empty-records branch → `fetchCount` supplies the real total; `hasNext=false`. size=1: exactly the single most-used tag (count DESC, id-ASC tie) — post-fix this is the true top tag, not the oldest tag."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:159-162 + JooqQueryHelper.java:73-82, 94-100"
        - q: "What at N = tunable + 1 / tunable x 100?"
          a: "size >= directory: all tags, count-DESC ordered, `hasNext=false`. size=100000: accepted with no clamp; since the fix the aggregation ALREADY runs over the full filtered directory regardless of size, so a huge size adds only result materialisation (`collectList()`) and serialisation cost, not extra aggregation cost."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37-42 (no @Max) + ReactiveTagRepositoryImpl.java:144-165 (full-directory aggregate; collectList at 164-165)"
        - q: "What at null / negative / non-numeric?"
          a: "Literal `null` → NPE on unboxing at the primitive `int size` service boundary (`TagServiceImpl.java:74`) → 500. size=-1 → `LIMIT -1` → PostgreSQL rejects → 500. Non-numeric → 400 at binding. Exact statuses pending runtime confirmation."
          confidence: PROBE-NEEDED
          evidence: "P-029 (the null/negative-size variant)"
        - q: "What does the operator see at each boundary?"
          a: "Any size: the TOP-size most-used tags (the fix's contract — size bounds the output, never the candidate pool). size=0: empty strip, no error. size=-1 / null: 500."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-162 + odd-platform-api/src/test/.../TagRepositoryImplTest.java:276-335 (the >page-size case asserted order-sensitively)"
  name_behavior_pairs:
    - name: "TagController.getPopularTagList (TagController.java:36-44) — GET /api/tags, OpenAPI operationId getPopularTagList"
      promise: "Returns the most-popular tags ranked by usage count. The method name, the service method (`listMostPopular`), the OpenAPI summary (`'List of popular tags'`) and description (`'Gets the list of existing tags sorted by popularity'`, openapi.yaml:344-345) all promise popularity-ordered results. The UI labels the response 'Top Tags'."
      implementation: "Pipeline traced end-to-end at 82812cdf: (1) controller delegates to tagService.listMostPopular(query, ids, page, size) (TagController.java:42). (2) TagServiceImpl.listMostPopular delegates straight-through (TagServiceImpl.java:75) — no re-sort. (3) ReactiveTagRepositoryImpl.listMostPopular (lines 137-171): conditions (soft-delete + optional name-substring + optional TAG.ID.in) at 140-143; the FULL filtered `selectFrom(TAG)` becomes `tag_cte` (144-150); UNION-ALL usage counts over ALL CTE rows (151 → 377-396); per-tag GROUP BY with sum(count) + boolOr(external) (153-157); `paginate(aggregatedSelect, [count DESC, TAG.ID ASC], (page-1)*size, size)` (159-162) — JooqQueryHelper emits `ORDER BY count DESC, id ASC LIMIT size OFFSET ...` over the aggregated rows plus `_total`/`_row`/`_next` window metadata (JooqQueryHelper.java:72-88). The ordering now determines WHICH rows are returned, not merely their order within a pre-cut window."
      drift: NONE
      operator_visible_consequence: "Promise honoured: page 1 contains the genuinely most-used tags however young. Runtime-verified 2026-06-12: unit test RED-on-main/GREEN-on-fix (TagRepositoryImplTest.java:276-335); e2e IT-005 GREEN @ 82812cdf (all 5 seeded most-used youngest tags on the strip, 1 passed 3.8s) + RED @ main 6f356b72 (strip showed the oldest window); in-band API capture returned the 5 most-used tags first. HISTORICAL (dated): until this fix the implementation truncated by `TAG.ID ASC` BEFORE counting — the LSN-019 / PLT-026 DRIFT_NAME_VS_BEHAVIOR, shipped in every release through 0.27.x; the live 0.27.x manual still documents that caveat (release-train, see docs_link_semantic)."
      confidence: STATIC-INFERRED
      evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171, 377-396 + JooqQueryHelper.java:62-89 + openapi.yaml:344-345 + integration-tests/run-log/2026-06-12-IT-005.md + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32 (the historical empirical reproduction)"
  orderings:
    - location: "ReactiveTagRepositoryImpl.java:159-162 (paginate over the aggregated select) + JooqQueryHelper.java:62-89 (the window emission)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the SQL the database executes)?"
          a: "Single-level, post-aggregation: the aggregated per-tag select (sum(count), boolOr(external), GROUP BY tag fields over the UNION-ALL CTE) is wrapped by paginate, which emits `ORDER BY count DESC, id ASC` + `LIMIT size OFFSET (page-1)*size` (JooqQueryHelper.java:75-82; order fields resolved against the derived table at :156-161), and the outer select re-orders by the same keys (:84-88). There is no longer any pre-count windowing — the inner `selectFrom(TAG)` is unpaginated (ReactiveTagRepositoryImpl.java:144-145)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-162 + JooqQueryHelper.java:62-89 (both read end-to-end this session)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Explicit and deterministic: `OrderByField(TAG.ID, SortOrder.ASC)` as the secondary key (ReactiveTagRepositoryImpl.java:161). Equal-count tags appear oldest-first (serial PK order). Pinned order-sensitively by the unit test: among the equal-count groups, expected ids are sorted ascending (TagRepositoryImplTest.java:319-322, 331)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:160-161 + TagRepositoryImplTest.java:318-331"
        - q: "Which subset is returned when result-set > page size?"
          a: "The TOP `size` tags by summed usage count DESC (id-ASC ties) out of the FULL filtered directory — the fix's whole point. Verified with most-used-are-youngest data at both the repository layer (unit test) and the rendered UI (IT-005)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-162 + TagRepositoryImplTest.java:276-335 + integration-tests/run-log/2026-06-12-IT-005.md"
        - q: "Does any upstream layer (UI, service) re-sort or filter the result?"
          a: "Service (TagServiceImpl.java:72-77): no — only `.map(tagMapper::mapToTagsResponse)`. Controller (TagController.java:36-44): no — only `.map(ResponseEntity::ok)`. UI: YES — TopTagsList re-sorts client-side by `usedCount` DESC with an `important`-flag tie-break (TopTagsList.tsx:24-34); the primary key AGREES with the backend, so the re-sort is order-confirming, but its tie-break differs (important-first-ish vs id ASC) and the comparator ignores `a.important` (line 31), so equal-count chip order is not strictly deterministic. The re-sort cannot recover tags the backend window excluded. [Resolves the REFERENCE left open by the 2026-05-21 enrichment.]"
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 + odd-platform-ui/src/components/Overview/TopTagsList/TopTagsList.tsx:24-34"
  auth_gates:
    - location: "SecurityConstants.java:138-142 (the gate-shaped ABSENCE of a GET entry) + TagController.java:36-44"
      endpoint: "GET /api/tags (getPopularTagList)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: 200 — Spring Security not engaged. LOGIN_FORM / OAUTH2 / LDAP: identical to each other — no GET SecurityRule exists for `/api/tags` (`SecurityConstants.java:138-142` has only POST/PUT/DELETE entries), so the request matches the catch-all `authenticated()` (`AuthorizationCustomizer.java:29-30`); any authenticated principal gets 200 + the full directory. `SECURITY_RULES` is mode-agnostic."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-31 (both re-read this session)"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "LOGIN_FORM: 302 redirect to the login form (or 401 for an XHR/JSON request). OAUTH2 / LDAP: 401. The catch-all `authenticated()` blocks unauthenticated access even though `getPopularTagList` has no explicit SecurityRule. DISABLED: 200."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see (a READ_ONLY / no-TAG-permission user)?"
          a: "A user holding NO `TAG_*` permission gets 200 + the full tag directory. There is no wrong-role rejection path for this read endpoint — the open-read posture."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "The ONLY gate is the catch-all `authenticated()` in the security filter chain (`AuthorizationCustomizer.java:29-30`). No `@PreAuthorize` on the controller method (`TagController.java:36-44`); no check in `TagServiceImpl.listMostPopular` (`TagServiceImpl.java:72-77`); none in the repository. The gate is 'authenticated, full stop'."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30"
  resource_boundaries:
    - location: "TagController.java:36-44 (getPopularTagList — a pure read path)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No. Pure read — the chain issues only SELECTs (the aggregated paginate statement; plus `fetchCount` ONLY for empty pages). Sharper than the pre-fix note: for NON-empty pages, `pageInfo.total` (`_total`) is a window function computed in the SAME statement as the page rows (JooqQueryHelper.java:72, 75-82, consumed at :113), so rows and total are snapshot-consistent; only the empty-page path issues a second statement (`fetchCount`, ReactiveTagRepositoryImpl.java:169), where a concurrent-write skew is benign (total for an empty page)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:137-171 (SELECT-only) + JooqQueryHelper.java:72-126 + ReactiveAbstractCRUDRepository.java:229-234"
        - q: "Is the call replay-safe?"
          a: "Yes — fully idempotent. Same `page`/`size`/`query`/`ids` against an unchanged directory returns the same response (the id-ASC tie-break makes the order deterministic too). No side effects."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:160-161"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No server-side cache: no `@Cacheable` on controller, service, or repository — every `GET /api/tags` is a fresh DB round-trip. Client-side: the Overview hook caches under react-query key `['popularTags']` (params NOT in the key) and the generic hook under `['tagList', params]` — UI-cache semantics belong to those nodes (odd-platform-ui/src/lib/hooks/api/tags.ts:5-14, tag.ts:5-10)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171 (no cache annotations) + odd-platform-ui/src/lib/hooks/api/tags.ts:5-14"
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
          a: "Controller → tagService.listMostPopular(query, ids, page, size) (TagController.java:42) → TagServiceImpl (TagServiceImpl.java:75) → ReactiveTagRepositoryImpl computes the SQL OFFSET as `(page - 1) * size` into `paginate(...)` (ReactiveTagRepositoryImpl.java:162)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:162"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — standard 1-based-page-to-OFFSET translation, now applied over the count-DESC-ordered aggregated directory (so page N is the Nth slice of the popularity ranking, as the name implies)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:159-162"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation. (The `page<=0` negative-OFFSET hazard is recorded under tunables / bugs, not a naming-drift issue.)"
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `page` is a pagination control, not an entity attribute."
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
          a: "Controller (TagController.java:42) → service (TagServiceImpl.java:75) → repository: `size` is the LIMIT and a factor of the OFFSET in `paginate(aggregatedSelect, ..., (page-1)*size, size)` (ReactiveTagRepositoryImpl.java:162)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:162"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `size` is the page size, applied AFTER the popularity ordering. The pre-fix caveat (size doubled as the truncation boundary that selected WHICH rows by id) is gone: size now bounds output only."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-162"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — `size` does what the name says."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:38"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — pagination control, no closer-aligned unused column."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:38"
      routes_to_finding: "no naming drift; the size-clamp absence is in bugs_limitations_corner_cases"
    - location: "TagController.java:39 (String query)"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A search string used to filter the tag list — in a tag-list context, a tag-name search."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:39 + openapi.yaml:350 (SearchParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller (TagController.java:42) → service (TagServiceImpl.java:75) → `listCondition(query)` (ReactiveTagRepositoryImpl.java:140) → soft-delete wrapper (ReactiveAbstractSoftDeleteCRUDRepository.java:87-88) → `nameField.containsIgnoreCase(nameQuery)` when non-empty (ReactiveAbstractCRUDRepository.java:242-243); `nameField` = the table's default `name` column (ReactiveAbstractCRUDRepository.java:49, 63). The filter constrains BOTH the aggregation candidate set AND the count."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:140, 144-145 + ReactiveAbstractCRUDRepository.java:49, 63, 240-243"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — case-insensitive substring match on `tag.name`, exactly the field a caller expects. Caveat (not a drift): asymmetric with the case-SENSITIVE write-path lookup (`listByNames` → `TAG.NAME.in`, ReactiveTagRepositoryImpl.java:120-125) — recorded in invariants."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:242-243 + ReactiveTagRepositoryImpl.java:120-125"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent scope translation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:242-243"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `query` is correctly bound to `tag.name`; no other name-like column exists on the `tag` table."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:63"
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
          a: "Controller (TagController.java:42) → service (TagServiceImpl.java:75) → `if (CollectionUtils.isNotEmpty(ids)) conditions.add(TAG.ID.in(ids))` (ReactiveTagRepositoryImpl.java:141-143). Also threaded into `fetchCount(query, ids)` (line 169) so the empty-page total honours the id filter too."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:141-143, 169"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `ids` binds directly to `TAG.ID.in(ids)`. Empty `ids` is treated as no-filter (skipped via the `isNotEmpty` guard), not as zero-results."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:141-143"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — direct PK bind, no translation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:141-143"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — bound to the primary-key column `TAG.ID`."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:141-143"
      routes_to_finding: "no drift — ids binds to TAG.ID directly"
  probes_emitted:
    - probe_id: P-029
      question: "page/size degenerate-input handling for getPopularTagList — exact HTTP statuses for null / negative / zero page or size. (Emitted by the 2026-05-21 enrichment pass of this node; still pending; scope unchanged by the ordering fix — only the OFFSET-expression line moved, 148 → 162.)"
      probe_path: "lineage/odd-platform/probes/P-029.yaml"
  stress_summary:
    triggers_total: 10
    questions_total: 40
    answers_static_inferred: 38
    answers_probe_needed: 2
    answers_reference: 0
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — `getPopularTagList` is on the HTTP UI/API surface (`GET /api/tags`). Under `DISABLED`, Spring Security is not engaged and the endpoint is open. `S2S` is orthogonal — this endpoint is not on the ingestion path (`/ingestion/**`).
- **ingestion_filter_relevance**: `NO — UI/API surface at GET /api/tags, not /ingestion/**`. The endpoint READS a directory that the ingestion path can mutate, but does not itself participate in the ingestion filter.
- **authorization_assertions**:
  - "GET `/api/tags` (getPopularTagList) has NO endpoint-specific authorization gate — no `SecurityRule` entry exists for the GET verb on `/api/tags` — evidence: SecurityConstants.java:138-142 (only POST/PUT/DELETE entries)"
  - "The only access control is the catch-all `pathMatchers(\"/**\").authenticated()` — evidence: AuthorizationCustomizer.java:29-30"
  - "No `@PreAuthorize` on the controller method — evidence: TagController.java:36-44"
  - "No `@PreAuthorize` and no programmatic permission check in the downstream `TagServiceImpl.listMostPopular` — evidence: TagServiceImpl.java:72-77"
- **owner_scoping**: `N/A — the Tag directory has no owner concept`. The `tag` table has no `owner_id` column; `getPopularTagList` returns tags across the whole flat global namespace with no per-Owner filtering.
- **data_exposure**:
  - "`Mono<ResponseEntity<TagsResponse>>` — up to `size` `Tag` records (`id, name, important, external, usedCount`) plus `pageInfo` → any authenticated user under LOGIN_FORM/OAUTH2/LDAP, regardless of `TAG_*` permissions; or any caller at all under DISABLED. — evidence: TagController.java:36-44 + openapi.yaml:352-358"
  - "The exposed data is the ENTIRE tag directory (paginated) — an attacker enumerating `page` from 1 upward retrieves every tag name in the deployment. Post-fix the usage counts exposed per tag are accurate popularity figures (mildly better recon signal than the pre-fix oldest-window, for what tags are actively used). — evidence: ReactiveTagRepositoryImpl.java:137-171 (no scope filter beyond optional `query`/`ids`)"
- **known_security_gaps**:
  - "Open-read posture — any authenticated user can enumerate the whole global tag directory via `getPopularTagList` regardless of `TAG_*` grants. The live permissions doc page (WebFetched 2026-06-12, status 200) documents the side-door WRITE paths but still does not document the open READ. — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 — severity: MEDIUM"
  - "Authorization is path-pattern-matched at the security filter chain, not annotation-based — a path rename would silently change which `SecurityRule` set applies; for this read endpoint the effect would be benign (still `authenticated()`), but the fragility is shared with the write endpoints on the same controller. — evidence: SecurityConstants.java:138-142 — severity: LOW"
  - "No request-input validation on `page`/`size`/`query`/`ids` — `size` has no upper clamp, `page`/`size` no lower bound; `page<=0`/`size<0` produce 500s. — evidence: TagController.java:37-42 (no `@Valid`, no `@Max`, no `@Min`) — severity: LOW"

## performance

- **hot_paths**:
  - "`getPopularTagList` runs on app boot (`App.tsx:50` — page=1,size=10 preload), on every Catalog-Overview mount (`Overview.tsx:20-23` — page=1,size=30 'Top Tags'), on the Management→Tags tab, and behind every tag autocomplete keystroke-search — a high-frequency read. — evidence: TagController.java:36-44 + odd-platform-ui call sites listed under upstream_callers"
  - "Since the fix, EVERY call aggregates usage over the FULL filtered directory: the UNION-ALL CTE LEFT-JOINs `tag_to_data_entity` AND `tag_to_dataset_field` against all matching tags, GROUP BY twice, then sums per tag — regardless of `size`. The pre-fix shape aggregated over only `size` rows (cheaper but WRONG). This is the deliberate cost of correctness (implicit_adrs[0]). One SQL statement per non-empty page (the window metadata rides along); a second statement (`fetchCount`) only for empty pages. — evidence: ReactiveTagRepositoryImpl.java:144-171, 377-396 + JooqQueryHelper.java:62-126"
- **throughput_characteristics**:
  - "Reactive `Mono` end-to-end — non-blocking. — evidence: TagController.java:37 + TagServiceImpl.java:73"
  - "Single read per request — no streaming; the whole page is materialised (`collectList()`) before mapping. — evidence: ReactiveTagRepositoryImpl.java:164-165"
- **resource_allocation**:
  - "Response memory per call is bounded by `size` (unclamped — see gaps); the DB does the aggregation, so server-side memory is page-rows only. — evidence: ReactiveTagRepositoryImpl.java:159-165"
  - "Not `@ReactiveTransactional` — but for non-empty pages the rows + total come from ONE statement (window `_total`), so no cross-statement consistency concern remains on the hot path. — evidence: TagServiceImpl.java:72-77 (no annotation) + JooqQueryHelper.java:72-82, 113"
  - "No server-side cache — every call re-aggregates. — evidence: TagController.java:1-53 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171 (no @Cacheable)"
- **scaling_characteristics**:
  - "Stateless — scales horizontally. — evidence: TagController.java:36-44"
  - "No locking on the read path — pure SELECTs. — evidence: ReactiveTagRepositoryImpl.java:137-171"
  - "Aggregation cost grows with directory size × relation-table size, NOT with `size`: O(|tag| matching the filter, joined against both relation tables) per call. For typical tag directories (hundreds to low thousands) this is cheap; for very large directories the per-call CTE is the scaling boundary, uncached. — evidence: ReactiveTagRepositoryImpl.java:144-157, 377-396"
- **known_performance_gaps**:
  - "No `size` clamp on `getPopularTagList` — an unclamped `size` allows a caller to force full-directory result materialisation + serialisation in one response. — evidence: TagController.java:37-42 — severity: LOW"
  - "The full-directory UNION-ALL aggregation now runs on EVERY popular-tags fetch (including the app-boot preload and every Overview mount) with no materialised view and no cache. Correct by design (the fix), but a candidate for caching/materialisation if tag directories or relation tables grow large. — evidence: ReactiveTagRepositoryImpl.java:144-157, 377-396 + odd-platform-ui/src/components/App.tsx:50 — severity: LOW"

## upstream_callers

- entry_point: "rest:GET /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.getPopularTagList"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:36-44 — `getPopularTagList` is the `@Override` implementation of the generated `TagApi` abstract method; one invocation per HTTP request."
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/ Catalog Overview (Top Tags chip strip)"
  caller_node: "ts react-component:Overview.tsx → useGetPopularTags hook"
  multiplicity_per_trigger: 1
  evidence: "odd-platform-ui/src/components/Overview/Overview.tsx:20-23 — `useGetPopularTags({ page: 1, size: 30 })`; the hook (odd-platform-ui/src/lib/hooks/api/tags.ts:5-14) is react-query `useQuery` with queryKey `['popularTags']` — one deduplicated fetch per mount under default options (refetch-on-window-focus per react-query defaults applies; the hook sets no overrides). NOTE the key omits params — any future caller with different params would share this cache entry. Items rendered via TopTagsList (TopTagsList.tsx:24-49), which re-sorts client-side (see stress_findings.orderings)."
  observation_class: ui-call
  unresolved: false

- entry_point: "boot:App mount (tags preload into the redux slice)"
  caller_node: "ts react-component:App.tsx → fetchTagsList thunk"
  multiplicity_per_trigger: 1
  evidence: "odd-platform-ui/src/components/App.tsx:50 — `dispatch(fetchTagsList({ page: 1, size: 10 })).catch(() => {})` dispatched from the app-level effect on boot; the thunk (odd-platform-ui/src/redux/thunks/tags.thunks.ts:13-19) calls `tagApi.getPopularTagList`. Dep-array interplay not re-read this session — multiplicity recorded as 1 per app boot from the call shape."
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_route:Management → Tags tab"
  caller_node: "ts react-component:TagsList.tsx → fetchTagsList thunk"
  multiplicity_per_trigger: "1 per mount + 1 per create/delete completion + 1 per pagination scroll + 1 per search submit"
  evidence: "odd-platform-ui/src/components/Management/TagsList/TagsList.tsx:45-58 — mount/refresh effect `fetchTagsList({page: 1, size})` when no query (line 45, re-fires on isTagCreating/isTagDeleting per the dep array at line 46), next-page `{page: page + 1, size, query}` (line 54), search `{page: 1, size, query}` (line 58)."
  observation_class: ui-call
  unresolved: false

- entry_point: "ui:tag autocompletes (data-entity / term / dataset-field tag edit forms) + DataQuality tag filter"
  caller_node: "ts react-components: TagsEditFormAutocomplete (×2 variants), Terms TagsEditForm, DataQuality TagFilter → fetchTagsList / useGetTagList"
  multiplicity_per_trigger: "1 per autocomplete query change / filter open"
  evidence: "odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewTags/TagsEditForm/TagsEditFormAutocomplete/TagsEditFormAutocomplete.tsx:15 + .../DatasetFieldTags/TagsEditForm/TagsEditFormAutocomplete/TagsEditFormAutocomplete.tsx:15 + odd-platform-ui/src/components/Terms/TermDetails/Overview/OverviewTags/TagsEditForm/TagsEditForm.tsx:22 (all import `fetchTagsList as searchTags`) + odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TagFilter.tsx:4, 23 (`useFilter(useGetTagList, filterKey)`; hook at odd-platform-ui/src/lib/hooks/api/tag.ts:5-10 with params-keyed query). Per-component debounce/effect cadence not read this session — call SITES first-hand, cadence summarised from the import shape."
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns a `TagsResponse` payload (`pageInfo` + up to `size` `Tag` items, popularity-ordered count DESC / id ASC) to the caller — the sole externally-observable output of this read endpoint."
  evidence: "TagController.java:42-43 (`.map(ResponseEntity::ok)`) + openapi.yaml:352-358 (the TagsResponse 200 body) + ReactiveTagRepositoryImpl.java:159-162 (the delivered order)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/tags"
    - "ui_route:/ Catalog Overview (Top Tags chip strip)"
    - "boot:App mount (tags preload)"
    - "ui_route:Management → Tags tab"
    - "ui:tag autocompletes + DataQuality tag filter"

- side_effect_class: db-write
  description: "NONE — `getPopularTagList` is a pure read. The downstream chain issues only SELECT statements: the aggregated paginate statement (+ `fetchCount` for empty pages only). No INSERT/UPDATE/DELETE, no view-count increment, no activity-feed entry, no search-vector refresh."
  evidence: "TagServiceImpl.java:72-77 (read-only delegation) + ReactiveTagRepositoryImpl.java:137-171 (SELECT-only chain) + ReactiveAbstractCRUDRepository.java:229-234 (fetchCount SELECT)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171, 377-396 + openapi.yaml:342-358 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + integration-tests/run-log/2026-06-12-IT-005.md
- concepts.entities.TagApi ← TagController.java:18, 36-37
- concepts.entities.page/size/query/ids ← TagController.java:37-41 + openapi.yaml:347-351 + ReactiveTagRepositoryImpl.java:141-143, 162 + ReactiveAbstractCRUDRepository.java:242-243
- concepts.entities.TagsResponse/Page<TagDto> ← openapi.yaml:352-358 + TagService.java:22 + ReactiveTagRepositoryImpl.java:138 + TagServiceImpl.java:75-76
- concepts.operations.getPopularTagList ← TagController.java:36-44
- concepts.operations.listMostPopular-delegation ← TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171 + ReactiveAbstractSoftDeleteCRUDRepository.java:87-88 + ReactiveAbstractCRUDRepository.java:294-299 + JooqQueryHelper.java:62-89
- concepts.invariants.popularity-promise-honoured ← openapi.yaml:344-345 + ReactiveTagRepositoryImpl.java:159-162 + JooqQueryHelper.java:73-82 + integration-tests/run-log/2026-06-12-IT-005.md
- concepts.invariants.no-GET-SecurityRule ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- concepts.invariants.page-total-semantics ← JooqQueryHelper.java:72, 75-82, 94-126 + ReactiveTagRepositoryImpl.java:169 + ReactiveAbstractCRUDRepository.java:229-234
- concepts.invariants.no-status-code-drift ← openapi.yaml:353, 372 + TagController.java:43
- concepts.invariants.query-case-insensitive ← ReactiveAbstractCRUDRepository.java:242-243 + ReactiveTagRepositoryImpl.java:120-125
- dependencies_semantic.requires-feature.* ← TagController.java:18, 20, 42 + ReactiveTagRepositoryImpl.java:137-171 + JooqQueryHelper.java:62-89, 138-154 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-31
- tests_coverage_semantic.covered_behaviours ← odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:238-268, 270-335 + integration-tests/protocols/IT-005-top-tags-ordering.md + integration-tests/run-log/2026-06-12-IT-005.md
- tests_coverage_semantic.uncovered_behaviours.controller-perimeter ← grep `TagController` across odd-platform-api/src/test — ZERO files (search root: odd-platform-api/src/test, re-run 2026-06-12)
- docs_link_semantic.declared_docs ← TagController.java:1-53 (no @docs token observed during the end-to-end read)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/tagging (2026-06-12, 200; the /data-discovery/tagging variant 404s — fetched this session)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-06-12, 200)
- docs_link_semantic.doc_drift_findings ← openapi.yaml:345 + ReactiveTagRepositoryImpl.java:159-162 + the two WebFetches above
- implicit_adrs.[0] ← ReactiveTagRepositoryImpl.java:147-162 (intent comment at 147-149)
- implicit_adrs.[1] ← JooqQueryHelper.java:138-154 (intent comment at 143-145) + grep RANK_FIELD_ALIAS across odd-platform-api/src/main (hits only in FTSConstants.java:35 + DataEntityCTEQueryConfig + 4 FTS repositories; none in JooqQueryHelper)
- implicit_adrs.[2] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- implicit_adrs.[3] ← TagController.java:18, 36-44
- bugs_limitations_corner_cases.[0] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagController.java:36-44
- bugs_limitations_corner_cases.[1] ← TagController.java:37-42 + ReactiveTagRepositoryImpl.java:159-165
- bugs_limitations_corner_cases.[2] ← TagController.java:37-42
- bugs_limitations_corner_cases.[3] ← TagController.java:37-42 + TagServiceImpl.java:73-74 + ReactiveTagRepositoryImpl.java:162
- bugs_limitations_corner_cases.[4] ← odd-platform-ui/src/components/Overview/TopTagsList/TopTagsList.tsx:24-34 + ReactiveTagRepositoryImpl.java:160-161
- bugs_limitations_corner_cases.[5] ← lineage/odd-platform/probes/P-010.yaml:154-180, 235-269
- security.authorization_assertions ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagController.java:36-44 + TagServiceImpl.java:72-77
- security.data_exposure ← TagController.java:36-44 + openapi.yaml:352-358 + ReactiveTagRepositoryImpl.java:137-171
- security.known_security_gaps.[0] ← SecurityConstants.java:138-142 + WebFetch permissions page (2026-06-12, 200)
- performance.hot_paths ← TagController.java:36-44 + ReactiveTagRepositoryImpl.java:144-171, 377-396 + JooqQueryHelper.java:62-126 + odd-platform-ui/src/components/App.tsx:50 + odd-platform-ui/src/components/Overview/Overview.tsx:20-23
- performance.scaling_characteristics ← ReactiveTagRepositoryImpl.java:144-157, 377-396
- upstream_callers.[0] ← TagController.java:36-44
- upstream_callers.[1] ← odd-platform-ui/src/components/Overview/Overview.tsx:20-23 + odd-platform-ui/src/lib/hooks/api/tags.ts:5-14 + odd-platform-ui/src/components/Overview/TopTagsList/TopTagsList.tsx:24-49
- upstream_callers.[2] ← odd-platform-ui/src/components/App.tsx:50 + odd-platform-ui/src/redux/thunks/tags.thunks.ts:13-19
- upstream_callers.[3] ← odd-platform-ui/src/components/Management/TagsList/TagsList.tsx:45-58
- upstream_callers.[4] ← the four UI call-site files cited inline + odd-platform-ui/src/lib/hooks/api/tag.ts:5-10
- downstream_side_effects.[0] ← TagController.java:42-43 + openapi.yaml:352-358 + ReactiveTagRepositoryImpl.java:159-162
- downstream_side_effects.[1] ← TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171 + ReactiveAbstractCRUDRepository.java:229-234
- stress_findings.name_behavior_pairs[0] ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-171, 377-396 + JooqQueryHelper.java:62-89 + openapi.yaml:344-345 + TagRepositoryImplTest.java:270-335 + integration-tests/run-log/2026-06-12-IT-005.md + retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32
- stress_findings.orderings ← ReactiveTagRepositoryImpl.java:144-162 + JooqQueryHelper.java:62-89, 156-161 + TagRepositoryImplTest.java:318-331 + odd-platform-ui/src/components/Overview/TopTagsList/TopTagsList.tsx:24-34
- stress_findings.auth_gates ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-31 + TagController.java:36-44 + TagServiceImpl.java:72-77
- stress_findings.resource_boundaries ← ReactiveTagRepositoryImpl.java:137-171 + JooqQueryHelper.java:72-126 + odd-platform-ui/src/lib/hooks/api/tags.ts:5-14
- stress_findings.request_inputs ← TagController.java:37-42 + TagServiceImpl.java:75 + ReactiveTagRepositoryImpl.java:140-143, 162, 169 + ReactiveAbstractCRUDRepository.java:49, 63, 240-243 + ReactiveAbstractSoftDeleteCRUDRepository.java:87-93
- stress_findings.probes_emitted.P-029 ← lineage/odd-platform/probes/P-029.yaml:1-40

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH — both live pages WebFetched first-hand this session (2026-06-12, both 200); the tagging page's pre-fix caveat quoted verbatim; the release-train gating of its retirement is per `adrs/drafts/release-train-doc-gating.md` + the CTRIB-007 milestone (0.28.0).
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH — all five entry points read first-hand this session (Overview.tsx, App.tsx, TagsList.tsx, the autocomplete/filter call sites, both hooks); residual softness is limited to per-component effect cadence for the autocompletes (flagged inline), not to the existence or shape of any caller.
- downstream_side_effects: HIGH
- stress_findings: HIGH — the load-bearing operator-observable claim (popularity ordering honoured, deterministic id-ASC ties) is STATIC-INFERRED via an end-to-end chain trace read first-hand this session AND runtime-verified 2026-06-12 (failing-first unit test RED-on-main/GREEN-on-fix; e2e IT-005 GREEN @ 82812cdf / RED @ main 6f356b72 with an in-band API capture). Of 40 stress questions, only 2 resolve to PROBE-NEEDED (the degenerate page/size HTTP-status question — non-load-bearing, P-029) and 0 to REFERENCE (the former UI re-sort REFERENCE is resolved this session via TopTagsList.tsx).

## Maintainer notes

(none — no prior sidecar existed for this node)
