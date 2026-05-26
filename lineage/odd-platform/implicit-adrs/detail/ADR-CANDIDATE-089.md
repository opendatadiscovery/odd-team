## ADR-CANDIDATE-089 — Partial UI permission gating: `<WithPermissions>` wraps ONLY the mutation affordance (Edit button / Add button), NEVER the content render — the entity description, popular list, lineage canvas all render to every `DATA_ENTITY_VIEW` holder regardless of edit privilege (the UI realisation of the read-collaborative posture)

**Severity**: HIGH
**Classification**: extend-existing (strengthens ADR-CANDIDATE-003 with UI-side primary-source)
**Support count**: 4 sidecars (DataEntityDescription explicit + PopularStrip implicit + LineageGraph implicit + DataEntityDetails implicit via the 3-permission vector passed to header only)
**Axes present**: ui_components, ui_permissions
**Pillars affected**: [P-01, P-02, P-05, P-06, P-09] — cross-pillar (read-collaborative posture surfaces here)

**Surfaced by**:
- `DataEntityDescription.md:implicit_adrs[1]` (|-
    "Description editing is a per-entity-scoped permission distinct from description VIEWING — the Edit affordance is gated, but the rendered content is universally visible to every `DATA_ENTITY_VIEW` holder.")
- `DataEntityDescription.md:invariants` (|-
    "**Permission gating is partial — only the Edit affordance is gated, NEVER the rendered content.** `InternalDescriptionHeader.tsx:40-50` wraps the Edit/Add button in `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>`; `InternalDescriptionPreview.tsx:32-40` wraps the empty-state 'Add Description' button identically. The `<Markdown value={value} />` render at `InternalDescriptionPreview.tsx:21` runs unconditionally for ANY caller with `DATA_ENTITY_VIEW`.")
- `PopularStrip.md:security.authorization_assertions` (|-
    "no client-side permission gate on the Popular column specifically. ... the parent OwnerAssociation's `identity && ownership` check (OwnerAssociation.tsx:84-86), which is an ownership check, not a permission check")
- `LineageGraph.md:security.authorization_assertions` (|-
    "no permission gates, no `usePermission`-style hook in this tree. The mounting route `/dataentities/:id/lineage` is gated by the SPA's outer auth shell; under DISABLED the canvas renders for anonymous users with the same payload exposure")
- `DataEntityDetails.md:security.authorization_assertions` (|-
    "It passes a 3-permission vector (DATA_ENTITY_INTERNAL_NAME_UPDATE, DATA_ENTITY_GROUP_UPDATE, DATA_ENTITY_STATUS_UPDATE) to WithPermissionsProvider for descendant mutation affordances — the provider gates child UI elements but the **read** of the entity payload is unguarded")

**Decision statement**: The odd-platform-ui SPA implements **partial permission gating** — `<WithPermissions>` wrappers are positioned EXCLUSIVELY around mutation affordances (Edit buttons, Add buttons, status-change actions, group-edit forms). The CONTENT render (rendered Markdown body, popular tile data, lineage canvas, alerts list) is NEVER gated; it renders unconditionally for any user who can mount the route (any authenticated user under LOGIN_FORM/OAUTH2/LDAP, ANY caller under DISABLED).

This is the UI half of the read-collaborative posture documented at the backend layer (ADR-CANDIDATE-003 + REFACTOR-024/053/187/200/203 read-collaborative gap family across batches D-I). The SPA architecturally COMMITS that any user with discovery access to an entity can READ its description, view its Popular ranking, walk its lineage subgraph, see its alerts — gating applies only to MUTATION affordances surfaced to that user.

