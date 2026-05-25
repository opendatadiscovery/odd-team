## REFACTOR-596 — Dashboard has no error UI; a failed `GET /api/dataqatests/runs` is silently indistinguishable from a genuinely empty catalog (`useGetDataQualityDashboard` destructures only `{ data, isSuccess }`, never `isError` / `error`; `initialData` masks the failure)

**Severity**: MEDIUM
**Category**: error-mapping / no-error-handler
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityContent.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — |-
    "**No error UI — a failed dashboard fetch shows the all-zero `initialData` placeholder, indistinguishable from a genuinely empty catalog.** The component destructures only `{ data, isSuccess }` from `useGetDataQualityDashboard` (`DataQualityContent.tsx:24`) — never `isError` / `error`. On a 4xx/5xx from `GET /api/dataqatests/runs`, react-query keeps `data` at `initialData` (all zeros), `isSuccess` stays false, `testResults` is `[]`, and the operator sees three grey 'No data' donuts with no error message. A real backend failure is presented as 'your catalog has no data quality tests'."
- `odd-platform__ts__react-component__component__DataQuality.md:bugs_limitations_corner_cases.[2]` — confirms from the route-entry side: the parent component does not and cannot compensate; error-state ownership lives in `DataQualityContent`.

**Description**: `DataQualityContent.tsx:24` destructures the react-query hook return as `const { data, isSuccess } = useGetDataQualityDashboard(filterState);`. The hook (`dataQuality.ts:74-82`) is configured with `initialData` (all-zero `DataQualityResults` with six named categories), so `data` is NEVER undefined — react-query holds the `initialData` until a successful fetch arrives. On any backend error (4xx, 5xx, network drop, timeout, CORS):

- `isSuccess` stays `false`.
- `data` stays at `initialData` (all-zero counts).
- `error` and `isError` are AVAILABLE on the react-query hook return but are NEVER destructured here.
- All five memoised derivations (`calcTestResultsBreakdown` / `testResultsBreakdownChartData` / `tableHealthData` / `tableMonitoredTables` / `testResults` after `toSorted`) yield empty / all-zero values.
- The render path: three donuts render `'No data'` slices (via `DonutChart`'s zero-total path), legends show all six statuses with zero counts, zero category panels render (because `testResults` is `[]`).

The operator's screen on a backend failure is INDISTINGUISHABLE from the operator's screen on a fresh install with no DQ tests ingested. There is no error toast, no error banner, no retry affordance, no HTTP-status hint. A data-quality engineer staring at three grey donuts on a production dashboard cannot tell whether (a) the platform has no DQ tests, (b) their filter slice happens to match nothing, (c) the backend is throwing 500s, (d) their auth session expired and the API is returning 401, (e) a network blip dropped the fetch. All five present identically.

**Wisdom-test classification**: GAP. (1) Intentional? NO — no comment defends "show initialData on failure"; the absence of `isError` destructuring looks like the developer forgot react-query exposes it, not a deliberate "we want failures to look empty" choice. (2) Structural impact? NO — adding an `isError` branch + an error UI is purely additive within the existing component; no architectural change. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `DataQualityContent.tsx:24` (the lossy destructure: `{ data, isSuccess }` — `isError` / `error` discarded)
- `dataQuality.ts:74-82` (the hook setup; `initialData` always supplied; no `onError` callback, no `errorPolicy` configured)
- `DataQualityContent.tsx:43-77` (the five memoised derivations that all collapse to zeros on `initialData`)
- `DonutChart.tsx:88-98` (the zero-total 'No data' path that renders the same way as a real empty catalog)

**Existing-ADR-or-implied-prescription**: cross-codebase, the `handleResponseAsyncThunk` redux pattern (ADR-CANDIDATE-084) routes errors through a uniform `AppError` envelope + toast notification. The dashboard's react-query path is NOT integrated with that error envelope — it is the first feature surface using react-query for backend fetches (the rest of the SPA uses redux thunks), and the dashboard skipped the equivalent integration. So this is a uniform-error-handling gap on a feature that diverges from the project's error-handling convention.

**Proposed remedy**: Three layers.

1. **Smallest — destructure `isError` / `error` and render an error UI**. Change `DataQualityContent.tsx:24` to `const { data, isSuccess, isError, error } = useGetDataQualityDashboard(filterState);`. Add an early-return branch: if `isError`, render a banner with the error message and a retry button (`refetch()` from the hook). This addresses the indistinguishability problem directly.
2. **Medium — wire the react-query path into the project's `AppError` envelope**. Add an `onError` callback that dispatches the same toast the redux `handleResponseAsyncThunk` shows. Brings the dashboard's error handling into line with the rest of the SPA.
3. **Larger — codify a project-wide react-query setup** that registers `QueryClient` defaults for `onError` + `retry` + `staleTime`, so future react-query call sites inherit the project's error policy by default. This is the structural fix; it composes with REFACTOR-612 (no staleTime configured).

Option 1 is sufficient for the operator-facing gap; the medium/larger options compound with REFACTOR-612 and would be best executed together.

**Severity rationale**: MEDIUM — operator-confusion bug. The system continues to function (no data loss, no security implication); the gap is that the operator cannot diagnose what they are seeing. Severity is MEDIUM rather than HIGH because (a) the operator usually has a parallel signal (other pages working = it's not auth/network; other dashboards have data = it's likely a real empty catalog), and (b) the engineer with browser devtools open can see the failing fetch. It becomes HIGH for operators in production environments without devtools access — typical Data Quality engineer persona.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` + cross-cutting `react-query integration with AppError` if the team takes Option 2/3. The Option 1 minimal fix is in scope for the dashboard sprint alone.

---
