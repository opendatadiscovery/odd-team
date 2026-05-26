# SHB-172 — AppErrorPage callers using react-query cast a different error type, producing undefined behaviour on missing fields

**Category**: open
**Severity**: LOW

## Hypothesis

Two Integration callers (`Integration.tsx`, `IntegrationPreviewList.tsx`) use react-query instead of redux for the fetch — but they pass the react-query `Error | null` to AppErrorPage via a TypeScript cast (`error as ErrorState`). Since react-query errors do NOT carry the redux `ErrorState` shape (`{status, statusText, url, message}`), the cast silently strips the type-check that would catch the shape mismatch. At runtime, AppErrorPage reads `error?.status` (number) and `error?.statusText` (string) — both undefined on a react-query Error — so the page renders with an empty error code column and the "Unknown Error" fallback title.

## Evidence

- `odd-platform-ui/src/components/Management/Integrations/IntegrationDetails/IntegrationHeader/IntegrationHeader.tsx:33` (or `Integration.tsx:33`) — `<AppErrorPage showError={isError} error={error} />` where `error` is a react-query `Error | null`.
- `odd-platform-ui/src/components/Management/Integrations/Integrations/IntegrationPreviewList/IntegrationPreviewList.tsx:70` — `<AppErrorPage showError={...} error={error as ErrorState} />` — explicit cast.
- `odd-platform-ui/src/components/shared/elements/AppErrorPage/AppErrorPage.tsx:8-13` — typed `error?: ErrorState` (the redux shape).
- AppErrorPage sidecar bugs_limitations_corner_cases[2] documents this as LOW-severity.

## Notes

- Per the Integrations sub-route's lack of permission-context wrapping (SHB-163) + its react-query usage (not redux), Integrations is the "rebel" Management sub-area that diverges from the platform's other conventions.
- Fix candidates: (a) generalise AppErrorPage's `error` prop to a discriminated union of `ErrorState | { name: string; message: string }` so react-query Errors are first-class; (b) write a `errorFromQuery` adapter that converts react-query Error to ErrorState; (c) migrate the Integration components to redux.
- The current behaviour is degraded but not crashing: operators see "Unknown Error" with no status code, which is strictly worse than the normal error page.
- guess: as more components migrate to react-query (TanStack Query is the modern pattern), this drift will spread; worth fixing the type contract proactively.
- F-033 (Integration Wizard) might be the right anchor.

## Next

1. Write `errorFromQuery(error: Error | null): ErrorState | undefined` helper.
2. Update both Integration callers to use it.
3. Generalise AppErrorPage's `error` prop signature for future-proofing.
4. Promote: ENRICHER to F-033 OR F-042.

## Links

- cluster_with: [F-033, F-042]
- merged_into: (open)
- supersedes: []
