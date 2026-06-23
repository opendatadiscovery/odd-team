# ConfirmationDialog thunk consumers `.unwrap()` — a refused destructive confirm no longer closes-as-success (#1766 ARM-2)

Closes #1766

## Problem

The shared `ConfirmationDialog` sits behind two kinds of consumer. #1797 fixed the TanStack **mutateAsync** arm (the stuck-spinner). This PR completes #1766 with the other arm: the ~13 consumers that pass a **bare `dispatch(thunk(...))`** to `onConfirm` (delete role / owner / namespace / data source / policy / collector / tag / term-ownership / entity-metadata / entity-ownership, regenerate collector & data-source tokens, set DQ severity, and delete term).

A redux-toolkit dispatch promise **resolves even on a rejected action** — `handleResponseAsyncThunk` catches the API error, fires the toast, and `rejectWithValue(...)`, but the dispatch itself still resolves. So when the backend refuses a destructive confirm (cascade-block `USR004`/400, RBAC 403, 500, network), the dialog's `onClose` `.then` branch ran and the modal **closed exactly as on success**. For term delete, `TermDetails` additionally chained `navigate(termsSearch)` onto the always-resolving dispatch, so a **refused term delete navigated away as if the term were deleted** — contradicting the error toast.

This is the silent-close + term-navigate-away behaviour deferred from #1797.

## Fix

Append `.unwrap()` to each thunk consumer's `onConfirm` dispatch. `.unwrap()` rejects on a rejected action, so the failure now flows through the shared `ConfirmationDialog` `.catch` shipped in #1797 (clears loading, surfaces the error inline, **keeps the dialog open**). `TermDetails`' navigate is gated on `.unwrap().then(...)`, so it runs only on a successful delete. This is the codebase's established idiom (25 existing `.unwrap()` call-sites; `SelectableSeverity` already adopted it in #1750 and is left untouched). No change to the shared `ConfirmationDialog` / `DialogWrapper` / `errorHandling` — the 10 mutateAsync consumers are unaffected.

The inline dialog message is the generic `An error occurred` (the unwrapped `rejectWithValue` payload is an already-parsed `AppError`, not a `ResponseError`); the **specific** server reason is shown in the toast (from `handleResponseThunk`). This matches how a network error already renders.

## Tests

**Unit (vitest, RED→GREEN proven):**
- `DataSourceItem.test.tsx` — a rejected `deleteDataSource` keeps the `ConfirmationDialog` open (no close-as-success); a resolved delete closes it.
- `TermDetails.test.tsx` — a rejected `deleteTerm` does **not** call `navigate` (PLT-234); a resolved delete navigates to term-search.
- Both proven RED on a reverted `.unwrap()` (bare dispatch) and GREEN on the fix; the real store + thunk + `.unwrap()` are exercised, only the API is mocked.

**Integration (odd-team `IT-141`, browser e2e, RED→GREEN proven):**
- `confirmation-dialog-thunk-arm.spec.ts` route-intercepts `DELETE /api/datasources/{id}` and `DELETE /api/terms/{id}` to force a 500. **GREEN** on the working-tree build: the datasource dialog stays open, the term delete stays on `/terms/{id}`. **RED** on `ref:main`: the datasource dialog closes-as-success, the term navigates to `…/termsearch/…`.

**Full integration regression (working-tree build):** `feature-complete` **311/311 GREEN**; `known-bugs` 3-RED-as-expected (no known-bug pin flipped). multi-stack + ingestion-e2e test backend HA/storage/ingestion (the backend jar is byte-identical to `main` here — only the bundled SPA changed), so they are unaffected by this FE-only change.

## Scope

This PR is the redux-thunk arm only. Deliberately out of scope, tracked separately:
- The 10 mutateAsync consumers — already correct post-#1797. No touch.
- The shared `ConfirmationDialog` / `DialogWrapper` / `errorHandling` — already fixed (#1797 / #1771).
- `MetadataItem.handleUpdate` (the edit-FORM submit, not a `ConfirmationDialog`) has the same silent-success shape — tracked separately as a follow-up.
- A DataSource delete pre-flight / forewarning UX improvement — a separate follow-up.

Milestone: 0.29.0
Docs: none — the relevant published page (`management.md`) already documents "the dialog stays open with the cancel option highlighted" for the owner/namespace/datasource cascade-block deletes; this fix brings the released code into conformance with that already-published claim (no page change needed).
