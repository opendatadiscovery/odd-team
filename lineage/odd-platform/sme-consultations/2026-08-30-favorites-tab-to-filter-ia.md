---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-08-30
consulted_by: maintainer-direct (CTRIB-061 / #1841 GATE-1)
consultation_question: Is retiring the bespoke `/favorites` tab in favour of a Favorites filter on the unified search the right IA move — and what shape (tri-state vs toggle), what ordering, and what must be preserved?
slug: favorites-tab-to-filter-ia
confidence_overall: HIGH
feeds: [contributor/CTRIB-061.md §6 GATE-1]
---

# Favorites: destination → filter (CTRIB-061 / ST-7)

**Headline.** Collapse the tab — the market's answer to "show me my subset" is a *filter on the one search
surface*, not a bespoke page. But ship it **binary, not tri-state**, ship the **recently-favorited ordering**
(Option A), and treat the tab's **teaching empty state** and **DISABLED warning sentence** as deliverables,
not as PO footnotes. Three of four questions are HIGH confidence.

## Q1 — Is destination→filter the right IA move? **YES (HIGH).** One condition.

Every catalog I could verify expresses "my narrowed slice of the catalog" as a **saved/applied filter on the
single search surface**, and none ships a starred-assets destination:

| System | Mechanism | Verbatim |
|---|---|---|
| DataHub | **Views** | "Views let you save a set of filters and reuse them across DataHub. When you activate a View, search results, browse pages, recommendations, and other asset lists are automatically narrowed to only the matching assets." Activated from "a selector in the search bar"; personal or public; settable as a default. **No favorites/starred feature documented at all.** |
| Atlan | saved filtered views | "save and share filtered views for precise, repeatable navigation across your full catalog." No starred-assets page documented. |
| Secoda | "Search views" | "easy access to your common searches." No favorites/bookmarks documented. |
| OpenMetadata | star = follow | "The star icon displays the number of users following the data asset." The page documents **no** surface where followed assets are later retrieved. |

Honest counter-evidence: **GitHub** — the mass-market star pattern — keeps `github.com/stars` as a *destination*
that then grew its own search, Language/Type filters and a Sort-by menu. But GitHub has no other search surface
covering the same corpus; ODD's catalog search now does (ST-4). Retiring the tab is also **systematic, not a
one-off amputation**: ST-4 already retired the class tabs, ST-8/9/10 fold My-data / Popular / Recently-viewed
into the same rail, and **ST-3 saved searches is already in P0** — i.e. ODD is converging on precisely the
DataHub/Atlan/Secoda model.

**Condition (load-bearing).** DataHub's View selector lives **in the search bar** — persistent and visible. A
value in a sidebar dropdown is not equivalent. So the move is right *provided* the Overview Favorites panel +
"View all" (R6) is treated as the **primary, must-have entry point** — after retirement it is the only
always-visible advertisement of the feature — and the filter control is rendered unconditionally in the rail,
never behind an "Add filter" more-menu.

## Q2 — Tri-state All/Yes/No? **NO. Ship binary (HIGH).**

No verified product exposes a per-filter tri-state for a personal boolean. DataHub's View is on/off; GitHub's
stars page has no "not starred" value; Atlan/Secoda document none. **`No` fails the PO test on its own terms:**
favorites are tens of items in a catalog of thousands, so `favorites=no` returns *essentially the unfiltered
result* — a selected state a user cannot visually distinguish from `All`. A filter value whose effect is
invisible is a dead control that costs a click on every use of the live value.

**Recommendation.** UI = one **toggle/checkbox "Favorites only"** (`Favorites (shared)` under DISABLED),
absent = All. Keep the wire contract exactly as specced — `AssetSearchFormData.favorites` optional **boolean**,
so `false` stays expressible via API/URL for power users and future needs at zero cost. Two consequences for
the plan: (a) the new `FixedOptionsSingleFilter` component (§5a) is **no longer needed** — conform to whatever
control `myObjects` already uses, so ODD's two personal scopes look alike; (b) with ST-8 (My-data) and ST-10
(Recently-viewed) landing on the same rail, group them now under one **"Scope"** section rather than shipping
three unrelated controls.

## Q3 — Ordering: **material. Ship Option A (MEDIUM-HIGH).**

GitHub — the only verified system with a personal star list — ships **"Recently starred"** as an explicit
Sort-by option. Secoda's four sorts (Relevance / Popularity / Last modified / Date created) contain no
"recently saved" *because Secoda has no favorites*: its recency axis is asset-modification, not personal
action. The pattern is consistent — the moment a product has stars, it orders them by when you starred.

The regression is worse than "different order": with status-priority browse ordering, a favorites list (mostly
STABLE) ties on **internal id** — i.e. catalog-insertion order, which is arbitrary *and stable*, so a newly
starred asset lands at an unrelated position **and never moves**. That defeats the exact workflow the feature
exists for ("daily re-navigation" — 2026-06-26 consultation).

**Recommendation: Option A, with one refinement.** Add it as a **named semantic ordering** in the existing
global sort dropdown — "Recently favorited" — conditionally offered when the favorites scope is on, defaulting
in that state with no text query (relevance still wins when a query is present). Do **not** build a
Favorites-only sort UI: this is the sorting model already agreed in the 2026-06-30 consultation, the index
exists, and ST-10 needs the identical shape for `last_viewed_at DESC`.

## Q4 — What else is lost, in priority order

1. **Discoverability.** NN/g heuristic 6: *"Minimize the user's memory load by making elements, actions, and
   options visible. The user should not have to remember information from one part of the interface to
   another."* A tab advertises; a sidebar filter must be found. Mitigation = the Q1 condition (panel is the
   must-have entry; control always rendered; the star stays on rows + detail header).
