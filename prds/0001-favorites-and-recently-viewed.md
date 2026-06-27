# PRD-0001 — Favorites & Recently Viewed

| | |
|---|---|
| **Status** | Draft for review → becomes 2 GitHub issues |
| **Target** | odd-platform **release 1.0.0** (first "real feature" release) |
| **Repos** | `odd-platform` (code), `documentation` (release-train gated), `odd-team` (ontology) |
| **Author** | ODD Team (maintainer) |
| **Date** | 2026-06-26 |
| **Consultations** | Product/SME — `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md`; SRE/Security — session note 2026-06-26 (folded into §6/§7 below); **post-S3 PO+SRE critique** — `lineage/odd-platform/sme-consultations/2026-06-27-favorites-s3-po-sre-critique.md` (→ completion spec **PRD-0002**) |
| **Splits into** | **Issue A — Favorites** (§9) → draft `issues/odd-platform/PLT-249.md` · **Issue B — Recently Viewed** (§10) → draft `issues/odd-platform/PLT-250.md`. Both ride a **shared foundation** (§5) built once in PLT-249; PLT-250 depends on PLT-249. |

---

## 1. Summary

Add two personal navigation aids so users reach the assets they care about in one click instead of re-searching:

- **Favorites** — a user *stars* any asset (gold star toggle); the starred set is listed newest-first and is removable.
- **Recently Viewed** — assets the user opened, most-recent-first, removable.

Each surfaces in two places: a **5-item panel on the main page** (`Overview`) with a **"View all"** link, and a **new top-level tab** with **facet filters** (Namespace, Datasource, Tag, Owner, **Asset type** — multi-select, default *All*) and the same ordering.

Both are **per-user** (keyed on the logged-in identity, **not** the internal Owner), so even users without an Owner association get them. When authentication is **DISABLED** (no principal at all), both fall back to a single **shared instance-wide bucket**.

The two features are deliberately specified together because they share ~70% of their machinery (identity resolution, the polymorphic-asset model, the facet+list endpoint shape, the main-page panel slot, the top-nav tab). Build the shared foundation once; the two issues are the two distinct user-facing capabilities on top of it.

---

## 2. Problem & motivation

ODD's main page personalises **only** through the "Recommended" block (`odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerEntitiesList.tsx` — "My Objects / Upstream / Downstream / Popular"), which renders **only when the user has an associated internal Owner** *and* `auth.type != DISABLED` (`Overview.tsx:25-27,53-59`). That leaves three gaps:

1. **No personalisation without an Owner.** A user who has not completed (or cannot complete) owner association sees no personal surface at all.
2. **No way to pin an asset.** "Popular" is a *global* `VIEW_COUNT DESC` list shared by everyone (`ReactiveDataEntityRepositoryImpl.java:633`); there is no per-user "things I chose to keep."
3. **No history.** A user who opened a dataset yesterday must re-search for it today.

These are table-stakes for data-catalog products and a natural first "real feature" for 1.0.0. They are **purely personal, ownership-free, navigation-only** surfaces — a cell **no existing ODD concept occupies** (see §4 anti-duplication).

---

## 3. Goals / Non-goals

**Goals**
- Star / un-star any viewable asset; see favorites as a 5-item panel + a filterable tab.
- Auto-record opened assets; see them as a 5-item panel + a filterable tab; remove individual entries.
- Work for **every** user regardless of Owner association; degrade to a shared bucket under DISABLED auth.
- Span **all** viewable asset kinds: Data Entities (incl. Lookup Tables), Glossary Terms, Query Examples, Lookup Tables.
- Reuse existing patterns (facet search, `getAlertsList` list shape, housekeeping jobs, `StarIcon`) — minimal net-new surface.

