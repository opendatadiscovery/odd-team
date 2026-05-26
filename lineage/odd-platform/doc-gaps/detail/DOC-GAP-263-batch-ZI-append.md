## STRENGTHENS — batch ZI (UI Routes 2) — 2026-05-26

**Trigger**: activity-route + search-route + directory-route + relationships-route + queryExamples-route sidecars all enriched at substrate commits `80637ed` / `ede5d277` / `4ec2b20`.

**Strengthen delta**: DOC-GAP-263 was authored from the `/data-quality` route + DataQualityContent component sidecars in batch ZC — naming a Quality Dashboard route mounted at `App.tsx:73` with NO `WithPermissionsProvider` wrapper AND every live Data Quality doc page silent on access control. The finding's claim was: the route is unprotected client-side; the doc page does not explain who can see it; the operator cannot infer "this is intentional vs misconfigured". Batch ZI confirms the SAME pattern across FIVE more top-nav routes — extending the cluster of "route-level access-control silence" from the Data Quality pillar to the Discovery (P-01) + Data Modelling (P-02) + Audit (P-08) pillars.

**New cluster instances surfaced (per the 5 ZI route-module sidecars)**:

1. **`/activity` route** (per activity-route sidecar `bugs_limitations_corner_cases[0]`): *"The route `<Route path={activityPath()} element={<Activity />} />` at `App.tsx:65` has NO `WithPermissionsProvider` wrapper. … The platform-wide audit trail is therefore globally visible."* The live activity-feed doc page (verified 2026-05-26 status 200 — DOC-GAP-303 / DOC-GAP-025 references) is silent on access control. SAME PATTERN as DOC-GAP-263's framing on `/data-quality`.

2. **`/search` route** (per search-route sidecar `bugs_limitations_corner_cases[1]`): *"No UI route guard — Catalog page reachable by any authenticated user (and unauthenticated when `auth.type=DISABLED`)."* The live `/features/data-discovery/search` page is silent on access control (per NEW DOC-GAP-305 this batch). SAME PATTERN.

3. **`/directory/*` route** (per directory-route sidecar `bugs_limitations_corner_cases[0]`): *"No client-side permission gate at the URL declaration's only mount site (`App.tsx:72`). … The 'Directory' top-bar tab is also rendered unconditionally."* The live `/features/data-discovery/directory` page is silent on access control (per existing DOC-GAP-201 + DOC-GAP-306). SAME PATTERN.

4. **`/data-modelling/relationships` sub-route** (per relationships-route sidecar `bugs_limitations_corner_cases[1]`): *"Zero-authz exposure of the relationship catalog to every authenticated user: the route at `DataModellingRoutes.tsx:40` is unwrapped (no `WithPermissionsProvider`); the backend at ZE (`RelationshipController`) has no @PreAuthorize, no SECURITY_RULES match for `/api/relationships/**`, no service check, no owner-scoping."* The live `/features/data-modelling/relationships` page mentions visibility-via-implication ("the list page shows every relationship the user can see across all data sources" — DOC-GAP-304 NEW this batch) but ACTUALLY applies NO filter. SAME PATTERN with the EXTRA dimension: the doc has phrasing that implies a filter exists, but it does not.

5. **`/data-modelling/query-examples` sub-route + `/data-modelling/query-examples/:queryExampleId`** (per queryExamples-route sidecar `security.known_security_gaps[0]`): *"The sub-route's `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:19-25, 31-37` does NOT block rendering. A user without `QUERY_EXAMPLE_CREATE` viewing `/data-modelling/query-examples` sees the list; a user without `QUERY_EXAMPLE_UPDATE|DELETE` viewing the details page sees the details."* This is a SLIGHTLY DIFFERENT shape (the wrapper IS present but is non-blocking — see DOC-GAP-302 META) but the EFFECT is the same as DOC-GAP-263's pattern: the page is reachable for any authenticated user. The live `/features/data-modelling/query-examples` page (WebFetched 2026-05-26 status 200 this session) DOES describe action-level gating correctly (verbatim: *"The button is gated by the QUERY_EXAMPLE_CREATE permission — users without it see the list but no create entry-point"*) — so the doc page is HALF-CORRECT (action-level gating named) and HALF-SILENT (page-level access-model not explicitly named as "any authenticated user can view"). The maintainer's most-efficient pass per the DOC-GAP-302 META section adds the page-vs-button explanation once and cross-links from each per-feature page.

