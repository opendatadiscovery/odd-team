---
doc_gap_id: DOC-GAP-304
severity: HIGH
category: drift
batch: ZI
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-02"           # Data Modelling — Relationships sub-feature
related_features: []
related_doc_gaps:
  - DOC-GAP-287      # Relationships cross-owner read-collaborative posture (sibling — visibility silence)
  - DOC-GAP-286      # Relationships RelationshipController detail-endpoint Category F drift
  - DOC-GAP-149      # REV-3 LAYER-0 — P-02 doc-page coverage META
related_retrospectives:
  - LSN-001          # operator-trap canonical
  - LSN-002          # operator-trap canonical
  - LSN-018          # Rule-6 coherence-conflict mechanism
---

## DOC-GAP-304 — `/data-modelling/relationships` UI bug — the Target column renders SOURCE entity data (copy-paste at `RelationshipsListItem.tsx:73-81`), AND the live doc page (WebFetched 2026-05-26 status 200) describes the table as having distinct **Source entity** + **Target entity** columns AND adds a misleading visibility claim ("The list page shows every relationship the user can see across all data sources" — implying RBAC filtering that does NOT exist) — the table is operator-broken (no row shows what each relationship POINTS TO) AND the doc copy is operator-misleading on TWO axes (column content + visibility model); a doc-vs-code mismatch where the DOC is RIGHT on the column intent and the CODE is WRONG, AND the DOC is WRONG on the visibility claim while the CODE is correctly catalog-global

**Severity**: HIGH
**Category**: drift (operator-visible UI bug at a load-bearing list surface + doc-copy misrepresentation of the visibility model)

### Surfaced by

- `odd-platform__ts__routes__route__relationships.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar — "HIGH-severity UI bug — Target column displays Source data: `RelationshipsListItem.tsx:73-81` renders the Target cell with `RelationshipDatasetInfo dataEntityId={item.sourceDataEntity.id} name={item.sourceDataEntity.internalName || item.sourceDataEntity.externalName || ''} oddrn={item.sourceDataEntity.oddrn || ''}` — identical to the Source cell at lines 64-72. The `item.targetDataEntity` field IS present on the `DataEntityRelationship` interface (used correctly by sibling components at `elements/Relationships/RelationshipTypes/EntityRelationship.tsx:33-35` and `GraphRelationship.tsx:32-34`). The bug is a copy-paste in the list-item renderer; the user sees the same dataset in both columns for every row. The doc page at `https://docs.opendatadiscovery.org/features/data-modelling/relationships` describes the table as having distinct Source and Target columns — the doc is correct and the code is wrong.") **(NEW batch ZI — relationships-route sidecar PRIMARY SOURCE)**
- `odd-platform__ts__routes__route__relationships.md:docs_link_semantic.doc_drift_findings.[0]` ("Target column doc-vs-code drift (operator-visible UI bug): the live doc at `https://docs.opendatadiscovery.org/features/data-modelling/relationships` describes the table as having `'Source entity, Target entity'` columns. The code at `RelationshipsListItem.tsx:73-81` renders the Target cell with `dataEntityId={item.sourceDataEntity.id} name={item.sourceDataEntity.internalName || item.sourceDataEntity.externalName || ''} oddrn={item.sourceDataEntity.oddrn || ''}` — identical to the Source cell (lines 64-72). The `item.targetDataEntity` field IS present on the `DataEntityRelationship` interface and IS consumed correctly by sibling components (`RelationshipTypes/EntityRelationship.tsx:33-35`, `RelationshipTypes/GraphRelationship.tsx:32-34`). The bug is a copy-paste in the list-item renderer. The doc is RIGHT; the code is WRONG. Severity HIGH — operator viewing the table sees no Target indication for any row. P-167 Block D pins the runtime observation.")
- `odd-platform__ts__routes__route__relationships.md:tests_coverage_semantic.uncovered_behaviours.[Target column]` (HIGH per sidecar — "Pure DOM observation — Source.href == Target.href for every row. P-167 Block D pins this. No regression test would catch this until shipped.")
- `odd-platform__ts__routes__route__relationships.md:docs_link_semantic.doc_drift_findings.[4]` ("Doc says 'Users can click any row to open the relationship's detail page, with routing determined by the relationship type' — the code at `RelationshipsListItem.tsx:52` always navigates to `dataEntityDetailsPath(item.id)` (the data-entity overview page), NOT to a relationship-type-specific detail URL. … The doc's 'routing determined by the relationship type' phrasing is misleading — from THIS list page, every click routes to the same `/dataentities/{id}/overview` URL regardless of type.")
- `concepts.yaml:entities[Data Entity Relationship]` — P-02 pillar canonical entry
- Cross-link DOC-GAP-287 — sibling Relationships doc-coverage finding (visibility silence); THIS finding adds the UI-BUG + doc-claim drift dimensions

### Evidence

