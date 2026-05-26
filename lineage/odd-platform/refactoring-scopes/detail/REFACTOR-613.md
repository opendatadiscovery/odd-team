## REFACTOR-613 — Wizard registry case-insensitive id collision silently merges (last-load-wins) — operator-overlay merge semantics undocumented

**Severity**: LOW
**Category**: silent-merge / undocumented-behaviour
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-10 Integrations & Ingestion (the operator-overlay wizard authoring surface)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:bugs_limitations_corner_cases.[3]` (LOW) — "Case-insensitive id collision silently merges wizard YAMLs (last-load-wins) — `IntegrationRegistryFactory.java:32-37` constructs the TreeMap with `Comparator.comparing(String::toLowerCase)` (case-insensitive ordering AND duplicate-detection) and merge function `(o1, o2) -> o2` (last-wins). Two YAMLs with ids `Snowflake` and `snowflake` collapse into ONE registry entry — the later-loaded survives. With `classpath*:` scanning multiple jars, the load order is filesystem-dependent and non-deterministic across deployments. An operator overlaying their own `snowflake.yaml` to override a vendor's `Snowflake.yaml` MAY succeed or MAY not depending on jar order."

**Statement**: `IntegrationRegistryFactory.java:32-37` constructs the wizard registry as `Collectors.toMap(id -> id, identity -> manifest, (o1, o2) -> o2, () -> new TreeMap<>(Comparator.comparing(String::toLowerCase)))` — case-insensitive ordering + duplicate-detection at the TreeMap layer, last-wins merge function. Two YAMLs with case-divergent ids (`Snowflake.yaml` shipping in the vendor jar, `snowflake.yaml` in an operator overlay) silently merge into ONE registry entry; the LATER-LOADED survives. With `classpath*:` scanning across multiple jars on the classpath, the load order is filesystem-dependent and non-deterministic across deployments. An operator overlaying their own `snowflake.yaml` to override a vendor's `Snowflake.yaml` may succeed or may not, depending on jar load order. No log, no warning, no exception fires on the collision.

**Evidence**:
- `IntegrationRegistryFactory.java:32-37` (Collectors.toMap with case-insensitive comparator + last-wins merge)
- `IntegrationRegistryFactory.java:26` (`classpath*:` multi-jar scan — non-deterministic order)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-209 anchors the architectural commitment to plugin-extensibility via `classpath*:` glob; the load-order non-determinism is the price the ADR pays. The refactoring scope is a missing operator-visibility surface: a WARN log on collision, OR a documented load-order contract.

**Proposed remedy**: Emit a `log.warn("Wizard manifest id collision (case-insensitive): {} overrode {} (load order: {})", new.id, old.id, source.url)` whenever the merge function actually fires. Alternative remedy: change the merge function to throw `IllegalStateException("Duplicate wizard id (case-insensitive): " + id)` — strictly stronger boot-fail-fast but breaks the operator-overlay-override use case the maintainer may have intended. Maintainer triage decides between the two.

**Severity rationale**: LOW — requires authoring two wizards with case-divergent ids; the silent-merge is observable only by the wizard-author who notices their YAML didn't take effect. Once the case-insensitive contract is documented, operators can author defensively.

**Suggested backlog grouping**: "Integration Wizard UX completion sprint" (composes with REFACTOR-611/-612/-614/-615/-619).
