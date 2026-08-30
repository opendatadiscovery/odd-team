---
id: PLT-256
title: "\"Save current search\" silently drops the Asset-type filter: SavedSearch.spec is typed SearchFormData, which has no asset_kinds field"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "Saved searches silently drop the Asset-type filter (asset_kinds is not part of the saved spec)"
filed_labels: "kind: bug, scope: frontend, scope: backend"
severity: medium   # silent data loss in a user-invoked save; the user is told the search was saved, and it was not
discovered_during: "CTRIB-061 / #1841 ST-7 design read of the search URL-state stack (origin/main @ 82e7e70e)"
found_date: "2026-08-30"
user_facing_verified: false   # cause proven from the contract + both mapping functions; NOT yet driven on a running stack
suggested_milestone: "1.0.0"   # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches it (G-C11)
---

## Summary

Saving a search that has an **Asset type** filter applied stores the search *without* that filter. The
user is given no warning; reapplying the saved search returns a wider result set than the one they saved.

This is not a mapping oversight that can be patched in one line -- the saved-search **contract** has no
place to put the value. `SavedSearch.spec` is typed `SearchFormData`, and `asset_kinds` lives on
`AssetSearchFormData`, a different schema.

## Where it goes wrong

`asset_kinds` was introduced by ST-4 (#1838) as a URL-only search dimension on `AssetSearchFormData`:

```yaml
# odd-platform-specification/components.yaml
AssetSearchFormData:
  allOf:
    - $ref: '#/components/schemas/SearchFormData'
    - type: object
      properties:
        asset_kinds:
          type: array
          items:
            $ref: '#/components/schemas/AssetKind'
```

Saved searches (ST-3, #1837) predate it and store the *base* schema:

```yaml
SavedSearch:
  properties:
    spec:
      $ref: '#/components/schemas/SearchFormData'   # query + my_objects + sort + filters. No asset_kinds.
```

Both halves of the round trip therefore drop it, and each is correct in isolation:

- **Capture** -- `SavedSearchForm.tsx` builds the spec with
  `searchUrlStateToFormData(paramsToSearchState(location.search))`. That function returns
  `{ query, myObjects, sort, filters }`; there is no `assetKinds` key, because its return type cannot
  hold one. (`searchUrlStateToAssetSearchFormData` -- the variant that *does* carry `assetKinds` -- exists
  right beside it and is what the search request uses, but a `SearchFormData` field cannot accept it.)
- **Reapply** -- `SavedSearches.tsx` rebuilds the URL with
  `searchStateToParams(searchFormDataToUrlState(item.spec))`, and `searchFormDataToUrlState` likewise
  returns no `assetKinds`.

A comment in `SavedSearchForm.tsx` shows the same class of bug was consciously avoided for `sort`:

> Capture the CURRENT main search from the URL -- the canonical source of truth (D10).
> NOT the getSearchUrlState selector: it omits `sort`, which would drop the active ordering.

`sort` was protected because it existed when saved searches were written. `asset_kinds` arrived one slice
later and nothing revisited the contract.

## User-facing impact

A user narrows the catalog to, say, **Terms** only, gets a focused result set, and clicks **Save current
search** with a name like "glossary review". The dialog reports success. Later they reapply it and get
Data Entities, Terms and Query Examples -- the narrowing they saved is gone, with no message and nothing
in the UI indicating the saved search is not what they saved.

The failure is silent in both directions, which is the harmful part: the feature's entire promise is
"this exact search, again later", and it quietly does not keep that promise. The wider the catalog, the
more misleading the reapplied result.

Severity is medium rather than high because no data is corrupted and the user can re-apply the filter by
hand -- but they have to notice first, and nothing tells them.

## Steps to reproduce

1. Open the Catalog search page.
2. In the Filters sidebar, set **Asset type** to `Terms` (the URL becomes `/search?asset_kinds=TERM`).
3. Click **Save current search**, name it, save.
4. Reload, open **Saved searches**, and reapply the entry.
5. **Expected:** the URL carries `asset_kinds=TERM` and only Terms are listed.
   **Actual:** the URL has no `asset_kinds` and all three asset kinds are listed.

## Suggested fix (for the maintainer -- not applied here)

The value has to become part of the saved contract; where it goes is a design call:

- **Option 1 -- widen the stored spec.** Point `SavedSearch.spec` at `AssetSearchFormData` (a superset of
  `SearchFormData`, so every stored row stays valid), and carry `assetKinds` through
  `searchUrlStateToFormData` / `searchFormDataToUrlState`. Most faithful to "save the search I see", and
  it makes room for the URL-only dimensions still arriving in the #1825 overhaul.
- **Option 2 -- store the canonical URL** rather than a typed spec, and parse it on reapply. Immune to
  this whole class of drift, but it makes the stored value opaque to the server.

Option 1 looks right: the saved search is a search, and the search request object is already
`AssetSearchFormData`.

## Note on scope

Any *further* URL-only search dimension added to the overhaul inherits this same gap by construction --
it will be captured by the request object and dropped by the saved spec. Worth fixing before more of
them land.

## Sources

All read at `origin/main @ 82e7e70e`:

- `odd-platform-specification/components.yaml` -- `SearchFormData` (no `asset_kinds`), `AssetSearchFormData`
  (`allOf` + `asset_kinds`), `SavedSearch.spec -> SearchFormData`
- `odd-platform-ui/src/lib/search/searchUrlState.ts` -- `searchUrlStateToFormData`,
  `searchUrlStateToAssetSearchFormData`, `searchFormDataToUrlState`
- `odd-platform-ui/src/components/Search/Results/SavedSearches/SavedSearchForm.tsx` -- the capture call
- `odd-platform-ui/src/components/Search/Results/SavedSearches/SavedSearches.tsx` -- the reapply call
- `adrs/drafts/unified-asset-search.md` -- D10 (URL is the source of truth), D11 (a saved search stores a spec)
