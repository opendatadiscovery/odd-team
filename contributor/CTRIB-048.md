---
id: CTRIB-048
title: "ST-1 — Parametrised-URL search state (shareable & bookmarkable; retire session-id-as-share-handle)"
issue: "ST-1 sub-issue of #1825 (being created by the maintainer; milestone 1.0.0)"
parent_epic: 1825
class: feature
status: pending-release   # Phase D + DoD complete (green-for-change); DRAFT PR #1833 open; hand to /review (implementer does NOT self-done — G-C4) | LEDGER-RECONCILED 2026-08-30: was `review-ready`; PR #1833 (`f63d3915`) merged, but NOT released — milestone 1.0.0, which is OPEN/UNRELEASED (latest release 0.29.0, 2026-06-26). GATE 2 is done; `/review release:1.0.0` owns the flip to `done`.
target_repo: odd-platform
milestone: "1.0.0"
adr: "adrs/drafts/unified-asset-search.md (rev 3 — D10 param-URL, D9 no-break) [maintainer-approved direction]"
adr_required: false            # G-C7 does NOT fire: additive, no migration / no auth-posture / no wire-contract break (D9). Covered by the approved ADR D10.
reproduced: "n/a (feature). Current behaviour VERIFIED in-tree: /search POSTs a mutable search_facets session → navigates to /search/{searchId}; filters→redux→PUT; the URL carries ONLY searchId; expired sessions = the IT-125/#1760 dead-link."
plan_approved_by: "maintainer — GATE 1 AskUserQuestion 2026-06-30 (chose: ST-1a query-only now; ST-1b facets fast-follow)"
plan_approved_at: "2026-06-30"
docs_routing: "release/1.0.0 train (unreleased behaviour — the shareable param-URL) + a paired DOC item"
effort: large                  # a core FE search-state refactor — held to reliable+stable
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1833"   # DRAFT, bot-authored, Part of #1825 (no closing keyword — verified live)
pr_draft: true
docs_pr: "documentation docs/CTRIB-048-search-url-state @ 61cd0a8 (search.md caveat rewrite) — push to release/1.0.0 PENDING the maintainer (classifier-gated); DOC-495"
---

## Context

ST-1 of the #1825 search overhaul (`state/search-overhaul-decomposition.md`), realising **ADR D10**: move the search
state into the **URL as parametrised query params** so a search is **stateless, shareable, bookmarkable, and
back/forward-correct** — the foundation the named saved searches (ST-3) sit on, and the retirement of the expiring
`/search/{sessionId}` share handle (fixes the IT-125 class as a bonus). Built on the **current DE search**,
forward-compatible with the unified core (ST-4).

## Current state (verified 2026-06-30, `2f9734e1`)

- `Search.tsx` on mount `createSearch({query:'', filters:{}})` → `POST /api/search` → `searchId` → `navigate(/search/{searchId})`.
- `searchRoutes.ts`: the route is `/search/:searchId` (optional); `useSearchRouteParams()` → `{searchId}`; **the URL carries only the session id.**
- Filters + query → the `dataEntitySearch` redux slice → synced to the session via `updateDataEntitiesSearch` (PUT, debounced). **Filters never touch the URL** (verified — no `useSearchParams` in `Search/Filters/`).
- `/search/{id}` deep-link → `getDataEntitiesSearch(routerSearchId)`; expired/foreign session → the IT-125 graceful dead-link.

## Design before build (G-C12)

- **Reuse, don't rebuild.** Keep the `dataEntitySearch` slice + the facet model + the thunks. **Add a URL↔state sync
  layer** — the Algolia `stateToRoute`/`routeToState` two-way mapping over react-router `useSearchParams`, **debounced
  (~400 ms)**, loop-guarded. The session stays as the **internal FTS-execution detail, derived from the params** (D10).
- **ADR-check:** conforms to the approved **D10** + **D9** (additive). **G-C7 does not fire** (no migration, no
  auth-posture, no wire-contract break — pure FE state↔URL + the existing session API).
- **Impact checklist:** i18n — **none** (no new strings); generated BE/FE clients — **none** (no API change);
  consumers — `Search.tsx` (mount logic), `MainSearchInput`, `Filters/*`, the slice's read/sync; migrations — none;
  docs — the search page (release train); ontology — refresh the search-flow sidecar at DoD.
- **PO/SRE lens:** the win = shareable/bookmarkable + back/forward + no session-expiry on shared links. SRE — debounce
  avoids history-spam; **param parsing fails closed** (unknown/malformed params → ignored/defaulted, never a crash);
  no new query cost (the same POST/PUT, now param-driven).

### Param schema (clean, forward-compatible)
`q` (query) + the existing facets as params (`namespace`, `datasource`, `owner`, `tag`, `group`, `status`, `type`/
entity-class, `my` for My-Objects) + page (kept internal to the infinite-scroll for now). Multi-value facets =
repeated/CSV params. **Facet values are ids today** (matching `facetState`); human-readable slugs are a later
enhancement (flag, not in scope). The schema is **additive-ready** for `asset_kinds` (ST-4/5) + `sort` (ST-2).

### Backward-compat (D9 — the hard constraint)
`/search/{sessionId}` legacy deep-links **keep working** (still `getDataEntitiesSearch`, IT-125 graceful expiry
preserved). The **param URL becomes the canonical shareable form**; new shares/bookmarks use it. *(Optional, flagged:
on loading a legacy session, redirect to the equivalent param URL — a nice-to-have I'd EXCLUDE from ST-1 to bound risk.)*

### The key care-point (named for review)
`Search.tsx`'s mount = create-empty-session-then-navigate, and there is a known **session-creation race** (the IT-022
hardening note: Enter before the session exists silently no-ops). Driving the search from URL params **reworks that
mount path**, so the race is the thing to get right + test hardest.