- **Code primary source — the copy-paste bug**: `odd-platform-ui/src/components/DataModelling/Relationships/RelationshipsListItem.tsx:73-81` (per relationships-route sidecar) — the JSX renders the Target column as:
  ```
  <RelationshipDatasetInfo
    dataEntityId={item.sourceDataEntity.id}
    name={item.sourceDataEntity.internalName || item.sourceDataEntity.externalName || ''}
    oddrn={item.sourceDataEntity.oddrn || ''}
  />
  ```
  This is IDENTICAL to the Source column at lines 64-72. The `item.targetDataEntity` field is never referenced in the file.
- **Code corroboration — the correct usage in sibling components**: `RelationshipTypes/EntityRelationship.tsx:33-35` and `RelationshipTypes/GraphRelationship.tsx:32-34` BOTH correctly read `item.targetDataEntity.id` / `.internalName` / `.oddrn`. The `targetDataEntity` field IS available on the `DataEntityRelationship` interface; the type system would not catch the copy-paste because both `sourceDataEntity` and `targetDataEntity` have the same shape (`DataEntity` DTO).
- **Live doc primary source — fresh WebFetch this session**: `https://docs.opendatadiscovery.org/features/data-modelling/relationships` 2026-05-26 status **200**. Verbatim column list: *"A table with columns Name, Type (ERD or GRAPH), Namespace + Datasource, Source entity, Target entity."* The doc claims TWO distinct columns. The UI renders both columns with Source data.
- **Live doc additional finding — the visibility-claim drift (NEW DIMENSION not in DOC-GAP-287)**: same WebFetch verbatim: *"The list page shows every relationship the user can see across all data sources."* The phrasing **"the user can see"** implies a visibility filter is applied per user. The code (per ZE — RelationshipController sidecar + DOC-GAP-287) applies NO such filter — every authenticated user sees every relationship across every data source. The doc copy is operator-misleading: an operator reading the page reasonably believes their visibility is filtered by ownership / permission / data-source-access, when in fact it is catalog-global. DOC-GAP-287 covers the VISIBILITY SILENCE on this page (the page is silent on the visibility MODEL); THIS finding adds that the page is not just silent, it is WRONG about the existence of a visibility filter. The "user can see" phrasing is the doc's only mention of visibility, and it asserts a filter that does not exist.
- **The compound operator-impact**: an operator opens the Relationships page expecting to see entity-to-entity links. They see the Source column populated correctly (every row shows the source dataset). They see the Target column ALSO showing the same source dataset on every row. They reasonably conclude: (a) the catalog has no real relationships (all relationships point from a dataset to itself? — implausible), or (b) the UI is broken. Either inference is correct in part — the catalog DOES have target data (the JSON response correctly includes `targetDataEntity` for every row), but the UI rendering drops it. There is no way to discover the relationship's destination from this list page; the operator must click into the detail page (which routes to the SOURCE entity, per `RelationshipsListItem.tsx:52` — see the 5th doc_drift_finding) to see the relationship's other end via the linked-entity detail page.
- **The compound visibility-narrative**: the doc copy ALSO tells the operator they're seeing only relationships they have permission to view, which is FALSE. A multi-tenant deployment relying on `exclude_from_search` to hide sensitive Team B data sees those data sources ENUMERATED via Team A's Relationships page — even though the doc explicitly says the user only sees what they're allowed to. The "user can see" copy reinforces the wrong mental model the operator already has from per-feature doc pages that DO apply visibility filtering (per `/api/dataentities` in DOC-GAP-287's cross-reference).
- **The bug is statically visible AND has zero test coverage**: Grep across `odd-platform-ui/src` for `RelationshipsListItem` in `*.test.*` / `*.spec.*` returned zero matches at commit `4ec2b20` (per the relationships-route sidecar `tests_coverage_semantic`). The Test column would catch this bug instantly: any DOM assertion that the Target href differs from the Source href on a seeded multi-entity row would fail. The fix is a one-character edit (`sourceDataEntity` → `targetDataEntity`) at three lines (73, 76, 79).

### Proposed doc action

**THREE-PART action — code-fix-first (the UI bug is the load-bearing operator harm), doc-side correction (the visibility-claim drift), regression-test (the structural fix).**

1. **Code-side PRIMARY — fix the copy-paste at `RelationshipsListItem.tsx:73-81`**: change three field reads from `item.sourceDataEntity` to `item.targetDataEntity`:
   ```
   dataEntityId={item.targetDataEntity.id}
   name={item.targetDataEntity.internalName || item.targetDataEntity.externalName || ''}
   oddrn={item.targetDataEntity.oddrn || ''}
   ```
   Single-character-per-line edit. The fix can ship in the next bug-fix PR. File via `/log-issue odd-platform` if no maintainer-batch in flight.

