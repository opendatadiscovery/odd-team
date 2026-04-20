---
id: docs/coverage/integration-docs
target_repo: odd-docs (remote) + all integration repos
scope: Documentation coverage for standalone integrations (GE, dbt, Spark, Airflow) and tooling (CLI, profiler)
estimated_items: 10-15
chunking: Can fit in one session (bounded number of integrations)
depends_on: []
priority: medium
---

## Purpose

Identify standalone integration packages and tools that have no documentation in odd-docs, or whose documentation is a stub.

## Method

1. List all standalone integration packages:
   - odd-great-expectations
   - odd-dbt
   - odd-spark-adapter
   - odd-airflow-2
   - odd-collector-profiler
   - odd-cli
2. Fetch SUMMARY.md from odd-docs
3. For each package, check:
   - Does a dedicated doc page exist?
   - Does the page explain: purpose, installation, configuration, usage?
   - Does it reference the repo?
   - Is it findable from the main docs navigation?

## Criteria for a Finding

- Integration has no documentation page
- Integration has a page but it's a stub (<100 words)
- Integration docs don't explain how to install/configure
- Integration docs reference a version that no longer exists
- Integration is missing from the "Integrations" or "Supported Sources" listing

## Output

Write to: `findings/docs-coverage-integration-docs/YYYY-MM-DD.md`

Per finding:
- Package name
- Documentation status: none / stub / outdated / adequate
- What's missing (installation? config? usage examples?)
- Each repo's own README quality (is it self-sufficient if no gitbook page exists?)
