---
node_id: "odd-platform java NamespaceController controller-class:NamespaceController"
node_kind: controller-class
axis: controllers
extracted_at_commit: unknown-bash-not-available
enriched_at_commit: unknown-bash-not-available
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-W-NamespaceController
schema_version: v0.3.0
batch: W
---

# NamespaceController — semantic understanding

## understanding

NamespaceController is the thin OpenAPI-generated `@RestController implements NamespaceApi` for the platform's
namespace primitive — the taxonomic scope tag/term/datasource/collector entities attach to. All five endpoints
(create / get / list / update / delete) are proxies that delegate to `NamespaceService` (lines 19, 26, 34, 41,
49, 59). The controller carries NO authorization annotations; the four mutating paths
(POST/PUT/DELETE on `/api/namespaces[...]`) are gated centrally at `SecurityConstants.java:98-108`
(`NAMESPACE_CREATE` for POST, `NAMESPACE_UPDATE` for PUT, `NAMESPACE_DELETE` for DELETE), with NO_CONTEXT
resource extraction (namespace IDs themselves are the resource — no parent-resource context). The list and
detail reads (`/api/namespaces`, `/api/namespaces/{id}`) are NOT in `SECURITY_RULES` — any authenticated
user can enumerate every namespace and fetch any namespace by id, consistent with the platform's
read-collaborative posture (`system-mission.md:267`).

## concepts

- entities: [Namespace, NamespacePojo, NamespaceFormData (name only — single field), NamespaceUpdateFormData (name only), NamespaceList]
- operations: [createNamespace (POST → NAMESPACE_CREATE-gated), getNamespaceDetails (GET → ungated read), getNamespaceList (GET with page/size/query → ungated paginated read), updateNamespace (PUT → NAMESPACE_UPDATE-gated; reactive-transactional service + dual FTS-vector update), deleteNamespace (DELETE → NAMESPACE_DELETE-gated; cascade-guard against 4 referent classes)]
- invariants:
  - "All five endpoints are pass-through `flatMap(service::method).map(ResponseEntity::ok)` proxies — no controller-tier business logic."
  - "Authorization is enforced ONLY at the `/api/namespaces[...]` path; the side-door creation path via `namespaceService.getOrCreate(name)` exposed through 4 OTHER services (TermServiceImpl, DataSourceServiceImpl, CollectorServiceImpl, DataEntityGroupServiceImpl) bypasses `NAMESPACE_CREATE` entirely."
  - "Namespace name uniqueness is DB-enforced via partial unique index `namespace_unique ON namespace (name) WHERE deleted_at IS NULL` (`V0_0_31__add_deleted_at_field.sql:25`); the violation surfaces as a clean HTTP 400 `\"Namespace with this name already exists\"` through `ExceptionUtils.formatMessage` (`ExceptionUtils.java:42-44`)."
  - "Name comparison is CASE-SENSITIVE — Postgres B-tree unique index defaults to byte-equality and `NAMESPACE.NAME.eq(name)` in `ReactiveNamespaceRepositoryImpl.getByName` (`ReactiveNamespaceRepositoryImpl.java:26`) is also case-sensitive. `'finance'` and `'Finance'` are TWO distinct namespaces."
  - "Soft-delete with reincarnation: a deleted namespace name becomes available again (the partial unique index only constrains `WHERE deleted_at IS NULL` rows); recreating `finance` after deletion yields a NEW id with a NEW history."
  - "Cascade-on-delete is application-tier-guarded across exactly 4 referent classes (DataSource, Collector, Term, non-deleted DataEntity), via `Mono.zip` of four `existsByNamespace*` checks (`NamespaceServiceImpl.java:75-87`)."
- audiences: [platform-operator, data-steward-owner, odd-platform-ui-end-user, odd-api-consumer]

## dependencies_semantic

- requires-feature:
  - "`NamespaceService` (constructor-injected at line 19) — the single behaviour anchor; all five methods delegate."
  - "OpenAPI-generated `NamespaceApi` interface (line 18) — defines the method signatures; this controller is the implementation. No `@PreAuthorize` annotations on either side."
  - "Spring Security `SECURITY_RULES` central wiring (`SecurityConstants.java:98-108`) — the OUT-OF-BAND authorization layer for the mutation paths. The controller is unaware of this; removing the rules from `SecurityConstants` opens the endpoints with no controller-level fail-safe."
  - "OpenAPI `validation` chain — `@Valid` on `Mono<NamespaceFormData>` (lines 23, 55) enforces the OpenAPI required-field check (`NamespaceFormData.name` is `required: true` per `components.yaml:262-268`). No length cap, no regex, no allowlist — `varchar(64)` is the only DB-side cap (`V0_0_1__init.sql:13`)."
