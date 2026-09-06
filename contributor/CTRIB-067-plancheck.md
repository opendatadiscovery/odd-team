---
id: CTRIB-067-plancheck
subject: contributor/CTRIB-067.md §7 (the GATE-1 plan + must_haves) + §9 (the Phase-D runbook), against §4 Spec, §6 Design, adrs/drafts/unified-asset-search.md, adrs/drafts/favorites-recently-viewed-foundation.md
checker: plan-checker (fresh context, adversarial, goal-backward — playbooks/plan-contract.md §3, G-C19)
round: 1
date: 2026-09-06
base_verified: odd-platform 0238005c (worktree ../odd-platform-ctrib067, detached, read-only — no build, no run); documentation origin/release/1.0.0 @ 1a70aba
verdict: ISSUES FOUND — 4 blockers, 11 warnings
---

# CTRIB-067 plan-check — round 1

## ISSUES FOUND

**Slice:** CTRIB-067 / #1844 ST-10 — a per-identity, cross-kind **Last viewed** datetime-range scope over the #1816
`recently_viewed` history on the unified search (UTC instants on the wire, ISO in the URL), the `last_viewed` ordering
coupled to it, and the Recently Viewed panel's **View all** (#1832).

**Requirements covered:** 16/16 map to ≥1 step; **15/16 map to a `must_haves` truth** (R14 performance has none — W1).
**Tasks:** 13 steps (0–12) · **Files:** ~46 (2 contract · 9 BE main · 7 BE tests · 17 FE main incl. 7 locale catalogs ·
7 FE tests · 4 odd-team · 6 docs + 1 backlog item) — see W9.
**must_haves:** 15 truths, all user-observable; **11 key_links, every one implemented by a named step** — the wiring
dimension (D3) is the strongest part of this plan.
**Issues:** 4 blockers, 11 warnings.

**Citation audit — every file / line / symbol the plan cites was checked statically at `0238005c`; no system was run.**
All load-bearing citations hold, including the ones that decide the design:
`ReactiveAssetSearchRepositoryImpl` `searchFrom()` :294-306 with its five call sites (`keysetPage` :71, `relevancePage`
:101, `count` :115, `popularityHistogram` :138, `branch` :169), `seekBranchPredicates` :179, `keysetSortValueField` :235,
`outerOrderFields` :245, `toPageRow` :259, `effectiveSort` :280, `orderFields` :533, the favorites EXISTS :455-463;
`SearchSortDto` :15-27 + `resolveEffective` :45; `AssetSearchCursor` NOT-NULL guard :128 + `parsesForSort` :149;
`AssetSearchServiceImpl` :74 (`resolveEffective`), `scoped()` :133-140, `popularityHistogram` :93, `count` :211/:223;
`ReactiveDataEntityRepositoryImpl` :1019-1020; `SavedSearchServiceImpl.sanitiseSpecTree` :152-176 + `sanitisePopularity`
:184-211; `CurrentUserIdentityResolver` sentinel; `DateTimeUtil.mapUTCDateTime` :15-20; `V0_0_95` (the UNIQUE
`recently_viewed_identity_asset_key` **and** `recently_viewed_identity_ts_idx (…, last_viewed_at DESC)` — the two facts
the no-fan-out and bare-`desc()` arguments rest on); `application.yml:176-177`; `components.yaml` `AssetSearchFormData`
:466, `PopularityRange` :495, `SavedSearch` :2649-2705; `searchUrlState.ts` (:83 favorites, :96-102 fail-closed, :162
`SEARCH_SORT_OPTIONS`, :181 `defaultSortForContext`, :196 `resolveActiveSort`, :323/:337 popularity parse, :491/:567 the
two projections); `Search.tsx:119` `popularity: live.popularity,`; `Filters.tsx:40` `handleClearAll` + `<FavoritesFilter/>`
:78; `Results.tsx` :86 the single `assetSearchFormData` memo feeding :105/:113, :96 `isFavoritesScope`, :207 the teaching
empty; `SearchSortMenu.tsx:34`; `RecentlyViewedColumn.tsx` :24-25/:32/:38/:44/:97; `FavoritesColumn.tsx` :44/:102-112;
`AppDateRangePicker.tsx` :30-47/:52/:90-104 + `AppDateRangePickerFooter` (`ranges={[]}` does hide the row and keep Done);
`useAppDateTime.ts:1`/:53; `locales/i18n.ts:11-19`/:33; `en.json` :536/:650/:651/:652/:657/:658 and **707 keys × 7
catalogs**; `searchFormDataToUrlState.test.ts` :126/:153; `SearchSortMenu.test.tsx:85`; `AssetSearchServiceMyDataTest`
:167-171; `AssetSearchScopePredicateTest` :151/:235/:244 (the only three direct repository call sites in the test tree —
the consumer list is complete); `AssetSearchKeysetPaginationTest:152`; `run-suite.sh` (`ODD_STREAM`/`ODD_PLATFORM_DIR`),
`run-regression.sh <stream-id>` (default worktree `../odd-platform-<id>`), `run-platform-tests.sh` (`ODD_PLATFORM_DIR`
:43), gradle 8.5 (`--rerun` supported), `openApiGenerate` in `odd-platform-api-contract`, `suites.yaml` `pending-merge`
:102, IT-156 = the max protocol id (so IT-157 is free), `DOC-529` free (max DOC-528), `TST-067` exists, F-017
`use_case_coverage 17 → 18 / verified 5 → 6` matches the file; the six documentation pages exist on
`origin/release/1.0.0 @ 1a70aba` with `## Favorites` :117, `## Popularity` :152, `catalog-overview.md:47`,
`Features.md:60`, `data-discovery.md:13,23`.

