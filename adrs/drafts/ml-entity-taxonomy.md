---
adr: ml-entity-taxonomy
status: accepted (GATE 1, 2026-06-18, CTRIB-021 — Option 2: build the ML_MODEL group in 0.29.0)
date: 2026-06-18
relates_to: [CTRIB-021, "opendatadiscovery/odd-platform#1725"]
research: adrs/drafts/research/ml-entity-taxonomy/
sme: lineage/odd-platform/sme-consultations/2026-06-18-ml-model-type-taxonomy.md
published_adr_number: TBD-at-publication   # ADR-log page assigned a number when adopted (feedback_adr_means_published_doc_page_too)
---

# ADR (draft): ODD ML entity taxonomy — `ML_MODEL` is a model-identity group; lifecycle stages are its members

## Status

**Proposed** — research-backed (the `research/ml-entity-taxonomy/` dossier + the SME consultation). Pending the maintainer's GATE-1 decision on CTRIB-021. Supersedes the implicit, undocumented status quo of the ML data-entity types.

## Context

odd-platform #1725: `POST /ingestion/entities` with `type: ML_MODEL` returns a **500** (`No enum constant …DataEntityTypeDto.ML_MODEL`). Reproduced live (CTRIB-021). Root cause: the ingestion mapper bridges the ingestion-contract enum → the internal `DataEntityTypeDto` by name (`valueOf`), and `ML_MODEL` (advertised in the wire contract) has no internal counterpart.

Investigating the fix surfaced a deeper truth (CTRIB-021 + the research): **ODD's ML type system is half-built and entirely undocumented.**
- The internal enum has `ML_MODEL_TRAINING`, `ML_MODEL_INSTANCE`, `ML_MODEL_ARTIFACT` (+ `ML_EXPERIMENT`); the ingestion wire contract has `ML_MODEL` + `ML_MODEL_TRAINING` (+ `ML_EXPERIMENT`) but **NOT** `_INSTANCE`/`_ARTIFACT`; the platform-API output enum has the three `_*` subtypes but **NOT** `ML_MODEL`. Three enums, three different ML vocabularies.
- **No collector emits `ML_MODEL`/`_INSTANCE`/`_ARTIFACT`** today; only the AWS SageMaker collector emits `ML_MODEL_TRAINING` — and it does so mis-shaped (with a `data_consumer` block, a class mismatch).
- **No published doc page** defines any ML type (`docs.opendatadiscovery.org/features/data-modelling` has zero ML vocabulary, verified).

The maintainer escalated #1725 from a bugfix into a foundational decision: settle ODD's ML entity taxonomy **definitively, grounded in the real entity models of the major MLOps platforms**, so Data Scientists / MLOps engineers meet *familiar* concepts (not new ODD abstractions); keep legacy entities for backward compatibility; update the `opendatadiscovery-specification` spec **and** its README. The research (`SUMMARY.md` + `PRIOR-ART.md` + `CATALOG-ALIGNMENT.md`, 10 systems, cited) answers it.

ODD's relevant model: a Data Entity has one **type** within one or more **classes** — `DATA_SET`, `DATA_TRANSFORMER` (inputs+outputs), `DATA_TRANSFORMER_RUN`, `DATA_CONSUMER` (inputs only), `DATA_INPUT`, `DATA_ENTITY_GROUP` (a container that aggregates entities and supports **group-level lineage**, `LineageServiceImpl.getDataEntityGroupLineage`), `DATA_QUALITY_TEST(_RUN)`, `DATA_RELATIONSHIP`.

## Decision

Adopt a **source-agnostic ML taxonomy isomorphic to the cross-platform consensus**, requiring exactly **one new type** and keeping every legacy type:

