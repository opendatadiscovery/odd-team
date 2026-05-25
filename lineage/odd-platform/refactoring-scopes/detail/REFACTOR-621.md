## REFACTOR-621 — `getSearchSuggestions` top-5 has NO secondary ORDER BY tiebreaker — equal-`ts_rank` rows are returned in storage/heap order, non-deterministic across queries on the same dataset

**Severity**: LOW
**Category**: missing-ordering (LSN-019-class)
**Pillars affected**: [P-04 Data Discovery]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[7]` (MEDIUM) — "**`getSearchSuggestions` has no determinism contract on ties.** `ReactiveDataEntityRepositoryImpl.java:470-513`: the CTE selects + sorts by `RANK_FIELD_ALIAS DESC` + `LIMIT SUGGESTION_LIMIT(5)`; the OUTER select re-sorts by `rank DESC` only (no secondary key). When 6+ entities have equal `ts_rank`, the top 5 are picked by storage/heap order — i.e. non-deterministic across queries on the same dataset. Operators searching for a popular term ('users', 'orders') may see different top-5 across keystrokes."
- Probe `P-134` (Category B + C: getSearchSuggestions determinism with equal ts_rank ties)

**Description**: `ReactiveDataEntityRepositoryImpl.getQuerySuggestions` (lines 470-513) builds a 2-level SQL query:
1. **CTE**: SELECT * FROM data_entity WHERE FTS-match + entity_class_id filter + manually_created filter, ORDER BY `ts_rank DESC`, LIMIT 5.
2. **OUTER SELECT**: select from the CTE, JOIN to source-data-entity / namespace / etc., ORDER BY `rank DESC` (no secondary key).

Both ORDER BY clauses sort ONLY by `ts_rank DESC` with no tiebreaker (e.g. `DATA_ENTITY.ID DESC` or `DATA_ENTITY.EXTERNAL_NAME ASC`). When 6+ entities have equal `ts_rank` (synonym-rich catalogs, popular search terms where multiple entities match equally), the CTE's `LIMIT 5` truncates by Postgres storage/heap order — i.e. non-deterministic across:
- Repeat queries on the same dataset (Postgres may pick different ordering if intervening UPDATEs / VACUUM shifted storage)
- Different replicas in an HA deployment
- Sessions reaching different connection-pool members

The OUTER select's ORDER BY then operates on the CTE's 5 rows; the 6th-ranked entity that COULD have been in the top-5 may sometimes appear and sometimes not.

**Operator-visible consequence**:
- Operator searches for `users` in the main search bar.
- 10 data entities match with equal ts_rank (e.g. `users_old`, `users_new`, `users_v1`, ..., `users_v10` — synonym-stuffed).
- The autocomplete dropdown shows 5 of them; which 5 is non-deterministic.
- Operator types another keystroke (or refreshes); the dropdown may show a different 5.
- The operator's target entity (say `users_v3`) flickers in and out of the dropdown.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:470-513` — the 2-level query with no secondary ORDER BY key
- `ReactiveDataEntityRepositoryImpl.java:498-499` — CTE's `ORDER BY rank DESC LIMIT 5`
- `ReactiveDataEntityRepositoryImpl.java:509` — OUTER select's `ORDER BY rank DESC` (no tiebreaker)
- `SearchSuggestionsAutocomplete.tsx:206` — `filterOptions={option => option}` confirms the UI does NOT re-sort; the backend's natural order IS the operator-visible order
- Probe `P-134` — pins the determinism question on a synonym-stuffed dataset

**Contrast with the platform's other ORDER BY paths** that DO carry tiebreakers:
- `getSearchResults` (`ReactiveDataEntityRepositoryImpl.java:702-712`) has `STATUS-case ASC + ts_rank DESC + DATA_ENTITY.ID DESC` — the final `ID DESC` is a deterministic tiebreaker (per the stress findings name_behavior_pairs of the same sidecar).
- `getRelationships` (`ReactiveDataEntityRelationshipRepositoryImpl.java:77-79`) has `DATA_ENTITY.ID ASC` — unique-by-PK so no tiebreaker needed.

The pattern is: every list endpoint with an ambiguous primary ORDER BY adds a unique-column tiebreaker EXCEPT `getSearchSuggestions`.

**Existing-ADR-or-implied-prescription**: none. The platform's convention is "every ORDER BY has a deterministic tiebreaker"; `getSearchSuggestions` is the lone violator.

**Proposed remedy**: One-line fix:
1. Add `DATA_ENTITY.ID DESC` (or `DATA_ENTITY.EXTERNAL_NAME ASC`) as a secondary ORDER BY key in BOTH the CTE (line 498-499) and the OUTER select (line 509).
2. The choice between ID DESC and EXTERNAL_NAME ASC is a UX call: ID DESC gives "newer entities first" on tie (preserves the platform's findByState pattern); EXTERNAL_NAME ASC gives "alphabetical" (matches operator expectation for autocomplete dropdowns).

The remedy is refactoring within the existing SQL shape — not a structural change.

**Severity rationale**: LOW — UX-shaped (non-deterministic dropdown across keystrokes; flickering autocomplete options). Not data-loss, not security; operator-confusion only. Bounded by how often catalogs accumulate equal-rank rows (synonym-rich catalogs are real but not the norm).

**Suggested backlog grouping**: `Search UX hardening` — couple with REFACTOR-622 (entityClassId singular cannot OR-filter — same autocomplete surface), REFACTOR-347 (no ORDER BY on listByOddrns — sibling determinism gap).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-347 (listByOddrns no ORDER BY — both are determinism gaps).
- SUPERSEDES: none.
- CONFLICTS: none.

---
