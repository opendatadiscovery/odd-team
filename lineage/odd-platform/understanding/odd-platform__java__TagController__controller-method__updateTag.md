---
node_id: "odd-platform java TagController controller-method:updateTag"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-sprint-2026-05-21-TAGGING-batch
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control
---

# TagController.updateTag — semantic understanding

## understanding

`updateTag` is the **HTTP write endpoint that renames a Tag and/or toggles its
`important` flag** in the global tag directory (`PUT /api/tags/{tag_id}`,
`TagController.java:46-52`). It is a 2-line reactive delegation —
`tagFormData.flatMap(fd -> tagService.update(tagId, fd)).map(ResponseEntity::ok)` —
that materialises the request-body `Mono<TagFormData>` then hands `tagId` + the
form data to `TagServiceImpl.update` (`TagServiceImpl.java:44-55`). The real
behaviour is in that service method, which runs under `@ReactiveTransactional`:
fetch the tag DTO → 404 if absent → reject if the tag has any external (Collector-set)
data-entity relations → apply the form data to the row → persist → **refresh THREE
FTS search vectors via `updateSearchVectors` (`TagServiceImpl.java:161-167`)**. The
search-vector refresh confirms the context prompt's question: renaming a tag DOES
propagate the new name into `search_entrypoint.tag_vector` of every data entity
carrying it (`ReactiveSearchEntrypointRepositoryImpl.java:319-341` joins
`TAG -> TAG_TO_DATA_ENTITY -> DATA_ENTITY`). This `update` path refreshes 3 vectors;
the sibling `delete` path refreshes only 1 (the asymmetry the context prompt flagged
is real — verified at `TagServiceImpl.java:68-69` vs `:161-167`). Authorisation is
controller-perimeter-only via `SecurityConstants` path-pattern matching
(`TAG_UPDATE`, Management scope); the service tier has zero permission checks. The
endpoint returns HTTP 200 although the OpenAPI spec declares 201 — a status-code
drift inherited from the controller-class.

## concepts

- entities: [
    "`TagFormData` (OpenAPI) — the request body for `updateTag`; single-tag input carrying `name` (string) + `important` (boolean). Materialised from `Mono<TagFormData>` at `TagController.java:48,50`.",
    "`Tag` (OpenAPI) — the response shape; declares `id, name, important, external, usedCount`. NOTE: `updateTag`'s response is mapped from a bare `TagPojo` via `tagMapper.mapToTag(TagPojo)` (`TagMapper.java:26`), which only carries `id, name, important` — so the `external` and `usedCount` response fields are unpopulated on this endpoint (see bugs_limitations_corner_cases).",
    "`TagPojo` — jOOQ row pojo for the `tag` table (`id, name, important, created_at, updated_at, deleted_at`); the persisted shape `TagServiceImpl.update` mutates.",
    "`TagDto` — service-layer record `TagDto(TagPojo, Long usedCount, Boolean external)`; `TagServiceImpl.update` fetches this via `getDto` and reads `.external()` for the guard.",
    "`tagId: Long` — the path parameter (`TagController.java:47`); the directory key of the tag to update.",
    "`search_entrypoint.tag_vector` — the per-data-entity FTS column refreshed when a tag is renamed (`ReactiveSearchEntrypointRepositoryImpl.java:336`)."
  ]
- operations: [
    "Materialise the request body — `tagFormData.flatMap(...)` awaits the `Mono<TagFormData>` before delegating (`TagController.java:50`).",
    "Delegate to `TagServiceImpl.update(tagId, formData)` (`TagController.java:50` → `TagServiceImpl.java:44-55`).",
    "Fetch + 404 — `reactiveTagRepository.getDto(tagId).switchIfEmpty(NotFoundException('Tag', tagId))` (`TagServiceImpl.java:47-48`).",
    "External-relations guard — `.filter(tagDto -> !tagDto.external()).switchIfEmpty(BadUserRequestException('Can't update tag which has external relations'))` (`TagServiceImpl.java:49-50`).",
    "Apply + persist — `tagMapper.applyToPojo(formData, tag.tagPojo())` then `reactiveTagRepository::update` (`TagServiceImpl.java:51-52`).",
    "Triple FTS refresh — `updateSearchVectors` runs `Mono.zip` of `reactiveSearchEntrypointRepository.updateChangedTagVectors`, `.updateChangedTagStructureVector`, `reactiveTermSearchEntrypointRepository.updateChangedTagVectors` (`TagServiceImpl.java:161-167`).",
    "Map to response + wrap 200 — `.map(tagMapper::mapToTag)` then `ResponseEntity::ok` (`TagServiceImpl.java:54` + `TagController.java:51`)."
  ]
- invariants: [
    "The controller method body is a pure 2-line reactive delegation — no business logic, no programmatic auth check, no transformation; consistent with the thin-OpenAPI-delegate pattern across the controller package.",
    "**Updating a tag with `external = true` is rejected** — `TagServiceImpl.update` filters `!tagDto.external()` (`:49`); a tag with at least one Collector-set data-entity relation throws `BadUserRequestException`. The `external()` aggregate is `boolOr(tag_to_data_entity.external)` — it does NOT consult `tag_to_dataset_field` origins, so a tag with INTERNAL data-entity relations + EXTERNAL dataset-field relations would NOT be blocked (see bugs_limitations_corner_cases).",
    "**Renaming a tag refreshes the FTS search vectors of every data entity carrying it** — `updateChangedTagVectors(tagId)` joins `TAG -> TAG_TO_DATA_ENTITY -> DATA_ENTITY` (filtered `DATA_ENTITY.HOLLOW.isFalse()`) and upserts `SEARCH_ENTRYPOINT.TAG_VECTOR` per entity (`ReactiveSearchEntrypointRepositoryImpl.java:319-341`). A user who renames a tag and immediately full-text-searches the new name sees the carrying entities.",
    "**The `update` path is search-vector-symmetric (3 refreshes); the `delete` path is asymmetric (1 refresh).** `update` → `updateSearchVectors` triple-zip (`TagServiceImpl.java:161-167`); `delete` → only `reactiveTermSearchEntrypointRepository.updateChangedTagVectors` (`TagServiceImpl.java:68-69`). After a tag delete, the main `search_entrypoint` table still carries the deleted tag's tokens until the next entity-level write — but `update` correctly refreshes all three. The asymmetry is a `delete`-side gap, not an `updateTag` gap.",
    "Authorisation lives at the controller perimeter only — `PUT /api/tags/{tag_id}` → `TAG_UPDATE` (Management scope, `NO_CONTEXT`) per `SecurityConstants.java:138-142` (per the TagController-class sidecar). The service tier (`TagServiceImpl.java:1-167`) has zero `@PreAuthorize` and zero programmatic permission checks.",
    "The endpoint returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:51`); the OpenAPI spec declares 201 — a status-code drift (per the TagController-class sidecar, `openapi.yaml:400`).",
    "`update` is idempotent on identical form data — same `(name, important)` input applied twice produces the same end state (last-write-wins, no version column)."
  ]
