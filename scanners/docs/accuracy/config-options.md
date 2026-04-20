---
id: docs/accuracy/config-options
target_repo: odd-docs (remote) + odd-platform (local) + odd-collectors (local)
scope: Documented configuration options vs. actual application config
estimated_items: 15-30
chunking: Platform config in one session, collectors config in another
depends_on: []
priority: critical
---

## Purpose

Verify that documented configuration options (environment variables, YAML keys, command-line flags) exist and work as described.

## Method

1. Fetch configuration/setup documentation from odd-docs
2. Extract all documented config keys, env vars, and their described behavior
3. Cross-reference against:
   - `odd-platform-api/src/main/resources/application.yml` (and application-*.yml profiles)
   - Collector `config_examples/` directories
   - Docker compose files in `docker/`
   - Dockerfile ENV declarations

## Criteria for a Finding

- Documented config key doesn't exist in application config files
- Documented env var is never read in code
- Documented default value differs from actual default
- Documented config option has been renamed (old name still in docs)
- Documented required fields are actually optional (or vice versa)
- Documented value format (e.g., "comma-separated list") doesn't match parsing logic

## Output

Write to: `findings/docs-accuracy-config-options/YYYY-MM-DD-{target}.md`

Per finding:
- Doc page and the configuration claim
- Actual config file location and current state
- Whether the option is missing, renamed, has wrong default, or wrong description
