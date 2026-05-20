## ADR-CANDIDATE-141 — Collector identity propagates via WebSession attribute (`COLLECTOR_ID_SESSION_KEY`), NOT via Spring Security Principal — deliberate orthogonality from the SecurityContext model

**Severity**: HIGH
**Classification**: promote (NEW ADR; structurally LOAD-BEARING — single-sidecar load-bearing per Rule 5)
**Pillars affected**: [P-09-security-access-control, P-10-integrations-ingestion]
**Support count**: 1 sidecar primary-source (batch P createDataSourceEntity) + cross-batch corroborated by batch B IngestionDataEntitiesFilter (which deliberately does NOT set a session attribute for the entities filter)
**Axes present**: controllers, filters, auth_mode_configurations
**Batch**: P (2026-05-20)

**Surfaced by**:
- `IngestionController__controller-method__createDataSourceEntity.md:implicit_adrs.[0]` (HIGH) — "Collector identity propagates via WebSession attribute, not via Spring Security Principal / Authentication" — evidence: IngestionDataSourceFilter.java:36-38 (`zipWith(exchange.getSession()).doOnNext(t -> t.getT2().getAttributes().put(SessionConstants.COLLECTOR_ID_SESSION_KEY, t.getT1().getId()))`) + IngestionController.java:50-58 (`exchange.getSession().map(ws -> ws.getAttribute(SessionConstants.COLLECTOR_ID_SESSION_KEY))`) + SessionConstants.java:1-5 (the shared constant) — intent_anchor: "the design choice is deliberate. The filter could have wrapped the matched Collector into a Spring Security `Authentication` object and pushed it into `ReactiveSecurityContextHolder`. Instead, the codebase explicitly opts for WebSession state, which (a) avoids touching the SecurityContext (the `/ingestion/**` path is in `WHITELIST_PATHS`); (b) keeps the ingestion auth pipeline orthogonal to the UI auth pipeline; (c) trades type-safety (stringly-typed key) for architectural separation."

**Decision statement**: The collector-to-platform identity (the Collector's bigserial id resolved by token at the filter layer) is stored in the WebSession's attribute map under the stringly-typed key `SessionConstants.COLLECTOR_ID_SESSION_KEY = "collectorId"` — NOT in the Spring Security `ReactiveSecurityContextHolder` as an `Authentication`. The controller reads it via `exchange.getSession().map(ws -> ws.getAttribute(...))`, NOT via `Mono<Principal>` / `@AuthenticationPrincipal`.

This is a deliberate orthogonality choice between the ingestion-auth pipeline and the UI-auth pipeline:
- **Architectural separation** — the `/ingestion/**` path is in `SecurityConstants.WHITELIST_PATHS` (line 96); the `SecurityWebFilterChain` does NOT run for it under OAUTH2/LDAP, and is `permitAll()` under DISABLED. Even under LOGIN_FORM, `LoginFormSecurityConfiguration.java:50` lists `/ingestion/datasources` as an exact-path permitted path. The SecurityContext is therefore UNAVAILABLE during ingestion request handling.
- **The trade-off** — type-safety (the `String COLLECTOR_ID_SESSION_KEY = "collectorId"` is not `final`; a rename or misspelling silently breaks the contract; the controller would throw `IllegalStateException("Collector id is null")` at runtime, not at compile-time). A more type-safe alternative (e.g., a custom `Authentication` subtype in the SecurityContext) was explicitly rejected because it would require populating the SecurityContext on a path that is otherwise WHITELIST_PATHS-permitted.

Structural commitments encoded:
- **(a) Each `/ingestion/*` endpoint that requires collector identity MUST resolve it via WebSession state** — adding a `Mono<Principal>` parameter to a new ingestion controller method would NOT work (the SecurityContext is empty on this path).
- **(b) Adding a sibling filter that sets a different session attribute is the extension pattern.**
- **(c) The default `session.provider: IN_MEMORY` + `spring.session.timeout: -1` choices follow from (a)** — but a clustered deployment without sticky sessions BREAKS this contract. The breakage surface is REFACTOR-419 NEW.
- **(d) The pattern is NOT used by `IngestionDataEntitiesFilter` — only by `IngestionDataSourceFilter`** — the entities endpoint identifies the target datasource via the payload's `data_source_oddrn`, not via prior session state. The asymmetry implements ADR-CANDIDATE-140's posture-difference: datasources are session-stateful (one identity per connection), entities are payload-stateful (per-request identity).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — four structural choices (WebSession over SecurityContext, stringly-typed key, in-memory session, no SecurityContext touch) compose into a coherent posture. The non-coincidence: the maintainer COULD have wrapped the Collector identity into an `Authentication` object — that's Spring-idiomatic. Choosing WebSession is the deliberate stance.
2. **Structural impact?** YES — affects every future ingestion endpoint's identity-resolution pattern; affects clustered-deployment topology decisions; affects the operator's mental model.
3. **Refactoring or structural?** STRUCTURAL — moving identity into the SecurityContext requires also populating the SecurityContext for `/ingestion/**`, removing the path from WHITELIST_PATHS or selectively enabling the SecurityWebFilterChain on subpaths, redesigning the UI-auth orthogonality.

**Existing ADR**: Composes with ADR-CANDIDATE-015 (owner-scoped routes — principal resolution via reactor Context for UI surface) — note the CONTRAST: UI surface uses reactor `Context` (populated by `SecurityWebFilterChain`); ingestion surface uses `WebSession.getAttribute(...)`. The platform has TWO identity-resolution architectures, deliberately separated.

**Proposed action**: Promote to `adrs/drafts/ingestion-identity-via-websession.md` (new ADR). Document the choice + the trade-offs + the cluster-deployment caveat (REFACTOR-419) + the extension pattern for future ingestion subsystems. Cross-link to ADR-CANDIDATE-015 (UI-side counterpart), ADR-CANDIDATE-027 (trust gradient), ADR-CANDIDATE-140 (asymmetric filter postures that this identity-resolution pattern implements).

**Co-surfaced gaps**: REFACTOR-419 NEW (cluster fragility), REFACTOR-420 NEW (stringly-typed key, no compile-time enforcement), REFACTOR-421 NEW (session-state-loss surfaces as 500 with `IllegalStateException`, not 401 re-auth).

**Severity rationale**: HIGH — load-bearing identity-resolution-architecture decision; single-sidecar primary source but cross-batch corroborated; affects every future ingestion subsystem's identity-handling pattern AND every clustered deployment's topology decisions.

---
