---
id: PLT-265
title: "The Saved searches menu stays open after picking an entry, and its modal backdrop hides the reapplied results from assistive technology"
target_repo: odd-platform
issue_type: bug
status: fixed-in-pr      # 2026-09-04 — folded into odd-platform PR #1879 on the maintainer's call during the /review of #1878, rather than filed and queued. NOT filed as a GitHub issue: it ships with the PR that surfaced it.
github_issue_url: ""
github_issue_number: null
filed_title: "Saved searches: picking an entry does not close the menu (and hides the results from screen readers while it stays open)"
filed_labels: "kind: bug, scope: frontend"
severity: low            # a usability + accessibility nit: one extra click-away per reapply; no data or navigation is wrong
discovered_during: "CTRIB-065 / #1878 -- driving the saved-search reapply flow end-to-end (IT-155), 2026-09-04"
found_date: "2026-09-04"
user_facing_verified: true    # observed on a running 1.0.0-line build (main@96d77668 + the #1878 fix): the popover remains after the navigation
suggested_milestone: ""       # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches one
---

## What

On the Catalog search page, open **Saved searches** and click one of the entries. The search reapplies
(the URL changes and the results reload), but the **menu stays open** on top of the page. The user has to
click away or press Escape before they can use the reapplied results.

The menu is a modal popover, so while it stays open the rest of the page is marked hidden for assistive
technology: a screen-reader user who picks a saved search is left inside an empty menu, with the results
they just asked for behind it.

## Where

`odd-platform-ui/src/components/Search/Results/SavedSearches/SavedSearches.tsx` -- `handleReapply` only
navigates (`navigate(...)`); nothing closes the `AppPopover` it lives in. The rename and delete actions on
the same row have the same shape. Compare the toolbar's other menus (for example the Sort-by menu), which
close on selection.

## Steps to reproduce

1. Open the Catalog search with any query, save it as a saved search.
2. Click **Saved searches**, then click the entry.
3. **Expected:** the menu closes and the reapplied results are usable at once.
   **Actual:** the results reload behind the still-open menu; a click-away or Escape is needed. With a
   screen reader, the results are not reachable until the menu is dismissed.

## Suggested fix (superseded — see "How it was actually fixed")

Close the popover from `handleReapply` (the `AppPopover` exposes its close handler to the trigger; pass it
into the row actions or lift the open state), and do the same after delete. Rename opens its own dialog
and can stay as it is.

## How it was actually fixed (2026-09-04, odd-platform `510a29b9` on PR #1879)

**The draft's own suggestion was wrong on two counts, and reading the component caught both.**

1. *"The `AppPopover` exposes its close handler to the trigger"* — it does not. `AppPopover` holds
   `anchorEl` in local state and passes only `onClick` out, through `renderOpenBtn`. There was **no** way for
   any child to close it, so the "one-line fix in `handleReapply`" was not reachable without changing the
   shared component. The fix therefore adds the missing contract: `children` may be a **render prop**
   receiving the popover's own `onClose`, mirroring the `renderOpenBtn` idiom rather than inventing a second
   one. Opt-in and backward compatible — a plain node still works, and the three other call sites
   (Term details, Dataset-field header, Query-example details kebabs) are untouched, proved by `tsc` and by a
   test that pins the plain-node path.
2. *"and do the same after delete"* — **rejected as a product call.** Delete mutates the list in place; the
   user watches the row disappear, and may remove several. Closing the menu there would take the surface away
   mid-task. Only **reapply** closes, because it is the one row action that changes the page *underneath* the
   menu. Rename opens a dialog over the popover; Copy link may be used repeatedly.

**Why it was a class, not an instance.** Every `AppPopover` consumer whose item acts in place had the same
defect; the other three merely hide it behind a dialog. Fixing the shared component closes all four.

Tests (both buckets): `AppPopover.test.tsx` (new, 3 cases) — RED-proved against the unfixed component, where
React warns *"Functions are not valid as a React child"* and both render-prop cases fail while the
plain-node case passes on both versions; and odd-team **IT-155**, whose `reapply()` helper had an
`Escape` press as a workaround for exactly this bug — removed and replaced by an assertion that the entry
disappears, so the absence of the workaround is itself the guard.

## How discovered

While driving the saved-search round-trip end-to-end for #1878: a role-based check for the Favorites
checkbox on the reapplied page could not find it because the still-open menu had marked the page
`aria-hidden`. Pre-existing (saved searches shipped in #1855); not caused by #1878 and not part of that
fix, which is contract-only.
