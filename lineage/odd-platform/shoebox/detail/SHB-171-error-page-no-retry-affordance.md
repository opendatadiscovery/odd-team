# SHB-171 — AppErrorPage has no Try Again / Reload affordance; operators must manually navigate to recover from transient backend errors

**Category**: merged
**Severity**: LOW

## Hypothesis

When an operator hits a transient backend hiccup (5xx, network blip) on a detail page, AppErrorPage renders with only ONE call-to-action — "Return to the Home Page". There is no "Try Again" button, no "Reload" link, no "Report this Error" affordance. The operator who hits a transient 5xx must (a) click Home Page and navigate back to the previous route manually, OR (b) press the browser refresh button. The widget design does not expose a retry callback prop. For 5xx errors that are typically transient, the operator's path of least resistance is "give up and reload" — losing any context they were carrying.

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppErrorPage/AppErrorPage.tsx:8-13` — props interface: `showError`, `error`, `offsetTop`. No `onRetry` callback prop.
- `odd-platform-ui/src/components/shared/elements/AppErrorPage/AppErrorPage.tsx:31-32` — only the "Return to the Home Page" button is rendered; hardcoded `to='/'`.
- AppErrorPage sidecar bugs_limitations_corner_cases[3] notes the absence of a retry affordance as a corner-case.

## Notes

- Caller-side workaround: each caller could pass a `key` prop that changes on click to force remount of the parent component (which would re-fire the fetch); but no caller does this today.
- The retry pattern would be: AppErrorPage `<Button onClick={onRetry}>Try Again</Button>` + each caller passes `onRetry={() => dispatch(fetchXxx(...))}`.
- 23 callers across the SPA (per AppErrorPage sidecar) — adding the prop would be a coordinated change but each caller is a one-line addition.
- For transient 5xx the retry is the right action 90% of the time; the operator should be able to click once not refresh-the-whole-app.
- This is an ENRICHER for F-042 (Page-level UI Error Display).

## Next

1. Add `onRetry?: () => void` prop to AppErrorPage; render a "Try Again" button when supplied.
2. Update the 23 callers to pass `onRetry={() => dispatch(theirFetchThunk)}`.
3. Promote: ENRICHER to F-042 as the retry-affordance facet.

## Links

- cluster_with: [F-042]
- merged_into: F-042
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — F-042 already carries the `no_retry_cta_only_home_page_navigation` facet (severity LOW) with verbatim file:line citation. No new drift class needed. F-042: Page-level UI Error Display — drift_class: ui_error_widget_no_retry_only_home_page_button (existing).
