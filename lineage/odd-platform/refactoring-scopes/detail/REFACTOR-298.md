## REFACTOR-298 — React 18 Strict Mode in dev-environments DOUBLE-FIRES every `useEffect(..., [])` on initial mount; combined with absence of cleanup, dev-DB view_count inflates from every home-page visit + every entity-detail page mount

**Severity**: LOW
**Category**: dev-env-bug + idempotency
**Pillars affected**: [P-01] — Data Discovery (dev environment)
**Surfaced by**:
- `PopularStrip.md:bugs_limitations_corner_cases[2]` (|-
    "**Empty deps array means React-strict-mode double-renders during dev DOUBLE-FIRE the popular fetch.** React 18 strict mode invokes effects with `[]` deps twice on first mount (intentional, to surface ill-formed cleanup). Combined with the absence of cleanup (see above), the dev environment fires `fetchPopularDataEntitiesList` twice on every initial home-page visit. Harmless today (the server is idempotent for GET, the second response overwrites the first in the reducer). But this means each dev-session home visit increments the developer-environment view_count by an extra read — over time, a development PostgreSQL has inflated counts that don't represent real usage.")

**Description**: React 18's Strict Mode (typically enabled via `<React.StrictMode>` in `main.tsx`) invokes `useEffect` callbacks TWICE on first mount in development builds (production builds run once). The intent is to surface unsafe cleanup patterns: if an effect's setup creates a side-effect that the cleanup doesn't reverse, the double-fire makes it observable.

For `OwnerEntitiesList.tsx:58-64` (and similar `useEffect(..., [])` patterns elsewhere in the SPA):
- Production: fires `fetchPopularDataEntitiesList` ONCE on mount.
- Development with Strict Mode: fires `fetchPopularDataEntitiesList` TWICE on mount.

The dispatch chain reaches the backend's view-count-incrementing endpoints. For Popular itself, the fetch is read-only (no view_count side-effect). But for the DataEntityDetails page mount — the LSN-017 locus — the double-fire DOUBLES the +2 inflation to +4 per page-open in development.

The harm is bounded to development:
- Production: REAL operators see +2 inflation per page-open (LSN-017 REFACTOR-220).
- Development: developers iterating on the UI see +4 inflation per page-open (LSN-017 + Strict Mode).

Over a dev-session of 100 page-opens, the dev DB's `data_entity.view_count` column accumulates fake counts that don't represent real usage. If the dev DB is used for any analytics-style query, the counts mislead.

The fix: gate the dispatch on `prev state.popular.length === 0 && isNotFetched` to short-circuit the second fire when the first has already populated the slice. The check is non-invasive (no functional change in production, eliminates the dev-only double-fire).

A more structural fix would be to fix LSN-017 (REFACTOR-220) AND adopt RTK Query (which has native deduplication) — but those are bigger lifts.

**Primary source citations**:
- `OwnerEntitiesList.tsx:58-64` — the unguarded `useEffect([])` dispatch
- React 18 Strict Mode semantics (standard)
- `PopularStrip.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-097 codifies `[]` deps as deliberate. The Strict Mode double-fire is a development-tooling caveat; the ADR's deliberate choice doesn't address it.

**Proposed remedy**: Add a `prev state.popular.length === 0 && isNotFetched` guard to the dispatching `useEffect`. The guard:
- In production: identical behaviour (first mount → empty slice → guard passes → fetch fires).
- In development with Strict Mode: first invocation → empty slice → guard passes → fetch fires + slice populates. Second invocation → populated slice → guard FAILS → fetch skipped.

The fix is one boolean conjunction at the useEffect's start.

**Severity rationale**: LOW — dev-environment annoyance; production unaffected; trivially fixable.

**Suggested backlog grouping**: `UI architecture hardening sprint` (alongside REFACTOR-220 LSN-017 fix).

---
