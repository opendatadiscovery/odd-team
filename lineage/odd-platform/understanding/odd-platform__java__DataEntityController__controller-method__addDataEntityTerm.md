---
node_id: "odd-platform java DataEntityController controller-method:addDataEntityTerm"
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

# DataEntityController#addDataEntityTerm — semantic understanding

## understanding

`addDataEntityTerm` is the reactive `POST /api/dataentities/{data_entity_id}/terms` handler — four lines that read the request body as `Mono<DataEntityTermFormData>` (a single required `term_id: int64`), call `termService.linkTermWithDataEntity(formData.getTermId(), dataEntityId)`, and lift the resulting `LinkedTerm` (id + term + namespace + isDescriptionLink) into `200 OK` (`DataEntityController.java:149-156`). The service writes one row into `data_entity_to_term` with `is_description_link = FALSE`, captures a `TERM_ASSIGNMENT_UPDATED` activity event (BEFORE+AFTER terms list as JSON), marks `data_entity_filled.TERMS`, and returns the linked-term DTO (`TermServiceImpl.java:169-179`).

**Headline finding (HIGH severity, primary-source confirmed):** the SecurityConstants rule that is supposed to gate this endpoint registers the WRONG PATH. `SecurityConstants.java:237-239` declares `new PathPatternParserServerWebExchangeMatcher("/api/dataentities/{data_entity_id}/term", POST)` (SINGULAR `term`); the OpenAPI spec at `openapi.yaml:973` declares the operation path as `/api/dataentities/{data_entity_id}/terms` (PLURAL). Because `AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:24-30`) only enforces a permission when a `SecurityRule.matcher()` matches the request path — and falls through to a global `.pathMatchers("/**").authenticated()` (line 29-30) when no rule matches — the `DATA_ENTITY_ADD_TERM` permission check is NEVER evaluated for the real `POST /api/dataentities/{id}/terms` path. ANY authenticated user can link any term to any data entity. The identical path-mismatch applies to the DELETE counterpart (`SecurityConstants.java:240-242` registers `…/term/{term_id}` SINGULAR vs `openapi.yaml:1042` PLURAL `…/terms/{term_id}`). The DataEntityPermissionExtractor / Policy-resolver pipeline is unreachable for term-linking on data entities.

## concepts

- entities: [
    "`DataEntityTermFormData` (request body — `term_id: int64`, REQUIRED per `components.yaml:2623-2630`)",
    "`LinkedTerm` (response payload — `id`, `name`, `definition`, `namespace`, `isDescriptionLink`)",
    "`DataEntityToTermPojo` (jOOQ row — `data_entity_id`, `term_id`, `is_description_link` — PK is `(data_entity_id, term_id, is_description_link)` per `V0_0_77__data_entity_term_description.sql:13-14`)",
    "`TermAssignmentUpdated` activity event — emitted by `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` on the service method",
    "`TERMS` filled-field marker — `data_entity_filled.TERMS` flag toggled to `true` after first term is linked"
  ]
- operations: [
    "`link-term-to-data-entity` — `Mono<DataEntityTermFormData> → termRelationsRepository.createRelationWithDataEntity(dataEntityId, termId) [INSERT with onDuplicateKeyIgnore] → switchIfEmpty(BadUserRequestException 'Term already assigned to data entity') → termRepository.getTermRefDto(termId) → mark data_entity_filled.TERMS → map to LinkedTerm`"
  ]
- invariants: [
    "Reactive transactional — `TermServiceImpl.linkTermWithDataEntity` is annotated `@ReactiveTransactional` + `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` (`TermServiceImpl.java:168-170`); the INSERT into `data_entity_to_term`, the `getTermRefDto` fetch, the `markEntityFilled(TERMS)` mark, and the activity-event emission run inside one DB transaction. The controller method has no transaction annotation; the boundary lives at the service.",
    "Duplicate-prevention graceful — `TermRelationsRepositoryImpl.createRelationWithDataEntity` uses `.onDuplicateKeyIgnore()` against the `(data_entity_id, term_id, is_description_link)` PK (`TermRelationsRepositoryImpl.java:29-37` + `V0_0_77__data_entity_term_description.sql:13-14`). On collision, the INSERT returns an empty `Mono`; the service's `.switchIfEmpty(Mono.error(BadUserRequestException(\"Term already assigned to data entity\")))` (`TermServiceImpl.java:173-174`) translates the empty-result signal into a 400 Bad Request. This is structurally different from ownership-create (which surfaces a raw DB constraint exception as 5xx — cross-ref `createOwnership` sidecar).",
    "Manual link is `is_description_link = FALSE` by default — `TermRelationsRepositoryImpl.createRelationWithDataEntity` does NOT set `IS_DESCRIPTION_LINK`, so jOOQ writes the DB DEFAULT `FALSE` (`V0_0_77__data_entity_term_description.sql:2`). The PK `(data_entity_id, term_id, is_description_link)` allows BOTH a manual link AND a description-link mention of the same (data-entity, term) pair to coexist as separate rows. A user manually linking a term that the data-entity description already mentions via `[[namespace:name]]` syntax creates a SECOND row.",
    "Activity-feed event emitted — `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` on `TermServiceImpl.linkTermWithDataEntity` (`TermServiceImpl.java:169`); `TermAssignmentActivityHandler` (`TermAssignmentActivityHandler.java:20-61`) captures the BEFORE and AFTER terms list for the data-entity as JSON (`TermActivityStateDto(termId, termName, namespaceName, isDescriptionLink)`) by re-querying `termRepository.getDataEntityTerms(dataEntityId)` twice per call.",
    "`term_id` is REQUIRED at the OpenAPI contract — `DataEntityTermFormData.term_id` is in the `required:` array (`components.yaml:2629-2630`); the OpenAPI-generated request validator rejects missing-field payloads with 400 before reaching the controller. There is no validation that the `term_id` references an EXISTING term — the existence check is delegated to the Postgres FK `data_entity_to_term_term_id_fkey REFERENCES term(id)` (`V0_0_35__add_terms.sql:54`)."
  ]
