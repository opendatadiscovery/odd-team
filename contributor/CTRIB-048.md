---
id: CTRIB-048
title: "ST-1 — Parametrised-URL search state (shareable & bookmarkable; retire session-id-as-share-handle)"
issue: "ST-1 sub-issue of #1825 (being created by the maintainer; milestone 1.0.0)"
parent_epic: 1825
class: feature
status: planned                # → plan-approved after GATE 1 (G-C3)
target_repo: odd-platform
milestone: "1.0.0"
adr: "adrs/drafts/unified-asset-search.md (rev 3 — D10 param-URL, D9 no-break) [maintainer-approved direction]"
adr_required: false            # G-C7 does NOT fire: additive, no migration / no auth-posture / no wire-contract break (D9). Covered by the approved ADR D10.
reproduced: "n/a (feature). Current behaviour VERIFIED in-tree: /search POSTs a mutable search_facets session → navigates to /search/{searchId}; filters→redux→PUT; the URL carries ONLY searchId; expired sessions = the IT-125/#1760 dead-link."
plan_approved_by: ""
plan_approved_at: ""
docs_routing: "release/1.0.0 train (unreleased behaviour — the shareable param-URL) + a paired DOC item"
effort: large                  # a core FE search-state refactor — held to reliable+stable
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
- **Integration IT (odd-team, extend IT-022/IT-125):** (a) apply filters+query → the URL reflects them; (b) open that
  URL fresh (new context) → the **same search renders** (the share/bookmark proof); (c) **back/forward** navigate search
  states; (d) a legacy `/search/{sessionId}` deep-link **still loads** (D9). RED on `ref:main`, GREEN on the working-tree SUT.
- **DoD:** full unit build + the FULL integration regression on the working-tree SUT (feature-complete green — search is
  driven by many specs; multi-stack green; known-bugs still-RED; ingestion-e2e green) + docs read+routed + ontology refreshed.

## Docs (G-C10 + G-C11)
The search page gains "share/bookmark a search via its URL" — **release/1.0.0 train** (unreleased behaviour) + a paired
backlog DOC item. Read the live page at DoD before authoring.

## Status
intake (ST-1 sub-issue pending the maintainer's creation; milestone 1.0.0) → current-behaviour verified → design-before-build done
→ **planned → awaiting GATE 1** (G-C3: human approves before any code).