2. **The teaching empty state.** "Star an asset to pin it here" taught the affordance. A zero-result search page
   says *no results* — a failure message, not a teaching one. **Promote this to a `must_have` truth with an
   acceptance line** (favorites-scope + empty ⇒ teaching copy, not generic no-results); as a §5(e) PO note it
   will be dropped under Phase-D pressure.
3. **The DISABLED warning.** Reducing a banner paragraph to the suffix `(shared)` keeps the *state* and loses
   the *consequence* — that anyone on the instance sees and can remove your star. NN/g heuristic 1: *"no action
   with consequences to users should be taken without informing them."* Cheapest correct form: keep the
   `(shared)` label **plus** ODD's shipped inline-help idiom (`AppTooltip` + `InformationIcon`) carrying the
   one-sentence explanation. One key ×7 locales, reuses an existing pattern.
4. **Nameability.** `/search?favorites=yes` is linkable but not sayable. ST-3 saved searches restores it —
   verify at ST-3 that the favorites scope is saveable, and consider a built-in "My favorites" saved search.
   Cross-slice note, not ST-7 scope.

**Vocabulary flag (Gate 2).** `concepts.yaml` has **zero** `favorite*` entries and the live data-discovery page
names seven facets with no mention of favorites — the concept is uncatalogued while gaining an eighth filter.
Log a catalog entry with the ST-7 docs change.

## Caveats

- **`favorites.md`'s "most-recently-favorited first" promise was not read first-hand** — the page lives on the
  unmerged `documentation@release/1.0.0` branch, absent from the working tree, and this session has no shell.
  Corroborated by `prds/0001-favorites-and-recently-viewed.md:128,281-282` and CTRIB-061 §4 R5. Q3's premise is
  workspace-corroborated, not doc-verified: **verify before quoting the manual in the PR body.**
- DataHub's general query negation (`-`) was **not** re-fetched this session; no claim made from it.
- OpenMetadata `v1.12.x` slugs now 404; the star quote was re-verified at the `latest` slug. Landing-page widget
  names remain unverified (the admin-guide customize-UI URL 404'd) — so no claim about a "Following" widget.

## Citations (fetched 2026-08-30)

- `docs.opendatadiscovery.org/features/data-discovery` — **200**. Seven facets "Datasource / Type / Namespace /
  Owner / Tag / Groups / Statuses"; tabs "All / My Objects / Datasets / …"; **no** favorites/star/sort mention.
- `docs.datahub.com/docs/features/feature-guides/views/overview` — **200**. Views quote; search-bar selector;
  personal vs public; defaults; no favorites. (`…/views` without `/overview` → directory listing only.)
- `docs.atlan.com/product/capabilities/discovery` — **200**. "save and share filtered views…"; "Filter by
  source, certification, owner, tags, and more"; no starred assets.
- `docs.secoda.co/features/search` — **200**. Four sorts; "Search views" = "easy access to your common
  searches"; no favorites/bookmarks.
- `docs.open-metadata.org/latest/how-to-guides/data-discovery/details` — **200**. Star = follower count; no
  retrieval surface documented. (`/v1.12.x/…` → **404**; `…/admin-guide/how-to-customize-openmetadata-ui` → **404**.)
- `docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars` — **200**.
  `github.com/stars`; "Sort by: … **Recently starred**, **Recently active**, or **Most stars**"; name-only
  search; Language/Type filters.
- `nngroup.com/articles/ten-usability-heuristics/` — **200**. H1 and H6 quoted above.
- Workspace: `contributor/CTRIB-061.md` (§3–§6), `state/search-overhaul-decomposition.md:20,54-56,84-95,101-104,131-137,156-162`,
  `prds/0001-favorites-and-recently-viewed.md:22,128,143,179-181,281-282`, `lineage/odd-platform/system-mission.md` P-01,
  `lineage/odd-platform/concepts.yaml` (grep `favorit*` → 0 matches), prior consultations
  `2026-06-26-favorites-recently-viewed-prd.md`, `2026-06-30-first-class-search-sorting-design.md`.
</content>
</invoke>
