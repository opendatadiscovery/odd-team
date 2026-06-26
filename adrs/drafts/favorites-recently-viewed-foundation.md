# ADR (draft) — Favorites & Recently-Viewed: the personal-navigation foundation

| | |
|---|---|
| **Status** | **Proposed (draft)** — pending GATE 1 on CTRIB-039 / issue [#1815](https://github.com/opendatadiscovery/odd-platform/issues/1815). No code until approved (G-C7 + G-C3). |
| **Date** | 2026-06-26 |
| **Repo** | `opendatadiscovery/odd-platform` |
| **Design source** | `prds/0001-favorites-and-recently-viewed.md` (PRD-0001) — full product/SRE/security rationale. This ADR formalizes the PRD's §5–§7 *architectural* decisions and records the §11.4 design-time resolution. |
| **Drives** | Issue A — Favorites (#1815, builds the foundation, ships first) · Issue B — Recently Viewed (PLT-250, depends on the foundation). |
| **Why an ADR (G-C7)** | The change introduces a **new public API contract** (`/api/favorites/*`), a **new persistence model** (`V0_0_94`), and an **identity/auth-handling decision** (security-context principal + DISABLED fallback). All three are irreversible-blast-radius classes that require an approved ADR before any code. |

## Context

ODD's only personalised main-page surface today is the "Recommended"/"My Objects" block, which renders **only**
for users who have completed internal **Owner** association *and* only when `auth.type != DISABLED`
(`odd-platform-ui/src/components/Overview/Overview.tsx:25-27,53-59`). "Popular" is a *global* `VIEW_COUNT DESC`
list shared by everyone (`ReactiveDataEntityRepositoryImpl.java:633`). There is no per-user "things I chose to
keep," and the large audience of users without an Owner association gets **zero** personalisation.

Favorites and Recently-Viewed are ODD's **first purely-personal, ownership-free, navigation-only** surfaces —
a cell no existing concept occupies (Ownership = stewardship; Alerts = push; Tags = shared taxonomy; DEG =
catalog object + lineage; Popular = global). Because they are personal and ownership-free, they key on the
**logged-in identity, not the Owner** — which is the load-bearing decision below.

They share ~70% of their machinery, so the foundation is built **once** (in #1815) and Recently-Viewed reuses it.

## Decision

### D1 — Identity is `(oidc_username, provider)` from the security context — never the Owner, never a request parameter
`AuthIdentityProviderImpl.getCurrentUser()` already returns `UserDto(username, provider)` from the reactive
security context (`auth/AuthIdentityProviderImpl.java:30-41`): provider = the OAuth2 client-registration-id for
OAUTH2, else the literal `auth.type` (LOGIN_FORM / LDAP). `fetchAssociatedOwner()` (`:56-59`) is a *separate*
Owner lookup we deliberately do **not** use. The `provider` component is **mandatory**: keying on `username`
alone collapses two different people who share a username across modes onto one bucket — the exact bug the
`user_owner_mapping` provider backfill fixed (`V0_0_92__backfill_user_owner_mapping_provider.sql`,
GHSA-8wf2-7c5g-h59v / PLT-120). A single reusable helper — `CurrentUserIdentityResolver.resolve(): Mono<UserIdentity>` —
is the most important shared component; both features call it. Identity comes from the context only, so no user
can read or write another user's bucket.

**DISABLED fallback:** `getCurrentUser()` emits *empty* (no security context — `DisabledAuthSecurityConfiguration.java:14-17`,
`anyExchange().permitAll()`). The resolver `switchIfEmpty`s to a reserved sentinel `('__shared__','DISABLED')`.
V0_0_92 confirms DISABLED never persists a real login, so the literal `'DISABLED'` provider cannot collide with
a real user. No seed row — the sentinel is a write-time key only.

### D2 — A polymorphic asset reference is the pair `(asset_kind, asset_id)`; `AssetKind ∈ {DATA_ENTITY, TERM, QUERY_EXAMPLE}`
The viewable kinds use **independent `bigserial` sequences** (`data_entity`, `term`, `query_example`), so ids
**collide across kinds** — every reference is the pair, never `asset_id` alone.

**§11.4 RESOLVED — `LOOKUP_TABLE` folds into `DATA_ENTITY` (3 kinds, not 4).** A lookup table's *catalog*
identity is its `data_entity` projection: `lookup_tables.data_entity_id bigint` carries
`FK → data_entity(id)` (`V0_0_86__create_schema_and_tables_for_custom_tables.sql:8,13`) and
`ReferenceDataServiceImpl.createLookupTable` populates/uses `getDataEntityId()` (`:104`). A user favourites the
catalog asset, which is the data entity (searchable, taggable, owned). So a lookup table is favourited as
`(DATA_ENTITY, data_entity_id)` — **not** by its `lookup_tables.id` (that id-space is the reference-data
structure, managed by `ReferenceDataController`). *Consequence (D4):* the FE star on the MasterData/LookupTables
surface must use the `data_entity` id, and the `DATA_ENTITY` read-path semi-join must resolve via the
data-entity query that surfaces `LOOKUP_TABLE`-typed entities.

### D3 — Visibility by reuse; **never denormalize** title/metadata onto the favorite row
The favorite row stores only `(asset_kind, asset_id)` + timestamps. Titles/metadata are resolved **live** by
semi-joining the page of `(asset_kind, asset_id)` back onto each kind's existing list/detail query, so the
canonical lifecycle-visibility predicate is inherited automatically (`STATUS != DELETED` + `HOLLOW = false` for
data entities — `ReactiveDataEntityRepositoryImpl.java:244,445-447`; `deleted_at IS NULL` for terms/query
examples). A later-deleted asset simply drops out of the list (no row), and any future platform read-ACL is
inherited for free. Denormalized titles would drift on re-title/re-tag **and** bypass the visibility filter
(a stale-data leak) — rejected.

### D4 — Faceted list endpoint mirrors `getAlertsList`; order-then-semi-join; cap `size`
`GET /api/favorites/list` mirrors the shape of `/api/alerts/list` (`openapi.yaml:2743` — facets + `PageParam`/`SizeParam`
+ desc-ordered array), upgraded to **multi-select** facets (`asset_types`, `namespace_ids`, `datasource_ids`,
`tag_ids`, `owner_ids`; all optional). **Order and paginate on the favorite row's indexed `created_at` first,
then semi-join the page** onto each kind's existing list query (`WHERE id IN (...)`) — this keeps `LIMIT`
index-driven and avoids a 4-way polymorphic `UNION` that cannot use an index for `ORDER BY ts DESC LIMIT n`.
The main-page panel is the same endpoint with `size=5`. **`size` is capped server-side (~100)** — `SizeParam`
in `components.yaml` has **no `maximum`**, an unbounded-page DoS lever. Facet semantics: a kind that does not
carry a selected facet (e.g. query examples carry no datasource/namespace) is excluded for that query; the
**Asset-type** facet is the always-meaningful primary cross-kind filter.

### D5 — Star is idempotent **set-state**, not a flip
`PUT /api/favorites/{asset_kind}/{asset_id}` (ensure-present) / `DELETE …/{asset_kind}/{asset_id}`
(ensure-absent), plus a batch `POST /api/favorites/status` (body: asset refs → the favourited subset) so any
list/search view renders stars without per-DTO changes. A read-then-flip races on double-click; set-state + the
unique constraint are race-safe and multi-instance-safe.

### D6 — No new RBAC policy type; authenticated-only
Verified: all `SECURITY_RULES` are *mutations*; reads fall through to `.pathMatchers("/**").authenticated()`
(`auth/authorization/AuthorizationCustomizer.java:29-30`; `config/LoginFormSecurityConfiguration.java:57`).
Any authenticated user can already read any asset, so the lists leak nothing reads do not already expose. No
`FAVORITE` permission type is added — favourites are personal, not a governed resource. The DISABLED shared
bucket exposes no data the already-anonymous catalog does not; it is labelled **non-possessively** ("Favorites",
never "My Favorites").

### D7 — Persistence: soft-delete + partial-unique, no FK to asset tables, orphans handled on read + sweep
Migration `V0_0_94` (next free; latest is `V0_0_93`). `favorite(id, oidc_username, provider, asset_kind,
asset_id, created_at, deleted_at)` with a **unique index** on `(oidc_username, provider, asset_kind, asset_id)`
(the set-state UPSERT target) and a **partial index** on `(oidc_username, provider, created_at DESC) WHERE
deleted_at IS NULL` (list/panel ordering). Un-star = `SET deleted_at = now()`; re-star =
`ON CONFLICT DO UPDATE SET deleted_at = NULL, created_at = now()`. UTC `timestamp without time zone` (per
`V0_0_75`); soft-delete + partial-unique per the `V0_0_89` convention. **No `CREATE INDEX CONCURRENTLY`**
(Flyway runs in a transaction; the table is new/empty). **No FK** to the four asset tables (overlapping
id-spaces, heterogeneous delete) — orphans handled by **filter-on-read** (D3) plus a periodic sweep in the
existing housekeeping job (`housekeeping/HousekeepingJobManager.java`). Favorites have **no TTL** (curated).

### D8 — "Asset" is a new, logged umbrella vocabulary term
ODD's published vocabulary defines no "Asset", and the live faceted search already ships a data-entity-only
"Type" facet. "Asset" is a **deliberate** umbrella noun for the `{DATA_ENTITY, TERM, QUERY_EXAMPLE}` union,
logged in `documentation/docs/main-concepts.md` Terms & Aliases (doc Gate 2). The facet ships as a grouped
multi-select ("Asset type", default *All*) — conceptually distinct from the existing data-entity "Type" facet
(which it must not overload).

## Consequences

- **Positive:** one shared identity resolver + one polymorphic model + one list shape serve both 1.0.0 features;
  the no-denormalization read path inherits visibility and any future read-ACL for free; set-state + unique
  constraint make the write path race- and multi-instance-safe; no new RBAC surface to reason about.
- **Negative / watch:** the order-then-semi-join read path is more complex than a single table scan (justified
  by the index-driven `LIMIT`); the 3-kind enum means the FE must favourite a lookup table by its `data_entity`
  id (D2 consequence) — a place to get wrong; orphan correctness depends on the housekeeping sweep actually
  running (`housekeeping.enabled`).
- **Reversible later:** adding a 4th `AssetKind` (should a non-data-entity favoritable surface appear) is an
  additive enum + migration; the pair-reference model already accommodates it.

## Alternatives considered (rejected)

1. **Key on the internal Owner** — excludes every user without an Owner association (the primary audience). Rejected (D1).
2. **`asset_id` alone / a 4-kind enum with a distinct `LOOKUP_TABLE` id-space** — ids collide across kinds, and a
   lookup table's catalog identity already *is* a data entity (D2 evidence). Rejected → pair + 3-kind enum.
3. **Denormalize the asset title onto the favorite row** — drifts on re-title and bypasses the visibility filter
   (stale-data leak). Rejected (D3).
4. **4-way polymorphic `UNION` for the list** — cannot use an index for `ORDER BY ts DESC LIMIT n`. Rejected → order-then-semi-join (D4).
5. **Read-then-flip toggle** — races on double-click. Rejected → idempotent set-state (D5).
6. **A new `FAVORITE` RBAC policy type** — inconsistent with the reads-are-authenticated-only model; favourites are personal. Rejected (D6).
7. **Extend the existing data-entity "Type" facet to span the union** — overloads a shipped, documented facet and muddies its meaning on Search. Rejected → a distinct "Asset type" facet (D8).

## Sources

Verified against `odd-platform` `main @ f12b8fbc` (2026-06-26):
- `auth/AuthIdentityProviderImpl.java:30-41,56-59` — `(username, provider)` identity vs. separate Owner lookup.
- `config/DisabledAuthSecurityConfiguration.java:14-17` — DISABLED = `permitAll`, no principal.
- `db/migration/V0_0_86__create_schema_and_tables_for_custom_tables.sql:8,13` — `lookup_tables.data_entity_id FK → data_entity(id)`.
- `service/ReferenceDataServiceImpl.java:104` — `createLookupTable` uses `getDataEntityId()`.
- `odd-platform-specification/components.yaml:809` — `LOOKUP_TABLE` data-entity type value.
- `odd-platform-specification/openapi.yaml:2743` (`getAlertsList`) + `components.yaml` `SizeParam` (no `maximum`).
- `db/migration/V0_0_92__…`, `V0_0_89__…` — provider-tuple identity; soft-delete + partial-unique convention.
- `auth/authorization/AuthorizationCustomizer.java:29-30`; `config/LoginFormSecurityConfiguration.java:57` — reads fall through to `.authenticated()`.
- `repository/reactive/ReactiveDataEntityRepositoryImpl.java:244,445-447,633` — visibility predicate; `VIEW_COUNT DESC` (Popular).
- `housekeeping/HousekeepingJobManager.java` — retention/sweep pattern.
- Design rationale: `prds/0001-favorites-and-recently-viewed.md` §5–§7, §11; SME note `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md`.
