---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-09-06
consulted_by: "maintainer-direct (/contribute CTRIB-067, odd-platform #1844 + #1832, ST-10 of #1825)"
consultation_question: "For the unified search's Recently-viewed datetime-range facet on the #1816 recently_viewed foundation — what is it called and what does the chip say, which control shape fits the rail, absolute instants or relative windows, the timezone rule and its one test, the default ordering and the panel's 'View all', the auth.type=DISABLED posture, cross-kind semantics, the empty-history state, and the unstated PO/SRE requirements?"
slug: recently-viewed-datetime-facet
confidence_overall: MEDIUM
feeds: [contributor/CTRIB-067.md]
prompt_version: odd-sme/0.1.0
---

# The Recently-viewed datetime facet: name, shape, instants, timezone, ordering, DISABLED posture (ST-10 / #1844 + #1832)

## TL;DR

The spec-critical answers are **HIGH** and come from ODD's own shipped code, not the market: the URL carries **absolute UTC
instants** (`viewed_after` / `viewed_before` — the API's own names; the Activity idiom + ADR D10 determinism); the user picks
**local calendar days** whose start/end-of-day instants are what gets shared; under `auth.type=DISABLED` the filter works on the
**shared bucket, labelled `(shared)` with the consequence tooltip** — the Favorites posture, never "empty" (the decomposition's AC
predates #1816 and is a GATE-1 correction); the filter is **cross-kind with no qualifier**; the panel's "View all" is honest only
as **filter + an explicit `Last viewed` sort**. Two MEDIUM calls: name the *dimension* **`Last viewed`** (the feature stays
"Recently Viewed" — the Popular→Popularity precedent), because "Recently viewed: before 1 Sep" contradicts itself; and ship
**preset links + the existing `AppDateRangePicker`**, not a slider. Market evidence is a **negative result**: no verified catalog
ships a date-range filter on personal recency. The load-bearing unstated requirement is privacy: identity from the session only;
a shared link re-resolves to the **recipient's** history.

## Question scope

Archetypes: **vocabulary** (Q1), **implicit-requirements** (Q2–Q4, Q6–Q9), **workflow/product** (Q5), **comparative** (Q1, Q3 —
negative). Out of scope: the SQL plan and perf-gate numbers; a relative-window URL grammar (Q3 defers it); ST-11's created/updated
facets beyond "build the date body once". Budget: 7 fetches — 5 usable, 2 recorded 404s (the `release/1.0.0` doc pages; **caller-quoted, not read by me**).

## Q1 — Vocabulary and what the user sees (MEDIUM on the word; HIGH on the grammar constraint)

**ODD's shipped vocabulary.** Feature/panel: "Recently Viewed" / "Recently Viewed (shared)" (`en.json:649-650`, `RecentlyViewedColumn.tsx:44`);
API tag `recently_viewed`, whose list endpoint says its bounds "filter by when the asset was **last opened** — the data source for
the unified Search recency filter" and "Only assets **last viewed** at or after this instant (UTC)" (`openapi.yaml:615-616,628`);
column `last_viewed_at`; the design doc's datetime family "Created, Updated, Last-ingested, Recently-viewed" and `last_viewed`
(`SEARCH-CAPABILITIES-DESIGN.md:25,54`). The live manual (0.28.x) has no Recently-viewed — ABSENT on catalog-overview, verified
2026-09-05 (`2026-09-05-popular-range-facet-histogram.md`).

**Recommendation — heading `Last viewed`; feature name unchanged.** ST-9 split *feature* ("Popular" tile) from *dimension*
("Popularity" facet, `PopularityFilter.tsx:119`); do the same. A range has a before-shape, and "Recently viewed: before 1 Sep" is
self-contradictory while "Last viewed: before 1 Sep" reads correctly; it also sits in the datetime family ST-11 adds (Created /
Updated / Last viewed). Log the pair in the manual's Terms & Aliases (Gate 2). Fallback for zero churn: "Recently viewed",
accepting the wobble. **Qualifier** (the shell's slot, `RangeFacetFilter.tsx:28`): `Assets you have opened` — it says *whose*
views, which "Last viewed" alone does not (Popularity is everyone's views; this is yours).

**Chip grammar** — conform to `Popularity: 15 – 62 views` (`PopularityFilter.tsx:98-104`); dates via the locale formatter (the
ST-9 rule for numbers, `:58-61`), never string-built: `Last viewed: any time` (on, no bounds — the panel's View all state) ·
`Last viewed: since 30 Aug 2026` · `Last viewed: 1 – 5 Sep 2026` · `Last viewed: before 1 Sep 2026`. **DISABLED:** heading
`Last viewed (shared)` + the info icon carrying the Favorites sentence shape (`en.json:657`): *"Authentication is disabled, so
viewing history is shared by everyone on this instance. Don't use disabled auth in production."*

**Competitors (negative result).** DataHub search: "no date/recency filter and no recently-viewed list is documented" — its filters
are Platform / Tags / Terms / Domain / Owners / Entity Type / Subtype / Environment / soft-deleted (200). Secoda: sorts "Relevance,
Popularity, Last modified and Date created"; "Resources gain additional boost points if the current user has recently interacted
with them" — recency is a **ranking boost**, no date-range or recently-viewed filter (200). Google Drive: `before:` / `after:`
(modified), `createdbefore:` / `createdafter:`, "Format the date as YYYY-MM-DD" (200). Nobody verified ships a date **range** on
personal recency: an ODD differentiator — build it plain.

## Q2 — Control shape (MEDIUM-HIGH: (a) presets + the existing picker)

**Not a slider.** NN/g: "whenever the exact value matters, sliders are not okay" (gui-slider-controls, cited 2026-09-05); a user
wants *last Tuesday*. A 90-day TTL would also mean up to 90 stops on a ~200 px rail. NN/g on dates: "Calendar pickers are
especially useful for selecting a date range. In those situations, they often display two months side by side" and "should be
used for events close to the present time — within less than a year" (date-input, 200) — history is bounded to 90 days
(`application.yml:176`), squarely the calendar case. **Reuse the platform's one date-range control:** `AppDateRangePicker` — two
months, `portal`-rendered, footer presets + Done (`AppDateRangePicker.tsx:90-104`), local start/end-of-day (`:52`), driving the
Activity/Alerts "Period" filter (`CalendarFilter.tsx:53-59`). `portal` is what fits the rail: the rail holds label + trigger.

**Shape (a):** rail-level preset links in the shell's presets row (the `Never viewed` idiom, `RangeFacetFilter.tsx:173-185`):
**Today · Last 7 days · Last 30 days · Any time**, plus the picker for a custom range. "Any time" = on-with-no-bounds (the
panel's View all). No "Last 90 days": under the default TTL it equals Any time. **Share the shell's chrome, not its slider** —
heading + qualifier + help + presets + chip + `disabledReason` are reusable; the stops/slider body is not (`:32-37,49-58`). Make
the rail body a slot (slider for Popularity; picker for Last viewed and ST-11's Created/Updated) — one chrome, the date body built
once. **One divergence to encode explicitly:** the shell treats both-handles-at-the-ends as *no filter* (`:56-58`); for recency,
*on with no bounds* is a real state ("in my history") and needs an explicit ON representation (Q3).

**Counts, histogram.** Preset counts are a cheap SHOULD — ≤200 rows per user (`application.yml:177`), one indexed query over the
other filters minus this facet (the exclude-own-facet rule, 2026-09-05 Q4); they pre-empt the empty-window surprise (Q8-b). A
histogram is **not** worth it: ST-9's bars rendered an aggregate the slider needed for its rail bounds; here there is no rail.

**Class extension the slice inherits (LSN-042 G-C5):** the picker's footer presets are hardcoded English — `'3 Day'`, `'1 Week'`,
`'2 Week'`, `'1 Month'` are string literals, not `t()` (`AppDateRangePicker.tsx:30-47`; only `Done` is translated,
`AppDateRangePickerFooter.tsx:43`) — and `format='D MMM'` renders month names whose locale I did not verify. A third consumer
extends that class: fix in-slice (`t()` + 4 keys × 7 locales) or make it a plain-language GATE-1 line — never "pre-existing".

## Q3 — Absolute instants, not relative windows (HIGH on absolute; MEDIUM on deferring relative)

- **ODD's idiom is absolute.** Period writes `beginDate`/`endDate` as epoch millis (`CalendarFilter.tsx:42-51`); its presets are
  computed against `new Date()` and written as concrete instants (`AppDateRangePicker.tsx:30-47`); every search param today is a
  concrete value (`searchUrlState.ts`). ADR D10: a param URL "re-runs deterministically" (`unified-asset-search.md:75`); D11
  stores that same spec (`:78-79`).
- **The two verified grammars are absolute.** GitHub: "Date formatting must follow the ISO8601 standard", "optional time
  information `THH:MM:SS+00:00` … and a UTC offset", `..` ranges (200). Drive: `after:YYYY-MM-DD` (200).
- **"What I opened last week", saved or shared:** the spec is a *snapshot of instants*; the name is the user's. Make the freeze
  **visible**: after a preset click the chip shows the resolved dates (`Last viewed: 30 Aug – 6 Sep 2026`), never the preset's
  name — the honesty rule ST-9 applies to the clamped band (`searchUrlState.ts:100-101`). Relative windows (`viewed_within=7d`)
  are an additive later param (D9-safe): log on disk, do not build here.
- **Params:** reuse the API's names — `viewed_after` / `viewed_before` as ISO-8601 instants **canonicalised to UTC `Z`** on
  write, so a control-written URL, the mirror's rewrite and the stored spec are byte-identical (the `Search.tsx` equality-guard
  requirement, `searchUrlState.ts:233-237`). ON-with-no-bounds needs its own token (suggest `viewed=yes`, the `favorites=yes`
  idiom, `:74-83`); any valid bound implies ON; the serialiser writes the token only when no bound is present. Wire: a
  `RecentlyViewedRange` beside `PopularityRange` whose **presence = ON** — the opposite of PopularityRange's "an empty object …
  is the same as absent" (`components.yaml:507-508`); state it in both descriptions so it is a decision, not drift (LSN-042 rule 2).

## Q4 — Timezone: the rule and the one test (HIGH)

**Rule:** the user picks calendar days in the browser's zone; bounds are local `startOfDay` / `endOfDay` (`AppDateRangePicker.tsx:52`)
as instants; the server normalises any offset to UTC (`DateTimeUtil.mapUTCDateTime` → `atZoneSameInstant(UTC)`,
`DateTimeUtil.java:15-20`) and compares **inclusively** (`>=` / `<=`, `ReactiveRecentlyViewedRepositoryImpl.java:110-115`) against
`last_viewed_at`, written in UTC (`generateNow()`, `DateTimeUtil.java:11-13`; `timestamp without time zone` at UTC, PRD-0001
`:213,:243`). A recipient in another zone gets the **same instants**; their chip renders them in *their* zone, so day labels may
differ by one. **Never emit a bare date** (`2026-09-01` is zone-ambiguous — GitHub's grammar carries the offset for this reason;
NN/g: date fields "are culture dependent"). Tell the user one sentence (tooltip + doc): *"Dates are your local calendar days. A
shared link carries the exact moments, which another time zone may show as different days."*

**The one test (integration, two browser contexts):** context A at UTC+14 picks *1 Sep 2026* → URL carries
`viewed_after=2026-08-31T10:00:00Z`; a row at `last_viewed_at = 2026-08-31 10:00:00` is **included**, `09:59:59` **excluded**;
the same URL in context B at UTC shows the chip as *31 Aug – …* and returns the **identical** rows. Add a DST-transition day as a
second case (the bounds legitimately carry different offsets). Playwright's per-context timezone option is the mechanism —
**verify its name; not fetched**.

## Q5 — Ordering and the panel's "View all" (HIGH on the shape; MEDIUM on the auto-default)

Shipped: sort tokens relevance / status_priority / updated_at / name / popularity — **no recency sort** (`searchUrlState.ts:149-154`).
The panel is `ORDER BY last_viewed_at DESC, id DESC` (`ReactiveRecentlyViewedRepositoryImpl.java:83`; PRD-0001 `:20`). The Popular
tile links `sort=popularity&popularity_min=1` (`OwnerEntitiesList.tsx:92-104`) because a filter reproduces a threshold, not an
order; the Favorites tile links `favorites=yes` **only** (`FavoritesColumn.tsx:27`) — the "Recently favorited" sort recommended
on 2026-08-30 did not ship, so that list lands in status-priority order. ST-10 follows the ST-9 shape.

1. **Add the named sort `last_viewed`** ("Last viewed", newest first — the design doc's default reading of a datetime column,
   "DESC NULLS LAST … the default (consumer 'freshest first')", `SEARCH-CAPABILITIES-DESIGN.md:59`; `id` tiebreaker). Offer it
   **only while the recency filter is active** in 1.0.0: on, it is an inner join over ≤200 rows per user; off, a LEFT JOIN over
   the whole index with a nulls-last tail — real, not this slice.
2. **Default while active, no query, no explicit sort → `last_viewed`.** `defaultSortForContext` (`searchUrlState.ts:181-189`)
   learns a third context so the dropdown *displays* the active default (PLT-254 still open). With a text query, relevance still
   wins (the shipped rule). A recency list in status-priority order cannot be read as "what I opened last week".
3. **View all = `viewed=yes&sort=last_viewed`** — explicit even though the default would produce it: the URL says what it means
   and survives a default change. Conform to `viewAllTo` + `buildSearchLink` (`OwnerEntitiesList.tsx:104`, `DataEntityList.tsx:22,82`);
   the column today says "there is no 'View all' yet" (`RecentlyViewedColumn.tsx:24-25`). The list is the tile, continued.

## Q6 — `auth.type=DISABLED` posture (HIGH: the Favorites posture, never "empty")

Under DISABLED the resolver returns the `(__shared__, DISABLED)` sentinel (`CurrentUserIdentityResolver.java:21-28`), so the shared
bucket **exists and fills** from everyone's opens; the panel renders it as "Recently Viewed (shared)" (`RecentlyViewedColumn.tsx:32,44`;
PRD-0001 decision 2, `:335`). Favorites' filter works on the same bucket with label + consequence tooltip (`FavoritesFilter.tsx:70-87`);
My data hides itself only because "nobody on this deployment can ever use the filter" (`MyDataFilter.tsx:87-90`) — the hide-vs-
disable rule (`2026-08-30-my-data-scope-filter.md` Q6). The decomposition's AC "empty under `auth.type=DISABLED`"
(`search-overhaul-decomposition.md:160`, 2026-06-30) predates #1816's decision; an empty filter deep-linked from a five-row shared
panel is the tile↔list contradiction ST-9 Q5 ruled out. **Correct the AC at GATE 1 as a plain-language line** (LSN-042 rule 7).
Copy: heading `Last viewed (shared)`, qualifier `Assets anyone has opened`, tooltip per Q1. No new exposure: the shared bucket
"exposes no data the anonymous catalog + Popular don't already expose" (PRD-0001 §6.3 `:179`). The PRD's `recently-viewed.enabled`
hide switch (`:181,:335`) is **not** in `application.yml` (grep: only the two TTL keys) — no operator kill-switch to honour.

## Q7 — Cross-kind (HIGH)

`recently_viewed` keys on the polymorphic `(asset_kind, asset_id)` — DE, Term, Query Example (`RecentlyViewedController.java:24`;
`RecentlyViewedColumn.tsx:51-52`). The favorites join is the precedent: an EXISTS on the same pair, "Applies uniformly to every
asset kind" (`ReactiveAssetSearchRepositoryImpl.java:455-463`; `components.yaml:489-490`). A Term absent from my history is truly
*unopened by me* — unlike Popularity, where Terms are *uncounted* — so **no exclusion and no `Data entities only` qualifier**;
nothing in the rail's vocabulary implies a kind restriction (the only DE-only qualifier is Popularity's, `PopularityFilter.tsx:121`;
the only exclusion sentence is My data's, `MyDataFilter.tsx:145`). Disclose two shipped interactions this slice does not change:
the DE-only facets (Datasource / Statuses / Groups / Type) still exclude Terms and Query Examples outright when combined
(condition (7), `ReactiveAssetSearchRepositoryImpl.java:361`), and a Popularity range makes the list DE-only by its own semantics.
The Asset-type facet keeps counting Terms / Query Examples *within the history*; preset counts (Q2) are cross-kind.

## Q8 — The empty-history states (HIGH: two states, never the generic "No results")

- **(a) No history for this identity** (deep link or manual toggle): the result area shows the panel's teaching family —
  *"You haven't opened any assets yet. Assets you open will appear here."* (`en.json:652` is the shipped half; the Favorites
  teaching-empty precedent) — and the control renders **disabled with that reason** (`PopularityFilter.tsx:85-94`) while an
  existing chip stays clearable (`RangeFacetFilter.tsx:60-63`).
- **(b) History exists, nothing in the window / other filters:** *"Nothing you opened matches this range."* + the chip; preset
  counts pre-empt it. Under DISABLED the same sentences hold ("you" includes you); no third key.
- **Per-result transparency:** while active, each row shows *when* it was opened (`RecentlyViewedTag` with `showTimestamp`,
  `RecentlyViewedColumn.tsx:82-86`); the manual frames per-result transparency as a search principle (`search.md:51`).
- **Removed entry:** the per-row remove is a hard DELETE (`ReactiveRecentlyViewedRepositoryImpl.java:45-54`) → the row leaves the
  filtered list and the panel at once; re-opening re-records move-to-top (`:28-43`). Test both.

## Q9 — Unstated load-bearing requirements (PO / SRE)

1. **Privacy — identity from the session, never the URL** (HIGH). "Identity is taken from the security context only — never the
   internal Owner, never a request parameter — so a user can only ever read or write their own bucket"
   (`CurrentUserIdentityResolver.java:12-13`; the search join likewise, `ReactiveAssetSearchRepositoryImpl.java:453`). A shared link
   is "a query spec run as the recipient" (ADR D11, `unified-asset-search.md:80`): **it shows the recipient their own history, never
   the sender's** — say it in the doc in those words. The URL carries instants only — no username, no asset ids ("URLs leak via
   history / server logs / Referer", `:105`). Test: two identities, one URL, disjoint results (the favorites test shape).
2. **Retention bound is visible** (MEDIUM-HIGH). The filter sees only what housekeeping kept: TTL `recently_viewed_days: 90` +
   newest `recently_viewed_max_per_user: 200` (`application.yml:176-177`; `RecentlyViewedHousekeepingJob.java:17-24`). "Since 1 Jan"
   silently returns nothing older than the TTL. Expose the two values (non-sensitive operator config — `/api/info` or the facet
   response) so the tooltip reads *"History is kept for {{days}} days and up to {{n}} assets per user"* per deployment; **never
   hardcode 90/200 in the UI** — an operator who tunes them would read a lie. The doc caveat links housekeeping, not duplicates it.
3. **Fail closed** (HIGH). Junk `viewed_after`, a non-ISO string, a repeated param → drop the **whole** dimension (the popularity
   rule, `searchUrlState.ts:98-102`); inverted `after > before` → dropped on the FE, empty on the server ("a malformed spec →
   empty, never a 500", `unified-asset-search.md:105`). Verify what Spring does with an unparseable `date-time` on
   `/api/search/assets` — a 500 there is a defect; I did not exercise the existing `/api/recently-viewed/list` binding with junk.
4. **Saved-search round-trip in-slice** (HIGH, LSN-042 G-C5): the dimension lives on `AssetSearchFormData`, is stored by
   `SavedSearch`, and the PLT-256 deep-equality test is extended — instants compared canonically (UTC `Z`).
5. **No write on read** (HIGH). Search reads `recently_viewed`; it never records (the view-count hotspot lesson,
   `2026-06-26-favorites-recently-viewed-prd.md` Q5). Recording stays on the detail-page open.
6. **Index + one semi-join** (MEDIUM). The favorites plan drives from the partial identity index ("Nested Loop semi-join, 5.9 ms",
   `ReactiveAssetSearchRepositoryImpl.java:436-440`); PRD-0001 proposed `(oidc_username, provider, last_viewed_at DESC)` (`:248`) —
   confirm it exists; it serves the range and the sort. Orphans are dropped by the resolver's semi-join
   (`RecentlyViewedHousekeepingJob.java:22-24`); preset counts must use the **same** semi-join as the list, or count 3 / list 2.
7. **i18n × 7** (`br ch en es fr hy ua`): heading, qualifier ×2, tooltip ×2, four presets, four chip shapes, two empty states, the
   sort option — plus the inherited picker presets (Q2). **Accessibility** (LOW, verify): the picker's keyboard/ARIA is unverified;
   NN/g: "allow users to type the date even if other input methods are available" — the shipped picker renders an icon trigger
   only (`AppDateRangePicker.tsx:99`). Log it. **Client clock** (note): "Today" is computed on the client clock, as Activity's presets are.

## Operator workflows this facet serves

**Re-find a known asset / daily re-navigation** (named 2026-06-26): "the table I had open this morning" → *Today*. **Diagnose a
stale dashboard** (Rule-4 seed): last week's investigation tables → *Last 7 days* + Datasource. **Trace blast radius before a schema
change**: everything inspected during the review → a custom range + Asset type. **Continue the home tile**: View all → the same list, longer (Q5).

## Recommended framing for the caller

*"`Last viewed` is a personal, cross-kind datetime-range facet over the caller's own `recently_viewed` history: local calendar days
become absolute UTC instants in the URL (`viewed_after` / `viewed_before`, plus an explicit on-with-no-bounds token), shown as
preset links + the existing two-month picker inside the shared facet chrome; it defaults to a new `Last viewed` sort while active,
works on the shared bucket under DISABLED labelled `(shared)` with the consequence tooltip, re-resolves a shared link to the
recipient's history, sees only what the 90-day / 200-row retention kept and says so, and the panel's 'View all' opens
`viewed=yes&sort=last_viewed` — the tile, continued."*

## Caveats and uncertainty

- **The 1.0.0-train doc pages were not read by me**: both `raw.githubusercontent.com/…/release/1.0.0/…` fetches returned **404**;
  the local `../documentation` tree is 0.28.x (no `recently-viewed.md`). Train text is caller-quoted (#1832's "most-recent-first").
  Unblock: `git show origin/release/1.0.0:docs/data-discovery/recently-viewed.md` before quoting the manual in the PR body.
- **Market side is a negative result** (LOW as evidence of a pattern). Google Drive's UI presets are **not** on the fetched help
  page (operators only); NN/g's date article does not address relative presets or time zones — so Q2's preset list and Q3's
  "defer relative" are product judgment. **Playwright's timezone option, Spring's junk-`date-time` binding, the picker's locale/ARIA,
  and the migration's index** are named as tests, not claims. **Q1's word is MEDIUM**; **Q5's auto-default is a product call.**

## Citations

**Live URLs (fetched 2026-09-06):** `raw.githubusercontent.com/opendatadiscovery/documentation/release/1.0.0/docs/data-discovery/recently-viewed.md`
— **404** · same path `…/catalog-overview.md` — **404** · `docs.datahub.com/docs/how/search` — 200 · `docs.secoda.co/features/search` — 200 ·
`docs.github.com/en/search-github/getting-started-with-searching-on-github/understanding-the-search-syntax` — 200 ·
`support.google.com/drive/answer/2375114` — 200 · `nngroup.com/articles/date-input/` — 200 (Li, 2017-01-22). Line-level citations are inline above.
**Repo (odd-platform main @ 0238005c):** `odd-platform-ui/src/components/Search/Filters/{FilterItem/RangeFacetFilter,PopularityFilter,FavoritesFilter,MyDataFilter}/*.tsx`,
`src/lib/search/searchUrlState.ts`, `src/components/shared/elements/AppDateRangePicker/**`, `…/Activity/ActivityFilterItems/CalendarFilter/CalendarFilter.tsx`,
`src/components/Overview/OwnerAssociation/OwnerEntitiesList/{RecentlyViewedColumn,FavoritesColumn,DataEntityList}/*.tsx` + `OwnerEntitiesList.tsx`,
`src/locales/translations/*.json` (7) · `odd-platform-api/…/{auth/CurrentUserIdentityResolver,controller/RecentlyViewedController,repository/reactive/ReactiveRecentlyViewedRepositoryImpl,repository/reactive/ReactiveAssetSearchRepositoryImpl,housekeeping/job/RecentlyViewedHousekeepingJob,service/ingestion/util/DateTimeUtil}.java`,
`src/main/resources/application.yml:174-177` · `odd-platform-specification/openapi.yaml:608-648`, `components.yaml:466-519`.
**Workspace:** `adrs/drafts/unified-asset-search.md` · `adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md:25,53-66,157` · `state/search-overhaul-decomposition.md:20,56,156-162`
· `prds/0001-favorites-and-recently-viewed.md` · `retrospectives/LSN-042-known-class-extended-and-deferred.md` · `documentation/docs/data-discovery/{catalog-overview.md:41-62,search.md:51}` (0.28.x) · `lineage/odd-platform/system-mission.md:77-104` · the four prior consults named inline.
