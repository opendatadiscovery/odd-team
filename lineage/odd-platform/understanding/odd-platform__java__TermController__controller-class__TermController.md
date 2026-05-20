---
node_id: "odd-platform java TermController controller-class:TermController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-U-TermController
pillar_anchored_features:
  - P-06:F-001 Term-to-Entity Linkage
  - P-06 Data Glossary
  - P-09 Security & Access Control
---

# TermController — semantic understanding

## understanding

`TermController` is the **HTTP controller-class for the entire Business Glossary write/read surface** (pillar P-06 per `system-mission.md` lines 182-198) — 251 lines, 23 endpoints implementing the OpenAPI-generated `TermApi` interface, each method a one-or-two-line reactive delegation to one of six injected services (`TermService`, `DataEntityService`, `DatasetFieldService`, `TermSearchService`, `TermOwnershipService`, `QueryExampleService`). The class composes the four resource axes of the glossary feature into a single API root at `/api/terms/**`: (a) **Term CRUD** (5 endpoints — list/lookup/create/update/details/delete); (b) **Term linkage** (4 endpoints — get linked entities/columns/terms + add/delete term-to-term linkage); (c) **Term ownership + tags + query-example linkage** (8 endpoints); (d) **Term faceted search** (6 endpoints — start session, get/update facets, results, suggestions, filter-options). The controller's authorisation surface is **silently inconsistent**: 9 of the 14 mutating endpoints have SecurityRules in `SecurityConstants.java` lines 111, 174-193, but the two term-to-term linkage endpoints (`addLinkedTermToTerm` + `deleteLinkedTermFromTerm`, lines 237-249 of this file) have **NO SecurityRule at all** — they fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`), so any authenticated user can link/unlink terms regardless of the seven `TERM_*` permissions the docs declare. The class also inherits **REFACTOR-217's blast radius**: the path-mismatch bug at `SecurityConstants.java:238, 241` (the singular `/api/dataentities/.../term` vs OpenAPI plural `/api/dataentities/.../terms` at `openapi.yaml:973, 1042`) targets `DataEntityController.addDataEntityTerm` not this controller — but the same `term_to_term` join table that powers `TermController.getTermLinkedTerms` (line 121) is the one carrying the V0_0_91 schema-drift (`deleted_at` column never filtered at 7 read sites in `ReactiveTermRepositoryImpl`), so EVERY `getTermLinkedTerms` response from this controller is downstream of that drift. **All 23 endpoints inherit `TermServiceImpl`'s service-tier-zero-permission-checks posture** (per the batch-K invariant): the controller-tier SecurityRules are the SOLE authorisation gate; there is no defence-in-depth at the service layer. **No tests cover this controller** (`grep TermController <odd-platform-repo>/odd-platform-api/src/test` returns zero matches), so all 23 endpoints are validated only at runtime by the operator hitting them.

## concepts

- entities: [
    "`TermApi` — OpenAPI-generated controller interface; the contract this `@RestController` implements (line 42). The 23 method signatures are auto-derived from `openapi.yaml:2719-3204` (`/api/terms/**` paths plus the search facets/results subtree).",
    "`TermFormData` — input payload for create+update (`TermController.java:70, 78`); validated against `components.yaml/#/components/schemas/TermFormData`; carries `name`, `definition`, `namespaceName` per the upstream spec.",
    "`TermDetails` — full-detail response for create/update/get (`TermController.java:70, 78, 92`); assembled by `ReactiveTermRepositoryImpl.getTermDetailsDto` (the 11-LEFT-JOIN + 4-countDistinct projection).",
    "`TermRef` — minimal term reference (id + name + namespace) returned by `getTermByNamespaceAndName` (line 62); the natural-key lookup shape.",
    "`TermRefList` — paginated TermRef list returned by `getTermsList` (line 52) and `getTermSearchSuggestions` (line 194); the FTS suggestion endpoint returns the same shape as the list.",
    "`LinkedTermFormData` — input for the term-to-term linkage create (line 238); carries `linkedTermId` per `components.yaml:2650`. The controller delegates to `termService.linkTermWithTerm(fd.getLinkedTermId(), termId)` (line 241) — note the argument order: spec field is `linkedTermId`, method-param is also `linkedTermId`, but the service flips them via `linkTermWithTerm(linkedTermId, termId)` → `termRelationsRepository.createRelationWithTerm(linkedTermId, termId)` → row written as `term_to_term(target_term_id=linkedTermId, assigned_term_id=termId)` — this is the canonical edge direction; `getAssignedTermId` (`TermServiceImpl.java:292`) reads the `assigned_term_id` for the response DTO.",
    "`LinkedTerm` — single-edge response shape for `addLinkedTermToTerm` (line 237); the `assigned_term_id` side becomes the visible term in the response.",
    "`LinkedTermList` — paginated linked-terms list (line 121); inherits the broken-pagination shape from `TermServiceImpl.listByTerm` (`total = items.size()`, `hasNext = false` hard-coded per `TermServiceImpl.java:283-285`).",
    "`TermSearchFormData` — the search-session form (line 201, 209); the create-session pattern returns the same `TermSearchFacetsData` shape that subsequent facet-update calls accept.",
    "`TermSearchFacetsData` — the search-session-state response (lines 178, 201, 209); `searchId` (UUID) is the session handle; subsequent endpoints (`getTermFiltersForFacet`, `getTermSearchFacetList`, `getTermSearchResults`, `updateTermSearchFacets`) accept the `searchId` to retrieve / mutate the session's facet state.",
    "`OwnershipFormData / OwnershipUpdateFormData / Ownership` — the term-ownership trio used by lines 138-163 (create / delete / update); delegated to `TermOwnershipService` (a sibling service distinct from the platform-wide ownership service for data entities).",
    "`QueryExampleTermFormData / QueryExample` — the term-to-query-example linkage trio (lines 218-234); delegated to `QueryExampleService.linkTermWithQueryExample` / `removeTermFromQueryExample`.",
    "`TagsFormData / Tag` — the term-tags upsert pair (line 130); delegated to `TermService.upsertTags` which under the covers can side-door TAG_CREATE per the batch-K invariant.",
    "`DataEntityList / DatasetFieldList` — the linked-entity / linked-column response shapes (lines 100, 111); delegated to `DataEntityService.listByTerm` / `DatasetFieldService.listByTerm` (NOT to TermService — the read-side scoping is owned by the consumer-entity services, not the term service).",
    "`MultipleFacetType` — the facet-axis enum used by `getTermFiltersForFacet` (line 167); auto-generated from the OpenAPI spec; encodes which facet axis (namespaces, tags, owners) the filter applies to.",
    "`ServerWebExchange` — the Spring WebFlux reactive request context; injected on every method but used by NONE of them (no method reads request headers, query params via the exchange, or sets response state directly via the exchange — the controller is pure delegation)."
  ]
