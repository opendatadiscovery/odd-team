## REFACTOR-673 — Two route-params hooks (`useIntegrationRouteParams` + `useTermsRouteParams`) PROMISE non-undefined typed values via `as` assertions that erase React Router v6's native `Partial<Record<K, string>>` shape; `parseInt(termId, 10)` returns `NaN` silently when called outside a matching route subtree, propagating `NaN` as `number` through downstream code with no guard — type-system lie + foot-gun for future callers

**Severity**: LOW
**Category**: type-system-lie / unguarded-coercion / future-fragility
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-06 Data Glossary, P-08 Management]

**Surfaced by**:
- `management.md:bugs_limitations_corner_cases[2]` (LOW) — "`useIntegrationRouteParams()` (managementRoutes.ts:43-44) performs a type assertion (`as IntegrationRouteParams`) that PROMISES a non-undefined `integrationId` to every caller. If a caller invokes the hook outside a route that has `:integrationId` in its path, `useParams` returns `{}` at runtime and `integrationId` is `undefined`, but the type system reports it as `string`. A consumer that does `const { integrationId } = useIntegrationRouteParams(); fetchIntegration(integrationId);` (no null-check) crashes at runtime with the URL parameter undefined. The single in-repo caller (IntegrationHeader.tsx) is grep-confirmed to be inside an `:integrationId` route, so the assertion holds today — but the assertion is a type-system lie waiting for the next caller."
- `management.md:stress_findings.name_behavior_pairs.[useIntegrationRouteParams]` DRIFT_NAME_VS_BEHAVIOR — "Hook at managementRoutes.ts:43-44 wraps `useParams<keyof IntegrationRouteParams>()` with `as IntegrationRouteParams`. The cast strips the `Partial<>` wrapper that react-router-dom v6's `useParams` returns by default, asserting that `integrationId` is always a defined string. At runtime, if the hook is called outside an `:integrationId` route, `integrationId` is `undefined` despite the type."
- `terms.md:concepts.invariants[2]` — "The `termId` coercion in `useTermsRouteParams` swallows `NaN`. Line 60: `parseInt(termId, 10)`. If the URL path is `/terms/abc/overview`, `termId` from `useParams()` is `'abc'`, `parseInt('abc', 10)` returns `NaN`. Downstream consumers (`TermDetails.tsx:25` then `dispatch(fetchTermDetails({termId: NaN}))` at line 38) get `NaN` and emit a backend request with `termId=NaN`. The hook itself has no guard, no `isNaN` check, no fallback. The backend (`TermController.getTermDetails`) responds 404; the UI surfaces the AppErrorPage at TermDetails.tsx:80-83."
- `terms.md:bugs_limitations_corner_cases[1]` — "`useTermsRouteParams` returns `termId: NaN` when the URL has a non-numeric segment. Line 60: `parseInt(termId, 10)`. URL `/terms/foo/overview` → `termId = 'foo'` → `parseInt('foo', 10) = NaN`. The hook does NOT check `isNaN` and returns `NaN` typed as `Term['id']` (= `number`) — a type-system lie. Downstream `TermDetails.tsx:38` dispatches `fetchTermDetails({termId: NaN})` which serialises to `termId=NaN` in the URL; backend ... returns 404."
- `terms.md:bugs_limitations_corner_cases[5]` — "`useTermsRouteParams` is reused outside the `/terms/:termId/*` subtree — TermSearch.tsx:26 calls it from the `/termsearch/*` subtree. In that subtree React Router does NOT bind `:termId` (the route is `/termsearch/:termSearchId`), so `useParams()` returns `{ termSearchId: ... }` without `termId`. The destructure at termsRoutes.ts:55 produces `termId = undefined`, `parseInt(undefined, 10) = NaN`, and TermSearch.tsx ignores the `termId` field anyway (uses only `termSearchId`). The hook 'works' by accident — its return shape is dishonest in this caller's context. A future consumer of TermSearch.tsx that mistakenly reads `termId` would silently get `NaN`."

**Statement**: Two route-params hooks across two pillars share the same anti-pattern:

**Instance 1: `useIntegrationRouteParams` at `managementRoutes.ts:43-44`**:
```ts
export const useIntegrationRouteParams = () =>
  useParams<keyof IntegrationRouteParams>() as IntegrationRouteParams;
```
The `as IntegrationRouteParams` cast strips React Router v6's `Partial<Record<K, string>>` return shape. `IntegrationRouteParams` declares `integrationId: string`. The cast PROMISES non-undefined string; runtime returns `undefined` if called outside a `:integrationId` route. Single in-repo caller is safe; future callers are silently broken.

**Instance 2: `useTermsRouteParams` at `termsRoutes.ts:54-63`**:
```ts
export const useTermsRouteParams = (): AppTermsRouteParams => {
  const { termId, termSearchId } = useParams<keyof TermsRouteParams>() as TermsRouteParams;
  return {
    termId: parseInt(termId, 10),   // ← unguarded coercion, returns NaN for non-numeric
    termSearchId,
  };
};
```
The `as TermsRouteParams` cast strips the Partial. `parseInt(termId, 10)` returns `NaN` if `termId` is `'abc'` (non-numeric) OR `undefined` (out-of-subtree). `NaN` is then typed as `Term['id']` (= `number`) — a type-system lie. The hook has no `isNaN` check, no fallback, no warning.

