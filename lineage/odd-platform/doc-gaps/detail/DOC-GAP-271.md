---
doc_gap_id: DOC-GAP-271
severity: MEDIUM
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_features:
  - F-022
related_doc_gaps:
  - DOC-GAP-198   # SLA api-reference structural gap — sibling api-reference-coverage finding
  - DOC-GAP-264   # Title filter LSN-020 — same surface
related_retrospectives:
  - LSN-020   # input-name drift — relevant to the de* prefix opacity
---

## DOC-GAP-271 — `GET /api/dataqatests/runs` (the Quality Dashboard's single backend endpoint, operationId `getDataQualityTestsRuns`) declares 10 query parameters in `openapi.yaml:1973-2078` — 5 `de*`-prefixed (`deNamespaceIds` / `deDatasourceIds` / `deOwnerIds` / `deTitleIds` / `deTagIds`) for the data-entity / tables side and 5 unprefixed (`namespaceIds` / `datasourceIds` / `ownerIds` / `titleIds` / `tagIds`) for the test / jobs side — and EVERY ONE of the 10 parameters has NO `description:` field in the spec; an API consumer hitting the endpoint without using the UI cannot tell `de*` means "data-entity / table-side" vs unprefixed "test-side", and even with that knowledge has no description of what each id-array filters by (let alone the load-bearing `titleIds`→`OWNERSHIP.TITLE_ID` ownership-role binding that's hidden from the spec-level description)

**Severity**: MEDIUM
**Category**: drift (OpenAPI spec under-description for a 10-parameter endpoint on a load-bearing dashboard; the UI compensates with two section headers, the spec does not)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityContent.md:stress_findings.request_inputs[filterState]` — verbatim (the routes_to_finding field): *"docs_link_semantic.doc_drift_findings (the `de`-prefix params undocumented on the OpenAPI surface) — full drift classification deferred to the ReactiveDataQualityRunsRepository sidecar"* + the embedded Q4 answer: *"the `de` prefix is undocumented to an operator reading the OpenAPI spec alone — `openapi.yaml:1973-2078` declares all 10 parameters as bare `namespaceIds` / `deNamespaceIds` arrays with NO `description` field on any of them. An API consumer hitting `GET /api/dataqatests/runs` directly (not via the UI) has no way to know `de` means 'data entity / table-side' vs the non-prefixed 'test-side'. The UI disambiguates via the two section headers; the API surface does not. This is a Category-F doc-gap routed to docs_link_semantic and to the repository sidecar."*
- `odd-platform__ts__react-component__component__DataQualityFilters.md:stress_findings.request_inputs` — multi-vertex confirmation of the 10-param shape: NamespaceFilter / DatasourceFilter / OwnerFilter / TitleFilter / TagFilter each instantiated TWICE (once per side) with `filterKey: keyof DataQualityRunsApiGetDataQualityTestsRunsRequest`; the type-side coupling that makes both prefixed and unprefixed valid is the same uniformity that makes the OpenAPI spec under-describe both sides
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[6]` (LOW per sidecar — the `de*`/unprefixed split is the only thing separating tables-side from tests-side filters; a swapped `filterKey` prop would mis-route a filter with no compile error — same shape: both keys are valid in the same type, the spec carries no description to anchor "which side does this belong to")

### Evidence

- `odd-platform/odd-platform-specification/openapi.yaml:1973-2078` — the `getDataQualityTestsRuns` operation declares its 10 parameters as bare entries:
  ```yaml
  - name: namespaceIds
    in: query
    schema:
      type: array
      items: { type: integer, format: int64 }
  - name: datasourceIds
    in: query
    schema:
      type: array
      items: { type: integer, format: int64 }
  # ... and so on for ownerIds, titleIds, tagIds, deNamespaceIds, deDatasourceIds, deOwnerIds, deTitleIds, deTagIds
  ```
  No `description:` field on any of the 10 parameters; no `summary` on the operation either.
