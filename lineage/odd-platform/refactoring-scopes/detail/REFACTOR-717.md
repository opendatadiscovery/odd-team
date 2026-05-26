## REFACTOR-717 — Search pageSize=30 is HARDCODED in TWO places: Search.tsx:39 (session-create initial pageSize) + Results.tsx:45 (infinite-scroll page increment) — both literal `30`, not an imported constant. Maintainer altering one without the other ships pagination-misalignment regressions. The Search.tsx:39 value is FUNCTIONALLY DEAD (Results.tsx controls actual pagination)

**Severity**: LOW
**Category**: hardcoded-twin-literals / dead-tunable
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog)]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Search.md:implicit_adrs[4]` (MEDIUM) — "**`pageSize: 30` hardcoded in TWO places — orchestrator + results child — by deliberate parity, not a constant.** Line 39 (session-create initial pageSize) + Results.tsx:45 (infinite-scroll page increment). Both are literal `30`, not an imported constant. Same maintenance burden as TermSearch batch-U implicit_adrs[4]: future refactor changing one without the other ships pagination-misalignment regressions."
- `odd-platform__ts__react-component__component__Search.md:stress_findings.request_inputs[5]` (HIGH) — "**pageSize**: TRANSLATES_SILENTLY — the name promises a controllable page size; the implementation accepts it at session-create but uses a different hardcoded constant for actual result pagination. Operator-invisible (because both happen to be 30), but a maintainer altering Search.tsx:39 from 30 to 50 will see no change unless they ALSO update Results.tsx:45. The drift is silent." — drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
- `odd-platform__ts__react-component__component__Search.md:stress_findings.tunables[0]` (HIGH) — "What at pageSize=31 or higher? The session-create payload carries the larger value; Results.tsx ignores it and uses its own 30. Session-state pageSize is functionally dead for result loading."

**Statement**: Two literal `30` values in the Catalog Search surface:

1. **Search.tsx:39** — `createSearch({ query: '', pageSize: 30, filters: {} })` — fed into `POST /api/search` as the initial session payload. The backend persists the value into `search_facets.pageSize` (if such a column exists per the schema) but does NOT use it for result-fetch pagination — result-fetch is a separate endpoint (`GET /api/search/{id}/results`) which takes `page` + `size` query parameters.

2. **Results.tsx:45** — `const size = 30;` — used by the infinite-scroll thunk `fetchDataEntitySearchResults({ searchId, page, size })`. THIS is the value that actually drives pagination.

The two are NEVER LINKED. They're two independent literal `30`s in two separate files. A maintainer altering Search.tsx:39 to 50 (intending "larger initial result page") would see NO BEHAVIOUR CHANGE because Results.tsx:45 still controls the actual pagination.

Sister surface: TermSearch.tsx (batch U) has the IDENTICAL pair of literal `30`s. The clone-bug pattern.

**Operator-visible impact**:
- Today: zero impact (both happen to be 30; the misalignment is invisible)
- Future: a maintainer attempting to bump pageSize will get confused; the change to Search.tsx:39 will be silent; only changing BOTH literals in lockstep produces the intended effect

**Latent UX failure**:
- If a future PR changes Search.tsx:39 to 50 but misses Results.tsx:45 (still 30) → operator sees first 30 results then 30 more per scroll-page; the initial session's hint of "50 per page" is unhonoured. No correctness bug; just user confusion.
- If the maintainer reverses (changes Results.tsx:45 to 50 but misses Search.tsx:39) → the session-create payload carries 30, the result-fetch loads 50 per page. The session's `pageSize` is functionally dead, so no impact.

**Evidence**:
- `Search.tsx:39` — `pageSize: 30` literal in the session-create payload
- `Results.tsx:45` — `const size = 30;` literal in the result-fetch dispatch
- `dataentitiesSearch.thunks.ts:59-63` — the thunk that consumes `Results.tsx`'s size (NOT the session's pageSize)
- `TermSearch.tsx` (batch U) — IDENTICAL pair of literal `30`s in the sibling file
- contrast: well-architected codebases use a shared constants module (e.g., `const PAGE_SIZE = 30 as const` in `lib/constants.ts`) imported by both consumers

**Existing-ADR-or-implied-prescription**: There's no ADR governing magic-number consolidation. The implicit convention (observable across the codebase) is "magic numbers are local; named constants are for cross-file dependencies." This case is on the borderline — the two literals ARE cross-file dependencies in spirit, but they're not named.

**Proposed remedy**:

```ts
// lib/constants.ts (new)
export const SEARCH_PAGE_SIZE = 30 as const;

// Search.tsx:39
- pageSize: 30,
+ pageSize: SEARCH_PAGE_SIZE,

// Results.tsx:45
- const size = 30;
+ const size = SEARCH_PAGE_SIZE;

// TermSearch.tsx (batch U) — same fix
```

Effort: trivial. Three single-line changes plus one new constant. Verifies parity across Search.tsx + Results.tsx + TermSearch.tsx.

**Severity rationale**: LOW — the defect:
- Has no operator-visible impact today
- Has no security implication
- Has a trivial fix cost
- Pattern is repeated in TermSearch.tsx (clone-bug)

Not zero because:
- The dead-tunable smell at Search.tsx:39 IS a Category F drift (input name 'pageSize' promises a controllable page size; implementation ignores it)
- Future maintenance is harder than necessary
- The clone-bug shape (Search + TermSearch) suggests the team's discipline around magic numbers is lax

**Suggested backlog grouping**: `LSN-NNN code-hygiene sprint` (low-priority cleanup) — pair with REFACTOR-715 + REFACTOR-716 (other Search.tsx defects) and TermSearch batch-U implicit_adrs[4] (the clone). Group as "Search + TermSearch parallel-file fix" since the three defects share the same author/template lineage.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-715 NEW this batch + REFACTOR-716 NEW this batch (sibling Search.tsx defects in the same template-clone lineage); ADR-CANDIDATE-052 (server-side search session — the pageSize field is part of the session payload but functionally dead).
- SUPERSEDES: none.
- CONFLICTS: none.

---
