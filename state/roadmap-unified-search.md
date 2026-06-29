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
| **L1** | **New issue — the Search overhaul** (paste-ready body = PRD-0003 §"GitHub issue") | GitHub `odd-platform` | **You** | ☐ to log |
| **L2** | Comment on **#1815**: Group B superseded → folded into the Search overhaul; star/API/skeleton stay; tab → filter | GitHub #1815 | You *(I can draft)* | ☐ |
| **L3** | Comment on **#1816**: scope refined → foundation + panel now; tab → Search filter | GitHub #1816 | You *(I can draft)* | ☐ |
| **L4** | **Search ADR** — federated-aggregator vs unified-index; the polymorphic contract; lineage-filter depth; column persistence | `adrs/drafts/` | **Me** | ☐ next design step |
| — | PRD-0003 + this roadmap | workspace | Me | ☑ done |

## Sequence — where we start → next steps

| Step | What | Who drives | Finishes / unblocks |
|---|---|---|---|
| **0** | Log L1 (+ post L2/L3) | You | the public record reflects the pivot |
| **1** | **#1816 foundation** — `/contribute #1816`, refined scope (recently_viewed *timestamp* tracking + read API + home panel; **no tab**). GATE-1 plan for your approval → build. | Me → your gates | the **Recently-viewed** search filter + the home panel *(Popular is separate — existing `view_count`)* |
| **2** | **Search ADR** (L4) | Me → your approval | the Search build |
| **3** | **Search P1** — polymorphic core + Asset-type filter (DE class split) + cross-kind result row + retire the class tabs | Me, sliced → your gates | the search foundation |
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
