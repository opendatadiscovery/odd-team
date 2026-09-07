---
id: CTRIB-067-plancheck
subject: contributor/CTRIB-067.md §7 (the GATE-1 plan + must_haves) + §9 (the Phase-D runbook), against §4 Spec, §6 Design, adrs/drafts/unified-asset-search.md, adrs/drafts/favorites-recently-viewed-foundation.md
checker: plan-checker (fresh context, adversarial, goal-backward — playbooks/plan-contract.md §3, G-C19)
round: 1
date: 2026-09-06
base_verified: odd-platform 0238005c (worktree ../odd-platform-ctrib067, detached, read-only — no build, no run); documentation origin/release/1.0.0 @ 1a70aba
verdict: ISSUES FOUND — 4 blockers, 11 warnings   # round 1
round_2: 2026-09-06   # fresh adversarial re-read of the revised §7 / §9 / §8a / §8b, static-only at the same base
round_3: 2026-09-07   # the OWED independent re-check, fresh context, static-only at 0238005c
round_3_verdict: "VERIFICATION PASSED - 0 blockers, 11 warnings. The independent owed check: all three round-2 blockers re-derived from source and CLEARED (the RangeFacetShell extraction simulated state-by-state against RangeFacetFilter.tsx and proved render-identical; the defaultRange fragment walked over all six scope shapes incl. both pathological ones; the withdrawn accessibility claim confirmed false in the library source and struck everywhere, with the two POSTED public comments fetched live and byte-identical to 8b). D1/D4/D7/D9 re-run in full. The plan may proceed to Step 1; the eleven warnings are hardening, none gates code."
round_2_verdict: ISSUES FOUND — 3 blockers, 7 warnings
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

---

# CTRIB-067 plan-check — round 2

## ISSUES FOUND

**Slice:** CTRIB-067 / #1844 ST-10 — the per-identity, cross-kind **Last viewed** datetime-range scope, the
`last_viewed` ordering coupled to it, and the Recently Viewed panel's **View all** (#1832).

**Scope of this round:** the revised §7 Steps 3/5/6/7/8/10/11/12, the `must_haves` R14 note, §8a (the round-1
disposition), §8b (the three drafted public bodies) and §9.2(e) / §9.3 — read as a fresh reader, crediting nothing to
the record's own claim that a fix is in. D1, D4 and D7 re-run in full; D2/D3/D5/D6/D8/D9/D10 re-run only where a fix
could have broken them. Static-only at odd-platform `0238005c` in the read-only worktree; docs via
`git -C ../documentation show origin/release/1.0.0:<path>`. Nothing was built and nothing was run.

**Round-1 blockers: 2 of 4 cleared, 2 half-cleared.**

| R1 blocker | Status | Evidence |
|---|---|---|
| **B1** `parseInstant` rejected a `Date` | **CLEARED** | Step 3 now types it `raw: unknown`, handles `raw instanceof Date` explicitly before the catch-all, keeps the bare-`YYYY-MM-DD` rejection, and Step 8's FE list pins the R9 fixture to real `Date` bounds ("an ISO-string fixture passes on the broken implementation and proves nothing"). The `Date`/`string`/junk trichotomy is now stated identically in Step 3 and §9.2(b). |
| **B2** `SearchSortDtoTest` mislabelled "(new)" | **CLEARED** | The file exists with exactly three tests and the 2-arg `resolveEffective` at `:29-30` (re-read this round); it is relabelled **EXTENDED** with a CHANGED-table row whose SoT (the 3-arg contract, Step 2.2) and surviving RED are both accurate, and the kept 2-arg overload does leave `:29-30` byte-identical. `AssetSearchCursorTest` joined the plan (W8). The other five "(new)" artefacts — `RangeFacetShell.test.tsx`, `RecentlyViewedFilter*`, `recencyPresets*`, `calendarLocale*`, `AssetSearchRecentlyViewedIntegrationTest` — are genuinely absent at `0238005c` (re-checked by `find`). |
| **B3** the `RangeFacetShell` extraction changes shipped Popularity behaviour | **HALF-CLEARED → still a blocker** | the `disabledReason` half is fixed and the chip gate is now provably behaviour-identical; the `stops.length < 2` half is not — see blocker 1 below. |
| **B4** the picker's required `defaultRange` was `{…}` | **HALF-CLEARED → still a blocker** | §9.2(e) resolves three of the four scope shapes; the `viewed_before`-only shape produces an inverted range — see blocker 2 below. |

**Issues:** 3 blockers, 7 warnings.

### Blockers (must fix before GATE 1)