- audiences: [
    "ODD Platform UI — the Data Entity Overview / Terms panel uses this endpoint to link an existing dictionary term to a data entity. UI gates the button via `WithPermissions permissionTo={Permission.DATA_ENTITY_ADD_TERM}` (`OverviewTerms.tsx:31, 94`), but the SERVER does NOT enforce the gate (see headline finding above).",
    "Any authenticated caller — per the path-mismatch bug, the server falls through to the global `.pathMatchers(\"/**\").authenticated()` rule (`AuthorizationCustomizer.java:29-30`), so any caller with a valid session token under LOGIN_FORM/OAUTH2/LDAP can invoke this endpoint regardless of their assigned Policies."
  ]

## dependencies_semantic

- requires-feature: [
    "dictionary / terms feature — provides the `term` table populated by `POST /api/terms` (TermController.createTerm). This endpoint is the per-data-entity binding leg of the terms model.",
    "data-entity activity feed — `TermAssignmentActivityHandler` emits BEFORE/AFTER terms-list state for `ActivityController.getActivity` consumption (batch-B cross-ref)",
    "data-entity filled-field tracking — `DataEntityFilledService.markEntityFilled(TERMS)` flips the `data_entity_filled.TERMS` flag so the data-entity participates in completeness metrics",
    "authorization / policy framework — `SECURITY_RULES` is the intended gate, but is WIRED TO THE WRONG PATH (singular vs plural); the gate never fires (headline finding). The downstream `DataEntityPermissionExtractor` Policy-resolver pipeline IS implemented (per `createOwnership` sidecar — same wiring for sibling write paths), but unreachable for this endpoint."
  ]
- requires-config: [] — N/A (method reads no config; the SecurityRule registration is unconditional, not `@ConditionalOnProperty`-gated)
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<LinkedTerm>>` return type and `ServerWebExchange exchange` parameter (`DataEntityController.java:150-152`)",
    "jOOQ reactive DB session — `TermRelationsRepositoryImpl.createRelationWithDataEntity` (`TermRelationsRepositoryImpl.java:29-37`), `ReactiveTermRepository.getTermRefDto`",
    "Postgres `data_entity_to_term` table — `(data_entity_id, term_id, is_description_link)` PK + FK to `term(id)` + FK to `data_entity(id)` per `V0_0_35__add_terms.sql:46-56` + `V0_0_77__data_entity_term_description.sql:13-14`"
  ]
- couples-to: [
    "`DataEntityApi.addDataEntityTerm` (generated interface) — supplies `@RequestMapping(method = POST, value = '/api/dataentities/{data_entity_id}/terms')` per `openapi.yaml:973-994`, the `@Valid @RequestBody Mono<DataEntityTermFormData>` constraint, and the OpenAPI-declared 200 response code. The controller `@Override` (`DataEntityController.java:149-156`) inherits the routing.",
    "`TermService.linkTermWithDataEntity(Long termId, Long dataEntityId)` — sole downstream call; the service impl is `@ReactiveTransactional` + `@ActivityLog(TERM_ASSIGNMENT_UPDATED)` (`TermServiceImpl.java:167-179`)",
    "`TermRelationsRepositoryImpl.createRelationWithDataEntity` — INSERT into `data_entity_to_term` with `.onDuplicateKeyIgnore()` (`TermRelationsRepositoryImpl.java:29-37`)",
    "`TermAssignmentActivityHandler` — listens for `TERM_ASSIGNMENT_UPDATED` and stores BEFORE/AFTER state JSON (`TermAssignmentActivityHandler.java:20-61` + `AbstractOwnershipActivityHandler`-equivalent pattern)",
    "`SecurityConstants.SECURITY_RULES[237-239]` — `new SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/dataentities/{data_entity_id}/term\", POST), DATA_ENTITY_ADD_TERM)`. THIS RULE NEVER FIRES because the path is SINGULAR while the real endpoint is PLURAL (headline bug).",
    "`AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:20-31`) — iterates `SECURITY_RULES` and registers `matcher → access(manager(...))` pairs; the no-match fallback is `.pathMatchers(\"/**\").authenticated()` (line 29-30). This is the mechanism that turns the path-mismatch bug into a silent permission bypass."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A
- uncovered_behaviours: [
    "HTTP-level smoke test — no `@WebFluxTest(DataEntityController.class)` or `WebTestClient` test asserts `POST /api/dataentities/{id}/terms` end-to-end.",
    "Service-layer happy-path test — no test exercises `TermServiceImpl.linkTermWithDataEntity` directly; `grep -rln 'linkTermWithDataEntity' <odd-platform-repo>/odd-platform-api/src/test` returns zero matches.",
    "Authorization regression — no test asserts that a caller WITHOUT `DATA_ENTITY_ADD_TERM` should receive 403. The path-mismatch bug (singular vs plural) silently disables the permission check; a regression test along the lines of 'unauthorized user cannot link term to data entity' would catch this bug immediately. THIS IS THE PRIMARY TEST GAP — the absence of a permission test is what allowed the path mismatch to ship undetected.",
    "Auth-mode coverage — no test exercises `DISABLED / LOGIN_FORM / OAUTH2 / LDAP` against this endpoint.",
    "Duplicate-prevention surface — no test asserts the 400 Bad Request 'Term already assigned to data entity' response from `switchIfEmpty(BadUserRequestException)`.",
    "Non-existent term FK behaviour — no test asserts what happens when `term_id` references a non-existent term (the FK `data_entity_to_term_term_id_fkey` fires, surfacing as 5xx DataAccessException rather than 404 Not Found).",
    "Non-existent data-entity FK behaviour — no test asserts behaviour when `dataEntityId` path variable is for a non-existent data-entity (FK violation → 5xx, not 404).",
    "Cross-entity assignment — no test asserts that any caller can link a term owned by namespace A to a data-entity in namespace B; the cross-namespace assignment is unconstrained at the code path (the resolver context that would scope it is unreachable per the path bug).",
    "Description-link coexistence — no test asserts that linking term T to data-entity D when D's description ALREADY mentions `[[namespace:T_name]]` creates two rows (manual + description) rather than one or upserting.",
    "Activity-feed assertion — no test asserts that calling `POST /api/dataentities/{id}/terms` produces a `TERM_ASSIGNMENT_UPDATED` row with correct old/new JSON state."
  ]
