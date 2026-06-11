# Deployment (stub)

Helm charts, Docker configurations, and deployment guides for ODD Platform and collectors.

## Code Entry Points
- Helm charts: `../charts/` (Kubernetes deployment)
- Docker compose: `../odd-platform/docker/` (local dev/demo — NO healthcheck blocks shipped; demo.yaml maps 8080:8080)
- Examples: `../odd-examples/` (reference deployments)
- Platform config: `../odd-platform/odd-platform-api/src/main/resources/application.yml`
- Health/monitoring surface: `application.yml:229-245` (management block — endpoints disabled by default; health/prometheus/env/info enabled+exposed; ldap+redis health indicators OFF) + `auth/util/SecurityConstants.java:95-96` (`/actuator/**` whitelisted ahead of auth in all 4 modes). Actuator ships via the `spring` bundle (`gradle/libs.versions.toml:51,125`); `micrometer-registry-prometheus` at `odd-platform-api/build.gradle:29`. No custom HealthIndicator classes in the codebase.

## Tests
<!-- Helm lint, template validation — to be assessed -->
- `HealthAPITest.java` (odd-platform-api/src/test/.../api/) exists but is fully commented out (`//@Test`, TODO "fails in github") — zero active coverage of /actuator/health.

## Documentation
- Health & monitoring (canonical operational-monitoring home): `documentation/docs/configuration-and-deployment/health-and-monitoring.md` (DOC-440, 2026-06-11)
- Actuator security posture: `documentation/docs/configuration-and-deployment/odd-platform.md` § Management endpoint exposure and credential hygiene

## Key Config Alignment Points
- Helm chart values ↔ application.yml keys (must stay in sync)
- Docker compose env vars ↔ platform config
- Example configs ↔ current collector config format

## Related Domains
→ management (data source registration post-deployment)
→ authentication (auth config is deployment-time)
→ ingestion (collector deployment config)