- operations: [
    "`getTermsList(page, size, query, updatedAtRangeStart, updatedAtRangeEnd, exchange)` (lines 52-59) — paginated term list with optional name+date filter; reactive read; delegates to `termService.getTerms` → `ReactiveTermRepositoryImpl.listTermRefDtos`. Returns 200 always (no 401/403 unless caller is unauthenticated). Public-to-authenticated read.",
    "`getTermByNamespaceAndName(namespaceName, termName, exchange)` (lines 62-67) — natural-key lookup; switches to `Mono.error(NotFoundException(...))` upstream if not found (`TermServiceImpl.java:93-97`) → 404 to the caller. Public-to-authenticated read.",
    "`createTerm(termFormData, exchange)` (lines 70-75) — write; delegates to `termService.createTerm` (which is `@ReactiveTransactional`). Returns 200 BUT OpenAPI declares 201 (`openapi.yaml:2760` says `'201': The resource has been successfully created`) — controller-vs-spec status-code drift; see `bugs_limitations_corner_cases.[2]`. Gated by `TERM_CREATE` (`SecurityConstants.java:111`, `NO_CONTEXT` since term doesn't yet exist).",
    "`updateTerm(termId, termFormData, exchange)` (lines 78-83) — write; delegates to `termService.updateTerm` which carries the description-mention rename guard (`TermServiceImpl.java:125-134`). Returns 200; OpenAPI declares 201 here too (`openapi.yaml:2798`) — same status-code drift class. Gated by `TERM_UPDATE` resolved through `AuthorizationManagerType.TERM` resource extractor (`SecurityConstants.java:174`).",
    "`deleteTerm(termId, exchange)` (lines 86-90) — write; delegates to `termService.delete`. Returns 204 No Content (matches OpenAPI). The service first hard-deletes link rows in `data_entity_to_term` + `dataset_field_to_term` then soft-deletes the term itself (`TermServiceImpl.java:155-164` — note: `term_to_term` link table is NOT cleaned up here, see `bugs_limitations_corner_cases.[4]`). Gated by `TERM_DELETE` resource-extractor on `term_id` (`SecurityConstants.java:175-176`).",
    "`getTermDetails(termId, exchange)` (lines 92-97) — read; delegates to `termService.getTermDetails` → the 11-LEFT-JOIN `getTermDetailsDto` aggregation. The most expensive single read endpoint in this controller. Public-to-authenticated.",
    "`getTermLinkedEntities(termId, page, size, query, entityClassId, exchange)` (lines 100-108) — read; **delegates to `DataEntityService.listByTerm`** (NOT TermService). The DataEntity side owns the entity-list shape. Public-to-authenticated.",
    "`getTermLinkedColumns(termId, page, size, query, exchange)` (lines 111-118) — read; delegates to `DatasetFieldService.listByTerm`. Public-to-authenticated.",
    "`getTermLinkedTerms(termId, page, size, query, exchange)` (lines 121-127) — read; delegates to `termService.listByTerm` → `ReactiveTermRepositoryImpl.listByTerm` (one of the 7 sites that **does NOT filter `term_to_term.deleted_at IS NULL`** per the batch-N schema-drift invariant). Returns a `LinkedTermList` with **hard-coded broken pagination** (`hasNext = false`, `total = items.size()` per `TermServiceImpl.java:283-285`). Public-to-authenticated.",
    "`createTermTagsRelations(termId, tagsFormData, exchange)` (lines 130-136) — write (upsert pattern: deletes existing tag relations, recreates from input set per `TermServiceImpl.java:254-264`). Returns 200 with a `Flux<Tag>` body — the flux is wrapped INSIDE `ResponseEntity.ok(...)` synchronously via `Mono.just(...)`, an idiosyncratic shape vs the other endpoints which all `.map(ResponseEntity::ok)` AFTER the Mono completes. Gated by `TERM_TAGS_UPDATE` on resource `term_id` (`SecurityConstants.java:185-186`). **Tag side-door**: `upsertTags` invokes `tagService.getOrCreateTagsByName` which can CREATE new tags without holding `TAG_CREATE` — same architectural class as REFACTOR-199 (Owner auto-create) per batch-K.",
    "`createTermOwnership(termId, ownershipFormData, exchange)` (lines 138-145) — write; delegates to `TermOwnershipService.create`. Gated by `TERM_OWNERSHIP_CREATE` on `term_id` (`SecurityConstants.java:177-178`).",
    "`deleteTermOwnership(termId, ownershipId, exchange)` (lines 148-153) — write; delegates to `TermOwnershipService.delete(ownershipId)` — note: `termId` is NOT passed to the service. Returns 204. Gated by `TERM_OWNERSHIP_DELETE` on `term_id` (`SecurityConstants.java:182-184`).",
    "`updateTermOwnership(termId, ownershipId, formData, exchange)` (lines 156-163) — write; `termId` not passed to the service. Gated by `TERM_OWNERSHIP_UPDATE` on `term_id` (`SecurityConstants.java:179-181`).",
    "`getTermFiltersForFacet(searchId, facetType, page, size, query, exchange)` (lines 166-175) — read-against-session-state; delegates to `termSearchService.getFilterOptions`. Authorisation: searches inherit the `searchId` UUID, not a `term_id` — `searchId` is unguessable so it is the authority on session ownership, but there is no explicit gate confirming the caller owns the session (any authenticated caller with a valid `searchId` UUID can fetch facets). See `bugs_limitations_corner_cases.[3]`.",
    "`getTermSearchFacetList(searchId, exchange)` (lines 178-182) — same session-ownership shape as above.",
    "`getTermSearchResults(searchId, page, size, exchange)` (lines 185-191) — same session-ownership shape.",
    "`getTermSearchSuggestions(query, exchange)` (lines 194-198) — read; delegates to `termSearchService.getQuerySuggestions` which wraps the FTS-ranked top-5 from `ReactiveTermRepositoryImpl.getQuerySuggestions` (line 241-269 of the repository) with hard-coded `hasNext = false`. Public-to-authenticated.",
    "`termSearch(termSearchFormData, exchange)` (lines 201-206) — create-session pattern; returns a `TermSearchFacetsData` with the issued `searchId`. Public-to-authenticated (no gate beyond `authenticated()` — searches are read-only).",
    "`updateTermSearchFacets(searchId, termSearchFormData, exchange)` (lines 209-216) — mutate-session-state; the session is per-caller but identified only by `searchId` UUID. No formal RBAC gate.",
    "`createQueryExampleToTermRelationship(termId, queryExampleTermFormData, exchange)` (lines 218-226) — write; delegates to `QueryExampleService.linkTermWithQueryExample`. Gated by `QUERY_EXAMPLE_TERM_CREATE` on resource `term_id` (`SecurityConstants.java:187-189`).",
    "`deleteQueryExampleToTermRelationship(termId, exampleId, exchange)` (lines 229-234) — write; delegates to `QueryExampleService.removeTermFromQueryExample`. Returns 204. Gated by `QUERY_EXAMPLE_TERM_DELETE` on `term_id` (`SecurityConstants.java:190-193`).",
    "`addLinkedTermToTerm(termId, linkedTermFormData, exchange)` (lines 237-243) — write that creates a `term_to_term` row via `termService.linkTermWithTerm(fd.getLinkedTermId(), termId)`. **NO SecurityRule** in `SecurityConstants.java` for this path. Falls through to `pathMatchers(\"/**\").authenticated()`. Returns 200 with `LinkedTerm`. The Business Glossary docs (live-fetched 2026-05-20) state `TERM_UPDATE` gates 'directly-linked terms' but the controller's actual posture is no RBAC gate at all.",
    "`deleteLinkedTermFromTerm(termId, linkedTermId, exchange)` (lines 246-249) — write that removes a `term_to_term` row via `termService.removeTermToLinkedTermRelation(termId, linkedTermId)`. **NO SecurityRule** — same as the add half. Returns 204."
  ]
- invariants: [
    "All 23 method bodies are 1-line or 2-line reactive delegations — no business logic, no transformations, no programmatic auth checks; the controller is a pure stub-implementation of `TermApi`.",
    "Six injected services (`TermService`, `DataEntityService`, `DatasetFieldService`, `TermSearchService`, `TermOwnershipService`, `QueryExampleService`) are all `final` per Lombok `@RequiredArgsConstructor` (line 41) — constructor-injection, no field-injection.",
    "**Read endpoints inherit the read-collaborative posture** — `getTermsList`, `getTermByNamespaceAndName`, `getTermDetails`, `getTermLinkedEntities`, `getTermLinkedColumns`, `getTermLinkedTerms`, `getTermSearchSuggestions`, `termSearch`, and the search-session getters all return data across every namespace to every authenticated user (per `system-mission.md:267` — read-collaborative is intentional but the namespace concept implies team isolation). NO per-owner or per-namespace scoping is applied at the controller layer.",
    "**Authorisation is controller-tier-only** for the 9 endpoints that ARE gated — the service-tier (`TermServiceImpl`) has ZERO `@PreAuthorize` or programmatic permission checks per the batch-K invariant `term-service-tier-zero-permission-checks`. The controller perimeter is the SOLE defence; bypass paths (REFACTOR-217 path mismatch, REFACTOR-227 description-edit auto-link side-channel) cannot be caught at service tier.",
    "**Term-to-term linkage is NOT RBAC-gated** — `/api/terms/{term_id}/term` POST + `/api/terms/{term_id}/term/{linked_term_id}` DELETE have NO SecurityRule entries in `SecurityConstants.java` (verified by grep). The catch-all `pathMatchers(\"/**\").authenticated()` is the only gate. Any authenticated user can link/unlink terms regardless of which seven `TERM_*` permissions they hold.",
    "Status-code drift between controller and OpenAPI on the term CRUD writes — `createTerm` and `updateTerm` return 200 in the controller (`.map(ResponseEntity::ok)` lines 74, 82) but the OpenAPI declares 201 for create (`openapi.yaml:2760`) and 201 for update (`openapi.yaml:2798`). The OpenAPI says `description: The resource has been successfully created` for the update endpoint too — likely a spec authoring mistake; controller behaviour is the actual ground truth.",
    "Argument-order convention on the term-to-term linkage: form-field `linkedTermId` becomes `target_term_id` in the DB row (`term_to_term.target_term_id = fd.getLinkedTermId()`), `termId` (path-param) becomes `assigned_term_id`. The controller delegates `(fd.getLinkedTermId(), termId)` in that order to `termService.linkTermWithTerm(linkedTermId, termId)` (line 241), which the service forwards as-is to `termRelationsRepository.createRelationWithTerm(linkedTermId, termId)` — preserving the form-field-named-first convention."
  ]
