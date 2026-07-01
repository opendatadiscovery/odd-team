---
id: CTRIB-049
title: "ST-1b — Facets-in-URL search state (the facet half of ST-1; shareable & bookmarkable faceted search)"
issue: "ST-1b sub-task of #1825 (Part of #1825; milestone 1.0.0)"
parent_epic: 1825
class: feature
status: implementing            # GATE 1 APPROVED 2026-07-01 (approach: reducer race-fix; scope: ST-1b/ST-1c split). Phase D underway.
target_repo: odd-platform
milestone: "1.0.0"
adr: "adrs/drafts/unified-asset-search.md (rev 3 — D10 full-search-state-in-URL, D9 no-break) [maintainer-approved direction]"
adr_required: false             # G-C7 does NOT fire: additive FE state↔URL, no migration / no auth-posture / no wire-contract break (D9). Covered by approved ADR D10 (the same basis as ST-1a).
reproduced: "n/a (feature). Current behaviour VERIFIED in-tree @ f63d3915: ST-1a put only `q` in the URL; the 8 facets + myObjects live in the redux slice, PUT-synced to the session via the debounced effect (Search.tsx:97-118), NEVER in the URL — so a faceted search is not shareable/bookmarkable and back/forward does not navigate facet states."
plan_approved_by: "maintainer — GATE 1 AskUserQuestion 2026-07-01 (approach: Proceed—fix in the reducer [create-per-URL-state + preserve-unsynced-across-REPLACE]; scope: Split ST-1b now / ST-1c next)"
plan_approved_at: "2026-07-01"
docs_routing: "release/1.0.0 train (unreleased facets-in-URL behaviour) — extends ST-1a's search.md rewrite (facets now ride the shareable URL); paired DOC item at Phase D"
effort: large                   # a core FE search-state rewire (replaces the slice-reactive facet PUT with URL-driven updates) — held to reliable+stable
pr_url: ""                      # Phase E
pr_draft: true
---

## Context

ST-1b of the #1825 search overhaul (`state/search-overhaul-decomposition.md` rev 3), the **facet half of ST-1**,
realising **ADR D10** (the full search state — query **+ filters** + sort — lives in the URL). ST-1a (#1833, **merged
to `origin/main` as `f63d3915`**) put the **query** in the URL and made it the source of truth; it left the **8
facets + myObjects** in the redux slice (the W1/W4-deferred half, explicitly named in `searchUrlState.ts`'s own
docstring and the CTRIB-048 GATE-1 decision: *"ST-1a now, ST-1b facets fast-follow"*). ST-1b completes the promise: a
**faceted** search becomes shareable, bookmarkable, and back/forward-correct — built additively on ST-1a's
facet-extension-ready seam, forward-compatible with the unified core (ST-4).

## Current state (verified 2026-06-30, `origin/main @ f63d3915` — the merged ST-1a baseline)

- **The URL carries only `q` today.** `searchUrlState.ts` serialises/parses **only** the `query` (`SearchUrlState =
  { query }`, `:18-21`); its docstring (`:11-13`) states the facets are "layered on **additively** in ST-1b, so this
  module is intentionally facet-extension-ready." `useQueryParams` already takes `{ pathname?, replace? }` (`:9-14`).
- **`MainSearchInput` is the sole URL writer** and writes **`{ q }` only** (`:42` `setQueryParams({ q: query }, {
  pathname: searchPath() })`) — a full-object set that would **clobber** any facet params already in the URL. (The
  clobber is latent today because no facets are in the URL yet; ST-1b must make this writer **merge**.)
- **`Search.tsx` is URL-read-only for the query** (`:72-89`): it derives `urlQuery` from the URL and runs the search
  by creating one fresh session per visit with `filters: {}` (`:80`), then `updateDataEntitiesSearch` on `urlQuery`
  change. The **facets come from the slice**, not the URL: a **separate debounced effect** (`:97-118`,
  `updateSearchFacets`, 1500 ms leading) reads `getSearchFacetsData` (the unsynced-facet delta) + `getSearchMyObjects`
  and PUTs them when `!searchFacetsSynced`. **This is the effect ST-1b must replace with URL-driven updates** (facet
  back/forward needs the URL to drive the search).
- **The facet model** (`dataEntitySearch.slice.ts`): `facetState` is `{ [facetName]: { [numericEntityId]: { entityId,
  entityName, selected, syncedState } } }` (`:33`, `:46-61`). The 8 facet names (`generated-sources/FacetState`):
  `entityClasses` (the class — CountableSearchFilter), `types`, `tags`, `namespaces`, `datasources`, `owners`,
  `groups`, `statuses`. **`myObjects`** is a boolean derived from the `entityClasses` option with id `'my'`
  (`slice:173-174`). **`changeDataEntitySearchFacet`/`clearDataEntitySearchFacets` dispatch from FOUR sites — corrected
  census, plan-check round 1 caught the gap:** (1) `SingleFilterItem:28-36` (datasources/namespaces select), (2)
  `MultipleFilterItemAutocomplete:56-63` (types/owners/tags/groups/statuses select), (3) `SelectedFilterOption:22-31`
  (any facet — chip-✕ **deselect**, `facetOptionState:false`), and — **critically, NOT in `Filters/*`** — (4)
  `Results.tsx:97-114` `onSearchClassChange` (`facetName:'entityClasses'`, `facetSingle:true`), the **in-page class-tab
  strip + the "My Objects" tab** (`SearchResultsTabs:26-66` — `value:'all'`/`value:'my'`/numeric class ids; the ONLY
  DE-search surface that sets the class facet + `myObjects`); plus `Filters.tsx:43` (Clear-All). All four mutate the
  slice and let `Search.tsx:97-118` PUT — **none touch the URL**. The Filters/Results UIs read selected state from
  `getSelectedSearchFacetOptions(facetName)` (`selectors:118-129`) and the class via `getSearchEntityClass`
  (`selectors:107-116`).
