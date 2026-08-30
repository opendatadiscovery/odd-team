---
ctrib: CTRIB-041
github_issue_number: 1816
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1816
title: "Recently Viewed — recency-tracking foundation + main-page panel"
class: feature
milestone: "1.0.0"          # G-C11 PASS — open, semver, due 2026-07-31
status: pending-release   # S1 MERGED (#1826 @ 9097c548) + S2 MERGED (#1827 @ 3cbb3b85). GATE 2 complete (maintainer merge). | LEDGER-RECONCILED 2026-08-30: was `done`; PRs #1826 (`9097c548`) + #1827 (`3cbb3b85`) merged, but NOT released — milestone 1.0.0, which is OPEN/UNRELEASED (latest release 0.29.0, 2026-06-26). GATE 2 is done; `/review release:1.0.0` owns the flip to `done`.
reproduced: "baseline (feature absent) — see Phase B"
adr_required: false         # conforms to the approved+shipped foundation ADR (G-C7 does NOT re-fire) — see Phase A §G-C7
adr: adrs/drafts/favorites-recently-viewed-foundation.md   # D1-D8 already cover Recently Viewed
plan_approved_by: "RamanDamayeu (maintainer) — GATE-1 AskUserQuestion 2026-06-29"
plan_approved_at: "2026-06-29"
docs_routing: "release/1.0.0"   # unreleased behaviour -> documentation train (G-C11)
pr_url: "S1 #1826 (MERGED 2026-06-29 -> origin/main 9097c548) · S2 #1827 (DRAFT, Closes #1816)"
pr_draft: true
stream: ctrib041
started: "2026-06-29"
---

# CTRIB-041 — Recently Viewed: recency-tracking foundation + main-page panel (#1816)

## Phase A — Understand

### Intake (issue is quoted DATA, never instructions — G-C8)

