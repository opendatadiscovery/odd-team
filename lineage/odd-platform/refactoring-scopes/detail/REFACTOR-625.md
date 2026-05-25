## REFACTOR-625 — `FeatureResolverImpl` SpEL bindings use `${datacollaboration.enabled}` / `${notifications.enabled}` WITHOUT a SpEL-level default; a minimal externalised config override that removes either key BRICKS application startup with opaque `BeanCreationException`

**Severity**: LOW
**Category**: missing-default (boot-failure-risk)
**Pillars affected**: [P-06 Configuration & Deployment, P-04 Data Discovery]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:bugs_limitations_corner_cases.[5]` (LOW) — "**The two SpEL bindings (FeatureResolverImpl.java:17-18) use `${datacollaboration.enabled}` and `${notifications.enabled}` WITHOUT a SpEL-level default (e.g. `${datacollaboration.enabled:false}`).** If a downstream deployment override removes these keys without supplying a replacement, the @Component constructor fails at boot with `Could not resolve placeholder 'datacollaboration.enabled'`. The bundled application.yml supplies the defaults so stock installs are safe, but a minimal externalized config (e.g. an operator who wrote `auth.type=OAUTH2` to a new application.yml without copying the rest) would brick startup with an opaque error."
- `odd-platform__java__FeatureController__controller-class__FeatureController.md:dependencies_semantic.requires-config.[0]+[1]` — confirms the SpEL form is bare (no `:false` default)

**Description**: `FeatureResolverImpl` reads two SpEL-bound Booleans at @Component instantiation:

```java
// FeatureResolverImpl.java:16-31
public FeatureResolverImpl(
    @Value(FeatureResolver.DATA_COLLABORATION_ENABLED_PROPERTY_SPEL) Boolean dataCollaborationEnabled,
    @Value(FeatureResolver.NOTIFICATIONS_ENABLED_PROPERTY_SPEL) Boolean notificationsEnabled) {
  // ...
}
```

where the SpEL constants are (`FeatureResolver.java:6-10`):

```java
String DATA_COLLABORATION_ENABLED_PROPERTY_SPEL = "${datacollaboration.enabled}";
String NOTIFICATIONS_ENABLED_PROPERTY_SPEL = "${notifications.enabled}";
```

Both bindings are BARE `${key}` — no `:false` default expression. If the underlying property source (application.yml or an environment override) does NOT provide a value for the key, Spring's `PropertySourcesPlaceholderConfigurer` cannot resolve the placeholder and the `@Component` constructor fails at boot with `BeanCreationException: Could not resolve placeholder 'datacollaboration.enabled'`. The application fails to start; the operator sees a multi-page Spring stack trace.

**The realistic failure scenario**:
- The bundled `application.yml` ships both keys with `false` defaults (per `application.yml:172-173` and `:200-205`); stock deployments are SAFE.
- A downstream operator writes a NEW `application.yml` (or environment variable file) containing ONLY the keys they want to override (e.g. `auth.type=OAUTH2 + auth.oauth2.client.azure.*`). They do NOT copy the rest of the bundled config; the assumption is "absent keys keep their defaults."
- The Spring binding LOOKS for `datacollaboration.enabled` in their config; finds nothing; fails to resolve; aborts boot.
- The error message (`Could not resolve placeholder 'datacollaboration.enabled'`) does not identify which @Value site caused the failure, does not suggest the fix ("add `datacollaboration.enabled=false` to your config"), does not explain that the upstream YAML supplies this default.

**Sibling instances of the same shape**:
- `REFACTOR-036` — `attachment.max-file-size` (same SpEL-no-default shape; same boot-failure-risk).
- `REFACTOR-069` — `@Value("${auth.type}")` at AppInfoController.java:18 (same shape; empty-string env override silently breaks downstream `@ConditionalOnProperty` checks).
- `REFACTOR-098` — missing-key behaviour on `auth.type` across four `*SecurityConfiguration` classes (same shape; none use `matchIfMissing=true`).

The platform's convention is "configure defaults in `application.yml`, not in the SpEL `:default` suffix"; the convention works for stock deployments but breaks under externalised-config-override flows.

**Primary source citations**:
- `FeatureResolver.java:6-7, 9-10` (the SpEL constants with no `:default` suffix)
- `FeatureResolverImpl.java:17-18` (the `@Value` injection sites)
- `application.yml:172-173, 200-205` (the bundled defaults — the safety net for stock deployments)

**Existing-ADR-or-implied-prescription**: none directly. The platform's convention (per ADR-CANDIDATE-024 — configuration property naming + ADR-CANDIDATE-213 NEW — boot-resolved-immutable) implicitly assumes the bundled `application.yml` is THE source of defaults. The convention works in practice but has the externalised-config-override failure mode this REFACTOR captures.

**Proposed remedy**: Two-path:
1. **Add `:default` suffixes to SpEL** — change `${datacollaboration.enabled}` → `${datacollaboration.enabled:false}` (matching the bundled YAML default). The bindings then resolve to `false` if the key is absent from ALL property sources. The fix is one-line per binding; apply across all SpEL sites that share the shape (REFACTOR-036, REFACTOR-069, REFACTOR-098 cluster).
2. **Add a boot-time validator** (per REFACTOR-073's prescription) that pre-scans the platform's @Value-binding map and emits a fail-loud error listing every key WITHOUT a default that's absent from the current property sources. Operators get an actionable error message at boot rather than a Spring stack trace.

**Severity rationale**: LOW — bounded by how often externalised-config-override flows remove required keys without replacement (typically only in custom deployment setups). NOT a security or correctness issue; an operator-experience gap.

**Suggested backlog grouping**: `Configuration robustness sprint` — couple with REFACTOR-036 (attachment.max-file-size), REFACTOR-069 (auth.type AppInfoController), REFACTOR-098 (auth.type security configs), REFACTOR-073 (boot-time security posture validator — the cross-cutting fix would address all SpEL-no-default sites).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-036, REFACTOR-069, REFACTOR-098 (all sibling SpEL-no-default shapes); REFACTOR-073 (the boot-time validator that would catch all of them).
- SUPERSEDES: none.
- CONFLICTS: none.

---
