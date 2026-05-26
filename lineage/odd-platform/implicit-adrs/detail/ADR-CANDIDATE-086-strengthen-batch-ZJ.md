## STRENGTHENS — Batch ZJ (2026-05-26 — AppErrorPage primary-source sidecar confirms the 23-caller pattern + uniformity of the controlled-component shape)

Prior ADR-CANDIDATE-086 framed the two-mode error-surface split (toast vs `<AppErrorPage>` banner) keyed on `switchOffErrorMessage: true` at the thunk-wrapper layer. Batch ZJ adds the COMPLEMENTARY-SIDE evidence: the `AppErrorPage.tsx` widget itself is a controlled component with props-only interface (`showError: boolean; error?: ErrorState;`), wired identically across 23 page-level callers — the uniformity is what makes the ADR's split observable to operators.

**New surfaced_by entry**:
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:implicit_adrs[0]` (HIGH) — "**The error-display UI is per-page-component-owned, not global.** Every page-level data-loading component (DataEntityDetails, TermDetails, Search/Results, AlertsList, ActivityResults, Directory, DataSourceList, Entities, DataEntityAlerts, TestReport, DatasetStructureOverview, DatasetStructureCompare, HierarchyLineage, IntegrationPreviewList, Integration, PolicyDetails, OwnerAssociations*, Term*, LinkedTerms{Entities,List}) wires its OWN AppErrorPage instance keyed on its OWN fetching-status selector. The widget is purely a render-helper; the SHOW-OR-HIDE decision lives in the consumer. The convention is applied consistently across 23 caller files."

**What this strengthening adds**: prior coverage was the thunk-wrapper option (`switchOffErrorMessage`). Batch ZJ adds the WIDGET-SIDE perspective:

1. **Controlled-component, not subscriber**: AppErrorPage reads NO redux state, NO jotai atom, NO React-Query cache. Every caller must wire `showError` and `error` explicitly. This is the wider design decision that makes the ADR-086 thunk-side split work — without the widget being a render helper, the per-page convention wouldn't compose.

2. **23-caller cardinality**: Verified across the full UI tree (Grep `AppErrorPage` over `odd-platform-ui/src/components`); every caller follows the pattern `<AppErrorPage showError={isXxxNotFetched} error={xxxFetchingError} />`. The uniformity is the evidence of intentional design.

3. **Two-channel design confirmed**: The `error.message` IS surfaced briefly via `react-hot-toast` from `showServerErrorToast` (`errorHandling.tsx:48-68`); the AppErrorPage carries only the status code + status text on the persistent surface. The split-channel design at THIS sidecar layer is the operator-visible mirror of the thunk-side split.

**Triangulation count**: was 1 (fetchDataEntityDetails + 14-thunk grep); now 2 (thunk-wrapper + AppErrorPage widget) + 23 caller files confirming the widget-side convention. Severity unchanged (MEDIUM).

**NEW ADR-CANDIDATE-233 NEW this batch carves out a DIFFERENT decision** from this one — the field-omission contract (display only `status` + `statusText`; never `url` + `message`). That is a separate information-disclosure-boundary decision; this ADR (086) is about WHICH thunks trigger the page vs the toast.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-233 NEW this batch (information-disclosure boundary: the field-omission contract sibling).
- SUPERSEDES: none.
- CONFLICTS: none.

---