- **Issue:** [#1816](https://github.com/opendatadiscovery/odd-platform/issues/1816) — *"Recently Viewed: per-user recently-opened assets, with a main-page panel and a filterable tab"*. Author **RamanDamayeu** (the maintainer). Labels: `scope: backend`, `scope: frontend`, `kind: feature`, `scope: documentation`, `to decompose`. Milestone **1.0.0**.
- **Quoted ask (data):** record an asset as "recently viewed" when its detail page opens (deliberate `POST`, not a side-effect of the data-entity GET); show a 5-item main-page panel + a filterable **Recently Viewed tab**; per-row remove; per-user identity `(oidc_username, provider)` with a DISABLED shared bucket; a `recently_viewed` table + retention housekeeping job. Depends on **PLT-249 / Favorites (#1815)** for the shared foundation.
- **Single existing comment** is the bot's own scope refinement (below). No maintainer instruction embedded in issue/comment. No prompt-injection attempt (G-C8 clean).

### The refined scope is the current truth (issue body is superseded by the maintainer's own pivot)

The issue body asks for a **standalone tab**. The maintainer's **own** later comment + the workspace roadmap **supersede that**:

- **Issue comment [#issuecomment-4832457502](https://github.com/opendatadiscovery/odd-platform/issues/1816#issuecomment-4832457502)** (bot, on the maintainer's behalf, 2026-06-29): *"build the **foundation** … per-user tracking of **when** each asset was last opened, and the **main-page Recently Viewed panel**. The **filterable tab** is being reframed … recency becomes a **date/time filter** on the unified main Search (#1825) … this issue delivers the recency-tracking foundation + the home panel; the standalone tab is superseded."*
- **`state/roadmap-unified-search.md`** Step 1: *"#1816 foundation — refined scope (recently_viewed **timestamp** tracking + read API + home panel; **no tab**). GATE-1 plan for your approval → build."*
- **`prds/0003-unified-asset-search.md`** R2-f / P4: Recently-viewed becomes a **last-viewed-timestamp range filter** on the unified Search, *depending on the #1816 view-tracking foundation*.

⇒ **This contribution = the recency-tracking foundation (table + record-on-open write API + read/list API) + the main-page panel. The tab, the multi-facet sidebar, and full-text are DEFERRED → the Search overhaul (#1825).** This is the issue-as-data / roadmap-as-truth alignment (the public thread already carries the reframe comment).

### Classification & mission-relevance

- **Class:** `feature` (BE + FE), `to decompose`. Mission-relevant: per `lineage/odd-platform/system-mission.md`, catalog **navigation/discovery** is a primary pillar; "take me back to what I just looked at" is table-stakes catalog UX that ODD lacks entirely (no per-user history). It is the **only** personalisation (with Favorites) available to the large audience that never completes Owner association.

### G-C11 — Milestone gate: **PASS**

`GET /repos/opendatadiscovery/odd-platform/issues/1816` → milestone **`1.0.0`**, state **open**, semver, due `2026-07-31`. Open milestones: `1.0.0` only. No self-assignment needed.

### G-C7 — Architectural-significance check: **does NOT re-fire** (conforms to an approved+shipped ADR)

The three G-C7 classes assessed:

- **(a) Destructive migration?** No — `V0_0_95` is an **additive** `CREATE TABLE recently_viewed` (+ index). No drop/alter/backfill.
- **(b) Auth/security-posture change?** No **new** posture. RV reuses the *already-shipped* favorites posture: identity from the security context only (`CurrentUserIdentityResolver`), principal-scoped reads, **no new RBAC** (reads already fall through to `.authenticated()`), DISABLED shared sentinel. The PII-adjacent angle (browsing history) is handled by the **same** principal-scoping + a retention TTL + non-possessive "(shared)" labelling — all enumerated in the approved ADR/PRD.
- **(c) Breaking public-contract change?** No — new **additive** paths (`/api/recently-viewed/*`); zero change to existing endpoints.

**The architecture was already decided and approved**: `adrs/drafts/favorites-recently-viewed-foundation.md` is literally the *"Favorites & Recently-Viewed"* foundation ADR; **D1** (identity), **D2** (polymorphic `(asset_kind, asset_id)`, 3-kind enum), **D3** (no-denormalization read path), **D4** (faceted list, order-then-semi-join, cap `size`), **D6** (no new RBAC) all cover RV explicitly. Favorites shipped on this ADR; RV **conforms** to it — no NEW ADR is warranted. *(ADR-pillar bookkeeping note: this ADR is realized in merged code yet still sits in `adrs/drafts/`; promotion to the ADR-log is a separate follow-up, not a blocker here.)* The maintainer's GATE-1 approval is the explicit human sign-off the gate requires.

### G-C16 — Change-request product analysis (critique the WHAT before the HOW)

- **User problem, restated independent of the issue's proposed solution:** *A user who opened a dataset/term/query example yesterday must re-search for it today — ODD keeps no per-user history, so there is no "back to what I was just looking at."*
- **PO/SRE lens** (reasoned inline + grounded in the maintainer's existing SME consult `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md`; no fresh `odd-sme` spawn — the product shape is settled by the PRD + the maintainer): "Recently viewed" is table-stakes in every comparable catalog (DataHub, Atlan, Collibra). The **recency-foundation + home panel** is the right MVP; the **tab→Search-filter** reframe is sound — it avoids accreting a *third* parallel list surface (the explicit PRD-0003 thesis). **Recency ≠ popularity** (the issue is careful here: `recently_viewed` timestamps = *when*; the existing `view_count` "Popular" = *how often* — independent).
- **Options considered:** (1) **Build foundation + panel now, defer the tab** *(recommended — matches the maintainer's pivot)*; (2) build the full tab as the issue body literally says *(rejected — superseded by #1825; would build a surface slated for immediate retirement — the PRD-0002 Group-B mistake)*; (3) revoke *(rejected — the feature is valuable and SRE/security-reviewed)*.
- **Divergence from the issue's literal ask** (the tab) is **already public** on the thread (the reframe comment) and is the maintainer's own decision — so it is carried, not silently absorbed. The finer in/out boundary (per-row remove, operator flag) is a GATE-1 decision below.

## Phase B — Baseline (feature absent) + the RED-proof plan

This is a feature, so "reproduce-first" = establish the baseline that the capability is **absent**, and define the RED→GREEN proof for Phase D.

- **Baseline (verified against `main @ da2932e1`):** `grep -rn "recently_viewed\|RecentlyViewed\|recently-viewed" odd-platform-api/src/main` → **no matches**; latest migration is `V0_0_94__create_favorite.sql` (no `recently_viewed`); spec has no `/api/recently-viewed` path; FE has `RecentlyViewedIcon.tsx` but **no panel / no redux / no hook**. ⇒ the endpoints 404 and no panel renders, by construction.
- **RED proof (Phase D):** the integration e2e (open an asset detail → see it in the home Recently-Viewed panel) **FAILS on `ODD_SUT=ref:main`** (no endpoint, no panel) and **PASSES on the working-tree SUT** (the fix). Unit tests fail-to-compile/404 on base by construction; the behavioural RED is the IT.

## Phase C — Design-before-build (G-C12) + the Plan

### Reuse-scan (do NOT rebuild the favorites foundation) — grounded in `file:line`

| Need | Reuse (merged #1815) | Action |
|---|---|---|
| Identity `(username, provider)` + DISABLED sentinel | `auth/CurrentUserIdentityResolver.java:20-29` (`resolve(): Mono<UserDto>`, `__shared__/DISABLED`) — javadoc already says *"(Favorites, and later Recently-Viewed)"* | **reuse as-is** |
| Polymorphic asset model (3 kinds) | spec `components.yaml:315 AssetKind`, `:325 AssetRef`, `:340 AssetRefList`; `dto/AssetRefDto.java` | **reuse as-is** |
| Read path: ordered `(kind,id)` page → renderable items, inheriting visibility | `service/FavoriteAssetResolver.java:33-119` (resolveDataEntities/Terms/QueryExamples + `isVisible` + order preservation) — but typed to `FavoritePojo`/`FavoriteAsset` | **GENERALIZE** → shared resolver (below) consumed by both Favorites + RV |
| Repo patterns (UPSERT, ordered page, count) | `repository/reactive/ReactiveFavoriteRepositoryImpl.java:28-110` (jOOQ `onConflict…doUpdate`, `orderBy …desc`, `DateTimeUtil.generateNow()`, `JooqReactiveOperations`) | **mirror** for `recently_viewed` (simpler — hard delete, no `deleted_at`) |
| Service shape (resolve → page+count → resolve → list; `MAX_PAGE_SIZE=100` cap) | `service/FavoriteServiceImpl.java:18-71` | **mirror** (order by `last_viewed_at`) |
| Thin controller over generated API | `controller/FavoriteController.java:18-48` | **mirror** (`RecentlyViewedApi`) |
| Retention job (auto-registered) | `housekeeping/HousekeepingJobManager.java:23-39` injects `List<HousekeepingJob>`, `@Scheduled` 15m, ShedLock, `@ConditionalOnProperty(housekeeping.enabled)`; sample `job/AlertHousekeepingJob.java` | **add** `RecentlyViewedHousekeepingJob implements HousekeepingJob` (@Component auto-registers) |
| TTL config | `housekeeping/config/HousekeepingTTLProperties.java` + `application.yml:172` (`*_days`) | **extend** (`recently_viewed_days`, `recently_viewed_max_per_user`) |
| Home panel (lg=3 column, DISABLED-aware caption, empty-state, 5 items) | `…/OwnerEntitiesList/FavoritesColumn/FavoritesColumn.tsx` placed in `OwnerEntitiesList` (Overview.tsx:56, always-visible) | **mirror** → `RecentlyViewedColumn` |
| The clock/history icon | `components/shared/icons/RecentlyViewedIcon.tsx` **already exists** | **reuse as-is** |
| Redux slice/thunks/selectors/lib | `redux/{slices,thunks,selectors,lib}/favorites.*` | **mirror** → `recentlyViewed.*` |

**The one design decision worth GATE-1 attention — generalize the resolver, don't duplicate it.** `FavoriteAssetResolver` is the order-preserving, visibility-inheriting semi-join (ADR D3/D4). Copying its ~80 lines into a parallel `RecentlyViewedAssetResolver` is the exact LSN-035 duplication smell. **Recommended:** extract its core into a shared component (e.g. `AssetRefResolver` / `ResolvedAssetService`) that takes an ordered list of `(kind,id)` and returns the per-kind resolved refs; **both** `FavoriteServiceImpl` and `RecentlyViewedServiceImpl` decorate the result into their own list-item type (`FavoriteAsset` / `RecentlyViewedAsset`). *Trade-off (transparent):* this touches merged favorites code, so the **favorites regression (IT-148 + unit) must stay green** — the integration regression already measures that.

### ADR-check
Conforms to `adrs/drafts/favorites-recently-viewed-foundation.md` (D1-D8). No deviation → no new/G-C7 ADR. (Promotion of that draft ADR to the published ADR-log = a separate adr-pillar follow-up.)

### Impact-dimension checklist (each handled-here or deferred-with-a-logged-item)
- **OpenAPI + generated clients:** new `recently-viewed` paths + `RecentlyViewedAsset(List)` schemas (reuse `AssetKind`/`AssetRef`) → regenerate **BE + FE** clients. Handled (slice 1 spec; slice 2 FE client).
- **Migration:** `V0_0_95__create_recently_viewed.sql` (additive) + **JOOQ regen**. Handled (slice 1).
- **Every consumer:** the generalized resolver's only consumers are the two services — both updated in slice 1; no other signature changes.
- **i18n:** new strings (`Recently Viewed`, `Recently Viewed (shared)`, `Assets you open will appear here.`) in **all** locale files. Handled (slice 2; not en-only).
- **Docs + ontology:** release/1.0.0 train doc + `/enrich --touched`. Handled (DoD).
- **Tests:** unit (repo/service/controller/housekeeping/resolver) + an integration IT-149. Sufficiency set here, verified at G-C13.

### Product-Owner / SRE lens (feature-shaped)
- **Write path (the load-bearing SRE call).** Record from a **deliberate** `POST /api/recently-viewed {asset_kind, asset_id}` fired by the FE on detail-open (debounced/deduped) — **NOT** by widening `GET /api/dataentities/{id}` (already a hot path with `incrementViewCount`; also misses terms/QE which have no `view_count`). **Recommended write shape:** resolve `(username, provider)` **in-chain** then UPSERT (`ON CONFLICT … DO UPDATE SET last_viewed_at = now()` — move-to-top), returning `204` after the single **indexed** UPSERT. This is correct, R2DBC-non-blocking, and **avoids the documented security-context footgun** of a bare `.subscribe()` (which loses the Reactor principal — PRD §7.1). *Note:* I deliberately do **not** implement literal "fire-and-forget" `.subscribe()` — gating a `204` on one indexed UPSERT is cheaper than the async-error/backpressure complexity, the FE already fires it as a non-blocking background call, and it sidesteps the principal-loss bug. (Flagged for the maintainer to veto at GATE 1 if literal async is wanted.)
- **Unbounded growth (RV records on every open).** A `RecentlyViewedHousekeepingJob` trims by **TTL days** (`recently_viewed_days`, default 90) **and newest-N-per-user** (`recently_viewed_max_per_user`, default ~200) — both the PRD's named guards; orphaned rows are invisible on read (the resolver drops deleted assets) and TTL-collected, so an explicit orphan sweep is a low-priority noted refinement.
- **DISABLED honesty.** The panel labels "Recently Viewed (shared)" with shared-bucket subtext (mirrors `FavoritesColumn`'s `appInfo.authType === 'DISABLED'` check), never personal history.
- **Panel "View all".** Favorites' panel links "View all" → the `/favorites` tab. RV has **no tab** → the panel ships as a 5-item widget **without** "View all" (the deep-link to `/search?recently_viewed` arrives with Search P2). Roadmap-consistent.

---

## The Plan (GATE-1 artefact)

**Goal:** deliver the Recently-Viewed **recency-tracking foundation + main-page panel** for #1816 (1.0.0), reusing the merged favorites foundation; defer the tab/facets to the Search overhaul (#1825).

### Recommended decomposition — 2 slices (mirrors the favorites BE→FE rhythm), stacked on `main`

**Slice S1 — Backend foundation** (`contrib/CTRIB-041-recently-viewed-foundation`)
1. **Spec** (`odd-platform-specification`): `components.yaml` add `RecentlyViewedAsset` (= `FavoriteAsset` shape + `last_viewed_at`) + `RecentlyViewedAssetList`; `openapi.yaml` add `POST /api/recently-viewed/{asset_kind}/{asset_id}` (record-on-open, `204`) + `GET /api/recently-viewed/list` (`asset_types` + page/size, `last_viewed_at DESC`). Reuse `AssetKind`/`AssetRef`.
2. **Migration** `V0_0_95__create_recently_viewed.sql` (PRD §7.6: `recently_viewed` + unique `(oidc_username,provider,asset_kind,asset_id)` + index on `(…,last_viewed_at DESC)`; UTC; no FK; hard delete) → **JOOQ regen**.
3. **Repo** `ReactiveRecentlyViewedRepository(+Impl)`: `recordView` (UPSERT move-to-top), `getRecentlyViewedPage` (`last_viewed_at DESC`), `count`. Job-side: TTL + newest-N delete queries.
4. **Generalize** `FavoriteAssetResolver` → shared `AssetRefResolver`; rewire `FavoriteServiceImpl` to it (favorites behaviour unchanged).
5. **Service** `RecentlyViewedService(+Impl)` (resolve identity → record / list via the shared resolver; `MAX_PAGE_SIZE=100`).
6. **Controller** `RecentlyViewedController implements RecentlyViewedApi`.
7. **Retention** `RecentlyViewedHousekeepingJob` + `HousekeepingTTLProperties.recentlyViewedDays/recentlyViewedMaxPerUser` + `application.yml`.
8. **Unit tests** (odd-platform CI): repo (BaseIntegrationTest — UPSERT move-to-top, order, count), service (StepVerifier — identity, cap), controller (`@WebFluxTest`), housekeeping (BaseIntegrationTest — TTL + newest-N), shared resolver (favorites + RV both resolve, visibility inherited). 98% patch-coverage locally (G-C13).

**Slice S2 — Frontend foundation + home panel** (`contrib/CTRIB-041-recently-viewed-panel`)
1. FE generated client regen → `RecentlyViewedApi` + models.
2. `recentlyViewed` redux (slice/thunks/selectors/lib), mirroring favorites.
3. **Detail-open POST hook** — fire `recordView({assetKind, assetId})` on DataEntityDetails / TermDetails / QueryExampleDetails open (lookup tables via their `DATA_ENTITY` id — ADR D2); debounced/deduped client-side.
4. **`RecentlyViewedColumn`** in `OwnerEntitiesList` (mirror `FavoritesColumn`; `RecentlyViewedIcon`; "Recently Viewed"/"(shared)"; empty-state "Assets you open will appear here."; no "View all").
5. **i18n** all locale files.
6. **Integration `IT-149`** (odd-team; Playwright): open an asset → it appears in the home RV panel; re-open moves it to top. RED on `ref:main`, GREEN on the working-tree SUT.
7. **Docs** (release/1.0.0 train): Features — Recently Viewed (record-on-open, home panel, DISABLED "(shared)" caveat, retention/TTL operator note) + paired backlog **DOC item** (`milestone: 1.0.0`, `pending-release`, post-merge URLs). Read the live page first (G-C10).
8. **Ontology** `/enrich --touched` the new RV nodes + "Recently Viewed" concept + feature-flow; committed (G-C10).

### Explicit scope EXCLUSIONS (deliberately NOT in this contribution — G-C5)
- **The standalone Recently-Viewed tab** + its multi-facet sidebar (Namespace/Datasource/Tag/Owner) + full-text → **superseded by the Search recency filter (#1825)**; the read API here is what that filter consumes.
- **Per-row remove (`DELETE`) / "Clear all" / operator-side erasure hook** → fast-follow (the panel does not need it; privacy is met by principal-scoped reads + TTL). *(GATE-1 Q2 can pull `DELETE` in.)*
- **`recently-viewed.enabled` operator flag** → fast-follow (defaults-on requirement is met by shipping the panel; the flag only *hides* it). *(GATE-1 Q2.)*
- **Batch `POST /recently-viewed/status`** (favorites has it for star rendering) → not needed; RV has no per-row affordance on other views.

Each exclusion is tracked here (and, on GATE-1 approval, summarized in a public scope comment on #1816).

### Test plan, docs routing, ontology — summary
- **Unit → odd-platform CI** (`scripts/run-platform-tests.sh` full `:odd-platform-api:build`). **Integration → odd-team `IT-149`** via `run-suite.sh`; **full regression** via `run-regression.sh ctrib041` (feature-complete green incl. favorites IT-148 — the resolver refactor must not regress it; multi-stack green; known-bugs still-RED; ingestion-e2e green). RED proof: `ODD_SUT=ref:main`.
- **Docs routing:** `release/1.0.0` train (unreleased) + paired `pending-release` DOC item (G-C11).
- **Ontology:** committed `/enrich --touched` at DoD when `lineage/**` is clean+unclaimed.

### Drafted scope comment for #1816 (post on GATE-1 approval — one comment, G-C6)
> **Scope for the Recently-Viewed foundation work.**
> This delivers the **recency-tracking foundation + the main-page panel**, in two parts:
> 1. **Backend** — a `recently_viewed` store, a record-on-open write (`POST /api/recently-viewed`, deduped move-to-top), a read/list API ordered by recency, and a retention housekeeping job (TTL + newest-N per user).
> 2. **Frontend** — recording an asset when its detail page opens, and a 5-item **Recently Viewed** panel on the home page (labelled "Recently Viewed (shared)" under `auth.type=DISABLED`).
>
> **Deferred** (tracked, not dropped): the standalone *tab* and its facet sidebar are superseded by the unified Search recency filter (#1825) — this foundation is exactly what that filter reads; per-row remove / "clear all" / the operator hide-flag are a thin fast-follow. Per-user identity `(username, provider)`, principal-scoped reads, and the DISABLED shared bucket follow the shipped Favorites foundation.

## GATE 1 — APPROVED (2026-06-29, maintainer RamanDamayeu, via AskUserQuestion)

**Decomposition:** approved — **2 slices (BE → FE)**, stacked on `main`.

**Scope ADDITIONS the maintainer attached (now in scope — they expand "the panel" into a complete recency capability):**

1. **Per-row remove is IN, and principal-scoped (security).** `DELETE /api/recently-viewed/{asset_kind}/{asset_id}` resolves identity from the security context and scopes the delete to `(oidc_username, provider)` — **a user can remove only their own rows, never another user's**. Under `auth.type=DISABLED` removal operates on the shared sentinel bucket (global shared). This is **explicitly unit-tested** (user A's delete cannot touch user B's row; DISABLED → shared). (Retention housekeeping TTL+newest-N also stays IN — Q2 options 1 **and** 2.)
2. **Cross-surface recency UX (new).** Show the **"recently viewed at"** value **+ a remove control** on **(a)** the asset's **detail/overview page** and **(b)** the **list/row surfaces** — rendered only when that asset is in the current user's RV set. ⇒ needs a **batch status endpoint** `POST /api/recently-viewed/status` (refs → `[{asset_kind, asset_id, last_viewed_at}]`, principal-scoped), the RV analog of `POST /api/favorites/status`, so a list page / detail page hydrates recency in one call. (This pulls the batch-status endpoint back IN — it was excluded in the pre-approval draft.)
3. **Search recency date-filter (relative + absolute), modeled on `/api/activity`.** The **filter UI** lands with the Search overhaul (**#1825**, deferred), but the **foundation read API supports it now**: `GET /api/recently-viewed/list` gains `viewed_after` / `viewed_before` (`string`/`date-time`, matching Activity's `begin_date`/`end_date` at `openapi.yaml:3488-3499`). Relative presets ("last 7 days") are an FE concern that #1825 computes into absolute bounds — not built here.

**Updated scope EXCLUSIONS (deferred → #1825 / fast-follow):**
- The standalone Recently-Viewed **tab** + its multi-facet sidebar → **Search #1825** (the read API here is its data source).
- The recency **date-filter UI** (the Activity-style relative/absolute picker) → **Search #1825** (the API params ship now).
- The **`recently-viewed.enabled` operator hide-flag** → fast-follow (defaults-on requirement met by shipping the surface).
- The **"Clear all history"** bulk control → fast-follow (per-row remove is the MVP erasure control; operator-side `(username,provider)` erase hook is a noted fast-follow).

**Build spec delta (folded into S1/S2):**
- **S1 spec/API:** add `POST /api/recently-viewed/status` (batch) + `DELETE /api/recently-viewed/{asset_kind}/{asset_id}` (principal-scoped) + `viewed_after`/`viewed_before` on the list GET. `RecentlyViewedAsset` carries `last_viewed_at`.
- **S1 backend:** repo gains `getRecentlyViewed(refs)` (batch status) + `removeRecentlyViewed(user,provider,kind,id)` (principal-scoped hard delete); service+controller expose status + remove; the principal-scoping security unit test is mandatory.
- **S2 FE:** a reusable **recency affordance** (the "viewed at" value + remove) used on detail pages **and** list rows, hydrated by the batch status; IT-149 asserts the cross-surface display + self-only removal.

**Write-path shape:** unchanged from the plan — identity in-chain → UPSERT → `204` (not literal `.subscribe()`; avoids the Reactor security-context footgun); maintainer did not object.

**GitHub writes (this run):**
- GATE-1 scope comment posted on #1816 → [issuecomment-4832923391](https://github.com/opendatadiscovery/odd-platform/issues/1816#issuecomment-4832923391) (odd-contributor[bot]; reflects the approved foundation scope above).

**Next:** Phase D — S1 (backend foundation) in the isolated worktree `../odd-platform-ctrib041`.

## Phase D — S1 (backend foundation) — COMPLETE → DRAFT PR #1826

**Branch:** `contrib/CTRIB-041-recently-viewed-foundation` @ `3eb3b0ff` (off `origin/main` da2932e1; same-name-tracked, never main — O6/LSN-038). **DRAFT PR:** [#1826](https://github.com/opendatadiscovery/odd-platform/pull/1826) (`Part of #1816`, draft, auto-close-check CLEAN). Worktree `../odd-platform-ctrib041`; SUT tag `odd-platform:odd-team-sut-ctrib041`.

**Files (21):** spec `components.yaml` (+RecentlyViewedAsset/List/Ref) + `openapi.yaml` (+4 paths); migration `V0_0_95__create_recently_viewed.sql`; `service/AssetRefResolver` (new shared core) + `FavoriteAssetResolver` (now adapter) + `RecentlyViewedAssetResolver` (new); `repository/reactive/ReactiveRecentlyViewedRepository(+Impl)`; `service/RecentlyViewedService(+Impl)`; `controller/RecentlyViewedController`; `housekeeping/job/RecentlyViewedHousekeepingJob` + `config/HousekeepingTTLProperties` + `application.yml`; 7 test classes.

**Test ledger (DoD):**
- **Unit / full CI replica** — `:odd-platform-api:build` GREEN @ `3eb3b0ff` (`scripts/run-platform-tests.sh`): test + checkstyleMain + checkstyleTest + jacocoTestReport + assemble. **Changed-file coverage 100% line** on every new class (AssetRefResolver 46/46, RecentlyViewedServiceImpl 35/35, RecentlyViewedController 7/7, RecentlyViewedAssetResolver 20/20, FavoriteAssetResolver 15/15, RecentlyViewedHousekeepingJob 27/27; repo impl exercised by its 8-method integration test, excluded from the jacoco report set). G-C13 met locally.
- **Integration / FULL e2e regression** — `run-regression.sh ctrib041`, SUT `6e4a0148` ← worktree `3eb3b0ff`:
  - `feature-complete` **323 pass / 1 fail** = GREEN-FOR-CHANGE. The 1 fail is `favorites-star-see-loop.spec.ts:159` "Favorites tab **Description column** … (#1815 **Group B**)" — a co-stream spec (odd-team `6c62efe`) for an **unmerged** platform feature: `data-qa="favorite-description"` is **absent on main + my SUT** (present only on the unmerged `contrib/CTRIB-039-favorites-group-b`), so it is deterministically RED on any non-Group-B SUT (the documented co-stream "unmerged-fix spec" pattern). My diff touches NO favorites FE / NO spec; the **core favorites IT-148** (tests 125/126/127, star→see loop) **GREEN** — the AssetRefResolver refactor preserves favorites.
  - `known-bugs` **3 fail = expected-RED / 0 unexpected-green**; `multi-stack` **9 pass**; `ingestion-e2e` **15 pass**.
- **RED proof** — S1 has no new e2e (IT-149 ships in S2). The RV backend's RED→GREEN is at the unit/integration-test level: the `recently_viewed` table + the repository/service/controller/housekeeping tests do not exist on `ref:main` (RED by construction) and pass on the branch.

**Docs (G-C10):** none in S1 — no user-visible surface yet; the user-facing Recently Viewed docs ship with the S2 frontend on the documentation `release/1.0.0` train (paired DOC item at S2 DoD).

**Ontology (G-C10):** deferred to S2 DoD — the feature spans S1+S2; refresh `/enrich --touched` the new RV nodes (+ a "Recently Viewed" concept + feature-flow) once the full feature exists and `lineage/**` is clean+unclaimed (currently dirty with unowned prior-run P-001 probe drift → route-around, O10).

**Principal sufficiency (G-C13):** enough + meaningful tests (incl. the principal-scoped-delete security test + DISABLED shared-bucket); 100% changed-file line coverage; no control lost; existing favorites behaviour preserved (regression green-for-change). No UI in S1 (the pixel review applies to S2).

**Status:** S1 = `pr-draft` → `/review` (separate session) → `review-ready` → human GATE-2 merge. CTRIB stays open (closes when #1816 closes on the final slice). **Proceeding to S2 (frontend)** per the maintainer's "continue with S2 once the regression passes."

**S1 GATE 2 — MERGED.** The maintainer merged DRAFT PR #1826 (2026-06-29) → `origin/main` **9097c548** (squash). S2 was rebased onto the merged main (`contrib/CTRIB-041-recently-viewed-panel` reset to 9097c548; the RV FE client regenerated from the main spec).

## Phase D — S2 (frontend) — COMPLETE → DRAFT PR #1827 (Closes #1816)

**Branch:** `contrib/CTRIB-041-recently-viewed-panel` @ `feb0bafe` (off merged main 9097c548; same-name-tracked, never main). **DRAFT PR:** [#1827](https://github.com/opendatadiscovery/odd-platform/pull/1827) (`Closes #1816` — final slice; the tab is the separate #1825; draft, live-verified Closes present). Worktree `../odd-platform-ctrib041`; SUT tag `odd-platform:odd-team-sut-ctrib041`.

**Files (33):** redux `recentlyViewed.{slice,thunks,selectors,actions}` + `lib/recentlyViewed.ts` + the slice `__tests__` + barrels (slices/thunks/selectors/actions index) + `interfaces/state.ts` (`RecentlyViewedState`) + `lib/api.ts` (`recentlyViewedApi`); `lib/hooks/useRecordRecentlyViewed.ts` + index; `components/shared/elements/RecentlyViewedTag/*` + index; `components/Overview/.../RecentlyViewedColumn/*` + `OwnerEntitiesList.tsx`; `components/RecentlyViewed/lib.ts`; the record-hook wiring in `DataEntityDetails` / `TermDetails` / `QueryExampleDetailsContainer`; the recency-tag wiring in `DataEntityDetailsHeader` / `TermDetailsHeader` / `ResultItem` (beside FavoriteStar); 7 locale JSONs.

**Test ledger (DoD):**
- **Unit FE** — `tsc --noEmit` clean · `eslint` clean (after prettier) · **`vitest` GREEN** (recentlyViewed.slice 6/6 + favorites.slice 6/6 = 12/12, under node 24). The FE has no jacoco gate (backend-only); the slice logic is covered by the slice test + IT-149.
- **Integration / FULL e2e regression** — `run-regression.sh ctrib041`, SUT built from worktree `feb0bafe`:
  - `feature-complete` **324 pass / 1 fail** = GREEN-FOR-CHANGE. **IT-149 (`recently-viewed-record-see-loop.spec.ts:45`) GREEN** (test 264 ✓). The 1 fail is the SAME co-stream Group-B favorites Description-column test (`favorites-star-see-loop.spec.ts:159`) — unmerged feature, not in this branch (S1 verdict unchanged).
  - `known-bugs` **3 fail = expected-RED** (IT-007/IT-006/IT-004) / **0 unexpected-green**; `multi-stack` **9 pass**; `ingestion-e2e` **15 pass**.
- **RED→GREEN proof for IT-149 (run-confirmed, both halves):** GREEN on the fix (feb0bafe, regression test 264 ✓); **RED on `ref:main`** (`ODD_SUT=ref:main run-suite.sh IT-149`, SUT 9097c548) → **1 failed**: `page.waitForResponse … timeout` at `recordOnOpen` — the record-on-open POST never fires (the entire RV frontend is absent on main). The test discriminates the feature (not neutered).

**Docs (G-C10):** **AUTHORED + committed on the documentation `release/1.0.0` train** @ `aa7b651` — `data-discovery/recently-viewed.md` (new) + `catalog-overview.md` (a Recently Viewed section) + `SUMMARY.md`; paired **DOC-494** (`pending-release`, milestone 1.0.0, post-merge URLs). Recency-vs-Popular distinction stated; the deferred `enabled` flag is NOT documented (unbuilt). Live-site verify is scheduled at the 1.0.0 release gate.

**Ontology (G-C10):** **DEFERRED — no refresh now + why.** `lineage/**` is dirty with unowned prior-run/regression P-001 probe drift (route-around, O10); `/enrich` is single-writer and cannot run on a dirty tree. RV is FE-presentation on the merged S1 backend; refresh the RV nodes (+ a "Recently Viewed" concept + feature-flow) at the next clean+unclaimed window / the 1.0.0 release ontology pass. Precedent: CTRIB-038/039/040 (FE-presentation deferral).

**Principal sufficiency (G-C13):** enough + meaningful tests (the slice batch-hydrate test + the cross-surface IT-149 e2e, both run-proven RED→GREEN); the UI pixel review is captured (`test-results/it149-recently-viewed-panel.png`, G-C12 step 5) for the reviewer; reuse over duplication (Favorites lib + RecentlyViewedIcon); no control lost; existing favorites behaviour preserved (regression green-for-change). The cross-surface marker self-hydrates without clobbering optimistic state; recency is kept distinct from view-count Popular.

**Status:** S2 = `pr-draft` → `/review` (separate session) → `review-ready` → human GATE-2 merge of #1827 (which closes #1816). The two slices: S1 #1826 MERGED; S2 #1827 DRAFT. Docs ride the 1.0.0 train (DOC-494, pending-release).