**The cluster of "route-level access-control silence" now spans EIGHT route surfaces across FIVE pillars**:

| Pillar | Surface | Status | DOC-GAP |
|---|---|---|---|
| P-04 Data Quality | `/data-quality` | bare mount + doc silent | DOC-GAP-263 (original) |
| P-08 Audit | `/activity` | bare mount + doc silent on access | NEW THIS BATCH (cross-link DOC-GAP-303 + DOC-GAP-200) |
| P-01 Discovery | `/search` (Catalog) | bare mount + doc silent on all URL-mediated state | NEW THIS BATCH (NEW DOC-GAP-305 + DOC-GAP-079) |
| P-01 Discovery | `/directory/*` | bare mount + doc silent on access | EXTENDED THIS BATCH (DOC-GAP-201 + DOC-GAP-306) |
| P-02 Data Modelling | `/data-modelling/relationships` | bare mount within wrapped parent + doc silent | EXTENDED THIS BATCH (DOC-GAP-287 + DOC-GAP-304) |
| P-02 Data Modelling | `/data-modelling/query-examples` | wrapped (but non-blocking) + doc partial | NEW dimension THIS BATCH (cross-link DOC-GAP-302) |
| P-02 Data Modelling | `/data-modelling/query-examples/:id` | wrapped (but non-blocking) + doc partial | NEW dimension THIS BATCH (cross-link DOC-GAP-302) |
| P-08 Management | `/management/integrations` | bare within wrapped parent | covered DOC-GAP-301 + DOC-GAP-302 |

**The META reframe**: with 8+ surfaces confirmed, the cluster is no longer "the `/data-quality` page is special"; the cluster IS THE PLATFORM-WIDE NORM. Every public-feature page is silent on the access model. The doc-product fix (the META section per DOC-GAP-302 + per-page cross-links) is now structurally necessary for OPERATOR DEPLOYMENT DECISIONS — operators evaluating ODD for multi-tenant / regulated environments cannot infer the access posture from any single page; they must read all 8 pages + the Authorization page + 3 layers of sidecar to reconstruct the picture.

**Proposed action — NO change to DOC-GAP-263's original proposed action**:

DOC-GAP-263 proposed (1) an access-control admonition on every Data Quality live doc page; (2) a code-side `WithPermissionsProvider` wrapper around `<DataQuality />` at `App.tsx:73` (if the maintainer chooses to enforce gating). Both remain. Batch ZI strengthens the case for the META section in DOC-GAP-302 by adding 7 more surfaces; the META section is the cross-cutting fix; the per-page admonitions per DOC-GAP-263 / DOC-GAP-200 / DOC-GAP-201 / DOC-GAP-287 / DOC-GAP-305 / DOC-GAP-306 are the per-surface fixes.

**No live WebFetches this session** for THIS strengthen — the live page silences are inherited from the 5 ZI route-module sidecars and from the per-NEW-finding fetches this session (DOC-GAP-303 / 304 / 305).

**No severity / category change**: still HIGH / drift. The cluster's reach is now structural; the fix is the META section + per-page cross-link sweep. Sidecar count grows from 2 (batch ZC — DataQuality + DataQualityContent) to **7** (batch ZI adds activity-route + search-route + directory-route + relationships-route + queryExamples-route). Headline left unchanged per shard.py headline-rewrite rule.
