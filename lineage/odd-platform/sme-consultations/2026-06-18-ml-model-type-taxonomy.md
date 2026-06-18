---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-18T00:00:00Z
consulted_by: maintainer-direct
consultation_question: "What should each ML data-entity type (ML_MODEL / ML_MODEL_TRAINING / ML_MODEL_INSTANCE / ML_MODEL_ARTIFACT) mean to a user; should ML_MODEL be a peer DATA_CONSUMER type or a DATA_ENTITY_GROUP; and is the bounded map-to-ARTIFACT fix semantically honest?"
slug: ml-model-type-taxonomy
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# ML data-entity-type taxonomy — settling ML_MODEL / _TRAINING / _INSTANCE / _ARTIFACT from the user's standpoint

## TL;DR

ODD's three ML subtypes map cleanly onto the lifecycle vocabulary every ML practitioner already brings from MLflow / SageMaker / DataHub: **`ML_MODEL_TRAINING`** is the *job that trains* a model (a transformer: features in → model out), **`ML_MODEL_ARTIFACT`** is the *trained model object* that gets consumed, and **`ML_MODEL_INSTANCE`** is a *deployed/serving instance* of that model. The plain ingested `ML_MODEL` has no honest internal peer because it is an underspecified umbrella — collectors send it, the platform has nowhere to put it, hence the 500. **My recommendation on Q2: do NOT promote `ML_MODEL` to a new peer DATA_CONSUMER type. Make `ML_MODEL` a `DATA_ENTITY_GROUP`** — exactly as `ML_EXPERIMENT` already is — so it becomes the lifecycle container that groups the TRAINING job, the ARTIFACT, and the INSTANCE under one navigable model identity. This is the only option that matches what users expect (DataHub's `mlModelGroup`, MLflow's *registered model*, SageMaker's *Model Group*) AND is consistent with ODD's own model. **On Q3: the bounded map-to-`ML_MODEL_ARTIFACT` fix is *semantically defensible but not fully honest*** — a `DataConsumer` payload (inputs-only) is correctly an artifact-shaped consumer, but silently rewriting the operator's declared type is a lossy guess the docs must disclose explicitly.

## Question scope

Archetypes: **vocabulary** (what does the industry call each lifecycle stage) + **plausibility/modelling** (peer-type vs group) + **implicit-requirements** (what the docs must say after a lossy map). The maintainer asked for a definitive taxonomy that never has to be revisited, grounded in real ML-platform and data-catalog vocabulary.

In scope: the user-facing meaning of the four ML types; the peer-type-vs-group decision; the honesty of the bounded fix.

Out of scope (named, not answered here): the wire-contract change to *add* `_INSTANCE`/`_ARTIFACT`/the group to `specification/entities.yaml` (a spec-repo PR, separate from the platform 500 fix); whether to ship a producing collector for `_INSTANCE`/`_ARTIFACT` (today only SageMaker emits `_TRAINING`); and `mlFeature`/feature-store modelling (ODD has `FEATURE_GROUP`, a distinct lineage question).

## Domain plausibility

The four-stage model is not an ODD invention — it is the **de-facto ML-lifecycle decomposition** that every catalog and registry converged on. The relevant operator is a **data-scientist / ML-engineer using ODD to trace a model's lineage and blast radius** (the `data-scientist-ml-engineer` audience; ODD's README claims "ML first citizen" and "Auto-generated ML experiment lineage and metadata" as a differentiator — `documentation/docs/README.md` lines 3-9 per `system-mission.md:67`).

Mapping ODD's types onto the vocabulary users arrive with:

