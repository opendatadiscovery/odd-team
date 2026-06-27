# Filter dataset Structure columns: live tag-add reactivity + label the filter chips (#1679)

Part of #1679.
Milestone: 1.0.0.

> **Stacked on the #1679 column-filter feature.** Base this PR on
> `contrib/CTRIB-038-dataset-structure-tag-filter` (the filter lives only there, not on `main` yet).
> GitHub auto-retargets it to `main` when that PR merges. Merge the filter PR first, then this one.

## What & why

Two UX defects on the #1679 Structure-tab tag/type column filter, found by a maintainer using the
running UI:

1. **Reactivity** — after adding a tag to a column via the per-column **Tags** editor, the new tag did
   not appear in the header filter-chip list until a full page reload.
2. **Discoverability** — the tag chips and the (clickable) type chips carried no label, so it was not
   obvious they filter the column list.

## How (pure client-side — no backend)

**Defect 1.** `DatasetStructureOverviewProvider` hydrated the Jotai `datasetStructureRootAtom` **once**
(`useHydrateAtoms`). A column tag-write updates redux (`fieldById`) and the per-column tag display — which
reads redux live — reflected it, but the filter chips (and the column list), which derive from that **atom
snapshot**, stayed frozen until a remount. A new `SyncAtoms` component re-syncs the **server-data** atoms
(structure root + counts/types/versions) from the redux source on change, while deliberately leaving the
**user-interaction** atoms (search query, selected tag/type filters, selected field) untouched — so an
active filter/search survives the refresh.

**Defect 2.** Added `Filter by type` / `Filter by tag` hint labels (the same `texts.hint` style as the
existing "columns" label) before the respective chip rows. Two new strings, translated across all 7
locales.

No backend, API, OpenAPI, contract, or migration change.

## Scope (deliberately not touched)

- No backend / server-side filtering; no change to the tag **write** path or the per-column editors.
- No wholesale state-management refactor — bounded to the Structure-view Provider's hydration gap.
- No change to the #1679 filter semantics (OR-within / AND-across, Clear-All, reset-on-revision).

## Tests & verification

- **Unit (vitest):** `SyncAtoms.test.tsx` — the available tag set re-syncs when a column gains a tag
  **without a remount** (RED on the pre-fix base: the once-hydrated atom stays frozen), and an active tag
  filter survives the re-sync. `filtering.test.ts` (the filter feature) still 14/14. `tsc` + `eslint` clean.
- **Integration (Playwright, odd-team IT-147):** seeds a dataset, **adds a tag through the UI editor**, and
  asserts the new chip appears in the header filter **without a reload** + the `Filter by tag/type` labels
  render. **GREEN** on this branch; **RED** on the pre-fix base (`ref:c37ca11b`): the labels don't exist and
  the chip never appears without a reload.
- The full **feature-complete** suite is GREEN-for-change on the branch SUT (the rest of the UI, incl. the
  filter feature, unaffected); **known-bugs** stays RED-as-expected.

## Docs & ontology

- **Docs:** folded into the #1679 filter's documentation note (rides the **1.0.0 release train**) — the two
  chip rows are labelled and the filter reflects an in-page tag-add immediately.
- **Ontology:** no change — a client-side presentation fix that adds no backend concept/operation.
