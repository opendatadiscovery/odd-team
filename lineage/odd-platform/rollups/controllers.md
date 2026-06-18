# controllers rollup

Total controllers: 36. Total controller-methods: 204.
Auto-derived from `lineage/{repo}/nodes.jsonl`. HTTP method/path metadata lives on each controller-method via the openapi_tags axis join (operationId == method name).

## ActivityController implements ActivityApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ActivityController.java` (3 methods)

- `getActivity` (line 24) — no `@docs`
- `getActivityCounts` (line 45) — no `@docs`
- `getActivityUsers` (line 61) — no `@docs`

## AlertController implements AlertApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AlertController.java` (5 methods)

- `changeAlertStatus` (line 20) — no `@docs`
- `getAlertTotals` (line 29) — no `@docs`
- `getAllAlerts` (line 35) — no `@docs`
- `getAssociatedUserAlerts` (line 43) — no `@docs`
- `getDependentEntitiesAlerts` (line 51) — no `@docs`

## AlertManagerController

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AlertManagerController.java` (1 methods)

- `alertManagerWebhook` (line 21) — no `@docs`

## AppInfoController implements AppInfoApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AppInfoController.java` (1 methods)

- `getAppInfo` (line 23) — no `@docs`

## CollectorController implements CollectorApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/CollectorController.java` (5 methods)

- `deleteCollector` (line 42) — no `@docs`
- `getCollectorsList` (line 19) — no `@docs`
- `regenerateCollectorToken` (line 47) — no `@docs`
- `registerCollector` (line 27) — no `@docs`
- `updateCollector` (line 33) — no `@docs`

## DataCollaborationController implements DataCollaborationApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/datacollaboration/controller/DataCollaborationController.java` (3 methods)

- `getSlackChannels` (line 25) — no `@docs`
- `postMessageInSlack` (line 33) — no `@docs`
- `redirect` (line 41) — no `@docs`

## DataEntityAttachmentController implements DataEntityAttachmentApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityAttachmentController.java` (10 methods)

- `completeFileUpload` (line 64) — no `@docs`
- `deleteFile` (line 82) — no `@docs`
- `deleteLink` (line 109) — no `@docs`
- `downloadFile` (line 72) — no `@docs`
- `getAttachments` (line 30) — no `@docs`
- `getUploadOptions` (line 37) — no `@docs`
- `initiateFileUpload` (line 44) — no `@docs`
- `saveLinks` (line 90) — no `@docs`
- `updateLink` (line 99) — no `@docs`
- `uploadFileChunk` (line 53) — no `@docs`

## DataEntityController implements DataEntityApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java` (40 methods)

- `addDataEntityDataEntityGroup` (line 332) — no `@docs`
- `addDataEntityTerm` (line 149) — no `@docs`
- `createDataEntityGroup` (line 83) — no `@docs`
- `createDataEntityMetadataFieldValue` (line 118) — no `@docs`
- `createDataEntityTagsRelations` (line 243) — no `@docs`
- `createOwnership` (line 165) — no `@docs`
- `createQueryExampleToDatasetRelationshipNew` (line 437) — no `@docs`
- `deleteDataEntityFromDataEntityGroup` (line 342) — no `@docs`
- `deleteDataEntityMetadataFieldValue` (line 129) — no `@docs`
- `deleteOwnership` (line 174) — no `@docs`
- `deleteQueryExampleToDatasetRelationshipNew` (line 448) — no `@docs`
- `deleteTermFromDataEntity` (line 158) — no `@docs`
- `getAlertConfig` (line 405) — no `@docs`
- `getChannels` (line 374) — no `@docs`
- `getDataEntitiesUsage` (line 368) — no `@docs`
- `getDataEntityActivity` (line 351) — no `@docs`
- `getDataEntityAlerts` (line 315) — no `@docs`
- `getDataEntityAlertsCounts` (line 323) — no `@docs`
- `getDataEntityClasses` (line 225) — no `@docs`
- `getDataEntityDetails` (line 139) — no `@docs`
- `getDataEntityDownstreamLineage` (line 255) — no `@docs`
- `getDataEntityGroupsChildren` (line 100) — no `@docs`
- `getDataEntityGroupsItems` (line 108) — no `@docs`
- `getDataEntityGroupsLineage` (line 275) — no `@docs`
- `getDataEntityMessages` (line 383) — no `@docs`
- `getDataEntityMetrics` (line 424) — no `@docs`
- `getDataEntityUpstreamLineage` (line 265) — no `@docs`
- `getDomains` (line 431) — no `@docs`
- `getMessages` (line 394) — no `@docs`
- `getMyObjects` (line 283) — no `@docs`
- `getMyObjectsWithDownstream` (line 291) — no `@docs`
- `getMyObjectsWithUpstream` (line 299) — no `@docs`
- `getPopular` (line 307) — no `@docs`
- `updateAlertConfig` (line 413) — no `@docs`
- `updateDataEntityGroup` (line 91) — no `@docs`
- `updateOwnership` (line 183) — no `@docs`
- `updateStatus` (line 193) — no `@docs`
- `upsertDataEntityInternalDescription` (line 202) — no `@docs`
- `upsertDataEntityInternalName` (line 232) — no `@docs`
- `upsertDataEntityMetadataFieldValue` (line 213) — no `@docs`