- audiences: [
    "odd-platform-ui-end-user — every Term* page in the React UI (`TermSearch`, `TermDetails`, `TermDetailsTabs`) hits these 23 endpoints",
    "odd-api-consumer — direct programmatic callers via the OpenAPI-generated SDKs hit these endpoints",
    "data-steward-owner — the curate-the-glossary audience that uses the create/update/delete + ownership + tags endpoints",
    "data-engineer-analyst + data-scientist-ml-engineer — primarily read-only consumers (search, get details, get linked entities)"
  ]

## dependencies_semantic

- requires-feature: [
    "P-06 Data Glossary — this controller is the HTTP entry point for the entire pillar; without it, no Term CRUD or search exists.",
    "P-06:F-001 Term-to-Entity Linkage — term linkage is split: this controller owns the Term→Entity LINKAGE READ side (`getTermLinkedEntities` line 100) and the term-to-term linkage write surface (lines 237, 246); the WRITE side for Term→Entity linkage is in `DataEntityController.addDataEntityTerm` / `deleteTermFromDataEntity` (the path-mismatch surface).",
    "P-09 Security & Access Control — depends on the RBAC framework (Policies × Permissions × Roles × Owners) to enforce the 9 SecurityRules that gate write operations.",
    "P-01 Data Discovery — `getTermLinkedEntities` is the term-side of the data-entity discovery surface; viewing a term's linked entities is the typical glossary→catalog drill-down."
  ]
- requires-config: [] — N/A. The controller reads no `@Value`-injected config; the SecurityRule registration is unconditional (`SecurityConstants.SECURITY_RULES` is a `static final List` at line 98); no feature flag conditionally enables/disables the term-controller surface.
- requires-runtime: [
    "Spring WebFlux reactive runtime (Mono/Flux) — every method returns `Mono<ResponseEntity<...>>`; controller is non-blocking",
    "PostgreSQL (single DB) — every read flows through `ReactiveTermRepositoryImpl` → R2DBC → PG; the search endpoints additionally rely on the `term_search_entrypoint` materialised FTS table and the GIN index on `search_vector` per `V0_0_35__add_terms.sql:58-76`",
    "RBAC framework runtime — `AuthorizationCustomizer` + `SecurityConstants.SECURITY_RULES` + `ReactiveAuthorizationManagerFactory` resolve the per-request permission check for the 9 gated endpoints",
    "Activity-log subsystem — `TermServiceImpl` emits `@ActivityLog(TERM_ASSIGNMENT_UPDATED)` on `linkTermWithDataEntity` / `removeTermFromDataEntity` / `linkTermWithDatasetField` / `removeTermFromDatasetField` (lines 169, 183, 211, 225 of the service) — these flow into the Activity Feed (P-07 sub-feature)",
    "**Note on term-to-term linkage**: `TermServiceImpl.linkTermWithTerm` (line 290) and `removeTermToLinkedTermRelation` (line 299) are NOT annotated with `@ActivityLog` — there is no Activity Feed entry created when terms are linked or unlinked from each other. The other linkage operations DO emit activity events; the term-to-term family does not. See `bugs_limitations_corner_cases.[5]`."
  ]
- couples-to: [
    "`TermApi` (line 6, 42) — generated interface that fixes the method signatures + path + verb mappings; regenerated from `openapi.yaml:2719-3204` on every spec change",
    "`TermService` (line 28, 44) — the 17-method service-tier orchestrator (the batch-K primary source for the service-tier-zero-permission-checks invariant)",
    "`DataEntityService` (line 28, 45) — only `listByTerm(termId, query, entityClassId, page, size)` is called (line 105) — the reverse-direction read",
    "`DatasetFieldService` (line 29, 46) — only `listByTerm` is called (line 115)",
    "`TermSearchService` (line 32, 47) — 6 search endpoints delegate here",
    "`TermOwnershipService` (line 31, 48) — 3 ownership endpoints; distinct from the platform-wide ownership service for data entities",
    "`QueryExampleService` (line 30, 49) — only `linkTermWithQueryExample` and `removeTermFromQueryExample` are called (lines 224, 232)",
    "`SecurityConstants.SECURITY_RULES` — the perimeter authorisation list; 9 of this controller's 14 write endpoints have entries; **2 (term-to-term linkage) do not**",
    "`AuthorizationCustomizer` (`AuthorizationCustomizer.java:14-32`) — the registrar that walks `SECURITY_RULES` and registers each matcher; the final `pathMatchers(\"/**\").authenticated()` clause is what catches the un-RBAC'd term-to-term linkage endpoints"
  ]

## upstream_callers

The HTTP surface here is reached by these in-repo consumers. (No external system pushes to `/api/terms/**` — the Business Glossary is operator-curated; collectors and gateways write to `/ingestion/**`, never to `/api/terms`.)

- **UI hook layer**: `odd-platform-ui/src/lib/hooks/api/terms.ts` lines 1-180 — the React Query hooks wrap every TermApi method. Concrete bindings verified by grep:
  - `useGetTermsList`, `useGetTermByID`, `useGetTermByNamespaceAndName` → reads
  - `useUpdateTerm`, `useCreateTerm`, `useDeleteTerm` → CRUD writes
  - `useAddTermLinkedTerm` (line 142), `useDeleteTermLinkedTerm` (line 160) → the unguarded term-to-term endpoints
  - `useCreateTermQueryExample` (line 102), `useDeleteTermQueryExample` (line 123) → query-example linkage
- **UI components that fire those hooks**: `TermsForm` (create/update), `TermDetailsHeader` (delete), `TermLinkedTerms` (term-to-term link/unlink), `LinkedTermTermForm` (term-to-term linker form), `TermItem` (the row-level delete X), `TermSearch` (the create-session pattern), `TermDetailsTabs` / `Overview` (the read surfaces)
- **No service-tier in-repo Java caller** for any TermController method (the Java service tier is the *downstream* of this controller, not upstream — controllers are the HTTP boundary). Verified: `grep -rln 'TermController' <odd-platform-repo>/odd-platform-api/src/main` returns only the file itself (zero in-repo cross-references).
- **No external system caller** documented: the OpenAPI spec exposes these endpoints to any OpenAPI-generated SDK consumer, but no collector / push adapter / standalone gateway invokes `/api/terms/**` (verified by grep across `<odd-collectors>` is out-of-scope per the file-analyser constraint; the system-mission.md pillar P-10 description does not list /api/terms as an ingestion entry point).

## downstream_side_effects

What firing each method causes the system to do, beyond returning a response. Citing each side-effect to file:line of the consumer service / repository.

- **`createTerm`** — `TermServiceImpl.java:101-117` — (1) idempotency check via `termRepository.getByNameAndNamespace` (case-insensitive natural-key); (2) `namespaceService.getOrCreate(namespaceName)` **side-doors NAMESPACE_CREATE** — TERM_CREATE can create namespaces (`bugs_limitations_corner_cases.[6]`); (3) `findTermsInDescription(definition)` parses the `[[ns:term]]` regex from the new term's own definition — auto-link side-channel propagates; (4) `termRepository.create(...)` write; (5) `updateSearchVectors(term)` writes the FTS materialised row; (6) `resolveUnhandledDescriptionMentions(term)` drains the staging table — newly-created term may IMMEDIATELY auto-link to data-entity descriptions written days/weeks ago by users without DATA_ENTITY_ADD_TERM (the cross-time auto-link surface per the batch-K invariant `term-mention-auto-link-side-channel`). All wrapped in `@ReactiveTransactional`.
- **`updateTerm`** — `TermServiceImpl.java:119-145` — (1) existence check; (2) **description-mention rename guard**: if the term is mentioned in any active (non-DELETED) description, `BadUserRequestException("Can't update term, which was mentioned in description")` blocks the rename (`TermServiceImpl.java:125-134`); (3) `namespaceService.getOrCreate(namespaceName)` — same side-door class as createTerm; (4) update via `termRepository.update`; (5) `updateSearchVectors` re-materialises FTS. The guard at step (2) is bypassed when the only mentioning parent has `data_entity.status = DELETED` per the batch-N `hasDescriptionRelations-parent-soft-delete-bypass` invariant.
- **`deleteTerm`** — `TermServiceImpl.java:155-164` — (1) description-mention guard (same `BadUserRequestException`); (2) **HARD-deletes** `data_entity_to_term` rows (`termRelationsRepository.deleteRelationsWithDataEntities`); (3) **HARD-deletes** `dataset_field_to_term` rows; (4) **SOFT-deletes** the term (sets `term.deleted_at = NOW()` via the inherited `ReactiveAbstractSoftDeleteCRUDRepository.delete`). **The `term_to_term` rows are NOT cleaned up** — see `bugs_limitations_corner_cases.[4]`.
- **`createTermTagsRelations`** — `TermServiceImpl.java:252-264` — upsert pattern: (1) `tagService.deleteRelationsWithTerm` removes ALL existing tag relations; (2) `tagService.getOrCreateTagsByName(names)` **side-doors TAG_CREATE** (per batch-K invariant); (3) `tagService.createRelationsWithTerm` re-attaches; (4) `termSearchEntrypointRepository.updateTagVectorsForTerm` re-materialises the FTS tag-vector column.
- **`addLinkedTermToTerm` / `deleteLinkedTermFromTerm`** — `TermServiceImpl.java:288-301` — write to / delete from `term_to_term` table via `TermRelationsRepositoryImpl.createRelationWithTerm` (line 164) / `deleteTermToLinkedTermRelation` (line 222). **No `@ActivityLog`** — these mutations are INVISIBLE to the Activity Feed (`bugs_limitations_corner_cases.[5]`). **The DELETE writes `term_to_term.deleted_at = NOW()` OR hard-deletes** — needs verification; per the batch-N invariant `term_to_term.deleted_at` is the only term-link table that retains the soft-delete column (the V0_0_91 asymmetry); but the 7 read sites NEVER filter it, so EITHER mode of delete is silently invisible.
- **`createTermOwnership` / `updateTermOwnership` / `deleteTermOwnership`** — `TermOwnershipService.create / update / delete` — owner-attachment writes to `term_ownership` table. The OwnerController batch-H finding `permission-bypass-via-owner-auto-create-side-door-write-path` may apply here too: if `TermOwnershipService.create` accepts an unrecognised `Owner` name, does it side-door OWNER_CREATE? Needs verification — beyond this sidecar's scope.
- **`createQueryExampleToTermRelationship` / `deleteQueryExampleToTermRelationship`** — `QueryExampleService.linkTermWithQueryExample / removeTermFromQueryExample` — writes to `query_example_to_term` table. Authorised via `QUERY_EXAMPLE_TERM_CREATE / DELETE` on `term_id` — but note the resource extractor is `TERM` (`SecurityConstants.java:187-188`), so the permission check fetches the Owner→Policy aggregation by the URL's `term_id`, not by the `example_id`. A query-example owned by user A but linked to a term owned by user B could be unlinked by user B if user B holds `QUERY_EXAMPLE_TERM_DELETE` on the term — even without holding the same permission on the query example. (One-sided gating; may be intentional but undocumented.)
- **All read endpoints** — pure reads through `ReactiveTermRepositoryImpl` — no writes, no activity events, no FTS updates.

