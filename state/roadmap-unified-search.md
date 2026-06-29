# Roadmap — Unified Asset Search + Favorites + Recently Viewed

**Strategy (one line):** overhaul the main `/search` into one faceted, cross-kind **Asset** search (PRD-0003); **Favorites** and **Recently Viewed** become *filters* on it, not separate tabs; the only standalone Recently-Viewed work is its **view-tracking foundation + home panel** (#1816). *(Popular is a separate, already-built `view_count` metric — not part of #1816; see below.)*

Source PRDs: `prds/0001-favorites-and-recently-viewed.md` · `prds/0002-favorites-completion.md` (Group B superseded) · **`prds/0003-unified-asset-search.md`** (the spine).

## How the three workstreams interlock

- **Search overhaul (PRD-0003)** is the spine. Phases: **P1** polymorphic core → **P2** the scope filters → **P3** columns/highlights → **P4** (later).
- **Favorites (#1815):** the foundation is **already merged** (S1–S4b: star + write API + list API + FE skeleton). The Group-B completion is **superseded** — Favorites *finishes* by becoming the **Favorites filter** in Search **P2**. The in-progress Description slice is **parked** (local only).
- **Recently Viewed (#1816):** build only what survives — the **view-tracking foundation** (`recently_viewed` table + tracking write-path + read API) **+ the home panel**. **Defer the tab** → it becomes the **Recently-viewed filter** in Search **P2**.
- **#1816 readies the Recently-viewed P2 filter** (`recently_viewed` **timestamps** — recency, *when* last opened) and delivers the home panel. It's independent + cheap (reuses the merged favorites foundation), so it's a good **early parallel track**.
- **Popular is separate and already exists.** The **Popular** filter ranges over the **existing `view_count`** (frequency — *how many* views; the "Popular" block metric), used **as-is**, DE-scoped. **No dependency on #1816.** *My Popular / Global Popular* is a possible later split, out of scope now. (Recency ≠ frequency.)

```
Search overhaul (PRD-0003)  ── spine ──►  P1 core → P2 filters → P3 columns/highlights
                                                  │
   P2 absorbs the filters, fed by:               │
     • Favorites filter   ◄── favorite table (#1815, MERGED)
     • Recently-viewed    ◄── recently_viewed TIMESTAMPS (#1816 foundation — build early)
     • Popular            ◄── existing view_count (already built, used as-is; DE-scoped)
```

## What to log / create

| # | Artifact | Where | Owner | Status |
|---|---|---|---|---|
| **L1** | **New issue — the Search overhaul** | GitHub `odd-platform` | You | ☑ **[#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825)** (2026-06-29, ms 1.0.0) |
| **L2** | Comment on **#1815**: completion folds into #1825; star/API/panel stay; tab → Favorites filter | GitHub #1815 | Me (bot) | ☑ [issuecomment-4832457367](https://github.com/opendatadiscovery/odd-platform/issues/1815#issuecomment-4832457367) |
| **L3** | Comment on **#1816**: foundation + panel now; tab → date/time Search filter | GitHub #1816 | Me (bot) | ☑ [issuecomment-4832457502](https://github.com/opendatadiscovery/odd-platform/issues/1816#issuecomment-4832457502) |
| **L4** | **Search ADR** (rev 2 — **unified index** D1, performance-first, per-direction lineage depth D4, no-breaking-core D9) | `adrs/drafts/unified-asset-search.md` | Me | ☑ **agreed** 2026-06-29 — the proceeding direction |
| — | PRD-0003 + this roadmap | workspace | Me | ☑ done |

## Sequence — where we start → next steps

| Step | What | Who drives | Finishes / unblocks |
|---|---|---|---|
| **0** | ☑ **Done** — #1825 logged; scope comments posted on #1815 + #1816 | You + bot | the public record reflects the pivot |
| **1** | **#1816 foundation** — **in a separate `/contribute #1816` session** (recently_viewed *timestamp* tracking + read API + home panel; **no tab**) | Separate session → your gates | the **Recently-viewed** search filter + the home panel *(Popular is separate — existing `view_count`)* |
| **2** | ☑ **Search ADR drafted** (`adrs/drafts/unified-asset-search.md`) — pending your review/approval | Me → your approval | the Search build |
| **3** | **Search P1** — the **unified search core** (`asset_search_entrypoint` index + incremental maintenance + the polymorphic ranked query) + Asset-type filter + cross-kind row + retire class tabs; **keep `/api/search` working** | Me, sliced → your gates | the search engine + a latency baseline |
| **4** | **Search P2** — the scope filters (**Favorites** · **My data** · **Popular** · **Recently-viewed**) + retire the My-Objects + `/favorites` tabs + rewire the home "See all" deep-links | Me, sliced → your gates | **Favorites + Recently-viewed FINISH here** |
| **5** | **Search P3** — highlight parity across kinds + the result-column "constructor" | Me, sliced → your gates | the power-user layer |
| **6** | **Cleanup** — retire the parked Description slice; docs shift "tab → filter"; ontology refresh | Me → your gate | closure |

*(Each `/contribute` slice runs the normal gates: live-milestone check → reproduce/verify → GATE-1 plan (your approval) → build + unit + integration tests → GATE-2 draft PR (your review + merge). You stay the merge gate throughout.)*

## Parked
- **CTRIB-039 Description slice** — local commit `1db9b933` in worktree `../odd-platform-ctrib039-s4`; **nothing pushed** to odd-platform. Superseded by the Search overhaul. The doc line on `documentation@release/1.0.0` (`724438a`) is revertible. → retire at Step 6.

## Open decisions (yours — flagged in PRD-0003 §10)
1. **Milestone(s):** Search overhaul on 1.0.0 (large) vs its own milestone with Favorites-finish trailing it. *(release-planning authority)*
2. Federated aggregator vs unified index → resolved in the ADR (L4).
3. "My data" filter name · lineage-filter depth (1-hop vs transitive) · column-config persistence (local vs server) · Favorites "No" option.

_Last updated: 2026-06-29 (session: search-overhaul ideation)._
