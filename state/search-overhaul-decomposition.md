# #1825 — Search overhaul: subtask decomposition (paste-ready sub-issues)

Decomposes epic **[#1825](https://github.com/opendatadiscovery/odd-platform/issues/1825)** (Unified Asset Search)
into shippable subtasks, per `adrs/drafts/unified-asset-search.md` (rev 3) + `prds/0003-unified-asset-search.md` +
`adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md`.
**Maintainer steer 2026-06-30:** first-class search (perf + capabilities + **security**); **Saved Search** built now;
**close #1705** inside the epic; **decompose properly — reliable + stable, not one big-bang.**

> **rev 3 — corrected decomposition (2026-06-30).** The maintainer flagged the rev-2 slices as *"not full, not
> correct, not optimal."* Re-run through the hardened front-of-loop (`playbooks/{spec-gate,decompose-epic,plan-contract}.md`).
> What changed and **why** — the audit trail:
>
> | # | Defect in rev 2 | Class | Fix in rev 3 |
> |---|---|---|---|
> | 1 | **ST-2 closed #1705 with a `status_priority` index built later in ST-4** → seq-scan sort on the most-run browse query, or #1705 not actually closed | correctness (dependency inversion) | The **`status_priority` column + btree index land IN ST-2** (a DE-table denormalisation, independent of the unified index). ST-2 is index-backed at P0; ST-4 later extends the column onto the union. |
> | 2 | **ST-2's recommended *hybrid* browse default needed `popularity_score` (built in ST-4)** | correctness | ST-2 ships the **pure status-priority** default (deliverable now); the hybrid is a flagged follow-on once `popularity_score` exists (ST-5). The browse-default fork stays a GATE-1 decision. |
> | 3 | **ST-4 (backend core) "depends on ST-1" (a frontend URL refactor)** | correctness (artificial dep) + optimality | Removed. The core track depends only on an upfront **param-name contract**, so it runs **in parallel** with P0 — the long-pole backend starts early. |
> | 4 | **ST-4 + ST-5 split the core HORIZONTALLY** — ST-4 shipped a backend endpoint no user can see (a "dead endpoint" slice) | optimality (anti-pattern — `decompose-epic` forbids horizontal splits) | The core is **one vertical thread** (ST-4: index + query + endpoint + the minimal cross-kind UI + asset-type filter + retire class tabs + latency baseline). If oversized at build, **Data-axis split** (DE+Term first, then +QueryExample). |
> | 5 | **ST-4 was ~3 slices** (index + maintenance + backfill + query + the whole sort/pagination foundation + `websearch_to_tsquery`) | optimality (over budget) | Split: **ST-4** core vertical · **ST-5** sort/pagination foundation · **ST-6** query operators. |
> | 6 | **ST-6 bundled 4 heterogeneous filters** and **coupled ready-now Favorites to #1816** (needed only by Recently-viewed); the heaviest/riskiest part (My-data lineage) was buried | optimality + correctness | **Split into one slice per filter** (ST-7 Favorites · ST-8 My-data, with its own perf gate · ST-9 Popular · ST-10 Recently-viewed). **#1816 now blocks only ST-10.** |
> | 7 | **ST-7 bundled 3 features** (highlight parity + column constructor + per-column sort) | optimality | Split: **ST-12** highlights · **ST-13** column constructor + per-column sort. |
> | 8 | **D13 facet logic (AND/OR + negation)** had no slice/AC; datetime-range facets + per-slice i18n unscoped | fullness (coverage gaps) | **ST-11** owns facet logic + datetime-range; **i18n (7 locales)** is now an explicit impact line on every FE slice. |
>
> **Old → new map:** ST-1→ST-1 · ST-2→ST-2 (now index-backed) · ST-3→ST-3 · ST-4→**ST-4 (vertical) + ST-5 + ST-6** ·
> ST-5→folded into ST-4 (the UI is part of the core vertical) · ST-6→**ST-7 + ST-8 + ST-9 + ST-10 (+ST-11 facet logic)** ·
> ST-7→**ST-12 + ST-13** · ST-8→ST-14.
>
> **Honesty / open verification:** `../odd-platform` is **not in this environment**; this rev audits the decomposition's
> *logic* against the approved ADR/PRD (code claims verified by the prior session at `da2932e1`) + the navigation map.
> The two facts the re-slice leans on — (a) sort does not exist today (FTS-rank-only) so `status_priority` is a fresh
> DE-table denormalisation movable into ST-2; (b) the unified index can be backfilled per-kind (enabling the Data-axis
> split in ST-4) — are **architecture-logic sound but warrant a code read at each slice's GATE-1** (add the repo to verify now).

## How these become GitHub sub-issues (filing — needs the maintainer)

The `odd-contributor[bot]` is **policy-barred from creating GitHub issues** (`playbooks/github-write.md`: comments +
draft PRs only). Each subtask below is **paste-ready**; filing options:
- **(A, default)** the maintainer creates each issue (paste the body), then links it under #1825 via the native
  **sub-issue** control — GitHub tracks the parent/child rollup.
- **(B)** the maintainer authorises the bot to create them this once via `POST /repos/opendatadiscovery/odd-platform/issues/1825/sub_issues`, crossing the standing policy deliberately.

All inherit **1.0.0** from the epic; the per-slice milestone split is **maintainer / release-planning authority** (PRD §10).

## Sequencing (dependency-corrected; two tracks run in parallel)

```
 P0 (saved & shareable — on the CURRENT DE search, the maintainer's now-ask)
   ST-1 param-URL state ─► ST-2 sort + status_priority(#1705) ─► ST-3 saved searches
                                                                       (P0 reworks onto the union when the core lands — a flagged trade-off, below)

 CORE TRACK (parallel — NOT blocked on ST-1; only an upfront param-name contract is shared)
   ST-4 unified core vertical ─┬─► ST-5 sort/pagination foundation ─► ST-9 Popular facet · ST-13 column constructor+sort
   (index+query+endpoint+UI+   ├─► ST-6 websearch_to_tsquery operators
    asset-type+retire tabs)    ├─► ST-7 Favorites filter        (finishes #1815)
                               ├─► ST-8 My-data filter (perf gate)
                               ├─► ST-10 Recently-viewed filter (needs #1816)
                               ├─► ST-11 facet logic (AND/OR+negation) + datetime-range
                               └─► ST-12 highlight parity
                                                                  ─► ST-14 convergence + power (P4)
```

**GATE-1 decisions for the maintainer (flagged, not silently chosen):**
1. **P0-first rework trade-off.** ST-1/2/3 ship on the *current* DE search for early user value (saved/shareable search + fixes the IT-125 dead-link class), then are **extended additively** when the core (ST-4) lands. The rework is bounded (jsonb spec + param names extend; the FE state layer rebinds to the polymorphic slice). Accept P0-first, or build the core first? *(Maintainer chose P0-first 2026-06-30; this records the cost.)*
2. **Browse-default fork** (ST-2): pure status-priority (#1705) — deliverable now — vs the recommended **hybrid** `status_priority → popularity_score` (waits for ST-5's `popularity_score`).
3. **Core Data-axis split** (ST-4): ship cross-kind for **all kinds at once**, or **DE+Term first** then +QueryExample? *(Depends on how coupled per-kind index maintenance is — a code read at ST-4 GATE-1.)*

---

## P0 — Saved & shareable search (on the current DE search; runs parallel to the core track)

### ST-1 — Parametrised-URL search state (shareable & bookmarkable; retire session-id sharing)
**Labels:** `kind: feature`, `scope: frontend`, `scope: backend` · **Parent:** #1825 · **Realises:** ADR D10 · **Fixes the class of:** #1760 / `IT-125` session-expiry · **Depends on:** — (foundation)

**What.** The main Search's state — query, filters, sort, page — lives in the **URL as query params** (`stateToRoute`/`routeToState`), so any search is a stable, bookmarkable, shareable link and back/forward work. The server `search_facets` session stays only as an internal FTS-execution detail derivable from the params.
**Scope / AC.** state ⇄ URL (debounced ~400 ms; only non-default values; clean names); loading a URL reproduces the exact search; back/forward navigate; a copied URL opened by another user runs the **same query** scoped to **their** permissions; `/api/search` unaffected (D9). **Security/perf:** no secrets in the URL; writes debounced; param parse **fails closed** (unknown/malformed → ignored, never a crash). **Care-point:** reworks `Search.tsx`'s create-empty-session-then-navigate mount (the IT-022 session-creation race) — test hardest.
**Tests.** unit (state⇄URL round-trip; unknown params ignored); integration e2e (share-link reproduces; deep-link + back/forward; legacy `/search/{sessionId}` still loads — D9) — extend `IT-022`/`IT-125`.
**i18n.** none (no new strings).

**Sub-slice ledger (ST-1a/1b GATE-1 splits + Phase-D discoveries).** **ST-1a** `?q=` — #1833, merged (`f63d3915`) · **ST-1b** facets + My Objects — PR #1834 (CTRIB-049) · **ST-1c (fast-follow, GATE-1-recorded):** rewire the W4 session-navigators (`TopTagsList` / `DataEntitiesUsageInfo` / `ToolbarTabs`) to the canonical param URL · **ST-1d (follow-up, discovered in the ST-1b B1 rework):** a FRESH faceted deep-link renders its filter chips **unlabelled** — the URL carries ids only and the server echoes back only the names the request carried (`name:null` on the wire; captured in `contributor/CTRIB-049.md` rework section). The interactive flow keeps labels via ST-1b's client-side label-preserving merge; recipient-side labels need the server to RESOLVE names in the facet echo (`FacetStateMapperImpl.mapDto` path — per-facet id→name lookups) or an FE hydrate-time resolution. Small, self-contained, user-visible polish for the share story.

### ST-2 — Sort contract + status-priority index (#1705) + global sort dropdown
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Closes:** #1705 · **Realises:** ADR D12 · **Depends on:** ST-1 (the URL carries `sort`)

**What.** The server-side **`sort` contract** (`[{field, direction, nulls}]` + named semantic orderings `relevance`/`status-priority`) + the **default-order model** + a **global dropdown** of the ~5 canonical sorts (Relevance · Status priority · Recently updated · Most popular · Name A→Z). **Includes the `status_priority smallint` denormalised column + its btree index on the DE table** (maintained on the status write-path) — so #1705 is **index-backed at P0**, not waiting on the unified index. **NOT** the per-column matrix (that is ST-13).
**Scope / AC.** browse → status-priority default (STABLE→DEPRECATED→DRAFT→UNASSIGNED→DELETED, #1705), query → relevance; **server-side** (never a client page re-sort); the URL (ST-1) + saved spec (ST-3) carry it; index-backed (no seq-scan sort on browse). **Fix the `status_updated_at` write-path bug** (`DataEntityMapperImpl.applyStatus` sets status before the prior-status check — SEARCH-CAPABILITIES-DESIGN §8.1) while in that code. **Browse-default fork is a GATE-1 decision** (pure #1705 now; the hybrid needs ST-5's `popularity_score`).
**Tests.** unit (status-priority ordering map; per-context default; the `status_updated_at` fix RED→GREEN); integration (browse leads with STABLE; the dropdown switches; the #1705 acceptance) — new `IT-NNN`.
**i18n.** the sort labels — all 7 locales.

### ST-3 — Saved searches: named per-user searches (save / select / edit / delete) shared as a URL
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D11 · **Depends on:** ST-1 (param spec), ST-2 (sort in the spec)

**What.** A user **saves the current search** (filters + ordering) under a **name**; lists / selects / edits / deletes; **shares** as the param URL (ST-1). BE: `saved_search(id, name, owner_identity, spec jsonb, created_at, updated_at)` + CRUD, reusing the **Favorites identity foundation** (`CurrentUserIdentityResolver`; per-user; instance-shared + labelled under `auth.type=DISABLED`). The `spec` jsonb extends **additively** when the core lands.
**Scope / AC.** BE migration + reactive repo + owner-scoped CRUD; FE "Save current search", a saved-searches menu (select→reapply; rename; delete), "copy share link". **Security (first-class):** owner-private; the share link is a **query spec run as the recipient** (re-evaluates under their permissions — never the sharer's); spec parse **fails closed** (malformed → empty, never 500); the FTS path stays tsquery-escaped (the IT-003 guard). **Team/published** saved searches → ST-14.
**Tests.** unit (CRUD + identity scoping + fail-closed parse); integration e2e (save→select→edit→delete; share link runs under a 2nd identity, permission-scoped) — new `IT-NNN`.
**i18n.** the saved-search UI strings — all 7 locales.

---

## Core track — the unified engine (parallel with P0)

### ST-4 — Unified cross-kind search core (index + polymorphic query + endpoint + minimal UI) — **one vertical thread**
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D1, D2, D3 (asset-type), D9 · **PRD:** R1, R3 · **Depends on:** — (an upfront **param-name contract**: `q`, the existing facets, `asset_kinds`, `sort`)

**What.** The irreducible cross-kind search vertical, end-to-end so a **user can see it**: the `asset_search_entrypoint` polymorphic FTS index (+ incremental write-time maintenance + backfill) → the **single ranked query** → the polymorphic **`Asset`** result resolved by **live page-sized semi-join** (the `FavoriteAssetResolver` template) → an **additive `/api/search/assets`** endpoint → the **minimal polymorphic results UI** (one cross-kind row that routes per kind) + the **Asset-type filter** (Term · Query Example · Data Entity expanding into its `ENTITY_CLASSES`) + **retire the `/search` class tabs**. `/api/search` + per-kind searches keep working (D9). **Establish the P50/P95 latency baseline (release gate).**
**Vertical-split option (ST-4 GATE-1, if oversized):** Data axis — ship **DE + Term first** (backfill + render two kinds), then a fast-follow adds **Query Example** (+ future kinds). Never split horizontally into "index slice" + "UI slice" (that ships a dead endpoint).
**Scope / AC.** one query → mixed-kind ranked page, each row routes to its kind's detail; backfill + incremental maintenance verified; latency baseline measured; class tabs gone; `/api/search` unaffected; **pixel-reviewed**.
**Tests.** unit (index maintenance, ranked query, semi-join resolution); integration e2e (cross-kind query returns DE+Term+QE in one ranked list; rows route; tabs gone) — new `IT-NNN`.
**i18n.** the asset-type filter + any new result-row strings — all 7 locales.

### ST-5 — Sort / pagination foundation on the unified index (the index shape for scale)
**Labels:** `kind: feature`, `scope: backend` · **Parent:** #1825 · **Realises:** ADR D12 (SRE), D5 (amended) · **Depends on:** ST-4

**What.** Make cross-kind sort **index-backed at 100k+ assets**: NULLS-aligned btree indexes (`status_priority` extended onto the union, `updated_at DESC NULLS LAST`, `created_at`, `name` case-insensitive ICU), **keyset pagination** with the `id` tiebreaker (OFFSET + depth-cap for the non-seekable `ts_rank` relevance sort), and the **snapshotted/bucketed `popularity_score`** (NOT live `view_count` — the D5 SRE correction; `view_count` is a write-contention hotspot, `concepts.yaml:564`), refreshed on a cadence.
**Why it's its own slice.** It's the substrate the Popular facet (ST-9), the per-column sort (ST-13), and the hybrid browse default (ST-2) all consume; it carries the keyset-pagination + NULLS-alignment SRE work that is too much to ride inside ST-4.
**Scope / AC.** the sort indexes exist + are used (planner shows index scans, no sort node on the common sorts); keyset pagination stable under concurrent writes; `popularity_score` snapshot job + the column; deep-page latency bounded. **Unblocks the ST-2 hybrid default + ST-9.**
**Tests.** unit (keyset cursor incl. nulls + ties; popularity snapshot); integration (deep-page latency within gate; sort stable under writes) — new `IT-NNN`.
**i18n.** none.

### ST-6 — Query operators: `websearch_to_tsquery` (DataHub-grade, injection-safe)
**Labels:** `kind: feature`, `scope: backend` · **Parent:** #1825 · **Realises:** ADR D13 · **Depends on:** ST-4

**What.** Adopt Postgres **`websearch_to_tsquery`** — Google-style operators (quoted phrase, `-` negation, `or`) that are **injection-safe by construction** (never raises on metacharacters), serving operator-parity **and** the IT-003/PLT-090 fail-closed mandate in one move.
**Scope / AC.** quoted-phrase / negation / or operators work on the unified query; a metacharacter payload returns empty, never 500 (the IT-003 guard); the existing plain-term behaviour is preserved.
**Tests.** unit (operator parsing; the IT-003 poison payload → empty); integration (a phrase/negation query narrows correctly) — extend the IT-003 suite.
**i18n.** none.

---

## P2 — Scope filters (one slice per filter; Favorites is decoupled from #1816)

### ST-7 — Favorites filter (All / Yes / No) + retire the `/favorites` tab + rewire the Favorites panel
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D3, D8 · **PRD:** R2, R5 · **Finishes:** #1815 · **Depends on:** ST-4

**What.** The **Favorites** boolean filter (join / anti-join to the `favorite` table via `CurrentUserIdentityResolver`); **retire the bespoke `/favorites` tab**; rewire the catalog-overview **Favorites** panel's "See all" → `/search?favorites=yes`. Favoriting itself (star + table + write API + panel) is untouched. **No #1816 dependency — ships now; this is where #1815 finishes.**
**Scope / AC.** All/Yes/No narrows the cross-kind result; per-user (instance-shared + labelled under `auth.type=DISABLED`); the `/favorites` tab is gone; the panel deep-links pre-filtered.
**Tests.** unit (join/anti-join + identity scoping); integration (filter narrows; panel "See all" lands pre-filtered; tab gone) — new/extended `IT-NNN`.
**i18n.** the Favorites filter labels — all 7 locales.

### ST-8 — My-data filter (My Objects · Upstream · Downstream; per-direction depth) — **own perf gate**
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D4, D8 · **PRD:** R2, R5 · **Depends on:** ST-4

**What.** The **My-data** multi-select (All · My Objects · Upstream · Downstream): `fetchAssociatedOwner()` for owned set; lineage neighbours via the depth-bounded lineage repo, **per-direction `upstream_depth`/`downstream_depth` (default 1 each, independently settable — D4)**, intersected with the search. **Retire the My-Objects tab**; rewire the My Objects / Upstream / Downstream panels' "See all".
**Why its own slice.** This is the **heaviest/riskiest** part (PRD §7 — lineage × ownership × FTS intersection can explode). It carries its **own performance gate**: a max-depth ceiling, a node-count cap, query timeouts; empty under `auth.type=DISABLED`.
**Scope / AC.** each scope narrows correctly; depth is a per-direction parameter; the perf guards hold on a dense-lineage fixture; the My-Objects tab is gone; panels deep-link.
**Tests.** unit (owned-set + neighbour intersection; depth caps); integration (each scope narrows; a deep/dense-lineage fixture stays within the latency gate) — new `IT-NNN`.
**i18n.** the My-data labels — all 7 locales.

### ST-9 — Popular: numeric-range facet + distribution histogram (the first non-categorical facet type)
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D5 · **PRD:** R2, R5 · **Depends on:** ST-5 (`popularity_score`)

**What.** The **Popular** numeric-range filter over the snapshotted **`popularity_score`** (ST-5) — a dual-handle slider over a **histogram of the distribution** (the price-range pattern). Introduces the **first numeric-range facet *type*** (every facet today is categorical — a reusable widget). Rewire the Popular panel's "See all". **DE-scoped** (popularity is DE-only); My/Global-Popular → ST-14.
**Scope / AC.** the slider's `[min,max]` maps to a `popularity` range filter; the histogram is a bucketed aggregate (`width_bucket`) over the **currently-filtered** set, cached/bounded so it never dominates search cost; the panel deep-links.
**Tests.** unit (range filter; bucketed histogram); integration (slider narrows; histogram reflects other filters) — new `IT-NNN`.
**i18n.** the Popular facet labels — all 7 locales.

### ST-10 — Recently-viewed datetime-range filter (on the #1816 foundation)
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D3 · **PRD:** R2-f · **Depends on:** ST-4 **+ #1816** (the `recently_viewed` timestamp foundation)

**What.** The **Recently-viewed** last-viewed-timestamp range filter (per-user **recency** — *when* last opened, distinct from Popular's frequency), on #1816's `recently_viewed` timestamps; rewire the Recently-viewed panel's "View all" (**#1832**). **The only filter blocked on #1816** — decoupled from Favorites so #1815 is not held hostage.
**Scope / AC.** a datetime range narrows by my last-viewed; empty under `auth.type=DISABLED`; the panel deep-links.
**Tests.** unit (timestamp range + identity scoping); integration (filter narrows; panel deep-links) — new `IT-NNN`.
**i18n.** the Recently-viewed labels — all 7 locales.

### ST-11 — Facet logic: AND/OR within a facet + negation (+ datetime-range facets)
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D13 (facet logic) · **Depends on:** ST-4

**What.** Close the **facet-logic** gap (D13, the rev-2 omission): **AND/OR within a facet + negation** (DataHub's "match any" / "should not match") layered onto the cross-kind facets; plus the **datetime-range** facet type (created / updated), pairing with the datetime sort. The clearest first-class filtering gap.
**Scope / AC.** a facet supports match-any + exclude; combinations compose with the other filters; a created/updated range narrows; the query stays injection-safe (ST-6).
**Tests.** unit (OR/negation predicate building; datetime range); integration (match-any + exclude narrow correctly) — new `IT-NNN`.
**i18n.** the facet-logic + datetime-range controls — all 7 locales.

---

## P3 — Capability depth

### ST-12 — Cross-kind highlight parity (per-kind "why it matched")
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D6 · **PRD:** R4 · **Depends on:** ST-4

**What.** "Why it matched" **highlight parity** across kinds — a per-kind highlight model (DE rich today via `DataEntitySearchHighlight`; Term/QE thin → build their highlight fields). A row testifies *why* it appeared; a kind without a highlight degrades gracefully (no badge), never breaks.
**Scope / AC.** DE keeps its rich highlights; Term/QE show a real "why it matched" badge; a kind with no highlight renders cleanly.
**Tests.** unit (per-kind highlight extraction); integration (a term match shows its highlight) — new `IT-NNN`.
**i18n.** any highlight UI strings — all 7 locales.

### ST-13 — Result-column constructor + per-column type-derived sort menu (D12 matrix)
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D7, D12 · **PRD:** R4 · **Depends on:** ST-4, ST-5 (sort indexes), ST-2 (sort contract)

**What.** The **field constructor** over a kind/type-aware **field catalog** (shared + kind-specific fields, each carrying `data_type`; a chosen field renders only for kinds that carry it; client-persisted first — D7) **+ the per-column ▾ type-derived sort menu** — the SAME catalog's `data_type` drives BOTH the column set AND each column's sort options (status named-orderings "Maturity"/"Needs attention"; datetime "Newest/Oldest" + advanced "show unknown first"; text A→Z; numeric high/low). **This is where the rich per-column sort matrix lands** (it needs the configurable columns + the ST-2 contract + the ST-5 indexes). Do the `view_count` NULL-vs-0 + multi-owner sort-key code-read first (SEARCH-CAPABILITIES-DESIGN §8.2).
**Scope / AC.** add/remove/reorder columns; a kind-specific column shows for its kind, blank elsewhere, persisted per browser; each sortable column's ▾ shows only its type-appropriate options and re-sorts **server-side**.
**Tests.** unit (field-catalog → sort-options registry; per-kind degradation); integration (column add/remove; per-column sort incl. status named-orderings + datetime null handling) — new `IT-NNN`.
**i18n.** the column-picker + sort-menu labels — all 7 locales.

---

## P4 — Convergence + power (later)

### ST-14 — Convergence + power features
**Labels:** `kind: feature`, `scope: backend`, `scope: frontend` · **Parent:** #1825 · **Realises:** ADR D9 (convergence), D11 (team), D5 (My/Global), D4 (depth), D7 (server views) · **Depends on:** ST-4..ST-13

**What.** Converge the per-kind searches onto the unified index + **deprecate** the duplicate paths (deprecation window — D9); **team/org-published saved searches** (RBAC + audience on `saved_search`); **My vs Global Popular**; **server-side column views** (per-user, beyond client persistence); deeper default lineage if wanted. **AC + tests** per slice as picked up.
**i18n.** per slice.

---

## Closure of the epic
**#1825** closes when **ST-4 + ST-7..ST-13** land (the overhaul is functionally complete) — ST-5/ST-6 are core-track
substrate, ST-14 is the post-1.0.0 power-tail. **#1705** closes with **ST-2**. **#1815** finishes at **ST-7** (Favorites
filter); **#1816 / #1832** resolve at **ST-10** (Recently-viewed filter + panel). Realistically **multiple PRs across
multiple sessions** — the decomposition exists precisely so it ships reliably, not in one risky go.

_Authored 2026-06-30 (rev 3 — corrected via the hardened front-of-loop). Source: ADR rev 3 + PRD-0003 + SEARCH-CAPABILITIES-DESIGN + the rev-2 decomposition audited against `playbooks/decompose-epic.md`._