- **The training job is its own entity.** SageMaker: "Create an ML pipeline that trains a model… For each run of the ML pipeline, create a model version" — the training *run* is distinct from the model it produces (`docs.aws.amazon.com/sagemaker/latest/dg/model-registry.html`, verified 200). This is exactly `ML_MODEL_TRAINING`, and it is correctly a **transformer** (features in, model out).
- **The trained artifact is its own entity.** DataHub: "while an ML model represents the trained artifact, a deployment represents a specific instance of that model serving predictions" (`docs.datahub.com/docs/generated/metamodel/entities/mlmodeldeployment`, verified 200). DataHub's `mlModel` "Represents the trained model artifact itself, including training data, metrics, and hyperparameters" — that is ODD's `ML_MODEL_ARTIFACT`, and it is correctly a **consumer** (it has inputs — the features/data it was trained on — but no further data outputs).
- **The deployed instance is its own entity.** DataHub `mlModelDeployment`: "deployed instances of machine learning models running in production or other environments… deployment status, platform, configuration, and lifecycle" (same source). That is ODD's `ML_MODEL_INSTANCE`.
- **The umbrella/registry identity is its own entity.** MLflow: "A registered model has a unique name, contains versions, aliases, tags… Each registered model can have one or many versions" (`mlflow.org/docs/latest/ml/model-registry/`, verified 200). SageMaker Model Group "tracks all of the models that you train to solve a particular problem." DataHub `mlModelGroup`: "organizes related models into logical families or collections" via a `MemberOf` relationship (`docs.datahub.com/docs/generated/metamodel/entities/mlmodel`, verified 200). **This umbrella is the natural home for ODD's plain `ML_MODEL`** — and a registry/group is a *container*, not a consumer.

**Verdict: HIGH-PLAUSIBILITY.** The three subtypes are individually well-formed and match industry vocabulary one-for-one. The plain `ML_MODEL` is plausible **only as a grouping container**, not as a fourth leaf consumer — see Q2.

## Industry vocabulary alignment

Canonical industry terms (cited) → ODD's type:

| Lifecycle stage | MLflow | SageMaker | DataHub | OpenMetadata | ODD type |
|---|---|---|---|---|---|
| The job that trains the model | a *run* that logs a model | *Training Job* / pipeline run | (run lineage) | (pipeline) | `ML_MODEL_TRAINING` |
| The trained model object | a logged *Model* / *Model Version* | *Model Package* (version) | `mlModel` (the trained artifact) | `MlModel` | `ML_MODEL_ARTIFACT` |
| A deployed serving instance | model behind an *alias* (`@champion`) | deployed *Model* / endpoint | `mlModelDeployment` | (server/endpoint field on `MlModel`) | `ML_MODEL_INSTANCE` |
| The named umbrella across versions | *Registered Model* | *Model (Package) Group* | `mlModelGroup` | (one `MlModel` rolls these up) | **`ML_MODEL` → should be a group** |
| A grouped set of training runs | *Experiment* | *Experiment* | (run grouping) | — | `ML_EXPERIMENT` (already a GROUP) |

ODD's term per `concepts.yaml`: **none** — `concepts.yaml` has no ML-model concept entry at all (grep for `ML_MODEL`/`ML_EXPERIMENT`/`machine.learning` returned no matches, 2026-06-18). This is itself a vocabulary gap worth logging: ODD claims "ML first citizen" but neither the published docs nor the workspace concept catalog define the ML types.

The two key alignment observations:

1. **MLflow and OpenMetadata collapse the registry-identity and the artifact into one concept** (a "registered model" *is* the thing that has versions; OpenMetadata ships a single `MlModel`). **DataHub and SageMaker split them** — `mlModelGroup`/Model-Group is the container, `mlModel`/Model-Package is the version. ODD already chose the *split* model (it has `ML_EXPERIMENT` as a group, and three distinct leaf types). So ODD should align to the **DataHub/SageMaker split**, which means `ML_MODEL` is the group, not a leaf.
2. **No vendor calls the deployed thing and the trained thing the same entity.** "Model deployments are distinct from ML models themselves" (DataHub, verified). ODD's `_ARTIFACT` vs `_INSTANCE` split is therefore *correct and expected* — users will not be surprised by it.

**Recommended alignment: re-align `ML_MODEL` from a leaf type to a group (DATA_ENTITY_GROUP); preserve `_TRAINING`/`_ARTIFACT`/`_INSTANCE` as-is.** Reasoning: it makes ODD's vocabulary isomorphic to the split model users already know from DataHub and SageMaker, and reuses ODD's existing group primitive rather than inventing a fourth leaf.

## User-facing TAXONOMY TABLE

