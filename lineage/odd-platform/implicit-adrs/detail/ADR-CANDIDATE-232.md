## ADR-CANDIDATE-232 — Intermediate-level URLs that are CONCEPTUALLY TRANSIENT are produced via React-Router `<Navigate to=... replace />` REDIRECTS, NOT via URL-builder functions; the URL builder represents "addressable, user-reachable states" while the React-Router declaration represents "URL patterns to MATCH and bounce" — the asymmetry is intentional and keeps the addressable URL surface small

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01 Data Discovery (Directory), P-02 Data Modelling, P-04 Activity, others] — multi-tab pillars + multi-level browse pillars

**Support count**: 2 sidecars (directory + composes with ADR-CANDIDATE-227 from batch ZH which surfaced the same shape at level-1 redirect)

**Surfaced by**:
- `odd-platform__ts__routes__route__directory.md:implicit_adrs[3]` (HIGH) — "**Level-3 URLs are produced via React-Router redirect (`<Navigate to='all' replace />`), not via the URL builder.** The builder `directoryDataSourcePath` has only TWO output branches (level-2 bare prefix at lines 59-61; level-4 full path at lines 48-57). The level-3 surface `/directory/{prefix}/{dsId}/all` is built ONLY via the inner subtree's `<Route path=':dataSourceTypePrefix/:dataSourceId' element={<Navigate to='all' replace />} />` (`DirectoryRoutes.tsx:15-17`) when a user clicks a data-source row from level 2 OR via the EntitiesTabs explicit-'all' call. The choice is: the builder represents 'addressable, user-reachable states'; the level-3 URL is fundamentally a transient redirect target. An operator typing `/directory/postgresql/1` in the browser is bounced; no app code WANTS to build that URL — only the React Router declaration wants to MATCH it."
- Composes with **ADR-CANDIDATE-227** (batch ZH) — "Bare base URL of every multi-tab pillar redirects to its canonical first tab via `<Navigate>`; the bare path is NEVER a chooser screen and NEVER a renderable view — operator following the global nav lands at the canonical first surface."
- `odd-platform__ts__routes__route__directory.md:concepts.invariants[3]` — "**`directoryDataSourcePath` has only TWO output branches** (level-2 bare-prefix OR level-4 full path) despite the URL space having FOUR distinct shapes (level-1 `/directory`, level-2 `/directory/{prefix}`, level-3 `/directory/{prefix}/{dsId}/all`, level-4 `/directory/{prefix}/{dsId}/{typeId}`). Level-1 has its own builder (`directoryPath()`); level-3 is NEVER built directly — it is either redirected-to by the React-Router fallback at `DirectoryRoutes.tsx:15-17` OR built indirectly by passing the string `'all'` to `directoryDataSourcePath` from `EntitiesTabs.tsx:26`."

**Decision statement**: The odd-platform-ui SPA distinguishes between TWO classes of URL within a single pillar:

**Class 1 — Addressable URLs** (have a path-builder function):
- The URL is a destination an operator might bookmark, share, deep-link to, OR is a navigation target the application code WANTS to navigate to.
- Built via a path-builder function: `directoryPath()`, `directoryDataSourcePath(prefix)`, `directoryDataSourcePath(prefix, dsId, typeId)`.
- React Router MATCHES the URL pattern AND RENDERS a component there.

**Class 2 — Transient redirect URLs** (NO path-builder; only Navigate target):
- The URL is conceptually a way-station — an operator types it OR an external link lands there, but no app code wants to navigate to it.
- NOT built by any path-builder; the URL is produced ONLY by `<Navigate to=...>` redirects.
- React Router MATCHES the URL pattern AND `<Navigate replace>`s to the addressable form (the `replace` prop is the explicit semantic "this URL should not appear in browser history").

**Two canonical instances**:

1. **Pillar bare-base URL** (codified by ADR-227 in batch ZH) — `/data-modelling` redirects to `/data-modelling/query-examples`. The bare URL is matched and bounced; no code wants to be at `/data-modelling`. The redirect target IS the addressable URL.

2. **Directory level-3 URL** (codified by this ADR in batch ZI) — `/directory/{prefix}/{dsId}` (no type segment) redirects to `/directory/{prefix}/{dsId}/all` (with the sentinel segment from ADR-CANDIDATE-231). The bare data-source URL is matched and bounced; no code wants to be at `/directory/{prefix}/{dsId}` without the type-filter clause. The redirect target IS the addressable URL.

