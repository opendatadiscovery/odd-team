## REFACTOR-269 — Non-admin user list path silently ignores `page` / `size` request parameters; in-memory `Page` returns ALL user-effective policies regardless of requested page

**Severity**: LOW
**Category**: ux-bug + missing-pagination
**Surfaced by**:
- `PolicyServiceImpl.md:bugs_limitations_corner_cases[3]`
- `PolicyServiceImpl.md:performance.known_performance_gaps[1]`

**Description**: `PolicyServiceImpl.list` (lines 52-60) branches by the calling user's role: admins go through `policyRepository.list(page, size, query)` (DB-paged via SQL LIMIT/OFFSET); non-admins go through the in-memory `getRolePolicies(roles, query)` (lines 109-116).

The in-memory branch constructs:
```java
new Page<>(filteredPolicies, filteredPolicies.size(), false)
```

— total set to the full filtered count, hasNext set to false, payload set to the full filtered list. The `page` and `size` request parameters are SILENTLY IGNORED.

A non-admin user with N effective policies issuing `GET /api/policies?page=1&size=20` receives a response with ALL N policies (not 20). For typical platforms N is small (1-10), but pathologically a role with many MANAGEMENT/ALL policies bound could produce N=1000+, and the response materialises and ships all of them.

The asymmetry is structurally wrong:
- The admin branch HONORS pagination via the SQL.
- The non-admin branch IGNORES pagination via the in-memory shortcut.
- The contract on `GET /api/policies` should be uniform: same pagination semantic regardless of role.

The maintainer's intent appears to be a performance shortcut (avoid DB pagination on the in-memory branch), but the consequence is a UX inconsistency. A client reading the API spec ("supports paged response") finds the response shape consistent (`Page<PolicyDetails>`) but the actual paging behaviour role-dependent.

**Primary source citations**:
- `PolicyServiceImpl.java:52-60` — the branching list method
- `PolicyServiceImpl.java:109-116` — the in-memory `getRolePolicies` returning `new Page<>(filteredPolicies, filteredPolicies.size(), false)`
- contrast with `policyRepository.list(page, size, query)` at line 58 — the DB-paged admin branch

**Existing-ADR-or-implied-prescription**: none. The pagination contract is documented in the OpenAPI spec via the standard `Page<T>` shape; the implementation drift on the non-admin branch is the gap. The fix is refactoring within the existing pattern.

**Proposed remedy**: Two composable fixes:
1. **Honor pagination on the in-memory branch**: apply the page/size to the in-memory list AFTER filtering:
   ```java
   private Page<PolicyPojo> getRolePolicies(List<RoleDto> roles, String query, int page, int size) {
     final List<PolicyPojo> filteredPolicies = roles.stream().flatMap(...).filter(...).distinct().toList();
     final int total = filteredPolicies.size();
     final int from = Math.max(0, (page - 1) * size);
     final int to = Math.min(total, from + size);
     final List<PolicyPojo> paged = from < total ? filteredPolicies.subList(from, to) : List.of();
     return new Page<>(paged, total, to < total);
   }
   ```
2. **Regression test**: pin the pagination contract. A test that creates 100 policies, binds them to a non-admin user's role, and asserts `GET /api/policies?page=2&size=20` returns 20 policies with `total=100, hasNext=true`.

The fix is one-method; option (1) closes the gap.

**Severity rationale**: LOW — operator UX inconsistency; the response payload is correct (the policies ARE the user's effective policies), just unbounded. For typical workloads (1-10 policies per non-admin), no observable difference. Becomes a concern for pathological role-policy cardinality.

**Suggested backlog grouping**: `Pagination consistency sprint` — pair with other ignored-pagination gaps if any. Cheap, additive.

---
