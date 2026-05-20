## ADR-CANDIDATE-080 — Ingestion service is principal-naive — datasource scoping is PAYLOAD-DRIVEN via `data_source_oddrn`; the service trusts the upstream WebFilter to bind caller-to-datasource (when auth.ingestion.filter.enabled), and exposes a uniform contract across all auth modes

**Severity**: HIGH
**Classification**: promote
**Support count**: 1 sidecar (IngestionService — primary source); composes with batch B IngestionDataEntitiesFilter sidecar + ADR-CANDIDATE-027 (opt-in ingestion-token verification)
**Axes present**: services, ingestion pipeline, security architecture

**Surfaced by**:
- `IngestionService.md:implicit_adrs[2]` ("Payload-driven datasource scoping (not principal-driven) is the architectural choice — collectors target a datasource by including its ODDRN in the body, not by being authenticated as that datasource's owner. The interface itself has NO principal / `Authentication` / `ServerWebExchange` parameter. The maintainer chose to keep the service layer ignorant of WHO is calling; the upstream `IngestionDataEntitiesFilter` (when enabled) is responsible for binding caller-to-datasource.")

**Decision statement**: ODD's ingestion service exposes a **principal-naive interface**: `IngestionService.ingest(DataEntityList)` accepts ONLY the payload — NO `Authentication`, `Principal`, `ServerWebExchange`, or session context. Inside the service, `IngestionServiceImpl.ingest` (line 67-69) resolves the target datasource by:

```java
return dataSourceRepository.getIdByOddrnForUpdate(dataEntityList.getDataSourceOddrn())
```

The `data_source_oddrn` field is a PAYLOAD VALUE — the collector tells the platform which datasource it's writing into. The service does not check whether the CALLER has any relationship to that datasource. The decision codifies:

- **(a) Datasource scoping is collector-asserted, not platform-resolved**. The collector knows which datasource it represents and includes the ODDRN in every ingestion call. The platform takes this assertion at face value.
- **(b) Caller-to-datasource binding is upstream**. When `auth.ingestion.filter.enabled=true`, `IngestionDataEntitiesFilter` (per batch B sidecar) intercepts the request BEFORE it reaches the controller, validates the bearer token against the datasource named in the payload, and rejects mismatches. The service is invoked only on valid (caller-token, payload-datasource) pairs.
- **(c) Uniform contract across auth modes**. The service is reusable verbatim under DISABLED, LOGIN_FORM, OAUTH2, LDAP — none of these modes change the service signature. The auth mode is the controller/filter-layer concern; the service is mode-agnostic.
- **(d) The contract is composable**. New auth modes (per-datasource bearer, mTLS-client-cert-binding, future S2S enhancements) can be added at the WebFilter layer without touching the service.

The intent is structural — the maintainer chose to **decouple the service from authentication-and-authorization concerns** by binding caller-identity at the filter layer rather than threading it into the service. This is consistent with the rest of `/ingestion/*` endpoints: `DataSourceIngestionService` also accepts payload + collectorId from session (per `IngestionController.java:50-58`), making the entire `/ingestion/*` surface principal-naive at the service level.

The architectural alternatives the maintainer rejected:

- **(alt1)** Pass `Principal` into the service — would couple the service to Spring Security types; would break the OpenAPI-generated interface contract (`IngestionApi.postDataEntityList` takes no auth args).
- **(alt2)** Resolve datasource by caller-identity, not by payload — would require a `(caller → datasource)` mapping at the platform layer; would prevent the "one collector, multiple datasources" deployment pattern.
- **(alt3)** Enforce datasource ownership at the service via `authIdentityProvider.fetchAssociatedOwner()` — would contradict the principle that ingestion is a machine-to-machine flow scoped by datasource ODDRN, not by Owner (which models UI/API CRUD identity).

