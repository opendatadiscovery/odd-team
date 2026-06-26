# feat(favorites): backend foundation + write API — Favorites (#1815, slice 1/4)

**Part of #1815** — Favorites. This is **slice 1 of 4** (stacked PRs); this PR does **not** close the issue —
only the final slice does.
It ships the **shared backend foundation** that PRD-0001 Favorites *and* the sibling Recently-Viewed (PLT-250)
reuse: the identity resolver, the polymorphic asset model, the `favorite` persistence, and the idempotent
star/un-star + batch-status write API. No list endpoint and no frontend in this slice (see *Scope*).

Milestone: 1.0.0
Docs: none in this slice — the favorites endpoints have no user-facing surface until the FE slice; the
user-facing docs (Features + the "Asset" term) ride the `documentation@release/1.0.0` train and publish with the
1.0.0 release. The OpenAPI contract (the API SoT) is updated here.

## Why

ODD has no way for a user to pin the assets they care about, and its only personalised main-page surface
("Recommended") renders **only** for users who completed internal Owner association and not at all under
`auth.type=DISABLED`. Favorites is the first purely-personal, ownership-free, navigation-only surface — so it
keys on the **logged-in identity `(oidc_username, provider)`**, never the Owner, and every user gets it. Design +
rationale: PRD-0001 + the foundation ADR (security, performance, the alternatives weighed).

## What changed (this slice)

- **Contract** (`odd-platform-specification`): `AssetKind` (enum: `DATA_ENTITY | TERM | QUERY_EXAMPLE`),
  `AssetRef`, `AssetRefList`; paths `PUT`/`DELETE /api/favorites/{asset_kind}/{asset_id}` (idempotent set-state)
  and `POST /api/favorites/status` (the favorited subset of a batch of refs, for rendering stars on any view).
- **Migration `V0_0_94`**: the `favorite` table — `(oidc_username, provider, asset_kind, asset_id, created_at,
  deleted_at)`, a **full-4-tuple unique index** (the UPSERT/set-state target) and a **partial active-order
  index** `… created_at DESC WHERE deleted_at IS NULL`. No FK to the asset tables (overlapping id-spaces);
  soft-delete via `deleted_at`; UTC timestamps; no `CONCURRENTLY` (new/empty table).
- **`CurrentUserIdentityResolver`** — the single shared identity helper: `getCurrentUser()` →
  `(oidc_username, provider)`, `switchIfEmpty` to the reserved shared sentinel `(__shared__, DISABLED)` for
  `auth.type=DISABLED`. Identity from the security context only — a user can only touch their own bucket.
- **`FavoriteController` / `FavoriteService(+Impl)` / `ReactiveFavoriteRepository(+Impl)`** — the write path:
  star = idempotent UPSERT (`ON CONFLICT … DO UPDATE SET deleted_at = NULL, created_at = now()`); un-star =
  soft-delete; status = an identity-and-refs-scoped batch read. No new RBAC policy type — the endpoints inherit
  the existing `pathMatchers("/**").authenticated()` (authenticated-only under LOGIN_FORM/OAUTH2; the sentinel
  bucket under DISABLED).

## Key decisions (foundation ADR)

- **Identity = `(oidc_username, provider)` from context, never the Owner** — every user (incl. no-Owner) gets it;
  `provider` disambiguates cross-mode username collisions (the `V0_0_92` / GHSA-8wf2 lesson).
- **`AssetKind` = 3 kinds; `LOOKUP_TABLE` folds into `DATA_ENTITY`** — a lookup table's catalog identity *is* its
  `data_entity` projection (`lookup_tables.data_entity_id FK → data_entity(id)`, `V0_0_86`), so it is favorited
  as a `DATA_ENTITY`.
- **Set-state, not flip** — `PUT`/`DELETE` + the unique constraint are race-safe on double-click (a read-then-flip
  is not).
- **No title denormalization** (forward decision realised in the list slice): the row stores only
  `(asset_kind, asset_id)`; titles/visibility resolve by semi-joining each kind's existing query.

## Scope

**In:** the contract, the migration, the identity resolver, the persistence, `PUT`/`DELETE`/`POST status`, unit +
integration tests.
**Out (deliberate — later slices):** `GET /api/favorites/list` + facets (slice 2); `<FavoriteStar>`, the
main-page panel, the Favorites tab + Asset-type facet, i18n (slice 3); docs + the "Asset" term + the housekeeping
orphan sweep + the ontology refresh (slice 4); **Recently-Viewed** (PLT-250).

## Tests & verification

- **Unit (odd-platform CI):** `CurrentUserIdentityResolverTest` (authenticated tuple + DISABLED sentinel),
  `FavoriteServiceImplTest` (identity-from-context, set-state, the favorited subset, empty-input short-circuit),
  `FavoriteControllerTest` (204 / 200 delegation).
- **Integration (Testcontainers Postgres):** `ReactiveFavoriteRepositoryImplTest` — the real UPSERT set-state,
  soft-delete + reactivation, idempotent un-star, and the identity-and-refs-scoped batch read. The R2DBC query
  log confirms the actual SQL (`ON CONFLICT … DO UPDATE`, `deleted_at is null` guards).
- **Full `:odd-platform-api:build`** (test + checkstyle + assemble + jacoco): _recorded in CTRIB-039 ledger._
- **Full integration regression** (working-tree SUT, all suites): _recorded in CTRIB-039 ledger._

## Consumer-read (the code each runtime claim was checked against)

- `auth/AuthIdentityProviderImpl.java:30-41,56-59` — `(username, provider)` identity vs. the separate Owner lookup.
- `config/DisabledAuthSecurityConfiguration.java`, `auth/authorization/AuthorizationCustomizer.java:29-30`,
  `config/LoginFormSecurityConfiguration.java:57` — the authz catch-all (`/**` authenticated; DISABLED permitAll).
- `db/migration/V0_0_86__…:8,13` + `service/ReferenceDataServiceImpl.java:104` — `lookup_tables.data_entity_id`
  FK ⇒ the `LOOKUP_TABLE`-folds-into-`DATA_ENTITY` decision.
- `repository/reactive/ReactiveTagRepositoryImpl.java` + `…/util/JooqReactiveOperations.java` — the JOOQ reactive
  write/upsert pattern conformed to.
- `db/migration/V0_0_89__…`, `V0_0_92__…` — soft-delete + partial-unique convention; the provider-tuple identity.

## Sources

`prds/0001-favorites-and-recently-viewed.md` (PRD-0001) · `adrs/drafts/favorites-recently-viewed-foundation.md`
(foundation ADR, D1–D8) · odd-platform `main @ f12b8fbc`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
