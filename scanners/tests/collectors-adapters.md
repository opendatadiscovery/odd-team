---
id: tests/collectors-adapters
target_repo: odd-collectors (local)
scope: Per-adapter test coverage across all 4 collector packages
estimated_items: 30-50
chunking: 10 adapters per session, alphabetically within each collector package
depends_on: []
priority: high
---

## Purpose

Identify collector adapters that lack test coverage — especially integration tests that verify actual metadata extraction against real services.

## Method

For each collector package (odd-collector, odd-collector-aws, odd-collector-azure, odd-collector-gcp):

1. List all adapter directories: `{collector}/adapters/*/`
2. List all test files: `{collector}/tests/`
3. Cross-reference: which adapters have corresponding test files?
4. For adapters WITH tests, assess:
   - Is it a real integration test (testcontainers) or just a unit test?
   - Does it test `get_data_entity_list()` with realistic data?
   - Does it verify ODDRN generation correctness?
   - Does it test error handling (connection failure, empty response)?

## Adapter Priority for Testing

HIGH priority (widely used, complex):
- postgresql, mysql, snowflake, bigquery, dbt, airflow, s3, glue

MEDIUM priority (moderate usage):
- tableau, looker, oracle, mssql, clickhouse, kafka

LOWER priority (niche):
- Adapters with simple metadata extraction

## Criteria for a Finding

- Adapter directory has zero corresponding test file
- Adapter has unit test only (no integration test with testcontainers)
- Adapter test exists but doesn't test `get_data_entity_list()` output shape
- Adapter with mapper subdirectory has no mapper tests
- Adapter with relationships support has no relationship test

## Output

Write to: `findings/tests-collectors-adapters/YYYY-MM-DD-{collector}-batch-{N}.md`

Per finding:
- Adapter name and collector package
- Test status: none | unit-only | partial-integration | adequate
- Complexity of adding test (does testcontainers support this service?)
- Key risk if untested (what could break silently?)
