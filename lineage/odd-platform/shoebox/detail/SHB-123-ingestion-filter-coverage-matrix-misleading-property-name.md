# SHB-123 — `auth.ingestion.filter.enabled` covers 1 of 5 ingestion endpoints, but its name suggests the whole namespace

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators who enable `auth.ingestion.filter.enabled=true` believing they have "locked down the ingestion API" are still running 3 of 5 ingestion endpoints completely unauthenticated. The property gates exactly ONE filter (`IngestionDataEntitiesFilter`) whose path matcher is the exact literal `/ingestion/entities` POST. The other 4 ingestion-controller endpoints (`POST /ingestion/datasources`, `POST /ingestion/entities/datasets/stats`, `POST /ingestion/metrics`, `GET /ingestion/dataentitygroups/{degOddrn}/entities`) are not covered — even with every toggle on, only datasource registration (covered by the unconditional `IngestionDataSourceFilter`) and entity ingestion (covered by the toggled filter) are gated. Combined with `SecurityConstants.WHITELIST_PATHS = {.., "/ingestion/**", ..}` exempting the entire prefix from UI auth, the platform ships with a 5×2×4 = 40-cell auth-coverage matrix that operators must reason about — but the property's NAME suggests there's exactly one toggle for "ingestion auth", which is operator-trap shaped.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:28` — exact-literal path matcher `new PathPatternParserServerWebExchangeMatcher("/ingestion/entities", HttpMethod.POST)`. Not `/ingestion/entities/**`; sub-paths like `.../datasets/stats` are unmatched.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:20` — `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")`. The bean is the ONLY thing this property gates.
- `odd-platform-api/src/main/resources/application.yml:46-48` — `auth.ingestion.filter.enabled: false` is the bundled default.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` contains `/ingestion/**`. Consumed by `AuthorizationCustomizer.java:22-23` (OAUTH2/LDAP) and `LoginFormSecurityConfiguration.java:50` (LOGIN_FORM) — UI auth modes skip the entire ingestion prefix.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ingestion/IngestionController.java:31-103` — 5 handlers, only 1 (`createDataSource`) is unconditionally authenticated via the sibling `IngestionDataSourceFilter`; only 1 (`postDataEntityList`) is conditionally authenticated when the toggle is on; the remaining 3 (`postDataSetStatsList`, `ingestMetrics`, `getDataEntitiesByDEGOddrn`) are unauthenticated in EVERY shipped configuration.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-25 status 200 per IngestionController sidecar) — explicitly says "All other /ingestion/* paths (e.g. /ingestion/alert/alertmanager, /ingestion/entities/degs/children, /ingestion/entities/datasets/stats) ... remain outside the ingestion filter's coverage" — the docs surface the gap, but the property NAME on `application.yml` does not.

## Notes

- The property's name is a **false-sense-of-security shape**. An operator audits the YAML, sees `auth.ingestion.filter.enabled: true`, files the audit ticket. Three endpoints remain wide open.
- The docs are AHEAD of the code's self-documentation here — the live security page does state the gap. But operators read `application.yml`, not the docs page; and the property name's narrowness is invisible at the configuration surface.
- The remediation options are themselves a SHIP-vs-DEPRECATE shaped decision:
  - Rename the property to `auth.ingestion.entities.filter.enabled` (truthful narrow scope) — breaking.
  - Broaden the path matcher to `/ingestion/**` excluding `/ingestion/datasources` (which has its own filter) — closes the gap but changes test-time defaults.
  - Add a NEW property `auth.ingestion.global.filter.enabled` that mounts an umbrella filter — additive but doubles the YAML surface.
- This is an open thread, not clustering — the evidence is rich (6 file:line refs across filter / config / WHITELIST / 5 controller methods / live docs), but the NEXT action is a maintainer ADR decision, not more evidence-gathering. Likely promotes to a feature flow OR a refactoring-scope.
- Cross-link to F-008 drift facet `ingestion_filter_path_coverage_incomplete` (already in `feature-flows/detail/F-008.yaml`). This thread enriches F-008 by elevating the **PROPERTY-NAME MISDIRECTION** facet (vs the existing path-coverage facet which names which endpoints are uncovered). The property name is the **causal source** of the operator trap; the path matcher is the mechanism.
- The 5-endpoint × 4-auth-mode × 2-filter-toggle × 2-s2s-toggle = 80-cell deployment matrix is not enumerated in any in-repo artefact. A startup-time validation log that prints "ingestion endpoint X is unauthenticated under your current configuration" would surface the matrix at every boot.

## Next

1. Promote this to an `F-NNN` feature anchor in pillar P-10 ("Ingestion API Authentication Coverage") OR merge into F-008 as a top-level facet. The 5-endpoint × N-config-permutation surface is operator-observable and currently undocumented in `application.yml` comments.
2. File a REFACTOR-NNN for the boot-time validation log: at startup, the platform should log a WARN line per unauthenticated ingestion endpoint under the current `auth.type` + `auth.ingestion.filter.enabled` + `auth.s2s.enabled` combination.
3. DOC-NNN: extend the `application.yml` comment around `auth.ingestion.filter.enabled` to name the exact path it covers AND the sibling endpoints that remain open.
4. Probe-NNN: a single parameterised integration test that hits all 5 endpoints across each of (DISABLED, LOGIN_FORM, OAUTH2, LDAP) × (filter true/false) × (s2s true/false) — 40 cells, asserting the documented expected status code per cell. Today ZERO of these cells are tested.

## Links

- cluster_with: [F-008]
- merged_into: F-094
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — SHB-123 evidence (6 file:line refs across filter / config / WHITELIST / 5 controller methods + live docs anchor) satisfies the graduation threshold; the operator-visible 5-endpoint × 4-mode × 2-filter × 2-S2S = 80-cell deployment matrix is a distinct user-observable shape from F-008's destruction angle. Minted F-094 at lineage/odd-platform/feature-flows/detail/F-094.yaml (pillar P-10:F-002). The property-name misdirection is elevated to a CAUSAL SOURCE facet (vs F-008's existing `ingestion_filter_path_coverage_incomplete` SYMPTOM facet); cluster_with F-008 retained as related_features cross-link.
