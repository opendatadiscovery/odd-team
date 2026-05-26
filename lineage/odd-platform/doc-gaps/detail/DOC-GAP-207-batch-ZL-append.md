## STRENGTHENS — Search.tsx (Catalog page) sidecar confirms the 30-day session-eviction bug also affects `/search/{uuid}` (not just `/termsearch/{searchId}`) in batch ZL

DOC-GAP-207 (Term-search session URLs evicted after 30 days by SearchFacetsHousekeepingJob) was originally framed for the Dictionary tab's `/termsearch/{searchId}` URL. Batch ZL's Search.tsx (Catalog page) sidecar CONFIRMS the IDENTICAL pattern applies to `/search/{uuid}` — the Catalog page's deep-link URL.

### Added surfaced_by (new sidecar cited)

- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases.[Session-expiry: stale URL UUID with no recovery path]` (MEDIUM per sidecar — IDENTICAL to TermSearch batch-U bugs[5]: "Lines 44-48: if a user reloads / deep-links to `/search/{stale-uuid}` after the server-side `SearchFacetsHousekeepingJob` evicted the session (default `housekeeping.ttl.search_facets_days: 30` per F-010 batch-K + LSN-018 case-law), the GET returns 404 / empty. The slice's missing `.rejected` reducer means the state stays empty; the URL still carries the stale UUID; refreshing repeats. **No automatic fall-back to create a fresh session.** An operator hitting a stale Slack-shared link from 30+ days ago sees a permanently broken page until they manually navigate back to `/search` (without the UUID).")
- `odd-platform__ts__react-component__component__Search.md:upstream_callers.[ui_route:/search/{uuid}-deep-link]` — "User pastes/clicks a `/search/{uuid}` link from Slack / bookmark / email. Search.tsx:44-48 fires getDataEntitiesSearch to restore the session. After 30-day housekeeping eviction (F-010 + LSN-018), the GET returns 404 and the page is permanently broken with no recovery."

### New evidence (supplementary)

- The Search.tsx sidecar explicitly cross-references TermSearch batch-U bugs[5] confirming the pattern is structurally identical at both `/search` and `/termsearch` surfaces. DOC-GAP-207's framing now covers BOTH URL shapes — extends from `/termsearch/{searchId}` to `/search/{uuid}`.
- The fix shape — auto-recreate the session on 404 + redirect to bare `/search` — is identical for both surfaces.

### Severity update

Severity remains **MEDIUM** — primary-source extension to the second URL surface (Catalog vs Dictionary) doubles the operator-impact scope but does not change the severity class.

---

**Batch ZL contribution**: 1 PRIMARY SOURCE confirms the pattern extends from Dictionary to Catalog surface; coverage to both `/search/{uuid}` and `/termsearch/{searchId}` URL shapes; severity unchanged (MEDIUM).