**Non-goals (1.0.0)**
- Notifications/subscriptions on favorited assets (that is Alerts; keep Favorites pure navigation — DataHub's "Subscribe Me" is explicitly *not* a favorite).
- Sharing favorites between users / team favorites.
- A new RBAC policy type for favorites (none needed — §6.1).
- Favoriting *sub-objects* (dataset fields, columns) — asset-level only.
- "Recently edited / recently created" feeds — only "recently **viewed**".

---

## 4. Users, audiences & anti-duplication

### Audience scenarios (drive placement & labelling)

| Scenario | Identity | Favorites / Recently-Viewed scope | Main-page panel order |
|---|---|---|---|
| **A. `auth.type=DISABLED`** | none (`permitAll`, no principal — `DisabledAuthSecurityConfiguration.java:14-17`) | **single shared bucket** (instance-wide) | Search → Favorites *(shared)* → Recently Viewed *(shared)* → Directory/browse |
| **B. Logged-in, no Owner** | `(oidc_username, provider)` | per-user | Search → Favorites → Recently Viewed → Directory/browse |
| **C. Logged-in, with Owner** | `(oidc_username, provider)` | per-user | Search → **Favorites → Recently Viewed** → Recommended/"My Objects" → Directory/browse |

Scenario **C** realises the explicit requirement: *Favorites and Recently-Viewed sit **before** the "My Objects"/Recommended block.* Scenario **B** is the strongest justification for the feature — these two panels are the **only** personalisation that audience can get today.

### Anti-duplication (Gate 1 / Cornerstone — verified against existing concepts)

> **Every existing ODD concept is shared, ownership-bound, or notification-shaped. Favorites & Recently-Viewed are ODD's first purely-personal, ownership-free, navigation-only surfaces — which is exactly why they key on the logged-in user, not the Owner.**

| Existing concept | How it differs from Favorites/Recently-Viewed |
|---|---|
| **My Objects / Ownership** (`user_owner_mapping`) | Stewardship; requires an Owner. Favorites needs no Owner and implies no responsibility. |
| **Alerts / subscriptions** | Push/notification on state change. Favorites/Recently are pull/navigation, no notifications. |
| **Tags** | Shared, governed taxonomy + global facet. Favorites are private and create no shared facet. |
| **Data Entity Groups** | Shared catalog object with lineage. Favorites create no object and no lineage. |
| **Popular** (`VIEW_COUNT DESC`) | Global, shared across all users. Favorites/Recently are personal. |

---

## 5. Shared foundation (build once — both issues depend on it)

### 5.1 Identity model — the load-bearing decision

Favorites and Recently-Viewed key on the **user identity tuple `(oidc_username, provider)`**, resolved from the security context — **never** the internal Owner.

- `AuthIdentityProviderImpl.getCurrentUser()` returns `UserDto(username, provider)` from `ReactiveSecurityContextHolder` (`auth/AuthIdentityProviderImpl.java:30-41`). This is the existing, canonical "who is the logged-in user" resolver.
- The `provider` component is **mandatory** for correctness: under OAUTH2 it is the client-registration-id; under LOGIN_FORM/LDAP it is the literal mode; under DISABLED there is no persisted login. Keying on `username` alone collapses two different people who share a username across modes onto the same bucket — this is the exact bug the `user_owner_mapping` provider backfill fixed (`db/migration/V0_0_92__backfill_user_owner_mapping_provider.sql`, GHSA-8wf2-7c5g-h59v / PLT-120). **Mirror that model: always the full `(oidc_username, provider)` tuple.**
- **DISABLED fallback:** `getCurrentUser()` emits *empty* (no security context). The identity resolver used by these endpoints must `switchIfEmpty` to a reserved sentinel **`(oidc_username='__shared__', provider='DISABLED')`**. V0_0_92 confirms DISABLED never persists a real login, so the literal `'DISABLED'` provider cannot collide with a real user. No seed row is required — the sentinel is purely a write-time key.
- **Identity is always taken from the security context, never from a request parameter** — so no user can read or write another user's bucket.

> Provide one small reusable helper (e.g. `CurrentUserIdentityResolver.resolve(): Mono<UserIdentity>` with the `switchIfEmpty` sentinel) used by **both** features' services. This is the single most important shared component.

### 5.2 Polymorphic asset model

An "asset" is one of **four viewable kinds**, each with its own table, id-space, and UI surface:

| Asset kind (enum) | Backend | UI surface | Carries namespace/datasource? | Carries tags/owners? |
|---|---|---|---|---|
| `DATA_ENTITY` | `DataEntityController` (types incl. `LOOKUP_TABLE`) | DataEntityDetails | yes | yes |
| `TERM` | `TermController` | Terms | namespace yes / datasource no | yes |
| `QUERY_EXAMPLE` | `QueryExampleController` | DataModelling → QueryExampleDetails | no | limited |
| `LOOKUP_TABLE` | `ReferenceDataController` | MasterData → LookupTables | via backing data entity | via backing data entity |

**Critical:** the four kinds use **independent `bigserial` sequences** (`data_entity`, `term`, `query_example`, reference-data tables created in `V0_0_84`, `V0_0_86`, etc.). **Asset ids collide across kinds.** Therefore every reference is the **pair `(asset_kind, asset_id)`** — never `asset_id` alone.

> **Design-time confirmation (flagged, not punted):** a Lookup Table is *also* a `DATA_ENTITY` of type `LOOKUP_TABLE`. Confirm during implementation whether the favoritable/viewable Lookup Table id is the reference-data row id or its `data_entity` projection id — read `ReferenceDataController` + `V0_0_86__create_schema_and_tables_for_custom_tables.sql`. Pick one id-space and document it on the `AssetKind` enum. (If a Lookup Table is *only* ever surfaced via its data-entity projection, `LOOKUP_TABLE` may fold into `DATA_ENTITY` and the enum drops to three kinds.)

### 5.3 List endpoint shape (mirror `getAlertsList`)

Both tabs are a faceted, ordered, paginated list — structurally identical to the existing `/api/alerts/list` (`openapi.yaml:2743`, ordered desc, ViewType + facets + page/size). Mirror it:

```
GET /api/favorites/list
GET /api/recently-viewed/list
  query params (all optional, multi-select where noted):
    asset_types   : AssetKind[]   (multi; default = all kinds)
    namespace_ids : int64[]       (multi)
    datasource_ids: int64[]       (multi)
    tag_ids       : int64[]       (multi)
    owner_ids     : int64[]       (multi)
    page, size                    (size capped server-side — see §7)
  ordering: favorites  → favorited_at DESC
            recently   → last_viewed_at DESC
  response: AssetRef[]  (polymorphic — discriminator + per-kind ref payload)
```

The 5-item main-page panels call the same endpoint with `size=5` (mirrors `OwnerEntitiesList` `{page:1,size:5}` at `OwnerEntitiesList.tsx:59`).

**Facet semantics across kinds:** namespace/datasource/tag/owner are Data-Entity-native; Terms carry namespace + owners; Query Examples carry neither namespace nor datasource. When a facet that a kind does not carry is selected, that kind is excluded from results for that query. The **Asset-type** facet is the primary cross-kind filter and is always meaningful.

### 5.4 Visibility & "no title denormalization" (see §6.1)

The list endpoints **must not store the asset's title/metadata** in the favorite/recent row. Titles are resolved live by **semi-joining `(asset_kind, asset_id)` back onto each kind's existing list/detail query**, so the canonical lifecycle-visibility predicate is inherited automatically (`STATUS != DELETED` + `HOLLOW = false` for data entities — `ReactiveDataEntityRepositoryImpl.java:244,445-447`; `deleted_at IS NULL` for Terms/Query Examples). A favorited asset that is later soft-deleted simply **drops out of the list** (LEFT JOIN yields no row). This also means the lists automatically benefit from any future platform-wide read ACL.

### 5.5 Main-page panel component

A reusable panel (title, `StarIcon`/clock icon, up to 5 rows, "View all →" link, slim empty-state) inserted into `Overview.tsx` **above** the `OwnerAssociation` block and **outside** its `isShowOwnerAssociation` / `DIRECT_OWNER_SYNC` gating, so it renders in all three audience scenarios. Empty-states teach: Favorites → *"Star an asset to pin it here"*; Recently → *"Assets you open will appear here."* Render the panels **even when empty** (empty Favorites teaches the star).

### 5.6 Top-nav tab + filter layout

Two new top-level entries via `AppMenuItem` ("Favorites", "Recently Viewed") + new route files (`favoritesRoutes.ts`, `recentlyViewedRoutes.ts`). Each tab page reuses the Search/Alerts list+filter layout: left **facet sidebar** reusing existing `components/Search/Filters/*` (Datasource, Namespace, Owner, Tag) **plus a new Asset-type multi-select**; right = results list with the shared row renderer.

### 5.7 The "Asset type" facet — vocabulary decision

ODD's published vocabulary does **not** define the word **"Asset"**, and the live faceted search already has a **"Type"** facet (data-entity types). Introducing "Asset type" is therefore a **deliberate vocabulary addition**, not a free label.

**Recommendation:** adopt **"Asset"** as the umbrella noun for the polymorphic union and **log it in `documentation/docs/main-concepts.md` Terms & Aliases** (doc Gate 2). Present the facet as a grouped multi-select, default *All*:

- **Data Entities** — refine by Entity Class using existing labels (Datasets, Transformers, Quality Tests, Consumers, Inputs, Groups, Relationships)
- **Glossary Terms**
- **Query Examples**
- **Lookup Tables**

This keeps the new facet conceptually distinct from the data-entity-only "Type" facet (it operates on the whole union) while staying in ODD's real nouns. *(Alternative considered: extend the existing "Type" facet to span the union with entity-class nested — rejected because it overloads a shipped, documented facet and muddies its meaning on the existing Search page.)*

---

## 6. Security & privacy (SRE consultation)

### 6.1 Authorization — there is **no per-asset read RBAC** today
Verified: all `SECURITY_RULES` are *mutations*; reads fall through to `.pathMatchers("/**").authenticated()` (`auth/authorization/AuthorizationCustomizer.java:29-30`; `config/LoginFormSecurityConfiguration.java:57`). So any authenticated user can already read any asset — the lists cannot leak anything reads don't already expose. **Rules:**
- Both features are **authenticated-only**; identity from the security context, never a request param.
- **No new policy/permission type** (no `FAVORITE` in `PolicyPermissionDto`) — consistent with the existing model.
- Inherit visibility by **reusing each kind's existing list/detail query** (§5.4); **never denormalize titles** (stale data that also bypasses the visibility filter).

### 6.2 Privacy of view history (PII-adjacent)
Recently-Viewed is effectively a per-user browsing history; `username` is frequently an email (`AuthIdentityProviderImpl.java:34`). Requirements:
- **Principal-scoped reads only** — a user reads only their own `(username, provider)` rows. ODD's read-collaborative posture must **not** extend to browsing history.
- **Erasure:** ship a **"Clear all" / clear-history** capability and an operator-side erase for a `(username, provider)`, hooked onto the existing owner-mapping deletion path (`DELETE /api/owners/mapping/{owner_id}`). Apply a **TTL** (§7.4).
- **Owner disassociation / re-association:** keying on `(username, provider)` (never `owner_id`) means favorites/history survive owner changes correctly.

### 6.3 DISABLED shared bucket — product-honesty, not new leakage
The shared bucket exposes no data the anonymous catalog + Popular don't already expose, so it is **not** a new security hole — but a personal-looking "Favorites/Recently Viewed" presented to everyone is misleading. Mitigations:
- Label **non-possessively** — "Favorites", never "My Favorites"; **"Recently Viewed (shared)"** with a subtext that the bucket is shared across everyone on this instance.
- Provide a config flag `recently-viewed.enabled` (**defaults on** — §11.2) so an operator can *hide* the shared history surface, plus a docs admonition (LSN-001/LSN-002 caveat class).

### 6.4 Input hardening
- **Cap `size` server-side** (~100). `SizeParam` has **no `maximum`** in the spec (`components.yaml` SizeParam) → unbounded page size is a DoS lever.
- CSRF is disabled globally in the existing chains; the new `PUT`/`DELETE`/`POST` endpoints inherit that posture (no change, just noted).

---

## 7. Performance, reliability & data lifecycle (SRE consultation)

### 7.1 Write path — record-on-open is the hot path
- **Do NOT record a view as an implicit side-effect of `GET /api/dataentities/{id}`.** That endpoint is already hit by panels, lineage expansion, polling and prefetch, and already carries the `incrementViewCount` write (`ReactiveDataEntityRepositoryImpl.java:174-178`). Widening its side-effects compounds a known hotspot and would mis-count machine traffic.
- Record from a **deliberate signal**: `POST /api/recently-viewed {asset_kind, asset_id}` fired by the frontend when a **detail page opens** (the same user-intent as the existing view-count), debounced/deduped client-side. This also uniformly covers Terms / Query Examples / Lookup Tables, which have no `view_count`.
- Backend write is **fire-and-forget**: the response is never gated on it. **Resolve `(username, provider)` inside the request chain first, then hand the value to the async writer** — a bare `.subscribe()` loses the Reactor security context and drops the principal. Never block the event loop (WebFlux/R2DBC); the only `.block()` calls in the codebase are on `@Scheduled` threads, never the request path.
- The write is an **idempotent UPSERT**: `INSERT … ON CONFLICT (oidc_username, provider, asset_kind, asset_id) DO UPDATE SET last_viewed_at = now()` — move-to-top with no append/dedup churn.

### 7.2 Read path — faceted polymorphic list
- **Order and paginate on the favorite/recent row's indexed timestamp first**, then **semi-join** the page of `(asset_kind, asset_id)` onto each kind's existing list query (`WHERE de.id IN (…)`), reusing its visibility filter, facet joins and indexes. This keeps `LIMIT` index-driven and avoids a 4-way polymorphic UNION that can't use an index for `ORDER BY ts DESC LIMIT n`.
- **Reject write-time facet denormalization** (caching tags/owner/namespace on the favorite row) — it drifts the moment the asset is re-tagged/re-owned.
- Verify a reverse index exists on `tag_to_data_entity (data_entity_id, tag_id)` (PK is `(tag_id, data_entity_id)`) before relying on tag-facet filtering at scale.

### 7.3 Concurrency & multi-instance
- Model the star as **idempotent set-state, not a flip**: `PUT /api/favorites/{asset_kind}/{asset_id}` (ensure-present) and `DELETE …` (ensure-absent). A read-then-flip races on double-click; set-state + the unique constraint are race-safe.
- No per-instance in-memory state. Background jobs use the existing **ShedLock** guard (`SchedulingConfiguration.java`, `HousekeepingJobManager.java`) for multi-instance safety.

### 7.4 Data growth, retention & orphans
- **`recently_viewed` grows unbounded** without a cap. Add a `RecentlyViewedHousekeepingJob implements HousekeepingJob` following the existing pattern (`housekeeping/HousekeepingJobManager.java`, `@ConditionalOnProperty("housekeeping.enabled")`, `@Scheduled`, `@SchedulerLock`): trim to newest **N per user** and delete rows older than **`housekeeping.ttl.recently_viewed_days`** (~90). Add the field to `housekeeping/config/HousekeepingTTLProperties.java` + `application.yml:170`. **Favorites: no TTL** (curated), but include in orphan purge.
- **Hard-deleted assets become orphans.** `DataEntityHousekeepingJob` HARD-deletes `data_entity` rows after `housekeeping.ttl.*` days; no FK cascade is possible across four overlapping id-spaces. Handle via **filter-on-read** (the semi-join drops unresolved ids) **plus** a periodic orphan sweep in the housekeeping job, and (optionally) a purge hook in the data-entity delete path.

### 7.5 Migrations
- Next migration is **`V0_0_94`** (latest is `V0_0_93`). One migration adds both tables + indexes.
- `CREATE TABLE/INDEX IF NOT EXISTS`; **no `CREATE INDEX CONCURRENTLY`** (Flyway runs each migration in a transaction; the tables are new/empty so in-txn index builds are instant).
- Soft-delete via `deleted_at` + partial unique index `WHERE deleted_at IS NULL` per the `V0_0_89` convention; `timestamp without time zone` stored at UTC (per `V0_0_75`).
- **No FK** to asset tables (polymorphic + heterogeneous delete semantics — integrity via filter-on-read + housekeeping). **No seed row** needed for the DISABLED sentinel.

### 7.6 Data model (proposed)

```sql
-- V0_0_94__create_favorite_and_recently_viewed.sql  (UTC timestamps, no FK to asset tables)

CREATE TABLE IF NOT EXISTS favorite (
    id            bigserial PRIMARY KEY,
    oidc_username varchar(512) NOT NULL,
    provider      varchar(255) NOT NULL,
    asset_kind    varchar(64)  NOT NULL,          -- DATA_ENTITY | TERM | QUERY_EXAMPLE | LOOKUP_TABLE
    asset_id      bigint       NOT NULL,
    created_at    timestamp without time zone NOT NULL DEFAULT (now() at time zone 'UTC'),
    deleted_at    timestamp without time zone DEFAULT NULL
);
-- one logical favorite per (user, asset); set-state via UPSERT toggling deleted_at
CREATE UNIQUE INDEX IF NOT EXISTS favorite_identity_asset_key
    ON favorite (oidc_username, provider, asset_kind, asset_id);
-- ordering for list + panel (newest active first)
CREATE INDEX IF NOT EXISTS favorite_identity_created_active_idx
    ON favorite (oidc_username, provider, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS recently_viewed (
    id             bigserial PRIMARY KEY,
    oidc_username  varchar(512) NOT NULL,
    provider       varchar(255) NOT NULL,
    asset_kind     varchar(64)  NOT NULL,
    asset_id       bigint       NOT NULL,
    last_viewed_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'UTC'),
    CONSTRAINT recently_viewed_identity_asset_key
        UNIQUE (oidc_username, provider, asset_kind, asset_id)   -- UPSERT target (move-to-top)
);
CREATE INDEX IF NOT EXISTS recently_viewed_identity_ts_idx
    ON recently_viewed (oidc_username, provider, last_viewed_at DESC);
```

- **Favorites un-star** = `UPDATE … SET deleted_at = now()`; **re-star** = `… ON CONFLICT DO UPDATE SET deleted_at = NULL, created_at = now()` (idempotent set-state, §7.3).
- **Recently-viewed remove** = hard `DELETE` (cold path, user-initiated); growth is bounded by the housekeeping cap/TTL, not by remove.

---

## 8. Cross-cutting impact checklist (Gate 0)

| Area | Change |
|---|---|
| **OpenAPI** | `odd-platform-specification/openapi.yaml` (new paths) + `components.yaml` (schemas: `AssetKind` enum, `AssetRef` polymorphic, `FavoriteList`/`RecentlyViewedList`, `FavoriteStatusRequest/Response`; **add `maximum` to `SizeParam`** or cap in code). |
| **Generated clients** | Regenerate **both** Java (`odd-platform-api-contract`) and TS (`odd-platform-ui/src/generated-sources`). |
| **Backend** | `FavoriteController/Service(+Impl)/Repository(+Impl)`, `RecentlyViewedController/Service(+Impl)/Repository(+Impl)`, mappers, **JOOQ regen after migration**, the shared `CurrentUserIdentityResolver`, `RecentlyViewedHousekeepingJob`, `HousekeepingTTLProperties` field, `application.yml` keys. |
| **Migration** | `V0_0_94` (§7.6). |
| **Frontend** | Redux slices/thunks/selectors (`favorites`, `recentlyViewed`); shared `<FavoriteStar>` (reuse `StarIcon`, filled/outline + `aria-pressed`); main-page panels (§5.5); two tab pages + facet sidebar + `AssetType` multi-select; routes; two `AppMenuItem` nav entries; recently-viewed `POST` signal hook on detail-page open. |
| **i18n** | New strings in **all six locales** (`en/es/fr/ua/hy/ch`) — `odd-platform-ui/src/locales/translations/*` (per the i18n domain). |
| **Permissions** | **None new** — authenticated-only, identity from context. |
| **Activity log** | **Out of scope** — favoriting/viewing are personal, not audit-worthy entity changes (note explicitly so a reviewer doesn't flag the omission). |
| **Docs** | Release-train gated → `documentation` `release/1.0.0` branch: new `Features.md` sections; **log "Asset" in `main-concepts.md` Terms & Aliases**; live-site verify at the release gate. |
| **Ontology** | After implementation: refresh `lineage/odd-platform` (feature-flows, concepts — add "Favorite", "Recently Viewed", "Asset"). |

---

## 9. Issue A — Favorites *(paste-ready)*

**Title:** `Favorites: star/un-star any asset, with a main-page panel and a filterable top-level tab`

**Context.** First personalisation surface for release 1.0.0. Lets any logged-in user (and, under DISABLED auth, the shared instance) pin assets for one-click return. **This issue ships first and builds the shared foundation in PRD-0001 §5** (identity resolver with DISABLED sentinel, polymorphic `(asset_kind, asset_id)` model, `getAlertsList`-shaped list endpoint, reusable main-page panel slot, top-nav tab + facet sidebar, the `AssetType` facet + "Asset" term) — Issue B (Recently Viewed) depends on it.

**User stories.**
- As a user, I can click a star on any asset (list row or detail header) to add it to my Favorites; the star turns gold. Clicking again removes it.
- As a user, I see my 5 most-recently-favorited assets on the main page with a "View all" link.
- As a user, on the Favorites tab I can filter by Namespace, Datasource, Tag, Owner and Asset type (multi-select, default All), ordered newest-favorited first.

**Scope (in).** Star toggle on data-entity / term / query-example / lookup-table rows **and** detail headers; `PUT`/`DELETE /api/favorites/{asset_kind}/{asset_id}` (idempotent set-state); `GET /api/favorites/list` (facets + page/size, `favorited_at DESC`); batch `POST /api/favorites/status` (which of these asset refs are favorited, to render stars on any view); main-page panel; Favorites top-level tab + facet sidebar; `favorite` table + indexes (§7.6); orphan purge in housekeeping; i18n (6 locales); docs + "Asset" term.

**Scope (out).** Notifications on favorites; shared/team favorites; favoriting sub-objects; Recently-Viewed (Issue B).

**UX.** `<FavoriteStar>` — gold filled when favorited, outline when not (**not colour-alone** — WCAG), `aria-pressed` + state-reflecting `aria-label`; optimistic toggle with rollback + toast on failure. Under DISABLED, label "Favorites" (non-possessive).

**Acceptance criteria.**
- [ ] Star toggles persist across reload and across instances (multi-instance safe; idempotent under double-click).
- [ ] Favorites are per-`(oidc_username, provider)`; a user never sees another user's favorites; DISABLED uses the shared sentinel bucket.
- [ ] List & panel exclude soft/hard-deleted assets automatically (filter-on-read; no denormalized titles).
- [ ] All four asset kinds are favoritable and filterable; Asset-type facet defaults to All and is multi-select.
- [ ] `size` is capped server-side; identity is taken from the security context only (no request-param identity).
- [ ] Strings present in all six locales; `Features.md` + `main-concepts.md` updated on `release/1.0.0`; live-site verified at the release gate.

**Security/Perf.** §6, §7. No new permission type. Read-path semi-join (no denormalization); no event-loop blocking.

---

## 10. Issue B — Recently Viewed *(paste-ready)*

**Title:** `Recently Viewed: per-user recently-opened assets, with a main-page panel and a filterable top-level tab`

**Context.** Companion to Favorites (PRD-0001) sharing the same foundation (§5). Auto-captures the assets a user opens so they can return without re-searching. **Depends on Issue A** (Favorites ships the shared foundation: identity resolver, polymorphic asset model, `getAlertsList`-shaped list endpoint, main-page panel slot, top-nav tab + facet sidebar, Asset-type facet).

**User stories.**
- As a user, when I open an asset's detail page it is recorded as recently viewed (deduped — re-opening moves it to the top).
- As a user, I see my 5 most-recently-viewed assets on the main page with a "View all" link.
- As a user, on the Recently Viewed tab I can filter by Namespace, Datasource, Tag, Owner and Asset type (multi-select, default All), ordered most-recent first; I can remove any entry.

**Scope (in).** Deliberate `POST /api/recently-viewed {asset_kind, asset_id}` fired on detail-page open (debounced; fire-and-forget UPSERT `last_viewed_at`); `GET /api/recently-viewed/list` (facets + page/size, `last_viewed_at DESC`); `DELETE /api/recently-viewed/{asset_kind}/{asset_id}` (per-row remove); main-page panel; Recently-Viewed top-level tab + facet sidebar; `recently_viewed` table + indexes (§7.6); **`RecentlyViewedHousekeepingJob`** + `housekeeping.ttl.recently_viewed_days`; i18n (6 locales); docs.

**Scope (out).** Recording from search-result hover/impression (only navigation counts); "recently edited/created"; notifications. **"Clear all history" — recommended fast-follow** (see §11).

**UX.** Clock/history icon panel; per-row remove control. Under DISABLED, label **"Recently Viewed (shared)"** with shared-bucket subtext; never present as personal history.

**Acceptance criteria.**
- [ ] Opening a detail page records exactly one recently-viewed entry per asset (deduped, move-to-top); recording never blocks or delays the page; recording does **not** piggyback `GET /api/dataentities/{id}`.
- [ ] Entries are per-`(oidc_username, provider)` and **private** to that user; DISABLED uses the shared sentinel bucket and is labelled "(shared)".
- [ ] Per-row remove works; the housekeeping job caps to newest N/user and deletes entries older than the TTL; orphaned entries are purged.
- [ ] List & panel exclude deleted assets (filter-on-read); all four kinds recordable & filterable; Asset-type facet defaults to All, multi-select; `size` capped.
- [ ] Identity from security context only; strings in all six locales; `Features.md` updated on `release/1.0.0`; live-site verified at the release gate.

**Security/Perf.** §6 (privacy: principal-scoped reads, erasure hook, TTL, DISABLED labelling), §7 (write-path async UPSERT, read-path semi-join, retention job).

---

## 11. Decisions

Resolved by the maintainer 2026-06-26:

1. **DECIDED — Adopt "Asset" as a logged term** (§5.7). The facet ships as "Asset type" (grouped Data Entities / Glossary Terms / Query Examples / Lookup Tables); **"Asset" is logged in `documentation/docs/main-concepts.md` Terms & Aliases** as part of the docs deliverable.
2. **DECIDED — Recently-Viewed under DISABLED ships enabled**, labelled **"Recently Viewed (shared)"** (non-possessive, shared-bucket subtext). The `recently-viewed.enabled` flag exists for an operator to *hide* the surface, but **defaults on** (meets the global-fallback requirement out of the box).
3. **DECIDED — Issue split:** the **shared foundation (§5) is built inside Issue A (Favorites), which ships first**; **Issue B (Recently Viewed) depends on Issue A**. Stays two issues.

Remaining design-time confirmation (not a product decision):

4. **Lookup Table id-space** (§5.2) — confirm whether `LOOKUP_TABLE` is a distinct asset kind or folds into `DATA_ENTITY`, by reading `ReferenceDataController` + `V0_0_86`. Document the choice on the `AssetKind` enum.

Carried defaults (no decision needed): **"Clear all history"** is a logged **fast-follow** (per-row remove in MVP).

---

## Sources

Code (odd-platform, repo-relative):
- `odd-platform-ui/src/components/Overview/Overview.tsx:25-27,53-59` — main-page composition + owner/auth gating
- `odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerEntitiesList.tsx:59,76-105` — "Recommended"/"My Objects", size:5, `StarIcon`
- `odd-platform-api/.../auth/AuthIdentityProviderImpl.java:30-41,56-59` — current-user vs associated-owner resolution
- `odd-platform-api/.../config/DisabledAuthSecurityConfiguration.java:14-17` — DISABLED = permitAll, no principal
- `odd-platform-api/src/main/resources/db/migration/V0_0_92__backfill_user_owner_mapping_provider.sql` — `(username, provider)` identity, cross-mode semantics, fail-closed pattern
- `odd-platform-api/src/main/resources/db/migration/V0_0_89__update_user_owner.sql` — soft-delete + partial-unique convention
- `odd-platform-api/.../repository/reactive/ReactiveDataEntityRepositoryImpl.java:174-178,633,244,445-447` — `incrementViewCount`, `VIEW_COUNT DESC` (Popular), visibility predicate
- `odd-platform-api/.../auth/authorization/AuthorizationCustomizer.java:29-30`; `config/LoginFormSecurityConfiguration.java:57` — reads fall through to `.authenticated()` (no per-asset read RBAC)
- `odd-platform-api/.../housekeeping/HousekeepingJobManager.java`, `housekeeping/config/HousekeepingTTLProperties.java`, `application.yml:170` — retention job + TTL pattern
- `odd-platform-specification/openapi.yaml:2743` (`getAlertsList`) — facet+page/size+desc list analog; `components.yaml` `SizeParam` (no `maximum`)
- `odd-platform-api/.../service/permission/extractor/{DataEntity,Term,QueryExample}PermissionExtractor.java` — per-kind authz (mutation routes)
- Asset surfaces: `controller/{DataEntity,Term,QueryExample,ReferenceData}Controller.java`; entity types/classes per `navigation/domains/data-entities.md`

Consultations (session 2026-06-26): Product/SME note `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md`; SRE/Security review (folded into §6–§7).
