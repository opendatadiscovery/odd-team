# Collectors Adapters

60 adapters across 4 collector packages for databases, BI tools, ML platforms, cloud services.

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

## Secrets Backend (odd-collector)
- `odd-collector/collector_config.yaml` lines 1-34 — comment block documents secrets_backend
- Supported provider: `AWSSystemsManagerParameterStore`
- Config keys: `secrets_backend.provider`, `secrets_backend.region_name`, `secrets_backend.collector_settings_parameter_name`, `secrets_backend.collector_plugins_prefix`
- Secrets override file config values — **COMPLETELY UNDOCUMENTED**

## Config Examples
- `odd-collector/config_examples/` — 39 files (generic adapters)
- `odd-collector-aws/config_examples/` — 11 files (AWS adapters)
- `odd-collector-gcp/config_examples/` — 3 files (GCP adapters)
- `odd-collector-azure/config_examples/` — 4 files (Azure adapters)
- Total: 57 config examples for 60 adapters — **NO REFERENCE DOCS, only examples**

## Documentation
- `docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` — primary collector docs
  - References old individual repos (should be monorepo)
  - Missing odd-collector-azure entirely
  - Links to old config_examples URL
  - Lists Python 3.9.1 (should be range)

## Related Domains
→ collectors-sdk (adapters extend SDK base classes)
→ ingestion (adapters are the extraction step)
→ relationships (some adapters extract FK/ERD data)
→ data-quality (some adapters extract quality test results)
