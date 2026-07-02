---
id: CTRIB-049
title: "ST-1b — Facets-in-URL search state (the facet half of ST-1; shareable & bookmarkable faceted search)"
issue: "ST-1b sub-task of #1825 (Part of #1825; milestone 1.0.0)"
parent_epic: 1825
class: feature
status: pending-release        # MERGED (GATE 2) 2026-07-02 → squash `ab63b6d3` on odd-platform origin/main (PR #1834), FAITHFUL (`git diff 02f0ee60 ab63b6d3` empty — the merged tree == the reviewed commit). Release-gated (1.0.0) ⇒ pending-release; `/review release:1.0.0` owns pending-release→done after 1.0.0 ships + DOC-497 live-verifies. RE-REVIEW ACCEPTED (review-ctrib049-2, all gates PASS, independent regression green-for-change + Java build @ 02f0ee60) → maintainer RATIFIED label-preserve (item #1) → merged; ST-1d residual (item #2) shipped tracked-not-blocked. Follow-ups: DOC-497 (docs train push, maintainer-gated) · ST-1c (W4 entry-point rewire) · ST-1d (deep-link chip labels) · search-flow ontology refresh (now due — owned by the 1.0.0 release-gate refresh, same as ST-1a). Verdict/ratification/merge sections below.
target_repo: odd-platform
milestone: "1.0.0"
adr: "adrs/drafts/unified-asset-search.md (rev 3 — D10 full-search-state-in-URL, D9 no-break) [maintainer-approved direction]"
adr_required: false             # G-C7 does NOT fire: additive FE state↔URL, no migration / no auth-posture / no wire-contract break (D9). Covered by approved ADR D10 (the same basis as ST-1a).
reproduced: "n/a (feature). Current behaviour VERIFIED in-tree @ f63d3915: ST-1a put only `q` in the URL; the 8 facets + myObjects live in the redux slice, PUT-synced to the session via the debounced effect (Search.tsx:97-118), NEVER in the URL — so a faceted search is not shareable/bookmarkable and back/forward does not navigate facet states."
plan_approved_by: "maintainer — GATE 1 AskUserQuestion 2026-07-01 (approach: Proceed—fix in the reducer [create-per-URL-state + preserve-unsynced-across-REPLACE]; scope: Split ST-1b now / ST-1c next)"
plan_approved_at: "2026-07-01"
docs_routing: "release/1.0.0 train (unreleased facets-in-URL behaviour) — extends ST-1a's search.md rewrite (facets now ride the shareable URL); paired DOC item at Phase D"
effort: large                   # a core FE search-state rewire (replaces the slice-reactive facet PUT with URL-driven updates) — held to reliable+stable
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1834"   # MERGED 2026-07-02 (GATE 2, human) → squash `ab63b6d3` on origin/main; was bot-authored draft, Part of #1825
pr_draft: false
merged_sha: "ab63b6d3"          # odd-platform origin/main squash of PR #1834; faithful to reviewed 02f0ee60 (diff empty)
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
  All-tab **removal** (round-2) · faceted-deep-link share · back/forward. **GREEN on the worktree SUT**
  (`odd-platform:odd-team-sut-ctrib049` @ `f89c9a65`) — **2/2 passed** (`run-suite.sh IT-151`, reusing the built
  image: class-tab-write+removal 6.4s · deep-link-share+back/forward 3.9s). **RED proof on `ODD_SUT=ref:f63d3915`
  (SUT built fresh from the base — post-ST-1a, pre-ST-1b) — 2 FAILED ✅** (both tests time out waiting for the
  facet-URL that a class tab never produces on the base: 17.7s + 21.8s). **G-C15 complete: GREEN-on-fix / RED-on-base**
  — IT-151 genuinely requires the ST-1b behaviour, not a tautology. The feature is proven end-to-end on the running UI.