**Two claims checked adversarially and found SOUND** (recorded so no later round re-litigates them):
1. **The INNER JOIN reaches every consumer, including the keyset `branch()` path, and the ORDER BY can see its column.**
   `branch()` selects the same `columns` list — which carries `keysetSortValueField(sort).as("sv")` — `from(searchFrom())`,
   so adding `case LAST_VIEWED -> RECENTLY_VIEWED.LAST_VIEWED_AT` plus `searchFrom(rv)` in `branch` puts the column in
   every UNION arm's select list, and the outer `orderBy(outerOrderFields(sort, u))` reads `u.field("sv")`. §9.2(a) states
   both halves explicitly. The count stays exact: `recently_viewed_identity_asset_key` is UNIQUE on
   `(oidc_username, provider, asset_kind, asset_id)` — at most one joined row per asset, no fan-out.
2. **The sort-without-scope path agrees across all three resolvers.** Service `:74`
   (`resolveEffective(state.getSort(), hasQuery, formData.getRecentlyViewed() != null)`) → the same boolean the repository
   derives from `rv != null` (`RecentlyViewedScopeDto.of` returns empty only for a null wire) → `AssetSearchCursor.decode`
   is called with the service's resolved sort, so a `LAST_VIEWED` cursor sent without the scope is foreign and fails closed
   to page 1. The FE mirrors it via `defaultSortForContext` / `resolveActiveSort` (whose only production consumer is
   `SearchSortMenu.tsx:34` — verified), and both new params default to `false`, so the existing `searchUrlState.test.ts`
   cases stay green without being changed.

---

### Blockers (must fix before GATE 1)

1. **[D3 / D7] `parseInstant` as specified REJECTS a `Date`, so the saved-search reapply silently drops the scope —
   the exact LSN-042 class this slice exists to close.**
   - **Plan location:** §7 Step 3 — *"`parseInstant(raw): string | null | undefined` — `undefined` for absent/empty;
     **`null` for a non-string**, an unparseable value … else `new Date(raw).toISOString()`"*, versus the same step's
     *"`assetSearchFormDataToUrlState` → each bound may be a **`Date` (a real response)**, a string … through the SAME
     `parseInstant`"*, and §9.2(b) *"**stored spec → state must accept a `Date`** … funnelling all three through the SAME
     `parseInstant`"*.
   - **What it violates:** R9 ("`assetSearchFormDataToUrlState` projects `recently_viewed` (a `Date`, an ISO string or
     junk) … through the SAME fail-closed reading"); the `key_links` row *"the stored spec → the reapplied scope →
     `assetSearchFormDataToUrlState` + `sanitiseRecentlyViewed` (a `Date` OR a string) | LSN-042 again — a saved search
     that silently lost its scope"*; G-C13's sibling-surface clause. The generated model really does hand back a `Date`
     (`formatDistanceToNowStrict(refState.lastViewedAt)` at `RecentlyViewedTag.tsx:55` confirms the existing `date-time`
     field is a `Date` object) — so a literal executor implementing Step 3's stated contract makes **every** saved search
     with a recency scope reapply unnarrowed, and reports success.
   - **Fix:** state the accepted input types in Step 3 — `parseInstant(raw: unknown)` accepts a `string` **or** a `Date`
     (`raw instanceof Date` → `Number.isNaN(raw.getTime()) ? null : raw.toISOString()`), everything else non-string →
     `null`. And pin it in the test list: the R9 vitest round-trip fixture must build the spec with a real `Date` (what
     `FromJSON` produces), never an ISO string — a string fixture passes on the broken implementation.