- requires-config: []
- requires-runtime:
  - "Spring WebFlux reactive runtime — every method returns `Mono<ResponseEntity<...>>`."
  - "PostgreSQL — namespace storage; partial unique index + soft-delete pattern depend on PG features."
  - "jOOQ + `ReactiveAbstractSoftDeleteCRUDRepository` — repository inheritance chain delivers the `deleted_at IS NULL` filter automatically."

## tests_coverage_semantic

- covered_behaviours:
  - "`get(id)` returns the namespace pojo + maps via NamespaceMapper (NamespaceServiceImplTest.java:73-99)."
  - "`get(id)` of nonexistent id raises NotFoundException (NamespaceServiceImplTest.java:101-112)."
  - "`create(form)` happy path — calls mapForm → repository.create → mapPojo (NamespaceServiceImplTest.java:114-144)."
  - "`update(id, form)` happy path including dual FTS-vector update via `searchEntrypointRepository.updateChangedNamespaceVector` + `termSearchEntrypointRepository.updateChangedNamespaceVector` (NamespaceServiceImplTest.java:146-189)."
  - "`update` of nonexistent id raises NotFoundException (NamespaceServiceImplTest.java:191-208)."
  - "`delete(id)` happy path — all 4 existsByNamespace checks return false; repository.delete invoked (NamespaceServiceImplTest.java:210-235)."
  - "`delete(id)` blocked by existing collector — raises CascadeDeleteException, delete NOT invoked (NamespaceServiceImplTest.java:237-256)."
  - "`delete(id)` blocked by existing data source — raises CascadeDeleteException (NamespaceServiceImplTest.java:258-277)."
  - "`delete(id)` blocked by existing term — raises CascadeDeleteException (NamespaceServiceImplTest.java:279-298)."
  - "`delete(id)` blocked by existing non-deleted data entity — raises CascadeDeleteException (NamespaceServiceImplTest.java:300-319)."
- uncovered_behaviours:
  - "Controller-tier integration test asserting `NAMESPACE_CREATE` is required to POST `/api/namespaces` — the central `SECURITY_RULES` wiring is not pinned by an end-to-end test."
  - "Side-door regression test: a user holding TERM_CREATE / DATA_SOURCE_CREATE / COLLECTOR_CREATE / DATA_ENTITY_GROUP_CREATE but NOT NAMESPACE_CREATE can create a namespace by submitting a never-seen `namespaceName` in the parent form (the bypass behaviour is captured in `concepts/detail/invariants/namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths.yaml` but no test pins the cross-pillar surface)."
  - "Case-sensitivity assertion: creating `finance` then `Finance` succeeds and returns two distinct namespace IDs."
  - "Soft-delete reincarnation: deleting `finance`, then `create({name: 'finance'})` succeeds and returns a NEW id (the old row's `deleted_at IS NOT NULL` excludes it from the unique-index scope)."
  - "Concurrent `create({name: 'X'})` race — two parallel requests with the same name; one resolves with the row, one resolves with UniqueConstraintException → HTTP 400. Pin the behaviour."
  - "TOCTOU class — concurrent `delete(id)` with concurrent `dataSourceService.create(...)` registering a new datasource against `namespace_id=id` between the `existsByNamespace` zip-check and the `namespaceRepository.delete(id)` call. The check + write are NOT in a single SELECT FOR UPDATE on the namespace row. Sibling to ReactiveTagRepositoryImpl batch-N TOCTOU class."
  - "Validation: oversize (>64-char) namespace name — DB rejects on insert with a SQL exception. Does the response surface as `UniqueConstraintException` (no, this is a check_constraint not unique-index), as `DatabaseException` (500), or via OpenAPI validation? Pin the error shape."
  - "Authorization assertion: an authenticated user with NO permissions can call `GET /api/namespaces` (list) and `GET /api/namespaces/{id}` (details). Pin the read-collaborative posture."
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/NamespaceServiceImplTest.java:1-320 — service-tier mock-based; controller-tier integration test absent."
- gaps: |
    The existing test suite covers the service-layer happy paths + the cascade-on-delete guard
    EXHAUSTIVELY (one test per blocker class). The major regression risk lies OUTSIDE the file:
    (a) the cross-pillar side-door from 4 sister services that bypass NAMESPACE_CREATE; (b) the
    central SECURITY_RULES wiring that the controller depends on but doesn't assert; (c) the
    TOCTOU race between cascade-check and concurrent referent-row insertion. None of these would
    be caught by NamespaceServiceImplTest. A `NamespaceControllerIntegrationTest` exercising
    `WebTestClient` against the live SECURITY_RULES chain + a `CrossPillarNamespaceSideDoorTest`
    asserting the bypass behaviour from TermController / DataSourceController / CollectorController /
    DataEntityGroupController would close the highest-risk gaps.

