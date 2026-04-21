# Collectors SDK

Shared SDK library — adapter base classes, job scheduling, Platform API client, config loading.

## Code Entry Points (odd-collectors)
- Main orchestrator: `odd-collector-sdk/odd_collector_sdk/collector.py`
- Job types: `odd-collector-sdk/odd_collector_sdk/job.py` (SyncJob, AsyncJob, AsyncGeneratorJob)
- Adapter bases: `odd-collector-sdk/odd_collector_sdk/domain/adapter.py`
- Plugin base: `odd-collector-sdk/odd_collector_sdk/domain/plugin.py`
- Filter logic: `odd-collector-sdk/odd_collector_sdk/domain/filter.py`
- API client: `odd-collector-sdk/odd_collector_sdk/api/`
- Config loading: uses pyaml-env for YAML + env var substitution

## CollectorConfig Model
- `odd-collector-sdk/odd_collector_sdk/domain/collector_config.py` — `CollectorConfig(BaseSettings)`
- 8 fields total, only 4 documented:
  - `default_pulling_interval` (int, default: 10) — **DOCUMENTED**
  - `token` (str) — **DOCUMENTED**
  - `platform_host_url` (str) — **DOCUMENTED**
  - `plugins` (list) — **DOCUMENTED**
  - `connection_timeout_seconds` (int, default: 300) — **UNDOCUMENTED**
  - `chunk_size` (int, default: 250) — **UNDOCUMENTED**
  - `misfire_grace_time` (Optional[int], default: None) — **UNDOCUMENTED**
  - `max_instances` (int, default: 1) — **UNDOCUMENTED**
  - `verify_ssl` (bool, default: True) — **UNDOCUMENTED**

## Tests
- SDK tests: `odd-collector-sdk/tests/` (if exists)

## Key Patterns
- BaseAdapter: must implement `create_generator()` and `get_data_entity_list()`
- AsyncAbstractAdapter: async variant, SDK wraps in AsyncJob
- Plugin: Pydantic model with `type: Literal["{name}"]` discriminator
- PLUGIN_FACTORY: dict mapping type string → Plugin class

## Related Domains
→ ingestion (SDK is the ingestion pipeline on collector side)
→ collectors-adapters (adapters extend SDK base classes)
