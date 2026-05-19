---
node_id: "odd-platform java DataEntityController controller-method:upsertDataEntityInternalDescription"
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

# DataEntityController#upsertDataEntityInternalDescription — semantic understanding

## understanding

`upsertDataEntityInternalDescription` is the reactive `PUT /api/dataentities/{data_entity_id}/description` handler — a four-line pipeline that reads `@Valid Mono<InternalDescriptionFormData>`, delegates to `dataEntityService.upsertDescription(dataEntityId, form)`, and lifts the resulting `InternalDescription` (the new description + parsed term-linkages) into `200 OK`. The endpoint is the **largest free-text write surface on a per-entity basis**: operators paste arbitrary Markdown into `internal_description`, which the platform stores raw, links to Glossary Terms via the `[[namespace:term]]` regex (`TermServiceImpl.java:67`), refreshes the FTS search vector with weight `B` (`FTSConstants.java:40`), marks `data_entity_filled.internal_description_filled`, and emits a `DESCRIPTION_UPDATED` activity event capturing the old/new descriptions as JSON (`DescriptionUpdatedActivityHandler.java:39-42`). The "upsert" name is **misleading**: the underlying `setInternalDescription` repository call is a pure `UPDATE … WHERE id = ?` (`ReactiveDataEntityRepositoryImpl.java:432-435`) — it silently no-ops on a missing data entity, returns no row, and the reactor pipeline collapses to `Mono.empty` → caller sees `200 OK` with an empty body. Authorization is enforced centrally by `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/description', PUT, DATA_ENTITY_DESCRIPTION_UPDATE)` (`SecurityConstants.java:194-197`). There is **no backend HTML/Markdown sanitisation** and the UI relies on `@uiw/react-markdown-preview@4.2.2` which pulls in `rehype-raw@6.1.1` (`pnpm-lock.yaml:5922`) — making the description column a potential stored-XSS / link-injection surface.

## concepts

- entities: [
    "`InternalDescription` (response payload — `internal_description: String` + `terms: List<LinkedTerm>` — both required per `components.yaml:2184-2186`)",
    "`InternalDescriptionFormData` (request body — single `internal_description: String` field, marked required at the OpenAPI level per `components.yaml:2193-2194`, no `maxLength` / `pattern` / `minLength`)",
    "`DataEntityPojo.internalDescription` (jOOQ column — Postgres `text` since `V0_0_1__init.sql:80`; unbounded length)",
    "`LinkedTerm` (auto-resolved glossary term references parsed from `[[namespace:term]]` syntax in the description body)",
    "`DescriptionActivityStateDto` (activity-feed JSON payload — wraps just the description string)"
  ]
- operations: [
    "`replace-internal-description` — `setInternalDescription(id, description)` → `updateDataEntityVectors(id)` → `markEntityFilled/Unfilled(id, INTERNAL_DESCRIPTION)` → `handleDataEntityDescriptionTerms(id, description)` → return `InternalDescription{newDescription, linkedTerms}`",
    "`parse-and-link-glossary-terms` — `TermServiceImpl.findTermsInDescription` applies `Pattern.compile(\"\\\\[\\\\[([^:]*?):([^\\\\]]*?)\\\\]\\\\]\")` to extract `[[ns:term]]` mentions, resolves each against the term table, and updates `term_relations` rows for this data entity",
    "`emit-DESCRIPTION_UPDATED-activity-event` — `@ActivityLog(event = DESCRIPTION_UPDATED)` on `DataEntityInternalStateServiceImpl.updateDescription` captures the old description (pre-mutation `getInternalDescription()`) and new description (post-mutation `getInternalDescription()`) into the activity feed",
    "`refresh-fts-search-vector` — `reactiveSearchEntrypointRepository.updateDataEntityVectors(id)` re-tokenises `INTERNAL_DESCRIPTION` (FTS weight `B`) into the search index"
  ]
- invariants: [
    "Empty / null / whitespace-only body normalises to NULL in the DB — `ReactiveDataEntityRepositoryImpl.setInternalDescription` (line 431): `final String newDescription = StringUtils.isEmpty(description) ? null : description;`. An empty string clears the description.",
    "OpenAPI marks `internal_description` REQUIRED (`components.yaml:2193-2194`) but the field accepts any string value including `\"\"` — the required-ness only forces clients to send the key, not non-empty content. A body `{\"internal_description\": \"\"}` is the documented way to clear a description.",
    "**Endpoint is an UPDATE, not an UPSERT** — `setInternalDescription` is `DSL.update(DATA_ENTITY).set(INTERNAL_DESCRIPTION, …).where(ID.eq(id)).returning()` (`ReactiveDataEntityRepositoryImpl.java:432-435`). If `dataEntityId` does not exist, the query updates 0 rows, the `mono(query).map(r -> r.into(DataEntityPojo.class))` returns `Mono.empty`, the rest of the pipeline (`reactiveSearchEntrypointRepository.updateDataEntityVectors`, `markEntityFilled`, the term-handling, the activity emission) is short-circuited via empty-mono propagation, and the controller returns `200 OK` with an empty body — NOT `404 Not Found`. The path lacks any `switchIfEmpty(Mono.error(new NotFoundException(\"DataEntity\", id)))`.",
    "**No backend sanitisation of Markdown / HTML** — `setInternalDescription` stores the body verbatim; there is no `Jsoup.clean`, no `Encode.html`, no allowlist, no length cap, no `@Size` on the form-data DTO. The description column is `text` (unbounded). The full request body persists exactly as the client sent it.",
    "Term-linking parser uses regex `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` — namespace and term name are matched non-greedily; both groups must be non-empty for a term to be linked (`TermServiceImpl.java:344-348`).",
    "Activity log captures only the description text, not the parsed terms — `DescriptionActivityStateDto` is `{description}` only (`DescriptionUpdatedActivityHandler.java:40-42`)."
  ]
- audiences: [
    "ODD Platform UI — entity-detail page `Overview > Description` panel. Read via `InternalDescriptionPreview` rendering `<Markdown value={value} />`; write via `InternalDescriptionEdit` posting through the `updateDataEntityInternalDescription` redux thunk (`dataentities.thunks.ts:104-127`)",
    "Callers WITH `DATA_ENTITY_DESCRIPTION_UPDATE` permission resolved per-data-entity (admin policy OR per-entity policy granting the permission — typically scoped via `\"is\": \"dataEntity:owner\"` for owners-only edit)",
    "FTS consumers — every catalog search includes the description as weight `B` content (`FTSConstants.java:40`)",
    "Activity feed consumers — `GET /api/activity` (global) and `GET /api/dataentities/{id}/activity` (per-entity) replay the `DESCRIPTION_UPDATED` events with full old/new description payloads"
  ]

## dependencies_semantic

