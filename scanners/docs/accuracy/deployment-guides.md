---
id: docs/accuracy/deployment-guides
target_repo: documentation (local: ../documentation) + charts (local) + odd-platform/docker (local) + odd-examples (local)
scope: Deployment documentation vs. actual Helm charts, Docker configs, and example setups
estimated_items: 10-20
chunking: One deployment method per session (Helm, Docker, examples)
depends_on: []
priority: critical
---

## Purpose

Verify that deployment documentation matches actual deployment configurations. Wrong deployment docs cause production incidents.

## Method

1. Fetch deployment documentation from the documentation repo
2. Cross-reference against actual files:
   - Helm chart `values.yaml` → do documented values exist?
   - Docker compose files → do documented services/env vars exist?
   - Example configs → do they work with current versions?

## What to Check

### Helm Charts (../charts)
- Documented chart values vs. actual `values.yaml`
- Documented version requirements vs. Chart.yaml
- Documented dependencies (PostgreSQL, Redis) vs. chart dependencies
- Documented upgrade procedures vs. actual migration needs

### Docker Compose (../odd-platform/docker/)
- Documented compose commands vs. actual file names
- Documented env vars vs. actual service configs
- Documented port mappings vs. actual expose/ports

### Examples (../odd-examples)
- Example configs reference current config format?
- Example docker-compose files use current image tags?
- Example collector configs use current plugin types?

### Integration Manifests (remote)
- Listed integrations match actual available adapters?
- Capabilities described match implementation?

## Criteria for a Finding

- Documented Helm value doesn't exist in values.yaml
- Documented env var is never read by the container
- Example config uses deprecated plugin type or removed field
- Documented deployment step references removed script/service
- Version pinned in docs is outdated vs. latest release

## Output

Write to: `findings/docs-accuracy-deployment-guides/YYYY-MM-DD-{method}.md`

Per finding:
- Doc page and the deployment claim
- Actual file and its current state
- Severity: critical (would cause failed deployment) vs. high (misleading) vs. medium (cosmetic)
