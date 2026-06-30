## ST-1a — parametrised search URL (`?q=`)

`Part of #1825` (the unified-search overhaul). **Slice ST-1a** — does **not** close the epic.

The main search's **query** lives in the URL as `?q=`, so a search is a **stable, shareable, bookmarkable** link and the browser **back/forward** buttons navigate query states. The canonical `/search?q=<query>` form replaces the expiring `/search/{sessionId}` share handle — retiring the `#1760` "search session expired" dead-link class. Legacy `/search/{sessionId}` deep-links keep loading (no breaking change). Facets stay slice-internal for now (the ST-1b fast-follow). Realises ADR D10 (search state in the URL) under D9 (no breaking change).

### Change (frontend only — 6 files)
- **`lib/search/searchUrlState.ts`** (new) — `q` (de)serialisers; fail-closed on unknown/malformed params; facet-additive-ready (reuses `query-string`).
- **`lib/hooks/useQueryParams.ts`** — optional `{ pathname, replace }` on `setQueryParams` (backward-compatible; the ~37 existing callers pass neither).
- **`components/shared/elements/MainSearchInput/MainSearchInput.tsx`** — both entry points (home hero + the search-page box) navigate to the canonical `/search?q=` (push) — the sole URL writer.
- **`components/Search/Search.tsx`** — URL-read-only: one fresh session per visit, updated when the URL query changes (a new committed query, or back/forward); the legacy `/search/{sessionId}` deep-link branch is preserved; dissolves the old "Enter before the session exists" race.

### Scope exclusions
Facets-in-URL (ST-1b), the `sort` param (ST-2), saved searches (ST-3), cross-kind search (ST-4) are **not** in this PR. The tag/class/Catalog-tab navigations are deliberately unchanged (they keep the legacy path).

### Tests — RED on `main`, GREEN on this branch
- **Unit (vitest):** `searchUrlState` round-trip + fail-closed; `useQueryParams` pathname-override + replace — 9/9.
- **e2e:** **new IT-150** (`/search?q=` URL, share/bookmark in a fresh context, back/forward, unknown-params fail-closed); IT-022 / IT-125 / IT-149 updated to the `?q=` contract (each still RED on `main`).
- **Full regression** green-for-change (feature-complete · multi-stack · ingestion-e2e; known-bugs expected-RED).

### Notes
- **Milestone:** 1.0.0
- **Docs:** `documentation@release/1.0.0` — `data-discovery/search.md` rewritten from the `/search/{id}`-session caveat to the shareable `/search?q=` model; publishes with the 1.0.0 release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
