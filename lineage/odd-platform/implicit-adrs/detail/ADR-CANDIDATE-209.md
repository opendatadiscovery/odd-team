## ADR-CANDIDATE-209 — Integration Wizard registry is classpath-loaded, boot-constructed, read-only, and plugin-extensible via `classpath*:META-INF/wizard/*.yaml`

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate plugin-extensible documentation surface)
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-08 Management & Administration (the wizard surface lives under Management → Integrations), P-10 Integrations & Ingestion (the wizard is the docs-side discovery surface for collector configuration)]
**Support**: 1 sidecar PRIMARY SOURCE (batch-ZD IntegrationController-class) but the decision is contract-defining for the platform's documentation-overlay deployment model — confirmed by the live wizard doc page WebFetched 2026-05-25 (status 200) framing the registry as "manifests on the platform's classpath".

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:implicit_adrs.[0]` (HIGH) — "The wizard registry is classpath-loaded, read-only, and boot-time-constructed — `IntegrationRegistryFactory.createResourceFilesIntegrationRegistry()` (lines 29-40) is the only construction path; `IntegrationConfiguration` (`:7-14`) is a `@Configuration` class with a single `@Bean` method that calls the factory at boot. There is no admin API to add/remove wizards at runtime. The decision is: integrations are SHIPPED ARTIFACTS authored by integration-authors and made available via classpath overlay; they are not USER-EDITED PLATFORM STATE." — intent_anchor: "The interface itself enforces read-only — `get` returns `Mono<IntegrationOverviewDto>`, `list` returns `Flux<IntegrationPreviewDto>`; no `add`, `remove`, `update`, or `replace` methods exist. The architectural commitment to immutable-at-runtime is encoded in the type system."
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:implicit_adrs.[2]` (HIGH) — "The wizard is plugin-extensible — operators ship their own `META-INF/wizard/*.yaml` — the classpath glob `classpath*:META-INF/wizard/*.yaml` (`IntegrationRegistryFactory.java:26`) is explicitly the multi-classpath variant (`classpath*:` vs `classpath:`), which scans across ALL jars and resource roots. The decision is: wizard manifests live OUTSIDE this repo and are contributed by overlays. A default-checkout build has zero wizards." — intent_anchor: "The `classpath*:` prefix is the load-bearing decision marker — `classpath:` would scan only the local jar; `classpath*:` is Spring's multi-jar scan. The author chose the multi-jar variant deliberately for the extensibility case."
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:implicit_adrs.[4]` (HIGH) — "Boot-time fail-fast on malformed wizard YAML — `IntegrationRegistryFactory.readManifest` (`:53-61`) catches `IOException` and rethrows as `IllegalStateException(\"Couldn't read wizard manifest: %s\".formatted(resource.getFilename()))` (line 59); `readManifests` does the same at the resource-scan level (line 49). A single corrupt YAML takes the entire application context construction down at boot. The architectural choice is: fail loudly at boot rather than serve broken wizards." — intent_anchor: "Exception messages are specific ('Couldn't read wizard manifests' / 'Couldn't read wizard manifest: filename.yaml') — they are not generic platform-error text. The author chose explicit fail-fast messaging over silent-skip-on-error semantics, encoding the intent that the registry is loaded as a coherent set or not at all."

**Decision statement**: The Integration Wizard surface — `GET /api/integrations` + `GET /api/integrations/{integration_id}` — is backed by a read-only registry constructed once at application boot from a multi-jar classpath scan (`classpath*:META-INF/wizard/*.yaml`). The architectural commitments are FOUR:

1. **Classpath-loaded, not database-stored.** Wizard manifests are documentation artefacts authored by collector developers and shipped as resources in jars. There is no `integration` table; there is no admin API to add/remove/edit wizards at runtime. To change the wizard catalog, an operator rebuilds + redeploys the platform jar (or supplies a custom overlay jar) and restarts.

2. **Boot-constructed, read-only.** `IntegrationConfiguration.integrationRegistry()` (`IntegrationConfiguration.java:10-13`) invokes `IntegrationRegistryFactory.createResourceFilesIntegrationRegistry()` exactly once per application context lifecycle. The resulting `Map<String, IntegrationOverviewDto>` is immutable in practice — the `IntegrationRegistry` interface (`IntegrationRegistry.java:8-12`) declares only `get(id)` and `list()`; no write methods exist. Concurrent reads hit a stable data structure with no synchronisation overhead.

3. **Plugin-extensible via `classpath*:` glob.** The factory's resource scan uses `PathMatchingResourcePatternResolver.getResources("classpath*:META-INF/wizard/*.yaml")` — the `classpath*:` prefix (vs `classpath:`) is the load-bearing decision marker: it scans across ALL jars on the classpath, not just the local one. The deliberate architectural commitment is that wizard manifests live OUTSIDE this repo and are contributed by overlay jars (vendor packaging, docker-image overlays, operator-supplied classpath additions). A default `<odd-platform-repo>` checkout has ZERO `META-INF/wizard/*.yaml` resources (Glob across the entire repo returns zero hits) — the registry is empty by default; the wizard surface is unusable until operators overlay their own manifests.

4. **Fail-fast at boot on malformed YAML.** A single corrupt manifest aborts the entire application context construction. `IntegrationRegistryFactory.readManifest` (`:53-61`) catches `IOException` and rethrows as `IllegalStateException("Couldn't read wizard manifest: %s".formatted(resource.getFilename()))`; `readManifests` does the same at the scan level. The decision is loud-failure-at-boot vs silent-skip-on-error semantics — operators learn about authoring errors immediately and platform-wide, not later via a 204 No Content from an unreachable wizard.

The decision delivers ONE coherent property: **operators can extend the documentation surface without recompiling the platform, but cannot mutate it at runtime**. The trade-off accepted: changing the wizard catalog requires a restart (no admin API); a buggy overlay manifest crashes the entire platform at boot; there is no per-tenant / per-organisation wizard scoping (the registry is a flat global namespace).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — four independent commitments visible at the type-system level: the read-only `IntegrationRegistry` interface (no write methods), the `classpath*:` (vs `classpath:`) deliberate prefix, the `@Bean` single-construction model, the explicit fail-fast exception messaging at `IllegalStateException("Couldn't read wizard manifest: %s")`. The pattern is encoded as DESIGN, not implementation oversight.
2. **Structural impact?** YES — defines the entire deployment-extension model for the documentation surface. Adopting alternative models (database-backed wizards, runtime admin API, lazy load on first request) would require a structural rewrite.
3. **Addition vs structural change?** Adding a database-backed wizard CRUD surface would be a STRUCTURAL change (new schema, new repository, new service interface) — not a refactor of the existing classpath-load. The current architecture is a positive structural choice.

**Evidence**:
- IntegrationController.md says: "`IntegrationRegistryFactory.java:26` (`classpath*:META-INF/wizard/*.yaml` glob)"
- IntegrationController.md says: "`IntegrationConfiguration.java:7-14` (single `@Bean` method that calls the factory at boot)"
- IntegrationController.md says: "`IntegrationRegistry.java:8-12` (interface declares only `get` and `list`, no write methods)"
- IntegrationController.md says: "`IntegrationRegistryFactory.java:48-50, 56-60` (fail-fast on malformed YAML)"
- IntegrationController.md says: "Glob `<odd-platform-repo>/**/META-INF/wizard/*.yaml` returns zero hits — default-checkout registry is empty"
- Live wizard doc page WebFetched 2026-05-25 status 200: "An in-app UI under Management → Integrations that generates parameterized YAML snippets for plugins, leveraging 'manifests on the platform's classpath'."

**Existing ADR**: none. Composes with ADR-CANDIDATE-001 (controllers-as-delegates — the IntegrationController is a 28-line thin proxy) and ADR-CANDIDATE-018 (fail-fast at boot — wizard malformed-YAML failure mode is the fifth surface in that family alongside Slack OAuth, EmailSender, LDAP, DataCollab). Composes with ADR-CANDIDATE-122 (catalog-wide facet counts — both are catalog-wide aggregate endpoints with no permission gate).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-611 NEW (the `installed: false` constant — required-but-meaningless OpenAPI field)
- REFACTOR-612 NEW (`GET /api/integrations/{id}` returns 204 not 404 on unknown id — undocumented contract)
- REFACTOR-613 NEW (case-insensitive id collision silently merges — last-load-wins)
- REFACTOR-614 NEW (boot fail-fast on malformed YAML — single corrupt manifest crashes the platform)
- REFACTOR-615 NEW (`odd.platform-base-url` placeholder substituted into copy-pasted snippets on default config)
- REFACTOR-616 NEW (DISABLED-mode anonymous read leaks `platform_url`)
- REFACTOR-619 NEW (wizard surface is platform-public-by-design but undocumented anywhere)

**Proposed action**: Promote to `adrs/drafts/integration-wizard-classpath-registry.md` (new ADR). Document the four architectural commitments + the canonical exception messages + the operator workflow (overlay jar + restart vs admin API). Cross-link with ADR-CANDIDATE-001 (controllers-as-delegates) and ADR-CANDIDATE-018 (fail-fast at boot) as the broader patterns this ADR embodies. Doc-side: the live wizard doc page should be expanded to document (a) the default-empty state of a fresh checkout, (b) the case-insensitive-collision merge semantics, (c) the boot-fail-fast behaviour, (d) the absence of a runtime admin API.

**Severity rationale**: HIGH — deployment-architecture decision defining how operators extend ODD's documentation surface. A future PR proposing to move wizard storage to a DB table or add an admin-API would be a structural change against this ADR; a future maintainer cannot make a compatible change without knowing the classpath-overlay assumption.

## STRENGTHENS — none (initial entry)

## STRENGTHENS — Batch ZD (IntegrationController-class — primary source)

This is the primary source. The decision is anchored at the single-sidecar level but the four architectural commitments cross-validate each other (read-only interface + classpath*: glob + @Bean single construction + fail-fast messaging) — the unique-load-bearing classification applies because changing any one of the four commitments is a structural change to the deployment-extension surface.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-018 (fail-fast at boot — wizard manifest is the 5th surface in the family).
- SUPERSEDES: none.
- CONFLICTS: none.
