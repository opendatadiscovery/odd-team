## REFACTOR-615 — Default `odd.platform-base-url=http://your.odd.platform` placeholder rendered into copy-pasted wizard snippets on a default deployment

**Severity**: LOW
**Category**: buggy-default / placeholder-leak
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-10 Integrations & Ingestion (the wizard's copy-paste collector setup workflow)]

**Surfaced by**:
- `odd-platform__java__IntegrationController__controller-class__IntegrationController.md:bugs_limitations_corner_cases.[2]` (LOW) — "Default `odd.platform-base-url=http://your.odd.platform` placeholder is rendered into copy-pasted wizard snippets — `application.yml:209` has the property commented out (`#  platform-base-url:`); `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")` at `StaticArgumentMappingContext.java:16` resolves to the literal placeholder. The wizard mapper substitutes this into every code-snippet argument with `parameter=\"platform_url\"` and `static: true` (`IntegrationMapper.java:38-45`). An operator running a default-config deployment, reading the wizard, copy-pasting the snippet into their collector config, would point the collector at a non-existent host."

**Statement**: `application.yml:209` has `odd.platform-base-url` commented out. `StaticArgumentMappingContext.java:16` declares `@Value("${odd.platform-base-url:http://your.odd.platform}")` which resolves to the literal placeholder `http://your.odd.platform` when the property is absent. The wizard mapper substitutes this value into every code-snippet argument with `parameter="platform_url"` and `static: true` (`IntegrationMapper.java:38-45`). An operator running a default-config deployment, reading the wizard, copy-pasting the snippet into their collector config, would point the collector at a non-existent host `http://your.odd.platform`.

The live wizard doc page (WebFetched 2026-05-25) mentions the fallback exists but does NOT warn operators that this is the default deployment state. A copy-paste audit would surface this as a confusing operator-error vector: "I followed the wizard step-by-step and my collector can't reach the platform" → root cause: the operator did not set `odd.platform-base-url`.

**Evidence**:
- `application.yml:209` (commented out)
- `StaticArgumentMappingContext.java:16` (`@Value("${odd.platform-base-url:http://your.odd.platform}")`)
- `IntegrationMapper.java:38-45` (substitution into snippet `static_value`)
- Live wizard doc WebFetched 2026-05-25 status 200 (placeholder mentioned but default-deployment state not flagged)

**Existing-ADR-or-implied-prescription**: no ADR. The implied prescription is either (a) doc-side warning, (b) boot-time WARN log when `odd.platform-base-url` resolves to the placeholder, (c) reject deployment if the property is unset.

**Proposed remedy**: Emit a `log.warn("odd.platform-base-url is unset; wizard snippets will render placeholder URL 'http://your.odd.platform'")` at startup when `StaticArgumentMappingContext`'s injected value matches the placeholder. Doc-side: the wizard doc page should be expanded with a section "Setting up `odd.platform-base-url` BEFORE using wizard snippets". Alternative remedy: throw `IllegalStateException` on startup when the property is the placeholder — strictly stronger but breaks the dev-velocity onboarding case.

**Severity rationale**: LOW — operator-induced; placeholder is recognisable (the literal `your.odd.platform` is not a real domain); the fix is doc-side primarily.

**Suggested backlog grouping**: "Integration Wizard UX completion sprint" (composes with REFACTOR-611/-612/-613/-614/-619).
