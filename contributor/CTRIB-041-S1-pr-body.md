## Recently Viewed — backend foundation (slice 1 of 2)

Part of #1816.

Adds the **recency-tracking backend foundation** for Recently Viewed, reusing the merged Favorites
foundation (#1815). Per the refined scope on #1816, this delivers the foundation + (in slice 2) a
home panel; the standalone tab is superseded by the unified Search recency filter (#1825), to which
this slice's read API is the data source.

### What this slice adds
- **API** (`/api/recently-viewed`): `POST /{asset_kind}/{asset_id}` (record-on-open — a deliberate
  signal, never a side effect of the asset GET), `DELETE /{asset_kind}/{asset_id}` (per-row remove),
  `POST /status` (batch: which of these assets the user has recently viewed + when), and
  `GET /list` (most-recent-first, `asset_types` + page/size + `viewed_after`/`viewed_before` date
  bounds, modelled on the Activity date filter for the future Search recency filter).
- **Persistence**: migration `V0_0_95` — `recently_viewed(oidc_username, provider, asset_kind,
  asset_id, last_viewed_at)`, a unique key (the move-to-top UPSERT target) + a `last_viewed_at`
  index; UTC; hard delete; no FK (visibility inherited on read).
- **Identity & privacy**: identity is always taken from the security context (never a request
  parameter) via the existing `CurrentUserIdentityResolver`, so a user records, reads, and removes
  **only their own** history; under `auth.type=DISABLED` it is a single shared instance-wide bucket.
- **Retention**: `RecentlyViewedHousekeepingJob` (delete older than `housekeeping.ttl.recently_viewed_days`,
  default 90 + trim to the newest `recently_viewed_max_per_user`, default 200) — auto-registered on
  the existing housekeeping schedule so the table can't grow unbounded.
- **Reuse, not duplication**: the polymorphic `(asset_kind, asset_id)` → renderable-asset resolution
  (order-preserving, visibility-inheriting) is generalised into a shared `AssetRefResolver`; the
  existing `FavoriteAssetResolver` becomes a thin adapter over it (favorites behaviour unchanged).

### Scope (this slice does NOT include)
- The frontend (the record-on-open hook, the home Recently-Viewed panel, the per-row recency value +
  remove control on detail/list surfaces) → **slice 2**.
- The standalone Recently-Viewed tab + its facet sidebar, and the recency date-filter UI →
  superseded by the Search overhaul (#1825); this slice ships the read API it consumes.

### Verification
- **Unit / CI replica** (`:odd-platform-api:build`): green — all tests + checkstyle (both source
  sets) + jacoco report + assemble. Changed-file line coverage 100% on the new classes (the shared
  resolver, the recently-viewed service/controller/repository, the housekeeping job). New tests
  include the **principal-scoping** guarantee (a user can delete only their own rows; `DISABLED` acts
  on the shared bucket), the repository UPSERT / ordering / date-window / scoped-remove behaviour, and
  the housekeeping TTL + newest-N trim against a real Postgres.
- **Favorites regression**: the favorites unit suite passes unchanged, and the favorites star→see e2e
  (IT-148 core flow) is green on the built image — the shared-resolver refactor preserves favorites.
- **Full e2e regression** on the image built from this branch: `feature-complete`, `multi-stack`, and
  `ingestion-e2e` green for this change; `known-bugs` at its expected baseline.

Milestone: 1.0.0
Docs: none in this slice — the user-facing Recently Viewed docs ship with the frontend (slice 2) on
the `documentation` `release/1.0.0` train and publish at the 1.0.0 release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