## DataEntityRunController implements DataEntityRunApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityRunController.java` (1 methods)

- `getRuns` (line 18) — no `@docs`

## DataQualityController implements DataQualityApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataQualityController.java` (5 methods)

- `getDataEntityDataQATests` (line 25) — no `@docs`
- `getDatasetSLAReport` (line 63) — no `@docs`
- `getDatasetTestReport` (line 33) — no `@docs`
- `getSLA` (line 41) — no `@docs`
- `setDataQATestSeverity` (line 50) — no `@docs`

## DataQualityRunsController implements DataQualityRunsApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataQualityRunsController.java` (1 methods)

- `getDataQualityTestsRuns` (line 18) — no `@docs`

## DataSourceController implements DataSourceApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataSourceController.java` (5 methods)

- `deleteDataSource` (line 47) — no `@docs`
- `getDataSourceList` (line 21) — no `@docs`
- `regenerateDataSourceToken` (line 53) — no `@docs`
- `registerDataSource` (line 30) — no `@docs`
- `updateDataSource` (line 38) — no `@docs`

## DatasetController implements DataSetApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DatasetController.java` (4 methods)

- `getDataSetRelationships` (line 52) — no `@docs`
- `getDataSetStructureByVersionId` (line 22) — no `@docs`
- `getDataSetStructureDiff` (line 43) — no `@docs`
- `getDataSetStructureLatest` (line 33) — no `@docs`

## DatasetFieldController implements DatasetFieldApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DatasetFieldController.java` (8 methods)

- `addDatasetFieldTerm` (line 88) — no `@docs`
- `createEnumValue` (line 65) — no `@docs`
- `deleteTermFromDatasetField` (line 97) — no `@docs`
- `getDatasetFieldMetrics` (line 81) — no `@docs`
- `getEnumValues` (line 74) — no `@docs`
- `updateDatasetFieldDescription` (line 35) — no `@docs`
- `updateDatasetFieldInternalName` (line 45) — no `@docs`
- `updateDatasetFieldTags` (line 55) — no `@docs`

## DirectoryController implements DirectoryApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DirectoryController.java` (4 methods)

- `getDataSourceTypes` (line 23) — no `@docs`
- `getDatasourceEntities` (line 36) — no `@docs`
- `getDatasourceEntityTypes` (line 46) — no `@docs`
- `getDirectoryDatasourceList` (line 29) — no `@docs`

## EventApiController

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/datacollaboration/controller/EventApiController.java` (1 methods)

- `handleSlackEvent` (line 22) — no `@docs`

## FeatureController implements FeatureApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/FeatureController.java` (1 methods)

- `getActiveFeatures` (line 17) — no `@docs`