## Scope EXCLUSIONS (G-C5)
- **NOT** the unified cross-kind index (ST-4) · **NOT** sort (ST-2) · **NOT** saved searches (ST-3) · **NOT** new
  filters / facet-logic (ST-5/6) · **NOT** cross-kind. ST-1 moves **the current DE search's state (query + the existing
  facets + page) into URL params** and makes that the shareable form — nothing more.

## Tests (G-C9 — both buckets)
- **Unit (odd-platform CI):** the `stateToRoute`/`routeToState` round-trip (state→URL→state is identity; unknown params
  ignored; empty state → clean URL). RED on the absent layer, GREEN on the impl.
- **Integration IT (odd-team, extend IT-022/IT-125) — _ST-1a query-only; see the GATE-1 package Tasks (authoritative)_:** (a) commit a query → the canonical `/search?q=` URL reflects it (**filters**-in-URL = ST-1b); (b) open that
  URL fresh (new context) → the **same search renders** (the share/bookmark proof); (c) **back/forward** navigate search
  states; (d) a legacy `/search/{sessionId}` deep-link **still loads** (D9). RED on `ref:main`, GREEN on the working-tree SUT.
- **DoD:** full unit build + the FULL integration regression on the working-tree SUT (feature-complete green — search is
  driven by many specs; multi-stack green; known-bugs still-RED; ingestion-e2e green) + docs read+routed + ontology refreshed.

## Docs (G-C10 + G-C11)
The search page gains "share/bookmark a search via its URL" — **release/1.0.0 train** (unreleased behaviour) + a paired
backlog DOC item. Read the live page at DoD before authoring.

## GATE-1 package — hardened front-loop (session `ctrib048`, 2026-06-30, live-revalidated @ `2f9734e1`)

The 2026-06-30 draft above predates the formal **spec-gate** (G-C17) + **plan-contract** (G-C19). This section adds
them and records the **live code re-validation** the decomposition flagged ("`../odd-platform` is not in this
environment … warrant a code read at each slice's GATE-1"). It IS present this session — origin/main @ `2f9734e1`,
the exact commit the draft verified against — so every claim below is confirmed against running source, not inferred.

### Live re-validation deltas (vs the draft above)

1. **Reuse correction (G-C12).** The draft said "introduce a URL↔state sync layer over react-router `useSearchParams`."
   Live read: the platform ALREADY ships **`lib/hooks/useQueryParams.ts`** — a generic state⇄URL hook (parse
   `location.search`→object; `setQueryParams`→`navigate`; `query-string` with `arrayFormat:'bracket-separator'`,
   `skipEmptyString/skipNull`, `parseNumbers/parseBooleans`). ST-1 **reuses/extends `useQueryParams`** (it already does
   "encode only non-default values" + multi-value arrays), NOT a parallel `useSearchParams` layer (that would be the
   LSN-035 parallel-component miss — caught here, pre-GATE-1). The one gap: `setQueryParams` always `navigate()`s (push)
   → ST-1 adds an optional `replace` flag so debounced *intermediate* writes don't spam history (push only on a
   *committed* state, so back/forward stay clean).
2. **Hydrate surface + the facet-id complexity.** `dataEntitySearch.slice.ts:105-266` exposes `updateSearchQuery(string)`
   + `changeDataEntitySearchFacet(FacetStateUpdate)` (ONE facet option at a time, keyed by **numeric `entityId`**; the
   label `entityName` rides alongside and backfills from the facet-options fetch) + `clearDataEntitySearchFacets`.
   **There is no bulk "hydrate whole search state from a param object" action.** The URL carries facet **ids** (confirmed
   — `facetState` is id-keyed; names are labels), so hydrating a deep-link = set selected-by-id and let names backfill
   once options load — a real ordering care-point, and the large/risky half of ST-1.
3. **Budget → recommended split.** ST-1 whole ≈ 4-5 source files (`searchRoutes.ts` + `useQueryParams` + `Search.tsx` +
   the slice hydrate + Filters/MainSearchInput propagation) — the plan-contract **>3-5-files decompose signal** — plus
   the facet-ordering risk. q+page alone is small and ships observable value (shareable query link + the IT-125 fix). Per
   the maintainer's epic steer ("decompose properly — reliable + stable, not one big-bang") and the ST-4
   "vertical-split-if-oversized" precedent, the recommendation is a **Data-axis split** (below) — surfaced as a GATE-1
   decision, never a silent reduction.

### Spec (G-C17) — falsifiable WHAT + ambiguity score

