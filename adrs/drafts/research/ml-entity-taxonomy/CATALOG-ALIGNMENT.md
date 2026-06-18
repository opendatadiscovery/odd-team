# CATALOG-ALIGNMENT — ML entity models of ML-aware DATA CATALOGS

ODD is a data catalog, so the closest analogues are DataHub, OpenMetadata, Atlan, and Unity Catalog (as a catalog). How they model ML entities matters most — a user arriving from DataHub/OpenMetadata should meet a familiar shape. Every claim cites a page fetched 2026-06-18 (status inline); failures flagged, not filled from memory.

## DataHub — the closest model to ODD (a 7-entity split)

| Entity | Definition (verbatim/paraphrase) | Concept | URL (status) |
|---|---|---|---|
| `mlModelGroup` | "logical containers for organizing related machine learning models, enabling lifecycle management, version tracking" | **model family / identity (container)** | …/entities/mlmodelgroup (200) |
| `mlModel` | "represents trained machine learning models" — the trained/versioned model | **model version / artifact** | …/entities/mlmodel (200) |
| `mlModelDeployment` | "deployed instances of machine learning models running in production or other environments" | **deployment / serving instance** | …/entities/mlmodeldeployment (200) |
| `dataProcessInstance` (+`mlTrainingRunProperties`) | "an individual execution run of a data pipeline or data processing task"; the run **`Produces`** an `mlModel` | **training run** | …/entities/dataprocessinstance (200) |
| `mlFeature` / `mlFeatureTable` / `mlPrimaryKey` | feature / collection of features / feature-table key | **feature store** | …/entities/mlfeature… (200) |

Relationships (verbatim aspect names): `mlModel` → **`MemberOf`** → `mlModelGroup` ("the model points up to the group"); `mlModel` → **`DeployedTo`** → `mlModelDeployment`; `mlModel` → **`Consumes`** → `mlFeature`; `mlModel` → **`TrainedBy`** → `dataProcessInstance`; dedicated `mlModelTrainingData`/`mlModelEvaluationData` → datasets; `mlFeatureTable` **`Contains`** `mlFeature`, **`KeyedBy`** `mlPrimaryKey`; `mlFeature.sources` **`DerivedFrom`** `Dataset`. [docs.datahub.com metamodel — all 200]

DataHub is **fully split**: identity (`mlModelGroup`) / version (`mlModel`) / deployment (`mlModelDeployment`) are three distinct entities — the exact split ODD should adopt.

## OpenMetadata — the minority "collapsed" choice (1 entity)

`MlModel` = "algorithms trained on data to find patterns or make predictions" — a single entity carrying `algorithm`, `mlFeatures[]` (each with `featureSources[].dataSource` → a Table), `mlHyperParameters`, `mlStore` (artifact location), **`server`** ("Endpoint that makes the ML Model available … serving … predictions"), `dashboard`. **No** model group / family / registry; versioning is only OM's generic entity `version`. Deployment is a `server` URL FIELD, not a separate entity. [raw schema `…/json/schema/entity/data/mlmodel.json` — 200; rendered docs 404'd → used the schema]

→ OM is the *collapsed* model. It's the minority/legacy choice; ODD should NOT follow it (it forecloses lifecycle lineage), but it's the reason `ML_MODEL_ARTIFACT`-with-an-artifact-location is defensible.

## Atlan — first-class AI assets + typed lineage

`AIModel` ("govern and manage AI applications … track model versions, configure training datasets") → child `version` (with **Stage**: None/Staging/Production/Archived, Metrics). `AIApplication` = the governed app. Lineage via the standard `Process` primitive carrying **`aiDatasetType`** (`TRAINING`/`TESTING`/`INFERENCE`/`VALIDATION`/`OUTPUT`), `inputs[]`=datasets, `outputs[]`=model. [docs.atlan.com/.../create-ai-model — 200]. → split (identity→versions) with typed dataset→model lineage edges.

## Unity Catalog (as a catalog)

`registered model` = "a Unity Catalog object that represents a machine learning model" in `catalog.schema.model`, governed as a `FUNCTION` securable → `model version` = "a specific instance … capturing a particular state of the model's artifacts." Model↔table lineage auto-captured (`mlflow.log_input`, `log_model`); lineage-graph nodes "include … ML model versions." [docs.databricks.com — 200]. → split (registered model → version), models are first-class governed objects.

## Synthesis — what ODD should adopt

| Question | Catalogs' answer | ODD implication |
|---|---|---|
| Identity vs version: split or collapsed? | **3/4 split** (DataHub, UC, Atlan); only OM collapses | Add the **identity container** → `ML_MODEL` (group); `ML_MODEL_ARTIFACT` = the version |
| Deployment: distinct? | DataHub `mlModelDeployment` (entity); UC/Atlan via alias/Stage; OM `server` field | Distinct concept → `ML_MODEL_INSTANCE` reframed as the deployment/serving instance |
| Feature lineage | DataHub richest (`mlFeature`/`mlFeatureTable`/`mlPrimaryKey`, `DerivedFrom`); OM `featureSources.dataSource`; UC tables | **Gap** — ODD has only `FEATURE_GROUP` (a DATA_SET), no feature lineage. Deferred follow-up. |
| The artifact as a separate node? | DataHub: artifact IS the `mlModel`; OM: `mlStore` field | ODD's artifact-as-`DATA_CONSUMER` is idiosyncratic but workable; keep for back-compat |

**Net:** the leading catalogs model "a model" as a **group/container of versions + deployments** (the split model). ODD should be isomorphic to DataHub's `mlModelGroup`→`mlModel`→`mlModelDeployment` split: `ML_MODEL` (group) → `ML_MODEL_ARTIFACT` (version) → `ML_MODEL_INSTANCE` (deployment), with `ML_MODEL_TRAINING` feeding the version. OpenMetadata's collapsed single-entity model is the one to avoid.

## LOW-confidence / NOT VERIFIED (flagged)
- No DataHub aspect literally named `MLModelLineage` (lineage is via the named relationships above) — LOW on the negative.
- OM automatic column-level feature lineage (GitHub issue not fetched).
- Atlan ML edges in the *visual* lineage UI (mechanism documented; UI rendering unconfirmed).
- UC serving-endpoint as a securable object (aliases/signatures covered; endpoint-as-securable not verified).
