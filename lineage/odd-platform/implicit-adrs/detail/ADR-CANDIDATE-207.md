## ADR-CANDIDATE-207 — `jotai` is the per-feature-store substrate when client state is feature-local; `redux` + `redux-thunk` remains the app-global store — the platform deliberately runs a TWO-store-system architecture, choosing per feature-area rather than enforcing one

**Severity**: HIGH
**Classification**: promote
**Support count**: 1 batch-ZC primary-source sidecar (`DataQualityStore`) + 4-feature-area cross-tree confirmation (26 `jotai`-importing files: OwnerAssociations + DEGLineage + DatasetStructure + DataQuality) + 1 byte-identical-Provider intent_anchor (`OwnerAssociationsAtomProvider` ↔ `DataQualityAtomProvider`)
**Axes present**: ui_jotai_stores, ui_components
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard | P-05 Data Lineage — DEGLineage canvas | P-08 Management — OwnerAssociations | P-01 Data Discovery — DatasetStructure compare/overview]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:implicit_adrs.[0]` (HIGH) — |-
    "The `/data-quality` feature manages its filter state with `jotai` atoms scoped by a feature-local `<Provider>`, deliberately diverging from the `redux` + `redux-thunk` store that the rest of `odd-platform-ui` uses — this is a consistently-applied per-feature-store convention, not a one-off."
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:implicit_adrs.[1]` (HIGH) — |-
    "The store scopes its atoms per-feature-mount: `DataQualityProvider.tsx` wraps the dashboard in a bare `jotai` `<Provider>` rather than letting the atoms use jotai's global default store — the decision makes the dashboard's filter selection feature-local and mount-lifetime-bound rather than application-global."
- `odd-platform__ts__react-component__component__DataQualityFilters.md:implicit_adrs.[0]` (HIGH) — strengthens the per-feature-mount scoping observation from the consumer side.
- `odd-platform__ts__react-component__component__DataQuality.md:implicit_adrs.[0]` (HIGH) — |-
    "Each entry-level route page that has its own scoped client state mounts a private jotai `Provider`, rather than sharing the app-global atom store."

**Decision statement**: `odd-platform-ui` runs **two coexisting client-state systems** by deliberate, consistently-applied choice — `redux` + `redux-thunk` (the app-global Toolkit store; ADR-CANDIDATE-084 / -085 / -087 / -097 describe its idioms) is the substrate for the SPA-session cache + cross-feature shared catalog state; **`jotai` + scoped `<Provider>` is the substrate for FEATURE-LOCAL UI state** — filter panels, transient form state, per-canvas view configuration that is meaningful only inside one route's mount lifetime. The choice is made per feature-area, not per call-site:

- **Feature areas using jotai** (4 areas, 26 files): `OwnerAssociations` (`Management/OwnerAssociations/OwnerAssociationsStore/`), `DEGLineage` (`DataEntityDetails/Lineage/DEGLineage/lib/atoms.ts` + `DEGLineageAtomProvider.tsx`), `DatasetStructure` (`DataEntityDetails/DatasetStructure/DatasetStructureOverview/lib/atoms.ts` + `DatasetStructureCompare/lib/atoms.ts`), `DataQuality` (`Pages/DataQuality/DataQualityStore.ts` + `DataQualityProvider.tsx`).
- **Everything else** (the bulk of `odd-platform-ui`) continues to use redux slices + `handleResponseAsyncThunk` per ADR-CANDIDATE-084 / -085 / -087 / -097.

The convention has TWO load-bearing properties the maintainer must preserve:

1. **Feature-local scope via a bare `<Provider>` wrapper.** Each feature exports a thin `*AtomProvider` component — `OwnerAssociationsAtomProvider` (`OwnerAssociationsProvider.tsx:1-8`) and `DataQualityAtomProvider` (`DataQualityProvider.tsx:1-6`) are BYTE-FOR-BYTE the same shape: `const X: React.FC<React.PropsWithChildren> = ({ children }) => <Provider>{children}</Provider>`. The Provider is mounted at the feature-root (`DataQuality.tsx:8` wraps both the filter sidebar and the content area; nothing outside the dashboard subtree sees those atoms). This scoping choice is the structural inversion of jotai's global default: leaving out the wrapper would make the atoms application-global like redux; introducing it is an explicit "this state lives and dies with this feature's mount" commitment.