Concretely:
- **DataEntityDescription**: `WithPermissions(DATA_ENTITY_DESCRIPTION_UPDATE)` wraps ONLY the Edit/Add buttons (`InternalDescriptionHeader.tsx:40-50`, `InternalDescriptionPreview.tsx:32-40`); the `<Markdown value={value} />` content render is unguarded.
- **DataEntityDetails (header)**: `WithPermissionsProvider` carries `[DATA_ENTITY_INTERNAL_NAME_UPDATE, DATA_ENTITY_GROUP_UPDATE, DATA_ENTITY_STATUS_UPDATE]` for descendant mutation affordances; the entity-detail payload render itself is unguarded.
- **PopularStrip**: ZERO `WithPermissions` in the column; the only gates are the parent `OwnerAssociation`'s `identity && ownership` check (UX gate, not security) and the parent `Overview`'s `authType !== 'DISABLED'` check (defense-in-depth, not security).
- **LineageGraph**: ZERO `WithPermissions` in the canvas; under DISABLED the canvas renders for anonymous users with the same payload exposure as the authenticated case.

The placement is deliberate: hoisting the wrapper to gate the entire cluster would BREAK legitimate cross-owner read access. The intent is "show every authenticated user the content; gate the WRITE actions."

**Wisdom test (3-question)**:
1. *Intentional?* YES — the consistent placement at the BUTTON level (not the content level) across descriptions, headers, popular, lineage is structural commitment. The `WithPermissions` wrappers are positioned around the button JSX, NOT around the parent `Markdown` element — a deliberate decision (a `WithPermissions` wrapping the whole component would have hidden the description from non-editors; placing it only on the button preserves cross-owner read visibility).
2. *Structural impact?* YES — defines the read-collaborative posture from the UI side; affects every feature with view-vs-edit distinction.
3. *Refactoring or structural?* STRUCTURAL — introducing per-content-view permissions would require new permission keys, new backend resolution, new UI gate placement. Not a refactor.
→ ADR.

**Evidence**:
- DataEntityDescription.md says: "the `WithPermissions` wrappers are positioned around the button JSX, NOT around the parent `Markdown` element — a deliberate decision"
- DataEntityDetails.md says: "The component itself enforces no authorization. It passes a 3-permission vector ... for descendant mutation affordances ... but the **read** of the entity payload is unguarded."
- PopularStrip.md says: "no client-side permission gate on the Popular column specifically"
- LineageGraph.md says: "no permission gates, no `usePermission`-style hook in this tree"
- intent_anchor: the consistent button-only placement across 4+ surfaces

**Existing ADR**: STRENGTHENS ADR-CANDIDATE-003 (GET endpoints uniformly authenticated-only, no role/owner/permission gate — the BACKEND posture). This ADR is the UI realisation. Together they form the read-collaborative architectural commitment from both ends.

Also composes with:
- **ADR-CANDIDATE-088** (WithPermissions context primitive) — the mechanism.
- **ADR-CANDIDATE-054** (read-as-write view-count side effect) — the UI realisation of read-collaborative means the F-001 view_count loop is reachable from any user.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-200 (existing — Cross-owner read of full DataEntityDetails — STRENGTHENED with UI-side primary-source confirmation)
- REFACTOR-203 (existing — Lineage cross-owner enumeration via graph traversal — STRENGTHENED with UI-side primary-source: the UI fetches via `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage`, NOT via the anchor-set-defended `getMyObjectsWithDownstream`)
- REFACTOR-282 (NEW — Permission-gating placement fragility: a refactor hoisting `<WithPermissions>` to wrap a whole cluster would silently break legitimate read access)

**Proposed action**: EXTEND ADR-CANDIDATE-003 by adding the UI-side primary-source confirmation AND promote a NEW companion ADR `adrs/drafts/ui-partial-permission-gating-button-only.md`. Document:
- The button-only placement convention.
- The explicit list of surfaces (descriptions, headers, popular, lineage, alerts).
- The cross-reference to the read-collaborative backend posture (ADR-CANDIDATE-003).
- The maintenance obligation: a new mutation affordance MUST be wrapped in `<WithPermissions>` with the specific permission key; the content render MUST NOT be wrapped.
- The migration path if the team ever adopts per-view permissions: which permission keys would need new backend resolution + new gate placements.

**Severity rationale**: HIGH — this is the UI-side primary-source confirmation of the platform's most load-bearing security-architecture choice (read-collaborative posture). Every operator deploying ODD inherits this stance; the UI codifies the assumption.

**Cross-pillar bump**: P-01/P-02/P-05/P-06 × P-09 — security-architecture decision affecting multiple feature pillars. Severity already HIGH.

