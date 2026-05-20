## ADR-CANDIDATE-086 — Selective error-toast suppression via `switchOffErrorMessage: true` is the project's standardised pattern for "primary-page-load" thunks where a full-page `<AppErrorPage>` banner is the right error surface (vs transient toast)

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source + grep count (14 occurrences across 10 thunk files — fetchDataEntityDetails, fetchTermDetails, fetchPolicy, fetchDataEntityAlertList, fetchDatasetStructure, fetchAlerts, fetchActivity, fetchPolicyList, fetchDataEntityLineage, fetchDataQualityTest)
**Axes present**: ui_redux_thunks, ui_error_handling
**Pillars affected**: [P-01, P-02, P-04, P-05, P-06, P-07, P-08, P-09] — the suppression pattern recurs across primary-page-load surfaces in every pillar

**Surfaced by**:
- `fetchDataEntityDetails.md:implicit_adrs[1]` (|-
    "**Selective error-toast suppression** is the project's pattern for handling 'expected failure' loads. `switchOffErrorMessage: true` (`dataentities.thunks.ts:41`) signals that the detail-page load is one of the loaders whose failure is expected to be communicated by the full-page `<AppErrorPage>` banner, not by a transient toast. The decision is encoded in the type: `switchOffErrorMessage?: boolean` is an opt-in field of `HandleResponseAsyncThunkOptions`. 14 occurrences across 10 thunk files share this stance")

**Decision statement**: The platform draws a deliberate line between two failure-surface patterns:
- **TOAST default** (no flag): transient async operations — mutations, list refreshes, side-fetches — whose failure is communicated by a top-of-screen toast. The user keeps interacting with the existing page; the toast acknowledges "something failed, here's why, retry as appropriate."
- **`<AppErrorPage>` banner via `switchOffErrorMessage: true`**: primary-page-load thunks whose failure means the page CANNOT render. A toast would be wrong (there's no page to keep interacting with). Instead, the slice's error envelope drives a full-page banner with status / statusText / url / message.

The 14 thunks opting in (fetchDataEntityDetails, fetchTermDetails, fetchPolicy, fetchDataEntityAlertList, fetchDatasetStructure, fetchAlerts, fetchActivity, fetchPolicyList, fetchDataEntityLineage, fetchDataQualityTest — per grep) are the project's enumerated set of "primary-page-load" thunks. Every one is the FIRST thunk dispatched by a route-component's mount; failure makes the page un-renderable; the AppErrorPage carries the user back to a meaningful next step.

The implementation: `switchOffErrorMessage?: boolean` is OPTIONAL with no default in `HandleResponseAsyncThunkOptions` (`handleResponseThunk.ts:14-17`). The error handler reads the flag at `handleResponseThunk.ts:37`: `if (!options.switchOffErrorMessage) { await showServerErrorToast(...); }`. The slice's reducer for the rejected action stores the AppError regardless — only the TOAST is conditional, never the error capture.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the type signature names the option explicitly (`switchOffErrorMessage?: boolean`); the 14-thunk consistent usage shows the same maintainer reasoning across primary-page-loads.
2. *Structural impact?* YES — the choice shapes the error-surface architecture: every page-load failure routes to AppErrorPage; every mutation failure routes to a toast. The split is observable to users.
3. *Refactoring or structural?* STRUCTURAL — flipping the default (toast → banner) or eliminating one mode requires changes across the 14 thunks AND the AppErrorPage AND the toast machinery. Not a refactor.
→ ADR.

**Evidence**:
- fetchDataEntityDetails.md says: "`{ switchOffErrorMessage: true }` short-circuits `showServerErrorToast` (`dataentities.thunks.ts:41` + `redux/lib/handleResponseThunk.ts:37-39`)"
- intent_anchor: `switchOffErrorMessage?: boolean` is an optional field with NO default; setting it `true` is an opt-in
- fetchDataEntityDetails.md says: "14 occurrences across 10 thunk files share this stance (loaders of large entities)"

**Existing ADR**: none. Composes with:
- ADR-CANDIDATE-084 (handleResponseAsyncThunk wrapper) — the wrapper's TYPE SIGNATURE makes this option first-class.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-279 (NEW — `AppError.message` falls back to literal `'An error occurred'` when backend returns non-JSON body / no message field; 502/504 from intervening proxy renders same opaque banner as a real 404)
- REFACTOR-280 (NEW — `AppError.url` carries the request URL into the UI's error banner, reflecting internal API paths on deployments without proxy stripping)

**Proposed action**: Promote to `adrs/drafts/error-surface-two-mode-split-toast-vs-apperrorpage.md`. Document:
- The toast-vs-banner split and the criterion for opting in (primary-page-load vs transient operation).
- The 14 thunks enumeration as the canonical set.
- The AppError shape contract (status + statusText + url + message).
- The maintenance obligation: a new primary-page-load thunk MUST opt in to `switchOffErrorMessage`; reviewers check.
- The reflection caveat (REFACTOR-280) — if the request URL needs to be hidden from user-visible errors on a deployment, the error envelope renderer must strip it.

**Severity rationale**: MEDIUM — pattern-shaping decision for the error-surface architecture; 14-thunk consistency is sufficient evidence. Below HIGH because it's an opt-in field rather than a load-bearing wrapper.

**Suggested backlog grouping**: `UI architecture codification` (with ADR-CANDIDATE-084 above).

---
