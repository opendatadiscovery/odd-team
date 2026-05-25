---
node_id: "odd-platform java TitleController controller-class:TitleController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZE-TitleController
---

# TitleController — semantic understanding

## understanding

`TitleController` is a thin one-method REST controller implementing the generated `TitleApi` interface — sole operation `getTitleList(page, size, query)` mapped to `GET /api/titles` (`<odd-platform-repo>/odd-platform-specification/openapi.yaml:323-340`) — which delegates verbatim to `titleService.list(page, size, query)` (TitleController.java:22), itself delegating to the generic `ReactiveAbstractCRUDRepository.list(page, size, nameQuery)` at `ReactiveAbstractCRUDRepository.java:84-100`. The controller is the read-only surface of the **Title directory** — a free-text catalogue of **owner-relationship labels** (e.g. "Data Steward", "DBA", "Maintainer") that operators select in the React `OwnerTitleAutocomplete` when granting ownership of a Data Entity or a Term (`<odd-platform-repo>/odd-platform-ui/src/components/shared/elements/Autocomplete/OwnerTitleAutocomplete/OwnerTitleAutocomplete.tsx:43-48`). There is NO write/update/delete endpoint on `TitleController`; the directory is **mutated only as a side effect** of `OwnershipServiceImpl.create` / `OwnershipServiceImpl.update`, which call `titleService.getOrCreate(formData.getTitleName())` and silently auto-create rows on miss (per the batch-K `OwnershipServiceImpl` sidecar's `invariants[2]`). The single `getTitleList` operation enforces auth at the wire (`pathMatchers("/**").authenticated()` in every non-DISABLED auth config) but holds NO per-permission gate, NO owner-scoping, and NO server-side cap on `size`.

## concepts

- entities: [
    "`Title` (OpenAPI schema, `components.yaml:278-288`) — `{id: int64, name: string}`; both required. No description, no enum, no pattern, no length constraint",
    "`TitleList` (OpenAPI schema, `components.yaml:290-300`) — `{items: Title[], page_info: PageInfo}`",
    "`TitlePojo` (jOOQ-generated POJO for the `title` table) — `{id, name, created_at, updated_at, deleted_at}` per `V0_0_3__add_ownership.sql:1-8` (originally `role` table) + `V0_0_53__rename_role_to_title.sql:1-2` (RENAME TO title) + soft-delete column added by a later migration",
    "`OwnershipFormData.title_name` / `OwnershipUpdateFormData.title_name` — the string field on the ownership-form request body that ultimately consults this directory via `titleService.getOrCreate` (per batch-K sidecar)",
    "`Page<TitlePojo>` (`ReactiveAbstractCRUDRepository.java:84-100`) — internal pagination shape carrying `data: List<TitlePojo>`, `total: long`, `hasNext: boolean`"
  ]
- operations: [
    "`getTitleList(page, size, query)` — `Mono<ResponseEntity<TitleList>>` returning a paginated list of titles filtered by case-insensitive name-substring; ordered by `id ASC` per the inherited paginate-wrapper (TitleController.java:17-23 → TitleServiceImpl.java:25-27 → ReactiveAbstractCRUDRepository.java:84-91)",
    "(Out-of-band sibling) `titleService.getOrCreate(name)` — the AUTO-CREATE side-effect path called by `OwnershipServiceImpl`; reads via `getByName` then inserts if missing (`TitleServiceImpl.java:19-22` + `ReactiveTitleRepositoryImpl.java:22-27`). Not exposed via this controller, but the controller is the canonical READ surface for what `getOrCreate` writes."
  ]
- invariants: [
    "**ORDER BY `id` ASC at the outermost select** — `ReactiveAbstractCRUDRepository.list(page, size, nameQuery)` at line 90-91 passes `List.of(new OrderByField(idField, SortOrder.ASC))` to `paginate(...)`; `JooqQueryHelper.paginate` (lines 63-80) wraps the inner select and ORDERs the OUTER select by `id ASC`. The user-facing autocomplete therefore returns titles in **insertion order** (id is bigserial PK), not alphabetical, not by usage count, not by relevance to the typed query. Operators discover this as 'why does the dropdown show old typo'd titles before clean ones?'",
    "**Case-insensitive substring filter on `name`** — `ReactiveAbstractCRUDRepository.listCondition(nameQuery)` at line 240-249 emits `nameField.containsIgnoreCase(nameQuery)` (jOOQ → `LOWER(name) LIKE LOWER('%query%')`). Empty/null `query` returns ALL titles (`StringUtils.isNotEmpty` guard at line 242). No relevance ranking, no prefix priority, no FTS.",
    "**Soft-delete filter applied** — `ReactiveTitleRepositoryImpl` extends `ReactiveAbstractSoftDeleteCRUDRepository` (line 14) whose `listCondition` override (lines 87-89) adds `deletedAtField.isNull()` to the WHERE. Soft-deleted titles are invisible to the controller. There is NO `/api/titles` POST/PUT/DELETE endpoint — the only legitimate path to soft-delete a Title is via the base `ReactiveAbstractSoftDeleteCRUDRepository.delete(id)` method, which has no caller in the production codebase (grep `titleRepository.delete\\(`: only test code).",
    "**Auth is required but NO per-permission gate** — `/api/titles` is not in `SecurityConstants.WHITELIST_PATHS[95-96]` and has no `SECURITY_RULES[98-355]` entry; falls through to `pathMatchers(\"/**\").authenticated()` in both `LoginFormSecurityConfiguration:57` and `AuthorizationCustomizer:29-30`. Therefore: (a) in `auth.type=DISABLED` it is unauthenticated (`DisabledAuthSecurityConfiguration:16` permitAll); (b) in LOGIN_FORM / OAUTH2 any authenticated user can list ALL titles regardless of policy, role, or owner scope. No `OWNER_RELATION_MANAGE`, no `DATA_ENTITY_OWNERSHIP_*`, no Permission consulted.",
    "**No owner-scoping on read** — the controller does not filter titles by which Data Entities the caller can see; the entire directory is enumerable by any authenticated user. This is unsurprising because titles are role-labels (not data-entity rows), but operators expecting policy-based filtering of the dropdown will find their expectation violated.",
    "**No server-side cap on `size`** — `Integer size` (line 19) flows verbatim to `paginate(...).limit(size)` (line 91); no `Math.min(size, MAX_PAGE_SIZE)`, no `@Max` annotation, no controller-level validator. An authenticated caller can pass `size=100000` and the JVM will materialise the entire title directory in one response. OpenAPI parameter (`components.yaml:4222-4229`) marks `size` as `required: true, type: integer` with no maximum.",
    "**No `@Valid` on parameters** — the controller signature uses raw `Integer page, Integer size, String query`; no `@Min(1)`, `@Max`, or `@NotBlank`. `page=0` flows through to `(page - 1) * size = -size` (negative offset) at line 91; behaviour at the jOOQ/Postgres layer is implementation-defined.",
    "**ServerWebExchange parameter is unused** — `getTitleList` takes a `ServerWebExchange exchange` (line 21) but never reads it. Signature matches the generated `TitleApi` interface; not a bug, just an inheritance artefact. No request-context inspection (e.g. caller principal) at the controller."
  ]
- audiences: [
    "**React `OwnerTitleAutocomplete` (the primary user-visible surface)** — `<odd-platform-repo>/odd-platform-ui/src/components/shared/elements/Autocomplete/OwnerTitleAutocomplete/OwnerTitleAutocomplete.tsx:1-158`. Opens on focus, debounces 500ms (line 49), dispatches `fetchOwnershipTitleList({page: 1, size: 30, query})` (line 43), feeds the result into a free-text MUI Autocomplete with `freeSolo` (line 149). The operator may pick an existing title OR type a brand-new string, which `OwnershipServiceImpl.create/update` then auto-inserts into the directory.",
    "**React `OwnershipForm`** — both `Terms/TermDetails/Ownership/OwnershipForm.tsx` and `DataEntityDetails/Overview/OverviewGeneral/OwnersSection/OwnershipForm/OwnershipForm.tsx` host the autocomplete and POST `title_name` to the `/api/dataentities/{id}/ownership` and `/api/terms/{id}/ownership` endpoints.",
    "**React `TitleFilter` (Data Quality runs filter)** — `<odd-platform-repo>/odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TitleFilter.tsx:1-46`. Calls `useGetTitleList` (the React-Query hook at `<odd-platform-repo>/odd-platform-ui/src/lib/hooks/api/title.ts:5-9`) to populate a multiple-selection filter passing `titleIds` / `deTitleIds` query parameters to the `/api/datasets/runs` endpoints (`openapi.yaml:2009-2018, 2059-2068`)",
    "**Any authenticated API client** — the OpenAPI operation is `getTitleList` (`openapi.yaml:327`), generated client code can paginate the directory without restriction"
  ]

## dependencies_semantic

- requires-feature: [
    "**Ownership feature** — Titles ONLY exist to label `ownership.title_id` → `title.id`. Per `V0_0_3__add_ownership.sql:15` + `V0_0_53__rename_role_to_title.sql:4-5`, every legitimate Title-producing path is via `OwnershipServiceImpl.create/update`. The Title directory is a pure dimension table for the ownership fact table.",
    "**Authorization framework Policy conditions** — `dataEntity:owner:title` and `term:owner:title` are condition fields in the live Policies page (WebFetched 2026-05-25 status 200) — Policies CAN gate access by an owner's Title attribute, making the Title directory a load-bearing dimension for the authorization model even though the directory itself is not policy-gated.",
    "**Data Quality runs filter** — `titleIds` and `deTitleIds` query parameters (`openapi.yaml:2009-2018, 2059-2068`) on the data-quality-runs endpoint reference `title.id` to filter test runs by the title of the test's owner / data entity's owner"
  ]
- requires-config: [] — N/A. The class reads no config; only injected fields.
- requires-runtime: [
    "Spring WebFlux + Reactor (`Mono<ResponseEntity<TitleList>>` reactive return)",
    "OpenAPI-generated `TitleApi` interface (`<odd-platform-repo>/odd-platform-api/build/generated/.../TitleApi.java`, not present in source tree) — TitleController implements it; controller's only role is to be the @RestController-bound implementation",
    "PostgreSQL `title` table — `{id bigserial PK, name varchar(128) UNIQUE, deleted_at, created_at, updated_at}` per `V0_0_3__add_ownership.sql:1-8` + `V0_0_53__rename_role_to_title.sql:1-2` + soft-delete column. Constraint name is `TITLE_NAME_UNIQUE` per `ExceptionUtils.java:23`",
    "Generic CRUD scaffolding — `ReactiveAbstractSoftDeleteCRUDRepository.java:1-118` + `ReactiveAbstractCRUDRepository.java:1-301` + `JooqQueryHelper.paginate:42-90` — all the pagination, ordering, and soft-delete WHERE-augmentation lives in these base classes; `ReactiveTitleRepositoryImpl.java:14-28` adds only `getByName` on top"
  ]
- couples-to: [
    "`TitleApi` interface (generated from OpenAPI; not in source tree) — the controller is the SOLE @RestController implementation",
    "`TitleService` (`<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TitleService.java:7-11`) — two-method contract `getOrCreate(name)` and `list(page, size, query)`",
    "`TitleServiceImpl` (`<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TitleServiceImpl.java:13-28`) — sole implementation; itself thin",
    "`ReactiveTitleRepository` / `ReactiveTitleRepositoryImpl` (`<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTitleRepository*.java`) — extends the soft-delete CRUD base; adds only `getByName`",
    "`TitleMapper` (`<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/TitleMapper.java:11-20`) — MapStruct; converts `Page<TitlePojo>` to `TitleList` with `items` + `page_info`"
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Title pojo created with auto-assigned id and same name (`testCreatesTitlePojo`)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TitlesRepositoryImplTest.java:23-36"]
  - behaviour: "Bulk create + bulk update preserve name set (`testBulkCreateTitle`, `testBulkUpdateTitle`)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TitlesRepositoryImplTest.java:43-100"]
  - behaviour: "Update changes name (`testUpdatesTitlePojo`)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TitlesRepositoryImplTest.java:102-124"]
  - behaviour: "Soft-delete removes title from get (`testDeletesTitlePojo`)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TitlesRepositoryImplTest.java:126-141"]
  - behaviour: "getByName returns title when match exists; empty when no match (`testGetByNameTitle`, `testGetByNameTitle_DifferentName`)"
    test_class: integration
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TitlesRepositoryImplTest.java:143-172"]
  - behaviour: "Ownership creation calls `titleService.getOrCreate` and binds the returned id to the ownership row"
    test_class: unit
    test_files: ["<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/OwnershipServiceImplTest.java:78-112"]
