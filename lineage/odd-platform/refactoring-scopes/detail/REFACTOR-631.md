## REFACTOR-631 — `GET /api/links` is bound at BOOT and IMMUTABLE; runtime YAML / env changes to `odd.links` are silently ignored until process restart — undocumented in the live `odd-platform` configuration page

**Severity**: LOW
**Category**: missing-doc (boot-immutability)
**Pillars affected**: [P-06 Configuration & Deployment]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__LinksController__controller-class__LinksController.md:bugs_limitations_corner_cases.[4]` (LOW) — "@ConfigurationProperties bound at boot — editing YAML or env at runtime does NOT update the response. No `/actuator/refresh` is enabled by default. Operator-visible: stale links remain until container restart with no warning surface."
- `odd-platform__java__LinksController__controller-class__LinksController.md:docs_link_semantic.doc_drift_findings.[2]` — "Doc does not mention that `odd.links` is bound at boot — operators changing the YAML in a running container will not see updated links without restart."
- `odd-platform__java__LinksController__controller-class__LinksController.md:concepts.invariants.[0]` — "config is bound once at boot, list contents are static per-process lifetime"

**Description**: `AdditionalLinkProperties` is a Spring `@ConfigurationProperties("odd")` record-of-records (`AdditionalLinkProperties.java:6-9`). `LinksController` receives it as a `private final` field via constructor injection (`LinksController.java:23`). The configuration is therefore:
- Read ONCE from `application.yml` / environment at @Component instantiation (boot)
- Captured into a `final` field (the `final` modifier is the compile-time enforcement)
- Never re-read after boot

An operator who edits the running deployment's `application.yml` (e.g. via `kubectl edit configmap` or by hot-swapping a mounted config file) DOES NOT see the change reflected in `GET /api/links` responses. The operator-visible behaviour:
- Operator adds a new entry to `odd.links` in the YAML.
- Operator runs `/actuator/refresh` IF the actuator endpoint is exposed (the bundled `application.yml:228-231` does NOT expose `refresh` by default).
- IF actuator/refresh runs: Spring re-evaluates @RefreshScope beans; `AdditionalLinkProperties` is NOT @RefreshScope-annotated, so it does NOT re-read.
- IF the operator does NOT run actuator/refresh: nothing happens; the next request to `/api/links` returns the boot-time list.
- The operator may wait 5-10 minutes wondering why the change didn't take effect.

**This is the GENERAL pattern documented in ADR-CANDIDATE-213 NEW** — boot-resolved immutable config — applied to the operator-configured links surface. The Links instance is a LOW-severity manifestation (the operator's recourse is "restart the pod"); the more severe instances are the feature-flag set (FeatureController; per REFACTOR-625 NEW) and the auth-mode wiring (per batch C/D sidecars).

**The doc-drift framing**: the live `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` page (WebFetched 2026-05-25 status 200) documents `odd.links[].title` and `odd.links[].url` as configuration entries but does NOT explain:
- The values are bound at boot, not runtime
- Hot-reload via `/actuator/refresh` is not supported
- The operator must restart the deployment to see changes
- There is no UI signal explaining "you've changed the YAML; please restart" — the operator's mental model is that YAML edits take effect

**Primary source citations**:
- `AdditionalLinkProperties.java:6-9` (the @ConfigurationProperties binding)
- `LinksController.java:23` (the `final` field)
- WebFetched `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-25 status 200 (the doc that does not warn)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-213 NEW** (boot-resolved immutable config — the platform-wide pattern). This REFACTOR is the LINKS-SPECIFIC instance of the doc-disclosure gap.

**Proposed remedy**: Two-path:

1. **DOC-DISCLOSE** (preferred — the boot-immutability is intentional):
   - Update `documentation/docs/configuration-and-deployment/odd-platform.md` to add a section "Reloading configuration" that explains: (a) Spring `@ConfigurationProperties` are bound at boot; (b) the platform does NOT support `/actuator/refresh` by default; (c) operators must restart the deployment to see config changes; (d) this applies to ALL `odd.*` keys including `odd.links`, `datacollaboration.enabled`, etc. The doc-disclose addresses the operator-confusion class.
   - Add a maintainer-note in the `odd.links` config section: "Changes require a deployment restart."

2. **STRUCTURAL** (if hot-reload is the desired behaviour):
   - Add `@RefreshScope` to `AdditionalLinkProperties` and the LinksController; expose the `/actuator/refresh` endpoint by default. This is a STRUCTURAL change to the boot-immutability contract (per ADR-CANDIDATE-213 NEW), affecting EVERY `@ConfigurationProperties` class — not just Links. Would require deliberate ADR revision.

Option (1) is the cheapest fix; option (2) is the architectural alternative that requires platform-wide refactoring.

**Severity rationale**: LOW — operator-confusion, not security or correctness. The platform's boot-immutability pattern is the right default for predictable deployments; the gap is purely the doc-disclosure.

**Suggested backlog grouping**: `Documentation hardening sprint` — couple with REFACTOR-625 NEW (FeatureController SpEL no default — sibling boot-time-config issue), REFACTOR-616 (wizard registry boot-immutable — sibling pattern).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-213 NEW (the architectural framing) — this REFACTOR is the operator-actionable doc-disclosure for the Links-specific instance.
- SUPERSEDES: none.
- CONFLICTS: none.

---
