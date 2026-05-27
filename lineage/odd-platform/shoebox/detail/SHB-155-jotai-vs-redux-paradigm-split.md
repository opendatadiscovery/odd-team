# SHB-155 — Two state-management paradigms coexist (Redux + jotai); per-feature stores reset on navigate-away with no operator warning

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Four feature areas (`/data-quality`, OwnerAssociations, DEGLineage, DatasetStructure) use jotai atoms scoped via per-feature `<Provider>` wrappers; the rest of `odd-platform-ui` uses Redux + Redux Toolkit. The convention is deliberate (per LSN-class evidence — same byte-identical Provider shape across 4 areas, ~26 files importing jotai), but operators see a UX asymmetry: a Redux store is global so filter state survives navigation, while a per-Provider jotai store gets a fresh all-empty state on every route remount. Specifically, the Data Quality Dashboard's 10 filter selections evaporate the moment an operator navigates away and back — only the URL search params (written by `DataQualityFilters`' useEffect) survive, and only partially.

## Evidence

- `odd-platform-ui/src/components/DataQuality/DataQualityProvider.tsx:4-6` — `<Provider>{children}</Provider>` (the per-feature jotai Provider).
- `odd-platform-ui/src/components/DataQuality/DataQuality.tsx:8-17` — the Provider wraps both `<DataQualityFilters>` and `<DataQualityContent>` and NOTHING ELSE.
- `odd-platform-ui/src/components/App.tsx:39, 73` — `/data-quality` is a single non-wildcard `<Route element={<DataQuality />} />`; navigating away unmounts the element, destroys the Provider, the next mount starts a fresh store at the all-empty `formFiltersAtom` default.
- `odd-platform-ui/src/components/DataQuality/DataQualityStore.ts:11-22` — all 10 filter keys default to `[]`.
- (Cross-ref OwnerAssociations / DEGLineage / DatasetStructure folders — same shape; LSN-023 / DataQualityStore sidecar.)

## Notes

- The intent is "this store is feature-local, not application-global" — but the operator-observable consequence is "filters are forgotten the moment I leave the page", which most operators won't expect.
- The URL search params write IS the cross-mount persistence channel (per `DataQualityFilters.tsx:46-54` second useEffect), but whether they fully reconstruct state on remount is the still-open P-120 probe; if they don't, the partial reconstruction is its own surprise.
- Hard tradeoff: making the filter state Redux-global would solve the navigate-away problem but pollute the global store with feature-local concerns; making the URL the canonical source of truth (instead of the atom) would solve it correctly.
- The two-paradigm coexistence is an implicit-ADR candidate (intentional, not accidental).
- DataQuality is the canonical instance; the same shape applies to DEGLineage, DatasetStructure-compare, OwnerAssociations. Worth a cross-area dedupe pass.

## Next

1. Wait on probe P-120 (DataQualityStore sidecar) to confirm whether URL search params fully reconstruct atom state on remount.
2. File a doc-gap: `docs.opendatadiscovery.org/features/data-quality/dashboard` does not warn about filter reset on navigate-away.
3. Decide: implicit-ADR candidate for finding-implicit-adrs reducer? "Per-feature jotai stores deliberately scoped to mount lifetime" — yes, write-up.
4. Promote to F-NNN if the cross-area dedupe confirms 4+ feature areas share the shape: "Feature-Local State Persistence (jotai vs Redux paradigm split)".

## Links

- cluster_with: [F-032]
- merged_into: F-104
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — minted F-104 at lineage/odd-platform/feature-flows/detail/F-104.yaml (P-08:F-014 Feature-Local State Persistence). Evidence list spans 5 file:line refs across 3 substrate axes (UI provider wrapper, atom store, route-mount, URL serialisation effect). Hypothesis is falsifiable (4 byte-identical Provider files); product surface is clear (operator-visible filter reset on navigate-away across 4 named feature areas). status: ui-incomplete because P-120 has not yet measured URL-search-param reconstruction extent.
