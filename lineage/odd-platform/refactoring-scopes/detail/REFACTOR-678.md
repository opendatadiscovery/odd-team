## REFACTOR-678 — `activityPath('?already-prefixed')` produces `/activity??already-prefixed` (double `?`); the builder unconditionally prepends `?` to its argument with no guard, breaking deep-link URLs if any future caller passes a pre-prefixed query string

**Severity**: LOW
**Category**: url-builder-input-not-guarded / cosmetic-builder-bug
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-04 Activity]

**Surfaced by**:
- `odd-platform__ts__routes__route__activity.md:bugs_limitations_corner_cases[1]` (LOW) — "`activityPath('?already-prefixed')` produces `/activity??already-prefixed`. The type signature is `query?: string`; nothing prevents the caller from pre-prefixing. `ToolbarTabs.tsx:77` correctly passes the unprefixed `activityQueryString` derived from `useQueryParams(...).defaultQueryString`, but a future caller could regress."
- `odd-platform__ts__routes__route__activity.md:stress_findings.name_behavior_pairs[activityPath]` MINOR drift — "`activityPath` returns the bare base path or the base + query — caller passing `'?key=val'` (mistaken pre-prefix) produces `/activity??key=val` — broken URL; no type-level guard."

**Description**: The `activityPath(query?: string)` builder at `routes/activityRoutes.ts:3-6` returns the bare `/activity` when called without a query argument, OR `/activity?{query}` when called with a query argument. The implementation:

```typescript
const activityPath = (query?: string) => {
  if (query) {
    return `${BASE_PATH}?${query}`;
  }
  return BASE_PATH;
};
```

The function PREPENDS a literal `?` to the caller's input without checking whether the input already starts with `?`. The current single production caller (`ToolbarTabs.tsx:77`) correctly passes the unprefixed query string (`activityQueryString` derived from `useQueryParams(...).defaultQueryString`). A future caller passing a pre-prefixed query (e.g. `activityPath('?type=ALL')` instead of `activityPath('type=ALL')`) would produce the URL `/activity??type=ALL` — double `?` — which browsers may interpret variously (most treat the second `?` as a literal character in the first query key, breaking the query parsing).

**Why this is a builder-side concern**: the type signature `query?: string` does not constrain the input's shape. There is no convention in the codebase about whether builders accept prefixed or unprefixed query strings — `activityPath` is the only builder that takes a query argument at all (per the routes/ directory walk). A future contributor extending the convention would have to guess.

**Operator impact**: today none — the single production caller is correct. The gap is latent; a future caller bug regresses the toolbar deep-link silently (no UI test would catch it). The error manifests as the operator clicking the Activity toolbar tab and landing on a Catalog page that ignores the malformed query string.

**Evidence**:
- `odd-platform-ui/src/routes/activityRoutes.ts:3-6` (the builder implementation)
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:77` (the single current caller — passes unprefixed)
- `odd-platform-ui/src/components/shared/elements/Activity/common.ts:33-41` (defaultActivityQuery — derives the query string)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-228** (routes-as-functions) does not address builder-input validation.
- **ADR-CANDIDATE-230** (query-string view-mode dispatch — NEW this batch) makes the `?` prefix a structural choice; this scope is the latent gap in the builder's input contract.

**Proposed remedy**: Two viable patterns:

**Pattern A — Defensive guard at the builder**:
```typescript
const activityPath = (query?: string) => {
  if (query) {
    const cleaned = query.startsWith('?') ? query.slice(1) : query;
    return `${BASE_PATH}?${cleaned}`;
  }
  return BASE_PATH;
};
```

**Pattern B — Type-level constraint** (TypeScript 4.5+ template-literal types):
```typescript
type UnprefixedQuery = `${Exclude<string, `?${string}`>}`;
const activityPath = (query?: UnprefixedQuery) => {
  // ...
};
```
But this is over-engineering for a one-builder concern. Pattern A is the recommended fix.

**Pattern C — Companion JSDoc** (zero code change):
```typescript
/**
 * @param query - The query string to append, WITHOUT a leading '?'.
 *                The builder prepends '?'; passing a pre-prefixed string
 *                produces a malformed URL with double '?'.
 */
const activityPath = (query?: string) => { /* ... */ };
```

Recommended: Pattern A (defensive guard — one line). Pattern C complements but does not REPLACE the guard.

**Severity rationale**: LOW — latent; current caller correct; the gap is risk-shaped, not currently-broken-shaped. Time-to-fix is minutes. Severity reinforced by zero test coverage.

**Suggested backlog grouping**: `UI architecture codification` (composes with ADR-CANDIDATE-230 — query-string view-mode dispatch).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-230 (query-string dispatch).
- SUPERSEDES: none.
- CONFLICTS: none.