- test_files: [] — verified absent: `grep -rln 'addDataEntityTerm\\|linkTermWithDataEntity\\|deleteTermFromDataEntity\\|removeTermFromDataEntity' <odd-platform-repo>/odd-platform-api/src/test` returned zero matches.
- gaps: |
    The headline gap is the absence of ANY authorization regression test for this endpoint. The path-mismatch bug (`SecurityConstants.java:238` registers `/term` singular vs `openapi.yaml:973` `/terms` plural) silently disables the `DATA_ENTITY_ADD_TERM` permission check; a single `WebTestClient` test asserting "a user without DATA_ENTITY_ADD_TERM receives 403" would have caught this on commit. The same bug applies to the DELETE counterpart (`SecurityConstants.java:241` singular vs `openapi.yaml:1042` plural). The result is that ANY authenticated user (LOGIN_FORM / OAUTH2 / LDAP) can link or unlink terms from any data entity across the entire platform, regardless of their Policy set. Beyond authorization, the service path has no test for the duplicate-prevention 400 surface, no test for non-existent term FK behaviour, no test for description-link coexistence, and no test for the activity-event emission. This is TEST-GAP-017 (CRITICAL) verified against primary source.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` (the permissions this endpoint is SUPPOSED to enforce but does not, per the headline finding)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH (re-using the cross-batch fetch from `createOwnership` sidecar 2026-05-12; this batch's WebFetch was unavailable but the live doc was verified ten days earlier on identical content surface)
    fetched_excerpts: |
      Re-using the live-page snapshot fetched 2026-05-12 in the `createOwnership` sidecar's docs_link_semantic block. The page lists all DATA_ENTITY-scoped permissions with one-sentence descriptions; DATA_ENTITY_ADD_TERM and DATA_ENTITY_DELETE_TERM appear by name. The page does NOT describe (a) the SecurityRule wiring (which is the bug surface here), (b) the path that the rule actually matches, or (c) the failure mode when the rule path mismatches the OpenAPI path.
  - url: "https://docs.opendatadiscovery.org/active-platform-features/dictionary"
    anchor: ""
    rationale: "The terms / dictionary feature page is the natural overview for an operator asking 'who can link terms to data entities'."
    last_verified_at: "N/A — WebFetch denied this session"
    last_verified_status: "not-fetched-this-session"
    confidence: LOW (URL inferred from ODD's documentation structure; not verified live this session)
- doc_drift_findings:
  - "The Permissions documentation lists `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` and describes them as 'allows adding/removing terms to/from a data entity'. The CODE WIRING is broken (path mismatch): the SecurityRule registers `/term` singular while OpenAPI declares `/terms` plural, so the permission is never checked. An operator reading the docs and assigning the `DATA_ENTITY_ADD_TERM` permission to a Policy believes the permission gates the endpoint — IT DOES NOT. The docs describe an intended access model that the code fails to enforce. This is the highest-impact doc-vs-code divergence in the term-management surface — the documented Policy-based access control is structurally non-functional for term linking. Cross-ref TEST-GAP-017 (CRITICAL backlog item)."
  - "There is no live-doc page documenting the data-entity term-linking API endpoint at the operator level (no /developer-guides/api-reference equivalent published for `/api/dataentities/{id}/terms`); operators using the UI rely on the UI's `WithPermissions` wrapping (`OverviewTerms.tsx:31, 94`) for visual gating, which is enforced client-side and bypassable by any caller crafting the HTTP request directly. The UI hides the button when the user lacks `DATA_ENTITY_ADD_TERM`, but the SERVER does not enforce the same gate. A determined caller (curl, browser DevTools, custom script) can call the endpoint regardless of UI state."
  - "The activity-event emission (`TERM_ASSIGNMENT_UPDATED` event captured by `TermAssignmentActivityHandler`) appears in `GET /api/activity` but there is no documentation describing the event shape (`TermActivityStateDto = (termId, termName, namespaceName, isDescriptionLink)`) or the BEFORE/AFTER state semantics. Operators auditing 'who added a term to this data entity' see events without a documented schema."

## implicit_adrs

- "Reactive transactional boundary at the service, not the controller — the controller is a thin reactive proxy (`DataEntityController.java:149-156`); the transaction annotation lives on `TermServiceImpl.linkTermWithDataEntity` (`TermServiceImpl.java:168-170`) so the INSERT, the `getTermRefDto` fetch, the `markEntityFilled(TERMS)` mark, and the activity-event emission are all atomic. This is the standard pattern across DataEntityController write methods (consistent with `createOwnership` sidecar's implicit_adrs[2])." — evidence: `DataEntityController.java:149-156` (no `@Transactional`) + `TermServiceImpl.java:167-179` (`@ReactiveTransactional` + `@ActivityLog`) — intent_anchor: "@ReactiveTransactional" (`TermServiceImpl.java:168`) — confidence: HIGH
- "Activity-feed emission on term-assignment mutation — `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` annotates `linkTermWithDataEntity` (`TermServiceImpl.java:169`), explicitly opting this write into the activity stream consumed by `ActivityController.getActivity`. `TermAssignmentActivityHandler` (`TermAssignmentActivityHandler.java:20-61`) captures BEFORE and AFTER terms-list for the data-entity as JSON state (`TermActivityStateDto`). The audit-emission decision is per-write; term-linking IS audited. The intent is that 'who assigned which term to which data entity' is operator-visible." — evidence: `TermServiceImpl.java:169` (`@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)`) + `TermAssignmentActivityHandler.java:23-43` (`isHandle(TERM_ASSIGNMENT_UPDATED)` + state-capture) — intent_anchor: "@ActivityLog(event = ActivityEventTypeDto.TERM_ASSIGNMENT_UPDATED)" (`TermServiceImpl.java:169`) — confidence: HIGH
- "Duplicate-prevention via `onDuplicateKeyIgnore` + `switchIfEmpty` instead of raw constraint violation — `TermRelationsRepositoryImpl.createRelationWithDataEntity` uses `.onDuplicateKeyIgnore()` at the INSERT (`TermRelationsRepositoryImpl.java:33`); when the PK collides the INSERT returns no rows; the service translates the empty-Mono signal via `.switchIfEmpty(Mono.error(BadUserRequestException(\"Term already assigned to data entity\")))` (`TermServiceImpl.java:173-174`) into a graceful 400 Bad Request. This is structurally DIFFERENT from `ownership-create` which uses plain INSERT and surfaces a raw `DataAccessException` as 5xx (cross-ref `createOwnership` sidecar's `bugs_limitations_corner_cases[2]`). The deliberate `BadUserRequestException` choice encodes the intent that 'term already linked' is a 4xx user error, not a 5xx system error." — evidence: `TermRelationsRepositoryImpl.java:33` (`.onDuplicateKeyIgnore()`) + `TermServiceImpl.java:173-174` (`switchIfEmpty(BadUserRequestException)`) + cross-ref `createOwnership` sidecar (the contrast) — intent_anchor: "switchIfEmpty(Mono.error(() -> new BadUserRequestException(\"Term already assigned to data entity\")))" (`TermServiceImpl.java:173-174`) — confidence: HIGH
- "Manual link uses `is_description_link = FALSE` by default; description-link rows are managed separately by the description-parsing pipeline — `createRelationWithDataEntity` does NOT set `IS_DESCRIPTION_LINK` (it defaults to FALSE per `V0_0_77__data_entity_term_description.sql:2`), AND the PK is `(data_entity_id, term_id, is_description_link)` (line 13-14), so manual links and description-link mentions coexist as separate rows. `removeTermFromDataEntity` explicitly filters `IS_DESCRIPTION_LINK.isFalse()` (`TermRelationsRepositoryImpl.java:84`) so a description-linked mention is NOT deletable via this API. The intent is to keep description-driven term inference (via `findTermsInDescription` regex `[[namespace:name]]`) separate from operator-driven explicit assignment." — evidence: `TermRelationsRepositoryImpl.java:29-37` (no IS_DESCRIPTION_LINK assignment in INSERT) + `TermRelationsRepositoryImpl.java:80-88` (DELETE filtered to `IS_DESCRIPTION_LINK.isFalse()`) + `V0_0_77__data_entity_term_description.sql:13-14` (PK includes `is_description_link`) — intent_anchor: ".and(DATA_ENTITY_TO_TERM.IS_DESCRIPTION_LINK.isFalse())" (`TermRelationsRepositoryImpl.java:84` — only delete non-description rows) — confidence: HIGH
- "Per-data-entity authorization VIA SecurityRule registration (DESIGN intent, NOT current behaviour) — `SecurityConstants.SECURITY_RULES[237-239]` declares the INTENT to gate this endpoint with `DATA_ENTITY` resource type + `DATA_ENTITY_ADD_TERM` permission. The DESIGN is per-data-entity authorization via the URL-extractor / Policy-resolver pipeline (same shape as `createOwnership`, `updateStatus`, `createMetadata`, etc.). The CODE BEARS the design intent — the SecurityRule entry exists, the permission enum exists, the UI Permissions enum exports it (`OverviewTerms.tsx:31`). However, the rule's path string is wrong (`/term` singular instead of `/terms` plural per `openapi.yaml:973`), so the design intent is not realised at runtime. This is intent-anchored as an implicit ADR (the intent IS visible in the SecurityRule entry and the UI's Permission wrap) — surfacing the gap-shaped runtime consequence in `bugs_limitations_corner_cases`." — evidence: `SecurityConstants.java:237-239` (SecurityRule registration with `DATA_ENTITY_ADD_TERM`) + `OverviewTerms.tsx:31, 94` (UI gates the button with the same permission) + `PolicyPermissionDto.java:25` (`DATA_ENTITY_ADD_TERM(DATA_ENTITY)` scope declaration) — intent_anchor: "new SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/dataentities/{data_entity_id}/term\", POST), DATA_ENTITY_ADD_TERM)" (`SecurityConstants.java:237-239`) — confidence: HIGH (the intent is clearly authored; the bug is that the path string doesn't match the OpenAPI surface)

## bugs_limitations_corner_cases

- "**HEADLINE: SecurityRule path mismatch silently disables `DATA_ENTITY_ADD_TERM` authorization** — `SecurityConstants.java:237-239` registers a path-pattern rule for `POST /api/dataentities/{data_entity_id}/term` (SINGULAR `term`); the OpenAPI spec at `openapi.yaml:973` declares the actual endpoint as `POST /api/dataentities/{data_entity_id}/terms` (PLURAL `terms`); the controller `@Override` (`DataEntityController.java:149-156`) inherits the plural path from the generated `DataEntityApi`. `AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:24-30`) only invokes the `manager(rule.type(), extractors, permissionService, rule.permission())` permission check when `rule.matcher()` matches the request — the singular `term` matcher does NOT match the plural `terms` path. The customizer's fallback at line 29-30 is `.pathMatchers(\"/**\").authenticated()` — so the request falls through to 'any authenticated user'. Net effect: ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP can `POST /api/dataentities/{id}/terms` and link any term to any data entity, regardless of whether their Policy set includes `DATA_ENTITY_ADD_TERM`. The Permissions documentation (Permissions page, live) states `DATA_ENTITY_ADD_TERM` controls this operation; the documentation is correct about the intent; the CODE WIRING is wrong. Cross-ref `TermAssignmentActivityHandler` still emits the audit event, but `ActivityContextInfo` will reflect the (any) authenticated caller — not the intended principals." — evidence: `SecurityConstants.java:237-239` (`/api/dataentities/{data_entity_id}/term`) + `openapi.yaml:973` (`/api/dataentities/{data_entity_id}/terms`) + `AuthorizationCustomizer.java:24-30` (path-pattern dispatch) + `AuthorizationCustomizer.java:29-30` (fallback to authenticated-only) — severity: HIGH
- "**SAME BUG for delete-term endpoint** — the parallel path-mismatch applies to `deleteTermFromDataEntity`: `SecurityConstants.java:240-242` registers `/api/dataentities/{data_entity_id}/term/{term_id}` (SINGULAR) DELETE → `DATA_ENTITY_DELETE_TERM`; `openapi.yaml:1042` declares `/api/dataentities/{data_entity_id}/terms/{term_id}` (PLURAL). Same `AuthorizationCustomizer` dispatch behaviour — the singular rule never matches, the request falls through to `.authenticated()`. ANY authenticated user can DELETE any term from any data entity. The vulnerability surface is symmetric: link AND unlink are both unauthorized at the server even though the UI gates both via `WithPermissions` (`OverviewTerms.tsx:31` for add, `TermItem.tsx:48` for delete)." — evidence: `SecurityConstants.java:240-242` + `openapi.yaml:1042-1054` (`/api/dataentities/{data_entity_id}/terms/{term_id}` DELETE) + `DataEntityController.java:158-163` (`deleteTermFromDataEntity` method) — severity: HIGH
- "Cross-namespace term assignment is unconstrained — a caller can link a term FROM namespace A to a data-entity IN namespace B without any authorization check on the term itself. The path-mismatch bug above makes this open to any authenticated user, but even if the SecurityRule were wired correctly (singular→plural fix), the `DATA_ENTITY_ADD_TERM` permission only gates which DATA-ENTITIES the caller can modify; it does not gate which TERMS the caller can choose. There is no `TERM_READ` or similar permission applied to the `term_id` form field. Combined with `getTermRefDto` not checking ownership of the term, the resulting model is: 'if you can add terms to this data entity, you can add ANY term that exists in the whole system, including terms owned by other teams / namespaces / tenants'. Operators expecting term-namespace boundaries to provide isolation are misled." — evidence: `TermServiceImpl.java:170-179` (the `linkTermWithDataEntity` body — no term-side permission check) + `TermRelationsRepositoryImpl.java:29-37` (raw INSERT) + `SecurityConstants.java:237-239` (rule scopes to data-entity, not term) — severity: MEDIUM
- "Non-existent term FK surfaces as 5xx, not 404 — `DataEntityTermFormData.term_id` is REQUIRED at the OpenAPI level (`components.yaml:2629-2630`) so a missing or non-Long value is rejected with 400 before reaching the controller. However, there is no validation that the `term_id` references an EXISTING term. `createRelationWithDataEntity` (`TermRelationsRepositoryImpl.java:29-37`) issues a raw INSERT; if the term doesn't exist (or has been deleted), the Postgres FK `data_entity_to_term_term_id_fkey REFERENCES term(id)` (`V0_0_35__add_terms.sql:54`) fires and surfaces as a `DataAccessException` → 5xx via the default WebFlux handler. The same applies to `data_entity_id` (FK to `data_entity(id)`, `V0_0_35__add_terms.sql:55`). A 404 Not Found would be more semantic; the current behaviour leaks a generic 5xx to callers who supplied a stale or invalid id." — evidence: `TermRelationsRepositoryImpl.java:29-37` (no existence pre-check) + `V0_0_35__add_terms.sql:54-55` (FK constraints) + `TermServiceImpl.java:173-178` (no `NotFoundException` translation for non-existent term/data-entity) — severity: LOW
- "Description-linked term cannot be removed via this API — `removeTermFromDataEntity` filters `IS_DESCRIPTION_LINK.isFalse()` in the WHERE clause (`TermRelationsRepositoryImpl.java:84`), so a term that's linked ONLY via description-parsing (`[[namespace:name]]` regex match in the entity description) cannot be detached via the DELETE endpoint. The user must edit the description to remove the `[[…]]` mention; the description-parsing pipeline (`handleDataEntityDescriptionTerms` → `updateDataEntityDescriptionTermsState`) handles description-link row deletion. This is INTENTIONAL (the implicit ADR for description-vs-manual separation) but UNDOCUMENTED — operators surprised that 'delete term' silently does nothing if the only link is via description need to read the source to understand. Pairs with the `is_description_link` PK-coexistence design (`V0_0_77__data_entity_term_description.sql:13-14`)." — evidence: `TermRelationsRepositoryImpl.java:80-88` (WHERE-clause filter for `IS_DESCRIPTION_LINK.isFalse()`) + `TermServiceImpl.java:181-196` (no fallback path for description-link removal) — severity: LOW
- "Under `auth.type=DISABLED`, the endpoint is anonymously reachable — `DisabledAuthSecurityConfiguration.java:11-19` permits all exchanges; combined with the path-mismatch bug above, this endpoint is wide open under DISABLED on a network-reachable port. The activity-feed event still fires but with no authenticated principal. This is the 14th endpoint in the DISABLED-bypass cluster (per session-G batch context); the data-quality / governance surface depends on term linkage, so unauthenticated term-linking corrupts data-entity completeness signals operators rely on. Pairs with the 13-sidecar DISABLED-bypass pattern across batch-A/B/C/E/F." — evidence: `DisabledAuthSecurityConfiguration.java:11-19` (`.anyExchange().permitAll()`) + `SecurityConstants.java:237-239` (the rule is also unreachable under DISABLED) — severity: HIGH (under DISABLED on a network-reachable port; LOW if DISABLED is honestly dev-only)
- "No bulk-link variant — the contract supports one term-link per request (`DataEntityTermFormData.term_id: int64` is scalar, not an array). A user linking N terms to a data entity makes N HTTP calls and N transactions. The UI handles this with N parallel requests; under network latency the user-perceived latency is N × RTT." — evidence: `components.yaml:2623-2630` (`DataEntityTermFormData` has scalar `term_id`) + `DataEntityController.java:150-156` — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` are the modes under which the request reaches authentication. The intended authorization (`DATA_ENTITY_ADD_TERM` via SecurityRule) is BROKEN per the headline finding. Under `DISABLED` the endpoint is anonymously reachable (`DisabledAuthSecurityConfiguration.java:11-19`). `S2S` is not relevant — S2S protects `/ingestion/entities` POST only. The method carries no `@ConditionalOnProperty`.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only (per batch-A class-level sidecar).
- **authorization_assertions**:
  - "INTENDED: `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/term' POST, DATA_ENTITY_ADD_TERM)` — declared in `SecurityConstants.SECURITY_RULES[237-239]`. ACTUAL: not enforced (path mismatch). The rule registers SINGULAR `term`; the real endpoint per OpenAPI / generated controller is PLURAL `terms`. `AuthorizationCustomizer.customize` does not match the rule to the request, so the permission check is never invoked." — evidence: `SecurityConstants.java:237-239` (declared) + `openapi.yaml:973` (real path) + `AuthorizationCustomizer.java:24-30` (dispatch mechanism)
  - "FALLBACK ACTUAL: `.pathMatchers(\"/**\").authenticated()` — `AuthorizationCustomizer.java:29-30`. Any authenticated caller passes; no permission is required for the actual endpoint." — evidence: `AuthorizationCustomizer.java:29-30`
- **owner_scoping**: `BYPASSES — any authenticated user can link any term to any data entity` (per headline bug). The intended scoping was per-data-entity via `DataEntityPermissionExtractor` resolver, but that pipeline is unreachable. Cross-ref intent: `OverviewTerms.tsx:31, 94` (UI shows the wrap-by-permission gate the operator believes is enforced) — `SecurityConstants.java:237-239` (declared SecurityRule intent) vs `openapi.yaml:973` (actual path).
- **data_exposure**:
  - "Term linkage write capability → any authenticated user (LOGIN_FORM / OAUTH2 / LDAP) AND anonymous callers (DISABLED). The endpoint writes the binding row in `data_entity_to_term`, emits an activity event, and marks `data_entity_filled.TERMS` — operators observing `GET /api/activity` for the data-entity see term-assignment events that may have been performed by anyone with API access." — evidence: `SecurityConstants.java:237-239` (broken rule) + `AuthorizationCustomizer.java:29-30` (fallback) + `TermServiceImpl.java:167-179` (the write)
  - "LinkedTerm response payload (id, name, definition, namespace, isDescriptionLink) → caller who just linked the term, regardless of whether the caller would normally have visibility into the term's namespace." — evidence: `DataEntityController.java:150-156` + `TermServiceImpl.java:175-178` + `components.yaml` (`LinkedTerm` schema)
- **known_security_gaps**:
  - "**Path-pattern mismatch silently disables `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` enforcement** — the two SecurityRules at `SecurityConstants.java:237-242` register paths with SINGULAR `/term` and `/term/{term_id}` while the OpenAPI spec at `openapi.yaml:973, 1042` declares PLURAL `/terms` and `/terms/{term_id}`. The mismatch means the permission checks are never evaluated; any authenticated user can link or unlink terms on any data entity regardless of their Policy set. This is the single highest-severity finding on the term-management surface. Mitigation: change the SecurityRule path strings to plural to match the OpenAPI surface; add a `@WebFluxTest` regression that asserts a no-permission user receives 403." — evidence: `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042` + `AuthorizationCustomizer.java:24-30` — severity: HIGH
  - "Term-side authorization is absent even when SecurityRule path is fixed — even with the singular→plural fix, the SecurityRule only scopes to the DATA-ENTITY id; the `term_id` in the request body has no authorization gate. A caller authorized to manage terms on data-entity X can link any term existing in the system to X, including terms in other namespaces, terms owned by other teams. There is no `TERM_READ` or namespace-isolation enforcement. The model assumes that terms are a shared dictionary, but operators with multi-tenant deployments should be aware that the term-id is unscoped." — evidence: `TermServiceImpl.java:170-179` (no term-side permission check) + `PolicyPermissionDto.java:25` (`DATA_ENTITY_ADD_TERM(DATA_ENTITY)` scope is DATA_ENTITY, not TERM) — severity: MEDIUM
  - "UI gates the button via `WithPermissions permissionTo={Permission.DATA_ENTITY_ADD_TERM}` (`OverviewTerms.tsx:31, 94`) — operators believing the UI gate reflects server-side enforcement are misled by the path-mismatch bug. A user who lacks `DATA_ENTITY_ADD_TERM` cannot SEE the 'Add Term' button but CAN call the endpoint directly via DevTools / curl / a custom script. UI gating is necessary but not sufficient; the server-side gate is the authoritative enforcement, and it doesn't fire." — evidence: `OverviewTerms.tsx:31, 94` (`WithPermissions` wrap) + `SecurityConstants.java:237-239` (broken server gate) — severity: HIGH (the UI-vs-server gap is the operator-visible symptom)
  - "Under `auth.type=DISABLED`, the endpoint is anonymously reachable — combined with the path-bug above, anyone with network access can corrupt term linkage and emit fake activity events. The 14th DISABLED-bypass endpoint in the session-G cluster (per session brief)." — evidence: `DisabledAuthSecurityConfiguration.java:11-19` — severity: HIGH (on a network-reachable DISABLED deployment)

## performance

- **hot_paths**: [] — N/A. Term-linkage is an operator-action (user clicks 'Add Term' in the UI Terms panel); not on a per-render hot path.
- **throughput_characteristics**:
  - "Single reactive call — `Mono<ResponseEntity<LinkedTerm>>`; non-blocking I/O; no thread held during DB awaits" — evidence: `DataEntityController.java:150-156`
  - "Per-request DB cost: 1× INSERT into `data_entity_to_term` with `onDuplicateKeyIgnore` (`TermRelationsRepositoryImpl.java:29-37`), 1× SELECT via `getTermRefDto(termId)` (`TermServiceImpl.java:175`), 1× UPDATE on `data_entity_filled` via `markEntityFilled` (`TermServiceImpl.java:177`), PLUS the ActivityLog handler's BEFORE+AFTER terms-list capture per data-entity (`TermAssignmentActivityHandler.java:31-32, 41-43` runs `getStateByDataEntityId(dataEntityId)` twice). Roughly 5-6 DB round-trips per call, all serialized within the `@ReactiveTransactional` boundary." — evidence: `TermServiceImpl.java:167-179` + `TermAssignmentActivityHandler.java:23-50`
  - "No bulk-link variant — `DataEntityTermFormData.term_id` is scalar; N terms = N HTTP calls = N transactions" — evidence: `components.yaml:2623-2630`
- **resource_allocation**:
  - "Per-request allocations are small and bounded — Jackson deserialises a single-field form (`term_id: int64`); the `LinkedTerm` response is small (id + name + definition + namespace)." — evidence: `DataEntityController.java:150-156` + `components.yaml:2623-2630`
  - "Activity-handler `getStateByDataEntityId` loads ALL terms for the data entity into memory (`TermAssignmentActivityHandler.java:45-50` → `termRepository.getDataEntityTerms(dataEntityId).collectList()`) before serializing to JSON, then runs again for the AFTER state. For a data-entity with hundreds of linked terms, the cost is 2× O(N) on every term-assignment call." — evidence: `TermAssignmentActivityHandler.java:45-50`
- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer" — evidence: `DataEntityController.java:149-156` (no instance state)
  - "`@ReactiveTransactional` boundary at the service holds a DB connection from INSERT through the final filled-marker UPDATE (`TermServiceImpl.java:168-179`). Under concurrent load, connection-pool contention scales with request rate × transaction duration; the duration includes the activity-handler's 2× full-list reads." — evidence: `TermServiceImpl.java:168-179` + `TermAssignmentActivityHandler.java:45-50`
  - "Duplicate-prevention contention — the `(data_entity_id, term_id, is_description_link)` PK serialises concurrent inserts of the same triple. `onDuplicateKeyIgnore` makes this graceful (no 5xx, no DataAccessException) at the cost of one wasted INSERT attempt per collision." — evidence: `V0_0_77__data_entity_term_description.sql:13-14` + `TermRelationsRepositoryImpl.java:29-37`
- **known_performance_gaps**:
  - "Activity-handler captures BEFORE+AFTER terms-list by re-querying the full data-entity terms list on every event (`TermAssignmentActivityHandler.java:45-50` runs `getDataEntityTerms` twice). For data-entities with many terms (50+), this adds two full-list queries per term-assignment write. Acceptable for typical term counts but a hidden quadratic-shape cost on extreme cases." — evidence: `TermAssignmentActivityHandler.java:45-50` + `TermAssignmentActivityHandler.java:29-43` — severity: LOW
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry beyond the default WebFlux access log. Operators observing 'who linked terms' rely on the activity feed alone; there is no metric exposing term-link/unlink rates." — evidence: `DataEntityController.java:149-156` + `TermServiceImpl.java:167-179` — severity: LOW

## sources

- understanding ← `DataEntityController.java:149-156` (the four-line method body) + `TermServiceImpl.java:167-179` (downstream service) + `SecurityConstants.java:237-242` (SecurityRule entries) + `openapi.yaml:973` (real path) + `AuthorizationCustomizer.java:24-30` (dispatch mechanism)
- concepts.entities ← `DataEntityController.java:28, 34, 150-152` (`DataEntityTermFormData`, `LinkedTerm` imports + types) + `components.yaml:2623-2630` (`DataEntityTermFormData`) + `V0_0_35__add_terms.sql:46-56` + `V0_0_77__data_entity_term_description.sql:13-14`
- concepts.operations ← `TermServiceImpl.java:167-179` (the transactional shape)
- concepts.invariants[0] ← `TermServiceImpl.java:168-170` (`@ReactiveTransactional` + `@ActivityLog`) + `DataEntityController.java:149-156` (no controller-level transaction)
- concepts.invariants[1] ← `TermRelationsRepositoryImpl.java:29-37` (`.onDuplicateKeyIgnore()`) + `TermServiceImpl.java:173-174` (`switchIfEmpty(BadUserRequestException)`)
- concepts.invariants[2] ← `TermRelationsRepositoryImpl.java:29-37` (no `IS_DESCRIPTION_LINK` set on INSERT) + `V0_0_77__data_entity_term_description.sql:1-14` (column + PK)
- concepts.invariants[3] ← `TermServiceImpl.java:169` (`@ActivityLog(TERM_ASSIGNMENT_UPDATED)`) + `TermAssignmentActivityHandler.java:20-61`
- concepts.invariants[4] ← `components.yaml:2629-2630` (`required: [term_id]`) + `V0_0_35__add_terms.sql:54` (FK)
- concepts.audiences ← `OverviewTerms.tsx:31, 94` (UI gates with `WithPermissions`) + `SecurityConstants.java:237-239` (intended gate) + `AuthorizationCustomizer.java:29-30` (actual fallback)
- dependencies_semantic.requires-feature ← `V0_0_35__add_terms.sql:1-16` (terms feature) + `TermAssignmentActivityHandler.java:20-61` (activity-feed integration) + `TermServiceImpl.java:177` (`markEntityFilled(TERMS)`) + `SecurityConstants.java:237-239`
- dependencies_semantic.requires-runtime[0] ← `DataEntityController.java:64-65, 150-152`
- dependencies_semantic.requires-runtime[1] ← `TermRelationsRepositoryImpl.java:29-37`
- dependencies_semantic.requires-runtime[2] ← `V0_0_35__add_terms.sql:46-56` + `V0_0_77__data_entity_term_description.sql:13-14`
- dependencies_semantic.couples-to[0] ← `DataEntityController.java:9, 70, 149-156` (`DataEntityApi` import, `implements`, `@Override`) + `openapi.yaml:973-994`
- dependencies_semantic.couples-to[1] ← `DataEntityController.java:60, 75, 154` + `TermServiceImpl.java:167-179`
- dependencies_semantic.couples-to[2] ← `TermRelationsRepositoryImpl.java:29-37`
- dependencies_semantic.couples-to[3] ← `TermAssignmentActivityHandler.java:20-61` + `TermServiceImpl.java:169`
- dependencies_semantic.couples-to[4] ← `SecurityConstants.java:237-239` (BROKEN rule)
- dependencies_semantic.couples-to[5] ← `AuthorizationCustomizer.java:20-31` (dispatch + fallback)
- tests_coverage_semantic.uncovered_behaviours ← absence verified by `grep -rln 'addDataEntityTerm\|linkTermWithDataEntity\|deleteTermFromDataEntity\|removeTermFromDataEntity' <odd-platform-repo>/odd-platform-api/src/test` returning zero matches
- docs_link_semantic.inferred_docs[0] ← cross-reference to `createOwnership` sidecar's WebFetch of Permissions page 2026-05-12 status 200
- docs_link_semantic.inferred_docs[1] ← inferred from ODD's published-doc structure (dictionary / terms feature page typically exists); not verified this session (WebFetch denied)
- docs_link_semantic.doc_drift_findings[0] ← `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042` + Permissions live doc (`DATA_ENTITY_ADD_TERM` documented) — the documented intent vs. the broken wiring
- docs_link_semantic.doc_drift_findings[1] ← absence of an operator-facing API-reference page documenting term linkage + `OverviewTerms.tsx:31, 94` (UI gate is client-side only)
- docs_link_semantic.doc_drift_findings[2] ← `TermActivityStateDto` (`TermAssignmentActivityHandler.java:56-60`) + absence in live docs
- implicit_adrs[0] ← `DataEntityController.java:149-156` + `TermServiceImpl.java:168-170`
- implicit_adrs[1] ← `TermServiceImpl.java:169` + `TermAssignmentActivityHandler.java:23-43`
- implicit_adrs[2] ← `TermRelationsRepositoryImpl.java:33` + `TermServiceImpl.java:173-174` + cross-ref `createOwnership` sidecar
- implicit_adrs[3] ← `TermRelationsRepositoryImpl.java:29-37, 80-88` + `V0_0_77__data_entity_term_description.sql:13-14`
- implicit_adrs[4] ← `SecurityConstants.java:237-239` + `OverviewTerms.tsx:31, 94` + `PolicyPermissionDto.java:25`
- bugs_limitations_corner_cases[0] (HEADLINE — path mismatch on POST) ← `SecurityConstants.java:237-239` + `openapi.yaml:973` + `AuthorizationCustomizer.java:24-30, 29-30`
- bugs_limitations_corner_cases[1] (path mismatch on DELETE) ← `SecurityConstants.java:240-242` + `openapi.yaml:1042-1054` + `DataEntityController.java:158-163`
- bugs_limitations_corner_cases[2] (cross-namespace term assignment unconstrained) ← `TermServiceImpl.java:170-179` + `TermRelationsRepositoryImpl.java:29-37` + `SecurityConstants.java:237-239`
- bugs_limitations_corner_cases[3] (non-existent term FK → 5xx) ← `TermRelationsRepositoryImpl.java:29-37` + `V0_0_35__add_terms.sql:54-55` + `TermServiceImpl.java:173-178`
- bugs_limitations_corner_cases[4] (description-linked terms not deletable via API) ← `TermRelationsRepositoryImpl.java:80-88` + `TermServiceImpl.java:181-196`
- bugs_limitations_corner_cases[5] (DISABLED-mode reach) ← `DisabledAuthSecurityConfiguration.java:11-19` + `SecurityConstants.java:237-239`
- bugs_limitations_corner_cases[6] (no bulk-link) ← `components.yaml:2623-2630` + `DataEntityController.java:150-156`
- security.auth_mode_relevance ← `DataEntityController.java:149-156` (no `@ConditionalOnProperty`) + batch-C class-level sidecars
- security.ingestion_filter_relevance ← batch-A `IngestionDataEntitiesFilter` sidecar
- security.authorization_assertions[0] ← `SecurityConstants.java:237-239` + `openapi.yaml:973` + `AuthorizationCustomizer.java:24-30`
- security.authorization_assertions[1] ← `AuthorizationCustomizer.java:29-30`
- security.owner_scoping ← `SecurityConstants.java:237-239` (broken) + `OverviewTerms.tsx:31, 94` (UI intent) + `AuthorizationCustomizer.java:29-30` (actual)
- security.data_exposure[0] ← `SecurityConstants.java:237-239` + `AuthorizationCustomizer.java:29-30` + `TermServiceImpl.java:167-179`
- security.data_exposure[1] ← `DataEntityController.java:150-156` + `TermServiceImpl.java:175-178`
- security.known_security_gaps[0] ← `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042` + `AuthorizationCustomizer.java:24-30`
- security.known_security_gaps[1] ← `TermServiceImpl.java:170-179` + `PolicyPermissionDto.java:25`
- security.known_security_gaps[2] ← `OverviewTerms.tsx:31, 94` + `SecurityConstants.java:237-239`
- security.known_security_gaps[3] ← `DisabledAuthSecurityConfiguration.java:11-19`
- performance.throughput_characteristics[0] ← `DataEntityController.java:150-156`
- performance.throughput_characteristics[1] ← `TermServiceImpl.java:167-179` + `TermAssignmentActivityHandler.java:23-50`
- performance.throughput_characteristics[2] ← `components.yaml:2623-2630`
- performance.resource_allocation[0] ← `DataEntityController.java:150-156` + `components.yaml:2623-2630`
- performance.resource_allocation[1] ← `TermAssignmentActivityHandler.java:45-50`
- performance.scaling_characteristics[0] ← `DataEntityController.java:149-156`
- performance.scaling_characteristics[1] ← `TermServiceImpl.java:168-179` + `TermAssignmentActivityHandler.java:45-50`
- performance.scaling_characteristics[2] ← `V0_0_77__data_entity_term_description.sql:13-14` + `TermRelationsRepositoryImpl.java:29-37`
- performance.known_performance_gaps[0] ← `TermAssignmentActivityHandler.java:45-50` + `TermAssignmentActivityHandler.java:29-43`
- performance.known_performance_gaps[1] ← `DataEntityController.java:149-156` + `TermServiceImpl.java:167-179`

## confidence_per_field

- understanding: HIGH (the path-mismatch bug is verified against four independent primary sources: SecurityConstants.java, openapi.yaml, DataEntityController.java implementing DataEntityApi, and AuthorizationCustomizer.java's dispatch mechanism)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence of `addDataEntityTerm`, `linkTermWithDataEntity`, `deleteTermFromDataEntity`, `removeTermFromDataEntity` test files verified by file search returning zero matches)
- docs_link_semantic: MEDIUM (one URL was previously WebFetched 2026-05-12 in a sibling sidecar; this session's WebFetch was denied; the second URL is inferred without re-fetch)
- implicit_adrs: HIGH (five intent-anchored decisions, each cited at the file:line where the intent annotation / comment / convention is visible)
- bugs_limitations_corner_cases: HIGH (every concern cited file:line against primary source; the headline bug is triangulated from THREE independent sources: SecurityConstants singular path, openapi.yaml plural path, AuthorizationCustomizer fallback mechanism)
- security: HIGH (every claim is structural and traces to SecurityConstants, openapi.yaml, AuthorizationCustomizer, DisabledAuthSecurityConfiguration, the UI Permissions wrap, and PolicyPermissionDto)
- performance: HIGH (the per-request DB round-trip shape is directly visible at the service + activity-handler)

## Maintainer notes

## probe_verifications

<!-- Auto-managed by lineage/_extractor/probe-runtime/runner.py — appended after each layer-5 probe-run that touches this node's contributing-features. Each entry cites a probe-run artefact under lineage/{repo}/probe-runs/. Per dynamic-verification ADR Rule 4. -->

- probe_id: P-005
  probe_run_id: R-20260519T015115Z-P-005
  outcome: PASS
  test_class: security
  feature_id: F-002
  ran_at: 2026-05-19T01:51:15+00:00
  verdict: "all assertions passed"
- probe_id: P-005
  probe_run_id: R-20260519T020317Z-P-005
  outcome: PASS
  test_class: security
  feature_id: F-002
  ran_at: 2026-05-19T02:03:17+00:00
  verdict: "all assertions passed"
- probe_id: P-005
  probe_run_id: R-20260519T020807Z-P-005
  outcome: PASS
  test_class: security
  feature_id: F-002
  ran_at: 2026-05-19T02:08:07+00:00
  verdict: "all assertions passed"
- probe_id: P-005
  probe_run_id: R-20260519T021212Z-P-005
  outcome: PASS
  test_class: security
  feature_id: F-002
  ran_at: 2026-05-19T02:12:12+00:00
  verdict: "all assertions passed"
