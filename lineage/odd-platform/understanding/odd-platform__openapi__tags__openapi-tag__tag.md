---
node_id: "odd-platform openapi tags openapi-tag:tag"
node_kind: openapi-tag
axis: openapi_tags
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-21-TAGGING-batch-openapi-tag
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control
---

# openapi-tag `tag` — semantic understanding

## understanding

The `tag` OpenAPI tag is the platform-spec's grouping label for the four
operations that own the **tag-directory vocabulary surface** — the
create / read / update / delete operations on the global `Tag` resource,
all under the `/api/tags` URL prefix. It is declared as a bare `name: tag`
entry in the spec's top-level `tags:` block (`openapi.yaml:19` — no
`description`, no `externalDocs`) and is referenced verbatim by each of the
four operations via a single-element `tags: [tag]` array. The tag's scope
is intentionally narrow — directory-vocabulary CRUD addressed by tag id or
the global `/api/tags` collection — and explicitly EXCLUDES the per-entity
tag-ASSIGNMENT operations (`PUT /api/dataentities/{id}/tags`,
`PUT /api/terms/{term_id}/tags`, `PUT /api/datasetfields/{id}/tags`), which
are tagged with their parent resource (`dataEntity` / `term` / `datasetField`)
rather than `tag`. The four operations generate a `TagApi` Java interface
implemented by `TagController` (verified — `TagController.java:18`) and a
`TagApi` TS client section. The contract carries no `security:` block and
no `components.securitySchemes` (verified — exhaustive grep on `openapi.yaml`
+ `components.yaml` at commit `ede5d277` returns zero matches), so every
authorization decision is invisible to the spec; and the spec embeds two
load-bearing drifts described below (`getPopularTagList`'s `description`
asserts a popularity sort the implementation does not perform — LSN-019;
the `ids` parameter is described as "Entity ids" but filters by tag id —
LSN-020 class).

## concepts

- entities: [
    "`Tag` — single-tag response shape (`components.yaml:302-320`): `id` (int64), `name` (string), `important` (boolean), `external` (boolean), `usedCount` (int64). `id` + `name` are the only `required` fields. Returned by `updateTag` and as the element type of `createTag`'s `TagList` response.",
    "`TagList` — `type: array` of `Tag` (`components.yaml:321-324`); the response body schema of `createTag`.",
    "`TagsResponse` — paginated wrapper `{items: TagList, page_info: PageInfo}` (`components.yaml:326-335`, both `required`); the response body of `getPopularTagList`.",
    "`TagFormData` — single-tag input shape `{name: string (required), important: boolean}` (`components.yaml:337-345`); the request body of `updateTag` and the element type of `BulkTagFormData`.",
    "`BulkTagFormData` — `type: array` of `TagFormData` (`components.yaml:347-350`); the request body of `createTag`.",
    "`tag_id` — int64 path parameter inline-declared (NOT a `$ref` component) on both `/api/tags/{tag_id}` operations (`openapi.yaml:387-392, 413-418`).",
    "`PageParam` / `SizeParam` — `required: true` int32 query params (`components.yaml:4213-4229`) on `getPopularTagList`; neither declares `minimum`, `maximum`, or `default`.",
    "`SearchParam` (`query`) — `required: false` string query param (`components.yaml:4231-4238`) on `getPopularTagList`; a tag-name substring filter at runtime.",
    "`IdsParam` (`ids`) — `required: false` int64-array query param (`components.yaml:4239-4248`) on `getPopularTagList`; its `description` field reads `Entity ids`, but the implementation binds it as a TAG-id-set filter (see `stress_findings.request_inputs` + `bugs_limitations_corner_cases`).",
    "`Deleted` — the shared empty-body 204 response component (`components.yaml:4401-4402`); referenced by `deleteTag`."
  ]
- operations: [
    "`getPopularTagList` — `GET /api/tags` (`openapi.yaml:343-360`). Summary `List of popular tags`; description `Gets the list of existing tags sorted by popularity`. Params: `PageParam`, `SizeParam`, `SearchParam`, `IdsParam`. Response: `200` → `TagsResponse`. Single tag: `[tag]`.",
    "`createTag` — `POST /api/tags` (`openapi.yaml:361-379`). Summary `Create a tag`; description `Creates a tag`. Request body `BulkTagFormData` (required). Response: `201` → `TagList`. Single tag: `[tag]`.",
    "`updateTag` — `PUT /api/tags/{tag_id}` (`openapi.yaml:382-407`). Summary `Update tag`; description `Updates existing tag`. Path param `tag_id` (int64, required). Request body `TagFormData` (required). Response: `201` → `Tag`. Single tag: `[tag]`.",
    "`deleteTag` — `DELETE /api/tags/{tag_id}` (`openapi.yaml:408-423`). Summary `Delete tag`; description `Deletes existing tag`. Path param `tag_id` (int64, required). Response: `204` → `Deleted` (empty body). Single tag: `[tag]`."
  ]
- invariants: [
    "The tag is declared with `name: tag` only — no `description`, no `externalDocs` (`openapi.yaml:19`). A tool consuming the raw spec (Swagger UI / ReDoc / Stoplight) renders the tag heading with no per-tag blurb and no machine-readable link to the docs site.",
    "All four operations share the `/api/tags` URL prefix; conversely every `/api/tags*` operation in the spec is tagged `tag` (no leakage). Per-entity tag-ASSIGNMENT operations live under `dataEntity` / `term` / `datasetField`, not `tag` — the tag rollup owns the directory-vocabulary CRUD only.",
    "Every operation carries a single-element `tags: [tag]` array (`openapi.yaml:359-360, 378-379, 406-407, 422-423`) — the spec never exercises OpenAPI's multi-tag capability; the OpenAPI generator produces a 1:1 operation-to-`TagApi`-method mapping.",
    "The spec declares NO top-level `security:` block and NO `components.securitySchemes` (verified by exhaustive grep on `openapi.yaml` + `components.yaml` at `ede5d277`). All four `tag`-tagged operations inherit no spec-level security requirement; authorization is enforced entirely downstream of the generated `TagApi` interface (`SecurityConstants.SECURITY_RULES`, verified — `TagController` sidecar `SecurityConstants.java:138-142`).",
    "No operation declares any `4xx` response — `getPopularTagList` declares only `200`; `createTag` / `updateTag` only `201`; `deleteTag` only `204`. A spec consumer cannot anticipate `401` / `403` / `404` (tag id not found) / `400` (duplicate name) error envelopes from the contract.",
    "`createTag` and `updateTag` declare `'201'` (`openapi.yaml:372, 400`); the `TagController` implementation returns `200` via `ResponseEntity::ok` (`TagController.java:27, 51`) — a spec-vs-implementation status-code drift on both write operations.",
    "`getPopularTagList`'s `description` (`openapi.yaml:345`) asserts results are `sorted by popularity`; the implementation chain selects the OLDEST `size` tags by `TAG.ID ASC` before any usage count is computed (LSN-019; see `stress_findings.name_behavior_pairs` + `docs_link_semantic.doc_drift_findings` + P-010)."
  ]
- audiences: [
    "OpenAPI generator — server-side produces the `TagApi` interface implemented by `TagController` (`TagController.java:5, 18`); client-side produces a `TagApi` TS class consumed by odd-platform-ui.",
    "Human readers navigating the spec by tag in Swagger UI / ReDoc / Stoplight — they see a bare `tag` heading with no description.",
    "odd-platform-ui Management → Tags tab (the three write operations) and the Catalog Overview Top-tags chip strip + tag-search facet (the read operation).",
    "platform-operator authoring RBAC — granting `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE`; the spec gives them no signal about which operations need which permission.",
    "Documentation site — `features/data-discovery/tagging` is the conceptual home (WebFetched 2026-05-21, status 200); `developer-guides/api-reference` is the contract index but enumerates no tag endpoint (WebFetched 2026-05-21, status 200)."
  ]

## dependencies_semantic

- requires-feature: [
    "Manual Object Tagging (P-01:F-018) — the tag's existence presupposes the tag-directory domain in the platform. Live doc: `https://docs.opendatadiscovery.org/features/data-discovery/tagging` (status 200, WebFetched 2026-05-21).",
    "The ODD authorization framework (Policies / Permissions) — the three write operations are gated by `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE`, enforced downstream of the generated interface, NOT in the spec."
  ]
- requires-config: [] — N/A. The spec is configuration-agnostic; no `tag`-tagged operation references a config key.
- requires-runtime: [
    "OpenAPI 3.0.3 generator toolchain — the tag drives Java-interface (`TagApi`) and TS-client code generation; the generator's tag-to-class-name convention (`tag` → `TagApi`) names the controller's parent interface.",
    "Java `TagController` (controller-class node) — `implements TagApi` and re-implements all four operations as reactive delegations (verified — `TagController.java:18, 22-52`)."
  ]
