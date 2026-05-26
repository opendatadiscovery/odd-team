# SHB-145 — Catalog and Dictionary tab clicks produce silent no-op failures on backend rejection

**Category**: open
**Severity**: MEDIUM

## Hypothesis

If operators click the Catalog or Dictionary toolbar tab while the backend is unavailable (or rejects the search-id mint with 5xx), the click produces zero observable feedback — no toast, no navigation, no error banner. The two tab handlers chain `.unwrap().then(({searchId}) => navigate(...))` with NO `.catch(...)`, so a rejected `createDataEntitiesSearch` or `createTermSearch` thunk leaves the user on the previous page with the toolbar appearing unresponsive. Repeated clicks during a backend outage mint repeated orphan search-id rows server-side (the thunks have no in-flight de-dup, no idempotency key).

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:112-117` — Dictionary handler: `dispatch(createTermSearch(...)).unwrap().then(({searchId}) => navigate(...))` — no `.catch`.
- `odd-platform-ui/src/lib/hooks/useCreateSearch.ts:14-19` — Catalog handler shape: same pattern; no error path.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:121-123` — Catalog tab onClick dispatches `createSearch` via `useCreateSearch`.
- (cross-ref) Sibling thunk pattern `fetchDataEntityDetails` opts INTO `switchOffErrorMessage: true` so it relies on AppErrorPage to surface 5xx; the Catalog / Dictionary search-mint thunks DON'T opt in, so the default toast SHOULD fire — verify that handleResponseAsyncThunk's default actually emits `showServerErrorToast` for these.

## Notes

- Two rapid clicks on Catalog/Dictionary mint two search-id rows server-side (per ToolbarTabs sidecar resource_boundaries — second-to-resolve wins, first is orphaned). No data corruption; orphan accumulation only.
- The orphan-search-id table likely has no TTL cleanup; long-running deployments accumulate orphan rows from every double-click event in the platform's lifetime. Cross-check the housekeeping TTL set (F-010 — currently 5 jobs; add a 6th for orphan search-ids?).
- This is adjacent to (but distinct from) F-042 page-level UI error display — F-042 is the AppErrorPage on the destination page; THIS is the silent no-op BEFORE navigation even happens.
- guess: the same silent-failure class applies to every thunk that uses `.unwrap().then` without `.catch` across the codebase — worth a grep audit.

## Next

1. Verify whether `handleResponseAsyncThunk` actually fires a default error toast when `switchOffErrorMessage` is NOT set — read `redux/lib/handleResponseThunk.ts:34-39`.
2. Grep `.unwrap().then(` across `odd-platform-ui/src` to estimate how many click handlers share this silent-failure shape.
3. Probe: kill the backend, click Catalog, observe what the operator sees (toast? nothing?).

## Links

- cluster_with: [F-041, F-042]
- merged_into: (open)
- supersedes: []
