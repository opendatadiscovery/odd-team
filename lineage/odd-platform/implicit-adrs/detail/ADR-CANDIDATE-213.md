# ADR-CANDIDATE-213 — Feature-flag and operator-configured-catalogue state is BOOT-RESOLVED and IMMUTABLE; runtime YAML / env mutations are silently ignored until process restart

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-04 Data Discovery, P-06 Configuration & Deployment, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:implicit_adrs.[0]` (HIGH) — "**Feature-flag set is BOOT-RESOLVED and IMMUTABLE** — the resolver captures the @Value-injected booleans into a `private final Set<Feature>` in the constructor (FeatureResolverImpl.java:14, 20, 30) rather than reading the config at every call. This is an explicit decision to trade hot-reloadability for memory + per-call latency simplicity." — intent_anchor: "the constructor body builds activeFeatures into a HashSet then assigns to `this.activeFeatures = activeFeatures` (line 30); the `final` modifier on the field (line 14) makes the immutability a compile-time guarantee, not an oversight"
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:implicit_adrs.[1]` (HIGH) — "**Feature set is INTENTIONALLY NARROW** — only TWO Feature enum values (`DATA_COLLABORATION`, `ALERT_NOTIFICATIONS` at components.yaml:115-119) are exposed even though application.yml carries other feature-shaped boolean toggles (`genai.enabled`, `metrics.export.enabled`, `housekeeping.enabled`, `auth.s2s.enabled`, `auth.ingestion.filter.enabled`). The other toggles are operator-facing-only — they gate backend wiring but do not surface UI controls; the Feature enum is the contract for 'flags the UI cares about'."
- `odd-platform__java__LinksController__controller-class__LinksController.md:implicit_adrs.[0]` (HIGH) — "Operator-configured external links are a STATIC catalogue, not a runtime-mutable feature; the absence of any persistence layer or admin UI is the decision." — evidence: LinksController.java:23 (`private final AdditionalLinkProperties linkProperties`) + AdditionalLinkProperties.java:6 (`@ConfigurationProperties("odd")`) — intent_anchor: "the entire feature is implemented as a record-bound config; no DB table, no admin endpoint, no save method exists"
- Cross-link: every `*SecurityConfiguration` class (`LoginFormSecurityConfiguration`, `OAuthSecurityConfiguration`, `LDAPSecurityConfiguration`, `DisabledAuthSecurityConfiguration`) — same boot-time-immutable-binding pattern at the auth-mode layer (per batch C/D enrichments)

**Decision statement**: A class of platform state — feature flags exposed via `GET /api/features/active`, operator-configured additional-links catalogue exposed via `GET /api/links`, and the active auth-mode wiring — is resolved ONCE at application boot via Spring's `@Value` / `@ConfigurationProperties` binding and captured into `private final` fields. Subsequent mutation of the underlying YAML / environment variables (via `/actuator/refresh` if enabled, JVM system property reassignment, container env hot-swap) is NOT reflected in the responses; the platform's behaviour is frozen at boot and changes only on process restart. The decision trades hot-reloadability (which would require `@RefreshScope`, `@Scheduled` re-reading, or an in-memory invalidation event bus) for: (a) memory + per-call latency simplicity; (b) deterministic startup-time configuration validation; (c) tight coupling between the boot snapshot and the conditional bean graph (`@ConditionalOnDataCollaboration`, `@ConditionalOnNotifications`, `@ConditionalOnProperty` on every `*SecurityConfiguration`). The Feature enum is INTENTIONALLY NARROW (only the 2 UI-affecting flags out of 8+ available toggles) — the enum is the contract for "flags the UI cares about", NOT "all operator toggles."