- audiences: [
    "odd-platform-ui-end-user — the Management → Tags tab edit control (rename a tag, toggle the Important flag).",
    "odd-api-consumer — programmatic clients calling `PUT /api/tags/{tag_id}` per the OpenAPI spec.",
    "platform-operator — the RBAC author granting `TAG_UPDATE`.",
    "data-discovery search user (indirectly) — the FTS-vector refresh on rename means a tag rename changes which entities surface for a full-text search of the tag name."
  ]

## dependencies_semantic

- requires-feature: [
    "`TagApi` OpenAPI-generated controller interface — `updateTag` is an `@Override` of the generated method signature (`TagController.java:46`).",
    "`TagService.update(long, TagFormData)` (`TagService.java:18`) — the service contract this endpoint delegates to.",
    "`TagServiceImpl.update` (`TagServiceImpl.java:44-55`) + its private `updateSearchVectors` helper (`:161-167`).",
    "`ReactiveTagRepository.getDto` + `.update` (`TagServiceImpl.java:47,52`) — the persistence operations.",
    "`TagMapper.applyToPojo` (`TagMapper.java:21`) + `TagMapper.mapToTag(TagPojo)` (`TagMapper.java:26`) — the MapStruct apply-and-map pair.",
    "`ReactiveSearchEntrypointRepository.updateChangedTagVectors` + `.updateChangedTagStructureVector` + `ReactiveTermSearchEntrypointRepository.updateChangedTagVectors` — the three FTS-refresh targets.",
    "`SecurityConstants.SECURITY_RULES` — the `PUT /api/tags/{tag_id}` → `TAG_UPDATE` path-pattern entry that gates this endpoint (coupled by URL convention, not reference)."
  ]
- requires-config: [] — N/A. `updateTag` reads no Spring properties; behaviour is unconditional and code-driven.
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `Mono` / `Flux` throughout; `Mono<TagFormData>` request-body deserialisation.",
    "Spring Reactive Transaction Manager (`reactiveTransactionManager` bean) — required for the `@ReactiveTransactional` on `TagServiceImpl.update`.",
    "Spring Security ReactiveSecurityWebFilterChain — composed per the active auth mode; enforces the `TAG_UPDATE` rule at the path-pattern perimeter.",
    "jOOQ reactive PostgreSQL driver — for the `getDto` / `update` / FTS-upsert round-trips."
  ]
- couples-to: [
    "`TagApi` (`implements` at `TagController.java:18`) — the generated interface; a regen with a changed `updateTag` signature would force a controller change.",
    "`TagServiceImpl.update`'s flatMap chain — the `updateTag` endpoint's observable behaviour (404, external-guard rejection, FTS refresh, response shape) is entirely determined by this service method; the controller adds nothing.",
    "`TagMapper.mapToTag(TagPojo)` — the bare-pojo overload; coupling here is why `updateTag`'s response omits `external` / `usedCount` (see bugs_limitations_corner_cases).",
    "`SecurityConstants.SECURITY_RULES` `PUT /api/tags/{tag_id}` entry — coupled by path-pattern match; a path rename (REFACTOR-217 class) would silently drop the `TAG_UPDATE` gate.",
    "`ReactiveSearchEntrypointRepositoryImpl.updateChangedTagVectors`'s `buildVectorUpsert(..., true)` — the FTS-upsert; whether a rename overwrites or appends the tag token depends on the `true` flag's meaning (not resolved in this sidecar's 1-hop budget — see P-025)."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — No test exercises `updateTag` at the controller layer OR `TagServiceImpl.update` at the service layer. `Glob: odd-platform-api/src/test/**/Tag*.java` and `odd-platform-api/src/test/**/*Tag*` both return ZERO files in this session; the only Tag-related test referenced by the neighbour sidecars is `TagRepositoryImplTest` (repository layer only), which has `testUpdateTag` for the bare repository `update` round-trip but does NOT exercise the service-layer `update` orchestration (the `!external` guard, the 404 path, or the `updateSearchVectors` triple-zip).
- uncovered_behaviours:
    - behaviour: "`updateTag` rename propagates the new name into `search_entrypoint.tag_vector` of carrying entities — assert a full-text search of the new name returns the entities, and the old name does not."
      test_class: integration
      criticality: HIGH
      note: "Pinned by P-025. The static trace confirms the propagation; only a probe verifies the overwrite-vs-append behaviour of buildVectorUpsert."
    - behaviour: "`updateTag` external-relations rejection — PUT for a tag with `external = true`, assert `BadUserRequestException` ('Can't update tag which has external relations') from `TagServiceImpl.java:50`."
      test_class: integration
      criticality: HIGH
    - behaviour: "`updateTag` not-found path — PUT for a non-existent `tagId`, assert `NotFoundException` → 404 from `TagServiceImpl.java:48`."
      test_class: integration
      criticality: MEDIUM
    - behaviour: "`updateTag` triple search-vector refresh — assert all three `updateChangedTag*Vectors` calls fire on update (a regression collapsing the `Mono.zip` to a single call would silently break the term-search FTS index)."
      test_class: integration
      criticality: MEDIUM
    - behaviour: "`updateTag` response-shape — assert the returned `Tag` body's `external` / `usedCount` fields (the `mapToTag(TagPojo)` overload leaves them null; a consumer relying on them gets null)."
      test_class: integration
      criticality: MEDIUM
    - behaviour: "`updateTag` status-code drift — assert the controller returns 200 (de facto) vs OpenAPI 201."
      test_class: integration
      criticality: MEDIUM
    - behaviour: "`updateTag` authorisation enforcement — assert a no-`TAG_UPDATE` user gets 403; assert an unauthenticated caller gets 401 (or 302 under LOGIN_FORM)."
      test_class: security
      criticality: HIGH
    - behaviour: "`updateTag` concurrent same-id race — two simultaneous PUTs on the same `tagId`; assert last-write-wins with no corruption (there is no optimistic-lock column)."
      test_class: integration
      criticality: LOW
- test_files: [] — N/A. No `TagControllerTest.java` and no `TagServiceImplTest.java` exist; verified via two `Glob` invocations this session. `TagRepositoryImplTest` (`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java`) covers the repository layer only.
- gaps: |
    The `updateTag` write path has ZERO automated coverage at both the controller
    and the service layer. The highest-leverage gap is **integration coverage of
    the search-vector propagation** (P-025): a tag rename silently changes which
    data entities surface in full-text search, and nothing pins that today — a
    refactor that drops the `flatMap(this::updateSearchVectors)` at
    `TagServiceImpl.java:53` would compile, pass every existing test, and leave
    the search index stale after every rename. The second-highest gap is the
    **`!external` guard** — removing `.filter(tagDto -> !tagDto.external())` at
    `TagServiceImpl.java:49` would let UI users rename Collector-owned tags with
    zero CI signal, a Collector-vs-UI ownership-contract regression. The third is
    **security tests** — no test asserts `TAG_UPDATE` is enforced, so a
    `SecurityConstants` path-pattern drift (REFACTOR-217 class) on
    `PUT /api/tags/{tag_id}` would not surface in CI. The worst-covered class is
    integration (the FTS-propagation and external-guard chains both cross the
    service → repository → search-entrypoint boundary).

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `TagController.java`. Verified by reading the file end-to-end (53 lines); no `@docs`, no doc-pointer comment.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Tag UX page — covers the Management → Tags vocabulary surface that `updateTag` serves (rename / Important-flag toggle). WebFetch was not performed this session (no live-fetch tool result obtained); per the stale-probe cadence the verification is inherited from the TagController-class sidecar's WebFetch of 2026-05-20 (status 200, within the ~11-day window)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Inherited from the TagController-class sidecar (WebFetch 2026-05-20, status
      200): "Management → Tags (operator-mutating side): Create the canonical tag
      vocabulary, set Important flags, and govern tagging across teams. ... Three
      RBAC permissions: TAG_CREATE / TAG_UPDATE / TAG_DELETE. All three govern
      vocabulary-level mutations, not assignment operations." The live page makes
      NO mention of the FTS search-vector refresh that a tag rename triggers, and
      NO mention of the `external`-relations rejection on update.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names `TAG_UPDATE` (Management scope). The endpoint's sole auth gate."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Inherited from the TagController-class sidecar (WebFetch 2026-05-20, status
      200): "Management Permissions: TAG_CREATE / TAG_UPDATE / TAG_DELETE."