## docs_link_semantic

- declared_docs: []   # no @docs annotation in NamespaceController.java
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: "Namespaces row in the Management-tabs table"
    rationale: "Per system-mission.md Pillar P-08 (Management & Administration), Namespaces is the first Management tab. Live-fetched 2026-05-20."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Tab: 'Namespaces | Path: /management/namespaces | What it manages: Logical groupings
      used to scope tags, terms, and other taxonomy concepts. Acts as a label dimension applied
      across the catalog.'
      Typical workflow: 'Create a namespace before authoring tags or terms that should be
      scoped to a particular team or domain.'
      First-deployment sequencing: 'Namespaces — create the logical groups (per team, per
      domain) you'll scope tagging and term curation to.'
  - url: "https://docs.opendatadiscovery.org/features/management/namespaces"
    anchor: ""
    rationale: "Conventional dedicated sub-page URL inferred from the SUMMARY pattern observed for other Management surfaces. Live-fetched 2026-05-20 — returned 404."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      'The URL features/management/namespaces returns a 404 error — this page does not exist
      in the documentation.'
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Per system-mission.md Pillar P-09, the authorization model (Policies × Permissions × Roles × Owners) is documented here. Expected to enumerate NAMESPACE_CREATE / NAMESPACE_UPDATE / NAMESPACE_DELETE — but does NOT (live-fetched 2026-05-20). The page only gives a high-level overview pointing to JSON Schema; the permission catalog is not on the page."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      'I cannot find any information about namespace permissions (NAMESPACE_CREATE /
      NAMESPACE_UPDATE / NAMESPACE_DELETE) or details about resources that namespace-aware
      policies can be scoped to. The current page only provides a high-level overview...'
- doc_drift_findings:
  - "The docs claim namespaces 'scope tags, terms, and other taxonomy concepts' (live `/features/management` 2026-05-20). The IMPLEMENTATION binds namespace_id to data_source / collector / term / data_entity / lookup_tables (V0_0_11, V0_0_29, V0_0_35, V0_0_86 migrations) — datasources and collectors are NOT 'taxonomy concepts'. The doc framing under-describes the binding surface."
  - "The docs claim 'Create a namespace before authoring tags or terms that should be scoped to a particular team or domain' — implying namespace creation is a deliberate operator step. The CODE allows side-door namespace creation via `TermServiceImpl.createTerm/updateTerm`, `DataSourceServiceImpl.createDataSource/updateDataSource`, `CollectorServiceImpl.create/update`, and `DataEntityGroupServiceImpl.createDataEntityGroup/updateDEG` (4 sister services, 8 call sites; evidence in dependencies_semantic). An operator authoring an RBAC policy that withholds NAMESPACE_CREATE expects this guidance — the code contradicts it."
  - "No dedicated /features/management/namespaces page exists (404 confirmed 2026-05-20). The page would be the natural home for: deletion guards (4 referent classes), case-sensitivity, soft-delete reincarnation, the partial-unique-index semantic, the RBAC permission triad, and the side-door warning. DOC-NNN candidate."
  - "The authorization page does NOT enumerate NAMESPACE_CREATE / NAMESPACE_UPDATE / NAMESPACE_DELETE (confirmed live-fetch 2026-05-20). The platform permission catalog is opaque to operators authoring policies."

## implicit_adrs

- "Authorization for the namespace mutation surface is wired CENTRALLY at `SecurityConstants.java:98-108`, NOT on the controller — the controller is intentionally an OpenAPI-passthrough." — evidence: NamespaceController.java:1-62 (no `@PreAuthorize`, no programmatic auth check) + SecurityConstants.java:98-108 (PathPatternParserServerWebExchangeMatcher rules wired to the three NAMESPACE_* permissions) — intent_anchor: "the structural pattern across the platform's controllers (centralised SECURITY_RULES list) is the platform-wide convention applied consistently — this controller's compliance is the convention's enactment." — confidence: HIGH

- "Reads are intentionally ungated (read-collaborative posture)." — evidence: SecurityConstants.java:98-108 (only POST/PUT/DELETE namespace rules exist; no GET rule) + NamespaceController.java:29-35 (getNamespaceDetails) + lines 44-50 (getNamespaceList) — intent_anchor: "system-mission.md line 267 states the platform-wide implicit ADR verbatim: 'Read-collaborative posture (REFACTOR-024, REFACTOR-203, REFACTOR-201 across batches D/F/H/I) is a load-bearing implicit ADR — every authenticated user can enumerate the entire catalog.' The pattern is platform-wide and applied here." — confidence: HIGH

