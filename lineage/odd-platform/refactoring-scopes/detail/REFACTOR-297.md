## REFACTOR-297 — No client-side staleTime / cache-control / ETag / If-None-Match awareness on home-page list endpoints; every UI fetch hits the unindexed Popular sort on the server; a 5-second client-cache would absorb the dominant traffic pattern at negligible UX cost

**Severity**: LOW
**Category**: missing-cache + performance-redundant-query
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:performance.known_performance_gaps[0]` (|-
    "**Every Popular fetch hits the unindexed sort on the server.** The client has no staleTime / cache-control / ETag / If-None-Match awareness — every UI fetch is a fresh DB round-trip. A 5-second client-side cache (or RTK Query's staleTime, or a `lastFetched` timestamp in the slice) would absorb the dominant traffic pattern (home-page refresh, back-button) at negligible UX cost. Same recommendation as batch-G's HTTP-cache-headers gap, on the client side.")

**Description**: ADR-CANDIDATE-097 (one-shot mount fetch — Redux as SPA-session cache) codifies the project's caching strategy as deliberate. REFACTOR-297 is the gap that the project's caching strategy LEAVES UNDEFENDED: every mount-fire fetches fresh from the server. There is no:
- **staleTime** — a recently-fetched value cannot be reused without re-fetch.
- **cache-control awareness** — the UI doesn't read backend Cache-Control headers; even if the server sent `max-age=5`, the UI would ignore it.
- **ETag / If-None-Match** — no conditional GET; every UI fetch is unconditional.
- **`lastFetched` timestamp tracking** — the slice doesn't track when each list was last fetched.

The dominant traffic pattern (home-page refresh, back-button navigation) drives back-to-back fetches separated by milliseconds-to-seconds. Each fetch:
- Hits the backend `GET /api/dataentities/popular` route.
- Triggers the unindexed `ORDER BY view_count DESC` sort (batch-G REFACTOR-221).
- Returns 5 entries.

A 5-second client-side cache would absorb the dominant pattern: a user clicking home → entity → home within 5 seconds would see the cached Popular without re-fetching. The user would see a slightly stale list (entities ranked by view_count as-of-5-seconds-ago) — acceptable trade-off for the eliminated backend pressure.

Three implementation options:
1. **`lastFetched` timestamp in the slice** — track when each list was last fetched; the dispatcher skips re-fetch if within staleTime. Manual but lightweight.
2. **RTK Query migration** — adopt `@reduxjs/toolkit/query` for home-page lists; staleTime, dedup, conditional-fetch all native.
3. **Backend Cache-Control headers** — server sends `Cache-Control: max-age=5`; browser obeys for repeated GETs in the same tab; works for back-button refresh but not for explicit refetches.

Options (1) and (3) are non-invasive; option (2) is structural.

**Primary source citations**:
- `OwnerEntitiesList.tsx:58-64` — unconditional dispatch
- `PopularStrip.md` documents the gap
- Cross-ref batch-G `getPopular.md:bugs_limitations_corner_cases[8]` (HTTP cache headers gap on the backend)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-097 codifies the SPA-session cache via `[]` deps + wholesale-replace. The absence of a finer-grained staleTime is a gap within the codified pattern, not a deviation from it. The ADR's migration path mentions React Query / SWR as the structural fix.

**Proposed remedy**: Option (1) — add `lastFetched` to each list-slice; the dispatching `useEffect` checks `Date.now() - lastFetched > 5000` before dispatching. Cheap, non-invasive, observable in DevTools.

**Severity rationale**: LOW — performance optimisation; absorbs back-button + rapid-navigation pressure on the backend; no current operational urgency.

**Suggested backlog grouping**: `Performance / cache sprint`.

---