- uncovered_behaviours:
  - behaviour: "`getTitleList(page, size, query)` returns paginated results in `id ASC` order"
    test_class: integration
    criticality: MEDIUM
    note: "No controller-tier or service-tier test exercises the `list(page, size, query)` path; ordering contract is implicit via the inherited paginate-wrapper but never asserted at the wire"
  - behaviour: "`size` is unbounded — caller can request size=100000 and the JVM materialises the entire directory"
    test_class: performance
    criticality: HIGH
    note: "No server-side cap; no test for boundary or load. See P-129 probe-skeleton"
  - behaviour: "`page=0` / negative offset semantics — what does jOOQ/Postgres do at `(0-1)*size = -size`?"
    test_class: integration
    criticality: MEDIUM
    note: "No validation; behaviour at the offset-boundary is undocumented. See P-129"
  - behaviour: "`query` substring filter — exact case-insensitive containment; no relevance ranking"
    test_class: integration
    criticality: LOW
    note: "Verifying that typing 'data' returns 'Data Steward' AND 'Metadata Owner' (both match), ordered by id ASC, not alphabetical / not prefix-match-first. See P-129 realism_caveats"
  - behaviour: "Auth surface across DISABLED / LOGIN_FORM / OAUTH2 / LDAP"
    test_class: security
    criticality: HIGH
    note: "No test confirms that an unauthenticated caller is rejected with 401/302, or that auth.type=DISABLED genuinely returns the title list (security default-on stance verification)"
  - behaviour: "Concurrent calls to `OwnershipServiceImpl.create` with the same NEW `title_name` — race causing duplicate-key violation on `title.name UNIQUE`"
    test_class: integration
    criticality: MEDIUM
    note: "The auto-create path in `TitleService.getOrCreate` (`TitleServiceImpl.java:19-22`) reads-then-inserts without ON CONFLICT; two parallel owner-grants for an unseen title produce a DB-level UniqueConstraintException. Confidence on the failure mode is HIGH from code; the test covers only single-threaded paths. Cross-references batch-K OwnershipServiceImpl race surface."
