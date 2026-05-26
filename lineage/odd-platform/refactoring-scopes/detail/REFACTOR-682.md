## REFACTOR-682 — URL-builder asymmetric truthy-check pattern shipping latent foot-guns: `queryExamplesPath(0)` returns the LIST URL (not the details URL for id=0) because of `if (queryExampleId)`; `directoryDataSourcePath(prefix, dsId)` silently drops the dsId because of `if (dataSourceId && typeId)` — both shapes assume Postgres bigserial conventions but the type system does not enforce them

**Severity**: LOW
**Category**: builder-falsy-guard-vs-undefined-check / latent-foot-gun
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery, P-02 Data Modelling]

**Surfaced by**:
- `odd-platform__ts__routes__route__queryExamples.md:bugs_limitations_corner_cases[0]` (LOW) — "**The truthy-id guard at line 31 silently routes id=0 to the LIST URL**: `queryExamplesPath(0)` returns `/data-modelling/query-examples`, NOT `/data-modelling/query-examples/0`. This is consistent with JavaScript's `if (numericVar)` idiom but indistinguishable from `queryExamplesPath()` (no-arg) and `queryExamplesPath(undefined)`. Postgres bigserial currently never produces id=0 so the case is theoretical, but: (a) a backend renumbering script that resets the sequence could produce id=0 silently; (b) a future migration that uses signed ints could produce id=0 from a counter underflow; (c) a unit test that uses `0` as a sentinel-id would be silently miscompiled to the list URL. Better idiom: `if (queryExampleId !== undefined)` or `if (queryExampleId != null)`."
- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases[4]` (LOW) — "**`directoryDataSourcePath(prefix)` (single-arg call) and `directoryDataSourcePath(prefix, dsId)` (two-arg call) both fall into the same level-2 branch.** The truthy-check at line 48 is `if (dataSourceId && typeId)` — so calling `directoryDataSourcePath(prefix, 5)` (with valid dsId but no typeId) silently returns the level-2 URL `/directory/{prefix}`, dropping the dsId entirely. The behaviour is correct (there is no addressable level-3 URL to build directly; only Navigate-redirect or explicit `'all'`), but the silent drop is surprising for callers."

**Description**: Two URL builders in the routes directory share the same anti-pattern: a `if (variable)` truthy-check that produces a different URL output for the falsy case. The current implementations assume Postgres bigserial conventions (ids start at 1; ids are always positive) and that no caller passes a falsy id by mistake. Both assumptions hold today; both have failure modes if the assumptions ever break.

**Instance 1: `queryExamplesPath`** (`routes/dataModelling/queryExamplesRoutes.ts:29-38`):

```typescript
export const queryExamplesPath = (queryExampleId?: QueryExample['id']) => {
  if (queryExampleId) {  // ← TRUTHY check
    return generatePath(`${path}/:queryExampleId`, { queryExampleId: String(queryExampleId) });
  }
  return path;
};
```

`queryExamplesPath(0)` returns `/data-modelling/query-examples` (LIST URL) instead of `/data-modelling/query-examples/0`. Postgres bigserial starts at 1, so id=0 is not currently produced. Latent: a renumbering script, signed-int counter, or test fixture using `0` would silently route to LIST.

**Instance 2: `directoryDataSourcePath`** (`routes/directoryRoutes.ts:43-62`):

```typescript
export const directoryDataSourcePath = (
  dataSourcePrefix: DataSourceType['prefix'],
  dataSourceId?: DataSource['id'],
  typeId?: number | 'all'
) => {
  if (dataSourceId && typeId) {  // ← BOTH-TRUTHY check
    return generatePath(/* level-4 */);
  }
  return generatePath(/* level-2 — drops dsId */);
};
```

`directoryDataSourcePath(prefix)` returns level-2 — correct. `directoryDataSourcePath(prefix, dsId, typeId)` returns level-4 — correct. BUT `directoryDataSourcePath(prefix, dsId)` (two-arg) ALSO returns level-2 — silently drops `dsId`. Today no caller passes the two-arg shape (Grep confirms), but a future caller assuming "passing more args = building deeper URL" silently misnavigates.

**Why both shapes are LOW severity**:
- Postgres bigserial convention holds: id=0 never produced.
- Current callers all use the supported call shapes.
- The architectural decisions (ADR-CANDIDATE-231 — directory uses sentinel `'all'` so no two-arg call is needed; ADR-CANDIDATE-232 — transient URLs go via Navigate, not builder) make the gaps theoretical-not-actual.

**Why both shapes ARE worth fixing**:
- The TYPE SYSTEM doesn't enforce the shape. `queryExampleId?: number` accepts `0`. `directoryDataSourcePath(prefix, dsId)` is type-valid.
- A future caller assuming JavaScript semantics ("falsy means absent") regresses silently.
- The fix is a one-line change per builder.

**Evidence**:
- `odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:29-38`
- `odd-platform-ui/src/routes/directoryRoutes.ts:43-62`
- Grep confirms no caller passes the failure-mode shapes today.

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-228** (routes-as-functions convention) does not address builder-input validation.
- **ADR-CANDIDATE-231 NEW + ADR-CANDIDATE-232 NEW** (sentinels + transient redirects) make the directory's two-arg case architecturally-correct-not-to-build (level-3 is reached via Navigate redirect or sentinel-explicit builder call), so the directory fix is "make the silent drop explicit" rather than "actually build level-3".

**Proposed remedy**: Two-builder one-line fixes:

**Fix 1 — `queryExamplesPath`**:
```typescript
export const queryExamplesPath = (queryExampleId?: QueryExample['id']) => {
  if (queryExampleId !== undefined) {  // ← UNDEFINED check, not TRUTHY
    return generatePath(`${path}/:queryExampleId`, { queryExampleId: String(queryExampleId) });
  }
  return path;
};
```
Now `queryExamplesPath(0)` returns `/data-modelling/query-examples/0` (the details URL); `queryExamplesPath()` and `queryExamplesPath(undefined)` return LIST URL.

**Fix 2 — `directoryDataSourcePath`** (the architecture-aware approach):
Option A — strict signature with discriminated union:
```typescript
type DirectoryDataSourcePathArgs =
  | [prefix: DataSourceType['prefix']]
  | [prefix: DataSourceType['prefix'], dataSourceId: DataSource['id'], typeId: number | 'all'];

