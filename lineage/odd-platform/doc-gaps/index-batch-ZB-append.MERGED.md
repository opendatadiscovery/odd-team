<!--
batch: ZB
generated_at: "2026-05-21T00:00:00Z"
generated_at_commit: 80637ed
prompt_version: "doc-gap-finder/0.1.0"
mode: incremental
consumed_sidecars: 5
  - odd-platform__java__DataSourceController__controller-method__getDataSourceList
  - odd-platform__java__DataSourceController__controller-method__registerDataSource
  - odd-platform__java__DataSourceController__controller-method__updateDataSource
  - odd-platform__java__DataSourceController__controller-method__deleteDataSource
  - odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken

new_findings: 2          # DOC-GAP-261 (HIGH, drift) + DOC-GAP-262 (MEDIUM, drift)
strengthened_findings: 3 # DOC-GAP-034 + DOC-GAP-074 + DOC-GAP-022 (no severity/category change — no headline rewrite)

frontmatter_count_deltas:
  total_findings: +2          # 259 -> 261 IDs in catalog (DOC-GAP-261 + DOC-GAP-262)
  findings_by_severity:
    HIGH: +1                  # DOC-GAP-261
    MEDIUM: +1                # DOC-GAP-262
    LOW: +0
  findings_by_category:
    drift: +2                 # both DOC-GAP-261 and DOC-GAP-262 are category: drift
    broken-url: +0
    missing-anchor: +0
    missing-page: +0
    stale-page: +0
    coverage-gap: +0
    meta: +0

dedup:
  protocol: registry-search-spawn.md rev 7.1 (semantic graph-search)
  dedup_fallback: grep
  fallback_reason: "no Bash tool available in this subagent context to invoke `lineage-extractor graph-search`; per playbook lines 93-99 fell back to Grep over doc-gaps/index.md for each fresh candidate's discriminating anchors (CascadeDelete / orphan / soft-delete / NAMESPACE_CREATE / getOrCreate / namespace_name / Token Rotation / regenerate / 201-vs-200 / unbounded size). All 5 sidecars' claimed live URLs were independently WebFetch-verified at status 200 this session."

coherence_rule6:
  strengthens: 3   # DOC-GAP-034, DOC-GAP-074, DOC-GAP-022 (same-registry strengthen)
  cross_registry_strengthens: 3
    # feature-flows F-008 + F-028 + F-010 — same-polarity (DataSource registration cluster /
    #   Namespace side-door cluster / orphan-token housekeeping); back-links emitted in
    #   DOC-GAP-261 + DOC-GAP-262 frontmatter `related_features`
    # test-map TEST-GAP-751 (namespace side-door Vertex 3) / TEST-GAP-675 (orphan token) /
    #   TEST-GAP-701 (FTS uncleared) / TEST-GAP-749 (non-transactional rotation) — all same-polarity
  supersedes: 0
  conflicts_surfaced: 0
  note: "Rule-6 pre-emit check ran for the 2 new findings (anchors: deleteDataSource / DataSourceServiceImpl / orphan token / registerDataSource / namespaceService.getOrCreate / NamespaceServiceImpl). Every cross-registry hit in feature-flows + test-map + concepts is SAME-POLARITY (the registries already assert the same facts: the namespace-create side-door cluster, the orphan-token-no-housekeeping pattern, the delete cascade-block test gap). No CONTRADICTS, no SUPERSEDES. Back-links emitted on both new detail files."

webfetch_verifications_this_session:
  - url: "https://docs.opendatadiscovery.org/features/management"
    status: 200
    date: "2026-05-21"
    note: "DIRECT fetch — confirmed silent on data-source delete mechanics, registration permissions/namespace-create/token-mint, and pagination/size limits; Collectors+Datasources token affordances quoted verbatim"
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    status: 200
    date: "2026-05-21"
    note: "DIRECT fetch — DATA_SOURCE_TOKEN_REGENERATE / DATA_SOURCE_CREATE / NAMESPACE_CREATE quoted verbatim; no operational mechanics for any"
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    status: 200
    date: "2026-05-21"
    note: "DIRECT fetch — 9 feature sub-pages enumerated; NO Data Sources sub-page"
-->

## DOC-GAP-261 — Deleting a data source is documented only as the workflow phrase "remove a source no longer ingested" — the live `/features/management` page documents NONE of the four operationally load-bearing facts of `DELETE /api/datasources/{data_source_id}`: (a) the delete is BLOCKED with HTTP 400 (`CascadeDeleteException`) while a live `data_entity` child still references the source — an operator clicking Delete on an actively-ingested source gets an error, not a deletion, and the actively-ingested-source-is-undeletable state has NO documented workaround; (b) the delete is a SOFT-delete (`deleted_at = NOW()`), not a hard delete; (c) the Collector `token` row the data source pointed to is left ORPHANED and cannot even be soft-deleted (the `token` table has no `deleted_at` column); (d) the FTS `search_entrypoint` vector is NOT cleared on delete (unlike the `update` path) **(NEW batch ZB — DataSourceController.deleteDataSource controller-method PRIMARY SOURCE; live WebFetch `/features/management` 2026-05-21 status 200; STRENGTHENS-cross-link DOC-GAP-194 orphan-token + DOC-GAP-082 META + DOC-GAP-009; related_features F-008 + F-010; related_test_gaps TEST-GAP-675 + TEST-GAP-701)**

