## REFACTOR-614 — Wizard boot fail-fast on malformed YAML — single corrupt overlay manifest aborts platform startup with no skip-and-continue

**Severity**: LOW
**Category**: missing-graceful-degradation / boot-fragility
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-10 Integrations & Ingestion (the operator-overlay wizard authoring surface)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:bugs_limitations_corner_cases.[4]` (LOW) — "Boot-time fail-fast on a single corrupt wizard YAML — `IntegrationRegistryFactory.readManifest` (`:53-61`) catches `IOException` and rethrows as `IllegalStateException` (`Couldn't read wizard manifest: %s`); `readManifests` (`:42-51`) catches the same at the scan level. A single malformed YAML in any overlay jar takes the entire application context construction down. There is no skip-broken-and-continue, no warn-and-omit semantics. An operator who adds a buggy wizard YAML to their overlay finds the platform refuses to start."

**Statement**: `IntegrationRegistryFactory.readManifest` (`:53-61`) and `readManifests` (`:42-51`) both catch IOException and rethrow as `IllegalStateException("Couldn't read wizard manifest: %s")`. A single corrupt YAML in any overlay jar takes the entire application context construction down at boot. There is no skip-broken-and-continue, no warn-and-omit semantics. An operator who adds a buggy wizard YAML to their overlay finds the platform refuses to start.

Per ADR-CANDIDATE-209, this is the deliberate architectural choice (fail-fast vs serve-incomplete-registry). The refactoring scope is whether a different trade-off — log the malformed manifest at WARN level + continue with the rest — better serves the operator-overlay use case the ADR encodes. The operator who shipped a typo in `snowflake.yaml` would prefer to know the platform booted (and that ONE wizard is missing) over a complete platform-down state.

**Evidence**:
- `IntegrationRegistryFactory.java:48-50` (scan-level IllegalStateException)
- `IntegrationRegistryFactory.java:56-60` (per-manifest IllegalStateException)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-209 anchors the fail-fast commitment. The refactoring scope is the alternative graceful-degradation trade-off; maintainer triage decides which posture better serves the wizard authoring workflow.

**Proposed remedy**: Replace the `IllegalStateException` re-throw at `IntegrationRegistryFactory.java:56-60` with a `log.warn("Couldn't read wizard manifest, skipping: {}", resource.getFilename(), ex)` + `return Optional.empty()`. The scan-level loop already handles per-file failures via stream collection; skipping the broken file lets the rest of the registry construct. Alternative remedy: keep the fail-fast posture but add a `-Dodd.platform.wizard.tolerate-malformed=true` system property switch for operator-side opt-out (the property defaults to false, preserving the current behaviour but offering an escape hatch for operators in overlay-debugging scenarios).

**Severity rationale**: LOW — operator-induced; the fail-fast is the documented intent per ADR-CANDIDATE-209; the gap is the absence of an operator-side escape hatch. The fix is small.

**Suggested backlog grouping**: "Integration Wizard UX completion sprint" (composes with REFACTOR-611/-612/-613/-615/-619).
