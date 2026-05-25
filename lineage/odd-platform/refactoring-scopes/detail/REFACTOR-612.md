## REFACTOR-612 — `GET /api/integrations/{integration_id}` returns 204 No Content (not 404) on unknown id; undocumented in the OpenAPI contract

**Severity**: MEDIUM
**Category**: status-code-semantics / contract-typo
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-10 Integrations & Ingestion (the Integration Wizard API surface)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "`getIntegration({unknown-id})` returns 204 No Content (not 404) — `ResourceFilesIntegrationRegistry.java:15-17` `Mono.justOrEmpty(registry.get(id))` returns `Mono.empty` on missing-id; the `.map(integration -> integrationMapper.map(integration, ...))` is short-circuited; the controller's `Mono.empty.map(ResponseEntity::ok)` produces `Mono.empty`; Spring WebFlux's reactive controller-return semantics translate that to `204 No Content`. The OpenAPI declares only the `200` response (`openapi.yaml:75-81`); no `404` is contracted. Operators cannot distinguish 'integration exists but has empty body' (currently impossible — non-existent state) from 'integration does not exist'."

**Statement**: When a caller invokes `GET /api/integrations/{unknown-id}`, the registry's `Mono.justOrEmpty(registry.get(id))` returns `Mono.empty`; the `.map(...)` is short-circuited; Spring WebFlux translates `Mono.empty` from the controller into HTTP 204 No Content. The OpenAPI contract at `openapi.yaml:75-81` declares ONLY a 200 response shape; no 404 is contracted. Operators cannot distinguish two cases at the HTTP layer:
- "integration exists but has empty body" (currently impossible — wizard manifests always have content blocks)
- "integration does not exist"

Compare to most other GET-by-id endpoints in this codebase (e.g. `MetadataFieldServiceImpl.get` throws `NotFoundException` on missing field at `:30-34`); the wizard surface is inconsistent with the platform's wider convention.

Third-party SDK generators compiled from `openapi.yaml` typically auto-generate response handlers that don't expect 204 on a path declared to return 200. The mismatch silently breaks generated clients.

**Evidence**:
- `IntegrationController.java:19-22` (the controller body)
- `IntegrationServiceImpl.java:20-23` (the delegation chain)
- `ResourceFilesIntegrationRegistry.java:15-17` (`Mono.justOrEmpty`)
- `openapi.yaml:75-81` (only 200 declared)

**Existing-ADR-or-implied-prescription**: no ADR. The implied prescription from the codebase-wide pattern is "missing-by-id should be 404 with `NotFoundException` → ControllerAdvice → USR002". The wizard registry is the outlier.

**Proposed remedy**: Add `.switchIfEmpty(Mono.error(new NotFoundException(...)))` to `IntegrationServiceImpl.get` (`IntegrationServiceImpl.java:20-23`). ControllerAdvice already handles NotFoundException → 404 USR002 — no other code change required. Update `openapi.yaml:75-81` to enumerate the 404 response shape. Optional: add the `switchIfEmpty` at the `ResourceFilesIntegrationRegistry.get` layer instead, for consistency with the wider repository pattern — but the service-layer fix is simpler.

**Severity rationale**: MEDIUM — affects SDK clients more than UI clients (the UI's `useIntegration` hook tolerates either status code); the contract mismatch is invisible until a third-party operator writes their own automation. The fix is one line + a spec update.

**Suggested backlog grouping**: "Integration Wizard UX completion sprint" (composes with REFACTOR-611 + REFACTOR-613 + REFACTOR-614 + REFACTOR-615 + REFACTOR-619).
