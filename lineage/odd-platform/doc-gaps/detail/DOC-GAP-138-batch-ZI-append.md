## STRENGTHENS — batch ZI (UI Routes 2) — 2026-05-26

**Trigger**: directory-route sidecar (`odd-platform__ts__routes__route__directory.md`) + queryExamples-route sidecar (`odd-platform__ts__routes__route__queryExamples.md`) enriched at substrate commits `ede5d277` / `4ec2b20`.

**Strengthen delta**: the NaN-swallowing route-hook cluster grows from 3 instances (batch ZH — DataEntity / Terms / Management) to **5 instances** with the addition of `useDirectoryRouteParams` (Directory) and `useQueryExamplesRouteParams` (Query Examples). The cluster's structural pattern (typed wrapper around `useParams<T>()` + `as T` cast + `parseInt(... , 10)` + NO `Number.isNaN` guard) is now confirmed across FIVE route modules; the convention is unambiguously platform-wide.

**New structural anchors surfaced (per the two route-module sidecars)**:

- **Instance 4 — `useDirectoryRouteParams()`** at `directoryRoutes.ts:29-41`:
  - Code: `useParams<keyof DirectoryRouteParams>()` (line 30) → `as DirectoryRouteParams` (line 32) → `parseInt(dataSourceId, 10)` (line 37) AND `typeId === 'all' ? undefined : parseInt(typeId, 10)` (line 34).
  - The hook performs TWO coercions: `dataSourceId` (always to number, no guard) and `typeId` (the magic-string `'all'` → `undefined` else parseInt).
  - At runtime: URL `/directory/postgresql/abc/all` → `useParams()` returns `{dataSourceTypePrefix: 'postgresql', dataSourceId: 'abc', typeId: 'all'}` → `parseInt('abc', 10) = NaN`. The hook returns `{dataSourceTypePrefix: 'postgresql', dataSourceId: NaN, typeId: undefined}` typed as `{dataSourceTypePrefix: string, dataSourceId: number, typeId: undefined | number}`.
  - Six consumer files receive `NaN`: `DataSourceList.tsx:27`, `Entities.tsx:20`, `DirectoryBreadCrumbs.tsx:13`, `EntitiesTabs.tsx:13`, `EntityItem.tsx:40`, `TableHeader.tsx:13`. `Entities.tsx:36-41` passes `{dataSourceId: NaN}` to `useGetDataSourceEntities` → backend `directoryApi.getDatasourceEntities({dataSourceId: NaN})` → 400/404 → `AppErrorPage` via `Entities.tsx:60-64`. SAME UX failure mode as DataEntityDetails / Terms / Management.
  - **NEW corner-case surfaced by directory-route sidecar** (bugs_limitations_corner_cases[3]): `directoryDataSourcePath(prefix)` (single-arg call) and `directoryDataSourcePath(prefix, dsId)` (two-arg call) both fall into the same level-2 branch because the truthy-check at line 48 is `if (dataSourceId && typeId)`. Calling `directoryDataSourcePath(prefix, 5)` (with valid dsId but no typeId) silently returns the level-2 URL, dropping the dsId entirely. No call site exercises this shape today, but a future refactor could regress silently. Adds a SECONDARY drift class (truthy-check ambiguity) on top of the NaN-coercion class.

- **Instance 5 — `useQueryExamplesRouteParams()`** at `queryExamplesRoutes.ts:19-27`:
  - Code: `useParams<keyof QueryExamplesRouteParams>()` (line 20) → `as QueryExamplesRouteParams` (line 22) → `parseInt(queryExampleId, 10)` (line 25).
  - The hook's single coercion: `queryExampleId` to number, no guard.
  - At runtime: URL `/data-modelling/query-examples/abc` → `useParams()` returns `{queryExampleId: 'abc'}` → `parseInt('abc', 10) = NaN`. The hook returns `{queryExampleId: NaN}` typed as `{queryExampleId: number}`.
  - Single consumer file: `QueryExampleDetailsContainer.tsx:19` — destructures and passes to `useGetQueryExampleDetails({exampleId: NaN})` → backend `GET /api/queryexample/NaN` → 400/404 → UI HANGS on `AppLoadingPage` (per `QueryExampleDetailsContainer.tsx:97`) until the error response arrives. SAME UX failure mode as the other 4 instances PLUS a longer-running visible-degradation (the loading page renders indefinitely until the backend error returns).
  - **NEW corner-case surfaced by queryExamples-route sidecar** (bugs_limitations_corner_cases[0]): the truthy-check guard at line 31 of `queryExamplesPath(queryExampleId?)` means `queryExamplesPath(0)` returns the LIST URL, not the details URL for id=0. Postgres bigserial currently never produces id=0, but a backend renumbering script or signed-int underflow could trip it silently. Adds a SECONDARY drift class (falsy-id-routes-to-list) on top of the NaN-coercion class.

