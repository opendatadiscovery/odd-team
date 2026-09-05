---
id: CTRIB-066-plancheck
subject: contributor/CTRIB-066.md §7 (the GATE-1 plan + must_haves) against §4 Spec, §6 Design, adrs/drafts/unified-asset-search.md
checker: plan-checker (fresh context, adversarial, goal-backward — playbooks/plan-contract.md §3, G-C19)
round: 1
date: 2026-09-05
base_verified: odd-platform af5a573b (worktree ../odd-platform-ctrib066, detached); documentation origin/release/1.0.0 @ 716d3e7
verdict: ISSUES FOUND — 1 blocker, 11 warnings
---

# CTRIB-066 plan-check — round 1

## ISSUES FOUND
**Slice:** CTRIB-066 / #1843 ST-9 — the Popular numeric-range facet over the snapshotted `popularity_score` + the
distribution histogram (the first non-categorical facet type, a reusable range shell) + the Popular tile's deep-link,
DE-scoped; GATE-1 option D1-A folds in the `Most popular` sort (#1861 item 1).
**Requirements covered:** 15/15 map to ≥1 step; 14/15 map to a `must_haves` truth (R15 has none — W10).
**Tasks:** 13 steps · **Files:** ~50 (2 contract · 10 BE main · 5–7 BE tests · 18 FE main incl. 7 locales · 4 FE tests ·
7 odd-team · 4 docs) — see W3.
**must_haves:** 14 truths, all user-observable; 9 key_links — 8 implemented by a step, 1 (the sort's cursor path) has no
step and no test → the blocker below.
**Issues:** 1 blocker, 11 warnings.

Every file / line / identifier the plan cites was checked statically at `af5a573b` (no system was run). All load-bearing
citations hold: `ReactiveAssetSearchRepositoryImpl.conditions()` :269-471, condition (7) :461-468, the My-data
outright-exclusion :320-324, `EXCLUDE_FROM_SEARCH` :294, the `falseCondition` rule :365-368,
`refreshPopularityScores` :116-130 (kind-guard :126), `SearchSortDto` :16-19, `AssetSearchServiceImpl` :71-116 (the
favorites → My-data → `resolvePage` chain the plan extracts into `scoped()`), `V0_0_100` :29-39/:46-47/:54-57/:62-66,
`AssetPopularitySnapshotJob` :31-32, `AssetSearchController` :17-24, `listPopular` :669, `sanitiseSpecTree` :146-170,
`components.yaml` :466 / :2574-2592 / :2618-2632, `searchUrlState.ts` (`assetSearchFormDataToUrlState` :479-496,
`SEARCH_SORT_OPTIONS` :126-131 + the "Most popular is intentionally NOT here" comment :113-114, `parseDepth` :267),
`Search.tsx` mirror :95-121 (the "EVERY URL-ONLY PARAM MUST BE LISTED HERE" comment :102-106), `Filters.tsx`
`handleClearAll` :37-42 + Statuses last at :98, `OwnerEntitiesList.tsx` :92-98 (no `viewAllTo`) / :100-125,
`DataEntityList.viewAllTo` :26/:80-81, `searchFormDataToUrlState.test.ts` `Required<SearchUrlState>` :124-141 +
9 `WIRE_KEYS` :144-154, `FixedOptionsMultiFilterStyles.Chip` :6, `lib/api.ts:63 assetSearchApi`, `lib/hooks/api/index.ts`
(no `assetSearch.ts` yet — new, as planned), `Slider` in `odd-platform-ui/src`: 0 files, 7 locale catalogs × 691 keys
(`Popular` ×7, `Most popular` absent, `en.json:682` the exclusion-sentence shape), `i18n-key-parity.test.ts`,
`SearchSortMenu.tsx:63` renders from `SEARCH_SORT_OPTIONS`, `buildSearchLink(state: Partial<SearchUrlState>)`
(`useNavigateToSearch.ts:22`), `Results.tsx:86-87` one `assetSearchFormData` memo feeding both fetch sites (:105/:113),
`Search.tsx:69` `urlStateKey`, all ten named unit-test classes exist, `helpers/db.ts` `seedSearchableEntity` :708 /
`seedSearchableTerm` :669 / `dbQuery` :29, `integration-tests/TEMPLATE.md`, `suites.yaml` `pending-merge` :102,
`protocols/IT-155-saved-search-round-trip.md`, `e2e/specs/favorites-star-see-loop.spec.ts`, `backlog/tests/TST-067.md`,
`F-017.yaml` UC-01..UC-15 + `use_case_coverage` 4/15, `concepts.yaml:3255/:3262`, ADR-0076 + ADR-0021 published on the
train, the train's `search.md` (`## Favorites` :117, description exactly 188 chars), `catalog-overview.md` :60/:62/:76/:78-80,
`Features.md:60`, `data-discovery.md:13,23`. Free ids: IT-156 ✓, DOC-527 ✓, **PLT-266 ✗ (taken — W1)**. Minor line drift
only (cosmetic): `SEARCH_SORT_OPTIONS` cited :118-123 (is :113-131), `assetSearchFormDataToUrlState` :456-496 (is :466-496),
`Results.tsx` fetch sites :93/:101 (are :105/:113).

### Blockers (must fix before GATE 1)

1. **[D3 wiring / D6 ADR security bar / D7] `AssetSearchCursor` is a named consumer of the `POPULARITY` sort with no step,
   no artifact and no test — executed as written, a tampered `POPULARITY` cursor 500s or seeks the wrong column.** [D1-A]
   - Plan location: §7 Step 2 **Files** (`dto/PopularityRangeDto`, `dto/SearchSortDto`, the repository pair, the service
     pair, `PopularityBands`, `AssetSearchController`, `SavedSearchServiceImpl` — `dto/AssetSearchCursor.java` is absent);
     Step 2 **Action** (adds the `POPULARITY` branches to `orderFields` / `keysetSortValueField` / `seekBranchPredicates` /
     `outerOrderFields` / `toPageRow` only); Step 9 (no tampered-`POPULARITY`-cursor case); `must_haves` artifacts (no
     row). Only §6(d) mentions it, as prose: "a `POPULARITY` cursor decodes like `STATUS_PRIORITY`".
   - Evidence at `af5a573b`: `AssetSearchCursor.parsesForSort` :148-160 — `case STATUS_PRIORITY -> Short.parseShort`,
     `case UPDATED_AT -> LocalDateTime.parse`, **`default -> // NAME: any string is a valid sort value`** → a
     `{s:"POPULARITY", v:"abc", k, i}` token passes `decode`; the planned `seekBranchPredicates` `POPULARITY` branch
     then does `Short.parseShort("abc")` → `NumberFormatException` → `ControllerAdvice` (:59/:95) → **500**. And
     `decode` :128 `if (valueNull && sort == SearchSortDto.STATUS_PRIORITY) return empty` is the ONLY NOT-NULL guard
     → a `{s:"POPULARITY", vn:true, …}` token passes, `seekBranchPredicates` takes the `sortValueNull()` path,
     `sortValueIsNull(sort)` :191-195 returns `UPDATED_AT.isNull()` for any non-NAME sort → the seek **silently queries
     another column's null tail** — the exact tamper the :128 comment says must fail closed ("rather than reach the
     seek and silently query a different column's NULL tail (R-B4 fail-closed)").
   - Spec/ADR line: `adrs/drafts/unified-asset-search.md` Cross-cutting Security — "fails closed (a malformed spec →
     empty, never a 500)"; the cursor's own contract ("SORT-SCOPED and FAILS CLOSED … a bad cursor never raises and is
     never mis-applied"); §4 R11 "keyset-paged (the STATUS_PRIORITY NOT-NULL-smallint branch mirrored)" — the mirror is
     incomplete without the cursor's two `STATUS_PRIORITY` branches.
   - Fix: add `dto/AssetSearchCursor.java` to Step 2 Files; Action: `case POPULARITY -> Short.parseShort(value)` in
     `parsesForSort` and widen :128 to `sort == STATUS_PRIORITY || sort == POPULARITY` (both NOT NULL smallint columns);
     Step 9: extend `AssetSearchKeysetPaginationTest` :152 ("a malformed / tampered / foreign-sort cursor fails closed to
     the first page (never an error)") with a `POPULARITY` `v:"abc"` token and a `POPULARITY` `vn:true` token → first
     page, 200; add the artifact row (`…/dto/AssetSearchCursor.java` → T11 → anchor `case POPULARITY`). Two lines of
     code + one test; the plan is otherwise ready on this axis.

### Warnings

1. **[D9 id convention / D1 R13 artifact] `PLT-266` is not free — the CTRIB-066 draft collides with a committed item.**
   `issues/odd-platform/PLT-266-openapi-codegen-ignores-components-yaml.md` was committed at `e6010703` (2026-09-05
   10:13, the CTRIB-065 close-out); `PLT-266-popular-tile-live-vs-snapshot.md` (untracked, 10:19) reuses the id.
   Next free = **PLT-267**. Renumber the draft's file + `id:` and every reference in the record (R13, §5.5, the
   exclusions, Step 12, Step 13, `must_haves`), and re-run `ls issues/odd-platform | sort -V | tail -1` when the GATE-1
   packet is assembled (a co-active stream can take an id between plan and packet). Fix before the packet: it is the
   draft the maintainer files (G-C5 class-extension clause); memory `feedback_id_enumeration_canonical_tracker_only`.
2. **[D6 impact checklist — every consumer] Two consumers of changed signatures are missing from §6(d).**
   (a) `AssetSearchScopePredicateTest.java:235,244` calls `assetSearchRepository.relevancePage(…, scope, null, 0, 50)`
   and `.keysetPage(…, scope, null, cursor, limit)` at the current arity — a compile break on the new `popularity`
   parameter; §6(d) asserts "the only caller is `AssetSearchServiceImpl` (+ `AssetSearchServiceMyDataTest`)". (b) The
   legacy `/api/search` consumes `SearchSortDto` at `ReactiveDataEntityRepositoryImpl.getSearchResultOrderFields`
   :1010-1032 — an if/else chain whose final `else` is status-priority, so `sort=popularity` resolves via `fromString`
   and **silently orders by status priority**; meanwhile Step 1 edits the SHARED `SearchFormData.sort` prose
   (`components.yaml:2528-2535`, "one of RELEVANCE, STATUS_PRIORITY, UPDATED_AT, NAME") to list `POPULARITY`, so the
   legacy endpoint would advertise a sort it ignores. Fix: list both; scope the prose ("`POPULARITY` is honoured by
   `/api/search/assets`; `/api/search` falls back to its per-context default — ADR D9 posture, like `asset_kinds`");
   state the legacy fallback in Step 2 Done (or a one-case test on the legacy search). [D1-A for (b)]
3. **[D5 context budget] ~50 files across 13 steps; Step 2 alone touches 10.** By the letter of `plan-contract.md` §2
   / D5 this is over a single-window quality budget (BLOCKER-shaped). Not blocked, on evidence: the slice is already a
   decomposed leaf of #1825 whose scope is fixed by the issue (facet + histogram + tile link + i18n + tests — a
   horizontal split is barred by G-C18), the maintainer accepted ST-7 (33 files) and ST-8 (40+) on this exact rail and
   both shipped, and the one available SPIDR split — the facet + histogram + URL + saved-search half vs the sort +
   tile-link half (= D1-A as two PRs) — is already visible in the D1 option matrix for the maintainer to pick. Execute
   step-by-step with a commit per step so a context reset loses nothing; the FULL regression + coverage gate stay the
   Definition of Done (G-C2/G-C13).
4. **[D7 oracle / D1 R3] R3's "URL rewritten" has no on-load mechanism and no test.** `Search.tsx` navigates only at
   :55 (legacy clear) and :121 (the mirror — fired on a LOCAL facet change, `isFacetsStateSynced=false`); a garbage
   deep link (`popularity_min=abc`) is dropped by the parser on load and the address bar is normalised only on the next
   local facet toggle — exactly how `asset_kinds` junk and `sort=garbage` behave today. Likewise `popularity_min=99`
   stays `99` in the URL while the chip reads `1,048,575+ views` until the next write. Reword R3 ("the filter is
   dropped/clamped on load; the URL is normalised on the next facet change, per the rail") and drop "URL rewritten" from
   the on-load acceptance — or add an explicit on-load normalisation and an IT assertion. Do not leave an acceptance
   clause with no oracle.
5. **[D7 RED-on-base] IT-156 case 4 (Clear All) is GREEN on `ref:main` by construction** (the plan says so). Reorder so
   it carries its own RED: with `popularity_min=4` active assert the 0-view DE is ABSENT (the foil), then Clear All →
   present + both params gone. Then every row of the case table is RED on the unfixed base (G-C9/G-C15).
6. **[D7 / G-C15 ledger] Changed tests not enumerated as CHANGED.** `SearchSortMenu.test.tsx:84` asserts "offers the
   four canonical orderings" — it must become five (SoT: the contract's sort prose; RED on base: 4 ≠ 5 — legitimate);
   `AssetSearchServiceMyDataTest:167-171` (mock arity); `AssetSearchScopePredicateTest` (call arity, W2a). Step 9 says
   only "gains the option" / "arity updated". Record each as CHANGED with its SoT + surviving-RED proof. (The
   `WIRE_KEYS` 9→10 + `Required` fixture change IS correctly framed: more truth, contract SoT, compile-RED on base ✓.)
7. **[D7 sufficiency] R11's "EXPLAIN: no Sort node" is credited to an oracle over hand-written SQL.**
   `AssetPopularitySnapshotTest` :43-44/:156 EXPLAINs a literal `popularity_score DESC NULLS LAST` ORDER BY over the
   union, not the generated jOOQ `POPULARITY` branch (`orderFields` + the UNION-of-ranges seek); Step 10's
   `auto_explain` is a measurement, not a regression test. Extend `AssetSearchKeysetPaginationTest:224` ("the
   UNION-of-ranges keyset seek range-starts (no Filter)") with the `POPULARITY` seek so the generated SQL is pinned.
   [D1-A]
8. **[D6 ADR D11 — one spec, two surfaces] A STORED contradictory range reads differently on the two surfaces.**
   Server: `{min:10,max:2}` → `falseCondition` → empty (R3). FE reapply of the same stored spec:
   `assetSearchFormDataToUrlState` drops the inverted range → the whole list, no chip. The plan's "the FE never sends a
   contradictory range, so the two rules never both apply to one request" is true per request, but the stored spec is
   the shared representation and an API client can store one. Fix: `sanitiseSpecTree` also drops an inverted range
   field-level (as it drops a non-integer bound) so both surfaces read one spec; one case in `SavedSearchServiceImplTest`.
9. **[D1 R15 / D6 docs] Step 11's `catalog-overview.md` edit list misses :62** ("Each of the **first three** columns
   carries a **View all** link…") and the first clause of :76 ("The three personalised columns each end in a View all
   link") — both become false when the Popular column links; only :60 and the "Popular has none" sentence are listed.
   The end-to-end re-read may catch them; list them. Also: the train's `search.md` description is exactly **188** chars,
   so ", Popularity" lands at 200 — the ≤200 acceptance forces a re-authored description, not an append; say so.
10. **[D1 contract completeness] R15 has no `must_haves` truth** — T13 covers only R13's divergence disclosure. Add
    T15 ("the manual's Search page explains the Popularity facet — bands, DE-only, 15-min snapshot, sort, View all — and
    the Catalog Overview's Popular column now links") so every spec line has a truth (`plan-contract.md` §1 rule).
11. **[D9 stream coordination] `integration-tests/suites.yaml` is DIRTY (` M`) and owned by `ctrib065close`**
    (`state/active-streams.yaml:72`); Step 9 registers IT-156 in the `pending-merge` lane of the same file. The O10
    route-around is recorded at intake but not carried into the step: sequence the write after `ctrib065close` commits
    (re-read the file first), never stage its hunk. Minor, same family: the `usePopularityFacet` key strips only
    `popularity` — also strip `sort` (order does not change counts), else every sort change re-fetches identical bars.

### Verified compliant (recorded so the next round does not re-litigate)
- **D4 scope reduction / class extension:** phrase scan of the record — 0 banned phrases (the two hits are the
  `pending-merge` lane and the plan's own anti-pattern disclaimer). The D2 deferral (converging the tile onto the
  snapshot) is a plain-language GATE-1 decision with the user-facing consequence, disclosed in the docs (R13), with the
  paste-ready draft handed at GATE 1 and the scope comment posting only once the URL exists — the G-C5 class-extension
  clause verbatim (LSN-042 rule 1). The server-side histogram cache is excluded on a measurement (bounded to ≤21 groups
  by construction, ≤1.17× count(*), parallel, client-memoised), not on effort; the ADR says "cached/bounded".
- **D6 system-level ADR invariants after the plan:** D11 holds — the range lives on `AssetSearchFormData` (persisted
  via #1878), projected both ways (Step 3) and sanitised (Step 2), locked by the extended D11 test; the sort is on the
  shared `SearchFormData` half and reapplies through the `SEARCH_SORT_VALUES` allow-list at `searchFormDataToUrlState`
  :443-445 once `'popularity'` is an option. D5 holds — every read is `popularity_score`; nothing joins `view_count`.
  D9 holds — optional fields, a new POST endpoint, the legacy session untouched. D12 holds — the global dropdown's five
  canonical sorts complete; the numeric ASC "dead assets" view is served by the `Never viewed` preset, the per-column
  matrix is the constructor slice's. D8 holds — the tile becomes a deep-link widget. `ADR-CANDIDATE-052` (session
  facets) is the pattern D10 supersedes; the new endpoint is stateless like `/api/search/assets`.
- **D6 reuse scan:** MUI `Slider` first use (0 files today — verified), `FixedOptionsMultiFilterStyles.Chip`,
  `AppTooltip` + `InformationIcon` behind `span[data-qa]` (`FavoritesFilter:74-88`, ADR-0076), the `MyDataFilter`
  h5/subtitle2 heading idiom, the `useQuery` idiom (`appInfo.ts:5-7`), `buildSearchLink`/`searchStateToParams`, the
  `FavoritesFilter:57-60` commit path — each verified present. The four new artefacts each carry a one-sentence
  justification.
- **D6 impact checklist:** i18n — 7 catalogs, 691 keys, the parity test exists and is planned to run; generated
  clients both sides (the `rm -rf …/build/generated` caveat is itself PLT-266-codegen); migration none (V0_0_100
  verified shipped); docs routed to `release/1.0.0` in an own worktree (LSN-034); ontology F-017 UC-16 4/15 → 5/16.
- **D7 buckets:** unit (Testcontainers + web tests + vitest) and a mandatory integration IT-156 with a FOIL per case;
  the CHANGED D11 lock asserts more truth with a compile-RED on base (G-C15 ✓).
- **D8:** open questions (1)/(2) routed to GATE-1 D1/D2; (3)/(4) RESOLVED with source + measurement.
- **D9:** no absolute paths, no `export`, no `git add -A` in the record; branch `git switch -c` with no upstream
  (LSN-038); milestone 1.0.0 verified live; `Part of #1861`, never `Closes`; ASCII scope comments; bot never files.
- **D10:** no destructive migration, no auth-posture change, additive contract — no G-C7 stop; `adr_required: false`
  is correct.

### Recommendation
1 blocker → return to the planner; add `AssetSearchCursor` to Step 2 + the tampered-cursor case to Step 9 + the
artifact row, renumber PLT-266 → PLT-267, fold the warnings that are one-line plan edits (W2, W4, W5, W6, W8, W9, W10,
W11), and re-check (loop 2 of ≤3). Nothing here is "too big to fix in plan"; no decompose/re-spec is warranted — W3 is
recorded for the maintainer's GATE-1 judgement with the split named.