| ODD type | Plain-English definition | ODD class | Real-world ML artifact | Closest MLflow / SageMaker / DataHub equivalent | How a user should treat it | Caveat |
|---|---|---|---|---|---|---|
| **`ML_MODEL_TRAINING`** | The *training job* that produced a model — reads features/datasets, emits a model. | `DATA_TRANSFORMER` (inputs + outputs) | A training run / training pipeline step | MLflow *run* · SageMaker *Training Job* · DataHub training-run lineage | As a transformer node in lineage: "what data trained this model?" Trace upstream to the feature sets. | The only ML type with a real producing collector today (SageMaker). The transformer has both inputs (training data) and outputs (the model artifact). |
| **`ML_MODEL_ARTIFACT`** | The *trained model object* — the serialized model that consumes features at inference. | `DATA_CONSUMER` (inputs only) | A versioned model binary / model package | MLflow *Model Version* · SageMaker *Model Package* · DataHub `mlModel` | As the model itself: read its inputs (features it depends on), its owner, its quality. It is a leaf consumer — nothing flows out of it in the catalog. | No producing collector emits this today. "Consumer" is the honest class: an artifact is fed features; it does not transform data into a new dataset. |
| **`ML_MODEL_INSTANCE`** | A *deployed/serving instance* of a model in some environment (prod/staging). | `DATA_TRANSFORMER` (inputs + outputs) | A model serving endpoint / running deployment | MLflow alias (`@champion`) · SageMaker endpoint · DataHub `mlModelDeployment` | As the runtime: "which deployment is serving, what does it consume, what does it emit (predictions)?" One artifact can have many instances. | No producing collector today. Classed as a transformer because a *serving* instance consumes features and produces predictions (a downstream dataset); distinct from the static artifact. |
| **`ML_EXPERIMENT`** (existing) | A logical grouping of training runs exploring one problem. | `DATA_ENTITY_GROUP` (container) | An experiment tracking multiple runs | MLflow *Experiment* · SageMaker *Experiment* | As a folder: open it to see the runs/models inside; navigate group lineage across members. | Already correctly a group — the precedent for treating `ML_MODEL` the same way. |
| **`ML_MODEL`** (proposed re-classification) | The *named model identity* across its whole lifecycle — the umbrella that groups its training job, artifact versions, and deployments. | **`DATA_ENTITY_GROUP`** (recommended) | A registered model / model family | MLflow *Registered Model* · SageMaker *Model (Package) Group* · DataHub `mlModelGroup` | As the one stable thing a user searches for ("the churn model") and from which they navigate to every lifecycle stage. | Today `ML_MODEL` exists in the *wire contract* but has no internal type → 500. Modelling it as a group (not a leaf) is what lets ODD build lifecycle lineage. |

## Q2 RECOMMENDATION — peer DATA_CONSUMER type vs DATA_ENTITY_GROUP

**Recommendation: model `ML_MODEL` as a `DATA_ENTITY_GROUP`, not as a peer leaf type in `DATA_CONSUMER`.** Confidence: HIGH.

Reasoning, weighed as the two options the maintainer posed:

**Option (a) — `ML_MODEL` as a peer `DATA_CONSUMER` leaf** (a deployed model that consumes features):
- *Pro:* smallest change; a deployed model does consume features, so the class is not wrong.
- *Con — fatal:* it **duplicates `ML_MODEL_ARTIFACT`** (also a consumer-class leaf) and **overlaps `ML_MODEL_INSTANCE`** (the actually-deployed thing). A user would face three near-synonyms — `ML_MODEL`, `ML_MODEL_ARTIFACT`, `ML_MODEL_INSTANCE` — all leaf-shaped, with no rule for which to pick. That is precisely the confusion DataHub avoided by making `mlModelGroup` a *container* and `mlModel`/`mlModelDeployment` the leaves. A fourth leaf makes the taxonomy *worse*, not better.
- *Con:* it forecloses lineage-across-lifecycle. A leaf cannot *contain* its training job and its deployments; it can only sit beside them as another node.

