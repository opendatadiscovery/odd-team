fix(ui): ConfirmationDialog no longer swallows a rejected confirm (#1766)

Closes #1766
Milestone: 0.29.0
Docs: none — internal FE error-UX; no published page documents the confirm-dialog failure behaviour (read-confirmed: `management.md` documents *which* actions exist, not the dialog's failure handling).

## Problem

The shared `ConfirmationDialog` (behind every destructive action) handled a refused confirm with
`action().then(...).catch(() => {})`. On a non-2xx, a TanStack `mutateAsync` rejects, the `.catch` swallowed
it, and `isLoading` was never reset — and `DialogWrapper` sets `pointer-events:none` while loading, so the
modal **wedged open: spinner running forever, every mouse interaction dead**, recoverable only by reloading
the page. This hit the ~10 `mutateAsync` delete surfaces (lookup-table, attachments, query-examples, owner
associations). The platform's own guardrails (cascade-block `USR004`, RBAC 403) trigger this path in normal
operation.

Reproduced live on the running stack (forced 500 on the lookup-table delete) — the modal stayed open,
spinning, `pointer-events:none`.

## Fix

In `ConfirmationDialog.onClose`, the `.catch` now clears the loading state and surfaces the reason **inline**
via `DialogWrapper`'s **existing** `errorText` prop (message from the existing `getErrorResponse`
`ResponseError` unwrap), leaving the dialog open so the operator can read the error and retry or cancel. No
new component, no new strings, no contract change. The success path is unchanged.

## Scope (please read before merge)

This PR fixes the **mutateAsync stuck-spinner** — the highest-severity, no-recovery arm. Re-verified against
`origin/main`: **layer 2 of the issue's suggested fix already shipped in #1771** (`showServerErrorToast` now
unwraps `ResponseError`), so **both arms already render an error toast on failure** — the issue's "no error
toast appears on either path" is no longer accurate.

Deliberately **not** in this PR, tracked separately:
- the redux-thunk **silent-close** arm (the dispatch resolves on failure → the modal closes as success) —
  now toast-mitigated by #1771; idiomatic fix is `.unwrap()` across ~12 consumers.
- the **term-delete navigate-away** (`TermDetails` navigates as if deleted on a failed delete).

(If you'd prefer to keep #1766 open to track those two, drop the `Closes` line — they are otherwise tracked
as separate follow-ups by the odd-team.)

## Tests

- **Unit** (`ConfirmationDialog.test.tsx`, RTL): a rejecting `onConfirm` → inline error shown + dialog stays
  open; a resolving `onConfirm` → dialog closes (success path unchanged). The failing condition is injected
  explicitly. RED on this branch's base, GREEN with the fix; the full FE vitest suite stays green (49/49).
- **Integration** (odd-team `IT-138`, Playwright): drives the running UI under a forced 500 and asserts the
  dialog is no longer wedged (spinner cleared, `pointer-events:all`, inline error shown). **RED on
  `main`, GREEN on this branch.** The shared-component change was regression-checked against the full
  odd-minimal e2e suite on a working-tree build.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
