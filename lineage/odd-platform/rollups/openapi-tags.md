# openapi-tags rollup

Total tags: 35. Total tag→method edges: 198.
Auto-derived from `lineage/{repo}/nodes.jsonl` + `edges.jsonl`. Edges join on operationId == controller method name (OpenAPI generator convention).

## activity (3 operations, 3 bound to controllers)

- `GET /api/activity` → `getActivity`
- `GET /api/activity/counts` → `getActivityCounts`
- `GET /api/activity/users` → `getActivityUsers`

## alert (7 operations, 7 bound to controllers)

- `GET /api/alerts` → `getAllAlerts`
- `GET /api/alerts/counts` → `getAlertCounts`
- `GET /api/alerts/dependents` → `getDependentEntitiesAlerts`
- `GET /api/alerts/list` → `getAlertsList`
- `GET /api/alerts/my` → `getAssociatedUserAlerts`
- `GET /api/alerts/totals` → `getAlertTotals`
- `PUT /api/alerts/{alert_id}/status` → `changeAlertStatus`

## appInfo (1 operations, 1 bound to controllers)

- `GET /api/appInfo` → `getAppInfo`

## collector (5 operations, 5 bound to controllers)

- `GET /api/collectors` → `getCollectorsList`
- `POST /api/collectors` → `registerCollector`
- `DELETE /api/collectors/{collector_id}` → `deleteCollector`
- `PUT /api/collectors/{collector_id}` → `updateCollector`
- `PUT /api/collectors/{collector_id}/token` → `regenerateCollectorToken`

## dataCollaboration (3 operations, 3 bound to controllers)

- `GET /api/datacollaboration/providers/slack/channels` → `getSlackChannels`
- `POST /api/datacollaboration/providers/slack/messages` → `postMessageInSlack`
- `GET /api/messages/{message_id}/url` → `redirect`

## dataConsumer (0 operations, 0 bound to controllers)

## dataEntity (41 operations, 41 bound to controllers)

- `GET /api/dataentities/classes` → `getDataEntityClasses`
- `GET /api/dataentities/my` → `getMyObjects`
- `GET /api/dataentities/my/downstream` → `getMyObjectsWithDownstream`
- `GET /api/dataentities/my/upstream` → `getMyObjectsWithUpstream`
- `GET /api/dataentities/popular` → `getPopular`
- `GET /api/dataentities/usage` → `getDataEntitiesUsage`
- `GET /api/dataentities/{data_entity_id}` → `getDataEntityDetails`
- `GET /api/dataentities/{data_entity_id}/activity` → `getDataEntityActivity`
- `GET /api/dataentities/{data_entity_id}/alert_config` → `getAlertConfig`
- `PUT /api/dataentities/{data_entity_id}/alert_config` → `updateAlertConfig`
- `GET /api/dataentities/{data_entity_id}/alerts` → `getDataEntityAlerts`
- `GET /api/dataentities/{data_entity_id}/alerts/counts` → `getDataEntityAlertsCounts`
- `GET /api/dataentities/{data_entity_id}/alerts/list` → `getDataEntityAlertsList`
- `GET /api/dataentities/{data_entity_id}/channels` → `getChannels`
- `POST /api/dataentities/{data_entity_id}/data_entity_group` → `addDataEntityDataEntityGroup`
- `DELETE /api/dataentities/{data_entity_id}/data_entity_group/{data_entity_group_id}` → `deleteDataEntityFromDataEntityGroup`
- `PUT /api/dataentities/{data_entity_id}/description` → `upsertDataEntityInternalDescription`
- `GET /api/dataentities/{data_entity_id}/lineage/downstream` → `getDataEntityDownstreamLineage`
- `GET /api/dataentities/{data_entity_id}/lineage/upstream` → `getDataEntityUpstreamLineage`
- `GET /api/dataentities/{data_entity_id}/messages` → `getDataEntityMessages`
- `GET /api/dataentities/{data_entity_id}/messages/{message_id}` → `getMessages`
- `POST /api/dataentities/{data_entity_id}/metadata` → `createDataEntityMetadataFieldValue`
- `DELETE /api/dataentities/{data_entity_id}/metadata/{metadata_field_id}` → `deleteDataEntityMetadataFieldValue`
- `PUT /api/dataentities/{data_entity_id}/metadata/{metadata_field_id}` → `upsertDataEntityMetadataFieldValue`
- `GET /api/dataentities/{data_entity_id}/metrics` → `getDataEntityMetrics`
- `PUT /api/dataentities/{data_entity_id}/name` → `upsertDataEntityInternalName`
- `POST /api/dataentities/{data_entity_id}/ownership` → `createOwnership`
- `DELETE /api/dataentities/{data_entity_id}/ownership/{ownership_id}` → `deleteOwnership`
- `PUT /api/dataentities/{data_entity_id}/ownership/{ownership_id}` → `updateOwnership`
- `POST /api/dataentities/{data_entity_id}/queryexample` → `createQueryExampleToDatasetRelationshipNew`
- `DELETE /api/dataentities/{data_entity_id}/queryexample/{example_id}` → `deleteQueryExampleToDatasetRelationshipNew`
- `PUT /api/dataentities/{data_entity_id}/statuses` → `updateStatus`
- `PUT /api/dataentities/{data_entity_id}/tags` → `createDataEntityTagsRelations`
- `POST /api/dataentities/{data_entity_id}/terms` → `addDataEntityTerm`
- `DELETE /api/dataentities/{data_entity_id}/terms/{term_id}` → `deleteTermFromDataEntity`
- `POST /api/dataentitygroups` → `createDataEntityGroup`
- `GET /api/dataentitygroups/domains` → `getDomains`
- `PUT /api/dataentitygroups/{data_entity_group_id}` → `updateDataEntityGroup`
- `GET /api/dataentitygroups/{data_entity_group_id}/children` → `getDataEntityGroupsChildren`
- `GET /api/dataentitygroups/{data_entity_group_id}/items` → `getDataEntityGroupsItems`
- `GET /api/dataentitygroups/{data_entity_group_id}/lineage` → `getDataEntityGroupsLineage`