The decision is that the path-builder's output set is the SMALLEST set of URLs that fully spans the user-reachable state. Transient URLs (the "anchor without anchor-position" cases — bare base, partial-tuple) are MATCHED-AND-BOUNCED via React Router declarations + Navigate, not produced by code. The asymmetry means:

- A grep over `directoryPath` / `directoryDataSourcePath` in the codebase enumerates all the URLs the application code can produce — none of them are transient.
- The transient URLs are exposed in the React Router declarations file (`DirectoryRoutes.tsx`) — operators looking up "what URLs does the SPA accept" find the full matching set, including the bounced ones, in one file.
- The `<Navigate replace />` prop on the bounce means the transient URL doesn't pollute browser history.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the `replace` prop on the Navigate (`Directory/DirectoryRoutes.tsx:16`) is the explicit semantic "this URL is not a history entry". The path-builder's intentional omission of the level-3 case (only two branches: level-2 and level-4) confirms the architectural commitment. The level-1 + level-3 redirect cases share the same pattern.
2. *Structural impact?* YES — defines the URL-shape contract per pillar; defines what URLs the application code CAN build; defines what URLs the browser back-button can return to.
3. *Refactoring or structural?* STRUCTURAL — adding the level-3 URL to the path-builder would change the URL-shape contract (an app would WANT to navigate to a state that "needs to redirect" — that's an architectural confusion). Removing the React Router Navigate would leave the level-3 URL un-matched, breaking operator-typed URLs.
→ ADR.

**Evidence**:
- `directoryRoutes.ts:48-62` (only two output branches in `directoryDataSourcePath`)
- `Directory/DirectoryRoutes.tsx:14-17` (`<Route path=':dataSourceTypePrefix/:dataSourceId' element={<Navigate to='all' replace />} />`)
- `EntitiesTabs.tsx:26` (explicit-'all' caller — the level-4 URL form with the sentinel is BUILT, not the level-3 URL form without the segment)
- ADR-CANDIDATE-227 (the same pattern at level 1 — bare-base redirect)
- intent_anchor: the `replace` prop on the Navigate element is the structural signal — the redirect leaves no history entry

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-227** (bare-base redirect to canonical first tab) — this ADR generalises ADR-227 from the pillar-base case to ALL transient intermediate URLs.
- COMPOSES WITH **ADR-CANDIDATE-228** (routes-as-functions) — the path-builder's SMALL surface area (only addressable URLs) is the convention's natural consequence.
- COMPOSES WITH **ADR-CANDIDATE-231** (in-band string sentinels) — the Navigate redirect TARGET in directory's case is the sentinel URL form; the sentinel ADR + this ADR + ADR-227 + ADR-228 together form the Directory pillar's URL architecture.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-{new this batch} — `directoryDataSourcePath(prefix, dsId)` (two-arg call) falls into the level-2 branch and silently drops the dsId; the architectural choice is correct (level-3 should not be directly built) but the truthy-check `if (dataSourceId && typeId)` is a surprising shape — callers may assume the function accepts a partial tuple and silently misnavigate. Pattern: the convention should be ENFORCED at the type system (signature should reject the two-arg shape) rather than at runtime (silently dropping the arg).

**Proposed action**: Promote to `adrs/drafts/transient-url-redirect-vs-addressable-url-builder.md`. Document:
- The two URL classes (Addressable vs Transient).
- The two canonical instances (pillar bare-base, partial-tuple intermediate).
- The Navigate-replace semantic.
- The maintenance obligation: every transient URL is declared in the React Router declarations file, not in the path-builder; every new path-builder represents an addressable URL, not a redirect target.
- The type-system enforcement obligation: builder signatures should reject the partial-tuple call shape rather than silently route to a different URL (the REFACTOR-{this batch} gap).
- The migration consequence: collapsing the asymmetry (e.g. adding builders for transient URLs) requires re-grepping every navigation site to confirm no code is currently relying on the absence of those builders.

**Severity rationale**: MEDIUM — pattern-shaping convention; two canonical instances; codification-worthy because the convention is the difference between an operator-typeable URL that "works" (the redirect catches it) versus one that "breaks" (the URL pattern doesn't match anything).

**Suggested backlog grouping**: `UI architecture codification`.