## tests_coverage_semantic

- covered_behaviours: [] — N/A. Verified absent: `grep -rln 'TermController' <odd-platform-repo>/odd-platform-api/src/test` returns zero matches.
- uncovered_behaviours: [
    "{behaviour: 'TERM_CREATE gate fires when caller lacks the permission', test_class: 'TermControllerWebFluxTest (does not exist)', expected: '@WebFluxTest asserting 403 for a caller with no TERM_CREATE for POST /api/terms'}",
    "{behaviour: 'TERM_UPDATE/DELETE gate fires when caller lacks the permission on the specific term_id', test_class: 'TermControllerWebFluxTest', expected: '@WebFluxTest pinning the resource-scoped TERM authorisation manager — and confirming the singular vs plural path matchers in SecurityConstants are correct for the term-direct endpoints (they are, unlike the data-entity-side REFACTOR-217 surface)'}",
    "{behaviour: 'Term-to-term linkage REQUIRES some permission (currently NONE)', test_class: 'TermControllerSecurityTest (does not exist)', expected: 'Test that POST /api/terms/{id}/term and DELETE /api/terms/{id}/term/{linked_id} either (a) return 403 for unauthorised callers — which they currently do NOT do because no SecurityRule exists, OR (b) acknowledge the design intent that any authenticated user can link terms. Either way the current behaviour is undocumented and untested.'}",
    "{behaviour: 'createTerm + updateTerm return 201 per OpenAPI', test_class: 'TermControllerContractTest', expected: 'OpenAPI-spec contract test asserting the actual response code matches the spec — the controller returns 200, the spec declares 201; one of them is wrong'}",
    "{behaviour: 'description-mention rename/delete guard blocks term mutation', test_class: 'TermServiceImplTest (does not exist) + WebFluxTest', expected: 'Test that PUT /api/terms/{id} returns 400 BadUserRequest when the term is mentioned in active descriptions; test the bypass via soft-deleted parent (the batch-N hasDescriptionRelations-parent-soft-delete-bypass invariant)'}",
    "{behaviour: 'getTermLinkedTerms paginates correctly', test_class: 'TermControllerPaginationTest', expected: 'Currently total = items.size() and hasNext = false hard-coded — broken pagination per TermServiceImpl.java:283-285 — pin the behaviour with a regression test or fix and test the fix'}",
    "{behaviour: 'term-to-term linkage with deleted_at populated still returns the row', test_class: 'TermLinkageDeletedAtRegressionTest', expected: 'Pin the batch-N schema-drift invariant — INSERT a term_to_term row, set deleted_at=NOW(), call GET /api/terms/{id}/linked_terms, assert the row is STILL returned (the documented buggy behaviour)'}",
    "{behaviour: 'createTerm side-doors NAMESPACE_CREATE', test_class: 'TermControllerNamespaceSideDoorTest', expected: 'Test that a caller with TERM_CREATE but NOT NAMESPACE_CREATE can create a NEW namespace by submitting a TermFormData with a never-seen namespaceName — confirms the side-door'}",
    "{behaviour: 'createTermTagsRelations side-doors TAG_CREATE', test_class: 'TermControllerTagSideDoorTest', expected: 'Test that a caller with TERM_TAGS_UPDATE but NOT TAG_CREATE can create new tags by submitting a TagsFormData with a never-seen tag name'}",
    "{behaviour: 'getTermsList and getTermLinkedEntities respect (or bypass) namespace scoping', test_class: 'TermNamespaceScopingTest', expected: 'Pin the read-collaborative posture: GET /api/terms returns terms from ALL namespaces to any authenticated user regardless of their owners or namespaces — the system-mission.md:267 intentional posture vs the per-namespace expectation operators may bring'}",
    "{behaviour: 'term-to-term link create — argument-order canonical edge direction is form-field-first', test_class: 'TermToTermDirectionTest', expected: 'Pin the canonical direction: POST /api/terms/100/term with linkedTermId=200 creates term_to_term(target_term_id=200, assigned_term_id=100) — the form-field-named-first convention'}",
    "{behaviour: 'concurrent createTerm with same (namespace, name) race', test_class: 'TermConcurrencyTest', expected: 'The createTerm idempotency check at TermServiceImpl.java:107-113 is not in a SELECT FOR UPDATE — concurrent creates of the same (namespace, name) tuple race; the DB unique index catches one but the surface error is opaque'}"
  ]