**Suggested backlog grouping**: `UI architecture codification` + `Authorization audit batch`.

---


## STRENGTHENS — Batch ZL (2026-05-26 — DataModelling QueryExamples Add + LookupTables Add + Search DEG-Create CTA all confirm the partial UI permission gating pattern)

Batch ZL surfaces three more instances of the partial UI permission gating pattern across distinct features: each surface uses `<WithPermissions>` around ONLY a mutation affordance (Add button), with the CONTENT (list, details, descriptions) rendered unconditionally.

**New surfaced_by entries**:

- `odd-platform__ts__react-component__component__LookupTables.md:implicit_adrs[1]` (HIGH) — "The Add-new button is gated by `LOOKUP_TABLE_CREATE` alone, not by `LOOKUP_TABLE_CREATE` AND a parent resource — implies lookup-table creation has no per-parent ownership gate (any user with global CREATE permission can create in any namespace)." — `<WithPermissions permissionTo={Permission.LOOKUP_TABLE_CREATE}>` wraps the +Add new button at LookupTables.tsx:72-82; the rest of the page (counter, search, list) renders unconditionally for any authenticated user.

- `odd-platform__ts__react-component__component__Search.md:implicit_adrs[1]` (HIGH) — "**Permission-gated DEG-Create CTA via WithPermissions (UI hide, NOT auth enforcement) — pattern parity with TermSearch batch-U + PolicyList batch-Q.** Lines 81-85 + Results.tsx:125-138. The decision is: render-nothing rather than render-disabled when permission absent. ... `<Results/>` mounts unconditionally; only the conditionally-rendered 'Add group' button (Results.tsx:125-138) is permission-gated AND class-tab-gated (`showDEGBtn`). ... The read surface is wide open to authenticated users."

- `odd-platform__ts__react-component__component__DataModelling.md:dependencies_semantic.requires-feature[2]` (HIGH) — Inner `<DataModellingRoutes/>` declares `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}>` around the `query-examples` route, but this is CONTEXT-SEED only (not a render-block); the actual Add-button gate is at `QueryExamples.tsx:36-46` via `<WithPermissions permissionTo={Permission.QUERY_EXAMPLE_CREATE}>`. The pattern matches: route renders unconditionally; only the Add button is gated.

**What this strengthening adds**: the prior support spanned the DataEntity description Edit + Popular Add + Lineage Add patterns. Batch ZL adds THREE more feature surfaces (LookupTables Add + Search DEG-Create + DataModelling QueryExamples Add), with three observable extensions:

1. **The pattern is CROSS-PILLAR** — recurs across Master Data, Data Discovery (Catalog), Data Modelling. Six feature surfaces now confirm.

2. **The pattern composes with route-level `WithPermissionsProvider`** — the route mount sometimes WRAPS the route's element in `<WithPermissionsProvider>` (LookupTables route at App.tsx:75-87; DataModellingRoutes for query-examples) which SEEDS permission context for the wrapped subtree but does NOT block rendering. The PER-BUTTON `<WithPermissions>` is what actually hides the button. The two are deliberately separated: Provider is context, Consumer is gate.

3. **The empty-state surface is shared across permission profiles** — operators without `*_CREATE` permission see the list page, the counter, the search input — but no Add button. This is the deliberate UX: render-nothing-rather-than-render-disabled, consistent across all six confirmed surfaces.

**Triangulation count after ZL**: 6 sidecars / 6 features (was 3; ZL adds 3 — LookupTables Add + Search DEG-Create + DataModelling QueryExamples Add).

**Severity unchanged**: HIGH — pattern is operator-visible across 6 features now; the read-collaborative + permission-gated-mutation shape is the canonical UI authz contract.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-088 (Permission framework — React Context); ADR-CANDIDATE-229 (WithPermissionsProvider context-seed-only); ADR-CANDIDATE-003 (Read-collaborative posture — content renders unconditionally); ADR-CANDIDATE-246 NEW this batch (modal-dialog form mount — the gated Add button opens the modal-dialog form).
- SUPERSEDES: none.
- CONFLICTS: none.

---
