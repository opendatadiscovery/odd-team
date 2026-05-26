# SHB-154 — Backend error messages flash for 6 seconds in a toast; operators have no persistent way to recover the diagnostic

**Category**: open
**Severity**: MEDIUM

## Hypothesis

When a page-level data fetch rejects, operators see two error surfaces with asymmetric lifetimes: (1) a 6-second react-hot-toast carrying the backend's `error.message` (which may contain useful hints like "You need permission DATA_ENTITY_READ" or "Term 9999 does not exist"), and (2) a persistent AppErrorPage on the page showing only `error.status` + `error.statusText`. The diagnostic message vanishes after 6 seconds — if the operator blinks, or if a second toast queues up and dismisses the first, the only place the backend's hint ever appeared is gone, and the AppErrorPage on the page does NOT recapitulate it. Operators are left with an opaque "404" / "Forbidden" with no recourse short of opening DevTools and inspecting the network response.

## Evidence

- `odd-platform-ui/src/lib/errorHandling.tsx:48-68` — `showServerErrorToast` is the only carrier of `error.message`; toast-only, no persistent log.
- `odd-platform-ui/src/components/App.tsx:55` — `toastOptions: { custom: { duration: 6000 } }` — global 6-second default.
- `odd-platform-ui/src/components/shared/elements/AppErrorPage/AppErrorPage.tsx:24-29` — only `error?.status` and `error?.statusText` are rendered; `error.url` and `error.message` are NOT re-displayed on the page.
- `odd-platform-ui/src/lib/errorHandling.tsx:12-26` — `getErrorResponse` populates all four fields; the page deliberately drops two of them.

## Notes

- The two-channel design (toast for message, page for status code) IS deliberate per the AppErrorPage sidecar's implicit_adrs[1] — it's an information-disclosure boundary so a future maintainer can't accidentally leak backend stack traces onto the page. The DESIGN is correct; the FAILURE MODE is the asymmetric lifetime.
- A better UX: AppErrorPage shows the status + statusText AS NOW, plus a "Show details" disclosure that toggles `error.message` for the operator who clicks it. Keeps the disclosure boundary, removes the time-pressure.
- The 6-second toast is also the only place where 5xx error bodies (which CAN contain SQL exception fragments per the AppErrorPage sidecar's data_exposure section) appear — meaning a careful operator who DOES read the toast may see backend internals; this is the ALSO-disclosed side of the same finding.
- The error-display surface is undocumented end-to-end (no doc page describes what users see when a fetch fails) — see AppErrorPage sidecar's doc_drift_findings.

## Next

1. Decide: add a "Show details" toggle to AppErrorPage that surfaces `error.message` + `error.url` on operator request.
2. DOC-NNN — file a doc-gap for "Troubleshooting / Common error pages" under operator-guides.
3. Decide whether to extend toast duration for 5xx (vs 4xx) — likely complexity-not-worth-it.

## Links

- cluster_with: [F-042, SHB-153]
- merged_into: (open)
- supersedes: []
