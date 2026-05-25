---
doc_gap_id: DOC-GAP-269
severity: LOW
category: drift
batch: ZC
generated_at: "2026-05-25T00:00:00Z"
generated_at_commit: ede5d277
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-04:F-002"
related_doc_gaps:
  - DOC-GAP-268   # the en-dash zero-state is documented there
---

## DOC-GAP-269 — Quality Dashboard empty-state / no-data-ingested behaviour is undocumented — an operator opening `/data-quality` on a fresh install (or after a failed dashboard fetch) sees three grey "No data" donuts plus zero category panels, with NO explanatory copy on screen and NO doc-side description; the failed-fetch state is INDISTINGUISHABLE from the genuinely-empty-catalog state because the component destructures only `{ data, isSuccess }` from `useGetDataQualityDashboard` (never `isError`/`error`), and react-query's `initialData` (all-zeros `DataQualityResults`) is shown on both initial-loading and error paths

**Severity**: LOW
**Category**: drift (the silence is a doc-gap; the code's behaviour is benign — operator sees a grey dashboard but no harm)

### Surfaced by

- `odd-platform__ts__react-component__component__DataQualityContent.md:docs_link_semantic.doc_drift_findings.[3]` — verbatim: *"DOC DRIFT — the empty-state is undocumented. The live `dashboard` page says nothing about what the dashboard shows when no DQ tests are ingested. The code path: `DonutChart` renders a single grey 'No data' slice per ring (`DonutChart.tsx:94-95`) and zero category panels render (`testResults` is `[]`). An operator on a fresh install opening `/data-quality` sees three grey donuts and an otherwise empty page with no explanatory copy."*
- `odd-platform__ts__react-component__component__DataQualityContent.md:bugs_limitations_corner_cases.[5]` (MEDIUM per sidecar — *"No error UI — a failed dashboard fetch shows the all-zero `initialData` placeholder, indistinguishable from a genuinely empty catalog. The component destructures only `{ data, isSuccess }` from `useGetDataQualityDashboard` (`DataQualityContent.tsx:24`) — never `isError` / `error`. On a 4xx/5xx from `GET /api/dataqatests/runs`, react-query keeps `data` at `initialData` (all zeros), `isSuccess` stays false, `testResults` is `[]`, and the operator sees three grey 'No data' donuts with no error message. A real backend failure is presented as 'your catalog has no data quality tests'."*)
- `odd-platform__ts__react-component__component__DataQualityContent.md:concepts.invariants` — *"Each `DonutChart` self-handles its own zero-total case — when all slice values sum to 0 it renders one grey 'No data' slice (`DonutChart.tsx:88-98`)"*
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:stress_findings.tunables[formFiltersAtom-initial-value]` — *"The dashboard renders with the React Query `initialData` (dataQuality.ts:34-72): three donut rings all at 0 and six anomaly-class categories all at 0, until the real `{}`-filtered fetch resolves and replaces it. So before the network completes the operator sees an all-zero dashboard, then the true catalog-wide numbers — this is a property of the fetch hook's `initialData`."*

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status **200** (DIRECT FETCH this session) — verbatim Q6 answer: *"Empty-State / No-Data Behavior: No information provided. The page does not describe empty-state presentations or behavior when no data has been ingested."*
- `odd-platform-ui/src/components/DataQuality/DataQualityContent/DataQualityContent.tsx:24` — verbatim: `const { data, isSuccess } = useGetDataQualityDashboard(filterState);` — only `data` and `isSuccess` destructured; no `isError`, no `error`
- `odd-platform-ui/src/redux/api/dataQuality.ts:74-82` — `useGetDataQualityDashboard` wraps `useQuery` with `initialData` set to a hand-coded all-zeros `DataQualityResults` carrying the six categories (`Assertion Tests`, `Freshness Anomalies`, `Schema Changes`, `Volume Anomalies`, `Column Values Anomalies`, `Unknown category`) each with all-six-status zero-count `results`
- `odd-platform-ui/src/components/shared/elements/DonutChart/DonutChart.tsx:88-98` — the zero-total fallback: when all slice values sum to 0, render a single grey slice with `name: 'No data'`
- `odd-platform-ui/src/components/DataQuality/DataQualityContent/DataQualityContent.tsx:75-77` — `const testResults = useMemo(() => (isSuccess && data ? data.testResults.toSorted(...) : []), [isSuccess, data])` — under `isSuccess === false` (initial loading OR failed fetch), `testResults` is `[]` and no category panel renders

### Drift narrative

The Quality Dashboard has three distinct visual states that are operator-indistinguishable without explanatory copy:

1. **Fresh install / no DQ data ingested** — the backend returns a real `DataQualityResults` with all-zero counts; donuts render grey "No data" slices; the six category panels DO render (because the backend mapper `addMissingStatuses` injects zero-count rows, so `testResults` is non-empty), each showing en-dashes in every tile and a `0` total.
2. **Initial loading** — react-query is in flight; `data` is the `initialData` all-zeros placeholder; `isSuccess` is `false`; `testResults` is `[]`; donuts render grey "No data"; ZERO category panels render. Once the fetch resolves, the panels appear.
3. **Failed fetch (4xx/5xx)** — react-query is in error; `data` is still the `initialData` all-zeros placeholder (because react-query keeps `initialData` on error); `isSuccess` stays `false`; `testResults` stays `[]`; donuts render grey "No data"; ZERO category panels render. State 3 is visually IDENTICAL to state 2 — there is no error indicator. State 3 is also visually similar to state 1 (the donuts look the same; only the absence of category panels distinguishes states 2/3 from state 1).

The live dashboard page is silent on all three. An operator on a fresh install opening `/data-quality` sees three grey donuts and (after the fetch resolves with all-zero data) six all-en-dash category panels, with no copy explaining "you haven't ingested any DQ tests yet — go to the Test Results Import page". An operator hitting a failed-fetch state sees the same grey donuts indefinitely and may interpret it as "the catalog has no DQ data" rather than "the dashboard endpoint failed; check logs".

### Proposed doc action

**Single-part action — add an "Empty-state and failure modes" sub-section to the dashboard doc page**, with cross-link to test-results-import.md so a fresh operator has a next step.

`documentation/docs/features/data-quality/dashboard.md` — at the end of the page (after the per-category row + interaction sub-sections):

> ## Empty-state and failure modes
>
> ### No DQ data ingested
>
> On a fresh install (or before any DQ test results have been ingested), the dashboard renders three grey **"No data"** donuts and six empty per-category rows (each showing a `0` total and en-dashes in every status tile). The dashboard is functional — it has nothing to show. To populate the dashboard, ingest DQ test results via the methods documented in [Test Results Import](/features/data-quality/test-results-import).
>
> ### Loading
>
> While the dashboard's data fetch is in flight, the donuts render grey "No data" slices and the per-category rows are absent. The dashboard re-renders with the fetched data once the request resolves.
>
> ### Backend failure
>
> If the dashboard's data fetch fails (network error, backend 5xx, etc.), the dashboard remains in the loading-style empty state — grey donuts and absent category rows — with NO error indicator. This is a known UX gap (see [issue tracker](https://github.com/opendatadiscovery/odd-platform/issues)). If you see the empty dashboard persistently after the page has fully loaded, check the browser's developer-tools Network tab for a failing `GET /api/dataqatests/runs` and the platform server logs for the corresponding error.

### Cross-references

- **DOC-GAP-268** (per-category row undocumented) — sibling finding; the en-dash zero-state mentioned here is part of the per-category row's display vocabulary, and is also documented there.
- **DOC-GAP-265** (3-vs-6 statuses) — sibling finding; the "Unknown" status mentioned in the empty-state description is part of the broader six-status enumeration DOC-GAP-265 wants to document.
- **Rule 6 coherence** — cross-registry sweep ran: `concepts/index.yaml` for "DonutChart No data" — no existing finding; no contradiction. Sibling test-results-import.md content is touched here ONLY by cross-link; no edit needed there.

### Severity rationale

LOW. The empty-state is benign — operator sees a grey-but-functional dashboard, no data loss, no security exposure. The failed-fetch indistinguishability is the only mild concern (operator may misdiagnose a backend failure as an empty catalog). The fix is one sub-section. LOW per the Quality Bar's severity anchoring — cosmetic / documentation-completeness, not operator-trap.

### Last verified

- 2026-05-25 — WebFetch dashboard page status 200; the page still has no empty-state mention; sidecar evidence (DataQualityContent.tsx:24, DonutChart.tsx:88-98, dataQuality.ts:74-82) re-confirmed at substrate commit `ede5d277`.