2. **Source-of-truth atom + read-only derived atom + write-only setter atoms.** `DataQualityStore.ts` declares ONE source atom (`formFiltersAtom`, the operator-written state), ONE read-only DERIVED atom (`filtersAtom`, the API-request projection — `atom(get => ...)` with no write fn), and TWO write-only "clear" atoms (`clearTableFiltersAtom`, `clearTestFiltersAtom` — `atom(null, (get, set) => ...)`). This three-tier shape is the jotai-idiomatic equivalent of redux's `slice` + `selector` + `action creators`; the team applies it consistently per feature-area store.

The rejected alternatives are visible by absence:
- **(a) One redux slice per feature instead of jotai** — would force every per-mount transient (a half-typed filter, a per-canvas pan/zoom) to round-trip through global slice reducers; redux's wholesale-replace fulfilled-reducer pattern (per ADR-CANDIDATE-097) is poorly suited to "cleared on unmount" semantics.
- **(b) React Context + useReducer per feature** — would re-render every Context consumer on every state change (no atom-level subscription); jotai's per-atom subscription is more granular.
- **(c) Single global jotai store** — would surrender the per-mount-reset property the dashboard relies on (re-entering `/data-quality` starts with cleared filters). The deliberate `<Provider>` wrapper IS the rejection of this option.
- **(d) jotai everywhere, retire redux** — would require rewriting the SPA-session cache, `handleResponseAsyncThunk`, the entity-fan-out slices (ADR-CANDIDATE-085), and the page-component-owns-fetch lifecycle (ADR-CANDIDATE-087). The team's choice is to ADD jotai for the right shape of state, NOT to migrate.

The intent is not stated in any comment but is anchored by the **byte-for-byte cross-feature copy of the `*AtomProvider` wrapper**: when four independent feature areas wrap their atoms in the same trivial `<Provider>{children}</Provider>` component with the same naming convention, that is a convention applied verbatim, not four independent accidents.

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — the convention is anchored by (a) the byte-identical `*AtomProvider` component shape across 4 feature areas; (b) the consistent three-tier atom shape (source + derived + setter) per store; (c) the deliberate Provider wrapper rejecting jotai's global-default. No file states it in prose, but the cross-feature repetition IS the statement — a copied verbatim convention applied to 26 files is a maintainer choice, not accident.
2. *Structural impact?* YES — defines (a) WHICH state lives where (the line between app-global redux and feature-local jotai); (b) the per-mount-reset contract for feature-local state; (c) the choice of subscription primitive (per-atom for jotai, per-slice-selector for redux) and the resulting re-render footprint; (d) the dependency graph (`jotai` is a real package in `package.json:71` — adding it was a structural decision that the redux-everything alternative would have avoided).
3. *Refactoring or structural?* STRUCTURAL — collapsing the two-store-system into one (either direction) would change the storage shape, the subscription model, the mount-lifetime semantics, and the migration would touch every per-feature store + every consumer. It is not a within-existing-structure refactor.
→ ADR.

**Evidence**:
- `DataQualityStore.ts:1` (`import { atom } from 'jotai'`) + `DataQualityProvider.tsx:1-7` (`<Provider>{children}</Provider>` thin re-export)
- `OwnerAssociationsProvider.tsx:1-8` (byte-identical wrapper shape — the intent_anchor for "convention, not one-off")
- `DEGLineage/lib/atoms.ts` + `DEGLineageAtomProvider.tsx` (feature area 3)
- `DatasetStructureOverview/lib/atoms.ts` + `DatasetStructureCompare/lib/atoms.ts` (feature area 4)
- Grep `from 'jotai'` across `odd-platform-ui/src` returns 26 files across exactly these 4 feature areas (DataQualityStore.md sources [implicit_adrs.[0]] confirms the count)
- `DataQuality.tsx:8` (the feature-root Provider mount) + `DataQuality.tsx:13-15` (children inside the Provider) — confirms feature-root scoping
- `package.json:71` (`jotai ^2.3.1`) — the dependency was deliberately added; coexists with `@reduxjs/toolkit`