| # | Requirement (testable) | Current (`file:line` @ 2f9734e1) | Target | Acceptance (pass/fail) |
|---|---|---|---|---|
| **R1** | Search state serialises to URL query params | `Search.tsx:58-63` creates an empty session on mount; URL carries only `:searchId` (`searchRoutes.ts:4`); filters live in the slice, PUT-synced to the session (`Search.tsx:71-86`), never to the URL (reuse-scan: 0 `useSearchParams` in `components/Search/`) | the canonical state ⇄ `?q=&<facets>` via `useQueryParams` (extended; **page stays internal infinite-scroll state, NOT serialized** — W1), **push per committed query**, loop-guarded; only non-default values | state→URL→state round-trip is identity; empty state → clean URL (unit) |
| **R2** | A loaded URL reproduces the exact search | deep-link `/search/{id}` re-fetches the session (`Search.tsx:65-69`); a param URL does nothing (no parser) | opening `/search?q=…` parses params → runs the same search, no pre-existing session needed | a param URL opened in a fresh context renders the same results (integration) |
| **R3** | Shareable, bookmarkable, back/forward-correct, recipient-scoped | sharing is `/search/{sessionId}` — mutable + expiring (`IT-125`/#1760 dead-link, `Search.tsx:48-51,94-96`) | the param URL is the canonical share form; back/forward navigate states; a copied URL runs as the RECIPIENT (server re-executes under their identity — D2/D11) | back/forward change rendered results; a param URL under a 2nd identity is permission-scoped (integration) |
| **R4** | Backward-compat (D9 hard line) | legacy `/search/{sessionId}` loads via `getDataEntitiesSearch`; IT-125 graceful expiry | legacy session deep-links KEEP working (unchanged branch); `/api/search` contract untouched | a legacy `/search/{id}` still loads / shows graceful-expired; `/api/search` unchanged (integration + no-API-diff) |
| **R5** | Param parse fails closed (security/SRE) | n/a (no parser) | unknown/malformed params ignored/defaulted, never crash; the FTS path stays tsquery-escaped (IT-003 guard) | a garbage param URL renders the default search, no crash (unit+integration); a tsquery-poison `q` → empty, never 500 (IT-003) |

**Negative (must-NOT) acceptance:** NO secrets/PII in the URL (only catalog-metadata facet ids + `q` + the future `sort`);
the shared link must NOT run as the sharer (re-evaluates as the recipient); must NOT fire a search per keystroke
(debounced, committed-state only); must NOT break the legacy session deep-link or `/api/search` (D9).

**Boundaries.** *In scope:* the CURRENT DE search's state (q + the 9 existing facets + myObjects + page) ⇄ URL params;
making the param URL the canonical share form; reworking the `Search.tsx` mount to derive initial state from params;
preserving the legacy session deep-link. *Out of scope (+why):* unified cross-kind index (ST-4); `sort` param (ST-2 —
schema stays additive-ready); saved searches (ST-3); new filters / facet-logic (ST-6/ST-11); `asset_kinds` (ST-4/5);
human-readable slug facet values (later — values stay ids, matching `facetState`); the optional legacy-session→param-URL
redirect (EXCLUDED to bound risk, per the draft).

**Constraints.** Perf: debounced URL writes (~400 ms, `replace`); no new query cost (same POST/PUT, now param-driven);
no history spam. Security (release gate): no secrets in URL; recipient-scoped re-eval (D11); fail-closed parse;
tsquery-escaped FTS (IT-003). Compat (D9 hard line): `/api/search` + legacy session deep-links unbroken. ODD-UX pattern
to reuse: `useQueryParams` (`feedback_reuse_platform_ui_patterns`).

**Ambiguity report (G-C17 gate ≤ 0.20):** goal `0.95` (≥0.75 ✓) · boundary `0.92` (≥0.70 ✓) · constraint `0.85`
(≥0.65 ✓) · acceptance `0.88` (≥0.70 ✓) → **ambiguity = 1 − (0.35·0.95 + 0.25·0.92 + 0.20·0.85 + 0.20·0.88) = 0.092**
≤ 0.20, all minimums met. **Open questions:** none unresolved — facet-value-encoding = ids (RESOLVED: code `facetState`
is id-keyed); legacy-redirect = EXCLUDED (RESOLVED: draft decision, risk-bound); param-URL-vs-session = both kept,
param canonical for new shares (RESOLVED: ADR D9 convergence window).

### Recommended slicing — ST-1a now / ST-1b fast-follow (the one GATE-1 decision; an explicit split, not a `v1` shadow)

A Data-axis SPIDR split — each half ships a complete user-observable truth, the schema is additive so ST-1b layers on
without rework (NOT a silent scope reduction; ST-1b is a tracked slice with its own spec → plan → tests → PR → gates):

- **ST-1a (recommended build now):** **query + page** URL state. Shareable/bookmarkable query link; back/forward; the
  legacy session deep-link preserved; fail-closed parse; recipient-scoped. Establishes the **param schema contract**
  (facet-additive-ready) that ST-2 (`sort`) and ST-3 (saved-search spec) depend on — so it unblocks them exactly as
  "ST-1" did. ~3 files, within budget.
- **ST-1b (immediate fast-follow):** the **9 facets + myObjects** ⇄ URL params — the id-keyed hydrate + name-backfill
  ordering work — layered additively on ST-1a's schema. Its own GATE 1.

*Alternative the maintainer may choose:* build ST-1 **whole** (ST-1a + ST-1b in one PR) — defensible as one coherent
feature; ST-1a's plan is then a strict subset extended with the facet wiring (re-plan-checked).

### must_haves contract (G-C19) — for ST-1a

```yaml
must_haves:
  truths:                       # user-observable; each verifiable by driving the running stack; each → a Spec line
    - "Typing a query + Enter on /search updates the URL to a shareable link encoding the query"   # R1
    - "Opening a /search?q=… URL in a fresh browser (no prior session) runs that query + shows results"  # R2
    - "Browser back/forward navigates between prior query states"                                    # R3
    - "A /search?q=… URL run by another user returns results scoped to THAT user's permissions"      # R3 (security)
    - "A legacy /search/{sessionId} link still loads (or shows the graceful expired state)"          # R4 (D9)
    - "A malformed query URL shows the default search, never a crash; a tsquery-poison q → empty, not 500"  # R5
  artifacts:
    - path: "odd-platform-ui/src/routes/searchRoutes.ts"
      provides: "the search param schema (q, internal page) + searchStateToParams / paramsToSearchState (facet-additive-ready, fail-closed)"
      anchor: "paramsToSearchState"
    - path: "odd-platform-ui/src/lib/hooks/useQueryParams.ts"
      provides: "REUSE — extend with an optional `replace` flag so debounced intermediate writes don't push history"
      anchor: "replace"
    - path: "odd-platform-ui/src/components/Search/Search.tsx"
      provides: "mount derives initial query from URL params (replaces the unconditional empty createSearch :58-63) + writes query→URL debounced; PRESERVES the legacy /search/{sessionId} branch (:65-69) + expired-session UI (:94-96)"
      anchor: "useQueryParams"
  key_links:
    - from: "Search.tsx mount"
      to: "createDataEntitiesSearch / getDataEntitiesSearch thunk"
      via: "paramsToSearchState(useQueryParams()) drives the initial query — NOT an unconditional empty create"
      breaks_if: "mount still always creates an empty session → the URL params are ignored → R2 fails"
    - from: "dataEntitySearch.query (slice)"
      to: "the URL"
      via: "debounced (~400 ms) searchStateToParams writer via useQueryParams.setQueryParams({replace:true})"
      breaks_if: "no debounce/replace → history spam; no loop-guard → write↔read infinite loop"
    - from: "legacy /search/{sessionId}"
      to: "getDataEntitiesSearch(routerSearchId)"
      via: "the preserved Search.tsx:65-69 deep-link branch"
      breaks_if: "the mount rework deletes the branch → D9 + IT-125 regression"
    - from: "the param q"
      to: "server FTS execution"
      via: "the existing escaped tsquery path (/api/search, unchanged)"
      breaks_if: "a new param-driven query path bypasses escaping → IT-003 injection regression"
```

### Tasks (ST-1a) — specific, sized, no scope-reduction

1. **Param schema + (de)serialisers.** *Files:* `routes/searchRoutes.ts` (+ a small `lib/search/searchUrlState.ts` if it
   keeps `searchRoutes` thin). *Action:* define `q` (+ internal `page`) param names + `searchStateToParams(state)→params`
   / `paramsToSearchState(params)→{query}`, facet-additive-ready, fail-closed (unknown/malformed → defaults). *Verify:*
   `pnpm test` the round-trip + garbage-param unit. *Done:* round-trip identity GREEN; unknown params ignored.
2. **Reuse `useQueryParams` with a `replace` option.** *Files:* `lib/hooks/useQueryParams.ts`. *Action:* add an optional
   `replace` flag threaded to `navigate(url,{replace})`; default push (existing callers unchanged). *Verify:* `pnpm test`
   + `tsc`. *Done:* existing callers byte-unchanged in behaviour; the replace path covered.
3. **Wire `Search.tsx` mount ⇄ URL.** *Files:* `components/Search/Search.tsx`. *Action:* derive the initial query from
   `paramsToSearchState(useQueryParams())` and run it (replace the unconditional empty `createSearch` :58-63); write
   `query`→URL debounced (~400 ms, `replace`) on change; PRESERVE the legacy `/search/{sessionId}` branch + expired UI
   unchanged. *Verify:* the extended IT-022/IT-125 e2e RED on `ODD_SUT=ref:main`, GREEN on the worktree SUT. *Done:*
   the six `must_haves` truths hold on the running stack.

*Budget:* 3 tasks / ~3 files + tests — within a single context window's quality budget.

### Plan-check round 1 (G-C19) — ISSUES FOUND (2 BLOCKER, 6 WARNING) → revised

The adversarial `plan-checker` (fresh-context, goal-backward, against live `2f9734e1`) **rejected** the first ST-1a plan.
The gate did its job — both blockers are real wiring defects. **This revision is the authoritative plan; where it
differs from the `must_haves`/Tasks above, it supersedes them.**

**Verified-correct (not re-litigated):** the ST-1a/ST-1b **split is a legitimate SPIDR Data-axis split** (not a `v1`
shadow); the **`useQueryParams` reuse** is the right target (real; ~20 callers; 0 `useSearchParams` in `components/Search/`);
D8/D9/D10 fit, `adr_required:false`, milestone/docs-routing — all PASS.

**BLOCKER 1 — the canonical param URL was never produced (a hybrid `/search/{id}?q=…`).** Root cause: the home box
(`Overview` → `MainSearch mainSearch` → `useCreateSearch:16-18` → `navigate(/search/{searchId})`) plus
`useQueryParams.setQueryParams:56` (`navigate(${location.pathname}?…)`) mean the writer appends `?q=` to the **session**
path → a hybrid that keeps the expiring session id, defeating D10 + the IT-125 fix. The first plan never rewired the
search-entry navigation.
**BLOCKER 2 — `replace:true` defeated back/forward.** `slice.query` changes **only on a committed search**
(`updateSearchState` off `*.fulfilled`, `slice:214-217`) — not per keystroke — so there is no history-spam to suppress;
`replace` then creates **zero** history entries → back/forward dead. The debounce+replace rationale was misapplied to a
commit-driven value.

**The revision (one root-cause fix):** make the **URL the source of truth** — any committed query navigates to the
canonical **`/search?q=<query>`** (BASE path, **no** session id), **push** (one history entry per query → back/forward
work); the Search page **reacts to the URL** (parses params → creates+runs the search server-side; the session is
internal, derivable from params — D10). This pulls the **search-entry navigation** (`MainSearchInput`) into ST-1a scope
(~4 files, still ≤5-budget — the checker confirmed "not too big to fix in plan").

**Revised `must_haves` key_links (authoritative):**
```yaml
key_links:
  - from: "a committed query (MainSearchInput — the nav-bar mainSearch box OR the search-page box)"
    to: "the URL"
    via: "navigate(searchPath() + '?' + searchStateToParams({query})) — canonical BASE-path param URL (no session id), PUSH"
    breaks_if: "writing onto the current /search/{id} pathname → hybrid URL keeps the expiring session (BLOCKER 1); or replace → no history entry → back/forward dead (BLOCKER 2)"
  - from: "Search.tsx mount"
    to: "createDataEntitiesSearch (run) | getDataEntitiesSearch (legacy)"
    via: "precedence: routerSearchId → load session (D9 branch :65-69 unchanged) ELSE ?q=/params → paramsToSearchState → create+run ELSE empty; param-create gated on !routerSearchId"
    breaks_if: "param-create fires while routerSearchId present → spurious replacement POST on a cold /search/{id} (IT-125/#1760 regression); or unconditional empty-create → URL ignored (R2 fails)"
  - from: "a malformed ?q= / garbage params"
    to: "a safe default search"
    via: "fail-closed paramsToSearchState (unknown keys ignored, never throws)"
    breaks_if: "parse throws → white screen (R5)"
# the q→server-FTS escaping is INHERITED-safe — ST-1a reuses the unchanged /api/search thunk; the IT-003 guard is untouched.
```

**Revised Tasks (ST-1a — authoritative):**
1. **Param (de)serialisers (fail-closed).** Files: `lib/search/searchUrlState.ts` (new, thin) + `routes/searchRoutes.ts`.
   `searchStateToParams({query})→{q?}` (omit empty) + `paramsToSearchState(parsed)→{query}` (unknown keys ignored, never
   throws), facet-additive-ready, reusing `query-string` with `useQueryParams`' options. *Verify:* `pnpm test` round-trip
   + garbage-param. *Done:* identity round-trip GREEN; malformed → default, no throw.
2. **Extend `useQueryParams` (reuse, backward-compatible).** Files: `lib/hooks/useQueryParams.ts`.
   `setQueryParams(value, opts?: {pathname?; replace?})` — pathname defaults to `location.pathname` (the ~20 existing
   callers unchanged), replace defaults false (push). ST-1a passes `{pathname: searchPath()}`. *Verify:* `pnpm test` +
   `tsc`; existing callers unchanged. *Done:* default behaviour preserved; the pathname-target path covered.
3. **Rework the search-entry flow to the param URL (the core change).** Files: `MainSearchInput.tsx` + `Search.tsx`.
   (a) MainSearchInput — a committed query (BOTH the `mainSearch` nav-bar box and the search-page box) navigates to
   `searchPath()?q=<query>` (push) instead of POST→`/search/{id}` / PUT-to-session; (b) Search.tsx mount — the precedence
   above (legacy GET branch `:65-69` unchanged; `?q=` → create+run; gated `!routerSearchId`); loop-guard the URL write
   (navigate only when serialized-state ≠ current URL); the IT-022 session-creation race dissolves (the search runs from
   the URL, not a pre-input empty session). *Verify:* extended IT-022 (type→Enter→`/search?q=` + results) + IT-125
   (legacy `/search/{id}` still loads, **no** spurious POST — #1760; a shared `/search?q=` reproduces; back/forward) RED
   on `ODD_SUT=ref:main`, GREEN on the worktree SUT; **IT-022's existing assertions stay GREEN** (G-C15: any changed
   assertion keeps its RED-on-`ref:main` proof). *Done:* the truths hold on the running stack; legacy unbroken;
   back/forward work.

**Spec corrections from the warnings:** **W1** — `page` is **internal infinite-scroll state, NOT serialized** in
ST-1a/ST-1b (`Results.tsx:3,71-73` — a `?page=3` deep-link would fetch only page 3, dropping items 1-60); R1's target
corrected below. **W2** — truth #4 (recipient-scoped) is **inherited** from the unchanged `/api/search` (already runs as
the caller; the URL carries only the query, never results) → a satisfied-by-construction NEGATIVE acceptance, genuinely
exercised only with auth enabled (out of the DISABLED IT-022/IT-125 stack scope), **not** a claimed new ST-1a stack proof.
**W5** — the original `## Tests` filters-in-URL case is ST-1b. **W3/W6** are folded into Task 3.

