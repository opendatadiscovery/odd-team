## Recently Viewed — frontend: record-on-open + home panel + cross-surface recency (slice 2 of 2)

Closes #1816.

The Recently Viewed frontend, on the merged backend foundation (#1826). Per the refined scope on #1816,
this completes the **recency-tracking foundation + the home panel + the cross-surface recency marker**; the
standalone tab is superseded by the unified Search recency filter (#1825) and is intentionally not built here.

### What this slice adds
- **Record-on-open**: opening a Data Entity / Glossary Term / Query Example detail page fires the deliberate
  `POST /api/recently-viewed/{kind}/{id}` (a `useRecordRecentlyViewed` hook; fire-and-forget; lookup tables
  ride their `DATA_ENTITY` projection). It is **not** coupled to the entity view-count write.
- **Home panel**: a 5-item **Recently Viewed** panel in the Catalog-Overview Recommended section, beside
  Favorites and Popular — always-visible (no Owner needed), labelled **"Recently Viewed (shared)"** under
  `auth.type=DISABLED`, with a per-row remove control.
- **Cross-surface recency marker**: a "Viewed {when}" value + a remove control on the Data Entity / Term /
  Query Example **detail headers** and on **Search result rows** (beside the favorite star — the established
  affordance position), shown only when the asset is in the user's history (self-hydrated via the batch
  `POST /api/recently-viewed/status`). Removal is principal-scoped server-side.
- **Redux**: a `recentlyViewed` slice/thunks/selectors mirroring favorites; a `recencyByKey` map batch-hydrates
  the cross-surface marker without clobbering a just-recorded value.
- **Reuse, not duplication**: the link/name/id derivation is reused 1:1 from the Favorites lib
  (`RecentlyViewedAsset` is structurally compatible); `RecentlyViewedIcon` already shipped.
- **i18n**: 5 new strings in all 7 locales (en/br/es/fr/ch/ua/hy).

### Scope (deferred, tracked)
- The standalone Recently-Viewed **tab** and a **recency date-filter** → the unified Search overhaul (#1825);
  the backend read API (`GET /api/recently-viewed/list` with `viewed_after`/`viewed_before`, shipped in #1826)
  is the data source that filter will consume.

### Verification
- **Unit FE**: `tsc --noEmit` clean · `eslint` clean · `vitest` green (the `recentlyViewed` slice:
  record / remove / list / batch-hydrate — 6/6).
- **Integration e2e (IT-149)**: open an asset → it is recorded and appears on the home panel; the detail
  header shows the "Viewed …" marker; removing it from the panel drops it (no reload). GREEN on this branch;
  RED on `ref:main` by construction (the frontend is absent there — no record hook, no panel).
- **Full e2e regression** on the image built from this branch: `feature-complete` green-for-change (IT-149
  green; the one unrelated failure is the in-flight Favorites Description-column slice, not in this branch),
  `multi-stack` green, `ingestion-e2e` green, `known-bugs` at its expected baseline.

Milestone: 1.0.0
Docs: documentation@release/1.0.0 — a Recently Viewed feature page + Catalog-Overview panel section
(publishes with the 1.0.0 release).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
