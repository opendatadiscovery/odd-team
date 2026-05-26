## REFACTOR-675 — `RelationshipsListItem.tsx:73-81` HIGH-severity copy-paste UI bug — the Target column renders Source data, NOT Target data; every row of `/data-modelling/relationships` displays the source entity twice and never shows the target entity; the live doc page promises distinct Source + Target columns

**Severity**: HIGH
**Category**: ui-copy-paste-bug / operator-visible-broken-feature
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-02 Data Modelling]

**Surfaced by**:
- `odd-platform__ts__routes__route__relationships.md:bugs_limitations_corner_cases[0]` (HIGH) — "**HIGH-severity UI bug — Target column displays Source data**: `RelationshipsListItem.tsx:73-81` renders the Target cell with `RelationshipDatasetInfo dataEntityId={item.sourceDataEntity.id} name={item.sourceDataEntity.internalName || item.sourceDataEntity.externalName || ''} oddrn={item.sourceDataEntity.oddrn || ''}` — identical to the Source cell at lines 64-72. The `item.targetDataEntity` field IS present on the `DataEntityRelationship` interface (used correctly by sibling components at `elements/Relationships/RelationshipTypes/EntityRelationship.tsx:33-35` and `GraphRelationship.tsx:32-34`). The bug is a copy-paste in the list-item renderer; the user sees the same dataset in both columns for every row."
- `odd-platform__ts__routes__route__relationships.md:docs_link_semantic.doc_drift_findings[0]` (HIGH) — "**Target column doc-vs-code drift (operator-visible UI bug)**: the live doc at `https://docs.opendatadiscovery.org/features/data-modelling/relationships` describes the table as having `'Source entity, Target entity'` columns. The code at `RelationshipsListItem.tsx:73-81` renders the Target cell with `dataEntityId={item.sourceDataEntity.id}` ... The doc is RIGHT; the code is WRONG. Severity HIGH — operator viewing the table sees no Target indication for any row."
- `odd-platform__ts__routes__route__relationships.md:probes_emitted.P-167` (Block D) — "Does the Target column on RelationshipsListItem render Source data (the statically visible UI bug)?"

**Description**: The Relationships list page at `/data-modelling/relationships` renders a table with columns Name, Type, Namespace+Datasource, Source, Target. The row renderer at `components/DataModelling/Relationships/RelationshipsListItem.tsx:49-83` renders FIVE cells per row. Cells for Name, Type, Namespace+Datasource (lines 49-63) are correct. The Source cell (lines 64-72) correctly reads from `item.sourceDataEntity`. The Target cell (lines 73-81) ALSO reads from `item.sourceDataEntity` — copy-paste error.

The interface `DataEntityRelationship` (generated from OpenAPI) carries BOTH `sourceDataEntity` and `targetDataEntity` fields. Both fields are correctly populated by the backend (per ZE RelationshipController sidecar; per the row-level detail components `EntityRelationship.tsx:33-35` and `GraphRelationship.tsx:32-34` which correctly consume both fields). The bug is localised to the list-item row renderer only.

**Operator-visible failure mode**: every row of the Relationships list shows the same entity twice — Source and Target columns are identical. An operator using the list to understand "what relationships exist between which entities" sees no Target information; the list is functionally half-broken. A user clicking through to the row's detail page (`dataEntityDetailsPath(item.id)`) finally sees the Target on the detail page's relationship section, but only by navigating away from the list.

**Why the bug is invisible to the TypeScript compiler**: `item.sourceDataEntity.id` is type-correct (the field exists, types match). The compiler has no signal that the value SHOULD have been `item.targetDataEntity.id`. The bug is semantically wrong but syntactically valid.

**Evidence**:
- `components/DataModelling/Relationships/RelationshipsListItem.tsx:64-72` (Source cell, correct)
- `components/DataModelling/Relationships/RelationshipsListItem.tsx:73-81` (Target cell, BUGGY — reads `item.sourceDataEntity` instead of `item.targetDataEntity`)
- `components/shared/elements/Relationships/RelationshipTypes/EntityRelationship.tsx:33-35` (sibling component correctly consumes `item.targetDataEntity`)
- `components/shared/elements/Relationships/RelationshipTypes/GraphRelationship.tsx:32-34` (another sibling correctly consumes `item.targetDataEntity`)
- live doc `https://docs.opendatadiscovery.org/features/data-modelling/relationships` (2026-05-26 status 200) — verbatim "table displaying 'Name, Type (ERD or GRAPH), Namespace + Datasource, Source entity, Target entity'"

**Existing-ADR-or-implied-prescription**: no governing ADR; the doc page is the canonical promise of what the table shows. The fix is a one-line code change.

**Proposed remedy**: Single-line fix in `components/DataModelling/Relationships/RelationshipsListItem.tsx:73-81`:

```tsx
// Replace each `item.sourceDataEntity` reference in lines 73-81 with `item.targetDataEntity`:
<RelationshipDatasetInfo
  dataEntityId={item.targetDataEntity.id}
  name={item.targetDataEntity.internalName || item.targetDataEntity.externalName || ''}
  oddrn={item.targetDataEntity.oddrn || ''}
/>
```

Companion: add a UI test asserting `Source.href !== Target.href` on a seeded row to prevent the regression. The directory-wide test gap (REFACTOR-289) means no automated regression test exists; this is the highest-leverage test addition.

**Severity rationale**: HIGH — operator-visible broken feature on a UI surface shipped to users; doc-page promise unmet; static UI bug detectable by trivial inspection. Time-to-fix is minutes. The bug shipped at commit 4ec2b20 (HEAD as of 2026-05-26).

**Suggested backlog grouping**: `UI bug fix sprint` — pair with REFACTOR-289 (UI test bootstrap) so the regression test is added with the fix.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-289 (UI test gap — this is the canonical example of a test-gap-detected bug); ADR-CANDIDATE-229 (the relationships route's no-Provider posture is correct architecturally, but the buggy row renderer is the operator-visible failure within that correct architecture).
- SUPERSEDES: none.
- CONFLICTS: none.
