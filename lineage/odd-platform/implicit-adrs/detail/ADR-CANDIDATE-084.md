## ADR-CANDIDATE-084 — `handleResponseAsyncThunk` is the project-wide Redux Toolkit thunk wrapper; every `createAsyncThunk` goes through it, with `setSuccessOptions` / `switchOffErrorMessage` / `rejectWithValue(AppError)` baked-in as first-class options

**Severity**: HIGH
**Classification**: promote
**Support count**: 1 sidecar primary-source + project-wide grep counts (`setSuccessOptions` 55 occurrences across 15 thunk files; `switchOffErrorMessage` 14 occurrences across 10 thunk files; ZERO direct `createAsyncThunk` calls outside the helper)
**Axes present**: ui_redux_thunks
**Pillars affected**: [P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, P-11] — the wrapper governs EVERY async data-fetch surface in the SPA

**Surfaced by**:
- `fetchDataEntityDetails.md:implicit_adrs[0]` (|-
    "The project standardises **all** async data-fetching through `handleResponseAsyncThunk` (a thin wrapper around Redux Toolkit's `createAsyncThunk`) that bakes in the success-toast / error-toast / `rejectWithValue(AppError)` triad — verified by Grep counts: `setSuccessOptions` 55 occurrences across 15 thunk files; `switchOffErrorMessage` 14 occurrences across 10 thunk files; ZERO direct `createAsyncThunk` usage outside this helper")

**Decision statement**: The odd-platform-ui SPA standardises EVERY async data-fetch through a single project-local wrapper `handleResponseAsyncThunk` (at `redux/lib/handleResponseThunk.ts:19-43`) around Redux Toolkit's `createAsyncThunk`. The wrapper bakes in three orthogonal concerns as first-class options on the thunk-factory:
1. **`setSuccessOptions`** — opt-in success-toast emission (default: silent on success); 55 occurrences across 15 thunk files exercise the success-toast path.
2. **`switchOffErrorMessage`** — opt-in error-toast suppression for "expected failure" loads where a full-page `<AppErrorPage>` banner is the right surface (default: error-toast on failure); 14 occurrences across 10 thunk files exercise the suppression.
3. **`rejectWithValue(AppError)`** — standardises the error envelope shape (status + statusText + url + message) so the loader-slice's matcher (`loader.slice.ts:42-48`) and every error-rendering surface (`<AppErrorPage>`, error toasts) consume a uniform shape.

ZERO files in the SPA call `createAsyncThunk` directly outside this helper — the wrapper IS the project's only entry point. Adding a new async fetch is a single-line `handleResponseAsyncThunk('actionType', async (arg, { rejectWithValue }) => {...}, options)` call; the project's success/error/loading-state machinery composes automatically.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the wrapper's TYPE SIGNATURE makes `setSuccessOptions` and `switchOffErrorMessage` first-class options of the thunk-factory (`HandleResponseAsyncThunkOptions<ThunkArg>` interface at `handleResponseThunk.ts:14-17`); a thunk authored without using this wrapper would have to manually duplicate the try/catch/getErrorResponse/showServerErrorToast/rejectWithValue logic. The wrapper IS the project's standard.
2. *Structural impact?* YES — affects EVERY data-fetch in the SPA. The loader-slice's three matchers (`/pending`, `/fulfilled`, `/rejected`) key on the wrapper's action-type convention; error-rendering surfaces consume the standardised AppError shape.
3. *Refactoring or structural?* STRUCTURAL — adopting it is a structural choice (every async-fetch surface composes with the wrapper); abandoning it would force every consumer to duplicate the logic.
→ ADR.

**Evidence**:
- fetchDataEntityDetails.md says: "verified by Grep counts: `setSuccessOptions` 55 occurrences across 15 thunk files; `switchOffErrorMessage` 14 occurrences across 10 thunk files; ZERO direct `createAsyncThunk` usage outside this helper (project does not call `createAsyncThunk` from any non-helper file)"
- fetchDataEntityDetails.md says: "`redux/lib/handleResponseThunk.ts:19-43` (the helper's exported surface; the only entry point)"
- intent_anchor: the helper's TYPE SIGNATURE makes `setSuccessOptions` and `switchOffErrorMessage` first-class options; the loader-slice's three matchers key on the wrapper's action-type convention

**Existing ADR**: none. Composes with:
- ADR-CANDIDATE-001 (controllers-as-delegates — backend codegen contract) — `handleResponseAsyncThunk` consumes the OpenAPI-generated `*Api` clients on the UI side; the controllers-as-delegates ADR is the backend half, this is the UI half of the codegen → typed-fetch chain.
- ADR-CANDIDATE-007 (uniform `Mono<ResponseEntity<T>>` return type) — the backend's uniform success path is `.map(ResponseEntity::ok)`; the wrapper's uniform success path is `dispatch(thunk.fulfilled)`. Both ends standardise success/error surfaces.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-277 (NEW — `handleResponseAsyncThunk` does NOT propagate Redux Toolkit's built-in `requestId` for stale-response protection; rapid entity-id switching produces last-arriving-wins overwrites)
- REFACTOR-289 (NEW — ZERO unit tests on the wrapper or any of its consumers; the project's most-used abstraction has zero regression-pin)

**Proposed action**: Promote to `adrs/drafts/handleresponseasyncthunk-wrapper-standardisation.md`. Document:
- The wrapper's contract (3-option signature, 3 lifecycle action-types, standardised AppError envelope).
- The 55-thunk usage pattern across 15 files.
- The rule: NEVER call `createAsyncThunk` directly; ALWAYS go through the wrapper.
- The composition with the loader-slice's lifecycle-action matchers.
- The two-mode error surface convention: toast (default, for transient/recoverable failures) vs `<AppErrorPage>` banner (`switchOffErrorMessage: true`, for primary-page-loads that need full-page feedback).
- The opt-in success-toast pattern (silent by default, `setSuccessOptions` to opt-in).
- The future-evolution direction: `requestId` propagation should be added to the wrapper (closes REFACTOR-277 codebase-wide).

**Severity rationale**: HIGH — load-bearing architectural decision; the wrapper governs every data-fetch in the SPA. A future maintainer who bypasses it has broken cross-cutting invariants (error envelope shape, loader-slice action-type convention, toast/banner discipline). Highest-leverage UI-side codification target.

**Suggested backlog grouping**: `UI architecture codification` (with ADR-CANDIDATE-085 below — the related fan-out-into-three-slices pattern is the data-side of the same architecture).

---