- **Hydrate-by-id is sound** (the named "name-backfill" risk is cosmetic only): `SearchFilterState.entityName` is
  **optional** (`generated-sources/SearchFilterState`), so a URL → `filters: { [facetName]: [{ entityId, selected:true
  }] }` runs a correct filtered search. The create/update thunks pass `filters`+`myObjects` straight through
  (`dataentitiesSearch.thunks.ts:25-41` → `searchApi.search` / `searchApi.updateSearchFacets`); the server response
  repopulates `facetState` **with names + counts** via `updateSearchState` (`slice:40-103`, `setFacetOptionsById` sets
  `entityName: facetOption.name`), so chips render fully after the first response.
- **The W4 session-navigators** (still create `/search/{sessionId}`, deferred by ST-1a): `TopTagsList` (tag click →
  `createSearch({ filters: { tags: [{entityId,…}] } })`, `:15-19`), `DataEntitiesUsageInfo` (class click →
  `entityClasses`, type click → `entityClasses`+`types`, `:23-54`), `ToolbarTabs` (Catalog tab → empty
  `createSearch({ filters:{} })`, `:115-129`). All via `useCreateSearch` (`:12-22` — POST then `navigate(/search/{id})`).

## Design before build (G-C12)

- **Reuse, don't rebuild.** Extend `searchUrlState.ts` (facet-extension-ready by ST-1a's own design) +
  `useQueryParams` (`{pathname,replace}` already present). Serialize FROM `getSelectedSearchFacetOptions` (the existing
  selected-per-facet selector). Hydrate THROUGH the existing create/update thunks (no new API). Keep
  `changeDataEntitySearchFacet` for the **optimistic** chip (UI responsiveness). **No parallel `useSearchParams` /
  facet-state layer** (the LSN-035 trap — avoided, as ST-1a did).
- **ADR-check.** Conforms to **D10** (the full search state — query + **filters** — is the URL) and **D9** (no break:
  legacy `/search/{sessionId}` deep-links + `/api/search` unchanged). `adr_required: false` — additive FE state↔URL,
  no migration / auth-posture / wire-contract change (the identical basis ST-1a shipped under). G-C7 does **not** fire.