- **The CROSS-ROUTE-MODULE pattern is now confirmed across FIVE instances**: all five are typed wrappers around `useParams<T>()` that perform an `as T` cast stripping `Partial<>`; none implement `Number.isNaN` / `isUndefined` / `isNullish` guards; all five produce silent runtime failures that surface as generic backend errors (400/404 → AppErrorPage or 400/404 → AppLoadingPage hang) rather than at the parameter-decode layer. The convention is platform-wide; the `useStrictParams` utility proposed in batch-ZH's strengthen (DOC-GAP-138-batch-ZH-append.md) would close all 5 in one place.

- **The pattern is now load-bearing for the strengthen case**: 5 instances across 5 different route modules, in 5 different pillars (P-01 Discovery / P-02 Modelling / P-03 Master Data via management / P-06 Glossary / P-08 Management) means the platform's convention is unambiguous. The doc-side fix (adding the `useStrictParams` utility's expectation to `developer-guides/contributing/testing-the-ui.md` per the proposed DOC-GAP-137) is now well-anchored; the code-side fix (introducing the utility itself) is the single highest-leverage 5-files-into-1 refactor for the route-hook tier.

**Proposed action — UPDATE to DOC-GAP-138's original proposed action and batch-ZH strengthen**:

The batch-ZH strengthen proposed (A-EXTENDED) a `useStrictParams<T>(parser?)` utility at `components/shared/contexts/RouteParams/useStrictParams.tsx`. With FIVE cluster instances now confirmed, the utility's contract should support:

1. **Configurable parsers per field** — the Directory hook coerces TWO fields (`dataSourceId` to number, `typeId` to optional-number-OR-`undefined` based on `'all'` sentinel); the QueryExamples hook coerces ONE field (`queryExampleId` to number); the DataEntity hook coerces ONE (`dataEntityId` to number); the Terms hook coerces ONE (`termId` to number) with a second SEARCH-id pass-through; the Management hook PASSES the segment through as a string (no coercion needed). The utility must support: (a) string-pass-through; (b) parseInt-with-fallback-on-NaN; (c) literal-sentinel-mapping (e.g. `'all'` → `undefined`).

2. **Configurable failure mode** — three options: (a) throw a typed `MalformedRouteParamsError`; (b) return a `null` / sentinel value the consumer must branch on; (c) automatically redirect to a `<NotFoundPage />` (the simplest UX). Option (c) is the recommended default; option (a) gives consumers more control.

3. **TypeScript-honest types** — the cast `as T` is the type-system lie in all 5 instances. The utility's return type must accurately reflect the runtime shape: `Partial<T>` or `T | null` or a discriminated union of `{ ok: true, params: T } | { ok: false, error: ParseError }`. The lie is the structural debt; the utility's return-type contract is the structural fix.

**Cross-link to DOC-GAP-303 / DOC-GAP-304 / DOC-GAP-305 / DOC-GAP-306 (NEW batch ZI)**: the 4 new ZI findings all touch route-module sidecars where the NaN-swallowing pattern is present. THIS strengthen joins the cluster across ZI.

**Cross-link to DOC-GAP-302 (NEW batch ZH — WithPermissionsProvider META)**: the 5-instance NaN cluster and the 11+-instance WithPermissionsProvider cluster are both META findings about UI-route conventions. Together they suggest the route-module layer is structurally under-validated (no tests, type-system lies on multiple axes); a single sustained pass at the route-module convention (utility + lint rule + doc-product cross-link) would close both clusters.

**No live WebFetches this session** for THIS strengthen — the strengthen is code-side primary source (the 2 ZI route-module sidecars) + no doc page is named as a fact-source. The cluster's doc-product fix targets the developer-guide page (DOC-GAP-137) not a feature page.

**No severity / category change**: still LOW / drift. Sidecar count grows from 3 (batch ZH cluster) to **5** (batch ZI, adding Directory + Query Examples route modules); the pattern is now a 5-instance CLUSTER spanning 5 pillars. The cluster framing makes the structural fix (`useStrictParams` utility + lint rule) the maintainer-efficient closure. Headline left unchanged per shard.py headline-rewrite rule (severity/category unchanged).