2. **[D6 / D7] `SearchSortDtoTest` is planned as a NEW file but already exists — the executor either collides or
   silently deletes three shipped tests, and the change escapes the G-C15 CHANGED table.**
   - **Plan location:** §7 Step 8 — *"**`SearchSortDtoTest`** (new, plain JUnit): the `resolveEffective` truth table"*.
   - **Spec/ADR line:** the file exists at `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/dto/SearchSortDtoTest.java`
     with three tests, and it calls the **2-arg** `resolveEffective` at :29-30. G-C15 requires every CHANGED test to carry
     an SoT for its new expected values plus a surviving RED; §6(d)'s consumer row does not list it either.
   - **Fix:** relabel as **EXTENDED**, and add a row to the CHANGED-tests table: SoT = the new 3-arg contract in §7 Step 2.2
     (the kept 2-arg overload keeps the three existing cases byte-identical, so the assertion is not weakened);
     surviving RED = the new scope × query × token rows, which cannot compile/resolve on `ref:main`. Also re-check every
     other "(new)" test file in Step 8 against the tree before the packet (the other four — `AssetSearchRecentlyViewedIntegrationTest`,
     `RecentlyViewedFilter.test.tsx`, `recencyPresets.test.ts`, `calendarLocale.test.ts` — are genuinely absent; verified).