- "Cascade-on-delete is APPLICATION-tier-guarded (NOT FK-cascade-DB-tier) across exactly 4 referent classes." — evidence: NamespaceServiceImpl.java:73-90 (Mono.zip of 4 existsByNamespace* checks → CascadeDeleteException if any returns true) + V0_0_1__init.sql:84 (`CONSTRAINT data_entity_fk_namespace FOREIGN KEY ... REFERENCES namespace(id)` with NO ON DELETE clause) + V0_0_11__add_namespace_support.sql:1-2 (data_source FK with no ON DELETE clause) + V0_0_29__add_collector.sql:14 (collector FK, no ON DELETE) + V0_0_35__add_terms.sql:12 (term FK, no ON DELETE) — intent_anchor: "throw new CascadeDeleteException(\"Namespace cannot be deleted: there are still resources attached\")" — confidence: HIGH

- "Name uniqueness is enforced via PARTIAL unique index keyed on `(name) WHERE deleted_at IS NULL`, enabling soft-delete reincarnation." — evidence: V0_0_31__add_deleted_at_field.sql:25 (`CREATE UNIQUE INDEX IF NOT EXISTS namespace_unique ON namespace (name) WHERE deleted_at IS NULL`) + ExceptionUtils.java:42-44 (the index-name string match in `formatMessage` returning the operator-friendly 400 message) — intent_anchor: "the partial-index syntax `WHERE deleted_at IS NULL` is a DELIBERATE pattern repeated across data_source_name_unique / collector_name_unique / data_source_oddrn_unique (same migration lines 27, 29, 31). The pattern explicitly enables 'delete then recreate' semantics." — confidence: HIGH

- "Name validation is INTENTIONALLY minimal — varchar(64), no regex, no allowlist, no case-folding." — evidence: V0_0_1__init.sql:13 (`name varchar(64),` — no CHECK constraint) + NamespaceMapper.java:1-29 (no validation hooks) + components.yaml:262-268 (NamespaceFormData OpenAPI schema has only `name: string, required: true` — no `pattern`, no `minLength`/`maxLength`) — intent_anchor: "the consistency across owner / tag / label / data_source name columns (all varchar(64) or varchar(255), all without CHECK constraints in V0_0_1__init.sql) shows the platform-wide pattern: rely on DB type-cap + unique-index, no app-tier validation." — confidence: HIGH

- "Search-index materialisation on update is DUAL-vector — namespace updates trigger FTS refresh on BOTH data-entity search and term search." — evidence: NamespaceServiceImpl.java:62-71 (update method) + lines 92-97 (`updateSearchVectors`: `Mono.zip(searchEntrypointRepository.updateChangedNamespaceVector(id), termSearchEntrypointRepository.updateChangedNamespaceVector(id))`) — intent_anchor: "the maintainer chose `Mono.zip` (parallel execution) and TWO distinct repositories — the dual-vector pattern is explicit, not accidental. It encodes the invariant that namespace name appears in BOTH the data-entity FTS-vector AND the term FTS-vector." — confidence: HIGH

## bugs_limitations_corner_cases

- "**HIGH — `NAMESPACE_CREATE` is bypassed by 4 sister services via the platform's `getOrCreate` side-door pattern.** A caller holding TERM_CREATE / TERM_UPDATE / DATA_SOURCE_CREATE / DATA_SOURCE_UPDATE / COLLECTOR_CREATE / COLLECTOR_UPDATE / DATA_ENTITY_GROUP_CREATE / DATA_ENTITY_GROUP_UPDATE can submit a parent form with a NEVER-SEEN `namespaceName` and silently create that namespace. The dedicated `NAMESPACE_CREATE` permission (the gate on POST /api/namespaces this controller defends) is NEVER consulted on these paths. Call sites: TermServiceImpl.java:103, 138 (createTerm + updateTerm); DataSourceServiceImpl.java:57, 75; CollectorServiceImpl.java:43, 57; DataEntityGroupServiceImpl.java:65, 84. Documented in `concepts/detail/invariants/namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths.yaml`." — evidence: NamespaceController.java:1-62 (the controller defending POST /api/namespaces) + TermServiceImpl.java:103, 138 + DataSourceServiceImpl.java:57, 75 + CollectorServiceImpl.java:43, 57 + DataEntityGroupServiceImpl.java:65, 84 + SecurityConstants.java:98-108 (the rules only cover `/api/namespaces` paths) — severity: HIGH