**Wisdom test (3-question)**:
1. *Intentional?* YES — the interface `IngestionService.ingest(DataEntityList)` is principal-naive by signature (verified `IngestionService.java:8`); the upstream `IngestionDataEntitiesFilter` exists exactly to bind caller-to-datasource; the architectural decoupling is documented in code shape (no Authentication parameter anywhere in the service or its constructor's dependencies).
2. *Structural impact?* YES — affects the entire `/ingestion/*` surface architecture, the auth-mode composability (4 modes × ingestion-filter-on/off = 8 valid combinations, all handled by the same service), the OpenAPI contract (no auth args on `postDataEntityList`), the trust model (the platform commits to "if the request reached the service, the upstream filter has validated").
3. *Refactoring or structural?* STRUCTURAL — moving to principal-driven scoping would require: (a) breaking the OpenAPI contract (adding auth args), (b) coupling the service to Spring Security, (c) redesigning the per-datasource-token model (per ADR-CANDIDATE-027). Multi-layer redesign, not refactor.
→ ADR-CANDIDATE.

**Evidence**:
- `IngestionService.md` says: "`dataSourceRepository.getIdByOddrnForUpdate(dataEntityList.getDataSourceOddrn())` + IngestionService.java:8 (interface accepts `DataEntityList`, NOT `(principal, DataEntityList)` or any auth context parameter)"
- intent_anchor: "the interface itself has NO principal / `Authentication` / `ServerWebExchange` parameter. The maintainer chose to keep the service layer ignorant of WHO is calling; the upstream `IngestionDataEntitiesFilter` (when enabled) is responsible for binding caller-to-datasource."

**Existing ADR**: composes with:
- **ADR-CANDIDATE-027** (Ingestion-token verification opt-in via `auth.ingestion.filter.enabled`) — the FILTER side of this ADR's service-side stance. The two together describe the layered auth model.
- **ADR-CANDIDATE-061** (OpenAPI-contract-driven ingestion path) — the contract side; the OpenAPI spec doesn't carry auth args either.
- **ADR-CANDIDATE-077** (Principal resolution at service tier) — the contrasting stance for user-driven mutation services. For ingestion the service is uniformly principal-naive; for user-driven mutations the service consults `AuthIdentityProvider` when needed. The two ADRs together define the per-axis principal-resolution policy.
- **ADR-CANDIDATE-078** (alert-ingestion dual-path) — the AlertManager webhook is even thinner than this (no per-datasource binding at all); the trust gradient runs from no-auth → opt-in-token-auth → user-session-auth.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-204/205 (existing — default-off unauth ingestion + cross-tenant ingestion under filter-OFF; the consequence chain of this ADR being applied with `enabled: false`).
- REFACTOR-215 (existing — Unknown data_source_oddrn returns 5xx not 404; the ADR's contract does NOT defend against the error-translation gap).

**Proposed action**: Promote to `adrs/drafts/principal-naive-ingestion-service.md`. Document:
- The interface contract: `ingest(DataEntityList)` — no auth args.
- The payload-driven scoping: `data_source_oddrn` IS the scoping mechanism.
- The upstream-filter binding: `IngestionDataEntitiesFilter` validates (caller-token, datasource) when enabled.
- The uniform contract across auth modes — the service is reusable verbatim under DISABLED/LOGIN_FORM/OAUTH2/LDAP.
- The rejected alternatives (principal-passing, caller-identity-resolution, owner-scoping).
- The composability — new auth mechanisms add at the filter layer.
- The operator-facing UX: under `auth.ingestion.filter.enabled=false` (default), the service trusts any caller naming any datasource — flagging the operator-deployment-responsibility for setting the toggle.
- Cross-link with ADR-CANDIDATE-027, ADR-CANDIDATE-061, ADR-CANDIDATE-077, ADR-CANDIDATE-078.

**Severity rationale**: HIGH — load-bearing decision for the entire `/ingestion/*` surface. Every collector relies on the payload-driven scoping; every operator deploying with `auth.ingestion.filter.enabled=true` relies on the filter-to-service contract; every future auth mechanism plugs in at the filter layer. The decision's consequence chain shapes the platform's data-injection trust model end-to-end.

---
