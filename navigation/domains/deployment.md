# Deployment (stub)

Helm charts, Docker configurations, and deployment guides for ODD Platform and collectors.

## Code Entry Points
- Helm charts: `../charts/` (Kubernetes deployment)
- Docker compose: `../odd-platform/docker/` (local dev/demo)
- Examples: `../odd-examples/` (reference deployments)
- Platform config: `../odd-platform/odd-platform-api/src/main/resources/application.yml`

## Tests
<!-- Helm lint, template validation — to be assessed -->

## Documentation
<!-- Gitbook deployment guides — to be verified for accuracy -->

## Key Config Alignment Points
- Helm chart values ↔ application.yml keys (must stay in sync)
- Docker compose env vars ↔ platform config
- Example configs ↔ current collector config format

## Related Domains
→ management (data source registration post-deployment)
→ authentication (auth config is deployment-time)
→ ingestion (collector deployment config)
