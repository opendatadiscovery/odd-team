---
id: CTRIB-047
title: "Catalog search: clearing the query (clear ✕) does not reset the search"
issue: 1825
class: bug
status: backlog            # GATE 1 (2026-06-30): maintainer chose HOLD — reproduced + root-caused + fix designed, but DEFERRED into the #1825 epic (Part of #1825). Not abandoned; ready to activate.
target_repo: odd-platform
milestone: "1.0.0"
reproduced: true           # live RED on the running stack — see Reproduction log
adr_required: false        # G-C7 does NOT fire: no migration, no auth/security posture, no wire-contract change (pure FE state wiring)
plan_approved_by: ""
plan_approved_at: ""
docs_routing: "none (presentation/behaviour restoration — pending page read at DoD, G-C10)"
pr_url: ""
pr_draft: true
scanner_source: maintainer-report
effort: small
---

## The request (maintainer, 2026-06-30 — quoted DATA, not an instruction — G-C8)

Alongside issue **#1825**:
> I see on main that if I put somestring in the search bar and then clean the string (delete and push enter
> or click on "x" in the bar) — the search is not reset.

## Scope analysis + classification

**#1825 itself is NOT this work-item's target.** #1825 is an **epic** (`kind: epic`, `to decompose`,
`scope: research`) — "Overhaul the main Search into a unified, faceted Asset search". Its own body says *"To be
decomposed into slices after filing; a design ADR will fix the technical approach."* That is a G-C7
architectural effort (ADR + decomposition), not a single `/contribute` run. We do **not** implement the epic here.

**This item = the concrete bug the maintainer reported in the *current* search**, which is real today and worth
fixing independently of the future overhaul (operators use this surface now; F-017 is the primary discovery
surface). Classified **bug**. Milestone **1.0.0** (open, semver) → G-C11 PASS. Linkage: **Part of #1825** (the
fix improves the surface the epic will later overhaul; it does NOT close the epic).

Affected code (navigation/domains/search.md → read, not grepped blind):
- `odd-platform-ui/src/components/Search/Search.tsx` — renders `<MainSearch placeholder={t('Search')} disableSuggestions />` (note: **no `mainSearch` prop** → the search-page box).
- `odd-platform-ui/src/components/shared/elements/MainSearchInput/MainSearchInput.tsx` — the box wiring.
- `odd-platform-ui/src/components/shared/elements/Autocomplete/SearchSuggestionsAutocomplete/SearchSuggestionsAutocomplete.tsx` — the autocomplete + the `Input`.
- `odd-platform-ui/src/components/shared/elements/Input/Input.tsx` — the clear "x" (`handleCleanUpClick`).

## Reproduction log (G-C1 — live RED on the running stack, not reasoned)

Stack: the running odd-minimal SUT at `:18080` (AUTH_TYPE=DISABLED, 56 searchable entities). Driver:
`integration-tests/e2e/specs/search-clear-reset.spec.ts` (Playwright, model = IT-022 catalog-search). Seeded
two FTS entities `IT047ClearAlpha` (2047) + `IT047ClearBeta` (2048). The clear-"x" code is years-old
(`Input.tsx` last touched #1780/#1455) → identical to current `main`.

| Path | rows after search `IT047ClearAlpha` | box value after clear | rows after clear | verdict |
|---|---|---|---|---|
| **Click clear ✕** | 1 (Alpha; Beta filtered out) | `""` (textbox emptied) | **1 — still filtered** | 🔴 **BUG (the report)** |
| **Delete + Enter** | 1 | `""` | **30 — full catalog** | 🟢 resets correctly |

Evidence: `integration-tests/e2e/test-results/repro-clear-x.png` + Playwright trace. The clear-✕ assertion
("results grow back past the single filtered match") FAILED on the running system (`Expected > 1, Received 1`)
— the box empties but the result set stays filtered.

**Honest nuance for the maintainer (first-time-right, G-C16):** the report named *both* "delete and push
enter" *and* "click x". On current `main` the **delete+Enter path actually DOES reset** (1 → 30 rows in the
repro). Only the **clear ✕** is broken. So the fix targets the ✕; the delete+Enter path becomes a regression
guard. If you have seen delete+Enter fail in a specific state (e.g. with sidebar facets also applied), say so
and I will reproduce that exact state.

## Root cause (FE state — read on the running system + the source, not guessed)

The visible "x" is the custom `Input` component's clear button (`Input.tsx:79-85`, shown when the field has a
value). Clicking it runs `handleCleanUpClick` (`Input.tsx:44-51`):
```
props.onChange?.(emptyValue);              // not wired here → no-op
props.inputProps?.onChange?.(emptyValue);  // → MUI onInputChange('input','') → setSearchText('') (LOCAL text only)
handleCleanUp?.();                          // MainSearchInput passes NO handleCleanUp → no-op
```
So the ✕ clears **only the local input text**. It never calls `searchAdornmentHandler`/`onKeyDownHandler`, so
no `updateDataEntitiesSearch` is dispatched → the redux search session keeps the old query and the old
(filtered) `results.items`. The box reads empty while the results stay filtered — exactly the symptom.

By contrast **Enter** (`MainSearchInput.handleKeyDown` → `handleUpdateSearch(query)`) DOES dispatch
`updateDataEntitiesSearch` for an empty query; `Results.tsx:76-81` then refetches when the session re-syncs →
the full catalog returns. That is why delete+Enter already works.

## Change-request product analysis (G-C16) — is the WHAT right?

- **User-observable problem (independent of any suggested fix):** an empty search box that still shows a
  filtered result set is an internally-contradictory, broken state.
