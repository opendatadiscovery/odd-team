## REFACTOR-375 — `getByNameAndNamespace(List)` OR-chain may exceed Postgres parameter limit at high mention counts (>16k mentions) — theoretical today (typical descriptions have <100 mentions); planner OR-handling may degrade to seqscan at high OR counts

**Severity**: LOW
**Category**: missing-defence-in-depth (DoS-shape on description auto-link path)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[6]`

**Description**: `ReactiveTermRepositoryImpl.getByNameAndNamespace(List<TermBaseInfoDto>)` (lines 162-179) builds `(name=? AND ns=?) OR (name=? AND ns=?) OR …` with 2 parameters per input. Postgres's default parameter limit is 32,767 (`PG_MAX_PARAMS`); 16,383 mentions in a single description would exceed it.

Today's typical descriptions have <100 mentions, so this is theoretical. The PG planner's OR-handling may also degrade to seqscan at high OR-counts (planner heuristic: when OR-list is large, full-table-scan becomes cheaper than index-OR-scan).

The hot path is `TermServiceImpl.findTermsInDescription` (the regex-parsed `[[ns:term]]` mention resolver), called on every description-edit.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:162-179`

**Proposed remedy**:
1. **Chunk the OR-chain** — process in batches of e.g., 1000 mentions; concatenate results. Avoids the parameter limit.
2. **Use a temp-table approach** — INSERT mentions into a temp table, JOIN. Faster on huge mention counts.
3. **Add a server-side cap** — reject descriptions with >N mentions via OpenAPI validation. Defensible operator-UX.

Option 3 is the smallest blast radius.

**Severity rationale**: LOW — theoretical today; no real impact.

**Suggested backlog grouping**: `Glossary-tier hardening sprint`.

---