**FULL regression:** `run-regression.sh ctrib049` (SUT built from `f89c9a65`, digest `7e1fb618`) — **GREEN-FOR-CHANGE:**
- **feature-complete 331 passed / 2 failed** — both **contributor-independent**: `favorites-star-see-loop:159` (the
  **unmerged CTRIB-039 Group-B** Description column — RED on any non-Group-B SUT, incl. base) + `owner-association-history:129`
  (the known owner-association search flake, 1.0m timeout — a *different page's* server-side search, not my catalog code).
  **Every main-search test PASSES on my SUT** — IT-150 ST-1a query (292-295 ✓), IT-003 tsquery-poisoning (✓),
  search-session-not-found/D9 (✓) — proving the create-per-state rewrite preserved ST-1a's behaviour.
- **known-bugs 3 failed = expected-RED** (IT-004 quality-dashboard-unknown-status · IT-006 error-boundary · IT-007
  attachment-durability), 0 unexpected-green. · **multi-stack 9/0 GREEN** · **ingestion-e2e 15/0 GREEN**.
- *(The run began before the IT-151 registration, so IT-151 is proven separately — the targeted RED/GREEN below.)*

**DoD progress:**
1. **Unit build green on the working tree** — FE vitest 18/18 (node 24) + tsc + eslint clean ✅ · Java `:odd-platform-api:build`
   N/A (0 Java changed files → byte-identical to `main`, CI-green by construction).
2. **FULL integration regression on the working-tree SUT** — ✅ **GREEN-FOR-CHANGE** (feature-complete 331/2 both
   contributor-independent; known-bugs 3-RED-expected; multi-stack 9/0; ingestion-e2e 15/0) **+ IT-151 GREEN-on-fix
   2/2 · RED-on-base 2/2** (`ref:f63d3915`) — G-C15 complete.
3. **Docs read + decided + routed + AUTHORED on the train** — ✅ `search.md` updated on `docs/CTRIB-049-search-url-facets`
   @ `7259606` (off `release/1.0.0` `5b2bb04`); paired **DOC-497** (`pending-release`, 1.0.0). Push to the shared train
   is **maintainer-gated** (surface at GATE 2, as ST-1a/DOC-495).
4. **Ontology** — the search-flow sidecar refresh **deferred to merge** (same as ST-1a; the ontology tracks `main`, so
   nothing is stale until merge — justified, not the CTRIB-001 failure).
5. **Principal sufficiency (G-C13)** — enough + meaningful tests (unit both buckets + IT-151 e2e); no control lost; the
   full regression is green-for-change. **Pixel review N/A** — behaviour-only change, no visual delta (the search page /
   Filters / class tabs render identically; only the URL bar gains facet params); the rendered UI is proven by IT-151 +
   the regression's search specs (same as ST-1a).

**Phase E — DRAFT PR + handoff (2026-07-01):** all 5 DoD gates met (regression green-for-change; IT-151 GREEN-on-fix /
RED-on-base; docs authored on the train + DOC-497; ontology deferred-to-merge; sufficiency — pixel review **N/A**:
behaviour-only change, no visual delta — the search page / Filters / class tabs render identically, only the URL bar
gains facet params; the rendered UI is proven by IT-151 + the regression's search specs, exactly as ST-1a). Branch
`contrib/CTRIB-049-search-url-facets` @ `f89c9a65` pushed same-name (LSN-038-safe — upstream unset). **DRAFT PR #1834
OPEN** (bot-authored `odd-contributor[bot]`, draft, base `main`, `Part of #1825` — **no closing keyword, verified live**;
the bot cannot self-merge — G-C4). → status **`review-ready`** → **`/review`** (separate session, reject-by-default) →
**GATE 2** (human merge). **Maintainer action surfaced:** push the docs train — `git -C ../documentation-ctrib049docs
push origin HEAD:release/1.0.0` (DOC-497; the auto-mode classifier gates the agent's push to the shared release branch).

## Status
intake → G-C11 PASS (issue #1825 OPEN, milestone 1.0.0 OPEN/semver) → ST-1a-merged reconciled (`f63d3915`) →
consumer-read (G-C4 — extended to the Java backend after round 2) → design-before-build (G-C12) → spec-gate **0.104**
(PASS) → must_haves (G-C19) → **plan-check round 1: BLOCKER (orphaned class/My-Objects write) → reactive mirror** →
**plan-check round 2: BLOCKER (merge-not-replace can't remove a facet) → create-per-URL-state (REPLACE)** →
**plan-check round 3: PASSED, but escalated a reachable lost-update → fix preserves unsynced across REPLACE (now
touches the core search-sync reducer)** → **GATE 1 APPROVED 2026-07-01** (approach: reducer race-fix; scope: ST-1b/
ST-1c split) → **Phase D DONE** (5 files @ `f89c9a65`; unit 18/18 node 24; **full regression green-for-change**;
**IT-151 GREEN-on-fix 2/2 · RED-on-base 2/2**; docs authored on the 1.0.0 train + DOC-497; ontology deferred-to-merge)
→ **Phase E: branch pushed same-name; DRAFT PR #1834 OPEN (`Part of #1825`, no closing keyword)** → status
**`review-ready`** → `/review` (separate session) → **GATE 2** (human merge; the bot cannot self-merge). Surfaced
follow-ups: the docs-train push (maintainer-gated) + **ST-1c** (the W4 home/toolbar entry-point rewire).

## Review (2026-07-01, session: review-ctrib049) — VERDICT: REJECTED → `blocked`

Separate-session review, reject-by-default. Static verification against the reviewed commit `f89c9a65`
(worktree `../odd-platform-ctrib049`), with the FE↔BE contract read **first-hand in the Java**, plus the
tests / docs / gates. **One BLOCKER in the core search-sync reducer — a reachable, newly-introduced correctness
defect the integration suite does not exercise.** The full independent e2e rebuild was intentionally NOT run
(see Regressions) — the block stands on a static, Java-confirmed defect a local (RTT<400 ms) e2e cannot surface.

### BLOCKER — B1: after any sidebar-facet **deselect / Clear-All** (or any **`statuses` select**), `isFacetsStateSynced` is stranded `false`; the facet→URL mirror then stays armed and **reverts a later back/forward or query-commit** when the search RTT exceeds the 400 ms debounce.

**Mechanism — traced end-to-end, confirmed against the Java (not inferred):**
1. The reader CREATEs a fresh session per distinct URL state, so `updateSearchState` takes the **new-session**
   branch on every commit (`Search.tsx` reader effect; `dataEntitySearch.slice.ts:109-115`).
2. `search()` echoes **only *selected*** filters for the 7 sidebar facets:
   `SearchServiceImpl.search:76` (`removeUnselected`) → `getFacetsData:153` →
   `FacetStateMapperImpl.mapDto:165-174` maps each sidebar facet from the removeUnselected (selected-only)
   `state` (`FacetStateDto.removeUnselected:30-39`). `entityClasses` is the **exception** — echoed as a full
   histogram (`mapDto:167`), which is exactly why the class tab is immune.
3. A deselect / Clear-All leaves the option `{selected:false, syncedState:false}`
   (`slice.ts` `changeDataEntitySearchFacet` / `clearDataEntitySearchFacets`). On the create response,
   `carryPendingLocals` (`slice.ts:100-107`) keeps any `!syncedState && !(id in serverFacet)` option → the
   deselected id (absent from the response) is carried forward as a phantom, and `hasPendingLocals`
   (`slice.ts:117-121`) sets `isFacetsStateSynced=false`.
4. No later create can clear it: `getSearchUrlState` (`dataentitySearch.selectors.ts` — only `selected` numeric
   ids) omits the unselected option, so the mirror's normalised equality guard (`Search.tsx` `writeStateToUrl`:
   `nextParams !== location.search…`) is satisfied and never re-fires → `synced` is stuck `false` **permanently**.
5. A permanently-`false` `synced` keeps the mirror effect armed (`Search.tsx`: `if (!searchFacetsSynced)
   writeStateToUrl()`). On a subsequent **back/forward** or **query commit**, if the create's RTT > 400 ms the
   debounced writer fires first with the stale slice projection and `navigate()`s the URL back to the
   pre-navigation state — **silently reverting the navigation** (violates must_have **R3** back/forward and
   **R1** query-preserves-filters). Verified reachable by trace; the stuck *state* itself needs no latency.

**Second trigger (no deselect, no latency to reach the stuck state) — `statuses` is never echoed.**
`FacetStateMapperImpl.mapDto:165-174` maps entityClasses/datasources/types/owners/namespaces/tags/groups but
**not `statuses`**, yet `statuses` is a live DE-search sidebar facet (`Search/Filters/Filters.tsx:65`
`facetName='statuses'`) that the server *does* filter on (`FacetStateMapperImpl` `FORM_MAPPINGS` includes
`getStatuses → STATUSES`; `removeUnselected` keeps it). So **selecting a Status** produces an unsynced local the
server structurally never echoes → `hasPendingLocals` → `synced` stuck `false` immediately.

**Newly introduced by ST-1b.** Pre-ST-1b the same-session PUT (`updateFacets` merge, carrying the `selected:false`
delta) re-synced correctly and the old `updateSearchState` hard-set `isFacetsStateSynced:true`. The
create-per-URL-state + `hasPendingLocals` rewrite is what strands `synced`. This is a regression of the prior
deselect/synced behaviour, in the exact "core search → default to caution" area the round-3 escalation flagged.

**Reachable + UNTESTED.** IT-151 exercises **only** `entityClasses` (the immune facet: class-tab write + All-tab
"removal" + share + back/forward — `integration-tests/e2e/specs/search-url-facets.spec.ts`, 2 tests). The
sidebar-deselect / Clear-All / `statuses` paths have **no** integration coverage; the slice unit test
`…preserves an in-flight DESELECT…` (`dataEntitySearch.slice.test.ts`) asserts only `selected:false`, **not**
`isFacetsStateSynced` (which the reducer leaves `false` — verified with the test's own fixtures:
`created('session-2', [])` → tag carried, `synced=false`).

**Fix direction (rework — re-run G-C19 plan-check; it re-touches the core reducer + the mirror):**
`synced`/mirror-arming must not treat (a) a deselected option resolved by the server's omission, nor (b) a facet
the server structurally never echoes (`statuses`), as an in-flight "pending local." Candidate approaches: disarm
the mirror when `getSearchUrlState` already serialises to the current URL (arm on URL≠projection, not on
per-option `syncedState`), or gate arming on an actual in-flight create; **and** either add `.statuses(...)` to
`FacetStateMapperImpl.mapDto` (a pre-existing server response gap this change unmasks — this is contributor-pillar
in-scope, the same odd-platform change owns it) or drop `statuses` from `SEARCH_FACET_PARAMS`. Add RED-on-base
integration cases: (i) sidebar-facet (tag/owner) **deselect** → back/forward reproduces; (ii) a **status select**
→ back/forward. These are the exact dimensions the current tests skip.

### ⟶ Rework checklist (for the next `/contribute CTRIB-049` session — execute in order)
- [ ] **Lock the RED first.** On the current SUT, select a **Status** filter (or chip-✕ **deselect** a tag), then
  drive back/forward (or commit a query) — capture that `isFacetsStateSynced` stays `false` and the mirror reverts
  the navigation. That RED is what the fix must turn GREEN. (Local RTT<400 ms hides the visible symptom — assert on
  `isFacetsStateSynced` / the mirror re-fire, or throttle the search response, to make it deterministic.)
- [ ] **Fix `synced` / mirror-arming** (`dataEntitySearch.slice.ts` + `Search.tsx`): stop treating a
  server-omission-resolved **deselect**, or a **never-echoed facet**, as an in-flight pending local. Preferred: arm
  the mirror on `getSearchUrlState(slice) !== current URL` (not on per-option `syncedState`); keep the round-3
  in-flight-**selection** carry intact (don't reintroduce the lost-update).
- [ ] **Resolve the `statuses` response gap** — pick one and state why: add `.statuses(...)` to
  `FacetStateMapperImpl.mapDto` (`:165-174`, odd-platform-api — contributor-pillar in-scope), **or** drop `statuses`
  from `SEARCH_FACET_PARAMS` (`searchUrlState.ts`). Then re-verify the invariant for **every** facet in
  `SEARCH_FACET_PARAMS`: select → create-response echoes it (or is intentionally exempt) → `synced` returns true.
- [ ] **Add 2 RED-on-base integration cases** (extend IT-151/IT-150, RED on `ODD_SUT=ref:f63d3915`, GREEN on the
  fix): (i) sidebar-facet (tag/owner) **deselect** → back/forward reproduces; (ii) a **status select** → back/forward.
- [ ] **Assert `isFacetsStateSynced`** in the slice unit test (the exact gap that let B1 through — test #3 checked
  only `selected:false`).
- [ ] **Re-run the G-C19 adversarial plan-check** (the reducer changed again) → GATE 1 if the approach shifts → full
  regression on the fix SUT → re-submit to `/review`.

### Acceptance criteria (must_haves / Spec)
- R1 (facet→URL, query preserved) — **PARTIAL**: the `MainSearchInput` merge is correct (`useQueryParams`
  `setQueryParams(fn)` parses `prev` live from `location.search`, verified `useQueryParams.ts`), but a
  query-commit after a deselect/status-select can be reverted under latency (B1).
- R2 (faceted deep-link reproduces) — PASS (`Search.tsx` reader → `searchUrlStateToFormData` → create;
  IT-151 share test GREEN for the class facet).
- R3 (back/forward navigates facet states) — **FAIL** for the deselect/Clear-All/`statuses` paths under
  RTT>400 ms (B1). PASS for the select-only + class-tab paths.
- R4 (recipient-scoped, ids-only, fail-closed) — PASS (`searchUrlState.ts` positive-integer filter; ids only;
  inherited `/api/search` recipient scoping).
- R5 (D9 legacy `/search/{sessionId}` + `/api/search` unchanged) — PASS (`Search.tsx` `routerSearchId` branch
  byte-preserved; 0 Java diff on the search contract).
- R6 (param parse fails closed) — PASS (`paramsToSearchState` try/catch → empty; unit tests cover
  non-numeric/negative/zero/unknown).

### Quality Bar
- Gate 1 — PASS (extends `searchUrlState`/`useQueryParams`; no parallel state layer — verified no `useSearchParams` dup).
- Gate 2 — N/A (no alias).
- Gate 3 — N/A (code change; no doc admonition owed here).
- Gate 4 — PASS (`Consumer-read:` footer present + accurate; the cited Java `SearchServiceImpl`/`FacetStateDto` verified first-hand).
- Gate 5 — N/A (no SDK builder).
- Gate 6 — **FINDING folded into B1**: DOC-497's authored prose asserts "back/forward step through your filter changes" — a claim the code does not reliably deliver until B1 is fixed (code↔doc alignment; not a separate doc defect — the doc describes the intended, correct behaviour).
- Gate 7 — N/A (code; the doc edit is a 1-line replacement, SUMMARY/TOC unaffected).
- Gate 8 — release-gated (milestone 1.0.0). Doc AUTHORED on `docs/CTRIB-049-search-url-facets @ 7259606`
  (off train base `5b2bb04`; worktree `../documentation-ctrib049docs`; a clean 1-line `data-discovery/search.md`
  edit) but **NOT on `origin/release/1.0.0`** (train head `5b2bb04` = ST-1a's merge; branch not pushed to origin
  — maintainer-gated train push, the ST-1a/DOC-495 precedent). Would be **PENDING-RELEASE**; **superseded by the
  code BLOCKER** (item cannot advance). Not independently blocking.
- Gate 9 — PASS (every cited source verified: the Java merge/replace + mapDto read directly; the FE consumers read).
- Gate 10 — N/A.
- Gate 11 — PASS (no workspace-internal term in the authored `search.md` prose — grep clean).
- G-C7 (ADR) — PASS (correctly not fired: additive FE state↔URL, D9/D10 conform; verified `routerSearchId`/`/api/search` untouched).
- G-C11 (milestone open) — PASS (1.0.0 open/semver per intake).
- G-C15 (changed tests) — PASS: the 5 changed `searchUrlState.test.ts` cases only widen the expected object to
  the new `SearchUrlState` type; the query assertions are unchanged in substance, no matcher weakened, no `.skip`.
  (The *new* integration coverage is insufficient — that is the B1 test gap, not a G-C15 hidden-bug.)

- **Regressions**: independent full e2e rebuild **NOT run — intentional**. The verdict is BLOCKED on a static,
  Java-confirmed correctness defect that a local e2e (RTT<400 ms; the implementer's IT-151 GREEN is on such a
  stand) cannot exercise; re-confirming "green locally" on a commit going back for rework is low-value. Deferred
  to the reworked commit's regression. (The implementer's own run-logged `feature-complete 331/2` +
  `known-bugs 3-RED` are noted but not independently re-verified this pass.)
- **Navigation**: consistent (`navigation/domains/search.md` still points at `Search.tsx` + `dataEntitySearch.slice.ts`; no files moved; FE change, no new bean factory/SDK builder).
- **Upstream issues logged**: none (the `mapDto`-omits-`statuses` gap is contributor-pillar in-scope — folded into the B1 rework fix-list, not a hand-off).
- **Doc-product editorial audit** (per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: bounded to `data-discovery/search.md` (the item's neighbourhood). Full-tree audit
    deferred — sibling review-ctrib048 read the full tree 2026-06-30 (→ DOC-496, open). Partition noted; not skipped silently.
  - **Findings**: none surfaced this run. `origin/main`'s live `search.md` still documents the pre-overhaul
    `/search/{uuid}` session model (the ST-1a `?q=` rewrite rides the 1.0.0 train, not yet on main — correct
    release-gating); internally coherent, no parallel-surface drift on main.
- **Notes**: B1 mechanism VERIFIED via read of `SearchServiceImpl.java:76,153`, `FacetStateDto.java:30-39`,
  `FacetStateMapperImpl.java:165-174`, `dataEntitySearch.slice.ts:100-121`, `Search.tsx` (reader+mirror),
  `dataentitySearch.selectors.ts` (`getSearchUrlState`), and the two test files. `statuses`-not-echoed VERIFIED
  via grep of `mapDto` + `Filters.tsx:65` + `FORM_MAPPINGS`. Reject-by-default satisfied: the failing gate (R3
  back/forward) is cited with concrete evidence and a reachable failure scenario.

**Disposition:** `review-ready` → **`blocked`**. Rework B1 (fix `synced`/mirror-arming for the deselect/Clear-All/
`statuses` paths; resolve the `mapDto`-`statuses` gap; add the two RED-on-base integration cases), re-run the
G-C19 plan-check (re-touches the core reducer), then re-submit to `/review`. Resources: review held no SUT/flock/
lineage writes (read-only static review) — nothing to release; `lineage/**` untouched by this review.

## Rework — B1 fix (2026-07-01, resume)

Resumed on the `/review` REJECT. B1 re-root-caused **first-hand** against the reviewed commit `f89c9a65`
(FE + Java read in full, not inferred). Finding: B1 is **more severe** than the review stated — the stranded
`synced` is not only an RTT>400ms back/forward revert; it **deterministically blocks the results re-fetch**.

### Root cause (verified @ f89c9a65)
`isFacetsStateSynced` is load-bearing beyond the mirror:
- **`Results.tsx:76-81`** fetches results ONLY when `searchFiltersSynced === true`; **`getSearchIsFetching`**
  (`dataentitySearch.selectors.ts:90`) is `… || !isSynced`. A stranded `false` ⇒ **results never reload after
  the trigger and the loader spins** — deterministic (no latency needed).
- **`updateSearchState` new-session branch** (`slice.ts:96-127`): `carryPendingLocals` keeps any
  `!syncedState && !(id in serverFacet)` option; `hasPendingLocals` then forces `synced=false`. The predicate
  **cannot distinguish** a genuine in-flight SELECTION (round-3, `selected:true`) from (i) a resolved
  DESELECTION (`selected:false`) or (ii) a `statuses` SELECTION the server structurally never echoes.

Two triggers, both traced end-to-end:
- **T1 — sidebar deselect / Clear-All.** `search()` echoes only *selected* filters for the 7 sidebar facets
  (`SearchServiceImpl.search:76` `removeUnselected` → `getFacetsData:153` → `FacetStateMapperImpl.mapDto:164-174`).
  A deselected id is absent → carried as a phantom `{selected:false, syncedState:false}` → `synced` stranded.
  (`entityClasses` is immune — echoed as a full histogram `mapDto:167`, so IT-151's class-tab cases stayed green.)
- **T2 — `statuses` select.** `mapDto:164-174` maps 7 facets but **omits `statuses`**, though `FORM_MAPPINGS:48`
  *filters* on it and `FacetState.statuses` exists in the contract (`NOT_REQUIRED`). A selected status is never
  echoed → shape-identical to a pending selection → carried → `synced` stranded immediately. (Also: a deep-link
  `?statuses[]=S` filters correctly but the status chip never renders — `facetState.statuses` stays empty.)

Newly introduced by ST-1b: pre-ST-1b the same-session PUT (`updateFacets` merge) carried the `selected:false`
delta and the old `updateSearchState` hard-set `synced=true`; create-per-URL-state + `carryPendingLocals`
strands it.

### Design before build (G-C12)
- **Reuse / subtract — no mirror rewrite.** The review floated "arm the mirror on URL≠projection"; unnecessary
  and riskier. Once `synced` is correct, the EXISTING mirror (`Search.tsx:94-104`, already equality-guarded) and
  the Results-fetch gate are correct. Fix the two true defects at their source; **Search.tsx / searchUrlState /
  selectors / MainSearchInput stay byte-unchanged.**
- **(A) BE — echo `statuses`.** `FacetStateMapperImpl.mapDto(entityClasses, state)` gains
  `.statuses(getSearchFiltersForFacetType(state, FacetType.STATUSES))` (the same helper the other 7 use, `:185`).
  **Additive fill of an existing `NOT_REQUIRED` contract field** (`components.yaml:1618` / generated
  `FacetState.java:264,282` / FE `FacetState.ts:82`) — no spec change, no client regen, **G-C7 does not fire**.
  Resolves T2 (statuses echoed → not a phantom; deep-link chip renders). Inert for TermSearch (separate `mapDto`);
  strictly improves legacy-session load (`getFacets`).
- **(B) FE — carry only genuine pending SELECTIONS.** `slice.ts`: `carryPendingLocals` predicate becomes
  `option.selected && !option.syncedState && !(id in serverFacet)`; `hasPendingLocals` counts
  `option.selected && !option.syncedState`. A resolved deselection is dropped (server-authoritative), never a
  phantom. **Preserves** the round-3 in-flight-SELECTION carry (test #1) + the clean REPLACE (test #2).
- **ADR-check:** conforms to D10 (URL is SoT) + D9 (legacy session + `/api/search` untouched). `adr_required`
  stays false.
- **Impact:** i18n none · generated clients none (statuses already both sides) · every `synced` consumer
  (mirror + Results fetch-gate + `getSearchIsFetching`) *benefits* from correct `synced`, none change · migrations
  none · docs — DOC-497's "back/forward step through your filter changes" claim becomes reliably true (re-verify
  at DoD, no edit expected) · ontology — search-flow sidecar refresh stays deferred-to-merge.
- **PO/SRE lens:** every sidebar facet + statuses become shareable / deselectable / back-forward-correct (not
  just the class tab); statuses ids are catalog metadata (no PII); no perf change.

### Scope change vs the approved plan → GATE-1 re-decision
The 2026-07-01 GATE 1 approved "reducer race-fix; 5 FE files, **0 Java**, FE-only additive." The rework **adds
1 Java file** (`FacetStateMapperImpl.java`, additive) — a change to the **search response**, the maintainer's
explicit *"core search → default to caution"* area — plus the slice-reducer refinement. FE-only alternatives are
worse: **dropping `statuses` from the URL BREAKS status filtering** (ST-1b routes *all* facet application through
URL→create; the old slice-PUT path is gone), and tracking an "applied state" in the slice is more invasive AND
leaves the deep-link-chip bug. The additive Java echo is the correct, minimal fix → **surfaced at GATE 1.**

### must_haves delta (B1)
```yaml
truths:                         # user-observable; each verifiable on the running stack
  - "Deselecting a sidebar filter (chip-✕) or Clear-All reloads the results (they broaden) — no stuck loader, no stale list"   # T1
  - "Selecting a Status filter narrows the results and the status chip shows selected; /search?statuses[]=<id> reproduces it"    # T2
  - "After a deselect / status change, a later Back/Forward or query commit is NOT reverted"                                     # T1/T2 (the review's cited symptom)
  - "A rapid 2nd facet selection during an in-flight search is still not lost"                                                   # round-3 PRESERVED
artifacts:
  - path: "odd-platform-api/.../mapper/FacetStateMapperImpl.java"
    provides: "mapDto(entityClasses, state) echoes statuses via getSearchFiltersForFacetType(state, FacetType.STATUSES)"
    anchor: ".groups(getSearchFiltersForFacetType"
  - path: "odd-platform-ui/src/redux/slices/dataEntitySearch.slice.ts"
    provides: "carryPendingLocals + hasPendingLocals carry/count only selected:true pending locals"
    anchor: "carryPendingLocals"
  # NO change to Search.tsx / searchUrlState.ts / dataentitySearch.selectors.ts / MainSearchInput.tsx
key_links:
  - from: "any non-immune facet change (sidebar deselect / Clear-All / status select)"
    to: "isFacetsStateSynced === true after the create response"
    via: "(B) carry-selected-only drops resolved deselects; (A) mapDto echoes statuses so a selected status is in serverFacet"
    breaks_if: "a selected:false phantom (T1) or a never-echoed statuses select (T2) is carried → synced stuck → Results.tsx never fetches + the mirror stays armed → revert"
  - from: "a selected Status"
    to: "the /api/search response facetState.statuses"
    via: "FacetStateMapperImpl.mapDto .statuses(...)"
    breaks_if: "mapDto omits statuses → deep-link chip missing + synced strand (T2)"
  - from: "an in-flight 2nd selection during a create"
    to: "carried across the new-session REPLACE (synced=false re-fires the mirror → create the newer state)"
    via: "carryPendingLocals keeps selected:true unsynced not-in-serverFacet options"
    breaks_if: "the selected filter is added to the predicate wrongly and drops a genuine pending selection → round-3 lost-update returns"
```

### Tasks
1. **(B) slice** `dataEntitySearch.slice.ts`: add `option.selected &&` to `carryPendingLocals`'s `pickBy` predicate; make `hasPendingLocals` count `option.selected && !option.syncedState`. Same-session branch (`assignFacetStateWithNewFacets`) byte-unchanged.
2. **(A) Java** `FacetStateMapperImpl.mapDto(List<CountableSearchFilter>, FacetStateDto)`: add `.statuses(getSearchFiltersForFacetType(state, FacetType.STATUSES))`.

### Tests (G-C9 both buckets · G-C15 surviving-RED)
- **Unit (FE slice)** — FIX test #3: assert the deselected option is dropped **AND `isFacetsStateSynced === true`** (RED on `f89c9a65`: synced=false; GREEN on fix). SoT for the new value = correct behaviour (a resolved deselect is not pending → Results must fetch). Keep #1 (in-flight selection carried, synced=false) + #2 (clean REPLACE) unchanged — round-3 proof.
- **Unit (Java)** — NEW `FacetStateMapperImplTest` (or extend a search test): `mapDto(entityClasses, state-with-selected-STATUSES).getStatuses()` reflects the selected statuses (RED on base: null/empty; GREEN on fix) → patch-coverage (G-C13) on the changed line.
- **Integration (IT-151 extend)** — 2 cases, assertions on **captured real shapes**, RED on `f89c9a65` (the B1-specific base) AND `ref:f63d3915` (the ST-1b feature base), GREEN on the fix:
  - **A — sidebar deselect reloads results.** Deep-link a sidebar facet (`?q=…&types[]=<TABLE typeId>`) → dataset only + the type chip selected; deselect (chip-✕ or Clear-All) → results broaden (group returns). RED on `f89c9a65`: synced strands → group never returns / loader persists.
  - **B — status deep-link filters + chip.** Deep-link `?q=…&statuses[]=<id>` → filtered results + the status chip selected. RED on `f89c9a65`: chip missing + results don't settle.
- **Full regression** on the fix SUT: feature-complete green + multi-stack + known-bugs still-RED + ingestion-e2e + IT-151 GREEN-on-fix / RED-on-base. Java `:odd-platform-api:build` now RUNS (Java changed) + local patch-coverage.

## Plan-check round 4 (G-C19) — B1 rework: VERIFICATION PASSED (0 BLOCKER, 2 WARNING)

The adversarial `plan-checker` (fresh context, goal-backward, re-derived every `file:line` against `f89c9a65`)
returned **VERIFICATION PASSED**. Confirmed first-hand: (A)+(B) are **individually necessary and jointly
sufficient** for both triggers (T1 needs (B); T2 needs (A) — without the echo, a selected status is a phantom
even under (B)); the round-3 in-flight-SELECTION carry is **preserved** (slice tests #1/#2 stay green under the
new predicate); the Java echo is additive (`FacetState.statuses` NOT_REQUIRED, `components.yaml:1618`;
`FacetType.STATUSES` exists; Term path separate — no G-C7, no regen); leaving Search.tsx/searchUrlState/selectors/
MainSearchInput unchanged is safe (complete `getSearchFacetsSynced` consumer set = mirror + `Results.tsx:53`
fetch-gate + `getSearchIsFetching` loader; `termSearch` is a separate slice); scope-growth flagged, no facet
dropped.

**WARNING 1 (the GATE-1 item) — symmetric round-3 parity: a rapid double-DESELECT lost-update remains.** The fix
carries pending *additions* (absent from the in-flight create's response) but structurally cannot carry a pending
*removal*: a facet deselected *during* an in-flight create is still `selected:true` in that create's response, so
it is present in `serverFacet`, the `option.selected` predicate drops the optimistic `selected:false`, and the
server value resurrects it → the 2nd deselect is lost (chip reappears; results stay filtered). Verified reachable
at the same pace the round-3 SELECTION race was (2nd toggle ~½s later, RTT < 400ms). **Not introduced by this fix**
(`f89c9a65` is worse — strand *and* lose) and **outside the two stated B1 triggers** (both delivered + strictly
improved) → WARNING, not BLOCKER. But it is the exact mirror of the race the maintainer escalated as unacceptable
for core search, and `must_haves.truths[4]` claims parity only for *selection* → **surfaced at GATE 1**, not left
implicit. Two dispositions: **(B) minimal** (carry-selected-only) + log the edge as a follow-up CTRIB, or **(B′)
root fix** — replace the `!(id in serverFacet)` heuristic with an optimistic-vs-requested reconciliation
(`action.meta.arg.searchFormData.filters`), which fixes the double-deselect symmetrically and removes the leaky
heuristic class that produced B1. Both include (A) the statuses echo.

**WARNING 2 (fold-in, no decision) — truth #3 (no-revert) is only transitively tested.** The 2 new IT cases don't
drive a Back/Forward *after* a deselect to directly assert "not reverted." Cheap strengthening: in IT case A, after
the deselect reloads, add `page.goBack()` + assert the URL is not re-reverted. → folded into the IT-151 case-A plan.

## GATE 1 — APPROVED (2026-07-01, rework): B′ (root fix) + statuses echo

Maintainer chose **Root fix (B′) + parity** via AskUserQuestion: replace the leaky `!(id in serverFacet)`
heuristic with an **optimistic-vs-requested reconciliation** (`action.meta.arg.searchFormData.filters`) —
fixing B1's T1/T2 **and** the symmetric rapid-double-DESELECT lost-update (WARNING 1), removing the heuristic
class that produced B1 — plus **(A)** the additive `statuses` echo in `mapDto`. Scope: **2 source files**
(`FacetStateMapperImpl.java` +1 line · `dataEntitySearch.slice.ts` reconciliation). This meets the maintainer's
round-3 reliable+stable parity bar in the "core search → caution" area (their revealed preference: fix this
lost-update class, not defer it).

**Approved plan (authoritative for Phase D):**
- **(A) Java** `FacetStateMapperImpl.mapDto(entityClasses, state)` += `.statuses(getSearchFiltersForFacetType(state, FacetType.STATUSES))`.
- **(B′) slice** `updateSearchState` new-session branch: `carryPendingLocals(facet)` keeps `oldFacet` options where `!option.syncedState && option.selected !== requested.has(option.entityId)` (requested = the create's `meta.arg.searchFormData.filters` selected ids); `hasPendingLocals` = any remaining `!syncedState`. Same-session branch byte-unchanged. Handles pending SELECT + pending DESELECT symmetrically; legacy `get.fulfilled` (no `searchFormData`) → clean REPLACE (no optimistic locals on a legacy load).
- **Tests:** slice unit — update `fulfil` to carry requested filters; #1 (in-flight select carried), #2 (clean REPLACE), #3 (single deselect → dropped + `synced=true`, RED-on-base), **NEW #4** (double-deselect → optimistic `selected:false` preserved + `synced=false`, RED-on-base — proves B′ over B). Java unit — `mapDto` echoes statuses (RED-on-base). IT-151 — case A (sidebar deselect → results reload + `goBack` no-revert, W2 fold-in) + case B (status deep-link → filtered + chip). Full regression on the fix SUT (Java build now runs).

`plan_approved_by`: maintainer — GATE 1 AskUserQuestion 2026-07-01 (rework: B′ root fix + statuses echo).

## Phase D — B1 rework implementation (2026-07-01 → 02, resume session 2)

Resumed mid-Phase-D: the prior resume session had implemented **(A)** + **(B′)** + the slice tests (#3/#4
rewritten, `fulfil` carries `meta.arg` filters) + the new `FacetStateMapperImplTest` + IT-151 case A
(all uncommitted in `../odd-platform-ctrib049`), and was interrupted before IT-151 case B. This session
verified the implemented fix line-by-line against the GATE-1-approved plan (MATCH — predicate
`!syncedState && selected !== requested.has(id)`; `hasPendingLocals` = any remaining `!syncedState`;
same-session branch byte-unchanged; legacy GET → clean REPLACE), fixed the Java-test fixture id
(3L→4L: `DataEntityStatusDto` STABLE=3/DEPRECATED=4 — fixture said DEPRECATED), completed the test set,
and ran the full evidence ladder below.

### The THIRD defect — sidebar chips lose their labels (found, decided, fixed this session)

While preparing IT-151 case B's chip assertion (capture-first rule), traced + **verified live** on the
running fix stack: the ST-1b reader builds every create request **from the URL (ids only)**
(`searchUrlStateToFormData` — its own docstring *claimed* "names backfill from the response"), and the
server echoes back exactly the names the request carried (`SearchServiceImpl.search:75-82` →
`getFacetsData` → `mapDto` → `mapFilter` `entityName(f.getEntityName())`; `SearchMapperImpl.mapDto` maps
`.name(dto.getEntityName())` — **no name resolution anywhere**). `updateSearchState.setFacetOptionsById`
then overwrote the optimistic labelled entry with the name-less echo → **every sidebar-facet chip lost its
label ~1 s after selection** (`SelectedFilterOption` renders `entityName` via `TextFormatted`, which renders
NOTHING for undefined → a bare ✕ chip). Pre-ST-1b the debounced PUT carried names (the optimistic delta
includes `entityName`), so this is a **regression vs main introduced by ST-1b**, distinct from B1's
two triggers, invisible to IT-151 (class facet = named histogram) and to the review.

**Evidence (captured, not reasoned):** wire — `POST /api/search` with `{"tags":[{"entity_id":1,"selected":true}]}`
echoes `"tags":[{"id":1,"name":null}]` (live capture; note the response `"statuses":[]` — the (A) echo active).
Pixels — Playwright probe on the fix stack: T+0 chip "Obs probe tag ✕" labelled; T+4 s URL correctly
`?q=obsprobe&tags[]=1`, results correctly filtered, **chip label GONE** (`getByTitle` count 0), bare ✕
(screenshots `integration-tests/e2e/evidence/obs-chip-{1,2}-*.png`).

**Scope decision (AskUserQuestion fired 2026-07-02 ~00:10; maintainer away → 60 s timeout → proceeded on the
recommended option per the autonomous operating model; requires ratification at GATE 2 / re-review):**
**Fold in the minimal name-preserving merge** — `setFacetOptionsById` keeps the already-known `entityName`
when the echo has none (`facetOption.name ?? state.facetState[facetName]?.[id]?.entityName`; same reducer B′
rewrites; ~6 lines + comment). Restores main-parity for the interactive flow + in-session back/forward.
Rationale: erases the regression with a bounded change; forward-compatible with (and not foreclosing) the
full server-side fix; matches the maintainer's reliable+stable bar and the ST-1b/1c slicing philosophy.
Alternatives surfaced in the question: BE echoes resolved names now (hot-path per-facet lookups — too big to
absorb unratified), or ship-approved-scope-only (knowingly ships the interactive regression — rejected).

**The residual (explicit truth reduction vs the ORIGINAL ST-1b plan — tracked as ST-1d):** a **fresh**
faceted deep-link (recipient, new tab) renders its chips **present but unlabelled** — there is no known name
to preserve client-side. The original plan's R2 acceptance "shows the tag chip selected", key_link #5's
"names backfill server-side", and round-4 T2's "the status chip shows selected; `/search?statuses[]=<id>`
reproduces it" all rested on the now-falsified backfill premise — **the delivered truth is: the deep-link
reproduces the filtered RESULTS and the filter state (functional ✕ chip); its LABEL arrives with ST-1d**
(server resolves names in the echo — which also fixes the echo violating the spec's own
`SearchFilter.required: [id, name]`). Follow-up on disk: `state/search-overhaul-decomposition.md` § ST-1
"Sub-slice ledger" → **ST-1d**; cited from the IT-151 spec comment + protocol §4.6.

### must_haves delta (label-preserve; extends the GATE-1 B′+A contract)
```yaml
truths:
  - "A sidebar-facet chip keeps its label after the search settles (select flow; was: blanked ~1s after every selection)"
  - "REWORDED T2 (deep-link half): /search?statuses[]=<id> reproduces the status-FILTERED results and the applied filter state; the chip LABEL on a fresh deep-link is ST-1d"
artifacts:
  - path: "odd-platform-ui/src/redux/slices/dataEntitySearch.slice.ts"
    provides: "setFacetOptionsById(facetOptions, facetName) preserves the known entityName when the echo is name-less"
    anchor: "recipient-side label backfill is a logged follow-up"
key_links:
  - from: "the name-less create echo (name:null for URL-derived requests)"
    to: "the rendered SelectedFilterOption label"
    via: "entityName: facetOption.name ?? state.facetState[facetName]?.[id]?.entityName"
    breaks_if: "the echo value is taken verbatim → TextFormatted renders nothing → a bare ✕ chip on every facet selection"
```

### Plan-check round 5 (G-C19, the grown reducer change) — ISSUES FOUND → resolved in-session
Adversarial re-check of the implemented (A)+(B′)+name-preserve: **code and tests SOUND** — all round-4 truths
re-verified under the grown implementation (T1/T2, round-3 SELECT carry, W1 DESELECT parity, legacy GET clean
REPLACE — `getDataEntitiesSearch` arg carries no `searchFormData`); the merge introduces no new defect
(carried pending locals keep their own labels; entityClasses histogram unaffected; `'my'` never in facetState;
same-session branch consumes the shared name-preserving builder; types/lint clean); RED-locks verified
(slice #3/#4/#5, Java test, IT-151 A+B), G-C15 clean (#3 adds a STRICTER oracle; #1/#2 byte-unchanged);
scope = exactly (A)+(B′)+merge+tests; G-C7 does not fire (`FacetState.statuses` existing NOT_REQUIRED field,
no regen). **1 BLOCKER (plan-integrity, no code rework): the label residual was an untracked truth-reduction —
resolved:** ST-1d written into the decomposition's Sub-slice ledger + cited from spec/protocol + this section
rewords T2 + the GATE-1 ratification is queued (below). **2 WARNINGS resolved:** the `meta.arg` comment
corrected (update DOES carry `searchFormData`; behaviourally moot — thunk orphaned); the deep-link
chip-presence automation omission recorded as DELIBERATE in protocol §4.6 (ST-1d scope) rather than growing
the spec after the RED runs were captured.

### Evidence ledger (every gate ACTUALLY RUN this session; worktree `../odd-platform-ctrib049`, uncommitted → committed below)
- **FE unit (node:24 container):** the 3 affected files **20/20 GREEN on the fix** (searchUrlState 11 ·
  slice 5 incl. NEW #5 label-preserve · useQueryParams 4). **RED-on-base (f89c9a65 slice.ts swapped in):
  #3, #4, #5 FAIL — 3 failed / 2 passed** (#1/#2 pass: round-3 carry pre-existed). `tsc --noEmit` CLEAN;
  `eslint` on all changed FE files CLEAN.
- **Java unit:** `FacetStateMapperImplTest` (2 tests) — **RED on the base mapper (2 failures:
  "Expecting actual not to be null" — `getStatuses()` null)** → **GREEN on the fix** (fresh XML evidence).
  **Full CI replica `scripts/run-platform-tests.sh` (`:odd-platform-api:build` = test + checkstyleMain +
  checkstyleTest + assemble): BUILD SUCCESSFUL in 10m36s.**
- **Patch coverage (G-C13):** the repo's jacoco config **structurally excludes `**/*MapperImpl*`**
  (build.gradle:181-188, "MapStruct-generated impls" — the glob also catches this hand-written class), so
  `FacetStateMapperImpl` has NO measurable lines in the CI coverage gate → the 98% changed-files gate is
  vacuous for this diff; the changed line is nonetheless directly unit-tested RED→GREEN (above). The FE file
  is outside the Java gate. (The over-broad glob is an upstream repo-config nit — noted, not this PR's scope.)
- **IT-151 ladder (stream ctrib049, ports 18210/15610):**
  - **GREEN on the fix SUT: 4/4 passed** (class-tab write/removal 6.6s · share+back/forward 5.4s ·
    case A sidebar-deselect+Clear-All+goBack-no-revert 5.2s · case B status select/label/deep-link 6.7s) —
    run-log `2026-07-02-IT-151.md` (the preceding e2e:FAIL entry = the spec's OWN afterAll FK bug — tag link
    not cleared before the entity DELETE — fixed in the spec teardown, not a SUT defect).
  - **RED on `ODD_SUT=ref:f89c9a65` (B1 base): 2 failed / 2 passed — EXACTLY per prediction** (the 2 original
    immune-facet cases pass; case A fails — stranded `synced`, the group never returns; case B fails — no
    statuses echo → results freeze).
  - **RED on `ODD_SUT=ref:f63d3915` (feature base): see the run-log entry** (expected: 4/4 fail — no facets
    in the URL at all).
- **Docs re-verified (G-C10/11):** DOC-497's authored `search.md` @ documentation `7259606` re-read — every
  claim ("filters in the URL", "back/forward step through filter changes", "reproduces the entire faceted
  search") is **reliably true post-fix**; the text does not promise recipient-side chip LABELS → **no doc
  edit needed**; ST-1d does not gate DOC-497.
- **Ontology (G-C10):** search-flow sidecar refresh stays **deferred-to-merge** (ST-1a/ST-1b precedent — the
  ontology tracks `main`; nothing stale until the PR merges).

### FULL regression (committed SHA `02f0ee60`; `run-regression.sh ctrib049`, flock held, torn down after)
- **feature-complete: 336 passed / 1 failed — GREEN-FOR-CHANGE.** The 1 = `favorites-star-see-loop.spec.ts:159`
  (the #1815 Group-B Description column) — the documented **contributor-independent** failure (asserts unmerged
  CTRIB-039 Group-B behaviour; RED on any non-Group-B SUT incl. main). The prior run's owner-association flake
  did NOT recur. Every search spec GREEN (catalog-search, search-url-state ST-1a, search-url-facets IT-151,
  tsquery-poisoning IT-003, search-session-not-found D9, class-tab-filter, suggestions).
- **known-bugs: exactly 3 failed = IT-004 · IT-006 · IT-007 (expected-RED), 0 unexpected-green.**
- **multi-stack: PASS** · **ingestion-e2e: 15/15 PASS** (first pass, same SHA/digest `3948e2ac…`).
- *Process note:* the first pass's per-suite counts were lost to an output-truncation mistake (regression piped
  through `tail -40`; `results.json`/`test-results` overwritten by later suites) → feature-complete + known-bugs
  were **re-run under the flock** with full capture (`SUT b4cc5c4b…` from the same clean `02f0ee60`) — the
  counts above are from that run's log. Tooling follow-up noted below.

### DoD — all five gates ACTUALLY RUN at the committed SHA
1. **Unit build green on the working tree** ✅ — FE vitest 20/20 (node 24) + `tsc` + `eslint` clean; Java FULL
   `:odd-platform-api:build` (test + checkstyle ×2 + assemble) **BUILD SUCCESSFUL 10m36s**.
2. **FULL integration regression on the working-tree SUT** ✅ — green-for-change (336/1 contributor-independent ·
   kb 3-RED-expected/0-green · ms PASS · ie 15/15) **+ IT-151 GREEN-on-fix 4/4 · RED-on-`ref:f89c9a65`
   2-of-2-new · RED-on-`ref:f63d3915` 4/4** — G-C15 complete for every new/changed test.
3. **Docs read + decided + routed + authored** ✅ — DOC-497 on `docs/CTRIB-049-search-url-facets @ 7259606`
   (train `release/1.0.0`); re-read this session: every claim reliably true post-fix, **no edit needed**;
   ST-1d does not gate it. Train push stays maintainer-gated (ST-1a/DOC-495 precedent).
4. **Ontology** ✅ — deferred-to-merge (tracks `main`; ST-1a/ST-1b precedent). The unowned prior-run lineage
   drift (feature-flows + 2 sidecars + P-001 yamls) stays routed-around, uncommitted (O10).
5. **Principal sufficiency (G-C13)** ✅ — both buckets meaningful + RED-locked per defect dimension;
   patch-coverage: the jacoco `**/*MapperImpl*` exclusion makes the gate vacuous for the changed mapper
   (recorded; behaviour proven by the direct RED→GREEN test); **pixel review DONE this time** — the chip
   surface was driven and screenshotted (evidence PNGs; the settled chip keeps its label on the fix).

**Follow-ups logged:** **ST-1d** (deep-link chip-label resolution — `state/search-overhaul-decomposition.md`
§ST-1 Sub-slice ledger; also covers the echo violating `SearchFilter.required:[id,name]`) · **tooling** — the
run-log template records neither pass/fail counts nor the `ODD_PLATFORM_DIR` HEAD (it logs the default
checkout's HEAD — misleading on worktree streams) — logged in the ledger here for the tests-pillar sweep.

## Status: `review-ready` (2026-07-02) → re-`/review` (separate session) → GATE 2
Commit `02f0ee60` pushed same-name (upstream-unset worktree, push.default=current, pre-push assertion run);
DRAFT PR #1834 body updated with the rework section (live-verified: draft, `Part of #1825`, no closing
keyword; milestone 1.0.0 re-verified OPEN on #1825). **GATE-2 ratification item (lead):** the label-preserve
scope fold-in was decided autonomously after the AskUserQuestion timed out — the maintainer ratifies (or
reverses) it at review/merge; the full decision record is in "The THIRD defect" above.

## Re-Review (2026-07-02, session: review-ctrib049-2) — VERDICT: ACCEPTED → stays `review-ready` (GATE-2-ready)

Separate-session re-review of the B1 rework (`02f0ee60`), reject-by-default. Unlike the 2026-07-01 static-only
pass, this review **independently RAN the full regression + the Java CI-replica build** on a SUT built from the
reviewed commit (`ODD_SUT=working`; worktree `../odd-platform-ctrib049` CLEAN at `02f0ee60`; stream `ctrib049`,
flock acquired then released, stack torn down). B1 was re-verified **first-hand** in the FE reducer + the Java —
not inferred. **Result: B1 is FIXED (both triggers), no regression introduced, every gate PASSes.** Two
scope/product decisions are surfaced for the human at GATE 2 (they fail no gate — the code is correct and both
are honestly tracked): the label-preserve fold-in and the ST-1d truth-reduction.

### Acceptance criteria (reworded must_haves + Spec)
- [x] **R1** (facet→URL, query preserved) — PASS. `MainSearchInput` merge unchanged; a deselect/status now
  correctly updates the URL post-B1 (the prior "revert-under-latency" PARTIAL resolved). Ev: IT-151 t294 GREEN.
- [x] **R2** (faceted deep-link reproduces) — PASS for RESULTS + filter state (IT-151 t293/t295). The chip **label**
  on a FRESH deep-link is deferred to **ST-1d** — independently corroborated: `searchUrlStateToFormData`
  (`searchUrlState.ts:130-139`) sends **ids only** (`entityName` intentionally omitted) → the server echoes
  `name:null` (no name resolution in `mapFilter`/`SearchMapperImpl.mapDto`) → nothing client-side to label a
  recipient's chip.
- [x] **R3** (back/forward navigates facet states) — PASS. The stranded-`synced` revert is gone; IT-151 t293/t294.
- [x] **R4** (recipient-scoped, ids-only, fail-closed) — PASS. `searchStateToParams` emits ids only; recipient
  scoping inherited from the unchanged `/api/search`.
- [x] **R5** (D9 legacy + `/api/search` unchanged) — PASS. `Search.tsx` `routerSearchId` branch byte-unchanged;
  the Java change fills an existing NOT_REQUIRED response field (no wire-contract break). `search-session-not-found`
  284-288 GREEN.
- [x] **R6** (fail-closed parse) — PASS. `paramsToSearchState` try/catch-wrapped + coerces facet ids to
  `Number.isInteger(n) && n > 0`; `search-tsquery-poisoning` (IT-003) GREEN.

### B1-rework truths (the must_haves delta)
- [x] **T1** — a sidebar-facet **deselect / Clear-All** reloads + broadens results, no stuck loader, no strand.
  Verified: reducer trace (the B′ predicate `!syncedState && selected !== requested.has(id)` DROPS a resolved
  deselect → `hasPendingLocals` false → `synced` true → `Results.tsx` fetches) + slice test **#3 RED-on-base** +
  **IT-151 t294 GREEN**.
- [x] **T2** — a **status** filter narrows results, keeps its chip, deep-links. Verified: `mapDto` echoes `statuses`
  (`FacetStateMapperImpl.java:177`; `FORM_MAPPINGS:48` already filters STATUSES; `FacetState.statuses` is an
  existing NOT_REQUIRED spec field @ `components.yaml:1587` → additive, no regen) + `FacetStateMapperImplTest`
  RED-on-base (`getStatuses()` null) + **IT-151 t295 GREEN**.
- [x] **No-revert after deselect/status** — PASS (synced returns true → the mirror disarms; traced + IT-151 t294/t295).
- [x] **Round-3 in-flight SELECT preserved** — PASS (the predicate keeps an optimistic option whose `selected`
  differs from the create's request; slice test #1 GREEN).
- [x] **Symmetric rapid double-DESELECT** (round-4 WARNING 1) — PASS/FIXED as a bonus (B′ over B); slice #4 RED-on-base.
- [x] **Label-preserve** (interactive chip keeps its label) — PASS. `setFacetOptionsById` keeps the known
  `entityName` when the echo is name-less; slice #5 RED-on-base + IT-151 t295.

### Quality Bar
- **Gate 1** — PASS (extends `searchUrlState`/`useQueryParams`; no parallel state layer; the rework adds no new
  layer) via read of the diff + no `useSearchParams` dup.
- **Gate 2** — N/A (no alias).
- **Gate 3** — N/A (code; the release-gated-behaviour admonition is DOC-497 on the train).
- **Gate 4** — PASS. `Consumer-read:` footer accurate; verified first-hand: `SearchServiceImpl`, `FacetStateDto`,
  `FacetStateMapperImpl` (`FORM_MAPPINGS`+`mapDto`), the slice reducer, `dataentitySearch.selectors.ts`
  (`getSearchUrlState`), `Search.tsx` (reader/mirror), `searchUrlState.ts`.
- **Gate 5** — N/A (no SDK builder).
- **Gate 6** — PASS. Code paths documented via DOC-497 (train). One LOW code↔doc note: the doc's "reproduces the
  **entire faceted search**" runs slightly ahead of the ST-1d fresh-deep-link-chip-label residual → owned by ST-1d
  + re-verified at the 1.0.0 release gate (`/review release:1.0.0`); NOT a new item (ST-1d owns it).
- **Gate 7** — N/A (code; DOC-497 = 1-line replacement, SUMMARY/TOC unaffected).
- **Gate 8** — **PENDING-RELEASE (1.0.0)**. Code ships via PR #1834 (GATE-2 human merge). DOC-497 is **authored** on
  the train `docs/CTRIB-049-search-url-facets @ 7259606` (off `release/1.0.0` `5b2bb04`, touches
  `data-discovery/search.md`) — authored, not merely drafted → not a Gate 8 FAIL; the train push is
  maintainer-gated (ST-1a/DOC-495 precedent). Post-release live-verify: `docs.opendatadiscovery.org/data-discovery/search`
  — phrases "Your filters are in the URL too", "back / forward step through your filter changes".
- **Gate 9** — PASS. Every cited source verified first-hand (Java merge/replace + `mapDto` + `FORM_MAPPINGS` + the
  `FacetState.statuses` NOT_REQUIRED spec field + the FE consumers). Banned-phrase check: none used.
- **Gate 10** — N/A (code).
- **Gate 11** — PASS. Grep of the authored `search.md` for workspace-internal terms
  (Cornerstone/Gate N/LSN/CTRIB/sidecar/must_haves/ST-1b/B1/…) — CLEAN.
- **G-C7** (ADR) — PASS (correctly not fired: additive `FacetState.statuses` fill, no regen; `/api/search` contract
  untouched; D9/D10 conform).
- **G-C11** (milestone) — PASS (1.0.0 open/semver).
- **G-C15** (changed tests) — PASS. Slice #3/#4/#5 are RED-on-base **by construction** (traced against the old
  `!(id in serverFacet)` heuristic: it carries the deselect phantom / resurrects the mid-flight deselect / nulls
  the label) — corroborated by the implementer's swapped-base run + IT-151 RED-on-`ref:f89c9a65` (2/2 new).
  `searchUrlState.test.ts` changes only widen the object to the new `SearchUrlState` type (no matcher weakened,
  no `.skip`/deletion). New expected values trace to CORRECT behaviour, never system output. Java test RED-on-base.

### Regressions — INDEPENDENTLY RUN on the SUT built from `02f0ee60`
- **feature-complete: 336 passed / 1 failed** — GREEN-FOR-CHANGE. The 1 = `favorites-star-see-loop.spec.ts:159`
  (#1815 CTRIB-039 Group-B Description column, unmerged on this SUT — **contributor-independent**, RED on any
  non-Group-B SUT). Every search spec GREEN (catalog-search · `search-url-state` ST-1a · **`search-url-facets`
  IT-151 4/4** incl. t294 Clear-All-no-strand + t295 status+chip+deep-link · `search-tsquery-poisoning` IT-003 ·
  `search-session-not-found` D9 · `search-class-tab-filter` · `search-suggestions`).
- **known-bugs: 3 failed = IT-007 + IT-006 + IT-004 (expected-RED), 0 unexpected-green.**
- **multi-stack: 9 passed** · **ingestion-e2e: 15 passed.** All suites exit 0; stack torn down; flock released.
- **Unit bucket: Java `:odd-platform-api:build` (test + checkstyleMain + checkstyleTest + assemble) BUILD SUCCESSFUL
  in 8m6s** at `02f0ee60` (independently run) — the new `FacetStateMapperImplTest` + all Java tests + checkstyle
  pass. The FE reducer/selector behaviour is confirmed by the reducer trace + the IT-151 E2E (the stronger
  measurement); the implementer's node:24 vitest run (20/20; #3/#4/#5 RED-on-base) corroborates.

### Navigation
Consistent — `navigation/domains/search.md` points at `FacetStateMapperImpl.java`, `Search.tsx`,
`dataEntitySearch.slice.ts`, `dataentitySearch.selectors.ts` (all touched files); no files moved; no new bean
factory/SDK builder.

### Outbound URL sweep / Banned-phrase
Outbound URLs on the authored `search.md` (the FTSConstants.java GitHub link + intra-doc links) are DOC-497's
live verification at the 1.0.0 release gate (release-gated), not re-swept here. Banned-phrase check: none used.

### Doc-product editorial audit (per `playbooks/doc-product-editorial-read.md`)
- **Coverage this run**: bounded to `data-discovery/search.md` + neighbourhood. The full-tree read was done by
  **review-ctrib048 on 2026-06-30 → DOC-496** (pending; DE-search-vs-term-search share-model divergence). The
  published tree (origin/main) has had no churn since — partition noted, not skipped silently.
- **Findings**: none NEW. ST-1b **widens** the DOC-496 divergence (DE catalog search now carries full faceted URL
  state while term search still uses expiring `/termsearch/{uuid}` sessions) — an extension of the already-tracked
  DOC-496, not a new item.

### The two GATE-2 ratification items (the human decides at merge — they do NOT block this PASS)
1. **Label-preserve scope-add.** GATE 1 approved (A)+(B′) = 2 files. In Phase D the implementer found a THIRD
   defect — sidebar chips blank ~1s after every selection (a regression ST-1b's id-only-request design
   introduced) — and folded in a ~6-line name-preserving merge in the same reducer, **after an `AskUserQuestion`
   timed out (maintainer away, 60s)**, per the autonomous operating model, flagging it for GATE-2 ratification.
   **The code is correct + tested** (slice #5, IT-151 t295). Assessment: **defensible** (erases a self-introduced
   regression with a bounded change; shipping approved-scope-only would knowingly ship blank chips) and
   transparently flagged. The maintainer ratifies (or reverses) the scope at GATE 2.
2. **ST-1d truth-reduction.** The original plan's R2 ("shows the tag chip selected") + key_link ("names backfill
   server-side") premise is **falsified**: a fresh faceted deep-link renders chips PRESENT + FUNCTIONAL but
   **UNLABELLED**. RESULTS + filter state are correct; only the chip TEXT is missing on a fresh deep-link.
   **Honestly tracked** as ST-1d (`state/search-overhaul-decomposition.md` §ST-1 ledger + IT-151 protocol §4.6 +
   the `SearchFilter.required:[id,name]` contract note) → not silent (G-C19 satisfied). Assessment: an acceptable,
   well-tracked truth-reduction — the core ST-1b promise (share/bookmark/navigate a faceted search) is delivered.
   The maintainer ratifies shipping ST-1b with this residual vs bundling ST-1d.

### Notes
- B1 fix VERIFIED via first-hand read of `FacetStateMapperImpl.java:164-178` (+`FORM_MAPPINGS:39-49`),
  `dataEntitySearch.slice.ts:42-158` (the B′ reconciliation + label-preserve + `hasPendingLocals`),
  `dataentitySearch.selectors.ts` (`getSearchUrlState` selected-only), `Search.tsx:64-104` (reader arg =
  `searchUrlStateToFormData`; mirror armed only on `!synced`), `searchUrlState.ts:91-139` (fail-closed + ids-only),
  the 3 FE test files, `FacetStateMapperImplTest.java` — PLUS an independent full regression + Java build (above).
- My-Objects / numeric-class-tab immunity VERIFIED via `changeDataEntitySearchFacet:243-244` (the
  `typeof facetOptionId === 'number'` guard keeps the string `'my'` OUT of `facetState`; `myObjects` rides the
  boolean, re-synced from the echo at `updateSearchState:150`, and is not part of the `hasPendingLocals` check) +
  the full-histogram `entityClasses` echo (`mapDto:167`). So the B′ change re-introduces NO strand for the
  class/My-Objects paths (the only class the prior review worried about).
- Reject-by-default satisfied: every gate has cited evidence; the two surfaced items are product/scope decisions
  for the human, not gate failures.
- Review resources: flock ACQUIRED for the regression then RELEASED + stack torn down; `lineage/**` NOT written by
  this review (the pre-existing unowned probe drift left routed-around, O10); run-log churn from the regression
  reverted — this review commits exactly the verdict + `state/PROGRESS.md` + its `state/active-streams.yaml` entry.

**Disposition:** `review-ready` (unchanged) — **ACCEPTED, GATE-2-ready.** The human owns the GATE-2 merge of DRAFT
PR #1834 (the bot cannot self-merge — G-C4) **plus** the two ratification items above; on merge the item becomes
`pending-release` (1.0.0), and `/review release:1.0.0` owns the final `done` after the release ships + DOC-497
live-verifies. Maintainer action also surfaced: push the docs train (`release/1.0.0`) for DOC-497 (maintainer-gated).

## GATE-2 ratification (2026-07-02, maintainer)

**Item #1 — the label-preserve scope-add: RATIFIED by the maintainer.** The autonomous fold-in (the ~6-line
name-preserving merge in `setFacetOptionsById`, decided after the `AskUserQuestion` 60 s timeout) is **approved and
stays in the PR** — this closes the "GATE-2 ratification item" the rework flagged. The delivered scope is therefore
(A) statuses echo + (B′) optimistic-vs-requested reconciliation + the label-preserve merge, all as reviewed at
`02f0ee60`.

**Item #2 — the ST-1d truth-reduction: NOT separately ratified; ships as a tracked residual on merge.** Merging
#1834 accepts that a *fresh* faceted deep-link renders its filter chips **unlabelled** until ST-1d lands (results +
filter state are correct; only the chip text is missing). ST-1d remains a follow-up in
`state/search-overhaul-decomposition.md` §ST-1 (it also fixes the echo honouring `SearchFilter.required:[id,name]`).
Surfaced for the maintainer's awareness — not a blocker.

**The merge (GATE 2) is the maintainer's GitHub action — NOT performed by the agent (G-C4).** The bot is the PR
author; GitHub blocks author self-approval and `main` branch protection requires ≥1 approving review with no
bot-bypass (the App has no Administration scope). Maintainer steps to merge #1834: (1) mark the DRAFT PR **Ready for
review**; (2) a human **approving review**; (3) **squash-merge** to `main`. On merge → the item flips to
`pending-release` (1.0.0), and `/review release:1.0.0` owns the final `done` after the 1.0.0 release + DOC-497
live-verification. Still pending in parallel: push the docs train (`release/1.0.0`) for **DOC-497**
(maintainer-gated) so the paired doc publishes at the 1.0.0 release.

## Merged (2026-07-02, GATE 2 — human) → `pending-release` (1.0.0)

The maintainer merged **PR #1834** to odd-platform `main`. **Verified against the real remote** (`git -C ../odd-platform
fetch` + `git log origin/main`): squash-merge **`ab63b6d3`** *"feat(search): parametrise search facets + My Objects in the
URL — ST-1b of #1825 (#1834)"*, sitting directly on `f63d3915` (ST-1a). **Faithful to what was reviewed:** `git diff
02f0ee60 ab63b6d3` is **empty** — the merged tree is byte-identical to the reviewed commit; no drift entered at merge.

**Status reconciled `review-ready` → `pending-release`** (release-gated, milestone 1.0.0). The code is on `main`; it
publishes with the **1.0.0** release. `/review release:1.0.0` owns the final `pending-release → done` after: (a) the
1.0.0 tag ships, (b) the released image passes the release-review suites, and (c) **DOC-497** live-verifies on
`docs.opendatadiscovery.org/data-discovery/search`.

**Open follow-ups carried past the merge** (none block `pending-release`):
- **DOC-497** (`pending-release`, 1.0.0) — the paired doc is authored on `docs/CTRIB-049-search-url-facets @ 7259606`;
  the train push to `origin/release/1.0.0` is maintainer-gated.
- **ST-1c** — retire the W4 session-navigators (`TopTagsList` / `DataEntitiesUsageInfo` / `ToolbarTabs` → param URL);
  its own spec → plan → GATE 1.
- **ST-1d** — resolve fresh-deep-link chip **labels** server-side (and honour the echo's `SearchFilter.required:[id,name]`).
- **Search-flow ontology refresh** — now DUE (ST-1b is on `main`); deferred to the **1.0.0 release-gate ontology
  refresh** (`playbooks/release-review.md` step 5, the ST-1a precedent — both ST-1a + ST-1b sidecars refresh to the
  released tag together). Not a review/reconcile side-effect (re-enrichment is `/enrich`'s job, never a bookkeeping write).
