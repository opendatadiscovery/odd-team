feat(favorites): frontend — star any asset + main-page panel + Favorites tab (#1815, slice 3/4)

Part of #1815 (slice 3 of 4). Builds on the merged backend slices (#1817 write API, #1819 list
API). It does NOT close the issue — the final slice (S4: docs + the "Asset" term + the housekeeping
orphan sweep) carries the closing keyword.

## What this ships

The Favorites **frontend** — the user-facing half of the feature: star any viewable asset and find
it again without remembering where it lives.

- **`<FavoriteStar>`** — a self-hydrating, optimistic star (gold-filled when favorited, outlined when
  not; `aria-pressed` + the fill-vs-outline shape carry state without relying on colour, WCAG). Wired
  into the **DataEntity, Term and QueryExample detail headers** and the **data-entity search rows**.
- **Main-page Favorites panel** (`Overview`) — the 5 most-recently-favorited assets across all kinds,
  with a "View all" link and a teach-the-star empty state. Rendered for every audience (outside the
  Owner-association gate).
- **Top-level Favorites tab** (`/favorites` + a nav entry after Catalog) — the full list with load-more
  and an **Asset-type facet** (Data Entities / Terms / Query Examples), bound to the list endpoint's
  `asset_types` filter.
- **Redux** — `favorites` slice/thunks/selectors over the generated `FavoriteApi`. Lists batch-hydrate
  their visible rows' favorited status in ONE `getFavoriteStatus` call (the slice resolves asked→false
  fill-unknowns, so a hydrate in flight never clobbers a user's optimistic star/un-star).
- **i18n** — every favorites string in all 7 locales (en/es/fr/ua/hy/ch/br); passes the
  `i18n-key-parity` guard (#1751: en-completeness + catalog parity).

## Verification (the running system, not the diff)

- **Unit:** `tsc` + `eslint` + **`vite build`** GREEN; **vitest** — the favorites slice (incl. the
  batch-hydrate no-clobber case, RED on a naive "asked→false for all") and `FavoriteStar` (aria-pressed
  render + optimistic click) — **9/9 GREEN**. (The suite's one unrelated RED — `LinkedTermsList.tsx:63`,
  an i18n-parity offender pre-existing on `main` since #1798 — is tracked separately; this PR adds zero
  new failures.)
- **Integration (e2e):** a new Playwright test (odd-team IT-148) drives the full loop on a real ingested
  asset — star from the header → it appears on the main panel + the `/favorites` tab → un-star → it is
  gone. GREEN on this branch; RED-by-construction on `main` (the backend is merged but there is no star
  affordance / panel / tab there yet). Full regression GREEN-for-change: feature-complete **321 passed /
  0 failed** (incl. IT-148 + the dataset-structure specs), multi-stack 9/9, ingestion-e2e 15/15,
  known-bugs 3-failed = the expected-RED pins. Pixel-reviewed on the running SUT (panel, tab, facet,
  detail-header star, empty state).

## Scope (bounded — G-C5)

- **In:** the favorites frontend only.
- **Out (later slices):** no backend change; S4 owns the user docs + the "Asset" term in main-concepts
  + the housekeeping orphan sweep + the ontology refresh. Recently-Viewed is the sibling issue.

Milestone: 1.0.0
Docs: documentation@release/1.0.0 — the favorites user docs publish with the 1.0.0 release (slice S4).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
