## ADR-CANDIDATE-231 — In-band string SENTINELS encode "no filter / wildcard / all types" within URL path segments (e.g. `/directory/{prefix}/{dsId}/all`); the sentinel is human-readable, self-documenting, and translated to `undefined` at the route-params-hook boundary so downstream code branches on typed nullability rather than parsing literals — the form is preferred over `*` wildcards, missing query params, or separate routes for the wildcard case

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01 Data Discovery (Directory)] — currently one pillar; the convention is documented for future replication

**Support count**: 1 sidecar (directory) — single-instance load-bearing; this is a UNIQUE-LOAD-BEARING ADR rather than a recurrence-based one

**Surfaced by**:
- `odd-platform__ts__routes__route__directory.md:implicit_adrs[2]` (HIGH) — "**The literal `'all'` is the in-band sentinel for 'no type filter at the entity-list level'.** Choosing a sentinel STRING (rather than e.g. an explicit `?typeId=` query param or an explicit `*` wildcard) is a deliberate convention: the URL `/directory/{prefix}/{dsId}/all` is human-readable and self-describing (the operator types it and understands they're asking for 'all types'), whereas a missing query param or a `*` would obscure intent. The hook recognises the literal and translates it back to `undefined` so downstream code can branch on a typed value. The pattern's case-law: `EntitiesTabs.tsx:26` builds the 'All' tab explicitly via `directoryDataSourcePath(..., 'all')` — confirming the sentinel is a feature, not a workaround."
- `odd-platform__ts__routes__route__directory.md:concepts.invariants[1]` — "**The `'all'` literal is a load-bearing magic string shared across THREE files**: this module's hook coercion (line 34, `typeId === 'all' ? undefined : parseInt(typeId, 10)`), the inner Routes' Navigate fallback (`Directory/DirectoryRoutes.tsx:16`, `<Navigate to='all' replace />`), and `EntitiesTabs.tsx:26`. NO named constant unites them."

**Decision statement**: When a URL path segment is conceptually a filter on a class-list-style endpoint AND the operator may want to view "all classes" (the wildcard case), the convention is to encode the wildcard case as an IN-BAND STRING SENTINEL (the literal `'all'`) rather than:

- A missing query parameter (`/directory/{prefix}/{dsId}?typeId=` — opaque to the operator typing the URL)
- A glob/wildcard segment (`/directory/{prefix}/{dsId}/*` — non-self-documenting; React Router would treat `*` as a path-match catch-all rather than a literal)
- A separate route altogether (`/directory/{prefix}/{dsId}` with no third segment for "all", and `/directory/{prefix}/{dsId}/{typeId}` for the typed case — adds a second `<Route>` declaration)

The chosen form is the literal segment `/directory/{prefix}/{dsId}/all` where:

- The segment is bound by React Router to a typed param `typeId: 'all' | number`.
- The route-params hook (`useDirectoryRouteParams` line 34) recognises the literal `'all'` and TRANSLATES it to `undefined`: `typeId === 'all' ? undefined : parseInt(typeId, 10)`.
- Downstream code branches on TYPED NULLABILITY (`if (!typeId) showAllTypesView()`), never on the literal string.
- The path-builder accepts the literal explicitly: `directoryDataSourcePath(prefix, dsId, 'all')` is a normal call (per `EntitiesTabs.tsx:26`), and the type system enforces the argument: `typeId?: number | 'all'`.

