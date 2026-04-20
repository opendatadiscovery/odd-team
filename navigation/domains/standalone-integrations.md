# Standalone Integrations (stub)

Packages that run INSIDE other tools (GE, dbt, Spark, Airflow) and push metadata to ODD Platform. These are alternatives to the pull-based odd-collectors approach.

## Repos

| Package | Runs Inside | Sends |
|---------|-------------|-------|
| odd-great-expectations | GE checkpoint | Data quality results |
| odd-dbt | dbt CLI | Models, tests, lineage |
| odd-spark-adapter | Spark job | Job lineage, datasets |
| odd-airflow-2 | Airflow scheduler | DAG/task metadata |
| odd-collector-profiler | Standalone (DataProfiler) | Dataset statistics via `/ingestion/entities/datasets/stats` |

## Code Entry Points
- odd-great-expectations: `../odd-great-expectations/` (Python GE action)
- odd-dbt: remote (github.com/opendatadiscovery/odd-dbt)
- odd-spark-adapter: remote (github.com/opendatadiscovery/odd-spark-adapter)
- odd-airflow-2: remote (github.com/opendatadiscovery/odd-airflow-2)
- odd-collector-profiler: `../odd-collector-profiler/` (Python, uses Capital One DataProfiler — NOT pandas-profiling)

## Tests
<!-- To be populated by scanner -->

## Documentation
<!-- To be populated — check if gitbook covers these integrations -->

## Key Difference from Collectors
Collectors PULL metadata on a schedule. Standalone integrations PUSH metadata from within the tool's execution context. Both use the same Ingress API and odd-models.

## Related Domains
→ ingestion (all use the same Ingress API)
→ specification (all consume odd-models-package)
→ data-quality (GE and dbt send quality results)
→ lineage (Spark and Airflow send lineage data)