- doc_drift_findings:
  - "Live tagging page (inherited 2026-05-20, status 200) does NOT state that renaming a tag refreshes the full-text search vectors of every entity carrying it — a user-observable effect (search results change after a rename). Code: `TagServiceImpl.java:53,161-167` + `ReactiveSearchEntrypointRepositoryImpl.java:319-341`."
  - "Live tagging page does NOT state that a tag with Collector-set (external) relations cannot be renamed via the UI — the `BadUserRequestException` at `TagServiceImpl.java:50` is operator-visible but undocumented."
  - "OpenAPI declares `'201'` for `updateTag`'s success response; the controller returns 200 via `ResponseEntity::ok` (`TagController.java:51`). Status-code drift (per the TagController-class sidecar, `openapi.yaml:400`)."

## implicit_adrs

- "**Thin OpenAPI-delegate controller method** — `updateTag` is a 2-line reactive delegation with no business logic; all behaviour lives in `TagServiceImpl.update`." — evidence: TagController.java:46-52 (the 2-line body) — intent_anchor: "the method is `@Override` of the generated `TagApi` interface and follows the exact 2-3-line `service-call.map(ResponseEntity::ok)` shape used by every other method in this controller and across the controller package — the OpenAPI-generated-interface convention IS the architectural statement that business logic stays in services" — confidence: HIGH
- "**Renaming a tag is a search-index-consistent operation** — `TagServiceImpl.update` makes the three FTS-vector refreshes part of the synchronous transaction boundary via `flatMap(this::updateSearchVectors)`, not a fire-and-forget `subscribe`." — evidence: TagServiceImpl.java:53 (the `flatMap` placement) + :161-167 (the triple `Mono.zip`) — intent_anchor: "the `flatMap` (vs `subscribe`) placement, inside a `@ReactiveTransactional` method, shows the maintainer deliberately chose to make search-index consistency part of the awaited response — a user who renames a tag and immediately searches the new name sees the carrying entities. The triple-zip is concurrent (not sequential `flatMap` chaining) — intentional parallelism for latency" — confidence: HIGH
- "**The `external` bit makes Collector-pushed tags read-only to UI rename** — `TagServiceImpl.update` rejects any tag with an external data-entity relation." — evidence: TagServiceImpl.java:49-50 — intent_anchor: "the explicit exception message `\"Can't update tag which has external relations\"` names the constraint in user-visible language; the same `!external` guard is mirrored in `delete` (`:62-63`) and `updateRelationsWithDataEntity` (`:102`) — three aligned guards across three methods is an intentional ownership pattern, not coincidence" — confidence: HIGH

## bugs_limitations_corner_cases