- `odd-platform-ui/src/components/DataQuality/DataQualityFilters/DataQualityFilters.tsx:63, 70-74, 78, 85-89` — the UI compensates via two `Typography` section headers (`<Typography variant='h4'>{t('Filters for tables')}</Typography>` at line 63 + `<Typography variant='h4'>{t('Filters for tests')}</Typography>` at line 78); each panel holds five filter rows wired by `filterKey` to its side's five keys. The UI is the ONLY surface that names "tables" vs "tests"; the spec, the generated client, and any third-party tool reading the spec see only the bare parameter names.
- `odd-platform-api/src/main/java/.../mapper/DataQualityTestFiltersMapper.java:9-26` — the controller-to-DTO mapper is a pure 1:1 pass-through; no renaming, no description, no contract on which side each parameter affects
- `odd-platform-api/src/main/java/.../dto/DataQualityTestFiltersDto.java:7-16` — the DTO record carries the same 10 field names; no Javadoc, no annotation explaining the de* prefix
- `odd-platform-api/src/main/java/.../repository/reactive/ReactiveDataQualityRunsRepositoryImpl.java:271-321` — the SQL bind: `de*`-prefixed parameters bind to filters against the DATA_ENTITY / DATA_SOURCE / NAMESPACE / OWNERSHIP / TAG_TO_DATA_ENTITY joins for the TABLES side (rows-of-tables aggregates), while unprefixed parameters bind to filters against the same tables but for the TESTS-job side (rows-of-test-runs aggregates). The de prefix likely abbreviates "data entity" (the platform's tables-side noun).
- WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-25 status **200** — the api-reference hub enumerates 9 feature sub-pages; NO `data-quality` sub-page exists (DOC-GAP-198 cross-link). So the OpenAPI spec is the operator's only doc-side surface for this endpoint, and the spec is silent.

### Drift narrative

The Quality Dashboard's data is served by a single GET endpoint with 10 optional query parameters. Five are `de*`-prefixed; five are not. The two groups bind to different SQL contexts (tables-side aggregates vs tests-job aggregates). The OpenAPI spec declares all 10 with bare `type: array` schemas and ZERO descriptions. An operator integrating against the endpoint outside the UI — building a custom dashboard, automating a regression check, or wiring a monitoring tool — must either:

1. Reverse-engineer the prefix meaning from the UI (open the dashboard's filter sidebar, see "Filters for tables" / "Filters for tests" section headers).
2. Read the source code (`ReactiveDataQualityRunsRepositoryImpl.java:271-321` to see the actual SQL bind for each parameter).
3. Guess.

This is friction for a load-bearing endpoint. The fix is the standard `description:` field on each parameter — a one-line annotation per parameter:

```yaml
- name: deNamespaceIds
  in: query
  description: |
    TABLES-side filter. Narrows the Table Health and Monitored Tables aggregates to
    entities whose namespace (or whose datasource's namespace) matches the selection.
    Combine with other `de*` parameters with AND semantics.
  schema:
    type: array
    items: { type: integer, format: int64 }
```

Combined with DOC-GAP-264 (the `titleIds` → `OWNERSHIP.TITLE_ID` LSN-020 binding), the description fields would also be the natural place to disclose the binding semantics that the UI label doesn't convey:

```yaml
- name: titleIds
  in: query
  description: |
    TESTS-side filter. Narrows the Test Results Breakdown aggregate to test runs
    whose owning data entities have at least one OWNERSHIP row with the selected
    title (i.e. an ownership ROLE — "Data Steward", "Owner" etc., NOT a dataset
    name). When combined with `ownerIds`, both apply within the SAME ownership
    row. See [Filter dimensions reference](https://docs.opendatadiscovery.org/features/data-quality/dashboard#filter-dimensions-reference) for the full binding.
  schema:
    type: array
    items: { type: integer, format: int64 }
```

### Proposed doc action

**Spec-side primary action — backfill all 10 parameter `description:` fields on `getDataQualityTestsRuns` in `openapi.yaml`**.

`odd-platform/odd-platform-specification/openapi.yaml:1973-2078` — for each of the 10 parameters, add a `description:` field that names (a) WHICH SIDE the parameter affects (TABLES or TESTS), (b) WHAT it filters by at the SQL layer (the join column), (c) any LSN-020-class binding caveat (especially `titleIds` / `deTitleIds`). The proposed wording for each parameter is best authored in concert with the dashboard.md edits proposed in DOC-GAP-264 / DOC-GAP-267 — they all describe the same five filter dimensions in different surfaces, and the wording should be aligned.

Companion doc-side action: when the api-reference `data-quality` sub-page is created (DOC-GAP-198's structural fix), reference this endpoint and link to the dashboard doc's "Filter dimensions reference" sub-section (DOC-GAP-264) for the full filter semantics.

### Cross-references

- **DOC-GAP-198** (SLA endpoint PNG-vs-JSON drift + missing `developer-guides/api-reference/data-quality` sub-page) — same surface, sibling structural finding. Fixing DOC-GAP-198's missing api-reference page and DOC-GAP-271's spec description backfill should land together; both are P-04 spec/api-reference coverage gaps.
- **DOC-GAP-264** (Title filter LSN-020 binding) — same surface; the spec description backfill is the second surface (after the dashboard doc) where the LSN-020 caveat must appear so the operator who integrates outside the UI gets the same warning.
- **DOC-GAP-272** (Namespace filter widening) — same surface; the spec description for `namespaceIds`/`deNamespaceIds` is the second surface for the widening caveat.
- **Rule 6 coherence** — cross-registry sweep ran: feature-flows F-022 enumerates the controller endpoints with no parameter-description claims; concepts/index.yaml has the 10-parameter filterState entity for the dashboard. All SAME-POLARITY. No CONTRADICTS, no SUPERSEDES.

### Severity rationale

MEDIUM. A 10-parameter endpoint with no parameter descriptions is a substantial spec-surface gap on a load-bearing dashboard endpoint. Operator-impact is friction (custom integration must reverse-engineer the prefix meaning) rather than data-loss / security-exposure. The fix is 10 one-line `description:` field additions plus optional cross-link wording — bounded and cheap.

### Last verified

- 2026-05-25 — `openapi.yaml:1973-2078` re-confirmed at substrate commit `ede5d277` to declare 10 parameters with no `description:` fields; WebFetch `developer-guides/api-reference` 200 confirms no `data-quality` sub-page exists.