**Severity**: HIGH
**Category**: drift

**Full detail**: `detail/DOC-GAP-261.md`

---

## DOC-GAP-262 — Registering a data source via `POST /api/datasources` can IMPLICITLY CREATE a namespace as a side effect of the `namespace_name` form field — bypassing the `NAMESPACE_CREATE` permission; a principal holding only `DATA_SOURCE_CREATE` can proliferate namespaces through this side-effect path, even though the explicit `POST /api/namespaces` endpoint is gated by `NAMESPACE_CREATE`; the live `/configuration-and-deployment/enable-security/authorization/permissions` page describes `DATA_SOURCE_CREATE` and `NAMESPACE_CREATE` as INDEPENDENT permissions and never flags that data-source registration is a second, ungated path to namespace creation; the same side-door applies on the update path under `DATA_SOURCE_UPDATE`; the namespace is created with NO Activity Event (no audit trail), and a typo in `namespace_name` silently creates a junk namespace **(NEW batch ZB — DataSourceController.registerDataSource + updateDataSource controller-method PRIMARY SOURCE; live WebFetch `/permissions` + `/features/management` 2026-05-21 status 200; the DataSource vertex of the 4-vertex namespace-create side-door cluster; related_features F-028 + F-008; related_test_gaps TEST-GAP-751; cross-links REFACTOR-223 + DOC-GAP-146 + DOC-GAP-168 + DOC-GAP-082 META)**

**Severity**: MEDIUM
**Category**: drift

**Full detail**: `detail/DOC-GAP-262.md`

---

<!--
STRENGTHENED ENTRIES (batch ZB) — no headline rewrite; severity + category unchanged.
The orchestrator should NOT add new index headlines for these; the STRENGTHENS blocks
are appended to the existing detail/ shards.

## DOC-GAP-034 — Token Rotation operational mechanics absent from enable-security pages
  STRENGTHENED (batch ZB): the DATA-SOURCE token-rotation sibling (`PUT /api/datasources/{id}/token`,
  regenerateDataSourceToken) is now a controller-method PRIMARY SOURCE. DOC-GAP-034 was
  collector-token-only; it is now a 2-rotation-endpoint finding (collector token + data-source
  token are STRUCTURALLY IDENTICAL — shared TokenGeneratorImpl + ReactiveTokenRepositoryImpl,
  same MANAGEMENT-tier *_TOKEN_REGENERATE gate, same plaintext-in-response, same missing
  @ReactiveTransactional, same DISABLED-bypass + non-SecureRandom + no-audit-log gaps). The
  planned `enable-security/token-rotation.md` must cover BOTH tokens in one section. Severity
  stays MEDIUM. Block appended to detail/DOC-GAP-034.md `## Batch ZB append`.

## DOC-GAP-074 — OpenAPI declares 201 Created for POST /api/owners but controller returns 200 OK — class-wide 201-vs-200 drift
  STRENGTHENED (batch ZB): the DataSource `registerDataSource` (openapi.yaml:454) +
  `updateDataSource` (openapi.yaml:482) instances batch Z added from the SPEC axis now have
  the CONTROLLER-METHOD impl-axis primary source — `DataSourceController.java:35` + `:44` both
  hard-code `ResponseEntity::ok` (HTTP 200). The two DataSource instances are one per
  fix-direction (POST register = impl-wrong/spec-right; PUT update = spec-wrong/impl-right).
  Severity stays MEDIUM. Block appended to detail/DOC-GAP-074.md `## Batch ZB append`.

## DOC-GAP-022 — Pagination `size` parameter is unbounded at spec + controller layers — undocumented runtime cap
  STRENGTHENED (batch ZB): `GET /api/datasources` is a NEW unbounded-`size` instance with a
  controller-method PRIMARY SOURCE (`getDataSourceList`). New dimension: the unbounded `size`
  materialises the entire `data_source` table + 2 LEFT JOINs (NAMESPACE + TOKEN) into one
  in-memory list (`collectList()` at ReactiveDataSourceRepositoryImpl.java:75-76) — an
  unbounded-response surface. Also records size=0/negative-size/page=0 as statically-undetermined
  boundary behaviour (pinned by P-037). Severity stays MEDIUM. Block appended to
  detail/DOC-GAP-022.md `## Batch ZB append`.
-->
