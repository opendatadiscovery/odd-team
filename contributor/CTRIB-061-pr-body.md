Part of #1841

Adds a **Favorites** scope to the unified cross-kind search, retires the bespoke `/favorites` tab in favour of it, and points the Catalog Overview panel's **View all** at the pre-filtered search. Favoriting itself — the star, the `favorite` table, the `/api/favorites` write and list endpoints — is untouched.

This is ST-7 of #1825, rebased onto ST-8 (#1871) and ST-6 (#1873).

## What ships

- **`AssetSearchFormData.favorites`**, an optional boolean. `true` narrows to the caller's starred assets, `false` to the ones they have not starred, and **absent means no narrowing at all** — which is why it is a nullable boolean and must never be defaulted to `false` by a client.
- **A correlated `EXISTS` / `NOT EXISTS` on `favorite`**, keyed on the polymorphic `(asset_kind, asset_id)` pair, so it is cross-kind with no kind guard — one predicate serves Data Entities, Terms and Query Examples alike. It adds **no join** to `searchFrom()`, so every other query keeps its exact plan.
- **Identity from the security context only** (`CurrentUserIdentityResolver`), never the request, so a caller can only narrow by their own bucket. Under `auth.type=DISABLED` there is no principal and all callers share one instance-wide bucket — which the control discloses in both its label and its inline help.
- **`/favorites` is redirected, not deleted.** `App.tsx` has no catch-all route, so removing it outright would render the toolbar over a blank page for every existing bookmark and shared link.
- **The zero-result state teaches the star** ("Star an asset to pin it here.") when the scope is on — the job the retired tab's empty state did for a first-time user.

## Two deliberate departures from the issue's wording

Both agreed at the plan gate, both stated on the issue thread before any code:

**1. A toggle, not the All / Yes / No tri-state.** A person stars tens of assets among thousands, so "everything I have **not** starred" returns a list indistinguishable from "All" — a selected state that reads as a broken control, sitting between the user and the value they actually want. No comparable catalog (DataHub, Atlan, Secoda, GitHub) exposes a tri-state for a personal boolean. **The wire contract keeps the third state**, so `favorites=false` remains expressible by API and URL; only the dead on-screen option is gone.

**2. "Recently favorited" ordering is not here.** The retired tab listed favorites newest-starred-first. Delivering that means threading a per-user ordering through the cursor-pagination engine built in ST-5a/5b/5c — eight call sites across the pager, the cursor codec and the sort control, two of which fail silently. It ships as its own slice in this milestone. Nothing regresses for users meanwhile: Favorites has never shipped in any release, so there is no published behaviour to lose.

Because `favorites=false` has no UI control, it also has no two-state representation. It renders **indeterminate** rather than unchecked — an unchecked box over a list narrowed to un-starred assets would claim "no filter" while filtering — and a click **escapes** that state instead of flipping it to `yes`.

## Measured, not asserted

`EXPLAIN (ANALYZE, BUFFERS)` on the SQL the application actually generates — captured from its r2dbc query log rather than hand-written — over 50k entrypoint rows and 60k favorites across 300 identities:

| query | plan | time |
|---|---|---|
| broad query, no favorites predicate (control) | bitmap heap scan + top-N sort | 180 ms |
| broad query + `favorites=true` | nested-loop semi-join, drives from `favorite` | **5.9 ms** |
| broad query + `favorites=false` | nested-loop anti-join | 4,829 ms |
| selective query + `favorites=false` | merge anti-join | 6.7 ms |

The positive direction — the one the UI exposes — is fast. The negative direction degrades ~27x on a query matching most of the catalog: a ~50x GIN row misestimate makes a nestloop anti-join look cheap, the inner side materialises and ~10M comparisons happen in memory. A partial index on the exact correlated 4-tuple was built and re-measured and **did not help**, so the misestimate is the driver, not a missing index. Reported separately; reachable only by a hand-built URL or the API.

The measurement also corrected a comment in this diff: it had claimed the predicate probes `favorite_identity_asset_key`, when the planner in fact uses the partial `favorite_identity_created_active_idx` and drives from the `favorite` side.

## Tests

- **`AssetSearchFavoritesIntegrationTest`** — 6 behavioural cases on a real Postgres: narrowing across all three kinds, the negative direction, absent-means-no-narrowing, per-identity isolation proved without authenticating, soft-delete semantics, and composition with `asset_kinds`. Each also asserts `total` matches the page, since a count that disagrees is a phantom badge.
- **`searchUrlState`** — round-trip, fail-closed parse, preservation alongside the other URL-only params, and that `favorites` never reaches the legacy `SearchFormData`.
- **`FavoritesFilter`** — 9 cases including the indeterminate rendering and the click that escapes it, asserted through a real router rather than a navigate spy: a spy passes on a byte-divergent URL, which is the actual failure mode here.
- **End-to-end** (odd-team `IT-148`, re-grounded): every case asserts **narrowing** — a known un-starred asset is *absent* — because asserting only that a starred asset is present passes on `main` too, where the unknown param is dropped and the unfiltered list contains it anyway.

## What was actually run

Every line below is a run on this branch's working tree, not an inference from a green subset.

- **Full unit build** — `:odd-platform-api:build` (test + checkstyle + assemble): **SUCCESSFUL**, 0 checkstyle violations. The 6 favorites cases pass 6/6.
- **Changed-lines coverage** — **14/14 = 100%** against the build's own `jacocoTestReport.xml` (CI gates the changed-lines aggregate at 98%).
- **`IT-148` end-to-end** — **7/7 GREEN** on this branch, **7/7 RED** on `ref:main`. The RED proof earned its keep: it caught one case of mine that asserted only presence and therefore passed on `main` too. That case now uses a never-starred foil.
- **Full four-suite regression** — `feature-complete` **328 passed / 12 failed**, `multi-stack` **14/14**, `ingestion-e2e` **15/15**, `known-bugs` **3 failed** (the intended quarantine RED, with no unexpected GREEN).

**The 12 are pre-existing and every one is accounted for.** Eleven are set-equal, by exact `spec:line`, to an already-tracked whole-class breakage in the e2e suite — specs still waiting on the `GET /api/search/{search_id}/results` endpoint that ST-4 retired. The twelfth is a known order-dependent springdoc case that also appeared in an earlier run on a different branch. None of them touch the favorites path, and the suite is in fact one spec *cleaner* than the tracked ledger: `search-url-facets` ran and passed 4/4 (confirmed executed, not silently dropped).

- **Rendered UI reviewed as a user**, not only as a passing assertion — the toggle in the sidebar, its inline help, and the zero-result state that teaches the star.

## Notes for review

- **`AssetSearchScope` and `FavoritesScopeDto` are deliberately separate.** ST-8's scope keys on the internal **Owner**; this one on the login identity `(oidc_username, provider)`. A user with no Owner association still has favorites — the reason `CurrentUserIdentityResolver` exists beside `AuthIdentityProvider`. Folding them together would conflate two identity models the platform keeps apart.
- **ST-8's two new test files** are adapted to the widened repository signature: the Mockito stubs gain one more `any()`, three direct calls pass `null` (which *is* "no favorites narrowing"). No matcher loosened, no assertion dropped.
- **i18n**: two new keys, translated in all 7 locales. `Favorites`, `Favorites (shared)` and the teaching string already existed and are reused.
- **Saved searches will not capture this filter**, for the same contract reason they do not capture `asset_kinds` today — pre-existing, reported separately.

Docs ride the `release/1.0.0` train and publish with the release, not with this merge.
