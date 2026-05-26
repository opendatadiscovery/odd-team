# SHB-106 — `auth.ingestion.filter.enabled` only protects one of four `/ingestion/*` paths

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators reading `auth.ingestion.filter.enabled: true` reasonably believe the toggle locks down ingestion globally. The actual coverage is **one HTTP endpoint** (`POST /ingestion/entities`) — three sibling `/ingestion/*` endpoints are governed by DIFFERENT mechanisms: `POST /ingestion/datasources` by an ALWAYS-ON sibling filter (`IngestionDataSourceFilter` — no `@ConditionalOnProperty`), `POST /ingestion/alert/alertmanager` by NO filter and NO `@PreAuthorize` (any caller can POST arbitrary alerts), `POST /ingestion/datasources/{id}/dataentities/statistics` by NO filter. The property name is operator-misleading; the feature is "**Ingestion Surface Coverage Matrix** — which `/ingestion/*` endpoints are protected by which mechanism, and which are unprotected by design vs by oversight".

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:20, 28` — class-level `@ConditionalOnProperty("auth.ingestion.filter.enabled", havingValue="true")` (no `matchIfMissing`); path matcher is HARD-CODED literal `"/ingestion/entities"` + `HttpMethod.POST`. No `/**` suffix; sibling paths and future `POST /ingestion/entities/batch` would silently bypass.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataSourceFilter.java:15, 20` — sibling: `@Component` alone, NO `@ConditionalOnProperty`; path matcher `POST /ingestion/datasources`. Operators flipping the `auth.ingestion.filter.enabled` toggle do NOT affect this filter; it is always-on (when an Authorization header is present) and always-rejects (`AccessDeniedException("Token is missed")`) when it isn't.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AlertManagerController.java:21` — `@PostMapping(path = "ingestion/alert/alertmanager")` carries NO `@PreAuthorize`, no programmatic auth check; the path is on `SecurityConstants.WHITELIST_PATHS = "/ingestion/**"` (`SecurityConstants.java:95-96`). Under every UI auth mode AND with `auth.ingestion.filter.enabled=true`, this endpoint accepts arbitrary external-alert POST payloads from any caller able to reach the HTTP port. Cross-link with F-007 (AlertManager ungated cross-tenant alert creation).
- `odd-platform-api/src/main/resources/application.yml:46-48` — explicit `auth.ingestion.filter.enabled: false` ships as the bundled default. Combined with the toggle's `havingValue="true"` no-matchIfMissing semantic, the default deployment has POST /ingestion/entities ALSO unprotected.
- Live docs WebFetched 2026-05-10 (`/configuration-and-deployment/enable-security/authentication`, `/authentication/s2s`) — neither page documents `auth.ingestion.filter.enabled`. The S2S page describes `auth.s2s.enabled` + `auth.s2s.token` + `X-API-Key` (a DIFFERENT filter; `S2sAuthenticationFilter` covers `/**`, not `/ingestion/*`). Operators conflating "S2S ingestion" with `auth.s2s.enabled` get the wrong filter.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/AbstractIngestionFilter.java:32` — `new ObjectMapper()` per filter instance (not static-shared); `AbstractIngestionFilter.java:45-51` — token compared via `String.equals` (line 56 in subclass), NOT constant-time `MessageDigest.isEqual`. Plaintext-stored token in `TOKEN` table (`TokenGeneratorImpl.java:39,49` — `RandomStringUtils.randomAlphanumeric(40)`).
- The `IngestionDataEntitiesFilter` buffers the FULL request body BEFORE the token check (line 38 `super.getBody().collectList()` followed by `readBody(dataBuffer, DataEntityList.class)` at line 40), then re-emits the same buffers to the controller (`flatMapIterable(ignored -> dataBuffer)` at line 60). Body is parsed TWICE per request (filter + controller's `Mono<DataEntityList>` binding). A 20MB invalid-token request forces 20MB heap pressure before rejection — body-buffered-before-auth pattern.

## Notes

- The hypothesis is a SURFACE COVERAGE MATRIX feature, not an "ingestion auth" feature (which is F-008's territory). The five-by-N matrix:
  - **POST /ingestion/entities** → IngestionDataEntitiesFilter (per-DS bearer token, OPT-IN via `auth.ingestion.filter.enabled`, default OFF)
  - **POST /ingestion/datasources** → IngestionDataSourceFilter (per-collector token, ALWAYS-ON when Authorization header present)
  - **POST /ingestion/alert/alertmanager** → NO filter, NO `@PreAuthorize` (anonymous, F-007 anchored)
  - **POST /ingestion/datasources/{id}/dataentities/statistics** → NO filter (verify; UI sibling)
  - **/ingestion/ + any future path** → NO filter (path matcher is exact-literal not wildcard)
