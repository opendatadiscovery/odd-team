## REFACTOR-300 — Popular tile click-target doc-vs-code drift: live doc says "Clicking a tile opens that entity's Structure page", code navigates to entity's Overview tab (`dataEntityDetailsPath` defaults to `path='overview'`); critical because Overview is the F-001 view_count-incrementing endpoint

**Severity**: MEDIUM
**Category**: doc-code-drift + ux-bug
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:docs_link_semantic.doc_drift_findings[0]` (|-
    "**Click target mismatch — docs say 'Structure page', code navigates to 'overview'.** The live page (WebFetched 2026-05-19, status 200) states 'Clicking a tile opens that entity's **Structure** page' (also at local docs `catalog-overview.md:54`). The code at `DataEntityList.tsx:38` calls `dataEntityDetailsPath(item.id)` which defaults to `path='overview'` per `dataEntitiesRoutes.ts:66-73`. Result: a Popular tile click lands on the entity's Overview tab, NOT its Structure tab.")

**Description**: A clean doc-code drift on the Popular tile's navigation target:
- **Live doc** (`https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview`, mirrored at `catalog-overview.md:54`):
  > "Clicking a tile opens that entity's **Structure** page."

- **Code** (`DataEntityList.tsx:38` + `dataEntitiesRoutes.ts:66-73`):
  ```ts
  // DataEntityList.tsx:38
  <Link to={dataEntityDetailsPath(item.id)}>
  // dataEntitiesRoutes.ts:66-73
  export const dataEntityDetailsPath = (id, path = 'overview') => `/dataentities/${id}/${path}`;
  ```
  → Tile click navigates to `/dataentities/{id}/overview` (the Overview tab).

The drift is consequential for the F-001 view_count loop closure:
- **Overview tab** mount fires `fetchDataEntityDetails` → `GET /api/dataentities/{id}` → `incrementViewCount` (per batch-F `getDataEntityDetails.md:implicit_adrs[2]`).
- **Structure tab** is a different SPA route (`/dataentities/{id}/structure`) — whether it fires the view_count increment depends on whether the Structure tab's mount triggers the same `fetchDataEntityDetails` thunk (it does, transitively — every entity-detail-page route mounts `DataEntityDetails` which has the LSN-017 useEffect at the page-component layer).

So the increment fires regardless of which tab is the click target. The drift is more about the operator's MENTAL MODEL of what they see post-click:
- Doc says: click Popular → land on Structure (the schema view).
- Code does: click Popular → land on Overview (the description / metadata view).

Each has different operational utility. The Structure page is more "what is this thing structurally"; the Overview is "what does this thing mean operationally." Operators expecting the doc's behaviour will be slightly disoriented.

**Decision direction**:
- **Option A** — Doc is wrong: update doc to say "Clicking a tile opens that entity's Overview tab — the description, owners, tags, terms, and custom metadata of the entity."
- **Option B** — Code is wrong: change `dataEntityDetailsPath` default from `'overview'` to `'structure'`. WARNING: this changes the default navigation for EVERY use of `dataEntityDetailsPath` across the SPA (search results, directory leaves, lineage node clicks, etc.) — not just Popular. Significantly larger blast radius.

Option A is the safer change. Option B is the larger refactor.

**Primary source citations**:
- `documentation/docs/data-discovery/catalog-overview.md:54` (the doc statement)
- `DataEntityList.tsx:38` (the Link)
- `dataEntitiesRoutes.ts:66-73` (the default path)
- `PopularStrip.md` documents the drift

**Existing-ADR-or-implied-prescription**: No existing ADR prescribes which tab is the default click target. The current code's choice is a structural commit (Overview is the default landing); the doc's claim is misleading.

**Proposed remedy**: DOC-NNN — update `catalog-overview.md:54` to align with the code (Option A). The text change:
> "Clicking a tile opens that entity's Overview tab — the description, owners, tags, terms, and custom metadata of the entity. Other tabs (Structure, Lineage, Test reports, etc.) are reachable from the entity detail page's tab strip."

Pair with explicit acknowledgement that the Overview tab's mount triggers the view_count increment (cross-reference REFACTOR-220 + ADR-CANDIDATE-054).

**Severity rationale**: MEDIUM — doc-code drift on a user-facing navigation behaviour; affects operator expectations on home-page interaction; surfaces the F-001 loop's UI realisation point. Fix is doc-only (Option A).

**Suggested backlog grouping**: `Doc completeness sprint` + `F-001 view_count chain documentation`.

---