3. **[D3 / D7] The `RangeFacetShell` extraction is specified in a way that changes shipped Popularity behaviour, and the
   plan's named oracle cannot see it.**
   - **Plan location:** §7 Step 5 — *"props `name, filterId, qualifier?, help?, presets?, chipText, onClear,
     disabledReason?, children` — rendering the heading + info icon, the qualifier, `children` (the rail body) **when there
     is no `disabledReason`**, the presets row, and the chip with its ×"* + *"`PopularityFilter.test.tsx` passes untouched:
     that is the refactor's oracle"*.
   - **What is wrong, at `0238005c`:** in `RangeFacetFilter.tsx` the **presets row is inside the `canSlide` branch**
     (:173-185, i.e. it does NOT render when `disabledReason` is set or `stops.length < 2`), and the **chip renders only
     when `hasSelection`** (:99, :199 — derived from the `selected` prop the new shell does not receive). Read literally,
     the shell renders the presets row and the chip unconditionally, which puts a clickable **"Never viewed"** link under
     *"No views recorded yet"* — a state `PopularityFilter.tsx:86-94` reaches on any deployment with ≤1 occupied band.
     `PopularityFilter.test.tsx` asserts neither preset-absence in the disabled / one-stop states nor chip-absence with no
     selection (its only chip assertions are `toHaveTextContent` / `not.toBeNull()` on renders that DO have a selection),
     so "GREEN unchanged" does not verify what Step 5 claims it verifies. Third gap: the shell's `presets` prop must change
     shape — today `RangeFacetPreset = {label, range: [number, number]}` (:18-21), which cannot express a date preset —
     and Step 5 does not say so while Step 6 passes `presets={[Today, Last 7 days, Last 30 days, Any time]}`.
   - **Fix:** state the shell's exact render conditions and prop types in Step 5 — `children` **and** the presets row both
     gated on `!disabledReason`; the chip gated on a non-empty `chipText` (Popularity already passes `''` when unselected,
     `PopularityFilter.tsx:98-104`); `presets?: ReadonlyArray<{label: string; onSelect: () => void}>` with
     `RangeFacetFilter` mapping its numeric presets into it (so its own public props stay unchanged). Add a **new**
     `RangeFacetShell.test.tsx` (a new file, so no G-C15 exposure) pinning: no children and no presets when
     `disabledReason` is set; no chip when `chipText` is empty; the chip renders with its × when it is not.

4. **[D9 executor-readiness] Step 6 leaves the date picker's REQUIRED `defaultRange` as `defaultRange={…}` — the one
   value in the plan the executor must invent, on the control that delivers T2.**
   - **Plan location:** §7 Step 6 — *"the body = `<AppDateRangePicker label={t('Custom range')} ranges={[]}
     defaultRange={…} setCurrentRange={…} />`"*, against §9's own promise: *"Everything below is resolved: no value to
     invent, no path to guess."* §9.2 resolves four fragments (jOOQ join, the `Date` boundary, the timezone helper, the
     calendar locale) and not this one.
   - **What it violates:** `AppDateRangePickerProps.defaultRange` is **required** (`AppDateRangePicker.tsx:8`) and drives
     `value={[rangeStart, rangeEnd]}` (:103) — whatever is passed is PRE-SELECTED in the two-month calendar, and it is
     re-applied by the `useEffect` at :26-28 whenever the prop identity changes. The facet's "any time" state (R1: the
     object's PRESENCE is the switch, `{}` = any time) has **no bounds**, so there is no value to pass; a fresh `Date`
     object built inline in render would also re-fire that effect every render.
   - **Fix:** name the value for each of the four scope shapes (bounds present → those two dates; scope on with no bound
     and scope off → the stated default window, memoised so its identity is stable), or add it as a fifth §9.2 fragment
     with the literal JSX. State what the calendar shows in the "any time" state — it is a product decision, not a detail.

---

### Warnings (non-blocking — fold before the GATE-1 packet)

1. **[D1] R14 (performance) has no covering `must_haves` truth.** R14 maps to Step 2 (the join) + Step 9 (the SRE
   re-measure), so there is no coverage gap in the plan — but the truths table (T1–T15) has no row for it. Fix: either add
   a user-observable truth ("turning Last viewed on does not make the search slower — the scoped page returns at least as
   fast as the unscoped one") or say explicitly in §7 that R14 is measured-only and carried by Step 9's ledger line.

2. **[D3] `Results.tsx`'s `historyEmpty` has no stated source, and `total === 0` is indistinguishable from "not fetched
   yet".** Step 7 writes `isRecencyScope ? (historyEmpty ? … : …)` without saying where `Results.tsx` reads it from; the
   shared slice's initial state is `pageInfo: { total: 0, page: 0, hasNext: true }` (`recentlyViewed.slice.ts:9`), so a
   literal `getRecentlyViewedListPage().total === 0` renders *"You haven't opened any assets yet."* on every mount of both
   the facet (disabled reason) and the results area, before the fetch resolves. §9.5 trap 10 covers the slice-sharing
   hazard but not the loading state. Fix: name the source for `Results.tsx` and the not-loaded discriminator
   (`pageInfo.page === 0`, or `getRecentlyViewedListFetchingStatuses` — both exist,
   `recentlyViewed.selectors.ts:15-27`); add the "loading, not empty" case to `RecentlyViewedFilter.test.tsx`.

3. **[D7] IT-157 case 11 deletes the shared sentinel's history on the same `odd-minimal` stack IT-149 drives.** Under
   `auth.type=DISABLED` there is exactly ONE bucket (`__shared__ / DISABLED`), so "with the sentinel's history deleted"
   is a global mutation: IT-149 (`Recently Viewed open→see loop`) is in `feature-complete` (`suites.yaml` :17) and
   IT-157 joins it at graduation, and case 9 of IT-157 itself asserts the panel's five rows. Fix: state the isolation —
   scope the delete to the case's own seeded token rows, or make case 11 the last case with an explicit re-seed — and say
   it in the protocol's LANE/preconditions section, not only in the spec.

4. **[D9] §9.3's front-end gate is `pnpm test`, which is bare `vitest` (watch mode on a TTY).** `package.json`
   `"test": "vitest"`; the sibling ST-9 ran `vitest run` (CTRIB-066 §7 :428, §11). Fix: `pnpm exec vitest run` (and, for
   the inner loop, `pnpm exec vitest run src/lib/search src/components/Search`).

5. **[D9 / plan-contract §2] Steps 8, 10, 11 and 12 do not carry the `Files · Verify · Done` shape §7's own preamble
   promises.** Step 8 — the whole test plan — has none of the three (its commands live in §9.3/§9.4); Step 10 has a Verify
   and no Done; Steps 11 and 12 have neither. Fix: add the three lines to each (Step 8's Files = the 5 new + 6 extended BE
   classes, the 4 new + 3 extended FE files, the IT-157 protocol + spec **and `integration-tests/suites.yaml`** — which the
   artifacts table names but no step's Files line does).

6. **[D3] The inverted-window rule diverges between the two surfaces, and the plan claims it cannot.** Step 2.8's
   `sanitiseRecentlyViewed` drops BOTH bounds and KEEPS the scope ("any time"); Step 3's `parseRecentlyViewed` drops the
   WHOLE dimension on `after > before` — so a stored inverted pair reapplies as "any time" per the server's own reading and
   as "no scope" per the FE projection, while Step 3 asserts *"so a URL and a saved search can never disagree"*. Narrow in
   practice (the sanitiser runs at write time, and the UI never sends one), but the sentence is not true as designed. Fix:
   pick one rule for the stored-spec path, say which, and add the case to the `SavedSearchServiceImplTest` +
   `searchFormDataToUrlState` pair so the two surfaces are pinned to the same answer.

7. **[D6 / follow-up-on-disk] The picker's icon-only trigger (no typed-date input) is disclosed but not logged.** §6(d)
   ends *"What remains and is disclosed rather than fixed: the picker's icon-only trigger (no typed-date input …)"*, and
   the SME note grades it LOW with an explicit **"Log it."** (Q9.7). Nothing on disk tracks it, and §9.6 records that the
   never-auto-file rule was retired 2026-09-06 — so a real issue can be filed. Fix: file it (or name the tracking item) and
   cite the id in §6(d). While there, fix the garbled §4 exclusion clause *"the `react-multi-date-picker` calendar's English
   calendar's icon-only trigger"* — it reads as an editing artifact of the (correct) in-slice locale fix.

8. **[D7] `AssetSearchCursorTest` is the natural pure-unit home for the two cursor changes and is not in the test plan.**
   It already carries the tampered-value cases (`odd-platform-api/.../dto/AssetSearchCursorTest.java` :83-92, including the
   `STATUS_PRIORITY` `vn:true` guard case the `LAST_VIEWED` guard mirrors); Step 8 routes the new cursor cases only to the
   Testcontainers `AssetSearchKeysetPaginationTest:152`. Fix: add two cases there — `parsesForSort(LAST_VIEWED, "not-a-timestamp")`
   → empty, and `keyset(LAST_VIEWED, null, true, …)` → empty — cheap, fast, and the coverage-gate home for the changed lines.

9. **[D5] Size: 13 steps / ~46 files is well over `plan-contract.md` §2's 2–3 tasks and 3–5 files.** Recorded, not blocking,
   on the evidence the plan itself gives and this check confirmed: the slice is a leaf of an already-decomposed epic (G-C18
   bars a horizontal split), ST-7 (33) / ST-8 (40+) / ST-9 (~50) shipped on this exact rail with the same step shape, the
   SPIDR seam is analysed explicitly (§7 preamble), commits land per step, and the DoD is the full regression + the local
   coverage gate. It is, however, the reason §9's literal-execution quality is load-bearing — which is where blockers 3 and
   4 sit.

10. **[D1 record accuracy] Two small measured-vs-actual slips.** (a) Step 10 states `search.md`'s frontmatter description
    is *"today 184"* chars — it is **181** (measured with PyYAML on `origin/release/1.0.0`); the conclusion (≤200,
    appending would overflow, re-author it) is unaffected. (b) §6(d)'s tests row says *"`IT-157` with **12** user-driven
    cases"* while Step 8's table lists **13** (the timezone case). Fix both; a plan whose ethos is measured-not-asserted
    should not carry a mis-measured number.

11. **[D9 / G-C5] Step 0's two scope comments are specified as content, not carried as drafted ASCII bodies.** G-C5 says
    the plan carries the drafted scope comment and that GATE-1 approval includes posting it; §8 authorises Step 0 but holds
    no body, and `reference_issue_drafts_ascii_only` applies (the em dashes and `→` used throughout §7 must not reach the
    thread). Fix: put both bodies verbatim in §8, ASCII-only, no workspace ids — the maintainer approves the words, not a
    summary of them.

---

### D1–D10 — the dimensions that PASS (recorded so a later round does not re-run them)

- **D1 coverage.** R1→Steps 1/2/3; R2→Step 2.5; R3→Steps 2.5/2.8/3; R4→Steps 3/4; R5→Steps 2.1/6 + §9.2(c);
  R6→Steps 1/2.2/2.3/2.5/3/7; R7→Steps 5/6; R8→Step 6; R9→Steps 2.8/3; R10→Steps 6/7; R11→Step 7; R12→Step 8 (asserted,
  no code — correct); R13→Step 2.5/2.6; R14→Steps 2/9; R15→Step 6; R16→Step 10. The Out-of-scope list is respected by
  every step: no relative-window param, no facet-count endpoint, no inverse scope, no `/api/info` change, nothing on the
  legacy `/api/search` beyond the one-token guard that PRESERVES its shipped ordering, no ST-11 work, no write on read.
- **D2 truths.** All 15 are drivable by a human on the running system; implementation facts sit in `artifacts`. T14
  ("every label reads in my language") is now honest because Step 5 fixes the calendar's locale in-slice rather than
  excluding it.
- **D3 wiring.** All 11 `key_links` have an implementing step (checked one by one), and the two links the plan claims are
  "already wired" really are: `Results.tsx:86` builds ONE `assetSearchFormData` memo from `location.search` feeding both
  fetch sites (:105 scroll, :113 page 1), and a changed scope changes `searchStateToParams`' output → `Search.tsx`'s
  `urlStateKey` → page 1 re-fires. Blockers 1 and 3 are wiring/behaviour defects inside otherwise-covered links, not
  missing links.
- **D4 scope reduction.** Phrase scan over §7 + §9: **zero** hits for `v1` / `v2` / `simplified` / `static for now` /
  `hardcoded for now` / `placeholder` / `basic version` / `minimal` / `wired later` / `stub` / `skip for now` /
  `too complex`. The class-extension test is the interesting one and the plan **passes** it: the slice adds a third
  consumer of `AppDateRangePicker`, and rather than calling its untranslated footer presets and English calendar
  "pre-existing", §6(d) owns the class — `t()` on the four footer labels **and** a runtime `Intl`-built `locale` (§9.2(d),
  run and verified in the planning session, including the `br → pt-BR` / `ch → zh-CN` / `ua → uk` tag mapping that stops a
  Breton calendar reaching Brazilian users), which fixes Activity and Alerts too. The saved-search dimension is in scope
  (R9), so LSN-042 is closed, not extended — except through blocker 1, which would silently re-open it.
- **D6 ADR + design.** Conformance holds at the SYSTEM level after this plan lands: spine ADR **D3** (the facet table's own
  row — *"`#1816`'s `recently_viewed` … **joined** per current identity"* — the plan's INNER JOIN is the ADR's word),
  **D8** (the panel becomes a deep-link widget), **D9** (one optional wire object, one additive token, legacy session
  guarded, rows saved without the field read back absent), **D10** (one canonical URL representation per state, fail
  closed), **D11** (the stored spec reapplies the new dimension — the D11 lock extended 10 → 11 wire keys), **D12** (a
  datetime sort key, DESC = freshest first, the unique `(asset_kind, asset_id)` tiebreaker, keyset-paged; the bare
  `desc()` spelling diverges from D12's "default DESC NULLS LAST" **only** for a NOT-NULL column, for a measured planner
  reason, pinned by an EXPLAIN oracle — semantics identical, so this is conformance, not contradiction), and the
  cross-cutting security bar (identity from the context only; the URL carries instants, no username, no ids; a shared link
  re-runs as the recipient; fail closed). Foundation ADR D1/D2/D6 likewise. **Reuse scan verified independently:**
  `AppDateRangePicker` is the platform's ONLY date-range control (`grep -rl` finds exactly two consumers — `CalendarFilter`
  and the component's own footer), so no parallel widget is being built (the LSN-035 trap). **Impact checklist complete:**
  i18n 22 new keys × 7 catalogs in the same commit (the arithmetic reconciles — 23 strings listed, `Recently viewed`
  already present in all seven, verified); both generated clients with `--rerun` (PLT-266); every consumer of the four
  changed repository signatures (`AssetSearchServiceImpl` + exactly two test classes at the three cited lines — confirmed
  by grepping the whole test tree, `popularityHistogram` has no test call site); no migration; docs on the 1.0.0 train +
  DOC-529; ontology F-017-UC-18 + re-embed. `adr_required: false` is correct.