**Option (b) — `ML_MODEL` as a `DATA_ENTITY_GROUP`** (aggregates TRAINING / ARTIFACT / INSTANCE):
- *Pro — decisive:* it matches the **exact mental model users import** — MLflow's *registered model* "contains versions," SageMaker's *Model Group* "tracks all of the models that you train to solve a particular problem," DataHub's `mlModelGroup` "organizes related models into logical families" via `MemberOf` (all verified above). Users already expect a model to be a *container of versions/stages*, not a single leaf.
- *Pro:* it is **consistent with ODD's own model** — `ML_EXPERIMENT` is already a `DATA_ENTITY_GROUP`, and DEGs/Domains are first-class grouping primitives (`system-mission.md:80,94`). ODD has the machinery (group lineage endpoint, group detail page — P-05 Data Lineage sub-feature "group-level" lineage) ready to use.
- *Pro:* it **unlocks the feature the maintainer flagged** — lifecycle lineage/grouping. A user lands on "the churn model" group and walks: training job → artifact v3 → prod instance, end-to-end. That is the "ML first citizen" promise made concrete.
- *Con:* a group needs members to be useful, and today only `ML_MODEL_TRAINING` has a producing collector. So the group ships mostly empty until `_ARTIFACT`/`_INSTANCE` producers exist. This is a *real* limitation but not a blocker — `ML_EXPERIMENT` faces the same dependency and ships anyway.

**User-facing consequence of each:** Option (a) gives the user three indistinguishable "model" leaves and a flat catalog. Option (b) gives the user one searchable model identity that *opens up* into its lifecycle — the difference between "I found a row called my model" and "I found my model and can trace it from training data to production endpoint." Option (b) is the only one that pays off ODD's ML-first-citizen claim.

## Q3 RECOMMENDATION — is the bounded map-to-ARTIFACT fix honest, and what must the docs say?

**Verdict: semantically defensible, not fully honest — ship it as a stop-the-500 measure, but disclose it.** Confidence: HIGH.

The bounded fix maps an ingested `ML_MODEL` payload to internal `ML_MODEL_ARTIFACT`. Is that honest for a payload?

- **The class is right.** The ODD spec's `DataConsumer` schema has only `inputs` (verified verbatim from `specification/entities.yaml`: `DataConsumer: properties: inputs: {type: array...}` — no outputs), while `DataTransformer` requires both `inputs` and `outputs`. So a `ML_MODEL` arriving as a `data_consumer` with `inputs` is structurally an artifact-shaped consumer, and `ML_MODEL_ARTIFACT` is also a `DATA_CONSUMER`. The class does not lie. **However**, this is only honest *if the payload actually arrives shaped as a `data_consumer`*; if a producer sends `ML_MODEL` shaped as a `data_transformer` (inputs+outputs), mapping it to the consumer-class `_ARTIFACT` would *drop its outputs* and silently break its downstream lineage. The fix must therefore key off the payload's entity-shape, not blindly rewrite the type. (Verify against the actual producer payloads; today none but SageMaker emit ML types, and SageMaker emits `_TRAINING`, so the live blast radius is small — but the contract permits `ML_MODEL` from any custom collector.)
- **The identity is a guess.** A producer that declared "this is THE model" gets silently re-labelled "this is the model's *artifact*." Under Option (b) above, the honest target for a bare `ML_MODEL` is the *group*, not the artifact leaf — so the bounded fix encodes a choice the maintainer may reverse. That is acceptable for a hotfix *if it is reversible and disclosed*.

**What the docs must say** (this is the implicit requirement — without it the fix becomes the next LSN-class "docs lied" trap):
1. **State the mapping explicitly** on the ingestion/entity-types reference page: "A payload with `type: ML_MODEL` is ingested as an `ML_MODEL_ARTIFACT` (a data consumer). ODD does not currently have a distinct `ML_MODEL` entity; use `ML_MODEL_TRAINING` for training jobs."
2. **Disclose the lossiness:** if the payload carried outputs (transformer-shaped), say what happens to them.
3. **Define all the ML types in one published place** — there is *no* such page today (verified: `docs.opendatadiscovery.org/features/data-modelling` has zero ML vocabulary, 200). This is the root user-confusion source and should be a tracked DOC follow-up regardless of which code fix ships.
4. If Option (b) is later adopted, the docs note becomes "deprecated: `ML_MODEL` payloads now create a model group" — so write the note in a way that can evolve.

## Operator workflows this feature participates in

