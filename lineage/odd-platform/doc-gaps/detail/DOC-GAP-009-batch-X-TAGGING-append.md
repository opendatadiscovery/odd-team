## STRENGTHENS — batch X-TAGGING (2026-05-21) — the openapi-tag `tag` node confirms the api-reference hub enumerates ZERO tag endpoints

DOC-GAP-009 (api-reference coverage gap — `dataEntity` 40 operations punted to Swagger UI; broadened to platform-wide breadth by DOC-GAP-244, which named `tag` among the 26 uncovered tags). Batch X-TAGGING (directed tagging-coverage batch) supplies the **openapi-tag-tier primary source** for the `tag` instance of the coverage gap.

### New `surfaced_by` (batch X-TAGGING)

- `odd-platform__openapi__tags__openapi-tag__tag.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"The live `developer-guides/api-reference` page (WebFetched 2026-05-21, 200) enumerates none of the four `tag`-tagged operations and redirects readers to Swagger UI. There is no automated check that any doc page's endpoint enumeration stays in sync with the `tag`-tagged operations; an added/removed operation would not auto-reflect anywhere in the docs."* **(NEW batch X-TAGGING — openapi-tag-tier PRIMARY SOURCE — direct live WebFetch confirmation this session)**
- `odd-platform__openapi__tags__openapi-tag__tag.md:bugs_limitations_corner_cases.[5]` (LOW per sidecar) — *"There is no automated parity check between (a) the count of operations tagged `tag` (4), (b) the count of public methods on `TagController` (4), and (c) any doc-page enumeration. The `developer-guides/api-reference` page enumerates zero tag endpoints (WebFetched 2026-05-21, 200), so the doc side of the parity is empty."*
- `odd-platform__openapi__tags__openapi-tag__tag.md:tests_coverage_semantic.uncovered_behaviours` — the openapi-tag node names a CI lint gate ("a CI assertion that every operation tagged `tag` has URL prefix `/api/tags` AND vice versa") as the structural mitigation — consistent with DOC-GAP-244's "add a CI gate that compares the hub sub-page count to the spec tag count".

### Live re-verification (batch X-TAGGING, 2026-05-21 — non-negotiable per Rule 1)

- WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` 2026-05-21 status **200** (direct fetch this session): asked explicitly whether the page documents any tag-related REST endpoints (`createTag`, `deleteTag`, `getPopularTagList`, `updateTag`, `PUT /api/tags`, `DELETE /api/tags`) — WebFetch result: *"No. The page does not enumerate or document endpoints like `createTag`, `deleteTag`, `getPopularTagList`, `updateTag`, or tag-related PUT/DELETE operations. Tags are mentioned only as a feature within the Glossary endpoint ('ownership and tags'), but no dedicated tag endpoints are documented."* The page's sub-page list (Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships) is unchanged — no `tags` sub-page; the page redirects to Swagger UI. The coverage gap is durable; no decay.

### Scope confirmation — the `tag` tag's 4 operations

The `tag` openapi-tag groups exactly four operations (`getPopularTagList`, `createTag`, `updateTag`, `deleteTag`), all under `/api/tags*`, generating the `TagApi` interface. None is enumerated on the api-reference hub. The four batch X-TAGGING controller-method sidecars (createTag, deleteTag, getPopularTagList, updateTag) demonstrate that each operation carries 4-8 operator-facing runtime sub-findings — the same per-operation richness DOC-GAP-009's batch-L scope expansion established for the `dataEntity` operations. When the api-reference `tags` sub-page is authored (per DOC-GAP-244's per-uncovered-tag-sub-page action), it must cover for EACH operation: the gating permission, the open-read posture on `getPopularTagList`, the LSN-019 ordering caveat (DOC-GAP-255), the soft-delete + asymmetric cascade on `deleteTag` (DOC-GAP-170), the bulk-array body on `createTag`, the 201-vs-200 status drift (DOC-GAP-074), and the `IdsParam` misdescription (DOC-GAP-255 append).

### No new finding minted

The `tag` coverage gap is fully within the scope of DOC-GAP-009 (depth anchor) + DOC-GAP-244 (breadth anchor — `tag` already named among the 26 uncovered tags). Per Rule 4 this batch STRENGTHENS rather than minting a tag-specific coverage finding.

### Cross-reference additions

- **DOC-GAP-244** (platform-wide 26-uncovered-tags breadth anchor) — `tag` is one of the 26; this batch's openapi-tag sidecar is the `tag`-instance primary source.
- **DOC-GAP-255** + **DOC-GAP-170** + **DOC-GAP-074** + **DOC-GAP-098** + **DOC-GAP-260** — the per-operation findings on the four `tag` operations; each becomes reference material for the eventual api-reference `tags` sub-page.

### Coherence note (Rule 6)

Cross-registry sweep this batch: `feature-flows/index.yaml` references the 9-vs-35-tag coverage enumeration consistent with DOC-GAP-009/244. NO registry asserts the api-reference page DOES document tag endpoints. This batch STRENGTHENS; it does not contradict. `coherence_strengthens: 1` for this entry.