## dataEntityAttachment (10 operations, 10 bound to controllers)

- `GET /api/dataentities/{data_entity_id}/attachments` → `getAttachments`
- `GET /api/dataentities/{data_entity_id}/files/uploads` → `getUploadOptions`
- `POST /api/dataentities/{data_entity_id}/files/uploads` → `initiateFileUpload`
- `PUT /api/dataentities/{data_entity_id}/files/uploads/{upload_id}` → `completeFileUpload`
- `POST /api/dataentities/{data_entity_id}/files/uploads/{upload_id}/chunks` → `uploadFileChunk`
- `DELETE /api/dataentities/{data_entity_id}/files/{file_id}` → `deleteFile`
- `GET /api/dataentities/{data_entity_id}/files/{file_id}` → `downloadFile`
- `POST /api/dataentities/{data_entity_id}/links` → `saveLinks`
- `DELETE /api/dataentities/{data_entity_id}/links/{link_id}` → `deleteLink`
- `PUT /api/dataentities/{data_entity_id}/links/{link_id}` → `updateLink`

## dataEntityRun (1 operations, 1 bound to controllers)

- `GET /api/dataentities/{data_entity_id}/runs` → `getRuns`

## dataInput (0 operations, 0 bound to controllers)

## dataQuality (5 operations, 5 bound to controllers)

- `GET /api/datasets/{data_entity_id}/dataqatests` → `getDataEntityDataQATests`
- `PUT /api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity` → `setDataQATestSeverity`
- `GET /api/datasets/{data_entity_id}/sla` → `getSLA`
- `GET /api/datasets/{data_entity_id}/sla_report` → `getDatasetSLAReport`
- `GET /api/datasets/{data_entity_id}/test_report` → `getDatasetTestReport`

## dataQualityRuns (1 operations, 1 bound to controllers)

- `GET /api/dataqatests/runs` → `getDataQualityTestsRuns`

## dataSet (4 operations, 4 bound to controllers)

- `GET /api/datasets/{data_entity_id}/relationships` → `getDataSetRelationships`
- `GET /api/datasets/{data_entity_id}/structure` → `getDataSetStructureLatest`
- `GET /api/datasets/{data_entity_id}/structure/diff` → `getDataSetStructureDiff`
- `GET /api/datasets/{data_entity_id}/structure/{version_id}` → `getDataSetStructureByVersionId`

## dataSource (5 operations, 5 bound to controllers)

- `GET /api/datasources` → `getDataSourceList`
- `POST /api/datasources` → `registerDataSource`
- `DELETE /api/datasources/{data_source_id}` → `deleteDataSource`
- `PUT /api/datasources/{data_source_id}` → `updateDataSource`
- `PUT /api/datasources/{data_source_id}/token` → `regenerateDataSourceToken`

## datasetField (8 operations, 8 bound to controllers)

- `PUT /api/datasetfields/{dataset_field_id}/description` → `updateDatasetFieldDescription`
- `GET /api/datasetfields/{dataset_field_id}/enum_values` → `getEnumValues`
- `POST /api/datasetfields/{dataset_field_id}/enum_values` → `createEnumValue`
- `GET /api/datasetfields/{dataset_field_id}/metrics` → `getDatasetFieldMetrics`
- `PUT /api/datasetfields/{dataset_field_id}/name` → `updateDatasetFieldInternalName`
- `PUT /api/datasetfields/{dataset_field_id}/tags` → `updateDatasetFieldTags`
- `POST /api/datasetfields/{dataset_field_id}/terms` → `addDatasetFieldTerm`
- `DELETE /api/datasetfields/{dataset_field_id}/terms/{term_id}` → `deleteTermFromDatasetField`