- requires-feature: [
    "`DataEntityService.upsertDescription` (`DataEntityServiceImpl.java:323-333`, `@ReactiveTransactional`) — owns the orchestration: delegate to internal-state service, then handle term-linking, then map terms to `LinkedTerm` response payload",
    "`DataEntityInternalStateService.updateDescription` (`DataEntityInternalStateServiceImpl.java:54-71`, `@ReactiveTransactional` + `@ActivityLog(DESCRIPTION_UPDATED)`) — owns the actual write: repository UPDATE → FTS vector refresh → markEntityFilled/Unfilled based on emptiness",
    "`ReactiveDataEntityRepository.setInternalDescription` (`ReactiveDataEntityRepositoryImpl.java:430-438`) — the jOOQ UPDATE statement with the empty-string-to-null normalisation",
    "`ReactiveSearchEntrypointRepository.updateDataEntityVectors` — rebuilds the full-text search vector including `INTERNAL_DESCRIPTION` (weight B per `FTSConstants.java:40`)",
    "`TermService.handleDataEntityDescriptionTerms` (`TermServiceImpl.java:198-207`, `@ReactiveTransactional` + `@ActivityLog(TERM_ASSIGNMENT_UPDATED)`) — parses `[[ns:term]]` mentions and updates the term-relation rows",
    "`DataEntityFilledService.markEntityFilled / markEntityUnfilled` — toggles the `data_entity_filled.internal_description_filled` column for catalog-completeness statistics",
    "`DescriptionUpdatedActivityHandler` (`DescriptionUpdatedActivityHandler.java`) — captures the pre-mutation description as `oldState` and the post-mutation description as `newState`, wraps in `DescriptionActivityStateDto`, JSON-serialises into the activity row",
    "OpenAPI-generated `DataEntityApi.upsertDataEntityInternalDescription` interface — supplies the `PUT /api/dataentities/{data_entity_id}/description` mapping, `@Valid @RequestBody`, and the `200 → InternalDescription` response (`openapi.yaml:927-947`)"
  ]
- requires-config: [
    "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates which `SecurityWebFilterChain` is active. SECURITY_RULES are consulted only by the LOGIN_FORM / OAUTH2 / LDAP chains. Under DISABLED, `DisabledAuthSecurityConfiguration.securityWebFilterChainDisabled` uses `anyExchange().permitAll()` and `DATA_ENTITY_DESCRIPTION_UPDATE` is NEVER checked (`DisabledAuthSecurityConfiguration.java:14-17`)"
  ]
- requires-runtime: [
    "Spring WebFlux (`@RestController` on `DataEntityController.java:67`; reactive `Mono` pipeline)",
    "Reactor Core (`Mono.flatMap` / `map` composition)",
    "jOOQ + R2DBC reactive Postgres bindings (`ReactiveDataEntityRepositoryImpl.setInternalDescription`)",
    "Postgres `data_entity.internal_description` of type `text` (unbounded; `V0_0_1__init.sql:80`)"
  ]
- coupling: [
    "Authorization — protected by `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/description', PUT, DATA_ENTITY_DESCRIPTION_UPDATE)` (`SecurityConstants.java:194-197`). The controller method has NO `@PreAuthorize`. Permission is resource-scoped via `DataEntityPermissionExtractor` → `permissionService.getResourcePermissionsForCurrentUser(DATA_ENTITY, dataEntityId)`. Resolvable Policy scopes per `DataEntityConditionResolver.java:35-47` include `DATA_ENTITY_OWNER` — Policy can grant `DATA_ENTITY_DESCRIPTION_UPDATE` only to owners of the specific entity.",
    "Term-linking coupling — the description body is also a write path to `term_relations` (every `[[ns:term]]` mention creates / removes a row tying this data entity to the term). A description edit thus ALSO emits `TERM_ASSIGNMENT_UPDATED` activity events alongside `DESCRIPTION_UPDATED`.",
    "FTS coupling — description content drives search ranking. A long / keyword-dense description gives this entity higher rank on those tokens.",
    "UI-rendering coupling — the description is rendered client-side by `@uiw/react-markdown-preview@4.2.2` via `<Markdown value={value} />` (`Markdown.tsx:113-124`). `react-markdown-preview` pulls in `rehype-raw@6.1.1` (`pnpm-lock.yaml:5922`) which parses raw HTML embedded in the Markdown — no `rehype-sanitize` is configured anywhere in the UI (`grep rehype-sanitize` returns 0 matches), no `skipHtml` prop is passed."
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "None — `grep upsertDescription | upsertDataEntityInternalDescription | InternalDescriptionFormData` across `odd-platform-api/src/test/**` returns ZERO matches. There is no unit test, no service-layer test, no `WebTestClient` smoke test, no integration test."
  ]
- uncovered_behaviours: [
    "Happy-path HTTP smoke test — no `WebTestClient` exercises `PUT /api/dataentities/{id}/description` end-to-end (request → controller → service → repository → response).",
    "**404-on-missing-entity path** — no test asserts what happens when `dataEntityId` does not exist. Current code returns `200 OK` with an empty body (silent UPDATE no-op); a maintainer adding a `switchIfEmpty(NotFoundException)` would have nothing to verify against.",
    "Empty body / clearing the description — no test asserts `\"\" → NULL` normalisation, no test asserts that clearing a description toggles `data_entity_filled.internal_description_filled` to false.",
    "Very-long description — no test exercises >1 MiB descriptions to confirm the unbounded `text` column accepts them or to characterise the request-size limit at the WebFlux layer.",
    "Markdown / HTML body — no test stores `<script>alert(1)</script>` or `<img src=x onerror=fetch(...)>` and asserts the round-tripped content is sanitised. (It is not currently — the storage is verbatim.)",
    "Term-linking edge cases — no test asserts `[[ns:term]]` with empty namespace, empty term, missing `]]`, nested `[[`, namespace containing a literal colon, or 100+ mentions in a single body.",
    "Concurrency — no test exercises two simultaneous PUTs against the same `dataEntityId` (last-writer-wins behaviour vs lost-update).",
    "Activity-event emission — no assertion that `DESCRIPTION_UPDATED` events are persisted with the correct `oldState` / `newState` JSON payloads.",
    "Authorization — no test asserts that a caller WITHOUT `DATA_ENTITY_DESCRIPTION_UPDATE` is rejected with 403, no test asserts the `dataEntity:owner` scoped Policy correctly grants only on the entity the caller owns.",
    "**DISABLED-mode reachability** — no test asserts the endpoint accepts unauthenticated requests under `auth.type=DISABLED`.",
    "FTS vector refresh — no test asserts that updating a description refreshes the search vector and that the new content is matchable by a subsequent search."
  ]
- test_files: [
    "None — the endpoint has zero direct test coverage at any layer. (`grep -ril 'upsertDescription' odd-platform-api/src/test/` → no results.)"
  ]
