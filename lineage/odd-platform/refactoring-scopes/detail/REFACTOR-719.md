## REFACTOR-719 — Search session-expiry has NO recovery path — a stale URL UUID at `/search/{stale-uuid}` after `housekeeping.ttl.search_facets_days: 30` eviction returns 404; the slice has NO `.rejected` reducer; the URL retains the stale UUID; refresh repeats the failure; only manual nav to `/search` (without UUID) recovers. IDENTICAL to TermSearch batch-U bugs[5]

**Severity**: MEDIUM
**Category**: missing-error-recovery / stale-URL-broken-page
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog), P-06 Data Glossary (Dictionary — TermSearch clone)]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[6]` (MEDIUM) — "**Session-expiry: stale URL UUID with no recovery path. IDENTICAL to TermSearch batch-U bugs[5].** Lines 44-48: if a user reloads / deep-links to `/search/{stale-uuid}` after the server-side `SearchFacetsHousekeepingJob` evicted the session (default `housekeeping.ttl.search_facets_days: 30` per F-010 batch-K + LSN-018 case-law), the GET returns 404 / empty. The slice's missing `.rejected` reducer means the state stays empty; the URL still carries the stale UUID; refreshing repeats. **No automatic fall-back to create a fresh session.** An operator hitting a stale Slack-shared link from 30+ days ago sees a permanently broken page until they manually navigate back to `/search` (without the UUID)." — evidence: Search.tsx:44-48 + F-010.yaml (SearchFacetsHousekeepingJob 30-day TTL on `search_facets`) + slice.ts:214-260 (no rejection handling) — severity: MEDIUM
- `odd-platform__ts__react-component__component__Search.md:security.known_security_gaps[3]` (LOW) — "**Session-expiry is silent — broken-page UX after 30 days.** A user reloading after `housekeeping.ttl.search_facets_days: 30` (default per F-010) sees a permanently broken page at `/search/{stale-uuid}` (per bugs section [7]). Not a privacy leak but a session-lifecycle quirk operators should know."
- `odd-platform__ts__react-component__component__Search.md:stress_findings.resource_boundaries` (HIGH) — "If a cache fronts this, what is the TTL / eviction key / staleness window? Server-side, the search_facets row has TTL eviction via SearchFacetsHousekeepingJob (housekeeping.ttl.search_facets_days, default 30 days; F-010 + LSN-018). Stale-cache window from the operator's perspective: a Slack-shared URL older than 30 days hits a permanently broken page."

**Statement**: `Search.tsx:44-48`:
```tsx
useEffect(() => {
  if (!searchId && routerSearchId) {
    dispatch(getDataEntitiesSearch({ searchId: routerSearchId }));
  }
}, [searchId, routerSearchId]);
```

When a user reloads or deep-links to `/search/{uuid}` where the UUID is stale (server-side `search_facets` row has been evicted by `SearchFacetsHousekeepingJob` per `housekeeping.ttl.search_facets_days: 30`), the dispatched `getDataEntitiesSearch` thunk hits `GET /api/search/{uuid}` which returns 404 / empty.

The thunk's `.rejected` action lands in Redux. But the slice (`dataEntitySearch.slice.ts:214-260`) has NO `.rejected` cases — only `.fulfilled` cases for the three thunks. The rejection is SILENTLY DROPPED at the reducer level.

The result:
- `state.dataEntitySearch.searchId` stays empty
- The URL still carries the stale UUID (Search.tsx doesn't `navigate(searchPath())` on rejection)
- The page renders the empty layout (Filters, MainSearch, Results) — but Results.tsx has no `searchId` to fetch results for, so it shows EmptyContentPlaceholder
- A refresh repeats the same flow — same 404, same empty state
- The ONLY recovery: user manually navigates to `/search` (no UUID) → Search.tsx:37-42 fires `createSearch` → new session
- But: the user has to know this recovery path; the UI offers no signal

**Operator-visible impact**:
- 30-day-old Slack-shared link → user clicks → permanently broken page until they figure out to strip the UUID
- 30-day-old bookmark → same
- User leaves a tab open for 30+ days → refresh → same

The 30-day TTL is the default; operators can configure it longer (or shorter via `housekeeping.ttl.search_facets_days`). Longer TTL postpones the issue but doesn't fix it; shorter TTL makes it worse.

**Evidence**:
- `Search.tsx:44-48` — the restore-from-URL effect; no error path
- `useCreateSearch.ts:14-19` — has `.unwrap().then(...)` without `.catch` (separate REFACTOR-694 cross-link)
- `slice.ts:214-260` — three `.fulfilled` cases for createDataEntitiesSearch, getDataEntitiesSearch, updateDataEntitiesSearch; NO `.rejected` cases
- `F-010.yaml` — SearchFacetsHousekeepingJob with `housekeeping.ttl.search_facets_days: 30` default
- LSN-018 — case-law for the TTL eviction class
- TermSearch.tsx (batch U) — IDENTICAL recovery-absent pattern on the sibling Dictionary surface

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-052 (server-side search session model with URL-backed UUID) is the architectural anchor. The decision to persist sessions server-side with TTL eviction has the implicit consequence "URL UUIDs have a 30-day shelf life". The ADR's trade-off section names this; the implementation gap is the absence of recovery.

The architectural fix: when the restore-from-URL fetch returns 404, the UI should:
- Detect the rejection
- Strip the URL UUID (`navigate(searchPath())` without uuid)
- Fire a fresh `createSearch` automatically
- Optionally surface a toast: "Your previous search session expired; starting a fresh one."

**Proposed remedy**:

```tsx
// Search.tsx:44-48 — add error recovery
useEffect(() => {
  if (!searchId && routerSearchId) {
    dispatch(getDataEntitiesSearch({ searchId: routerSearchId }))
      .unwrap()
      .catch((error) => {
        // session evicted or invalid UUID; recover gracefully
        showServerErrorToast({ error, defaultMessage: t('Your previous search session has expired; starting a fresh one.') });
        navigate(searchPath());   // strip the stale UUID
        // the subsequent useEffect at 37-42 will fire createSearch
      });
  }
}, [searchId, routerSearchId]);
```

Plus: add `.rejected` cases to `slice.ts:214-260`:
```ts
.addCase(getDataEntitiesSearch.rejected, (state, action) => {
  state.searchId = '';   // clear stale id from Redux so the cleanup path engages
})
```

Effort: small. Touches Search.tsx + slice.ts + parallel fix to TermSearch.tsx (the clone-bug).

**Severity rationale**: MEDIUM — the defect:
- Is operator-visible on every stale-link encounter
- Has no recovery UX (the user must know to strip the URL)
- Is FREQUENT (30-day-old Slack messages are common in long-term-running deployments)
- Compounds with REFACTOR-680 (no UUID-shape validation — invalid UUIDs route to `<Search/>` with the same outcome)
- Compounds with REFACTOR-694 (no `.catch` on createSearch — silent failure)

Not HIGH because:
- Data is preserved (the row is GONE, not corrupted)
- The user CAN recover (manual URL edit)
- The 30-day window is generous (most useful links are clicked within 7 days)

**Suggested backlog grouping**: `UI architecture hardening sprint` — pair with REFACTOR-694 (no .catch on createSearch), REFACTOR-680 (no UUID validation), REFACTOR-685 (no React error boundary). Together they close the SPA's "silent failure on session/route issue" class.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-052 (server-side search session — this is the TTL-trade-off operator-visible consequence); REFACTOR-694 (no .catch on useCreateSearch — sibling silent-failure); REFACTOR-680 (no UUID validation); F-010 (SearchFacetsHousekeepingJob — the TTL eviction infrastructure); LSN-018 (TTL housekeeping case-law).
- SUPERSEDES: none.
- CONFLICTS: none.

---
