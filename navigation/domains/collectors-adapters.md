# Collectors Adapters

60 adapters across 4 monorepo collector packages (plus the standalone `odd-collector-profiler` for statistical profiling) for databases, BI tools, ML platforms, cloud services.

## Package Distribution (verified 2026-04-29 against PLUGIN_FACTORY)
- odd-collector: 41 generic adapters — relational DBs (postgresql, mysql, mssql, clickhouse, redshift, cockroachdb, vertica, singlestore, oracle, odbc, sqlite), wide-column / NoSQL (mongodb, cassandra, scylladb, tarantool, couchbase, neo4j), search (elasticsearch, opensearch), analytics engines (databricks, duckdb, presto, trino, druid, hive), streaming (kafka), BI (tableau, superset, metabase, redash, mode, cubejs), catalog/ingestion (ckan, airbyte, fivetran, dbt, odd_adapter), ML (mlflow, feast, kubeflow), warehouses (snowflake)
- odd-collector-aws: 11 AWS adapters — athena, dms, dynamodb, glue, kinesis, quicksight, s3, s3_delta, sagemaker, sagemaker_featurestore, sqs
- odd-collector-azure: 4 Azure adapters — powerbi, azure_sql, blob_storage, azure_data_factory
- odd-collector-gcp: 4 GCP adapters — bigquery_storage, bigtable, gcs, gcs_delta

## Code Pattern (every adapter)
```
{collector}/adapters/{name}/
├── adapter.py       # REQUIRED: class Adapter(BaseAdapter)
├── repository.py    # Optional: data access (for databases)
├── client.py        # Optional: API client (for services)
├── models.py        # Optional: domain models
└── mappers/         # Optional: transform to ODD entities
```

## Registration Pattern
- Plugin model in `{collector}/domain/plugin.py`
- Type literal MUST match directory name
- Config example in `{collector}/config_examples/{name}.yaml`

## Tests
- Integration tests use testcontainers where applicable
- Location: `{collector}/tests/integration/test_{name}.py`
- Many adapters have NO tests (audit target)

## Secrets Backend (odd-collector)
- `odd-collector/collector_config.yaml` lines 1-34 — comment block documents secrets_backend
- Supported provider: `AWSSystemsManagerParameterStore`
- Config keys: `secrets_backend.provider`, `secrets_backend.region_name`, `secrets_backend.collector_settings_parameter_name`, `secrets_backend.collector_plugins_prefix`
- Secrets override file config values — **COMPLETELY UNDOCUMENTED**

## Config Examples
- `odd-collector/config_examples/` — 39 files (mode, opensearch missing — flagged in COL-004; cocroachdb.yaml filename typo — flagged in COL-006)
- `odd-collector-aws/config_examples/` — 11 files (all 11 adapters present)
- `odd-collector-gcp/config_examples/` — 3 files (3 of 4 adapters; bigtable example lives in the GCP collector README)
- `odd-collector-azure/config_examples/` — 4 files (all 4 adapters present)
- Total: 57 config examples for 60 adapters

## Documentation (current — verified 2026-04-29)

User-facing per-collector pages on the live docs (canonical home for adapter detail):
- `docs/integrations/collectors/odd-collector.md` — full inventory of 41 adapters; spotlight tables for postgresql/snowflake/kafka (DOC-042); per-adapter configuration reference for the remaining 38 (DOC-070, review-ready 2026-04-29)
- `docs/integrations/collectors/odd-collector-aws.md` — full inventory of 11 adapters; spotlight tables for glue/s3 (DOC-042); per-adapter configuration reference for the remaining 9 (DOC-071, review-ready 2026-04-29)
- `docs/integrations/collectors/odd-collector-azure.md` — full per-adapter coverage (DOC-042 + DOC-072, done)
- `docs/integrations/collectors/odd-collector-gcp.md` — full per-adapter coverage (DOC-042 + DOC-073, done)
- `docs/integrations/collectors/odd-collector-profiler.md` — single-purpose profiler collector (DOC-042, done)
- `docs/integrations/README.md` — Integrations hub: pull-vs-push table, common collector config schema, decision tree (DOC-042, done)

Developer-facing build/run guide:
- `docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` — bidirectional cross-link into the Integrations hub closes the Cornerstone-3 gap (DOC-016 rescoped, review-ready 2026-04-29). Also corrected: monorepo references (DOC-015), Python version (DOC-017), full CollectorConfig fields (DOC-014).

## Related Domains
→ collectors-sdk (adapters extend SDK base classes)
→ ingestion (adapters are the extraction step)
→ relationships (some adapters extract FK/ERD data)
→ data-quality (some adapters extract quality test results)
