# PITFALLS — ODD ML entity taxonomy

Known failure modes for the proposed taxonomy (`ML_MODEL` group + the 4 leaves) and the #1725 fix. Each: the hazard → the mitigation in the ADR.

1. **Three "model" words confuse users** (`ML_MODEL` / `ML_MODEL_ARTIFACT` / `ML_MODEL_INSTANCE`). → Mitigation: ONE clean rule, published in the ML-entity-types doc page — *the group is the model identity; the leaves are its lifecycle stages (training job / version-artifact / deployment)*. This is only resolvable because `ML_MODEL` is a GROUP (a container), not a 4th leaf. Making `ML_MODEL` a peer consumer leaf (claude[bot]'s/the naive fix) would make the confusion **unresolvable** — three indistinguishable leaves. REJECTED in the ADR.

2. **Re-meaning the wire `ML_MODEL`** — today the ingestion contract advertises `ML_MODEL` and a collector "means the model." If `ML_MODEL` becomes the identity-GROUP, an existing consumer-shaped `ML_MODEL` payload must NOT break. → Mitigation: **shape-aware ingestion mapping** — a `data_consumer`-shaped `ML_MODEL` resolves to `ML_MODEL_ARTIFACT` (back-compat; "you sent the model object"); only a `data_entity_group`-shaped `ML_MODEL` becomes the group. Legacy senders keep working; nothing breaks.

3. **The read-back 500 class (the #1725 mechanism itself)** — there are THREE enums (ingestion contract / internal `DataEntityTypeDto` / platform-api `components.yaml`). Adding a type to one but not the others = a fresh 500 on a different path (exactly babaMar's catalog error). → Mitigation: any new type (`ML_MODEL`) is added to ALL the right surfaces in lockstep, and the ingestion `valueOf` bridge is made total (unmappable → 400, never 500), closing the whole class.

4. **Empty group** — an `ML_MODEL` group is only useful with members, and today NO collector emits `_ARTIFACT`/`_INSTANCE`/`ML_MODEL` (only SageMaker emits `_TRAINING`, mis-shaped). The group ships mostly empty until producers exist — same as `ML_EXPERIMENT`. → Mitigation: ship the *capability* + the docs; set expectations; a producing-collector path is a tracked follow-up, not a blocker.

5. **Cross-repo sequencing** — the wire contract lives in `opendatadiscovery-specification` (a separate repo → `-contracts` Maven publish → `libs.versions.toml` bump), the output enum in odd-platform's `components.yaml`, the internal enum in `DataEntityTypeDto`. Wrong order → drift/build breaks. → Mitigation: the ADR sequences it (spec → contracts → platform), and the 0.29.0 *hotfix* deliberately needs NONE of the cross-repo work (it only adds an internal mapping + the docs page) — the taxonomy/spec is the durable phase.

6. **The one existing producer is already mis-shaped** — `odd-collector-aws` SageMaker emits `ML_MODEL_TRAINING` with a `data_consumer` block (a class mismatch that should already fail validation). → Mitigation: do NOT tighten validation in a way that worsens it without fixing the collector; logged as a separate odd-collectors follow-up. The platform taxonomy change must not regress it.

7. **`ML_MODEL_INSTANCE` re-meaning is an interpretation** — ODD's enum ships NO definitions, so reading `_INSTANCE` as "deployment/serving instance" (vs "model version") is a (well-grounded) choice, not a documented fact. Risk: a hypothetical existing user read it as "version." → Mitigation: it has no producing collector (near-zero real-world data), and the ADR makes the meaning explicit + published. Low real risk, high clarity gain.

8. **Over-modeling / scope creep** — the temptation to add the full feature-store family (`mlFeature`/`mlFeatureTable`/`mlPrimaryKey`), a `Pipeline` type, aliases-as-entities, etc., all at once. → Mitigation: the ADR adds exactly ONE type (`ML_MODEL` group), keeps legacy, and DEFERS features/pipeline/alias-as-relationship to tracked follow-ups. "Subtract before you add."

9. **Breaking the live manual** — ODD docs have NO ML-types page today; a half-written one is worse than none. → Mitigation: the doc page is a first-class 0.29.0 deliverable (not an afterthought), routed on the `release/0.29.0` train, written so it evolves when the group ships.
