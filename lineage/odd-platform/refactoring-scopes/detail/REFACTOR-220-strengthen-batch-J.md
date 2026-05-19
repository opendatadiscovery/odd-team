## REFACTOR-220 — STRENGTHENED by batch J (UI-side LSN-017 ROOT-CAUSE primary-source pinned at DataEntityDetails.tsx:56-64; thunk-side dispatch:HTTP multiplicity 1:1 confirmed; F-001 view_count loop closed at the UI)

This file appends batch-J primary-source confirmations to REFACTOR-220 ("`view_count` inflation loop PRIMARY-SOURCE CONFIRMED — home-page Popular ranking trivially manipulable"). Originally pinned by probes P-001, P-002, P-003, P-004 at the backend; batch J adds the UI-side root-cause primary source at file:line precision.

**Batch J new surfaced_by**:
- `DataEntityDetails.md:bugs_limitations_corner_cases[0]` (|-
    "**LSN-017 — `details.status?.status` in the useEffect dep-array causes 2 fetches per page-open, doubling backend view_count delta to +2.** The 5th dep-array element (line 63) is derived from the fetch response — once the first fetch lands and Redux populates `details.status`, the dep-array shifts from `[id, false, false, false, undefined]` to `[id, false, false, false, 'STABLE']` (or whichever enum value), triggering a second identical fetch. The second fetch returns the same status, the cycle quiesces at exactly +2. **Empirically pinned by probe P-004** (run R-20260519T010758Z-P-004 — xhr_count=2 + DB delta=2 with regex-filtered exact path match). **Fix is 1 line**: remove `details.status?.status` from the dep-array (line 63).")
- `fetchDataEntityDetails.md:bugs_limitations_corner_cases[0]` (|-
    "**Self-feeding double-fetch loop on every detail-page open.** ... No comment or eslint-disable acknowledges this pattern. Net effect on Catalog Overview's 'Popular' counter: **every detail-page open inflates view_count by at least 2**, before counting any actual user-driven status edits.")
- `PopularStrip.md:bugs_limitations_corner_cases[0]` (|-
    "**F-001 LOOP CLOSURE — the UI surface that displays the inflatable ranking is ALSO the surface that triggers view_count increments on click.** A user clicks a Popular tile → SPA navigates to `/dataentities/{id}/overview` → ... the entity's view_count rises → next Popular refresh ranks it higher → the entity is more likely to be clicked again. **The UI does not break this loop with any client-side debouncing, idempotency key, per-tab-per-entity 'already-counted-this-session' guard, or analytics-only mode.**")

**Updated evidence chain**:
The F-001 inflation loop is now PRIMARY-SOURCE confirmed end-to-end:
1. **UI cause (root-cause)** — `DataEntityDetails.tsx:56-64`, dep-array contains `details.status?.status` which is a response-derived value. (NEW batch-J primary source).
2. **Thunk dispatch chain** — `fetchDataEntityDetails` dispatched twice per mount; `dataEntityApi.getDataEntityDetails` fires GET twice. (NEW batch-J primary source — 1:1 dispatch:HTTP multiplicity confirmed.)
3. **Backend side-effect** — `DataEntityController.getDataEntityDetails` runs inside `@ReactiveTransactional`, calls `incrementViewCount` (`ReactiveDataEntityRepositoryImpl.java:173-180`). (Existing batch-F + H primary sources.)
4. **Empirical measurement** — probe P-004 (R-20260519T010758Z-P-004): xhr_count=2 + DB delta=2 with regex-filtered exact path match.
5. **Consumer side** — `getPopular` ranks by `view_count DESC`; the inflated rows surface in the Popular column of every home-page visit.
6. **UI loop closure** — `DataEntityList.tsx:38` Popular tile click navigates to `/dataentities/{id}/overview` which re-fires steps 1-3. (NEW batch-J primary source.)

**Updated severity**: HIGH (unchanged). The fix is now identified at file:line precision:
- **1-line UI fix**: at `DataEntityDetails.tsx:63`, remove `details.status?.status` from the dep-array. Reduces inflation from +2 to +1 per page-open.
- **Absolute fix (cross-batch)**: pair with REFACTOR-211 (backend rate-limiting on view_count UPDATE) and REFACTOR-201 (move view_count outside @ReactiveTransactional) for full defence.

**Cross-pillar**: P-01 (Discovery — Popular) × P-09 (Security — read-collaborative + inflation surface). Severity already HIGH.

---
