## REFACTOR-677 — Directory pillar's `'all'` sentinel for "no type filter" is a load-bearing magic string duplicated across THREE files (hook coercion, React-Router Navigate target, EntitiesTabs builder caller) with NO unifying constant — renaming the sentinel in one site silently desynchronises navigation; `:dataSourceTypePrefix`, `:dataSourceId`, `:typeId` path-param names ALSO re-hardcoded between routes module + inner Routes file

**Severity**: LOW
**Category**: load-bearing-magic-string-cross-file-duplication / cross-file-coupling-without-shared-constant
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Directory)]

**Surfaced by**:
- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases[2]` (LOW) — "**The literal `'all'` is a load-bearing magic string shared across THREE files with no named constant uniting them.** Renaming `'all'` to e.g. `'any'` in one location without the others silently desynchronises: (a) the hook's `typeId === 'all'` check (line 34) would no longer translate to `undefined`, so `TableHeader.tsx:22` would NOT render the Type column even on the 'All' tab; (b) the Navigate target (`DirectoryRoutes.tsx:16`) would either remain `'all'` (causing a redirect to the new sentinel only if Navigate changes) or be updated independently; (c) the EntitiesTabs builder call (`EntitiesTabs.tsx:26`) would build URLs with the new sentinel but the hook wouldn't recognise it. A single exported `DIRECTORY_ALL_TYPES_SENTINEL = 'all'` constant from this module would close the gap."
- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases[3]` (LOW) — "**The inner `DirectoryRoutes.tsx:11-17` RE-HARDCODES the path-param names `:dataSourceTypePrefix`, `:dataSourceId`, `:typeId` instead of importing the constants from this module.** This module declares `DATA_SOURCE_TYPE_PREFIX_PARAM = ':dataSourceTypePrefix'` (line 10), `DATA_SOURCE_ID_PARAM = ':dataSourceId'` (line 12), `TYPE_ID_PARAM = ':typeId'` (line 14) — but the inner `<Routes>` declarations at `DirectoryRoutes.tsx:12,13,15` literally repeat the same strings. Renaming any of the three constants in this module without updating the inner subtree silently breaks the URL match (the substitution would emit the new param name but the React Router pattern would still match the OLD one)."

**Description**: The Directory pillar's URL architecture is architecturally sound (per ADR-CANDIDATE-231 — in-band sentinels; ADR-CANDIDATE-232 — transient-URL redirects) but the IMPLEMENTATION of the architecture has TWO related cross-file string-duplication gaps:

**Gap A — The `'all'` sentinel is duplicated across 3 files**:

| File | Line | Use |
|---|---|---|
| `routes/directoryRoutes.ts` | 34 | Hook coercion: `typeId === 'all' ? undefined : parseInt(typeId, 10)` |
| `components/Directory/DirectoryRoutes.tsx` | 16 | Navigate target: `<Navigate to='all' replace />` |
| `components/Directory/Entities/EntitiesTabs.tsx` | 26 | Builder caller: `directoryDataSourcePath(prefix, dsId, 'all')` |
| `routes/directoryRoutes.ts` | 47 | Type annotation: `typeId?: number \| 'all'` (NOT exactly duplicated — it's the type signature, but the literal value is repeated) |

Renaming `'all'` to (e.g.) `'any'` in one site without the others silently breaks navigation: the hook no longer recognises the sentinel; the Navigate target doesn't match what the builder builds; the type annotation contradicts the implementation. The three sites coordinate around a shared semantic but there is no shared SYMBOL.

**Gap B — The `:param` names are duplicated between routes module and inner Routes**:

| File | Line | Declaration |
|---|---|---|
| `routes/directoryRoutes.ts` | 10 | `const DATA_SOURCE_TYPE_PREFIX_PARAM = ':dataSourceTypePrefix';` |
| `routes/directoryRoutes.ts` | 12 | `const DATA_SOURCE_ID_PARAM = ':dataSourceId';` |
| `routes/directoryRoutes.ts` | 14 | `const TYPE_ID_PARAM = ':typeId';` |
| `components/Directory/DirectoryRoutes.tsx` | 12 | `<Route path=':dataSourceTypePrefix'>` |
| `components/Directory/DirectoryRoutes.tsx` | 13 | `<Route path=':dataSourceTypePrefix/:dataSourceId'>` |
| `components/Directory/DirectoryRoutes.tsx` | 15 | `<Route path=':dataSourceTypePrefix/:dataSourceId/:typeId'>` |

The constants exist in the routes module but are not consumed by the inner Routes declaration file — the inner file literally repeats the same strings. A typo (e.g. `:dataSourcetypePrefix` lowercase 't') in one file would silently break URL match: the path-builder would emit the new name but React Router would still match the OLD pattern, so the path-builder's output wouldn't route anywhere.

**Operator impact**: today none — the duplicated strings are correctly in sync at commit 4ec2b20. The gap is latent — a future refactor that renames the sentinel or a `:param` constant without grepping for the literal silently breaks the Directory navigation. The breakage would manifest as:
- "All" tab silently shows blank (because hook stopped recognising `'all'`).
- Operator-typed level-3 URLs (`/directory/postgresql/1`) fail to redirect (because Navigate target is mismatched).
- Or React Router fails to match the inner Routes (because `:param` names drifted between files).

The directory-wide test gap (REFACTOR-289 — no UI tests under `routes/`) means none of these regressions would be caught by CI.

**Evidence**:
- `odd-platform-ui/src/routes/directoryRoutes.ts:10-15, 34, 47` (the constants + hook + type annotation)
- `odd-platform-ui/src/components/Directory/DirectoryRoutes.tsx:11-17` (re-hardcoded path patterns + the `'all'` Navigate target)
- `odd-platform-ui/src/components/Directory/Entities/EntitiesTabs.tsx:26` (explicit-'all' builder caller)
- `odd-platform-ui/src/components/Directory/Entities/EntitiesList/TableHeader/TableHeader.tsx:22` (downstream branch `if (!typeId) cells.splice(...)`)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-231 NEW** codifies the sentinel-as-URL-segment convention; the convention is sound. This scope is the IMPLEMENTATION gap (lack of shared constant) that the convention does NOT enforce.
- **ADR-CANDIDATE-232 NEW** codifies the transient-URL-via-Navigate pattern; the Navigate target IS this scope's sentinel value.
- **ADR-CANDIDATE-228** (routes-as-functions convention) does NOT mandate that `:param` names be re-imported into inner Routes files; the cross-file string-duplication is a known consequence of the convention's split between path-builder module and route-declaration module.

**Proposed remedy**: Two-part minimal refactor:

**Part 1 — Export the sentinel constant**:

```typescript
// In routes/directoryRoutes.ts:
export const DIRECTORY_ALL_TYPES_SENTINEL = 'all' as const;

// hook coercion (line 34) becomes:
typeId === DIRECTORY_ALL_TYPES_SENTINEL ? undefined : parseInt(typeId, 10)

// type annotation (line 47) becomes:
typeId?: number | typeof DIRECTORY_ALL_TYPES_SENTINEL

// builder signature accepts the constant or a number.
```

```typescript
// In components/Directory/DirectoryRoutes.tsx:
import { DIRECTORY_ALL_TYPES_SENTINEL } from 'routes';
// ...
<Route path=':dataSourceTypePrefix/:dataSourceId' element={<Navigate to={DIRECTORY_ALL_TYPES_SENTINEL} replace />} />
```

```typescript
// In components/Directory/Entities/EntitiesTabs.tsx:
import { DIRECTORY_ALL_TYPES_SENTINEL, directoryDataSourcePath } from 'routes';
// ...
{ name: t('All'), link: directoryDataSourcePath(prefix, dsId, DIRECTORY_ALL_TYPES_SENTINEL) }
```

**Part 2 — Import the `:param` constants into the inner Routes file** (or rely on TypeScript template-literal types):

```typescript
// In components/Directory/DirectoryRoutes.tsx:
import { DATA_SOURCE_TYPE_PREFIX_PARAM, DATA_SOURCE_ID_PARAM, TYPE_ID_PARAM } from 'routes';
// ...
<Route path={`${DATA_SOURCE_TYPE_PREFIX_PARAM}/${DATA_SOURCE_ID_PARAM}`} ...>
<Route path={`${DATA_SOURCE_TYPE_PREFIX_PARAM}/${DATA_SOURCE_ID_PARAM}/${TYPE_ID_PARAM}`} ...>
```

But this requires the constants to be exported from `routes/directoryRoutes.ts` (currently file-private — see ADR-CANDIDATE-228 file-private convention). The choice between (a) exporting the constants (breaking the file-private convention for this pillar) and (b) accepting the duplication is the maintainer's call.

**Recommended**: Part 1 only (export the sentinel). Part 2 is over-investment because the path-param names rarely change; the duplication is small and stable. The sentinel duplication is the higher-risk gap because the `'all'` literal is a SEMANTIC choice that someone might want to rename to better English (`'every'`, `'any'`, `'wildcard'`) — making it a named constant immunises the codebase from desync.

Companion test: a one-line unit test asserting `expect(DIRECTORY_ALL_TYPES_SENTINEL).toBe('all')` would pin the constant against accidental change. Composed with REFACTOR-289 (UI test bootstrap).

**Severity rationale**: LOW — latent; current code is correctly in sync; the gap is risk-shaped, not currently-broken-shaped. Severity reinforced by zero test coverage (the directory-wide gap REFACTOR-289 means a future regression would ship unnoticed).

**Suggested backlog grouping**: `UI architecture codification` (composes with ADR-CANDIDATE-231 promotion).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-231 (in-band-sentinel architecture); ADR-CANDIDATE-232 (transient-URL-redirect — the Navigate target IS the sentinel); REFACTOR-289 (test gap).
- SUPERSEDES: none.
- CONFLICTS: none.
