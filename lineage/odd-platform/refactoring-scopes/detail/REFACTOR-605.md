## REFACTOR-605 — Quality Dashboard low-severity polish cluster (10 facets) — locale-dependent ordering, dead `!data` guards, unused `getFieldFilterAtom`, missing i18n, negative-count display, no `staleTime`, `toSorted` outside `useMemo`, `capitalizeFirstLetter` empty-string crash, present-only flatMap silent drop, swappable `filterKey` props — none individually blocking, collectively a code-hygiene pass for the dashboard subtree

**Severity**: LOW (consolidated)
**Category**: code-hygiene / polish / multi-facet
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Description**: This is a CONSOLIDATED scope for 10 LOW-severity code-quality / polish facets surfaced across the four batch-ZC sidecars. Each facet is below acceptance-criteria-blocking severity individually but together they constitute a single pass over the dashboard subtree for hygiene. Listed in surfacing order:

### F.1 — `localeCompare` with no explicit locale is runtime-locale-dependent

- **Source**: `DataQualityContent.md:bugs_limitations_corner_cases.[2]`
- **Anchor**: `DataQualityContent.tsx:76` (`a.category.localeCompare(b.category)` — no locale arg)
- **Behaviour**: collation order depends on `navigator.language`. ASCII-only today; a future accented or non-Latin category name would sort differently for, e.g., an `en-US` user vs a `tr-TR` user.
- **Fix**: pass an explicit locale: `localeCompare(b, 'en')` (or whichever locale the project standardises on).

### F.2 — Dead `if (!data) return ...` guards in every `DataQualityContent` memo

- **Source**: `DataQualityContent.md:bugs_limitations_corner_cases.[3]`
- **Anchor**: `DataQualityContent.tsx:33, 44, 54, 66` (early-returns) + `dataQuality.ts:80` (`initialData` always supplied)
- **Behaviour**: `useGetDataQualityDashboard` sets `initialData`, so `data` is never undefined; the five `if (!data)` early-returns are dead. Misleading defensive code; a maintainer reading them would believe a loading state is handled here when it is `initialData` doing the work.
- **Fix**: remove the guards (the `initialData` IS the loading state) OR remove `initialData` and let the guards be live. Decide one model.

### F.3 — `getFieldFilterAtom` exported but never used

- **Source**: `DataQualityStore.md:bugs_limitations_corner_cases.[2]`
- **Anchor**: `DataQualityStore.ts:24-30` (declaration) + Grep across `odd-platform-ui/src` returns only this file
- **Behaviour**: a focused-atom factory the file ships but the dashboard does not use. A maintainer cannot tell if it is intentionally-public future API or abandoned earlier design.
- **Fix**: either DELETE the export (clean up), or ADOPT it in `useFilter` (closes REFACTOR-606 — the whole-atom-subscription re-render gap). Adopting is the better fix.

### F.4 — Whole-`formFiltersAtom` subscription in `useFilter`

- **Source**: `DataQualityFilters.md:bugs_limitations_corner_cases.[4]`
- **Anchor**: `hooks/index.ts:12` (`useAtom(formFiltersAtom)`) + `DataQualityStore.ts:24-30` (the unused focused-atom helper)
- **Behaviour**: every `useFilter` instance subscribes to the WHOLE `formFiltersAtom`; any filter change re-renders all 10 `FilterItem` autocompletes. Bounded but avoidable.
- **Fix**: switch `useFilter` to `getFieldFilterAtom(filterKey)` for focused subscriptions. Pairs with F.3.

### F.5 — `capitalizeFirstLetter` throws on empty string

- **Source**: `DataQualityContent.md:bugs_limitations_corner_cases.[4]`
- **Anchor**: `DataQualityContent.tsx:13-15`
- **Behaviour**: `[...str][0].toUpperCase()` on empty string is `undefined.toUpperCase()` → throws. Currently safe (called on `status.toLowerCase()` where `status` is a `DataEntityRunStatus` enum value), but the helper is unguarded.
- **Fix**: `return str ? [...str][0].toUpperCase() + str.slice(1) : str` — one-line.

### F.6 — `category` heading rendered without i18n

- **Source**: `TestCategoryResults.md:bugs_limitations_corner_cases.[2]`
- **Anchor**: `TestCategoryResults.tsx:30` (`{category}` un-translated) vs `DataQualityContent.tsx:98, 109, 127` (`t(...)` used for every sibling label)
- **Behaviour**: category labels ('Assertion Tests', 'Volume Anomalies', etc.) are always English regardless of locale. Server-defined enum descriptions, not part of the UI translation catalog.
- **Fix**: either i18n the category strings client-side (requires a known fixed set + translation entries), or accept the design and document it (server-defined display strings are not localised). Decide.

