# SHB-031 — TermDetails shell + Overview tab both fire `GET /api/terms/{id}` — 2× cost on a 12-JOIN hot path per page-open

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators opening a Term detail page (`/terms/{id}/overview`) trigger TWO independent `GET /api/terms/{id}` HTTP round-trips on every mount: one from the SHELL component `TermDetails.tsx:37-45` (which dispatches the `fetchTermDetails` Redux thunk to populate the page header), and a SECOND from the OVERVIEW sub-component `Overview.tsx:19-21` (which uses the `useGetTermByID` React-Query hook independently). The two fetchers target the SAME endpoint and the SAME backend method `ReactiveTermRepositoryImpl.getTermDetailsDto` — a 12-LEFT-JOIN + 4-countDistinct + 7-jsonArrayAgg query that fans out across the term + namespace + ownership + tags + assigned-terms + entities-using + columns-using + query-examples-using aggregations. For typical terms with <50 linked entities this is sub-200ms each; for a heavily-linked enterprise glossary term (e.g. "Customer" linked to 500 datasets across 10 namespaces with 200 tags + 50 owners) the JOIN fan-out cost is non-trivial — and DOUBLED per page-open. This is a **sibling class** to LSN-017 (the canonical view_count doubling): same operator-observable consequence shape (per-page-open multiplier on a backend hot path), different mechanism (cross-component fetch duplication vs useEffect dep-array doubling), but the per-component-enrichment lens of the methodology would not catch it because no single sidecar can see the shell + Overview pair simultaneously.

## Evidence

- `odd-platform-ui/src/components/Terms/TermDetails/TermDetails.tsx:37-45` — shell-level `useEffect` dispatches `fetchTermDetails({termId})`.
- `odd-platform-ui/src/components/Terms/TermDetails/Overview/Overview.tsx:19-21` — Overview sub-component independently calls `useGetTermByID({termId})`.
- `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__TermDetails.md:112` (bugs[0]) — primary finding: "**Double-fetch: shell + Overview both load the same TermDetails.** Lines 37-45 dispatch `fetchTermDetails({termId})`; Overview.tsx:19-21 uses `useGetTermByID({termId})` which is an INDEPENDENT fetcher... When the user lands on `/terms/:termId/overview` (the default route per TermDetailsRoutes.tsx:46), TWO `GET /api/terms/{termId}` requests fire. **Critically: each backend GET runs the 12-JOIN `getTermDetailsDto` hot path**."
- `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__TermDetails.md:185` (performance gap) — "**Note this is the closest TermDetails analog to LSN-017's view_count doubling: BOTH involve a per-page-open multiplier on a backend hot path. Differences: (a) LSN-017 doubles via useEffect dep-array shape WITHIN one component; this doubles via TWO components fetching the same data. (b) LSN-017 amplifies a Postgres UPDATE; this amplifies a Postgres SELECT.**"
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTermRepositoryImpl.md:49` (operations[5]) — "`getTermDetailsDto(id)` (lines 194-238) — the 4-aggregation full-detail query: jsonArrayAgg of ownerships, owners, titles, tags, assigned-terms, assigned-term-namespaces, assigned-term-relations PLUS 4 countDistinct aggregates (entities_count, columns_count, query_example_count, linked_terms_count). 11 LEFT JOINs + 1 hard JOIN on a single root row."
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTermRepositoryImpl.md:175` (gaps) — "The 12-JOIN hot path... a Term with 100 owners, 50 tags, 200 assigned terms; verify the response size does not exceed the expected projection and that `groupBy(TERM.fields() + NAMESPACE.fields())` does not produce duplicate root rows."

## Notes

- **The methodology pattern is the headline**: per-node enrichment sidecars catch behaviours INSIDE one node; cross-component composition catches behaviours that span TWO nodes. Neither the `TermDetails.tsx` sidecar nor the `ReactiveTermRepositoryImpl.tsx` sidecar individually would have flagged this without the explicit cross-component analysis in the TermDetails coherence_check. The shoebox layer is the right place for cross-component findings of this shape.
- **NOT an LSN-017 instance** (the original is one component's useEffect doubling its own dependency from the fetch response). Per TermDetails sidecar `invariants[0]`, TermDetails' own dep array is `[termId]` only and does NOT exhibit the LSN-017 shape. The double-fetch here is a SIBLING class. Worth a new case-law entry (LSN-NNN candidate: "cross-component-fetch-duplication-on-hot-backend-path").
- **Other detail-page surfaces likely have the same shape**: per the TermDetails sidecar coherence_check, the platform's three detail-pages (DataEntityDetails, TermDetails, ?) all follow the "shell + tabs + routes" composition. Worth a sweep to check if DataEntityDetails / DataEntityGroupDetails have analogous doubled fetches.
- **The fix is one of two**: (a) drop `TermDetails.tsx:37-45`'s `fetchTermDetails` dispatch and have Overview be the canonical fetcher (cost: shell renders header before Overview lands, brief flash-of-no-name); (b) drop Overview's `useGetTermByID` and have Overview read from Redux populated by the shell (cost: Overview becomes shell-coupled, less reusable). Choose based on whether Overview is meant to be a standalone-fetching component or a dumb-consumer of shell state.
- **`fetchResourcePermissions` is a separate parallel fetch** at TermDetails.tsx:39 — that one is justified (permissions ≠ term data). The double-fetch is specifically about the TermDetails payload.
- **Backend mitigation alternative**: add a per-request memoisation at the controller layer (e.g. Spring's `@Cacheable(value="termDetails", key="#termId", condition="#ServerWebExchange != null", unless="#result == null")` with a 1-second TTL) — would absorb the doubling without UI changes.

## Next

1. **Promote to refactoring-scope** (REFACTOR-NNN): pick option (a) or (b), implement, ship. Cheap, single-PR fix.
2. **Promote to LSN-NNN case-law** (sibling to LSN-017): "cross-component-fetch-duplication-on-hot-backend-path" — the pattern is detectable at the methodology layer by counting fetcher-per-endpoint per route-render; a methodology-side guard is "for any detail-page route, only ONE component owns the canonical fetch of the route's primary endpoint."
3. **Sweep**: check DataEntityDetails + DataEntityGroupDetails for the same shape. If found, batch the fixes.
4. **Probe**: instrument the backend to count `getTermDetailsDto` invocations per page-open. Expect 2 on the Overview tab today; 1 after the fix.
5. **Cluster with F-002**: F-002 currently does not enumerate UI-layer performance findings; this thread surfaces the per-page-open cost multiplier as a F-002 facet.

## Links

- cluster_with: [F-002]
- merged_into: (open)
- supersedes: []
