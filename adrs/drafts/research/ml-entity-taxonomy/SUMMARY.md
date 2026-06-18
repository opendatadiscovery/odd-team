# Research synthesis — ODD ML entity taxonomy

**Slug:** `ml-entity-taxonomy` · **Originating ADR:** `adrs/drafts/ml-entity-taxonomy.md` · **Trigger:** odd-platform #1725 (CTRIB-021) escalated by the maintainer into a foundational taxonomy decision · **Date:** 2026-06-18.

Threads: `PRIOR-ART.md` (6 MLOps platforms), `CATALOG-ALIGNMENT.md` (4 ML-aware catalogs), `PITFALLS.md`, this synthesis. Plus `lineage/odd-platform/sme-consultations/2026-06-18-ml-model-type-taxonomy.md` (the product-owner lens). Every platform claim traces to an official-doc URL fetched 2026-06-18 (statuses in the thread files); LOW-confidence items are flagged, never filled from memory.

## TL;DR (HIGH confidence)

Across **10 systems** — MLflow, SageMaker, Vertex AI, Databricks/Unity Catalog, Kubeflow, Weights & Biases, DataHub, OpenMetadata, Atlan — the ML metadata model converges on **one shape**:

```
Experiment (group of runs)
Registered-Model / Model-Group  ← the named MODEL IDENTITY, a CONTAINER of versions   ◄── ODD HAS NO HOME
   └─ Model Version / Artifact   ← a trained, versioned model object
        ▲ produced by
   Training Job / Run            ← the compute that trains (features in → model out)
        │ deployed as
   Deployment / Serving Instance ← a running, compute-backed endpoint (≠ the artifact) ◄── ODD CONFLATES THIS
Dataset / Feature(-table)        ← inputs, with lineage into training + the model
```

**Two findings are near-unanimous and decide the taxonomy:**
1. **The model "identity" is a CONTAINER, not a leaf.** 9/10 systems separate the named registered-model / model-group / family (which *contains* versions) from the individual version. MLflow *Registered Model* "contains versions"; SageMaker *Model Package Group* "a group of versioned models"; DataHub `mlModelGroup` "organizes related models" via `MemberOf`; Vertex *Model* holds versions; UC *registered model*; Atlan `AIModel`→versions. Only OpenMetadata collapses it. **This is exactly the maintainer's `ML_MODEL`-as-group instinct, and it is correct.**
2. **A deployed serving instance is DISTINCT from the trained artifact.** SageMaker *Endpoint*, Vertex *DeployedModel*, DataHub `mlModelDeployment` ("a deployment represents a specific instance of that model serving predictions"), KServe *InferenceService*, Databricks *served entity* — all model the running thing separately from the static model. (MLflow/W&B delegate serving externally — absence, not contradiction.)

## The recommended ODD taxonomy (the forward model)

ODD already has the *experiment + training + artifact + instance* axis; the cross-platform map shows the existing types map cleanly **once `ML_MODEL` is added as the identity GROUP and the three leaves are read with industry meaning**:

| ODD type | Class | Means (industry-isomorphic) | Per-platform analogy |
|---|---|---|---|
| **`ML_MODEL`** *(NEW)* | `DATA_ENTITY_GROUP` | the **model identity / family** — "the churn model"; the searchable umbrella that groups its lifecycle members; supports group-level lineage | MLflow *Registered Model* · SageMaker *Model Package Group* · Vertex *Model* (registry) · DataHub `mlModelGroup` · UC *registered model* · Atlan `AIModel` |
| `ML_MODEL_TRAINING` | `DATA_TRANSFORMER` | the **training job/run** (features in → model out) | SageMaker *Training Job* · Vertex *Custom Job* · MLflow training *run* · DataHub `dataProcessInstance`+`mlTrainingRunProperties` |
| `ML_MODEL_ARTIFACT` | `DATA_CONSUMER` | a **trained model version / artifact** (consumes features; the deployable object) | MLflow *Model Version* · SageMaker *Model Package* · Vertex *Model Version* · DataHub `mlModel` |
| `ML_MODEL_INSTANCE` | `DATA_TRANSFORMER` | a **deployed serving instance** (consumes a model + requests → produces predictions) | SageMaker *Endpoint* · Vertex *DeployedModel* · DataHub `mlModelDeployment` · KServe *InferenceService* · Databricks *served entity* |
| `ML_EXPERIMENT` *(existing)* | `DATA_ENTITY_GROUP` | a **grouping of training runs** (experimentation) | MLflow/SageMaker/Vertex/Kubeflow *Experiment* · W&B *Project* |

