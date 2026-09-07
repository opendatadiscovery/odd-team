---
id: CTRIB-067
title: "#1844 ST-10 — Last viewed: a per-identity, cross-kind datetime-range scope over the #1816 recently_viewed history on the unified search (UTC instants on the wire, ISO in the URL), the Recently-viewed ordering coupled to it, and the Recently Viewed panel's View all (#1832)"
github_issue: 1844
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1844
also_closes: "#1832 (the panel's View all — wholly delivered by this slice; the PR carries `Closes #1832` beside `Closes #1844`)"
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live `GET /repos/opendatadiscovery/odd-platform/issues/1844` 2026-09-06: milestone 1.0.0 (#29), state OPEN, semver, due 2026-12-31; #1832 carries the same milestone and is also OPEN — both re-verified live at the GATE-1 packet (19 open / 15 closed at that read)
status: planned           # Phases A–C complete (planning session 2026-09-06); GATE 1 pending — the packet is §8. Phase D+ is executed later by a different model against §9 (the runbook).
classification: feature   # a slice of the #1825 epic (ST-10 in state/search-overhaul-decomposition.md :156); entry gate = spec-gate (G-C17), not reproduce-first
parent: "#1825 (the unified-asset-search overhaul); realises ADR adrs/drafts/unified-asset-search.md D3 (the 'Recently viewed (datetime)' row of the facet table, joined per current identity) + D8 (the panel as a deep-link widget) + D10 / D11; depends on #1816 (CTRIB-041 — MERGED #1826 backend + #1827 frontend) — UNBLOCKED"
stream_id: ctrib067
base_sha: "0238005c"      # odd-platform origin/main at intake (= the #1881 CTRIB-066 squash); every line cited below was read at this SHA via the detached worktree ../odd-platform-ctrib067
branch: contrib/CTRIB-067-recently-viewed-facet   # cut at GATE 1 from 0238005c (or the then-current origin/main, re-diffed) in ../odd-platform-ctrib067 via `git switch -c` (no upstream; push.default=current on the clone — verified; O6/LSN-038)
head_sha:                 # Phase D
pr:                       # Phase E — odd-platform DRAFT (base main) + documentation DRAFT (base release/1.0.0)
reproduced: "n/a — feature slice, not a bug. BASELINE captured on a running stack built from main @ 0238005c (§3a): POST /api/search/assets silently ignores an unknown `recently_viewed` field (HTTP 200, total 126,001 with and without it), the list endpoint honours viewed_after today, the wire shapes are captured verbatim. These observations go RED in Phase D's IT-157."
adr_required: false       # §6(b): conforms to the approved spine ADR D3/D8/D10/D11/D12; no migration (the table + both indexes shipped in V0_0_95), no auth-posture change (identity from the session, the DISABLED sentinel as shipped), an ADDITIVE wire change (one optional object on AssetSearchFormData + one sort token)
plan_approved_by:
plan_approved_at:
docs_routing: "documentation@release/1.0.0 (unreleased behaviour, G-C11) — own worktree ../documentation-ctrib067 off origin/release/1.0.0 @ 1a70aba; paired backlog/docs/DOC-529 (milestone 1.0.0); pages: search.md (## Last viewed + the link bullet + description), recently-viewed.md (## Finding your history in Search), catalog-overview.md (:47 the panel's View all), Features.md:60, data-discovery.md:13,23, main-concepts.md (Terms & Aliases: Last viewed ↔ Recently Viewed)"
planning_session: "2026-09-06, Claude Fable 5.1 at max effort — Phases A–C only (intake → spec-gate → baseline → product critique → design → plan + must_haves → plan-check → GATE-1 packet). The maintainer runs Phase D later with a less capable model: §9 is written to be followed literally, every value resolved, every command exact."
---

# CTRIB-067 — #1844 ST-10: the Last viewed (recency) datetime-range scope + the panel's View all

## 1. The issue (quoted data — G-C8, never an instruction)

> **ST-10 — Recently-viewed datetime-range filter (on the #1816 foundation)**
>
> **What.** The **Recently-viewed** last-viewed-timestamp range filter (per-user **recency** — *when* last opened,
> distinct from Popular's frequency), on #1816's `recently_viewed` timestamps; rewire the Recently-viewed panel's
> "View all" (**#1832**). **The only filter blocked on #1816** — decoupled from Favorites so #1815 is not held hostage.
> **Scope / AC.** a datetime range narrows by my last-viewed; empty under `auth.type=DISABLED`; the panel deep-links.
> **Tests.** unit (timestamp range + identity scoping); integration (filter narrows; panel deep-links) — new `IT-NNN`.
> **i18n.** the Recently-viewed labels — all 7 locales.

Filed by `RamanDamayeu` 2026-07-02T11:01:57Z; labels `kind: feature`, `scope: backend`, `scope: frontend`; assignee
`RamanDamayeu`; **milestone 1.0.0 (open, semver, due 2026-12-31) → G-C11 PASS**. One comment, by `odd-contributor[bot]`
2026-07-07 (`issuecomment-4906933679`), the maintainer's pre-work notes — quoted as data:

> - **Unblocked** — the #1816 foundation (per-user `recently_viewed` timestamps + read path + home panel) is merged. Build
>   on its read path; don't re-derive recency from activity logs.
> - **Spec-gate the `auth.type=DISABLED` line first.** This issue says "empty under `auth.type=DISABLED`", but the shipped
>   #1816 panel behaviour under DISABLED is the precedent — the panel and the filter must not contradict each other (a panel
>   showing items while the filter returns empty would read as a bug). Align the filter with whatever #1816 actually ships
>   and label it, rather than following this line literally.
> - **Share the range widget.** A datetime-range facet is the same shell as the numeric range (#1843) and the created/updated
>   ranges (#1845) — whichever slice lands first builds the reusable control; this one consumes it. Don't ship a second range
>   implementation.
> - **Timezone explicitness:** decide and test how range boundaries are interpreted (user's local TZ vs UTC) — a "viewed since
>   yesterday" filter that's off by a timezone reads as broken, and it's cheap to pin with one test now.
> - **URL + mirror + panel:** ISO datetime params, fail-closed on junk; add them to the `Search.tsx` facet→URL mirror merge (the
>   #1858 dropped-selection class); rewire the Recently-viewed panel's "View all" (#1832) to the pre-filtered search (the #1852
>   pattern). i18n: all 7 locales.

The sibling **#1832** (OPEN, milestone 1.0.0, `status: blocked` on #1825), quoted as data: *"the panel's header (and/or a
"View all" link) should deep-link into the unified Search with the recently-viewed filter applied — i.e. Search scoped to
the current user's assets whose `last_viewed_at` is not null, most-recent-first … This issue must conform to #1825's final
shape … Trivial once #1825 lands: a link + the correct target state + a small e2e asserting the panel → filtered Search
round-trip (assert the user-observable result, not a forced navigation)."*

No instruction-shaped text in any body (nothing asks the agent to bypass anything); nothing to log under G-C8.

## 2. Classification + intake

| Field | Value |
|---|---|
| Class | **feature** — a new scope on a shipped surface. Nothing is broken; there is nothing to reproduce (G-C1 n/a). A running-stack BASELINE was still captured (§3a) so Phase D's IT has a named RED |
| Entry gate | **spec-gate (G-C17)**: the WHAT is a *shape* ("a datetime range narrows by my last-viewed", "the panel deep-links") with three places the issue's own words are stale or silent (the DISABLED line, the ordering, the widget) — §4 |
| Epic? | **No** — one slice of an already-decomposed epic (`state/search-overhaul-decomposition.md` ST-10; roadmap `state/roadmap-unified-search.md` P2 "scope filters"). Its siblings ST-7 (#1841 / CTRIB-061), ST-8 (#1842 / CTRIB-062) and ST-9 (#1843 / CTRIB-066) shipped on this exact rail and are the pattern to conform to. #1832 is folded in because it is, in its own words, "a link + the correct target state + a small e2e" once the filter exists |
| G-C7 hard stop? | **No.** No migration — `recently_viewed` + both indexes shipped in `V0_0_95` (#1826). No auth / security-posture change — the identity comes from the security context via the shipped `CurrentUserIdentityResolver` (the DISABLED sentinel as shipped), never from the request; nothing per-user is exposed that `GET /api/recently-viewed/list` does not already expose to the same caller. No breaking wire change — one OPTIONAL object on `AssetSearchFormData` (the unified path only, ADR D9) and one additive sort token |
| Mission relevance | `lineage/odd-platform/system-mission.md:77-80` P-01 Data Discovery ("search the catalog with free text + facets"); the #1825 thesis (one query language, one result list, one spec in two surfaces — ADR D10/D11); the #1816 promise ("a user who opened an asset can find it again") finishes here — the panel was always meant to lead somewhere (#1832) |
| Streams | `state/active-streams.yaml` → `ctrib067` (registered; `verified_live` refreshed). **No co-active stream** — every other entry is terminal. `lineage/**` clean; heavy-e2e flock unheld |
| Isolation | worktree `../odd-platform-ctrib067` detached @ `0238005c` (the branch is cut at GATE 1). Plan-time baseline stack `ctrib067probe` on 18430/15630 running the CACHED image `odd-platform:odd-team-sut-ctrib066close` (id `bfb16e65`, built 2026-09-06 18:57 by the ctrib066close post-merge regression from `origin/main` @ `0238005c` — verified live: schema `0.0.101`, the ST-9 facet endpoint answers 200). Phase-D namespace reserved for the executor: `ctrib067` on 18440/15640 (+ 18441/15641 for the RED `ref:main` stack) |

## 3. What is actually on `main` @ `0238005c` — the pre-work comment, checked line by line

| Claim | Checked |
|---|---|
| "Unblocked — the #1816 foundation is merged" | **TRUE.** `V0_0_95__create_recently_viewed.sql`: `recently_viewed(id, oidc_username, provider, asset_kind, asset_id, last_viewed_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'UTC'))`; UNIQUE `recently_viewed_identity_asset_key (oidc_username, provider, asset_kind, asset_id)` — **one row per user+asset** (the invariant that makes an inner join safe, §6); `recently_viewed_identity_ts_idx (oidc_username, provider, last_viewed_at DESC)` — a bare `DESC` (= `DESC NULLS FIRST`) — the index that serves both the window and the ordering (§4a). `ReactiveRecentlyViewedRepositoryImpl.recordView` is an UPSERT that moves the row to now (`:28-43`); `getRecentlyViewedPage` orders `LAST_VIEWED_AT DESC, ID DESC` and honours `viewedAfter`/`viewedBefore` inclusively (`:83`, `:110-115`); `RecentlyViewedServiceImpl` resolves the identity via `CurrentUserIdentityResolver` and converts the wire `OffsetDateTime` bounds to UTC `LocalDateTime` through `DateTimeUtil.mapUTCDateTime` (`atZoneSameInstant(UTC)`, `DateTimeUtil.java:15-20`); `GET /api/recently-viewed/list?viewed_after&viewed_before` (`openapi.yaml:608-648`) — "the data source for the unified Search recency filter" in its own description. Retention: `housekeeping.ttl.recently_viewed_days: 90` + `recently_viewed_max_per_user: 200` (`application.yml:176-177`; `RecentlyViewedHousekeepingJob`) — the history is **bounded to ≤ 200 rows per identity**, which is the whole performance story (§4a) |
| "empty under auth.type=DISABLED" (the issue) vs "align with what #1816 ships" (the comment) | **The comment is right; the AC line is stale.** `CurrentUserIdentityResolver.resolve()` never completes empty — under DISABLED it yields the sentinel `(__shared__, DISABLED)` (`:21-28`), so the shared bucket EXISTS and FILLS from everyone's opens; the panel renders it as "Recently Viewed (shared)" (`RecentlyViewedColumn.tsx:32,44`); the Favorites filter works on the same sentinel with the label + the consequence tooltip (`FavoritesFilter.tsx:70-87`); only My data hides itself, and only because nobody on such a deployment can ever use it (`MyDataFilter.tsx:87-90`). A filter that answers empty while the panel it is linked from shows five rows is the tile↔list contradiction ST-9 ruled out → **GATE-1 decision D1** (§5.4) |
| "Share the range widget" | **The shell is reusable; its slider is not.** `RangeFacetFilter.tsx` (ST-9) hardwires a MUI `Slider` over discrete stops between its chrome (heading `Label` + info tooltip, qualifier, presets, chip, `disabledReason`). A datetime range is *picked*, not slid (NN/g via the SME note; a 90-day window would be ~90 stops on a ~200 px rail). The platform already ships ONE date-range control — `AppDateRangePicker` (`react-multi-date-picker`, two months, `portal`-rendered, footer presets + Done, local start/end-of-day — `AppDateRangePicker.tsx:30-52,90-104`), driving the Activity + Alerts "Period" filter (`CalendarFilter.tsx`). So: extract the shell's CHROME into `RangeFacetShell` with the rail body as a slot; the slider stays the Popularity body, the picker + preset links become the Last viewed body; ST-11's Created/Updated reuse the same date body (§6a). Not a second facet visual language |
| "Timezone explicitness" | **Decided + pinned by tests (§4 R5, §7 Step 8).** The user picks local calendar days; the URL/wire carry absolute UTC instants (`Z`); the server compares inclusively against UTC `last_viewed_at`; a recipient in another zone gets the same instants and sees them as their own local days |
| "ISO datetime params, fail-closed on junk; the `Search.tsx` mirror merge (the #1858 class)" | **Real and load-bearing.** `Search.tsx:119` (`popularity: live.popularity,` inside the `writeStateToUrl` merge object whose comment says "EVERY URL-ONLY PARAM MUST BE LISTED HERE") — the new dimension joins it. The URL module `searchUrlState.ts` (594 lines) carries the fail-closed parse idioms to mirror: `parsePopularity` (`:337`), the `favorites` allow-list (`:74-83`), `SEARCH_SORT_OPTIONS` (`:162`), `defaultSortForContext` (`:181`), `resolveActiveSort` (`:196`), the two projections (`:491`, `:567`) |
| "rewire the panel's View all (the #1852 pattern)" | **Currently absent, by design note.** `RecentlyViewedColumn.tsx:24-25`: "there is no 'View all' yet — the full recency view arrives as the Search recency filter (#1815/#1825)". The sibling `FavoritesColumn.tsx:27,101-111` renders `View all` → `buildSearchLink({ favorites: 'yes' })` when the column has rows; the Popular tile links `sort=popularity&popularity_min=1` (`OwnerEntitiesList.tsx`) because a filter reproduces a threshold, not an order — #1832 asks for "most-recent-first", which is an ORDER → §5.5 |
| "i18n: all 7 locales" | `odd-platform-ui/src/locales/translations/{br,ch,en,es,fr,hy,ua}.json` — **707 keys each** (parity holds); `Recently viewed` (`en.json:651`, the list-column header), `Recently Viewed (shared)` (`:650`), `Assets you open will appear here.` (`:652`), `View all` (`:658`), `Done` (`:536`) exist. The repo's own guard `src/locales/__tests__/i18n-key-parity.test.ts` is a vitest CI does not run (CTRIB-061 R8) — run and cited in Phase D |
| (not in the comment) the **saved-search** representation | `SavedSearch.spec` is the FULL `AssetSearchFormData` since #1878 (`components.yaml:2650-2705`), so an object carried on `AssetSearchFormData` PERSISTS automatically — but `assetSearchFormDataToUrlState` (`searchUrlState.ts:567-594`) projects back only what it knows and `SavedSearchServiceImpl.sanitiseSpecTree` (`:175-185`) sanitises only `asset_kinds` / `favorites` / `popularity`. Without both halves this slice would EXTEND the LSN-042 class (a saved search that silently drops the new dimension) — in scope, never a deferral (G-C5 class-extension clause) |
| (not in the comment) the **sort contract** | `SearchSortDto` = RELEVANCE / STATUS_PRIORITY / UPDATED_AT / NAME / POPULARITY (`:16-27`); `resolveEffective(sortParam, hasQuery)` (`:45`) folds the per-context defaults; the keyset engine (`ReactiveAssetSearchRepositoryImpl` `seekBranchPredicates :179`, `keysetSortValueField :235`, `outerOrderFields :245`, `toPageRow :259`, `orderFields :533`) and the fail-closed cursor (`AssetSearchCursor.parsesForSort :149`, the NOT-NULL guard `:128`) are the branches a new sort must mirror; the legacy `/api/search` session explicitly REJECTS the unified-only token (`ReactiveDataEntityRepositoryImpl.java:1020` `.filter(requested -> requested != SearchSortDto.POPULARITY)`, pinned by `LegacySearchSortFallbackTest`) — the pattern a second unified-only token follows |
| (not in the comment) the **results row** | `ResultItem.tsx:155` already renders `RecentlyViewedTag` on every unified-search row ("Viewed 2 hours ago" + remove) — per-row transparency for a recency-filtered list is ALREADY shipped (CTRIB-042); nothing to build, one thing to assert (IT-157 case 12) |
| (not in the comment) the **results empty state** | `Results.tsx:96` (`isFavoritesScope`) + `:207` (`'Star an asset to pin it here.'` vs `'No matches found'`) — the teaching-empty idiom ST-7 installed; the recency scope gets its two states the same way (§4 R10) |

**Existing unit-test homes (Testcontainers `BaseIntegrationTest`, the UNIT bucket):** `AssetSearchServiceIntegrationTest`
(ST-4), `AssetSearchSortIntegrationTest` (ST-5a, with the `explainUnionOrderBy` "no Sort node" oracle `:255`),
`AssetSearchKeysetPaginationTest` (ST-5b, the tampered-cursor cases `:152`), `AssetSearchFavoritesIntegrationTest` (ST-7 — the
identity-scoped narrowing template with the "other identity's row must not leak" case), `AssetSearchServiceMyDataTest` (ST-8,
Mockito — the repository mock arities `:167-171`), `AssetSearchScopePredicateTest` (`:151,235,244` call sites),
`AssetSearchPopularityIntegrationTest` (ST-9, `seedDataEntity` / `seedTerm` / `form()` helpers), `AssetSearchControllerWebTest`
(`:79-131` the range + facet web cases), `SavedSearchControllerWebTest:121` + `SavedSearchServiceImplTest:206` (the stored-range
normalisation cases), `LegacySearchSortFallbackTest` (`:42,:59`), `ReactiveRecentlyViewedRepositoryImplTest` (`pageHonorsDateWindow`
`:90` — the existing bounds oracle). **Integration:** IT-148 (Favorites: the DISABLED label + info + teaching empty), IT-149
(Recently Viewed open→see loop), IT-152/153 (My data), IT-155 (saved-search round-trip: `saveCurrentSearch` / `reapply` helpers
`:82-113`), IT-156 (Popularity: the `settled` / `gotoSearch` / `seedViews` idioms) — next free id **IT-157**; e2e specs under
`integration-tests/e2e/specs/`, seeds via `helpers/db.ts` (`seedSearchableEntity(id, name)` `:708`, `seedSearchableTerm(name)` `:669`,
`dbQuery(sql, params)` `:29`).

### 3a. Baseline on a running stack built from `main` @ `0238005c` (2026-09-06, stack `ctrib067probe`, the cached post-merge image)

Captured verbatim; each line is a RED that Phase D's tests must flip:

| Observation | Value |
|---|---|
| `POST /api/search/assets?size=1` body `{"query":"","filters":{}}` on the 126k corpus | `200`, `total 126001` |
| … with `"recently_viewed":{"viewed_after":"2026-09-01T00:00:00Z"}` | `200`, `total 126001` — **the field is silently ignored** (the additive-contract posture: an unknown property is dropped, never a 4xx) |
| … with `"recently_viewed":{}` | `200`, `total 126001` — same |
| `POST /api/recently-viewed/DATA_ENTITY/2900001` | `204` — a row `(__shared__, DISABLED, DATA_ENTITY, 2900001, 2026-09-06 19:26:35.92593)` stored in **UTC** (`db now() at time zone 'UTC'` = `19:26:37`) |
| `POST /api/recently-viewed/status` `[{"asset_kind":"DATA_ENTITY","asset_id":2900001}]` (raw wire) | `[{"asset_kind":"DATA_ENTITY","asset_id":2900001,"last_viewed_at":"2026-09-06T19:26:35.92593Z"}]` — snake_case, a `Z` instant |
| `GET /api/recently-viewed/list?page=1&size=100&viewed_after=<now−25h Z>` | `items 2, total 2` — exactly the two seeded rows at 10 h / 20 h; the bounds are honoured **today** on the list endpoint (the oracle the search predicate must agree with) |
| `GET /api/recently-viewed/list?viewed_after=junk` (and `2026-13-45T99:99:99Z`, and a bare `2026-09-01`) | **`400`** `{"code":"USR001","message":"Type mismatch.",…}` — the shipped date-time binding rejects junk AND the zone-ambiguous bare date, never a 500; a valid `…Z` answers 200 |
| `POST /api/search/assets` page shape (raw wire) | `page_info` keys `hasNext, nextCursor, scopeTruncated, scopeTruncationReason, total`; item keys `asset_kind, data_entity, query_example, term`; a DE ref carries `entity_classes, external_name, has_alerts, id, internal_name, is_stale, manually_created, oddrn` |

## 4. `## Spec` — the falsifiable WHAT (G-C17)

Grounded in: the source at `0238005c` (§3); the running-stack baseline (§3a); the 1.0.0 doc train @ `1a70aba`
(`search.md`, `recently-viewed.md`, `catalog-overview.md`, `Features.md`, `data-discovery.md`); the spine ADR
`adrs/drafts/unified-asset-search.md` (D3 / D8 / D9 / D10 / D11 / D12 / the cross-cutting security bar); the foundation ADR
`adrs/drafts/favorites-recently-viewed-foundation.md` (D1 identity, D2 the polymorphic pair, D6 no new RBAC); the `odd-sme`
consult `lineage/odd-platform/sme-consultations/2026-09-06-recently-viewed-datetime-facet.md` (its checkable claims re-verified in
§5.3); and a **plan-time measurement on main's exact code at 126k assets** (§4a).

| # | Requirement | Current (`0238005c`) | Target | Acceptance (falsifiable) |
|---|---|---|---|---|
| **R1** | A **recency scope** narrows the unified search to the caller's own history | `POST /api/search/assets` ignores `recently_viewed` (§3a); the only recency read is `GET /api/recently-viewed/list` | `AssetSearchFormData.recently_viewed: RecentlyViewedScope {viewed_after?, viewed_before?}` (UTC `date-time`, inclusive). **The object's PRESENCE is the switch**: `{}` = every asset in the caller's history ("any time"); a bound narrows further by `last_viewed_at`. Applied to the page **and** the count, inside the keyset seek, **and** to the ST-9 popularity histogram (the bars must describe the list the user gets) | on a seeded corpus: `{}` returns exactly the caller's history ∩ eligible assets (a not-viewed FOIL absent); `{viewed_after: T}` returns the rows with `last_viewed_at >= T` and drops the older one; `{viewed_before: T}` symmetric; both = the window; `total == rows` under every shape; a keyset page 2 no dup/skip; Σ popularity-histogram counts == the DE count of the same scoped request |
| **R2** | **Cross-kind, per-identity** — data entities, terms and query examples alike; only the caller's own rows | `recently_viewed` keys on the polymorphic `(asset_kind, asset_id)` — DE, TERM, QUERY_EXAMPLE (`RecentlyViewedController:24-52`); the favorites predicate is the cross-kind precedent (`ReactiveAssetSearchRepositoryImpl:455-463`) | the scope joins `recently_viewed` on `(oidc_username, provider)` from the security context (never the request) + the `(asset_kind, asset_id)` pair; **no kind guard, no "Data entities only" qualifier** (a term absent from my history is truly unopened by me — unlike Popularity, where terms are uncounted) | a term and a query example in the history are listed; a data entity another identity opened (and the caller did not) is ABSENT — the leak foil (`AssetSearchFavoritesIntegrationTest` shape); the DISABLED sentinel bucket is what a no-context test sees |
| **R3** | **Fail closed** — the rail's shipped posture | `sort` → default; `asset_kinds`/`my_data` unknown tokens dropped; `popularity` junk → the whole range dropped (`searchUrlState.ts:323-350`) | **Server:** an inverted window (`viewed_after > viewed_before` after UTC normalisation) ⇒ an EMPTY page (`falseCondition`, "a scope resolving to nothing narrows to nothing"); a non-`date-time` value is rejected by the request binding (**400 `USR001` — measured on the shipped binding, §4 open question 5**, never a 500; a bare `YYYY-MM-DD` is rejected there too, so the server and the FE parser agree). **FE parser:** the dimension is ON iff `recently_viewed=yes` OR at least one bound parses; junk in EITHER bound, or an inverted pair, ⇒ the WHOLE dimension absent (no chip, unfiltered list; the junk sits in the address bar until the next mirror write normalises it — the `popularity` rule, `searchUrlState.ts:96-102`); a parsed bound is CANONICALISED to a UTC `Z` instant on write. **Three surfaces take an inverted window, and each answer is deliberate — state them together so none reads as a bug:** a LIVE request ⇒ an empty page (the filter is contradictory, and a contradictory filter narrows to nothing); a URL ⇒ the whole dimension dropped (hand-edited junk means no filter); a STORED SPEC ⇒ both bounds dropped, the scope kept as "any time" (the client did intend a recency scope — R9, and it is what the server's sanitiser already does on read) | API `{viewed_after: 2026-09-07T…, viewed_before: 2026-09-01T…}` → `200`, `total 0`, `items []`; API `{viewed_after: "junk"}` → `400`, never `5xx` (web test); URL `?viewed_after=junk` → no chip, unfiltered (vitest + IT); URL `?viewed_after=2026-09-01T00:00:00%2B03:00` → the chip shows the local day and the mirror rewrites `viewed_after=2026-08-31T21:00:00.000Z` |
| **R4** | The **URL** carries the scope in ONE canonical representation and **survives every other control** (the #1858 class) | the mirror merges `sort / assetKinds / myData / depths / favorites / entityClasses / popularity` (`Search.tsx:101-121`) | params `viewed_after` / `viewed_before` (ISO-8601 UTC `Z`, the API's own names) and `recently_viewed=yes` **only when the scope is on with no bound** (bounds imply on; the serialiser never writes both) — so a control-written URL, the mirror's rewrite and a saved spec are byte-identical; merged in the mirror; cleared by the single Clear All **together with a dangling `sort=last_viewed`** (R6) | vitest identity round-trip for the four shapes; IT: with the scope on, ticking a Statuses facet leaves the params in the URL and the narrowing in force (1.5 s later too); Clear All removes them and the sort token |
| **R5** | **Timezone explicitness** — local days in, exact instants out | the shipped Period filter writes local `startOfDay`/`endOfDay` as instants (`AppDateRangePicker.tsx:52`); the server compares UTC (`DateTimeUtil.mapUTCDateTime`) | the user picks CALENDAR DAYS in the browser's zone; a preset or the picker produces local start-of-day (and end-of-day for an upper bound) converted to UTC instants; the server normalises any offset to UTC and compares INCLUSIVELY against `last_viewed_at`; a recipient in another zone gets the SAME instants and sees them as their own local days (the chip renders locally); **never a bare date** in the URL. The help sentence tells the user so | unit (BE): a row at `2026-09-05 21:30` UTC is INCLUDED by `viewed_after=2026-09-06T00:00:00+03:00` (= 21:00Z) and EXCLUDED by `viewed_after=2026-09-06T00:00:00Z`; unit (FE): `presetWindow('today', now, 'Pacific/Kiritimati')` = that zone's local midnight as `Z`; IT: a second browser context at UTC+14 opening the same URL gets the SAME rows and a different chip day, and its "Today" click writes ITS local midnight |
| **R6** | **Ordering** — "the panel, continued" (GATE-1 decision D2, option A) | sort tokens relevance / status_priority / updated_at / name / popularity; the panel is `last_viewed_at DESC, id DESC` | a sort token **`last_viewed`** ("Recently viewed" in the menu — the `Recently updated` idiom) ⇒ `recently_viewed.last_viewed_at DESC, asset_kind ASC, asset_id DESC`, keyset-paged (the `UPDATED_AT` branch mirrored, no nulls tail — the joined column is NOT NULL); **honoured only while the scope is present**, and it is the scope's **DEFAULT ordering when no sort is given and no query is typed** (a text query keeps relevance — the shipped rule); without the scope the token resolves to the per-context default exactly as an unknown token (server + FE agree); the legacy `/api/search` session rejects it like `POPULARITY`; the menu lists the option only while the scope is on and displays it as the active default | unit: scope + no sort ⇒ most-recent-first; scope + `sort=name` ⇒ by name; `sort=last_viewed` WITHOUT the scope ⇒ status-priority order; query + scope ⇒ relevance; keyset page 2 == single page; a tampered `LAST_VIEWED` cursor fails closed to page 1; the EXPLAIN oracle (§4a); FE: `defaultSortForContext(query, scopeOn)` / `resolveActiveSort` truth table; the dropdown shows "Recently viewed" as active under the scope and never lists it without |
| **R7** | The **control** — the second instance of the range shell, a DATE body | `RangeFacetFilter.tsx` = chrome + a slider body; `AppDateRangePicker` shipped for Activity/Alerts | heading **`Last viewed`** (the dimension; the feature stays "Recently Viewed" — the Popular→Popularity precedent), qualifier **`Assets you have opened`**, an info icon (ADR-0076) with the help sentence; preset links **Today · Last 7 days · Last 30 days · Any time** (the shell's presets row); the platform's `AppDateRangePicker` labelled **`Custom range`** (footer presets hidden on this surface via a new optional `ranges` prop; Done commits `[startOfDay(begin), endOfDay(end)]` as instants); chip **`Last viewed: any time` / `since {{from}}` / `{{from}} – {{to}}` / `before {{to}}`** with dates through the locale formatter (`useAppDateTime`), × clears; placed in the personal-scope block **right after Favorites** (My data → Favorites → Last viewed), before the aggregated facets | vitest: reflects each URL shape as its chip; a preset click writes the canonical URL (location probe); the picker's commit maps to two `Z` instants; × drops the scope (+ the sort token); IT: the rendered control narrows the list with a FOIL absent |
| **R8** | **DISABLED posture** (GATE-1 decision D1, option A) | the sentinel bucket fills; the panel says "(shared)"; Favorites' filter works + labels + tooltip | heading **`Last viewed (shared)`**, qualifier **`Assets anyone has opened`**, the info icon carrying the consequence sentence (the `en.json:657` shape: *"Authentication is disabled, so the viewing history is shared by everyone on this instance. Don't use disabled auth in production."*) — the filter WORKS on the shared bucket; the panel's View all lands on a list that matches the panel | IT-148-style case: under DISABLED the heading + `filter-recently_viewed-info` render, and the filter narrows to the shared bucket |
| **R9** | **Saved search** holds and reapplies the scope (LSN-042 — the class this slice would otherwise extend) | persisted automatically (#1878) but not projected back, not sanitised | `assetSearchFormDataToUrlState` projects `recently_viewed` (a `Date`, an ISO string or junk — the generated `FromJSON` turns a stored `viewed_after` into a `Date`) through the same `parseInstant` and the same junk rule as the URL, **with ONE deliberate difference: an inverted stored pair drops BOTH BOUNDS and KEEPS the scope ("any time"), mirroring the server's sanitiser, where an inverted URL pair drops the whole dimension** — a stored spec came from a client that intended a recency scope, a hand-edited URL is junk (the three surfaces and their three answers are tabulated under R3); `sanitiseSpecTree` drops a non-object, drops a bound that is not a parseable `date-time` (incl. `null`), and on an inverted pair drops BOTH bounds; a row saved before this change reads back with no scope; the D11 lock (`searchFormDataToUrlState.test.ts:126,153`) is extended to the 11th wire key | vitest identity round-trip incl. the scope (fixture bounds are real `Date`s); web test: POST/GET keep `recently_viewed`; a legacy row → absent; **the paired inversion test — `SavedSearchServiceImplTest` and the `assetSearchFormDataToUrlState` case must return the SAME answer ("any time"), so the two surfaces cannot drift**; service test: junk bound dropped field-level; IT: save with the scope → reload → reapply → the same narrowing (the foil absent), the copied link carries the params |
| **R10** | The two **empty states** — never a bare "No matches found" under the scope | `Results.tsx:207` (favorites' teaching empty) | (a) the caller has NO history at all: the control renders **disabled with the reason** *"You haven't opened any assets yet."* (an existing chip stays clearable — the shell's rule) and the result area, if the scope is on, reads *"You haven't opened any assets yet. Assets you open will appear here."*; (b) history exists but nothing matches the window / other filters: *"Nothing you opened matches this range."* The signal is three-valued — not-yet-fetched vs settled-and-empty vs non-empty — and both surfaces read ONE derived hook, never two copies | **vitest** owns state (a), mocked, because proving it in the browser would mean emptying the single shared DISABLED bucket that IT-149 also drives; **IT-157 case 11** owns state (b) with a window that excludes everything; a third vitest case pins that the not-yet-fetched state shows NEITHER sentence |
| **R11** | The **panel deep-links** (#1832, ADR D8) | `RecentlyViewedColumn.tsx:24-25` — no View all | `View all` (rendered when the column has rows — the Favorites idiom, `data-qa='recently-viewed-view-all'`) → `buildSearchLink({ recentlyViewed: {}, sort: 'last_viewed' })` = `/search?recently_viewed=yes&sort=last_viewed` — explicit sort even though the default would produce it (the URL says what it means and survives a default change; the ST-9 shape) | IT: click View all → that URL; the list's first rows are the panel's rows in the SAME order; a not-viewed foil absent; the sort menu reads "Recently viewed" |
| **R12** | **Per-row transparency + removal** | `ResultItem.tsx:155` renders `RecentlyViewedTag`; removal is a hard DELETE | unchanged code; asserted: each listed row shows "Viewed … ago" + remove; removing a row drops it from the filtered list without reload | IT-157 case 12 |
| **R13** | **Privacy** (the ADR's security bar) | identity from the session (`CurrentUserIdentityResolver`) | the URL carries instants only — no username, no ids; a shared link re-resolves to the RECIPIENT's history (a query spec run as the requester, ADR D11); no write on read (search never records a view) | unit: two identities, one request shape, disjoint results; **IT-157 case 1 asserts it directly** — a Playwright route listener over the whole scoped-search
interaction records ZERO `POST /api/recently-viewed/*` calls (the read path must never write; the view-count hotspot
lesson), and the unit side is covered because the service resolves the identity read-only |
| **R14** | **Performance** — the scope must not extend the search round-trip | count(*) is the shipped hot cost (PLT-260): 396 ms browse at 126k rows (§4a M0) | the scope is an INNER JOIN to the identity's ≤ 200 rows driven by `recently_viewed_identity_ts_idx`; every scoped query (count, page, sort page 1/2, FTS + scope, histogram) costs **single-digit ms** at 126k assets; no new index, no migration; the ordering reuses the index's presort (a bare `DESC` — the popularity idiom's `NULLS LAST` would force a full sort, §4a) | measured on main's exact code (§4a: 1.7–6.8 ms vs 396 ms); re-measured on the built SUT through the real endpoint in Phase D; the EXPLAIN oracle pins the presort |
| **R15** | **i18n ×7** | 707 keys each; `Recently viewed`, `Recently Viewed (shared)`, `Assets you open will appear here.`, `Done` exist | every new string exists **and is translated** in `br ch en es fr hy ua` (22 keys, §7 Step 6 — incl. the 4 picker footer presets that were English literals, the class-extension fix); `i18n-key-parity.test.ts` run and cited | the parity test GREEN; `git diff --stat` shows all 7 catalogs |
| **R16** | **Docs on the 1.0.0 train** (G-C11) | `search.md` (description 184 chars; `## Favorites` :117, `## Popularity` :152, the "filters travel with the link" bullet), `recently-viewed.md` (no search section; says "a retention job trims it"), `catalog-overview.md:47` (the panel, no View all), `Features.md:60`, `data-discovery.md:13,23` | `search.md` gains **`## Last viewed`** after `## Favorites` (what it scopes, cross-kind, the presets + custom range, the local-days/exact-instants rule, the default ordering + the sort option, the URL shape, saved searches, the DISABLED `(shared)` posture, the retention bound with a link to housekeeping, the shared-link-is-the-recipient's-history sentence, the two shipped DE-only facet interactions) and the link bullet lists it; the description is re-authored ≤ 200 chars; `recently-viewed.md` gains **`## Finding your history in Search`** + the panel's View all; `catalog-overview.md:47` the panel now links; the two enumerations gain the scope; `main-concepts.md` Terms & Aliases logs *Last viewed (the search scope) ↔ Recently Viewed (the feature)*; paired `backlog/docs/DOC-529` (`milestone: 1.0.0`) | every page re-read end-to-end; the description measured ≤ 200 (PyYAML + the `: ` check); `git grep -n "no \"View all\" yet\|has no View all"` on the branch returns nothing |

**In scope:** R1–R16 — the wire object + the sort token; the repository join/predicate/order + the cursor; the service scoping;
the saved-search projection + sanitiser; the URL params + mirror + Clear All; the shell extraction + the Last viewed body
(+ the picker's optional `ranges` prop + its footer i18n); the two empty states; the sort-menu rule; the panel link; i18n ×7;
both test buckets (a new `IT-157`); docs on the train; the F-017 promise (UC-18).

**Out of scope (explicit exclusions — G-C5):** **relative windows** that re-evaluate on reapply (`viewed_within=7d`) — an
additive later param, D9-safe, recorded here, not built (presets resolve to absolute instants at click time and the chip shows
the resolved dates — the freeze is visible); **preset counts / a recency histogram** (cheap per the SME, but a new facet endpoint
+ contract + hook + tests the issue does not ask for; the two teaching empty states cover the surprise it would pre-empt);
**an inverse scope** ("assets I have NOT opened" — steward hygiene; the wire object has no inverse today); **exposing the
retention values (`90 days / 200`) via `/api/info`** so the tooltip can quote them (the UI says "bounded by retention", the docs
carry the defaults + the config link; never a hardcoded number in the UI); the `react-multi-date-picker` calendar's English
calendar's keyboard / screen-reader behaviour beyond its month names (the trigger IS a native tabbable
`<input type="text">` — verified in the library source, §8b iii; whether typing round-trips in range mode and how it reads
to a screen reader is answered by DRIVING it in Step 9, not asserted here; its English month names ARE fixed here, §6d);
ST-11's Created/Updated ranges (#1845 — they reuse the date body built here); the legacy `/api/search` session and the per-kind
searches (no recency — the `favorites`/`popularity` posture, ADR D9); cross-kind facet application (ST-11); any write on the
read path.

**Constraints:** perf per R14 (single-digit ms, no new index — measured); security — identity from the session only, no
exposure beyond `GET /api/recently-viewed/list`, no secrets/ids in the URL, fail closed on every input, no write on read;
compatibility — one optional request object, one additive sort token, rows saved without `recently_viewed` read back absent,
the legacy session untouched (ADR D9); UX — the rail's chip / label / inline-help / preset idioms reused (G-C12), the platform's
one date-range control reused (never a second visual language); the ORDER BY spelled to match `V0_0_95`'s index direction.

**Open questions:** (1) *Does the filter answer empty under DISABLED, as the issue says?* → **GATE-1 decision D1** (§5.4;
recommended: no — the shared bucket, labelled). (2) *Filter only, or filter + a recency ordering so the panel's View all is
honest?* → **GATE-1 decision D2** (§5.5; recommended: both, the sort coupled to the scope and its default). (3) *Slider or
picker?* → **RESOLVED: picker + presets inside the shared chrome** (§5.6 — NN/g + the platform's own control; the slider's
stops cannot represent dates). (4) *ISO vs the Activity page's epoch-millis params?* → **RESOLVED: ISO-8601 UTC `Z`** (the
maintainer's own words in the pre-work comment; readable in a shared link; the API's own `date-time`; canonicalised so the
mirror's equality guard holds). (5) *Does an unparseable `date-time` 500?* → **RESOLVED: no — 400 `USR001 "Type mismatch."`**,
measured on the running stack against the SHIPPED date-time binding (§3a extension, 2026-09-06): `viewed_after=junk` → 400,
`viewed_after=2026-13-45T99:99:99Z` → 400, and — importantly — a **bare `viewed_after=2026-09-01` → 400 as well**, so the
server already rejects the zone-ambiguous form the FE parser drops (the two rules agree by construction); a valid `…Z` → 200.
A malformed value inside a JSON body likewise answers 400 (probed via `POST /api/saved_searches` with a bad `spec` field).
The Phase-D web test asserts **400 and never 5xx** for the new field. (6) *Does Playwright support a per-context timezone?* → **RESOLVED: yes** — `timezoneId`
is in `playwright-core/types/types.d.ts` (5 hits in the harness's installed package). (7) *Is the bare-`DESC` presort real?* →
**RESOLVED: measured** (§4a: Incremental Sort over the index scan; `NULLS LAST` → a top-N heapsort).

**Ambiguity report:** goal 0.95 · boundary 0.90 · constraint 0.90 · acceptance 0.90 →
**ambiguity = 1 − (0.35·0.95 + 0.25·0.90 + 0.20·0.90 + 0.20·0.90) = 0.083** ≤ 0.20, every dimension above its minimum. The
two residuals are product decisions the issue's own text gets wrong or leaves silent, surfaced at GATE 1 — not ambiguities
in the WHAT.

### 4a. Plan-time measurement — main's exact code at 126k indexed assets (2026-09-06)

Stack `ctrib067probe` (:18430/:15630) running `odd-platform:odd-team-sut-ctrib066close` (id `bfb16e65`, the ctrib066close
post-merge build of `origin/main` @ `0238005c`), schema `0.0.101`, postgres:13.2-alpine. Seeded through the REAL write path
(the `*_search_entrypoint` inserts fire the V0_0_98/99 union-row triggers — `scratchpad/seed-corpus.sql`, the ST-9 recipe):
**120,000 data entities + 5,000 terms + 1,000 query examples = 126,001 union rows**; the caller's history = the DISABLED
sentinel at the retention cap (**200 rows** spread over ~83 days, every 10th a term, every 25th a query example) + a second
identity (`ctrib067-alice`, 200 rows) as the leak foil. Warm runs, `EXPLAIN (ANALYZE, BUFFERS)`, the shipped `FROM` (three
LEFT JOINs) + eligibility (`ReactiveAssetSearchRepositoryImpl.conditions()` (3)):

| # | Query | ms | Plan shape |
|---|---|---|---|
| M0 | count(*) unfiltered browse (the shipped cost, PLT-260) | **396** | seq scans + hash joins (the ST-9 figure reproduced: 356–386) |
| M1 | count(*) + the scope as `EXISTS(… rv.oidc_username = ? AND rv.provider = ? AND rv.asset_kind = a.asset_kind AND rv.asset_id = a.asset_id AND rv.last_viewed_at >= now − 30 d)` | **3.1** | the planner DRIVES FROM `recently_viewed` via a Bitmap Index Scan on `recently_viewed_identity_ts_idx` (71 rows), then an Index Only Scan on the entrypoint PK per row — the favorites plan shape (`:436-440`), inverted to the smaller side |
| M1b | count(*) + the scope, ANY TIME (no bounds) | 6.8 | Seq Scan on the 400-row `recently_viewed` → 200 PK probes (with many identities the index is used; either way ≤ 200 rows) |
| M2 | browse page LIMIT 31, status-priority order + the scope | 3.3 | Nested Loops from rv → a Sort over **71** rows (bounded by the history, not the catalog) |
| M3 | **sort page 1: INNER JOIN rv, `ORDER BY rv.last_viewed_at DESC, a.asset_kind ASC, a.asset_id DESC` LIMIT 31** | **2.5** | **Index Scan `recently_viewed_identity_ts_idx` (32 rows read) → Incremental Sort** (presorted on `last_viewed_at`, one full-sort group of the tiebreakers) — no top-N sort |
| M4 | sort page 2 (the keyset OR-form after the 31st row) | 2.4 | the same index range-start (33 rows read) |
| M5 | FTS `ctrib067tok3:*` (12,600 matches) count + the scope | 1.7 | drives from rv (71 rows), probes the PK, the FTS predicate filters per row — the GIN bitmap is never needed |
| M6 | FTS page, relevance order (`ts_rank`) + the scope, LIMIT 31 | 2.4 | the same, then a 7-row sort |
| M7 | the LEFT-JOIN-as-predicate alternative (`rv.id IS NOT NULL`) | 3.3 | identical plan to M1 → **one mechanism** (the JOIN) serves predicate AND sort; no EXISTS/JOIN split needed |
| — | **`ORDER BY rv.last_viewed_at DESC NULLS LAST` (the popularity idiom)** | 5.3 | **a full top-N heapsort** — the index is `(…, last_viewed_at DESC)` = `DESC NULLS FIRST`, so `NULLS LAST` does not match its presort. The ORDER BY must be a bare `DESC` (the column is NOT NULL, so the spelling only matters to the planner) — pinned by the R6 EXPLAIN oracle |
| M8 | the leak foil | — | the other identity's 200 rows never enter the sentinel's plan (the join is identity-keyed); 4 asset ids happen to appear in both histories — the same asset viewed by both, not a leak |

**Reading:** every scoped query is bounded by the per-identity history cap (`recently_viewed_max_per_user: 200`), not by the
catalog; the planner starts from the small identity-indexed side on every shape measured. The round-trip the issue guards
(the shipped page ∥ count, 714–869 ms at this scale per ST-9) is not extended — it is shortened when the scope is on.
Re-measured on the built SUT through the real endpoint in Phase D (§7 Step 9).

## 5. Change-request product analysis + the GATE-1 decisions (G-C16)

### 5.1 The user-observable problem, restated independent of the issue's proposed solution

A data engineer or steward who opened a dozen assets during an investigation — this morning, last week, during a schema
review — wants that set back **without re-searching**: "the table I had open before lunch", "everything I looked at while
diagnosing the stale dashboard last week", "what I inspected during the review, only the datasets". Today the catalog keeps
that history (#1816) but offers it in exactly one place: the five-row home panel, which has no "View all" and no way to
narrow ("only last week", "only datasets", "only in this datasource"). The issue's proposed solution (a datetime-range facet
on the unified search + the panel rewired) is quoted data; the analysis below asks whether it is the right shape.

### 5.2 Is the issue's shape product-right? — yes, with three corrections it does not name

- **Correction 1 — the DISABLED line is stale.** The issue's AC says "empty under `auth.type=DISABLED`"; it was written
  2026-06-30, before #1816 decided (PRD-0001 decision 2) that the shared sentinel bucket fills under DISABLED and is shown
  labelled "(shared)". A filter that answers empty while the panel it is linked from shows five rows is the tile↔list
  contradiction the maintainer's own pre-work comment rules out. The product-right posture is the Favorites one (works on
  the shared bucket, labelled, with the consequence tooltip) → **GATE-1 decision D1** (§5.4).
- **Correction 2 — a filter reproduces a set, not an order.** #1832 asks for "most-recent-first"; the panel is ordered by
  recency. Without a recency ORDERING the rewired "View all" lands on a list in status-priority order — the ST-9 lesson
  ("a deep link that does not resemble the tile it came from is worse than no link", SME 2026-09-05 Q5). And every "recent"
  list a user knows (a browser history, "Recent files", Slack's Recent) orders by recency by default. So: a `last_viewed`
  sort, the scope's default ordering while active → **GATE-1 decision D2** (§5.5).
- **Correction 3 — "the same range widget" means the same chrome, not the same slider.** The ST-9 shell's slider snaps to
  discrete stops; a date is picked, not slid (NN/g: "whenever the exact value matters, sliders are not okay"; "calendar
  pickers are especially useful for selecting a date range"). The platform already ships the two-month `AppDateRangePicker`
  for the Activity/Alerts Period filter. Reusing the shell's chrome + that picker keeps ONE facet visual language and ONE
  date control — the pre-work comment's actual intent ("don't ship a second range implementation") → decided in §5.6.
- **What the issue gets right and this plan keeps verbatim:** absolute ISO instants in the URL, fail-closed on junk, the
  mirror merge, the panel rewired, i18n ×7, both test buckets, the timezone pin.
- **The market (negative result, per the SME's fetched pages):** DataHub documents no date/recency filter; Secoda treats
  recency as a ranking *boost*; Google Drive / GitHub ship absolute date operators on modification. Nobody verified ships a
  date range over *personal* recency — an ODD differentiator, built plainly on the platform's own idioms.

### 5.3 SME claims re-verified before use (never absorbed unread)

| SME claim (`2026-09-06-recently-viewed-datetime-facet.md`) | Verified |
|---|---|
| `recently_viewed_identity_ts_idx (oidc_username, provider, last_viewed_at DESC)` exists and serves the window + the sort | **True** — `pg_indexes` on the running stack: `CREATE INDEX recently_viewed_identity_ts_idx ON public.recently_viewed USING btree (oidc_username, provider, last_viewed_at DESC)`; §4a M1/M3 drive from it |
| the sort must be "DESC NULLS LAST … the default (consumer 'freshest first')" (`SEARCH-CAPABILITIES-DESIGN.md:59`) | **The direction is right, the spelling is not, on THIS index**: a bare `DESC` reuses the index's presort (Incremental Sort, 2.5 ms); `DESC NULLS LAST` forces a top-N heapsort (§4a). The column is NOT NULL, so the semantics are identical — the spelling is chosen for the planner and pinned by an EXPLAIN oracle |
| the retention cap is 90 days / 200 per user | **True** — `application.yml:176-177` |
| Playwright has a per-context timezone option | **True** — `timezoneId` present in the harness's `playwright-core/types/types.d.ts` |
| an unparseable `date-time` on `/api/search/assets` may 500 | **Measured on the shipped binding: 400 `USR001`** (§3a) — the same advice serves the new field; the web test asserts it |
| "junk → drop the WHOLE dimension" | **Adopted** — the `popularity` rule (`searchUrlState.ts:96-102`), one rule for every range |
| preset counts are a cheap SHOULD | **Not adopted** — a new endpoint + contract + hook + tests the issue does not ask for; recorded in the exclusions with the reason |
| the picker's footer presets are English literals (`'3 Day'`, `'1 Week'`, …) | **True** — `AppDateRangePicker.tsx:30-47`; only `Done` is translated. **Fixed in-slice** (the G-C5 class-extension clause): the four labels go through `t()` with 4 keys × 7 locales, AND the facet hides them on its own surface via the new optional `ranges` prop (they duplicate the rail's preset links) |
| expose the retention values via `/api/info` so the tooltip never hardcodes 90/200 | **Half adopted**: the UI never hardcodes a number ("bounded by the retention settings"); the docs carry the defaults + the config link; the `/api/info` exposure is excluded (§4) |
| two empty states, a disabled control when the history is empty | **Adopted** (R10) — one identity-indexed request supplies the signal |
| the dimension name `Last viewed`, the feature name unchanged | **Adopted** (R7) — the "before 1 Sep" grammar argument is decisive; the sort option uses the menu's own `Recently updated` idiom → `Recently viewed`; the aliases are logged in `main-concepts.md` (doc Gate 2) |

### 5.4 GATE-1 decision D1 — what the filter does when authentication is disabled

**In plain language:** the issue says the filter should return nothing when authentication is off. But since #1816 shipped,
an auth-disabled deployment DOES keep a history — one shared by everyone, and the home panel shows it as "Recently Viewed
(shared)". If the filter returned nothing, the panel would show five rows and its "View all" would open an empty list.

| Option | What the user gets | What it costs / risks |
|---|---|---|
| **A (recommended) — the filter works on the shared history, labelled `Last viewed (shared)` with the info icon spelling out the consequence (the Favorites posture)** | the panel and the filter agree; "View all" is the panel, continued; an operator on a demo/dev stack can use the feature | the label + tooltip + qualifier ("Assets anyone has opened") — 3 extra strings ×7; no new exposure (the shared bucket exposes nothing the anonymous catalog + the panel do not already expose — PRD-0001 §6.3) |
| B — follow the issue's line: the filter hides itself under DISABLED (the My-data posture) | nothing contradictory is *shown* | the panel still shows five rows with nowhere to go ("View all" would have to hide too); the demo stand (`docker/demo.yaml`, `AUTH_TYPE=DISABLED`) never demonstrates the feature |
| C — follow the issue's line literally: the filter renders and answers empty | — | the tile↔list contradiction the maintainer's own comment forbids; reads as a bug |

The plan is written for **A**; the approval carries the correction into the public scope comment (§7 Step 12) so the issue
thread reflects it.

### 5.5 GATE-1 decision D2 — ordering: does "recently viewed" also mean "most recent first"?

**In plain language:** the filter narrows the list to what you opened; it does not say in which order. Today's browse order is
status priority (stable assets first). A "what I opened last week" list in status-priority order cannot be read as a history,
and the home panel's "View all" (#1832 asks for "most-recent-first") would land on a list that does not resemble the panel.

| Option | What the user gets | What it costs / risks |
|---|---|---|
| **A (recommended) — add a `Recently viewed` ordering (`sort=last_viewed`), offered in the sort menu only while the filter is on; make it the filter's DEFAULT order when no sort is chosen and no query is typed (a text query keeps relevance-first, as today); the panel's View all links `recently_viewed=yes&sort=last_viewed`** | the list reads as a history — newest first; the panel, continued; a user can still pick Name / Status priority / Recently updated / Most popular on top of the scope | one sort token through the keyset engine + cursor (the `UPDATED_AT` branch mirrored, no nulls tail), one FE default rule (mirrored server/FE, PLT-254 still open), one conditional menu entry; ~2.5 ms per page (§4a M3). The token is meaningless without the scope, so it resolves to the ordinary default there (server + FE agree — never a silent no-op) |
| B — filter only; keep the browse default (status priority); the panel links the filter alone | nothing new in the sort menu | the panel's View all betrays the panel; every recency list is misordered; #1832's "most-recent-first" is not delivered |
| C — filter only; no panel link | the panel stays a dead end | fails the slice's own AC ("the panel deep-links") and leaves #1832 open |

The plan is written for **A**. Both **#1844** and **#1832** close with the PR (`Closes #1844`, `Closes #1832`).

### 5.6 What is decided here without a round-trip (within the maintainer's own conventions)

The control's shape (preset links + the platform's own two-month picker inside the shared chrome; no slider, no
histogram); the wire object `recently_viewed {viewed_after?, viewed_before?}` whose PRESENCE is the switch (documented
against `PopularityRange`'s opposite rule); the URL grammar (`viewed_after` / `viewed_before` ISO `Z`, `recently_viewed=yes`
only for the unbounded state — one canonical representation per state); absolute instants (presets resolve at click time and
the chip shows the resolved dates — the freeze is visible); the fail-closed rules (junk or an inverted pair → the whole
dimension dropped on the FE; an inverted pair → empty on the server; a non-date-time → the standard 400); the timezone rule
(local days in, UTC instants out, inclusive); the vocabulary (`Last viewed` facet, `Recently viewed` sort, the feature name
unchanged, aliases logged); the qualifier + help sentences; the placement (after Favorites, in the personal-scope block); the
two empty states; the hidden footer presets on this surface + their in-slice i18n; the panel link's explicit sort. Each is a
documentation/UX best-practice call inside the approved ADR — surfacing them would be the DOC-138 Phase-B failure
(`CLAUDE.md` Velocity).

## 6. `## Design` — the HOW (G-C12, `playbooks/design-before-build.md`)

### (a) Reuse scan — conform to what exists; justify every new artefact in one sentence

| Need | Existing thing reused | New (justified) |
|---|---|---|
| the facet chrome (heading + info icon + qualifier + presets + chip + disabled reason) | `RangeFacetFilter.tsx` (ST-9) — its chrome is EXTRACTED into `RangeFacetShell.tsx` with the rail body as `children`; `RangeFacetFilter` becomes `<RangeFacetShell …>{bars + slider}</RangeFacetShell>` with its props + `data-qa` hooks unchanged (`PopularityFilter.test.tsx` unchanged = the refactor's oracle) | **new file, moved code** — one chrome for the numeric AND the datetime facets (the pre-work comment's "reusable container"); ST-11 instances it a third time |
| a date-range input | **`AppDateRangePicker`** (`react-multi-date-picker ^4.4.1`, already in `package.json`) — the Activity/Alerts Period control: two months, `portal`, Done, local start/end-of-day; gains one optional prop `ranges?` (default = today's four presets, so `CalendarFilter` is byte-identical) | — (a second date control rejected: one visual language) |
| the picker's footer preset labels | `AppDateRangePickerFooter` renders `range.label` verbatim; `AppDateRangePicker.tsx:30-47` passes English literals | — (+ `t()` on the four labels, the class-extension fix; the facet passes `ranges={[]}` because the rail already carries its own presets) |
| the calendar's month / weekday names | the picker's `locale` prop (plain data: `{name, months, weekDays, digits, meridiems}`) | **new** `calendarLocale.ts` — built from `Intl` for the active language, because the library ships objects for only `en/ar/fa/hi(/pt_br)` and `react-date-object` is a transitive dep (§9.2d) |
| preset links, chip, × | the shell's presets row (`Button buttonType='linkGray-m'`, the `Never viewed` idiom) + `FixedOptionsMultiFilterStyles.Chip` + `ClearIcon` | — |
| inline help | `AppTooltip checkForOverflow={false}` + `InformationIcon` behind `span[data-qa='filter-<id>-info']` (ADR-0076; the `RangeFacetFilter` / `FavoritesFilter` call sites) | — |
| the auth mode | `useAppInfo()` → `data.authType === 'DISABLED'` (`FavoritesFilter`, `MyDataFilter`, `RecentlyViewedColumn`) | — |
| the "history is empty" signal | the shipped thunk `fetchRecentlyViewedList({page:1, size:1})` + selector `getRecentlyViewedListPage` (`pageInfo.total`) — the same slice the panel uses | — |
| date formatting for the chip | `useAppDateTime().dataEntityFormattedDateTime` (date-only, US/EU aware, browser zone) | — |
| local-day → instant | `date-fns` `startOfDay` / `endOfDay` / `subDays` (already used by the picker) + `date-fns-tz` `zonedTimeToUtc` (already in `package.json`) for the zone-explicit helper | **new** pure helper `recencyPresets.ts` (`presetWindow(kind, now, tz)`) — testable in a fixed zone |
| URL read/write | `paramsToSearchState` / `searchStateToParams` / `buildSearchLink` (the canonical serialiser — never a hand-built string) | — |
| the facet instance | — | **new** `RecentlyViewedFilter.tsx` (the Last viewed body bound to the three params) |
| the sort default rule | `defaultSortForContext` / `resolveActiveSort` (`searchUrlState.ts:181,196`) + `SearchSortDto.resolveEffective` (`:45`) | — (each gains one boolean) |
| the request DTO | the `FavoritesScopeDto` record idiom (`of(identity, wire)`) | **new** `RecentlyViewedScopeDto` record (identity tuple + two UTC `LocalDateTime` bounds + `contradictory()`) |
| the predicate + the sort key | `ReactiveAssetSearchRepositoryImpl.searchFrom()` + `conditions()` (one source of truth for every predicate) + the `UPDATED_AT` keyset branches + jOOQ `Tables.RECENTLY_VIEWED` (generated, used by `ReactiveRecentlyViewedRepositoryImpl`) | — (`searchFrom` gains the identity-keyed INNER JOIN when the scope is present — measured to serve predicate AND sort, §4a M7) |
| the service scoping | `AssetSearchServiceImpl.scoped()` (ST-9 — the favorites + My-data resolution shared by results and histogram) | — (resolves the identity once when favorites OR recency is present) |
| the saved-search sanitiser | `SavedSearchServiceImpl.sanitisePopularity` (`:185`) | + one `sanitiseRecentlyViewed` clause of the same shape |
| the panel link | `FavoritesColumn.tsx:101-111` (`View all` when rows exist) + `buildSearchLink` | — |
| the results empty state | `Results.tsx:96,207` (`isFavoritesScope` → the teaching line) | — (+ the recency branch with its two sentences) |
| unit-test scaffolding | `AssetSearchFavoritesIntegrationTest` (the identity-scoped narrowing + leak-foil shape), `AssetSearchPopularityIntegrationTest` (seeders), `AssetSearchSortIntegrationTest.explainUnionOrderBy` (the EXPLAIN oracle), `AssetSearchKeysetPaginationTest` (tampered cursors), `AssetSearchControllerWebTest`, `SavedSearch*Test`, `LegacySearchSortFallbackTest`, `ReactiveRecentlyViewedRepositoryImplTest.pageHonorsDateWindow`; FE: `PopularityFilter.test.tsx` (location-probe pattern), `searchFormDataToUrlState.test.ts` (the D11 lock) | **new** `AssetSearchRecentlyViewedIntegrationTest`, `SearchSortDtoTest`, `RecentlyViewedFilter.test.tsx`, `recencyPresets.test.ts` |
| integration scaffolding | `seedSearchableEntity` / `seedSearchableTerm` / `dbQuery`; IT-148 (DISABLED label + teaching empty), IT-155 (`saveCurrentSearch` / `reapply`), IT-156 (`settled` / `gotoSearch` / FOIL oracles), IT-149 (the `[data-qa="recently-viewed-tag"]` + remove idiom); `browser.newContext({ timezoneId })` | **new** `IT-157` protocol + `recently-viewed-facet.spec.ts` (13 cases) |

### (b) ADR check

Conforms to the approved spine ADR `adrs/drafts/unified-asset-search.md`: **D3** ("Recently viewed (datetime) — #1816's
`recently_viewed`, joined per current identity" — the exact row of the facet table), **D8** (the panel becomes a deep-link
widget), **D9** (additive: one optional object, one additive token, rows saved without the field read back absent, the legacy
session untouched and guarded), **D10** (URL params, fail-closed, one canonical representation), **D11** (one canonical spec,
two surfaces — the saved search reapplies the scope), **D12** (a datetime sort key: DESC = freshest first, the unique
tiebreaker, keyset; the browse-default fork untouched — the new default applies only inside the personal scope), and the
cross-cutting security bar (a shared link re-runs as the recipient; no secrets in the URL; fail closed). Conforms to the
foundation ADR `favorites-recently-viewed-foundation.md` **D1** (identity `(oidc_username, provider)` from the context, the
DISABLED sentinel), **D2** (the polymorphic pair), **D6** (no new RBAC — a personal scope, reads authenticated-only).
Published ADR-log: **ADR-0076** (inline help) for the info icon; **ADR-0021** (cursor pagination) inherited through the keyset
engine. `implicit-adrs.md` carries nothing on facet types. **No new ADR** — nothing here christens a pattern the ADRs do
not already state; `adr_required: false` confirmed. G-C7: no migration, no auth posture, no breaking contract.

### (c) The change, surface by surface

1. **Contract** (`odd-platform-specification/components.yaml`, `openapi.yaml`): `RecentlyViewedScope {viewed_after?,
   viewed_before?: date-time}` referenced from `AssetSearchFormData.recently_viewed` (presence = the switch, documented against
   `PopularityRange`'s opposite rule); `SearchFormData.sort` prose gains `LAST_VIEWED` (scoped: honoured by the cross-kind
   path only while `recently_viewed` is present, and its default there; the legacy session resolves it to the per-context
   default); `/api/search/assets` prose gains the scope; `SavedSearch` / `SavedSearchFormData` prose lists it.
2. **Backend**: `dto/RecentlyViewedScopeDto` (record + `of(identity, wire)` + `contradictory()`); `SearchSortDto.LAST_VIEWED` +
   `resolveEffective(sort, hasQuery, hasRecencyScope)`; `AssetSearchCursor` (`parsesForSort` + the NOT-NULL guard);
   `ReactiveAssetSearchRepository` — `keysetPage` / `relevancePage` / `count` / `popularityHistogram` gain a
   `RecentlyViewedScopeDto recentlyViewed` parameter (null = none); the Impl: `searchFrom(recentlyViewed)` adds the INNER JOIN,
   `conditions()` gains (9) the bounds / `falseCondition`, the four `LAST_VIEWED` keyset branches + `orderFields` (bare
   `desc()`), `effectiveSort(state, hasScope)`; `AssetSearchServiceImpl.scoped()` resolves the identity once for favorites
   OR recency and threads the DTO; the legacy guard `ReactiveDataEntityRepositoryImpl:1020`; `SavedSearchServiceImpl.sanitiseRecentlyViewed`.
3. **Front end**: `searchUrlState.ts` (params, type, parse/serialise, the two projections, the sort token + rules);
   `Search.tsx` mirror line; `Filters.tsx` (Clear All drops the sort token; renders the facet after Favorites);
   `RangeFacetShell.tsx` (extracted chrome) + `RangeFacetFilter.tsx` (refactored onto it); `RecentlyViewedFilter/` (component +
   `recencyPresets.ts`); `AppDateRangePicker` (`ranges?` prop + `t()` labels); `Results.tsx` (two empty sentences);
   `SearchSortMenu.tsx` (conditional option + the scope-aware active sort); `RecentlyViewedColumn.tsx` (View all); the 7 catalogs.
4. **Tests** — §7 Step 8. **Docs** — §7 Step 10. **Ontology** — §7 Step 11.

### (d) Impact-dimension checklist

| Dimension | Handled here |
|---|---|
| **i18n (all 7)** | 22 new keys in `br ch en es fr hy ua` (§7 Step 6 lists them) — never en-only; the parity vitest run + cited |
| **generated clients** | BE `openApiGenerate --rerun` (a `components.yaml` edit leaves the contract codegen STALE — memory PLT-266); FE `pnpm generate` (docker) — both consumers compile |
| **every consumer of a changed signature** | `ReactiveAssetSearchRepository` ×4 methods → `AssetSearchServiceImpl` (results + histogram) + the tests `AssetSearchServiceMyDataTest:167-171` (Mockito arities) and `AssetSearchScopePredicateTest:151,235,244` (call arities) — each gains one `null`; `SearchSortDto.resolveEffective` → the service `:74` + the repository `effectiveSort :280` + `LegacySearchSortFallbackTest`; `defaultSortForContext` / `resolveActiveSort` → `SearchSortMenu.tsx:34` (+ its test) |
| **every representation of the state** (LSN-042) | the URL (parse + serialise), the mirror (`Search.tsx`), Clear All, the request object (`searchUrlStateToAssetSearchFormData`), the saved-search row (persisted + sanitised + projected back), the copied share link (same projection), the panel deep link, the sort menu's display — each a task with a test |
| **migration** | none — `V0_0_95` shipped the table + both indexes |
| **docs + ontology** | `search.md`, `recently-viewed.md`, `catalog-overview.md`, `Features.md`, `data-discovery.md`, `main-concepts.md` on `release/1.0.0` + `DOC-529`; `F-017` gains `UC-18` + the graph re-embedded |
| **tests** | both buckets (§7 Step 8): 1 new + 6 extended BE classes, 4 new + 3 extended FE files, `IT-157` with **13** user-driven cases, each with a FOIL |
| **the class this slice extends, fixed in-slice (G-C5 / LSN-042)** | `AppDateRangePicker` today renders **English month + weekday names for every locale** (`react-multi-date-picker` defaults to `gregorian_en`) and its four footer preset labels are untranslated string literals. Adding a THIRD consumer on the search rail adds a new instance of that class, so this slice owns it: the footer labels go through `t()`, and the calendar gets a `locale` built at runtime from `Intl` (Step 5) — which fixes the two shipped surfaces (Activity, Alerts) too. **Not deferred, not called pre-existing.** What remains: the client clock behind "Today" (as Activity's presets already do), disclosed in the docs. The SME's "icon-only trigger / no typed-date input" item was **checked and withdrawn** — the trigger is a native tabbable `<input type="text">` (`input_icon`'s source; ODD's wrapper styles its `:focus`), so the claim was false; what is genuinely unknown (typing in range mode, screen-reader behaviour) is DRIVEN in Step 9 and filed only if observed (§8b iii) |

### (e) Product-Owner / SRE lens — what the consult changed in the plan

Recorded in `lineage/odd-platform/sme-consultations/2026-09-06-recently-viewed-datetime-facet.md`. It changed: the
dimension name (`Last viewed`, so the "before …" chip reads correctly); the qualifier pair ("Assets you have opened" /
"Assets anyone has opened"); the explicit sort in the panel link (survives a default change); the TWO empty states + the
disabled control on an empty history; the timezone help sentence and the two-context IT; the explicit statement that a
shared link shows the recipient their own history; the "junk drops the whole dimension" rule (one rule for every range); the
in-slice i18n of the picker's footer presets. It did NOT change: no histogram / preset counts (excluded with the reason); no
`/api/info` exposure of the retention values (the UI quotes no number).

## 7. `## Plan` — the GATE-1 artefact

Ordered; every step names **Files · Action · Verify · Done**. No step reduces scope; a step that could not be delivered
whole would split the slice, not shadow it. **Size, stated plainly:** ~46 files (2 contract · 9 BE main · 7 BE tests ·
17 FE main incl. 7 locale catalogs · 7 FE tests · 4 odd-team · 6 docs + 1 backlog item) — the size ST-7 (33), ST-8 (40+)
and ST-9 (~50) shipped on this rail. The only user-observable SPIDR seam is *scope + URL + saved search* vs *sort + panel
link*, and the second half is what makes the first honest (§5.5), so it is **one PR**; commits land per step so the diff
stays reviewable.

### Step 0 — the public scope comment (G-C5; posted right after GATE 1, BEFORE any code)
- **Action:** one comment on **#1844** via `playbooks/github-write.md` (ASCII, no workspace ids): the PR covers the recency
  scope + the ordering + the panel's View all and therefore also closes **#1832**; the AC line "empty under
  `auth.type=DISABLED`" is **superseded** — the filter works on the shared instance-wide history that #1816 ships,
  labelled "(shared)" with the consequence note, because an empty filter would contradict the panel it is linked from;
  relative windows ("last 7 days" re-evaluated on reapply) are **not** in this PR — the presets resolve to fixed dates at
  click time. One comment on **#1832**: it is delivered by this PR (`Closes #1832`).
- **Files:** none in the repos — three GitHub artefacts, all three drafted verbatim in **§8b** so GATE 1 approves the
  words, not a summary of them (ASCII only, zero workspace-internal ids).
- **Verify:** the two comment URLs and the new issue's number are recorded in §10; a public read confirms each body
  rendered as ASCII; the new issue carries labels that already exist on the repo and **no milestone**.
- **Done:** the issue threads reflect the actual PR scope, and the one adopted limitation is tracked, before any code exists.

### Step 1 — the contract (`odd-platform-specification/{components,openapi}.yaml`)
- **Files:** `odd-platform-specification/components.yaml`, `odd-platform-specification/openapi.yaml`.
- **Action:** add
  ```yaml
  RecentlyViewedScope:
    type: object
    description: >-
      The caller's own recently-viewed history as a search scope (ST-10 / #1844) ... PRESENCE IS THE SWITCH:
      an empty object narrows to every asset in the caller's history ("any time"); a bound narrows further.
      This is the OPPOSITE of PopularityRange, where an empty object means no narrowing at all - stated in
      both descriptions so the difference is a decision, not drift. Both bounds are inclusive, UTC instants;
      an absent bound is open. The identity is taken from the security context only, never from the request,
      so a caller can only ever scope by their own history; under auth.type=DISABLED there is no principal
      and all callers share one instance-wide bucket. A contradictory window (viewed_after > viewed_before)
      matches nothing (200 with an empty page); a saved search that stored one reads both bounds back absent
      (the scope survives as "any time"). Applies to every asset kind. The history is bounded by the
      housekeeping retention settings, so the scope can only see what they kept.
    properties: { viewed_after: {type: string, format: date-time}, viewed_before: {type: string, format: date-time} }
  ```
  reference it from `AssetSearchFormData.recently_viewed`; extend the `SearchFormData.sort` prose with `LAST_VIEWED`
  (**scoped**: honoured by the cross-kind `POST /api/search/assets` only while `recently_viewed` is present — and the
  default ordering there when no sort is given and no query is typed; without the scope, and on the legacy `/api/search`
  session, it resolves to the per-context default exactly as an unknown token — the `POPULARITY` precedent);
  `/api/search/assets` description gains the scope + the ordering rule; `SavedSearch` + `SavedSearchFormData` prose lists
  `recently_viewed` among the persisted dimensions.
- **Verify:** `(cd ../odd-platform-ctrib067 && rm -rf odd-platform-api-contract/build/generated && ./gradlew :odd-platform-api-contract:openApiGenerate --rerun)` compiles; then the FE `pnpm generate` (docker) emits `RecentlyViewedScope.ts` with `viewedAfter?: Date` (`FromJSON`: `!exists(json,'viewed_after') ? undefined : (new Date(json['viewed_after']))`; `ToJSON`: `value.viewedAfter === undefined ? undefined : value.viewedAfter.toISOString()`).
- **Done:** both generated clients carry the schema; `AssetSearchFormData` (Java) has `getRecentlyViewed()`.
- **Note (memory `reference_odd_platform_activity_event_and_spec_codegen`):** a `components.yaml` edit leaves the BE contract
  codegen STALE — `--rerun` is mandatory. `odd-platform-ui/src/generated-sources/` is a build artifact, NOT tracked by git:
  regenerate locally (nothing to commit there), and run it BEFORE `tsc` / vitest or the new types do not exist.

### Step 2 — the backend (`odd-platform-api`)
- **Files:** `dto/RecentlyViewedScopeDto.java` (new) · `dto/SearchSortDto.java` · `dto/AssetSearchCursor.java` ·
  `repository/reactive/ReactiveAssetSearchRepository.java` + `…Impl.java` · `service/AssetSearchServiceImpl.java` ·
  `repository/reactive/ReactiveDataEntityRepositoryImpl.java` (the legacy guard) · `service/SavedSearchServiceImpl.java`.
- **Action:**
  1. `RecentlyViewedScopeDto(String oidcUsername, String provider, LocalDateTime viewedAfter, LocalDateTime viewedBefore)`
     — `static Optional<RecentlyViewedScopeDto> of(UserDto identity, RecentlyViewedScope wire)` returns empty for a `null`
     wire (**not** for `{}` — presence is the switch), else maps each bound with `DateTimeUtil.mapUTCDateTime(OffsetDateTime)`
     (null-safe, already UTC-normalising); `boolean contradictory()` = both bounds set and `viewedAfter.isAfter(viewedBefore)`.
     Javadoc states the presence-is-the-switch rule and its deliberate opposition to `PopularityRangeDto`.
  2. `SearchSortDto.LAST_VIEWED` + `resolveEffective(String sortParam, boolean hasQuery, boolean hasRecencyScope)`:
     `fromString(...).filter(s -> s != LAST_VIEWED || hasRecencyScope)` → an unscoped `LAST_VIEWED` falls through to the
     per-context default; when the scope IS present and nothing was requested (or `RELEVANCE` without a query), the default
     becomes `LAST_VIEWED`. **Keep the 2-arg overload** delegating with `false` so no other caller changes.
  3. `AssetSearchCursor`: `parsesForSort` → `case UPDATED_AT, LAST_VIEWED -> LocalDateTime.parse(value)`; the NOT-NULL guard
     at `:128` gains `|| sort == SearchSortDto.LAST_VIEWED` (the joined column is NOT NULL, so a `vn:true` token is
     structurally impossible and must fail closed rather than seek `UPDATED_AT IS NULL`).
  4. Repository interface: `keysetPage` / `relevancePage` / `count` / `popularityHistogram` each gain a trailing
     `RecentlyViewedScopeDto recentlyViewed` parameter (null = no scope). Javadoc: the scope is an identity-keyed INNER JOIN
     that serves the predicate AND the `LAST_VIEWED` sort key (measured, §4a M7).
  5. Impl: `searchFrom(RecentlyViewedScopeDto rv)` — when `rv != null`, `.join(RECENTLY_VIEWED).on(RECENTLY_VIEWED.OIDC_USERNAME.eq(rv.oidcUsername()).and(RECENTLY_VIEWED.PROVIDER.eq(rv.provider())).and(RECENTLY_VIEWED.ASSET_KIND.eq(ASSET_SEARCH_ENTRYPOINT.ASSET_KIND)).and(RECENTLY_VIEWED.ASSET_ID.eq(ASSET_SEARCH_ENTRYPOINT.ASSET_ID)))`
     — an INNER JOIN, safe because `recently_viewed_identity_asset_key` makes it at most one row per asset (no fan-out, so
     `count` stays exact); every existing call site passes its `rv` (or `null`, when the plan says so). `conditions()` gains
     **(9) RECENTLY-VIEWED window**: when `rv != null` → `falseCondition()` if `rv.contradictory()`, else
     `LAST_VIEWED_AT.greaterOrEqual(after)` / `.lessOrEqual(before)` for each set bound (inclusive, mirroring
     `ReactiveRecentlyViewedRepositoryImpl.filterConditions:110-115`), with a comment stating: cross-kind by construction
     (the join key is the polymorphic pair — the favorites reasoning), identity from the security context only, and the
     bounded-history perf note (§4a). Keyset branches: `keysetSortValueField` → `case LAST_VIEWED -> RECENTLY_VIEWED.LAST_VIEWED_AT`;
     `seekBranchPredicates` → a `LAST_VIEWED` case mirroring `UPDATED_AT` (`LocalDateTime.parse`, `lt` = after for DESC) but
     **without** a nulls-tail branch (NOT NULL — stated in the comment); `outerOrderFields` → `case LAST_VIEWED -> order.add(sortValue.desc())`;
     `toPageRow` → `case UPDATED_AT, LAST_VIEWED ->` the existing LocalDateTime branch; `orderFields(state, hasScope)` →
     `case LAST_VIEWED -> order.add(RECENTLY_VIEWED.LAST_VIEWED_AT.desc())` — **a bare `desc()`, deliberately not
     `.nullsLast()`**: the index is `(oidc_username, provider, last_viewed_at DESC)` = `DESC NULLS FIRST`, so `NULLS LAST`
     costs a full top-N heapsort (5.3 ms) instead of the index presort (2.5 ms) — measured §4a; the column is NOT NULL so the
     semantics are identical. `effectiveSort(state, hasScope)` threads the third argument, where **`hasScope` is the method's own
     `recentlyViewed != null` parameter** — so the sort the SERVICE resolved (which scopes the cursor decode) and the
     ORDER BY the REPOSITORY builds are computed from identical inputs and cannot diverge; `branch(...)` takes the same
     `searchFrom(rv)` (miss it and page 2 silently loses the join).
  6. `AssetSearchServiceImpl`: `scoped()` resolves the identity ONCE when `formData.getFavorites() != null` **or**
     `formData.getRecentlyViewed() != null`, building `FavoritesScopeDto` and/or `RecentlyViewedScopeDto` from the same
     `UserDto`, and threads the recency DTO into `resolvePage` + `count` + `popularityHistogram`; the sort resolution at
     `:74` becomes `SearchSortDto.resolveEffective(state.getSort(), hasQuery, formData.getRecentlyViewed() != null)`.
  7. Legacy guard: `ReactiveDataEntityRepositoryImpl:1020` `.filter(requested -> requested != SearchSortDto.POPULARITY)` →
     `.filter(requested -> requested != SearchSortDto.POPULARITY && requested != SearchSortDto.LAST_VIEWED)`.
  8. `SavedSearchServiceImpl`: `RECENTLY_VIEWED_FIELD = "recently_viewed"` + `sanitiseRecentlyViewed(spec)` called from
     `sanitiseSpecTree`: drop a non-object; drop a bound that is not a textual, `OffsetDateTime`-parseable value (incl.
     `null`); if both parse and `after > before`, remove BOTH bounds (the scope survives as "any time" — the search it can
     still run). Javadoc states that pair. **This is the ONE rule for a stored spec, and the FE mirrors it** (Step 3): a
     stored inverted window reapplies as "any time" on both surfaces, never as "no scope". It differs deliberately from
     the URL rule (there, an inverted pair drops the whole dimension) because the two inputs mean different things — a
     hand-edited URL is junk, a stored spec came from a client that DID intend a recency scope. In practice the FE branch
     is defence-in-depth: the server sanitises on READ (`deserializeSpec` → `sanitiseSpecTree`), so an inverted range
     never reaches the client; the branch exists so the two agree even if it did.
- **Verify:** `ODD_PLATFORM_DIR=../odd-platform-ctrib067 scripts/run-platform-tests.sh --tests "*AssetSearch*"` then
  `--tests "*SavedSearch*"` (targeted + full checkstyle), then the no-arg FULL build in Step 9.
- **Done:** the scope narrows the page, the count and the histogram identically; the sort is index-served; the cursor fails
  closed; a stored spec is normalised field-level.

### Step 3 — the URL state (`odd-platform-ui/src/lib/search/searchUrlState.ts`)
- **Files:** `odd-platform-ui/src/lib/search/searchUrlState.ts` (only).
- **Action:** `SEARCH_RECENTLY_VIEWED_PARAM = 'recently_viewed'`, `SEARCH_VIEWED_AFTER_PARAM = 'viewed_after'`,
  `SEARCH_VIEWED_BEFORE_PARAM = 'viewed_before'`; `export interface SearchRecentlyViewedScope { viewedAfter?: string;
  viewedBefore?: string }` (canonical ISO `Z` strings); `SearchUrlState.recentlyViewed?: SearchRecentlyViewedScope`.
  `parseInstant(raw: unknown): string | null | undefined` — **it accepts a `string` OR a `Date`**, because the generated
  client hands back a `Date` for a `date-time` field (verified; the shipped `RecentlyViewedTag.tsx:55` already treats
  `lastViewedAt` as a `Date`) and a saved-search spec therefore arrives with `Date` bounds: `undefined` for absent/empty;
  for a `Date`, `Number.isNaN(raw.getTime()) ? null : raw.toISOString()`; for a `string`, `null` if unparseable
  (`Number.isNaN(new Date(raw).getTime())`) or a bare `YYYY-MM-DD` (zone-ambiguous — rejected, never guessed), else
  `new Date(raw).toISOString()`; `null` for anything else (a number, an array, an object).
  **Getting this wrong is invisible and total**: reject the `Date` and EVERY saved search with a recency scope reapplies
  unnarrowed while reporting success — the LSN-042 class this slice exists to close. `parseRecentlyViewed(rawOn, rawAfter, rawBefore)`: either bound `null` → `undefined`
  (drop the whole dimension); both absent → `rawOn === 'yes' ? {} : undefined`; `after > before` → `undefined`; else the
  object with only its set bounds. Serialise: nothing when absent; each set bound as its param; `recently_viewed=yes`
  **only** when the scope is on with no bound (one canonical representation per state). `searchUrlStateToAssetSearchFormData`
  → `recentlyViewed: state.recentlyViewed ? { viewedAfter: iso ? new Date(iso) : undefined, viewedBefore: … } : undefined`
  (**the generated model takes `Date`, not a string** — verified §Step 1). `assetSearchFormDataToUrlState` → read
  `formData?.recentlyViewed` defensively: not an object → absent; each bound may be a `Date` (a real response), a string
  (a hand-built spec) or junk → through the SAME `parseInstant`. **The inversion rule differs from the URL's, on purpose,
  and mirrors the server's sanitiser:** a stored inverted pair drops BOTH BOUNDS and KEEPS the scope ("any time"), where a
  URL's inverted pair drops the whole dimension — a stored spec came from a client that intended a recency scope, a
  hand-edited URL is junk. Pin the pair with two tests (the `SavedSearchServiceImplTest` case + the projection case)
  asserting the SAME answer, so the two surfaces can never drift apart. `SEARCH_SORT_OPTIONS` gains `{ value: 'last_viewed', labelKey: 'Recently viewed' }` (last);
  `defaultSortForContext(query, hasRecencyScope = false)` → `hasRecencyScope && !text.trim() ? 'last_viewed' : …`;
  `resolveActiveSort(rawSort, query, hasRecencyScope = false)` → a `last_viewed` token without the scope falls through to
  the default (mirroring the server). Every addition carries the "why URL-only + the mirror must merge it" comment the
  siblings carry.
- **Verify:** `searchUrlState.test.ts` + `searchFormDataToUrlState.test.ts` (Step 8).
- **Done:** the four scope shapes round-trip byte-identically; junk drops the dimension; the sort rules mirror the server.

### Step 4 — the mirror + Clear All (`Search.tsx`, `Filters.tsx`) — the #1858 trap
- **Files:** `odd-platform-ui/src/components/Search/Search.tsx`, `odd-platform-ui/src/components/Search/Filters/Filters.tsx`.
- **Action:** `Search.tsx:119` merge object gains `recentlyViewed: live.recentlyViewed,` (the comment there already says
  EVERY URL-ONLY PARAM MUST BE LISTED HERE — add the line, extend the list of pinned cases with IT-157).
  `Filters.tsx:40` `handleClearAll` — today it rebuilds `{query, sort}`; the scope must clear AND a now-meaningless
  `sort=last_viewed` must clear with it: `const { query, sort } = paramsToSearchState(location.search); searchStateToParams({ query, facets: {}, sort: sort === 'last_viewed' ? undefined : sort })`.
- **Verify:** vitest (`Filters` Clear-All case) + IT-157 cases 5–6.
- **Done:** a facet toggle preserves the scope; Clear All removes the scope and any dangling recency sort.

### Step 5 — the shared chrome (`RangeFacetShell.tsx` new; `RangeFacetFilter.tsx` refactored; `AppDateRangePicker` gains `ranges?`)
- **Files:** `…/Filters/FilterItem/RangeFacetShell/{RangeFacetShell.tsx,RangeFacetShellStyles.ts}` (new) · `…/Filters/FilterItem/RangeFacetFilter/{RangeFacetFilter.tsx,RangeFacetFilterStyles.ts}` · `…/shared/elements/AppDateRangePicker/{AppDateRangePicker.tsx,calendarLocale.ts}`.
- **Action:** move the chrome out of `RangeFacetFilter.tsx` into
  `Filters/FilterItem/RangeFacetShell/RangeFacetShell.tsx` — props `name, filterId, qualifier?, help?, presets?,
  chipText, onClear, disabledReason?, children`. **The render conditions are not a detail — copy them exactly, because
  the shipped component's are not the obvious ones** (read at `0238005c`): the heading + info icon + qualifier always
  render; the shell renders `children` and the presets row **only when it is given them** and never second-guesses the
  caller — **the gate stays in `RangeFacetFilter`, which keeps its own `canSlide = !disabledReason && stops.length >= 2`
  (`:100`) and passes `children={canSlide ? <>{bars}{slider}</> : null}` and `presets={canSlide ? mapped : undefined}`**.
  That is deliberate and load-bearing: the shipped guard has **TWO** conditions, not one. A one-stop rail renders no
  slider *even with no `disabledReason`* (`:60-63`: "MUI computes NaN positions for min == max"), and that state is
  REACHABLE on the only consumer today — `PopularityFilter.tsx:86` sets a reason only when nothing is selected, so one
  occupied band **plus a selection** gives `stops.length === 1` with no reason, the state `PopularityFilter.test.tsx:161`
  already pins. A shell that gated on `!disabledReason` alone would render the slider there (turning `:161` RED) and the
  presets row (a clickable *Never viewed* under a dead rail). **The shell also renders `disabledReason`'s text when it is
  set**; the chip is gated on a non-empty `chipText` (today `hasSelection`, `:99`/`:199` — and
  `PopularityFilter.tsx:98-104` already passes `''` when nothing is selected, so the two conditions coincide and nothing
  changes). **The presets prop CHANGES SHAPE:** today `RangeFacetPreset = {label, range: [number, number]}` (`:17-21`),
  which cannot express a date preset — the shell takes
  `presets?: ReadonlyArray<{ label: string; onSelect: () => void }>` and `RangeFacetFilter` maps its own numeric presets
  into it, so **`RangeFacetFilter`'s public props stay unchanged**. The styles file moves with it
  (`RangeFacetShellStyles.ts` keeps `Presets`; `Bars`/`Bar`/`SliderRow` stay with the slider). `RangeFacetFilter.tsx`
  becomes `<RangeFacetShell …>{bars}{slider}</RangeFacetShell>` — **its public props, its `data-qa` hooks and its
  behaviour are unchanged**, so `PopularityFilter.test.tsx` passes untouched: that is the refactor's oracle (a changed
  Popularity test would mean the refactor changed behaviour — G-C15). `AppDateRangePicker` gains
  `ranges?: {label: string; value: Date[]}[]` (default = today's four, so `CalendarFilter` is byte-identical), its four
  default labels go through `t()`, **and it passes a `locale` built for the active language** (the class-extension fix,
  §5.3 / §6d) — see §9.2(d) for the exact object; a new `calendarLocale.ts` beside the component owns it.
- **Verify:** `PopularityFilter.test.tsx` GREEN **unchanged** — necessary but NOT sufficient, and the plan says so: it
  asserts neither preset-absence in the disabled/one-stop state nor chip-absence with no selection, so it cannot see the
  two conditions above. The sufficient oracle is a **new `RangeFacetShell.test.tsx`** (a new file, so no G-C15 exposure)
  pinning: the shell renders neither `children` nor a presets row when it is given none (the one-stop case) and shows the
  `disabledReason` text when set; no chip when `chipText` is empty; the chip and its × when it is not. **And one added
  assertion in the existing `PopularityFilter.test.tsx:161` one-stop case — the preset link is ABSENT there** (it asserts
  chip + no-slider today, never the preset), which is the only oracle that would catch the *Never viewed*-under-a-dead-rail
  regression; that makes it a CHANGED test, with its row in the table below. Then `calendarLocale.test.ts` (new —
  `en` matches the library's shipped `gregorian_en` arrays exactly — including the Saturday-first weekDays order — **`br`
  returns Portuguese (`janeiro`) and NOT Breton (`Genver`), `ch` returns Chinese and `ua` Ukrainian**, an unknown key falls
  back to English, and every result is IDENTICAL under `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati`, which is what
  pins the UTC-formatter fix); `pnpm tsc` + `pnpm lint`; a `ua` screenshot of the open calendar in the pixel review (Step 9).
- **Done:** one chrome, two bodies, no behaviour change on the Popularity facet; the calendar reads in the user's language
  on all three surfaces that use it.

### Step 6 — the facet (`Filters/RecentlyViewedFilter/{RecentlyViewedFilter.tsx,recencyPresets.ts}`) + the rail + the 7 catalogs
- **Files:** `…/Filters/RecentlyViewedFilter/{RecentlyViewedFilter.tsx,recencyPresets.ts}` (new) · `…/lib/hooks/useRecentlyViewedHistoryEmpty.ts` (new) + `…/lib/hooks/index.ts` · `…/Filters/Filters.tsx` · `…/locales/translations/{br,ch,en,es,fr,hy,ua}.json`.
- **Action:** `recencyPresets.ts` — a pure `presetWindow(kind: 'today'|'7d'|'30d', now: Date, timeZone: string):
  {viewedAfter: string}` using `date-fns` `startOfDay`/`subDays` + `date-fns-tz` `zonedTimeToUtc`, returning a canonical
  `Z` instant (today = local midnight; 7d/30d = local midnight 6 / 29 days ago — "including today"), plus
  `windowFromPicker(begin, end)` = `{viewedAfter: startOfDay(begin).toISOString(), viewedBefore: endOfDay(end).toISOString()}`.
  `RecentlyViewedFilter.tsx` — reads `paramsToSearchState(location.search).recentlyViewed`; `useAppInfo()` for the
  DISABLED label pair; **the empty-history signal is three-valued, not two** — `getRecentlyViewedListFetchingStatuses()`
  (or `pageInfo.page === 0`, the untouched initial state) says NOT-YET-FETCHED, and only a settled `total === 0` means an
  empty history; the slice's initial state is `{ total: 0, page: 0, hasNext: true }` (`recentlyViewed.slice.ts:9`), so a
  naive `total === 0` shows *"You haven't opened any assets yet."* on every mount, before the fetch resolves. **Both this
  control and `Results.tsx` read the SAME derived signal** — a new
  `odd-platform-ui/src/lib/hooks/useRecentlyViewedHistoryEmpty.ts` (exported from `lib/hooks/index.ts`, the shipped
  barrel idiom) returning `'loading' | 'empty' | 'has-history'`, so there is one definition, not two;
  `fetchRecentlyViewedList({page:1,size:1})` once + `getRecentlyViewedListPage()` for the
  empty-history signal (**verified**: `redux/selectors/recentlyViewed.selectors.ts:24` returns `CurrentPageInfo`, and
  the thunk returns `{...pageInfo, page}`, so `.total` is the server's history size). **Note the shared slice** — its
  `fulfilled` reducer REPLACES `state.list` for `page <= 1`, so this `size:1` fetch shortens the list the home panel
  holds; harmless because `RecentlyViewedColumn` re-fetches on mount and only `total` is read here — say so in the
  code comment so the next reader does not "fix" it; renders `<RangeFacetShell name={isShared ? t('Last viewed (shared)') : t('Last viewed')}
  filterId='recently_viewed' qualifier={isShared ? t('Assets anyone has opened') : t('Assets you have opened')}
  help={…} presets={[Today, Last 7 days, Last 30 days, Any time]} chipText={…} onClear={…}
  disabledReason={historyEmpty ? t("You haven't opened any assets yet.") : undefined}>` with the body =
  `<AppDateRangePicker label={t('Custom range')} ranges={[]} defaultRange={defaultRange} setCurrentRange={commitWindow} />`
  where **`defaultRange` is resolved, memoised and never inline** — see §9.2(e) for the literal value and why a fresh
  object would re-fire the picker's `useEffect(:26-28)` on every render. Every commit writes
  `buildSearchLink({ ...paramsToSearchState(location.search), recentlyViewed: next, sort: next ? live.sort : (live.sort === 'last_viewed' ? undefined : live.sort) })`
  — re-reading the LIVE URL (the sibling pattern) so no other dimension is lost, and clearing the scope also clears a
  dangling `last_viewed` sort. Chip text via `useAppDateTime().dataEntityFormattedDateTime`. `Filters.tsx` renders
  `<RecentlyViewedFilter />` **immediately after `<FavoritesFilter />`** (the personal-scope block) with the placement
  comment. **All 22 NEW keys, translated, in all 7 catalogs in this step** (verified 2026-09-06: none of `Last viewed`, `Today`,
  `Last 7 days`, `Any time`, `Custom range` exists in any catalog today; `Recently viewed` exists in all seven) (machine-assisted for `br ch es fr hy ua`, marked in
  the commit body): `Last viewed`, `Last viewed (shared)`, `Assets you have opened`, `Assets anyone has opened`, the help
  sentence, the DISABLED consequence sentence, `Today`, `Last 7 days`, `Last 30 days`, `Any time`, `Custom range`,
  `Last viewed: any time`, `Last viewed: since {{from}}`, `Last viewed: {{from}} – {{to}}`, `Last viewed: before {{to}}`,
  `Recently viewed` (the sort option — **already present in ALL SEVEN catalogs**, verified 2026-09-06 by loading each JSON:
  it is the shipped list-column header, so the option's label costs no new key), `You haven't opened any assets yet.`, `Nothing you opened matches this range.`,
  `You haven't opened any assets yet. Assets you open will appear here.`, and the four picker footer labels
  (`3 Day`, `1 Week`, `2 Week`, `1 Month`).
- **Verify:** `RecentlyViewedFilter.test.tsx` + `recencyPresets.test.ts` (Step 8); `i18n-key-parity.test.ts`.
- **Done:** the control narrows the rendered list; the URL is byte-identical to the serialiser's output.

### Step 7 — the ordering, the empty states and the panel link
- **Files:** `…/Search/Results/SearchSortMenu/SearchSortMenu.tsx` · `…/Search/Results/Results.tsx` · `…/Overview/OwnerAssociation/OwnerEntitiesList/RecentlyViewedColumn/RecentlyViewedColumn.tsx`.
- **Action:** `SearchSortMenu.tsx` — read the scope from `paramsToSearchState(useLocation().search)`; pass it to
  `resolveActiveSort`; render `SEARCH_SORT_OPTIONS.filter(o => o.value !== 'last_viewed' || hasScope)` (the option exists
  only where it means something). `Results.tsx` — beside `isFavoritesScope`, `isRecencyScope`; it consumes the SAME
  `useRecentlyViewedHistoryEmpty()` hook the facet does, and that hook returns **three states, not a boolean**
  (`'loading' | 'empty' | 'has-history'`), so the empty text is a three-way branch, never a binary ternary:
  `isRecencyScope ? (history === 'loading' ? t('No matches found') : history === 'empty' ? t("You haven't opened any assets yet. Assets you open will appear here.") : t('Nothing you opened matches this range.')) : isFavoritesScope ? … : t('No matches found')`
  — a boolean hook would render *"Nothing you opened matches this range."* during the fetch, which R10 forbids.
  `RecentlyViewedColumn.tsx` — replace the "there is no 'View all' yet" sentence in the component's doc comment (`:24-25`)
  with the link, inserted **immediately after `</S.ListLinksContainer>` (`:97`)** and guarded by `items.length > 0` —
  byte-for-byte the `FavoritesColumn:102-112` shape (`MuiLink component={Link} variant='subtitle2' sx={{ mt: 1 }}`), with
  `data-qa='recently-viewed-view-all'` and `to={buildSearchLink({ recentlyViewed: {}, sort: 'last_viewed' })}`. Both files
  already declare the same `items` variable (`RecentlyViewedColumn:38`, `FavoritesColumn:44`), so this is a copy with two
  substitutions — verified at `0238005c`.
- **Verify:** `SearchSortMenu.test.tsx` (extended), the new `Results.emptyState.test.tsx` (all THREE states, including
  loading), IT-157 cases 2/9/10/11.
- **Done:** the scope's list reads newest-first; the panel's View all reproduces the panel.

### Step 8 — tests, BOTH buckets, each with a named RED-on-base oracle (G-C9 / G-C15)
- **Files:** BE new — `AssetSearchRecentlyViewedIntegrationTest`; BE extended — `SearchSortDtoTest`, `AssetSearchCursorTest`,
  `AssetSearchKeysetPaginationTest`, `AssetSearchControllerWebTest`, `SavedSearchControllerWebTest`,
  `SavedSearchServiceImplTest`, `LegacySearchSortFallbackTest`, `AssetSearchServiceMyDataTest`,
  `AssetSearchScopePredicateTest`. FE new — `RecentlyViewedFilter.test.tsx`, `recencyPresets.test.ts`,
  `calendarLocale.test.ts`, `RangeFacetShell.test.tsx`, **`components/Search/Results/__tests__/Results.emptyState.test.tsx`**
  (the three-way branch has no existing home — `Results.tsx` has no test file today); FE extended —
  `searchUrlState.test.ts`, `searchFormDataToUrlState.test.ts`, `SearchSortMenu.test.tsx`, **`PopularityFilter.test.tsx`**
  (the one added preset-absence assertion, B1). odd-team —
  `integration-tests/protocols/IT-157-recently-viewed-facet.md`, `integration-tests/e2e/specs/recently-viewed-facet.spec.ts`,
  **and `integration-tests/suites.yaml`** (the one-line `pending-merge` lane entry — easy to forget, and a protocol that is
  in no suite is never executed).
- **Verify / Done:** the commands and their acceptance are §9.3 and §9.4; a test is not written until it has been RUN
  GREEN on the branch and RED on the base, and the ledger (§11) cites the run-log line for each.
**Unit (odd-platform, runs in `./gradlew build`):**
- **`AssetSearchRecentlyViewedIntegrationTest`** (new, `BaseIntegrationTest`, modelled on `AssetSearchFavoritesIntegrationTest`):
  seed 3 data entities + 1 term + 1 query example sharing a per-case token, write history rows directly through
  `ReactiveRecentlyViewedRepository.recordView` (the production write path) and back-date them with an explicit
  `dbQuery`-equivalent update; cases — **R1** `{}` returns exactly the history ∩ the token (the never-opened FOIL absent;
  `total == rows`); `{viewed_after}` / `{viewed_before}` / both narrow and drop the out-of-window FOIL; **R2** the term and
  the query example are returned (cross-kind), and a row written under a DIFFERENT identity is ABSENT (the leak foil);
  **R3** an inverted window → empty page + `total 0`; **R5** a row at `21:30Z` is included by `viewed_after=00:00+03:00`
  and excluded by `00:00Z`; **R6** scope + no sort ⇒ most-recent-first, scope + `sort=name` ⇒ by name, `sort=last_viewed`
  WITHOUT the scope ⇒ status-priority, query + scope ⇒ relevance, and a keyset page 2 equals the single page
  (`assertPagingEqualsSinglePage`); **R1/histogram** the popularity facet counts only the scoped DE subset; **R14** an
  EXPLAIN oracle in the `AssetSearchSortIntegrationTest.explainUnionOrderBy` idiom asserting the `LAST_VIEWED` ORDER BY
  plans WITHOUT a full `Sort` node and that the `NULLS LAST` spelling DOES add one (self-contained RED→GREEN on the same data).
- **`AssetSearchKeysetPaginationTest`** `:152` gains two tampered `LAST_VIEWED` tokens (`v:"abc"`, `vn:true`) → first page, 200.
- **`AssetSearchControllerWebTest`** +3: the scope binds and returns 200; an inverted window → 200 with an empty list;
  an unparseable `viewed_after` → **400** (the measured status of the shipped date-time binding, §4 open question 5;
  the assertion is `isBadRequest`, and a 5xx would be a defect fixed in-slice).
- **`SavedSearchControllerWebTest` + `SavedSearchServiceImplTest`**: a web round-trip keeps `recently_viewed`; a legacy row
  reads back without it; a junk bound is dropped field-level; an inverted stored window reads back with BOTH bounds absent.
- **`SearchSortDtoTest`** (**EXTENDED, not new — the file already exists** at
  `odd-platform-api/src/test/java/…/dto/SearchSortDtoTest.java` with three tests, and `:29-30` calls the **2-arg**
  `resolveEffective`): add the `resolveEffective` truth table (scope × query × requested token). Keeping the 2-arg
  overload (Step 2.2) leaves the three shipped cases byte-identical.
- **`LegacySearchSortFallbackTest`** +2: `sort=last_viewed` on the legacy path falls back to relevance (with a query) and
  status priority (browse).
- **CHANGED tests (G-C15 — each asserts MORE truth; SoT named; RED survives):**
  | Test | Change | SoT | Surviving RED |
  |---|---|---|---|
  | `SearchSortDtoTest` (exists; 3 tests, 2-arg `resolveEffective` at `:29-30`) | ADD the scope × query × token truth table | the 3-arg contract defined in Step 2.2 | the new rows cannot resolve on `ref:main` (no third parameter, no `LAST_VIEWED`); the three existing cases are untouched because the 2-arg overload is kept — nothing is weakened |
  | `AssetSearchCursorTest:83-92` (exists; it already carries the tampered-value + `STATUS_PRIORITY` `vn:true` cases) | ADD two cases through the PUBLIC API (`parsesForSort` is `private static`, `AssetSearchCursor.java:148` — use the
  file's own `decode(<token>, sort)` idiom): a `LAST_VIEWED` token whose `v` is `"not-a-timestamp"` → `decode` empty, and
  `decode(keyset(LAST_VIEWED, null, true, kind, id).encode(), LAST_VIEWED)` → empty (the NOT-NULL guard) | the cursor's own fail-closed contract, mirroring the `STATUS_PRIORITY` case beside it | RED on base (`LAST_VIEWED` does not exist there) — and this is the cheap pure-unit home for those changed lines, so the coverage gate sees them |
  | `PopularityFilter.test.tsx:161` (the one-stop-with-selection case) | ADD one assertion — `expect(screen.queryByRole('button', { name: 'Never viewed' })).toBeNull()` (the preset IS a button with that accessible name; the file's own `ua` case at the end already queries it as `getByRole('button', {name: …})`) | the shipped render conditions at `RangeFacetFilter.tsx:100`/`:173-185` — the presets live inside `canSlide`, so they must not render on a one-stop rail | RED if the shell extraction ever renders presets outside `canSlide`; strictly MORE truth than today's chip+no-slider assertions, nothing weakened |
  | `AssetSearchServiceMyDataTest:167-171` | the repository mock arities gain one `any()` | the new interface signature (compile-time) | assertions unchanged; still RED if the scoping regresses |
  | `AssetSearchScopePredicateTest:151,235,244` | the call sites gain a trailing `null` | same | same |
  | `SearchSortMenu.test.tsx:85` "the five canonical orderings" → five **without** the scope and six **with** it (two cases) | `SEARCH_SORT_OPTIONS` + the conditional-render rule | RED on base (no sixth option exists) |
  | `searchFormDataToUrlState.test.ts:126,153` | `Required<SearchUrlState>` gains `recentlyViewed`; `WIRE_KEYS` 10 → 11 | the generated `ToJSON` emits every wire key | RED on base (a 10-key set vs the 11 emitted) |
**Unit (FE, vitest — CI does not run it, so it is run and cited):** `searchUrlState.test.ts` (+ the four shapes'
round-trip, the junk/inverted/bare-date drops, the canonicalisation of an offset instant, the projections both ways, the
sort truth table) · `searchFormDataToUrlState.test.ts` (the D11 lock — **its recency fixture must carry real `Date`
bounds, exactly what `FromJSON` produces; an ISO-string fixture passes on the broken implementation and proves nothing**) · `RecentlyViewedFilter.test.tsx` (new — URL
reflection per shape, a preset click writing the canonical URL through a location probe, the picker commit, **the two shapes that would invert an unordered seed — `viewed_before`-only with an
old bound, and a hand-written future `viewed_after` — where the seeded `defaultRange` must come back ordered and
pressing Done must not clear the filter**, the DISABLED
label + info icon, the empty-history disabled reason, clearing drops the dangling sort, one render under `ua.json`) ·
`recencyPresets.test.ts` (new — fixed `now` + `Pacific/Kiritimati` / `UTC` / `America/New_York`) · `SearchSortMenu.test.tsx` ·
`Filters` Clear-All case · `i18n-key-parity.test.ts` (unchanged, run).
**Integration (odd-team `IT-157` — `integration-tests/protocols/IT-157-recently-viewed-facet.md` +
`e2e/specs/recently-viewed-facet.spec.ts`, stack `odd-minimal`, `validates: [F-017]`, lane `pending-merge` until the PR
merges — graduated at the GATE-2 close-out per TST-067):**
**Isolation rule, stated in the protocol's preconditions, not just here:** under `auth.type=DISABLED` there is exactly ONE
history bucket (`__shared__ / DISABLED`) and IT-149 drives it too (both live in `feature-complete` once IT-157 graduates).
So this spec **never empties the bucket** — it seeds and asserts its own token's rows and uses windows to exclude, not
deletion. The truly-empty-history state (the control disabled with *You haven't opened any assets yet.*) is proven in
**vitest**, where the signal is mocked, precisely because proving it in the browser would mean a global mutation that
breaks a sibling spec. Case 12's single `DELETE` removes one of THIS spec's own rows and re-records it afterwards. seed three data entities + a term + a query example sharing a
token; open some through the REAL `POST /api/recently-viewed/{kind}/{id}` and back-date rows with `dbQuery` where a window
needs an age. **Every case asserts NARROWING WITH A FOIL** (on base the params are dropped, so presence alone is GREEN):
| # | Case | RED on `0238005c` because |
|---|---|---|
| 1 | deep link `?q=tok&recently_viewed=yes` → only the opened assets; the never-opened FOIL **absent**; chip `Last viewed: any time` | the param is unknown → the unfiltered list shows the foil |
| 2 | the same URL lists most-recent-first (the panel's order) and the sort menu reads *Recently viewed* | no ordering, no option |
| 3 | click **Today** → the URL gains `viewed_after=<local midnight Z>`; only today's opens listed; the back-dated one absent | no control |
| 4 | the picker's custom range → both params; the window narrows; the chip names both dates | no control |
| 5 | with the scope on, tick a Statuses facet → the params survive and the narrowing holds, also 1.5 s later | no mirror merge |
| 6 | Clear All → the params AND `sort=last_viewed` gone; the foil back | the scope never applied |
| 7 | save the search with the scope → reload → reapply → the same narrowing; the copied link carries the params | the spec has no `recently_viewed` |
| 8 | a term and a query example that were opened are listed (cross-kind) | — (RED via the foil in the same assertion) |
| 9 | the home panel's **View all** → `/search?recently_viewed=yes&sort=last_viewed`; the landing list's first rows are the panel's rows in the same order; the never-opened foil absent | the panel has no View all |
| 10 | under DISABLED the control reads **Last viewed (shared)** and `filter-recently_viewed-info` renders | no control |
| 11 | a window that matches nothing (`viewed_after` = tomorrow) lists nothing and the results area reads *Nothing you opened matches this range.* — **not** a bare "No matches found" | no control, no sentence |
| 12 | each listed row shows a *Viewed …* marker; removing one drops it from the list without reload — **then the case re-opens that asset so the row is restored**, because the bucket is shared with IT-149 | — (the marker exists on base; the RED is the list it is in) |
| 13 | **the timezone case:** a second `browser.newContext({ timezoneId: 'Pacific/Kiritimati' })` opening the SAME URL returns the SAME rows, and its own **Today** click writes a DIFFERENT instant | no control |
Every `expect(...)` on a response body is written from a CAPTURED real response (§3a + a fresh capture at authoring time) —
the CTRIB-023/IT-137 rule.

### Step 9 — run the gates (the Definition of Done; nothing is deferred to `/review`)
- **Files:** none — this step RUNS things; its outputs are the run-logs and this record's §11 ledger.
- Full unit build: `ODD_PLATFORM_DIR=../odd-platform-ctrib067 scripts/run-platform-tests.sh` (test + checkstyle + assemble).
- FE: `pnpm generate && pnpm tsc && pnpm lint && pnpm exec vitest run
# the inner loop (bare `pnpm test` is `vitest` = WATCH mode on a TTY - it never returns):
pnpm exec vitest run src/lib/search src/components/Search src/components/shared/elements/AppDateRangePicker` in `../odd-platform-ctrib067/odd-platform-ui`.
- The impacted IT both ways: `ODD_STREAM=ctrib067 ODD_PLATFORM_DIR=../odd-platform-ctrib067 integration-tests/run-suite.sh IT-157`
  (GREEN on the fix) and the same with `ODD_SUT=ref:main` (the RED half).
- **The FULL four-suite regression on the committed head:** `integration-tests/run-regression.sh ctrib067` —
  `feature-complete` green (read the counts; the tracked baseline is TST-059's eleven + TST-057's swagger straggler),
  `multi-stack` green, `known-bugs` still-RED, `ingestion-e2e` green.
- Changed-lines coverage ≥ 98 % from the local JaCoCo XML (the CTRIB-066 §8a recipe: run the changed test classes plus the
  siblings that traverse the refactored `scoped()`/`searchFrom()` paths; the `repository/reactive` package is
  not-instrumented on both sides — memory `reference_odd_platform_coverage_gate_mechanics`).
- SRE re-measure on the built SUT through the real endpoints at 126k (§4a's numbers, `auto_explain` for the executed plan).
- **Pixel review (G-C12 step 5):** screenshot the rail at 1280×720 with the facet open, the picker popup, the chip, the
  disabled state and the DISABLED label; read them as a user (the ST-9 pixel review found a product defect no green test saw).
- **Done:** every gate ACTUALLY RUN at the committed SHA and recorded in §11's ledger — never "deferred to review".

### Step 10 — docs on `documentation@release/1.0.0` (own worktree `../documentation-ctrib067` off `origin/release/1.0.0`; same-name push; LSN-034)
- `docs/data-discovery/search.md`: **`## Last viewed`** after `## Favorites` — what it scopes (your own history, every asset
  kind), the presets + custom range, **local days in / exact instants out** (one sentence + the shared-link consequence),
  the default ordering + the `Recently viewed` sort option, the URL shape, saved searches, the DISABLED `(shared)` posture,
  the retention bound (linking `housekeeping.ttl` in `configuration-and-deployment/odd-platform.md`, quoting no number), the
  privacy sentence ("a shared link shows the recipient THEIR history, never yours"), and the two shipped facet interactions
  (a DE-only facet excludes terms/query examples; a Popularity range makes the list DE-only); the "filters travel with the
  link" bullet gains it; the frontmatter `description` re-authored ≤ 200 chars (today **181**, measured with PyYAML on `origin/release/1.0.0`;
  appending would overflow;
  measured, PyYAML-parsed, no `: ` hazard).
- `docs/data-discovery/recently-viewed.md`: **`## Finding your history in Search`** (the panel's View all → the scoped
  search; the retention caveat; the cross-surface marker) + the Where-to-next entry.
- `docs/data-discovery/catalog-overview.md:47`: the panel now carries a View all; name its destination.
- `docs/Features.md:60` + `docs/data-discovery.md:13,23`: the enumerations gain the scope.
- `docs/main-concepts.md` Terms & Aliases: *Last viewed* (the search scope) ↔ *Recently Viewed* (the feature) — doc Gate 2.
- Paired `backlog/docs/DOC-529.md` (`milestone: "1.0.0"`, the affected pages + the expected post-merge URLs for the release gate).
- **Files:** the six `documentation` pages above (on `release/1.0.0`) + `backlog/docs/DOC-529.md` (odd-team).
- **Verify:** every changed page re-read end-to-end; `git grep -n "no .View all. yet"` on the docs branch returns nothing;
  the frontmatter parses with PyYAML and its `description` measures ≤ 200 chars with no `: ` hazard.
- **Done:** the doc branch is pushed and its commit SHA is cited in this record AND in `DOC-529`; a backlog draft alone is
  NOT "authored" (the `review-ctrib040` case-law).

### Step 11 — ontology (G-C10) + follow-ups on disk
- `lineage/odd-platform/feature-flows/detail/F-017.yaml`: **`F-017-UC-18`** — *"A user narrows the catalog search to the
  assets they themselves opened, optionally within a date window they pick as local days; the list reads newest-first; it
  works for every asset kind; it rides the URL, survives every other facet, is cleared by Clear All, is reapplied by a saved
  search, and the home panel's View all opens exactly that list; under auth.type=DISABLED it scopes the shared instance-wide
  history and says so"* — `coverage: verified`, `test_ref` → IT-157 + the named unit classes, with the trace chain; UC-16's
  note gains a cross-reference (the popularity histogram is scoped by recency too); `use_case_coverage` 17 → 18, verified
  5 → 6; then `uv run --project lineage/_extractor lineage-extractor graph-build odd-platform` (re-embed) and **commit**.
- Any discovery outside this scope routes through `playbooks/follow-up-on-disk.md` — filed as a real GitHub issue via the
  App token (memory `feedback_agent_files_github_issues`), not left as a draft.
- **Files:** `lineage/odd-platform/feature-flows/detail/F-017.yaml` (+ whatever follow-up files a discovery creates).
- **Verify:** `uv run --project lineage/_extractor lineage-extractor graph-build odd-platform` reports a node/vector count
  ≥ the previous build; `git status --short lineage/` is clean after the commit.
- **Done:** the promise is committed (not narrated) and the graph rebuilt — G-C10's "committed, not narrated" bar.

### Step 12 — the draft PRs (GATE-2 entry — the bot never merges)
- odd-platform DRAFT PR, base `main` ← `contrib/CTRIB-067-recently-viewed-facet`: root cause/intent, the change, the
  scope exclusions, the test evidence (both buckets + the RED halves), the docs/ontology deltas, `Milestone: 1.0.0`,
  `Docs: documentation@release/1.0.0 — publishes with the 1.0.0 release`, and **`Closes #1844` + `Closes #1832`** — then a
  LIVE read of the created body to verify no other closing keyword slipped in (the CTRIB-039 case-law).
- documentation DRAFT PR, base `release/1.0.0` ← `docs/CTRIB-067-recently-viewed-facet`.
- **Files:** none in the repos — two GitHub PRs + this record's frontmatter (`pr:`, `head_sha:`, `status:`) and the
  `ctrib067` entry in `state/active-streams.yaml`.
- **Verify:** a LIVE `GET` of each created PR confirms `draft: true`, the base branch, and that the ONLY closing keywords
  in the body are `Closes #1844` and `Closes #1832`; the issue milestone is re-read and still `1.0.0` open (G-C11).
- **Done:** status → `review-ready`; GATE 2 is the maintainer's. The implementer never sets `merged` or `done`.

### `must_haves` (the plan contract — G-C19)

**User-observable truths** (each traces to a §4 acceptance line):

| # | Truth | Spec | Covered by |
|---|---|---|---|
| T1 | Turning on **Last viewed** lists only the assets I have opened, and the count above the list agrees | R1 | unit + IT-157 #1 |
| T2 | Picking **Today** / a custom range lists only what I opened in that window; what I opened earlier disappears | R1, R5, R7 | unit + IT-157 #3/#4 |
| T3 | The scoped list is **newest-first**, and the sort menu says *Recently viewed* | R6 | unit + IT-157 #2 |
| T4 | Terms and query examples I opened are listed too — the scope is not data-entity-only | R2 | unit + IT-157 #8 |
| T5 | I only ever see **my own** history; a link I share shows the recipient theirs | R2, R13 | unit (leak foil) + IT-157 #1 |
| T6 | A garbage or contradictory window never errors: the UI shows no filter, the API answers an empty list | R3 | vitest + web test + IT-157 |
| T7 | The dates I pick are my **local days**, and a colleague in another timezone opening my link gets the same assets | R5 | unit + `recencyPresets` vitest + IT-157 #13 |
| T8 | The scope survives every other facet toggle, and **Clear All** removes it (and its ordering) | R4 | IT-157 #5/#6 |
| T9 | A saved search that had the scope reapplies it, and its copied link carries it | R9 | vitest + web test + IT-157 #7 |
| T10 | The home page's **Recently Viewed** panel now has a **View all** that opens exactly that list, in the same order | R11 | IT-157 #9 |
| T11 | On an auth-disabled deployment the control works on the shared history and **says so** | R8 | IT-157 #10 |
| T12 | With no history at all, the control is disabled and tells me why; with a window that matches nothing, the list says so | R10 | vitest + IT-157 #11 |
| T13 | Each listed row shows when I opened it, and removing it drops it from the list | R12 | IT-157 #12 |
| T14 | Every label — **and the calendar's month and weekday names** — reads in my language | R15 | the parity vitest + a `ua` render + `calendarLocale.test.ts` + the `ua` pixel shot |
| T15 | The manual documents the scope, the timezone rule, the retention bound and the privacy consequence | R16 | the re-read pages + DOC-529 |

**R14 (performance) deliberately has no truth row** — it is not a yes/no a user observes on the running system, it is a
MEASUREMENT. It is carried by Step 2 (the join shape) and Step 9's SRE re-measure, and its acceptance is §4a's ledger
reproduced on the built SUT. Recorded so the 16-vs-15 gap reads as a decision, not an omission.

**Artifacts** (path → provides → grep anchor):

| Artifact | Provides | Anchor |
|---|---|---|
| `odd-platform-specification/{components,openapi}.yaml` | the wire object + the sort token's scoping prose | `RecentlyViewedScope`, `LAST_VIEWED` |
| `…/dto/RecentlyViewedScopeDto.java` | the identity + UTC bounds + `contradictory()` | `record RecentlyViewedScopeDto` |
| `…/dto/SearchSortDto.java` | the token + the scope-aware default | `LAST_VIEWED`, `hasRecencyScope` |
| `…/dto/AssetSearchCursor.java` | the fail-closed cursor for the new sort | `case UPDATED_AT, LAST_VIEWED` |
| `…/repository/reactive/ReactiveAssetSearchRepositoryImpl.java` | T1–T5, T3's order | `RECENTLY_VIEWED.LAST_VIEWED_AT`, `searchFrom(` |
| `…/service/AssetSearchServiceImpl.java` | one identity resolution for both scopes; the histogram scoped | `getRecentlyViewed()` |
| `…/repository/reactive/ReactiveDataEntityRepositoryImpl.java` | the legacy session ignores the token | `!= SearchSortDto.LAST_VIEWED` |
| `…/service/SavedSearchServiceImpl.java` | T9's normalisation | `sanitiseRecentlyViewed` |
| `…/lib/search/searchUrlState.ts` | T6, T8, T9, T3's FE rules | `SEARCH_VIEWED_AFTER_PARAM` |
| `…/components/Search/Search.tsx` | **T8** | `recentlyViewed: live.recentlyViewed` |
| `…/components/Search/Filters/Filters.tsx` | the rail placement + Clear All | `<RecentlyViewedFilter` |
| `…/Filters/FilterItem/RangeFacetShell/RangeFacetShell.tsx` | the shared chrome | `children` |
| `…/Filters/RecentlyViewedFilter/{RecentlyViewedFilter.tsx,recencyPresets.ts}` | T1, T2, T7, T11, T12 | `filter-recently_viewed` |
| `…/shared/elements/AppDateRangePicker/{AppDateRangePicker.tsx,calendarLocale.ts}` | the date body + the i18n fix (labels + the calendar's own month/weekday names) | `ranges?:`, `calendarLocale(` |
| `…/Search/Results/SearchSortMenu/SearchSortMenu.tsx` | T3's control | `last_viewed` |
| `…/lib/hooks/useRecentlyViewedHistoryEmpty.ts` (+ the `lib/hooks/index.ts` barrel) | T12's ONE three-valued signal, shared by the facet and the results area | `has-history` |
| `…/Search/Results/Results.tsx` | T12's list-side sentence | `isRecencyScope` |
| `…/Overview/…/RecentlyViewedColumn/RecentlyViewedColumn.tsx` | **T10** | `recently-viewed-view-all` |
| `…/locales/translations/{br,ch,en,es,fr,hy,ua}.json` | T14 | `Last viewed` |
| `integration-tests/protocols/IT-157-*.md` + `e2e/specs/recently-viewed-facet.spec.ts` + `suites.yaml` | T1–T13 | `recently_viewed=yes` |
| `documentation@release/1.0.0` (6 pages) + `backlog/docs/DOC-529.md` | T15 | `## Last viewed` |
| `lineage/odd-platform/feature-flows/detail/F-017.yaml` | the promise | `F-017-UC-18` |

**key_links** (where this would silently half-work):

| From | To | Via | Silent failure if missed |
|---|---|---|---|
| a sidebar facet toggle | the preserved scope | the `Search.tsx` merge object | the #1858 class — the scope vanishes on the next click |
| a preset / picker commit | the canonical URL | `buildSearchLink` + `searchStateToParams`, never a literal | a byte-divergent URL the mirror rewrites — the control flickers and reverts |
| `AssetSearchFormData.recently_viewed` | the SQL in **all four** methods | the DTO threaded through `keysetPage`, `relevancePage`, `count`, `popularityHistogram` | a total, or a histogram, that disagrees with the rows |
| the scope | the `LAST_VIEWED` sort key | ONE `searchFrom(rv)` join serving predicate AND order | a sort that cannot see its column (a second join, or a filter-only EXISTS) |
| `sort=last_viewed` without the scope | the per-context default | `resolveEffective(..., hasRecencyScope)` **and** `resolveActiveSort` | the server orders by a column it did not join, or the menu shows a dead option |
| a `last_viewed` page 2 | a fail-closed seek | `AssetSearchCursor.parsesForSort` + the `:128` NOT-NULL guard | a tampered cursor 500s or seeks another column's NULL tail |
| the stored spec | the reapplied scope | `assetSearchFormDataToUrlState` + `sanitiseRecentlyViewed` (a `Date` OR a string) | LSN-042 again — a saved search that silently lost its scope |
| a local day the user picked | the instant in the URL | `zonedTimeToUtc(startOfDay(...))`, never a bare date | an off-by-a-timezone filter that "reads as broken" (the maintainer's own words) |
| the panel's View all | a list that resembles the panel | `recently_viewed=yes` **+** `sort=last_viewed` | a link that betrays its origin (the ST-9 lesson) |
| Clear All | no dangling ordering | dropping `sort=last_viewed` with the scope | a cleared search still claiming an ordering it cannot apply |
| the active language | the calendar's month + weekday names | `calendarLocale(i18n.language)` passed as the picker's `locale` | a `ua` user picks dates from an English calendar — the class this slice would otherwise extend onto a third surface |
| IT-157 | a real RED on base | asserting the FOIL's absence, never the subject's presence | a test green on the unfixed base (G-C15) |

**Two key_links verified as already wired (traced, not assumed):** the request build — both fetch sites in `Results.tsx`
(`:105` scroll, `:113` page 1) read one `assetSearchFormData` memo from `location.search`, so the scope reaches the request
the moment the projection exists; the re-query trigger — a changed scope changes `searchStateToParams`' output, so
`Search.tsx`'s `urlStateKey` changes and page 1 re-fires (the `asset_kinds` / `favorites` / `popularity` mechanism).

**No scope-reduction language.** The ordering is a GATE-1 option, not a deferred shadow; relative windows are excluded on a
stated product argument with the additive path named; the histogram/preset counts are excluded with a reason, not on effort;
the picker's i18n gap is FIXED in-slice rather than deferred as pre-existing (G-C5 class-extension clause).

## 8. GATE 1 — the packet for the maintainer

**Status: PENDING.** Two decisions, then the plan is approved as written (or corrected). Both are stated in §5.4 / §5.5
with their option tables; the recommendation is **D1 = A** and **D2 = A**.

| | The question, in plain language | Recommended | The cost of NOT doing it |
|---|---|---|---|
| **D1** | The issue says the filter should return **nothing** when authentication is disabled. Since #1816 shipped, such a deployment DOES keep one shared history, and the home panel shows it. Should the filter work on that shared history (labelled, with the consequence spelled out), or return nothing as written? | **A — it works, labelled `Last viewed (shared)`** | the panel shows five rows and its "View all" opens an empty list — the contradiction the maintainer's own pre-work note forbids; and the demo stand (`AUTH_TYPE=DISABLED`) never demonstrates the feature |
| **D2** | A filter says *which* assets, not *in which order*. Should this slice also add a **Recently viewed** ordering (offered only while the filter is on, and its default), so the list reads as a history and the panel's "View all" reproduces the panel? | **A — yes, filter + ordering; the PR then closes #1832 too** | the recency list comes back in status-priority order, the panel's link betrays the panel, and #1832 stays open waiting for a sort that has no other owner |

Everything else in §7 is a documentation/UX call inside the approved ADR and is decided (§5.6). **Approving this plan also
authorises Step 0** — the two scope comments (on #1844: the corrected DISABLED line + the folded ordering + relative
windows excluded; on #1832: closed by this PR), posted before any code.

**Plan-check (G-C19):** see §8a — a PASS with no open BLOCKER is required before this gate; the record carries the verdict.

### 8a. Plan-check record (G-C19)

| Round | Verdict | Disposition |
|---|---|---|
| **1** (2026-09-06, fresh context, static-only at `0238005c`) | **ISSUES FOUND — 4 blockers, 11 warnings** | all 4 blockers FIXED (below) + 9 of 11 warnings folded; W9 (size) recorded as justified, W5 closed by adding `Files·Verify·Done` to Steps 8/10/11/12 |
| **2** (same day, same checker, fresh read) | **ISSUES FOUND — 3 blockers, 7 warnings**; it confirmed B1/B2 of round 1 genuinely cleared and caught that two of my four "fixes" were HALF-fixes | all 3 blockers fixed + the 4 genuinely-open warnings folded (3 of the 7 were already fixed in the file before round 2 read it) |
| **3** | **SELF-RUN — the independent re-check is OWED.** The round-3 agent terminated on a session rate limit (HTTP 429) before producing a verdict, so `playbooks/plan-contract.md`'s on-fail clause applies: "self-run its dimensions against the plan and record the result; note that the independent check is owed, the same way `/review` is owed on the diff." | D1/D4/D7/D9 self-run against the three round-2 fixes; each fix re-verified in the source; **one NEW defect found and fixed** (below) |

**Round 3, self-run — what was checked and what it found.** Each round-2 fix was re-derived from the source rather than
re-read from the plan: `PopularityFilter.test.tsx:161` **is** the one-stop-with-selection case
(`popularity_min=5&popularity_max=5` over `facet({5:3})` → one occupied band, `disabledReason` undefined because a
selection exists) and it genuinely asserts chip + no-slider + no-`NaN` and **not** preset-absence — so the added
assertion is exactly the missing oracle, and the same file's `ua` case proves the query shape (the preset is a button
with an accessible name). `AssetSearchCursorTest` already uses `decode(keyset(...).encode(), sort)` as its public idiom
and already carries both the `UPDATED_AT "not-a-timestamp"` and the `STATUS_PRIORITY` `vn:true` cases the two
`LAST_VIEWED` cases mirror. The three-valued hook is spelled consistently in both consumers and now has its own row in
the artifacts contract.

**The new defect this pass found:** the round-2 `defaultRange` clamp fixed only ONE of the two shapes that invert. A
hand-written future `viewed_after` with no `viewed_before` also lands `begin` after `end`, with the same consequence
(Done commits an inverted window and the URL rule drops the filter). The fragment now **orders the pair** rather than
clamping one side — a no-op for the two well-formed shapes, correct for both pathological ones.

**What is owed:** an independent round-3 plan-check, run in a fresh context when the session limit resets. It is owed the
way `/review` is owed on a diff: the three round-2 blockers were fixed by the same author who wrote the text they
correct. Recorded here rather than quietly skipped; the maintainer decides at GATE 1 whether to approve on a self-checked
round or wait for the independent one.

**Round 2's three blockers — the two half-fixes and the one that would have been published:**

1. **My shell fix gated on `!disabledReason` alone; the shipped guard has TWO conditions.** `RangeFacetFilter.tsx:100` is
   `!disabledReason && stops.length >= 2`, and its own Javadoc `:60-63` documents the second state ("fewer than two stops
   renders NO slider **even without a reason** … MUI computes NaN positions"). It is reachable on the only consumer today
   — one occupied band plus a selection — and `PopularityFilter.test.tsx:161` already pins it. The gate now stays in
   `RangeFacetFilter` (it keeps `canSlide` and passes `children`/`presets` conditionally), and the preset-absence
   assertion that was missing from every oracle is added to `:161` as a CHANGED test.
2. **My `defaultRange` fragment resolved three of the four scope shapes.** With only `viewed_before` set and older than
   six days, the unclamped start landed AFTER the end; the picker takes it as `value` and Done commits unconditionally,
   so opening a shared "before X" link and pressing Done would have silently cleared the filter. Clamped, with a
   `viewed_before`-only test case.
3. **The public issue I drafted stated three things the source contradicts.** The SME raised the picker's "icon-only
   trigger, no typed-date input", graded it LOW and said *verify*; I did not, and drafted it for posting. It renders a
   native tabbable `<input type="text">` (`input_icon`'s source; ODD's wrapper styles its `:focus`). The issue is
   **withdrawn**, the false claims are struck from §4 and §6(d), and what is genuinely unknown is answered by driving the
   control in Step 9 — see §8b(iii). This is the finding that most justifies the gate: it was one approval away from a
   false public statement under the team's name.

**The four blockers, and what each changed — every one was re-verified in the source before fixing:**

1. **`parseInstant` as written rejected a `Date`**, while the same step required it to accept one — so every saved search
   with a recency scope would have reapplied unnarrowed *while reporting success*: the exact LSN-042 class this slice
   exists to close, on the key_link the plan itself names. Step 3 now types it `raw: unknown` and handles `Date`
   explicitly, and the R9 fixture is required to carry real `Date` bounds (a string fixture passes on the broken code).
2. **`SearchSortDtoTest` was labelled "(new)" and already exists** (three tests, calling the 2-arg `resolveEffective` at
   `:29-30`) — a literal executor would have collided with or overwritten shipped tests, and the change escaped the
   G-C15 CHANGED table. Relabelled EXTENDED with its table row; `AssetSearchCursorTest` (W8) joined it as the cheap
   pure-unit home for the two cursor changes.
3. **The `RangeFacetShell` extraction was specified in a way that changes shipped Popularity behaviour**, and the named
   oracle could not see it: at `0238005c` the presets row sits INSIDE `canSlide` (`:173-185`) and the chip renders on
   `hasSelection` (`:99`/`:199`), so rendering both unconditionally would put a clickable *Never viewed* link under
   *"No views recorded yet"*. Step 5 now states both render conditions and the preset prop's shape change, and adds a
   **new `RangeFacetShell.test.tsx`** as the sufficient oracle.
4. **The picker's required `defaultRange` was left as `{…}`** — the one value the executor would have had to invent, on
   the control that delivers T2, against §9's own promise. Resolved as §9.2(e) with the literal memoised JSX, plus the
   product decision it encodes (what the calendar shows in the "any time" state).

**Round-2 warnings:** three were already fixed in the file before round 2 read it (the R9 asymmetry wording, the §4
garbled clause, and IT-157 case 12's restore step). The four genuinely open ones are now folded: §9.3's command block
still ran watch-mode `pnpm test` (only Step 9 had been corrected); `Results.tsx` needed the same THREE-valued signal as
the facet, via one shared `useRecentlyViewedHistoryEmpty()` hook with a named file, and its empty-state vitest had no
home so one is created; R13's no-write-on-read now has a real oracle (IT-157 case 1 counts zero record POSTs across the
interaction); and the cursor cases go through the public `decode(...)` API because `parsesForSort` is private. Steps 1
and 3–7 and 9 gained their `Files:` lines.

**Round-1 warnings folded:** R14's missing truth is now an explicit measured-only note (W1); the empty-history signal is
three-valued and shared by one hook, so the not-yet-fetched state cannot masquerade as "no history" (W2); IT-157 no
longer empties the single shared DISABLED bucket that IT-149 also drives — the truly-empty state moved to vitest (W3);
the FE gate is `pnpm exec vitest run`, not watch-mode `pnpm test` (W4); Steps 8/10/11/12 gained `Files·Verify·Done`, and
`suites.yaml` now appears in a Files line (W5); the inverted-window rule is stated ONCE and mirrored on both surfaces with
a paired test (W6); the picker's icon-only trigger is filed as a real issue at Step 0 (W7, §8b iii); `AssetSearchCursorTest`
joined the test plan (W8); the two mis-measured numbers are corrected — the doc description is 181 chars, IT-157 has 13
cases (W10); and the three public bodies are drafted verbatim, ASCII-verified, id-free (W11).

**Recorded as sound by round 1, not to be re-litigated:** the INNER JOIN reaches all five `searchFrom()` call sites
including the keyset `branch()`, and `keysetSortValueField` puts `RECENTLY_VIEWED.LAST_VIEWED_AT` into every UNION arm's
select list for the outer `u.field("sv")` ordering; the count stays exact via the UNIQUE
`recently_viewed_identity_asset_key`; the service / repository / cursor sort resolutions agree and the FE mirrors them;
D4 passes with zero scope-reduction phrases and the class-extension test *passed* rather than deferred.

### 8b. The three public artefacts Step 0 posts on approval — the words themselves, ASCII, no workspace ids

**(i) Comment on #1844:**

```text
Scope note before implementation starts.

This PR covers the Last viewed (recency) filter on the catalog search, the ordering that goes
with it, and the Recently Viewed panel's "View all" link - which means it also closes #1832.

Three ways the scope differs from this issue's original text:

1. The line "empty under auth.type=DISABLED" is superseded. Since the Recently Viewed
   foundation shipped, an auth-disabled deployment keeps one shared instance-wide history and
   the home panel shows it, labelled "(shared)". A filter that returned nothing there would
   contradict the panel it is linked from. So the filter works on that shared history and
   labels itself the same way, with an information icon spelling out the consequence.

2. A filter says which assets, not in which order. The panel is ordered most-recent-first, so
   its "View all" is only honest if the search can be ordered the same way. This PR adds a
   "Recently viewed" ordering, offered while the filter is active and used as its default.
   Choosing any other ordering still works.

3. Relative windows ("last 7 days" re-evaluated every time the link is opened) are NOT in this
   PR. The presets resolve to fixed dates at the moment you click them and the chip shows the
   resolved dates, so a shared or saved search always reproduces the same result. A relative
   form can be added later as an extra parameter without breaking anything.

Everything else follows the notes above: ISO datetime parameters that fail closed on junk, the
facet-to-URL mirror, the saved-search round-trip, and all 7 locales.
```

**(ii) Comment on #1832:**

```text
This is delivered by the Last viewed filter on #1844: the Recently Viewed panel gains a
"View all" link that opens the catalog search scoped to your own history and ordered
most-recent-first, which is what this issue asks for. The PR carries "Closes #1832".
```

**(iii) No third artefact — a planned public issue was WITHDRAWN, and why is recorded rather than quietly dropped.**
Round 1 asked for the picker's "icon-only trigger, no typed-date input" to be filed as an upstream accessibility issue —
the `odd-sme` note raised it, graded it LOW, and explicitly said *"verify"*. **Verified 2026-09-06, and the claim is
false.** `AppDateRangePickerStyles.ts:2` wraps `react-multi-date-picker/components/input_icon`, whose source renders a
real `<input type="text" className="rmdp-input" value=… autoComplete="off" {...rest}/>` with the calendar icon beside
it — a native, tabbable text input, which is exactly why ODD's own wrapper styles `&:focus, &:active` (`:20-22`). So
"there is no text input", "the trigger is not reachable from the keyboard" and "a keyboard-only user cannot set a range
at all" would all have been **false statements published to a public tracker under the team's name**.

Nothing is filed here. Whether typing actually round-trips in `range` mode under `format='D MMM'`, and how the control
reads to a screen reader, are questions only DRIVING it answers — so Phase D's keyboard + pixel review (Step 9) drives
the picker on the search rail, and files an issue **then, describing what it observed**, if a real defect appears. An
unverified accessibility claim is not a follow-up; it is a guess with a public URL.

## 9. Phase-D runbook — written to be followed literally by the executing session

Everything below is resolved: no value to invent, no path to guess. Deviate only if a command FAILS, and then record why.

### 9.0 Preconditions (once, at the start of the executing session)
```bash
cd /path/to/odd-team                     # the workspace root (this repo)
git -C ../odd-platform fetch origin && git -C ../odd-platform rev-parse origin/main
```
- If `origin/main` has moved past `0238005c`, re-read the anchors in §3/§7 that the move touched
  (`git -C ../odd-platform diff 0238005c origin/main --stat -- odd-platform-api odd-platform-ui odd-platform-specification`)
  and correct the plan's line numbers **before** coding. A moved head is CHECKED, never assumed.
- The worktree `../odd-platform-ctrib067` already exists, detached at `0238005c`. Cut the branch **inside it**:
  ```bash
  git -C ../odd-platform-ctrib067 switch -c contrib/CTRIB-067-recently-viewed-facet
  git -C ../odd-platform-ctrib067 rev-parse --abbrev-ref '@{u}' 2>/dev/null || echo "no upstream — correct"
  ```
  **NEVER** `git checkout -b <branch> origin/main` (it sets `branch.merge=refs/heads/main` → a bare push publishes to public
  `main`; LSN-038). `push.default=current` is already set on the clone (verified). Before EVERY push:
  `test "$(git -C ../odd-platform-ctrib067 rev-parse --abbrev-ref '@{u}' 2>/dev/null)" != origin/main`.
- Update this record's frontmatter (`status`, `branch`, `head_sha`) and the `ctrib067` entry in `state/active-streams.yaml`
  (`phase`, `updated`) as the phases progress.
- **Never build in the shared `../odd-platform`** (the guard denies it): all gradle/npm runs point at
  `../odd-platform-ctrib067`.
- **Pass env INLINE, never `export`** (`.claude/settings.json` denies `export`/`env`).

### 9.1 Commit discipline
One commit per Step (0-12), on the branch, message `feat(search): <what> (ST-10 of #1825)` / `test(...)` / `docs(...)`.
In **odd-team** use explicit-path commits ONLY — `git commit -F <msg-file> -- <paths>`, never `git add -A`, never a bare
`git commit -m` (the index is shared with any co-active session; check `git diff --cached --name-only` first).
Every commit message ends with the two attribution lines the session prints.

### 9.2 The two code fragments most likely to be got wrong

**(a) The jOOQ join + the sort key** (`ReactiveAssetSearchRepositoryImpl`). The scope is a JOIN, not an `EXISTS`, because
the same join supplies the `LAST_VIEWED` ORDER BY column (§4a M7 measured both shapes identical for the predicate). It is
safe as an INNER JOIN because `recently_viewed_identity_asset_key` is UNIQUE on `(oidc_username, provider, asset_kind,
asset_id)` — at most one row per asset, so no fan-out and `count(*)` stays exact.
```java
private Table<?> searchFrom(final RecentlyViewedScopeDto rv) {
    final Table<?> base = ASSET_SEARCH_ENTRYPOINT
        .leftJoin(DATA_ENTITY).on(...)      // unchanged
        .leftJoin(TERM).on(...)             // unchanged
        .leftJoin(QUERY_EXAMPLE).on(...);   // unchanged
    if (rv == null) {
        return base;
    }
    return base.join(RECENTLY_VIEWED)
        .on(RECENTLY_VIEWED.OIDC_USERNAME.eq(rv.oidcUsername()))
        .and(RECENTLY_VIEWED.PROVIDER.eq(rv.provider()))
        .and(RECENTLY_VIEWED.ASSET_KIND.eq(ASSET_SEARCH_ENTRYPOINT.ASSET_KIND))
        .and(RECENTLY_VIEWED.ASSET_ID.eq(ASSET_SEARCH_ENTRYPOINT.ASSET_ID));
}
```
Thread `rv` into **every** `searchFrom()` call site: `keysetPage` (both the no-cursor query AND the `branch(...)` helper —
`branch` builds each UNION arm and must use the same FROM, or page 2 loses the join), `relevancePage`, `count`,
`popularityHistogram`. The keyset select list already carries `keysetSortValueField(sort).as("sv")`, so adding
`case LAST_VIEWED -> RECENTLY_VIEWED.LAST_VIEWED_AT` there is what gets the column into each arm and hence into the outer
`u.field("sv")` ordering — do not skip it.
**The ORDER BY spelling is load-bearing:** `order.add(RECENTLY_VIEWED.LAST_VIEWED_AT.desc())` — a **bare `desc()`**. The
index is `(oidc_username, provider, last_viewed_at DESC)`, i.e. `DESC NULLS FIRST`; adding `.nullsLast()` (the POPULARITY
idiom) turns the measured 2.5 ms index-presorted read into a 5.3 ms full top-N heapsort (§4a). The column is NOT NULL, so
the two spellings mean the same thing and only the planner can tell — which is why an EXPLAIN oracle pins it (Step 8).

**(b) The FE `Date` boundary** (`searchUrlState.ts`). The generated model uses `Date` for `date-time`
(`RecentlyViewedScopeToJSON` emits `value.viewedAfter?.toISOString()`), while `SearchUrlState` holds canonical ISO `Z`
**strings** (so the URL, the mirror and the equality guard all compare text). So: **state → request** wraps
(`new Date(iso)`), **stored spec → state** must accept a `Date` (a real API response), a `string` (a hand-built spec) and
junk, funnelling all three through the SAME `parseInstant`. Never call `.toISOString()` on a value that might be a string.

**(c) The timezone helper — pin the library's v2 names.** `date-fns-tz` is **2.0.0** here and exports
`zonedTimeToUtc` / `utcToZonedTime` / `formatInTimeZone` (**verified**: `node_modules/date-fns-tz/`) — *not* the v3
names `fromZonedTime` / `toZonedTime`. `useAppDateTime.ts:1` already imports `formatInTimeZone`, and reads the browser
zone as `Intl.DateTimeFormat().resolvedOptions().timeZone` (`:53`) — reuse that idiom. In production
`startOfDay(now).toISOString()` alone is already the right instant (the browser's own zone); the explicit `timeZone`
parameter exists so `recencyPresets.test.ts` can compute a window for a FIXED zone and stay deterministic on any CI
machine. One code path, one test seam:
```ts
export function presetWindow(kind: 'today' | '7d' | '30d', now: Date, timeZone: string): { viewedAfter: string } {
  const daysBack = kind === 'today' ? 0 : kind === '7d' ? 6 : 29;   // "last 7 days" INCLUDES today
  const localMidnight = startOfDay(subDays(utcToZonedTime(now, timeZone), daysBack));
  return { viewedAfter: zonedTimeToUtc(localMidnight, timeZone).toISOString() };
}
```

**(d) The calendar's locale — build it, do not import it.** Verified 2026-09-06: `react-multi-date-picker@4.x` accepts a
`locale` prop; the object is plain data — `{name, months: [[full, short] × 12], weekDays: [[full, short] × 7], digits:
[…10], meridiems: [[AM, am], [PM, pm]]}` (read from the shipped `gregorian_en.js`). The library only ships `en / ar / fa /
hi` (+ `pt_br`) — **six of ODD's seven locales have no shipped object** — and `react-date-object` is a TRANSITIVE dep
(present only under `node_modules/.pnpm/react-date-object@2.1.8/`), so importing its locale files from app code would add a
dependency. Build the object instead, from `Intl`, for whatever `i18n.language` is active:
**The catalog key is NOT a BCP-47 tag — map it, or ship the wrong language.** `i18n.language` is one of the resource
keys `en es ch fr ua hy br` (`locales/i18n.ts:11-19`), and three of them are not the tags `Intl` expects. Measured with
`node` on 2026-09-06:

| catalog | the language it actually holds (verified from its own strings) | used RAW as an `Intl` tag | correct tag |
|---|---|---|---|
| `br` | Brazilian Portuguese (`"Proprietário"`, `"Descrição"`; `i18n.ts:33` says so) | **Breton** — `Genver` for January | `pt-BR` |
| `ch` | Chinese (`"搜索"`) | silently `en-US` | `zh-CN` |
| `ua` | Ukrainian (`"Пошук"`) | silently `en-US` | `uk` |
| `hy` / `es` / `fr` / `en` | Armenian / Spanish / French / English | correct | unchanged |

So a naive `calendarLocale(i18n.language)` would hand a **Breton** calendar to Brazilian users and an English one to
Chinese and Ukrainian users — silently, with nothing red. The map is part of the helper:

```ts
// calendarLocale.ts — no new dependency, all 7 languages, and it fixes Activity + Alerts too
const BCP47: Record<string, string> = {
  en: 'en', es: 'es', fr: 'fr', hy: 'hy',
  br: 'pt-BR',   // Brazilian Portuguese — the bare 'br' tag is BRETON
  ch: 'zh-CN',   // Chinese — 'ch' is not a language tag at all
  ua: 'uk',      // Ukrainian — 'ua' is a COUNTRY code, not a language tag
};

export function calendarLocale(catalogKey: string) {
  const lang = BCP47[catalogKey] ?? 'en';
  // `timeZone: 'UTC'` is LOAD-BEARING, not tidiness: a UTC instant formatted in the browser's own zone can fall
  // on the previous day, so a naive version returns "December" for January west of Greenwich. Pin the zone, and
  // pick mid-month / midday reference dates so no offset can shift them.
  const opts = { timeZone: 'UTC' } as const;
  const long = new Intl.DateTimeFormat(lang, { month: 'long', ...opts });
  const short = new Intl.DateTimeFormat(lang, { month: 'short', ...opts });
  const dayLong = new Intl.DateTimeFormat(lang, { weekday: 'long', ...opts });
  const dayShort = new Intl.DateTimeFormat(lang, { weekday: 'short', ...opts });
  const m = (i: number) => new Date(Date.UTC(2021, i, 15, 12));
  // WEEKDAYS START AT SATURDAY in this library's convention (its shipped gregorian_en lists Saturday first);
  // 2021-01-02 was a Saturday. Getting this wrong shifts every column header by one day — nothing but the
  // dedicated test catches it, because the calendar still renders and still looks plausible.
  const d = (i: number) => new Date(Date.UTC(2021, 0, 2 + i, 12));
  return {
    name: `gregorian_${lang}`,   // the library only reads this for display; any stable string is fine
    months: Array.from({ length: 12 }, (_, i) => [long.format(m(i)), short.format(m(i))]),
    weekDays: Array.from({ length: 7 }, (_, i) => [dayLong.format(d(i)), dayShort.format(d(i))]),
    digits: ['0','1','2','3','4','5','6','7','8','9'],
    meridiems: [['AM','am'], ['PM','pm']],
  };
}
```
Type it against the picker's `Locale` via a local structural type (the prop's declared type comes from the transitive
package; a `satisfies`-style local interface keeps `tsc` green without a new import).

**This fragment was RUN, not sketched** (2026-09-06, node, planning session): `en` reproduces the library's shipped
`gregorian_en` `months` (long AND short) and its Saturday-first `weekDays` **exactly**; `br → janeiro`, `ch → 一月`,
`ua → січень`, `hy → հունվար`; an unknown key falls back to English; and the whole output is byte-identical under
`TZ=UTC`, `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati`. Port it verbatim and port its assertions into
`calendarLocale.test.ts`.

**(e) The picker's `defaultRange` — resolved, and what the calendar shows in the "any time" state.**
`AppDateRangePickerProps.defaultRange` is **required** (`AppDateRangePicker.tsx:8`), drives `value={[rangeStart, rangeEnd]}`
(`:103`), and is re-applied by `useEffect(..., [defaultRange])` (`:26-28`) — so an object built inline in render re-seeds
the calendar on every render. Memoise it on the two ISO strings:
```tsx
import { endOfDay, startOfDay, subDays } from 'date-fns';   // a direct dependency; AppDateRangePicker imports the same
// `scope` = paramsToSearchState(location.search).recentlyViewed  (undefined when the facet is off)
const { viewedAfter, viewedBefore } = scope ?? {};
const defaultRange = React.useMemo(() => {
  // Bounds set -> show exactly them. No bounds ("any time", or the facet off) -> show a sensible VISIBLE window
  // without applying it as a filter: the shipped Activity/Alerts precedent (CalendarFilter.tsx:33-41 falls back to
  // the last week "WITHOUT writing it to the query"). The calendar is a picker, not a statement of the filter -
  // the CHIP is what states the filter, and in the "any time" state it reads "Last viewed: any time".
  const end = viewedBefore ? new Date(viewedBefore) : endOfDay(new Date());
  const begin = viewedAfter ? new Date(viewedAfter) : startOfDay(subDays(end, 6));
  // ORDER THE PAIR - do not skip this, and do not clamp only one side. The picker takes whatever it is given as
  // `value` (:103) and Done commits it unconditionally (:70-75), so an inverted seed produces an inverted commit,
  // which the URL rule then drops entirely: the filter silently vanishes. TWO shapes invert if unguarded -
  // `viewed_before` alone older than six days (begin from "now" lands after end), and a hand-written future
  // `viewed_after` with no `viewed_before` (begin after today's end). Ordering covers both, and is a no-op for
  // the two well-formed shapes (the URL parser has already dropped an inverted pair before it reaches here).
  return begin <= end ? { beginDate: begin, endDate: end } : { beginDate: end, endDate: begin };
}, [viewedAfter, viewedBefore]);   // the ISO STRINGS are the deps - stable identity across renders
```
The product decision this encodes, stated so it is reviewed rather than discovered: **with the scope on and no bounds the
calendar pre-highlights the last seven days while the filter is "any time"** — picking a range is what narrows it, and the
chip always tells the truth. Same in the off state.

### 9.3 The gate commands, verbatim
```bash
# unit — the FULL CI replica (test + checkstyle + assemble)
ODD_PLATFORM_DIR=../odd-platform-ctrib067 scripts/run-platform-tests.sh
# targeted inner loop
ODD_PLATFORM_DIR=../odd-platform-ctrib067 scripts/run-platform-tests.sh --tests "*AssetSearch*"

# front end (in ../odd-platform-ctrib067/odd-platform-ui) — codegen FIRST or the new types do not exist
pnpm generate && pnpm tsc && pnpm lint && pnpm exec vitest run
# NEVER bare `pnpm test` - package.json maps it to `vitest`, i.e. WATCH mode, which never returns on a TTY.
# inner loop:
pnpm exec vitest run src/lib/search src/components/Search src/components/shared/elements/AppDateRangePicker

# the impacted IT on YOUR worktree's SUT (the LSN-033 trap: a bare run-suite.sh builds from the SHARED checkout)
ODD_STREAM=ctrib067 ODD_PLATFORM_DIR=../odd-platform-ctrib067 integration-tests/run-suite.sh IT-157
# the RED half — the same spec against unfixed main
ODD_STREAM=ctrib067red ODD_PLATFORM_DIR=../odd-platform-ctrib067 ODD_SUT=ref:main \
  ODD_API_PORT=18441 ODD_DB_PORT=15641 integration-tests/run-suite.sh IT-157

# the FULL four-suite regression at the COMMITTED head (takes the machine-wide flock; ~50 min)
integration-tests/run-regression.sh ctrib067
```
- Ports reserved for this stream: **18440/15640** (Phase D) and **18441/15641** (the RED stack). `run-regression.sh`
  auto-discovers its own pair.
- **Read pass/fail COUNTS from the run-log, never the exit code** (`run-suite.sh` reports `EXIT=0` with failures).
- Two tells that the SUT is a fossil rather than your code: failures are UNIFORM across unrelated tests, and the log's
  `-> SUT: building from ...` line names a SHA that is not your branch.
- The plan-time baseline stack `ctrib067probe` (18430/15630) is torn down at the end of the planning session; if it is
  still up, `docker compose -p ctrib067probe -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml down -v`.

### 9.4 Definition of Done — all five, RUN, before the PR leaves `draft`
1. the full unit build green on the branch · 2. the FULL integration regression on the branch-built image
(`feature-complete` green vs the tracked baseline · `multi-stack` green · `known-bugs` still-RED · `ingestion-e2e` green)
· 3. docs read + routed + **authored and committed on `documentation@release/1.0.0`** (a backlog draft alone is NOT
"authored") + `DOC-529` · 4. the ontology re-enriched, re-embedded and **committed** · 5. the Principal sufficiency review
(enough + meaningful tests, the local changed-lines coverage gate ≥ 98 % measured from your own JaCoCo XML, no control
lost, no existing functionality harmed, and — a UI change — the **screenshots read as a user**).
**No gate may be recorded "NOT RUN" / "deferred to review".** If the machine is busy, PAUSE and ask for a window.

### 9.5 Traps this exact slice will spring
1. **The mirror.** Forgetting `recentlyViewed: live.recentlyViewed` in `Search.tsx` is invisible in review and at runtime:
   the scope survives a page load, then vanishes the moment any unrelated facet is toggled. IT-157 case 5 is its guard.
2. **The count.** If the join is added to the page query but not to `count`, the header shows a phantom total.
3. **The histogram.** ST-9's popularity bars must be scoped too, or they describe a list the user will not get.
4. **The cursor.** Page 2 of a `last_viewed` list decodes a cursor scoped to that sort; forgetting `parsesForSort` makes a
   tampered token 500, and forgetting the `:128` NOT-NULL guard makes it seek `UPDATED_AT IS NULL` silently.
5. **Clear All.** Clearing the scope while leaving `sort=last_viewed` in the URL leaves a search claiming an ordering the
   server will not apply (it resolves the token away without the scope) — the menu would show a sort the list does not have.
6. **The saved search.** Persisted automatically, but WITHOUT the projection + sanitiser it reapplies as an unnarrowed
   search that reports success — the exact LSN-042 defect the maintainer found by hand on the sibling slice.
7. **i18n.** All 7 catalogs in the SAME commit as the strings. `en`-only + a backlog item is the anti-pattern.
8. **The `(shared)` label.** Under DISABLED the heading, the qualifier AND the info icon all change — three strings, not one.
9. **Bare dates.** `?viewed_after=2026-09-01` must be REJECTED (dropped), never guessed into a zone.
10. **The shared recency slice.** The filter's `size:1` fetch and the home panel's `size:5` fetch write the SAME slice
    (`page <= 1` REPLACES the list). Only `total` is read on the search page and the panel re-fetches on mount, so this
    is correct — but assert the panel still lists its five rows after a visit to `/search` (IT-157 case 9 exercises it).
11. **The PR body.** Verify the LIVE body after creation: the only closing keywords must be `Closes #1844` and
    `Closes #1832` — a backticked `Closes #1825` anywhere would auto-close the epic on merge (CTRIB-039 case-law).

### 9.6 What the executing session must NOT do
Merge anything (GATE 2 is the maintainer's); self-mark `done` or `merged` (`review-ready` is the terminal state for the
implementer); widen the diff past §4's In-scope list (a discovery routes through `playbooks/follow-up-on-disk.md` and is
FILED as a real issue via the App token — the never-auto-file rule was retired 2026-09-06); push to `main`; commit
`odd-platform-ui/src/generated-sources/` (untracked build artifact); build in the shared `../odd-platform`; run the heavy
regression concurrently with another (the flock serialises it — wait, do not bypass).

## 10. Comments posted (G-C6 / G-C5)
Step 0's two scope comments — URLs recorded here when posted (nothing posted during the planning session; GATE 1 first).

## 11. Test ledger
Filled by the executing session: the full unit build (counts + checkstyle), the FE vitest run, IT-157 GREEN on the
branch SUT + RED on `ref:main` (with the run-log line + the SUT digest for each), the four-suite regression counts, the
changed-lines coverage figure, the SRE re-measure, and the pixel-review screenshots.

## 12. Outcome
Pending. Phases A–C complete 2026-09-06; GATE 1 is the next gate.
