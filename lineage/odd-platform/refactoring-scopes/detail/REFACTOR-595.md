## REFACTOR-595 — Navigating away from `/data-quality` resets ALL ten dashboard filters; the per-mount jotai `<Provider>` destroys `formFiltersAtom` on route unmount, and only URL search-params (a partial channel) persist — operator-loss of carefully-built filter slice with no warning

**Severity**: MEDIUM
**Category**: ux-bug / per-mount-reset-lossy
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — |-
    "The filter selection does not survive navigating away from `/data-quality` and back: the route mounts `<DataQuality>` via a single non-wildcard `<Route path={dataQualityPath()} element={<DataQuality />} />` (App.tsx:73), React Router unmounts the `element` on navigation away, that destroys `<DataQualityAtomProvider>` and its `jotai` `<Provider>`, and the next mount starts a fresh store at the all-empty `formFiltersAtom` default — the operator loses their filter slice with no warning. (The URL search params written by `DataQualityFilters`' second `useEffect` are the only persistence channel; whether they fully reconstruct state on remount is a sibling-component behaviour — see references.)"
- Probe `P-120` (`lineage/odd-platform/probes/P-120.yaml`) — pins whether the URL round-trip fully reconstructs the filter selection on remount.

**Description**: The `/data-quality` route is mounted as a single non-wildcard React Router route (`App.tsx:73`). React Router v6 unmounts the route's `element` when the user navigates away to any non-matching path. The dashboard's `<DataQualityAtomProvider>` (`DataQualityProvider.tsx:4-6`) wraps the entire dashboard subtree in a fresh jotai `<Provider>`; when the Provider unmounts, the `formFiltersAtom` (and the derived `filtersAtom`, the two clear atoms) are destroyed. On the next mount of `/data-quality`, a fresh Provider creates a fresh atom store seeded with the all-empty defaults at `DataQualityStore.ts:11-22` (10 keys, each `[]`).

The only persistence channel is the URL search-params round-trip implemented in `DataQualityFilters.tsx:28-54`: a mount-time `useEffect` hydrates `formFiltersAtom` from `searchParams`; a change-time `useEffect` writes `formFiltersAtom` back to the query string with `replace: true`. This URL channel partially mitigates the loss IF (a) the operator triggers the navigation via a method that PRESERVES the query string (a forward navigation in the same tab back to `/data-quality` via the back button DOES restore the URL; clicking the "Data Quality" tab from another page does NOT — that fires `navigate('/data-quality')` with NO query string and lands on the all-empty default). The probe `P-120` is needed to pin exactly which navigation methods preserve filters.

The operator-visible UX consequence: a data-quality engineer who carefully builds a multi-chip filter slice (e.g. namespace=A + datasource=B + tag=C + title=Steward across both sides — 4-8 chips of work), then clicks into a DataEntity link from the dashboard to investigate one failing dataset, then clicks the "Data Quality" tab to return to the dashboard, lands on the EMPTY dashboard and has to rebuild every chip. No warning, no "restore filters?" affordance, no breadcrumb back. The behaviour is the DELIBERATE consequence of the ADR-CANDIDATE-207 per-feature-store + ADR-CANDIDATE-091 URL-source-of-truth combination — but it produces a user-loss surface neither ADR's design comment surfaces.

**Wisdom-test classification**: GAP. (1) Intentional? The per-mount reset IS intentional under ADR-CANDIDATE-207's jotai-scoped-Provider pattern; the URL persistence IS intentional under ADR-CANDIDATE-091. The UX HOLE between the two — that the URL round-trip is partial, that "click the tab" navigation drops the query string — is NOT intentional; it is the unintended consequence of two locally-correct decisions. (2) Structural impact? NO — the fix is one of several local options (route-mount option, restore-from-localStorage helper, "restore filters" toast, navigate-via-tab carries the search-params). (3) Refactoring or structural? REFACTORING — pick a UX mitigation; no architectural change required.

**Primary source citations**:
- `DataQualityStore.ts:11-22` (the all-empty default the fresh Provider seeds with)
- `DataQualityProvider.tsx:4-6` (the per-mount Provider whose unmount destroys the atoms)
- `App.tsx:73` (the single non-wildcard `/data-quality` Route)
- `DataQualityFilters.tsx:28-54` (the URL round-trip; the partial persistence channel)
- `ToolbarTabs.tsx:45-49` (the "Data Quality" tab — the navigation that DOES NOT carry filter query-strings)
- Probe `P-120`

**Existing-ADR-or-implied-prescription**: composes with ADR-CANDIDATE-207 (NEW batch ZC — jotai per-feature-store with per-mount reset) and ADR-CANDIDATE-091 (URL as source of truth for view state). Both ADRs ENABLE this pattern; neither addresses the partial-persistence gap. The gap is precisely in the seam between the two — a maintainer wanting to fix this scope must respect both ADRs' constraints.

**Proposed remedy**: Three options, smallest first.

1. **Smallest — make the "Data Quality" toolbar tab preserve the query string when the tab click happens FROM the dashboard.** The tab click fires `navigate('/data-quality')` unconditionally; change it to carry the current search-params if the operator is already on `/data-quality`. This addresses the "I clicked into a dataset and clicked the tab to go back" loss path. Implementation: `ToolbarTabs.tsx:47-49` + the surrounding `handleTabClick` (lines 107-126). One-line conditional.
2. **Medium — restore-from-sessionStorage on Provider mount.** Mirror `formFiltersAtom` into `sessionStorage` (per-tab) on every change, restore on mount when no `searchParams` are present. Preserves filters across "click into a dataset" → "click back" sessions even without URL preservation. Adds a small storage primitive.
3. **Larger — surface a "Restore filters?" toast** when the operator opens `/data-quality` from a non-dashboard route AND the last-known filter set in sessionStorage is non-empty. Gives the operator the choice; preserves the deliberate fresh-start default.

Option 1 is sufficient for the most common loss path and is the smallest viable mitigation. Document the decision in the dashboard doc (the live page is silent on persistence — see REFACTOR-617).

**Severity rationale**: MEDIUM — operator-time-loss UX bug, not a correctness bug. The dashboard correctly reflects the filters that ARE applied; the loss is purely the burden of rebuilding the chip selection. The severity is MEDIUM rather than LOW because the chip-rebuilding cost compounds with REFACTOR-597 (no autocomplete debounce — every keystroke fires a list API) and REFACTOR-599 (every chip toggle fires a dashboard refetch); the operator pays N list-API requests + N dashboard refetches to rebuild what they lost.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint`. Triage Option 1 first (smallest); fold Option 2 / 3 into a separate UX-polish pass if needed.

---
