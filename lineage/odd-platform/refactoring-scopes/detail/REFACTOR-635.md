# REFACTOR-635 — IngestionController class-level surface: 4 of 5 endpoints reachable unauthenticated under default deployment; 3 of 5 REMAIN unauthenticated even with `auth.ingestion.filter.enabled=true` — the filter's exact-literal matcher does NOT cover nested ingestion paths

**Severity**: HIGH
**Category**: missing-auth + ingestion-filter-path-coverage-incomplete
**Pillars affected**: [P-10 Ingestion, P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__IngestionController__controller-class__IngestionController.md:coherence_check.strengthens.[get_list_unauthenticated_read]` — the class-level CONSOLIDATION; previously distributed across 5 method-tier sidecars.
- `odd-platform__java__IngestionController__controller-class__IngestionController.md:understanding` — "Combined with `SecurityConstants.WHITELIST_PATHS = {..., \"/ingestion/**\", ...}` … the controller's class-level security posture is: under default deployment, 4 of 5 endpoints accept unauthenticated POSTs from ANY caller able to reach the platform's port; under the most-hardened deployment (auth.type=OAUTH2 + auth.s2s.enabled=true + auth.ingestion.filter.enabled=true), 3 of 5 endpoints REMAIN unauthenticated because the filter path-matcher does not cover the nested paths"

**Description**: The IngestionController class-level enrichment establishes the 5-endpoint × 2-filter × 4-auth-mode auth posture matrix:

| Endpoint | Filter coverage | DISABLED | LOGIN_FORM | OAUTH2 | LDAP | + `filter.enabled=true` |
|---|---|---|---|---|---|---|
| POST `/ingestion/datasources` | IngestionDataSourceFilter (UNCONDITIONAL) | gated | gated | gated | gated | gated |
| POST `/ingestion/entities` | IngestionDataEntitiesFilter (CONDITIONAL on `auth.ingestion.filter.enabled`) | UNAUTH | UNAUTH | UNAUTH | UNAUTH | gated |
| POST `/ingestion/entities/datasets/stats` | NONE | UNAUTH | UNAUTH | UNAUTH | UNAUTH | UNAUTH |
| POST `/ingestion/metrics` | NONE | UNAUTH | UNAUTH | UNAUTH | UNAUTH | UNAUTH |
| GET `/ingestion/dataentitygroups/{deg_oddrn}/entities` | NONE | UNAUTH | UNAUTH | UNAUTH | UNAUTH | UNAUTH |

The toggle `auth.ingestion.filter.enabled` (default `false` per application.yml:48) reads as "protect ingestion globally". Its actual scope is ONE endpoint (`POST /ingestion/entities`). Three other endpoints have NO filter coverage; one endpoint has unconditional filter coverage. The 5 × 2 × 4 = 40-cell matrix is not documented anywhere in the repo; the live docs at `docs.opendatadiscovery.org/configuration-and-deployment/enable-security` DO acknowledge the gap explicitly (verified WebFetch 2026-05-25 status 200, verbatim per the sidecar) but the bundled `application.yml` does not warn the operator.

The root cause is the filter's exact-literal path matcher:

```java
// IngestionDataEntitiesFilter.java:28
if (HttpMethod.POST.equals(request.getMethod()) && "/ingestion/entities".equals(request.getURI().getPath())) {
    return doTokenAuth(...);
}
```

— the literal `/ingestion/entities` does NOT match `/ingestion/entities/datasets/stats` (a NESTED path). Spring's path-matching defaults to exact-literal in equals(); the filter author did not use a path-wildcard.

**Operator-visible failure modes**:

1. **Default deployment is unauthenticated S2S ingestion** — an operator installing the platform with default settings has 4 of 5 ingestion endpoints reachable without credentials. A network scanner can `POST` to `/ingestion/entities` and populate the catalog with synthesized data entities.

2. **Toggle-on doesn't protect what operators expect** — an operator reads "Ingestion: enable `auth.ingestion.filter.enabled=true` to require collector tokens", flips the toggle, and BELIEVES ingestion is now protected. In reality, 3 of 5 endpoints remain unauthenticated.

3. **Tag-namespace side-channel via postDataSetStatsList** (cross-batch finding, surfaced in the IngestionController class sidecar's downstream_side_effects[6]) — `tagService.getOrCreateTagsByName(...)` is reachable from `/ingestion/entities/datasets/stats` (one of the unfiltered endpoints), so an unauthenticated caller can populate the tag taxonomy bypassing TAG_CREATE.

4. **Cross-tenant catalog read via getDataEntitiesByDEGOddrn** — the GET endpoint enumerates DEG membership; an unauthenticated caller can query any DEG's child entities.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../IngestionController.java:1-103` (the 5-method controller).
- `<odd-platform-api>/src/main/java/.../IngestionDataEntitiesFilter.java:20-28` (the conditional filter; exact-literal path match).
- `<odd-platform-api>/src/main/java/.../IngestionDataSourceFilter.java:15-20` (the unconditional filter; covers `/ingestion/datasources` only).
- `<odd-platform-api>/src/main/java/.../SecurityConstants.java:95-96` (WHITELIST_PATHS includes `/ingestion/**`).
- `<odd-platform-api>/src/main/resources/application.yml:46-48` (the toggle default `false`).
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (live docs acknowledge the gap).

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-139 STRENGTHENED in batch ZF acknowledges the filter-narrow-scope is the architectural choice; this REFACTOR captures the operator-actionable closure. The maintainer's stance is "ingestion auth is opt-in"; the gap is "opting in doesn't cover what the toggle name promises."

**Proposed remedy**: Three-part fix:

1. **Widen the filter path-matcher** to cover all ingestion mutations:

```java
// IngestionDataEntitiesFilter.java:28 — replace exact-literal with a wildcard
private static final Set<String> COVERED_PATHS = Set.of(
    "/ingestion/entities",
    "/ingestion/entities/datasets/stats",
    "/ingestion/metrics"
);

if (HttpMethod.POST.equals(request.getMethod()) && COVERED_PATHS.contains(request.getURI().getPath())) {
    return doTokenAuth(...);
}
```

Also extend to GET coverage for `/ingestion/dataentitygroups/{deg_oddrn}/entities` if operators expect read-side protection.

2. **Rename the toggle to reflect actual scope** (or, alternatively, keep the name and widen coverage to MATCH the implied promise). The lesser-disruption choice is to widen coverage; the name `auth.ingestion.filter.enabled` then means what operators expect.

3. **Update live docs + bundled `application.yml`**:
   - Add an inline comment in `application.yml` next to `auth.ingestion.filter.enabled: false` that says "Default-off: 4 of 5 ingestion endpoints accept unauthenticated POSTs. Set to `true` AND deploy a reverse-proxy auth in front for production deployments."
   - The live `enable-security` page already acknowledges the gap; cross-reference the bundled `application.yml` comment.

4. **Add a security-matrix integration test** that exercises all 5 endpoints under each of the 4 auth modes × 2 filter toggle values × 2 s2s toggle values (40 cells), asserting the matrix matches the documented expectations.

**Severity rationale**: HIGH — class-level systemic gap on the S2S surface; the canonical case-of-LSN-001 (silent insecure default in shipped config); operator-visible consequence is unauthenticated data ingestion in default deployment. Pairs with REFACTOR-185 (DISABLED-mode-bypass cluster — the request-routing facet) + REFACTOR-073 (ingestion-filter path coverage incomplete cluster — the original method-tier finding).

**Suggested backlog grouping**: `Ingestion-auth hardening sprint` — pair with REFACTOR-073 + REFACTOR-185 + the docs update. The class-level evidence MAKES the existing cluster a single backlog item; the previous method-tier findings were 5 separate items.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-185 (DISABLED-bypass cluster); REFACTOR-073 (ingestion-filter path coverage cluster — promotes to class-level finding); ADR-CANDIDATE-139 (the narrow-filter-scope architecture stance — this is the operator-actionable closure).
- SUPERSEDES: none.
- CONFLICTS: none.

---
