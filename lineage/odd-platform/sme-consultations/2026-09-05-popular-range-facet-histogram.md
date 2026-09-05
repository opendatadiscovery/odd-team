---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-09-05
consulted_by: "maintainer-direct (/contribute CTRIB-066, odd-platform #1843, ST-9 of #1825)"
consultation_question: "For the unified search's Popular numeric-range facet over the snapshotted popularity_score — what is it called and what does the user see, what happens to Terms/Query Examples, how is the 15-minute bucketed snapshot disclosed, what set does the histogram count and is it worth its cost, what should the Popular panel's 'View all' deep-link open, and what unstated requirements are load-bearing?"
slug: popular-range-facet-histogram
confidence_overall: MEDIUM
feeds: [contributor/CTRIB-066.md]
prompt_version: odd-sme/0.1.0
---

# The Popular range facet: naming, DE-scoping, staleness, histogram, and the panel deep-link (ST-9 / #1843)

## TL;DR

The two decision-critical answers are **HIGH** and come from ODD's own shipped rail, not from the market: (Q2) Terms and
Query Examples are **excluded outright** while the range is active, labelled with the same sentence shape the rail
already ships for My data; (Q5) the panel's "View all" is only honest if it **reproduces a ranking**, so **fold the
"Most popular" sort option (#1861 item 1, sort only — the browse-default fork stays out) into ST-9 and deep-link
`sort=popularity&popularity_min=1`**; a range-only link (C) betrays the panel and no link (B) fails the slice's own AC.
The market evidence is a **negative result**: no verified catalog ships a popularity **range facet** at all — Secoda ships
popularity as a **sort** with a disclosed 90-day window and 24-hour lag, DataHub ships usage as detail-page statistics
with no filter — so the slider is an ODD differentiator to build carefully, not table stakes. Show **view-count bands**
("15 – 30 views"), never the 0..20 score; the "histogram" is a ≤21-row aggregate you need anyway for the slider's rail
bounds, so bars are rendering, not a second cost. Two divergences between the LIVE panel and the SNAPSHOT facet
(within-band order; `exclude_from_search`) must be put to the maintainer, not discovered by him (LSN-042).

## Question scope

Archetypes: **vocabulary** (Q1), **implicit-requirements** (Q2, Q3, Q6), **plausibility + comparative** (Q1, Q4),
**workflow/product** (Q5). Out of scope: the aggregate's SQL plan and the perf gate's numbers; My/Global-Popular (P4);
the browse-default fork (#1861 item 2). Budget: 6 external fetches (5 usable; Amundsen redirected off-domain — recorded).

## Q1 — Naming and what the user sees

**Verified vocabulary.** ODD's live manual: "**Popular** — the most-viewed data entities across the catalog, ranked by
**view count** alone (highest first)" (catalog-overview, 200). Secoda: "sort by Relevance, **Popularity**, Last modified
and Date created"; "Popular resources … calculated by summing the **number of views** … over the last 90 days". DataHub:
"overall number of queries and distinct users" (usage, 200). Both verified systems expose the **measured quantity**;
neither exposes an internal score. `concepts.yaml:3226` names the ODD concept "Popular Entities Ranking".

**Recommendation — heading `Popularity`, unit `views`, qualifier `Data entities only`; chip `Popularity: 15 – 62 views`;
sort option `Most popular`.** The rail's headings are dimension nouns (Datasource / Type / Namespace / Owner / Tag /
Groups / Statuses — search page, 200); "Popularity" is the noun of the panel's adjective, so the panel→facet hop stays in
one word family while the unit carries the honesty the manual insists on ("a rough popularity hint" — same page). "Most
popular" is the name §1G of the design doc already lists for the sort (`SEARCH-CAPABILITIES-DESIGN.md:102`); no i18n key
exists for it yet (`en.json` grep: absent) — 7 locales. Fallback if the maintainer wants zero vocabulary churn: "Popular"
as heading, accepting the noun-convention break. *(Confidence: MEDIUM on the word; HIGH on unit-in-views.)*

**Bands, not the score — and exact boundaries.** The score is `least(20, floor(log2(view_count+1)))`
(`V0_0_100__snapshot_popularity_score.sql:14`), so bucket *b* is views `[2^b − 1, 2^(b+1) − 2]`: 0 · 1–2 · 3–6 · 7–14 ·
15–30 · 31–62 · 63–126 · 127–254 · 255–510 · 511–1,022 · 1,023–2,046 · … · ≥1,048,575. The slider therefore has **21
discrete snap stops**, each labelled with its band's lower bound in views. Labels must be the **exact** boundary,
locale-formatted (`1,023+`), never rounded (`1K+`): a 1,000-view entity is bucket 9 and would be excluded from a control
that says "1K+" — a contradiction a user can hit on the first try. *(HIGH — arithmetic on the shipped function.)*

**Slider vs simpler shape.** NN/g: "Use a slider only when the precise value won't matter to the user, but rather only
the approximate range" and "whenever the exact value matters, sliders are not okay" (gui-slider-controls, 200). A
21-band range is exactly the approximate case, so the dual-handle slider is legitimate — but with only 21 stops it *is*
a preset list rendered spatially, so it must **snap** (no false continuity) and render the selected bounds as text.
NN/g's motor-precision warning ("how challenging it would be to interact with a slider control for users with motor
difficulties") is the argument for a **keyboard path and one preset** — I recommend a single `Never viewed` quick-link
(= `[0,0]`), the steward's "find dead assets" view the design doc already names (`SEARCH-CAPABILITIES-DESIGN.md:77-78`),
because two handles at zero is the hardest slider gesture. Nothing more: subtract before you add. *(MEDIUM.)*

**Defaults and empty states (PO expectation).** (i) The rail spans the **observed** min..max non-empty band of the
currently-filtered DE set, not the theoretical 0..20 — on a catalog whose busiest table has 30 views, 16 of 21 stops
would be dead. (ii) When observed min == max (fresh install: everything at 0; tiny catalog: everything at 1–2), render
the control **disabled with the reason** — "All 42 data entities have 1 – 2 views" / "No views recorded yet" — per the
rule from my My-data consult: hide only when *no user of this deployment* can ever use it; a temporary blocker renders
disabled and names itself. A slider whose every position yields the same list is a dead control. *(MEDIUM, ODD-internal.)*

## Q2 — DE-scoped semantics (HIGH)

**Exclude outright + label.** This is the rail's shipped shape, not a new posture: the My-data condition is "NOT
kind-guarded-with-pass-through: a scope that says 'assets I own / next to mine' cannot be satisfied by a kind it does not
reach, so non-matching kinds are excluded OUTRIGHT (the condition-(7) shape)" (`ReactiveAssetSearchRepositoryImpl.java:320-324`);
the caller verified the DE-only facets (Datasource / Statuses / Groups / Type) do the same via condition (7). Non-DE rows
"have no view_count and keep 0" (`:119`). The two alternatives fail: **treat-as-0-view** would return every term and query
example under `Never viewed` — false, they are not *unviewed*, they are *uncounted*; **pass-through** widens the result for
two of three kinds while the chip promises narrowing — the exact "My Objects" defect my 2026-08-31 consult classed as a
correctness bug.

**Label.** Conform to the shipped sentence shape `en.json:682` — "Query examples have no owner, so they are excluded from
My data." → **"Terms and query examples have no view count, so they are excluded while a Popularity range is active."**
Render the short qualifier **`Data entities only`** under the heading and the full sentence in ODD's inline-help idiom
(`AppTooltip` + `InformationIcon`, per my Favorites consult §4.3). Implicit requirement carried over from My-data Q2: with
the range active, the Asset-type facet shows Term / Query Example at **0 with the reason**, not silently absent.

## Q3 — Snapshot staleness disclosure (HIGH on disclose; MEDIUM on wording)

**Cited precedent for disclosing both a window and a lag:** Secoda — "summing the number of views in Secoda over the last
90 days, with the number of views/queries extracted from the source 24 hours from the extraction" (200). DataHub's usage
page carries no freshness caveat (ABSENT — recorded). ODD's substrate: `@Scheduled(fixedRate = 15, timeUnit = MINUTES)`
(`AssetPopularitySnapshotJob.java:31`), bucketed. The user-visible symptom is a number they cannot reconcile: the General
panel shows 16 views (live) while `15+ views` omits the entity for up to 15 minutes — the "a number the user can't
explain" class. One tooltip sentence closes it:

> *"Based on each data entity's view count, grouped into ranges and refreshed every 15 minutes."*

**Doc caveat for the facet section — one paragraph, link the existing warning, do not duplicate it** (single canonical
source; the 8-line inflatability admonition already lives at catalog-overview#recommended and entity-detail-page):

> *Popularity ranges over each data entity's view count, grouped into bands (1–2, 3–6, 7–14, …) and refreshed every 15
> minutes — an entity's General-panel view count is live and can run ahead of the facet. Terms and query examples have no
> view count and are excluded while a range is active. View count is trivially inflatable; treat this facet as a rough
> usage hint, never as audit evidence — see the Popular column caveat.*

## Q4 — The histogram (MEDIUM; the functional argument is HIGH)

**Set: the currently-filtered set with every other filter applied and the popularity range itself removed** (the
"exclude own facet" rule — domain knowledge, no citation fetched). The functional argument stands on its own: if the bars
were computed *including* the range, dragging a handle would erase the bars outside the selection, and the user could no
longer see what they can slide back to; the rail bounds (Q1.i) would collapse to the selection. Whole-catalog is wrong the
other way — bars that ignore Datasource/Owner/etc. describe a list the user will not get.

**DE only: yes.** Every Term/QE holds 0 (`:119`); counting them puts the whole glossary into the `Never viewed` bar.

**Worth its cost? Reframe: you need the aggregate anyway.** With 21 fixed buckets the "histogram" is
`SELECT popularity_score, count(*) … GROUP BY 1` → ≤21 rows — the same aggregate that yields the rail's observed min/max
(Q1.i). Bars are a *rendering* of data the slider already requires, so the SHOULD costs nothing extra to fetch. Bound it
as the ADR demands ("bucketed + cached", `unified-asset-search.md:103`): a **separate request** from the results (results
never wait for it); **debounced** with the URL write (D10's ~400 ms); **server-cached** on the normalised spec-minus-
popularity with **TTL ≤ 15 min** (the distribution cannot legitimately move faster than the snapshot, bar ingestion
adds/deletes — acceptable, same class as the facet); a **time budget** — on miss return nothing and the FE renders the
slider **without bars over the 0..20 rail**. Plain-slider-with-bounds is the MUST; bars the SHOULD; blocking the results
on the aggregate is prohibited. No verified competitor shows a usage histogram (DataHub ABSENT, Secoda ABSENT) — polish,
not parity.

## Q5 — The Popular panel's "View all" (HIGH on A; MEDIUM on the threshold)

The panel is "ranked by view count alone (highest first)" (live, 200); the 1.0.0-train manual says "Popular has none,
because there is no catalog-search filter that reproduces a **view-count ranking**" (caller-quoted `catalog-overview.md:76`,
release/1.0.0 — not read by me). A ranking is a **sort**; a range facet cannot reproduce it.

| Option | What the user gets | What the operator loses |
|---|---|---|
| **A — sort + range** `sort=popularity&popularity_min=1` | "every viewed data entity, most viewed first" — the panel, continued | nothing; cost = one named sort option (index exists: `V0_0_100:60-66` was built so "#1861's 'Most popular' sort … seeks on it with no further migration") |
| B — facet only, no link | the panel stays the only column without View all | #6+ unreachable; a visibly inconsistent panel; **fails ST-9's own AC** "Rewire the Popular panel's 'See all'" (`search-overhaul-decomposition.md:151`) |
| C — range only, status-priority order | a list whose #1 most-viewed entity may sit on page 3 | trust — a deep link that does not resemble the tile it came from is worse than no link (my Favorites consult Q3 made the same call for "Recently favorited") |

**Recommendation: A.** Fold **#1861 item 1 only** (the `Most popular` dropdown entry + `popularity_score DESC` + id
tiebreaker, keyset-compatible) into ST-9; leave the browse-default fork in #1861. Put it to the maintainer as a plain
GATE-1 scope line, not a footnote (LSN-042 rule 1). Threshold: **`popularity_min=1`** is the only threshold that is
stable across catalogs and explainable in three words ("has been viewed"); it also makes the list DE-only through the
facet's own semantics (Q2) — without it, `sort=popularity` alone interleaves zero-view DEs with every Term/QE (all 0) in
the tail. Reject "the 5th entry's bucket" (drifts over time — bookmarks change meaning) and "≥ 15 views" (a small catalog
opens an **empty** list from a panel showing five tiles — a broken link). Accepted edge: on a catalog with zero views the
panel shows five arbitrary 0-view fillers while the link opens the teaching empty state — the honest divergence, gone at
the first view.

**Two panel↔facet divergences the maintainer must decide, not discover:** (1) the panel is **live, exact** view_count;
the sort is the **15-min band** — two entities at 40 and 60 views share bucket 5, so the search orders them by tiebreaker
while the panel shows 60 then 40: "View all" will not reproduce within-band order. (2) The panel ignores
`exclude_from_search` ("Popular is the sole list-shape that ignores it", `concepts.yaml:3255`) while the unified search
honours it (`ReactiveAssetSearchRepositoryImpl.java:294`) — a tile can vanish on click-through. The converging fix is
**one definition of popular: point the panel at the snapshot** (it also retires "No index on data_entity.view_count —
every Popular page render is sequential scan + in-memory sort", `concepts.yaml:3262`). If that is out of slice, disclose
both in the doc section and file the convergence — with the GitHub URL in hand at GATE 1, per LSN-042 rule 1.

## Q6 — Prohibitions and implicit requirements the issue does not state

1. **Fail closed on a garbage URL** — `popularity_min=abc`, `min > max`, values outside 0..20: **empty result + a visible
   invalid-filter state, never a 500, never silent coercion** (the ADR's rule: "a malformed spec → empty, never a 500",
   `unified-asset-search.md:105`). Clamping `max=99` to 20 would make the chip lie about the spec that ran. *(HIGH.)*
2. **Saved-search round-trip is in-slice** (LSN-042, G-C5 class-extension clause): `popularity_min/max` live on the spec
   `SavedSearch` stores (`AssetSearchFormData`, #1878 — caller-verified) and the PLT-256 deep-equality round-trip test is
   **extended** for the two new params before review. The deep link (Q5) is a third representation of the same state —
   LSN-042's forcing question applies to it verbatim. *(HIGH.)*
3. **Global, not personal — say it by placement, not by suffix.** Popularity "returns popular entities across all owners;
   no per-user/per-tenant filter" (`concepts.yaml:3250`). Place the facet among the global facets, **not** in the personal
   scope group; do **not** use the `(shared)` suffix (`en.json:648,650`) — in ODD it marks a personal feature degraded under
   `auth.type=DISABLED`, and this facet never degrades (no identity needed). One doc sentence: "Popularity is catalog-wide —
   the same for every user — unlike Favorites and My data." Cross-tenant visibility is inherited, not new (`:3257`). *(HIGH.)*
4. **Pin the band boundaries with a test.** The SQL computes `floor(ln(v+1)/ln(2))` (`V0_0_100:37`), a floating-point
   ratio, not an exact integer log2; every label in Q1 depends on `bucket(2^b − 1) = b` and `bucket(2^(b+1) − 2) = b` for
   b = 0..20 holding exactly at the powers of two. I could not run it this session — **run it**; if any boundary is off by
   one, switch to an exact integer form rather than adjust the labels. *(MEDIUM — engineering judgment, unverified.)*
5. **Never touch the live counter.** Facet, histogram and sort read `popularity_score` only; no query-time join to
   `data_entity.view_count` (D5's whole point; `unified-asset-search.md:59`). *(HIGH.)*
6. **Accessibility.** `@mui/material ^5.14.19` is the component library (`package.json:45`) and **no `Slider` is used
   anywhere in `src` today** (grep: 0 files) — reuse MUI's Slider, do not hand-roll; keyboard operation (arrows, Home/End)
   and an `aria-valuetext` that speaks the **band in views**, not the score, are the acceptance lines. Specific ARIA
   semantics not fetched — verify against the WAI-ARIA multi-thumb slider pattern. *(Requirement HIGH; details LOW.)*
7. **Chip text**, conforming to the existing chip component: `Popularity: 15 – 62 views` · `Popularity: 1,023+ views` ·
   `Popularity: never viewed` (`[0,0]`) · `Popularity: up to 6 views` (`[0,2]`); numbers via the locale formatter,
   never string-built. Removing the chip = absent (no filter). *(MEDIUM.)*
8. **i18n ×7** — labels, the exclusion sentence, the tooltip, the disabled-state reasons, the sort option.

## Operator workflows this facet serves

- **Audit data quality / hygiene across a domain** (steward): Statuses + Owner + `Never viewed` → deprecation candidates —
  the §1D "find unused/dead assets" view; the histogram's mass at zero is the first thing this user reads.
- **Discover a dataset for a new analysis** (analyst): Datasource + `63+ views` sorted `Most popular` → the go-to table.
- **Continue the home tile** (any user): Popular → View all → the same list, longer (Q5).

## Recommended framing for the caller

*"`Popularity` is a catalog-wide, data-entities-only range facet over the 15-minute popularity snapshot, shown to the
user as exact view-count bands on a 21-stop dual-handle slider whose rail and bars derive from one ≤21-row aggregate over
the currently-filtered set minus itself; Terms and Query Examples are excluded with a visible reason; the Popular tile's
'View all' opens `sort=popularity&popularity_min=1` — which requires the `Most popular` sort option to ship in this
slice — and the two live-vs-snapshot divergences are a GATE-1 decision."*

## Caveats and uncertainty

- **Market side is a negative result (LOW as evidence of a pattern).** No verified page shows a popularity *range facet*;
  Amundsen was unreachable (`https://www.amundsen.io/amundsen/` → `301` to `https://marketreport.io/amundsen/`, an
  off-domain redirect I did not follow; the 2026-06-30 consult recorded a TLS error on the same host). Unblock: the
  Amundsen GitHub README; a Select Star popularity page.
- **"Exclude own facet" (Q4) and the ARIA specifics (Q6.6) are uncited** — functional argument and engineering judgment.
- **`catalog-overview.md:76` on release/1.0.0 was not read by me** (the live page is 0.28.x: "there is no per-column 'view
  more' affordance" for all four columns). The caller's quote is used as given.
- **Boundary exactness (Q6.4) is unverified** — a test, not a claim.
- **Adjacent consult worth booking:** the shared range-widget shell for the datetime facets (#1844/#1845) — open-ended
  ranges and NULLS (design doc §1B) change the rail/bounds model in ways a 21-stop integer slider never meets.

## Per-question recommendation table

| Q | Recommendation | Confidence |
|---|---|---|
| Q1 | Heading `Popularity`, unit `views`, qualifier `Data entities only`; 21 snap stops labelled with **exact** lower bounds; one `Never viewed` preset; rail = observed min..max; disabled-with-reason when min == max | MEDIUM (word) / HIGH (bands) |
| Q2 | Exclude Terms/QEs outright; "Terms and query examples have no view count, so they are excluded while a Popularity range is active."; Asset-type shows them at 0 with the reason | HIGH |
| Q3 | Tooltip "grouped into ranges and refreshed every 15 minutes"; one-paragraph doc caveat linking (not duplicating) the inflatability warning | HIGH / MEDIUM wording |
| Q4 | Currently-filtered set minus the popularity range, DE only; one ≤21-row aggregate feeds rail + bars; separate, debounced, TTL ≤ 15 min, time-budgeted, never blocks results; bars SHOULD | MEDIUM (rule) / HIGH (function) |
| Q5 | **A** — fold #1861's sort option (not the default fork) into ST-9; link `sort=popularity&popularity_min=1`; put the two live-vs-snapshot divergences to GATE 1; converge the panel onto the snapshot | HIGH (A) / MEDIUM (min=1) |
| Q6 | Fail closed; saved-search round-trip in-slice with the PLT-256 test extended; global-by-placement, no `(shared)`; pin band boundaries; snapshot-only reads; MUI Slider + keyboard + `aria-valuetext` in views; chip grammar; i18n ×7 | HIGH except boundaries/ARIA (MEDIUM/LOW) |

## Citations

**Live URLs (fetched 2026-09-05):**

| URL | Status | Supports |
|---|---|---|
| `https://docs.opendatadiscovery.org/features/data-discovery/search` | 200 | seven facets (nouns); sort ABSENT; range/slider/histogram ABSENT; "as of 0.28.0" ×3 (page = released 0.28.x); "The Catalog Overview's **Popular** and **Recommended** tiles read from the same counter"; heading "Result-class tabs" (stale vs 1.0.0) |
| `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` | 200 | "**Popular** — the most-viewed data entities across the catalog, ranked by view count alone (highest first)"; "treat it as a rough popularity hint, not a trustworthy signal"; "there is no per-column 'view more' affordance and no per-column sort or filter"; Favorites / Recently viewed ABSENT |
| `https://docs.datahub.com/docs/features/dataset-usage-and-query-history` | 200 | "top queries which referenced a dataset", "top users who probably know the most about the dataset", "overall number of queries and distinct users", "column level usage"; ranking influence ABSENT; popularity filter ABSENT; histogram ABSENT; freshness caveat ABSENT |
| `https://www.amundsen.io/amundsen/` | **301 → `https://marketreport.io/amundsen/`** | not followed (off-domain); no claim made |
| `https://docs.secoda.co/features/search` | 200 | "sort by Relevance, Popularity, Last modified and Date created"; "Popular resources in Secoda are calculated by summing the number of views in Secoda over the last 90 days, with the number of views/queries extracted from the source 24 hours from the extraction"; range/slider ABSENT |
| `https://www.nngroup.com/articles/gui-slider-controls/` | 200 | Harley 2015: "Use a slider only when the precise value won't matter to the user, but rather only the approximate range"; "whenever the exact value matters, sliders are not okay"; motor-difficulty caution; dual-handle / histogram / price guidance ABSENT |

**Workspace / repo sources (read 2026-09-05):**

- `odd-platform` `V0_0_100__snapshot_popularity_score.sql:14,30-37,47,54,60-66,70` — log2 band; `ln/ln(2)` body; column default 0; index built for #1861's sort
- `odd-platform` `AssetPopularitySnapshotJob.java:21,28,31` — `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)`
- `odd-platform` `ReactiveAssetSearchRepositoryImpl.java:116-130` (refresh: DE rows only, non-DE keep 0) · `:287-298` (kind-guarded eligibility incl. `EXCLUDE_FROM_SEARCH` at `:294`) · `:320-324` ("excluded OUTRIGHT (the condition-(7) shape)")
- `odd-platform-ui` `src/locales/translations/en.json:230-232` (Relevance / Status priority / Recently updated; "Most popular" absent) · `:648,650` (`(shared)` idiom) · `:677` ("My data") · `:682` (the exclusion sentence) · `:691-692` ("Favorites only")
- `odd-platform-ui` `package.json:45` (`@mui/material ^5.14.19`); grep for `Slider` imports under `src` → 0 files
- `adrs/drafts/unified-asset-search.md:48,58-59` (D3/D5) · `:67-68` (D8) · `:73-81` (D10/D11) · `:103-105` (perf / UX / security bar; "malformed spec → empty, never a 500")
- `adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md:76-81` (§1D) · `:90-96` (§1F) · `:98-106` (§1G, "Most popular") · `:139-144` (D5 correction) · `:153-159` (§4)
- `state/search-overhaul-decomposition.md:148-154` (ST-9 slice text) · `:114-116` (ST-5c substrate) · `:199` (My/Global-Popular → P4)
- `lineage/odd-platform/concepts.yaml:3226-3265` ("Popular Entities Ranking": cross-owner `:3250`; `EXCLUDE_FROM_SEARCH` ignored `:3255`; cross-tenant `:3257`; no view_count index `:3262`)
- `documentation/docs/data-discovery/catalog-overview.md:45,52,57,62,65` · `search.md:104-106` · `entity-detail-page.md:47-49` (local working tree = 0.28.x text; the release/1.0.0 `:76` line is caller-quoted)
- `retrospectives/LSN-042-known-class-extended-and-deferred.md` (rules 1-3, 7; the forcing question)
- Prior consults kept consistent: `2026-08-30-favorites-tab-to-filter-ia.md` (Q1 condition, Q3 ordering, §4.3 inline-help idiom) · `2026-08-30-my-data-scope-filter.md` (Q2 exclusion posture; Q6 hide-vs-disable rule) · `2026-06-30-first-class-search-sorting-design.md` (Amundsen TLS failure; Secoda 90-day note)
- `lineage/odd-platform/system-mission.md:77-104` (P-01 Data Discovery; Recommended panel as a P-01 sub-surface)