## GenAIController implements GenaiApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/GenAIController.java` (1 methods)

- `genAiQuestion` (line 18) — no `@docs`

## IdentityController implements IdentityApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IdentityController.java` (2 methods)

- `dummyOwner` (line 30) — no `@docs`
- `whoami` (line 23) — no `@docs`

## IngestionController implements IngestionApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IngestionController.java` (6 methods)

- `createDataSource` (line 47) — no `@docs`
- `getDataEntitiesByDEGOddrn` (line 75) — no `@docs`
- `ingestMetrics` (line 89) — no `@docs`
- `postDataEntityList` (line 37) — no `@docs`
- `postDataSetStatsList` (line 81) — no `@docs`
- `validateDataSources` (line 97) — no `@docs`

## IntegrationController implements IntegrationApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IntegrationController.java` (2 methods)

- `getIntegration` (line 18) — no `@docs`
- `getIntegrationPreviews` (line 24) — no `@docs`

## LinksController implements LinksApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/LinksController.java` (1 methods)

- `getLinks` (line 25) — no `@docs`

## MetadataFieldController implements MetadataApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/MetadataFieldController.java` (1 methods)

- `getMetadataFieldList` (line 18) — no `@docs`

## NamespaceController implements NamespaceApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/NamespaceController.java` (5 methods)

- `createNamespace` (line 21) — no `@docs`
- `deleteNamespace` (line 37) — no `@docs`
- `getNamespaceDetails` (line 29) — no `@docs`
- `getNamespaceList` (line 44) — no `@docs`
- `updateNamespace` (line 52) — no `@docs`

## OwnerAssociationRequestController implements OwnerAssociationRequestApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/OwnerAssociationRequestController.java` (7 methods)

- `createOwnerAssociationRequest` (line 27) — no `@docs`
- `createUserOwnerMapping` (line 65) — no `@docs`
- `deleteActiveUserOwnerMapping` (line 74) — no `@docs`
- `getAuthProviders` (line 81) — no `@docs`
- `getOwnerAssociationRequestActivityList` (line 47) — no `@docs`
- `getOwnerAssociationRequestList` (line 36) — no `@docs`
- `updateOwnerAssociationRequest` (line 55) — no `@docs`

## OwnerController implements OwnerApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/OwnerController.java` (4 methods)

- `createOwner` (line 21) — no `@docs`
- `deleteOwner` (line 40) — no `@docs`
- `getOwnerList` (line 29) — no `@docs`
- `updateOwner` (line 47) — no `@docs`

## PermissionController implements PermissionApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/PermissionController.java` (1 methods)

- `getResourcePermissions` (line 19) — no `@docs`

## PolicyController implements PolicyApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/PolicyController.java` (6 methods)

- `createPolicy` (line 19) — no `@docs`
- `deletePolicy` (line 52) — no `@docs`
- `getPolicyDetails` (line 27) — no `@docs`
- `getPolicyList` (line 34) — no `@docs`
- `getPolicySchema` (line 59) — no `@docs`
- `updatePolicy` (line 43) — no `@docs`

## QueryExampleController implements QueryExampleApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/QueryExampleController.java` (12 methods)

- `createQueryExamples` (line 25) — no `@docs`
- `deleteQueryExample` (line 44) — no `@docs`
- `getQueryExampleByDatasetId` (line 51) — no `@docs`
- `getQueryExampleByTermId` (line 58) — no `@docs`
- `getQueryExampleDetails` (line 65) — no `@docs`
- `getQueryExampleList` (line 72) — no `@docs`
- `getQueryExampleSearchFacetList` (line 90) — no `@docs`
- `getQueryExampleSearchResults` (line 98) — no `@docs`
- `getQueryExampleSearchSuggestions` (line 118) — no `@docs`
- `queryExamplesSearch` (line 81) — no `@docs`
- `updateQueryExample` (line 34) — no `@docs`
- `updateQueryExampleSearchFacetList` (line 108) — no `@docs`