- "**MEDIUM — TOCTOU class between cascade-check and concurrent referent insert.** `NamespaceServiceImpl.delete` (lines 73-90) runs the 4 `existsByNamespace*` checks in parallel via `Mono.zip`, then filters on `!exists`, then invokes `namespaceRepository.delete(id)`. The check + delete are NOT inside a single SELECT FOR UPDATE on the namespace row, nor inside any explicit `@ReactiveTransactional`. Between the zip-check and the soft-delete UPDATE, a concurrent `dataSourceService.createDataSource(...)` could insert a new data_source row with `namespace_id = id` — the delete proceeds, the new datasource references a soft-deleted namespace. Sibling pattern to `ReactiveTagRepositoryImpl` TOCTOU (batch N)." — evidence: NamespaceServiceImpl.java:73-90 (no `@ReactiveTransactional`, no SELECT FOR UPDATE, no advisory-lock) + V0_0_1__init.sql:84 (FK without ON DELETE — orphan-row possibility is real) — severity: MEDIUM

- "**MEDIUM — Case-sensitivity is undocumented and operator-surprising.** `ReactiveNamespaceRepositoryImpl.getByName` uses `NAMESPACE.NAME.eq(name)` (line 26 — case-sensitive byte-equality) and the unique index `namespace_unique` is over `(name)` with no case-folding (V0_0_31:25). An operator creating `finance` and `Finance` gets TWO distinct namespaces — but the docs treat namespace names as natural identifiers ('Create a namespace before authoring tags or terms that should be scoped to a particular team or domain' — live `/features/management` 2026-05-20). No case-fold normalisation at controller, mapper, or repository tier." — evidence: ReactiveNamespaceRepositoryImpl.java:26 + V0_0_31__add_deleted_at_field.sql:25 + NamespaceMapper.java:1-29 (no normalisation hook) — severity: MEDIUM

- "**MEDIUM — Name has no length validation at the application or OpenAPI tier; only DB-tier `varchar(64)` enforces a cap.** `NamespaceFormData.name` per `components.yaml:262-268` is `type: string, required: true` — no `minLength`, no `maxLength`, no `pattern`. A 65-character name reaches the DB, fails with `value too long for type character varying(64)`, surfaces as `DatabaseException` → HTTP 500 (NOT the clean 400 the unique-constraint path enjoys via `ExceptionUtils.formatMessage`). Operator-facing error is opaque." — evidence: V0_0_1__init.sql:13 + components.yaml:262-268 + NamespaceController.java:23 + ExceptionUtils.java:30-36 (only `C23_INTEGRITY_CONSTRAINT_VIOLATION` is translated; check-constraint / value-too-long is `DatabaseException` per line 35) — severity: MEDIUM

- "**LOW — Soft-delete reincarnation is undocumented.** Deleting a namespace marks `deleted_at = NOW()` (via `ReactiveAbstractSoftDeleteCRUDRepository.delete:50-59`); the partial unique index excludes that row. A subsequent create-by-same-name succeeds and yields a NEW namespace id with NEW history. Any operator-side bookmarks / external references using the old id break silently; tag / term assignments to the soft-deleted namespace persist in the DB but are filtered out of all reads. No doc-side mention of this lifecycle." — evidence: ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + V0_0_31__add_deleted_at_field.sql:25 — severity: LOW

- "**LOW — `updateNamespace` is `@ReactiveTransactional` but `delete` is not.** The update path (`NamespaceServiceImpl.java:62-71`) explicitly annotates `@ReactiveTransactional`; the delete path (lines 73-90) is NOT annotated. Without an explicit transaction the cascade-check + delete UPDATE can interleave with other DB writes; if `namespaceRepository.delete(id)` partially fails (network blip mid-UPDATE), the namespace stays as `deleted_at = NULL` and the operator's UI shows it as still-present — no compensating action. The asymmetry between update (transactional) and delete (not transactional) is unintentional-looking." — evidence: NamespaceServiceImpl.java:62-71 (`@ReactiveTransactional`) vs lines 73-90 (no annotation) — severity: LOW

- "**LOW — `getNamespaceList` accepts an unlimited `size` parameter — no pagination cap at the controller or service tier.** `NamespaceController.getNamespaceList` (lines 44-50) passes `size` directly to `namespaceService.list(page, size, query)`. An attacker (or naive admin client) requesting `size=100000` performs an unbounded scan. Consistent with the platform-wide pagination posture (no cap-on-page-size at controller layer); cross-link to similar bugs at AlertController / DataEntityController." — evidence: NamespaceController.java:44-50 — severity: LOW

## security

