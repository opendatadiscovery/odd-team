---
id: tests/collectors-sdk
target_repo: odd-collectors (local)
scope: SDK library test coverage
estimated_items: 10-20
chunking: Can fit in one session (SDK is bounded)
depends_on: []
priority: high
---

## Purpose

Assess test coverage of the shared collector SDK — the foundation all adapters depend on.

## Method

1. Read SDK source: `odd-collector-sdk/odd_collector_sdk/`
2. List existing tests: `odd-collector-sdk/tests/` (if exists)
3. Identify critical paths:
   - `collector.py` — main orchestration logic
   - `job.py` — job scheduling and execution
   - `domain/adapter.py` — base adapter lifecycle
   - `domain/plugin.py` — plugin resolution
   - `domain/filter.py` — include/exclude pattern matching
   - `api/` — Platform API client (HTTP calls, chunking, retry)

## Criteria for a Finding

- Critical SDK module has zero tests
- Filter logic (regex matching, include/exclude) has inadequate edge case tests
- API client has no test for chunking behavior (batch size limits)
- API client has no test for retry/error handling
- Job scheduling logic has no test for interval and one-shot modes
- Dynamic adapter loading has no test for error cases (missing adapter, bad config)

## Output

Write to: `findings/tests-collectors-sdk/YYYY-MM-DD.md`

Per finding:
- SDK module and function/method
- Why testing matters (what breaks if this is wrong?)
- Suggested test approach
- Whether test can be unit test or needs integration setup