## directory (4 operations, 4 bound to controllers)

- `GET /api/directory` → `getDataSourceTypes`
- `GET /api/directory/datasources` → `getDirectoryDatasourceList`
- `GET /api/directory/datasources/{data_source_id}` → `getDatasourceEntities`
- `GET /api/directory/datasources/{data_source_id}/types` → `getDatasourceEntityTypes`

## feature (1 operations, 1 bound to controllers)

- `GET /api/features/active` → `getActiveFeatures`

## genai (1 operations, 1 bound to controllers)

- `POST /api/genai/ask` → `genAiQuestion`

## identity (1 operations, 1 bound to controllers)

- `GET /api/identity/whoami` → `whoami`

## integration (2 operations, 2 bound to controllers)

- `GET /api/integrations` → `getIntegrationPreviews`
- `GET /api/integrations/{integration_id}` → `getIntegration`

## links (1 operations, 1 bound to controllers)

- `GET /api/links` → `getLinks`

## metadata (1 operations, 1 bound to controllers)

- `GET /api/metadata/fields` → `getMetadataFieldList`

## namespace (5 operations, 5 bound to controllers)

- `GET /api/namespaces` → `getNamespaceList`
- `POST /api/namespaces` → `createNamespace`
- `DELETE /api/namespaces/{namespace_id}` → `deleteNamespace`
- `GET /api/namespaces/{namespace_id}` → `getNamespaceDetails`
- `PUT /api/namespaces/{namespace_id}` → `updateNamespace`

## owner (4 operations, 4 bound to controllers)

- `GET /api/owners` → `getOwnerList`
- `POST /api/owners` → `createOwner`
- `DELETE /api/owners/{owner_id}` → `deleteOwner`
- `PUT /api/owners/{owner_id}` → `updateOwner`

## ownerAssociationRequest (7 operations, 7 bound to controllers)

- `GET /api/owner_association_request` → `getOwnerAssociationRequestList`
- `POST /api/owner_association_request` → `createOwnerAssociationRequest`
- `GET /api/owner_association_request/activity` → `getOwnerAssociationRequestActivityList`
- `PUT /api/owner_association_request/{owner_association_request_id}` → `updateOwnerAssociationRequest`
- `POST /api/owners/mapping` → `createUserOwnerMapping`
- `DELETE /api/owners/mapping/{owner_id}` → `deleteActiveUserOwnerMapping`
- `GET /api/owners/providers` → `getAuthProviders`

## permission (1 operations, 1 bound to controllers)

- `GET /api/resource/{permission_resource_type}/{resource_id}/permissions` → `getResourcePermissions`

## policy (6 operations, 6 bound to controllers)

- `GET /api/policies` → `getPolicyList`
- `POST /api/policies` → `createPolicy`
- `GET /api/policies/schema` → `getPolicySchema`
- `DELETE /api/policies/{policy_id}` → `deletePolicy`
- `GET /api/policies/{policy_id}` → `getPolicyDetails`
- `PUT /api/policies/{policy_id}` → `updatePolicy`

## queryExample (12 operations, 12 bound to controllers)

- `GET /api/queryexample` → `getQueryExampleList`
- `POST /api/queryexample` → `createQueryExamples`
- `GET /api/queryexample/dataset/{data_entity_id}` → `getQueryExampleByDatasetId`
- `POST /api/queryexample/search` → `queryExamplesSearch`
- `GET /api/queryexample/search/suggestions` → `getQueryExampleSearchSuggestions`
- `GET /api/queryexample/search/{search_id}` → `getQueryExampleSearchFacetList`
- `PUT /api/queryexample/search/{search_id}` → `updateQueryExampleSearchFacetList`
- `GET /api/queryexample/search/{search_id}/results` → `getQueryExampleSearchResults`
- `GET /api/queryexample/term/{term_id}` → `getQueryExampleByTermId`
- `DELETE /api/queryexample/{example_id}` → `deleteQueryExample`
- `GET /api/queryexample/{example_id}` → `getQueryExampleDetails`
- `PUT /api/queryexample/{example_id}` → `updateQueryExample`

## referenceData (16 operations, 16 bound to controllers)