- **auth_mode_relevance**: LOGIN_FORM | OAUTH2 | LDAP — the controller's mutation rules apply under any active authenticated UI mode (the SECURITY_RULES list in SecurityConstants is shared across auth modes via `SecurityConfig` wiring). Under DISABLED mode, the SECURITY_RULES still evaluate but `@AnonymousAuthenticationToken` is the principal — operators running DISABLED for dev should know all five endpoints are reachable. S2S: NOT_APPLICABLE — this is a UI/API path, not ingestion; the S2S token grants ADMIN per system-mission.md Pillar P-09 so an S2S caller bypasses NAMESPACE_CREATE / NAMESPACE_DELETE entirely.
- **ingestion_filter_relevance**: NO — UI/API surface (`/api/namespaces`), not ingestion. The IngestionDataEntitiesFilter matches only `/ingestion/entities`.
- **authorization_assertions**:
  - "POST /api/namespaces → NAMESPACE_CREATE (NO_CONTEXT — namespace_id is the resource being created, no parent-resource context to extract)" — evidence: SecurityConstants.java:98-102
  - "PUT /api/namespaces/{namespace_id} → NAMESPACE_UPDATE (NO_CONTEXT)" — evidence: SecurityConstants.java:103-105
  - "DELETE /api/namespaces/{namespace_id} → NAMESPACE_DELETE (NO_CONTEXT)" — evidence: SecurityConstants.java:106-108
  - "GET /api/namespaces → NO RULE (ungated; any authenticated user)" — evidence: SecurityConstants.java:98-108 (no GET rule for namespaces in the list)
  - "GET /api/namespaces/{namespace_id} → NO RULE (ungated)" — evidence: SecurityConstants.java:98-108
- **owner_scoping**: N/A — namespaces are not owner-scoped data; they are taxonomy primitives. The read-collaborative posture's "every authenticated user enumerates all" applies here without qualification.
- **data_exposure**:
  - "Namespace payload (id, name) → any authenticated user via GET /api/namespaces (list) and GET /api/namespaces/{id} (details). NO owner filter, NO namespace-scoping at the controller layer (namespaces ARE the scoping primitive; they don't have their own owner)."
  - "List endpoint accepts `query` (substring search per ReactiveAbstractCRUDRepository pagination) — an attacker can enumerate via prefix scans. Stage one of cross-tenant reconnaissance."