- The property NAME `auth.ingestion.filter.enabled` reads as if "ingestion is locked down". The actual semantic is "the per-datasource bearer-token filter on /ingestion/entities is enabled". A property name like `auth.ingestion.entities-filter.enabled` would be less misleading, or alternately the property should ALSO gate the AlertManager and stats endpoints.
- Caveat — the live `/configuration-and-deployment/enable-security/authentication` page lists `1. Disabled / 2. Login form / 3. OAUTH2 / 4. LDAP / 5. S2S` as authentication modes; `auth.ingestion.filter.enabled` is NOT mentioned. Operators reading the page sequence assume S2S `X-API-Key` covers ingestion — wrong filter, wrong scope, wrong token mechanism.
- Caveat — the S2S filter (`S2sAuthenticationFilter`) when enabled grants ADMIN globally (`S2sAuthenticationFilter.java:31-34` hardcodes username `ADMIN` + role `ADMIN`) across ALL `/**` paths, not just ingestion. So an operator running `auth.s2s.enabled=true` AND `auth.ingestion.filter.enabled=true` exposes TWO distinct API-key authentication surfaces with different scopes — see SHB-111 sibling thread.
- Cross-link with F-007 (AlertManager) — the AlertManager endpoint's lack of any auth is a F-007 finding; this thread anchors the SURFACE-LEVEL claim that the property name `auth.ingestion.filter.enabled` is operator-misleading at the catalog level.
- Drift facet: the filter rejects unknown-dataSourceOddrn requests with `NotFoundException("dataSource", oddrn)`. The parent class catches ONLY `AccessDeniedException` (converts to 401); `NotFoundException` propagates to the default error handler and surfaces as **5xx**, NOT 4xx. An operator hitting the endpoint with a misspelled ODDRN sees an inscrutable 500 — credential-resolution failure surfaces as server error.

## Next

1. Verify the path coverage matrix end-to-end via 4 probes: (a) `POST /ingestion/entities` with no Authorization under `auth.ingestion.filter.enabled=true` → 401; (b) `POST /ingestion/datasources` with no Authorization (always-on filter) → 401; (c) `POST /ingestion/alert/alertmanager` with no Authorization → 2xx (the gap); (d) `POST /ingestion/entities/batch` with no Authorization (hypothetical future path) — confirm filter NOT matched.
2. Read `IngestionController.java` end-to-end to enumerate every `@PostMapping("/ingestion/...")` on the controller AND confirm which are filter-covered vs. uncovered.
3. Promote to a NEW `F-NNN — Ingestion Surface Coverage Matrix` with `seeded_from: SHB-106` and `primary_subject: [IngestionDataEntitiesFilter, IngestionDataSourceFilter, AlertManagerController, IngestionController, AbstractIngestionFilter, SecurityConstants.WHITELIST_PATHS]`. Test matrix: 4-way path coverage × 4-way auth-mode × 3-way credential shape.
4. DOC-NNN — file a doc-gap on `/configuration-and-deployment/enable-security/authentication` for the missing ingestion surface coverage table.
5. REFACTOR-NNN candidate — rename `auth.ingestion.filter.enabled` to `auth.ingestion.data-entities-filter.enabled` to remove the operator confusion (backward-compatible alias for one release).

## Links

- cluster_with: [F-007, F-008, SHB-123]
- merged_into: (open — clustering with SHB-123)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: clustered — Slice F mining-hint guidance explicitly identifies SHB-123 (Slice G's `ingestion-filter-coverage-matrix-misleading-property-name`) as a cluster sibling describing the SAME ingestion-coverage-matrix surface. The two threads together provide a stronger graduation candidate than either alone (SHB-106 anchors on per-path coverage; SHB-123 anchors on the property-name misleading-ness — same operator-observable feature framed from two angles). Set bidirectional `cluster_with` here; the Slice G triage instance handles the sibling. Next run reconsiders the cluster as a single graduation candidate (likely P-09:F-005 or similar; verifies the four-way path coverage probe). Deferring graduation preserves the maintainer's ability to fold SHB-123's framing into the eventual feature without prematurely committing to either thread's emphasis.
