## ADR-CANDIDATE-003 — STRENGTHENED by batch J (5 UI-axis sidecars confirming read-collaborative posture from the UI realisation side)

This file appends batch-J primary-source confirmations to ADR-CANDIDATE-003 ("GET endpoints intentionally outside SECURITY_RULES; reads uniformly authenticated-only, no role/owner/permission gate"). The original ADR's borderline_flag was RESOLVED to intentional in batch 2026-05-12F via three centerpiece-read confirmations (getDataEntityDetails + getDataEntityDownstreamLineage + search). Batch J adds the UI-realisation primary-source: the SPA architecturally COMMITS to the read-collaborative posture and renders content unconditionally for every authenticated user.

**Batch J new surfaced_by**:
- `DataEntityDescription.md:invariants` (|-
    "**Permission gating is partial — only the Edit affordance is gated, NEVER the rendered content.** `InternalDescriptionHeader.tsx:40-50` wraps the Edit/Add button in `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>`; `InternalDescriptionPreview.tsx:32-40` wraps the empty-state 'Add Description' button identically. The `<Markdown value={value} />` render at `InternalDescriptionPreview.tsx:21` runs unconditionally for ANY caller with `DATA_ENTITY_VIEW`.")
- `DataEntityDetails.md:security.authorization_assertions` (|-
    "It passes a 3-permission vector (DATA_ENTITY_INTERNAL_NAME_UPDATE, DATA_ENTITY_GROUP_UPDATE, DATA_ENTITY_STATUS_UPDATE) to WithPermissionsProvider for descendant mutation affordances — the provider gates child UI elements but the **read** of the entity payload is unguarded. Any user who can reach this route ... can mount this page and trigger all 5 dispatches.")
- `LineageGraph.md:security.authorization_assertions` (|-
    "no permission gates, no `usePermission`-style hook in this tree. The backend `DataEntityController.getDataEntityDownstreamLineage` has no `@PreAuthorize` per batch-F sidecar; the UI mirrors that absence (no gate to read).")
- `LineageGraph.md:bugs_limitations_corner_cases.[9]` (|-
    "**Anchor-set defence-in-depth not exercisable at the UI** — the UI ALWAYS fetches via `/api/dataentities/{id}/lineage/downstream` and `/upstream`, the NEGATIVE case of REFACTOR-225/237 anchor-set pattern. The UI does NOT use `getMyObjectsWithDownstream` (the POSITIVE case used by DataEntityRelationsServiceImpl). Consequence: every user (LOGIN_FORM/OAUTH2/LDAP authenticated; anonymous if DISABLED) enumerates the cross-owner lineage subgraph from the Lineage tab — the user-visible effect of REFACTOR-203.")
- `PopularStrip.md:security.owner_scoping` (|-
    "BYPASSES — Popular displays the same view_count-DESC ranking to every user regardless of their Owner — DataEntityList.tsx renders whatever the API returns; the API has no owner predicate per batch-G `getPopular.md:owner_scoping`.")

**Updated support count**: Now **11+ sidecars** triangulated (6 backend from batch-F's confirmation + 5 UI from batch J). The strongest confirmation of the read-collaborative posture in the catalog.

**Cross-pillar significance**: Batch J's UI-side surfaces span P-01 (Discovery — Description + Details + PopularStrip) + P-05 (Lineage — LineageGraph) + P-09 (Security — partial permission gating ADR-CANDIDATE-089). The read-collaborative posture is now confirmed across BOTH the backend (where the gate would live) AND the frontend (where the affordance would be hidden); the SPA INTENTIONALLY does not compensate for the backend's absence of per-owner gating — the read-collaborative commit is end-to-end.

**Co-surfaced gaps newly confirmed by batch J**:
- REFACTOR-200 (existing — cross-owner DataEntityDetails read) — UI-side primary-source confirmation: the SPA dispatches the fetch unconditionally for any user
- REFACTOR-203 (existing — Lineage cross-owner enumeration) — UI-side primary-source PRIMARY-SOURCE confirmation: the UI never uses anchor-set-defended endpoints; it ALWAYS uses the cross-owner-traversable endpoints
- REFACTOR-225/237 (existing — anchor-set defence-in-depth) — UI-side NEGATIVE case primary-source confirmation: the UI never exercises the positive anchor-set path

**Borderline_flag status**: REMAINS RESOLVED to intentional. Batch J adds the UI-realisation evidence to the already-strong backend evidence. The maintainer's architectural commitment is now unambiguous: read-collaborative posture is end-to-end intentional.

---
