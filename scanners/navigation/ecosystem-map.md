---
id: navigation/ecosystem-map
target_repo: all repos
scope: Map the full ODD ecosystem — all repos, their roles, dependencies, and version alignment
estimated_items: 15-20 repos
chunking: Can fit in one session (meta-level scan, not deep code reading)
depends_on: []
priority: high
---

## Purpose

Build a complete map of how all ODD repositories relate to each other. This is essential for understanding the blast radius of changes and for keeping the navigation index complete.

## Method

1. For each repo in the ODD ecosystem, determine:
   - Purpose (what it does)
   - Dependencies (what packages/repos it imports/uses)
   - Consumers (what uses this repo's output)
   - Current version / last activity
   - Active vs. archived/deprecated status

2. Build a dependency graph:
   - specification → odd-models-package → collectors SDK → adapters
   - specification → specification-contracts → platform
   - platform Ingress API ← collectors SDK, standalone integrations
   - charts → deploys platform + collectors

3. Check version alignment:
   - Do all consumers pin compatible versions of odd-models?
   - Do all integrations target the current Ingress API version?
   - Are any repos pinned to deprecated dependencies?

## Repos to Map

Core:
- opendatadiscovery-specification
- opendatadiscovery-specification-contracts
- odd-models-package
- odd-platform
- odd-collectors (monorepo: generic, aws, azure, gcp, sdk)

Standalone integrations:
- odd-great-expectations
- odd-dbt
- odd-spark-adapter
- odd-airflow-2
- odd-collector-profiler

Tooling:
- odd-cli
- oddrn-generator

Deployment:
- charts
- odd-examples

Meta:
- opendatadiscovery-integration-manifests
- odd-docs

## Criteria for a Finding

- Repo uses a deprecated version of odd-models or specification
- Repo has no clear relationship documented (isolated, unclear purpose)
- Dependency chain has version conflict
- Repo appears abandoned (no commits >1 year) but still referenced in docs
- Integration manifests list a repo that no longer exists or is archived

## Output

Write to: `findings/navigation-ecosystem-map/YYYY-MM-DD.md`

Also update: `navigation/repos.yaml` with any corrections and `navigation/domains/core-packages.md` with dependency chain details.

## Navigation Update (PRIMARY)

This scanner's main output enriches:
- `navigation/repos.yaml` — verified paths, tech stacks, current status
- `navigation/domains/core-packages.md` — dependency chain
- `navigation/domains/standalone-integrations.md` — verified entry points
