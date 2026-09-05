---
id: CTRIB-066-plancheck
subject: contributor/CTRIB-066.md §7 (the GATE-1 plan + must_haves) against §4 Spec, §6 Design, adrs/drafts/unified-asset-search.md
checker: plan-checker (fresh context, adversarial, goal-backward — playbooks/plan-contract.md §3, G-C19)
round: 1
date: 2026-09-05
base_verified: odd-platform af5a573b (worktree ../odd-platform-ctrib066, detached); documentation origin/release/1.0.0 @ 716d3e7
verdict: ISSUES FOUND — 1 blocker, 11 warnings
round_2: 2026-09-05
round_2_verdict: ISSUES FOUND — 1 blocker (new — the control's zero-band state), 7 warnings; B1 + W1/W2/W5–W11 closed, W4 partial (T3 residue), W3 recorded honestly
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

# CTRIB-066 plan-check — round 2

_Fresh context, adversarial, goal-backward (`playbooks/plan-contract.md` §3, G-C19). Subject: the REVISED `contributor/CTRIB-066.md` §4 / §6 / §7 (+ `## 7a`) after round 1. Static verification only — every cited file/line re-read at odd-platform `af5a573b` (`../odd-platform-ctrib066`), the doc train at `origin/release/1.0.0`, the odd-team tree as of this check. Nothing was run._

## ISSUES FOUND
**Slice:** CTRIB-066 / #1843 ST-9 — the Popular numeric-range facet over the snapshotted `popularity_score` + the distribution histogram (the first non-categorical facet type, a reusable range shell) + the Popular tile's deep-link, DE-scoped; GATE-1 D1-A folds in the `Most popular` sort (#1861 item 1).
**Requirements covered:** 15/15 map to a step (R14's authoring has no step of its own — W-D); 15/15 map to a truth (T15 added).
**Tasks:** 13 steps · **Files:** ~50 (Step 2 alone 10) — W3, carried.
**must_haves:** 15 truths (T3 carries a stale clause — W-F); 20 artifacts (the `AssetSearchCursor` row present); 10 key_links, every one now implemented by a step.
**Issues:** 1 blocker (NEW — introduced by nothing in round 1; a gap round 1 did not reach), 7 warnings.

### Round-1 findings — closed or not, judged on the plan TEXT

| R1 | Verdict | Evidence in the revised plan |
|---|---|---|
| **B1** cursor | **CLOSED** | Step 2 Files has `dto/AssetSearchCursor.java`; Action: `parsesForSort` (`:148-160`) gains `case POPULARITY -> Short.parseShort`, the `:128` NOT-NULL guard widens to `STATUS_PRIORITY \|\| POPULARITY`; Step 9 adds both tamper tokens to `keyset_malformedCursor_failsClosedToFirstPage` (`:152`, verified) and the POPULARITY seek to `keysetSeek_unionOfRangesRangeStarts_orFormFilters` (`:224`, verified); artifact row (anchor `case POPULARITY`) + key_link present. Re-derived at `af5a573b`: `sortValueIsNull` (`Impl:192-195`) returns `UPDATED_AT.isNull()` for any non-NAME sort and `encode()` has no other sort-scoped branch — the diagnosis and the fix are exact |
| **W1** id | **CLOSED** | `ls issues/odd-platform \| sort -V \| tail -1` = `PLT-267-popular-tile-live-vs-snapshot.md`; exactly one `PLT-267*`; the record references `PLT-266` only in §7a's log; the draft is ASCII-clean (0 non-ASCII bytes), `status: draft`, no self-assigned milestone |
| **W2** consumers | **CLOSED** (residual → W-E) | §6(d) names `AssetSearchScopePredicateTest:235,244` (verified: `relevancePage(…, scope, null, 0, 50)` / `keysetPage(…, scope, null, cursor, limit)`) and the legacy `getSearchResultOrderFields:1010-1032` (verified: `fromString` → not RELEVANCE/UPDATED_AT/NAME → the status-priority `else`); R11 scopes the token with the `my_data` precedent (`components.yaml:2509`, verified) |
| **W3** size | **RECORDED — honest on the numbers, understated on the seams** | "~50 files … over the letter of the one-context budget … ST-7 (33) / ST-8 (40+) … the only SPIDR split is facet+histogram+URL+saved-search vs sort+tile (= D1 as two PRs)". The count and the precedent are true. "The only split" is not: the plan's own R6 degraded mode (a slider over the full 0..20 rail, no bars, the range still filters) proves the histogram (endpoint + hook + bars + Step 10) is a second user-observable seam. Name both seams for GATE 1 — see the Warnings |
| **W4** on-load rewrite | **PARTIAL** | R3 is reworded correctly (no on-load rewrite; junk normalises on the next mirror write; "asserted, not assumed"). **T3 still reads "(and rewrites the URL clean)"** — the truth contradicts its own spec line → W-F(a) |
| **W5** IT case 4 | **CLOSED** | case 4: "the 0-view DE **absent** — asserted first, then Clear All → both params gone and the 0-view DE **back**" |
| **W6** CHANGED tests | **CLOSED** | the three-row table with SoT + surviving RED (`SearchSortMenu.test.tsx:84` "offers the four canonical orderings" verified; the D11 lock `Required<SearchUrlState>` + `WIRE_KEYS` 9→10) |
| **W7** generated seek | **CLOSED as a step; the SHAPE it pins is wrong** → W-A | the POPULARITY seek is added to the `:224` EXPLAIN oracle — but written as `ORDER BY popularity_score DESC, asset_kind, asset_id DESC`, which the `DESC NULLS LAST` index does not serve (below) |
| **W8** inverted stored range | **CLOSED as specified** → but see W-B | R10 + Step 2 drop an inverted range field-level; the sanitiser runs on READ (`deserializeSpec :146-170`), so every reader (FE reapply, API GET) sees no range. The consequence for a direct API client is not stated anywhere |
| **W9** docs | **CLOSED** | Step 11 lists `catalog-overview.md` :60 / :62 ("first three" → four, destination named) / :76 both clauses (verified on the train — both sentences at those lines); the description is "re-authored", measured today at **188 chars / 190 bytes** (the plan's 188 is right; a byte count would mislead — measure chars) |
| **W10** T15 | **CLOSED** | T15 present, traces to R15, oracle = the doc read + `git grep` + Gate 8 at the release gate |
| **W11** sequencing + key | **CLOSED and still live** | Step 9 sequences the `suites.yaml` lane edit after the co-active commit; `git status` at this check shows `integration-tests/suites.yaml` **staged by ctrib065close, not yet committed** — the clause is load-bearing, not stale. Step 5 strips `sort` from the key AND the body |

### The three hunts the spawner posed
1. **Sanitiser's inverted-range drop vs the server's contradictory-⇒-empty rule, for a direct API client.** Between the two D11 surfaces (URL ↔ saved row) the plan is now consistent: URL parser drops, projection drops, sanitiser drops. Against the LIVE request it is not: `POST /api/search/assets {popularity:{min:10,max:2}}` → 0 rows (R3), while the same client saving that spec and reading it back gets a spec with no `popularity` → every row. Not a D11 break; an undocumented normalisation → **W-B**.
2. **Stripping `sort` from the histogram key/body.** Never produces a wrong histogram: `popularityHistogram(state, kinds, scope, favorites)` takes no sort; `sort` is optional on the wire (`SearchFormData.required` = `[filters]` only, `components.yaml:2571-2572`), so the stripped body validates; the counted set is sort-invariant. No finding.
3. **Double-count / contradiction between §4, §6, §7.** Four residues of the revision, none goal-affecting → **W-F**.

### Blockers (must fix before GATE 1)

1. **[D1 coverage / D7 oracle — the control has no defined rendering when the histogram is all zeros, and the plan itself produces that state on three normal paths.** R8 disables the control only "when the observed distribution has a **single** non-empty band and no range is selected"; Step 7 sets `stops = the buckets with count > 0 ∪ the selected bounds` and `disabledReason` only for "exactly one non-empty band"; Step 6 renders the MUI `Slider` with `min=0 max=stops.length-1`. With **zero** non-empty bands and no selection, `stops = ∅` → `max = -1` → a degenerate slider (no stops, NaN thumb positions) on a shipped control — and no truth, no vitest case, no IT case covers that state. The plan's own text reaches it: R4 "`asset_kinds=[TERM]` → 21 zeros" (the Asset-type filter set to Term — a released filter, one click away); any query whose matches are all Terms/Query Examples; and Step 2's "the My-data no-owner short-circuit yields an all-zero facet" (every My-data selection under `auth.type=DISABLED`). This is the LSN-042 "found on the first manual test" class in UI form, and ADR principle 1 (UI/UX of the core, pixel review every slice) is the bar it fails.
   - Plan location: §4 R8 (Target + Acceptance), §7 Step 6 (the `Slider` props), Step 7 (`stops`, `disabledReason`), `must_haves` T8, Step 9 vitest list (no 21-zero mock).
   - Spec/ADR line: R8's own rule ("never a slider whose every position yields the same list") — zero bands is the limiting case of it; ADR `unified-asset-search` Guiding principle 1 + Cross-cutting UI/UX; R7 ("the rail spans observed min..max ∪ selected" is undefined for an empty observed set).
   - Fix (one clause, four places): R8 → "when **at most one** non-empty band is observed and no range is selected" with the zero-band reason (e.g. *"No data entities match the current filters"* — a 13th key ×7, added to §6(d)); Step 7 `disabledReason` covers `nonEmpty.length <= 1`; T8 reworded ("… or no data entity at all …"); Step 9 vitest: a mocked 21-zero facet → disabled + reason, no slider; IT-156 (optional, cheap): Asset type = Term → the Popularity control disabled with its reason. Keep the failed-request fallback (all 21 bands, no bars) distinct from the succeeded-with-zeros state — they are different truths (T6 vs T8).

### Warnings

1. **[D7 / D6 perf — the POPULARITY ORDER BY's nulls direction does not match the index.]** Step 2 Action: `orderFields (POPULARITY_SCORE.desc())`, `outerOrderFields (desc())`; Step 9's seek oracle: `ORDER BY popularity_score DESC, asset_kind, asset_id DESC`; §4a's row likewise. In Postgres `ORDER BY x DESC` is `DESC NULLS FIRST` (docs 13 §11.4: "`NULLS FIRST` is the default for `ORDER BY DESC`"); `asset_search_entrypoint_popularity_idx` is `(popularity_score DESC NULLS LAST, asset_kind ASC, asset_id DESC)` (`V0_0_100:65-66`); a `DESC NULLS LAST` index satisfies `DESC NULLS LAST` forward or `ASC NULLS FIRST` backward — never `DESC NULLS FIRST`. The planner does not consult the NOT-NULL constraint when matching pathkeys, which is exactly why 5c's own oracle pins `popularity_score DESC NULLS LAST, asset_kind ASC, asset_id DESC` (`AssetPopularitySnapshotTest:154`) and why the migration kept `NULLS LAST` "to match the consumer contract verbatim" (`:62-63`) — a no-op for the RESULT order, load-bearing for the PLAN. Executed as written: a Sort node on every Most-popular page (order still correct; R11's "index-served" acceptance and the §4a 1.5 ms figure not met). Not a blocker: Step 9's oracle and Step 10's Done both go RED on the wrong shape. Fix: `.desc().nullsLast()` at both sites (the shipped `UPDATED_AT` idiom, `Impl:212` / `:485`); the Step 9 oracle SQL carries `NULLS LAST`; §4a's row states the shape it actually measured.
2. **[D6 consistency — the inverted range has three paths and two answers, undocumented.]** Live POST `{min:10,max:2}` → `falseCondition` → 0 rows (R3, "never a silent widening"); the same spec saved → read back without `popularity` (R10's sanitiser) → the whole list; URL → dropped. The FE never sends one, and URL ↔ saved row agree (D11 holds) — but a direct API client is silently widened on save+reapply against what the live call told them. Make it a contract, not a surprise: Step 1's `SavedSearch.spec` / `PopularityRange` prose states "an inverted stored range is removed on read, as an unknown `asset_kinds` token is"; Step 9's `SavedSearchServiceImplTest` row names the inverted case explicitly (today it says "malformed" only — round 1's W8 asked for one case) + one `SavedSearchControllerWebTest` case (POST inverted → GET without `popularity`). Same family, Step 2: define `popularity: {}` (no bound set) ≡ absent — no predicate, **no DE-scoping** (R2 says "any **set** bound"; Step 2 says "when a range is present" — an empty object must not narrow to data entities).
3. **[D7 flake class — IT-156's seed races the snapshot job; case 7's oracle is absolute.]** Step 9 seeds `asset_search_entrypoint.popularity_score = asset_popularity_bucket(views)` directly with `data_entity.view_count` left at 0 (`seedSearchableEntity` writes 0). `refreshPopularityScores` (`Impl:116-130`) rewrites every DE row whose score `IS DISTINCT FROM bucket(view_count)`, on `@Scheduled(fixedRate = 15 min)` with no initial delay (`AssetPopularitySnapshotJob:31`) — under the FULL regression the stack lives past 15 minutes, so a tick between seed and assertion resets the seeded scores to 0 (a few-percent flake per run, silent in `run-suite.sh`'s EXIT=0 trap). Fix: the seed also sets `data_entity.view_count = $views` (idempotent under the job). And case 7 asserts "the 1,000-view DE is row 1" on a query-less, catalog-wide list — assert relative order (the 1,000-view DE precedes the 40-view DE; the 0-view DE absent) or seed a top-band count (≥ 2^20 views) so no other spec's page-opens can tie the band.
4. **[D1 specificity — R14 has no authoring step; T14's oracle is parity, not render.]** No step's Files names `locales/translations/{br,ch,en,es,fr,hy,ua}.json`; the keys live in §6(d), the catalogs in §6(c), the parity test run in Step 9. Add the seven catalogs to Step 7 Files ("the 13 keys, translated — never en + machine-fill") so an executor edits them from the step, not from the design. T14 says "renders in each of the 7 locales" while its oracle is catalog parity — parity is necessary, not sufficient (memory `feedback_i18n_done_is_rendered_page_not_catalog_parity`); add one rendered check under a non-en locale to the Phase-D pixel review, or reword T14 to what parity proves.
5. **[D1 specificity — Step 1's `sort` prose.]** Step 1 Action says the prose "lists `POPULARITY`"; the scoping sentence — honoured by `POST /api/search/assets`; the legacy `/api/search` resolves the token and orders by status priority (its `else`, `ReactiveDataEntityRepositoryImpl:1027-1030`), the `my_data` precedent — lives only in R11 and §6(d). Carry it into Step 1 Action verbatim; note the legacy behaviour CHANGES for a client sending `sort=popularity` with a query (today an unknown token → relevance; after → status priority) — state it as intended. A one-case legacy test (200 + status-priority order) is cheap insurance; the `else` cannot throw, so optional.
6. **[D2 / record hygiene — revision residue, four contradictions + drift.]** (a) T3 still promises "(and rewrites the URL clean)" — R3 as reworded says no on-load rewrite exists (W4); (b) §6(d) lists the `SearchSortDto → AssetSearchCursor` / `resolveEffective` consumer twice — the pre-revision sentence was left in place after the new one was inserted; (c) §6(a)'s hook row, R6 and the key_link say the key is "the request minus `popularity`" while Step 5 strips `sort` too — one wording; (d) the `documentation@release/1.0.0` artifact row provides T13 only — add T15; (e) Step 3 does not name the `SearchSortValue` literal union (`searchUrlState.ts:118`) that must gain `'popularity'` (compile-caught, but name it) nor the stale "Most popular is intentionally NOT here" comment (`:113-114`) to delete; (f) cosmetic line drift carried from round 1: `Results.tsx :93/:101` (are :105/:113), `assetSearchFormDataToUrlState :456` (is :466), `SEARCH_SORT_OPTIONS :118-123` (is :113-131).
7. **[D5 context budget — W3 carried, with the second seam named.]** ~50 files / 13 steps / Step 2 = 10 files is over the letter of `plan-contract.md` §2; kept a warning on round 1's evidence (a decomposed leaf; G-C18 bars a horizontal split; ST-7/ST-8 precedent; commit per step; the FULL regression + coverage gate as DoD). The recording should offer GATE 1 every lever, not one: (i) one PR; (ii) two PRs by D1 (facet+histogram+URL+saved-search / sort+tile); (iii) three — facet+URL+saved-search (the control over the full rail, R6's own degraded mode) → histogram (endpoint + hook + bars + Step 10) → sort+tile. Each is user-observable; the issue's AC is met at the end of the train either way.

### Verified compliant this round (recorded so round 3 does not re-litigate)
- **D4:** phrase scan — 0 scope-reduction / class-extension phrases (the two hits are the `pending-merge` lane and the plan's own disclaimer). PLT-267 is a plain-language GATE-1 decision (D2) with its user-facing consequence, the paste-ready draft on disk, the scope comment posting only once the URL exists (G-C5 class-extension clause).
- **D6 system invariants after the plan:** D11 — `popularity` rides `AssetSearchFormData` (persisted via #1878), projected both ways, sanitised, locked by the extended D11 test; `sort=popularity` reapplies through `SEARCH_SORT_VALUES` (derived from `SEARCH_SORT_OPTIONS`, `searchUrlState.ts:133` — verified). D5 — every read is `popularity_score`. D9 — optional fields, a new POST, the legacy session's ORDER BY untouched. D12 — five canonical sorts; the browse-default fork left to #1861. D8 — the tile deep-links. `asset_kind` is `varchar(64)` (`V0_0_98:29`), so `DATA_ENTITY` < `QUERY_EXAMPLE` < `TERM` and R11's "every non-DE (score 0) sorts last" holds under the engine's `ASSET_KIND.asc(), ASSET_ID.desc()` tiebreak (`Impl:495-496`), which matches the index's trailing columns.
- **D3 wiring:** every artifact has a consumer step — the hook is called by `PopularityFilter` (Step 7), the control is rendered by `Filters.tsx` after Statuses (`:98` is the last `MultipleFilterItem` — verified), the endpoint has the hook as caller, the mirror merge (Step 4), the projection + sanitiser (Steps 2/3), the tile link (Step 8), the cursor (Step 2). Clear All rebuilds from `{query, facets:{}, sort}` (`Filters.tsx:37-42` — verified) so the range drops with no code, as the plan says.
- **D7 buckets:** unit (Testcontainers + web + vitest) and a mandatory IT-156 with a FOIL per case; the CHANGED tests assert more truth with a named SoT and a surviving RED (G-C15).
- **D8:** (1)/(2) → GATE-1 D1/D2; (3)/(4) RESOLVED with source + measurement.
- **D9:** no absolute paths, no `export`, no `git add -A` (only its prohibition); branch `git switch -c`, no upstream (LSN-038); `Part of #1861`, never `Closes`; ASCII scope comments; the bot never files. Free ids re-confirmed: `IT-156`, `DOC-527`, `PLT-267`.
- **D10:** no migration, no auth posture, additive contract — no G-C7 stop; `adr_required: false` correct.

### Recommendation
1 blocker → return to the planner: add the zero-band disabled state (R8 / Step 7 / T8 / one vitest case / a 13th key ×7), fold the one-line warnings (W-A `nullsLast()`, W-B the contract sentence + two test cases + `{}` ≡ absent, W-C the `view_count` seed + relative-order oracle, W-D the catalogs in Step 7, W-E the scoping prose in Step 1, W-F the four residues), name the three seams under W3 — and re-check (loop 3 of ≤3). Nothing here is "too big to fix in plan"; no decompose / re-spec is warranted beyond the GATE-1 size choice already before the maintainer.