This is the **minimum-change, maximum-alignment** design: **add ONE type** (`ML_MODEL` as a group), keep all legacy types, and give every type a published per-platform analogy so a user arriving from MLflow/SageMaker/Vertex/DataHub meets a familiar concept. The lifecycle members attach to the `ML_MODEL` group (via `data_entity_group` `entities_list`/`group_oddrn`), unlocking the model-lifecycle lineage ODD's `DATA_ENTITY_GROUP` already renders (`LineageServiceImpl.getDataEntityGroupLineage`).

### Why read `ML_MODEL_INSTANCE` as "deployment" (not "version")
No surveyed platform models a *version* or a *deployment* as the SAME thing, and none models either as a *transformer that produces a version*. ODD's `ML_MODEL_INSTANCE` is already a `DATA_TRANSFORMER` (inputs+outputs) — which fits a **serving instance** (consumes requests/model → produces predictions) far better than a static version. So the honest, no-new-leaf reading is: `ML_MODEL_ARTIFACT` = the version/artifact (consumer), `ML_MODEL_INSTANCE` = the deployment/serving instance (transformer). This avoids inventing `ML_MODEL_VERSION`/`ML_MODEL_DEPLOYMENT` and gives all three leaves a clean, distinct, industry-matched meaning.

## The #1725 resolution — the platform maps the contract 1:1 (no platform inference)

The specification is the contract; the platform maps each ingestion type to its internal type **1:1 by name**
(`DataEntityTypeDto.valueOf`) and adds **no payload-shape inference** (that antipattern was rejected at the
draft-PR gate — see PITFALLS #2). Adding `ML_MODEL` to the internal enum (as a `DATA_ENTITY_GROUP` type) fixes
the 500:
- `ML_MODEL` + a `data_entity_group` payload → ingests as the model-identity group (the contract already
  advertises `ML_MODEL`; the platform just needed the 1:1 internal type);
- because `ML_MODEL` is a group, a `data_consumer`-shaped `ML_MODEL` is a type-vs-class contract violation → a
  clean **400** (`DataEntityClassTypeValidationException`), never the 500;
- a consumer-model is sent as **`ML_MODEL_ARTIFACT`** (the reporter's case) — added to the ingestion spec
  (SPC-004); the platform already maps it 1:1.

Type drift is fixed by **aligning the spec with the internal enum**, not by guessing in the mapper.

## Confidence

| Decision | Confidence | Basis |
|---|---|---|
| Model identity = a container/group (not a leaf) | **HIGH** | 9/10 systems, verbatim official docs (PRIOR-ART, CATALOG-ALIGNMENT) |
| Deployment/serving ≠ artifact | **HIGH** | SageMaker/Vertex/DataHub/KServe/Databricks verbatim |
| `ML_MODEL` → `DATA_ENTITY_GROUP` for ODD | **HIGH** | the container consensus + ODD's `ML_EXPERIMENT`-as-group precedent + shipped group lineage |
| `ML_MODEL_INSTANCE` reads as deployment, `ML_MODEL_ARTIFACT` as version | **MEDIUM-HIGH** | best industry fit; ODD's own enum gives no definitions, so this is a (defensible) interpretation the ADR makes explicit |
| Keep training-run split | **HIGH** | matches DataHub/SageMaker/Vertex/Databricks/Kubeflow |
| Feature / feature-table family (mlFeature etc.) | **deferred** | real gap (DataHub/OM rich here) but out of #1725 scope; logged as a follow-up |

**LOW-confidence (flagged, not load-bearing):** Vertex's current product name (mid-rebrand to "Gemini Enterprise Agent Platform"; the *entity model* is unaffected/HIGH); W&B legacy "registered model" verbatim wording (pages redirect — superseded by current *Collection*); Kubeflow registry serving-entity field defs (deferred to GitHub); OpenMetadata rendered docs 404 (used the raw JSON schema instead).

## Roadmap (phasing — see the ADR + CTRIB-021)

1. **0.29.0 (odd-platform, CTRIB-021):** add `ML_MODEL` 1:1 as a `DATA_ENTITY_GROUP` type (the platform maps the contract by name — no inference) + the **published ML-entity-types reference page** (defines all 5 types + analogies — the gap that *no* ODD doc covers today). Stops the `ML_MODEL` 500.
2. **The taxonomy (this ADR):** add `ML_MODEL` as a `DATA_ENTITY_GROUP` in the platform + the **`opendatadiscovery-specification`** (`entities.yaml` enum + schema) **and its README**; keep legacy types for back-compat. A spec-repo change (separate from odd-platform) + a producing-collector path are its own tracked items.
3. **Deferred:** the feature/feature-table family; reconciling `_INSTANCE`/`_ARTIFACT` into the wire spec (currently platform-internal-only).
