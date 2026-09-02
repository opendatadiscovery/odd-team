Docs for **ST-7 — the Favorites filter** (opendatadiscovery/odd-platform#1841), on the `release/1.0.0` train.

ST-7 retires the bespoke top-level **Favorites** tab and replaces it with a **Favorites** scope in the Catalog search sidebar. Five places across four pages asserted the tab; all of them are corrected, because a page describing a surface we just deleted is worse than no page.

## What changed

- **`favorites.md`** — the frontmatter `description:` (the published `<meta>`/`og:description`, not an internal note), the intro, the home-panel paragraph, and the tab section, which is rewritten as the filter. Adds an admonition telling readers their existing `/favorites` bookmarks still work, because the route now redirects rather than dead-ends.
- **`search.md`** — a new **Favorites** section beside **My data**, and the filter folded into ST-8's "kinds of control" taxonomy as the fourth kind. Records the one real difference between the two personal scopes: **My data hides itself entirely under `auth.type=DISABLED`** because it has no identity to resolve, whereas **favorites fall back to a shared bucket and stay usable** — which is exactly why the control says "Favorites (shared) only" there and carries an information icon spelling out the consequence.
- **`catalog-overview.md`** — the panel's **View all** no longer goes to a tab.
- **`main-concepts.md`** — the Asset concept credited the retired tab's "Asset type" filter; that filter lives on Search.

## One thing deliberately *not* written

**The "most-recently-favorited first" ordering claim is dropped, not carried over.** The tab ordered that way; the search filter does not yet — that arrives in a sibling slice in this same milestone. Publishing the sentence now would make the page wrong, so it goes rather than being quietly deferred. A milestoned backlog item is the hook that forces the 1.0.0 release gate to restore the claim if that slice merges, or confirm its absence if it does not.

## Verification

- All four pages re-parsed with PyYAML after editing — a `: ` inside an unquoted `description:` halts GitBook sync entirely, not merely truncates.
- `favorites.md` description is 162 chars and `search.md` 188, both inside GitBook's 200-char silent-truncation limit.
- Grepped the whole train for residual "Favorites tab" claims: none outside the deliberate "replaced a standalone Favorites tab" sentence.
- Rebased onto `release/1.0.0` after ST-6's docs merged (#111), so ST-8's restructured filter taxonomy is extended rather than overwritten.

Nothing here is published until 1.0.0 ships.