- **known_security_gaps**:
  - "**HIGH** — NAMESPACE_CREATE side-door via 4 sister services (TermServiceImpl, DataSourceServiceImpl, CollectorServiceImpl, DataEntityGroupServiceImpl) — see bugs_limitations_corner_cases entry [1]. The MOST IMPORTANT finding for operators authoring RBAC policies; the dedicated NAMESPACE_CREATE permission the controller defends is silently bypassable from 4 other entry points the same RBAC policy may grant generously." — evidence: NamespaceController.java + TermServiceImpl.java:103, 138 + DataSourceServiceImpl.java:57, 75 + CollectorServiceImpl.java:43, 57 + DataEntityGroupServiceImpl.java:65, 84 — severity: HIGH
  - "**MEDIUM** — namespace LIST + DETAILS reads (`GET /api/namespaces`, `GET /api/namespaces/{id}`) are ungated; any authenticated user enumerates every namespace. Read-collaborative posture per system-mission.md:267 — INTENTIONAL ADR, but undocumented in operator-facing docs. Cross-link REFACTOR-024." — evidence: SecurityConstants.java:98-108 (no GET rule) + NamespaceController.java:29-50 — severity: MEDIUM
  - "**LOW** — DISABLED auth mode + the absence of fail-closed defaults: under `auth.type=DISABLED`, all five endpoints (including the three mutations) are reachable by anonymous principals. DISABLED is doc-marked dev-only per system-mission.md Pillar P-09; operators running DISABLED in production have effectively no namespace protection." — evidence: SecurityConstants.java:98-108 (rules apply per-mode; DISABLED mode short-circuits authentication so the security rules' principal is anonymous) — severity: LOW
  - "**LOW** — namespace NAME accepts arbitrary strings (`varchar(64)`, no regex, no allowlist). An operator-supplied namespace name containing path-encoded characters (`finance/sub`, `finance%2Fsub`), HTML / script injection (`<script>alert(1)</script>`), or unicode confusables (`fіnance` with Cyrillic 'і') is accepted. UI consumers (NamespaceList.tsx, NamespaceForm.tsx, NamespaceAutocomplete.tsx) must escape on render — and the namespace name appears in URL paths in some flows (`/api/terms/namespaces/{namespace_name}/names/{term_name}` per openapi.yaml:2818) where path-encoding inconsistencies could surface as 404 vs match." — evidence: V0_0_1__init.sql:13 + components.yaml:262-268 + openapi.yaml:2818 (the namespace_name URL path parameter on TermApi) — severity: LOW

## performance

- **hot_paths**:
  - "`getNamespaceList` is invoked on every Management → Namespaces tab render + every NamespaceAutocomplete render (forms across the platform reference namespace via this endpoint). No caching, no in-memory dictionary — every render is a DB round-trip. The list is small (typically <100 namespaces) so the absolute cost is modest, but the call frequency is high." — evidence: NamespaceController.java:44-50 + UI references in NamespaceAutocomplete.tsx + ManagementRoutes.ts
- **throughput_characteristics**:
  - "Single-item CRUD per request — no bulk endpoint. Bulk operations (e.g., 'import 50 namespaces from a CSV') must be N HTTP calls. Update has a heavier write profile (UPDATE + 2 FTS-vector refreshes) than create (INSERT only)."
  - "Reactive `Mono` signatures — non-blocking at the WebFlux layer; each call is one DB round-trip for read paths, 3 round-trips for create (INSERT + ID lookup + map), 4 round-trips for update (SELECT + UPDATE + 2 FTS UPDATEs), 5 round-trips for delete (4 existsByNamespace zip + DELETE)."
- **resource_allocation**:
  - "No request-body size cap at the controller — `@Valid Mono<NamespaceFormData>` accepts whatever WebFlux parses (default `spring.codec.max-in-memory-size = 20MB` per the platform-wide application.yml). A 20MB malformed JSON request to POST /api/namespaces is parsed before validation."
  - "No connection-pool exhaustion concern under normal traffic — namespace endpoints are low-volume relative to ingestion."
- **scaling_characteristics**:
  - "Stateless controller — horizontal-scale safe."
  - "No advisory-lock, no leader-election — namespace mutations execute on whatever instance receives the request. The TOCTOU class in delete (bugs_limitations_corner_cases.[2]) is amplified at scale: multiple instances + concurrent referent inserts make the race more reachable."
  - "List endpoint has pagination via `page` + `size` query params, but NO server-side cap on `size` (see bugs_limitations_corner_cases.[7]). At catalog-list scale this is benign; at autocomplete scale it's the maintainer's preferred client-side cap."
- **known_performance_gaps**:
  - "**LOW** — `getNamespaceList` has no server-side `size` cap; a `size=100000` query performs an unbounded scan. Severity LOW because namespace count is bounded operationally, but the pattern is platform-wide and worth pinning." — evidence: NamespaceController.java:44-50 — severity: LOW
  - "**LOW** — update path is `@ReactiveTransactional` so the 2 FTS-vector UPDATEs serialise behind the namespace row UPDATE; on a busy platform with millions of data_entities + terms, the FTS refresh can be slow (the `searchEntrypointRepository.updateChangedNamespaceVector` touches every data_entity-search-vector row that joins through this namespace; similar for terms). No async-queue offload." — evidence: NamespaceServiceImpl.java:62-71 + 92-97 — severity: LOW

## sources

- understanding ← NamespaceController.java:1-62
- concepts.entities ← NamespaceController.java:5-9 (imports) + components.yaml:237-276 (schemas)
- concepts.operations ← NamespaceController.java:21-61 (the 5 method bodies)
- concepts.invariants.[1] ← NamespaceController.java:1-62 (no `@PreAuthorize`, no `@PreFilter`, no programmatic check)
- concepts.invariants.[2] ← SecurityConstants.java:98-108 + TermServiceImpl.java:103, 138 + DataSourceServiceImpl.java:57, 75 + CollectorServiceImpl.java:43, 57 + DataEntityGroupServiceImpl.java:65, 84
- concepts.invariants.[3] ← V0_0_31__add_deleted_at_field.sql:25 + ExceptionUtils.java:42-44
- concepts.invariants.[4] ← ReactiveNamespaceRepositoryImpl.java:26 + V0_0_31__add_deleted_at_field.sql:25
- concepts.invariants.[5] ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + V0_0_31__add_deleted_at_field.sql:25
- concepts.invariants.[6] ← NamespaceServiceImpl.java:73-90 + V0_0_1__init.sql:84 + V0_0_11__add_namespace_support.sql:1-2 + V0_0_29__add_collector.sql:14 + V0_0_35__add_terms.sql:12
- dependencies_semantic.requires-feature.[*] ← NamespaceController.java:5-19 + SecurityConstants.java:98-108 + components.yaml:262-268
- tests_coverage_semantic.covered_behaviours ← NamespaceServiceImplTest.java:73-319
- tests_coverage_semantic.test_files ← NamespaceServiceImplTest.java:1-320
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/management 2026-05-20 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/management/namespaces 2026-05-20 status 404
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings.[1] ← live-doc-fetch + 4-sister-service side-door evidence aggregated above
- implicit_adrs.[0] ← NamespaceController.java:1-62 (no annotations) + SecurityConstants.java:98-108
- implicit_adrs.[1] ← SecurityConstants.java:98-108 (no GET rule) + NamespaceController.java:29-50 + system-mission.md:267
- implicit_adrs.[2] ← NamespaceServiceImpl.java:73-90 + 4 schema-side FK definitions (V0_0_1:84, V0_0_11:1-2, V0_0_29:14, V0_0_35:12)
- implicit_adrs.[3] ← V0_0_31__add_deleted_at_field.sql:25 + ExceptionUtils.java:42-44
- implicit_adrs.[4] ← V0_0_1__init.sql:13 + components.yaml:262-268 + NamespaceMapper.java:1-29
- implicit_adrs.[5] ← NamespaceServiceImpl.java:62-71 + 92-97
- bugs_limitations_corner_cases.[1 — HIGH side-door] ← NamespaceController.java:1-62 + 4 sister services + SecurityConstants.java:98-108 + concepts/detail/invariants/namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths.yaml
- bugs_limitations_corner_cases.[2 — MEDIUM TOCTOU] ← NamespaceServiceImpl.java:73-90
- bugs_limitations_corner_cases.[3 — MEDIUM case-sensitivity] ← ReactiveNamespaceRepositoryImpl.java:26 + V0_0_31:25 + WebFetch /features/management 2026-05-20
- bugs_limitations_corner_cases.[4 — MEDIUM no length validation] ← V0_0_1__init.sql:13 + components.yaml:262-268 + ExceptionUtils.java:30-36
- bugs_limitations_corner_cases.[5 — LOW reincarnation] ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- bugs_limitations_corner_cases.[6 — LOW transactional asymmetry] ← NamespaceServiceImpl.java:62-71 vs 73-90
- bugs_limitations_corner_cases.[7 — LOW unbounded page-size] ← NamespaceController.java:44-50
- security.auth_mode_relevance ← SecurityConstants.java:98-108 + system-mission.md Pillar P-09
- security.authorization_assertions ← SecurityConstants.java:98-108
- security.data_exposure ← NamespaceController.java:29-50 + SecurityConstants.java:98-108
- security.known_security_gaps.[1 HIGH] ← NamespaceController.java + 4 sister services + SecurityConstants
- security.known_security_gaps.[2 MEDIUM] ← SecurityConstants.java:98-108 + system-mission.md:267
- performance.hot_paths ← NamespaceController.java:44-50 + UI references
- performance.scaling_characteristics ← NamespaceServiceImpl.java:73-90 (no advisory-lock)
- performance.known_performance_gaps ← NamespaceController.java:44-50 + NamespaceServiceImpl.java:62-71+92-97

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (file-local signals are clear; aggregate scale-out behaviour depends on cross-instance + concurrency considerations not statically determinable)

## back_links

- features: [F-008 (Batch Ingestion — namespace_inherited_from_collector ADR-143 candidate; the namespace this controller manages is the same primitive the ingestion path inherits-from-collector), F-002 (cross-namespace term pollution — namespace's bound role in term scoping is violated upstream of this controller)]
- pillars: [P-08 (Management & Administration — Namespaces is the first tab; this controller is its API anchor), P-09 (Security & Access Control — NAMESPACE_CREATE / NAMESPACE_UPDATE / NAMESPACE_DELETE permission triad), P-06 (Data Glossary — namespace is the term's scope primitive; TermServiceImpl side-doors NAMESPACE_CREATE from this pillar)]
- concepts: [namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths (master invariant — HIGH severity cross-pillar pattern), spec-documented-auto-create-with-scope-asymmetry-tag-side-door-past-tag-create (sister invariant), permission-bypass-via-owner-auto-create-side-door-write-path (sister invariant — OwnerController class), read-collaborative-posture (platform-wide implicit ADR — this controller's ungated reads enact it)]
- test-gaps: [TEST-GAP-726 (Term-side door pinning the same architectural class), TEST-GAP-021 (sister DataEntity tag-create side-door)]
- adrs: [ADR-143 candidate (namespace_inherited_from_collector_payload_silently_dropped per F-008 — the F-008 service-tier enactment); REFACTOR-024 (cross-owner enumeration — siblings to this controller's ungated reads)]

## Maintainer notes
