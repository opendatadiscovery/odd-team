## REFACTOR-341 — `GET /api/dataentities/{data_entity_id}/alerts` pagination is unbounded — no `minimum:` / `maximum:` on `PageParam` / `SizeParam`, no controller-side validation, no repository clamping; caller-supplied `size=1_000_000` produces an unbounded jOOQ query + arbitrarily large response body

**Severity**: MEDIUM
**Category**: missing-validation (unbounded pagination; DoS-amplification)
**Pillars affected**: [P-07-active-platform-features, P-11-platform-api-developer-surface]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityAlerts.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "Pagination parameters are unbounded at every layer this method touches — the controller does not validate `page` or `size`; the OpenAPI `PageParam` / `SizeParam` at `components.yaml:4213-4229` carry no `minimum:` or `maximum:`; the repository computes `OFFSET = (page - 1) * size` (`ReactiveAlertRepositoryImpl.java:189`) with no clamping. A caller passing `size=1_000_000` triggers a single jOOQ query bounded only by what Postgres / network buffers tolerate; a caller passing `page=0` produces a negative OFFSET and downstream behaviour is implementation-defined. The doc page recommends this endpoint for audit-export use cases but never names a recommended `size` value — operators may default to small page sizes and silently truncate exports OR may default to large page sizes and degrade server response time on high-volume entities"
- `odd-platform__java__DataEntityController__controller-method__getDataEntityAlerts.md:performance.known_performance_gaps.[0]` (MEDIUM)

**Description**: Pagination is unbounded at four layers:
1. **OpenAPI**: `PageParam` and `SizeParam` at `components.yaml:4213-4229` carry no `minimum:` or `maximum:` constraints. The schema allows `Integer.MAX_VALUE` as a valid input.
2. **Controller**: `DataEntityController.java:317-318` accepts `Integer page, Integer size` without `@Min`/`@Max` annotations.
3. **Service**: `AlertServiceImpl.java:138-143` passes the parameters through unchanged.
4. **Repository**: `ReactiveAlertRepositoryImpl.java:189` computes `OFFSET = (page - 1) * size` with no clamping; `LIMIT size` is unbounded.

Three failure modes:
- (a) **`size=1_000_000`** → single jOOQ query returns up to 1M rows; bounded only by what Postgres / R2DBC / network buffers tolerate; response body proportionally large; WebFlux memory pressure under concurrent attackers.
- (b) **`page=0`** → `(0 - 1) * size = -size` as OFFSET; downstream behaviour is implementation-defined (Postgres likely errors out, but the controller does not pre-validate).
- (c) **`size=0`** → `LIMIT 0` returns no rows but pagination metadata may misbehave; un-tested edge case.

The audit-export workaround use case AMPLIFIES the risk: per the live alerting page (WebFetched 2026-05-19), this endpoint is recommended for compliance audit exports. Operators following the doc literally with `page=1&size=100` will silently truncate the export for high-volume entities. Operators noticing the truncation may try `size=1_000_000` to avoid pagination round-trips — this works for the operator's audit-export but creates a DoS-amplification vector when combined with the cross-owner reach (REFACTOR-340) and the anonymous-reach under DISABLED (REFACTOR-NNN).

**Primary source citations**:
- `DataEntityController.java:317-318` (controller parameters; no validation annotations)
- `openapi.yaml:1326-1329` (operation parameter refs)
- `components.yaml:4213-4229` (PageParam / SizeParam; no minimum/maximum)
- `ReactiveAlertRepositoryImpl.java:189` (`(page - 1) * size` as OFFSET; no clamping)
- WebFetch live alerting page 2026-05-19 (audit-export workaround named; pagination unspecified)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-001** (controllers as delegates, OpenAPI-generator-emitted interfaces). The IMPLIED prescription is that pagination shape lives at the OpenAPI spec; the gap is the missing `minimum:`/`maximum:` constraints + the missing `@Min`/`@Max` annotations.

**Proposed remedy**: Three layers of fix:
- **(a) OpenAPI tightening**: at `components.yaml:4213-4229`, add `minimum: 1` to `PageParam` and `minimum: 1, maximum: 1000` (or similar) to `SizeParam`. Backwards-compatible since callers passing out-of-range values were already producing undefined behaviour.
- **(b) Controller annotation**: add `@Min(1)` and `@Max(1000)` to the controller parameters; combined with `@Validated` on the class, Spring rejects out-of-range inputs at HTTP-400 before reaching the service.
- **(c) Repository clamping**: as defence-in-depth, the repository should `Math.max(1, page)` + `Math.min(MAX_SIZE, size)` before computing OFFSET — protects against direct calls from internal services that bypass the controller validation.

Companion: the live alerting page's audit-export workaround section should recommend a default `size` value (e.g., 100) and describe paginated iteration semantics for high-volume entities.

**Severity rationale**: MEDIUM — DoS-amplification vector; combined with REFACTOR-340 (cross-owner reach) + REFACTOR-NNN (DISABLED-anonymous reach), an attacker on a misdeployed platform can issue unbounded queries against any entity's alert history. Not HIGH because the pagination shape applies uniformly across MANY endpoints (the underlying `PageParam`/`SizeParam` definitions are shared); the fix shape is platform-wide and benefits all endpoints, not just this one.

**Suggested backlog grouping**: `OpenAPI contract hardening` (cluster with REFACTOR-014, REFACTOR-044, REFACTOR-020, REFACTOR-339 — pagination + shape constraints batch).

---
