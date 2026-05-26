## STRENGTHENS — Batch ZI (2026-05-26 — UI Routes 2: searchRoutes confirms the URL-EXPOSURE side of the server-side-search-session pattern)

The search route sidecar provides the UI-side primary-source confirmation of the server-side-stateful-session pattern previously codified at the backend (batch E + ZE class-level enrichment). The UI route module exposes the session UUID as a path segment (`/search/{searchId}`), which is the operator-facing manifestation of the persistence model — a deep-linkable, bookmarkable, shareable handle to a server-side `search_facets` row.

**New surfaced_by entry**:

- `odd-platform__ts__routes__route__search.md:implicit_adrs[0]` (MEDIUM) — "**Server-side search session model with URL-backed UUID.** The decision to persist search sessions server-side (vs encoding state in query-string params or localStorage) is encoded in this module by EXPOSING the `searchId` as a path segment rather than a query string. evidence: searchRoutes.ts:4 (`SEARCH_ID_PARAM = ':searchId'`) + searchRoutes.ts:9 (`generatePath(\`${BASE_PATH}/${SEARCH_ID_PARAM}\`)`). intent_anchor: 'the SEARCH_ID_PARAM constant declares the URL grammar explicitly; the path-segment form is a deliberate choice over the alternative `?searchId=` query-string form'."

**What this strengthening adds**: prior coverage was BACKEND-side (the `search_facets` row, the seven `/api/search/*` endpoints, the cross-feature replication across SearchController + TermController + QueryExampleController + ReferenceDataController). Batch ZI adds the UI-side URL-shape contract:

1. **Path-segment vs query-param choice is deliberate** — searchRoutes.ts:4 declares `:searchId` as a path SEGMENT, not a `?searchId=` query string. The path-segment form is bookmarkable + shareable as a clean URL; the query-string form would have been functionally equivalent but operator-uglier. The choice signals the session-UUID is the canonical URL identity of "this user's current search state".

2. **The UI wires the path segment to the same backend session row** — searchRoutes.ts → Search.tsx:27 reads the param → Search.tsx:44-48 dispatches `getDataEntitiesSearch({searchId})` → `GET /api/search/{uuid}` → the same `search_facets` row the POST endpoint created. The UI-backend round-trip is end-to-end visible at the route module.

3. **Bookmarkability + shareability are the operator-visible affordances** — useCreateSearch.ts:17 calls `navigate(searchPath(searchId))` immediately after `POST /api/search` resolves, so the user's URL bar shows the new UUID at the first interaction. This is the structural choice the ADR codifies: the server-side session is OBSERVABLE at the URL.

**Triangulation count after ZI**: 3 sidecars (was 2 — batch E + ZE class-level; ZI adds the UI-side URL route module).

**Severity unchanged**: HIGH at the architectural level (the cross-feature pattern); the UI route module is MEDIUM (it's the operator-facing manifestation of an already-HIGH backend decision).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-121 (search-session bearer-token-shaped — the UI-exposed UUID IS the bearer token); REFACTOR-344 (no user binding — the UUID's URL-visibility makes the enumeration surface operator-facing).
- SUPERSEDES: none.
- CONFLICTS: none.

---
