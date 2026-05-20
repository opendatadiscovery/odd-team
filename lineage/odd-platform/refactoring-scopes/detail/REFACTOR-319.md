## REFACTOR-319 — `TermServiceImpl.listByTerm` has BROKEN pagination — `total = item.size()` reflects the page size (not full result count); `hasNext` is hard-coded `false`; the response always claims this is the last page

**Severity**: MEDIUM
**Category**: misleading-api (broken-pagination)
**Pillars affected**: [P-06-data-glossary]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:performance.known_performance_gaps.[1]` (MEDIUM) — "Broken pagination on `listByTerm` — `total` reflects page-size not full size; `hasNext` hard-coded false"

**Description**: `TermServiceImpl.listByTerm` (lines 279-286) is the read-side for "list all data entities linked to this term." The method paginates via `page` / `size` parameters BUT the response wraps `total = item.size()` (the PAGE size) instead of the FULL result count, AND `hasNext = false` is hard-coded. The response always claims "this is the last page" regardless of whether more results exist.

**Failure mode**: A term is linked to 200 data entities. The UI requests page=1, size=20. The response returns 20 items with `total=20` and `hasNext=false`. The UI's pagination component shows "page 1 of 1" — the operator believes the term has only 20 links. Pages 2-10 are invisible at the UI; the operator cannot discover the additional 180 linked entities without crafting raw API calls.

**Primary source citations**:
- `TermServiceImpl.java:279-286` (the broken page-wrapping code)

**Existing-ADR-or-implied-prescription**: None. The platform's pagination conventions (per ADR-CANDIDATE-023 cursor-vs-page) are not violated here — the issue is that the `total` and `hasNext` fields are mis-wired against the actual page size. This is a bug, not an ADR-level decision.

**Proposed remedy**: Fix the page-wrapping to compute `total` via a separate `COUNT(*)` query AND set `hasNext = page * size < total`. The existing pagination conventions provide the canonical pattern (see other paginated services). The fix is two changes: (a) add a `countByTerm(termId)` repository method that returns the full count; (b) wire it into the response builder at line 285.

**Severity rationale**: MEDIUM — UX-bug; affects every operator using the Term detail page's "linked entities" listing; bounded by per-term link count.

**Suggested backlog grouping**: `Data Glossary hardening sprint`

---