- "**`updateTag`'s response `Tag` omits `external` and `usedCount`** — `TagServiceImpl.update` ends with `.map(tagMapper::mapToTag)` applied to a bare `TagPojo` (`TagServiceImpl.java:54`); the `mapToTag(TagPojo)` overload (`TagMapper.java:26`) maps only `id, name, important` because `TagPojo` has no `usedCount` or `external` field. The OpenAPI `Tag` schema declares `external` and `usedCount`, so a consumer of `PUT /api/tags/{tag_id}` receives those two fields as null/absent — inconsistent with `getPopularTagList`'s `Tag` items (mapped from `TagDto` via the `mapToTag(TagDto)` overload at `TagMapper.java:23-24`, which DOES populate them). A UI that re-renders a tag chip from the `updateTag` response would lose the usage count and external flag. — evidence: TagServiceImpl.java:54 + TagMapper.java:23-26 — severity: MEDIUM"
- "**Status-code drift on `updateTag`** — controller returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:51`); OpenAPI declares 201 (per the TagController-class sidecar, `openapi.yaml:400`). Same drift class as `createTag` and `TermController.createTerm`. — evidence: TagController.java:51 — severity: MEDIUM"
- "**The `!external` guard reads only the data-entity aggregate, not dataset-field origins** — `TagServiceImpl.update`'s guard tests `tagDto.external()`, which is `boolOr(tag_to_data_entity.external)` — the aggregate over data-entity relations ONLY. A tag with INTERNAL data-entity relations but EXTERNAL `tag_to_dataset_field` relations (origin `EXTERNAL` / `EXTERNAL_STATISTICS`) would pass the guard and be renamable via the UI, even though it carries Collector-set dataset-field assignments. The dataset-field side uses a `TagOrigin` enum the guard never consults. — evidence: TagServiceImpl.java:49 + TagDto.java:5 + ReactiveTagRepositoryImpl.java (the `tag_to_dataset_field.origin` column, per the repository sidecar) — severity: MEDIUM"
- "**No request-body validation on the tag name beyond OpenAPI `type: string`** — `updateTag` accepts a `TagFormData` whose `name` is declared `type: string` with no `pattern` / `minLength` / `maxLength`, and there is no DB-level `CHECK` constraint. A rename to an empty string, whitespace-only, control-char, or unbounded-length name is accepted; the renamed tag then renders to every user on the popular-tags surface and propagates into FTS vectors. — evidence: TagController.java:46-52 + TagServiceImpl.java:51 + the OpenAPI `TagFormData` schema (per the TagController-class sidecar, `openapi.yaml:370`) — severity: LOW"
- "**No audit-log entry on `updateTag`** — neither the controller method nor `TagServiceImpl.update` carries `@ActivityLog`; a tag rename produces NO Activity Feed entry. `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)` exists at `DataEntityServiceImpl.java:358` for the per-entity tag-assignment path, but the directory-vocabulary rename path is unlogged — there is no record of who renamed a tag or when. — evidence: TagController.java:46-52 (no `@ActivityLog`) + TagServiceImpl.java:44-55 (no `@ActivityLog` on `update`) — severity: MEDIUM"
- "**TOCTOU window between `getDto` and `update`** — `TagServiceImpl.update` reads the tag DTO (`:47`, READ COMMITTED), evaluates the `!external` guard, then writes (`:52`). Between the read and the write, a concurrent Collector ingestion could attach an external relation; the rename would still proceed because the guard was evaluated against the stale snapshot. There is no `SELECT ... FOR UPDATE` and no optimistic-lock version column. The race window is narrow and Collector-vs-UI concurrent edits of the same tag are uncommon, but the guard is not race-tight. — evidence: TagServiceImpl.java:44-55 (no row lock, no version column) — severity: LOW"
- "**Renaming to an existing tag's name raises a raw `UniqueConstraintException`** — `TagServiceImpl.update` → `reactiveTagRepository.update` issues a plain `UPDATE tag SET name = ?`; the partial unique index `tag_name_unique` (per the repository sidecar) rejects a rename that collides with another non-deleted tag's name. The violation translates to `UniqueConstraintException(\"Tag with this name already exists\")` via `ExceptionUtils` — surfaced to the caller as a 4xx. This is correct behaviour but undocumented; the OpenAPI spec does not declare the conflict response. — evidence: TagServiceImpl.java:52 + ReactiveTagRepositoryImpl.java (the `tag_name_unique` partial index, per the repository sidecar's invariant) — severity: LOW"

## stress_findings