- **Trace blast radius before a schema change** (data-engineer): "if I change this feature table, which models break?" — requires the model to be a navigable lineage node. Option (b)'s group makes "the model" the thing you trace *to*; the TRAINING transformer makes "what trained it" the thing you trace *through*.
- **Discover/diagnose a model** (data-scientist-ml-engineer, the ML-first-citizen audience): search "churn model," land on the model identity, see its training data, its current prod instance, its quality signals, its owner. Only the group framing makes this a single landing surface.
- **Onboard a new ML source** (platform-operator + integration-author): register the SageMaker collector; today it emits `ML_MODEL_TRAINING`. The 500 is hit the moment any collector (custom or future) emits the contract-legal `ML_MODEL` — so the fix is on the onboarding path, not a rare edge.

## Competitor comparison

| System | Equivalent feature | Notable behaviour | URL (verified 200) |
|---|---|---|---|
| DataHub | `mlModelGroup` / `mlModel` / `mlModelDeployment` | Splits container (group) / trained artifact (model) / running instance (deployment) — "a deployment represents a specific instance of that model serving predictions in a particular environment." Closest structural match to ODD's split. | docs.datahub.com/docs/generated/metamodel/entities/mlmodel · /mlmodeldeployment |
| SageMaker | Model Group / Model Package / Training Job | Group "tracks all of the models that you train to solve a particular problem"; each pipeline run registers a version. The only system ODD has a live producing collector for (emits `ML_MODEL_TRAINING`). | docs.aws.amazon.com/sagemaker/latest/dg/model-registry.html |
| MLflow | Registered Model / Model Version / Run | *Collapses* registry-identity and artifact: a "registered model… contains versions, aliases, tags." Shows the alternative ODD did *not* take (single umbrella entity). | mlflow.org/docs/latest/ml/model-registry/ |

