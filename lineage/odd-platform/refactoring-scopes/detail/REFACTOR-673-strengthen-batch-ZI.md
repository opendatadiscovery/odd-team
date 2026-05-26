## STRENGTHENS — Batch ZI (2026-05-26 — UI Routes 2: 2 MORE route-params hooks share the unguarded-parseInt + type-system-lie anti-pattern)

Batch ZH established the pattern with `useIntegrationRouteParams` + `useTermsRouteParams`. Batch ZI surfaces two more hooks following the same anti-pattern: `useDirectoryRouteParams` and `useQueryExamplesRouteParams`.

**New surfaced_by entries**:

- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases[1]` + `concepts.invariants[2]` (LOW) — "`useDirectoryRouteParams` coerces `dataSourceId` via `parseInt(dataSourceId, 10)` (line 37) with NO `isNaN` guard. A deep-link to `/directory/postgresql/abc/all` produces `dataSourceId: NaN`; six consumers (`DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`) receive `NaN` without guard; `useGetDataSourceEntities({dataSourceId: NaN})` (Entities.tsx:36-41) calls `directoryApi.getDatasourceEntities({dataSourceId: NaN})` — the backend's OpenAPI-validator typically responds 400 with an error body, the UI surfaces an `AppErrorPage` via `Entities.tsx:60-64`. Same shape as the `useTermsRouteParams` NaN-swallowing pattern."

- `odd-platform__ts__routes__route__queryExamples.md:bugs_limitations_corner_cases[1,2]` (MEDIUM, LOW) — "`useQueryExamplesRouteParams` propagates `NaN` silently when the URL segment is non-numeric: line 22's `as QueryExamplesRouteParams` is a type-system LIE — it claims `queryExampleId` is a non-undefined string when the React Router segment may be missing OR may not be numeric. Then line 25's `parseInt(queryExampleId, 10)` returns `NaN` for any non-numeric input (including the case where the hook is called from a route WITHOUT the `:queryExampleId` segment, where `queryExampleId` is actually undefined). The downstream `useGetQueryExampleDetails({ exampleId: NaN })` then fires `GET /api/queryexample/NaN` — the backend returns 400/404, the UI hangs on `AppLoadingPage` (per `QueryExampleDetailsContainer.tsx:97`) until the error response arrives. No graceful fallback." + "`useQueryExamplesRouteParams` is unsafe to call from the LIST route: if a component mounted under `/data-modelling/query-examples` (no `:queryExampleId` segment) calls this hook, `useParams()` returns `{ queryExampleId: undefined }`. The type cast claims `string`, so TypeScript hides the issue; `parseInt(undefined, 10)` returns `NaN`."

**What this strengthening adds**: ZH established the pattern with 2 hooks across 2 pillars (P-06 Data Glossary + P-08 Management). ZI extends to 4 hooks across 4 pillars (adding P-01 Data Discovery / Directory + P-02 Data Modelling / Query Examples). The pattern is **directory-wide**:

| Hook | Pillar | Cast | parseInt? | isNaN guard? | Reuse outside subtree? |
|---|---|---|---|---|---|
| `useTermsRouteParams` (ZH) | P-06 Data Glossary | `as TermsRouteParams` | YES (line 60) | NO | YES — TermSearch.tsx:26 ignores termId, works by accident |
| `useIntegrationRouteParams` (ZH) | P-08 Management | `as IntegrationRouteParams` | NO (string passthrough) | NO | NO (single caller) |
| `useDirectoryRouteParams` (ZI) | P-01 Data Discovery | `as DirectoryRouteParams` | YES (line 37 + line 34) | NO | NO (single subtree); 6 consumer sites |
| `useQueryExamplesRouteParams` (ZI) | P-02 Data Modelling | `as QueryExamplesRouteParams` | YES (line 25) | NO | NO (single caller, correctly mounted) |

The pattern is universal across the routes/ directory's typed-params hooks. ALL FOUR are type-system-lies via `as` casts, and the three that parseInt all skip isNaN. The fix proposed in REFACTOR-673 (Pattern A / B / C) applies symmetrically to all four hooks — the scope expands but the remedy doesn't.

**Cross-pillar bump**: P-01 + P-02 + P-06 + P-08 = 4 pillars share the anti-pattern. Severity stays LOW (current callers are all in safe subtrees; runtime failures gracefully degrade to 400/404); the latent foot-gun is now confirmed as systemic, not per-pillar.

**Triangulation count after ZI**: 4 hooks across 4 pillars (was 2 after batch ZH).

**Severity unchanged**: LOW — the systemic pattern is the same one already triaged. The Pattern A/B/C remedy applies as a single multi-file refactor.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-228 (routes-as-functions convention — the type-system-lie is a convention-side gap the ADR did not address).
- SUPERSEDES: none.
- CONFLICTS: none.

---
