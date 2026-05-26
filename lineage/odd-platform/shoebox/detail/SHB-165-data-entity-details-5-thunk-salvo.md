# SHB-165 — Opening any data entity detail page fires a 5-thunk parallel salvo; no batching, no de-dup, no rate-limit

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Every detail-page open fires FIVE parallel backend requests within the same render tick: (1) GET /api/dataentities/{id} (twice per SHB-164 LSN-017 loop), (2) GET /api/dataentities/{id}/alerts/counts?status=OPEN, (3) GET /api/dataentities/{id}/quality/test_report, (4) GET /api/dataentities/{id}/quality/sla, (5) GET /api/permissions/resource/.... Six actual HTTP requests per page-open. For a user paging through entities at the keyboard's rate (j/k navigation, arrow-key down the search results), that's the per-second floor of backend load. There is no batching (no `/api/dataentities/{id}?include=alerts,quality-test-report,quality-sla,permissions`), no GraphQL-style coalescing, no client-side cache check ("did I already fetch this entity?"). The redux byId is keyed by id but never consulted before dispatching.

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:56-76` — TWO useEffects: first dispatches fetchDataEntityDetails (twice per SHB-164); second dispatches the 4 ancillary thunks.
- `odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:35-42` — fetchDataEntityDetails has no cache-check (line 36-41 dispatches unconditionally).
- (Cross-ref `dataentities.slice.ts:49-66`) — byId is keyed by entity id; could support a "skip if already fetched within N seconds" check but doesn't.

## Notes

- Rapid keyboard navigation (j/k through search results) can produce 5N concurrent in-flight requests where N = entities visited per second. For a power-user reviewer with 10 entities/sec navigation, that's 50 concurrent requests during the burst.
- Backend cost: each detail fetch runs a CTE + 4 reactive zip-merges + a view_count UPDATE (per F-001 chain backend). At 10 entities/sec, the database is under significant load from one user.
- The fix is multiple: (a) GraphQL-style include parameter; (b) client-side cache TTL on byId; (c) AbortController on previous in-flight when entity-id changes.
- Adjacent to SHB-164 (LSN-017 double fetch); fixing the LSN-017 bug reduces the salvo from 6 to 5 actual requests but doesn't address the underlying coordination.
- This is a feature candidate: "Data Entity Details — load coordination" — but more accurately, it's a refactoring scope.
- TEST-GAP class: no integration test asserts the dispatch count per mount.

## Next

1. Measure: profile a real session traversing 100 entities and report mean concurrent in-flight requests per second.
2. Decide: GraphQL-style `?include=` parameter (bigger ADR) or client-side cache TTL (smaller incremental fix).
3. Add AbortController for rapid-navigation case.
4. Decide whether to graduate as a refactoring-scope (REFACTOR-NNN) or as a feature ("Detail-page load coordination" worth a feature flow because operators care about responsiveness).

## Links

- cluster_with: [SHB-164, F-001]
- merged_into: (open)
- supersedes: []
