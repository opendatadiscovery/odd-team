## REFACTOR-382 — Tag `listMostPopular` has no `size` cap — `size` parameter is passed verbatim to `paginate(...)`; an attacker submitting `size=100000` forces a full-directory aggregate

**Severity**: LOW
**Category**: missing-rate-limit / missing-quota (DoS-shape on a read endpoint)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:performance.scaling_characteristics`

**Description**: `ReactiveTagRepositoryImpl.listMostPopular(page, size, query)` (lines 137-167) passes `size` verbatim to `paginate(...)`. An attacker can submit `size=100000` via `GET /api/tags/popular?size=100000` and force a full-directory aggregate scan + serialisation.

The popular-tags surface is read-collaborative (any authenticated user can call it), so the attack surface is broad. Combined with the absence of name validation (REFACTOR-360) and the side-door write path (REFACTOR-223), the read-side DoS surface compounds with the directory-pollution surface.

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:138, 147-148`
- `TagController.java:36-44` — `getPopularTagList`

**Proposed remedy**:
1. **Server-side cap** — clamp `size` to `min(size, MAX_TAGS_PER_PAGE=100)` at the service tier.
2. **OpenAPI spec validation** — `maximum: 100` on the `size` query parameter.

Both together close the gap.

**Severity rationale**: LOW — DoS-shape; bounded by the operator's tag directory size and the JVM's heap. Easy fix.

**Suggested backlog grouping**: `SEC-NNN authorization-audit sprint` — pair with REFACTOR-360 (the validation gap), REFACTOR-223 (the side-door write).

---
