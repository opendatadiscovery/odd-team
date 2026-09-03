---
id: PLT-256
title: "Saved searches silently drop the Asset-type AND Favorites filters: the saved spec is SearchFormData, both filters live only on AssetSearchFormData"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "Saved searches silently drop the Asset-type and Favorites filters (the saved spec cannot hold URL-only search dimensions)"
filed_labels: "kind: bug, scope: frontend, scope: backend"
severity: high   # a user-invoked save reports success and stores a DIFFERENT search; two shipped filters affected; the class grows with every URL-only dimension the #1825 overhaul adds; the maintainer hit it on the first test of merged #1875
discovered_during: "CTRIB-061 / #1841 ST-7 design read (2026-08-30, the asset_kinds instance); the favorites instance was observed by the maintainer testing merged #1875 on 2026-09-03"
found_date: "2026-08-30"
updated: "2026-09-03"   # widened from the asset_kinds instance to the CLASS (asset_kinds + favorites); the enforced round-trip check now LEADS the acceptance (playbooks/follow-up-on-disk.md cross-cutting-invariant rule, LSN-036; case-law LSN-042)
user_facing_verified: true   # favorites: maintainer-observed in the UI on merged main (2026-09-03). Both fields: API round-trip on the ST-7 SUT (image odd-platform:odd-team-sut-ctrib061, ST-7 file set byte-identical to main@96d77668) -- POST /api/saved_searches with spec.favorites=true + spec.asset_kinds=[TERM] returned 201 with NEITHER field in the stored spec (sort survived); probe row deleted afterwards (204).
suggested_milestone: "1.0.0"   # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches it (G-C11)
# NOTE (workspace-internal, not part of the paste): the PR body of odd-platform#1875 and two odd-contributor[bot]
# comments on #1841 (2026-08-30 scope comment, 2026-09-02 PR announcement) say this defect was "reported separately".
# THIS DRAFT is that report. It was never filed (the bot is policy-barred from creating issues), so from the
# GitHub side nothing was ever reported. Filing this closes that loop. Retrospective: retrospectives/LSN-042.
---

## What

Saving a search that has an **Asset type** filter or the **Favorites** filter applied stores the search
*without* that filter. The dialog reports success. Reapplying the saved search returns the unfiltered
catalog, with no message and nothing in the UI indicating that the saved search differs from what was saved.

This is a contract gap, not a one-line mapping oversight: `SavedSearch.spec` is typed `SearchFormData`, and
both `asset_kinds` and `favorites` live on `AssetSearchFormData`, a different schema. Every URL-only search
dimension added to the unified search inherits the same gap by construction until the saved contract is
widened.

## Where

