## ADR-CANDIDATE-140 — Ingestion-endpoint authentication is ASYMMETRIC by DESIGN — datasource-registration is ALWAYS-ON, data-entity-ingestion is OPT-IN, AlertManager is OPERATOR-NETWORK-DELEGATED — encoded in three different filter / non-filter registration shapes for the three `/ingestion/*` sibling paths

**Severity**: HIGH
**Classification**: promote (NEW ADR; refines ADR-CANDIDATE-027's three-tier trust gradient with the COMPLEMENTARY filter-class-asymmetry view at the controller-method tier)
**Pillars affected**: [P-09-security-access-control, P-10-integrations-ingestion]
**Support count**: 2 sidecars primary-source (batch P createDataSourceEntity + batch P postAlerts) + cross-batch confirmed by IngestionDataEntitiesFilter class-level (batch O) + IngestionDataEntitiesFilter config-key-consumer (batch B)
**Axes present**: controllers, filters, auth_mode_configurations
**Batch**: P (2026-05-20)

**Surfaced by**:
- `IngestionController__controller-method__createDataSourceEntity.md:implicit_adrs.[1]` (HIGH) — "Datasource auth is ALWAYS-ON; data-entity ingestion auth is OFF-BY-DEFAULT — deliberate asymmetry" — evidence: IngestionDataSourceFilter.java:15-20 (`@Component`, no `@ConditionalOnProperty`) vs IngestionDataEntitiesFilter.java:19-20 (`@Component` + `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` + application.yml:48 explicit `false`) — intent_anchor: "the package layout has TWO filter subclasses of `AbstractIngestionFilter` — one unconditional, one conditional. The conditional-property attribute is NOT a copy-paste oversight; it's an intentional design choice."
- `AlertManagerController__controller-method__postAlerts.md:implicit_adrs.[1]` (HIGH) — "Authentication for the AlertManager receiver is delegated to operator-side network controls (reverse proxy / mTLS / NetworkPolicy) rather than handled in-platform" — intent_anchor: "The AlertManager webhook endpoint is not authenticated. ODD Platform whitelists the entire `/ingestion/**` namespace in Spring Security…" (live doc, 2026-05-20)

**Decision statement**: The three platform-side `/ingestion/*` siblings encode three DIFFERENT auth postures via THREE DIFFERENT registration patterns:

1. `POST /ingestion/datasources` (collector boot-of-self) — defended by `IngestionDataSourceFilter` (`@Component` UNCONDITIONALLY registered, no `@ConditionalOnProperty`). Bootstrap rationale: a collector MUST be known before its datasources can register, so token-based auth must always be ON. No operator toggle.
2. `POST /ingestion/entities` (collector ongoing ingestion) — defended by `IngestionDataEntitiesFilter` (`@Component` + `@ConditionalOnProperty(havingValue="true")` with NO `matchIfMissing` AND explicit `false` default in `application.yml:48`). Opt-in rationale: datasources are payload-identified, so bootstrap chicken-and-egg doesn't apply. The deliberate explicit `false` (rather than commented-out) is the "operator must SEE this toggle" stance.
3. `POST /ingestion/alert/alertmanager` (external Prometheus AlertManager) — UNPROTECTED by any application-layer filter. Path is in `SecurityConstants.WHITELIST_PATHS[2]` (line 96); no `IngestionAlertFilter` class exists; the controller is the only ingestion controller hand-rolling its `@PostMapping`. Network-delegated rationale: AlertManager wire format is operator-driven; the platform's stance is "perimeter controls on the operator side."

The three postures encode a CONTINUUM of operator trust:
- `datasources` → MANDATORY in-platform auth (no operator toggle — bootstrap-order constraint)
- `entities` → OPT-IN in-platform auth (operator may disable for dev/demo)
- `alert/alertmanager` → ZERO in-platform auth (operator network controls only)

Adding a new `/ingestion/*` endpoint forces a deliberate choice: which posture does it inherit?

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the three patterns (UNCONDITIONAL `@Component`, conditional `@Component` + explicit YAML false, NO filter class at all + path in WHITELIST_PATHS) are EACH structurally distinct AND mutually consistent. The explicit YAML `false` is the load-bearing visibility cue; the absence of an `IngestionAlertFilter` class with the hand-rolled controller is the NON-coincidence.
2. **Structural impact?** YES — any new ingestion endpoint MUST choose where on this gradient it sits.
3. **Refactoring or structural?** STRUCTURAL — moving the AlertManager endpoint from "network-delegated" to "filter-protected" requires writing a new filter class + a new property.

**Existing ADR**: REFINES ADR-CANDIDATE-027 (three-tier trust gradient). The batch-O strengthening surfaced the trust-gradient from the IngestionDataEntitiesFilter class-level layer; THIS ADR-CANDIDATE-140 surfaces the SAME architecture from the CONTROLLER-METHOD layer of the three endpoints. The two ADR candidates are complementary: ADR-CANDIDATE-027 is the filter-class-architecture statement, ADR-CANDIDATE-140 is the per-endpoint posture-selection statement.

**Proposed action**: Promote to `adrs/drafts/ingestion-endpoint-auth-asymmetry.md` (new ADR). Document the three postures + the bootstrap-order rationale + the operator-network-delegation rationale. Cross-link to ADR-CANDIDATE-027 (trust gradient parent), ADR-CANDIDATE-006 (AlertManager network-delegated), ADR-CANDIDATE-014 (hand-rolled controller — non-contract anomaly that pairs with no-filter anomaly).

**Co-surfaced gaps**: REFACTOR-185 (DISABLED-bypass — now 17+18-sidecar with batch P contributions), REFACTOR-419 NEW (collector session-bridge cluster fragility), REFACTOR-431 NEW (no audit on datasource registration).

**Severity rationale**: HIGH — load-bearing security-architecture decision; deliberate asymmetry across three sibling endpoints; affects every operator's mental model of "is my ingestion endpoint protected?"

---