- **D7 both buckets.** Unit (Testcontainers `BaseIntegrationTest` + `@WebFluxTest` web cases + plain JUnit + vitest) AND
  the mandatory integration IT-157 (13 cases, each with a stated RED-on-`0238005c` reason and a FOIL — the right shape,
  since on base the unknown params are dropped and presence alone would be green). The four listed CHANGED tests each name
  an SoT and a surviving RED, and all four citations are exact. Blocker 2 and warning 8 are gaps in this dimension, not a
  failure of it.
- **D8 research.** All seven open questions closed: (1)/(2) routed to GATE-1 decisions D1/D2 in plain language with option
  tables and consequences; (3)/(4)/(6)/(7) RESOLVED with a source or a measurement; (5) RESOLVED on the running stack
  (400 `USR001`, incl. the bare-date form) — and this check independently confirms the mechanism in source:
  `ControllerAdvice.java:64-92` passes framework 4xx through ("invalid/missing request input -> 400 … must pass through,
  not fall to the 500 catch-all"), so the Phase-D web test asserting `isBadRequest` is asserting the right thing.
- **D9 conventions.** No absolute paths in the record; every command inline, no `export`; §9.1 mandates
  `git commit -F <msg-file> -- <paths>` with a `git diff --cached --name-only` check and forbids `git add -A` and bare
  `git commit -m` (which matters — the odd-team tree currently carries five unowned dirty files from the maintainer);
  §9.0 cuts the branch with `git switch -c` inside the dedicated worktree, asserts `@{u} != origin/main` before every push
  (LSN-038) and forbids building in the shared `../odd-platform`; milestone 1.0.0 verified live and docs routed to
  `release/1.0.0` (G-C11); the bot opens DRAFT PRs and never merges; Step 0 posts the scope comments before any code
  (G-C5) and makes no "tracked separately" claim, so no issue URL is owed. Warnings 4, 5 and 11 are the residue.
- **D10 architectural significance.** No migration (`V0_0_95` shipped the table and both indexes), no auth/security-posture
  change (identity from the shipped `CurrentUserIdentityResolver`, nothing exposed that `GET /api/recently-viewed/list`
  does not already expose to the same caller), no breaking contract change (one optional request object, one additive
  token). No G-C7 stop.

### Recommendation

**4 blockers → return to the planner; revise and re-check (loop ≤ 3).** None is "too big to fix in plan" and none implies
a re-spec or a decompose: B1 is one clause in Step 3 plus one test-fixture sentence; B2 is a relabel plus one row in the
CHANGED-tests table; B3 is two sentences of render conditions, one prop-type line, and a new `RangeFacetShell.test.tsx`;
B4 is one resolved value (best as a fifth §9.2 fragment). Fold the eleven warnings in the same pass — 2, 3 and 6 are the
ones that would otherwise reach the maintainer as behaviour; 1, 5, 7, 8, 10 and 11 are packet hygiene; 4 is a command; 9 is
recorded, not actionable.

The plan's citation accuracy, its wiring coverage, its class-extension posture (the calendar locale fixed in-slice with a
run-verified fragment) and its GATE-1 framing are all at or above the ST-9 bar. The four blockers are concentrated in
exactly the place this plan's own risk model names: values and conditions a less capable executor will read literally.