- `POST /api/referencedata/search` → `referenceDataSearch`
- `GET /api/referencedata/search/{search_id}` → `getReferenceDataSearchFacetList`
- `PUT /api/referencedata/search/{search_id}` → `updateReferenceDataSearchFacetList`
- `GET /api/referencedata/search/{search_id}/results` → `getReferenceDataSearchResults`
- `POST /api/referencedata/table` → `createReferenceTable`
- `DELETE /api/referencedata/table/{lookup_table_id}` → `deleteLookupTable`
- `GET /api/referencedata/table/{lookup_table_id}` → `getLookupTableById`
- `PUT /api/referencedata/table/{lookup_table_id}` → `updateLookupTable`
- `POST /api/referencedata/table/{lookup_table_id}/columns` → `createColumnsForLookupTable`
- `DELETE /api/referencedata/table/{lookup_table_id}/columns/{column_id}` → `deleteLookupTableField`
- `GET /api/referencedata/table/{lookup_table_id}/columns/{column_id}` → `getLookupTableField`
- `PATCH /api/referencedata/table/{lookup_table_id}/columns/{column_id}` → `updateLookupTableField`
- `GET /api/referencedata/table/{lookup_table_id}/data` → `getLookupTableRowList`
- `POST /api/referencedata/table/{lookup_table_id}/data` → `addDataToLookupTable`
- `DELETE /api/referencedata/table/{lookup_table_id}/data/{row_id}` → `deleteLookupTableRow`
- `PATCH /api/referencedata/table/{lookup_table_id}/data/{row_id}` → `updateLookupTableRow`

## relationship (3 operations, 3 bound to controllers)

- `GET /api/relationships` → `getRelationships`
- `GET /api/relationships/erd/{relationship_id}` → `getERDRelationshipById`
- `GET /api/relationships/graph/{relationship_id}` → `getGraphRelationshipById`

## role (4 operations, 4 bound to controllers)

- `GET /api/roles` → `getRolesList`
- `POST /api/roles` → `createRole`
- `DELETE /api/roles/{role_id}` → `deleteRole`
- `PUT /api/roles/{role_id}` → `updateRole`

## search (7 operations, 7 bound to controllers)

- `POST /api/search` → `search`
- `GET /api/search/suggestions` → `getSearchSuggestions`
- `GET /api/search/{search_id}` → `getSearchFacetList`
- `PUT /api/search/{search_id}` → `updateSearchFacets`
- `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` → `highlightDataEntity`
- `GET /api/search/{search_id}/facet/{facet_type}` → `getFiltersForFacet`
- `GET /api/search/{search_id}/results` → `getSearchResults`

## tag (4 operations, 4 bound to controllers)

- `GET /api/tags` → `getPopularTagList`
- `POST /api/tags` → `createTag`
- `DELETE /api/tags/{tag_id}` → `deleteTag`
- `PUT /api/tags/{tag_id}` → `updateTag`

## term (23 operations, 23 bound to controllers)

- `GET /api/terms` → `getTermsList`
- `POST /api/terms` → `createTerm`
- `GET /api/terms/namespaces/{namespace_name}/names/{term_name}` → `getTermByNamespaceAndName`
- `POST /api/terms/search` → `termSearch`
- `GET /api/terms/search/suggestions` → `getTermSearchSuggestions`
- `GET /api/terms/search/{search_id}` → `getTermSearchFacetList`
- `PUT /api/terms/search/{search_id}` → `updateTermSearchFacets`
- `GET /api/terms/search/{search_id}/facet/{facet_type}` → `getTermFiltersForFacet`
- `GET /api/terms/search/{search_id}/results` → `getTermSearchResults`
- `DELETE /api/terms/{term_id}` → `deleteTerm`
- `GET /api/terms/{term_id}` → `getTermDetails`
- `PUT /api/terms/{term_id}` → `updateTerm`
- `GET /api/terms/{term_id}/linked_columns` → `getTermLinkedColumns`
- `GET /api/terms/{term_id}/linked_entities` → `getTermLinkedEntities`
- `GET /api/terms/{term_id}/linked_terms` → `getTermLinkedTerms`
- `POST /api/terms/{term_id}/ownership` → `createTermOwnership`
- `DELETE /api/terms/{term_id}/ownership/{ownership_id}` → `deleteTermOwnership`
- `PUT /api/terms/{term_id}/ownership/{ownership_id}` → `updateTermOwnership`
- `POST /api/terms/{term_id}/queryexample` → `createQueryExampleToTermRelationship`
- `DELETE /api/terms/{term_id}/queryexample/{example_id}` → `deleteQueryExampleToTermRelationship`
- `PUT /api/terms/{term_id}/tags` → `createTermTagsRelations`
- `POST /api/terms/{term_id}/term` → `addLinkedTermToTerm`
- `DELETE /api/terms/{term_id}/term/{linked_term_id}` → `deleteLinkedTermFromTerm`

## title (1 operations, 1 bound to controllers)

- `GET /api/titles` → `getTitleList`