- test_files:
    - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TitlesRepositoryImplTest.java:1-193"
    - "<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/OwnershipServiceImplTest.java:78-112 (title path)"
- gaps: |
    The controller and service `list` paths have ZERO direct test coverage —
    only the lower-level repository CRUD is exercised, and the Ownership
    test covers `getOrCreate` (the write side-effect path), not the read.
    A regression that breaks the ordering, the soft-delete filter, the
    `query` substring filter, or the unbounded-size class would land
    silently. The worst integration class is auth-mode validation: there
    is no proof that the endpoint enforces 401 across the three live auth
    modes. P-129 pins the size/ordering questions; an auth-matrix probe
    is a separate enqueue.

## docs_link_semantic

- declared_docs: [] — N/A. No `@docs` annotation on `TitleController.java`; the controller carries no Javadoc.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies"
    anchor: "(text reference, not anchored)"
    rationale: "The live Policies page is the only ODD doc page that mentions 'title' — as Policy condition fields `dataEntity:owner:title` and `term:owner:title`. The page does NOT explain what a Title is or how the directory is populated; it just lists the field."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "Under the 'Data entity' condition fields section, there is a field called
      `dataEntity:owner:title`, described as 'data entity's owner title.'
      Similarly, under the 'Term' condition fields section, there is
      `term:owner:title`, described as 'term's owner title.'
      Key detail: These fields allow you to create conditions based on the
      title attribute of a resource's owner, but the page does not define
      what 'title' conceptually represents in the broader authorization
      system—it only identifies it as an available condition field for
      filtering policies." (paraphrased from WebFetch response of
      https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies,
      2026-05-25, status 200)
- doc_drift_findings:
  - "**No live doc page documents the Title concept end-to-end.** WebFetched the candidate paths `/active-platform-features/ownership` (404), `/features/ownership` (404), `/main-concepts` (404), `/getting-started/main-concepts` (404), `/configuration-and-deployment/enable-security/authorization` (200 — no mention of 'title'). The Policies page (200) cites `:owner:title` as a condition field but never explains where the title vocabulary comes from, how it is populated, or that any authenticated user can mint a new title by typing one into an ownership form. An operator wiring a policy on `dataEntity:owner:title == 'Data Steward'` has no documentation explaining whether 'Data Steward' is a controlled vocabulary or a free-text catch-bucket."
  - "**The `/api/titles` operation is undocumented for API consumers.** No live doc page documents `GET /api/titles` or the Title-list endpoint. An integrator who finds the OpenAPI operation `getTitleList` cannot find a description, a default page-size recommendation, or a warning about the unbounded `size` boundary in any docs.opendatadiscovery.org page."

## implicit_adrs

- "**Title directory mutated only as a side effect of OwnershipServiceImpl** — the controller exposes ONLY `getTitleList` (no POST/PUT/DELETE). The write path is `TitleService.getOrCreate` called from `OwnershipServiceImpl.create/update` (per batch-K sidecar). The directory is therefore a derived dimension that follows ownership grants, not an independently managed catalogue." — evidence: TitleController.java:14-24 + TitleService.java:7-11 (only `list` and `getOrCreate` exist) + grep `titleRepository.create\\(` returns ONLY `TitleServiceImpl.java:21` and test fixtures. — intent_anchor: TitleApi yields a single GET operation per `openapi.yaml:323-340` — the contract itself encodes the read-only stance. — confidence: HIGH
- "**ORDER BY id ASC is the deliberate default for generic CRUD list — the framework's stance is 'insertion order is good enough' for dimension tables**" — evidence: ReactiveAbstractCRUDRepository.java:91 (`new OrderByField(idField, SortOrder.ASC)` hardcoded; no overload for custom order) + JooqQueryHelper.paginate(:42-46) defaults to `id`/`ASC` even on the bare two-arg `paginate(baseSelect, offset, limit)`. — intent_anchor: "the bare paginate signature `paginate(baseSelect, offset, limit)` explicitly hardcodes `paginate(baseSelect, baseSelect.field(\"id\"), SortOrder.ASC, offset, limit)` at line 45 — every CRUD `list` inherits this without override." — confidence: HIGH
- "**Soft-delete is the chosen delete-semantics for the Title directory** — `ReactiveTitleRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository` (line 14). A historically-used Title can be tombstoned without breaking foreign keys on `ownership.title_id`. There is no UI / API path to actually invoke this; the choice is forward-looking." — evidence: ReactiveTitleRepositoryImpl.java:14 (extends ReactiveAbstractSoftDeleteCRUDRepository) + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 (delete → UPDATE deleted_at NOT-DELETE FROM). — intent_anchor: "The class hierarchy `extends ReactiveAbstractSoftDeleteCRUDRepository` is the decision; the production codebase having zero `titleRepository.delete(...)` call-sites (grep confirms) shows the decision is provision-now-use-later, not accidental." — confidence: HIGH

## bugs_limitations_corner_cases

