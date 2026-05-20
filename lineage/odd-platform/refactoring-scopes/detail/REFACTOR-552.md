## REFACTOR-552 — `getPopularTagList` `size` parameter accepts arbitrary integer — `size=100000` forces full-directory UNION-ALL CTE; `size=0` produces empty page; no clamping at controller / service / repository

**Severity**: MEDIUM
**Category**: missing-rate-limit (resource-bound / size-limit-silent-trunc)
**Surfaced by**:
- `TagController.md:stress_findings.tunables[size]` — "size=100000: no validation rejects; the SQL plan runs the inner paginate over the entire TAG table sorted by TAG.ID ASC, then the UNION-ALL CTE aggregates over the full result set — large in-memory aggregation, no protection"
- `TagController.md:performance.scaling_characteristics` — "`getPopularTagList` has no `size` cap — `size=100000` is permitted at the controller; forces a full-directory aggregate"
- `TagController.md:performance.known_performance_gaps[no-size-clamp]` (LOW severity per sidecar — promoted to MEDIUM here because of compounding with REFACTOR-546 and DoS surface)
- `TagController.md:tests_coverage_semantic.uncovered_behaviours[size-clamp absence]` (MEDIUM)
- `TagServiceImpl.md:performance.known_performance_gaps[listMostPopular has no service-tier pagination cap]` (LOW per sidecar)
- `TagServiceImpl.md:stress_findings.C-5` (size=0 returns empty page; service doesn't validate positive)
- `TagServiceImpl.md:stress_findings.C-6` (page=0 / negative produces `LIMIT size OFFSET (page-1)*size = -size` → PostgreSQL rejects)
- `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[Page/size parameter boundary]` (MEDIUM) — "Operator submitting a hand-crafted querystring → 500 errors with unhelpful SQL-state-leaked exception traces"
- `ReactiveTagRepositoryImpl.md:stress_findings.A1/A2` (page boundary + size boundary findings)

**Description**: The `size` (and `page`) parameters on `GET /api/tags` are NOT validated at any layer between controller and repository. The flow:
1. `TagController.getPopularTagList(Integer page, Integer size, ...)` (line 37) — no `@Valid`, no `@Min`, no `@Max`.
2. `TagServiceImpl.listMostPopular(query, ids, int page, int size)` (line 73) — autoboxes; no validation.
3. `ReactiveTagRepositoryImpl.listMostPopular` (line 138) — passes `size` and `(page - 1) * size` verbatim to `paginate(...)`.
4. `JooqQueryHelper.paginate(baseSelect, orderByFields, offset, limit)` (`:63-90`) — no clamping. Emits raw SQL `LIMIT size OFFSET offset`.

**Per-boundary behaviour** (from the sidecars' stress_findings):

| `size` value | Behaviour |
|---|---|
| `null` | Spring autobox NPE on unboxing at the service-call boundary (TagServiceImpl receives `int`, controller has `Integer`); request rejected at framework level with low-quality error message |
| `0` | `LIMIT 0` → empty list returned; `pageifyResult` hits `records.isEmpty()` branch and returns `Page.builder().data([]).total(fetchCount()).hasNext(false)`. The `_total` count over the full directory IS computed; the response payload is empty. UI's "Top Tags" surface renders empty without any error. |
| `-1` | Repository emits `LIMIT -1` → PostgreSQL rejects with SQL state 22023 ("requested limit cannot be negative") → SQL error surfaces as 500 to caller. The SQL-state-leaked exception trace can leak schema details. |
| `1` | Returns 1 tag — the OLDEST tag (by TAG.ID ASC) per the LSN-019 drift |
| `30` (typical UI default) | LSN-019 drift surfaces — oldest 30 re-ranked among themselves by count DESC |
| `100000` (DoS-shaped) | Full-directory UNION-ALL CTE — `paginate` LIMIT 100000 returns all tags; the count aggregation runs over the FULL `tag_to_data_entity` + `tag_to_dataset_field` cross-product. For a directory with O(10⁴) tags and O(10⁶) relations, this is a hot-path query that bypasses every safety net. |

**Per-boundary behaviour on `page`**:

| `page` value | Behaviour |
|---|---|
| `0` | `(0 - 1) * size = -size` → PostgreSQL rejects with SQL state 22023 ("OFFSET must not be negative") → 500 |
| `-1` | `(-1 - 1) * size = -2*size` → same 500 |

**Operator-visible consequence**:
1. **Silent truncation at typical UI page-size** (size=30): LSN-019 drift renders OLDEST 30 as "Top Tags" (REFACTOR-546 captures this).
2. **DoS surface** at `size=100000`: a malicious or buggy client can force a full-directory aggregate at every request. Combined with the catch-all `pathMatchers("/**").authenticated()` posture (REFACTOR-547), any authenticated user can issue arbitrary-size requests. Under `auth.type=DISABLED` (REFACTOR-185), even anonymous network probes can.
3. **Information leak via SQL-state-leaked 500**: hand-crafted querystrings with `page=0` or `size=-1` produce 500 responses carrying PostgreSQL SQL state codes (22023) and possibly the SQL fragment itself in the exception message (depending on `ControllerAdvice` configuration). Operators / attackers gain low-level schema fingerprinting.

**Primary source citations**:
- `TagController.java:37-44` (no `@Valid`, no `@Min`, no `@Max`)
- `TagServiceImpl.java:72-77` (straight-through, no validation)
- `ReactiveTagRepositoryImpl.java:138-167` (passes verbatim)
- `JooqQueryHelper.java:63-90` (no clamping in paginate)
- `odd-platform-specification/openapi.yaml:344-346` (no constraint declared in spec — `SizeParam` has a min but the controller doesn't enforce a max)

**Existing-ADR-or-implied-prescription**: None. This pattern (no `size` cap, no `page` validation) is the platform's general convention for paginated list endpoints — verified by similar findings at REFACTOR-202 (lineage_depth no upper bound), REFACTOR-073 (no boot-time security-posture validator). The "no clamp anywhere" pattern is undocumented; the implied prescription is "honour caller-supplied parameters" — which is wrong for unbounded inputs.

**Proposed remedy**: 

1. **Add a `@Max` on `SizeParam`**: in the OpenAPI spec (`openapi.yaml`), add `maximum: 1000` (or platform-appropriate cap) on the `SizeParam` component. The generated `TagApi` interface inherits the constraint. Spring WebFlux validates at controller boundary; oversized requests return 400.
2. **Add a `@Min` on `PageParam`**: same shape — `minimum: 1`. Prevents the negative-OFFSET 500.
3. **Add a service-tier guard**: in `TagServiceImpl.listMostPopular`, clamp `size = Math.min(size, MAX_SIZE)` and `page = Math.max(page, 1)`. Trade-off: silently changes the response shape (`_total` still reflects full directory; `_size` reflects the clamp). Document the clamp in the OpenAPI spec.
4. **Replace 500 with friendly 400**: improve `ControllerAdvice` to map PostgreSQL SQL state 22023 to a friendly 400 with non-leaky error message.

**Recommended**: Options 1 + 2 + 4. The OpenAPI spec is the contract source; the constraint propagates to every regenerated client. Option 3 is a defence-in-depth for non-OpenAPI clients; the maintainer can include it as a SECOND layer. Option 4 is the security hardening — no SQL state codes leak to clients.

**Severity rationale**: MEDIUM — the DoS surface is real (a malicious authenticated user can force expensive queries), the 500-with-SQL-state-leak is a low-severity information leak, the silent truncation at typical sizes is the LSN-019 issue captured separately (REFACTOR-546). Severity is bounded by:
- The current default behaviour is "any authenticated user can make this request" — so the threat model is "authenticated insider abuse" not "anonymous remote".
- The query, while expensive, runs on the same PostgreSQL the rest of the platform uses; isolation is the connection-pool layer.
- The information leak is bounded to SQL state codes (not query contents) unless `ControllerAdvice` is misconfigured.

**Suggested backlog grouping**: API-contract hardening sprint. Pair with REFACTOR-202 (lineage_depth no upper bound), REFACTOR-073 (boot-time security-posture validator). The three are facets of the "platform's API endpoints don't validate inputs" cluster.

---
