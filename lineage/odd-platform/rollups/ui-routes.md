# ui_routes rollup

Total routes: 12.
Auto-derived from `lineage/{repo}/nodes.jsonl`. One node per `*Routes.ts` file under `odd-platform-ui/src/routes/`.

## activity

File: `odd-platform-ui/src/routes/activityRoutes.ts` — no `@docs`
Base path: `/activity`
Full URL set: `/activity`

## alerts

File: `odd-platform-ui/src/routes/alertsRoutes.ts` — no `@docs`
Base path: `/alerts`
Full URL set: `/alerts`

## dataEntities

File: `odd-platform-ui/src/routes/dataEntitiesRoutes.ts` — no `@docs`
Base path: `/dataentities`
Sub-routes: `ACTIVITY=activity`, `ALERTS=alerts`, `DATA=data`, `DISCUSSIONS=discussions`, `HISTORY=history`, `LINEAGE=lineage`, `LINKED_ENTITIES=linked-entities`, `OVERVIEW=overview`, `QUERY_EXAMPLES=query-examples`, `RELATIONSHIPS=relationships`, `STRUCTURE=structure`, `TEST_REPORTS=test-reports`
Full URL set: `/dataentities`, `/dataentities/overview`, `/dataentities/lineage`, `/dataentities/alerts`, `/dataentities/test-reports`, `/dataentities/history`, `/dataentities/activity`, `/dataentities/discussions`, `/dataentities/query-examples`, `/dataentities/linked-entities`, `/dataentities/structure`, `/dataentities/data`, `/dataentities/relationships`

## dataModelling

File: `odd-platform-ui/src/routes/dataModelling/dataModelling.ts` — no `@docs`
Base path: `/data-modelling`
Full URL set: `/data-modelling`

## dataQuality

File: `odd-platform-ui/src/routes/dataQualityRoutes.ts` — no `@docs`
Base path: `(no BASE_PATH)`
Inline-returned paths: `/data-quality`
Full URL set: `/data-quality`

## directory

File: `odd-platform-ui/src/routes/directoryRoutes.ts` — no `@docs`
Base path: `/directory`
Full URL set: `/directory`

## management

File: `odd-platform-ui/src/routes/managementRoutes.ts` — no `@docs`
Base path: `/management`
Sub-routes: `ACTIVE=active`, `ASSOCIATIONS=associations`, `COLLECTORS=collectors`, `DATASOURCES=datasources`, `HISTORY=history`, `INTEGRATIONS=integrations`, `NAMESPACES=namespaces`, `NEW=new`, `OWNERS=owners`, `POLICIES=policies`, `ROLES=roles`, `TAGS=tags`
Full URL set: `/management`, `/management/namespaces`, `/management/datasources`, `/management/integrations`, `/management/collectors`, `/management/owners`, `/management/tags`, `/management/associations`, `/management/roles`, `/management/policies`, `/management/new`, `/management/history`, `/management/active`

## masterData

File: `odd-platform-ui/src/routes/masterDataRoutes.ts` — no `@docs`
Base path: `/master-data`
Full URL set: `/master-data`

## queryExamples

File: `odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts` — no `@docs`
Base path: `(no BASE_PATH)`
BASE_PATH imported from: `./dataModelling` (paths are relative)
Inline-returned paths: `/query-examples`, `/:queryExampleId`
Full URL set: `/query-examples`, `/:queryExampleId`

## relationships

File: `odd-platform-ui/src/routes/dataModelling/relationshipsRoutes.ts` — no `@docs`
Base path: `(no BASE_PATH)`
BASE_PATH imported from: `./dataModelling` (paths are relative)
Inline-returned paths: `/relationships`
Full URL set: `/relationships`

## search

File: `odd-platform-ui/src/routes/searchRoutes.ts` — no `@docs`
Base path: `/search`
Full URL set: `/search`

## terms

File: `odd-platform-ui/src/routes/termsRoutes.ts` — no `@docs`
Base path: `/terms`
Sub-routes: `LINKED_COLUMNS=linked-columns`, `LINKED_ENTITIES=linked-entities`, `LINKED_TERMS=linked-terms`, `OVERVIEW=overview`, `QUERY_EXAMPLES=query-examples`
Extra paths: `TERMS_SEARCH_PATH=/termsearch`
Full URL set: `/terms`, `/terms/overview`, `/terms/linked-entities`, `/terms/linked-columns`, `/terms/linked-terms`, `/terms/query-examples`, `/termsearch`