```yaml
stress_findings:
  tunables: []
  # No numeric literals, no @Value defaults, no constants, no magic strings
  # in the updateTag method body (TagController.java:46-52) or in
  # TagServiceImpl.update (TagServiceImpl.java:44-55). The method takes a
  # path id + a form-data body; there are no limits / sizes / timeouts /
  # retries / page sizes. The triple Mono.zip in updateSearchVectors is a
  # fixed arity-3 zip, not a tunable. Explicit [] — checked, no triggers.
  name_behavior_pairs:
    - name: "TagController.updateTag (TagController.java:46) + @PutMapping('/api/tags/{tag_id}') (inherited from the generated TagApi interface)"
      promise: "Updates a tag — by the method name (`updateTag`) + the PUT verb, the caller expects the tag identified by `tagId` to be mutated to match the submitted `TagFormData` (name + important flag), with the change reflected wherever the tag is referenced."
      implementation: "Delegates to TagServiceImpl.update (TagServiceImpl.java:44-55, @ReactiveTransactional): (1) getDto(tagId) -> NotFoundException if absent; (2) !external guard -> BadUserRequestException if the tag has any external data-entity relation; (3) tagMapper.applyToPojo(formData, pojo) applies BOTH name and important (TagMapper.java:21, MapStruct default field-name mapping); (4) reactiveTagRepository.update persists; (5) updateSearchVectors (TagServiceImpl.java:161-167) refreshes THREE FTS vectors -- the new name propagates into search_entrypoint.tag_vector of every data entity carrying the tag (ReactiveSearchEntrypointRepositoryImpl.java:319-341 JOINs TAG->TAG_TO_DATA_ENTITY->DATA_ENTITY). The change IS reflected wherever the tag is referenced for search purposes."
      drift: NONE
      operator_visible_consequence: "The method honors its name -- a rename mutates the row and propagates into the FTS index. The only caveat is the response shape (the returned Tag omits external/usedCount, see request_inputs[1] Q5 and bugs_limitations_corner_cases) -- a sub-promise gap, not a behavior drift."
      confidence: STATIC-INFERRED
      evidence: "TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167 + TagMapper.java:21 + ReactiveSearchEntrypointRepositoryImpl.java:319-341"
    - name: "TagServiceImpl.updateSearchVectors (TagServiceImpl.java:161) — the rename-triggered search-vector refresh"
      promise: "Updates the search vectors changed by the tag mutation — the name implies the FTS index is brought into consistency with the renamed tag."
      implementation: "Mono.zip of three concurrent calls: reactiveSearchEntrypointRepository.updateChangedTagVectors (entity tag_vector), .updateChangedTagStructureVector (dataset-structure vector), reactiveTermSearchEntrypointRepository.updateChangedTagVectors (term-search vector). updateChangedTagVectors (ReactiveSearchEntrypointRepositoryImpl.java:319-341) upserts SEARCH_ENTRYPOINT.TAG_VECTOR for every non-hollow data entity carrying the tag via buildVectorUpsert(..., true). Whether the upsert OVERWRITES or APPENDS the tag token (the `true` flag's meaning) is not resolvable within this sidecar's 1-hop budget."
      drift: MINOR
      operator_visible_consequence: "If buildVectorUpsert's `true` flag means append-not-replace, a tag rename would leave the OLD name as a stale searchable token in every carrying entity's tag_vector -- a search for the old name would still surface the entity. P-025 pins this: assertion H2 fails if append. If `true` means replace (the likely-correct behavior), there is no drift."
      confidence: PROBE-NEEDED
      evidence: "P-025"
  orderings: []
  # updateTag and TagServiceImpl.update issue no ORDER BY, no LIMIT/OFFSET,
  # no paginate(...), no Page<...> return, no in-memory .sort()/Comparator,
  # no GROUP BY. getDto is a single-row primary-key fetch; update is a
  # single-row UPDATE; the FTS upserts write per-entity rows with no
  # caller-visible ordering. The ordering-class triggers (and the LSN-019
  # drift) live in the SIBLING method listMostPopular / getPopularTagList,
  # not in updateTag. Explicit [] — checked, no triggers on THIS node.
  auth_gates:
    - location: "SecurityConstants.java:138-142 (path-pattern entry; per the TagController-class sidecar) + TagController.java:46-52 (the method has no @PreAuthorize annotation)"
      endpoint: "PUT /api/tags/{tag_id} (updateTag)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: PUT /api/tags/{tag_id} is accessible without authentication -- the auth.type=DISABLED branch skips Spring Security entirely; no SecurityRule applies. LOGIN_FORM / OAUTH2 / LDAP: identical posture -- the SecurityConstants.SECURITY_RULES entry attaches the TAG_UPDATE requirement; SECURITY_RULES is mode-agnostic, so the three authenticating modes gate the endpoint the same way. A caller holding TAG_UPDATE succeeds; one without it gets 403."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 (per the TagController-class sidecar) + REFERENCE to node OAuthSecurityConfiguration / LoginFormSecurityConfiguration / LdapSecurityConfiguration / SecurityConfiguration"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "LOGIN_FORM: 302 redirect to the login form (or 401 for an XHR/API call) via the catch-all pathMatchers('/**').authenticated() (AuthorizationCustomizer.java:29-30, per the TagController-class sidecar). OAUTH2 / LDAP: 401. DISABLED: 200 -- no auth check, the rename proceeds."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (catch-all, per the TagController-class sidecar)"
        - q: "What does a wrong-role caller see (READ_ONLY hitting this write endpoint)?"
          a: "A caller authenticated but lacking TAG_UPDATE (e.g. a READ_ONLY-role user, or a user holding only DATA_ENTITY_TAGS_UPDATE) gets 403 on PUT /api/tags/{tag_id}. NOTE: such a user CANNOT rename a directory tag here, but the side-door surfaces (PUT /api/dataentities/{id}/tags etc.) can still mint NEW tags via getOrCreateTagsByName under a different permission -- the side-door grows the directory but does not rename existing tags, so updateTag's TAG_UPDATE gate is the sole rename path."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 (per the TagController-class sidecar) + the side-door analysis in the TagServiceImpl sidecar"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "Controller PERIMETER ONLY -- via SecurityConstants.SECURITY_RULES path-pattern matching in the reactive security filter chain. The updateTag method itself has NO @PreAuthorize annotation (TagController.java:46-52). The service tier (TagServiceImpl.java:1-167) has ZERO @PreAuthorize and ZERO programmatic permission checks; the repository tier has none either. Any path-pattern drift on PUT /api/tags/{tag_id} (REFACTOR-217 class) would silently bypass the TAG_UPDATE gate -- the rename would then be reachable by any authenticated user."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:46-52 (no @PreAuthorize) + TagServiceImpl.java:1-167 (no @PreAuthorize, no permissionService) + SecurityConstants.java:138-142 (path-pattern entry, per the TagController-class sidecar)"
  resource_boundaries:
    - location: "TagServiceImpl.java:44-55 (@ReactiveTransactional on update)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent PUT /api/tags/{id} with the SAME tagId: both load via getDto (READ COMMITTED snapshot), both evaluate the !external guard, both apply their form data and UPDATE. Last-write-wins -- the second commit overwrites the first. No optimistic-lock version column, no SELECT ... FOR UPDATE, no row lock. No CORRUPTION (the row is internally consistent after either write), but a lost-update: if two users rename the same tag concurrently, one rename is silently discarded. A concurrent rename to the SAME new name as another EXISTING tag hits the tag_name_unique partial index -> UniqueConstraintException on the losing writer."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:44-55 (no @Lock, no version column, no advisory lock) + ReactiveTagRepositoryImpl.java (the tag_name_unique partial index, per the repository sidecar)"
        - q: "Is the call replay-safe?"
          a: "Yes -- updateTag is idempotent on identical form data: the same (name, important) submitted twice produces the same end state. A retry after a successful rename re-applies the same values (no-op). A retry after a rename-to-a-now-taken-name fails the same way each time. The FTS-vector refresh is also idempotent (re-upserting the same tag_vector is a no-op)."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:44-55 + TagMapper.java:21 (applyToPojo is a pure field copy)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts updateTag -- no @Cacheable annotation on the controller method or on TagServiceImpl.update, no manual cache writes, no platform-level cache layer visible in either file. Every PUT hits the DB directly. The closest thing to a cache is the FTS search_entrypoint.tag_vector itself -- and updateSearchVectors refreshes it synchronously within the same transaction, so there is no staleness window for the search index after a rename completes."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167 (no @Cacheable, no cache references)"
  request_inputs:
    - location: "TagController.java:47 (updateTag method signature — first parameter)"
      input_kind: path-param
      input_name: "tagId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the tag to update -- `tagId` names the primary-key identifier of a directory Tag row."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:47"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced end-to-end: TagController.updateTag passes tagId to tagService.update(tagId, fd) (TagController.java:50) -> TagServiceImpl.update(long tagId, ...) (TagServiceImpl.java:46) -> reactiveTagRepository.getDto(tagId) (TagServiceImpl.java:47) which the repository sidecar confirms binds to TAG.ID via idCondition(id) (overridden to add `deleted_at IS NULL`). After the guard, applyToPojo mutates the SAME pojo fetched by that id, and reactiveTagRepository.update persists it. The id also flows to updateSearchVectors -> updateChangedTagVectors(tagId) which binds TAG.ID.eq(tagId) (ReactiveSearchEntrypointRepositoryImpl.java:330). Every use of tagId resolves to the TAG.ID column."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:50 + TagServiceImpl.java:46-53 + ReactiveSearchEntrypointRepositoryImpl.java:330"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — tagId names a tag id and binds to TAG.ID at every layer (getDto's idCondition, the UPDATE, the FTS-upsert's WHERE TAG.ID.eq(tagId)). No translation, no scope shift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:47 + ReactiveSearchEntrypointRepositoryImpl.java:330"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the input MATCHES; no silent translation."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:47"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — tag.id is the single identifier column and it IS the bind target. No closer-aligned unused column."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:47"
      routes_to_finding: "none — input name and implementation are aligned"
    - location: "TagController.java:48 (updateTag method signature — second parameter, the request body)"
      input_kind: body-field
      input_name: "tagFormData (Mono<TagFormData> — fields: name, important)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`tagFormData` promises the new form values for the tag -- the OpenAPI TagFormData schema carries `name` (the new tag name) and `important` (the new Important-flag state). The caller expects BOTH fields they submit to be applied."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:48 + TagServiceImpl.java:46 (formData parameter)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "tagFormData is materialised from the Mono at TagController.java:50, passed to TagServiceImpl.update as `formData`, then `tagMapper.applyToPojo(formData, tag.tagPojo())` (TagServiceImpl.java:51). applyToPojo (TagMapper.java:21) is a MapStruct @MappingTarget method with no explicit @Mapping overrides -- it copies same-named fields, so BOTH `name` and `important` from the form data are applied onto the existing TagPojo. The mutated pojo is persisted by reactiveTagRepository.update."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:50 + TagServiceImpl.java:51-52 + TagMapper.java:21"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on the WRITE side -- both `name` and `important` submitted in tagFormData are applied to the tag row. There is a sub-promise gap on the RESPONSE side (see Q5): the returned Tag does not echo back `external`/`usedCount`. The input itself is honored; the response is incomplete."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:51-52 + TagMapper.java:21"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A for the input write-path -- no silent translation; `name` writes tag.name and `important` writes tag.important."
          confidence: STATIC-INFERRED
          evidence: "TagMapper.java:21"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NO unused INPUT field -- both TagFormData fields are consumed. HOWEVER, the inverse smell exists on the RESPONSE: the OpenAPI Tag schema has `external` and `usedCount` fields, and TagDto carries both, but updateTag's terminal `.map(tagMapper::mapToTag)` uses the mapToTag(TagPojo) overload (TagMapper.java:26) which cannot populate them (TagPojo lacks those fields). The mapToTag(TagDto) overload (TagMapper.java:23-24) WOULD populate them and is available -- it is used by listMostPopular but not by update. This is an available-but-unused mapper overload; routed to bugs_limitations_corner_cases."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:54 + TagMapper.java:23-26"
      routes_to_finding: "bugs_limitations_corner_cases.[1] (response Tag omits external/usedCount — available mapToTag(TagDto) overload unused)"
  probes_emitted:
    - probe_id: P-025
      question: "Does renaming a tag via PUT /api/tags/{id} propagate the new name into search_entrypoint.tag_vector of carrying entities (H1), and does it OVERWRITE rather than append the old name's token (H2)?"
      probe_path: "lineage/odd-platform/probes/P-025.yaml"
  stress_summary:
    triggers_total: 6
    questions_total: 18
    answers_static_inferred: 17
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — `updateTag` is on the HTTP UI/API surface (`PUT /api/tags/{tag_id}`). `DISABLED` skips authentication entirely (the rename proceeds with no auth check). `S2S` is orthogonal — the directory rename path is NOT an ingestion endpoint.
- **ingestion_filter_relevance**: `NO — UI/API surface at /api/tags/{tag_id}, not /ingestion/**`. `updateTag` does not participate in the `POST /ingestion/entities` flow. (The global tag directory IS mutated by the ingestion path elsewhere — `ExternalTagIngestionRequestProcessor` — but that path creates/upserts tags; it does not rename them via this endpoint.)
- **authorization_assertions**:
  - "PUT `/api/tags/{tag_id}` gated by `TAG_UPDATE` (Management scope, `NO_CONTEXT`) — evidence: SecurityConstants.java:138-142 (per the TagController-class sidecar)"
  - "The endpoint inherits the service-tier zero-checks posture — no `@PreAuthorize` and no programmatic permission call in `TagController.updateTag` (TagController.java:46-52) or in `TagServiceImpl.update` (TagServiceImpl.java:44-55, 161-167)"
- **owner_scoping**: `N/A — the Tag directory has no owner concept`. The `tag` table has no `owner_id` column; `updateTag` renames a globally-shared directory tag with no per-Owner scoping. Any caller holding `TAG_UPDATE` can rename any tag.
- **data_exposure**:
  - "`Mono<ResponseEntity<Tag>>` from `updateTag` → the caller holding `TAG_UPDATE`. The response body carries `id, name, important` only (the `mapToTag(TagPojo)` overload omits `external`/`usedCount`) — so updateTag exposes LESS than the OpenAPI `Tag` schema declares; not an over-exposure. — evidence: TagController.java:46-52 + TagMapper.java:26"
  - "A rename mutates `search_entrypoint.tag_vector` of every data entity carrying the tag — the new tag name becomes full-text-searchable across those entities for any user who can run a search. — evidence: TagServiceImpl.java:161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-341"
- **known_security_gaps**:
  - "Service-tier zero-checks posture — the controller perimeter (`SecurityConstants` path-pattern match) is the SOLE authorisation defence for `updateTag`; any path-pattern drift (REFACTOR-217 class) on `PUT /api/tags/{tag_id}` silently bypasses `TAG_UPDATE`. — evidence: TagServiceImpl.java:1-167 + SecurityConstants.java:138-142 (per the TagController-class sidecar) — severity: MEDIUM"
  - "No audit log on the rename path — `updateTag` produces no Activity Feed entry; there is no record of who renamed a directory tag. A malicious or mistaken rename of a widely-used tag is untraceable. — evidence: TagController.java:46-52 + TagServiceImpl.java:44-55 (no `@ActivityLog`) — severity: MEDIUM"
  - "No request-body validation on the tag-name shape — `updateTag` accepts arbitrary content for `name`; the renamed value renders to every user on the popular-tags surface and propagates into FTS vectors. — evidence: TagController.java:46-52 + TagServiceImpl.java:51 + the OpenAPI `TagFormData` schema (per the TagController-class sidecar) — severity: LOW"

## performance

- **hot_paths**:
  - "`updateTag` runs once per Management → Tags edit action — low frequency relative to the read path (`getPopularTagList`). The per-call cost is dominated by `updateSearchVectors` (`TagServiceImpl.java:161-167`): THREE concurrent FTS-upsert queries, each scanning the tag's relation set. `updateChangedTagVectors` joins `TAG -> TAG_TO_DATA_ENTITY -> DATA_ENTITY` and upserts one `search_entrypoint` row per carrying entity — cost scales with the tag's usage breadth (a tag on 10 000 entities triggers a 10 000-row upsert per rename). — evidence: TagController.java:46-52 + TagServiceImpl.java:161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-341"
- **throughput_characteristics**:
  - "`updateTag` is reactive `Mono` throughout — non-blocking; the jOOQ-reactive PG driver releases the connection between awaits."
  - "Single-tag — there is no bulk-update endpoint; each rename is one `PUT /api/tags/{tag_id}` call. The bulk shape exists only for `createTag`."
- **resource_allocation**:
  - "Per-call allocations are small — one `TagFormData`, one `TagDto`, one `TagPojo`. `@ReactiveTransactional` on `TagServiceImpl.update` pins one DB connection for the multi-step pipeline (getDto → update → three FTS upserts)."
  - "No client-side caching — every `updateTag` is a fresh round-trip; the FTS refresh is synchronous within the transaction."
- **scaling_characteristics**:
  - "Stateless — the controller method holds no per-call state; instances scale horizontally."
  - "No row-level locking on the write path — `update` is read-then-write within `@ReactiveTransactional`; PostgreSQL READ COMMITTED means concurrent renames of the same tag race to last-write-wins (no version column)."
- **known_performance_gaps**:
  - "`updateTag` runs three concurrent search-vector update queries on EVERY edit (`TagServiceImpl.java:161-167`) — even when the edit is a trivial `important`-flag flip with NO name change. A flag toggle does not change any FTS token, yet the full triple-upsert (potentially thousands of `search_entrypoint` rows for a widely-used tag) still fires. There is no name-changed short-circuit. — evidence: TagServiceImpl.java:44-55, 161-167 — severity: LOW"
  - "The FTS-upsert cost is unbounded in the tag's usage breadth — renaming a tag attached to a very large number of entities triggers a proportionally large `search_entrypoint` upsert inside the request transaction, with no batching cap visible at this layer. — evidence: TagServiceImpl.java:161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-341 — severity: LOW"

## upstream_callers

- entry_point: "rest:PUT /api/tags/{tag_id}"
  caller_node: "rest_api:openapi-generated TagApi.updateTag"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:46-52 — the controller method is the @Override of the generated TagApi.updateTag; one HTTP PUT triggers one invocation."
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/management/tags (Management → Tags tab — tag edit control)"
  caller_node: "ts react-component:TagsList.tsx (or the tag-edit form component — not read in this session)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:46-52 + system-mission.md:240 (P-08 Tags tab); the UI dispatch component and its per-action multiplicity are a REFERENCE — see the ui_route:Management-Tags sidecar when enriched (not yet present in lineage/odd-platform/understanding/)."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "Updates the `tag` row identified by `tagId` — sets `name` and `important` to the submitted form-data values (and `updated_at`)."
  evidence: "TagServiceImpl.java:51-52 — tagMapper.applyToPojo then reactiveTagRepository.update"
  cardinality_per_call: "1 (the single tag row); 0 if the tag is absent (NotFoundException, no write) or external (BadUserRequestException, no write)"
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "ui_route:/management/tags"

- side_effect_class: db-write
  description: "Upserts `search_entrypoint.tag_vector` for every non-hollow data entity carrying the tag — the renamed tag name propagates into each entity's full-text search vector."
  evidence: "TagServiceImpl.java:163 (updateChangedTagVectors call) + ReactiveSearchEntrypointRepositoryImpl.java:319-341 (JOIN TAG->TAG_TO_DATA_ENTITY->DATA_ENTITY, buildVectorUpsert into SEARCH_ENTRYPOINT.TAG_VECTOR)"
  cardinality_per_call: "0..N — one search_entrypoint upsert per data entity carrying the tag (N = the tag's data-entity usage count); 0 if the tag is unused"
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "ui_route:/management/tags"

- side_effect_class: db-write
  description: "Upserts the dataset-structure search vector for dataset-fields carrying the tag (the second arm of updateSearchVectors)."
  evidence: "TagServiceImpl.java:164 (updateChangedTagStructureVector call) + ReactiveSearchEntrypointRepositoryImpl.java:345-367 (JOIN through TAG_TO_DATASET_FIELD -> DATASET_STRUCTURE -> DATASET_VERSION -> DATA_ENTITY)"
  cardinality_per_call: "0..N — one structure-vector upsert per dataset entity whose fields carry the tag; 0 if the tag has no dataset-field relations"
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "ui_route:/management/tags"

- side_effect_class: db-write
  description: "Upserts the term-search FTS vector for terms carrying the tag (the third arm of updateSearchVectors — reactiveTermSearchEntrypointRepository.updateChangedTagVectors)."
  evidence: "TagServiceImpl.java:165 — the third zip arm; the term-side FTS repository owns the SQL. See ReactiveTermSearchEntrypointRepositoryImpl (REFERENCE — not read in this session)."
  cardinality_per_call: "0..N — one term-search-vector upsert per term carrying the tag; 0 if the tag has no term relations"
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "ui_route:/management/tags"

- side_effect_class: page-render
  description: "Returns a `Tag` JSON body (id, name, important — external/usedCount unpopulated) to the caller with HTTP 200."
  evidence: "TagController.java:51 (ResponseEntity::ok) + TagServiceImpl.java:54 (mapToTag) + TagMapper.java:26 (the bare-pojo overload)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "ui_route:/management/tags"

## sources

- understanding ← TagController.java:46-52 + TagServiceImpl.java:44-55, 68-69, 161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-341
- concepts.entities.TagFormData ← TagController.java:48 + TagServiceImpl.java:46
- concepts.entities.Tag ← TagController.java:47 + TagMapper.java:23-26
- concepts.entities.TagPojo ← TagServiceImpl.java:51 + TagMapper.java:21
- concepts.entities.TagDto ← TagServiceImpl.java:47-49 + TagDto.java:5 (per the TagServiceImpl sidecar)
- concepts.entities.search_entrypoint.tag_vector ← ReactiveSearchEntrypointRepositoryImpl.java:336
- concepts.operations.* ← TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167
- concepts.invariants.external-guard ← TagServiceImpl.java:49-50
- concepts.invariants.fts-refresh ← TagServiceImpl.java:161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-341
- concepts.invariants.update-vs-delete-asymmetry ← TagServiceImpl.java:68-69 (delete: 1 refresh) vs :161-167 (update: 3 refreshes)
- dependencies_semantic.requires-feature.TagService ← TagService.java:18 + TagServiceImpl.java:44-55
- dependencies_semantic.requires-feature.search-repos ← TagServiceImpl.java:34-35, 161-167
- tests_coverage_semantic.test_files ← Glob (odd-platform-api/src/test/**/Tag*.java + **/*Tag* — both empty this session)
- docs_link_semantic.inferred_docs.[0] ← inherited from the TagController-class sidecar's WebFetch (2026-05-20, status 200) — no live fetch performed this session
- implicit_adrs.[0] ← TagController.java:46-52
- implicit_adrs.[1] ← TagServiceImpl.java:53, 161-167
- implicit_adrs.[2] ← TagServiceImpl.java:49-50
- bugs_limitations_corner_cases.[0] ← TagServiceImpl.java:54 + TagMapper.java:23-26
- bugs_limitations_corner_cases.[1] ← TagController.java:51 + openapi.yaml:400 (status declared per the TagController-class sidecar)
- bugs_limitations_corner_cases.[2] ← TagServiceImpl.java:49 + TagDto.java:5
- bugs_limitations_corner_cases.[4] ← TagController.java:46-52 + TagServiceImpl.java:44-55 (no @ActivityLog) + DataEntityServiceImpl.java:358 (the related @ActivityLog, per the TagController-class sidecar)
- bugs_limitations_corner_cases.[5] ← TagServiceImpl.java:44-55 (no row lock, no version column)
- bugs_limitations_corner_cases.[6] ← TagServiceImpl.java:52 + ReactiveTagRepositoryImpl.java (tag_name_unique partial index, per the repository sidecar)
- stress_findings.name_behavior_pairs ← TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167 + TagMapper.java:21 + ReactiveSearchEntrypointRepositoryImpl.java:319-341
- stress_findings.auth_gates ← TagController.java:46-52 + SecurityConstants.java:138-142 (per the TagController-class sidecar)
- stress_findings.resource_boundaries ← TagServiceImpl.java:44-55
- stress_findings.request_inputs ← TagController.java:47-48 + TagServiceImpl.java:46-53 + TagMapper.java:21, 23-26 + ReactiveSearchEntrypointRepositoryImpl.java:330
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-025.yaml
- security.authorization_assertions ← SecurityConstants.java:138-142 (per the TagController-class sidecar) + TagController.java:46-52
- security.data_exposure ← TagController.java:46-52 + TagMapper.java:26 + ReactiveSearchEntrypointRepositoryImpl.java:319-341
- performance.hot_paths ← TagServiceImpl.java:161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-341
- performance.known_performance_gaps ← TagServiceImpl.java:44-55, 161-167
- upstream_callers.[0] ← TagController.java:46-52
- downstream_side_effects.[0] ← TagServiceImpl.java:51-52
- downstream_side_effects.[1] ← TagServiceImpl.java:163 + ReactiveSearchEntrypointRepositoryImpl.java:319-341
- downstream_side_effects.[2] ← TagServiceImpl.java:164 + ReactiveSearchEntrypointRepositoryImpl.java:345-367
- downstream_side_effects.[4] ← TagController.java:51 + TagServiceImpl.java:54 + TagMapper.java:26

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM — doc verification inherited from the TagController-class sidecar's 2026-05-20 WebFetch (within the ~11-day stale-probe window); no live fetch performed this session.
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM — the FTS-upsert cost-scaling claims are static-inferred from the JOIN shape; the actual per-rename row count for a widely-used tag is not benchmarked.
- upstream_callers: MEDIUM — the REST entry point is HIGH; the UI caller component and its dispatch multiplicity are an unresolved REFERENCE.
- downstream_side_effects: HIGH — the data-entity tag-vector arm is traced to the SQL; the dataset-structure and term-search arms are traced to the call site (the term-search arm's SQL is a REFERENCE to ReactiveTermSearchEntrypointRepositoryImpl, not read this session).
- stress_findings: MEDIUM — 17 of 18 questions are STATIC-INFERRED with strong evidence; one load-bearing question (the FTS-upsert overwrite-vs-append behaviour) is PROBE-NEEDED (P-025). The single PROBE-NEEDED is well under half of the load-bearing questions, but the search-vector overwrite semantics are load-bearing for the "rename leaves no stale token" claim, so MEDIUM is the honest annotation pending P-025.

## Maintainer notes

(none)