- couples-to: [
    "`components.yaml` schemas: `Tag`, `TagList`, `TagsResponse`, `TagFormData`, `BulkTagFormData`, `PageInfo`, `ErrorResponse` (indirectly via shared `responses`) — every `tag`-tagged operation `$ref`s at least one (`openapi.yaml:358, 370, 377, 398, 405`).",
    "`components.yaml` parameters: `PageParam`, `SizeParam`, `SearchParam`, `IdsParam` (`openapi.yaml:348-351`).",
    "`components.yaml` response: `Deleted` (`openapi.yaml:421`).",
    "Java `TagController` (controller-class node) — the controller implements `TagApi` and carries all four operations (verified — `odd-platform__java__TagController__controller-class__TagController.md`, `TagController.java:18, 22-52`).",
    "TS odd-platform-ui tag API client — generated from the same tag, consumed by the Management Tags tab and the Catalog Overview Top-tags strip (cross-axis; not enriched in this sidecar — REFERENCE)."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
    - behaviour: "Spec-level lint — a CI gate asserting every operation under tag `tag` has a non-empty `summary` and `description`. Visually confirmed all four do (`openapi.yaml:344-345, 362-363, 383-384, 409-410`), but no automated check exists in this repo."
      test_class: integration
      criticality: LOW
      note: "Specification-level static check; would live in a build script or CI workflow."
    - behaviour: "Tag-scope coherence — a CI assertion that every operation tagged `tag` has URL prefix `/api/tags` AND vice versa. Currently held by convention only."
      test_class: integration
      criticality: LOW
    - behaviour: "Tag-vs-controller method-count parity — assert the count of operations tagged `tag` (4) equals the count of public methods on `TagController` (4). A future drift would not be caught."
      test_class: integration
      criticality: LOW
    - behaviour: "Status-code contract — assert `createTag` / `updateTag` actually return the declared `201`. They return `200` (`TagController.java:27, 51`); no test pins the spec-vs-code drift."
      test_class: integration
      criticality: MEDIUM
    - behaviour: "`getPopularTagList` popularity-ordering contract — assert the operation's `description: 'sorted by popularity'` is honoured. It is not (LSN-019); pinned by P-010 at the implementation layer; no spec-conformance test exists."
      test_class: integration
      criticality: HIGH
    - behaviour: "`ids` parameter semantics — assert the `IdsParam`-described `Entity ids` parameter on `getPopularTagList` filters by what the description says. It filters by tag id (LSN-020 class); the placeholder probe P-031 pins this."
      test_class: integration
      criticality: MEDIUM
- test_files: [] — N/A. No spec-level test harness exists in this repo at commit `ede5d277` (verified by absence in CI workflow files; consistent with the alert / dataEntity openapi-tag sidecars). The controller-layer test gap is documented in `odd-platform__java__TagController__controller-class__TagController.md` (zero tests for `TagController`).
- gaps: |
    The tag is a contract-level concept with no runtime test target of its
    own. The highest-leverage gap is **spec-conformance of the two declared
    drifts**: (a) `getPopularTagList`'s `description` claims a popularity
    sort the JOOQ chain does not perform — P-010 pins the implementation
    behaviour but nothing asserts the SPEC's claim is wrong; (b) the `ids`
    parameter description (`Entity ids`) misdescribes a tag-id filter.
    integration is the worst-covered class on this node — there is no
    contract test, no controller test (verified — `TagController` sidecar),
    and the live `developer-guides/api-reference` page enumerates no tag
    endpoint, so neither the spec nor the docs nor the tests pin the
    `tag`-surface behaviour. A future operation added under `tags: [tag]`
    (or moved out) would be caught by nothing.

## docs_link_semantic

- declared_docs: [] — N/A. The OpenAPI spec's `tags:` block uses only `name:` for `tag` (`openapi.yaml:19`); no `externalDocs` field is declared, so the spec carries no maintainer-declared doc URL for this tag.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "The user-facing Tag UX page — the conceptual home for the tag-directory vocabulary the four `tag`-tagged operations CRUD. It documents the three RBAC permissions by name and the Top-tags chip strip that consumes `getPopularTagList`."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      WebFetch 2026-05-21, status 200. The page describes tag creation
      ("open the entity (or column) detail surface, click the
      tag-management control, and pick from the existing tag vocabulary
      or create a new tag inline" + "creation happens at Management →
      Tags for curating the vocabulary"). On popular tags it states: "The
      most-used tags surface as the Top tags chip strip on the Catalog
      Overview home page — one-click filter into the catalog." It lists
      three RBAC permissions in a table: TAG_CREATE ("Create a new tag in
      the catalog vocabulary"), TAG_UPDATE ("Edit a tag's name or its
      Important flag"), TAG_DELETE ("Remove a tag from the catalog
      vocabulary"). The page does NOT describe what happens when a tag is
      deleted (no cascade behaviour documented).
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "The documented entry-point for the platform's HTTP API; the contract index page. The four `tag`-tagged operations are part of that API but the page does not enumerate them."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetch 2026-05-21, status 200. The page does NOT document the
      /api/tags HTTP endpoints (createTag / deleteTag / getPopularTagList
      / updateTag) and does NOT mention an OpenAPI tag named 'tag'. It
      redirects readers to Swagger UI: "The Swagger UI hosted on every
      running ODD Platform is the place to interactively test the
      endpoints documented above against your own deployment." It also
      states the full spec is "odd-platform → odd-platform-specification/
      openapi.yaml". (Same redirect-to-Swagger posture the dataEntity
      openapi-tag sidecar recorded.)
- doc_drift_findings:
  - "**LSN-019 — popularity-ordering drift, present in BOTH the spec AND the docs.** `getPopularTagList`'s OpenAPI `description` (`openapi.yaml:345`) literally states `Gets the list of existing tags sorted by popularity`, and the live tagging page (WebFetched 2026-05-21, 200) states `The most-used tags surface as the Top tags chip strip`. The implementation does NOT sort by popularity at the row-selection step — it selects the OLDEST `size` tags by `TAG.ID ASC` (creation order) via the inner `paginate(..., [TAG.ID ASC], ...)` BEFORE counting, then re-orders only those rows by count DESC (verified — `odd-platform__java__TagController__controller-class__TagController.md`, `ReactiveTagRepositoryImpl.java:144-158`, `JooqQueryHelper.java:63-90`; empirically reproduced by maintainer 2026-05-20; pinned by P-010). Operator-visible: a deployment with > `size` tags where recent tags are popular renders OLD-and-unused tags as 'Top tags'. The spec's `description` is itself a wrong claim — not just the rendered docs."
  - "The `tag` tag carries no `description` and no `externalDocs` (`openapi.yaml:19`). A consumer rendering the raw spec via Swagger UI / ReDoc / Stoplight sees only the tag name with no per-tag blurb and no link to the docs site. Recommend adding `description: |` (one-paragraph blurb) and `externalDocs.url` pointing at `features/data-discovery/tagging` to make the binding machine-readable. (Same shape as the alert openapi-tag finding.)"
  - "The live `developer-guides/api-reference` page (WebFetched 2026-05-21, 200) enumerates none of the four `tag`-tagged operations and redirects readers to Swagger UI. There is no automated check that any doc page's endpoint enumeration stays in sync with the `tag`-tagged operations; an added/removed operation would not auto-reflect anywhere in the docs."
  - "The live tagging page (WebFetched 2026-05-21, 200) documents `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` for the directory operations but does NOT state that `deleteTag` cascades — the `TagController` sidecar establishes the cascade is asymmetric (`tag_to_term` + `tag_to_data_entity` hard-deleted; `tag_to_dataset_field` left as orphans). The doc is silent on the deletion blast radius."
  - "The spec encodes no `security:` and no `securitySchemes`; a consumer reading the contract cannot derive that the three write operations need `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` while `getPopularTagList` needs only `authenticated()`. The live docs name the three write permissions but neither doc nor spec states `getPopularTagList` has no RBAC gate beyond authentication (verified gap — `TagController` sidecar, `SecurityConstants.java:138-142`)."

## implicit_adrs

- "OpenAPI tags in this spec follow URL-prefix scoping — a tag's operations all share a `/api/<plural-noun>` URL prefix. The `tag` tag scopes only `/api/tags*` operations; the per-entity tag-ASSIGNMENT operations under `/api/dataentities/{id}/tags`, `/api/terms/{id}/tags`, `/api/datasetfields/{id}/tags` are tagged with the PARENT resource, not `tag`. This produces a resource-shaped `TagApi` interface owning directory-vocabulary CRUD only." — evidence: openapi.yaml:19 (`name: tag`) + openapi.yaml:342-423 (4 operations all under `/api/tags*`, all tagged `tag`) — intent_anchor: "Consistent URL-prefix-to-tag mapping across the entire `tags:` block — every tag in the spec follows the same `/api/<noun>` rule; the convention applied uniformly IS the architectural statement (matches the alert + dataEntity openapi-tag sidecars' identical finding)" — confidence: HIGH
- "Tags are declared as bare `name:` entries — no `description`, no `externalDocs`. The spec's tag-block is a flat namespace registry, not a documentation surface; per-tag conceptual blurbs and doc-links live in the human-readable docs site, not the spec." — evidence: openapi.yaml:13-48 (entire `tags:` block — all 34 entries are `- name: <tagname>` with no further fields) — intent_anchor: "Every one of the 34 tag entries is a single `- name:` line with zero additional fields — the uniform shape across the whole block is the decision" — confidence: HIGH
- "Each operation is tagged with EXACTLY ONE tag (single-element `tags: [tag]` arrays on all four operations). The spec never exercises OpenAPI's multi-tag capability, committing the generator to a 1:1 operation-to-`*Api`-interface mapping." — evidence: openapi.yaml:359-360, 378-379, 406-407, 422-423 (every `tags:` array on a `tag` operation is a single-element list) — intent_anchor: "Single-element arrays repeated across all four operations and consistent with every other tag in the spec — the 1:1 mapping is intentional and uniform" — confidence: HIGH
- "Authorization is wholly out-of-band of the OpenAPI contract — no `security:` block, no `securitySchemes`, no per-operation `security:`. The contract commits the platform to enforcing auth in Spring Security wiring downstream of the generated interface; the spec cannot be used by a tool to derive who-can-call-what." — evidence: openapi.yaml:1-49 (no `security:` block) + openapi.yaml:343-423 (no per-operation `security:` on any of the four operations) + components.yaml grep (no `securitySchemes`) — intent_anchor: "Total absence of any security construct across the whole spec — a deliberate convention (consistent with the alert + dataEntity openapi-tag sidecars); the spec is a shape contract, not an access-control contract" — confidence: HIGH

## bugs_limitations_corner_cases

- "**`getPopularTagList` description-vs-implementation drift (LSN-019).** `openapi.yaml:345` states `Gets the list of existing tags sorted by popularity`. The implementation (verified — `odd-platform__java__TagController__controller-class__TagController.md` + `ReactiveTagRepositoryImpl.java:144-158` + `JooqQueryHelper.java:63-90`) selects the OLDEST `size` tags by `TAG.ID ASC` BEFORE any usage count is computed; the outer `ORDER BY count DESC` re-sorts only the already-selected rows and cannot reach tags excluded by the inner LIMIT. With > `size` tags where recent tags are popular, the response contains the OLDEST `size` and the actual-most-popular are missing. The DRIFT is in the spec's own `description` text, not merely the rendered docs — a spec consumer reading the contract is told the result is popularity-sorted. Pinned by P-010 (LSN-019 smoking-gun probe)." — evidence: openapi.yaml:345 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + lineage/odd-platform/probes/P-010.yaml — severity: HIGH
- "**`IdsParam` describes the `ids` query parameter as `Entity ids` but `getPopularTagList` filters by TAG id (LSN-020 class).** `getPopularTagList` references the SHARED `IdsParam` component (`openapi.yaml:351` → `components.yaml:4239-4248`), whose `description` reads `Entity ids`. The `TagController` binds that parameter as `List<Long> ids` and passes it to `tagService.listMostPopular(query, ids, page, size)` (`TagController.java:36-44`); the `TagController` + `TagServiceImpl` sidecars both establish `ids` is a TAG-id-set filter on the tag directory. A consumer reading the rendered spec for `getPopularTagList` would supply DATA-ENTITY ids and receive empty/nonsensical results. The `IdsParam` component is shared — its `Entity ids` description IS accurate for the other consumer (`openapi.yaml:139`, a data-entity-scoped operation) — so the defect is operation-LOCAL: a tag-scoped operation reuses an entity-scoped parameter component. Pinned by the placeholder probe P-031. Recommend a dedicated `TagIdsParam` component or an operation-level parameter override." — evidence: openapi.yaml:351 + components.yaml:4239-4248 + TagController.java:36-44 + odd-platform__java__service__TagServiceImpl.md — severity: MEDIUM
- "**Status-code drift on `createTag` and `updateTag`.** Both operations declare `'201'` under `responses:` (`openapi.yaml:372, 400`); `TagController` returns `200` via `ResponseEntity::ok` (`TagController.java:27, 51`). A consumer generating a strict client from the spec expects `201` and may treat the actual `200` as an unexpected status. Same drift class as `TermController.createTerm`." — evidence: openapi.yaml:372, 400 + TagController.java:27, 51 — severity: MEDIUM
- "No operation under `tag` declares any `4xx` response — `getPopularTagList` declares only `200`, `createTag` / `updateTag` only `201`, `deleteTag` only `204` (`openapi.yaml:352-358, 371-377, 399-405, 419-421`). A spec consumer cannot anticipate `401 Unauthorized`, `403 Forbidden` (missing `TAG_*`), `404` (tag id not found — `updateTag` / `deleteTag` raise `NotFoundException` per the `TagController` sidecar), or `400` (duplicate name — `createTag` raises `UniqueConstraintException`). Error envelopes are entirely out-of-band; the `ErrorResponse` component exists (`components.yaml`) but no `tag` operation references it." — evidence: openapi.yaml:352-421 (every `tag` operation declares only its success status) — severity: MEDIUM
- "The `tag` tag has no `description` and no `externalDocs` (`openapi.yaml:19`). A consumer rendering the spec via Swagger UI / ReDoc / Stoplight sees only the tag name with no per-tag conceptual blurb and no link to `features/data-discovery/tagging`. The binding to the docs page is editorial-only — not encoded in the spec." — evidence: openapi.yaml:19 (single-line `- name: tag`) + WebFetch features/data-discovery/tagging (status 200, 2026-05-21) — severity: LOW
- "There is no automated parity check between (a) the count of operations tagged `tag` (4), (b) the count of public methods on `TagController` (4), and (c) any doc-page enumeration. The `developer-guides/api-reference` page enumerates zero tag endpoints (WebFetched 2026-05-21, 200), so the doc side of the parity is empty. A future operation added under `tags: [tag]` would be caught by nothing." — evidence: openapi.yaml:342-423 (4 operations) + TagController.java:18, 22-52 (4 `@Override` methods) + WebFetch developer-guides/api-reference (200, no tag endpoints) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "components.yaml:4222-4229 (SizeParam, referenced by openapi.yaml:349)"
      name: "size (SizeParam schema)"
      value: "int32, required: true, NO minimum / maximum / default"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "The spec places no constraint — `size=0` and `size=1` are both contract-valid. Runtime behaviour is decided by the implementation, not the contract: per the TagController sidecar's stress_findings, `size=0` produces an empty list and `size=1` selects the OLDEST tag by TAG.ID ASC. The CONTRACT itself is silent — a spec-only consumer learns nothing about the empty-state or single-row edge."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4222-4229 (no minimum) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (stress_findings.tunables size)"
        - q: "What at N = tunable + 1 / tunable × 100?"
          a: "There is no `maximum` on SizeParam, so there is no spec-defined truncation boundary — `size=2147483647` is contract-conformant. The operator-visible truncation point is set by the runtime (LSN-019 drift surfaces whenever `size` < total tag count). `size=100000` is accepted with no spec-level warning; the implementation runs a full-directory aggregate (REFERENCE — TagController sidecar performance.known_performance_gaps)."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4222-4229 (no maximum) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md"
        - q: "What at null / negative / non-numeric?"
          a: "The spec types `size` as int32 `required: true`, so a missing parameter is a contract violation (the OpenAPI-generated binding rejects it before the controller). `size=-1` is a negative int32 — contract-valid per the schema (no `minimum: 0`); the runtime consequence (the TagController sidecar reports a PostgreSQL `LIMIT -1` rejection → 500) is invisible to the contract. The spec SHOULD declare `minimum: 1` to make the negative case a contract violation rather than a runtime 500."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4222-4229 (int32, required, no minimum) + REFERENCE TagController sidecar stress_findings.tunables size Q3 (PROBE-NEEDED there)"
        - q: "What does the operator see at each boundary?"
          a: "Spec-side: nothing — the contract carries no boundary semantics. Operator-visible behaviour is the runtime's: `size` < total tags triggers the LSN-019 drift (oldest `size` returned, labelled 'popular'); `size` >= total tags returns the full directory in correct count-DESC order. The contract's omission of `minimum`/`maximum` is the gap."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4222-4229 + openapi.yaml:345 (description claims popularity sort) + lineage/odd-platform/probes/P-010.yaml"
    - location: "components.yaml:4213-4220 (PageParam, referenced by openapi.yaml:348)"
      name: "page (PageParam schema)"
      value: "int32, required: true, NO minimum / maximum / default"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "No spec constraint — `page=0` and `page=1` are both contract-valid. The runtime computes the offset; per the TagController sidecar the service signature is 1-based (`(page-1)*size`), so `page=0` yields a negative offset. The contract neither documents 1-based-ness nor forbids `page=0`."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4213-4220 (no minimum) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md"
        - q: "What at N = tunable + 1 / tunable × 100?"
          a: "Deep pages are contract-valid (no `maximum`). `page=10000` over a tag directory is offset-based pagination — O(offset) on PostgreSQL — but the spec encodes none of that cost. There is no cursor-paged alternative declared for the `tag` surface."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4213-4220 (no maximum)"
        - q: "What at null / negative / non-numeric?"
          a: "`page` is int32 `required: true`; a missing param is a contract violation rejected before the controller. `page=-1` is contract-valid per the schema. The spec should declare `minimum: 1` to encode the 1-based constraint."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4213-4220 (int32, required, no minimum)"
        - q: "What does the operator see at each boundary?"
          a: "Spec-side: nothing. The contract carries no page-boundary semantics; the runtime decides. The omission of `minimum: 1` is the gap a spec-conformance reviewer would flag."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4213-4220"
  name_behavior_pairs:
    - name: "getPopularTagList (operationId) + GET /api/tags + summary 'List of popular tags' + description 'Gets the list of existing tags sorted by popularity'"
      promise: "The operationId, the summary ('popular tags'), and the description ('sorted by popularity') all promise the response is the existing tags ordered by descending usage/popularity — a popularity-ranked list."
      implementation: "The contract DELEGATES the behaviour to `TagController.getPopularTagList` → `tagService.listMostPopular` → `ReactiveTagRepositoryImpl.listMostPopular`. The implementation (verified — odd-platform__java__TagController__controller-class__TagController.md + odd-platform__java__service__TagServiceImpl.md) selects the OLDEST `size` tags by `TAG.ID ASC` via the inner `paginate(homogeneousQuery, [new OrderByField(TAG.ID, SortOrder.ASC)], offset, size)` (ReactiveTagRepositoryImpl.java:148) BEFORE any usage count is computed; `JooqQueryHelper.paginate` (:63-90) emits `ORDER BY id ASC LIMIT size OFFSET offset` as the row-selection step; only the so-selected rows enter the CTE; the outer `cteSelect.orderBy(field(COUNT_FIELD).desc())` (:158) re-orders THOSE rows by count DESC but cannot reach tags excluded by the inner LIMIT."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "With more than `size` tags in the directory, the response contains the OLDEST `size` tags by creation order, NOT the `size` most-popular. The UI's 'Top tags' chip strip renders this. Maintainer's 2026-05-20 empirical test (35 equally-popular tags) returned the OLDEST 30 by created_at ASC. The OpenAPI `description` text itself asserts the false claim — the drift is in the contract, not only the rendered docs."
      confidence: STATIC-INFERRED
      evidence: "openapi.yaml:345 (the description) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + lineage/odd-platform/probes/P-010.yaml"
    - name: "createTag (operationId) + POST /api/tags + summary 'Create a tag' + description 'Creates a tag'"
      promise: "The operationId and summary use singular 'a tag' — promising the operation creates ONE tag."
      implementation: "The request body is `BulkTagFormData` (`openapi.yaml:370`), a `type: array` of `TagFormData` (`components.yaml:347-350`); the response is `TagList` (`type: array` of `Tag`). The operation is a BULK create — N tags per request — despite the singular summary. `TagController.createTag` accepts `Flux<TagFormData>` and `.collectList()`s the whole batch (`TagController.java:23-27`)."
      drift: MINOR
      operator_visible_consequence: "The summary 'Create a tag' understates the operation — it is a bulk create. A consumer reading the summary alone (Swagger UI tag-collapsed view) would not realise they can submit many tags in one call. The request/response schemas make the bulk shape unambiguous; the drift is summary-text only, not behavioural."
      confidence: STATIC-INFERRED
      evidence: "openapi.yaml:362-377 (summary 'Create a tag' vs BulkTagFormData body + TagList response) + components.yaml:347-350"
  orderings:
    - location: "openapi.yaml:345 (getPopularTagList description) + openapi.yaml:343-360 (the operation; the spec declares no ORDER BY itself)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the SQL the database executes)?"
          a: "The OpenAPI spec encodes NO ordering construct — it states the intent in prose (`description: sorted by popularity`) and delegates execution entirely to the controller. The actual lowest-layer ordering is two-level: INNER `paginate(...)` emits `ORDER BY id ASC LIMIT size OFFSET offset` (the selection step); OUTER `cteSelect.orderBy(field(COUNT_FIELD).desc())` emits `ORDER BY count DESC` over the already-selected rows. The OUTER ordering does NOT change WHICH rows are returned. (Verified — TagController sidecar stress_findings.orderings; this openapi-tag node REFERENCES that trace.)"
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:343-360 (no ORDER BY in the spec) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (stress_findings.orderings) + ReactiveTagRepositoryImpl.java:144-158"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "The spec declares no tie-breaker (it declares no ordering at all). At the implementation layer: the INNER `TAG.ID ASC` is deterministic (serial PK, never tied); the OUTER `ORDER BY count DESC` has no secondary key, so equal-count rows fall in PostgreSQL's implementation-defined order — but because the INNER step already fixed the row SET by TAG.ID ASC, the operator-visible effect for equal counts is creation order. (REFERENCE — TagController sidecar.)"
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:343-360 (no ordering declared) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md"
        - q: "Which subset is returned when result-set > page size?"
          a: "The spec declares offset-based pagination (`page` + `size`) but no rule for which subset — it relies on the (false) `sorted by popularity` prose. The implementation returns the FIRST `size` tags by TAG.ID ASC (the OLDEST). This is the LSN-019 drift; pinned by P-010."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:345, 348-349 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md + lineage/odd-platform/probes/P-010.yaml"
        - q: "Does any upstream layer (UI, service) re-sort or filter the result?"
          a: "The contract is the OpenAPI tag itself — there is no 'upstream layer' at the spec level. The Java service (`TagServiceImpl.listMostPopular`) does NOT re-sort (verified — TagServiceImpl sidecar); the UI Top-tags chip strip renders `items` in delivered order (REFERENCE — UI sidecar not yet enriched). No layer corrects the LSN-019 drift."
          confidence: REFERENCE
          evidence: "REFERENCE odd-platform__java__service__TagServiceImpl.md + REFERENCE ui_route:catalog-overview (Top-tags chip strip — not yet enriched)"
  auth_gates:
    - location: "openapi.yaml:343-423 (the four tag operations) + openapi.yaml:1-49 (no global security:) + components.yaml (no securitySchemes)"
      endpoint: "GET /api/tags (getPopularTagList) + POST /api/tags (createTag) + PUT /api/tags/{tag_id} (updateTag) + DELETE /api/tags/{tag_id} (deleteTag)"
      questions:
        - q: "What does each endpoint return for DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The OpenAPI spec is auth-mode-agnostic — it declares no `security:` block, no `securitySchemes`, no per-operation `security:` (verified by exhaustive grep at ede5d277). A spec consumer learns NOTHING about per-mode behaviour from the contract. The actual per-mode behaviour is enforced downstream of the generated `TagApi` interface by `SecurityConstants.SECURITY_RULES` (verified — TagController sidecar: the three write operations gated by TAG_CREATE / TAG_UPDATE / TAG_DELETE; getPopularTagList by `authenticated()` only; DISABLED skips auth entirely)."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1-49 (no security:) + openapi.yaml:343-423 (no per-op security:) + components.yaml grep (no securitySchemes) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (auth_gates)"
        - q: "What does an unauthenticated caller see?"
          a: "Unknowable from the spec — the contract encodes no authentication requirement. Downstream (REFERENCE — TagController sidecar): LOGIN_FORM / OAUTH2 / LDAP return 401 (or 302 to login) on all four operations via the catch-all `authenticated()` rule; DISABLED returns the success status with no auth check."
          confidence: REFERENCE
          evidence: "openapi.yaml:1-49 (no security:) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (auth_gates Q2)"
        - q: "What does a wrong-role caller see?"
          a: "Unknowable from the spec. Downstream (REFERENCE — TagController sidecar): a READ_ONLY user with no `TAG_*` permission gets 200 + full directory on `getPopularTagList` (open-read posture) and 403 on each of the three write operations. The spec carries no `403` response shape, so a consumer cannot even anticipate the forbidden case exists."
          confidence: REFERENCE
          evidence: "openapi.yaml:343-423 (no 403 response declared) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (auth_gates Q3)"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "Not in the spec — the OpenAPI contract has no gate. The gate lives at the controller perimeter via `SecurityConstants.SECURITY_RULES` path-pattern matching (verified — TagController sidecar: service tier and repository tier have zero auth checks). From the spec's standpoint the gate is invisible: a contract-test generator or API gateway consuming this spec would derive no access control."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (auth_gates Q4)"
  resource_boundaries: []
  request_inputs:
    - location: "openapi.yaml:387-392 (updateTag tag_id) + openapi.yaml:413-418 (deleteTag tag_id)"
      input_kind: path-param
      input_name: "tag_id"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`tag_id` promises the int64 identifier of the tag to update / delete — a specific, well-named domain identifier."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:387-392, 413-418"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`TagController.updateTag(Long tagId, ...)` and `deleteTag(Long tagId, ...)` (TagController.java:31, 47) pass `tag_id` straight to `tagService.update(tagId, fd)` / `tagService.delete(tagId)`; the downstream `TagServiceImpl` uses it as the `tag.id` primary-key lookup (verified — TagServiceImpl sidecar). The name and the use match."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:387-392, 413-418 + TagController.java:30-34, 46-52 + REFERENCE odd-platform__java__service__TagServiceImpl.md"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `tag_id` is the `tag.id` primary key in both the name and the implementation."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:387-392, 413-418 + TagController.java:30-34, 46-52"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation; the parameter is honoured as named."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:387-392, 413-418"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `tag.id` is the matching column and it IS used."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:30-34, 46-52"
      routes_to_finding: "none — MATCHES"
    - location: "openapi.yaml:351 (getPopularTagList references IdsParam) + components.yaml:4239-4248 (IdsParam declaration)"
      input_kind: query-param
      input_name: "ids"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The parameter NAME `ids` is generic, but the `IdsParam` component's `description` field reads `Entity ids` (components.yaml:4242) — that description promises the caller is filtering by DATA-ENTITY identifiers. On the `getPopularTagList` operation (which returns tags), 'Entity ids' implies 'restrict to tags applied to these data entities' or similar entity-scoped filter."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4239-4248 (name: ids, description: Entity ids)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`TagController.getPopularTagList(..., List<Long> ids, ...)` (TagController.java:40) passes `ids` straight to `tagService.listMostPopular(query, ids, page, size)` (TagController.java:42). The TagController sidecar's `concepts.entities` states verbatim: `ids is an optional id-set filter`; the TagServiceImpl sidecar consumes `ids` and delegates to `reactiveTagRepository.listMostPopular(query, ids, page, size)`. The cross-referenced sidecars establish `ids` is a TAG-id-set filter on the tag directory — NOT a data-entity filter. The exact SQL bind column (`TAG.ID.in(ids)` vs other) is not visible within this openapi-tag node's 1-hop budget — see UNRESOLVED below."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (concepts.entities: 'ids is an optional id-set filter') + REFERENCE odd-platform__java__service__TagServiceImpl.md"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the `IdsParam` component description says `Entity ids`, but for the `getPopularTagList` operation the parameter filters the TAG directory by TAG id (per the TagController + TagServiceImpl sidecars). The translation is undocumented at the operation level: `getPopularTagList` does not override the shared component's description. An OpenAPI consumer reading the rendered spec has no way to know `ids` means tag ids here. The component IS shared and IS accurate for its other consumer (openapi.yaml:139, a data-entity-scoped operation) — so this is an operation-LOCAL silent translation caused by reusing an entity-scoped component on a tag-scoped operation. The exact SQL-bind confirmation is UNRESOLVED within this node — placeholder probe P-031 pins it."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: PROBE-NEEDED
          evidence: "components.yaml:4239-4248 + openapi.yaml:139, 351 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md + lineage/odd-platform/probes/P-031.yaml"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A caller who reads `Entity ids` and supplies DATA-ENTITY ids gets an empty page (none of those ids exist in the `tag` table — unless an id happens to collide with a tag id, in which case they get a nonsensical wrong tag). A caller who wants 'tags on these entities' cannot get it from this operation at all — the parameter does not do an entity-join. The drift survives cross-data scenarios: when a value is BOTH a valid data-entity id AND a valid tag id, the operation silently returns the tag, masking the misunderstanding. P-031 asserts exactly this collision case."
          confidence: PROBE-NEEDED
          evidence: "lineage/odd-platform/probes/P-031.yaml + REFERENCE odd-platform__java__TagController__controller-class__TagController.md"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE in the tag-directory query. The closest-aligned data the caller might expect (`tag_to_data_entity.data_entity_id` — which WOULD honour an 'Entity ids' filter) is not joined by `getPopularTagList`'s selection step. The cleaner fix is a dedicated `TagIdsParam` component (description 'Tag ids') OR an operation-level parameter override, NOT a column change."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4239-4248 + REFERENCE odd-platform__java__service__TagServiceImpl.md"
      routes_to_finding: "bugs_limitations_corner_cases[1] (IdsParam Entity-ids vs tag-id-filter) AND docs_link_semantic.doc_drift_findings (the shared-component misdescription is a spec-rendering drift)"
    - location: "openapi.yaml:350 (getPopularTagList references SearchParam) + components.yaml:4231-4238 (SearchParam declaration)"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`query` with `IdsParam`-sibling description `Search text` (components.yaml:4234) promises a free-text search filter — narrow the returned tags to those matching the supplied search string."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4231-4238 (name: query, description: Search text)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`TagController.getPopularTagList(..., String query, ...)` (TagController.java:39) passes `query` straight to `tagService.listMostPopular(query, ids, page, size)`. The TagController sidecar's `concepts.entities` states verbatim: `query is name-substring filter`; the TagServiceImpl sidecar describes the repository `query` as a case-insensitive `containsIgnoreCase` substring match on the tag name. The name 'Search text' and the use (tag-name substring search) are consistent."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:36-44 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (concepts.entities: 'query is name-substring filter') + REFERENCE odd-platform__java__service__TagServiceImpl.md"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `query` / 'Search text' is a tag-name substring filter; the description is generic enough ('Search text') that it does not over-promise. A minor caveat (not a drift): the description does not state the search is case-INSENSITIVE substring on the NAME field only (not on id or other attributes); but 'Search text' does not promise otherwise."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4231-4238 + REFERENCE odd-platform__java__service__TagServiceImpl.md"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation; 'Search text' is honoured as a tag-name search. The only subtlety: the TagServiceImpl sidecar notes the search path is case-INSENSITIVE while the directory WRITE path (divideTagsByExistence) is case-SENSITIVE — a UX inconsistency, but that belongs to the write path, not this read parameter."
          confidence: STATIC-INFERRED
          evidence: "REFERENCE odd-platform__java__service__TagServiceImpl.md (bugs_limitations_corner_cases — case-sensitivity)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the tag `name` column is the matching field and it IS searched."
          confidence: STATIC-INFERRED
          evidence: "REFERENCE odd-platform__java__service__TagServiceImpl.md"
      routes_to_finding: "none — MATCHES"
    - location: "openapi.yaml:365-370 (createTag request body, BulkTagFormData) + components.yaml:337-350"
      input_kind: body-field
      input_name: "BulkTagFormData / TagFormData.name + TagFormData.important"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`BulkTagFormData` is an array of `TagFormData`, whose fields are `name` (string, required) and `important` (boolean). `name` promises the tag's display name; `important` promises a flag marking the tag as important. Both names are unambiguous and domain-specific."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:337-350"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`TagController.createTag(Flux<TagFormData> tagFormData, ...)` (TagController.java:23) `.collectList()`s the batch and calls `tagService.bulkCreate(List<TagFormData>)`; the TagServiceImpl sidecar maps each `TagFormData` to a `TagPojo` (`name`, `important`) and bulk-INSERTs into the `tag` table. The fields are used as named — `name` → `tag.name`, `important` → `tag.important`."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:22-28 + REFERENCE odd-platform__java__service__TagServiceImpl.md"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `name` and `important` map directly to the homonymous `tag` columns. One spec-side WEAKNESS (not a name-drift): `TagFormData.name` is declared `type: string` only — no `pattern`, no `minLength`, no `maxLength` — so empty / whitespace / unbounded names are contract-valid (REFERENCE — TagController sidecar bugs_limitations_corner_cases 'no request-body validation')."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "components.yaml:337-345 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation; the body fields are honoured as named."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:337-350"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `tag.name` and `tag.important` are both written. The `tag.external` column is NOT settable via `TagFormData` (no `external` field) — this is intentional, not an available-but-unused smell: `external` is owned by the Collector ingestion path, never by the UI create (verified — TagServiceImpl sidecar invariant)."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:302-345 (Tag has `external`; TagFormData does not) + REFERENCE odd-platform__java__service__TagServiceImpl.md"
      routes_to_finding: "none — MATCHES (the no-validation weakness is already in bugs_limitations_corner_cases via the TagController sidecar reference)"
  probes_emitted:
    - probe_id: P-031
      question: "Category F — does the `ids` query parameter on getPopularTagList (declared via the shared IdsParam component, description 'Entity ids') actually filter by tag.id, as the TagController + TagServiceImpl sidecars claim? Pins the LSN-020-class input-name-vs-implementation drift."
      probe_path: "lineage/odd-platform/probes/P-031.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 33
    answers_static_inferred: 28
    answers_probe_needed: 2
    answers_reference: 3
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the four operations under tag `tag` are mounted at `/api/tags*`, the UI / API surface, so they run under the three modes that protect it; they only run under `DISABLED` in dev/test (auth bypassed) and never under `S2S` (S2S gates ingestion, not `/api/tags`). The spec itself is mode-agnostic — it declares no `security:` block and no `components.securitySchemes` (verified by exhaustive grep on `openapi.yaml` + `components.yaml` at commit `ede5d277`), so the runtime mode is decided entirely by Spring Security wiring downstream of the generated `TagApi` interface, not by the contract.
- **ingestion_filter_relevance**: `NO — UI/API surface (tag-directory CRUD), not ingestion`. The four operations are all under `/api/tags*`; the `IngestionDataEntitiesFilter` (gated by `auth.ingestion.filter.enabled`) matches only `/ingestion/entities`. None of the `tag`-tagged operations participate in the ingestion-filter flow. (Note: the global tag DIRECTORY is also mutated by the Collector S2S ingestion path via `ExternalTagIngestionRequestProcessor` per the `TagController` sidecar — but that is a DIFFERENT operation under the `dataEntity`/ingestion surface, not one of the four operations this `tag` tag scopes.)
- **authorization_assertions**: `[]` at the spec level. None of the four operations declare a per-operation `security:` block, and no global `security:` block exists. The OpenAPI contract encodes ZERO authorization requirements for the `tag` tag — every authorization decision is made in Java by `SecurityConstants.SECURITY_RULES` downstream of the generated `TagApi` interface (verified — `odd-platform__java__TagController__controller-class__TagController.md`: POST→`TAG_CREATE`, PUT→`TAG_UPDATE`, DELETE→`TAG_DELETE`, all `NO_CONTEXT` Management scope; GET has no rule and inherits the catch-all `authenticated()`). Evidence: openapi.yaml:1-49 (no `security:`) + openapi.yaml:343-423 (no per-op `security:`) + components.yaml grep (no `securitySchemes`).
- **owner_scoping**: `N/A — the Tag directory has no owner concept`. The `tag` table has no `owner_id` column (per the `TagController` + `TagServiceImpl` sidecars); the directory is a flat, globally-shared namespace. No `tag`-tagged operation declares any owner / userId parameter, and the spec encodes nothing about per-Owner Tag filtering.
- **data_exposure**:
  - "`TagsResponse { items: Tag[], page_info }` from `getPopularTagList` → any authenticated user under LOGIN_FORM / OAUTH2 / LDAP (and any caller under DISABLED); no owner filter, no RBAC gate beyond `authenticated()`. Each `Tag` carries `id, name, important, external, usedCount`. The list is labelled 'popular' but is actually the OLDEST `size` by id (LSN-019). — evidence: openapi.yaml:343-358 + components.yaml:302-335"
  - "`TagList` (`Tag[]`) from `createTag` → the caller holding `TAG_CREATE`; the response echoes the created tags with assigned ids. — evidence: openapi.yaml:361-377 + components.yaml:321-324"
  - "`Tag` from `updateTag` → the caller holding `TAG_UPDATE`. — evidence: openapi.yaml:382-405 + components.yaml:302-320"
  - "No body from `deleteTag` (204 `Deleted`). — evidence: openapi.yaml:408-421 + components.yaml:4401-4402"
- **known_security_gaps**:
  - "Spec declares NO `security:` block at top level, NO `components.securitySchemes`, and NO per-operation `security:` overrides on any of the four `tag`-tagged operations (verified by exhaustive grep at `ede5d277`). A spec consumer (API gateway, contract-test generator, third-party SDK builder) cannot derive auth requirements from the contract — the three write operations need `TAG_CREATE`/`TAG_UPDATE`/`TAG_DELETE` and `getPopularTagList` needs only `authenticated()`, but the spec encodes none of it." — evidence: openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep — severity: HIGH
  - "No `4xx` response shapes are declared on any of the four operations — `getPopularTagList` declares only `200`, `createTag`/`updateTag` only `201`, `deleteTag` only `204`. A spec consumer cannot anticipate `401`, `403` (missing `TAG_*`), `404` (tag id not found), or `400` (duplicate name). The forbidden / not-found cases are invisible to the contract." — evidence: openapi.yaml:352-421 — severity: MEDIUM
  - "`getPopularTagList` has no spec-level owner filter, no RBAC marker, and no parameter restricting scope — spec-side any authenticated caller may page the entire tag directory. The downstream open-read posture (verified — `TagController` sidecar: no GET SecurityRule) means a user with no `TAG_*` permission still enumerates the whole directory; the contract surfaces none of this." — evidence: openapi.yaml:343-358 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md — severity: MEDIUM
  - "The three write operations carry no spec-level authorization marker — a consumer cannot tell `createTag`/`updateTag`/`deleteTag` are Management-scoped operations restricted to `TAG_*` permission holders. Runtime enforcement is opaque to the contract." — evidence: openapi.yaml:361-423 (operations declare only request body + path param) — severity: MEDIUM

## performance

- **hot_paths**:
  - "`getPopularTagList` (GET /api/tags) — the tag-directory read; the live tagging page (WebFetched 2026-05-21, 200) confirms its result feeds the Catalog Overview Top-tags chip strip, a home-page surface hit on every Catalog Overview render. Spec-side it declares `page` + `size` as the only knobs; the runtime cost (a UNION-ALL CTE over `tag_to_data_entity` + `tag_to_dataset_field`) is determined by repository code, out of scope for the spec (REFERENCE — TagController sidecar performance.hot_paths)." — evidence: openapi.yaml:343-360
  - "`createTag` (POST /api/tags) — runs once per Management → Tags create action; the `BulkTagFormData` body allows multiple tags per request." — evidence: openapi.yaml:361-377
  - "`updateTag` / `deleteTag` — single-tag writes, one per Management → Tags edit / delete action." — evidence: openapi.yaml:382-423
- **throughput_characteristics**:
  - "Pagination IS declared on `getPopularTagList` — both `page` and `size` are `required: true` int32 query params via `$ref: PageParam` + `$ref: SizeParam` (components.yaml:4213-4229). Neither declares a `minimum`, `maximum`, or `default` — a caller may legally request `page=0, size=2147483647`; runtime guardrails (if any) are invisible from the spec." — evidence: components.yaml:4213-4229 + openapi.yaml:348-349
  - "No cursor-based pagination — the `tag` surface is offset-based only (`page` + `size`). For a large tag directory this is the known deep-page anti-pattern (O(offset))." — evidence: components.yaml:4213-4229
  - "`createTag` is bulk — `BulkTagFormData` accepts N tags per request (the only bulk operation in the tag tag). `updateTag` / `deleteTag` are single-tag — there is no bulk-update or bulk-delete operation in this tag; a UI flow editing or deleting M tags must issue M requests." — evidence: openapi.yaml:361-377 (bulk body) vs openapi.yaml:382-423 (single `tag_id` path param)
- **resource_allocation**: `N/A — spec-level concept`. The OpenAPI spec governs request/response shape, not runtime allocation. Response-size hints from the schemas: `TagsResponse.items` is an unbounded `TagList` array (no `maxItems`); since `SizeParam` has no `maximum`, a `size=2147483647` request is contract-valid and would materialise an arbitrarily large `Tag[]` response. `createTag`'s `BulkTagFormData` request body is likewise an unbounded array — a caller may submit an arbitrarily large batch (REFERENCE — TagController sidecar notes `.collectList()` makes the full batch resident in memory). — evidence: components.yaml:321-335, 347-350 + components.yaml:4222-4229.
- **scaling_characteristics**: `N/A — spec-level concept`. The spec encodes no statefulness, locking, queueing, or rate-limit information for the `tag` tag. List operations declare offset-based pagination (above). The contract carries one scaling-relevant hint: every `tag`-tagged operation is HTTP/JSON, single-request/single-response (no streaming, no SSE, no chunked-transfer) — `getPopularTagList` returns `application/json` `TagsResponse`, `createTag` returns `application/json` `TagList`, `updateTag` returns `application/json` `Tag`, `deleteTag` returns an empty 204. — evidence: openapi.yaml:354-421.
- **known_performance_gaps**:
  - "`SizeParam` declares no `maximum` and `PageParam` no `minimum` (components.yaml:4213-4229). A spec-conformant caller may request `size=2147483647`; the contract does not warn against it. Recommend adding `schema.maximum` to `SizeParam` (and `schema.minimum: 1` to both) to encode the constraint at contract level. (Same gap as the alert openapi-tag finding.)" — evidence: components.yaml:4213-4229 — severity: MEDIUM
  - "No cursor-based alternative is declared for `getPopularTagList`. Over a large tag directory, deep pages (`page=10000, size=100`) are O(offset). The spec does not surface this." — evidence: components.yaml:4213-4229 + openapi.yaml:343-360 — severity: LOW
  - "`updateTag` / `deleteTag` are single-tag only — bulk edit / bulk delete are not in the contract. A UI flow mutating M tags issues M requests, producing M controller invocations and M DB round-trips. Recommend a bulk variant if measurement shows mutate-many is a real flow." — evidence: openapi.yaml:382-423 — severity: LOW
  - "No rate-limit headers or `429` responses declared on any of the four operations. `getPopularTagList` feeds a home-page surface (Catalog Overview Top-tags strip) and is a candidate for frequent polling; the spec offers no `ETag` / `Cache-Control` / rate-limit guidance for automated consumers." — evidence: openapi.yaml:343-423 (no `x-ratelimit-*`, no `429`) — severity: LOW

## upstream_callers

- entry_point: "rest:GET /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.getPopularTagList"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:343-360 (the operation) — the OpenAPI generator produces the TagApi.getPopularTagList interface method that TagController implements"
  observation_class: rest-call
  unresolved: false

- entry_point: "rest:POST /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.createTag"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:361-379 (the operation)"
  observation_class: rest-call
  unresolved: false

- entry_point: "rest:PUT /api/tags/{tag_id}"
  caller_node: "rest_api:openapi-generated TagApi.updateTag"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:382-407 (the operation)"
  observation_class: rest-call
  unresolved: false

- entry_point: "rest:DELETE /api/tags/{tag_id}"
  caller_node: "rest_api:openapi-generated TagApi.deleteTag"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:408-423 (the operation)"
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/management/tags (Management Tags tab)"
  caller_node: "ts react-component:TagsList.tsx (per the TagController sidecar's audience analysis; the UI component is not enriched in this session)"
  multiplicity_per_trigger: unresolved
  evidence: "openapi.yaml:342-423 (the four operations) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (upstream_callers ui_route:/management/tags). The TS client is generated from this `tag` tag; the per-mount dispatch multiplicity is REFERENCE — the UI-route sidecar is not yet enriched."
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:catalog-overview (Top-tags chip strip)"
  caller_node: "ts react-component:Overview.tsx (per the TagController sidecar's references)"
  multiplicity_per_trigger: unresolved
  evidence: "openapi.yaml:343-360 (getPopularTagList) + WebFetch features/data-discovery/tagging (status 200, 2026-05-21 — 'The most-used tags surface as the Top tags chip strip on the Catalog Overview home page') + REFERENCE the catalog-overview UI sidecar (not yet enriched)"
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns the `TagsResponse` payload (items + page_info) to the caller of `getPopularTagList`. The items are the OLDEST `size` tags by id (LSN-019 drift) — the spec's `description` claims popularity-sorted; the implementation does not deliver that."
  evidence: "openapi.yaml:343-360 + components.yaml:326-335 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (downstream_side_effects)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/tags"
    - "ui_route:/management/tags"
    - "ui_route:catalog-overview"

- side_effect_class: db-write
  description: "`createTag` INSERTs N tag rows into the `tag` table (one per element of the `BulkTagFormData` array); each new tag becomes immediately readable to every authenticated user via `getPopularTagList`. (The exact db-write chain is owned by TagServiceImpl / ReactiveTagRepositoryImpl — see those sidecars; this openapi-tag node records that the `createTag` contract surface is the entry point.)"
  evidence: "openapi.yaml:361-377 (BulkTagFormData request, TagList response) + REFERENCE odd-platform__java__service__TagServiceImpl.md (downstream_side_effects)"
  cardinality_per_call: "N (BulkTagFormData array length)"
  reachable_from_entry_points:
    - "rest:POST /api/tags"
    - "ui_route:/management/tags"

- side_effect_class: db-write
  description: "`updateTag` UPDATEs one `tag` row (rename / important-flag toggle) and triggers a search-vector reindex; `deleteTag` SOFT-deletes one `tag` row and HARD-deletes its `tag_to_term` + `tag_to_data_entity` relations (the `tag_to_dataset_field` relations are NOT cascaded — orphans persist; verified — TagController + TagServiceImpl sidecars). The contract surfaces only the success status (`201` / `204`); the cascade blast radius is invisible to the spec."
  evidence: "openapi.yaml:382-423 + REFERENCE odd-platform__java__service__TagServiceImpl.md (downstream_side_effects — cascade asymmetry)"
  cardinality_per_call: "updateTag: 1 tag UPDATE + search-vector reindex; deleteTag: 1 soft-delete + N tag_to_term + M tag_to_data_entity hard-deletes (tag_to_dataset_field NOT deleted)"
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:/management/tags"

## sources

- understanding ← openapi.yaml:19 (tag declaration) + openapi.yaml:342-423 (4 operations, each `tags: - tag`) + components.yaml grep (no `securitySchemes`) + openapi.yaml:1-49 (no `security:`) + openapi.yaml:345 (popularity-sort description) + components.yaml:4239-4248 (IdsParam) + TagController.java:18 (`implements TagApi`)
- concepts.entities ← components.yaml:302-350 (Tag, TagList, TagsResponse, TagFormData, BulkTagFormData) + components.yaml:4213-4248 (PageParam, SizeParam, SearchParam, IdsParam) + components.yaml:4401-4402 (Deleted) + openapi.yaml:387-392, 413-418 (inline tag_id)
- concepts.operations ← openapi.yaml:343-360 (getPopularTagList), 361-379 (createTag), 382-407 (updateTag), 408-423 (deleteTag)
- concepts.invariants[no-description-no-externalDocs] ← openapi.yaml:19 (`- name: tag`, single line)
- concepts.invariants[URL-prefix-scoping] ← openapi.yaml:342-423 (all 4 ops under `/api/tags*`)
- concepts.invariants[single-element-tags] ← openapi.yaml:359-360, 378-379, 406-407, 422-423
- concepts.invariants[no-security] ← openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep (no `securitySchemes`, no `security:`)
- concepts.invariants[no-4xx] ← openapi.yaml:352-358, 371-377, 399-405, 419-421 (each op declares only its success status)
- concepts.invariants[status-code-drift] ← openapi.yaml:372, 400 + TagController.java:27, 51
- concepts.invariants[popularity-drift] ← openapi.yaml:345 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + lineage/odd-platform/probes/P-010.yaml
- concepts.audiences ← TagController.java:5, 18 (TagApi) + WebFetch features/data-discovery/tagging (status 200, 2026-05-21) + WebFetch developer-guides/api-reference (status 200, 2026-05-21)
- dependencies_semantic.requires-feature ← WebFetch features/data-discovery/tagging (status 200, 2026-05-21) + openapi.yaml:361-423 (the three write operations)
- dependencies_semantic.requires-runtime ← TagController.java:5 (`api.contract.api.TagApi` is generator-produced) + TagController.java:18 + openapi.yaml:1 (`openapi: 3.0.3`)
- dependencies_semantic.couples-to ← components.yaml:302-350, 4213-4248, 4401-4402 (schema/parameter/response refs) + openapi.yaml:348-351, 358, 370, 377, 398, 405, 421 (the `$ref` usages) + TagController.java:18, 22-52
- tests_coverage_semantic ← openapi.yaml:344-345, 362-363, 383-384, 409-410 (summary/description presence) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (zero controller tests) + WebFetch developer-guides/api-reference (no tag endpoints enumerated)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/tagging` (status 200, 2026-05-21)
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` (status 200, 2026-05-21)
- docs_link_semantic.doc_drift_findings[LSN-019] ← openapi.yaml:345 + WebFetch features/data-discovery/tagging (status 200, 2026-05-21, "most-used tags surface as the Top tags chip strip") + REFERENCE odd-platform__java__TagController__controller-class__TagController.md + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + lineage/odd-platform/probes/P-010.yaml
- docs_link_semantic.doc_drift_findings[no-externalDocs] ← openapi.yaml:19 + WebFetch features/data-discovery/tagging (status 200)
- docs_link_semantic.doc_drift_findings[api-reference-no-enumeration] ← WebFetch developer-guides/api-reference (status 200, 2026-05-21)
- docs_link_semantic.doc_drift_findings[delete-cascade-silence] ← WebFetch features/data-discovery/tagging (status 200, "does NOT describe consequences when a tag is deleted") + REFERENCE odd-platform__java__service__TagServiceImpl.md (cascade asymmetry)
- docs_link_semantic.doc_drift_findings[security-silence] ← openapi.yaml:1-49 + components.yaml grep + WebFetch features/data-discovery/tagging (TAG_* permissions named, getPopularTagList open-read not stated) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md
- implicit_adrs[URL-prefix-scoping] ← openapi.yaml:19 + openapi.yaml:342-423
- implicit_adrs[bare-name-tags] ← openapi.yaml:13-48 (all 34 tag entries are `- name:` only)
- implicit_adrs[single-tag-per-operation] ← openapi.yaml:359-360, 378-379, 406-407, 422-423
- implicit_adrs[auth-out-of-band] ← openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep
- bugs_limitations_corner_cases[LSN-019] ← openapi.yaml:345 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + lineage/odd-platform/probes/P-010.yaml
- bugs_limitations_corner_cases[IdsParam-Entity-ids] ← openapi.yaml:139, 351 + components.yaml:4239-4248 + TagController.java:36-44 + REFERENCE odd-platform__java__service__TagServiceImpl.md + lineage/odd-platform/probes/P-031.yaml
- bugs_limitations_corner_cases[status-code-drift] ← openapi.yaml:372, 400 + TagController.java:27, 51
- bugs_limitations_corner_cases[no-4xx] ← openapi.yaml:352-421
- bugs_limitations_corner_cases[no-description-no-externalDocs] ← openapi.yaml:19 + WebFetch features/data-discovery/tagging (status 200, 2026-05-21)
- bugs_limitations_corner_cases[no-parity-check] ← openapi.yaml:342-423 + TagController.java:18, 22-52 + WebFetch developer-guides/api-reference (status 200, no tag endpoints)
- stress_findings.tunables ← components.yaml:4213-4229 + openapi.yaml:348-349 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md
- stress_findings.name_behavior_pairs[getPopularTagList] ← openapi.yaml:345 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + lineage/odd-platform/probes/P-010.yaml
- stress_findings.name_behavior_pairs[createTag] ← openapi.yaml:362-377 + components.yaml:347-350
- stress_findings.orderings ← openapi.yaml:343-360 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md + ReactiveTagRepositoryImpl.java:144-158
- stress_findings.auth_gates ← openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep + REFERENCE odd-platform__java__TagController__controller-class__TagController.md
- stress_findings.request_inputs[tag_id] ← openapi.yaml:387-392, 413-418 + TagController.java:30-34, 46-52
- stress_findings.request_inputs[ids] ← openapi.yaml:139, 351 + components.yaml:4239-4248 + TagController.java:36-44 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md + REFERENCE odd-platform__java__service__TagServiceImpl.md + lineage/odd-platform/probes/P-031.yaml
- stress_findings.request_inputs[query] ← openapi.yaml:350 + components.yaml:4231-4238 + TagController.java:36-44 + REFERENCE odd-platform__java__service__TagServiceImpl.md
- stress_findings.request_inputs[BulkTagFormData] ← openapi.yaml:365-370 + components.yaml:337-350 + TagController.java:22-28 + REFERENCE odd-platform__java__service__TagServiceImpl.md
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-031.yaml
- security.auth_mode_relevance ← openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep
- security.ingestion_filter_relevance ← openapi.yaml:342-423 (paths under `/api/tags*`)
- security.authorization_assertions ← openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep + REFERENCE odd-platform__java__TagController__controller-class__TagController.md
- security.owner_scoping ← openapi.yaml:343-423 (no owner parameter) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md (no `tag.owner_id`)
- security.data_exposure ← components.yaml:302-335, 4401-4402 + openapi.yaml:343-421 (response bindings)
- security.known_security_gaps[no-security] ← openapi.yaml:1-49 + openapi.yaml:343-423 + components.yaml grep
- security.known_security_gaps[no-4xx] ← openapi.yaml:352-421
- security.known_security_gaps[open-read] ← openapi.yaml:343-358 + REFERENCE odd-platform__java__TagController__controller-class__TagController.md
- security.known_security_gaps[write-no-marker] ← openapi.yaml:361-423
- performance.hot_paths ← openapi.yaml:343-423 + WebFetch features/data-discovery/tagging (Top-tags chip strip)
- performance.throughput_characteristics ← components.yaml:4213-4229 + openapi.yaml:348-349, 361-377, 382-423
- performance.resource_allocation ← components.yaml:321-335, 347-350, 4222-4229
- performance.scaling_characteristics ← openapi.yaml:354-421 (every response application/json or empty 204)
- performance.known_performance_gaps ← components.yaml:4213-4229 + openapi.yaml:343-423
- upstream_callers ← openapi.yaml:342-423 (the four operations) + WebFetch features/data-discovery/tagging (status 200) + REFERENCE odd-platform__java__TagController__controller-class__TagController.md
- downstream_side_effects ← openapi.yaml:343-423 + components.yaml:302-335 + REFERENCE odd-platform__java__service__TagServiceImpl.md + REFERENCE odd-platform__java__TagController__controller-class__TagController.md

## confidence_per_field

- understanding: HIGH (every claim is spec-static — the tag declaration, the four operations, the no-security finding, the two drifts are all visible at the cited line ranges in openapi.yaml + components.yaml at commit ede5d277; the downstream behaviour claims are explicitly REFERENCE to the verified TagController / TagServiceImpl sidecars)
- concepts: HIGH (every entity / operation / invariant / audience traced to a spec line range or a cross-referenced sidecar)
- dependencies_semantic: HIGH (schema / parameter / response refs verified at components.yaml line ranges; TagApi generation verified at TagController.java:5, 18)
- tests_coverage_semantic: HIGH (the absence-of-test claim is structural — no spec-test harness exists; the controller-test gap is REFERENCE to the TagController sidecar which verified it by grep)
- docs_link_semantic: MEDIUM (the binding is editorial — the tag has no `externalDocs`; both inferred URLs were freshly WebFetched 2026-05-21 at status 200; the tag→doc binding is the enricher's judgment, not maintainer-declared)
- implicit_adrs: HIGH (every claim is structural — visible in the spec at the cited line ranges; consistent with the alert + dataEntity openapi-tag sidecars' identical findings)
- bugs_limitations_corner_cases: HIGH (every claim is verified by direct inspection of openapi.yaml + components.yaml + cross-checked against the TagController / TagServiceImpl sidecars + the two live WebFetch results; the LSN-019 and IdsParam drifts are the load-bearing operator-observable findings)
- security: HIGH (the no-security / no-securitySchemes finding is verified by exhaustive grep at ede5d277; the downstream authorization picture is REFERENCE to the verified TagController sidecar; the owner-scoping N/A is confirmed by the absence of any owner parameter in the spec)
- performance: HIGH (every claim is spec-static — pagination parameter shapes, response schema bounds, single-vs-bulk operation count are visible at the cited line ranges; runtime-cost claims are explicitly N/A or REFERENCE)
- upstream_callers: MEDIUM (4 REST entry-points anchored at openapi.yaml operation ranges; 2 UI-route entry-points recorded as REFERENCE with unresolved: true pending UI sidecar enrichment)
- downstream_side_effects: HIGH (3 side-effect classes anchored at spec line ranges with cardinality and entry-point reachability; the db-write chains are correctly REFERENCED to TagServiceImpl rather than transcribed)
- stress_findings: MEDIUM (9 triggers, 33 questions; 28 STATIC-INFERRED with strong spec line-range evidence, 3 REFERENCE to the verified TagController/TagServiceImpl sidecars, 2 PROBE-NEEDED. The load-bearing LSN-019 name-vs-behavior drift is STATIC-INFERRED via the spec `description` text + the cross-referenced JOOQ trace and is PROBE-PINNED by the existing P-010; the load-bearing Category F `ids`-parameter drift is PROBE-NEEDED — the placeholder probe P-031 pins it. confidence_overall remains HIGH because the two load-bearing drifts are both supported by strong spec-static evidence + cross-referenced verified sidecars; only the exact SQL-bind column of `ids` and the operator-visible empty-result behaviour are PROBE-NEEDED.)

## Maintainer notes