- **The architecture decision (the crux — back/forward forces it; REVISED after plan-check round 1).** A shareable
  URL + bookmark + hydrate could be a one-way mirror; but **facet back/forward** requires the URL to **drive** the
  search reactively (a popstate must re-run that facet state). So ST-1b extends ST-1a's **"the URL is the source of
  truth"** to facets. **Plan-check round 1 found the decisive flaw in the first cut** (explicit URL-writers wired only
  into `Filters/*`): the class/My-Objects facet is set from `Results.tsx:104`, NOT `Filters/*` — so removing the
  slice-PUT while wiring only the sidebar would silently break class & My-Objects filtering (the 4-site census gap).
  **The fix is structural, not a 5th wired site — a reactive facet→URL mirror that covers every dispatch site:**
  - **The facet→URL mirror (repurpose the EXISTING synced-gated effect, `Search.tsx:97-118`).** That effect already
    fires on a **local** facet change and is naturally loop-broken by `isFacetsStateSynced`: a user mutation (any of
    the 4 sites + Clear-All) sets `isFacetsStateSynced=false` (`slice:134,178`) → the effect runs; a server response
    sets it `true` (`slice:97`) → the effect does NOT run. **Change its body from `dispatch(updateDataEntitiesSearch)`
    to `navigate(searchPath() + '?' + searchStateToParams(fullSliceState))`** (debounced ~400 ms **trailing** — not the
    current `leading:true`, which double-fires on a click burst). **Serialise the FULL slice state:** each facet's
    *selected* ids via `getSelectedSearchFacetOptions(facetName)` — **including `entityClasses` from
    `getSelectedSearchFacetOptions('entityClasses')` (numeric ids), NOT `getSearchEntityClass`** (which returns the
    string `'my'`/`'all'`, `selectors:107-116`, and would emit a fail-closed-dropped `entityClasses[]=my`) — plus
    `my=` from `getSearchMyObjects` + `q` from `getSearchQuery`. Because it reacts to the **slice** (not a component),
    it covers the sidebar facets, the chip-✕ deselect, Clear-All, **and the class/My-Objects tabs** uniformly — the 4
    dispatch sites stay **byte-unchanged** (they already write the slice). Loop break: the mirror writes the URL only
    on `!isFacetsStateSynced` (a local change); the server-synced repopulation does not re-fire it (verified: back/
    forward keep `synced=true` throughout). **Equality-guard (NORMALISED — W1):** navigate only when the canonical
    re-serialised slice differs from the URL — compare `searchStateToParams(slice)` against
    `location.search.replace(/^\?/, '')` (strip the leading `?`; `searchStateToParams` shares `useQueryParams`'
    `query-string` options so order/encoding match). Without the strip the guard is a no-op (a redundant `navigate`
    per unrelated slice-ref change in the unsynced window — duplicate history + redundant `/api/search`).
  - **Reader (sole; `Search.tsx` — CREATE per URL state, the REPLACE path; round-2 BLOCKER fix).** Parse the **full**
    state from the URL (`paramsToSearchState` → `{query, filters, myObjects}`) and **`createDataEntitiesSearch` on every
    distinct URL state** — NOT `updateDataEntitiesSearch`. **Why create, not update (a FE↔BE contract fact the round-2
    plan-check surfaced from the Java):** the server's `updateFacets` **MERGES** a delta onto the persisted state
    (`SearchServiceImpl:84-96` → `FacetStateDto.merge:41-66` — an option absent from the delta is KEPT; removal needs an
    explicit `selected:false`), while only `search()` (create) does `removeUnselected` = a true **REPLACE**
    (`SearchServiceImpl:75-82`, `FacetStateDto:30-39`). Since the URL encodes only the **selected** id set
    (`getSelectedSearchFacetOptions` returns `selected:true` only), an `update` could never **remove** a facet →
    deselect / Clear-All / single-class-switch would silently revert. **Create-per-URL-state makes each URL the
    complete, authoritative spec** (REPLACE), which is exactly D10's "the session is an ephemeral, URL-derived
    execution detail." Track the **last-applied serialised state** in a ref (replacing the `sessionCreatedRef`/
    `ranQueryRef` query-only guard, `:81-89`); create when `location.search`'s serialised state differs (covers a
    facet-only change + back/forward — W1). The legacy `routerSearchId` branch (`:91-95`, D9) is untouched. *(Verified
    the create lifecycle: new `searchId` → `updateSearchState` REPLACES `facetState` on the new id, slice:94 →
    `Results.tsx:76-81` refetches; `myObjects` rides `SearchFormData.myObjects` → `getSearchResults` `findByState`.)*
  - **Query writer (`MainSearchInput`) — merge, don't clobber (plan-check VALIDATED).** Change `:42` from
    `setQueryParams({ q }, …)` (object → replaces → drops facets) to the **function updater**
    `setQueryParams(prev => ({ ...prev, q }), { pathname: searchPath() })`: `prev` is parsed live from `location.search`
    (`useQueryParams:46-52`), so the in-URL facets survive. Push (a query is a navigable state).
  - **The slice** stays the **optimistic + render** layer (unchanged): the toggle dispatches `changeDataEntitySearchFacet`
    for the instant chip; the server response repopulates names/counts (`updateSearchState`).
  - **Loop-safety.** Two guards: (a) the `isFacetsStateSynced` gate (mirror writes only on local changes), (b) the
    serialised-equality check (no redundant navigate). `Search.tsx`'s reader is URL→slice; the mirror is
    slice→URL-on-local-change; the server response → slice does **not** navigate. No write↔read cycle. *(This is the
    one loop-safety delta vs ST-1a's explicit-writer query model — re-verified in plan-check round 2.)*
- **Impact checklist.** i18n — **none** (no new strings; facets/labels already localised). Generated BE/FE clients —
  **none** (no API change). Consumers — **only 3 files change**: `searchUrlState.ts` (extend), `Search.tsx` (mirror +
  full-state reader), `MainSearchInput.tsx` (merge). The 4 facet dispatch sites (`SingleFilterItem`,
  `MultipleFilterItemAutocomplete`, `SelectedFilterOption`, `Results.tsx`) + `Filters.tsx` Clear-All are
  **byte-unchanged** — the reactive mirror covers them (that is the whole point of the round-1 fix). The 3 W4
  navigators → **ST-1c** (below). Migrations — none. Docs — `data-discovery/search.md` (facets now ride the shareable
  URL — extends the ST-1a rewrite; release train). Ontology — refresh the search-flow sidecar at merge (deferred, same
  as ST-1a — stale only on merge).
- **PO/SRE lens** (folded; ST-1a precedent — no unique new concern, so no separate `odd-sme` spin): the win = a
  **shareable faceted link** + durable bookmark + back/forward across filter states. SRE — **no PII/secrets** in the
  URL (facet values are catalog-metadata ids: datasource/tag/owner/namespace/class ids, already visible in the UI —
  the exact ST-1a clearance); **recipient-scoped** re-eval is inherited from the unchanged `/api/search` (a facet id
  the recipient cannot see is filtered server-side); **fail-closed** parse (unknown/garbage facet params ignored,
  numeric coercion bounded); debounced writes avoid history spam.

### Param schema (extends ST-1a; clean, forward-compatible)
`q` (ST-1a) + the 8 facets as repeated/CSV **id** params — `entityClasses`, `types`, `tags`, `namespaces`,
`datasources`, `owners`, `groups`, `statuses` (bracket-separator CSV of numeric ids, e.g. `tags[]=5,7`) + **`my`**
(boolean, the myObjects flag). Facet **values are ids** (matching `facetState`; the `query-string` options are shared
with `useQueryParams` so encoding is consistent). Additive-ready for `asset_kinds` (ST-4/5) + `sort` (ST-2). Human
slugs stay a later enhancement (out of scope, as in ST-1a).

## Spec (G-C17) — falsifiable WHAT + ambiguity score

| # | Requirement (testable) | Current (`file:line` @ f63d3915) | Target | Acceptance (pass/fail) |
|---|---|---|---|---|
| **R1** | Applying facets serialises them to the URL | facets live in the slice; `Search.tsx:97-118` PUTs them to the session; URL carries only `?q=` | selecting/clearing a facet (or My-objects) navigates to `/search?q=…&<facet>[]=<ids>&my=…` (push, debounced), preserving `q` | toggling a tag yields `…&tags[]=<id>`; the existing `q` survives; `searchStateToParams` round-trips identity (unit) |
| **R2** | A loaded faceted URL reproduces the exact faceted search | a param URL runs only the query (`filters:{}`, `:80`); facets are ignored | `paramsToSearchState` parses facet ids → the mount runs `create` with `filters`+`myObjects`; the server returns the filtered result + the selected chips | opening `/search?tags[]=<id>` fresh shows the tag-filtered results + the tag chip selected (integration) |
| **R3** | Back/forward navigates facet states | the URL never changes on a facet toggle → back/forward dead for facets | each committed facet set is a history entry; a popstate re-runs that facet state server-side | apply tag → apply owner → Back returns to the tag-only result; Forward re-applies the owner (integration) |
| **R4** | Recipient-scoped, no secrets in the URL | n/a (facets not in URL) | facet **ids** only (catalog metadata, never PII); a shared faceted URL re-evaluates under the **recipient's** permissions (inherited `/api/search`) | a garbage/foreign facet id renders a safe result, not a crash/leak; URL carries only ids + `q` + `my` (unit + assessed) |
| **R5** | Backward-compat (D9 hard line) | legacy `/search/{sessionId}` loads via `getDataEntitiesSearch` (`:91-95`); `/api/search` unchanged | legacy session deep-links KEEP working (the `routerSearchId` branch untouched); `/api/search` contract untouched | a legacy `/search/{id}` still loads / graceful-expired; no `/api/search` diff (integration + no-API-diff) |
| **R6** | Param parse fails closed (security/SRE) | ST-1a fail-closed for `q` only | unknown/malformed facet params ignored/defaulted, never crash; the FTS path stays tsquery-escaped (IT-003 guard, inherited) | a `?tags[]=notanumber&bogus=1` URL renders the default/safe search, no throw (unit + integration) |

**Negative (must-NOT):** a query commit must **NOT** drop the active facets (the `MainSearchInput` clobber — R1); a
facet toggle must **NOT** fire a server search per intermediate keystroke/click (debounced, committed-set only); must
**NOT** break the legacy session deep-link or `/api/search` (D9); must **NOT** put a name/PII in the URL (ids only).

**Boundaries.** *In scope:* the current DE search's **8 facets + myObjects** ⇄ URL (id-keyed); hydrate-on-load;
facet write + back/forward; making `MainSearchInput` merge q with facets; extend `searchUrlState`. *Out of scope
(+why):* the **W4 entry-point rewire** (TopTagsList / DataEntitiesUsageInfo / ToolbarTabs → param URL) = **ST-1c**
(below — a clean, shadow-free fast-follow; those paths keep working as legacy sessions meanwhile, the same deliberate
deferral ST-1a's review documented); `sort` (ST-2 — schema stays additive); saved searches (ST-3); the unified
cross-kind index / `asset_kinds` (ST-4/5); facet-logic AND/OR + negation (ST-11); human-readable slug facet values
(later); the optional legacy-session→param-URL redirect (EXCLUDED to bound risk, as ST-1a).

**Constraints.** Perf: debounced facet URL writes (~400 ms), one server round-trip per committed facet set (no
regression vs the existing 1500 ms PUT batch). Security (release gate): ids-only, recipient-scoped, fail-closed,
tsquery-escaped FTS (inherited). Compat (D9): `/api/search` + legacy session deep-links unbroken. ODD-UX pattern to
reuse: `searchUrlState` + `useQueryParams` + `getSelectedSearchFacetOptions` (`feedback_reuse_platform_ui_patterns`).

**Ambiguity report (G-C17 gate ≤ 0.20):** goal `0.94` (≥0.75 ✓) · boundary `0.90` (≥0.70 ✓) · constraint `0.84`
(≥0.65 ✓) · acceptance `0.86` (≥0.70 ✓) → **ambiguity = 1 − (0.35·0.94 + 0.25·0.90 + 0.20·0.84 + 0.20·0.86) =
0.104** ≤ 0.20, all minimums met. **Open questions:** none unresolved — facet-value-encoding = ids (RESOLVED:
`facetState` id-keyed + `SearchFilterState.entityName` optional → hydrate-by-id, names backfill server-side);
source-of-truth = URL (RESOLVED: back/forward forces it; consistent with ST-1a); the ONE genuine decision is the
**ST-1b / ST-1c split** (a GATE-1 scoping call, not an ambiguity).

## Recommended slicing — ST-1b now / ST-1c fast-follow (the one GATE-1 decision; a complete split, not a `v1` shadow)

A SPIDR split where **each half ships a complete user-observable truth** (no shadow; ST-1c is its own spec→plan→tests→
PR→gates):

- **ST-1b (recommended build now) — the facet URL-state engine.** Facets + myObjects ⇄ URL via a reactive slice→URL
  mirror: serialize on any facet change (sidebar + class/My-Objects tabs + deselect + Clear-All), hydrate on load,
  back/forward, fail-closed, `MainSearchInput` merge. Delivers the complete *"share/bookmark/navigate a faceted
  search"* truth from **every** in-page faceting surface. **3 source files** + tests (`searchUrlState`, `Search.tsx`,
  `MainSearchInput` — the mirror covers the dispatch sites without touching them; round-1 fix made it smaller).
- **ST-1c (immediate fast-follow) — retire the W4 session-navigators.** Rewire `TopTagsList`,
  `DataEntitiesUsageInfo`, `ToolbarTabs` to navigate to the canonical `/search?<facet>[]=<id>` param URL instead of
  `useCreateSearch` → `/search/{sessionId}`. Delivers *"a home tag/class click produces a shareable faceted link"* +
  retires the last session-create navigations. ~3 small files. Its own GATE 1.

*Alternative the maintainer may choose:* **ST-1b whole** (bundle ST-1c's W4 rewire into one PR) — defensible as one
coherent "facets are first-class in the URL everywhere" feature (~7 files); ST-1b's plan is then extended with the 3
W4 navigators (re-plan-checked). Trade-off: a larger single PR touching the core search flow **and** 3 entry points
vs. two focused, individually-reliable PRs (the maintainer's "reliable + stable, not one big-bang" steer + the ST-1a/1b
precedent favour the split — hence the recommendation).

## must_haves contract (G-C19) — for ST-1b

```yaml
must_haves:
  truths:                       # user-observable; each verifiable by driving the running stack; each → a Spec line
    - "Selecting a sidebar filter on /search updates the URL to a shareable link encoding that filter (the query is preserved)"   # R1
    - "Selecting a class tab or the 'My Objects' tab updates the URL (?entityClasses[]=<id> / ?my=true) and refilters"  # R1 — the Results.tsx/SearchResultsTabs surface (round-1 blocker)
    - "Deselecting a filter (chip-✕) or Clear-All removes it from the URL AND narrows the results — no silent revert"   # R1 — removal (round-2 blocker; needs the REPLACE/create path, not merge/update)
    - "Opening a /search?tags[]=<id> URL fresh (no prior session) runs the tag-filtered search and shows the chip selected"  # R2
    - "Browser back/forward navigates between prior filter states (apply tag → apply owner → Back = tag-only)"           # R3
    - "A faceted /search?... URL run by another user returns results scoped to THAT user's permissions, no crash/leak"   # R4
    - "A legacy /search/{sessionId} link still loads (or shows the graceful expired state); /api/search is unchanged"    # R5 (D9)
    - "A malformed facet URL (?tags[]=notanumber&bogus=1) shows a safe default search, never a crash"                    # R6
  artifacts:
    - path: "odd-platform-ui/src/lib/search/searchUrlState.ts"
      provides: "EXTEND SearchUrlState with the 8 facets (id lists) + myObjects; searchStateToParams / paramsToSearchState (de)serialise them id-keyed, fail-closed, query-preserving"
      anchor: "SearchUrlState"
    - path: "odd-platform-ui/src/components/Search/Search.tsx"
      provides: "(a) READER: mount/update derive {query,filters,myObjects} from the URL and run create/update, with the create-once/ranQueryRef guard re-keyed query-only→full-state (W1); (b) MIRROR: the existing isFacetsStateSynced-gated effect (:97-118) navigates the full-state param URL instead of PUTting — reacting to the SLICE, it covers all 4 dispatch sites incl. the class/My-Objects tabs; legacy routerSearchId branch (:91-95) byte-unchanged"
      anchor: "isFacetsStateSynced"
    - path: "odd-platform-ui/src/components/shared/elements/MainSearchInput/MainSearchInput.tsx"
      provides: "the query commit MERGES q with the in-URL facets via the function updater setQueryParams(prev => ({...prev, q})) — no clobber; push"
      anchor: "setQueryParams"
    # NO change to the 4 facet dispatch sites (SingleFilterItem / MultipleFilterItemAutocomplete / SelectedFilterOption / Results.tsx) or Filters.tsx Clear-All — the slice→URL mirror covers them. (Verifying this is the round-1 blocker fix.)
  key_links:
    - from: "ANY facet mutation — sidebar select/deselect, Clear-All, OR the Results.tsx class/My-Objects tab (slice, isFacetsStateSynced=false)"
      to: "the URL"
      via: "the repurposed :97-118 effect: navigate(searchPath() + '?' + searchStateToParams(fullSliceState)), debounced, only when serialised-slice !== location.search"
      breaks_if: "the writer is wired per-component into Filters/* only → the Results.tsx class/My-Objects tab never reaches the URL/server after the PUT is removed (the ROUND-1 BLOCKER); or it reacts to a synced state → loop"
    - from: "Search.tsx READER — create per distinct URL state"
      to: "createDataEntitiesSearch (server search() = removeUnselected = REPLACE)"
      via: "paramsToSearchState(location.search) → createDataEntitiesSearch({query, filters:selected-ids, myObjects}); a last-applied-serialised-state ref fires create on each distinct URL state, gated on !routerSearchId"
      breaks_if: "using updateDataEntitiesSearch (merge, SearchServiceImpl:84-96) → a facet absent from the URL is KEPT → deselect/Clear-All/class-switch silently revert (round-2 BLOCKER); or filters:{} → URL facets ignored (R2); or the guard stays query-keyed → facet-only change / back-forward no-op (R3 — W1)"
    - from: "MainSearchInput query commit"
      to: "the URL"
      via: "setQueryParams(prev => ({...prev, q})) — prev is parsed live from location.search (useQueryParams:46-52), so in-URL facets survive"
      breaks_if: "setQueryParams({q}) (object, not updater) → replaces params → drops active facets (R1 negative; VALIDATED real in round 1)"
    - from: "a legacy /search/{sessionId}"
      to: "getDataEntitiesSearch(routerSearchId)"
      via: "the preserved Search.tsx routerSearchId branch (:91-95), untouched"
      breaks_if: "the facet rewire deletes/leaks into the branch → D9 + IT-125 regression"
    - from: "the parsed facet ids"
      to: "server FTS execution"
      via: "the existing escaped /api/search path (unchanged); SearchFilterState.entityName optional → ids suffice, names backfill server-side"
      breaks_if: "a new param-driven path bypasses escaping → IT-003 injection regression; or hydrate requires a name it lacks → blank/dropped chips"
```

## Tasks (ST-1b) — specific, sized, no scope-reduction (REVISED after plan-check round 1)

1. **Extend the (de)serialisers (fail-closed, query-preserving).** *File:* `lib/search/searchUrlState.ts`. *Action:*
   widen `SearchUrlState` to `{ query, facets: Partial<Record<facetName, number[]>>, myObjects }` (the 8 facet names
   incl. `entityClasses`); `searchStateToParams` emits `q` + per-facet CSV id params + `my`; `paramsToSearchState`
   parses them id-keyed into `{ query, filters: SearchFormDataFilters, myObjects }`, coercing non-numeric/unknown to
   dropped (never throws). *Verify:* `pnpm test` the round-trip (state→URL→state identity, incl. `entityClasses`+`my`)
   + a garbage-facet-param unit. *Done:* identity round-trip GREEN incl. facets; malformed facet → default, no throw;
   `q` preserved.
2. **`Search.tsx` — the READER (create/REPLACE) + the MIRROR (the core change; covers ALL facet sites).** *File:*
   `components/Search/Search.tsx`. *Action:* (a) **Reader — CREATE per distinct URL state (REPLACE, round-2 fix):**
   derive `{query, filters, myObjects}` from `paramsToSearchState(location.search)` and **`createDataEntitiesSearch`**
   (server `search()` = `removeUnselected` = REPLACE) on each distinct URL state — **NOT** `updateDataEntitiesSearch`
   (merge — `SearchServiceImpl:84-96` keeps facets absent from the delta → can't remove). Replace the
   `sessionCreatedRef`/`ranQueryRef` query-only guard (`:81-89`) with a **last-applied-serialised-state ref** (create
   when `searchStateToParams(urlState)` differs) so a facet-only change + back/forward both fire (W1). (b) **Mirror:**
   repurpose the `!isFacetsStateSynced`-gated effect (`:97-118`) — replace its `dispatch(updateDataEntitiesSearch)` body
   with `navigate(searchPath() + '?' + searchStateToParams(fullSliceState))`, debounced ~400 ms **trailing**, serialised
   from `getSelectedSearchFacetOptions(facetName)` per facet (**incl. `entityClasses` — NOT `getSearchEntityClass`**) +
   `getSearchMyObjects` + `getSearchQuery`, and **only when** `searchStateToParams(slice) !==
   location.search.replace(/^\?/, '')` (normalised equality loop-guard, W1). The legacy `routerSearchId` branch
   (`:91-95`) stays byte-unchanged. **The 4 facet dispatch sites + `Filters.tsx` Clear-All are NOT touched** — the
   mirror reacts to the slice, so class/My-Objects (`Results.tsx`), deselect (`SelectedFilterOption`), Clear-All, and
   the sidebar all flow through it. *Verify:* the extended IT-150 facet cases (apply / **deselect** / **Clear-All** /
   class-tab / My-Objects / deep-link / back-forward) RED on `ODD_SUT=ref:f63d3915`, GREEN on the worktree SUT. *Done:*
   a faceted deep-link reproduces; **deselect/Clear-All narrow the results (no revert)**; class/My-Objects refilter;
   back/forward navigate facet states; legacy unbroken; no loop / no history spam.
3. **`MainSearchInput` — merge q, don't clobber.** *File:* `shared/elements/MainSearchInput/MainSearchInput.tsx`.
   *Action:* change `:42` from `setQueryParams({ q }, …)` to the **function updater**
   `setQueryParams(prev => ({ ...prev, q: query }), { pathname: searchPath() })` so a query commit preserves the in-URL
   facets; push. *Verify:* extended IT-150 (query-after-filter keeps the filter; the home-hero `/`→`/search?q=` path
   still works) RED on `ref:main`, GREEN on the worktree; **IT-150's ST-1a query cases stay GREEN** (G-C15: any changed
   assertion keeps its RED-on-`ref:main` proof). *Done:* committing a query never clears active filters.

**Tests (G-C9 / G-C15) — both buckets, RED proof re-based to `f63d3915` (W3).** Update
`integration-tests/protocols/IT-150-search-url-state.md` RED base `2f9734e1`→`f63d3915` (the ST-1b RED base = current
`main`, which has `?q=` but no facet params). Extend IT-150 with: (a) sidebar facet apply → `…&tags[]=<id>` + chip; (b)
**class tab / My-Objects tab → `…&entityClasses[]=<id>` / `…&my=true` + refilter** (the round-1 blocker truth); (b2)
**deselect a chip + Clear-All → the id LEAVES the URL AND the result set NARROWS** (the round-2 removal blocker — proves
the REPLACE/create path, would silently revert under merge/update); (c) a faceted deep-link reproduces; (d) back/forward
across filter states; (e) a query-after-filter keeps the filter; (f) fail-closed garbage facet param. Each RED on
`ref:f63d3915`, GREEN on the worktree; the ST-1a query cases stay GREEN.

*Budget:* 3 tasks / **3 source files** + tests (the round-1 fix made it SMALLER — the mirror covers the 4 dispatch
sites without touching them; the W4 rewire is ST-1c).

## Plan-check round 1 (G-C19) — ISSUES FOUND (1 BLOCKER, 3 WARNING) → revised
The adversarial `plan-checker` (fresh context, goal-backward, re-derived every `file:line` against live `f63d3915`)
**rejected** the first ST-1b plan. The gate did its job — the blocker is a real wiring defect from an incomplete
consumer-read.

**Verified-SOUND (not re-litigated):** the `MainSearchInput` clobber + the function-updater merge fix (`useQueryParams`
parses `prev` live from `location.search` → facets survive); hydrate-by-id (`SearchFilterState.entityName` optional,
server backfills); the facet-options dropdown still has a live `searchId` (mount-create preserved); the **ST-1b/ST-1c
split is a legitimate, shadow-free SPIDR split** (the W4 paths keep working as legacy sessions via the preserved
`routerSearchId` branch); ADR D10/D9 + `adr_required:false` + i18n-none + the no-parallel-`useSearchParams` reuse-scan
— all PASS.

**BLOCKER 1 — the on-page class-tabs + "My Objects" write surface (`Results.tsx`) was orphaned.** The first plan scoped
the facet URL-writer to `Filters/*` and removed the slice-reactive PUT (`Search.tsx:97-118`). But
`changeDataEntitySearchFacet` dispatches from **four** sites, and the plan's census named only two — it missed
`Results.tsx:97-114` `onSearchClassChange` (the class-tab strip + "My Objects" tab, the ONLY DE-search surface that
sets the class facet + `myObjects`), which is NOT in `Filters/*` and uses neither `useCreateSearch` nor the URL. Remove
the PUT + wire only the sidebar, and a class-tab / My-Objects click updates the slice but reaches **neither the URL nor
the server** → no refilter (a regression of an existing working surface, invisible to the planned tests). Root cause:
the G-C4 consumer-read enumerated the sidebar dispatchers and missed the on-page one (the LSN-035 class).

**The revision (one structural fix, not a 5th wired site):** make the URL-writer a **reactive slice→URL mirror** —
repurpose the existing `!isFacetsStateSynced`-gated effect (`:97-118`) to navigate the full-state URL instead of
PUTting. Because it reacts to the **slice**, it covers all four dispatch sites — sidebar select/deselect, Clear-All,
**and the class/My-Objects tabs** — with the 4 sites byte-unchanged. This is **smaller** (3 files, not 9) AND
census-robust (no future per-site gap). Loop-safety: the `isFacetsStateSynced` gate (write only on a local change) +
a serialised-equality check. The `must_haves`, artifacts, key_links, and Tasks above are the REVISED (authoritative)
plan; a `must_haves` truth + an IT-150 case for the class/My-Objects tabs were added; the IT-150 RED base re-based to
`f63d3915` (W3); the reader-guard widening pinned in Task 2 (W1); the chip-✕ deselect enumerated (W2 — subsumed by the
mirror).

**Re-check:** the revised plan is re-submitted to the `plan-checker` (loop 2) — see "## Plan-check round 2" below.

## Plan-check round 2 (G-C19) — ISSUES FOUND (1 BLOCKER, 2 WARNING) → revised
The `plan-checker` (loop 2, fresh context @ `f63d3915`) **confirmed round-1 BLOCKER 1 RESOLVED** (the mirror DOES fire
on All→My-Objects despite the string id — `getSearchFacetsData`'s `createSelector` returns a new ref on every slice
change → `[searchFacetParams]` fires; `useAppSelector` is refEquality) and **loop-safety SOUND** (the
`!isFacetsStateSynced` gate terminates every cycle incl. popstate). The W1 guard-widening + the MainSearchInput merge
were re-confirmed sound. But it found a **deeper BLOCKER by reading the Java backend** (which the FE-only consumer-read
never touched):

**BLOCKER 2 — the URL-driven reader cannot REMOVE a facet (deselect / Clear-All / class-switch silently revert).** The
revision routed every facet change through `mirror → navigate → reader → updateDataEntitiesSearch(filters from URL)`.
But `updateFacets` **MERGES** a delta (`SearchServiceImpl:84-96` → `FacetStateDto.merge:41-66` — an option absent from
the delta is KEPT; removal needs an explicit `selected:false`), while only `search()` (create) does `removeUnselected`
= a true **REPLACE** (`SearchServiceImpl:75-82`, `FacetStateDto:30-39`). The URL encodes only the **selected** id set
(`getSelectedSearchFacetOptions` returns `selected:true` only), so an `update` could never remove a facet: chip-✕ tag 7
→ URL `?tags[]=5` → `merge({tags:[5,7]},{tags:[5]})` keeps 7 → the chip reverts + results never narrow. Same for
Clear-All + single-class switch. The OLD code worked because it PUT the unsynced delta *including* `selected:false`
(`getSearchFacetsData = pickBy(!syncedState)`) — exactly what the mirror discarded. **Confirmed first-hand** by reading
`SearchServiceImpl.java` + `FacetStateDto.java`.

**The revision (round-3 — a bounded reader-strategy change):** the reader **CREATEs a fresh session per distinct URL
state** (the `search()` = REPLACE path) instead of `update` (merge) — each URL is then the complete authoritative spec,
which is exactly D10's "the session is an ephemeral, URL-derived execution detail." Verified the create lifecycle (new
`searchId` → `updateSearchState` REPLACES `facetState` slice:94 → `Results.tsx:76-81` refetches; `myObjects` rides
`SearchFormData.myObjects` → `getSearchResults.findByState`). **Also fixed (the 2 warnings + the minor):** the equality
loop-guard is **normalised** (strip the leading `?`; `searchStateToParams` shares `useQueryParams`' encoding — W1, else
it's a no-op causing redundant `navigate`s); the debounce is **~400 ms trailing** (not `leading:true`, which
double-fires); the serializer sources `entityClasses[]` from `getSelectedSearchFacetOptions('entityClasses')` + `my=`
from `getSearchMyObjects` (NOT `getSearchEntityClass`, which returns the string `'my'`/`'all'`); a **facet-removal
truth + an IT-150 deselect/Clear-All case** were added (the dimension the blocker hid behind). The Design, must_haves,
Tasks, and Tests above are the REVISED (authoritative, round-3) plan.

**Re-check:** the round-3 plan is re-submitted to the `plan-checker` (loop 3, the last allowed) — see "## Plan-check
round 3" below.

## Plan-check round 3 (G-C19) — PASSED, but a maintainer-flagged race the check under-rated → scope/risk grows
The `plan-checker` (loop 3, fresh context @ `f63d3915`) returned **VERIFICATION PASSED** — create-per-state genuinely
fixes the round-2 removal blocker (verified `removeUnselected` REPLACE end-to-end), and the create lifecycle (dropdown
`searchId`, results refetch, ST-1a query cases, the normalised guard, the serializer source) holds. It raised **4
non-blocking WARNINGs**, the first of which I escalated on my own deeper trace:

**The round-3 WARNING that matters — a reachable LOST-UPDATE (not a cosmetic flicker).** With create-per-state, EVERY
committed state is a **new** `searchId`, so `updateSearchState` always takes the **REPLACE** branch (`slice:94-95`
`!isSearchIdsEquals → newSearchFacetsById`) — which, unlike the same-searchId branch (`:96/:82` "keep unsynced filter
state due to debounce"), **drops optimistic-unsynced locals.** Trace (verified against `slice` + use-debounce): toggle
A → (debounce) create-A in flight → toggle B (optimistic) → create-A responds → REPLACE `facetState={A}` drops B → B's
trailing debounce then reads the already-cleared slice `{A}` → serialises `{A}` → equality-guard ⇒ no navigate ⇒ **B is
permanently lost.** Reachable at a normal pace (select a facet, ~½ s later select another; RTT < the 400 ms debounce).
The plan-check rated it a non-blocking flicker ("final state always correct"); my trace shows the 2nd selection is
**lost**, not flickered. Not acceptable for the maintainer's reliable+stable bar.

**The fix — and why it grows the slice.** Preserve still-unsynced locals across the new-searchId REPLACE (make
`updateSearchState`'s `:94` branch merge the server response with the unsynced locals, like the same-searchId branch,
and set `isFacetsStateSynced` from whether unsynced remain). This is correct (verified: it preserves B → the mirror
re-fires → create-AB; and a popstate, having no optimistic locals, still fully REPLACEs so back/forward **removal**
stays correct). **But it touches `dataEntitySearch.slice.ts` `updateSearchState` — the core search-sync reducer** — so
ST-1b is now **4 files** (`searchUrlState`, `Search.tsx`, `MainSearchInput`, **+ the slice reducer**), not the "3-file
additive FE layer" first scoped, and the rapid-multi-select race is the thing to test hardest. **This crosses the
maintainer's "core search → default to caution" line → surfaced as a GATE-1 risk decision, not silently absorbed.**

**The other 3 round-3 warnings (fold-in, not blocking):** (W-r3-2) removing both `updateDataEntitiesSearch` dispatch
sites orphans that thunk + its `extraReducers` case + makes `isSearchUpdating` vacuous (the "Updating filters" spinner
→ datasource-fetch-only; no shipped defect — the create skeleton covers loading) → **log a cleanup follow-up**
(`follow-up-on-disk`); (W-r3-3) keep `Search.tsx:79` `if (isSearchCreating) return` (load-bearing — defers, not loses,
a URL change during an in-flight create) — pin it in Task 2; (W-r3-4) the serializer/guard text now matches round-3.

## Phase D — implementation (2026-07-01, GATE 1 APPROVED: reducer race-fix + ST-1b/ST-1c split)

Built ST-1b on `contrib/CTRIB-049-search-url-facets` (worktree `../odd-platform-ctrib049` off `origin/main`
`f63d3915`; LSN-038-safe — upstream unset, push.default=current, no push until GATE 2). **Commit `f89c9a65`
(5 source files):**

| File | Change |
|---|---|
| `lib/search/searchUrlState.ts` | EXTEND — `SearchUrlState` gains the 8 facets + `myObjects`; `searchStateToParams`/`paramsToSearchState` (de)serialise them id-keyed + fail-closed; new `searchUrlStateToFormData` (URL → the create request's selected filters) |
| `redux/selectors/dataentitySearch.selectors.ts` | NEW `getSearchUrlState` — projects the slice's selected facets + query + myObjects → `SearchUrlState` (the mirror's source; the 5th file = the projection's natural home, a small addition to the plan's 4) |
| `…/MainSearchInput/MainSearchInput.tsx` | the query commit merges q via the function updater `setQueryParams(prev => ({...prev, q}))` — preserves the active facet params (no clobber) |
| `redux/slices/dataEntitySearch.slice.ts` | the **race-fix** — `updateSearchState`'s new-session branch carries pending-unsynced locals across the create REPLACE (so a rapid 2nd toggle is not lost) + `isFacetsStateSynced` reflects pending; same-session branch byte-unchanged |
| `components/Search/Search.tsx` | the READER (create-per-URL-state = REPLACE, `lastAppliedStateRef`, `isSearchCreating` guard kept) + the MIRROR (repurposed the `!isFacetsStateSynced`-gated effect → debounced-trailing `navigate` of the full-state URL, normalised equality guard; covers all 4 dispatch sites incl. the Results class/My-Objects tabs); legacy `routerSearchId` branch untouched (D9) |

**Tests — both buckets:**
- **Unit (vitest, node 24 via a `node:24` container — local node is 18, too old for vite 7):** `searchUrlState.test.ts`
  (11 — 5 ST-1a updated for the widened type + 6 ST-1b facets/myObjects/removal/fail-closed round-trips) +
  `dataEntitySearch.slice.test.ts` (3 — NEW: the race-fix preserves an in-flight selection + a clean REPLACE +
  preserves an in-flight deselect) + `useQueryParams.test.tsx` (4 — ST-1a, **unchanged**, confirms ST-1a's hook
  intact). **18/18 GREEN.** `tsc --noEmit` clean; `eslint` clean (the lone `import/no-extraneous-dependencies`
  "error" is a `generated-sources` **symlink** false-positive — an unchanged `Results.tsx` hits it too).
- **Integration — NEW IT-151** `search-url-facets.spec.ts` (registered `suites.yaml` feature-complete + ui-e2e;
  protocol `IT-151-search-url-facets.md`): class-tab → `entityClasses[]=` URL + refilter (round-1 write surface) ·
  All-tab **removal** (round-2) · faceted-deep-link share · back/forward. **RED base = `ref:f63d3915`** (post-ST-1a,
  pre-ST-1b — a class tab there only PUTs, never touches the URL). **Authored; the targeted RED/GREEN run is PENDING**
  (the SUT is building in the full regression now).

**FULL regression:** `run-regression.sh ctrib049` **RUNNING** (background) — builds the SUT from `f89c9a65`, runs
feature-complete + multi-stack + known-bugs + ingestion-e2e under the flock. It validates **no-regression on the
ST-1b SUT** (the core-search rewrite doesn't break the ~330 e2e suite incl. IT-150's ST-1a query cases). *(It began
before the IT-151 registration, so it does not include IT-151 — that needs the separate targeted RED/GREEN run.)*

**Remaining Phase-D (DoD not yet met — status stays `implementing`, NOT review-ready):**
1. Assess the full regression (green-for-change) + run IT-151 targeted (**GREEN on the worktree SUT, RED on
   `ref:f63d3915`**) — the ST-1b integration proof.
2. **Docs (G-C10/G-C11):** READ `data-discovery/search.md` (ST-1a already rewrote it for `?q=`); add the
   facets-in-URL note on the `release/1.0.0` train + a paired DOC item.
3. **Ontology:** the search-flow sidecar refresh — **deferred to merge** (same as ST-1a; stale only on merge).
4. **Principal sufficiency + pixel review** (a screenshot of the faceted URL as a user).

**Phase E:** draft PR (`Part of #1825`, no closing keyword) → `/review` (separate session) → GATE 2.

## Status
intake → G-C11 PASS (issue #1825 OPEN, milestone 1.0.0 OPEN/semver) → ST-1a-merged reconciled (`f63d3915`) →
consumer-read (G-C4 — extended to the Java backend after round 2) → design-before-build (G-C12) → spec-gate **0.104**
(PASS) → must_haves (G-C19) → **plan-check round 1: BLOCKER (orphaned class/My-Objects write) → reactive mirror** →
**plan-check round 2: BLOCKER (merge-not-replace can't remove a facet) → create-per-URL-state (REPLACE)** →
**plan-check round 3: PASSED, but escalated a reachable lost-update → fix preserves unsynced across REPLACE (now
touches the core search-sync reducer)** → **GATE 1 APPROVED 2026-07-01** (approach: reducer race-fix; scope: ST-1b/
ST-1c split) → **Phase D: code + unit tests DONE + committed `f89c9a65` (5 files, 18/18 vitest green on node 24,
tsc+eslint clean); IT-151 facet e2e authored + registered; FULL regression RUNNING (background)** → **remaining:
assess regression + IT-151 targeted RED/GREEN + docs (release/1.0.0 train) + ontology (deferred-to-merge) + draft PR
→ GATE 2**. Status `implementing` (DoD not yet met; NOT review-ready).
