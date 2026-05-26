## STRENGTHENS REFACTOR-631 — AdditionalLinkProperties (batch ZK, 2026-05-26) at file-analyser/0.5.0

**Properties-class-side primary-source confirmation of boot-immutability**. REFACTOR-631 was minted in batch ZE from the LinksController sidecar's framing. The batch-ZK re-enrichment of AdditionalLinkProperties at file-analyser/0.5.0 ADDS the **type-system-level immutability** evidence (the Java `record` declaration is the structural enforcement, NOT just the consumer's `final` field) and the maintainer-intent framing for "STATIC configuration surface, not a runtime-mutable feature".

**New batch-ZK evidence**:
- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:implicit_adrs.[0]` (HIGH confidence) — "Operator-configurable additional links are a STATIC configuration surface, not a runtime-mutable feature; the use of `@ConfigurationProperties` (vs a JPA entity or admin endpoint) IS the decision." — intent_anchor: "the entire feature is implemented as a record-bound config — no entity class, no repository, no controller mutator; the choice of @ConfigurationProperties over a CRUD persistence layer is itself an architectural statement about the audience (operator, not end-user)"

- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:implicit_adrs.[1]` (HIGH confidence) — "Links are modelled as an IMMUTABLE record-of-records — the type system itself encodes the boot-time-immutable, no-mutation contract; downstream consumers cannot accidentally mutate the catalogue." — intent_anchor: "Java records are final and immutable by language design; choosing record over POJO is a deliberate signal that this configuration is read-only for the lifetime of the JVM"

- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:docs_link_semantic.doc_drift_findings.[2]`: "Doc page describes the config without warning that the binding is BOOT-TIME ONLY — editing `odd.links` in a running container produces no observable change until restart. The documentation page is silent on the restart requirement."

- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:stress_findings.resource_boundaries[0]` (concurrency angle): "'The "staleness window" that DOES apply is the BOOT-TIME-BIND immutability: the record reflects the YAML / env at boot time only; runtime YAML edits are invisible until restart.'"

**What batch ZK adds (vs batch-ZE's framing already in REFACTOR-631)**:

1. **Type-system-level immutability is the deliberate intent anchor**: batch ZE framed the boot-immutability via `LinksController.java:23`'s `private final AdditionalLinkProperties linkProperties` (a `final` consumer field). Batch ZK adds the upstream layer: the properties class itself is declared as a Java `record` (`AdditionalLinkProperties.java:7-9`). The `record` keyword encodes immutability at the type-system level — final fields, no setters generated, compact-constructor-only pattern. A future refactor that converted the `record` to a `@Data`-annotated POJO would silently introduce setters and lose the type-system immutability while preserving the consumer's `final` field. The two-layer enforcement (record + final consumer field) is the deliberate platform-wide pattern that ADR-CANDIDATE-213 codifies.

2. **The "@ConfigurationProperties vs CRUD persistence" framing is explicit**: batch ZK's intent_anchor reads "no entity class, no repository, no controller mutator". The maintainer's choice WAS to make this a STATIC config surface — not a runtime-mutable feature with persistence. An operator might reasonably ask "why isn't there an admin UI to manage these links?"; the answer (per the implicit ADR) is that the audience is the OPERATOR (who edits YAML at deploy time), not the END-USER (who interacts via UI). The decision affects how future "links" features should be authored:
   - If the new feature's audience is end-users: build a CRUD persistence layer with admin UI (e.g. the wizard registry, the alert-notification subscribers — both are persistence-based).
   - If the audience is operators: extend `@ConfigurationProperties` (this pattern).

3. **The doc-drift framing is sharpened**: batch ZE's REFACTOR-631 framed the doc-disclose gap. Batch ZK confirms from the properties-class side that the boot-immutability is INTENTIONAL (per the `record` + `@ConfigurationProperties` choice) — meaning the right remedy is `DOC-DISCLOSE` (Option 1 in REFACTOR-631), NOT the structural `@RefreshScope` migration (Option 2). The architectural intent supports Option 1; the maintainer should NOT migrate to runtime-mutable without first reconsidering the audience-targeting decision.

**Cross-batch evidence chain for REFACTOR-631**:
- batch ZE (LinksController): consumer-side `final` field + endpoint behaviour
- batch ZK (AdditionalLinkProperties at file-analyser/0.5.0): type-system-level `record` immutability + the maintainer's audience-targeting intent

**Severity unchanged**: LOW (operator-confusion / doc-disclose; not security or correctness). The new evidence does NOT raise the severity — it CONFIRMS that the proposed Option-1 remedy (DOC-DISCLOSE) is the right choice consistent with the architectural intent.

---