2. **Doc-side PRIMARY — fix the visibility claim in `documentation/docs/features/data-modelling/relationships.md`** (or the equivalent local-repo path): replace the verbatim *"The list page shows every relationship the user can see across all data sources"* with an accurate description:

   > **The list page shows every relationship the platform has ingested across every data source.** Relationships are not owner-scoped at the API layer — every authenticated user sees the same list. Unlike the Data Entity list (which filters by `exclude_from_search`), the Relationships list does NOT apply the exclude-from-search filter — relationships pointing to entities flagged exclude-from-search ARE returned. For multi-tenant deployments where this exposure is unacceptable, gate `/api/relationships/**` at the perimeter or accept the disclosure as part of the catalog's discovery surface. See [DOC-GAP-287's Visibility model section](...) for the platform-wide pattern.

   This correction harmonises with DOC-GAP-287's proposed admonition; the two findings together close the page's visibility-coverage gap on BOTH axes (silence + misrepresentation).

3. **Test-side PRIMARY — add an integration test at `odd-platform-ui/src/components/DataModelling/Relationships/__tests__/RelationshipsListItem.test.tsx`** that:
   - Seeds a `DataEntityRelationship` with distinct `sourceDataEntity.id` and `targetDataEntity.id`
   - Renders `<RelationshipsListItem>` with the seeded entry
   - Asserts the rendered Target cell's `data-entity-id` (or equivalent) is `targetDataEntity.id`, NOT `sourceDataEntity.id`

   Single test catches the regression class. Bonus: parametrise across the three relationship types (ERD / GRAPH / nullable target) to cover the type-discrimination dimension.

4. **Doc-side COMPANION — fix the "routing determined by the relationship type" misrepresentation** (per sidecar doc_drift_finding[4]): the live doc says clicking a row routes to a type-specific detail page; the code routes every click to the source data-entity's overview page regardless of type. Either (a) correct the doc to "clicking a row opens the source entity's detail page; the relationship's other end appears in the linked-entities section there" OR (b) implement the type-specific routing the doc promises (the backend endpoints `/api/relationships/erd/{id}` and `/api/relationships/graph/{id}` exist; the UI list-row click would need a type-discriminated navigation handler — larger code change).

### Cross-references

- **DOC-GAP-287** (NEW batch ZE — Relationships read-collaborative posture / visibility silence — sibling Relationships doc-coverage finding; THIS finding extends DOC-GAP-287 with the UI BUG dimension + the "user can see" doc-claim drift dimension)
- **DOC-GAP-286** (NEW batch ZE — RelationshipController detail-endpoint Category F drift on `relationship_id` parameter naming — sibling Relationships surface; together with DOC-GAP-287 + THIS finding, the cluster covers controller (286) / authorization (287) / UI rendering + doc-claim (304))
- **DOC-GAP-095 META** (Read-collaborative cross-owner enumeration cluster) — THIS finding's visibility-claim-drift dimension strengthens the META by adding a doc-page that ACTIVELY WRONGLY CLAIMS visibility filtering
- **DOC-GAP-149 META** (REV-3 LAYER-0 — P-02 doc-page coverage drift) — THIS finding is a direct P-02 instance: doc-page-claims-vs-code-reality drift on the Relationships sub-feature
- **LSN-001 / LSN-002** (operator-trap canonical) — UI bug + doc-claim drift compound to silently mislead the operator on a load-bearing list surface

### Severity rationale

HIGH. The UI bug is the load-bearing harm: the Target column is BROKEN for every row, on a list surface designed precisely to show relationship endpoints. The doc-claim drift (visibility) compounds the harm by reinforcing the wrong mental model in the operator. Severity matches DOC-GAP-287 on the same surface because:

1. **The UI bug is operator-visible AND silently incorrect**: there is no error, no fallback, no warning — the column just shows wrong data. An operator unfamiliar with the codebase has no path to discover the bug except "click around and notice Source.href == Target.href on every row".
2. **The doc copy makes the bug HARDER to discover**: the operator reads "Source entity, Target entity" in the doc and the table shows two columns — the column LABELS match, only the DATA is wrong. The operator may not even notice the columns show the same dataset on every row because the visual layout is correct.
3. **The compounding visibility claim is a security-relevant doc-product defect**: an operator inferring "I'm only seeing what I'm allowed to see" from the doc copy makes deployment decisions that the catalog-global SQL contradicts.
4. **The fix is bounded**: one-character per-line UI edit + one doc rewrite + one integration test. The cost of NOT fixing is permanent operator distrust of the Relationships feature (a future operator who notices the Target bug Googles for it, finds no doc-side acknowledgement, files a bug — the support burden compounds).

Severity is NOT CRITICAL because: (a) the catalog data itself is intact (the JSON API returns the correct target entity); (b) no data loss; (c) no security boundary crossed beyond the existing read-collaborative posture (DOC-GAP-287); (d) the bug is detected on the first careful operator inspection.

### Last verified

- 2026-05-26 — relationships-route sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/data-modelling/relationships` status **200** (direct fetch this session — verbatim column-list + verbatim "user can see" copy confirmed); cross-corroboration via `RelationshipsListItem.tsx:64-81` (statically read; the copy-paste bug is unambiguous) + sibling-component evidence at `RelationshipTypes/EntityRelationship.tsx:33-35` (the correct usage shape).
