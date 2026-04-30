# Collectors SDK

Shared SDK library — adapter base classes, job scheduling, Platform API client, config loading.

## Code Entry Points (odd-collectors)
- Main orchestrator: `odd-collector-sdk/odd_collector_sdk/collector.py`
- Job types: `odd-collector-sdk/odd_collector_sdk/job.py` (SyncJob, AsyncJob, AsyncGeneratorJob)
- Adapter bases: `odd-collector-sdk/odd_collector_sdk/domain/adapter.py`
- Plugin base: `odd-collector-sdk/odd_collector_sdk/domain/plugin.py`
- Filter logic: `odd-collector-sdk/odd_collector_sdk/domain/filter.py`
- API client: `odd-collector-sdk/odd_collector_sdk/api/`
- Config loading (runtime): `odd-collector-sdk/odd_collector_sdk/domain/collector_config_loader.py` — `CollectorConfigLoader` class. `Collector.__init__` calls `CollectorConfigLoader(config_path, plugin_factory).load()` at `collector.py:61`. Fallback chain `config_path → $CONFIG_PATH → ./collector_config.yaml` at `collector_config_loader.py:23`. Also handles secrets-backend integration + priority-ordered settings/plugins merging. Uses pyaml-env for YAML + env var substitution.
- Config loading (test-only helper): `odd-collector-sdk/odd_collector_sdk/domain/collector_config.py:29` — `load_config` function. **Not used at runtime** — only caller is `tests/test_module_importer.py:13`. Vestigial; kept for the test path. Do not cite as the runtime loader.

## CollectorConfig Model
- `odd-collector-sdk/odd_collector_sdk/domain/collector_config.py` — `CollectorConfig(BaseSettings)` (Pydantic v2 via `pydantic_settings.BaseSettings`)
- 9 fields total — fully documented in `docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` "Full configuration reference" (DOC-014):
  - `default_pulling_interval` (Optional[int], default: None — None means run-once)
  - `connection_timeout_seconds` (int, default: 300)
  - `token` (str, required)
  - `plugins` (List[Plugin], required)
  - `platform_host_url` (str, required)
  - `chunk_size` (int, default: 250)
  - `misfire_grace_time` (Optional[int], default: None — fallback `default_pulling_interval × 60`)
  - `max_instances` (Optional[int], default: 1)
  - `verify_ssl` (bool, default: True)

## Tests
- SDK tests: `odd-collector-sdk/tests/` (if exists)

## Key Patterns
- AbstractAdapter: minimum contract — `get_data_source_oddrn()` + `get_data_entity_list()` (sync, async, or async-generator)
- BaseAdapter (concrete `AbstractAdapter` subclass): must implement `create_generator()` and `get_data_entity_list()`; auto-implements `get_data_source_oddrn()` from the generator
- AsyncAbstractAdapter: async variant — SDK wraps in AsyncJob via `inspect.iscoroutinefunction` dispatch in `job.create_job`
- Async-generator `get_data_entity_list` (`isasyncgenfunction`): SDK uses `AsyncGeneratorJob` for memory-efficient page-by-page yielding
- Plugin: Pydantic v2 model (`pydantic_settings.BaseSettings, extra="allow"`) with `type: Literal["{name}"]` discriminator
- PLUGIN_FACTORY: `Dict[str, Type[Plugin]]` mapping type string → Plugin class (declared as `PluginFactory` in `odd_collector_sdk.types`)

## Documentation (verified 2026-04-29)
- User-facing developer guide: `docs/developer-guides/custom-collectors.md` (DOC-044, review-ready) — 14-section walkthrough (when to author, project layout, Plugin / PluginFactory, three adapter contracts + automatic dispatch, Collector entry point, end-to-end skeleton, ODDRN generation, runtime config, packaging, testing, contribute back).
- Runtime config reference: `docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` "Full configuration reference" (DOC-014) — all 9 CollectorConfig fields.
- The build-and-run "How to implement new integration" stub at lines 121-167 was collapsed to a teaser pointing at `custom-collectors.md` as part of DOC-044 (Cornerstone-2 consolidation).
- Upstream `odd-collector-sdk/README.md` is partially outdated — documents the legacy `plugins_union_type=AvailablePlugins` constructor argument; the current `Collector` class uses `plugin_factory: PluginFactory` (per `collector.py:52-58`). The new doc-repo guide pins the current API.

## Related Domains
→ ingestion (SDK is the ingestion pipeline on collector side)
→ collectors-adapters (adapters extend SDK base classes)
