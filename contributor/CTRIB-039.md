---
ctrib: CTRIB-039
github_issue_number: 1815
issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1815
class: feature
milestone: "1.0.0"          # G-C11 PASS — open + semver, due 2026-07-31
status: implementing        # S1 #1817 + S2 #1819 + S3 #1821 ALL MERGED to main @ 924d49de (pending-release 1.0.0 for docs). NOW: slice S4 = Favorites COMPLETION (PRD-0002 / comment 4822201796), Group A FE-only — GATE 1 APPROVED 2026-06-28 (one PR); implementing. Group B (contract) → slice S5. Stream ctrib039s4.
reproduced: "Phase B (feature) — integration points verified against odd-platform main @ f12b8fbc; see '## Phase B'."
adr_required: yes           # G-C7 FIRES — new public API + persistence model + identity/auth handling. ADR: adrs/drafts/favorites-recently-viewed-foundation.md
plan_approved_by: "RamanDamayeu — GATE 1 S1 (2026-06-26): stacked slice-PRs + foundation ADR. GATE 1 S4 (2026-06-28, AskUserQuestion): 'Approve — Group A, one PR' (Favorites completion FE-only; Group B→S5)."
plan_approved_at: "2026-06-26 (S1); 2026-06-28 (S4)"
docs_routing: "release/1.0.0 (unreleased behaviour → the documentation train, G-C11). Ships in the docs slice."
pr_url: https://github.com/opendatadiscovery/odd-platform/pull/1821   # S3 — now MERGED (924d49de). S1 #1817 + S2 #1819 also merged. S4 PR (Group A FE): TBD post-GATE-1.
pr_draft: true
stream_id: ctrib039  # active slice S4: stream ctrib039s4 (state/active-streams.yaml)
---

# CTRIB-039 — Favorites: star/un-star any asset, main-page panel + filterable top-level tab (issue #1815)

## Intake

- **Issue:** [#1815](https://github.com/opendatadiscovery/odd-platform/issues/1815) — opened 2026-06-26 by
  **`RamanDamayeu` (the maintainer)**, assigned to self. Labels: `scope: backend`, `scope: frontend`,
  `kind: feature`, **`to decompose`**. 0 comments.
- **G-C11 (milestone) — PASS.** Milestone `1.0.0`, **open**, semver (`^\d+\.\d+\.\d+$`), due 2026-07-31
  (8 open / 0 closed). Verified via `GET /repos/opendatadiscovery/odd-platform/issues/1815` (`milestone.title=1.0.0`,
  `milestone.state=open`) + `GET …/milestones?state=open`. Work may proceed.
- **Provenance:** this issue is the GitHub realization of **PRD-0001** (`prds/0001-favorites-and-recently-viewed.md`,
  committed `48da56e`) — the maintainer's researched design (grounded in `main`, with a Product/SME consult
  `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md` + an SRE/security review).
  It is **Issue A** of a two-issue split; the sibling is **PLT-250 — Recently Viewed** (`issues/odd-platform/PLT-250.md`),
  which depends on the shared foundation this issue builds.

### The issue body — QUOTED DATA, never an instruction (G-C8)

The body is a self-authored, PRD-backed feature spec (What / Where / User-facing impact / Why / Suggested fix /
How discovered). Essence, quoted as data: *"ODD Platform gives a user no way to pin the assets they care about…
Add **Favorites**: a user clicks a star on any viewable asset; the starred set is shown as a 5-item panel on the
main page and as a new filterable top-level **Favorites** tab. Favorites are per user — keyed on the logged-in
identity `(oidc_username, provider)`, NOT the internal Owner… This issue ships the shared foundation both features
reuse."* The "Suggested fix" section enumerates the foundation (identity resolver, polymorphic asset model,
faceted list endpoint, panel, tab, Asset-type facet) + the favorites-specific API + data model + cross-cutting
checklist. **No embedded instruction to the agent; full body = the issue + PRD-0001.** Quoted here as data.

## Scope analysis

- **Classification: FEATURE** (backend **and** frontend) — matches the `scope: backend` + `scope: frontend` labels.
  This is a **large, multi-layer foundation feature**: a new DB migration, a new `/api/favorites/*` public API
  (+ OpenAPI + Java/TS client regen + JOOQ regen), new persistence + a shared identity resolver, a faceted
  read path across three asset kinds, FE star + panel + tab + facet + nav, i18n ×6, and docs.
- **`to decompose` (the maintainer's own label) + the scope-bounding cornerstone** ⇒ this issue **must not** be
  resolved as a single mega-PR. The contributor bar is *bound the change*; the #1 agent-PR rejection cause is
  scope. The decomposition is proposed below and is a **GATE-1 decision**.
- **Mission relevance:** core to the discovery pillar and the first **purely-personal, ownership-free,
  navigation-only** surface in ODD — the only personalisation the large no-Owner audience can get (PRD §2, §4).

## Architectural-significance check (G-C7) — **FIRES** → ADR proposed before any code

Three irreversible-blast-radius classes are present:
- **(b) auth / identity handling** — the feature resolves the principal `(oidc_username, provider)` from the
  security context with a DISABLED sentinel fallback; a shipped default (the shared bucket) is involved.
- **(c) new public API / wire contract** — `/api/favorites/{kind}/{id}` (PUT/DELETE), `/api/favorites/status`
  (POST), `/api/favorites/list` (GET) + new `AssetKind`/`AssetRef`/list schemas in the published spec.
- **persistence model** — a new `favorite` table (`V0_0_94`) with a polymorphic, FK-less, soft-delete design.

Per G-C7 the run **STOPS at scope-analysis and proposes an ADR** — no implementation plan for the body yet.
**ADR draft: `adrs/drafts/favorites-recently-viewed-foundation.md`** (D1–D8, formalizing PRD §5–§7 + the §11.4
resolution). It is approved at GATE 1 before any code.

## Phase B — verify the running system (LSN-031), not the issue text

For a not-yet-built feature, "reproduce" = confirm current state + confirm the integration points the feature
depends on, **on source/the running system** — not trusting the issue/PRD text (even though the author is the
maintainer; the contributor discipline is to verify). Verified against `main @ f12b8fbc`:

| Claim (issue/PRD) | Verified | Evidence |
|---|---|---|
| Identity = `(oidc_username, provider)` from context; Owner lookup is separate | ✓ | `auth/AuthIdentityProviderImpl.java:30-41` (`getCurrentUser` → `UserDto(username, provider)`; OAUTH2 → client-reg-id, else `authType`) and `:56-59` (`fetchAssociatedOwner`) |
| DISABLED has no principal | ✓ | `config/DisabledAuthSecurityConfiguration.java` — `permitAll`, no principal |
| List shape to mirror exists | ✓ | `openapi.yaml:2743` `getAlertsList` (facets + Page/Size + desc array); `SizeParam` has no `maximum` (DoS lever — cap) |
| Next migration is `V0_0_94` | ✓ | latest on disk = `V0_0_93__last_run_start_time.sql`; `V0_0_84` query_example, `V0_0_86` custom-tables |
| No pre-existing favorites/AssetKind | ✓ | grep `AssetKind`/`favorite`/`FavoriteController` over `odd-platform-api` + spec → none (greenfield) |
| **§11.4: does `LOOKUP_TABLE` fold into `DATA_ENTITY`?** | **✓ RESOLVED — YES (3-kind enum)** | `V0_0_86:8,13` `lookup_tables.data_entity_id FK → data_entity(id)`; `ReferenceDataServiceImpl.java:104` uses `getDataEntityId()`; `components.yaml:809` `LOOKUP_TABLE` is a data-entity type. A lookup table is favourited via its `data_entity` projection. |

**Phase B conclusion:** the foundation is buildable as designed; the load-bearing facts hold against source; the
one deferred design question (`AssetKind` cardinality) is resolved to **3 kinds `{DATA_ENTITY, TERM, QUERY_EXAMPLE}`**
(ADR D2). No running-stack repro needed for a greenfield feature; source verification is the appropriate Phase B.

## Proposed decomposition of #1815 (a GATE-1 decision)

#1815 = Favorites **+ the shared foundation**. Bounded, independently-reviewable slices (each its own branch +
PR; only the final slice carries `Closes #1815`). PLT-250 (Recently Viewed) reuses S1's foundation.

| Slice | Scope | Bucket |
|---|---|---|
| **S1 — Backend foundation + write API** *(recommended first)* | `V0_0_94` `favorite` table + indexes; `CurrentUserIdentityResolver` (the shared helper, DISABLED sentinel); `AssetKind`/`AssetRef`; `FavoriteController/Service/Repository(+Impl)` + mappers; **PUT/DELETE** `/api/favorites/{kind}/{id}` (set-state) + **POST** `/api/favorites/status` (batch); OpenAPI + **Java & TS client regen** + **JOOQ regen**; unit tests (identity incl. DISABLED, set-state idempotency, status batch) | backend / unit |
| **S2 — Favorites faceted list API** | **GET** `/api/favorites/list` (order-then-semi-join read path across the 3 kinds; multi-select facets; `size` cap); OpenAPI + clients; unit + an integration IT | backend / unit + integration |
| **S3 — Favorites frontend** | `<FavoriteStar>` (reuse `StarIcon`, `aria-pressed`, not colour-alone); Redux slice/thunks/selectors; main-page Favorites panel in `Overview.tsx` (outside the owner/auth gate, above the Owner block); star on rows + detail headers; Favorites top-level tab + facet sidebar + **Asset-type** facet; `AppMenuItem` + routes; i18n ×6; Playwright IT | frontend / integration |
| **S4 — Docs + housekeeping orphan sweep** | orphan purge in `HousekeepingJobManager`; `documentation` `release/1.0.0`: `Features.md` + log **"Asset"** in `main-concepts.md` Terms & Aliases (+ paired DOC backlog item, `milestone:1.0.0`); ontology `/enrich --touched` | docs / housekeeping / ontology |