export const directoryDataSourcePath = (...args: DirectoryDataSourcePathArgs) => {
  // ...
};
```
Now the two-arg call shape is a TypeScript compile error — the caller must either pass one arg (level-2) or three args (level-4).

Option B — runtime throw:
```typescript
export const directoryDataSourcePath = (
  dataSourcePrefix: DataSourceType['prefix'],
  dataSourceId?: DataSource['id'],
  typeId?: number | 'all'
) => {
  if (dataSourceId !== undefined && typeId === undefined) {
    throw new Error('directoryDataSourcePath called with dataSourceId but no typeId — level-3 URLs are produced via React Router Navigate, not directly. Pass typeId=\\'all\\' to build the level-3 sentinel URL.');
  }
  // ... existing branches
};
```

Recommended: Option A (compile-time enforcement). It's the architecturally-aligned fix — the type system makes the level-3 case unbuildable, mirroring ADR-CANDIDATE-232.

**Severity rationale**: LOW — latent foot-guns; current code is correctly aligned with current call sites; the gaps are risk-shaped, not currently-broken-shaped. Time-to-fix is minutes per builder. Severity reinforced by zero test coverage (REFACTOR-289).

**Suggested backlog grouping**: `UI architecture codification` (composes with ADR-CANDIDATE-228, ADR-CANDIDATE-231, ADR-CANDIDATE-232 promotions).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-228 (routes-as-functions); ADR-CANDIDATE-232 (transient URLs).
- SUPERSEDES: none.
- CONFLICTS: none.