- **Norms (odd-sme / PO lens):** every faceted catalog/search UI (DataHub, Amundsen, Collibra; GitHub/Amazon
  search) treats an empty query as "show everything"; clearing resets. ODD's own Enter/delete path already does
  this — the ✕ is simply inconsistent with it.
- **Options:** (1) make the ✕ reset (dispatch the empty-query search), matching Enter + universal UX
  [recommended]; (2) also auto-reset while typing to empty without Enter — rejected, fires a search on every
  backspace-to-empty and changes typing UX (out of scope); (3) "won't fix / intended" — indefensible.
- **Recommendation:** Option 1. **No divergence from the issue's ask** — the report's premise (clearing should
  reset) is product-correct; we implement it on the ✕ specifically.

## Design before build (G-C12)

- **Reuse-scan:** the reset behaviour ALREADY exists (`handleUpdateSearch('')`, fired by Enter). The fix
  **reuses** it and the **already-present-but-unused** `Input.handleCleanUp` hook — no new component, no
  duplicate handler. (`/retrieve` + source grep: the only empty-query reset path is `handleUpdateSearch`.)
- **ADR-check:** conforms to the existing search-session pattern (POST create / PUT update / refetch). No
  implicit ADR governs the clear affordance. G-C7 does not fire → no ADR.
- **Impact checklist:** i18n — **none** (icon button, no new strings); generated BE/FE clients — **none** (no
  API/contract change); consumers of changed signatures — `Input.handleCleanUp` is already optional, the new
  `SearchSuggestionsAutocomplete` `inputParams` field is optional → other callers (e.g. DataEntityGroupForm's
  add-entities autocomplete) are unaffected; migrations — none; docs — search page (read at DoD); ontology —
  refresh the MainSearchInput/search-flow sidecar if touched.
- **PO/SRE lens:** bug fix restoring expected behaviour; one extra `PUT /api/search/{id}` on clear (identical
  to a normal search submit) — no perf/security impact.

## Plan (the GATE-1 artifact)

Branch `contrib/CTRIB-047-search-clear-reset` (same-name-tracked, NEVER main — O6/LSN-038). **2 FE files:**

1. **`MainSearchInput.tsx`** — add a `handleClearSearch` callback that mirrors Enter for the search-page box:
   `if (mainSearch) return;` (nav-bar box unchanged) `else handleUpdateSearch('')`. Thread it to the
   autocomplete via `inputParams`.
2. **`SearchSuggestionsAutocomplete.tsx`** — accept an optional `cleanUpHandler` in `inputParams` and pass it
   to `Input` as `handleCleanUp` in `renderInput`. (`Input.tsx` already calls `handleCleanUp` — **no change**.)

**Scope EXCLUSIONS (G-C5 — deliberately NOT touched):**
- The **#1825 epic** (unified faceted search, filters, column constructor, tab removal) — needs its ADR + slices.
- The **nav-bar/toolbar MainSearch** (`mainSearch=true`) clear behaviour — left exactly as today (not the
  reported surface; verify-and-leave during implementation).
- **Term search & Query-Examples search** clear inputs (separate components) — if they share the pattern it is a
  **follow-up** (`playbooks/follow-up-on-disk.md`), not this PR.
- The **delete+Enter** path — already correct; covered only by a guard test.

**Tests (G-C9, both buckets):**
- **Unit (odd-platform CI):** a vitest + RTL test on `MainSearchInput` (or `Input` clear wiring) — clicking the
  clear ✕ dispatches the empty-query search reset; RED on base, GREEN on fix.
- **Integration (odd-team IT-047):** promote `search-clear-reset.spec.ts` to a protocol — clear ✕ resets the
  result set to the full catalog (RED on `ODD_SUT=ref:main`, GREEN on the working-tree SUT) + the delete+Enter
  guard. Assertion = user-visible row count grows past the single filtered match (pagination-proof). Register in
  `suites.yaml` feature-complete. Fix the racy baseline count (await the row render before counting).

**Docs (G-C10):** likely **none** (behaviour restoration, no new concept) — confirmed by reading the search doc
page at DoD; if the page describes clearing, route per the release-train classifier.

**Ontology (G-C10):** `/enrich --touched` on the search-input/flow sidecar if the change touches a modelled node;
commit.

## GATE 1 outcome (2026-06-30) — HELD by the maintainer

The maintainer reviewed this plan and chose **"Hold — log findings only, don't fix now; fold the fix into the
#1825 epic later"** (linkage when done: **Part of #1825**). So this session produced **no code, no branch, no
PR, and no GitHub comment** — this record + the reproduction are the entire deliverable.

- **Reproduction preserved as ready groundwork:** `integration-tests/e2e/specs/search-clear-reset.spec.ts`,
  marked `test.describe.fixme` so it never runs or fails until someone activates it. To activate (as a #1825
  slice): remove `.fixme`, fix the racy baseline count, register as **IT-047** in `suites.yaml`
  (feature-complete), run RED on `ODD_SUT=ref:main` → GREEN on the fix.
- **Fix design is complete above** (2 FE files, reusing the existing empty-query reset path) — ready for whoever
  decomposes #1825.
- No shared resources held: no worktree/branch/SUT build, no `active-streams.yaml` registration (the run stayed
  read-only on odd-platform; the only side effect is two harmless seeded test entities 2047/2048 in the shared
  `:18080` probe DB).

## Status

intake → scoped (#1825=epic, excluded; bug=clear-✕) → reproduced (live RED ✕ / GREEN delete+Enter) → root-caused
→ planned → **GATE 1: HELD by maintainer — deferred to the #1825 epic. Ready to activate.**