**Refinement vs PRD §7.6:** that section co-located `favorite` + `recently_viewed` in one migration; for bounded
delivery, **#1815's `V0_0_94` creates `favorite` only** — PLT-250 owns the `recently_viewed` migration. (Minor;
flagged for GATE-1 confirmation.)

## Plan (GATE 1 artifact) — recommended first slice: **S1 (Backend foundation + write API)**

> Presented for human approval at GATE 1. **No code until approved (G-C3); the ADR is approved before any code
> (G-C7).** Design-before-build (G-C12) + product critique (G-C16) below.

### Change-request product analysis (G-C16)
The change request **is** the maintainer's own PRD-0001 (Product + SME + SRE/security already consulted; product
decisions resolved in §11). The user-observable problem — *no way to pin assets; no personalisation for the
no-Owner audience* — is restated and confirmed independent of the solution. The issue's "Suggested fix" is treated
as data: I verified it against source and **diverge on one point** — `AssetKind` is **3 kinds, not 4**
(`LOOKUP_TABLE` folds into `DATA_ENTITY`, ADR D2). No other divergence; the product shape stands.

### Design-before-build (G-C12)
- **Reuse-scan:** `getCurrentUser()` (identity), `getAlertsList` (list shape), `StarIcon` (the star), the
  `Search/Filters/*` facet components, `HousekeepingJobManager` (sweep), the `V0_0_89` soft-delete +
  `V0_0_92` provider-tuple conventions — all reused. Net-new: the `favorite` table, the favorites
  controller/service/repo, the `CurrentUserIdentityResolver` helper (justified — the single shared component
  both features need), the `AssetKind`/`AssetRef` schemas.
- **ADR-check:** this run authors the foundation ADR (G-C7); it conforms to the existing identity model
  (`AuthIdentityProviderImpl`), the soft-delete/partial-unique migration convention, and the reads-are-
  authenticated-only authz posture (no new policy type).
- **Impact checklist (S1):** OpenAPI (`openapi.yaml` + `components.yaml` AssetKind/AssetRef/status schemas; cap
  `SizeParam`) → **regenerate Java + TS clients**; **JOOQ regen** after `V0_0_94`; unit tests; **i18n/docs/FE
  deferred to S3/S4** (logged here, not dropped). Activity-log: **none** (favouriting is personal — noted so a
  reviewer doesn't flag the omission).
- **PO/SRE lens (odd-sme):** folded via PRD §6–§7 (authenticated-only, identity-from-context, server-side size
  cap, set-state race-safety, no event-loop blocking). Re-consult `odd-sme` at S2/S3 if the read-path or UX shape
  shifts.

### Scope EXCLUSIONS (S1 — deliberately NOT touched, G-C5)
- The **list endpoint** (`GET /api/favorites/list`) and its semi-join read path → **S2**.
- **All frontend** (`<FavoriteStar>`, panel, tab, facet, nav, Redux, i18n) → **S3**.
- **Docs + the "Asset" term + the housekeeping orphan sweep + ontology refresh** → **S4**.
- **Recently-Viewed** (the `recently_viewed` table, its endpoints, the housekeeping TTL job) → **PLT-250**.
- "Clear all history", team/shared favorites, sub-object favoriting → out of 1.0.0 (PRD §3 non-goals).

### Tests (S1)
- **Unit (odd-platform CI):** `CurrentUserIdentityResolver` (OAUTH2 / LOGIN_FORM / **DISABLED → sentinel**);
  set-state idempotency (double PUT = present once; DELETE = absent; re-PUT after DELETE re-activates);
  `POST /status` returns exactly the favourited subset. Each test FAILS without the code, PASSES with it.
- **Integration (odd-team IT-NNN):** deferred to **S2** (the user-facing list/panel is the integration symptom);
  S1 is unit-covered. (G-C9: an integration IT becomes mandatory at S2/S3 where the symptom is user-facing.)

### Docs / ontology routing
- Docs: **none in S1** (no user-visible behaviour ships until S3); the doc deliverable is **S4** → `release/1.0.0`
  (G-C11). Recorded, not asserted-unread — the page read happens at S4.
- Ontology: `/enrich --touched` at **S4** (after the feature surface exists).

## GATE 1 — decisions surfaced to the maintainer

1. **Approve the foundation ADR** (`adrs/drafts/favorites-recently-viewed-foundation.md`) — incl. the §11.4
   resolution (`AssetKind` = 3 kinds; `LOOKUP_TABLE` → `DATA_ENTITY`).
2. **Decomposition mechanism** — stacked slice-PRs under #1815 (I manage the slices) vs. sub-issues you create
   (new issues are a human action) vs. one PR.
3. **First slice + its plan** — recommended **S1 (Backend foundation + write API)**; confirm scope + the
   `V0_0_94` = favorite-only refinement.

_Status stays `planned` until GATE-1 approval; then `plan-approved` → S1 implementation in a dedicated worktree
(ctrib039 namespace), no code before that._

---

## GATE 1 — APPROVED (2026-06-26)

Maintainer (RamanDamayeu) via `AskUserQuestion`: **(1) Delivery = stacked slice-PRs under #1815** (each slice its
own PR; only the final slice `Closes #1815`); **(2) First slice = S1 (backend foundation + write API)**. The
foundation ADR (`adrs/drafts/favorites-recently-viewed-foundation.md`, incl. the §11.4 → 3-kind `AssetKind`
resolution) is approved. Proceeding to S1 in worktree `../odd-platform-ctrib039`, branch
`contrib/CTRIB-039-favorites-foundation-write-api` (non-main-tracked; push.default=current — O6/LSN-038).

## Phase D — S1 implementation (backend foundation + write API)

### Files (worktree `../odd-platform-ctrib039`)
| Layer | File | Notes |
|---|---|---|
| spec | `odd-platform-specification/openapi.yaml` | 3 paths: `PUT`/`DELETE /api/favorites/{asset_kind}/{asset_id}`, `POST /api/favorites/status` (tag `favorite`) |
| spec | `odd-platform-specification/components.yaml` | `AssetKind` (3-kind enum), `AssetRef`, `AssetRefList` |
| migration | `odd-platform-api/.../db/migration/V0_0_94__create_favorite.sql` | `favorite` table + the full-4-tuple unique index (UPSERT target) + the partial active-order index |
| identity | `auth/CurrentUserIdentityResolver.java` | the shared helper (ADR D1); `getCurrentUser().switchIfEmpty(sentinel)` |
| dto | `dto/AssetRefDto.java` | repo query-key record |
| repo | `repository/reactive/ReactiveFavoriteRepository[Impl].java` | set-state UPSERT / soft-delete / scoped batch read (JOOQ) |
| service | `service/FavoriteService[Impl].java` | identity-from-context orchestration; subset mapping |
| controller | `controller/FavoriteController.java` | implements generated `FavoriteApi`; 204 / 200 |
| tests | `auth/CurrentUserIdentityResolverTest`, `service/FavoriteServiceImplTest`, `controller/FavoriteControllerTest` (unit, Mockito+StepVerifier) + `repository/reactive/ReactiveFavoriteRepositoryImplTest` (Testcontainers) | |

### Verified (running-system / source, not assumed)
- **Codegen green:** `:odd-platform-api-contract:openApiGenerate` (spec valid) + `:odd-platform-api:compileJava`
  (JOOQ `jooqDockerGenerate` applied `V0_0_94` → `FAVORITE`/`FavoritePojo`; all 7 production files compile).
- **§11.4 resolution grounded in code:** `V0_0_86:8,13` `lookup_tables.data_entity_id FK → data_entity(id)` ⇒
  `AssetKind` = 3 kinds (LOOKUP_TABLE folds into DATA_ENTITY).
- **Auth posture (G-C7) clean WITHOUT a security change:** `AuthorizationCustomizer:29-30` +
  `LoginFormSecurityConfiguration:57` — `/api/favorites/**` is neither whitelisted nor a SECURITY_RULE, so it
  inherits `.authenticated()` (LOGIN_FORM/OAUTH2) and `permitAll`+sentinel (DISABLED). No new policy type (ADR D6).
- **TS client is build-generated + gitignored** (0 tracked) ⇒ S1's committed diff carries NO generated client code.

### Test ledger
- **Inner-loop (the 4 favorites classes): GREEN** (`:odd-platform-api:test --tests *Favorite* *CurrentUserIdentity*`,
  1m58s). The R2DBC query log confirms the real SQL: the `on conflict (oidc_username, provider, asset_kind,
  asset_id) do update set deleted_at=…, created_at=…` UPSERT, the `deleted_at is null`-guarded soft-delete, and
  the identity+ref-scoped SELECT.
- **Checkstyle (main+test): GREEN** (`maxWarnings=0`).
- **Full unit CI-replica build (`:odd-platform-api:build`): GREEN** (7m6s; 157 test result files, **0
  failures / 0 errors** across the whole suite; checkstyle clean; assemble OK). **Local patch-coverage
  (G-C13): 100% line+instruction** on every measured changed file (`CurrentUserIdentityResolver`,
  `FavoriteServiceImpl`, `FavoriteController`, `AssetRefDto`) — the repo impl sits in the jacoco-excluded
  `repository/**` (Testcontainers-covered). No CI surprise.
