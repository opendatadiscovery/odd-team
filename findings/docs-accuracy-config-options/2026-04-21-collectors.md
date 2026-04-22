# Findings: docs/accuracy/config-options
# Date: 2026-04-21
# Target: documentation repo + odd-collectors repo
# Scope: Collector configuration — all documented config keys vs. actual collector_config.yaml and SDK CollectorConfig model

## Summary
- Total config areas audited: 4 (SDK config model, secrets backend, per-adapter configs, collector repo references)
- New findings: 5
- Enrichments of prior findings: 1
- Severity breakdown: 1 critical, 2 high, 3 medium

## Findings

### F-061: Collector SDK config model has 5 undocumented fields
- **Location**: Missing from all documentation pages
- **Issue**: The `CollectorConfig` class in `odd-collector-sdk/odd_collector_sdk/domain/collector_config.py` defines these config fields that are never documented anywhere: `connection_timeout_seconds` (default: 300), `chunk_size` (default: 250), `misfire_grace_time` (default: None), `max_instances` (default: 1), `verify_ssl` (default: True). The only documented fields are `default_pulling_interval`, `token`, `platform_host_url`, and `plugins` (in `build-and-run-odd-collectors.md` line 85). Users tuning collector performance or running in environments with self-signed certs cannot discover `verify_ssl=False` or `chunk_size` adjustment.
- **Evidence**: `collector_config.py` lines 13-27: `CollectorConfig(BaseSettings)` with 8 fields. `build-and-run-odd-collectors.md` lines 84-92: shows only 4 fields (`default_pulling_interval`, `token`, `platform_host_url`, `plugins`).
- **Severity**: high
- **Suggested fix**: Create a collector configuration reference page listing all CollectorConfig fields with types, defaults, and descriptions. Key fields: `verify_ssl` (for self-signed certs), `chunk_size` (for large metadata sets), `connection_timeout_seconds` (for slow sources).

### F-062: Secrets backend (AWS SSM Parameter Store) completely undocumented
- **Location**: Missing from all documentation pages
- **Issue**: `odd-collector/collector_config.yaml` lines 1-34 describe a `secrets_backend` config block that allows storing collector config (token, plugin credentials) in AWS Systems Manager Parameter Store instead of the YAML file. This is a production-critical security feature — credentials shouldn't be in plaintext config files. The feature supports: provider selection (`AWSSystemsManagerParameterStore`), region, custom parameter names, and per-plugin secrets. Zero documentation exists.
- **Evidence**: `odd-collector/collector_config.yaml` lines 27-34: `secrets_backend.provider`, `secrets_backend.region_name`, `secrets_backend.collector_settings_parameter_name`, `secrets_backend.collector_plugins_prefix`. Comment block (lines 1-26) is the only "documentation" that exists.
- **Severity**: critical
- **Suggested fix**: Create documentation for the secrets backend feature. Cover: supported providers, naming conventions, priority (secrets override file config), and setup steps.

### F-063: Docs reference old individual collector repos instead of monorepo
- **Location**: `documentation/docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` lines 13-15
- **Issue**: Docs list 3 collectors with links to individual repos: `odd-collector`, `odd-collector-aws`, `odd-collector-gcp`. The collectors have been consolidated into the `odd-collectors` monorepo. Additionally, `odd-collector-azure` is completely missing from this list — it exists in the monorepo but is never mentioned in docs. The clone command (line 38) also references the old repo: `git clone https://github.com/{username}/odd-collector.git`.
- **Evidence**: Local path `../odd-collectors/` contains all 4 collectors as subdirectories. `odd-collector-azure` has 4 adapters (azure_sql, azure_data_factory, blob_storage, power_bi). Docs don't mention Azure at all.
- **Severity**: medium
- **Suggested fix**: Update repo references to the monorepo. Add odd-collector-azure to the list. Fix clone command.

### F-064: 60 adapters exist across 4 collectors — docs only reference generic "examples"
- **Location**: `documentation/docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` line 82
- **Issue**: Docs say "Configure `collector-config.yaml` using [this](https://github.com/opendatadiscovery/odd-collector/tree/main/config_examples) as an example" — linking to old repo URL. There are 39 config examples in odd-collector alone, plus 11 AWS, 4 GCP, and 4 Azure adapter configs. No documentation page lists the supported adapters, their required config fields, or connection parameters. Users must find and read individual config_examples YAML files.
- **Evidence**: `odd-collector/config_examples/` — 39 files. `odd-collector-aws/config_examples/` — 11 files. `odd-collector-gcp/config_examples/` — 3 files. `odd-collector-azure/config_examples/` — 4 files. Total: 60 adapters across 4 collectors. Each has different required fields.
- **Severity**: high
- **Suggested fix**: Create an adapter reference page (or per-collector pages) listing all supported adapters with their config fields. This could be auto-generated from the config examples.

### F-065: Python version requirement outdated
- **Location**: `documentation/docs/developer-guides/build-and-run/build-and-run-odd-collectors.md` line 27
- **Issue**: Docs say "Python 3.9.1" is required. The `odd-collectors` monorepo `pyproject.toml` should be checked for the actual minimum, but the specific pinning of "3.9.1" is unusual (normally a minimum like ">=3.9"). This may mislead developers into using exactly that version rather than any compatible one.
- **Evidence**: Line 27: "Python 3.9.1". Poetry generally works with version ranges, not exact pins.
- **Severity**: medium
- **Suggested fix**: Verify the actual minimum Python version from pyproject.toml and update to a range (e.g., "Python 3.9+").

## Enrichments

### F-066 ← enriches F-032 (docs-accuracy-feature-behavior)
- **Original**: F-032 in `findings/docs-accuracy-feature-behavior/2026-04-20-batch-3.md`
- **New evidence**: `build-and-run-odd-collectors.md` lines 13-15 also reference old individual repo URLs (`odd-collector`, `odd-collector-aws`, `odd-collector-gcp`). Line 38 has clone command for old repo. Line 82 links to old config_examples URL. This is the same issue as F-032 (trylocally.md referencing old repos) but in a different doc page.
- **Severity adjustment**: unchanged (medium)

## Notes

- **Adapter count**: 41 generic + 11 AWS + 4 GCP + 4 Azure = 60 adapters. Config examples cover 57 of these (39+11+3+4).
- **Config priority**: secrets_backend settings override file config (documented only in collector_config.yaml comments)
- **SDK README**: Has some config documentation (`CollectorConfig` class) but this isn't linked from any docs page
- The collector docs are developer-focused (build-and-run), not operator-focused (configure-and-deploy). There's no operator guide for running collectors in production.