All read at `origin/main @ 96d77668` (the merge of #1875, ST-7).

**The contract** -- `odd-platform-specification/components.yaml`:

```yaml
AssetSearchFormData:            # :466 -- the cross-kind search REQUEST
  allOf:
    - $ref: '#/components/schemas/SearchFormData'
    - type: object
      properties:
        asset_kinds: ...        # :476 (ST-4, #1838)
        favorites: ...          # :480 (ST-7, #1841)

SavedSearch:                    # :2574
  properties:
    spec:
      $ref: '#/components/schemas/SearchFormData'   # :2587 -- query + my_data + sort + filters. No asset_kinds, no favorites.

SavedSearchFormData:            # :2614 -- the create/update payload
  properties:
    spec:
      $ref: '#/components/schemas/SearchFormData'   # :2623
```

**Capture (front end)** -- `odd-platform-ui/src/components/Search/Results/SavedSearches/SavedSearchForm.tsx:70`
builds the spec with `searchUrlStateToFormData(paramsToSearchState(location.search))`. That function
(`odd-platform-ui/src/lib/search/searchUrlState.ts:366-389`) returns `{ query, myObjects, myData, upstreamDepth,
downstreamDepth, sort, filters }` -- no `assetKinds`, no `favorites`, because its return type `SearchFormData`
cannot hold them. The variant that DOES carry both, `searchUrlStateToAssetSearchFormData` (`:397-407`), is what
the search request uses; the saved-search form cannot use it because the payload field is typed `SearchFormData`.

**Reapply (front end)** -- `SavedSearches.tsx:43,57` rebuilds the URL with
`searchStateToParams(searchFormDataToUrlState(item.spec))`; `searchFormDataToUrlState` (`searchUrlState.ts:422-460`)
returns `{ query, facets, myData, upstreamDepth, downstreamDepth, sort }` -- again no `assetKinds` / `favorites`.

**Server side** -- `odd-platform-api/.../service/SavedSearchServiceImpl.java:94-95` serialises the spec as
`SearchFormData`; `:103-108` deserialises the stored jsonb into `SearchFormData.class`. So even an API client that
sends the fields loses them: the generated `SearchFormData` has no such properties, the unknown keys are dropped
without error. Storage is `saved_search.spec jsonb` (`V0_0_97__create_saved_search.sql`), so widening the type
needs no migration.

The `sort` field was deliberately protected against this class when saved searches were written (a comment in
`SavedSearchForm.tsx` explains why the URL, not the redux selector, is captured "it omits `sort`, which would
drop the active ordering"). `asset_kinds` (ST-4) and `favorites` (ST-7) arrived after ST-3 and neither revisited
the saved contract.

## User-facing impact

Verified on the running system, both ways.

- **Favorites (observed in the UI, 2026-09-03).** A user switches the **Favorites only** toggle on, gets their
  starred assets, clicks **Save current search**, names it "my stars", and is told it was saved. Later they pick
  "my stars" from **Saved searches**: the page navigates to a URL without `favorites=yes`, the Favorites toggle
  shows **off**, and the list is the whole catalog. The saved search does not reproduce the search that was
  saved, and nothing says so.
- **Asset type.** Same shape: narrow to **Terms** only, save as "glossary review", reapply -> Data Entities,
  Terms and Query Examples are all listed; the `asset_kinds` narrowing is gone.
- **API consumers.** `POST /api/saved_searches` with `spec.favorites: true` and `spec.asset_kinds: ["TERM"]`
  returns `201` with a stored spec that carries neither (`sort` survives). The client gets a success response
  for a spec it did not store. No 4xx, no warning.

The failure is silent in both directions, which is the harmful part: the feature's entire promise is "this
exact search, again later", and for two of the sidebar's controls it quietly does not keep that promise.

## Why it matters

- **A user-invoked save reports success and stores something else.** The user only finds out when the reapplied
  list is visibly wrong -- and a wider list is easy to not notice at all.
- **The class grows.** Any further URL-only dimension the search overhaul adds to `AssetSearchFormData` is
  captured by the request object and dropped by the saved spec, by construction. Fixing the contract once stops
  the next instance; fixing per field does not.
- **It contradicts the design.** The unified-search design says the saved row holds *the same param spec the URL
  encodes -- one canonical spec, two surfaces*. Today there are two specs: the URL knows about `asset_kinds` and
  `favorites`, the saved row does not.

Severity high rather than critical: no data is corrupted and the user can re-apply the filters by hand. But two
shipped controls are affected, the user is told the wrong thing, and the maintainer hit it on the first manual
test of the merged Favorites filter.

## Steps to reproduce

Favorites:

1. Star at least one asset. Open the Catalog search page.
2. Switch the **Favorites only** toggle on (the URL becomes `/search?favorites=yes`; the list narrows).
3. Click **Save current search**, name it, save.
4. Reload, open **Saved searches**, and pick the entry.
5. **Expected:** the URL carries `favorites=yes`, the toggle is on and only starred assets are listed.
   **Actual:** the URL has no `favorites` param, the toggle is off, the whole catalog is listed.

Asset type:

1. In the Filters sidebar set **Asset type** to `Terms` (`/search?asset_kinds=TERM`).
2. Save, reload, reapply as above.
3. **Expected:** `asset_kinds=TERM` in the URL and only Terms listed. **Actual:** all three asset kinds listed.

API:

```
POST /api/saved_searches
{"name":"probe","spec":{"query":"","filters":{},"favorites":true,"asset_kinds":["TERM"],"sort":"NAME"}}
-> 201 {"spec":{"query":"","sort":"NAME","filters":{...}, ...}}      # no favorites, no asset_kinds
```

## Suggested fix

**Widen the saved contract to the search request type** (recommended):

- `components.yaml`: point `SavedSearch.spec` AND `SavedSearchFormData.spec` at `AssetSearchFormData`. It is a
  superset of `SearchFormData`, so every stored row stays valid and no migration is needed (`spec` is jsonb).
- Regenerate the BE and FE clients; `SavedSearchServiceImpl` serialises / deserialises `AssetSearchFormData`.
- Front end: capture with `searchUrlStateToAssetSearchFormData` (it already exists); on reapply, project
  `assetKinds` and `favorites` back into `SearchUrlState` (`favorites: true -> 'yes'`, `false -> 'no'`, absent
  stays absent -- `favorites: false` is a real filter and must not be defaulted).

The alternative -- store the canonical URL string and parse it on reapply -- is immune to the whole class but
makes the stored value opaque to the server; the typed superset is the better fit since the saved search IS a
search and the request object is already `AssetSearchFormData`.

## Acceptance

Lead with the check that would have caught the NEXT instance, not only the fix for these two:

1. **A round-trip contract test** (front end, `searchUrlState.test.ts`): build a fully-populated `SearchUrlState`
   (every key set: query, every facet, my_data + depths, sort, asset_kinds, favorites), run
   capture -> stored spec -> reapply, and assert deep equality with the original state. Any future dimension
   added to the URL state or to `AssetSearchFormData` without saved-search support turns this test RED.
2. **Server round-trip** (`SavedSearchController` web test or service test): a saved search created with
   `favorites: true` and `asset_kinds: ["TERM"]` is returned, listed and re-read with both intact.
3. **Integration** (extend the saved-search or favorites e2e spec): apply Favorites + an Asset type, save, reload,
   reapply -> the URL carries `favorites=yes` and `asset_kinds`, the toggle is on, and a known un-starred asset
   is absent from the list.
4. **Compatibility:** a row saved before the change (spec without the new fields) still reapplies unchanged.

## How discovered

Found while mapping the URL-param census for the ST-7 Favorites filter (#1841, PR #1875): the saved-search spec
type had no field for ST-4's `asset_kinds`, and the new `favorites` dimension was going to inherit the same gap.
It was noted in the #1875 PR body and the #1841 thread as a pre-existing contract gap to be fixed separately, and
the maintainer observed the favorites case in the UI on the first test of the merged filter (2026-09-03). The
server-side drop of both fields was then confirmed with an API round-trip on a stack built from the same code.