**Existing ADR**: contrasts with:
- **ADR-CANDIDATE-084** (`handleResponseAsyncThunk` — redux thunk wrapper) — the redux side of the two-store-system.
- **ADR-CANDIDATE-085** (entity fan-out across normalised redux slices) — redux is for cross-feature shared data; jotai is for feature-local UI state. The split IS the boundary this ADR codifies.
- **ADR-CANDIDATE-087** (page-component owns data-fetch lifecycle via `useEffect + dispatch(thunk)`) — that pattern is redux-specific; the jotai feature areas use either `useAtom`-driven hooks (the dashboard filters) or react-query hooks (`useGetDataQualityDashboard` is react-query, not jotai, but the filter state that DRIVES the fetch is jotai). The two-store-system extends the per-feature-area choice to "which state primitive owns the URL-derived filter shape vs the page lifecycle."
- **ADR-CANDIDATE-097** (one-shot mount fetch + redux slice as SPA-session cache) — the redux slice's wholesale-replace fulfilled reducer is poorly suited to per-mount-reset state; the jotai per-feature `<Provider>` IS the answer for the cases where per-mount reset is what you want. This ADR explains the negative space ADR-097 leaves: what to do when "one-shot mount fetch, cached forever" is wrong.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-595** (NEW — per-mount jotai-Provider reset loses the operator's filter slice on navigate-away; URL deep-link is the only persistence channel; behaviour is the deliberate consequence of THIS ADR but the operator-facing UX gap remains a scope)
- **REFACTOR-606** (NEW — `useFilter` subscribes to the WHOLE `formFiltersAtom` even though `DataQualityStore.ts:24-30` ships an unused `getFieldFilterAtom` focused-atom factory; the jotai convention provides the right tool, the feature does not use it — refactoring scope within this ADR's pattern)
- **REFACTOR-599** (NEW — no debounce / no Apply gate between filter selection and dashboard re-query; jotai's synchronous derived-atom propagation MAKES every chip toggle a refetch — the immediate-propagation is correct under this ADR; an "Apply" button would be the structural addition; refactoring scope)

**Proposed action**: Promote to `adrs/drafts/two-store-system-redux-and-jotai.md`. Document:

- The **boundary**: when to put state in redux vs jotai. Cite the four jotai feature areas as the canonical examples; cite the redux fan-out (ADR-CANDIDATE-085) as the canonical app-global counter-example.
- The **per-feature `*AtomProvider` convention**: every jotai feature exports a thin Provider wrapper at the feature root; the byte-identical shape across 4 areas IS the convention.
- The **three-tier atom shape**: source atom + read-only derived atom (`atom(get => ...)`) + write-only setter atom (`atom(null, (get, set) => ...)`); the dashboard's `formFiltersAtom` / `filtersAtom` / `clear*FiltersAtom` is the worked example.
- The **per-mount-reset contract**: feature-local state is intentionally lost on route unmount; URL search-params are the persistence channel when the feature needs it (forward-link to ADR-CANDIDATE-091 — URL as source of truth for view state).
- The **four rejected alternatives** with one-sentence rationale each.
- The **migration boundary** for new features: a default rule like "if this state is meaningful only inside one route's mount lifetime → jotai per-feature; if it is shared across routes or needs SPA-session cache semantics → redux slice."
- The cross-references to ADR-CANDIDATE-084 / -085 / -087 / -091 / -097.

**Severity rationale**: HIGH — load-bearing architectural decision. A future maintainer encountering "where does this new feature's transient state go" cannot make a compatible choice without this ADR; without it the two-store-system reads as inconsistency (4 features in jotai, ~30 in redux), and an over-eager "let's unify" PR could destroy either the per-mount-reset property (if jotai → redux) or the SPA-session cache (if redux → jotai). Pillar-spanning: affects P-04 (Quality Dashboard), P-05 (DEGLineage canvas), P-08 (OwnerAssociations Management), P-01 (DatasetStructure compare/overview) — four pillars share this convention.

**Suggested ADR-draft slug**: `adrs/drafts/two-store-system-redux-and-jotai.md`.

---
