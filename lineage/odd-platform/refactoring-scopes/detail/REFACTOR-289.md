## REFACTOR-289 — ZERO UI test coverage across odd-platform-ui/src; vitest + @testing-library/react + jsdom + @testing-library/user-event + @testing-library/jest-dom are ALL installed dev dependencies, the `package.json` declares `test: vitest` and `test:coverage` scripts, but NO `*.test.tsx` / `*.spec.tsx` files exist anywhere in the SPA tree

**Severity**: HIGH
**Category**: missing-test (codebase-wide)
**Pillars affected**: [P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, P-11] — every UI surface
**Surfaced by**:
- `DataEntityDetails.md:tests_coverage_semantic` (|-
    "**The component has ZERO direct test coverage.** Verified by `Glob odd-platform-ui/**/*.test.*` (no results), `Glob odd-platform-ui/**/*.spec.*` (no results), `Glob odd-platform-ui/**/__tests__/**` (no results)...")
- `fetchDataEntityDetails.md:tests_coverage_semantic` (|-
    "there are ZERO test files in the entire `odd-platform-ui` package — verified by `find <odd-platform-ui-repo>/src -name '*.test.*' -o -name '*.spec.*'` returning zero results")
- `DataEntityDescription.md:tests_coverage_semantic.test_files` (|-
    "None — `find <odd-platform-ui>/src -name '*.test.{ts,tsx}'` returns 0 results AND `find <odd-platform-ui>/src -name '*.spec.{ts,tsx}'` returns 0 results. The `package.json:5-11` declares `test: vitest` and `test:coverage` scripts but there are NO test files anywhere in the UI tree. The `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` dev dependencies (`package.json:97-99`) are installed but unused for component tests.")
- `PopularStrip.md:tests_coverage_semantic` (|-
    "no test file exists for OwnerEntitiesList — verified by `find <odd-platform-repo>/odd-platform-ui/src -name 'OwnerEntitiesList*.test.tsx'` returning no matches ... no test file exists for the popular thunk")
- `LineageGraph.md:tests_coverage_semantic.test_files` (|-
    "none exist in the repo (verified via two Glob queries)")

**Description**: The odd-platform-ui SPA has the FULL Vitest + Testing Library harness installed and configured:
- `vitest@^4.0.17` (`package.json:136`).
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` (`package.json:97-99`).
- `jsdom` (`package.json`).
- `vite-plugin-checker` (TS + ESLint checks during dev).
- `package.json:5-11` declares `"test": "vitest"` and `"test:coverage": "vitest run --coverage"`.

But ZERO test files exist anywhere in `src/`:
- 0 `*.test.tsx` / `*.test.ts` files.
- 0 `*.spec.tsx` / `*.spec.ts` files.
- 0 `__tests__/` directories.
- 0 e2e suites (no Playwright / Cypress directories at the UI repo root either).

Every UI surface — every page component, every Redux slice, every selector, every thunk, every hook, every utility — has ZERO regression coverage. The harness is installed and the scripts are declared, but the tests have never been authored.

Cross-batch consequence: ADR-CANDIDATE-084 (handleResponseAsyncThunk — the project's most-used abstraction), ADR-CANDIDATE-085 (fan-out across three slices), ADR-CANDIDATE-087 (page-component owns fetch), ADR-CANDIDATE-088 (WithPermissions context), ADR-CANDIDATE-089 (partial gating), ADR-CANDIDATE-091 (URL as source of truth), ADR-CANDIDATE-092 (d3-hierarchy tree) — ALL of these architectural commitments have ZERO regression-pinning tests. Every refactor risks silent breakage.

LSN-017 is the canonical case: a 1-line `useEffect` dep-array regression would silently re-double the view_count inflation if a future maintainer adds a `details.*` field back to the dep-array. A trivial Vitest test asserting "exactly 1 fetchDataEntityDetails dispatch per mount" would prevent the regression. The test does not exist.

The XSS surface (REFACTOR-218) is similarly defended only by an empirical probe (P-009); no Vitest test exercises the `<Markdown>` wrapper's rehype-pipeline contract.

**Primary source citations**:
- `odd-platform-ui/package.json:5-11` — test scripts declared
- `odd-platform-ui/package.json:97-99, 136` — testing-library + vitest installed
- Exhaustive Glob across `odd-platform-ui/src` — zero test files
- All 5 batch-J sidecars document the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-084 (handleResponseAsyncThunk) + ADR-CANDIDATE-085-097 (the batch-J UI ADR family) ALL implicitly assume regression-testing of the codified pattern. The absence is a project-wide commitment gap, not a single-feature one.

**Proposed remedy**: Multi-phase bootstrap sprint:
1. **Phase 1 — Test harness validation** — write one trivial smoke test (`describe('vitest', () => it('runs', () => expect(true).toBe(true)))`) to confirm the harness is functional + the coverage report generates.
2. **Phase 2 — Hot-path regression pinning** — add tests for the 10 highest-leverage invariants from batch J:
   - "exactly 1 fetchDataEntityDetails dispatch per mount" (LSN-017 regression pin).
   - "fetchDataEntityDetails.fulfilled writes to dataentities + metadata + owners slices simultaneously" (ADR-CANDIDATE-085 contract).
   - "WithPermissions hides Edit button when permission missing; preserves Markdown content render" (ADR-CANDIDATE-089 partial-gating).
   - "Popular tile click navigates to /dataentities/{id}/overview" (PopularStrip click-target invariant).
   - "Lineage canvas renders diamond as duplicate nodes" (ADR-CANDIDATE-092 pin).
   - "lineage `?d=` URL clamped to [1, 20] before backend dispatch" (REFACTOR-287 fix companion).
   - "Markdown rendering pipeline strips event-handler attributes from raw HTML" (REFACTOR-218 defence-in-depth pin).
   - "[[Namespace:TermName]] regex matches non-empty groups only on UI" (ADR-CANDIDATE-090 contract).
   - "AppErrorPage renders 5xx differently from 4xx" (REFACTOR-279 fix companion).
   - "handleResponseAsyncThunk propagates requestId on action.meta" (REFACTOR-277 fix companion).
3. **Phase 3 — Per-feature test bootstrap** — adopt a "every new PR adds at least one component test" rule to grow coverage organically; sprint-by-sprint backfill of the top 50 components.
4. **Phase 4 — E2E suite** — adopt Playwright for cross-page flow tests (Popular click → entity detail → back; lineage drill-through; description save round-trip).

**Severity rationale**: HIGH — zero coverage for the entire SPA is a load-bearing maintainer-trust gap. Every ADR codified in batch J has zero defence against regression. Every probe-pinned invariant requires re-running the full probe suite to verify; a vitest test would catch regressions in seconds. Cross-pillar (every pillar affected) — severity reinforced.

**Cross-pillar bump**: ALL 11 pillars affected. Severity already HIGH from codebase-wide scope.

**Suggested backlog grouping**: `UI test coverage bootstrap sprint` — the cross-cutting foundational sprint that unblocks every other UI hardening item. Highest-leverage backlog entry.

---