The hook is reused outside its intended `/terms/:termId/*` subtree: `TermSearch.tsx:26` calls it from `/termsearch/:termSearchId`. In that context, `termId` is `undefined`, `parseInt(undefined, 10)` returns `NaN`, and TermSearch happens to ignore the `termId` field (uses only `termSearchId`). The hook "works by accident" — the return shape's `termId: NaN` is unused but lies in the type contract.

**Concrete failure modes**:

1. **`/terms/abc/overview` (non-numeric URL segment)** — `useTermsRouteParams` returns `{ termId: NaN, termSearchId: undefined }`. `TermDetails.tsx:38` dispatches `fetchTermDetails({termId: NaN})`. The thunk serialises to `GET /api/terms/NaN`. Backend path-bind fails (or matches no row); 404. UI shows AppErrorPage. Operator sees "Term not found" instead of "Invalid term id". The error message understates the cause.

2. **`useIntegrationRouteParams` called from a sibling route** — `useParams()` returns `{}`. `integrationId` is `undefined`. Downstream `fetchIntegration(integrationId)` either crashes (if it does no null check) or passes `undefined` through to the backend (which 400s). No type-time warning.

3. **`useTermsRouteParams` called from `/termsearch/:termSearchId`** — `termId: NaN, termSearchId: '<uuid>'`. The hook returns dishonest shape for the new context; the current consumer (TermSearch) ignores `termId`, so works-by-accident; future consumer reading `termId` silently breaks.

The architectural intent of the two hooks is reasonable (typed access to route params is good Hygiene); the implementation is the wrong abstraction. The `as` cast is doing the wrong work — it should be either (a) restricting the hook to the right subtree (compile-time check), (b) returning a discriminated union with a "not in route" variant, or (c) returning `Partial<>` and forcing callers to null-check.

**Evidence**:
- `managementRoutes.ts:43-44` (the integration hook)
- `termsRoutes.ts:54-63` (the terms hook)
- `IntegrationHeader.tsx` (current safe caller of integration hook)
- `TermDetails.tsx:25, 38` (consumer of terms hook in the matching subtree)
- `TermSearch.tsx:26` (consumer of terms hook in the WRONG subtree — works by accident)
- React Router v6 `useParams` documentation (returns `Readonly<Partial<Record<ParamKey, string>>>` — the cast strips Partial)
- `terms.md:probes_emitted` (P-164 the bare-/terms probe; not this finding's probe)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-228** (NEW this batch) is the routes-as-functions convention; this scope is the per-pillar route-params hooks NOT being defended by the type system, which the convention does not address.
- No prior ADR addresses route-params hooks' type safety; the implied prescription is one of (a), (b), or (c) from above.

**Proposed remedy**: Three viable patterns, pick one (with a preference for B):

**Pattern A (cheapest, type-narrow)**: Add an `isNaN` / undefined guard at the top of each hook and throw if invariants violated:
```ts
export const useTermsRouteParams = (): AppTermsRouteParams => {
  const { termId, termSearchId } = useParams<keyof TermsRouteParams>();
  if (!termId) throw new Error('useTermsRouteParams called outside /terms/:termId/* subtree');
  const numericTermId = parseInt(termId, 10);
  if (Number.isNaN(numericTermId)) throw new Error(`Invalid termId path segment: ${termId}`);
  return { termId: numericTermId, termSearchId };
};
```
Fail-fast at the hook boundary; downstream callers see a clear stack trace.

**Pattern B (preferred — typed discriminated union)**: Return a union type that forces the caller to disambiguate:
```ts
type TermsRouteParamsResult =
  | { kind: 'term-detail'; termId: number }
  | { kind: 'term-search'; termSearchId: string }
  | { kind: 'no-match' };
```
The caller must `switch` on `result.kind`; the type system enforces the matching subtree.

**Pattern C (minimal — make the cast honest)**: Drop the `as` cast; return `Partial<>` and force callers to null-check:
```ts
export const useTermsRouteParams = (): { termId?: number; termSearchId?: string } => {
  const { termId, termSearchId } = useParams<keyof TermsRouteParams>();
  return {
    termId: termId ? parseInt(termId, 10) : undefined,
    termSearchId,
  };
};
```
Slightly less ergonomic at the call site but type-honest.

The same fix applies to `useIntegrationRouteParams` symmetrically. Pattern B is the most defensive but requires call-site updates. Pattern A is the cheapest; Pattern C is the most idiomatic.

**Severity rationale**: LOW — current callers all happen to be in the right subtree; runtime failures gracefully surface as 404s (operator-misleading but not data-loss). Severity is LOW now; the latent foot-gun for future callers + the type-system-lie audit gap keep this above NOTE-only.

**Suggested backlog grouping**: `UI architecture codification` (composes with ADR-CANDIDATE-228 promotion + REFACTOR-289 test-bootstrap).
