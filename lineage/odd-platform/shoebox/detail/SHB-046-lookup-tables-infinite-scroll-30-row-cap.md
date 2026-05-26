# SHB-046 — Lookup Tables list silently caps at 30 rows because InfiniteScroll scrollableTarget references a non-existent DOM id

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators visiting `/master-data/lookup-tables` see a list of their lookup tables. For any tenant with more than 30 lookup tables the list APPEARS complete but shows only the first 30. There is no skeleton loader at the bottom, no "Load more" button, no pagination indicator — the cap is silent and operator-invisible. The cause is a copy-paste regression: `LookupTablesList.tsx` mounts `<ScrollableContainer id="lookup-tables-list">` around `<InfiniteScroll scrollableTarget="directory-entities-list">`. The container id was customised for the lookup-tables surface; the InfiniteScroll target was NOT — it still references the Directory feature's DOM id. Per `react-infinite-scroll-component` semantics, an unresolvable `scrollableTarget` falls back to window scroll; but `ScrollableContainer` sets `$offsetY={165}` and (likely) `overflow:auto`, so window scroll never fires for content inside the container. The result: `fetchNextPage` never gets triggered by scrolling within the table, page 2..N is never requested, the user sees a silently truncated list.

## Evidence

- `odd-platform-ui/src/components/MasterData/LookupTablesList/LookupTablesList.tsx:51-53` — the mismatched ids: container `id='lookup-tables-list'` wraps `InfiniteScroll scrollableTarget='directory-entities-list'`. The mismatch is unambiguous on a single screen.
- `odd-platform-ui/src/components/MasterData/LookupTablesList/LookupTablesList.tsx:23` — `size = 30` per-page; the cap is 30, not 50 or 100.
- `odd-platform-ui/src/components/MasterData/LookupTables/LookupTables.tsx:60-62` — the page renders `<NumberFormatted value={facets?.total} /> {t('lookup tables overall')}` — the COUNTER reads the backend's total. So a tenant with 250 lookup tables sees "250 lookup tables overall" in the H1 row but only 30 rows in the list. The discrepancy IS the operator-visible signal once they look — but most won't notice; the implicit assumption is "the list shows what the counter says."
- `odd-platform-ui/src/components/MasterData/LookupTablesList/LookupTablesList.tsx:64` — `<EmptyContentPlaceholder offsetTop={215} />` — only renders on `isEmpty`, so the 30-row truncated case does NOT show any "more available" hint.
- `odd-platform-ui/src/components/Directory/...` — the `directory-entities-list` id presumably DOES exist on the Directory feature (F-023); the copy-paste smell originates there. (Not file-line verified — inferred from the id string match.)
- The companion sidecar `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__LookupTables.md` records this finding at `bugs_limitations_corner_cases[1]` as HIGH severity, and emits probe P-192 to verify.

## Notes

- **Operator-impact estimate**: any deployment with 30+ lookup tables sees data loss in the UI. Lookup tables are operator-curated reference data (country codes, tier mappings, customer enumerations) — even a modest-sized organisation will exceed 30 (one table per business-domain enumeration adds up). The "search to find what's missing" workaround works ONLY for operators who know the missing table exists; new operators or hand-over scenarios cannot discover what they cannot see.
- This is the canonical "copy-paste-bug with no test to catch it" pattern. The component has zero direct tests (the LookupTables sidecar's `tests_coverage_semantic.test_files: []`). A `@WebFluxTest` or React-testing-library integration test that asserted "scroll fires fetchNextPage" would catch this in one screen.
- **The fix is one-line**: rename `scrollableTarget='directory-entities-list'` → `scrollableTarget='lookup-tables-list'`. Same shape: a regression-resistant test should pair the container id and the scrollable target via a single constant.
- This thread is `open` because we have not yet observed the runtime cap (probe P-192 in the companion sidecar would confirm; mark as PROBE-NEEDED until then). Static evidence is strong enough to ship the thread.
- Pillar context: this is the SOLE user-observable surface of Master Data Management (P-03) per `system-mission.md:125-141`. A bug here is a bug in 100% of the pillar's user-facing UX.
- This is NOT F-026's scope — F-026 anchors the RBAC / XSS / cross-table-jump gaps; F-026's failure-mode is the PER-TABLE operations. SHB-046 is the LISTING surface failure. Related but distinct.
- Cross-platform sanity check: the same `scrollableTarget` pattern across other paginated lists (Search results, Directory, Activity feed, Alerts) is worth a one-shot grep — `grep -rn 'scrollableTarget' odd-platform-ui/src/components` would enumerate; if any other component reuses the wrong id, this is a SEC of bugs not one.

## Next

1. **Probe**: run the local platform, create 35 lookup tables, observe whether the UI shows 35 or 30. (Trivially executable; probe P-192 in the LookupTables sidecar.)
2. **Promote to F-NNN candidate**: "Master Data Management — Lookup Tables Listing UX" — the listing surface (counter + search + scroll + virtualisation) is conceptually distinct from F-026 (RBAC + mutation lifecycle). Pillar P-03. Or fold into F-026 if the maintainer prefers single-feature-per-pillar — but the lifecycle surfaces are large enough to warrant the split.
3. **One-shot grep**: enumerate every `scrollableTarget="<id>"` site and pair with the immediate parent `<ScrollableContainer id="<id>">`. Any mismatch is the same bug class. Report the count.
4. **TEST-GAP-NNN**: add an integration test (React Testing Library + jsdom) that mounts LookupTablesList with 35 seeded rows, scrolls to the bottom of the container, asserts the network mock observed page=2 fetch.
5. **DOC-GAP-NNN**: `docs.opendatadiscovery.org/features/master-data-management/lookup-tables` does not call out a 30-row limit — because there shouldn't be one. Documenting the bug is the wrong direction; fixing the bug is the right one.

## Links

- cluster_with: [F-026]
- merged_into: (open)
- supersedes: []

## evaluation

(feature-flow-builder will append a dated entry here on its next run.)
