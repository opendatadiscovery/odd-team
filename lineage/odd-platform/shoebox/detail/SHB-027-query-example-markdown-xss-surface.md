# SHB-027 — Query Examples render `definition` AND `query` through Markdown without sanitisation — 4th member of the stored-XSS family

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators authoring Query Examples (Data Modelling → Query Examples) enter Markdown-formatted prose in the `definition` field AND SQL/KQL/Spark code in the `query` field. Both fields are stored VERBATIM as Postgres `text` (V0_0_84__create_query_example.sql:4-5 — no length cap, no sanitisation pass). Both fields are then rendered through `@uiw/react-md-editor`'s `MDEditor.Markdown` component at TWO UI sites: `QueryExampleDetailsOverview.tsx:25` (details page — renders both `definition` and `query` as Markdown) AND `QueryExamplesListItem.tsx:45-52` (catalog list — renders BOTH fields as Markdown in the table row). `MDEditor.Markdown` bundles `rehype-raw` (per `pnpm-lock.yaml:3900,5922,8843`) which allows raw HTML; the project's `Markdown.tsx:1-127` does NOT configure `rehype-sanitize` — verified by Grep across `odd-platform-ui/src` returning ZERO matches. A user with `QUERY_EXAMPLE_CREATE` permission (broadly granted via Administrator role per `V0_0_88__add_query_example_policy.sql:1-11`) can plant `<script>alert(document.cookie)</script>` in either field; the payload renders for every authenticated user who opens the details page OR scrolls past the row in the catalog. Critically: the doc page describes the query body as "the executable code" with screenshots showing code-block-style rendering — operators reasonably assume the field is treated as code, not as Markdown.

## Evidence

- `lineage/odd-platform/understanding/odd-platform__java__QueryExampleController__controller-class__QueryExampleController.md:239` (bugs[7]) — "No content sanitisation on `definition` or `query` — Markdown is rendered client-side as-is... This controller is the 4th member of the F-004 surface family."
- `odd-platform-api/src/main/resources/db/migration/V0_0_84__create_query_example.sql:4-5` — `definition text NOT NULL, query text NOT NULL` — verbatim storage, no constraints.
- `odd-platform-specification/components.yaml:2799-2808` — OpenAPI schema declares both `definition` and `query` as `string` with no `maxLength`, no `pattern`, no `format: html-escaped`.
- `odd-platform-ui/src/components/DataModelling/QueryExampleDetails/QueryExampleDetailsOverview.tsx:19, 25` — `<Markdown value={...}/>` rendering both fields.
- `odd-platform-ui/src/components/DataModelling/QueryExamples/QueryExamplesListItem.tsx:45, 52` — `<Markdown value={queryExample.definition} disableCopy />` + `<Markdown value={queryExample.query} disableCopy />` rendering both fields in the catalog row.
- `odd-platform-ui/src/components/shared/elements/Markdown/Markdown.tsx:1-127` — uses `MDEditor.Markdown` with default config; no `rehype-sanitize`. Verified per QueryExampleController sidecar bugs[7].
- `odd-platform-ui/pnpm-lock.yaml:3900, 5922, 8843` — `rehype-raw@6.1.1` bundled; allows raw HTML in Markdown.
- `lineage/odd-platform/understanding/odd-platform__java__QueryExampleController__controller-class__QueryExampleController.md:208` (doc-drift[1]) — "Doc says 'the executable code' and shows screenshots with a code-block-style rendering. The UI actually renders the query body through `MDEditor.Markdown` — a full Markdown parser, not a code-block renderer."

## Notes

- **This is an ENRICHER for F-025 (Query Examples)** AND for the F-004 stored-XSS family (DataEntity description + DatasetField description + TermDefinition — per TermDetails sidecar `coherence_check` extending F-004 to TermDefinition; this thread extends it to QueryExample `definition` + `query`, making it the **5th member of the family** if we count both QueryExample fields separately, the **4th surface** per the controller sidecar's counting).
- F-025 currently anchors "partial RBAC grid; 10/13 endpoints no security rule; XSS surface" — this thread adds the per-field rendering details + the catalog-row rendering (which doubles the surface: even users who don't open the details page see the payload).
- **The `query` field is uniquely dangerous**: it's the field operators most commonly paste from external sources (Stack Overflow, internal docs, AI assistants). A copy-paste from an attacker-controlled source containing Markdown-disguised script tags is the realistic attack path.
- **Read-collaborative posture compounds**: per QueryExampleController sidecar bugs[8], all 10 read endpoints have no RBAC gate — every authenticated user reads every query example, so the payload fires for everyone in the org.
- **The fix is layered**: (a) add `rehype-sanitize` to `Markdown.tsx` with a conservative allowlist; (b) for the `query` field specifically, swap `<Markdown>` for `<CodeBlock>` (a SQL/code-highlighter component) since the field is documented as "executable code"; (c) server-side input validation (Jsoup.clean or HTML allowlist) at `QueryExampleServiceImpl.createQueryExample`.
- **F-004 family pattern**: the same `Markdown.tsx` is the chokepoint for all 4 (now 5) surfaces. ONE fix closes all of them simultaneously. This is the **fix-once-close-all** property — high leverage.
- **Doc drift compounds**: the live `https://docs.opendatadiscovery.org/features/data-modelling/query-examples` (WebFetched 2026-05-20 per QueryExampleController sidecar) shows screenshots with code-block-style rendering but the UI renders Markdown. Operators who paste a Markdown-disguised payload thinking it'll appear verbatim get an XSS instead.

## Next

1. **Mark this as ENRICHER for F-025** (Category: clustering, Links.cluster_with: [F-025, F-004]) — the feature-flow-builder should add per-field rendering detail + catalog-row rendering + the F-004 family membership to F-025's drift surface.
2. **SEC-NNN**: prioritize the `Markdown.tsx` sanitiser fix — single chokepoint, closes 5 surfaces.
3. **REFACTOR-NNN**: swap `<Markdown>` for a code-highlighter on the `query` field specifically (doc-aligned semantic).
4. **TEST-NNN**: stored-XSS regression-pin — POST a query example with `<script>alert('xss')</script>` in both fields, GET the details + the list, assert response body contains the literal escaped string (or that the rendered DOM doesn't execute the script).
5. **DOC-NNN**: update the live `query-examples` page to either describe the Markdown-rendering behaviour (current truth) OR commit to the code-block-rendering claim (then fix the code).

## Links

- cluster_with: [F-025, F-004]
- merged_into: F-025
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged into F-025 (P-02:F-001 Query Examples — Note: P-02 has two F-NNN sharing pillar_anchored_id; the existing index reflects this) — thread is the 4th surface in the F-004 stored-XSS family extending to Query Example `definition` + `query` fields. drift_class: stored_xss_via_md_editor_no_rehype_sanitize_extends_to_query_examples (new facet). Catalog-row rendering DOUBLES the surface vs F-004 family (which is per-detail-page only) — XSS fires for any user scrolling the Query Examples list, not just opening a single detail page. Fix is at Markdown.tsx chokepoint (closes all 5 surfaces simultaneously). NOTE: not edited inline into F-025.yaml in this run because that's a P-02 pillar file outside Slice B+C's primary scope — flagged for the next P-02-focused builder pass.