1. **[D3 / D7] B3 is only half-fixed: the shell's stated render conditions still contradict the shipped one-stop
   guard, and neither named oracle can see the half that ships.**
   - **Plan location:** §7 Step 5 — *"**`children` AND the presets row are BOTH gated on `!disabledReason`**"* +
     *"`RangeFacetFilter.tsx` becomes `<RangeFacetShell …>{bars}{slider}</RangeFacetShell>`"* + the new
     `RangeFacetShell.test.tsx` case list (*"no `children` and no presets row when `disabledReason` is set …"*).
   - **What is wrong, at `0238005c`:** the shipped gate is **two** conditions, not one —
     `RangeFacetFilter.tsx:100` `const canSlide = !disabledReason && stops.length >= 2;` drives `:138`
     (`canSlide ? bars+slider+presets : disabledReason && <reason>`), and the component's own Javadoc `:60-63`
     documents the second guarded state ("fewer than two stops renders NO slider **even without a reason**, because
     MUI computes NaN positions for min == max"). That state is reachable on the only shipped consumer:
     `PopularityFilter.tsx:86` sets `disabledReason` **only** when `selectedScores.size === 0`, so one occupied band
     **plus a selection** (e.g. the "Never viewed" preset on a catalog whose only occupied band is 0 views) yields
     `stops.length === 1` with **no** `disabledReason`. `PopularityFilter.test.tsx:161` pins exactly that case
     (*"a one-stop rail with a selection renders the chip but no slider (never a NaN-positioned control)"*,
     `queryAllByRole('slider')).toHaveLength(0)` + `innerHTML` not containing `NaN`).
   - **Consequence for a literal executor:** the shell as specified renders `children` in that state, so
     `PopularityFilter.test.tsx:161` goes RED and the executor must improvise mid-flight — against §9's promise
     ("no value to invent, no path to guess"). Whatever they improvise for `children`, the **presets** half has no
     oracle at all: neither `PopularityFilter.test.tsx` (its :161 case asserts the chip and the slider, never the
     preset) nor the new `RangeFacetShell.test.tsx` (which only covers `disabledReason`) asserts preset-absence in
     the one-stop state — so a clickable *Never viewed* link ships where the shipped rail renders nothing, silently.
   - **Fix:** say it in Step 5 — `RangeFacetFilter` keeps its `canSlide` computation and passes **both**
     `children={canSlide ? <>{bars}{slider}</> : null}` **and** `presets={canSlide ? mapped : undefined}` (the
     shell's own `!disabledReason` gate then stays correct and complete for the shell). Pin the presets half: one
     added assertion in the existing `:161` case (an ADD that asserts more truth → one more CHANGED-tests row), or a
     third `RangeFacetShell.test.tsx` case with `presets` undefined.
   - *(Verified sound and not re-litigated: the chip gate change is behaviour-identical — `parsePopularity`
     (`searchUrlState.ts:337-349`) never returns `{}`, so `chipText !== ''` ⟺ `hasSelection`; the preset prop's
     `{label,onSelect}` reshape preserves the click contract, and the existing preset test clicks by accessible
     name; the `../FixedOptionsMultiFilter/…` chip import resolves unchanged from the new folder (same depth).)*

2. **[D9 executor-readiness / D3] B4's `defaultRange` fragment resolves three of the four scope shapes; the
   `viewed_before`-only shape yields an inverted range that can silently destroy the filter.**
   - **Plan location:** §9.2(e) — `const end = viewedBefore ? new Date(viewedBefore) : endOfDay(new Date());`
     `const begin = viewedAfter ? new Date(viewedAfter) : startOfDay(subDays(new Date(), 6));`
   - **What it violates:** round 1's own fix criterion ("name the value for **each of the four** scope shapes"). The
     `before`-only state is first-class in this plan — R3/R4's grammar allow one bound, the serialiser writes it, and
     R7 gives it a dedicated chip key `Last viewed: before {{to}}` — and for it the fragment computes
     `begin = today−6d` **after** `end = the stored bound` whenever the bound is older than six days.
   - **Consequence:** `AppDateRangePicker` receives `value={[rangeStart, rangeEnd]}` (`:103`) reversed, and
     `handleClickDone` (`:70-75`) calls `setCurrentRange(rangeStart, rangeEnd)` **unconditionally** — so a user who
     opens a shared "before X" link, opens the picker and presses Done writes `viewedAfter > viewedBefore`, which
     Step 3's URL rule (*"`after > before` → `undefined`"*) drops as the WHOLE dimension: the filter vanishes and the
     list unfilters, with nothing red. `RecentlyViewedFilter.test.tsx`'s per-shape cases assert the chip, not the
     picker's seeded value, so no planned test sees it.
   - **Fix:** clamp in the fragment — when only `viewedBefore` is set, `begin = startOfDay(subDays(new Date(viewedBefore), 6))`
     (and, defensively, never return `beginDate > endDate`); add the `before`-only shape to
     `RecentlyViewedFilter.test.tsx` asserting the seeded range, not only the chip.
   - *(Verified sound: `defaultRange` is required (`:8`), drives `value` (`:103`) and is re-applied by
     `useEffect([defaultRange])` (`:26-28`); memoising on the two ISO strings is the right identity fix; the
     "no bounds → last seven days, visible but not applied" decision is byte-for-byte the shipped precedent —
     `CalendarFilter.tsx:33-41` has the same memo and the same "WITHOUT writing it to the query" comment;
     `startOfDay`/`endOfDay`/`subDays` are importable where the fragment sits (`date-fns ^2.30.0` is a direct
     dependency and `AppDateRangePicker.tsx:2` already imports from it).)*

3. **[D6 / D9 — G-C9 factual-claim provenance] §8b(iii)'s public issue body states three facts the source
   contradicts, and GATE-1 approval posts it at Step 0, before any code.**
   - **Plan location:** §8b(iii) — *"there is no text input to type a date into, and the trigger is not reachable or
     operable from the keyboard … a keyboard-only or screen-reader user cannot set a range at all"*; repeated in §4's
     exclusions and §6(d) as *"the picker's icon-only trigger (no typed-date input)"*.
   - **What the source says:** `AppDateRangePickerStyles.ts:2` wraps
     `react-multi-date-picker/components/input_icon`, whose implementation renders
     `<input type="text" className="rmdp-input" value={…} autoComplete="off" {...rest}/>` next to the icon; the
     DatePicker clones the `render` element with `{value, openCalendar, onFocus: openCalendar, handleValueChange,
     onChange: handleValueChange, locale, separator}` (the library's `build/index.js`), and its `editable` prop
     defaults to true. So the trigger **is** a native text input — tabbable by default, opening the calendar on
     focus, which is precisely why ODD's own wrapper carries `&:focus, &:active` border rules (`:20-22`);
     `overrides.css` contains no `.rmdp-input` rule that would hide or disable it. The claim traces to the SME note,
     which this record's own §5.3 discipline says is re-verified before use — this one was not.
   - **Why blocking:** the body is a public artefact filed under the bot's identity on the project's own tracker, the
     maintainer's GATE-1 approval covers *the words*, and a wrong bug report is not cheaply recoverable
     (`CLAUDE.md` — publishing standards; Gate 9 — every claim cites what enforces it).
   - **Fix:** drive the control on the plan-time stack (it is still up per §9.3) and re-scope the issue to what is
     provable — e.g. whether typing parses against `format='D MMM'` + `range`, that the calendar **icon**'s own
     `onClick` handler is mouse-only, or the missing label/`aria` association — then correct §4's exclusion and
     §6(d) to match. ASCII and id-freedom of all three bodies are otherwise verified clean (checked
     programmatically: zero non-ASCII characters, zero workspace-internal ids in all three blocks), and (i) and (ii)
     describe exactly what §7 builds (the scope + the ordering + View all + `Closes #1832`; the superseded DISABLED
     line; relative windows excluded — each matches §5.4 / §5.5 / §4's exclusions).

### Warnings (fold before the GATE-1 packet)

1. **[D9] §9.3 "The gate commands, **verbatim**" still runs `pnpm test` — the watch-mode command §8a claims was
   replaced.** §8a: *"the FE gate is `pnpm exec vitest run`, not watch-mode `pnpm test` (W4)"*; Step 9 was changed,
   §9.3's block was not (`pnpm generate && pnpm tsc && pnpm lint && pnpm test`). §9.3 is the block a literal executor
   copies. Fix: `pnpm exec vitest run` there too.

2. **[D3 / D1] The three-valued history signal reaches the facet but not `Results.tsx`, and the case that would
   catch it has no home.** Step 6 exports `useRecentlyViewedHistoryEmpty()` — a boolean whose `true` means
   *settled and empty* — while Step 7's literal expression is a binary ternary
   (`isRecencyScope ? (historyEmpty ? … : t('Nothing you opened matches this range.')) : …`). During the history
   fetch the flag is `false`, so the results area renders *"Nothing you opened matches this range."* — which R10
   forbids (*"a third vitest case pins that the not-yet-fetched state shows NEITHER sentence"*). The race is real:
   `Results.tsx`'s `EmptyContentPlaceholder` gates on the **search**'s loading flag, not the recency slice's.
   Fix: make the hook three-valued (`'loading' | 'empty' | 'has-history'`) and branch Results on it — and name the
   file: Step 7's Verify cites a *"`Results` empty-state vitest"* that appears in no Files line and has no existing
   home (`components/Search/Results/` carries tests only for `SearchResultsHeader` and `SearchSortMenu`).

3. **[D1 record accuracy] R9 still asserts the identity the plan now deliberately breaks.** R9: the projection reads
   the stored spec *"through the SAME fail-closed reading the URL uses"*, while Step 2.8 / Step 3 now state (and
   pin with a paired test) that the stored-spec inversion rule differs on purpose (both bounds dropped, scope kept)
   from the URL rule (whole dimension dropped). The two steps agree with each other — the spec line is the residue.
   Fix: R9 → "through the SAME `parseInstant`; the stored-spec inversion rule is Step 2.8 / Step 3's".

4. **[D7 / D1] R13's second acceptance clause has no test.** *"web/IT: the search never calls the record path (no
   `POST /api/recently-viewed/*` during a search)"* — Step 8's three new `AssetSearchControllerWebTest` cases are
   bind/inverted/400, and none of IT-157's 13 cases asserts it. Fix: one request-listener assertion in IT-157 case 1
   (the harness already uses `page.waitForResponse` predicates on `RV_DE` in the IT-149 spec).

5. **[D7 precision] The `AssetSearchCursorTest` row names a method a test cannot call.** `parsesForSort` is
   `private static` (`AssetSearchCursor.java:148`); the file's own idiom is
   `decode(keyset(sort, "not-a-timestamp", false, "TERM", 1L).encode(), sort)` (`AssetSearchCursorTest.java:85-92`,
   including the `vn:true` guard case the `LAST_VIEWED` case mirrors). Fix: quote the idiom in the row so the
   executor writes a compiling test first time.

6. **[D9 record accuracy] Round-1 W7's second half was not folded.** §4 still reads *"the `react-multi-date-picker`
   calendar's English calendar's **icon-only trigger**"* — an editing artefact §8a does not claim to have fixed. It
   needs rewriting anyway once blocker 3 corrects the underlying claim.

7. **[plan-contract §2] The §7 preamble's "every step names Files · Action · Verify · Done" is still not true for
   Steps 1 and 3–7** (they name files in their headings and in the artifacts table, but carry no `Files:` line).
   Round 1 asked only about Steps 8/10/11/12 and those are now fixed. Worth one pass: the new
   `useRecentlyViewedHistoryEmpty()` hook has no named file anywhere, and warning 2 turns on where it lives.

### D1 / D4 / D7 re-run in full

- **D1 coverage — 16/16 requirements still map to ≥1 step, 15/16 to a truth (R14 is now an explicit measured-only
  note, W1 folded correctly).** The revision changed no requirement's owner. Two acceptance CLAUSES inside covered
  requirements are unowned: R10's not-yet-fetched case (warning 2) and R13's no-write-on-read case (warning 4).
  Out-of-scope discipline holds: no relative window, no facet-count endpoint, no inverse scope, no `/api/info`
  change, nothing on the legacy `/api/search` beyond the one-token guard, no ST-11 work, no write on read. IT-157's
  renumbering is internally consistent — 13 cases, and every cross-reference resolves to the right one
  (R10→#11, R12/§3→#12, T7→#13, Step 4→#5–6, Step 7→#2/9/10/11, §9.5 trap 10→#9).
- **D4 scope reduction / class extension — PASSES again.** Phrase scan over the revised §7 + §9: zero hits for
  `v1` / `v2` / `simplified` / `static for now` / `hardcoded for now` / `placeholder` / `basic version` / `minimal` /
  `wired later` / `stub` / `skip for now` / `too complex`; every occurrence of "defer" is the plan refusing one. The
  class-extension posture is unchanged and still in-slice (the picker's four footer labels through `t()`, the
  runtime `Intl` calendar locale with the verified `br → pt-BR` / `ch → zh-CN` / `ua → uk` map). The i18n
  arithmetic re-verified this round: 707 keys × 7 catalogs, `Recently viewed` present in all seven, and `Last viewed`
  / `Today` / `Last 7 days` / `Last 30 days` / `Any time` / `Custom range` absent from all seven — the 22-new-key
  count reconciles. One caveat, folded into blocker 3: §6(d)'s "disclosed rather than fixed" line rests on a claim
  the source contradicts, so the class analysis needs one correction — not a deferral.
- **D7 test integrity — both buckets still routed correctly.** The CHANGED-tests table now carries six rows, each
  with an SoT and a surviving RED, and both new rows were verified against the tree (`SearchSortDtoTest` 3 tests /
  2-arg at `:29-30`; `AssetSearchCursorTest:83-92` with the `UPDATED_AT` "not-a-timestamp" and `STATUS_PRIORITY`
  `vn:true` precedents). The mandatory integration IT is present and each of its 13 cases still names a RED-on-base
  reason and a FOIL. The IT-157 isolation rule is real and sufficient: IT-149's spec (`recently-viewed-record-see-loop.spec.ts`)
  asserts its own rows with `.first()` and deletes only what it created, so IT-157 seeding-and-windowing rather than
  emptying the shared `__shared__ / DISABLED` bucket does not collide; case 12's single DELETE + re-record restores
  presence (the re-record lands at `now`, which is safe here because case 13 compares two contexts against each
  other at the same instant, not against a captured older ordering). Residual test gaps are warnings 2, 4, 5 and the
  missing preset oracle inside blocker 1.

### Recommendation

**3 blockers → return to the planner; revise and re-check (loop ≤ 3 — this is round 2 of 3).** None is large: blocker 1
is one clause in Step 5 plus one assertion; blocker 2 is one clamp in §9.2(e) plus one test shape; blocker 3 is a
verification pass on a control the plan can drive today, plus rewriting one public body and two record lines. Fold
the seven warnings in the same pass — 1, 2 and 3 are the ones that otherwise reach the maintainer as behaviour or as
a stalled gate; 4–7 are packet hygiene.

What improved measurably since round 1: B1 and B2 are closed cleanly, the inverted-window rule is now stated once
and mirrored with a paired test, IT-157 no longer mutates a sibling spec's bucket, the doc description is measured
correctly (181, re-measured with PyYAML on `origin/release/1.0.0` this round), the 13-case count reconciles
everywhere, and all three public bodies are ASCII and id-free. What did not: the two half-fixes above were both
recorded in §8a as complete — which is the thing to watch, because the round-1 finding named the one-stop path and
the four scope shapes explicitly, and the disposition table asserts more than the text delivers.

---

# CTRIB-067 plan-check — round 3 (independent, owed)

## VERIFICATION PASSED

**Slice:** CTRIB-067 / #1844 ST-10 — the per-identity, cross-kind **Last viewed** datetime-range scope over the #1816
`recently_viewed` history, the `last_viewed` ordering coupled to it, and the Recently Viewed panel's **View all** (#1832).

**Requirements covered:** 16/16 map to ≥1 step; 15/16 to a truth (R14 is an explicit measured-only note).
**Tasks:** 13 steps (0–12) · **Files:** ~46.
**must_haves:** 15 truths, all user-observable; **12 key_links, every one implemented by a named step.**
**Issues:** 0 blockers, 11 warnings.

**What this round is.** The owed independent re-check (GATE-1 decision D3, 2026-09-07): rounds 1 and 2 were run by the
same checker and the round-3 agent died on a rate limit, so the planner self-ran the dimensions and recorded the
independent check as OWED. This round credits **nothing** to §8a's account of the fixes — every one was re-derived from
the source at `0238005c` in the read-only worktree, and the two public comments were fetched live from the GitHub API.
Nothing was built and nothing was run.

### The three round-2 blockers — re-derived, all CLEARED

| R2 blocker | Verdict | How it was proved this round |
|---|---|---|
| **B1** the `RangeFacetShell` extraction changes shipped Popularity behaviour (the `stops.length < 2` half) | **CLEARED** | The extraction was **simulated state-by-state** against `RangeFacetFilter.tsx` (read at `0238005c`). The gate now stays in `RangeFacetFilter` (`canSlide = !disabledReason && stops.length >= 2`, `:100`), which passes `children={canSlide ? … : null}` and `presets={canSlide ? mapped : undefined}`. Shipped renders the reason iff `!canSlide && disabledReason`, and since `disabledReason` truthy ⇒ `canSlide` false, that is **exactly** the shell's "render the reason when it is set" — no divergence. Chip: `PopularityFilter.tsx:98-104` returns `''` iff `selected` is falsy, and `parsePopularity` (`searchUrlState.ts:326-348`) never returns `{}` (both-bounds-undefined ⇒ `undefined`), so `chipText !== '' ⟺ hasSelection` **exactly**. Walked: (1) normal, (2) disabled-with-reason (`PopularityFilter.tsx:86` sets a reason only when `selectedScores.size === 0`, so no chip either way), (3) one-stop-with-selection (`facet({5:3})` + `popularity_min=5&max=5` ⇒ one stop, no reason ⇒ children null, presets undefined, chip on — `PopularityFilter.test.tsx:161`'s `queryAllByRole('slider') → 0` still passes), (4) no-selection, plus the fifth state (`isError` ⇒ 21 stops, no bars) — **rendered output identical in all of them**. The presets prop reshape to `{label, onSelect}` preserves the click contract (`onCommit({min: preset.range[0], max: preset.range[1]})`), the added `:161` assertion is well-formed (`:122` proves the preset is a `button` named `Never viewed`, and only one render happens in that case so `queryByRole` cannot throw on multiples), and `../FixedOptionsMultiFilter/FixedOptionsMultiFilterStyles` resolves unchanged from `FilterItem/RangeFacetShell/` (same depth — the tree was listed). |
| **B2** `defaultRange` inverts on the `viewed_before`-only shape | **CLEARED, and the self-run's extra fix verified** | `AppDateRangePicker.tsx` re-read: `defaultRange` required `:8`, drives `value={[rangeStart, rangeEnd]}` `:103`, re-applied by `useEffect([defaultRange])` `:26-28`, and `handleClickDone` `:70-75` commits unconditionally — the hazard is real. The §9.2(e) fragment (`end = viewedBefore ?? endOfDay(now)`; `begin = viewedAfter ?? startOfDay(subDays(end, 6))`; then `begin <= end ? {begin,end} : {end,begin}`) was walked over **six** shapes: both bounds (ordered by the URL parser) → exact window; `after`-only → `[after, todayEnd]`; **`before`-only → `[before−6d, before]`** (the round-2 defect: fixed by seeding from `end`, not from `now`); no bounds / facet off → last 7 days; **future `after`-only** → swapped, so Done commits a valid window instead of clearing the filter (the self-run's find); equal bounds → ordered. An inverted PAIR cannot reach the component (the URL rule drops it; the stored-spec rule drops both bounds and keeps the scope), which is what the fragment's comment says. Memo deps are the two ISO strings — stable identity. |
| **B3** the drafted public issue stated three things the source contradicts | **CLEARED — and the withdrawal is source-true** | `react-multi-date-picker@4.4.1` was read on disk: `components/input_icon.js` renders `createElement("input", {ref, type:"text", className:"rmdp-input", value, autoComplete:"off", …})`, and `build/index.js` defaults `editable` to true (`de = r.editable, le = void 0 === de || de`). `AppDateRangePickerStyles.ts:2` wraps that component and styles `&:focus, &:active` `:20-22`; `overrides.css` carries **no** `.rmdp-input` rule. So "there is no text input / it is not keyboard-reachable" was indeed false. The claim is struck in §4, §6(d) and §8b(iii), and the replacement text asserts only what the source supports. **No third artefact was filed** — verified live: the bot's issue list on the repo ends at #1883/#1884 (2026-09-06, the CTRIB-066 popularity follow-ups). |

**The two POSTED public bodies — fetched live and diffed.** `issuecomment-5567958331` (#1844) and `issuecomment-5567958521`
(#1832), both `odd-contributor[bot]`, 2026-09-07T08:49Z, are **byte-identical** to §8b(i)/(ii) (compared
programmatically), **zero** non-ASCII characters and **zero** workspace-internal ids. Claim-by-claim against §7 they
hold: the scope + the ordering + View all + `Closes #1832` (Steps 1-7, 12); the superseded DISABLED line with the
labelled shared history and the consequence icon (R8, Step 6); relative windows excluded with presets resolving at click
time (§4, R7); ISO params failing closed, the mirror, the saved-search round-trip, 7 locales (R3/R4/R9/R15). One nuance
only — warning 11.

**The four round-2 warning-folds — verified present.** `pnpm exec vitest run` is in §9.3's verbatim block **and** Step 9,
with the watch-mode caveat; `useRecentlyViewedHistoryEmpty()` is three-valued (`'loading' | 'empty' | 'has-history'`),
has a named file (`…/lib/hooks/useRecentlyViewedHistoryEmpty.ts`, exported from the real `lib/hooks/index.ts` barrel),
is consumed by **both** `RecentlyViewedFilter` (Step 6) and `Results.tsx` (Step 7, a three-way branch), and its
`Results.emptyState.test.tsx` has a Files line (`components/Search/Results/` genuinely has no test dir today — checked);
R13's no-write-on-read oracle exists in the spec; the cursor cases use the file's real public idiom
(`AssetSearchCursorTest:83-92` does `decode(keyset(sort, value, valueNull, kind, id).encode(), sort)` — arity and both
precedents confirmed, and `parsesForSort` is `private static` at `AssetSearchCursor.java:148`); `Files:` lines are on
Steps 0-12 including 1, 3-7 and 9; the hook has its artifacts row.

### D1 / D4 / D7 / D9 — re-run in full

- **D1 coverage — 16/16.** R1→Steps 1/2.1/2.4-2.6/3 · R2→2.5/2.6 · R3→2.5/3/8 · R4→3/4 · R5→6+§9.2(c)/8 · R6→1/2.2/2.3/2.5/2.7/3/7 · R7→5/6 · R8→6 · R9→2.8/3 · R10→6/7 · R11→7 · R12→8 (asserted, no code) · R13→2.6/8 · R14→2/9 (measured-only, no truth — stated) · R15→6 · R16→10. All 15 truths are drivable on the running system. **Out-of-scope discipline holds**: no relative window, no facet-count endpoint, no inverse scope, no `/api/info` change, nothing on the legacy `/api/search` beyond the one-token guard, no ST-11 work, no write on read. Two acceptance CLAUSES are under-homed (warnings 1 and 4), not uncovered.
- **D4 scope reduction — PASSES.** Mechanical scan of §7 + §9 for 26 patterns: the only hits are `odd-minimal` (a stack name), "1.5 s later" (a timing assertion), `v2` (`date-fns-tz` v2 vs v3 names) and five occurrences of "defer" — **every one of them the plan refusing to defer**. The class-extension test passes on evidence, not on assertion: the picker's four footer labels + the calendar's own month/weekday names are fixed **in-slice** for all seven catalogs, and the i18n arithmetic was re-verified by loading the JSON — 707 keys × 7, `Recently viewed` / `Done` / `View all` / `Assets you open will appear here.` present in **all seven**, and every one of the 22 new keys (incl. `3 Day` / `1 Week` / `2 Week` / `1 Month`) absent from **all seven**. The saved-search dimension (LSN-042) is closed in-slice, not extended.
- **D7 test integrity — both buckets, correctly routed.** Unit: 1 new Testcontainers class + 8 extended BE classes + the FE vitest set; integration: the mandatory `IT-157` (13 cases, each with a RED-on-base reason and a FOIL, lane `pending-merge` — `suites.yaml:102` confirmed, IT-157 is the next free id, DOC-529 the next free doc id). The CHANGED-tests table's seven rows each name an SoT; `SearchSortDtoTest` really does exist with **3** `@Test`s calling the **2-arg** `resolveEffective` (so keeping the overload leaves them byte-identical), and `searchFormDataToUrlState.test.ts:153-164` really does lock **10** wire keys (→ 11). Residual gaps are warnings 1, 4, 5.
- **D9 conventions — clean.** Zero absolute paths in the record (`§9.0` uses `cd /path/to/odd-team`); zero shell `export` (the only `export`s are TypeScript); `git add -A` appears only in its prohibition; `git commit -F <msg> -- <paths>` + `git diff --cached --name-only` mandated; the branch is cut with `git switch -c` inside the dedicated worktree with an `@{u} != origin/main` assertion before every push (LSN-038); no build in the shared `../odd-platform`; the bot opens DRAFT PRs and never merges; Step 0's comments were posted before any code (G-C5, verified live). **G-C11 re-verified live today:** #1844 and #1832 both OPEN on milestone **1.0.0 (open)**. Docs are routed to `documentation@release/1.0.0`. Warning 9 is the only residue and it is workspace drift, not a plan defect.

### Citation audit — what this round re-read at `0238005c` (so a later round need not)

`RangeFacetFilter.tsx` in full (`:18-21` the preset type, `:99` `hasSelection`, `:100` `canSlide`, `:106` `showBars`,
`:117-216` the render tree, the Javadoc `:60-63`) · `RangeFacetFilterStyles.ts` (the `Presets` / `Bars` / `Bar` /
`SliderRow` split) · `PopularityFilter.tsx` (`:67-96` the reason, `:98-104` the chipText, `:131` the preset) ·
`PopularityFilter.test.tsx` (`:122`, `:137-151`, `:153-158`, `:161-170`, the `ua` case) · `parsePopularity`
`searchUrlState.ts:317-348` · `AppDateRangePicker.tsx` in full · `AppDateRangePickerFooter.tsx` (`ranges={[]}` renders an
empty Box and keeps Done) · `AppDateRangePickerStyles.ts:1-27` · `overrides.css` · `react-multi-date-picker@4.4.1`
`components/input_icon.js` + `build/index.js` · `Search.tsx:69,77-81,109-120` (`urlStateKey` → page-1 re-fire, the merge
object) · `Filters.tsx:38-45,70-79` (`handleClearAll`, `<FavoritesFilter/>` placement) · `Results.tsx:86,96,105,113,202-208` ·
`RecentlyViewedColumn.tsx:24-25,30-38,97` + `FavoritesColumn.tsx:44,102-112` · `recentlyViewed.slice.ts:7-11,43-48`
(page-1 REPLACE) + `recentlyViewed.selectors.ts:15,24` + the **only** consumer of `getRecentlyViewedList` ·
`lib/hooks/index.ts` · `searchUrlState.ts:162,181,196,249,491,567` + the only production consumer of
`resolveActiveSort`/`defaultSortForContext` (`SearchSortMenu.tsx:34`) · `searchFormDataToUrlState.test.ts:153-164,184` ·
`SearchSortDto.java:15-49` · `AssetSearchCursor.java:118-160` · `AssetSearchCursorTest.java:78-96` ·
`SearchSortDtoTest.java` · `ReactiveAssetSearchRepositoryImpl.java` (`:60,62,65,71,79-89,101,115,138,165-169,179,235,245,259,280,294,533`
— the five `searchFrom()` call sites incl. `branch`) · `AssetSearchServiceImpl.java:74,77,91-93,132,178,211-223` · the
complete test-tree consumer list of the four changed repository methods (`AssetSearchServiceMyDataTest`,
`AssetSearchScopePredicateTest`; `popularityHistogram` has none) · `SavedSearchServiceImpl.java:35-37,140,152-186` ·
`V0_0_95__create_recently_viewed.sql` + `V0_0_98__create_asset_search_entrypoint.sql` (**both sides of the join are
`varchar(64)` + `bigint`, and `asset_search_entrypoint`'s PK is exactly `(asset_kind, asset_id)`** — the join compiles and
the measured index-only probe is the real plan; `last_viewed_at` is NOT NULL, which is what licenses the bare `desc()` and
the cursor's NOT-NULL guard) · `application.yml:176-177` · the 7 locale catalogs (707 keys each, loaded and diffed) ·
`integration-tests/suites.yaml:102` · `documentation@origin/release/1.0.0 @ 1a70aba` (`search.md` description **181**
chars PyYAML-measured with no `: ` hazard, `## Favorites` :117, `## Popularity` :152; `catalog-overview.md` :43/:45/:62/:76;
`Features.md`; `data-discovery.md`; `recently-viewed.md`) · the two live GitHub comments + the bot's issue list.

### Warnings (none blocks Step 1; fold them as the executor passes through)

1. **[D7] R13's no-write-on-read oracle is in the spec but not in the IT case table.** R13 says *"IT-157 case 1 asserts
   it directly — a Playwright route listener … records ZERO `POST /api/recently-viewed/*` calls"*, but Step 8's case-1 row
   is *"deep link … chip `Last viewed: any time`"* with no listener clause. An executor writing the spec from the case
   table drops the only oracle for the acceptance clause. **Fix:** add the clause to case 1's row.
2. **[D6 / G-C2] The shared `AppDateRangePicker` gets three changes and its existing consumer has no guard.** The slice
   adds `ranges?`, routes four labels through `t()` and passes a runtime `locale` — and the component has **no test at
   all**, while its only production consumer is `CalendarFilter.tsx` (the Activity / Alerts Period filter). `calendarLocale.test.ts`
   pins the locale DATA (good), `tsc` pins the shape, and Step 9's pixel review exercises the prop wiring on the search
   rail — but nothing looks at the two shipped surfaces the fix also lands on. This is exactly G-C2's
   behaviour-diff-vs-released clause for a cross-cutting i18n change (LSN-036). **Fix:** one line in Step 9 — open the
   Activity Period filter under `ua` and read the calendar + footer.
3. **[D9 executor-readiness] §4 and §8b(iii) promise a Step-9 drive that Step 9 does not schedule.** Both say the
   picker's typing round-trip and screen-reader behaviour are *"answered by DRIVING it in Step 9"*; Step 9 lists a
   screenshot pixel review only. **Fix:** add the keyboard drive explicitly (Tab to the `rmdp-input`, type a range under
   `format='D MMM'` + `range`, record whether it round-trips; file an issue only on an observed defect).
4. **[D7] Step 4's Verify names a `Filters` Clear-All vitest with no file and no home.** `components/Search/Filters/`
   carries tests only for `FavoritesFilter`, `PopularityFilter` and `SelectedFilterOption`; a `Filters` render needs the
   redux store plus several providers, so this is not a free test. **Fix:** name the file + harness, or drop it — IT-157
   case 6 plus a `searchStateToParams` unit case already cover the rule.
5. **[D7 / G-C15] The CHANGED-tests table header over-claims "RED survives" for three of its rows.** The added
   `PopularityFilter.test.tsx:161` assertion is green on `ref:main` **and** on the fix **by design** — its SoT is the
   shipped render conditions, so it is a refactor-invariant guard, not a RED-on-base row (same for the two arity-only
   rows). G-C15's enforcement says `/review` re-runs the RED proof on every changed test and rejects one that passes on
   the unfixed base. **Fix:** label those rows "refactor-invariant guard (green on both sides by construction)" so the
   reviewer does not read the bug-hiding signature into them.
6. **[D3] §9.5 trap 10 cites an oracle that does not exercise it.** It says *"assert the panel still lists its five rows
   after a visit to `/search` (IT-157 case 9 exercises it)"*, but case 9 goes panel → search and never returns. The
   hazard itself is **verified safe by construction** this round: `fetchRecentlyViewedList.fulfilled` REPLACES the list
   for `page <= 1` (`recentlyViewed.slice.ts:43-48`), `getRecentlyViewedList` has exactly **one** consumer, and that
   consumer re-fetches on mount — so the residue is a transient. **Fix:** extend case 9 with a return-to-overview step,
   or correct the sentence.
7. **[D6] Step 2.2's default clause reads two ways.** *"when the scope IS present and nothing was requested (or
   `RELEVANCE` without a query), the default becomes `LAST_VIEWED`"* — read literally, recency becomes the default even
   **with** a query, contradicting R6 (*"query + scope ⇒ relevance"*), §5.5's option A and Step 3's FE rule
   (`hasRecencyScope && !text.trim()`). The plan's own tests catch it, so it is not a blocker. **Fix:** say "the BROWSE
   default slot becomes `LAST_VIEWED`; a text query still resolves to `RELEVANCE`" — the shipped `resolveEffective`
   (`SearchSortDto.java:45-48`) is a two-line fold and the third argument only changes the `STATUS_PRIORITY` slot.
8. **[D9 record hygiene] The round-1 W7 / round-2 W6 editing artifact survives into round 3.** §4 still reads *"the
   `react-multi-date-picker` calendar's **English calendar's** keyboard / screen-reader behaviour"*. **Fix:** delete the
   duplicated possessive.
9. **[D9 workspace drift, not a plan defect] The plan's issue-filing instruction is authorised but three rule files still
   say the opposite.** Step 11 and §9.6 tell the executor to FILE real issues via the App token — which `CLAUDE.md:126`
   and `.claude/skills/log-issue/SKILL.md:118` now permit (and the bot demonstrably does: #1872/#1874/#1878/#1883/#1884)
   — while `playbooks/github-write.md:10,77`, `issues/README.md:127` and `pillars/contributor/gates.md` G-C18 still say
   the bot never creates issues. A `/review` session reading those would bounce a filed issue. **Fix:** cite
   `CLAUDE.md:126` in the plan, and log the three stale files as a workspace follow-up (out of this slice's diff).
10. **[D5] Size — recorded, not blocking (unchanged from rounds 1-2).** 13 steps / ~46 files is well over
    `plan-contract.md` §2's 2-3 tasks / 3-5 files. It stands because G-C18 bars a horizontal split, the only SPIDR seam is
    rejected on a stated product argument (§5.5 — the ordering is what makes the filter's panel link honest), ST-7 (33) /
    ST-8 (40+) / ST-9 (~50) shipped on this rail, commits land per step, and the maintainer approved the size in plain
    language. **Watch:** Phase D runs on a less capable model — if context runs out mid-slice, resume from the last
    committed step (§9.1 supports it); do not compress steps.
11. **[D1, informational — no edit warranted] The posted #1844 comment says the ordering is "used as its default"** without
    R6's *"and no query is typed"* caveat. True in the browse case a reader will actually test, and the same comment says
    any other ordering still works; a text query keeping relevance is the platform-wide shipped rule. Recorded so a later
    reader does not mistake it for a divergence. If the thread is revisited for another reason, one clause closes it.

### Recommendation

**0 blockers → the plan may proceed to Step 1.** The three round-2 blockers are genuinely closed, and this round proved
each from the source rather than from §8a's account of it — including the one that mattered most, the extraction whose
render conditions are not the obvious ones. The eleven warnings are hardening: 1-4 are worth folding **before** the step
they belong to (they are one line each and two of them are missing oracles), 5-8 are packet hygiene the reviewer will
otherwise raise, 9-11 are recorded rather than actionable in this slice.

What this round adds that the self-run could not: an adversary who had not written the text. The extraction was
simulated state-by-state rather than read; the `chipText ⟺ hasSelection` equivalence was proved from `parsePopularity`'s
own early return rather than asserted; the withdrawn accessibility claim was checked against the library's compiled
source; the public bodies were fetched from GitHub and byte-compared; and the join's two column types were read out of
the migrations. The plan's citation accuracy remains its strongest property — **every** anchor re-checked this round
resolved exactly as written.
