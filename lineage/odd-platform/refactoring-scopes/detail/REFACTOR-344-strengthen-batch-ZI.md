## STRENGTHENS — Batch ZI (2026-05-26 — searchRoutes confirms the URL-EXPOSURE side of the bearer-token search session)

The search UI route sidecar confirms the schema-side bearer-token property at the URL layer: the `searchId` UUID is visible in the browser URL bar, browser history, server access logs, and referer headers. The enumeration surface is now visibly OPERATOR-FACING, not just schema-internal.

**New surfaced_by entry**:

- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[3]` (LOW) — "Deep-link sharing — `:searchId` UUID has NO user binding; any authenticated user with the UUID can fetch the session. Per batch-M SearchController.search REFACTOR-344 invariant: the `search_facets` row stores no `created_by` or `owner_id`. Combined with the lack of route guard here, this means: User A shares URL `/search/{uuid}` with User B; User B (authenticated) opens it; the server returns User A's session state regardless of B's identity. This is enumeration-friendly (a UUID guess attack is bounded by 128-bit entropy — not exploitable in practice, but the design lacks a 'this session is yours' contract)."

- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[5]` (LOW) — "No URL state for ANY filter / facet / query / page-position — only the session UUID. A user filtering by `Type=Dataset, Owner=Alice` cannot bookmark a URL that encodes that filter; they must rely on the server-side `search_facets` row persisting. If the row TTL is short (or zero — see Stress Protocol Category F, probe P-168), the bookmark breaks. evidence: searchRoutes.ts:14-16 — the interface declares ONLY `searchId`; no `query`, no `filters`."

- `odd-platform__ts__routes__route__search.md:security.data_exposure` (LOW) — "URL bar exposes session UUID — `/search/{uuid}` is visible in browser history, server access logs, referer headers if any external links are clicked from the Catalog page. The UUID itself is opaque (random 128-bit), but it's the handle to fetch the session's query + facets + last results."

**What this strengthening adds**: prior coverage was schema-side (no `owner_id` / `created_by` columns on `search_facets`). Batch ZI adds the URL-exposure consequence:

1. **URL-bar visibility** — the UUID is in the browser URL bar of every Catalog interaction. The bearer-token property is operator-facing, not internal.

2. **Cross-system leakage** — browser history, referrer headers, access logs, error reports all capture the URL. A user accidentally pasting an internal URL into a public chat / bug report / screenshot leaks a working session handle.

3. **Tab-click drops the session** (sidecar `bugs_limitations_corner_cases[2]`) — clicking the "Catalog" top-nav tab takes the user from `/search/{uuid}` to `/search` (no UUID), losing the session. The user expected their search to persist; it doesn't, because the URL was the session's anchor.

4. **Bookmark fragility** (composes with REFACTOR-352 — search_facets unbounded growth, REFACTOR-351 — last_accessed_at field exists but housekeeping job does NOT consult it) — the bookmark's validity depends on whether/when the row gets reaped. The UI sidecar's emitted probe P-168 asks exactly the TTL question — the bookmark contract is undefined.

**Operator-facing consequence**: the bearer-token property documented at REFACTOR-344 is no longer hypothetical (a UUID an attacker could guess); it is observable in the URL bar of every Catalog user. A malicious-tab-snooper / shoulder-surfer / browser-history-thief / screenshare-watcher has a direct surface. Severity remains LOW in absolute terms (UUID is unguessable; bookmark sharing among trusted users is the normal case), but the surface area is now widely visible.

**Triangulation count after ZI**: 4 sidecars (was 3 — search_facets schema + SearchController.search + SearchController class-level; ZI adds the UI route module + the URL-exposure consequence).

**Severity unchanged**: LOW under read-collaborative posture (the absence of user binding is consistent with the platform-wide design); HIGH if any future tightening tries to scope sessions per-user without a schema migration.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-052 (server-side search session); ADR-CANDIDATE-121 (bearer-token-shaped schema); REFACTOR-352 (unbounded growth — UI sidecar's P-168 probe asks the TTL question directly).
- SUPERSEDES: none.
- CONFLICTS: none.

---