### F.7 — Negative `count` indistinguishable from zero on count tiles

- **Source**: `TestCategoryResults.md:bugs_limitations_corner_cases.[1]`
- **Anchor**: `TestCategoryResults.tsx:14-17, 39` + `components.yaml:3820-3822` (`count: integer` no `minimum`)
- **Behaviour**: tile shows `count > 0 ? count : '–'`, so 0 and negative both render en-dash. `total` reduce sums negatives silently. No production path produces negative (count is `row.taskRunsCount()`), so latent.
- **Fix**: schema-side `minimum: 0` on `count`; tile-side `count >= 0` (or treat negative explicitly).

### F.8 — No `staleTime` configured on `useGetDataQualityDashboard`

- **Source**: `DataQualityContent.md:performance.known_performance_gaps[0]`
- **Anchor**: `dataQuality.ts:77-81`
- **Behaviour**: react-query default `staleTime: 0` means dashboard refetches on every remount AND on every window-focus. An operator tabbing away and back re-runs the three backend queries.
- **Fix**: set `staleTime: 30_000` (or operator-tunable). DQ aggregates do not change second-to-second.

### F.9 — `toSorted` runs outside `useMemo` in `DataQualityContent`

- **Source**: `DataQualityContent.md:performance.known_performance_gaps[1]`
- **Anchor**: `DataQualityContent.tsx:75-77`
- **Behaviour**: `testResults` is re-sorted on every render, not memoised. Cheap (~6 entries) but inconsistent with the surrounding `useMemo`-wrapped derivations.
- **Fix**: wrap in `useMemo(() => ..., [data?.testResults, isSuccess])`. Consistency with siblings.

### F.10 — Present-only `flatMap` silent drop in `TestCategoryResults`

- **Source**: `TestCategoryResults.md:bugs_limitations_corner_cases.[0]`
- **Anchor**: `TestCategoryResults.tsx:19-25` + backend mapper guarantee at `DataQualityCategoryMapperImpl.java:45-60`
- **Behaviour**: `sortedResults` keeps only statuses present in `results`; a `DataEntityRunStatus` value absent from the array yields no tile and no placeholder. Currently dead because the backend mapper's `addMissingStatuses` injects zero-count rows for every missing status. UI silently relies on the backend invariant.
- **Fix**: either ASSERT the six-status invariant at the UI layer (defence-in-depth), or document the cross-tier dependency on `addMissingStatuses` in a code comment. Or both.

### F.11 — Swappable `filterKey` props with no test guard

- **Source**: `DataQualityFilters.md:bugs_limitations_corner_cases.[6]`
- **Anchor**: `DataQualityFilters.tsx:70-74, 85-89` + `DataQualityStore.ts:5-22`
- **Behaviour**: both `deTitleIds` and `titleIds` are valid members of the request shape's `keyof`, so `<TitleFilter filterKey='titleIds' />` placed in the tables block (which expects `deTitleIds`) would type-check and silently mis-route. No test pins the 10 wiring slots.
- **Fix**: a unit test mounting `<DataQualityFilters>` and asserting the 10 `filterKey` props are exactly the expected 10 — closes this gap; supports REFACTOR-604.

---

**Wisdom-test classification**: all 10 facets are GAP-shaped. Each fails the wisdom test for ADR-promotion (none are deliberate architectural choices; all are local oversights or polish opportunities). Each is a refactoring within the existing structure.

**Existing-ADR-or-implied-prescription**: F.3 + F.4 reference the same `getFieldFilterAtom` — adopting it closes both. F.10 references ADR-CANDIDATE-208 (the enum-order tile decision) — F.10's fix is the assertion side of the cross-tier coupling the ADR creates.

**Proposed remedy**: One code-hygiene PR covering the 10 facets, scoped against `components/DataQuality/` + `dataQuality.ts` + the autocomplete shared component. Most facets are 1-5 line changes; the largest (F.4 — switch to focused atoms) is ~15 lines plus the deletion of dead state. Pairs cleanly with the test bootstrap (REFACTOR-604) — adding tests AS the polish lands.

**Severity rationale**: LOW (consolidated). No individual facet exceeds LOW; collectively they constitute a clean polish pass for a feature with no current test coverage and the highest-leverage operator-facing surface in the catalog (Data Quality triage). Worth doing in the same sprint as REFACTOR-592..603, not blocking.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint`. Triage F.1-F.11 individually as PR scope-items; deliver as one or two commits per logical cluster (e.g. F.3 + F.4 together; F.6 standalone; F.7 + F.8 + F.9 + F.10 as the "shared component polish" pass).

---
