---
id: PLT-265
title: "The Saved searches menu stays open after picking an entry, and its modal backdrop hides the reapplied results from assistive technology"
target_repo: odd-platform
issue_type: bug
status: draft            # paste-ready; the bot never files issues
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

## Suggested fix

Close the popover from `handleReapply` (the `AppPopover` exposes its close handler to the trigger; pass it
into the row actions or lift the open state), and do the same after delete. Rename opens its own dialog
and can stay as it is.

## How discovered

While driving the saved-search round-trip end-to-end for #1878: a role-based check for the Favorites
checkbox on the reapplied page could not find it because the still-open menu had marked the page
`aria-hidden`. Pre-existing (saved searches shipped in #1855); not caused by #1878 and not part of that
fix, which is contract-only.
