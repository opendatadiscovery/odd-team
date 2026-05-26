## STRENGTHENS ADR-CANDIDATE-213 — AdditionalLinkProperties (batch ZK, 2026-05-26) at file-analyser/0.5.0

**Properties-class-side primary-source confirmation + name-vs-behavior drift framing**. ADR-213 (boot-resolved immutable config) was promoted in batch ZE from controller-side sidecars (FeatureController, LinksController). The batch-ZK re-enrichment of `AdditionalLinkProperties` at the higher prompt-version (`file-analyser/0.5.0`, with new stress_findings + DRIFT_INPUT_NAME_VS_IMPLEMENTATION analysis) ADDS the properties-class-side intent anchor AND the explicit name-vs-behavior drift framing that ADR-213 previously surfaced as "the DRIFT_NAME_VS_BEHAVIOR finding the file-analyser flagged on FeatureController".

**New batch-ZK evidence**:
- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:implicit_adrs.[0]` (HIGH confidence) — "Operator-configurable additional links are a STATIC configuration surface, not a runtime-mutable feature; the use of `@ConfigurationProperties` (vs a JPA entity or admin endpoint) IS the decision." — intent_anchor: "the entire feature is implemented as a record-bound config — no entity class, no repository, no controller mutator; the choice of @ConfigurationProperties over a CRUD persistence layer is itself an architectural statement about the audience (operator, not end-user)"
- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:implicit_adrs.[1]` (HIGH confidence) — "Links are modelled as an IMMUTABLE record-of-records — the type system itself encodes the boot-time-immutable, no-mutation contract; downstream consumers cannot accidentally mutate the catalogue." — intent_anchor: "Java records are final and immutable by language design; choosing record over POJO is a deliberate signal that this configuration is read-only for the lifetime of the JVM"

**Strengthens-by-extending evidence for ADR-213's "boot-immutable-by-design" thesis**: the AdditionalLinkProperties sidecar reveals the choice is DOUBLE-LAYERED:
- Layer 1 (the CONSUMER side, already covered by ADR-213): `LinksController.java:23` declares `private final AdditionalLinkProperties linkProperties` — the `final` modifier on the consumer's field is the compile-time enforcement.
- Layer 2 (NEW from AdditionalLinkProperties batch ZK): the PROPERTIES class itself is a Java `record` (`AdditionalLinkProperties.java:7-9`). Records are immutable by language design — final fields, no setters, compact constructor pattern only. The properties-class-side choice encodes immutability at the type-system level, not just at the consumer's field-modifier level.

**This is the SECOND-LAYER intent anchor** for ADR-213: not just `final` consumer fields, but a `record` properties class. A future refactor that converted `AdditionalLinkProperties` from a record to a `@Data`-annotated POJO would silently introduce setters and lose Layer-2 immutability while preserving Layer-1 (the consumer's `final` field would still hold the same reference, but the underlying object would gain mutation paths).

**New batch-ZK stress_findings — explicit DRIFT framing**:
- `AdditionalLinkProperties.md:stress_findings.request_inputs[1]` (the `url` field) flags `DRIFT_INPUT_NAME_VS_IMPLEMENTATION`: "the name 'url' promises a URL (schema-conformant http(s) by reasonable interpretation); the implementation accepts ANY String including `javascript:alert(1)`, `data:text/html,<script>...</script>`, `file:///etc/passwd`, `vbscript:`, malformed strings, empty strings, and null." This DRIFT is NOT the same as ADR-213's `DRIFT_NAME_VS_BEHAVIOR` on FeatureController's endpoint (`getActiveFeatures` — boot snapshot vs runtime view). The two drifts are SEPARATE concerns: ADR-213's drift is at the endpoint-lifecycle layer; the AdditionalLinkProperties drift is at the field-validation layer. Both are operator-visible failures of the boot-immutable surface — surfaced as REFACTOR-630 (already exists; strengthened separately).

**Cross-batch ADR-213 evidence chain**:
- batch ZE (FeatureController): `getActiveFeatures` DRIFT_NAME_VS_BEHAVIOR — endpoint name implies runtime view, implementation is boot snapshot
- batch ZE (LinksController): `linkProperties` final field — Layer 1 immutability
- batch ZK (AdditionalLinkProperties): `record AdditionalLinkProperties(List<Link> links)` — Layer 2 immutability at the type-system level; second intent anchor for boot-immutable-by-design

**Severity unchanged**: HIGH (deployment-lifecycle contract for the entire platform — affects every `@ConfigurationProperties` class).

---