- test_files: [] — no `*TermController*Test*.java`, `*TermService*Test*.java`, or `*TermRepository*Test*.java` in `odd-platform-api/src/test/java/**` (verified via Glob).
- gaps: |
    The entire Business Glossary feature has zero test coverage at the controller, service, OR repository layer. A future-maintainer regression would likely land in three places:
      (a) the un-RBAC'd term-to-term linkage endpoints — a future maintainer adding a TERM_LINK permission would silently break operator workflows that rely on the current "any authenticated user can link" behaviour;
      (b) the broken pagination on getTermLinkedTerms — a future maintainer "fixing" the hard-coded `hasNext = false` would break the UI's infinite-scroll trigger logic, which currently relies on the false value to short-circuit;
      (c) the description-mention auto-link side-channel — a future maintainer adding a service-tier `@PreAuthorize(DATA_ENTITY_ADD_TERM)` on `linkTermWithDataEntity` would break the auto-link path because the description-edit controller doesn't hold that permission.
    All three are silent-regression class. Test coverage is the single highest-leverage investment for the entire P-06 pillar.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention (no controller carries `@docs`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-glossary"
    anchor: ""
    rationale: "The pillar P-06 landing page — points to the Business Glossary subsection for the per-feature reference"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "term-to-term linking (description-text mentions vs direct links)" — alluded to but not detailed
      "seven `TERM_*` RBAC permissions" — referenced but not enumerated on this page
      "namespace-scoped terms" — referenced but scoping rules not on this page
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-glossary/business-glossary"
    anchor: ""
    rationale: "The Business Glossary feature page — declared as the canonical surface for the seven TERM_* permissions per the pillar page"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      TERM_CREATE — "Create a new term in the Dictionary."
      TERM_UPDATE — "Edit the term's name, description, namespace, or directly-linked terms."
      TERM_DELETE — "Delete a term from the Dictionary."
      TERM_OWNERSHIP_CREATE — "Assign an owner to a term."
      TERM_OWNERSHIP_UPDATE — "Update an existing owner's role on a term."
      TERM_OWNERSHIP_DELETE — "Remove an owner from a term."
      TERM_TAGS_UPDATE — "Apply or remove tags on a term."
      "Terms live within a Namespace and are scoped by it" / "`finance/Customer` is distinct from `marketing/Customer`" / "Searches and term-to-entity link operations resolve within the namespace by default."
      "The link format used in description text spells out the namespace explicitly when crossing namespaces" (no explicit [[ns:term]] syntax documented)
    confidence: MEDIUM
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary"
    anchor: ""
    rationale: "The per-feature API reference page declared by the Pillar P-11 system-mission as the canonical endpoint reference for the Glossary"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      "POST /api/terms" — createTerm — no status code documented (controller returns 200; spec declares 201; api-ref page is silent)
      "POST /api/terms/{term_id}/term" — addLinkedTermToTerm — no permission documented
      "DELETE /api/terms/{term_id}/term/{linked_term_id}" — deleteLinkedTermFromTerm — no permission documented
      GET /api/terms/namespaces/{namespace_name}/names/{term_name} — getTermByNamespaceAndName — documented as "resolving a term by its namespace and name (the natural-key lookup form)"
    confidence: MEDIUM
- doc_drift_findings:
  - "Business Glossary docs declare 'TERM_UPDATE — Edit the term's name, description, namespace, or directly-linked terms.' but the controller has NO SecurityRule for POST /api/terms/{term_id}/term (addLinkedTermToTerm) or DELETE /api/terms/{term_id}/term/{linked_term_id} (deleteLinkedTermFromTerm). The docs imply TERM_UPDATE is required; the runtime accepts ANY authenticated user. **HIGH-severity doc-drift**: any operator reading the docs and authoring an RBAC policy that withholds TERM_UPDATE on a set of terms expecting term-to-term linking to be blocked will silently fail-open. — evidence: `TermController.java:237-249` (the two unguarded endpoints) + `SecurityConstants.java:111, 174-193` (the term SecurityRules — verified by grep that the term-to-term paths are absent) + live doc fetch 2026-05-20."
  - "API-reference glossary page documents `POST /api/terms` (createTerm) but does NOT document the success status code. The controller returns 200 (`TermController.java:74` `.map(ResponseEntity::ok)`) but the OpenAPI spec declares 201 (`openapi.yaml:2760-2761` `'201': description: The resource has been successfully created`). Either the spec or the controller is wrong; the API-reference page omits the status code so neither operator nor maintainer can determine ground truth from the docs."
  - "Business Glossary docs claim 'Searches and term-to-entity link operations resolve within the namespace by default' — implying per-namespace scoping. But the controller's `getTermLinkedEntities` (line 100) and `getTermsList` (line 52) read all terms across ALL namespaces, and the create/link operations write to terms regardless of namespace. The cross-namespace pollution at the service layer (per the batch-K invariant) means the docs' 'by default' claim has no enforcement mechanism."
  - "Live `data-glossary` page references the `[[ns:term]]` mention syntax indirectly ('link format used in description text spells out the namespace explicitly') but does NOT show the actual syntax. Operators encountering `[[finance:Customer]]` in a description have no doc-side explanation of what it does or which permission gates the implicit term-link creation (REFACTOR-227 side-channel — DATA_ENTITY_DESCRIPTION_UPDATE alone). DOC-NNN candidate."

## implicit_adrs

- "Pure-delegation controller layer with no business logic" — evidence: `TermController.java:51-250` — intent_anchor: 23 method bodies are 1-3 line reactive delegations, no branching, no transformations; consistent with the platform-wide implicit ADR (also visible on `DataEntityController`, `AlertController`, `OwnerController`) that controllers are thin OpenAPI-implementation stubs and ALL semantic logic lives in services. — confidence: HIGH
- "Constructor-injection via Lombok @RequiredArgsConstructor for final-fielded services" — evidence: `TermController.java:41, 44-49` — intent_anchor: `@RequiredArgsConstructor` with six `private final` services; idiomatic Spring constructor-injection avoiding `@Autowired` field-injection (which the platform has rejected as a pattern). — confidence: HIGH
- "Read endpoints are unauthorised-at-controller-tier (rely on the catch-all `.authenticated()`)" — evidence: `TermController.java:52-127, 166-198, 201-216` (15 read endpoints) + `SecurityConstants.java:174-193` (only WRITE endpoints carry SecurityRules — the read endpoints have NO entry) + `AuthorizationCustomizer.java:29-30` (the catch-all `pathMatchers(\"/**\").authenticated()`) — intent_anchor: the read-collaborative posture is consistently applied; every authenticated user reads every term. Aligned with `system-mission.md:267` ('every authenticated user can enumerate the entire catalog'). — confidence: HIGH
- "Term linkage write operations route resource-extractor through `AuthorizationManagerType.TERM` not `DATA_ENTITY`" — evidence: `SecurityConstants.java:174-193` (all term-side write SecurityRules use `TERM` resource type) + `ReactiveAuthorizationManagerFactory.java:48` (`case TERM -> TERM_ID`) — intent_anchor: the per-term authorisation is by `term_id` not `data_entity_id`, even on endpoints that mutate cross-resource linkage (term-to-queryexample, term-to-tag). This is a defensible decision but means a query-example shared across multiple terms can be detached by anyone with the permission on the term, even without the permission on the query example. — confidence: HIGH
- "TermDelete cleans up data_entity_to_term + dataset_field_to_term link rows but NOT term_to_term — load-bearing inconsistency" — evidence: `TermServiceImpl.java:155-164` shows only two of the three link tables explicitly cleaned (`deleteRelationsWithDataEntities` + `deleteRelationsWithDatasetFields`); term_to_term is not cited — intent_anchor: NO explicit code comment defends the omission, so this is more accurately a bug (route to bugs_limitations_corner_cases) than an implicit ADR. The asymmetry might be intentional (term_to_term has the V0_0_91 deleted_at column unlike the sibling tables) but the absence of a code comment means the intent is not anchored. — confidence: LOW
- "Search-session ownership is via unguessable UUID search_id, not RBAC" — evidence: `TermController.java:166-216` (5 search-state endpoints use `searchId` UUID, no permission gate) + `SecurityConstants.java` has no entries for `/api/terms/search/**` — intent_anchor: the unguessable UUID IS the authority; aligned with the pattern across `SearchController` (the data-entity search uses the same `searchId` UUID model). Consistent platform-wide ADR. — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**HEADLINE (HIGH)** — Term-to-term linkage endpoints (`POST /api/terms/{term_id}/term` and `DELETE /api/terms/{term_id}/term/{linked_term_id}`) have **NO SecurityRule entry** in `SecurityConstants.java`. Verified by exhaustive grep: `grep -nE '/api/terms/.*term\\b' SecurityConstants.java` returns ZERO matches for the term-to-term paths. The catch-all `pathMatchers(\"/**\").authenticated()` at `AuthorizationCustomizer.java:30` is the only gate. **Net effect**: any authenticated user (LOGIN_FORM / OAUTH2 / LDAP) can create or delete term-to-term links on ANY term they can reach the API for. The Business Glossary docs (live-fetched 2026-05-20) declare TERM_UPDATE gates 'directly-linked terms' — but TERM_UPDATE is NOT consulted on this endpoint. Operators authoring RBAC policies based on the docs will silently fail-open." — evidence: TermController.java:237-249 + SecurityConstants.java:174-193 (verified absent) + AuthorizationCustomizer.java:29-30 + live doc fetch 2026-05-20 + Business Glossary RBAC table — severity: HIGH
- "**HIGH** — All 23 endpoints inherit `TermServiceImpl`'s service-tier-zero-permission-checks posture (per batch-K invariant). The controller perimeter is the SOLE authorisation gate; if any future internal job, admin tool, or downstream microservice invokes `TermService` methods directly, there is no defence-in-depth. The 2 unguarded controller endpoints compound this — both layers leave term-to-term linkage unprotected." — evidence: TermController.java:42-49 (only services injected, no programmatic checks) + TermServiceImpl.java:1-552 (grep `@PreAuthorize|hasPermission|hasRole|permissionService` returns ZERO matches per batch-K) — severity: HIGH
- "**MEDIUM** — Status-code drift on createTerm and updateTerm: controller returns 200 (`TermController.java:74, 82` `.map(ResponseEntity::ok)`) but OpenAPI declares 201 for both (`openapi.yaml:2760-2761, 2798-2799`). Existing OpenAPI-generated clients expecting 201 may treat 200 as 'not the expected success' — typed-client edge-case. Either the spec or the controller is wrong; the API-reference page omits status codes so docs cannot disambiguate." — evidence: TermController.java:70-83 + openapi.yaml:2749-2803 + live doc fetch — severity: MEDIUM
- "**MEDIUM** — Search-session-state endpoints (`getTermFiltersForFacet`, `getTermSearchFacetList`, `getTermSearchResults`, `getTermSearchSuggestions`, `termSearch`, `updateTermSearchFacets` lines 166-216) have NO explicit caller-authorisation check beyond `authenticated()`. The `searchId` UUID is unguessable so de-facto ownership is preserved, but: (a) no rate-limit, (b) no per-caller session counting (a single user can create unlimited sessions), (c) `updateTermSearchFacets` mutates session state without confirming caller is the session creator — any authenticated user with a stolen or guessed UUID can hijack a search session. The same pattern exists across SearchController so likely intentional, but unfile-anchored." — evidence: TermController.java:166-216 + SecurityConstants.java (no entries for `/api/terms/search/**`) — severity: MEDIUM
- "**MEDIUM** — `deleteTerm` cleans up `data_entity_to_term` and `dataset_field_to_term` link rows but NOT `term_to_term` link rows. `TermServiceImpl.java:155-164` calls only `deleteRelationsWithDataEntities` + `deleteRelationsWithDatasetFields`; the `term_to_term` table is silently left with orphan edges pointing at the soft-deleted term. Combined with the batch-N schema-drift invariant (the 7 read sites never filter `term_to_term.deleted_at IS NULL`), the orphan edges remain visible on `getTermLinkedTerms` indefinitely. Operators deleting a term that had term-to-term linkages will see the deleted term still appear in OTHER terms' linked-terms lists." — evidence: TermServiceImpl.java:155-164 + ReactiveTermRepositoryImpl.java:198-199, 227-231, 324-325, 345, 429-430, 448-454, 472-491, 510-523 (7 unfiltered read sites per batch-N) — severity: MEDIUM
- "**MEDIUM** — Term-to-term link create/delete (`addLinkedTermToTerm` line 237, `deleteLinkedTermFromTerm` line 246) are NOT annotated with `@ActivityLog` in `TermServiceImpl.java:288-301`. The other linkage operations DO emit activity events (`linkTermWithDataEntity` line 169, `linkTermWithDatasetField` line 211, `removeTermFromDataEntity` line 183, `removeTermFromDatasetField` line 225 — all carry `@ActivityLog(TERM_ASSIGNMENT_UPDATED)`). The term-to-term family is INVISIBLE to the Activity Feed — auditors investigating 'who linked term A to term B' have no audit trail." — evidence: TermServiceImpl.java:288-301 vs 169, 183, 211, 225 — severity: MEDIUM
- "**MEDIUM** — `createTerm` and `updateTerm` side-door NAMESPACE_CREATE. `TermServiceImpl.java:101-117, 138-145` invoke `namespaceService.getOrCreate(formData.getNamespaceName())` — a user holding TERM_CREATE / TERM_UPDATE can create an arbitrary new namespace by submitting a never-seen namespaceName in the form. This bypasses NAMESPACE_CREATE permission. Same architectural class as the batch-K TAG_CREATE side-door (via `TermService.upsertTags`)." — evidence: TermServiceImpl.java:103, 138 — severity: MEDIUM
- "**MEDIUM** — `createTermTagsRelations` (line 130) side-doors TAG_CREATE. `TermServiceImpl.java:255-258` invokes `tagService.getOrCreateTagsByName(names)` — a user with TERM_TAGS_UPDATE on a term can create new tags by submitting never-seen tag names. Bypasses TAG_CREATE permission. (Batch-K invariant.)" — evidence: TermServiceImpl.java:254-264 — severity: MEDIUM
- "**LOW** — `getTermLinkedTerms` (line 121) returns a broken `LinkedTermList` shape: `total = items.size()` and `hasNext = false` hard-coded by `TermServiceImpl.java:283-285`. The UI's infinite-scroll trigger relies on `hasNext` to know when to stop fetching — silently breaks if the underlying list has more than `size` rows. Pin via regression test or fix." — evidence: TermServiceImpl.java:283-285 — severity: LOW
- "**LOW** — `deleteTermOwnership` (line 148) and `updateTermOwnership` (line 156) accept `termId` as path param but DO NOT pass it to the underlying `TermOwnershipService` — only `ownershipId` is forwarded. The SecurityRule authorizes via `term_id` (`SecurityConstants.java:179-184`) but the actual mutation is identified by `ownership_id` only. If two terms share an ownership_id collision (currently impossible due to PK uniqueness), the path-param check would silently mismatch. Defensive sanity-check could be added at the service layer." — evidence: TermController.java:148-163 — severity: LOW
- "**LOW** — `createTermTagsRelations` returns its response shape via `Mono.just(ResponseEntity.ok(tagsFormData.flatMapMany(fd -> termService.upsertTags(termId, fd))))` (lines 133-135) — the `Flux<Tag>` is wrapped INSIDE `ResponseEntity.ok(...)` synchronously, which means the controller's `Mono<ResponseEntity<Flux<Tag>>>` resolves IMMEDIATELY (before the upsert completes); the Flux is the laz body. This is a different shape from the other 22 endpoints which all `.map(ResponseEntity::ok)` after the Mono completes. Functionally correct under WebFlux but stylistically inconsistent — newcomer-confusion risk." — evidence: TermController.java:133-135 — severity: LOW
- "**LOW** — `getTermByNamespaceAndName` (line 62) does NOT URL-decode the namespace or term name parameters. A namespace name containing `%2F` (URL-encoded slash) or other special characters reaches the controller as a raw string; depending on Spring's URL-mapping config, this may either match or 404. Pin behaviour with a regression test if the namespace naming policy allows special chars." — evidence: TermController.java:62-67 + TermServiceImpl.java:91-97 — severity: LOW

## security

- **auth_mode_relevance**: LOGIN_FORM | OAUTH2 | LDAP | DISABLED. `DISABLED` is dev-only per docs but skips the SecurityRules entirely — under DISABLED, every endpoint here is anonymously reachable, including the 9 RBAC-gated writes. The 4 auth modes are the relevant scope for production deployments. S2S is `N/A — TermController is on the UI/API surface; S2S filter applies to /ingestion/* only` (verified `SecurityConstants.WHITELIST_PATHS` at line 95-96 includes `/ingestion/**`, not `/api/terms/**`).
- **ingestion_filter_relevance**: `NO — TermController is UI/API surface, not ingestion. The `IngestionDataEntitiesFilter` applies to `/ingestion/entities` only; no Term* endpoints route through it.`
- **authorization_assertions**:
  - "TERM_CREATE on `/api/terms` POST — gated via NO_CONTEXT manager (terms don't exist yet) — evidence: SecurityConstants.java:111"
  - "TERM_UPDATE on `/api/terms/{term_id}` PUT — gated via TERM resource extractor on term_id — evidence: SecurityConstants.java:174"
  - "TERM_DELETE on `/api/terms/{term_id}` DELETE — gated via TERM resource extractor — evidence: SecurityConstants.java:175-176"
  - "TERM_OWNERSHIP_CREATE on `/api/terms/{term_id}/ownership` POST — gated via TERM extractor — evidence: SecurityConstants.java:177-178"
  - "TERM_OWNERSHIP_UPDATE on `/api/terms/{term_id}/ownership/{ownership_id}` PUT — evidence: SecurityConstants.java:179-181"
  - "TERM_OWNERSHIP_DELETE on `/api/terms/{term_id}/ownership/{ownership_id}` DELETE — evidence: SecurityConstants.java:182-184"
  - "TERM_TAGS_UPDATE on `/api/terms/{term_id}/tags` PUT — evidence: SecurityConstants.java:185-186"
  - "QUERY_EXAMPLE_TERM_CREATE on `/api/terms/{term_id}/queryexample` POST — evidence: SecurityConstants.java:187-189"
  - "QUERY_EXAMPLE_TERM_DELETE on `/api/terms/{term_id}/queryexample/{example_id}` DELETE — evidence: SecurityConstants.java:190-193"
- **owner_scoping**: `BYPASSES — read endpoints (getTermsList, getTermDetails, getTermLinkedEntities, getTermLinkedColumns, getTermLinkedTerms, getTermSearch*) return data across all namespaces and all owners to every authenticated user; consistent with the platform-wide read-collaborative posture per system-mission.md:267. Write endpoints route through resource-extractor authorisation by term_id, NOT by owner — so a user with TERM_UPDATE on a Role attached to Owner-A's policies can update terms belonging to Owner-B's namespace if their permission grant matches the per-term ODDRN policy.`
- **data_exposure**:
  - "Term payload (id, name, namespace, definition, owners, tags) → any authenticated user via getTermsList, getTermDetails, getTermByNamespaceAndName, getTermSearch* — no namespace/owner filter at controller layer"
  - "Linked-entity list (data entities linked to this term, with their owners, types, classes) → any authenticated user via getTermLinkedEntities — bypasses per-data-entity ownership scoping at controller (the DataEntityService.listByTerm read path is responsible for any scoping)"
  - "Linked-column list (dataset fields linked to this term) → same exposure as linked-entity list"
  - "Term-to-term graph (which terms link to which) → any authenticated user via getTermLinkedTerms — includes term_to_term rows that may have deleted_at set per batch-N schema-drift"
  - "Term ownership graph (which owners hold which roles on which terms) → any authenticated user via getTermDetails — the full Owners + Roles aggregation surfaces"
- **known_security_gaps**:
  - "Term-to-term linkage endpoints have NO SecurityRule — any authenticated user can link/unlink terms regardless of TERM_* permissions held; doc-drift with Business Glossary docs that imply TERM_UPDATE gates this surface — evidence: TermController.java:237-249 + SecurityConstants.java (verified absent for `/api/terms/{term_id}/term`) — severity: HIGH"
  - "TermServiceImpl service-tier has ZERO permission checks (batch-K invariant) — controller perimeter is the SOLE defence — evidence: cross-link to `term-service-tier-zero-permission-checks.yaml` — severity: HIGH"
  - "createTerm + updateTerm side-door NAMESPACE_CREATE via `namespaceService.getOrCreate(name)` — evidence: TermServiceImpl.java:103, 138 — severity: MEDIUM"
  - "createTermTagsRelations side-doors TAG_CREATE via `tagService.getOrCreateTagsByName` — evidence: TermServiceImpl.java:257 — severity: MEDIUM"
  - "Description-mention auto-link side-channel (REFACTOR-227) bypasses DATA_ENTITY_ADD_TERM — TermController writes don't trigger it but TermController READS surface the auto-linked term-to-entity rows via getTermLinkedEntities, so the controller is a query surface for the bypass — evidence: cross-link to `term-mention-auto-link-side-channel-primary-source.yaml` + DataEntityServiceImpl.java:328 — severity: HIGH (architectural; not in this file)"
  - "Search-session-state mutation (`updateTermSearchFacets`, `getTermFiltersForFacet`) accepts any authenticated user with a valid `searchId` UUID — no per-caller session ownership check; UUID is unguessable but no rate-limit on session creation — evidence: TermController.java:166-216 — severity: LOW"
  - "Per-namespace scoping is documented (Business Glossary docs: 'Searches and term-to-entity link operations resolve within the namespace by default') but NOT enforced at controller or service tier; cross-namespace pollution unconstrained — evidence: live doc fetch + TermController.java:52, 100 + TermServiceImpl.java service-tier (no namespace filter on reads) — severity: MEDIUM"
  - "DISABLED auth mode allows anonymous Term mutation — every gated endpoint here is anonymously reachable when `auth.type=DISABLED`; per docs DISABLED is dev-only but no fail-closed behaviour in production — evidence: AuthorizationCustomizer.java (no fail-closed when auth.type=DISABLED) + system-mission.md:267 — severity: LOW"

## performance

- **hot_paths**:
  - "`getTermDetails` (line 92) — the 11-LEFT-JOIN + 4-countDistinct aggregation in `ReactiveTermRepositoryImpl.getTermDetailsDto` (lines 194-238) is the most expensive single read on this controller. Cost scales with the term's degree (owners + tags + linked terms + entities-using-it + columns-using-it + query-examples-using-it); for a heavily-used term, the combinatorial JOIN fan-out before DISTINCT can materialise N×M×P×Q rows. — evidence: TermController.java:92-97 + ReactiveTermRepositoryImpl.java:194-238"
  - "`getTermLinkedEntities` (line 100) — delegates to `DataEntityService.listByTerm` which scans `data_entity_to_term` filtered by `term_id` then joins to the full data-entity row + class + owners. For a term linked to many entities (DEG-like terms), this is a wide read. — evidence: TermController.java:100-108"
  - "`termSearch` (line 201) — create-session pattern; runs the FTS query immediately and persists facet state. Hot path for the global glossary search UI. — evidence: TermController.java:201-206"
  - "`createTerm` and `updateTerm` — both run inside `@ReactiveTransactional` and execute: idempotency check + namespace get-or-create + description regex parse + INSERT + FTS materialisation + (createTerm only) drain of staging table. 5-7 DB round-trips per write. — evidence: TermController.java:70-83 + TermServiceImpl.java:101-145"
- **throughput_characteristics**:
  - "All 23 endpoints are single-item — no batch list-update or bulk-link endpoint exposed on this controller"
  - "Search-session pattern (one POST creates session, subsequent GETs read it) amortises the FTS cost across page reads — but session state is stored server-side and never expires explicitly (long-tail memory growth at scale)"
  - "Reactive Mono/Flux signature throughout — non-blocking but per-call DB round-trip; controller does NOT batch related operations"
- **resource_allocation**:
  - "TermDetailsDto JOIN fan-out — `getTermDetailsDto` materialises up to N×M×P×Q rows in memory at the planner before the DISTINCT collapses them; for terms with high-degree linkages, the intermediate row count could pressure the R2DBC client buffer"
  - "Search-session state lives server-side keyed by `searchId` UUID — no documented TTL for term-search-session cleanup; long-lived sessions consume memory indefinitely until restart"
  - "FTS materialised table `term_search_entrypoint` is rewritten on every createTerm + updateTerm + createTermTagsRelations — write amplification is bounded by `TermServiceImpl.updateSearchVectors` (line 115) but every search-vector update touches the GIN index"
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally (subject to the search-session-state caveat above)"
  - "**No pagination on getTermLinkedTerms response shape** — the broken `hasNext = false` + `total = items.size()` means the UI cannot detect when more results exist; effectively caps the UI's linked-terms display at the requested `size` even if the DB has more rows"
  - "No rate limit on `termSearch` (session creation) — any authenticated user can create unlimited search sessions"
- **known_performance_gaps**:
  - "`getTermDetails` JOIN fan-out: 11 LEFT JOINs + GROUP BY on every TERM.* and NAMESPACE.* field — high-degree terms produce wide intermediate row sets — evidence: ReactiveTermRepositoryImpl.java:194-238 — severity: MEDIUM"
  - "`getTermLinkedTerms` broken pagination (hard-coded `hasNext=false`, `total=items.size()`) — UI infinite-scroll cannot detect more results — evidence: TermServiceImpl.java:283-285 — severity: MEDIUM"
  - "`removeTermFromDataEntity` triple-re-query overhead per the batch-K REFACTOR-228 invariant: the activity-handler captures BEFORE+AFTER terms list by RE-querying twice plus the method itself re-queries — 3 full-list reads per single de-link operation. Same pattern applies to `removeTermFromDatasetField`. Not directly on this controller but inherited via the linkage operations delegated to TermService. — evidence: cross-link to TermServiceImpl.md batch K — severity: MEDIUM"
  - "Term-search-session memory accumulation — no documented TTL on session state — evidence: TermController.java:201-216 + system-wide observation — severity: LOW"
  - "FTS materialisation on every term write — non-trivially expensive (GIN index update) — could be batched in a bulk-load scenario but no bulk endpoint exposed — evidence: TermServiceImpl.java:115 — severity: LOW"

## sources

- understanding ← TermController.java:1-251 (entire file read) + AuthorizationCustomizer.java:14-32 + SecurityConstants.java:111, 174-193, 237-242, 295-303 + ReactiveAuthorizationManagerFactory.java:24-65 + cross-link `term-service-tier-zero-permission-checks.yaml` + cross-link `term-to-term-deleted-at-schema-drift-v0_0_76-vs-v0_0_91.yaml`
- concepts.entities.TermApi ← TermController.java:6, 42
- concepts.entities.TermFormData ← TermController.java:22, 70, 78 + openapi.yaml:2755-2759
- concepts.entities.LinkedTermFormData ← TermController.java:11, 238 + components.yaml:2650 + TermServiceImpl.java:290-294
- concepts.entities.TermSearchFacetsData ← TermController.java:26, 178, 201, 209 + openapi.yaml:2997-3047
- concepts.operations.createTerm ← TermController.java:70-75 + TermServiceImpl.java:101-117 + openapi.yaml:2749-2766
- concepts.operations.updateTerm ← TermController.java:78-83 + TermServiceImpl.java:119-145
- concepts.operations.deleteTerm ← TermController.java:86-90 + TermServiceImpl.java:155-164
- concepts.operations.addLinkedTermToTerm ← TermController.java:237-243 + TermServiceImpl.java:288-294 + TermRelationsRepositoryImpl.java:164
- concepts.operations.deleteLinkedTermFromTerm ← TermController.java:246-249 + TermServiceImpl.java:297-301 + TermRelationsRepositoryImpl.java:222
- concepts.invariants.[1 — pure delegation] ← TermController.java:51-250 (verified by reading the entire body)
- concepts.invariants.[5 — term-to-term not gated] ← TermController.java:237-249 + SecurityConstants.java (verified by Grep that `/api/terms/{term_id}/term` is absent) + AuthorizationCustomizer.java:29-30
- concepts.invariants.[6 — status-code drift] ← TermController.java:74, 82 + openapi.yaml:2759-2761, 2797-2799
- dependencies_semantic.requires-feature ← system-mission.md:182-198 (P-06) + system-mission.md:249-268 (P-09) + system-mission.md:77-104 (P-01)
- dependencies_semantic.requires-runtime ← TermController.java:34-38 (Spring imports) + TermServiceImpl.java:51-58 + V0_0_35__add_terms.sql:58-76 + V0_0_91__add_term_to_term.sql:1-12
- upstream_callers ← terms.ts:1-180 + TermsForm.tsx:1-180 + cross-link UI components verified via Glob /home/raman/work/odd/odd-platform/odd-platform-ui/src/components/Terms/**/*.tsx
- downstream_side_effects.createTerm ← TermServiceImpl.java:101-117
- downstream_side_effects.updateTerm ← TermServiceImpl.java:119-145
- downstream_side_effects.deleteTerm ← TermServiceImpl.java:155-164 + V0_0_76__term_relations_hard_delete.sql
- downstream_side_effects.addLinkedTermToTerm + deleteLinkedTermFromTerm ← TermServiceImpl.java:288-301 + TermRelationsRepositoryImpl.java:164, 222 + cross-link `term-to-term-deleted-at-schema-drift` invariant
- tests_coverage_semantic.test_files ← verified absent via Glob `/home/raman/work/odd/odd-platform/odd-platform-api/src/test/**/Term*` (zero matches) + Grep `TermController` returns only the source file
- docs_link_semantic.inferred_docs.[0] ← https://docs.opendatadiscovery.org/features/data-glossary WebFetched 2026-05-20 status 200
- docs_link_semantic.inferred_docs.[1] ← https://docs.opendatadiscovery.org/features/data-glossary/business-glossary WebFetched 2026-05-20 status 200
- docs_link_semantic.inferred_docs.[2] ← https://docs.opendatadiscovery.org/developer-guides/api-reference/glossary WebFetched 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings.[0 — TERM_UPDATE docs vs code] ← live doc fetch 2026-05-20 + TermController.java:237-249 + SecurityConstants.java verified absent
- docs_link_semantic.doc_drift_findings.[1 — status code drift] ← live doc fetch 2026-05-20 + TermController.java:74, 82 + openapi.yaml:2760, 2798
- docs_link_semantic.doc_drift_findings.[2 — namespace scoping claim] ← live doc fetch 2026-05-20 + TermController.java:52, 100 + TermServiceImpl.java (no namespace filter on reads)
- docs_link_semantic.doc_drift_findings.[3 — [[ns:term]] syntax silent] ← live doc fetch 2026-05-20 + cross-link `term-mention-auto-link-side-channel-primary-source.yaml`
- implicit_adrs.[0 — pure-delegation] ← TermController.java:51-250 (all 23 method bodies)
- implicit_adrs.[1 — constructor-injection] ← TermController.java:41-49
- implicit_adrs.[2 — read-collaborative] ← TermController.java:52-127, 166-216 + SecurityConstants.java + AuthorizationCustomizer.java:29-30 + system-mission.md:267
- implicit_adrs.[3 — TERM resource-extractor] ← SecurityConstants.java:174-193 + ReactiveAuthorizationManagerFactory.java:48
- implicit_adrs.[5 — search-session UUID-as-auth] ← TermController.java:166-216 + SearchController parallel pattern
- bugs_limitations_corner_cases.[0 — HEADLINE — term-to-term not gated] ← TermController.java:237-249 + SecurityConstants.java (verified absent) + AuthorizationCustomizer.java:30
- bugs_limitations_corner_cases.[1 — service-tier-zero-checks] ← cross-link batch-K invariant + TermServiceImpl.java grep result
- bugs_limitations_corner_cases.[2 — status code drift] ← TermController.java:74, 82 + openapi.yaml:2760-2761, 2797-2799
- bugs_limitations_corner_cases.[3 — search-session ownership] ← TermController.java:166-216 + SecurityConstants.java
- bugs_limitations_corner_cases.[4 — deleteTerm misses term_to_term cleanup] ← TermServiceImpl.java:155-164 + ReactiveTermRepositoryImpl.java (7 unfiltered read sites per batch-N)
- bugs_limitations_corner_cases.[5 — term-to-term activity-event absent] ← TermServiceImpl.java:288-301 vs 169, 183, 211, 225
- bugs_limitations_corner_cases.[6 — NAMESPACE_CREATE side-door] ← TermServiceImpl.java:103, 138
- bugs_limitations_corner_cases.[7 — TAG_CREATE side-door] ← TermServiceImpl.java:254-264
- bugs_limitations_corner_cases.[8 — broken pagination] ← TermServiceImpl.java:283-285
- bugs_limitations_corner_cases.[9 — termId not passed to ownership service] ← TermController.java:148-163
- bugs_limitations_corner_cases.[10 — Flux body wrapped synchronously] ← TermController.java:133-135
- bugs_limitations_corner_cases.[11 — URL decode] ← TermController.java:62-67
- security.auth_mode_relevance ← SecurityConstants.WHITELIST_PATHS line 95-96 + AuthorizationCustomizer.java + system-mission.md auth-modes
- security.authorization_assertions.[0-8] ← SecurityConstants.java:111, 174-193 (verified line by line) + cross-link ReactiveAuthorizationManagerFactory.java:24-65
- security.owner_scoping ← TermController.java + SecurityConstants.java + system-mission.md:267
- security.data_exposure ← TermController.java:52, 92, 100, 111, 121 (the read endpoints' response shapes) + openapi.yaml schema refs
- security.known_security_gaps.[0] ← TermController.java:237-249 + SecurityConstants.java verified absent
- security.known_security_gaps.[1] ← cross-link batch-K invariant `term-service-tier-zero-permission-checks`
- security.known_security_gaps.[2-3] ← TermServiceImpl.java:103, 138, 254-264
- security.known_security_gaps.[4] ← cross-link `term-mention-auto-link-side-channel-primary-source.yaml`
- security.known_security_gaps.[5] ← TermController.java:166-216 + SecurityConstants.java (no entries for `/api/terms/search/**`)
- security.known_security_gaps.[6] ← live doc fetch 2026-05-20 + TermServiceImpl.java (no namespace filter)
- security.known_security_gaps.[7] ← AuthorizationCustomizer.java + system-mission.md DISABLED-mode posture
- performance.hot_paths.[0] ← TermController.java:92 + ReactiveTermRepositoryImpl.java:194-238
- performance.hot_paths.[1-3] ← TermController.java:100, 201, 70-83 + TermServiceImpl.java:101-145
- performance.scaling_characteristics ← TermController.java entire file + system observation
- performance.known_performance_gaps.[0] ← ReactiveTermRepositoryImpl.java:194-238
- performance.known_performance_gaps.[1] ← TermServiceImpl.java:283-285
- performance.known_performance_gaps.[2] ← cross-link batch-K REFACTOR-228 invariant
- performance.known_performance_gaps.[3-4] ← TermController.java:201-216 + TermServiceImpl.java:115

## confidence_per_field

- understanding: HIGH (source file read end-to-end; OpenAPI cross-checked; SecurityConstants cross-checked line by line; service impl read for delegation targets; downstream side-effects traced)
- concepts: HIGH (every entity / operation / invariant has file:line evidence)
- dependencies_semantic: HIGH (cross-pillar dependencies anchored to system-mission.md and cross-batch invariants)
- upstream_callers: HIGH (UI hook layer + UI components verified via Glob + Grep; no in-repo Java caller verified absent via Grep)
- downstream_side_effects: HIGH (TermServiceImpl + TermRelationsRepositoryImpl read for each operation)
- tests_coverage_semantic: HIGH (zero coverage verified via Glob + Grep across `<odd-platform-repo>/odd-platform-api/src/test`)
- docs_link_semantic: HIGH (three live WebFetches verified 200; fetched_excerpts captured verbatim; four doc-drift findings independently anchored)
- implicit_adrs: HIGH (5 ADRs all anchored to file:line + intent rationale; the deleteTerm/term_to_term-cleanup observation routed to bugs not ADRs because no intent anchor visible)
- bugs_limitations_corner_cases: HIGH (12 findings, each cited; HEADLINE finding triangulated against live docs + SecurityConstants grep + Business Glossary RBAC table)
- security: HIGH (every sub-field anchored; per-endpoint SecurityRule status verified by reading SecurityConstants line-by-line; doc-drift confirmed via live WebFetch)
- performance: MEDIUM (hot paths and gaps anchored to TermServiceImpl + ReactiveTermRepositoryImpl batch-N/K invariants; throughput / scaling characteristics described qualitatively without measurement)

## Maintainer notes