- "**Authentication required but NO per-permission authorization gate** — `/api/titles` is not in `SecurityConstants.WHITELIST_PATHS` and has no `SECURITY_RULES` entry; falls through to `pathMatchers(\"/**\").authenticated()`. Any authenticated user (regardless of role / policy / owner scope) can enumerate the full Title directory. There is NO `OWNER_RELATION_MANAGE` check, NO read-Permission, and NO owner-scoping." — evidence: SecurityConstants.java:95-355 (no `/api/titles` rule) + LoginFormSecurityConfiguration.java:50-57 + AuthorizationCustomizer.java:21-30 — severity: LOW (the directory contains no sensitive data; titles are role-labels like 'Data Steward'; the gap is auditability-shaped, not exfil-shaped)
- "**No server-side cap on `size` — caller-controlled pagination amplification** — `size` flows verbatim from `Integer size` parameter to `paginate(...).limit(size)`. An authenticated caller can `GET /api/titles?size=1000000` and the JVM will materialise the entire (filtered) title directory plus the count CTE in one response. No `Math.min(size, MAX)`, no `@Max`, no controller-level validator." — evidence: TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:84-91 + components.yaml:4222-4229 (no `maximum` keyword on size param) — severity: MEDIUM (the title directory is typically tens of rows; the amplification is bounded by row count, not by request alone — but the same `Integer size` pattern is replicated across every list-CRUD controller and so the class is HIGH on aggregate)
- "**`page=0` / negative input has undefined behaviour** — controller signature uses raw `Integer page` with no `@Min(1)`. `(0 - 1) * size = -size` is the offset that flows into jOOQ. The Postgres-level outcome (error code or driver-level rejection) is not statically determinable; surface confirmed via P-129. The wire response is an unhandled exception or a 500, not a 400-with-clear-message." — evidence: TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:91 + components.yaml:4213-4221 (no `minimum: 1` on page) — severity: LOW (degraded UX, not a security or correctness issue)
- "**`query` substring filter is case-insensitive containment with NO relevance ranking** — typing 'owner' returns both 'Data Owner' and 'Metadata Owner' AND any other title containing 'owner' as substring, in `id ASC` (insertion) order. There is no prefix-match priority, no FTS, no usage-count weighting. Operators expecting prefix-priority or relevance-ranked results get oldest-matching-title-first instead." — evidence: ReactiveAbstractCRUDRepository.java:240-249 (`nameField.containsIgnoreCase(nameQuery)`) + paginate ordering at line 91 — severity: LOW (UX-shaped; not data-loss-shaped)
- "**Title directory has no length / pattern / allowlist constraint at the schema or service** — `title.name varchar(128)` per `V0_0_3__add_ownership.sql:4`. No `@Pattern`, no `@Size`, no enum check, no normalisation (case-folding, trimming, deduping by lowercase). The directory accumulates `'data steward'`, `'Data Steward'`, `'DATA STEWARD'`, `' Data Steward '` (leading space), `'data-steward'`, `'data_steward'` as DISTINCT rows the moment two operators type slightly different forms into the autocomplete." — evidence: V0_0_3__add_ownership.sql:1-8 (column definition) + TitleServiceImpl.java:19-22 (auto-insert verbatim) + OwnerTitleAutocomplete.tsx:43-48 (free-text input) — severity: MEDIUM (the policies `dataEntity:owner:title == 'Data Steward'` condition then misses every other-casing variant — a silent policy-leak class)
- "**Concurrent `getOrCreate` race produces `title.name UNIQUE` violation surfaced as USR003** — two parallel owner-grants typing the SAME brand-new title name hit the `getByName.switchIfEmpty(create)` pattern at `TitleServiceImpl.java:19-22`; both read empty, both attempt create, one wins, the other hits `TITLE_NAME_UNIQUE` constraint → `ExceptionUtils.translateDatabaseException` → `UniqueConstraintException(\"Title with this name already exists\")` (`ExceptionUtils.java:72-74`) → `ControllerAdvice` → HTTP 400 USR003. The losing caller's ownership-grant fails atomically (per `@ReactiveTransactional` boundary on `OwnershipServiceImpl`); they retry, second attempt finds the row, succeeds. Operators see a transient 400 with no documentation explaining the race window." — evidence: TitleServiceImpl.java:19-22 (read-then-insert; no ON CONFLICT) + ExceptionUtils.java:22-23 (TITLE_NAME_UNIQUE) + ExceptionUtils.java:72-74 (translation) + batch-K OwnershipServiceImpl sidecar invariants[3] (parallel race surface) — severity: LOW (transient, retry-resolvable)
- "**No live doc page documents what a Title is** — operators wiring policy conditions like `dataEntity:owner:title == 'X'` have no documentation explaining whether 'X' is a controlled vocabulary or a free-text catch-bucket; no documentation of the auto-create-on-miss side-effect; no documentation of the unbounded-size endpoint surface; no documentation that any authenticated user can mint a title." — evidence: WebFetch responses 2026-05-25 (404 on `/active-platform-features/ownership`, `/features/ownership`, `/main-concepts`, `/getting-started/main-concepts`; 200 on `/configuration-and-deployment/enable-security/authorization` with no mention of 'title'; 200 on `/configuration-and-deployment/enable-security/authorization/policies` mentioning `:owner:title` as a Policy field only) — severity: MEDIUM (doc gap; concept-merger should surface this)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TitleController.java:18-19"
      name: "Integer size (request parameter, no default, no cap)"
      value: "caller-controlled int; OpenAPI required=true with no maximum"
      questions:
        - q: "What at N = 0?"
          a: "Boxed Integer 0 flows through `Math.min(...)` nowhere; jOOQ paginate is called with `limit(0)`. Postgres LIMIT 0 returns zero rows. Operator sees empty `items: []` AND a non-zero `page_info.total` (count CTE is independent of LIMIT). UI behaviour at empty page is undefined."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:89-91 + JooqQueryHelper.paginate:80-81"
        - q: "What at N = 1?"
          a: "Single-row response; ORDER BY id ASC → the oldest non-deleted title. Operator opens the autocomplete and sees only one option."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:91"
        - q: "What at N = 30 (the UI's default)?"
          a: "30 oldest non-deleted titles matching the query, in id ASC order. The UI's `OwnerTitleAutocomplete` requests size=30 at line 43; this is the operator-visible default."
          confidence: STATIC-INFERRED
          evidence: "OwnerTitleAutocomplete.tsx:43"
        - q: "What at N = 100000?"
          a: "Caller-controlled amplification. PROBE-NEEDED to confirm JVM does not OOM and Postgres LIMIT 100000 returns the full filtered set."
          confidence: PROBE-NEEDED
          evidence: "P-129"
        - q: "What at N = null / negative?"
          a: "`Integer size = null` produces NullPointerException at `paginate((page - 1) * size, size)` autounboxing — STATIC-INFERRED with HIGH confidence from the raw `int` argument at line 91. `size = -1` flows to `jOOQ.limit(-1)` — the exact exception class thrown by the jOOQ driver is runtime-determinable; PROBE-NEEDED. Either case surfaces to the operator as HTTP 500."
          confidence: PROBE-NEEDED
          evidence: "TitleController.java:19 (raw Integer; no @Valid, no @NotNull) + ReactiveAbstractCRUDRepository.java:91 + P-129 (negative-size assertion is a follow-up extension)"
        - q: "What does the operator see at each boundary?"
          a: "size=0 → empty UI dropdown (silent). size=1 → single oldest title (silent). size=30 → default UX. size>>directory → entire directory (silent amplification). size=null/negative → HTTP 500 (loud)."
          confidence: STATIC-INFERRED
          evidence: "synthesis of the above"
    - location: "TitleController.java:18"
      name: "Integer page (request parameter, no default, no min)"
      value: "caller-controlled int; OpenAPI required=true with no minimum"
      questions:
        - q: "What at page = 0?"
          a: "Offset = (0-1) * size = -size. Postgres rejects negative offset; jOOQ wraps the error → HTTP 500. PROBE-NEEDED to pin the exact error code."
          confidence: PROBE-NEEDED
          evidence: "P-129"
        - q: "What at page = 1?"
          a: "Offset = 0; first page. Canonical case."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:91"
        - q: "What at page = INT_MAX?"
          a: "Offset = (INT_MAX-1) * size. Integer overflow risk at `(page-1) * size`; both are int. With size=1000 and page=Integer.MAX_VALUE, the multiplication overflows silently and produces a small or negative offset → unpredictable rows. PROBE-NEEDED."
          confidence: PROBE-NEEDED
          evidence: "ReactiveAbstractCRUDRepository.java:91 (int*int with no overflow check)"
        - q: "What does the operator see at each boundary?"
          a: "page=0 → 500. page>>pages → empty items (Postgres returns zero rows when offset >= total). page=INT_MAX → overflow surface; unpredictable."
          confidence: PROBE-NEEDED
          evidence: "P-129"
  name_behavior_pairs:
    - name: "getTitleList"
      promise: "Returns a paginated list of Title objects (the directory of owner-role labels)"
      implementation: "TitleController.java:22 → titleService.list(page, size, query) → TitleServiceImpl.java:25-27 → titleRepository.list(page, size, query) [inherited from ReactiveAbstractCRUDRepository.java:84-91] → SELECT * FROM title WHERE LOWER(name) LIKE LOWER('%query%') AND deleted_at IS NULL ORDER BY id ASC LIMIT size OFFSET ((page-1)*size). Returns Page<TitlePojo> → TitleMapper.mapToTitleList → TitleList{items, pageInfo}."
      drift: NONE
      operator_visible_consequence: "Name promises a list; implementation returns a list. The ORDERING ('id ASC = insertion order') is implicit in the contract but matches the framework-wide CRUD list convention."
      confidence: STATIC-INFERRED
      evidence: "TitleController.java:17-23 + TitleServiceImpl.java:24-27 + ReactiveAbstractCRUDRepository.java:84-100"
  orderings:
    - location: "ReactiveAbstractCRUDRepository.java:90-91 (the OUTER ORDER BY)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "`ORDER BY id ASC` at the OUTER select. JooqQueryHelper.paginate (lines 63-80) wraps the base select as subquery `u`, then `dslContext.select(u.fields()).from(u).orderBy(orderFields).limit(...)` where orderFields is built from `new OrderByField(idField, SortOrder.ASC)`. id is bigserial PK on the `title` table per V0_0_3__add_ownership.sql:3 — so the order is INSERTION ORDER (chronological)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:91 + JooqQueryHelper.paginate:63-90 + V0_0_3__add_ownership.sql:3"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Not applicable; id is bigserial PK → unique, monotonically increasing. Deterministic at the SQL layer."
          confidence: STATIC-INFERRED
          evidence: "V0_0_3__add_ownership.sql:3"
        - q: "Which subset is returned when result-set > page size?"
          a: "The (page-1)*size to (page*size) rows by id ASC. With size=30 and page=1, the THIRTY OLDEST non-deleted matching titles win — including any historical typos, language variants, and free-text entries operators typed in the autocomplete months ago."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:89-91"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "**YES — the OwnerTitleAutocomplete re-filters in the browser.** OwnerTitleAutocomplete.tsx:38 calls MUI's `createFilterOptions` which applies its OWN client-side substring match over the fetched 30-row window. So if the user types 'owner' and the server already returns the 30 oldest titles matching 'owner' substring (id ASC), the browser then re-filters within those 30 — it does NOT re-sort by relevance. Result: titles older than the 30-row window are INVISIBLE to the autocomplete regardless of relevance to the typed query."
          confidence: STATIC-INFERRED
          evidence: "OwnerTitleAutocomplete.tsx:38-89 + the server-side ORDER BY id ASC"
  auth_gates:
    - location: "TitleController.java:14 (no @PreAuthorize; entire class)"
      endpoint: "GET /api/titles"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED — endpoint is unauthenticated; any caller sees the full title list (DisabledAuthSecurityConfiguration.java:16 anyExchange().permitAll). LOGIN_FORM — endpoint requires a logged-in session via the form-login cookie; any authenticated user (any policy, any role) sees the full list (LoginFormSecurityConfiguration.java:57). OAUTH2 — same as LOGIN_FORM via the OAuth identity; any authenticated user sees the full list (AuthorizationCustomizer.java:29-30 falls through to authenticated). LDAP — no `Ldap*Configuration` file in `<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/`; the configuration class is not present in the repository at commit 4ec2b20 and the auth.type=LDAP code path appears unimplemented. Investigate cross-batch; confidence: LOW (REFERENCE to a sibling sidecar that enumerates auth.type values)."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:53-66 + OAuthSecurityConfiguration.java:98-100 + AuthorizationCustomizer.java:20-31 + SecurityConstants.java:95-355 (no /api/titles rule) + glob `**/Ldap*Configuration.java` in odd-platform-api returns 0 hits"
        - q: "What does an unauthenticated caller see?"
          a: "In LOGIN_FORM: redirected to /login (LoginFormSecurityConfiguration.java:58 formLogin auth handler). In OAUTH2: redirected to the OAuth provider's login. In DISABLED: full title list (200 OK). In LDAP: no LDAP config class present in code; PROBE-NEEDED to determine whether the codebase actually supports auth.type=LDAP."
          confidence: PROBE-NEEDED
          evidence: "LoginFormSecurityConfiguration.java:58 + DisabledAuthSecurityConfiguration.java:16 + glob LdapSecurityConfiguration → 0 hits"
        - q: "What does a wrong-role caller see?"
          a: "No-such-thing for this endpoint. Any authenticated user — regardless of policy, role, or assigned owners — gets a 200 OK with the full directory."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-355 (no /api/titles SecurityRule) + AuthorizationCustomizer.java:29-30 (falls through to authenticated)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "ONLY at the Spring Security filter chain (authenticated() pathMatcher). NO @PreAuthorize on the controller. NO programmatic check in TitleServiceImpl. NO filter in ReactiveTitleRepositoryImpl. The service and repository would happily serve unauthenticated callers if reached via reflection or test bypass."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:1-24 (no @PreAuthorize) + TitleServiceImpl.java:1-28 (no check) + ReactiveTitleRepositoryImpl.java:1-28 (no check)"
  resource_boundaries:
    - location: "TitleServiceImpl.java:19-22 (getOrCreate — read-then-insert race)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "**YES — well-defined race surfacing as HTTP 400 USR003.** Two parallel `OwnershipServiceImpl.create` calls naming the SAME brand-new title: both call `titleRepository.getByName(name)`; both observe empty; both call `titleRepository.create(new TitlePojo().setName(name))`. The DB constraint `TITLE_NAME_UNIQUE` (per `ExceptionUtils.java:22-23`) rejects one; that side surfaces as `UniqueConstraintException(\"Title with this name already exists\")` per `ExceptionUtils.java:72-74` → ControllerAdvice → HTTP 400 USR003. The OwnershipServiceImpl's @ReactiveTransactional boundary rolls back the entire ownership-grant on the losing side."
          confidence: STATIC-INFERRED
          evidence: "TitleServiceImpl.java:19-22 + ExceptionUtils.java:22-23, 72-74"
        - q: "Is the call replay-safe?"
          a: "YES for the READ endpoint (getTitleList is GET, side-effect-free). The `getOrCreate` write path is replay-safe at the directory level (a retry will find the row created by either side); not replay-safe at the ownership-grant level (the rolled-back grant must be reissued)."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:17-23 (GET, idempotent) + TitleServiceImpl.java:19-22 (read-then-insert)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache. No @Cacheable, no manual cache writes. Every call hits Postgres. Confirmed by grep `@Cacheable` against TitleController/TitleService/ReactiveTitleRepository — zero matches."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java + TitleServiceImpl.java + ReactiveTitleRepositoryImpl.java — no @Cacheable"
    - location: "TitleController.java:14 (no @ReactiveTransactional)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "NO — GET endpoint, no state mutation. The reactive pipeline is per-request; no shared mutable state."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:14-24"
        - q: "Is the call replay-safe?"
          a: "YES — pure read."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:17-23"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "NO cache."
          confidence: STATIC-INFERRED
          evidence: "see resource_boundaries[0] q3"
  request_inputs:
    - location: "TitleController.java:18 (getTitleList)"
      input_kind: query-param
      input_name: "page"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "1-based page index in a paginated list of titles (the `PageParam` OpenAPI parameter, `components.yaml:4213-4221`, simply says 'Page' with no further description)."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4213-4221"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "TitleController.java:22 → titleService.list(page, ...) → TitleServiceImpl.java:26 → titleRepository.list(page, ...) → ReactiveAbstractCRUDRepository.java:91 `(page - 1) * size` as the OFFSET into the LIMIT/OFFSET pagination. NO validation of page >= 1 anywhere in the chain."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:22 + TitleServiceImpl.java:26 + ReactiveAbstractCRUDRepository.java:84-91"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — page used as page-number. The translation `(page-1)*size` is the standard 1-based-to-offset conversion. Caveat: no minimum-value enforcement; page=0 produces a -size offset."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:91"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: "—"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "—"
      routes_to_finding: "bugs_limitations_corner_cases[2] (page=0 surface)"
    - location: "TitleController.java:19 (getTitleList)"
      input_kind: query-param
      input_name: "size"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Number of items per page (the `SizeParam` OpenAPI parameter, `components.yaml:4222-4229`, simply says 'Size')."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4222-4229"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "TitleController.java:22 → titleService.list(..., size, ...) → ReactiveAbstractCRUDRepository.java:91 `paginate(..., (page-1)*size, size)` → JooqQueryHelper.paginate:80-81 `.limit(size)`. The LIMIT clause goes directly to Postgres."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:22 + ReactiveAbstractCRUDRepository.java:84-91 + JooqQueryHelper.paginate:63-90"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — size used as items-per-page LIMIT. Caveat: no maximum-value cap; an authenticated caller can pass size=100000."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:91"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation. The unbounded-size CONCERN is class-A tunable absence, not a name-vs-implementation drift."
          confidence: STATIC-INFERRED
          evidence: "—"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "—"
      routes_to_finding: "bugs_limitations_corner_cases[1] (unbounded size)"
    - location: "TitleController.java:20 (getTitleList)"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Search text — filters the title list by some textual criterion. The `SearchParam` OpenAPI parameter (`components.yaml:4231-4237`) describes it as 'Search text' with no further specification."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4231-4237"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "TitleController.java:22 → titleService.list(..., query) → ReactiveAbstractCRUDRepository.java:240-249 `if (StringUtils.isNotEmpty(nameQuery)) conditions.add(nameField.containsIgnoreCase(nameQuery))`. SQL: `LOWER(name) LIKE LOWER('%query%')`. Empty/null query returns ALL non-deleted titles."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:22 + ReactiveAbstractCRUDRepository.java:240-249"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — query used as text-search filter. The promise is satisfied (substring containment); the IMPLICIT promises operators might expect (prefix-match priority, relevance ranking, FTS) are NOT honoured. The name 'query' is generic enough to defend the substring semantics, so this is not strictly DRIFT — but the doc is silent about it."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:240-249"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Caller expecting prefix-match (typing 'Data') gets every title containing 'Data' anywhere (e.g. 'Metadata Owner', 'Bidata Steward' if such exist), ordered by id ASC. The autocomplete UX is therefore noisy for projects with many titles; the prefix-priority match is NOT in the first page when older substring matches exist."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:243"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — the `title` table has only `id`, `name`, `created_at`, `updated_at`, `deleted_at`. The query operates on the only searchable column."
          confidence: STATIC-INFERRED
          evidence: "V0_0_3__add_ownership.sql:1-8"
      routes_to_finding: "bugs_limitations_corner_cases[3] (substring filter, no ranking)"
    - location: "TitleController.java:21 (getTitleList)"
      input_kind: header
      input_name: "exchange (ServerWebExchange — unused)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no specific entity promised>. The parameter is the Spring WebFlux exchange handle; not a caller-supplied input in the usual sense."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:21"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "NOTHING. The parameter is declared (forced by the generated TitleApi interface) but never referenced in the controller body (line 22)."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:21-22"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "N/A — generic name, unused parameter. Not a request-input drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:21-22"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "—"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "The exchange itself is the available-but-unused signal — the controller has access to the caller's principal via `exchange.getPrincipal()` but never reads it. An owner-scoped variant of the directory (e.g. 'titles I have used in the past 30 days' for UX-personalisation) would consume this parameter."
          confidence: STATIC-INFERRED
          evidence: "TitleController.java:21-22"
      routes_to_finding: "—"
  probes_emitted:
    - probe_id: P-129
      question: "Size unbounded? page=0 surface? ORDER BY id ASC at wire?"
      probe_path: "lineage/odd-platform/probes/P-129.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 36
    answers_static_inferred: 30
    answers_probe_needed: 6
    answers_reference: 0
    drift_flags: 0
