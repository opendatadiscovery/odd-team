# REFACTOR-642 — `GET /api/metadata/fields` PageInfo is theatre + unbounded return + no ORDER BY + no per-permission gate; the OpenAPI advertises pagination, the implementation never paginates, and the catalogue read is open to every authenticated user

**Severity**: HIGH (consolidated 4-facet cluster)
**Category**: openapi-spec-impl-drift + missing-pagination + missing-order-by + missing-auth (consolidated)
**Pillars affected**: [P-04 Data Discovery (Custom Metadata), P-10 Ingestion, P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**`MetadataFieldList.page_info` is theatre — total equals items.length, hasNext is hardcoded false** — `MetadataFieldMapperImpl.java:30-33` constructs `new PageInfo().total((long) pojos.size()).hasNext(false)`. The OpenAPI response schema (`components.yaml:2111-2120`) advertises pagination via the embedded PageInfo; the implementation never paginates."
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "**Unbounded return — caller receives ENTIRE filtered catalogue per call** — no LIMIT / OFFSET in the SQL (`ReactiveMetadataFieldRepositoryImpl.java:51-55`). With 10000+ INTERNAL metadata fields, the JVM materialises 10000 MetadataFieldPojo + 10000 MetadataField DTOs + the wire payload per call."
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:bugs_limitations_corner_cases.[2]` (LOW) — "**No ORDER BY at the SQL layer — heap-scan order is the operator-visible order**"
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "**No per-permission authorization gate on the catalogue read** — `/api/metadata/fields` is not in `SecurityConstants.WHITELIST_PATHS` and has no `SECURITY_RULES` entry; falls through to `pathMatchers(\"/**\").authenticated()`."

**Description**: The custom-metadata field catalogue's READ endpoint at `GET /api/metadata/fields` (`MetadataFieldController.java:18-23`) has FOUR composing gaps. The 4-facet bundle is one operator-actionable closure; each facet alone is small but the bundle is the operator-visible posture.

**Facet 1 — PageInfo theatre**: `MetadataFieldMapperImpl.java:30-33` constructs `new PageInfo().total((long) pojos.size()).hasNext(false)`. The OpenAPI response schema (`components.yaml:2111-2120`) embeds `PageInfo{total, has_next}`; the mapper hardcodes both values:
- `total = items.length` always (NOT a true row count; just the array length the caller already counted).
- `hasNext = false` always (NEVER signals overflow).

A spec-generated client implementing a paginated 'load-more' UI cannot detect overflow; an operator reading `page_info.total` cannot use it as a catalogue-size indicator.

**Facet 2 — Unbounded return**: No LIMIT / OFFSET in the SQL at `ReactiveMetadataFieldRepositoryImpl.java:51-55`:

```java
return jooqQueryHelper.fluxToFluxOfPojo(
    DSL.selectFrom(METADATA_FIELD).where(conditions),
    MetadataFieldPojo.class);
```

Every call materialises the ENTIRE filtered set. With 10000+ INTERNAL metadata fields, the JVM allocates 10000 MetadataFieldPojo + 10000 MetadataField DTOs + the wire payload per call. The UI's `MetadataCreateFormItem` autocomplete (per the sidecar's audiences[0]) dispatches `searchMetadata({query})` on every debounced keystroke (500ms), so every keystroke-burst amplifies linearly with directory cardinality.

**Facet 3 — No ORDER BY**: The SELECT has no `.orderBy(...)`. Postgres returns rows in heap-scan order (roughly insertion order on a freshly vacuumed table; arbitrary after creates + soft-deletes + vacuum cycles). The UI's MUI Autocomplete preserves input order (no client-side resort), so operators see the same query produce different orderings between calls.

**Facet 4 — No per-permission gate**: `/api/metadata/fields` is not in `SecurityConstants.WHITELIST_PATHS` and has no `SECURITY_RULES` entry; falls through to `pathMatchers("/**").authenticated()`. Any authenticated user (or anonymous under DISABLED) enumerates the FULL INTERNAL catalogue regardless of role / policy / owner scope. The Permissions docs page (WebFetched 2026-05-25 status 200) defines NO `CUSTOM_METADATA_FIELD_READ` permission — the permission model has only the per-VALUE write side (`DATA_ENTITY_CUSTOM_METADATA_{CREATE,UPDATE,DELETE}`).

The catalogue contains field NAMES that operators may have intended to scope to specific Data Entity owners (e.g. `salary_band`, `phi_classification`, `pii_indicator` — governance-intent vocabulary). Cross-data-entity exposure of this vocabulary is the operator-visible information disclosure.

**Operator-visible failure modes**:

1. **Spec-vs-impl drift**: SDK authors implementing pagination on `MetadataFieldList` get broken behaviour; the wire response carries page_info that does not paginate.
2. **Performance amplification at scale**: large deployments (10K+ custom-metadata fields) experience linear scaling of payload size + JVM allocation per autocomplete keystroke.
3. **Unstable ordering**: operators see the same field appear in different positions across calls; cannot rely on the dropdown's order.
4. **Vocabulary leak**: any authenticated user enumerates governance-intent field names; multi-tenant deployments expose cross-tenant vocabulary.
5. **Doc gap**: the live docs do not document custom-metadata end-to-end (verified: `/active-platform-features/metadata` returns 404, `/active-platform-features/custom-metadata` returns 404). Operators have no operator-facing source-of-truth for the feature.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../MetadataFieldController.java:18-23` (the controller).
- `<odd-platform-api>/src/main/java/.../MetadataFieldServiceImpl.java:37-40` (the service; passes through).
- `<odd-platform-api>/src/main/java/.../ReactiveMetadataFieldRepositoryImpl.java:44-56` (the repository; no LIMIT, no OFFSET, no ORDER BY).
- `<odd-platform-api>/src/main/java/.../MetadataFieldMapperImpl.java:29-33` (the mapper; hardcoded PageInfo).
- `<odd-platform-specification>/components.yaml:2111-2120` (the PageInfo schema embedded in MetadataFieldList).
- `<odd-platform-api>/src/main/java/.../SecurityConstants.java:95-355` (no `/api/metadata/fields` entry).

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-003** (read-collaborative posture; Owner / MetadataField directory enumeration is the platform default). **ADR-CANDIDATE-219 NEW** (this batch) captures the origin partition that the read endpoint enforces; this REFACTOR captures the operator-actionable gaps OUTSIDE that ADR's stance. **REFACTOR-545** (status-code drift cluster) — Facet 1 is the closest sibling-cluster instance.

**Proposed remedy**: Four-part fix (or pick the maintainer-prioritised subset):

1. **Fix Facet 1 (PageInfo theatre)** — either:
   - **Option 1A (preserve no-pagination, fix spec)** — change `components.yaml` to NOT embed PageInfo on MetadataFieldList; the wire shape becomes `{items: MetadataField[]}` only.
   - **Option 1B (introduce real pagination)** — add `page` + `size` query parameters; gate at 50 / max 200; add ORDER BY name ASC; compute true `total` via a count-CTE.

2. **Fix Facet 2 (unbounded return)** — paired with Option 1B above. If 1A is chosen, add a hard upper-bound (e.g. LIMIT 500) at the SQL layer with a fail-loud signal when the cap is hit (e.g. log.warn at the service tier).

3. **Fix Facet 3 (no ORDER BY)** — add `.orderBy(METADATA_FIELD.NAME.asc())` to the SQL.

4. **Fix Facet 4 (no per-permission gate)** — either:
   - **Option 4A (preserve read-collaborative; disclose)** — extend live docs to document the global read posture (cross-link to REFACTOR-640's doc-disclosure pattern for Owner).
   - **Option 4B (introduce CUSTOM_METADATA_FIELD_READ)** — structural; default-grant to existing roles, allow operators to revoke.

5. **Add live docs page** — `documentation/docs/active-platform-features/custom-metadata.md` does not exist; create it. Document the INTERNAL/EXTERNAL partition (per ADR-219), the autocomplete behaviour, the side-effect-grow semantics, the read posture.

6. **Add integration tests** for each facet that gets fixed.

**Severity rationale**: HIGH (consolidated) — the 4-facet bundle is operator-visible across multiple dimensions (spec drift, performance scaling, UX unpredictability, information disclosure, doc gap). Each individual facet is MEDIUM; the bundle is HIGH because the combined consequence is "the Custom Metadata feature is undocumented + the catalogue is unrestricted-read + the read endpoint scales linearly with deployment age".

**Suggested backlog grouping**: `Custom Metadata maturity sprint` — bundle all 4 facets + the doc-page creation + the integration tests as one operator-actionable backlog item. Cross-link to ADR-CANDIDATE-219 (origin partition), ADR-CANDIDATE-003 (read posture), ADR-CANDIDATE-212 (directory-side-effect-only).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-545 (status-code drift cluster — PageInfo theatre is the 11th instance); REFACTOR-319 (TermServiceImpl.listByTerm broken pagination — same shape); ADR-CANDIDATE-003 (read-collaborative); ADR-CANDIDATE-219 (origin partition).
- SUPERSEDES: none.
- CONFLICTS: none.

---
