# Filter dataset Structure columns by tag and by type (#1679)

Closes #1679.
Milestone: 1.0.0

## What & why

On a wide dataset the **Structure** tab gives no way to narrow the column list along a *meaning* axis — the
reporter (a catalog user) asked to "see tags listed at the top that are present within that dataset that can
be clicked on to filter down the number of columns … could be same for the data types which are already
shown", and noted today they "extract all the data and do these checks outside ODD." This adds that filter.

On the Structure tab header:
- **Tag chips** — every tag present across the dataset's columns renders as a chip with a count of how many
  columns carry it (important tags first). Click to show only columns with that tag; multi-select is OR within
  the tag facet.
- **Type chips** — the existing data-type count chips (`128 Str`, `12 Dec`, …) become clickable filters (the
  "same for the data types" ask).
- Facets combine with each other and with the existing name **Search** (AND across facets); **Clear All**
  resets; switching schema revision resets the filters.

## How (pure client-side — no backend)

`DataSetField.tags` is already in the `GET /api/datasets/{id}/structure` payload, so this is a client-side
filter over data the page already holds — **no API, contract, DB, or migration change**. It reuses the shared
`TagItem` chip (the same one the catalog Overview's `TopTagsList` uses for one-click tag filtering) and extends
the Structure view's existing client-side search filter (`useStructure`); two Jotai filter atoms hold the
selection. The tag-aggregation + filter predicate live in a pure `lib/filtering.ts` (unit-tested). `TagItem`
gains an additive optional `selected` prop (no existing caller affected).

## Scope (deliberately not touched)

- No backend / `openapi.yaml` / DB / server-side filtering.
- No change to the per-column tag **write** path (`PUT /api/datasetfields/{id}/tags`) — this is read-only over
  tags.
- No nested-struct sub-field filtering (parity with the existing top-level name search; deferred).
- No cross-navigation/URL persistence of the filter (reset-on-revision is included).

## Tests & verification

- **Unit (vitest):** `lib/filtering.test.ts` — 14/14 green (tag aggregation + counts + ordering; single/multi
  tag OR; type; tag×type and tag×search AND; empty-result; identity; no-mutation). Project `tsc --noEmit` +
  `eslint` clean.
- **Integration (Playwright, odd-team IT-146):** seeds a dataset with tagged columns via the real
  stats-ingestion path, drives the Structure tab, asserts the tag chips render with counts, a tag click filters
  the column list, a type click filters by type, and Clear-All resets. **GREEN** on the working-tree SUT
  (built from this branch). The full **feature-complete** suite is **GREEN** on the same SUT (the rest of the
  UI, incl. every other consumer of the shared `TagItem`, is unaffected), and the **known-bugs** quarantine
  stays RED-as-expected.
- **RED on `main` by construction** — `main` has no tag-filter component, no filter state, and no test hooks,
  so the test's locators match nothing and it cannot pass there; it passes only on this branch.

## Docs & ontology

- **Docs:** a "Filtering the column list" section for `data-discovery/per-column-annotation.md` rides the
  documentation **1.0.0 release train** and publishes with 1.0.0 (it documents unreleased behaviour).
- **Ontology:** no change — this is a client-side presentation filter that adds no backend concept/operation.

## Docs publication

Docs: documentation@release/1.0.0 (drafted, lands when the 1.0.0 train is cut) — publishes with the 1.0.0
release. No live-manual change before then.