```

## security

- auth_mode_relevance: ["DISABLED", "LOGIN_FORM", "OAUTH2"]
  - DISABLED: endpoint is unauthenticated (`DisabledAuthSecurityConfiguration.java:16` `anyExchange().permitAll`)
  - LOGIN_FORM: pathMatcher `/**` requires authenticated (`LoginFormSecurityConfiguration.java:57`); no per-permission gate
  - OAUTH2: authorizeExchange falls through to authenticated() (`AuthorizationCustomizer.java:29-30`); no `/api/titles` SecurityRule
  - LDAP: not investigated; no `Ldap*Configuration` in the repo at commit 4ec2b20 (cross-batch follow-up; auth.type=LDAP code path appears unimplemented)
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion (/api/titles is not in IngestionDataEntitiesFilter path matcher)"
- authorization_assertions: [] — NONE. No @PreAuthorize on the controller. No programmatic permissionService check in TitleServiceImpl. No SecurityRule entry in SecurityConstants for `/api/titles`. The endpoint relies entirely on the framework-level authenticated() fallback.
- owner_scoping: "N/A — code is not data-scoped. Titles are a global directory; the directory is not partitioned by ownership."
- data_exposure:
  - "Title directory `(id, name)` of every non-deleted title → any authenticated user; in auth.type=DISABLED → any caller including unauthenticated"
- known_security_gaps:
  - "No per-permission gate; any authenticated user sees the full title directory regardless of role/policy/owner. — evidence: TitleController.java:1-24 (no @PreAuthorize) + SecurityConstants.java:95-355 (no rule) — severity: LOW (titles are role-labels, not sensitive data; gap is auditability-shaped, not exfil-shaped)"
  - "DISABLED mode exposes the directory to unauthenticated callers (default for dev / sandbox; documented as such per the workspace's auth.type DISABLED stance). — evidence: DisabledAuthSecurityConfiguration.java:13-18 — severity: LOW"
  - "No rate-limit / size-cap; an authenticated caller can amplify the response by passing size=N for very large N. — evidence: TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:91 + components.yaml:4222-4229 (no maximum) — severity: MEDIUM (vector for resource exhaustion; not data-exfil)"

## performance

- hot_paths:
  - "GET /api/titles is called from EVERY ownership-form open in the UI (OwnerTitleAutocomplete dispatches on autocomplete-open, debounced 500ms) AND every Data Quality filter open (TitleFilter.tsx). Frequency: bounded by user interactions with ownership / DQ filter UIs."
  - "Single SQL execution per request: SELECT + count CTE (the paginate-wrapper at JooqQueryHelper.paginate:73 uses a `count().over()` window function which is computed in the same scan). No JOIN; pure single-table read." — evidence: ReactiveAbstractCRUDRepository.java:89-99 + JooqQueryHelper.paginate:73-81
- throughput_characteristics:
  - "Single-call read; no batch endpoint. Reactive Mono signature — non-blocking but one DB round-trip per call."
  - "Frontend debounces input by 500ms (OwnerTitleAutocomplete.tsx:49) so per-keystroke amplification is bounded."
- resource_allocation:
  - "Result-set bounded only by caller-supplied `size`. With size=100000 the JVM holds up to 100000 TitlePojo + Title DTOs in memory simultaneously (List<TitlePojo> at ReactiveAbstractCRUDRepository.java:94 + List<Title> at TitleMapper.java:17-18)."
  - "Count CTE adds O(N) cost via the window function (count().over() with no PARTITION BY scans the entire filtered set per row); on a 10000-row title directory this is still cheap but not free."
- scaling_characteristics:
  - "Stateless controller; horizontal scaling unimpeded"
  - "No pagination cap; list size grows O(N) with the directory; the directory grows monotonically (free-text auto-create) and never tombstones in production (no UI delete path)"
  - "Frontend client-side filter (MUI createFilterOptions) operates on the 30-row window; for a directory > 30 rows, titles older than the 30-row window are invisible to autocomplete users regardless of relevance to typed query"
- known_performance_gaps:
  - "No `size` cap — caller-controlled amplification at the directory level. Severity bounded by directory cardinality (typically tens, but a hostile or buggy client can request size=10^6 and the JVM materialises whatever Postgres returns). — evidence: TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:91 — severity: MEDIUM"
  - "Default size=30 in the UI is too small for installations with > 30 titles. After the 30 oldest entries, additional titles become un-autocompletable because the server's id-ASC ordering caps at the first 30 rows and the client-side MUI filter operates only on that fixed window. — evidence: OwnerTitleAutocomplete.tsx:43 (size=30 hard-coded) + the server-side ORDER BY id ASC at ReactiveAbstractCRUDRepository.java:91 — severity: LOW (UX-shaped; installations rarely exceed 30 titles)"

## upstream_callers

- entry_point: "ui_route:/dataentities/{id} (ownership form modal)"
  caller_node: "ts react-component:OwnershipForm.tsx (DataEntityDetails)"
  multiplicity_per_trigger: "1 per autocomplete-open + 1 per substring keystroke after 500ms debounce"
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewGeneral/OwnersSection/OwnershipForm/OwnershipForm.tsx (imports OwnerTitleAutocomplete) + <odd-platform-repo>/odd-platform-ui/src/components/shared/elements/Autocomplete/OwnerTitleAutocomplete/OwnerTitleAutocomplete.tsx:43-51 (debounced dispatch)"
  observation_class: ui-call
  unresolved: false
- entry_point: "ui_route:/terms/{id} (term ownership form modal)"
  caller_node: "ts react-component:OwnershipForm.tsx (TermDetails)"
  multiplicity_per_trigger: "1 per autocomplete-open + 1 per debounced keystroke"
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/Terms/TermDetails/Ownership/OwnershipForm.tsx (imports OwnerTitleAutocomplete)"
  observation_class: ui-call
  unresolved: false
- entry_point: "ui_route:/data-quality (DQ runs filter sidebar)"
  caller_node: "ts react-component:TitleFilter.tsx"
  multiplicity_per_trigger: "1 per filter-open"
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TitleFilter.tsx:14-46 + <odd-platform-repo>/odd-platform-ui/src/lib/hooks/api/title.ts:5-9 (useGetTitleList hook)"
  observation_class: ui-call
  unresolved: false
- entry_point: "rest:GET /api/titles (direct API consumer)"
  caller_node: "external-api-client"
  multiplicity_per_trigger: "1 per call"
  evidence: "<odd-platform-repo>/odd-platform-specification/openapi.yaml:323-340 (operation getTitleList)"
  observation_class: rest-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns TitleList payload `{items: Title[N], page_info: {total, hasNext}}` to the caller"
  evidence: "TitleController.java:22 (`titleService.list(...).map(ResponseEntity::ok)`)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}"
    - "ui_route:/terms/{id}"
    - "ui_route:/data-quality"
    - "rest:GET /api/titles"
- side_effect_class: db-write
  description: "NONE on this endpoint — GET is pure read. (The Title directory is mutated as a side effect of OwnershipServiceImpl.create/update via TitleService.getOrCreate, NOT via this controller. See batch-K OwnershipServiceImpl sidecar.)"
  evidence: "TitleController.java:14-24 (no write call) + TitleServiceImpl.java:25-27 (list calls only repository.list)"
  cardinality_per_call: 0
  reachable_from_entry_points: []
- side_effect_class: log-emit
  description: "NONE explicit; no @Slf4j on TitleController, no log statements. Spring WebFlux access log (if enabled) emits one entry per request via the global filter."
  evidence: "TitleController.java:1-24 (no logger import, no log statements)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← TitleController.java:14-24 + TitleServiceImpl.java:24-27 + ReactiveAbstractCRUDRepository.java:84-100 + V0_0_53__rename_role_to_title.sql:1-2 + V0_0_3__add_ownership.sql:1-22 + OwnerTitleAutocomplete.tsx:43-48 + SecurityConstants.java:95-355
- concepts.entities.Title ← components.yaml:278-288
- concepts.entities.TitleList ← components.yaml:290-300
- concepts.entities.TitlePojo ← V0_0_3__add_ownership.sql:1-8 + V0_0_53__rename_role_to_title.sql:1-2
- concepts.operations.getTitleList ← TitleController.java:17-23 + TitleServiceImpl.java:24-27 + ReactiveAbstractCRUDRepository.java:84-100
- concepts.operations.getOrCreate ← TitleServiceImpl.java:19-22 + ReactiveTitleRepositoryImpl.java:22-27
- concepts.invariants[0] (ORDER BY id ASC) ← ReactiveAbstractCRUDRepository.java:91 + JooqQueryHelper.paginate:63-80 + V0_0_3__add_ownership.sql:3
- concepts.invariants[1] (containsIgnoreCase) ← ReactiveAbstractCRUDRepository.java:240-249
- concepts.invariants[2] (soft-delete filter) ← ReactiveTitleRepositoryImpl.java:14 + ReactiveAbstractSoftDeleteCRUDRepository.java:87-104
- concepts.invariants[3] (no per-permission gate) ← SecurityConstants.java:95-355 + LoginFormSecurityConfiguration.java:50-57 + AuthorizationCustomizer.java:21-30
- concepts.invariants[5] (no size cap) ← TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:91 + components.yaml:4222-4229
- dependencies_semantic.requires-feature.Ownership ← OwnershipServiceImpl.md (batch K sidecar) invariants[2] + V0_0_3__add_ownership.sql:15 + V0_0_53__rename_role_to_title.sql:4-5
- dependencies_semantic.requires-feature.Policies ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies (2026-05-25, status 200; mentions `dataEntity:owner:title` and `term:owner:title`)
- dependencies_semantic.requires-feature.DQRuns ← openapi.yaml:2009-2018, 2059-2068
- tests_coverage_semantic.covered_behaviours.* ← TitlesRepositoryImplTest.java:23-172 + OwnershipServiceImplTest.java:78-112
- docs_link_semantic.inferred_docs[0] ← WebFetch (2026-05-25, status 200)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch 404s on `/active-platform-features/ownership`, `/features/ownership`, `/main-concepts`, `/getting-started/main-concepts` + 200 on `/configuration-and-deployment/enable-security/authorization` (no mention) + 200 on Policies (mention without definition)
- implicit_adrs[0] ← TitleController.java:14-24 + TitleService.java:7-11 + grep `titleRepository.create\(` (only TitleServiceImpl.java:21 + tests)
- implicit_adrs[1] ← ReactiveAbstractCRUDRepository.java:91 + JooqQueryHelper.java:42-46
- implicit_adrs[2] ← ReactiveTitleRepositoryImpl.java:14 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- bugs_limitations_corner_cases[0] ← SecurityConstants.java:95-355 + LoginFormSecurityConfiguration.java:50-57
- bugs_limitations_corner_cases[1] ← TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:91 + components.yaml:4222-4229
- bugs_limitations_corner_cases[2] ← TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:91
- bugs_limitations_corner_cases[3] ← ReactiveAbstractCRUDRepository.java:240-249
- bugs_limitations_corner_cases[4] ← V0_0_3__add_ownership.sql:4 + TitleServiceImpl.java:19-22 + OwnerTitleAutocomplete.tsx:43-48
- bugs_limitations_corner_cases[5] ← TitleServiceImpl.java:19-22 + ExceptionUtils.java:22-23, 72-74
- bugs_limitations_corner_cases[6] ← WebFetch 2026-05-25
- stress_findings.tunables.size ← TitleController.java:18-19 + ReactiveAbstractCRUDRepository.java:91 + components.yaml:4222-4229 + P-129
- stress_findings.tunables.page ← TitleController.java:18 + ReactiveAbstractCRUDRepository.java:91 + components.yaml:4213-4221 + P-129
- stress_findings.orderings ← ReactiveAbstractCRUDRepository.java:91 + JooqQueryHelper.paginate:63-90 + OwnerTitleAutocomplete.tsx:38-89
- stress_findings.auth_gates ← SecurityConstants.java:95-355 + LoginFormSecurityConfiguration.java:50-57 + OAuthSecurityConfiguration.java:98-100 + AuthorizationCustomizer.java:20-31 + DisabledAuthSecurityConfiguration.java:13-18
- stress_findings.resource_boundaries ← TitleServiceImpl.java:19-22 + ExceptionUtils.java:22-23, 72-74
- stress_findings.request_inputs ← TitleController.java:18-22 + components.yaml:4213-4237
- security.auth_mode_relevance ← LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + DisabledAuthSecurityConfiguration.java:10
- security.authorization_assertions ← TitleController.java:1-24 (no @PreAuthorize) + SecurityConstants.java:95-355 (no rule)
- security.data_exposure ← TitleController.java:22 + V0_0_3__add_ownership.sql:1-8 (table columns)
- performance.hot_paths ← OwnerTitleAutocomplete.tsx:43-51 + TitleFilter.tsx:14-46
- performance.throughput_characteristics ← OwnerTitleAutocomplete.tsx:49 (debounce) + ReactiveAbstractCRUDRepository.java:89-99
- performance.scaling_characteristics ← TitleController.java:14 (stateless) + ReactiveAbstractCRUDRepository.java:91 (no cap)
- upstream_callers.* ← OwnerTitleAutocomplete.tsx:43-51 + TitleFilter.tsx:14-46 + openapi.yaml:323-340
- downstream_side_effects.* ← TitleController.java:22

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (no actual latency measurements; throughput characteristics inferred from code shape, not benchmarked)
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH (30/36 STATIC-INFERRED with strong file:line evidence; 6/36 PROBE-NEEDED routed to P-129 + cross-batch LDAP-config-presence reference)

## Maintainer notes
