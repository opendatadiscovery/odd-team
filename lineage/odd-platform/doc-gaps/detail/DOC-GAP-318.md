---
doc_gap_id: DOC-GAP-318
severity: LOW
category: drift (cosmetic — Java alias typo + UI's structural ERD-as-sub-tab vs doc framing of "Relationships shown as ERD diagrams")
batch: ZL
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-02"           # Data Modelling
related_features:
  - F-025            # Query Examples
  - F-037            # ERD/Graph Relationships Listing
related_doc_gaps:
  - DOC-GAP-287      # /data-modelling/relationships visibility silence (sibling P-02 finding)
  - DOC-GAP-304      # Relationships Target column UI bug (sibling P-02 UI finding)
  - DOC-GAP-302      # WithPermissionsProvider naming-vs-behaviour META
related_retrospectives:
  - LSN-020          # NAME-vs-IMPLEMENTATION drift class (mild instance)
---

## DOC-GAP-318 — `DataModelling.tsx` component composes two child layouts (Sidebar + Content); two structural-doc-clarity opportunities surface from the component sidecar: (a) `App.tsx:40` lazy-imports the component with the local alias `DataModeling` (SINGLE 'l') while the file/component/pillar canonical name is `DataModelling` (DOUBLE-l) — internal Java-side typo persists because no lint catches the file-name-vs-alias asymmetry; cosmetic, not user-visible; (b) the live doc page describes Relationships as "shown as ERD diagrams" but the UI implements ERD as a SUB-TAB inside Relationships (not as a peer tab to Query Examples + Relationships) — a first-time operator expecting three peer tabs at the DataModelling layer is mildly confused

**Severity**: LOW
**Category**: drift (cosmetic typo + minor doc-clarity opportunity)

### Surfaced by

- `odd-platform__ts__react-component__component__DataModelling.md:implicit_adrs.[App.tsx alias typo]` ("The local import alias `DataModeling` (single 'l') at `App.tsx:40` differs from the pillar's canonical spelling 'Data Modelling' (double-l, used everywhere else) — this is observably a typo, not a deliberate naming decision (the file is `DataModelling.tsx` with double-l; the default export is `DataModelling`; the AppToolbar tab label is `t('Data Modelling')`; the route module is `routes/dataModelling/dataModelling.ts`; the BASE_PATH is `/data-modelling`). The decision (implicit): the alias is local to App.tsx and does not leak to the user-facing surface; the typo persists because no test or lint rule catches the file-name-vs-alias asymmetry. Cosmetic, not a bug.")
- `odd-platform__ts__react-component__component__DataModelling.md:bugs_limitations_corner_cases.[Local import alias]` (LOW per sidecar — same finding)
- `odd-platform__ts__react-component__component__DataModelling.md:docs_link_semantic.doc_drift_findings.[ERD as sub-tab not peer tab]` ("**The doc says Relationships are 'shown as ERD diagrams, covering two relationship types: ENTITY_RELATIONSHIP and GRAPH_RELATIONSHIP'** — at THIS component layer, ERD is NOT a peer tab of Query Examples + Relationships. The sidebar declares exactly two tabs (`DataModellingTabs.tsx:13-22`: Query Examples + Relationships); ERD lives as a SUB-tab WITHIN Relationships at `components/DataModelling/Relationships/RelationshipsTabs.tsx:7-23` (ALL / ERD / Graph as `type` query-param values). The doc's framing is consistent with the code (Relationships is the surface that includes ERD diagrams as one of its three sub-views), but a reader who expects three peer tabs at this layer would be surprised. NOT a drift, but a clarity opportunity for the doc.")
- `odd-platform__ts__react-component__component__DataModelling.md:stress_findings.name_behavior_pairs.[<DataModellingTabs/>]` (NONE drift; "Operator sees 2 sidebar tabs at the Data Modelling pillar layer. To filter Relationships to just-ERD edges, they click 'Relationships' (Sidebar) → 'ERD' (top-of-page tab); the URL becomes `/data-modelling/relationships?type=ERD`. NOT a drift, but a documentation opportunity (the layered navigation is not obvious to a first-time operator).")

### Evidence

- **Code primary source — the alias typo**: `odd-platform-ui/src/components/App.tsx:40` (per sidecar primary source): `const DataModeling = lazy(() => import('./DataModelling/DataModelling'))` — note the single 'l' on the LHS variable name. The file path is `./DataModelling/DataModelling` (double-l), the file's default export is `DataModelling` (double-l), the JSX usage at `App.tsx:74` is `<DataModeling />` (single-l alias). The mismatch is local to `App.tsx`.
- **Code primary source — the pillar's canonical name everywhere else**:
  - `components/DataModelling/DataModelling.tsx:6,17` — `const DataModelling: React.FC` + `export default DataModelling`
  - `components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:51` — `t('Data Modelling')` (i18n key with double-l)
  - `routes/dataModelling/dataModelling.ts` — route module path uses double-l camel-case
  - `application.yml` BASE_PATH `/data-modelling` — kebab-case rendering
  - System mission's pillar P-02 named "Data Modelling" with double-l
- **The structural ERD-as-sub-tab pattern**: `components/DataModelling/DataModellingTabs.tsx:11-23` declares EXACTLY 2 peer tabs (Query Examples + Relationships). The ERD/Graph filtering lives at `components/DataModelling/Relationships/RelationshipsTabs.tsx:7-23` where `type` query-param values (`ALL`, `ERD`, `GRAPH`) drive a secondary filter. URL shape: `/data-modelling/relationships?type=ERD`.
- **Live doc primary source (WebFetched 2026-05-26 status 200 via DataModelling.tsx sidecar inferred_docs)**: `https://docs.opendatadiscovery.org/features/data-modelling` — verbatim quoted in the sidecar fetched_excerpts:
  > "Sub-sections and Tabs: 1. Query Examples — operator-created SQL/KQL/Spark snippets attached to entities and terms ... 2. Relationships — entity-to-entity links shown as ERD diagrams, covering two relationship types: ENTITY_RELATIONSHIP (foreign-key-style edges) and GRAPH_RELATIONSHIP (free-form graph edges)."

  The doc explicitly says "two sub-sections" (Query Examples + Relationships). It DOES specify that Relationships INCLUDES "ERD diagrams" — so the doc is NOT actively wrong on the structure. The "clarity opportunity" is that a first-time operator expecting three top-level tabs (Query Examples + Relationships + ERD) would be mildly confused by the two-tab Sidebar.
- **The "Data Modelling" → `queryExamplesPath()` deep-link surface**: per sidecar `stress_findings.name_behavior_pairs.[DataModelling]`: "The toolbar's `Data Modelling` tab actually deep-links to `queryExamplesPath()` (ToolbarTabs.tsx:50-54), i.e. directly to Query Examples — bypassing the bare `/data-modelling` URL. The bare URL `/data-modelling`, when visited, redirects to `/data-modelling/query-examples` via `<Navigate to='query-examples' />` at `DataModellingRoutes.tsx:16`. There is NO pillar-overview screen at any URL in this subtree; landing on Query Examples is the design." This is consistent with the live doc's "default route /data-modelling redirects to /data-modelling/query-examples" framing.
- **Operator-impact narrative (mild)**: a first-time operator opens the Data Modelling tab, lands on Query Examples, sees a sidebar with two entries. They want to view the platform's ERD diagrams (a common first-time exploration). They click "Relationships" expecting an ERD landing page. They get a list of relationships with an `All` filter. They scan the page, see the secondary tab strip (`All / ERD / Graph`), click ERD, finally see the diagrams. The journey requires two clicks instead of the doc-implied one click. Mild productivity friction; recoverable.

### Proposed doc action

**TWO-PART action — doc-side clarity (minor) + code-side rename (advisory).**

1. **Doc-side OPTIONAL — extend `documentation/docs/features/data-modelling/relationships.md` (and the parent `data-modelling.md`)** with a small navigation note:

   > **Layered navigation**: the Data Modelling sidebar contains TWO peer tabs (Query Examples + Relationships). ERD diagrams live INSIDE the Relationships sub-page as one of three secondary filters (All / ERD / Graph). To navigate directly to ERD diagrams: click "Relationships" in the sidebar, then "ERD" in the secondary tab strip. The URL shape is `/data-modelling/relationships?type=ERD` — bookmark-friendly.

2. **Code-side ADVISORY (file `/log-issue odd-platform`)** — single small rename:

   - Rename `App.tsx:40` import alias from `DataModeling` (single-l) to `DataModelling` (double-l) for consistency with the pillar's canonical name. One-line edit; ESLint will catch the renamed JSX usage at App.tsx:74.
   - Optional: add an ESLint rule `import/named` or a custom rule enforcing `import alias must match file's default export name`.

### Cross-references

- **DOC-GAP-287** (`/data-modelling/relationships` doc page silent on cross-owner visibility) — sibling P-02 finding; both findings demonstrate that the Data Modelling pillar doc page has structural-clarity opportunities.
- **DOC-GAP-304** (Relationships Target column UI bug) — sibling P-02 UI finding; combined with THIS finding, the Data Modelling pillar UI surface has three documented findings.
- **DOC-GAP-302** (WithPermissionsProvider naming-vs-behaviour META) — adjacent: the alias typo is the cosmetic counterpart to the load-bearing META naming drift; both are quality-of-code findings.
- **F-025** (Query Examples) + **F-037** (ERD/Graph Relationships) — THIS finding extends the documentation of the layered navigation between the two features.
- **LSN-020** (NAME-vs-IMPLEMENTATION drift class) — adjacent mild instance: the local alias `DataModeling` doesn't match the file's `DataModelling` export. Cosmetic typo class.

### Severity rationale

LOW. Cosmetic + minor doc-clarity opportunity; not operator-blocking. Severity classification:

1. **Not user-visible**: the `DataModeling` alias is INTERNAL to App.tsx; no operator sees it. The UI label is `t('Data Modelling')` (double-l). The URL is `/data-modelling` (double-l in kebab-case).
2. **Mild productivity friction**: a first-time operator's two-click journey to ERD diagrams (vs the doc-implied one-click) is a one-time discoverability cost. Repeat usage is fine (they remember the layered navigation).
3. **Fix cost is trivial**: one-line code edit + one-paragraph doc addition.
4. **No data corruption, no security impact, no operational gap**: pure quality-of-presentation.
5. **Bundled with DOC-GAP-287 + DOC-GAP-304**: the Data Modelling pillar has multiple documented findings; THIS one is the lowest-priority of the cluster.

Severity is NOT MEDIUM because the operator-impact is bounded to a one-time discoverability friction; severity is NOT NONE because the doc's "two sub-sections + ERD diagrams" framing IS structurally ambiguous for a first-time reader.

### Last verified

- 2026-05-26 — DataModelling.tsx UI-component sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/data-modelling` status **200** (verbatim "two sub-sections" framing confirmed in the DataModelling.tsx sidecar `inferred_docs[0]` fetched 2026-05-26).
