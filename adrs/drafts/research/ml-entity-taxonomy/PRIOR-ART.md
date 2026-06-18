# PRIOR-ART — ML entity models of the major MLOps platforms

How MLflow, AWS SageMaker, Google Vertex AI, Databricks, Kubeflow, and Weights & Biases model ML entities + lineage. Every row was extracted from an official-doc page fetched 2026-06-18 (HTTP status inline); the ODD-mapping column is our analysis. LOW-confidence items flagged at the end.

## The cross-platform entity map (the load-bearing synthesis)

| Lifecycle concept | MLflow | SageMaker | Vertex AI | Databricks/UC | Kubeflow | W&B | **Canonical** | **ODD** |
|---|---|---|---|---|---|---|---|---|
| Experiment (run grouping) | Experiment | Experiment | Experiment | Experiment | Experiment | Project | **Experiment** | `ML_EXPERIMENT` (group) ✓ |
| Run / execution | Run | Trial Component ("run") | Experiment Run | Run | Run | Run | **Run** | `DATA_TRANSFORMER_RUN` |
| Training job (produces a model) | (training run) | Training Job | Custom Job / Training Pipeline | (run) | Pipeline/Component/Step | Run | **Training Job** | `ML_MODEL_TRAINING` (transformer) ✓ |
| Trained model object / version | MLflow Model + Model Version | Model Package | Model Version | model version | ModelVersion/ModelArtifact | Artifact(`model`)/linked version | **Model Version / Artifact** | `ML_MODEL_ARTIFACT` (consumer) ✓ |
| **Model identity (umbrella of versions)** | **Registered Model** | **Model Package Group** | **Model** (registry) | **registered model** | **RegisteredModel** | **Collection** | **Registered Model** | **NONE → add `ML_MODEL` (group)** |
| **Deployed serving instance** | (external) | **Endpoint** (+Config/Variant/InferenceComponent) | **DeployedModel** (on Endpoint) | **served entity** (on serving endpoint) | **KServe InferenceService** | (external/webhook) | **Deployment / Inference Service** | reframe `ML_MODEL_INSTANCE` (transformer) |
| Mutable pointer to a version | Alias (`@champion`) | (approval status) | Model Version Alias | Alias (`Champion`) | (labels) | Alias (`production`) | **Alias** | a relationship/tag, not a node |
| Dataset | Dataset | Dataset / Feature Group | Managed Dataset | feature table / logged input | (Input)Artifact | Artifact(`dataset`) | **Dataset** | `DATA_SET` ✓ |
| Pipeline (DAG) | (recipes — weak) | Pipeline | Pipeline (PipelineJob) | Jobs/Workflows | **Pipeline** (first-class) | Sweep (HPO) | **Pipeline** | `DATA_ENTITY_GROUP` (DAG) |
| Lineage substrate | run/version links | Artifact/Action/Context/Association | ML Metadata (Artifact/Execution/Context/Event) | UC auto-lineage | MLMD (google/ml-metadata) | derived `use/log_artifact` DAG | **Lineage graph** | ODD's own graph + `DATA_RELATIONSHIP` |

**Universal (strong equivalent in all 6):** Experiment, Run, Training Job, Model Artifact/Version, **Registered-Model identity**, Dataset.
**Near-universal:** Deployment/Endpoint (first-class in SageMaker/Vertex/Databricks/Kubeflow; external in MLflow/W&B); Alias (MLflow/Vertex/Databricks/W&B); Pipeline (first-class in SageMaker/Vertex/Kubeflow).

## Finding 1 — the model identity is a CONTAINER of versions (unanimous, 6/6)