The sentinel is SHARED ACROSS THREE FILES with NO unifying constant: the hook coercion (`directoryRoutes.ts:34`), the React-Router Navigate redirect (`Directory/DirectoryRoutes.tsx:16` `<Navigate to='all' replace />`), and the explicit-'all' builder caller (`EntitiesTabs.tsx:26`). The duplication is a known gap (REFACTOR-{new this batch} surfaces it) but the convention IS architecturally sound — the gap is in the absence of a named constant, not in the use of an in-band sentinel.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the type annotation `typeId?: number | 'all'` on `directoryDataSourcePath` makes the literal first-class. The hook's recognition pattern is explicit. The Navigate redirect TARGET is the literal. Three files coordinate around the same literal. The choice is deliberate.
2. *Structural impact?* YES — defines the URL shape for an entire pillar (Directory's level-3 URL). Changing the sentinel form (e.g. dropping it in favour of separate routes) would require updating the URL pattern, the route declarations, the hook, the builders, the consumers — multi-file refactor.
3. *Refactoring or structural?* STRUCTURAL — the convention encodes "the operator can READ the URL and understand what they're asking for". Switching to query-params or wildcards loses that operator-facing readability.
→ ADR.

**Evidence**:
- `directoryRoutes.ts:34` (hook recognition: `typeId === 'all' ? undefined : parseInt(typeId, 10)`)
- `directoryRoutes.ts:47` (type annotation: `typeId?: number | 'all'`)
- `Directory/DirectoryRoutes.tsx:15-17` (Navigate fallback: `<Route path=':dataSourceTypePrefix/:dataSourceId' element={<Navigate to='all' replace />} />`)
- `EntitiesTabs.tsx:26` (explicit-'all' caller: `directoryDataSourcePath(prefix, dsId, 'all')`)
- `TableHeader.tsx:22` (downstream branch: `if (!typeId) cells.splice(...)`)
- live doc page `https://docs.opendatadiscovery.org/features/data-discovery/directory` (2026-05-26 status 200) — explicitly documents `Level 3 — Entity types within selected data source: /directory/{type-prefix}/{data-source-id}/all` — the literal is part of the public URL contract.
- intent_anchor: the type annotation at line 47 makes `'all'` a first-class accepted argument shape.

**Why this is UNIQUE-LOAD-BEARING despite single-sidecar surfacing**: the convention is currently used at ONE pillar (Directory's level-3 URL), but the architectural choice is observable across multiple files within that pillar (hook + Navigate + builder + type annotation) AND the live public doc page documents the literal `'all'` segment verbatim as part of the URL contract. The convention's PRINCIPLE is recurrence-worthy — every future multi-class list surface with a "show all classes" affordance will face the same design choice. Codifying it now means future pillars (e.g. a Filter-by-Type screen for Lookup Tables or a Filter-by-Topic screen for Alerts) inherit the convention.

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-228** (routes-as-functions) — the convention is implemented at the path-builder + route-params-hook boundary, which is exactly the pair this convention codifies.
- COMPOSES WITH **ADR-CANDIDATE-230** (view-mode dispatch — query-string vs path-segment) — this ADR governs the SENTINEL-segment subcase within path-segment-style view modes (when one of the "modes" is "everything").
- COMPOSES WITH **ADR-CANDIDATE-227** (bare-base redirect to canonical first tab) — the Navigate-to-'all' redirect at level 3 is the same redirect-shape used by ADR-227 for level 1; the redirect target is the sentinel value.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-{new this batch} — the `'all'` literal is shared across 3 files with no unifying constant (low-severity duplication gap that the convention's architectural soundness does NOT defend against — the convention is good; the lack of a named constant is the implementation gap).
- REFACTOR-289 (existing) — zero unit tests; the cross-file coordination of the sentinel is the highest-leverage test target (a one-line `expect('all').toBe(DIRECTORY_ALL_TYPES_SENTINEL)` test would catch the drift class).

**Proposed action**: Promote to `adrs/drafts/in-band-string-sentinels-for-url-wildcards.md`. Document:
- The convention's three parts (URL accepts literal; hook translates to `undefined`; downstream branches on typed nullability).
- The contrast with query-params / wildcards / separate routes.
- The current usage (Directory level-3).
- The maintenance obligation: when a future pillar adds a "show all classes" affordance, use the same sentinel pattern; export a NAMED CONSTANT for the sentinel value so the three coordinating files reference one symbol instead of three duplicated literals (closes REFACTOR-{this batch}).
- The migration consequence: dropping the convention requires updating every URL-shape contract; doing so loses operator-facing URL readability.

**Severity rationale**: MEDIUM — pattern-shaping convention; one current instance but architecturally sound and codification-worthy; the live doc page makes the literal part of the public contract.

**Suggested backlog grouping**: `UI architecture codification`.
