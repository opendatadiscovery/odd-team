# Data Entities

Core metadata objects in the platform: tables, views, jobs, pipelines, ML models, dashboards, etc.

## Code Entry Points (odd-platform)

### Controllers
- `odd-platform-api/.../controller/DataEntityController.java` — CRUD, business names, groups, metadata
- Service: `odd-platform-api/.../service/DataEntityService.java`
- Repository: `odd-platform-api/.../repository/reactive/ReactiveDataEntityRepository.java`

### Entity Types (DataEntityTypeDto.java)
TABLE, FILE, FEATURE_GROUP, KAFKA_TOPIC, JOB, ML_EXPERIMENT, ML_MODEL_TRAINING, ML_MODEL_INSTANCE, DASHBOARD, ML_MODEL_ARTIFACT, VIEW, JOB_RUN, MICROSERVICE, API_CALL, DAG, GRAPH_NODE, DATABASE_SERVICE, API_SERVICE, KAFKA_SERVICE, DOMAIN, VECTOR_STORE, LOOKUP_TABLE, ENTITY_RELATIONSHIP, GRAPH_RELATIONSHIP

### Entity Classes (DataEntityClassDto.java)
- DATA_SET (1) — TABLE, FILE, FEATURE_GROUP, KAFKA_TOPIC, VIEW, GRAPH_NODE, VECTOR_STORE, LOOKUP_TABLE
- DATA_TRANSFORMER (2) — JOB, ML_MODEL_TRAINING, ML_MODEL_INSTANCE, VIEW, MICROSERVICE
- DATA_TRANSFORMER_RUN (3) — JOB_RUN
- DATA_QUALITY_TEST (4) — JOB
- DATA_QUALITY_TEST_RUN (5) — JOB_RUN
- DATA_CONSUMER (6) — ML_MODEL_ARTIFACT, DASHBOARD
- DATA_INPUT (7) — API_CALL
- DATA_ENTITY_GROUP (8) — ML_EXPERIMENT, DAG, DATABASE_SERVICE, API_SERVICE, KAFKA_SERVICE, DOMAIN
- DATA_RELATIONSHIP (9) — ENTITY_RELATIONSHIP, GRAPH_RELATIONSHIP

### Groups
- `odd-platform-api/.../service/DataEntityGroupService.java` → `DataEntityGroupServiceImpl.java`
- `odd-platform-api/.../repository/reactive/ReactiveGroupEntityRelationRepository.java`
- `odd-platform-api/.../dto/attributes/DataEntityGroupAttributes.java`

### Business Names
- `odd-platform-api/.../service/activity/handler/BusinessNameUpdatedActivityHandler.java`
- `odd-platform-api/.../dto/activity/BusinessNameActivityStateDto.java`
- Field: `internalName` in DataEntity and DatasetField

### Overview/Report (main page)
- `odd-platform-ui/src/components/Overview/Overview.tsx` — main page: Search, Tags, Domains, UsageInfo, Directory, OwnerAssociation
- `odd-platform-ui/src/components/Overview/DataEntitiesUsageInfo/` — entity counts (totalCount, unfilledCount, classesUsageInfo)

### UI
- `odd-platform-ui/src/components/DataEntityDetails/` — entity detail page

## Documentation
- `documentation/docs/Features.md#metadata-storage` (search description)
- `documentation/docs/Features.md#data-entity-groups`
- `documentation/docs/Features.md#data-entity-report` (outdated — now part of Overview)
- `documentation/docs/Features.md#adding-business-names-for-data-entities-and-dataset-fields`
- `documentation/docs/Features.md#integrating-vector-store-metadata`

## Ingestion Path
Collector `get_data_entity_list()` → Ingress API → Platform ingests via `IngestionService`

## Related Domains
- lineage (entities have upstream/downstream)
- search (entities are searchable)
- collaboration (entities have owners, tags)
- alerting (entity state changes trigger alerts)
- data-quality (entities have quality test results)