- **MLflow** — *Registered Model* "has a unique name, contains versions, aliases, tags"; "Each registered model can have one or many versions … each new model … increments the version number." Each version "is linked to the MLflow run / logged model … that produced it." [`mlflow.org/docs/latest/ml/model-registry/` — 200]
- **SageMaker** — *Model Package Group* = "A group of versioned models in the Model Registry"; *Model Package* = "the actual model … registered … as a versioned entity"; ARN nests version under group `…:{model-package-group}/{version}`. [`docs.aws.amazon.com/sagemaker/latest/dg/model-registry-models.html` — 200]
- **Vertex AI** — a *Model* resource holds versions: "Model versioning lets you create multiple versions of the same model"; aliases "unique within a model resource." [`…/model-registry/versioning` — 301→200]
- **Databricks/UC** — *registered model* = "a Unity Catalog object that represents a machine learning model" addressed as `<catalog>.<schema>.<model>`; *model version* = "a specific instance of a registered model." [`docs.databricks.com/.../manage-model-lifecycle/` — 200]
- **Kubeflow** — *RegisteredModel* = "a named model entity that can have multiple versions" → *ModelVersion* → *ModelArtifact* (3 tiers). [`kubeflow.org/docs/components/model-registry/getting-started/` — 200]
- **W&B** — *Collection* "represents a distinct task or use case" → *linked artifact versions* (pointers to source artifacts). [`docs.wandb.ai/models/registry` — 200]

Distinction worth noting: MLflow/SageMaker/Kubeflow give the identity its OWN type name (Registered Model / Model Package Group / RegisteredModel) distinct from a version; Vertex overloads "Model" for the container. ODD should name the identity distinctly → `ML_MODEL` (group) above `ML_MODEL_ARTIFACT` (version).

## Finding 2 — a deployed serving instance ≠ the trained artifact (4/6 first-class; 2/6 external)

- **SageMaker** — 3-resource chain: *Model* (artifact+container) → *Endpoint Configuration* (Production Variants: instance types/counts) → *Endpoint* (provisioned URL-addressable service); modern *Inference Component*. Lineage encodes it: **Endpoint = Context, deployment = Action, deployed model = Artifact** (distinct from the package artifact). [`…/dg/realtime-endpoints-deploy-models.html`, `…/dg/lineage-tracking-*` — 200]
- **Vertex AI** — deploying a *Model* to an *Endpoint* creates a *DeployedModel* child that "associates compute resources with the model"; endpoint↔model is many-to-many; batch path bypasses the endpoint. [`…/general/deployment`, `…/predictions/overview` — 301→200]
- **Databricks** — a *served entity* binds `entity_name`+`entity_version` onto a *serving endpoint* with traffic split (`current`/`challenger`); a `Champion` alias is a registry pointer, explicitly NOT the runtime. [`…/model-serving/*` — 200]
- **Kubeflow/KServe** — *InferenceService* CRD (`serving.kserve.io/v1beta1`) with Predictor/Transformer/Explainer, wired to the registry by `storageUri: model-registry://{model}/{version}`. [`kserve.github.io/website/docs/...` — 200]
- **MLflow / W&B** — serving is a downstream *capability/consumer* of the artifact (MLflow REST serving) or delegated to external systems via webhook (W&B Automations) — no first-class serving entity. (Absence, not a contradicting model.)

→ The serving instance carries the **compute/resource config** the artifact lacks and is **many-to-many** with the artifact. ODD's `ML_MODEL_INSTANCE` (a `DATA_TRANSFORMER`: consumes requests → produces predictions) is the natural home for this — provided it is read as "deployment/serving instance," not "model version."

## ODD's real producer today (ground truth)
Only the AWS SageMaker collector emits an ML type: `odd-collector-aws/.../sagemaker/domain/artifact.py:108` emits `type=ML_MODEL_TRAINING` with a `data_consumer` block — which mismatches ODD's class rule (`ML_MODEL_TRAINING ∈ DATA_TRANSFORMER`, not `DATA_CONSUMER`) and would fail validation. So even the one producer is mis-shaped — evidence the taxonomy is half-built and needs the definitive model. (A separate odd-collectors follow-up.)

## LOW-confidence flags
- Vertex product NAME mid-rebrand (`cloud.google.com/vertex-ai/...` → `docs.cloud.google.com/gemini-enterprise-agent-platform/...`, 200); entity model unaffected (HIGH).
- W&B legacy "registered model / model version" verbatim defs — pages redirect to current *Collection* content; current model is HIGH, legacy wording LOW.
- Kubeflow registry serving entities (ServingEnvironment/InferenceService-entity/ServeModel) — name-only on live docs; field defs deferred to GitHub.
- A couple of SageMaker Experiments DG pages returned JS shells; terminology recovered from the 200 API page.