| ODD type | Class | Meaning (the user-facing definition) | The familiar analogy (what the user already knows) |
|---|---|---|---|
| **`ML_MODEL`** *(NEW)* | `DATA_ENTITY_GROUP` | The **model identity / family** — the named, searchable "the churn model"; a container that groups its lifecycle members and renders group-level lineage across them. | MLflow **Registered Model** · SageMaker **Model Package Group** · Vertex **Model** (registry) · DataHub **`mlModelGroup`** · Unity Catalog **registered model** · Atlan **`AIModel`** |
| `ML_MODEL_TRAINING` *(existing)* | `DATA_TRANSFORMER` | A **training job/run** that produces a model (features in → model out). | SageMaker **Training Job** · Vertex **Custom Job** · MLflow training **run** · DataHub **`dataProcessInstance`** |
| `ML_MODEL_ARTIFACT` *(existing)* | `DATA_CONSUMER` | A **trained model version / artifact** — the deployable object that consumes features. | MLflow **Model Version** · SageMaker **Model Package** · Vertex **Model Version** · DataHub **`mlModel`** |
| `ML_MODEL_INSTANCE` *(existing)* | `DATA_TRANSFORMER` | A **deployed serving instance** of a model (consumes a model + requests → produces predictions). | SageMaker **Endpoint** · Vertex **DeployedModel** · DataHub **`mlModelDeployment`** · KServe **InferenceService** · Databricks **served entity** |
| `ML_EXPERIMENT` *(existing)* | `DATA_ENTITY_GROUP` | A **grouping of training runs** (experimentation over one problem). | MLflow / SageMaker / Vertex / Kubeflow **Experiment** · W&B **Project** |

**Rationale (HIGH confidence — `SUMMARY.md`):**
1. **The model identity is a CONTAINER, not a leaf** — 9 of 10 surveyed systems separate the named registered-model/family (which *contains* versions) from the version. ODD already does this for `ML_EXPERIMENT`; `ML_MODEL` is the same shape. A 4th *leaf* would create three indistinguishable "model" leaves and foreclose lifecycle lineage (**rejected** — see Alternatives).
2. **Deployment ≠ artifact** — every deployment-bearing platform models the running serving instance distinctly from the static trained object. ODD's `ML_MODEL_INSTANCE` is already a `DATA_TRANSFORMER` (request in → prediction out), which fits a serving instance; reading it as "deployment" (not "version") gives all three leaves a clean, distinct, industry-matched meaning **with no new leaf type**.
3. **Minimum change, maximum alignment** — add ONE type; keep all legacy; every type gets a published per-platform analogy so the taxonomy meets users where MLflow/SageMaker/Vertex/DataHub trained them.

### Backward compatibility (the #1725 resolution, non-breaking)