- gaps: |
    The description-write endpoint is the largest free-text write surface on a per-entity basis (Markdown body of unbounded length) AND the primary write into `term_relations` via the `[[ns:term]]` linker AND a write into the FTS index AND an activity-feed source — four side effects per call, zero direct tests. The combination of:

    (a) **silent UPDATE-not-UPSERT** (`200 OK` returned when the data entity doesn't exist — operators cannot distinguish "successfully wrote" from "id was wrong");
    (b) **no backend sanitisation of arbitrary Markdown / HTML** combined with a UI that pulls in `rehype-raw` and configures no `rehype-sanitize`;
    (c) **no length cap** on a `text` column (a 100 MiB description is technically accepted, then FTS-indexed, then served back to every consumer of the entity);
    (d) **DISABLED-mode reachability** — anonymous traffic can rewrite descriptions, including injecting `[[ns:term]]` mentions that auto-link to glossary terms;

    makes regressions here doubly dangerous: a content-injection bug ships invisibly to every consumer (UI render + activity feed re-render + search ranking + glossary cross-link), and a test suite of size zero catches none of them. The highest-likelihood regression sites are:
    - **Stored-XSS via Markdown + raw HTML** — any caller able to PUT can store `<img src=x onerror=…>` or `<a href="javascript:…">` or `<iframe>`. The render path depends on `react-markdown`'s allowed-elements schema interacting with `rehype-raw`'s HTML parsing; the absence of an explicit `rehype-sanitize` pipeline AND the absence of any backend sanitisation means a future bump of `@uiw/react-markdown-preview` (or `react-markdown` itself) could quietly broaden the allowlist with no caught regression.
    - **404 silently swallowed** — a future maintainer wiring this endpoint into a script and seeing `200 OK` may assume success on a wrong / typoed id; the activity-feed will show nothing (the `@ActivityLog` doesn't fire because the service-layer `updateDescription` Mono completes empty), making the failure invisible.
    - **Term-linker pattern injection** — `TermServiceImpl.java:67` `Pattern.compile("\\[\\[([^:]*?):([^\\]]*?)\\]\\]")` is greedy enough that a body containing `[[a:b]] foo [[c:d]]` parses both, but malformed mentions like `[[a:b:c]]` (extra colon) match group 2 as `b:c` and attempt term-lookup with that name — silently failing if no such term exists, but ALSO silently succeeding if a term `b:c` was previously created by another path.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention (no `@docs` annotations are bootstrapped in `odd-platform-api`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `DATA_ENTITY_DESCRIPTION_UPDATE` (the permission this endpoint enforces) and its siblings within the Data Entity permission group. The existing controller-level sidecar (`odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:143`) records the verified verbatim text: `DATA_ENTITY_DESCRIPTION_UPDATE: \"Allows editing and deleting a data entity's custom description.\"` — fetched in batch 2026-05-12F session."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: "200 (verified in batch 2026-05-12F; not re-fetched in this session — WebFetch was unavailable)"
    confidence: HIGH
    fetched_excerpts: |
      From batch 2026-05-12F controller-level sidecar (verbatim quote of live page content):
        DATA_ENTITY_DESCRIPTION_UPDATE: "Allows editing and deleting a data entity's custom description."
  - url: "https://docs.opendatadiscovery.org/data-discovery/business-names"
    anchor: ""
    rationale: "Closest documentation page by topic — business-names is the parallel write surface (`upsertDataEntityInternalName`, `PUT /api/dataentities/{id}/name`) and its doc page may cover descriptions by extension. Not verified in this session — WebFetch denied; the local documentation repo is not checked out at `../documentation`. Confidence is LOW because the page topic is named after the SIBLING endpoint (internal NAME), not description."
    last_verified_at: "2026-05-13T00:00:00Z"
    last_verified_status: "not-verified — WebFetch denied; local docs repo not present"
    confidence: LOW
    fetched_excerpts: |
      N/A — could not verify. The maintainer should fetch the live page and confirm whether it covers internal_description editing and the Markdown-rendering caveats.
  - url: "https://docs.opendatadiscovery.org/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Activity Feed documents the `DESCRIPTION_UPDATED` event type — the audit trail this controller method emits on every successful call. Referenced in concepts.yaml batch 2026-05-12F (line 436) as the global audit surface that exposes description old/new state."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: "200 (verified in prior batches; not re-fetched in this session)"
    confidence: MEDIUM
    fetched_excerpts: |
      From the concepts.yaml aggregate (batch 2026-05-12F): "Global `/api/activity` returns audit trails across every owner — including ActivityState old/new diffs of descriptions, business names, ownership changes, custom metadata — to ANY authenticated user."
- doc_drift_findings: [
    "**Doc-gap candidate**: no documentation page explicitly covers the description-editing surface (the API endpoint, the Markdown rendering, the `[[ns:term]]` glossary-link syntax, the activity-feed emission, the term-linking side effect). The `data-discovery/business-names` page may discuss the sibling internal NAME endpoint without covering description; this needs maintainer verification with WebFetch.",
    "**Doc-gap candidate**: the `[[namespace:term]]` glossary-link syntax (`TermServiceImpl.java:67`) is platform-specific and almost certainly undocumented in operator-facing documentation. Operators writing descriptions have no canonical reference for this syntax.",
    "**Doc-gap candidate**: the misleading `upsert` operationId — the endpoint is documented as 'Upsert DataEntity's internal description' (`openapi.yaml:929-930`) but the implementation is pure UPDATE with silent no-op on missing entity. A user reading the OpenAPI summary would expect a POST-or-PUT-semantics upsert that creates the underlying entity row; the actual semantics are 'replace if exists, silently succeed if missing'.",
    "**Doc-gap candidate**: no documentation page covers the Markdown rendering pipeline used for descriptions (`@uiw/react-markdown-preview` + `rehype-raw`) or the absence of backend sanitisation. Operators evaluating ODD for self-host deployments with untrusted-user content cannot assess the XSS surface from the published docs."
  ]

## implicit_adrs

- "Description is stored as raw Markdown / free-text with no backend transformation — the platform delegates rendering entirely to the UI." — evidence: `ReactiveDataEntityRepositoryImpl.java:430-438` (UPDATE writes the body verbatim, only normalising empty-to-null) + `openapi.yaml:929-930` ("Upserts DataEntity's internal description in markdown format"). — intent_anchor: "in markdown format" (the OpenAPI description states the format intent inline). — confidence: HIGH
- "Glossary terms are auto-linked from description bodies via the `[[namespace:term]]` syntax — terms are not assigned separately from the description text, the description IS the term-assignment mechanism for inline references." — evidence: `TermServiceImpl.java:67` (the regex pattern is a class-level constant) + `TermServiceImpl.java:198-207` (`handleDataEntityDescriptionTerms` orchestrates parse-and-link as part of the description-write pipeline) + `DataEntityServiceImpl.java:328` (description-update invokes the term-linking flow unconditionally). — intent_anchor: the regex `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` is a stable class-level constant, encoding the syntax as part of the platform's contract with description authors. — confidence: HIGH
- "Empty / null description is the canonical way to clear a description — the platform normalises empty-string to SQL NULL." — evidence: `ReactiveDataEntityRepositoryImpl.java:431` (`final String newDescription = StringUtils.isEmpty(description) ? null : description;`) + `DataEntityInternalStateServiceImpl.java:62-68` (the empty-check that toggles `data_entity_filled.internal_description_filled`). — intent_anchor: the explicit `isEmpty → null` normalisation, paired with the `isNotEmpty` filled-flag toggle, encodes the intent that empty and null are equivalent states meaning "no description". — confidence: HIGH
- "Description edits emit a dedicated `DESCRIPTION_UPDATED` activity event (separate from the generic `TERM_ASSIGNMENT_UPDATED` that the description-term-linking pipeline ALSO emits). Two events per description edit are intentional — one for the description-text change, one for any term-relation changes that result." — evidence: `DataEntityInternalStateServiceImpl.java:56` (`@ActivityLog(event = ActivityEventTypeDto.DESCRIPTION_UPDATED)` on `updateDescription`) + `TermServiceImpl.java:200` (`@ActivityLog(event = ActivityEventTypeDto.TERM_ASSIGNMENT_UPDATED)` on `handleDataEntityDescriptionTerms`) + `DataEntityServiceImpl.java:327-328` (both are called sequentially within `upsertDescription`). — intent_anchor: the use of TWO distinct `@ActivityLog` annotations on the two service methods reflects the intent that description-text and term-linking are auditable as independent state-changes. — confidence: HIGH
- "Description content directly drives search ranking — `INTERNAL_DESCRIPTION` is registered with FTS weight `B` (second-tier after `INTERNAL_NAME` / `EXTERNAL_NAME` at weight `A`) and refreshed atomically on every description update." — evidence: `FTSConstants.java:40` (`Map.entry(DATA_ENTITY.INTERNAL_DESCRIPTION, \"B\")`) + `DataEntityInternalStateServiceImpl.java:60-61` (`reactiveSearchEntrypointRepository.updateDataEntityVectors(dataEntityId)` immediately after the description write). — intent_anchor: the FTS weight `B` is a deliberate ranking choice — descriptions matter for search but less than names. — confidence: HIGH
- "Description-write is gated by a DEDICATED permission `DATA_ENTITY_DESCRIPTION_UPDATE`, distinct from `DATA_ENTITY_INTERNAL_NAME_UPDATE` — administrators can grant edit rights to descriptions independently of name edits." — evidence: `PolicyPermissionDto.java:18` (`DATA_ENTITY_DESCRIPTION_UPDATE(DATA_ENTITY)`) + `SecurityConstants.java:194-197` (the SECURITY_RULES entry distinct from the `name` PUT rule at lines 198-200). — intent_anchor: two separate SECURITY_RULES entries for the two adjacent endpoints, registered in immediate succession but with distinct permission constants — the maintainers deliberately split the privilege model. — confidence: HIGH
- "Description-write is `@ReactiveTransactional` — the description text, FTS vector, filled-flag, term-relation updates, and the two activity events all commit (or all roll back) atomically." — evidence: `DataEntityServiceImpl.java:324` (outer `@ReactiveTransactional` on `upsertDescription`) + `DataEntityInternalStateServiceImpl.java:55` (inner `@ReactiveTransactional` on `updateDescription`). — intent_anchor: nested transactional annotations on both layers reflect the intent that a partial-failure state (e.g. description written but term-relations not updated) is forbidden. — confidence: HIGH

## bugs_limitations_corner_cases

- "**No backend sanitisation of arbitrary Markdown / HTML body** — `setInternalDescription` writes the request body verbatim into the `text` column. The UI renders via `@uiw/react-markdown-preview@4.2.2` (`Markdown.tsx:113-124`), which transitively pulls in `rehype-raw@6.1.1` (`pnpm-lock.yaml:5922`) — `rehype-raw` parses raw HTML embedded inside Markdown into AST nodes that `react-markdown` then renders. NO `rehype-sanitize` is configured (`grep -rln 'rehype-sanitize' odd-platform-ui/` → 0 matches), NO `skipHtml` prop is set on the `MDEditor.Markdown` invocation. Whether `<script>` survives depends on `react-markdown`'s default allowed-elements schema, but `<img src=x onerror=…>`, `<a href=\"javascript:…\">`, `<iframe>`, `<style>`, and HTML-comment-based payloads are not categorically excluded. A future minor-version bump of any of the rendering libraries can widen the surface invisibly. Every description-display surface (entity-detail page Description tab, activity-feed event-detail dialog rendering old/new description JSON, lineage-tooltip if it shows descriptions, search-result snippet) is downstream of this gap. Severity HIGH because the writer is `DATA_ENTITY_DESCRIPTION_UPDATE`-gated under non-DISABLED auth modes but the readers include any authenticated user with `DATA_ENTITY_VIEW` (effectively every catalog visitor) — one malicious / careless writer reaches every reader." — evidence: `ReactiveDataEntityRepositoryImpl.java:430-438` (verbatim store) + `Markdown.tsx:113-124` (`MDEditor.Markdown` invocation with no `skipHtml`) + `pnpm-lock.yaml:5922` (`rehype-raw` transitive dependency) + absence of `rehype-sanitize` in the entire UI repo. — severity: HIGH
- "**'Upsert' is misleading — the endpoint is a pure UPDATE with silent no-op on a missing data entity.** `setInternalDescription` is `DSL.update(DATA_ENTITY).set(INTERNAL_DESCRIPTION, …).where(DATA_ENTITY.ID.eq(dataEntityId)).returning()` (`ReactiveDataEntityRepositoryImpl.java:432-435`). If `dataEntityId` does not exist, the query updates 0 rows, the `mono(query).map(r -> r.into(DataEntityPojo.class))` returns `Mono.empty`, the rest of the reactive pipeline collapses, and the controller returns `200 OK` with an empty body — NOT `404 Not Found`. Compare with `updateStatus` (sibling endpoint) where `DataEntityServiceImpl.updateStatus` (line 467) calls `.switchIfEmpty(() -> Mono.error(new NotFoundException(\"DataEntity\", id)))` to convert missing-entity into 404. The description path has no such guard. Operators using the API by id (e.g. from a script that scrapes ids from search results) cannot distinguish 'wrote successfully' from 'id is wrong / soft-deleted'. Activity feed shows nothing in the no-op case." — evidence: `ReactiveDataEntityRepositoryImpl.java:430-438` (UPDATE only, no INSERT branch, no existence check) + `DataEntityServiceImpl.java:324-333` (upsertDescription has no NotFoundException path) + contrast with `DataEntityServiceImpl.updateStatus` line 467. — severity: MEDIUM
- "**No length validation on description body** — `InternalDescriptionFormData.internal_description` has `type: string` with NO `maxLength` (`components.yaml:2188-2194`); the form DTO carries no Bean Validation `@Size` annotation (generated from OpenAPI). The Postgres column is `text` (unbounded since `V0_0_1__init.sql:80`). A 100 MiB description body is accepted, stored, re-served on every entity read, FTS-indexed (potentially slowing search), and JSON-serialised into every activity-event row (potentially N times if the description is edited frequently). The Spring WebFlux request-size limit (`spring.codec.max-in-memory-size`, default 256 KB) is the only de facto cap, and it returns a generic 413 / 500, not a validation-shaped 400." — evidence: `components.yaml:2188-2194` (no `maxLength`) + `V0_0_1__init.sql:80` (`text` column) + `InternalDescriptionFormData` is OpenAPI-generated with no maxLength → no `@Size` on the generated DTO. — severity: MEDIUM
- "**No optimistic locking on description writes** — two simultaneous PUTs to the same `dataEntityId` race on last-writer-wins; no `@Version`, no `WHERE … AND internal_description = ?oldValue?` guard. The activity-event capture is `oldState = pre-mutation pojo.getInternalDescription()` (`DescriptionUpdatedActivityHandler.java:30`) — under concurrent writes, two events emit with the SAME `oldState` snapshot and different `newState` values, making the audit trail appear to show two parallel transitions from the same baseline (operator A's contribution is silently lost)." — evidence: `ReactiveDataEntityRepositoryImpl.java:432-435` (plain UPDATE, no version/etag predicate) + `DescriptionUpdatedActivityHandler.java:26-31` (oldState resolved via separate `get(dataEntityId)` call, not from the in-flight pojo). — severity: MEDIUM
- "**DISABLED-mode reachability** — under `auth.type=DISABLED`, `DisabledAuthSecurityConfiguration` uses `anyExchange().permitAll()` and SECURITY_RULES is not applied. Any unauthenticated caller able to reach the application port can rewrite arbitrary data-entity descriptions, including injecting `[[ns:term]]` glossary-link mentions that auto-create term-relations and injecting Markdown / HTML payloads that subsequently render to every authenticated reader. The Permissions doc says callers need `DATA_ENTITY_DESCRIPTION_UPDATE` — this is true only when auth.type is LOGIN_FORM / OAUTH2 / LDAP. Combined with the no-backend-sanitisation finding above, DISABLED-mode + an internet-exposed instance = wholesale content-injection on every entity in the catalog. Per the live security docs DISABLED is documented as dev-only, but the platform does NOT fail-closed on this path." — evidence: `DisabledAuthSecurityConfiguration.java:9-19` (`@ConditionalOnProperty(value = 'auth.type', havingValue = 'DISABLED')` + `anyExchange().permitAll()`) + `SecurityConstants.java:194-197` (the rule the DISABLED chain bypasses) + `ReactiveDataEntityRepositoryImpl.java:430-438` (no caller-identity check in the service). — severity: HIGH
- "**Term-linker pattern handles malformed mentions silently** — `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` matches `[[ns:term]]` non-greedily but does NOT validate either group's content beyond presence. A body containing `[[:term]]` (empty namespace) skips term-linking for that mention (`StringUtils.isNotEmpty` guard at `TermServiceImpl.java:346`); a body containing `[[ns:term:extra]]` matches group2 as `term` (non-greedy first `:`) and may auto-link to a term named just `term` if one exists in the namespace, ignoring the trailing `:extra` — silent semantic drift the writer never sees." — evidence: `TermServiceImpl.java:67` (the pattern constant) + `TermServiceImpl.java:341-348` (the matcher loop, no validation beyond non-empty check). — severity: LOW
- "**404 silently swallowed by activity-feed too** — since `setInternalDescription` returns `Mono.empty` on missing entity, the `@ActivityLog(DESCRIPTION_UPDATED)` AOP advice on `updateDescription` does NOT emit an event (empty Mono short-circuits the advice). An audit observer searching for 'who tried to edit this entity's description before it was deleted' finds nothing. Combine with the silent-200 finding above: the operator and the auditor are BOTH blind to wrong-id description writes." — evidence: `DataEntityInternalStateServiceImpl.java:54-71` (the entire pipeline is empty-mono-propagating) + Spring `@Around` advice semantics on reactive returns (empty Mono = no signal, no event). — severity: LOW
- "**No CSRF token check on this PUT** — `LoginFormSecurityConfiguration` does configure CSRF protection (verified in batch 2026-05-12C sidecar). However, the OAuth2 / LDAP / DISABLED chains' CSRF posture differs by mode, and the DISABLED chain explicitly disables CSRF (`DisabledAuthSecurityConfiguration.java:15`: `.csrf(ServerHttpSecurity.CsrfSpec::disable)`). A cross-site form on a victim's authenticated browser session, targeting `PUT /api/dataentities/{id}/description` with a payload that auto-renders a JavaScript-bearing Markdown image, requires CSRF defeat — under DISABLED this is no defence at all." — evidence: `DisabledAuthSecurityConfiguration.java:14-17` (`csrf(...)::disable`) + indirect evidence of CSRF posture variance across auth modes from batch-C sidecars. — severity: MEDIUM (in DISABLED + internet-exposed config) / LOW (in LOGIN_FORM with default CSRF posture)

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP
  - "PUT on the UI/API surface (`/api/dataentities/{id}/description`) — protected by `SecurityConstants.SECURITY_RULES` when the active chain is `LoginFormSecurityConfiguration` / `OAuthSecurityConfiguration` / `LDAPSecurityConfiguration`. Under DISABLED, the chain uses `anyExchange().permitAll()` and SECURITY_RULES is NOT consulted." — evidence: `DataEntityController.java:67-70` (`@RestController`, no method-level annotations) + `SecurityConstants.java:194-197` (the SECURITY_RULES entry) + `DisabledAuthSecurityConfiguration.java:14-17` (the DISABLED bypass).
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. The `IngestionDataEntitiesFilter` only registers on `POST /ingestion/entities`; PUT `/api/dataentities/{id}/description` is outside that path matcher."
- authorization_assertions:
  - "`SECURITY_RULES` entry: `new SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/description', PUT, DATA_ENTITY_DESCRIPTION_UPDATE)` — declarative rule wired by `AuthorizationCustomizer` into the SecurityWebFilterChain when auth.type ∈ {LOGIN_FORM, OAUTH2, LDAP}. Resolution path: `ReactiveResourcePermissionAuthorizationManager.check` → `URLResourceExtractor` resolves `data_entity_id` from the URI → `DataEntityPermissionExtractor.extract(dataEntityId)` → policy resolver evaluates per-data-entity Policy conditions (including `dataEntity:owner` for owner-scoped grants). The permission is resource-scoped — operators can write a Policy granting `DATA_ENTITY_DESCRIPTION_UPDATE` only on entities the user owns." — evidence: `SecurityConstants.java:194-197` + `DataEntityConditionResolver.java:35-47` (Policy condition keys including `DATA_ENTITY_OWNER`).
- owner_scoping: "N/A — code is not data-scoped at the controller-method layer. Scoping is delegated to the Policy framework via `DATA_ENTITY_OWNER` (`DataEntityConditionResolver.java:41`). The controller method itself does not check `authIdentityProvider.fetchAssociatedOwner()` — it relies on the authorization manager to have rejected the request before it reaches the handler. The service-layer (`DataEntityServiceImpl.upsertDescription`, `DataEntityInternalStateServiceImpl.updateDescription`) similarly has no caller-identity check."
- data_exposure:
  - "Successful PUT response body: `InternalDescription` payload — the (potentially malicious / arbitrary) description text the writer just submitted, plus the list of `LinkedTerm` references parsed from it. Echo-back response — confirms write to the writer. → caller with `DATA_ENTITY_DESCRIPTION_UPDATE` permission on that entity (under LOGIN_FORM/OAUTH2/LDAP); any caller able to reach the port under DISABLED." — evidence: `DataEntityController.java:202-211` (response shape) + `DataEntityServiceImpl.java:329-332` (`new InternalDescription(formData.getInternalDescription(), linkedTerms)` echoes the request).
  - "Audit-trail emission: `DESCRIPTION_UPDATED` activity event persisted with `data_entity_id`, `oldState` (JSON `{description}` snapshot of pre-mutation text), `newState` (JSON `{description}` snapshot of post-mutation text). Read-back via `/api/dataentities/{id}/activity` AND the global `/api/activity` (per batch-F findings, the global activity feed is readable by any authenticated user) exposes who edited which description with the full before/after text. **If the description contains sensitive content (incident notes, customer ids, internal tickets, leaked credentials), the activity feed surfaces it to every authenticated user with no redaction.** Cross-ref: concepts.yaml line 784 records this as a MEDIUM severity catalog-wide concern." — evidence: `DescriptionUpdatedActivityHandler.java:24-42` (the state-capture) + `DescriptionActivityStateDto` (the JSON shape) + concepts.yaml:436, 782, 784.
  - "Re-render exposure: every reader of the entity-detail page (anyone with `DATA_ENTITY_VIEW` on the entity) gets the description rendered as Markdown by the UI. Combined with the no-sanitisation finding, the writer's payload reaches every reader's browser as actual HTML." — evidence: `InternalDescriptionPreview.tsx:19-22` (`<Markdown value={value} />` unconditional render).
- known_security_gaps:
  - "**Stored content-injection / potential stored-XSS via Markdown body**: no backend sanitisation; UI uses `@uiw/react-markdown-preview@4.2.2` which pulls in `rehype-raw@6.1.1` (parses raw HTML in Markdown) with no `rehype-sanitize` configured. The exact attack surface depends on `react-markdown`'s default allowed-elements schema, but the absence of defence-in-depth at both layers is the gap. Every authenticated reader of an entity is downstream of the writer's payload. — severity: HIGH" — evidence: `ReactiveDataEntityRepositoryImpl.java:430-438` (verbatim store) + `Markdown.tsx:113-124` + `pnpm-lock.yaml:5922` (`rehype-raw` transitive) + absence of `rehype-sanitize` in the UI tree.
  - "**Under `auth.type=DISABLED`**, the endpoint is reachable by ANY caller. `DisabledAuthSecurityConfiguration.securityWebFilterChainDisabled` uses `anyExchange().permitAll()`, completely bypassing the SECURITY_RULES table and the resource-scoped permission check. CSRF protection is also disabled (`.csrf(...)::disable`). Combined with the no-sanitisation finding, DISABLED mode + an internet-exposed instance = wholesale content-injection on every entity in the catalog. — severity: HIGH" — evidence: `DisabledAuthSecurityConfiguration.java:9-19` + `SecurityConstants.java:194-197` (the rule DISABLED bypasses).
  - "**Activity-feed leakage of description content cross-owner**: `/api/activity` (global) is readable by any authenticated user (per concepts.yaml batch-F line 782 — HIGH severity catalog-wide finding). Every description-update event includes the verbatim old/new description payload. If a description contains PII / secrets / internal ticket references, the activity feed leaks it to every authenticated user with no redaction. — severity: MEDIUM" — evidence: `DescriptionUpdatedActivityHandler.java:40-42` (verbatim description in the activity payload) + concepts.yaml line 782 (global activity feed cross-owner exposure).
  - "**Term-linking side effect grants implicit write permission on `term_relations`**: a caller with only `DATA_ENTITY_DESCRIPTION_UPDATE` (no `DATA_ENTITY_ADD_TERM` permission) can still create term-relation rows by injecting `[[ns:term]]` mentions into the description body. The dedicated `DATA_ENTITY_ADD_TERM` permission (`SecurityConstants.java:237-239`) is BYPASSED by the description-write path. The Policy framework's separation between 'edit description' and 'link terms' is structurally undermined. — severity: MEDIUM" — evidence: `DataEntityServiceImpl.java:328` (`termService.handleDataEntityDescriptionTerms` invoked unconditionally) + `TermServiceImpl.java:200` (the method emits `TERM_ASSIGNMENT_UPDATED` regardless of caller's term-write permission) + `SecurityConstants.java:194-197` vs `SecurityConstants.java:237-239` (the two distinct SECURITY_RULES that should have been mutually orthogonal).

## performance

- hot_paths:
  - "PUT on the UI/API surface — called from the entity-detail-page Description panel save action; not a high-RPS hot path on a per-request basis. The downstream effect IS multi-write: 1 DB UPDATE on `data_entity` + 1 reactive FTS-vector rebuild (`updateDataEntityVectors`) + 1 conditional UPSERT on `data_entity_filled` (filled/unfilled toggle) + 1 regex-scan of the description body for `[[ns:term]]` mentions + 1 DB lookup per mention against `term` table + 1 batch upsert on `term_relations` + 2 activity-event rows (DESCRIPTION_UPDATED + TERM_ASSIGNMENT_UPDATED)." — evidence: `DataEntityInternalStateServiceImpl.java:54-71` + `DataEntityServiceImpl.java:323-333` + `TermServiceImpl.java:198-207`.
  - "FTS vector rebuild — `updateDataEntityVectors(dataEntityId)` re-reads all related rows (data_entity, data_source, namespace, tags, metadata, dataset_field, title, owner) and rewrites the tsvector — per `ReactiveSearchEntrypointRepositoryImpl.java:82`. A description update triggers the FULL entity tsvector rebuild, not just the description-vector slice." — evidence: `DataEntityInternalStateServiceImpl.java:60-61` + the FTS-rebuild scope at `ReactiveSearchEntrypointRepositoryImpl.java`.
- throughput_characteristics:
  - "Single-item PUT per description change — no bulk-update endpoint on the `DataEntityApi` surface (concepts.yaml batch-F line 496 records this as a catalog-wide absence)."
  - "Reactive `Mono` signature — non-blocking on the request thread, but the work is per-call and the FTS-rebuild scan-fanout means the per-call DB read cost is non-trivial."
  - "No batching, no async fire-and-forget — the FTS rebuild and the term-relation updates run inside the same `@ReactiveTransactional` boundary as the description write itself. A slow term lookup can stall the entire transaction."
- resource_allocation:
  - "Per-call cost: 1 DB UPDATE (description write), 1 DB read+upsert on `data_entity_filled` (filled-flag toggle), 1 FTS-rebuild composite query (reads ~8 related tables + writes tsvector), 1 regex scan of the description body (O(description length) — unbounded if no length cap), N DB reads per `[[ns:term]]` mention (`termRepository.getByNameAndNamespace` — batched per call, but the batch size is the mention count), 1 DB delete + 1 DB insert per term-relation change, 2 activity-event row inserts. The whole sequence runs in one reactive transaction."
  - "Memory: the description body is held in JVM heap for the duration of the request (no streaming write). For a 100 MiB description body (no length cap — see `bugs_limitations_corner_cases`), the request-thread heap retains the body once for parsing + once for the JSON serialisation into the activity payload + once for the term-linker's regex scan."
  - "No outbound HTTP, no third-party calls."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally."
  - "No row-level lock or advisory lock on the description-write path — two simultaneous PUTs to the same `dataEntityId` race (last-writer-wins). The FTS rebuild has no serialisation either; two simultaneous rebuilds can produce inconsistent tsvector state on the row (Postgres row-level locking on the UPDATE serialises the description column itself, but the FTS rebuild reads more tables and writes a separate column — the timing window is non-trivial)."
  - "No pagination concerns (single-item write)."
- known_performance_gaps:
  - "**No length cap on description body** → unbounded heap allocation per call + unbounded FTS-index write + unbounded activity-row size. Severity becomes acute when the FTS rebuild + activity persistence are inside the same transaction (large descriptions block the row for the full transaction duration). — evidence: `components.yaml:2188-2194` (no `maxLength`) + `V0_0_1__init.sql:80` (`text` column) + `DataEntityInternalStateServiceImpl.java:55-71` (entire pipeline inside one reactive transaction). — severity: MEDIUM"
  - "**FTS rebuild is the full entity tsvector, not just the description slice** — every description update re-reads ~8 related tables and rewrites the entire tsvector. A frequently-edited description on a heavily-tagged / heavily-owned entity does much more I/O than the description bytes alone suggest. — evidence: `DataEntityInternalStateServiceImpl.java:60-61` + `ReactiveSearchEntrypointRepositoryImpl.java:82` (full entity-vector reconstruction). — severity: LOW"
  - "**Activity-event payload includes the FULL description body twice** — once as `oldState`, once as `newState`. A 1 MiB description edit grows the activity table by ~2 MiB per edit (plus JSON envelope overhead). Editing the same long description 50 times → 100 MiB of activity rows. The activity feed has no TTL / retention policy documented; concepts.yaml batch-F records the activity-table growth concern catalog-wide. — evidence: `DescriptionUpdatedActivityHandler.java:39-42` (verbatim description in BOTH state payloads). — severity: LOW"
  - "**Term-linker DB lookup fans out per mention** — a description with 100 `[[ns:term]]` mentions issues 100 lookups against `termRepository.getByNameAndNamespace` (the call is batched in `TermServiceImpl.java:350` via `getByNameAndNamespace(parsedTerms)`, so this is ONE batched query — not N — confidence: HIGH after re-reading). Mitigation already in place. — severity: N/A (this is the GOOD path — recording for completeness)."

## sources

- understanding ← DataEntityController.java:202-211 + DataEntityServiceImpl.java:323-333 + DataEntityInternalStateServiceImpl.java:54-71 + ReactiveDataEntityRepositoryImpl.java:430-438 + SecurityConstants.java:194-197 + pnpm-lock.yaml:5922
- concepts.entities.InternalDescription ← components.yaml:2175-2186
- concepts.entities.InternalDescriptionFormData ← components.yaml:2188-2194
- concepts.entities.DataEntityPojo.internalDescription ← V0_0_1__init.sql:80 (text column) + ReactiveDataEntityRepositoryImpl.java:430-438
- concepts.entities.LinkedTerm ← TermServiceImpl.java:67 + DataEntityServiceImpl.java:330
- concepts.entities.DescriptionActivityStateDto ← DescriptionUpdatedActivityHandler.java:40-42
- concepts.invariants.[0] ← ReactiveDataEntityRepositoryImpl.java:431 (empty-to-null normalisation)
- concepts.invariants.[1] ← components.yaml:2193-2194 (required at OpenAPI level)
- concepts.invariants.[2] ← ReactiveDataEntityRepositoryImpl.java:432-435 (UPDATE only, no INSERT branch)
- concepts.invariants.[3] ← ReactiveDataEntityRepositoryImpl.java:430-438 (no sanitisation in store) + Markdown.tsx:113-124 (UI render with no skipHtml) + grep `rehype-sanitize` → 0 matches
- concepts.invariants.[4] ← TermServiceImpl.java:67 (regex pattern) + .344-348 (matcher loop)
- concepts.invariants.[5] ← DescriptionUpdatedActivityHandler.java:40-42 (DescriptionActivityStateDto wraps only description)
- dependencies_semantic.requires-feature.[0] ← DataEntityServiceImpl.java:323-333 + .108 (@Service / RequiredArgsConstructor)
- dependencies_semantic.requires-feature.[1] ← DataEntityInternalStateServiceImpl.java:54-71
- dependencies_semantic.requires-feature.[2] ← ReactiveDataEntityRepositoryImpl.java:429-438
- dependencies_semantic.requires-feature.[3] ← DataEntityInternalStateServiceImpl.java:60-61 + ReactiveSearchEntrypointRepositoryImpl.java:82 (FTS scope)
- dependencies_semantic.requires-feature.[4] ← TermServiceImpl.java:198-207 + .67 (regex)
- dependencies_semantic.requires-feature.[5] ← DataEntityInternalStateServiceImpl.java:62-68 (filled-flag toggle)
- dependencies_semantic.requires-feature.[6] ← DescriptionUpdatedActivityHandler.java:14-43
- dependencies_semantic.requires-feature.[7] ← openapi.yaml:927-947
- dependencies_semantic.requires-config.[0] ← DisabledAuthSecurityConfiguration.java:9-19 + LoginFormSecurityConfiguration.java:30-32 + OAuthSecurityConfiguration.java:70-72 + LDAPSecurityConfiguration.java:50-52
- dependencies_semantic.requires-runtime.[0..3] ← DataEntityController.java:62-65 (Spring WebFlux / Reactor imports) + ReactiveDataEntityRepositoryImpl.java:430 (jOOQ) + V0_0_1__init.sql:80 (Postgres text column)
- dependencies_semantic.coupling.[0] ← SecurityConstants.java:194-197 + DataEntityConditionResolver.java:35-47
- dependencies_semantic.coupling.[1] ← TermServiceImpl.java:67 + .198-207 + DataEntityServiceImpl.java:328
- dependencies_semantic.coupling.[2] ← FTSConstants.java:40 + DataEntityInternalStateServiceImpl.java:60-61
- dependencies_semantic.coupling.[3] ← Markdown.tsx:113-124 + pnpm-lock.yaml:5911-5938 (@uiw/react-markdown-preview + rehype-raw transitive)
- tests_coverage_semantic.covered_behaviours ← grep `upsertDescription | upsertDataEntityInternalDescription | InternalDescriptionFormData` over `<odd-platform>/odd-platform-api/src/test/` → 0 matches
- tests_coverage_semantic.test_files ← grep `upsertDescription` over `<odd-platform>/odd-platform-api/src/test/` → 0 matches; `find <odd-platform> -name '*Description*Test*'` → 0 matches
- docs_link_semantic.inferred_docs.[0] ← prior batch 2026-05-12F verbatim quote (see controller-level sidecar:143) — WebFetch not available in this session
- docs_link_semantic.inferred_docs.[1] ← topic match only — not verified (WebFetch denied)
- docs_link_semantic.inferred_docs.[2] ← concepts.yaml:436, 782, 784 (prior batch findings; documented audit-feed cross-owner exposure)
- implicit_adrs.[0] ← ReactiveDataEntityRepositoryImpl.java:430-438 + openapi.yaml:929-930
- implicit_adrs.[1] ← TermServiceImpl.java:67 + .198-207 + DataEntityServiceImpl.java:328
- implicit_adrs.[2] ← ReactiveDataEntityRepositoryImpl.java:431 + DataEntityInternalStateServiceImpl.java:62-68
- implicit_adrs.[3] ← DataEntityInternalStateServiceImpl.java:56 + TermServiceImpl.java:200 + DataEntityServiceImpl.java:327-328
- implicit_adrs.[4] ← FTSConstants.java:40 + DataEntityInternalStateServiceImpl.java:60-61
- implicit_adrs.[5] ← PolicyPermissionDto.java:18 + SecurityConstants.java:194-200
- implicit_adrs.[6] ← DataEntityServiceImpl.java:324 + DataEntityInternalStateServiceImpl.java:55
- bugs_limitations_corner_cases.[0] ← ReactiveDataEntityRepositoryImpl.java:430-438 + Markdown.tsx:113-124 + pnpm-lock.yaml:5911-5938 + grep `rehype-sanitize` 0-matches
- bugs_limitations_corner_cases.[1] ← ReactiveDataEntityRepositoryImpl.java:432-435 (UPDATE) + DataEntityServiceImpl.java:467 (NotFoundException pattern on sibling endpoint — not present here)
- bugs_limitations_corner_cases.[2] ← components.yaml:2188-2194 + V0_0_1__init.sql:80 (text column)
- bugs_limitations_corner_cases.[3] ← ReactiveDataEntityRepositoryImpl.java:432-435 + DescriptionUpdatedActivityHandler.java:26-31
- bugs_limitations_corner_cases.[4] ← DisabledAuthSecurityConfiguration.java:9-19 + SecurityConstants.java:194-197
- bugs_limitations_corner_cases.[5] ← TermServiceImpl.java:67 + .341-348
- bugs_limitations_corner_cases.[6] ← DataEntityInternalStateServiceImpl.java:54-71 (full pipeline empty-mono propagation)
- bugs_limitations_corner_cases.[7] ← DisabledAuthSecurityConfiguration.java:14-17 (CSRF disable)
- security.auth_mode_relevance ← DataEntityController.java:67-70 + SecurityConstants.java:194-197 + DisabledAuthSecurityConfiguration.java:14-17
- security.ingestion_filter_relevance ← DataEntityController.java:202-211 (path is /api/dataentities/..., not /ingestion/entities)
- security.authorization_assertions.[0] ← SecurityConstants.java:194-197 + DataEntityConditionResolver.java:35-47
- security.data_exposure.[0] ← DataEntityController.java:202-211 + DataEntityServiceImpl.java:329-332
- security.data_exposure.[1] ← DescriptionUpdatedActivityHandler.java:24-42 + concepts.yaml:436, 782, 784
- security.data_exposure.[2] ← InternalDescriptionPreview.tsx:19-22
- security.known_security_gaps.[0] ← ReactiveDataEntityRepositoryImpl.java:430-438 + Markdown.tsx:113-124 + pnpm-lock.yaml:5911-5938 + grep `rehype-sanitize` 0-matches
- security.known_security_gaps.[1] ← DisabledAuthSecurityConfiguration.java:9-19 + SecurityConstants.java:194-197
- security.known_security_gaps.[2] ← DescriptionUpdatedActivityHandler.java:40-42 + concepts.yaml:782
- security.known_security_gaps.[3] ← DataEntityServiceImpl.java:328 + TermServiceImpl.java:198-207 + SecurityConstants.java:237-239 (DATA_ENTITY_ADD_TERM dedicated rule)
- performance.hot_paths.[0] ← DataEntityInternalStateServiceImpl.java:54-71 + DataEntityServiceImpl.java:323-333 + TermServiceImpl.java:198-207
- performance.hot_paths.[1] ← DataEntityInternalStateServiceImpl.java:60-61 + ReactiveSearchEntrypointRepositoryImpl.java:82
- performance.throughput_characteristics ← DataEntityController.java:202-211 + DataEntityServiceImpl.java:323-333 + concepts.yaml:496
- performance.resource_allocation ← DataEntityInternalStateServiceImpl.java:54-71 + TermServiceImpl.java:198-207 + DescriptionUpdatedActivityHandler.java:39-42
- performance.scaling_characteristics ← DataEntityInternalStateServiceImpl.java:55 (no @Version) + ReactiveDataEntityRepositoryImpl.java:432-435 (no FOR UPDATE / no advisory lock)
- performance.known_performance_gaps.[0] ← components.yaml:2188-2194 + V0_0_1__init.sql:80 + DataEntityInternalStateServiceImpl.java:55-71
- performance.known_performance_gaps.[1] ← DataEntityInternalStateServiceImpl.java:60-61 + ReactiveSearchEntrypointRepositoryImpl.java:82
- performance.known_performance_gaps.[2] ← DescriptionUpdatedActivityHandler.java:39-42
- performance.known_performance_gaps.[3] ← TermServiceImpl.java:350 (batched lookup — record-good-path)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero coverage is itself a high-confidence finding — verified by exhaustive grep)
- docs_link_semantic: MEDIUM (one verified-in-prior-batch URL, two inferred-but-not-re-verified URLs; WebFetch denied in this session — confidence cannot rise above MEDIUM)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (FTS-rebuild scope confidence depends on re-reading `ReactiveSearchEntrypointRepositoryImpl.updateDataEntityVectors` which was only sampled; activity-table growth severity is a per-deployment factor, not statically resolvable)

## Maintainer notes

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — appended after each layer-5 probe-run that touches this node's contributing-features. Each entry cites a probe-run artefact under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->

- probe_id: P-007
  probe_run_id: R-20260519T015118Z-P-007
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T01:51:18+00:00
  verdict: "all assertions passed"
- probe_id: P-009
  probe_run_id: R-20260519T015119Z-P-009
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T01:51:19+00:00
  verdict: "all assertions passed"
- probe_id: P-007
  probe_run_id: R-20260519T020321Z-P-007
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:03:21+00:00
  verdict: "all assertions passed"
- probe_id: P-009
  probe_run_id: R-20260519T020323Z-P-009
  outcome: FAIL
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:03:23+00:00
  verdict: "1 assert(s) failed; first: 'dom_has_onerror_attr == True'"
- probe_id: P-007
  probe_run_id: R-20260519T020607Z-P-007
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:06:07+00:00
  verdict: "all assertions passed"
- probe_id: P-009
  probe_run_id: R-20260519T020610Z-P-009
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:06:10+00:00
  verdict: "all assertions passed"
- probe_id: P-007
  probe_run_id: R-20260519T020811Z-P-007
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:08:11+00:00
  verdict: "all assertions passed"
- probe_id: P-009
  probe_run_id: R-20260519T020812Z-P-009
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:08:12+00:00
  verdict: "all assertions passed"
- probe_id: P-007
  probe_run_id: R-20260519T021216Z-P-007
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:12:16+00:00
  verdict: "all assertions passed"
- probe_id: P-009
  probe_run_id: R-20260519T021217Z-P-009
  outcome: PASS
  test_class: security
  feature_id: F-004
  ran_at: 2026-05-19T02:12:17+00:00
  verdict: "all assertions passed"
