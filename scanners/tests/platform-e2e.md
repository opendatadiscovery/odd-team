---
id: tests/platform-e2e
target_repo: odd-platform (local)
scope: Playwright E2E test coverage of user workflows
estimated_items: 10-25
chunking: Can likely fit in one session
depends_on: []
priority: medium
---

## Purpose

Identify critical user workflows that lack end-to-end test coverage.

## Method

1. List existing Playwright tests: `tests/` directory
2. Enumerate critical user workflows from UI routes and feature domains
3. Cross-reference: which workflows have E2E coverage, which don't?

## Critical Workflows to Check

- [ ] User login/authentication flow
- [ ] Data source registration and first ingestion
- [ ] Entity search (text + facets)
- [ ] Entity detail view (all tabs)
- [ ] Lineage graph navigation
- [ ] Glossary term creation and assignment
- [ ] Alert configuration and triggering
- [ ] Ownership assignment
- [ ] Tag/label management
- [ ] Lookup table CRUD
- [ ] Quality test result viewing
- [ ] Namespace/data source management
- [ ] Collector configuration

## Criteria for a Finding

- Critical workflow has zero E2E test
- E2E test exists but only covers happy path (no error states)
- E2E test is flaky or marked as skipped

## Output

Write to: `findings/tests-platform-e2e/YYYY-MM-DD.md`

Per finding:
- Workflow description
- Whether completely untested or partially tested
- Existing test file (if partial)
- Complexity estimate for adding the test