(OpenMetadata's `MlModel` schema page returned 404 on two attempts — see caveats; from the connector index it is known to ship a single `MlModel` entity, i.e. the MLflow-style collapsed model, but I could not verify the schema-level definition this session, so I do not lean on it.)

## Recommended framing for the caller

"ODD's three ML subtypes are the industry-standard lifecycle decomposition (training job → trained artifact → deployed instance); the plain `ML_MODEL` is the model's *identity*, which every peer system models as a *container*, so ODD should model it as a `DATA_ENTITY_GROUP` like the existing `ML_EXPERIMENT` — not as a fourth consumer leaf. The bounded map-to-`ML_MODEL_ARTIFACT` fix is an acceptable, class-correct hotfix to stop the 500, but it silently re-labels the operator's declared type, so it must be disclosed in a published ML-entity-types reference page that does not exist today."

For the `/contribute` plan specifically: the **honest long-term target for `ML_MODEL` is a group**, so frame the bounded fix as an explicitly-temporary stop-the-bleed (guard the 500 + map the inputs-only consumer case) and file the group-modelling + spec-alignment + docs-page work as the durable follow-up, rather than letting map-to-artifact silently become the permanent semantics.

## Caveats and uncertainty — "what would confuse a user"

- **The `_TRAINING`-is-a-transformer vs `_ARTIFACT`-is-a-consumer split is non-obvious.** A user sees "training" and "model" and may not guess that one has outputs and one does not. The docs must say *why* (training produces a model; the artifact consumes features). Without the page, this is invisible.
- **`ML_MODEL` vs `ML_MODEL_ARTIFACT` vs `ML_MODEL_INSTANCE` is the core confusion risk.** Three of them contain the word "model." If `ML_MODEL` becomes a *group* and the other two stay leaves, the rule is clean ("the group is the model; the leaves are its stages") — but only if documented. If `ML_MODEL` were made a fourth leaf (Option a), the confusion is unresolvable.
- **Empty-group risk:** under Option (b), an `ML_MODEL` group is only as useful as its members, and today only `_TRAINING` has a producer. Users could see a model group with one training node and nothing else. Honest, but set expectations.
- **Wire-contract asymmetry is real and user-visible:** the spec (`entities.yaml`) has `ML_MODEL` + `ML_MODEL_TRAINING` but *not* `_INSTANCE`/`_ARTIFACT` (verified verbatim). So a collector author reading the spec cannot even emit `_INSTANCE`/`_ARTIFACT` today — they are platform-internal-only types. Any durable fix should reconcile spec and platform (a spec-repo PR), or the asymmetry will keep generating "the type I sent disappeared / errored" reports.
- **`confidence: LOW` items:** (1) OpenMetadata's schema-level `MlModel` definition — 404 on `docs.open-metadata.org/...mlmodel` twice this session; I rely on DataHub/MLflow/SageMaker instead and do not lean on OM. (2) The exact runtime shape of *real* `ML_MODEL` payloads from any non-SageMaker producer — unverified; the honesty of map-to-`_ARTIFACT` hinges on those payloads being `data_consumer`-shaped, which the maintainer should confirm against the actual producer before committing the map as anything beyond a guarded hotfix.
- **Out-of-scope follow-up worth a separate consultation:** how `FEATURE_GROUP` / feature-store entities relate to `ML_MODEL_ARTIFACT` inputs (the `mlFeature` lineage question DataHub models explicitly) — not needed for the 500 fix.

## Citations

- `documentation/docs/README.md` lines 3-9, 13-19, 26-32 (via `lineage/odd-platform/system-mission.md:67,69`) — ODD "ML first citizen" + "Auto-generated ML experiment lineage" differentiator; audiences. Workspace read 2026-06-18.
- `lineage/odd-platform/system-mission.md:80,94,165-180,331` — Data Entity types/classes, DEG/Domain grouping primitive, P-05 group-level lineage, `data-scientist-ml-engineer` audience ("ML experiments + ML model lineage are first-class"). Workspace read 2026-06-18.
- `lineage/odd-platform/concepts.yaml` — grep for `ML_MODEL`/`ML_EXPERIMENT`/`machine.learning` → **no matches** (no ML concept entry exists). 2026-06-18.
- `https://raw.githubusercontent.com/opendatadiscovery/opendatadiscovery-specification/main/specification/entities.yaml` — `last_verified_status: 200`, fetched 2026-06-18. Confirmed: enum has `ML_MODEL`, `ML_MODEL_TRAINING`, `ML_EXPERIMENT`; **no** `ML_MODEL_INSTANCE`/`ML_MODEL_ARTIFACT`. `DataConsumer` has only `inputs`; `DataTransformer` requires `inputs`+`outputs`; `DataEntityGroup` has `entities_list`+`group_oddrn`.
- `https://docs.datahub.com/docs/generated/metamodel/entities/mlmodel` — `last_verified_status: 200` (after 301 chain datahubproject.io → datahub.com → docs.datahub.com), fetched 2026-06-18. "The ML Model entity represents trained machine learning models"; `mlModelGroup` "organizes related models into logical families or collections" via `MemberOf`; `mlModelDeployment` = "running instances of deployed models."
- `https://docs.datahub.com/docs/generated/metamodel/entities/mlmodeldeployment` — `last_verified_status: 200`, fetched 2026-06-18. Verbatim: "Model deployments are distinct from ML models themselves - while an ML model represents the trained artifact, a deployment represents a specific instance of that model serving predictions in a particular environment." mlModel = "the trained model artifact itself, including training data, metrics, and hyperparameters."
- `https://mlflow.org/docs/latest/ml/model-registry/` — `last_verified_status: 200`, fetched 2026-06-18. Verbatim: "A registered model has a unique name, contains versions, aliases, tags, and other metadata"; "Each registered model can have one or many versions… Each new model registered to the same model name increments the version number." (Earlier `mlflow.org/docs/latest/model-registry.html` returned empty body — superseded by this URL.)
- `https://docs.aws.amazon.com/sagemaker/latest/dg/model-registry.html` — `last_verified_status: 200`, fetched 2026-06-18. Verbatim: "Create a Model Group that tracks all of the models that you train to solve a particular problem… For each run of the ML pipeline, create a model version that you register in the Model Group."
- `https://docs.opendatadiscovery.org/features/data-modelling` — `last_verified_status: 200`, fetched 2026-06-18. Confirmed: **no** ML vocabulary present (no `ML_MODEL`/`_TRAINING`/`_INSTANCE`/`_ARTIFACT`/experiment). Establishes the published-docs gap.
- `https://docs.open-metadata.org/latest/main-concepts/metadata-standard/schemas/entity/data/mlmodel` (and trailing-slash + `/connectors/ml-model` variants) — `last_verified_status: 404` (schema page) / content-free (connector index), fetched 2026-06-18. **Not relied upon** — OpenMetadata `MlModel` schema unverified this session.