## ReferenceDataController implements ReferenceDataApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/ReferenceDataController.java` (16 methods)

- `addDataToLookupTable` (line 52) — no `@docs`
- `createColumnsForLookupTable` (line 41) — no `@docs`
- `createReferenceTable` (line 33) — no `@docs`
- `deleteLookupTable` (line 153) — no `@docs`
- `deleteLookupTableField` (line 159) — no `@docs`
- `deleteLookupTableRow` (line 167) — no `@docs`
- `getLookupTableById` (line 80) — no `@docs`
- `getLookupTableField` (line 87) — no `@docs`
- `getLookupTableRowList` (line 94) — no `@docs`
- `getReferenceDataSearchFacetList` (line 63) — no `@docs`
- `getReferenceDataSearchResults` (line 71) — no `@docs`
- `referenceDataSearch` (line 103) — no `@docs`
- `updateLookupTable` (line 121) — no `@docs`
- `updateLookupTableField` (line 131) — no `@docs`
- `updateLookupTableRow` (line 143) — no `@docs`
- `updateReferenceDataSearchFacetList` (line 111) — no `@docs`

## RelationshipController implements RelationshipApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/RelationshipController.java` (3 methods)

- `getERDRelationshipById` (line 29) — no `@docs`
- `getGraphRelationshipById` (line 37) — no `@docs`
- `getRelationships` (line 19) — no `@docs`

## RoleController implements RoleApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/RoleController.java` (4 methods)

- `createRole` (line 19) — no `@docs`
- `deleteRole` (line 45) — no `@docs`
- `getRolesList` (line 27) — no `@docs`
- `updateRole` (line 36) — no `@docs`

## SearchController implements SearchApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/SearchController.java` (7 methods)

- `getFiltersForFacet` (line 29) — no `@docs`
- `getSearchFacetList` (line 42) — no `@docs`
- `getSearchResults` (line 49) — no `@docs`
- `getSearchSuggestions` (line 76) — no `@docs`
- `highlightDataEntity` (line 85) — no `@docs`
- `search` (line 59) — no `@docs`
- `updateSearchFacets` (line 67) — no `@docs`

## TagController implements TagApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/TagController.java` (4 methods)

- `createTag` (line 22) — no `@docs`
- `deleteTag` (line 30) — no `@docs`
- `getPopularTagList` (line 36) — no `@docs`
- `updateTag` (line 46) — no `@docs`

## TermController implements TermApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/TermController.java` (23 methods)

- `addLinkedTermToTerm` (line 236) — no `@docs`
- `createQueryExampleToTermRelationship` (line 218) — no `@docs`
- `createTerm` (line 69) — no `@docs`
- `createTermOwnership` (line 138) — no `@docs`
- `createTermTagsRelations` (line 129) — no `@docs`
- `deleteLinkedTermFromTerm` (line 245) — no `@docs`
- `deleteQueryExampleToTermRelationship` (line 228) — no `@docs`
- `deleteTerm` (line 85) — no `@docs`
- `deleteTermOwnership` (line 147) — no `@docs`
- `getTermByNamespaceAndName` (line 61) — no `@docs`
- `getTermDetails` (line 92) — no `@docs`
- `getTermFiltersForFacet` (line 165) — no `@docs`
- `getTermLinkedColumns` (line 110) — no `@docs`
- `getTermLinkedEntities` (line 99) — no `@docs`
- `getTermLinkedTerms` (line 120) — no `@docs`
- `getTermSearchFacetList` (line 177) — no `@docs`
- `getTermSearchResults` (line 184) — no `@docs`
- `getTermSearchSuggestions` (line 193) — no `@docs`
- `getTermsList` (line 51) — no `@docs`
- `termSearch` (line 200) — no `@docs`
- `updateTerm` (line 77) — no `@docs`
- `updateTermOwnership` (line 155) — no `@docs`
- `updateTermSearchFacets` (line 208) — no `@docs`

## TitleController implements TitleApi

Path: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/TitleController.java` (1 methods)

- `getTitleList` (line 17) — no `@docs`

