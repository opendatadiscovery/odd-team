---
id: CTRIB-050
title: "#1835 ST-1 Parametrised-URL search state — INTAKE classification (already delivered by ST-1a #1833 + ST-1b #1834)"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1835 (Parent: #1825)"
parent_epic: 1825
class: "already-delivered (expected-behaviour — the requested feature is already merged to origin/main)"
status: gate-1-pending          # Phase-A read-only classification complete → GATE 1: the maintainer decides close-as-delivered vs implement a residual. NO code written (re-implement = duplicate; Gate-1 no-duplicates / LSN-035).
target_repo: odd-platform
milestone: "1.0.0"              # G-C11 PASS — #1835 carries milestone 1.0.0 (open, semver, due 2026-07-31)
adr: "adrs/drafts/unified-asset-search.md (D10 full-search-state-in-URL, D9 no-break) — the same basis ST-1a/ST-1b shipped under"
adr_required: false            # G-C7 does NOT fire — no code proposed; and the delivered work is additive FE state↔URL (no migration / auth-posture / wire-contract change)
reproduced: "n/a — NOT a bug. This is an already-delivered classification. Ground truth VERIFIED against the SHIPPED code on origin/main @ ab63b6d3 (searchUrlState.ts + Search.tsx), not the workspace records."
plan_approved_by: "PENDING — GATE 1 (this record is the GATE-1 package)"
plan_approved_at: ""
docs_routing: "n/a for this run (no code). The delivered work's doc is DOC-497 on the release/1.0.0 train (CTRIB-049), publishing at 1.0.0."
effort: trivial                 # classification + one drafted comment; zero code
pr_url: ""                      # none — no PR (nothing to implement)
pr_draft: n/a
---

## Context

`/contribute https://github.com/opendatadiscovery/odd-platform/issues/1835` — a `kind: feature` / `scope: frontend`
issue authored by the maintainer (RamanDamayeu) **today (2026-07-02T10:52:29Z)**, milestone **1.0.0**, 0 comments,
titled **"ST-1 — Parametrised-URL search state (shareable & bookmarkable; retire session-id sharing)."**

**The issue body is quoted data (G-C8), and it is verbatim the paste-ready sub-issue text of ST-1** from
`state/search-overhaul-decomposition.md:71-77`. #1835 is the maintainer **filing the ST-1 tracking sub-issue** of
epic **#1825** (the search overhaul), following the decomposition's filing plan (option A — the maintainer creates
each sub-issue and links it under #1825).

## Classification — ALREADY DELIVERED (do NOT re-implement)

ST-1's **deliverable work is already merged to `origin/main`**, as two GATE-1/GATE-2-approved slices under #1825:

| Slice | What | PR | Merged SHA | Record |
|---|---|---|---|---|
| **ST-1a** | `?q=` — the query dimension in the URL, made source-of-truth | #1833 | `f63d3915` | CTRIB-048 |
| **ST-1b** | the 8 facets + `my` (My-Objects) in the URL; reader = create-per-URL-state (REPLACE); facet→URL mirror | #1834 | `ab63b6d3` | CTRIB-049 |

`git -C ../odd-platform log --oneline` top two confirm both are on `origin/main @ ab63b6d3` (live-verified this
session). **Re-implementing #1835 would re-author `searchUrlState.ts` + `Search.tsx`, which already exist and are
merged — the textbook Gate-1 "no duplicates" / LSN-035 failure.** No code is warranted.

## Ground-truth verification — #1835 AC vs the shipped code (@ `ab63b6d3`, read first-hand, not the records)

`odd-platform-ui/src/lib/search/searchUrlState.ts` + `odd-platform-ui/src/components/Search/Search.tsx`:

| #1835 AC line | Shipped? | Evidence (`file:line` @ ab63b6d3) |
|---|---|---|
| state ⇄ URL, debounced ~400 ms | ✅ | `Search.tsx:94-99` `writeStateToUrl = useDebouncedCallback(…, 400)`; `searchStateToParams` |
| only non-default values; clean names | ✅ | `searchUrlState.ts:60-65` `skipEmptyString`/`skipNull`; params `q`/`my`/8 facet names |
| loading a URL reproduces the exact search | ✅ | `Search.tsx:71-80` reader → `createDataEntitiesSearch` per distinct URL state (REPLACE) |
| back/forward navigate | ✅ | `Search.tsx:97` push-navigate per committed state + create-per-distinct-state reader |
| copied URL → same query, recipient-scoped | ✅ (results) | ids-only params; server `/api/search` unchanged → re-evaluated under the recipient's perms |
| `/api/search` unaffected (D9) | ✅ | no API change (CTRIB-049 impact checklist; no generated-client diff) |
| no secrets in the URL | ✅ | `searchUrlState.ts` — facet **ids** only (catalog metadata), never names/PII |
| param parse **fails closed** | ✅ | `searchUrlState.ts:91-122` try/catch + positive-integer coercion; garbage → default, no throw |
| reworks `Search.tsx` create-empty-session mount (the IT-022 race — the AC "care-point") | ✅ | `Search.tsx:71-80` reader fully reworked to create-per-URL-state with `lastAppliedStateRef` + `isSearchCreating` guard |
| legacy `/search/{sessionId}` still loads (D9) | ✅ | `Search.tsx:72,82-86` `routerSearchId` branch preserved; `:50-51,106-111` graceful expired state |
| tests: share-link / deep-link / back-forward / legacy session | ✅ | IT-150 (ST-1a) + IT-151 (ST-1b) — GREEN-on-fix / RED-on-base (CTRIB-048/049 ledgers) |

### Deliberate AC deviations (documented, sound — flagged for transparency, not gaps)
- **`sort`** — the AC lists "query, filters, **sort**, page", but **sort does not exist in the current DE search**
  (FTS-rank-only; the sort *contract* is introduced by **ST-2**, `decomposition.md:81-87`). `searchUrlState` is
  additive-ready for `sort`. Nothing to serialise yet — correctly deferred to ST-2.
- **`page`** — **intentionally NOT serialised**, documented in `searchUrlState.ts:18-20`: results are infinite-scroll
  (`Search/Results/Results.tsx`), so a `?page=N` deep-link would fetch only page N and drop the earlier items. Page
  stays internal scroll state — a sound product decision (share the query+filters; scroll re-accumulates).

## Residuals — separately-tracked slices, NOT part of #1835's core deliverable

Both are in the decomposition's Sub-slice ledger (`decomposition.md:79`) and both were surfaced + dispositioned at
CTRIB-049's GATE 2:

- **ST-1c** — retire the W4 session-navigators (`TopTagsList` / `DataEntitiesUsageInfo` / `ToolbarTabs`, which still
  `createSearch → /search/{sessionId}`) → navigate the canonical param URL. A clean SPIDR fast-follow with its **own**
  spec → plan → GATE 1 (the split the maintainer approved at CTRIB-049 GATE 1). ~3 small FE files.
- **ST-1d** — a **fresh** faceted deep-link renders its filter chips **present + functional but UNLABELLED** (results +
  filter state are correct; only the chip *text* is missing, because the server echoes back only the names the request
  carried and a fresh deep-link carries **ids only**). Fix is server-side: `FacetStateMapperImpl` resolves names in the
  facet echo (also honours the spec's own `SearchFilter.required:[id,name]`). **Maintainer-ratified at CTRIB-049
  GATE 2** (2026-07-02) as a *tracked residual that ships un-blocked* — "results + filter state are correct; only the
  chip text is missing until ST-1d lands."

## Recommendation (the GATE-1 decision)

**Close #1835 as delivered** — post ONE `odd-contributor[bot]` comment on the thread documenting that ST-1's
deliverable is merged (ST-1a #1833 / ST-1b #1834), the two deliberate deviations (`sort`→ST-2, `page`→infinite-scroll),
and the two tracked residuals (ST-1c, ST-1d), then close (or keep #1835 open only as the ST-1 umbrella until ST-1c/1d
land, if the maintainer prefers the rollup). **Zero code.** File ST-1c + ST-1d as their own sub-issues from the
decomposition when ready. This is the Not-a-bug / Reuse probe behaviour (classify + explain + propose close; no
duplicate build).

**Alternative** (if the maintainer wants ST-1 kept open and *finished* under #1835 rather than closed): the highest-value
in-AC residual is **ST-1d** (the recipient-side chip labels — the one gap in the "shareable link" AC). It is a distinct
server-side slice with its own spec → plan → GATE 1; I would run it as the next `/contribute` (or continue this stream
into a Phase B/C for ST-1d). ST-1c is the other candidate. Either is a *new* slice, not a re-do of #1835.

## Drafted comment for #1835 (posts on GATE-1 approval, via `playbooks/github-write.md` — held until then)

> **ST-1 is already delivered on `main`.** The parametrised-URL search state shipped as two slices under #1825:
> - **ST-1a** — `?q=` (the query in the URL, made source of truth) — #1833.
> - **ST-1b** — the 8 facets + `my` (My-Objects) in the URL; loading a faceted URL reproduces the exact search, and
>   back/forward navigate — #1834.
>
> Against this issue's AC: state ⇄ URL (debounced ~400 ms, only non-default values, fail-closed parse), a shared URL
> re-runs under the recipient's permissions, `/api/search` is untouched (D9), the legacy `/search/{sessionId}` link
> still loads, and the `Search.tsx` create-empty-session mount was reworked (the IT-022 care-point). `sort` isn't in
> the URL because sort doesn't exist on the current search yet (it arrives with the sort contract, ST-2) — the URL
> layer is additive-ready for it. `page` is deliberately left out because results are infinite-scroll, so a `?page=N`
> link would drop the earlier items.
>
> Two follow-ups remain, tracked separately: **retire the home/toolbar session-navigators** (tag/class clicks still
> create `/search/{sessionId}` — a fast-follow) and **resolve filter-chip labels on a *fresh* shared link** (the
> results + filter state are correct today; the chip text needs the server to resolve names in the facet echo).
>
> Recommend closing this as delivered; I can file the two follow-ups as their own sub-issues under #1825.

## Status
intake → stream-coordination live-reconcile (O4/O8/O9: origin/main @ ab63b6d3; no co-active stream; flock free; docker
empty) → **G-C11 PASS** (#1835 milestone 1.0.0 open/semver) → scope+classify → **ALREADY-DELIVERED** (ground truth read
first-hand @ ab63b6d3: searchUrlState.ts + Search.tsx; every core AC line satisfied; `sort`/`page` deliberate; ST-1c/1d
tracked) → **NO code (re-implement = duplicate — Gate-1/LSN-035)** → **GATE 1 pending** (close-as-delivered [recommended]
vs implement a residual). No GitHub write yet (the drafted comment posts only on approval).
