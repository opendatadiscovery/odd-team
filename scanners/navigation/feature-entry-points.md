---
id: navigation/feature-entry-points
target_repo: odd-platform (local)
scope: Map every feature to its code entry points (controller, service, UI route, component)
estimated_items: 15-25 features
chunking: By feature domain — 3-4 domains per session
depends_on: []
priority: medium
---

## Purpose

Build the navigation index by tracing each feature through all layers of the codebase. This scanner's PRIMARY output is updating `navigation/domains/*.md` files — findings are secondary.

## Method

For each feature domain in `navigation/features.yaml`:

1. **API Layer**: Search `odd-platform-specification/openapi.yaml` for related endpoints
2. **Controller Layer**: Find controller(s) implementing those endpoints
3. **Service Layer**: Trace controller dependencies to service classes
4. **Repository Layer**: Trace service dependencies to repository classes
5. **Database**: Identify key tables from repository queries and migrations
6. **UI Route**: Find the React route definition for this feature
7. **UI Components**: Find the component tree for this feature's pages
8. **Redux State**: Find slices/thunks related to this feature

## Output: Navigation Update (PRIMARY)

Update `navigation/domains/{feature}.md` with discovered paths:
```markdown
## Code Entry Points (odd-platform)
- OpenAPI: odd-platform-specification/openapi.yaml → /api/{path}
- Controller: odd-platform-api/src/.../controller/{Name}Controller.java
- Service: odd-platform-api/src/.../service/{Name}Service.java
- Repository: odd-platform-api/src/.../repository/reactive/Reactive{Name}Repository.java
- DB Tables: {table_name} (from migration V{N}__{desc}.sql)
- UI Route: odd-platform-ui/src/routes/{file}.tsx → /{path}
- UI Component: odd-platform-ui/src/components/{Dir}/
- Redux: odd-platform-ui/src/redux/slices/{slice}.ts
```

## Output: Findings (SECONDARY)

Write to: `findings/navigation-feature-entry-points/YYYY-MM-DD-{domains}.md`

Report gaps only:
- Feature has no clear controller (logic scattered)
- Feature has no dedicated service (logic in controller)
- Feature's UI component tree is hard to find (deeply nested, inconsistent naming)
- Feature spans multiple services with no clear "entry" service