**Re-check:** the revised plan is re-submitted to the `plan-checker` (loop 2) before GATE 1.

### Plan-check round 2 (G-C19) — VERIFICATION PASSED ✅ (ready for GATE 1)

The `plan-checker` (loop 2, fresh context, @ `2f9734e1`) confirms **both blockers RESOLVED** and the `MainSearchInput`
rework introduces **no new BLOCKER**:
- **B1 fixed:** `searchPath()` (no arg) = base `/search` (`searchRoutes.ts:7-12`) → the writer emits the canonical
  `/search?q=` (no session id); the mount **replaces** the `:58-63` empty-create (a naive *added* effect would still
  fire under `!routerSearchId && !searchId` and re-create the hybrid — the "replace" wording avoids it); key_link 2's
  `to:` is the raw `createDataEntitiesSearch` thunk (no navigate).
- **B2 fixed:** confirmed `slice.query` updates only on `*.fulfilled` (`slice:205-217`); the revision PUSHes once per
  committed query (one history entry → back/forward work).
- **Blast radius bounded:** `MainSearch` has exactly 2 consumers (`Overview.tsx:48` home + `Search.tsx:109`
  search-page); **no nav-bar instance**; suggestions entity-click (`SearchSuggestionsAutocomplete.tsx:138` `<Link>`) is
  independent + unaffected; `useCreateSearch` is NOT orphaned (still used by `handleStartNewSearch`, `TopTagsList`,
  `DataEntitiesUsageInfo`, `ToolbarTabs`); the #1760 no-spurious-POST guard holds (`!routerSearchId`);
  `useQueryParams {pathname?,replace?}` is backward-compatible for the ~20 callers.

