## REFACTOR-623 — `GET /api/titles` `size` parameter is unbounded; `page=0` and negative inputs produce HTTP 500 — the Title directory's caller-controlled amplification + the page-zero boundary

**Severity**: MEDIUM
**Category**: missing-validation (pagination boundaries)
**Pillars affected**: [P-05 Ownership, P-06 Configuration]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "**No server-side cap on `size` — caller-controlled pagination amplification** — `size` flows verbatim from `Integer size` parameter to `paginate(...).limit(size)`. An authenticated caller can `GET /api/titles?size=1000000` and the JVM will materialise the entire (filtered) title directory plus the count CTE in one response. No `Math.min(size, MAX)`, no `@Max`, no controller-level validator." — evidence: TitleController.java:18-22 + ReactiveAbstractCRUDRepository.java:84-91 + components.yaml:4222-4229 (no `maximum` keyword on size param)
- `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[2]` (LOW) — "**`page=0` / negative input has undefined behaviour** — controller signature uses raw `Integer page` with no `@Min(1)`. `(0 - 1) * size = -size` is the offset that flows into jOOQ. The Postgres-level outcome (error code or driver-level rejection) is not statically determinable; surface confirmed via P-129. The wire response is an unhandled exception or a 500, not a 400-with-clear-message."
- `odd-platform__java__TitleController__controller-class__TitleController.md:concepts.invariants.[5]+[6]` — confirms the chain
- Probe `P-129` (Size unbounded? page=0 surface? ORDER BY id ASC at wire?)

**Description**: `TitleController.getTitleList(page, size, query, exchange)` carries `Integer page, Integer size` parameters with NO `@Min`/`@Max`/`@Valid`/`@NotNull` annotations; the OpenAPI `PageParam`/`SizeParam` carry no `minimum:`/`maximum:` (per `components.yaml:4213-4229`); the inherited `ReactiveAbstractCRUDRepository.list(page, size, query)` at line 91 does `paginate(..., (page - 1) * size, size)` with NO Math.min/Math.max guards.

**Two operator-actionable boundary surfaces**:

1. **Unbounded `size`** — an authenticated caller can `GET /api/titles?size=1000000` and the JVM will materialise the entire (filtered) title directory PLUS the count CTE in one response. The Title directory is typically tens of rows, so the per-request blast radius is bounded by row count — but: (a) the SAME inherited `ReactiveAbstractCRUDRepository.list` pattern is replicated across every list-CRUD controller (Tag, Owner, Title, Namespace, Role, Policy, DataSource, etc.), so the unbounded-size class is HIGH on aggregate (REFACTOR-020 covers the cross-cutting class); (b) a hostile caller can request `size=Integer.MAX_VALUE` (2147483647) and Postgres will accept the LIMIT — the JVM allocates whatever Postgres returns; OOM risk is real on directories with > 100K rows.

2. **`page=0` boundary** — a JavaScript-style 0-indexed caller (the typical client default) sends `page=0`. The repository computes `(0 - 1) * size = -size` (negative offset). Postgres rejects negative OFFSET with `OFFSET must not be negative`. The wire response is HTTP 500 (or 400 if WebFlux wraps the SQLException) — NOT a 400-with-clear-message guiding the caller to "use page=1". `page=null` is similarly problematic (NPE at unboxing).

**Operator-visible consequence**:
- A new API integration follows the convention they know (`page=0&size=20`); they get a 500 with no guidance.
- A hostile caller passes `size=1000000` to enumerate the full directory; the JVM allocates the response.
- A typo'd `page=Integer.MAX_VALUE` triggers integer overflow at `(page-1) * size` (both are int) — silently produces unpredictable rows.

**Primary source citations**:
- `TitleController.java:18-22` (raw `Integer page, Integer size` parameters; no annotations)
- `ReactiveAbstractCRUDRepository.java:84-91` (the inherited list method; `paginate(..., (page-1)*size, size)` with no guards)
- `components.yaml:4213-4229` (PageParam/SizeParam with no minimum/maximum)
- Probe `P-129` pins the specific failure modes (size=null NPE, size=-1 jOOQ exception, page=0 Postgres error)

**Existing-ADR-or-implied-prescription**: **REFACTOR-020** (cross-cutting "pagination unbounded" pattern; formerly an ADR-CANDIDATE, demoted to refactoring scope at batch — covers the platform-wide PageParam/SizeParam gap). This entry is the Title-specific instance — should be linked from REFACTOR-020 as a sibling instance.

**Proposed remedy**: Three-step fix (mirrors the REFACTOR-020 prescription):
1. Add `minimum: 1` and `maximum: 1000` to `components.yaml` PageParam / SizeParam (or per-endpoint overrides if 1000 is too tight). Spring's binding then rejects out-of-range values with HTTP 400.
2. Add controller-side `@Min(1) Integer page, @Min(1) @Max(1000) Integer size` annotations (Spring's `@Valid` triggers on the inherited validator).
3. Add an integration test asserting `GET /api/titles?page=0` returns HTTP 400 (not 500) and `GET /api/titles?size=2000` returns HTTP 400.

The fix is identical across the 20+ inheritors of `ReactiveAbstractCRUDRepository.list`. The simplest path is to apply the validation at the OpenAPI component layer (one change cascades to all consumers); the controller-side annotation is the defence-in-depth.

**Severity rationale**: MEDIUM — for the Title-specific surface, the amplification is bounded by directory cardinality (typically tens, occasionally hundreds). The cross-cutting class (REFACTOR-020) is the high-severity surface; the Title-specific instance is MEDIUM.

**Suggested backlog grouping**: `Pagination contract hardening sprint` — couple with REFACTOR-020 (platform-wide pagination unbounded), REFACTOR-498 (getPopularTagList page/size), REFACTOR-552 (Tag size cap), REFACTOR-620 NEW (search hasNext bug).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-020 (cross-cutting pagination unbounded — Title is one of 20+ sibling instances).
- SUPERSEDES: none.
- CONFLICTS: none.

---
