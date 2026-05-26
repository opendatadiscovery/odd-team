## ADR-CANDIDATE-233 — AppErrorPage's 2-of-4-fields display contract is an information-disclosure boundary: only `status` + `statusText` are rendered to the persistent error pane; `url` + `message` populate the ErrorState but are NEVER placed in the DOM (the toast carries `message` briefly; nothing carries `url`)

**Severity**: HIGH
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-09 Security & Access Control, P-08 Operator Experience]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:implicit_adrs[1]` (HIGH) — "Only `status` and `statusText` are displayed; `url` and `message` are deliberately omitted. The `ErrorState` type (`redux/interfaces/loader.ts:3-8`) carries four fields — `{status, statusText, url, message}` — populated by `getErrorResponse(response)` from the fetch `Response` (`errorHandling.tsx:12-26`). The AppErrorPage JSX deliberately accesses only `error?.status` (line 25) and `error?.statusText` (line 29). The backend `body.message` and the failing API `url` are NOT rendered to the page. The decision is to keep the error pane minimal — no leak of backend implementation details (stack traces, DB error strings, internal URL paths) to the user. The same `message` IS shown briefly in a `react-hot-toast` via `showServerErrorToast` (`errorHandling.tsx:48-68`) — short-lived, dismissible, side-of-screen, not persistently on the error page. The two-channel design (toast for message, page for status code) is the evidence of an intentional information-disclosure boundary."

**Decision statement**: The platform's `AppErrorPage` widget renders ONLY two of the four fields its `ErrorState` prop carries. The omission is structural: `error.url` (the failing API URL, which could disclose internal endpoint structure) and `error.message` (the backend's response body, which may carry stack-trace fragments, SQL exception text, or echoed user input) are NEVER rendered to the persistent error pane. The `message` IS surfaced via a separate channel — `react-hot-toast` from `showServerErrorToast` (`errorHandling.tsx:48-68`) — with a 6-second display window (App.tsx:55 `toastOptions.custom.duration=6000`). The `url` is rendered nowhere. This is a deliberate two-channel design that bounds the leak surface: high-signal short-lived hint (toast for `message`) coexists with low-signal persistent status (page for `status`+`statusText`).

The decision is reinforced by the 23-caller uniformity (every page-level error-pane caller passes the full `ErrorState` and gets back a 2-field display) and by the upstream chain that populates the omitted fields (`errorHandling.tsx:12-26` does populate `url` from `response?.url` and `message` from `body?.message`; nothing dropped them upstream — the AppErrorPage's render layer is where they're deliberately not consumed).

**Wisdom test (3-question)**:
1. *Intentional?* YES — the upstream populates all four fields; the widget reads only two; this is selection at the render layer. The asymmetry with the toast (which carries `message`) shows a deliberate two-channel split. The fact that the `error.message` and `error.url` exist in the schema and are populated by `getErrorResponse` but never rendered here is the explicit choice.
2. *Structural impact?* YES — the choice shapes how every page-level error pane (23 callers) discloses information to the user. The split-channel design (page = status; toast = message; nothing = url) is observable to operators and to attackers; it is the information-disclosure architecture for client-side error display.
3. *Refactoring or structural?* STRUCTURAL — adding `<Typography>{error.message}</Typography>` to AppErrorPage would invert the boundary across 23 surfaces simultaneously, leaking backend implementation details to users persistently (not just in a 6-second toast). Reverting would require touching the toast machinery + the error-handling thunk chain to decide who carries what. The choice is architectural, not a local code style.
→ ADR.

**Evidence**:
- AppErrorPage.md says: "Only `status` and `statusText` are displayed; `url` and `message` are deliberately omitted."
- AppErrorPage.md says: "The same `message` IS shown briefly in a `react-hot-toast` via `showServerErrorToast` (`errorHandling.tsx:48-68`) — short-lived, dismissible, side-of-screen, not persistently on the error page. The two-channel design (toast for message, page for status code) is the evidence of an intentional information-disclosure boundary."
- AppErrorPage.tsx:24-26 (only `error?.status` accessed in JSX) + AppErrorPage.tsx:29 (only `error?.statusText` accessed) + redux/interfaces/loader.ts:3-8 (the full four-field shape that is intentionally NOT all rendered) + errorHandling.tsx:48-68 (the toast that carries the message)

**Existing ADR**: composes with ADR-CANDIDATE-086 (selective error-toast suppression via `switchOffErrorMessage` — the thunk-wrapper-side decision). 086 covers WHICH thunks trigger the page vs the toast; 233 (this ADR) covers WHAT each surface renders. The two together define the platform's error-surface architecture.

**Proposed action**: Promote to `adrs/drafts/apperror-page-information-disclosure-boundary.md` (new ADR). Document:
- The 2-of-4-field contract (`status` + `statusText` rendered; `url` + `message` omitted).
- The two-channel split (page = persistent status; toast = brief message; URL = never).
- The maintenance obligation: a future PR adding `<Typography>{error.message}</Typography>` or `<Typography>{error.url}</Typography>` to AppErrorPage MUST be reviewed against this ADR. The implicit boundary IS the load-bearing safety property of the widget; the omission is the security feature.
- Add a regression test pinning the displayed-field contract (no current test).
- Cross-link to REFACTOR-279 (the `AppError.message` fallback to `'An error occurred'` is the toast-side data quality problem; this ADR is the page-side guard against rendering it) and REFACTOR-280 (the `AppError.url` carrying internal API paths into the error envelope; this ADR documents that the URL never reaches the page render, only the envelope shape).

**Severity rationale**: HIGH — load-bearing security architecture spanning 23 page-level surfaces. The 2-of-4-field contract is the structural safety property that prevents backend implementation details from leaking to users via the persistent error pane. Without an ADR, the decision is invisible — the next maintainer "helpfully" adding URL or message to the page would silently invert the boundary across the full UI surface. The lack of a defending comment in `AppErrorPage.tsx` is the silent fragility this ADR closes.

**Suggested backlog grouping**: `UI security architecture codification` (with ADR-CANDIDATE-086).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-279 (AppError.message generic-fallback) — composes; this ADR is the render-layer guard that bounds the impact of 279's data-quality issue.
- REFACTOR-280 (AppError.url internal-path reflection) — composes; this ADR documents that the URL doesn't reach the page render even though it's in the envelope.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-086 (the thunk-wrapper-side decision is the sibling; together they define the platform's error-surface architecture).
- SUPERSEDES: none.
- CONFLICTS: none.

---