**Wisdom test**: PASS. Three intent anchors:
1. **`final` modifier as compile-time guarantee** — `FeatureResolverImpl.java:14` declares `private final Set<Feature> activeFeatures`; the modifier is deliberate, not oversight. `LinksController.java:23` similarly declares `private final AdditionalLinkProperties linkProperties`.
2. **Constructor-time computation** — FeatureResolverImpl's constructor (lines 16-31) reads the `@Value`-bound Booleans, builds the HashSet, and assigns to the final field. The work is INTENTIONALLY done at construction; a per-call shape would require dropping `final` AND re-reading the SpEL evaluator.
3. **Asymmetric toggle exposure** — application.yml carries 8+ boolean toggles, but the Feature enum has 2 values. The asymmetry is consistent: every Feature value corresponds to a UI-visible affordance gated by a `WithFeature` wrapper (`Message.tsx:59` for DATA_COLLABORATION, `DataEntityDetailsHeader.tsx:132` for the threads, etc.). The other toggles gate backend wiring (operator-facing) and intentionally do not surface in the UI contract.

Structural impact (alters the platform's reconfiguration model: every config-shaped change requires a restart, not a hot-reload); alternative ("add `@RefreshScope` and `/actuator/refresh` support") is a structural change to the configuration-lifecycle contract, not refactoring within the existing shape.

**Operator-visible consequence — the recurring failure mode**:
- Operator edits `application.yml` to flip `datacollaboration.enabled` from `false` to `true`.
- Operator runs `/actuator/refresh` (if exposed) OR `kubectl rollout restart` (the safer path).
- IF only `/actuator/refresh` runs: `GET /api/features/active` continues to return the OLD boot-time set; the UI continues to hide the Open-in-Slack button until the next process restart.
- IF the operator restarts: behaviour changes on next boot.
- The endpoint name `getActiveFeatures` / `getLinks` implies "currently active" — a runtime view — but the implementation is a boot snapshot. **This is the DRIFT_NAME_VS_BEHAVIOR finding** the file-analyser flagged on FeatureController (`stress_findings.name_behavior_pairs.[0]`).

**Existing ADR**: composes with **ADR-CANDIDATE-024** (configuration property naming convention) — the `@ConfigurationProperties` binding choice is consistent platform-wide. NEW pattern THIS ADR codifies: the binding is BOOT-IMMUTABLE-BY-DESIGN (the `final` modifier is the structural primitive).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-625 NEW (FeatureResolverImpl SpEL has no default → boot fail if operator override removes the key)
- REFACTOR-631 NEW (LinksController boot-time immutable; runtime YAML change requires restart — undocumented in the live `odd.links` page)
- DOC-GAP — the live configuration-and-deployment/odd-platform page does NOT explain that ALL config keys are boot-resolved; an operator who reads the docs reasonably expects `enabled: true → false` toggles to take effect without restart

**Proposed action**: Promote to `adrs/drafts/boot-resolved-immutable-config.md` (new ADR). Document:
1. The boot-immutability stance with the `final`-field primitive as the structural enforcement.
2. The asymmetric exposure model: UI-affecting toggles surface as `Feature` enum values; backend-only toggles do not.
3. The operator-facing implication: ALL config-shaped changes require a process restart; no `/actuator/refresh` path is supported (and the actuator endpoint is intentionally NOT exposed by default per application.yml:228-231).
4. The maintainer's choice between "preserve the boot-immutability for simplicity" (current stance) vs "add `@RefreshScope` to selected configs" (would require dropping `final` and migrating to a thread-safe re-read shape — a structural refactor).

**Severity rationale**: HIGH — this is the deployment-lifecycle contract for the entire platform. Operators who don't understand it ship deployments where YAML edits silently no-op. The DRIFT_NAME_VS_BEHAVIOR (FeatureController) is operator-visible. The architectural cross-cut spans 8+ `@ConfigurationProperties` classes and all 4 `*SecurityConfiguration` chains.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-024 (@ConfigurationProperties naming) — adds the boot-immutability dimension.
- SUPERSEDES: none.
- CONFLICTS: none.

---
