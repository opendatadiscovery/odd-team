---
id: PLT-257
title: "ST-7b -- \"Recently favorited\" ordering for the Favorites filter"
target_repo: odd-platform
issue_type: feature
status: draft            # PASTE-READY sub-issue for the maintainer to file under #1825. The bot is policy-barred
                         # from creating issues (playbooks/github-write.md; G-C18) -- this is a draft, not a filing.
                         # 2026-09-03: odd-platform#1875 (ST-7) MERGED and #1841 was CLOSED as completed -- this draft
                         # is now the ONLY tracker of the ordering. Filing it (title + body below, labels, milestone
                         # 1.0.0) is the one human action that unblocks `/contribute <new-issue>` for ST-7b.
github_issue_url: ""
github_issue_number: null
filed_title: "ST-7 followup -- \"Recently favorited\" ordering for the Favorites filter"
filed_labels: "scope: backend, scope: frontend, kind: feature"
severity: medium
discovered_during: "CTRIB-061 / #1841 ST-7 planning -- split out of ST-7 at GATE 1 (see contributor/CTRIB-061.md section 6.2)"
found_date: "2026-08-31"
user_facing_verified: false   # design-verified against the source; not yet built
suggested_milestone: "1.0.0"  # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches it (G-C11)
parent_issue: 1825
sibling_issue: 1841      # ST-7, CLOSED 2026-09-03 (completed) on odd-platform#1875 / squash 96d77668
---

## Summary

Sub-issue of #1825, sibling of #1841 (ST-7, shipped in #1875). ST-7 replaced the `/favorites` tab
with a Favorites filter on the Catalog search. The retired tab listed favorites
**most-recently-favorited first**; the search page has no such ordering. This issue adds it.

Split out of ST-7 deliberately: the ordering is not a one-line `ORDER BY`, it is a change to the
cursor-pagination engine built in ST-5a/5b/5c, and it is the same size as those slices.

**Nothing user-visible regresses in the meantime.** Favorites has never shipped -- the feature is
absent from 0.29.0, 0.28.0 and 0.27.13, and its documentation page exists only on the
`release/1.0.0` documentation branch, not on `main`. So no operator on any published release can
experience the missing ordering. Both slices target 1.0.0.

## Why the ordering matters

With no search text the result list orders by status priority, and ties break on internal catalog
id -- which is arbitrary *and stable*. A freshly starred asset therefore does not merely rank low:
it lands at an unrelated position and never moves. That defeats the "what did I just star / what
am I working on this week" workflow the feature exists for.

GitHub, the closest comparable product with a personal star list, ships "Recently starred" as a
sort option for exactly this reason.

## What to build

A named ordering ("Recently favorited") in the existing global Sort-by dropdown, offered when the
Favorites scope is active and used as the default in that state when there is no text query --
mirroring the existing per-context default rule (relevance for a query, status priority for
browse).

The index it needs already exists: `favorite_identity_created_active_idx` on
`favorite (oidc_username, provider, created_at DESC) WHERE deleted_at IS NULL` (`V0_0_94`).

## Why this is its own slice -- the call sites it touches

Read at `main` during ST-7 planning. Two of these fail **silently**, which is what makes this
unsuitable as a rider on the filter PR:

| Site | What must change |
|---|---|
| `AssetSearchServiceImpl` `final boolean relevance = sort == RELEVANCE` | gates the pager choice, the depth cap and `nextCursor`; becomes an `isOffsetPaged(sort)` predicate |
| `AssetSearchCursor.encode` / `.decode` | both branch on `sort == RELEVANCE`. A FAVORITED_AT cursor takes the else-branch, emits a null keyset, then fails `decode`'s `instanceof String` guard -- **infinite scroll silently re-fetches page 1 forever** |
| `keysetSortValueField`, `seekBranchPredicates`, `outerOrderFields`, `toPageRow` | each has a `default ->` arm that silently means STATUS_PRIORITY -- so a new constant inherits the wrong paging and **duplicates and skips rows**. Make them exhaustive |
| `SearchSortDto.resolveEffective` | called twice independently (service + repository). The repository's copy reads only `FacetStateDto`, which does not carry the favorites scope -- so the two would disagree, breaking the invariant the code states in its own comment |
| `searchUrlState.ts` `defaultSortForContext` + `SEARCH_SORT_OPTIONS`/`SEARCH_SORT_VALUES` | the FE mirrors the server's per-context default so the dropdown can display it, under an explicit "update in lockstep" comment. Without this the control **displays the wrong ordering** |
| `SearchSortMenu.tsx` | offer the option only when the Favorites scope is on |

The ordering itself needs **no new join**: a correlated scalar subquery in `ORDER BY`, resolving on
the same unique index the filter predicate already probes, so `searchFrom()` is untouched and every
other query keeps its plan.

## Acceptance

- With the Favorites scope on and no search text, the most-recently-starred asset is the first row.
- The Sort-by dropdown displays the ordering that is actually applied (no FE/BE disagreement).
- Paging is correct at depth: no duplicated and no skipped rows across pages, and page 2 is not
  silently page 1.
- The ordering option is offered only where it is meaningful.
- Tests: unit (ordering + cursor round-trip + the pager choice) and integration (the newest-starred
  asset is row 1, asserted through the UI).

## Sources

Read at `origin/main` during ST-7 planning:
`odd-platform-api/.../service/AssetSearchServiceImpl.java`,
`odd-platform-api/.../dto/AssetSearchCursor.java`,
`odd-platform-api/.../dto/SearchSortDto.java`,
`odd-platform-api/.../repository/reactive/ReactiveAssetSearchRepositoryImpl.java`,
`odd-platform-api/.../db/migration/V0_0_94__create_favorite.sql`,
`odd-platform-ui/src/lib/search/searchUrlState.ts`,
`odd-platform-ui/src/components/Search/Results/SearchSortMenu/SearchSortMenu.tsx`.