Wire `type: ML_MODEL` is resolved by payload **shape** at the ingestion boundary (`IngestionMapperImpl`):
- `data_consumer` shape (inputs-only — the #1725 reporter's "Chatbot") → **`ML_MODEL_ARTIFACT`** (colloquially "the model object");
- `data_transformer` shape → `ML_MODEL_TRAINING` (preserves outputs);
- `data_entity_group` shape → the `ML_MODEL` identity group (once the type ships);
- any other / `UNKNOWN` / unmappable contract type → a clean **400** (`BadUserRequestException`), never a 500 — closing the whole `valueOf`-drift class.

Legacy senders keep working. No existing enum value is removed or renamed. The `_INSTANCE`/`_ARTIFACT`/`_TRAINING` internal types are unchanged.

### `opendatadiscovery-specification` changes (spec + README)

The wire contract is the user's first contact with the vocabulary. Proposed (a separate spec-repo PR — see Phasing):

`specification/entities.yaml` — `DataEntityType` enum: keep `ML_MODEL` + `ML_MODEL_TRAINING`; **add `ML_MODEL_ARTIFACT`, `ML_MODEL_INSTANCE`** (so collectors can emit the full lifecycle the platform already understands — closing the spec↔platform asymmetry), with per-value **`description:`** docstrings (the enum has none today):
```yaml
ML_MODEL:          # The model identity/family — a group that aggregates this model's
                   # training jobs, versioned artifacts, and deployed instances.
                   # Analogy: MLflow Registered Model / SageMaker Model Package Group / DataHub mlModelGroup.
ML_MODEL_TRAINING: # A training job/run that produces a model (features in -> model out). DATA_TRANSFORMER.
ML_MODEL_ARTIFACT: # A trained, versioned model object that consumes features. DATA_CONSUMER.
ML_MODEL_INSTANCE: # A deployed serving instance of a model (requests -> predictions). DATA_TRANSFORMER.
```
README — add an **"ML entities"** section: the lifecycle picture (experiment → training → artifact/version → deployment, under a model-identity group) with the analogy table above, so a collector author maps their source's vocabulary onto ODD's in one read.

### odd-platform changes

- `DataEntityTypeDto` — add `ML_MODEL(<next id>)`.
- `DataEntityClassDto` — `DATA_ENTITY_GROUP` set `+= ML_MODEL` (the identity is a group, like `ML_EXPERIMENT`).
- `odd-platform-specification/components.yaml` — `DataEntityType.name` output enum `+= ML_MODEL` (prevents the read-back 500; regenerates BE+FE clients).
- `odd-platform-ui` — a `TypeNameEnum.ML_MODEL → 'ML model'` label + the 7 locale catalogs.
- `IngestionMapperImpl` — the shape-aware resolution above.
- Docs — the published **ML-entity-types reference page** (the analogy table + the `ML_MODEL` mapping + caveats), routed on `release/0.29.0`.

## Consequences

**Positive:** a user from MLflow/SageMaker/Vertex/DataHub meets every first-class concept from their home tool, named by analogy; #1725 is resolved non-breakingly; the model-lifecycle lineage the maintainer wanted is unlocked by an existing platform capability (group lineage); the ML vocabulary is documented for the first time.
**Costs / caveats (`PITFALLS.md`):** the `ML_MODEL` group ships mostly empty until producing collectors exist (like `ML_EXPERIMENT`); the cross-repo spec→contracts→platform sequence must be ordered; `ML_MODEL_INSTANCE`'s "deployment" meaning is an explicit (well-grounded) interpretation since the enum shipped no definitions; the SageMaker-collector mis-shape is a separate follow-up.

## Alternatives considered

1. **`ML_MODEL` as a 4th `DATA_CONSUMER` leaf** (the `claude[bot]`/naive fix). **Rejected** — creates three indistinguishable "model" leaves (`ML_MODEL`/`_ARTIFACT`/`_INSTANCE`), contradicts the 9/10 container consensus, and forecloses lifecycle lineage.
2. **OpenMetadata's collapsed single `MlModel`** (identity + version + deployment + serving field in one entity). **Rejected** — the minority/legacy choice; forecloses the lifecycle lineage that is ODD's "ML first citizen" differentiator.
3. **Fix only the 500, no taxonomy** (the bounded shape-aware map alone). **Adopted as the 0.29.0 hotfix** but insufficient as the durable answer — it leaves the vocabulary undocumented and the identity/group gap open (the maintainer's explicit concern).
4. **Path B: change the ingestion spec to drop `ML_MODEL`.** **Rejected** — breaking for existing senders; the colloquial "model" vocabulary is exactly what users expect.

## Phasing / rollout

1. **0.29.0 hotfix (odd-platform, CTRIB-021):** shape-aware `ML_MODEL` ingestion mapping (stops the 500, back-compat) + the published ML-entity-types doc page. Needs **no** cross-repo work. Resolves #1725.
2. **Taxonomy (this ADR, adopted):** add `ML_MODEL` (group) to the platform (internal DTO + class + `components.yaml` + FE) and to `opendatadiscovery-specification` (`entities.yaml` enum + descriptions + README), keeping legacy. The spec-repo change ships via its own PR (a `/log-issue`-style draft, since the bot's scope is odd-platform). A published ADR-log page (`feedback_adr_means_published_doc_page_too`) rides `release/{version}`.
3. **Deferred follow-ups (tracked):** a producing-collector path for `_ARTIFACT`/`_INSTANCE`/the group; the feature/feature-table family (`mlFeature`/`mlFeatureTable`); the SageMaker-collector mis-shape fix; reconciling `_INSTANCE`/`_ARTIFACT` fully across all three enums.

## Research backing

`adrs/drafts/research/ml-entity-taxonomy/{SUMMARY,PRIOR-ART,CATALOG-ALIGNMENT,PITFALLS}.md` (10 systems, official-doc citations, fetched 2026-06-18) + `lineage/odd-platform/sme-consultations/2026-06-18-ml-model-type-taxonomy.md` (product-owner lens, HIGH confidence). LOW-confidence items (Vertex product rename, W&B legacy wording, Kubeflow registry serving-entity defs, OpenMetadata rendered-docs 404) are flagged in the dossier and are not load-bearing.

## The decision pending (GATE 1 on CTRIB-021)

A single call: **adopt** this taxonomy (and the phasing), **refine** it, or **reject**. Plus the 0.29.0 scope: ship the hotfix + doc page now (recommended) with the `ML_MODEL`-group type + spec/README as the durable next phase, OR pull the `ML_MODEL`-group type into the 0.29.0 release too.