**4 non-blocking WARNINGs — folded into the plan (these refine Task 3, now authoritative):**
- **W1 →** Task 3(b): the mount dispatches the **raw `createDataEntitiesSearch` thunk (NO navigate)** — never
  `useCreateSearch` (which navigates to `/search/{id}` and would re-introduce B1).
- **W2 →** Task 3(b): the param-reading mount effect **re-fires on `q` change** (keyed on the URL query, not mount-once)
  — so Back/Forward re-render the results (B2's second half).
- **W3 →** the leftover "loop-guard the URL write" is **removed** from Search.tsx: `MainSearchInput` is the **sole** URL
  writer; `Search.tsx` is **URL-read-only** (parses + runs). No second writer to guard.
- **W4 → scope (G-C5):** `TopTagsList`, `DataEntitiesUsageInfo` (tag/class clicks), `ToolbarTabs` (Catalog tab) keep
  navigating to `/search/{sessionId}` — **deliberately unchanged** (the preserved legacy branch, D9; their filter-nav
  rewire = ST-1b). Named so `/review` doesn't read it as a missed migration and ST-1b's scope is explicit.

**Verdict:** plan-check **PASSED (no open BLOCKER)** → presented at **GATE 1**.

## Phase D — implementation + verification (2026-06-30, GATE 1 APPROVED: ST-1a)

**GATE 1 approved** (AskUserQuestion: "ST-1a now, ST-1b next"). Built ST-1a on `contrib/CTRIB-048-search-url-state`
(worktree `../odd-platform-ctrib048` off `origin/main` 2f9734e1; LSN-038-safe — upstream unset, push.default=current,
no push until GATE 2). **Commit `b37d06b9`** (6 files, +220/−36):

| File | Change |
|---|---|
| `lib/search/searchUrlState.ts` (new) | `searchStateToParams`/`paramsToSearchState` — q (de)serialisers, fail-closed, facet-additive-ready (reuses `query-string`) |
| `lib/hooks/useQueryParams.ts` | optional `{pathname?, replace?}` on `setQueryParams` (backward-compatible; the 37 callers pass none) |
| `…/MainSearchInput/MainSearchInput.tsx` | both entry points (home hero + search-page box) navigate to canonical `/search?q=` (push) — the SOLE URL writer |
| `components/Search/Search.tsx` | URL-read-only — one fresh session per visit, updated on URL-query change (back/forward); legacy `/search/{sessionId}` branch preserved (D9); `handleStartNewSearch`→`searchPath()` |

**Tests — both buckets (G-C9), all RUN (you run what you write):**
- **Unit (vitest, node 24):** `searchUrlState.test.ts` (5) + `useQueryParams.test.tsx` (4) — **9/9 GREEN**. Full FE suite
  **109/110 green-for-change** (the 1 = pre-existing `i18n-key-parity` RED in `LinkedTermsList.tsx:63`, RED on
  `origin/main` too — un-caught by CI because the FE vitest suite isn't in the `-PbundleUI=false` Java CI → follow-up
  logged). `tsc --noEmit` clean; `eslint` clean.
- **Integration (e2e, working-tree SUT `odd-platform:odd-team-sut-ctrib048`):**
  - **NEW IT-150** `search-url-state.spec.ts` (4): commit→`/search?q=` (no session id); share/bookmark (fresh context);
    back/forward; unknown-params fail-closed. **4/4 GREEN** on worktree, **4/4 RED on `ODD_SUT=ref:main`** (the `?q=`
    contract is absent on base).
  - **G-C15 changed tests** (SoT = ADR D10; assertions not weakened; RED-survives-on-base proven): IT-022 `catalog-search`
    helper → `/search?q=`+results-GET (2/2 GREEN worktree, **2/2 RED ref:main**); IT-125 `search-session-not-found`
    recovery → `/search` (5/5 GREEN worktree; **the changed recovery test RED on ref:main**; the other 4 unchanged-PASS
    incl. the D9 valid-deep-link, `searchPosts===0`); IT-149 `recently-viewed` helper (5/5 GREEN worktree; helper RED on
    base by the same mechanism as IT-022). Registered IT-150 in `suites.yaml` feature-complete + ui-e2e.
- **FULL regression** `run-regression.sh ctrib048` (SUT built from the committed `b37d06b9`, flock-serialized):
  **feature-complete GREEN-for-change** (my ITs all pass; the 2 failures are pre-existing/contributor-independent —
  `favorites-star-see-loop:159` = the **unmerged** CTRIB-039 Group-B Description column, RED on base; `owner-association-triage:78`
  = the known owner-association flake, 1.0m timeout) · **multi-stack PASS** · **ingestion-e2e 15/15 PASS** ·
  **known-bugs expected-RED** (the 3 known bugs; none search-related, none flipped).
- **Unit build (Java, DoD #1):** ST-1a changes **0 Java files** → `:odd-platform-api:build` is byte-identical to
  `origin/main` (green in CI); **run for airtightness → `:odd-platform-api:build` BUILD SUCCESSFUL (8m18s, exit 0)**.
  The patch-coverage gate (`min-coverage-changed-files: 98`, JaCoCo) is **N/A** (0 Java changed files); FE coverage is
  Sonar-informational, not a hard PR gate.

**Docs (G-C10 + G-C11):** READ `data-discovery/search.md` — its "Known limitations" caveat ("The `/search/{id}` URL is a
server-side session") documented exactly the behaviour ST-1a changes. Rewrote it to the shareable `/search?q=` model
(query-in-URL, recipient-scoped share, durable bookmark, facets-not-yet-in-URL, legacy-still-loads). **Committed
`61cd0a8`** on `docs/CTRIB-048-search-url-state` (off `release/1.0.0` 891ed14). The **push to the shared `release/1.0.0`
train is maintainer-gated** (the auto-mode classifier blocks an agent's direct push to the shared published release
branch — same human-gate class as GATE 2). Paired backlog: **DOC-495**.

**Ontology (G-C10):** the `…component__Search.md` + `…route__search.md` sidecars describe the session-URL mount/navigate
flow ST-1a replaces — they go stale **on merge**. The ontology tracks `main`; re-enriching now (against unmerged code)
would re-describe the old flow or create ahead-of-main drift. **Re-enrich `--touched` DEFERRED to ST-1a's merge to main**
(a merge-gated DoD item, like the release-gate live-site verification — nothing is stale until merge, so this is NOT the
CTRIB-001 post-merge-staleness failure).

**Definition of Done (five gates):** ① unit green-on-working-tree — FE vitest 9/9 green-for-change + tsc + eslint; Java
`:odd-platform-api:build` SUCCESSFUL (8m18s; 0 Java diff) ✅ · ② FULL integration regression green-for-change (all 4 suites) ✅ · ③ docs read + decided + routed +
AUTHORED on the train (committed `61cd0a8`; push surfaced) ✅ · ④ ontology decided (deferred-to-merge, justified) ✅ ·
⑤ Principal sufficiency (G-C13) — enough + meaningful tests, no Java coverage gate triggered, no control lost, no
existing functionality harmed (regression green-for-change); **no pixel review needed — ST-1a is a behaviour change with
no visual delta** (the search page renders identically; only the URL bar changes `/{uuid}`→`?q=`, proven by IT-150) ✅

**Follow-ups logged (G-C5 / follow-up-on-disk):** DOC-495 (the search-doc train push) + the pre-existing
`i18n-key-parity` FE RED (`LinkedTermsList.tsx:63`, RED on `origin/main`, un-caught by CI — see Status).

## Status
intake → G-C11 PASS → spec-gate 0.092 → must_haves → plan-check (1: 2 BLOCKER → revised; 2: PASSED) → **GATE 1 APPROVED
(ST-1a)** → implemented `b37d06b9` → unit 9/9 + tsc + eslint green-for-change → e2e IT-150 4/4 + IT-022/125/149 updated
(GREEN worktree / RED ref:main) → **FULL regression green-for-change** → docs `61cd0a8` (train push gated→maintainer) →
ontology deferred-to-merge → **DoD MET** → **DRAFT PR #1833 OPEN** (bot-authored `odd-contributor[bot]`, draft, base
`main`, `Part of #1825` — no closing keyword, verified live; the bot cannot self-merge — G-C4) → **status review-ready**.
**Next:** `/review` (separate session, reject-by-default) → **GATE 2** (human merge). **Maintainer action surfaced:**
push the docs train — `git -C ../documentation-ctrib048docs push origin HEAD:release/1.0.0` (DOC-495; the auto-mode
classifier gates an agent push to the shared release branch).

## Review (2026-06-30, session: review-ctrib048)
- **Result**: ACCEPTED
- **Reviewed**: odd-platform `contrib/CTRIB-048-search-url-state` @ `b37d06b9` (parent `origin/main` `2f9734e1`); the
  odd-team bookkeeping commit `7dd0f48` (IT-150 + the changed IT-022/125/149 + suites.yaml + DOC-495). Independent
  rebuild from `b37d06b9` (review-ctrib029 lesson — the implementer's cited digest `daa7d501` was NOT trusted).
- **Acceptance criteria (the ST-1a `must_haves` truths, each driven on my own rebuilt running stack via IT-150)**:
  - [x] R1 — committing a query writes the canonical `/search?q=` URL with **no session id** — PASS (IT-150 spec 292 GREEN on my `revctrib048` rebuild; the spec asserts `new URL(page.url()).pathname === '/search'`; code: `MainSearchInput.tsx` `setQueryParams({q},{pathname: searchPath()})`, `searchPath()`→base `/search`, push)
  - [x] R2 — opening `/search?q=` fresh (no prior session) reproduces the search — PASS (IT-150 spec 293 GREEN; `Search.tsx` mount derives `urlQuery` and dispatches the **raw** `createDataEntitiesSearch` thunk — no navigate)
  - [x] R3 — browser back/forward navigates prior query states — PASS (IT-150 spec 294 GREEN; PUSH per committed query; `updateDataEntitiesSearch.fulfilled`→`updateSearchState` resets `pageInfo.page=0` (slice:100,216), `fetchDataEntitySearchResults.fulfilled` REPLACES items when `page≤1` (slice:224) → no stale-append)
  - [x] R4 — legacy `/search/{sessionId}` deep-link still loads / graceful-expired (D9) — PASS (IT-125 `search-session-not-found` 5/5 GREEN incl. the `/termsearch/{valid|missing}` cases; the `getDataEntitiesSearch(routerSearchId)` branch + `SearchSessionExpired`/`AppErrorPage` UI preserved in `Search.tsx`)
  - [x] R5 — malformed/unknown params → default search, never crash — PASS (IT-150 spec 295 GREEN; `searchUrlState.test.ts` fail-closed incl. `%zz`; IT-003 tsquery-poisoning catalog+dictionary GREEN — the FTS escaping is inherited-unchanged)
  - [x] Security (recipient-scoped re-eval, no secrets in URL) — PASS by construction (W2: inherited from the unchanged `/api/search`; the URL carries only `q`; genuinely exercised only with auth enabled, out of the DISABLED IT stack scope — correctly NOT claimed as a new stack proof)
- **Quality Bar**:
  - Gate 1 — PASS (reuses `useQueryParams` + the raw `createDataEntitiesSearch` thunk; no parallel `useSearchParams` layer — the LSN-035 trap avoided; `useCreateSearch` not orphaned at `b37d06b9` via `git grep`: still used by `TopTagsList`/`DataEntitiesUsageInfo`/`ToolbarTabs` — the deliberately-deferred ST-1b consumers, W4)
  - Gate 2 — N/A (no alias introduced)
  - Gate 3 — PASS (the new `search.md` caveat captures the new model + facets-not-yet-in-URL + legacy-still-loads as bullets, not buried)
  - Gate 4 — PASS (the 9-file `Consumer-read:` footer verified against `b37d06b9`: `Search.tsx`, `MainSearchInput.tsx`, `searchRoutes.ts`, `useQueryParams.ts`, `useCreateSearch.ts`, `dataEntitySearch.slice.ts`, `dataentitiesSearch.thunks.ts`, `Results.tsx`, `Overview.tsx` — each read matches the code)
  - Gate 5 — N/A (no SDK builder in scope)
  - Gate 6 — PASS (every functional claim → code evidence; the behaviour change → DOC-495 on the train; one editorial cross-surface finding logged as DOC-496)
  - Gate 7 — PASS (IT-150 registered in `suites.yaml` feature-complete + ui-e2e; protocol `IT-150-search-url-state.md` exists; no SUMMARY/IA change for a code item)
  - Gate 8 — **PENDING-RELEASE (1.0.0)** — the doc IS authored on the train: `git fetch` shows **PR #109 merged `docs/CTRIB-048-search-url-state` into `origin/release/1.0.0`** (`5b2bb04`), `61cd0a8` is on the train (the item's "push pending maintainer" record + DOC-495's `routing:` are now STALE — trust the tree, O4/O8/O9). Live-site verification scheduled at the 1.0.0 release gate. Post-merge URL: `https://docs.opendatadiscovery.org/features/data-discovery/search`; phrases to confirm post-publish: "shareable, bookmarkable `/search?q=`", "re-runs the same query for the recipient", "Legacy `/search/{uuid}` links still open"
  - Gate 9 — PASS (Consumer-read footer present + verified; every docs claim traces to verified code; no banned reviewer phrase used)
  - Gate 10 — N/A (a single-caveat prose rewrite, not embedded reference content)
  - Gate 11 — PASS (mechanical grep on `search.md` @ 61cd0a8 — the only hit is "governance **pillars**", operator vocabulary, not a workspace leak; ST-1a/CTRIB/D10 appear only in the commit message, never the published prose)
  - G-C2 — PASS (**my own independent rebuild** from `b37d06b9` → `odd-platform:odd-team-sut-revctrib048`; **feature-complete 332 passed / 1 failed**, the 1 = `favorites-star-see-loop:159` #1815 **Group-B**, the unmerged CTRIB-039 feature, search-independent + RED-on-base by its own design → **GREEN-FOR-CHANGE**; **known-bugs 3-RED-expected/0-unexpected-GREEN** = IT-004/006/007 exactly). multi-stack + ingestion-e2e = **reviewer-assessed FE-search-orthogonal skip** (the diff touches zero auth/MinIO/LDAP/notification/collector-ingestion surface — ctrib040/031/038 reviewer precedent; the implementer ran them: multi-stack PASS, ingestion-e2e 15/15)
  - G-C4 — PASS (live: PR #1833 `state:open, draft:True, merged:False`, base `main`, author `odd-contributor[bot]`, **no closing keyword** — GATE 2 human merge correctly pending)
  - G-C5 — PASS (6 source files, ST-1a-only; the W4 deferred consumers are named, not silently skipped)
  - G-C9 — PASS (BOTH buckets: vitest `searchUrlState` 5 + `useQueryParams` 4 trace to ADR D10; integration IT-150 + the changed IT-022/125/149)
  - G-C12/G-C13/G-C17/G-C18/G-C19 — PASS (front-loop verified against the diff: reuse-scan/ADR-check/impact/PO-SRE recorded; spec-gate 0.092; ST-1a/1b SPIDR Data-axis split of #1825; 2-round adversarial plan-check — **both BLOCKERs confirmed resolved in code**: B1 canonical `/search?q=` no-session-id, B2 PUSH-not-replace)
  - **G-C15 (changed-test integrity — the dangerous zone)** — PASS for all three changed helpers: IT-022 `catalog-search` (now waits `/search?q=` + a real `/results` GET — *tighter*), IT-149 `recently-viewed` (same mechanism), IT-125 recovery (`toHaveURL(/\/search$/)`). SoT = ADR D10 (not the system's current output); **RED-survives-on-base** confirmed by the implementer's per-IT logs (IT-022/125/150 PASS on the ctrib048 SUT, FAIL on `ctrib048base`) and by my own feature-complete (all three GREEN on my fix-build); no assertion weakened, no boundary mocked, nothing skipped/deleted
- **Outbound URL sweep**: docs train commit `61cd0a8` verified on `origin/release/1.0.0` via `git fetch`; PR #1833 + #109 verified via GitHub public API. No broken links introduced.
- **Banned-phrase check**: none used
- **Regressions**: none introduced — feature-complete green-for-change on the independent rebuild; the only failure is the search-independent unmerged Group-B favorites
- **Navigation**: consistent (FE-internal search-state refactor; no `navigation/domains/*.md` pointer shifts)
- **Upstream issues logged**: none
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: `data-discovery/**` search neighborhood (full `search.md` read on the train) + a tree-wide `/search/{`/session-share **drift grep** across `documentation/docs/**`. Other subtrees not exhaustively re-read this session — queued for the next `/review`.
  - **Findings**:
    - DOC-496 (low, parallel-surfaces-with-drift) — post-ST-1a, `data-discovery/search.md` teaches the DE catalog search as a shareable/recipient-scoped/durable `/search?q=` link while `data-glossary/business-glossary.md:56`-era caveat (`:38` on the train) still teaches the Dictionary/term search as a mutable `/termsearch/{uuid}` session-share. Both are currently accurate (ST-1a is DE-search-only); the divergence is a transitional reader-coherence risk. Source: `business-glossary.md:38` + `search.md` (train @ 61cd0a8).
    - Note (not logged — sub-threshold): `search.md` dropped the legacy-session "UUID not bound to a user / anonymous under DISABLED" caveat; the broad read-collaborative-posture caveat is preserved in the adjacent "Facet aggregators" section and the legacy path is now deprecated, so retention is optional.
- **Disposition**: **stays `review-ready`** (review ACCEPTED; the code PR #1833 is an **unmerged** draft — GATE 2 human-merge pending). Path to `done`: human approves+merges #1833 (GATE 2) → `/review release:1.0.0` runs the half-2 live-site verification of DOC-495's URL/phrases at the 1.0.0 release and owns the `pending-release → done` flip. (Precedent: review-ctrib039 kept an unmerged-PR contributor item at `review-ready`; only review-ctrib040, whose PR was already merged, went to `pending-release`.)
- **Notes**:
  - The change is genuinely well-built — the two plan-check BLOCKERs are not just claimed-fixed but verifiably fixed in the diff, the URL is the single source of truth (`MainSearchInput` the sole writer, `Search.tsx` URL-read-only), and back/forward re-execution works through the slice's page-reset. VERIFIED via diff-read of all 6 files @ b37d06b9 + IT-150 4/4 GREEN on my independent rebuild.
  - DOC-495's `routing:`/`docs_pr:` narrative ("push to release/1.0.0 pending the maintainer") is now STALE — the train carries `61cd0a8` via PR #109. Its `status: pending-release` is correct and unchanged. NOT VERIFIED as a blocker → noted for the implementer/maintainer; no item re-opened (DOC-495 already rides the 1.0.0 train correctly).
