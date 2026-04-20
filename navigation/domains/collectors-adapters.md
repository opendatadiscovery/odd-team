# Collectors Adapters (stub)

40+ adapters across 4 collector packages for databases, BI tools, ML platforms, cloud services.

## Package Distribution
- odd-collector: Generic (postgresql, mysql, snowflake, dbt, tableau, airflow, etc.)
- odd-collector-aws: AWS services (S3, Glue, Athena, SageMaker, etc.)
- odd-collector-azure: Azure services (Blob Storage, PowerBI, Data Factory, etc.)
- odd-collector-gcp: GCP services (BigQuery, GCS, Dataproc, etc.)

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

## Related Domains
→ collectors-sdk (adapters extend SDK base classes)
→ ingestion (adapters are the extraction step)
→ relationships (some adapters extract FK/ERD data)
→ data-quality (some adapters extract quality test results)
