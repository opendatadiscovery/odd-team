---
id: tests/standalone-integrations
target_repo: odd-great-expectations (local) + odd-dbt, odd-spark-adapter, odd-airflow-2 (remote)
scope: Test coverage for all standalone integration packages
estimated_items: 15-30
chunking: One package per session
depends_on: []
priority: high
---

## Purpose

Assess test coverage for standalone integrations that push metadata from inside other tools (Great Expectations, dbt, Spark, Airflow). These run in user environments with no collector SDK safety net — failures are silent.

## Method

For each package:

1. Identify source modules (main logic, API client, model mapping)
2. Find existing test files
3. Cross-reference: which modules have tests, which don't?
4. Assess quality of existing tests:
   - Do they test actual metadata extraction?
   - Do they mock the external tool realistically?
   - Do they test the Ingress API submission?

## Packages to Scan

### odd-great-expectations (local: ../odd-great-expectations)
- GE action/checkpoint integration
- Quality result mapping to ODD models

### odd-dbt (remote — clone or fetch)
- dbt artifact parsing (manifest.json, run_results.json)
- Lineage extraction from dbt graph
- Model/test metadata mapping

### odd-spark-adapter (remote)
- Spark listener implementation
- Lineage capture from Spark plans
- Platform API submission

### odd-airflow-2 (remote)
- Airflow plugin hooks
- DAG/task metadata extraction
- Platform API submission

## Criteria for a Finding

- Package has zero tests
- Package has tests but doesn't test the metadata output shape
- Package has no integration test against the actual tool (even mocked)
- Critical path (API submission, model mapping) is untested
- Error handling (tool unavailable, API failure) is untested

## Output

Write to: `findings/tests-standalone-integrations/YYYY-MM-DD-{package}.md`

Per finding:
- Package and module
- What's untested
- Risk if it breaks (silent data loss? crash? wrong metadata?)
- Suggested test approach