- **Committed to the branch:** `77998156 feat(favorites): backend foundation + write API (#1815)` — worktree
  clean ⇒ the regression SUT == this commit (DoD provenance).
- **Full integration regression (`run-regression.sh ctrib039`): GREEN-for-change** (SUT `9ee98020` ←
  `77998156`; flock 22:22–22:35). **feature-complete 318 passed / 1 failed · multi-stack 9/9 ·
  ingestion-e2e 15/15 · known-bugs 3 failed / 3 = EXPECTED-RED, 0 unexpected-GREEN.** The 1 feature-complete
  failure = `dataset-structure-tag-filter.spec.ts` (**IT-146 / F-047 / #1679 / CTRIB-038**) — the SIBLING
  stream's spec for an UNMERGED feature (Dataset-Structure tag/type column filter), **verified not-favorites**
  (`grep favorit|/api/favorites|AssetKind` = 0; the failure is a Structure-tab column-filter locator) and
  absent from my SUT (main + favorites only) ⇒ NOT a favorites regression (ctrib038 owns its spec — O10
  route-around). My additive change introduced ZERO regressions; every previously-green spec stayed green.

### Scope held (G-C5)
S1 touches only the backend write-path foundation. List endpoint → S2; all FE + i18n → S3; docs + "Asset" term +
housekeeping orphan sweep + ontology refresh → S4; Recently-Viewed → PLT-250. No adjacent changes folded in.

### Docs (G-C10) + ontology routing for S1
- **Docs: none in S1.** The favorites endpoints have **no user-facing surface** until the FE slice (S3); the
  user-facing docs (`Features.md` + the **"Asset"** term in `main-concepts.md`) ship in **S4** on the
  documentation `release/1.0.0` train (G-C11). The OpenAPI contract (the API SoT) IS updated here in S1.
- **Ontology: deferred to S4** (justified, per CTRIB-029 precedent): the favorites controller/service/repo are
  **new** nodes needing a substrate re-scan (beyond `/enrich --touched`), and the surface is incomplete until S3.
  `/enrich` runs once the feature exists, against a clean lineage tree.

## GATE 2 — handoff (DRAFT PR open; human review + merge)

S1 implemented; **all five DoD gates green** (full unit build · full integration regression green-for-change ·
docs decided · ontology deferred-justified · 100% patch coverage). Status → **`review-ready`** — the contributor
never self-merges; `/review` (separate session) owns the `done`/merge tail; **GATE 2 = the human merge**.

- **Draft PR:** [#1817](https://github.com/opendatadiscovery/odd-platform/pull/1817) — `draft: true`, base `main`,
  head `contrib/CTRIB-039-favorites-foundation-write-api` @ `77998156`. **Part of #1815 (slice 1/4) — does NOT
  `Closes`** (the final slice will). Push verified main-untouched (remote `main` still `f12b8fbc`).
- **Scope comment on #1815:** [issuecomment-4813301618](https://github.com/opendatadiscovery/odd-platform/issues/1815#issuecomment-4813301618)
  — the stacked-slice plan; the public thread reflects the actual PR scope (G-C5).
- **Next (maintainer):** run `/review CTRIB-039` (separate session — the 10 Quality-Bar gates + the contributor
  gates), then **review + merge PR #1817** (the bot cannot self-approve — G-C4). On merge, S1 → `pending-release`
  (milestone 1.0.0); the favorites user docs publish at the 1.0.0 release gate (slice 4).
- **Then:** slice 2 (`GET /api/favorites/list`), slice 3 (frontend), slice 4 (docs + housekeeping) — each a fresh
  `/contribute` continuation under #1815 on the ctrib039 namespace.
- **Resources released:** heavy-e2e flock released (run-regression teardown); ctrib039 stack down; the worktree
  `../odd-platform-ctrib039` + the branch remain for slice 2.

## Phase D — S2 (favorites list API) — IN PROGRESS

**S1 MERGED** (PR #1817 squash-merged → `origin/main 577593ae`). Continuing per the maintainer's "continue with
implementation". S2 branch `contrib/CTRIB-039-favorites-list-api` (off `577593ae`, `--no-track`, non-main-tracked).

### Scope (S2) — decision recorded
- **IN:** `GET /api/favorites/list?asset_types=&page=&size=` → a **polymorphic `FavoriteAssetList`** resolving
  favorited assets across **all 3 kinds** (DATA_ENTITY + TERM + QUERY_EXAMPLE), ordered `favorited_at DESC`,
  paginated (size capped ~100), with **visibility by reuse** (soft-/hard-deleted + hollow assets drop out — ADR
  D3), and the **`asset_types`** filter (cheap — `asset_kind` is a `favorite` column).
- **DEFERRED (documented; additive — a follow-up or fold into S3's facet UI):** the 4 cross-kind facets
  (`namespace_ids` / `datasource_ids` / `tag_ids` / `owner_ids`). They are tab-only refinements with per-kind
  applicability complexity (query examples carry no namespace/datasource; the PRD's "exclude that kind" rule), and
  the main-page panel (S3) calls `size=5` with no facets. Adding them later does not break the contract.
- **OUT (later slices):** all FE (S3); docs + "Asset" term + housekeeping orphan sweep (S4).

### Design (ADR D3/D4-grounded; reuse-scan done — no new ref shapes)
- **Response:** `FavoriteAssetList { items: [FavoriteAsset], page_info }`; `FavoriteAsset { asset_kind,
  data_entity?: DataEntityRef, term?: TermRef, query_example?: QueryExampleRef }` — exactly one per-kind ref is
  set; the FE switches on `asset_kind`. **Reuses the existing `DataEntityRef`/`TermRef`/`QueryExampleRef`.**
- **Read path (order-then-semi-join; no denormalization):** (1) the `favorite` query → the ordered, paginated
  page of `(asset_kind, asset_id)` (the `asset_types` filter pushed in); (2) per-kind resolve the page's ids →
  refs **with visibility** — DATA_ENTITY via `ReactiveDataEntityRepository.getDimensionsByIds` **+ a
  `STATUS≠DELETED`/`HOLLOW=false` post-filter** (getDimensionsByIds is `includeDeleted(true)`) →
  `DataEntityMapper.mapRef`; TERM via `getTermRefDto` (respects soft-delete) → `TermMapper.mapToRef`;
  QUERY_EXAMPLE via the query-example repo → `QueryExampleMapper.mapToQueryExampleRef`; (3) reassemble in the
  favorited order, dropping unresolved (deleted) ids — visibility inherited.
- **No new architectural decision** — additive read endpoint per the approved ADR D4; G-C7 does not re-fire.

### Tests
- **Unit** (service): per-kind assembly; the DATA_ENTITY visibility post-filter (deleted/hollow excluded);
  favorited-order preservation; empty-page short-circuit; `size` cap.
- **Integration** (Testcontainers): `getFavoritedPage` ordering/pagination/asset_kind-filter + `countFavorites`
  (active-only, filter-aware), against a real DB.

### Implementation (committed `2c526306`)
| Layer | File | Note |
|---|---|---|
| spec | `openapi.yaml` + `components.yaml` | `GET /api/favorites/list`; `FavoriteAsset` (discriminator + per-kind ref) + `FavoriteAssetList` |
| repo | `ReactiveFavoriteRepository[Impl]` | `getFavoritedPage` (ordered `created_at DESC, id DESC`; paginated; asset_kind filter) + `countFavorites` |
| resolver | `service/FavoriteAssetResolver.java` (NEW) | order-then-semi-join; per-kind resolve + visibility; reassemble in favorited order |
| service | `FavoriteService[Impl]` | `getFavoritesList` — identity → page+count → resolve → `FavoriteAssetList`; size cap 100 |
| controller | `FavoriteController` | `getFavoritesList` → 200 |
| tests | `FavoriteAssetResolverTest` (NEW) + extended `FavoriteServiceImplTest` / `FavoriteControllerTest` / `ReactiveFavoriteRepositoryImplTest` | |

### Gates (S2)
- **Inner-loop favorites tests: GREEN** — resolver 6/6, service 6/6, controller 4/4, repo 7/7 (Testcontainers).
  **Checkstyle (main+test) clean.**
- **Verified (not assumed):** Term visibility — `getTermRefDto` filters `TERM.DELETED_AT IS NULL` (`:188`);
  QE soft-delete — `query_example.deleted_at` (V0_0_84) + an explicit `deletedAt==null` filter; DE visibility —
  `getDimensionsByIds` is `includeDeleted(true)` ⇒ an explicit `STATUS≠DELETED`/`HOLLOW=false` post-filter.
- **Full `:odd-platform-api:build`: GREEN-for-change.** Favorites tests all pass (resolver 7/7 incl. the
  defensive-dedup test, service 6/6, controller 4/4, repo 7/7); **all other tests pass**. **Local patch-coverage
  (G-C13): 100% line** on every changed measured file (`FavoriteAssetResolver`, `FavoriteServiceImpl`,
  `FavoriteController`). The build's only failure is the pre-existing **`PrometheusMetricsIngestionTest` flake** —
  verified NOT mine: it **passes in isolation** (BUILD SUCCESSFUL alone), the lone `favorit` match in its log is
  the `V0_0_94` migration line (`0.0.94 - create favorite`), and the 500 is a connection error (`Error Code: 0`)
  under full-suite load. Metrics ingestion shares no code with favorites.
- **Rebase:** S2 rebased onto current `origin/main` `de6992c1` (S1 + #1679 tag-filter both merged) → branch
  `50f57fda`, clean (no overlap — #1679 is FE-only). The regression SUT now includes #1679, so feature-complete
  runs without the IT-146 sibling-spec gap S1 saw.
- **Full integration regression (`run-regression.sh ctrib039`): GREEN** (SUT `3161c67e` ← `50f57fda`; flock
  08:53–09:05). **feature-complete 319/0 · multi-stack 9/9 · ingestion-e2e 15/15 · known-bugs 3-RED-expected /
  0-unexpected-green.** The rebase onto main (incl. #1679) eliminated S1's IT-146 sibling gap — feature-complete
  is now fully green. **ZERO regressions from S2.**
- **Docs (G-C10): none in S2** (no user surface until S3; rides S4). **Ontology: deferred to S4** (the new
  resolver node refreshes with the feature surface).

### GATE 2 (S2) — handoff (DRAFT PR open; human review + merge)
S2 DoD met (unit GREEN-for-change @ 100% patch cov · regression GREEN · docs none/S4 · ontology S4). Status →
**`review-ready`** (the contributor never self-merges; `/review` owns the tail; GATE 2 = the human merge).
- **Draft PR:** [#1819](https://github.com/opendatadiscovery/odd-platform/pull/1819) — `draft: true`, base `main`
  (`de6992c1`), head `contrib/CTRIB-039-favorites-list-api` @ `50f57fda`. **Part of #1815 (slice 2/4) — does NOT
  `Closes`** (auto-close keyword absent, verified). Push verified main-untouched.
- **No new #1815 comment** — the 4-slice plan was posted at S1 (issuecomment-4813301618); GitHub cross-references
  #1819 on #1815. The **facet deferral** (the 4 cross-kind facets vs. S1's comment that listed them under slice 2)
  is stated in the PR body — an additive follow-up (a thin S2b, or fold into S3's facet UI). Surfaced to the
  maintainer at handoff, not silently absorbed.
- **Next (maintainer):** `/review CTRIB-039` (S2) then review + merge #1819. Then slice 3 (frontend) + slice 4
  (docs + "Asset" term + housekeeping orphan sweep).

## Phase D — S3 (favorites frontend) — IN PROGRESS

**S1 #1817 + S2 #1819 BOTH MERGED.** S3 branch `contrib/CTRIB-039-favorites-frontend` (off main `66c472e2`,
non-main-tracked). FE env materialized (node_modules + generated-sources current — the `FavoriteApi` / `AssetKind`
/ `FavoriteAssetList` TS client is present). **Scope: whole FE in one PR** (maintainer's choice via AskUserQuestion).

### Foundation — DONE (committed `ba90e3b7`; `tsc --noEmit` clean, 0 errors)
- Redux: `favoriteApi` (lib/api); `favorites.actions` (add/remove/list/status); `favorites.thunks`
  (`handleResponseAsyncThunk` over the FavoriteApi client); `favorites.slice` (`favoritedByKey` status map + the
  list + pageInfo); `favorites.selectors` (`getIsAssetFavorited`, `getFavoritesList`); `FavoritesState`;
  `redux/lib/favorites.ts` (`assetRefKey` / `favoriteAssetKey`); registered in the root reducer.
- `<FavoriteStar>` (`components/shared/elements`): gold-filled / outlined star toggle (WCAG: filled-vs-outline
  shape + `aria-pressed`, not colour-alone); optimistic, slice-backed toggle + rollback.

### Remaining layers (this PR)
1. Wire `<FavoriteStar>` into the **detail headers** (DataEntity / Term / QueryExample) + **list/search rows**
   (with a batch `getFavoriteStatus` hydrate so rows render their stars correctly).
2. The **main-page Favorites panel** in `Overview.tsx` (5 items, "View all", empty state; OUTSIDE the owner gate,
   ABOVE the Owner block).
3. The **top-level Favorites tab**: a route + `AppMenuItem` nav entry + the tab page (reusing the Search/Alerts
   facet+list layout) + the facet sidebar (reuse `components/Search/Filters/*`) + the new **Asset-type** facet.
4. **i18n** strings in all 6 locales (en/es/fr/ua/hy/ch).
5. **Tests:** vitest (FavoriteStar + the slice) + a **Playwright e2e** (star → it appears in the panel → unstar →
   gone) — MANDATORY (user-facing, G-C9).
6. **DoD:** FE build (`pnpm build`) + the full integration regression + the draft PR.

### Progress (committed on the branch, every commit `tsc --noEmit` clean)
- `ba90e3b7` — Redux foundation + `<FavoriteStar>` (self-hydrating, optimistic toggle + rollback).
- `b92067b1` — the data-entity detail-header star.
- `929dc41a` — the main-page Favorites panel (+ the `favoritesPath` route).
⇒ **The complete star→see loop works for the dominant kind (DataEntity)** — star a data entity from its
detail header, see it in the main-page panel, unstar it — all type-checked.

### Honest remainder (the heaviest part — NOT yet a draft PR; the S3 DoD is NOT met)
- The **top-level Favorites tab** (`App.tsx` route + `AppMenuItem` nav + the tab page + the facet sidebar +
  the new Asset-type facet).
- The star on **Term / QueryExample detail headers + search/list rows** (with a batch hydrate).
- **i18n ×6** — the English strings used so far → `en/es/fr/ua/hy/ch`.
- **vitest** (FavoriteStar + the slice) + the **mandatory Playwright e2e** (G-C9 — user-facing).
- **DoD:** `pnpm build` + the full integration regression + the **draft PR**.
S3 is a `tsc`-clean partial on `contrib/CTRIB-039-favorites-frontend`; branch + FE env + patterns + route
builders + nav are all mapped and ready to resume.

## Phase D — S3 COMPLETE (resumed 2026-06-27)

The S3 remainder above is **done**. Continued on `contrib/CTRIB-039-favorites-frontend` (4 new commits),
then **rebased the whole 7-commit branch onto current `origin/main 934b60a7`** (a concurrent session
reviewed+merged **CTRIB-040 #1820** mid-session — trust-the-tree; the only overlap was the 7 locale JSONs,
git auto-merged cleanly, all 7 valid JSON @ 653 keys carrying both #1820's and the favorites keys).

### What shipped (new commits, every one tsc+eslint clean)
| Commit | Deliverable |
|---|---|
| `4b2b939f` | Stars on **Term** + **QueryExample** detail headers + **data-entity search rows**; `FavoriteStar` promoted to the shared barrel; **authoritative batch status hydrate** — `fetchFavoritesStatus` returns `{asked,favorited}`, the slice resolves asked→false (fill-unknowns, never clobbering an optimistic toggle) so a list hydrates all rows in ONE call |
| `89dd870a` | **Top-level Favorites tab** (`/favorites` route + nav entry after Catalog) + the **Asset-type facet** (fixed 3-option checkbox group, bound to the list endpoint's `asset_types`) + the tab page (PageWithLeftSidebar layout, load-more) + `FavoritesListItem`; shared display helpers (`components/Favorites/lib.ts`) extracted from the panel (no duplication; panel now links Query Examples too); FavoriteStar aria-label localized + a `data-qa="favorite-star"` e2e hook |
| `34efd1db` | **i18n — 10 new keys × all 7 locales** (en/es/fr/ua/hy/ch/br; the S3 plan's "×6" omitted `br`). Reuses existing "Query Examples"/"Term"/"Show more". Verified against the `i18n-key-parity` guard (#1751): en-completeness + catalog parity GREEN |
| `4fcfaac5` | **vitest** — favorites slice (6: add/remove/list/the batch-hydrate no-clobber, RED on a naive "asked→false-for-all") + FavoriteStar (3: aria-pressed render + optimistic click). 9/9 GREEN on node 24 |

Plus odd-team: **IT-148** (`favorites-star-see-loop.spec.ts` + protocol; registered in feature-complete +
ui-e2e) — the G-C9 user-facing e2e: seed an ingested TABLE, star from its header, see it on the main-page
panel + the `/favorites` tab, un-star, confirm gone. GREEN on the S3 SUT; RED-by-construction on `ref:main`
(backend merged, no star/panel/tab). Scope EXCLUSIONS held (G-C5): no backend change, S4 still owns
docs + the "Asset" term + the housekeeping orphan sweep + the ontology refresh.

### Design notes (G-C12 reuse, no churn)
- Reused `FavoriteStar`, `PageWithLeftSidebar`, the `Checkbox`/`FormControlLabel` idiom (mirrored
  `StatusSettingsForm`), `ToolbarTabs`, `fetchFavoritesList`, the `divider` theme token, the locale-key
  convention. Net-new only where justified: the tab page, the facet, the list item, the shared lib.
- The Asset-type facet is the **only** facet (the S2 list endpoint supports `asset_types` only; the 4
  cross-kind facets were deferred at S2 — additive, no contract break).

### DoD gates (S3) — evidence
1. **Unit (FE)**: `tsc --noEmit` GREEN · `eslint` GREEN · **`vite build` GREEN** (21.5s; the chunk-size
   warning is pre-existing) · **full vitest 86 passed / 1 failed** — the 1 RED is the **pre-existing**
   `i18n-key-parity` offender `LinkedTermsList.tsx:63` (introduced by #1798/CTRIB-028, byte-identical on
   `origin/main`, NOT favorites) → logged **TST-056**. Favorites adds zero new failures. (node 24 via
   `node:24-slim`; the host has only node 18, which runs tsc/eslint but not vite/vitest.)
2. **Integration regression** (`run-regression.sh ctrib039`, SUT `df0d7186` ← worktree `8c6c4a9d`):
   _RUNNING at handoff-draft time — result appended below._
3. **Docs** (G-C10): none in S3 (the user docs are the S4 deliverable on the `release/1.0.0` train).
4. **Ontology**: deferred to S4 (the new FE nodes refresh with the full surface; the regression's P-001
   probe drift in `lineage/**` is reverted, not committed — reviewer convention).
5. **Principal review** (G-C13): screenshot pixel-review pending (below).

### Regression result — GREEN-for-change (SUT `df0d7186` ← worktree `8c6c4a9d`; flock 21:27–21:41)
- **feature-complete: 321 passed / 0 failed** (5.9m) — incl. **IT-148** (favorites star→see loop, test #125,
  4.3s GREEN) + IT-146/IT-147 (#1820, now in the SUT). **Zero regressions** — every previously-green spec
  stayed green.
- **multi-stack: 9 passed** (3.2m) · **ingestion-e2e: 15 passed** (2.3m).
- **known-bugs: 3 failed = the EXPECTED-RED pins** (PLT-086 attachment-ephemeral / F-042 error-boundary /
  PLT-052 DQ-WARNING-render), **0 unexpected-green**.
- Provenance: the run-log records `favorites-star-see-loop.spec.ts` against digest `df0d7186`, built from
  worktree `8c6c4a9d` == my branch HEAD (clean). The incidental P-001 probe drift in `lineage/**` was
  reverted (not committed) — the favorites ontology refresh is S4.

### Pixel review (G-C13) — PASS
Drove the favorites surfaces on the SUT (`:18100`) + screenshotted (a throwaway spec, deleted): the gold
star on the data-entity detail header (well-placed by the name); the main-page panel (item link + star +
"View all"); the Favorites tab (the active nav tab + the Asset-type facet sidebar + a list row with name +
muted kind label + star); the empty state (centered icon + "Star an asset to pin it here."). No
contrast/legibility/wrapping/empty-state defects. (Minor, non-blocking: the panel is full-width, so a single
favorite looks sparse — the right-edge star column is intentional for the 5-item panel; a candidate refinement.)

### S3 DoD — MET (all five gates actually run, at the committed SHA `8c6c4a9d`)
1. FE unit: tsc + eslint + **vite build** GREEN · vitest **86/87** (the 1 RED pre-existing → TST-056). ✓
2. Full integration regression GREEN-for-change (above). ✓
3. Docs: none in S3 (S4 owns the user docs + the "Asset" term, on the `release/1.0.0` train). ✓
4. Ontology: deferred to S4 (probe drift reverted). ✓
5. Principal review + pixel review PASS. ✓

Status → **`review-ready`** (the contributor never self-merges). DRAFT PR + `/review` (separate session) +
human GATE 2 = the tail.

## GATE 2 — handoff (S3 DRAFT PR open; human review + merge)

- **Draft PR:** [#1821](https://github.com/opendatadiscovery/odd-platform/pull/1821) — `draft: true`, base
  `main` (`934b60a7`), head `contrib/CTRIB-039-favorites-frontend` @ `8c6c4a9d`. **Part of #1815 (slice
  3/4) — does NOT close** (live-verified: the case-law trap "does NOT **close** #1815" was caught by the
  Gate-8/live-body check and PATCHed to "does not close the issue"; the live body now has zero
  closing-keyword+#N). Pushed via the `odd-contributor` App (1-hr token, redacted, never persisted); the
  push went to the same-name branch — `main` untouched (O6/LSN-038).
- **No new #1815 comment** — the 4-slice plan was posted at S1; GitHub cross-references #1821 on #1815. The
  scope is unchanged from the approved decomposition (no scope-narrowing comment needed).
- **DoD: all five gates actually-run at `8c6c4a9d`** — FE unit (tsc/eslint/vite-build/vitest 86-of-87, the
  1 RED pre-existing → TST-056) · full regression GREEN-for-change (fc 321/0 incl. IT-148, ms 9/9, ie 15/15,
  kb 3-RED-expected) · docs none-in-S3 · ontology S4 · pixel-review PASS.
- **Next (maintainer):** run `/review CTRIB-039` (separate session — the 10 Quality-Bar gates + the
  contributor gates), then review + merge **PR #1821** (the bot cannot self-approve — G-C4). On merge, S3 →
  `pending-release` (milestone 1.0.0); the favorites user docs publish at the 1.0.0 release gate (slice S4).
- **Then:** slice 4 (docs + the "Asset" term in `main-concepts.md` + the housekeeping orphan sweep +
  the ontology `/enrich` over the now-complete favorites surface) — a fresh `/contribute` continuation.
- **Resources released:** heavy-e2e flock released (run-regression teardown) + the throwaway pixel stack
  torn down; the worktree `../odd-platform-ctrib039` + the branch remain for S4. Incidental P-001 lineage
  probe drift reverted (not committed).

## Review (2026-06-27, session: review-ctrib039) — slice S3

- **Result**: **ACCEPTED** — slice S3 (favorites frontend). Every S3 deliverable + Quality-Bar/contributor gate PASS with cited evidence, one **non-blocking** Gate-1/G-C12 reuse finding logged for fast-follow. Reviewed `8c6c4a9d` (== `origin/contrib/CTRIB-039-favorites-frontend` head == ctrib039 worktree HEAD). **GATE 2 has NOT occurred**: PR #1821 is a **DRAFT** and `8c6c4a9d` is **not** on `origin/main` (top `934b60a7`) — the human review+merge is pending. **Disposition: status stays `review-ready`** (the contributor `pr-draft → review-ready` hand-off; the implementer self-advanced the label, the substance — handed off with a draft PR — is correct and this review legitimises it). Human GATE-2 (review + merge PR #1821 — the bot cannot self-approve, G-C4) owns the next step; on merge S3 → `pending-release` (milestone 1.0.0); `/review release:1.0.0` owns the `done` flip after live-site + real-instance verification at the release gate.

- **S3 deliverables (the plan's acceptance set)**:
  - [x] `<FavoriteStar>` — reusable, WCAG (aria-pressed + fill-vs-outline shape, not colour-alone), optimistic + rollback, stop-propagation so a row star doesn't navigate. PASS — `FavoriteStar.tsx:30-86`; vitest 3/3 (aria-pressed render + optimistic click).
  - [x] Redux slice/thunks/selectors over the generated `FavoriteApi`; batch-hydrate fill-unknowns no-clobber. PASS — `favorites.slice.ts:30-44`; the no-clobber unit test is genuinely RED on a naive "asked→false-for-all" impl (verified by reading the guard `if (favoritedByKey[key] === undefined)`).
  - [x] Stars on DataEntity / Term / QueryExample detail headers + data-entity search rows (one-call batch hydrate). PASS — 4 header/row wirings verified; `Results.tsx:83-95` batch-hydrates all visible rows in ONE `getFavoriteStatus`.
  - [x] Main-page Favorites panel, **outside the owner gate** (every audience), above the Owner block. PASS — `Overview.tsx`: `<FavoritesPanel />` inserted before the `isShowOwnerAssociation` conditional.
  - [x] Top-level Favorites tab (`/favorites` route + nav after Catalog) + Asset-type facet. PASS — `App.tsx` lazy route + `ToolbarTabs.tsx` + `Favorites.tsx` + `FavoritesAssetTypeFilter.tsx`.
  - [x] i18n all 7 locales. PASS — 653 keys each, 0 missing / 0 orphan vs en; genuinely translated (not English pass-through).
  - [x] vitest (FavoriteStar + slice) + the mandatory Playwright IT-148. PASS — 9/9 + IT-148 GREEN-on-fix / RED-on-base, both reproduced by me.

- **Quality Bar / contributor gates** (each ends in its evidence):
  - **Gate 1 / G-C12 (no duplicates / reuse) — PASS with a logged finding** via read: the FE reuses `PageWithLeftSidebar`, `Checkbox`/`FormControlLabel`, `ToolbarTabs`, `EmptyContentPlaceholder`, the route-builder + locale conventions. **Finding (non-blocking):** `FavoriteStar.tsx`'s inlined `STAR_PATH` constant is the **byte-identical** `d=` of the existing `components/shared/icons/StarIcon.tsx` (same `viewBox='0 0 17 16'`), instead of reusing it — contradicting the approved plan's reuse-scan ("StarIcon — reused"). It does **not** rise to a blocking duplicate: `FavoriteStar` is a legitimately new component (toggle + optimistic state + self-hydrate + a11y that `StarIcon` lacks); only the path *data* is duplicated, and reuse is non-trivial because `StarIcon` hardcodes `fill='#091E42'` and is consumed by `OwnerEntitiesList` (changing it has blast radius). Logged as an S4/fast-follow cleanup. The maintainer (GATE-2 merger) may require the de-dup before merge or accept-and-fast-follow.
  - **Gate 4 (consumer-read) — N/A** via read: pure-FE change, no `@Value`/SDK builder. The thunks call the generated `FavoriteApi` client; the call signatures match (`addFavorite`/`removeFavorite`/`getFavoritesList`/`getFavoriteStatus`).
  - **Gate 5 — N/A** (no SDK builder in scope; FE-only).
  - **Gate 9 (provenance) — PASS** via read+grep: the commit claim "translates every favorites string into all 7 catalogs" is TRUE — es/fr/ua/hy/ch/br carry real translations (e.g. ua `Обране`, ch `收藏`, hy `Ընտրանի`), not English copies. No banned phrases used.
  - **Gate 10 (content-type homing) — N/A** (no doc content in S3; docs are the approved S4 slice). **Gate 11 (audience isolation) — N/A** via grep: the change touches **no** `documentation/docs/**` file.
  - **G-C2 (verify the running system, not the diff) — PASS**: independent rebuild + full regression (see Regressions).
  - **G-C5 (scope bounded by the approved plan) — PASS** via diff: 38 files, +924/−17, **all** under `odd-platform-ui/src/` — zero backend / migration / OpenAPI / generated-client. S4's scope (docs + "Asset" term + housekeeping sweep + ontology) held out.
  - **G-C9 (test integrity, both buckets) — PASS**: unit 9/9 meaningful (the no-clobber test is RED on the naive impl); **IT-148 is an ADDED real-ingestion full-loop e2e** (seeds a real TABLE, drives real `PUT`/`DELETE /api/favorites/*` with `waitForResponse … r.ok()`, asserts star/panel/tab/removal) — GREEN on `8c6c4a9d`, RED on `934b60a7` (star not found). Not vacuous.
  - **G-C10 (docs + ontology move with code) — PASS (honest deferral)**: docs none-in-S3 (the favorites user docs are the S4 deliverable on the existing `release/1.0.0` train); ontology deferred to S4 (the new FE nodes refresh with the full surface). Recorded, not asserted-unread.
  - **G-C13 (Principal sufficiency) — PASS**: tests are enough + meaningful (the slice's load-bearing no-clobber logic + the full star→see→unstar e2e); pixel-reviewed by the implementer; FE-bucket has no separate patch-coverage gate.
  - **G-C15 (test-change integrity) — N/A**: both new test files are **ADDED**, not changed; no existing test weakened, skipped, or re-pinned.

- **Regressions**: **none**. My **OWN independent rebuild** from the reviewed commit (`ODD_SUT=ref:8c6c4a9d` → `odd-platform:odd-team-sut-revctrib039`, digest **`03c0aa24`** — distinct from the implementer's `df0d7186`; the review-ctrib029 "never trust a cited digest" gap is closed):
  - **FE unit (vitest, node 24, run by me)**: full suite **86 passed / 1 failed (87)**; favorites **9/9 GREEN** (slice 6 + FavoriteStar 3). The single RED is the **pre-existing** `i18n-key-parity` offender `LinkedTermsList.tsx:63` "Unknown Error" (from #1798/CTRIB-028, a Terms file **not in the S3 diff** — tracked as **TST-056**); the parity test reports **exactly that one** offender ⇒ S3 introduced **zero** new unwrapped-literal offenders. `eslint` clean on every favorites file.
  - **feature-complete: 321 passed / 0 failed** — FULLY GREEN incl. **IT-148** (favorites star→see loop, test #125, 4.4s) + IT-146/IT-147 (#1818/#1820).
  - **multi-stack: 9 passed · ingestion-e2e: 15 passed** — GREEN (run in full, not FE-skipped).
  - **known-bugs: 3 failed = exactly the 3 expected-RED pins** (IT-007 PLT-086 attachment-ephemeral, IT-006 F-042 error-boundary, IT-004 PLT-052 DQ-unknown-status), **0 unexpected-green**.
  - **IT-148 RED proof (independent)**: against the `934b60a7` image (cached `odd-team-sut-revctrib040` `d7083974`; favorites backend merged, **no S3 FE**) IT-148 **FAILS at step 1** — `expect(locator('[data-qa="favorite-star"]')).toBeVisible()` → element not found. Confirms the test genuinely requires the FE; RED-on-base survives.
  - **i18n**: 7-locale parity GREEN (653 keys each, 0 missing/0 orphan).

- **Navigation**: consistent — no `navigation/domains/*` file references the favorites FE (FE-presentation granularity; CTRIB-038/040 precedent; no pointer shifted).

- **Banned-phrase check**: none used.

- **Upstream issues logged**: none (the change **is** the upstream code; no upstream-code discovery).

- **Doc-product editorial findings** (audit per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused owner-read of the favorites-adjacent published subtree — `main-concepts.md` (full) + `data-discovery/catalog-overview.md` (full). Both **clean** (no contradiction/drift/dead-link; the Popular-inflation + `exclude_from_search` caveats + the Catalog-Overview-vs-Overview-tab hint are exemplary). The rest of the published tree carries recent coverage (release-review-029 2026-06-26; review-ctrib040 `data-discovery/**`). Next subtree queued for the following `/review`.
  - **Findings**:
    - **DOC follow-up (forward-looking, non-blocking)** — the favorites S3 surface spans the **Catalog Overview home page** (a new panel — `catalog-overview.md` documents that page's sections top-to-bottom), the **entity detail headers + search rows** (star), and a **new top-level Favorites tab** — but the CTRIB-039 **S4 docs slice as scoped lists only `Features.md` + the "Asset" term in `main-concepts.md`**. S4 risks under-documenting the surface; it should also update `catalog-overview.md` (a Favorites-panel section), cover the detail-header/search-row stars, and add a dedicated favorites feature page, so the published manual covers every user-visible favorites surface (Gate 6 code↔doc coverage). Recorded in the S4 follow-up below.

- **Notes** (load-bearing notes end in VERIFIED):
  - **Footer**: the S3 commits carry `Co-authored-by` trailers and **no** `Sources:`/`Consumer-read:` footer — matching the accepted precedent for contributor **code** commits (S1 #1817, S2 #1819, CTRIB-040 #1820, CTRIB-038 #1818 are all the same); the `Sources` footer is a documentation-pillar device for prose claims, N/A to a code diff. VERIFIED via `git log` of the merged slices.
  - **GATE 2 not yet occurred**: PR #1821 DRAFT; `8c6c4a9d` not on `origin/main`. VERIFIED via `git ls-remote` + `origin/main` log (top `934b60a7`).
  - **Minor non-blocking observations** (folded into the S4 follow-up, not separate items): (a) the batch-hydrate no-clobber guard is **asymmetric** — `asked→false` is fill-unknowns (protects an optimistic star from a stale hydrate) but the `favorited→true` loop is unconditional, so a stale in-flight hydrate could re-set `true` over an optimistic un-star (narrow; self-heals on next hydrate). (b) `Favorites/lib.ts favoriteAssetName` falls back to a hardcoded English `Query Example #${id}` for a definition-less QE (consistent with the pre-existing untranslated QE detail title; rare path). VERIFIED via read of `favorites.slice.ts:38-43` + `Favorites/lib.ts:13-26`.
  - **Review side-effects reverted**: `lineage/**` probe drift `git checkout`-reverted (after both the main regression and the RED proof); both review stacks (`revctrib039` via run-regression teardown, `revrb039base` manually `down -v`) torn down; heavy-e2e flock released. This review commits exactly the verdict + `state/PROGRESS.md` + the `review-ctrib039` stream entry (explicit paths).

### Review follow-ups (non-blocking; tracked here for the S4 / fast-follow continuation)
1. **FavoriteStar reuse cleanup (Gate-1/G-C12)** — replace the inlined `STAR_PATH` constant with the existing shared `StarIcon` (`shared/icons/StarIcon.tsx`, byte-identical path), driving fill/outline via props (or MUI `Star`/`StarBorder`), so the favorites star is not a verbatim duplicate of the shared icon. Low priority; the contributor's own FE.
2. **S4 doc coverage (Gate 6)** — when authoring the favorites docs on `release/1.0.0`, cover every user-visible surface: `catalog-overview.md` (the new Favorites panel section), `Features.md`, the "Asset" term in `main-concepts.md`, the detail-header/search-row stars, and a dedicated favorites feature page.
3. **(optional) batch-hydrate symmetry** — consider guarding the `favorited→true` hydrate loop against clobbering an optimistic un-star, or document the eventual-consistency window. Minor.

### Post-review — maintainer running-UI feedback → completion spec (2026-06-27)
The maintainer reviewed S3 in the running UI and found the favorites surface half-built **against PRD-0001 §5 itself** (S2 deferred the 4 cross-kind facets; S3 shipped a fixed checkbox where §5.6/§5.7 specify a grouped multi-select + the shared rich row renderer) plus running-UI refinements (Star/Popular icon collision, list-row stars on QE/Term lists, FTS). A PO+SRE consult (`odd-sme`, note `lineage/odd-platform/sme-consultations/2026-06-27-favorites-s3-po-sre-critique.md`) refined + enriched the 8 notes into **PRD-0002** (`prds/0002-favorites-completion.md`) — a grouped MUST/SHOULD/COULD closure set. Requirements posted to the issue: [#1815#issuecomment-4822201796](https://github.com/opendatadiscovery/odd-platform/issues/1815#issuecomment-4822201796). **#1815 cannot be considered closed until the completion slices (Group A FE-only + Group B contract MUST) land** — S3 PR #1821 remains a correct, mergeable skeleton, no closing keyword on any slice yet. Process learning saved (PO+SRE lens belongs in feature-slice reviews, not just code-correctness).

---

## Phase D — S4 (Favorites COMPLETION, Group A FE) — PRD-0002 / comment 4822201796 — PLAN (GATE 1 pending)

**Trigger:** `/contribute #1815 taking into account comment #issuecomment-4822201796` (2026-06-28). Continues CTRIB-039 (one-CTRIB-per-issue) as **slice S4**. Stream `ctrib039s4` (`state/active-streams.yaml`).

**Live state (trust-the-tree, O4/O8/O9):** odd-platform `origin/main @ 924d49de` = S1 #1817 (`577593ae`) + S2 #1819 (`66c472e2`) + **S3 #1821 (`924d49de`) ALL MERGED** — the favorites foundation (write API, list API, FE skeleton) is fully on main; the earlier record of "S3 #1821 unmerged DRAFT" is stale. #1815 **OPEN**, milestone **1.0.0** open/semver/due 2026-07-31 (**G-C11 PASS** — re-verified live via `GET /issues/1815` + `/milestones`). Both issue comments are ours (`odd-contributor[bot]`): 4813301618 (4-slice plan) + **4822201796** (completion requirements); **no maintainer reply** — the comment is the spec to execute, not a new instruction (G-C8 — quoted data; verified it faithfully equals PRD-0002).

### Scope of S4 — Group A (FE-only, no contract change)
Per **PRD-0002 §5 Group A** + the comment's "Frontend (no API change)" group (items 1-6); the maintainer's public guidance: *"the frontend group can ship first, then the API-contract group."* S4 ships the eight FE-only completions A1-A8; **Group B (the contract changes, items 7-10) is slice S5 — explicitly excluded below.**

### Change-request product analysis (G-C16)
The change-request **is** the maintainer's own completion spec (PRD-0002 + comment 4822201796), itself the output of a running-UI **PO+SRE critique** (`lineage/odd-platform/sme-consultations/2026-06-27-favorites-s3-po-sre-critique.md`). The WHAT is maintainer-authored and product-validated; **no divergence between the issue's ask and the product-right shape to surface.** The one product judgment internal to S4: the asset-type facet is a **fixed 3-value set**, for which an autocomplete is heavier than a checkbox — but the maintainer's note 2 explicitly wants the platform multi-select-facet pattern for cross-surface consistency, **and ADR D8 already specifies "a grouped multi-select ('Asset type', default All)."** So A1 is ADR-conformance (it fixes the S3 checkbox deviation from D8), not a bespoke call. No reshape/rescope/revoke warranted.

### Design-before-build (G-C12) — all file:line verified on main @ 924d49de
**(a) Reuse-scan** (`/retrieve` + source grep):

| S4 item | Reuse | New (justified in one line) |
|---|---|---|
| **A1** asset-type facet | the autocomplete-multi-select **pattern** (`Search/Filters/FilterItem/MultipleFilterItem/MultipleFilterItemAutocomplete` + `SelectedFilterOption` chips + "Clear All" `Filters.tsx:47-65`) | `MultipleFilterItem` is hard-wired to the **search** redux slice (`getSelectedSearchFacetOptions`, `OptionalFacetNames` — `MultipleFilterItem.tsx:15`); a thin favorites-facet wrapper drives local `selectedKinds` instead |
| **A2** panel form-factor | the My-Objects **column** (`Overview/OwnerAssociation/OwnerEntitiesList/DataEntityList`) | the column is data-entity-only; favorites are mixed-kind (`DataEntityRef`\|`TermRef`\|`QueryExampleRef`) → adapt rows for mixed kinds |
| **A3** icon system | shared `icons/StarIcon` (reserve the star for Favorite) | `@mui/icons-material` is **not** a dep (verified) → add `PopularIcon` (trending) + `RecentlyViewedIcon` (clock) as `shared/icons/*` SvgIcons; re-point Popular `<StarIcon/>` (`OwnerEntitiesList.tsx:102`) → `<PopularIcon/>` |
| **A4** list-row stars | the existing `<FavoriteStar>` + the **batch-hydrate** pattern (`Search/Results/Results.tsx:83-95`) | wire into `Terms/TermSearch/TermSearchResults/TermSearchResultItem` + `DataModelling/QueryExampleSearchResults/QueryExamplesList` |
| **A5** rich rows | the catalog **result-row** layout (`Search/Results/ResultItem`); **the payload already carries the rich refs** — ADR **D3** (resolve live from the ref, never denormalize) | a favorites row renderer that degrades per-kind |
| **A6** empty/loading/error | `EmptyContentPlaceholder` + `SkeletonWrapper` | an explicit error state on tab + panel |
| **A7** a11y | `FavoriteStar`'s existing `aria-pressed`/label contract (`FavoriteStar.tsx:59-61`) | aria on the facet autocomplete |
| **A8** DISABLED label | `useAppInfo().authType === 'DISABLED'` (already used `Overview.tsx:26`) | "(shared)" suffix + the don't-run-DISABLED caveat copy |

> **FINDING (shrinks Group B):** `FavoriteAsset` already embeds the **full** `DataEntityRef` (entityClasses/internalName/externalName/status/url), `TermRef` (name/namespace/definition/updatedAt), and `QueryExampleRef` (definition/query — genuinely sparse). The current sparse row is because `FavoritesListItem.tsx:44-48` only renders `favoriteAssetName` + a kind label — **not** because the payload is thin. So **A5 rich rows are fully FE-only and need no backend; PRD-0002 B3 (payload enrichment) largely evaporates.** Recorded for S5: re-scope B3 down to any residual missing field only (e.g. a DE description/created-at if the row wants one the ref lacks).

**(b) ADR-check:** S4 **conforms to** `adrs/drafts/favorites-recently-viewed-foundation.md` — **D2** (3-kind `AssetKind`), **D3** (resolve live from refs → A5), **D4** (multi-select facets → A1; the 4 cross-kind facets are S5), **D8** (grouped multi-select "Asset type" → A1 fixes the S3 checkbox deviation). **No new ADR; G-C7 does NOT fire** — S4 is additive FE only (no migration, no auth-posture change, no wire-contract change).

**(c) Impact-dimension checklist:**
- **Generated clients (BE+FE):** NONE — Group A introduces **no** OpenAPI change (the FE-first / no-contract property — the reason it ships first).
- **i18n — ALL 7 locales** (en/es/fr/ua/hy/ch/br): any new keys (facet "Clear All" if absent, "Favorites (shared)", error copy, the trending/clock labels) added to every catalog; the S3 favorites keys are already 7-locale.
- **Consumers of a changed signature:** the `FavoriteStar` refactor to reuse `StarIcon` — its only sibling consumer of `StarIcon` is `OwnerEntitiesList.tsx:102`, which A3 re-points to `PopularIcon`; no other consumer (grep-verified).
- **Migrations:** none. **Docs:** `documentation` `release/1.0.0` train (step 14). **Ontology:** `/enrich --touched` the favorites FE nodes at end (lineage/** currently dirty with unowned probe drift — reconcile/route-around first).

**(d) PO/SRE lens:** PRD-0002 §3 (PO enrichment — shared-foundation discipline so PLT-250 Recently-Viewed inherits; global icon system; empty/loading/error; a11y; DISABLED labelling) + §4 (SRE flags — Group-A-relevant: A8's DISABLED open-posture caveat; the rest are Group B's faceted-read concerns). Folded into A1-A8.

### The plan — S4 deliverables (Group A)
- **A1 (MUST)** Replace `FavoritesAssetTypeFilter`'s checkbox group (`FavoritesAssetTypeFilter.tsx`) with the platform multi-select-facet pattern (autocomplete + selected chips + "Clear All"), driving local `selectedKinds`. Conforms to ADR D8.
- **A2 (MUST)** Re-render `FavoritesPanel` (`Overview/FavoritesPanel/FavoritesPanel.tsx`) with the My-Objects column form-factor, adapted for mixed kinds; keep it in its own always-on band outside the owner gate (already so — `Overview.tsx:54`).
- **A3 (MUST)** Global icon system: add `PopularIcon` (trending) + `RecentlyViewedIcon` (clock); re-point Popular (`OwnerEntitiesList.tsx:102`) to `PopularIcon`; reserve the star for Favorite; refactor `FavoriteStar` to reuse shared `StarIcon` (removes the byte-identical `STAR_PATH` duplicate — **folds in review-follow-up #1**).
- **A4 (MUST)** `<FavoriteStar>` on Terms (`TermSearchResultItem`) + Query-Examples (`QueryExamplesList`) list rows, **batch-hydrated per list** (one `getFavoriteStatus` call — the `Results.tsx:83-95` pattern). Also tighten the batch-hydrate no-clobber symmetry (**review-follow-up #3**).
- **A5 (MUST)** Rich Favorites-tab rows reusing the catalog result-row layout; resolve namespace/type/updated/description **from the refs already in the payload** (ADR D3); degrade per-kind (QE has no namespace).
- **A6 (MUST)** Empty / loading (skeleton) / error states on the tab + panel.
- **A7 (MUST)** a11y on the facet autocomplete + the new list-row stars (FavoriteStar's aria contract already holds).
- **A8 (SHOULD)** Under `auth.type=DISABLED`, label the surface "Favorites *(shared)*" + carry the don't-run-DISABLED-in-production caveat.

### Scope EXCLUSIONS (deliberately NOT in S4 — G-C5) → slice S5 (Group B)
- **B1** the 4 cross-kind facets (namespace/datasource/tag/owner) + the exclude-a-kind rule — needs the OpenAPI list-endpoint contract change + Java/TS client regen + JOOQ.
- **B2** `entity_class_ids[]` server-side refinement **+ the taxonomy-flatten** (entity classes at the same level as Terms/QE) — the FE flatten is inseparable from the BE filter, so it rides S5, not S4 (avoids shipping a facet showing options it can't filter by).
- **B3** payload enrichment — **largely evaporated** (reuse-scan finding); S5 re-scopes to any residual field only.
- **B4** full-text search over favorites — needs new backend (per-kind tsvector + QE `ILIKE` fallback).
- **C2/C3 (COULD)** sort control; star-reach to lineage / DEG / Directory.
- **Closing keyword** stays off the S4 PR (and every slice) until Group A+B MUST land — PRD-0002 §7.

### Tests (S4) — both buckets (G-C9)
- **Unit (vitest → odd-platform CI):** the favorites-facet wrapper (`selectedKinds` ↔ chips/Clear-All), the per-kind rich-row field resolution + per-kind degrade, the batch-hydrate symmetry fix, the DISABLED-label branch. RED-on-base where the behaviour is new.
- **Integration (extend IT-148, the star→see loop):** add (i) select an asset-type in the **multi-select facet** → assert the list narrows; (ii) **star from a Term/QE list row** → see it on the tab. Assertions from a **captured real DOM** (G-C9 — observed once, not assumed). RED on `ODD_SUT=ref:main` (924d49de — the S3 skeleton has the checkbox + no list-row stars), GREEN on the fix.
- **Full regression** via `integration-tests/run-regression.sh ctrib039s4` (feature-complete green + multi-stack green + known-bugs still-RED + ingestion-e2e green) — the gate, not the impacted IT alone.

### Docs / ontology routing (G-C10/G-C11)
- **Docs:** `documentation` `release/1.0.0` train (unreleased favorites behaviour). Cover the completed surface (review-follow-up #2): `catalog-overview.md` (Favorites panel section), a favorites feature page, the "Asset" term in `main-concepts.md` (ADR D8), the detail/search/list-row stars; carry the DISABLED admonition. Paired backlog DOC item (`milestone: 1.0.0` + post-merge URLs).
- **Ontology:** `/enrich --touched` over the favorites FE nodes once lineage/** is clean; commit + re-embed.

### GATE 1 — decisions surfaced to the maintainer (2026-06-28)
Self-decided (one-sentence calls, recorded not asked): (i) **continue CTRIB-039** as slice S4 (one-CTRIB-per-issue), not a new CTRIB-041; (ii) **A8 included** in S4 (cheap, SHOULD); (iii) the **B3-evaporation** re-scope is noted for S5, not acted on now. Surfaced for approval (AskUserQuestion): the **S4 = Group A scope + PR granularity**.

**GATE 1 — APPROVED (2026-06-28).** RamanDamayeu selected **"Approve — Group A, one PR"** (AskUserQuestion): S4 ships all 8 FE-only items (A1-A8) as **one DRAFT PR** `contrib/CTRIB-039-favorites-completion-fe`; Group B → slice S5. **No new scope comment** posted — the FE-first/BE-second split is already public in comment 4822201796 and S4 = exactly that "frontend group", so the issue thread already reflects S4's scope (also respects the G-C6 one-comment rate-limit). Proceeding to Phase D implementation.

### Phase D — S4 implementation (worktree `../odd-platform-ctrib039-s4` off `924d49de`)

Branch `contrib/CTRIB-039-favorites-completion-fe` (same-name-tracked, push.default=current, NOT main-tracked — `@{u}` unset; LSN-038). 7 commits, **22 files, +393/−122, all `odd-platform-ui/src`** (G-C5 — zero backend/OpenAPI/migration/generated-client):

- **A1** `FavoritesAssetTypeFilter.tsx` — the S3 checkbox group → the platform multi-select-facet pattern (MUI `Autocomplete` resets-on-pick + removable chips + "Clear All", the catalog `Filters.tsx` shape; `MultipleFilterItem` itself is search-slice-bound so a thin favorites wrapper drives local `selectedKinds`). Input carries `aria-label` (A7). Conforms to ADR D8.
- **A2** `Overview/FavoritesPanel/FavoritesPanel.tsx` — reshaped to the My-Objects **column form-factor** (reuses the shared `DataEntityList` styles: `DataEntityListContainer` card + `SectionCaption`), star caption, own always-on band outside the owner gate.
- **A3** icon system — new `PopularIcon` (trending) + `RecentlyViewedIcon` (clock) SvgIcons (`@mui/icons-material` not a dep → custom `shared/icons` pattern); `OwnerEntitiesList.tsx:102` Popular `<StarIcon/>` → `<PopularIcon/>`; `StarIcon.tsx` is now the single source of the star path (`STAR_ICON_PATH`, `currentColor`); `FavoriteStar.tsx` reuses it (removes the byte-identical duplicate — **review follow-up #1 closed**).
- **A4** list-row stars — `<FavoriteStar>` on `TermSearchResultItem` (Dictionary list) + `QueryExamplesListItem` (standalone list, opt-in `showFavorite` prop so the linked-QE tables are unaffected), each batch-hydrated in `TermSearchResults`/`QueryExamplesList` (the `Results.tsx:85-95` pattern).
- **A5** `FavoritesListItem.tsx` — rich rows from the refs the payload already carries (ADR D3): DE class-chips + status, Term namespace + definition, QE query; per-kind degrade. New lib helpers `favoriteAssetNamespace` / `favoriteAssetDescription`. **(Finding: `DataEntityRef` lacks namespace/created-at → the data-entity row's namespace/created/description still need B3/S5; A5 ships what the refs carry — a real richness gain FE-only.)**
- **A6** `Favorites.tsx` — explicit loading (skeleton) / error (retry) states beside the empty state.
- **A8** `Favorites.tsx` + `FavoritesPanel.tsx` — under `auth.type=DISABLED`, "Favorites **(shared)**" + the don't-run-disabled-auth caveat (`useAppInfo().authType`).
- **i18n** — 4 new keys (`Favorites (shared)`, `Couldn't load your favorites.`, `Try again`, the caveat) across ALL 7 locales (en/es/fr/ua/hy/ch/br); parity preserved (657 each).

### Verification (run, not reasoned)

- **tsc `--noEmit`** (full project): clean. **eslint** (changed files): clean (prettier `--fix` applied). Local env: the worktree's `node_modules`/`generated-sources` are gitignored → symlinked/copied from the shared `../odd-platform` checkout (same commit) for the local typecheck/lint.
- **vitest (unit, node 24 via docker — vite 7 needs node ≥20)**: **15/15 pass** — new `Favorites/__tests__/lib.test.ts` (3, per-kind resolution, RED-on-base: the helpers are new) + `FavoritesAssetTypeFilter/__tests__/…test.tsx` (3, chips + Clear All) + the existing slice (6) + FavoriteStar (3). The facet test wraps the render in the MUI `ThemeProvider` (the shared harness only provides the styled-components one — no existing test renders a custom `Button`).
- **Integration (G-C9) — IT-148 EXTENDED** (`integration-tests/e2e/specs/favorites-star-see-loop.spec.ts` + protocol): the existing star→see loop now asserts the A8 "(shared)" label; **+2 tests**: A1 (the tab facet is a `combobox`, not a checkbox group) and A4 (star a Term from the `/termsearch` Dictionary row → it appears on `/favorites`). Assertions from captured real shapes (`role=combobox`, `[data-qa="favorite-star"]`, `/api/favorites/TERM/{id}`). **GREEN on the working-tree SUT** (`odd-platform:odd-team-sut-ctrib039s4`, digest `a55c387a`) — feature-complete tests **#125/#126/#127 PASS**. RED-on-base by construction (924d49de has no combobox, no "(shared)" label, no Dictionary-row star); the `ODD_SUT=ref:main` proof runs after the flock frees.

### DoD ledger (the five gates)

1. **Full unit build / vitest** — GREEN (15/15; tsc + eslint clean). *(The odd-platform CI runs vitest in its node-24 step; reproduced here via docker.)*
2. **FULL integration regression** (`run-regression.sh ctrib039s4`, SUT `a55c387a` ← worktree, flock-serialized): **feature-complete 322 passed / 1 failed** — the 1 = **TST-054** `direct-bind-create` F-172 (the documented owner-association affordance-timeout flake, **contributor-independent / delta-0 on `ref:main`**, unrelated to favorites) ⇒ **GREEN-for-change**, IT-148 #125-127 GREEN. **known-bugs 3-RED** (the expected pins, 0 unexpected-green). **multi-stack + ingestion-e2e — running** (results pending). RED-base IT-148 proof — pending the flock.
3. **Docs** — authored + committed on the documentation **`release/1.0.0`** train (`72e244d`): new `favorites.md` + catalog-overview Favorites section + the "Asset" term + SUMMARY; paired **DOC-493** (`pending-release`, milestone 1.0.0, post-merge URLs). Publishes at the 1.0.0 release gate (G-C11).
4. **Ontology (G-C10)** — **no refresh** (FE-presentation only; the favorites feature-flow nodes describe the backend write/list API, which S4 does not change — CTRIB-038/040/S3 precedent). The `lineage/**` drift present (`feature-flows.yaml` + the getPopular/getDataEntityDetails sidecars + `2026-06-28-P-001.yaml`) is the regression's incidental **P-001 probe** run, not authored ontology work → reverted (not committed).
5. **Principal sufficiency (G-C13)** — enough + meaningful tests (the per-kind row logic + the facet + the full e2e completion surface); FE has no separate patch-coverage gate; pixel/running-UI review via the SUT — **the e2e drives the real rendered facet, list-row star, shared-label, and rich rows** (the running surface, not just a green unit). *(A static screenshot can be attached at GATE 2 if the maintainer wants it.)*
